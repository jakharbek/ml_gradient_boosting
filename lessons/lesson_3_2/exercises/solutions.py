"""Решения упражнений урока 3.2.

Запуск:  python lessons/lesson_3_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import AdaBoost, Mulberry32, datasets
from gbcourse.metrics import accuracy

# 1
print("1) Σ_ошибки w·e^α / (Σ_ошибки w·e^α + Σ_верные w·e^−α) = εe^α / (εe^α + (1−ε)e^−α);")
print("   при e^{2α} = (1−ε)/ε числитель и второе слагаемое знаменателя равны ⇒ доля = 1/2.")
X, y = datasets.classification_2d("circles", n=160, noise=0.15, seed=5)
ada = AdaBoost(n_estimators=5).fit(X, y)
ys = np.where(y > 0, 1, -1)
for m in range(3):
    pred = np.where(ada.trees_[m].predict(X) >= 0, 1, -1)
    w_after = ada.weights_[m + 1]
    print(f"   шаг {m + 1}: ошибка пня по новым весам = {w_after[pred != ys].sum():.6f}")

# 2 и 3
X, y = datasets.classification_2d("circles", n=400, noise=0.15, seed=5)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
for label, nu, M in (("2)", 1.0, 200), ("3)", 0.1, 200), ("3)", 0.1, 2000)):
    row = []
    for frac in (0.0, 0.05, 0.10, 0.20):
        rng = Mulberry32(7)
        flip = np.array([rng.random() < frac for _ in range(len(y_tr))])
        yy = np.where(flip, 1 - y_tr, y_tr)
        m = AdaBoost(n_estimators=M, learning_rate=nu).fit(X_tr, yy)
        row.append(f"{frac:.0%}: {accuracy(y_te, m.predict(X_te)):.3f}")
    print(f"{label} ν = {nu}, {M} пней: " + ", ".join(row))
print("   Вывод по этим данным: маленький шаг сам по себе не защищает от шума в метках — при том же")
print("   числе пней он недообучается, а с большим бюджетом приходит к тому же качеству. Шум поражает")
print("   сами экспоненциальные потери; помогают более мягкие потери (логистические, урок 3.3) и ранняя остановка.")
