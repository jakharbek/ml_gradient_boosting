"""Решения упражнений урока 12.3.

Запуск:  python lessons/lesson_12_3/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.explain import partial_dependence

# 1
X, y = datasets.friedman1(n=600, noise=1.0, seed=180, n_features=7)
model = GBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1).fit(X, y)
grid = np.linspace(0, 1, 11)
for name, mask in (("x1 < 0.3", X[:, 1] < 0.3), ("x1 > 0.7", X[:, 1] > 0.7)):
    _, pdv = partial_dependence(model.predict, X[mask], 0, grid=grid)
    print(f"1) PDP x0 при {name}: {np.round(pdv - pdv[0], 2)} (размах {pdv.max() - pdv.min():.2f})")
print("   При большом x1 произведение x0·x1 проходит почти весь синус — x0 влияет сильно; при малом — слабее.")
print("   Общий PDP — среднее этих разных эффектов, а ICE показывают их по отдельности.")

# 2
g = lambda x0: np.log1p(3 * x0) - 1.2 * np.exp(-(((x0 - 0.7) / 0.08) ** 2))
truth = lambda Z: g(Z[:, 0]) + 0.5 * np.sin(2 * np.pi * Z[:, 1])
X_test = np.random.default_rng(99).uniform(0, 1, (5000, 2))
for n in (20, 50, 100, 200):
    res = {}
    for kind, mc in (("без", [0, 0]), ("с", [1, 0])):
        errs = []
        for s in range(10):
            r = np.random.default_rng(s)
            Z = r.uniform(0, 1, (n, 2))
            yz = truth(Z) + r.normal(0, 0.5, n)
            m = lgb.LGBMRegressor(n_estimators=200, learning_rate=0.05, num_leaves=8, min_child_samples=5,
                                  monotone_constraints=mc, verbose=-1).fit(Z, yz)
            errs.append(np.sqrt(np.mean((truth(X_test) - m.predict(X_test)) ** 2)))
        res[kind] = np.mean(errs)
    print(f"2) n = {n:3d}: RMSE без ограничения {res['без']:.3f}, с ограничением {res['с']:.3f}"
          f"{'  ← ограничение вредит' if res['с'] > res['без'] else ''}")
