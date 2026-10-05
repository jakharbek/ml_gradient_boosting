"""Ряд Тейлора: многочлены, порядок ошибки Δⁿ⁺¹ и радиус сходимости.

Запуск:  python lessons/lesson_15_7/examples/taylor_polynomials.py [--save] [--no-show]

Слева — многочлены Тейлора ln(1 + x) около нуля: внутри радиуса 1 они сходятся к функции, за ним
разлетаются. В центре — ошибка многочленов eˣ на двойной логарифмической шкале: прямые с наклоном n + 1.
Справа — 1/(1 + x²): гладкая функция, но её ряд около нуля сходится только при |x| < 1.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, SERIES, VIOLET

ex = Example(__file__)


def taylor(coef, d):
    return sum(c * d**k for k, c in enumerate(coef))


# 1. Наклоны ошибки: eˣ, sin x, log-loss
COEF = {
    "eˣ": (np.exp, [1 / math.factorial(k) for k in range(6)]),
    "sin x": (np.sin, [0, 1, 0, -1 / 6, 0, 1 / 120]),
    "log-loss": (lambda z: np.log1p(np.exp(-z)), [math.log(2), -0.5, 1 / 8, 0, -1 / 192, 0]),
}
expected = {"eˣ": [1, 2, 3, 4, 5], "sin x": [1, 3, 3, 5, 5], "log-loss": [1, 2, 4, 4, 6]}
for name, (f, c) in COEF.items():
    slopes = [math.log2(abs(f(0.1) - taylor(c[: n + 1], 0.1)) / abs(f(0.05) - taylor(c[: n + 1], 0.05))) for n in range(5)]
    print(f"{name:9} наклоны ошибки при n = 0..4: {np.round(slopes, 2)}  (ожидаем {expected[name]})")
    assert np.allclose(slopes, expected[name], atol=0.1)

# 2. Сколько членов нужно для e с точностью 1e-6
s, n = 0.0, 0
while abs(math.e - s) >= 1e-6:
    s += 1 / math.factorial(n)
    n += 1
print(f"e с ошибкой < 1e-6: {n} членов (до 1/{n - 1}!), ошибка {math.e - s:.1e}, оценка 3/{n}! = {3 / math.factorial(n):.1e}")
assert n == 10

# 3. Медленный и быстрый ряды для ln 2
slow = sum((-1) ** k / (k + 1) for k in range(1000))
fast = sum(2 * (1 / 3) ** (2 * k + 1) / (2 * k + 1) for k in range(6))
print(f"ln 2: 1000 членов медленного ряда — ошибка {abs(slow - math.log(2)):.1e}; 6 членов быстрого — {abs(fast - math.log(2)):.1e}")
assert abs(fast - math.log(2)) < abs(slow - math.log(2)) / 1000

# 4. Радиус сходимости 1/(1 + x²)
for xv in (0.5, 1.2):
    vals = [sum((-1) ** m * xv ** (2 * m) for m in range(N // 2 + 1)) for N in (10, 20, 40)]
    print(f"1/(1 + x²) при x = {xv}: точно {1 / (1 + xv * xv):.6f}, многочлены 10/20/40: {np.round(vals, 4)}")
assert abs(sum((-1) ** m * 0.5 ** (2 * m) for m in range(21)) - 0.8) < 1e-9

fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(16.5, 4.4))
x = np.linspace(-0.95, 2.2, 500)
a1.plot(x, np.log1p(x), color=BLUE, lw=2.8, label="ln(1 + x)")
for i, n in enumerate([1, 2, 4, 8, 16]):
    c = [0] + [(-1) ** (k - 1) / k for k in range(1, n + 1)]
    a1.plot(x, taylor(c, x), "--", color=SERIES[(i + 1) % len(SERIES)], lw=1.4, label=f"n = {n}")
a1.axvspan(-1, 1, color=AQUA, alpha=0.08)
a1.set(title="ln(1 + x): сходимость только при |x| < 1", xlabel="x", ylim=(-3, 2))
a1.legend(fontsize=8)
ds = np.logspace(-2, 0, 60)
f, c = COEF["eˣ"]
for n in range(5):
    a2.loglog(ds, np.abs(f(ds) - taylor(c[: n + 1], ds)), color=SERIES[n], label=f"n = {n}: наклон {n + 1}")
a2.set(title="eˣ: ошибка ∝ Δⁿ⁺¹", xlabel="Δ", ylabel="ошибка")
a2.legend(fontsize=8)
x = np.linspace(-1.6, 1.6, 500)
a3.plot(x, 1 / (1 + x**2), color=BLUE, lw=2.8, label="1/(1 + x²)")
for i, N in enumerate([4, 10, 20]):
    a3.plot(x, sum((-1) ** m * x ** (2 * m) for m in range(N // 2 + 1)), "--", color=[VIOLET, SERIES[1], SERIES[2]][i], lw=1.4, label=f"степень {N}")
a3.axvspan(-1, 1, color=AQUA, alpha=0.08)
a3.set(title="Гладкая функция, но радиус всего 1", xlabel="x", ylim=(-1, 2))
a3.legend(fontsize=8)
ex.finish(fig, "taylor_polynomials")
