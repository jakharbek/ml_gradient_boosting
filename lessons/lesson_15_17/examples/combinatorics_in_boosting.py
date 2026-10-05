"""Комбинаторика в бустинге: разбиения категорий, пространство деревьев, бутстрэп в лесу, значения Шепли.

Запуск:  python lessons/lesson_15_17/examples/combinatorics_in_boosting.py [--save] [--no-show]

1) Теорема Фишера: лучшее из 2^(k−1) − 1 разбиений категорий — один из k − 1 префиксов (100 наборов).
2) Сколько существует деревьев: Cat(L − 1)·(p·B)^(L − 1) против жадных (L − 1)·p·B кандидатов.
3) Бутстрэп в RandomForestRegressor: доля вне выборки ≈ 1/e, ни в одной из M выборок ≈ e^(−M).
4) Шепли: точный перебор 2ᴹ коалиций = формула игры; приближение по R случайным порядкам, ошибка ∝ 1/√R.
"""

import math
import sys
from itertools import combinations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import RandomForestRegressor

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE, RED

ex = Example(__file__)


# 1. Теорема Фишера
def make_cats(k, seed):
    rng = Mulberry32(seed)
    return [(i, 5 + rng.randint(26), rng.normal(0, 1)) for i in range(k)]


def gain(cats, left):
    nL = sum(c[1] for c in cats if c[0] in left)
    nR = sum(c[1] for c in cats if c[0] not in left)
    mL = sum(c[1] * c[2] for c in cats if c[0] in left) / nL
    mR = sum(c[1] * c[2] for c in cats if c[0] not in left) / nR
    return nL * nR / (nL + nR) * (mL - mR) ** 2


agree = 0
for seed in range(100):
    cats = make_cats(9, seed)
    splits = [{0, *rest} for r in range(8) for rest in combinations(range(1, 9), r)]
    order = [c[0] for c in sorted(cats, key=lambda c: c[2])]
    agree += math.isclose(max(gain(cats, s) for s in splits), max(gain(cats, set(order[:i])) for i in range(1, 9)))
print(f"9 категорий: разбиений {len(splits)} = 2⁸ − 1, префиксов 8; лучшее — префикс в {agree} из 100 наборов")
assert agree == 100 and len(splits) == 255

# 2. Пространство деревьев
cat = lambda n: math.comb(2 * n, n) // (n + 1)
for L, p, B in ((4, 10, 255), (8, 10, 255), (32, 20, 255)):
    trees = cat(L - 1) * (p * B) ** (L - 1)
    print(f"L = {L:2}, p = {p}, B = {B}: форм {cat(L - 1)}, деревьев ~10^{math.log10(trees):.1f}, жадных кандидатов {(L - 1) * p * B}")
assert cat(7) == 429

# 3. Бутстрэп в случайном лесу
rng = np.random.default_rng(0)
X = rng.normal(size=(3000, 4))
y = X[:, 0] - X[:, 1] + rng.normal(size=3000)
rf = RandomForestRegressor(n_estimators=40, max_depth=4, random_state=0).fit(X, y)
in_bag = np.zeros((40, 3000), bool)
for t, s in enumerate(rf.estimators_samples_):
    in_bag[t, np.unique(s)] = True
oob = 1 - in_bag.mean()
never = [(~in_bag[:M]).all(0).mean() for M in range(1, 11)]
print(f"лес: вне выборки {oob:.4f} (1/e = {1 / math.e:.4f}); ни в одной из 3 выборок {never[2]:.4f} (e⁻³ = {math.exp(-3):.4f})")
assert abs(oob - 1 / math.e) < 0.01

# 4. Шепли
M = 8
r = Mulberry32(2)
a = [r.normal(0, 1) for _ in range(M)]
b = [[0.0] * M for _ in range(M)]
for i in range(M):
    for j in range(i + 1, M):
        b[i][j] = b[j][i] = r.normal(0, 0.7)
v = lambda S: sum(a[i] for i in S) + sum(b[i][j] for i, j in combinations(sorted(S), 2))
exact = [sum(math.factorial(len(S)) * math.factorial(M - len(S) - 1) / math.factorial(M) * (v(set(S) | {j}) - v(set(S)))
             for k in range(M) for S in combinations([i for i in range(M) if i != j], k)) for j in range(M)]
assert np.allclose(exact, [a[j] + 0.5 * sum(b[j]) for j in range(M)])
r2 = Mulberry32(102)
acc, Rs, errs = np.zeros(M), [], []
for t in range(1, 3001):
    S, prev = set(), 0.0
    for j in r2.permutation(M):
        S.add(j)
        cur = v(S)
        acc[j] += cur - prev
        prev = cur
    if t in (1, 3, 10, 30, 100, 300, 1000, 3000):
        Rs.append(t)
        errs.append(float(np.mean(np.abs(acc / t - exact))))
print("Шепли: ошибка по R порядкам", {R: round(e, 4) for R, e in zip(Rs, errs)})
assert errs[-1] < errs[0] / 10

fig, axes = plt.subplots(1, 3, figsize=(14, 3.9))
Ls = np.arange(2, 65)
lg_cat = lambda n: (math.lgamma(2 * n + 1) - math.lgamma(n + 1) - math.lgamma(n + 2)) / math.log(10)
axes[0].plot(Ls, [lg_cat(L - 1) + (L - 1) * math.log10(2550) for L in Ls], color=RED, label="деревьев (p = 10, B = 255)")
axes[0].plot(Ls, [lg_cat(L - 1) for L in Ls], color=BLUE, label="форм Cat(L − 1)")
axes[0].plot(Ls, [math.log10((L - 1) * 2550) for L in Ls], color=ORANGE, label="жадный рост")
axes[0].axhline(80, color=MUTED, ls=":", lw=1)
axes[0].set(xlabel="листьев L", ylabel="log₁₀ числа", title="Почему деревья строят жадно")
axes[0].legend(fontsize=8)
axes[1].plot(range(1, 11), never, "o-", color=BLUE, label="ни в одной из M выборок")
axes[1].plot(range(1, 11), np.exp(-np.arange(1, 11)), "--", color=MUTED, label="e⁻ᴹ")
axes[1].set(yscale="log", xlabel="деревьев M", ylabel="доля объектов", title="Бутстрэп в случайном лесу")
axes[1].legend()
axes[2].loglog(Rs, errs, "o-", color=BLUE, label="ошибка оценки")
axes[2].loglog(Rs, errs[0] / np.sqrt(Rs), "--", color=MUTED, label="∝ 1/√R")
axes[2].set(xlabel="случайных порядков R", ylabel="средняя |φ̂ − φ|", title=f"Шепли: 2^{M} коалиций против R·{M}")
axes[2].legend()
fig.tight_layout()
ex.finish(fig, "combinatorics_in_boosting")
