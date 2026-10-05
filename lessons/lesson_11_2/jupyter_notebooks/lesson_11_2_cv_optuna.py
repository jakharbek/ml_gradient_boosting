# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_11_2

# %% [markdown]
# # Урок 11.2. Кросс-валидация и поиск параметров
#
# **Интерактивная версия:** `lessons/lesson_11_2/web/index.html`
#
# 1. Разброс оценки: одно разбиение против 5-кратной кросс-валидации.
# 2. Сетка против случайного поиска на готовой поверхности ошибки (`examples/search_grid.py`).
# 3. Optuna: TPE против случайного поиска на живых запусках LightGBM.
# 4. Отсечение неудачных запусков (pruning).

# %%
import json
import sys
import time
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import lightgbm as lgb
import numpy as np
import optuna
import pandas as pd
from gbcourse import datasets

optuna.logging.set_verbosity(optuna.logging.WARNING)
X, y = datasets.friedman1(n=4000, noise=1.0, seed=170)

# %% [markdown]
# ## 1. Одно разбиение против кросс-валидации
#
# Оценим две конфигурации (31 и 4 листа) десятью способами: 10 разных разбиений 80/20 и 10 разных 5-кратных CV.
# Первые 3200 объектов — «данные для настройки», последние 800 не трогаем.

# %%
Xd, yd = X[:3200], y[:3200]


def fit_score(params, tr, va):
    m = lgb.LGBMRegressor(n_estimators=300, learning_rate=0.1, verbose=-1, **params).fit(Xd[tr], yd[tr])
    return float(np.sqrt(np.mean((yd[va] - m.predict(Xd[va])) ** 2)))


rows = []
for name, params in (("31 лист", {"num_leaves": 31}), ("4 листа", {"num_leaves": 4})):
    single, cv = [], []
    for s in range(10):
        perm = np.random.default_rng(100 + s).permutation(len(yd))
        single.append(fit_score(params, perm[:2560], perm[2560:]))
        folds = np.array_split(perm, 5)
        cv.append(np.mean([fit_score(params, np.concatenate(folds[:k] + folds[k + 1:]), folds[k]) for k in range(5)]))
    rows.append({"конфигурация": name, "одно разбиение: среднее": np.mean(single), "одно разбиение: σ": np.std(single),
                 "5-кратная CV: среднее": np.mean(cv), "5-кратная CV: σ": np.std(cv)})
pd.DataFrame(rows).round(4)

# %% [markdown]
# ## 2. Сетка против случайного поиска
#
# Поверхность: RMSE на валидации в 528 точках (num_leaves × colsample_bytree × subsample).

# %%
js = (ROOT / "lessons" / "lesson_11_2" / "web" / "results.js").read_text(encoding="utf-8")
G = json.loads(js[js.index(".searchGrid = ") + len(".searchGrid = "): js.rindex(";\n})")])
V = np.array(G["values"]).reshape(G["shape"])
rng = np.random.default_rng(0)
rows = []
for k in (2, 3, 4):
    n = k**3
    idx = [np.unique(np.linspace(0, s - 1, k).round().astype(int)) for s in V.shape]
    grid_best = V[np.ix_(*idx)].min()
    rnd = np.array([V.ravel()[rng.choice(V.size, n, replace=False)].min() for _ in range(2000)])
    rows.append({"бюджет": n, "сетка: лучшая RMSE": grid_best, "значений num_leaves в сетке": len(idx[0]),
                 "случайный: средняя лучшая": rnd.mean(), "P(случайный лучше сетки)": np.mean(rnd < grid_best)})
print("глобальный минимум поверхности:", V.min())
pd.DataFrame(rows).round(4)

# %% [markdown]
# ## 3. Optuna: TPE против случайного поиска
#
# Шесть параметров, 40 запусков, три повтора с разными зёрнами сэмплера. Первые 10 запусков TPE — случайные
# (`n_startup_trials=10`), затем он строит модель «хороших» и «плохих» областей и предлагает точки из хороших.

# %%
perm = np.random.default_rng(0).permutation(len(y))
tr, va, te = perm[:2400], perm[2400:3200], perm[3200:]


def objective(trial):
    params = dict(
        num_leaves=trial.suggest_int("num_leaves", 2, 128, log=True),
        learning_rate=trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
        colsample_bytree=trial.suggest_float("colsample_bytree", 0.3, 1.0),
        subsample=trial.suggest_float("subsample", 0.5, 1.0),
        min_child_samples=trial.suggest_int("min_child_samples", 2, 100, log=True),
        reg_lambda=trial.suggest_float("reg_lambda", 1e-3, 100, log=True),
    )
    m = lgb.LGBMRegressor(n_estimators=5000, subsample_freq=1, verbose=-1, random_state=0, **params)
    m.fit(X[tr], y[tr], eval_X=(X[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(50, verbose=False)])
    return float(np.sqrt(min(m.evals_result_["valid_0"]["l2"])))


t0 = time.perf_counter()
curves, studies = {}, {}
for name, sampler in (("случайный", optuna.samplers.RandomSampler), ("TPE", optuna.samplers.TPESampler)):
    runs = []
    for s in range(3):
        study = optuna.create_study(sampler=sampler(seed=s))
        study.optimize(objective, n_trials=40)
        runs.append(np.minimum.accumulate([t.value for t in study.trials]))
        studies[(name, s)] = study
    curves[name] = np.mean(runs, axis=0)
print(f"время: {time.perf_counter() - t0:.0f} с")
pd.DataFrame({name: {f"после {n} запусков": c[n - 1] for n in (5, 10, 20, 40)} for name, c in curves.items()}).round(4)

# %%
best = min((st for (nm, _), st in studies.items() if nm == "TPE"), key=lambda st: st.best_value)
print("лучшие параметры TPE:", {k: round(v, 4) if isinstance(v, float) else v for k, v in best.best_params.items()})
m = lgb.LGBMRegressor(n_estimators=5000, subsample_freq=1, verbose=-1, random_state=0, **best.best_params)
m.fit(X[tr], y[tr], eval_X=(X[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(50, verbose=False)])
print(f"валидация {best.best_value:.4f}, тест (смотрим один раз) {np.sqrt(np.mean((y[te] - m.predict(X[te])) ** 2)):.4f}")

# %% [markdown]
# ## 4. Отсечение неудачных запусков
#
# `optuna.integration`-колбэки или ручной `trial.report` + `trial.should_prune()`: запуск, который на ранних
# деревьях хуже медианы предыдущих, останавливается.

# %%
def objective_pruned(trial):
    params = dict(num_leaves=trial.suggest_int("num_leaves", 2, 128, log=True),
                  learning_rate=trial.suggest_float("learning_rate", 0.01, 0.3, log=True))
    booster = None
    for step in range(1, 21):  # 20 порций по 50 деревьев
        m = lgb.LGBMRegressor(n_estimators=50, verbose=-1, **params).fit(X[tr], y[tr], init_model=booster)
        booster = m.booster_
        score = float(np.sqrt(np.mean((y[va] - m.predict(X[va])) ** 2)))
        trial.report(score, step)
        if trial.should_prune():
            raise optuna.TrialPruned()
    return score


study = optuna.create_study(sampler=optuna.samplers.TPESampler(seed=0), pruner=optuna.pruners.MedianPruner(n_startup_trials=5, n_warmup_steps=2))
t0 = time.perf_counter()
study.optimize(objective_pruned, n_trials=30)
states = pd.Series([t.state.name for t in study.trials]).value_counts()
print(f"время {time.perf_counter() - t0:.0f} с; исходы запусков:", {k: int(v) for k, v in states.items()})
# Пространство здесь другое (два параметра, без ранней остановки), поэтому сравнивать лучшую RMSE с разделом 3 нельзя:
# пример показывает механику и экономию запусков.

# %% [markdown]
# ## Упражнения
#
# 1. Оцените лучшую конфигурацию TPE вложенной кросс-валидацией (внешние 5 фолдов, внутри — Optuna на 15 запусков).
#    Насколько внешняя оценка хуже внутренней?
# 2. На поверхности из раздела 2 найдите бюджет, при котором сетка догоняет случайный поиск.
#
# Решения: `python lessons/lesson_11_2/exercises/solutions.py`.
