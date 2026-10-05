"""Решения упражнений урока 13.2.

Запуск:  python lessons/lesson_13_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression

from gbcourse import GBClassifier, GBRegressor, datasets


def ece(yy, p, bins=10):
    i = np.minimum((p * bins).astype(int), bins - 1)
    return sum(np.mean(i == k) * abs(p[i == k].mean() - yy[i == k].mean()) for k in range(bins) if np.any(i == k))


def log_loss(yy, p):
    p = np.clip(p, 1e-12, 1 - 1e-12)
    return -np.mean(yy * np.log(p) + (1 - yy) * np.log(1 - p))


# 1
X_te, y_te = datasets.classification_2d(kind="moons", n=3000, noise=0.35, seed=191)
for m in (100, 300, 1000):
    X, y = datasets.classification_2d(kind="moons", n=600 + m, noise=0.35, seed=190)
    model = GBClassifier(n_estimators=500, learning_rate=0.3, max_depth=4).fit(X[:600], y[:600])
    Fc, Ft = model.predict_raw(X[600:]), model.predict_raw(X_te)
    pp = LogisticRegression(C=1e6).fit(Fc[:, None], y[600:]).predict_proba(Ft[:, None])[:, 1]
    pi = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(1 / (1 + np.exp(-Fc)), y[600:]).predict(1 / (1 + np.exp(-Ft)))
    print(f"1) {m:4d} объектов: Платт ECE {ece(y_te, pp):.3f}, log-loss {log_loss(y_te, pp):.3f}; "
          f"изотоническая ECE {ece(y_te, pi):.3f}, log-loss {log_loss(y_te, pi):.3f}")
print("   С ростом калибровочной выборки изотоническая регрессия догоняет Платта: ей нужно больше данных.")

# 2
P = dict(n_estimators=200, learning_rate=0.05, max_depth=3)
for alpha in (0.2, 0.05):
    cov, wid = [], []
    for s in range(5):
        Xr, yr = datasets.regression_1d(kind="hetero", n=3000, noise=0.5, seed=220 + s)
        perm = np.random.default_rng(s).permutation(len(yr))
        tr, ca, te = perm[:1000], perm[1000:1500], perm[1500:]
        lo = GBRegressor(loss="quantile", quantile_alpha=alpha / 2, **P).fit(Xr[tr], yr[tr])
        hi = GBRegressor(loss="quantile", quantile_alpha=1 - alpha / 2, **P).fit(Xr[tr], yr[tr])
        E = np.maximum(lo.predict(Xr[ca]) - yr[ca], yr[ca] - hi.predict(Xr[ca]))
        q = np.quantile(E, np.ceil((len(ca) + 1) * (1 - alpha)) / len(ca), method="higher")
        L, H = lo.predict(Xr[te]) - q, hi.predict(Xr[te]) + q
        cov.append(np.mean((yr[te] >= L) & (yr[te] <= H)))
        wid.append(np.mean(H - L))
    print(f"2) цель {1 - alpha:.0%}: покрытие {np.mean(cov):.3f} (от {min(cov):.3f} до {max(cov):.3f}), ширина {np.mean(wid):.3f}")
