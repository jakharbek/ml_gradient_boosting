"""Численные методы для ОДУ: порядок, устойчивость, жёсткость, адаптивный шаг.

Запуск:  python lessons/lesson_15_11/examples/numerical_methods.py [--save] [--no-show]

1) Эйлер, Хойн, РК4 на y′ = −y: ошибка ~h, h², h⁴ (наклоны на графике log-log), экстраполяция Ричардсона.
2) Устойчивость: множитель 1 − hλ; граница hλ < 2; неявный метод устойчив при любом шаге.
3) Жёсткое уравнение y′ = −50(y − cos t): явный Эйлер при h = 0.05 разлетается, неявный — нет.
4) Адаптивный шаг (пара Эйлер — Хойн, относительный допуск) на логистическом скачке: вдвое меньше шагов.
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


def step(f, t, y, h, m):
    if m == "euler":
        return y + h * f(t, y)
    if m == "heun":
        k1 = f(t, y)
        return y + h * (k1 + f(t + h, y + h * k1)) / 2
    k1 = f(t, y)
    k2 = f(t + h / 2, y + h / 2 * k1)
    k3 = f(t + h / 2, y + h / 2 * k2)
    k4 = f(t + h, y + h * k3)
    return y + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6


def run(f, y0, T, h, m):
    y = y0
    for i in range(round(T / h)):
        y = step(f, i * h, y, h, m)
    return y


fig, axes = plt.subplots(2, 2, figsize=(12, 8))

# 1. Порядок
ax = axes[0, 0]
hs = np.array([0.5, 0.25, 0.2, 0.1, 0.05, 0.025])
print("1) y′ = −y на [0, 2]:")
for m, col, p in (("euler", ORANGE, 1), ("heun", AQUA, 2), ("rk4", VIOLET, 4)):
    e = np.array([abs(run(lambda t, y: -y, 1.0, 2.0, h, m) - math.exp(-2)) for h in hs])
    order = np.polyfit(np.log(hs), np.log(e), 1)[0]
    print(f"   {m:5}: ошибки при h = 0.2 и 0.1: {e[2]:.2e}, {e[3]:.2e}; наклон log-log {order:.2f}")
    assert abs(order - p) < 0.35
    ax.loglog(hs, e, "o-", color=col, label=f"{m} ~ h^{p}")
y1, y2 = 1.1**10, 1.05**20
print(f"   Ричардсон для y′ = y: 2·{y2:.4f} − {y1:.4f} = {2 * y2 - y1:.4f}, ошибка {math.e - (2 * y2 - y1):.4f}")
ax.set_xticks(hs, [str(h) for h in hs])
ax.minorticks_off()
ax.set(xlabel="h", ylabel="ошибка в t = 2", title="порядок метода — наклон на графике log-log")
ax.legend(fontsize=8)

# 2. Устойчивость
ax = axes[0, 1]
n = np.arange(21)
for hl, col in ((0.5, BLUE), (1.5, AQUA), (1.9, VIOLET), (2.1, ORANGE)):
    ax.plot(n, (1 - hl) ** n, "o-", ms=3, color=col, label=f"явный, hλ = {hl}")
ax.plot(n, (1 / 3.1) ** n, "s--", ms=3, color=MUTED, label="неявный, hλ = 2.1")
ax.set(ylim=(-3, 3), xlabel="шаг n", ylabel="yₙ", title="y′ = −λy: множитель 1 − hλ против 1/(1 + hλ)")
ax.legend(fontsize=8)
print("2) через 10 шагов:", {hl: round((1 - hl) ** 10, 4) for hl in (0.5, 1.5, 1.9, 2.1)})
assert abs((1 - 2.1) ** 10) > 1 > abs((1 - 1.9) ** 10)

# 3. Жёсткое уравнение
ax = axes[1, 0]
lam = 50.0
ref = solve_ivp(lambda t, y: -lam * (y - np.cos(t)), (0, 2), [0.0], method="Radau", rtol=1e-12, atol=1e-12, dense_output=True)
tt = np.linspace(0, 2, 400)
ax.plot(tt, ref.sol(tt)[0], color="k", ls="--", lw=1.5, label="эталон (Radau)")
for h, col in ((0.03, ORANGE), (0.05, VIOLET)):
    te, ye, yi = [0.0], [0.0], [0.0]
    for i in range(round(2 / h)):
        t = i * h
        ye.append(ye[-1] + h * (-lam * (ye[-1] - math.cos(t))))
        yi.append((yi[-1] + h * lam * math.cos(t + h)) / (1 + lam * h))
        te.append(t + h)
    print(f"3) h = {h}: явный y(2) = {ye[-1]:+.4e}, неявный {yi[-1]:+.5f}, эталон {ref.y[0, -1]:+.5f}")
    ax.plot(te, np.clip(ye, -2, 2), color=col, lw=1.2, label=f"явный, h = {h}")
    if h == 0.05:
        ax.plot(te, yi, "s", ms=3, color=BLUE, label="неявный, h = 0.05")
        assert abs(ye[-1]) > 1e6 and abs(yi[-1] - ref.y[0, -1]) < 1e-3
ax.set(ylim=(-1.6, 1.6), xlabel="t", ylabel="y", title="жёсткое y′ = −50(y − cos t)")
ax.legend(fontsize=8)

# 4. Адаптивный шаг
ax = axes[1, 1]
fa = lambda t, y: 10 * y * (1 - y)  # noqa: E731
exa = lambda t: 1 / (1 + 999 * math.exp(-10 * t))  # noqa: E731
tol, t, y, h = 1e-3, 0.0, 1e-3, 0.05
ts, hs_acc, me, rej = [], [], 0.0, 0
while t < 2 - 1e-12:
    h = min(h, 2 - t)
    k1 = fa(t, y)
    k2 = fa(t + h, y + h * k1)
    err, sc = h * abs(k2 - k1) / 2, tol * (1e-3 + abs(y))
    if err <= sc:
        t, y = t + h, y + h * (k1 + k2) / 2
        ts.append(t)
        hs_acc.append(h)
        me = max(me, abs(y - exa(t)))
    else:
        rej += 1
    h *= min(4, max(0.2, 0.9 * math.sqrt(sc / max(err, 1e-300))))


def fixed_err(N):
    hh, yy, m = 2 / N, 1e-3, 0.0
    for i in range(N):
        k1 = fa(i * hh, yy)
        yy += hh * (k1 + fa(i * hh + hh, yy + hh * k1)) / 2
        m = max(m, abs(yy - exa(i * hh + hh)))
    return m


N = 10
while fixed_err(N) > me:
    N = math.ceil(N * 1.05)
print(f"4) адаптивный: {len(ts)} шагов (+{rej} отвергнуто), max ошибка {me:.1e}; постоянный шаг: ≈ {N} шагов")
assert N > 1.5 * len(ts)
ax.semilogy(ts, hs_acc, ".", color=ORANGE, label="принятый шаг h")
ax.axvline(math.log(999) / 10, color=BLUE, ls="--", lw=1.2, label="скачок y: t = ln 999/10")
ax.set(xlabel="t", ylabel="h (лог.)", title="шаг мелкий на разгоне, крупный на плато")
ax.legend(fontsize=8, loc="lower right")
fig.tight_layout()
ex.finish(fig, "numerical_methods")
