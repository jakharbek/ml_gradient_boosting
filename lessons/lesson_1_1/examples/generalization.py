"""Обобщение: «зубрила», интерполяция и экстраполяция.

Запуск:  python lessons/lesson_1_1/examples/generalization.py [--save] [--no-show]

Модели обучены на 40 точках «волны» с x от 0 до 10 и проверены на 70 новых точках с x от 0 до 14
(шаг 12 урока). «Зубрила» (ответ ближайшего примера) не ошибается на обучении, но на новых точках
ошибается примерно на 2σ²; деревья и бустинг замирают за пределами знакомой области.
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

X_tr, y_tr = datasets.regression_1d(kind="wave", n=40, noise=0.4, seed=11)
X_new, y_new = datasets.regression_1d(kind="wave", n=70, noise=0.4, seed=12, x_min=0, x_max=14)
inside = X_new[:, 0] <= 10


def memorizer(X: np.ndarray) -> np.ndarray:
    """«Зубрила»: ответ ближайшего обучающего примера."""
    return y_tr[np.abs(X[:, :1] - X_tr[:, 0]).argmin(axis=1)]


a, b = np.polyfit(X_tr[:, 0], y_tr, 1)
models = {
    "«зубрила»": memorizer,
    "константа": lambda X: np.full(len(X), y_tr.mean()),
    "прямая": lambda X: a * X[:, 0] + b,
    "дерево глубины 3": RegressionTree(max_depth=3).fit(X_tr, -y_tr).predict,
    "бустинг, 100 деревьев": GBRegressor(n_estimators=100, learning_rate=0.1, max_depth=2).fit(X_tr, y_tr).predict,
    "истинная f(x)": lambda X: datasets.true_function("wave", X[:, 0]),
}
print(f"новых точек: {inside.sum()} при x ≤ 10 и {(~inside).sum()} при x > 10")
print(f"{'модель':22s} {'обучение':>9s} {'новые x≤10':>11s} {'новые x>10':>11s}")
res = {}
for name, predict in models.items():
    res[name] = (mse(y_tr, predict(X_tr)), mse(y_new[inside], predict(X_new[inside])), mse(y_new[~inside], predict(X_new[~inside])))
    print(f"{name:22s} {res[name][0]:9.3f} {res[name][1]:11.3f} {res[name][2]:11.3f}")

assert res["«зубрила»"][0] == 0 and abs(res["«зубрила»"][1] - 2 * 0.4**2) < 0.01, "ошибка зубрилы ≈ 2σ²"
assert res["прямая"][2] < min(res["дерево глубины 3"][2], res["бустинг, 100 деревьев"][2]), "прямая лучше экстраполирует"
assert res["бустинг, 100 деревьев"][1] < res["прямая"][1], "бустинг лучше интерполирует"

gx = np.linspace(0, 14, 561)[:, None]
fig, axes = plt.subplots(1, 2, figsize=(11, 3.8), sharey=True)
for ax, name, color in ((axes[0], "«зубрила»", style.BLUE), (axes[1], "бустинг, 100 деревьев", style.BLUE)):
    ax.axvspan(0, 10, color=style.BLUE, alpha=0.06)
    ax.scatter(X_tr[:, 0], y_tr, color=style.ROLE["train"], s=18, label="обучение")
    ax.scatter(X_new[:, 0], y_new, color=style.ROLE["test"], marker="s", s=16, label="новые объекты")
    ax.plot(gx[:, 0], models[name](gx), color=color, lw=2, drawstyle="steps-mid", label=name)
    ax.plot(gx[:, 0], a * gx[:, 0] + b, color=style.ORANGE, lw=1.6, label="прямая")
    ax.set(xlabel="x", title=f"{name}: новые x>10 MSE = {res[name][2]:.2f}")
axes[0].set_ylabel("y")
axes[0].legend(fontsize=8, loc="upper left")
fig.tight_layout()
ex.finish(fig, "generalization")
