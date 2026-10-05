"""Решения упражнений модуля 6.

Запуск:  python lessons/lesson_6/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBClassifier, datasets

X, y = datasets.classification_2d(kind="moons", n=300, noise=0.25, seed=61)
X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)
m = GBClassifier(n_estimators=300, learning_rate=0.3, max_depth=2).fit(X_tr, y_tr, eval_set=(X_val, y_val))
acc = [np.mean((F > 0).astype(int) == y_val) for F in m.staged_predict_raw(X_val)]
best_acc = int(np.argmax(acc)) + 1
print(f"1) по log-loss: {m.best_iteration_} деревьев; по точности: {best_acc} (точность {max(acc):.3f})")
print("   Не совпадают. Точность на 90 объектах меняется ступеньками по 1/90 и зависит только от знака F —")
print("   её максимум легко приходится на случайную итерацию. Log-loss гладкий и учитывает уверенность")
print("   прогнозов, поэтому для ранней остановки надёжнее он, а точность — метрика для отчёта.")
