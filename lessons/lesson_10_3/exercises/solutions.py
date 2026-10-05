"""Решения упражнений урока 10.3.

Запуск:  python lessons/lesson_10_3/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import numpy as np
import xgboost as xgb

from gbcourse import datasets

X, y = datasets.regression_1d(kind="hetero", n=3000, noise=0.5, seed=161)
perm = np.random.default_rng(0).permutation(len(y))
tr, va, te = perm[:1400], perm[1400:2000], perm[2000:]
F0 = y[tr].mean()

# 1
a = 1.0
linex = lambda yy, F: np.exp(a * (yy - F)) - a * (yy - F) - 1
print("1) L = e^{ar} − ar − 1, r = y − F:  g = ∂L/∂F = −a(e^{ar} − 1),  h = a² e^{ar} > 0.")
eps = 1e-5
for F in (0.0, 1.5):
    y0 = 1.0
    r = y0 - F
    g_num = (linex(y0, F + eps) - linex(y0, F - eps)) / (2 * eps)
    h_num = (linex(y0, F + eps) - 2 * linex(y0, F) + linex(y0, F - eps)) / eps**2
    print(f"   F = {F}: g = {-a * (np.exp(a * r) - 1):+.5f} (численно {g_num:+.5f}), h = {a * a * np.exp(a * r):.5f} (численно {h_num:.5f})")


def linex_obj(preds, d):
    r = np.clip(d.get_label() - preds, -20, 20)  # защита от переполнения экспоненты
    return -a * (np.exp(a * r) - 1), a * a * np.exp(a * r)


def asym_obj(preds, d, alpha=5.0):
    r = d.get_label() - preds
    return np.where(r > 0, -alpha * r, -r), np.where(r > 0, alpha, 1.0)


dtr = xgb.DMatrix(X[tr], label=y[tr])
dte = xgb.DMatrix(X[te])
for name, obj in (("Linex, a = 1", linex_obj), ("асимм. квадратичная, α = 5", asym_obj)):
    bst = xgb.train({"eta": 0.05, "max_depth": 3, "base_score": F0}, dtr, num_boost_round=300, obj=obj)
    p = bst.predict(dte)
    print(f"   {name:27s}: доля недопрогнозов {np.mean(y[te] > p):.3f}, средний недопрогноз {np.mean(np.maximum(y[te] - p, 0)):.3f}")

# 2
alpha = 5.0
obj = lambda yt, yp: (np.where(yt - yp > 0, -alpha * (yt - yp), -(yt - yp)), np.where(yt - yp > 0, alpha, 1.0))
metrics = {
    "доля недопрогнозов > 1": lambda yt, yp: ("under1", float(np.mean(yt - yp > 1)), False),
    "асимметричная цена": lambda yt, yp: ("asym", float(np.mean(0.5 * np.where(yt - yp > 0, alpha, 1) * (yt - yp) ** 2)), False),
}
for name, met in metrics.items():
    # metric="None" отключает встроенную метрику: иначе остановка шла бы по ней, а не по нашей
    m = lgb.LGBMRegressor(n_estimators=2000, learning_rate=0.05, num_leaves=8, objective=obj, metric="None", verbose=-1)
    m.fit(X[tr], y[tr], init_score=np.full(len(tr), F0), eval_X=(X[va],), eval_y=(y[va],), eval_init_score=[np.full(len(va), F0)],
          eval_metric=met, callbacks=[lgb.early_stopping(100, verbose=False)])
    p = m.predict(X[te]) + F0
    print(f"2) остановка по «{name}»: деревьев {m.best_iteration_}, доля недопрогнозов > 1 на тесте {np.mean(y[te] - p > 1):.3f}")
