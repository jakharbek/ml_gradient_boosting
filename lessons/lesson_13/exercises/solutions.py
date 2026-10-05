"""Решения упражнений урока 13.

Запуск:  python lessons/lesson_13/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBClassifier, datasets

X, y = datasets.classification_2d(kind="moons", n=600, noise=0.35, seed=190)
X_te, y_te = datasets.classification_2d(kind="moons", n=3000, noise=0.35, seed=191)


def ece(yy, p, bins=10):
    idx = np.minimum((p * bins).astype(int), bins - 1)
    return sum(np.mean(idx == b) * abs(p[idx == b].mean() - yy[idx == b].mean()) for b in range(bins) if np.any(idx == b))


def report(p):
    ll = -np.mean(y_te * np.log(p) + (1 - y_te) * np.log(1 - p))
    return f"точность {np.mean((p > 0.5) == y_te):.3f}, ECE {ece(y_te, p):.3f}, log-loss {ll:.3f}"


# 1
m = GBClassifier(n_estimators=500, learning_rate=0.05, max_depth=4).fit(X, y)
for k in (10, 100, 500):
    print(f"1) ν = 0.05, {k:3d} деревьев: {report(1 / (1 + np.exp(-m.predict_raw(X_te, k))))}")
print("   При 10 деревьях ECE велика по другой причине: модель ещё слишком осторожна (прогнозы близки к 0.5) —")
print("   некалиброванность бывает в обе стороны. Лучше всего около 100 деревьев; дальше вероятности снова портятся,")
print("   но медленнее, чем при ν = 0.3.")

# 2
X_tr, X_va, y_tr, y_va = datasets.train_test_split(X, y, test_size=0.3, seed=0)
m = GBClassifier(n_estimators=500, learning_rate=0.3, max_depth=4, early_stopping_rounds=30).fit(X_tr, y_tr, eval_set=(X_va, y_va))
print(f"2) остановка на {m.best_iteration_} деревьях: {report(m.predict_proba(X_te)[:, 1])}")
