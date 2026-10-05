"""Непрерывные величины и предельные теоремы: метод обратной функции, нормальное, ЦПТ, тяжёлые хвосты.

Запуск:  python lessons/lesson_15_13/examples/continuous_and_limits.py [--save] [--no-show]

1) Метод обратной функции: экспоненциальные числа из равномерных Mulberry32 против плотности λe^{−λx}.
2) Правило 68–95–99.7 и стандартизация.
3) ЦПТ: средние n значений экспоненциального распределения при n = 1, 5, 30 против нормальной кривой.
4) Закон больших чисел ломается у Коши: скользящее среднее не успокаивается.
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

# 1. Метод обратной функции
rng = Mulberry32(42)
u = np.array([rng.random() for _ in range(20000)])
lam = 0.5
x = -np.log(1 - u) / lam
print(f"1) первое u = {u[0]:.6f} → x = {x[0]:.4f};  среднее {x.mean():.3f} (теория 2), медиана {np.median(x):.3f} (теория {math.log(2) / lam:.3f})")
assert abs(x.mean() - 2) < 0.05 and abs(np.median(x) - math.log(2) / lam) < 0.05
ax = axes[0, 0]
ax.hist(x, bins=60, range=(0, 12), density=True, color=BLUE, alpha=0.55, label="−ln(1 − U)/λ, 20 000 чисел")
xx = np.linspace(0, 12, 300)
ax.plot(xx, lam * np.exp(-lam * xx), color=ORANGE, lw=2.2, label="λe^{−λx}, λ = 0.5")
ax.set(xlabel="x", ylabel="плотность", title="метод обратной функции")
ax.legend()

# 2. Нормальное: 68–95–99.7
for k in (1, 2, 3):
    print(f"2) P(|Z| < {k}) = {stats.norm.cdf(k) - stats.norm.cdf(-k):.4f}")
print(f"   рост N(170, 8²): выше 186 см — {stats.norm(170, 8).sf(186):.4f}")
ax = axes[0, 1]
z = np.linspace(-4, 4, 400)
ax.plot(z, stats.norm.pdf(z), color=BLUE, lw=2.2)
for k, a in ((3, 0.12), (2, 0.22), (1, 0.35)):
    m = np.abs(z) <= k
    ax.fill_between(z[m], 0, stats.norm.pdf(z[m]), color=BLUE, alpha=a, label=f"|z| ≤ {k}: {stats.norm.cdf(k) - stats.norm.cdf(-k):.3f}")
ax.set(xlabel="z = (x − μ)/σ", ylabel="плотность", title="стандартное нормальное")
ax.legend()

# 3. ЦПТ для экспоненциального
ax = axes[1, 0]
rng = Mulberry32(5)
for n, col in ((1, MUTED), (5, AQUA), (30, BLUE)):
    means = np.array([np.mean([-math.log(1 - rng.random()) for _ in range(n)]) for _ in range(4000)])
    zs = (means - 1) / (1 / math.sqrt(n))
    sk = ((zs - zs.mean()) ** 3).mean() / zs.std() ** 3
    print(f"3) n = {n:2d}: разброс средних {means.std():.4f} (σ/√n = {1 / math.sqrt(n):.4f}), асимметрия {sk:.3f} (теория {2 / math.sqrt(n):.3f})")
    ax.hist(zs, bins=60, range=(-4, 6), density=True, histtype="step", lw=2, color=col, label=f"n = {n}")
ax.plot(z, stats.norm.pdf(z), "--", color=ORANGE, lw=2, label="N(0, 1)")
ax.set(xlabel="стандартизованное среднее", ylabel="плотность", title="ЦПТ: средние экспоненциальных")
ax.legend()

# 4. ЗБЧ и Коши
ax = axes[1, 1]
N = 20000
for kind, col, seed in (("нормальное", BLUE, 1), ("Коши", ORANGE, 2)):
    rng = Mulberry32(seed)
    v = np.array([rng.normal() if kind == "нормальное" else math.tan(math.pi * (rng.random() - 0.5)) for _ in range(N)])
    run = np.cumsum(v) / np.arange(1, N + 1)
    print(f"4) {kind}: среднее после 1000 — {run[999]:+.4f}, после {N} — {run[-1]:+.4f}, max |значение| = {np.abs(v).max():.1f}")
    ax.plot(np.arange(1, N + 1), np.clip(run, -4, 4), color=col, lw=1.6, label=kind)
nn = np.arange(1, N + 1)
ax.fill_between(nn, -2 / np.sqrt(nn), 2 / np.sqrt(nn), color=BLUE, alpha=0.12, label="±2/√n")
ax.set(xscale="log", ylim=(-4, 4), xlabel="n", ylabel="скользящее среднее", title="закон больших чисел и Коши")
ax.legend()

fig.tight_layout()
ex.finish(fig, "continuous_and_limits")
