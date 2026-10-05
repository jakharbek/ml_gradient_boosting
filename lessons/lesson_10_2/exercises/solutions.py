"""Решения упражнений урока 10.2.

Запуск:  python lessons/lesson_10_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import numpy as np
from sklearn.metrics import log_loss, roc_auc_score

from gbcourse import GBRegressor, datasets

# 1
params = dict(mode="newton", n_estimators=400, learning_rate=0.05, max_depth=4, reg_lambda=1)
res = {}
for s in range(3):
    X, y = datasets.friedman1(n=3000, noise=1.0, seed=150 + s)
    r = np.random.default_rng(s)
    miss = (X[:, 3] > 0.6) & (r.random(len(y)) < 0.75)
    Xm = X.copy()
    Xm[miss, 3] = np.nan
    a, b, c, d = datasets.train_test_split(Xm, y, test_size=0.3, seed=s)
    fill = lambda Z: np.where(np.isnan(Z), -1.0, Z)
    res.setdefault("NaN", []).append(2 * min(GBRegressor(**params).fit(a, c, eval_set=(b, d)).history_["eval"]))
    res.setdefault("−1", []).append(2 * min(GBRegressor(**params).fit(fill(a), c, eval_set=(fill(b), d)).history_["eval"]))
print("1) MNAR: " + ", ".join(f"{k}: {np.mean(v):.3f}" for k, v in res.items()))
print("   −1 левее всех значений: любой порог отправляет пропуски влево — это одно фиксированное «направление»,")
print("   а NaN-обработка выбирает направление в каждом узле. Обе сохраняют факт пропуска, поэтому близки.")


# 2
def make(n, rate, seed):
    r = np.random.default_rng(seed)
    yy = (r.random(n) < rate).astype(int)
    Z = r.normal(0, 1, (n, 5))
    Z[:, 0] += 1.5 * yy
    Z[:, 1] += 1.0 * yy * np.sign(r.normal(size=n))
    return Z, yy


X, y = make(20000, 0.02, 0)
X_te, y_te = make(20000, 0.02, 1)
w = 49.0
p0 = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.05, num_leaves=15, verbose=-1).fit(X, y).predict_proba(X_te)[:, 1]
pw = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.05, num_leaves=15, scale_pos_weight=w, verbose=-1).fit(X, y).predict_proba(X_te)[:, 1]
pc = pw / (pw + w * (1 - pw))
print("2) Шансы в «раздутом» мире в w раз больше: p/(1−p) = w·p'/(1−p') ⇒ p' = p/(p + w(1 − p)).")
print(f"   log-loss: без весов {log_loss(y_te, p0):.4f}, с весом {log_loss(y_te, pw):.4f}, с весом + пересчёт {log_loss(y_te, pc):.4f}")
print(f"   средний прогноз: без весов {p0.mean():.4f}, с весом {pw.mean():.4f}, после пересчёта {pc.mean():.4f}; доля класса 1 {y_te.mean():.4f}")
print(f"   AUC не меняется при пересчёте (монотонное преобразование): {roc_auc_score(y_te, pw):.4f} = {roc_auc_score(y_te, pc):.4f}")
print("   Пересчёт исправляет смещение лишь частично: формула верна для идеальной модели, а реальная модель")
print("   с весами обучилась иначе (другие деревья, другая эффективная выборка). Средний прогноз теперь даже")
print("   занижен. Надёжнее калибровать вероятности на валидации (урок 13.2).")
