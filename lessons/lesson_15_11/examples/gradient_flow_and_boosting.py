"""Градиентный поток в машинном обучении: спуск, обусловленность, моментум и бустинг как численные методы.

Запуск:  python lessons/lesson_15_11/examples/gradient_flow_and_boosting.py [--save] [--no-show]

1) Градиентный спуск — метод Эйлера для θ′ = −∇L: при малом η шаги ложатся на поток, граница η < 2/L″.
2) Обусловленность κ = 10: лучший постоянный темп 2/(1 + κ) — 39 шагов; моментум Поляка — 16.
3) Бустинг на данных: при разных ν кривые потерь в координатах t = ν·M близки — бустинг приближает поток.
4) Классификация на разделимых данных: отступы растут как поток Ньютона ln(2eᵗ − 1) и не останавливаются;
   λ в листе XGBoost: −G/(H + λ) — неявный (проксимальный) шаг Ньютона.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.boosting import GBClassifier, GBRegressor
from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)
fig, axes = plt.subplots(2, 2, figsize=(12, 8.5))

# 1. Спуск против потока
ax = axes[0, 0]
grad = lambda th: th**3 - th  # noqa: E731  — L = (θ² − 1)²/4, минимумы ±1, L″ = 2
tf = np.linspace(0, 6, 600)
flow = [0.3]
for _ in range(599):
    th = flow[-1]
    hh = tf[1] - tf[0]
    k1 = -grad(th)
    k2 = -grad(th + hh / 2 * k1)
    k3 = -grad(th + hh / 2 * k2)
    k4 = -grad(th + hh * k3)
    flow.append(th + hh * (k1 + 2 * k2 + 2 * k3 + k4) / 6)
ax.plot(tf, flow, color=BLUE, lw=2.4, label="поток θ′ = −L′(θ)")
for eta, col in ((0.2, AQUA), (0.9, VIOLET), (1.05, ORANGE)):
    th = [0.3]
    for _ in range(round(6 / eta)):
        th.append(th[-1] - eta * grad(th[-1]))
    ax.plot(np.arange(len(th)) * eta, th, "o-", ms=3, lw=1, color=col, label=f"спуск η = {eta}")
    print(f"1) две ямы, η = {eta}: θ в конце {th[-1]:+.4f} (граница η < 2/L″ = 1)")
ax.axhline(1, color=MUTED, ls="--")
ax.set(xlabel="«время» t = η·k", ylabel="θ", title="спуск — шаги Эйлера потока")
ax.legend(fontsize=8)

# 2. Обусловленность и моментум
ax = axes[0, 1]
lam = np.array([1.0, 10.0])


def path(eta, beta=0.0, n=60):
    th = prev = np.array([2.0, 1.0])
    out = [np.linalg.norm(th)]
    hit = None
    for k in range(1, 5001):
        th, prev = th - eta * lam * th + beta * (th - prev), th
        if k <= n:
            out.append(np.linalg.norm(th))
        if hit is None and np.linalg.norm(th) < 1e-3:
            hit = k
    return np.array(out), hit


kap = 10
b_opt = ((math.sqrt(kap) - 1) / (math.sqrt(kap) + 1)) ** 2
for (eta, beta, lab), col in (((0.1, 0, "спуск η = 0.1"), ORANGE), ((2 / 11, 0, "спуск η = 2/(1 + κ)"), AQUA), ((4 / (1 + math.sqrt(kap)) ** 2, b_opt, "моментум Поляка"), BLUE)):
    out, hit = path(eta, beta)
    print(f"2) {lab:20}: шагов до 1e−3 из (2, 1): {hit}")
    ax.semilogy(out, color=col, lw=2, label=f"{lab}: {hit}")
assert path(4 / (1 + math.sqrt(kap)) ** 2, b_opt)[1] == 16 and path(2 / 11)[1] == 39
ax.axhline(1e-3, color=MUTED, ls="--")
ax.set(xlabel="шаг k", ylabel="‖θ‖", title="κ = 10: моментум ~√κ шагов вместо ~κ")
ax.legend(fontsize=8)

# 3. Бустинг: ν·M — это время
ax = axes[1, 0]
X, y = datasets.regression_1d(kind="wave", n=200, noise=0.3, seed=5)
at_t2 = {}
for nu, col in ((0.5, ORANGE), (0.2, AQUA), (0.05, BLUE)):
    M = round(4 / nu)
    model = GBRegressor(n_estimators=M, learning_rate=nu, max_depth=2).fit(X, y)
    mse = np.array([np.mean((y - model.predict(X, n_iter=m)) ** 2) for m in range(M + 1)])
    at_t2[nu] = mse[round(2 / nu)]
    ax.plot(np.arange(M + 1) * nu, mse, color=col, lw=2, label=f"ν = {nu}")
    print(f"3) ν = {nu:<4}: MSE на обучении при t = 1, 2, 4 → {np.round(mse[[round(1 / nu), round(2 / nu), M]], 4)}")
assert abs(at_t2[0.2] - at_t2[0.05]) < 0.01
ax.set(xlabel="«время» t = ν·M", ylabel="MSE на обучении", title="бустинг с малым ν приближает поток")
ax.legend(fontsize=8)

# 4. Log-loss без равновесия и λ как неявный шаг
ax = axes[1, 1]
Xc, yc = datasets.classification_2d(kind="blobs", n=200, noise=0.2, seed=3)
clf = GBClassifier(n_estimators=250, learning_rate=0.1, max_depth=2).fit(Xc, yc)
ts = np.arange(1, 26)
marg = [np.min(np.where(yc == 1, clf.predict_raw(Xc, n_iter=round(t / 0.1)), -clf.predict_raw(Xc, n_iter=round(t / 0.1)))) for t in ts]
newton = np.log(2 * np.exp(ts.astype(float)) - 1)
grad_flow = [next(F for F in np.linspace(0, 10, 100001) if F + math.exp(F) >= t + 1) for t in ts]
ax.plot(ts, marg, "o", color=ORANGE, ms=4, label="gbcourse: наименьший отступ")
ax.plot(ts, newton, color=BLUE, lw=2, label="поток Ньютона ln(2eᵗ − 1)")
ax.plot(ts, grad_flow, "--", color=VIOLET, lw=2, label="градиентный поток F + e^F = t + 1")
print(f"4) t = 10: отступ {marg[9]:.3f}, поток Ньютона {newton[9]:.3f}, градиентный поток {grad_flow[9]:.3f}")
assert abs(marg[9] - newton[9]) < 0.1
ax.set(xlabel="«время» t = ν·M", ylabel="логит F", title="разделимые данные: отступы растут без остановки")
ax.legend(fontsize=8)
G, Hh = -4.0, 2.0
for lam_ in (0, 1, 10):
    print(f"   лист XGBoost при λ = {lam_:2d}: −G/(H + λ) = {-G / (Hh + lam_):.4f}" + (f"; градиентный шаг −G/λ = {-G / lam_:.4f}" if lam_ else " (шаг Ньютона)"))
fig.tight_layout()
ex.finish(fig, "gradient_flow_and_boosting")
