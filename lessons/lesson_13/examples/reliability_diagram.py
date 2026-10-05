"""Диаграмма надёжности: вероятности переобучающегося бустинга становятся самоуверенными.

Запуск:  python lessons/lesson_13/examples/reliability_diagram.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBClassifier, datasets
from gbcourse.cli import Example

ex = Example(__file__)
X, y = datasets.classification_2d(kind="moons", n=600, noise=0.35, seed=190)
X_te, y_te = datasets.classification_2d(kind="moons", n=3000, noise=0.35, seed=191)
model = GBClassifier(n_estimators=500, learning_rate=0.3, max_depth=4).fit(X, y)


def reliability(yy, p, bins=10):
    idx = np.minimum((p * bins).astype(int), bins - 1)
    return np.array([(p[idx == b].mean(), yy[idx == b].mean(), np.mean(idx == b)) for b in range(bins) if np.any(idx == b)])


fig, ax = plt.subplots(figsize=(5.5, 5))
ax.plot([0, 1], [0, 1], "k--", lw=1)
eces = {}
for k in (10, 500):
    p = 1 / (1 + np.exp(-model.predict_raw(X_te, k)))
    r = reliability(y_te, p)
    eces[k] = float(np.sum(r[:, 2] * np.abs(r[:, 0] - r[:, 1])))
    ax.plot(r[:, 0], r[:, 1], marker="o", label=f"{k} деревьев: ECE {eces[k]:.3f}, точность {np.mean((p > 0.5) == y_te):.3f}")
    print(f"{k:3d} деревьев: ECE {eces[k]:.4f}")
assert eces[500] > 3 * eces[10]
ax.set(xlabel="средний прогноз в корзине", ylabel="доля класса 1", title="Диаграмма надёжности")
ax.legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "reliability_diagram")
