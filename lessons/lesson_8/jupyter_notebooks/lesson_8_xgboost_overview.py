# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_8

# %% [markdown]
# # Урок 8. XGBoost изнутри: бустинг второго порядка
#
# **Интерактивная версия:** `lessons/lesson_8/web/index.html`
#
# 1. Дерево второго порядка = взвешенная регрессия на рабочий отклик $z = -g/h$ с весами $h$.
# 2. `gbcourse` в режиме newton против XGBoost `tree_method="exact"`.
# 3. Честное сравнение режимов friedman и newton.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
from gbcourse import datasets, GBClassifier, GBRegressor, RegressionTree
from gbcourse._numeric import sigmoid

# %% [markdown]
# ## 1. Взвешенная регрессия на рабочий отклик
#
# $g w + \tfrac12 h w^2 = \tfrac12 h (w - z)^2 - \tfrac12 h z^2$, где $z = -g/h$. Минимум суммы по листу —
# взвешенное среднее $z$ с весами $h$: $\sum h_i z_i / \sum h_i = -G/H$.

# %%
X, y = datasets.classification_2d(kind="moons", n=400, noise=0.3, seed=90)
F = np.full(len(y), 0.3)
p = sigmoid(F)
g, h = p - y, p * (1 - p)
z = -g / h

t_newton = RegressionTree(max_depth=3).fit(X, g, h)
leaf_of = t_newton.apply(X)
for leaf in t_newton.leaves[:4]:
    rows = leaf_of == leaf.id
    print(f"лист {leaf.id}: w = {leaf.value:+.5f}, взвешенное среднее z = {np.average(z[rows], weights=h[rows]):+.5f}")

# %% [markdown]
# ## 2. gbcourse (newton) против XGBoost (exact)
#
# XGBoost считает в float32, поэтому ожидаем расхождение порядка 1e−6.

# %%
import xgboost as xgb

Xr, yr = datasets.friedman1(n=300, noise=1.0, seed=80)
params = dict(n_estimators=20, learning_rate=0.3, max_depth=3, reg_lambda=1.0, min_child_weight=1.0)
ours = GBRegressor(mode="newton", **params).fit(Xr, yr)
ref = xgb.XGBRegressor(tree_method="exact", base_score=float(yr.mean()), **params).fit(Xr, yr)
print("регрессия, наибольшее расхождение прогнозов:", f"{np.abs(ours.predict(Xr) - ref.predict(Xr)).max():.1e}")

ours_c = GBClassifier(mode="newton", **params).fit(X, y)
ref_c = xgb.XGBClassifier(tree_method="exact", base_score=float(y.mean()), **params).fit(X, y)
print("классификация, наибольшее расхождение вероятностей:", f"{np.abs(ours_c.predict_proba(X)[:, 1] - ref_c.predict_proba(X)[:, 1]).max():.1e}")

# %% [markdown]
# ## 3. Friedman против Newton: насколько важен второй порядок?

# %%
rows = []
for kind in ("moons", "circles", "spiral"):
    for depth in (2, 4):
        row = {"данные": kind, "глубина": depth}
        for mode in ("friedman", "newton"):
            best = []
            for s in range(3):
                Xs, ys = datasets.classification_2d(kind=kind, n=400, noise=0.3, seed=90 + s)
                a, b, c, d = datasets.train_test_split(Xs, ys, test_size=0.3, seed=s)
                m = GBClassifier(mode=mode, n_estimators=100, learning_rate=0.3, max_depth=depth).fit(a, c, eval_set=(b, d))
                best.append(min(m.history_["eval"]))
            row[mode] = np.mean(best)
        rows.append(row)
table = pd.DataFrame(rows)
table["разница"] = table["friedman"] - table["newton"]
table.round(4)

# %% [markdown]
# Разница — в третьем знаке, и её знак меняется от задачи к задаче. Выгода XGBoost — в единой цели со штрафами
# и в скорости (урок 8.3), а не в заметно лучшей точности каждого шага.
#
# ## Упражнения
#
# 1. Проверьте формулу $w = \sum h_i z_i / (\sum h_i + \lambda)$ для λ = 5.
# 2. Найдите объект с наибольшим $|z|$ после 10 деревьев: его доля в $H$ листа и вклад $h_i z_i/H = -g_i/H$ в вес листа.
#
# Решения: `python lessons/lesson_8/exercises/solutions.py`.
