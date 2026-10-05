"""Дерево как кусочно-постоянная функция: лесенка в 1D и прямоугольники в 2D.

Запуск:  python lessons/lesson_2/examples/tree_regions.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt

from gbcourse import RegressionTree, datasets
from gbcourse.cli import Example
from gbcourse.plotting import plot_data, plot_decision_surface, plot_predict_1d

ex = Example(__file__)

X, y = datasets.regression_1d(kind="sine", n=60, noise=0.25, seed=3)
Xc, yc = datasets.classification_2d(kind="moons", n=160, noise=0.25, seed=4)

fig, axes = plt.subplots(1, 2, figsize=(12, 4.2))
tree = RegressionTree(max_depth=3).fit(X, -y)
plot_data(axes[0], X, y)
plot_predict_1d(axes[0], tree.predict, X, label=f"дерево глубины 3 ({tree.n_leaves} листьев)")
axes[0].legend()
axes[0].set_title("1D: лесенка")

# Регрессионное дерево на метках 0/1 = дерево классификации с критерием Джини
clf = RegressionTree(max_depth=3).fit(Xc, -yc)
proba = lambda Z: clf.predict(Z)  # noqa: E731 — доля класса 1 в листе
plot_decision_surface(axes[1], proba, Xc, yc, title="2D: прямоугольники", show_contour=False)
print(clf.describe(["x0", "x1"]))
fig.tight_layout()
ex.finish(fig, "tree_regions")
