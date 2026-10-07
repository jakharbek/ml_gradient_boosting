"""Ранняя остановка бустинга по валидационной выборке.

Запуск:  python lessons/lesson_1_4/examples/early_stopping.py [--save] [--no-show]

300 точек синуса делятся на обучение (210) и валидацию (90), ещё 500 новых точек — для честной
проверки (шаг 8 урока). Для нескольких темпов ν скрипт находит лучшую итерацию по валидации,
сравнивает ошибку на новых данных в ней и после всех деревьев и проверяет, что параметр
early_stopping_rounds учебной библиотеки находит ту же итерацию.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets, style
from gbcourse.cli import Example
from gbcourse.metrics import mse

ex = Example(__file__)

X, y = datasets.regression_1d(kind="sine", n=300, noise=0.4, seed=7)
X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)
Xt, yt = datasets.regression_1d(kind="sine", n=500, noise=0.4, seed=107)
M = 500

fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
for nu, color in zip((1.0, 0.3, 0.1), style.SERIES):
    gb = GBRegressor(n_estimators=M, learning_rate=nu, max_depth=2).fit(X_tr, y_tr, eval_set=(X_val, y_val))
    val = 2 * np.array(gb.history_["eval"])  # history хранит ½·MSE
    new = np.array([mse(yt, gb.predict(Xt, n_iter=m)) for m in range(M + 1)])
    best = int(np.argmin(val))
    es = GBRegressor(n_estimators=M, learning_rate=nu, max_depth=2, early_stopping_rounds=30).fit(X_tr, y_tr, eval_set=(X_val, y_val))
    print(f"ν = {nu:3}: лучшая итерация {best:3d}; новые данные: при остановке {new[best]:.4f}, после {M} — {new[M]:.4f}; "
          f"early_stopping_rounds=30 → {es.best_iteration_}")
    assert es.best_iteration_ == best and new[best] < new[M]
    axes[0].semilogx(range(1, M + 1), val[1:], color=color, label=f"валидация, ν = {nu}")
    axes[0].axvline(best, color=color, lw=1, ls=(0, (3, 3)))
    axes[1].semilogx(range(1, M + 1), new[1:], color=color, label=f"новые данные, ν = {nu}")
    axes[1].scatter([best], [new[best]], color=color, zorder=3)
axes[0].set(xlabel="итерация", ylabel="MSE", ylim=(0.1, 0.5), title="Валидация: где остановиться")
axes[1].set(xlabel="итерация", ylabel="MSE", ylim=(0.1, 0.5), title="Новые данные: точки — момент остановки")
for ax in axes:
    ax.legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "early_stopping")
