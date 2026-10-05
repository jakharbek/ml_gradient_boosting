"""Своя функция потерь в XGBoost: градиент и гессиан, выведенные правилами урока, против встроенных целей.

Запуск:  python lessons/lesson_15_6/examples/xgboost_custom_objective.py [--save] [--no-show]

log-loss: g = p − y, h = p(1 − p) против binary:logistic; Пуассон: g = e^F − y, h = e^F против count:poisson.
Для своей цели base_score — сырой логит/логарифм; для встроенных — значение на шкале ответа.
Ошибка в знаке градиента не падает с исключением — она молча ухудшает модель.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
import xgboost as xgb

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, ORANGE, RED

ex = Example(__file__)


def stable_sig(m):
    return 0.5 * (1 + np.tanh(m / 2))


def logloss(m, y):
    return float(np.mean(np.logaddexp(0, m) - y * m))  # ln(1 + e^F) − yF


# 1. Классификация: своя log-loss против встроенной
X, y = datasets.classification_2d("moons", n=300, noise=0.25, seed=3)
dtrain = xgb.DMatrix(X, label=y)
common = {"max_depth": 3, "eta": 0.3, "tree_method": "exact", "seed": 0}


def obj_logloss(preds, d):
    p = stable_sig(preds)
    return p - d.get_label(), p * (1 - p)


def obj_wrong(preds, d):
    p = stable_sig(preds)
    return d.get_label() - p, p * (1 - p)  # неверный знак


curves = {}
for name, params, obj in [("своя: g = p − y, h = p(1 − p)", {**common, "base_score": 0.0}, obj_logloss),
                          ("встроенная binary:logistic", {**common, "objective": "binary:logistic", "base_score": 0.5}, None),
                          ("ошибка: g = y − p", {**common, "base_score": 0.0}, obj_wrong)]:
    curve = []
    for k in (1, 2, 5, 10, 20, 30):
        booster = xgb.train(params, dtrain, num_boost_round=k, obj=obj)
        curve.append(logloss(booster.predict(dtrain, output_margin=True).astype(float), y))
    curves[name] = curve
    print(f"{name:32} log-loss по числу деревьев {np.round(curve, 4)}")
own, builtin, wrong = curves.values()
assert np.allclose(own, builtin, atol=1e-5)
assert wrong[-1] > math.log(2) and own[-1] < 0.2

# 2. Счётные данные: свой Пуассон против count:poisson
def poisson_draw(rng, lam):
    """Пуассоновская случайная величина (алгоритм Кнута) на воспроизводимом ГПСЧ курса."""
    limit, k, prod = math.exp(-lam), 0, rng.random()
    while prod > limit:
        k += 1
        prod *= rng.random()
    return k


rng = Mulberry32(11)
n = 400
Xp = np.array([[rng.uniform(0, 3)] for _ in range(n)])
mu = np.exp(0.3 + 0.6 * Xp[:, 0])
yp = np.array([float(poisson_draw(rng, m)) for m in mu])
dpois = xgb.DMatrix(Xp, label=yp)
base = math.log(yp.mean())


def obj_poisson(preds, d):
    m = np.exp(preds)
    return m - d.get_label(), m  # g = e^F − y, h = e^F


p_own = xgb.train({**common, "base_score": base}, dpois, num_boost_round=30, obj=obj_poisson)
p_builtin = xgb.train({**common, "objective": "count:poisson", "base_score": yp.mean(), "max_delta_step": 0.0}, dpois, num_boost_round=30)
diff = float(np.max(np.abs(p_own.predict(dpois, output_margin=True) - p_builtin.predict(dpois, output_margin=True))))
print(f"Пуассон: макс. расхождение логарифмов прогноза своей и встроенной цели {diff:.2e}")
assert diff < 1e-4

fig, ax = plt.subplots(figsize=(7.5, 4.2))
ks = (1, 2, 5, 10, 20, 30)
for (name, curve), col, ls in zip(curves.items(), [BLUE, ORANGE, RED], ["-", "--", "-"]):
    ax.plot(ks, curve, ls, color=col, lw=2.4, marker="o", label=name)
ax.axhline(math.log(2), color="0.6", lw=1, ls=":")
ax.set(xlabel="число деревьев", ylabel="log-loss на обучении", yscale="log", title="формулы g и h урока внутри XGBoost")
ax.legend(fontsize=8)
ex.finish(fig, "xgboost_custom_objective")
