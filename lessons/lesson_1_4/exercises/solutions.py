"""Решения упражнений урока 1.4.

Запуск:  python lessons/lesson_1_4/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, RegressionTree, datasets
from gbcourse.metrics import mse

grid = np.linspace(0, 10, 200).reshape(-1, 1)
truth = np.sin(grid[:, 0])


def bv(fit_predict, n=30, B=30):
    preds = np.array([fit_predict(*datasets.regression_1d("sine", n=n, noise=0.35, seed=s)) for s in range(1, B + 1)])
    return np.mean((preds.mean(0) - truth) ** 2), np.mean(preds.var(0))


# 1
for n in (30, 120):
    b2, v = bv(lambda X, y: RegressionTree(max_depth=8).fit(X, -y).predict(grid), n=n)
    print(f"1) n = {n:3d}: смещение² = {b2:.4f}, разброс = {v:.4f}")
print("   Разброс упал заметно сильнее: больше данных — меньше влияния шума конкретной выборки.")

# 2
for lr in (0.3, 0.05):
    best = None
    for M in (1, 3, 10, 30, 100, 300, 1000):
        b2, v = bv(lambda X, y, M=M, lr=lr: GBRegressor(n_estimators=M, learning_rate=lr, max_depth=2).fit(X, y).predict(grid), B=15)
        tot = b2 + v + 0.35**2
        if best is None or tot < best[1]:
            best = (M, tot)
    print(f"2) ν = {lr}: лучшее M = {best[0]} (ошибка {best[1]:.4f})")
print("   Меньше темп — больше нужно деревьев: произведение ν·M примерно сохраняется.")

# 3
X, y = datasets.regression_1d("sine", n=150, noise=0.35, seed=1)


def cv(seed):
    perm = np.random.default_rng(seed).permutation(len(y))
    folds = np.array_split(perm, 5)
    errs = []
    for j in range(5):
        trn = np.concatenate([folds[i] for i in range(5) if i != j])
        errs.append(mse(y[folds[j]], RegressionTree(max_depth=3).fit(X[trn], -y[trn]).predict(X[folds[j]])))
    return np.mean(errs)


single = [cv(s) for s in range(10)]
repeated = [np.mean([cv(10 * s + k) for k in range(3)]) for s in range(10)]
print(f"3) обычная CV: std оценки = {np.std(single):.4f}; повторённая ×3: std = {np.std(repeated):.4f}")

# 4
print("4) CV использовалась и для выбора, и для оценки — оценка оптимистична. Нужна вложенная CV")
print("   (внутренняя — выбор гиперпараметров, внешняя — оценка) или отдельная тестовая выборка.")
