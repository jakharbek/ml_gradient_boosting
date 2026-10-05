"""Колебания и фазовые портреты: затухающий осциллятор, линейные системы, маятник, сохранение энергии.

Запуск:  python lessons/lesson_15_11/examples/oscillations_and_phase_plane.py [--save] [--no-show]

1) x″ + c·x′ + x = 0: время установления в полосе ±5 % — быстрее всех лёгкий недодемпф, критическое
   затухание — самое быстрое без перелёта, сильное трение — медленно.
2) Фазовые портреты x′ = A·x: седло, узел, фокус, центр — по следу и определителю.
3) Маятник: период растёт с размахом (эллиптический интеграл против численного решения).
4) Энергия пружины: Эйлер раскручивает, неявный сжимает, симплектический держит орбиту.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.integrate import solve_ivp
from scipy.special import ellipk

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, GREEN, MUTED, ORANGE, VIOLET

ex = Example(__file__)
fig, axes = plt.subplots(2, 2, figsize=(12, 9))

# 1. Осциллятор
ax = axes[0, 0]


def settle(c):
    s = solve_ivp(lambda t, u: [u[1], -u[0] - c * u[1]], (0, 60), [1, 0], max_step=0.005, rtol=1e-9)
    big = np.nonzero(np.abs(s.y[0]) > 0.05)[0]
    return s.t[big[-1] + 1], s


times = {}
for c, col in ((0.4, ORANGE), (1.5, AQUA), (2.0, BLUE), (4.0, VIOLET)):
    T5, s = settle(c)
    times[c] = T5
    ax.plot(s.t, s.y[0], color=col, lw=1.8, label=f"c = {c}: {T5:.1f}")
cs = [0.4, 1, 1.5, 2, 2.5, 3, 4]
print("1) установление в ±5 %:", {c: round(settle(c)[0], 2) for c in cs})
assert times[1.5] < times[2.0] < times[4.0] and times[2.0] < times[0.4]
ax.axhspan(-0.05, 0.05, color=GREEN, alpha=0.12)
ax.set(xlim=(0, 16), xlabel="t", ylabel="x", title="x″ + c·x′ + x = 0: время входа в ±5 %")
ax.legend(fontsize=8)

# 2. Фазовые портреты
ax = axes[0, 1]
mats = {"седло": [[1, 0], [0, -1]], "уст. узел": [[-1, 0], [0, -3]], "уст. фокус": [[-0.3, 1], [-1, -0.3]], "центр": [[0, 1], [-1, 0]]}
for (name, A), col in zip(mats.items(), (ORANGE, AQUA, BLUE, VIOLET)):
    A = np.array(A, dtype=float)
    tau, det = np.trace(A), np.linalg.det(A)
    print(f"2) {name:10}: τ = {tau:+.1f}, Δ = {det:+.2f}, τ² − 4Δ = {tau * tau - 4 * det:+.2f}, λ = {np.round(np.linalg.eigvals(A), 3)}")
    ax.scatter([tau], [det], color=col, s=50, zorder=3, label=name)
tt = np.linspace(-4, 4, 200)
ax.plot(tt, tt**2 / 4, "--", color=MUTED, label="Δ = τ²/4")
ax.axhline(0, color=MUTED, lw=0.8)
ax.axvline(0, color=MUTED, lw=0.8)
ax.set(xlabel="след τ", ylabel="определитель Δ", ylim=(-3, 5), title="карта «след — определитель»")
ax.legend(fontsize=8)

# 3. Маятник
ax = axes[1, 0]
amps = np.arange(5, 180, 5)
period = 4 * ellipk(np.sin(np.radians(amps) / 2) ** 2)
for A_deg in (10, 90, 170):
    A = math.radians(A_deg)
    s = solve_ivp(lambda t, u: [u[1], -math.sin(u[0])], (0, 40), [A, 0], rtol=1e-11, atol=1e-12, events=lambda t, u: u[1])
    half = [t for t in s.t_events[0] if t > 0.1][0]
    Tex = 4 * ellipk(math.sin(A / 2) ** 2)
    print(f"3) {A_deg:3d}°: период {Tex:.4f} (численно {2 * half:.4f}), ×{Tex / (2 * math.pi):.3f} от 2π")
    assert abs(2 * half - Tex) < 1e-6
ax.plot(amps, period / (2 * math.pi), color=BLUE, lw=2)
ax.axhline(1, color=MUTED, ls="--")
ax.set(xlabel="начальный угол, °", ylabel="период / 2π", title="маятник: линейная модель врёт при больших углах")

# 4. Энергия пружины
ax = axes[1, 1]
h, n = 0.1, 300
th = np.linspace(0, 2 * np.pi, 200)
ax.plot(np.cos(th), np.sin(th), "k--", lw=1, label="точно")
for name, col in (("Эйлер", ORANGE), ("неявный", BLUE), ("симплектический", GREEN)):
    x, v = 1.0, 0.0
    xs, vs = [x], [v]
    for _ in range(n):
        if name == "Эйлер":
            x, v = x + h * v, v - h * x
        elif name == "неявный":
            x, v = (x + h * v) / (1 + h * h), (v - h * x) / (1 + h * h)
        else:
            v -= h * x
            x += h * v
        xs.append(x)
        vs.append(v)
    print(f"4) {name:15}: энергия после {n} шагов {x * x + v * v:.4f}")
    ax.plot(xs, vs, color=col, lw=1.2, label=name)
ax.set(aspect="equal", xlim=(-3, 3), ylim=(-3, 3), xlabel="x", ylabel="v", title="пружина, h = 0.1, 300 шагов")
ax.legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "oscillations_and_phase_plane")
