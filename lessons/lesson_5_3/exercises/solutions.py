"""Решения упражнений урока 5.3.

Запуск:  python lessons/lesson_5_3/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets

# 1
X, y = datasets.regression_1d(kind="hetero", n=400, noise=0.5, seed=54)
X_te, y_te = datasets.regression_1d(kind="hetero", n=3000, noise=0.5, seed=55)
for depth in (2, 5):
    lo_m = GBRegressor(loss="quantile", quantile_alpha=0.1, n_estimators=1000, learning_rate=0.1, max_depth=depth).fit(X, y)
    hi_m = GBRegressor(loss="quantile", quantile_alpha=0.9, n_estimators=1000, learning_rate=0.1, max_depth=depth).fit(X, y)
    row = []
    for M in (10, 30, 100, 300, 1000):
        lo, hi = lo_m.predict(X_te, n_iter=M), hi_m.predict(X_te, n_iter=M)
        lo, hi = np.minimum(lo, hi), np.maximum(lo, hi)
        row.append(f"{M}: {np.mean((y_te >= lo) & (y_te <= hi)):.3f}")
    print(f"1) глубина {depth}: " + ", ".join(row))
print("   Чем сложнее модель, тем сильнее покрытие на новых данных уходит ниже целевых 0.8.")

# 2
rng = np.random.default_rng(3)
x = np.sort(rng.uniform(0, 10, 600))
yt = np.sin(x) + rng.standard_t(2, size=x.size)
Xt = x.reshape(-1, 1)
grid = np.linspace(0, 10, 500).reshape(-1, 1)
for loss in ("squared", "absolute", "huber"):
    m = GBRegressor(loss=loss, huber_delta=1.0, n_estimators=200, learning_rate=0.1, max_depth=2).fit(Xt, yt)
    print(f"2) {loss:9s}: MAE до sin x = {np.mean(np.abs(np.sin(grid[:, 0]) - m.predict(grid))):.3f}")
