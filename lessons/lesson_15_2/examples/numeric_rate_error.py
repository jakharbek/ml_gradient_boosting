"""Численная скорость: ошибка метода против ошибки округления (V-образная кривая).

Правая разность (f(x + h) − f(x)) / h ошибается на ~h, центральная — на ~h², но при слишком
маленьком h вычитание почти равных чисел оставляет лишь «шум» последних цифр, а деление на h
раздувает его как ε / h. Поэтому лучшее h ≈ 1e−8 для правой и ≈ 1e−5 для центральной разности.

Запуск:  python lessons/lesson_15_2/examples/numeric_rate_error.py [--save] [--no-show]
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED

ex = Example(__file__)

CASES = {
    "поездка s(t) в t = 2": (lambda t: 3 * t * t - t * t * t / 5, 2.0, 9.6),
    "sin x в x = 1": (math.sin, 1.0, math.cos(1.0)),
    "eˣ в x = 0": (math.exp, 0.0, 1.0),
}
hs = 10.0 ** -np.arange(1, 17)
fig, axs = plt.subplots(1, 3, figsize=(13, 3.8), sharey=True)
for ax, (name, (f, x, exact)) in zip(axs, CASES.items()):
    ef = np.array([abs((f(x + h) - f(x)) / h - exact) for h in hs])
    ec = np.array([abs((f(x + h) - f(x - h)) / (2 * h) - exact) for h in hs])
    kf, kc = int(np.argmin(ef)) + 1, int(np.argmin(ec)) + 1
    print(f"{name:22} лучшая правая h = 1e-{kf} (ошибка {ef.min():.1e}),  лучшая центральная h = 1e-{kc} (ошибка {ec.min():.1e})")
    print(f"{'':22} при h = 1e-16: правая разность = {(f(x + 1e-16) - f(x)) / 1e-16}")
    assert 6 <= kf <= 9 and 4 <= kc <= 6
    assert ec.min() < ef.min()
    ax.loglog(hs, np.maximum(ef, 1e-17), "o-", color=AQUA, ms=4, label="справа")
    ax.loglog(hs, np.maximum(ec, 1e-17), "o-", color=BLUE, ms=4, label="по центру")
    for xv in (1e-8, 1e-5):
        ax.axvline(xv, color=MUTED, ls=":", lw=1)
    ax.set(title=name, xlabel="h")
axs[0].set_ylabel("ошибка |численная − точная|")
axs[0].legend()
fig.suptitle("Слишком маленькое h так же плохо, как слишком большое")
ex.finish(fig, "numeric_rate_error")
