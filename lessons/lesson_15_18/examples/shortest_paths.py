"""Обходы и кратчайшие пути: BFS, DFS и мосты, Дейкстра, A*, Беллман — Форд, Флойд — Уоршелл.

Запуск:  python lessons/lesson_15_18/examples/shortest_paths.py [--save] [--no-show]

1) BFS и DFS на графе урока; мосты и точки сочленения алгоритмом Тарьяна.
2) Лабиринт с болотом: BFS, Дейкстра и A* — сколько клеток раскрыто и какой ценой.
3) Дейкстра и Беллман — Форд против scipy; арбитраж валют как отрицательный цикл.
4) Флойд — Уоршелл: матрица расстояний, центр и диаметр.
"""

import heapq
import sys
from collections import deque
from math import log
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import ListedColormap
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import bellman_ford, dijkstra, floyd_warshall

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, INK, ORANGE, SURFACE

ex = Example(__file__)
sys.setrecursionlimit(10_000)

# 1. Обходы и мосты
G = {"A": "BCD", "B": "AEF", "C": "ADG", "D": "ACH", "E": "BI", "F": "BI", "G": "CJ", "H": "DJ", "I": "EF", "J": "GH"}
dist, order, q = {"A": 0}, [], deque("A")
while q:
    v = q.popleft()
    order.append(v)
    for u in G[v]:
        if u not in dist:
            dist[u] = dist[v] + 1
            q.append(u)
print("BFS:", "".join(order), " d(J) =", dist["J"])
assert "".join(order) == "ABCDEFGHIJ"

E = [(1, 2), (2, 3), (3, 4), (4, 1), (1, 3), (3, 5), (5, 6), (6, 7), (7, 5), (7, 8), (8, 9), (9, 7), (9, 10)]
adj = {}
for a, b in E:
    adj.setdefault(a, []).append(b)
    adj.setdefault(b, []).append(a)
tin, low, t, bridges, cut = {}, {}, [0], [], set()


def tarjan(v, parent):
    t[0] += 1
    tin[v] = low[v] = t[0]
    kids = 0
    for u in sorted(adj[v]):
        if u == parent:
            continue
        if u not in tin:
            kids += 1
            tarjan(u, v)
            low[v] = min(low[v], low[u])
            if low[u] > tin[v]:
                bridges.append((v, u))
            if parent is not None and low[u] >= tin[v]:
                cut.add(v)
        else:
            low[v] = min(low[v], tin[u])
    if parent is None and kids > 1:
        cut.add(v)


tarjan(1, None)
print("мосты:", sorted(bridges), " точки сочленения:", sorted(cut))
assert sorted(bridges) == [(3, 5), (9, 10)] and sorted(cut) == [3, 5, 7, 9]

# 2. Лабиринт
maze = [".....#............", ".....#............", ".....#....~~~~~...", ".....#....~~~~~...", ".....#....~~~~~...",
        ".S........~~~~~.G.", ".....#....~~~~~...", ".....#....~~~~~...", ".....#....~~~~~...", ".....#............", ".....#............"]
H, W = len(maze), len(maze[0])
find = lambda ch: next((y, x) for y in range(H) for x in range(W) if maze[y][x] == ch)
start, goal = find("S"), find("G")
cost = lambda c: 5 if maze[c[0]][c[1]] == "~" else 1


def nbrs(c):
    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        Y, X = c[0] + dy, c[1] + dx
        if 0 <= Y < H and 0 <= X < W and maze[Y][X] != "#":
            yield (Y, X)


def search(kind):
    h = (lambda c: abs(c[0] - goal[0]) + abs(c[1] - goal[1])) if kind == "A*" else (lambda c: 0)
    expanded = []
    if kind == "BFS":
        parent, qq = {start: None}, deque([start])
        while qq:
            v = qq.popleft()
            expanded.append(v)
            if v == goal:
                break
            for u in nbrs(v):
                if u not in parent:
                    parent[u] = v
                    qq.append(u)
    else:
        dd, parent, done, cnt, pq = {start: 0}, {}, set(), 0, [(h(start), 0, start, None)]
        while pq:
            _, _, v, frm = heapq.heappop(pq)
            if v in done:
                continue
            done.add(v)
            expanded.append(v)
            parent[v] = frm
            if v == goal:
                break
            for u in nbrs(v):
                nd = dd[v] + cost(u)
                if nd < dd.get(u, float("inf")):
                    dd[u] = nd
                    cnt += 1
                    heapq.heappush(pq, (nd + h(u), cnt, u, v))
    path, c = [], goal
    while c is not None:
        path.append(c)
        c = parent[c]
    return expanded, path[::-1]


results = {k: search(k) for k in ("BFS", "Дейкстра", "A*")}
print("\nЛабиринт:")
for k, (expd, path) in results.items():
    print(f"  {k:9} раскрыто {len(expd):3}, шагов {len(path) - 1}, стоимость {sum(cost(c) for c in path[1:])}")
assert len(results["A*"][0]) < len(results["Дейкстра"][0])
assert sum(cost(c) for c in results["A*"][1][1:]) == sum(cost(c) for c in results["Дейкстра"][1][1:]) == 23

# 3. Дейкстра и Беллман — Форд против scipy; арбитраж
names = "SABCDET"
E12 = [("S", "A", 4), ("S", "B", 2), ("A", "B", 1), ("A", "C", 5), ("B", "C", 8), ("B", "D", 10), ("C", "D", 2), ("C", "E", 3), ("D", "T", 6), ("E", "T", 1)]
Wm = np.zeros((7, 7))
for a, b, w in E12:
    Wm[names.index(a), names.index(b)] = w
print("\nДейкстра (scipy), расстояния от S:", dijkstra(Wm, directed=False, indices=0))
neg = np.zeros((5, 5))
for a, b, w in [(0, 1, 2), (0, 2, 4), (2, 1, -4), (1, 3, 3), (3, 4, 2), (2, 4, 6)]:
    neg[a, b] = w
bf = bellman_ford(csr_matrix(neg), indices=0)
print("С отрицательным ребром B → A = −4: Беллман — Форд (scipy)", bf, "— Дейкстра здесь неприменима")
assert list(bf) == [0, 0, 4, 3, 5]

val = [1, 1.087, 1.264, 0.0067, 1.12]
cur = ["USD", "EUR", "GBP", "JPY", "CHF"]
for gbp_usd in (1.260, 1.270):
    rate = {(a, b): float(f"{val[a] / val[b] * 0.999:.5g}") for a in range(5) for b in range(5) if a != b}
    rate[(2, 0)] = gbp_usd
    d, upd = [0.0] + [float("inf")] * 4, False
    for _ in range(5):
        upd = False
        for (a, b), r in rate.items():
            if d[a] - log(r) < d[b] - 1e-12:
                d[b], upd = d[a] - log(r), True
    print(f"курс GBP→USD = {gbp_usd}: {'арбитраж есть' if upd else 'арбитража нет'}")
    assert upd == (gbp_usd > 1.264 / 0.999)

# 4. Флойд — Уоршелл
FW = [(0, 1, 3), (0, 2, 8), (1, 2, 2), (1, 3, 5), (2, 4, 4), (3, 4, 1), (3, 5, 6), (4, 5, 2)]
W6 = np.zeros((6, 6))
for a, b, w in FW:
    W6[a, b] = w
D = floyd_warshall(W6, directed=False)
ecc = D.max(1)
print("\nФлойд — Уоршелл: диаметр", ecc.max(), " центр", "ABCDEF"[int(ecc.argmin())], "с эксцентриситетом", ecc.min())
assert ecc.max() == 11 and ecc.argmin() == 2

fig, axes = plt.subplots(1, 3, figsize=(13, 3.4))
base = np.array([[{"#": 3, "~": 1}.get(ch, 0) for ch in row] for row in maze], float)
for ax, (k, (expd, path)) in zip(axes, results.items()):
    img = base.copy()
    for c in expd:
        if img[c] == 0:
            img[c] = 2
    ax.imshow(img, cmap=ListedColormap([SURFACE, AQUA, "#b7d3f6", INK]), vmin=0, vmax=3)
    ax.plot([c[1] for c in path], [c[0] for c in path], color=ORANGE, lw=3)
    ax.scatter([start[1], goal[1]], [start[0], goal[0]], color=[BLUE, ORANGE], s=60, zorder=3)
    ax.set_title(f"{k}: {len(expd)} клеток, цена {sum(cost(c) for c in path[1:])}", fontsize=11)
    ax.set_xticks([])
    ax.set_yticks([])
fig.suptitle("Лабиринт с болотом (бирюзовое, стоимость 5): голубым — раскрытые клетки")
ex.finish(fig, "shortest_paths")
