"""Поиск без производных: сетка и случайный поиск, золотое сечение и Брент, Нелдер — Мид, байесовская оптимизация.

Запуск:  python lessons/lesson_15_15/examples/derivative_free_search.py [--save] [--no-show]

1) Сетка против случайного поиска при одном важном параметре (500 повторов) и правило 59 точек.
2) Сужение отрезка: дихотомия, троичный поиск, золотое сечение; метод Брента из scipy.
3) Нелдер — Мид в изогнутой долине и байесовская оптимизация (ГП + ожидаемое улучшение) против случайного поиска.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.optimize import minimize, minimize_scalar
from scipy.stats import norm

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))
PHI = (math.sqrt(5) - 1) / 2

# 1. Сетка против случайного поиска
score = lambda x, y: math.exp(-(((x - 0.37) / 0.08) ** 2)) * (1 + 0.05 * math.sin(6 * y))  # noqa: E731
budgets = [4, 9, 16, 25, 36]
grid_best, rand_mean = [], []
for n in budgets:
    g = np.linspace(0, 1, round(math.sqrt(n)))
    grid_best.append(max(score(a, b) for a in g for b in g))
    vals = []
    for r in range(500):
        rr = Mulberry32(5000 + r)
        vals.append(max(score(rr.random(), rr.random()) for _ in range(n)))
    rand_mean.append(np.mean(vals))
    print(f"бюджет {n:2d}: сетка {grid_best[-1]:.3f}, случайный поиск в среднем {rand_mean[-1]:.3f}")
ax = axes[0]
ax.plot(budgets, grid_best, "o-", color=MUTED, label="сетка")
ax.plot(budgets, rand_mean, "o-", color=BLUE, label="случайный поиск (среднее)")
ax.set(xlabel="число запусков", ylabel="лучшее качество", title="Сетка против случайного поиска")
ax.legend()
n59 = math.ceil(math.log(0.05) / math.log(0.95))
print("случайных точек для попадания в лучшие 5 % с вероятностью 95 %:", n59)
assert n59 == 59 and rand_mean[1] > grid_best[1]


# 2. Сужение отрезка
def golden(f, a, b, evals):
    c, d = b - PHI * (b - a), a + PHI * (b - a)
    fc, fd = f(c), f(d)
    for _ in range(evals - 2):
        if fc < fd:
            b, d, fd = d, c, fc
            c = b - PHI * (b - a)
            fc = f(c)
        else:
            a, c, fc = c, d, fd
            d = a + PHI * (b - a)
            fd = f(d)
    return b - a


def two_point(f, a, b, evals, third):
    for _ in range(evals // 2):
        x1, x2 = (a + (b - a) / 3, b - (b - a) / 3) if third else ((a + b) / 2 - 1e-3, (a + b) / 2 + 1e-3)
        if f(x1) < f(x2):
            b = x2
        else:
            a = x1
    return b - a


fe = lambda x: math.exp(x) - 3 * x  # noqa: E731
E = np.arange(2, 31, 2)
ax = axes[1]
ax.semilogy(E, [two_point(fe, 0, 3, e, False) for e in E], "o-", color=VIOLET, ms=3, label="дихотомия")
ax.semilogy(E, [two_point(fe, 0, 3, e, True) for e in E], "o-", color=AQUA, ms=3, label="троичный поиск")
ax.semilogy(E, [golden(fe, 0, 3, e) for e in E], "o-", color=ORANGE, ms=3, label="золотое сечение")
ax.set(xlabel="вычислений f", ylabel="длина отрезка", title="Сужение отрезка для eˣ − 3x")
ax.legend()
L30 = golden(fe, 0, 3, 30)
res = minimize_scalar(fe, bracket=(0, 1.5))
print(f"золотое сечение, 30 вычислений: длина {L30:.1e}; Брент: x = {res.x:.9f} за {res.nfev} вычислений")
assert L30 < 1e-5 and abs(res.x - math.log(3)) < 1e-7

# 3. Нелдер — Мид и байесовская оптимизация
banana = lambda p: (1 - p[0]) ** 2 + 5 * (p[1] - p[0] ** 2) ** 2  # noqa: E731
sim0 = np.array([[-1.2, 1.5], [-0.95, 1.5], [-1.2, 1.75]])
nm = minimize(banana, sim0[0], method="Nelder-Mead", options={"initial_simplex": sim0, "xatol": 1e-4, "fatol": 1e-4})
print(f"Нелдер — Мид: x = {nm.x.round(4)}, вычислений f {nm.nfev}")
assert np.allclose(nm.x, [1, 1], atol=1e-3)

g = lambda u: 0.3 - 0.1 * np.exp(-((u - 0.68) ** 2) / (2 * 0.035**2)) - 0.05 * np.exp(-((u - 0.22) ** 2) / (2 * 0.12**2)) + 0.04 * u  # noqa: E731
grid = np.linspace(0, 1, 201)
g_star = g(np.linspace(0, 1, 100001)).min()
X, Y = [0.1, 0.5, 0.9], [g(0.1), g(0.5), g(0.9)]
best_bo = [min(Y)]
for _ in range(12):
    Xa, Ya = np.array(X), np.array(Y)
    m, s = Ya.mean(), Ya.std()
    K = np.exp(-((Xa[:, None] - Xa[None, :]) ** 2) / (2 * 0.06**2)) + 1e-6 * np.eye(len(X))
    Ks = np.exp(-((Xa[:, None] - grid[None, :]) ** 2) / (2 * 0.06**2))
    Lc = np.linalg.cholesky(K)
    mu = Ks.T @ np.linalg.solve(Lc.T, np.linalg.solve(Lc, (Ya - m) / s))
    sd = np.sqrt(np.maximum(1 - (np.linalg.solve(Lc, Ks) ** 2).sum(0), 0))
    imp = (Ya.min() - m) / s - mu - 0.01
    z = np.divide(imp, sd, out=np.zeros_like(imp), where=sd > 1e-12)
    ei = np.where(sd > 1e-12, imp * norm.cdf(z) + sd * norm.pdf(z), 0)
    X.append(grid[ei.argmax()])
    Y.append(g(X[-1]))
    best_bo.append(min(Y))
rand =np.array([[g(u) for u in (lambda rr: [rr.random() for _ in range(15)])(Mulberry32(7000 + r))] for r in range(2000)])
rand_best = np.minimum.accumulate(rand, axis=1)[:, 2:].mean(0)
ax = axes[2]
ax.semilogy(range(3, 16), np.array(best_bo) - g_star + 1e-7, "o-", color=ORANGE, label="байесовская оптимизация")
ax.semilogy(range(3, 16), rand_best - g_star, "o-", color=BLUE, label="случайный поиск (среднее)")
ax.set(xlabel="число запусков", ylabel="отставание от оптимума", title="Байесовская оптимизация")
ax.legend()
print(f"15 запусков: байесовская оптимизация отстаёт на {best_bo[-1] - g_star:.1e}, случайный поиск — на {rand_best[-1] - g_star:.4f}")
assert best_bo[-1] - g_star < 1e-3 < rand_best[-1] - g_star

ex.finish(fig, "derivative_free_search")
