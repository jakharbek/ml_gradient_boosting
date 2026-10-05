"""Решения упражнений модуля 3.

Запуск:  python lessons/lesson_3/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

from gbcourse import BaggingTrees, GBRegressor, datasets
from gbcourse.metrics import mse

X, y = datasets.regression_1d(kind="wave", n=80, noise=0.4, seed=21)
X_te, y_te = datasets.regression_1d(kind="wave", n=2000, noise=0.4, seed=22)
bag = BaggingTrees(n_estimators=300, max_depth=None, seed=1).fit(X, y)
bag_mse = mse(y_te, bag.predict(X_te))

# 1
gb = GBRegressor(n_estimators=300, learning_rate=0.1, max_depth=3).fit(X, y)
curve = [mse(y_te, F) for F in gb.staged_predict_raw(X_te)]
first = next((m + 1 for m, v in enumerate(curve) if v < bag_mse), None)
best = min(range(len(curve)), key=curve.__getitem__) + 1
print(f"1) бэггинг: {bag_mse:.4f}; бустинг глубины 3 обгоняет его с {first} деревьев; минимум при {best} деревьях "
      f"({curve[best - 1]:.4f}), при 300 — {curve[-1]:.4f}")

# 2
shallow = BaggingTrees(n_estimators=300, max_depth=2, seed=1).fit(X, y)
print(f"2) бэггинг глубины 2: {mse(y_te, shallow.predict(X_te)):.4f} против {bag_mse:.4f} у глубоких.")
print("   Мелкие деревья — большое смещение; усреднение уменьшает только разброс, а смещение у среднего то же.")

# 3
rho = 0.3
B = math.ceil((1 - rho) / (0.1 * rho))
print(f"3) (1−ρ)/B < 0.1·ρ ⇒ B > (1−ρ)/(0.1ρ) = {(1 - rho) / (0.1 * rho):.1f} ⇒ B = {B}")
