"""Решения упражнений урока 7.3.

Запуск:  python lessons/lesson_7_3/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, RegressionTree, datasets

# 1
print("1) Производная: G + (H + λ)w + α·sign(w) = 0 ⇒ w = −sign(G)·max(|G| − α, 0)/(H + λ);")
print("   w = 0, когда |G| ≤ α — суммарная «тяга» листа не превышает штрафа.")
X, y = datasets.regression_1d(kind="wave", n=40, noise=0.5, seed=1)
r = y - y.mean()
for alpha in (0.0, 2.0, 50.0):
    t = RegressionTree(max_depth=1, reg_alpha=alpha, reg_lambda=1.0).fit(X, -r)
    for leaf in t.leaves:
        G, H = leaf.G, leaf.H
        formula = -np.sign(G) * max(abs(G) - alpha, 0) / (H + 1.0)
        print(f"   α = {alpha:4}: G = {G:+.3f}, вес {leaf.value:+.4f}, формула {formula:+.4f}")

# 2
Xf, yf = datasets.friedman1(n=300, noise=2.0, seed=75)
for g in (0, 5, 10, 20, 50):
    m = GBRegressor(mode="newton", n_estimators=200, learning_rate=0.1, max_depth=5, gamma=g).fit(Xf, yf)
    print(f"2) γ = {g:2d}: листьев в среднем {np.mean([t.n_leaves for (t,) in m.trees_]):.1f}")
