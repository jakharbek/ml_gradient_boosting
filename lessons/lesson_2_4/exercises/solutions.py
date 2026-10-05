"""Решения упражнений урока 2.4.

Запуск:  python lessons/lesson_2_4/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, Mulberry32, RegressionTree, datasets

# 1
X, y = datasets.regression_1d(kind="linear", n=60, noise=0.3, seed=8, x_max=6.0)
Xf = np.linspace(7, 10, 50).reshape(-1, 1)
truth = 0.5 * Xf[:, 0] + 1
gb = GBRegressor(n_estimators=300, learning_rate=0.1, max_depth=2).fit(X, y)
a, b = np.polyfit(X[:, 0], y, 1)
gbr = GBRegressor(n_estimators=300, learning_rate=0.1, max_depth=2).fit(X, y - (a * X[:, 0] + b))
combo = a * Xf[:, 0] + b + gbr.predict(Xf)
print(f"1) MSE на [7, 10]: бустинг {np.mean((truth - gb.predict(Xf)) ** 2):.3f}, тренд + бустинг {np.mean((truth - combo) ** 2):.3f}")

# 2
X, y = datasets.regression_1d("sine", n=40, noise=0.3, seed=12)
rng = Mulberry32(0)
roots = []
for _ in range(50):
    idx = np.array(rng.bootstrap(len(y)))
    counts = np.bincount(idx, minlength=len(y)).astype(float)
    rows = np.flatnonzero(counts)
    t = RegressionTree(max_depth=3).fit(X, -counts * y, counts, rows=rows)
    roots.append(round(t.nodes[0].threshold / 0.05) * 0.05)
uniq = sorted({round(float(r), 2) for r in roots})
print(f"2) различных корневых порогов: {len(uniq)} на 50 выборок: {uniq}")

# 3
Xr = datasets.friedman1(n=1500, noise=0.0, seed=5, n_features=5)[0][:, :3] * 2 - 1
yr = Xr[:, 0] * Xr[:, 1] * Xr[:, 2]
Xtr, Xte, ytr, yte = datasets.train_test_split(Xr, yr, test_size=0.3, seed=0)
for d in (1, 2, 3):
    m = GBRegressor(n_estimators=400, learning_rate=0.1, max_depth=d).fit(Xtr, ytr)
    print(f"3) глубина {d}: MSE {np.mean((yte - m.predict(Xte)) ** 2):.5f} (дисперсия цели {yte.var():.5f})")
