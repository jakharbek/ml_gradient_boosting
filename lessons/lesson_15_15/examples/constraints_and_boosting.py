"""Ограничения, дискретные задачи и оптимизация внутри бустинга.

Запуск:  python lessons/lesson_15_15/examples/constraints_and_boosting.py [--save] [--no-show]

1) Условия ККТ: проекция на многоугольник (SLSQP) и теневая цена бюджета; ЛП с двойственными ценами (linprog).
2) Рюкзак: динамическое программирование против жадного выбора на всех вместимостях 1…40.
3) Шаг бустинга с log-loss: градиент, поиск вдоль прямой, Ньютон, точный минимум в листьях; сверка с
   GradientBoostingClassifier. Поэтапный бустинг против пути Lasso.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.optimize import linprog, minimize, minimize_scalar
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import lasso_path

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MAGENTA, ORANGE, VIOLET

ex = Example(__file__)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))

# 1. ККТ и ЛП
t = np.array([3.6, 2.4])


def project(b):
    cons = [{"type": "ineq", "fun": lambda w: w[0]}, {"type": "ineq", "fun": lambda w: w[1]},
            {"type": "ineq", "fun": lambda w: b - w[0] - 2 * w[1]}, {"type": "ineq", "fun": lambda w: 3 - w[0]}]
    return minimize(lambda w: 0.5 * ((w - t) ** 2).sum(), np.zeros(2), constraints=cons, method="SLSQP", tol=1e-12)


res = project(4)
mu = (t - res.x)[0]
shadow = (project(4 - 1e-3).fun - project(4 + 1e-3).fun) / 2e-3
print(f"ККТ: w* = {res.x.round(4)}, μ = {mu:.4f}, производная оптимума по бюджету {shadow:.4f}")
assert abs(mu - shadow) < 1e-3

lp = linprog(-np.array([3, 2]), A_ub=[[1, 1], [1, 3], [1, 0]], b_ub=[4, 9, 3], bounds=[(0, None)] * 2, method="highs")
duals = -lp.ineqlin.marginals
print("ЛП: план", lp.x, "прибыль", -lp.fun, "теневые цены", duals)
assert abs(duals @ [4, 9, 3] + lp.fun) < 1e-9

# 2. Рюкзак
w_k = [5, 7, 4, 6, 9, 5, 1, 6, 9, 9]
v_k = [6, 12, 7, 9, 15, 8, 2, 11, 8, 16]


def dp(C):
    best = [0.0] * (C + 1)
    for wi, vi in zip(w_k, v_k):
        for c in range(C, wi - 1, -1):
            best[c] = max(best[c], best[c - wi] + vi)
    return best[C]


def greedy(C):
    left, val = C, 0
    for i in sorted(range(10), key=lambda i: (-v_k[i] / w_k[i], i)):
        if w_k[i] <= left:
            left -= w_k[i]
            val += v_k[i]
    return val


caps = np.arange(1, 41)
opt = [dp(C) for C in caps]
gr = [greedy(C) for C in caps]
ax = axes[0]
ax.step(caps, opt, where="post", color=BLUE, lw=2, label="оптимум (ДП)")
ax.step(caps, gr, where="post", color=ORANGE, lw=1.6, label="жадно по ценности/весу")
ax.set(xlabel="вместимость C", ylabel="суммарная ценность", title="Рюкзак: жадность против динамики")
ax.legend()
print("жадность ошибается при", sum(g < o for g, o in zip(gr, opt)), "вместимостях из 40; C = 10:", dp(10), "против", greedy(10))
assert (dp(10), greedy(10)) == (18, 13)

# 3. Шаг бустинга
r = Mulberry32(11)
n = 40
x = (np.arange(n) + 0.5) / n
y = np.array([int(r.random() < 1 / (1 + np.exp(-1.5 * np.sin(2 * np.pi * u)))) for u in x])
F0 = np.log(y.mean() / (1 - y.mean()))
p0 = 1 / (1 + np.exp(-F0))
L = lambda F: np.mean(np.logaddexp(0, -F) * y + np.logaddexp(0, F) * (1 - y))  # noqa: E731
res_b = y - p0
k = min(range(1, n), key=lambda k: ((res_b[:k] - res_b[:k].mean()) ** 2).sum() + ((res_b[k:] - res_b[k:].mean()) ** 2).sum())
leaf = (np.arange(n) >= k).astype(int)
h = np.where(leaf == 0, res_b[:k].mean(), res_b[k:].mean())
rho = minimize_scalar(lambda q: L(F0 + q * h), bounds=(0, 20), method="bounded", options={"xatol": 1e-10}).x
newton = np.array([res_b[leaf == j].sum() / ((leaf == j).sum() * p0 * (1 - p0)) for j in (0, 1)])
exact = np.array([np.log(y[leaf == j].mean() / (1 - y[leaf == j].mean())) - F0 for j in (0, 1)])
variants = {"градиент h": L(F0 + h), f"ρ*·h, ρ* = {rho:.2f}": L(F0 + rho * h), "Ньютон в листе": L(F0 + newton[leaf]), "точно в листе": L(F0 + exact[leaf])}
ax = axes[1]
ax.barh(list(variants), list(variants.values()), color=[BLUE, AQUA, ORANGE, VIOLET])
ax.axvline(L(np.full(n, F0)), color="k", lw=1, ls="--")
ax.set(xlabel="log-loss после одного шага (пунктир — до шага)", title="Длина шага бустинга")
for name, v in variants.items():
    print(f"{name:22}: {v:.4f}")
gb = GradientBoostingClassifier(n_estimators=1, learning_rate=1.0, max_depth=1).fit(x[:, None], y)
assert np.allclose(gb.decision_function(x[:, None]), F0 + newton[leaf], atol=1e-10)
print("GradientBoostingClassifier: листья = шаг Ньютона")

# Поэтапный бустинг и Lasso
r = Mulberry32(21)
Z = np.array([[r.normal() for _ in range(5)] for _ in range(60)])
X = np.column_stack([Z[:, 0], 0.6 * Z[:, 0] + 0.8 * Z[:, 1], Z[:, 2], 0.5 * Z[:, 2] + 0.5 * Z[:, 3] + 0.7 * Z[:, 1], Z[:, 4]])
X = (X - X.mean(0)) / X.std(0)
yy = np.array([3 * a - 2 * c + 1.5 * e + 0.5 * b + r.normal(0, 1.5) for a, b, c, d, e in X])
yy -= yy.mean()
w, res, path = np.zeros(5), yy.copy(), [np.zeros(5)]
while True:
    c = X.T @ res / 60
    j = np.argmax(np.abs(c))
    if abs(c[j]) < 0.005:
        break
    w[j] += 0.01 * np.sign(c[j])
    res -= 0.01 * np.sign(c[j]) * X[:, j]
    path.append(w.copy())
path = np.array(path)
alphas, coefs, _ = lasso_path(X, yy, alphas=np.geomspace(1, 1e-3, 120) * np.abs(X.T @ yy).max() / 60)
ax = axes[2]
for j, col in enumerate([BLUE, ORANGE, AQUA, VIOLET, MAGENTA]):
    ax.plot(np.abs(path).sum(1), path[:, j], color=col, lw=2, label=f"w{j + 1}")
    ax.plot(np.abs(coefs).sum(0), coefs[j], "--", color=col, lw=1.2)
ax.set(xlabel="‖w‖₁", ylabel="вес", title="Поэтапный бустинг (сплошные) ≈ Lasso (пунктир)")
ax.legend(ncols=5, fontsize=8)
print("поэтапный бустинг:", len(path) - 1, "шагов, веса", w.round(2), "; Lasso:", coefs[:, -1].round(2))
assert np.abs(w - coefs[:, -1]).max() < 0.05

ex.finish(fig, "constraints_and_boosting")
