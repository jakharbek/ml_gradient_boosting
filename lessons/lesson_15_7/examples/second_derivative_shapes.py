"""Вторая производная: изгиб, перегиб и вторая разность с правильным шагом h.

Запуск:  python lessons/lesson_15_7/examples/second_derivative_shapes.py [--save] [--no-show]

Слева — функция x·e^(−x) с участками чаши и купола, касательными и точкой перегиба (там наклон
f′ экстремален). Справа — ошибка второй разности (f(x + h) − 2f(x) + f(x − h))/h² для eˣ в нуле:
сначала она падает как h²/12, потом её съедают ошибки округления; лучший шаг — около 10⁻⁴.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)

f = lambda x: x * np.exp(-x)              # noqa: E731
d1 = lambda x: (1 - x) * np.exp(-x)       # noqa: E731
d2 = lambda x: (x - 2) * np.exp(-x)       # noqa: E731


def d2num(fn, x, h):
    return (fn(x + h) - 2 * fn(x) + fn(x - h)) / h**2


# 1. Формулы против второй разности
pts = np.array([0.5, 1.0, 2.5, 4.0])
err = np.max(np.abs(d2num(f, pts, 1e-4) - d2(pts)))
print(f"x·e^(−x): max|Δ²f/h² − (x − 2)e^(−x)| = {err:.1e}")
assert err < 1e-6

# 2. Экстремум и перегиб
print(f"f′(1) = {d1(1.0):.1e}, f″(1) = {d2(1.0):.4f} < 0 → максимум f(1) = 1/e = {f(1.0):.4f}")
xs = np.linspace(-0.5, 7, 200000)
s = np.sign(d2(xs))
flip = xs[1:][s[1:] * s[:-1] < 0]
print("f″ меняет знак в x ≈", np.round(flip, 4), "→ перегиб; f(2) =", round(f(2.0), 4), ", наклон f′(2) =", round(d1(2.0), 4))
assert np.allclose(flip, [2.0], atol=1e-3)
# в перегибе наклон минимален
assert abs(xs[np.argmin(d1(xs))] - 2.0) < 1e-3

# 3. Вторая разность: ошибка и выбор шага
hs = np.logspace(-9, -0.3, 300)
errs = np.array([abs(d2num(np.exp, 0.0, h) - 1.0) for h in hs])
best_h = hs[np.argmin(errs)]
for h in [1e-1, 1e-2, 1e-4, 1e-6, 1e-8]:
    print(f"h = {h:7.0e}: Δ²(eˣ)/h² в нуле = {d2num(np.exp, 0.0, h):+.10f}")
print(f"лучший шаг на сетке ≈ {best_h:.1e} (теория: порядка корня 4-й степени из 1e-16 ≈ 1e-4)")
assert 1e-5 < best_h < 1e-3
assert abs(d2num(np.exp, 0.0, 0.1) - 1 - 0.1**2 / 12) < 1e-6  # ошибка ≈ h²/12
assert abs(d2num(lambda x: x**3, 1.0, 0.1) - 6) < 1e-12        # для куба — точно

fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.2))
x = np.linspace(-0.5, 7, 500)
a1.axvspan(-0.5, 2, color=VIOLET, alpha=0.07, label="f″ < 0: купол")
a1.axvspan(2, 7, color=AQUA, alpha=0.1, label="f″ > 0: чаша")
a1.plot(x, f(x), color=BLUE, lw=2.4, label="x·e^(−x)")
for x0, col in [(0.4, ORANGE), (2.0, "black"), (4.0, ORANGE)]:
    w = np.linspace(x0 - 1.2, x0 + 1.2, 50)
    a1.plot(w, f(x0) + d1(x0) * (w - x0), color=col, lw=1.4, ls="--" if x0 == 2.0 else "-")
a1.plot([1], [f(1.0)], "o", color=ORANGE, ms=7)
a1.plot([2], [f(2.0)], "o", mfc="white", color="black", ms=7)
a1.set(title="Перегиб в x = 2: касательная пересекает график", xlabel="x", ylim=(-0.6, 0.55))
a1.legend(loc="lower right")
a2.loglog(hs, np.maximum(errs, 1e-17), color=BLUE, lw=1.8, label="ошибка второй разности")
a2.loglog(hs, hs**2 / 12, "--", color=MUTED, label="h²/12 — ошибка метода")
a2.axvline(best_h, color=ORANGE, ls=":", label=f"лучший h ≈ {best_h:.0e}")
a2.set(title="eˣ в нуле: слишком маленький h — тоже плохо", xlabel="шаг h", ylabel="ошибка", ylim=(1e-17, 10))
a2.legend()
ex.finish(fig, "second_derivative_shapes")
