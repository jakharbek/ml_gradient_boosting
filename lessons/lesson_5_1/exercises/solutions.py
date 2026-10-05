"""Решения упражнений урока 5.1.

Запуск:  python lessons/lesson_5_1/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import RegressionTree, datasets

# 1
L = lambda y, F: np.log(np.cosh(y - F))  # noqa: E731
r_formula = lambda y, F: np.tanh(y - F)  # noqa: E731  −∂L/∂F = tanh(y − F)
for res in (-3.0, -0.2, 0.5, 4.0):
    eps = 1e-6
    num = -(L(res, eps) - L(res, -eps)) / (2 * eps)
    print(f"1) y − F = {res:+.1f}: численно {num:+.6f}, tanh = {r_formula(res, 0.0):+.6f}")
print("   При малых остатках tanh(r) ≈ r (как L2), при больших → ±1 (как L1): гладкий аналог Хьюбера.")

# 2
print("2) h(x_i) = r̄_j для i в листе j ⇒ Σ_i r_i h_i = Σ_j r̄_j Σ_{i∈j} r_i = Σ_j n_j r̄_j² = Σ_i h_i².")
print("   Производная риска по направлению h: −(1/n)⟨r, h⟩ = −(1/n)‖h‖² < 0 — риск убывает при малом шаге.")
X, y = datasets.regression_1d("sine", n=50, noise=0.3, seed=1)
r = y - y.mean()
h = RegressionTree(max_depth=3).fit(X, -r).predict(X)
print(f"   проверка: ⟨r, h⟩ = {r @ h:.6f}, ‖h‖² = {h @ h:.6f}")

# 3
X, y = datasets.regression_1d("sine", n=200, noise=0.3, seed=52)
for depth in (1, 3, 6):
    F = np.full_like(y, y.mean())
    cos = []
    for _ in range(100):
        rr = y - F
        hv = RegressionTree(max_depth=depth).fit(X, -rr).predict(X)
        cos.append(rr @ hv / (np.linalg.norm(rr) * np.linalg.norm(hv) + 1e-12))
        F += 0.1 * hv
    print(f"3) глубина {depth}: cos на шагах 1/10/100 = {cos[0]:.3f} / {cos[9]:.3f} / {cos[99]:.3f}")
print("   Глубокое дерево точнее повторяет градиент (включая шум), мелкое — только крупную структуру.")
