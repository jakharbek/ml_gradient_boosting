"""Галерея пределов: дырка, скачок, колебания, вертикальная и наклонная асимптоты, число e.

Шесть типичных картинок урока с числовой проверкой каждой: предел есть, хотя значения нет; левый и
правый пределы различны; sin(1/x) мечется, а x·sin(1/x) сжимается к нулю; 1/x² уходит в +∞;
(x² + 1)/(x − 1) прижимается к прямой y = x + 1; (1 + 1/n)ⁿ растёт к e.

Запуск:  python lessons/lesson_15_3/examples/limits_gallery.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)

hole = lambda x: (x**2 - 1) / (x - 1)  # noqa: E731
for d in (0.01, 0.0001):
    print(f"(x²−1)/(x−1) при x = 1 ± {d}: {hole(1 - d):.6f}, {hole(1 + d):.6f}")
    assert abs(hole(1 - d) - 2) <= d + 1e-9 and abs(hole(1 + d) - 2) <= d + 1e-9
step = lambda x: (x >= 0) * 1.0  # noqa: E731
print("ступенька: слева", step(-1e-9), "справа", step(1e-9))
w = 0.001
x = np.linspace(-w, w, 200001)
x = x[x != 0]
r_osc, r_damp = np.ptp(np.sin(1 / x)), np.ptp(x * np.sin(1 / x))
print(f"в окне ±{w}: размах sin(1/x) = {r_osc:.4f}, размах x·sin(1/x) = {r_damp:.6f}")
assert r_osc > 1.99 and r_damp <= 2 * w
print("1/x² при x = 0.001:", 1 / 0.001**2)
ob = lambda x: (x**2 + 1) / (x - 1)  # noqa: E731
print(f"(x²+1)/(x−1) − (x + 1) при x = 100: {ob(100) - 101:.6f} (= 2/99)")
assert abs(ob(100) - 101 - 2 / 99) < 1e-9
seq = [(1 + 1 / n) ** n for n in (1, 10, 100, 1000)]
print("(1 + 1/n)^n:", [round(v, 5) for v in seq], "→ e =", round(np.e, 5))
assert all(a < b for a, b in zip(seq, seq[1:])) and seq[-1] < np.e

fig, axes = plt.subplots(2, 3, figsize=(14, 7.5))
g = np.linspace(-1, 3, 400)
axes[0, 0].plot(g, g + 1, color=BLUE, lw=2.2)
axes[0, 0].plot([1], [2], "o", mfc="white", mec=BLUE, ms=8)
axes[0, 0].set_title("дырка: предел 2, значения нет")
g = np.linspace(-2, 2, 400)
axes[0, 1].plot(g[g < 0], 0 * g[g < 0], color=BLUE, lw=2.2)
axes[0, 1].plot(g[g >= 0], 0 * g[g >= 0] + 1, color=BLUE, lw=2.2)
axes[0, 1].plot([0], [0], "o", mfc="white", mec=BLUE, ms=7)
axes[0, 1].plot([0], [1], "o", color=BLUE, ms=7)
axes[0, 1].set_title("скачок: слева 0, справа 1 — предела нет")
g = np.linspace(-0.4, 0.4, 40001)
g = g[g != 0]
axes[0, 2].plot(g, np.sin(1 / g), color=MUTED, lw=0.5, label="sin(1/x)")
axes[0, 2].plot(g, g * np.sin(1 / g), color=BLUE, lw=1.2, label="x·sin(1/x)")
axes[0, 2].legend(loc="lower right", fontsize=8)
axes[0, 2].set_title("колебания: нет предела / сжатие к 0")
g = np.linspace(-1.5, 1.5, 2001)
g = g[np.abs(g) > 0.15]
y = 1 / g**2
y[np.r_[False, np.diff(np.sign(g)) != 0]] = np.nan
axes[1, 0].plot(g, y, color=BLUE, lw=2.2)
axes[1, 0].axvline(0, color=ORANGE, ls="--")
axes[1, 0].set(ylim=(0, 45), title="1/x² → +∞: вертикальная асимптота")
g = np.linspace(-8, 8, 2001)
g = g[np.abs(g - 1) > 0.05]
y = ob(g)
y[np.abs(y) > 30] = np.nan
y[np.r_[False, np.diff(np.sign(g - 1)) != 0]] = np.nan
axes[1, 1].plot(g, y, color=BLUE, lw=2.2)
axes[1, 1].plot(g, g + 1, color=ORANGE, ls="--")
axes[1, 1].axvline(1, color=ORANGE, ls="--")
axes[1, 1].set(ylim=(-15, 15), title="(x² + 1)/(x − 1): асимптоты x = 1 и y = x + 1")
n = np.arange(1, 61)
axes[1, 2].plot(n, (1 + 1 / n) ** n, "o", color=BLUE, ms=4)
axes[1, 2].axhline(np.e, color=ORANGE, ls="--")
axes[1, 2].set_title("(1 + 1/n)ⁿ → e")
plt.tight_layout()
ex.finish(fig, "limits_gallery")
