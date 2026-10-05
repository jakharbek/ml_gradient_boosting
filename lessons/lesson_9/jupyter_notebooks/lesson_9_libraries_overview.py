# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_9

# %% [markdown]
# # Урок 9. Библиотеки бустинга: XGBoost, LightGBM, CatBoost
#
# **Интерактивная версия:** `lessons/lesson_9/web/index.html`
#
# 1. Значения параметров по умолчанию — прямо из установленных библиотек (источник словаря в уроке).
# 2. Одна задача — три библиотеки с параметрами по умолчанию.

# %%
import sys
import json
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
import catboost as cb
import lightgbm as lgb
import xgboost as xgb
from gbcourse import datasets

print("XGBoost", xgb.__version__, "| LightGBM", lgb.__version__, "| CatBoost", cb.__version__)

# %% [markdown]
# ## 1. Значения по умолчанию
#
# XGBoost хранит их в конфигурации обученной модели, LightGBM — в параметрах sklearn-обёртки,
# CatBoost — в `get_all_params()` (часть значений CatBoost выбирает по данным, например темп).

# %%
X, y = datasets.friedman1(n=2000, noise=1.0, seed=91)

xm = xgb.XGBRegressor().fit(X, y)
tp = json.loads(xm.get_booster().save_config())["learner"]["gradient_booster"]["tree_train_param"]
print("XGBoost:", {k: tp[k] for k in ["eta", "max_depth", "max_leaves", "lambda", "alpha", "gamma", "min_child_weight",
                                      "subsample", "colsample_bytree", "colsample_bynode", "max_bin", "grow_policy"]})
print("   деревьев по умолчанию:", len(xm.get_booster().get_dump()))

lp = lgb.LGBMRegressor().get_params()
print("LightGBM:", {k: lp[k] for k in ["n_estimators", "learning_rate", "num_leaves", "max_depth", "min_child_samples",
                                       "min_child_weight", "reg_lambda", "reg_alpha", "min_split_gain", "subsample",
                                       "subsample_freq", "colsample_bytree"]})

cp = cb.CatBoostRegressor(verbose=0).fit(X, y).get_all_params()
print("CatBoost:", {k: cp[k] for k in ["iterations", "learning_rate", "depth", "l2_leaf_reg", "border_count", "grow_policy",
                                       "min_data_in_leaf", "bootstrap_type", "subsample", "rsm", "random_seed"]})
print("   max_leaves при grow_policy='Lossguide':",
      cb.CatBoostRegressor(verbose=0, iterations=5, grow_policy="Lossguide").fit(X, y).get_all_params()["max_leaves"])

# %% [markdown]
# ## 2. Одна задача — три библиотеки
#
# Всё по умолчанию. Это не соревнование (для него — урок 9.4), а первое знакомство с интерфейсами.

# %%
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
models = {
    "XGBoost": xgb.XGBRegressor(),
    "LightGBM": lgb.LGBMRegressor(verbose=-1),
    "CatBoost": cb.CatBoostRegressor(verbose=0, random_seed=0),
}
rows = []
for name, m in models.items():
    m.fit(X_tr, y_tr)
    rows.append({"библиотека": name, "MSE на тесте": np.mean((y_te - m.predict(X_te)) ** 2)})
pd.DataFrame(rows).round(3)

# %% [markdown]
# ## Упражнения
#
# 1. Найдите в документации и проверьте в коде: как называется в каждой библиотеке параметр «доля признаков на дерево»?
# 2. Обучите XGBoost с параметрами, близкими к умолчаниям LightGBM (`learning_rate=0.1`, `max_leaves=31`,
#    `grow_policy="lossguide"`, `max_depth=0`, `reg_lambda=0`), и сравните с LightGBM.
#
# Решения: `python lessons/lesson_9/exercises/solutions.py`.
