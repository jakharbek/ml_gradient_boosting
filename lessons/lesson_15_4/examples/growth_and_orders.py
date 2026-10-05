"""Сравнение скоростей: порядок бесконечно малых и иерархия роста ln x ≪ xᵃ ≪ qˣ ≪ x!.

Порядок малости измеряется наклоном на двойной логарифмической шкале; ловушка эквивалентностей в разностях;
огромные числа сравниваются через их логарифмы; точки обгона x⁵ = eˣ, x¹⁰⁰ = 1.01ˣ, ln x = x^0.1.

Запуск:  python lessons/lesson_15_4/examples/growth_and_orders.py [--save] [--no-show]
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import optimize

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MAGENTA, MUTED, ORANGE, VIOLET

ex = Example(__file__)

orders = {"sin x": (np.sin, 1), "1 − cos x": (lambda x: 2 * np.sin(x / 2) ** 2, 2), "x − sin x": (lambda x: x - np.sin(x), 3),
          "tan x − sin x": (lambda x: np.tan(x) * 2 * np.sin(x / 2) ** 2, 3), "√x": (np.sqrt, 0.5)}
print("Порядок = наклон между x = 0.001 и x = 0.01 на двойной логарифмической шкале:")
for name, (f, k) in orders.items():
    s = (np.log(f(0.01)) - np.log(f(0.001))) / np.log(10)
    print(f"  {name:14}: наклон {s:.4f} (порядок {k})")
    assert abs(s - k) < 0.01

trap = lambda x: (np.tan(x) - np.sin(x)) / x**3  # noqa: E731
print("Ловушка: (tan x − sin x)/x³ =", ", ".join(f"{trap(t):.6f}" for t in (0.1, 0.01, 0.001)), "→ 1/2, а «наивная» замена даёт 0")
assert abs(trap(1e-3) - 0.5) < 1e-5

cross = {
    "x⁵ = eˣ": [optimize.brentq(lambda t: 5 * math.log(t) - t, 1.01, 2), optimize.brentq(lambda t: 5 * math.log(t) - t, 5, 20)],
    "x¹⁰⁰ = 1.01ˣ": [math.exp(optimize.brentq(lambda s: 100 * s - math.exp(s) * math.log(1.01), 5, 20))],
    "ln x = x^0.1": [math.exp(optimize.brentq(lambda s: math.log(s) - 0.1 * s, 1.01, 2)), math.exp(optimize.brentq(lambda s: math.log(s) - 0.1 * s, 10, 100))],
}
for name, xs in cross.items():
    print(f"  {name:13}: пересечения при x ≈ {', '.join(f'{v:.4g}' for v in xs)}")
assert 12.7 < cross["x⁵ = eˣ"][1] < 12.72 and 117000 < cross["x¹⁰⁰ = 1.01ˣ"][0] < 117500 and 3.4e15 < cross["ln x = x^0.1"][1] < 3.5e15
for x in (10, 100, 1000):
    print(f"  x = {x:>4}: lg x⁵ = {5 * math.log10(x):6.2f}, lg eˣ = {x / math.log(10):7.2f}, lg x! = {math.lgamma(x + 1) / math.log(10):8.2f}, lg xˣ = {x * math.log10(x):7.0f}")

fig, (a1, a2) = plt.subplots(1, 2, figsize=(13.5, 4.4))
x = np.logspace(-3, 0, 200)
for (name, (f, _)), c in zip(orders.items(), (BLUE, ORANGE, AQUA, VIOLET, MAGENTA)):
    a1.loglog(x, f(x), color=c, lw=2.2, label=name)
a1.set(title="порядок малости = наклон", xlabel="x")
a1.legend(fontsize=8)
x = np.linspace(1, 60, 400)
for lab, lg, c in [("ln x", np.log10(np.log(x + 1e-12) + 1e-300), AQUA), ("x²", 2 * np.log10(x), VIOLET), ("x⁵", 5 * np.log10(x), MAGENTA),
                   ("eˣ", x / np.log(10), ORANGE), ("x!", np.array([math.lgamma(t + 1) for t in x]) / np.log(10), BLUE)]:
    a2.plot(x, lg, color=c, lw=2.2, label=lab)
a2.axvline(cross["x⁵ = eˣ"][1], color=MUTED, ls=":")
a2.set(title="иерархия роста (по вертикали — lg значения)", xlabel="x", ylim=(-1, 80))
a2.legend(fontsize=8)
plt.tight_layout()
ex.finish(fig, "growth_and_orders")
