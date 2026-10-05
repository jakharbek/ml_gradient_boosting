"""Решения упражнений урока 15.15 «Оптимизация: как искать лучшее».

Запуск:  python lessons/lesson_15_15/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from scipy.optimize import linprog, minimize, minimize_scalar
from sklearn.linear_model import Lasso

from gbcourse.rng import Mulberry32

PHI = (math.sqrt(5) - 1) / 2

print("1. Загон с перегородкой")
# Три стороны длины x (две боковые и перегородка) и сторона y вдоль реки: 3x + y = 60, A = x(60 − 3x).
# A'(x) = 60 − 6x = 0 → x = 10, y = 30, A = 300.
res = minimize_scalar(lambda x: -x * (60 - 3 * x), bounds=(0, 20), method="bounded")
print(f"   x = {res.x:.4f}, y = {60 - 3 * res.x:.4f}, площадь {-res.fun:.2f}")
assert abs(res.x - 10) < 1e-4

print("2. Золотое сечение и Брент")
f = lambda x: math.exp(x) - 3 * x  # noqa: E731
k = math.ceil(math.log(1e-3 / 3) / math.log(PHI))
a, b = 0.0, 3.0
c, d = b - PHI * (b - a), a + PHI * (b - a)
fc, fd = f(c), f(d)
evals = 2
while b - a >= 1e-3:
    if fc < fd:
        b, d, fd = d, c, fc
        c = b - PHI * (b - a)
        fc = f(c)
    else:
        a, c, fc = c, d, fd
        d = a + PHI * (b - a)
        fd = f(d)
    evals += 1
brent = minimize_scalar(f, bracket=(0, 1.5))
print(f"   теория: {k} сжатий ({k + 2} вычислений); реализация: {evals} вычислений; Брент: {brent.nfev} вычислений до 1e-8")
assert evals == k + 2 == 19

print("3. Случайный поиск: q = 2 %, уверенность 99 %")
q, conf = 0.02, 0.99
n = math.ceil(math.log(1 - conf) / math.log(1 - q))
rng = Mulberry32(5)
hits = np.mean([min(rng.random() for _ in range(n)) < q for _ in range(2000)])  # ранг точки ~ U(0, 1)
print(f"   нужно {n} точек; моделирование: {hits:.3f} (теория {1 - (1 - q) ** n:.3f})")
assert n == 228 and abs(hits - 0.99) < 0.01

print("4. Режимы шага для 3x²")
# x ← (1 − 6η)x: сходится при 0 < η < 1/3, за один шаг при η = 1/6, качается при η = 1/3.
for eta in (0.1, 1 / 6, 0.25, 1 / 3, 0.4):
    x = 1.0
    for _ in range(30):
        x -= eta * 6 * x
    print(f"   η = {eta:.4f}: множитель {1 - 6 * eta:+.3f}, x_30 = {x:.3g}")

print("5. Backtracking для x⁴")
f4, d4 = (lambda x: x**4), (lambda x: 4 * x**3)
x = 2.0
for _ in range(50):
    t = 1.0
    while f4(x - t * d4(x)) > f4(x) - 0.3 * t * d4(x) ** 2:
        t /= 2
    x -= t * d4(x)
print(f"   Армихо: x_50 = {x:.4f}")
for eta in (0.1, 0.01):
    z, first = 2.0, []
    for i in range(50):
        z = z - eta * 4 * z**3
        if i < 3:
            first.append(round(z, 3))
    print(f"   η = {eta}: первые шаги {first}, x_50 = {z:.4g}")
# η = 0.1: в x = 2 кривизна 12x² = 48 и «безопасный» шаг 2/48 ≈ 0.042 < 0.1 — первый шаг перелетает через ноль
# (2 → −1.2), но там кривизна меньше, и дальше спуск сходится — медленно, сублинейно (у x⁴ нет кривизны в нуле).
# Чуть дальше от нуля, например из x0 = 2.5, тот же η = 0.1 уже разлетается. η = 0.01 безопасен, но очень медленный.
z = 2.5
for _ in range(5):
    z = z - 0.1 * 4 * z**3
print(f"   из x0 = 2.5 при η = 0.1 через 5 шагов: {z:.3g} — разлёт")
assert abs(z) > 1e6

print("6. Лучшая инерция при κ = 100")


def mom_steps(beta, kappa=100):
    p, v = np.array([-4.0, 1.5]), np.zeros(2)
    for k_ in range(1, 20001):
        v = beta * v - np.array([p[0], kappa * p[1]]) / kappa
        p = p + v
        if 0.5 * (p[0] ** 2 + kappa * p[1] ** 2) < 1e-6:
            return k_
    return 10**9


best = min((mom_steps(bb / 100), bb / 100) for bb in range(100))
print(f"   лучшее β = {best[1]} → {best[0]} шагов; формула (1 − 1/√κ)² = {(1 - 0.1) ** 2:.2f}; без инерции {mom_steps(0)} шагов")
assert abs(best[1] - 0.81) <= 0.03

print("7. Мягкий порог")
soft = lambda z, t: np.sign(z) * max(abs(z) - t, 0)  # noqa: E731
tau = 0.7
for z in (-2.0, -0.5, 0.3, 0.7, 1.5):
    lz = Lasso(alpha=tau, fit_intercept=False).fit(np.ones((1, 1)), [z])  # ½(z − w)² + τ|w|
    print(f"   z = {z:+.1f}: S(z) = {soft(z, tau):+.3f}, Lasso {lz.coef_[0]:+.3f}")
    assert abs(lz.coef_[0] - soft(z, tau)) < 1e-12

print("8. Свой BFGS на функции Розенброка")
rf = lambda p: (1 - p[0]) ** 2 + 100 * (p[1] - p[0] ** 2) ** 2  # noqa: E731
rg = lambda p: np.array([-2 * (1 - p[0]) - 400 * p[0] * (p[1] - p[0] ** 2), 200 * (p[1] - p[0] ** 2)])  # noqa: E731


def run(method, max_it=50000):
    p, H = np.array([-1.2, 1.0]), np.eye(2)
    g = rg(p)
    for it in range(max_it):
        if np.linalg.norm(g) < 1e-8:
            return it, p
        d = -g if method == "gd" else -H @ g
        t = 1.0
        while rf(p + t * d) > rf(p) + 1e-4 * t * (g @ d):
            t /= 2
        pn = p + t * d
        gn = rg(pn)
        if method == "bfgs":
            s, y = pn - p, gn - g
            if s @ y > 1e-12:
                if it == 0:
                    H = (s @ y) / (y @ y) * np.eye(2)
                rho = 1 / (s @ y)
                H = (np.eye(2) - rho * np.outer(s, y)) @ H @ (np.eye(2) - rho * np.outer(y, s)) + rho * np.outer(s, s)
        p, g = pn, gn
    return max_it, p


it_b, p_b = run("bfgs")
it_g, _ = run("gd")
sc = minimize(rf, [-1.2, 1.0], jac=rg, method="BFGS", options={"gtol": 1e-8})
print(f"   свой BFGS: {it_b} итераций, x = {p_b.round(6)}; спуск с Армихо: {it_g}; scipy BFGS: {sc.nit}")
assert np.allclose(p_b, [1, 1], atol=1e-6) and it_b < 100 < it_g

print("9. Пол шума SGD")
r = Mulberry32(3)
N = 200
xs = np.array([r.uniform(-1, 1) for _ in range(N)])
ys = np.array([1 + 2 * x + r.normal(0, 0.5) for x in xs])
k_opt, b_opt = np.polyfit(xs, ys, 1)
loss = lambda b, k: ((ys - b - k * xs) ** 2).mean() / 2  # noqa: E731
L_min = loss(b_opt, k_opt)


def floor(B, eta):
    acc = []
    for seed in range(3):
        rr = Mulberry32(300 + seed)
        b = kk = 0.0
        for t in range(1, 4001):
            idx = [rr.randint(N) for _ in range(B)]
            e = ys[idx] - b - kk * xs[idx]
            b += eta * e.mean()
            kk += eta * (e * xs[idx]).mean()
            if t > 2000:
                acc.append(loss(b, kk) - L_min)
    return np.mean(acc)


for B in (1, 4):
    fl = [floor(B, e) for e in (0.01, 0.02, 0.05, 0.1)]
    print(f"   B = {B}: пол {np.round(fl, 5)}; пол/(η/B) ≈ {np.round(np.array(fl) / (np.array([0.01, 0.02, 0.05, 0.1]) / B), 3)}")

print("10. ККТ вручную")
# Проекция t = (1, 3) на {w1 + w2 ≤ 2, w ≥ 0}: на прямой w1 + w2 = 2 ближайшая точка (0, 2) — она же угол с w1 = 0.
# t − w* = (1, 1) = μ1·(1, 1) + μ2·(−1, 0): μ1 = 1, μ2 = 0 → активно только w1 + w2 ≤ 2 (w1 = 0 активно, но μ = 0).
t = np.array([1.0, 3.0])


def proj(c):
    cons = [{"type": "ineq", "fun": lambda w: c - w[0] - w[1]}, {"type": "ineq", "fun": lambda w: w[0]}, {"type": "ineq", "fun": lambda w: w[1]}]
    return minimize(lambda w: 0.5 * ((w - t) ** 2).sum(), np.array([0.5, 0.5]), constraints=cons, method="SLSQP", tol=1e-12)


res = proj(2)
dfdc = (proj(2 - 1e-4).fun - proj(2 + 1e-4).fun) / 2e-4
print(f"   w* = {res.x.round(5)}, μ = 1, численно −df*/dc = {dfdc:.4f}")
assert np.allclose(res.x, [0, 2], atol=1e-6) and abs(dfdc - 1) < 1e-3

print("11. ЛП при pA = 1, pB = 4")
V = [(0, 0), (3, 0), (3, 1), (1.5, 2.5), (0, 3)]
c = np.array([1, 4])
best_v = max(V, key=lambda v: c @ v)
lp = linprog(-c, A_ub=[[1, 1], [1, 3], [1, 0]], b_ub=[4, 9, 3], bounds=[(0, None)] * 2, method="highs")
mu = -lp.ineqlin.marginals
print(f"   перебор вершин: {best_v}, прибыль {c @ best_v}; linprog: {lp.x}, двойственные цены {mu.round(4)}")
assert abs(mu @ [4, 9, 3] - (-lp.fun)) < 1e-9

print("12. Значение листа")
for y in (np.array([1, 1, 1, 1, 1, 0]), np.array([1, 1, 1, 1, 1])):
    p = 0.5
    G = -(y - p).sum()
    H = len(y) * p * (1 - p)
    loss_leaf = lambda g, y=y: np.sum(np.logaddexp(0, -g) * y + np.logaddexp(0, g) * (1 - y))  # noqa: E731
    ex = minimize_scalar(loss_leaf, bounds=(-50, 50), method="bounded", options={"xatol": 1e-10}).x
    print(f"   {len(y)} объектов: Ньютон {-G / H:.3f}, с λ = 1 {-G / (H + 1):.3f}, численный минимум на [−50, 50]: {ex:.3f}")
print("   в «чистом» листе потери убывают при γ → ∞: минимум уходит на край отрезка, без λ решения нет")
