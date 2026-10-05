"""Решения упражнений урока 13.3.

Запуск:  python lessons/lesson_13_3/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBClassifier, GBRegressor, datasets
from gbcourse.metrics import roc_auc

# 1
f = lambda x: np.sin(x) + 0.3 * x
r = np.random.default_rng(0)
x_tr = r.uniform(0, 6, 1000)
y_tr = f(x_tr) + r.normal(0, 0.3, 1000)
model = GBRegressor(n_estimators=200, learning_rate=0.1, max_depth=3).fit(x_tr[:, None], y_tr)
edges = np.quantile(x_tr, np.linspace(0, 1, 11))
edges[0], edges[-1] = -np.inf, np.inf
first_psi = first_auc = None
for s in np.round(np.arange(0, 1.01, 0.1), 1):
    rn = np.random.default_rng(100 + int(s * 10))
    x_new = rn.uniform(s, 6 + s, 1000)
    y_new = f(x_new) + rn.normal(0, 0.3, 1000)
    pa = np.clip(np.histogram(x_tr, edges)[0] / 1000, 1e-4, None)
    pb = np.clip(np.histogram(x_new, edges)[0] / 1000, 1e-4, None)
    psi = float(np.sum((pb - pa) * np.log(pb / pa)))
    Z = np.r_[x_tr, x_new][:, None]
    lab = np.r_[np.zeros(1000), np.ones(1000)]
    perm = np.random.default_rng(1).permutation(2000)
    clf = GBClassifier(n_estimators=100, max_depth=2, learning_rate=0.1).fit(Z[perm[:1400]], lab[perm[:1400]])
    auc = roc_auc(lab[perm[1400:]], clf.predict_proba(Z[perm[1400:]])[:, 1])
    rmse = np.sqrt(np.mean((y_new - model.predict(x_new[:, None])) ** 2))
    first_psi = first_psi if first_psi is not None or psi <= 0.25 else s
    first_auc = first_auc if first_auc is not None or auc <= 0.6 else s
    print(f"1) s = {s:.1f}: PSI {psi:.3f}, AUC {auc:.3f}, RMSE {rmse:.3f}")
print(f"   PSI > 0.25 впервые при s = {first_psi}, AUC > 0.6 — при s = {first_auc}.")
print("   PSI по корзинам очень чувствителен к пустеющим крайним корзинам; ошибка растёт, лишь когда много")
print("   объектов уходит за край обучающего диапазона.")

# 2
X, y = datasets.friedman1(n=4000, noise=1.0, seed=232)
old, new = X[:2000], X[2000:].copy()
new[:, 3] += 0.5
Z = np.r_[old, new]
lab = np.r_[np.zeros(2000), np.ones(2000)]
perm = np.random.default_rng(0).permutation(4000)
clf = GBClassifier(n_estimators=100, max_depth=2, learning_rate=0.1).fit(Z[perm[:2800]], lab[perm[:2800]])
auc = roc_auc(lab[perm[2800:]], clf.predict_proba(Z[perm[2800:]])[:, 1])
imp = clf.feature_importances_
print(f"2) AUC старые/новые {auc:.3f}; важности: " + ", ".join(f"x{j} {imp[j]:.2f}" for j in np.argsort(-imp)[:3]))
