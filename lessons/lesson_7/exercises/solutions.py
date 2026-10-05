"""Решения упражнений модуля 7.

Запуск:  python lessons/lesson_7/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets

X, y = datasets.regression_1d(kind="wave", n=400, noise=0.6, seed=71)
base = dict(learning_rate=1.0, max_depth=6)
single = {
    "свободная": {},
    "только ν = 0.05": dict(learning_rate=0.05),
    "только глубина 2": dict(max_depth=2),
    "только subsample 0.5": dict(subsample=0.5, seed=1),
    "только min_leaf 10": dict(min_samples_leaf=10),
}
res = {}
for name, kw in single.items():
    params = {**base, **kw}
    best = [min(GBRegressor(n_estimators=400, **params).fit(a, c, eval_set=(b, d)).history_["eval"])
            for a, b, c, d in (datasets.train_test_split(X, y, test_size=0.3, seed=s) for s in range(5))]
    res[name] = np.mean(best)
    print(f"1) {name:22s}: {res[name]:.4f}")
top = min((k for k in res if k != "свободная"), key=res.get)
print(f"   В одиночку лучше всего помогает: {top}")
