"""Карта ошибки LightGBM по сетке «темп × число листьев» с ранней остановкой.

Задача Фридмана (4000 объектов), разбиение 60/20/20, три повтора. Для каждой клетки: лучшая RMSE на валидации,
RMSE на тесте, число деревьев, время. Результаты — в lessons/lesson_11/web/results.js (для виджета урока).

Запуск:  python lessons/lesson_11/examples/tuning_grid.py [--save] [--no-show]   (≈ 1 минута)
"""

import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[3] / "shared" / "python"))

import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.cli import Example

ex = Example(__file__)
LRS = [0.01, 0.03, 0.1, 0.3, 1.0]
LEAVES = [2, 4, 8, 16, 32, 64, 128]

X, y = datasets.friedman1(n=4000, noise=1.0, seed=170)
cells = {}
for seed in range(3):
    perm = np.random.default_rng(seed).permutation(len(y))
    tr, va, te = perm[:2400], perm[2400:3200], perm[3200:]
    for lr in LRS:
        for nl in LEAVES:
            t0 = time.perf_counter()
            m = lgb.LGBMRegressor(n_estimators=5000, learning_rate=lr, num_leaves=nl, min_child_samples=10, verbose=-1, random_state=seed)
            m.fit(X[tr], y[tr], eval_X=(X[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
            el = time.perf_counter() - t0
            val = float(np.sqrt(min(m.evals_result_["valid_0"]["l2"])))
            test = float(np.sqrt(np.mean((y[te] - m.predict(X[te])) ** 2)))
            cells.setdefault((lr, nl), []).append((val, test, m.best_iteration_, el))

grid = []
for lr in LRS:
    row = []
    for nl in LEAVES:
        v = np.array(cells[(lr, nl)])
        row.append({"val": round(float(v[:, 0].mean()), 4), "val_std": round(float(v[:, 0].std()), 4),
                    "test": round(float(v[:, 1].mean()), 4), "trees": int(v[:, 2].mean()), "time": round(float(v[:, 3].mean()), 3)})
    grid.append(row)
    print(f"ν = {lr:<5}: " + "  ".join(f"{c['val']:.3f}" for c in row))
out = {"lrs": LRS, "leaves": LEAVES, "grid": grid, "lightgbm": lgb.__version__}
target = HERE.parents[1] / "web" / "results.js"
target.write_text(
    "/* Сгенерировано lessons/lesson_11/examples/tuning_grid.py — не редактировать вручную. */\n"
    "(function (root) {\n  'use strict';\n  (root.GBC || (root.GBC = {})).tuningGrid = "
    + json.dumps(out, ensure_ascii=False, indent=2).replace("\n", "\n  ")
    + ";\n})(typeof window !== 'undefined' ? window : globalThis);\n",
    encoding="utf-8",
)
print("записано:", target.relative_to(HERE.parents[3]))

fig, axes = plt.subplots(1, 2, figsize=(12, 3.8))
for ax, key, title in ((axes[0], "val", "RMSE на валидации"), (axes[1], "trees", "число деревьев")):
    M = np.array([[c[key] for c in row] for row in grid], dtype=float)
    im = ax.imshow(np.log10(M) if key == "trees" else M, cmap="viridis_r" if key == "val" else "viridis", aspect="auto")
    for i in range(len(LRS)):
        for j in range(len(LEAVES)):
            ax.text(j, i, f"{M[i, j]:.2f}" if key == "val" else f"{int(M[i, j])}", ha="center", va="center", fontsize=7, color="w")
    ax.set(xticks=range(len(LEAVES)), xticklabels=LEAVES, yticks=range(len(LRS)), yticklabels=LRS, xlabel="num_leaves", ylabel="learning_rate", title=title)
fig.tight_layout()
ex.finish(fig, "tuning_grid")
