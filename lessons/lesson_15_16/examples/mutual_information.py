"""Взаимная информация: условная энтропия, медицинский тест, сравнение с корреляцией, биннинг, синергия, шум.

Запуск:  python lessons/lesson_15_16/examples/mutual_information.py [--save] [--no-show]

1) Тест на болезнь: I(D; T) и H(D) при разной распространённости.
2) Взаимная информация против корреляции на шести зависимостях (оценка по ранговым корзинам и kNN из scikit-learn).
3) Неравенство обработки данных: сколько информации о классе сохраняет биннинг признака.
4) Синергия (XOR), избыточность (копия) и шум меток.
"""

import sys
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.feature_selection import mutual_info_regression

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)


def h(p):
    p = np.asarray(p, float)
    out = np.where((p > 0) & (p < 1), -p * np.log2(np.clip(p, 1e-300, 1)) - (1 - p) * np.log2(np.clip(1 - p, 1e-300, 1)), 0.0)
    return float(out) if out.ndim == 0 else out


def mi(J):
    J = np.asarray(J, float)
    J = J / J.sum()
    px, py = J.sum(1, keepdims=True), J.sum(0, keepdims=True)
    m = J > 0
    return float((J[m] * np.log2(J[m] / (px @ py)[m])).sum())


# 1. Медицинский тест
def test_mi(prev, sens=0.99, spec=0.95):
    return mi([[prev * sens, prev * (1 - sens)], [(1 - prev) * (1 - spec), (1 - prev) * spec]])


prevs = np.logspace(-3, np.log10(0.5), 60)
for p in (0.01, 0.1, 0.5):
    print(f"распространённость {p:4}: H(D) = {h(p):.3f}, I(D;T) = {test_mi(p):.3f} бит")
assert abs(test_mi(0.01) - 0.0407) < 1e-4


# 2. Взаимная информация против корреляции
def data(kind, n=500, sd=0.1, seed=19):
    rng, X, Y = Mulberry32(seed), [], []
    for _ in range(n):
        if kind == "circle":
            t = rng.uniform(0, 2 * np.pi)
            e1, e2 = rng.normal(), rng.normal()
            X.append(np.cos(t) + sd * e1)
            Y.append(np.sin(t) + sd * e2)
        else:
            x = rng.uniform(-1, 1)
            e = sd * rng.normal()
            X.append(x)
            Y.append({"line": x + e, "parab": x * x + e, "sine": np.sin(3 * np.pi * x) + e, "step": (x > 0) + e,
                      "exp": np.exp(3 * x) / 10 + e, "noise": 3 * e}[kind])
    return np.array(X), np.array(Y)


def rank_bins(v, b=8):
    r = np.empty(len(v), int)
    r[np.argsort(v, kind="stable")] = np.arange(len(v))
    return r * b // len(v)


kinds = ["line", "parab", "circle", "sine", "step", "exp", "noise"]
rows = []
for kind in kinds:
    X, Y = data(kind)
    T = np.zeros((8, 8))
    np.add.at(T, (rank_bins(X), rank_bins(Y)), 1)
    knn = mutual_info_regression(X[:, None], Y, random_state=0)[0] / np.log(2)
    rows.append((kind, abs(np.corrcoef(X, Y)[0, 1]), mi(T), knn))
    print(f"{kind:7s} |r| = {rows[-1][1]:.3f}, I по корзинам = {rows[-1][2]:.3f}, kNN = {knn:.3f} бит")
assert rows[1][1] < 0.05 and rows[1][2] > 1.1   # парабола: r ≈ 0, I > 1 бита

# 3. Биннинг
NB = 25500
x = (np.arange(NB) + 0.5) / NB
funcs = {"плавная": lambda t: 1 / (1 + np.exp(-10 * (t - 0.5))), "волны": lambda t: 0.5 + 0.4 * np.sin(6 * np.pi * t),
         "узкий пик": lambda t: 0.1 + 0.8 * np.exp(-((t - 0.62) / 0.03) ** 2)}
bins = [1, 2, 3, 4, 6, 8, 12, 16, 32, 64, 128, 255]
kept = {}
for name, f in funcs.items():
    p = f(x)
    I_xy = h(p.mean()) - h(p).mean()
    vals = []
    for b in bins:
        k = np.minimum(b - 1, np.floor(x * b).astype(int))
        means = np.bincount(k, p, b) / np.bincount(k, None, b)
        vals.append((h(p.mean()) - (np.bincount(k, None, b) / NB * h(means)).sum()) / I_xy)
    kept[name] = vals
    print(f"{name:10s} I = {I_xy:.4f}; сохранено при 255 корзинах {100 * vals[-1]:.2f} %, при 8 — {100 * vals[5]:.1f} %")
    assert max(vals) <= 1 + 1e-9     # неравенство обработки данных


# 4. Синергия и избыточность
def pair(rule, eps=0.0, copy=False):
    P = np.zeros((2, 2, 2))
    for a, b in product((0, 1), repeat=2):
        pab = (0.5 if a == b else 0.0) if copy else 0.25
        q = eps + (1 - 2 * eps) * rule(a, b)
        P[a, b] = pab * (1 - q), pab * q
    J = P.reshape(4, 2)
    return mi(P.sum(1)), mi(P.sum(0)), mi(J[J.sum(1) > 0])


for name, rule, copy in (("XOR", lambda a, b: a ^ b, False), ("AND", lambda a, b: a & b, False), ("копия", lambda a, b: a, True)):
    I1, I2, I12 = pair(rule, copy=copy)
    print(f"{name:6s}: по отдельности {I1:.3f} и {I2:.3f}, вместе {I12:.3f} (вместе − сумма {I12 - I1 - I2:+.3f})")
epss = np.linspace(0, 0.5, 51)
xor_noise = [pair(lambda a, b: a ^ b, e)[2] for e in epss]
assert np.allclose(xor_noise, 1 - h(epss))   # XOR с шумом меток = ёмкость канала 1 − h(ε)

fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))
ax = axes[0]
xs = np.arange(len(kinds))
ax.bar(xs - 0.2, [r[1] for r in rows], width=0.38, color=MUTED, label="|корреляция|")
ax.bar(xs + 0.2, [r[2] for r in rows], width=0.38, color=BLUE, label="взаимная информация, бит")
ax.set(xticks=xs, xticklabels=["прямая", "парабола", "окружность", "синус", "ступенька", "экспонента", "шум"], title="Корреляция видит не всё")
ax.tick_params(axis="x", rotation=30)
ax.legend()

ax = axes[1]
for (name, vals), col in zip(kept.items(), (BLUE, ORANGE, VIOLET)):
    ax.semilogx(bins, 100 * np.array(vals), "o-", color=col, base=2, label=name)
ax.set(xlabel="число корзин b", ylabel="сохранено I, %", title="Биннинг признака теряет информацию")
ax.legend()

ax = axes[2]
ax.semilogx(prevs, h(prevs), "--", color=MUTED, label="H(D)")
ax.semilogx(prevs, [test_mi(p) for p in prevs], color=AQUA, label="I(D; T)")
ax.set(xlabel="распространённость болезни", ylabel="бит", title="Сколько бит даёт тест (99 % / 95 %)")
ax.legend()

ex.finish(fig, "mutual_information")
