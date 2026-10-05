"""Решения упражнений урока 15.3.

Запуск:  python lessons/lesson_15_3/exercises/solutions.py
"""

import math
import sys

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")


def first_N(dev, eps, n_max=10**6):
    """Наименьший номер N, начиная с которого отклонение dev(n) < eps (проверка до n_max)."""
    n = np.arange(1, n_max + 1, dtype=float)
    bad = np.nonzero(dev(n) >= eps)[0]
    return int(bad.max()) + 2 if len(bad) else 1


# 1
print("1) Дырки:")
for name, f, a, L in [
    ("(x² − 9)/(x − 3) = x + 3", lambda x: (x**2 - 9) / (x - 3), 3, 6),
    ("(x² + 5x + 6)/(x + 2) = x + 3", lambda x: (x**2 + 5 * x + 6) / (x + 2), -2, 1),
    ("(x³ − 1)/(x − 1) = x² + x + 1", lambda x: (x**3 - 1) / (x - 1), 1, 3),
]:
    vals = [f(a + d) for d in (-0.1, -0.01, -0.001, 0.001, 0.01, 0.1)]
    print(f"   {name:30} → {L};  таблица {np.round(vals, 4)}")
    assert all(abs(v - L) < 0.35 for v in vals) and abs(f(a + 0.001) - L) < 0.004

# 2
print("2) Номер N(ε):")
for eps in (0.1, 0.01, 0.001):
    Na = math.floor(1 / eps) + 1                     # |(n+1)/n − 1| = 1/n < ε ⇔ n > 1/ε
    Nb = max(1, math.floor(7 / eps - 2) + 1)         # |(3n−1)/(n+2) − 3| = 7/(n+2) < ε ⇔ n > 7/ε − 2
    assert Na == first_N(lambda n: 1 / n, eps) and Nb == first_N(lambda n: 7 / (n + 2), eps)
    print(f"   ε = {eps}: (n+1)/n → 1, N = {Na};  (3n−1)/(n+2) → 3, N = {Nb}")

# 3
print("3) Геометрическая прогрессия:")
print(f"   0.8^n → 0, (−1.2)^n — нет предела ({(-1.2)**20:.1f}, {(-1.2)**21:.1f}), 5·0.5^n + 2 → 2 ({5 * 0.5**40 + 2})")
N08 = math.floor(math.log(0.01) / math.log(0.8)) + 1
assert 0.8**N08 < 0.01 <= 0.8 ** (N08 - 1)
print(f"   0.8^n < 0.01 начиная с n = {N08}")
for nu in (0.05, 0.1, 0.3):
    m = math.ceil(math.log(0.01) / math.log(1 - nu))
    assert (1 - nu) ** m < 0.01 <= (1 - nu) ** (m - 1)
    print(f"   ν = {nu}: остаток (1 − ν)^m < 1% после {m} шагов")

# 4
print("4) На бесконечности:")
f4 = lambda x: (3 * x**2 + x) / (x**2 + 1)  # noqa: E731
g4 = lambda x: (x**2 + 5 * x) / (2 * x**3 + 1)  # noqa: E731
print("   (3 + 1/x)/(1 + 1/x²) → 3:", [round(f4(x), 6) for x in (10, 100, 1000)])
print("   (1/x + 5/x²)/(2 + 1/x³) → 0:", [f"{g4(x):.2e}" for x in (10, 100, 1000)])
# |f − 3| = |x − 3|/(x² + 1): ищем порог X численно (дальше отклонение убывает)
xs = np.linspace(1, 1000, 1_000_000)
bad = xs[np.abs(f4(xs) - 3) >= 0.01]
print(f"   |f(x) − 3| < 0.01 при x > {bad.max():.2f}")
assert 96 < bad.max() < 97   # x² − 100x + 301 > 0 ⇔ x > 96.89

# 5
print("5) Односторонние пределы (слева, справа):")
with np.errstate(all="ignore"):
    for name, f, a in [("|x|/x в 0", lambda x: np.abs(x) / x, 0), ("e^(1/x) в 0", lambda x: np.exp(1 / x), 0),
                       ("⌊x⌋ в 2", np.floor, 2), ("1/(x − 2) в 2", lambda x: 1 / (x - 2), 2)]:
        print(f"   {name:15} {f(a - 1e-6):>10.4g} {f(a + 1e-6):>10.4g}")
print("   везде левый ≠ правый (−1/1, 0/+∞, 1/2, −∞/+∞) — пределов нет")

# 6
print("6) Асимптоты (2x² − 3)/(x + 1) = 2x − 2 − 1/(x + 1):")
f6 = lambda x: (2 * x**2 - 3) / (x + 1)  # noqa: E731
for x in (10, 100, 1000):
    gap = f6(x) - (2 * x - 2)
    print(f"   x = {x}: f − (2x − 2) = {gap:.6f} = −1/(x + 1) = {-1 / (x + 1):.6f}")
    assert abs(gap + 1 / (x + 1)) < 1e-9
print("   вертикальная x = −1, наклонная y = 2x − 2, горизонтальной нет")

# 7
print("7) Итерация a(n+1) = √(6 + a(n)):")
a, k, seq = 1.0, 1, [1.0]
while abs(a - 3) >= 1e-6:
    a, k = math.sqrt(6 + a), k + 1
    seq.append(a)
assert all(x < y < 3 for x, y in zip(seq, seq[1:]))
print(f"   растёт и < 3: {np.round(seq[:6], 5)}; L = √(6 + L) ⇒ L² − L − 6 = 0 ⇒ L = 3; точность 1e−6 при n = {k}")

# 8
print("8) Ряды:")
S = sum(3.0**-k for k in range(0, 60))
print(f"   1 + 1/3 + 1/9 + … = 1/(1 − 1/3) = 1.5; частичная сумма S_60 = {S}")
assert abs(S - 1.5) < 1e-12
for target in (5, 10):
    H, n = 0.0, 0
    while H <= target:
        n += 1
        H += 1 / n
    print(f"   гармоническая сумма > {target} при n = {n}; оценка ln n + 0.5772 = {math.log(n) + 0.5772:.4f}")

# 9
print("9) cos(1/x) в нуле:")
k = np.arange(1, 6)
print("   xₙ = 1/(2πn):    ", np.round(np.cos(2 * np.pi * k), 9), "→ 1")
print("   xₙ = 1/(2πn + π):", np.round(np.cos(2 * np.pi * k + np.pi), 9), "→ −1  ⇒ предела нет")
for w in (0.1, 0.01, 0.001):
    x = np.linspace(-w, w, 400001)
    x = x[x != 0]
    r1, r2 = np.ptp(np.cos(1 / x)), np.ptp(x * np.cos(1 / x))
    print(f"   окно ±{w}: размах cos(1/x) = {r1:.4f}, размах x·cos(1/x) = {r2:.6f}")
    assert r1 > 1.99 and r2 <= 2 * w
print("   |x·cos(1/x)| ≤ |x| → 0: предел 0")

# 10
print("10) |x² − 9| = |x − 3|·|x + 3|; при δ ≤ 1 имеем |x + 3| < 7, значит, δ = min(1, ε/7)")
for eps in (0.5, 0.05, 0.005):
    d = min(1, eps / 7)
    x = np.linspace(3 - d, 3 + d, 200001)
    x = x[x != 3]
    worst = np.max(np.abs(x**2 - 9))
    lo, hi = 0.0, 1.0                                     # наибольшее δ — бинарный поиск
    for _ in range(50):
        mid = (lo + hi) / 2
        xx = np.linspace(3 - mid, 3 + mid, 20001)
        lo, hi = (mid, hi) if np.all(np.abs(xx**2 - 9) < eps) else (lo, mid)
    print(f"    ε = {eps}: δ = {d:.5f}, худшее отклонение {worst:.5f} < ε: {worst < eps};  наибольшее δ ≈ {lo:.5f}")
    assert worst < eps and d <= lo

# 11
print("11) (1 − cos x)/x² → 1/2:")
for p in range(2, 11, 2):
    x = 10.0**-p
    naive = (1 - math.cos(x)) / x**2
    stable = 2 * math.sin(x / 2) ** 2 / x**2
    print(f"    x = 1e-{p:<2}: в лоб {naive:.10f}   устойчиво {stable:.10f}")
assert (1 - math.cos(1e-8)) / 1e-16 == 0.0 and abs(2 * math.sin(0.5e-8) ** 2 / 1e-16 - 0.5) < 1e-12
print("    при x ≲ 1e−8 cos x == 1 в float64 и разность обнуляется; формула 2·sin²(x/2)/x² вычитаний не содержит")
