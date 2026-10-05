"""25. Страхование: частота (Пуассон), ущерб (Твиди), экспозиция — 200 000 полисов.

Цель: моделировать счётные и «нулевые с хвостом» величины правильной функцией потерь.
Чему научитесь: экспозиция (доля года под страховкой) через смещение `init_score` = log(экспозиции); потеря Пуассона
    для числа случаев; потеря Твиди для суммарного ущерба — много нулей и тяжёлый хвост; девиация как метрика;
    проверка калибровки по группам и по суммам
Датасет: _data.make_claims — 200 000 полисов ОСАГО: возраст, стаж, мощность, возраст авто, регион, тип,
    бонус-малус; число случаев (у ~96% — ноль), ущерб в рублях, экспозиция 0.1–1.
Этапы: 1) данные  2) частота: MSE против Пуассона  3) экспозиция  4) ущерб: Твиди  5) калибровка по децилям
    6) выводы.
Попробуйте сами: 1) Передайте экспозицию обычным признаком вместо смещения — что станет с годовой частотой? 2)
    Смоделируйте ущерб как частота (Пуассон) × средний ущерб (Гамма) и сравните с Твиди. 3) Постройте кривую Лоренца
    и коэффициент Джини для ранжирования полисов по риску.
Связанные уроки: 5.3 «Потери для регрессии», 10.3 «Свои потери».
Запуск: python examples/4_large/25_insurance_poisson_tweedie.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_claims  # noqa: E402

ex = Example(__file__, title="25. Страхование: Пуассон и Твиди",
             goal="моделировать частоту и ущерб правильными потерями с учётом экспозиции")

import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402
from sklearn.metrics import mean_poisson_deviance, mean_tweedie_deviance  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
X, claims, amount, exposure = make_claims(ex.size(200_000, 50_000))
ex.describe(X, claims, target="число случаев", source="examples/_data.py → make_claims")
print(f"   без случаев: {np.mean(claims == 0):.1%}; средний ущерб на полис {amount.mean():,.0f} ₽; "
      f"наибольший {amount.max():,.0f} ₽; средняя экспозиция {exposure.mean():.2f}".replace(",", " "))
n = len(claims)
perm = np.random.default_rng(0).permutation(n)
tr, va, te = perm[: int(0.6 * n)], perm[int(0.6 * n): int(0.8 * n)], perm[int(0.8 * n):]


def fit(target, objective, init=None, **kw):
    m = lgb.LGBMRegressor(n_estimators=3000, learning_rate=0.03, num_leaves=15, min_child_samples=200,
                          objective=objective, verbose=-1, random_state=0, **kw)
    m.fit(X.iloc[tr], target[tr], init_score=None if init is None else init[tr], eval_X=(X.iloc[va],),
          eval_y=(target[va],), eval_init_score=None if init is None else [init[va]],
          callbacks=[lgb.early_stopping(100, verbose=False)])
    return m


# %% Этап 2. Частота
ex.stage(2, "Число случаев: MSE против Пуассона (без экспозиции)")
m_mse = fit(claims, "regression")
m_poi = fit(claims, "poisson")
p_mse, p_poi = m_mse.predict(X.iloc[te]), m_poi.predict(X.iloc[te])
print(f"   MSE:     отрицательных прогнозов {np.mean(p_mse < 0):.1%}; девиация Пуассона "
      f"{mean_poisson_deviance(claims[te], np.clip(p_mse, 1e-6, None)):.5f}")
print(f"   Пуассон: отрицательных прогнозов {np.mean(p_poi < 0):.1%}; девиация Пуассона {mean_poisson_deviance(claims[te], p_poi):.5f}")
ex.note("""Здесь MSE-модель случайно не ушла в минус и почти не уступает по девиации: у бустинга прогноз — средние в листьях.
Но Пуассон моделирует log(λ): прогноз положителен гарантированно, влияние признаков — множители, как в тарифах,
и главное — в него естественно входит экспозиция (следующий этап).""")

# %% Этап 3. Экспозиция
ex.stage(3, "Экспозиция: полис на 3 месяца видит в 4 раза меньше случаев, чем годовой")
off = np.log(exposure)
m_exp = fit(claims, "poisson", init=off)
p_exp = np.exp(m_exp.predict(X.iloc[te], raw_score=True) + off[te])   # init_score не входит в predict
print(f"   девиация Пуассона: без экспозиции {mean_poisson_deviance(claims[te], p_poi):.5f}, "
      f"со смещением log(экспозиции) {mean_poisson_deviance(claims[te], p_exp):.5f}")
annual = np.exp(m_exp.predict(X.iloc[te[:5]], raw_score=True))
print(f"   годовая частота для первых 5 полисов: {np.round(annual, 3).tolist()}")
ex.note("""Смещение (offset) log(экспозиции) прибавляется к логиту: модель учит годовую частоту, а короткий полис
получает её долю. Экспозиция — не признак, модель не должна её «объяснять».""")

# %% Этап 4. Ущерб
ex.stage(4, "Суммарный ущерб: Твиди (1 < p < 2) — точная масса в нуле плюс непрерывный хвост")
scale = 1e4                                                   # ущерб в десятках тысяч рублей — удобнее численно
y_amt = amount / scale
res, models_tw = {}, {}
for power in (1.2, 1.5, 1.8):
    m = fit(y_amt, "tweedie", init=off, tweedie_variance_power=power)
    p = np.exp(m.predict(X.iloc[te], raw_score=True) + off[te])
    res[power], models_tw[power] = p, m
    print(f"   p = {power}: девиация Твиди (p = 1.5) {mean_tweedie_deviance(y_amt[te], p, power=1.5):.4f}; "
          f"прогноз суммы {p.sum() * scale / 1e6:.1f} млн ₽, факт {amount[te].sum() / 1e6:.1f} млн ₽")
m_l2 = fit(y_amt, "regression")
p_l2 = m_l2.predict(X.iloc[te])
print(f"   MSE для сравнения: девиация Твиди {mean_tweedie_deviance(y_amt[te], np.clip(p_l2, 1e-6, None), power=1.5):.4f}")
p_va = np.exp(models_tw[1.5].predict(X.iloc[va], raw_score=True) + off[va])
k = y_amt[va].sum() / p_va.sum()                            # балансировка: суммы на валидации должны сойтись
print(f"   балансирующий множитель по валидации {k:.3f}; прогноз суммы на тесте после него {k * res[1.5].sum() * scale / 1e6:.1f} млн ₽")
ex.note("""Выбор p в разумных пределах почти не меняет девиацию; MSE заметно хуже. На тесте сумма прогноза ниже факта на 3–8%,
но на валидации модель, наоборот, чуть завышает (множитель < 1): расхождение на тесте — случайный разброс суммы
тяжёлых убытков, а не систематический сдвиг. Балансировку по валидации в страховании делают всегда — она убирает
систематический сдвиг, но не шум конкретного периода.""")

# %% Этап 5. Калибровка
ex.stage(5, "Калибровка по децилям прогноза частоты: ожидаемое против фактического")
dec = np.digitize(p_exp, np.quantile(p_exp, np.linspace(0.1, 0.9, 9)))
print("   дециль  ожидали  было   отношение")
for d in range(10):
    k = dec == d
    print(f"   {d + 1:5d}   {p_exp[k].sum():7.1f} {claims[te][k].sum():6d}   {claims[te][k].sum() / p_exp[k].sum():.2f}")
print(f"   итого   {p_exp.sum():7.1f} {claims[te].sum():6d}")
top, bottom = claims[te][dec == 9].sum() / (dec == 9).sum(), claims[te][dec == 0].sum() / (dec == 0).sum()
print(f"   частота в верхнем дециле в {top / bottom:.1f} раза выше, чем в нижнем — модель разделяет риск")
fig, ax = plt.subplots(figsize=(8, 3.6))
d = np.arange(1, 11)
ax.bar(d - 0.2, [p_exp[dec == i].sum() for i in range(10)], width=0.4, color=ROLE["model"], label="ожидали (модель)")
ax.bar(d + 0.2, [claims[te][dec == i].sum() for i in range(10)], width=0.4, color=ROLE["tree"], label="было (факт)")
ax.set_xticks(d)
ax.set(xlabel="дециль прогноза частоты (1 — самые безопасные)", ylabel="страховых случаев",
       title="Калибровка по децилям: ожидаемое против фактического")
ax.legend()
ex.finish(fig, "25_deciles")
ex.note("Отношения 0.8–1.2 в децилях с 30–470 случаями — в пределах случайного разброса (±√N): калибровка приемлема.")

# %% Этап 6. Выводы
ex.stage(6, "Выводы")
ex.note("""Счётная цель — Пуассон, «нули + хвост» — Твиди; обе с логарифмической связью и смещением на экспозицию.
Сравнивайте модели девиацией, а не MSE, и проверяйте, что суммы по группам сходятся с фактом.""")
ex.done()
