"""Решения упражнений урока 9.

Запуск:  python lessons/lesson_9/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import catboost as cb
import lightgbm as lgb
import numpy as np
import xgboost as xgb

from gbcourse import datasets

X, y = datasets.friedman1(n=2000, noise=1.0, seed=91)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
mse = lambda m: float(np.mean((y_te - m.predict(X_te)) ** 2))

# 1
print("1) XGBoost: colsample_bytree, LightGBM: colsample_bytree (feature_fraction), CatBoost: rsm")
pairs = [
    ("XGBoost", xgb.XGBRegressor(random_state=0), xgb.XGBRegressor(colsample_bytree=0.5, random_state=0)),
    ("LightGBM", lgb.LGBMRegressor(verbose=-1, random_state=0), lgb.LGBMRegressor(colsample_bytree=0.5, verbose=-1, random_state=0)),
    ("CatBoost", cb.CatBoostRegressor(verbose=0, random_seed=0), cb.CatBoostRegressor(rsm=0.5, verbose=0, random_seed=0)),
]
for name, base, half in pairs:
    print(f"   {name:9s} MSE по умолчанию {mse(base.fit(X_tr, y_tr)):.3f}, с долей признаков 0.5: {mse(half.fit(X_tr, y_tr)):.3f}")

# 2
like_lgb = xgb.XGBRegressor(learning_rate=0.1, grow_policy="lossguide", max_leaves=31, max_depth=0, reg_lambda=0,
                            min_child_weight=1e-3).fit(X_tr, y_tr)
print(f"2) XGBoost «как LightGBM»: {mse(like_lgb):.3f}; LightGBM: {mse(lgb.LGBMRegressor(verbose=-1).fit(X_tr, y_tr)):.3f}; "
      f"XGBoost по умолчанию: {mse(xgb.XGBRegressor().fit(X_tr, y_tr)):.3f}")
print("   Остаются различия: min_child_samples = 20 у LightGBM (у XGBoost нет аналога), разные корзины")
print("   гистограмм (256 против 255 и разные алгоритмы границ), порядок выбора листьев при равных выигрышах.")
