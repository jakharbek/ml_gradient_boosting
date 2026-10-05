"""Решения упражнений урока 3.1.

Запуск:  python lessons/lesson_3_1/exercises/solutions.py
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import BaggingTrees, GBRegressor, datasets
from gbcourse.metrics import accuracy, mse

X, y = datasets.friedman1(n=300, noise=1.0, seed=31)
X_te, y_te = datasets.friedman1(n=3000, noise=1.0, seed=32)

# 1
t0 = time.perf_counter()
rf = BaggingTrees(n_estimators=100, max_depth=None, max_features=0.3, seed=0).fit(X, y)
oob = rf.oob_predict(X)
t_oob = time.perf_counter() - t0
t0 = time.perf_counter()
perm = np.random.default_rng(0).permutation(len(y))
errs = []
for f in np.array_split(perm, 5):
    tr = np.setdiff1d(perm, f)
    m = BaggingTrees(n_estimators=100, max_depth=None, max_features=0.3, seed=0).fit(X[tr], y[tr])
    errs.append(mse(y[f], m.predict(X[f])))
t_cv = time.perf_counter() - t0
ok = ~np.isnan(oob)
print(f"1) OOB MSE {mse(y[ok], oob[ok]):.3f} за {t_oob:.1f} с; 5-fold CV {np.mean(errs):.3f} за {t_cv:.1f} с; тест {mse(y_te, rf.predict(X_te)):.3f}")

# 2
Xs, ys = datasets.classification_2d("spiral", n=400, noise=0.05, seed=3)
Xtr, Xv, ytr, yv = datasets.train_test_split(Xs, ys, test_size=0.3, seed=0)
for mf in (0.5, 1.0):
    f = BaggingTrees(n_estimators=200, max_depth=None, max_features=mf, seed=0).fit(Xtr, ytr)
    print(f"2) max_features={mf}: точность {accuracy(yv, (f.predict(Xv) > 0.5).astype(int)):.3f}")
print("   Признаков всего два: доля 0.5 — один случайный признак в узле, 1.0 — оба.")

# 3
forest = BaggingTrees(n_estimators=300, max_depth=3, max_features=0.3, seed=0).fit(X, y)
boost = GBRegressor(n_estimators=300, learning_rate=0.1, max_depth=3).fit(X, y)
print(f"3) лес глубины 3: {mse(y_te, forest.predict(X_te)):.3f}; бустинг глубины 3: {mse(y_te, boost.predict(X_te)):.3f}")
print("   Мелкие деревья смещены; лес усредняет смещённые модели и остаётся смещённым, бустинг смещение убирает.")
