"""Градиент по вектору прогнозов: псевдо-остатки, шаг деревом как проекция и гессиан softmax в XGBoost.

Запуск:  python lessons/lesson_15_8/examples/boosting_functional_gradient.py [--save] [--no-show]

1) Псевдо-остатки MSE, Хьюбера, Пуассона и log-loss = минус численный градиент суммы потерь по прогнозам.
2) Шесть квартир: первый пень — ортогональная проекция антиградиента; cos угла 0.919, потери 32 → 5.
3) Потери бустинга по шагам: gbcourse совпадает с scikit-learn при ν = 1 и ν = 0.5.
4) Многоклассовый случай: XGBoost берёт диагональ гессиана softmax 2p(1 − p) — проверка по листьям.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
import xgboost as xgb
from sklearn.ensemble import GradientBoostingRegressor

from gbcourse import datasets
from gbcourse.boosting import GBRegressor
from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)


def grad_num(f, p, eps=1e-6):
    p = np.asarray(p, dtype=float)
    return np.array([(f(p + e) - f(p - e)) / (2 * eps) for e in np.eye(len(p)) * eps])


# 1. Псевдо-остатки
y3 = np.array([3.0, 1.0, 2.0])
F3 = np.array([-2.0, 4.0, 2.5])
LOSSES = {
    "MSE": (lambda F: 0.5 * np.sum((y3 - F) ** 2), lambda F: y3 - F),
    "Хьюбер δ=1": (lambda F: np.sum(np.where(np.abs(y3 - F) <= 1, 0.5 * (y3 - F) ** 2, np.abs(y3 - F) - 0.5)), lambda F: np.clip(y3 - F, -1, 1)),
    "Пуассон": (lambda F: np.sum(np.exp(F) - y3 * F), lambda F: y3 - np.exp(F)),
}
for name, (L, r) in LOSSES.items():
    print(f"{name:11} псевдо-остатки {r(F3).round(4)}")
    assert np.allclose(r(F3), -grad_num(L, F3), atol=1e-5)
yb = np.array([1.0, 0.0, 1.0, 1.0])
LL = lambda F: np.sum(yb * np.log1p(np.exp(-F)) + (1 - yb) * np.log1p(np.exp(F)))  # noqa: E731
assert np.allclose(yb - 0.5, -grad_num(LL, np.zeros(4)), atol=1e-8)
print("log-loss, y = (1, 0, 1, 1), F = 0: y − p =", yb - 0.5, "; лист Ньютона −G/H =", -(0.5 - yb).sum() / (4 * 0.25))

# 2. Пень как проекция
X, y = datasets.toy_regression()
x = X[:, 0]
F0 = np.full(6, y.mean())
r = y - F0
best = None
for thr in (x[:-1] + x[1:]) / 2:
    h = np.where(x <= thr, r[x <= thr].mean(), r[x > thr].mean())
    if best is None or np.sum((r - h) ** 2) < best[0]:
        best = (np.sum((r - h) ** 2), thr, h)
_, thr, h = best
cos = h @ r / np.linalg.norm(h) / np.linalg.norm(r)
print(f"антиградиент {r}, лучший порог {thr}, шаг дерева {h}")
print(f"cos(h, −g) = {cos:.4f} ({np.degrees(np.arccos(cos)):.1f}°), (r − h)·h = {(r - h) @ h:.1e}, потери {0.5 * r @ r} → {0.5 * np.sum((r - h) ** 2)}")
assert thr == 3.5 and abs(cos - 0.9186) < 1e-4 and abs((r - h) @ h) < 1e-12 and 0.5 * np.sum((r - h) ** 2) == 5.0

# 3. Потери по шагам: gbcourse против scikit-learn
loss = lambda F: 0.5 * np.sum((y - F) ** 2)  # noqa: E731
curves = {}
for nu in (1.0, 0.5):
    ours = [loss(F0)] + [loss(GBRegressor(n_estimators=M, learning_rate=nu, max_depth=1).fit(X, y).predict(X)) for M in range(1, 9)]
    sk = GradientBoostingRegressor(n_estimators=8, learning_rate=nu, max_depth=1).fit(X, y)
    assert np.allclose(ours, [loss(F0)] + [loss(p) for p in sk.staged_predict(X)], atol=1e-9)
    curves[nu] = ours
    print(f"ν = {nu}: потери {np.round(ours, 3)} (совпадает с scikit-learn)")

# 4. Гессиан softmax в XGBoost
ym = np.array([0, 0, 0, 0, 1, 1, 2, 2, 2, 0])
Xm = np.arange(10, dtype=float).reshape(-1, 1)
P = np.full((10, 3), 1 / 3)
G, Hd = (P - np.eye(3)[ym]).sum(0), (P * (1 - P)).sum(0)
m = xgb.XGBClassifier(n_estimators=1, max_depth=1, learning_rate=1.0, reg_lambda=1.0, gamma=1e6, min_child_weight=0,
                      objective="multi:softprob", tree_method="exact")
m.fit(Xm, ym, base_margin=np.zeros((10, 3)))
leaves = np.array([float(s.split("leaf=")[1].split(",")[0]) for s in m.get_booster().get_dump(with_stats=True)])
print("XGBoost", xgb.__version__, "листья", leaves.round(6), "; −G/(H + λ) с h = p(1 − p):", (-G / (Hd + 1)).round(6), "; с h = 2p(1 − p):", (-G / (2 * Hd + 1)).round(6))
assert np.allclose(leaves, -G / (2 * Hd + 1), atol=1e-6)

fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(17, 4.6))
a1.scatter(x, y, color=MUTED, zorder=3, label="цены")
a1.plot(x, F0, "o", mfc="white", color=BLUE, label="прогноз F₀ = 6")
for xi, Fi, ri in zip(x, F0, r):
    a1.annotate("", (xi, Fi + 0.92 * ri), (xi, Fi), arrowprops=dict(arrowstyle="->", color=ORANGE, lw=1.6))
grid = np.linspace(0.5, 6.5, 300)
a1.step(grid, y.mean() + np.where(grid <= thr, h[0], h[-1]), where="mid", color=BLUE, label="F₁(x) после пня")
a1.set(title="Антиградиент (стрелки) и шаг деревом", xlabel="площадь x", ylabel="цена")
a1.legend()
idx = np.arange(1, 7)
a2.bar(idx - 0.18, r, width=0.36, color=MUTED, label="−g = y − F")
a2.bar(idx + 0.18, h, width=0.36, color=ORANGE, label="шаг пня h(xᵢ)")
a2.axhline(0, color="black", lw=0.8)
a2.set(title=f"Пень — проекция антиградиента, cos = {cos:.3f}", xlabel="квартира i")
a2.legend()
for nu, c in [(1.0, BLUE), (0.5, ORANGE)]:
    a3.plot(curves[nu], "o-", color=c, label=f"ν = {nu}")
a3.set(title="Потери ½Σ(y − F)² по шагам бустинга", xlabel="число деревьев", yscale="log")
a3.legend()
plt.tight_layout()
ex.finish(fig, "boosting_functional_gradient")
