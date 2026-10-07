"""Решения упражнений урока 1.2.

Запуск:  python lessons/lesson_1_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets, get_loss
from gbcourse.metrics import mse
from gbcourse.rng import Mulberry32


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


def task_8() -> None:
    r = np.array([1, 1, -2, 0, -1, 1.0])
    for name, kw in [("squared", {}), ("absolute", {}), ("huber", {"delta": 1.0}), ("quantile", {"alpha": 0.9})]:
        loss = get_loss(name, **kw)
        print(f"8) {name:9s} потери {loss.pointwise(r, np.zeros(6))}  риск {loss.loss(r, np.zeros(6)):.3f}")
    print("   Квантильная с α = 0.9 штрафует недооценку (r > 0) в 9 раз сильнее: три остатка +1 дают 2.7 из 3.")
    print("   Риски разных потерь — разные «валюты»: сравнивать их между собой нельзя.")


def task_9() -> None:
    k, n = 2, 10
    y = np.array([1] * k + [0] * (n - k))
    ps = np.linspace(0.001, 0.999, 9981)
    risk = [-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)) for p in ps]
    p_num = ps[int(np.argmin(risk))]
    assert abs(p_num - k / n) < 1e-3
    print(f"9) R'(p) = 0 ⇒ k(1 − p) = (n − k)p ⇒ p = k/n = {k / n}; перебор даёт {p_num:.3f}")
    print(f"   стартовый логит F0 = ln(0.2/0.8) = {np.log(0.2 / 0.8):.3f}; gbcourse: {get_loss('logistic').init(y):.3f}")


def task_10() -> None:
    x = np.arange(1, 6.0)
    y = np.array([1, 2, 3, 4, 10.0])
    loss = get_loss("absolute")
    F = np.full_like(y, loss.init(y))
    print(f"10) F0 = {F[0]}, псевдо-остатки {loss.negative_gradient(y, F)}")
    for t in (2.5, 3.5):
        left = x < t
        gl, gr = loss.leaf_value(y[left], F[left]), loss.leaf_value(y[~left], F[~left])
        F1 = F + np.where(left, gl, gr)
        print(f"    x ≤ {t}: γ = ({gl:+.1f}, {gr:+.1f}), F1 = {F1}, потери {loss.loss(y, F1):.2f}")
    print("    В листе из двух точек (4 и 10) медиана — середина между ними: выброс входит в значение листа наравне с соседом.")


def _deliveries(n: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    rng = Mulberry32(seed)
    x, y = [], []
    for _ in range(n):
        xi = rng.uniform(0.5, 10)
        z = rng.normal()
        x.append(xi)
        y.append(8 + 2.2 * xi + (1 + 0.35 * xi) * np.exp(0.6 * z))
    return np.array(x), np.array(y)


def task_11() -> None:
    x, y = _deliveries(240, 21)
    xn, yn = _deliveries(240, 22)
    near, far = xn < 3.5, xn > 7

    def report(name: str, pred_new: np.ndarray) -> None:
        cover = yn <= pred_new
        print(f"11) {name:22s} покрытие {cover.mean():.0%}; близкие {cover[near].mean():.0%}, дальние {cover[far].mean():.0%}")

    q_all = np.sort(y)[int(np.ceil(0.9 * len(y))) - 1]
    report("одна константа", np.full_like(yn, q_all))
    group = lambda v: np.minimum(((v - 0.5) / 9.5 * 4).astype(int), 3)  # noqa: E731
    q4 = np.array([np.sort(y[group(x) == j])[int(np.ceil(0.9 * np.sum(group(x) == j))) - 1] for j in range(4)])
    report("4 группы", q4[group(xn)])
    gb = GBRegressor(loss="quantile", quantile_alpha=0.9, n_estimators=150, learning_rate=0.1, max_depth=2, min_samples_leaf=10)
    report("квантильный бустинг", gb.fit(x.reshape(-1, 1), y).predict(xn.reshape(-1, 1)))
    print("    Одна константа обещает близким с огромным запасом, а дальних подводит; группы и деревья выравнивают покрытие.")


def task_12() -> None:
    y = np.array([1, 2, 3, 4, 10.0])
    mus = np.linspace(0, 12, 12001)
    for scale in (1.0, 3.0):
        nll_laplace = [np.sum(np.log(2 * scale) + np.abs(y - m) / scale) for m in mus]
        nll_normal = [np.sum(0.5 * np.log(2 * np.pi * scale**2) + (y - m) ** 2 / (2 * scale**2)) for m in mus]
        print(f"12) b = σ = {scale}: максимум правдоподобия — Лаплас {mus[np.argmin(nll_laplace)]:.3f}, нормальный {mus[np.argmin(nll_normal)]:.3f}")
    print(f"    медиана {np.median(y)}, среднее {y.mean()}: масштаб шума умножает потери на число и не сдвигает минимум.")


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
    task_11()
    task_12()
