"""Равновесия Нэша: доминирование, чистые и смешанные равновесия, случайные игры, цена анархии.

Запуск:  python lessons/lesson_15_21/examples/equilibria_2x2.py [--save] [--no-show]

1) Зоопарк игр 2×2: чистые равновесия подчёркиванием, смешанные — из уравнений безразличия.
2) Последовательное удаление доминируемых стратегий: игра 3×3 и пляж Хотеллинга.
3) Случайные игры n×n: среднее число чистых равновесий 1, доля игр с равновесием → 1 − 1/e.
4) Парадокс Браеса и пример Пигу: цена анархии.
5) Кривые наилучших ответов в игре «где встретиться».
"""

import math
import sys
from fractions import Fraction as F
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, INK, ORANGE

ex = Example(__file__)


def pure_ne(A, B):
    A, B = np.asarray(A), np.asarray(B)
    return [(i, j) for i in range(A.shape[0]) for j in range(A.shape[1]) if A[i, j] == A[:, j].max() and B[i, j] == B[i, :].max()]


def mixed2(A, B):
    """Внутреннее смешанное равновесие 2×2: (p, q) — вероятности первой строки и первого столбца."""
    dp = B[0][0] - B[1][0] - B[0][1] + B[1][1]
    dq = A[0][0] - A[0][1] - A[1][0] + A[1][1]
    if not dp or not dq:
        return None
    p, q = F(B[1][1] - B[1][0], dp), F(A[1][1] - A[0][1], dq)
    return (p, q) if 0 < p < 1 and 0 < q < 1 else None


# 1. Зоопарк игр 2×2
zoo = {
    "дилемма заключённого": ([[-1, -3], [0, -2]], [[-1, 0], [-3, -2]]),
    "охота на оленя": ([[4, 0], [3, 3]], [[4, 3], [0, 3]]),
    "где встретиться": ([[2, 0], [0, 1]], [[1, 0], [0, 2]]),
    "ястреб и голубь": ([[-1, 4], [0, 2]], [[-1, 0], [4, 2]]),
    "монетки": ([[1, -1], [-1, 1]], [[-1, 1], [1, -1]]),
}
print("1) Зоопарк игр 2×2")
counts = {}
for name, (A, B) in zoo.items():
    pure, mixed = pure_ne(A, B), mixed2(A, B)
    counts[name] = len(pure) + (mixed is not None)
    print(f"   {name:22}: чистые {pure}, смешанное {mixed}, всего {counts[name]}")
assert counts == {"дилемма заключённого": 1, "охота на оленя": 3, "где встретиться": 3, "ястреб и голубь": 3, "монетки": 1}
assert mixed2(*zoo["где встретиться"]) == (F(2, 3), F(1, 3)) and mixed2(*zoo["ястреб и голубь"]) == (F(2, 3), F(2, 3))


# 2. Удаление доминируемых стратегий
def iesds(A, B):
    A, B = np.asarray(A, float), np.asarray(B, float)
    R, C = list(range(A.shape[0])), list(range(A.shape[1]))
    while True:
        r = next((b for b in R for a in R if a != b and (A[a, C] > A[b, C]).all()), None)
        if r is not None:
            R.remove(r)
            continue
        c = next((b for b in C for a in C if a != b and (B[R, a] > B[R, b]).all()), None)
        if c is None:
            return R, C
        C.remove(c)


assert iesds([[3, 0, 0.5], [2, 1, 1], [1, 0, 0]], [[1, 2, 0], [0, 1, 2], [3, 2, 1]]) == ([1], [2])
for n in (7, 10):
    H = np.array([[sum(1 if abs(x - i) < abs(x - j) else 0.5 if abs(x - i) == abs(x - j) else 0 for x in range(n))
                   for j in range(n)] for i in range(n)])
    R, _ = iesds(H, H.T)
    print(f"2) пляж Хотеллинга из {n} мест: остаются {[r + 1 for r in R]}")
    assert R == ([3] if n == 7 else [4, 5])

# 3. Случайные игры
print("3) Случайные игры n×n (по 1000, генератор курса)")
stat = []
for n in range(2, 11):
    rng = Mulberry32(2026 + n)
    has = tot = 0
    for _ in range(1000):
        A = [[rng.random() for _ in range(n)] for _ in range(n)]
        B = [[rng.random() for _ in range(n)] for _ in range(n)]
        c = len(pure_ne(A, B))
        has, tot = has + (c > 0), tot + c
    stat.append((n, has / 1000, tot / 1000))
    print(f"   n = {n:2}: доля {has / 1000:.3f}, среднее число {tot / 1000:.3f}")
assert stat[0][1] == 0.871 and all(abs(m - 1) < 0.1 for _, _, m in stat)

# 4. Цена анархии
eq_with, eq_without = 4000 / 50, 4000 / 200 + 45
x = np.arange(0, 2001)
opt = (2 * (4000 - x) ** 2 / 100 + 90 * x).min() / 4000
print(f"4) Браес, 4000 водителей: без перемычки {eq_without}, с перемычкой {eq_with}, оптимум {opt:.2f}")
assert (eq_without, eq_with) == (65, 80) and abs(opt - 64.6875) < 1e-9
poa = {d: 1 / ((d + 1) ** (-(d + 1) / d) + 1 - (d + 1) ** (-1 / d)) for d in (1, 2, 10)}
print("   Пигу: цена анархии", {d: round(v, 4) for d, v in poa.items()})
assert abs(poa[1] - 4 / 3) < 1e-12

# 5. Рисунок: кривые наилучших ответов «где встретиться» и доля игр с равновесием
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.2))
a1.plot([0, 2 / 3, 2 / 3, 1], [0, 0, 1, 1], color=ORANGE, lw=3, label="ответ игрока 2: q(p)")
a1.plot([0, 0, 1, 1], [0, 1 / 3, 1 / 3, 1], color=BLUE, lw=2.5, ls="--", label="ответ игрока 1: p(q)")
a1.scatter([0, 2 / 3, 1], [0, 1 / 3, 1], s=80, facecolor="white", edgecolor=INK, zorder=5, label="равновесия")
a1.set(xlabel="p — вероятность «театра» у игрока 1", ylabel="q — у игрока 2", title="«Где встретиться»: три равновесия", aspect="equal")
a1.legend(fontsize=8, loc="center right")
a2.bar([s[0] for s in stat], [s[1] for s in stat], color=BLUE, width=0.6, label="доля игр с чистым равновесием")
a2.axhline(1 - 1 / math.e, color=ORANGE, ls="--", label="1 − 1/e")
a2.set(xlabel="размер n", ylim=(0, 1), title="Случайные игры n×n")
a2.legend(fontsize=8)
ex.finish(fig, "equilibria_2x2")
