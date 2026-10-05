"""Решения упражнений модуля 4.

Запуск:  python lessons/lesson_4/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets

X, y = datasets.regression_1d(kind="wave", n=100, noise=0.35, seed=42)

# 1
m = GBRegressor(n_estimators=150, learning_rate=0.1, max_depth=2).fit(X, y)
h = np.array(m.history_["train"])
k = int(np.argmax(h < h[0] / 2))
print(f"1) потери F0 = {h[0]:.4f}; меньше половины после {k} деревьев ({h[k]:.4f})")

# 2
X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)
for nu in (0.1, 1.0):
    mdl = GBRegressor(n_estimators=150, learning_rate=nu, max_depth=2).fit(X_tr, y_tr, eval_set=(X_val, y_val))
    ev = mdl.history_["eval"]
    print(f"2) ν = {nu}: лучшая итерация {mdl.best_iteration_}, потери на валидации {min(ev):.4f}, после 150 деревьев {ev[-1]:.4f}")
