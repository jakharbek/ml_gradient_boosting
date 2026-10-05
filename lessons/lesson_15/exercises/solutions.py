"""Решения упражнений модуля 15.

Запуск:  python lessons/lesson_15/exercises/solutions.py
"""

import sys

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")

# 1
f = lambda t: np.sin(1.3 * t) + 0.15 * t**2  # noqa: E731
t = np.linspace(-4, 4, 8001)
d = (f(t + 1e-5) - f(t - 1e-5)) / 2e-5
flips = np.where(np.sign(d[:-1]) != np.sign(d[1:]))[0]
print("1) производная меняет знак около θ =", ", ".join(f"{t[i]:+.3f}" for i in flips))
for i in flips:
    kind = "минимум (− → +)" if d[i] < 0 else "максимум (+ → −)"
    print(f"   θ ≈ {t[i]:+.3f}: {kind}")

# 2
print("\n2) 1.3 — шаг градиентного спуска θ ← θ − η f′(θ);")
print("   5.1 — псевдо-остатки −∂L/∂F, на которых учится каждое дерево;")
print("   8.1 — разложение Тейлора: градиент и гессиан в XGBoost.")
