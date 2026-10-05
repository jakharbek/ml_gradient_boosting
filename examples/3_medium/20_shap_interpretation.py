"""20. Интерпретация модели с SHAP: от общей картины до одной квартиры.

Цель: объяснить модель бустинга стандартными инструментами библиотеки shap.
Чему научитесь: `shap.TreeExplainer` и аддитивность вкладов; сводный график (beeswarm); график зависимости; значения
    взаимодействий SHAP; «водопад» для одного объекта; как проверить, что модель нашла истинную структуру
Датасет: _data.make_houses — 20 000 квартир, цель — log(цены). Истинная зависимость известна: цена ~ площадь,
    район, расстояние, ремонт; первый и последний этажи дешевле; новые дома дороже только близко к центру.
Этапы: 1) данные и модель  2) аддитивность  3) сводный график  4) зависимости и взаимодействия  5) один объект.
Попробуйте сами: 1) Постройте графики зависимости для площади и района. 2) Объясните водопадом самую дорогую и самую
    дешёвую квартиру выборки. 3) Сравните порядок признаков по среднему |SHAP| и по важности gain XGBoost.
Связанные уроки: 12 «Интерпретация», 12.2 «SHAP».
Запуск: python examples/3_medium/20_shap_interpretation.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_houses  # noqa: E402

ex = Example(__file__, title="20. Интерпретация с SHAP",
             goal="объяснить модель целиком и отдельный прогноз и сверить с истинной структурой")

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import shap  # noqa: E402
import xgboost as xgb  # noqa: E402

# %% Этап 1. Данные и модель
ex.stage(1, "Данные и модель (категории — числовыми кодами: так shap работает с XGBoost 3.x без оговорок)")
X, price = make_houses(ex.size(20_000, 4000), seed=20)
y = np.log(price)
Xn = X.assign(район=X["район"].cat.codes, ремонт=X["ремонт"].cat.codes)
ex.describe(Xn, y, target="log(цена)", source="examples/_data.py → make_houses")
model = xgb.XGBRegressor(n_estimators=600, learning_rate=0.05, max_depth=6, subsample=0.8).fit(Xn, y)

# %% Этап 2. Аддитивность
ex.stage(2, "TreeExplainer: база + сумма вкладов = прогноз")
sample = Xn.iloc[:2000]
explainer = shap.TreeExplainer(model)
sv = explainer.shap_values(sample)
base = float(np.ravel(explainer.expected_value)[0])
err = np.abs(base + sv.sum(1) - model.predict(sample, output_margin=True)).max()
print(f"   база φ₀ = {base:.4f}; наибольшая ошибка аддитивности {err:.1e}")
assert err < 1e-3

# %% Этап 3. Сводный график
ex.stage(3, "Средний |SHAP| и сводный график")
imp = np.abs(sv).mean(0)
for j in np.argsort(-imp):
    print(f"   {Xn.columns[j]:12s} {imp[j]:.4f}")
shap.summary_plot(sv, sample, show=False)
ex.finish(plt.gcf(), "20_shap_summary")

# %% Этап 4. Зависимости и взаимодействия
ex.stage(4, "Проверяем, нашла ли модель заложенные эффекты")
floor_first = (sample["этаж"] == 1) | (sample["этаж"] == sample["этажность"])
j = list(Xn.columns).index("этаж")
print(f"   вклад этажа: крайние этажи {sv[floor_first.to_numpy(), j].mean():+.4f}, остальные {sv[~floor_first.to_numpy(), j].mean():+.4f}"
      f"  (заложено: крайние дешевле на 8% → log ≈ −0.083)")
ex.note("""Модель нашла эффект, но смягчила его: разница крайних и остальных этажей около −0.05 при истинной −0.083.
Часть эффекта SHAP относит к «этажности», с которой этаж связан. Значения Шепли описывают модель, а не мир.""")
iv = explainer.shap_interaction_values(sample.iloc[:500])
inter = np.abs(iv).mean(0)
np.fill_diagonal(inter, 0)
a, b = np.unravel_index(np.argmax(inter), inter.shape)
print(f"   самое сильное взаимодействие по SHAP: {Xn.columns[a]} × {Xn.columns[b]}")
assert {Xn.columns[a], Xn.columns[b]} == {"год", "до_центра_км"}
jy, jd = list(Xn.columns).index("год"), list(Xn.columns).index("до_центра_км")
print(f"   взаимодействие «год × до центра» (заложено: новизна важна только близко к центру): {inter[jy, jd]:.4f}")
ex.note("Самое сильное взаимодействие — именно заложенное в данные: «год постройки × расстояние до центра».")
shap.dependence_plot("год", sv, sample, interaction_index="до_центра_км", show=False)
ex.finish(plt.gcf(), "20_shap_dependence_year")

# %% Этап 5. Один объект
ex.stage(5, "Объяснение одной квартиры (водопад)")
i = 0
print("   квартира: " + ", ".join(f"{c}={X.iloc[i][c]}" for c in X.columns[:7]))
print(f"   прогноз {np.exp(model.predict(Xn.iloc[:1])[0]):.2f} млн, факт {price[i]:.2f} млн")
exp1 = shap.Explanation(values=sv[i], base_values=base, data=sample.iloc[i].to_numpy(), feature_names=list(Xn.columns))
shap.plots.waterfall(exp1, show=False)
ex.finish(plt.gcf(), "20_shap_waterfall")
ex.done()
