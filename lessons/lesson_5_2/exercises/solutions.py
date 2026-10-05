"""Решения упражнений урока 5.2.

Запуск:  python lessons/lesson_5_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import RegressionTree, datasets, get_loss

X, y = datasets.regression_1d(kind="wave", n=300, noise=0.3, seed=53, outliers=0.1)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)

# 1
rhos = np.linspace(0, 3, 301)
for mode in ("rho", "treeboost"):
    F, F_te = np.full(len(y_tr), np.median(y_tr)), np.full(len(y_te), np.median(y_tr))
    for _ in range(150):
        tree = RegressionTree(max_depth=2).fit(X_tr, -np.sign(y_tr - F))
        h, h_te = tree.predict(X_tr), tree.predict(X_te)
        if mode == "rho":
            rho = rhos[np.argmin([np.abs(y_tr - F - r * h).sum() for r in rhos])]
            F, F_te = F + 0.1 * rho * h, F_te + 0.1 * rho * h_te
        else:
            for leaf in tree.leaves:
                leaf.value = np.median(y_tr[leaf.rows] - F[leaf.rows])
            tree.refresh_values()
            F, F_te = F + 0.1 * tree.predict(X_tr), F_te + 0.1 * tree.predict(X_te)
    print(f"1) {mode:9s}: MAE теста {np.mean(np.abs(y_te - F_te)):.4f}")
print("   На этих данных разница мала (и даже в пользу одного ρ): при неглубоких деревьях и малом ν оба")
print("   варианта близки. Преимущество TreeBoost — в гибкости: каждый лист получает свой шаг.")

# 2
rng = np.random.default_rng(0)
yl = rng.poisson(3.0, size=20).astype(float)
Fl = rng.normal(0.8, 0.2, size=20)
gamma = np.log(yl.sum() / np.exp(Fl).sum())
print(f"2) γ = log(Σy / Σe^F) = {gamma:.6f}; gbcourse: {get_loss('poisson').leaf_value(yl, Fl):.6f}")

# 3
huber = get_loss("huber", delta=1.0)
for case, r in (("симметричный шум", rng.normal(0, 0.5, 30)), ("с выбросами", np.r_[rng.normal(0, 0.5, 27), [6, 7, 8]])):
    gs = np.linspace(-3, 3, 60001)
    exact = gs[np.argmin([huber.pointwise(r, np.full_like(r, g)).sum() for g in gs])]
    approx = huber.leaf_value(r, np.zeros_like(r))
    print(f"3) {case:16s}: точный минимум {exact:+.4f}, приближение Фридмана {approx:+.4f}")
r = rng.normal(0, 0.2, 30)
gs = np.linspace(-1, 1, 20001)
exact = gs[np.argmin([huber.pointwise(r, np.full_like(r, g)).sum() for g in gs])]
print(f"   все остатки близко друг к другу (σ = 0.2): точный {exact:+.4f}, приближение {huber.leaf_value(r, np.zeros_like(r)):+.4f}")
print("   Если все |r − медиана| ≤ δ и |r − оптимум| ≤ δ, формула даёт среднее — точный минимум. Иначе это")
print("   один шаг от медианы: не точный минимум, но очень близкий к нему.")
