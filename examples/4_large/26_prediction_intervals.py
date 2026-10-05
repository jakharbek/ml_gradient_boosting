"""26. Интервалы прогноза: квантильный бустинг и конформная калибровка (CQR).

Цель: выдавать не только число, но и честный диапазон «цена будет от … до … с вероятностью 90%».
Чему научитесь: квантильная потеря (pinball) для нижней и верхней границ; проверка покрытия и ширины; конформная
    калибровка (CQR) на отдельной выборке — гарантия покрытия без предположений о распределении; почему интервал
    постоянной ширины плох при неоднородном шуме
Датасет: _data.make_houses — 40 000 квартир; цель — цена в млн (не логарифм): шум мультипликативный,
    поэтому у дорогих квартир разброс в рублях больше — интервалы должны расширяться.
Этапы: 1) данные  2) интервал постоянной ширины  3) квантильный бустинг  4) CQR  5) покрытие по группам  6) выводы.
Попробуйте сами: 1) Поставьте ALPHA = 0.2 (интервал на 80%) и проверьте покрытие. 2) Уменьшите калибровочную выборку
    до 200 объектов и повторите с разными seed — насколько гуляет покрытие? 3) Обучите квантили на log(цены) и
    переведите границы обратно через exp.
Связанные уроки: 5.3 «Потери для регрессии» (квантильная), 13.2 «Калибровка и интервалы».
Запуск: python examples/4_large/26_prediction_intervals.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_houses  # noqa: E402

ex = Example(__file__, title="26. Интервалы прогноза: квантили и CQR",
             goal="выдавать прогноз с честным интервалом на 90%")

import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402

ALPHA = 0.10                                                  # хотим покрытие 90%

# %% Этап 1. Данные
ex.stage(1, "Данные: обучение 50%, валидация 10%, калибровка 20%, тест 20%")
X, y = make_houses(ex.size(40_000, 10_000), seed=26)
ex.describe(X, y, target="цена, млн", source="examples/_data.py → make_houses")
n = len(y)
perm = np.random.default_rng(0).permutation(n)
tr, va, cal, te = np.split(perm, [int(0.5 * n), int(0.6 * n), int(0.8 * n)])


def fit(objective, **kw):
    m = lgb.LGBMRegressor(n_estimators=3000, learning_rate=0.05, num_leaves=31, min_child_samples=50,
                          objective=objective, verbose=-1, random_state=0, **kw)
    m.fit(X.iloc[tr], y[tr], eval_X=(X.iloc[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
    return m


def conformal_q(scores):
    """Квантиль ошибок калибровки с поправкой на конечную выборку: гарантирует покрытие ≥ 1 − α."""
    k = int(np.ceil((len(scores) + 1) * (1 - ALPHA)))
    return float(np.sort(scores)[min(k, len(scores)) - 1])


def report(name, lo, hi):
    cover = np.mean((y[te] >= lo) & (y[te] <= hi))
    print(f"   {name:34s} покрытие {cover:.3f}  средняя ширина {np.mean(hi - lo):.2f} млн")
    return cover


# %% Этап 2. Постоянная ширина
ex.stage(2, "Простейший вариант: точечная модель ± квантиль |ошибки| на калибровке (split conformal)")
point = fit("regression")
q_abs = conformal_q(np.abs(y[cal] - point.predict(X.iloc[cal])))
p_te = point.predict(X.iloc[te])
report("точка ± постоянная ширина", p_te - q_abs, p_te + q_abs)

# %% Этап 3. Квантили
ex.stage(3, "Квантильный бустинг: отдельные модели для 5% и 95%")
m_lo, m_hi = fit("quantile", alpha=ALPHA / 2), fit("quantile", alpha=1 - ALPHA / 2)
lo_te, hi_te = m_lo.predict(X.iloc[te]), m_hi.predict(X.iloc[te])
report("квантильный бустинг", lo_te, hi_te)
ex.note("Квантильные модели обучены на ограниченных данных и с ранней остановкой — покрытие не гарантировано.")

# %% Этап 4. CQR
ex.stage(4, "Конформная калибровка квантилей (CQR): расширяем границы на квантиль ошибок калибровки")
lo_c, hi_c = m_lo.predict(X.iloc[cal]), m_hi.predict(X.iloc[cal])
E = np.maximum(lo_c - y[cal], y[cal] - hi_c)                  # > 0, если точка вне интервала
qE = conformal_q(E)
print(f"   поправка границ: {qE:+.3f} млн (плюс — расширить, минус — сузить)")
cover_cqr = report("CQR", lo_te - qE, hi_te + qE)
assert cover_cqr > 0.88

# %% Этап 5. Покрытие по группам
ex.stage(5, "Покрытие по ценовым группам: главное отличие адаптивных интервалов")
groups = np.digitize(p_te, np.quantile(p_te, [0.25, 0.5, 0.75]))
print("   группа по прогнозу   постоянная ширина   CQR (покрытие / ширина)")
for gi, name in enumerate(("дешёвые 25%", "ниже медианы", "выше медианы", "дорогие 25%")):
    k = groups == gi
    c1 = np.mean(np.abs(y[te][k] - p_te[k]) <= q_abs)
    lo, hi = lo_te[k] - qE, hi_te[k] + qE
    c2 = np.mean((y[te][k] >= lo) & (y[te][k] <= hi))
    print(f"   {name:18s}   {c1:.3f} / {2 * q_abs:5.2f}      {c2:.3f} / {np.mean(hi - lo):5.2f}")

fig, ax = plt.subplots(figsize=(9, 3.8))
idx = np.sort(np.random.default_rng(0).choice(len(te), 60, replace=False))
idx = idx[np.argsort(p_te[idx])]
xs = np.arange(len(idx))
ax.fill_between(xs, p_te[idx] - q_abs, p_te[idx] + q_abs, color=ROLE["truth"], alpha=0.25, label="постоянная ширина")
ax.fill_between(xs, lo_te[idx] - qE, hi_te[idx] + qE, color=ROLE["model"], alpha=0.3, label="CQR")
ax.plot(xs, y[te][idx], "o", color=ROLE["data"], ms=4, label="факт")
ax.set(xlabel="60 квартир теста, по возрастанию прогноза", ylabel="цена, млн",
       title="Интервалы на 90%: CQR расширяется вместе с ценой")
ax.legend()
ex.finish(fig, "26_intervals")

# %% Этап 6. Выводы
ex.stage(6, "Выводы")
ex.note("""Интервал постоянной ширины даёт 90% в среднем, но избыточен для дешёвых квартир и узок для дорогих.
Квантильный бустинг подстраивает ширину под объект; конформная поправка по отдельной выборке возвращает гарантию
среднего покрытия. Калибровочные данные нельзя использовать для обучения и ранней остановки.""")
ex.done()
