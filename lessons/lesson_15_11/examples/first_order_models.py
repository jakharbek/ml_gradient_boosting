"""Уравнения первого порядка: приток и отток, фазовая прямая, экспонента, логистика, фильтр низких частот.

Запуск:  python lessons/lesson_15_11/examples/first_order_models.py [--save] [--no-show]

1) y′ = a − b·y: капельница, бак, парашютист — выход на равновесие a/b за время ~1/b.
2) Фазовая прямая y′ = 4y(1 − y)(y − 0.3): равновесия чередуются, устойчивость по знаку f′.
3) Логистическая кривая против экспоненты: одинаковое начало, разная судьба; логит растёт линейно.
4) Дом в жару: T′ = −k(T − T_out(t)) гасит быстрые колебания — фильтр низких частот (и EMA как шаг Эйлера).
Каждая формула сверяется со scipy.integrate.solve_ivp.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.integrate import solve_ivp

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)


def ivp(f, y0, T, n=400):
    s = solve_ivp(f, (0, T), np.atleast_1d(np.asarray(y0, dtype=float)), rtol=1e-10, atol=1e-12, dense_output=True)
    t = np.linspace(0, T, n)
    return t, s.sol(t)


fig, axes = plt.subplots(2, 2, figsize=(12, 8))

# 1. Приток минус отток
ax = axes[0, 0]
print("1) y′ = a − b·y")
for (name, a, b, T), col in zip((("капельница, мг", 10, 0.2, 30), ("бак, кг", 1, 0.05, 120), ("парашютист, м/с", 9.8, 0.2, 30)), (BLUE, ORANGE, AQUA)):
    t, Y = ivp(lambda t, y, a=a, b=b: a - b * y, 0.0, T)
    formula = a / b * (1 - np.exp(-b * t))
    err = np.max(np.abs(Y[0] - formula))
    print(f"   {name:16}: равновесие {a / b:.1f}, τ = {1 / b:.0f}, за 3τ пройдено {1 - math.exp(-3):.1%}; |solve_ivp − формула| = {err:.1e}")
    assert err < 1e-6
    ax.plot(t * b, Y[0] / (a / b), color=col, lw=2, label=name)
ax.axhline(1, color=MUTED, ls="--")
for m in (1, 3):
    ax.axvline(m, color=MUTED, lw=0.8, ls=":")
ax.set(xlabel="время в единицах τ = 1/b", ylabel="доля равновесия", title="y′ = a − b·y: все три истории — одна кривая")
ax.legend(fontsize=8)

# 2. Фазовая прямая
ax = axes[0, 1]
f = lambda y: 4 * y * (1 - y) * (y - 0.3)  # noqa: E731
print("2) y′ = 4y(1 − y)(y − 0.3):")
for ys in (0, 0.3, 1):
    d = (f(ys + 1e-6) - f(ys - 1e-6)) / 2e-6
    print(f"   y* = {ys}: f′ = {d:+.2f} — {'устойчиво' if d < 0 else 'неустойчиво'}")
for y0 in np.linspace(0.05, 1.25, 13):
    t, Y = ivp(lambda t, y: f(y), y0, 12, 300)
    ax.plot(t, Y[0], color=BLUE if y0 > 0.3 else ORANGE, lw=1.4)
for ys in (0, 0.3, 1):
    ax.axhline(ys, color=MUTED, ls="--", lw=1)
ax.set(xlabel="t", ylabel="y", title="эффект Олли: порог 0.3 делит судьбы")

# 3. Логистика против экспоненты
ax = axes[1, 0]
r, K, y0 = 0.8, 1000, 10
t, Y = ivp(lambda t, y: r * y * (1 - y / K), y0, 12)
logi = K / (1 + (K - y0) / y0 * np.exp(-r * t))
assert np.max(np.abs(Y[0] - logi)) < 1e-6
t500 = math.log(99) / r
print(f"3) продажи: 500 при t = {t500:.3f}; в t = 2 экспонента {y0 * math.exp(2 * r):.1f}, логистика {logi[np.searchsorted(t, 2)]:.1f}")
ax.plot(t, logi, color=BLUE, lw=2.4, label="логистика K/(1 + Ce^{−rt})")
ax.plot(t, np.minimum(y0 * np.exp(r * t), 1400), color=ORANGE, ls="--", lw=1.8, label="экспонента 10e^{0.8t}")
ax.axhline(K, color=MUTED, ls=":")
ax.axvline(t500, color=VIOLET, lw=1, ls=":")
ax.set(xlabel="t", ylabel="продано", ylim=(0, 1400), title="одинаковое начало, разная судьба")
ax.legend(fontsize=8)
lg = np.log(logi / (K - logi))
slope = np.polyfit(t, lg, 1)[0]
print(f"   логит растёт линейно: наклон {slope:.6f} = r")
assert abs(slope - r) < 1e-6

# 4. Фильтр низких частот
ax = axes[1, 1]
om = 2 * math.pi / 24
print("4) дом при суточных колебаниях улицы:")
for kk, col in ((0.05, VIOLET), (0.2, BLUE), (2.0, AQUA)):
    t, Y = ivp(lambda t, T, kk=kk: -kk * (T - 20 - 5 * np.sin(om * t)), 20.0, 24 * 30, 24 * 30 * 20 + 1)
    last = t >= 24 * 29
    amp = (Y[0][last].max() - Y[0][last].min()) / 2 / 5
    print(f"   k = {kk}: амплитуда {amp:.3f} (формула {kk / math.hypot(kk, om):.3f}), запаздывание {math.atan(om / kk) / om:.2f} ч")
    assert abs(amp - kk / math.hypot(kk, om)) < 2e-3
    ax.plot(t[last] - 24 * 29, Y[0][last], color=col, lw=2, label=f"k = {kk}")
tt = np.linspace(0, 24, 200)
ax.plot(tt, 20 + 5 * np.sin(om * tt), color=MUTED, ls="--", label="улица")
ax.set(xlabel="час суток", ylabel="°C", title="T′ = −k(T − T_out): чем меньше k, тем слабее и позже")
ax.legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "first_order_models")
