# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_13_2

# %% [markdown]
# # Урок 13.2. Калибровка вероятностей и интервалы прогноза
#
# **Интерактивная версия:** `lessons/lesson_13_2/web/index.html`
#
# 1. Калибровка Платта и изотоническая для переобученного бустинга.
# 2. Интервалы: квантильный бустинг, сплит-конформный метод, CQR (пять повторов).

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from gbcourse import datasets, GBClassifier, GBRegressor

# %% [markdown]
# ## 1. Калибровка

# %%
X, y = datasets.classification_2d(kind="moons", n=900, noise=0.35, seed=190)
X_te, y_te = datasets.classification_2d(kind="moons", n=3000, noise=0.35, seed=191)
tr, ca = np.arange(600), np.arange(600, 900)
model = GBClassifier(n_estimators=500, learning_rate=0.3, max_depth=4).fit(X[tr], y[tr])


def ece(yy, p, bins=10):
    i = np.minimum((p * bins).astype(int), bins - 1)
    return sum(np.mean(i == k) * abs(p[i == k].mean() - yy[i == k].mean()) for k in range(bins) if np.any(i == k))


def log_loss(yy, p):
    p = np.clip(p, 1e-12, 1 - 1e-12)
    return -np.mean(yy * np.log(p) + (1 - yy) * np.log(1 - p))


F_ca, F_te = model.predict_raw(X[ca]), model.predict_raw(X_te)
p_raw = 1 / (1 + np.exp(-F_te))
platt = LogisticRegression(C=1e6).fit(F_ca[:, None], y[ca])
p_platt = platt.predict_proba(F_te[:, None])[:, 1]
iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(1 / (1 + np.exp(-F_ca)), y[ca])
p_iso = iso.predict(p_raw)
print(f"Платт: a = {platt.coef_[0, 0]:.3f}, b = {platt.intercept_[0]:.3f}")
pd.DataFrame({name: {"ECE": ece(y_te, p), "log-loss": log_loss(y_te, p), "AUC": roc_auc_score(y_te, p), "точность": np.mean((p > 0.5) == y_te)}
              for name, p in (("без калибровки", p_raw), ("Платт", p_platt), ("изотоническая", p_iso))}).round(4)

# %% [markdown]
# ## 2. Интервалы прогноза

# %%
rows = []
alpha = 0.1
P = dict(n_estimators=200, learning_rate=0.05, max_depth=3)
for s in range(5):
    Xr, yr = datasets.regression_1d(kind="hetero", n=3000, noise=0.5, seed=220 + s)
    perm = np.random.default_rng(s).permutation(len(yr))
    tr_, ca_, te_ = perm[:1000], perm[1000:1500], perm[1500:]
    lo = GBRegressor(loss="quantile", quantile_alpha=alpha / 2, **P).fit(Xr[tr_], yr[tr_])
    hi = GBRegressor(loss="quantile", quantile_alpha=1 - alpha / 2, **P).fit(Xr[tr_], yr[tr_])
    mid = GBRegressor(**P).fit(Xr[tr_], yr[tr_])
    n = len(ca_)
    level = np.ceil((n + 1) * (1 - alpha)) / n
    q_split = np.quantile(np.abs(yr[ca_] - mid.predict(Xr[ca_])), level, method="higher")
    E = np.maximum(lo.predict(Xr[ca_]) - yr[ca_], yr[ca_] - hi.predict(Xr[ca_]))
    q_cqr = np.quantile(E, level, method="higher")
    L, H, M = lo.predict(Xr[te_]), hi.predict(Xr[te_]), mid.predict(Xr[te_])
    for name, (a, b) in {"квантили": (L, H), "сплит-конформный": (M - q_split, M + q_split), "CQR": (L - q_cqr, H + q_cqr)}.items():
        rows.append({"метод": name, "повтор": s, "покрытие": np.mean((yr[te_] >= a) & (yr[te_] <= b)), "ширина": np.mean(b - a)})
df = pd.DataFrame(rows)
df.groupby("метод", sort=False)[["покрытие", "ширина"]].agg(["mean", "min", "max"]).round(3)

# %% [markdown]
# ## Упражнения
#
# 1. Повторите калибровку с калибровочной выборкой из 100 и 1000 объектов. Как меняется разрыв между Платтом и изотонической?
# 2. Постройте CQR с целевым покрытием 80% и 95%. Совпадает ли покрытие на тесте с целью?
#
# Решения: `python lessons/lesson_13_2/exercises/solutions.py`.
