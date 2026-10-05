"""Зоопарк функций и сдвиги графика.

Запуск:  python lessons/lesson_15_1/examples/function_zoo.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED

ex = Example(__file__)

x = np.linspace(-4, 4, 801)
with np.errstate(all="ignore"):
    zoo = {
        "x²": x**2, "|x|": np.abs(x), "eˣ": np.exp(x), "ln x": np.log(x),
        "sin x": np.sin(x), "σ(x)": 1 / (1 + np.exp(-x)),
    }
fig, axes = plt.subplots(2, 4, figsize=(13, 5.6))
for ax, (name, y) in zip(axes.flat, zoo.items()):
    ax.plot(x, np.where(np.abs(y) > 10, np.nan, y), color=BLUE, lw=2)
    ax.axhline(0, color=MUTED, lw=0.8)
    ax.set(title=name, ylim=(-4, 4))

g = lambda t: t**2  # noqa: E731
for ax, (title, y) in zip(axes.flat[6:], [("(x − 2)² − 1", g(x - 2) - 1), ("−0.5·(x + 1)²", -0.5 * g(x + 1))]):
    ax.plot(x, g(x), "--", color=MUTED)
    ax.plot(x, y, color=BLUE, lw=2.2)
    ax.set(title=title, ylim=(-4, 4))
plt.tight_layout()

bottom = x[np.argmin(g(x - 2) - 1)]
print(f"дно (x − 2)² − 1: x = {bottom:.2f}, y = {g(bottom - 2) - 1:.2f}")
assert abs(bottom - 2) < 1e-9
sig = 1 / (1 + np.exp(-x))
print("σ(0) =", 1 / (1 + np.exp(0)), "| σ(−x) = 1 − σ(x):", np.allclose(sig[::-1], 1 - sig))
assert np.allclose(sig[::-1], 1 - sig)
ex.finish(fig, "function_zoo")
