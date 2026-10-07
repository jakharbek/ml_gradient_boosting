"""Решения упражнений урока 1.4.

Запуск:  python lessons/lesson_1_4/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, RegressionTree, datasets
from gbcourse.metrics import mse
from gbcourse.rng import Mulberry32

grid = np.linspace(0, 10, 200).reshape(-1, 1)
truth = np.sin(grid[:, 0])


def bv(fit_predict, n: int = 30, B: int = 30) -> tuple[float, float]:
    """Смещение² и разброс по B обучающим выборкам."""
    preds = np.array([fit_predict(*datasets.regression_1d("sine", n=n, noise=0.35, seed=s)) for s in range(1, B + 1)])
    return float(np.mean((preds.mean(0) - truth) ** 2)), float(np.mean(preds.var(0)))


def task_1() -> None:
    print("1) A — недообучение: обе ошибки высоки и близки, намного выше шума → усложнять модель, добавлять признаки.")
    print("   B — переобучение: на обучении ниже шума, большой разрыв → регуляризация, ранняя остановка, больше данных.")


def task_2() -> None:
    shots = np.array([[1, 1], [1, -1], [3, 0]], dtype=float)
    mean = shots.mean(axis=0)
    bias2 = float(np.sum(mean**2))
    var = float(np.mean(np.sum((shots - mean) ** 2, axis=1)))
    msq = float(np.mean(np.sum(shots**2, axis=1)))
    print(f"2) смещение² = {bias2:.4f}, разброс = {var:.4f}, сумма = {bias2 + var:.4f}, средний квадрат промаха = {msq:.4f}")
    assert abs(bias2 + var - msq) < 1e-12


def task_3() -> None:
    for n in (30, 120):
        b2, v = bv(lambda X, y: RegressionTree(max_depth=8).fit(X, -y).predict(grid), n=n)
        print(f"3) n = {n:3d}: смещение² = {b2:.4f}, разброс = {v:.4f}")
    print("   Разброс упал заметно сильнее: больше данных — меньше влияния шума конкретной выборки.")


def task_4() -> None:
    for lr in (0.3, 0.05):
        best = None
        for M in (1, 3, 10, 30, 100, 300):
            b2, v = bv(lambda X, y, M=M, lr=lr: GBRegressor(n_estimators=M, learning_rate=lr, max_depth=2).fit(X, y).predict(grid), B=15)
            tot = b2 + v + 0.35**2
            if best is None or tot < best[1]:
                best = (M, tot)
        print(f"4) ν = {lr}: лучшее M = {best[0]} (ожидаемая ошибка {best[1]:.4f})")
    print("   Меньше темп — больше нужно деревьев: произведение ν·M примерно сохраняется.")


def task_5() -> None:
    for rho in (0.3, 0.1):
        rng = Mulberry32(11)
        for B in (1, 10, 100, 1000):
            avg = []
            for _ in range(300):
                common = np.sqrt(rho) * rng.normal()
                avg.append(np.mean([common + np.sqrt(1 - rho) * rng.normal() for _ in range(B)]))
            print(f"5) ρ = {rho}, B = {B:4d}: формула {rho + (1 - rho) / B:.3f}, симуляция {np.var(avg):.3f}")
    print(f"   При B = 100: ρ = 0.3 → {0.3 + 0.7 / 100:.3f}, ρ = 0.1 → {0.1 + 0.9 / 100:.3f} — снижать корреляцию выгоднее.")


def task_6() -> None:
    X, y = datasets.regression_1d(kind="sine", n=300, noise=0.4, seed=7)
    X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)
    Xt, yt = datasets.regression_1d(kind="sine", n=500, noise=0.4, seed=107)
    for nu in (1.0, 0.3, 0.1, 0.03):
        gb = GBRegressor(n_estimators=1000, learning_rate=nu, max_depth=2).fit(X_tr, y_tr, eval_set=(X_val, y_val))
        best = int(np.argmin(gb.history_["eval"]))
        print(f"6) ν = {nu:4}: лучшая итерация {best:4d}, MSE на новых данных {mse(yt, gb.predict(Xt, n_iter=best)):.4f}")
    print("   Меньше темп — позже минимум. Качество в минимуме при ν ≤ 0.3 почти одинаковое (≈ 0.167),")
    print("   а ν = 1 заметно хуже: минимум острый и ранний, каждое дерево вносит слишком много шума.")


def task_7() -> None:
    X, y = datasets.regression_1d("sine", n=150, noise=0.35, seed=1)

    def cv(seed: int) -> float:
        perm = np.array(Mulberry32(seed).permutation(len(y)))
        folds = np.array_split(perm, 5)
        errs = []
        for j in range(5):
            trn = np.concatenate([folds[i] for i in range(5) if i != j])
            errs.append(mse(y[folds[j]], RegressionTree(max_depth=3).fit(X[trn], -y[trn]).predict(X[folds[j]])))
        return float(np.mean(errs))

    single = [cv(s) for s in range(10)]
    repeated = [np.mean([cv(10 * s + k + 100) for k in range(3)]) for s in range(10)]
    print(f"7) обычная CV: std оценки = {np.std(single):.4f}; повторённая ×3: std = {np.std(repeated):.4f}")


def task_8() -> None:
    print("8) CV использовалась и для выбора, и для оценки — оценка оптимистична. Нужна вложенная CV")
    print("   (внутренняя — выбор гиперпараметров, внешняя — оценка) или отдельная тестовая выборка.")


def task_9() -> None:
    from sklearn.feature_selection import SelectKBest, f_regression
    from sklearn.linear_model import LinearRegression
    from sklearn.model_selection import KFold, cross_val_score
    from sklearn.pipeline import make_pipeline

    rng = Mulberry32(42)
    X = np.array([[rng.normal() for _ in range(1000)] for _ in range(60)])
    y = np.array([rng.normal() for _ in range(60)])
    cv = KFold(n_splits=5, shuffle=True, random_state=0)
    for k in (5, 10, 50):
        top = SelectKBest(f_regression, k=k).fit(X, y).get_support()
        wrong = cross_val_score(LinearRegression(), X[:, top], y, cv=cv, scoring="r2").mean()
        right = cross_val_score(make_pipeline(SelectKBest(f_regression, k=k), LinearRegression()), X, y, cv=cv, scoring="r2").mean()
        print(f"9) k = {k:2d}: отбор по всем данным R² = {wrong:+.3f};  отбор внутри блока R² = {right:+.3f}")
    print("   Среди 1000 шумов всегда найдутся «удачно» коррелирующие с y на этой выборке. Отбор по всем данным")
    print("   подсмотрел проверочные блоки — CV измеряет удачу отбора, а не способность предсказывать.")
    print("   При k = 50 линейная регрессия на 50 признаках и 48 объектах блока переобучается сама,")
    print("   и обе оценки отрицательны: утечка не всегда видна, но всегда искажает оценку.")


def task_10() -> None:
    n, sigma2 = 5, 1.0
    rng = Mulberry32(10)
    tr, te = [], []
    for _ in range(20000):
        e = np.array([rng.normal() for _ in range(n)])
        tr.append(np.mean((e - e.mean()) ** 2))
        te.append((rng.normal() - e.mean()) ** 2)
    print(f"10) константа, n = {n}: обучение {np.mean(tr):.3f} (формула {sigma2 * (n - 1) / n:.3f}), "
          f"новый объект {np.mean(te):.3f} (формула {sigma2 * (n + 1) / n:.3f}), разрыв ≈ 2σ²/n = {2 * sigma2 / n:.3f}")
    assert abs(np.mean(tr) - 0.8) < 0.02 and abs(np.mean(te) - 1.2) < 0.03


def task_11() -> None:
    mu, sigma, n = 0.5, 1.0, 10
    lam = sigma**2 / mu**2
    c = n / (n + lam)
    err = ((1 - c) * mu) ** 2 + c**2 * sigma**2 / n
    rng = Mulberry32(11)
    means = np.array([np.mean([mu + sigma * rng.normal() for _ in range(n)]) for _ in range(20000)])
    sim0 = np.mean((means - mu) ** 2)
    sim = np.mean((c * means - mu) ** 2)
    print(f"11) λ* = {lam:.0f}, c* = {c:.3f}: ошибка {err:.4f} (симуляция {sim:.4f}) против {sigma**2 / n:.4f} без сжатия (симуляция {sim0:.4f})")
    assert abs(err - 0.0714) < 1e-3 and sim < sim0


def task_12() -> None:
    X, y = datasets.regression_1d(kind="sine", n=80, noise=0.4, seed=7)
    Xt, yt = datasets.regression_1d(kind="sine", n=400, noise=0.4, seed=107)
    k = 10
    fold = np.empty(80, dtype=int)
    fold[Mulberry32(0).permutation(80)] = np.arange(80) % k
    means, stds = [], []
    for d in range(1, 11):
        sc = [mse(y[fold == j], RegressionTree(max_depth=d).fit(X[fold != j], -y[fold != j]).predict(X[fold == j])) for j in range(k)]
        means.append(np.mean(sc))
        stds.append(np.std(sc))
    best = int(np.argmin(means))
    thr = means[best] + stds[best] / np.sqrt(k)
    pick = int(np.argmax(np.array(means) <= thr)) + 1
    test = [mse(yt, RegressionTree(max_depth=d).fit(X, -y).predict(Xt)) for d in (pick, best + 1)]
    print(f"12) 10 блоков: лучшая глубина {best + 1} (CV {means[best]:.3f}), порог {thr:.3f} → глубина {pick}; "
          f"на новых данных {test[0]:.3f} против {test[1]:.3f}")


def task_13() -> None:
    from sklearn.model_selection import TimeSeriesSplit

    for slope in (0.03, 0.0):
        rng = Mulberry32(5)
        t = np.arange(144)
        y = np.array([2 + slope * ti + 0.6 * np.sin(2 * np.pi * ti / 12) + 0.3 * rng.normal() for ti in t])
        X = t.reshape(-1, 1).astype(float)
        fold = np.empty(120, dtype=int)
        fold[Mulberry32(0).permutation(120)] = np.arange(120) % 5
        h = np.arange(120)

        def err(tr, te, X=X, y=y):
            return mse(y[te], RegressionTree(max_depth=6).fit(X[tr], -y[tr]).predict(X[te]))

        rnd = np.mean([err(h[fold != j], h[fold == j]) for j in range(5)])
        tsp = np.mean([err(tr, te) for tr, te in TimeSeriesSplit(n_splits=5).split(h)])
        fut = err(h, np.arange(120, 144))
        print(f"13) наклон {slope}: случайные блоки {rnd:.3f}, по времени {tsp:.3f}, будущее {fut:.3f}")
    print("    Без тренда будущее похоже на прошлое, и разрыв между случайной CV и будущим резко сокращается:")
    print("    главный обман случайных блоков здесь — скрытая экстраполяция тренда.")


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
    task_13()
