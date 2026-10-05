"""Обучение в играх: сожаление, Hedge, самоигра, сопоставление сожалений, репликаторная динамика, GDA.

Запуск:  python lessons/lesson_15_21/examples/learning_in_games.py [--save] [--no-show]

1) «Следуй за лидером» против Hedge на враждебной последовательности потерь.
2) Hedge против Hedge в «камень-ножницы-бумага»: средние сходятся, последние кружат; оптимистичный Hedge.
3) Сопоставление сожалений (и «плюс») против фиктивной игры на игре Блотто.
4) Репликаторная динамика КНБ с выигрышем ε за ничью.
5) Градиентный спуск-подъём на f = xy: одновременный, поочерёдный, экстраградиент, оптимистичный.
"""

import sys
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.integrate import solve_ivp

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)
R3 = np.array([[0, -1, 1], [1, 0, -1], [-1, 1, 0]])
exploit = lambda M, p, q: (M @ q).max() - (p @ M).min()

# 1. FTL против Hedge
T = 200
adv = np.array([[0.5, 0]] + [[0, 1] if t % 2 else [1, 0] for t in range(1, T)])
cum, f_loss, h_loss, eta = np.zeros(2), 0.0, 0.0, np.sqrt(8 * np.log(2) / T)
for loss in adv:
    f_loss += loss[np.argmin(cum)]
    w = np.exp(-eta * (cum - cum.min()))
    h_loss += (w / w.sum()) @ loss
    cum += loss
print(f"1) сожаление: FTL {f_loss - cum.min():.1f}, Hedge {h_loss - cum.min():.2f}, гарантия {np.sqrt(T * np.log(2) / 2):.2f}")
assert f_loss - cum.min() == 100 and h_loss - cum.min() < np.sqrt(T * np.log(2) / 2)


# 2. Самоигра Hedge
def self_play(eta, T, optimistic=False):
    L1, L2 = np.log([0.6, 0.25, 0.15]), np.log([0.2, 0.5, 0.3])
    u1p = u2p = np.zeros(3)
    a1, a2, traj = np.zeros(3), np.zeros(3), []
    for _ in range(T):
        p1, p2 = np.exp(L1) / np.exp(L1).sum(), np.exp(L2) / np.exp(L2).sum()
        traj.append(p1)
        u1, u2 = R3 @ p2, -(p1 @ R3)
        a1, a2 = a1 + p1, a2 + p2
        k = 2 if optimistic else 1
        L1, L2 = L1 + eta * (k * u1 - (k - 1) * u1p), L2 + eta * (k * u2 - (k - 1) * u2p)
        u1p, u2p = u1, u2
    return exploit(R3, p1, p2), exploit(R3, a1 / T, a2 / T), np.array(traj)


last, avg, traj = self_play(0.1, 600)
last_o, _, traj_o = self_play(0.3, 600, optimistic=True)
print(f"2) Hedge ↔ Hedge: уязвимость последних {last:.3f}, средних {avg:.3f}; оптимистичный (η = 0.3): последних {last_o:.5f}")
assert avg < 0.05 < last and last_o < 0.01


# 3. Сопоставление сожалений против фиктивной игры на Блотто
alloc = [c for c in product(range(5), repeat=3) if sum(c) == 4]
MB = np.array([[np.sign(np.array(x) - np.array(y)).sum() for y in alloc] for x in alloc], float)


def regret_matching(M, T, plus):
    m = M.shape[0]
    R1, R2 = np.zeros(m), np.zeros(m)
    x, y = np.arange(1, m + 1) / (m * (m + 1) / 2), np.arange(m, 0, -1) / (m * (m + 1) / 2)
    s1, s2, W = np.zeros(m), np.zeros(m), 0.0
    pos = lambda R: np.maximum(R, 0) / np.maximum(R, 0).sum() if np.maximum(R, 0).sum() > 0 else np.ones(m) / m
    for t in range(1, T + 1):
        u1, u2 = M @ y, -(x @ M)
        w = t if plus else 1
        s1, s2, W = s1 + w * x, s2 + w * y, W + w
        R1, R2 = R1 + u1 - x @ u1, R2 + u2 - y @ u2
        if plus:
            R1, R2 = np.maximum(R1, 0), np.maximum(R2, 0)
        x, y = pos(R1), pos(R2)
    return exploit(M, s1 / W, s2 / W)


def fictitious(M, T):
    c1, c2, i, j = np.zeros(len(M)), np.zeros(len(M)), len(M) - 1, 0
    for _ in range(T):
        c1[i] += 1
        c2[j] += 1
        i, j = int(np.argmax(M @ c2)), int(np.argmin(c1 @ M))
    return exploit(M, c1 / T, c2 / T)


rm, rmp, fp = regret_matching(MB, 2000, False), regret_matching(MB, 2000, True), fictitious(MB, 2000)
print(f"3) Блотто 4 на 4, 2000 раундов: RM {rm:.4f}, RM+ {rmp:.4f}, фиктивная игра {fp:.4f}")
assert rmp < fp

# 4. Репликаторная динамика
print("4) КНБ с ничьёй ε:")
ends = {}
for eps in (-0.2, 0.0, 0.2):
    A = R3 + eps * np.eye(3)
    sol = solve_ivp(lambda t, x, A=A: x * (A @ x - x @ A @ x), (0, 60), [0.5, 0.3, 0.2], rtol=1e-9, atol=1e-12)
    ends[eps] = sol.y[:, -1]
    print(f"   ε = {eps:+.1f}: доли через t = 60 {sol.y[:, -1].round(3)}, x₁x₂x₃ = {np.prod(sol.y[:, -1]):.4f} (старт 0.030)")
assert np.allclose(ends[-0.2], 1 / 3, atol=0.02) and ends[0.2].max() > 0.9


# 5. GDA на f = xy
def gda(method, eta=0.2, K=60):
    x, y = 1.5, 1.0
    px, py = y, x
    for _ in range(K):
        if method == "одновременный":
            x, y = x - eta * y, y + eta * x
        elif method == "поочерёдный":
            x = x - eta * y
            y = y + eta * x
        elif method == "экстраградиент":
            xh, yh = x - eta * y, y + eta * x
            x, y = x - eta * yh, y + eta * xh
        else:
            cx, cy = y, x
            x, y = x - eta * (2 * cx - px), y + eta * (2 * cy - py)
            px, py = cx, cy
    return np.hypot(x, y)


dist = {m: gda(m) for m in ["одновременный", "поочерёдный", "экстраградиент", "оптимистичный"]}
print("5) расстояние до равновесия после 60 шагов:", {k: round(v, 3) for k, v in dist.items()})
assert dist["одновременный"] > 5 and dist["экстраградиент"] < 0.6 and dist["оптимистичный"] < 0.6

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.6))
tern = lambda P: (P[:, 1] + P[:, 2] / 2, P[:, 2] * np.sqrt(3) / 2)
for ax, tr, ttl in [(a1, traj, "Hedge ↔ Hedge, η = 0.1"), (a2, traj_o, "оптимистичный Hedge, η = 0.3")]:
    ax.plot([0, 1, 0.5, 0], [0, 0, np.sqrt(3) / 2, 0], color=MUTED, lw=1)
    x, y = tern(tr)
    ax.plot(x, y, color=ORANGE, lw=1, label="текущая стратегия")
    avg_tr = np.cumsum(tr, 0) / np.arange(1, len(tr) + 1)[:, None]
    x, y = tern(avg_tr)
    ax.plot(x, y, color=BLUE, lw=2, label="средняя стратегия")
    ax.set(title=ttl, aspect="equal")
    ax.axis("off")
    ax.legend(fontsize=8, loc="upper right")
ex.finish(fig, "learning_in_games")
