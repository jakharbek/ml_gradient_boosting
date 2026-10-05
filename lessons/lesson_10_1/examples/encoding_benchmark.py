"""Семь способов подать категориальный признак бустингу: сравнение при разной кардинальности.

Данные: categorical_regression (y = эффект категории + sin(x) + шум, частоты категорий убывают).
Разбиение 60/20/20, три повтора, темп 0.05 с ранней остановкой по валидации, RMSE на тесте.
Кодирования средним и one-hot подаются в LightGBM. Результаты пишутся в lessons/lesson_10_1/web/results.js.

Запуск:  python lessons/lesson_10_1/examples/encoding_benchmark.py [--save] [--no-show]   (≈ 5 минут)
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[3] / "shared" / "python"))

import catboost as cb
import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import xgboost as xgb

from gbcourse import datasets
from gbcourse.cli import Example

ex = Example(__file__)
A_SMOOTH = 10.0  # сила сглаживания среднего к общему среднему


def mean_table(c, y, K, prior, a=A_SMOOTH):
    return (np.bincount(c, y, K) + a * prior) / (np.bincount(c, minlength=K) + a)


def fold_encoding(c, y, K, prior, seed, folds=5):
    fold = np.random.default_rng(seed).permutation(len(y)) % folds
    out = np.empty(len(y))
    for f in range(folds):
        out[fold == f] = mean_table(c[fold != f], y[fold != f], K, prior)[c[fold == f]]
    return out


def run(K, informative, seed):
    x, c, y = datasets.categorical_regression(n=6000, n_categories=K, noise=1.0, seed=140 + seed, informative=informative)
    perm = np.random.default_rng(seed).permutation(len(y))
    tr, va, te = perm[:3600], perm[3600:4800], perm[4800:]
    prior = y[tr].mean()
    rmse = lambda p: float(np.sqrt(np.mean((y[te] - p) ** 2)))

    def lgb_fit(Z, **kw):
        m = lgb.LGBMRegressor(n_estimators=5000, learning_rate=0.05, verbose=-1, random_state=seed, **kw)
        m.fit(Z[tr] if isinstance(Z, np.ndarray) else Z.iloc[tr], y[tr],
              eval_X=(Z[va] if isinstance(Z, np.ndarray) else Z.iloc[va],), eval_y=(y[va],),
              callbacks=[lgb.early_stopping(100, verbose=False)])
        return rmse(m.predict(Z[te] if isinstance(Z, np.ndarray) else Z.iloc[te]))

    r = {}
    r["без категории"] = lgb_fit(x[:, None])
    r["порядковый код"] = lgb_fit(np.c_[x, c].astype(float))
    r["one-hot"] = lgb_fit(np.c_[x, np.eye(K)[c]]) if K <= 100 else None
    tab = mean_table(c[tr], y[tr], K, prior)
    enc = tab[c]
    r["среднее (наивное)"] = lgb_fit(np.c_[x, enc])
    enc_cv = enc.copy()
    enc_cv[tr] = fold_encoding(c[tr], y[tr], K, prior, seed)
    r["среднее по фолдам"] = lgb_fit(np.c_[x, enc_cv])
    D = pd.DataFrame({"x": x, "c": pd.Categorical(c)})
    r["LightGBM встроенная"] = lgb_fit(D)
    m = xgb.XGBRegressor(n_estimators=5000, learning_rate=0.05, early_stopping_rounds=100, enable_categorical=True, random_state=seed)
    m.fit(D.iloc[tr], y[tr], eval_set=[(D.iloc[va], y[va])], verbose=False)
    r["XGBoost встроенная"] = rmse(m.predict(D.iloc[te]))
    Ds = pd.DataFrame({"x": x, "c": c.astype(str)})
    m = cb.CatBoostRegressor(iterations=3000, learning_rate=0.05, early_stopping_rounds=100, verbose=0, random_seed=seed, cat_features=["c"])
    m.fit(Ds.iloc[tr], y[tr], eval_set=(Ds.iloc[va], y[va]))
    r["CatBoost встроенная"] = rmse(m.predict(Ds.iloc[te]))
    return r


SCENARIOS = [(10, True), (100, True), (1000, True), (1000, False)]
rows = []
for K, informative in SCENARIOS:
    for seed in range(3):
        for method, v in run(K, informative, seed).items():
            rows.append({"K": K, "informative": informative, "метод": method, "RMSE": v})
        print(f"K = {K:4d}, категория {'информативна' if informative else 'шум'}, разбиение {seed}: готово", flush=True)
df = pd.DataFrame(rows)
summary = df.groupby(["K", "informative", "метод"], sort=False)["RMSE"].mean().unstack([0, 1])
with pd.option_context("display.width", 200):
    print(summary.round(3))

out = {"methods": list(dict.fromkeys(df["метод"])), "scenarios": []}
for K, informative in SCENARIOS:
    part = df[(df.K == K) & (df.informative == informative)].groupby("метод", sort=False)["RMSE"]
    mean, std = part.mean(), part.std()
    out["scenarios"].append({
        "K": K, "informative": informative,
        "rows": [{"method": mth, "rmse": None if pd.isna(mean[mth]) else round(float(mean[mth]), 4),
                  "std": None if pd.isna(std[mth]) else round(float(std[mth]), 4)} for mth in out["methods"]],
    })
target = HERE.parents[1] / "web" / "results.js"
target.write_text(
    "/* Сгенерировано lessons/lesson_10_1/examples/encoding_benchmark.py — не редактировать вручную. */\n"
    "(function (root) {\n  'use strict';\n  (root.GBC || (root.GBC = {})).encodingBenchmark = "
    + json.dumps(out, ensure_ascii=False, indent=2).replace("\n", "\n  ")
    + ";\n})(typeof window !== 'undefined' ? window : globalThis);\n",
    encoding="utf-8",
)
print("записано:", target.relative_to(HERE.parents[3]))

fig, axes = plt.subplots(1, len(SCENARIOS), figsize=(18, 4), sharey=False)
for ax, sc in zip(axes, out["scenarios"]):
    vals = [r["rmse"] if r["rmse"] is not None else np.nan for r in sc["rows"]]
    ax.barh(range(len(vals)), vals, color="#2a78d6")
    ax.set(yticks=range(len(vals)), yticklabels=out["methods"] if ax is axes[0] else [""] * len(vals),
           xlim=(0.9, max(v for v in vals if not np.isnan(v)) * 1.03),
           title=f"K = {sc['K']}, {'информативна' if sc['informative'] else 'шум'}", xlabel="RMSE на тесте")
    ax.invert_yaxis()
fig.tight_layout()
ex.finish(fig, "encoding_benchmark")
