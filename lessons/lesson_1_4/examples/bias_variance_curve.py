"""Кривая «смещение–разброс» для деревьев решений разной глубины.

Запуск:  python lessons/lesson_1_4/examples/bias_variance_curve.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import RegressionTree, datasets
from gbcourse.cli import Example

ex = Example(__file__)

grid = np.linspace(0, 10, 200).reshape(-1, 1)
truth = np.sin(grid[:, 0])
noise = 0.35
depths = list(range(0, 11))
b2s, vs = [], []
samples = [datasets.regression_1d("sine", n=30, noise=noise, seed=s) for s in range(1, 51)]
for d in depths:
    # g = −y, h = 1 → в листьях средние y
    preds = np.array([RegressionTree(max_depth=d).fit(X, -y).predict(grid) for X, y in samples])
    b2s.append(np.mean((preds.mean(0) - truth) ** 2))
    vs.append(np.mean(preds.var(0)))
    print(f"глубина {d:2d}: смещение² {b2s[-1]:.4f}  разброс {vs[-1]:.4f}  сумма+шум {b2s[-1] + vs[-1] + noise**2:.4f}")

total = np.array(b2s) + np.array(vs) + noise**2
best = depths[int(np.argmin(total))]
print(f"Оптимальная глубина: {best}")
assert b2s[0] > b2s[-1] and vs[0] < vs[-1]

fig, ax = plt.subplots(figsize=(7.5, 4))
ax.plot(depths, b2s, marker="o", label="смещение²")
ax.plot(depths, vs, marker="o", label="разброс")
ax.plot(depths, total, marker="o", lw=2.6, label="ожидаемая ошибка")
ax.axhline(noise**2, color="#898781", lw=1, ls=(0, (4, 3)), label="шум σ²")
ax.set(xlabel="глубина дерева", ylabel="ошибка", title="Разложение ошибки: 50 обучающих выборок")
ax.legend()
ex.finish(fig, "bias_variance_curve")
