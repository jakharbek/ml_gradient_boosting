"""Решения упражнений урока 4.3.

Запуск:  python lessons/lesson_4_3/exercises/solutions.py
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[3] / "shared" / "python"))
sys.path.insert(0, str(HERE.parents[1] / "examples"))

import numpy as np

from gbcourse import datasets
from gbm_from_scratch import Tree


class GradientBoostingPlus:
    """Бустинг с подвыборкой (упр. 1) и ранней остановкой (упр. 2)."""

    def __init__(self, n_estimators=300, learning_rate=0.1, max_depth=3, subsample=1.0, seed=0):
        self.M, self.nu, self.depth, self.subsample = n_estimators, learning_rate, max_depth, subsample
        self.rng = np.random.default_rng(seed)

    def fit(self, X, y, eval_set=None, patience=None):
        self.f0 = y.mean()
        F = np.full(len(y), self.f0)
        self.trees, best, best_m = [], np.inf, 0
        if eval_set is not None:
            Xv, yv = eval_set
            Fv = np.full(len(yv), self.f0)
        for m in range(self.M):
            k = max(1, int(self.subsample * len(y)))
            rows = np.sort(self.rng.choice(len(y), size=k, replace=False))
            tree = Tree(self.depth).fit(X[rows], (y - F)[rows])
            F += self.nu * tree.predict(X)
            self.trees.append(tree)
            if eval_set is not None:
                Fv += self.nu * tree.predict(Xv)
                loss = np.mean((yv - Fv) ** 2)
                if loss < best:
                    best, best_m = loss, m + 1
                elif patience and m + 1 - best_m >= patience:
                    break
        if eval_set is not None and patience:
            self.trees = self.trees[:best_m]
        self.best_loss = best
        return self

    def predict(self, X):
        return self.f0 + self.nu * sum((t.predict(X) for t in self.trees), np.zeros(len(X)))


X, y = datasets.friedman1(n=500, noise=1.0, seed=43)
X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)

# 1
for ss in (1.0, 0.5):
    m = GradientBoostingPlus(n_estimators=300, subsample=ss).fit(X_tr, y_tr, eval_set=(X_val, y_val))
    print(f"1) subsample = {ss}: лучшая MSE на валидации {m.best_loss:.3f}")

# 2
m = GradientBoostingPlus(n_estimators=2000, learning_rate=0.1).fit(X_tr, y_tr, eval_set=(X_val, y_val), patience=30)
print(f"2) ранняя остановка: оставлено {len(m.trees)} деревьев, MSE {np.mean((y_val - m.predict(X_val)) ** 2):.3f}")

# 3
print("3) Идея: order_j = argsort(X[:, j]) один раз; в узле sorted_rows = order_j[in_node[order_j]].")
print("   Так сделано в gbcourse.tree.RegressionTree (см. self._order); для маленьких узлов быстрее отсортировать заново.")
