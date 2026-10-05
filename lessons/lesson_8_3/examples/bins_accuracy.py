"""Точность бустинга второго порядка в зависимости от числа корзин гистограммы (max_bins).

Запуск:  python lessons/lesson_8_3/examples/bins_accuracy.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example
from gbcourse.style import ROLE

ex = Example(__file__)

X, y = datasets.friedman1(n=3000, noise=1.0, seed=84)
a, b, c, d = datasets.train_test_split(X, y, test_size=0.3, seed=0)
params = dict(mode="newton", n_estimators=150, learning_rate=0.1, max_depth=4, reg_lambda=1)
exact = min(GBRegressor(**params).fit(a, c, eval_set=(b, d)).history_["eval"])
bins = [2, 4, 8, 16, 32, 64, 128, 255]
scores = [min(GBRegressor(max_bins=B, **params).fit(a, c, eval_set=(b, d)).history_["eval"]) for B in bins]
print(f"точный перебор: {exact:.4f}")
for B, sc in zip(bins, scores):
    print(f"{B:4d} корзин: {sc:.4f}")

fig, ax = plt.subplots(figsize=(8, 3.8))
ax.plot(bins, scores, marker="o", color=ROLE["tree"], label="гистограмма")
ax.axhline(exact, color=ROLE["model"], ls="--", label="точный перебор")
ax.set(xscale="log", xlabel="корзин (max_bins)", ylabel="лучшая ½MSE на валидации", title="От 32 корзин гистограмма не хуже точного перебора")
ax.set_xticks(bins, [str(B) for B in bins])
ax.legend()
fig.tight_layout()
ex.finish(fig, "bins_accuracy")
