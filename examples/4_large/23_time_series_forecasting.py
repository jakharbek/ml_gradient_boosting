"""23. Прогноз продаж: 50 магазинов × 2 года, признаки из прошлого и разбиение по времени.

Цель: построить прогноз временного ряда бустингом и не обмануть себя утечкой из будущего.
Чему научитесь: превращать ряд в табличную задачу: лаги, скользящие средние, календарь, праздники; горизонт прогноза
    — лаги не короче горизонта; разбиение по времени; метрика WAPE; наивный прогноз как база; потеря Пуассона для
    продаж; как утечка из будущего завышает качество
Датасет: _data.make_store_sales — 50 магазинов × 730 дней = 36 500 строк: дата, магазин, тип, промо, праздник,
    температура, продажи (недельная и годовая сезонность, праздники, промо, тренд).
Этапы: 1) данные  2) признаки  3) разбиение по времени  4) база и модели  5) утечка  6) важности  7) выводы.
Попробуйте сами: 1) Сделайте горизонт 14 дней (лаги от 14, средние со сдвигом 14) — насколько вырастет WAPE? 2)
    Добавьте признаки «промо вчера» и «промо завтра». 3) Обучите отдельную модель для каждого типа магазина и
    сравните с общей.
Связанные уроки: 1.4 «Смещение и разброс» (валидация), 10 «Данные», 13.3 «Эксплуатация».
Запуск: python examples/4_large/23_time_series_forecasting.py [--save] [--no-show]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_store_sales  # noqa: E402

ex = Example(__file__, title="23. Прогноз продаж: временной ряд бустингом",
             goal="прогнозировать ряд на неделю вперёд без утечки из будущего")

import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from gbcourse import plotting  # noqa: E402

HORIZON = 7                                                   # прогнозируем на 7 дней вперёд

# %% Этап 1. Данные
ex.stage(1, "Данные")
df = make_store_sales(50, 730).sort_values(["магазин", "дата"]).reset_index(drop=True)
ex.describe(df.drop(columns="продажи"), df["продажи"].to_numpy(), target="продажи",
            source="examples/_data.py → make_store_sales")
print(f"   период: {df['дата'].min():%Y-%m-%d} … {df['дата'].max():%Y-%m-%d}")

# %% Этап 2. Признаки
ex.stage(2, "Признаки только из прошлого: лаги не короче горизонта, скользящие средние со сдвигом, календарь")
g = df.groupby("магазин")["продажи"]
for lag in (7, 14, 28):
    df[f"лаг_{lag}"] = g.shift(lag)
df["среднее7_лаг7"] = g.transform(lambda s: s.shift(HORIZON).rolling(7).mean())
df["среднее28_лаг7"] = g.transform(lambda s: s.shift(HORIZON).rolling(28).mean())
df["день_недели"] = df["дата"].dt.dayofweek
df["месяц"] = df["дата"].dt.month
df["день_года"] = df["дата"].dt.dayofyear
df["канун_праздника"] = df.groupby("магазин")["праздник"].shift(-1).fillna(0)   # календарь известен заранее
df = df.dropna(subset=["среднее28_лаг7"]).copy()
df["магазин"] = df["магазин"].astype("category")
F = ["магазин", "тип", "промо", "праздник", "канун_праздника", "температура", "лаг_7", "лаг_14", "лаг_28",
     "среднее7_лаг7", "среднее28_лаг7", "день_недели", "месяц", "день_года"]
print(f"   признаков {len(F)}; строк после отбрасывания первых 34 дней каждого магазина: {len(df)}")
ex.note(f"""Лаг короче горизонта ({HORIZON} дней) использовать нельзя: в момент прогноза этих продаж ещё не было.
Промо, праздники и температуру (прогноз погоды) считаем известными заранее — это нужно проверять в реальном проекте.""")

# %% Этап 3. Разбиение
ex.stage(3, "Разбиение по времени: обучение → 60 дней валидации → последние 60 дней теста")
end = df["дата"].max()
cut, vcut = end - pd.Timedelta(days=60), end - pd.Timedelta(days=120)
tr, va, te = df[df["дата"] <= vcut], df[(df["дата"] > vcut) & (df["дата"] <= cut)], df[df["дата"] > cut]
print(f"   обучение до {vcut:%Y-%m-%d} ({len(tr)}), валидация ({len(va)}), тест с {cut + pd.Timedelta(days=1):%Y-%m-%d} ({len(te)})")
wape = lambda y, p: float(np.sum(np.abs(y - p)) / np.sum(y))


def fit(train, valid, feats, **kw):
    m = lgb.LGBMRegressor(n_estimators=3000, learning_rate=0.03, num_leaves=63, verbose=-1, random_state=0, **kw)
    m.fit(train[feats], train["продажи"], eval_X=(valid[feats],), eval_y=(valid["продажи"],),
          callbacks=[lgb.early_stopping(100, verbose=False)])
    return m


# %% Этап 4. База и модели
ex.stage(4, "WAPE = Σ|ошибка| / Σ продаж на тесте")
naive = wape(te["продажи"], te["лаг_7"])
m_l2 = fit(tr, va, F)
m_po = fit(tr, va, F, objective="poisson")
p_l2, p_po = m_l2.predict(te[F]), m_po.predict(te[F])
print(f"   наивный прогноз «как неделю назад»   {naive:.4f}")
print(f"   LightGBM, MSE                       {wape(te['продажи'], p_l2):.4f}  (деревьев {m_l2.best_iteration_})")
print(f"   LightGBM, Пуассон                   {wape(te['продажи'], p_po):.4f}  (деревьев {m_po.best_iteration_})")
assert wape(te["продажи"], p_po) < naive
ex.note("Бустинг снижает ошибку наивного прогноза почти вдвое. Пуассон — естественная потеря для счётных продаж.")

# %% Этап 5. Утечка
ex.stage(5, "Две ошибки, которые завышают качество")
leak = df.assign(среднее7_сегодня=g.transform(lambda s: s.rolling(7).mean()).loc[df.index])
FL = F + ["среднее7_сегодня"]
trL, vaL, teL = leak.loc[tr.index], leak.loc[va.index], leak.loc[te.index]
m_leak = fit(trL, vaL, FL, objective="poisson")
print(f"   а) признак «среднее за 7 дней, включая сегодня»: WAPE {wape(te['продажи'], m_leak.predict(teL[FL])):.4f}"
      " — выглядит лучше, но в момент прогноза недоступен")
perm = np.random.default_rng(0).permutation(len(df))
a, b = df.iloc[perm[: int(0.8 * len(df))]], df.iloc[perm[int(0.8 * len(df)):]]
m_rand = lgb.LGBMRegressor(n_estimators=m_po.best_iteration_, learning_rate=0.03, num_leaves=63, objective="poisson",
                           verbose=-1, random_state=0).fit(a[F], a["продажи"])
print(f"   б) случайное разбиение вместо временного: WAPE {wape(b['продажи'], m_rand.predict(b[F])):.4f}"
      " — модель видит соседние дни того же периода")
ex.note("""Обе оценки оптимистичнее честной. Здесь разрыв умеренный, потому что все признаки уже взяты из прошлого;
в реальных данных со сдвигами спроса он бывает гораздо больше. Всегда проверяйте на последнем периоде.""")

# %% Этап 6. Важности и график
ex.stage(6, "Что использует модель и как выглядит прогноз одного магазина")
gain = m_po.booster_.feature_importance("gain")
print("   топ-5 по выигрышу: " + ", ".join(f for f, _ in sorted(zip(F, gain), key=lambda t: -t[1])[:5]))
plotting.use_course_style()
shop = te["магазин"] == te["магазин"].cat.categories[0]
fig, ax = plt.subplots(figsize=(9, 3.2))
ax.plot(te.loc[shop, "дата"], te.loc[shop, "продажи"], color=plotting.ROLE["data"], lw=2, label="факт")
ax.plot(te.loc[shop, "дата"], p_po[shop.to_numpy()], color=plotting.ROLE["model"], lw=2, label="прогноз (Пуассон)")
ax.plot(te.loc[shop, "дата"], te.loc[shop, "лаг_7"], color=plotting.ROLE["tree"], lw=1.5, ls="--", label="неделю назад")
ax.set(title="Магазин 0: последние 60 дней", ylabel="продажи")
ax.legend()
fig.autofmt_xdate()
ex.finish(fig, "23_store_forecast")

# %% Этап 7. Выводы
ex.stage(7, "Выводы")
ex.note("""Бустинг не «понимает» время: всё знание о прошлом нужно явно положить в признаки.
Горизонт определяет минимальный лаг; разбиение — только по времени; база — наивный прогноз.""")
ex.done()
