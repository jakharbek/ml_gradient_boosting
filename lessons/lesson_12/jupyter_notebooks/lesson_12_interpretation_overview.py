# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_12

# %% [markdown]
# # Урок 12. Интерпретация бустинга
#
# **Интерактивная версия:** `lessons/lesson_12/web/index.html`
#
# 1. Разложение прогноза на вклады: φ₀ + Σφ = F(x).
# 2. Наши точные значения Шепли против библиотеки `shap` (TreeExplainer) на модели XGBoost.
# 3. Глобальная важность как средний |φ|.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
import shap
import xgboost as xgb
from gbcourse import datasets, GBRegressor
from gbcourse.explain import shapley_values

X, y = datasets.friedman1(n=600, noise=1.0, seed=180, n_features=7)
model = GBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1).fit(X, y)

# %% [markdown]
# ## 1. База + сумма вкладов = прогноз

# %%
rows = []
for i in range(5):
    base, phi = shapley_values(model, X[i])
    rows.append({"объект": i, "φ₀": base, **{f"φ(x{j})": phi[j] for j in range(7)},
                 "φ₀ + Σφ": base + phi.sum(), "F(x)": model.predict(X[i:i + 1])[0]})
pd.DataFrame(rows).round(3)

# %% [markdown]
# ## 2. Сверка с shap.TreeExplainer
#
# Обучим XGBoost и посмотрим, как ту же задачу решает библиотека `shap`: TreeSHAP считает точные значения Шепли
# за полиномиальное время, и для них тоже выполняется аддитивность.

# %%
xm = xgb.XGBRegressor(n_estimators=50, max_depth=3, learning_rate=0.1, base_score=float(y.mean())).fit(X, y)
explainer = shap.TreeExplainer(xm)
sv = explainer.shap_values(X[:20])
print("shap: база", float(np.ravel(explainer.expected_value)[0]))
print("аддитивность shap: наибольшая |φ₀ + Σφ − F(x)| =",
      np.abs(explainer.expected_value + sv.sum(1) - xm.predict(X[:20], output_margin=True)).max())
print("вклады первого объекта:", np.round(sv[0], 3))

# %% [markdown]
# Сверку «наш перебор = shap до 1e-15» на моделях scikit-learn выполняет тест `tests/python/test_parity.py`.
#
# ## 3. Глобальная важность — средний |φ|

# %%
phis = np.array([shapley_values(model, X[i])[1] for i in range(200)])
imp = pd.Series(np.abs(phis).mean(0), index=[f"x{j}" for j in range(7)]).sort_values(ascending=False)
imp.round(3)

# %% [markdown]
# ## Упражнения
#
# 1. Найдите объект с наибольшим |F(x) − φ₀| и опишите, какие признаки «сделали» его прогноз.
# 2. Сравните средний |φ| со встроенной важностью `model.feature_importances_` (доля суммарного выигрыша). Совпадает ли порядок?
#
# Решения: `python lessons/lesson_12/exercises/solutions.py`.
