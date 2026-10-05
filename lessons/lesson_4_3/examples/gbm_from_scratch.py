"""Градиентный бустинг с нуля: дерево + бустинг на numpy (~80 строк) и сверка с scikit-learn.

Запуск:  python lessons/lesson_4_3/examples/gbm_from_scratch.py [--save] [--no-show]

Модуль можно и импортировать: from gbm_from_scratch import Tree, GradientBoosting
"""

import sys
from pathlib import Path

import numpy as np


def best_split(X, y, min_leaf=1):
    """Лучшее разбиение узла по сумме квадратов: (признак, порог, выигрыш) или None."""
    n, d = X.shape
    if n < 2:
        return None
    S = y.sum()
    best = None
    for j in range(d):
        order = np.argsort(X[:, j], kind="stable")
        xs, ys = X[order, j], y[order]
        SL = np.cumsum(ys)[:-1]
        nL = np.arange(1, n)
        gain = SL**2 / nL + (S - SL) ** 2 / (n - nL) - S**2 / n
        gain[(xs[:-1] == xs[1:]) | (nL < min_leaf) | (n - nL < min_leaf)] = -np.inf
        k = int(np.argmax(gain))
        if gain[k] > 0 and (best is None or gain[k] > best[2]):
            best = (j, (xs[k] + xs[k + 1]) / 2, gain[k])
    return best


class Tree:
    """Регрессионное дерево (CART, критерий — сумма квадратов) в плоских массивах."""

    def __init__(self, max_depth=3, min_leaf=1):
        self.max_depth, self.min_leaf = max_depth, min_leaf

    def fit(self, X, y):
        self.feature, self.threshold, self.left, self.right, self.value = [], [], [], [], []
        self._grow(X, y, 0)
        for name in ("feature", "threshold", "left", "right", "value"):
            setattr(self, name, np.array(getattr(self, name)))
        return self

    def _grow(self, X, y, depth):
        node = len(self.value)
        self.feature.append(-1)
        self.threshold.append(0.0)
        self.left.append(-1)
        self.right.append(-1)
        self.value.append(y.mean())
        if depth < self.max_depth and len(y) >= 2 * self.min_leaf:
            split = best_split(X, y, self.min_leaf)
            if split is not None:
                j, t, _ = split
                mask = X[:, j] <= t
                self.feature[node], self.threshold[node] = j, t
                self.left[node] = self._grow(X[mask], y[mask], depth + 1)
                self.right[node] = self._grow(X[~mask], y[~mask], depth + 1)
        return node

    def predict(self, X):
        idx = np.zeros(len(X), dtype=int)
        while True:
            internal = self.left[idx] >= 0
            if not internal.any():
                return self.value[idx]
            rows = np.flatnonzero(internal)
            node = idx[rows]
            go_left = X[rows, self.feature[node]] <= self.threshold[node]
            idx[rows] = np.where(go_left, self.left[node], self.right[node])


class GradientBoosting:
    """Бустинг с квадратичными потерями: F0 = среднее, деревья на остатках, шаг ν."""

    def __init__(self, n_estimators=100, learning_rate=0.1, max_depth=3, min_leaf=1):
        self.M, self.nu, self.max_depth, self.min_leaf = n_estimators, learning_rate, max_depth, min_leaf

    def fit(self, X, y):
        self.f0 = y.mean()
        F = np.full(len(y), self.f0)
        self.trees = []
        for _ in range(self.M):
            tree = Tree(self.max_depth, self.min_leaf).fit(X, y - F)
            F += self.nu * tree.predict(X)
            self.trees.append(tree)
        return self

    def predict(self, X, n_trees=None):
        F = np.full(len(X), self.f0)
        for tree in self.trees[:n_trees]:
            F += self.nu * tree.predict(X)
        return F


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))
    import matplotlib.pyplot as plt
    from sklearn.ensemble import GradientBoostingRegressor

    from gbcourse import datasets
    from gbcourse.cli import Example

    ex = Example(__file__)
    X, y = datasets.friedman1(n=500, noise=1.0, seed=43)
    X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)
    ours = GradientBoosting(n_estimators=200, learning_rate=0.1, max_depth=3).fit(X_tr, y_tr)
    sk = GradientBoostingRegressor(n_estimators=200, learning_rate=0.1, max_depth=3).fit(X_tr, y_tr)
    diff = np.abs(ours.predict(X_tr) - sk.predict(X_tr)).max()
    print(f"расхождение с sklearn на обучении: {diff:.2e}")
    assert diff < 1e-8
    # На новых точках возможны отличия: в маленьких узлах несколько признаков делят обучающие объекты
    # одинаково (ничья по выигрышу), и реализации разрешают ничью по-разному.
    print(f"расхождение на валидации (из-за ничьих): {np.abs(ours.predict(X_val) - sk.predict(X_val)).max():.3f}; "
          f"MSE: наша {np.mean((y_val - ours.predict(X_val)) ** 2):.3f}, sklearn {np.mean((y_val - sk.predict(X_val)) ** 2):.3f}")
    curve = [np.mean((y_val - ours.predict(X_val, m)) ** 2) for m in range(0, 201, 5)]
    fig, ax = plt.subplots(figsize=(7, 3.6))
    ax.plot(range(0, 201, 5), curve, marker="o", ms=3)
    ax.set(xlabel="число деревьев", ylabel="MSE на валидации", title="Бустинг с нуля на задаче Фридмана")
    ex.finish(fig, "gbm_from_scratch")
