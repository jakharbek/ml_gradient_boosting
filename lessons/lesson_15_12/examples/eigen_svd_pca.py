"""Собственные векторы, обусловленность спуска, SVD и метод главных компонент.

Запуск:  python lessons/lesson_15_12/examples/eigen_svd_pca.py [--save] [--no-show]

1) Степени матрицы: Фибоначчи (F₂₀ = 6765 ≈ φ²⁰/√5) и цепь Маркова (стационарное (5/6, 1/6), отклонение × 0.4ᵏ).
2) Обусловленность и спуск по МНК: 606 шагов с сырой площадью, 20 — с центрированной, 1 — со стандартизованной.
3) SVD картинки 40 × 40: ранг 23; ранг 5 хранит 25 % чисел при ошибке 21 %.
4) PCA шести квартир: первая компонента — 98.5 % дисперсии; её наклон 1.963, у МНК — 1.829.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)
fig, axes = plt.subplots(2, 2, figsize=(12, 9))
X1, y = datasets.toy_regression()
x = X1[:, 0]

# 1. Степени матрицы
Fib = np.array([[1, 1], [1, 0]])
phi = (1 + 5**0.5) / 2
F20 = np.linalg.matrix_power(Fib, 20)[0, 1]
print(f"1) F₂₀ = {F20}, φ²⁰/√5 = {phi**20 / 5**0.5:.5f}")
assert F20 == 6765
P = np.array([[0.9, 0.5], [0.1, 0.5]])
s = np.array([0, 1.0])
dev = []
for k in range(21):
    dev.append(np.abs(s - [5 / 6, 1 / 6]).sum())
    s = P @ s
print(f"   погода: отклонение от (5/6, 1/6) за шаг × {dev[11] / dev[10]:.3f}")
assert np.isclose(dev[11] / dev[10], 0.4)
ax = axes[0, 0]
ax.semilogy(dev, "o-", color=BLUE, ms=3, label="погода: |xₖ − стационарное|")
ax.semilogy([abs(np.linalg.matrix_power(Fib, k)[0, 1] / max(np.linalg.matrix_power(Fib, k)[1, 1], 1) - phi) if k > 1 else np.nan for k in range(21)], "s-", color=ORANGE, ms=3, label="|Fₖ₊₁/Fₖ − φ|")
ax.set(xlabel="k", title="степени матрицы: гаснет всё, кроме главного λ")
ax.legend(fontsize=8)

# 2. Обусловленность и градиентный спуск
results = {}
ax = axes[0, 1]
for (name, f), col in zip((("сырой x", x), ("центрированный", x - 3.5), ("стандартизованный", (x - 3.5) / x.std())), (ORANGE, BLUE, AQUA)):
    Xm = np.c_[np.ones(6), f]
    lam = np.linalg.eigvalsh(2 * Xm.T @ Xm)
    eta = 2 / (lam.min() + lam.max())
    ws = np.linalg.solve(Xm.T @ Xm, Xm.T @ y)
    w = np.zeros(2)
    errs = [np.linalg.norm(w - ws)]
    for k in range(1, 5001):
        w = w - eta * (-2 * Xm.T @ (y - Xm @ w))
        errs.append(np.linalg.norm(w - ws))
        if errs[-1] < 1e-6 * max(1, np.linalg.norm(ws)):
            break
    results[name] = k
    print(f"2) {name:16}: κ = {lam.max() / lam.min():7.3f}, лучший η = {eta:.4f}, шагов {k}")
    ax.semilogy(np.maximum(errs, 1e-12), color=col, label=f"{name}: κ = {lam.max() / lam.min():.1f}, {k} шагов")
assert results == {"сырой x": 606, "центрированный": 20, "стандартизованный": 1}
ax.set(xlabel="шаг", ylabel="‖w − w*‖", xlim=(0, 650), title="спуск с лучшим постоянным темпом")
ax.legend(fontsize=8)

# 3. SVD картинки
N = 40
img = np.zeros((N, N))
for i in range(N):
    for j in range(N):
        v = 0.12 + 0.22 * j / (N - 1)
        if 5 <= i <= 13 and 4 <= j <= 21:
            v += 0.55
        if abs(np.hypot(i - 27, j - 27) - 8) <= 1.6:
            v += 0.6
        if 3 <= i <= 36 and abs(i - (N - 1 - j)) <= 1.2 and j <= 22:
            v += 0.6
        img[i, j] = min(v, 1.0)
U, sv, Vt = np.linalg.svd(img)
k = 5
approx = (U[:, :k] * sv[:k]) @ Vt[:k]
err = np.linalg.norm(img - approx) / np.linalg.norm(img)
print(f"3) ранг картинки {np.linalg.matrix_rank(img)}; ранг {k}: {k * (2 * N + 1)} чисел из {N * N}, ошибка {err:.1%}")
assert np.linalg.matrix_rank(img) == 23 and abs(err - 0.21) < 0.005
ax = axes[1, 0]
ax.imshow(np.c_[img, np.ones((N, 2)) * 0, np.clip(approx, 0, 1)], cmap="gray_r", vmin=0, vmax=1)
ax.set(xticks=[], yticks=[], title=f"исходная и ранг {k}: ошибка {err:.0%}")

# 4. PCA квартир
Pc = np.c_[x - x.mean(), y - y.mean()]
C = Pc.T @ Pc / 5
lam, V = np.linalg.eigh(C)
share = lam[1] / lam.sum()
slope_pc = V[1, 1] / V[0, 1]
print(f"4) ковариация {C.tolist()}, доля PC1 {share:.4f}, наклон PC1 {slope_pc:.4f}, МНК {32 / 17.5:.4f}")
assert abs(share - 0.9853) < 1e-4 and abs(slope_pc - 1.9626) < 1e-4
ax = axes[1, 1]
ax.plot(x, y, "o", color="black")
xs = np.linspace(0.5, 6.5, 2)
ax.plot(xs, y.mean() + slope_pc * (xs - x.mean()), color=VIOLET, lw=2, label=f"PC1: наклон {slope_pc:.3f}")
ax.plot(xs, y.mean() + 32 / 17.5 * (xs - x.mean()), "--", color=ORANGE, lw=2, label="МНК: наклон 1.829")
for xi, yi in zip(x, y):
    t = np.array([xi - x.mean(), yi - y.mean()]) @ V[:, 1]
    ax.plot([xi, x.mean() + t * V[0, 1]], [yi, y.mean() + t * V[1, 1]], color=MUTED, lw=1)
ax.set(aspect="equal", xlabel="площадь", ylabel="цена", title="PCA — перпендикуляры, МНК — вертикали")
ax.legend(fontsize=8)
ex.finish(fig, "eigen_svd_pca")
