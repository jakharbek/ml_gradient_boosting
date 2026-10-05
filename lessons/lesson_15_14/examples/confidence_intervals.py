"""Доверительные интервалы: покрытие t и z, Вальд против Уилсона, бутстрэп.

Запуск:  python lessons/lesson_15_14/examples/confidence_intervals.py [--save] [--no-show]

1) Покрытие интервала для среднего с множителями t и 1.96 на нормальных и скошенных данных в зависимости от n.
2) Точное покрытие интервалов Вальда и Уилсона для доли при n = 20 (по биномиальному распределению).
3) Бутстрэп-распределение медианы 40 времён ожидания; сверка с scipy.stats.bootstrap.
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
from gbcourse.style import BLUE, MUTED, ORANGE, RED

ex = Example(__file__)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))


def draw(rng, kind):
    return 10 + 10 * rng.normal() if kind == "norm" else -10 * math.log(1 - rng.random())


# 1. Покрытие t и z
ns = [3, 5, 10, 30, 100]
ax = axes[0]
for kind, mult, color, ls, label in [
    ("norm", "t", BLUE, "-", "нормальные, t"),
    ("norm", "z", BLUE, "--", "нормальные, 1.96"),
    ("exp", "t", ORANGE, "-", "скошенные, t"),
    ("exp", "z", ORANGE, "--", "скошенные, 1.96"),
]:
    cov = []
    for n in ns:
        rng = Mulberry32(1000 + n + (0 if kind == "exp" else 500))
        k = stats.t.ppf(0.975, n - 1) if mult == "t" else 1.959964
        hits = 0
        for _ in range(2000):
            x = np.array([draw(rng, kind) for _ in range(n)])
            h = k * x.std(ddof=1) / math.sqrt(n)
            hits += x.mean() - h <= 10 <= x.mean() + h
        cov.append(hits / 2000)
    print(f"{label:17s}: " + ", ".join(f"n={n}: {c:.3f}" for n, c in zip(ns, cov)))
    if kind == "norm" and mult == "t":
        assert all(abs(c - 0.95) < 0.015 for c in cov)
    if kind == "norm" and mult == "z":
        assert cov[0] < 0.85
    ax.plot(ns, cov, ls, marker="o", color=color, label=label)
ax.axhline(0.95, color=MUTED, ls=":")
ax.set(xscale="log", xlabel="n", ylabel="доля интервалов, накрывших μ", title="покрытие 95 %-го интервала", ylim=(0.7, 1))
ax.legend(fontsize=8)

# 2. Вальд против Уилсона
z = stats.norm.ppf(0.975)


def coverage(n, p, method):
    ks = np.arange(n + 1)
    ph = ks / n
    if method == "wald":
        h = z * np.sqrt(ph * (1 - ph) / n)
        lo, hi = ph - h, ph + h
    else:
        c = (ph + z * z / (2 * n)) / (1 + z * z / n)
        h = z * np.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / (1 + z * z / n)
        lo, hi = c - h, c + h
    return stats.binom.pmf(ks, n, p)[(lo <= p) & (p <= hi)].sum()


ps = np.linspace(0.002, 0.998, 499)
cw = np.array([coverage(20, p, "wald") for p in ps])
cu = np.array([coverage(20, p, "wilson") for p in ps])
print(f"n = 20: среднее покрытие Вальда {cw.mean():.3f}, Уилсона {cu.mean():.3f}; при p = 0.05: {coverage(20, 0.05, 'wald'):.3f} и {coverage(20, 0.05, 'wilson'):.3f}")
assert cu.mean() > cw.mean() + 0.05
ax = axes[1]
ax.plot(ps, cw, color=RED, lw=1.4, label="Вальд")
ax.plot(ps, cu, color=BLUE, lw=1.6, label="Уилсон")
ax.axhline(0.95, color=MUTED, ls=":")
ax.set(xlabel="истинная доля p", ylabel="точное покрытие", title="интервал для доли, n = 20", ylim=(0.5, 1.01))
ax.legend()

# 3. Бутстрэп медианы
rng = Mulberry32(33)
w = np.array([-10 * math.log(1 - rng.random()) for _ in range(40)])
r2 = Mulberry32(44)
boot = np.array([np.median(w[r2.bootstrap(40)]) for _ in range(2000)])
lo, hi = np.percentile(boot, [2.5, 97.5])
res = stats.bootstrap((w,), np.median, method="percentile", n_resamples=2000, random_state=0)
print(f"медиана {np.median(w):.2f}; бутстрэп-SE {boot.std(ddof=1):.2f}; интервал [{lo:.2f}, {hi:.2f}]; SciPy: [{res.confidence_interval.low:.2f}, {res.confidence_interval.high:.2f}]")
assert abs(boot.std(ddof=1) - res.standard_error) < 0.25
ax = axes[2]
ax.hist(boot, bins=40, color=BLUE, alpha=0.7)
ax.axvspan(lo, hi, color=BLUE, alpha=0.1, label="95 % перцентильный интервал")
ax.axvline(np.median(w), color="black", label="по выборке")
ax.axvline(10 * math.log(2), color=ORANGE, ls="--", label="истинная медиана")
ax.set(xlabel="медиана бутстрэп-выборки", ylabel="повторов", title="бутстрэп медианы (n = 40)")
ax.legend(fontsize=8)

fig.tight_layout()
ex.finish(fig, "confidence_intervals")
