"""Поиск лучшего порога: кривая SSE(t) и найденный решающий пень.

Запуск:  python lessons/lesson_2_1/examples/split_search.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import RegressionTree, datasets
from gbcourse.cli import Example
from gbcourse.plotting import plot_data

ex = Example(__file__)

X, y = datasets.regression_1d("step", n=50, noise=0.4, seed=2)
x = X[:, 0]
ts = np.linspace(0.01, 9.99, 800)


def sse(t):
    left = x <= t
    if left.all() or (~left).all():
        return ((y - y.mean()) ** 2).sum()
    return ((y[left] - y[left].mean()) ** 2).sum() + ((y[~left] - y[~left].mean()) ** 2).sum()


curve = np.array([sse(t) for t in ts])
stump = RegressionTree(max_depth=1).fit(X, -y)
t_best = stump.nodes[0].threshold
print(f"лучший порог {t_best:.4f}, SSE {sse(t_best):.4f} (минимум кривой {curve.min():.4f})")
assert abs(sse(t_best) - curve.min()) < 1e-9

fig, axes = plt.subplots(2, 1, figsize=(8, 6), sharex=True)
plot_data(axes[0], X, y)
left, right = stump.nodes[stump.nodes[0].left], stump.nodes[stump.nodes[0].right]
axes[0].hlines([left.value, right.value], [0, t_best], [t_best, 10], colors=["#2a78d6", "#eb6834"], lw=2.4)
axes[0].axvline(t_best, color="#0b0b0b", lw=1.2)
axes[0].set(title="Решающий пень", ylabel="y")
axes[1].plot(ts, curve, drawstyle="steps-post")
axes[1].axvline(t_best, color="#0b0b0b", lw=1.2)
axes[1].set(xlabel="порог t", ylabel="SSE(t)", title="Сумма квадратов ошибок для каждого порога")
fig.tight_layout()
ex.finish(fig, "split_search")
