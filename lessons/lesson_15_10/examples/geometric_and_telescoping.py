"""Сумма ряда как предел: телескопические и геометрические ряды, периодические дроби, бустинг одного числа.

Запуск:  python lessons/lesson_15_10/examples/geometric_and_telescoping.py [--save] [--no-show]

1) Телескоп: Σ 1/(k(k+1)) = 1, Σ 1/(k(k+1)(k+2)) = 1/4, а Σ ln(1 + 1/k) = ln(n + 1) → ∞.
2) Геометрический ряд: остаток a·qⁿ/(1 − q) и число членов для точности ε.
3) Периодические дроби: 0.1(6) = 1/6, 0.(9) = 1, 0.(142857) = 1/7.
4) Бустинг одного числа: остаток (1 − ν)ᴹ, шагов до 1 % ≈ 4.6/ν, расходимость при ν ≥ 2.
"""

import math
import sys
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE, RED, VIOLET

ex = Example(__file__)

# 1. Телескопические ряды
k = np.arange(1, 100001, dtype=float)
s1 = np.cumsum(1 / (k * (k + 1)))
s3 = np.cumsum(1 / (k * (k + 1) * (k + 2)))
sl = np.cumsum(np.log1p(1 / k))
print(f"Σ 1/(k(k+1)):      S_10 = {s1[9]:.6f} = 10/11, S_100000 = {s1[-1]:.6f} → 1")
print(f"Σ 1/(k(k+1)(k+2)): S_100000 = {s3[-1]:.8f} → 1/4")
print(f"Σ ln(1 + 1/k):     S_99 = {sl[98]:.6f} = ln 100 = {math.log(100):.6f} → ∞")
assert abs(s1[9] - 10 / 11) < 1e-14 and abs(s3[-1] - 0.25) < 1e-9 and abs(sl[98] - math.log(100)) < 1e-12

# 2. Геометрический ряд и его остаток
for q in (0.5, 0.9, 0.99):
    n = math.ceil(math.log(1e-3 * (1 - q)) / math.log(q))
    print(f"q = {q}: сумма {1 / (1 - q):g}; для ошибки < 0.001 нужно {n} членов (остаток {q**n / (1 - q):.2e})")
assert math.ceil(math.log(1e-4) / math.log(0.9)) == 88


# 3. Периодические дроби
def periodic(pre: str, per: str) -> Fraction:
    m, p = len(pre), len(per)
    return Fraction(int(pre or 0), 10**m) + Fraction(int(per), 10**m * (10**p - 1))


for pre, per in [("1", "6"), ("", "9"), ("", "142857"), ("58", "3")]:
    print(f"0.{pre}({per}) = {periodic(pre, per)}")
assert periodic("", "9") == 1 and periodic("", "142857") == Fraction(1, 7)

# 4. Бустинг одного числа
target = 10.0
rows = {}
for nu in (0.1, 0.3, 1.5, 1.9, 2.1):
    F, path = 0.0, [0.0]
    for _ in range(40):
        F += nu * (target - F)
        path.append(F)
    rows[nu] = path
    q = abs(1 - nu)
    steps = math.ceil(math.log(0.01) / math.log(q)) if q < 1 else None
    print(f"ν = {nu}: F_40 = {path[-1]:.4g}; шагов до 1 %: {steps if steps else 'никогда'}" + (f" (≈ 4.6/ν = {4.6 / nu:.0f})" if nu < 0.5 else ""))
assert math.ceil(math.log(0.01) / math.log(0.9)) == 44 and math.ceil(math.log(0.01) / math.log(0.7)) == 13

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
n = np.arange(1, 41)
for q, c in ((0.5, BLUE), (0.9, VIOLET), (-0.5, ORANGE)):
    S = np.cumsum(q ** (n - 1))
    a1.plot(n, S, "o-", ms=3, color=c, label=f"q = {q}")
    a1.axhline(1 / (1 - q), color=c, ls="--", lw=1)
a1.set(title="Геометрический ряд: Sₙ → 1/(1 − q)", xlabel="n", ylabel="Sₙ")
a1.legend()
for (nu, path), c in zip(rows.items(), (BLUE, VIOLET, ORANGE, MUTED, RED)):
    a2.plot(np.clip(path, -40, 60), color=c, lw=2, label=f"ν = {nu}")
a2.axhline(target, color="black", ls="--", lw=1)
a2.set(title="Бустинг одного числа: остаток (1 − ν)ᴹ", xlabel="шаг m", ylabel="Fₘ", ylim=(-30, 40))
a2.legend()
ex.finish(fig, "geometric_and_telescoping")
