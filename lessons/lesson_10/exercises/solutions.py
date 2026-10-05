"""Решения упражнений урока 10.

Запуск:  python lessons/lesson_10/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import numpy as np

from gbcourse import GBRegressor, datasets

# 1
X, y = datasets.friedman1(n=800, noise=1.0, seed=130)
base = lgb.LGBMRegressor(verbose=-1).fit(X, y).predict(X)
for name, Z in (("стандартизация", (X - X.mean(0)) / X.std(0)), ("X + 5", X + 5), ("3·X", 3 * X), ("X − 0.5", X - 0.5)):
    p = lgb.LGBMRegressor(verbose=-1).fit(Z, y).predict(Z)
    print(f"1) LightGBM, {name:15s}: наибольшее расхождение прогнозов {np.abs(p - base).max():.2e}")
print("   Исходные признаки лежат в [0, 1]. Прогнозы меняются там, где значения переходят через ноль:")
print("   LightGBM особо обрабатывает ноль при построении корзин, поэтому корзины становятся другими.")

# 2
rng = np.random.default_rng(0)
Z = rng.uniform(0.1, 1, (2000, 2))
yz = np.sin(3 * Z[:, 0] / Z[:, 1]) + rng.normal(0, 0.1, 2000)
a, b, c, d = datasets.train_test_split(Z, yz, test_size=0.5, seed=0)
for name, f in (("x0, x1", lambda v: v), ("x0, x1, x0/x1", lambda v: np.c_[v, v[:, 0] / v[:, 1]])):
    m = GBRegressor(n_estimators=300, learning_rate=0.1, max_depth=3).fit(f(a), c)
    print(f"2) {name:14s} MSE на отложенной половине {np.mean((d - m.predict(f(b))) ** 2):.4f}")
print("   Дисперсия шума 0.01 — потолок; с признаком-отношением модель почти достигает его.")
print("   log(x0/x1) = log x0 − log x1 — сумма функций от отдельных признаков, её деревья строят легко.")
