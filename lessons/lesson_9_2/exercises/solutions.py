"""Решения упражнений урока 9.2.

Запуск:  python lessons/lesson_9_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import numpy as np

from gbcourse import GBRegressor, datasets

# 1
X, y = datasets.regression_1d(kind="wave", n=1000, noise=0.3, seed=93)
g = GBRegressor(n_estimators=10, learning_rate=0.3, max_depth=2).fit(X, y).predict(X) - y
h = np.ones_like(g)
n, a, b = len(g), 0.2, 0.1
order = np.argsort(X[:, 0], kind="stable")


def curve(w):
    gw, hw = (g * w)[order], (h * w)[order]
    GL, HL = np.cumsum(gw)[:-1], np.cumsum(hw)[:-1]
    G, H = gw.sum(), hw.sum()
    return 0.5 * (GL**2 / (HL + 1) + (G - GL) ** 2 / (H - HL + 1) - G**2 / (H + 1))


full = curve(np.ones(n))
kb = int(np.argmax(full))
top = np.argsort(-np.abs(g))[: int(a * n)]
rest = np.setdiff1d(np.arange(n), top)
rng = np.random.default_rng(0)
lu, lg = [], []
for _ in range(300):
    w = np.zeros(n)
    w[rng.choice(n, int((a + b) * n), replace=False)] = 1 / (a + b)
    lu.append((full[kb] - full[int(np.argmax(curve(w)))]) / full[kb])
    w = np.zeros(n)
    w[top] = 1
    w[rng.choice(rest, int(b * n), replace=False)] = (1 - a) / b
    lg.append((full[kb] - full[int(np.argmax(curve(w)))]) / full[kb])
print(f"1) доля Σ|g| у топ-20%: {np.abs(g[top]).sum() / np.abs(g).sum():.2f}")
print(f"   потеря выигрыша: равномерно {100 * np.mean(lu):.1f}%, GOSS {100 * np.mean(lg):.1f}%")
print("   Градиенты слабо сконцентрированы (остатки ≈ шум), и преимущество GOSS невелико.")

# 2
X, y = datasets.friedman1(n=1000, noise=1.0, seed=94)
X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)
res = []
for L in (2, 3, 4, 6):
    for lr in (0.02, 0.05, 0.1):
        m = lgb.LGBMRegressor(n_estimators=5000, learning_rate=lr, num_leaves=L, verbose=-1)
        m.fit(X_tr, y_tr, eval_X=(X_val,), eval_y=(y_val,), callbacks=[lgb.early_stopping(100, verbose=False)])
        res.append((min(m.evals_result_["valid_0"]["l2"]), L, lr, m.best_iteration_))
res.sort()
for mse, L, lr, it in res[:4]:
    print(f"2) num_leaves={L}, learning_rate={lr}: MSE {mse:.3f} ({it} деревьев)")
print("   Лучшие — совсем маленькие деревья: у задачи Фридмана взаимодействия только парные (x0·x1).")
