"""Проверка гипотез: мощность, парный план, подглядывание, Манн — Уитни и AUC.

Запуск:  python lessons/lesson_15_14/examples/hypothesis_tests.py [--save] [--no-show]

1) Мощность z-критерия: формула Φ(d√n − z) против доли отвержений в симуляции.
2) Распределение p-значений при верной H₀: одна проверка в конце против подглядывания каждые 10 наблюдений.
3) Статистика Манна — Уитни U/(n₁n₀) совпадает с roc_auc_score; парный t-критерий мощнее критерия Уэлча.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import stats
from sklearn.metrics import roc_auc_score

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, RED

ex = Example(__file__)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))

# 1. Мощность
zc = stats.norm.ppf(0.975)
ns = np.array([10, 20, 50, 100, 200])
ax = axes[0]
for d, color in ((0.2, BLUE), (0.3, ORANGE), (0.5, AQUA)):
    theory = stats.norm.sf(zc - d * np.sqrt(ns)) + stats.norm.cdf(-zc - d * np.sqrt(ns))
    rng = Mulberry32(int(d * 100))
    sim = []
    for n in ns:
        rej = 0
        for _ in range(1000):
            m = np.mean([rng.normal(d, 1) for _ in range(n)])
            rej += abs(m) * math.sqrt(n) > zc
        sim.append(rej / 1000)
    print(f"d = {d}: мощность (формула / симуляция) — " + ", ".join(f"n={n}: {t:.2f}/{s:.2f}" for n, t, s in zip(ns, theory, sim)))
    assert np.all(np.abs(np.array(sim) - theory) < 0.05)
    grid = np.arange(5, 201)
    ax.plot(grid, stats.norm.sf(zc - d * np.sqrt(grid)), color=color, label=f"d = {d}: формула")
    ax.plot(ns, sim, "o", color=color)
ax.axhline(0.8, color=MUTED, ls=":")
ax.set(xlabel="n", ylabel="мощность", title="мощность: формула (линии) и симуляция (точки)")
ax.legend(fontsize=8)

# 2. Подглядывание
def pvals(peek, seed, n=100):
    rng = Mulberry32(seed)
    out = []
    for _ in range(2000):
        total, p = 0.0, 1.0
        for i in range(1, n + 1):
            total += rng.normal()
            if peek and i % 10 == 0:
                p = 2 * stats.norm.sf(abs(total) / math.sqrt(i))
                if p < 0.05:
                    break
        if not peek:
            p = 2 * stats.norm.sf(abs(total) / math.sqrt(n))
        out.append(p)
    return np.array(out)


p_fix, p_peek = pvals(False, 1400), pvals(True, 1400)
print(f"H₀ верна: доля p < 0.05 — один раз в конце {np.mean(p_fix < 0.05):.3f}, подглядывание {np.mean(p_peek < 0.05):.3f}")
print("критерий Колмогорова — Смирнова на равномерность p (одна проверка): p =", round(stats.kstest(p_fix, "uniform").pvalue, 3))
assert np.mean(p_peek < 0.05) > 3 * np.mean(p_fix < 0.05)
ax = axes[1]
ax.hist(p_fix, bins=20, range=(0, 1), density=True, color=BLUE, alpha=0.6, label="одна проверка в конце")
ax.hist(p_peek, bins=20, range=(0, 1), density=True, histtype="step", color=RED, lw=2, label="подглядывание каждые 10")
ax.axhline(1, color=MUTED, ls="--")
ax.set(xlabel="p-значение", ylabel="плотность", title="p-значения при верной H₀")
ax.legend(fontsize=8)

# 3. Манн — Уитни = AUC; парный план
rng = Mulberry32(5)
y = np.array([1 if rng.random() < 0.3 else 0 for _ in range(300)])
score = np.array([rng.normal() + 1.0 * yi for yi in y])
u = stats.mannwhitneyu(score[y == 1], score[y == 0]).statistic
auc = roc_auc_score(y, score)
print(f"U/(n₁n₀) = {u / (y.sum() * (len(y) - y.sum())):.6f}, roc_auc_score = {auc:.6f}")
assert abs(u / (y.sum() * (len(y) - y.sum())) - auc) < 1e-12

rng = Mulberry32(919)
pw, pp = [], []
for _ in range(500):
    base = np.array([30 + 5 * rng.normal() for _ in range(12)])
    a = base + np.array([1.5 * rng.normal() for _ in range(12)])
    b = base - 1 + np.array([1.5 * rng.normal() for _ in range(12)])
    pw.append(stats.ttest_ind(a, b, equal_var=False).pvalue)
    pp.append(stats.ttest_rel(a, b).pvalue)
pw, pp = np.array(pw), np.array(pp)
print(f"500 экспериментов (эффект 1 с, разброс людей 5 с): мощность Уэлча {np.mean(pw < 0.05):.2f}, парного {np.mean(pp < 0.05):.2f}")
assert np.mean(pp < 0.05) > np.mean(pw < 0.05) + 0.3
ax = axes[2]
bins = np.linspace(0, 1, 21)
ax.hist(pw, bins=bins, color=ORANGE, alpha=0.6, label=f"Уэлч: мощность {np.mean(pw < 0.05):.2f}")
ax.hist(pp, bins=bins, histtype="step", color=BLUE, lw=2, label=f"парный: мощность {np.mean(pp < 0.05):.2f}")
ax.set(xlabel="p-значение", ylabel="экспериментов", title="одни данные, два критерия")
ax.legend(fontsize=8)

fig.tight_layout()
ex.finish(fig, "hypothesis_tests")
