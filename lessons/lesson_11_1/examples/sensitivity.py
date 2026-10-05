"""Чувствительность LightGBM к гиперпараметрам: меняем по одному параметру вокруг значений по умолчанию.

Две задачи: регрессия Фридмана (4000 × 10) и «луны» + 8 шумовых признаков (10 000 × 10, log-loss).
Ранняя остановка по валидации (60/20/20), три повтора. Для каждого значения параметра — лучшая метрика
на валидации; «важность» параметра — размах метрики по его значениям.
Результаты — в lessons/lesson_11_1/web/results.js.

Запуск:  python lessons/lesson_11_1/examples/sensitivity.py [--save] [--no-show]   (≈ 3 минуты)
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

PARAMS = {
    "learning_rate": [0.01, 0.03, 0.1, 0.3],
    "num_leaves": [4, 8, 16, 31, 64, 128],
    "min_child_samples": [2, 5, 10, 20, 50, 100],
    "colsample_bytree": [0.3, 0.5, 0.7, 1.0],
    "subsample": [0.3, 0.5, 0.7, 1.0],
    "reg_lambda": [0.0, 1.0, 10.0, 100.0],
    "max_bin": [15, 63, 255],
}
BASE = {"learning_rate": 0.1, "num_leaves": 31, "min_child_samples": 20, "colsample_bytree": 1.0, "subsample": 1.0,
        "reg_lambda": 0.0, "max_bin": 255}


def task_friedman():
    X, y = datasets.friedman1(n=4000, noise=1.0, seed=170)
    return X, y, "regression"


def task_moons():
    X, y = datasets.classification_2d(kind="moons", n=10000, noise=0.3, seed=171)
    return np.column_stack([X, np.random.default_rng(171).normal(size=(len(y), 8))]), y.astype(int), "classification"


TASKS = {"Фридман (регрессия, RMSE)": task_friedman, "«Луны» + шум (классификация, log-loss)": task_moons}


def score(X, y, kind, params, seed):
    perm = np.random.default_rng(seed).permutation(len(y))
    n = len(y)
    tr, va = perm[: int(0.6 * n)], perm[int(0.6 * n): int(0.8 * n)]
    kw = dict(params)
    if kw["subsample"] < 1:
        kw["subsample_freq"] = 1
    model = (lgb.LGBMClassifier if kind == "classification" else lgb.LGBMRegressor)(n_estimators=5000, verbose=-1, random_state=seed, **kw)
    model.fit(X[tr], y[tr], eval_X=(X[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
    curve = model.evals_result_["valid_0"]
    key = "binary_logloss" if kind == "classification" else "l2"
    best = min(curve[key])
    return float(best if kind == "classification" else np.sqrt(best))


out = {"params": list(PARAMS), "base": BASE, "tasks": []}
for task_name, make in TASKS.items():
    X, y, kind = make()
    base_score = np.mean([score(X, y, kind, BASE, s) for s in range(3)])
    task = {"name": task_name, "metric": "log-loss" if kind == "classification" else "RMSE", "base": round(float(base_score), 4), "params": {}}
    for p, values in PARAMS.items():
        curve = []
        for v in values:
            vals = [score(X, y, kind, {**BASE, p: v}, s) for s in range(3)]
            curve.append({"value": v, "score": round(float(np.mean(vals)), 4), "std": round(float(np.std(vals)), 4)})
        scores = [c["score"] for c in curve]
        task["params"][p] = {"curve": curve, "range": round(max(scores) - min(scores), 4),
                             "gain": round(float(base_score - min(scores)), 4)}
        print(f"{task_name[:12]:12s} {p:18s} размах {max(scores) - min(scores):.4f}, лучшее {curve[int(np.argmin(scores))]['value']}", flush=True)
    out["tasks"].append(task)

target = HERE.parents[1] / "web" / "results.js"
target.write_text(
    "/* Сгенерировано lessons/lesson_11_1/examples/sensitivity.py — не редактировать вручную. */\n"
    "(function (root) {\n  'use strict';\n  (root.GBC || (root.GBC = {})).sensitivity = "
    + json.dumps(out, ensure_ascii=False, indent=2).replace("\n", "\n  ")
    + ";\n})(typeof window !== 'undefined' ? window : globalThis);\n",
    encoding="utf-8",
)
print("записано:", target.relative_to(HERE.parents[3]))

fig, axes = plt.subplots(1, 2, figsize=(13, 3.8))
for ax, task in zip(axes, out["tasks"]):
    names = list(task["params"])
    ranges = [task["params"][p]["range"] / task["base"] * 100 for p in names]
    order = np.argsort(ranges)
    ax.barh([names[i] for i in order], [ranges[i] for i in order], color="#2a78d6")
    ax.set(xlabel="размах метрики, % от значения по умолчанию", title=task["name"])
fig.tight_layout()
ex.finish(fig, "sensitivity")
