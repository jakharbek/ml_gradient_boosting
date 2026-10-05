"""Признаки сходимости положительных рядов: гармонический ряд, сравнение, интегральный признак, отношение.

Запуск:  python lessons/lesson_15_10/examples/convergence_tests.py [--save] [--no-show]

1) Гармонический ряд: группы по 2ᵏ членов ≥ ½, Hₙ ≈ ln n + γ, стопка книг (свес Hₙ/2).
2) Предельный признак сравнения: (2k + 1)/(k³ + 5) ~ 2/k² сходится, k/(k² + 3) ~ 1/k расходится.
3) Интегральный признак: p-ряды (сверка с scipy.special.zeta) и оценка остатка Σ 1/k² интегралами.
4) Признак отношения: n/2ⁿ, 2ⁿ/n!, n!/nⁿ, n¹⁰/1.1ⁿ (максимум члена при n = 105).
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import special

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)

# 1. Гармонический ряд
k = np.arange(1, 10**6 + 1, dtype=float)
H = np.cumsum(1 / k)
groups = [sum(1 / j for j in range(2**g + 1, 2 ** (g + 1) + 1)) for g in range(10)]
print("суммы групп:", [round(v, 4) for v in groups], "— все ≥ ½")
for n in (10, 1000, 10**6):
    print(f"H_{n} = {H[n - 1]:.4f}, ln n + γ = {math.log(n) + np.euler_gamma:.4f}")
books = [int(np.argmax(H / 2 >= t)) + 1 for t in (1, 2, 3)]
print("стопка книг: свес 1, 2, 3 при", books, "книгах")
assert min(groups) >= 0.5 and books == [4, 31, 227]

# 2. Предельный признак сравнения
a = (2 * k + 1) / (k**3 + 5)
b = k / (k**2 + 3)
print(f"(2k+1)/(k³+5): a/(2/k²) при k = 10⁶ — {a[-1] * k[-1] ** 2 / 2:.6f}; S_10⁶ = {a.sum():.5f} (сходится)")
print(f"k/(k²+3):      a/(1/k) при k = 10⁶ — {b[-1] * k[-1]:.6f}; S_10³ = {b[:1000].sum():.3f}, S_10⁶ = {b.sum():.3f} (растёт как ln n)")

# 3. Интегральный признак и p-ряды
for p in (1.5, 2.0, 3.0):
    s = np.sum(k[:100000] ** -p)
    tail = 100000 ** (1 - p) / (p - 1)
    print(f"p = {p}: S_10⁵ + ∫ хвоста = {s + tail:.8f}, ζ(p) = {special.zeta(p):.8f}")
    assert abs(s + tail - special.zeta(p)) < 1e-4
S10 = np.sum(1 / k[:10] ** 2)
lo, hi, mid = S10 + 1 / 11, S10 + 1 / 10, S10 + 1 / 10.5
print(f"Σ 1/k² по 10 членам: [{lo:.6f}, {hi:.6f}] ∋ π²/6 = {math.pi**2 / 6:.6f}; оценка S₁₀ + 1/10.5 = {mid:.6f}")
assert lo < math.pi**2 / 6 < hi and abs(mid - math.pi**2 / 6) < 1e-4

# 4. Признак отношения
lf = special.gammaln
cases = {
    "n/2ⁿ": lambda n: np.log(n) - n * np.log(2),
    "2ⁿ/n!": lambda n: n * np.log(2) - lf(n + 1),
    "n!/nⁿ": lambda n: lf(n + 1) - n * np.log(n),
    "n¹⁰/1.1ⁿ": lambda n: 10 * np.log(n) - n * np.log(1.1),
}
for name, la in cases.items():
    print(f"{name:9}: a(n+1)/a(n) при n = 2000 — {np.exp(la(2001.0) - la(2000.0)):.4f}")
nn = np.arange(1, 400, dtype=float)
peak = int(np.argmax(cases["n¹⁰/1.1ⁿ"](nn))) + 1
print("n¹⁰/1.1ⁿ: члены растут до n =", peak, "— но ряд сходится (отношение → 1/1.1)")
assert peak == 105

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
n = np.arange(1, 10**5 + 1)
for p, c in ((0.5, ORANGE), (1.0, MUTED), (1.5, VIOLET), (2.0, BLUE)):
    a1.semilogx(n, np.cumsum(n ** -p), color=c, lw=2, label=f"p = {p}")
a1.semilogx(n, np.log(n) + np.euler_gamma, ":", color="black", lw=1, label="ln n + γ")
a1.set(ylim=(0, 14), title="p-ряды: сходятся только при p > 1", xlabel="n", ylabel="Sₙ")
a1.legend()
for (name, la), c in zip(cases.items(), (BLUE, ORANGE, VIOLET, MUTED)):
    m = np.arange(1, 301, dtype=float)
    a2.semilogy(m, np.exp(la(m)), color=c, lw=2, label=name)
a2.set(title="Члены рядов: показательная функция побеждает", xlabel="n", ylim=(1e-30, 1e18))
a2.legend()
ex.finish(fig, "convergence_tests")
