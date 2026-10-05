"""Стохастический бустинг: подвыборка помогает вместе с маленьким темпом.

Запуск:  python lessons/lesson_7_2/examples/subsample_vs_learning_rate.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example

ex = Example(__file__)

X, y = datasets.friedman1(n=400, noise=1.0, seed=74)
subs = [1.0, 0.8, 0.5, 0.3]
fig, ax = plt.subplots(figsize=(7.5, 3.8))
for lr, M in ((1.0, 80), (0.1, 400)):
    vals = []
    for s in subs:
        best = [min(GBRegressor(n_estimators=M, learning_rate=lr, max_depth=3, subsample=s, seed=1).fit(a, c, eval_set=(b, d)).history_["eval"])
                for a, b, c, d in (datasets.train_test_split(X, y, test_size=0.3, seed=k) for k in range(3))]
        vals.append(np.mean(best))
    ax.plot(subs, vals, marker="o", label=f"ν = {lr}")
    print(f"ν = {lr}: " + ", ".join(f"subsample {s}: {v:.3f}" for s, v in zip(subs, vals)))
ax.invert_xaxis()
ax.set(xlabel="subsample (доля строк на дерево)", ylabel="лучшая ½MSE на валидации", title="Подвыборка и темп обучения")
ax.legend()
ex.finish(fig, "subsample_vs_learning_rate")
