"""Решения упражнений урока 6.3.

Запуск:  python lessons/lesson_6_3/exercises/solutions.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np
from sklearn.datasets import load_digits
from sklearn.ensemble import GradientBoostingClassifier

from gbcourse import GBClassifier, GradientBoosting, datasets

# 1
print("1) e^{F1}/(e^{F0} + e^{F1}) = 1/(1 + e^{−(F1 − F0)}) = σ(F1 − F0)")
X, y = datasets.classification_2d("moons", n=200, noise=0.25, seed=1)
p_bin = GBClassifier(n_estimators=50, learning_rate=0.2, max_depth=2).fit(X, y).predict_proba(X)[:, 1]
p_sm = GradientBoosting(loss="softmax", n_classes=2, n_estimators=50, learning_rate=0.2, max_depth=2).fit(X, y).predict_proba(X)[:, 1]
print(f"   макс. разница вероятностей: {np.abs(p_bin - p_sm).max():.2e}")
print("   Совпадают до округления. При K = 2 псевдо-остатки классов зеркальны (r₀ = −r₁), поэтому деревья")
print("   одинаковы по структуре и противоположны по значениям. Разность логитов F₁ − F₀ растёт на удвоенное")
print("   значение листа, а множитель (K−1)/K = ½ в шаге Фридмана ровно это компенсирует.")

# 2
Xd, yd = load_digits(return_X_y=True)
for name, target in (("10 классов", yd), ("0 против остальных", (yd == 0).astype(int))):
    t0 = time.perf_counter()
    GradientBoostingClassifier(n_estimators=100, max_depth=3).fit(Xd, target)
    print(f"2) {name:20s}: {time.perf_counter() - t0:.2f} с")
print("   Softmax строит K деревьев на итерацию — время растёт примерно в K раз.")
