"""Решения упражнений урока 1.3.

Запуск:  python lessons/lesson_1_3/exercises/solutions.py

Задачи 1–17 совпадают с разделом «Упражнения» на странице урока, 18–23 есть только в tasks.md.
Каждое решение печатает ответ и проверяет ключевые числа assert-ами — те же, что на странице.
"""

import math
import sys
from collections.abc import Callable
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets, get_loss
from gbcourse.metrics import mse
from gbcourse.rng import Mulberry32

# Сквозной пример урока — шесть квартир из урока 1
X_FLAT = np.array([30, 40, 50, 60, 70, 80.0])  # площадь, м²
Y_FLAT = np.array([3, 5, 4, 8, 9, 13.0])  # цена, млн
R0 = Y_FLAT - 7  # остатки от старта F₀ = 7 — антиградиент ½·Σ(y − F)²


# ---------------------------------------------------------------------------------- помощники

def head(title: str) -> None:
    """Заголовок задачи в выводе."""
    print(f"\n{title}")


def f_flats(c: float) -> float:
    """½·MSE константы c на шести квартирах: 70/12 + ½·(c − 7)²."""
    return float(np.mean(0.5 * (Y_FLAT - c) ** 2))


def sigmoid(z: float) -> float:
    """Сигмоида σ(z) = 1/(1 + e^(−z))."""
    return 1.0 / (1.0 + math.exp(-z))


def central(f: Callable[[float], float], t: float, eps: float = 1e-6) -> float:
    """Центральная разность (f(t + ε) − f(t − ε)) / 2ε."""
    return (f(t + eps) - f(t - eps)) / (2 * eps)


def stump(r: np.ndarray, t: float) -> np.ndarray:
    """Пень по площади с порогом t: среднее остатков r слева (x ≤ t) и справа (x > t)."""
    left = X_FLAT <= t
    return np.where(left, r[left].mean(), r[~left].mean())


def bowl_steps(kappa: float, eta: float, beta: float = 0.0, t0: tuple = (2.5, 1.0),
               max_steps: int = 20000) -> int | None:
    """Шаги спуска (с инерцией β) по ½(θ₁² + κθ₂²) до |θ| < 10⁻³·|θ₀|; None — не сошёлся."""
    start = np.array(t0, float)
    t, v = start.copy(), np.zeros(2)
    for k in range(1, max_steps + 1):
        v = beta * v - eta * np.array([t[0], kappa * t[1]])  # ∇f = (θ₁, κθ₂)
        t = t + v
        if np.linalg.norm(t) < 1e-3 * np.linalg.norm(start):
            return k
        if np.linalg.norm(t) > 1e6:
            return None  # разнос
    return None


# ================================================================ Часть I. Производная

def task_1() -> None:
    head("1. Секущая на квартирах ★☆☆")
    f10 = f_flats(10)
    print(f"   f(10) = {f10:.3f}, f(11) = {f_flats(11):.3f}, f(10.1) = {f_flats(10.1):.3f}")
    for eps in (1, 0.1, 0.01, 0.001):
        slope = (f_flats(10 + eps) - f10) / eps
        print(f"   ε = {eps:<5}: наклон секущей {slope:.4f}  (= 3 + ε/2)")
        assert abs(slope - (3 + eps / 2)) < 1e-9
    print("   При ε → 0 наклон стремится к 3 — это f′(10) = 10 − 7 по формуле.")
    assert [round(f_flats(c), 3) for c in (10, 11, 10.1)] == [10.333, 13.833, 10.638]


def huber(y: float, F: float, delta: float = 1.0) -> float:
    """Потери Хьюбера одного объекта."""
    r = abs(y - F)
    return 0.5 * r * r if r <= delta else delta * (r - 0.5 * delta)


def task_2() -> None:
    head("2. Производная потерь Хьюбера ★★☆")
    print("   |y − F| ≤ δ:  ∂L/∂F = −(y − F);   иначе:  ∂L/∂F = −δ·sign(y − F)  (цепное правило для модуля)")
    lib = get_loss("huber", delta=1.0)
    for F, expected in ((4.5, -0.5), (2.0, -1.0)):
        r = 5 - F
        formula = -r if abs(r) <= 1 else -np.sign(r)
        num = central(lambda t: huber(5.0, t), F)
        by_lib = float(lib.gradient(np.array([5.0]), np.array([F]))[0])
        print(f"   F = {F}: формула {formula:+.4f}, центральная разность {num:+.4f}, gbcourse {by_lib:+.4f}")
        assert formula == expected and abs(num - expected) < 1e-6 and by_lib == expected
    print("   На стыке |y − F| = δ обе ветви дают ∓δ: производная Хьюбера непрерывна, в отличие от MAE.")


def task_3() -> None:
    head("3. Производная сигмоиды ★★☆")
    print("   σ = (1 + e^(−F))^(−1);  σ′ = −(1 + e^(−F))^(−2)·(−e^(−F)) = σ·e^(−F)/(1 + e^(−F)) = σ(1 − σ)")
    s = sigmoid(0.3)
    num = central(sigmoid, 0.3)
    print(f"   F = 0.3: σ = {s:.4f}, σ(1 − σ) = {s * (1 - s):.4f}, центральная разность {num:.4f}")
    assert round(s, 4) == 0.5744 and round(s * (1 - s), 4) == 0.2445
    assert abs(num - s * (1 - s)) < 1e-9


def task_4() -> None:
    head("4. Какое ε лучше ★★☆")

    def cube(t: float) -> float:
        return t**3

    eps_list = [float(f"1e-{k}") for k in range(1, 13)]
    fwd = [abs((cube(1 + e) - cube(1)) / e - 3) for e in eps_list]
    cen = [abs((cube(1 + e) - cube(1 - e)) / (2 * e) - 3) for e in eps_list]
    print("       ε    ошибка «вперёд»   ошибка центральной")
    for e, a, b in zip(eps_list, fwd, cen):
        print(f"   {e:7.0e}   {a:13.1e}   {b:16.1e}")
    best_fwd, best_cen = eps_list[int(np.argmin(fwd))], eps_list[int(np.argmin(cen))]
    i8 = eps_list.index(1e-8)
    print(f"   «Вперёд»: ошибка ≈ 3ε вплоть до ε = 10⁻⁷; лучшая — при ε ≈ 10⁻⁸ ({fwd[i8]:.0e}: здесь округление "
          f"случайно частично погасило ошибку метода 3ε = 3e-08), дальше растёт.")
    print(f"   Центральная: ошибка ≈ ε², лучшая при ε = {best_cen:.0e} (ошибка {min(cen):.0e}), дальше растёт.")
    print("   Ошибка метода: ≈ 3ε у разности «вперёд», ровно ε² у центральной ((1 ± ε)³ даёт 3 + ε²).")
    print("   Ошибка округления ≈ 10⁻¹⁶/ε: при малом ε разность почти равных чисел теряет значащие цифры.")
    print("   Сумма двух ошибок минимальна при ε ≈ √10⁻¹⁶ = 10⁻⁸ («вперёд») и ε ≈ ∛10⁻¹⁶ ≈ 10⁻⁵…10⁻⁶ (центральная).")
    assert all(abs(a / (3 * e) - 1) < 0.05 for e, a in zip(eps_list[:i8], fwd[:i8])), "≈ 3ε до ε = 1e-7"
    assert best_fwd == 1e-8 and fwd[i8] < 3e-8 / 5, "при 1e-8 ошибка заметно меньше 3ε"
    assert all(a > fwd[i8] for a in fwd[i8 + 1:]), "после 1e-8 ошибка «вперёд» растёт"
    assert best_cen in (1e-5, 1e-6, 1e-7) and min(cen) < 2e-10
    assert abs(fwd[0] - 0.31) < 1e-9 and abs(cen[0] - 0.01) < 1e-9
    assert fwd[-1] > 1e-5 and cen[-1] > 1e-5, "при ε = 1e-12 обе разности хуже, чем при 1e-5"


# ================================================================ Часть II. Спуск по одной переменной

def task_5() -> None:
    head("5. Три шага руками ★☆☆")
    t, path = 0.0, []
    for _ in range(3):
        t -= 0.25 * 2 * (t - 3)  # f′(θ) = 2(θ − 3)
        path.append(t)
    dist = [3 - v for v in (0.0, *path)]
    print(f"   θ₁, θ₂, θ₃ = {path}; расстояние до минимума {dist}")
    print("   Расстояние уменьшается вдвое за шаг: множитель 1 − ηa = 1 − 0.25·2 = 0.5.")
    assert path == [1.5, 2.25, 2.625] and dist == [3, 1.5, 0.75, 0.375]


def task_6() -> None:
    head("6. Граница расходимости ★☆☆")
    a = 10.0  # f = 5θ², f″ = 10
    print(f"   a = f″ = {a:g}: сходимость при 0 < η < 2/a = {2 / a:g}, минимум за шаг при η = 1/a = {1 / a:g}")
    print("   |1 − 10η| = 0.5 при η = 0.05 (подход с одной стороны) и η = 0.15 (с перелётом)")
    final = {}
    for eta in (0.05, 0.1, 0.15, 0.2, 0.21):
        t = 1.0
        for _ in range(30):
            t -= eta * a * t
        final[eta] = abs(t)
        print(f"   η = {eta:<4}: множитель {1 - eta * a:+.2f}, |θ₃₀| из θ₀ = 1: {abs(t):.3g}")
    assert abs(final[0.05] - 0.5**30) < 1e-12 and abs(final[0.15] - 0.5**30) < 1e-12
    assert final[0.1] == 0 and abs(final[0.2] - 1) < 1e-9 and final[0.21] > 10


def task_7() -> None:
    head("7. Обещание касательной ★★☆")
    g, a = -7.0, 1.0  # f′(0) = 0 − 7, кривизна квартир a = 1
    print(f"   f(0) = {f_flats(0):.3f}, (f′(0))² = {g**2:g}")
    for eta in (0.1, 2.5, 1.0):
        promise = eta * g**2
        formula = f_flats(0) - eta * (1 - a * eta / 2) * g**2
        actual = f_flats(0 - eta * g)
        print(f"   η = {eta:<3}: формула {formula:.3f}, на самом деле f({-eta * g:g}) = {actual:.3f}; "
              f"обещано {promise:.1f}, получено {f_flats(0) - actual:+.3f} — доля {1 - a * eta / 2:+.2f}")
        assert abs(formula - actual) < 1e-9
    assert round(f_flats(0.7), 3) == 25.678 and round(f_flats(17.5), 3) == 60.958
    gain = f_flats(0) - f_flats(7)
    assert abs(gain - 24.5) < 1e-12, "при η = 1 обещано 49, получено ровно половина"
    print("   Выигрыш — доля 1 − η/2 обещания η·(f′)²; половина — при η = 1: обещано 49, получено 24.5.")


def task_8() -> None:
    head("8. Спуск для медианы ★★☆")
    c, steps = 0.0, []
    while True:
        force = float(np.mean(np.sign(Y_FLAT - c)))  # средняя сила: (выше − ниже)/6, sign(0) = 0
        if abs(force) < 1e-12:
            break
        c += 0.5 * force
        steps.append(0.5 * force)
    print(f"   длины шагов: {np.round(steps, 3).tolist()}")
    print(f"   остановка после шага {len(steps)} в c = {c:.3f}")
    print("   Пока c < 3, все шесть цен выше: средняя сила +1, шаг 0.5. На 6-м шаге c = 3 совпало с ценой:")
    print("   её сила sign(0) = 0, средняя сила 5/6, шаг 0.417. В c = 5.083 три цены ниже (3, 4, 5) и три выше")
    print("   (8, 9, 13) — силы уравновешены. Минимум MAE — весь отрезок [5, 8]; 6.5 — лишь его середина.")
    expected = [0.5] * 6 + [5 / 12, 1 / 3, 1 / 3] + [1 / 6] * 6
    assert len(steps) == 15 and np.allclose(steps, expected) and round(c, 3) == 5.083
    assert round(steps[6], 3) == 0.417


def task_9() -> None:
    head("9. Правило ν·M ★☆☆")
    for nu, expected in ((0.3, 13), (0.1, 44), (0.01, 459)):
        M = math.ceil(math.log(0.01) / math.log(1 - nu))  # (1 − ν)^M < 0.01
        m, rest = 0, 1.0
        while rest >= 0.01:  # проверка прямым счётом
            rest, m = rest * (1 - nu), m + 1
        print(f"   ν = {nu:<4}: M = {M:3d} шагов, ν·M = {nu * M:.2f}")
        assert M == m == expected
    print("   При малых ν: ln(1 − ν) ≈ −ν, поэтому M ≈ ln 100/ν ≈ 4.6/ν и ν·M ≈ 4.6.")


def task_10() -> None:
    head("10. Ньютон для параболы ★★☆")
    print("   f′ = a(θ − m), f″ = a ⇒ θ − f′/f″ = θ − (θ − m) = m из любой точки.")
    print("   Квадратичное приближение параболы — она сама, поэтому шаг Ньютона точен.")
    rng = Mulberry32(10)
    for _ in range(5):
        a, m, c, t = rng.uniform(0.1, 10), rng.uniform(-5, 5), rng.uniform(-5, 5), rng.uniform(-20, 20)

        def f(x: float, a: float = a, m: float = m, c: float = c) -> float:
            return a / 2 * (x - m) ** 2 + c

        e = 1e-3  # производные — конечными разностями, без формул
        d1 = (f(t + e) - f(t - e)) / (2 * e)
        d2 = (f(t + e) - 2 * f(t) + f(t - e)) / e**2
        new = t - d1 / d2
        print(f"   a = {a:5.2f}, m = {m:+.3f}, старт {t:+7.2f} → шаг Ньютона приводит в {new:+.3f}")
        assert abs(new - m) < 1e-4


def task_11() -> None:
    head("11. Лист XGBoost ★★☆")
    y, F = np.array([1, 0, 0, 0.0]), np.zeros(4)
    loss = get_loss("logistic")
    g, h = loss.gradient(y, F), loss.hessian(y, F)  # g = p − y, h = p(1 − p)
    G, H = float(g.sum()), float(h.sum())
    newton, xgb = -G / H, -G / (H + 1)
    p_new = sigmoid(newton)
    print(f"   p = 0.5; g = {g.tolist()}, G = {G:g}; h = 0.25 у всех, H = {H:g}")
    print(f"   шаг Ньютона −G/H = {newton:g}; лист XGBoost −G/(H + 1) = {xgb:g}")
    print(f"   после шага Ньютона p = σ({newton:g}) = {p_new:.3f}: ближе к доле единиц 0.25, но ещё не она")
    path = [newton]
    for _ in range(3):
        path.append(path[-1] + loss.leaf_value(y, np.full(4, path[-1])))
    print(f"   ещё шаги Ньютона: {np.round(path, 4).tolist()} → ln(0.25/0.75) = {math.log(1 / 3):.4f}")
    assert G == 1 and H == 1 and newton == -1 and xgb == -0.5
    assert loss.leaf_value(y, F) == newton and round(p_new, 3) == 0.269
    assert abs(path[-1] - math.log(1 / 3)) < 1e-9


# ================================================================ Часть III. Много параметров

def task_12() -> None:
    head("12. Градиент руками ★☆☆")
    x, y = np.array([1, 2.0]), np.array([2, 3.0])

    def f(w: np.ndarray) -> float:
        return float(np.mean((y - w[0] * x - w[1]) ** 2) / 2)

    w = np.zeros(2)
    r = y - (w[0] * x + w[1])  # в (0, 0) остатки равны y
    grad = np.array([-np.mean(r * x), -np.mean(r)])
    num = np.array([central(lambda s, j=j: f(w + s * np.eye(2)[j]), 0.0) for j in range(2)])
    step = w - 0.1 * grad
    print(f"   ∇f(0, 0) = {grad.tolist()} (численно {np.round(num, 6).tolist()}); после шага (a, b) = {step.tolist()}")
    print(f"   ½·MSE: {f(w):.3f} → {f(step):.3f}")
    assert np.allclose(grad, [-4, -2.5]) and np.allclose(num, grad) and np.allclose(step, [0.4, 0.25])


def task_13() -> None:
    head("13. Вытянутая чаша ★★☆")
    kappa = 50
    eta = 2 / (1 + kappa)
    m1, m2 = 1 - eta, 1 - kappa * eta
    n_best, n_edge = bowl_steps(kappa, eta), bowl_steps(kappa, 0.0399)
    print(f"   кривизны 1 и 50: сходимость при η < 2/50 = {2 / kappa:g} (η = 0.0401: "
          f"{'разнос' if bowl_steps(kappa, 0.0401) is None else 'сходится'})")
    print(f"   лучший постоянный η = 2/51 = {eta:.4f}: множители {m1:+.3f} и {m2:+.3f}, шагов {n_best}")
    print(f"   у самой границы η = 0.0399: множитель по θ₂ {1 - kappa * 0.0399:+.3f}, шагов {n_edge}")
    print(f"   θ₂ = u/√50: f = ½(θ₁² + u²), κ = 1, при η = 1 — шагов {bowl_steps(1, 1.0)}."
          " Это и есть стандартизация признака.")
    assert n_best == 173 and n_edge == 1181 and round(m1, 3) == 0.961 and round(m2, 3) == -0.961
    assert bowl_steps(kappa, 0.0401) is None and bowl_steps(1, 1.0) == 1


def task_14() -> None:
    head("14. Затухающий темп в SGD ★★☆")
    print("   Индукция: c₁ = 0 + 1·(y₁ − 0) = y₁. Если c_k — среднее k цен, то")
    print("   c_{k+1} = c_k + (y − c_k)/(k + 1) = (k·c_k + y)/(k + 1) — среднее k + 1 цен.")
    rng, c, picked, path = Mulberry32(1), 0.0, [], []
    for k in range(600):
        i = rng.sample(6, 1)[0]  # одна случайная квартира, как в виджете шага 13
        c += (Y_FLAT[i] - c) / (k + 1)
        picked.append(Y_FLAT[i])
        path.append(c)
        assert abs(c - np.mean(picked)) < 1e-9, "c_k — ровно среднее выбранных цен"
    print(f"   Mulberry32(1): цены {[int(v) for v in picked[:6]]} → c = {np.round(path[:6], 2).tolist()}")
    print(f"   после 600 шагов c = {path[-1]:.3f} — по закону больших чисел стремится к ȳ = 7")
    assert [int(v) for v in picked[:6]] == [8, 3, 8, 13, 13, 5]
    assert np.allclose(np.round(path[:6], 2), [8, 5.5, 6.33, 8, 9, 8.33])
    assert abs(path[-1] - 7) < 0.3


# ================================================================ Часть IV. Мост к бустингу

def task_15() -> None:
    head("15. Рельеф по порогу ★★☆")
    sse = {}
    for lo, hi in ((30, 40), (40, 50), (50, 60), (60, 70), (70, 80)):
        values = [np.sum((R0 - stump(R0, t)) ** 2) for t in np.linspace(lo, hi - 0.01, 7)]
        assert np.allclose(values, values[0]), "внутри интервала рельеф плоский"
        sse[lo] = values[0]
        print(f"   t ∈ [{lo}, {hi}): сумма квадратов {values[0]:.1f}")
    print(f"   без разбиения: {np.sum(R0**2):.0f}")
    print("   Внутри интервала пень не меняется — производная по t равна нулю; на площадях квартир")
    print("   функция скачет — производной нет. Порог выбирают перебором: лучший 55 (сумма 16).")
    assert np.allclose(list(sse.values()), [50.8, 43.0, 16.0, 22.0, 26.8]) and np.sum(R0**2) == 70
    assert min(sse, key=sse.get) == 50


def task_16() -> None:
    head("16. Шаг-дерево — направление спуска ★★★")
    res = {}
    for t in (75, 55):
        h = stump(R0, t)
        hr, hh = float(h @ R0), float(h @ h)
        sse = float(np.sum((R0 - 0.5 * h) ** 2))
        cos = hr / math.sqrt(hh * float(R0 @ R0))
        res[t] = (hr, sse)
        print(f"   порог {t}: h = {np.round(h, 2).tolist()}")
        print(f"      h·r = {hr:.1f} > 0, ‖h‖² = {hh:.1f}, cos(h, r) = {cos:.3f}, "
              f"сумма квадратов после шага {sse:.1f} = 70 − 0.75·h·r")
        assert abs(hh - hr) < 1e-9, "у пня ‖h‖² = h·r: в каждой группе h — среднее r"
        assert abs(sse - (70 - 0.75 * hr)) < 1e-9
    print("   Оба шага — направления спуска (h·r > 0). Пень 55 сильнее «согласен» с антиградиентом:")
    print("   h·r больше, поэтому сумма квадратов падает сильнее (29.5 против 37.6).")
    assert np.allclose(res[75], (43.2, 37.6)) and np.allclose(res[55], (54, 29.5))


def task_17() -> None:
    head("17. Почему бустингу нужны деревья ★★★")
    X, y = datasets.regression_1d(kind="wave", n=12, noise=0.3, seed=3)
    Xt, yt = datasets.regression_1d(kind="wave", n=200, noise=0.3, seed=103)
    nu, K = 0.3, 40
    F = np.full_like(y, y.mean())
    for _ in range(K):
        F = F + nu * (y - F)  # свободный шаг: каждый прогноз — к своему ответу
    free_train, free_new = mse(y, F), mse(yt, np.full_like(yt, y.mean()))
    gb = GBRegressor(n_estimators=K, learning_rate=nu, max_depth=2).fit(X, y)
    new = [mse(yt, gb.predict(Xt, n_iter=k)) for k in range(K + 1)]
    gb_train = mse(y, gb.predict(X))
    best = int(np.argmin(new))
    print(f"   свободно, {K} шагов: обучение {free_train:.1e}, новые точки {free_new:.4f} (там прогноз навсегда F₀)")
    print(f"   бустинг,  {K} шагов: обучение {gb_train:.4f}, новые точки {new[K]:.4f}")
    print(f"   ошибка бустинга на новых точках минимальна при k = {best}: {new[best]:.4f}")
    print("   Свободный спуск умножает каждый остаток на (1 − ν)^k и запоминает 12 ответов вместе с шумом,")
    print("   но правила для новых x у него нет. Поправка бустинга — функция от x: она переносится на соседние")
    print("   новые точки. После k ≈ 10 бустинг тоже начинает подгонять шум — повод для ранней остановки.")
    assert free_train < 1e-10 and round(free_new, 4) == 1.4441
    assert round(gb_train, 4) == 0.0002 and round(new[K], 4) == 0.2531
    assert best == 10 and round(new[best], 4) == 0.2196


# ================================================================ Только в файле: 18–23

def task_18() -> None:
    head("18. Один шаг по одной квартире ★☆☆")
    eta = 0.5
    c1 = 0 + eta * (Y_FLAT - 0)  # из c₀ = 0
    at7 = 7 + eta * (Y_FLAT - 7)  # из дна c = 7
    full0, full7 = 0 - eta * (0 - 7), 7 - eta * (7 - 7)
    print(f"   из 0: возможные c₁ = {c1.tolist()}, среднее {c1.mean():g}; полный шаг {full0:g}")
    print(f"   из 7: возможные c₁ = {at7.tolist()}, среднее {at7.mean():g}; полный шаг {full7:g} (f′(7) = 0)")
    print(f"   разброс (стандартное отклонение): {c1.std():.3f} в точке 0 и {at7.std():.3f} в точке 7")
    print("   В среднем стохастический шаг равен полному. Но его разброс η·std(y) не зависит от того, где мы:")
    print("   у дна полный шаг стоит на месте, а шаг по одной квартире отбрасывает c на 1–3 млн. Поэтому при")
    print("   постоянном темпе SGD не останавливается; останавливает его затухающий темп (задача 14).")
    assert np.allclose(c1, [1.5, 2.5, 2, 4, 4.5, 6.5]) and c1.mean() == 3.5 == full0
    assert np.allclose(at7, [5, 6, 5.5, 7.5, 8, 10]) and at7.mean() == 7 == full7
    assert abs(c1.std() - at7.std()) < 1e-12 and round(c1.std(), 3) == 1.708


def task_19() -> None:
    head("19. Прямая по центрированным площадям ★★☆")
    u = (X_FLAT - 55) / 10
    uu, uy = np.mean(u * u), np.mean(u * Y_FLAT)
    print(f"   ū = 0, mean(u²) = {uu:.3f}, mean(u·y) = {uy:g}: ∂f/∂a = {uu:.3f}·a − {uy:g}, ∂f/∂b = b − 7")
    print("   Смешанная производная равна ū = 0 — параметры не сцеплены, это две независимые параболы.")

    def grad(a: float, b: float) -> tuple[float, float]:
        r = Y_FLAT - (a * u + b)
        return -float(np.mean(r * u)), -float(np.mean(r))

    a = b = 0.0
    rows = []
    for k in range(3):
        ga, gb = grad(a, b)
        half = float(np.mean((Y_FLAT - a * u - b) ** 2) / 2)
        rows.append((a, b, half, ga, gb))
        print(f"   k = {k}: a = {a:.3f}, b = {b:.3f}, ½·MSE = {half:.3f}, ∇f = ({ga:.3f}, {gb:.3f})")
        a, b = a - 0.5 * ga, b - 0.5 * gb
    eta_a = 1 / uu
    ga, gb = grad(0.0, 0.0)
    a1, b1 = -eta_a * ga, -eta_a * gb
    a_opt, b_opt = uy / uu, 7.0
    print(f"   η = 1/{uu:.3f} = {eta_a:.3f}: из нуля a = {a1:.3f} (оптимум {a_opt:.3f}), но b = {b1:.2f}")
    print(f"   Для b идеален η = 1, для a — {eta_a:.3f}: кривизны разные, κ = {uu:.3f}; одного темпа на оба нет.")
    print(f"   Сходимость при η < 2/{uu:.3f} = {2 * eta_a:.3f}.")
    slope, shift = a_opt / 10, b_opt - a_opt * 5.5
    ls = np.polyfit(X_FLAT, Y_FLAT, 1)
    print(f"   В площадях: наклон {slope:.4f} млн за м², сдвиг {shift:.3f}; МНК: {ls[0]:.4f}, {ls[1]:.3f}")
    assert round(uu, 3) == 2.917 and uy == 5.5
    assert np.allclose(rows[1][:2], (2.75, 3.5)) and round(rows[2][0], 3) == 1.490 and rows[2][1] == 5.25
    assert round(rows[1][2], 3) == 7.862 and round(rows[2][2], 3) == 2.408
    assert round(eta_a, 3) == 0.343 and abs(a1 - a_opt) < 1e-12 and round(b1, 2) == 2.4
    assert round(2 * eta_a, 3) == 0.686 and np.allclose(ls, [slope, shift])
    assert round(slope, 4) == 0.1886 and round(shift, 3) == -3.371


def task_20() -> None:
    head("20. Лист пня — это шаг Ньютона ★★☆")
    F0 = np.full(6, 7.0)
    g, h = F0 - Y_FLAT, np.ones(6)  # производные ½(y − F)² по F
    left = X_FLAT <= 55
    leaves = {}
    for name, mask in (("левый", left), ("правый", ~left)):
        G, H = float(g[mask].sum()), float(h[mask].sum())
        leaves[name] = (G, H, -G / H, -G / (H + 1))
        print(f"   {name:6s} лист: G = {G:+g}, H = {H:g}, −G/H = {-G / H:+g} (средний остаток "
              f"{R0[mask].mean():+g}), XGBoost при λ = 1: {-G / (H + 1):+.2f}")
    print("   Для ½·MSE все hᵢ = 1: H — число объектов в листе, а −G/H — средний остаток. Ньютон = спуск с η = 1.")
    print("   λ = 1 умножает лист на H/(H + λ) = 3/4: это сжатие значения листа.")
    X = X_FLAT.reshape(-1, 1)
    for lam in (0.0, 1.0):
        gb = GBRegressor(n_estimators=1, learning_rate=1.0, max_depth=1, mode="newton", reg_lambda=lam)
        pred = gb.fit(X, Y_FLAT).predict(X)
        print(f"   gbcourse, λ = {lam:g}: прогнозы {pred.tolist()}")
        assert np.allclose(pred, np.where(left, 7 - 3 / (1 + lam / 3), 7 + 3 / (1 + lam / 3)))
    assert leaves["левый"] == (9.0, 3.0, -3.0, -2.25) and leaves["правый"] == (-9.0, 3.0, 3.0, 2.25)


def task_21() -> None:
    head("21. Цена зигзага и инерция ★★★")
    kappa = 10
    eta = 2 / (1 + kappa)
    n_best = bowl_steps(kappa, eta)
    estimate = math.log(1000) / math.log((kappa + 1) / (kappa - 1))
    print(f"   η = 2/11 = {eta:.3f}: множители {1 - eta:+.3f} и {1 - kappa * eta:+.3f}, шагов {n_best} "
          f"(оценка ln 1000/ln(11/9) = {estimate:.1f} ≈ 3.45κ)")
    plain = {e: bowl_steps(kappa, e) for e in (0.15, 0.2)}
    heavy = {e: bowl_steps(kappa, e, beta=0.5) for e in (0.15, 0.2)}
    for e in (0.15, 0.2):
        p = f"шагов: {plain[e]}" if plain[e] is not None else "не сходится (множитель по θ₂ равен −1)"
        print(f"   η = {e}: без инерции — {p}; с инерцией β = 0.5 — шагов: {heavy[e]}")
    print("   θ_k = (−1)^k: (−1)^(k+1) = (1 + β − ηa)(−1)^k − β(−1)^(k−1) ⇒ 1 = −(1 + β − ηa) − β ⇒ ηa = 2(1 + β).")
    edge = 2 * (1 + 0.5) / kappa
    near = {e: bowl_steps(kappa, e, beta=0.5) for e in (0.29, 0.31)}
    print(f"   граница 2(1 + β)/κ = {edge:g}: η = 0.29 — сходится (шагов: {near[0.29]}), η = 0.31 — "
          f"{'разнос' if near[0.31] is None else near[0.31]}")
    best = {}
    for k in (10, 100):
        sq = math.sqrt(k)
        best[k] = (bowl_steps(k, (2 / (1 + sq)) ** 2, ((sq - 1) / (sq + 1)) ** 2), bowl_steps(k, 2 / (1 + k)))
        print(f"   κ = {k:3d}: шагов с лучшей инерцией — {best[k][0]}, с лучшим постоянным темпом — {best[k][1]}")
    print("   Без инерции шагов ~κ, с инерцией ~√κ: при κ = 100 разница уже в 6.5 раза.")
    assert n_best == 35 and round(1 - eta, 3) == 0.818 and round(estimate) == 34
    assert plain == {0.15: 43, 0.2: None} and heavy == {0.15: 18, 0.2: 20}
    assert abs(edge - 0.3) < 1e-12 and near[0.29] is not None and near[0.31] is None
    assert best == {10: (15, 35), 100: (53, 346)}


def task_22() -> None:
    head("22. Ньютон для редкого класса ★★★")
    p = 0.1

    def d1(F: float) -> float:
        return sigmoid(F) - p

    def d2(F: float) -> float:
        return sigmoid(F) * (1 - sigmoid(F))

    F_star = math.log(p / (1 - p))
    print(f"   F* = ln(0.1/0.9) = {F_star:.4f}, f″(F*) = 0.1·0.9 = {d2(F_star):.2f}; f″(0) = {d2(0):.2f}")
    methods = {
        "спуск η = 1": lambda F: F - d1(F),
        "спуск η = 1/f″(0) = 4": lambda F: F - d1(F) / d2(0.0),
        "Ньютон": lambda F: F - d1(F) / d2(F),
    }
    counts = {}
    for name, step in methods.items():
        F, k = 0.0, 0
        while abs(F - F_star) >= 1e-6 and k < 10000:
            F, k = step(F), k + 1
        counts[name] = k
        print(f"   {name:22s}: {k:3d} шагов до |F − F*| < 1e-6")
    y100 = np.array([1.0] * 10 + [0.0] * 90)  # 10 должников из 100: та же задача в форме сумм
    first = get_loss("logistic").leaf_value(y100, np.zeros(100))
    print(f"   первый шаг у Ньютона и у спуска с η = 4 одинаков: G = 50 − 10 = 40, H = 100·0.25 = 25, "
          f"−G/H = {first:+.1f}")
    print(f"   У дна кривизна {d2(F_star):.2f}, идеальный темп 1/0.09 = {1 / d2(F_star):.1f}. Множитель ошибки у дна:")
    print(f"   η = 1 — {1 - d2(F_star):.2f}, η = 4 — {1 - 4 * d2(F_star):.2f}; Ньютон пересчитывает кривизну и"
          " удваивает верные знаки.")
    F, far = 2.0, []
    for _ in range(3):
        F = F - d1(F) / d2(F)
        far.append(F)
    print(f"   Ньютон из F = 2: {far[0]:.3f}, {far[1]:.3f}, {far[2]:.3g} — разлетается: в хвостах кривизна мала")
    print("   (f″(2) = 0.105, f″(−5.44) = 0.004), и прыжок в дно параболы улетает за минимум всё дальше.")

    def converges(F0: float) -> bool:
        F = F0
        for _ in range(100):
            F = F - d1(F) / d2(F)
            if abs(F) > 30:  # в хвостах кривизна ничтожна, и шаги только растут
                return False
            if abs(F - F_star) < 1e-9:
                return True
        return False

    grid = np.round(np.arange(-8, 6.0001, 0.01), 2)
    ok = np.array([converges(float(v)) for v in grid])
    lo, hi = grid[ok].min(), grid[ok].max()
    print(f"   сетка от −8 до 6 с шагом 0.01: Ньютон сходится при F₀ от {lo:.2f} до {hi:.2f};")
    print(f"   область несимметрична: от F* = {F_star:.2f} вправо на {hi - F_star:.2f}, влево лишь на "
          f"{F_star - lo:.2f}:")
    print("   левее F* кривизна f″ ≈ σ быстро падает, и шаг ≈ 0.1/σ перелетает далеко вправо.")
    F, k, capped = 2.0, 0, []
    while abs(F - F_star) >= 1e-6 and k < 100:
        F, k = F + float(np.clip(-d1(F) / d2(F), -1, 1)), k + 1
        capped.append(F)
    print(f"   с ограничением |Δ| ≤ 1: {np.round(capped[:5], 3).tolist()}, … — {k} шагов из F = 2")
    assert round(F_star, 4) == -2.1972 and abs(d2(F_star) - 0.09) < 1e-12
    assert list(counts.values()) == [147, 30, 5] and abs(first + 1.6) < 1e-12
    assert np.allclose(far[:2], [-5.437, 16.726], atol=5e-4) and far[2] < -1e7
    assert abs(lo + 4.21) < 0.015 and abs(hi - 1.75) < 0.015 and np.all(ok[(grid >= lo) & (grid <= hi)])
    assert k == 7


def task_23() -> None:
    head("23. Шум стохастического спуска ★★★")
    X, y = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)
    z = (X[:, 0] - X[:, 0].mean()) / X[:, 0].std()
    n = len(y)

    def half(a: float, b: float) -> float:
        return float(np.mean((y - a * z - b) ** 2) / 2)

    a_opt, b_opt = float(np.mean(z * (y - y.mean()))), float(y.mean())
    opt = half(a_opt, b_opt)

    def tail_excess(B: int, eta: float, seed: int) -> float:
        rng, a, b, hist = Mulberry32(seed), 0.0, 0.0, []
        for _ in range(400):
            idx = rng.sample(n, B)
            r = y[idx] - (a * z[idx] + b)
            a, b = a + eta * np.mean(r * z[idx]), b + eta * np.mean(r)
            hist.append(half(a, b))
        return float(np.mean(hist[-200:])) - opt

    # градиенты отдельных объектов в минимуме: −rᵢ·(zᵢ, 1); их среднее — ноль
    res = y - (a_opt * z + b_opt)
    grads = -res[:, None] * np.c_[z, np.ones(n)]
    trace_s = float(np.trace(grads.T @ grads / n))
    print(f"   минимум ½·MSE = {opt:.5f}; tr S = {trace_s:.3f}")
    print("    B     η   избыток (40 зёрен)   оценка по формуле")
    excess, theory = {}, {}
    for B in (1, 5):
        for eta in (0.1, 0.05):
            excess[B, eta] = float(np.mean([tail_excess(B, eta, s) for s in range(1, 41)]))
            theory[B, eta] = eta / (2 * (2 - eta)) * (n - B) / ((n - 1) * B) * trace_s
            print(f"   {B:2d} {eta:5g} {excess[B, eta]:14.4f} {theory[B, eta]:18.4f}")
    rb = [excess[1, e] / excess[5, e] for e in (0.1, 0.05)]
    re = [excess[B, 0.1] / excess[B, 0.05] for B in (1, 5)]
    print(f"   η вдвое меньше → избыток меньше в {min(re):.2f}–{max(re):.2f} раза (≈ 2: шум ∝ η/(2 − η));")
    print(f"   B = 5 вместо 1 → в {min(rb):.1f}–{max(rb):.1f} раза.")
    print(f"   Без возвращения разброс среднего пакета — (n − B)/((n − 1)B): для B = 5 это 1/{5 * 29 / 25:.1f}, а не 1/5.")
    print("   Вывод формулы: e_{k+1} = (1 − η)e_k − ηξ_k ⇒ в установившемся режиме Cov e = η·Cov ξ/(2 − η),")
    print("   избыток = ½·tr(Cov e). Шум растёт с η и падает с B — поэтому к концу обучения уменьшают темп")
    print("   или увеличивают пакет.")
    shown = {(1, 0.1): 0.032, (1, 0.05): 0.015, (5, 0.1): 0.005}
    for key, v in shown.items():
        assert round(excess[key], 3) == v, f"избыток при (B, η) = {key}: {excess[key]:.5f}"
    assert round(excess[5, 0.05], 4) == 0.0025
    assert all(5 < r < 7 for r in rb) and all(1.9 < r < 2.3 for r in re)
    assert all(abs(theory[k] / excess[k] - 1) < 0.15 for k in excess), "формула верна с точностью ~10 %"


PARTS = [
    ("Часть I. Производная", [task_1, task_2, task_3, task_4]),
    ("Часть II. Спуск по одной переменной", [task_5, task_6, task_7, task_8, task_9, task_10, task_11]),
    ("Часть III. Много параметров", [task_12, task_13, task_14]),
    ("Часть IV. Мост к бустингу", [task_15, task_16, task_17]),
    ("Ещё задачи (только в tasks.md)", [task_18, task_19, task_20, task_21, task_22, task_23]),
]


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):  # консоль Windows: кириллица без ошибок
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    for title, tasks in PARTS:
        print(f"\n{'=' * 10} {title} {'=' * 10}")
        for task in tasks:
            task()
    print("\nВсе 23 решения проверены.")
