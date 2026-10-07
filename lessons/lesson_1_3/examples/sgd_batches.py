"""Стохастический спуск: мини-пакеты разного размера на одной прямой.

Запуск:  python lessons/lesson_1_3/examples/sgd_batches.py [--save] [--no-show]

Шаг 13 урока. Прямая ŷ = a·z + b для 30 точек (стандартизованный признак), темп 0.1, 60 шагов. Пакеты
выбирает Mulberry32 — тот же генератор, что в виджете sgd-line, поэтому числа совпадают с браузером.
Чем меньше пакет, тем дешевле шаг и тем сильнее шум у минимума.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets, style
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32

ex = Example(__file__)

X, y = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)
z = (X[:, 0] - X[:, 0].mean()) / X[:, 0].std()
a_opt, b_opt = np.mean(z * (y - y.mean())), y.mean()


def half_mse(a: float, b: float) -> float:
    """½·MSE прямой a·z + b на всех 30 точках."""
    return float(np.mean((y - a * z - b) ** 2) / 2)


def sgd(batch: int, eta: float = 0.1, steps: int = 60, seed: int = 1) -> tuple[np.ndarray, np.ndarray]:
    """Путь (a, b) и ½·MSE по шагам для спуска по мини-пакетам размера batch."""
    rng = Mulberry32(seed)
    a = b = 0.0
    path, hist = [(a, b)], [half_mse(a, b)]
    for _ in range(steps):
        idx = rng.sample(len(y), batch) if batch < len(y) else list(range(len(y)))
        res = y[idx] - (a * z[idx] + b)
        a, b = a + eta * np.mean(res * z[idx]), b + eta * np.mean(res)
        path.append((a, b))
        hist.append(half_mse(a, b))
    return np.array(path), np.array(hist)


opt = half_mse(a_opt, b_opt)
print(f"минимум: a = {a_opt:.4f}, b = {b_opt:.4f}, ½·MSE = {opt:.4f}")
spread = {}
fig, axes = plt.subplots(1, 2, figsize=(11, 4))
for B, color in ((1, style.ORANGE), (5, style.AQUA), (30, style.BLUE)):
    path, hist = sgd(B)
    tail = hist[-20:]
    spread[B] = tail.max() - tail.min()
    print(f"B = {B:2d}: после 60 шагов ½·MSE = {hist[-1]:.4f}; последние 20 шагов {tail.min():.4f}–{tail.max():.4f}; "
          f"просмотрено точек {60 * B}")
    axes[0].plot(path[:, 0], path[:, 1], color=color, lw=1.4, label=f"B = {B}")
    axes[1].semilogy(hist, color=color, label=f"B = {B}")

assert spread[1] > spread[5] > spread[30], "шум у минимума убывает с размером пакета"
assert abs(sgd(1)[1][-1] - 0.2547) < 1e-4, "число из текста урока (шаг 13)"
assert sgd(30)[1][-1] - opt < 1e-3, "полный спуск почти дошёл до минимума"

ga, gb = np.meshgrid(np.linspace(-0.6, 2.6, 160), np.linspace(-0.4, 4.4, 200))
levels = np.mean((y[None, None, :] - ga[..., None] * z - gb[..., None]) ** 2, axis=-1) / 2
axes[0].contour(ga, gb, levels, levels=[0.25, 0.3, 0.45, 0.7, 1.2, 2, 3.5, 6], colors=style.MUTED, linewidths=0.8)
axes[0].scatter([a_opt], [b_opt], color=style.INK, zorder=5, label="минимум")
axes[0].set(xlabel="наклон a", ylabel="сдвиг b", aspect="equal", title="Путь спуска по мини-пакетам")
axes[0].legend(fontsize=8)
axes[1].axhline(opt, color=style.MUTED, ls=(0, (4, 3)), label="минимум")
axes[1].set(xlabel="шаг k", ylabel="½·MSE на всех точках", title="Дёшево, но шумно")
axes[1].set_yticks([0.25, 0.5, 1, 2, 4, 8], labels=["0.25", "0.5", "1", "2", "4", "8"])
axes[1].minorticks_off()
axes[1].legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "sgd_batches")
