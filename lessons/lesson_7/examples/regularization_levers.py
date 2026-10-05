"""Рычаги регуляризации по очереди: лучшая ошибка на валидации (среднее по 5 разбиениям).

Запуск:  python lessons/lesson_7/examples/regularization_levers.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=400, noise=0.6, seed=71)
configs = {
    "свободная": dict(learning_rate=1.0, max_depth=6),
    "ν = 0.05": dict(learning_rate=0.05, max_depth=6),
    "+ глубина 2": dict(learning_rate=0.05, max_depth=2),
    "+ subsample 0.5": dict(learning_rate=0.05, max_depth=2, subsample=0.5, seed=1),
    "+ min_leaf 10": dict(learning_rate=0.05, max_depth=2, subsample=0.5, seed=1, min_samples_leaf=10),
}
means, stds = [], []
for name, kw in configs.items():
    best = [min(GBRegressor(n_estimators=400, **kw).fit(a, c, eval_set=(b, d)).history_["eval"])
            for a, b, c, d in (datasets.train_test_split(X, y, test_size=0.3, seed=s) for s in range(5))]
    means.append(np.mean(best))
    stds.append(np.std(best))
    print(f"{name:16s}: {means[-1]:.4f} ± {stds[-1]:.4f}")
assert means[1] < means[0], "маленький темп должен помогать свободной модели"

fig, ax = plt.subplots(figsize=(8, 3.8))
ax.bar(range(len(means)), means, yerr=stds, color="#2a78d6", width=0.55, ecolor="#52514e")
ax.set_xticks(range(len(means)), list(configs), rotation=15)
ax.set(ylabel="лучшая ½·MSE на валидации", ylim=(0.1, max(means) * 1.15), title="Рычаги регуляризации по очереди")
ex.finish(fig, "regularization_levers")
