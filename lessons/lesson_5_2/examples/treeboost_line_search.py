"""TreeBoost: как линейный поиск в листьях ускоряет бустинг с потерями L1.

Запуск:  python lessons/lesson_5_2/examples/treeboost_line_search.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import RegressionTree, datasets
from gbcourse.cli import Example

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=300, noise=0.3, seed=53, outliers=0.1)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
fig, ax = plt.subplots(figsize=(7.5, 3.8))
final = {}
for line_search in (False, True):
    F, F_te = np.full(len(y_tr), np.median(y_tr)), np.full(len(y_te), np.median(y_tr))
    curve = []
    for _ in range(300):
        r = np.sign(y_tr - F)
        tree = RegressionTree(max_depth=2).fit(X_tr, -r)
        if line_search:
            for leaf in tree.leaves:
                leaf.value = np.median(y_tr[leaf.rows] - F[leaf.rows])
            tree.refresh_values()
        F += 0.1 * tree.predict(X_tr)
        F_te += 0.1 * tree.predict(X_te)
        curve.append(np.mean(np.abs(y_te - F_te)))
    label = "TreeBoost: медианы остатков" if line_search else "листья = среднее знаков"
    final[line_search] = curve[-1]
    ax.plot(curve, label=label)
    print(f"{label:30s}: MAE теста через 50 деревьев {curve[49]:.4f}, через 300 — {curve[-1]:.4f}")
assert final[True] <= final[False] + 1e-9
print("Вначале варианты близки; со временем шаги-знаки (не уменьшаются у оптимума) уводят модель в шум,")
print("а медианы уменьшаются вместе с остатками — качество стабильно.")
ax.set(xlabel="итерация", ylabel="MAE на тесте", title="Линейный поиск в листьях для L1")
ax.legend()
ex.finish(fig, "treeboost_line_search")
