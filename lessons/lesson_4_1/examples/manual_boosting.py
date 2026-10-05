"""Бустинг на шести квартирах: две итерации с печатью всех промежуточных чисел.

Запуск:  python lessons/lesson_4_1/examples/manual_boosting.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.cli import Example
from gbcourse.plotting import plot_boosting_step

ex = Example(__file__)

X, y = datasets.toy_regression()
x = X[:, 0]
F = np.full_like(y, y.mean())
print(f"F0 = {F[0]:g}; сумма квадратов = {((y - F) ** 2).sum():g}")
for m in (1, 2):
    r = y - F
    best = max(((x[:-1] + x[1:]) / 2), key=lambda t: (x <= t).sum() * (x > t).sum() / len(x) * (r[x <= t].mean() - r[x > t].mean()) ** 2)
    left, right = r[x <= best].mean(), r[x > best].mean()
    F = F + np.where(x <= best, left, right)
    print(f"итерация {m}: остатки {r}, порог {best}, листья {left:+g}/{right:+g}, F{m} = {F}, "
          f"сумма квадратов = {((y - F) ** 2).sum():g}")

model = GBRegressor(n_estimators=2, learning_rate=1.0, max_depth=1).fit(X, y)
assert np.allclose(model.predict(X), F), "ручной расчёт должен совпасть с gbcourse"
assert np.allclose(F, [2.6, 2.6, 2.6, 8.6, 8.6, 11])

fig, axes = plt.subplots(2, 2, figsize=(11, 7))
plot_boosting_step(model, X, y, 1, axes=axes[0])
plot_boosting_step(model, X, y, 2, axes=axes[1])
fig.tight_layout()
ex.finish(fig, "manual_boosting")
