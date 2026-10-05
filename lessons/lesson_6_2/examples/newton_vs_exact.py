"""Шаг Ньютона для листа log-loss: сравнение с точным минимумом.

Запуск:  python lessons/lesson_6_2/examples/newton_vs_exact.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBClassifier, datasets
from gbcourse.cli import Example

ex = Example(__file__)
sig = lambda F: 1 / (1 + np.exp(-F))  # noqa: E731

X, y = datasets.toy_classification()
m = GBClassifier(n_estimators=1, learning_rate=1.0, max_depth=1).fit(X, y)
t = m.trees_[0][0]
left, right = t.nodes[t.nodes[0].left].value, t.nodes[t.nodes[0].right].value
print(f"первая итерация на 8 точках: листья {left:.4f} и {right:.4f}")
assert abs(left + 2) < 1e-12 and abs(right - 1.2) < 1e-12

# Правый лист: 4 объекта класса 1 и 1 класса 0, F = 0
gs = np.linspace(-1, 4, 400)
phi = [4 * (np.log1p(np.exp(g)) - g) + np.log1p(np.exp(g)) for g in gs]
G, H = 5 * 0.5 - 4, 5 * 0.25
quad = phi[np.argmin(np.abs(gs))] + G * gs + 0.5 * H * gs**2
fig, ax = plt.subplots(figsize=(7.5, 3.8))
ax.plot(gs, phi, label="точные потери листа")
ax.plot(gs, quad, ls="--", label="парабола Тейлора в γ = 0")
ax.axvline(-G / H, color="#eb6834", lw=1, label=f"Ньютон: {-G / H:.2f}")
ax.axvline(np.log(4), color="#2a78d6", lw=1, ls=":", label=f"точный: log 4 = {np.log(4):.2f}")
ax.set(xlabel="γ", ylabel="потери", ylim=(min(phi) - 0.2, max(phi)), title="Правый лист первой итерации")
ax.legend()
ex.finish(fig, "newton_vs_exact")
