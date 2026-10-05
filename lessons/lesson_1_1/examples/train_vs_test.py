"""Ошибка на обучении и на тесте для деревьев разной глубины.

Запуск:  python lessons/lesson_1_1/examples/train_vs_test.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt

from gbcourse import RegressionTree, datasets
from gbcourse.cli import Example
from gbcourse.metrics import mse

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=200, noise=0.4, seed=11)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)

depths = list(range(0, 13))
tr, te = [], []
for d in depths:
    t = RegressionTree(max_depth=d).fit(X_tr, -y_tr)
    tr.append(mse(y_tr, t.predict(X_tr)))
    te.append(mse(y_te, t.predict(X_te)))
    print(f"глубина {d:2d}: листьев {t.n_leaves:3d}, MSE обучение {tr[-1]:.4f}, тест {te[-1]:.4f}")

best = depths[te.index(min(te))]
print(f"Лучшая глубина по тесту: {best}")
assert tr[-1] < tr[0] and te[-1] > min(te), "глубокое дерево должно переобучаться"

fig, ax = plt.subplots(figsize=(7.5, 3.8))
ax.plot(depths, tr, marker="o", label="обучение")
ax.plot(depths, te, marker="o", label="тест")
ax.axvline(best, color="#898781", lw=1, ls=(0, (4, 3)))
ax.set(xlabel="максимальная глубина дерева", ylabel="MSE", title="Гибкость модели: обучение против теста")
ax.legend()
ex.finish(fig, "train_vs_test")
