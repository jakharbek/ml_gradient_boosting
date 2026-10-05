"""Решения упражнений урока 15.10.

Запуск:  python lessons/lesson_15_10/exercises/solutions.py
"""

import math
import sys
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from scipy import integrate, special

from gbcourse import datasets
from gbcourse.boosting import GBRegressor

# 1. Геометрические ряды
S = np.cumsum([3 * (1 / 3) ** k for k in range(30)])
s2 = sum((2**k + 3**k) / 6**k for k in range(1, 80))
print(f"1) 3/(1 − 1/3) = {Fraction(3) / (1 - Fraction(1, 3))}; S₅ = {S[4]:.4f}, S₃₀ = {S[29]:.6f}")
print(f"   Σ (2ᵏ + 3ᵏ)/6ᵏ = Σ 1/3ᵏ + Σ 1/2ᵏ = 1/2 + 1 = 1.5; численно {s2:.10f}")
assert abs(S[29] - 4.5) < 1e-9 and abs(s2 - 1.5) < 1e-12

# 2. Бустинг одного числа
for nu in (0.3, 0.1):
    left10 = (1 - nu) ** 10
    steps = math.ceil(math.log(0.01) / math.log(1 - nu))
    print(f"2) ν = {nu}: после 10 шагов осталось {left10:.4f} ({100 * left10:.1f} %); меньше 1 % — с {steps} шагов (≈ ln 100/ν = {math.log(100) / nu:.1f})")
    assert (1 - nu) ** steps < 0.01 <= (1 - nu) ** (steps - 1)


# 3. Периодические дроби
def periodic(pre: str, per: str) -> Fraction:
    m, p = len(pre), len(per)
    return Fraction(int(pre or 0), 10**m) + Fraction(int(per), 10**m * (10**p - 1))


a, b = periodic("", "27"), periodic("4", "16")
print(f"3) 0.(27) = 27/99 = {a} = {float(a):.10f};  0.4(16) = 4/10 + 16/990 = {b} = {float(b):.10f}")
assert a == Fraction(3, 11) and b == Fraction(206, 495)

# 4. Телескоп
t1 = sum(1 / (k * k + 3 * k + 2) for k in range(1, 10**6))
t2 = sum(1 / (4 * k * k - 1) for k in range(1, 10**6))
print("4) 1/((k+1)(k+2)) = 1/(k+1) − 1/(k+2) ⇒ сумма 1/2; численно", round(t1, 6))
print("   1/(4k² − 1) = ½(1/(2k − 1) − 1/(2k + 1)) ⇒ сумма 1/2; численно", round(t2, 6))
assert abs(t1 - 0.5) < 1e-5 and abs(t2 - 0.5) < 1e-6

# 5. Гармонический ряд
s, n = 0.0, 0
while s <= 10:
    n += 1
    s += 1 / n
est = math.exp(10 - np.euler_gamma)
print(f"5) сумма превышает 10 при n = {n}; e^(10 − γ) ≈ {est:.2f}; H_(n−1) = {s - 1 / n:.6f}")
print("   ln n + γ + 1/(2n) при n = 12367:", round(math.log(12367) + np.euler_gamma + 1 / (2 * 12367), 6), "— ошибка приближения ~1/(12n²)")
assert n == 12367

# 6. Сравнение и интегральный признак
k = np.arange(1, 10**6 + 1, dtype=float)
print("6) √n/(n² + 1) ~ 1/n^1.5 — сходится; S_10⁶ =", round(float(np.sum(np.sqrt(k) / (k**2 + 1))), 4))
print("   1/√(n² + n) ~ 1/n — расходится; S_10³, S_10⁶ =", round(float(np.sum(1 / np.sqrt(k[:1000] ** 2 + k[:1000]))), 3), round(float(np.sum(1 / np.sqrt(k**2 + k))), 3))
print("   ln n/n² ≤ C/n^1.5 — сходится (интегральный признак: ∫ ln x/x² dx = (1 + ln x)/x); S_10⁶ =", round(float(np.sum(np.log(k) / k**2)), 4), "; −ζ′(2) ≈ 0.9375")
print("   1/(n·n^(1/n)) ~ 1/n, так как n^(1/n) → 1 — расходится")
S10 = float(np.sum(1 / k[:10] ** 3))
est3 = S10 + 1 / (2 * 10.5**2)
print(f"   Σ 1/k³: S₁₀ = {S10:.6f}, S₁₀ + ∫ от 10.5 = {est3:.7f}, ζ(3) = {special.zeta(3):.7f} (ошибка {abs(est3 - special.zeta(3)):.1e})")
assert abs(est3 - special.zeta(3)) < 1e-4

# 7. Признак отношения
print("7) n²/2ⁿ: ((n + 1)/n)²/2 → 1/2; сумма", sum(j * j / 2**j for j in range(1, 300)), "(точно 6)")
print("   3ⁿ/n!: 3/(n + 1) → 0; сумма", sum(3**j / math.factorial(j) for j in range(1, 80)), "= e³ − 1 =", math.e**3 - 1)
print("   n!/nⁿ: (n/(n + 1))ⁿ → 1/e; сумма", sum(math.exp(special.gammaln(j + 1) - j * math.log(j)) for j in range(1, 300)))
assert abs(sum(3**j / math.factorial(j) for j in range(1, 80)) - (math.e**3 - 1)) < 1e-10

# 8. Знакочередующиеся ряды
n_sq = next(m for m in range(1, 10**6) if 1 / (m + 1) ** 2 < 1e-4)
n_h = next(m for m in range(1, 10**6) if 1 / (m + 1) < 1e-4)
alt2 = np.cumsum([(-1) ** (j + 1) / j**2 for j in range(1, n_sq + 2)])
alt1 = np.cumsum([(-1) ** (j + 1) / j for j in range(1, n_h + 2)])
print(f"8) Σ(−1)ᵏ⁺¹/k²: гарантия при n ≥ {n_sq}; ошибка {abs(alt2[n_sq - 1] - math.pi**2 / 12):.1e}, среднее {abs((alt2[n_sq - 1] + alt2[n_sq]) / 2 - math.pi**2 / 12):.1e}")
print(f"   Σ(−1)ᵏ⁺¹/k: гарантия при n ≥ {n_h}; ошибка {abs(alt1[n_h - 1] - math.log(2)):.1e}, среднее {abs((alt1[n_h - 1] + alt1[n_h]) / 2 - math.log(2)):.1e}")
assert n_sq == 100 and n_h == 10000

# 9. Радиус и интервал
print("9) Σ (x − 2)ᵏ/(k·2ᵏ): R = 2, интервал [0, 4) — при x = 0 знакочередующийся (сходится), при x = 4 гармонический")
lck = lambda j: special.gammaln(j + 1) - j * math.log(j)  # noqa: E731  ln c_k
print(f"   Σ k!/kᵏ·xᵏ: c_k/c_(k+1) = (1 + 1/k)ᵏ → e; при k = 1000: {math.exp(lck(1000) - lck(1001)):.5f}; R = e (на концах члены ~ √(2πk) — расходится)")
x = 1.5
print(f"   Σ x²ᵏ/4ᵏ = Σ (x²/4)ᵏ = 4/(4 − x²) при |x| < 2; x = 1.5: {sum((x * x / 4) ** j for j in range(200)):.6f} = {4 / (4 - x * x):.6f}; при x = ±2 члены = 1 — расходится")
assert abs(math.exp(lck(1000) - lck(1001)) - math.e) < 2e-3


# 10. Перестановка
def rearranged(p, q, blocks=200000, pw=1):
    s_, i, j = 0.0, 0, 0
    for _ in range(blocks):
        for _ in range(p):
            s_ += 1 / (2 * i + 1) ** pw
            i += 1
        for _ in range(q):
            s_ -= 1 / (2 * j + 2) ** pw
            j += 1
    return s_


r1 = rearranged(2, 1)
r2 = rearranged(2, 1, 100000, pw=2)
print(f"10) два плюс, один минус: {r1:.5f}; (3/2) ln 2 = {1.5 * math.log(2):.5f}")
print(f"    для ±1/k² та же перестановка: {r2:.6f} = π²/12 = {math.pi**2 / 12:.6f} — ряд сходится абсолютно")
assert abs(r1 - 1.5 * math.log(2)) < 1e-4 and abs(r2 - math.pi**2 / 12) < 1e-5

# 11. Фурье и Парсеваль
for kk in (1, 2, 3, 10):
    bk = integrate.quad(lambda t, kk=kk: t * math.sin(kk * t), -math.pi, math.pi, limit=200)[0] / math.pi
    print(f"11) b_{kk} = {bk:+.6f}, формула 2(−1)^(k+1)/k = {2 * (-1) ** (kk + 1) / kk:+.6f}")
lhs = 2 * math.pi**2 / 3  # (1/π)∫ x² dx
odd4 = (lhs - math.pi**2 / 2) * math.pi**2 / 16  # Σ по нечётным 1/k⁴
all4 = odd4 * 16 / 15  # Σ по всем = (1 + 1/16 + 1/256 + …) × Σ по нечётным
print(f"    треугольник: Σ_нечёт 1/k⁴ = π⁴/96 = {odd4:.8f}; Σ 1/k⁴ = {all4:.8f}, π⁴/90 = {math.pi**4 / 90:.8f}, численно {np.sum(1 / k**4):.8f}")
assert abs(all4 - math.pi**4 / 90) < 1e-12

# 12. Бустинг и экспоненциальное среднее
X, y = datasets.regression_1d(kind="wave", n=160, noise=0.45, seed=11)
Xtr, Xte, ytr, yte = datasets.train_test_split(X, y, test_size=0.5, seed=3)
for nu in (0.05, 0.2):
    M = math.ceil(12 / nu)
    model = GBRegressor(n_estimators=M, learning_rate=nu, max_depth=2).fit(Xtr, ytr)
    te = [np.mean((yte - model.init_) ** 2)] + [np.mean((yte - F) ** 2) for F in model.staged_predict_raw(Xte)]
    best = int(np.argmin(te))
    print(f"12а) ν = {nu}: лучшее M = {best}, ν·M = {nu * best:.2f}, MSE = {te[best]:.4f}")
    assert 3.5 <= nu * best <= 6
beta, m = 0.9, 0.0
for g in (1, 2, 3):
    m = beta * m + (1 - beta) * g
print(f"12б) m₃ = {m:.4f} (веса 0.081, 0.09, 0.1 — сумма 0.271), m₃/(1 − β³) = {m / (1 - beta**3):.4f}: сумма весов 1 − β³ = 0.271, без поправки оценка занижена почти вчетверо")
assert abs(m - 0.561) < 1e-12
