# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_9_4

# %% [markdown]
# # Урок 9.4. Сравнение библиотек и выбор
#
# **Интерактивная версия:** `lessons/lesson_9_4/web/index.html`
#
# Полный бенчмарк (3 задачи × 3 библиотеки × 2 режима × 3 разбиения) выполняет скрипт
# `python lessons/lesson_9_4/examples/benchmark.py` — около 5 минут, в основном из-за CatBoost на категориях.
# Скрипт сохраняет результаты в `web/results.js`; здесь мы их загружаем и разбираем, а затем
# повторяем облегчённую версию протокола и проверяем странное время CatBoost.

# %%
import json
import sys
import time
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import catboost as cb
import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb
from gbcourse import datasets

# %% [markdown]
# ## 1. Результаты полного бенчмарка

# %%
text = (ROOT / "lessons" / "lesson_9_4" / "web" / "results.js").read_text(encoding="utf-8")
start = text.index(".benchmark = ") + len(".benchmark = ")
bench = json.loads(text[start: text.rindex(";\n})")])
print("версии:", bench["versions"])
rows = [{"задача": t["name"].split(",")[0], "метрика": t["metric"], **r} for t in bench["tasks"] for r in t["rows"]]
table = pd.DataFrame(rows).pivot_table(index=["задача", "lib"], columns="mode", values=["score", "time"], sort=False)
table.round(4)

# %% [markdown]
# ## 2. Облегчённый протокол: XGBoost и LightGBM на задаче Фридмана
#
# Разбиения те же, что в бенчмарке (перестановка с тем же зерном, 3000/1000/1000), поэтому числа должны совпасть.

# %%
X, y = datasets.friedman1(n=5000, noise=1.0, seed=120)
res = []
for seed in range(3):
    perm = np.random.default_rng(seed).permutation(len(y))
    tr, va, te = perm[:3000], perm[3000:4000], perm[4000:]
    rmse = lambda p, te=te: float(np.sqrt(np.mean((y[te] - p) ** 2)))
    m = xgb.XGBRegressor(n_estimators=5000, learning_rate=0.05, early_stopping_rounds=100, random_state=seed)
    m.fit(X[tr], y[tr], eval_set=[(X[va], y[va])], verbose=False)
    res.append({"разбиение": seed, "библиотека": "XGBoost", "RMSE": rmse(m.predict(X[te])), "деревьев": m.best_iteration + 1})
    m = lgb.LGBMRegressor(n_estimators=5000, learning_rate=0.05, verbose=-1, random_state=seed)
    m.fit(X[tr], y[tr], eval_X=(X[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
    res.append({"разбиение": seed, "библиотека": "LightGBM", "RMSE": rmse(m.predict(X[te])), "деревьев": m.best_iteration_})
res = pd.DataFrame(res)
res.groupby("библиотека")[["RMSE", "деревьев"]].agg(["mean", "std"]).round(3)

# %% [markdown]
# Сравните средние с разбросом между разбиениями, прежде чем делать вывод.
#
# ## 3. Время CatBoost с категориальным признаком
#
# В бенчмарке CatBoost с категорией обучался в сотни раз дольше. Проверим, от чего зависит время:
# от числа строк или от числа деревьев.

# %%
x, cat, yc = datasets.categorical_regression(n=5000, n_categories=100, noise=1.0, seed=122)
rows = []
for n in (1000, 3000):
    for it in (20, 200):
        for with_cat in (True, False):
            df = pd.DataFrame({"x": x, "c": cat.astype(str) if with_cat else cat})[:n]
            t0 = time.perf_counter()
            cb.CatBoostRegressor(iterations=it, verbose=0, cat_features=["c"] if with_cat else None).fit(df, yc[:n])
            rows.append({"строк": n, "деревьев": it, "категория как": "категория" if with_cat else "число",
                         "время, с": time.perf_counter() - t0})
pd.DataFrame(rows).pivot_table(index=["строк", "деревьев"], columns="категория как", values="время, с").round(2)

# %% [markdown]
# Время почти не зависит от числа строк и растёт с числом деревьев: в нашем окружении (CatBoost 1.2.10)
# на каждое дерево уходит порядка десятков миллисекунд накладных расходов при наличии категориального признака.
# На другой машине и версии цифры могут отличаться — поэтому время всегда измеряют на своих данных.
#
# ## Упражнения
#
# 1. Добавьте в облегчённый протокол CatBoost (с ранней остановкой) и сравните с результатами бенчмарка.
# 2. Повторите раздел 2 с `learning_rate=0.1`. Изменился ли вывод о лидере?
#
# Решения: `python lessons/lesson_9_4/exercises/solutions.py`.
