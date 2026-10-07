"""Спуск по прогнозам против бустинга: почему градиентному спуску нужны деревья.

Запуск:  python lessons/lesson_1_3/examples/prediction_descent.py [--save] [--no-show]

Параметры — сами прогнозы F(x_i) двенадцати обучающих точек (шаг 11 урока). Свободный спуск
F ← F + ν·(y − F) запоминает ответы, но не умеет предсказывать новые точки. Если шаг (антиградиент)
приближать деревом глубины 2, получается градиентный бустинг, и ошибка падает и на новых точках.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets, style
from gbcourse.cli import Example
from gbcourse.metrics import mse
from gbcourse.plotting import plot_data, plot_truth

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=12, noise=0.3, seed=3)
Xt, yt = datasets.regression_1d(kind="wave", n=200, noise=0.3, seed=103)
NU, K = 0.3, 40

F = np.full_like(y, y.mean())
free_train = [mse(y, F)]
for _ in range(K):
    F = F + NU * (y - F)  # антиградиент ½·Σ(y − F)² — остатки
    free_train.append(mse(y, F))
free_new = mse(yt, np.full_like(yt, y.mean()))  # для новых x правила нет: прогноз F0

gb = GBRegressor(n_estimators=K, learning_rate=NU, max_depth=2).fit(X, y)
gb_train = [mse(y, gb.predict(X, n_iter=k)) for k in range(K + 1)]
gb_new = [mse(yt, gb.predict(Xt, n_iter=k)) for k in range(K + 1)]

print(f"{'шаг':>4s} {'свободно: обучение':>19s} {'новые':>7s} {'бустинг: обучение':>18s} {'новые':>7s}")
for k in (0, 1, 5, 10, 20, 40):
    print(f"{k:4d} {free_train[k]:19.4f} {free_new:7.4f} {gb_train[k]:18.4f} {gb_new[k]:7.4f}")

assert free_train[-1] < 1e-5, "свободный спуск запоминает обучающие ответы"
assert gb_new[-1] < free_new / 3, "бустинг обобщает шаг на новые точки"
assert abs(free_train[1] - (1 - NU) ** 2 * free_train[0]) < 1e-12, "MSE умножается на (1 − ν)² за шаг"

grid = np.linspace(0, 10, 500).reshape(-1, 1)
fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
plot_data(axes[0], X, y, label="12 обучающих точек")
plot_truth(axes[0], "wave", label="истина")
axes[0].scatter(X[:, 0], F, marker="s", color=style.ORANGE, zorder=4, label="свободный спуск: прогнозы")
axes[0].axhline(y.mean(), color=style.ORANGE, ls=(0, (4, 3)), lw=1, label="свободный спуск: новые x")
axes[0].plot(grid[:, 0], gb.predict(grid), color=style.BLUE, lw=2, label="бустинг: функция F(x)")
axes[0].set(xlabel="x", ylabel="y", title=f"После {K} шагов")
axes[0].legend(fontsize=7)
axes[1].plot(free_train, color=style.ORANGE, label="свободно: обучение")
axes[1].axhline(free_new, color=style.ORANGE, ls=(0, (4, 3)), label="свободно: новые точки")
axes[1].plot(gb_train, color=style.BLUE, label="бустинг: обучение")
axes[1].plot(gb_new, color=style.BLUE, ls=(0, (4, 3)), label="бустинг: новые точки")
axes[1].set(xlabel="шаг k", ylabel="MSE", title="Запомнить или обобщить")
axes[1].legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "prediction_descent")
