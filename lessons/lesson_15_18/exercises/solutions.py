"""Решения упражнений к уроку 15.18 «Теория графов».

Запуск: python lessons/lesson_15_18/exercises/solutions.py
"""

import heapq
import sys
from collections import deque
from itertools import product
from math import comb, log
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))
sys.stdout.reconfigure(encoding="utf-8")

import lightgbm as lgb
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import floyd_warshall, minimum_spanning_tree

from gbcourse import GBClassifier, GBRegressor
from gbcourse.datasets import friedman1
from gbcourse.metrics import roc_auc
from gbcourse.rng import Mulberry32


def header(t):
    print("\n" + "=" * 8, t)


def adjacency(n, edges):
    adj = [[] for _ in range(n)]
    for a, b in edges:
        adj[a].append(b)
        adj[b].append(a)
    return [sorted(x) for x in adj]


# 1 --------------------------------------------------------------------------------------
header("1. Рукопожатия и Гавел — Хакими")
print("12 человек по 5 рукопожатий:", 12 * 5 // 2, "; 11 человек по 5: сумма", 11 * 5, "нечётна — невозможно")


def havel_hakimi(seq):
    res = list(seq)
    if sum(res) % 2:
        return None
    edges = []
    while True:
        order = sorted((i for i in range(len(res)) if res[i] > 0), key=lambda i: (-res[i], i))
        if not order:
            return edges
        v, d = order[0], res[order[0]]
        if len(order) - 1 < d:
            return None
        res[v] = 0
        for u in order[1:d + 1]:
            res[u] -= 1
            edges.append((v + 1, u + 1))


for s in ([4, 3, 3, 2, 2], [4, 4, 4, 1, 1], [5, 5, 4, 3, 2, 2, 2, 1], [3, 3, 3, 1]):
    E = havel_hakimi(s)
    print(f"  {s}: {'граф: ' + str(E) if E else 'графа нет'}")
assert havel_hakimi([3, 3, 3, 1]) is None and len(havel_hakimi([5, 5, 4, 3, 2, 2, 2, 1])) == 12

# 2 --------------------------------------------------------------------------------------
header("2. Дерево с L листьями")
for L in (31, 64):
    print(f"  L = {L}: внутренних {L - 1}, всего узлов {2 * L - 1}, рёбер {2 * L - 2}")
X, y = friedman1(n=400, noise=1.0, seed=1)
td = lgb.LGBMRegressor(n_estimators=1, num_leaves=31, min_child_samples=5, verbose=-1).fit(X, y).booster_.trees_to_dataframe()
print("  LightGBM, num_leaves = 31: узлов в дереве", len(td), "; минимальная глубина для 64 листьев:", int(np.ceil(np.log2(64))))
assert len(td) == 61

# 3 --------------------------------------------------------------------------------------
header("3. Двудольность одним BFS")


def bipartite(n, edges):
    adj = adjacency(n, edges)
    color, par = [-1] * n, [-1] * n
    for s in range(n):
        if color[s] >= 0:
            continue
        color[s] = 0
        q = deque([s])
        while q:
            v = q.popleft()
            for u in adj[v]:
                if color[u] < 0:
                    color[u], par[u] = 1 - color[v], v
                    q.append(u)
                elif color[u] == color[v]:
                    pu, pv = [u], [v]                 # поднимаемся к общему предку — получаем нечётный цикл
                    while pu[-1] != -1:
                        pu.append(par[pu[-1]])
                    while pv[-1] != -1:
                        pv.append(par[pv[-1]])
                    common = next(x for x in pu if x in pv)
                    cyc = pu[:pu.index(common) + 1] + pv[:pv.index(common)][::-1]
                    return False, cyc
    return True, color


tests = {
    "C6": (6, [(i, (i + 1) % 6) for i in range(6)]),
    "C5": (5, [(i, (i + 1) % 5) for i in range(5)]),
    "K33": (6, [(i, 3 + j) for i in range(3) for j in range(3)]),
    "Петерсен": (10, [(i, (i + 1) % 5) for i in range(5)] + [(i, i + 5) for i in range(5)] + [(5 + i, 5 + (i + 2) % 5) for i in range(5)]),
}
for name, (n, E) in tests.items():
    ok, info = bipartite(n, E)
    print(f"  {name:9} двудольный: {ok}" + ("" if ok else f", нечётный цикл {info} (длина {len(info)})"))
    if not ok:
        assert len(info) % 2 == 1

# 4 --------------------------------------------------------------------------------------
header("4. Краскал и свойство разреза")
E8 = [(0, 1, 4), (0, 4, 7), (1, 2, 8), (1, 5, 3), (0, 5, 6), (2, 3, 5), (2, 6, 2), (3, 7, 9), (4, 5, 10), (5, 6, 1), (6, 7, 11), (3, 6, 12), (1, 4, 13), (2, 5, 14)]
par = list(range(8))


def find(v):
    while par[v] != v:
        par[v] = par[par[v]]
        v = par[v]
    return v


tree = []
for a, b, w in sorted(E8, key=lambda e: e[2]):
    if find(a) != find(b):
        par[find(a)] = find(b)
        tree.append((a, b, w))
W = np.zeros((8, 8))
for a, b, w in E8:
    W[a, b] = w
print("  вес:", sum(w for *_, w in tree), "; scipy:", int(minimum_spanning_tree(csr_matrix(W)).sum()))
rng = Mulberry32(1)
tset = {(a, b) for a, b, _ in tree}
for _ in range(200):
    S = {v for v in range(8) if rng.random() < 0.5}
    if 0 < len(S) < 8:
        cross = [e for e in E8 if (e[0] in S) != (e[1] in S)]
        light = min(cross, key=lambda e: e[2])
        assert (light[0], light[1]) in tset
print("  свойство разреза выполнено на всех случайных разрезах")

# 5 --------------------------------------------------------------------------------------
header("5. Маршруты")
A = np.zeros((4, 4), dtype=int)
for a, b in [(0, 1), (0, 2), (1, 2), (2, 3)]:
    A[a, b] = A[b, a] = 1
cnt = np.array([1, 0, 0, 0])
for k in range(1, 7):
    cnt = A @ cnt                                  # ДП: способы оказаться в вершине после k шагов
    via = np.linalg.matrix_power(A, k)[0, 3]
    print(f"  k = {k}: A^k[A, D] = {via}, ДП = {cnt[3]}")
    assert via == cnt[3]
A3 = np.linalg.matrix_power(A, 3)
print("  замкнутых маршрутов длины 3:", np.trace(A3), "; треугольников:", np.trace(A3) // 6)

# 6 --------------------------------------------------------------------------------------
header("6. Код Прюфера")


def encode(n, edges):
    S = {v: set() for v in range(1, n + 1)}
    for a, b in edges:
        S[a].add(b)
        S[b].add(a)
    code = []
    for _ in range(n - 2):
        leaf = min(v for v in S if len(S[v]) == 1)
        nb = S[leaf].pop()
        S[nb].discard(leaf)
        del S[leaf]
        code.append(nb)
    return code


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


rng = Mulberry32(7)
for _ in range(1000):
    n = 3 + rng.randint(8)
    code = [1 + rng.randint(n) for _ in range(n - 2)]
    assert encode(n, decode(code, n)) == code
for n in range(3, 8):
    trees = {frozenset(map(frozenset, decode(list(c), n))) for c in product(range(1, n + 1), repeat=n - 2)}
    assert len(trees) == n ** (n - 2)
paths6 = sum(1 for c in product(range(1, 7), repeat=4) if len(set(c)) == 4)
print("  encode(decode) = тождество на 1000 деревьях; n^(n−2) подтверждено для n = 3…7")
print(f"  путей среди деревьев на 6 вершинах: {paths6} из {6 ** 4} = {paths6 / 6 ** 4:.3f} (у пути все числа кода различны)")
assert paths6 == 360

# 7 --------------------------------------------------------------------------------------
header("7. Посредничество: Брандес против прямого подсчёта")


def brandes(n, adj):
    bc = [0.0] * n
    for s in range(n):
        S, P, sig, d = [], [[] for _ in range(n)], [0] * n, [-1] * n
        sig[s], d[s] = 1, 0
        q = deque([s])
        while q:
            v = q.popleft()
            S.append(v)
            for u in adj[v]:
                if d[u] < 0:
                    d[u] = d[v] + 1
                    q.append(u)
                if d[u] == d[v] + 1:
                    sig[u] += sig[v]
                    P[u].append(v)
        delta = [0.0] * n
        while S:
            u = S.pop()
            for v in P[u]:
                delta[v] += sig[v] / sig[u] * (1 + delta[u])
            if u != s:
                bc[u] += delta[u]
    return [b / 2 for b in bc]


def direct(n, adj):
    W = np.zeros((n, n))
    for v in range(n):
        for u in adj[v]:
            W[v, u] = 1
    D = floyd_warshall(W, directed=False)

    def sigma(s):
        dist, sg, q = {s: 0}, {s: 1}, deque([s])
        while q:
            x = q.popleft()
            for u in adj[x]:
                if u not in dist:
                    dist[u], sg[u] = dist[x] + 1, 0
                    q.append(u)
                if dist[u] == dist[x] + 1:
                    sg[u] += sg[x]
        return sg

    SG = [sigma(s) for s in range(n)]
    return [sum(SG[s].get(v, 0) * SG[v].get(t, 0) / SG[s][t] for s in range(n) for t in range(s + 1, n)
                if v not in (s, t) and t in SG[s] and np.isfinite(D[s, v] + D[v, t]) and D[s, v] + D[v, t] == D[s, t]) for v in range(n)]


CGe = [(0, 1), (0, 2), (1, 2), (1, 3), (2, 3), (3, 4), (2, 4), (4, 5), (5, 6), (6, 7), (7, 8), (7, 9), (8, 9), (8, 10), (9, 10), (10, 11), (9, 11)]
rng = Mulberry32(4)
ER = [(i, j) for i in range(30) for j in range(i + 1, 30) if rng.random() < 0.15]
for name, n, E in (("две группы", 12, CGe), ("G(30, 0.15)", 30, ER)):
    adj = adjacency(n, E)
    b1, b2 = brandes(n, adj), direct(n, adj)
    print(f"  {name}: максимальное отличие {max(abs(x - y) for x, y in zip(b1, b2)):.2e}; лидер — вершина {int(np.argmax(b1)) + 1}, нормированное {max(b1) / comb(n - 1, 2):.3f}")
    assert np.allclose(b1, b2)

# 8 --------------------------------------------------------------------------------------
header("8. A* против Дейкстры")


def maze_search(grid, astar):
    H, Wd = len(grid), len(grid[0])
    start, goal = (0, 0), (H - 1, Wd - 1)
    h = (lambda c: abs(c[0] - goal[0]) + abs(c[1] - goal[1])) if astar else (lambda c: 0)
    dist, done, cnt, pq = {start: 0}, set(), 0, [(h(start), 0, start)]
    while pq:
        _, _, v = heapq.heappop(pq)
        if v in done:
            continue
        done.add(v)
        if v == goal:
            return dist[v], len(done)
        for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):
            u = (v[0] + dy, v[1] + dx)
            if 0 <= u[0] < H and 0 <= u[1] < Wd and grid[u[0]][u[1]] != "#":
                nd = dist[v] + (5 if grid[u[0]][u[1]] == "~" else 1)
                if nd < dist.get(u, float("inf")):
                    dist[u] = nd
                    cnt += 1
                    heapq.heappush(pq, (nd + h(u), cnt, u))
    return None, len(done)


gains = []
for seed in range(1, 21):
    rng = Mulberry32(seed)
    grid = [["#" if (r := rng.random()) < 0.25 else "~" if r < 0.40 else "." for _ in range(30)] for _ in range(20)]
    grid[0][0] = grid[19][29] = "."
    cd, nd = maze_search(grid, False)
    ca, na = maze_search(grid, True)
    if cd is not None:
        assert cd == ca
        gains.append(1 - na / nd)
print(f"  путь есть в {len(gains)} лабиринтах из 20; стоимости совпадают; A* раскрывает в среднем на {np.mean(gains):.0%} меньше клеток")

# 9 --------------------------------------------------------------------------------------
header("9. Арбитраж")
val = [1, 1.087, 1.264, 0.0067, 1.12]
cur = ["USD", "EUR", "GBP", "JPY", "CHF"]


def arbitrage(gbp_usd):
    rate = {(a, b): float(f"{val[a] / val[b] * 0.999:.5g}") for a in range(5) for b in range(5) if a != b}
    rate[(2, 0)] = gbp_usd
    d, par_, last = [0.0] + [float("inf")] * 4, [None] * 5, None
    for _ in range(5):
        last = None
        for (a, b), r in rate.items():
            if d[a] - log(r) < d[b] - 1e-12:
                d[b], par_[b], last = d[a] - log(r), a, b
    if last is None:
        return None
    v = last
    for _ in range(5):
        v = par_[v]
    cyc, u = [v], par_[v]
    while u != v:
        cyc.append(u)
        u = par_[u]
    cyc = [v] + cyc[::-1]
    return cyc, np.prod([rate[(cyc[i], cyc[i + 1])] for i in range(len(cyc) - 1)])


lo, hi = 1.25, 1.28
while hi - lo > 1e-5:
    mid = (lo + hi) / 2
    lo, hi = (lo, mid) if arbitrage(mid) else (mid, hi)
print(f"  порог арбитража ≈ {hi:.5f}; формула 1.264 / 0.999 = {1.264 / 0.999:.5f}")
cyc, prod = arbitrage(1.27)
print("  при курсе 1.270: цикл", " → ".join(cur[i] for i in cyc), f", прибыль {prod - 1:.3%} за круг")
assert abs(hi - 1.264 / 0.999) < 1e-4

# 10 -------------------------------------------------------------------------------------
header("10. Критический путь")
tasks = ["сбор данных", "разметка", "очистка", "признаки", "базовая модель", "бустинг", "подбор параметров", "отчёт"]
deps = [(0, 1), (0, 2), (2, 3), (1, 4), (2, 4), (3, 5), (1, 5), (5, 6), (4, 7), (6, 7)]


def schedule(dur):
    indeg = [0] * 8
    for _, b in deps:
        indeg[b] += 1
    q, order = deque(i for i in range(8) if indeg[i] == 0), []
    while q:
        v = q.popleft()
        order.append(v)
        for a, b in deps:
            if a == v:
                indeg[b] -= 1
                if indeg[b] == 0:
                    q.append(b)
    ES = [0] * 8
    for v in order:
        for a, b in deps:
            if a == v:
                ES[b] = max(ES[b], ES[v] + dur[v])
    T = max(ES[i] + dur[i] for i in range(8))
    LF = [T] * 8
    for v in reversed(order):
        for a, b in deps:
            if a == v:
                LF[a] = min(LF[a], LF[b] - dur[b])
    return T, ES, LF


dur = [3, 4, 2, 3, 1, 2, 4, 1]
T, ES, LF = schedule(dur)
for i, t in enumerate(tasks):
    print(f"  {t:18} ранний старт {ES[i]:2}, поздний {LF[i] - dur[i]:2}, резерв {LF[i] - dur[i] - ES[i]}")
d7 = dur.copy()
d7[1] = 7
print("  срок:", T, "; если разметка займёт 7 дней:", schedule(d7)[0])
assert T == 15 and schedule(d7)[0] == 17

# 11 -------------------------------------------------------------------------------------
header("11. Честная проверка графовых признаков")


def fraud_graph(seed):
    rng = Mulberry32(seed)
    n = 400
    comm, fraud, x1, x2 = [], [], [], []
    for i in range(n):
        comm.append(rng.randint(6))
        fraud.append(1 if rng.random() < (0.6 if comm[i] < 2 else 0.04) else 0)
        x1.append(rng.normal(0.7 if fraud[i] else 0, 1))
        x2.append(rng.normal(0, 1))
    nb = [[] for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            if rng.random() < (0.08 if comm[i] == comm[j] else 0.003):
                nb[i].append(j)
                nb[j].append(i)
    perm = rng.permutation(n)
    train = [False] * n
    for i in perm[:240]:
        train[i] = True
    return dict(n=n, comm=comm, fraud=fraud, x1=x1, x2=x2, nb=nb, train=train)


def auc(G, train, cols, leak=False):
    F = []
    for i in range(G["n"]):
        tr = [j for j in G["nb"][i] if train[j]]
        ft = sum(G["fraud"][j] for j in tr)
        if leak:
            fa = sum(G["fraud"][j] for j in G["nb"][i])
            F.append([G["x1"][i], G["x2"][i], len(G["nb"][i]), len(tr), fa, fa / max(1, len(G["nb"][i]))])
        else:
            F.append([G["x1"][i], G["x2"][i], len(G["nb"][i]), len(tr), ft, ft / max(1, len(tr))])
    tri = [i for i in range(G["n"]) if train[i]]
    te = [i for i in range(G["n"]) if not train[i]]
    m = GBClassifier(n_estimators=60, learning_rate=0.05, max_depth=2, min_samples_leaf=10)
    m.fit([[F[i][c] for c in cols] for i in tri], [G["fraud"][i] for i in tri])
    return roc_auc([G["fraud"][i] for i in te], m.predict_proba([[F[i][c] for c in cols] for i in te])[:, 1])


res = []
for seed in range(7, 17):
    G = fraud_graph(seed)
    ct = [c in (0, 2, 3) for c in G["comm"]]
    res.append([auc(G, G["train"], [0, 1]), auc(G, G["train"], list(range(6))), auc(G, G["train"], list(range(6)), True),
                auc(G, ct, [0, 1]), auc(G, ct, list(range(6)))])
r = np.array(res).mean(0)
print(f"  случайное: свои {r[0]:.3f}, + графовые {r[1]:.3f}, с утечкой {r[2]:.3f}")
print(f"  по сообществам: свои {r[3]:.3f}, + графовые {r[4]:.3f}")
print("  Для новых сообществ честна оценка по сообществам: у новых счетов нет размеченных соседей, прирост пропадает.")
assert r[2] > r[1] > r[0] and r[4] - r[3] < r[1] - r[0]

# 12 -------------------------------------------------------------------------------------
header("12. Взаимодействия признаков")


def interactions(model, Xd):
    d = Xd.shape[1]
    S = np.zeros((d, d))

    def walk(nodes, i, anc):
        nd = nodes[i]
        if nd.left < 0:
            return
        for f in anc:
            if f != nd.feature:
                S[f, nd.feature] += nd.gain
                S[nd.feature, f] += nd.gain
        walk(nodes, nd.left, anc + [nd.feature])
        walk(nodes, nd.right, anc + [nd.feature])

    for stage in model.trees_:
        for t in stage:
            walk(t.nodes, 0, [])
    bg, pts = Xd[:60], Xd[200:225]
    fp = model.predict(pts)
    var = ((fp - fp.mean()) ** 2).sum()

    def pd(cols):
        o = []
        for p in pts:
            Z = bg.copy()
            Z[:, cols] = p[cols]
            o.append(model.predict(Z).mean())
        o = np.array(o)
        return o - o.mean()

    single = [pd([j]) for j in range(d)]
    Hm = np.zeros((d, d))
    for a in range(d):
        for b in range(a + 1, d):
            Hm[a, b] = ((pd([a, b]) - single[a] - single[b]) ** 2).sum() / var
    return S, Hm


first_depth = None
for depth in (1, 2, 3, 4):
    m = GBRegressor(n_estimators=80, learning_rate=0.1, max_depth=depth, min_samples_leaf=5).fit(X, y)
    S, Hm = interactions(m, X)
    top = lambda M: [f"x{a + 1}–x{b + 1}" for _, a, b in sorted(((M[a, b], a, b) for a in range(10) for b in range(a + 1, 10)), reverse=True)[:3]]
    print(f"  глубина {depth}: пути {top(S) if S.max() > 0 else 'нет пар'}, H² {top(Hm) if Hm.max() > 1e-12 else 'нет'}")
    if first_depth is None and Hm.max() > 1e-12 and top(Hm)[0] == "x1–x2":
        first_depth = depth
print("  H-статистика впервые ставит первой x1–x2 при глубине", first_depth,
      "\n  Мера «вместе на пути» смещена к x4: его делят почти в каждой ветви (большой вклад 10·x4), и он соседствует на путях со всеми.")
assert first_depth == 3
