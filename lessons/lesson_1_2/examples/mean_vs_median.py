"""Среднее против медианы: как выброс сдвигает лучшую константу.

Запуск:  python lessons/lesson_1_2/examples/mean_vs_median.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import get_loss
from gbcourse.cli import Example

ex = Example(__file__)

y = np.array([2.1, 2.9, 3.3, 3.8, 4.1, 4.4, 4.9, 5.6, 6.2])
outliers = np.linspace(6, 100, 60)
means, medians, hubers = [], [], []
huber = get_loss("huber", delta=1.0)
for o in outliers:
    yy = np.append(y, o)
    means.append(yy.mean())
    medians.append(np.median(yy))
    # оптимум Хьюбера — численно
    cs = np.linspace(0, 20, 4001)
    hubers.append(cs[np.argmin([huber.pointwise(yy, np.full_like(yy, c)).sum() for c in cs])])

print(f"выброс 100: среднее = {means[-1]:.2f}, медиана = {medians[-1]:.2f}, Хьюбер = {hubers[-1]:.2f}")
assert medians[-1] == medians[0], "медиана не зависит от величины выброса"

fig, ax = plt.subplots(figsize=(7.5, 3.8))
ax.plot(outliers, means, label="среднее (L2)")
ax.plot(outliers, medians, label="медиана (L1)")
ax.plot(outliers, hubers, label="оптимум Хьюбера, δ = 1")
ax.set(xlabel="значение выброса", ylabel="лучшая константа", title="Одна точка-выброс и лучшие константы")
ax.legend()
ex.finish(fig, "mean_vs_median")
