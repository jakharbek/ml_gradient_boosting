"""Решения упражнений урока 9.1.

Запуск:  python lessons/lesson_9_1/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np
import xgboost as xgb

from gbcourse import datasets

X, y = datasets.friedman1(n=1000, noise=1.0, seed=92)
X_tr, X_val, y_tr, y_val = X[:700], X[700:], y[:700], y[700:]

# 1
dtr, dval = xgb.DMatrix(X_tr, label=y_tr), xgb.DMatrix(X_val, label=y_val)
bst = xgb.train({"eta": 0.3, "eval_metric": "rmse"}, dtr, num_boost_round=1000, evals=[(dval, "val")],
                early_stopping_rounds=20, verbose_eval=False)
p_native = bst.predict(dval, iteration_range=(0, bst.best_iteration + 1))
sk = xgb.XGBRegressor(n_estimators=1000, learning_rate=0.3, early_stopping_rounds=20, eval_metric="rmse")
sk.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
print(f"1) best_iteration: нативный {bst.best_iteration}, sklearn {sk.best_iteration}; "
      f"прогнозы совпадают: {np.allclose(p_native, sk.predict(X_val))}")

# 2
Xi = np.column_stack([X, np.arange(len(y), dtype=float)])
m = xgb.XGBRegressor(n_estimators=100, learning_rate=0.3).fit(Xi[:700], y[:700])
b = m.get_booster()
for kind in ("weight", "total_gain"):
    score = b.get_score(importance_type=kind)
    vals = np.array([score.get(f"f{i}", 0.0) for i in range(11)])
    rank = int((vals > vals[10]).sum()) + 1
    print(f"2) {kind:10s}: идентификатор на {rank}-м месте из 11 (значение {vals[10]:.1f}, максимум {vals.max():.1f})")
