"""Решения упражнений урока 1.1.

Запуск:  python lessons/lesson_1_1/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import RegressionTree, datasets
from gbcourse.metrics import mse

X, y = datasets.regression_1d(kind="wave", n=40, noise=0.4, seed=11)
x = X[:, 0]

# 1
cs = np.arange(-1, 4, 0.001)
losses = [np.mean((y - c) ** 2) for c in cs]
print(f"1) минимум на сетке: c = {cs[int(np.argmin(losses))]:.3f}; среднее y = {y.mean():.3f}")

# 2
stump = RegressionTree(max_depth=1).fit(X, -y)
t0 = stump.nodes[0].threshold


def stump_mse(t: float) -> float:
    left = x <= t
    pred = np.where(left, y[left].mean(), y[~left].mean())
    return mse(y, pred)


print(f"2) порог {t0:.3f}: MSE {stump_mse(t0):.4f}; −0.3: {stump_mse(t0 - 0.3):.4f}; +0.3: {stump_mse(t0 + 0.3):.4f}")
assert stump_mse(t0) <= min(stump_mse(t0 - 0.3), stump_mse(t0 + 0.3))

# 3
for noise in (0.1, 1.0):
    Xn, yn = datasets.regression_1d(kind="wave", n=200, noise=noise, seed=11)
    X_tr, X_te, y_tr, y_te = datasets.train_test_split(Xn, yn, test_size=0.3, seed=0)
    te = [mse(y_te, RegressionTree(max_depth=d).fit(X_tr, -y_tr).predict(X_te)) for d in range(13)]
    print(f"3) шум {noise}: лучшая глубина {int(np.argmin(te))} (MSE теста {min(te):.3f})")
print("   Чем больше шум, тем раньше гибкость начинает вредить: лучшая глубина меньше.")

# 4
print("4) (а) регрессия (или порядковая классификация); (б) многоклассовая классификация;")
print("   (в) ранжирование; (г) бинарная классификация с выдачей вероятности.")
