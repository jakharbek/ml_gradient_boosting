# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_7_2

# %% [markdown]
# # Урок 7.2. Стохастический бустинг: подвыборки строк и признаков
#
# **Интерактивная версия:** `lessons/lesson_7_2/web/index.html`
#
# 1. subsample × темп обучения: сетка, среднее по разбиениям.
# 2. colsample на данных с шумовыми признаками.
# 3. Скорость.
# 4. Библиотеки: sklearn, XGBoost, LightGBM.

# %%
import sys
import time
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from gbcourse import datasets, GBRegressor
from gbcourse.metrics import mse
from gbcourse.plotting import use_course_style

use_course_style()
X, y = datasets.friedman1(n=400, noise=1.0, seed=74)

# %% [markdown]
# ## 1. subsample × темп

# %%
def best_val(**kw):
    out = []
    for split in range(3):
        a, b, c, d = datasets.train_test_split(X, y, test_size=0.3, seed=split)
        M = 400 if kw.get("learning_rate", 0.1) < 0.5 else 80
        out.append(min(GBRegressor(n_estimators=M, max_depth=3, seed=1, **kw).fit(a, c, eval_set=(b, d)).history_["eval"]))
    return np.mean(out)


table = pd.DataFrame({f"subsample {s}": [best_val(learning_rate=lr, subsample=s) for lr in (1.0, 0.1)] for s in (1.0, 0.8, 0.5)},
                     index=["ν = 1", "ν = 0.1"])
table.round(3)

# %% [markdown]
# ## 2. colsample: помогает ли на данных с шумовыми признаками?

# %%
pd.Series({f"colsample {c}": best_val(learning_rate=0.1, colsample=c) for c in (1.0, 0.7, 0.5, 0.3)}).round(3)

# %% [markdown]
# ## 3. Скорость (scikit-learn, 20 000 объектов)

# %%
Xb, yb = datasets.friedman1(n=20000, noise=1.0, seed=1)
for s in (1.0, 0.5, 0.2):
    t0 = time.perf_counter()
    GradientBoostingRegressor(n_estimators=100, max_depth=3, subsample=s, random_state=0).fit(Xb, yb)
    print(f"subsample {s}: {time.perf_counter() - t0:.2f} с")

# %% [markdown]
# ## 4. Библиотеки

# %%
import lightgbm as lgb
import xgboost as xgb

a, b, c, d = datasets.train_test_split(X, y, test_size=0.3, seed=0)
models = {
    "sklearn subsample=0.5": GradientBoostingRegressor(n_estimators=300, max_depth=3, subsample=0.5, random_state=0),
    "XGBoost subsample=0.5, colsample_bytree=0.7": xgb.XGBRegressor(n_estimators=300, max_depth=3, learning_rate=0.1, subsample=0.5, colsample_bytree=0.7, random_state=0),
    "LightGBM bagging 0.5 (freq 1)": lgb.LGBMRegressor(n_estimators=300, num_leaves=8, learning_rate=0.1, subsample=0.5, subsample_freq=1, verbose=-1, random_state=0),
}
for name, m in models.items():
    print(f"{name:45s} MSE {mse(d, m.fit(a, c).predict(b)):.3f}")

# %% [markdown]
# ## Упражнения
#
# 1. Повторите таблицу п. 1 для subsample = 0.2. На каком размере данных маленькая подвыборка начинает вредить?
#
# Решения: `python lessons/lesson_7_2/exercises/solutions.py`.
