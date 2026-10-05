"""Численная производная: ошибка усечения против округления, Ричардсон и шумные данные.

Запуск:  python lessons/lesson_15_5/examples/numeric_derivative.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, RED, VIOLET

ex = Example(__file__)

# 1. Порядок ошибки на x³: вперёд 3a² + 3ah + h², центральная 3a² + h²
f3 = lambda x: x**3  # noqa: E731
print("x³ в 1, h = 0.1: вперёд", round((f3(1.1) - f3(1)) / 0.1, 10), " центральная", round((f3(1.1) - f3(0.9)) / 0.2, 10))
assert abs((f3(1.1) - f3(1)) / 0.1 - 3.31) < 1e-9 and abs((f3(1.1) - f3(0.9)) / 0.2 - 3.01) < 1e-9

# 2. sin в точке 1: V-образная ошибка и лучший шаг
hs = np.logspace(-15, 0, 301)
exact = np.cos(1.0)
fwd = np.abs((np.sin(1 + hs) - np.sin(1)) / hs - exact)
cen = np.abs((np.sin(1 + hs) - np.sin(1 - hs)) / (2 * hs) - exact)
D = lambda t: (np.sin(1 + t) - np.sin(1 - t)) / (2 * t)  # noqa: E731
rich = np.abs((4 * D(hs / 2) - D(hs)) / 3 - exact)


def best_step(err, w=10):
    """Оптимум по сглаженной ошибке: среднее lg|ошибки| в окне ±0.5 порядка (одиночные «удачные» h — шум округления)."""
    lg = np.log10(np.maximum(err, 1e-17))
    smooth = np.convolve(lg, np.ones(2 * w + 1) / (2 * w + 1), mode="same")
    i = int(np.argmin(smooth[w:-w])) + w
    return hs[i], 10 ** smooth[i]


best_h = {}
for name, err in [("вперёд", fwd), ("центральная", cen), ("Ричардсон", rich)]:
    best_h[name], typ = best_step(err)
    print(f"{name:12} лучший h ≈ {best_h[name]:.0e}, типичная ошибка там {typ:.0e}")
assert 1e-9 < best_h["вперёд"] < 1e-7
assert 1e-6 < best_h["центральная"] < 1e-4
assert 1e-4 < best_h["Ричардсон"] < 1e-2

# 3. Шумные данные: оптимальный шаг растёт с шумом
rng = Mulberry32(7)
x = np.arange(629) * 0.01
noise = np.array([rng.normal() for _ in x])
ks = [1, 2, 5, 10, 20, 40, 80]
best = {}
curves = {}
for sigma in (1e-3, 1e-2, 0.05):
    y = np.sin(x) + sigma * noise
    rmse = [np.sqrt(np.mean(((y[2 * k:] - y[:-2 * k]) / (2 * k * 0.01) - np.cos(x[k:-k])) ** 2)) for k in ks]
    best[sigma] = ks[int(np.argmin(rmse))] * 0.01
    curves[sigma] = rmse
    print(f"σ = {sigma:<5}: RMSE при h = 0.01 — {rmse[0]:.4f}, лучший h = {best[sigma]:.2f} (RMSE {min(rmse):.4f})")
assert best[1e-3] < best[1e-2] < best[0.05]

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11.5, 4))
for err, name, c in [(fwd, "вперёд", AQUA), (cen, "центральная", VIOLET), (rich, "Ричардсон", RED)]:
    a1.loglog(hs, np.where(err > 0, err, np.nan), color=c, lw=1.6, label=name)
a1.loglog(hs, 1.1e-16 / hs, ":", color=MUTED, label="округление ~10⁻¹⁶/h")
a1.set(ylim=(1e-16, 1), xlabel="h", ylabel="|ошибка|", title="sin x в точке 1")
a1.legend(fontsize=8)
for (sigma, rmse), c in zip(curves.items(), [BLUE, ORANGE, VIOLET]):
    a2.loglog(np.array(ks) * 0.01, rmse, "o-", color=c, label=f"σ = {sigma}")
a2.set(xlabel="h", ylabel="RMSE оценки производной", title="Шум требует большего шага")
a2.legend()
ex.finish(fig, "numeric_derivative")
