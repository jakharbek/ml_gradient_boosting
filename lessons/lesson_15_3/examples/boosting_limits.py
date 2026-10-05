"""Пределы в бустинге: остаток — геометрическая прогрессия, потери на обучении сходятся.

Для одного объекта Fₘ = Fₘ₋₁ + ν(y − Fₘ₋₁): остаток умножается на (1 − ν) и стремится к нулю.
В настоящем бустинге потери на обучении после каждого дерева не растут и не бывают меньше нуля —
монотонная ограниченная последовательность, у неё есть предел (теорема Вейерштрасса). Потери на
проверке не монотонны: у них есть минимум, после которого модель подгоняется под шум.

Запуск:  python lessons/lesson_15_3/examples/boosting_limits.py [--save] [--no-show]
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GradientBoosting, datasets
from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, ORANGE

ex = Example(__file__)

# 1. Один объект: остаток (1 − ν)ᵐ·y
y = 10.0
fig, (a1, a2) = plt.subplots(1, 2, figsize=(13, 4))
for nu, col in [(0.05, AQUA), (0.1, BLUE), (0.3, ORANGE)]:
    m_need = math.ceil(math.log(0.01) / math.log(1 - nu))
    F = 10 * (1 - (1 - nu) ** np.arange(0, 61))
    print(f"ν = {nu}: остаток < 1% после {m_need} шагов; F₁₀ = {F[10]:.4f}")
    assert (1 - nu) ** m_need < 0.01 <= (1 - nu) ** (m_need - 1)
    a1.plot(F, "o-", ms=3, lw=1, color=col, label=f"ν = {nu}")
a1.axhline(y, color="gray", ls="--")
a1.set(xlabel="шаг m", ylabel="прогноз Fₘ", title="Один объект: Fₘ → y = 10")
a1.legend()

# 2. Настоящий бустинг
X, yy = datasets.regression_1d(kind="sine", n=200, noise=0.3, seed=42)
Xtr, Xva, ytr, yva = datasets.train_test_split(X, yy, test_size=0.3, seed=0)
for nu, col in [(0.1, BLUE), (0.3, ORANGE)]:
    m = GradientBoosting(n_estimators=400, learning_rate=nu, max_depth=2).fit(Xtr, ytr, eval_set=(Xva, yva))
    tr, va = np.array(m.history_["train"]), np.array(m.history_["eval"])
    d = np.diff(tr)
    best = int(va.argmin())
    print(f"ν = {nu}: потери на обучении {tr[0]:.4f} → {tr[-1]:.5f}, Δ от деревьев 1, 10, 100, 400: "
          f"{d[0]:.2e}, {d[9]:.2e}, {d[99]:.2e}, {d[-1]:.2e}; проверка: минимум при M = {best}")
    assert np.all(d <= 1e-12) and tr.min() >= 0            # монотонна и ограничена снизу ⇒ сходится
    assert abs(d[-1]) < abs(d[0]) / 100                      # шаги затухают
    assert va[-1] > va[best]                                 # проверка не монотонна
    a2.semilogx(np.arange(1, 401), tr[1:], color=col, lw=1.6, ls="--", label=f"ν = {nu}: обучение")
    a2.semilogx(np.arange(1, 401), va[1:], color=col, lw=2.2, label=f"ν = {nu}: проверка")
    a2.axvline(best, color=col, ls=":", lw=1)
a2.set(xlabel="деревьев M (лог.)", ylabel="потери", title="Обучение сходится, у проверки — минимум")
a2.legend()
plt.tight_layout()
ex.finish(fig, "boosting_limits")
