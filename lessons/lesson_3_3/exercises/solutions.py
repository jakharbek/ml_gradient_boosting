"""Решения упражнений урока 3.3.

Запуск:  python lessons/lesson_3_3/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import AdaBoost, datasets

# 1
print("1) d/dβ [e^{−β}(1−ε) + e^{β}ε] = −e^{−β}(1−ε) + e^{β}ε = 0 ⇒ e^{2β} = (1−ε)/ε ⇒ β = ½ ln((1−ε)/ε)")

# 2
X, y = datasets.classification_2d(kind="moons", n=200, noise=0.25, seed=33)
ys = np.where(y > 0, 1, -1)
w = np.full(len(ys), 1 / len(ys))
best = None
for j in range(X.shape[1]):
    xs = np.unique(X[:, j])
    for t in (xs[:-1] + xs[1:]) / 2:
        for sign in (1, -1):
            b = np.where(X[:, j] <= t, sign, -sign)
            eps = w[b != ys].sum()
            if not 0 < eps < 0.5:
                continue
            beta = 0.5 * np.log((1 - eps) / eps)
            loss = (w * np.exp(-beta * ys * b)).sum()
            if best is None or loss < best[0]:
                best = (loss, j, t, beta)
ada = AdaBoost(n_estimators=1).fit(X, y)
root = ada.trees_[0].nodes[0]
print(f"2) FSAM перебором: x{best[1]} ≤ {best[2]:.4f}, β = {best[3]:.4f}")
print(f"   AdaBoost:        x{root.feature} ≤ {root.threshold:.4f}, α = {ada.alphas_[0]:.4f}")
print("   Пни могут отличаться: AdaBoost выбирает пень по взвешенному Джини, FSAM — по экспоненциальным потерям")
print("   (по взвешенной ошибке); оба критерия близки, но не тождественны.")

# 3
print("3) d/dF [p e^{−F} + (1−p) e^{F}] = 0 ⇒ e^{2F} = p/(1−p) ⇒ F* = ½ ln(p/(1−p)) — половина логарифма шансов.")
