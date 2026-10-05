"""Бустинг на языке линейной алгебры: листья — проекции, выигрыш — квадрат длины проекции, лист Ньютона и λ.

Запуск:  python lessons/lesson_15_12/examples/boosting_as_projections.py [--save] [--no-show]

1) Пень проецирует антиградиент r = y − 6 на индикаторы листьев: листья — средние, ‖r‖² = ‖h‖² + ‖r − h‖².
2) Выигрыш разбиения Σ Gⱼ²/nⱼ: пороги 19.2, 27, 54, 48, 30; с λ = 1 у порога 3.5 — 40.5. Сверка с gbcourse и sklearn.
3) Бустинг — цепочка проекций: ‖r‖² падает на (2ν − ν²)·‖P r‖²; сверка с GBRegressor при ν = 1, 0.5, 0.1.
4) Лист XGBoost −G/(H + λ) — взвешенное среднее рабочих ответов −gᵢ/hᵢ; ансамбль — линейная модель на индикаторах листьев.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.boosting import GBRegressor
from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)
fig, axes = plt.subplots(2, 2, figsize=(12, 9))
X1, y = datasets.toy_regression()
x = X1[:, 0]
THR = (1.5, 2.5, 3.5, 4.5, 5.5)

# 1. Пень — проекция
r = y - y.mean()
L = np.c_[x <= 3.5, x > 3.5].astype(float)
theta = np.linalg.solve(L.T @ L, L.T @ r)
h = L @ theta
print(f"1) LᵀL = {np.diag(L.T @ L)}, Lᵀr = {L.T @ r}, листья {theta}; ‖r‖² {r @ r} = ‖h‖² {h @ h} + ‖r − h‖² {(r - h) @ (r - h)}")
assert np.allclose(theta, [-3, 3]) and (r @ r, h @ h, (r - h) @ (r - h)) == (64.0, 54.0, 10.0)
stump = GBRegressor(n_estimators=1, learning_rate=1.0, max_depth=1).fit(X1, y)
assert np.allclose(stump.predict(X1), 6 + h)
ax = axes[0, 0]
ax.bar(x - 0.18, r, 0.36, color=MUTED, label="r — антиградиент")
ax.bar(x + 0.18, r - h, 0.36, color=ORANGE, label="r − h после пня")
ax.step([0.5, 3.5, 6.5], [theta[0], theta[1], theta[1]], where="post", color=BLUE, lw=2.2, label="пень h — проекция")
ax.axhline(0, color=MUTED, lw=1)
ax.set(xlabel="квартира", title="пень: проекция r на ступеньки")
ax.legend(fontsize=8)

# 2. Выигрыш разбиений
gains = {}
for lam in (0, 1):
    gains[lam] = [sum((r[m].sum()) ** 2 / (m.sum() + lam) for m in (x <= t, x > t)) for t in THR]
    print(f"2) λ = {lam}: выигрыши {np.round(gains[lam], 3)}")
assert np.allclose(gains[0], [19.2, 27, 54, 48, 30]) and np.isclose(gains[1][2], 40.5)
from sklearn.tree import DecisionTreeRegressor

assert DecisionTreeRegressor(max_depth=1).fit(X1, r).tree_.threshold[0] == 3.5
ax = axes[0, 1]
ax.bar(np.array(THR) - 0.15, gains[0], 0.3, color=BLUE, label="λ = 0")
ax.bar(np.array(THR) + 0.15, gains[1], 0.3, color=ORANGE, label="λ = 1")
ax.set(xlabel="порог", ylabel="Σ Gⱼ²/(nⱼ + λ)", title="выигрыш = квадрат длины проекции")
ax.legend()


# 3. Цепочка проекций
def boost(nu, M):
    F = np.full(6, y.mean())
    hist = [((y - F) ** 2).sum()]
    for _ in range(M):
        rr = y - F
        best = max((np.where(x <= t, rr[x <= t].mean(), rr[x > t].mean()) for t in THR), key=lambda hh: hh @ hh)
        assert np.isclose(((rr - nu * best) ** 2).sum(), (rr @ rr) - (2 * nu - nu * nu) * (best @ best))
        F = F + nu * best
        hist.append(((y - F) ** 2).sum())
    return np.array(hist), F


ax = axes[1, 0]
for nu, col in ((1.0, MUTED), (0.5, BLUE), (0.1, ORANGE)):
    hist, F = boost(nu, 30)
    gb = GBRegressor(n_estimators=30, learning_rate=nu, max_depth=1).fit(X1, y)
    print(f"3) ν = {nu}: ‖r‖² {hist[[1, 2, 3, 10]].round(4)}; gbcourse после 30 деревьев совпадает: {np.allclose(gb.predict(X1), F)}")
    assert np.allclose(gb.predict(X1), F)
    ax.semilogy(hist, color=col, label=f"ν = {nu}")
ax.set(xlabel="деревьев m", ylabel=r"$\Vert r_m \Vert^2$", title="бустинг пнями: убывание при 0 < ν < 2")
ax.legend()

# 4. Лист Ньютона и XGBoost; ансамбль на индикаторах листьев
F0, yy = np.array([2, 0.5, -0.5, 1.0]), np.array([1, 1, 0, 0.0])
p = 1 / (1 + np.exp(-F0))
g, hs = p - yy, p * (1 - p)
z = -g / hs
leaf = {lam: -g.sum() / (hs.sum() + lam) for lam in (0, 1)}
print(f"4) рабочие ответы {z.round(3)}, веса {hs.round(3)}; лист λ=0: {leaf[0]:.4f}, λ=1: {leaf[1]:.4f}")
assert np.isclose(leaf[0], (hs * z).sum() / hs.sum())
try:
    import xgboost as xgb

    for lam in (0, 1):
        dm = xgb.DMatrix(np.zeros((4, 1)), label=yy, base_margin=F0)
        bst = xgb.train({"objective": "binary:logistic", "eta": 1, "lambda": lam, "max_depth": 1, "min_child_weight": 0}, dm, 1)
        w_x = (bst.predict(dm, output_margin=True) - F0)[0]
        print(f"   XGBoost λ = {lam}: лист {w_x:.4f}")
        assert abs(w_x - leaf[lam]) < 1e-5
    Xr, yr = datasets.friedman1(n=300, seed=3)
    bst = xgb.train({"max_depth": 3, "eta": 0.3, "base_score": 0.0}, xgb.DMatrix(Xr, label=yr), 20)
    leaves = bst.predict(xgb.DMatrix(Xr), pred_leaf=True).astype(int)
    Phi = np.concatenate([np.eye(leaves[:, t].max() + 1)[leaves[:, t]] for t in range(leaves.shape[1])], axis=1)
    pred = bst.predict(xgb.DMatrix(Xr))
    th = np.linalg.lstsq(Phi, pred, rcond=None)[0]
    print(f"   XGBoost: Φ {Phi.shape}, линейная модель на индикаторах воспроизводит прогнозы с точностью {np.abs(Phi @ th - pred).max():.1e}")
    assert np.abs(Phi @ th - pred).max() < 1e-4
except ImportError:
    print("   xgboost не установлен — сверку пропускаем")
ax = axes[1, 1]
order = np.argsort(z)
ax.bar(np.arange(4), z[order], width=hs[order] * 3.2, color=[ORANGE if yy[i] else BLUE for i in order], alpha=0.6)
ax.axhline(leaf[0], color=BLUE, lw=2, label=f"лист −G/H = {leaf[0]:.3f}")
ax.axhline(leaf[1], color=BLUE, lw=2, ls="--", label=f"с λ = 1: {leaf[1]:.3f}")
ax.axhline((-g).mean(), color=MUTED, ls=":", label=f"среднее −g = {(-g).mean():.3f}")
ax.set(xticks=[], ylabel="рабочий ответ −g/h", title="лист Ньютона — взвешенное среднее (ширина ∝ h)")
ax.legend(fontsize=8)
ex.finish(fig, "boosting_as_projections")
