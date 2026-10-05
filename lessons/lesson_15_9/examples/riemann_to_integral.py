"""Суммы Римана подходят к интегралу: метки, предел вручную, нижние и верхние суммы.

Запуск:  python lessons/lesson_15_9/examples/riemann_to_integral.py [--save] [--no-show]

1) x² на [0, 2]: левые, правые, середины и случайные метки — все суммы подходят к 8/3.
2) Предел вручную: правые суммы равны (b³/3)(1 + 1/n)(1 + 1/(2n)), ошибка × n → b³/2.
3) Нижние и верхние суммы: для x² зазор 8/n, для ступеньки со скачком — 1.5·h; для 1/√x верхняя сумма бесконечна.
4) Путь машины по показаниям спидометра: 99 → 99.75 → 99.99 → 100 м.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Rectangle

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, ORANGE

ex = Example(__file__)


def riemann(f, a, b, n, off=0.5):
    h = (b - a) / n
    return float(np.sum(f(a + (np.arange(n) + off) * h)) * h)


def darboux(f, a, b, n, m=200):
    edges = np.linspace(a, b, n + 1)
    vals = [f(np.linspace(edges[i], edges[i + 1], m)) for i in range(n)]
    h = (b - a) / n
    return sum(v.min() for v in vals) * h, sum(v.max() for v in vals) * h


sq = lambda x: x**2  # noqa: E731
exact = 8 / 3

# 1. Метки
rng = Mulberry32(1)
print("x² на [0, 2]:")
for n in (4, 100, 1000):
    tags = np.array([rng.random() for _ in range(n)])
    row = [riemann(sq, 0, 2, n, off) for off in (0, 0.5, 1, tags)]
    print(f"  n = {n:4d}: слева {row[0]:.5f}, середина {row[1]:.6f}, справа {row[2]:.5f}, случайно {row[3]:.5f}")
assert riemann(sq, 0, 2, 4, 0) == 1.75 and riemann(sq, 0, 2, 4, 1) == 3.75 and riemann(sq, 0, 2, 4) == 2.625
assert abs(riemann(sq, 0, 2, 1000) - exact) < 1e-6

# 2. Предел вручную
print("правые суммы и формула:")
for n in (10, 100, 1000):
    S = riemann(sq, 0, 2, n, 1)
    F = 8 / 3 * (1 + 1 / n) * (1 + 1 / (2 * n))
    print(f"  n = {n:4d}: S = {S:.6f} = {F:.6f}, ошибка × n = {(S - exact) * n:.4f}")
    assert abs(S - F) < 1e-12

# 3. Нижние и верхние суммы
step = lambda x: np.where(x < 1.5, 1.0, 2.5)  # noqa: E731
for n in (4, 16, 64):
    L, U = darboux(sq, 0, 2, n)
    Ls, Us = darboux(step, 0, 3, n)
    print(f"  n = {n:2d}: x² U − L = {U - L:.4f} (8/n = {8 / n:.4f}); ступенька U − L = {Us - Ls:.4f} (1.5·h = {1.5 * 3 / n:.4f})")
    assert abs((U - L) - 8 / n) < 1e-9 and abs((Us - Ls) - 4.5 / n) < 1e-9
with np.errstate(divide="ignore"):
    print("  1/√x на [0, 1]: верхняя сумма при n = 8 —", darboux(lambda x: 1 / np.sqrt(x), 0, 1, 8)[1])

# 4. Путь машины
v = lambda t: 6 * t - 0.6 * t**2  # noqa: E731
paths = {dt: riemann(v, 0, 10, round(10 / dt), 0) for dt in (1, 0.5, 0.1)}
print("путь по показаниям спидометра:", {k: round(p, 4) for k, p in paths.items()}, "→ 100 м")
assert abs(paths[1] - 99) < 1e-9 and abs(paths[0.1] - 99.99) < 1e-9

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
n = 8
h = 2 / n
xs = np.linspace(0, 2, 200)
for k in range(n):
    lo, hi = sq(k * h), sq((k + 1) * h)
    a1.add_patch(Rectangle((k * h, 0), h, lo, color=BLUE, alpha=0.35, ec=BLUE))
    a1.add_patch(Rectangle((k * h, lo), h, hi - lo, facecolor=ORANGE, alpha=0.15, edgecolor=ORANGE))
a1.plot(xs, sq(xs), color="black", lw=2.2)
L, U = darboux(sq, 0, 2, n)
a1.set(title=f"n = {n}: {L:.4f} ≤ 8/3 ≤ {U:.4f}", xlim=(0, 2.05), ylim=(0, 4.2), xlabel="x")
ns = np.array([1, 2, 4, 8, 16, 32, 64, 128])
a2.semilogx(ns, [darboux(sq, 0, 2, k)[0] for k in ns], "o-", color=BLUE, label="нижняя сумма")
a2.semilogx(ns, [darboux(sq, 0, 2, k)[1] for k in ns], "o-", color=ORANGE, label="верхняя сумма")
a2.axhline(exact, color="black", ls="--", lw=1, label="8/3")
a2.set(title="Площадь зажата между суммами", xlabel="n")
a2.legend()
ex.finish(fig, "riemann_to_integral")
