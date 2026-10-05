"""Множественные сравнения: FWER и FDR, проклятие победителя, регрессия к среднему.

Запуск:  python lessons/lesson_15_14/examples/multiple_testing.py [--save] [--no-show]

1) 100 проверок, из них 10 настоящих эффектов: FWER и FDR без поправки, с Бонферрони, Холмом и BH (500 повторов).
2) Проклятие победителя: завышение оценки лучшего из k одинаковых вариантов против ожидаемого максимума нормальных.
3) Регрессия к среднему: лучшие 10 % по первой попытке во второй попытке при разной надёжности теста.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import integrate, stats

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))


# 1. FWER и FDR
def holm(p, alpha=0.05):
    order = np.argsort(p)
    rej = np.zeros(len(p), bool)
    for k, i in enumerate(order):
        if p[i] > alpha / (len(p) - k):
            break
        rej[i] = True
    return rej


m, n_true, alpha = 100, 10, 0.05
truth = np.arange(m) < n_true
rng = Mulberry32(16)
res = {"без поправки": [], "Бонферрони": [], "Холм": [], "BH": []}
for _ in range(500):
    p = np.array([stats.norm.sf((3 if t else 0) + rng.normal()) for t in truth])
    rules = {
        "без поправки": p <= alpha,
        "Бонферрони": p <= alpha / m,
        "Холм": holm(p),
        "BH": stats.false_discovery_control(p) <= alpha,
    }
    for k, r in rules.items():
        false = np.sum(r & ~truth)
        res[k].append((false > 0, false / max(1, r.sum()), np.sum(r & truth) / n_true))
summary = {k: np.array(v).mean(axis=0) for k, v in res.items()}
for k, (fwer, fdr, power) in summary.items():
    print(f"{k:13s}: FWER {fwer:.2f}, FDR {fdr:.3f}, найдено настоящих {power:.0%}")
assert summary["Бонферрони"][0] <= 0.07 and summary["BH"][1] <= 0.07 and summary["без поправки"][0] > 0.9
assert summary["BH"][2] > summary["Холм"][2] >= summary["Бонферрони"][2]
ax = axes[0]
names = list(summary)
x = np.arange(len(names))
ax.bar(x - 0.27, [summary[k][0] for k in names], 0.25, color=ORANGE, label="FWER")
ax.bar(x, [summary[k][1] for k in names], 0.25, color=VIOLET, label="FDR")
ax.bar(x + 0.27, [summary[k][2] for k in names], 0.25, color=BLUE, label="доля найденных эффектов")
ax.axhline(0.05, color=MUTED, ls=":")
ax.set_xticks(x, names)
ax.set(title="100 проверок, 10 настоящих эффектов", ylabel="доля")
ax.legend(fontsize=8)

# 2. Проклятие победителя
ks = [1, 2, 5, 10, 20, 50, 100]
theory = [integrate.quad(lambda t, k=k: t * k * stats.norm.pdf(t) * stats.norm.cdf(t) ** (k - 1), -10, 10)[0] for k in ks]
rng = Mulberry32(61)
sim = [np.mean([max(rng.normal() for _ in range(k)) for _ in range(2000)]) for k in ks]
for k, t, s in zip(ks, theory, sim):
    print(f"k = {k:3d}: средний максимум {s:.2f} SE (теория {t:.2f})")
assert all(abs(t - s) < 0.06 for t, s in zip(theory, sim))
ax = axes[1]
ax.plot(ks, theory, color=BLUE, label="теория E max")
ax.plot(ks, sim, "o", color=ORANGE, label="симуляция")
ax.set(xscale="log", xlabel="вариантов k", ylabel="завышение лучшего, в SE", title="проклятие победителя")
ax.legend()

# 3. Регрессия к среднему
ax = axes[2]
rs = [0.2, 0.3, 0.5, 0.7, 0.9]
second = []
for r in rs:
    se = np.sqrt((1 - r) / r)
    rng = Mulberry32(1700)
    t = np.array([rng.normal() for _ in range(4000)])
    x1 = (t + se * np.array([rng.normal() for _ in range(4000)])) / np.sqrt(1 + se**2)
    x2 = (t + se * np.array([rng.normal() for _ in range(4000)])) / np.sqrt(1 + se**2)
    top = x1 >= np.quantile(x1, 0.9)
    second.append((x1[top].mean(), x2[top].mean()))
    print(f"r = {r}: лучшие 10 % — 1-я попытка {x1[top].mean():.2f}, 2-я {x2[top].mean():.2f}, прогноз r·x̄ = {r * x1[top].mean():.2f}")
    assert abs(x2[top].mean() - r * x1[top].mean()) < 0.1
ax.plot(rs, [a for a, _ in second], "o-", color=MUTED, label="1-я попытка (по ней отбирали)")
ax.plot(rs, [b for _, b in second], "o-", color=AQUA, label="2-я попытка")
ax.plot(rs, [r * a for r, (a, _) in zip(rs, second)], "--", color=BLUE, label="прогноз r·x̄₁")
ax.set(xlabel="надёжность теста r", ylabel="средний результат лучших 10 %", title="регрессия к среднему")
ax.legend(fontsize=8)

fig.tight_layout()
ex.finish(fig, "multiple_testing")
