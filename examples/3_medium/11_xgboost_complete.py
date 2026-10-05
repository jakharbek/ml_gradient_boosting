"""11. XGBoost от начала до конца: цены квартир, 20 000 объектов.

Цель: полный рабочий цикл XGBoost на смешанных табличных данных.
Чему научитесь: категории (`enable_categorical`); пропуски «как есть»; sklearn-интерфейс и нативный `xgb.train`;
    ранняя остановка и `best_iteration`; логарифм цели; важности gain и weight; вклады признаков (`pred_contribs`);
    сохранение в JSON и загрузка
Датасет: _data.make_houses — 20 000 квартир, 10 признаков: площадь, комнаты, этаж, этажность, год, расстояние до
    центра, район (30 значений), парковка, ремонт (категория), кухня (5% пропусков); цель — цена, млн.
Этапы: 1) данные  2) разбиение  3) sklearn-интерфейс  4) лог-цель  5) нативный API  6) важности и вклады
    7) сохранение.
Попробуйте сами: 1) Обучите модели с max_depth=4 и 8 — как меняются лучшая итерация и ошибка? 2) Добавьте в таблицу
    важность по покрытию (importance_type="cover") и сравните с gain и weight. 3) Сохраните модель в бинарный формат
    .ubj и сравните размер файла с JSON.
Связанные уроки: 9.1 «XGBoost на практике», 8 «XGBoost изнутри».
Запуск: python examples/3_medium/11_xgboost_complete.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_houses  # noqa: E402

ex = Example(__file__, title="11. XGBoost от начала до конца: цены квартир",
             goal="пройти полный цикл XGBoost на смешанных данных")

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import xgboost as xgb  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
X, y = make_houses(ex.size(20_000, 4000))
ex.describe(X, y, target="цена, млн", source="examples/_data.py → make_houses (синтетика с известной зависимостью)")

# %% Этап 2. Разбиение
ex.stage(2, "Разбиение 60 / 20 / 20: обучение, валидация (остановка), тест (итог)")
n = len(y)
perm = np.random.default_rng(0).permutation(n)
tr, va, te = perm[: int(0.6 * n)], perm[int(0.6 * n): int(0.8 * n)], perm[int(0.8 * n):]
rmse = lambda a, b: float(np.sqrt(np.mean((a - b) ** 2)))
mape = lambda a, b: float(np.mean(np.abs(a - b) / a))
print(f"   {len(tr)} / {len(va)} / {len(te)};  RMSE константы на тесте: {rmse(y[te], np.full(len(te), y[tr].mean())):.3f}")

# %% Этап 3. sklearn-интерфейс
ex.stage(3, "XGBRegressor: категории и пропуски без подготовки, ранняя остановка")
model = xgb.XGBRegressor(n_estimators=5000, learning_rate=0.05, max_depth=6, subsample=0.8, colsample_bytree=0.8,
                         enable_categorical=True, tree_method="hist", early_stopping_rounds=100, eval_metric="rmse")
with ex.timer("обучение"):
    model.fit(X.iloc[tr], y[tr], eval_set=[(X.iloc[tr], y[tr]), (X.iloc[va], y[va])], verbose=False)  # остановка — по последней
p = model.predict(X.iloc[te])
print(f"   лучшая итерация {model.best_iteration} (деревьев в модели {model.get_booster().num_boosted_rounds()})")
print(f"   тест: RMSE {rmse(y[te], p):.3f} млн, средняя относительная ошибка {mape(y[te], p):.1%}")
ex.note("Категории (район, ремонт) и пропуски (кухня) XGBoost принимает сам — без кодирования и заполнения.")
curves = model.evals_result()
fig, ax = plt.subplots(figsize=(8, 3.6))
ax.plot(curves["validation_0"]["rmse"], color=ROLE["train"], lw=2, label="обучение")
ax.plot(curves["validation_1"]["rmse"], color=ROLE["valid"], lw=2, label="валидация")
ax.axvline(model.best_iteration, color=ROLE["truth"], ls="--", lw=1.5, label=f"лучшая итерация {model.best_iteration}")
ax.set(xlabel="число деревьев", ylabel="RMSE, млн", ylim=(0, 3), title="Кривые обучения XGBoost и ранняя остановка")
ax.legend()
ex.finish(fig, "11_learning_curves")

# %% Этап 4. Логарифм цели
ex.stage(4, "Цены распределены с длинным хвостом — обучаем на log(цены)")
m_log = xgb.XGBRegressor(n_estimators=5000, learning_rate=0.05, max_depth=6, subsample=0.8, colsample_bytree=0.8,
                         enable_categorical=True, tree_method="hist", early_stopping_rounds=100)
m_log.fit(X.iloc[tr], np.log(y[tr]), eval_set=[(X.iloc[va], np.log(y[va]))], verbose=False)
p_log = np.exp(m_log.predict(X.iloc[te]))
print(f"   тест: RMSE {rmse(y[te], p_log):.3f} млн, относительная ошибка {mape(y[te], p_log):.1%}")
ex.note("""Мультипликативная цена (площадь × цена м² × множители) в логарифмах становится суммой. Здесь это дало небольшое
улучшение; на данных с более длинным хвостом цен разница обычно больше. Предел точности — шум 8%: средняя
относительная ошибка идеальной модели около 6.4%, так что 7% — близко к потолку.
Прогноз exp(·) оценивает медиану, а не среднее: при шуме 8% разница с средним ≈ 0.3%.""")

# %% Этап 5. Нативный API
ex.stage(5, "Нативный интерфейс: DMatrix + xgb.train — то же самое, но с полным контролем")
dtr = xgb.DMatrix(X.iloc[tr], label=np.log(y[tr]), enable_categorical=True)
dva = xgb.DMatrix(X.iloc[va], label=np.log(y[va]), enable_categorical=True)
dte = xgb.DMatrix(X.iloc[te], enable_categorical=True)
params = {"eta": 0.05, "max_depth": 6, "subsample": 0.8, "colsample_bytree": 0.8, "tree_method": "hist", "eval_metric": "rmse"}
bst = xgb.train(params, dtr, num_boost_round=5000, evals=[(dva, "val")], early_stopping_rounds=100, verbose_eval=False)
p_nat = np.exp(bst.predict(dte, iteration_range=(0, bst.best_iteration + 1)))
print(f"   лучшая итерация {bst.best_iteration}; RMSE {rmse(y[te], p_nat):.3f} млн")
ex.note("В нативном API прогноз лучшей итерации нужно запросить явно: iteration_range=(0, best_iteration + 1).")

# %% Этап 6. Важности и вклады
ex.stage(6, "Важности (gain против weight) и вклады признаков для одной квартиры")
gain = bst.get_score(importance_type="gain")
weight = bst.get_score(importance_type="weight")
print("   признак        gain   разбиений")
for f in sorted(gain, key=gain.get, reverse=True):
    print(f"   {f:12s} {gain[f]:8.3f} {int(weight[f]):8d}")
ex.note("У района больше всего разбиений, но по среднему выигрышу он лишь третий: число разбиений — плохая мера важности.")
contrib = bst.predict(dte, pred_contribs=True, iteration_range=(0, bst.best_iteration + 1))
i = 0
print(f"   квартира {i}: " + ", ".join(f"{c}={X.iloc[te[i]][c]}" for c in ["площадь", "район", "ремонт", "до_центра_км"]))
top = np.argsort(-np.abs(contrib[i, :-1]))[:4]
print("   главные вклады в log(цены): " + ", ".join(f"{X.columns[j]} {contrib[i, j]:+.3f}" for j in top)
      + f"; база {contrib[i, -1]:.3f}")
assert abs(contrib[i].sum() - bst.predict(dte, output_margin=True, iteration_range=(0, bst.best_iteration + 1))[i]) < 1e-3

# %% Этап 7. Сохранение
ex.stage(7, "Сохранение в JSON и загрузка")
with tempfile.TemporaryDirectory() as d:
    path = Path(d) / "houses.json"
    bst.save_model(path)
    loaded = xgb.Booster()
    loaded.load_model(path)
    same = np.allclose(loaded.predict(dte, iteration_range=(0, bst.best_iteration + 1)), np.log(p_nat))
    print(f"   размер файла {path.stat().st_size / 1024:.0f} КБ; прогнозы после загрузки совпадают: {same}")
assert same
ex.done()
