"""Лестница примеров: все расчёты на листке.

Запуск:  python lessons/lesson_1_3/examples/ladder_by_hand.py [--save] [--no-show]

Регрессионная проверка текста урока 1.3. Скрипт проходит по ступеням «лестницы примеров» в порядке
шагов 1–14 и пересчитывает каждое число, которое на странице посчитано «на листке»: значения f(c)
шести квартир, секущие, силы ½·MSE и MAE, три случая log-loss, таблицу спуска, долю обещания
касательной, режимы темпа, правило ν·M, поиск с возвратом, сетку темпа на log-loss, шаг Ньютона
и листья −G/H, градиент чаши и седло, зигзаг и инерцию, прямую по u, стохастический шаг по одной
квартире и три раунда «свободно ↔ пни».

Каждое число печатается рядом с тем, как оно записано на странице, и сверяется assert-ом с
точностью до последнего напечатанного знака. Если формулы или текст урока разойдутся, скрипт
упадёт и назовёт место. Числа виджетов на 12 и 30 точках проверяют соседние примеры
prediction_descent.py и sgd_batches.py.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets, style
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32

ex = Example(__file__)

CHECKED = [0]  # сколько чисел сверено со страницей


def agree(label: str, value: float, shown: str, tol: float | None = None,
          exact: float | None = None) -> None:
    """Сверить число с записью на странице.

    По умолчанию допуск — половина последнего напечатанного разряда: «30.333» принимает
    значения от 30.3325 до 30.3335, а целое «7» — только 7 (до 1e-9). ``tol`` задаёт допуск
    явно (для округлённых «≈ 37 700»), ``exact`` — точное значение для записей вроде «−1/3».
    """
    text = shown.replace("−", "-").replace("+", "").replace(" ", "").replace("%", "")
    if exact is not None:
        target, tol = exact, 1e-12 if tol is None else tol
    else:
        target = float(text)
        if tol is None:
            mantissa, _, power = text.lower().partition("e")
            decimals = len(mantissa.split(".")[1]) if "." in mantissa else 0
            shift = int(power) if power else 0
            tol = 0.5 * 10.0 ** (shift - decimals) + 1e-12 if decimals or shift else 1e-9
    assert abs(value - target) <= tol, f"{label}: получилось {value!r}, на странице {shown}"
    CHECKED[0] += 1
    print(f"  {label:<50s} {value:>13.6g}   стр.: {shown}")


def same_list(label: str, values, shown: list[str], rounded: bool = False) -> None:
    """Сверить ряд чисел (строку таблицы, путь спуска) поэлементно.

    Целые записи сверяются точно; ``rounded=True`` — если на странице они округлены («−376»).
    """
    values = list(values)
    assert len(values) == len(shown), f"{label}: {len(values)} чисел, на странице {len(shown)}"
    for v, s in zip(values, shown):
        text = s.replace("−", "-").replace("+", "")
        decimals = len(text.split(".")[1]) if "." in text else 0
        tol = 0.5 * 10.0**-decimals + 1e-12 if decimals or rounded else 1e-9
        assert abs(v - float(text)) <= tol, f"{label}: получилось {v!r}, на странице {s}"
    CHECKED[0] += len(values)
    print(f"  {label:<50s} {', '.join(shown)}")


def head(text: str) -> None:
    print(f"\n{text}\n" + "─" * len(text))


# Сквозной пример урока: шесть квартир
x = np.array([30, 40, 50, 60, 70, 80.0])  # площадь, м²
y = np.array([3, 5, 4, 8, 9, 13.0])  # цена, млн
YBAR = 7.0


def f(c: float) -> float:
    """½·MSE константы c на шести квартирах."""
    return float(np.mean(0.5 * (y - c) ** 2))


def df(c: float) -> float:
    """Производная f′(c) = среднее −(yᵢ − c) = c − 7."""
    return float(np.mean(-(y - c)))


def sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


# ═══════════════════════════════ Часть I ═══════════════════════════════
head("Шаг 1. Задача: f(c) = 70/12 + ½(c − 7)²")
agree("среднее цен ȳ", y.mean(), "7")
same_list("квадраты остатков от среднего", (y - YBAR) ** 2, ["16", "4", "9", "1", "4", "36"])
agree("их сумма", np.sum((y - YBAR) ** 2), "70")
for c in np.linspace(-3, 17, 41):  # тождество для параболы проверяем на сетке
    assert abs(f(c) - (70 / 12 + 0.5 * (c - 7) ** 2)) < 1e-12
agree("f(7) = 70/12", 70 / 12, "5.833")
for c, shown in [(0, "30.333"), (3.5, "11.958"), (5, "7.833"), (7, "5.833"), (10, "10.333"),
                 (14, "30.333")]:
    agree(f"f({c:g})", f(c), shown)
grid_points = round(20 / 0.01) + 1
agree("перебор: точек сетки 0…20 с шагом 0.01", grid_points, "2001")
agree("для двух параметров, млн", grid_points**2 / 1e6, "4", tol=0.05)
agree("для десяти параметров, порядок 10^…", math.log10(float(grid_points) ** 10), "33", tol=0.5)
years = float(grid_points) ** 10 / 1e9 / (365.25 * 24 * 3600)
agree("лет при 10⁹ вычислений в секунду", years, "3e16", tol=0.5e16)
agree("во сколько раз дольше возраста Вселенной, млн", years / 13.8e9 / 1e6, "2", tol=0.5)

head("Шаг 2. Производная: секущие и линейное приближение")
for eps, shown_f, shown_slope in [(1, "23.833", "−6.5"), (0.1, "29.638", "−6.95"),
                                  (0.01, "30.263", "−6.995"), (0.001, "30.326", "−6.9995")]:
    slope = (f(eps) - f(0)) / eps
    assert abs(slope - (-7 + eps / 2)) < 1e-9, "наклон секущей = −7 + ε/2"
    agree(f"f({eps:g})", f(eps), shown_f)
    agree(f"наклон секущей при ε = {eps:g}", slope, shown_slope)
sq = lambda t: t**2  # noqa: E731
for eps, shown in [(1, "7"), (0.1, "6.1"), (0.01, "6.01")]:
    agree(f"θ² в точке 3: наклон секущей при ε = {eps:g}", (sq(3 + eps) - sq(3)) / eps, shown)
agree("θ²: центральная разность при ε = 0.5 (точна)", (sq(3.5) - sq(2.5)) / 1.0, "6")
agree("сдвиг c: 0 → 0.1, обещание 7·0.1", -df(0) * 0.1, "0.7")
agree("на самом деле f(0) − f(0.1)", f(0) - f(0.1), "0.695")
agree("расхождение = ½·f″·Δ² = ½·1·0.1²", 0.7 - (f(0) - f(0.1)), "0.005", tol=1e-12)

print("  «Глубже»: ошибка численной производной θ³ в точке 1 (f′ = 3)")
cube = lambda t: t**3  # noqa: E731
errors = {}
for eps in (1e-1, 1e-4, 1e-6, 1e-8, 1e-12):
    fwd = abs((cube(1 + eps) - cube(1)) / eps - 3)
    cen = abs((cube(1 + eps) - cube(1 - eps)) / (2 * eps) - 3)
    errors[eps] = (fwd, cen)
    print(f"    ε = {eps:.0e}: вперёд {fwd:.1e}, центральная {cen:.1e}")
agree("вперёд, ε = 0.1", errors[1e-1][0], "0.31")
agree("центральная, ε = 0.1", errors[1e-1][1], "0.01")
agree("вперёд, ε = 1e-4", errors[1e-4][0], "3e-4")
agree("центральная, ε = 1e-4", errors[1e-4][1], "1e-8")
# Дальше решают последние биты округления (pow в libm), поэтому проверяем порядок величины
for eps, fwd_shown, cen_shown in [(1e-6, 3e-6, 8e-11), (1e-8, 4e-9, 7e-9), (1e-12, 3e-4, 1e-4)]:
    fwd, cen = errors[eps]
    assert fwd_shown / 10 < fwd < fwd_shown * 10 and cen_shown / 10 < cen < cen_shown * 10, eps
assert min(errors, key=lambda e: errors[e][1]) == 1e-6, "центральная точнее всего около 1e-6"
assert errors[1e-12][1] > errors[1e-4][1], "при крошечном ε побеждает ошибка округления"
CHECKED[0] += 6

head("Шаг 3. Производные потерь")
res5 = y - 5
same_list("c = 5: остатки yᵢ − 5", res5, ["−2", "0", "−1", "3", "4", "8"])
same_list("производные слагаемых −(yᵢ − 5)", -res5, ["2", "0", "1", "−3", "−4", "−8"])
agree("их сумма", np.sum(-res5), "−12")
agree("среднее = f′(5) = 5 − 7", np.mean(-res5), "−2")
for c, shown in [(0, "−7"), (3, "−4"), (7, "0"), (10, "3")]:
    agree(f"½·MSE: f′({c})", df(c), shown)
mae_slope = lambda c: float(np.mean(-np.sign(y - c)))  # noqa: E731
agree("MAE: f′(0)", mae_slope(0), "−1")
agree("MAE: f′(4.5) = (2 − 4)/6", mae_slope(4.5), "−1/3", exact=-1 / 3)
agree("MAE: f′(10) = (5 − 1)/6", mae_slope(10), "+2/3", exact=2 / 3)
for c in (5.01, 6.5, 7.99):
    assert mae_slope(c) == 0, "между 5 и 8 силы уравновешены"
agree("MAE: f′(c) на интервале (5, 8)", mae_slope(6.5), "0")
agree("медиана (середина отрезка [5, 8])", float(np.median(y)), "6.5")
print("  log-loss: три случая (F, y) → p, ∂L/∂F = p − y, p(1 − p)")
for name, F, yy, shown in [("не уверен", 0, 1, ["0.5", "−0.5", "0.25"]),
                           ("уверен и прав", 2, 1, ["0.881", "−0.119", "0.105"]),
                           ("уверен и ошибся", 2, 0, ["0.881", "+0.881", "0.105"])]:
    p = sigmoid(F)
    eps = 1e-6
    L = lambda F_, yy=yy: -(yy * math.log(sigmoid(F_))  # noqa: E731
                            + (1 - yy) * math.log(1 - sigmoid(F_)))
    assert abs((L(F + eps) - L(F - eps)) / (2 * eps) - (p - yy)) < 1e-8, "∂L/∂F = p − y"
    same_list(f"  {name}: F = {F}, y = {yy}", [p, p - yy, p * (1 - p)], shown)
agree("псевдо-остаток ½·MSE: 13 млн при F = 7", 13 - 7, "+6")
agree("псевдо-остаток MAE: та же квартира", float(np.sign(13 - 7)), "+1")
agree("псевдо-остаток log-loss: y = 1, F = 0", 1 - sigmoid(0), "+0.5")
agree("кривизна квартир f″ = (f′(c + 1) − f′(c))/1", df(4) - df(3), "1")
agree("наибольшая кривизна log-loss p(1 − p) при p = 0.5", 0.5 * 0.5, "0.25")

# ═══════════════════════════════ Часть II ═══════════════════════════════
head("Шаг 4. Спуск руками: квартиры, ½·MSE, c₀ = 0, η = 0.5")
table4 = [["0", "30.333", "−7", "3.5", "3.5", "7"],
          ["3.5", "11.958", "−3.5", "5.25", "1.75", "3.5"],
          ["5.25", "7.365", "−1.75", "6.125", "0.875", "1.75"],
          ["6.125", "6.216", "−0.875", "6.5625", "0.4375", "0.875"],
          ["6.5625", "5.929", "−0.4375", "6.7813", "0.2188", "0.4375"]]
c = 0.0
for k, shown in enumerate(table4):
    c_next = c - 0.5 * df(c)
    assert abs(c_next - (c + 0.5 * (y - c).mean())) < 1e-12, "шаг спуска = бустинг одного числа"
    same_list(f"k = {k}: c, f, f′, c_next, длина, до минимума",
              [c, f(c), df(c), c_next, abs(c_next - c), YBAR - c], shown)
    c = c_next
agree("сила квартиры за 13 млн при c = 7 (½·MSE)", 13 - 7, "6")
agree("сила квартиры за 8 млн при c = 7", 8 - 7, "1")

print("  MAE, η = 0.5 из нуля: длины шагов")
c, steps = 0.0, []
while True:
    force = float(np.mean(np.sign(y - c)))  # средняя сила = −f′(c)
    if abs(force) < 1e-12:
        break
    steps.append(0.5 * force)
    c += 0.5 * force
same_list("  шаги 1–6", steps[:6], ["0.5"] * 6)
agree("  7-й шаг (c = 3 совпало с ценой): 0.5·5/6", steps[6], "0.417")
same_list("  шаги 8–9", steps[7:9], ["0.333", "0.333"])
same_list("  шаги 10–15", steps[9:], ["0.167"] * 6)
agree("  всего шагов до остановки", len(steps), "15")
agree("  где остановился", c, "5.083")
assert 5 <= c <= 8, "остановка внутри отрезка медиан [5, 8]"

head("Шаг 5. Обещание касательной: f(0) = 30.333, f′(0) = −7, f′² = 49")
rows5 = [(0.1, "0.7", "25.433", "25.678", "95"), (0.5, "3.5", "5.833", "11.958", "75"),
         (1, "7", "−18.667", "5.833", "50"), (2, "14", "−67.667", "30.333", "0"),
         (2.5, "17.5", "−92.167", "60.958", "−25")]
for eta, *shown in rows5:
    c1 = 0 - eta * df(0)
    promise, gain = eta * df(0) ** 2, f(0) - f(c1)
    share = gain / promise
    assert abs(share - (1 - eta / 2)) < 1e-12, "доля обещания = 1 − aη/2 при a = 1"
    assert abs(f(c1) - (f(0) - eta * (1 - eta / 2) * df(0) ** 2)) < 1e-12, "точная формула"
    same_list(f"η = {eta:g}: c₁, обещание, f(c₁), доля %", [c1, f(0) - promise, f(c1), 100 * share],
              shown)
agree("η = 0.5: получено", f(0) - f(3.5), "18.4")
agree("η = 0.5: обещано", 0.5 * 49, "24.5")
F_star = math.log(0.3 / 0.7)


def logloss(F: float) -> float:
    """Средний log-loss константы-логита F при доле единиц 0.3."""
    p = sigmoid(F)
    return -(0.3 * math.log(p) + 0.7 * math.log(1 - p))


lo, hi = 5.0, 20.0  # правая граница зелёной зоны: logloss(−0.2η) = logloss(0), делением пополам
for _ in range(60):
    mid = (lo + hi) / 2
    lo, hi = (mid, hi) if logloss(-0.2 * mid) < logloss(0) else (lo, mid)
agree("log-loss из 0: функция уменьшается вплоть до η ≈", lo, "9.0")
agree("log-loss: лучший темп из 0 (−0.2η = F*)", F_star / -0.2, "4.2")
agree("лемма о спуске: L = 0.25, гарантия при η < 2/L", 2 / 0.25, "8")

head("Шаг 6. Множитель 1 − ηa: квартиры, a = 1, c₀ = 0")


def steps_to(eta: float, share: float = 0.01, limit: int = 10_000) -> int | None:
    """Число шагов, пока расстояние до 7 не станет ≤ share·7; None — не дойдёт никогда."""
    c = 0.0
    for k in range(1, limit + 1):
        c = c - eta * df(c)
        if abs(c - YBAR) <= share * YBAR + 1e-12:
            return k
        if abs(c) > 1e6:  # разнос
            return None
    return None


rows6 = [(0.5, ["0.5", "3.5", "5.25", "6.125"], 7), (1, ["0", "7", "7", "7"], 1),
         (1.5, ["−0.5", "10.5", "5.25", "7.875"], 7), (1.9, ["−0.9", "13.3", "1.33", "12.103"], 44),
         (2, ["−1", "14", "0", "14"], None), (2.1, ["−1.1", "14.7", "−1.47", "16.317"], None)]
for eta, shown, k1 in rows6:
    path, c = [], 0.0
    for _ in range(3):
        c = c - eta * df(c)
        path.append(c)
    same_list(f"η = {eta:g}: множитель, c₁, c₂, c₃", [1 - eta, *path], shown)
    assert steps_to(eta) == k1, f"η = {eta}: шагов до 1 % — {steps_to(eta)}, на странице {k1}"
    print(f"    шагов до 1 %: {k1 if k1 else 'никогда'}")
CHECKED[0] += len(rows6)
agree("η = 0.05: шагов до 1 %", steps_to(0.05), "90")
agree("η = 0.01: шагов до 1 %", steps_to(0.01), "459")
agree("q = 0.5: ln 0.01 / ln 0.5", math.log(0.01) / math.log(0.5), "6.6")
agree("верных знаков за шаг при q = 0.5", math.log10(2), "0.3")
for nu, shown in [(0.5, "7"), (0.3, "13"), (0.1, "44"), (0.01, "459")]:
    agree(f"ν = {nu:g}: шагов до 1 % остатка, (1 − ν)^M ≤ 0.01",
          math.ceil(math.log(0.01) / math.log(1 - nu)), shown)
agree("при малых ν: M ≈ ln 100 / ν, ln 100 =", math.log(100), "4.6")
agree("тест: 2θ², a = 4 — лучший темп 1/a", 1 / 4, "0.25")
agree("тест: 2θ² — граница 2/a", 2 / 4, "0.5")

head("Шаг 7. Плоское дно, излом, две ямы")
agree("θ⁴/4: сдвиг из 0.1 при η = 0.5", 0.5 * 0.1**3, "0.0005")
t = 1.0
for _ in range(1000):
    t -= 0.5 * t**3
agree("θ⁴/4: из 1 за 1000 шагов", t, "0.0315")


def flat_steps(target: float) -> int:
    t, k = 1.0, 0
    while t > target:
        t, k = t - 0.5 * t**3, k + 1
    return k


agree("приблизиться в 10 раз стоит … больше шагов", flat_steps(0.01) / flat_steps(0.1), "100",
      tol=10)
pits = lambda t: t**4 / 4 - t**2 + 0.3 * t  # noqa: E731
dpits = lambda t: t**3 - 2 * t + 0.3  # noqa: E731
d2pits = lambda t: 3 * t**2 - 2  # noqa: E731
deep, hump, shallow = np.sort(np.roots([1, 0, -2, 0.3]).real)
agree("две ямы: глубокая, θ ≈", deep, "−1.48")
# На странице «f ≈ −1.44»; f(−1.48397) = −1.43497, до двух знаков — −1.43
agree("глубокая: f ≈", pits(deep), "−1.43")
agree("мелкая, θ ≈", shallow, "1.33")
agree("мелкая: f ≈", pits(shallow), "−0.59")
agree("горб, θ ≈", hump, "0.15")
agree("f″(−1.48) — минимум", d2pits(deep), "4.6")
agree("f″(1.33) — минимум", d2pits(shallow), "3.3")
agree("f″(0.15) — горб", d2pits(hump), "−1.9")


def descend(d1, t0: float, eta: float, steps: int = 400) -> float:
    t = t0
    for _ in range(steps):
        t -= eta * d1(t)
    return t


agree("η = 0.2, старт 0.16 → мелкая яма", descend(dpits, 0.16, 0.2), "1.332")
agree("η = 0.2, старт 0.14 → глубокая яма", descend(dpits, 0.14, 0.2), "−1.484")
agree("плоское дно, старт 2.5, η = 0.2: первый шаг", 2.5 - 0.2 * 2.5**3, "−0.625")
agree("кривизна θ⁴/4 в 2.5: 3θ²", 3 * 2.5**2, "18.75")
agree("граница 2/a", 2 / 18.75, "0.107")
t, path = 2.05, []
for _ in range(60):
    t -= 0.3 * np.sign(t)
    path.append(t)
same_list("|θ|, η = 0.3, старт 2.05: качели после 60 шагов", sorted(path[-2:], reverse=True),
          ["0.25", "−0.05"])
assert {round(v, 9) for v in path[6:]} == {0.25, -0.05}, "навсегда скачет между +0.25 и −0.05"

head("Шаг 8. Подбор темпа и остановка")
print("  сетка темпа: log-loss константы, 30 % единиц, 10 шагов из F = 0")
agree("минимум f", logloss(F_star), "0.61086")
agree("F*", F_star, "−0.847")


def ll_path(eta: float, steps: int = 10) -> list[float]:
    F, path = 0.0, []
    for _ in range(steps):
        F -= eta * (sigmoid(F) - 0.3)
        path.append(F)
    return path


for eta, shown in [(100, ["−0.104", "0.67372"]), (10, ["−0.284", "0.64638"]),
                   (1, ["−0.779", "0.61136"]), (0.1, ["−0.179", "0.66135"])]:
    F = ll_path(eta)[-1]
    same_list(f"η = {eta:g}: F после 10 шагов, f", [F, logloss(F)], shown)
same_list("η = 10: качели", ll_path(10)[:4], ["−2.0", "−0.19", "−1.71", "−0.24"])
for eta, shown in [(2, "2.9e-3"), (3, "2.8e-5"), (8, "1.4e-2")]:
    agree(f"η = {eta}: |F − F*| после 10 шагов", abs(ll_path(eta)[-1] - F_star), shown)
err5 = abs(ll_path(5)[-1] - F_star)
assert 1e-15 < err5 < 1e-12, "η = 5: ошибка порядка 1e-13 (дальше решают биты округления)"
print(f"  η = 5: |F − F*| после 10 шагов                          {err5:13.2g}   стр.: 1e-13")
CHECKED[0] += 1
agree("у дна 1/f″ = 1/(0.3·0.7)", 1 / (0.3 * 0.7), "4.8")

print("  поиск с возвратом (Армихо): f = 1.5θ², θ = 2.5")
q = lambda t: 1.5 * t**2  # noqa: E731
dq = lambda t: 3 * t  # noqa: E731
same_list("f, f′, f′²", [q(2.5), dq(2.5), dq(2.5) ** 2], ["9.375", "7.5", "56.25"])
for eta, shown, accepted in [(1, ["−5", "37.5", "−18.75"], False),
                             (0.5, ["−1.25", "2.34", "−4.69"], False),
                             (0.25, ["0.625", "0.586", "2.34"], True)]:
    t_new = 2.5 - eta * dq(2.5)
    border = q(2.5) - 0.5 * eta * dq(2.5) ** 2
    assert (q(t_new) <= border) == accepted, f"η = {eta}: решение Армихо"
    same_list(f"η = {eta:g}: θ − ηf′, f после шага, порог", [t_new, q(t_new), border], shown)
t, accepted_path = 2.5, []
for _ in range(3):
    eta = 1.0
    while q(t - eta * dq(t)) > q(t) - 0.5 * eta * dq(t) ** 2:
        eta /= 2
    t -= eta * dq(t)
    accepted_path.append(t)
same_list("дальше θ", accepted_path[1:], ["0.156", "0.039"])
agree("идеальный темп 1/a", 1 / 3, "0.333")

for K, shown in [(60, "0.043"), (200, "0.014")]:
    t = 2.05
    for k in range(K):
        t -= 0.3 / (1 + k / 10) * np.sign(t)
    agree(f"затухающий темп на |θ|: |θ| после {K} шагов", abs(t), shown)

print("  остановка по |f′| < 0.01: квартиры, η = 0.5")
agree("|f′(c₉)| = 7·0.5⁹", abs(df(7 - 7 * 0.5**9)), "0.0137")
agree("|f′(c₁₀)|", abs(df(7 - 7 * 0.5**10)), "0.0068")
c, k = 0.0, 0
while abs(df(c)) >= 0.01:
    c, k = c - 0.5 * df(c), k + 1
agree("остановка на шаге", k, "10")
agree("c₁₀", c, "6.993")
t, k_flat = 1.0, 0
while abs(t**3) >= 0.01:
    t, k_flat = t - 0.5 * t**3, k_flat + 1
agree("θ⁴/4 из 1: остановка на шаге", k_flat, "18")
agree("θ⁴/4: там θ", t, "0.211")
agree("до минимума дальше, чем у квартир, во … раз", t / (YBAR - c), "30", tol=2)
path = [0.0]
for _ in range(2):
    path.append(path[-1] - 1.9 * df(path[-1]))
same_list("η = 1.9: c качается", path, ["0", "13.3", "1.33"])
agree("η = 1.9: f − f* умножается за шаг на", (f(path[2]) - f(7)) / (f(path[1]) - f(7)), "0.81")

head("Шаг 9. Шаг Ньютона")
agree("квартиры: Δ* = −f′(0)/f″", -df(0) / 1, "7")
agree("F* = ln(0.3/0.7)", F_star, "−0.8473")
gd, nt = 0.0, 0.0
gd_path, nt_path, nt_err = [], [], []
for _ in range(3):
    gd -= sigmoid(gd) - 0.3
    p = sigmoid(nt)
    nt -= (p - 0.3) / (p * (1 - p))
    gd_path.append(gd)
    nt_path.append(nt)
    nt_err.append(abs(nt - F_star))
same_list("спуск η = 1: F₁, F₂, F₃", gd_path, ["−0.2000", "−0.3502", "−0.4635"])
same_list("Ньютон: F₁, F₂, F₃", nt_path, ["−0.8000", "−0.8469", "−0.8472978"])
same_list("ошибка Ньютона", nt_err, ["0.047", "0.00043", "0.000000037"])
F = 0.0
for k, shown in enumerate([["0", "0.5", "0.2", "0.25", "−0.8"],
                           ["−0.8", "0.3100", "0.0100", "0.2139", "−0.0469"],
                           ["−0.8469", "0.3001", "0.00009", "0.2100", "−0.00043"]]):
    p = sigmoid(F)
    delta = -(p - 0.3) / (p * (1 - p))
    same_list(f"k = {k}: F, p, f′, f″, Δ", [F, p, p - 0.3, p * (1 - p), delta], shown)
    F += delta


def steps_to_1e6(step) -> int:
    F, k = 0.0, 0
    while abs(F - F_star) >= 1e-6:
        F, k = step(F), k + 1
    return k


agree("до 1e-6: спуск η = 1, шагов", steps_to_1e6(lambda F: F - (sigmoid(F) - 0.3)), "58")
agree("до 1e-6: спуск η = 4, шагов", steps_to_1e6(lambda F: F - 4 * (sigmoid(F) - 0.3)), "7")
agree("до 1e-6: Ньютон, шагов",
      steps_to_1e6(lambda F: F - (sigmoid(F) - 0.3) / (sigmoid(F) * (1 - sigmoid(F)))), "3")
agree("идеальный темп в начале 1/0.25", 1 / 0.25, "4")
yk = np.array([1, 1, 1, 0, 0, 0, 0, 0, 0, 0])  # 3 должника из 10
g = 0.5 - yk
same_list("g для должника и для остальных", [g[0], g[-1]], ["−0.5", "0.5"])
G, H = float(g.sum()), 10 * 0.25
agree("G = Σgᵢ", G, "2")
agree("H = Σhᵢ", H, "2.5")
agree("лист Ньютона −G/H", -G / H, "−0.8")
agree("лист XGBoost −G/(H + λ), λ = 1", -G / (H + 1), "−0.571")
r_left = np.array([3, 5, 4.0]) - YBAR
same_list("левый лист пня «≤ 55»: остатки", r_left, ["−4", "−2", "−3"])
agree("G = Σ(F − y)", float(np.sum(-r_left)), "9")
agree("H (все hᵢ = 1)", len(r_left), "3")
agree("−G/H — значение листа", -float(np.sum(-r_left)) / len(r_left), "−3")
F, far = 2.0, []
for _ in range(3):
    p = sigmoid(F)
    F -= (p - 0.3) / (p * (1 - p))
    far.append(F)
same_list("Ньютон из F = 2 разлетается", far, ["−3.53", "6.30", "−376"], rounded=True)
t, flat_newton = 1.0, []
for _ in range(3):
    t -= t**3 / (3 * t**2)
    flat_newton.append(t)
same_list("Ньютон на θ⁴/4: θ × 2/3", flat_newton, ["0.667", "0.444", "0.296"])
agree("тест: 2θ² + θ из 3 → 3 − 13/4", 3 - (4 * 3 + 1) / 4, "−0.25")

# ═══════════════════════════════ Часть III ═══════════════════════════════
head("Шаг 10. Градиент, линии уровня, седло")
u = np.array([3.0, 4.0])
agree("|(3, 4)|", np.linalg.norm(u), "5")
same_list("единичный вектор", u / np.linalg.norm(u), ["0.6", "0.8"])
agree("(3, 4)·(4, −3)", u @ np.array([4.0, -3.0]), "0")
bowl = lambda t: 0.5 * (t[0] ** 2 + 10 * t[1] ** 2)  # noqa: E731
grad = lambda t: np.array([t[0], 10 * t[1]])  # noqa: E731
same_list("линия уровня f = 5: полуоси √10 и 1", [math.sqrt(10), 1.0], ["3.16", "1"])
assert abs(bowl([math.sqrt(10), 0]) - 5) < 1e-12 and abs(bowl([0, 1]) - 5) < 1e-12
pt = np.array([1.0, 1.0])
e = 1e-6
num = [(bowl(pt + e * v) - bowl(pt - e * v)) / (2 * e) for v in np.eye(2)]
assert np.allclose(num, [1, 10], atol=1e-6), "наклоны срезов (центральная разность)"
agree("срез по θ₁ в θ₁ = 1: ½θ₁² + 5", 0.5 + 5, "5.5")
same_list("∇f(1, 1)", grad(pt), ["1", "10"])
agree("|∇f(1, 1)| = √101", np.linalg.norm(grad(pt)), "10.05")
anti = -grad(pt) / np.linalg.norm(grad(pt))
along = np.array([10.0, -1.0]) / np.linalg.norm([10.0, -1.0])  # касательная к линии уровня
same_list("наклон вдоль (−1, 0), (0, −1), (1, 0)",
          [grad(pt) @ np.array(v, float) for v in [(-1, 0), (0, -1), (1, 0)]], ["−1", "−10", "+1"])
agree("наклон против градиента", grad(pt) @ anti, "−10.05")
agree("наклон вдоль линии уровня", grad(pt) @ along, "0", tol=1e-12)
same_list("тест: ∇f(2, −1)", grad([2.0, -1.0]), ["2", "−10"])
agree("тест: ∇f·(0, 1)", grad([2.0, -1.0]) @ np.array([0.0, 1.0]), "−10")
round_bowl = np.array([2.0, -1.5])
agree("круглая чаша: шаг η = 1 → |θ|", np.linalg.norm(round_bowl - 1 * round_bowl), "0")
print("  седло θ₁² − θ₂², η = 0.1, старт (1, 0.001)")
same_list("множители по θ₁ и θ₂", [1 - 0.1 * 2, 1 + 0.1 * 2], ["0.8", "1.2"])
s = np.array([1.0, 0.001])
saddle = {}
for k in range(1, 41):
    s = s - 0.1 * np.array([2 * s[0], -2 * s[1]])
    saddle[k] = (s.copy(), float(np.linalg.norm([2 * s[0], -2 * s[1]])))
for k, shown in [(10, ["0.107", "0.006", "0.215"]), (20, ["0.012", "0.038", "0.080"]),
                 (40, ["0.0001", "1.47", "2.94"])]:
    pos, gnorm = saddle[k]
    same_list(f"после {k} шагов: θ₁, θ₂, |∇f|", [*pos, gnorm], shown)

head("Шаг 11. Зигзаг в вытянутой чаше, κ = 10")
t = np.array([1.0, 1.0])
for k, shown in enumerate([["1", "1", "5.5"], ["0.85", "−0.5", "1.611"],
                           ["0.7225", "0.25", "0.574"], ["0.6141", "−0.125", "0.267"]]):
    same_list(f"η = 0.15, шаг {k}: θ₁, θ₂, f", [*t, bowl(t)], shown)
    t = t - 0.15 * grad(t)


def bowl_steps(kappa: float, eta: float, beta: float = 0.0, t0=(2.5, 1.0)) -> int | str:
    """Шагов до ‖θ‖ < 0.1 % от старта (как в ячейке «Число обусловленности и инерция»)."""
    t, v, t0 = np.array(t0), np.zeros(2), np.array(t0)
    for k in range(1, 5001):
        v = beta * v - eta * np.array([t[0], kappa * t[1]])
        t = t + v
        if np.linalg.norm(t) < 1e-3 * np.linalg.norm(t0):
            return k
        if np.linalg.norm(t) > 1e6:
            return "разнос"
    return "не сходится"


for kappa, eta_shown, n_shown in [(10, "0.182", "35"), (100, "0.0198", "346")]:
    eta = 2 / (1 + kappa)
    agree(f"κ = {kappa}: лучший постоянный η = 2/(1 + κ)", eta, eta_shown)
    q1, q2 = 1 - eta, 1 - kappa * eta
    assert abs(abs(q1) - abs(q2)) < 1e-12 and abs(q1 - (kappa - 1) / (kappa + 1)) < 1e-12
    agree(f"κ = {kappa}: шагов до 0.1 %", bowl_steps(kappa, eta), n_shown)
agree("шагов ≈ … · κ: ln(1000)/2", math.log(1000) / 2, "3.45")
for eta, beta, shown in [(0.15, 0, "43"), (0.15, 0.5, "18"), (0.2, 0.5, "20")]:
    agree(f"инерция: η = {eta}, β = {beta}, шагов", bowl_steps(10, eta, beta), shown)
assert bowl_steps(10, 0.2) == "не сходится", "η = 0.2 без инерции: по θ₂ множитель −1"
print(f"  {'инерция: η = 0.2, β = 0':<50s} {'—':>13s}   стр.: не сходится")
CHECKED[0] += 1
agree("β = 0.5: граница η < 2(1 + β)/κ", 2 * 1.5 / 10, "0.3")
assert isinstance(bowl_steps(10, 0.29, 0.5), int) and bowl_steps(10, 0.31, 0.5) == "разнос"
for kappa, shown in [(10, "15"), (100, "53")]:
    sk = math.sqrt(kappa)
    agree(f"κ = {kappa}: лучшие η и β инерции, шагов",
          bowl_steps(kappa, (2 / (1 + sk)) ** 2, ((sk - 1) / (sk + 1)) ** 2), shown)

head("Шаг 12. Прямая для квартир и масштаб признака")
same_list("xᵢ·yᵢ", x * y, ["90", "200", "200", "480", "630", "1040"])
agree("Σxᵢyᵢ", np.sum(x * y), "2640")
X = np.c_[x, np.ones(6)]
grad0 = -X.T @ y / 6
same_list("∇f(0, 0)", grad0, ["−440", "−7"])
ratio = grad0[0] / grad0[1]
assert 60 < ratio < 70, "наклон по a круче, чем по b, «в 60 с лишним раз»"
print(f"  {'наклон по a круче, чем по b, во … раз':<50s} {ratio:>13.6g}   стр.: 60 с лишним")
CHECKED[0] += 1
u = (x - 55) / 10
same_list("u = (x − 55)/10", u, ["−2.5", "−1.5", "−0.5", "0.5", "1.5", "2.5"])
agree("ū", u.mean(), "0")
agree("Σu²", np.sum(u * u), "17.5")
agree("среднее u² = 17.5/6", np.mean(u * u), "2.917")
agree("Σuy", np.sum(u * y), "33")
agree("среднее uy = 33/6", np.mean(u * y), "5.5")


def line_loss(a: float, b: float) -> float:
    return float(np.mean(0.5 * (y - a * u - b) ** 2))


def line_grad(a: float, b: float) -> np.ndarray:
    r = y - a * u - b
    return np.array([-np.mean(r * u), -np.mean(r)])


a = b = 0.0
line_path = [(a, b)]
for k, shown in enumerate([["0", "0", "30.333", "−5.5", "−7"],
                           ["2.75", "3.5", "7.862", "2.521", "−3.5"],
                           ["1.490", "5.25", "2.408", "−1.155", "−1.75"],
                           ["2.067", "6.125", "1.079", "0.530", "−0.875"]]):
    same_list(f"η = 0.5, k = {k}: a, b, ½·MSE, ∂a, ∂b", [a, b, line_loss(a, b), *line_grad(a, b)],
              shown)
    ga, gb = line_grad(a, b)
    assert abs(ga - (np.mean(u * u) * a - 5.5)) < 1e-12 and abs(gb - (b - 7)) < 1e-12
    a, b = a - 0.5 * ga, b - 0.5 * gb
    line_path.append((a, b))
a_opt = np.mean(u * y) / np.mean(u * u)
same_list("оптимум: a, b, ½·MSE", [a_opt, YBAR, line_loss(a_opt, YBAR)], ["1.886", "7", "0.648"])
agree("множитель для a: 1 − 0.5·2.917", 1 - 0.5 * np.mean(u * u), "−0.458")
agree("лучший темп для a: 1/2.917", 1 / np.mean(u * u), "0.343")
agree("наклон в площадях a/10, млн за м²", a_opt / 10, "0.1886")
agree("сдвиг 7 − a·5.5", YBAR - a_opt * 5.5, "−3.371")
assert np.allclose(np.polyfit(x, y, 1), [a_opt / 10, YBAR - a_opt * 5.5]), "как у МНК"
Hraw = np.array([[np.mean(x * x), np.mean(x)], [np.mean(x), 1.0]])
lam = np.linalg.eigvalsh(Hraw)
agree("сырые площади: ∂²f/∂a² = Σx²/6", np.mean(x * x), "3317", tol=0.5)
agree("Σx²", np.sum(x * x), "19900")
agree("смешанная производная x̄", np.mean(x), "55")
agree("главная кривизна поперёк долины", lam[1], "3318", tol=0.5)
agree("главная кривизна вдоль дна", lam[0], "0.088")
agree("κ ≈", lam[1] / lam[0], "37700", tol=50)
agree("безопасный темп 2/3318", 2 / lam[1], "0.0006")
agree("за 5000 шагов η = 0.0005 пройдено, %", 100 * (1 - (1 - 0.0005 * lam[0]) ** 5000), "20",
      tol=0.5)
a = b = 0.0
for _ in range(5000):
    r = y - (a * x + b)
    a, b = a + 5e-4 * np.mean(r * x), b + 5e-4 * np.mean(r)
agree("b после 5000 шагов", b, "−0.66")
agree("вместо", float(np.polyfit(x, y, 1)[1]), "−3.37")
kappa_raw = lam[1] / lam[0]
agree("лучший постоянный темп: шагов до 0.1 %",
      math.log(1e-3) / math.log((kappa_raw - 1) / (kappa_raw + 1)), "130000", tol=5000)
xc = x - 55
Hc = np.array([[np.mean(xc * xc), 0.0], [0.0, 1.0]])
kappa_c = np.mean(xc * xc)
agree("центрирование: κ = дисперсия площадей", kappa_c, "291.7")
assert np.allclose(np.linalg.eigvalsh(Hc), [1, kappa_c])
agree("центрирование: шагов ≈", math.log(1e-3) / math.log((kappa_c - 1) / (kappa_c + 1)), "1000",
      tol=50)
agree("стандартное отклонение площадей", x.std(), "17.08")
zs = (x - 55) / x.std()
Hs = np.array([[np.mean(zs * zs), np.mean(zs)], [np.mean(zs), 1.0]])
agree("стандартизация: κ", np.linalg.eigvalsh(Hs)[1] / np.linalg.eigvalsh(Hs)[0], "1", tol=1e-9)
a1 = 0 - 1.0 * (-np.mean(y * zs))  # шаг η = 1 из (0, 0)
b1 = 0 - 1.0 * (-np.mean(y))
assert np.allclose([a1, b1], np.linalg.lstsq(np.c_[zs, np.ones(6)], y, rcond=None)[0]), "один шаг"
X30, _ = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)
x30 = X30[:, 0]
kappas30 = []
for v in (x30, x30 - x30.mean(), (x30 - x30.mean()) / x30.std()):
    ev = np.linalg.eigvalsh(np.array([[np.mean(v * v), np.mean(v)], [np.mean(v), 1.0]]))
    kappas30.append(ev[1] / ev[0])
agree("30 точек: κ как есть", kappas30[0], "150", tol=0.5)
agree("30 точек: κ после центрирования", kappas30[1], "7.4")
agree("30 точек: κ после стандартизации", kappas30[2], "1", tol=1e-9)

head("Шаг 13. Стохастический шаг по одной квартире")
agree("полный шаг из 0, η = 0.5", 0 + 0.5 * (YBAR - 0), "3.5")
same_list("шаг по одной квартире: 0.5·yᵢ", 0.5 * y, ["1.5", "2.5", "2", "4", "4.5", "6.5"])
agree("их среднее", np.mean(0.5 * y), "3.5")
same_list("из c = 7 шаг по одной квартире", 7 + 0.5 * (y - 7), ["5", "6", "5.5", "7.5", "8", "10"])
rng = Mulberry32(1)
picked = [float(y[rng.sample(6, 1)[0]]) for _ in range(6)]
same_list("Mulberry32(1) выбрал цены", picked, ["8", "3", "8", "13", "13", "5"])
c, sgd_const = 0.0, []
for price in picked:
    c += 0.5 * (price - c)
    sgd_const.append(c)
same_list("η = 0.5: c", sgd_const, ["4", "3.5", "5.75", "9.375", "11.19", "8.09"])
c, sgd_decay = 0.0, []
for k, price in enumerate(picked):
    c += (price - c) / (k + 1)
    sgd_decay.append(c)
same_list("η_k = 1/(k + 1): c", sgd_decay, ["8", "5.5", "6.33", "8", "9", "8.33"])
assert np.allclose(sgd_decay, np.cumsum(picked) / np.arange(1, 7)), "в точности бегущее среднее"
agree("эпоха при n = 30, B = 1: шагов", 30 // 1, "30")

# ═══════════════════════════════ Часть IV ═══════════════════════════════
head("Шаг 14. Спуск по прогнозам: свободно и через пни (ν = 0.5)")
NU = 0.5
r = y - YBAR
same_list("антиградиент r = y − 7", r, ["−4", "−2", "−3", "+1", "+2", "+6"])
agree("‖r‖² = r·r", r @ r, "70")
same_list("свободный шаг: прогнозы", YBAR + NU * r, ["5", "6", "5.5", "7.5", "8", "10"])
agree("свободный шаг: сумма квадратов 70·0.25", np.sum((r - NU * r) ** 2), "17.5")


def stump_on(res: np.ndarray, t: float) -> tuple[np.ndarray, float, float]:
    """Пень «площадь ≤ t» на остатках res: значения h на квартирах и листья (слева, справа)."""
    left, right = float(res[x <= t].mean()), float(res[x > t].mean())
    return np.where(x <= t, left, right), left, right


def best_stump(res: np.ndarray) -> tuple[float, np.ndarray, float, float]:
    """Перебор порогов-середин: пень с наименьшей Σ(rᵢ − hᵢ)²."""
    t_best = min((x[:-1] + x[1:]) / 2, key=lambda t: np.sum((res - stump_on(res, t)[0]) ** 2))
    return (float(t_best), *stump_on(res, t_best))


t1, h, _, right = best_stump(r)
agree("лучший порог", t1, "55")
same_list("h", h, ["−3", "−3", "−3", "+3", "+3", "+3"])
agree("сумма квадратов после шага пнём", np.sum((r - NU * h) ** 2), "29.5")
agree("квартира 65 м²: 7 + 0.5·3", YBAR + NU * right, "8.5")
same_list("слагаемые h·r", h * r, ["12", "6", "9", "3", "6", "18"])
agree("h·r", h @ r, "54")
agree("cos(h, r)", (h @ r) / np.linalg.norm(h) / np.linalg.norm(r), "0.88")
agree("‖h‖² = h·r (листья — средние)", h @ h, "54")
agree("‖r‖² − (2ν − ν²)·h·r", r @ r - (2 * NU - NU**2) * (h @ r), "29.5")
agree("ρ* = h·r/‖h‖²", (h @ r) / (h @ h), "1")
for nu_try in (0.1, 1.0, 1.9):
    assert np.sum((r - nu_try * h) ** 2) < r @ r, "падает при любом 0 < ν < 2"
assert abs(np.sum((r - 2 * h) ** 2) - r @ r) < 1e-9, "при ν = 2 — та же сумма"
print("  рельеф по порогу t (шаг пнём с ν = 1)")
for (lo_t, hi_t), shown in zip([(30, 40), (40, 50), (50, 60), (60, 70), (70, 80)],
                               ["50.8", "43.0", "16.0", "22.0", "26.8"]):
    sses = {round(float(np.sum((r - stump_on(r, t)[0]) ** 2)), 9) for t in
            np.linspace(lo_t, hi_t, 21)[:-1]}
    assert len(sses) == 1, "внутри интервала сумма квадратов не меняется: наклон по t — ноль"
    agree(f"t ∈ [{lo_t}, {hi_t})", sses.pop(), shown)
agree("без разбиения", r @ r, "70")
print("  три раунда: свободный спуск против пней; квартиры 80 м² (y = 13) и 65 м² (новая)")
table14 = [["70", "7", "7", "70", "7", "7", "55", "0.878"],
           ["17.5", "10", "7", "29.5", "8.5", "8.5", "75", "0.908"],
           ["4.375", "11.5", "7", "11.275", "10.75", "8.05", "65", "0.825"],
           ["1.094", "12.25", "7", "5.515", "11.55", "7.65", "35", "0.770"]]
F_free, F_boost, F65 = np.full(6, YBAR), np.full(6, YBAR), YBAR
rounds = []
for k, shown in enumerate(table14):
    res = y - F_boost
    t_k, h_k, left_k, right_k = best_stump(res)
    cos_k = (h_k @ res) / np.linalg.norm(h_k) / np.linalg.norm(res)
    assert abs(h_k @ h_k - h_k @ res) < 1e-9 and abs((h_k @ res) / (h_k @ h_k) - 1) < 1e-9
    assert abs(np.sum((res - NU * h_k) ** 2) - (res @ res - (2 * NU - NU**2) * (h_k @ res))) < 1e-9
    row = [np.sum((y - F_free) ** 2), F_free[-1], YBAR, res @ res, F_boost[-1], F65, t_k, cos_k]
    same_list(f"шаг {k}", row, shown)
    rounds.append(row)
    F_free = F_free + NU * (y - F_free)
    F65 += NU * (left_k if 65 <= t_k else right_k)  # новая квартира идёт в свой лист
    F_boost = F_boost + NU * h_k

print(f"\nСверено чисел со страницей: {CHECKED[0]} — все совпадают.")

# ═══════════════════════════════ Сводный рисунок ═══════════════════════════════
fig, axes = plt.subplots(2, 2, figsize=(11, 7.6))
ax = axes[0, 0]
for eta, color in ((0.5, style.BLUE), (1.5, style.AQUA), (2.1, style.ORANGE)):
    path = [0.0]
    for _ in range(7):
        path.append(path[-1] - eta * df(path[-1]))
    mult = f"{1 - eta:+.1f}".replace("-", "−")
    ax.plot(range(8), path, color=color, marker="o", ms=5, mec=style.SURFACE,
            label=f"η = {eta:g}: множитель {mult}")
ax.axhline(YBAR, color=style.MUTED, lw=1.2, ls=(0, (4, 3)), label="минимум ȳ = 7")
ax.set(xlabel="шаг k", ylabel="cₖ, млн", title="Шаг 6. Квартиры: всё решает 1 − η", ylim=(-7, 23))
ax.legend(fontsize=8, loc="upper left")

ax = axes[0, 1]
M = np.arange(0, 61)
for nu, color in ((0.5, style.BLUE), (0.3, style.AQUA), (0.1, style.ORANGE)):
    m1 = math.ceil(math.log(0.01) / math.log(1 - nu))
    ax.semilogy(M, (1 - nu) ** M, color=color, label=f"ν = {nu:g}: {m1} шагов, ν·M = {nu * m1:.1f}")
    ax.plot([m1], [(1 - nu) ** m1], "o", color=color, ms=7, mec=style.SURFACE)
ax.axhline(0.01, color=style.MUTED, lw=1.2, ls=(0, (4, 3)), label="1 % остатка")
ax.set(xlabel="число шагов M", ylabel="доля остатка (1 − ν)ᴹ", title="Шаг 6. Прогресс решает ν·M",
       ylim=(1e-4, 1.5))
ax.legend(fontsize=8, loc="upper right")

ax = axes[1, 0]
ga_, gb_ = np.meshgrid(np.linspace(-0.3, 3.4, 160), np.linspace(-0.7, 8.4, 200))
levels = np.mean(0.5 * (y[None, None, :] - ga_[..., None] * u - gb_[..., None]) ** 2, axis=-1)
ax.contour(ga_, gb_, levels, levels=[0.8, 1.5, 3, 6, 12, 20, 30], colors=style.AXIS, linewidths=0.8)
lp = np.array(line_path)
ax.plot(lp[:, 0], lp[:, 1], color=style.BLUE, marker="o", ms=5, mec=style.SURFACE,
        label="спуск η = 0.5, 4 шага")
ax.plot([a_opt], [YBAR], "o", color=style.INK, ms=8, mec=style.SURFACE, label="минимум (1.886, 7)")
ax.set(xlabel="наклон a (по u = (x − 55)/10)", ylabel="сдвиг b",
       title="Шаг 12. Прямая по u: a качается")
ax.legend(fontsize=8, loc="lower right")

ax = axes[1, 1]
ks = np.arange(4)
ax.plot(ks, [row[0] for row in rounds], color=style.ORANGE, marker="s", ms=6, mec=style.SURFACE,
        label="свободно: 65 м² навсегда 7")
ax.plot(ks, [row[3] for row in rounds], color=style.BLUE, marker="o", ms=6, mec=style.SURFACE,
        label="через пни: подписи — прогноз 65 м²")
for k, row in enumerate(rounds[1:], start=1):
    ax.annotate(f"{row[5]:.2f}".rstrip("0").rstrip("."), (k, row[3]), xytext=(6, 8),
                textcoords="offset points", fontsize=9, color=style.INK_2)
ax.set(xlabel="шаг", ylabel="сумма квадратов остатков на обучении",
       title="Шаг 14. Запомнить или обобщить", xticks=ks, xlim=(-0.2, 3.4), ylim=(0, 80))
ax.legend(fontsize=8, loc="upper right")
fig.tight_layout()
ex.finish(fig, "ladder_by_hand")
