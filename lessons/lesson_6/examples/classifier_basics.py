"""Бустинг-классификатор: граница решения после разного числа деревьев и сверка с scikit-learn.

Запуск:  python lessons/lesson_6/examples/classifier_basics.py [--save] [--no-show]
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

X, y = datasets.classification_2d(kind="moons", n=300, noise=0.25, seed=61)
model = GBClassifier(n_estimators=150, learning_rate=0.3, max_depth=2).fit(X, y)
sk = GradientBoostingClassifier(n_estimators=150, learning_rate=0.3, max_depth=2).fit(X, y)
diff = np.abs(model.predict_proba(X) - sk.predict_proba(X)).max()
print(f"расхождение вероятностей с sklearn: {diff:.2e}")
assert diff < 1e-8

fig, axes = plt.subplots(1, 3, figsize=(14, 4.2))
for ax, m in zip(axes, (1, 10, 150)):
    plot_decision_surface(ax, lambda Z, m=m: model.predict_proba(Z, n_iter=m), X, y, title=f"после {m} деревьев")
fig.tight_layout()
ex.finish(fig, "classifier_basics")
