"""Бустинг вручную на шести квартирах: остатки → пень → обновление, дерево за деревом.

Запуск:  python lessons/lesson_1/examples/boosting_by_hand.py [--save] [--no-show]

Повторяет расчёт шага 4 урока: F₀ = среднее = 7, первый пень «площадь ≤ 55?» (−3 / +3),
второй «площадь ≤ 75?» (−0.9 / +4.5) и так далее. Печатает таблицу для каждого дерева,
сверяет результат с scikit-learn и рисует модель после 0, 1, 2 и 6 пней.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor

from gbcourse import style
from gbcourse.cli import Example

ex = Example(__file__)

x = np.array([30, 40, 50, 60, 70, 80.0])  # площадь, м²
y = np.array([3, 5, 4, 8, 9, 13.0])  # цена, млн
NU = 0.5
M = 6


def best_stump(r: np.ndarray) -> tuple[float, float, float, float]:
    """Перебор порогов между соседними площадями: (ошибка пня, порог, слева, справа)."""
    best = None
    for t in (x[:-1] + x[1:]) / 2:
        left, right = r[x <= t].mean(), r[x > t].mean()
        sse = float(((r - np.where(x <= t, left, right)) ** 2).sum())
        if best is None or sse < best[0] - 1e-12:
            best = (sse, float(t), float(left), float(right))
    return best


F = np.full_like(y, y.mean())
history = [F.copy()]
stumps = []
print(f"F₀ = среднее цен = {y.mean():.0f} млн; сумма квадратов остатков = {((y - F) ** 2).sum():.4f}\n")
for m in range(1, M + 1):
    r = y - F
    sse, t, left, right = best_stump(r)
    h = np.where(x <= t, left, right)
    F = F + NU * h
    history.append(F.copy())
    stumps.append((t, left, right))
    print(f"Дерево {m}: вопрос «площадь ≤ {t:.0f}?», слева {left:+.3f}, справа {right:+.3f}")
    print("  №  площадь  цена   остаток    h(x)     новый F")
    for i in range(len(x)):
        print(f"  {i + 1}  {x[i]:7.0f} {y[i]:5.0f}  {r[i]:+8.3f} {h[i]:+8.3f}  {F[i]:9.4f}")
    print(f"  сумма квадратов остатков: {((y - F) ** 2).sum():.4f}\n")

sse_path = [float(((y - Fm) ** 2).sum()) for Fm in history]
assert abs(sse_path[0] - 70) < 1e-12 and abs(sse_path[1] - 29.5) < 1e-12 and abs(sse_path[2] - 11.275) < 1e-12
assert stumps[0] == (55.0, -3.0, 3.0) and stumps[1][0] == 75.0

sk = GradientBoostingRegressor(n_estimators=M, learning_rate=NU, max_depth=1).fit(x[:, None], y)
diff = np.abs(sk.predict(x[:, None]) - F).max()
print(f"Сверка с scikit-learn (6 пней, ν = {NU}): максимальное расхождение {diff:.1e}")
assert diff < 1e-12

xs = np.linspace(25, 85, 601)


def curve(m: int) -> np.ndarray:
    out = np.full_like(xs, y.mean())
    for t, left, right in stumps[:m]:
        out += NU * np.where(xs <= t, left, right)
    return out


fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
for m, color in zip([0, 1, 2, 6], [style.ROLE["model_prev"], style.BLUE_RAMP[6], style.BLUE_RAMP[9], style.BLUE]):
    axes[0].plot(xs, curve(m), color=color, lw=2, label=f"$F_{m}$")
axes[0].vlines(x, history[-1], y, colors=style.ROLE["residual"], lw=1.2)
axes[0].scatter(x, y, color=style.ROLE["data"], zorder=3, label="квартиры")
axes[0].set(xlabel="площадь, м²", ylabel="цена, млн", title="Модель после 0, 1, 2 и 6 пней (ν = 0.5)")
axes[0].legend()
axes[1].plot(range(M + 1), sse_path, marker="o", color=style.BLUE)
for m, v in enumerate(sse_path[:3]):
    axes[1].annotate(f"{v:g}", (m, v), textcoords="offset points", xytext=(6, 4))
axes[1].set(xlabel="число деревьев", ylabel="сумма квадратов остатков", title="Каждое дерево уменьшает ошибку")
fig.tight_layout()
ex.finish(fig, "boosting_by_hand")
