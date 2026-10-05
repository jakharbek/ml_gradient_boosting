# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_12_1

# %% [markdown]
# # Урок 12.1. Важность признаков
#
# **Интерактивная версия:** `lessons/lesson_12_1/web/index.html`
#
# Шесть видов важности на задаче Фридмана с копией x3 и двумя шумовыми признаками — таблица из урока.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
from gbcourse import datasets, GBRegressor
from gbcourse.explain import permutation_importance, shapley_values

mse = lambda a, b: float(np.mean((a - b) ** 2))
X, y = datasets.friedman1(n=2000, noise=1.0, seed=181, n_features=5)
r = np.random.default_rng(0)
dup = X[:, 3] + r.normal(0, 0.02, len(y))
noise_cont = r.uniform(0, 1, len(y))
noise_bin = (r.random(len(y)) < 0.5).astype(float)
Xa = np.c_[X, dup, noise_cont, noise_bin]
names = ["x0", "x1", "x2", "x3", "x4", "копия x3", "непрерывный шум", "бинарный шум"]
X_tr, X_te, y_tr, y_te = datasets.train_test_split(Xa, y, test_size=0.3, seed=0)
params = dict(n_estimators=300, learning_rate=0.1, max_depth=4)
model = GBRegressor(**params).fit(X_tr, y_tr)
print("корреляция x3 и копии:", round(np.corrcoef(X[:, 3], dup)[0, 1], 4), "| MSE на тесте:", round(mse(y_te, model.predict(X_te)), 3))

# %%
splits = np.zeros(8)
for stage in model.trees_:
    for nd in stage[0].nodes:
        if not nd.is_leaf:
            splits[nd.feature] += 1
perm_te, _ = permutation_importance(model.predict, X_te, y_te, mse, n_repeats=5, seed=0)
perm_tr, _ = permutation_importance(model.predict, X_tr, y_tr, mse, n_repeats=5, seed=0)
shap_imp = np.abs(np.array([shapley_values(model, X_te[i])[1] for i in range(150)])).mean(0)
base = mse(y_te, model.predict(X_te))
drop = [mse(y_te, GBRegressor(**params).fit(np.delete(X_tr, j, 1), y_tr).predict(np.delete(X_te, j, 1))) - base for j in range(8)]
table = pd.DataFrame({"разбиений": splits.astype(int), "gain (доля)": model.feature_importances_, "перестановка, тест": perm_te,
                      "перестановка, обучение": perm_tr, "удаление": drop, "средний |SHAP|": shap_imp}, index=names)
table.round(3)

# %% [markdown]
# ## Группа коррелированных признаков
#
# Удалим x3 и копию вместе — теперь видно, насколько важна «информация об x3».

# %%
both = [3, 5]
m2 = GBRegressor(**params).fit(np.delete(X_tr, both, 1), y_tr)
print(f"удаление x3 и копии вместе: MSE растёт на {mse(y_te, m2.predict(np.delete(X_te, both, 1))) - base:+.3f}")

# %% [markdown]
# ## Упражнения
#
# 1. Повторите опыт с копией x0 вместо x3. Как поделилась важность?
# 2. Сделайте копию «хуже» (шум σ = 0.2). Как меняются перестановочная важность и удаление?
#
# Решения: `python lessons/lesson_12_1/exercises/solutions.py`.
