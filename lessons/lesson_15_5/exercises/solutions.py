"""Решения упражнений урока 15.5 с численной проверкой.

Запуск:  python lessons/lesson_15_5/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np  # noqa: E402

from gbcourse.rng import Mulberry32  # noqa: E402


def d(f, x, h=1e-5):
    """Центральная разность."""
    return (f(x + h) - f(x - h)) / (2 * h)


# 1. По определению
f = lambda x: 5 * x**2 - 3  # noqa: E731
q = (f(2.1) - f(2)) / 0.1
print("1) а) Δf = 3h, отношение 3 → (3x + 2)′ = 3")
print(f"   б) Δf = 5(2 + h)² − 3 − 17 = 20h + 5h², отношение 20 + 5h; при h = 0.1: {q:.4f} → f′(2) = 20")
print("   в) 1/(x + h + 1) − 1/(x + 1) = −h/((x + 1)(x + h + 1)) → −1/(x + 1)²")
assert abs(q - 20.5) < 1e-9 and abs(d(f, 2) - 20) < 1e-6
assert abs(d(lambda x: 1 / (x + 1), 0.5) + 1 / 1.5**2) < 1e-8

# 2. Температура
T = lambda t: 10 + 3 * t - 0.25 * t**2  # noqa: E731
print(f"2) T′(t) = 3 − 0.5t, T′(4) = {d(T, 4):.4f} °C/ч > 0 — теплеет примерно на градус в час;")
print(f"   T′ = 0 при t = 6 (в 18:00), T(6) = {T(6):.1f} °C — дальше холодает")
assert abs(d(T, 4) - 1) < 1e-8 and abs(T(6) - 19) < 1e-12

# 3. Касательная к x³ в 1
k = 3.0
print(f"3) касательная y = 1 + 3(x − 1) = 3x − 2; нормаль y = 1 − (x − 1)/3 = −x/3 + 4/3; угол {math.degrees(math.atan(k)):.2f}°")
assert abs(d(lambda x: x**3, 1) - 3) < 1e-8

# 4. Касательные с условием
print("4) а) 2a = 4, a = 2: касательная y = 4x − 4")
for a in np.roots([1, -2, -3]):
    line = lambda x, a=a: a**2 + 2 * a * (x - a)  # noqa: E731
    print(f"   б) a = {a:+.0f}: y = {2 * a:+.0f}x {-(a**2):+.0f}, значение в x = 1: {line(1):.0f}")
    assert abs(line(1) + 3) < 1e-9

# 5. Линейные приближения
for name, g, d1, d2, a, delta in [("√25.3", math.sqrt, 0.1, -1 / 500, 25, 0.3), ("ln 0.98", math.log, 1, -1, 1, -0.02),
                                  ("e^−0.05", math.exp, 1, 1, 0, -0.05)]:
    approx = g(a) + d1 * delta
    err, est = approx - g(a + delta), 0.5 * abs(d2) * delta**2
    print(f"5) {name:8}: приближение {approx:.5f}, точно {g(a + delta):.6f}, ошибка {err:+.2e}, оценка ½|f″|Δ² = {est:.2e}")
    assert abs(abs(err) - est) / est < 0.1

# 6. Односторонние производные и склейка
g6 = lambda x: abs(x**2 - 4)  # noqa: E731
h = 1e-7
left, right = (g6(2) - g6(2 - h)) / h, (g6(2 + h) - g6(2)) / h
print(f"6) а) f′₋(2) = {left:.4f}, f′₊(2) = {right:.4f} — излом")
print("   б) непрерывность 4 = 2k + b, наклоны 4 = k → k = 4, b = −4")
assert abs(left + 4) < 1e-4 and abs(right - 4) < 1e-4
glue = lambda x: x**2 if x < 2 else 4 * x - 4  # noqa: E731
assert abs((glue(2) - glue(2 - h)) / h - (glue(2 + h) - glue(2)) / h) < 1e-4

# 7. x²e⁻ˣ на [0, 5]
f7 = lambda x: x**2 * np.exp(-x)  # noqa: E731
cands = {0: f7(0), 2: f7(2), 5: f7(5)}
print("7) кандидаты:", {k_: round(float(v), 4) for k_, v in cands.items()}, "→ max 4/e² ≈ 0.5413 при x = 2, min 0 при x = 0")
xx = np.linspace(0, 5, 500001)
assert abs(f7(xx).max() - 4 * math.exp(-2)) < 1e-9 and f7(xx).min() == 0

# 8. Лагранж
k8 = ((9 - 6) - 0) / 3
print(f"8) а) наклон секущей {k8:.0f}, 2c − 2 = 1 → c = 1.5")
rng = Mulberry32(15)
pairs = [(rng.uniform(-10, 10), rng.uniform(-10, 10)) for _ in range(10000)]
worst = max(abs(math.cos(a) - math.cos(b)) / abs(a - b) for a, b in pairs if a != b)
print(f"   б) |cos a − cos b| = |sin c|·|a − b| ≤ |a − b|; наибольшее отношение на 10 000 парах: {worst:.4f}")
assert worst <= 1

# 9. Арктангенс
print("9) y = tg x, (arctg y)′ = 1/(1 + tg²x) = 1/(1 + y²)")
for yv in (0, 1, 3):
    print(f"   y = {yv}: численно {d(math.atan, yv):.6f}, формула {1 / (1 + yv**2):.6f}")
    assert abs(d(math.atan, yv) - 1 / (1 + yv**2)) < 1e-8

# 10. Лучший шаг для eˣ в нуле
errs = []
for k_ in range(1, 16):
    hh = 10.0**-k_
    errs.append((k_, abs((math.exp(hh) - 1) / hh - 1), abs((math.exp(hh) - math.exp(-hh)) / (2 * hh) - 1)))
bf = min(errs, key=lambda e: e[1])
bc = min(errs, key=lambda e: e[2])
print(f"10) вперёд: лучший h = 1e-{bf[0]} (ошибка {bf[1]:.1e}); центральная: лучший h = 1e-{bc[0]} (ошибка {bc[2]:.1e})")
print("    меньше h — больше ошибка округления: разность почти равных чисел делится на крошечное h")
assert 7 <= bf[0] <= 9 and 4 <= bc[0] <= 6

# 11. Темп для 3θ² (a = 6)
print("11) f′ = 6θ, θ ← (1 − 6η)θ: сходимость при 0 < η < 1/3, за один шаг при η = 1/6; η = 0.3 → q = −0.8, зигзаг")
for eta in (0.1, 1 / 6, 0.3, 0.4):
    t = 1.0
    for _ in range(10):
        t -= eta * 6 * t
    print(f"    η = {eta:.4f}: θ₁₀ = {t:+.6f}")
    assert (abs(t) < 1) == (eta < 1 / 3)

# 12. Хьюбер: где 0 ∈ ∂L
y = np.array([2, 4, 3, 7, 9, 11], dtype=float)
cs = np.linspace(0, 12, 120001)
for delta in (1, 2):
    R = y[:, None] - cs
    Lc = np.mean(np.where(np.abs(R) <= delta, 0.5 * R**2, delta * (np.abs(R) - 0.5 * delta)), axis=0)
    best = cs[np.isclose(Lc, Lc.min(), rtol=0, atol=1e-9)]
    print(f"12) δ = {delta}: лучшие константы {best.min():.3f} … {best.max():.3f}")
print("    δ = 1: все |y − c| ≥ 1 на [5, 6] — потери ведут себя как MAE, полочка; δ = 2: единственная точка 5.5")

# 13. log-loss
y13 = np.array([0, 1, 1, 0, 1], dtype=float)
F0 = math.log(y13.mean() / (1 - y13.mean()))
p0 = 1 / (1 + math.exp(-F0))
r = y13 - p0
print(f"13) F₀ = ln(0.6/0.4) = {F0:.4f}, p₀ = {p0:.2f}, псевдо-остатки {np.round(r, 2)}, сумма {r.sum():.1e}")
print("    сумма равна нулю, потому что F₀ — лучшая константа: производная суммарных потерь по F₀ равна Σ(p₀ − y) = 0")
assert abs(r.sum()) < 1e-12
