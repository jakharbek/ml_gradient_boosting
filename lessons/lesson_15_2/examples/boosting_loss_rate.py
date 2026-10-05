"""Скорость падения потерь бустинга по числу деревьев и ранняя остановка.

Конечные разности кривой обучения показывают, сколько приносит каждое новое дерево: на обучении
польза быстро падает, а на проверке скорость в какой-то момент становится нулевой и положительной.

Запуск:  python lessons/lesson_15_2/examples/boosting_loss_rate.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GradientBoosting, datasets
from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE

ex = Example(__file__)

X, y = datasets.regression_1d(kind="sine", n=200, noise=0.3, seed=42)
Xtr, Xva, ytr, yva = datasets.train_test_split(X, y, test_size=0.3, seed=0)

fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4))
best = {}
for nu, col in [(0.1, BLUE), (0.3, ORANGE), (1.0, AQUA)]:
    m = GradientBoosting(n_estimators=200, learning_rate=nu, max_depth=2).fit(Xtr, ytr, eval_set=(Xva, yva))
    tr, va = np.array(m.history_["train"]), np.array(m.history_["eval"])
    d = np.diff(tr)
    best[nu] = int(va.argmin())
    print(f"ν = {nu}: Δ потерь от деревьев 1, 10, 100 = {d[0]:.4f}, {d[9]:.5f}, {d[99]:.6f};  лучшее M = {best[nu]} ({va.min():.4f})")
    assert np.all(d <= 1e-12)          # потери на обучении не растут
    assert abs(d[0]) > 100 * abs(d[99]) if nu < 1 else True
    a1.plot(tr, color=col, lw=1.4, ls="--")
    a1.plot(va, color=col, lw=2.2, label=f"ν = {nu}: проверка (пунктир — обучение)")
    a1.axvline(best[nu], color=col, ls=":", lw=1)
    a2.plot(np.arange(1, 201), np.convolve(np.diff(va), np.ones(10) / 10, "same"), color=col, lw=2, label=f"ν = {nu}")
assert best[0.1] > best[0.3] > best[1.0]
a1.set(xlabel="деревьев M", ylabel="потери ½·MSE", title="Кривые обучения; вертикали — лучшее M")
a1.legend(fontsize=8)
a2.axhline(0, color=MUTED, lw=1)
a2.set(ylim=(-0.004, 0.002), xlabel="номер дерева", ylabel="Δ потерь на проверке (среднее по 10)",
       title="Скорость падения потерь: ≥ 0 — пора останавливаться")
a2.legend(fontsize=8)
ex.finish(fig, "boosting_loss_rate")
