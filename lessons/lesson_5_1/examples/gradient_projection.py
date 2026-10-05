"""Шаг деревом как проекция антиградиента: косинус между псевдо-остатками и деревом.

Запуск:  python lessons/lesson_5_1/examples/gradient_projection.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import RegressionTree, datasets
from gbcourse.cli import Example

ex = Example(__file__)

X, y = datasets.regression_1d(kind="sine", n=200, noise=0.3, seed=52)
fig, ax = plt.subplots(figsize=(7.5, 3.8))
for depth in (1, 3, 6):
    F = np.full_like(y, y.mean())
    cos = []
    for _ in range(100):
        r = y - F
        hv = RegressionTree(max_depth=depth).fit(X, -r).predict(X)
        cos.append(r @ hv / (np.linalg.norm(r) * np.linalg.norm(hv) + 1e-12))
        # Для L2: <r, h> = ||h||² (листья — средние остатков)
        assert abs(r @ hv - hv @ hv) < 1e-8 * max(1.0, hv @ hv)
        F += 0.1 * hv
    ax.plot(cos, label=f"глубина {depth}")
    print(f"глубина {depth}: cos на шаге 1 = {cos[0]:.3f}, на шаге 100 = {cos[-1]:.3f}")
ax.set(xlabel="итерация", ylabel="cos∠(r, h)", title="Насколько дерево повторяет направление градиента")
ax.legend()
ex.finish(fig, "gradient_projection")
