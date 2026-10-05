"""Градиентный спуск с разными темпами обучения и шаг Ньютона.

Запуск:  python lessons/lesson_1_3/examples/learning_rates.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example

ex = Example(__file__)

f = lambda t: 1.5 * t**2 + np.sin(3 * t)  # noqa: E731
df = lambda t: 3 * t + 3 * np.cos(3 * t)  # noqa: E731
d2f = lambda t: 3 - 9 * np.sin(3 * t)  # noqa: E731

fig, ax = plt.subplots(figsize=(7.5, 4))
for eta in (0.02, 0.1, 0.3):
    t, hist = 2.0, []
    for _ in range(40):
        hist.append(f(t))
        t -= eta * df(t)
    ax.plot(hist, label=f"градиентный спуск, η = {eta}")
    print(f"η = {eta}: f после 40 шагов = {hist[-1]:.5f}")

t, hist = 2.0, []
for _ in range(40):
    hist.append(f(t))
    h = d2f(t)
    t = t - df(t) / h if h > 0 else t - 0.1 * df(t)
ax.plot(hist, ls="--", label="шаг Ньютона")
print(f"Ньютон:  f после 40 шагов = {hist[-1]:.5f}")

ax.set(xlabel="шаг", ylabel="f(θ)", title="Скорость спуска: темп обучения и Ньютон")
ax.legend()
ex.finish(fig, "learning_rates")
