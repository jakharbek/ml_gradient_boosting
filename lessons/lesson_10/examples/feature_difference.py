"""Наклонная граница x1 > x0: бустинг без признака-разности и с ним.

Запуск:  python lessons/lesson_10/examples/feature_difference.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBClassifier, datasets
from gbcourse.cli import Example
from gbcourse.style import cmap_diverging

ex = Example(__file__)

rng = np.random.default_rng(0)
n = 2000
X = rng.uniform(0, 1, (n, 2))
y = (X[:, 1] > X[:, 0]).astype(int)
flip = rng.random(n) < 0.05
y[flip] = 1 - y[flip]
a, b, c, d = datasets.train_test_split(X, y, test_size=0.5, seed=0)
g = np.linspace(0, 1, 150)
G0, G1 = np.meshgrid(g, g)
grid = np.c_[G0.ravel(), G1.ravel()]

fig, axes = plt.subplots(1, 2, figsize=(10, 4.4))
for ax, (name, feats) in zip(axes, (("x0, x1", lambda Z: Z), ("x0, x1, x1 − x0", lambda Z: np.c_[Z, Z[:, 1] - Z[:, 0]]))):
    m = GBClassifier(n_estimators=200, learning_rate=0.1, max_depth=1).fit(feats(a), c)
    acc = np.mean((m.predict_proba(feats(b))[:, 1] > 0.5) == d)
    P = m.predict_proba(feats(grid))[:, 1].reshape(G0.shape)
    ax.contourf(G0, G1, P, levels=20, cmap=cmap_diverging(), alpha=0.85)
    ax.contour(G0, G1, P, levels=[0.5], colors="k", linewidths=1.5)
    ax.plot([0, 1], [0, 1], "k--", lw=1)
    ax.set(title=f"{name}: точность {acc:.3f}", xlabel="x0", ylabel="x1")
    print(f"{name:16s} точность на тесте {acc:.3f}")
fig.tight_layout()
ex.finish(fig, "feature_difference")
