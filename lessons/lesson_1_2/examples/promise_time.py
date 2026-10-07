"""Сколько минут обещать клиенту: несимметричная цена ошибки и квантиль.

Запуск:  python lessons/lesson_1_2/examples/promise_time.py [--save] [--no-show]

60 прошлых доставок (как в виджете шага 8 урока). Минута опоздания стоит в k раз дороже
минуты запаса. Скрипт находит лучшее обещание перебором средней стоимости и сравнивает
его с эмпирической k/(k+1)-квантилью; рисует кривые штрафа для нескольких k.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import get_loss, style
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32

ex = Example(__file__)

rng = Mulberry32(7)
times = np.array([22 + 6 * np.exp(0.55 * rng.normal()) for _ in range(60)])
print(f"60 доставок: от {times.min():.1f} до {times.max():.1f} мин, медиана {np.median(times):.1f}, среднее {times.mean():.1f}\n")

grid = np.linspace(22, 40, 18001)
fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
axes[0].hist(times, bins=16, color=style.ROLE["model_prev"], edgecolor=style.SURFACE)
for k, color in zip((1, 4, 9, 19), style.SERIES):
    alpha = k / (k + 1)
    cost = np.array([np.mean(np.where(times > c, k * (times - c), c - times)) for c in grid])
    c_grid = grid[np.argmin(cost)]
    c_exact = np.sort(times)[int(np.ceil(alpha * len(times))) - 1]
    pinball = get_loss("quantile", alpha=alpha)
    # pinball-потеря — та же стоимость, делённая на (k + 1)
    same = np.allclose(cost[::500] / (k + 1), [pinball.pointwise(times, np.full_like(times, c)).mean() for c in grid[::500]])
    late = np.mean(times > c_exact)
    print(f"k = {k:2d} (α = {alpha:.3f}): перебор {c_grid:.2f} мин, квантиль {c_exact:.2f} мин, опозданий {late:.0%}, pinball ∝ стоимость: {same}")
    assert abs(c_grid - c_exact) < 0.01 and same
    axes[1].plot(grid, cost / cost.min(), color=color, label=f"k = {k}: обещать {c_exact:.1f}")
    axes[0].axvline(c_exact, color=color, lw=1.6)
axes[0].set(xlabel="время доставки, мин", ylabel="число заказов", title="Распределение и лучшие обещания")
axes[1].set(xlabel="обещанное время, мин", ylabel="штраф / минимальный штраф", ylim=(0.9, 4), title="Чем дороже опоздание, тем больше запас")
axes[1].legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "promise_time")
