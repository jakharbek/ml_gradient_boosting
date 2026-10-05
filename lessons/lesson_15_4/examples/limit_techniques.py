"""Приёмы раскрытия неопределённостей: сокращение, сопряжённое, старшая степень, ∞ − ∞.

Шесть пределов — по одному на каждый приём урока — с проверкой таблицей с обеих сторон и графиками,
на которых выколотая точка показывает предел, а пунктир — асимптоту.

Запуск:  python lessons/lesson_15_4/examples/limit_techniques.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, ORANGE

ex = Example(__file__)

finite = [
    ("сократить: (x³ − 3x + 2)/(x³ − x² − x + 1)", lambda x: (x**3 - 3 * x + 2) / (x**3 - x**2 - x + 1), 1.0, 1.5, (0.0, 2.0)),
    ("сопряжённое: (√(x + 1) − 1)/(√(x + 4) − 2)", lambda x: (np.sqrt(x + 1) - 1) / (np.sqrt(x + 4) - 2), 0.0, 2.0, (-0.9, 3.0)),
    ("общий знаменатель: 1/(x − 1) − 2/(x² − 1)", lambda x: 1 / (x - 1) - 2 / (x**2 - 1), 1.0, 0.5, (0.2, 3.0)),
]
infinite = [
    ("старшая степень: (3x² + x)/(x² + 1)", lambda x: (3 * x**2 + x) / (x**2 + 1), 3.0),
    ("знак: √(4x² + 1)/(x + 3) при x → −∞", lambda x: np.sqrt(4 * x**2 + 1) / (x + 3), -2.0),
    ("∞ − ∞: √(x² + x) − x", lambda x: x / (np.sqrt(x**2 + x) + x), 0.5),
]

print("Предел в точке: значения при a − 0.01, a − 0.0001, a + 0.0001, a + 0.01")
for name, f, a, L, _ in finite:
    vals = [f(a + d) for d in (-1e-2, -1e-4, 1e-4, 1e-2)]
    print(f"  {name:46} {', '.join(f'{v:.6f}' for v in vals)}  → {L}")
    assert all(abs(v - L) < 0.02 for v in vals) and abs(vals[1] - L) < 1e-3 and abs(vals[2] - L) < 1e-3

print("Предел на бесконечности: значения при |x| = 10, 1000, 10⁵")
for name, f, L in infinite:
    sign = -1 if L < 0 else 1
    vals = [f(sign * t) for t in (10.0, 1e3, 1e5)]
    print(f"  {name:46} {', '.join(f'{v:.6f}' for v in vals)}  → {L}")
    assert abs(vals[-1] - L) < 1e-3

# Слишком близко подходить нельзя: у двойного корня вычитание почти равных чисел портит ответ
f6 = finite[0][1]
print(f"Ловушка округления: дробь с двойным корнем при x = 1 + 1e−7 даёт {f6(1 + 1e-7):.6f} вместо 1.5")

fig, axes = plt.subplots(2, 3, figsize=(14, 7.5))
for ax, (name, f, a, L, dom) in zip(axes[0], finite):
    x = np.linspace(*dom, 2001)
    x = x[np.abs(x - a) > 1e-9]
    y = f(x)
    y[np.abs(y) > 8] = np.nan
    ax.plot(x, y, color=BLUE, lw=2.2)
    ax.plot([a], [L], "o", mfc="white", mec=BLUE, ms=8)
    ax.axhline(L, color=ORANGE, ls="--", lw=1)
    ax.set(title=name, xlabel="x", ylim=(L - 2, L + 2))
for ax, (name, f, L) in zip(axes[1], infinite):
    t = np.logspace(0.8, 4, 400)  # левее x = −3 у второй функции полюс
    sign = -1 if L < 0 else 1
    ax.semilogx(t, f(sign * t), color=BLUE, lw=2.2)
    ax.axhline(L, color=ORANGE, ls="--", lw=1.2)
    ax.set(title=name, xlabel="|x| (лог. шкала)")
for ax in axes.flat:
    ax.title.set_fontsize(9)
plt.tight_layout()
ex.finish(fig, "limit_techniques")
