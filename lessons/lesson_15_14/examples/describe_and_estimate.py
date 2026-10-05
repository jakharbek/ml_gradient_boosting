"""Описание данных и оценки: устойчивость, поправка Бесселя, сжатие, среднее против медианы.

Запуск:  python lessons/lesson_15_14/examples/describe_and_estimate.py [--save] [--no-show]

1) Маскировка выбросов: правило |z| > 3 против медианы ± 3·MAD и заборов Тьюки при растущем числе выбросов.
2) Смещение оценки дисперсии (деление на n); MSE сжатой оценки среднего c·x̄ — в выводе.
3) Эффективность: отношение дисперсий медианы и среднего для нормального, Лапласа и засорённого распределений.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE

ex = Example(__file__)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))

# 1. Маскировка выбросов
rng = Mulberry32(3)
base = np.array([50 + 5 * rng.normal() for _ in range(30)])
ks = np.arange(0, 9)
found = {"|z| > 3": [], "медиана ± 3·MAD": [], "заборы Тьюки": []}
for k in ks:
    x = np.r_[base, 100 + 2 * np.arange(k)]
    med = np.median(x)
    mad = 1.4826 * np.median(np.abs(x - med))
    q1, q3 = np.percentile(x, [25, 75])
    found["|z| > 3"].append(np.sum(np.abs(x - x.mean()) > 3 * x.std(ddof=1)))
    found["медиана ± 3·MAD"].append(np.sum(np.abs(x - med) > 3 * mad))
    found["заборы Тьюки"].append(np.sum((x < q1 - 1.5 * (q3 - q1)) | (x > q3 + 1.5 * (q3 - q1))))
    if k in (1, 5):
        print(f"{k} выбросов около 100: s = {x.std(ddof=1):.1f}, |z| > 3 нашло {found['|z| > 3'][-1]}, MAD — {found['медиана ± 3·MAD'][-1]}, Тьюки — {found['заборы Тьюки'][-1]}")
assert found["|z| > 3"][5] == 0 and found["медиана ± 3·MAD"][5] == 5
ax = axes[0]
ax.plot(ks, ks, ":", color=MUTED, label="все выбросы")
for (name, v), color, st, ms in zip(found.items(), (BLUE, AQUA, ORANGE), ("o-", "s--", "^:"), (6, 9, 5)):
    ax.plot(ks, v, st, color=color, ms=ms, mfc="none" if st == "s--" else color, label=name)
ax.set(xlabel="число выбросов среди 30 значений", ylabel="найдено", title="маскировка выбросов")
ax.legend()

# 2. Смещение дисперсии и сжатие
rng = Mulberry32(100)
ns = np.arange(2, 21)
avg_n = []
for n in ns:
    v = [np.var([rng.normal() for _ in range(n)]) for _ in range(2000)]
    avg_n.append(np.mean(v))
avg_n = np.array(avg_n)
print("средняя оценка /n при n = 5:", round(avg_n[3], 3), "(теория 0.8)")
assert np.all(np.abs(avg_n - (ns - 1) / ns) < 0.05)
c = np.linspace(0, 1, 201)
mu, n = 0.5, 5
mse = (1 - c) ** 2 * mu**2 + c**2 / n
c_star = mu**2 / (mu**2 + 1 / n)
print(f"сжатие: c* = {c_star:.3f}, MSE(c*) = {mse.min():.4f} против MSE(1) = {mse[-1]:.4f}")
assert mse.min() < mse[-1] * 0.6
ax = axes[1]
ax.plot(ns, avg_n, "o", color=ORANGE, label="деление на n (симуляция)")
ax.plot(ns, (ns - 1) / ns, color=ORANGE, lw=1, label="теория (n − 1)/n")
ax.axhline(1, color=BLUE, ls="--", label="деление на n − 1 (несмещённая)")
ax.set(xlabel="n", ylabel="средняя оценка σ² (σ² = 1)", title="смещение оценки дисперсии", ylim=(0.45, 1.1))
ax.legend(fontsize=8)


# 3. Эффективность
def draw(rng, kind):
    if kind == "нормальное":
        return rng.normal()
    if kind == "Лапласа":
        u = rng.random() - 0.5
        return -math.sqrt(0.5) * np.sign(u) * math.log(1 - 2 * abs(u))
    u, z = rng.random(), rng.normal()
    return 10 * z if u < 0.1 else z


theory = {"нормальное": math.pi / 2, "Лапласа": 0.5, "засорённое": 0.174}
ax = axes[2]
for (kind, th), color in zip(theory.items(), (BLUE, ORANGE, AQUA)):
    rng = Mulberry32(7)
    ratios = []
    for n in (5, 11, 25, 51, 101):
        mm, md = [], []
        for _ in range(1500):
            s = np.array([draw(rng, kind) for _ in range(n)])
            mm.append(s.mean())
            md.append(np.median(s))
        ratios.append(np.var(md) / np.var(mm))
    print(f"{kind:11s}: Var(медианы)/Var(среднего) при n = 101 — {ratios[-1]:.3f} (предел {th:.3f})")
    assert abs(ratios[-1] - th) < 0.25 * th
    ax.plot([5, 11, 25, 51, 101], ratios, "o-", color=color, label=kind)
    ax.axhline(th, color=color, ls=":", lw=1)
ax.set(xscale="log", xlabel="n", ylabel="Var(медианы) / Var(среднего)", title="среднее против медианы")
ax.legend()

fig.tight_layout()
ex.finish(fig, "describe_and_estimate")
