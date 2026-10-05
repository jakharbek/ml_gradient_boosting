# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_10_1

# %% [markdown]
# # Урок 10.1. Категориальные признаки
#
# **Интерактивная версия:** `lessons/lesson_10_1/web/index.html`
#
# 1. Теорема Фишера: сортировка по G/H против полного перебора.
# 2. Параметры категорий в LightGBM и XGBoost.
# 3. Результаты сравнения семи способов (скрипт `examples/encoding_benchmark.py`, ≈ 5 минут).
# 4. Небольшой повтор одного сценария.

# %%
import itertools
import json
import re
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb
from gbcourse import datasets

# %% [markdown]
# ## 1. Теорема Фишера
#
# 500 случайных наборов категорий (K от 3 до 12): лучший выигрыш полного перебора и сортировки по G/H.

# %%
rng = np.random.default_rng(0)


def gain(G, H, mask):
    gl, hl = G[mask].sum(), H[mask].sum()
    Gt, Ht = G.sum(), H.sum()
    return 0.5 * (gl**2 / hl + (Gt - gl) ** 2 / (Ht - hl) - Gt**2 / Ht)


worst_gap = 0.0
onehot_loss, ordinal_loss = [], []
for _ in range(500):
    K = int(rng.integers(3, 13))
    n = rng.integers(5, 65, K).astype(float)
    r = rng.normal(0, 1, K)
    G, H = -n * r, n
    brute = max(gain(G, H, np.array((0,) + bits, dtype=bool)) for bits in itertools.product((0, 1), repeat=K - 1) if any(bits))
    order = np.argsort(G / H)
    sorted_best = max(gain(G, H, np.isin(np.arange(K), order[:t])) for t in range(1, K))
    one = max(gain(G, H, np.arange(K) == k) for k in range(K))
    codes = rng.permutation(K)
    ordinal = max(gain(G, H, codes < t) for t in range(1, K))
    worst_gap = max(worst_gap, brute - sorted_best)
    onehot_loss.append(1 - one / brute)
    ordinal_loss.append(1 - ordinal / brute)
print(f"наибольшая разница «перебор − сортировка»: {worst_gap:.2e}")
print(f"средняя потеря выигрыша: «одна против всех» {100 * np.mean(onehot_loss):.1f}%, случайные коды {100 * np.mean(ordinal_loss):.1f}%")

# %% [markdown]
# ## 2. Параметры категорий по умолчанию

# %%
x, c, y = datasets.categorical_regression(n=2000, n_categories=50, seed=1)
D = pd.DataFrame({"x": x, "c": pd.Categorical(c)})
text = lgb.LGBMRegressor(verbose=-1, n_estimators=2).fit(D, y).booster_.model_to_string()
print("LightGBM:", {k: re.findall(r"\[" + k + r": ([^\]]+)\]", text)[0]
                    for k in ("max_cat_to_onehot", "min_data_per_group", "cat_smooth", "cat_l2", "max_cat_threshold")})
cfg = json.loads(xgb.XGBRegressor(n_estimators=2, enable_categorical=True).fit(D, y).get_booster().save_config())
tp = cfg["learner"]["gradient_booster"]["tree_train_param"]
print("XGBoost: ", {k: tp[k] for k in ("max_cat_to_onehot", "max_cat_threshold")})

# %% [markdown]
# ## 3. Результаты полного сравнения

# %%
js = (ROOT / "lessons" / "lesson_10_1" / "web" / "results.js").read_text(encoding="utf-8")
bench = json.loads(js[js.index(".encodingBenchmark = ") + len(".encodingBenchmark = "): js.rindex(";\n})")])
table = pd.DataFrame({f"K={sc['K']}{'' if sc['informative'] else ', шум'}": {r["method"]: r["rmse"] for r in sc["rows"]}
                      for sc in bench["scenarios"]})
table

# %% [markdown]
# ## 4. Повтор: K = 1000, категория — шум, одно разбиение
#
# Наивное кодирование средним «видит» собственный y объекта и переобучается; кодирование по фолдам — нет.

# %%
x, c, y = datasets.categorical_regression(n=6000, n_categories=1000, noise=1.0, seed=140, informative=False)
perm = np.random.default_rng(0).permutation(len(y))
tr, va, te = perm[:3600], perm[3600:4800], perm[4800:]
prior = y[tr].mean()
table_ = lambda cc, yy: (np.bincount(cc, yy, 1000) + 10 * prior) / (np.bincount(cc, minlength=1000) + 10)
enc = table_(c[tr], y[tr])[c]
enc_cv = enc.copy()
fold = np.random.default_rng(0).permutation(len(tr)) % 5
for f in range(5):
    enc_cv[tr[fold == f]] = table_(c[tr][fold != f], y[tr][fold != f])[c[tr][fold == f]]
print("корреляция признака с y на обучении: наивное", round(np.corrcoef(enc[tr], y[tr])[0, 1], 3),
      "| по фолдам", round(np.corrcoef(enc_cv[tr], y[tr])[0, 1], 3), "| на тесте", round(np.corrcoef(enc[te], y[te])[0, 1], 3))
for name, e in (("наивное", enc), ("по фолдам", enc_cv)):
    Z = np.c_[x, e]
    m = lgb.LGBMRegressor(n_estimators=5000, learning_rate=0.05, verbose=-1)
    m.fit(Z[tr], y[tr], eval_X=(Z[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
    print(f"{name:10s} RMSE на тесте {np.sqrt(np.mean((y[te] - m.predict(Z[te])) ** 2)):.3f}")

# %% [markdown]
# ## Упражнения
#
# 1. Для λ > 0 (оценка $G^2/(H+\lambda)$) сравните полный перебор с сортировкой по $G/H$ и по $G/(H+\lambda)$.
#    Бывают ли потери? Насколько велики?
# 2. Измените `min_data_per_group` в LightGBM для сценария K = 1000 (информативная категория). Какое значение лучшее?
#
# Решения: `python lessons/lesson_10_1/exercises/solutions.py`.
