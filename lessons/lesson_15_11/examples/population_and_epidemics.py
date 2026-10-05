"""Популяции и эпидемии: хищник — жертва, модель SIR и прививки, вылов и бифуркация.

Запуск:  python lessons/lesson_15_11/examples/population_and_epidemics.py [--save] [--no-show]

1) Лотка — Вольтерра: замкнутые циклы, сохраняемая величина V; Эйлер раскручивает цикл, РК4 — нет.
2) SIR при R₀ = 2.5: пик при S = 1/R₀, итоговая доля из уравнения 1 − z = e^(−R₀z).
3) Прививки: доля 1 − 1/R₀ гасит вспышку.
4) Вылов y′ = y(1 − y) − H: два равновесия сливаются при H = 1/4 — седло-узловая бифуркация.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)
fig, axes = plt.subplots(2, 2, figsize=(12, 8.5))


def rk4(f, y, h):
    k1 = f(y)
    k2 = f(y + h / 2 * k1)
    k3 = f(y + h / 2 * k2)
    k4 = f(y + h * k3)
    return y + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6


# 1. Лотка — Вольтерра
ax = axes[0, 0]
lv = lambda u: np.array([u[0] * (1 - 0.5 * u[1]), u[1] * (-0.75 + 0.25 * u[0])])  # noqa: E731
V = lambda u: 0.25 * u[0] - 0.75 * math.log(u[0]) + 0.5 * u[1] - math.log(u[1])  # noqa: E731
h = 0.1
for name, col in (("Эйлер", ORANGE), ("РК4", BLUE)):
    u = np.array([5.0, 1.0])
    path = [u]
    for _ in range(round(30 / h)):
        u = u + h * lv(u) if name == "Эйлер" else rk4(lv, u, h)
        path.append(u)
    path = np.array(path)
    dV = V(path[-1]) - V(path[0])
    print(f"1) {name}: V(30) − V(0) = {dV:.2e}")
    ax.plot(path[:, 0], path[:, 1], color=col, lw=1.5, label=f"{name}, h = {h}")
assert abs(dV) < 1e-4
ax.axvline(3, color=AQUA, ls="--", lw=1, label="y′ = 0")
ax.axhline(2, color=VIOLET, ls="--", lw=1, label="x′ = 0")
ax.set(xlabel="зайцы x", ylabel="рыси y", title="хищник — жертва")
ax.legend(fontsize=8)

# 2–3. SIR и прививки
beta, gam = 0.5, 0.2
R0 = beta / gam
sir = lambda t, u: [-beta * u[0] * u[1], beta * u[0] * u[1] - gam * u[1], gam * u[1]]  # noqa: E731
ax = axes[0, 1]
s = solve_ivp(sir, (0, 200), [0.999, 0.001, 0], rtol=1e-10, atol=1e-12, dense_output=True)
t = np.linspace(0, 200, 20001)
S, Inf, Rr = s.sol(t)
z = brentq(lambda z: 1 - z - math.exp(-R0 * z), 1e-9, 1)
print(f"2) R0 = {R0}: пик {Inf.max():.1%} на день {t[Inf.argmax()]:.1f}, S в пике {S[Inf.argmax()]:.3f} (1/R0 = {1 / R0}); итог {Rr[-1]:.3f}, формула {z:.3f}")
assert abs(S[Inf.argmax()] - 1 / R0) < 1e-3 and abs(Rr[-1] - z) < 2e-3
for arr, col, lab in ((S, BLUE, "S"), (Inf, ORANGE, "I"), (Rr, AQUA, "R")):
    ax.plot(t, arr, color=col, lw=2, label=lab)
ax.axvline(t[Inf.argmax()], color=MUTED, ls=":")
ax.set(xlabel="день", ylabel="доля", title=f"SIR, R₀ = {R0}")
ax.legend(fontsize=8)

ax = axes[1, 0]
for v, col in ((0.0, ORANGE), (0.3, VIOLET), (0.5, AQUA), (0.6, BLUE)):
    s = solve_ivp(sir, (0, 400), [(1 - v) * 0.999, 0.001, 0], rtol=1e-10, atol=1e-12, dense_output=True)
    tt = np.linspace(0, 400, 4001)
    ax.plot(tt, s.sol(tt)[1], color=col, lw=2, label=f"привито {v:.0%}: всего {s.y[2, -1]:.1%}")
    print(f"3) привито {v:.0%}: переболело {s.y[2, -1]:.1%}")
ax.set(xlabel="день", ylabel="болеют I", title=f"порог коллективного иммунитета 1 − 1/R₀ = {1 - 1 / R0:.0%}")
ax.legend(fontsize=8)

# 4. Вылов и бифуркация
ax = axes[1, 1]
Hs = np.linspace(0, 0.25, 200)
ax.plot(Hs, (1 + np.sqrt(1 - 4 * Hs)) / 2, color=BLUE, lw=2.4, label="устойчивое")
ax.plot(Hs, (1 - np.sqrt(1 - 4 * Hs)) / 2, "--", color=BLUE, lw=2, label="порог")
ax.scatter([0.25], [0.5], color="red", zorder=3)
ev = lambda t, y: y[0]  # noqa: E731
ev.terminal = True
for H, y0 in ((0.26, 0.5), (0.3, 1.0)):
    s = solve_ivp(lambda t, y, H=H: y * (1 - y) - H, (0, 100), [y0], events=ev, rtol=1e-10)
    print(f"4) H = {H} из {y0}: популяция исчезает при t = {s.t_events[0][0]:.2f}")
d = math.sqrt(1 - 0.8)
print(f"   H = 0.2: равновесия {(1 - d) / 2:.4f} и {(1 + d) / 2:.4f}")
ax.set(xlabel="квота H", ylabel="равновесие y*", title="седло-узловая бифуркация при H = 1/4")
ax.legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "population_and_epidemics")
