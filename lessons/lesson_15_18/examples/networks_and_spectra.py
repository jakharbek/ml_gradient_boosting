"""Сети и матрицы: маршруты, PageRank, центральности, спектр, гигантская компонента, тесный мир, хабы.

Запуск:  python lessons/lesson_15_18/examples/networks_and_spectra.py [--save] [--no-show]

1) Степени матрицы смежности: маршруты и треугольники.
2) PageRank: степенной метод, собственный вектор и моделирование блуждания.
3) Посредничество: прямой подсчёт кратчайших путей; спектр лапласиана и вектор Фидлера.
4) Случайные графы: гигантская компонента против теории; Уоттс — Строгац; Барабаши — Альберт.
"""

import sys
from collections import deque
from math import comb
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.sparse.csgraph import floyd_warshall

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)

# 1. Маршруты
A = np.zeros((5, 5), dtype=int)
for a, b in [(0, 1), (0, 2), (1, 2), (2, 3), (2, 4), (3, 4)]:
    A[a, b] = A[b, a] = 1
A3 = np.linalg.matrix_power(A, 3)
print("диагональ A² (степени):", np.diag(A @ A), " треугольников tr(A³)/6:", np.trace(A3) // 6)
assert np.trace(A3) // 6 == 2

# 2. PageRank
names = "ABCDEF"
out = {"A": "BC", "B": "C", "C": "A", "D": "C", "E": "CD", "F": "AE"}
M = np.zeros((6, 6))
for a, bs in out.items():
    for b in bs:
        M[names.index(b), names.index(a)] = 1 / len(bs)
r = np.full(6, 1 / 6)
for _ in range(200):
    r = 0.15 / 6 + 0.85 * M @ r
vals, vecs = np.linalg.eig(0.85 * M + 0.15 / 6)
v = np.real(vecs[:, np.argmax(np.real(vals))])
rng = Mulberry32(1)
cnt, cur = np.zeros(6), rng.randint(6)
for _ in range(30000):
    cur = names.index(out[names[cur]][rng.randint(len(out[names[cur]]))]) if rng.random() < 0.85 else rng.randint(6)
    cnt[cur] += 1
print("\nPageRank степенным методом:", r.round(3))
print("собственный вектор:          ", (v / v.sum()).round(3))
print("доли времени блуждания:      ", (cnt / 30000).round(3))
assert np.allclose(v / v.sum(), r) and abs(r[5] - 0.025) < 1e-12 and np.abs(cnt / 30000 - r).max() < 0.01

# 3. Посредничество и спектр
CGe = [(0, 1), (0, 2), (1, 2), (1, 3), (2, 3), (3, 4), (2, 4), (4, 5), (5, 6), (6, 7), (7, 8), (7, 9), (8, 9), (8, 10), (9, 10), (10, 11), (9, 11)]
W = np.zeros((12, 12))
for a, b in CGe:
    W[a, b] = W[b, a] = 1
D = floyd_warshall(W, directed=False)
S = [set(np.flatnonzero(W[i])) for i in range(12)]


def sigma(s):
    dist, sig, q = {s: 0}, {s: 1}, deque([s])
    while q:
        x = q.popleft()
        for u in S[x]:
            if u not in dist:
                dist[u], sig[u] = dist[x] + 1, 0
                q.append(u)
            if dist[u] == dist[x] + 1:
                sig[u] += sig[x]
    return sig


SIG = [sigma(s) for s in range(12)]
btw = [sum(SIG[s][v] * SIG[v][t] / SIG[s][t] for s in range(12) for t in range(s + 1, 12) if v not in (s, t) and D[s, v] + D[v, t] == D[s, t]) / comb(11, 2) for v in range(12)]
print("\nпосредничество:", np.round(btw, 3), " степени:", W.sum(1).astype(int))
assert abs(btw[5] - 30 / 55) < 1e-12

L = np.diag(W.sum(1)) - W
lam, vec = np.linalg.eigh(L)
print("λ2 =", round(lam[1], 4), " знак вектора Фидлера:", (vec[:, 1] > 0).astype(int))
assert len(set(vec[:6, 1] > 0)) == 1 and len(set(vec[6:, 1] > 0)) == 1


# 4. Случайные сети
def giant(n, c, seed):
    rng = Mulberry32(seed)
    par = list(range(n))

    def fnd(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x

    for i in range(n):
        for j in range(i + 1, n):
            if rng.random() < c / (n - 1):
                par[fnd(i)] = fnd(j)
    return np.bincount([fnd(i) for i in range(n)]).max() / n


def theory(c):
    s = 1.0
    for _ in range(2000):
        s = 1 - np.exp(-c * s)
    return s


cs = np.linspace(0, 4, 17)
sim = [np.mean([giant(500, c, 100 + k) for k in range(3)]) for c in cs]
print("\nгигантская компонента при c = 2: моделирование", round(sim[8], 3), " теория", round(theory(2), 3))
assert abs(sim[8] - theory(2)) < 0.05


def barabasi(n, m, seed):
    rng = Mulberry32(seed)
    edges, rep = [(0, 1), (0, 2), (1, 2)], [0, 1, 0, 2, 1, 2]
    for x in range(3, n):
        tg = set()
        while len(tg) < m:
            tg.add(rep[rng.randint(len(rep))])
        for u in sorted(tg):
            edges.append((u, x))
            rep += [u, x]
    return edges


deg_ba = np.bincount(np.array(barabasi(3000, 2, 1)).ravel())
rng = Mulberry32(1)
p = 2 * (len(deg_ba) * 2 - 3) / (3000 * 2999)
deg_er = np.zeros(3000, int)
for i in range(3000):
    for j in range(i + 1, 3000):
        if rng.random() < p:
            deg_er[i] += 1
            deg_er[j] += 1
print("максимальная степень при n = 3000: БА", deg_ba.max(), " ЭР", deg_er.max())
assert deg_ba.max() > 5 * deg_er.max()

fig, axes = plt.subplots(1, 2, figsize=(12, 4))
cc = np.linspace(0, 4, 200)
axes[0].plot(cs, sim, "o-", color=BLUE, label="моделирование, n = 500")
axes[0].plot(cc, [theory(c) for c in cc], "--", color=ORANGE, label="теория $s = 1 - e^{-cs}$")
axes[0].axvline(1, color=MUTED, ls=":")
axes[0].set_xlabel("средняя степень c")
axes[0].set_ylabel("доля в гигантской компоненте")
axes[0].legend()
axes[0].set_title("Фазовый переход Эрдёша — Реньи")
for deg, col, name in ((deg_ba, ORANGE, "Барабаши — Альберт"), (deg_er, BLUE, "Эрдёш — Реньи")):
    ks = np.arange(1, deg.max() + 1)
    axes[1].loglog(ks, [(deg >= k).mean() for k in ks], color=col, label=name)
axes[1].set_xlabel("степень k")
axes[1].set_ylabel("доля вершин со степенью ≥ k")
axes[1].legend()
axes[1].set_title("Хабы: тяжёлый хвост степеней")
ex.finish(fig, "networks_and_spectra")
