# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_8_3

# %% [markdown]
# # Урок 8.3. Поиск разбиений: точный перебор, гистограммы и пропуски
#
# **Интерактивная версия:** `lessons/lesson_8_3/web/index.html`
#
# 1. Точный перебор с накопленными суммами — своими руками.
# 2. Гистограмма и вычитание гистограмм.
# 3. Точность в зависимости от числа корзин.
# 4. Скорость `tree_method` в XGBoost и LightGBM.
# 5. Пропуски: направление по умолчанию; сравнение с заменой.

# %%
import sys
import time
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import json

import numpy as np
import pandas as pd
from gbcourse import datasets, GBRegressor, RegressionTree
from gbcourse.tree import make_bins, bin_codes

# %% [markdown]
# ## 1. Точный перебор

# %%
X, y = datasets.friedman1(n=3000, noise=1.0, seed=84)
g = y.mean() - y
h = np.ones_like(g)
lam = 1.0
S = lambda G, H: G * G / (H + lam)


def best_exact(x, g, h):
    order = np.argsort(x, kind="stable")
    xs, GL, HL = x[order], np.cumsum(g[order])[:-1], np.cumsum(h[order])[:-1]
    G, H = g.sum(), h.sum()
    gain = 0.5 * (S(GL, HL) + S(G - GL, H - HL) - S(G, H))
    gain[xs[:-1] == xs[1:]] = -np.inf  # между равными значениями порога нет
    k = int(np.argmax(gain))
    return (xs[k] + xs[k + 1]) / 2, gain[k]


for j in range(X.shape[1]):
    thr, gain = best_exact(X[:, j], g, h)
    print(f"признак {j}: лучший порог {thr:.4f}, gain {gain:9.2f}")
tree = RegressionTree(max_depth=1, reg_lambda=lam).fit(X, g)
print("RegressionTree:", tree.describe().splitlines()[0])

# %% [markdown]
# ## 2. Гистограмма и вычитание гистограмм

# %%
bins = make_bins(X, 32)
codes = bin_codes(X, bins)
j = 3
Gb = np.bincount(codes[:, j], weights=g, minlength=len(bins[j]) + 1)
Hb = np.bincount(codes[:, j], weights=h, minlength=len(bins[j]) + 1)
GL, HL = np.cumsum(Gb)[:-1], np.cumsum(Hb)[:-1]
gain = 0.5 * (S(GL, HL) + S(g.sum() - GL, h.sum() - HL) - S(g.sum(), h.sum()))
k = int(np.argmax(gain))
print(f"признак {j}: 32 корзины → порог {bins[j][k]:.4f}, gain {gain[k]:.2f}; точно — {best_exact(X[:, j], g, h)}")

left = X[:, 0] <= 0.5  # какое-нибудь разбиение узла
Gl = np.bincount(codes[left, j], weights=g[left], minlength=len(Gb))
Gr_direct = np.bincount(codes[~left, j], weights=g[~left], minlength=len(Gb))
print("правая гистограмма = родитель − левая:", np.allclose(Gb - Gl, Gr_direct))

# %% [markdown]
# ## 3. Точность в зависимости от числа корзин

# %%
a, b, c, d = datasets.train_test_split(X, y, test_size=0.3, seed=0)
rows = []
for mb in (None, 4, 8, 16, 32, 64, 255):
    m = GBRegressor(mode="newton", n_estimators=150, learning_rate=0.1, max_depth=4, reg_lambda=1, max_bins=mb).fit(a, c, eval_set=(b, d))
    rows.append({"корзин": "точно" if mb is None else mb, "лучшая ½MSE": round(min(m.history_["eval"]), 4)})
pd.DataFrame(rows)

# %% [markdown]
# ## 4. Скорость в библиотеках
#
# Время зависит от машины; важно соотношение.

# %%
import lightgbm as lgb
import xgboost as xgb

Xb, yb = datasets.friedman1(n=200_000, noise=1.0, seed=85)
times = {}
for tm in ("exact", "approx", "hist"):
    t0 = time.perf_counter()
    xgb.XGBRegressor(n_estimators=100, max_depth=6, tree_method=tm, n_jobs=4).fit(Xb, yb)
    times[f"XGBoost {tm}"] = time.perf_counter() - t0
t0 = time.perf_counter()
lgb.LGBMRegressor(n_estimators=100, num_leaves=63, max_depth=6, n_jobs=4, verbose=-1).fit(Xb, yb)
times["LightGBM"] = time.perf_counter() - t0
for k_, v in times.items():
    print(f"{k_:16s} {v:6.2f} с")

# %% [markdown]
# ## 5. Пропуски
#
# ### Направление по умолчанию в XGBoost, если в обучении пропусков не было

# %%
Xs, ys = datasets.friedman1(n=500, noise=1.0, seed=87)
for tm in ("exact", "hist", "approx"):
    booster = xgb.XGBRegressor(n_estimators=3, max_depth=3, tree_method=tm).fit(Xs, ys).get_booster()
    left = total = 0
    stack = [json.loads(t) for t in booster.get_dump(dump_format="json")]
    while stack:
        nd = stack.pop()
        if "leaf" in nd:
            continue
        total += 1
        left += nd["missing"] == nd["children"][0]["nodeid"]
        stack.extend(nd["children"])
    print(f"{tm:6s}: пропуски влево в {left} из {total} узлов")

# %% [markdown]
# ### Встроенная обработка против замены
#
# 30% пропусков в сильном признаке $x_3$ — только у объектов с $y$ выше 70-го перцентиля (с вероятностью 0.7).

# %%
res = {"NaN (направление по умолчанию)": [], "замена средним": [], "замена на −1": []}
for s in range(3):
    Xm, ym = datasets.friedman1(n=1500, noise=1.0, seed=86 + s)
    rng = np.random.default_rng(s)
    miss = rng.random(len(ym)) < np.where(ym > np.quantile(ym, 0.7), 0.7, 0.0)
    Xm = Xm.copy()
    Xm[miss, 3] = np.nan
    a, b, c, d = datasets.train_test_split(Xm, ym, test_size=0.3, seed=s)
    for name in res:
        a2, b2 = a.copy(), b.copy()
        if name != "NaN (направление по умолчанию)":
            fill = np.nanmean(a[:, 3]) if name == "замена средним" else -1.0
            a2[np.isnan(a2[:, 3]), 3] = fill
            b2[np.isnan(b2[:, 3]), 3] = fill
        m = GBRegressor(mode="newton", n_estimators=200, learning_rate=0.1, max_depth=4, reg_lambda=1).fit(a2, c, eval_set=(b2, d))
        res[name].append(min(m.history_["eval"]))
pd.Series({k_: np.mean(v) for k_, v in res.items()}, name="лучшая ½MSE").round(4)

# %% [markdown]
# ## Упражнения
#
# 1. Реализуйте поиск лучшего порога по гистограмме с пропусками (два варианта направления) и сверьте с `RegressionTree(max_bins=32)`.
# 2. Для признака $x_0$ постройте долю потерянного выигрыша лучшего порога в зависимости от числа корзин (2…256).
#
# Решения: `python lessons/lesson_8_3/exercises/solutions.py`.
