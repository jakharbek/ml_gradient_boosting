"""Разложение прогноза одного объекта на вклады признаков (точные значения Шепли) — «водопад».

Запуск:  python lessons/lesson_12/examples/shap_waterfall.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example
from gbcourse.explain import shapley_values
from gbcourse.style import ROLE

ex = Example(__file__)
X, y = datasets.friedman1(n=600, noise=1.0, seed=180, n_features=7)
model = GBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1).fit(X, y)
x = X[0]
base, phi = shapley_values(model, x)
fx = float(model.predict(X[:1])[0])
print(f"φ₀ = {base:.4f}, Σφ = {phi.sum():+.4f}, φ₀ + Σφ = {base + phi.sum():.4f}, F(x) = {fx:.4f}")
assert abs(base + phi.sum() - fx) < 1e-9

fig, ax = plt.subplots(figsize=(8, 3.8))
cur = base
ax.bar(0, base, color=ROLE["truth"])
for j, p in enumerate(phi):
    ax.bar(j + 1, p, bottom=cur, color="#d6452a" if p >= 0 else "#2a78d6")
    ax.text(j + 1, max(cur, cur + p) + 0.1, f"{p:+.2f}", ha="center", fontsize=8)
    cur += p
ax.bar(len(phi) + 1, fx, color=ROLE["model"])
ax.set(xticks=range(len(phi) + 2), xticklabels=["φ₀"] + [f"x{j}" for j in range(len(phi))] + ["F(x)"],
       ylim=(min(base, fx, cur) - 3, max(base, fx) + 3), ylabel="прогноз", title="База + вклады признаков = прогноз")
fig.tight_layout()
ex.finish(fig, "shap_waterfall")
