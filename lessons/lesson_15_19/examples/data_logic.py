"""Логика в данных: маски, пропуски и трёхзначная логика, импликации в метриках, правила «если — то».

Запуск:  python lessons/lesson_15_19/examples/data_logic.py [--save] [--no-show]

1) Законы де Моргана на масках pandas и ошибка приоритета операторов.
2) Пропуски: ~(x > t) ≠ x <= t; логика Клини для pd.NA; отбор строк по маске с NA.
3) Метрики как доли импликаций: строгая контрапозиция и «мягкие» доли.
4) Правила на синтетических данных об оттоке: поддержка, достоверность, подъём (как в виджете урока).
"""

import math
import sys
from itertools import combinations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)

# 1. Маски
rng = Mulberry32(11)
df = pd.DataFrame({"age": [18 + rng.randint(50) for _ in range(1000)], "income": [20 + rng.randint(80) for _ in range(1000)]})
a, b = df.age > 30, df.income < 50
assert ((~(a & b)) == (~a | ~b)).all() and ((~(a | b)) == (~a & ~b)).all()
print("1) де Морган на 1000 строках: выполнен; отобрано a & b:", int((a & b).sum()), "доля", round((a & b).mean(), 3))
try:
    df[df.age > 30 & df.income < 50]
    raise AssertionError("ожидалась ошибка")
except ValueError as e:
    print("   без скобок:", type(e).__name__, "—", str(e)[:60])

# 2. Пропуски
age = pd.Series([25, np.nan, 47, 33, 19, np.nan, 52, 30, 61, 28])
gt, le, neg = age > 30, age <= 30, ~(age > 30)
print(f"\n2) age > 30: {gt.sum()}, age <= 30: {le.sum()}, ~(age > 30): {neg.sum()}, пропусков: {age.isna().sum()}")
assert gt.sum() + le.sum() == len(age) - age.isna().sum() and neg.sum() == le.sum() + age.isna().sum()
na = pd.array([True, None, False], dtype="boolean")
kleene = {"NA | True": list(na | True)[1], "NA & False": list(na & False)[1], "NA | False": list(na | False)[1], "~NA": list(~na)[1]}
print("   логика Клини:", kleene)
assert kleene["NA | True"] is np.True_ and kleene["NA & False"] is np.False_ and kleene["~NA"] is pd.NA
age_na = age.astype("Float64")
print("   отбор по маске с <NA> берёт только True:", list(age_na[age_na > 30].index))
assert list(age_na[age_na > 30].index) == [2, 3, 6, 8]

# 3. Метрики
TP, FP, FN, TN = 40, 10, 30, 120
y = np.array([1] * TP + [0] * FP + [1] * FN + [0] * TN)
p = np.array([1] * TP + [1] * FP + [0] * FN + [0] * TN)
m = {"точность ŷ→y": precision_score(y, p), "специфичность ¬y→¬ŷ": recall_score(1 - y, 1 - p),
     "полнота y→ŷ": recall_score(y, p), "NPV ¬ŷ→¬y": precision_score(1 - y, 1 - p)}
print("\n3)", {k: round(v, 3) for k, v in m.items()})
assert round(m["точность ŷ→y"], 3) == 0.8 and round(m["специфичность ¬y→¬ŷ"], 3) == 0.923
# редкий класс: 1 % спама, полнота 0.9, ложные срабатывания 1 %
tp, fp = 90, 99
print(f"   редкий класс: точность {tp / (tp + fp):.3f} при специфичности 0.99 и полноте 0.9")
assert tp / (tp + fp) < 0.5

# 4. Правила на данных (тот же генератор, что в виджете «rules»)
rng = Mulberry32(19)
rows = []
for _ in range(400):
    age_ = 18 + rng.randint(53)
    tenure = rng.randint(61)
    complaint = int(rng.random() < 0.2)
    basic = int(rng.random() < 0.6)
    z = -2.2 + 1.6 * complaint + 1.0 * (tenure < 12) + 0.6 * basic + 0.4 * (age_ < 30)
    rows.append(dict(age=age_, tenure=tenure, complaint=complaint, basic=basic, churn=int(rng.random() < 1 / (1 + math.exp(-z)))))
cl = pd.DataFrame(rows)
conds = {"жалоба": cl.complaint == 1, "стаж<12": cl.tenure < 12, "базовый": cl.basic == 1, "возраст<30": cl.age < 30}
base = cl.churn.mean()
stats = []
for k in range(1, 5):
    for c in combinations(conds, k):
        A = np.logical_and.reduce([conds[x] for x in c])
        stats.append((" ∧ ".join(c), A.sum(), cl.churn[A].mean() if A.sum() else np.nan))
st = pd.DataFrame(stats, columns=["правило", "поддержка", "достоверность"]).assign(подъём=lambda d: d["достоверность"] / base)
print(f"\n4) доля ушедших {base:.3f}; лучшие правила по подъёму:")
print(st.sort_values("подъём", ascending=False).head(5).round(3).to_string(index=False))
r1 = st.set_index("правило").loc["жалоба"]
assert r1["поддержка"] == 86 and round(r1["подъём"], 2) == 2.03
assert round(st.set_index("правило").loc["возраст<30", "подъём"], 2) == 1.02

fig, ax = plt.subplots(figsize=(9, 4.6))
k = st["правило"].str.count("∧") + 1
for kk, col in zip((1, 2, 3, 4), (BLUE, ORANGE, "#1baf7a", MUTED)):
    s = st[k == kk]
    ax.scatter(s["поддержка"], s["достоверность"], color=col, s=40, label=f"{kk} условие" if kk == 1 else f"{kk} условия")
ax.axhline(base, color=MUTED, ls="--", lw=1)
ax.text(300, base + 0.015, "доля ушедших (подъём = 1)", color="#52514e")
ax.set(xlabel="поддержка (клиентов с выполненным условием)", ylabel="достоверность P(уход | условие)", title="Правила «если — то»: чем больше условий, тем точнее и тем реже")
ax.legend()
ex.finish(fig, "rules_support_confidence")
