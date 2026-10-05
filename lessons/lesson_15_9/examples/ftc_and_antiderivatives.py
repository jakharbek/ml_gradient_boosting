"""Основная теорема анализа и первообразные: A′(x) = f(x), семейство F + C, формула Ньютона — Лейбница.

Запуск:  python lessons/lesson_15_9/examples/ftc_and_antiderivatives.py [--save] [--no-show]

1) Функция накопления A(x) = ∫₀ˣ(t² − 1)dt: численная производная совпадает с f, минимум A — в нуле f.
2) Полоска в тисках: min f ≤ ΔA/h ≤ max f, обе границы → f(x).
3) Переменный предел: d/dx ∫₁^{x²} ln t dt = 4x·ln x.
4) Ньютон — Лейбниц против scipy.integrate.quad для пяти функций; ловушка ∫₋₁¹ dx/x².
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import math

import matplotlib.pyplot as plt
import numpy as np
from scipy import integrate

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE, RED, VIOLET

ex = Example(__file__)

# 1. Функция накопления
x = np.linspace(0, 2.5, 250001)
f = x**2 - 1
A = np.concatenate([[0], np.cumsum((f[1:] + f[:-1]) / 2 * np.diff(x))])
dA = np.gradient(A, x)
i = np.argmin(A)
print(f"1) max |A′ − f| = {np.abs(dA[5:-5] - f[5:-5]).max():.1e}; минимум A при x = {x[i]:.4f}, A = {A[i]:.6f} (−2/3)")
assert np.abs(dA[5:-5] - f[5:-5]).max() < 1e-8 and abs(x[i] - 1) < 1e-4 and abs(A[i] + 2 / 3) < 1e-8

# 2. Полоска в тисках
for h in (1, 0.1, 0.001):
    ratio = ((1 + h) ** 3 - 1) / 3 / h
    print(f"2) h = {h:<5}: 1 ≤ ΔA/h = {ratio:.6f} ≤ {(1 + h) ** 2:.6f}")
    assert 1 <= ratio <= (1 + h) ** 2

# 3. Переменный предел
G = lambda t: integrate.quad(np.log, 1, t**2)[0]  # noqa: E731
x0, e = 1.7, 1e-5
num = (G(x0 + e) - G(x0 - e)) / (2 * e)
print(f"3) d/dx ∫₁^(x²) ln t dt при x = 1.7: численно {num:.8f}, формула 4x ln x = {4 * x0 * math.log(x0):.8f}")
assert abs(num - 4 * x0 * math.log(x0)) < 1e-6

# 4. Ньютон — Лейбниц
cases = [
    ("x² на [0, 2]", lambda t: t**2, lambda t: t**3 / 3, 0, 2),
    ("sin на [0, π]", np.sin, lambda t: -np.cos(t), 0, math.pi),
    ("1/x на [1, 2]", lambda t: 1 / t, np.log, 1, 2),
    ("v(t) на [0, 10]", lambda t: 6 * t - 0.6 * t**2, lambda t: 3 * t**2 - t**3 / 5, 0, 10),
    ("x² − 2x + 3 на [−1, 2]", lambda t: t**2 - 2 * t + 3, lambda t: t**3 / 3 - t**2 + 3 * t, -1, 2),
]
for name, f_, F_, a, b in cases:
    q = integrate.quad(f_, a, b)[0]
    print(f"4) {name:24} quad {q:.10f}, F(b) − F(a) = {F_(b) - F_(a):.10f}")
    assert abs(q - (F_(b) - F_(a))) < 1e-9
print("   ловушка: «−1/x от −1 до 1» = −2, но ∫_ε¹ dx/x² = 1/ε − 1 →", [round(1 / eps - 1) for eps in (0.1, 0.01, 0.001)], "→ ∞")

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
a1.fill_between(x, 0, f, where=f < 0, color=RED, alpha=0.3)
a1.fill_between(x, 0, f, where=f >= 0, color=BLUE, alpha=0.3)
a1.plot(x, f, color="black", lw=2)
a1.plot(x, A, color=BLUE, lw=2.4, label="A(x) = ∫₀ˣ (t² − 1) dt")
a1.plot([1], [-2 / 3], "o", color=VIOLET)
a1.axhline(0, color=MUTED, lw=1)
a1.set(title="f(x) = x² − 1 и её функция накопления", xlabel="x")
a1.legend()
xx = np.linspace(-2.2, 2.2, 300)
for C in range(-4, 5):
    a2.plot(xx, xx**3 - 3 * xx + C, color=BLUE, alpha=0.35, lw=1)
a2.plot(xx, xx**3 - 3 * xx + 1, color=BLUE, lw=2.6, label="F = x³ − 3x + 1 (через (0, 1))")
a2.plot([0], [1], "o", color=ORANGE)
a2.set(title="Первообразные 3x² − 3: семейство F + C", xlabel="x", ylim=(-5, 5))
a2.legend()
ex.finish(fig, "ftc_and_antiderivatives")
