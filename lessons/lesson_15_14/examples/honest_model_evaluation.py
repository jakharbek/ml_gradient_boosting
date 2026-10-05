"""Честная оценка моделей: Мак-Немар, кросс-валидация с поправкой, разбиения на шуме, λ в листьях.

Запуск:  python lessons/lesson_15_14/examples/honest_model_evaluation.py [--save] [--no-show]

1) Мощность критерия Мак-Немара и непарного сравнения долей для согласованных моделей (симуляция).
2) Кросс-валидация бустинга gbcourse (пни против глубины 3): наивная SE и поправка Надо — Бенжио при повторах.
3) Лучшее разбиение пня на шумовых признаках и ошибка значений листьев n·ȳ/(n + λ) в зависимости от λ.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import stats

from gbcourse import datasets
from gbcourse.boosting import GBRegressor
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE, RED

ex = Example(__file__)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))

# 1. Мак-Немар против непарного сравнения
pA, pB, rho = 0.85, 0.87, 0.6
p11 = pA * pB + rho * math.sqrt(pA * (1 - pA) * pB * (1 - pB))
p10, p01 = pA - p11, pB - p11
ns = [200, 500, 1000, 2000]
pow_mc, pow_un = [], []
rng = Mulberry32(19)
for n in ns:
    mc = un = 0
    for _ in range(300):
        u = np.array([rng.random() for _ in range(n)])
        b, c = np.sum((u >= p11) & (u < p11 + p10)), np.sum((u >= p11 + p10) & (u < p11 + p10 + p01))
        a_ok, b_ok = np.sum(u < p11 + p10) / n, (np.sum(u < p11) + c) / n
        mc += stats.binomtest(int(min(b, c)), int(b + c), 0.5).pvalue < 0.05
        pbar = (a_ok + b_ok) / 2
        un += 2 * stats.norm.sf(abs(b_ok - a_ok) / math.sqrt(2 * pbar * (1 - pbar) / n)) < 0.05
    pow_mc.append(mc / 300)
    pow_un.append(un / 300)
    print(f"n = {n:4d}: мощность Мак-Немара {pow_mc[-1]:.2f}, непарного {pow_un[-1]:.2f}")
assert all(m_ >= u_ for m_, u_ in zip(pow_mc, pow_un))
ax = axes[0]
ax.plot(ns, pow_mc, "o-", color=BLUE, label="Мак-Немар (парный)")
ax.plot(ns, pow_un, "o-", color=ORANGE, label="непарное сравнение долей")
ax.axhline(0.8, color=MUTED, ls=":")
ax.set(xscale="log", xlabel="объектов в тесте", ylabel="мощность", title="0.85 против 0.87, ρ = 0.6")
ax.set_xticks(ns, [str(v) for v in ns])
ax.minorticks_off()
ax.legend(loc="upper left", bbox_to_anchor=(0, 0.92))

# 2. Кросс-валидация с поправкой
X, y = datasets.regression_1d(kind="wave", n=120, noise=0.45, seed=4)
K = 5
diffs = []
for rep in range(10):
    perm = np.array(Mulberry32(8 + 1000 * rep).permutation(len(y)))
    for k in range(K):
        test = perm[np.arange(len(y)) % K == k]
        train = np.setdiff1d(np.arange(len(y)), test)
        mse = [np.mean((y[test] - GBRegressor(n_estimators=60, learning_rate=0.1, max_depth=d).fit(X[train], y[train]).predict(X[test])) ** 2) for d in (1, 3)]
        diffs.append(mse[0] - mse[1])
diffs = np.array(diffs)
ax = axes[1]
for r in (1, 2, 5, 10):
    d = diffs[: r * K]
    J = len(d)
    se_n = d.std(ddof=1) / math.sqrt(J)
    se_c = math.sqrt((1 / J + 1 / (K - 1)) * d.var(ddof=1))
    print(f"повторов {r:2d}: разность {d.mean():.4f}, SE наивная {se_n:.4f}, с поправкой {se_c:.4f}")
    ax.errorbar(r - 0.08, d.mean(), yerr=1.96 * se_n, fmt="o", color=RED, capsize=4, label="наивный 95 %" if r == 1 else None)
    ax.errorbar(r + 0.08, d.mean(), yerr=1.96 * se_c, fmt="o", color=BLUE, capsize=4, label="с поправкой Надо — Бенжио" if r == 1 else None)
    if r == 1:
        assert abs(d.mean() - 0.0396) < 1e-4
assert se_c > 3 * se_n
ax.axhline(0, color=MUTED, ls="--")
ax.set(xlabel="повторов кросс-валидации (K = 5)", ylabel="разность MSE (глубина 1 − 3)", title="интервал для разности моделей")
ax.legend(fontsize=8)

# 3. Разбиения на шуме и сжатие листьев
def best_r2(yo, min_leaf=5):
    n, cs, tot = len(yo), np.cumsum(yo), yo.sum()
    b = np.arange(min_leaf, n - min_leaf + 1)
    left = cs[b - 1]
    gain = left**2 / b + (tot - left) ** 2 / (n - b) - tot**2 / n
    return max(0.0, gain.max()) / ((yo - yo.mean()) ** 2).sum()


rng = Mulberry32(21)
ps = [1, 5, 20, 100]
mean_best = []
for p in ps:
    vals = []
    for _ in range(200):
        yy = [rng.normal() for _ in range(100)]
        best = 0.0
        for _ in range(p):
            rng.shuffle(yy)
            best = max(best, best_r2(np.array(yy)))
        vals.append(best)
    mean_best.append(np.mean(vals))
    word = "признак" if p == 1 else "признаков"
    print(f"шум: {p:3d} {word:9s} — лучший R² пня в среднем {mean_best[-1]:.3f}")
assert all(np.diff(mean_best) > 0)

rng = Mulberry32(2201)
nl, mu, yb = [], [], []
for _ in range(40):
    nj = max(1, round(math.exp(rng.random() * math.log(200))))
    m = 0.5 * rng.normal()
    nl.append(nj)
    mu.append(m)
    yb.append(m + rng.normal() / math.sqrt(nj))
nl, mu, yb = map(np.array, (nl, mu, yb))
lams = np.geomspace(0.25, 128, 60)
err = [np.mean((nl * yb / (nl + lam) - mu) ** 2) for lam in lams]
print(f"листья: ошибка² при λ = 0 — {np.mean((yb - mu) ** 2):.4f}, лучшее λ ≈ {lams[int(np.argmin(err))]:.2f} (теория σ²/τ² = 4)")
assert 1.5 < lams[int(np.argmin(err))] < 10
ax = axes[2]
ax.plot(lams, err, color=BLUE, lw=2, label="ошибка² значений листьев")
ax.axhline(np.mean((yb - mu) ** 2), color=MUTED, ls="--", label="λ = 0")
ax.axvline(4, color=ORANGE, ls=":", label="σ²/τ² = 4")
ax.set(xscale="log", xlabel="λ", ylabel="средняя ошибка²", title="λ как байесовское сжатие листьев")
ax.legend(fontsize=8, loc="lower left")

fig.tight_layout()
ex.finish(fig, "honest_model_evaluation")
