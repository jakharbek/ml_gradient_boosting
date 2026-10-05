# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_9_2

# %% [markdown]
# # Урок 9.2. LightGBM: рост по листьям, GOSS и связывание признаков
#
# **Интерактивная версия:** `lessons/lesson_9_2/web/index.html`
#
# 1. Рост по листьям в `gbcourse`: тот же бюджет листьев — меньше ошибка на обучении.
# 2. `num_leaves` и `min_child_samples` на маленьких данных.
# 3. GOSS своими руками: потеря выигрыша против равномерной подвыборки.
# 4. GOSS в LightGBM: время и качество.
# 5. EFB на разреженных one-hot признаках.

# %%
import sys
import time
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import lightgbm as lgb
import numpy as np
import pandas as pd
import scipy.sparse as sp
from gbcourse import datasets, GBClassifier, GBRegressor, RegressionTree

# %% [markdown]
# ## 1. Рост по уровням и по листьям

# %%
X, y = datasets.friedman1(n=1000, noise=1.0, seed=94)
X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)
g = y_tr.mean() - y_tr
rows = []
for d in (2, 3, 4, 5, 6):
    dw = RegressionTree(max_depth=d).fit(X_tr, g)
    lw = RegressionTree(max_depth=None, max_leaves=2**d, growth="leafwise").fit(X_tr, g)
    err = lambda t, X_, y_: 0.5 * np.mean((y_ - y_tr.mean() - t.predict(X_)) ** 2)
    rows.append({"листьев": 2**d, "по уровням: обуч.": err(dw, X_tr, y_tr), "по листьям: обуч.": err(lw, X_tr, y_tr),
                 "по уровням: валид.": err(dw, X_val, y_val), "по листьям: валид.": err(lw, X_val, y_val),
                 "глубина по листьям": lw.depth})
pd.DataFrame(rows).round(3)

# %% [markdown]
# ## 2. num_leaves и min_child_samples

# %%
rows = []
for leaves in (4, 8, 16, 31, 64, 128):
    row = {"num_leaves": leaves}
    for mcs in (20, 5):
        m = lgb.LGBMRegressor(n_estimators=2000, learning_rate=0.05, num_leaves=leaves, min_child_samples=mcs, verbose=-1)
        m.fit(X_tr, y_tr, eval_X=(X_val,), eval_y=(y_val,), callbacks=[lgb.early_stopping(50, verbose=False)])
        row[f"MSE, min_child_samples={mcs}"] = min(m.evals_result_["valid_0"]["l2"])
    rows.append(row)
pd.DataFrame(rows).round(3)

# %% [markdown]
# При `min_child_samples=20` и 700 объектах в дереве не может быть больше 35 листьев — поэтому 31, 64 и 128 дают одно и то же.
#
# ## 3. GOSS своими руками

# %%
Xc, yc = datasets.classification_2d(kind="moons", n=2000, noise=0.25, seed=93)
order = np.argsort(Xc[:, 0], kind="stable")


def lost_gain(g, h, w, full):
    gw, hw = (g * w)[order], (h * w)[order]
    GL, HL = np.cumsum(gw)[:-1], np.cumsum(hw)[:-1]
    G, H = gw.sum(), hw.sum()
    c = 0.5 * (GL**2 / (HL + 1) + (G - GL) ** 2 / (H - HL + 1) - G**2 / (H + 1))
    k = int(np.argmax(full))
    return (full[k] - full[int(np.argmax(c))]) / full[k]


rng = np.random.default_rng(0)
a, b, n = 0.2, 0.1, len(yc)
rows = []
for m_iter in (5, 30, 100):
    p = GBClassifier(mode="newton", n_estimators=m_iter, learning_rate=0.3, max_depth=3).fit(Xc, yc).predict_proba(Xc)[:, 1]
    g, h = p - yc, p * (1 - p)
    ones = np.ones(n)
    gw, hw = (g * ones)[order], (h * ones)[order]
    GL, HL = np.cumsum(gw)[:-1], np.cumsum(hw)[:-1]
    full = 0.5 * (GL**2 / (HL + 1) + (g.sum() - GL) ** 2 / (h.sum() - HL + 1) - g.sum() ** 2 / (h.sum() + 1))
    top = np.argsort(-np.abs(g))[: int(a * n)]
    rest = np.setdiff1d(np.arange(n), top)
    lu, lg = [], []
    for _ in range(300):
        w = np.zeros(n)
        w[rng.choice(n, int((a + b) * n), replace=False)] = 1 / (a + b)
        lu.append(lost_gain(g, h, w, full))
        w = np.zeros(n)
        w[top] = 1
        w[rng.choice(rest, int(b * n), replace=False)] = (1 - a) / b
        lg.append(lost_gain(g, h, w, full))
    rows.append({"деревьев": m_iter, "доля Σ|g| у топ-20%": np.abs(g[top]).sum() / np.abs(g).sum(),
                 "потеря: равномерно, %": 100 * np.mean(lu), "потеря: GOSS, %": 100 * np.mean(lg)})
pd.DataFrame(rows).round(2)

# %% [markdown]
# ## 4. GOSS в LightGBM
#
# Время зависит от машины.

# %%
Xb, yb = datasets.classification_2d(kind="moons", n=400_000, noise=0.3, seed=95)
Xb = np.column_stack([Xb, np.random.default_rng(0).normal(size=(len(yb), 48))])
a_, b_, c_, d_ = datasets.train_test_split(Xb, yb, test_size=0.25, seed=0)
rows = []
for name, kw in [("все строки", {}), ("GOSS", dict(data_sample_strategy="goss")),
                 ("равномерно 30%", dict(subsample=0.3, subsample_freq=1))]:
    t0 = time.perf_counter()
    m = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.1, verbose=-1, n_jobs=4, **kw).fit(a_, c_)
    el = time.perf_counter() - t0
    p = np.clip(m.predict_proba(b_)[:, 1], 1e-15, 1 - 1e-15)
    rows.append({"вариант": name, "время, с": el, "log-loss на тесте": -np.mean(d_ * np.log(p) + (1 - d_) * np.log(1 - p))})
pd.DataFrame(rows).round(4)

# %% [markdown]
# ## 5. EFB

# %%
rng = np.random.default_rng(0)
n_rows, K, card = 200_000, 5, 200
cats = rng.integers(0, card, size=(n_rows, K))
Xs = sp.csr_matrix((np.ones(n_rows * K), (np.repeat(np.arange(n_rows), K), (cats + np.arange(K) * card).ravel())),
                   shape=(n_rows, K * card))
ys = rng.normal(size=(K, card))[np.arange(K), cats].sum(1) + rng.normal(size=n_rows)
print("столбцов:", Xs.shape[1], "| ненулевых в строке:", K)
for eb in (True, False):
    t0 = time.perf_counter()
    m = lgb.LGBMRegressor(n_estimators=100, enable_bundle=eb, verbose=-1, n_jobs=4).fit(Xs, ys)
    print(f"enable_bundle={eb}: {time.perf_counter() - t0:.2f} с, MSE обучения {np.mean((ys - m.predict(Xs)) ** 2):.4f}")

# %% [markdown]
# ## Упражнения
#
# 1. Повторите раздел 3 для регрессии (`regression_1d(kind="wave", n=1000, noise=0.3)`, квадратичная потеря, 10 деревьев).
#    Сконцентрированы ли градиенты? Помогает ли GOSS?
# 2. Подберите `num_leaves` и `max_depth` так, чтобы LightGBM на данных раздела 2 выиграл у варианта с 4 листьями.
#
# Решения: `python lessons/lesson_9_2/exercises/solutions.py`.
