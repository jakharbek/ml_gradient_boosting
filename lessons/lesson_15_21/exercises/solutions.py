"""Решения упражнений к уроку 15.21 «Теория игр».

Запуск:  python lessons/lesson_15_21/exercises/solutions.py [--save] [--no-show]
"""

import math
import sys
from fractions import Fraction as F
from itertools import combinations, permutations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.optimize import linprog

from gbcourse import AdaBoost
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)


def pure_ne(A, B):
    A, B = np.asarray(A), np.asarray(B)
    return [(i, j) for i in range(A.shape[0]) for j in range(A.shape[1]) if A[i, j] == A[:, j].max() and B[i, j] == B[i, :].max()]


print("=== 1. Доминирование")
A1 = np.array([[3, 0, 0.5], [2, 1, 1], [1, 0, 0]])
B1 = np.array([[1, 2, 0], [0, 1, 2], [3, 2, 1]])
R, C = [0, 1, 2], [0, 1, 2]
while True:
    r = next((b for b in R for a in R if a != b and (A1[a, C] > A1[b, C]).all()), None)
    if r is not None:
        R.remove(r)
        continue
    c = next((b for b in C for a in C if a != b and (B1[R, a] > B1[R, b]).all()), None)
    if c is None:
        break
    C.remove(c)
print("остаётся", R, C, " равновесия Нэша:", pure_ne(A1, B1))
assert (R, C) == ([1], [2]) and pure_ne(A1, B1) == [(1, 2)]

print("=== 2. Зоопарк 2×2")
for T, S in [(1.5, -0.5), (1.5, 0.5), (0.5, -0.5), (0.5, 0.5)]:
    A = np.array([[1, S], [T, 0]])
    ne = pure_ne(A, A.T)
    den = S + T - 1
    mixed = S / den if den and 0 < S / den < 1 else None
    kind = "дилемма" if T > 1 and S < 0 else "ястреб и голубь" if T > 1 else "охота на оленя" if S < 0 else "гармония"
    if mixed is not None:   # проверка безразличия: сотрудничать и предавать дают поровну
        assert abs(mixed * 1 + (1 - mixed) * S - mixed * T) < 1e-12
    print(f"T = {T}, S = {S}: {kind:16} чистые {ne}, смешанное P(С) = {mixed}")

print("=== 3. Смешанное равновесие и бонус")
for b in (-1, 0, 1, 2):
    A = [[2 + b, 0], [0, 1]]
    B = [[1, 0], [0, 2]]
    p = F(B[1][1] - B[1][0], B[0][0] - B[1][0] - B[0][1] + B[1][1])
    q = F(A[1][1] - A[0][1], A[0][0] - A[0][1] - A[1][0] + A[1][1])
    print(f"бонус {b:+}: p* = {p}, q* = {q}")
    assert p == F(2, 3) and q == F(1, 3 + b)
print("выигрыши без бонуса: 2·q = p·1 =", 2 * F(1, 3))

print("=== 4. Цена игры 2×2")


def lp_value(M):
    M = np.asarray(M, float)
    m, n = M.shape
    r = linprog(np.r_[np.zeros(m), -1], A_ub=np.c_[-M.T, np.ones(n)], b_ub=np.zeros(n),
                A_eq=[np.r_[np.ones(m), 0]], b_eq=[1], bounds=[(0, None)] * m + [(None, None)])
    return r.x[0], r.x[-1]


rng = Mulberry32(4)
checked = 0
while checked < 1000:
    a, b, c, d = (rng.uniform(-5, 5) for _ in range(4))
    M = np.array([[a, b], [c, d]])
    if M.min(1).max() >= M.max(0).min() - 1e-9:
        continue   # есть седло — формула не нужна
    p, v = lp_value(M)
    den = a - b - c + d
    assert abs(p - (d - c) / den) < 1e-6 and abs(v - (a * d - b * c) / den) < 1e-6
    checked += 1
print("формулы p* и v совпали с linprog на 1000 матрицах без седла")

print("=== 5. Перебор носителей")


def support_enum(A, B):
    A, B = np.asarray(A, float), np.asarray(B, float)
    m, n = A.shape
    found = []
    for k in range(1, min(m, n) + 1):
        for rows_ in combinations(range(m), k):
            for J in combinations(range(n), k):
                Mq = np.block([[A[np.ix_(rows_, J)], -np.ones((k, 1))], [np.ones((1, k)), np.zeros((1, 1))]])
                Mp = np.block([[B[np.ix_(rows_, J)].T, -np.ones((k, 1))], [np.ones((1, k)), np.zeros((1, 1))]])
                rhs = np.r_[np.zeros(k), 1]
                try:
                    sq, sp = np.linalg.solve(Mq, rhs), np.linalg.solve(Mp, rhs)
                except np.linalg.LinAlgError:
                    continue
                q, p = np.zeros(n), np.zeros(m)
                q[list(J)], p[list(rows_)] = sq[:k], sp[:k]
                if (q < -1e-9).any() or (p < -1e-9).any() or (A @ q > sq[k] + 1e-9).any() or (p @ B > sp[k] + 1e-9).any():
                    continue
                if not any(np.allclose(p, x) and np.allclose(q, y) for x, y in found):
                    found.append((p, q))
    return found


assert len(support_enum(np.diag([3, 2, 1]), np.diag([3, 2, 1]))) == 7
rng = Mulberry32(5)
counts = []
for _ in range(200):
    A = np.array([[rng.randint(10) for _ in range(3)] for _ in range(3)])
    B = np.array([[rng.randint(10) for _ in range(3)] for _ in range(3)])
    counts.append(len(support_enum(A, B)))
odd = sum(c % 2 for c in counts)
print(f"координация: 7 равновесий; 200 случайных игр: нечётное число у {odd}, распределение {np.bincount(counts)}")
print("чётное число бывает из-за вырожденности: целые выигрыши дают равенства, и равновесия сливаются или образуют отрезки")

print("=== 6. Коррелированное равновесие")
A = np.array([[0, 7], [2, 6]])
B = A.T
G = np.array([[A[0, 0] - A[1, 0], A[0, 1] - A[1, 1], 0, 0], [0, 0, A[1, 0] - A[0, 0], A[1, 1] - A[0, 1]],
              [B[0, 0] - B[0, 1], 0, B[1, 0] - B[1, 1], 0], [0, B[0, 1] - B[0, 0], 0, B[1, 1] - B[1, 0]]])
for name, obj in [("сумма", (A + B).ravel()), ("игрок 1", A.ravel())]:
    r = linprog(-obj, A_ub=-G, b_ub=np.zeros(4), A_eq=[np.ones(4)], b_eq=[1], bounds=[(0, 1)] * 4)
    x = r.x
    print(f"максимум «{name}»: x = {x.round(4)}, выигрыши {x @ A.ravel():.3f}, {x @ B.ravel():.3f}")
print("равновесия Нэша: (7, 2), (2, 7), (14/3, 14/3)")

print("=== 7. Hedge и сожаление")


def regrets(losses):
    T, n = losses.shape
    eta = np.sqrt(8 * np.log(n) / T)
    cum, ftl, hed = np.zeros(n), 0.0, 0.0
    for loss in losses:
        ftl += loss[np.argmin(cum)]
        w = np.exp(-eta * (cum - cum.min()))
        hed += (w / w.sum()) @ loss
        cum += loss
    return ftl - cum.min(), hed - cum.min(), np.sqrt(T * np.log(n) / 2)


T = 1000
adv = np.array([[0.5, 0]] + [[0, 1] if t % 2 else [1, 0] for t in range(1, T)])
rng = Mulberry32(7)
iid = np.array([[float(rng.random() < 0.4), float(rng.random() < 0.6)] for _ in range(T)])
for name, L in [("враждебные", adv), ("случайные", iid)]:
    f_, h_, g_ = regrets(L)
    print(f"{name}: FTL {f_:.1f}, Hedge {h_:.2f}, гарантия {g_:.2f}")
    assert h_ <= g_

print("=== 8. Самоигра")
R3 = np.array([[0, -1, 1], [1, 0, -1], [-1, 1, 0]], float)
exploit = lambda p, q: (R3 @ q).max() - (p @ R3).min()
L1, L2 = np.log([0.6, 0.25, 0.15]), np.log([0.2, 0.5, 0.3])
a1, a2, ex_last, ex_avg = np.zeros(3), np.zeros(3), [], []
for t in range(1, 2001):
    p1, p2 = np.exp(L1) / np.exp(L1).sum(), np.exp(L2) / np.exp(L2).sum()
    a1, a2 = a1 + p1, a2 + p2
    ex_last.append(exploit(p1, p2))
    ex_avg.append(exploit(a1 / t, a2 / t))
    L1, L2 = L1 + 0.1 * (R3 @ p2), L2 - 0.1 * (p1 @ R3)
Rg1, Rg2 = np.zeros(3), np.zeros(3)
x, y = np.array([0.6, 0.25, 0.15]), np.array([0.2, 0.5, 0.3])
s1, s2 = np.zeros(3), np.zeros(3)
pos = lambda Rg: np.maximum(Rg, 0) / np.maximum(Rg, 0).sum() if np.maximum(Rg, 0).sum() > 0 else np.ones(3) / 3
for _ in range(2000):
    u1, u2 = R3 @ y, -(x @ R3)
    s1, s2 = s1 + x, s2 + y
    Rg1, Rg2 = Rg1 + u1 - x @ u1, Rg2 + u2 - y @ u2
    x, y = pos(Rg1), pos(Rg2)
print(f"Hedge: последние {ex_last[-1]:.3f}, средние {ex_avg[-1]:.4f}; сопоставление сожалений, средние {exploit(s1 / 2000, s2 / 2000):.4f}")
assert ex_avg[-1] < ex_last[-1]

print("=== 9. Турнир Аксельрода")
PAY = [[3, 0], [5, 1]]
ST = {
    "всегда сотрудничать": lambda me, op, rng: 0,
    "всегда предавать": lambda me, op, rng: 1,
    "око за око": lambda me, op, rng: op[-1] if op else 0,
    "случайно": lambda me, op, rng: 0 if rng.random() < 0.5 else 1,
    "щедрое око за око": lambda me, op, rng: (0 if rng.random() < 1 / 3 else 1) if op and op[-1] else 0,
}


def tournament(names, noise):
    fs = [ST[k] for k in names]
    W = np.zeros((len(fs), len(fs)))
    for i in range(len(fs)):
        for j in range(i, len(fs)):
            rng = Mulberry32(1000 + 37 * i + j)
            a, b, sa, sb = [], [], 0, 0
            for _ in range(200):
                u, v = fs[i](a, b, rng), fs[j](b, a, rng)
                if noise > 0:
                    if rng.random() < noise:
                        u = 1 - u
                    if rng.random() < noise:
                        v = 1 - v
                a.append(u)
                b.append(v)
                sa += PAY[u][v]
                sb += PAY[v][u]
            W[i, j], W[j, i] = sa / 200, sb / 200
    return dict(zip(names, W.mean(1).round(3)))


four = ["всегда сотрудничать", "всегда предавать", "око за око", "случайно"]
res4 = tournament(four, 0)
print("четыре стратегии:", res4)
# в таком маленьком поле побеждает «всегда предавать»: половина соперников — «простак» и «случайно»,
# на которых он наживается; «око за око» второе. Итог турнира зависит от состава участников.
assert max(res4, key=res4.get) == "всегда предавать" and sorted(res4, key=res4.get)[-2] == "око за око"
print("пять стратегий, шум 5 %:", tournament(four + ["щедрое око за око"], 0.05))

print("=== 10. Торг Рубинштейна")
# неподвижная точка: x₁ = 1 − δ₂ x₂, x₂ = 1 − δ₁ x₁ ⇒ x₁ = (1 − δ₂)/(1 − δ₁δ₂)
for d1, d2 in [(0.9, 0.9), (0.9, 0.5), (0.5, 0.9)]:
    share = 1.0
    for k in range(2, 201):
        share = 1 - (d2 if (200 - k) % 2 == 0 else d1) * share
    print(f"δ = ({d1}, {d2}): T = 200 → {share:.4f}, формула {(1 - d2) / (1 - d1 * d2):.4f}")
    assert abs(share - (1 - d2) / (1 - d1 * d2)) < 1e-6

print("=== 11. Шепли для 4 признаков")
f4 = lambda S: (0 in S) + 2 * (1 in S) + 3 * (0 in S) * (2 in S)
fa = lambda S: (0 in S) + 2 * (1 in S)
fb = lambda S: 3 * (0 in S) * (2 in S)


def sh_orders(v, n=4):
    phi = [F(0)] * n
    for order in permutations(range(n)):
        S = set()
        for j in order:
            phi[j] += F(v(S | {j}) - v(S), math.factorial(n))
            S.add(j)
    return phi


def sh_coal(v, n=4):
    return [sum(F(math.factorial(k) * math.factorial(n - k - 1), math.factorial(n)) * (v(set(S) | {j}) - v(set(S)))
                for k in range(n) for S in combinations([i for i in range(n) if i != j], k)) for j in range(n)]


phi = sh_orders(f4)
assert phi == sh_coal(f4) == [F(5, 2), 2, F(3, 2), 0]
assert sum(phi) == f4({0, 1, 2, 3}) and phi[3] == 0
assert phi == [a + b for a, b in zip(sh_orders(fa), sh_orders(fb))]
print("φ =", [str(x) for x in phi], "— эффективность, болванчик и аддитивность выполнены")
exact = np.array([float(x) for x in phi])
Ks, errs = [10, 100, 1000], []
for K in Ks:
    e = []
    for r in range(30):
        rng = Mulberry32(500 + r)
        acc = np.zeros(4)
        for _ in range(K):
            S = set()
            for j in rng.permutation(4):
                acc[j] += f4(S | {j}) - f4(S)
                S.add(j)
        e.append(np.abs(acc / K - exact).mean())
    errs.append(np.mean(e))
print("ошибка выборки порядков:", dict(zip(Ks, np.round(errs, 4))))
assert errs[1] < errs[0] / 2 and errs[2] < errs[1] / 2

print("=== 12. AdaBoost как игра")
rng = Mulberry32(21)
xs = sorted(rng.uniform(0, 10) for _ in range(40))
ys = []
for xi in xs:
    yi = 1 if 3 < xi < 7 else 0
    ys.append(1 - yi if rng.random() < 0.08 else yi)
X, y = np.array(xs)[:, None], np.array(ys)
ada = AdaBoost(n_estimators=40, max_depth=1).fit(X, y)
s = np.where(y == 1, 1, -1)
errs, bounds, first_zero = [], [], None
for m in range(1, len(ada.trees_) + 1):
    Fm = ada.decision_function(X, m)
    w = np.exp(-s * Fm)
    assert np.allclose(w / w.sum(), ada.weights_[m])
    pred = np.where(ada.trees_[m - 1].predict(X) >= 0, 1, -1)
    assert abs(ada.weights_[m][pred != s].sum() - 0.5) < 1e-12   # прошлый пень стал «монеткой»
    err = np.mean((Fm > 0) != (y == 1))
    e = np.array(ada.errors_[:m])
    bound = np.prod(2 * np.sqrt(e * (1 - e)))
    assert err <= bound + 1e-12
    errs.append(err)
    bounds.append(bound)
    if err == 0 and first_zero is None:
        first_zero = m
print(f"все проверки пройдены; ошибка впервые нулевая на раунде {first_zero}")

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
a1.plot(range(1, 2001), ex_last, color=MUTED, lw=1, label="последние стратегии")
a1.plot(range(1, 2001), ex_avg, color=BLUE, lw=2, label="средние стратегии")
a1.set(yscale="log", xlabel="раунд", ylabel="уязвимость", title="Упр. 8: Hedge ↔ Hedge")
a1.legend(fontsize=8)
a2.plot(range(1, len(errs) + 1), errs, color=BLUE, lw=2, label="ошибка на обучении")
a2.plot(range(1, len(errs) + 1), bounds, color=ORANGE, ls="--", label="Π 2√(ε(1 − ε))")
a2.set(xlabel="раунд", title="Упр. 12: AdaBoost", ylim=(0, 1))
a2.legend(fontsize=8)
ex.finish(fig, "solutions")
