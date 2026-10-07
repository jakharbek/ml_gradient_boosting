"""Решения упражнений урока 1.

Запуск:  python lessons/lesson_1/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.metrics import mse

X6 = np.array([30, 40, 50, 60, 70, 80.0])
Y6 = np.array([3, 5, 4, 8, 9, 13.0])


def task_1() -> None:
    y, nu, F, m = 10.0, 0.1, 0.0, 0
    while abs(y - F) >= 0.1:
        F += nu * (y - F)
        m += 1
    formula = math.ceil(math.log(0.01) / math.log(1 - nu))
    print(f"1) симуляция: {m} шагов; формула: m > ln(0.01)/ln(0.9) = {math.log(0.01) / math.log(0.9):.2f} → {formula}")
    assert m == formula == 44


def task_2() -> None:
    print("2) остаток умножается на (1 − ν); сходимость ⇔ |1 − ν| < 1 ⇔ 0 < ν < 2.")
    for nu in (1.5, 2.0):
        F, path = 0.0, []
        for _ in range(5):
            F += nu * (10 - F)
            path.append(F)
        print(f"   ν = {nu}: F = " + ", ".join(f"{v:g}" for v in path))
    print("   ν = 1.5 — перелёты с затуханием (1 − ν = −0.5); ν = 2 — вечные качели 0 ↔ 20.")


def task_3() -> None:
    r = np.array([-2.05, -0.05, -1.05, -0.05, 0.95, 2.25])
    best = None
    for t in (35, 45, 55, 65, 75):
        left, right = r[X6 <= t].mean(), r[X6 > t].mean()
        sse = ((r - np.where(X6 <= t, left, right)) ** 2).sum()
        print(f"3) порог {t}: слева {left:+.3f}, справа {right:+.3f}, ошибка пня {sse:.4f}")
        if best is None or sse < best[0]:
            best = (sse, t, left, right)
    _, t, left, right = best
    F2 = Y6 - r
    F3 = F2 + 0.5 * np.where(X6 <= t, left, right)
    print(f"   лучший порог {t}; после шага сумма квадратов остатков = {((Y6 - F3) ** 2).sum():.4f}")
    assert t == 65 and abs(((Y6 - F3) ** 2).sum() - 5.515) < 1e-9


def task_4() -> None:
    X, y = datasets.regression_1d(kind="wave", n=60, noise=0.35, seed=7)
    target = GBRegressor(learning_rate=0.3, max_depth=2, n_estimators=20).fit(X, y).history_["train"][-1]
    stumps = GBRegressor(learning_rate=0.3, max_depth=1, n_estimators=500).fit(X, y)
    m = next(i for i, v in enumerate(stumps.history_["train"]) if v <= target)
    print(f"4) глубина 2, 20 деревьев: потери {target:.4f}; пням нужно {m} деревьев")


def task_5() -> None:
    X, y = datasets.regression_1d(kind="wave", n=60, noise=0.35, seed=7)
    model = GBRegressor(learning_rate=0.3, max_depth=2, n_estimators=30).fit(X, y)
    before = model.predict(X)
    model.trees_ = model.trees_[::-1]  # переставляем деревья
    after = model.predict(X)
    print(f"5) после перестановки деревьев прогноз изменился на {np.abs(before - after).max():.1e} (сумма коммутативна)")
    print("   Но обучать в другом порядке нельзя: каждое дерево строилось на остатках предыдущих.")


def task_6() -> None:
    X, y = datasets.regression_1d(kind="wave", n=60, noise=0.35, seed=7)
    Xn, yn = datasets.regression_1d(kind="wave", n=300, noise=0.35, seed=107)
    for nu in (1.0, 0.3, 0.1):
        gb = GBRegressor(n_estimators=300, learning_rate=nu, max_depth=1).fit(X, y)
        errs = [mse(yn, gb.predict(Xn, n_iter=m)) for m in range(1, 301)]
        best = int(np.argmin(errs)) + 1
        print(f"6) ν = {nu:3.1f}: минимум на новых данных {min(errs):.4f} после {best} деревьев; после 300 — {errs[-1]:.4f}")
    print("   При ν = 1 каждое дерево целиком принимает и закономерность, и шум, поэтому лучшее число")
    print("   деревьев маленькое, а дальше модель подгоняется под шум. Маленький темп идёт медленнее, но точнее.")


def lad_boosting(X: np.ndarray, y: np.ndarray, M: int, nu: float, depth: int):
    """Бустинг с абсолютными потерями: старт — медиана, дерево учится на sign(y − F), в листе — медиана остатков."""
    from gbcourse import RegressionTree

    F0 = float(np.median(y))
    F = np.full_like(y, F0)
    stages = []
    for _ in range(M):
        r = y - F
        tree = RegressionTree(max_depth=depth).fit(X, -np.sign(r))  # дерево учится на −∂L/∂F = sign(r)
        leaves = tree.apply(X)
        values = {leaf: float(np.median(r[leaves == leaf])) for leaf in np.unique(leaves)}  # лучшая константа листа
        F = F + nu * np.array([values[leaf] for leaf in leaves])
        stages.append((tree, values))

    def predict(Z: np.ndarray) -> np.ndarray:
        out = np.full(len(Z), F0)
        for tree, values in stages:
            out += nu * np.array([values.get(leaf, 0.0) for leaf in tree.apply(Z)])
        return out

    return predict


def task_7() -> None:
    X, y = datasets.regression_1d(kind="sine", n=80, noise=0.2, seed=5, outliers=0.08)  # 8 % выбросов
    Xn, yn = datasets.regression_1d(kind="sine", n=300, noise=0.2, seed=105)  # чистые новые данные
    ours = lad_boosting(X, y, M=60, nu=0.1, depth=2)
    ref = GBRegressor(loss="absolute", n_estimators=60, learning_rate=0.1, max_depth=2).fit(X, y)
    print(f"7) свой бустинг с |y − F|: MSE на новых данных = {mse(yn, ours(Xn)):.4f}; "
          f"расхождение с GBRegressor(loss='absolute') = {np.abs(ours(Xn) - ref.predict(Xn)).max():.1e}")
    for loss in ("squared", "absolute", "huber"):
        gb = GBRegressor(loss=loss, n_estimators=60, learning_rate=0.1, max_depth=2).fit(X, y)
        print(f"   {loss:8s}: MSE на новых данных после 60 деревьев = {mse(yn, gb.predict(Xn)):.4f}")
    print("   Квадратичные потери тянутся за выбросами; абсолютные учат деревья только на знаках и их не замечают.")


if __name__ == "__main__":
    task_1()
    task_2()
    task_3()
    task_4()
    task_5()
    task_6()
    task_7()
