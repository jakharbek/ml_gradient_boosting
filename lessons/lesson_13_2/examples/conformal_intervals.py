"""Интервалы прогноза: квантильный бустинг, сплит-конформный метод и CQR (цель — 90%).

Запуск:  python lessons/lesson_13_2/examples/conformal_intervals.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example
from gbcourse.style import ROLE

ex = Example(__file__)
X, y = datasets.regression_1d(kind="hetero", n=3000, noise=0.5, seed=220)
perm = np.random.default_rng(0).permutation(len(y))  # данные упорядочены по x
tr, ca, te = perm[:1000], perm[1000:1500], perm[1500:]
alpha = 0.1
P = dict(n_estimators=200, learning_rate=0.05, max_depth=3)
lo = GBRegressor(loss="quantile", quantile_alpha=alpha / 2, **P).fit(X[tr], y[tr])
hi = GBRegressor(loss="quantile", quantile_alpha=1 - alpha / 2, **P).fit(X[tr], y[tr])
mid = GBRegressor(**P).fit(X[tr], y[tr])
level = np.ceil((len(ca) + 1) * (1 - alpha)) / len(ca)
q_split = np.quantile(np.abs(y[ca] - mid.predict(X[ca])), level, method="higher")
q_cqr = np.quantile(np.maximum(lo.predict(X[ca]) - y[ca], y[ca] - hi.predict(X[ca])), level, method="higher")
g = np.linspace(0, 10, 300)[:, None]
bands = {
    "квантили": (lambda Z: lo.predict(Z), lambda Z: hi.predict(Z)),
    "сплит-конформный": (lambda Z: mid.predict(Z) - q_split, lambda Z: mid.predict(Z) + q_split),
    "CQR": (lambda Z: lo.predict(Z) - q_cqr, lambda Z: hi.predict(Z) + q_cqr),
}
fig, axes = plt.subplots(1, 3, figsize=(15, 3.8), sharey=True)
cover = {}
for ax, (name, (L, H)) in zip(axes, bands.items()):
    inside = (y[te] >= L(X[te])) & (y[te] <= H(X[te]))
    cover[name] = float(inside.mean())
    width = float(np.mean(H(X[te]) - L(X[te])))
    ax.scatter(X[te][:400, 0], y[te][:400], s=5, c=np.where(inside[:400], "#999", "#d6452a"))
    ax.fill_between(g[:, 0], L(g), H(g), color=ROLE["model"], alpha=0.25)
    ax.set(title=f"{name}: покрытие {cover[name]:.3f}, ширина {width:.2f}", xlabel="x")
    print(f"{name:17s} покрытие {cover[name]:.3f}, средняя ширина {width:.3f}")
assert cover["CQR"] >= 0.88 and cover["сплит-конформный"] >= 0.88
fig.tight_layout()
ex.finish(fig, "conformal_intervals")
