"""Поверхности и карты высот: линии уровня, срезы и предел по разным путям.

Запуск:  python lessons/lesson_15_8/examples/surfaces_and_levels.py [--save] [--no-show]

1) Четыре поверхности (чаша, седло, холм, две ямы) — в объёме и картой высот с равным шагом уровней.
2) Густота линий: у круглой чаши кольца уровней 1, 2, 3, 4 сближаются — склон круче вдали от центра.
3) Срезы: у x² + 3y² каждый срез — парабола, у седла срез по диагонали плоский.
4) Предел в нуле по разным путям: xy/(x² + y²) и x²y/(x⁴ + y²) — предела нет, x²y/(x² + y²) → 0.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET, cmap_sequential

ex = Example(__file__)
CMAP = cmap_sequential().reversed()

SURF = {
    "чаша x² + 3y²": lambda x, y: x**2 + 3 * y**2,
    "седло x² − y²": lambda x, y: x**2 - y**2,
    "холм 3e^(−(x²+y²)/2)": lambda x, y: 3 * np.exp(-(x**2 + y**2) / 2),
    "две ямы": lambda x, y: 2 - 2 * np.exp(-((x - 1) ** 2 + y**2)) - 1.4 * np.exp(-((x + 1.2) ** 2 + (y - 0.8) ** 2) / 0.5),
}

# 1. Кольца круглой чаши
radii = np.sqrt([1, 2, 3, 4])
gaps = np.diff(radii)
print("круглая чаша x² + y² = c: радиусы", radii.round(3), "промежутки", gaps.round(3))
assert np.all(np.diff(gaps) < 0)            # кольца сближаются: склон круче вдали

# 2. Срезы
t = np.linspace(-2, 2, 401)
bowl = SURF["чаша x² + 3y²"]
saddle = SURF["седло x² − y²"]
assert np.allclose(bowl(t, 1.0), t**2 + 3) and np.allclose(bowl(1.0, t), 1 + 3 * t**2)
assert np.allclose(saddle(t, t), 0)         # седло вдоль диагонали плоское
print("срезы: x² + 3y² при y = 1 — парабола x² + 3; седло вдоль y = x — тождественный ноль")

# 3. Предел по путям
f_a = lambda x, y: x * y / (x**2 + y**2)        # noqa: E731
f_b = lambda x, y: x**2 * y / (x**4 + y**2)     # noqa: E731
f_c = lambda x, y: x**2 * y / (x**2 + y**2)     # noqa: E731
x0 = 1e-4
print(f"xy/(x²+y²) у нуля: вдоль y = 0 → {f_a(x0, 0.0):.3f}, вдоль y = x → {f_a(x0, x0):.3f}, вдоль y = −x → {f_a(x0, -x0):.3f}")
print(f"x²y/(x⁴+y²): вдоль y = x → {f_b(x0, x0):.5f}, вдоль y = x² → {f_b(x0, x0**2):.3f}")
print(f"x²y/(x²+y²): вдоль y = x → {f_c(x0, x0):.1e}, вдоль y = x² → {f_c(x0, x0**2):.1e}")
assert abs(f_a(x0, x0) - 0.5) < 1e-12 and abs(f_b(x0, x0**2) - 0.5) < 1e-12 and abs(f_c(x0, x0)) < 1e-4

# Рисунок: 4 поверхности + 4 карты + график предела по путям
X, Y = np.meshgrid(np.linspace(-2.5, 2.5, 140), np.linspace(-2.2, 2.2, 140))
fig = plt.figure(figsize=(17, 11))
for k, (name, fn) in enumerate(SURF.items()):
    Z = fn(X, Y)
    ax = fig.add_subplot(3, 4, k + 1, projection="3d")
    ax.plot_surface(X, Y, Z, cmap=CMAP, linewidth=0, alpha=0.95)
    ax.set(title=name, xlabel="x", ylabel="y")
    ax2 = fig.add_subplot(3, 4, k + 5)
    ax2.imshow(Z, extent=(X.min(), X.max(), Y.min(), Y.max()), origin="lower", cmap=CMAP, alpha=0.6, aspect="auto")
    lv = np.linspace(Z.min(), np.quantile(Z, 0.97), 9)[1:-1]
    cs = ax2.contour(X, Y, Z, levels=lv, colors=MUTED, linewidths=1)
    ax2.clabel(cs, fontsize=7, fmt="%.2g")
    ax2.set(aspect="equal", xlabel="x", ylabel="y", title="карта высот")
xs = np.logspace(-3, 0, 200)
ax3 = fig.add_subplot(3, 2, 5)
for k_, c, lab in [(0, BLUE, "y = 0"), (1, ORANGE, "y = x"), (-1, VIOLET, "y = −x"), (2, AQUA, "y = 2x")]:
    ax3.semilogx(xs, f_a(xs, k_ * xs), color=c, label=lab)
ax3.set(title="xy/(x² + y²) вдоль прямых: у каждой свой предел k/(1 + k²)", xlabel="x → 0")
ax3.legend()
ax4 = fig.add_subplot(3, 2, 6)
for path, c, lab in [(xs, BLUE, "y = x"), (2 * xs, AQUA, "y = 2x"), (xs**2, ORANGE, "y = x²")]:
    ax4.semilogx(xs, f_b(xs, path), color=c, label=lab)
ax4.set(title="x²y/(x⁴ + y²): прямые → 0, парабола → 1/2", xlabel="x → 0")
ax4.legend()
plt.tight_layout()
ex.finish(fig, "surfaces_and_levels")
