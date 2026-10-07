"""Сжатие значения листа: смещение ради меньшего разброса.

Запуск:  python lessons/lesson_1_4/examples/shrinkage.py [--save] [--no-show]

В лист дерева попало n объектов, их остатки = μ + шум σ (шаг 3 урока). Значение листа — среднее
остатков, сжатое к нулю: c·r̄, c = n / (n + λ). Скрипт сравнивает точные формулы смещения², разброса
и ошибки с симуляцией на 20 000 листьях и проверяет, что минимум ошибки — при λ* = σ²/μ² и что
сжатая оценка точнее несмещённой.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import style
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32

ex = Example(__file__)

mu, sigma = 1.0, 2.0
lams = np.linspace(0, 30, 301)

fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
for n, color in zip((2, 4, 16), style.SERIES):
    c = n / (n + lams)
    err = ((1 - c) * mu) ** 2 + c**2 * sigma**2 / n
    best = sigma**2 / mu**2
    c_best = n / (n + best)
    err_best = ((1 - c_best) * mu) ** 2 + c_best**2 * sigma**2 / n
    rng = Mulberry32(n)
    means = np.array([np.mean([mu + sigma * rng.normal() for _ in range(n)]) for _ in range(20000)])
    sim0 = np.mean((means - mu) ** 2)
    sim_best = np.mean((c_best * means - mu) ** 2)
    print(f"n = {n:2d}: без сжатия {sigma**2 / n:.3f} (симуляция {sim0:.3f});  λ* = {best:.0f}, c* = {c_best:.2f}: "
          f"{err_best:.3f} (симуляция {sim_best:.3f}), выигрыш {1 - err_best / (sigma**2 / n):.0%}")
    assert abs(lams[np.argmin(err)] - best) < 0.1
    assert sim_best < sim0 and abs(sim_best - err_best) < 0.03
    axes[0].plot(lams, err, color=color, label=f"n = {n}")
    axes[0].scatter([best], [err_best], color=color, zorder=3)

n = 4
c = n / (n + lams)
axes[1].plot(lams, ((1 - c) * mu) ** 2, color=style.BLUE, label="смещение²")
axes[1].plot(lams, c**2 * sigma**2 / n, color=style.ORANGE, label="разброс")
axes[1].plot(lams, ((1 - c) * mu) ** 2 + c**2 * sigma**2 / n, color=style.AQUA, lw=2.4, label="ошибка")
axes[0].set(xlabel="сжатие λ", ylabel="ошибка значения листа", title="Минимум всегда при λ* = σ²/μ² = 4")
axes[1].set(xlabel="сжатие λ", title="n = 4: смещение² + разброс")
for ax in axes:
    ax.legend()
fig.tight_layout()
ex.finish(fig, "shrinkage")
