# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_9_1

# %% [markdown]
# # Урок 9.1. XGBoost на практике
#
# **Интерактивная версия:** `lessons/lesson_9_1/web/index.html`
#
# 1. Два интерфейса дают одинаковые деревья.
# 2. Ранняя остановка: best_iteration, лишние деревья, iteration_range.
# 3. Пять видов важности.
# 4. Категориальные признаки.
# 5. Сохранение и загрузка.
# 6. Лаборатория из урока — в настоящем XGBoost.

# %%
import sys
import tempfile
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
import xgboost as xgb
from gbcourse import datasets, GBRegressor

X, y = datasets.friedman1(n=1000, noise=1.0, seed=92)
X_tr, X_val, y_tr, y_val = X[:700], X[700:], y[:700], y[700:]

# %% [markdown]
# ## 1. Два интерфейса

# %%
params = dict(learning_rate=0.3, max_depth=4, reg_lambda=1.0, tree_method="exact", base_score=float(y_tr.mean()))
sk = xgb.XGBRegressor(n_estimators=50, **params).fit(X_tr, y_tr)
native = xgb.train({"eta": 0.3, "max_depth": 4, "lambda": 1.0, "tree_method": "exact", "base_score": float(y_tr.mean())},
                   xgb.DMatrix(X_tr, label=y_tr), num_boost_round=50)
print("прогнозы совпадают:", np.allclose(sk.predict(X_val), native.predict(xgb.DMatrix(X_val))))
print("xgb.train без num_boost_round строит деревьев:",
      xgb.train({"eta": 0.3}, xgb.DMatrix(X_tr, label=y_tr)).num_boosted_rounds())

# %% [markdown]
# ## 2. Ранняя остановка

# %%
m = xgb.XGBRegressor(n_estimators=1000, learning_rate=0.3, early_stopping_rounds=20, eval_metric="rmse")
m.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
b = m.get_booster()
print("best_iteration:", m.best_iteration, "| деревьев в модели:", b.num_boosted_rounds())
d_val = xgb.DMatrix(X_val)
p_sklearn = m.predict(X_val)
p_best = b.predict(d_val, iteration_range=(0, m.best_iteration + 1))
p_all = b.predict(d_val)
print("sklearn predict = лучшие деревья:", np.allclose(p_sklearn, p_best))
print(f"RMSE: лучшие деревья {np.sqrt(np.mean((y_val - p_best) ** 2)):.4f}, все {np.sqrt(np.mean((y_val - p_all) ** 2)):.4f}")

# %% [markdown]
# ## 3. Пять видов важности
#
# `x5 … x9` — шум. Сравним виды важности (по всем деревьям модели).

# %%
imp = pd.DataFrame({k: b.get_score(importance_type=k) for k in ["weight", "gain", "total_gain", "cover", "total_cover"]})
imp.index = [f"x{i[1:]}" for i in imp.index]
imp.round(1)

# %%
print("feature_importances_ = нормированный gain:",
      np.allclose(m.feature_importances_, imp["gain"].values / imp["gain"].sum()))

# %% [markdown]
# ## 4. Категориальные признаки

# %%
rng = np.random.default_rng(0)
city = rng.choice(["Москва", "Казань", "Томск", "Сочи"], size=len(y))
effect = {"Москва": 3.0, "Казань": 0.0, "Томск": -2.0, "Сочи": 1.0}
y_cat = y + np.array([effect[c] for c in city])
df = pd.DataFrame(X[:, :5], columns=[f"x{i}" for i in range(5)])
df["город"] = pd.Categorical(city)
m_cat = xgb.XGBRegressor(n_estimators=300, learning_rate=0.1, enable_categorical=True, tree_method="hist")
m_cat.fit(df[:700], y_cat[:700])
m_drop = xgb.XGBRegressor(n_estimators=300, learning_rate=0.1).fit(df.drop(columns="город")[:700], y_cat[:700])
mse = lambda p: np.mean((y_cat[700:] - p) ** 2)
print(f"MSE с категорией: {mse(m_cat.predict(df[700:])):.3f}, без неё: {mse(m_drop.predict(df.drop(columns='город')[700:])):.3f}")

# %% [markdown]
# ## 5. Сохранение и загрузка

# %%
with tempfile.TemporaryDirectory() as tmp:
    path = Path(tmp) / "model.json"
    m.save_model(path)
    loaded = xgb.XGBRegressor()
    loaded.load_model(path)
    print("размер файла, КБ:", round(path.stat().st_size / 1024), "| прогнозы совпадают:", np.allclose(loaded.predict(X_val), p_sklearn))
    print("best_iteration сохранилась:", loaded.best_iteration)

# %% [markdown]
# ## 6. Лаборатория урока в XGBoost
#
# Виджет использует `gbcourse` в режиме newton; с `tree_method="exact"` и `gamma = 2γ` это тот же алгоритм.
# Но XGBoost считает во float32. В глубоких деревьях малые узлы содержат почти равные по выигрышу разбиения,
# и округление иногда меняет выбор. Тогда деревья расходятся, и на новых данных это заметно сильнее, чем на обучении.

# %%
rows = []
for depth in (3, 6):
    for gamma_xgb in (0.0, 10.0):
        ref = xgb.XGBRegressor(n_estimators=100, learning_rate=0.3, max_depth=depth, reg_lambda=1.0, gamma=gamma_xgb,
                               min_child_weight=1, tree_method="exact", base_score=float(y_tr.mean())).fit(X_tr, y_tr)
        ours = GBRegressor(mode="newton", n_estimators=100, learning_rate=0.3, max_depth=depth, reg_lambda=1.0,
                           gamma=gamma_xgb / 2, min_child_weight=1).fit(X_tr, y_tr)
        rows.append({"глубина": depth, "gamma XGBoost": gamma_xgb,
                     "расхождение на обучении": np.abs(ref.predict(X_tr) - ours.predict(X_tr)).max(),
                     "расхождение на валидации": np.abs(ref.predict(X_val) - ours.predict(X_val)).max()})
pd.DataFrame(rows).style.format({"расхождение на обучении": "{:.1e}", "расхождение на валидации": "{:.1e}"})

# %% [markdown]
# ## Упражнения
#
# 1. Обучите модель с `early_stopping_rounds=20` через `xgb.train` и получите прогноз лучшей итерации.
# 2. Добавьте к данным признак-«идентификатор» `np.arange(n)` и посмотрите, какое место он займёт по `weight` и по `total_gain`.
#
# Решения: `python lessons/lesson_9_1/exercises/solutions.py`.
