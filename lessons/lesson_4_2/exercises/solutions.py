"""Решения упражнений урока 4.2.

Запуск:  python lessons/lesson_4_2/exercises/solutions.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

from gbcourse import GBRegressor, datasets

X, y = datasets.regression_1d(kind="wave", n=200, noise=0.5, seed=7)
X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)

# 1
for depth in range(1, 7):
    m = GBRegressor(n_estimators=800, learning_rate=0.1, max_depth=depth).fit(X_tr, y_tr, eval_set=(X_val, y_val))
    print(f"1) глубина {depth}: M* = {m.best_iteration_:4d}, лучшая ½MSE = {min(m.history_['eval']):.4f}")
print("   Глубже дерево — каждое делает больше работы, поэтому M* меньше; слишком глубокие быстрее переобучаются.")

# 2
for nu in (1.0, 0.3, 0.1, 0.03, 0.01):
    t0 = time.perf_counter()
    GBRegressor(n_estimators=round(60 / nu), learning_rate=nu, max_depth=3).fit(X_tr, y_tr)
    print(f"2) ν = {nu:5}: {round(60 / nu):5d} деревьев за {time.perf_counter() - t0:.2f} с")
print("   Время растёт как 1/ν; выбирайте наименьший ν, который укладывается в бюджет с запасом на подбор.")
