"""Решения упражнений урока 15.11.

Запуск:  python lessons/lesson_15_11/exercises/solutions.py
"""

import math
import sys

sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq


def rk4(f, t, y, h):
    k1 = f(t, y)
    k2 = f(t + h / 2, y + h / 2 * k1)
    k3 = f(t + h / 2, y + h / 2 * k2)
    k4 = f(t + h, y + h * k3)
    return y + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6


def solve(f, y0, T, h, method="rk4"):
    y = np.asarray(y0, dtype=float)
    for i in range(round(T / h)):
        t = i * h
        if method == "euler":
            y = y + h * f(t, y)
        elif method == "heun":
            k1 = f(t, y)
            y = y + h * (k1 + f(t + h, y + h * k1)) / 2
        else:
            y = rk4(f, t, y, h)
    return y


# 1. Распад
y10 = 50 * math.exp(-2)
num = solve(lambda t, y: -0.2 * y, 50.0, 10, 0.1)
print(f"1) y = 50·e^(−0.2t): y(10) = {y10:.3f} (РК4 {float(num):.6f}); половина через ln 2/0.2 = {math.log(2) / 0.2:.3f} мин")
assert abs(num - y10) < 1e-6

# 2. Бак
S = lambda t: 100 * (1 - math.exp(-0.02 * t))  # noqa: E731
print(f"2) S′ = 2 − 0.02S: равновесие 100 кг, τ = 50 мин, S(60) = {S(60):.2f} кг")
assert abs(float(solve(lambda t, s: 2 - 0.02 * s, 0.0, 60, 0.1)) - S(60)) < 1e-6

# 3. Равновесия
f3 = lambda y: y * (y - 1) * (y - 3)  # noqa: E731
for ys in (0, 1, 3):
    d = (f3(ys + 1e-6) - f3(ys - 1e-6)) / 2e-6
    print(f"3) y* = {ys}: f′ = {d:+.3f} — {'устойчиво' if d < 0 else 'неустойчиво'}")
y_from2 = float(solve(lambda t, y: f3(y), 2.0, 10, 0.01))
ev = lambda t, y: y[0] - 100  # noqa: E731
ev.terminal = True
s = solve_ivp(lambda t, y: f3(y), (0, 10), [3.1], events=ev, rtol=1e-10)
print(f"   из 2 → {y_from2:.6f}; из 3.1 решение превышает 100 при t ≈ {s.t_events[0][0]:.3f} (уходит в бесконечность)")
assert abs(y_from2 - 1) < 1e-6

# 4. Разделение переменных
print(f"4а) y = 2e^(sin t): от {2 / math.e:.4f} до {2 * math.e:.4f}; РК4 при t = π/2: {float(solve(lambda t, y: y * np.cos(t), 2.0, math.pi / 2, math.pi / 2000)):.6f} = 2e = {2 * math.e:.6f}")
print("4б) −1/(2y²) = t − 1/2 ⇒ y = 1/√(1 − 2t): взрыв при t = 1/2")
s = solve_ivp(lambda t, y: y**3, (0, 0.4999), [1.0], rtol=1e-11, atol=1e-12)
print(f"    численно y(0.4999) = {s.y[0, -1]:.2f}, формула {1 / math.sqrt(1 - 2 * 0.4999):.2f}")

# 5. Линейное уравнение
y5 = lambda t: 2 * t - 1 + 2 * math.exp(-2 * t)  # noqa: E731
print(f"5) μ = e^(2t): y = 2t − 1 (установившееся) + 2e^(−2t) (переходное); y(1) = {y5(1):.4f}")
assert abs(float(solve(lambda t, y: 4 * t - 2 * y, 1.0, 1, 0.001)) - y5(1)) < 1e-9

# 6. Жёсткое уравнение
print("6) |1 − 50h| < 1 ⇔ h < 0.04")
for h in (0.039, 0.041):
    print(f"   h = {h}: после 100 шагов |y| = {abs((1 - 50 * h) ** 100):.3e}")
print(f"   неявный, h = 0.1: множитель 1/(1 + 5) = {1 / 6:.4f}, после 10 шагов y = {(1 / 6) ** 10:.2e} (точно e^(−50) ≈ {math.exp(-50):.1e})")

# 7. Порядок по двум расчётам
for m in ("euler", "heun", "rk4"):
    e1 = abs(float(solve(lambda t, y: -y, 1.0, 2, 0.2, m)) - math.exp(-2))
    e2 = abs(float(solve(lambda t, y: -y, 1.0, 2, 0.1, m)) - math.exp(-2))
    print(f"7) {m:5}: E(0.2) = {e1:.3e}, E(0.1) = {e2:.3e}, порядок ≈ {math.log2(e1 / e2):.2f}")

# 8. Осциллятор
print("8) ω = 3, критическое c = 2ω = 6")
r2 = np.roots([1, 2, 9])
print(f"   c = 2: корни {np.round(r2, 4)}, период 2π/√8 = {2 * math.pi / math.sqrt(8):.4f}, огибающая e^(−t)")
print(f"   c = 10: корни {np.roots([1, 10, 9])} — медленный корень −1: при сильном трении груз возвращается медленнее всего")

# 9. Энергия пружины
h = 0.1
x, v = 1.0, 0.0
for _ in range(100):
    x, v = x + h * v, v - h * x
print(f"9) Эйлер: энергия после 100 шагов {x * x + v * v:.6f}, (1 + h²)^100 = {(1 + h * h) ** 100:.6f}")
assert abs((x * x + v * v) - (1 + h * h) ** 100) < 1e-9
x, v = 1.0, 0.0
for _ in range(10000):
    v -= h * x
    x += h * v
print(f"   симплектический: x² + v² − hxv после 10 000 шагов = {x * x + v * v - h * x * v:.12f} (в начале 1)")
assert abs(x * x + v * v - h * x * v - 1) < 1e-9

# 10. Спуск и моментум
lam = np.array([4.0, 16.0])
kap = lam[1] / lam[0]
eta_best = 2 / lam.sum()
b_opt = ((math.sqrt(kap) - 1) / (math.sqrt(kap) + 1)) ** 2
eta_hb = 4 / (math.sqrt(lam[0]) + math.sqrt(lam[1])) ** 2
print(f"10) граница η < {2 / lam[1]}, лучший η = {eta_best}, множитель {(kap - 1) / (kap + 1)}")
print(f"    Поляк: η = {eta_hb:.4f}, β = {b_opt:.4f}, множитель {(math.sqrt(kap) - 1) / (math.sqrt(kap) + 1):.4f}")


def run(eta, beta=0.0):
    th = prev = np.array([1.0, 1.0])
    for k in range(1, 5001):
        th, prev = th - eta * lam * th + beta * (th - prev), th
        if np.linalg.norm(th) < 1e-6:
            return k
    return None


n_gd, n_hb = run(eta_best), run(eta_hb, b_opt)
print(f"    шагов до 1e−6: спуск {n_gd}, моментум {n_hb}")
assert n_hb < n_gd

# 11. Эпидемия
R0 = 3
z = brentq(lambda z: 1 - z - math.exp(-R0 * z), 1e-9, 1)
print(f"11) порог {1 - 1 / R0:.1%}, S в пике 1/R0 = {1 / R0:.3f}, итоговая доля {z:.4f}")
gam = 0.2
beta = R0 * gam
s = solve_ivp(lambda t, u: [-beta * u[0] * u[1], beta * u[0] * u[1] - gam * u[1], gam * u[1]], (0, 400), [0.999, 0.001, 0], rtol=1e-10, atol=1e-12, dense_output=True)
tt = np.linspace(0, 400, 400001)
U = s.sol(tt)
print(f"    численно: S в пике {U[0, U[1].argmax()]:.3f}, переболело {U[2, -1]:.4f}")
assert abs(U[0, U[1].argmax()] - 1 / 3) < 2e-3 and abs(U[2, -1] - z) < 2e-3

# 12. Бустинг с log-loss
sig = lambda F: 1 / (1 + math.exp(-F))  # noqa: E731
p = 0.9
print(f"12а) равновесие ln(0.9/0.1) = {math.log(9):.4f}, кривизна {p * (1 - p):.2f}, граница ν < {2 / (p * (1 - p)):.2f}")
for nu in (20, 24):
    F = 0.0
    for _ in range(2000):
        F += nu * (p - sig(F))
    print(f"     ν = {nu}: F после 2000 шагов = {F:.4f}")
Fq = math.log(99)
print(f"12б) σ(F) = 0.99 при F = ln 99 = {Fq:.3f}; градиентный поток F + e^F = t + 1 ⇒ t = {Fq + 99 - 1:.2f}; поток Ньютона F = ln(2eᵗ − 1) ⇒ t = ln 50 = {math.log(50):.3f}")
s = solve_ivp(lambda t, F: [1 - sig(F[0])], (0, 200), [0.0], rtol=1e-10, atol=1e-12, dense_output=True)
t99 = brentq(lambda t: s.sol(t)[0] - Fq, 1, 200)
print(f"     численно градиентный поток: t = {t99:.2f}")
assert abs(t99 - (Fq + 98)) < 1e-3
