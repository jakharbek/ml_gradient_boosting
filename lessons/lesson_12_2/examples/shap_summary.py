"""Сводный график значений Шепли (beeswarm) и график зависимости для x0 с раскраской по x1.

Запуск:  python lessons/lesson_12_2/examples/shap_summary.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example
from gbcourse.explain import shapley_values

ex = Example(__file__)
X, y = datasets.friedman1(n=600, noise=1.0, seed=180, n_features=7)
model = GBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1).fit(X, y)
N = 200
res = [shapley_values(model, X[i]) for i in range(N)]
phi = np.array([r[1] for r in res])
worst = max(abs(r[0] + r[1].sum() - model.predict(X[i:i + 1])[0]) for i, r in enumerate(res))
print(f"аддитивность: наибольшая |φ₀ + Σφ − F(x)| = {worst:.1e}")
order = np.argsort(np.abs(phi).mean(0))
print("средний |φ| по признакам:", {f"x{j}": round(float(np.abs(phi[:, j]).mean()), 3) for j in order[::-1]})
assert np.abs(phi[:, 5:]).mean() < 0.2 * np.abs(phi[:, :5]).mean()

fig, axes = plt.subplots(1, 2, figsize=(13, 4))
jit = np.random.default_rng(0).uniform(-0.3, 0.3, N)
for row, j in enumerate(order):
    sc = axes[0].scatter(phi[:, j], row + jit, c=X[:N, j], cmap="coolwarm", s=8)
axes[0].set(yticks=range(7), yticklabels=[f"x{j}" for j in order], xlabel="φ (вклад в прогноз)", title="Сводный график")
axes[0].axvline(0, color="#999", lw=1)
fig.colorbar(sc, ax=axes[0], label="значение признака")
sc2 = axes[1].scatter(X[:N, 0], phi[:, 0], c=X[:N, 1], cmap="coolwarm", s=10)
axes[1].set(xlabel="x0", ylabel="φ(x0)", title="Зависимость x0, цвет — x1")
fig.colorbar(sc2, ax=axes[1], label="x1")
fig.tight_layout()
ex.finish(fig, "shap_summary")
