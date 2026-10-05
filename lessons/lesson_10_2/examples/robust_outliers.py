"""Выбросы в y: квадратичная потеря, Хьюбер и L1 при разном минимальном размере листа.

Задача Фридмана (800 объектов), у 2% обучающих объектов к y прибавлено ±100, 1000 деревьев, ν = 0.05, глубина 3.
MSE считается на чистом тесте.

Запуск:  python lessons/lesson_10_2/examples/robust_outliers.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example
from gbcourse.style import ROLE

ex = Example(__file__)
X, y = datasets.friedman1(n=800, noise=1.0, seed=130)
a, b, c, d = datasets.train_test_split(X, y, test_size=0.3, seed=0)
r = np.random.default_rng(0)
idx = r.choice(len(c), size=len(c) * 2 // 100, replace=False)
c = c.copy()
c[idx] += r.choice([-1, 1], size=len(idx)) * 100

res = {}
for loss, extra in (("squared", {}), ("huber", {"huber_delta": 1.0}), ("absolute", {})):
    for msl in (1, 20):
        m = GBRegressor(loss=loss, n_estimators=1000, learning_rate=0.05, max_depth=3, min_samples_leaf=msl, **extra).fit(a, c)
        res[(loss, msl)] = float(np.mean((d - m.predict(b)) ** 2))
        print(f"{loss:9s} лист ≥ {msl:2d}: MSE на тесте {res[(loss, msl)]:.3f}")
assert res[("huber", 20)] < res[("huber", 1)] and res[("absolute", 20)] < res[("squared", 20)]

fig, ax = plt.subplots(figsize=(8, 3.6))
labels = ["квадратичная", "Хьюбер", "L1"]
x = np.arange(3)
for k, (msl, color) in enumerate(((1, ROLE["valid"]), (20, ROLE["model"]))):
    ax.bar(x + (k - 0.5) * 0.38, [res[(l_, msl)] for l_ in ("squared", "huber", "absolute")], width=0.36, color=color, label=f"лист ≥ {msl}")
ax.set(xticks=x, xticklabels=labels, yscale="log", ylabel="MSE на чистом тесте", title="Устойчивая потеря работает только вместе с минимумом объектов в листе")
ax.legend()
fig.tight_layout()
ex.finish(fig, "robust_outliers")
