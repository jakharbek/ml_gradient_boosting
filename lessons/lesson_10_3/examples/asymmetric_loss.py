"""Асимметричная квадратичная потеря в LightGBM: прогнозы при разной цене недопрогноза α.

Запуск:  python lessons/lesson_10_3/examples/asymmetric_loss.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.style import ROLE

ex = Example(__file__)

X, y = datasets.regression_1d(kind="hetero", n=2000, noise=0.5, seed=161)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
grid = np.linspace(0, 10, 300)[:, None]


def make_objective(a):
    # Ровно два аргумента: LightGBM смотрит на число параметров и третьим передал бы веса объектов
    def obj(yt, yp):
        r = yt - yp
        return np.where(r > 0, -a * r, -r), np.where(r > 0, a, 1.0)
    return obj


fig, ax = plt.subplots(figsize=(9, 4))
ax.scatter(X_tr[:, 0], y_tr, s=6, color=ROLE["data"], alpha=0.35)
for alpha, color in ((1.0, ROLE["truth"]), (3.0, ROLE["model"]), (10.0, ROLE["tree"])):
    obj = make_objective(alpha)
    m = lgb.LGBMRegressor(n_estimators=300, learning_rate=0.05, num_leaves=8, objective=obj, verbose=-1)
    m.fit(X_tr, y_tr, init_score=np.full(len(y_tr), y_tr.mean()))
    p = m.predict(X_te) + y_tr.mean()
    under = np.mean(y_te > p)
    ax.plot(grid[:, 0], m.predict(grid) + y_tr.mean(), color=color, lw=2.2, label=f"α = {alpha:g}: недопрогнозов {under:.0%}")
    print(f"α = {alpha:4g}: доля недопрогнозов на тесте {under:.3f}")
ax.set(xlabel="x", ylabel="y", title="Чем дороже недопрогноз, тем выше прогноз — сильнее там, где больше шум")
ax.legend()
fig.tight_layout()
ex.finish(fig, "asymmetric_loss")
