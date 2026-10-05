"""AdaBoost: как веса объектов концентрируются на трудных и испорченных точках.

Запуск:  python lessons/lesson_3_2/examples/adaboost_weights.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import AdaBoost, Mulberry32, datasets
from gbcourse.cli import Example
from gbcourse.style import ROLE

ex = Example(__file__)

X, y = datasets.classification_2d(kind="circles", n=160, noise=0.15, seed=5)
rng = Mulberry32(99)
flip = np.array([rng.random() < 0.08 for _ in range(len(y))])
y_noisy = np.where(flip, 1 - y, y)
ada = AdaBoost(n_estimators=150).fit(X, y_noisy)

fig, axes = plt.subplots(1, 3, figsize=(14, 4.4))
for ax, m in zip(axes, (1, 20, 150)):
    w = ada.weights_[min(m, len(ada.weights_) - 1)]
    for c in (0, 1):
        mask = y_noisy == c
        ax.scatter(X[mask, 0], X[mask, 1], s=4000 * w[mask] + 4, color=ROLE["classes"][c], alpha=0.8,
                   edgecolor=np.where(flip[mask], "#0b0b0b", "#fcfcfb"), linewidth=1.2, label=f"класс {c}")
    ax.set_title(f"веса после {m} шагов: {w[flip].sum():.0%} на испорченных")
    ax.set_aspect("equal")
axes[0].legend()
print(f"доля веса на {flip.sum()} испорченных точках после 150 шагов: {ada.weights_[-1][flip].sum():.1%}")
fig.tight_layout()
ex.finish(fig, "adaboost_weights")
