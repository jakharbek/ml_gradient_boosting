# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_9_3

# %% [markdown]
# # Урок 9.3. CatBoost: категории, упорядоченный бустинг и симметричные деревья
#
# **Интерактивная версия:** `lessons/lesson_9_3/web/index.html`
#
# 1. Утечка в наивном кодировании категорий и упорядоченные статистики — своими руками.
# 2. То же с настоящим CatBoost: встроенные категории против наивного кодирования.
# 3. Упорядоченный бустинг против обычного.
# 4. Симметричные деревья своими руками и в CatBoost.

# %%
import sys
import time
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))
sys.path.insert(0, str(ROOT / "lessons" / "lesson_9_3" / "examples"))

import catboost as cb
import numpy as np
import pandas as pd
from gbcourse import datasets, GBRegressor
from oblivious_trees import ObliviousTree, boost_oblivious


def make(n, K, effect, seed):
    """y = sin(x) + эффект категории + шум; effect = 0 — категория чистый шум."""
    r = np.random.default_rng(seed)
    x = r.uniform(0, 10, n)
    c = r.integers(0, K, n)
    eff = np.random.default_rng(999).normal(0, 1.0, K) * effect
    return x, c, np.sin(x) + eff[c] + r.normal(0, 0.5, n)


def naive_ts(c_tr, y_tr, K, prior, a=1.0):
    s, n = np.bincount(c_tr, y_tr, K), np.bincount(c_tr, minlength=K)
    return (s + a * prior) / (n + a)  # таблица: категория → статистика


def ordered_ts(c_tr, y_tr, K, prior, seed, a=1.0):
    perm = np.random.default_rng(seed).permutation(len(y_tr))
    s, n, out = np.zeros(K), np.zeros(K), np.empty(len(y_tr))
    for i in perm:
        out[i] = (s[c_tr[i]] + a * prior) / (n[c_tr[i]] + a)
        s[c_tr[i]] += y_tr[i]
        n[c_tr[i]] += 1
    return out


# %% [markdown]
# ## 1. Утечка своими руками
#
# 1000 объектов для обучения, 400 для теста, три повтора. Тест всегда кодируется по всей обучающей выборке.

# %%
rows = []
for effect in (0, 1):
    for K in (10, 50, 200):
        res = {}
        for rep in range(3):
            x, c, y = make(1400, K, effect, rep)
            tr, te = np.arange(1000), np.arange(1000, 1400)
            prior = y[tr].mean()
            table = naive_ts(c[tr], y[tr], K, prior)
            variants = {
                "без категории": (x[tr, None], x[te, None]),
                "наивное": (np.c_[x[tr], table[c[tr]]], np.c_[x[te], table[c[te]]]),
                "упорядоченное": (np.c_[x[tr], ordered_ts(c[tr], y[tr], K, prior, rep)], np.c_[x[te], table[c[te]]]),
            }
            for name, (A, B) in variants.items():
                m = GBRegressor(n_estimators=200, learning_rate=0.1, max_depth=3).fit(A, y[tr])
                res.setdefault(name, []).append(np.mean((y[te] - m.predict(B)) ** 2))
        rows.append({"категория": "информативна" if effect else "шум", "K": K, **{k: np.mean(v) for k, v in res.items()}})
pd.DataFrame(rows).round(3)

# %% [markdown]
# ## 2. Настоящий CatBoost

# %%
rows = []
params = dict(iterations=300, learning_rate=0.1, depth=4, verbose=0, random_seed=0)
for effect in (0, 1):
    for K in (10, 200):
        res = {}
        for rep in range(3):
            x, c, y = make(1400, K, effect, rep)
            tr, te = slice(0, 1000), slice(1000, 1400)
            table = naive_ts(c[tr], y[tr], K, y[tr].mean())
            df = pd.DataFrame({"x": x, "c": c.astype(str)})
            dn = pd.DataFrame({"x": x, "te": table[c]})
            m = cb.CatBoostRegressor(**params).fit(df[tr], y[tr], cat_features=["c"])
            res.setdefault("CatBoost, cat_features", []).append(np.mean((y[te] - m.predict(df[te])) ** 2))
            m = cb.CatBoostRegressor(**params).fit(dn[tr], y[tr])
            res.setdefault("CatBoost + наивное", []).append(np.mean((y[te] - m.predict(dn[te])) ** 2))
            m = cb.CatBoostRegressor(**params).fit(df[["x"]][tr], y[tr])
            res.setdefault("без категории", []).append(np.mean((y[te] - m.predict(df[["x"]][te])) ** 2))
        rows.append({"категория": "информативна" if effect else "шум", "K": K, **{k: np.mean(v) for k, v in res.items()}})
pd.DataFrame(rows).round(3)

# %% [markdown]
# Шумовая категория: встроенная обработка не вредит, наивное кодирование — вредит (утечка).
# Информативная редкая категория (K = 200, ~5 объектов на значение): наивное кодирование лучше встроенного —
# упорядоченные статистики для редких категорий слишком шумные.
#
# ## 3. Упорядоченный бустинг

# %%
rows = []
for n in (300, 1000, 5000):
    res = {}
    for s in range(3):
        X, y = datasets.friedman1(n=n, noise=1.0, seed=110 + s)
        a, b, c_, d = datasets.train_test_split(X, y, test_size=0.3, seed=s)
        for bt in ("Plain", "Ordered"):
            t0 = time.perf_counter()
            m = cb.CatBoostRegressor(iterations=500, learning_rate=0.05, boosting_type=bt, verbose=0, random_seed=0).fit(a, c_)
            res.setdefault(bt, []).append((np.mean((d - m.predict(b)) ** 2), time.perf_counter() - t0))
    rows.append({"n": n, **{f"{k}: MSE": np.mean([v[0] for v in vs]) for k, vs in res.items()},
                 **{f"{k}: время, с": np.mean([v[1] for v in vs]) for k, vs in res.items()}})
pd.DataFrame(rows).round(3)

# %%
print("boosting_type по умолчанию:", cb.CatBoostRegressor(iterations=5, verbose=0).fit(a, c_).get_all_params()["boosting_type"])

# %% [markdown]
# ## 4. Симметричные деревья
#
# `ObliviousTree` из `examples/oblivious_trees.py`: на уровне одно условие, выбранное по сумме выигрышей всех узлов уровня.

# %%
X, y = datasets.friedman1(n=1500, noise=1.0, seed=99)
X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)
t = ObliviousTree(depth=3).fit(X_tr, y_tr.mean() - y_tr)
print("условия уровней (признак, порог):", [(j, round(float(th), 3)) for j, th in t.splits_])
print("номер листа первых 5 объектов:", t.leaf_index(X_val[:5]), "= двоичные числа из 3 бит")

rows = []
for depth in (3, 5):
    _, _, h_obl = boost_oblivious(X_tr, y_tr, X_val, y_val, n_estimators=300, depth=depth)
    h_std = GBRegressor(mode="newton", n_estimators=300, learning_rate=0.1, max_depth=depth, reg_lambda=1.0,
                        max_bins=64).fit(X_tr, y_tr, eval_set=(X_val, y_val)).history_["eval"][1:]
    rows.append({"глубина": depth, "симметричные": min(h_obl), "обычные": min(h_std)})
pd.DataFrame(rows).round(3)

# %% [markdown]
# В CatBoost форму дерева задаёт `grow_policy`:

# %%
for gp in ("SymmetricTree", "Depthwise", "Lossguide"):
    m = cb.CatBoostRegressor(iterations=500, learning_rate=0.05, depth=5, grow_policy=gp, verbose=0, random_seed=0).fit(X_tr, y_tr)
    print(f"{gp:13s} MSE на валидации {np.mean((y_val - m.predict(X_val)) ** 2):.3f}")

# %% [markdown]
# ## Упражнения
#
# 1. Посчитайте наивную и упорядоченную статистики вручную для категории с объектами (в порядке перестановки)
#    y = 3, 1, 4, 1, 5 при a = 1, p = 2.
# 2. Реализуйте кросс-валидационное кодирование (5 фолдов: объект кодируется по остальным фолдам) и добавьте его
#    в сравнение раздела 1 для информативной категории с K = 200.
#
# Решения: `python lessons/lesson_9_3/exercises/solutions.py`.
