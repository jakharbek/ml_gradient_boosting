"""Ранняя остановка: кривые обучения, валидации и теста, точка остановки.

Запуск:  python lessons/lesson_7_1/examples/early_stopping_curves.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=600, noise=0.6, seed=72)
X_test, y_test = datasets.regression_1d(kind="wave", n=3000, noise=0.6, seed=73)
X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)
full = GBRegressor(n_estimators=600, learning_rate=0.1, max_depth=3).fit(X_tr, y_tr, eval_set=(X_val, y_val))
stopped = GBRegressor(n_estimators=600, learning_rate=0.1, max_depth=3, early_stopping_rounds=50).fit(X_tr, y_tr, eval_set=(X_val, y_val))
test_curve = [((y_test - F) ** 2).mean() / 2 for F in full.staged_predict_raw(X_test)]
print(f"обучено до остановки: {len(stopped.history_['eval']) - 1}, оставлено деревьев: {stopped.n_trees_}")
assert stopped.n_trees_ == stopped.best_iteration_

fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(full.history_["train"], label="обучение")
ax.plot(full.history_["eval"], label="валидация")
ax.plot(range(1, len(test_curve) + 1), test_curve, ls="--", label="тест")
ax.axvline(len(stopped.history_["eval"]) - 1, color="#e34948", lw=1.2, label="остановка (patience 50)")
ax.axvline(stopped.best_iteration_, color="#898781", lw=1, ls=":", label="лучшая итерация")
ax.set(xlabel="итерация", ylabel="½MSE", ylim=(0.08, 0.3))
ax.legend()
ex.finish(fig, "early_stopping_curves")
