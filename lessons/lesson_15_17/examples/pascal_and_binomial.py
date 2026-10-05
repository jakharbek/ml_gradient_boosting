"""Треугольник Паскаля, бином Ньютона, тождества двойного подсчёта и размер C(n, k).

Запуск:  python lessons/lesson_15_17/examples/pascal_and_binomial.py [--save] [--no-show]

1) Треугольник правилом Паскаля (только сложения) против math.comb; чётность и теорема Люка.
2) Четыре формулы «порядок × повторения» против itertools; анаграммы; пути по решётке таблицей.
3) Тождества: строка, капитан, Вандермонд, клюшка, квадраты.
4) Строка 100 — колокол; log₂ C(n, k) ≈ n·H(k/n); формула Стирлинга.
"""

import math
import sys
from collections import Counter
from itertools import combinations, combinations_with_replacement, permutations, product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE

ex = Example(__file__)
comb = math.comb

# 1. Треугольник
rows = [[1]]
for _n in range(1, 33):
    rows.append([a + b for a, b in zip([0] + rows[-1], rows[-1] + [0])])
assert all(rows[n][k] == comb(n, k) for n in range(33) for k in range(n + 1))
odd = [sum(c % 2 for c in r) for r in rows]
assert all(odd[n] == 2 ** bin(n).count("1") for n in range(33))
print("строка 10:", rows[10], "; нечётных:", odd[10], "= 2^(единиц в 1010₂)")

# 2. Формулы против перебора
items, k = "ABCDEF", 3
n = len(items)
for name, f, it in (("размещения", math.perm(n, k), permutations(items, k)), ("сочетания", comb(n, k), combinations(items, k)),
                    ("слова", n**k, product(items, repeat=k)), ("сочетания с повторениями", comb(n + k - 1, k), combinations_with_replacement(items, k))):
    cnt = len(list(it))
    print(f"{name:26s} {f:4d} = перебор {cnt}")
    assert f == cnt
for w in ("МАМА", "ПАПАХА", "МИССИСИПИ"):
    formula = math.factorial(len(w)) // math.prod(math.factorial(v) for v in Counter(w).values())
    assert formula == len(set(permutations(w)))
    print(f"анаграмм {w}: {formula}")


def lattice(m, n, blocked=()):
    T = [[0] * (n + 1) for _ in range(m + 1)]
    for x in range(m + 1):
        for y in range(n + 1):
            if (x, y) not in blocked:
                T[x][y] = 1 if x == y == 0 else (T[x - 1][y] if x else 0) + (T[x][y - 1] if y else 0)
    return T[m][n]


assert lattice(4, 3) == comb(7, 3) == 35 and lattice(4, 3, {(2, 1)}) == 35 - comb(3, 1) * comb(4, 2) == 17
print("пути 4×3:", lattice(4, 3), "; в обход (2, 1):", lattice(4, 3, {(2, 1)}))

# 3. Тождества
for n_ in range(1, 12):
    for k_ in range(1, n_ + 1):
        assert k_ * comb(n_, k_) == n_ * comb(n_ - 1, k_ - 1)
        assert sum(comb(i, k_) for i in range(k_, n_ + 1)) == comb(n_ + 1, k_ + 1)
    assert sum(comb(n_, j) ** 2 for j in range(n_ + 1)) == comb(2 * n_, n_)
assert sum(comb(6, j) * comb(4, 3 - j) for j in range(4)) == comb(10, 3)
print("тождества капитана, клюшки, квадратов и Вандермонда верны при n ≤ 11")
print("коэффициент при x³ в (2x − 1)⁵:", comb(5, 3) * 2**3, "; 1.01¹⁰⁰ =", round(1.01**100, 4))

# 4. Размер C(n, k)
H = lambda q: 0.0 if q in (0, 1) else -q * math.log2(q) - (1 - q) * math.log2(1 - q)
print(f"log₂ C(1000, 100) = {math.log2(comb(1000, 100)):.1f} против 1000·H(0.1) = {1000 * H(0.1):.1f}")
print(f"C(20, 10) = {comb(20, 10)}, приближение {2**20 * math.sqrt(2 / (20 * math.pi)):.0f}; P(50 орлов из 100) = {comb(100, 50) / 2**100:.4f}")
for n_ in (5, 10, 52):
    st = math.sqrt(2 * math.pi * n_) * (n_ / math.e) ** n_
    print(f"Стирлинг, n = {n_}: ошибка {1 - st / math.factorial(n_):.4%}, 1/(12n) = {1 / (12 * n_):.4%}")

fig, axes = plt.subplots(1, 3, figsize=(14, 3.9))
img = np.zeros((32, 63))
for n_ in range(32):
    for k_ in range(n_ + 1):
        img[n_, 31 - n_ + 2 * k_] = rows[n_][k_] % 2
axes[0].imshow(img, cmap="Blues", vmin=0, vmax=1.4, aspect="auto")
axes[0].set(title="Нечётные C(n, k): треугольник Серпинского", xticks=[], ylabel="строка n")
ks = np.arange(101)
axes[1].bar(ks, [comb(100, k_) / 2**100 for k_ in ks], color=BLUE, width=0.8, label="C(100, k)/2¹⁰⁰")
xs = np.linspace(25, 75, 300)
axes[1].plot(xs, np.exp(-((xs - 50) ** 2) / 50) / np.sqrt(50 * np.pi), "--", color=MUTED, label="N(50, 25)")
axes[1].set(xlim=(25, 75), xlabel="k", title="Строка 100 — колокол")
axes[1].legend(fontsize=8)
for n_, c in ((20, MUTED), (100, AQUA), (1000, BLUE)):
    axes[2].plot(np.arange(n_ + 1) / n_, [math.log2(comb(n_, k_)) / n_ for k_ in range(n_ + 1)], color=c, label=f"log₂C(n, k)/n, n = {n_}")
qs = np.linspace(0.001, 0.999, 300)
axes[2].plot(qs, [H(q) for q in qs], "--", color=ORANGE, label="H(k/n)")
axes[2].set(xlabel="k/n", ylabel="бит на объект", title="log₂ C(n, k) ≈ n·H(k/n)")
axes[2].legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "pascal_and_binomial")
