"""Решения упражнений урока 11.2.

Запуск:  python lessons/lesson_11_2/exercises/solutions.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "shared" / "python"))

import lightgbm as lgb
import numpy as np
import optuna

from gbcourse import datasets

optuna.logging.set_verbosity(optuna.logging.WARNING)

# 1
X, y = datasets.friedman1(n=4000, noise=1.0, seed=170)
outer = np.array_split(np.random.default_rng(0).permutation(len(y)), 3)
inner_scores, outer_scores = [], []
for k in range(3):
    te = outer[k]
    rest = np.concatenate(outer[:k] + outer[k + 1:])
    cut = int(0.75 * len(rest))
    tr, va = rest[:cut], rest[cut:]

    def objective(trial, tr=tr, va=va):
        p = dict(num_leaves=trial.suggest_int("num_leaves", 2, 128, log=True),
                 learning_rate=trial.suggest_float("learning_rate", 0.02, 0.3, log=True),
                 min_child_samples=trial.suggest_int("min_child_samples", 2, 100, log=True))
        m = lgb.LGBMRegressor(n_estimators=3000, verbose=-1, **p)
        m.fit(X[tr], y[tr], eval_X=(X[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(50, verbose=False)])
        trial.set_user_attr("trees", m.best_iteration_)
        return float(np.sqrt(min(m.evals_result_["valid_0"]["l2"])))

    study = optuna.create_study(sampler=optuna.samplers.TPESampler(seed=k))
    study.optimize(objective, n_trials=12)
    m = lgb.LGBMRegressor(n_estimators=study.best_trial.user_attrs["trees"], verbose=-1, **study.best_params).fit(X[rest], y[rest])
    outer_rmse = float(np.sqrt(np.mean((y[te] - m.predict(X[te])) ** 2)))
    inner_scores.append(study.best_value)
    outer_scores.append(outer_rmse)
    print(f"1) внешний фолд {k}: внутренняя оценка лучшего {study.best_value:.4f}, внешняя {outer_rmse:.4f}")
print(f"   в среднем: внутренняя {np.mean(inner_scores):.4f}, внешняя {np.mean(outer_scores):.4f}")
print("   Внутренняя оценка — минимум из 12 шумных оценок, поэтому смещена вниз (оптимистична); внешняя — честная.")
print("   В отдельных фолдах внешняя может быть и ниже: фолды различаются по трудности. Смотрите на среднее по фолдам.")

# 2
js = (ROOT / "lessons" / "lesson_11_2" / "web" / "results.js").read_text(encoding="utf-8")
G = json.loads(js[js.index(".searchGrid = ") + len(".searchGrid = "): js.rindex(";\n})")])
V = np.array(G["values"]).reshape(G["shape"])
rng = np.random.default_rng(0)
for k in range(2, 7):
    idx = [np.unique(np.linspace(0, s - 1, k).round().astype(int)) for s in V.shape]
    n = k**3
    grid = V[np.ix_(*idx)].min()
    rnd = np.mean([V.ravel()[rng.choice(V.size, n, replace=False)].min() for _ in range(1000)])
    print(f"2) k = {k}: бюджет {n:3d}, сетка {grid:.4f}, случайный поиск {rnd:.4f}{'  ← сетка не хуже' if grid <= rnd else ''}")
