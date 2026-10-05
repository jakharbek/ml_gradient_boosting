"""Теория информации в бустинге: log-loss в битах, предел H(Y|X), прирост информации и Джини, признаки-идентификаторы.

Запуск:  python lessons/lesson_15_16/examples/information_in_boosting.py [--save] [--no-show]

1) Бустинг (gbcourse, сверка с scikit-learn) на задаче с известной p(x): от H(Y) к пределу H(Y|X) и ниже на обучении.
2) Прирост информации = снижение log-loss разбиения; выигрыш Ньютона первого дерева ∝ снижению Джини; сверка
   с DecisionTreeClassifier и первым деревом XGBoost.
3) Признак с множеством случайных значений: смещение прироста информации и gain ratio.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import log_loss
from sklearn.tree import DecisionTreeClassifier

from gbcourse.boosting import GradientBoosting
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)
LN2 = math.log(2)


def h(p):
    p = np.asarray(p, float)
    out = np.where((p > 0) & (p < 1), -p * np.log2(np.clip(p, 1e-300, 1)) - (1 - p) * np.log2(np.clip(1 - p, 1e-300, 1)), 0.0)
    return float(out) if out.ndim == 0 else out


# 1. Бустинг в битах
def p_fun(t):
    return 1 / (1 + np.exp(-4 * np.sin(3 * np.pi * t)))


def data(n, seed):
    rng, X, y = Mulberry32(seed), [], []
    for _ in range(n):
        t = rng.random()
        X.append([t])
        y.append(1 if rng.random() < p_fun(t) else 0)
    return np.array(X), np.array(y)


X, y = data(300, 7)
Xv, yv = data(2000, 1007)
grid = (np.arange(20000) + 0.5) / 20000
HY, floor = h(p_fun(grid).mean()), h(p_fun(grid)).mean()
curves = {}
for depth in (1, 3):
    gb = GradientBoosting(loss="logistic", n_estimators=300, learning_rate=0.1, max_depth=depth).fit(X, y, eval_set=(Xv, yv))
    curves[depth] = (np.array(gb.history_["train"]) / LN2, np.array(gb.history_["eval"]) / LN2)
    tr, va = curves[depth]
    print(f"глубина {depth}: лучшее m = {va.argmin()} ({va.min():.3f} бит), обучение при m = 300: {tr[-1]:.3f}")
print(f"H(Y) = {HY:.3f}, предел H(Y|X) = {floor:.3f}, I(X;Y) = {HY - floor:.3f} бит")
assert curves[3][1].argmin() == 30 and curves[3][0][60] < floor
sk = GradientBoostingClassifier(n_estimators=300, learning_rate=0.1, max_depth=3).fit(X, y)
va_sk = np.array([log_loss(yv, pr[:, 1]) for pr in sk.staged_predict_proba(Xv)]) / LN2
assert np.abs(va_sk - curves[3][1][1:]).max() < 1e-9
print("кривая gbcourse совпадает с scikit-learn")


# 2. Прирост информации, log-loss, Джини, Ньютон
def split_data(seed):
    rng, pts = Mulberry32(seed), []
    for _ in range(40):
        xv = rng.uniform(0, 10)
        pr = 0.15 if xv < 3 else 0.75 if xv < 6.5 else 0.3
        pts.append((xv, 1 if rng.random() < pr else 0))
    pts.sort()
    return np.array([a for a, _ in pts]), np.array([b for _, b in pts])


xs, ys = split_data(53)
cands = (xs[1:] + xs[:-1]) / 2
n, p0 = len(ys), ys.mean()
ig, dll, gini, newton = [], [], [], []
for t in cands:
    L, R = ys[xs <= t], ys[xs > t]
    ig.append(h(p0) - len(L) / n * h(L.mean()) - len(R) / n * h(R.mean()))
    pred = np.where(xs <= t, L.mean(), R.mean())
    dll.append((log_loss(ys, np.full(n, p0)) - log_loss(ys, np.clip(pred, 1e-15, 1 - 1e-15))) / LN2)
    gini.append(2 * p0 * (1 - p0) - sum(len(c) / n * 2 * c.mean() * (1 - c.mean()) for c in (L, R)))
    newton.append(0.5 * sum((len(c) * p0 - c.sum()) ** 2 / (len(c) * p0 * (1 - p0)) for c in (L, R)))
ig, dll, gini, newton = map(np.array, (ig, dll, gini, newton))
assert np.allclose(ig, dll, atol=1e-9) and np.allclose(newton, n * gini / (4 * p0 * (1 - p0)), atol=1e-9)
t_e, t_g = cands[ig.argmax()], cands[gini.argmax()]
te = DecisionTreeClassifier(criterion="entropy", max_depth=1).fit(xs[:, None], ys).tree_.threshold[0]
tg = DecisionTreeClassifier(criterion="gini", max_depth=1).fit(xs[:, None], ys).tree_.threshold[0]
print(f"зерно 53: энтропия → {t_e:.3f} (sklearn {te:.3f}), Джини и Ньютон → {t_g:.3f} (sklearn {tg:.3f})")
assert abs(t_e - te) < 1e-6 and abs(t_g - tg) < 1e-6 and abs(t_e - t_g) > 1   # sklearn хранит пороги во float32
try:
    import xgboost as xgb

    dump = xgb.XGBClassifier(n_estimators=1, max_depth=1, learning_rate=1.0, reg_lambda=0.0, min_child_weight=0.0, tree_method="exact",
                             base_score=float(p0)).fit(xs[:, None], ys).get_booster().get_dump()[0]
    thr = float(dump.split("<")[1].split("]")[0])
    print(f"первое дерево XGBoost: порог {thr:.3f} — как у Джини")
    assert abs(thr - t_g) < 0.01
except ImportError:
    print("xgboost не установлен — сверку пропускаем")

# 3. Признаки с множеством значений
n_obj, R = 200, 200
KS = [2, 4, 8, 16, 32, 64, 128]
rng = Mulberry32(33 + n_obj)
res = {K: [] for K in KS}


def gain(cat, yy, K):
    cnt, ones = np.bincount(cat, minlength=K), np.bincount(cat, yy, minlength=K)
    m = cnt > 0
    g = h(yy.mean()) - (cnt[m] / len(yy) * h(ones[m] / cnt[m])).sum()
    return g, g / -(cnt[m] / len(yy) * np.log2(cnt[m] / len(yy))).sum()


for _ in range(R):
    a = []
    yy = []
    for _ in range(n_obj):
        v = 1 if rng.random() < 0.5 else 0
        a.append(v)
        yy.append(v if rng.random() < 0.7 else 1 - v)
    a, yy = np.array(a), np.array(yy)
    gi = gain(a, yy, 2)
    for K in KS:
        res[K].append(gain(np.array([rng.randint(K) for _ in range(n_obj)]), yy, K) + gi)
noise_ig = [np.mean([r[0] for r in res[K]]) for K in KS]
noise_gr = [np.mean([r[1] for r in res[K]]) for K in KS]
inf_ig = np.mean([r[2] for r in res[2]])
inf_gr = np.mean([r[3] for r in res[2]])
print("прирост шума:", np.round(noise_ig, 3), " полезного:", round(inf_ig, 3))
print("gain ratio шума:", np.round(noise_gr, 3), " полезного:", round(inf_gr, 3))
assert noise_ig[KS.index(64)] > inf_ig > noise_gr[KS.index(64)]

fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))
ax = axes[0]
for depth, (col_t, col_v) in ((3, (BLUE, ORANGE)), (1, (AQUA, VIOLET))):
    tr, va = curves[depth]
    ax.plot(tr, color=col_t, lw=1.6, label=f"обучение, глубина {depth}")
    ax.plot(va, color=col_v, lw=1.6, label=f"новые данные, глубина {depth}")
ax.axhline(HY, color=MUTED, ls="--", label="H(Y) — константа")
ax.axhline(floor, color="k", ls=":", label="H(Y|X) — предел")
ax.set(xlabel="деревьев m", ylabel="log-loss, бит", ylim=(0, 1.45), title="Бустинг в битах")
ax.legend(fontsize=7, ncol=2, loc="upper center")

ax = axes[1]
ax.step(cands, ig, where="mid", color=BLUE, lw=2.4, label="прирост информации")
ax.step(cands, dll, where="mid", color=ORANGE, ls="--", label="Δ log-loss / n")
ax.step(cands, newton / n / LN2, where="mid", color=AQUA, label="Ньютон / n")
ax.axvline(t_e, color=BLUE, lw=0.8, ls=":")
ax.axvline(t_g, color=AQUA, lw=0.8, ls=":")
ax.set(xlabel="порог t", ylabel="бит на объект", title="Зерно 53: энтропия и Джини спорят")
ax.legend(fontsize=8)

ax = axes[2]
ax.semilogx(KS, noise_ig, "o-", color=BLUE, base=2, label="прирост: шум")
ax.axhline(inf_ig, color=BLUE, ls="--", label="прирост: полезный")
ax.semilogx(KS, noise_gr, "o-", color=ORANGE, base=2, label="gain ratio: шум")
ax.axhline(inf_gr, color=ORANGE, ls=":", label="gain ratio: полезный")
ax.set(xlabel="значений у шумового признака", ylabel="бит / доля", title="Признаки с множеством значений (n = 200)")
ax.legend(fontsize=8)

ex.finish(fig, "information_in_boosting")
