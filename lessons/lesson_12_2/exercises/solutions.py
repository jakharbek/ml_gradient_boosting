"""Решения упражнений урока 12.2.

Запуск:  python lessons/lesson_12_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.explain import shapley_values

# 1
print("1) v(∅) = E[X0 X1] = 1/4; v({0}) = 1·E[X1] = 1/2; v({1}) = 1/2; v({0,1}) = 1.")
print("   φ0 = ½[(v({0}) − v(∅)) + (v({0,1}) − v({1}))] = ½(1/4 + 1/2) = 3/8; φ1 = 3/8 по симметрии.")
print("   Проверка: 1/4 + 3/8 + 3/8 = 1 = F(1, 1); взаимодействие поделено поровну.")
rng = np.random.default_rng(0)
Z = rng.uniform(0, 1, (4000, 2))
m = GBRegressor(n_estimators=300, max_depth=3, learning_rate=0.1).fit(Z, Z[:, 0] * Z[:, 1])
base, phi = shapley_values(m, np.array([0.99, 0.99]))
print(f"   бустинг, объект (0.99, 0.99): φ₀ = {base:.3f} (≈ 0.25), φ = {np.round(phi, 3)} (≈ 0.37 каждый)")

# 2
X, y = datasets.friedman1(n=600, noise=1.0, seed=180, n_features=7)
Xc = np.c_[X, np.full(len(y), 0.5)]
m = GBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1).fit(Xc, y)
worst = max(abs(shapley_values(m, Xc[i])[1][7]) for i in range(20))
print(f"2) наибольший |φ| признака-константы по 20 объектам: {worst}")
print("   У константы нет ни одного порога, который делил бы объекты, — дерево её не использует, и она нулевой игрок.")
