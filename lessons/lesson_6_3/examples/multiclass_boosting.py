"""Softmax-бустинг на трёх классах: области решения и сверка с scikit-learn.

Запуск:  python lessons/lesson_6_3/examples/multiclass_boosting.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier

from gbcourse import GBClassifier, datasets
from gbcourse.cli import Example
from gbcourse.plotting import plot_decision_surface

ex = Example(__file__)

X, y = datasets.classification_2d(kind="blobs3", n=300, noise=0.7, seed=65)
m = GBClassifier(n_estimators=100, learning_rate=0.2, max_depth=2).fit(X, y)
sk = GradientBoostingClassifier(n_estimators=100, learning_rate=0.2, max_depth=2).fit(X, y)
diff = np.abs(m.predict_proba(X) - sk.predict_proba(X)).max()
print(f"расхождение с sklearn: {diff:.2e}; точность на обучении {np.mean(m.predict(X) == y):.3f}")
assert diff < 1e-8

fig, ax = plt.subplots(figsize=(6, 5))
plot_decision_surface(ax, m.predict_proba, X, y, title="Softmax-бустинг: 100 итераций × 3 дерева")
ex.finish(fig, "multiclass_boosting")
