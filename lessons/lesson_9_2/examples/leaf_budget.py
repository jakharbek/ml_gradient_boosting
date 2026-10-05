"""LightGBM: лучшая ошибка на валидации в зависимости от num_leaves при двух значениях min_child_samples.

Запуск:  python lessons/lesson_9_2/examples/leaf_budget.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import matplotlib.pyplot as plt

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.style import ROLE

ex = Example(__file__)

X, y = datasets.friedman1(n=1000, noise=1.0, seed=94)
X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)
leaves = [2, 4, 8, 16, 31, 64, 128]
fig, ax = plt.subplots(figsize=(8, 3.8))
for mcs, color in ((20, ROLE["model"]), (5, ROLE["tree"])):
    scores = []
    for L in leaves:
        m = lgb.LGBMRegressor(n_estimators=2000, learning_rate=0.05, num_leaves=L, min_child_samples=mcs, verbose=-1)
        m.fit(X_tr, y_tr, eval_X=(X_val,), eval_y=(y_val,), callbacks=[lgb.early_stopping(50, verbose=False)])
        scores.append(min(m.evals_result_["valid_0"]["l2"]))
    ax.plot(leaves, scores, marker="o", color=color, label=f"min_child_samples = {mcs}")
    print(f"min_child_samples={mcs}: " + ", ".join(f"{L}→{s_:.3f}" for L, s_ in zip(leaves, scores)))
ax.set(xscale="log", xlabel="num_leaves", ylabel="лучшая MSE на валидации", title="700 объектов: чем меньше листьев, тем лучше")
ax.set_xticks(leaves, [str(L) for L in leaves])
ax.legend()
fig.tight_layout()
ex.finish(fig, "leaf_budget")
