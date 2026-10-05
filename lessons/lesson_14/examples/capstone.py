"""Итоговый проект: модель оттока от константы до откалиброванного бустинга — шаг за шагом.

Разбиение по времени (обучение 1–14, валидация 15–18, тест 19–24). На каждом шаге — log-loss, ROC AUC и
средняя точность (AP) на валидации и тесте. Затем SHAP-важности (встроенные в LightGBM), проверка сдвига
(PSI и состязательный классификатор) и калибровка. Результаты — в lessons/lesson_14/web/results.js.

Запуск:  python lessons/lesson_14/examples/capstone.py [--save] [--no-show]   (≈ 1–2 минуты)
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[3] / "shared" / "python"))
sys.path.insert(0, str(HERE.parent))

import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, log_loss, roc_auc_score

from churn_data import FEATURES, make_churn, time_split
from gbcourse.cli import Example

ex = Example(__file__)
df = make_churn()
tr, va, te = time_split(df)
Xtr, Xva, Xte = tr[FEATURES], va[FEATURES], te[FEATURES]
ytr, yva, yte = tr.churn.to_numpy(), va.churn.to_numpy(), te.churn.to_numpy()


def metrics(y, p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return {"log-loss": log_loss(y, p), "AUC": roc_auc_score(y, p), "AP": average_precision_score(y, p)}


steps = []


def record(name, note, p_va, p_te, extra=None):
    rec = {"step": name, "note": note, "valid": {k: round(float(v), 4) for k, v in metrics(yva, p_va).items()},
           "test": {k: round(float(v), 4) for k, v in metrics(yte, p_te).items()}}
    if extra:
        rec.update(extra)
    steps.append(rec)
    print(f"{name:34s} валидация: " + ", ".join(f"{k} {v:.4f}" for k, v in rec["valid"].items())
          + " | тест: " + ", ".join(f"{k} {v:.4f}" for k, v in rec["test"].items()))


# 0. Константа — доля уходов в обучении
rate = ytr.mean()
record("0. константа", "доля уходов в обучении", np.full(len(yva), rate), np.full(len(yte), rate))

# 1. LightGBM по умолчанию, категории как числовые коды
codes = lambda X: X.assign(**{c: X[c].cat.codes for c in ("contract", "payment", "region")})
m1 = lgb.LGBMClassifier(verbose=-1, random_state=0).fit(codes(Xtr), ytr)
record("1. LightGBM, категории — коды", "параметры по умолчанию", m1.predict_proba(codes(Xva))[:, 1], m1.predict_proba(codes(Xte))[:, 1])

# 2. Встроенные категории
m2 = lgb.LGBMClassifier(verbose=-1, random_state=0).fit(Xtr, ytr)
record("2. встроенные категории", "pandas category", m2.predict_proba(Xva)[:, 1], m2.predict_proba(Xte)[:, 1])

# 3. Темп 0.05 + ранняя остановка по валидации
m3 = lgb.LGBMClassifier(n_estimators=3000, learning_rate=0.05, verbose=-1, random_state=0)
m3.fit(Xtr, ytr, eval_X=(Xva,), eval_y=(yva,), callbacks=[lgb.early_stopping(100, verbose=False)])
record("3. ν = 0.05 + ранняя остановка", f"деревьев {m3.best_iteration_}", m3.predict_proba(Xva)[:, 1], m3.predict_proba(Xte)[:, 1])

# 4. Случайный поиск (25 вариантов) по валидации
rng = np.random.default_rng(0)
best = None
for _ in range(25):
    params = dict(num_leaves=int(rng.choice([4, 8, 16, 31, 64])), min_child_samples=int(rng.choice([10, 20, 50, 100, 200])),
                  colsample_bytree=float(rng.choice([0.5, 0.7, 1.0])), reg_lambda=float(rng.choice([0.0, 1.0, 10.0])),
                  cat_smooth=float(rng.choice([1.0, 10.0, 50.0])))
    m = lgb.LGBMClassifier(n_estimators=3000, learning_rate=0.05, verbose=-1, random_state=0, **params)
    m.fit(Xtr, ytr, eval_X=(Xva,), eval_y=(yva,), callbacks=[lgb.early_stopping(100, verbose=False)])
    score = min(m.evals_result_["valid_0"]["binary_logloss"])
    if best is None or score < best[0]:
        best = (score, params, m)
_, best_params, m4 = best
print("лучшие параметры:", best_params)
record("4. случайный поиск (25 вариантов)", ", ".join(f"{k}={v}" for k, v in best_params.items()),
       m4.predict_proba(Xva)[:, 1], m4.predict_proba(Xte)[:, 1])

# 5. Калибровка Платта на валидации
F_va = m4.predict(Xva, raw_score=True)
F_te = m4.predict(Xte, raw_score=True)
platt = LogisticRegression(C=1e6).fit(F_va[:, None], yva)
record("5. калибровка Платта", f"p' = σ({platt.coef_[0, 0]:.3f}·F + {platt.intercept_[0]:.3f})",
       platt.predict_proba(F_va[:, None])[:, 1], platt.predict_proba(F_te[:, None])[:, 1])
print("   (метрики калибровки на валидации оптимистичны: Платт обучен на ней же)")

# SHAP-важности на тесте (pred_contrib — точные значения TreeSHAP из LightGBM)
contrib = m4.predict(Xte, pred_contrib=True)[:, :-1]
shap_imp = {f: round(float(v), 4) for f, v in zip(FEATURES, np.abs(contrib).mean(0))}
print("средний |SHAP| на тесте:", dict(sorted(shap_imp.items(), key=lambda kv: -kv[1])))


# Сдвиг: PSI платежа и состязательная проверка «обучение против теста»
def psi(a, b, bins=10):
    edges = np.quantile(a, np.linspace(0, 1, bins + 1))
    edges[0], edges[-1] = -np.inf, np.inf
    pa = np.clip(np.histogram(a, edges)[0] / len(a), 1e-4, None)
    pb = np.clip(np.histogram(b, edges)[0] / len(b), 1e-4, None)
    return float(np.sum((pb - pa) * np.log(pb / pa)))


psi_charge = psi(tr.monthly_charge.to_numpy(), te.monthly_charge.to_numpy())
Z = pd.concat([Xtr, Xte])
lab = np.r_[np.zeros(len(Xtr)), np.ones(len(Xte))]
perm = np.random.default_rng(1).permutation(len(Z))
cut = int(0.7 * len(Z))
adv = lgb.LGBMClassifier(n_estimators=200, verbose=-1).fit(Z.iloc[perm[:cut]], lab[perm[:cut]])
adv_auc = roc_auc_score(lab[perm[cut:]], adv.predict_proba(Z.iloc[perm[cut:]])[:, 1])
adv_imp = dict(zip(FEATURES, adv.booster_.feature_importance("gain")))
top_shift = max(adv_imp, key=adv_imp.get)
print(f"PSI monthly_charge обучение→тест: {psi_charge:.3f}; AUC обучение/тест: {adv_auc:.3f}; главный сдвинувшийся признак: {top_shift}")

out = {
    "rows": {"train": int(len(tr)), "valid": int(len(va)), "test": int(len(te))},
    "rate": {"train": round(float(ytr.mean()), 4), "valid": round(float(yva.mean()), 4), "test": round(float(yte.mean()), 4)},
    "steps": steps, "shap": shap_imp, "psi_charge": round(psi_charge, 3), "adv_auc": round(float(adv_auc), 3), "top_shift": top_shift,
}
target = HERE.parents[1] / "web" / "results.js"
target.write_text(
    "/* Сгенерировано lessons/lesson_14/examples/capstone.py — не редактировать вручную. */\n"
    "(function (root) {\n  'use strict';\n  (root.GBC || (root.GBC = {})).capstone = "
    + json.dumps(out, ensure_ascii=False, indent=2).replace("\n", "\n  ")
    + ";\n})(typeof window !== 'undefined' ? window : globalThis);\n",
    encoding="utf-8",
)
print("записано:", target.relative_to(HERE.parents[3]))

fig, axes = plt.subplots(1, 2, figsize=(13, 3.8))
names = [s["step"].split(". ")[0] for s in steps]
for key, ax in (("log-loss", axes[0]), ("AP", axes[1])):
    ax.plot(names, [s["valid"][key] for s in steps], marker="o", label="валидация")
    ax.plot(names, [s["test"][key] for s in steps], marker="o", label="тест")
    ax.set(xlabel="шаг", ylabel=key)
    ax.legend()
fig.tight_layout()
ex.finish(fig, "capstone")
