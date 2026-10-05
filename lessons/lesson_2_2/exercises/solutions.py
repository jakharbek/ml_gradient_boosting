"""Решения упражнений урока 2.2.

Запуск:  python lessons/lesson_2_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np
from sklearn.tree import DecisionTreeClassifier

from gbcourse import datasets

gini = lambda p: 2 * p * (1 - p)  # noqa: E731

# 1
n, nl, nr = 100, 40, 60
p, pl, pr = 0.2, 0.0, 20 / 60
err_before, err_after = 20, 0 + 20
g_gain = gini(p) - nl / n * gini(pl) - nr / n * gini(pr)
print(f"1) слева 40/0, справа 40/20: ошибок было {err_before}, стало {err_after}; выигрыш Джини = {g_gain:.4f} > 0")

# 2
X, y = datasets.classification_2d(kind="moons", n=400, noise=0.3, seed=7)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.4, seed=0)
diffs = []
for d in range(1, 11):
    a = [DecisionTreeClassifier(max_depth=d, criterion=c, random_state=0).fit(X_tr, y_tr).score(X_te, y_te) for c in ("gini", "entropy")]
    diffs.append(a[0] - a[1])
print(f"2) средняя разница точности (Джини − энтропия): {np.mean(diffs):+.4f}, макс |разница| {np.max(np.abs(diffs)):.4f} — систематики нет")

# 3
print("3) G(p) = 2p(1−p) вогнута (G'' = −4 < 0). По неравенству Йенсена для вогнутой функции")
print("   w·G(p_L) + (1−w)·G(p_R) ≤ G(w·p_L + (1−w)·p_R) = G(p), где w = n_L/n. Равенство — только при p_L = p_R.")
rng = np.random.default_rng(1)
for _ in range(3):
    w, pl, pr = rng.random(3)
    pm = w * pl + (1 - w) * pr
    print(f"   проверка: {w * gini(pl) + (1 - w) * gini(pr):.4f} ≤ {gini(pm):.4f}")
