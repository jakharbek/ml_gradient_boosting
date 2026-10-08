"""Спуск по прогнозам против бустинга: почему градиентному спуску нужны деревья.

Запуск:  python lessons/lesson_1_3/examples/prediction_descent.py [--save] [--no-show]

Шаг 14 урока, виджет «Спуск по прогнозам». Параметры — сами прогнозы F(xᵢ) двенадцати обучающих
точек волны. Свободный спуск F ← F + ν·(y − F) запоминает ответы, но не умеет предсказывать новые
точки: там прогноз навсегда F₀. Если шаг (антиградиент) приближать деревом глубины 2, получается
градиентный бустинг: ошибка падает и на 200 новых точках — до k = 10, а дальше бустинг начинает
подгонять шум, и она растёт (повод для ранней остановки, шаг 8).
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
NU, K = 0.3, 40  # как в виджете: ν = 0.3, до 40 шагов

F = np.full_like(y, y.mean())
free_train = [mse(y, F)]
for _ in range(K):
    F = F + NU * (y - F)  # антиградиент ½·Σ(y − F)² — остатки
    free_train.append(mse(y, F))
free_new = mse(yt, np.full_like(yt, y.mean()))  # для новых x правила нет: прогноз F₀

gb = GBRegressor(n_estimators=K, learning_rate=NU, max_depth=2).fit(X, y)
gb_train = [mse(y, gb.predict(X, n_iter=k)) for k in range(K + 1)]
gb_new = [mse(yt, gb.predict(Xt, n_iter=k)) for k in range(K + 1)]
best_k = int(np.argmin(gb_new))

print(f"{'шаг':>4s} {'свободно: обучение':>19s} {'новые':>7s} {'бустинг: обучение':>18s} "
      f"{'новые':>7s}")
for k in (0, 1, 5, 10, 20, 40):
    print(f"{k:4d} {free_train[k]:19.4f} {free_new:7.4f} {gb_train[k]:18.4f} {gb_new[k]:7.4f}")
print(f"бустинг: минимум ошибки на новых точках при k = {best_k} ({gb_new[best_k]:.4f}), "
      f"к k = {K} она выросла до {gb_new[K]:.4f} — переобучение")

# --- числа шага 14 урока («Попробуйте» под виджетом) и упражнения 17 ---
assert abs(free_new - 1.4441) < 5e-5, "свободно: новые точки 1.4441 при любом k"
assert free_train[20] < 1e-5 and free_train[-1] < 1e-12, "свободно: обучение почти 0"
assert abs(gb_train[20] - 0.0055) < 5e-5 and abs(gb_new[20] - 0.2368) < 5e-5, "20 шагов, ν = 0.3"
assert best_k == 10 and abs(gb_new[10] - 0.2196) < 5e-5, "минимум на новых точках при k = 10"
assert abs(gb_new[K] - 0.2531) < 5e-5 and abs(gb_train[K] - 0.0002) < 5e-5, "к 40 шагам: рост"
assert gb_new[best_k] < gb_new[20] < gb_new[K], "после минимума ошибка на новых точках растёт"
assert gb_new[-1] < free_new / 3, "бустинг обобщает шаг на новые точки"
assert abs(free_train[1] - (1 - NU) ** 2 * free_train[0]) < 1e-12, "MSE × (1 − ν)² за шаг"

grid = np.linspace(0, 10, 500).reshape(-1, 1)
fig, axes = plt.subplots(1, 2, figsize=(11, 3.9))
axes[0].scatter(Xt[:, 0], yt, s=9, color=style.AQUA, alpha=0.35, linewidths=0, zorder=1,
                label="200 новых точек")
plot_data(axes[0], X, y, label="12 обучающих точек", s=30)
plot_truth(axes[0], "wave", label="истина")
axes[0].scatter(X[:, 0], F, marker="s", s=30, color=style.ORANGE, edgecolor=style.SURFACE, zorder=4,
                label="свободный спуск: прогнозы")
axes[0].axhline(y.mean(), color=style.ORANGE, ls=(0, (4, 3)), lw=1.2,
                label="свободный спуск: новые x")
axes[0].plot(grid[:, 0], gb.predict(grid, n_iter=best_k), color=style.BLUE, lw=2,
             label=f"бустинг: F(x) после {best_k} шагов")
axes[0].set(xlabel="x", ylabel="y", title=f"Свободно ({K} шагов) против бустинга (k = {best_k})")
axes[0].legend(fontsize=7.5)
axes[1].plot(free_train, color=style.ORANGE, label="свободно: обучение")
axes[1].axhline(free_new, color=style.ORANGE, ls=(0, (4, 3)), label="свободно: новые точки")
axes[1].plot(gb_train, color=style.BLUE, label="бустинг: обучение")
axes[1].plot(gb_new, color=style.BLUE, ls=(0, (4, 3)), label="бустинг: новые точки")
axes[1].plot([best_k], [gb_new[best_k]], "o", color=style.BLUE, ms=7, mec=style.SURFACE)
axes[1].annotate(f"минимум: k = {best_k}, {gb_new[best_k]:.4f}", (best_k, gb_new[best_k]),
                 xytext=(8, 14), textcoords="offset points", fontsize=8.5, color=style.INK_2)
axes[1].set(xlabel="шаг k", ylabel="MSE", title="Запомнить или обобщить")
axes[1].legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "prediction_descent")
