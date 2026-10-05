"""Симметричные (oblivious) деревья CatBoost своими руками и бустинг на них.

На каждом уровне все узлы делятся по ОДНОМУ и тому же условию x_f ≤ t: оно выбирается по сумме
выигрышей во всех узлах уровня. Лист определяется d битами — номер листа = двоичное число.

Запуск:  python lessons/lesson_9_3/examples/oblivious_trees.py [--save] [--no-show]
Импорт:  from oblivious_trees import ObliviousTree, boost_oblivious
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np


class ObliviousTree:
    """Симметричное дерево глубины ``depth`` по градиентам g и гессианам h (второй порядок, штраф λ)."""

    def __init__(self, depth: int = 4, reg_lambda: float = 1.0, max_bins: int = 64) -> None:
        self.depth = depth
        self.reg_lambda = reg_lambda
        self.max_bins = max_bins

    def fit(self, X, g, h=None):
        X = np.asarray(X, dtype=float)
        g = np.asarray(g, dtype=float)
        h = np.ones_like(g) if h is None else np.asarray(h, dtype=float)
        n, d = X.shape
        lam = self.reg_lambda
        # Кандидаты-пороги: квантили каждого признака
        cands = []
        for j in range(d):
            qs = np.unique(np.quantile(X[:, j], np.linspace(0, 1, self.max_bins + 1)[1:-1]))
            cands.append(qs)
        leaf = np.zeros(n, dtype=np.int64)
        self.splits_ = []
        for level in range(self.depth):
            n_leaves = 2**level
            best = (-np.inf, None, None)
            for j in range(d):
                for t in cands[j]:
                    right = X[:, j] > t
                    idx = leaf * 2 + right
                    G = np.bincount(idx, g, 2 * n_leaves)
                    H = np.bincount(idx, h, 2 * n_leaves)
                    score = np.sum(G**2 / (H + lam))
                    if score > best[0]:
                        best = (score, j, t)
            _, j, t = best
            self.splits_.append((j, t))
            leaf = leaf * 2 + (X[:, j] > t)
        G = np.bincount(leaf, g, 2**self.depth)
        H = np.bincount(leaf, h, 2**self.depth)
        self.values_ = -G / (H + lam)
        return self

    def leaf_index(self, X):
        X = np.asarray(X, dtype=float)
        idx = np.zeros(len(X), dtype=np.int64)
        for j, t in self.splits_:  # номер листа — d бит: сравнения не зависят друг от друга
            idx = idx * 2 + (X[:, j] > t)
        return idx

    def predict(self, X):
        return self.values_[self.leaf_index(X)]


def boost_oblivious(X, y, X_val=None, y_val=None, n_estimators=300, learning_rate=0.1, depth=4, reg_lambda=1.0):
    """Бустинг на симметричных деревьях (квадратичная потеря). Возвращает (деревья, F0, история ½MSE на валидации)."""
    F0 = float(np.mean(y))
    F = np.full(len(y), F0)
    Fv = None if X_val is None else np.full(len(y_val), F0)
    trees, hist = [], []
    for _ in range(n_estimators):
        t = ObliviousTree(depth=depth, reg_lambda=reg_lambda).fit(X, F - y)
        F += learning_rate * t.predict(X)
        trees.append(t)
        if Fv is not None:
            Fv += learning_rate * t.predict(X_val)
            hist.append(0.5 * np.mean((y_val - Fv) ** 2))
    return trees, F0, hist


if __name__ == "__main__":
    import matplotlib.pyplot as plt

    from gbcourse import GBRegressor, datasets
    from gbcourse.cli import Example
    from gbcourse.style import ROLE

    ex = Example(__file__)
    X, y = datasets.friedman1(n=1500, noise=1.0, seed=99)
    X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)
    fig, ax = plt.subplots(figsize=(8, 3.8))
    for depth, ls in ((3, "-"), (5, "--")):
        _, _, h_obl = boost_oblivious(X_tr, y_tr, X_val, y_val, n_estimators=300, depth=depth)
        m = GBRegressor(mode="newton", n_estimators=300, learning_rate=0.1, max_depth=depth, reg_lambda=1.0, max_bins=64)
        h_std = m.fit(X_tr, y_tr, eval_set=(X_val, y_val)).history_["eval"][1:]
        ax.plot(h_obl, color=ROLE["tree"], ls=ls, label=f"симметричные, глубина {depth}: мин. {min(h_obl):.3f}")
        ax.plot(h_std, color=ROLE["model"], ls=ls, label=f"обычные, глубина {depth}: мин. {min(h_std):.3f}")
        print(f"глубина {depth}: симметричные {min(h_obl):.3f}, обычные {min(h_std):.3f} (лучшая ½MSE на валидации)")
    ax.set(yscale="log", xlabel="число деревьев", ylabel="½MSE на валидации", title="Бустинг на симметричных и обычных деревьях")
    ax.legend(fontsize=8)
    fig.tight_layout()
    ex.finish(fig, "oblivious_trees")
