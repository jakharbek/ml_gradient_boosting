"""Случайный лес: OOB-оценка и влияние max_features на качество.

Запуск:  python lessons/lesson_3_1/examples/random_forest_oob.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import BaggingTrees, datasets
from gbcourse.cli import Example
from gbcourse.metrics import mse

ex = Example(__file__)

X, y = datasets.friedman1(n=300, noise=1.0, seed=31)
X_te, y_te = datasets.friedman1(n=1000, noise=1.0, seed=32)
mfs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0]
oob_mse, test_mse = [], []
for mf in mfs:
    rf = BaggingTrees(n_estimators=50, max_depth=None, max_features=mf, seed=1).fit(X, y)
    oob = rf.oob_predict(X)
    ok = ~np.isnan(oob)
    oob_mse.append(mse(y[ok], oob[ok]))
    test_mse.append(mse(y_te, rf.predict(X_te)))
    print(f"max_features {mf:.1f}: OOB {oob_mse[-1]:.3f}, тест {test_mse[-1]:.3f}")

fig, ax = plt.subplots(figsize=(7.5, 3.8))
ax.plot(mfs, oob_mse, marker="o", label="OOB")
ax.plot(mfs, test_mse, marker="o", label="тест")
ax.set(xlabel="max_features", ylabel="MSE", title="Случайный лес на задаче Фридмана")
ax.legend()
ex.finish(fig, "random_forest_oob")
