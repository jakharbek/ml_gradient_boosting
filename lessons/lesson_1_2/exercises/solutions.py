"""Решения упражнений урока 1.2.

Запуск:  python lessons/lesson_1_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets, get_loss
from gbcourse.metrics import mse


def numeric_argmin(loss, y: np.ndarray, lo: float = 0, hi: float = 12, n: int = 12001) -> float:
    cs = np.linspace(lo, hi, n)
    return float(cs[np.argmin([loss.pointwise(y, np.full_like(y, c)).sum() for c in cs])])


def task_1() -> None:
    y = np.array([1.0, 2.0, 3.0, 100.0])
    for c in (1.5, 2.0, 2.5, 3.0, 3.5):
        print(f"1) S({c}) = {np.abs(y - c).sum():.2f}")
    print("   На [2, 3] слева и справа по 2 точки: сдвиг c на ε добавляет 2ε и отнимает 2ε — сумма не меняется.")


def task_2() -> None:
    y = np.array([1, 2, 3, 4, 10.0])
    delta = 4.0
    c = (1 + 2 + 3 + 4 + delta) / 4  # (1 + 2 + 3 + 4 − 4c) + δ = 0
    assert np.all(np.abs(y[:4] - c) <= delta) and y[4] - c > delta, "предположение об обрезке выполнено"
    num = numeric_argmin(get_loss("huber", delta=delta), y)
    print(f"2) равновесие сил: c* = {c}; численно {num:.3f}")


def task_3() -> None:
    y = np.array([2.1, 2.9, 3.3, 3.8, 4.1, 4.4, 4.9, 5.6, 6.2, 11.5])
    for delta in (0.1, 0.5, 1, 3, 10):
        print(f"3) δ = {delta:4}: c* = {numeric_argmin(get_loss('huber', delta=delta), y):.3f}")
    print(f"   медиана = {np.median(y):.3f}, среднее = {y.mean():.3f}: δ→0 даёт медиану, δ→∞ — среднее.")


def task_4() -> None:
    alpha = 10 / (10 + 90)  # недопрогноз стоит 10, перепрогноз 90 → α = c_under / (c_under + c_over)
    demand = np.array([20, 25, 22, 30, 28, 35, 24, 26], dtype=float)
    exact = np.sort(demand)[int(np.ceil(alpha * len(demand))) - 1]
    cost = lambda q: np.mean(np.where(demand > q, 10 * (demand - q), 90 * (q - demand)))  # noqa: E731
    grid = np.linspace(15, 40, 2501)
    best = grid[np.argmin([cost(q) for q in grid])]
    print(f"4) α = {alpha:.2f}; точная квантиль = {exact:.0f} булок, перебор стоимости = {best:.2f} (среднее спроса {demand.mean():.2f})")
    print("   Перепрогноз дорог — выгодно печь меньше среднего, почти по минимуму спроса.")


def task_5() -> None:
    delta = 1.0
    r = np.linspace(-3, 3, 13)
    by_hand = np.clip(r, -delta, delta)  # r при |r| ≤ δ, иначе ±δ
    lib = get_loss("huber", delta=delta).negative_gradient(r, np.zeros_like(r))
    print(f"5) −∂L/∂F = clip(r, −δ, δ); совпадает с библиотекой: {np.allclose(by_hand, lib)}")
    print("   В точке r = δ обе ветви дают δ — градиент непрерывен (в отличие от sign(r) у L1).")


def task_6() -> None:
    X, y = datasets.regression_1d(kind="sine", n=30, noise=0.25, seed=4, outliers=0.1)
    Xn, yn = datasets.regression_1d(kind="sine", n=300, noise=0.25, seed=104)
    outl = np.abs(y - np.sin(X[:, 0])) > 2
    for name, kw, lkw in [("squared", {}, {}), ("absolute", {}, {}), ("huber", {"huber_delta": 1.0}, {"delta": 1.0})]:
        loss = get_loss(name, **lkw)
        g = loss.negative_gradient(y, np.full_like(y, loss.init(y)))
        errs = [mse(yn, GBRegressor(loss=name, n_estimators=100, learning_rate=0.1, max_depth=2, min_samples_leaf=msl, **kw).fit(X, y).predict(Xn))
                for msl in (1, 5)]
        print(f"6) {name:8s}: псевдо-остатки выбросов {np.round(g[outl], 2)}; MSE на чистых данных {errs[0]:.3f} (лист ≥ 5: {errs[1]:.3f})")
    print("   Квадратичные потери дают выбросам огромные псевдо-остатки — деревья тратят разбиения на них.")
    print("   У Хьюбера псевдо-остатки выбросов обрезаны, но всё равно максимальны: дерево отрезает выброс в свой лист,")
    print("   и значение листа (лучшая константа для одного объекта) — весь остаток. Запрет маленьких листьев это лечит.")


def task_7() -> None:
    print("7) Пример: кредитный скоринг оптимизирует log-loss, а отчитывается по ROC AUC или прибыли портфеля;")
    print("   AUC зависит только от порядка прогнозов и не дифференцируема — оптимизировать её напрямую неудобно.")


if __name__ == "__main__":
    task_1()
    task_2()
    task_3()
    task_4()
    task_5()
    task_6()
    task_7()
