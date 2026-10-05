"""Логика взаимодействий в бустинге: пни и XOR, симметрия, чётность и глубина деревьев.

Запуск:  python lessons/lesson_15_19/examples/boosting_interactions.py [--save] [--no-show]

1) Ансамбль пней аддитивен: F00 + F11 − F01 − F10 = 0, поэтому AND выражается, а XOR — нет.
2) Идеально сбалансированный XOR: деревья глубины 2 не делают ни одного разбиения в gbcourse, XGBoost
   и LightGBM (выигрыш корня ровно 0), а sklearn делит; один лишний объект ломает симметрию.
3) Чётность k из p двоичных признаков: точность жадного дерева в зависимости от глубины (рисунок).
"""

import sys
import warnings
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np
import xgboost as xgb
from sklearn.ensemble import GradientBoostingClassifier

from gbcourse.boosting import GBClassifier
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, ORANGE
from gbcourse.tree import RegressionTree

warnings.filterwarnings("ignore")
ex = Example(__file__)
cells = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], float)


def data(f, extra=0):
    X = np.array([[a, b] for a in (0, 1) for b in (0, 1) for _ in range(25 + (extra if a and b else 0))], float)
    return X, np.array([f(int(a), int(b)) for a, b in X])


# 1. Пни
print("1) пни (100 деревьев, темп 0.3): F по клеткам 00, 01, 10, 11")
for name, f in [("AND", lambda a, b: a & b), ("OR", lambda a, b: a | b), ("XOR", lambda a, b: a ^ b)]:
    X, y = data(f)
    m = GBClassifier(n_estimators=100, learning_rate=0.3, max_depth=1).fit(X, y)
    F = m.predict_raw(cells)
    c = F[0] + F[3] - F[1] - F[2]
    acc = (m.predict(X) == y).mean()
    print(f"   {name}: F = {np.round(F, 2)}, взаимодействие {c:+.1e}, точность {acc:.2f}")
    assert abs(c) < 1e-9
    assert acc == (0.5 if name == "XOR" else 1.0)

# 2. Симметрия
print("\n2) XOR, деревья глубины 2: точность")
for extra in (0, 1):
    X, y = data(lambda a, b: a ^ b, extra)
    res = {
        "gbcourse": (GBClassifier(n_estimators=100, learning_rate=0.3, max_depth=2).fit(X, y).predict(X) == y).mean(),
        "XGBoost": (xgb.XGBClassifier(n_estimators=100, learning_rate=0.3, max_depth=2).fit(X, y).predict(X) == y).mean(),
        "LightGBM": (lgb.LGBMClassifier(n_estimators=100, learning_rate=0.3, max_depth=2, num_leaves=4, min_child_samples=1, verbose=-1).fit(X, y).predict(X) == y).mean(),
        "sklearn": GradientBoostingClassifier(n_estimators=100, learning_rate=0.3, max_depth=2).fit(X, y).score(X, y),
    }
    print(f"   лишних объектов в (1, 1): {extra} →", {k: round(float(v), 3) for k, v in res.items()})
    if extra == 0:
        assert res["gbcourse"] == res["XGBoost"] == res["LightGBM"] == 0.5 and res["sklearn"] == 1.0
    else:
        assert min(res.values()) == 1.0

# 3. Чётность и глубина
p, n = 6, 400
curves = {}
for k in (1, 2, 3):
    rng = Mulberry32(5)
    mk = lambda m, rng=rng: np.array([[int(rng.random() < 0.5) for _ in range(p)] for _ in range(m)], float)
    Xtr, Xte = mk(n), mk(1000)
    lab = lambda Z, k=k: (Z[:, :k].sum(axis=1) % 2).astype(float)
    ytr, yte = lab(Xtr), lab(Xte)
    curves[k] = []
    for d in range(1, 9):
        t = RegressionTree(max_depth=d).fit(Xtr, -ytr, np.ones(n))
        curves[k].append(((t.predict(Xte) >= 0.5) == yte).mean())
        if d == 2:
            root = t.nodes[0].feature + 1
    print(f"\n3) k = {k}: корень x{root}; точность на тесте по глубинам 1…8:", np.round(curves[k], 3).tolist())
assert curves[1][0] == 1.0 and curves[2][1] < 0.6 and curves[2][5] == 1.0 and curves[3][3] < 0.6 and curves[3][5] > 0.95

fig, ax = plt.subplots(figsize=(9, 4.4))
for k, col in zip((1, 2, 3), (BLUE, ORANGE, AQUA)):
    ax.plot(range(1, 9), curves[k], marker="o", color=col, lw=2, label=f"чётность {k} признаков")
ax.axhline(0.5, color="#898781", ls="--", lw=1)
ax.set(xlabel="глубина дерева", ylabel="точность на тесте", ylim=(0.4, 1.03),
       title="Жадное дерево и чётность: нужна глубина больше числа значимых признаков")
ax.legend()
ex.finish(fig, "parity_depth")
