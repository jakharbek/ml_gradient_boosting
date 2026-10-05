"""Ряды со знаками: признак Лейбница, абсолютная и условная сходимость, теорема Римана о перестановках.

Запуск:  python lessons/lesson_15_10/examples/alternating_and_rearrangement.py [--save] [--no-show]

1) Лейбниц: |S − Sₙ| ≤ |aₙ₊₁| для ln 2, π и 1/e; среднее соседних сумм точнее каждой.
2) Абсолютная и условная сходимость: Σ(−1)ᵏ⁺¹/k² и Σ sin k/k² против Σ(−1)ᵏ⁺¹/k и Σ(−1)ᵏ⁺¹/√k.
3) Теорема Римана: «p плюсов, q минусов» дают ln 2 + ½ ln(p/q); жадная перестановка — любую цель.
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

# 1. Признак Лейбница
k = np.arange(1, 10**5 + 2, dtype=float)
sgn = np.where(k % 2 == 1, 1.0, -1.0)
L = np.cumsum(sgn / k)
P = np.cumsum(4 * sgn / (2 * k - 1))
for n in (10, 100, 1000):
    err = abs(L[n - 1] - math.log(2))
    avg = abs((L[n - 1] + L[n]) / 2 - math.log(2))
    print(f"n = {n:4d}: ln 2 — ошибка {err:.2e} ≤ {1 / (n + 1):.2e}; среднее соседних {avg:.1e};  π ≈ {P[n - 1]:.5f}, среднее {(P[n - 1] + P[n]) / 2:.7f}")
    assert err <= 1 / (n + 1)
e_part = sum((-1) ** j / math.factorial(j) for j in range(10))
print(f"1/e за 10 членов: ошибка {abs(e_part - 1 / math.e):.2e} ≤ 1/10! = {1 / math.factorial(10):.2e}")

# 2. Абсолютная и условная сходимость
series = {
    "(−1)ᵏ⁺¹/k²": sgn / k**2,
    "sin k / k²": np.sin(k) / k**2,
    "(−1)ᵏ⁺¹/k": sgn / k,
    "(−1)ᵏ⁺¹/√k": sgn / np.sqrt(k),
}
for name, a in series.items():
    s = np.cumsum(a)
    print(f"{name:11}: Σa ≈ {(s[-1] + s[-2]) / 2:.5f}, Σ|a| до 10⁵ = {np.abs(a).sum():.3f}")


# 3. Теорема Римана
def rearranged(p, q, blocks=50000):
    s, i, j = 0.0, 0, 0
    for _ in range(blocks):
        for _ in range(p):
            s += 1 / (2 * i + 1)
            i += 1
        for _ in range(q):
            s -= 1 / (2 * j + 2)
            j += 1
    return s


for p, q in [(1, 1), (1, 2), (2, 1), (1, 4)]:
    got, theory = rearranged(p, q), math.log(2) + 0.5 * math.log(p / q)
    print(f"p = {p}, q = {q}: сумма {got:.5f}, ln 2 + ½ ln(p/q) = {theory:.5f}")
    assert abs(got - theory) < 1e-4


def greedy_path(target, n=5000):
    s, i, j, out = 0.0, 0, 0, []
    for _ in range(n):
        if s <= target:
            s += 1 / (2 * i + 1)
            i += 1
        else:
            s -= 1 / (2 * j + 2)
            j += 1
        out.append(s)
    return np.array(out)


fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
n = np.arange(1, 41)
a1.plot(n, L[:40], "o-", ms=3.5, color=BLUE, label="Sₙ")
a1.fill_between(n, math.log(2) - 1 / (n + 1), math.log(2) + 1 / (n + 1), color=ORANGE, alpha=0.2, label="ln 2 ± 1/(n + 1)")
a1.plot(n, (L[:40] + L[1:41]) / 2, "s", ms=3, color=VIOLET, label="среднее соседних")
a1.axhline(math.log(2), color=ORANGE, ls="--", lw=1)
a1.set(title="Лейбниц: ёлочка внутри гарантированной полосы", xlabel="n", ylim=(0.45, 1.05))
a1.legend()
for t, c in ((-1, RED), (0, AQUA), (1.5, BLUE), (math.pi, VIOLET)):
    a2.semilogx(np.arange(1, 5001), greedy_path(t), color=c, lw=1.6, label=f"цель {t:.4g}")
a2.axhline(math.log(2), color="black", ls=":", lw=1)
a2.set(title="Перестановки 1 − ½ + ⅓ − … сходятся к любой цели", xlabel="сколько членов сложено")
a2.legend()
ex.finish(fig, "alternating_and_rearrangement")
