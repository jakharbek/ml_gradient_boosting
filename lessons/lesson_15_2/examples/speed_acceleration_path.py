"""Путь → скорость → ускорение и обратно: путь как сумма v·Δt.

По таблице замеров пути np.gradient даёт скорость и ускорение; по скорости суммы v·Δt
восстанавливают путь, и при уменьшении Δt ошибка исчезает (это будущий интеграл).

Запуск:  python lessons/lesson_15_2/examples/speed_acceleration_path.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE

ex = Example(__file__)

s = lambda t: 3 * t**2 - t**3 / 5  # noqa: E731
v = lambda t: 6 * t - 0.6 * t**2   # noqa: E731
a = lambda t: 6 - 1.2 * t          # noqa: E731

# 1. Конечные разности: путь за каждую секунду, вторые разности — ускорение
t = np.arange(11)
d1 = np.diff(s(t))
d2 = np.diff(d1)
print("Δs за секунду:", np.round(d1, 2))
print("Δ²s:          ", np.round(d2, 2), "— падают на 1.2 каждую секунду")
assert abs(d1.sum() - 100) < 1e-9
assert np.allclose(np.diff(d2), -1.2)

# 2. Численные скорость и ускорение по замерам каждые 0.1 с
tt = np.linspace(0, 10, 101)
vel = np.gradient(s(tt), tt)
accn = np.gradient(vel, tt)
err_v = np.max(np.abs(vel - v(tt))[1:-1])
print(f"скорость по замерам: макс. ошибка внутри {err_v:.1e} м/с")
assert err_v < 0.01

# 3. Обратная задача: путь как сумма v·Δt
for dt in [2, 1, 0.5, 0.1]:
    k = np.arange(0, 10, dt)
    left, mid = np.sum(v(k) * dt), np.sum(v(k + dt / 2) * dt)
    print(f"Δt = {dt:<4} в начале: {left:8.3f} м   в середине: {mid:8.3f} м   (точно 100)")
assert abs(np.sum(v(np.arange(0, 10, 0.1)) * 0.1) - 100) < 0.02

fig, axs = plt.subplots(1, 3, figsize=(13, 3.6))
axs[0].plot(tt, s(tt), color=BLUE, lw=2.2)
axs[0].set(title="путь s(t), м", xlabel="t, с")
axs[1].plot(tt, v(tt), color=ORANGE, lw=2.2, label="точно")
axs[1].plot(tt[::5], vel[::5], "o", color=MUTED, ms=4, label="np.gradient")
axs[1].set(title="скорость v(t), м/с", xlabel="t, с")
axs[1].legend(fontsize=8)
axs[2].plot(tt, a(tt), color=AQUA, lw=2.2, label="точно")
axs[2].plot(tt[2:-2:5], accn[2:-2:5], "o", color=MUTED, ms=4, label="np.gradient дважды")
axs[2].axhline(0, color=MUTED, lw=1)
axs[2].set(title="ускорение a(t), м/с²", xlabel="t, с")
axs[2].legend(fontsize=8)
ex.finish(fig, "speed_acceleration_path")
