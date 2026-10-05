"""Решения упражнений урока 15.1.

Запуск:  python lessons/lesson_15_1/exercises/solutions.py
"""

import sys
from pathlib import Path

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

from gbcourse import datasets  # noqa: E402

# 1
P = lambda s: 1.5 + 0.12 * s  # noqa: E731
s9 = (9 - 1.5) / 0.12
print(f"1) P(s) = 1.5 + 0.12·s; P(50) = {P(50):.1f} млн; цена 9 млн при s = {s9:.1f} м²; 0.12 — цена одного м²")
assert abs(P(s9) - 9) < 1e-12

# 2
f = lambda x: x**2 - 3 * x  # noqa: E731
simplified = lambda a: a**2 - a - 2  # noqa: E731
print(f"2) f(a + 1) = a² − a − 2; при a = 2: {f(3)} и {simplified(2)}; f(2·3) = {f(6)}, а 2·f(3) = {2 * f(3)}")
assert all(abs(f(a + 1) - simplified(a)) < 1e-9 for a in np.linspace(-5, 5, 11))

# 3
grid = np.linspace(-10, 10, 200001)
with np.errstate(all="ignore"):
    cases = {
        "3/(x + 1)": (3 / (grid + 1), grid != -1),
        "√(2x − 6)": (np.sqrt(2 * grid - 6), grid >= 3),
        "ln(x + 4)": (np.log(grid + 4), grid > -4),
        "√x/(x − 4)": (np.sqrt(grid) / (grid - 4), (grid >= 0) & (grid != 4)),
    }
for name, (y, expected) in cases.items():
    assert np.array_equal(np.isfinite(y), expected), name
print("3) а) x ≠ −1; б) [3; +∞); в) (−4; +∞); г) [0; 4) ∪ (4; +∞) — совпадает с сеткой")

# 4
x = np.linspace(-2, 8, 100001)
y = (x - 3) ** 2 - 1
i = np.argmin(y)
roots = x[np.where(np.sign(y[:-1]) * np.sign(y[1:]) <= 0)[0]]
print(f"4) дно в точке ({x[i]:.3f}, {y[i]:.3f}), корни ≈ {np.unique(roots.round(3))}: "
      "внутри скобки 0 при x = 3, квадрат ≥ 0, минимум −1")
assert abs(x[i] - 3) < 1e-3 and abs(y[i] + 1) < 1e-9

# 5
k = (1 - 7) / (2 - (-1))
b = 7 - k * (-1)
print(f"5) y = {k:g}x + {b:g}; ось y: (0, {b:g}); ось x: ({-b / k:g}, 0); polyfit: {np.polyfit([-1, 2], [7, 1], 1).round(6)}")
assert np.allclose(np.polyfit([-1, 2], [7, 1], 1), [k, b])

# 6
p = lambda x: (x + 2) * (x - 1) * (x - 3) / 4  # noqa: E731
xs = np.linspace(-3, 4, 70001)
ys = p(xs)
zeros = np.unique(xs[np.where(np.sign(ys[:-1]) * np.sign(ys[1:]) <= 0)[0]].round(3))
signs = ["+" if p(v) > 0 else "−" for v in (-2.5, 0, 2, 3.5)]
print(f"6) нули {zeros}, знаки {signs}, f(0) = {p(0)}; max = {ys.max():.3f} в x = {xs[ys.argmax()]:.2f}, "
      f"min = {ys.min():.3f} в x = {xs[ys.argmin()]:.2f} — оба на краях отрезка")
assert list(zeros) == [-2.0, 1.0, 3.0] and signs == ["−", "+", "−", "+"]
assert xs[ys.argmax()] == 4 and xs[ys.argmin()] == -3

# 7
sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731
z = np.linspace(-6, 6, 121)
ok = np.allclose(sig(-z), 1 - sig(z))
odd = np.allclose(sig(-z) - 0.5, -(sig(z) - 0.5))
print(f"7) σ(−x) = 1 − σ(x): {ok}; σ(x) − ½ нечётная: {odd}. Если σ(F) — вероятность класса 1, то σ(−F) — класса 0")
assert ok and odd

# 8
gh = lambda t: 2 * t + 3   # noqa: E731  g(h(x))
hg = lambda t: 2 * (t + 3)  # noqa: E731  h(g(x)) = 2x + 6
assert all(hg(t) - gh(t) == 3 for t in range(-5, 6))
fn = lambda x: (x - 1) / 3  # noqa: E731
inv = lambda y: 3 * y + 1  # noqa: E731
assert np.allclose(inv(fn(z)), z)
logit = lambda q: np.log(q / (1 - q))  # noqa: E731
F0 = logit(0.3)
assert np.allclose(logit(sig(z)), z) and abs(sig(F0) - 0.3) < 1e-12
print(f"8) g(h(x)) = 2x + 3, h(g(x)) = 2x + 6 — не равны никогда; f⁻¹(x) = 3x + 1; logit(p) = ln(p/(1 − p)), F0 = {F0:.4f}")

# 9
prices = np.array([1, 2, 6.0])
c = np.linspace(0, 8, 8001)
mse = ((prices[:, None] - c) ** 2).mean(axis=0)
mae = np.abs(prices[:, None] - c).mean(axis=0)
coef = np.polyfit(c, mse, 2)
print(f"9) L(c) = {coef[0]:.3f}c² {coef[1]:+.3f}c {coef[2]:+.3f}; вершина c = {c[mse.argmin()]:.2f} (среднее), "
      f"L = {mse.min():.4f} = 14/3; MAE: c = {c[mae.argmin()]:.2f} (медиана) — меньше реагирует на «выброс» 6")
assert abs(c[mse.argmin()] - 3) < 1e-9 and abs(mse.min() - 14 / 3) < 1e-9 and abs(c[mae.argmin()] - 2) < 1e-9

# 10
X, y = datasets.regression_1d(kind="sine", n=50, noise=0.25, seed=7)
xx = X[:, 0]


def boost(nu, M):
    F = np.full_like(y, y.mean())
    for _ in range(M):
        r = y - F
        best = None
        for t in (xx[1:] + xx[:-1]) / 2:
            L, R = r[xx <= t], r[xx > t]
            if len(L) and len(R):
                sse = ((L - L.mean()) ** 2).sum() + ((R - R.mean()) ** 2).sum()
                if best is None or sse < best[0]:
                    best = (sse, t, L.mean(), R.mean())
        _, t, lv, rv = best
        F = F + nu * np.where(xx <= t, lv, rv)
    return ((y - F) ** 2).mean()


table = {nu: [boost(nu, M) for M in (1, 10, 30)] for nu in (0.1, 1.0)}
for nu, vals in table.items():
    print(f"10) ν = {nu}: MSE при M = 1, 10, 30: " + ", ".join(f"{v:.4f}" for v in vals))
print("    С большим ν ошибка падает быстрее, с маленьким — медленнее, но каждая ступенька вносит малую поправку")
assert all(a > b for vals in table.values() for a, b in zip(vals, vals[1:]))
assert table[1.0][0] < table[0.1][0]
