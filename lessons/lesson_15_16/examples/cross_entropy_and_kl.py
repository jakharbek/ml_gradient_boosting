"""Перекрёстная энтропия и KL: неравенство Гиббса, несимметричность, прямая и обратная KL, PSI, сглаживание частот.

Запуск:  python lessons/lesson_15_16/examples/cross_entropy_and_kl.py [--save] [--no-show]

1) H(p, q) = H(p) + KL(p ‖ q) ≥ H(p) — проверка на случайных распределениях; сверка со scipy.stats.entropy.
2) Подгонка одной нормальной кривой к двум горбам: минимум прямой и обратной KL.
3) PSI = KL(q ‖ p) + KL(p ‖ q) при сдвиге среднего и разброса; неравенство Пинскера.
4) Максимальное правдоподобие = минимум KL до выборки; сглаживание (n + α) спасает от бесконечной KL.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import stats
from scipy.optimize import minimize

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE, RED

ex = Example(__file__)
LN2 = math.log(2)

# 1. Гиббс
rng = Mulberry32(23)
for _ in range(1000):
    k = 2 + rng.randint(6)
    p = np.array([rng.random() + 1e-3 for _ in range(k)])
    q = np.array([rng.random() + 1e-3 for _ in range(k)])
    p, q = p / p.sum(), q / q.sum()
    ce = -(p * np.log2(q)).sum()
    assert ce >= stats.entropy(p, base=2) - 1e-12
    assert abs(ce - stats.entropy(p, base=2) - stats.entropy(p, q, base=2)) < 1e-12
print("1000 случайных пар: H(p, q) = H(p) + KL(p‖q) ≥ H(p) — выполнено всегда")
print(f"KL(0.5‖0.9) = {stats.entropy([.5, .5], [.9, .1], base=2):.3f}, KL(0.9‖0.5) = {stats.entropy([.9, .1], [.5, .5], base=2):.3f} — несимметрична")

# 2. Прямая и обратная KL
x = np.linspace(-9, 9, 3601)
dx = x[1] - x[0]
fits = {}
for d in (2.0, 1.0):
    p = 0.5 * stats.norm.pdf(x, -d, 0.5) + 0.5 * stats.norm.pdf(x, d, 0.5)
    mu = (p * x).sum() * dx
    sd = math.sqrt((p * (x - mu) ** 2).sum() * dx)

    def rev(t, p=p):
        q = stats.norm.pdf(x, t[0], math.exp(t[1]))
        return np.sum(q * (stats.norm.logpdf(x, t[0], math.exp(t[1])) - np.log(p + 1e-300))) * dx

    r = minimize(rev, [d, math.log(0.5)], method="Nelder-Mead", options={"xatol": 1e-6, "fatol": 1e-10})
    fits[d] = (p, mu, sd, r.x[0], math.exp(r.x[1]))
    print(f"горбы в ±{d}: прямая KL → N({mu:.2f}, {sd:.2f}²); обратная KL → N({r.x[0]:.2f}, {math.exp(r.x[1]):.2f}²), KL(q‖p) = {r.fun / LN2:.3f} бит")
assert abs(fits[2.0][3] - 2) < 0.01 and abs(fits[2.0][2] - 2.062) < 1e-3

# 3. PSI
edges = stats.norm.ppf(np.linspace(0, 1, 11))
pb = np.full(10, 0.1)
shifts = np.linspace(0, 1.5, 31)
psi, tv, pins = [], [], []
for s in shifts:
    qb = np.diff(stats.norm.cdf(edges - s))
    k_ = max(stats.entropy(qb, pb), 0.0)     # при нулевом сдвиге — ноль с точностью до округления
    psi.append(np.sum((qb - pb) * np.log(qb / pb)))
    tv.append(0.5 * np.abs(qb - pb).sum())
    pins.append(math.sqrt(k_ / 2))
    assert abs(psi[-1] - k_ - stats.entropy(pb, qb)) < 1e-12 and tv[-1] <= pins[-1] + 1e-12
print("PSI при сдвиге 0.3σ и 0.5σ:", round(psi[6], 4), round(psi[10], 4))
assert abs(psi[6] - 0.0861) < 1e-4

# 4. Сглаживание частот
P6 = np.array([0.35, 0.25, 0.18, 0.12, 0.07, 0.03])
cum = np.cumsum(P6)


def counts(n, seed):
    g, c = Mulberry32(seed), np.zeros(6, int)
    for _ in range(n):
        c[min(int(np.searchsorted(cum, g.random(), side="right")), 5)] += 1
    return c


def kl_bits(q):
    return math.inf if np.any(q == 0) else float((P6 * np.log2(P6 / q)).sum())


alphas = np.arange(61) * 0.05
curves = {}
for n in (20, 100, 500):
    S = [counts(n, 500 + r) for r in range(300)]
    curves[n] = np.array([np.mean([kl_bits((c + a) / (n + 6 * a)) for c in S]) for a in alphas])
    fin = curves[n][np.isfinite(curves[n])]
    print(f"n = {n:3d}: средняя KL при α = 0 {curves[n][0]:.4f}, лучшее α = {alphas[np.nanargmin(np.where(np.isfinite(curves[n]), curves[n], np.nan))]:.2f} ({fin.min():.4f} бит)")
assert math.isinf(curves[20][0]) and abs(alphas[int(np.argmin(curves[20]))] - 1.6) < 1e-9

fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))
ax = axes[0]
p, mu, sd, mr, sr = fits[2.0]
ax.fill_between(x, p, color=MUTED, alpha=0.35, label="истинное p")
ax.plot(x, stats.norm.pdf(x, mu, sd), color=BLUE, label="min KL(p‖q)")
ax.plot(x, stats.norm.pdf(x, mr, sr), color=ORANGE, label="min KL(q‖p)")
ax.set(xlim=(-5, 5), xlabel="x", ylabel="плотность", title="Прямая и обратная KL")
ax.legend()

ax = axes[1]
ax.plot(shifts, psi, color=BLUE, label="PSI")
ax.plot(shifts, tv, color=ORANGE, label="полная вариация")
ax.plot(shifts, pins, "--", color=MUTED, label="√(KL/2) — Пинскер")
ax.axhline(0.1, color=RED, lw=0.8, ls=":")
ax.axhline(0.25, color=RED, lw=0.8, ls=":")
ax.set(xlabel="сдвиг среднего, σ", ylabel="величина", title="Сдвиг данных: PSI = симметричная KL", ylim=(0, 1))
ax.legend()

ax = axes[2]
for n, col in ((20, ORANGE), (100, BLUE), (500, MUTED)):
    ax.plot(alphas, np.where(np.isfinite(curves[n]), curves[n], np.nan), color=col, label=f"n = {n}")
ax.set(xlabel="сглаживание α", ylabel="средняя KL(p‖q), бит", title="Частоты + α: регуляризация", ylim=(0, 0.3))
ax.legend()

ex.finish(fig, "cross_entropy_and_kl")
