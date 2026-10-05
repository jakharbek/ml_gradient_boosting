"""Решения упражнений урока 8.2.

Запуск:  python lessons/lesson_8_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import RegressionTree, datasets

# 1
X, y = datasets.toy_regression()
g = y.mean() - y
for lam in (0.0, 1.0, 10.0):
    S = lambda G, H, lam=lam: G * G / (H + lam)
    gains = [0.5 * (S(g[:k].sum(), k) + S(g[k:].sum(), 6 - k)) for k in range(1, 6)]
    k = int(np.argmax(gains)) + 1
    wl, wr = -g[:k].sum() / (k + lam), -g[k:].sum() / (6 - k + lam)
    print(f"1) λ = {lam:4}: gains {np.round(gains, 3)}, лучший порог {k + 0.5}, листья {wl:+.3f} / {wr:+.3f}")
print("   Порог 3.5 лучший при всех λ; λ сжимает листья к нулю (±3 → ±2.25 → ±0.692).")

# 2
x = np.array([[1.0], [2.0], [3.0], [4.0]])
yy = np.array([0.0, 0.0, 1.0, 1.0])
p = np.full(4, 0.5)
g, h = p - yy, p * (1 - p)
print(f"2) g = {g}, h = {h}")
for lam in (0.0, 1.0):
    S = lambda G, H, lam=lam: G * G / (H + lam)
    gain = 0.5 * (S(g[:2].sum(), h[:2].sum()) + S(g[2:].sum(), h[2:].sum()) - S(g.sum(), h.sum()))
    t = RegressionTree(max_depth=1, reg_lambda=lam).fit(x, g, h)
    print(f"   λ = {lam}: G_L = {g[:2].sum()}, H_L = {h[:2].sum()}, gain = {gain:.4f}; RegressionTree: {t.nodes[0].gain:.4f}, "
          f"листья {[round(lf.value, 4) for lf in t.leaves]}")
