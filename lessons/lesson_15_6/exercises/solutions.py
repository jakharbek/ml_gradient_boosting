"""Решения упражнений урока 15.6.

Запуск:  python lessons/lesson_15_6/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse.rng import Mulberry32

sys.stdout.reconfigure(encoding="utf-8")


def num_diff(f, x, eps=1e-6):
    return (f(x + eps) - f(x - eps)) / (2 * eps)


sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731

# 1
p = lambda x: 3 * x**4 - 2 * x**2 + x - 5  # noqa: E731
print("1) (3x⁴ − 2x² + x − 5)' = 12x³ − 4x + 1; при x = 1.5:", round(num_diff(p, 1.5), 6), "=", 12 * 1.5**3 - 4 * 1.5 + 1)
q = lambda x: x**2 * np.exp(-x)  # noqa: E731
dq = lambda x: x * np.exp(-x) * (2 - x)  # noqa: E731
print("   (x²e⁻ˣ)' = x e⁻ˣ (2 − x): нули x = 0 и x = 2; численно в 2:", f"{num_diff(q, 2.0):.1e}")
assert abs(num_diff(q, 0.7) - dq(0.7)) < 1e-8

# 2
f2 = lambda x: 3 / x**2 + np.cbrt(x) - 1 / np.sqrt(x)  # noqa: E731
df2 = lambda x: -6 * x**-3.0 + x ** (-2 / 3) / 3 + 0.5 * x**-1.5  # 3x⁻² + x^(1/3) − x^(−1/2)
print("2) f' = −6/x³ + 1/(3∛x²) + 1/(2x√x); f'(1) =", round(df2(1.0), 6), "= −6 + 1/3 + 1/2 =", round(-6 + 1 / 3 + 0.5, 6))
assert abs(num_diff(f2, 1.0) - df2(1.0)) < 1e-6 and abs(df2(1.0) - (-6 + 1 / 3 + 0.5)) < 1e-12

# 3
dtan = lambda x: 1 / np.cos(x) ** 2  # noqa: E731
for x in (0.0, 0.5, 1.2):
    print(f"3) (tg x)' при x = {x}: численно {num_diff(np.tan, x):.6f}, 1/cos²x = {dtan(x):.6f}")
    assert abs(num_diff(np.tan, x) - dtan(x)) < 1e-5
print("   в π/4: 1/cos²(π/4) =", round(dtan(np.pi / 4), 12))

# 4
chains = [
    ("(3x + 1)⁵ = u⁵, u = 3x + 1", lambda x: (3 * x + 1) ** 5, lambda x: 15 * (3 * x + 1) ** 4, 0.2),
    ("√(1 + x²) = √u, u = 1 + x²", lambda x: np.sqrt(1 + x**2), lambda x: x / np.sqrt(1 + x**2), 1.0),
    ("e^(sin x²): x → x² → sin → exp", lambda x: np.exp(np.sin(x**2)), lambda x: 2 * x * np.cos(x**2) * np.exp(np.sin(x**2)), 1.0),
    ("ln σ(F): (1/σ)·σ(1 − σ) = 1 − σ", lambda x: np.log(sig(x)), lambda x: 1 - sig(x), -1.0),
]
for name, f, df, x in chains:
    print(f"4) {name:34} при x = {x}: {df(x):.6f} (численно {num_diff(f, x):.6f})")
    assert abs(num_diff(f, x) - df(x)) < 1e-6

# 5
dxx = lambda x: x**x * (np.log(x) + 1)  # noqa: E731
assert abs(num_diff(lambda t: t**t, 1.7) - dxx(1.7)) < 1e-6
grid = np.linspace(0.05, 3, 295001)
x_min = grid[np.argmin(grid**grid)]
grid2 = np.linspace(0.5, 6, 550001)
x_max = grid2[np.argmax(grid2 ** (1 / grid2))]
print(f"5) (xˣ)' = xˣ(ln x + 1): минимум при x ≈ {x_min:.5f} (1/e = {1 / np.e:.5f}); (x^(1/x))' = x^(1/x)(1 − ln x)/x²: максимум при x ≈ {x_max:.5f} (e)")
print(f"   ∛3 = {3 ** (1 / 3):.5f} > √2 = {2**0.5:.5f}: тройка ближе к e")
assert abs(x_min - 1 / np.e) < 1e-4 and abs(x_max - np.e) < 1e-4 and 3 ** (1 / 3) > 2**0.5

# 6
x6, y6 = 3 / np.sqrt(2), np.sqrt(2)
implicit = -4 * x6 / (9 * y6)
t6 = np.pi / 4
parametric = num_diff(lambda t: 2 * np.sin(t), t6) / num_diff(lambda t: 3 * np.cos(t), t6)
print(f"6) эллипс: неявно y' = −4x/(9y) = {implicit:.6f}, через параметр {parametric:.6f} (−2/3)")
assert abs(implicit + 2 / 3) < 1e-12 and abs(parametric - implicit) < 1e-8

# 7
hub = lambda F, y=0.0: np.where(np.abs(y - F) <= 1, 0.5 * (y - F) ** 2, np.abs(y - F) - 0.5)  # noqa: E731
e = 1e-7
left, right = (hub(1.0) - hub(1.0 - e)) / e, (hub(1.0 + e) - hub(1.0)) / e
print(f"7) Хьюбер: g = F − y при |y − F| ≤ δ (h = 1); g = δ·sign(F − y) иначе (h = 0). В стыке: слева {left:.6f}, справа {right:.6f}")
assert abs(left - right) < 1e-5
print("   При h = 0 шаг Ньютона −g/h не определён — поэтому значения листьев для Хьюбера ищут иначе (урок 5.3).")

# 8
y = np.array([2.0, 4.0, 3.0, 7.0, 9.0, 11.0])
alpha = 0.9
Lq = lambda c: np.mean(np.where(y >= c, alpha * (y - c), (1 - alpha) * (c - y)))  # noqa: E731
cs = np.linspace(0, 12, 1201)
vals = np.array([Lq(c) for c in cs])
c_best = cs[np.argmin(vals)]
print(f"8) g = −α при F < y, 1 − α при F > y. Лучшая константа ≈ {c_best:.2f}; np.quantile(y, 0.9) = {np.quantile(y, 0.9):.2f}")
print("   Градиент меняет знак там, где доля точек ниже c переходит через α = 0.9: при 9 < c < 11 ниже 5/6 ≈ 0.83 точек")
print("   (мало), при c > 11 — 6/6. Поэтому минимум в c = 11 — эмпирический 0.9-квантиль без интерполяции;")
print("   np.quantile по умолчанию интерполирует между 9 и 11 и даёт 10 — это другое определение квантиля.")
assert abs(c_best - 11) < 1e-9

# 9
F, steps = 0.0, 0
while abs(math.exp(F) - 3) >= 1e-6:
    g, h = math.exp(F) - 3, math.exp(F)
    F -= g / h
    steps += 1
    print(f"9) шаг {steps}: F = {F:.6f}, |g| = {abs(math.exp(F) - 3):.2e}")
print(f"   {steps} шагов; минимум ln 3 = {math.log(3):.6f}. Первый шаг из 0 даёт 2: парабола по g, h в нуле")
print("   (кривизна e⁰ = 1) недооценивает рост e^F — функция изгибается сильнее, чем думает шаг Ньютона.")
assert steps == 6 and abs(F - math.log(3)) < 1e-6


# 10
class Dual:
    def __init__(self, v, d=0.0):
        self.v, self.d = v, d

    @staticmethod
    def wrap(o):
        return o if isinstance(o, Dual) else Dual(o)

    def __add__(self, o):
        o = Dual.wrap(o)
        return Dual(self.v + o.v, self.d + o.d)

    __radd__ = __add__

    def __mul__(self, o):
        o = Dual.wrap(o)
        return Dual(self.v * o.v, self.d * o.v + self.v * o.d)

    __rmul__ = __mul__

    def __neg__(self):
        return Dual(-self.v, -self.d)

    def __truediv__(self, o):
        o = Dual.wrap(o)
        return Dual(self.v / o.v, (self.d * o.v - self.v * o.d) / o.v**2)  # (u/v)' = (u'v − uv')/v²

    def __rtruediv__(self, o):  # o / self
        return Dual.wrap(o) / self


def dexp(a):
    return Dual(math.exp(a.v), math.exp(a.v) * a.d)


def dlog(a):
    return Dual(math.log(a.v), a.d / a.v)  # (ln u)' = u'/u


x = Dual(0.0, 1.0)
s = 1 / (1 + dexp(-x))
print(f"10) σ'(0) через Dual: {s.d}  (ожидаем 0.25)")
assert abs(s.d - 0.25) < 1e-12
x2 = Dual(2.0, 1.0)
xx = dexp(x2 * dlog(x2))
print(f"    (xˣ)' при 2 через Dual: {xx.d:.12f}, формула 4(ln 2 + 1) = {4 * (math.log(2) + 1):.12f}")
assert abs(xx.d - 4 * (math.log(2) + 1)) < 1e-12

# 11
try:
    import xgboost as xgb

    def poisson_draw(rng, lam):
        limit, k, prod = math.exp(-lam), 0, rng.random()
        while prod > limit:
            k += 1
            prod *= rng.random()
        return k

    rng = Mulberry32(11)
    Xp = np.array([[rng.uniform(0, 3)] for _ in range(400)])
    yp = np.array([float(poisson_draw(rng, m)) for m in np.exp(0.3 + 0.6 * Xp[:, 0])])
    d = xgb.DMatrix(Xp, label=yp)

    def obj_poisson(preds, dmat):
        mu = np.exp(preds)
        return mu - dmat.get_label(), mu  # g = e^F − y, h = e^F

    params = {"max_depth": 3, "eta": 0.3, "tree_method": "exact", "seed": 0, "max_delta_step": 0.0}
    own = xgb.train({**params, "base_score": math.log(yp.mean())}, d, num_boost_round=30, obj=obj_poisson)
    builtin = xgb.train({**params, "objective": "count:poisson", "base_score": yp.mean()}, d, num_boost_round=30)
    diff = float(np.max(np.abs(own.predict(d, output_margin=True) - builtin.predict(d, output_margin=True))))
    print(f"11) своя цель Пуассона против count:poisson: макс. расхождение логарифмов {diff:.1e}")
    assert diff < 1e-4
except ImportError:
    print("11) xgboost не установлен — пропускаем")
