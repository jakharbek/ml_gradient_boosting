# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_8_2

# %% [markdown]
# # Урок 8.2. Регуляризованная цель: веса листьев и выигрыш разбиения
#
# **Интерактивная версия:** `lessons/lesson_8_2/web/index.html`
#
# 1. Первая итерация вручную на игрушечных данных.
# 2. Качество структуры: формула против точного значения цели.
# 3. Сверка с XGBoost: `gain` (без ½), `cover` (= H), значения листьев, параметр `gamma`.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
from gbcourse import datasets, GBRegressor, RegressionTree

# %% [markdown]
# ## 1. Первая итерация вручную

# %%
X, y = datasets.toy_regression()
lam = 1.0
g = y.mean() - y
h = np.ones_like(g)
G, H = g.sum(), h.sum()
S = lambda G, H: G * G / (H + lam)
rows = []
for k in range(1, len(y)):
    GL, HL = g[:k].sum(), h[:k].sum()
    GR, HR = G - GL, H - HL
    rows.append({"порог": (X[k - 1, 0] + X[k, 0]) / 2, "G_L": GL, "H_L": HL, "G_R": GR, "H_R": HR,
                 "w_L": -GL / (HL + lam), "w_R": -GR / (HR + lam), "gain": 0.5 * (S(GL, HL) + S(GR, HR) - S(G, H))})
pd.DataFrame(rows).round(3)

# %%
t = RegressionTree(max_depth=1, reg_lambda=lam).fit(X, g)
print(t.describe())

# %% [markdown]
# ## 2. Качество структуры
#
# Для квадратичной потери приближение второго порядка точное, поэтому $-\tfrac12\sum G_j^2/(H_j+\lambda)$ должно
# совпасть с изменением цели $\sum \tfrac12 (y - F - w)^2 + \tfrac{\lambda}{2}\sum w_j^2 - \sum \tfrac12 (y - F)^2$.

# %%
Xf, yf = datasets.friedman1(n=300, noise=1.0, seed=80)
F = np.full(len(yf), yf.mean())
gf = F - yf
tree = RegressionTree(max_depth=3, reg_lambda=lam).fit(Xf, gf)
w = tree.predict(Xf)
score = -0.5 * sum(lf.G**2 / (lf.H + lam) for lf in tree.leaves)
exact = 0.5 * np.sum((yf - F - w) ** 2) + 0.5 * lam * sum(lf.value**2 for lf in tree.leaves) - 0.5 * np.sum((yf - F) ** 2)
print(f"качество структуры по формуле: {score:.6f}\nточное изменение цели:          {exact:.6f}")

# %% [markdown]
# ## 3. Сверка с XGBoost

# %%
import xgboost as xgb

ref = xgb.XGBRegressor(n_estimators=1, learning_rate=1.0, max_depth=3, reg_lambda=lam, min_child_weight=0,
                       tree_method="exact", base_score=float(yf.mean())).fit(Xf, yf)
df = ref.get_booster().trees_to_dataframe()
splits = df[df.Feature != "Leaf"].sort_values("Gain", ascending=False)
ours_gains = sorted((nd.gain for nd in tree.nodes if not nd.is_leaf), reverse=True)
comp = pd.DataFrame({"XGBoost gain": splits.Gain.values, "gbcourse gain": ours_gains})
comp["отношение"] = comp["XGBoost gain"] / comp["gbcourse gain"]
comp.round(4)

# %%
covers = sorted(df.Cover.values)
ours_H = sorted(nd.H for nd in tree.nodes)
print("cover == H во всех узлах:", np.allclose(covers, ours_H))
leaf_xgb = sorted(df[df.Feature == "Leaf"].Gain.values)
leaf_ours = sorted(lf.value for lf in tree.leaves)
print(f"наибольшее расхождение значений листьев: {np.abs(np.array(leaf_xgb) - np.array(leaf_ours)).max():.1e}")

# %% [markdown]
# ### Параметр gamma: множитель 2
#
# Возьмём γ между выигрышами двух самых слабых разбиений нашего дерева. В XGBoost тот же эффект даёт `gamma = 2γ`.
# Небольшое расхождение возможно и тогда: XGBoost сначала растит дерево, а потом срезает слабые разбиения снизу вверх,
# `gbcourse` отказывается от них сразу. Здесь γ отсекает только нижние разбиения, и результаты совпадают.

# %%
weak = sorted(nd.gain for nd in tree.nodes if not nd.is_leaf)
gamma = (weak[0] + weak[1]) / 2  # γ в масштабе статьи: разбиение остаётся, если gain_статьи > γ
ours = GBRegressor(mode="newton", n_estimators=10, learning_rate=0.3, max_depth=3, reg_lambda=lam, gamma=gamma).fit(Xf, yf)
for label, gx in (("gamma = γ", gamma), ("gamma = 2γ", 2 * gamma)):
    m = xgb.XGBRegressor(n_estimators=10, learning_rate=0.3, max_depth=3, reg_lambda=lam, gamma=gx, min_child_weight=0,
                         tree_method="exact", base_score=float(yf.mean())).fit(Xf, yf)
    print(f"XGBoost {label:11s}: наибольшее расхождение с gbcourse {np.abs(m.predict(Xf) - ours.predict(Xf)).max():.1e}")

# %% [markdown]
# ## Упражнения
#
# 1. Повторите таблицу раздела 1 для λ = 0 и λ = 10. Меняется ли лучший порог?
# 2. Логистическая потеря, 4 объекта с $p = 0.5$: $y = (0, 0, 1, 1)$, $x = (1, 2, 3, 4)$. Посчитайте вручную
#    выигрыш порога 2.5 при λ = 0 и λ = 1.
#
# Решения: `python lessons/lesson_8_2/exercises/solutions.py`.
