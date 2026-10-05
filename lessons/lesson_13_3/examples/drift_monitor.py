"""Сдвиг данных: ошибка модели, PSI и состязательная проверка в зависимости от величины сдвига.

Модель обучена на x ∈ [0, 6]; новые данные равномерны на [s, 6 + s].

Запуск:  python lessons/lesson_13_3/examples/drift_monitor.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBClassifier, GBRegressor
from gbcourse.cli import Example
from gbcourse.metrics import roc_auc

ex = Example(__file__)
f = lambda x: np.sin(x) + 0.3 * x
r = np.random.default_rng(0)
x_tr = r.uniform(0, 6, 1000)
model = GBRegressor(n_estimators=200, learning_rate=0.1, max_depth=3).fit(x_tr[:, None], f(x_tr) + r.normal(0, 0.3, 1000))
edges = np.quantile(x_tr, np.linspace(0, 1, 11))
edges[0], edges[-1] = -np.inf, np.inf
shifts = np.arange(0, 4.01, 0.5)
rmse, psi, auc = [], [], []
for s in shifts:
    rn = np.random.default_rng(10 + int(s * 10))
    x_new = rn.uniform(s, 6 + s, 1000)
    y_new = f(x_new) + rn.normal(0, 0.3, 1000)
    rmse.append(float(np.sqrt(np.mean((y_new - model.predict(x_new[:, None])) ** 2))))
    pa = np.clip(np.histogram(x_tr, edges)[0] / 1000, 1e-4, None)
    pb = np.clip(np.histogram(x_new, edges)[0] / 1000, 1e-4, None)
    psi.append(float(np.sum((pb - pa) * np.log(pb / pa))))
    Z = np.r_[x_tr, x_new][:, None]
    lab = np.r_[np.zeros(1000), np.ones(1000)]
    perm = np.random.default_rng(1).permutation(2000)
    clf = GBClassifier(n_estimators=100, max_depth=2, learning_rate=0.1).fit(Z[perm[:1400]], lab[perm[:1400]])
    auc.append(roc_auc(lab[perm[1400:]], clf.predict_proba(Z[perm[1400:]])[:, 1]))
    print(f"s = {s:.1f}: RMSE {rmse[-1]:.3f}, PSI {psi[-1]:.3f}, AUC {auc[-1]:.3f}")
assert rmse[-1] > 2 * rmse[0] and auc[-1] > 0.9

fig, axes = plt.subplots(1, 3, figsize=(15, 3.4))
for ax, vals, name in zip(axes, (rmse, psi, auc), ("RMSE на новых данных", "PSI признака", "AUC «старые / новые»")):
    ax.plot(shifts, vals, marker="o")
    ax.set(xlabel="сдвиг s", title=name)
axes[1].axhline(0.25, color="#d6452a", ls="--", lw=1)
fig.tight_layout()
ex.finish(fig, "drift_monitor")
