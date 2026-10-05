"""Решения упражнений урока 8.

Запуск:  python lessons/lesson_8/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBClassifier, RegressionTree, datasets
from gbcourse._numeric import sigmoid

X, y = datasets.classification_2d(kind="moons", n=400, noise=0.3, seed=90)

# 1
print("1) −G/(H + λ) = −Σg/(Σh + λ) = Σ h·(−g/h)/(Σh + λ) = Σ h z/(Σh + λ).")
p = sigmoid(np.full(len(y), 0.3))
g, h = p - y, p * (1 - p)
z = -g / h
t = RegressionTree(max_depth=3, reg_lambda=5.0).fit(X, g, h)
leaf_of = t.apply(X)
worst = max(abs(lf.value - np.sum(h[leaf_of == lf.id] * z[leaf_of == lf.id]) / (h[leaf_of == lf.id].sum() + 5.0)) for lf in t.leaves)
print(f"   наибольшее расхождение по листьям: {worst:.1e}")

# 2
m = GBClassifier(mode="newton", n_estimators=10, learning_rate=0.3, max_depth=3).fit(X, y)
p = sigmoid(m.predict_raw(X))
g, h = p - y, p * (1 - p)
z = -g / h
i = int(np.argmax(np.abs(z)))
nxt = RegressionTree(max_depth=3).fit(X, g, h)
leaf = nxt.apply(X)
same = leaf == leaf[i]
share = h[i] / h[same].sum()
print(f"2) объект {i}: y = {y[i]}, p = {p[i]:.4f}, z = {z[i]:+.1f}, h = {h[i]:.2e}")
print(f"   его доля в H листа: {share:.2%} — вклад в вес листа h·z/H = {h[i] * z[i] / h[same].sum():+.3f} "
      f"(значение листа {nxt.predict(X[i:i + 1])[0]:+.3f})")
