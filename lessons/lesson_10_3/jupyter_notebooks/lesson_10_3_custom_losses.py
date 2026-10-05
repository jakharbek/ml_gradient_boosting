# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_10_3

# %% [markdown]
# # Урок 10.3. Свои функции потерь и метрики
#
# **Интерактивная версия:** `lessons/lesson_10_3/web/index.html`
#
# 1. Асимметричная квадратичная потеря: g и h, проверка конечными разностями, экспектиль.
# 2. Та же потеря в XGBoost и LightGBM, своя метрика и ранняя остановка по ней.
# 3. Своя цель против встроенной: псевдо-Хьюбер в XGBoost.
# 4. Ловушки LightGBM: старт с нуля и init_score.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb
from gbcourse import datasets

ALPHA = 5.0


def asym_grad_hess(y, F, alpha=ALPHA):
    r = y - F
    return np.where(r > 0, -alpha * r, -r), np.where(r > 0, alpha, 1.0)


def asym_loss(y, F, alpha=ALPHA):
    r = y - F
    return 0.5 * np.where(r > 0, alpha, 1.0) * r * r


# %% [markdown]
# ## 1. Проверка g, h и лучшая константа

# %%
y0 = np.array([2.0])
for F0 in (0.5, 3.0):
    eps = 1e-5
    L = lambda f: asym_loss(y0, np.array([f]))[0]
    g, h = asym_grad_hess(y0, np.array([F0]))
    print(f"F = {F0}: g = {g[0]:+.4f} (численно {(L(F0 + eps) - L(F0 - eps)) / (2 * eps):+.4f}), "
          f"h = {h[0]:.4f} (численно {(L(F0 + eps) - 2 * L(F0) + L(F0 - eps)) / eps**2:.4f})")

yy = np.random.default_rng(0).normal(0, 1, 100_000)
grid = np.linspace(-1, 2, 3001)
best = grid[np.argmin([asym_loss(yy, np.full_like(yy, c)).mean() for c in grid])]
print(f"лучшая константа при α = {ALPHA}: {best:.3f}; доля y выше неё {np.mean(yy > best):.3f} "
      f"(экспектиль уровня {ALPHA / (1 + ALPHA):.3f} — не квантиль)")

# %% [markdown]
# ## 2. XGBoost и LightGBM с асимметричной целью и своей метрикой

# %%
X, y = datasets.regression_1d(kind="hetero", n=3000, noise=0.5, seed=161)
perm = np.random.default_rng(0).permutation(len(y))  # regression_1d упорядочен по x — перемешиваем!
tr, va, te = perm[:1400], perm[1400:2000], perm[2000:]
X_tr, X_va, X_te, y_tr, y_va, y_te = X[tr], X[va], X[te], y[tr], y[va], y[te]
F0 = y_tr.mean()

rows = []
# XGBoost, нативный интерфейс: своя цель и своя метрика (custom_metric) для ранней остановки
dtr, dva = xgb.DMatrix(X_tr, label=y_tr), xgb.DMatrix(X_va, label=y_va)
obj = lambda preds, d: asym_grad_hess(d.get_label(), preds)
metric = lambda preds, d: ("asym", float(asym_loss(d.get_label(), preds).mean()))
bst = xgb.train({"eta": 0.05, "max_depth": 3, "base_score": F0, "disable_default_eval_metric": 1}, dtr, num_boost_round=2000,
                obj=obj, custom_metric=metric, evals=[(dva, "val")], early_stopping_rounds=100, verbose_eval=False)
p = bst.predict(xgb.DMatrix(X_te), iteration_range=(0, bst.best_iteration + 1))
rows.append({"модель": "XGBoost, своя цель", "деревьев": bst.best_iteration + 1, "асим. цена": asym_loss(y_te, p).mean(), "доля недопрогнозов": np.mean(y_te > p)})

# LightGBM: своя цель, своя метрика, init_score
lmetric = lambda yt, yp: ("asym", float(asym_loss(yt, yp).mean()), False)
m = lgb.LGBMRegressor(n_estimators=2000, learning_rate=0.05, num_leaves=8, objective=lambda yt, yp: asym_grad_hess(yt, yp),
                      metric="None", verbose=-1)  # иначе остановка шла бы по встроенной L2
m.fit(X_tr, y_tr, init_score=np.full(len(y_tr), F0), eval_X=(X_va,), eval_y=(y_va,), eval_init_score=[np.full(len(y_va), F0)],
      eval_metric=lmetric, callbacks=[lgb.early_stopping(100, verbose=False)])
p = m.predict(X_te) + F0
rows.append({"модель": "LightGBM, своя цель", "деревьев": m.best_iteration_, "асим. цена": asym_loss(y_te, p).mean(), "доля недопрогнозов": np.mean(y_te > p)})

# Обычная L2 для сравнения
m2 = lgb.LGBMRegressor(n_estimators=2000, learning_rate=0.05, num_leaves=8, verbose=-1)
m2.fit(X_tr, y_tr, eval_X=(X_va,), eval_y=(y_va,), callbacks=[lgb.early_stopping(100, verbose=False)])
p = m2.predict(X_te)
rows.append({"модель": "LightGBM, L2", "деревьев": m2.best_iteration_, "асим. цена": asym_loss(y_te, p).mean(), "доля недопрогнозов": np.mean(y_te > p)})
pd.DataFrame(rows).round(3)

# %% [markdown]
# ## 3. Своя цель против встроенной: псевдо-Хьюбер в XGBoost

# %%
Xf, yf = datasets.friedman1(n=2000, noise=1.0, seed=160)
D = xgb.DMatrix(Xf, label=yf)


def pseudo_huber(preds, d):
    r = preds - d.get_label()
    s = 1 + r * r
    return r / np.sqrt(s), 1 / (s * np.sqrt(s))


P = {"max_depth": 3, "eta": 0.1, "tree_method": "exact", "base_score": float(np.median(yf))}
b_builtin = xgb.train({**P, "objective": "reg:pseudohubererror"}, D, 50)
b_custom = xgb.train(P, D, 50, obj=pseudo_huber)
print("наибольшее расхождение сырых прогнозов:", np.abs(b_builtin.predict(D, output_margin=True) - b_custom.predict(D, output_margin=True)).max())

# %% [markdown]
# ## 4. LightGBM: старт с нуля и init_score

# %%
print(f"среднее y на задаче Фридмана: {yf.mean():.2f}")
l2 = lambda yt, yp: (yp - yt, np.ones_like(yt))
rows = []
for n in (10, 100, 1000):
    a = lgb.LGBMRegressor(n_estimators=n, verbose=-1).fit(Xf, yf).predict(Xf)
    b = lgb.LGBMRegressor(n_estimators=n, objective=l2, verbose=-1).fit(Xf, yf).predict(Xf)
    c = lgb.LGBMRegressor(n_estimators=n, objective=l2, verbose=-1).fit(Xf, yf, init_score=np.full(len(yf), yf.mean())).predict(Xf)
    rows.append({"деревьев": n, "MSE встроенная": np.mean((yf - a) ** 2), "MSE своя L2": np.mean((yf - b) ** 2),
                 "своя + init_score: расхождение predict": np.abs(a - c).max(),
                 "своя + init_score + ȳ: расхождение": np.abs(a - (c + yf.mean())).max()})
pd.DataFrame(rows).round(4)

# %% [markdown]
# ## Упражнения
#
# 1. Реализуйте потерю Linex $L = e^{a r} - a r - 1$ ($r = y - F$) для XGBoost и сравните с асимметричной квадратичной.
# 2. Напишите метрику «доля недопрогнозов больше 1» и остановите по ней LightGBM.
#
# Решения: `python lessons/lesson_10_3/exercises/solutions.py`.
