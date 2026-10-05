"""Плотная сетка по трём гиперпараметрам LightGBM — «поверхность ошибки» для сравнения стратегий поиска.

num_leaves × colsample_bytree × subsample на задаче Фридмана (4000 объектов, 60/20/20, темп 0.1,
ранняя остановка). Сохраняем RMSE на валидации в каждой точке: виджет урока моделирует на этой
поверхности перебор по сетке и случайный поиск с разным бюджетом.
Результаты — в lessons/lesson_11_2/web/results.js.

Запуск:  python lessons/lesson_11_2/examples/search_grid.py [--save] [--no-show]   (≈ 2–3 минуты)
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[3] / "shared" / "python"))

import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.cli import Example

ex = Example(__file__)
AXES = {
    "num_leaves": [2, 3, 4, 5, 6, 8, 12, 16, 24, 32, 64],
    "colsample_bytree": [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    "subsample": [0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
}

X, y = datasets.friedman1(n=4000, noise=1.0, seed=170)
perm = np.random.default_rng(0).permutation(len(y))
tr, va = perm[:2400], perm[2400:3200]
names = list(AXES)
shape = tuple(len(v) for v in AXES.values())
val = np.empty(shape)
for idx in np.ndindex(shape):
    params = {k: AXES[k][i] for k, i in zip(names, idx)}
    m = lgb.LGBMRegressor(n_estimators=3000, learning_rate=0.1, subsample_freq=1, verbose=-1, random_state=0, **params)
    m.fit(X[tr], y[tr], eval_X=(X[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(50, verbose=False)])
    val[idx] = np.sqrt(min(m.evals_result_["valid_0"]["l2"]))
best = np.unravel_index(np.argmin(val), shape)
print("точек:", val.size, "| лучшая:", {k: AXES[k][i] for k, i in zip(names, best)}, f"RMSE {val.min():.4f}")
for k, axis in enumerate(names):
    prof = val.min(axis=tuple(j for j in range(3) if j != k))
    print(f"{axis:17s} лучшая RMSE по значениям: " + ", ".join(f"{v}→{p:.3f}" for v, p in zip(AXES[axis], prof)))

out = {"axes": AXES, "names": names, "values": [round(float(v), 4) for v in val.ravel()], "shape": list(shape)}
target = HERE.parents[1] / "web" / "results.js"
target.write_text(
    "/* Сгенерировано lessons/lesson_11_2/examples/search_grid.py — не редактировать вручную. */\n"
    "(function (root) {\n  'use strict';\n  (root.GBC || (root.GBC = {})).searchGrid = "
    + json.dumps(out, ensure_ascii=False) + ";\n})(typeof window !== 'undefined' ? window : globalThis);\n",
    encoding="utf-8",
)
print("записано:", target.relative_to(HERE.parents[3]))

fig, axes = plt.subplots(1, 3, figsize=(15, 3.6))
for k, (ax, axis) in enumerate(zip(axes, names)):
    prof = val.min(axis=tuple(j for j in range(3) if j != k))
    ax.plot(range(len(AXES[axis])), prof, marker="o")
    ax.set(xticks=range(len(AXES[axis])), xticklabels=AXES[axis], xlabel=axis, ylabel="лучшая RMSE при этом значении")
fig.tight_layout()
ex.finish(fig, "search_grid")
