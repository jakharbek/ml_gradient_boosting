"""Несобственные интегралы и «нарезать и сложить»: p-интегралы, сравнение, Джини, объёмы, длины.

Запуск:  python lessons/lesson_15_9/examples/improper_and_geometry.py [--save] [--no-show]

1) ∫₁^∞ x⁻ᵖ сходится при p > 1, ∫₀¹ x⁻ᵖ — при p < 1; хвост и особенность для p = 0.5, 1, 1.5, 2.
2) Признак сравнения: 1/(x² + x) ≤ 1/x² (ответ ln 2), e^(−x²) ≤ e^(−x) (ответ √π/2).
3) Площадь между кривыми и коэффициент Джини кривой Лоренца pᵏ.
4) Объём конуса и шара дисками, длина параболы ломаной, работа пружины.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import math

import matplotlib.pyplot as plt
import numpy as np
from scipy import integrate

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)

# 1. p-интегралы
for p in (0.5, 1.0, 1.5, 2.0):
    tail = [(T ** (1 - p) - 1) / (1 - p) if p != 1 else math.log(T) for T in (1e2, 1e4, 1e8)]
    zero = [(1 - e ** (1 - p)) / (1 - p) if p != 1 else -math.log(e) for e in (1e-2, 1e-4, 1e-8)]
    print(f"1) p = {p}: ∫₁ᵀ при T = 10², 10⁴, 10⁸: {[round(v, 3) for v in tail]};  ∫_ε¹ при ε = 10⁻², 10⁻⁴, 10⁻⁸: {[round(v, 3) for v in zero]}")
assert abs(integrate.quad(lambda x: x**-1.5, 1, np.inf)[0] - 2) < 1e-8
assert abs(integrate.quad(lambda x: x**-0.5, 0, 1)[0] - 2) < 1e-8

# 2. Сравнение
c1 = integrate.quad(lambda x: 1 / (x**2 + x), 1, np.inf)[0]
c2 = integrate.quad(lambda x: np.exp(-x**2), 0, np.inf)[0]
print(f"2) ∫₁^∞ dx/(x² + x) = {c1:.10f} (ln 2 = {math.log(2):.10f}); ∫₀^∞ e^(−x²) = {c2:.10f} (√π/2 = {math.sqrt(math.pi) / 2:.10f})")
assert abs(c1 - math.log(2)) < 1e-9 and abs(c2 - math.sqrt(math.pi) / 2) < 1e-9

# 3. Между кривыми и Джини
areas = {
    "x и x²": integrate.quad(lambda x: x - x**2, 0, 1)[0],
    "x + 2 и x²": integrate.quad(lambda x: x + 2 - x**2, -1, 2)[0],
    "|sin − cos| на [0, π]": integrate.quad(lambda x: abs(np.sin(x) - np.cos(x)), 0, math.pi, points=[math.pi / 4])[0],
}
print("3)", {k: round(v, 6) for k, v in areas.items()})
assert abs(areas["x и x²"] - 1 / 6) < 1e-12 and abs(areas["x + 2 и x²"] - 4.5) < 1e-12 and abs(areas["|sin − cos| на [0, π]"] - 2 * math.sqrt(2)) < 1e-9
for k in (2, 3, 5):
    G = 1 - 2 * integrate.quad(lambda p, k=k: p**k, 0, 1)[0]
    print(f"   Лоренц p^{k}: Джини {G:.4f}")
    assert abs(G - (k - 1) / (k + 1)) < 1e-12

# 4. Объёмы, длина, работа
for name, f, a, b, V in [("конус", lambda x: x / 2, 0, 4, 16 * math.pi / 3), ("шар", lambda x: np.sqrt(4 - x**2), -2, 2, 32 * math.pi / 3)]:
    for n in (8, 64, 1000):
        h = (b - a) / n
        xm = a + (np.arange(n) + 0.5) * h
        print(f"4) {name}: {n:4d} дисков → {np.sum(np.pi * f(xm) ** 2) * h:.4f} (формула {V:.4f})")
    assert abs(np.sum(np.pi * f(xm) ** 2) * h - V) < 1e-3
x = np.linspace(0, 1, 1001)
L = np.sum(np.hypot(np.diff(x), np.diff(x**2)))
L_exact = math.sqrt(5) / 2 + math.log(2 + math.sqrt(5)) / 4
print(f"   длина параболы ломаной из 1000 звеньев {L:.7f}, точно {L_exact:.7f}; работа пружины ∫₀^0.1 100x dx = {integrate.quad(lambda s: 100 * s, 0, 0.1)[0]:.3f} Дж")
assert abs(L - L_exact) < 1e-6

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
T = np.logspace(0.2, 4, 200)
for p, c in [(0.5, ORANGE), (1.0, MUTED), (1.5, BLUE), (2.0, "black")]:
    a1.semilogx(T, (T ** (1 - p) - 1) / (1 - p) if p != 1 else np.log(T), color=c, lw=2, label=f"p = {p}")
a1.set(title="∫₁ᵀ x⁻ᵖ dx: сходится только при p > 1", xlabel="T", ylim=(0, 12))
a1.legend()
pp = np.linspace(0, 1, 200)
a2.plot([0, 1], [0, 1], "--", color=MUTED, label="полное равенство")
for k, c in [(2, BLUE), (5, ORANGE)]:
    a2.plot(pp, pp**k, color=c, lw=2, label=f"L = p{'²' if k == 2 else '⁵'}, Джини {(k - 1) / (k + 1):.2f}")
a2.fill_between(pp, pp**5, pp, color=ORANGE, alpha=0.15)
a2.set(title="Кривая Лоренца и коэффициент Джини", xlabel="доля людей", ylabel="доля дохода", aspect="equal")
a2.legend()
ex.finish(fig, "improper_and_geometry")
