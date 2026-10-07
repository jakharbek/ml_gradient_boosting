"""Решения упражнений урока 1.1.

Запуск:  python lessons/lesson_1_1/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, RegressionTree, datasets
from gbcourse.metrics import mse
from gbcourse.rng import Mulberry32


def task_1() -> None:
    print("1) (а) регрессия (или порядковая классификация); (б) многоклассовая классификация;")
    print("   (в) ранжирование; (г) бинарная классификация с выдачей вероятности; (д) без учителя (кластеризация).")


def task_2() -> None:
    x = np.array([30, 40, 50, 60, 70, 80.0])
    y = np.array([3, 5, 4, 8, 9, 13.0])
    sse0 = np.sum((y - y.mean()) ** 2)
    for name, F in [("константа 7", np.full_like(y, 7.0)), ("правило 0.3x − 4", 0.3 * x - 4)]:
        r = y - F
        m = np.mean(r**2)
        print(f"2) {name:16s}: MSE = {m:.3f}, RMSE = {np.sqrt(m):.3f}, MAE = {np.mean(np.abs(r)):.3f}, "
              f"R² = {1 - np.sum(r**2) / sse0:+.3f}")
    print("   Отрицательный R²: модель хуже, чем просто называть среднюю цену.")


X40, y40 = datasets.regression_1d(kind="wave", n=40, noise=0.4, seed=11)
x40 = X40[:, 0]


def task_3() -> None:
    cs = np.arange(-1, 4, 0.001)
    losses = [np.mean((y40 - c) ** 2) for c in cs]
    print(f"3) минимум на сетке: c = {cs[int(np.argmin(losses))]:.3f}; среднее y = {y40.mean():.3f}")


def task_4() -> None:
    stump = RegressionTree(max_depth=1).fit(X40, -y40)
    t0 = stump.nodes[0].threshold

    def stump_mse(t: float) -> float:
        left = x40 <= t
        pred = np.where(left, y40[left].mean(), y40[~left].mean())
        return mse(y40, pred)

    print(f"4) порог {t0:.3f}: MSE {stump_mse(t0):.4f}; −0.3: {stump_mse(t0 - 0.3):.4f}; +0.3: {stump_mse(t0 + 0.3):.4f}")
    assert stump_mse(t0) <= min(stump_mse(t0 - 0.3), stump_mse(t0 + 0.3))


def task_5() -> None:
    X, y = datasets.regression_1d(kind="wave", n=200, noise=0.4, seed=11)
    X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
    gb = GBRegressor(n_estimators=500, learning_rate=0.3, max_depth=3).fit(X_tr, y_tr)
    tr, te = mse(y_tr, gb.predict(X_tr)), mse(y_te, gb.predict(X_te))
    print(f"5) обучение {tr:.4f}, тест {te:.4f}, σ² = 0.16")
    print("   Ошибка на обучении намного ниже σ²: модель выучила шум. На тесте ошибка заметно выше σ².")
    assert tr < 0.16 < te


def task_6() -> None:
    for noise in (0.1, 1.0):
        Xn, yn = datasets.regression_1d(kind="wave", n=200, noise=noise, seed=11)
        X_tr, X_te, y_tr, y_te = datasets.train_test_split(Xn, yn, test_size=0.3, seed=0)
        te = [mse(y_te, RegressionTree(max_depth=d).fit(X_tr, -y_tr).predict(X_te)) for d in range(13)]
        print(f"6) шум {noise}: лучшая глубина {int(np.argmin(te))} (MSE теста {min(te):.3f})")
    print("   Чем больше шум, тем раньше гибкость начинает вредить: лучшая глубина меньше.")


def task_7() -> None:
    X, y = datasets.regression_1d(kind="wave", n=50, noise=0.5, seed=21)
    for ts in (0.1, 0.3, 0.5):
        errs = []
        for seed in range(30):
            Xtr, Xte, ytr, yte = datasets.train_test_split(X, y, test_size=ts, seed=seed)
            errs.append(mse(yte, RegressionTree(max_depth=3).fit(Xtr, -ytr).predict(Xte)))
        print(f"7) тест {int(ts * 100):2d} % ({int(np.floor(50 * ts + 0.5))} точек): от {min(errs):.3f} до {max(errs):.3f}, "
              f"среднее {np.mean(errs):.3f}, ст. откл. {np.std(errs):.3f}")
    print("   Маленький тест даёт шумную оценку (разброс в 10 раз); большой — оставляет мало данных на обучение,")
    print("   и модель хуже: среднее растёт. Два эффекта компенсируют друг друга, ст. откл. почти не меняется.")
    print("   Кросс-валидация использует каждый объект и для обучения, и для проверки (урок 1.4).")


def task_8() -> None:
    x = np.array([12, 18, 25, 30, 34, 41, 47, 52, 58, 63, 71, 80.0])
    y = np.array([0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1])

    def counts(t: float) -> tuple[int, int, int, int]:
        pred = x >= t
        return (int(np.sum(~pred & (y == 0))), int(np.sum(pred & (y == 0))),
                int(np.sum(~pred & (y == 1))), int(np.sum(pred & (y == 1))))

    tn, fp, fn, tp = counts(32)
    print(f"8) t = 32: TN = {tn}, FP = {fp}, FN = {fn}, TP = {tp}; доля верных {(tp + tn) / 12:.3f}, "
          f"полнота {tp / (tp + fn):.3f}, точность {tp / (tp + fp):.3f}")
    assert (tn, fp, fn, tp) == (4, 3, 0, 5)
    ts = np.arange(0, 101.5, 0.5)
    acc = [(counts(t)[0] + counts(t)[3]) / 12 for t in ts]
    best = ts[int(np.argmax(acc))]
    print(f"   лучший порог {best} (любой из (47, 52]): доля верных {max(acc):.3f}; базовая «все вернут» {np.mean(y == 0):.3f}")


def task_9() -> None:
    def flats(k: float):
        rng = Mulberry32(3)
        rows = []
        for _ in range(60):
            area = rng.uniform(30, 100)
            metro = rng.uniform(2, 30)
            eps = rng.normal()
            rows.append((area, metro, 0.12 * area + 3 - k * metro + 0.5 * eps))
        return np.array(rows).T

    def lstsq_mse(cols: list, y: np.ndarray) -> float:
        A = np.column_stack(cols + [np.ones_like(y)])
        coef, *_ = np.linalg.lstsq(A, y, rcond=None)
        return float(np.mean((y - A @ coef) ** 2))

    for k in (0.0, 0.15, 0.3):
        area, metro, y = flats(k)
        print(f"9) k = {k:4.2f}: только площадь {lstsq_mse([area], y):.3f}, площадь и метро {lstsq_mse([area, metro], y):.3f}")
    print("   Без метро его влияние k·метро попадает в остатки и растёт как k²; модель с метро")
    print("   описывает всю закономерность, остаётся только настоящий шум: ошибка ≈ σ² = 0.25 при любом k.")


def task_10() -> None:
    X_tr, y_tr = datasets.regression_1d(kind="wave", n=40, noise=0.4, seed=11)
    X_new, y_new = datasets.regression_1d(kind="wave", n=70, noise=0.4, seed=12, x_min=0, x_max=14)
    inside = X_new[:, 0] <= 10
    for d in range(1, 9):
        t = RegressionTree(max_depth=d).fit(X_tr, -y_tr)
        print(f"10) глубина {d}: обучение {mse(y_tr, t.predict(X_tr)):.3f}, x ≤ 10: {mse(y_new[inside], t.predict(X_new[inside])):.3f}, "
              f"x > 10: {mse(y_new[~inside], t.predict(X_new[~inside])):.3f}")
    print("   Справа от 10 прогноз дерева — значение одного крайнего листа, какая бы ни была глубина.")
    print("   Выход: моделировать тренд отдельно (например, прямой) и учить деревья на отклонениях от него.")


if __name__ == "__main__":
    task_1()
    task_2()
    task_3()
    task_4()
    task_5()
    task_6()
    task_7()
    task_8()
    task_9()
    task_10()
