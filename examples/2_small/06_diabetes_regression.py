"""06. Реальные данные «Диабет» (442 пациента): бустинг против простых моделей.

Цель: честно сравнить бустинг с базовыми моделями на маленьком реальном наборе и понять, почему бустинг
    не обязан выигрывать.
Чему научитесь: разбор реального набора: признаки, масштаб, цель; базовые модели — константа и гребневая регрессия;
    повторная кросс-валидация и разброс оценок; настройка бустинга под маленькие данные
Датасет: sklearn.datasets.load_diabetes — 442 пациента, 10 признаков (возраст, пол, индекс массы тела,
    давление и 6 показателей крови), признаки уже центрированы и масштабированы; цель — прогрессия
    болезни через год (число 25…346). Встроен в scikit-learn, скачивать не нужно.
Этапы: 1) данные  2) базовые модели  3) бустинг по умолчанию и настроенный  4) важные признаки  5) выводы.
Попробуйте сами: 1) Добавьте в сравнение HistGradientBoostingRegressor и LightGBM с параметрами по умолчанию. 2)
    Дайте гребневой регрессии попарные произведения признаков (PolynomialFeatures) — станет ли она ещё лучше? 3)
    Уменьшите темп бустинга до 0.01 и увеличьте число деревьев — изменится ли вывод сравнения?
Связанные уроки: 9.4 «Сравнение», 11.2 «CV и Optuna».
Запуск: python examples/2_small/06_diabetes_regression.py [--save] [--no-show]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="06. Реальные данные «Диабет»: бустинг против простых моделей",
             goal="сравнить модели по повторной кросс-валидации и сделать честный вывод")

import warnings  # noqa: E402

import numpy as np  # noqa: E402
from sklearn.datasets import load_diabetes  # noqa: E402
from sklearn.dummy import DummyRegressor  # noqa: E402
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor  # noqa: E402
from sklearn.linear_model import RidgeCV  # noqa: E402
from sklearn.model_selection import RepeatedKFold, cross_val_score  # noqa: E402

warnings.filterwarnings("ignore")

# %% Этап 1. Данные
ex.stage(1, "Данные")
data = load_diabetes(as_frame=True)
X, y = data.data, data.target.to_numpy()
ex.describe(X, y, target="прогрессия болезни", source="sklearn.datasets.load_diabetes (Efron и др., 2004)")
ex.note("""Признаки уже центрированы и масштабированы (поэтому такие маленькие числа).
bmi — индекс массы тела, bp — давление, s1…s6 — показатели крови.""")

# %% Этап 2–3. Модели
ex.stage(2, "Протокол: 5 фолдов × 3 повтора, метрика RMSE")
cv = RepeatedKFold(n_splits=5, n_repeats=3, random_state=0)
models = {
    "константа (среднее)": DummyRegressor(),
    "гребневая регрессия": RidgeCV(alphas=np.logspace(-3, 3, 20)),
    "случайный лес": RandomForestRegressor(300, min_samples_leaf=5, random_state=0, n_jobs=-1),
    "бустинг по умолчанию": GradientBoostingRegressor(random_state=0),
    "бустинг для малых данных": GradientBoostingRegressor(n_estimators=300, learning_rate=0.02, max_depth=2,
                                                          subsample=0.8, random_state=0),
}
res = {}
for name, model in models.items():
    s = -cross_val_score(model, X, y, cv=cv, scoring="neg_root_mean_squared_error")
    res[name] = (s.mean(), s.std())
    print(f"   {name:26s} RMSE {s.mean():6.2f} ± {s.std():.2f}")
ex.stage(3, "Что получилось")
ex.barh({k: v[0] for k, v in res.items()}, errors={k: v[1] for k, v in res.items()}, best=min(res, key=lambda k: res[k][0]),
        xlabel="RMSE (меньше — лучше); усы — разброс по 15 разбиениям", title="Диабет: 5 фолдов × 3 повтора",
        name="06_models_rmse", fmt="{:.2f}")
ex.note("""Гребневая регрессия — лучшая или не хуже лучшей: зависимость здесь почти линейная, а данных мало.
Бустинг по умолчанию (100 деревьев глубины 3) хуже всех моделей, кроме константы: он переобучается на 350 объектах.
Бустинг «для малых данных» (неглубокие деревья, маленький темп, подвыборка) почти догоняет линейную модель.""")
assert res["гребневая регрессия"][0] <= res["бустинг по умолчанию"][0]
assert res["бустинг для малых данных"][0] < res["бустинг по умолчанию"][0]

# %% Этап 4. Важные признаки
ex.stage(4, "Какие признаки важны (бустинг для малых данных, обученный на всех данных)")
gb = models["бустинг для малых данных"].fit(X, y)
for name, v in sorted(zip(X.columns, gb.feature_importances_), key=lambda t: -t[1])[:5]:
    print(f"   {name:4s} {v:.3f}")

# %% Этап 5. Вывод
ex.stage(5, "Вывод")
ex.note("""На маленьких данных с почти линейной зависимостью начинайте с линейной модели.
Бустинг силён там, где есть нелинейности и взаимодействия и достаточно данных (примеры 11–22).
Разброс оценок между разбиениями (±3–4) сравним с разницей между моделями — без повторной CV вывод был бы случайным.""")
ex.done()
