"""Итерации aₙ₊₁ = g(aₙ) и лестница Ламерея: сходимость, цикл, хаос.

Если предел L есть и g непрерывна, то L = g(L) — неподвижная точка. Метод Герона для √2 сходится
квадратично (число верных знаков удваивается), итерация cos — линейно (ошибка уменьшается примерно
в 1/|g′(L)| ≈ 1.48 раза за шаг), а логистическое правило при r = 3.2 выходит на цикл, хотя
уравнение L = g(L) имеет решение. Удвоение aₙ₊₁ = 2aₙ — ловушка: «L = 2L ⇒ L = 0», но члены → ∞.

Запуск:  python lessons/lesson_15_3/examples/iterations_cobweb.py [--save] [--no-show]
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)


def iterate(g, a0: float, n: int) -> list[float]:
    out = [a0]
    for _ in range(n):
        out.append(g(out[-1]))
    return out


# 1. Герон: квадратичная сходимость
heron = iterate(lambda a: (a + 2 / a) / 2, 1.0, 5)
err = [abs(a - math.sqrt(2)) for a in heron]
print("Герон:", ", ".join(f"{a:.12f}" for a in heron[1:5]))
print("  ошибки:", ", ".join(f"{e:.1e}" for e in err[1:5]))
assert err[2] < 0.003 and err[3] < 3e-6 and err[4] < 2e-12   # 0.0025, 2.1e−6, 1.6e−12: знаки удваиваются

# 2. cos: линейная сходимость к 0.739085
L = 0.7390851332151607
seq = iterate(math.cos, 1.0, 60)
k = next(i for i, a in enumerate(seq) if abs(a - L) < 0.5e-6)
ratio = abs(seq[41] - L) / abs(seq[40] - L)
print(f"cos: шесть верных знаков после {k} шагов; отношение соседних ошибок ≈ {ratio:.3f} (|g′(L)| = sin L = {math.sin(L):.3f})")
assert k == 34 and abs(ratio - math.sin(L)) < 0.01

# 3. Логистическое правило: сходимость, цикл, хаос
for r in (2.8, 3.2, 3.9):
    tail = iterate(lambda a, r=r: r * a * (1 - a), 0.2, 1004)[-4:]
    print(f"r = {r}: хвост {np.round(tail, 4)}, кандидат L = 1 − 1/r = {1 - 1 / r:.4f}")
    if r == 2.8:
        assert all(abs(t - (1 - 1 / r)) < 1e-9 for t in tail)
    if r == 3.2:
        assert abs(tail[0] - tail[2]) < 1e-9 and abs(tail[0] - tail[1]) > 0.2   # цикл длины 2

# 4. Ловушка удвоения
dbl = iterate(lambda a: 2 * a, 0.05, 20)
print(f"удвоение: a₂₁ = {dbl[-1]:,.0f} — «решение» L = 2L ⇒ L = 0 неверно: предела нет")
assert dbl[-1] > 1e4

fig, axes = plt.subplots(1, 4, figsize=(16, 4))
for ax, (title, g, a0, steps, dom) in zip(axes, [
    ("Герон → √2", lambda a: (a + 2 / a) / 2, 1.0, 5, (0.5, 2.6)),
    ("cos → 0.739", np.cos, 1.0, 25, (-0.1, 1.6)),
    ("r = 3.2: цикл", lambda a: 3.2 * a * (1 - a), 0.2, 60, (0, 1)),
    ("r = 3.9: хаос", lambda a: 3.9 * a * (1 - a), 0.2, 80, (0, 1)),
]):
    x = np.linspace(*dom, 400)
    ax.plot(x, g(x), color=BLUE, lw=2.2)
    ax.plot(dom, dom, color=MUTED, ls="--")
    a = a0
    for _ in range(steps):
        b = g(a)
        ax.plot([a, a, b], [a, b, b], color=ORANGE, lw=1.1)
        a = b
    ax.set(xlim=dom, ylim=dom, title=title, xlabel="aₙ", ylabel="aₙ₊₁")
plt.tight_layout()
ex.finish(fig, "iterations_cobweb")
