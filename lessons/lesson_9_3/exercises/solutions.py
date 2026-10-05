"""Решения упражнений урока 9.3.

Запуск:  python lessons/lesson_9_3/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor

# 1
ys, a, p = [3, 1, 4, 1, 5], 1.0, 2.0
print(f"1) наивная: ({sum(ys)} + 1·2)/(5 + 1) = {(sum(ys) + a * p) / (len(ys) + a):.4f} — одна на всех, включает свой y")
for i, yi in enumerate(ys):
    prev = ys[:i]
    print(f"   объект {i + 1} (y = {yi}): ({sum(prev)} + 2)/({len(prev)} + 1) = {(sum(prev) + a * p) / (len(prev) + a):.4f}")


# 2
def make(n, K, effect, seed):
    r = np.random.default_rng(seed)
    x = r.uniform(0, 10, n)
    c = r.integers(0, K, n)
    eff = np.random.default_rng(999).normal(0, 1.0, K) * effect
    return x, c, np.sin(x) + eff[c] + r.normal(0, 0.5, n)


def table(c, y, K, prior, a=1.0):
    return (np.bincount(c, y, K) + a * prior) / (np.bincount(c, minlength=K) + a)


def cv_ts(c, y, K, prior, seed, folds=5):
    fold = np.random.default_rng(seed).permutation(len(y)) % folds
    out = np.empty(len(y))
    for f in range(folds):
        out[fold == f] = table(c[fold != f], y[fold != f], K, prior)[c[fold == f]]
    return out


for effect in (0, 1):
    res = {}
    for rep in range(3):
        x, c, y = make(1400, 200, effect, rep)
        tr, te = np.arange(1000), np.arange(1000, 1400)
        prior = y[tr].mean()
        full = table(c[tr], y[tr], 200, prior)
        for name, enc in (("наивное", full[c[tr]]), ("по фолдам", cv_ts(c[tr], y[tr], 200, prior, rep))):
            m = GBRegressor(n_estimators=200, learning_rate=0.1, max_depth=3).fit(np.c_[x[tr], enc], y[tr])
            res.setdefault(name, []).append(np.mean((y[te] - m.predict(np.c_[x[te], full[c[te]]])) ** 2))
    kind = "информативна" if effect else "шум"
    print(f"2) категория {kind}, K = 200: " + ", ".join(f"{k} {np.mean(v):.3f}" for k, v in res.items()))
