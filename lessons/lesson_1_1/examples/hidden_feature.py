"""Шум или закономерность: что модель видит, зависит от признаков.

Запуск:  python lessons/lesson_1_1/examples/hidden_feature.py [--save] [--no-show]

60 квартир: цена = 0.12·площадь + 3 − 0.15·(минут до метро) + шум σ = 0.5 (шаг 6 урока).
Модель «только площадь» видит влияние метро как шум; её остатки падают с ростом времени до метро.
Модель «площадь и метро» опускает ошибку почти до σ² = 0.25.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import style
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32

ex = Example(__file__)


def flats(n: int = 60, k: float = 0.15, noise: float = 0.5, seed: int = 3):
    """Порядок вызовов ГПСЧ на квартиру: площадь → метро → шум (как в виджете)."""
    rng = Mulberry32(seed)
    rows = []
    for _ in range(n):
        area = rng.uniform(30, 100)
        metro = rng.uniform(2, 30)
        eps = rng.normal()
        rows.append((area, metro, 0.12 * area + 3 - k * metro + noise * eps))
    return np.array(rows).T


def fit(cols: list, y: np.ndarray):
    A = np.column_stack(cols + [np.ones_like(y)])
    coef, *_ = np.linalg.lstsq(A, y, rcond=None)
    return coef, y - A @ coef


area, metro, y = flats()
coef1, r1 = fit([area], y)
coef2, r2 = fit([area, metro], y)
mse1, mse2 = np.mean(r1**2), np.mean(r2**2)
print(f"только площадь : F = {coef1[0]:.4f}·площадь {coef1[1]:+.4f};  MSE = {mse1:.3f}")
print(f"площадь и метро: F = {coef2[0]:.4f}·площадь {coef2[1]:+.4f}·метро {coef2[2]:+.4f};  MSE = {mse2:.3f}")
print("настоящий шум σ² = 0.25")
slope1 = np.polyfit(metro, r1, 1)[0]
slope2 = np.polyfit(metro, r2, 1)[0]
print(f"наклон остатков по метро: {slope1:+.4f} (только площадь) и {slope2:+.1e} (площадь и метро)")
assert abs(mse1 - 1.574) < 1e-3 and abs(mse2 - 0.271) < 1e-3, "числа шага 6 урока"
assert slope1 < -0.1 and abs(slope2) < 1e-9

for k in (0.0, 0.3):
    a, m, yk = flats(k=k)
    print(f"k = {k}: MSE только площадь {np.mean(fit([a], yk)[1] ** 2):.3f}, с метро {np.mean(fit([a, m], yk)[1] ** 2):.3f}")

fig, axes = plt.subplots(1, 2, figsize=(11, 3.8), sharey=True)
for ax, r, title in ((axes[0], r1, f"Модель знает только площадь: MSE = {mse1:.2f}"),
                     (axes[1], r2, f"Модель знает и метро: MSE = {mse2:.2f}")):
    ax.axhline(0, color=style.AXIS, lw=1)
    ax.scatter(metro, r, color=style.ROLE["data"], s=22)
    b = np.polyfit(metro, r, 1)
    xs = np.array([0, 32])
    ax.plot(xs, b[0] * xs + b[1], color=style.ORANGE, lw=2, label="тренд остатков")
    for s in (-0.5, 0.5):
        ax.axhline(s, color=style.MUTED, ls=(0, (4, 4)), lw=1)
    ax.set(xlabel="до метро, мин", title=title)
axes[0].set_ylabel("остаток r = y − F(x), млн")
axes[0].legend()
fig.tight_layout()
ex.finish(fig, "hidden_feature")
