# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_2_3

# %% [markdown]
# # Урок 2.3. Рекурсивное построение дерева и остановка
#
# **Интерактивная версия:** `lessons/lesson_2_3/web/index.html`
#
# 1. Дерево с нуля: 30 строк рекурсии.
# 2. Жадность на XOR.
# 3. Правила остановки и качество на тесте.
# 4. Время построения.

# %%
import sys
import time
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.tree import DecisionTreeRegressor
from gbcourse import datasets, RegressionTree
from gbcourse.metrics import mse
from gbcourse.plotting import use_course_style, plot_decision_surface

use_course_style()

# %% [markdown]
# ## 1. Дерево с нуля

# %%
def best_split(X, y):
    best = (None, None, 0.0)
    n, S = len(y), y.sum()
    for j in range(X.shape[1]):
        order = np.argsort(X[:, j], kind="stable")
        xs, ys = X[order, j], y[order]
        SL = np.cumsum(ys)[:-1]
        nL = np.arange(1, n)
        gain = SL**2 / nL + (S - SL) ** 2 / (n - nL) - S**2 / n
        gain[xs[:-1] == xs[1:]] = -np.inf
        k = int(np.argmax(gain)) if n > 1 else 0
        if n > 1 and gain[k] > best[2]:
            best = (j, (xs[k] + xs[k + 1]) / 2, gain[k])
    return best


def build(X, y, depth=0, max_depth=3, min_leaf=1):
    if depth >= max_depth or len(y) < 2 * min_leaf:
        return {"leaf": y.mean()}
    j, t, gain = best_split(X, y)
    if j is None:
        return {"leaf": y.mean()}
    left = X[:, j] <= t
    if left.sum() < min_leaf or (~left).sum() < min_leaf:
        return {"leaf": y.mean()}
    return {"j": j, "t": t, "L": build(X[left], y[left], depth + 1, max_depth, min_leaf),
            "R": build(X[~left], y[~left], depth + 1, max_depth, min_leaf)}


def predict(node, x):
    while "leaf" not in node:
        node = node["L"] if x[node["j"]] <= node["t"] else node["R"]
    return node["leaf"]


X, y = datasets.regression_1d(kind="wave", n=200, noise=0.4, seed=4)
root = build(X, y, max_depth=3)
ours = np.array([predict(root, x) for x in X])
sk = DecisionTreeRegressor(max_depth=3).fit(X, y).predict(X)
print("совпадение с sklearn:", np.abs(ours - sk).max())

# %% [markdown]
# > В этой учебной версии ограничение `min_leaf` проверяется после выбора порога — поэтому она
# > может остановиться раньше, чем sklearn (который ищет лучший *допустимый* порог). В `gbcourse`
# > это сделано правильно: недопустимые кандидаты исключаются до выбора.
#
# ## 2. Жадность на XOR

# %%
Xx, yx = datasets.classification_2d(kind="xor", n=200, noise=0.12, seed=9)
stump = RegressionTree(max_depth=1).fit(Xx, -yx)
print(f"выигрыш лучшего первого разбиения: {stump.nodes[0].gain:.3f}")
two = RegressionTree(max_depth=2).fit(Xx, -yx)
print("выигрыши разбиений второго уровня:", [round(nd.gain, 3) for nd in two.nodes if not nd.is_leaf][1:])

# Идеальное дерево: сначала x0 ≤ 0, затем x1 ≤ 0 в каждой половине
left = Xx[:, 0] <= 0
ideal = []
for part in (left, ~left):
    yy, xx = yx[part], Xx[part, 1]
    L, R = yy[xx <= 0], yy[xx > 0]
    ideal.append(0.5 * (len(L) * len(R) / len(yy)) * (L.mean() - R.mean()) ** 2)
print("выигрыши второго уровня у идеального дерева:", np.round(ideal, 3))

# %% [markdown]
# Жадный алгоритм выбрал первый порог по крошечному выигрышу — фактически наугад, и после этого
# второй уровень тоже почти ничего не даёт. Идеальный первый порог (x₀ ≤ 0) сам по себе так же
# бесполезен, но открывает огромные выигрыши на втором уровне. Жадность этого не видит.
fig, axes = plt.subplots(1, 3, figsize=(13, 4))
for ax, d in zip(axes, (1, 2, 4)):
    t = RegressionTree(max_depth=d).fit(Xx, -yx)
    plot_decision_surface(ax, t.predict, Xx, yx, title=f"XOR, глубина {d}", show_contour=False)
plt.tight_layout()
plt.show()

# %% [markdown]
# ## 3. Правила остановки

# %%
X, y = datasets.regression_1d(kind="wave", n=300, noise=0.5, seed=4)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
rows = []
for cfg in [dict(max_depth=None), dict(max_depth=2), dict(max_depth=4), dict(max_depth=None, min_samples_leaf=5),
            dict(max_depth=None, min_samples_leaf=20), dict(max_depth=None, gamma=0.5),
            dict(max_depth=None, max_leaves=8, growth="leafwise")]:
    t = RegressionTree(**cfg).fit(X_tr, -y_tr)
    rows.append({"параметры": str(cfg), "листьев": t.n_leaves, "глубина": t.depth,
                 "MSE обучение": mse(y_tr, t.predict(X_tr)), "MSE тест": mse(y_te, t.predict(X_te))})
pd.DataFrame(rows).round(3)

# %% [markdown]
# ## 4. Время построения растёт почти линейно по n

# %%
for n in (1000, 4000, 16000):
    Xb, yb = datasets.friedman1(n=n, noise=1.0, seed=1, n_features=10)
    t0 = time.perf_counter()
    RegressionTree(max_depth=6).fit(Xb, -yb)
    print(f"n = {n:6d}: {time.perf_counter() - t0:.3f} с")

# %% [markdown]
# ## Упражнения
#
# 1. Доработайте `build`, чтобы он учитывал `min_leaf` при выборе порога (как sklearn), и сравните с `DecisionTreeRegressor(min_samples_leaf=10)`.
# 2. Какое наименьшее `min_samples_leaf` даёт лучшее MSE на тесте в п. 3? Постройте кривую.
# 3. Объясните, почему дерево глубины 2 решает XOR, а бустинг из пней (глубина 1) — плохо.
#
# Решения: `python lessons/lesson_2_3/exercises/solutions.py`.
