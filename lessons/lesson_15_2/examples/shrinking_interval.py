"""Средняя скорость на сжимающемся интервале подходит к мгновенной: справа, слева и по центру.

Запуск:  python lessons/lesson_15_2/examples/shrinking_interval.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, ORANGE, VIOLET

ex = Example(__file__)

s = lambda t: 3 * t**2 - t**3 / 5  # noqa: E731
v = lambda t: 6 * t - 0.6 * t**2   # noqa: E731

t0 = 2.0
print("     h      справа       слева        по центру")
for h in [1, 0.1, 0.01, 0.001]:
    right = (s(t0 + h) - s(t0)) / h
    left = (s(t0) - s(t0 - h)) / h
    center = (s(t0 + h) - s(t0 - h)) / (2 * h)
    print(f"{h:7}  {right:10.6f}  {left:10.6f}  {center:11.7f}")
    # формулы из урока: 9.6 + 1.8h − 0.2h², 9.6 − 1.8h − 0.2h², 9.6 − 0.2h²
    assert abs(right - (9.6 + 1.8 * h - 0.2 * h * h)) < 1e-8
    assert abs(left - (9.6 - 1.8 * h - 0.2 * h * h)) < 1e-8
    assert abs(center - (9.6 - 0.2 * h * h)) < 1e-8
print("спидометр v(2) =", v(t0))

tt = np.linspace(0, 10, 201)
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
a1.plot(tt, s(tt), color=BLUE, lw=2.2, label="путь s(t)")
for h, alpha in [(4, 0.35), (2, 0.6), (0.7, 0.9)]:
    k = (s(t0 + h) - s(t0)) / h
    a1.plot(tt, s(t0) + k * (tt - t0), color=AQUA, alpha=alpha, label=f"h = {h}: {k:.2f} м/с")
a1.plot(tt, s(t0) + v(t0) * (tt - t0), "--", color=ORANGE, label="касательная: 9.6 м/с")
a1.set(ylim=(-5, 110), xlabel="t, с", ylabel="s, м", title="Секущие на интервалах [2, 2 + h]")
a1.legend(fontsize=8)
hs = np.logspace(-3, 0.3, 80)
a2.semilogx(hs, (s(t0 + hs) - s(t0)) / hs, color=AQUA, lw=2.2, label="справа")
a2.semilogx(hs, (s(t0) - s(t0 - hs)) / hs, color=VIOLET, lw=2.2, label="слева")
a2.semilogx(hs, (s(t0 + hs) - s(t0 - hs)) / (2 * hs), color=BLUE, lw=2.2, label="по центру")
a2.axhline(v(t0), color=ORANGE, ls="--", label="спидометр 9.6")
a2.invert_xaxis()
a2.set(xlabel="h, с", ylabel="средняя скорость, м/с", title="При h → 0 все три → 9.6 м/с")
a2.legend(fontsize=8)
ex.finish(fig, "shrinking_interval")
