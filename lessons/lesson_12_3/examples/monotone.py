"""Монотонные ограничения в LightGBM: когда зависимость действительно монотонна и когда нет.

y = g(x0) + 0.5·sin(2π·x1) + шум(σ = 0.5). Сценарий «монотонна»: g(x0) = log(1 + 3x0).
Сценарий «не монотонна»: g(x0) = log(1 + 3x0) − 1.2·exp(−((x0 − 0.7)/0.08)²) (провал около 0.7).
Сравниваем модель без ограничений и с monotone_constraints=[1, 0]: RMSE относительно истинной функции
(среднее по 5 выборкам) и число «шагов вниз» вдоль x0. Кривые — в lessons/lesson_12_3/web/results.js.

Запуск:  python lessons/lesson_12_3/examples/monotone.py [--save] [--no-show]
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[3] / "shared" / "python"))

import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import ROLE

ex = Example(__file__)
G = {
    "монотонна": lambda x0: np.log1p(3 * x0),
    "не монотонна": lambda x0: np.log1p(3 * x0) - 1.2 * np.exp(-(((x0 - 0.7) / 0.08) ** 2)),
}
SIZES = [50, 200, 1000]
grid = np.linspace(0, 1, 101)
X_test = np.random.default_rng(99).uniform(0, 1, (5000, 2))
out = {"grid": [round(float(v), 3) for v in grid], "scenarios": []}

for name, g in G.items():
    truth = lambda X, g=g: g(X[:, 0]) + 0.5 * np.sin(2 * np.pi * X[:, 1])
    sc = {"name": name, "truth": [round(float(v), 4) for v in g(grid)], "sizes": []}
    for n in SIZES:
        rec = {"n": n}
        for kind, mc in (("free", [0, 0]), ("mono", [1, 0])):
            rmses, downs = [], []
            for s in range(5):
                r = np.random.default_rng(s)
                X = r.uniform(0, 1, (n, 2))
                y = truth(X) + r.normal(0, 0.5, n)
                m = lgb.LGBMRegressor(n_estimators=200, learning_rate=0.05, num_leaves=8, min_child_samples=5,
                                      monotone_constraints=mc, verbose=-1).fit(X, y)
                rmses.append(float(np.sqrt(np.mean((truth(X_test) - m.predict(X_test)) ** 2))))
                # PDP по x0: усредняем прогноз по x1 из тестовой выборки
                pdp = np.array([m.predict(np.c_[np.full(500, v), X_test[:500, 1]]).mean() for v in grid])
                pdp -= np.mean(0.5 * np.sin(2 * np.pi * X_test[:500, 1]))  # вычитаем средний вклад x1
                downs.append(int(np.sum(np.diff(pdp) < -1e-9)))
                if s == 0:
                    rec[kind + "_curve"] = [round(float(v), 4) for v in pdp]
                    if kind == "free":
                        rec["points"] = {"x": [round(float(v), 3) for v in X[:120, 0]],
                                         "y": [round(float(v), 3) for v in (y - 0.5 * np.sin(2 * np.pi * X[:, 1]))[:120]]}
            rec[kind + "_rmse"] = round(float(np.mean(rmses)), 4)
            rec[kind + "_down"] = round(float(np.mean(downs)), 1)
        sc["sizes"].append(rec)
        print(f"{name:12s} n = {n:4d}: RMSE без ограничений {rec['free_rmse']:.4f}, с ограничением {rec['mono_rmse']:.4f}; "
              f"шагов вниз по PDP {rec['free_down']:.1f} / {rec['mono_down']:.1f}")
    out["scenarios"].append(sc)

target = HERE.parents[1] / "web" / "results.js"
target.write_text(
    "/* Сгенерировано lessons/lesson_12_3/examples/monotone.py — не редактировать вручную. */\n"
    "(function (root) {\n  'use strict';\n  (root.GBC || (root.GBC = {})).monotone = "
    + json.dumps(out, ensure_ascii=False) + ";\n})(typeof window !== 'undefined' ? window : globalThis);\n",
    encoding="utf-8",
)
print("записано:", target.relative_to(HERE.parents[3]))

fig, axes = plt.subplots(1, 2, figsize=(12, 3.8))
for ax, sc in zip(axes, out["scenarios"]):
    rec = sc["sizes"][1]
    ax.scatter(rec["points"]["x"], rec["points"]["y"], s=8, color=ROLE["data"], alpha=0.5)
    ax.plot(grid, sc["truth"], color=ROLE["truth"], ls="--", label="истина")
    ax.plot(grid, rec["free_curve"], color=ROLE["model"], label=f"без ограничений: RMSE {rec['free_rmse']:.3f}")
    ax.plot(grid, rec["mono_curve"], color=ROLE["tree"], label=f"монотонная: RMSE {rec['mono_rmse']:.3f}")
    ax.set(title=f"Зависимость {sc['name']}, n = 200", xlabel="x0", ylabel="вклад x0")
    ax.legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "monotone")
