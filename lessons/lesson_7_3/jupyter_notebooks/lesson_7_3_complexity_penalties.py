# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_7_3

# %% [markdown]
# # Урок 7.3. Сложность деревьев и штрафы на листья
#
# **Интерактивная версия:** `lessons/lesson_7_3/web/index.html`
#
# 1. λ: сжатие весов листьев — формула против дерева gbcourse.
# 2. Сетка λ × γ на шумных данных (среднее по разбиениям).
# 3. min_child_weight в классификации.
# 4. Те же параметры в XGBoost.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
from gbcourse import datasets, GBRegressor, GBClassifier, RegressionTree
from gbcourse.plotting import use_course_style

use_course_style()

# %% [markdown]
# ## 1. λ сжимает листья: w = Σr / (n + λ)

# %%
X, y = datasets.regression_1d(kind="wave", n=60, noise=0.5, seed=1)
r = y - y.mean()
for lam in (0, 1, 10):
    t = RegressionTree(max_depth=2, reg_lambda=lam).fit(X, -r)
    leaf = t.leaves[0]
    print(f"λ = {lam:2d}: лист из {leaf.n} объектов, Σr = {-leaf.G:+.3f}, вес {leaf.value:+.4f}, формула {-leaf.G / (leaf.n + lam):+.4f}")

# %% [markdown]
# ## 2. Сетка λ × γ

# %%
Xf, yf = datasets.friedman1(n=300, noise=2.0, seed=75)


def score(**kw):
    out = []
    for split in range(3):
        a, b, c, d = datasets.train_test_split(Xf, yf, test_size=0.3, seed=split)
        out.append(min(GBRegressor(mode="newton", n_estimators=200, learning_rate=0.1, max_depth=5, **kw).fit(a, c, eval_set=(b, d)).history_["eval"]))
    return np.mean(out)


grid = pd.DataFrame({f"γ = {g}": [score(reg_lambda=lam, gamma=g) for lam in (0, 5, 20)] for g in (0, 10, 40)},
                    index=[f"λ = {lam}" for lam in (0, 5, 20)])
grid.round(3)

# %% [markdown]
# ## 3. min_child_weight в классификации
#
# Для log-loss гессиан $p(1-p)$ мал у уверенных объектов — «вес» листа меньше числа объектов.

# %%
Xc, yc = datasets.classification_2d(kind="moons", n=400, noise=0.3, seed=78)
a, b, c, d = datasets.train_test_split(Xc, yc, test_size=0.3, seed=0)
for mcw in (0, 1, 5):
    m = GBClassifier(mode="newton", n_estimators=300, learning_rate=0.3, max_depth=4, min_child_weight=mcw).fit(a, c, eval_set=(b, d))
    leaves = np.mean([t.n_leaves for (t,) in m.trees_])
    print(f"min_child_weight = {mcw}: листьев в среднем {leaves:.1f}, лучший log-loss {min(m.history_['eval']):.4f}")

# %% [markdown]
# ## 4. XGBoost

# %%
import xgboost as xgb

a, b, c, d = datasets.train_test_split(Xf, yf, test_size=0.3, seed=0)
for kw in (dict(reg_lambda=0), dict(reg_lambda=5), dict(reg_lambda=5, gamma=10), dict(reg_lambda=5, min_child_weight=10)):
    m = xgb.XGBRegressor(n_estimators=200, learning_rate=0.1, max_depth=5, **kw).fit(a, c)
    print(f"{str(kw):45s} MSE валидации {np.mean((d - m.predict(b)) ** 2):.3f}")

# %% [markdown]
# ## Упражнения
#
# 1. Выведите вес листа с L1-штрафом α для L2-потерь и проверьте, когда он равен нулю.
# 2. Постройте зависимость среднего числа листьев от γ (0…50) на задаче Фридмана.
#
# Решения: `python lessons/lesson_7_3/exercises/solutions.py`.
