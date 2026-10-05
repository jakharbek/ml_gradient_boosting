"""Игры с нулевой суммой: седло, линейное программирование, фиктивная игра, минимаксная оценка.

Запуск:  python lessons/lesson_15_21/examples/zero_sum_lp.py [--save] [--no-show]

1) Максимин и минимакс в чистых стратегиях: седловая точка.
2) Решение матричных игр через scipy.optimize.linprog (стратегии обоих игроков, двойственность).
3) Прятки и полковник Блотто.
4) Фиктивная игра Брауна — Робинсон: оценки зажимают цену игры.
5) Минимаксная оценка вероятности: постоянный риск.
"""

import sys
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.optimize import linprog

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)


def solve(M):
    M = np.asarray(M, float)
    m, n = M.shape
    r1 = linprog(np.r_[np.zeros(m), -1], A_ub=np.c_[-M.T, np.ones(n)], b_ub=np.zeros(n),
                 A_eq=[np.r_[np.ones(m), 0]], b_eq=[1], bounds=[(0, None)] * m + [(None, None)])
    r2 = linprog(np.r_[np.zeros(n), 1], A_ub=np.c_[M, -np.ones(m)], b_ub=np.zeros(m),
                 A_eq=[np.r_[np.ones(n), 0]], b_eq=[1], bounds=[(0, None)] * n + [(None, None)])
    return r1.x[:m], r2.x[:n], r1.x[-1], r2.x[-1]


# 1. Седло
S = np.array([[3, 1, 4, 2], [2, 0, 1, -1], [5, 2, 6, 3]])
A = np.array([[3, -1, 2], [-2, 2, 1]])
for name, M in (("с седлом", S), ("игра A", A)):
    print(f"1) {name}: максимин {M.min(1).max()}, минимакс {M.max(0).min()}")
assert S.min(1).max() == S.max(0).min() == 2 and (A.min(1).max(), A.max(0).min()) == (-1, 2)

# 2. ЛП и двойственность
p, q, v, w = solve(A)
print(f"2) игра A: p* = {p.round(4)}, q* = {q.round(4)}, v = {v:.4f} = w = {w:.4f}")
assert np.allclose([v, w], 0.5) and np.allclose(q, [3 / 8, 5 / 8, 0], atol=1e-7)
assert (p @ A >= v - 1e-9).all() and (A @ q <= v + 1e-9).all()

# 3. Прятки и Блотто
d = np.array([0.9, 0.6, 0.3])
p, q, v, _ = solve(np.diag(d))
print(f"3) прятки: v = {v:.4f} (1/Σ(1/d) = {1 / (1 / d).sum():.4f}), p* = {p.round(4)}")
assert abs(v - 9 / 55) < 1e-9 and np.allclose(p, (1 / d) / (1 / d).sum())
alloc = lambda s: [c for c in product(range(s + 1), repeat=3) if sum(c) == s]
for sa, sb in [(4, 4), (4, 3), (5, 5)]:
    RA, RB = alloc(sa), alloc(sb)
    MB = np.array([[np.sign(np.array(x) - np.array(y)).sum() for y in RB] for x in RA])
    p, _, v, _ = solve(MB)
    print(f"   Блотто {sa} против {sb}: {len(RA)}×{len(RB)}, цена {v:+.4f}, расстановки в смеси: {[RA[i] for i in np.flatnonzero(p > 1e-9)]}")
    if sa == sb:
        assert abs(v) < 1e-9


# 4. Фиктивная игра
def fictitious(M, T):
    c1, c2, i, j, lo, hi = np.zeros(M.shape[0]), np.zeros(M.shape[1]), 0, 0, [], []
    for t in range(1, T + 1):
        c1[i] += 1
        c2[j] += 1
        lo.append((c1 @ M).min() / t)
        hi.append((M @ c2).max() / t)
        i, j = int(np.argmax(M @ c2)), int(np.argmin(c1 @ M))
    return np.array(lo), np.array(hi)


lo, hi = fictitious(np.diag(d), 5000)
print(f"4) фиктивная игра (прятки, 5000 раундов): {lo[-1]:.4f} ≤ {9 / 55:.4f} ≤ {hi[-1]:.4f}")
assert lo[-1] <= 9 / 55 <= hi[-1] and hi[-1] - lo[-1] < 0.01

# 5. Минимаксная оценка
n = 10
pp = np.linspace(0, 1, 2001)
risk = lambda a: (n * pp * (1 - pp) + a**2 * (1 - 2 * pp) ** 2) / (n + 2 * a) ** 2
print(f"5) n = 10: худший риск X/n {risk(0).max():.4f}, Лапласа {risk(1).max():.4f}, минимаксной {risk(np.sqrt(n) / 2).max():.4f}")
assert np.ptp(risk(np.sqrt(n) / 2)) < 1e-15 and risk(np.sqrt(n) / 2).max() < risk(1).max() < risk(0).max()

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
t = np.arange(1, 5001)
a1.plot(t, hi, color=ORANGE, label="max по строкам (M·q̄)")
a1.plot(t, lo, color=BLUE, label="min по столбцам (p̄·M)")
a1.axhline(9 / 55, color=MUTED, ls="--", label="цена 9/55")
a1.set(xscale="log", xlabel="раунд", ylabel="выигрыш", title="Фиктивная игра в прятках")
a1.legend(fontsize=8)
for a, c, lab in [(0, BLUE, "X/n"), (1, ORANGE, "Лаплас (a = 1)"), (np.sqrt(n) / 2, MUTED, "минимаксная a = √n/2")]:
    a2.plot(pp, risk(a), color=c, lw=2, label=lab)
a2.set(xlabel="истинная p", ylabel="риск E(оценка − p)²", title="Игра с природой, n = 10")
a2.legend(fontsize=8)
ex.finish(fig, "zero_sum_lp")
