"""Насколько можно верить одному тесту: оценка по 30 разным разбиениям.

Запуск:  python lessons/lesson_1_1/examples/test_estimate_spread.py [--save] [--no-show]

50 точек «волны» делятся на обучение и тест 30 способами (как в виджете шага 10 урока).
Для константы, прямой, дерева глубины 3 и бустинга печатается ошибка на обучении и разброс
ошибки на тесте; для дерева — ещё и зависимость разброса от доли теста.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, RegressionTree, datasets, style
from gbcourse.cli import Example
from gbcourse.metrics import mse

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=50, noise=0.5, seed=21)


def fit(name: str, Xtr: np.ndarray, ytr: np.ndarray):
    if name == "константа":
        c = ytr.mean()
        return lambda Z: np.full(len(Z), c)
    if name == "прямая":
        a, b = np.polyfit(Xtr[:, 0], ytr, 1)
        return lambda Z: a * Z[:, 0] + b
    if name == "дерево глубины 3":
        return RegressionTree(max_depth=3).fit(Xtr, -ytr).predict
    return GBRegressor(n_estimators=100, learning_rate=0.1, max_depth=2).fit(Xtr, ytr).predict


def run(name: str, test_size: float = 0.3) -> np.ndarray:
    out = []
    for seed in range(30):
        Xtr, Xte, ytr, yte = datasets.train_test_split(X, y, test_size=test_size, seed=seed)
        predict = fit(name, Xtr, ytr)
        out.append((mse(ytr, predict(Xtr)), mse(yte, predict(Xte))))
    return np.array(out)


names = ["константа", "прямая", "дерево глубины 3", "бустинг 100 деревьев"]
results = {}
print(f"{'модель':22s} {'обучение':>9s} {'тест: среднее':>14s} {'мин':>7s} {'макс':>7s}")
for name in names:
    res = run(name)
    results[name] = res
    print(f"{name:22s} {res[:, 0].mean():9.3f} {res[:, 1].mean():14.3f} {res[:, 1].min():7.3f} {res[:, 1].max():7.3f}")

tree = results["дерево глубины 3"]
assert abs(tree[0, 0] - 0.1196) < 1e-3 and abs(tree[0, 1] - 0.3209) < 1e-3, "числа шага 10 урока"
assert tree[:, 0].mean() < tree[:, 1].mean(), "ошибка на обучении оптимистична"

print("\nДерево глубины 3: разброс теста в зависимости от его доли")
for ts in (0.1, 0.3, 0.5):
    res = run("дерево глубины 3", ts)
    print(f"  тест {int(ts * 100):2d} %: от {res[:, 1].min():.3f} до {res[:, 1].max():.3f} (ст. откл. {res[:, 1].std():.3f})")

fig, ax = plt.subplots(figsize=(9, 3.8))
for k, (name, color) in enumerate(zip(names, style.SERIES)):
    res = results[name]
    ax.scatter(np.full(30, k) + np.linspace(-0.25, 0.25, 30), res[:, 1], color=color, s=16, alpha=0.8)
    ax.scatter([k], [res[:, 0].mean()], color=style.INK, marker="_", s=600, lw=2)
ax.axhline(0.25, color=style.MUTED, ls=(0, (4, 3)), lw=1, label="шум σ² = 0.25")
ax.set_xticks(range(4), names)
ax.set(ylabel="MSE на тесте", title="Каждая точка — одно разбиение; чёрная черта — средняя ошибка на обучении")
ax.legend()
fig.tight_layout()
ex.finish(fig, "test_estimate_spread")
