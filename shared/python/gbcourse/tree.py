"""Дерево решений для регрессии (CART), которое учится по градиентам и гессианам.

Один и тот же код покрывает всё, что нужно курсу:

* **классическое дерево на остатках** (Фридман): передайте ``g = −r`` и ``h = 1``,
  ``reg_lambda = 0`` — критерий станет уменьшением суммы квадратов, а значение
  листа — средним остатком;
* **дерево второго порядка** (XGBoost): настоящие ``g``, ``h``, штрафы ``λ``, ``α``, ``γ``;
* **гистограммный поиск разбиений** (LightGBM / XGBoost ``hist``): ``max_bins``;
* **рост по уровням** (``growth="depthwise"``) и **по листьям** (``growth="leafwise"``);
* **пропуски (NaN)**: для каждого разбиения выбирается направление по умолчанию.

Формулы (для листа с суммами G = Σg, H = Σh):

    вес листа         w* = −T_α(G) / (H + λ)
    «качество» листа  S(G, H) = T_α(G)² / (H + λ)
    выигрыш разбиения gain = ½ [S(G_L, H_L) + S(G_R, H_R) − S(G, H)] − γ

где T_α(G) = sign(G)·max(|G| − α, 0) — мягкий порог (L1-штраф).

Зеркало: ``shared/web/js/engine/tree.js``. Порядок перебора признаков и порогов,
правило разрешения ничьих (побеждает первый максимум) и порядок суммирования
совпадают, поэтому деревья в Python и в браузере получаются одинаковыми.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from ._numeric import quantile, seq_sum
from .rng import Mulberry32, as_rng


@dataclass
class Node:
    """Узел дерева. Для листа ``left == right == -1``."""

    id: int
    depth: int
    n: int
    G: float
    H: float
    value: float
    feature: int = -1
    threshold: float = math.nan
    left: int = -1
    right: int = -1
    gain: float = 0.0
    missing_left: bool = True
    rows: np.ndarray | None = field(default=None, repr=False)

    @property
    def is_leaf(self) -> bool:
        return self.left < 0


@dataclass
class Split:
    feature: int
    threshold: float
    gain: float
    missing_left: bool
    left_rows: np.ndarray
    right_rows: np.ndarray


def _soft_threshold(G, alpha: float):
    if alpha <= 0:
        return G
    return np.sign(G) * np.maximum(np.abs(G) - alpha, 0.0)


def _score(G, H, lam: float, alpha: float):
    """S(G, H) = T_α(G)² / (H + λ); 0, если знаменатель не положителен."""
    T = _soft_threshold(np.asarray(G, dtype=float), alpha)
    den = np.asarray(H, dtype=float) + lam
    out = np.zeros(np.broadcast(T, den).shape)
    np.divide(T * T, den, out=out, where=den > 0)
    return out


def make_bins(X: np.ndarray, max_bins: int = 32) -> list[np.ndarray]:
    """Границы гистограммных корзин для каждого признака.

    Если различных значений не больше ``max_bins``, границы — середины между
    соседними значениями (гистограмма эквивалентна точному перебору). Иначе —
    квантили уровней k/max_bins. Разбиение по границе e: ``x ≤ e`` → влево.
    """
    X = np.asarray(X, dtype=float)
    bins = []
    for j in range(X.shape[1]):
        col = X[:, j]
        col = col[~np.isnan(col)]
        uniq = np.unique(col)
        if uniq.size <= 1:
            bins.append(np.array([], dtype=float))
            continue
        if uniq.size <= max_bins:
            edges = (uniq[:-1] + uniq[1:]) / 2.0
        else:
            qs = [quantile(col, k / max_bins) for k in range(1, max_bins)]
            edges = np.unique(np.array(qs, dtype=float))
        bins.append(edges)
    return bins


def bin_codes(X: np.ndarray, bins: list[np.ndarray]) -> np.ndarray:
    """Номер корзины для каждого значения: число границ, строго меньших x (NaN → −1)."""
    X = np.asarray(X, dtype=float)
    codes = np.empty(X.shape, dtype=np.int64)
    for j, edges in enumerate(bins):
        col = X[:, j]
        c = np.searchsorted(edges, col, side="left").astype(np.int64)
        c[np.isnan(col)] = -1
        codes[:, j] = c
    return codes


class RegressionTree:
    """Регрессионное дерево CART, обучаемое по (g, h).

    Параметры
    ---------
    max_depth : int или None
        Максимальная глубина (корень — глубина 0). ``None`` — без ограничения.
    min_samples_leaf : int
        Минимум объектов в листе.
    min_child_weight : float
        Минимальная сумма гессианов в листе (как в XGBoost).
    reg_lambda, reg_alpha : float
        L2- и L1-штрафы на веса листьев.
    gamma : float
        Минимальный выигрыш для разбиения (штраф за каждый новый лист).
    max_leaves : int или None
        Максимум листьев (для роста по листьям — как ``num_leaves`` в LightGBM).
    growth : {"depthwise", "leafwise"}
        Порядок роста: по уровням (XGBoost) или «лучший лист первым» (LightGBM).
    max_features : float, int или None
        Случайное подмножество признаков в каждом узле (как в случайном лесе).
    max_bins : int или None
        Включить гистограммный поиск разбиений.
    """

    def __init__(
        self,
        max_depth: int | None = 3,
        min_samples_leaf: int = 1,
        min_child_weight: float = 0.0,
        reg_lambda: float = 0.0,
        reg_alpha: float = 0.0,
        gamma: float = 0.0,
        max_leaves: int | None = None,
        growth: str = "depthwise",
        max_features: float | int | None = None,
        max_bins: int | None = None,
    ) -> None:
        if growth not in ("depthwise", "leafwise"):
            raise ValueError("growth должен быть 'depthwise' или 'leafwise'")
        self.max_depth = max_depth
        self.min_samples_leaf = int(min_samples_leaf)
        self.min_child_weight = float(min_child_weight)
        self.reg_lambda = float(reg_lambda)
        self.reg_alpha = float(reg_alpha)
        self.gamma = float(gamma)
        self.max_leaves = max_leaves
        self.growth = growth
        self.max_features = max_features
        self.max_bins = max_bins
        self.nodes: list[Node] = []
        self.n_features_: int = 0

    # ------------------------------------------------------------------ обучение
    def fit(self, X, g, h=None, rows=None, rng: int | Mulberry32 | None = None, bins=None,
            features=None):
        """Построить дерево.

        X : (n, d) признаки; g, h : (n,) градиенты и гессианы (h по умолчанию = 1);
        rows : индексы обучающих объектов (подвыборка), по умолчанию все;
        rng : генератор для ``max_features``; bins : готовые границы корзин;
        features : признаки, доступные этому дереву (``colsample_bytree``), по умолчанию все.
        """
        X = np.asarray(X, dtype=float)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        g = np.asarray(g, dtype=float)
        h = np.ones_like(g) if h is None else np.asarray(h, dtype=float)
        rows = np.arange(X.shape[0]) if rows is None else np.sort(np.asarray(rows, dtype=np.int64))
        self._X, self._g, self._h = X, g, h
        self._rng = as_rng(rng)
        self.n_features_ = X.shape[1]
        self._allowed = list(range(X.shape[1])) if features is None else sorted(int(f) for f in features)
        if self.max_bins:
            self.bins_ = bins if bins is not None else make_bins(X[rows], self.max_bins)
            self._codes = bin_codes(X, self.bins_)
        else:
            self.bins_ = None
            self._codes = None
            # Предварительная устойчивая сортировка по каждому признаку (один раз на дерево)
            self._order = [np.argsort(X[:, j], kind="stable") for j in range(X.shape[1])]
        self.nodes = []
        root = self._new_node(rows, depth=0)
        if self.growth == "depthwise":
            self._grow_depthwise(root)
        else:
            self._grow_leafwise(root)
        self._finalize()
        del self._X, self._g, self._h, self._codes
        if hasattr(self, "_order"):
            del self._order
        return self

    def _leaf_weight(self, G: float, H: float) -> float:
        den = H + self.reg_lambda
        if den <= 0:
            return 0.0
        return float(-_soft_threshold(G, self.reg_alpha) / den)

    def _new_node(self, rows: np.ndarray, depth: int) -> Node:
        G = seq_sum(self._g[rows])
        H = seq_sum(self._h[rows])
        node = Node(
            id=len(self.nodes), depth=depth, n=int(rows.size), G=G, H=H,
            value=self._leaf_weight(G, H), rows=rows,
        )
        self.nodes.append(node)
        return node

    def _can_split(self, node: Node) -> bool:
        if self.max_depth is not None and node.depth >= self.max_depth:
            return False
        return node.n >= 2 * self.min_samples_leaf and node.n >= 2

    def _features_for_node(self) -> list[int]:
        """Признаки для поиска разбиения в узле.

        ``max_features`` — доля признаков в (0, 1]: берётся max(1, ⌊доля·d⌋) случайных.
        Генератор вызывается только если выбираются не все признаки (контракт с JS).
        """
        base = self._allowed
        mf = self.max_features
        if mf is None:
            return base
        k = max(1, int(math.floor(float(mf) * len(base))))
        if k >= len(base):
            return base
        return sorted(base[i] for i in self._rng.sample(len(base), k))

    def _grow_depthwise(self, node: Node) -> None:
        if not self._can_split(node):
            return
        split = self._best_split(node)
        if split is None:
            return
        left, right = self._apply_split(node, split)
        self._grow_depthwise(left)
        self._grow_depthwise(right)

    def _grow_leafwise(self, root: Node) -> None:
        candidates: dict[int, Split] = {}

        def consider(nd: Node) -> None:
            if self._can_split(nd):
                sp = self._best_split(nd)
                if sp is not None:
                    candidates[nd.id] = sp

        consider(root)
        n_leaves = 1
        while candidates and (self.max_leaves is None or n_leaves < self.max_leaves):
            best_id = None
            best_gain = -math.inf
            for nid in sorted(candidates):
                if candidates[nid].gain > best_gain:
                    best_gain = candidates[nid].gain
                    best_id = nid
            split = candidates.pop(best_id)
            left, right = self._apply_split(self.nodes[best_id], split)
            n_leaves += 1
            consider(left)
            consider(right)

    def _apply_split(self, node: Node, split: Split) -> tuple[Node, Node]:
        node.feature = split.feature
        node.threshold = split.threshold
        node.gain = split.gain
        node.missing_left = split.missing_left
        left = self._new_node(split.left_rows, node.depth + 1)
        right = self._new_node(split.right_rows, node.depth + 1)
        node.left, node.right = left.id, right.id
        return left, right

    def _best_split(self, node: Node) -> Split | None:
        rows = node.rows
        lam, alpha, gamma = self.reg_lambda, self.reg_alpha, self.gamma
        msl, mcw = self.min_samples_leaf, self.min_child_weight
        G, H, n = node.G, node.H, node.n
        parent = float(_score(G, H, lam, alpha))
        best: tuple | None = None
        best_gain = 0.0  # разбиваем только при положительном выигрыше
        in_node = None
        # Маленький узел выгоднее отсортировать заново (устойчивая сортировка строк узла в порядке
        # возрастания индекса даёт ровно тот же порядок, что фильтрация глобальной сортировки).
        small = rows.size * 8 < self._X.shape[0]
        if self._codes is None and not small:
            in_node = np.zeros(self._X.shape[0], dtype=bool)
            in_node[rows] = True

        for f in self._features_for_node():
            x_all = self._X[:, f]
            if self._codes is None:
                if small:
                    sorted_rows = rows[np.argsort(x_all[rows], kind="stable")]
                else:
                    order = self._order[f]
                    sorted_rows = order[in_node[order]]
                xs_full = x_all[sorted_rows]
                nan_mask = np.isnan(xs_full)
                valid_rows = sorted_rows[~nan_mask]
                miss_rows = sorted_rows[nan_mask]
                if valid_rows.size < 2:
                    continue
                xs = x_all[valid_rows]
                GL = np.cumsum(self._g[valid_rows])[:-1]
                HL = np.cumsum(self._h[valid_rows])[:-1]
                nL = np.arange(1, valid_rows.size, dtype=float)
                ok_pos = xs[:-1] < xs[1:]
                thresholds = (xs[:-1] + xs[1:]) / 2.0
            else:
                codes = self._codes[rows, f]
                miss = codes < 0
                miss_rows = rows[miss]
                edges = self.bins_[f]
                if edges.size == 0:
                    continue
                n_bins = edges.size + 1
                cv = codes[~miss]
                vrows = rows[~miss]
                Gb = np.bincount(cv, weights=self._g[vrows], minlength=n_bins)
                Hb = np.bincount(cv, weights=self._h[vrows], minlength=n_bins)
                nb = np.bincount(cv, minlength=n_bins).astype(float)
                GL = np.cumsum(Gb)[:-1]
                HL = np.cumsum(Hb)[:-1]
                nL = np.cumsum(nb)[:-1]
                ok_pos = np.ones(edges.size, dtype=bool)
                thresholds = edges
            Gm = seq_sum(self._g[miss_rows]) if miss_rows.size else 0.0
            Hm = seq_sum(self._h[miss_rows]) if miss_rows.size else 0.0
            nm = float(miss_rows.size)

            variants = [(False, GL, HL, nL)]  # пропуски вправо
            if nm > 0:
                variants.append((True, GL + Gm, HL + Hm, nL + nm))  # пропуски влево
            gains = []
            for _, gl, hl, nl in variants:
                gr, hr, nr = G - gl, H - hl, n - nl
                gain = 0.5 * (_score(gl, hl, lam, alpha) + _score(gr, hr, lam, alpha) - parent) - gamma
                valid = ok_pos & (nl >= msl) & (nr >= msl) & (hl >= mcw) & (hr >= mcw)
                gains.append(np.where(valid, gain, -np.inf))
            # Порядок перебора: позиция 0 (вправо, влево), позиция 1 (вправо, влево), …
            stacked = np.stack(gains, axis=1).ravel()
            k = int(np.argmax(stacked))
            gbest = float(stacked[k])
            if gbest > best_gain:
                best_gain = gbest
                pos, var = divmod(k, len(variants))
                best = (f, float(thresholds[pos]), variants[var][0], miss_rows.size > 0)

        if best is None:
            return None
        f, thr, miss_left, had_missing = best
        x = self._X[rows, f]
        # И в точном, и в гистограммном режиме порог — реальное число: x ≤ thr → влево
        go_left = x <= thr
        nan = np.isnan(x)
        if had_missing:
            go_left = np.where(nan, miss_left, go_left)
        else:
            # Пропусков в обучении не было: NaN пойдут в более крупного потомка
            n_left = int(np.count_nonzero(go_left & ~nan))
            miss_left = n_left >= (rows.size - n_left)
            go_left = np.where(nan, miss_left, go_left)
        return Split(f, thr, best_gain, bool(miss_left), rows[go_left], rows[~go_left])

    def _finalize(self) -> None:
        # Индексы объектов храним только в листьях: они нужны для пересчёта значений листьев
        for nd in self.nodes:
            if not nd.is_leaf:
                nd.rows = None
        self.feature_ = np.array([nd.feature for nd in self.nodes], dtype=np.int64)
        self.threshold_ = np.array([nd.threshold for nd in self.nodes], dtype=float)
        self.left_ = np.array([nd.left for nd in self.nodes], dtype=np.int64)
        self.right_ = np.array([nd.right for nd in self.nodes], dtype=np.int64)
        self.missing_left_ = np.array([nd.missing_left for nd in self.nodes], dtype=bool)
        self.refresh_values()

    def refresh_values(self) -> None:
        """Обновить массив значений после ручного изменения ``node.value``."""
        self.value_ = np.array([nd.value for nd in self.nodes], dtype=float)

    # ---------------------------------------------------------------- применение
    def apply(self, X) -> np.ndarray:
        """Номер листа для каждого объекта."""
        X = np.asarray(X, dtype=float)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        idx = np.zeros(X.shape[0], dtype=np.int64)
        rows = np.arange(X.shape[0])
        while True:
            internal = self.left_[idx] >= 0
            if not internal.any():
                return idx
            r = rows[internal]
            node = idx[internal]
            xv = X[r, self.feature_[node]]
            go_left = np.where(np.isnan(xv), self.missing_left_[node], xv <= self.threshold_[node])
            idx[internal] = np.where(go_left, self.left_[node], self.right_[node])

    def predict(self, X) -> np.ndarray:
        """Предсказание: значение листа, в который попал объект."""
        return self.value_[self.apply(X)]

    def decision_path(self, x) -> list[int]:
        """Список узлов от корня до листа для одного объекта."""
        x = np.asarray(x, dtype=float).ravel()
        path = [0]
        nd = self.nodes[0]
        while not nd.is_leaf:
            v = x[nd.feature]
            go_left = nd.missing_left if math.isnan(v) else v <= nd.threshold
            nd = self.nodes[nd.left if go_left else nd.right]
            path.append(nd.id)
        return path

    # ------------------------------------------------------------------ свойства
    @property
    def leaves(self) -> list[Node]:
        return [nd for nd in self.nodes if nd.is_leaf]

    @property
    def n_leaves(self) -> int:
        return sum(1 for nd in self.nodes if nd.is_leaf)

    @property
    def depth(self) -> int:
        return max((nd.depth for nd in self.nodes), default=0)

    def feature_gains(self) -> np.ndarray:
        """Суммарный выигрыш разбиений по каждому признаку (важность «gain»)."""
        out = np.zeros(self.n_features_)
        for nd in self.nodes:
            if not nd.is_leaf:
                out[nd.feature] += nd.gain
        return out

    def describe(self, feature_names: list[str] | None = None, precision: int = 3) -> str:
        """Текстовое представление дерева в виде правил."""
        names = feature_names or [f"x{j}" for j in range(self.n_features_)]
        lines: list[str] = []

        def walk(nid: int, indent: str) -> None:
            nd = self.nodes[nid]
            if nd.is_leaf:
                lines.append(f"{indent}└─ лист: значение = {nd.value:.{precision}f} (n = {nd.n})")
                return
            nm = names[nd.feature]
            thr = f"{nd.threshold:.{precision}f}"
            lines.append(f"{indent}├─ если {nm} ≤ {thr}  (n = {nd.n}, выигрыш = {nd.gain:.{precision}f})")
            walk(nd.left, indent + "│   ")
            lines.append(f"{indent}├─ иначе ({nm} > {thr})")
            walk(nd.right, indent + "│   ")

        walk(0, "")
        return "\n".join(lines)

    def to_dict(self) -> dict:
        """Сериализация в словарь (совместим с форматом JS-движка)."""
        return {
            "nodes": [
                {
                    "id": nd.id, "depth": nd.depth, "n": nd.n, "G": nd.G, "H": nd.H,
                    "value": nd.value, "feature": nd.feature,
                    "threshold": None if math.isnan(nd.threshold) else nd.threshold,
                    "left": nd.left, "right": nd.right, "gain": nd.gain,
                    "missing_left": nd.missing_left,
                }
                for nd in self.nodes
            ]
        }

    def __repr__(self) -> str:
        return (
            f"RegressionTree(max_depth={self.max_depth}, n_nodes={len(self.nodes)}, "
            f"n_leaves={self.n_leaves if self.nodes else 0})"
        )
