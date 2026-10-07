"""Валидация по времени: случайные блоки против TimeSeriesSplit.

Запуск:  python lessons/lesson_1_4/examples/time_split.py [--save] [--no-show]

10 лет помесячных продаж (рост + сезонность + шум) и дерево по номеру месяца (шаг 13 урока).
Скрипт сравнивает три числа для каждой глубины: случайную 5-блочную кросс-валидацию, проверку
по времени (TimeSeriesSplit) и настоящую ошибку в следующие 24 месяца. Проверяется, что случайные
блоки сильно занижают ошибку будущего, а проверка по времени — нет.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.model_selection import TimeSeriesSplit

from gbcourse import RegressionTree, style
from gbcourse.cli import Example
from gbcourse.metrics import mse
from gbcourse.rng import Mulberry32

ex = Example(__file__)

rng = Mulberry32(5)
t = np.arange(144)
y = np.array([2 + 0.03 * ti + 0.6 * np.sin(2 * np.pi * ti / 12) + 0.3 * rng.normal() for ti in t])
X = t.reshape(-1, 1).astype(float)
hist, future = np.arange(120), np.arange(120, 144)
fold = np.empty(120, dtype=int)
fold[Mulberry32(0).permutation(120)] = np.arange(120) % 5


def err(tr, te, d):
    return mse(y[te], RegressionTree(max_depth=d).fit(X[tr], -y[tr]).predict(X[te]))


depths = range(1, 11)
rnd = [np.mean([err(hist[fold != j], hist[fold == j], d) for j in range(5)]) for d in depths]
tsp = [np.mean([err(tr, te, d) for tr, te in TimeSeriesSplit(n_splits=5).split(hist)]) for d in depths]
fut = [err(hist, future, d) for d in depths]
for d in depths:
    print(f"глубина {d:2d}: случайные блоки {rnd[d - 1]:.3f}   по времени {tsp[d - 1]:.3f}   будущее {fut[d - 1]:.3f}")
for d in range(2, 11):
    assert rnd[d - 1] < 0.6 * fut[d - 1], "случайные блоки должны сильно занижать ошибку будущего"
print(f"глубины 5–10: случайные блоки в среднем {np.mean(rnd[4:]):.3f}, по времени {np.mean(tsp[4:]):.3f}, будущее {np.mean(fut[4:]):.3f}")

fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
axes[0].scatter(t[:120], y[:120], s=8, color=style.ROLE["data"], label="история")
axes[0].scatter(t[120:], y[120:], s=14, facecolors="none", edgecolors=style.AQUA, label="будущее")
axes[0].step(t, RegressionTree(max_depth=6).fit(X[:120], -y[:120]).predict(X), where="mid", color=style.BLUE, label="дерево глубины 6")
axes[0].set(xlabel="месяц t", ylabel="продажи", title="За краем истории прогноз дерева постоянен")
axes[1].plot(depths, rnd, color=style.ORANGE, marker="o", label="случайные блоки")
axes[1].plot(depths, tsp, color=style.BLUE, marker="o", label="по времени")
axes[1].plot(depths, fut, color=style.AQUA, ls=(0, (5, 3)), marker="s", label="будущее")
axes[1].set(xlabel="глубина дерева", ylabel="MSE", ylim=(0, 1.5), title="Случайная CV обещает вдвое меньше")
for ax in axes:
    ax.legend()
fig.tight_layout()
ex.finish(fig, "time_split")
