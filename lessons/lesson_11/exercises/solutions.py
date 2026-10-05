"""Решения упражнений урока 11.

Запуск:  python lessons/lesson_11/exercises/solutions.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import numpy as np
import pandas as pd

from gbcourse import datasets

# 1
Xc, yc = datasets.classification_2d(kind="moons", n=10000, noise=0.3, seed=171)
Xc = np.column_stack([Xc, np.random.default_rng(171).normal(size=(len(yc), 8))])
perm = np.random.default_rng(0).permutation(len(yc))
tr, va = perm[:6000], perm[6000:8000]
table = {}
for lr in (0.03, 0.1, 0.3):
    for leaves in (2, 4, 8, 16, 32, 64):
        m = lgb.LGBMClassifier(n_estimators=5000, learning_rate=lr, num_leaves=leaves, verbose=-1)
        m.fit(Xc[tr], yc[tr], eval_X=(Xc[va],), eval_y=(yc[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
        table.setdefault(f"ν={lr}", {})[leaves] = min(m.evals_result_["valid_0"]["binary_logloss"])
df = pd.DataFrame(table).T
print("1) log-loss на валидации:\n", df.round(4).to_string())
i, j = np.unravel_index(np.argmin(df.values), df.shape)
print(f"   лучшая клетка: {df.index[i]}, листьев {df.columns[j]}")

# 2
X, y = datasets.friedman1(n=4000, noise=1.0, seed=170)
perm = np.random.default_rng(0).permutation(len(y))
tr, va = perm[:2400], perm[2400:3200]
res = {}
for lr in (0.01, 0.1):
    t0 = time.perf_counter()
    m = lgb.LGBMRegressor(n_estimators=10000, learning_rate=lr, num_leaves=4, min_child_samples=10, verbose=-1)
    m.fit(X[tr], y[tr], eval_X=(X[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
    res[lr] = (time.perf_counter() - t0, np.sqrt(min(m.evals_result_["valid_0"]["l2"])), m.best_iteration_)
    print(f"2) ν = {lr}: {res[lr][0]:.2f} с, RMSE {res[lr][1]:.3f}, деревьев {res[lr][2]}")
print(f"   время отличается в {res[0.01][0] / res[0.1][0]:.1f} раза, RMSE — на {res[0.01][1] - res[0.1][1]:+.3f}")
