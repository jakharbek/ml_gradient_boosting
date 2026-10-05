"""Бустинг с маленьким шагом — сумма Римана градиентного потока: важно «время» ν·M.

Запуск:  python lessons/lesson_15_9/examples/boosting_as_integration.py [--save] [--no-show]

1) Бустинг одного числа: остаток (1 − ν)^(t/ν) → e^(−t) при ν → 0.
2) Градиентный бустинг (gbcourse, деревья глубины 2) на 120 точках: потери на обучении как функция t = ν·m
   для ν = 1 … 0.02 — при малых ν кривые сливаются в одну.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import math

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.boosting import GBRegressor
from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, ORANGE, RED, VIOLET

ex = Example(__file__)

# 1. Одно число
for nu in (1, 0.5, 0.1, 0.01, 0.001):
    print(f"1) ν = {nu:<6}: остаток при t = 3: {(1 - nu) ** round(3 / nu):.5f}")
print(f"   e^(−3) = {math.exp(-3):.5f}")
assert abs((1 - 0.001) ** 3000 - math.exp(-3)) < 1e-3

# 2. Настоящий бустинг
X, y = datasets.regression_1d(kind="wave", n=120, noise=0.3, seed=7)
NUS = (1, 0.5, 0.2, 0.1, 0.05, 0.02)
hist = {}
for nu in NUS:
    M = round(8 / nu)
    hist[nu] = np.array(GBRegressor(n_estimators=M, learning_rate=nu, max_depth=2).fit(X, y).history_["train"])
    h = hist[nu]
    print(f"2) ν = {nu:<4}: потери при t = 1, 2, 4, 8: {h[round(1 / nu)]:.4f}, {h[round(2 / nu)]:.4f}, {h[round(4 / nu)]:.4f}, {h[-1]:.4f}")
at4 = {nu: hist[nu][round(4 / nu)] for nu in NUS}
assert abs(at4[0.05] - at4[0.02]) < abs(at4[0.2] - at4[0.1])   # чем меньше шаг, тем ближе соседние кривые
assert abs(at4[0.05] - at4[0.02]) < 0.001

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
t = np.linspace(0, 4, 300)
a1.plot(t, np.exp(-t), "k--", lw=2.4, label="e^(−t) — поток")
for nu, c in zip((1, 0.5, 0.2, 0.05), (RED, ORANGE, VIOLET, BLUE)):
    m = np.arange(round(4 / nu) + 1)
    a1.step(m * nu, (1 - nu) ** m, where="post", color=c, label=f"ν = {nu}")
a1.set(title="Бустинг одного числа", xlabel="время t = ν·m", ylabel="остаток")
a1.legend()
for nu, c in zip(NUS, (RED, ORANGE, VIOLET, AQUA, BLUE, "black")):
    a2.plot(np.arange(len(hist[nu])) * nu, hist[nu], color=c, lw=1.8, label=f"ν = {nu}")
a2.set(title="Градиентный бустинг: потери на обучении", xlabel="время t = ν·m", ylabel="½·MSE", xlim=(0, 8))
a2.legend()
ex.finish(fig, "boosting_as_integration")
