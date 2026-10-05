"""Численное интегрирование: середины, трапеции, Симпсон, правило Рунге и метод Монте-Карло.

Запуск:  python lessons/lesson_15_9/examples/numeric_integration.py [--save] [--no-show]

1) ∫₀¹ eˣ dx: порядок точности 2, 2 и 4; сколько узлов нужно для 10⁻⁶.
2) Правило Рунге и экстраполяция Ричардсона; сверка со scipy.integrate.quad, trapezoid, simpson.
3) Когда порядки ломаются: √x (особенность) и периодическая e^(sin x) (трапеции сверхточны).
4) Монте-Карло: ошибка ~ σ/√n; в размерности 10 сетка проигрывает случайным точкам.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import math

import matplotlib.pyplot as plt
import numpy as np
from scipy import integrate, special

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, VIOLET

ex = Example(__file__)


def mid(f, a, b, n):
    h = (b - a) / n
    return float(np.sum(f(a + (np.arange(n) + 0.5) * h)) * h)


def trap(f, a, b, n):
    x = np.linspace(a, b, n + 1)
    y = f(x)
    return float((b - a) / n * (y.sum() - (y[0] + y[-1]) / 2))


def simp(f, a, b, n):
    x = np.linspace(a, b, n + 1)
    y = f(x)
    return float((b - a) / n / 3 * (y[0] + y[-1] + 4 * y[1:-1:2].sum() + 2 * y[2:-1:2].sum()))


exact = math.e - 1
ns = np.array([2, 4, 8, 16, 32, 64, 128])
errs = {name: np.array([abs(m(np.exp, 0, 1, n) - exact) for n in ns]) for name, m in [("середина", mid), ("трапеции", trap), ("Симпсон", simp)]}
for name, e in errs.items():
    p = np.log2(e[2] / e[3])
    print(f"1) {name:9}: n = 16 → {e[3]:.2e}, порядок {p:.3f}")
assert abs(np.log2(errs["трапеции"][2] / errs["трапеции"][3]) - 2) < 0.01 and abs(np.log2(errs["Симпсон"][2] / errs["Симпсон"][3]) - 4) < 0.02
need = {name: next(n for n in range(step, 5000, step) if abs(m(np.exp, 0, 1, n) - exact) < 1e-6) for name, m, step in [("трапеции", trap, 1), ("середины", mid, 1), ("Симпсон", simp, 2)]}
print("   узлов для 10⁻⁶:", need)
assert need == {"трапеции": 379, "середины": 268, "Симпсон": 10}

t8, t16 = trap(np.exp, 0, 1, 8), trap(np.exp, 0, 1, 16)
print(f"2) Рунге (T₁₆ − T₈)/3 = {(t16 - t8) / 3:+.4e}, ошибка T₁₆ = {t16 - exact:+.4e}; Ричардсон → {(4 * t16 - t8) / 3 - exact:+.2e} = ошибка Симпсона n = 16")
assert abs((4 * t16 - t8) / 3 - simp(np.exp, 0, 1, 16)) < 1e-14
x17 = np.linspace(0, 1, 17)
assert abs(integrate.trapezoid(np.exp(x17), x17) - t16) < 1e-14 and abs(integrate.simpson(np.exp(x17), x=x17) - simp(np.exp, 0, 1, 16)) < 1e-14
print("   scipy.integrate.quad:", integrate.quad(np.exp, 0, 1))

per_exact = 2 * math.pi * special.i0(1)
e_sqrt = [abs(trap(np.sqrt, 0, 1, n) - 2 / 3) for n in (32, 64)]
e_per = [abs(trap(lambda x: np.exp(np.sin(x)), 0, 2 * math.pi, n) - per_exact) for n in (4, 8, 16)]
print(f"3) √x: порядок трапеций {np.log2(e_sqrt[0] / e_sqrt[1]):.2f};  e^(sin x): ошибки при n = 4, 8, 16: {[f'{v:.1e}' for v in e_per]}")
assert 1.3 < np.log2(e_sqrt[0] / e_sqrt[1]) < 1.6 and e_per[2] < 1e-13

gen = np.random.default_rng(0)
n = 100_000
res = {}
for d in (1, 5, 10):
    k = int(round(n ** (1 / d)))
    if k**d > 1.5 * n:
        k -= 1
    grid = np.mean(np.pi / 2 * np.sin(np.pi * (np.arange(k) + 0.5) / k)) ** d
    mc = np.mean(np.prod(np.pi / 2 * np.sin(np.pi * gen.random((n, d))), axis=1))
    res[d] = (abs(grid - 1), abs(mc - 1))
    print(f"4) d = {d:2d}: сетка {k}^{d} — ошибка {res[d][0]:.1e}; Монте-Карло 10⁵ — ошибка {res[d][1]:.1e}")
assert res[10][1] < res[10][0] / 10

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
for (name, e), c in zip(errs.items(), [AQUA, BLUE, VIOLET]):
    a1.loglog(ns, e, "o-", color=c, label=name)
a1.set(title="∫₀¹ eˣ dx: ошибка трёх методов", xlabel="n")
a1.legend()
rng = np.random.default_rng(1)
xs, ys = rng.random(20000), rng.random(20000)
inside = (ys <= np.sqrt(1 - xs**2)).astype(float)
nn = np.unique(np.logspace(1, np.log10(20000), 60).astype(int))
a2.loglog(nn, [abs(4 * inside[:k].mean() - math.pi) + 1e-6 for k in nn], color=BLUE, label="Монте-Карло: |оценка π − π|")
a2.loglog(nn, 4 * np.sqrt(math.pi / 4 * (1 - math.pi / 4) / nn), "--", color=MUTED, label="σ/√n")
a2.set(title="Ошибка Монте-Карло ~ 1/√n", xlabel="n")
a2.legend()
ex.finish(fig, "numeric_integration")
