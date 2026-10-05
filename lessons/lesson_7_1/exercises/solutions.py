"""Решения упражнений урока 7.1.

Запуск:  python lessons/lesson_7_1/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.metrics import mse

X, y = datasets.regression_1d(kind="wave", n=600, noise=0.6, seed=72)
X_test, y_test = datasets.regression_1d(kind="wave", n=3000, noise=0.6, seed=73)
X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)

# 1
m = GBRegressor(n_estimators=3000, learning_rate=0.01, max_depth=3).fit(X_tr, y_tr, eval_set=(X_val, y_val))
ev = np.array(m.history_["eval"])
glob = int(np.argmin(ev))
worst_gap, best = 0, 0
for i in range(1, glob + 1):
    if ev[i] < ev[best]:
        worst_gap = max(worst_gap, i - best)
        best = i
print(f"1) глобальный минимум на итерации {glob}; наибольшая пауза между улучшениями до него: {worst_gap}")
print(f"   ⇒ минимальное patience = {worst_gap}")

# 2
a = GBRegressor(n_estimators=1000, learning_rate=0.1, max_depth=3, early_stopping_rounds=50).fit(X_tr, y_tr, eval_set=(X_val, y_val))
folds = np.array_split(np.random.default_rng(0).permutation(len(y)), 5)
curves = []
for j in range(5):
    tr = np.concatenate([folds[i] for i in range(5) if i != j])
    curves.append(GBRegressor(n_estimators=400, learning_rate=0.1, max_depth=3).fit(X[tr], y[tr], eval_set=(X[folds[j]], y[folds[j]])).history_["eval"])
M_cv = int(np.argmin(np.mean(curves, axis=0)))
b = GBRegressor(n_estimators=M_cv, learning_rate=0.1, max_depth=3).fit(X, y)
print(f"2) (а) ранняя остановка на 70%: {a.n_trees_} деревьев, ½MSE теста {mse(y_test, a.predict(X_test)) / 2:.4f}")
print(f"   (б) CV + все данные:        {M_cv} деревьев, ½MSE теста {mse(y_test, b.predict(X_test)) / 2:.4f}")
