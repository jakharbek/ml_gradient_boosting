"""Решения упражнений урока 15.8: частные производные, градиент, гессиан и бустинг.

Запуск:  python lessons/lesson_15_8/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np
from scipy import optimize

for stream in (sys.stdout, sys.stderr):
    stream.reconfigure(encoding="utf-8")

sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731


def grad_num(f, p, eps=1e-6):
    p = np.asarray(p, dtype=float)
    return np.array([(f(p + e) - f(p - e)) / (2 * eps) for e in np.eye(len(p)) * eps])


def title(t):
    print("\n" + "=" * 8, t)


# 1. Правило «заморозки» ------------------------------------------------------------------
title("1. Частные производные")
TASK1 = [
    ("x³y − 2xy² + 5", lambda p: p[0] ** 3 * p[1] - 2 * p[0] * p[1] ** 2 + 5, lambda x, y: [3 * x**2 * y - 2 * y**2, x**3 - 4 * x * y], (1, 2)),
    ("e^(2x) sin y", lambda p: np.exp(2 * p[0]) * np.sin(p[1]), lambda x, y: [2 * np.exp(2 * x) * np.sin(y), np.exp(2 * x) * np.cos(y)], (0, np.pi / 2)),
    ("x/(x + y)", lambda p: p[0] / (p[0] + p[1]), lambda x, y: [y / (x + y) ** 2, -x / (x + y) ** 2], (1, 2)),
]
for name, f, d, pt in TASK1:
    ex, num = np.array(d(*pt)), grad_num(f, pt)
    print(f"{name:15} ∇f = {ex.round(5)} (численно {num.round(5)})")
    assert np.allclose(ex, num, atol=1e-7)
# ответы: (−2, −7); (2, 0); (2/9, −1/9)

# 2. Линии уровня и срезы ----------------------------------------------------------------
title("2. Линии уровня 4x² + y² = c")
for c in (4, 16):
    print(f"c = {c}: эллипс с полуосями {math.sqrt(c / 4):g} по x и {math.sqrt(c):g} по y")
g2 = np.array([8 * 1, 2 * 2])
print("∇f(1, 2) =", g2, "→ срез вдоль x круче (8 против 4)")
print("между уровнями 4 и 16: вдоль x расстояние 2 − 1 = 1, вдоль y — 4 − 2 = 2: вдоль x склон круче")
assert g2[0] > g2[1]

# 3. Предел по путям -----------------------------------------------------------------------
title("3. Предел по путям")
fa = lambda x, y: (x**2 - y**2) / (x**2 + y**2)  # noqa: E731
for k in (0, 1, 2):
    print(f"(x² − y²)/(x² + y²) вдоль y = {k}x: {fa(1e-6, k * 1e-6):+.4f} = (1 − k²)/(1 + k²) = {(1 - k * k) / (1 + k * k):+.4f}")
fb = lambda x, y: x**3 / (x**2 + y**2)  # noqa: E731
rng = np.random.default_rng(0)
pts = rng.normal(size=(1000, 2)) * 1e-3
assert np.all(np.abs(fb(pts[:, 0], pts[:, 1])) <= np.abs(pts[:, 0]) + 1e-15)
print("x³/(x² + y²): |f| ≤ |x| → 0 — предел есть и равен 0 (проверено на 1000 случайных точках)")

# 4. Касательная плоскость ---------------------------------------------------------------
title("4. Касательная плоскость к √(x² + y²) в (3, 4)")
r = lambda x, y: math.hypot(x, y)  # noqa: E731
T = lambda x, y: 5 + 0.6 * (x - 3) + 0.8 * (y - 4)  # noqa: E731
e1 = abs(r(2.9, 4.2) - T(2.9, 4.2))
e2 = abs(r(2.99, 4.02) - T(2.99, 4.02))
print(f"оценка f(2.9, 4.2) ≈ {T(2.9, 4.2):.4f}, точно {r(2.9, 4.2):.5f}, ошибка {e1:.2e}")
print(f"сдвиг в 10 раз меньше: ошибка {e2:.2e} — в {e1 / e2:.0f} раз меньше (порядок ρ²)")
assert 90 < e1 / e2 < 110

# 5. Градиент и производная по направлению ----------------------------------------------
title("5. ∇(x²y + eʸ) в (1, 0)")
f5 = lambda p: p[0] ** 2 * p[1] + np.exp(p[1])  # noqa: E731
g5 = grad_num(f5, [1, 0])
print("∇f =", g5.round(6), " D_u f для u = (0.6, 0.8):", round(g5 @ [0.6, 0.8], 6), " max =", round(np.linalg.norm(g5), 6))
print("скорость ноль вдоль ±(1, 0) — перпендикулярно градиенту")
assert np.allclose(g5, [0, 2]) and abs(g5 @ [0.6, 0.8] - 1.6) < 1e-6

# 6. Касательная к линии уровня ----------------------------------------------------------
title("6. Касательная к x² + 4y² = 8 в (2, 1)")
g6 = np.array([2 * 2, 8 * 1])
print("∇f =", g6, "→ касательная 4(x − 2) + 8(y − 1) = 0, то есть x + 2y = 4")
tt = np.linspace(0, 2 * np.pi, 400001)
EX, EY = math.sqrt(8) * np.cos(tt), math.sqrt(2) * np.sin(tt)
i = np.argmin((EX - 2) ** 2 + (EY - 1) ** 2)
tv = np.array([EX[i + 1] - EX[i - 1], EY[i + 1] - EY[i - 1]])
print(f"cos угла между ∇f и касательным вектором: {g6 @ tv / np.linalg.norm(g6) / np.linalg.norm(tv):.1e}")
assert abs(g6 @ tv / np.linalg.norm(g6) / np.linalg.norm(tv)) < 1e-6

# 7. Цепное правило ----------------------------------------------------------------------
title("7. Цепное правило")
t0 = math.pi / 3
x, y = math.cos(t0), 2 * math.sin(t0)
dx, dy = -math.sin(t0), 2 * math.cos(t0)
chain = (2 * x - y) * dx + (2 * y - x) * dy
h = lambda t: math.cos(t) ** 2 + 4 * math.sin(t) ** 2 - 2 * math.cos(t) * math.sin(t)  # noqa: E731
direct = (h(t0 + 1e-6) - h(t0 - 1e-6)) / 2e-6
print(f"fₓ·x′ + f_y·y′ = {chain:.6f}, напрямую h′(π/3) = {direct:.6f}")
assert abs(chain - direct) < 1e-6

# 8. Критические точки -------------------------------------------------------------------
title("8. x³ + y³ − 3xy")
for p in [(0.0, 0.0), (1.0, 1.0)]:
    H = np.array([[6 * p[0], -3], [-3, 6 * p[1]]])
    det = np.linalg.det(H)
    kind = "седло" if det < 0 else "минимум" if H[0, 0] > 0 else "максимум"
    print(f"{p}: ∇f = {(3 * p[0] ** 2 - 3 * p[1], 3 * p[1] ** 2 - 3 * p[0])}, det H = {det:.0f} → {kind}, f = {p[0] ** 3 + p[1] ** 3 - 3 * p[0] * p[1]:g}")
# решения системы: y = x², x = y² → x⁴ = x → x = 0 или 1

# 9. Устойчивость спуска -----------------------------------------------------------------
title("9. Спуск по 2x² + 8y²")
print("множители 1 − 4η и 1 − 16η: сходимость при 0 < η < 0.125; лучший η = 0.1, множитель 0.6")
for eta in (0.05, 0.1, 0.12, 0.13):
    p, k = np.array([1.0, 1.0]), 0
    f9 = lambda q: 2 * q[0] ** 2 + 8 * q[1] ** 2  # noqa: E731
    while 1e-8 < f9(p) < 1e8 and k < 5000:
        p, k = p - eta * np.array([4 * p[0], 16 * p[1]]), k + 1
    print(f"η = {eta}: " + ("расходится" if f9(p) >= 1e8 else f"{k} шагов"))

# 10. Лагранж ---------------------------------------------------------------------------
title("10. Прямоугольник с периметром 20")
print("∇S = (y, x) = λ(2, 2) → x = y = 5, λ = 2.5, S = 25")
res = optimize.minimize(lambda p: -p[0] * p[1], [1, 9], constraints={"type": "eq", "fun": lambda p: 2 * p[0] + 2 * p[1] - 20})
print("scipy:", res.x.round(4), " S =", round(-res.fun, 4))
dS = ((20.01 / 4) ** 2 - (19.99 / 4) ** 2) / 0.02
print(f"λ — цена ограничения: dS*/dP = {dS:.4f} (оптимальная площадь растёт на 2.5 на единицу периметра)")
assert np.allclose(res.x, [5, 5], atol=1e-4) and abs(dS - 2.5) < 1e-6

# 11. Регрессия: обусловленность ---------------------------------------------------------
title("11. Линейная регрессия: гессиан и стандартизация")
x11 = np.array([10, 20, 30, 40, 50.0])
y11 = np.array([3, 5, 6, 9, 10.0])


def gd_steps(xx, tol=1e-6):
    H = 2 * np.array([[np.mean(xx**2), np.mean(xx)], [np.mean(xx), 1]])
    lam = np.linalg.eigvalsh(H)
    eta = 2 / (lam[0] + lam[1])                       # лучший постоянный шаг
    L_opt = np.mean((y11 - np.polyval(np.polyfit(xx, y11, 1), xx)) ** 2)
    w = b = 0.0
    k = 0
    while np.mean((y11 - w * xx - b) ** 2) - L_opt > tol and k < 10**7:
        r_ = y11 - w * xx - b
        w, b, k = w + eta * 2 * np.mean(xx * r_), b + eta * 2 * np.mean(r_), k + 1
    return H, lam, eta, k


for xx, name in [(x11, "исходный x"), ((x11 - x11.mean()) / x11.std(), "стандартизованный")]:
    H, lam, eta, k = gd_steps(xx)
    print(f"{name:18} H = {H.round(2).tolist()}, λ = {lam.round(4)}, κ = {lam[1] / lam[0]:.1f}, η < {2 / lam[1]:.5f}, шагов {k}")
_, lam_raw, _, k_raw = gd_steps(x11)
_, lam_std, _, k_std = gd_steps((x11 - x11.mean()) / x11.std())
assert lam_raw[1] / lam_raw[0] > 100 and abs(lam_std[1] / lam_std[0] - 1) < 1e-9 and k_std <= 2 < k_raw

# 12. Псевдо-остатки и лист -------------------------------------------------------------
title("12. Лист из трёх объектов, log-loss")
y12 = np.array([1.0, 1.0, 0.0])
F12 = np.array([0.5, -1.0, 2.0])
p12 = sig(F12)
g12, h12 = p12 - y12, p12 * (1 - p12)
G, H = g12.sum(), h12.sum()
print("псевдо-остатки y − p =", (-g12).round(4), " гессианы h =", h12.round(4))
w0, w1 = -G / H, -G / (H + 1)
w_opt = optimize.brentq(lambda w: np.sum(sig(F12 + w) - y12), -10, 10)
loss = lambda w: np.sum(np.log1p(np.exp(-(F12 + w))) * y12 + np.log1p(np.exp(F12 + w)) * (1 - y12))  # noqa: E731
print(f"G = {G:.4f}, H = {H:.4f}: лист λ = 0 → {w0:.4f}, λ = 1 → {w1:.4f}; точный оптимум {w_opt:.4f}")
print(f"потери: до {loss(0):.4f}, после шага Ньютона {loss(w0):.4f}, в оптимуме {loss(w_opt):.4f}")
assert abs(w0 - w_opt) < 0.1 and loss(w0) - loss(w_opt) < 1e-2
