"""Второй порядок в бустинге: значение листа −G/(H + λ), прирост разбиения и сверка с XGBoost.

Запуск:  python lessons/lesson_15_7/examples/xgboost_newton_leaves.py [--save] [--no-show]

1) Лист с классами 1, 1, 0: шаг Ньютона 0.667 при точном оптимуме ln 2, повторные шаги сходятся
квадратично. 2) Восемь объектов: приросты всех порогов по формуле и дерево XGBoost глубины 1 — те же
листья, а gain в отчёте XGBoost ровно в 2 раза больше (без множителя ½). 3) Бустинг одного числа:
лист из среднего остатка против ньютоновского листа.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
import xgboost as xgb

from gbcourse.boosting import GradientBoosting
from gbcourse.cli import Example
from gbcourse.losses import get_loss
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)
ll = get_loss("logistic")
sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731

# 1. Лист из трёх объектов
y3 = np.array([1.0, 1, 0])
w, its = 0.0, []
for _ in range(4):
    its.append(w)
    F = np.full(3, w)
    w -= ll.gradient(y3, F).sum() / ll.hessian(y3, F).sum()
print("лист 1, 1, 0: шаги Ньютона", np.round(its, 10), "→ ln 2 =", round(math.log(2), 10))
assert abs(its[1] - 2 / 3) < 1e-12 and abs(its[3] - math.log(2)) < 1e-8
for lam in (0, 1, 5):
    print(f"   λ = {lam}: w = −G/(H + λ) = {0.5 / (0.75 + lam):.4f}")

# 2. Прирост разбиения и XGBoost
X = np.arange(1, 9, dtype=float).reshape(-1, 1)
y = np.array([0, 0, 1, 0, 1, 1, 1, 1])
lam = 1.0
g, h = 0.5 - y, np.full(8, 0.25)
G, H = g.sum(), h.sum()
sc = lambda a, b: a**2 / (b + lam)  # noqa: E731
gains = [0.5 * (sc(g[:t].sum(), h[:t].sum()) + sc(G - g[:t].sum(), H - h[:t].sum()) - sc(G, H)) for t in range(1, 8)]
t_best = int(np.argmax(gains)) + 1
wL, wR = -g[:t_best].sum() / (h[:t_best].sum() + lam), -(G - g[:t_best].sum()) / (H - h[:t_best].sum() + lam)
print("приросты порогов 1.5…7.5:", np.round(gains, 4), f"→ лучший x < {t_best + 0.5}, листья {wL:+.3f} и {wR:+.3f}")
m = xgb.XGBClassifier(n_estimators=1, max_depth=1, learning_rate=1.0, reg_lambda=lam, base_score=0.5,
                      min_child_weight=0, tree_method="exact").fit(X, y)
dump = m.get_booster().get_dump(with_stats=True)[0]
xgb_gain = float(dump.split("gain=")[1].split(",")[0])
leaves = np.unique(m.predict(X, output_margin=True))
print(dump.strip())
print(f"XGBoost: листья {leaves}, gain {xgb_gain:.4f} = 2 × {gains[t_best - 1]:.4f}")
assert np.allclose(sorted(leaves), sorted([wL, wR]), atol=1e-6)
assert abs(xgb_gain - 2 * gains[t_best - 1]) < 1e-5

# gbcourse (mode="newton") строит то же дерево, начиная с логарифма шансов ȳ
gb = GradientBoosting(loss="logistic", mode="newton", n_estimators=1, learning_rate=1.0, max_depth=1, reg_lambda=lam).fit(X, y)
p0 = sig(gb.init_)
gg = p0 - y
hh = np.full(8, p0 * (1 - p0))
expect = sorted([-gg[:4].sum() / (hh[:4].sum() + lam), -gg[4:].sum() / (hh[4:].sum() + lam)])
got = sorted(np.unique(np.round(gb.predict_raw(X) - gb.init_, 12)))
print("gbcourse: листья", np.round(got, 6), "= формула", np.round(expect, 6))
assert np.allclose(got, expect, atol=1e-10)

# 3. Бустинг одного числа
yb = np.array([1.0] * 8 + [0] * 2)
F_opt = math.log(4)
tr = {"первый порядок": [0.0], "Ньютон": [0.0]}
for _ in range(12):
    for name in tr:
        Fk = tr[name][-1]
        p = sig(Fk)
        tr[name].append(Fk + ((yb - p).mean() if name == "первый порядок" else (yb - p).sum() / (10 * p * (1 - p))))
for name, t in tr.items():
    print(f"{name:15} |F − ln 4|: {' '.join(f'{abs(v - F_opt):.1e}' for v in t[:6])}")
assert abs(tr["Ньютон"][4] - F_opt) < 1e-9 and abs(tr["первый порядок"][7] - F_opt) > 0.2

fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(16.5, 4.4))
ws = np.linspace(-1.5, 3, 300)
Lw = np.array([ll.loss(y3, np.full(3, v)) * 3 for v in ws])
a1.plot(ws, Lw, color=BLUE, lw=2.4, label="Σ log-loss листа")
a1.plot(ws, ll.loss(y3, np.zeros(3)) * 3 - 0.5 * ws + 0.375 * ws**2, "--", color=VIOLET, label="парабола G·w + ½H·w²")
a1.axvline(2 / 3, color=VIOLET, ls=":", lw=1.2)
a1.axvline(math.log(2), color=ORANGE, ls=":", lw=1.2)
a1.set(title="Лист 1, 1, 0: Ньютон 0.667, оптимум ln 2", xlabel="значение листа w", ylim=(1.7, 3.3))
a1.legend()
a2.bar(np.arange(1.5, 8.5), gains, width=0.6, color=[ORANGE if i == t_best - 1 else BLUE for i in range(7)])
a2.axhline(0, color=MUTED, lw=0.8)
a2.set(title="Приросты порогов, λ = 1 (в XGBoost ×2)", xlabel="порог x <", ylabel="Gain")
for (name, t), col in zip(tr.items(), [AQUA, VIOLET]):
    a3.semilogy(np.maximum(np.abs(np.array(t) - F_opt), 1e-16), "o-", color=col, label=name)
a3.set(title="Бустинг одного числа: |F − F*|", xlabel="шаг", ylim=(1e-16, 10))
a3.legend()
ex.finish(fig, "xgboost_newton_leaves")
