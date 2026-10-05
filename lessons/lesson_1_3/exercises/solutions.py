"""Решения упражнений урока 1.3.

Запуск:  python lessons/lesson_1_3/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import datasets

# 1
print("1) θ ← (1 − ηa)θ; сходимость ⇔ |1 − ηa| < 1 ⇔ 0 < η < 2/a (для a = 3: η < 0.667)")
for eta in (0.6, 0.66, 0.67, 0.7):
    t = 1.0
    for _ in range(200):
        t -= eta * 3 * t
    print(f"   η = {eta}: |θ_200| = {abs(t):.3e}")

# 2
X, y = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)
x = X[:, 0]
for name, xx in (("исходный", x), ("центрированный", x - x.mean())):
    a_opt, b_opt = np.polyfit(xx, y, 1)
    opt = np.mean((y - a_opt * xx - b_opt) ** 2) / 2
    a, b, k = -0.8, 5.5, 0
    while np.mean((y - a * xx - b) ** 2) / 2 - opt >= 1e-4 and k < 200000:
        r = y - (a * xx + b)
        a, b, k = a + 0.02 * np.mean(r * xx), b + 0.02 * np.mean(r), k + 1
    print(f"2) {name} x: {k} шагов")

# 3
for mode in ("постоянный", "затухающий"):
    t = 2.05
    for k in range(200):
        eta = 0.3 if mode == "постоянный" else 0.3 / (1 + k / 10)
        t -= eta * np.sign(t)
    print(f"3) {mode} темп: |θ| после 200 шагов = {abs(t):.4f}")

# 4
for eta in (1.0, 0.5):
    c, gaps = 0.0, []
    for _ in range(4):
        c += eta * np.mean(y - c)
        gaps.append(y.mean() - c)
    print(f"4) η = {eta}: остаток до среднего по шагам = {np.round(gaps, 6)}")
