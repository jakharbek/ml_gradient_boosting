"""Три ловушки важности признаков: копия признака, непрерывный шум, перестановка на обучении.

Запуск:  python lessons/lesson_12_1/examples/importance_pitfalls.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example
from gbcourse.explain import permutation_importance

ex = Example(__file__)
mse = lambda a, b: float(np.mean((a - b) ** 2))
X, y = datasets.friedman1(n=2000, noise=1.0, seed=181, n_features=5)
r = np.random.default_rng(0)
Xa = np.c_[X, X[:, 3] + r.normal(0, 0.02, len(y)), r.uniform(0, 1, len(y)), (r.random(len(y)) < 0.5).astype(float)]
names = ["x0", "x1", "x2", "x3", "x4", "копия x3", "шум", "шум01"]
X_tr, X_te, y_tr, y_te = datasets.train_test_split(Xa, y, test_size=0.3, seed=0)
model = GBRegressor(n_estimators=300, learning_rate=0.1, max_depth=4).fit(X_tr, y_tr)
splits = np.zeros(8)
for stage in model.trees_:
    for nd in stage[0].nodes:
        if not nd.is_leaf:
            splits[nd.feature] += 1
perm_te, _ = permutation_importance(model.predict, X_te, y_te, mse, n_repeats=5, seed=0)
perm_tr, _ = permutation_importance(model.predict, X_tr, y_tr, mse, n_repeats=5, seed=0)
kinds = {"разбиений": splits, "gain": model.feature_importances_, "перестановка (тест)": perm_te, "перестановка (обучение)": perm_tr}
for k, v in kinds.items():
    print(f"{k:24s} " + " ".join(f"{n}:{val:.3g}" for n, val in zip(names, v)))
assert splits[6] > 5 * splits[7] and perm_tr[6] > 3 * perm_te[6]

fig, axes = plt.subplots(1, 4, figsize=(17, 3.4))
for ax, (k, v) in zip(axes, kinds.items()):
    v = np.maximum(v, 0) / max(np.max(v), 1e-12)
    ax.bar(range(8), v, color=["#2a78d6"] * 3 + ["#eb6834", "#2a78d6", "#eb6834", "#999", "#999"])
    ax.set(title=k, xticks=range(8), xticklabels=names, ylim=(0, 1.05))
    ax.tick_params(axis="x", rotation=60)
fig.tight_layout()
ex.finish(fig, "importance_pitfalls")
