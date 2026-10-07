"""От константы к модели: среднее, медиана и квантиль в каждой группе.

Запуск:  python lessons/lesson_1_2/examples/conditional_quantiles.py [--save] [--no-show]

240 доставок: время зависит от расстояния и скошено вправо. Одна константа — это лучшая
константа шагов 5–8; константа в каждой группе по расстоянию — уже модель: с L2 она
предсказывает условное среднее, с L1 — условную медиану, с pinball — условную квантиль.
В конце то же делает бустинг с квантильными потерями.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, style
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32

ex = Example(__file__)
ALPHA = 0.9


def deliveries(n: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """Расстояние x ∈ [0.5, 10] км и время y = 8 + 2.2x + (1 + 0.35x)·e^{0.6z} — как в виджете урока."""
    rng = Mulberry32(seed)
    x, y = [], []
    for _ in range(n):
        xi = rng.uniform(0.5, 10)
        z = rng.normal()
        x.append(xi)
        y.append(8 + 2.2 * xi + (1 + 0.35 * xi) * np.exp(0.6 * z))
    return np.array(x), np.array(y)


def exact_quantile(v: np.ndarray, alpha: float) -> float:
    """Наблюдение с номером ⌈αn⌉ — точный минимизатор pinball-потерь."""
    return float(np.sort(v)[int(np.ceil(alpha * len(v) - 1e-9)) - 1])


x, y = deliveries(240, 21)
xn, yn = deliveries(240, 22)
near, far = xn < 3.5, xn > 7

fig, axes = plt.subplots(1, 2, figsize=(11, 4), sharey=True)
coverage = {}
for ax, k in zip(axes, (1, 4)):
    group = lambda v, k=k: np.minimum(((v - 0.5) / 9.5 * k).astype(int), k - 1)  # noqa: E731
    g, gn = group(x), group(xn)
    stats = {
        "среднее (L2)": np.array([y[g == j].mean() for j in range(k)]),
        "медиана (L1)": np.array([np.median(y[g == j]) for j in range(k)]),
        f"{ALPHA}-квантиль": np.array([exact_quantile(y[g == j], ALPHA) for j in range(k)]),
    }
    q = stats[f"{ALPHA}-квантиль"]
    cover = yn <= q[gn]
    coverage[k] = (cover.mean(), cover[near].mean(), cover[far].mean())
    print(f"k = {k}: покрытие {ALPHA}-квантили на новых {cover.mean():.0%}; близкие {cover[near].mean():.0%}, дальние {cover[far].mean():.0%}")
    ax.scatter(x, y, s=10, color=style.MUTED, alpha=0.6, label="доставки")
    edges = np.linspace(0.5, 10, k + 1)
    for (name, vals), color in zip(stats.items(), (style.BLUE, style.AQUA, style.ORANGE)):
        ax.stairs(vals, edges, color=color, lw=2.2, label=name, baseline=None)
    ax.set(xlabel="расстояние, км", title=f"{k} {'группа' if k == 1 else 'группы'}")
axes[0].set_ylabel("время доставки, мин")
axes[0].legend(fontsize=8)

# Бустинг с квантильными потерями: группы выбирает сам — это листья деревьев
gb = GBRegressor(loss="quantile", quantile_alpha=ALPHA, n_estimators=150, learning_rate=0.1, max_depth=2, min_samples_leaf=10).fit(x.reshape(-1, 1), y)
cover_gb = yn <= gb.predict(xn.reshape(-1, 1))
print(f"бустинг (квантильные потери, α = {ALPHA}): покрытие на новых {cover_gb.mean():.0%}; "
      f"близкие {cover_gb[near].mean():.0%}, дальние {cover_gb[far].mean():.0%}")
xs = np.linspace(0.5, 10, 300)
axes[1].plot(xs, gb.predict(xs.reshape(-1, 1)), color=style.INK, lw=1.4, ls=(0, (4, 3)), label="бустинг, α = 0.9")
axes[1].legend(fontsize=8)

# Одна константа несправедлива: близким почти всегда, дальним — гораздо реже
assert coverage[1][1] - coverage[1][2] > 0.3
# Константа в каждой группе выравнивает покрытие
assert abs(coverage[4][1] - coverage[4][2]) < 0.1
assert 0.8 < cover_gb.mean() < 0.97
ex.finish(fig, "conditional_quantiles")
