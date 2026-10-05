"""Бэггинг против бустинга: ошибка на новых данных в зависимости от числа моделей.

Запуск:  python lessons/lesson_3/examples/bagging_vs_boosting.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt

from gbcourse import BaggingTrees, GBRegressor, datasets
from gbcourse.cli import Example
from gbcourse.metrics import mse

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=80, noise=0.4, seed=21)
X_te, y_te = datasets.regression_1d(kind="wave", n=2000, noise=0.4, seed=22)
Bs = [1, 2, 5, 10, 20, 50, 100, 200, 300]
bag = BaggingTrees(n_estimators=300, max_depth=None, seed=1).fit(X, y)
fig, ax = plt.subplots(figsize=(7.5, 4))
ax.plot(Bs, [mse(y_te, bag.predict(X_te, n_trees=B)) for B in Bs], marker="o", label="бэггинг, глубокие деревья")
for depth in (1, 3):
    gb = GBRegressor(n_estimators=300, learning_rate=0.1, max_depth=depth).fit(X, y)
    curve = [mse(y_te, gb.predict(X_te, n_iter=B)) for B in Bs]
    ax.plot(Bs, curve, marker="o", label=f"бустинг, глубина {depth}")
    print(f"бустинг глубины {depth}: MSE при B=300 = {curve[-1]:.4f}")
print(f"бэггинг: MSE при B=300 = {mse(y_te, bag.predict(X_te)):.4f}; шум σ² = 0.16")
ax.axhline(0.16, color="#898781", ls=(0, (4, 3)), lw=1, label="шум σ²")
ax.set_xscale("log")
ax.set(xlabel="число моделей", ylabel="MSE на новых данных", title="Две стратегии ансамблей")
ax.legend()
ex.finish(fig, "bagging_vs_boosting")
