"""Интерпретация ансамблей деревьев «по определению».

* :func:`expected_value` — условное ожидание дерева при известных признаках S
  (алгоритм EXPVALUE из статьи Lundberg et al., 2018): неизвестные признаки
  «усредняются» по долям обучающих объектов в ветвях (cover).
* :func:`shapley_values` — точные значения Шепли перебором всех подмножеств.
  Для деревьев это ровно то, что считает ``shap.TreeExplainer``
  (feature_perturbation="tree_path_dependent"), только медленнее и прозрачнее.
* :func:`partial_dependence`, :func:`ice_curves` — PDP и ICE.
* :func:`permutation_importance` — важность через перемешивание столбца.

Зеркало: ``shared/web/js/engine/explain.js``.
"""

from __future__ import annotations

import math
from collections.abc import Callable

import numpy as np

from .rng import Mulberry32


def expected_value(tree, x, known: frozenset | set, cover: str = "n") -> float:
    """E[f(X) | X_S = x_S] для одного дерева (EXPVALUE).

    cover : "n" — доля обучающих объектов (как у sklearn); "H" — сумма гессианов (XGBoost).
    """
    nodes = tree.nodes

    def weight(nd) -> float:
        return float(nd.n) if cover == "n" else float(nd.H)

    def go(nid: int) -> float:
        nd = nodes[nid]
        if nd.is_leaf:
            return nd.value
        if nd.feature in known:
            v = x[nd.feature]
            left = nd.missing_left if math.isnan(v) else v <= nd.threshold
            return go(nd.left if left else nd.right)
        a, b = nodes[nd.left], nodes[nd.right]
        wa, wb = weight(a), weight(b)
        tot = wa + wb
        if tot <= 0:
            return 0.5 * (go(a.id) + go(b.id))
        return (wa * go(a.id) + wb * go(b.id)) / tot

    return go(0)


def _model_trees(model, class_index: int = 0):
    """Список (дерево, коэффициент) и начальное значение для модели gbcourse."""
    from .boosting import GradientBoosting

    if isinstance(model, GradientBoosting):
        k = class_index if model.multiclass_ else 0
        base = float(np.asarray(model.init_).ravel()[k])
        return [(stage[k], model.learning_rate) for stage in model.trees_], base
    if hasattr(model, "trees_") and hasattr(model, "alphas_"):
        raise TypeError("Для AdaBoost используйте decision_function и перебор вручную")
    if hasattr(model, "trees_"):
        B = len(model.trees_)
        return [(t, 1.0 / B) for t in model.trees_], 0.0
    if hasattr(model, "nodes"):
        return [(model, 1.0)], 0.0
    raise TypeError("Неподдерживаемая модель")


def shapley_values(model, x, cover: str = "n", class_index: int = 0) -> tuple[float, np.ndarray]:
    """Точные значения Шепли для одного объекта (в «сырых» единицах модели).

    Возвращает (φ₀, φ), где φ₀ = E[f(X)] — базовое значение, а
    f(x) = φ₀ + Σ φⱼ (свойство аддитивности, «local accuracy»).
    Сложность O(2^M · T · L) — годится для M ≲ 12 используемых признаков.
    """
    x = np.asarray(x, dtype=float).ravel()
    trees, base = _model_trees(model, class_index)
    used = sorted({nd.feature for t, _ in trees for nd in t.nodes if not nd.is_leaf})
    M = len(used)
    d = x.size
    phi = np.zeros(d)

    cache: dict[int, float] = {}

    def v(mask: int) -> float:
        if mask not in cache:
            S = frozenset(used[j] for j in range(M) if mask >> j & 1)
            cache[mask] = base + sum(c * expected_value(t, x, S, cover) for t, c in trees)
        return cache[mask]

    fact = [math.factorial(k) for k in range(M + 1)]
    for j in range(M):
        bit = 1 << j
        total = 0.0
        for mask in range(1 << M):
            if mask & bit:
                continue
            s = bin(mask).count("1")
            wgt = fact[s] * fact[M - s - 1] / fact[M]
            total += wgt * (v(mask | bit) - v(mask))
        phi[used[j]] = total
    return v(0), phi


def partial_dependence(predict: Callable, X, feature: int, grid=None, n_grid: int = 30):
    """PDP: средний прогноз, когда признак ``feature`` принудительно равен значению сетки."""
    X = np.asarray(X, dtype=float)
    if grid is None:
        col = X[:, feature]
        grid = np.linspace(np.nanmin(col), np.nanmax(col), n_grid)
    grid = np.asarray(grid, dtype=float)
    out = np.empty(grid.size)
    Xc = X.copy()
    for i, gv in enumerate(grid):
        Xc[:, feature] = gv
        out[i] = float(np.mean(predict(Xc)))
    return grid, out


def ice_curves(predict: Callable, X, feature: int, grid=None, n_grid: int = 30):
    """ICE: индивидуальные кривые (по строке на объект); их среднее — PDP."""
    X = np.asarray(X, dtype=float)
    if grid is None:
        col = X[:, feature]
        grid = np.linspace(np.nanmin(col), np.nanmax(col), n_grid)
    grid = np.asarray(grid, dtype=float)
    curves = np.empty((X.shape[0], grid.size))
    Xc = X.copy()
    for i, gv in enumerate(grid):
        Xc[:, feature] = gv
        curves[:, i] = predict(Xc)
    return grid, curves


def permutation_importance(predict: Callable, X, y, metric: Callable, n_repeats: int = 5,
                           seed: int = 0, greater_is_better: bool = False) -> tuple[np.ndarray, np.ndarray]:
    """Насколько ухудшается метрика, если перемешать один столбец.

    Возвращает (среднее ухудшение, стандартное отклонение) по признакам.
    """
    X = np.asarray(X, dtype=float)
    y = np.asarray(y)
    rng = Mulberry32(seed)
    base = metric(y, predict(X))
    d = X.shape[1]
    drops = np.zeros((d, n_repeats))
    for j in range(d):
        for r in range(n_repeats):
            Xp = X.copy()
            perm = rng.permutation(X.shape[0])
            Xp[:, j] = X[perm, j]
            score = metric(y, predict(Xp))
            drops[j, r] = (base - score) if greater_is_better else (score - base)
    return drops.mean(axis=1), drops.std(axis=1)


def sklearn_tree_to_nodes(sk_tree, learning_rate: float = 1.0):
    """Преобразовать ``tree_`` из scikit-learn в объект с полем ``nodes`` (для EXPVALUE)."""
    from types import SimpleNamespace

    from .tree import Node

    t = sk_tree.tree_ if hasattr(sk_tree, "tree_") else sk_tree
    nodes = []
    for i in range(t.node_count):
        left, right = int(t.children_left[i]), int(t.children_right[i])
        nodes.append(Node(
            id=i, depth=0, n=int(t.n_node_samples[i]), G=0.0, H=float(t.weighted_n_node_samples[i]),
            value=float(t.value[i].ravel()[0]) * learning_rate,
            feature=int(t.feature[i]) if left >= 0 else -1,
            threshold=float(t.threshold[i]) if left >= 0 else math.nan,
            left=left if left >= 0 else -1, right=right if right >= 0 else -1,
        ))
    return SimpleNamespace(nodes=nodes)
