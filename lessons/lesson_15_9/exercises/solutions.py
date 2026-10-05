"""Решения упражнений урока 15.9.

Запуск:  python lessons/lesson_15_9/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from scipy import integrate, special
from sklearn.metrics import roc_auc_score

from gbcourse.rng import Mulberry32

quad = lambda f, a, b: integrate.quad(f, a, b)[0]  # noqa: E731

# 1. Два способа
F = lambda x: x**2 + x  # noqa: E731
print(f"1) F(3) − F(1) = {F(3) - F(1)}; трапеция: (3 + 7)/2 · 2 = {(3 + 7) / 2 * 2}")
assert F(3) - F(1) == 10

# 2. Путь машины
s = lambda t: 3 * t**2 - t**3 / 5  # noqa: E731
first, last = s(5) - s(0), s(10) - s(5)
print(f"2) первые 5 с: {first} м (средняя {first / 5} м/с); последние 5 с: {last} м (средняя {last / 5} м/с)")
print("   поровну: график скорости симметричен относительно t = 5")
assert first == last == 50

# 3. Знак суммы
k = np.arange(1, 201)
print(f"3) 1 + … + 200 = {k.sum()} = 200·201/2 = {200 * 201 // 2}; Σ k² (k ≤ 20) = {(k[:20] ** 2).sum()} = 20·21·41/6 = {20 * 21 * 41 // 6}")
print("   Σ (2k − 1) = n² (сумма первых n нечётных):", [int(np.sum(2 * np.arange(1, n + 1) - 1)) for n in range(1, 7)])
assert k.sum() == 20100 and (k[:20] ** 2).sum() == 2870

# 4. Предел сумм Римана
# S_n = (27/n³)·n(n + 1)(2n + 1)/6 = 9(1 + 1/n)(1 + 1/(2n)) → 9; ошибка ≈ 13.5/n + 4.5/n²
S = lambda n: 9 * (1 + 1 / n) * (1 + 1 / (2 * n))  # noqa: E731
n_min = next(n for n in range(1, 10000) if S(n) - 9 < 0.01)
direct = float(np.sum((np.arange(1, n_min + 1) * 3 / n_min) ** 2) * 3 / n_min)
print(f"4) S_n = 9(1 + 1/n)(1 + 1/(2n)) → 9; ошибка < 0.01 при n ≥ {n_min} (S = {S(n_min):.6f}, прямо {direct:.6f})")
assert n_min == 1351 and abs(direct - S(n_min)) < 1e-9

# 5. Переменные пределы
x0, e = 0.7, 1e-6
d1 = lambda x: math.sqrt(1 + math.sin(x) ** 2) * math.cos(x)  # noqa: E731
d2 = lambda x: 2 * math.exp(-4 * x * x) - math.exp(-x * x)  # noqa: E731
d3 = lambda x: -x * x  # noqa: E731
G1 = lambda x: quad(lambda t: np.sqrt(1 + t * t), 0, math.sin(x))  # noqa: E731
G2 = lambda x: quad(lambda t: np.exp(-t * t), x, 2 * x)  # noqa: E731
G3 = lambda x: quad(lambda t: t * t, x, 5)  # noqa: E731
for name, G, d in [("√(1 + sin²x)·cos x", G1, d1), ("2e^(−4x²) − e^(−x²)", G2, d2), ("−x²", G3, d3)]:
    num = (G(x0 + e) - G(x0 - e)) / (2 * e)
    print(f"5) {name:22}: формула {d(x0):.8f}, численно {num:.8f}")
    assert abs(num - d(x0)) < 1e-6

# 6. Замена и по частям
answers = [
    ("∫₀¹ x e^(x²) dx = (e − 1)/2", lambda x: x * np.exp(x * x), 0, 1, (math.e - 1) / 2, lambda x: np.exp(x * x) / 2),
    ("∫₁^e x ln x dx = (e² + 1)/4", lambda x: x * np.log(x), 1, math.e, (math.e**2 + 1) / 4, lambda x: x * x / 2 * np.log(x) - x * x / 4),
    ("∫₀^∞ x e^(−x) dx = 1", lambda x: x * np.exp(-x), 0, np.inf, 1.0, lambda x: -(x + 1) * np.exp(-x)),
]
for name, f, a, b, ans, Fp in answers:
    q = quad(f, a, b)
    xs = np.linspace(1.1, 2.5, 5)
    dF = np.max(np.abs((Fp(xs + 1e-6) - Fp(xs - 1e-6)) / 2e-6 - f(xs)))
    print(f"6) {name:30}: quad {q:.10f}, ответ {ans:.10f}, max |F′ − f| = {dF:.1e}")
    assert abs(q - ans) < 1e-9 and dF < 1e-6

# 7. Сколько частей нужно
exact = math.e - 1


def mid(n):
    return float(np.sum(np.exp((np.arange(n) + 0.5) / n)) / n)


def trap(n):
    y = np.exp(np.linspace(0, 1, n + 1))
    return float((y.sum() - (y[0] + y[-1]) / 2) / n)


def simp(n):
    y = np.exp(np.linspace(0, 1, n + 1))
    return float((y[0] + y[-1] + 4 * y[1:-1:2].sum() + 2 * y[2:-1:2].sum()) / n / 3)


n_m = next(n for n in range(1, 10000) if abs(mid(n) - exact) < 1e-6)
n_t = next(n for n in range(1, 10000) if abs(trap(n) - exact) < 1e-6)
n_s = next(n for n in range(2, 10000, 2) if abs(simp(n) - exact) < 1e-6)
runge = (trap(16) - trap(8)) / 3
print(f"7) середины n = {n_m}, трапеции n = {n_t}, Симпсон n = {n_s}; Рунге: |(T₁₆ − T₈)/3| = {abs(runge):.4e}, ошибка T₁₆ = {trap(16) - exact:.4e}")
assert (n_m, n_t, n_s) == (268, 379, 10) and abs(abs(runge) - (trap(16) - exact)) < 1e-6

# 8. Сходится или нет
print(f"8) ∫₁^∞ x^(−3/2) = {quad(lambda x: x**-1.5, 1, np.inf):.6f} (= 1/(p − 1) = 2); ∫₀¹ x^(−3/2) — расходится: ∫_ε¹ = 2/√ε − 2 =",
      [round(2 / math.sqrt(eps) - 2, 1) for eps in (1e-2, 1e-4, 1e-6)])
print(f"   ∫₀¹ x^(−1/2) = {quad(lambda x: x**-0.5, 0, 1):.6f} (= 1/(1 − p) = 2); ∫₁^∞ dx/(x² + x) = {quad(lambda x: 1 / (x * x + x), 1, np.inf):.6f} = ln 2")
assert abs(quad(lambda x: 1 / (x * x + x), 1, np.inf) - math.log(2)) < 1e-9

# 9. Бесконечная воронка
area = quad(lambda x: np.exp(-x), 0, np.inf)
vol = math.pi * quad(lambda x: np.exp(-2 * x), 0, np.inf)
print(f"9) площадь ∫₀^∞ e^(−x) = {area:.6f}; объём π∫₀^∞ e^(−2x) = π/2 = {vol:.6f} — оба конечны")
assert abs(area - 1) < 1e-9 and abs(vol - math.pi / 2) < 1e-9

# 10. Монте-Карло
gen = np.random.default_rng(0)
for n in (10**2, 10**3, 10**4, 10**5, 10**6):
    x, y = gen.random(n), gen.random(n)
    print(f"10) n = {n:7d}: π ≈ {4 * np.mean(x * x + y * y <= 1):.5f}")
sd = {}
for n in (100, 10_000):
    est = [4 * np.mean(np.sum(gen.random((n, 2)) ** 2, axis=1) <= 1) for _ in range(200)]
    sd[n] = float(np.std(est))
    print(f"    n = {n:6d}: разброс 200 оценок {sd[n]:.4f}, теория σ/√n = {4 * math.sqrt(math.pi / 4 * (1 - math.pi / 4) / n):.4f}")
print(f"    в 100 раз больше точек — разброс меньше в {sd[100] / sd[10_000]:.1f} раза (теория: в 10)")
assert 7 < sd[100] / sd[10_000] < 14

# 11. Лучшая константа
lam = 0.25
y = np.linspace(0, 200, 400_001)
dy = y[1] - y[0]
p = lam * np.exp(-lam * y)
cs = np.linspace(0, 15, 3001)
L = {"квадрат": lambda c: (y - c) ** 2, "модуль": lambda c: np.abs(y - c), "квантиль 0.9": lambda c: np.where(y >= c, 0.9 * (y - c), 0.1 * (c - y))}
theory = {"квадрат": 4.0, "модуль": 4 * math.log(2), "квантиль 0.9": 4 * math.log(10)}
for name, Lf in L.items():
    best = cs[np.argmin([np.sum(Lf(c) * p) * dy for c in cs])]
    print(f"11) {name:13}: численно c = {best:.3f}, формула {theory[name]:.3f}")
    assert abs(best - theory[name]) < 0.01

# 12. AUC как вероятность
rng = Mulberry32(42)
neg = np.array([rng.normal(0, 1) for _ in range(500)])
pos = np.array([rng.normal(1.5, 1) for _ in range(500)])
thr = np.sort(np.r_[neg, pos])[::-1]
tpr = np.r_[0, [(pos >= t).mean() for t in thr]]
fpr = np.r_[0, [(neg >= t).mean() for t in thr]]
area = float(np.sum((fpr[1:] - fpr[:-1]) * (tpr[1:] + tpr[:-1]) / 2))
prob = float((pos[:, None] > neg[None, :]).mean())
th = 0.5 * (1 + special.erf(1.5 / 2))
sk = roc_auc_score(np.r_[np.zeros(500), np.ones(500)], np.r_[neg, pos])
print(f"12) площадь {area:.6f}, доля пар {prob:.6f}, sklearn {sk:.6f}, теория Φ(1.5/√2) = {th:.4f}")
assert abs(area - prob) < 1e-9 and abs(area - sk) < 1e-9
