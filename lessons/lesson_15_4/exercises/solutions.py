"""Решения упражнений урока 15.4 с численной проверкой.

Запуск:  python lessons/lesson_15_4/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))
sys.stdout.reconfigure(encoding="utf-8")

from gbcourse.rng import Mulberry32  # noqa: E402


def near(f, a, L, d=1e-6, tol=1e-4):
    """Значения f по обе стороны от a близки к L."""
    return abs(f(a - d) - L) < tol and abs(f(a + d) - L) < tol


# 1
f1 = lambda x: (x**2 - 16) / (x - 4)  # noqa: E731
f2 = lambda x: (x**3 + 1) / (x**2 - 1)  # noqa: E731
f3 = lambda x: (4 * x**2 - 1) / (2 * x**3 + x)  # noqa: E731
print("1) а) (x − 4)(x + 4)/(x − 4) = x + 4 → 8;", ", ".join(f"{f1(4 + d):.4f}" for d in (-0.01, 0.01)))
print("   б) (x + 1)(x² − x + 1)/((x − 1)(x + 1)) → 3/(−2) = −1.5;", ", ".join(f"{f2(-1 + d):.4f}" for d in (-0.01, 0.01)))
print("   в) степень знаменателя больше → 0;", ", ".join(f"{f3(t):.2e}" for t in (10, 1000)))
print("   г) знаменатель не ноль — подстановка: 5/5 = 1")
assert near(f1, 4, 8) and near(f2, -1, -1.5) and abs(f3(1e6)) < 1e-5

# 2
s1 = lambda x: math.sin(5 * x) / (2 * x)  # noqa: E731
s2 = lambda x: math.tan(3 * x) / math.sin(2 * x)  # noqa: E731
s3 = lambda x: (1 - math.cos(2 * x)) / (x * math.sin(x))  # noqa: E731
deg = lambda x: math.sin(math.radians(5 * x)) / (2 * x)  # noqa: E731
print(f"2) sin 5x / 2x → 5/2: {s1(1e-3):.6f};  tan 3x / sin 2x → 3/2: {s2(1e-3):.6f};  (1 − cos 2x)/(x sin x) = 2 sin x / x → 2: {s3(1e-3):.6f}")
print(f"   в градусах: sin(5x°)/(2x) → 5π/360 = {5 * math.pi / 360:.6f}; при x = 0.001: {deg(1e-3):.6f}")
assert near(s1, 0, 2.5) and near(s2, 0, 1.5) and near(s3, 0, 2, d=1e-4) and abs(deg(1e-4) - 5 * math.pi / 360) < 1e-8

# 3
c1 = lambda x: (math.sqrt(x + 4) - 2) / (math.sqrt(x + 1) - 1)  # noqa: E731
c2 = lambda x: (math.copysign(abs(x) ** (1 / 3), x) - 1) / (x - 1)  # noqa: E731
print(f"3) (√(x+4) − 2)/(√(x+1) − 1) = (√(x+1) + 1)/(√(x+4) + 2) → 2/4 = 1/2: {c1(1e-4):.6f};  (∛x − 1)/(x − 1) → 1/3: {c2(1.0001):.6f}")
assert near(c1, 0, 0.5, d=1e-4) and near(c2, 1, 1 / 3, d=1e-5)

# 4
d1 = lambda x: -6 * x / (math.sqrt(x * x - 6 * x) + x)  # сопряжённое: равно √(x² − 6x) − x  # noqa: E731
d2 = lambda x: math.log(3 * x * x + 1) - 2 * math.log(x)  # noqa: E731
d3 = lambda x: 1 / (x - 1) - 2 / (x * x - 1)  # noqa: E731
print(f"4) √(x² − 6x) − x → −6/2 = −3: x = 1000 → {math.sqrt(1e6 - 6e3) - 1000:.6f};  ln(3x² + 1) − 2 ln x = ln((3x² + 1)/x²) → ln 3 = {math.log(3):.6f}: {d2(1e4):.6f};  1/(x + 1) → 1/2: {d3(1.0001):.6f}")
assert abs(d1(1e8) + 3) < 1e-6 and abs(d2(1e6) - math.log(3)) < 1e-9 and near(d3, 1, 0.5, d=1e-5)

# 5
for name, u, v, L in [("(1 + 3/n)ⁿ", lambda n: 1 + 3 / n, lambda n: n, math.e**3), ("((n + 1)/(n − 1))ⁿ", lambda n: (n + 1) / (n - 1), lambda n: n, math.e**2),
                      ("(1 + 1/n²)ⁿ", lambda n: 1 + 1 / n**2, lambda n: n, 1.0)]:
    n = 10**6
    val = math.exp(v(n) * math.log(u(n)))
    print(f"5) {name:20}: v(u − 1) = {v(n) * (u(n) - 1):.6f}, uᵛ = {val:.6f}, предел {L:.6f}")
    assert abs(val - L) < 1e-4 * L
x = 1e-7
print(f"   (1 + 3x)^(1/x) при x = 1e−7: {(1 + 3 * x) ** (1 / x):.5f}, e³ = {math.e**3:.5f}. У (1 + 1/n²)ⁿ произведение v(u − 1) = 1/n → 0, отсюда e⁰ = 1")

# 6
e1 = lambda x: math.expm1(3 * x) / math.log1p(2 * x)  # noqa: E731
e2 = lambda x: (1 - math.cos(6 * x)) / (x * math.tan(x))  # noqa: E731
e3 = lambda x: (2**x - 1) / x  # noqa: E731
print(f"6) 3x/2x = 1.5: {e1(1e-5):.5f};  (6x)²/2 / x² = 18: {e2(1e-4):.5f};  ln 2 = {math.log(2):.6f}: {e3(1e-6):.6f}")
assert near(e1, 0, 1.5, d=1e-6) and near(e2, 0, 18, d=1e-4, tol=1e-3) and abs(e3(1e-7) - math.log(2)) < 1e-6

# 7
print("7) |x|/x: слева", abs(-1e-9) / -1e-9, "справа", abs(1e-9) / 1e-9, "→ скачок величины 2, неустранимый")
print(f"   sin 2x / x → 2 ({math.sin(2e-6) / 1e-6:.6f}) — устранимый, доопределить f(0) = 2")
print(f"   e^(1/x): слева {math.exp(-1 / 1e-3):.3g} → 0, справа e^1000 → +∞ — разрыв второго рода")
print(f"   x ln|x| → 0 ({1e-6 * math.log(1e-6):.2e}) — устранимый, доопределить f(0) = 0")

# 8
a = 1
print(f"8) а) 4 − a = 2a + 1 ⇒ a = 1; слева {2**2 - a}, справа {a * 2 + 1}")
assert 4 - a == 2 * a + 1
for delta in (0.5, 1.0, 2.0):
    c = delta / 2
    quad, lin = delta**2 / 2, delta * (delta - c)
    print(f"   б) δ = {delta}: c = δ/2 = {c}; в стыке {quad} и {lin}; наклоны слева r = δ = {delta}, справа δ = {delta}")
    assert abs(quad - lin) < 1e-12

# 9
f = lambda t: math.cos(t) - t  # noqa: E731
lo, hi, steps = 0.0, 1.0, 0
while hi - lo > 1e-8:
    mid = (lo + hi) / 2
    lo, hi = (mid, hi) if f(mid) > 0 else (lo, mid)
    steps += 1
print(f"9) cos x = x при x ≈ {lo:.8f}; шагов {steps}: нужно 2⁻ᵏ < 10⁻⁸, k > 8·log₂10 ≈ {8 * math.log2(10):.2f}")
assert steps == 27 and abs(f(lo)) < 1e-7

# 10
t10 = lambda x: (x - math.sin(x)) / (x * (1 - math.cos(x)))  # noqa: E731
print("10) (x − sin x)/(x(1 − cos x)) → (x³/6)/(x³/2) = 1/3; таблица:", ", ".join(f"{t10(t):.6f}" for t in (0.1, 0.01, 0.001)), "| «наивно» (sin x → x) числитель 0 ⇒ ответ 0 — неверно")
assert abs(t10(1e-3) - 1 / 3) < 1e-5

# 11
print(f"11) а) x² ln x при x = 1e−4: {1e-8 * math.log(1e-4):.2e} → 0;  (ln x)³/√x при x = 1e12: {math.log(1e12) ** 3 / 1e6:.4f}, при 1e20: {math.log(1e20) ** 3 / 1e10:.2e} → 0")
lo, hi = 5.0, 20.0  # s = ln x; ищем 100 s = e^s · ln 1.01
g = lambda s: 100 * s - math.exp(s) * math.log(1.01)  # noqa: E731
for _ in range(100):
    mid = (lo + hi) / 2
    lo, hi = (mid, hi) if g(mid) > 0 else (lo, mid)
x_cross = math.exp(lo)
print(f"    б) lg x¹⁰⁰ = lg 1.01ˣ при x ≈ {x_cross:,.0f}; дальше 1.01ˣ впереди навсегда")
assert 117000 < x_cross < 117500

# 12
n, trees = 1000, 500
expected = trees * (1 - 1 / n) ** n
rng = Mulberry32(12)
missed = 0
for _ in range(trees):
    if all(rng.randint(n) != 0 for _ in range(n)):
        missed += 1
print(f"12) в среднем {expected:.1f} деревьев из {trees} не видели объект (вероятность (1 − 1/n)ⁿ = {(1 - 1 / n) ** n:.4f} ≈ 1/e); моделирование: {missed}")
assert abs(missed - expected) < 40
