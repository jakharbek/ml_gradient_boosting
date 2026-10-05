"""Градиент на карте высот: производная по направлению, перпендикулярность и градиентный спуск.

Запуск:  python lessons/lesson_15_8/examples/gradient_map.py [--save] [--no-show]

1) D_u f = ∇f · u для всех направлений: максимум |∇f| — вдоль градиента, ноль — вдоль линии уровня.
2) Градиент перпендикулярен линии уровня; соседний уровень — примерно на расстоянии Δc/|∇f|.
3) Цепное правило вдоль окружности: dh/dt = fₓx′ + f_y y′.
4) Спуск по x² + 3y² из (−2, 1.6): число шагов до f < 10⁻⁶ при разных η и расходимость при η > 1/3.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import optimize

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET, cmap_sequential

ex = Example(__file__)

f = lambda x, y: x**2 + 3 * y**2  # noqa: E731
grad = lambda x, y: np.array([2 * x, 6 * y])  # noqa: E731

# 1. Производная по направлению
g = grad(1.0, 1.0)
ang = np.radians(np.arange(0, 360, 0.5))
D = np.c_[np.cos(ang), np.sin(ang)] @ g
print(f"∇f(1, 1) = {g}, |∇f| = {np.linalg.norm(g):.4f}; max D_u f = {D.max():.4f} при {np.degrees(ang[D.argmax()]):.1f}°")
print("u = (0.6, 0.8): D_u f =", g @ np.array([0.6, 0.8]), "; неединичный (3, 4) дал бы", g @ np.array([3, 4]))
assert abs(D.max() - np.linalg.norm(g)) < 1e-3 and abs(g @ np.array([0.6, 0.8]) - 6) < 1e-12

# 2. Перпендикулярность и густота линий
perp = np.array([-g[1], g[0]])
assert g @ perp == 0
ug = g / np.linalg.norm(g)
dist = optimize.brentq(lambda s: f(*(np.array([1.0, 1.0]) + s * ug)) - 6, 0, 1)
print(f"до уровня 6 вдоль градиента: оценка Δc/|∇f| = {2 / np.linalg.norm(g):.4f}, точно {dist:.4f}")

# 3. Цепное правило
t = np.pi / 4
chain = grad(np.cos(t), np.sin(t)) @ np.array([-np.sin(t), np.cos(t)])
print(f"dh/dt на окружности при t = π/4: {chain:.6f} (напрямую 2 sin 2t = {2 * np.sin(2 * t):.6f})")
assert abs(chain - 2) < 1e-12


# 4. Спуск
def descend(eta, p0=(-2.0, 1.6), steps=2000):
    p, path = np.array(p0), [np.array(p0)]
    while 1e-6 < f(*p) < 1e6 and len(path) <= steps:
        p = p - eta * grad(*p)
        path.append(p)
    return np.array(path)


counts = {}
for eta in (0.05, 0.1, 0.15, 0.25, 0.3, 0.33, 0.34):
    path = descend(eta)
    counts[eta] = len(path) - 1 if f(*path[-1]) < 1e6 else None
    print(f"η = {eta:<5}: " + (f"{counts[eta]} шагов до f < 1e-6" if counts[eta] else "расходится"))
assert counts[0.25] == 12 and counts[0.1] == 35 and counts[0.34] is None
assert min(v for v in counts.values() if v) == counts[0.25]

X, Y = np.meshgrid(np.linspace(-2.5, 2.5, 200), np.linspace(-2, 2, 160))
fig, (a1, a2) = plt.subplots(1, 2, figsize=(14, 5.4))
a1.contourf(X, Y, f(X, Y), levels=30, cmap=cmap_sequential().reversed(), alpha=0.55)
a1.contour(X, Y, f(X, Y), levels=[1, 2, 4, 6, 8, 10, 12, 14, 16], colors=MUTED, linewidths=1)
qx, qy = np.meshgrid(np.linspace(-2.2, 2.2, 12), np.linspace(-1.8, 1.8, 10))
gx, gy = 2 * qx, 6 * qy
nrm = np.hypot(gx, gy) + 1e-9
a1.quiver(qx, qy, -gx / nrm, -gy / nrm, color=BLUE, alpha=0.6, scale=28)
for eta, c in [(0.05, AQUA), (0.15, ORANGE), (0.3, VIOLET)]:
    pth = descend(eta)[:40]
    a1.plot(pth[:, 0], pth[:, 1], "o-", ms=3, color=c, label=f"спуск η = {eta}")
a1.set(aspect="equal", xlabel="x", ylabel="y", title="Антиградиенты перпендикулярны линиям уровня")
a1.legend(loc="lower right")
a2.plot(np.degrees(ang), D, color=BLUE, lw=2)
a2.axhline(0, color=MUTED, lw=1)
a2.axvline(np.degrees(np.arctan2(g[1], g[0])), color=ORANGE, ls="--", label="вдоль ∇f: +|∇f|")
a2.set(xlabel="направление u, градусы", ylabel="D_u f = ∇f · u", title="Скорость роста по направлениям в точке (1, 1)", xlim=(0, 360))
a2.legend()
ex.finish(fig, "gradient_map")
