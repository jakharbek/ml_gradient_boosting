"""Градиенты и вторые производные всех потерь бустинга: формулы против численной производной.

Запуск:  python lessons/lesson_15_6/examples/loss_gradients.py [--save] [--no-show]

Для каждой функции потерь L(y, F) печатается расхождение формул g = ∂L/∂F и h = ∂²L/∂F² с центральными
разностями, затем — сверка с учебной библиотекой gbcourse. Рисунок: L, g и h на одном листе.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.losses import get_loss
from gbcourse.style import MUTED

ex = Example(__file__)

sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731
# имя: (L(F, y), g(F, y), h(F, y), y)
LOSSES = {
    "½(y − F)², y = 3": (lambda F, y: 0.5 * (y - F) ** 2, lambda F, y: F - y, lambda F, y: np.ones_like(F), 3.0),
    "|y − F|, y = 3": (lambda F, y: np.abs(y - F), lambda F, y: np.sign(F - y), lambda F, y: np.zeros_like(F), 3.0),
    "Хьюбер δ = 1, y = 3": (lambda F, y: np.where(np.abs(y - F) <= 1, 0.5 * (y - F) ** 2, np.abs(y - F) - 0.5),
                            lambda F, y: np.clip(F - y, -1, 1), lambda F, y: (np.abs(F - y) <= 1).astype(float), 3.0),
    "квантиль α = 0.9, y = 3": (lambda F, y: np.where(y >= F, 0.9 * (y - F), 0.1 * (F - y)), lambda F, y: np.where(y > F, -0.9, 0.1),
                                lambda F, y: np.zeros_like(F), 3.0),
    "log-loss, y = 1": (lambda F, y: np.log1p(np.exp(F)) - y * F, lambda F, y: sig(F) - y, lambda F, y: sig(F) * (1 - sig(F)), 1.0),
    "Пуассон, y = 3": (lambda F, y: np.exp(F) - y * F, lambda F, y: np.exp(F) - y, lambda F, y: np.exp(F), 3.0),
    "экспоненциальная, y = +1": (lambda F, y: np.exp(-y * F), lambda F, y: -y * np.exp(-y * F), lambda F, y: y**2 * np.exp(-y * F), 1.0),
    "Гамма, y = 2": (lambda F, y: y * np.exp(-F) + F, lambda F, y: 1 - y * np.exp(-F), lambda F, y: y * np.exp(-F), 2.0),
}

pts = np.array([-0.7, 0.4, 1.3, 2.3, 4.6, 5.9])  # без точек излома (F = y, |F − y| = δ)
e = 1e-4
print("потери                      max|g − численно|   max|h − численно|")
for name, (L, g, h, y) in LOSSES.items():
    gn = (L(pts + e, y) - L(pts - e, y)) / (2 * e)
    hn = (L(pts + e, y) - 2 * L(pts, y) + L(pts - e, y)) / e**2
    eg = np.max(np.abs(gn - g(pts, y)) / np.maximum(1, np.abs(gn)))
    eh = np.max(np.abs(hn - h(pts, y)) / np.maximum(1, np.abs(hn)))
    print(f"{name:27} {eg:16.1e}   {eh:16.1e}")
    assert eg < 1e-6 and eh < 1e-4, name

# сверка с gbcourse (те же формулы внутри библиотеки)
y6 = np.array([2.0, 4.0, 3.0, 7.0, 9.0, 11.0])
F6 = np.array([0.5, 4.8, 3.6, 6.1, 8.0, 12.4])
assert np.allclose(get_loss("squared").gradient(y6, F6), F6 - y6)
assert np.allclose(get_loss("huber", delta=1.0).gradient(y6, F6), np.clip(F6 - y6, -1, 1))
assert np.allclose(get_loss("quantile", alpha=0.9).gradient(y6, F6), np.where(y6 > F6, -0.9, 0.1))
assert np.allclose(get_loss("logistic").gradient(np.ones_like(pts), pts), sig(pts) - 1)
assert np.allclose(get_loss("logistic").hessian(np.ones_like(pts), pts), sig(pts) * (1 - sig(pts)))
assert np.allclose(get_loss("poisson").gradient(np.full_like(pts, 3.0), pts), np.exp(pts) - 3)
print("gbcourse: градиенты и гессианы совпали с формулами урока")

# псевдо-остатки шести квартир при общем прогнозе 6
print("псевдо-остатки при c = 6:")
for name, r in [("MSE", y6 - 6), ("MAE", np.sign(y6 - 6)), ("Хьюбер δ=2", np.clip(y6 - 6, -2, 2)), ("квантиль 0.9", np.where(y6 > 6, 0.9, -0.1))]:
    print(f"  {name:12} {r}  среднее {r.mean():+.3f}")

Fs = np.linspace(-1.5, 6.5, 500)
fig, axes = plt.subplots(1, 3, figsize=(15, 4))
for name, (L, g, h, y) in LOSSES.items():
    gs = g(Fs, y).astype(float)
    gs[1:][np.abs(np.diff(gs)) > 0.3] = np.nan  # разрывы градиента не соединяем
    axes[0].plot(Fs, L(Fs, y), lw=2, label=name)
    axes[1].plot(Fs, gs, lw=2, label=name)
    axes[2].plot(Fs, h(Fs, y), lw=2, label=name)
axes[0].set(title="потери L(F)", xlabel="прогноз F", ylim=(0, 6))
axes[1].set(title="градиент g = ∂L/∂F; псевдо-остаток = −g", xlabel="прогноз F", ylim=(-4.5, 4.5))
axes[2].set(title="вторая производная h (гессиан XGBoost)", xlabel="прогноз F", ylim=(-0.2, 3))
for ax in axes[1:]:
    ax.axhline(0, color=MUTED, lw=1)
axes[0].legend(fontsize=7)
fig.tight_layout()
ex.finish(fig, "loss_gradients")
