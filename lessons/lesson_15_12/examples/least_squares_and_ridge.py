"""Метод наименьших квадратов как проекция, полиномиальные признаки и гребневая регрессия.

Запуск:  python lessons/lesson_15_12/examples/least_squares_and_ridge.py [--save] [--no-show]

1) Нормальные уравнения, QR и lstsq дают одну прямую −0.4 + 1.829·x; остаток ⟂ столбцам; R² = 0.914.
2) Чаша суммы квадратов в координатах (b, k) вытянута: κ(XᵀX) ≈ 87.6; после центрирования — 2.92.
3) Полиномы: ошибка на обучении падает до 0, а LOO после первой степени растёт; κ без стандартизации — до 10¹¹.
4) Гребневая регрессия: λ сжимает веса полинома пятой степени; лучшая LOO 4.21 при λ ≈ 4 — хуже прямой (1.665).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE, SERIES

ex = Example(__file__)
fig, axes = plt.subplots(2, 2, figsize=(12, 9))
X1, y = datasets.toy_regression()
x = X1[:, 0]
X = np.c_[np.ones(6), x]

# 1. Три способа решить МНК
w_ne = np.linalg.solve(X.T @ X, X.T @ y)
Q, R = np.linalg.qr(X)
w_qr = np.linalg.solve(R, Q.T @ y)
w_ls = np.linalg.lstsq(X, y, rcond=None)[0]
r = y - X @ w_ne
print(f"1) нормальные уравнения {w_ne.round(4)}, QR {w_qr.round(4)}, lstsq {w_ls.round(4)}")
print(f"   ‖r‖² = {r @ r:.4f}, Xᵀr = {(X.T @ r).round(12)}, R² = {1 - r @ r / 64:.4f}")
assert np.allclose(w_ne, w_qr) and np.allclose(w_ne, w_ls) and np.allclose(X.T @ r, 0)
assert abs(r @ r - 5.4857) < 1e-4 and abs(1 - r @ r / 64 - 0.9143) < 1e-4
ax = axes[0, 0]
ax.vlines(x, X @ w_ne, y, color=MUTED)
ax.plot(x, y, "o", color="black", label="квартиры")
ax.plot([0.5, 6.5], [w_ne[0] + w_ne[1] * 0.5, w_ne[0] + w_ne[1] * 6.5], color=BLUE, lw=2, label="МНК-прямая")
ax.set(xlabel="площадь", ylabel="цена", title="МНК: остатки ⊥ столбцам X")
ax.legend()

# 2. Чаша потерь
kap_raw = np.linalg.cond(X.T @ X)
Xc = np.c_[np.ones(6), x - 3.5]
kap_c = np.linalg.cond(Xc.T @ Xc)
print(f"2) κ(XᵀX): сырой x {kap_raw:.2f}, центрированный {kap_c:.3f}")
assert abs(kap_raw - 87.6) < 0.05 and abs(kap_c - 17.5 / 6) < 1e-9
Bg, Kg = np.meshgrid(np.linspace(-3, 5, 160), np.linspace(-0.5, 3, 160))
Z = sum((y[i] - Bg - Kg * x[i]) ** 2 for i in range(6))
ax = axes[0, 1]
ax.contour(Bg, Kg, Z, levels=[6, 8, 12, 20, 35, 60, 100, 160, 250], colors=MUTED, linewidths=0.9)
ax.plot(*w_ne, "o", color=BLUE, label="минимум (−0.4, 1.829)")
ax.set(xlabel="сдвиг b", ylabel="наклон k", title=f"чаша суммы квадратов: κ = {kap_raw:.1f}")
ax.legend()

# 3. Полиномы и переобучение
z = (x - x.mean()) / x.std()
xs = np.linspace(0.5, 6.5, 300)
ax = axes[1, 0]
ax.plot(x, y, "o", color="black")
sses, loos = [], []
for d in range(6):
    V = np.vander(x, d + 1, increasing=True)
    wd = np.linalg.lstsq(V, y, rcond=None)[0]
    sses.append(((y - V @ wd) ** 2).sum())
    loos.append(np.mean([(y[i] - V[i] @ np.linalg.lstsq(np.delete(V, i, 0), np.delete(y, i), rcond=None)[0]) ** 2 for i in range(6)]) if d < 5 else np.nan)
    Vs = np.vander(z, d + 1, increasing=True)
    print(f"3) степень {d}: Σ квадратов {sses[-1]:8.4f}, LOO {loos[-1]:9.4f}, κ сырой {np.linalg.cond(V.T @ V):.2e}, станд. {np.linalg.cond(Vs.T @ Vs):.2e}")
    if d in (1, 2, 5):
        ax.plot(xs, np.vander(xs, d + 1, increasing=True) @ wd, label=f"степень {d}", color=SERIES[d % len(SERIES)])
assert all(a >= b - 1e-9 for a, b in zip(sses, sses[1:])) and sses[-1] < 1e-9
assert np.nanargmin(loos) == 1
ax.set(ylim=(-4, 16), xlabel="площадь", title="больше признаков — меньше ошибка на обучении")
ax.legend(fontsize=8)

# 4. Гребневая регрессия
V5 = np.vander(z, 6, increasing=True)
D = np.diag([0, 1, 1, 1, 1, 1.0])
ridge = lambda Vm, ym, lam: np.linalg.solve(Vm.T @ Vm + lam * D, Vm.T @ ym)
lams = np.logspace(-4, 2, 121)
loo = np.array([np.mean([(y[i] - V5[i] @ ridge(np.delete(V5, i, 0), np.delete(y, i), l)) ** 2 for i in range(6)]) for l in lams])
ib = int(np.argmin(loo))
print(f"4) ridge: LOO при λ = 1e-4 — {loo[0]:.2f}, лучшая {loo[ib]:.3f} при λ ≈ {lams[ib]:.2f}; прямая — {loos[1]:.3f}")
assert abs(loo[ib] - 4.21) < 0.01 and 3.5 < lams[ib] < 4.5 and loo[ib] > loos[1]
ax = axes[1, 1]
ax.semilogx(lams, loo, color=ORANGE, label="LOO: полином 5-й степени + ridge")
ax.axhline(loos[1], color=MUTED, ls="--", label=f"прямая: {loos[1]:.3f}")
ax.axvline(lams[ib], color=BLUE, ls=":")
ax.set(ylim=(0, 40), xlabel="λ", title="регуляризация спасает переобученную модель")
ax.legend(fontsize=8)
ex.finish(fig, "least_squares_and_ridge")
