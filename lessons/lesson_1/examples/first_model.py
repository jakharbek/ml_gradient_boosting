"""Первая модель: градиентный бустинг в scikit-learn и в gbcourse совпадают.

Запуск:  python lessons/lesson_1/examples/first_model.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example
from gbcourse.plotting import plot_stages

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=60, noise=0.35, seed=7)
params = dict(n_estimators=60, learning_rate=0.3, max_depth=2)

sk = GradientBoostingRegressor(**params).fit(X, y)
ours = GBRegressor(**params).fit(X, y)

diff = np.abs(sk.predict(X) - ours.predict(X)).max()
print(f"F0 (среднее y)            = {ours.init_:.6f}")
print(f"MSE на обучении (sklearn)  = {np.mean((y - sk.predict(X)) ** 2):.6f}")
print(f"MSE на обучении (gbcourse) = {np.mean((y - ours.predict(X)) ** 2):.6f}")
print(f"Максимальное расхождение   = {diff:.2e}")
assert diff < 1e-10, "реализации должны совпадать"

fig = plot_stages(ours, X, y, stages=(1, 3, 10, 60), truth_kind="wave")
ex.finish(fig, "first_model_stages")
plt.close("all")
