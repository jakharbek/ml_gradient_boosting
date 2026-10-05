"""Вероятность в бустинге: log-loss как правдоподобие, калибровка, смещение и разброс, дисперсия ансамбля.

Запуск:  python lessons/lesson_15_13/examples/probability_in_boosting.py [--save] [--no-show]

1) Правдоподобие 7 ушедших из 10: минимум log-loss при p = 0.7, стартовый логит бустинга ln(7/3) — как в gbcourse.
2) Калибровка: самоуверенная и робкая модели против откалиброванной; AUC не меняется.
3) Смещение и разброс: одно дерево, бэггинг и бустинг на 40 выборках y = sin x + шум.
4) Дисперсия среднего k моделей с корреляцией ρ: формула ρ + (1 − ρ)/k и симуляция.
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
from gbcourse.ensembles import BaggingTrees
from gbcourse.metrics import roc_auc
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, INK, MUTED, ORANGE
from gbcourse.tree import RegressionTree

ex = Example(__file__)
fig, axes = plt.subplots(2, 2, figsize=(12, 8.4))

# 1. Правдоподобие и log-loss
y = np.array([1, 1, 0, 1, 1, 0, 1, 1, 0, 1])
ps = np.linspace(0.01, 0.99, 981)
ll = -(7 * np.log(ps) + 3 * np.log(1 - ps)) / 10
p_best = ps[ll.argmin()]
model = GBClassifier(n_estimators=1, learning_rate=0.1, max_depth=1).fit(np.zeros((10, 1)), y)
print(f"1) минимум log-loss {ll.min():.4f} при p = {p_best:.2f}; F0 = ln(7/3) = {math.log(7 / 3):.4f}, gbcourse: {float(model.init_):.4f}")
assert abs(p_best - 0.7) < 1e-9 and abs(float(model.init_) - math.log(7 / 3)) < 1e-12
ax = axes[0, 0]
ax.plot(ps, ll, color=BLUE, lw=2.2, label="log-loss = −(1/n)·log L(p)")
ax.axvline(0.7, color=ORANGE, ls="--", label="p̂ = 7/10")
ax.set(xlabel="p", ylabel="log-loss", title="максимум правдоподобия = минимум log-loss", ylim=(0.55, 1.6))
ax.legend()

# 2. Калибровка
rng = Mulberry32(11)
N = 4000
z = np.empty(N)
yc = np.empty(N)
for i in range(N):
    z[i] = 1.6 * rng.normal()
    yc[i] = rng.random() < 1 / (1 + math.exp(-z[i]))
ax = axes[0, 1]
ax.plot([0, 1], [0, 1], "--", color=MUTED, label="идеальная калибровка")
aucs = []
for T, col, name in ((0.5, ORANGE, "самоуверенная, T = 0.5"), (1.0, BLUE, "откалиброванная"), (2.0, AQUA, "робкая, T = 2")):
    p = 1 / (1 + np.exp(-z / T))
    b = np.minimum((p * 10).astype(int), 9)
    mp = np.array([p[b == j].mean() for j in range(10) if (b == j).any()])
    fy = np.array([yc[b == j].mean() for j in range(10) if (b == j).any()])
    lls = -np.mean(yc * np.log(p) + (1 - yc) * np.log(1 - p))
    aucs.append(roc_auc(yc, p))
    print(f"2) {name}: log-loss {lls:.4f}, Брайер {np.mean((p - yc) ** 2):.4f}, AUC {aucs[-1]:.4f}")
    ax.plot(mp, fy, "o-", color=col, label=name)
assert max(aucs) - min(aucs) < 1e-12
ax.set(xlabel="средний прогноз в корзине", ylabel="доля единиц", title="диаграмма надёжности")
ax.legend(fontsize=8)

# 3. Смещение и разброс
grid = np.linspace(0, 10, 101)

def bias_var(make):
    P = []
    for seed in range(1, 41):
        X, yy = datasets.regression_1d(kind="sine", n=40, noise=0.4, seed=seed)
        P.append(make(X, yy, seed))
    P = np.array(P)
    return ((P.mean(0) - np.sin(grid)) ** 2).mean(), P.var(0).mean()

G = grid.reshape(-1, 1)
depths = range(1, 9)
tree = [bias_var(lambda X, yy, s, d=d: RegressionTree(max_depth=d).fit(X, -yy).predict(G)) for d in depths]
bag8 = bias_var(lambda X, yy, s: BaggingTrees(n_estimators=25, max_depth=8, seed=1000 + s).fit(X, yy).predict(G))
boost1 = bias_var(lambda X, yy, s: GBRegressor(n_estimators=50, learning_rate=0.1, max_depth=1).fit(X, yy).predict(G))
print(f"3) дерево глубины 1: смещение² {tree[0][0]:.3f}, разброс {tree[0][1]:.3f};  глубины 8: {tree[7][0]:.3f}, {tree[7][1]:.3f}")
print(f"   бэггинг 25 деревьев глубины 8: {bag8[0]:.3f}, {bag8[1]:.3f};  бустинг 50 пней: {boost1[0]:.3f}, {boost1[1]:.3f}")
assert bag8[1] < 0.6 * tree[7][1] and boost1[0] < 0.5 * tree[0][0]
ax = axes[1, 0]
ax.plot(depths, [t[0] for t in tree], "o-", color=BLUE, label="смещение² (дерево)")
ax.plot(depths, [t[1] for t in tree], "o-", color=ORANGE, label="разброс (дерево)")
ax.plot(depths, [t[0] + t[1] + 0.16 for t in tree], "o-", color=INK, label="ожидаемая ошибка")
ax.plot([8], [bag8[1]], "s", color=ORANGE, ms=9, mfc="none", mew=2, label="разброс бэггинга, глубина 8")
ax.plot([1], [boost1[0]], "s", color=BLUE, ms=9, mfc="none", mew=2, label="смещение² бустинга пней")
ax.axhline(0.16, color=MUTED, ls="--", lw=1)
ax.set(xlabel="глубина дерева", ylabel="ошибка", title="смещение и разброс")
ax.legend(fontsize=8)

# 4. Дисперсия среднего
ks = np.arange(1, 101)
ax = axes[1, 1]
for rho, col in ((0.0, AQUA), (0.3, BLUE), (0.6, ORANGE)):
    ax.plot(ks, rho + (1 - rho) / ks, color=col, lw=2, label=f"ρ = {rho}")
    rng = Mulberry32(int(100 * rho) + 1)
    sims = []
    for k in (1, 5, 20, 100):
        m = []
        for _ in range(1500):
            c = rng.normal()
            m.append(np.mean([math.sqrt(rho) * c + math.sqrt(1 - rho) * rng.normal() for _ in range(k)]))
        sims.append(np.var(m))
    ax.plot([1, 5, 20, 100], sims, "o", color=col)
    print(f"4) ρ = {rho}: симуляция при k = 1, 5, 20, 100 — {np.round(sims, 3)}, формула — {np.round([rho + (1 - rho) / k for k in (1, 5, 20, 100)], 3)}")
ax.set(xscale="log", xlabel="число моделей k", ylabel="дисперсия среднего", title="ансамбль: ρσ² + (1 − ρ)σ²/k")
ax.legend()
print(f"   OOB: (1 − 1/n)^n при n = 100 — {(1 - 1 / 100) ** 100:.4f}, предел 1/e = {1 / math.e:.4f}")

fig.tight_layout()
ex.finish(fig, "probability_in_boosting")
