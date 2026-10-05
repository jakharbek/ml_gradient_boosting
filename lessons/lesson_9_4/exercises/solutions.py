"""Решения упражнений урока 9.4.

Запуск:  python lessons/lesson_9_4/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import catboost as cb
import lightgbm as lgb
import numpy as np
import xgboost as xgb

from gbcourse import datasets

X, y = datasets.friedman1(n=5000, noise=1.0, seed=120)


def protocol(lr, libs):
    out = {k: [] for k in libs}
    for seed in range(3):
        perm = np.random.default_rng(seed).permutation(len(y))
        tr, va, te = perm[:3000], perm[3000:4000], perm[4000:]
        rmse = lambda p, te=te: float(np.sqrt(np.mean((y[te] - p) ** 2)))
        if "XGBoost" in libs:
            m = xgb.XGBRegressor(n_estimators=5000, learning_rate=lr, early_stopping_rounds=100, random_state=seed)
            m.fit(X[tr], y[tr], eval_set=[(X[va], y[va])], verbose=False)
            out["XGBoost"].append(rmse(m.predict(X[te])))
        if "LightGBM" in libs:
            m = lgb.LGBMRegressor(n_estimators=5000, learning_rate=lr, verbose=-1, random_state=seed)
            m.fit(X[tr], y[tr], eval_X=(X[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
            out["LightGBM"].append(rmse(m.predict(X[te])))
        if "CatBoost" in libs:
            m = cb.CatBoostRegressor(iterations=5000, learning_rate=lr, early_stopping_rounds=100, verbose=0, random_seed=seed)
            m.fit(X[tr], y[tr], eval_set=(X[va], y[va]))
            out["CatBoost"].append(rmse(m.predict(X[te])))
    return {k: (np.mean(v), np.std(v)) for k, v in out.items()}


# 1
r = protocol(0.05, ["CatBoost"])
print(f"1) CatBoost, темп 0.05: RMSE {r['CatBoost'][0]:.3f} ± {r['CatBoost'][1]:.3f} "
      "— совпадает с бенчмарком: разбиения те же (перестановки с теми же зёрнами).")

# 2
for lr in (0.05, 0.1):
    r = protocol(lr, ["XGBoost", "LightGBM"])
    print(f"2) темп {lr}: " + ", ".join(f"{k} {m:.3f} ± {s:.3f}" for k, (m, s) in r.items()))
