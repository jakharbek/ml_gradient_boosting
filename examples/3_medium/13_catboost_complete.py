"""13. CatBoost от начала до конца: цены квартир, 20 000 объектов.

Цель: полный рабочий цикл CatBoost и его особенности: категории «из коробки», симметричные деревья,
    автоподбор темпа.
Чему научитесь: `Pool` с `cat_features`; `eval_set` и `use_best_model`; значения по умолчанию (1000 деревьев,
    авто-темп); три вида важности: PredictionValuesChange, LossFunctionChange, SHAP; сохранение `.cbm`; отключение
    служебных файлов (`allow_writing_files=False`)
Датасет: _data.make_houses — те же 20 000 квартир, что в примере 11; цель — log(цены).
Этапы: 1) данные  2) по умолчанию  3) с ранней остановкой  4) важности  5) сохранение  6) сравнение с XGBoost.
Попробуйте сами: 1) Поставьте grow_policy="Depthwise" или "Lossguide" и сравните ошибку и время обучения. 2)
    Передайте район числом, без cat_features, — что потеряет модель? 3) Постройте кривые обучения из
    m1.get_evals_result().
Связанные уроки: 9.3 «CatBoost».
Запуск: python examples/3_medium/13_catboost_complete.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_houses  # noqa: E402

ex = Example(__file__, title="13. CatBoost от начала до конца: цены квартир",
             goal="пройти полный цикл CatBoost и увидеть его особенности")

import catboost as cb  # noqa: E402
import numpy as np  # noqa: E402
import xgboost as xgb  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные (цель — логарифм цены)")
X, price = make_houses(ex.size(20_000, 4000))
y = np.log(price)
ex.describe(X, y, target="log(цена)", source="examples/_data.py → make_houses")
n = len(y)
perm = np.random.default_rng(0).permutation(n)
tr, va, te = perm[: int(0.6 * n)], perm[int(0.6 * n): int(0.8 * n)], perm[int(0.8 * n):]
cat_cols = ["район", "ремонт"]
# CatBoost принимает категории строками или целыми числами — переводим pandas.Categorical в строки
Xc = X.assign(**{c: X[c].astype(str) for c in cat_cols})
pool = lambda idx, label=True: cb.Pool(Xc.iloc[idx], y[idx] if label else None, cat_features=cat_cols)
rel_err = lambda logp: float(np.mean(np.abs(price[te] - np.exp(logp)) / price[te]))

# %% Этап 2. По умолчанию
ex.stage(2, "Параметры по умолчанию: 1000 симметричных деревьев глубины 6, темп подбирается сам")
m0 = cb.CatBoostRegressor(verbose=0, random_seed=0, allow_writing_files=False)
with ex.timer("обучение"):
    m0.fit(pool(tr))
params = m0.get_all_params()
print(f"   деревьев {m0.tree_count_}, темп {params['learning_rate']:.4f} (подобран), глубина {params['depth']}, "
      f"рост {params['grow_policy']}, L2 {params['l2_leaf_reg']}")
print(f"   тест: относительная ошибка {rel_err(m0.predict(pool(te, False))):.1%}")

# %% Этап 3. Ранняя остановка
ex.stage(3, "Темп 0.1, до 3000 деревьев, ранняя остановка и use_best_model")
m1 = cb.CatBoostRegressor(iterations=3000, learning_rate=0.1, early_stopping_rounds=200, verbose=0, random_seed=0,
                          allow_writing_files=False)
with ex.timer("обучение"):
    m1.fit(pool(tr), eval_set=pool(va), use_best_model=True)
print(f"   лучшая итерация {m1.get_best_iteration()}, деревьев в модели {m1.tree_count_}")
print(f"   тест: относительная ошибка {rel_err(m1.predict(pool(te, False))):.1%}")
ex.note("""С категориальными признаками CatBoost тратит заметное время на каждое дерево (в нашем окружении — десятки
миллисекунд, урок 9.4), поэтому больший темп и меньше деревьев здесь заметно ускоряют обучение.""")
ex.note("use_best_model=True обрезает модель до лучшей итерации — в отличие от XGBoost, лишних деревьев не остаётся.")

# %% Этап 4. Важности
ex.stage(4, "Три вида важности")
pvc = m1.get_feature_importance(type="PredictionValuesChange")
lfc = m1.get_feature_importance(pool(va), type="LossFunctionChange")
shap_vals = m1.get_feature_importance(pool(te[:1000]), type="ShapValues")
shap_imp = np.abs(shap_vals[:, :-1]).mean(0)
print("   признак       изм. прогноза  изм. потерь   средний |SHAP|")
for j in np.argsort(-shap_imp):
    print(f"   {X.columns[j]:12s} {pvc[j]:12.2f} {lfc[j]:12.5f} {shap_imp[j]:12.4f}")
assert np.allclose(shap_vals.sum(1), m1.predict(pool(te[:1000], False)), atol=1e-6)
order = np.argsort(-shap_imp)
ex.barh({X.columns[j]: shap_imp[j] for j in order}, best=X.columns[order[0]], name="13_shap_importance",
        xlabel="средний |SHAP| в log(цены)", title="CatBoost: что определяет цену квартиры", fmt="{:.3f}")
ex.note("PredictionValuesChange — по обучению, LossFunctionChange — насколько вырастут потери без признака (на валидации).")

# %% Этап 5. Сохранение
ex.stage(5, "Сохранение в .cbm")
with tempfile.TemporaryDirectory() as d:
    path = Path(d) / "houses.cbm"
    m1.save_model(str(path))
    loaded = cb.CatBoostRegressor().load_model(str(path))
    same = np.allclose(loaded.predict(pool(te, False)), m1.predict(pool(te, False)))
    print(f"   файл {path.stat().st_size / 1024:.0f} КБ; прогнозы совпадают: {same}")
assert same

# %% Этап 6. Сравнение
ex.stage(6, "Сравнение с XGBoost на тех же данных (ранняя остановка у обоих)")
xm = xgb.XGBRegressor(n_estimators=5000, learning_rate=0.05, max_depth=6, enable_categorical=True, tree_method="hist",
                      early_stopping_rounds=100).fit(X.iloc[tr], y[tr], eval_set=[(X.iloc[va], y[va])], verbose=False)
print(f"   относительная ошибка на тесте: CatBoost {rel_err(m1.predict(pool(te, False))):.2%}, XGBoost {rel_err(xm.predict(X.iloc[te])):.2%}")
ex.done()
