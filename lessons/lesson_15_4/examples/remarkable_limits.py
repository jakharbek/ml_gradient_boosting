"""Замечательные пределы: sin x / x → 1 и его семейство, (1 + a/n)ⁿ → eᵃ и форма 1^∞.

Сжатие cos x ≤ sin x / x ≤ 1, пределы tan x / x, (1 − cos x)/x², sin(x°)/x; второй замечательный предел,
рецепт lim uᵛ = e^(lim v(u − 1)) и следствия (eˣ − 1)/x, ln(1 + x)/x, (aˣ − 1)/x.

Запуск:  python lessons/lesson_15_4/examples/remarkable_limits.py [--save] [--no-show]
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, ORANGE, RED, VIOLET

ex = Example(__file__)

for x in (0.5, 0.1, 0.01):
    s = np.sin(x) / x
    print(f"x = {x:<5}: cos x = {np.cos(x):.6f} ≤ sin x / x = {s:.6f} ≤ 1")
    assert np.cos(x) <= s <= 1

family = {"tan x / x → 1": (lambda x: np.tan(x) / x, 1.0), "(1 − cos x)/x² → 1/2": (lambda x: 2 * np.sin(x / 2) ** 2 / x**2, 0.5),
          "sin 3x / x → 3": (lambda x: np.sin(3 * x) / x, 3.0), "sin(x°)/x → π/180": (lambda x: np.sin(np.radians(x)) / x, math.pi / 180)}
for name, (f, L) in family.items():
    print(f"{name:22} x = 0.01: {f(0.01):.7f}  (предел {L:.7f})")
    assert abs(f(1e-4) - L) < 1e-6

for n in (1, 12, 365, 10**6):
    print(f"(1 + 1/{n})^{n} = {(1 + 1 / n) ** n:.6f}")
assert abs((1 + 1e-6) ** 1e6 - np.e) < 1e-5
for name, u, v, L in [("(1 + 2/n)ⁿ", lambda n: 1 + 2 / n, lambda n: n, math.e**2), ("(1 − 1/n)ⁿ", lambda n: 1 - 1 / n, lambda n: n, 1 / math.e),
                      ("((n + 1)/(n − 1))ⁿ", lambda n: (n + 1) / (n - 1), lambda n: n, math.e**2)]:
    n = 10**5
    print(f"{name:20}: v(u − 1) = {v(n) * (u(n) - 1):.5f}, uᵛ = {u(n) ** v(n):.5f}, предел {L:.5f}")
    assert abs(u(n) ** v(n) - L) < 1e-3 * L
for x in (0.01, 0.001):
    print(f"x = {x}: (eˣ − 1)/x = {np.expm1(x) / x:.6f}, ln(1 + x)/x = {np.log1p(x) / x:.6f}, (2ˣ − 1)/x = {(2**x - 1) / x:.6f} (ln 2 = {math.log(2):.6f})")
assert abs((2**1e-7 - 1) / 1e-7 - math.log(2)) < 1e-6

fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(15, 4))
x = np.linspace(-1.4, 1.4, 281)
x = x[x != 0]
a1.plot(x, np.ones_like(x), color=ORANGE, lw=2, label="1")
a1.plot(x, np.sin(x) / x, color=BLUE, lw=2.4, label="sin x / x")
a1.plot(x, np.cos(x), color=AQUA, lw=2, label="cos x")
a1.plot([0], [1], "o", mfc="white", mec=BLUE, ms=8)
a1.set(title="cos x ≤ sin x / x ≤ 1", xlabel="x, радиан")
a1.legend()
x = np.linspace(-1.2, 1.2, 241)
x = x[x != 0]
for (name, (f, L)), c in zip(list(family.items())[:3], (BLUE, ORANGE, VIOLET)):
    a2.plot(x, f(x), color=c, lw=2.2, label=name)
    a2.plot([0], [L], "o", mfc="white", mec=c, ms=7)
a2.set(title="семейство синуса", xlabel="x", ylim=(0, 3.3))
a2.legend(fontsize=8)
n = np.arange(2, 61)
for (lab, y, L), c in zip([("(1 + 1/n)ⁿ → e", (1 + 1 / n) ** n, math.e), ("(1 + 2/n)ⁿ → e²", (1 + 2 / n) ** n, math.e**2), ("(1 − 1/n)ⁿ → 1/e", (1 - 1 / n) ** n, 1 / math.e)], (BLUE, RED, AQUA)):
    a3.plot(n, y, "o", color=c, ms=3.5, label=lab)
    a3.axhline(L, color=c, ls="--", lw=1)
a3.set(title="второй замечательный предел и 1^∞", xlabel="n")
a3.legend(fontsize=8)
plt.tight_layout()
ex.finish(fig, "remarkable_limits")
