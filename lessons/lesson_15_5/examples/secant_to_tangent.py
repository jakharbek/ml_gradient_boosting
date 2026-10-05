"""Определение производной: разностные отношения сходятся, секущая превращается в касательную.

Запуск:  python lessons/lesson_15_5/examples/secant_to_tangent.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, ORANGE, VIOLET

ex = Example(__file__)


def quotient(f, a, h):
    """Разностное отношение (f(a + h) − f(a)) / h."""
    return (f(a + h) - f(a)) / h


# 1. Таблица определения: с обеих сторон к одному числу
cases = [("x², a = 3", lambda x: x**2, 3, 6.0), ("√x, a = 4", np.sqrt, 4, 0.25),
         ("1/x, a = 1", lambda x: 1 / x, 1, -1.0), ("eˣ, a = 0", np.exp, 0, 1.0), ("sin x, a = 0", np.sin, 0, 1.0)]
for name, f, a, d in cases:
    left = [quotient(f, a, -h) for h in (0.1, 0.01, 0.001)]
    right = [quotient(f, a, h) for h in (0.1, 0.01, 0.001)]
    print(f"{name:13} слева {np.round(left, 6)}  справа {np.round(right, 6)}  → f′(a) = {d}")
    assert abs(left[-1] - d) < 2e-3 and abs(right[-1] - d) < 2e-3

# 2. |x| в нуле: односторонние пределы различны
assert quotient(np.abs, 0, 1e-6) == 1 and quotient(np.abs, 0, -1e-6) == -1
print("|x| в нуле: справа +1, слева −1 — производной нет")

# 3. Секущие к f(x) = x³/3 − x в точке 0.5 и сходимость их наклонов
f = lambda x: x**3 / 3 - x  # noqa: E731
a, d = 0.5, -0.75
hs = 2 * 10 ** (-3 * np.arange(61) / 60)
fwd = quotient(f, a, hs)
cen = (f(a + hs) - f(a - hs)) / (2 * hs)
for h in (1.0, 0.1, 0.01, 0.001):
    print(f"h = {h:<6} вправо {quotient(f, a, h): .6f}   центральная {(f(a + h) - f(a - h)) / (2 * h): .7f}")
assert abs(quotient(f, a, 1e-3) - d) < 1e-3
assert abs((f(a + 1e-3) - f(a - 1e-3)) / 2e-3 - d) < 1e-6

grid = np.linspace(-2.6, 2.6, 400)
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
a1.plot(grid, f(grid), color=BLUE, lw=2.2, label="f(x) = x³/3 − x")
for h, alpha in [(1.5, 0.35), (0.8, 0.6), (0.3, 0.9)]:
    a1.plot(grid, f(a) + quotient(f, a, h) * (grid - a), color=AQUA, alpha=alpha, lw=1.6, label=f"секущая, h = {h}")
a1.plot(grid, f(a) + d * (grid - a), "--", color=ORANGE, lw=2, label="касательная")
a1.set(ylim=(-2.5, 2.5), xlabel="x", ylabel="f(x)", title="Секущие поворачиваются к касательной")
a1.legend(fontsize=8)
a2.semilogx(hs, fwd, color=AQUA, lw=2, label="вправо")
a2.semilogx(hs, cen, color=VIOLET, lw=2, label="центральная")
a2.axhline(d, color=ORANGE, ls="--", label="f′(0.5) = −0.75")
a2.invert_xaxis()
a2.set(xlabel="h", ylabel="наклон секущей", title="При h → 0 наклон → f′(a)")
a2.legend()
ex.finish(fig, "secant_to_tangent")
