"""16. Пропуски: три механизма и четыре способа обработки.

Цель: научиться выбирать обработку пропусков в зависимости от того, почему данные пропали.
Чему научитесь: три механизма пропусков: MCAR (случайно), MAR (зависит от другого признака), MNAR (зависит от самого
    значения); встроенная обработка NaN в XGBoost; заполнение медианой; медиана + индикатор пропуска; удаление
    признака
Датасет: задача Фридмана, 20 000 объектов, 10 признаков; пропадает 30% значений сильного признака x3.
Этапы: 1) данные  2) механизмы пропусков  3) способы обработки: таблица и график  4) выводы.
Попробуйте сами: 1) Поднимите долю пропусков до 60% — как меняется таблица? 2) Сделайте MNAR сильнее (вероятность
    пропуска 0.9·x3) — насколько упадёт ошибка «NaN как есть»? 3) Замените медиану заполнением по соседям
    (sklearn.impute.KNNImputer) и сравните.
Связанные уроки: 8.3 «Поиск разбиений», 10.2 «Пропуски, выбросы, дисбаланс».
Запуск: python examples/3_medium/16_missing_values.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="16. Пропуски: механизмы и способы обработки",
             goal="понять, когда пропуск — информация, и как её не потерять")

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import xgboost as xgb  # noqa: E402
from gbcourse import datasets  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные без пропусков")
n = ex.size(20_000, 5000)
X, y = datasets.friedman1(n=n, noise=1.0, seed=16)
ex.describe(X, y, names=[f"x{j}" for j in range(10)], target="y", source="gbcourse.datasets.friedman1: y содержит слагаемое 10·x3")
perm = np.random.default_rng(0).permutation(n)
tr, va, te = perm[: int(0.6 * n)], perm[int(0.6 * n): int(0.8 * n)], perm[int(0.8 * n):]

# %% Этап 2. Механизмы
ex.stage(2, "Три механизма: 30% значений x3 пропадают")
r = np.random.default_rng(1)
mech = {
    "MCAR — случайно": r.random(n) < 0.3,
    "MAR — чаще при большом x0": r.random(n) < 0.6 * X[:, 0],
    "MNAR — чаще при большом x3": r.random(n) < 0.6 * X[:, 3],
}
for name, miss in mech.items():
    print(f"   {name:28s} пропусков {miss.mean():.1%}; средний x3 у пропавших {X[miss, 3].mean():.2f} (у всех {X[:, 3].mean():.2f})")
ex.note("При MNAR сам факт пропуска говорит о значении: пропадают в основном большие x3.")


# %% Этап 3–4. Способы
def fit_rmse(Xa):
    m = xgb.XGBRegressor(n_estimators=3000, learning_rate=0.05, max_depth=5, early_stopping_rounds=100)
    m.fit(Xa[tr], y[tr], eval_set=[(Xa[va], y[va])], verbose=False)
    return float(np.sqrt(np.mean((y[te] - m.predict(Xa[te])) ** 2)))


full = fit_rmse(X)
ex.stage(3, "Способы обработки: одна и та же модель XGBoost с ранней остановкой")
print(f"   ориентир — модель без пропусков: RMSE = {full:.3f}")
print(f"   {'механизм':28s} {'NaN как есть':>13s} {'медиана':>9s} {'медиана+флаг':>13s} {'удалить x3':>11s}")
table = {}
for name, miss in mech.items():
    Xm = X.copy()
    Xm[miss, 3] = np.nan
    med = np.nanmedian(Xm[tr, 3])
    Xmed = Xm.copy()
    Xmed[miss, 3] = med
    Xflag = np.c_[Xmed, miss.astype(float)]
    row = [fit_rmse(Xm), fit_rmse(Xmed), fit_rmse(Xflag), fit_rmse(np.delete(X, 3, 1))]
    table[name] = row
    print(f"   {name:28s} " + " ".join(f"{v:12.3f}" for v in row))

fig, ax = plt.subplots(figsize=(9, 3.8))
methods = ["NaN как есть", "медиана", "медиана + флаг", "удалить x3"]
colors = [ROLE["model"], ROLE["tree"], ROLE["test"], ROLE["truth"]]
for j, (meth, c) in enumerate(zip(methods, colors)):
    ax.bar(np.arange(len(table)) + (j - 1.5) * 0.2, [row[j] for row in table.values()], width=0.2, color=c, label=meth)
ax.axhline(full, color=ROLE["data"], ls="--", lw=1.5, label="без пропусков")
ax.set_xticks(range(len(table)), [k.split(" — ")[0] for k in table])
ax.set(ylabel="RMSE на тесте (меньше — лучше)", title="Пропуски в сильном признаке x3: механизм × способ обработки")
ax.set_ylim(0, max(max(r) for r in table.values()) * 1.35)
ax.legend(ncol=3, fontsize=8, loc="upper left")
ex.finish(fig, "16_missing")

# %% Этап 5. Выводы
ex.stage(5, "Выводы")
mnar = table["MNAR — чаще при большом x3"]
ex.note(f"""Удалить признак из-за пропусков — худшее решение: он слишком важен ({table['MCAR — случайно'][3]:.3f} против {table['MCAR — случайно'][0]:.3f}).
При MNAR ошибка меньше, чем при MCAR: пропуск сам подсказывает значение (NaN как есть: {mnar[0]:.3f}).
Встроенная обработка NaN и «медиана + флаг» сохраняют факт пропуска и обычно не хуже простого заполнения.""")
assert all(row[3] > row[0] for row in table.values())
ex.done()
