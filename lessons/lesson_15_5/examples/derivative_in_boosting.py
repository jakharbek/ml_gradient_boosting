"""Производная в бустинге: темп спуска, производные потерь, лучшая константа, псевдо-остатки и деревья.

Запуск:  python lessons/lesson_15_5/examples/derivative_in_boosting.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor

from gbcourse import datasets
from gbcourse.boosting import GBRegressor
from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE, RED
from gbcourse.tree import RegressionTree

ex = Example(__file__)

# 1. Градиентный спуск на (a/2)θ²: множитель q = 1 − ηa
a = 2.0
for eta in (0.3, 0.5, 0.75, 1.0, 1.1):
    t = 2.0
    for _ in range(20):
        t -= eta * a * t
    print(f"η = {eta}: q = {1 - eta * a:+.2f}, |θ₂₀| = {abs(t):.3g}")
    assert (abs(t) < 1e-3) == (0 < eta < 2 / a)

# 2. Производные потерь: формула против центральной разности
sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731
losses = {
    "MSE": (lambda y, F: 0.5 * (y - F) ** 2, lambda y, F: -(y - F), (5.0, 2.0)),
    "MAE": (lambda y, F: abs(y - F), lambda y, F: -np.sign(y - F), (5.0, 2.0)),
    "Хьюбер δ=1": (lambda y, F: 0.5 * (y - F) ** 2 if abs(y - F) <= 1 else abs(y - F) - 0.5, lambda y, F: -np.clip(y - F, -1, 1), (5.0, 2.0)),
    "квантиль α=0.8": (lambda y, F: 0.8 * (y - F) if y >= F else -0.2 * (y - F), lambda y, F: -0.8 if y > F else 0.2, (5.0, 2.0)),
    "log-loss": (lambda y, F: np.logaddexp(0, F) - y * F, lambda y, F: sig(F) - y, (1.0, 0.0)),
}
for name, (L, g, (yv, Fv)) in losses.items():
    num = (L(yv, Fv + 1e-6) - L(yv, Fv - 1e-6)) / 2e-6
    print(f"{name:15} ∂L/∂F = {float(g(yv, Fv)):+.4f} (численно {num:+.4f}), псевдо-остаток {-float(g(yv, Fv)):+.4f}")
    assert abs(num - g(yv, Fv)) < 1e-6

# 3. Лучшие константы шести квартир: нули наклона потерь
y = np.array([2, 4, 3, 7, 9, 11], dtype=float)
cs = np.linspace(0, 12, 120001)
R = y[:, None] - cs
curves = {
    "MSE": np.mean(0.5 * R**2, axis=0),
    "MAE": np.mean(np.abs(R), axis=0),
    "Хьюбер δ = 2": np.mean(np.where(np.abs(R) <= 2, 0.5 * R**2, 2 * (np.abs(R) - 1)), axis=0),
}
for name, v in curves.items():
    best = cs[np.isclose(v, v.min(), rtol=0, atol=1e-9)]
    print(f"{name:13} лучшая константа: {best.min():.3f} … {best.max():.3f}")
assert np.isclose(cs[curves["MSE"].argmin()], 6) and np.isclose(cs[curves["Хьюбер δ = 2"].argmin()], 5.5)

# 4. Псевдо-остатки и пень; сверка первого шага со scikit-learn
X = np.arange(1, 7, dtype=float).reshape(-1, 1)
F = np.full(6, y.mean())
hist = [np.mean(0.5 * (y - F) ** 2)]
for _ in range(10):
    r = y - F
    F = F + 0.5 * RegressionTree(max_depth=1).fit(X, -r).predict(X)
    hist.append(np.mean(0.5 * (y - F) ** 2))
print("потери по деревьям:", np.round(hist[:4], 4), "…", round(hist[-1], 4))
assert np.isclose(hist[1], 1.9583, atol=1e-4)
sk = GradientBoostingRegressor(n_estimators=1, learning_rate=0.5, max_depth=1).fit(X, y)
assert np.allclose(sk.predict(X), [4.5, 4.5, 4.5, 7.5, 7.5, 7.5])

# 5. Наклон прогноза бустинга по признаку: ступеньки
Xs, ys = datasets.regression_1d(kind="sine", n=60, noise=0.3, seed=7)
model = GBRegressor(n_estimators=60, learning_rate=0.2, max_depth=2).fit(Xs, ys)
grid = np.linspace(0.5, 9.5, 901)
Fm = lambda v: model.predict(v.reshape(-1, 1))  # noqa: E731
est_small = (Fm(grid + 1e-3) - Fm(grid - 1e-3)) / 2e-3
est_big = (Fm(grid + 1.0) - Fm(grid - 1.0)) / 2.0
zero = np.mean(np.abs(est_small) < 1e-12)
rmse_big = np.sqrt(np.mean((est_big - np.cos(grid)) ** 2))
print(f"h = 0.001: нулевых оценок {zero:.1%}, максимум {np.abs(est_small).max():.0f}; h = 1: RMSE против cos x {rmse_big:.3f}")
assert zero > 0.95 and rmse_big < 0.3

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11.5, 4))
for (name, v), c in zip(curves.items(), [BLUE, ORANGE, RED]):
    a1.plot(cs, v, color=c, lw=2, label=name)
a1.set(xlabel="константа c", ylabel="средние потери", title="Лучшая константа: наклон потерь = 0", ylim=(0, 12))
a1.legend()
a2.plot(grid, np.clip(est_small, -3, 3), color=ORANGE, lw=1, label="dF/dx, h = 0.001")
a2.plot(grid, est_big, color=BLUE, lw=2, label="dF/dx, h = 1")
a2.plot(grid, np.cos(grid), "--", color=MUTED, label="cos x")
a2.set(xlabel="x", ylim=(-3, 3), title="Наклон прогноза бустинга по признаку")
a2.legend(fontsize=8)
ex.finish(fig, "derivative_in_boosting")
