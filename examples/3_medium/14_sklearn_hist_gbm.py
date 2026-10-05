"""14. HistGradientBoosting из scikit-learn: бустинг без дополнительных библиотек.

Цель: освоить встроенный в scikit-learn гистограммный бустинг — он есть везде, где есть sklearn.
Чему научитесь: пропуски и категории «из коробки» (`categorical_features="from_dtype"`); автоматическая ранняя
    остановка (`early_stopping="auto"` включается от 10 000 объектов); монотонные ограничения (`monotonic_cst`);
    место в `Pipeline` и `cross_validate`; сравнение со старым `GradientBoostingRegressor`
Датасет: _data.make_houses — 20 000 квартир; цель — log(цены).
Этапы: 1) данные  2) модель по умолчанию  3) ранняя остановка  4) ограничения  5) кросс-валидация  6) сравнение
    со старым GradientBoostingRegressor.
Попробуйте сами: 1) Отключите категории (categorical_features=None) — сколько теряет модель? 2) Задайте
    interaction_cst и проверьте, как меняется ошибка. 3) Сравните с LightGBM при одинаковых числе листьев, темпе и
    числе итераций.
Связанные уроки: 8.3 «Поиск разбиений», 12.3 «PDP, ICE, монотонность».
Запуск: python examples/3_medium/14_sklearn_hist_gbm.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_houses  # noqa: E402

ex = Example(__file__, title="14. HistGradientBoosting из scikit-learn",
             goal="освоить встроенный в sklearn гистограммный бустинг")

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402
from sklearn.ensemble import GradientBoostingRegressor, HistGradientBoostingRegressor  # noqa: E402
from sklearn.model_selection import KFold, cross_validate  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
X, price = make_houses(ex.size(20_000, 4000))
y = np.log(price)
ex.describe(X, y, target="log(цена)", source="examples/_data.py → make_houses")
n = len(y)
perm = np.random.default_rng(0).permutation(n)
tr, te = perm[: int(0.8 * n)], perm[int(0.8 * n):]
rel = lambda p: float(np.mean(np.abs(price[te] - np.exp(p)) / price[te]))

# %% Этап 2. По умолчанию
ex.stage(2, "По умолчанию: категории по типу столбца, пропуски как есть")
m = HistGradientBoostingRegressor(random_state=0)
with ex.timer("обучение"):
    m.fit(X.iloc[tr], y[tr])
print(f"   категориальные признаки: {[c for c, f in zip(X.columns, m.is_categorical_) if f]}")
print(f"   ранняя остановка: {m.early_stopping} → итераций {m.n_iter_} из {m.max_iter}")
print(f"   тест: относительная ошибка {rel(m.predict(X.iloc[te])):.2%}")
ex.note("early_stopping='auto' включается при n > 10 000: sklearn сам отрезает 10% на валидацию.")

# %% Этап 3. Ранняя остановка вручную
ex.stage(3, "Больше итераций и меньший темп, ранняя остановка явно")
m2 = HistGradientBoostingRegressor(max_iter=3000, learning_rate=0.05, max_leaf_nodes=31, early_stopping=True,
                                   validation_fraction=0.2, n_iter_no_change=50, random_state=0)
with ex.timer("обучение"):
    m2.fit(X.iloc[tr], y[tr])
print(f"   итераций {m2.n_iter_}; тест: относительная ошибка {rel(m2.predict(X.iloc[te])):.2%}")

# %% Этап 4. Ограничения
ex.stage(4, "Ограничения: цена не убывает с площадью и не растёт с расстоянием до центра")
mono = [1 if c == "площадь" else -1 if c == "до_центра_км" else 0 for c in X.columns]
m3 = HistGradientBoostingRegressor(max_iter=3000, learning_rate=0.05, early_stopping=True, validation_fraction=0.2,
                                   n_iter_no_change=50, monotonic_cst=mono, random_state=0).fit(X.iloc[tr], y[tr])
area = np.linspace(20, 150, 50)


def worst_dip(model, n_obj=200):
    """Для 200 квартир теста меняем только площадь; возвращаем долю квартир с «провалом» и самую глубокую."""
    dips = []
    for i in te[:n_obj]:
        g = X.iloc[[i] * len(area)].copy()
        g["площадь"] = area
        dips.append((-np.diff(model.predict(g))).max())      # > 0: прогноз где-то падает с ростом площади
    dips = np.array(dips)
    return float(np.mean(dips > 1e-12)), te[int(np.argmax(dips))]


share_free, worst = worst_dip(m2)
share_mono, _ = worst_dip(m3)
print(f"   тест: относительная ошибка {rel(m3.predict(X.iloc[te])):.2%}")
print(f"   квартир, у которых прогноз где-то падает с ростом площади: без ограничений {share_free:.0%}, с ограничением {share_mono:.0%}")
assert share_mono == 0
grid = X.iloc[[worst] * len(area)].copy()
grid["площадь"] = area
fig, ax = plt.subplots(figsize=(8, 3.6))
ax.plot(area, np.exp(m2.predict(grid)), color=ROLE["model_prev"], lw=2, label="без ограничений")
ax.plot(area, np.exp(m3.predict(grid)), color=ROLE["model"], lw=2, label="монотонность по площади")
ax.set(xlabel="площадь, м² (остальные признаки — как у одной квартиры)", ylabel="прогноз цены, млн",
       title="Квартира с самым заметным «провалом» без ограничения")
ax.legend()
ex.finish(fig, "14_monotonic")
ex.note(f"""Даже на 16 000 квартир у {share_free:.0%} из них прогноз где-то падает с ростом площади — модель подгоняет шум.
С ограничением таких квартир нет, и это гарантия для любых входов, а не только проверенных. Истинная зависимость
здесь монотонна, поэтому по качеству ограничение почти ничего не стоит.""")

# %% Этап 5. Кросс-валидация
ex.stage(5, "cross_validate: 5 фолдов — модель ведёт себя как любой оценщик sklearn")
cv = cross_validate(HistGradientBoostingRegressor(random_state=0), X, y, cv=KFold(5, shuffle=True, random_state=0),
                    scoring="neg_root_mean_squared_error", return_train_score=True)
print(f"   RMSE log-цены: обучение {-cv['train_score'].mean():.4f}, проверка {-cv['test_score'].mean():.4f} ± {cv['test_score'].std():.4f}; "
      f"время на фолд {cv['fit_time'].mean():.2f} с")

# %% Этап 6. Сравнение со старым GBR
ex.stage(6, "Старый GradientBoostingRegressor: без гистограмм, без категорий и пропусков")
Xn = X.assign(район=X["район"].cat.codes, ремонт=X["ремонт"].cat.codes, кухня=X["кухня"].fillna(X["кухня"].median()))
with ex.timer("GradientBoostingRegressor, 300 деревьев"):
    old = GradientBoostingRegressor(n_estimators=300, max_depth=5, learning_rate=0.1, random_state=0).fit(Xn.iloc[tr], y[tr])
print(f"   тест: относительная ошибка {rel(old.predict(Xn.iloc[te])):.2%}")
ex.note("Для данных больше нескольких тысяч строк выбирайте HistGradientBoosting: он в разы быстрее и понимает категории и пропуски.")
ex.done()
