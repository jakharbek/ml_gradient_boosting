"""Где производной нет: односторонние производные, галерея «плохих» точек, гладкость и субградиент.

Запуск:  python lessons/lesson_15_5/examples/nondifferentiable_points.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, ORANGE, VIOLET

ex = Example(__file__)


def one_sided(f, a, h=1e-7):
    """Односторонние разностные отношения (слева, справа)."""
    return (f(a) - f(a - h)) / h, (f(a + h) - f(a)) / h


# 1. Изломы: разные конечные односторонние производные
for name, f, a, expect in [("|x|", np.abs, 0, (-1, 1)), ("ReLU", lambda x: np.maximum(0, x), 0, (0, 1)),
                           ("hinge", lambda x: np.maximum(0, 1 - x), 1, (-1, 0)), ("|x² − 1|", lambda x: np.abs(x**2 - 1), 1, (-2, 2)),
                           ("x² | 3x − 2", lambda x: x**2 if x < 1 else 3 * x - 2, 1, (2, 3)),
                           ("x² | 2x − 1 (гладко)", lambda x: x**2 if x < 1 else 2 * x - 1, 1, (2, 2))]:
    left, right = one_sided(f, a)
    print(f"{name:22} f′₋ = {left:+.4f}, f′₊ = {right:+.4f}  → {'есть' if abs(left - right) < 1e-4 else 'нет'} производной")
    assert abs(left - expect[0]) < 1e-4 and abs(right - expect[1]) < 1e-4

# 2. Галерея в нуле: что делают отношения при h → 0
for name, f in [("остриё √|x|", lambda x: np.sqrt(abs(x))), ("вертикаль ∛x", np.cbrt), ("скачок [x ≥ 0]", lambda x: float(x >= 0))]:
    r = [(f(h) - f(0)) / h for h in (1e-2, 1e-4, 1e-6)]
    l_ = [(f(0) - f(-h)) / h for h in (1e-2, 1e-4, 1e-6)]
    print(f"{name:15} справа {np.round(r, 2)}, слева {np.round(l_, 2)}")
osc = [np.sin(1 / h) for h in (1e-2, 1e-3, 1e-4, 1e-5)]
print("x·sin(1/x): отношения", np.round(osc, 3), "— колеблются, предела нет")
wild = [h * np.sin(1 / h) for h in (1e-2, 1e-4, 1e-6)]
print("x²·sin(1/x): отношения", np.round(wild, 6), "→ 0: производная есть")
assert abs(wild[-1]) < 1e-5

# 3. Субградиент MAE шести квартир: 0 ∈ ∂L ровно на [4, 7]
y = np.array([2, 4, 3, 7, 9, 11], dtype=float)
L = lambda c: np.mean(np.abs(y - c))  # noqa: E731
for c in (3.5, 4.0, 5.5, 7.0, 8.0):
    left, right = (round(v, 6) for v in one_sided(L, c))
    print(f"MAE: ∂L({c}) = [{left:+.4f}; {right:+.4f}], минимум: {left <= 0 <= right}")
    assert (left <= 0 <= right) == (4 <= c <= 7)

# 4. Гладкость Хьюбера: f′ непрерывна, f″ прыгает
x = np.linspace(-2.5, 2.5, 1001)
f = np.where(np.abs(x) <= 1, 0.5 * x**2, np.abs(x) - 0.5)
d1 = np.clip(x, -1, 1)
d2 = (np.abs(x) < 1) * 1.0
assert np.allclose(np.gradient(f, x)[5:-5], d1[5:-5], atol=1e-2)
fig, axes = plt.subplots(1, 3, figsize=(12, 3.4))
for ax, v, name, c in zip(axes, [f, d1, d2], ["f — Хьюбер, δ = 1", "f′ = clip(x, −1, 1): непрерывна", "f″: скачки при |x| = 1"], [BLUE, ORANGE, VIOLET]):
    ax.plot(x, v, color=c, lw=2)
    ax.set(title=name, xlabel="x")
ex.finish(fig, "nondifferentiable_points")
