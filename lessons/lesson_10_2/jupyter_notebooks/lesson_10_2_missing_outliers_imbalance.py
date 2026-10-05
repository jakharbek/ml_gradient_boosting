# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_10_2

# %% [markdown]
# # Урок 10.2. Пропуски, выбросы и несбалансированные классы
#
# **Интерактивная версия:** `lessons/lesson_10_2/web/index.html`
#
# 1. Пропуски: MCAR и MNAR, четыре способа обработки.
# 2. Выбросы в y: потеря × размер листа × число деревьев; порог Хьюбера; обрезка y.
# 3. Веса классов: AUC, вероятности, порог.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, f1_score, log_loss, roc_auc_score
from gbcourse import datasets, GBRegressor

# %% [markdown]
# ## 1. Пропуски в признаке x3
#
# MCAR — 30% значений пропадают случайно. MNAR — значения больше 0.6 пропадают с вероятностью 0.75.
# Метрика — лучшая MSE на валидации (30%), среднее по трём разбиениям.

# %%
params = dict(mode="newton", n_estimators=400, learning_rate=0.05, max_depth=4, reg_lambda=1)
rows = []
for mech in ("MCAR", "MNAR"):
    res = {}
    for s in range(3):
        X, y = datasets.friedman1(n=3000, noise=1.0, seed=150 + s)
        r = np.random.default_rng(s)
        miss = r.random(len(y)) < 0.3 if mech == "MCAR" else (X[:, 3] > 0.6) & (r.random(len(y)) < 0.75)
        Xm = X.copy()
        Xm[miss, 3] = np.nan
        a, b, c, d = datasets.train_test_split(Xm, y, test_size=0.3, seed=s)
        mu = np.nanmean(a[:, 3])

        def impute(Z, indicator=False, mu=mu):          # mu — среднее этого прогона
            Z = Z.copy()
            m = np.isnan(Z[:, 3])
            Z[m, 3] = mu
            return np.c_[Z, m.astype(float)] if indicator else Z

        variants = {"NaN как есть": (a, b), "замена средним": (impute(a), impute(b)),
                    "среднее + индикатор": (impute(a, True), impute(b, True)),
                    "удалить признак": (np.delete(a, 3, 1), np.delete(b, 3, 1))}
        for name, (A, B) in variants.items():
            res.setdefault(name, []).append(2 * min(GBRegressor(**params).fit(A, c, eval_set=(B, d)).history_["eval"]))
        a0, b0, c0, d0 = datasets.train_test_split(X, y, test_size=0.3, seed=s)
        res.setdefault("без пропусков", []).append(2 * min(GBRegressor(**params).fit(a0, c0, eval_set=(b0, d0)).history_["eval"]))
    rows.append({"механизм": mech, **{k: np.mean(v) for k, v in res.items()}})
pd.DataFrame(rows).set_index("механизм").T.round(3)

# %% [markdown]
# ## 2. Выбросы в y
#
# 2% обучающих объектов получают к y ±100. MSE на чистом тесте, среднее по трём разбиениям.

# %%
def outlier_mse(clean=False, clip=None, **model_params):
    """MSE на чистом тесте; clean — без выбросов, clip — обрезка y по квантилям (q_low, q_high)."""
    out = []
    for s in range(3):
        X, y = datasets.friedman1(n=800, noise=1.0, seed=130 + s)
        a, b, c, d = datasets.train_test_split(X, y, test_size=0.3, seed=s)
        r = np.random.default_rng(s)
        idx = r.choice(len(c), size=max(1, len(c) * 2 // 100), replace=False)
        c = c.copy()
        sign = r.choice([-1, 1], size=len(idx))
        if not clean:
            c[idx] += sign * 100
        if clip is not None:
            c = np.clip(c, *np.quantile(c, clip))
        m = GBRegressor(learning_rate=0.05, max_depth=3, **model_params).fit(a, c)
        out.append(np.mean((d - m.predict(b)) ** 2))
    return np.mean(out)


rows = [{"вариант": "чистые данные, L2, 300 деревьев", "MSE": outlier_mse(n_estimators=300, clean=True)}]
for loss, extra in (("squared", {}), ("huber", {"huber_delta": 1.0}), ("absolute", {})):
    for msl, n in ((1, 300), (1, 1000), (20, 1000)):
        rows.append({"вариант": f"{loss}, лист ≥ {msl}, {n} деревьев",
                     "MSE": outlier_mse(loss=loss, min_samples_leaf=msl, n_estimators=n, **extra)})
for delta in (2.0, 5.0):
    rows.append({"вариант": f"huber δ = {delta}, лист ≥ 1, 300 деревьев", "MSE": outlier_mse(loss="huber", huber_delta=delta, n_estimators=300)})
rows.append({"вариант": "L2 + обрезка y по 1–99%, 300 деревьев", "MSE": outlier_mse(n_estimators=300, clip=(0.01, 0.99))})
pd.DataFrame(rows).round(3)

# %% [markdown]
# ## 3. Веса классов

# %%
def make(n, rate, seed):
    r = np.random.default_rng(seed)
    y = (r.random(n) < rate).astype(int)
    X = r.normal(0, 1, (n, 5))
    X[:, 0] += 1.5 * y
    X[:, 1] += 1.0 * y * np.sign(r.normal(size=n))
    return X, y


rows = []
thresholds = np.linspace(0.01, 0.99, 99)
for rate in (0.5, 0.1, 0.02):
    X, y = make(20000, rate, 0)
    X_te, y_te = make(20000, rate, 1)
    for w in sorted({1.0, (1 - rate) / rate}):
        p = lgb.LGBMClassifier(n_estimators=300, learning_rate=0.05, num_leaves=15, scale_pos_weight=w, verbose=-1).fit(X, y).predict_proba(X_te)[:, 1]
        f1 = [f1_score(y_te, p > t) for t in thresholds]
        rows.append({"доля класса 1": rate, "вес": w, "AUC": roc_auc_score(y_te, p), "AP": average_precision_score(y_te, p),
                     "log-loss": log_loss(y_te, p), "средний прогноз": p.mean(), "полнота@0.5": np.mean(p[y_te == 1] > 0.5),
                     "лучший F1": max(f1), "порог лучшего F1": thresholds[int(np.argmax(f1))]})
pd.DataFrame(rows).round(3)

# %% [markdown]
# ## Упражнения
#
# 1. Для MNAR-сценария замените «NaN» значением −1 (вне диапазона признака). Как это соотносится с NaN и индикатором?
# 2. Обучите модель с весом 49 при доле 2% и откалибруйте вероятности: $p' = \frac{p}{p + w(1 - p)}$.
#    Совпадёт ли log-loss с моделью без весов?
#
# Решения: `python lessons/lesson_10_2/exercises/solutions.py`.
