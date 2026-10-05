"""Три библиотеки на одной задаче: кривые ошибки на тесте по числу деревьев (параметры по умолчанию, темп 0.1).

Запуск:  python lessons/lesson_9/examples/three_libraries.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import catboost as cb
import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np
import xgboost as xgb

from gbcourse import datasets
from gbcourse.cli import Example

ex = Example(__file__)

X, y = datasets.friedman1(n=2000, noise=1.0, seed=91)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
M = 500
curves = {}

m = xgb.XGBRegressor(n_estimators=M, learning_rate=0.1, eval_metric="rmse").fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=False)
curves["XGBoost"] = np.array(m.evals_result()["validation_0"]["rmse"]) ** 2

m = lgb.LGBMRegressor(n_estimators=M, learning_rate=0.1, verbose=-1).fit(X_tr, y_tr, eval_X=(X_te,), eval_y=(y_te,), eval_metric="l2")
curves["LightGBM"] = np.array(m.evals_result_["valid_0"]["l2"])

m = cb.CatBoostRegressor(iterations=M, learning_rate=0.1, verbose=0, random_seed=0).fit(X_tr, y_tr, eval_set=(X_te, y_te))
curves["CatBoost"] = np.array(m.get_evals_result()["validation"]["RMSE"]) ** 2

fig, ax = plt.subplots(figsize=(8, 4))
for name, c in curves.items():
    k = int(np.argmin(c))
    ax.plot(np.arange(1, len(c) + 1), c, label=f"{name}: минимум {c[k]:.3f} на {k + 1}-м дереве")
    print(f"{name:9s} лучшая MSE на тесте {c[k]:.3f} (деревьев: {k + 1}), после {M}: {c[-1]:.3f}")
ax.set(yscale="log", xlabel="число деревьев", ylabel="MSE на тесте", title="Одна задача, три библиотеки, темп 0.1")
ax.legend()
fig.tight_layout()
ex.finish(fig, "three_libraries")
