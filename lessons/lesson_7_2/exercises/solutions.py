"""Решения упражнений урока 7.2.

Запуск:  python lessons/lesson_7_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets

for N in (150, 400, 1500):
    X, y = datasets.friedman1(n=N, noise=1.0, seed=74)
    res = {}
    for s in (1.0, 0.2):
        best = [min(GBRegressor(n_estimators=400, learning_rate=0.1, max_depth=3, subsample=s, seed=1).fit(a, c, eval_set=(b, d)).history_["eval"])
                for a, b, c, d in (datasets.train_test_split(X, y, test_size=0.3, seed=k) for k in range(3))]
        res[s] = np.mean(best)
    verdict = "подвыборка 0.2 вредит" if res[0.2] > res[1.0] else "подвыборка 0.2 помогает"
    print(f"1) N = {N:4d}: subsample 1.0 → {res[1.0]:.3f}, 0.2 → {res[0.2]:.3f}  ({verdict})")
print("   На маленьких шумных данных сильная регуляризация ценнее всего — подвыборка помогает даже при 0.2.")
print("   С ростом данных переобучение слабее, и лишняя случайность начинает немного вредить.")
