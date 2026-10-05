"""Кривые валидации для разных темпов обучения (среднее по 5 разбиениям) и закон ν·M* ≈ const.

Запуск:  python lessons/lesson_4_2/examples/learning_rate_curves.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=300, noise=0.5, seed=7)
splits = [datasets.train_test_split(X, y, test_size=0.3, seed=s) for s in range(5)]
fig, ax = plt.subplots(figsize=(8, 4.2))
best_losses = {}
for nu in (1.0, 0.3, 0.1, 0.03):
    curves = [GBRegressor(n_estimators=round(60 / nu), learning_rate=nu, max_depth=3)
              .fit(a, c, eval_set=(b, d)).history_["eval"] for a, b, c, d in splits]
    ev = np.mean(curves, axis=0)
    best = int(np.argmin(ev))
    best_losses[nu] = ev.min()
    ax.plot(np.arange(1, len(ev)), ev[1:], label=f"ν = {nu}")
    print(f"ν = {nu:4}: M* = {best:4d}, ν·M* = {nu * best:4.1f}, лучшая ½MSE = {ev.min():.4f}")
assert best_losses[0.1] < best_losses[1.0], "в среднем маленький темп должен быть лучше ν = 1"
ax.set_xscale("log")
ax.set(xlabel="число деревьев", ylabel="½·MSE на валидации (среднее по 5 разбиениям)", ylim=(0.12, 0.35),
       title="Меньше шаг — правее и ниже минимум")
ax.legend()
ex.finish(fig, "learning_rate_curves")
