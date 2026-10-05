"""Паспорт функции: область определения, нули, знаки, экстремумы, чётность, обратная.

Запуск:  python lessons/lesson_15_1/examples/function_properties.py [--save] [--no-show]

Численно «читает» графики так же, как ученик читает их глазами: где функция определена (np.isfinite),
где нули (смена знака), где максимум и argmax, симметричен ли график, и проверяет, что логит —
обратная к сигмоиде.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, INK, MUTED, ORANGE, RED

ex = Example(__file__)


def passport(name, f, x0, x1, n=60001):
    """Печатает «паспорт» функции на отрезке [x0; x1] и возвращает сетку."""
    x = np.round(np.linspace(x0, x1, n), 10)   # сетка проходит через «круглые» точки (±1, ±2, …)
    with np.errstate(all="ignore"):
        y = f(x)
    ok = np.isfinite(y)
    xs, ys = x[ok], y[ok]
    sign = np.sign(ys)
    crossing = xs[:-1][(sign[:-1] * sign[1:] < 0) & (np.diff(xs) < 1e-3)]   # смена знака между соседями
    zeros = np.unique(np.r_[crossing, xs[sign == 0]].round(3))
    gaps = np.flatnonzero(np.diff(ok.astype(int)))                       # где начинается/кончается D
    edges = ", ".join(f"{v:.2f}" for v in x[gaps + 1 * (~ok[gaps])]) or "нет"
    t = np.linspace(0.1, min(abs(x0), abs(x1)) * 0.9, 50) if x0 < 0 < x1 else None
    parity = "—"
    if t is not None:
        with np.errstate(all="ignore"):
            a, b = f(t), f(-t)
        both = np.isfinite(a) & np.isfinite(b)   # сравниваем только там, где определены f(x) и f(−x)
        a, b = a[both], b[both]
        parity = "чётная" if np.allclose(a, b) else "нечётная" if np.allclose(a, -b) else "ни та, ни другая"
    print(f"{name:18s} определена на {ok.mean():.0%} отрезка, границы D: {edges}  E ≈ [{ys.min():.3f}; {ys.max():.3f}]  "
          f"нули {zeros[:5]}  max {ys.max():.3f} при x = {xs[ys.argmax()]:.2f}  {parity}")
    return xs, ys, zeros


ex_list = {
    "(x+2)(x−1)(x−3)/4": (lambda x: (x + 2) * (x - 1) * (x - 3) / 4, -3, 4),
    "√(4 − x²)": (lambda x: np.sqrt(4 - x**2), -3, 3),
    "ln(x² − 1)": (lambda x: np.log(x**2 - 1), -4, 4),
    "x³ − 3x": (lambda x: x**3 - 3 * x, -2.5, 2.5),
    "σ(x) − ½": (lambda x: 1 / (1 + np.exp(-x)) - 0.5, -6, 6),
}
results = {name: passport(name, *spec) for name, spec in ex_list.items()}

# Ключевые утверждения урока
assert list(results["(x+2)(x−1)(x−3)/4"][2]) == [-2.0, 1.0, 3.0]
xs, ys, _ = results["√(4 − x²)"]
assert xs.min() == -2 and xs.max() == 2 and ys.min() == 0 and abs(ys.max() - 2) < 1e-12
assert list(results["√(4 − x²)"][2]) == [-2.0, 2.0]
xs, _, _ = results["ln(x² − 1)"]
assert (np.abs(xs) > 1).all()

sigmoid = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731
logit = lambda p: np.log(p / (1 - p))  # noqa: E731
z = np.linspace(-6, 6, 241)
assert np.allclose(logit(sigmoid(z)), z)
print(f"logit(σ(z)) = z: да; старт классификатора при доле 0.3: F0 = {logit(0.3):.4f}")

fig, axes = plt.subplots(1, 3, figsize=(14, 3.8))
x = np.linspace(-3.5, 4.5, 2001)
y = (x + 2) * (x - 1) * (x - 3) / 4
ax = axes[0]
ax.fill_between(x, 0, np.maximum(y, 0), color=RED, alpha=0.2, label="f > 0")
ax.fill_between(x, 0, np.minimum(y, 0), color=BLUE, alpha=0.2, label="f < 0")
ax.plot(x, y, color=BLUE, lw=2)
ax.plot([-2, 1, 3], [0, 0, 0], "o", mfc="white", mec=INK)
ax.axhline(0, color=MUTED, lw=0.8)
ax.set(ylim=(-5, 5), title="нули и знаки")
ax.legend()

ax = axes[1]
x = np.linspace(-4.5, 4.5, 2001)
y = -0.05 * x**4 + 0.9 * x**2 + 0.3 * x + 2
ax.plot(x, y, color=BLUE, lw=2)
ax.plot([x[y.argmax()], x[y.argmin()]], [y.max(), y.min()], "o", mfc="white", mec=INK, ms=9)
ax.set_title(f"argmax ≈ {x[y.argmax()]:.2f}, argmin = {x[y.argmin()]:.1f} (край)")

ax = axes[2]
pp = np.linspace(0.005, 0.995, 400)
ax.plot(z, sigmoid(z), color=BLUE, lw=2, label="σ(x)")
ax.plot(pp, logit(pp), color=ORANGE, lw=2, label="logit(x)")
ax.plot([-5, 5], [-5, 5], "--", color=MUTED, label="y = x")
ax.set(xlim=(-5, 5), ylim=(-5, 5), aspect="equal", title="обратные функции")
ax.legend()
plt.tight_layout()
ex.finish(fig, "function_properties")
