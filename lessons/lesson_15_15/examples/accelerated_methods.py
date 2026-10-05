"""Ускорение и второй порядок: моментум и Нестеров (√κ вместо κ), Adam и поворот осей, Ньютон и BFGS.

Запуск:  python lessons/lesson_15_15/examples/accelerated_methods.py [--save] [--no-show]

1) Шагов до f < 1e-6 на чаше ½(x² + κy²) для спуска, моментума и Нестерова — наклоны 1 и ½ в лог-масштабе.
2) Adam, RMSProp и спуск на чаше ½(u² + 25v²), повёрнутой на угол θ.
3) Изогнутая долина: спуск с Армихо, BFGS (своя реализация) и Ньютон; сверка со scipy.optimize.minimize.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.optimize import minimize

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))


# 1. Моментум и Нестеров
def bowl_steps(kappa, method, beta):
    p, v, eta = np.array([-4.0, 1.5]), np.zeros(2), 1 / kappa
    for k in range(1, 300001):
        q = p + beta * v if method == "nest" else p
        g = np.array([q[0], kappa * q[1]])
        if method == "gd":
            p = p - eta * g
        else:
            v = beta * v - eta * g
            p = p + v
        if 0.5 * (p[0] ** 2 + kappa * p[1] ** 2) < 1e-6:
            return k


KS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
gd = [bowl_steps(k, "gd", 0) for k in KS]
hb = [bowl_steps(k, "mom", (1 - 1 / math.sqrt(k)) ** 2) for k in KS]
ne = [bowl_steps(k, "nest", (math.sqrt(k) - 1) / (math.sqrt(k) + 1)) for k in KS]
ax = axes[0]
ax.loglog(KS, gd, "o-", color=BLUE, label="спуск")
ax.loglog(KS, hb, "o-", color=ORANGE, label="моментум")
ax.loglog(KS, ne, "o-", color=VIOLET, label="Нестеров")
ax.set(xlabel="κ", ylabel="шагов до f < 1e-6", title="Ускорение: √κ вместо κ")
ax.legend()
s_gd = np.polyfit(np.log(KS[3:]), np.log(gd[3:]), 1)[0]
s_hb = np.polyfit(np.log(KS[3:]), np.log(hb[3:]), 1)[0]
print(f"наклоны: спуск {s_gd:.2f}, моментум {s_hb:.2f}; κ = 1000: {gd[-1]} против {hb[-1]} шагов")
assert abs(s_gd - 1) < 0.1 and abs(s_hb - 0.5) < 0.1


# 2. Adam и поворот
def steps(A, method, tol=1e-4):
    p, m, s = np.array([-4.0, 1.5]), np.zeros(2), np.zeros(2)
    for k in range(1, 3001):
        g = A @ p
        if method == "gd":
            p = p - 2 / 26 * g
        elif method == "rms":
            s = 0.9 * s + 0.1 * g**2
            p = p - 0.05 * g / (np.sqrt(s) + 1e-8)
        else:
            m = 0.9 * m + 0.1 * g
            s = 0.999 * s + 0.001 * g**2
            p = p - 0.1 * (m / (1 - 0.9**k)) / (np.sqrt(s / (1 - 0.999**k)) + 1e-8)
        if 0.5 * p @ A @ p < tol:
            return k
    return 3000


degs = np.arange(0, 91, 5)
curves = {m: [] for m in ("gd", "rms", "adam")}
for d in degs:
    th = np.deg2rad(d)
    Rm = np.array([[np.cos(th), np.sin(th)], [-np.sin(th), np.cos(th)]])
    A = Rm.T @ np.diag([1.0, 25.0]) @ Rm
    for m in curves:
        curves[m].append(steps(A, m))
ax = axes[1]
for m, col, lab in (("gd", MUTED, "спуск, η = 2/(L + μ)"), ("rms", AQUA, "RMSProp"), ("adam", ORANGE, "Adam")):
    ax.plot(degs, curves[m], "o-", ms=3, color=col, label=lab)
ax.set(xlabel="поворот θ, градусы", ylabel="шагов до f < 1e-4", title="Adam любит оси координат")
ax.legend()
print("Adam: 0° —", curves["adam"][0], "шагов, 45° —", curves["adam"][9])
assert curves["adam"][9] > 3 * curves["adam"][0]

# 3. Второй порядок
f = lambda p: (1 - p[0]) ** 2 + 5 * (p[1] - p[0] ** 2) ** 2  # noqa: E731
grad = lambda p: np.array([-2 * (1 - p[0]) - 20 * p[0] * (p[1] - p[0] ** 2), 10 * (p[1] - p[0] ** 2)])  # noqa: E731
hess = lambda p: np.array([[2 - 20 * p[1] + 60 * p[0] ** 2, -20 * p[0]], [-20 * p[0], 10.0]])  # noqa: E731


def descent(method, p0=(-1.2, 1.5), max_it=3000):
    p, Hk, errs = np.array(p0), np.eye(2), [f(p0)]
    g = grad(p)
    for it in range(max_it):
        if f(p) < 1e-12 or np.linalg.norm(g) < 1e-10:
            break
        if method == "gd":
            d = -g
        elif method == "newton":
            Hm = hess(p)
            lmin = np.linalg.eigvalsh(Hm).min()
            if lmin <= 1e-6:
                Hm = Hm + (1e-3 - lmin) * np.eye(2)
            d = -np.linalg.solve(Hm, g)
        else:
            d = -Hk @ g
        t = 1.0
        while f(p + t * d) > f(p) + 1e-4 * t * (g @ d) and t > 1e-12:
            t *= 0.5
        pn = p + t * d
        gn = grad(pn)
        if method == "bfgs":
            s, y = pn - p, gn - g
            if s @ y > 1e-12:
                if it == 0:
                    Hk = (s @ y) / (y @ y) * np.eye(2)
                rho = 1 / (s @ y)
                Hk = (np.eye(2) - rho * np.outer(s, y)) @ Hk @ (np.eye(2) - rho * np.outer(y, s)) + rho * np.outer(s, s)
        p, g = pn, gn
        errs.append(max(f(p), 1e-17))
    return it, errs


ax = axes[2]
for method, col, lab in (("gd", BLUE, "спуск + Армихо"), ("bfgs", VIOLET, "BFGS"), ("newton", ORANGE, "Ньютон")):
    it, errs = descent(method)
    ax.loglog(np.arange(1, len(errs) + 1), errs, color=col, label=f"{lab}: {it} итераций")
    print(f"{lab:15}: {it} итераций")
ax.set(xlabel="итерация", ylabel="f − f*", title="Изогнутая долина: второй порядок")
ax.legend()
res = minimize(f, [-1.2, 1.5], jac=grad, method="BFGS", tol=1e-12)
print("scipy BFGS: итераций", res.nit, ", x =", res.x.round(8))
assert descent("bfgs")[0] < 40 and descent("newton")[0] < 15 < descent("gd")[0]

ex.finish(fig, "accelerated_methods")
