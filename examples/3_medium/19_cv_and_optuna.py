"""19. Настройка гиперпараметров: кросс-валидация LightGBM и поиск Optuna.

Цель: настроить бустинг правильно — оценка по кросс-валидации, умный поиск, честный итог на тесте.
Чему научитесь: `lgb.cv` с ранней остановкой внутри фолдов; пространство поиска в логарифмической шкале; TPE-сэмплер
    Optuna; итоговое обучение и честная проверка на отложенном тесте
Датасет: _data.make_houses — 20 000 квартир, цель — log(цены); 20% — отложенный тест, который не участвует
    в поиске.
Этапы: 1) данные  2) база — параметры по умолчанию  3) пространство и целевая функция  4) поиск  5) итог.
Попробуйте сами: 1) Добавьте темп обучения в пространство поиска (0.01–0.3, лог-шкала) — что найдёт TPE? 2)
    Повторите поиск с optuna.samplers.RandomSampler при тех же 25 запусках и сравните кривые. 3) Оцените важность
    гиперпараметров: optuna.importance.get_param_importances(study).
Связанные уроки: 11 «Настройка», 11.1 «Стратегия», 11.2 «CV и Optuna».
Запуск: python examples/3_medium/19_cv_and_optuna.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_houses  # noqa: E402

ex = Example(__file__, title="19. Кросс-валидация и Optuna",
             goal="настроить LightGBM поиском с честной итоговой оценкой")

import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import optuna  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402

optuna.logging.set_verbosity(optuna.logging.WARNING)

# %% Этап 1. Данные
ex.stage(1, "Данные: 80% для поиска (кросс-валидация), 20% — отложенный тест")
X, price = make_houses(ex.size(20_000, 4000), seed=19)
y = np.log(price)
ex.describe(X, y, target="log(цена)", source="examples/_data.py → make_houses")
n = len(y)
perm = np.random.default_rng(0).permutation(n)
dev, te = perm[: int(0.8 * n)], perm[int(0.8 * n):]
rmse = lambda a, b: float(np.sqrt(np.mean((a - b) ** 2)))


def cv_score(params):
    """5-кратная CV с ранней остановкой внутри фолдов; возвращает RMSE и лучшее число деревьев."""
    ds = lgb.Dataset(X.iloc[dev], y[dev], free_raw_data=False)
    res = lgb.cv({"objective": "regression", "metric": "rmse", "verbose": -1, "seed": 0, **params}, ds,
                 num_boost_round=5000, nfold=5, stratified=False, seed=0,
                 callbacks=[lgb.early_stopping(100, verbose=False)])
    curve = res["valid rmse-mean"]
    return float(curve[-1]), len(curve)


# %% Этап 2. База
ex.stage(2, "База: параметры по умолчанию, ν = 0.05")
base_params = {"learning_rate": 0.05}
with ex.timer("кросс-валидация"):
    base_rmse, base_trees = cv_score(base_params)
print(f"   CV RMSE {base_rmse:.4f} при {base_trees} деревьях")

# %% Этап 3. Пространство
ex.stage(3, "Пространство поиска: размер деревьев, листья, случайность, штрафы — в лог-шкале, где нужно")


def objective(trial):
    params = {
        "learning_rate": 0.05,
        "num_leaves": trial.suggest_int("num_leaves", 4, 256, log=True),
        "min_child_samples": trial.suggest_int("min_child_samples", 5, 200, log=True),
        "feature_fraction": trial.suggest_float("feature_fraction", 0.4, 1.0),
        "bagging_fraction": trial.suggest_float("bagging_fraction", 0.5, 1.0),
        "bagging_freq": 1,
        "lambda_l2": trial.suggest_float("lambda_l2", 1e-3, 100, log=True),
        "cat_smooth": trial.suggest_float("cat_smooth", 1, 100, log=True),
    }
    score, trees = cv_score(params)
    trial.set_user_attr("trees", trees)
    return score


# %% Этап 4. Поиск
ex.stage(4, "Поиск: TPE, 25 запусков (первые 10 — случайные)")
study = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=0, n_startup_trials=10))
with ex.timer("поиск"):
    study.optimize(objective, n_trials=ex.size(25, 8))
best_curve = np.minimum.accumulate([t.value for t in study.trials])
for k in (1, 5, 10, 15, 20, 25):
    if k <= len(best_curve):
        print(f"   после {k:2d} запусков лучшая CV RMSE {best_curve[k - 1]:.4f}")
fig, ax = plt.subplots(figsize=(8, 3.6))
k = np.arange(1, len(study.trials) + 1)
ax.plot(k, [t.value for t in study.trials], "o", color=ROLE["model_prev"], ms=5, label="запуск")
ax.plot(k, best_curve, color=ROLE["model"], lw=2, label="лучший на данный момент")
ax.axhline(base_rmse, color=ROLE["truth"], ls="--", lw=1.5, label="параметры по умолчанию")
ax.set(xlabel="номер запуска", ylabel="CV RMSE log(цены)", title="Поиск Optuna (TPE): первые 10 запусков случайные")
ax.legend()
ex.finish(fig, "19_optuna_progress")
print("   лучшие параметры: " + ", ".join(f"{k}={v:.3g}" if isinstance(v, float) else f"{k}={v}" for k, v in study.best_params.items()))

# %% Этап 5. Итог
ex.stage(5, "Итог: обучаем на всех 80% с найденным числом деревьев и смотрим тест ОДИН раз")
final = {"objective": "regression", "learning_rate": 0.05, "bagging_freq": 1, "verbose": -1, "seed": 0, **study.best_params}
trees = study.best_trial.user_attrs["trees"]
model = lgb.train(final, lgb.Dataset(X.iloc[dev], y[dev]), num_boost_round=int(trees * 1.1))
base_model = lgb.train({"objective": "regression", "learning_rate": 0.05, "verbose": -1, "seed": 0},
                       lgb.Dataset(X.iloc[dev], y[dev]), num_boost_round=int(base_trees * 1.1))
print(f"   тест RMSE: база {rmse(y[te], base_model.predict(X.iloc[te])):.4f}, после поиска {rmse(y[te], model.predict(X.iloc[te])):.4f}")
print(f"   CV RMSE лучшего запуска {study.best_value:.4f} — оценка слегка оптимистична: из многих вариантов выбран лучший")
ex.note("""Число деревьев на всех данных берут чуть больше найденного в CV (данных стало на 25% больше).
Тест не участвовал ни в одном выборе — поэтому его оценке можно верить.""")
ex.done()
