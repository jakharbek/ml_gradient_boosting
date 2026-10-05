"""Решения упражнений модуля 5.

Запуск:  python lessons/lesson_5/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets

for p in (0.0, 0.08, 0.2):
    X, y = datasets.regression_1d(kind="wave", n=300, noise=0.3, seed=51, outliers=p)
    X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
    clean = datasets.true_function("wave", X_te[:, 0])
    res = {}
    for loss in ("squared", "absolute", "huber"):
        m = GBRegressor(loss=loss, huber_delta=1.0, n_estimators=300, learning_rate=0.1, max_depth=2).fit(X_tr, y_tr)
        res[loss] = np.mean(np.abs(clean - m.predict(X_te)))
    best = min(res, key=res.get)
    print(f"1) выбросы {p:.0%}: " + ", ".join(f"{k} {v:.3f}" for k, v in res.items()) + f"  → лучше всех: {best}")
print("   С ростом доли выбросов ошибка L2 растёт быстрее всех, L1 почти не меняется. Хьюбер с δ = 1 — между ними:")
print("   градиент выброса ограничен δ, но все выбросы тянут модель в одну сторону с одинаковой силой δ.")
print("   Без выбросов разница между потерями мала и зависит от конкретных данных.")
