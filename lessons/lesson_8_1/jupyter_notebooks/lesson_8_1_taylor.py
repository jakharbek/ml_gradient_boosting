# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_8_1

# %% [markdown]
# # Урок 8.1. Разложение Тейлора: градиент и гессиан
#
# **Интерактивная версия:** `lessons/lesson_8_1/web/index.html`
#
# 1. Проверяем g и h всех потерь `gbcourse` конечными разностями.
# 2. Насколько точна парабола: ошибка приближения в зависимости от шага.
# 3. Шаг первого порядка против Ньютона на счётных данных разного масштаба.
# 4. Своя функция потерь в XGBoost через (g, h).

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from gbcourse import datasets, Mulberry32, RegressionTree
from gbcourse.losses import get_loss
from gbcourse.plotting import use_course_style

use_course_style()

# %% [markdown]
# ## 1. g и h против конечных разностей

# %%
eps = 1e-4
rows = []
for name, y0, F0 in [("squared", 3.0, 0.7), ("logistic", 1.0, -0.4), ("poisson", 3.0, 0.7), ("huber", 0.0, 0.6), ("absolute", 0.0, 0.6)]:
    loss = get_loss(name)
    y, F = np.array([y0]), np.array([F0])
    L = lambda f, loss=loss, y=y: loss.pointwise(y, np.array([f]))[0]
    rows.append({
        "потери": name,
        "g": loss.gradient(y, F)[0], "g численно": (L(F0 + eps) - L(F0 - eps)) / (2 * eps),
        "h": loss.hessian(y, F)[0], "h численно": (L(F0 + eps) - 2 * L(F0) + L(F0 - eps)) / eps**2,
    })
pd.DataFrame(rows).round(5)

# %% [markdown]
# ## 2. Ошибка параболы
#
# Для гладких потерь при малых шагах ошибка приближения второго порядка растёт как $|w|^3$ (следующий член ряда).
# При больших шагах это уже не так: вдали парабола и кривая могут снова сблизиться.

# %%
loss = get_loss("logistic")
y, F0 = np.array([1.0]), np.array([-0.4])
L0 = loss.pointwise(y, F0)[0]
g, h = loss.gradient(y, F0)[0], loss.hessian(y, F0)[0]
steps = np.array([0.1, 0.2, 0.4, 0.8, 1.6])
err = np.array([abs(loss.pointwise(y, F0 + w)[0] - (L0 + g * w + 0.5 * h * w * w)) for w in steps])
for w, e in zip(steps, err):
    print(f"w = {w:3.1f}: ошибка параболы {e:.2e}")
print("отношение ошибок при удвоении шага:", np.round(err[1:] / err[:-1], 2), "(≈ 8 = 2³ для малых шагов)")

# %% [markdown]
# ## 3. Первый порядок против Ньютона на счётных данных

# %%
def poisson(r, mu):
    """Пуассоновская выборка тем же способом, что в виджете (алгоритм Кнута на Mulberry32)."""
    if mu > 60:
        return max(0, round(r.normal(mu, np.sqrt(mu))))
    limit, k, p = np.exp(-mu), 0, 1.0
    while True:
        k += 1
        p *= r.random()
        if p <= limit:
            return k - 1


def counts(scale, n=200, seed=81):
    r = Mulberry32(seed)
    x, y = [], []
    for _ in range(n):
        xi = r.uniform(0, 10)
        x.append(xi)
        y.append(poisson(r, scale * np.exp(0.8 * np.sin(xi))))
    return np.array(x)[:, None], np.array(y, dtype=float)


def deviance(y, F):
    mu = np.exp(F)
    with np.errstate(divide="ignore", invalid="ignore"):
        t = np.where(y > 0, y * np.log(y / mu), 0.0)
    return float(np.mean(2 * (t - (y - mu))))


def boost(X, y, newton, lr, M=40):
    F = np.full(len(y), np.log(y.mean()))
    for m in range(M):
        g = np.exp(F) - y
        h = np.exp(F) if newton else np.ones_like(y)
        F = F + lr * RegressionTree(max_depth=2).fit(X, g, h).predict(X)
        d = deviance(y, F)
        if not np.isfinite(d) or d > 1e6:
            return f"разошёлся на итерации {m + 1}"
    return round(d, 4)


table = []
for scale in (0.5, 2, 5, 10, 50):
    X, y = counts(scale)
    table.append({"масштаб s": scale, "первый порядок, ν=0.3": boost(X, y, False, 0.3), "Ньютон, ν=0.3": boost(X, y, True, 0.3),
                  "первый порядок, ν=0.03": boost(X, y, False, 0.03), "Ньютон, ν=0.03": boost(X, y, True, 0.03)})
pd.DataFrame(table)

# %% [markdown]
# ## 4. Своя функция потерь в XGBoost
#
# XGBoost принимает `obj(preds, dtrain) → (grad, hess)`. Передадим логистические g и h вручную и сравним со встроенной.
#
# Ловушка: у встроенной `binary:logistic` параметр `base_score` задаётся как **вероятность** (0.5 → логит 0),
# а для своей функции потерь — как **сырой прогноз**. Поэтому для совпадения ставим `base_score=0` своей и `0.5` встроенной.

# %%
import xgboost as xgb

Xc, yc = datasets.classification_2d(kind="moons", n=400, noise=0.3, seed=90)
dtrain = xgb.DMatrix(Xc, label=yc)


def logistic_obj(preds, dmat):
    p = 1 / (1 + np.exp(-preds))
    return p - dmat.get_label(), p * (1 - p)


params = {"max_depth": 3, "eta": 0.3, "tree_method": "exact"}
b_custom = xgb.train({**params, "base_score": 0.0}, dtrain, num_boost_round=20, obj=logistic_obj)
b_builtin = xgb.train({**params, "base_score": 0.5, "objective": "binary:logistic"}, dtrain, num_boost_round=20)
raw_custom = b_custom.predict(dtrain, output_margin=True)
raw_builtin = b_builtin.predict(dtrain, output_margin=True)
print(f"наибольшее расхождение логитов: {np.abs(raw_custom - raw_builtin).max():.1e}")

# %% [markdown]
# ## Упражнения
#
# 1. Выведите g и h для потерь $L = \log\cosh(F - y)$ и проверьте численно.
# 2. Для Пуассона с $y = 12$, $e^F = 4$ сделайте 5 шагов Ньютона ($\nu = 1$) и сравните с точным ответом $F^* = \log 12$.
#
# Решения: `python lessons/lesson_8_1/exercises/solutions.py`.
