"""Дерево на восьми квартирах вручную: перебор порогов, рекурсия, сверка со scikit-learn.

Запуск:  python lessons/lesson_2/examples/tree_by_hand.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.tree import DecisionTreeRegressor

from gbcourse.cli import Example
from gbcourse.style import ROLE

ex = Example(__file__)

area = np.array([30, 35, 42, 50, 62, 70, 78, 90])            # площадь, м²
dist = np.array([12, 3, 9, 4, 10, 2, 8, 3])                   # до центра, км
price = np.array([3.0, 5.0, 3.6, 5.8, 7.0, 9.6, 7.8, 10.6])   # цена, млн
X = np.c_[area, dist]
NAMES = ["площадь", "до центра"]


def sse(v):
    return float(((v - v.mean()) ** 2).sum()) if len(v) else 0.0


def best_split(X, y):
    """Перебор всех признаков и порогов: (выигрыш, признак, порог)."""
    best = (0.0, None, None)
    for j in range(X.shape[1]):
        vals = np.unique(X[:, j])
        for t in (vals[:-1] + vals[1:]) / 2:
            left = X[:, j] <= t
            gain = sse(y) - sse(y[left]) - sse(y[~left])
            if gain > best[0] + 1e-12:
                best = (gain, j, t)
    return best


def grow(X, y, max_depth, depth=0, leaves=None):
    """Рекурсивный рост; собирает листья как (маска-условия, значение)."""
    gain, j, t = best_split(X, y)
    pad = "    " * depth
    if depth == max_depth or j is None:
        print(f"{pad}лист: {y.mean():.2f} млн (квартир {len(y)}, SSE {sse(y):.2f})")
        return sse(y)
    print(f"{pad}{NAMES[j]} <= {t}?  выигрыш {gain:.2f}")
    left = X[:, j] <= t
    return grow(X[left], y[left], max_depth, depth + 1) + grow(X[~left], y[~left], max_depth, depth + 1)


print(f"Глубина 0: прогноз {price.mean():.2f}, SSE {sse(price):.2f}\n")
history = [sse(price)]
for d in (1, 2, 3):
    print(f"--- дерево глубины {d} ---")
    total = grow(X, price, d)
    sk = DecisionTreeRegressor(max_depth=d).fit(X, price)
    sk_sse = float(((price - sk.predict(X)) ** 2).sum())
    print(f"SSE: вручную {total:.2f}, scikit-learn {sk_sse:.2f}\n")
    assert np.isclose(total, sk_sse)
    history.append(total)
assert np.allclose(history, [51.74, 13.02, 1.32, 0.0])
print("Путь ошибки:", " → ".join(f"{h:.2f}" for h in history))

fig, axes = plt.subplots(1, 2, figsize=(11, 4))
tree = DecisionTreeRegressor(max_depth=2).fit(X, price)
ga, gd = np.meshgrid(np.linspace(25, 95, 300), np.linspace(0, 14, 300))
im = axes[0].pcolormesh(ga, gd, tree.predict(np.c_[ga.ravel(), gd.ravel()]).reshape(ga.shape), cmap="coolwarm", alpha=0.55, shading="auto")
axes[0].scatter(area, dist, color=ROLE["data"], edgecolor="white", zorder=3)
for a, d, p in zip(area, dist, price):
    axes[0].annotate(f"{p:g}", (a, d), textcoords="offset points", xytext=(6, 5), fontsize=9)
axes[0].set(xlabel="площадь, м²", ylabel="до центра, км", title="Дерево глубины 2: четыре прямоугольника")
fig.colorbar(im, ax=axes[0], label="прогноз, млн")
axes[1].bar(range(4), history, color=ROLE["model"])
for k, h in enumerate(history):
    axes[1].annotate(f"{h:.2f}", (k, h), ha="center", va="bottom", fontsize=10)
axes[1].set(xlabel="глубина дерева", ylabel="SSE на восьми квартирах", xticks=range(4), title="Каждый уровень вопросов уменьшает ошибку")
fig.tight_layout()
ex.finish(fig, "tree_by_hand")
