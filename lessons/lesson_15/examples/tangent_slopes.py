"""Касательные и их наклоны: знак производной на подъёмах и спусках.

Запуск:  python lessons/lesson_15/examples/tangent_slopes.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, ORANGE

ex = Example(__file__)

f = lambda t: np.sin(1.3 * t) + 0.15 * t**2    # noqa: E731
df = lambda t: 1.3 * np.cos(1.3 * t) + 0.3 * t  # noqa: E731

x = np.linspace(-4, 4, 400)
fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(x, f(x), color=BLUE, lw=2.2, label="f(θ)")
for t0 in (-3.0, -1.0, 0.6, 2.6):
    numeric = (f(t0 + 1e-5) - f(t0 - 1e-5)) / 2e-5
    trend = "растёт" if df(t0) > 0 else "убывает"
    print(f"θ = {t0:+.1f}: f′ = {df(t0):+.4f} (численно {numeric:+.4f}) — функция {trend}")
    assert abs(numeric - df(t0)) < 1e-8
    seg = np.array([t0 - 0.8, t0 + 0.8])
    ax.plot(seg, f(t0) + df(t0) * (seg - t0), color=ORANGE, lw=2.2)
    ax.plot([t0], [f(t0)], "o", color=ORANGE)
ax.set(xlabel="θ", ylabel="f(θ)", ylim=(-1.5, 3.5), title="Касательные и их наклоны")
ex.finish(fig, "tangent_slopes")
