"""Биты и энтропия: вопросы «да/нет», взвешивания, вогнутость энтропии и смещение её оценки по выборке.

Запуск:  python lessons/lesson_15_16/examples/bits_and_entropy.py [--save] [--no-show]

1) Угадай число: худшее число вопросов для трёх стратегий (пополам, отрезать ¼, по одному) при разных N.
2) Взвешивания: три кучки против «пополам» — log₃ N против ≈ log₂ N.
3) Бинарная энтропия, Джини и разрыв вогнутости = прирост информации разбиения.
4) Оценка энтропии по частотам (Mulberry32, 400 повторов) и поправка Миллера — Мэдоу.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, RED, VIOLET

ex = Example(__file__)


def h(p):
    p = np.asarray(p, float)
    out = np.where((p > 0) & (p < 1), -p * np.log2(np.clip(p, 1e-300, 1)) - (1 - p) * np.log2(np.clip(1 - p, 1e-300, 1)), 0.0)
    return float(out) if out.ndim == 0 else out


# 1. Угадай число
def questions(N, secret, strat):
    lo, hi, k = 1, N, 0
    while lo < hi:
        m = hi - lo + 1
        left = {"half": math.ceil(m / 2), "quarter": max(1, math.floor(m / 4 + 0.5)), "linear": 1}[strat]
        t = lo + left - 1
        hi, lo = (t, lo) if secret <= t else (hi, t + 1)
        k += 1
    return k


Ns = [4, 8, 16, 32, 64, 128, 256]
worst = {s: [max(questions(N, x, s) for x in range(1, N + 1)) for N in Ns] for s in ("half", "quarter", "linear")}
for s, v in worst.items():
    print(f"{s:8s}: худший случай {v}")
assert worst["half"] == [math.ceil(math.log2(N)) for N in Ns]


# 2. Взвешивания
def weighings(N, fake, strat):
    cand, k = list(range(1, N + 1)), 0
    while len(cand) > 1:
        m = len(cand)
        a = math.ceil(m / 3) if strat == "three" else m // 2
        L, R, rest = cand[:a], cand[a:2 * a], cand[2 * a:]
        cand = L if fake in L else R if fake in R else rest
        k += 1
    return k


for N in (9, 27, 81):
    w3 = max(weighings(N, f, "three") for f in range(1, N + 1))
    w2 = max(weighings(N, f, "two") for f in range(1, N + 1))
    print(f"N = {N:2d}: три кучки — {w3}, пополам — {w2}, нижняя граница log3 N = {math.log(N, 3):.2f}")
    assert w3 == round(math.log(N, 3))

# 3. Вогнутость: разрыв = прирост информации
p1, p2, a = 0.9, 0.1, 0.5
gap = h(a * p1 + (1 - a) * p2) - a * h(p1) - (1 - a) * h(p2)
print(f"смесь 0.9 и 0.1 поровну: h = 1, группы — {h(0.9):.3f}, разрыв (прирост информации) {gap:.3f}")
assert abs(gap - 0.531) < 1e-3


# 4. Смещение оценки энтропии
def sims(p, n, R=400, seed=2026):
    rng, cum = Mulberry32(seed), np.cumsum(p)
    plug, mm = [], []
    for _ in range(R):
        cnt = np.zeros(len(p), int)
        for _ in range(n):
            u = rng.random()
            cnt[min(int(np.searchsorted(cum, u, side="right")), len(p) - 1)] += 1
        f = cnt[cnt > 0] / n
        hh = -(f * np.log2(f)).sum()
        plug.append(hh)
        mm.append(hh + (len(f) - 1) / (2 * n * math.log(2)))
    return np.mean(plug), np.mean(mm)


ns = [5, 10, 20, 50, 100, 200]
est = [sims([1 / 8] * 8, n) for n in ns]
for n, (a_, b_) in zip(ns, est):
    print(f"n = {n:3d}: по частотам {a_:.3f}, с поправкой {b_:.3f} (истина 3)")
assert round(est[2][0], 3) == 2.716 and round(est[2][1], 3) == 2.948

fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))
ax = axes[0]
for s, col, lab in (("half", BLUE, "пополам"), ("quarter", ORANGE, "отрезать ¼"), ("linear", RED, "по одному")):
    ax.semilogx(Ns, worst[s], "o-", color=col, base=2, label=lab)
ax.semilogx(Ns, np.log2(Ns), "--", color=MUTED, base=2, label="log₂ N")
ax.set(xlabel="вариантов N", ylabel="вопросов в худшем случае", title="Каждый вопрос — не больше бита", yscale="log")
ax.legend()

ax = axes[1]
xs = np.linspace(0, 1, 401)
ax.plot(xs, h(xs), color=BLUE, label="энтропия h(p), бит")
ax.plot(xs, 4 * xs * (1 - xs), color=VIOLET, label="Джини × 2: 4p(1 − p)")
ax.plot([p2, p1], [h(p2), h(p1)], color=MUTED)
ax.plot([0.5, 0.5], [h(0.9), 1], color=RED, lw=4, label="разрыв = прирост информации")
ax.set(xlabel="доля класса 1", ylabel="неопределённость", title="Вогнутость: смесь неопределённее")
ax.legend(fontsize=8)

ax = axes[2]
ax.semilogx(ns, [e[0] for e in est], "o-", color=BLUE, label="по частотам")
ax.semilogx(ns, [e[1] for e in est], "o-", color=AQUA, label="с поправкой Миллера — Мэдоу")
ax.axhline(3, color="k", ls="--", lw=1, label="истина: 3 бита")
ax.set(xlabel="размер выборки n", ylabel="средняя оценка, бит", title="Оценка по выборке занижена")
ax.legend()

ex.finish(fig, "bits_and_entropy")
