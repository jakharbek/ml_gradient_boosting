"""Решения упражнений урока 10.1.

Запуск:  python lessons/lesson_10_1/exercises/solutions.py
"""

import itertools
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import numpy as np
import pandas as pd

from gbcourse import datasets

# 1
rng = np.random.default_rng(1)
lam = 20.0


def gain(G, H, mask):
    S = lambda g, h: g * g / (h + lam)
    gl, hl = G[mask].sum(), H[mask].sum()
    return 0.5 * (S(gl, hl) + S(G.sum() - gl, H.sum() - hl) - S(G.sum(), H.sum()))


losses = {"G/H": [], "G/(H+λ)": []}
for _ in range(500):
    K = int(rng.integers(3, 13))
    n = rng.integers(2, 40, K).astype(float)
    G, H = -n * rng.normal(0, 1, K), n
    brute = max(gain(G, H, np.array((0,) + b, dtype=bool)) for b in itertools.product((0, 1), repeat=K - 1) if any(b))
    if brute <= 0:  # с λ > 0 все разбиения могут быть невыгодными — такой узел не делится
        continue
    for name, key in (("G/H", G / H), ("G/(H+λ)", G / (H + lam))):
        order = np.argsort(key)
        best = max(gain(G, H, np.isin(np.arange(K), order[:t])) for t in range(1, K))
        losses[name].append((brute - best) / brute)
for name, v in losses.items():
    v = np.array(v)
    print(f"1) сортировка по {name:8s}: потери в {np.mean(v > 1e-9) * 100:.1f}% случаев, средняя {100 * v.mean():.3f}%, наибольшая {100 * v.max():.2f}%")
print("   В наших 500 опытах сортировка по G/H находила оптимум и при λ = 20 (это эмпирический факт, а не теорема")
print("   Фишера). Сортировка по сглаженному G/(H + λ) — как с cat_smooth в LightGBM — иногда теряет, но в среднем мало.")

# 2
x, c, y = datasets.categorical_regression(n=6000, n_categories=1000, noise=1.0, seed=140)
perm = np.random.default_rng(0).permutation(len(y))
tr, va, te = perm[:3600], perm[3600:4800], perm[4800:]
D = pd.DataFrame({"x": x, "c": pd.Categorical(c)})
rmse = lambda p: np.sqrt(np.mean((y[te] - p) ** 2))
for mdpg in (5, 20, 100):
    for cs in (1.0, 10.0):
        m = lgb.LGBMRegressor(n_estimators=5000, learning_rate=0.05, verbose=-1, min_data_per_group=mdpg, cat_smooth=cs)
        m.fit(D.iloc[tr], y[tr], eval_X=(D.iloc[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
        print(f"2) min_data_per_group={mdpg:3d}, cat_smooth={cs:4}: RMSE {rmse(m.predict(D.iloc[te])):.3f}")
prior = y[tr].mean()
tab = (np.bincount(c[tr], y[tr], 1000) + 10 * prior) / (np.bincount(c[tr], minlength=1000) + 10)
Z = np.c_[x, tab[c]]
m = lgb.LGBMRegressor(n_estimators=5000, learning_rate=0.05, verbose=-1)
m.fit(Z[tr], y[tr], eval_X=(Z[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
print(f"   для сравнения — кодирование средним: RMSE {rmse(m.predict(Z[te])):.3f}")
print("   Меньший cat_smooth помогает (1.70 → 1.41), но до кодирования средним встроенной обработке далеко.")
