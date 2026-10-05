"""Значение Шепли и теория игр в ML: аксиомы, индексы власти, SHAP, TreeSHAP, AdaBoost, аукционы.

Запуск:  python lessons/lesson_15_21/examples/shapley_and_ml.py [--save] [--no-show]

1) Значения Шепли перебором порядков и формулой через коалиции; ядро.
2) Индексы власти Шепли — Шубика и Банцафа: [51; 49, 49, 2], Совет ЕЭС 1958, Совбез ООН.
3) SHAP как интервенционная игра; сверка с shap.Exact (если библиотека установлена).
4) TreeSHAP бустинга gbcourse: аддитивность по деревьям, сверка с TreeSHAP для scikit-learn.
5) AdaBoost: веса — экспоненты отступов (Hedge противника), ошибка и граница; аукционы и резервная цена.
"""

import math
import sys
from fractions import Fraction as F
from itertools import combinations, permutations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import AdaBoost, GBRegressor, datasets, explain
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE, SERIES

ex = Example(__file__)


def shapley_orders(v, n):
    phi = [F(0)] * n
    for order in permutations(range(n)):
        S = set()
        for j in order:
            phi[j] += F(v(S | {j}) - v(S), math.factorial(n))
            S.add(j)
    return phi


def shapley_coalitions(v, n):
    return [sum(F(math.factorial(k) * math.factorial(n - k - 1), math.factorial(n)) * (v(set(S) | {j}) - v(set(S)))
                for k in range(n) for S in combinations([i for i in range(n) if i != j], k)) for j in range(n)]


# 1. Шепли
games = {
    "перчатки": (lambda S: 1 if 0 in S and (1 in S or 2 in S) else 0, 3),
    "аэропорт": (lambda S: max([0] + [[1, 2, 3][i] for i in S]), 3),
    "такси": (lambda S: max([0] + [[6, 10, 15][i] for i in S]), 3),
    "f = x₁ + 2x₂ + 3x₁x₃": (lambda S: (0 in S) + 2 * (1 in S) + 3 * (0 in S) * (2 in S), 4),
}
for name, (v, n) in games.items():
    a, b = shapley_orders(v, n), shapley_coalitions(v, n)
    assert a == b and sum(a) == v(set(range(n))) - v(set())
    print(f"1) {name:22}: φ = {[str(x) for x in a]}")
assert shapley_orders(*games["такси"]) == [2, 4, 9]
sav = lambda S: sum([6, 10, 15][i] for i in S) - max([0] + [[6, 10, 15][i] for i in S])
phi_sav = shapley_orders(sav, 3)
assert phi_sav == [4, 6, 6] and phi_sav[0] + phi_sav[1] >= 6 and phi_sav[1] + phi_sav[2] >= 10
print("   такси, экономия: Шепли (4; 6; 6) лежит в ядре")


# 2. Индексы власти
def power(w, q):
    n = len(w)
    ss, bz = [F(0)] * n, [0] * n
    for j in range(n):
        for k in range(n):
            for S in combinations([i for i in range(n) if i != j], k):
                s = sum(w[i] for i in S)
                if s < q <= s + w[j]:
                    ss[j] += F(math.factorial(k) * math.factorial(n - k - 1), math.factorial(n))
                    bz[j] += 1
    return ss, np.array(bz) / sum(bz)


eec_w = [4, 4, 4, 2, 2, 1]
for name, w, q in [("[51; 49, 49, 2]", [49, 49, 2], 51), ("ЕЭС 1958", eec_w, 12)]:
    ss, bz = power(w, q)
    print(f"2) {name}: Шепли — Шубик {[str(x) for x in ss]}, Банцаф {bz.round(3)}")
ss_eec, bz_eec = power(eec_w, 12)
assert ss_eec == [F(7, 30)] * 3 + [F(3, 20)] * 2 + [0]
ss_un, _ = power([7] * 5 + [1] * 10, 39)
print(f"   Совбез ООН: постоянный {float(ss_un[0]):.4f}, непостоянный {float(ss_un[5]):.5f}")

# 3. SHAP
rng = Mulberry32(38)
bg = []
for _ in range(200):
    a_, b_, c_ = rng.normal(), rng.normal(), rng.normal()
    bg.append([a_, 0.8 * a_ + 0.6 * b_, c_])
bg = np.array(bg)
x0 = np.array([1.5, 1.0, -0.5])
f = lambda X: X[:, 0] * X[:, 1] + X[:, 2]


def v_int(S, bg=bg):
    Z = bg.copy()
    Z[:, list(S)] = x0[list(S)]
    return f(Z).mean()


phi = np.array([float(sum(math.factorial(k) * math.factorial(2 - k) / 6 * (v_int(S + (j,)) - v_int(S))
                          for k in range(3) for S in combinations([i for i in range(3) if i != j], k))) for j in range(3)])
print(f"3) SHAP f = x₁x₂ + x₃: база {v_int(()):.4f}, φ = {phi.round(4)}, база + Σφ = {v_int(()) + phi.sum():.4f}")
assert abs(v_int(()) + phi.sum() - f(x0[None])[0]) < 1e-12
try:
    import shap

    sv = shap.explainers.Exact(lambda X: f(np.asarray(X)), shap.maskers.Independent(bg, max_samples=200))(x0[None]).values[0]
    assert np.allclose(sv, phi, atol=1e-9)
    print("   shap.Exact совпадает")
except ImportError:
    print("   shap не установлен — сверка пропущена")

# 4. TreeSHAP бустинга
X, y = datasets.friedman1(n=300, noise=1.0, seed=7, n_features=5)
model = GBRegressor(n_estimators=40, learning_rate=0.2, max_depth=2).fit(X, y)
base, phi_m = explain.shapley_values(model, X[0])
per_tree = model.learning_rate * sum(explain.shapley_values(st[0], X[0])[1] for st in model.trees_)
print(f"4) TreeSHAP: φ = {phi_m.round(3)}, расхождение с суммой по деревьям {np.abs(phi_m - per_tree).max():.1e}")
assert np.allclose(phi_m, per_tree, atol=1e-12) and abs(base + phi_m.sum() - model.predict(X[:1])[0]) < 1e-9
try:
    import shap
    from sklearn.ensemble import GradientBoostingRegressor

    sk = GradientBoostingRegressor(n_estimators=40, learning_rate=0.2, max_depth=2, random_state=0).fit(X, y)
    assert np.allclose(shap.TreeExplainer(sk).shap_values(X[:1])[0], phi_m, atol=1e-6)
    print("   TreeSHAP для такой же модели scikit-learn совпадает")
except ImportError:
    pass

# 5. AdaBoost и аукционы
rng = Mulberry32(21)
xs = sorted(rng.uniform(0, 10) for _ in range(40))
ys = []
for xi in xs:
    yi = 1 if 3 < xi < 7 else 0
    ys.append(1 - yi if rng.random() < 0.08 else yi)
Xa, ya = np.array(xs)[:, None], np.array(ys)
ada = AdaBoost(n_estimators=40, max_depth=1).fit(Xa, ya)
s = np.where(ya == 1, 1, -1)
errs, bound = [], []
for m in range(1, len(ada.trees_) + 1):
    Fm = ada.decision_function(Xa, m)
    errs.append(np.mean((Fm > 0) != (ya == 1)))
    e = np.array(ada.errors_[:m])
    bound.append(np.prod(2 * np.sqrt(e * (1 - e))))
    w = np.exp(-s * Fm)
    assert np.allclose(w / w.sum(), ada.weights_[m])
print(f"5) AdaBoost: ошибка после 1, 3, 40 раундов: {errs[0]}, {errs[2]}, {errs[-1]}; веса = exp(−отступ)/Z — проверено")
R = lambda n, r: (n - 1) / (n + 1) + r**n - 2 * n * r ** (n + 1) / (n + 1)
print(f"   аукцион, n = 3: доход без резерва {R(3, 0):.4f}, с резервом 1/2 {R(3, 0.5):.4f}")
assert abs(R(3, 0.5) - 17 / 32) < 1e-12

fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.2))
xx = np.arange(len(eec_w))
a1.bar(xx - 0.27, np.array(eec_w) / sum(eec_w), width=0.27, color=MUTED, label="доля голосов")
a1.bar(xx, [float(v) for v in ss_eec], width=0.27, color=BLUE, label="Шепли — Шубик")
a1.bar(xx + 0.27, bz_eec, width=0.27, color=ORANGE, label="Банцаф")
a1.set_xticks(xx, ["Франция", "ФРГ", "Италия", "Бельгия", "Нидерл.", "Люксемб."], fontsize=8)
a1.set(title="Совет ЕЭС, 1958: вес ≠ власть", ylabel="доля")
a1.legend(fontsize=8)
r_ = np.arange(1, len(errs) + 1)
a2.plot(r_, ada.errors_, color=SERIES[1], label="εₘ — ошибка пня на весах")
a2.plot(r_, errs, color=BLUE, lw=2, label="ошибка ансамбля")
a2.plot(r_, bound, color=MUTED, ls="--", label="граница Π 2√(ε(1 − ε))")
a2.set(xlabel="раунд", ylim=(0, 0.6), title="AdaBoost как игра с противником")
a2.legend(fontsize=8)
ex.finish(fig, "shapley_and_ml")
