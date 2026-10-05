"""Знак производной, экстремумы на отрезке (теорема Ферма) и теорема Лагранжа.

Запуск:  python lessons/lesson_15_5/examples/extrema_and_mean_value.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import optimize

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, RED

ex = Example(__file__)


def candidates(f, df, a, b, kinks=()):
    """Концы отрезка, нули f′ внутри и изломы — все кандидаты в экстремумы."""
    x = np.linspace(a, b, 20001)
    d = df(x)
    roots = [optimize.brentq(df, x[i], x[i + 1]) for i in np.where(np.sign(d[:-1]) * np.sign(d[1:]) < 0)[0]]
    roots += list(x[1:-1][d[1:-1] == 0])
    pts = np.array(sorted({a, b, *roots, *[k for k in kinks if a < k < b]}))
    return pts, f(pts)


problems = [
    ("x² − 4x на [0, 5]", lambda x: x**2 - 4 * x, lambda x: 2 * x - 4, 0, 5, (), (5, -4)),
    ("x³ − 3x на [−2, 3]", lambda x: x**3 - 3 * x, lambda x: 3 * x**2 - 3, -2, 3, (), (18, -2)),
    ("x·e⁻ˣ на [0, 4]", lambda x: x * np.exp(-x), lambda x: (1 - x) * np.exp(-x), 0, 4, (), (np.exp(-1), 0)),
    ("x⁴ − 2x² на [−1.5, 2]", lambda x: x**4 - 2 * x**2, lambda x: 4 * x**3 - 4 * x, -1.5, 2, (), (8, -1)),
    ("|x² − 1| на [−2, 2]", lambda x: np.abs(x**2 - 1), lambda x: 2 * x * np.sign(x**2 - 1), -2, 2, (-1, 1), (3, 0)),
    ("x(10 − x) на [0, 10]", lambda x: x * (10 - x), lambda x: 10 - 2 * x, 0, 10, (), (25, 0)),
]
for name, f, df, a, b, kinks, (mx, mn) in problems:
    pts, vals = candidates(f, df, a, b, kinks)
    print(f"{name:24} кандидаты {np.round(pts, 4)} → max {vals.max():.4f}, min {vals.min():.4f}")
    assert abs(vals.max() - mx) < 1e-6 and abs(vals.min() - mn) < 1e-6
    xx = np.linspace(a, b, 200001)  # проверка перебором
    assert abs(f(xx).max() - mx) < 1e-6 and abs(f(xx).min() - mn) < 1e-6

# Теорема Лагранжа: f′(c) = наклон секущей
for name, f, df, a, b, c_exp in [("x³ на [0, 2]", lambda x: x**3, lambda x: 3 * x**2, 0, 2, 2 / np.sqrt(3)),
                                 ("sin на [0, π/2]", np.sin, np.cos, 0, np.pi / 2, np.arccos(2 / np.pi)),
                                 ("√x на [0, 4]", np.sqrt, lambda x: 0.5 / np.sqrt(x), 0, 4, 1.0)]:
    k = (f(b) - f(a)) / (b - a)
    c = optimize.brentq(lambda t, df=df, k=k: df(t) - k, a + 1e-9, b - 1e-9)
    print(f"Лагранж, {name:15}: наклон секущей {k:.4f}, c = {c:.4f}")
    assert abs(c - c_exp) < 1e-9

# Оценка Липшица для сигмоиды: |σ(a) − σ(b)| ≤ |a − b| / 4
sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731
z = np.linspace(-6, 6, 1001)
ratios = np.abs(np.diff(sig(z))) / np.diff(z)
assert ratios.max() <= 0.25 + 1e-12
print(f"наибольший наклон сигмоиды на сетке {ratios.max():.6f} ≤ 0.25")

f, df = problems[1][1], problems[1][2]
x = np.linspace(-2.2, 3.1, 500)
fig, (a1, a2) = plt.subplots(2, 1, figsize=(7.5, 6), sharex=True)
pts, vals = candidates(f, df, -2, 3)
a1.axvspan(-2.2, -2, color=MUTED, alpha=0.2)
a1.axvspan(3, 3.1, color=MUTED, alpha=0.2)
a1.plot(x, f(x), color=BLUE, lw=2.2, label="f(x) = x³ − 3x")
a1.scatter(pts, vals, c=[RED if v == vals.max() else AQUA if v == vals.min() else MUTED for v in vals], zorder=3, s=50, label="кандидаты")
a1.set(ylim=(-4, 20), ylabel="f(x)", title="Наибольшее и наименьшее на [−2, 3]: кандидаты — нули f′ и концы")
a1.legend()
d = df(x)
a2.plot(x, d, color=ORANGE, lw=2, label="f′(x) = 3x² − 3")
a2.fill_between(x, 0, d, where=d > 0, color=RED, alpha=0.15)
a2.fill_between(x, 0, d, where=d < 0, color=BLUE, alpha=0.15)
a2.axhline(0, color=MUTED, lw=1)
a2.set(xlabel="x", ylabel="f′(x)")
a2.legend()
ex.finish(fig, "extrema_and_mean_value")
