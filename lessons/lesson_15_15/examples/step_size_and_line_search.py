"""Градиентный спуск всерьёз: режимы длины шага, скорость сходимости, Армихо, покоординатный и проксимальный спуск.

Запуск:  python lessons/lesson_15_15/examples/step_size_and_line_search.py [--save] [--no-show]

1) Четыре режима шага для 2x²: множитель 1 − 4η и траектории x_k.
2) Скорость сходимости на чаше ½(x² + κy²): постоянный шаг, точный шаг, backtracking по Армихо — шагов до 1e-6.
3) Lasso-подобная задача: субградиентный метод против ISTA (мягкий порог), сверка мягкого порога с Lasso из sklearn.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.linear_model import Lasso

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, RED, VIOLET

ex = Example(__file__)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))

# 1. Режимы шага
ax = axes[0]
for eta, col in zip((0.1, 0.25, 0.4, 0.5, 0.52), (BLUE, AQUA, ORANGE, VIOLET, RED)):
    x, xs = 2.0, [2.0]
    for _ in range(20):
        x -= eta * 4 * x
        xs.append(x)
    ax.plot(xs, "o-", ms=3, color=col, label=f"η = {eta}: множитель {1 - 4 * eta:+.2f}")
    print(f"η = {eta}: x_20 = {xs[-1]:.3g}")
ax.set(xlabel="шаг k", ylabel="x_k", title="Спуск по 2x²: режимы шага", ylim=(-4, 4))
ax.legend(fontsize=8)


# 2. Скорость сходимости
def run(kappa, mode, p0=(-4.0, 1.2), tol=1e-6):
    A = np.diag([1.0, kappa])
    p = np.array(p0)
    for k in range(1, 100001):
        g = A @ p
        if mode == "exact":
            t = g @ g / (g @ A @ g)
        elif mode == "best":
            t = 2 / (kappa + 1)
        else:  # backtracking по Армихо
            t = 1.0
            while 0.5 * (p - t * g) @ A @ (p - t * g) > 0.5 * p @ A @ p - 0.3 * t * (g @ g):
                t *= 0.5
        p = p - t * g
        if 0.5 * p @ A @ p < tol:
            return k


kappas = [1, 2, 5, 10, 25, 50, 100]
ax = axes[1]
for mode, col, lab in (("best", BLUE, "постоянный η = 2/(L + μ)"), ("exact", ORANGE, "точный шаг"), ("armijo", VIOLET, "Армихо")):
    steps = [run(k, mode) for k in kappas]
    ax.loglog(kappas, steps, "o-", color=col, label=lab)
    print(f"{lab:26}: {steps}")
ax.loglog(kappas, [run(k, "exact", p0=(-4.0, 4 / k)) for k in kappas], "--", color=ORANGE, label="точный шаг, худший старт")
ax.set(xlabel="κ", ylabel="шагов до f < 1e-6", title="Скорость сходимости и обусловленность")
ax.legend(fontsize=8)
assert run(25, "best") == 107 and run(25, "exact") == 14 and run(25, "exact", p0=(-4.0, 4 / 25)) == 100

# 3. Субградиент против ISTA
soft = lambda z, t: np.sign(z) * np.maximum(np.abs(z) - t, 0)  # noqa: E731
grad = lambda w: np.array([2 * (w[0] - 2), 8 * (w[1] - 1.5)])  # noqa: E731
lam = 6.0
opt = np.array([max(0, 2 - lam / 2), max(0, 1.5 - lam / 8)])
p = q = np.array([-1.0, -0.5])
ep, eq = [], []
for k in range(1, 201):
    p = soft(p - grad(p) / 8, lam / 8)
    q = q - 0.12 / np.sqrt(k) * (grad(q) + lam * np.sign(q))
    ep.append(np.linalg.norm(p - opt) + 1e-17)
    eq.append(np.linalg.norm(q - opt))
ax = axes[2]
ax.semilogy(eq, color=VIOLET, label="субградиент, шаг 0.12/√k")
ax.semilogy(ep, color=ORANGE, label="ISTA (мягкий порог)")
ax.set(xlabel="итерация", ylabel="расстояние до решения", title="Излом в нуле: λ = 6")
ax.legend()
print(f"после 200 итераций: ISTA {p}, субградиент {q.round(5)}; решение {opt}")
assert p[0] == 0 and abs(q[0]) > 0
lz = Lasso(alpha=0.5, fit_intercept=False).fit(np.ones((1, 1)), [1.3])
assert abs(lz.coef_[0] - soft(1.3, 0.5)) < 1e-12
print("мягкий порог совпадает с Lasso из scikit-learn")
axes[0].axhline(0, color=MUTED, lw=0.8)

ex.finish(fig, "step_size_and_line_search")
