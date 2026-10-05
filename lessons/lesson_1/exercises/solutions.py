"""Решения упражнений урока 1.

Запуск:  python lessons/lesson_1/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets


def task_1() -> None:
    y, nu, F, m = 10.0, 0.1, 0.0, 0
    while abs(y - F) >= 0.1:
        F += nu * (y - F)
        m += 1
    formula = math.ceil(math.log(0.01) / math.log(1 - nu))
    print(f"1) симуляция: {m} шагов; формула: m > ln(0.01)/ln(0.9) = {math.log(0.01) / math.log(0.9):.2f} → {formula}")


def task_2() -> None:
    X, y = datasets.regression_1d(kind="wave", n=60, noise=0.35, seed=7)
    target = GBRegressor(learning_rate=0.3, max_depth=2, n_estimators=20).fit(X, y).history_["train"][-1]
    stumps = GBRegressor(learning_rate=0.3, max_depth=1, n_estimators=500).fit(X, y)
    m = next(i for i, v in enumerate(stumps.history_["train"]) if v <= target)
    print(f"2) глубина 2, 20 деревьев: потери {target:.4f}; пням нужно {m} деревьев")


def task_3() -> None:
    print("3) остаток умножается на (1 − ν); сходимость ⇔ |1 − ν| < 1 ⇔ 0 < ν < 2.")
    F = 0.0
    for _ in range(4):
        F += 2.0 * (10 - F)
        print(f"   ν = 2: F = {F:5.1f} — вечные качели 0 ↔ 20, остаток не убывает")


def task_4() -> None:
    X, y = datasets.regression_1d(kind="wave", n=60, noise=0.35, seed=7)
    model = GBRegressor(learning_rate=0.3, max_depth=2, n_estimators=30).fit(X, y)
    before = model.predict(X)
    model.trees_ = model.trees_[::-1]  # переставляем деревья
    after = model.predict(X)
    print(f"4) после перестановки деревьев прогноз изменился на {np.abs(before - after).max():.1e} (сумма коммутативна)")
    print("   Но обучать в другом порядке нельзя: каждое дерево строилось на остатках предыдущих.")


if __name__ == "__main__":
    task_1()
    task_2()
    task_3()
    task_4()
