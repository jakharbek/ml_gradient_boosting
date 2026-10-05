"""Матрицы: преобразования, определитель, обратная матрица, метод Гаусса и обусловленность.

Запуск:  python lessons/lesson_15_12/examples/matrices_and_systems.py [--save] [--no-show]

1) Матрица — преобразование плоскости: столбцы — образы базисных векторов, |det| — масштаб площади.
2) Произведение — композиция: AB ≠ BA; det(AB) = det A · det B; (AB)⁻¹ = B⁻¹A⁻¹.
3) Метод Гаусса: одно решение (1, 2, 3), противоречие 0 = −2 и семейство решений.
4) Плохая обусловленность: при κ ≈ 4000 ошибка 0.001 в правой части сдвигает решение с (1, 1) в (0, 2).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)
fig, axes = plt.subplots(2, 2, figsize=(12, 9))
house = np.array([[0, 0], [1, 0], [1, 0.8], [0.5, 1.3], [0, 0.8], [0, 0]]).T

# 1. Преобразования
mats = {"сдвиг": np.array([[1, 1], [0, 1.0]]), "отражение": np.array([[-1, 0], [0, 1.0]]), "[[2, 1], [1, 2]]": np.array([[2, 1], [1, 2.0]])}
ax = axes[0, 0]
ax.fill(house[0], house[1], color=MUTED, alpha=0.3, label="исходный")
for (name, M), col in zip(mats.items(), (BLUE, ORANGE, VIOLET)):
    hh = M @ house
    ax.plot(hh[0], hh[1], color=col, lw=2, label=f"{name}: det = {np.linalg.det(M):.0f}")
    print(f"1) {name}: столбцы {M[:, 0]}, {M[:, 1]}; det = {np.linalg.det(M):.3f}")
ax.set(aspect="equal", title="матрица переводит домик в домик")
ax.legend(fontsize=8)

# 2. Произведение и обратная
A = np.array([[1, 2], [3, 4.0]])
B = np.array([[0, 1], [1, 0.0]])
print("2) AB =", (A @ B).tolist(), " BA =", (B @ A).tolist())
assert not np.allclose(A @ B, B @ A)
assert np.isclose(np.linalg.det(A @ B), np.linalg.det(A) * np.linalg.det(B))
assert np.allclose(np.linalg.inv(A @ B), np.linalg.inv(B) @ np.linalg.inv(A))
S = np.array([[2, 1], [1, 2.0]])
print("   (2,1;1,2)⁻¹ ·3 =", (3 * np.linalg.inv(S)).round(10).tolist(), " решение S·w = (3, 3):", np.linalg.solve(S, [3, 3.0]))
d_vals = np.linspace(1.001, 1.2, 81)
ax = axes[0, 1]
ax.semilogy(d_vals - 1, [np.abs(np.linalg.inv(np.array([[1, 1], [1, d]]))).max() for d in d_vals], color=BLUE)
ax.set(xlabel="det A = d − 1", ylabel="max |элемент A⁻¹|", title="A = [[1, 1], [1, d]]: малый det — огромная A⁻¹")

# 3. Метод Гаусса
systems = {"одно решение": [[1, 1, 1, 6], [2, 1, -1, 1], [1, -1, 2, 5]],
           "нет решений": [[1, 1, 1, 6], [2, 2, 2, 10], [1, -1, 0, 0]],
           "бесконечно много": [[1, 1, 1, 6], [2, 1, -1, 1], [3, 2, 0, 7]]}
ranks = {}
for name, M in systems.items():
    M = np.array(M, float)
    ranks[name] = (np.linalg.matrix_rank(M[:, :3]), np.linalg.matrix_rank(M))
    print(f"3) {name}: ранг A = {ranks[name][0]}, ранг [A | c] = {ranks[name][1]}")
sol = np.linalg.solve(np.array(systems["одно решение"], float)[:, :3], np.array(systems["одно решение"], float)[:, 3])
print("   решение:", sol)
assert np.allclose(sol, [1, 2, 3]) and ranks["нет решений"] == (2, 3) and ranks["бесконечно много"] == (2, 2)
ax = axes[1, 0]
tt = np.linspace(-1, 5, 50)
fam = np.c_[2 * tt - 5, 11 - 3 * tt, tt]
A3 = np.array(systems["одно решение"], float)[:, :3]
print("   семейство (2t − 5, 11 − 3t, t) удовлетворяет первым двум уравнениям:", np.allclose(fam @ A3[:2].T, [6, 1]))
ax.plot(tt, fam[:, 0], color=BLUE, label="x = 2t − 5")
ax.plot(tt, fam[:, 1], color=ORANGE, label="y = 11 − 3t")
ax.plot(tt, fam[:, 2], color=VIOLET, label="z = t")
ax.axvline(3, color=MUTED, ls="--")
ax.set(xlabel="параметр t", title="бесконечно много решений: прямая в пространстве")
ax.legend(fontsize=8)

# 4. Обусловленность
Bn = np.array([[1, 1], [1, 1.001]])
k = np.linalg.cond(Bn)
s1, s2 = np.linalg.solve(Bn, [2, 2.001]), np.linalg.solve(Bn, [2, 2.002])
print(f"4) κ = {k:.0f}; решения {s1.round(6)} и {s2.round(6)}")
assert 3990 < k < 4010 and np.allclose(s1, [1, 1]) and np.allclose(s2, [0, 2])
rng = Mulberry32(5)
ax = axes[1, 1]
for eps, col in ((1.0, BLUE), (0.01, ORANGE)):
    M = np.array([[1, 1], [1, 1 + eps]])
    pts = np.array([np.linalg.solve(M, [2 + rng.normal(0, 0.005), 2 + eps + rng.normal(0, 0.005)]) for _ in range(200)])
    ax.scatter(pts[:, 0], pts[:, 1], s=8, color=col, alpha=0.6, label=f"ε = {eps}: κ = {np.linalg.cond(M):.0f}")
ax.set(xlabel="x", ylabel="y", title="одинаковый шум в c — разный разброс решений")
ax.legend(fontsize=8)
ex.finish(fig, "matrices_and_systems")
