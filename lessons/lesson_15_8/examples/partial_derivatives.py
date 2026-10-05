"""Частные производные: правило «заморозки», численные разности, смешанные производные и касательная плоскость.

Запуск:  python lessons/lesson_15_8/examples/partial_derivatives.py [--save] [--no-show]

1) Формулы частных производных семи функций сверяются с центральными разностями.
2) Выбор шага: ошибка «вперёд» ~ h, центральной ~ h², затем растёт из-за округления.
3) Теорема Шварца: f_xy = f_yx для x·e^(xy); контрпример xy(x² − y²)/(x² + y²) в нуле: −1 и 1.
4) Касательная плоскость: у гладкой функции ошибка ~ ρ² (наклон 2 на лог-лог шкале), у конуса в вершине ~ ρ.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)


def grad_num(f, p, eps=1e-6):
    p = np.asarray(p, dtype=float)
    return np.array([(f(p + e) - f(p - e)) / (2 * eps) for e in np.eye(len(p)) * eps])


# 1. Правило «заморозки»
CASES = [
    ("x² + 3y²", lambda p: p[0] ** 2 + 3 * p[1] ** 2, lambda x, y: [2 * x, 6 * y], (1, 1)),
    ("x²y", lambda p: p[0] ** 2 * p[1], lambda x, y: [2 * x * y, x**2], (1, 2)),
    ("x·e^(xy)", lambda p: p[0] * np.exp(p[0] * p[1]), lambda x, y: [(1 + x * y) * np.exp(x * y), x**2 * np.exp(x * y)], (1, 0.5)),
    ("ln(x² + y²)", lambda p: np.log(p[0] ** 2 + p[1] ** 2), lambda x, y: [2 * x / (x * x + y * y), 2 * y / (x * x + y * y)], (1, 2)),
    ("sin x · cos y", lambda p: np.sin(p[0]) * np.cos(p[1]), lambda x, y: [np.cos(x) * np.cos(y), -np.sin(x) * np.sin(y)], (np.pi / 3, np.pi / 4)),
    ("x^y", lambda p: p[0] ** p[1], lambda x, y: [y * x ** (y - 1), x**y * np.log(x)], (2, 3)),
    ("ИМТ m/h²", lambda p: p[0] / p[1] ** 2, lambda m, h: [1 / h**2, -2 * m / h**3], (70, 1.75)),
]
for name, f, d, pt in CASES:
    exact, num = np.array(d(*pt)), grad_num(f, pt)
    print(f"{name:14} в ({pt[0]:.4g}, {pt[1]:.4g}): ∂/∂1 = {exact[0]:+.5f}, ∂/∂2 = {exact[1]:+.5f}  (численно {num.round(5)})")
    assert np.allclose(exact, num, rtol=1e-6, atol=1e-7)

# 2. Выбор шага
g = lambda x, y: x * np.exp(x * y)  # noqa: E731
exact = 1.5 * np.exp(0.5)
hs = np.logspace(-12, 0, 121)
e_fwd = np.abs((g(1 + hs, 0.5) - g(1, 0.5)) / hs - exact)
e_cen = np.abs((g(1 + hs, 0.5) - g(1 - hs, 0.5)) / (2 * hs) - exact)
h_best = hs[np.argmin(e_cen)]
print(f"лучший шаг центральной разности ≈ {h_best:.0e}, ошибка {e_cen.min():.1e}")
assert 1e-7 < h_best < 1e-3 and e_cen.min() < 1e-10

# 3. Смешанные производные
f3 = lambda x, y: x * np.exp(x * y)  # noqa: E731
h = 1e-4
fxy = (f3(1 + h, 0.5 + h) - f3(1 + h, 0.5 - h) - f3(1 - h, 0.5 + h) + f3(1 - h, 0.5 - h)) / (4 * h * h)
print(f"x·e^(xy): f_xy численно {fxy:.5f}, по формуле x(2 + xy)e^(xy) = {2.5 * np.exp(0.5):.5f}")
assert abs(fxy - 2.5 * np.exp(0.5)) < 1e-5
pe = lambda x, y: 0.0 if x == 0 and y == 0 else x * y * (x * x - y * y) / (x * x + y * y)  # noqa: E731
e = 1e-7
fx_y = lambda y: (pe(e, y) - pe(-e, y)) / (2 * e)  # noqa: E731
fy_x = lambda x: (pe(x, e) - pe(x, -e)) / (2 * e)  # noqa: E731
m1 = (fx_y(1e-3) - fx_y(-1e-3)) / 2e-3
m2 = (fy_x(1e-3) - fy_x(-1e-3)) / 2e-3
print(f"контрпример Пеано: f_xy(0, 0) ≈ {m1:.3f}, f_yx(0, 0) ≈ {m2:.3f}")
assert abs(m1 + 1) < 0.01 and abs(m2 - 1) < 0.01

# 4. Касательная плоскость
rhos = np.logspace(-3, 0, 31)
ang = np.linspace(0, 2 * np.pi, 72, endpoint=False)


def plane_err(fn, a, gr, rho):
    P = a + rho * np.c_[np.cos(ang), np.sin(ang)]
    return np.abs(fn(P[:, 0], P[:, 1]) - (fn(*a) + (P - a) @ gr)).max()


ecos = lambda x, y: np.exp(x) * np.cos(y)  # noqa: E731
cone = lambda x, y: np.hypot(x, y)  # noqa: E731
err_s = np.array([plane_err(ecos, np.array([0.3, 0.4]), grad_num(lambda p: ecos(*p), [0.3, 0.4]), r) for r in rhos])
err_c = np.array([plane_err(cone, np.zeros(2), np.zeros(2), r) for r in rhos])
k_s = np.polyfit(np.log10(rhos[:12]), np.log10(err_s[:12]), 1)[0]
k_c = np.polyfit(np.log10(rhos), np.log10(err_c), 1)[0]
print(f"наклон ошибки касательной плоскости: eˣcos y — {k_s:.2f}, конус в вершине — {k_c:.2f}")
assert abs(k_s - 2) < 0.05 and abs(k_c - 1) < 0.01

fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(16.5, 4.4))
a1.loglog(hs, np.maximum(e_fwd, 1e-17), color=BLUE, label="вперёд")
a1.loglog(hs, np.maximum(e_cen, 1e-17), color=ORANGE, label="центральная")
a1.set(title="∂f/∂x численно: x·e^(xy) в (1, 0.5)", xlabel="шаг h", ylabel="ошибка")
a1.legend()
xs = np.linspace(-1.5, 2.5, 200)
for yy, col in [(0.5, BLUE), (0.7, ORANGE)]:
    a2.plot(xs, f3(xs, yy), color=col, label=f"срез y = {yy}")
    sl = (1 + yy) * np.exp(yy)
    a2.plot(xs, f3(1, yy) + sl * (xs - 1), "--", color=col, lw=1)
a2.set(title="наклон по x меняется с y: f_xy ≠ 0", xlabel="x", ylim=(-2, 12))
a2.legend()
a3.loglog(rhos, err_s, color=ORANGE, label="eˣcos y: ~ρ²")
a3.loglog(rhos, err_c, color=VIOLET, label="конус в вершине: ~ρ")
a3.loglog(rhos, 0.3 * rhos**2, ":", color=MUTED, label="наклон 2")
a3.set(title="ошибка касательной плоскости", xlabel="радиус ρ")
a3.legend()
plt.tight_layout()
ex.finish(fig, "partial_derivatives")
