"""Сумма функций: модель бустинга как сумма ступенек.

Запуск:  python lessons/lesson_15_1/examples/sum_of_steps.py [--save] [--no-show]

Строит F_M = F_0 + ν·h_1 + … + ν·h_M, где каждая h_m — функция-ступенька (один порог),
обученная на остатках предыдущей суммы, и сверяет результат с GradientBoostingRegressor
из scikit-learn с деревьями глубины 1 (если sklearn установлен).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)

X, y = datasets.regression_1d(kind="sine", n=50, noise=0.25, seed=7)
x = X[:, 0]
grid = np.linspace(0, 10, 1001)
nu, M = 0.5, 30


def fit_step(x, r):
    """Лучшая ступенька для остатков r: порог и два значения (средние слева и справа)."""
    best = None
    for t in (x[1:] + x[:-1]) / 2:
        L, R = r[x <= t], r[x > t]
        if len(L) and len(R):
            sse = ((L - L.mean()) ** 2).sum() + ((R - R.mean()) ** 2).sum()
            if best is None or sse < best[0]:
                best = (sse, t, L.mean(), R.mean())
    return best[1:]


F = np.full_like(y, y.mean())
Fg = np.full_like(grid, y.mean())
steps, mse = [], [((y - F) ** 2).mean()]
for _ in range(M):
    t, lv, rv = fit_step(x, y - F)
    steps.append((t, lv, rv))
    F = F + nu * np.where(x <= t, lv, rv)
    Fg = Fg + nu * np.where(grid <= t, lv, rv)
    mse.append(((y - F) ** 2).mean())

print(f"F0 = среднее = {y.mean():.4f}")
for m in (1, 3, 10, 30):
    print(f"сумма {m:2d} ступенек: MSE = {mse[m]:.4f}")
assert all(a >= b - 1e-12 for a, b in zip(mse, mse[1:])), "ошибка на обучении не растёт"
assert mse[-1] < 0.25 * mse[0]

try:
    from sklearn.ensemble import GradientBoostingRegressor

    sk = GradientBoostingRegressor(n_estimators=M, learning_rate=nu, max_depth=1).fit(X, y)
    diff = np.abs(sk.predict(grid[:, None]) - Fg).max()
    print(f"расхождение с sklearn (max |Δ| на сетке): {diff:.2e}")
    assert diff < 1e-6
except ImportError:
    print("sklearn не установлен — сверка пропущена")

fig, (a1, a2) = plt.subplots(1, 2, figsize=(13, 3.8))
a1.plot(x, y, "o", color=MUTED, ms=4, label="данные")
a1.plot(grid, Fg, color=BLUE, lw=2, label=f"F_{M}: сумма {M} ступенек")
t, lv, rv = steps[-1]
a1.plot(grid, nu * np.where(grid <= t, lv, rv), color=ORANGE, lw=1.6, label="последняя ступенька ν·h_M")
a1.legend()
a1.set(title="модель бустинга — сумма функций", xlabel="x")
a2.plot(range(M + 1), mse, "o-", color=BLUE, ms=3)
a2.set(title="MSE на обучении", xlabel="число ступенек m")
plt.tight_layout()
ex.finish(fig, "sum_of_steps")
