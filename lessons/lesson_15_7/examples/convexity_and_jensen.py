"""Выпуклость: три признака, «одна яма» и неравенство Йенсена для ансамблей.

Запуск:  python lessons/lesson_15_7/examples/convexity_and_jensen.py [--save] [--no-show]

1) Для пяти функций признаки «хорда над графиком», «касательная под графиком» и «f″ ≥ 0» проверяются
независимо — и всегда совпадают. 2) Градиентный спуск из девяти стартов: на выпуклой функции все приходят
в одну точку, на невыпуклой — в разные ямы. 3) Йенсен: средняя MSE одного дерева бэггинга больше MSE их
среднего, а разность равна средней дисперсии прогнозов.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.tree import DecisionTreeRegressor

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)
rng = np.random.default_rng(0)
sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731

# 1. Три признака
FUNCS = {
    "eˣ + x²": (lambda z: np.exp(z) + z**2, lambda z: np.exp(z) + 2 * z, lambda z: np.exp(z) + 2, (-2, 1.5)),
    "log-loss": (lambda z: np.log1p(np.exp(-z)), lambda z: sig(z) - 1, lambda z: sig(z) * (1 - sig(z)), (-5, 5)),
    "x⁴": (lambda z: z**4, lambda z: 4 * z**3, lambda z: 12 * z**2, (-1.4, 1.4)),
    "x⁴ − x²": (lambda z: z**4 - z**2, lambda z: 4 * z**3 - 2 * z, lambda z: 12 * z**2 - 2, (-1.1, 1.1)),
    "sin x": (np.sin, np.cos, lambda z: -np.sin(z), (-3, 3)),
}
print("функция    хорда  касат.  f″≥0")
for name, (f, f1, f2, (a, b)) in FUNCS.items():
    x1, x2, t = rng.uniform(a, b, 5000), rng.uniform(a, b, 5000), rng.uniform(0, 1, 5000)
    chord = bool(np.all(f(t * x1 + (1 - t) * x2) <= t * f(x1) + (1 - t) * f(x2) + 1e-10))
    tangent = bool(np.all(f(x2) >= f(x1) + f1(x1) * (x2 - x1) - 1e-10))
    curv = bool(np.all(f2(np.linspace(a, b, 2001)) >= -1e-12))
    print(f"{name:10} {chord!s:6} {tangent!s:7} {curv!s:5}")
    assert chord == tangent == curv

# 2. Спуск из девяти стартов
def descend(f1, starts, eta, steps=300):
    x = np.array(starts, float)
    for _ in range(steps):
        x = x - eta * f1(x)
    return x


fin_convex = descend(lambda z: 2 * z - np.exp(-z), np.linspace(-2, 2.8, 9), 0.15)
fin_w = descend(lambda z: 4 * z**3 - 4 * z + 0.3, np.linspace(-1.55, 1.55, 9), 0.05)
print("выпуклая x² + e^(−x): финиши", np.round(fin_convex, 4))
print("две ямы x⁴ − 2x² + 0.3x: финиши", np.round(fin_w, 4))
assert np.ptp(fin_convex) < 1e-6
assert len(np.unique(np.round(fin_w, 3))) == 2

# 3. Йенсен и бэггинг
X = rng.uniform(0, 6, (300, 1))
y = np.sin(X[:, 0]) + rng.normal(0, 0.3, 300)
Xt = np.linspace(0, 6, 400).reshape(-1, 1)
yt = np.sin(Xt[:, 0])
P = np.array([DecisionTreeRegressor(max_depth=6, random_state=k).fit(X[idx], y[idx]).predict(Xt)
              for k, idx in enumerate(rng.integers(0, 300, (25, 300)))])
avg_loss = ((P - yt) ** 2).mean()
loss_avg = ((P.mean(axis=0) - yt) ** 2).mean()
print(f"средняя MSE дерева {avg_loss:.4f} ≥ MSE среднего {loss_avg:.4f}; разность {avg_loss - loss_avg:.4f} = средняя дисперсия {P.var(axis=0).mean():.4f}")
assert loss_avg < avg_loss
assert abs((avg_loss - loss_avg) - P.var(axis=0).mean()) < 1e-12

fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(16.5, 4.4))
z = np.linspace(-1.1, 1.1, 400)
fz = z**4 - z**2
a1.plot(z, fz, color=BLUE, lw=2.4)
a1.plot([-0.9, 0.9], [0.9**4 - 0.81] * 2, color=ORANGE, lw=2, label="хорда ниже графика")
a1.fill_between(z, fz, -0.3, where=12 * z**2 - 2 < 0, color=VIOLET, alpha=0.12, label="f″ < 0")
a1.set(title="x⁴ − x²: все три признака говорят «нет»", xlabel="x")
a1.legend(loc="upper center")
zz = np.linspace(-1.7, 1.7, 400)
a2.plot(zz, zz**4 - 2 * zz**2 + 0.3 * zz, color=BLUE, lw=2.4)
a2.plot(np.linspace(-1.55, 1.55, 9), [s**4 - 2 * s**2 + 0.3 * s for s in np.linspace(-1.55, 1.55, 9)], "o", mfc="white", color=MUTED, label="старты")
a2.plot(fin_w, fin_w**4 - 2 * fin_w**2 + 0.3 * fin_w, "o", color=ORANGE, ms=8, label="финиши")
a2.set(title="Невыпуклая функция: две разные ямы", xlabel="x")
a2.legend()
for row in P[:8]:
    a3.plot(Xt[:, 0], row, color=MUTED, lw=0.8, alpha=0.6)
a3.plot(Xt[:, 0], P.mean(axis=0), color=AQUA, lw=2.4, label=f"среднее 25 деревьев (MSE {loss_avg:.3f})")
a3.plot(Xt[:, 0], yt, "--", color=BLUE, lw=1.6, label="истинная sin x")
a3.set(title=f"Йенсен: одно дерево в среднем {avg_loss:.3f}", xlabel="x")
a3.legend(loc="lower left")
ex.finish(fig, "convexity_and_jensen")
