"""Решения упражнений урока 2.3.

Запуск:  python lessons/lesson_2_3/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np
from sklearn.tree import DecisionTreeRegressor

from gbcourse import GBClassifier, RegressionTree, datasets
from gbcourse.metrics import accuracy, mse


def best_split(X, y, min_leaf):
    best = (None, None, 0.0)
    n, S = len(y), y.sum()
    for j in range(X.shape[1]):
        order = np.argsort(X[:, j], kind="stable")
        xs, ys = X[order, j], y[order]
        SL = np.cumsum(ys)[:-1]
        nL = np.arange(1, n)
        gain = SL**2 / nL + (S - SL) ** 2 / (n - nL) - S**2 / n
        gain[(xs[:-1] == xs[1:]) | (nL < min_leaf) | (n - nL < min_leaf)] = -np.inf
        k = int(np.argmax(gain))
        if gain[k] > best[2]:
            best = (j, (xs[k] + xs[k + 1]) / 2, gain[k])
    return best


def build(X, y, depth, max_depth, min_leaf):
    if depth >= max_depth or len(y) < 2 * min_leaf:
        return {"leaf": y.mean()}
    j, t, _ = best_split(X, y, min_leaf)
    if j is None:
        return {"leaf": y.mean()}
    m = X[:, j] <= t
    return {"j": j, "t": t, "L": build(X[m], y[m], depth + 1, max_depth, min_leaf), "R": build(X[~m], y[~m], depth + 1, max_depth, min_leaf)}


def predict(node, x):
    while "leaf" not in node:
        node = node["L"] if x[node["j"]] <= node["t"] else node["R"]
    return node["leaf"]


# 1
X, y = datasets.regression_1d(kind="wave", n=300, noise=0.5, seed=4)
root = build(X, y, 0, 5, 10)
ours = np.array([predict(root, x) for x in X])
sk = DecisionTreeRegressor(max_depth=5, min_samples_leaf=10).fit(X, y).predict(X)
print(f"1) расхождение с sklearn: {np.abs(ours - sk).max():.2e}")

# 2
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
te = [mse(y_te, RegressionTree(max_depth=None, min_samples_leaf=m).fit(X_tr, -y_tr).predict(X_te)) for m in range(1, 61)]
print(f"2) лучший min_samples_leaf = {int(np.argmin(te)) + 1} (MSE теста {min(te):.4f}; при 1 — {te[0]:.4f})")

# 3
Xx, yx = datasets.classification_2d("xor", n=200, noise=0.12, seed=9)
Xtr, Xte, ytr, yte = datasets.train_test_split(Xx, yx, test_size=0.3, seed=0)
for d in (1, 2):
    m = GBClassifier(max_depth=d, n_estimators=200, learning_rate=0.1).fit(Xtr, ytr)
    print(f"3) бустинг, глубина {d}: точность на тесте {accuracy(yte, m.predict(Xte)):.3f}")
print("   Модель из пней — сумма функций одного признака: F = f₀(x₀) + f₁(x₁). XOR — взаимодействие x₀·x₁,")
print("   его нельзя представить такой суммой. Глубина 2 даёт взаимодействия пар признаков.")
