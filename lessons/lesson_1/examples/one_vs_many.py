"""Один против многих: пень, глубокое дерево, бэггинг и бустинг на одних данных.

Запуск:  python lessons/lesson_1/examples/one_vs_many.py [--save] [--no-show]

Обучение — 60 точек «волны с трендом», проверка — 300 новых точек из того же источника.
Скрипт печатает ошибку каждой модели на обучении и на новых данных и проверяет главный
вывод шага 5 урока: сумма слабых учеников (пней) точнее одного глубокого дерева.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import BaggingTrees, GBRegressor, RegressionTree, datasets, style
from gbcourse.cli import Example
from gbcourse.metrics import mse
from gbcourse.plotting import plot_data, plot_truth

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=60, noise=0.35, seed=7)
Xn, yn = datasets.regression_1d(kind="wave", n=300, noise=0.35, seed=107)
NOISE2 = 0.35**2

models = {
    "пень": RegressionTree(max_depth=1).fit(X, -y),
    "дерево глубины 8": RegressionTree(max_depth=8).fit(X, -y),
    "бэггинг 50 деревьев": BaggingTrees(n_estimators=50, max_depth=8, seed=0).fit(X, y),
    "бустинг 100 пней": GBRegressor(n_estimators=100, learning_rate=0.3, max_depth=1).fit(X, y),
}
res = {}
print(f"{'модель':22s} {'MSE обучение':>13s} {'MSE новые':>10s}")
for name, model in models.items():
    res[name] = (mse(y, model.predict(X)), mse(yn, model.predict(Xn)))
    print(f"{name:22s} {res[name][0]:13.4f} {res[name][1]:10.4f}")
print(f"{'шум σ²':22s} {'':13s} {NOISE2:10.4f}")

assert res["дерево глубины 8"][0] < 0.02, "глубокое дерево почти запоминает обучение"
assert res["бустинг 100 пней"][1] < res["дерево глубины 8"][1], "бустинг пней точнее глубокого дерева"
assert res["бустинг 100 пней"][1] < res["пень"][1] / 2

print("\nБустинг пней: ошибка на новых данных при разном темпе (300 пней)")
for nu in (1.0, 0.3, 0.1):
    gb = GBRegressor(n_estimators=300, learning_rate=nu, max_depth=1).fit(X, y)
    staged = [mse(yn, gb.predict(Xn, n_iter=m)) for m in (10, 50, 100, 300)]
    print(f"  ν = {nu:3.1f}: после 10/50/100/300 деревьев → " + " / ".join(f"{v:.4f}" for v in staged))

grid = np.linspace(0, 10, 600).reshape(-1, 1)
fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
plot_data(axes[0], X, y, label="обучение")
plot_truth(axes[0], "wave", label="истина")
for (name, model), color in zip(list(models.items())[1:], [style.ORANGE, style.AQUA, style.BLUE]):
    axes[0].plot(grid[:, 0], model.predict(grid), color=color, lw=1.8, label=name)
axes[0].set(xlabel="x", ylabel="y", title="Модели на 60 обучающих точках")
axes[0].legend(fontsize=8)
names = list(res)
bars = axes[1].bar(range(4), [res[n][1] for n in names], color=[style.ROLE["model_prev"]] * 3 + [style.BLUE])
axes[1].bar_label(bars, fmt="%.3f")
axes[1].axhline(NOISE2, color=style.MUTED, ls=(0, (4, 3)), lw=1.2, label="шум σ²")
axes[1].set_xticks(range(4), ["пень", "дерево", "бэггинг", "бустинг"])
axes[1].set(ylabel="MSE на новых данных", title="Сумма слабых учеников точнее всех")
axes[1].legend()
fig.tight_layout()
ex.finish(fig, "one_vs_many")
