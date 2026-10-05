"""Решения части заданий итогового проекта (1, 2, 5).

Запуск:  python lessons/lesson_14/exercises/solutions.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "shared" / "python"))
sys.path.insert(0, str(ROOT / "lessons" / "lesson_14" / "examples"))

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, log_loss

from churn_data import FEATURES, make_churn, time_split

BEST = dict(num_leaves=8, min_child_samples=200, colsample_bytree=0.5, reg_lambda=0.0, cat_smooth=50.0)
df = make_churn().sort_values(["client", "month"]).reset_index(drop=True)


def fit_eval(frame, feats, label):
    tr, va, te = time_split(frame)
    m = lgb.LGBMClassifier(n_estimators=3000, learning_rate=0.05, verbose=-1, random_state=0, **BEST)
    m.fit(tr[feats], tr.churn, eval_X=(va[feats],), eval_y=(va.churn,), callbacks=[lgb.early_stopping(100, verbose=False)])
    out = {}
    for name, part in (("вал.", va), ("тест", te)):
        p = m.predict_proba(part[feats])[:, 1]
        out[name] = (log_loss(part.churn, p), average_precision_score(part.churn, p))
    print(f"{label:34s} " + " | ".join(f"{k}: log-loss {v[0]:.4f}, AP {v[1]:.4f}" for k, v in out.items()))
    return m


# 1: признаки из прошлого клиента (сдвиги внутри клиента — только назад во времени)
g = df.groupby("client")
df["charge_change"] = df.monthly_charge - g.monthly_charge.shift(1)
df["calls_3m"] = g.support_calls.transform(lambda s: s.rolling(3, min_periods=1).sum())
df["charge_per_gb"] = df.monthly_charge / (df.usage_gb + 1)
print("1) новые признаки:")
fit_eval(df, FEATURES, "   эталонные признаки")
fit_eval(df, FEATURES + ["charge_change", "calls_3m", "charge_per_gb"], "   + история клиента")
print("   Не помогли: в генераторе данных уход зависит от текущих значений, а не от их истории. На реальных данных такие")
print("   признаки часто полезны — поэтому их проверяют, а не добавляют вслепую.")

# 2: редкие регионы → «прочие»
tr, _, _ = time_split(df)
counts = tr.region.value_counts()
rare = set(counts[counts < 100].index)
df["region_grouped"] = pd.Categorical(df.region.astype(str).where(~df.region.astype(str).isin(rare), "прочие"))
feats2 = [f if f != "region" else "region_grouped" for f in FEATURES]
print(f"2) регионов реже 100 раз: {len(rare)} из {df.region.nunique()}")
fit_eval(df, feats2, "   редкие регионы → «прочие»")

# 5: полнота при удержании 5% клиентов
m = fit_eval(df, FEATURES, "5) эталонная модель")
_, _, te = time_split(df)
rec = []
for _, part in te.groupby("month"):
    p = m.predict_proba(part[FEATURES])[:, 1]
    k = max(1, int(0.05 * len(part)))
    top = np.argsort(-p)[:k]
    rec.append((part.churn.to_numpy()[top].sum(), part.churn.sum()))
caught, total = map(sum, zip(*rec))
print(f"   топ-5% клиентов каждый месяц ловят {caught} из {total} уходов — полнота {caught / total:.2f}; случайный выбор ≈ 0.05")
