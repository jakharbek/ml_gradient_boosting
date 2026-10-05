"""Решения упражнений урока 1.2.

Запуск:  python lessons/lesson_1_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import get_loss

# 1
y = np.array([1.0, 2.0, 3.0, 100.0])
for c in (1.5, 2.0, 2.5, 3.0, 3.5):
    print(f"1) S({c}) = {np.abs(y - c).sum():.2f}")
print("   На [2, 3] слева и справа по 2 точки: сдвиг c на ε добавляет 2ε и отнимает 2ε — сумма не меняется.")

# 2
y = np.array([2.1, 2.9, 3.3, 3.8, 4.1, 4.4, 4.9, 5.6, 6.2, 11.5])
cs = np.linspace(0, 12, 12001)
for delta in (0.1, 0.5, 1, 3, 10):
    loss = get_loss("huber", delta=delta)
    c = cs[np.argmin([loss.pointwise(y, np.full_like(y, v)).sum() for v in cs])]
    print(f"2) δ = {delta:4}: c* = {c:.3f}")
print(f"   медиана = {np.median(y):.3f}, среднее = {y.mean():.3f}: δ→0 даёт медиану, δ→∞ — среднее.")

# 3
alpha = 10 / (10 + 90)  # недопрогноз стоит 10, перепрогноз 90 → α = c_under / (c_under + c_over)
demand = np.array([20, 25, 22, 30, 28, 35, 24, 26], dtype=float)
loss = get_loss("quantile", alpha=alpha)
print(f"3) α = {alpha:.2f}; оптимальный запас = {loss.init(demand):.2f} (среднее спроса {demand.mean():.2f})")
print("   Перепрогноз дорог — выгодно печь меньше среднего.")

# 4
print("4) Пример: кредитный скоринг оптимизирует log-loss, а отчитывается по ROC AUC или прибыли портфеля;")
print("   AUC зависит только от порядка прогнозов и не дифференцируема — оптимизировать её напрямую неудобно.")
