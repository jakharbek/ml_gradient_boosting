"""Касательная, нормаль и линейное приближение: f(a + Δ) ≈ f(a) + f′(a)·Δ и его ошибка.

Запуск:  python lessons/lesson_15_5/examples/tangent_and_linear_approx.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)

# 1. Касательные: уравнение y = f(a) + f'(a)(x − a)
for name, f, df, a in [("x²", lambda x: x**2, lambda x: 2 * x, 1.0), ("eˣ", np.exp, np.exp, 0.0), ("ln x", np.log, lambda x: 1 / x, 1.0)]:
    k, b = df(a), f(a) - df(a) * a
    print(f"касательная к {name} в {a}: y = {k:g}x {b:+g}")
x = np.linspace(-3, 3, 601)
assert np.all(np.exp(x) >= 1 + x - 1e-12), "eˣ ≥ 1 + x"
xp = np.linspace(0.05, 5, 600)
assert np.all(np.log(xp) <= xp - 1 + 1e-12), "ln x ≤ x − 1"

# 2. Треугольник под гиперболой: площадь 2 для любой точки касания
for a in (0.5, 1, 2, 5):
    area = 0.5 * (2 * a) * (2 / a)
    assert abs(area - 2) < 1e-12
print("касательная к 1/x отсекает треугольник площади 2 при любом a")

# 3. Мяч: средние скорости → мгновенная
s = lambda t: 20 * t - 5 * t**2  # noqa: E731
for dt in (0.5, 0.1, 0.01):
    print(f"средняя скорость на [1, 1 + {dt}] = {(s(1 + dt) - s(1)) / dt:.4f} м/с")
assert abs((s(1 + 1e-6) - s(1)) / 1e-6 - 10) < 1e-4

# 4. Линейные приближения
table = [("√4.1", np.sqrt, 0.25, 4, 0.1), ("sin 0.1", np.sin, 1, 0, 0.1), ("e^0.1", np.exp, 1, 0, 0.1),
         ("ln 1.05", np.log, 1, 1, 0.05), ("∛8.3", np.cbrt, 1 / 12, 8, 0.3), ("1.02¹⁰", lambda v: v**10, 10, 1, 0.02)]
for name, f, d1, a, d in table:
    approx = f(a) + d1 * d
    print(f"{name:8} приближение {approx:.6f}  точно {f(a + d):.6f}  ошибка {approx - f(a + d):+.2e}")
assert abs(2.025 - np.sqrt(4.1)) < 2e-4
assert abs(1.2 - 1.02**10) > 0.018  # сильная кривизна x¹⁰ — заметная ошибка

# 5. Порядок ошибки: наклон 2 для √x, 3 для sin x (f″(0) = 0)
ds = np.logspace(-4, 0, 60)
e_sqrt = np.abs(2 + 0.25 * ds - np.sqrt(4 + ds))
e_sin = np.abs(ds - np.sin(ds))
slope_sqrt = np.polyfit(np.log10(ds[:30]), np.log10(e_sqrt[:30]), 1)[0]
slope_sin = np.polyfit(np.log10(ds[10:40]), np.log10(e_sin[10:40]), 1)[0]
print(f"наклон линии ошибки в логарифмах: √x — {slope_sqrt:.2f}, sin x — {slope_sin:.2f}")
assert abs(slope_sqrt - 2) < 0.05 and abs(slope_sin - 3) < 0.05

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
a1.plot(x, x**2, color=BLUE, lw=2.2, label="y = x²")
a1.plot(x, 2 * x - 1, color=ORANGE, lw=2, label="касательная y = 2x − 1")
a1.plot(x, -x / 2 + 1.5, "--", color=VIOLET, lw=1.6, label="нормаль")
a1.plot([1], [1], "o", color=ORANGE)
a1.set(xlim=(-3, 3), ylim=(-2, 6), aspect="equal", xlabel="x", ylabel="y", title="Касательная и нормаль")
a1.legend(fontsize=8)
a2.loglog(ds, e_sqrt, color=BLUE, lw=2, label="√x около 4: ~Δ²")
a2.loglog(ds, e_sin, color=VIOLET, lw=2, label="sin x около 0: ~Δ³")
a2.loglog(ds, ds**2 / 32, ":", color=MUTED, label="½|f″(4)|·Δ²")
a2.set(xlabel="Δ", ylabel="|ошибка|", title="Ошибка линейного приближения")
a2.legend(fontsize=8)
ex.finish(fig, "tangent_and_linear_approx")
