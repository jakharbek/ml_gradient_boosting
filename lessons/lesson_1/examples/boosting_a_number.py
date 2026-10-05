"""Бустинг одного числа: как остаток убывает в (1 − ν) раз за шаг.

Запуск:  python lessons/lesson_1/examples/boosting_a_number.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example

ex = Example(__file__)

TARGET = 10.0
STEPS = 25

fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
for nu in (0.1, 0.3, 0.7, 1.5):
    F = [0.0]
    for _ in range(STEPS):
        F.append(F[-1] + nu * (TARGET - F[-1]))
    F = np.array(F)
    axes[0].plot(F, marker="o", ms=3, label=f"ν = {nu}")
    axes[1].semilogy(np.abs(TARGET - F) + 1e-16, label=f"ν = {nu}")
    print(f"ν = {nu}: после {STEPS} шагов F = {F[-1]:.6f}, остаток = {TARGET - F[-1]:+.2e}")

axes[0].axhline(TARGET, color="#898781", lw=1, ls=(0, (5, 4)))
axes[0].set(title="Прогноз приближается к цели", xlabel="шаг m", ylabel="F_m")
axes[1].set(title="|остаток| = |1 − ν|^m · 10 (лог. шкала)", xlabel="шаг m", ylabel="|y − F_m|")
axes[0].legend()
fig.tight_layout()
ex.finish(fig, "boosting_a_number")
