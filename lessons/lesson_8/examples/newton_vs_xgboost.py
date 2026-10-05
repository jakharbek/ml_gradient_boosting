"""gbcourse в режиме newton против XGBoost (tree_method="exact") и рабочий отклик z = −g/h.

Запуск:  python lessons/lesson_8/examples/newton_vs_xgboost.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
import xgboost as xgb

from gbcourse import GBClassifier, datasets
from gbcourse.cli import Example
from gbcourse.style import ROLE

ex = Example(__file__)

X, y = datasets.classification_2d(kind="moons", n=400, noise=0.3, seed=90)
params = dict(n_estimators=30, learning_rate=0.3, max_depth=3, reg_lambda=1.0, min_child_weight=1.0)
ours = GBClassifier(mode="newton", **params).fit(X, y)
ref = xgb.XGBClassifier(tree_method="exact", base_score=float(y.mean()), **params).fit(X, y)
p_ours, p_ref = ours.predict_proba(X)[:, 1], ref.predict_proba(X)[:, 1]
diff = np.abs(p_ours - p_ref).max()
print(f"Наибольшее расхождение вероятностей: {diff:.1e}")
assert diff < 1e-5, "режим newton должен совпадать с XGBoost до точности float32"

F = ours.predict_raw(X, 10)
p = 1 / (1 + np.exp(-F))
g, h = p - y, p * (1 - p)
z = -g / h
print(f"После 10 деревьев: h от {h.min():.2e} до {h.max():.3f}, |z| до {np.abs(z).max():.1f}")

fig, axes = plt.subplots(1, 2, figsize=(11, 4))
axes[0].scatter(p_ref, p_ours, s=10, color=ROLE["model"])
axes[0].plot([0, 1], [0, 1], color="#888", lw=1, ls="--")
axes[0].set(xlabel="XGBoost: p", ylabel="gbcourse (newton): p", title=f"Совпадение до {diff:.0e}")
axes[1].scatter(h, np.clip(z, -20, 20), s=12, c=np.where(y == 1, ROLE["classes"][1], ROLE["classes"][0]))
axes[1].set(xscale="log", xlabel="вес h = p(1 − p)", ylabel="рабочий отклик z (обрезан до ±20)",
            title="Большие |z| — у объектов с малым весом h")
fig.tight_layout()
ex.finish(fig, "newton_vs_xgboost")
