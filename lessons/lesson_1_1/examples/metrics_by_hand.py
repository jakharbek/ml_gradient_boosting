"""Ошибка руками: остатки, их квадраты и метрики MSE, RMSE, MAE, R².

Запуск:  python lessons/lesson_1_1/examples/metrics_by_hand.py [--save] [--no-show]

Шесть квартир и правило риелтора F(x) = 0.2·x − 4 (шаг 7 урока). Скрипт печатает таблицу
остатков, метрики, сравнивает правило с константой и лучшей прямой, показывает влияние выброса
и рисует «квадраты ошибок» — их суммарная площадь и есть SSE.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Rectangle

from gbcourse import style
from gbcourse.cli import Example

ex = Example(__file__)

x = np.array([30, 40, 50, 60, 70, 80.0])  # площадь, м²
y = np.array([3, 5, 4, 8, 9, 13.0])  # цена, млн


def metrics(y: np.ndarray, F: np.ndarray) -> dict:
    r = y - F
    sse = float(np.sum(r**2))
    sse0 = float(np.sum((y - y.mean()) ** 2))
    return {"SSE": sse, "MSE": sse / len(y), "RMSE": np.sqrt(sse / len(y)), "MAE": float(np.mean(np.abs(r))), "R2": 1 - sse / sse0}


F = 0.2 * x - 4
r = y - F
print("  №   x    y   F(x)    r   |r|   r²")
for i in range(len(x)):
    print(f"  {i + 1}  {x[i]:3.0f}  {y[i]:3.0f}  {F[i]:4.0f}  {r[i]:+4.0f}  {abs(r[i]):3.0f}  {r[i] ** 2:3.0f}")
print(f"  сумма остатков: {r.sum():+.0f}  ← положительные и отрицательные ошибки гасятся\n")

m_rule = metrics(y, F)
m_const = metrics(y, np.full_like(y, y.mean()))
a, b = np.polyfit(x, y, 1)
m_best = metrics(y, a * x + b)
print(f"{'модель':22s} {'SSE':>7s} {'MSE':>7s} {'RMSE':>7s} {'MAE':>7s} {'R²':>7s}")
for name, m in [("константа 7", m_const), ("правило 0.2x − 4", m_rule), ("лучшая прямая", m_best)]:
    print(f"{name:22s} {m['SSE']:7.3f} {m['MSE']:7.3f} {m['RMSE']:7.3f} {m['MAE']:7.3f} {m['R2']:7.3f}")
print(f"лучшая прямая: a = {a:.4f}, b = {b:.4f}")

assert m_rule["SSE"] == 8 and m_const["SSE"] == 70 and abs(m_rule["R2"] - 1 + 8 / 70) < 1e-12
assert m_best["SSE"] < m_rule["SSE"] < m_const["SSE"]

y_out = y.copy()
y_out[5] = 30
m_out = metrics(y_out, F)
print(f"\nс выбросом (квартира №6 «стоит» 30): MSE {m_rule['MSE']:.2f} → {m_out['MSE']:.2f}, "
      f"RMSE {m_rule['RMSE']:.2f} → {m_out['RMSE']:.2f}, MAE {m_rule['MAE']:.2f} → {m_out['MAE']:.2f}")
assert m_out["RMSE"] / m_rule["RMSE"] > m_out["MAE"] / m_rule["MAE"], "RMSE чувствительнее к выбросу"

fig, axes = plt.subplots(1, 2, figsize=(11, 4.2))
for ax, Fm, title in [(axes[0], F, "Правило 0.2·x − 4: SSE = 8"), (axes[1], np.full_like(y, y.mean()), "Константа 7: SSE = 70")]:
    rr = y - Fm
    for xi, fi, ri in zip(x, Fm, rr):
        if abs(ri) > 0:
            ax.add_patch(Rectangle((xi, min(fi, fi + ri)), abs(ri) * 5, abs(ri), color=style.ORANGE, alpha=0.18, lw=1))
    ax.vlines(x, Fm, y, colors=style.ROLE["residual"], lw=1.6)
    xs = np.array([20, 100])
    ax.plot(xs, 0.2 * xs - 4 if Fm is F else np.full(2, y.mean()), color=style.BLUE, lw=2)
    ax.scatter(x, y, color=style.ROLE["data"], zorder=3)
    ax.set(xlabel="площадь, м²", ylabel="цена, млн", title=title, xlim=(20, 110), ylim=(-1, 17))
fig.suptitle("Квадраты ошибок: по горизонтали масштаб ×5, площадь каждого ∝ r²")
fig.tight_layout()
ex.finish(fig, "metrics_by_hand")
