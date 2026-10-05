"""Решения упражнений урока 2.1.

Запуск:  python lessons/lesson_2_1/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import RegressionTree, datasets


def best_split(x, y, min_leaf=1):
    order = np.argsort(x, kind="stable")
    xs, ys = x[order], y[order]
    n, S = len(ys), ys.sum()
    SL = np.cumsum(ys)[:-1]
    nL = np.arange(1, n)
    gain = SL**2 / nL + (S - SL) ** 2 / (n - nL) - S**2 / n
    bad = (xs[:-1] == xs[1:]) | (nL < min_leaf) | (n - nL < min_leaf)
    gain[bad] = -np.inf
    k = int(np.argmax(gain))
    return (xs[k] + xs[k + 1]) / 2, gain[k]


# 1
print("1) S = S_L + S_R, ȳ = S/n: раскройте скобки — перекрёстные члены дают n_L n_R/n · (ȳ_L − ȳ_R)².")
rng = np.random.default_rng(0)
y = rng.normal(size=10)
for k in (2, 5, 7):
    L, R = y[:k], y[k:]
    lhs = L.sum() ** 2 / len(L) + R.sum() ** 2 / len(R) - y.sum() ** 2 / len(y)
    rhs = len(L) * len(R) / len(y) * (L.mean() - R.mean()) ** 2
    print(f"   k = {k}: {lhs:.10f} = {rhs:.10f}")

# 2
X, y = datasets.regression_1d("sine", n=40, noise=0.3, seed=5)
for m in (1, 5, 15):
    t, _ = best_split(X[:, 0], y, min_leaf=m)
    ref = RegressionTree(max_depth=1, min_samples_leaf=m).fit(X, -y).nodes[0].threshold
    print(f"2) min_leaf = {m:2d}: наш порог {t:.4f}, gbcourse {ref:.4f}")

# 3
X6, y6 = datasets.toy_regression()
print(f"3) исходно порог {best_split(X6[:, 0], y6)[0]}", end="; ")
y6b = y6.copy()
y6b[-1] = 30
print(f"с y₆ = 30 порог {best_split(X6[:, 0], y6b)[0]} — выброс перетягивает разбиение: выгоднее отделить его одного.")

# 4
x4, y4 = np.array([1.0, 2, 3, 4]), np.array([1.0, 1, 5, 7])
for k in (1, 2, 3):
    L, R = y4[:k], y4[k:]
    print(f"4) порог {k + 0.5}: Δ = {k * (4 - k) / 4 * (L.mean() - R.mean()) ** 2:.2f}")
print("   лучший порог 2.5 (Δ = 25)")
