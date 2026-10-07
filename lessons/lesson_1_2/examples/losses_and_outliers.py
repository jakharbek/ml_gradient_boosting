"""Потери решают, за чем гоняется бустинг: псевдо-остатки и выбросы.

Запуск:  python lessons/lesson_1_2/examples/losses_and_outliers.py [--save] [--no-show]

Синус с двумя выбросами (как в виджете шага 9 урока). Для квадратичных, абсолютных потерь
и потерь Хьюбера скрипт печатает стартовую константу и псевдо-остатки выбросов, обучает бустинг
и сравнивает ошибку на чистых новых данных — без ограничения на размер листа и с min_samples_leaf=5.
Видно, что Хьюбер устойчив только вместе с запретом крошечных листьев.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets, get_loss, style
from gbcourse.cli import Example
from gbcourse.metrics import mse
from gbcourse.plotting import plot_data, plot_truth

ex = Example(__file__)

X, y = datasets.regression_1d(kind="sine", n=30, noise=0.25, seed=4, outliers=0.1)
Xn, yn = datasets.regression_1d(kind="sine", n=300, noise=0.25, seed=104)
outl = np.abs(y - np.sin(X[:, 0])) > 2
print(f"выбросы: x = {np.round(X[outl, 0], 2)}, y = {np.round(y[outl], 2)}\n")

LOSSES = [("squared", {}, {}), ("absolute", {}, {}), ("huber", {"delta": 1.0}, {"huber_delta": 1.0})]
xs = np.linspace(0, 10, 500).reshape(-1, 1)
fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
plot_data(axes[0], X, y, label="данные")
plot_truth(axes[0], "sine", label="истина")
errors = {}
for (name, lkw, gkw), color in zip(LOSSES, style.SERIES):
    loss = get_loss(name, **lkw)
    F0 = loss.init(y)
    g = loss.negative_gradient(y, np.full_like(y, F0))
    print(f"{name:8s}: F0 = {F0:+.3f}; псевдо-остатки выбросов {np.round(g[outl], 2)}")
    for msl in (1, 5):
        gb = GBRegressor(loss=name, n_estimators=100, learning_rate=0.1, max_depth=2, min_samples_leaf=msl, **gkw).fit(X, y)
        errors[name, msl] = mse(yn, gb.predict(Xn))
        print(f"          min_samples_leaf = {msl}: MSE на чистых данных {errors[name, msl]:.4f}")
        if msl == 5:
            axes[0].plot(xs[:, 0], gb.predict(xs), color=color, lw=2, label=f"{name} (лист ≥ 5)")
    order = np.argsort(X[:, 0])
    axes[1].plot(X[order, 0], g[order], marker="o", ms=3, color=color, label=name)
assert errors["absolute", 1] < errors["squared", 1], "L1 не гоняется за выбросами"
assert errors["huber", 5] < errors["squared", 5] / 3, "Хьюбер устойчив, если выброс не может получить свой лист"

axes[0].set(xlabel="x", ylabel="y", ylim=(-2, 4), title="Бустинг: 100 деревьев глубины 2")
axes[0].legend(fontsize=8)
axes[1].axhline(0, color=style.AXIS, lw=1)
axes[1].set(xlabel="x", ylabel="−∂L/∂F в F₀", title="Чему учится первое дерево")
axes[1].legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "losses_and_outliers")
