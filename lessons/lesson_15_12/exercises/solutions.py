"""Решения упражнений урока 15.12.

Запуск:  python lessons/lesson_15_12/exercises/solutions.py
"""

import sys

import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
np.set_printoptions(precision=4, suppress=True)

# 1. Векторы и угол
a, b = np.array([1.0, 2, 2]), np.array([2.0, 0, 1])
ang = np.degrees(np.arccos(a @ b / (np.linalg.norm(a) * np.linalg.norm(b))))
print(f"1) 2a − 3b = {2 * a - 3 * b}, a·b = {a @ b}, ‖a‖ = {np.linalg.norm(a)}, ‖b‖ = {np.linalg.norm(b):.4f}, угол {ang:.1f}°")
assert np.allclose(2 * a - 3 * b, [-4, 4, 1]) and a @ b == 4 and abs(ang - 53.4) < 0.05

# 2. Нормы и лучшая константа
y = np.array([2, 4, 3, 7, 9, 11.0])
for c in (6.0, 5.5):
    r = y - c
    print(f"2) c = {c}: L1 = {np.abs(r).sum()}, L2 = {np.linalg.norm(r):.4f}, L∞ = {np.abs(r).max()}, Σ квадратов = {r @ r}")
assert np.abs(y - 6).sum() == np.abs(y - 5.5).sum() == 18
print("   по L1 любая константа между 3-й и 4-й по величине ценами (4 и 7) даёт 18: функция Σ|yᵢ − c| там постоянна;")
print("   по L2 лучшая — только среднее 6: 64 < 65.5")

# 3. Проекция
a, b = np.array([3.0, 1.0]), np.array([4.0, 2.0])
p = (a @ b) / (a @ a) * a
e = b - p
print(f"3) проекция {p}, остаток {e}, a·e = {a @ e:.1e}, Пифагор {b @ b:.2f} = {p @ p:.2f} + {e @ e:.2f}")
assert np.allclose(p, [4.2, 1.4]) and abs(a @ e) < 1e-12 and np.isclose(b @ b, p @ p + e @ e)

# 4. Определитель, обратная, система
A = np.array([[3, 1], [5, 2.0]])
Ai = np.linalg.inv(A)
print(f"4) det = {np.linalg.det(A):.0f}, A⁻¹ = {Ai.round(10).tolist()}, AA⁻¹ = I: {np.allclose(A @ Ai, np.eye(2))}, решение {np.linalg.solve(A, [4, 7.0])}")
assert np.allclose(Ai, [[2, -1], [-5, 3]]) and np.allclose(np.linalg.solve(A, [4, 7.0]), [1, 1])

# 5. Метод Гаусса
M = np.array([[1, 2, 1, 8], [2, 1, -1, 1], [1, -1, 2, 5.0]])
print("5) прямой ход:")
for c_ in range(3):
    for r_ in range(c_ + 1, 3):
        f = M[r_, c_] / M[c_, c_]
        M[r_] -= f * M[c_]
        print(f"   R{r_ + 1} −= {f:g}·R{c_ + 1} → {M[r_]}")
z = M[2, 3] / M[2, 2]
yv = (M[1, 3] - M[1, 2] * z) / M[1, 1]
xv = M[0, 3] - M[0, 1] * yv - M[0, 2] * z
print(f"   обратный ход: z = {z:g}, y = {yv:g}, x = {xv:g}")
assert np.allclose([xv, yv, z], [1, 2, 3])

# 6. МНК по трём точкам
X = np.c_[np.ones(3), [0, 1, 2.0]]
yy = np.array([1, 3, 4.0])
w = np.linalg.solve(X.T @ X, X.T @ yy)
r = yy - X @ w
r2 = 1 - r @ r / ((yy - yy.mean()) @ (yy - yy.mean()))
print(f"6) XᵀX = {(X.T @ X).tolist()}, Xᵀy = {X.T @ yy}; b = {w[0]:.4f} (= 7/6), k = {w[1]}; остатки {r.round(4)}, Xᵀr = {(X.T @ r).round(12)}, R² = {r2:.4f}")
assert np.allclose(w, [7 / 6, 1.5]) and np.allclose(X.T @ r, 0)

# 7. Собственные числа и спуск
A = np.array([[3, 1], [1, 3.0]])
lam, V = np.linalg.eigh(A)
kappa = lam.max() / lam.min()
eta_best = 2 / (lam.min() + lam.max())
print(f"7) λ = {lam}, векторы (столбцы) {V.round(4).tolist()}; η < {2 / lam.max()}, κ = {kappa}, лучший η = {eta_best:.4f}, множитель {(kappa - 1) / (kappa + 1):.4f}")
assert np.allclose(lam, [2, 4]) and np.isclose(eta_best, 1 / 3)
assert np.allclose(np.abs(1 - eta_best * lam), 1 / 3)

# 8. Квадратичные формы
for M8, name in ((np.array([[3, 1], [1, 3.0]]), "3x₁² + 2x₁x₂ + 3x₂²"), (np.array([[2, 3], [3, 1.0]]), "2x₁² + 6x₁x₂ + x₂²")):
    lam = np.linalg.eigvalsh(M8)
    kind = "чаша" if lam.min() > 0 else "седло" if lam.min() < 0 < lam.max() else "жёлоб"
    print(f"8) {name}: λ = {lam.round(4)}, det = {np.linalg.det(M8):.0f} → {kind}")
print("   оси первой формы — (1, 1) и (1, −1); полуоси f = 1: 1/√4 = 0.5 вдоль (1, 1) и 1/√2 ≈ 0.707 вдоль (1, −1)")

# 9. Полиномы и гребневая регрессия
x = np.arange(1, 7.0)


def loo(V, fit):
    return np.mean([(y[i] - V[i] @ fit(np.delete(V, i, 0), np.delete(y, i))) ** 2 for i in range(6)])


ols = lambda V, t: np.linalg.lstsq(V, t, rcond=None)[0]
V1, V2 = np.vander(x, 2, increasing=True), np.vander(x, 3, increasing=True)
w2 = ols(V2, y)
print(f"9) парабола {w2.round(4)}: Σ квадратов {((y - V2 @ w2) ** 2).sum():.4f} (прямая 5.4857); LOO прямой {loo(V1, ols):.4f}, параболы {loo(V2, ols):.4f}")
z_ = (x - x.mean()) / x.std()
V5 = np.vander(z_, 6, increasing=True)
D = np.diag([0, 1, 1, 1, 1, 1.0])
ridge = lambda V, t: np.linalg.solve(V.T @ V + 1.0 * D, V.T @ t)
print(f"   полином 5-й степени + ridge λ = 1: LOO {loo(V5, ridge):.4f}")
assert ((y - V2 @ w2) ** 2).sum() < 5.4857 and loo(V2, ols) > loo(V1, ols) and abs(loo(V5, ridge) - 7.469) < 1e-3

# 10. SVD
A = np.array([[3, 0], [4, 5.0]])
ev = np.linalg.eigvalsh(A.T @ A)[::-1]
s = np.sqrt(ev)
print(f"10) собственные числа AᵀA {ev}, σ = {s.round(4)}, ‖A‖²_F = {(A**2).sum()} = σ₁² + σ₂² = {ev.sum():.0f}, κ = {s[0] / s[1]:.4f}")
print(f"    ошибка ранга 1: σ₂/‖A‖_F = {s[1] / np.sqrt((A**2).sum()):.4f}; σ₁σ₂ = {s.prod():.4f} = |det A| = {abs(np.linalg.det(A)):.4f}")
assert np.allclose(s, np.linalg.svd(A, compute_uv=False)) and np.isclose(s.prod(), 15) and np.isclose(s[0] / s[1], 3)

# 11. Дерево как проекция
r = np.array([-3, -1, 0, 2, 2.0])
xx = np.arange(1, 6.0)
for t in (2.5, 3.5):
    L = np.c_[xx <= t, xx > t].astype(float)
    th = np.linalg.solve(L.T @ L, L.T @ r)
    h = L @ th
    g2 = [sum((L[:, j] @ r) ** 2 / (L[:, j].sum() + lam) for j in range(2)) for lam in (0, 2)]
    print(f"11) порог {t}: листья {th.round(4)}, ‖h‖² = {h @ h:.4f}, выигрыш при λ = 2: {g2[1]:.4f}")
    assert np.isclose(g2[0], 16 / 2 + 16 / 3) and np.isclose(g2[1], 7.2)
L3 = np.c_[xx <= 2.5, (xx > 2.5) & (xx <= 3.5), xx > 3.5].astype(float)
h3 = L3 @ np.linalg.solve(L3.T @ L3, L3.T @ r)
print(f"    три листа {{1, 2}}, {{3}}, {{4, 5}}: h = {h3}, ‖h‖² = {h3 @ h3}, остаток {((r - h3) ** 2).sum()}; при ничьей дерево берёт первый найденный порог 2.5")

# 12. Лист Ньютона
F0, yb = np.array([2, 0.5, -0.5, 1.0]), np.array([1, 1, 0, 0.0])
p = 1 / (1 + np.exp(-F0))
g, hs = p - yb, p * (1 - p)
zz = -g / hs
leaf = {lam: -g.sum() / (hs.sum() + lam) for lam in (0, 1)}
print(f"12) g = {g.round(4)}, h = {hs.round(4)}, z = {zz.round(4)}; лист λ=0: {leaf[0]:.4f} = взвешенное среднее z {(hs * zz).sum() / hs.sum():.4f}; λ=1: {leaf[1]:.4f}")
lo, hi = -10.0, 10.0
for _ in range(200):
    m = (lo + hi) / 2
    lo, hi = (m, hi) if np.sum(1 / (1 + np.exp(-(F0 + m))) - yb) < 0 else (lo, m)
print(f"    точный оптимум {lo:.4f} (бисекция по производной)")
assert abs(leaf[0] + 0.7930) < 1e-4 and abs(lo + 0.75) < 1e-6
try:
    import xgboost as xgb

    for lam in (0, 1):
        dm = xgb.DMatrix(np.zeros((4, 1)), label=yb, base_margin=F0)
        bst = xgb.train({"objective": "binary:logistic", "eta": 1, "lambda": lam, "max_depth": 1, "min_child_weight": 0}, dm, 1)
        w_x = (bst.predict(dm, output_margin=True) - F0)[0]
        print(f"    XGBoost λ = {lam}: {w_x:.4f}")
        assert abs(w_x - leaf[lam]) < 1e-5
except ImportError:
    print("    xgboost не установлен — сверку пропускаем")
