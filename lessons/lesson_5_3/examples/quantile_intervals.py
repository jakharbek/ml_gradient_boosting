"""Предсказательные интервалы квантильным бустингом и проверка их покрытия.

Запуск:  python lessons/lesson_5_3/examples/quantile_intervals.py [--save] [--no-show]
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

X, y = datasets.regression_1d(kind="hetero", n=400, noise=0.5, seed=54)
X_te, y_te = datasets.regression_1d(kind="hetero", n=3000, noise=0.5, seed=55)
grid = np.linspace(0, 10, 300).reshape(-1, 1)
q = {a: GBRegressor(loss="quantile", quantile_alpha=a, n_estimators=200, learning_rate=0.1, max_depth=2).fit(X, y)
     for a in (0.05, 0.5, 0.95)}
lo, hi = np.minimum(q[0.05].predict(X_te), q[0.95].predict(X_te)), np.maximum(q[0.05].predict(X_te), q[0.95].predict(X_te))
coverage = np.mean((y_te >= lo) & (y_te <= hi))
print(f"покрытие интервала 5–95% на новых данных: {coverage:.3f} (цель 0.90)")
assert 0.8 < coverage < 0.97

fig, ax = plt.subplots(figsize=(8, 4))
plot_data(ax, X, y, s=8)
ax.fill_between(grid[:, 0], q[0.05].predict(grid), q[0.95].predict(grid), alpha=0.18, color="#2a78d6", label="5–95%")
ax.plot(grid, q[0.5].predict(grid), color="#eb6834", label="медиана")
ax.set(title=f"Интервал расширяется вместе с шумом (покрытие {coverage:.1%})", xlabel="x", ylabel="y")
ax.legend()
ex.finish(fig, "quantile_intervals")
