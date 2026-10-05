"""Решения упражнений урока 8.3.

Запуск:  python lessons/lesson_8_3/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import RegressionTree, datasets
from gbcourse.tree import bin_codes, make_bins

lam = 1.0
S = lambda G, H: G * G / (H + lam)

# 1
X, y = datasets.friedman1(n=1000, noise=1.0, seed=84)
rng = np.random.default_rng(0)
X = X.copy()
X[rng.random(len(y)) < 0.2, 3] = np.nan
g = y.mean() - y
h = np.ones_like(g)
bins = make_bins(X, 32)
codes = bin_codes(X, bins)
best = (-np.inf, None, None, None)
for j in range(X.shape[1]):
    c = codes[:, j]
    miss = c < 0
    nb = len(bins[j]) + 1
    Gb = np.bincount(c[~miss], weights=g[~miss], minlength=nb)
    Hb = np.bincount(c[~miss], weights=h[~miss], minlength=nb)
    GL, HL = np.cumsum(Gb)[:-1], np.cumsum(Hb)[:-1]
    Gm, Hm = g[miss].sum(), h[miss].sum()
    G, H = g.sum(), h.sum()
    for miss_left, gl, hl in ((False, GL, HL), (True, GL + Gm, HL + Hm)):
        gain = 0.5 * (S(gl, hl) + S(G - gl, H - hl) - S(G, H))
        k = int(np.argmax(gain))
        if gain[k] > best[0] + 1e-12:
            best = (gain[k], j, bins[j][k], miss_left)
tree = RegressionTree(max_depth=1, max_bins=32, reg_lambda=lam).fit(X, g)
root = tree.nodes[0]
print(f"1) своё решение: признак {best[1]}, порог {best[2]:.4f}, пропуски {'влево' if best[3] else 'вправо'}, gain {best[0]:.3f}")
print(f"   RegressionTree: признак {root.feature}, порог {root.threshold:.4f}, пропуски {'влево' if root.missing_left else 'вправо'}, gain {root.gain:.3f}")

# 2
X, y = datasets.friedman1(n=3000, noise=1.0, seed=84)
g = y.mean() - y
x = X[:, [0]]
exact = RegressionTree(max_depth=1, reg_lambda=lam).fit(x, g).nodes[0].gain
print(f"2) точный выигрыш по x0: {exact:.3f}")
for B in (2, 4, 8, 16, 32, 64, 128, 256):
    gb = RegressionTree(max_depth=1, reg_lambda=lam, max_bins=B).fit(x, g).nodes[0].gain
    print(f"   {B:3d} корзин: gain {gb:9.3f}, потеря {100 * (exact - gb) / exact:5.2f}%")
