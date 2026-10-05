# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_4_1

# %% [markdown]
# # Урок 4.1. Бустинг на остатках вручную
#
# **Интерактивная версия:** `lessons/lesson_4_1/web/index.html`
#
# Шесть квартир и две итерации бустинга — каждое число на виду. Затем проверяем всё кодом.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.ensemble import GradientBoostingRegressor
from gbcourse import datasets, GBRegressor
from gbcourse.plotting import use_course_style, plot_boosting_step, plot_tree

use_course_style()

X, y = datasets.toy_regression()
x = X[:, 0]
pd.DataFrame({"площадь, ×10 м²": x, "цена, млн ₽": y})

# %% [markdown]
# ## Шаг 0. $F_0$ — среднее

# %%
F0 = y.mean()
print("F0 =", F0, "| сумма квадратов ошибок:", ((y - F0) ** 2).sum())

# %% [markdown]
# ## Шаг 1. Остатки и лучший пень

# %%
def stump_table(x, r):
    rows = []
    for t in (x[:-1] + x[1:]) / 2:
        L, R = r[x <= t], r[x > t]
        rows.append({"порог": t, "r̄_L": L.mean(), "r̄_R": R.mean(),
                     "выигрыш": len(L) * len(R) / len(r) * (L.mean() - R.mean()) ** 2})
    return pd.DataFrame(rows)


r1 = y - F0
print("остатки r(1) =", r1)
stump_table(x, r1)

# %% [markdown]
# Лучший порог 3.5: листья $-3$ и $+3$. Обновление с ν = 1: $F_1 = 6 \mp 3$.

# %%
h1 = np.where(x <= 3.5, r1[x <= 3.5].mean(), r1[x > 3.5].mean())
F1 = F0 + 1.0 * h1
r2 = y - F1
print("F1 =", F1, "\nr(2) =", r2, "\nсумма квадратов:", (r2**2).sum())
stump_table(x, r2)

# %% [markdown]
# ## Шаг 2. Второй пень: порог 5.5, листья −0.4 и +2

# %%
h2 = np.where(x <= 5.5, r2[x <= 5.5].mean(), r2[x > 5.5].mean())
F2 = F1 + h2
print("F2 =", F2, "| сумма квадратов:", ((y - F2) ** 2).sum())

# %% [markdown]
# ## Проверка кодом

# %%
model = GBRegressor(n_estimators=2, learning_rate=1.0, max_depth=1).fit(X, y)
sk = GradientBoostingRegressor(n_estimators=2, learning_rate=1.0, max_depth=1).fit(X, y)
print("gbcourse F2:", model.predict(X))
print("sklearn  F2:", sk.predict(X))
print("ручной   F2:", F2)
for m in (1, 2):
    plot_boosting_step(model, X, y, m)
    plt.tight_layout()
    plt.show()
plot_tree(model.trees_[1][0], feature_names=["x"], value_label="h₂")
plt.show()

# %% [markdown]
# ## То же с ν = 0.5

# %%
half = GBRegressor(n_estimators=6, learning_rate=0.5, max_depth=1).fit(X, y)
rows = []
for m, Fm in enumerate(half.staged_predict_raw(X), start=1):
    root = half.trees_[m - 1][0].nodes[0]
    rows.append({"m": m, "порог": root.threshold, "F_m": np.round(Fm, 3), "сумма квадратов": ((y - Fm) ** 2).sum()})
pd.DataFrame(rows)

# %% [markdown]
# ## Упражнения
#
# 1. Выполните третью итерацию (ν = 1) вручную: остатки $r^{(3)}$, лучший порог, листья, $F_3$.
# 2. Для ν = 0.5 какой порог выберет второе дерево? Объясните, почему не 3.5.
# 3. Замените y₆ = 11 на 20. Как изменятся $F_0$ и первое дерево?
#
# Решения: `python lessons/lesson_4_1/exercises/solutions.py`.
