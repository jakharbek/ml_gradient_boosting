"""Решения упражнений урока 15.2.

Запуск:  python lessons/lesson_15_2/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GradientBoosting, datasets

s = lambda t: 3 * t**2 - t**3 / 5  # noqa: E731

# 1
rate = (108 - 120) / 4
print(f"1) средняя скорость {rate} ₽ в день, относительно {100 * (108 - 120) / 120:.0f}%: минус — цена в среднем падала")
assert rate == -3

# 2
up, down = (100 - 80) / 80, (80 - 100) / 100
print(f"2а) рост {100 * up:.0f}%, падение {100 * down:.0f}%: проценты считаются от разных «было» (80 и 100)")
print(f"2б) 82% → 86%: +4 п.п., относительно +{100 * 4 / 82:.2f}%")
assert (up, down) == (0.25, -0.2)

# 3
losses = np.array([0.80, 0.50, 0.35, 0.28, 0.25])
d = np.diff(losses)
print("3) разности:", np.round(d, 2), " сумма:", round(d.sum(), 2), "= 0.25 − 0.80; польза каждого дерева падает")
assert abs(d.sum() - (losses[-1] - losses[0])) < 1e-12

# 4
f = lambda x: x**2  # noqa: E731
h = 0.001
avg = (f(3 + h) - f(3)) / h
print(f"4) ((3 + h)² − 9)/h = 6 + h; при h = 0.001: {avg:.6f}; мгновенная скорость 6")
assert abs(avg - (6 + h)) < 1e-9

# 5
time = 10 / 20 + 10 / 30 + 0.5
dist = 10 + 10 + 16 * 0.5
print(f"5) путь {dist} км за {time:.4f} ч → {dist / time:.2f} км/ч; среднее арифметическое {(20 + 30 + 16) / 3:.2f}")
assert abs(dist / time - 21) < 1e-12

# 6
# s(5 + h) − s(5) = 15h + 0·h² − 0.2h³  ⇒  Δs/h = 15 − 0.2h²
for h in (0.1, 0.01):
    avg = (s(5 + h) - s(5)) / h
    print(f"6) h = {h}: Δs/h = {avg:.6f}, формула 15 − 0.2h² = {15 - 0.2 * h * h:.6f}")
    assert abs(avg - (15 - 0.2 * h * h)) < 1e-9
print("   мгновенная скорость 15 м/с; слагаемого с h нет: в момент 5 с скорость максимальна и на миг не меняется")

# 7
errs = {}
for h in (0.1, 0.01):
    right = (s(2 + h) - s(2)) / h
    left = (s(2) - s(2 - h)) / h
    center = (s(2 + h) - s(2 - h)) / (2 * h)
    errs[h] = [abs(x - 9.6) for x in (right, left, center)]
    print(f"7) h = {h}: справа {right:.5f}, слева {left:.5f}, по центру {center:.6f}")
ratios = [errs[0.1][i] / errs[0.01][i] for i in range(3)]
print("   ошибки уменьшились в", [round(r, 1) for r in ratios], "раз: справа и слева ~ в 10 (ошибка ~h), по центру в 100 (~h²)")
print("   справа больше: машина разгоняется, и после момента 2 с едет быстрее, чем до него")
assert 9 < ratios[0] < 11 and 99 < ratios[2] < 101

# 8
y = lambda t: 20 * t - 5 * t**2  # noqa: E731
print(f"8) [0, 1]: {(y(1) - y(0)) / 1} м/с;  [1, 3]: {(y(3) - y(1)) / 2} м/с — вернулся на ту же высоту")
# (y(t + h) − y(t))/h = 20 − 10t − 5h → 20 − 10t
for t in (1, 2, 3):
    print(f"   v({t}) ≈ {(y(t + 1e-6) - y(t - 1e-6)) / 2e-6:.4f} м/с (формула 20 − 10t = {20 - 10 * t})")
print("   верхняя точка: 20 − 10t = 0 → t = 2 с, высота", y(2), "м; в 3 с скорость −10: мяч падает")

# 9
g = lambda x: 1 / x**2  # noqa: E731
# (1/(1 + h)² − 1)/h = −(2 + h)/(1 + h)² → −2
num = (g(1 + 1e-5) - g(1 - 1e-5)) / 2e-5
print(f"9а) −(2 + h)/(1 + h)² → −2; центральная разность {num:.6f}")
assert abs(num + 2) < 1e-6
# (√(9 + h) − 3)/h = 1/(√(9 + h) + 3) → 1/6
num = (math.sqrt(9 + 1e-5) - math.sqrt(9 - 1e-5)) / 2e-5
print(f"9б) 1/(√(9 + h) + 3) → 1/6 = {1 / 6:.6f}; центральная разность {num:.6f}")
assert abs(num - 1 / 6) < 1e-8

# 10
ks = np.arange(1, 17)
ef = [abs((math.sin(1 + 10.0**-k) - math.sin(1)) / 10.0**-k - math.cos(1)) for k in ks]
ec = [abs((math.sin(1 + 10.0**-k) - math.sin(1 - 10.0**-k)) / (2 * 10.0**-k) - math.cos(1)) for k in ks]
kf, kc = ks[int(np.argmin(ef))], ks[int(np.argmin(ec))]
print(f"10) лучшая правая: h = 1e-{kf} (ошибка {min(ef):.1e}); лучшая центральная: h = 1e-{kc} (ошибка {min(ec):.1e})")
print("    крупное h — ошибка метода (~h или ~h²), мелкое — округление (~ε/h, ε ≈ 2.2e-16): минимум посередине")
assert 7 <= kf <= 9 and 4 <= kc <= 6

# 11
X, yy = datasets.regression_1d(kind="sine", n=200, noise=0.3, seed=42)
Xtr, Xva, ytr, yva = datasets.train_test_split(X, yy, test_size=0.3, seed=0)
m = GradientBoosting(n_estimators=200, learning_rate=0.3, max_depth=2).fit(Xtr, ytr, eval_set=(Xva, yva))
va = np.array(m.history_["eval"])
dva = np.diff(va)  # dva[i] — изменение от дерева i + 1
stop = next(M for M in range(10, 201) if dva[M - 10:M].mean() >= 0)
best = int(va.argmin())
print(f"11) правило «средняя разность за 10 деревьев ≥ 0» останавливает на M = {stop}; лучшее M = {best}")
print("    скорость становится ≥ 0 только после минимума: сначала потери должны начать расти, а среднее")
print("    по 10 деревьям ещё и запаздывает. Поэтому библиотеки запоминают лучшее M и откатываются к нему.")
assert best < stop
