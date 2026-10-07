"""Шаг-дерево как направление спуска: шесть квартир, свободный шаг и пни.

Запуск:  python lessons/lesson_1_3/examples/tree_step.py [--save] [--no-show]

Шаг 12 урока. В F₀ = 7 антиградиент ½·суммы квадратов — вектор остатков r. Свободный шаг F + ν·r
двигает каждый прогноз отдельно и ничего не говорит о новых квартирах. Пень приближает r ступенькой:
шаг хуже на обучении, но определён для любой площади. Пока h·r > 0, шаг-дерево — направление спуска,
и лучший пень — тот, что сильнее всего «согласен» с антиградиентом.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import style
from gbcourse.cli import Example

ex = Example(__file__)

x = np.array([30, 40, 50, 60, 70, 80.0])  # площади, м²
y = np.array([3, 5, 4, 8, 9, 13.0])  # цены, млн
NU = 0.5
F0 = np.full(6, y.mean())
r = y - F0  # антиградиент ½·Σ(y − F)²


def stump(t: float) -> np.ndarray:
    """Пень с порогом t, обученный на остатках: среднее остатков слева и справа."""
    return np.where(x <= t, r[x <= t].mean(), r[x > t].mean())


print(f"антиградиент r = {r}, ‖r‖² = {r @ r:.0f}")
print(f"свободный шаг ν = {NU}: сумма квадратов {np.sum((r - NU * r) ** 2):.1f}, квартира 65 м² → {y.mean():.1f}")
print(f"{'порог':>6s} {'h·r':>6s} {'cos(h, r)':>10s} {'сумма квадратов после шага':>27s}")
rows = []
for t in (x[:-1] + x[1:]) / 2:
    h = stump(t)
    sse = np.sum((r - NU * h) ** 2)
    rows.append((t, h @ r, sse))
    print(f"{t:6.0f} {h @ r:6.1f} {h @ r / np.linalg.norm(h) / np.linalg.norm(r):10.3f} {sse:27.2f}")

best_t, best_dot, best_sse = max(rows, key=lambda row: row[1])
h = stump(best_t)
print(f"лучший пень: порог {best_t:.0f}, h = {h}; квартира 65 м² → {7 + NU * h[x > best_t][0]:.1f}")

assert all(dot > 0 for _, dot, _ in rows), "любой пень на остатках — направление спуска"
assert best_t == 55 and best_dot == 54 and best_sse == 29.5, "числа шага 12 урока"
assert min(rows, key=lambda row: row[2])[0] == best_t, "больше h·r — больше выигрыш шага"
assert abs(np.sum((r - NU * r) ** 2) - 17.5) < 1e-12, "свободный шаг: 70·(1 − ν)²"

fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
axes[0].bar(x - 2.2, r, width=4, color=style.MUTED, label="антиградиент r (остатки)")
axes[0].bar(x + 2.2, h, width=4, color=style.ORANGE, label=f"шаг-пень h, порог {best_t:.0f}")
axes[0].axhline(0, color=style.INK, lw=0.8)
axes[0].set(xlabel="площадь, м²", ylabel="поправка, млн", title="Пень огрубляет антиградиент до ступеньки")
axes[0].legend(fontsize=8)
ts = [row[0] for row in rows]
axes[1].plot(ts, [row[1] for row in rows], marker="o", color=style.BLUE, label="h·r — согласие с антиградиентом")
axes[1].plot(ts, [row[2] for row in rows], marker="s", color=style.ORANGE, label="сумма квадратов после шага")
axes[1].axhline(17.5, color=style.MUTED, ls=(0, (4, 3)), label="свободный шаг: 17.5")
axes[1].set(xlabel="порог пня", ylabel="млн²", title="Чем ближе к антиградиенту, тем больше выигрыш")
axes[1].legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "tree_step")
