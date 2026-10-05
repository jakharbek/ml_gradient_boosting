"""Дискретные распределения: бином и доска Гальтона, геометрическое, Пуассон, неравенство Чебышёва.

Запуск:  python lessons/lesson_15_13/examples/discrete_distributions.py [--save] [--no-show]

1) Доска Гальтона: 2000 шариков, 12 рядов — гистограмма против Bin(12, 0.5).
2) Геометрическое распределение: ждём шестёрку; отсутствие памяти.
3) Пуассон как предел Bin(n, λ/n): расстояние по вариации убывает примерно как 1/n.
4) Чебышёв: настоящая вероятность хвоста против оценки 1/k².
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import stats

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE

ex = Example(__file__)
fig, axes = plt.subplots(2, 2, figsize=(12, 8.4))

# 1. Доска Гальтона
n, N = 12, 2000
rng = Mulberry32(3)
bins = np.bincount([sum(rng.random() < 0.5 for _ in range(n)) for _ in range(N)], minlength=n + 1)
pmf = stats.binom.pmf(np.arange(n + 1), n, 0.5)
dev = np.abs(bins / N - pmf).max()
print(f"1) Гальтон: среднее {np.average(np.arange(n + 1), weights=bins):.3f} (np = 6), max |доля − P| = {dev:.4f}")
assert dev < 0.03
ax = axes[0, 0]
ax.bar(range(n + 1), bins / N, color=BLUE, alpha=0.6, label=f"доля из {N} шариков")
ax.plot(range(n + 1), pmf, "o", color=ORANGE, label="Bin(12, 0.5)")
ax.set(xlabel="ячейка (число отскоков вправо)", ylabel="доля", title="доска Гальтона")
ax.legend()

# 2. Геометрическое: ждём шестёрку
p = 1 / 6
k = np.arange(1, 31)
geo = (1 - p) ** (k - 1) * p
print(f"2) ждём шестёрку: E = {1 / p:.0f}, P(X > 10) = {(1 - p) ** 10:.4f}, медиана = 4 (P(X ≤ 4) = {1 - (1 - p) ** 4:.4f})")
cond = geo[k > 10] / (1 - p) ** 10            # P(X = k | X > 10)
assert np.allclose(cond[:20], geo[:20])         # отсутствие памяти
ax = axes[0, 1]
ax.bar(k, geo, color=BLUE, alpha=0.6, label="P(X = k)")
ax.plot(k[k > 10], cond, "o", color=ORANGE, ms=4, label="P(X = k | X > 10)")
ax.set(xlabel="номер первой шестёрки k", ylabel="вероятность", title="геометрическое: нет памяти")
ax.legend()

# 3. Пуассон как предел бинома
kk = np.arange(60)
ns = [5, 10, 20, 30, 50, 100, 300, 1000, 3000]
tv = [0.5 * np.abs(stats.binom.pmf(kk, m, 3 / m) - stats.poisson.pmf(kk, 3)).sum() for m in ns]
for m, t in zip(ns, tv):
    if m in (10, 30, 100, 1000):
        print(f"3) TV(Bin({m}, 3/{m}), Pois(3)) = {t:.4f}")
assert tv[1] > tv[3] > tv[5] > tv[7]
ax = axes[1, 0]
ax.plot(ns, tv, "o-", color=BLUE, lw=2, label="расстояние по вариации")
ax.plot(ns, 0.85 / np.array(ns), "--", color=MUTED, label="≈ 0.85/n")
ax.set(xscale="log", yscale="log", xlabel="n", ylabel="TV", title="Bin(n, λ/n) → Pois(λ), λ = 3")
ax.legend()

# 4. Чебышёв
ks = np.linspace(1, 4, 61)
b = stats.binom(20, 0.5)
mu, sd = b.mean(), b.std()
x = np.arange(21)
tail_b = [b.pmf(x)[np.abs(x - mu) >= kk_ * sd - 1e-9].sum() for kk_ in ks]
e = stats.expon()
tail_e = [e.sf(1 + kk_) + e.cdf(max(0, 1 - kk_)) for kk_ in ks]
print(f"4) Bin(20, 0.5): P(|X − μ| ≥ 2σ) = {b.pmf(x)[np.abs(x - mu) >= 2 * sd].sum():.4f} ≤ 0.25")
ax = axes[1, 1]
ax.plot(ks, 1 / ks**2, color=MUTED, lw=2, label="оценка Чебышёва 1/k²")
ax.plot(ks, tail_b, color=BLUE, lw=2, label="Bin(20, 0.5)")
ax.plot(ks, tail_e, color=AQUA, lw=2, label="экспоненциальное")
ax.plot(ks, 2 * stats.norm.sf(ks), color=ORANGE, lw=2, label="нормальное")
ax.set(xlabel="k (в стандартных отклонениях)", ylabel="P(|X − μ| ≥ kσ)", title="хвосты против оценки Чебышёва")
ax.legend()
assert all(t <= 1 / kk_**2 + 1e-12 for t, kk_ in zip(tail_e, ks))
print("   у экспоненциального хвост толще, чем у нормального, но всё равно ниже 1/k²; e^{−3} =", round(math.exp(-3), 4))

fig.tight_layout()
ex.finish(fig, "discrete_distributions")
