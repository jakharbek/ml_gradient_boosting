"""Решения упражнений урока 4.1.

Запуск:  python lessons/lesson_4_1/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets

X, y = datasets.toy_regression()
x = X[:, 0]


def best_stump(r):
    best = None
    for t in (x[:-1] + x[1:]) / 2:
        L, R = r[x <= t], r[x > t]
        gain = len(L) * len(R) / len(r) * (L.mean() - R.mean()) ** 2
        if best is None or gain > best[1] + 1e-12:
            best = (t, gain, L.mean(), R.mean())
    return best


# 1
F2 = np.array([2.6, 2.6, 2.6, 8.6, 8.6, 11])
r3 = y - F2
t, gain, lv, rv = best_stump(r3)
F3 = F2 + np.where(x <= t, lv, rv)
print(f"1) r(3) = {np.round(r3, 3)}; порог {t}, листья {lv:+.3f}/{rv:+.3f}, выигрыш {gain:.3f}")
print(f"   F3 = {np.round(F3, 3)}; сумма квадратов {((y - F3) ** 2).sum():.3f}")
assert np.allclose(F3, GBRegressor(n_estimators=3, learning_rate=1.0, max_depth=1).fit(X, y).predict(X))

# 2
r = y - np.where(x <= 3.5, 4.5, 7.5)
t, gain, lv, rv = best_stump(r)
print(f"2) ν = 0.5: второй порог {t} (выигрыш {gain:.3f}); при 3.5 выигрыш "
      f"{3 * 3 / 6 * (r[x <= 3.5].mean() - r[x > 3.5].mean()) ** 2:.3f} — половина разницы групп осталась неисправленной,")
print("   но другое разбиение выгоднее: оно одновременно отделяет и остаток этой разницы, и самую дорогую квартиру.")

# 3
y2 = y.copy()
y2[-1] = 20
m = GBRegressor(n_estimators=1, learning_rate=1.0, max_depth=1).fit(X, y2)
root = m.trees_[0][0].nodes[0]
print(f"3) F0 = {m.init_:g}; первое дерево: x ≤ {root.threshold} → "
      f"{m.trees_[0][0].nodes[root.left].value:+.2f} / {m.trees_[0][0].nodes[root.right].value:+.2f}")

# 4
print("4) С ν = 1 лист прибавляет средний остаток листа: новая сумма квадратов в листе = Σ(r − r̄)².")
print("   Σr² − Σ(r − r̄)² = n·r̄² на лист; сумма по листьям минус n·r̄²_всех (= 0, т.к. среднее остатков после")
print("   старта со среднего равно 0) — это и есть выигрыш S_L²/n_L + S_R²/n_R − S²/n.")
