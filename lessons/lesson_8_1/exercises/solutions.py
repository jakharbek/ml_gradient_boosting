"""Решения упражнений урока 8.1.

Запуск:  python lessons/lesson_8_1/exercises/solutions.py
"""

import numpy as np

# 1
print("1) L = log cosh(r), r = F − y:  g = tanh(r),  h = 1 − tanh²(r) = 1/cosh²(r).")
print("   При больших |r| g → ±1 (как у L1), а у нуля L ≈ r²/2 (как у L2) — отсюда «гладкая L1».")
L = lambda r: np.log(np.cosh(r))
eps = 1e-4
for r in (-3.0, -0.5, 0.0, 1.2):
    g_num = (L(r + eps) - L(r - eps)) / (2 * eps)
    h_num = (L(r + eps) - 2 * L(r) + L(r - eps)) / eps**2
    print(f"   r = {r:+.1f}: g = {np.tanh(r):+.5f} (численно {g_num:+.5f}), h = {1 - np.tanh(r) ** 2:.5f} (численно {h_num:.5f})")

# 2
y, F, target = 12.0, np.log(4.0), np.log(12.0)
print(f"2) точный минимум F* = log 12 = {target:.6f}")
for k in range(1, 6):
    g, h = np.exp(F) - y, np.exp(F)
    F = F - g / h
    print(f"   шаг {k}: F = {F:.6f}, ошибка {abs(F - target):.2e}")
print("   Первый шаг перелетает (e^F ≈ 29.6), дальше ошибка примерно возводится в квадрат — квадратичная сходимость.")
