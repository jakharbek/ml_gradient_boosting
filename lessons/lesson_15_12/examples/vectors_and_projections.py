"""Векторы и проекции: скалярное произведение, лучшая константа, нормы и масштаб признаков.

Запуск:  python lessons/lesson_15_12/examples/vectors_and_projections.py [--save] [--no-show]

1) Проекция b на прямую вдоль a: квадрат расстояния — парабола по t, минимум при t* = a·b / a·a, остаток ⟂ a.
2) Лучшая константа по сумме квадратов — проекция y на вектор из единиц, то есть среднее; Пифагор 280 = 216 + 64.
3) Нормы остатков: L2 = 8, L1 = 18, L∞ = 5; выброс сдвигает среднее, но не медиану.
4) Ближайший сосед зависит от единиц измерения: м² и км, м² и метры, стандартизованные признаки.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, INK, MUTED, ORANGE, VIOLET

ex = Example(__file__)
fig, axes = plt.subplots(2, 2, figsize=(12, 9))

# 1. Проекция на прямую
a, b = np.array([4.0, 1.0]), np.array([2.0, 3.0])
t_star = (a @ b) / (a @ a)
p = t_star * a
e = b - p
print(f"1) t* = {t_star:.4f}, проекция {p.round(4)}, остаток {e.round(4)}, a·e = {a @ e:.1e}")
print(f"   Пифагор: ‖b‖² = {b @ b:.3f} = {p @ p:.3f} + {e @ e:.3f}")
assert abs(a @ e) < 1e-12 and np.isclose(b @ b, p @ p + e @ e)
ax = axes[0, 0]
ax.plot([-1.5 * a[0], 1.6 * a[0]], [-1.5 * a[1], 1.6 * a[1]], ":", color=MUTED)
for vec, col, name in ((a, BLUE, "a"), (b, INK, "b"), (p, AQUA, "проекция")):
    ax.annotate("", xy=vec, xytext=(0, 0), arrowprops=dict(arrowstyle="->", color=col, lw=2))
    ax.text(*(vec + 0.1), name, color=col)
ax.plot([b[0], p[0]], [b[1], p[1]], "--", color=MUTED)
ax.set(aspect="equal", xlim=(-1, 5), ylim=(-1, 4), title="проекция b на a: остаток ⊥ a")

# 2. Среднее как проекция на 1
X1, y = datasets.toy_regression()
one = np.ones(6)
c_best = (one @ y) / (one @ one)
r = y - c_best
print(f"2) проекция y на 1 = {c_best} (среднее), сумма остатков {r.sum()}, Пифагор {y @ y} = {6 * c_best**2} + {r @ r}")
assert c_best == y.mean() and r.sum() == 0 and y @ y == 6 * c_best**2 + r @ r
cs = np.linspace(0, 12, 241)
ax = axes[0, 1]
ax.plot(cs, [((y - c) ** 2).sum() for c in cs], color=BLUE, label="Σ (yᵢ − c)²")
ax.plot(cs, [np.abs(y - c).sum() * 4 for c in cs], color=ORANGE, label="Σ |yᵢ − c| × 4")
ax.axvline(c_best, color=BLUE, ls="--")
ax.axvspan(4, 7, color=ORANGE, alpha=0.1)
ax.set(xlabel="константа c", title="лучшая константа: среднее (L2), медиана (L1)")
ax.legend()

# 3. Нормы и выброс
print(f"3) нормы остатков: L2 = {np.linalg.norm(r)}, L1 = {np.linalg.norm(r, 1)}, L∞ = {np.linalg.norm(r, np.inf)}")
y_out = y.copy()
y_out[-1] = 21
print(f"   с выбросом 21: среднее {y_out.mean():.3f} (сдвиг {y_out.mean() - 6:.3f}), медиана {np.median(y_out)} (без изменений)")
assert (np.linalg.norm(r), np.linalg.norm(r, 1), np.linalg.norm(r, np.inf)) == (8.0, 18.0, 5.0)
assert np.median(y_out) == np.median(y) == 5.5
ax = axes[1, 0]
t = np.linspace(0, 2 * np.pi, 400)
for pp, col in ((1, ORANGE), (2, BLUE), (10, VIOLET)):
    n = (np.abs(np.cos(t)) ** pp + np.abs(np.sin(t)) ** pp) ** (1 / pp)
    ax.plot(np.cos(t) / n, np.sin(t) / n, color=col, lw=2, label=f"p = {pp}")
ax.set(aspect="equal", title="единичные шары Lₚ")
ax.legend()

# 4. Масштаб признаков
area = np.array([30, 35, 42, 50, 62, 70, 78, 90.0])
dist = np.array([12, 3, 9, 4, 10, 2, 8, 3.0])
q = np.array([58.0, 4.0])
nearest = {}
for name, sx, sy in (("м², км", 1, 1), ("м², метры", 1, 1000), ("стандартизованные", 1 / area.std(), 1 / dist.std())):
    d = np.hypot((area - q[0]) * sx, (dist - q[1]) * sy)
    nearest[name] = int(np.argmin(d)) + 1
    print(f"4) {name:18}: ближайшая №{nearest[name]} (расстояние {d.min():.3f})")
assert nearest == {"м², км": 5, "м², метры": 4, "стандартизованные": 4}
ax = axes[1, 1]
ax.scatter(area, dist, color=MUTED, zorder=3)
ax.scatter(*q, color=INK, marker="s", zorder=3, label="новая квартира")
for i in range(8):
    ax.text(area[i] + 1, dist[i] + 0.3, f"№{i + 1}", fontsize=8)
for k, col in ((5, ORANGE), (4, AQUA)):
    ax.plot([q[0], area[k - 1]], [q[1], dist[k - 1]], color=col, lw=2, label=f"сосед №{k}")
ax.set(xlabel="площадь, м²", ylabel="до центра, км", title="№5 — в (м², км); №4 — после стандартизации")
ax.legend(fontsize=8)
ex.finish(fig, "vectors_and_projections")
