"""Решения упражнений урока 1.3.

Запуск:  python lessons/lesson_1_3/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import datasets, get_loss
from gbcourse.rng import Mulberry32


def task_1() -> None:
    t, path = 0.0, []
    for _ in range(3):
        t -= 0.25 * 2 * (t - 3)
        path.append(t)
    print(f"1) θ₁, θ₂, θ₃ = {path}; расстояние до 3 уменьшается в 1/(1 − ηa) = 1/(1 − 0.25·2) = 2 раза за шаг")


def task_2() -> None:
    print("2) θ ← (1 − ηa)θ; сходимость ⇔ |1 − ηa| < 1 ⇔ 0 < η < 2/a (для a = 3: η < 0.667)")
    for eta in (0.6, 0.66, 0.67, 0.7):
        t = 1.0
        for _ in range(200):
            t -= eta * 3 * t
        print(f"   η = {eta}: |θ_200| = {abs(t):.3e}")


def task_3() -> None:
    y = np.array([3, 5, 4, 8, 9, 13.0])
    for eta in (1.0, 0.5):
        c, gaps = 0.0, []
        for _ in range(4):
            c += eta * np.mean(y - c)
            gaps.append(y.mean() - c)
        print(f"3) η = {eta}: остаток до среднего по шагам = {np.round(gaps, 6)}")


def task_4() -> None:
    loss = get_loss("huber", delta=1.0)
    y = np.array([5.0])
    for F in (4.5, 2.0, 6.8):
        formula = -(y[0] - F) if abs(y[0] - F) <= 1 else -np.sign(y[0] - F)
        num = (loss.pointwise(y, np.array([F + 1e-6]))[0] - loss.pointwise(y, np.array([F - 1e-6]))[0]) / 2e-6
        print(f"4) F = {F}: формула ∂L/∂F = {formula:+.4f}, конечные разности {num:+.4f}")


def task_5() -> None:
    X, y = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)
    x = X[:, 0]
    for name, xx in (("исходный", x), ("центрированный", x - x.mean())):
        a_opt, b_opt = np.polyfit(xx, y, 1)
        opt = np.mean((y - a_opt * xx - b_opt) ** 2) / 2
        a, b, k = -0.8, 5.5, 0
        while np.mean((y - a * xx - b) ** 2) / 2 - opt >= 1e-4 and k < 200000:
            r = y - (a * xx + b)
            a, b, k = a + 0.02 * np.mean(r * xx), b + 0.02 * np.mean(r), k + 1
        print(f"5) {name} x: {k} шагов")


def task_6() -> None:
    for mode in ("постоянный", "затухающий"):
        t = 2.05
        for k in range(200):
            eta = 0.3 if mode == "постоянный" else 0.3 / (1 + k / 10)
            t -= eta * np.sign(t)
        print(f"6) {mode} темп: |θ| после 200 шагов = {abs(t):.4f}")


def task_7() -> None:
    p = 0.1
    sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731
    d1 = lambda F: sig(F) - p  # noqa: E731
    d2 = lambda F: sig(F) * (1 - sig(F))  # noqa: E731
    target = np.log(p / (1 - p))
    steps = {
        "спуск η = 1": lambda F: F - d1(F),
        f"спуск η = 1/f″(0) = {1 / d2(0.0):.0f}": lambda F: F - d1(F) / d2(0.0),
        "Ньютон": lambda F: F - d1(F) / d2(F),
    }
    for name, step in steps.items():
        F, k = 0.0, 0
        while abs(F - target) >= 1e-6 and k < 100000:
            F, k = step(F), k + 1
        print(f"7) {name:18s}: {k} шагов до точности 1e-6 (F* = {target:.6f})")
    print("   Кривизна log-loss меняется: у F* она равна p(1 − p) = 0.09, а в нуле — 0.25. Фиксированный темп 1/f″(0)")
    print("   слишком мал вблизи минимума; Ньютон пересчитывает кривизну на каждом шаге.")


def task_8() -> None:
    y = np.array([3, 5, 4, 8, 9, 13.0])
    f = lambda c: np.mean(0.5 * (y - c) ** 2)  # noqa: E731
    g = 0.0 - y.mean()
    for eta in (0.1, 0.5, 1, 2, 2.5):
        exact = f(0) - eta * (1 - eta / 2) * g**2
        print(f"8) η = {eta:<4}: обещание {f(0) - eta * g**2:8.3f}, на самом деле {f(-eta * g):7.3f}, формула {exact:7.3f}")
    print("   функция уменьшается при 0 < η < 2/a = 2, сильнее всего — при η = 1/a = 1")


def task_9() -> None:
    y = np.array([3, 5, 4, 8, 9, 13.0])
    for c0 in (0.0, 12.1):  # 12.1, а не 12: путь не попадает точно на цены, где знак остатка — ноль
        c, k = c0, 0
        while abs(np.mean(np.sign(y - c))) > 1e-12 and k < 1000:
            c, k = c + 0.5 * np.mean(np.sign(y - c)), k + 1
        print(f"9) старт {c0}: остановка на шаге {k} в c = {c:.4f}")
    print("   Минимум MAE для чётного n — весь отрезок [5, 8]: спуск останавливается в первой его точке, куда попал.")


def task_10() -> None:
    def steps(kappa: float, eta: float, beta: float = 0.0) -> int:
        t0 = np.array([2.5, 1.0])
        t, v = t0.copy(), np.zeros(2)
        for k in range(1, 100001):
            v = beta * v - eta * np.array([t[0], kappa * t[1]])
            t = t + v
            if np.linalg.norm(t) < 1e-3 * np.linalg.norm(t0):
                return k
        return -1

    for kappa in (1, 10, 100):
        sq = np.sqrt(kappa)
        plain = steps(kappa, 2 / (1 + kappa))
        heavy = steps(kappa, (2 / (1 + sq)) ** 2, ((sq - 1) / (sq + 1)) ** 2)
        print(f"10) κ = {kappa:3d}: постоянный темп — {plain} шагов, с инерцией — {heavy}")
    print("    Без инерции шагов ~κ, с инерцией ~√κ.")


def task_11() -> None:
    x = np.array([30, 40, 50, 60, 70, 80.0])
    r = np.array([3, 5, 4, 8, 9, 13.0]) - 7
    for t in (x[:-1] + x[1:]) / 2:
        h = np.where(x <= t, r[x <= t].mean(), r[x > t].mean())
        sse = np.sum((r - 0.5 * h) ** 2)
        print(f"11) порог {t:.0f}: h·r = {h @ r:5.1f}, ‖h‖² = {h @ h:5.1f}, сумма квадратов {sse:6.2f} = 70 − 0.75·h·r = {70 - 0.75 * (h @ r):6.2f}")
    print("    ‖h‖² = h·r: в каждой группе h — среднее r, поэтому Σ h·(r − h) = 0. Тогда Σ(r − νh)² = ‖r‖² − (2ν − ν²)·h·r.")


def task_12() -> None:
    X, y = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)
    z = (X[:, 0] - X[:, 0].mean()) / X[:, 0].std()
    half = lambda a, b: np.mean((y - a * z - b) ** 2) / 2  # noqa: E731
    opt = half(np.mean(z * (y - y.mean())), y.mean())
    for eta in (0.1, 0.03):
        for B in (1, 5, 30):
            rng, a, b, excess = Mulberry32(1), 0.0, 0.0, []
            for k in range(200):
                idx = rng.sample(30, B) if B < 30 else list(range(30))
                res = y[idx] - (a * z[idx] + b)
                a, b = a + eta * np.mean(res * z[idx]), b + eta * np.mean(res)
                if k >= 100:
                    excess.append(half(a, b) - opt)
            print(f"12) η = {eta}, B = {B:2d}: средний избыток ½·MSE над минимумом {np.mean(excess):.5f}")
    print("    Шум растёт с η и убывает с B. Меньший η уменьшает шум (B = 1: 0.018 → 0.008), но замедляет схождение:")
    print("    при η = 0.03 даже полный спуск за 200 шагов ещё не дошёл до минимума. Поэтому темп уменьшают к концу обучения.")


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
