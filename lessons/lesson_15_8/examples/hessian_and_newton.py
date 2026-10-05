"""Гессиан в деле: критические точки, овраги, масштаб признаков и метод Ньютона.

Запуск:  python lessons/lesson_15_8/examples/hessian_and_newton.py [--save] [--no-show]

1) x⁴ + y⁴ − 4xy: три критические точки (scipy.optimize.root) и их тип по собственным числам гессиана.
2) Ловушка x² + 4xy + y²: f_xx, f_yy > 0, но det H < 0 — седло.
3) Овраг ½(x² + κy²): шагов спуска ~ κ, Ньютону хватает одного.
4) Линейная регрессия на шести квартирах: центрирование x снижает число обусловленности с 87.6 до 2.9.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import optimize

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET, cmap_sequential

ex = Example(__file__)

# 1. Критические точки
f = lambda p: p[0] ** 4 + p[1] ** 4 - 4 * p[0] * p[1]                       # noqa: E731
grad = lambda p: np.array([4 * p[0] ** 3 - 4 * p[1], 4 * p[1] ** 3 - 4 * p[0]])  # noqa: E731
hess = lambda p: np.array([[12 * p[0] ** 2, -4.0], [-4.0, 12 * p[1] ** 2]])      # noqa: E731
pts = []
for sx in np.linspace(-1.5, 1.5, 7):
    for sy in np.linspace(-1.5, 1.5, 7):
        sol = optimize.root(grad, [sx, sy], jac=hess)
        if sol.success and not any(np.allclose(sol.x, q, atol=1e-7) for q in pts):
            pts.append(sol.x)
kinds = []
for q in sorted(pts, key=lambda q: q[0]):
    lam = np.linalg.eigvalsh(hess(q))
    kind = "седло" if lam[0] < 0 < lam[1] else "минимум" if lam[0] > 0 else "максимум"
    kinds.append(kind)
    print(f"({q[0]:+.3f}, {q[1]:+.3f}): f = {f(q):+.3f}, det H = {np.linalg.det(hess(q)):+7.1f}, λ = {lam.round(2)} → {kind}")
assert sorted(kinds) == ["минимум", "минимум", "седло"]

# 2. Ловушка
Ht = np.array([[2.0, 4.0], [4.0, 2.0]])
lam_t = np.linalg.eigvalsh(Ht)
print(f"x² + 4xy + y²: det H = {np.linalg.det(Ht):.1f}, λ = {lam_t} → седло, хотя f_xx = f_yy = 2 > 0")
assert lam_t[0] < 0 < lam_t[1]

# 3. Овраг
steps = {}
for kappa in (1, 3, 10, 30, 100):
    H = np.diag([1.0, kappa])
    p0 = np.array([2.0, 1.0])
    f0 = 0.5 * p0 @ H @ p0
    p, k, eta = p0.copy(), 0, 2 / (1 + kappa)
    while 0.5 * p @ H @ p > 1e-6 * f0:
        p, k = p - eta * H @ p, k + 1
    steps[kappa] = k
    newton = p0 - np.linalg.solve(H, H @ p0)
    assert np.allclose(newton, 0)
    print(f"κ = {kappa:3}: спуск с лучшим η = {eta:.3f} — {k:3} шагов; Ньютон — 1 шаг")
assert steps[10] == 35 and steps[100] == 346

# 4. Линейная регрессия: обусловленность
X, y = datasets.toy_regression()
x = X[:, 0]
for xx, name in [(x, "исходный x"), (x - x.mean(), "x − 3.5")]:
    H = 2 * np.array([[np.mean(xx**2), np.mean(xx)], [np.mean(xx), 1]])
    lam = np.linalg.eigvalsh(H)
    print(f"{name:10}: гессиан {H.round(2).tolist()}, κ = {lam[1] / lam[0]:.2f}, η < {2 / lam[1]:.4f}")
H0 = 2 * np.array([[np.mean(x**2), np.mean(x)], [np.mean(x), 1]])
assert abs(np.linalg.eigvalsh(H0)[1] / np.linalg.eigvalsh(H0)[0] - 87.6) < 0.05

fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(17, 5))
G1, G2 = np.meshgrid(np.linspace(-2, 2, 200), np.linspace(-2, 2, 200))
Z = G1**4 + G2**4 - 4 * G1 * G2
a1.contourf(G1, G2, np.clip(Z, -2.5, 10), levels=30, cmap=cmap_sequential().reversed(), alpha=0.6)
a1.contour(G1, G2, Z, levels=[-1.5, -1, 0, 1, 3, 6, 10], colors=MUTED, linewidths=1)
for q, kind in zip(sorted(pts, key=lambda q: q[0]), kinds):
    a1.plot(*q, "o", ms=10, color=BLUE if kind == "минимум" else VIOLET, mec="white")
a1.set(aspect="equal", title="x⁴ + y⁴ − 4xy: две ямы и седло", xlabel="x", ylabel="y")
ks = list(steps)
a2.loglog(ks, [steps[k] for k in ks], "o-", color=ORANGE, label="градиентный спуск")
a2.loglog(ks, [1] * len(ks), "s--", color=VIOLET, label="Ньютон")
a2.loglog(ks, 3.45 * np.array(ks, float), ":", color=MUTED, label="∝ κ")
a2.set(title="Шагов до f/f₀ < 10⁻⁶", xlabel="число обусловленности κ")
a2.legend()
for xx, c, lab, eta in [(x, ORANGE, "исходный x, η = 0.05", 0.05), (x - x.mean(), AQUA, "x − 3.5, η = 0.3", 0.3)]:
    w = b = 0.0
    Lopt = np.mean((y - np.polyval(np.polyfit(xx, y, 1), xx)) ** 2)
    hist = []
    for _ in range(400):
        r = y - w * xx - b
        hist.append(np.mean(r**2) - Lopt)
        w, b = w + eta * 2 * np.mean(xx * r), b + eta * 2 * np.mean(r)
    a3.semilogy(np.maximum(hist, 1e-16), color=c, label=lab)
a3.set(title="Линейная регрессия: L − L* по шагам", xlabel="шаг", ylim=(1e-14, 100))
a3.legend()
plt.tight_layout()
ex.finish(fig, "hessian_and_newton")
