"""k-блочная кросс-валидация с нуля и утечка при отборе признаков.

Запуск:  python lessons/lesson_1_4/examples/cross_validation.py [--save] [--no-show]

Часть 1: 80 точек синуса, блоки строятся перестановкой Mulberry32 (как в виджете шага 10 урока).
Для глубин дерева 1…10 считается CV-оценка (среднее ± ст. откл.) и ошибка на 400 новых точках.
Часть 2: на чистом шуме отбор признаков до кросс-валидации даёт R² > 0, а честный отбор внутри блоков — нет.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.feature_selection import SelectKBest, f_regression
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import KFold, cross_val_score
from sklearn.pipeline import make_pipeline

from gbcourse import RegressionTree, datasets, style
from gbcourse.cli import Example
from gbcourse.metrics import mse
from gbcourse.rng import Mulberry32

ex = Example(__file__)

# --- часть 1: кросс-валидация с нуля
X, y = datasets.regression_1d(kind="sine", n=80, noise=0.4, seed=7)
Xt, yt = datasets.regression_1d(kind="sine", n=400, noise=0.4, seed=107)
results = {}
for k in (2, 5, 10):
    perm = Mulberry32(0).permutation(len(y))
    fold = np.empty(len(y), dtype=int)
    fold[perm] = np.arange(len(y)) % k  # блок j: perm[j], perm[j + k], …
    rows = []
    for d in range(1, 11):
        sc = [mse(y[fold == j], RegressionTree(max_depth=d).fit(X[fold != j], -y[fold != j]).predict(X[fold == j])) for j in range(k)]
        rows.append((np.mean(sc), np.std(sc)))
    results[k] = np.array(rows)
test_err = np.array([mse(yt, RegressionTree(max_depth=d).fit(X, -y).predict(Xt)) for d in range(1, 11)])

print("глубина   CV k=2         CV k=5         CV k=10        новые данные")
for d in range(10):
    cells = "  ".join(f"{results[k][d, 0]:.3f} ± {results[k][d, 1]:.3f}" for k in (2, 5, 10))
    print(f"{d + 1:7d}   {cells}   {test_err[d]:.3f}")
best_cv = int(np.argmin(results[5][:, 0])) + 1
best_test = int(np.argmin(test_err)) + 1
print(f"\n5-блочная CV выбирает глубину {best_cv}; по новым данным лучшая — {best_test}")
assert best_cv == best_test == 4

# --- часть 2: утечка
rng = Mulberry32(42)
Xn = np.array([[rng.normal() for _ in range(1000)] for _ in range(60)])
yn = np.array([rng.normal() for _ in range(60)])
cv = KFold(n_splits=5, shuffle=True, random_state=0)
top = SelectKBest(f_regression, k=10).fit(Xn, yn).get_support()
wrong = cross_val_score(LinearRegression(), Xn[:, top], yn, cv=cv, scoring="r2").mean()
right = cross_val_score(make_pipeline(SelectKBest(f_regression, k=10), LinearRegression()), Xn, yn, cv=cv, scoring="r2").mean()
print(f"\nчистый шум: отбор по всем данным R² = {wrong:+.3f}, отбор внутри блоков R² = {right:+.3f}")
assert wrong > 0.3 and right < 0

fig, ax = plt.subplots(figsize=(8, 3.8))
for k, color in zip((2, 5, 10), style.SERIES):
    m, s = results[k][:, 0], results[k][:, 1]
    ax.plot(range(1, 11), m, marker="o", color=color, label=f"CV, k = {k}")
    ax.fill_between(range(1, 11), m - s, m + s, color=color, alpha=0.08)
ax.plot(range(1, 11), test_err, marker="s", color=style.INK, ls=(0, (5, 3)), label="новые данные")
ax.set(xlabel="глубина дерева", ylabel="MSE", title="Кросс-валидация как оценка ошибки на новых данных")
ax.legend()
fig.tight_layout()
ex.finish(fig, "cross_validation")
