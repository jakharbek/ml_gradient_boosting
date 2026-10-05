"""Язык графов: степени, хранение, изоморфизм, связность, эйлеровы и гамильтоновы обходы.

Запуск:  python lessons/lesson_15_18/examples/graph_language.py [--save] [--no-show]

1) Лемма о рукопожатиях на семействах графов и алгоритм Гавела — Хакими.
2) Матрица смежности против CSR: память для больших графов.
3) Изоморфизм: автоморфизмы куба, K₃,₃ против призмы по треугольникам.
4) Эйлеров цикл Хирхольцера в графе де Брёйна; коммивояжёр — перебор против эвристик.
"""

import sys
from itertools import permutations, product
from math import comb, factorial
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.sparse import csr_matrix

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)


def degrees(n, E):
    d = [0] * n
    for a, b in E:
        d[a] += 1
        d[b] += 1
    return d


# 1. Лемма о рукопожатиях и Гавел — Хакими
fams = {
    "K6": (6, [(i, j) for i in range(6) for j in range(i + 1, 6)], comb(6, 2)),
    "Q4": (16, [(b, b | (1 << k)) for b in range(16) for k in range(4) if not b & (1 << k)], 4 * 2 ** 3),
    "решётка 3×4": (12, [(r * 4 + c, r * 4 + c + 1) for r in range(3) for c in range(3)] + [(r * 4 + c, (r + 1) * 4 + c) for r in range(2) for c in range(4)], 17),
}
print("Лемма о рукопожатиях:")
for name, (n, E, formula) in fams.items():
    d = degrees(n, E)
    print(f"  {name:12} рёбер {len(E):2} (формула {formula}), сумма степеней {sum(d)} = 2·{len(E)}")
    assert sum(d) == 2 * len(E) and len(E) == formula


def havel_hakimi(seq):
    res = list(seq)
    if sum(res) % 2:
        return None
    while True:
        order = sorted((i for i in range(len(res)) if res[i] > 0), key=lambda i: (-res[i], i))
        if not order:
            return True
        v, d = order[0], res[order[0]]
        if len(order) - 1 < d:
            return None
        res[v] = 0
        for u in order[1:d + 1]:
            res[u] -= 1


for seq in ([4, 3, 3, 2, 2], [4, 4, 4, 1, 1], [3] * 9):
    print(f"  степени {seq}: {'граф есть' if havel_hakimi(seq) else 'графа нет'}")
assert havel_hakimi([4, 3, 3, 2, 2]) and not havel_hakimi([4, 4, 4, 1, 1]) and not havel_hakimi([3] * 9)

# 2. Память: матрица против CSR
rng = Mulberry32(1)
n_small = 2000
A = np.zeros((n_small, n_small), dtype=np.int8)
for _ in range(n_small * 5):
    a, b = rng.randint(n_small), rng.randint(n_small)
    if a != b:
        A[a, b] = A[b, a] = 1
M = csr_matrix(A)
print(f"\nГраф на {n_small} вершин, рёбер {M.nnz // 2}: матрица {A.nbytes / 1e6:.1f} МБ, CSR {(M.data.nbytes + M.indices.nbytes + M.indptr.nbytes) / 1e6:.2f} МБ")
assert M.indices.nbytes + M.indptr.nbytes < A.nbytes / 10

# 3. Изоморфизм
cube_a = [(0, 1), (1, 2), (2, 3), (3, 0), (4, 5), (5, 6), (6, 7), (7, 4), (0, 4), (1, 5), (2, 6), (3, 7)]
cube_b = [(i, (i + 1) % 8) for i in range(8)] + [(0, 3), (1, 6), (2, 5), (4, 7)]


def n_iso(n, E1, E2):
    S2 = {frozenset(e) for e in E2}
    return sum(all(frozenset((p[a], p[b])) in S2 for a, b in E1) for p in permutations(range(n)))


def triangles(n, E):
    S = {frozenset(e) for e in E}
    return sum(1 for i in range(n) for j in range(i + 1, n) for k in range(j + 1, n) if {frozenset((i, j)), frozenset((j, k)), frozenset((i, k))} <= S)


k33 = [(i, 3 + j) for i in range(3) for j in range(3)]
prism = [(0, 1), (1, 2), (2, 0), (3, 4), (4, 5), (5, 3), (0, 3), (1, 4), (2, 5)]
print(f"\nКуб двумя способами: изоморфизмов {n_iso(8, cube_a, cube_b)}; K33 и призма: {n_iso(6, k33, prism)} (треугольников {triangles(6, k33)} и {triangles(6, prism)})")
assert n_iso(8, cube_a, cube_b) == 48 and n_iso(6, k33, prism) == 0

# 4. Эйлер и Гамильтон
adj = {"".join(p): [p[1] + c for c in "10"] for p in product("01", repeat=2)}
stack, out = ["00"], []
while stack:
    v = stack[-1]
    if adj[v]:
        stack.append(adj[v].pop())
    else:
        out.append(stack.pop())
cyc = out[::-1]
seq = cyc[0] + "".join(v[1] for v in cyc[1:])
print("\nСтрока де Брёйна (эйлеров цикл):", seq, "— все тройки:", sorted({seq[i:i + 3] for i in range(8)}))
assert len({seq[i:i + 3] for i in range(8)}) == 8

rng = Mulberry32(3)
cities = []
while len(cities) < 9:
    c = (round(rng.uniform(40, 480)), round(rng.uniform(40, 260)))
    if all(np.hypot(c[0] - q[0], c[1] - q[1]) >= 55 for q in cities):
        cities.append(c)
D = np.array([[np.hypot(a[0] - b[0], a[1] - b[1]) / 10 for b in cities] for a in cities])
length = lambda t: sum(D[t[i], t[(i + 1) % len(t)]] for i in range(len(t)))
best = min(((0,) + p for p in permutations(range(1, 9))), key=length)
tour, left = [0], set(range(1, 9))
while left:
    nxt = min(left, key=lambda u: D[tour[-1], u])
    tour.append(nxt)
    left.remove(nxt)
print(f"Коммивояжёр, 9 городов: перебор {length(best):.2f}, ближайший сосед {length(tour):.2f}; циклов (n−1)!/2 = {factorial(8) // 2}")
assert length(best) <= length(tour)

fig, axes = plt.subplots(1, 2, figsize=(11, 4.2))
P = np.array(cities)
for ax, t, title, col in ((axes[0], best, f"Перебор: {length(best):.2f}", BLUE), (axes[1], tour, f"Ближайший сосед: {length(tour):.2f}", ORANGE)):
    for i in range(9):
        a, b = t[i], t[(i + 1) % 9]
        ax.plot(*zip(P[a], P[b]), color=col, lw=2.2)
    ax.scatter(*P.T, s=160, color="white", edgecolors=MUTED, zorder=3)
    for i, (x, y) in enumerate(P):
        ax.text(x, y, str(i + 1), ha="center", va="center", fontsize=9, zorder=4)
    ax.set_title(title)
    ax.set_aspect("equal")
    ax.invert_yaxis()
    ax.axis("off")
fig.suptitle("Гамильтонов цикл: точный перебор против жадной эвристики")
ex.finish(fig, "graph_language")
