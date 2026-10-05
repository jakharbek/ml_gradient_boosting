"""Правила остановки: как глубина и минимум объектов в листе влияют на ошибку.

Запуск:  python lessons/lesson_2_3/examples/stopping_rules.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import RegressionTree, datasets
from gbcourse.cli import Example
from gbcourse.metrics import mse

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=300, noise=0.5, seed=4)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)

fig, axes = plt.subplots(1, 2, figsize=(12, 4))
depths = range(1, 13)
axes[0].plot(list(depths), [mse(y_tr, RegressionTree(max_depth=d).fit(X_tr, -y_tr).predict(X_tr)) for d in depths], marker="o", label="обучение")
axes[0].plot(list(depths), [mse(y_te, RegressionTree(max_depth=d).fit(X_tr, -y_tr).predict(X_te)) for d in depths], marker="o", label="тест")
axes[0].set(xlabel="max_depth", ylabel="MSE", title="Глубина")
axes[0].legend()

leaves = [1, 2, 3, 5, 8, 12, 20, 30, 50]
te = [mse(y_te, RegressionTree(max_depth=None, min_samples_leaf=m).fit(X_tr, -y_tr).predict(X_te)) for m in leaves]
axes[1].plot(leaves, [mse(y_tr, RegressionTree(max_depth=None, min_samples_leaf=m).fit(X_tr, -y_tr).predict(X_tr)) for m in leaves], marker="o", label="обучение")
axes[1].plot(leaves, te, marker="o", label="тест")
axes[1].set_xscale("log")
axes[1].set(xlabel="min_samples_leaf", ylabel="MSE", title="Минимум объектов в листе (без ограничения глубины)")
axes[1].legend()
print(f"лучший min_samples_leaf по тесту: {leaves[int(np.argmin(te))]}")
fig.tight_layout()
ex.finish(fig, "stopping_rules")
