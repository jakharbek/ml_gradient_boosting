"""Наглядные доказательства правил: площадь квадрата и прямоугольника, бином, усиления цепочки.

Запуск:  python lessons/lesson_15_6/examples/rules_visual_proofs.py [--save] [--no-show]

1) прирост площади x² и u·v = полоски + уголок; доля уголка → 0;
2) бином: у (x + h)ⁿ − xⁿ все слагаемые, кроме n·xⁿ⁻¹·h, исчезают быстрее h;
3) цепное правило: сдвиг Δx растягивается каждым звеном в его производную раз;
4) произведение и частное: правило против типичных ошибок u′v′ и u′/v′.
"""

import sys
from math import comb
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Rectangle

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, ORANGE, RED, VIOLET

ex = Example(__file__)


def num_diff(f, x, eps=1e-6):
    return (f(x + eps) - f(x - eps)) / (2 * eps)


# 1. Площадь: (u + du)(v + dv) − uv = v·du + u·dv + du·dv
u, v = 3.0, 2.0
print(" Δ        прирост    полоски    уголок    доля уголка")
shares = []
for d in [0.5, 0.1, 0.01, 0.001]:
    growth = (u + d) * (v + d) - u * v
    strips = v * d + u * d
    shares.append(d * d / growth)
    print(f"{d:<8} {growth:9.6f} {strips:10.6f} {d * d:9.1e}   {100 * d * d / growth:7.3f} %")
assert all(a > b for a, b in zip(shares, shares[1:]))  # доля уголка убывает
assert shares[-1] < 1e-3

# 2. Бином для n = 5 в точке x = 1.2
n, x = 5, 1.2
for h in [0.1, 0.01, 0.001]:
    q = ((x + h) ** n - x**n) / h
    rest = sum(comb(n, k) * x ** (n - k) * h ** (k - 1) for k in range(2, n + 1))
    print(f"h = {h:<6}: Δ/h = {q:.6f} = главное {n * x ** (n - 1):.6f} + остальные {rest:.6f}")
    assert abs(q - n * x ** (n - 1) - rest) < 1e-9

# 3. Цепочка e^(sin(x²)) в точке 1: усиления звеньев перемножаются
links = [(lambda t: t**2, lambda t: 2 * t), (np.sin, np.cos), (np.exp, np.exp)]
x0, gains, val = 1.0, [], 1.0
for f, df in links:
    gains.append(df(val))
    val = f(val)
full = lambda t: np.exp(np.sin(t**2))  # noqa: E731
print("усиления звеньев:", np.round(gains, 5), "произведение", round(float(np.prod(gains)), 6), "численно", round(num_diff(full, x0), 6))
assert abs(np.prod(gains) - num_diff(full, x0)) < 1e-6

# 4. Произведение и частное против типичных ошибок
cases = [("x·eˣ", lambda t: t * np.exp(t), lambda t: np.exp(t) * (1 + t), lambda t: np.exp(t)),
         ("x/(1 + x²)", lambda t: t / (1 + t**2), lambda t: (1 - t**2) / (1 + t**2) ** 2, lambda t: 1 / (2 * t))]
for name, f, good, bad in cases:
    print(f"{name:11} при x = 0.7: численно {num_diff(f, 0.7):.6f}, правило {good(0.7):.6f}, ошибка {bad(0.7):.6f}")
    assert abs(num_diff(f, 0.7) - good(0.7)) < 1e-8 and abs(num_diff(f, 0.7) - bad(0.7)) > 0.1

fig, axes = plt.subplots(1, 3, figsize=(15, 4.4))
ax = axes[0]
d = 0.6
ax.add_patch(Rectangle((0, 0), u, v, color=BLUE, alpha=0.35, label="u·v"))
ax.add_patch(Rectangle((u, 0), d, v, color=ORANGE, alpha=0.6, label="полоски v·Δu и u·Δv"))
ax.add_patch(Rectangle((0, v), u, d, color=ORANGE, alpha=0.6))
ax.add_patch(Rectangle((u, v), d, d, color=RED, alpha=0.8, label="уголок Δu·Δv"))
ax.set(xlim=(-0.2, 4), ylim=(-0.2, 3), aspect="equal", title="(uv)′ = u′v + uv′: две полоски")
ax.legend(fontsize=8, loc="upper left")
ds = np.logspace(-3, 0, 60)
axes[1].loglog(ds, [dd * dd / ((u + dd) * (v + dd) - u * v) for dd in ds], color=VIOLET, lw=2.2)
axes[1].set(title="доля уголка в приросте → 0", xlabel="приращение Δ", ylabel="доля")
names = ["звено 1\n(x²)′", "звено 2\n(sin u)′", "звено 3\n(eᵛ)′", "произведение"]
axes[2].bar(names, [*gains, np.prod(gains)], color=[AQUA, AQUA, AQUA, ORANGE])
axes[2].set(title="цепное правило: усиления перемножаются (x = 1)")
fig.tight_layout()
ex.finish(fig, "rules_visual_proofs")
