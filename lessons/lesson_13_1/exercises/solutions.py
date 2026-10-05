"""Решения упражнений урока 13.1.

Запуск:  python lessons/lesson_13_1/exercises/solutions.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "shared" / "python"))
sys.path.insert(0, str(ROOT / "lessons" / "lesson_13_1" / "examples"))

import lightgbm as lgb
import numpy as np

from gbcourse import GBRegressor
from lambdamart import dcg, make_queries, ndcg_at_k

# 1
rel = [3, 0, 2, 1]
ideal = dcg(sorted(rel, reverse=True), 4)
base = dcg(rel, 4) / ideal
for i, j in ((0, 2), (1, 2)):
    r = rel.copy()
    r[i], r[j] = r[j], r[i]
    print(f"1) перестановка позиций {i + 1} и {j + 1}: NDCG {base:.4f} → {dcg(r, 4) / ideal:.4f}, |Δ| = {abs(dcg(r, 4) / ideal - base):.4f}")
print("   Перестановка 2-го и 3-го поднимает документ с оценкой 2 выше нерелевантного — выгодно; 1-го и 3-го")
print("   опускает лучший документ с первой позиции — большая потеря. Вес зависит и от оценок, и от позиций.")

# 2
X, rel, qid = make_queries(150, seed=200)
Xt, relt, qidt = make_queries(150, seed=201)
p_reg = GBRegressor(n_estimators=100, max_depth=4, learning_rate=0.1).fit(X, rel).predict(Xt)
p_lgb = lgb.LGBMRanker(n_estimators=100, learning_rate=0.1, num_leaves=16, verbose=-1).fit(X, rel, group=np.bincount(qid)).predict(Xt)
for k in (1, 3, 10):
    a, b = ndcg_at_k(p_reg, relt, qidt, k), ndcg_at_k(p_lgb, relt, qidt, k)
    print(f"2) NDCG@{k:2d}: регрессия {a:.4f}, lambdarank {b:.4f}, разрыв {b - a:+.4f}")
