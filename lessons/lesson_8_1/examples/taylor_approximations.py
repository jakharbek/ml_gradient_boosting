"""Потери одного объекта и их приближения первого и второго порядка для четырёх функций потерь.

Запуск:  python lessons/lesson_8_1/examples/taylor_approximations.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.losses import get_loss
from gbcourse.style import ROLE

ex = Example(__file__)

cases = [("squared", 1.0, -1.0, "Квадратичная: парабола точна"), ("logistic", 1.0, -1.0, "Логистическая, y = 1"),
         ("poisson", 3.0, 0.3, "Пуассон, y = 3"), ("huber", 0.0, 1.8, "Хьюбер: снаружи δ h = 0")]
w = np.linspace(-3, 3, 301)
fig, axes = plt.subplots(1, 4, figsize=(15, 3.6))
for ax, (name, y0, F0, title) in zip(axes, cases):
    loss = get_loss(name)
    y, F = np.array([y0]), np.array([F0])
    L0, g, h = loss.pointwise(y, F)[0], loss.gradient(y, F)[0], loss.hessian(y, F)[0]
    exact = loss.pointwise(np.full_like(w, y0), F0 + w)
    ax.plot(w, exact, color=ROLE["model"], lw=2.4, label="точные")
    ax.plot(w, L0 + g * w, color=ROLE["truth"], ls="--", lw=1.4, label="1-й порядок")
    ax.plot(w, L0 + g * w + 0.5 * h * w * w, color=ROLE["tree"], lw=1.8, label="2-й порядок")
    if h > 0:
        ax.axvline(-g / h, color=ROLE["tree"], ls=":", lw=1)
    ax.set(ylim=(exact.min() - 0.3, exact.max() + 0.3), xlabel="шаг w", title=title)
    print(f"{name:9s}: g = {g:+.4f}, h = {h:.4f}, шаг Ньютона = {(-g / h) if h > 0 else float('nan'):+.4f}")
axes[0].legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "taylor_approximations")
