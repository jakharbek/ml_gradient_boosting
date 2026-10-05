"""Деревья: код Прюфера и формула Кэли, теорема Кирхгофа, дерево решений, остовное дерево и кластеризация.

Запуск:  python lessons/lesson_15_18/examples/trees_and_spanning.py [--save] [--no-show]

1) Перебор кодов Прюфера: деревьев на n вершинах ровно n^(n−2).
2) Матричная теорема Кирхгофа: остовные деревья K4, C5, K33, куба и графа Петерсена.
3) Дерево решений как граф: узлы, листья, рёбра и правила листьев.
4) Краскал против scipy; кластеризация одиночной связи против sklearn.
"""

import sys
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components, minimum_spanning_tree
from scipy.spatial.distance import pdist, squareform
from sklearn.cluster import AgglomerativeClustering

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import MUTED, ORANGE, SERIES
from gbcourse.tree import RegressionTree

ex = Example(__file__)


# 1. Прюфер и Кэли
def decode(code, n):
    deg = {v: 1 for v in range(1, n + 1)}
    for v in code:
        deg[v] += 1
    edges = []
    for v in code:
        leaf = min(u for u in deg if deg[u] == 1)
        edges.append((leaf, v))
        deg[leaf] -= 1
        deg[v] -= 1
    a, b = [u for u in deg if deg[u] == 1]
    return edges + [(a, b)]


print("Формула Кэли (перебор кодов Прюфера):")
for n in range(3, 8):
    trees = {frozenset(map(frozenset, decode(list(c), n))) for c in product(range(1, n + 1), repeat=n - 2)}
    print(f"  n = {n}: деревьев {len(trees):6}, n^(n−2) = {n ** (n - 2)}")
    assert len(trees) == n ** (n - 2)


# 2. Кирхгоф
def kirchhoff(n, E):
    A = np.zeros((n, n))
    for a, b in E:
        A[a, b] = A[b, a] = 1
    L = np.diag(A.sum(1)) - A
    return round(np.linalg.det(L[1:, 1:]))


graphs = {
    "K4": (4, [(i, j) for i in range(4) for j in range(i + 1, 4)]),
    "C5": (5, [(i, (i + 1) % 5) for i in range(5)]),
    "K33": (6, [(i, 3 + j) for i in range(3) for j in range(3)]),
    "куб": (8, [(b, b | (1 << k)) for b in range(8) for k in range(3) if not b & (1 << k)]),
    "Петерсен": (10, [(i, (i + 1) % 5) for i in range(5)] + [(i, i + 5) for i in range(5)] + [(5 + i, 5 + (i + 2) % 5) for i in range(5)]),
}
counts = {k: kirchhoff(*v) for k, v in graphs.items()}
print("\nОстовных деревьев (Кирхгоф):", counts)
assert counts == {"K4": 16, "C5": 5, "K33": 81, "куб": 384, "Петерсен": 2000}

# 3. Дерево решений как граф
rng = Mulberry32(5)
X, y = [], []
for _ in range(160):
    a, b = rng.uniform(0, 10), rng.uniform(0, 10)
    inside = (a > 6 and b < 6) or (a < 3 and b > 7)
    X.append([a, b])
    y.append(1 if rng.random() < (0.9 if inside else 0.1) else 0)
X, y = np.array(X), np.array(y)
print("\nДерево решений (gbcourse):")
for depth in (1, 2, 3, 4):
    t = RegressionTree(max_depth=depth, min_samples_leaf=5).fit(X, -y.astype(float))
    nodes, leaves = len(t.nodes), sum(nd.left < 0 for nd in t.nodes)
    acc = np.mean((t.predict(X) > 0.5) == y)
    print(f"  глубина {depth}: узлов {nodes:2}, листьев {leaves:2}, рёбер {nodes - 1:2}, точность {acc:.1%}")
    assert leaves == nodes - leaves + 1

# 4. Краскал и кластеризация
E8 = [(0, 1, 4), (0, 4, 7), (1, 2, 8), (1, 5, 3), (0, 5, 6), (2, 3, 5), (2, 6, 2), (3, 7, 9), (4, 5, 10), (5, 6, 1), (6, 7, 11), (3, 6, 12), (1, 4, 13), (2, 5, 14)]
par = list(range(8))


def find(v):
    while par[v] != v:
        par[v] = par[par[v]]
        v = par[v]
    return v


weight = 0
for a, b, w in sorted(E8, key=lambda e: e[2]):
    if find(a) != find(b):
        par[find(a)] = find(b)
        weight += w
W8 = np.zeros((8, 8))
for a, b, w in E8:
    W8[a, b] = w
print("\nКраскал:", weight, " scipy:", int(minimum_spanning_tree(csr_matrix(W8)).sum()))
assert weight == 31

Xm, ym = datasets.classification_2d(kind="moons", n=120, noise=0.06, seed=3)
T = minimum_spanning_tree(squareform(pdist(Xm))).tocoo()
cut = np.argsort(-T.data)[:1]
keep = np.ones(len(T.data), bool)
keep[cut] = False
_, lab = connected_components(csr_matrix((T.data[keep], (T.row[keep], T.col[keep])), shape=T.shape), directed=False)
sk = AgglomerativeClustering(n_clusters=2, linkage="single").fit_predict(Xm)
print("Полумесяцы: размеры", np.bincount(lab), " совпадение со sklearn:", max(np.mean(lab == sk), np.mean(lab != sk)))
assert max(np.mean(lab == sk), np.mean(lab != sk)) == 1.0

fig, axes = plt.subplots(1, 2, figsize=(12, 4))
for i, j, k in zip(T.row, T.col, range(len(T.data))):
    axes[0].plot(*zip(Xm[i], Xm[j]), color=MUTED if keep[k] else ORANGE, lw=1.2 if keep[k] else 2.5, ls="-" if keep[k] else "--")
axes[0].scatter(*Xm.T, c=[SERIES[c] for c in lab], s=22, edgecolors="white", linewidths=0.8, zorder=3)
axes[0].set_aspect("equal")
axes[0].set_title("Остовное дерево без самого длинного ребра = 2 кластера")
axes[1].bar(range(1, 13), np.sort(T.data)[::-1][:12], color=[ORANGE] + [SERIES[0]] * 11)
axes[1].set_xlabel("рёбра дерева по убыванию длины")
axes[1].set_ylabel("длина")
axes[1].set_title("«Уступ» длин подсказывает число кластеров")
ex.finish(fig, "trees_and_spanning")
