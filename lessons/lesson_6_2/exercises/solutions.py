"""Решения упражнений урока 6.2.

Запуск:  python lessons/lesson_6_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBClassifier, datasets

sig = lambda F: 1 / (1 + np.exp(-F))  # noqa: E731

# 1
X, y = datasets.toy_classification()
x = X[:, 0]
F1 = np.where(x <= 3.5, -2.0, 1.2)
p = sig(F1)
r, h = y - p, p * (1 - p)
best = max(((x[:-1] + x[1:]) / 2), key=lambda t: (x <= t).sum() * (x > t).sum() / 8 * (r[x <= t].mean() - r[x > t].mean()) ** 2)
L, R = x <= best, x > best
gl, gr = r[L].sum() / h[L].sum(), r[R].sum() / h[R].sum()
print(f"1) r = {np.round(r, 3)}\n   порог {best}, листья {gl:.4f} / {gr:.4f}")
m = GBClassifier(n_estimators=2, learning_rate=1.0, max_depth=1).fit(X, y)
t2 = m.trees_[1][0]
print(f"   gbcourse: порог {t2.nodes[0].threshold}, листья {t2.nodes[t2.nodes[0].left].value:.4f} / {t2.nodes[t2.nodes[0].right].value:.4f}")

# 2
yl = np.array([1, 1, 1, 1, 0.0])
g = 0.0
for step in (1, 2):
    pp = sig(np.full(5, g))
    g += np.sum(yl - pp) / np.sum(pp * (1 - pp))
    print(f"2) после {step} шагов Ньютона γ = {g:.5f} (точный log 4 = {np.log(4):.5f})")

# 3
rng = np.random.default_rng(0)
yl = rng.poisson(2.0, 15).astype(float)
Fl = rng.normal(0.5, 0.3, 15)
mu = np.exp(Fl)
print(f"3) Ньютон: Σ(y − μ)/Σμ = {np.sum(yl - mu) / np.sum(mu):.5f}; точный log(Σy/Σμ) = {np.log(yl.sum() / mu.sum()):.5f}")
print("   Ньютон — это log(1 + x) ≈ x для x = Σy/Σμ − 1: совпадает при малом x.")
