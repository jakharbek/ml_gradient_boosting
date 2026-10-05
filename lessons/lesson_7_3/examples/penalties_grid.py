"""Штрафы на листья: сжатие весов λ и число листьев в зависимости от γ.

Запуск:  python lessons/lesson_7_3/examples/penalties_grid.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example

ex = Example(__file__)

X, y = datasets.friedman1(n=300, noise=2.0, seed=75)
gammas = [0, 5, 10, 20, 40, 80]
leaves, scores = [], []
for g in gammas:
    res, lv = [], []
    for split in range(3):
        a, b, c, d = datasets.train_test_split(X, y, test_size=0.3, seed=split)
        m = GBRegressor(mode="newton", n_estimators=200, learning_rate=0.1, max_depth=5, gamma=g).fit(a, c, eval_set=(b, d))
        res.append(min(m.history_["eval"]))
        lv.append(np.mean([t.n_leaves for (t,) in m.trees_]))
    leaves.append(np.mean(lv))
    scores.append(np.mean(res))
    print(f"γ = {g:3d}: листьев {leaves[-1]:5.1f}, лучшая ½MSE {scores[-1]:.3f}")
assert leaves[-1] < leaves[0], "γ должна уменьшать число листьев"

fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
axes[0].plot(gammas, leaves, marker="o")
axes[0].set(xlabel="γ", ylabel="листьев в дереве", title="γ срезает невыгодные разбиения")
axes[1].plot(gammas, scores, marker="o", color="#eb6834")
axes[1].set(xlabel="γ", ylabel="лучшая ½MSE на валидации", title="Качество (среднее по 3 разбиениям)")
fig.tight_layout()
ex.finish(fig, "penalties_grid")
