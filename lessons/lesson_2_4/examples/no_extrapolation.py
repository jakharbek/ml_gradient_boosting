"""Деревья и бустинг не экстраполируют: прогноз за пределами данных — константа.

Запуск:  python lessons/lesson_2_4/examples/no_extrapolation.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example
from gbcourse.plotting import plot_data

ex = Example(__file__)

X, y = datasets.regression_1d(kind="linear", n=60, noise=0.3, seed=8, x_max=6.0)
grid = np.linspace(0, 10, 400).reshape(-1, 1)
gb = GBRegressor(n_estimators=300, learning_rate=0.1, max_depth=2).fit(X, y)

# Приём: моделировать остаток от линейного тренда
a, b = np.polyfit(X[:, 0], y, 1)
gb_resid = GBRegressor(n_estimators=300, learning_rate=0.1, max_depth=2).fit(X, y - (a * X[:, 0] + b))
pred_combo = a * grid[:, 0] + b + gb_resid.predict(grid)

far = gb.predict(np.array([[6.0], [10.0]]))
print(f"бустинг: прогноз при x=6 {far[0]:.3f}, при x=10 {far[1]:.3f} — одинаков")
assert abs(far[0] - far[1]) < 1e-9

fig, ax = plt.subplots(figsize=(8, 3.8))
ax.axvspan(6, 10, color="#898781", alpha=0.1)
plot_data(ax, X, y)
ax.plot(grid, gb.predict(grid), color="#2a78d6", label="бустинг по y")
ax.plot(grid, pred_combo, color="#1baf7a", label="тренд + бустинг по остаткам")
ax.set(title="Экстраполяция: константа против тренда", xlabel="x", ylabel="y")
ax.legend()
ex.finish(fig, "no_extrapolation")
