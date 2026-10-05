"""Прямое пошаговое построение: L2 → бустинг на остатках, экспонента → AdaBoost.

Запуск:  python lessons/lesson_3_3/examples/fsam_equivalences.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import AdaBoost, GBRegressor, RegressionTree, datasets
from gbcourse.cli import Example

ex = Example(__file__)

# L2: FSAM с деревьями = градиентный бустинг с ν = 1
X, y = datasets.regression_1d(kind="wave", n=80, noise=0.3, seed=2)
F = np.full_like(y, y.mean())
for _ in range(20):
    F += RegressionTree(max_depth=2).fit(X, -(y - F)).predict(X)
same_l2 = np.allclose(F, GBRegressor(n_estimators=20, learning_rate=1.0, max_depth=2).fit(X, y).predict(X))
print("FSAM(L2) = бустинг на остатках:", same_l2)

# Экспонента: оптимальный β для первого пня = α AdaBoost
Xc, yc = datasets.classification_2d(kind="moons", n=200, noise=0.25, seed=33)
ys = np.where(yc > 0, 1, -1)
ada = AdaBoost(n_estimators=1).fit(Xc, yc)
b = np.where(ada.trees_[0].predict(Xc) >= 0, 1, -1)
betas = np.linspace(0.01, 2, 4000)
loss = np.array([np.mean(np.exp(-bt * ys * b)) for bt in betas])
beta_star = betas[int(np.argmin(loss))]
print(f"оптимальный β = {beta_star:.4f}, α AdaBoost = {ada.alphas_[0]:.4f}")
assert same_l2 and abs(beta_star - ada.alphas_[0]) < 1e-3

fig, ax = plt.subplots(figsize=(7, 3.6))
ax.plot(betas, loss)
ax.axvline(ada.alphas_[0], color="#eb6834", ls=(0, (4, 3)), label="α = ½ ln((1−ε)/ε)")
ax.set(xlabel="β", ylabel="средние экспоненциальные потери", title="Шаг FSAM для экспоненциальных потерь")
ax.legend()
ex.finish(fig, "fsam_exponential_step")
