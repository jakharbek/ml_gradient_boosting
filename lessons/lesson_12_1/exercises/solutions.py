"""Решения упражнений урока 12.1.

Запуск:  python lessons/lesson_12_1/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.explain import permutation_importance

mse = lambda a, b: float(np.mean((a - b) ** 2))
params = dict(n_estimators=300, learning_rate=0.1, max_depth=4)
X, y = datasets.friedman1(n=2000, noise=1.0, seed=181, n_features=5)


def experiment(j, sigma, label):
    r = np.random.default_rng(0)
    Xa = np.c_[X, X[:, j] + r.normal(0, sigma, len(y))]
    X_tr, X_te, y_tr, y_te = datasets.train_test_split(Xa, y, test_size=0.3, seed=0)
    m = GBRegressor(**params).fit(X_tr, y_tr)
    base = mse(y_te, m.predict(X_te))
    perm, _ = permutation_importance(m.predict, X_te, y_te, mse, n_repeats=5, seed=0)
    drop = lambda cols: mse(y_te, GBRegressor(**params).fit(np.delete(X_tr, cols, 1), y_tr).predict(np.delete(X_te, cols, 1))) - base
    g = m.feature_importances_
    print(f"{label}: gain x{j} {g[j]:.3f}, копия {g[5]:.3f}; перестановка x{j} {perm[j]:.2f}, копия {perm[5]:.2f}; "
          f"удаление x{j} {drop([j]):+.3f}, копии {drop([5]):+.3f}, обоих {drop([j, 5]):+.3f}")


experiment(0, 0.02, "1) копия x0, σ = 0.02")
experiment(3, 0.02, "2) копия x3, σ = 0.02")
experiment(3, 0.2, "   копия x3, σ = 0.2 ")
print("   Чем точнее копия, тем свободнее модель делит между ними важность и тем дешевле удаление одного.")
print("   Неточная копия хуже заменяет оригинал: важность уходит к оригиналу, а его удаление становится дорогим.")
