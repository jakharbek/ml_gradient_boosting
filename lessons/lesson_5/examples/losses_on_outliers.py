"""Бустинг с разными функциями потерь на данных с выбросами.

Запуск:  python lessons/lesson_5/examples/losses_on_outliers.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example
from gbcourse.plotting import plot_data, plot_truth

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=300, noise=0.3, seed=51, outliers=0.08)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
clean = datasets.true_function("wave", X_te[:, 0])
grid = np.linspace(0, 10, 400).reshape(-1, 1)
fig, ax = plt.subplots(figsize=(9, 4.4))
plot_data(ax, X_tr, y_tr, s=12)
plot_truth(ax, "wave")
maes = {}
for loss in ("squared", "absolute", "huber"):
    m = GBRegressor(loss=loss, huber_delta=1.0, n_estimators=300, learning_rate=0.1, max_depth=2).fit(X_tr, y_tr)
    maes[loss] = np.mean(np.abs(clean - m.predict(X_te)))
    ax.plot(grid, m.predict(grid), lw=2, label=f"{loss}: MAE до истины {maes[loss]:.3f}")
    print(f"{loss:9s}: {maes[loss]:.3f}")
assert maes["absolute"] < maes["squared"] and maes["huber"] < maes["squared"]
ax.set(ylim=(-2, 6), title="Выбросы тянут L2, но не L1 и Хьюбера")
ax.legend()
ex.finish(fig, "losses_on_outliers")
