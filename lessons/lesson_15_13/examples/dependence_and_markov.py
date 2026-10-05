"""Несколько величин: совместная таблица, условное среднее и разложение дисперсии, корреляция, цепь Маркова.

Запуск:  python lessons/lesson_15_13/examples/dependence_and_markov.py [--save] [--no-show]

1) Дождь и зонт: маргинальные и условные распределения, проверка независимости.
2) Условное среднее по корзинам: Var Y = внутри + между; выигрыш разбиения = n · дисперсия между группами.
3) Корреляция ловит только линейную связь: парабола и кольцо дают ρ ≈ 0.
4) Цепь Маркова «погода»: распределение сходится к (5/6, 1/6), доли дней в траектории — тоже.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, INK, MUTED, ORANGE

ex = Example(__file__)
fig, axes = plt.subplots(2, 2, figsize=(12, 8.4))

# 1. Совместная таблица
J = np.array([[0.3 * 0.8, 0.3 * 0.2], [0.7 * 0.2, 0.7 * 0.8]])
px, py = J.sum(axis=1), J.sum(axis=0)
print("1) p(погода) =", px, " p(зонт) =", py.round(2), " P(дождь | зонт) =", round(J[0, 0] / py[0], 4))
print("   независимы?", np.allclose(J, np.outer(px, py)), "— P(дождь)·P(зонт) =", round(px[0] * py[0], 3), "≠", J[0, 0])
assert abs(J[0, 0] / py[0] - 0.632) < 1e-3

# 2. Условное среднее и разложение дисперсии
X, y = datasets.regression_1d(kind="sine", n=200, noise=0.5, seed=7)
x = X[:, 0]
ax = axes[0, 0]
ax.scatter(x, y, s=12, color=MUTED, label="данные")
r2 = {}
for k, col in ((2, AQUA), (8, BLUE)):
    b = np.minimum((x / (10 / k)).astype(int), k - 1)
    means = np.array([y[b == j].mean() for j in range(k)])
    within = ((y - means[b]) ** 2).mean()
    r2[k] = 1 - within / y.var()
    print(f"2) k = {k}: Var Y = {y.var():.3f} = внутри {within:.3f} + между {y.var() - within:.3f};  R² = {r2[k]:.3f}")
    ax.step(np.r_[np.arange(k) * 10 / k, 10], np.r_[means, means[-1]], where="post", color=col, lw=2.2, label=f"среднее в {k} корзинах")
xx = np.linspace(0, 10, 300)
ax.plot(xx, np.sin(xx), "--", color=INK, lw=1.5, label="E[Y | X] = sin x")
ax.set(xlabel="x", ylabel="y", title="условное среднее — ступеньки, как у дерева")
ax.legend(fontsize=8)
assert r2[8] > r2[2]
yf = np.array([2, 4, 3, 7, 9, 11.0])
g = np.array([0, 0, 0, 1, 1, 1])
m = np.array([3.0, 9.0])
print(f"   квартиры, «площадь ≤ 3»: 10.667 = {((yf - m[g]) ** 2).mean():.3f} + {yf.var() - ((yf - m[g]) ** 2).mean():.3f}, выигрыш {6 * (yf.var() - ((yf - m[g]) ** 2).mean()):.0f}")

# 3. Корреляция
rng = Mulberry32(3)
z = np.array([[rng.normal(), rng.normal()] for _ in range(400)])
clouds = {
    "линейная, ρ = 0.7": (z[:, 0], 0.7 * z[:, 0] + math.sqrt(1 - 0.49) * z[:, 1]),
    "парабола": (z[:, 0], z[:, 0] ** 2 + 0.25 * z[:, 1]),
}
ax = axes[0, 1]
for (name, (a, c)), col in zip(clouds.items(), (BLUE, ORANGE)):
    rho = np.corrcoef(a, c)[0, 1]
    print(f"3) {name}: выборочная корреляция {rho:.3f}")
    ax.scatter(a, c, s=10, alpha=0.6, color=col, label=f"{name}: r = {rho:.2f}")
ax.set(xlabel="x", ylabel="y", title="корреляция видит только линейную связь")
ax.legend()

# 4. Цепь Маркова
P = np.array([[0.9, 0.1], [0.5, 0.5]])
v = np.array([0.0, 1.0])
hist = [v]
for _ in range(20):
    v = v @ P
    hist.append(v)
hist = np.array(hist)
print("4) из дождя: t = 1", hist[1], " t = 2", hist[2], " t = 10", hist[10].round(5))
assert np.allclose(hist[10], [0.83325, 0.16675], atol=1e-5)
rng = Mulberry32(1)
state, cnt = 1, np.zeros(2)
frac = []
for t in range(1, 5001):
    state = 0 if rng.random() < P[state, 0] else 1
    cnt[state] += 1
    frac.append(cnt[0] / t)
print(f"   доля солнечных дней в траектории из 5000 шагов: {frac[-1]:.3f} (π = {5 / 6:.4f})")
ax = axes[1, 0]
ax.plot(hist[:, 0], "o-", color=ORANGE, label="P(солнце) на шаге t")
ax.plot(hist[:, 1], "o-", color=BLUE, label="P(дождь) на шаге t")
ax.axhline(5 / 6, color=ORANGE, ls="--", lw=1)
ax.axhline(1 / 6, color=BLUE, ls="--", lw=1)
ax.set(xlabel="шаг t", ylabel="вероятность", title="цепь Маркова: π_t → π")
ax.legend()
ax = axes[1, 1]
ax.plot(np.arange(1, 5001), frac, color=ORANGE, lw=1.8, label="доля солнечных дней")
ax.axhline(5 / 6, color=ORANGE, ls="--", lw=1, label="π(солнце) = 5/6")
ax.set(xscale="log", ylim=(0, 1), xlabel="длина траектории", ylabel="доля", title="закон больших чисел для цепи")
ax.legend()

fig.tight_layout()
ex.finish(fig, "dependence_and_markov")
