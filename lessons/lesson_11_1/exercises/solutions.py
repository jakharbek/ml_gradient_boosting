"""Решения упражнений урока 11.1.

Запуск:  python lessons/lesson_11_1/exercises/solutions.py
"""

import itertools
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import numpy as np

from gbcourse import datasets


def make_runner(X, y, kind):
    perm = np.random.default_rng(0).permutation(len(y))
    n = len(y)
    tr, va, te = perm[: int(0.6 * n)], perm[int(0.6 * n): int(0.8 * n)], perm[int(0.8 * n):]

    def evaluate(params):
        kw = dict(params)
        if kw.get("subsample", 1.0) < 1:
            kw["subsample_freq"] = 1
        cls = lgb.LGBMClassifier if kind == "clf" else lgb.LGBMRegressor
        m = cls(n_estimators=10000, verbose=-1, random_state=0, **kw)
        m.fit(X[tr], y[tr], eval_X=(X[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
        key = "binary_logloss" if kind == "clf" else "l2"
        val = min(m.evals_result_["valid_0"][key])
        if kind == "clf":
            p = np.clip(m.predict_proba(X[te])[:, 1], 1e-15, 1 - 1e-15)
            test = -np.mean(y[te] * np.log(p) + (1 - y[te]) * np.log(1 - p))
        else:
            val = np.sqrt(val)
            test = np.sqrt(np.mean((y[te] - m.predict(X[te])) ** 2))
        return val, test

    return evaluate


def strategy(evaluate, steps):
    params = {"learning_rate": 0.1}
    val, test = evaluate(params)
    print(f"   {'0. по умолчанию':24s} валидация {val:.4f}, тест {test:.4f}")
    for name, grid in steps:
        best = None
        for combo in itertools.product(*grid.values()):
            cand = {**params, **dict(zip(grid, combo))}
            v, t = evaluate(cand)
            if best is None or v < best[0]:
                best = (v, t, cand)
        val, test, params = best
        chosen = ", ".join(f"{k}={params[k]}" for k in grid)
        print(f"   {name:24s} валидация {val:.4f}, тест {test:.4f}  ({chosen})")


COMPLEXITY = ("1. сложность деревьев", {"num_leaves": [4, 8, 16, 31, 64, 128], "min_child_samples": [5, 20, 100]})
RANDOMNESS = ("2. случайность", {"colsample_bytree": [0.5, 0.7, 1.0], "subsample": [0.5, 0.7, 1.0]})
PENALTIES = ("3. штрафы", {"reg_lambda": [0.0, 1.0, 10.0, 100.0], "min_split_gain": [0.0, 0.1, 1.0]})
LOW_LR = ("4. меньший темп", {"learning_rate": [0.02]})

# 1
Xc, yc = datasets.classification_2d(kind="moons", n=10000, noise=0.3, seed=171)
Xc = np.column_stack([Xc, np.random.default_rng(171).normal(size=(len(yc), 8))])
print("1) «Луны» + шум, log-loss:")
strategy(make_runner(Xc, yc, "clf"), [COMPLEXITY, RANDOMNESS, PENALTIES, LOW_LR])

# 2
X, y = datasets.friedman1(n=4000, noise=1.0, seed=170)
print("2) Фридман, сначала случайность, потом сложность:")
strategy(make_runner(X, y, "reg"), [RANDOMNESS, COMPLEXITY, PENALTIES, LOW_LR])
print("   Итог: больше всего снова дал шаг сложности деревьев. Шаг «меньший темп» навязан (одно значение) и на «лунах»")
print("   даже ухудшил валидацию — каждый шаг стратегии надо проверять, а не принимать на веру.")
print("   Порядок шагов поменял выбранные параметры (colsample 0.7, λ = 1), но итоговая ошибка почти та же (1.103 против 1.109):")
print("   у хорошо поставленной задачи много почти равноценных настроек.")
