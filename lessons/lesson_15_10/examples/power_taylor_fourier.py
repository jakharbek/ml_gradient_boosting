"""Степенные ряды, ряды Тейлора и Фурье: радиус сходимости, Мэчин, сокращение, особые точки, Гиббс, Парсеваль.

Запуск:  python lessons/lesson_15_10/examples/power_taylor_fourier.py [--save] [--no-show]

1) Радиус сходимости: ln(1 + x) = x − x²/2 + … сходится при |x| < 1 и расходится при x = 1.5.
2) π по Мэчину: 5 членов — ошибка 3·10⁻⁸; ряд Лейбница за 1000 членов — 3.1406.
3) Катастрофическое сокращение: e⁻²⁰ рядом даёт 6.1·10⁻⁹ вместо 2.06·10⁻⁹; 1/e²⁰ — точно.
4) Радиус = расстояние до особой точки: для ln(1 + e^F) в точке F₀ это √(F₀² + π²); c₁ = σ, 2c₂ = σ(1 − σ).
5) Фурье: максимум суммы для меандра → 1.179 (Гиббс); Парсеваль для пилы даёт Σ 1/k² = π²/6.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)


# 1. Радиус сходимости
def ln1p_series(x, n):
    return sum((-1) ** (k + 1) * x**k / k for k in range(1, n + 1))


for x in (0.5, 0.9, 1.5):
    print(f"ln(1 + {x}) = {math.log1p(x):.5f}; ряд из 10 и 40 членов: {ln1p_series(x, 10):.5f}, {ln1p_series(x, 40):.4g}")
assert abs(ln1p_series(0.5, 40) - math.log1p(0.5)) < 1e-12 and abs(ln1p_series(1.5, 40)) > 1e4


# 2. π по Мэчину
def atan_series(x, n):
    return sum((-1) ** k * x ** (2 * k + 1) / (2 * k + 1) for k in range(n))


for n in (2, 5, 8):
    pm = 16 * atan_series(1 / 5, n) - 4 * atan_series(1 / 239, n)
    print(f"Мэчин, {n} членов: {pm:.13f} (ошибка {abs(pm - math.pi):.1e})")
print("Лейбниц, 1000 членов:", 4 * atan_series(1, 1000))
assert abs(16 * atan_series(1 / 5, 5) - 4 * atan_series(1 / 239, 5) - math.pi) < 5e-8


# 3. Катастрофическое сокращение
def exp_series(x, n=200):
    s, term = 0.0, 1.0
    for k in range(1, n):
        s += term
        term *= x / k
    return s


bad, good = exp_series(-20), 1 / exp_series(20)
print(f"e^-20: ряд {bad:.4e}, 1/ряд(20) {good:.4e}, точно {math.exp(-20):.4e}; наибольший член {20**20 / math.factorial(20):.2e}")
assert abs(good / math.exp(-20) - 1) < 1e-12 and abs(bad / math.exp(-20) - 1) > 1


# 4. Особые точки и логистические потери
def softplus(z):
    return np.where(z.real <= 0, np.log1p(np.exp(z)), z + np.log1p(np.exp(-z)))


def taylor_coefs(f, a, r, K, N=512):
    th = 2 * np.pi * np.arange(N) / N
    return (np.fft.fft(f(a + r * np.exp(1j * th))) / N).real[: K + 1] / r ** np.arange(K + 1)


for F0 in (0.0, 2.0):
    R = math.hypot(F0, math.pi)
    c = taylor_coefs(softplus, F0, 0.92 * R, 40)
    sig = 1 / (1 + math.exp(-F0))
    inside = sum(ck * (0.5 * R) ** k for k, ck in enumerate(c))
    outside = sum(ck * (1.2 * R) ** k for k, ck in enumerate(c))
    print(f"F0 = {F0}: R = {R:.4f}; c1 = {c[1]:.6f} = σ, 2c2 = {2 * c[2]:.6f} = σ(1 − σ) = {sig * (1 - sig):.6f}; "
          f"внутри {inside:.5f} vs {np.logaddexp(0, F0 + 0.5 * R):.5f}, снаружи {outside:.4g}")
    assert abs(c[1] - sig) < 1e-9 and abs(2 * c[2] - sig * (1 - sig)) < 1e-9

# 5. Фурье: Гиббс и Парсеваль
x = np.linspace(-np.pi, np.pi, 8001)


def square(N):
    return 4 / np.pi * sum(np.sin((2 * k + 1) * x) / (2 * k + 1) for k in range(N))


maxima = [float(square(N).max()) for N in (1, 3, 10, 50)]
print("максимум суммы меандра при N = 1, 3, 10, 50:", [round(m, 4) for m in maxima])
assert abs(maxima[-1] - 1.179) < 1e-3
print("Парсеваль для пилы: (1/π)∫x² =", 2 * np.pi**2 / 3, "; Σ 4/k² =", sum(4 / k**2 for k in range(1, 10**6)))

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
xs = np.linspace(-1.6, 1.6, 400)
a1.plot(xs, np.where(xs > -1, np.log1p(np.maximum(xs, -0.999)), np.nan), color=BLUE, lw=2.5, label="ln(1 + x)")
for n, c in ((3, MUTED), (8, VIOLET), (20, ORANGE)):
    a1.plot(xs, [ln1p_series(t, n) for t in xs], "--", color=c, lw=1.6, label=f"{n} членов")
a1.axvspan(-1, 1, color="green", alpha=0.08)
a1.set(ylim=(-3, 2), title="Ряд Тейлора работает только при |x| < 1", xlabel="x")
a1.legend()
for N, c in ((1, MUTED), (5, VIOLET), (50, BLUE)):
    a2.plot(x, square(N), color=c, lw=1.6, label=f"N = {N}")
a2.plot(x, np.sign(x), "--", color="black", lw=1)
a2.axhline(1.179, color=ORANGE, ls=":", lw=1)
a2.set(title="Явление Гиббса: перелёт ≈ 9 % у скачка", xlabel="x")
a2.legend()
ex.finish(fig, "power_taylor_fourier")
