"""Джини против энтропии: точность деревьев классификации разной глубины.

Запуск:  python lessons/lesson_2_2/examples/gini_vs_entropy.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
from sklearn.tree import DecisionTreeClassifier

from gbcourse import datasets
from gbcourse.cli import Example

ex = Example(__file__)

X, y = datasets.classification_2d(kind="moons", n=400, noise=0.3, seed=7)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.4, seed=0)
depths = range(1, 11)
fig, ax = plt.subplots(figsize=(7.5, 3.8))
for crit in ("gini", "entropy"):
    acc = [DecisionTreeClassifier(max_depth=d, criterion=crit, random_state=0).fit(X_tr, y_tr).score(X_te, y_te) for d in depths]
    ax.plot(list(depths), acc, marker="o", label=crit)
    print(f"{crit:8s}: " + " ".join(f"{a:.3f}" for a in acc))
ax.set(xlabel="глубина", ylabel="точность на тесте", title="Критерии почти всегда дают похожий результат")
ax.legend()
ex.finish(fig, "gini_vs_entropy")
