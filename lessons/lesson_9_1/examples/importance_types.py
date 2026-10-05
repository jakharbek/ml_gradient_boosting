"""Пять видов важности признаков XGBoost на задаче Фридмана (x5–x9 — шум).

Запуск:  python lessons/lesson_9_1/examples/importance_types.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
import xgboost as xgb

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.style import ROLE

ex = Example(__file__)

X, y = datasets.friedman1(n=1000, noise=1.0, seed=92)
m = xgb.XGBRegressor(n_estimators=1000, learning_rate=0.3, early_stopping_rounds=20, eval_metric="rmse")
m.fit(X[:700], y[:700], eval_set=[(X[700:], y[700:])], verbose=False)
b = m.get_booster()
kinds = ["weight", "gain", "total_gain", "cover", "total_cover"]
fig, axes = plt.subplots(1, 5, figsize=(17, 3.2))
for ax, kind in zip(axes, kinds):
    score = b.get_score(importance_type=kind)
    vals = np.array([score.get(f"f{i}", 0.0) for i in range(10)])
    vals = vals / vals.max()
    ax.bar(range(10), vals, color=[ROLE["model"]] * 5 + [ROLE["truth"]] * 5)
    ax.set(title=kind, xticks=range(10), xticklabels=[f"x{i}" for i in range(10)], ylim=(0, 1.05))
    noise_share = vals[5:].max()
    print(f"{kind:12s} лучший шумовой признак = {noise_share:.2f} от лучшего признака")
axes[0].set_ylabel("важность / максимум")
fig.suptitle("Синие — информативные признаки, серые — шум", y=1.02)
fig.tight_layout()
ex.finish(fig, "importance_types")
