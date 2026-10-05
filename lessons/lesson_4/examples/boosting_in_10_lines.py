"""Градиентный бустинг в 10 строк и сверка с scikit-learn.

Запуск:  python lessons/lesson_4/examples/boosting_in_10_lines.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.tree import DecisionTreeRegressor

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.plotting import plot_data, plot_truth

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=100, noise=0.35, seed=42)
grid = np.linspace(0, 10, 400).reshape(-1, 1)
nu, M = 0.1, 150
F, F_grid = np.full_like(y, y.mean()), np.full(len(grid), y.mean())
snapshots = {}
for m in range(1, M + 1):
    h = DecisionTreeRegressor(max_depth=2).fit(X, y - F)
    F += nu * h.predict(X)
    F_grid += nu * h.predict(grid)
    if m in (1, 10, 50, 150):
        snapshots[m] = F_grid.copy()

sk = GradientBoostingRegressor(n_estimators=M, learning_rate=nu, max_depth=2).fit(X, y)
diff = np.abs(F - sk.predict(X)).max()
print(f"расхождение с sklearn: {diff:.2e}")
assert diff < 1e-10

fig, ax = plt.subplots(figsize=(8, 4))
plot_data(ax, X, y)
plot_truth(ax, "wave")
for i, (m, Fg) in enumerate(snapshots.items()):
    ax.plot(grid, Fg, lw=1.2 + 0.5 * i, label=f"M = {m}")
ax.set(title="Бустинг на остатках: модель после M деревьев", xlabel="x", ylabel="y")
ax.legend()
ex.finish(fig, "boosting_in_10_lines")
