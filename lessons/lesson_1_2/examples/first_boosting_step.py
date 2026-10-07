"""Первый шаг бустинга руками: старт, псевдо-остатки, пень, значения листьев.

Запуск:  python lessons/lesson_1_2/examples/first_boosting_step.py [--save] [--no-show]

Пять точек x = 1..5, y = (1, 2, 3, 4, 10). Для каждой потери: F0 — лучшая константа,
псевдо-остатки −∂L/∂F, пень выбирает разбиение по псевдо-остаткам, а значение листа —
лучшая константа для самих потерь. Результат сверяется с одним деревом GBRegressor.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, get_loss, style
from gbcourse.cli import Example

ex = Example(__file__)

x = np.arange(1, 6.0)
y = np.array([1, 2, 3, 4, 10.0])
SPLITS = (1.5, 2.5, 3.5, 4.5)
CASES = [("squared", {}, {}), ("absolute", {}, {}), ("huber", {"delta": 3.0}, {"huber_delta": 3.0}), ("quantile", {"alpha": 0.9}, {"quantile_alpha": 0.9})]

fig, axes = plt.subplots(1, 4, figsize=(13, 3.4), sharey=True)
results = {}
for ax, (name, kw, gb_kw) in zip(axes, CASES):
    loss = get_loss(name, **kw)
    F = np.full_like(y, loss.init(y))                       # шаг 0: лучшая константа
    g = loss.negative_gradient(y, F)                        # шаг 1: псевдо-остатки
    sse = [sum(((g[m] - g[m].mean()) ** 2).sum() for m in (x < t, x > t)) for t in SPLITS]
    t = SPLITS[int(np.argmin(sse))]                         # шаг 2: лучшее разбиение (при равенстве — первое)
    left = x < t
    gamma = (loss.leaf_value(y[left], F[left]), loss.leaf_value(y[~left], F[~left]))  # шаг 3: листья
    F1 = F + np.where(left, *gamma)
    results[name] = (t, gamma, loss.loss(y, F), loss.loss(y, F1))
    print(f"{name:8s} F0 = {F[0]:.2f}  g = {np.round(g, 2)}  разброс {np.round(sse, 3)} → x ≤ {t}; "
          f"γ = ({gamma[0]:+.3f}, {gamma[1]:+.3f}); потери {loss.loss(y, F):.3f} → {loss.loss(y, F1):.3f}")
    # сверка с библиотекой: одно дерево глубины 1 с темпом 1
    gb = GBRegressor(loss=name, n_estimators=1, learning_rate=1.0, max_depth=1, **gb_kw).fit(x.reshape(-1, 1), y)
    assert np.allclose(gb.predict(x.reshape(-1, 1)), F1), name
    ax.scatter(x, y, color=style.MUTED, zorder=3, label="данные")
    ax.axhline(F[0], color=style.BLUE, alpha=0.45, ls=(0, (4, 3)), label="F₀")
    ax.stairs([F1[0], F1[-1]], [0.5, t, 5.5], color=style.BLUE, lw=2.2, label="F₁", baseline=None)
    ax.set(title=name, xlabel="x")
axes[0].set_ylabel("y и прогноз")
axes[0].legend(fontsize=8)

assert results["squared"][0] == 4.5, "L2 тратит разбиение на выброс"
assert results["absolute"][0] == 2.5 and results["absolute"][1] == (-1.5, 1.0), "L1 делит основную массу, лист — медиана"
ex.finish(fig, "first_boosting_step")
