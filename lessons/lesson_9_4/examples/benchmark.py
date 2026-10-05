"""Сравнение XGBoost, LightGBM и CatBoost по одному протоколу.

Три задачи × два режима (параметры по умолчанию / темп 0.05 + ранняя остановка) × три разбиения
60/20/20. Метрика — на тестовой части; время — полное время fit.
Скрипт пишет результаты в lessons/lesson_9_4/web/results.js — их показывает виджет урока.

Запуск:  python lessons/lesson_9_4/examples/benchmark.py [--save] [--no-show]
"""

import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[3] / "shared" / "python"))

import catboost as cb
import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import xgboost as xgb

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.style import ROLE

ex = Example(__file__)
LIBS = ["XGBoost", "LightGBM", "CatBoost"]
SEEDS = [0, 1, 2]


def task_friedman():
    X, y = datasets.friedman1(n=5000, noise=1.0, seed=120)
    return pd.DataFrame(X, columns=[f"x{i}" for i in range(10)]), y, "regression", []


def task_moons():
    X, y = datasets.classification_2d(kind="moons", n=20000, noise=0.3, seed=121)
    noise = np.random.default_rng(121).normal(size=(len(y), 8))
    return pd.DataFrame(np.column_stack([X, noise]), columns=[f"x{i}" for i in range(10)]), y.astype(int), "classification", []


def task_categories():
    x, cat, y = datasets.categorical_regression(n=5000, n_categories=100, noise=1.0, seed=122)
    df = pd.DataFrame({"x": x, "категория": pd.Categorical(cat.astype(str))})
    return df, y, "regression", ["категория"]


TASKS = {
    "Фридман, регрессия (5000 × 10)": task_friedman,
    "«Луны» + 8 шумовых признаков, классификация (20000 × 10)": task_moons,
    "Категория из 100 значений, регрессия (5000 × 2)": task_categories,
}


def metric(kind, y, p):
    if kind == "regression":
        return float(np.sqrt(np.mean((y - p) ** 2)))
    p = np.clip(p, 1e-15, 1 - 1e-15)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def fit_predict(lib, mode, kind, cats, Xtr, ytr, Xva, yva, Xte, seed):
    clf = kind == "classification"
    tuned = mode == "early"
    if lib == "XGBoost":
        kw = dict(enable_categorical=bool(cats), tree_method="hist", random_state=seed)
        if tuned:
            kw.update(n_estimators=5000, learning_rate=0.05, early_stopping_rounds=100)
        m = (xgb.XGBClassifier if clf else xgb.XGBRegressor)(**kw)
        m.fit(Xtr, ytr, eval_set=[(Xva, yva)] if tuned else None, verbose=False)
        n_trees = m.best_iteration + 1 if tuned else m.get_booster().num_boosted_rounds()
    elif lib == "LightGBM":
        kw = dict(verbose=-1, random_state=seed)
        if tuned:
            kw.update(n_estimators=5000, learning_rate=0.05)
        m = (lgb.LGBMClassifier if clf else lgb.LGBMRegressor)(**kw)
        if tuned:
            m.fit(Xtr, ytr, eval_X=(Xva,), eval_y=(yva,), callbacks=[lgb.early_stopping(100, verbose=False)])
            n_trees = m.best_iteration_
        else:
            m.fit(Xtr, ytr)
            n_trees = m.n_estimators
    else:
        kw = dict(verbose=0, random_seed=seed, cat_features=cats or None)
        if tuned:
            kw.update(iterations=5000, learning_rate=0.05, early_stopping_rounds=100)
        m = (cb.CatBoostClassifier if clf else cb.CatBoostRegressor)(**kw)
        m.fit(Xtr, ytr, eval_set=(Xva, yva) if tuned else None)
        n_trees = m.get_best_iteration() + 1 if tuned else m.tree_count_
    p = m.predict_proba(Xte)[:, 1] if clf else m.predict(Xte)
    return p, n_trees


rows = []
for task_name, make in TASKS.items():
    X, y, kind, cats = make()
    for seed in SEEDS:
        perm = np.random.default_rng(seed).permutation(len(y))
        n = len(y)
        tr, va, te = perm[: int(0.6 * n)], perm[int(0.6 * n): int(0.8 * n)], perm[int(0.8 * n):]
        for lib in LIBS:
            for mode in ("default", "early"):
                t0 = time.perf_counter()
                p, n_trees = fit_predict(lib, mode, kind, cats, X.iloc[tr], y[tr], X.iloc[va], y[va], X.iloc[te], seed)
                rows.append({"задача": task_name, "метрика": "RMSE" if kind == "regression" else "log-loss",
                             "библиотека": lib, "режим": mode, "разбиение": seed,
                             "качество": metric(kind, y[te], p), "время": time.perf_counter() - t0, "деревьев": n_trees})

df = pd.DataFrame(rows)
summary = (df.groupby(["задача", "метрика", "режим", "библиотека"], sort=False)
             .agg(качество=("качество", "mean"), разброс=("качество", "std"), время=("время", "mean"), деревьев=("деревьев", "mean"))
             .reset_index())
with pd.option_context("display.width", 200, "display.max_columns", 20):
    print(summary.round(4).to_string(index=False))

out = {
    "versions": {"XGBoost": xgb.__version__, "LightGBM": lgb.__version__, "CatBoost": cb.__version__},
    "tasks": [],
}
for task_name in TASKS:
    part = summary[summary["задача"] == task_name]
    out["tasks"].append({
        "name": task_name,
        "metric": part["метрика"].iloc[0],
        "rows": [{"lib": r["библиотека"], "mode": r["режим"], "score": round(r["качество"], 4), "std": round(r["разброс"], 4),
                  "time": round(r["время"], 3), "trees": round(r["деревьев"], 1)} for _, r in part.iterrows()],
    })
target = HERE.parents[1] / "web" / "results.js"
target.write_text(
    "/* Сгенерировано lessons/lesson_9_4/examples/benchmark.py — не редактировать вручную. */\n"
    "(function (root) {\n  'use strict';\n  (root.GBC || (root.GBC = {})).benchmark = "
    + json.dumps(out, ensure_ascii=False, indent=2).replace("\n", "\n  ")
    + ";\n})(typeof window !== 'undefined' ? window : globalThis);\n",
    encoding="utf-8",
)
print("записано:", target.relative_to(HERE.parents[3]))

fig, axes = plt.subplots(1, len(TASKS), figsize=(16, 3.8))
colors = [ROLE["model"], ROLE["tree"], ROLE["test"]]
for ax, task in zip(axes, out["tasks"]):
    for k, mode in enumerate(("default", "early")):
        vals = [next(r["score"] for r in task["rows"] if r["lib"] == lib and r["mode"] == mode) for lib in LIBS]
        ax.bar(np.arange(3) + (k - 0.5) * 0.38, vals, width=0.36, color=colors, alpha=1.0 if k else 0.45,
               label="по умолчанию" if k == 0 else "ν = 0.05 + ранняя остановка")
    ax.set(xticks=range(3), xticklabels=LIBS, ylabel=task["metric"], title=task["name"].split(",")[0])
axes[0].legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "benchmark")
