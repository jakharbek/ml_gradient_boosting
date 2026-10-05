"""18. Своя функция потерь и своя метрика: недооценка в 3 раза дороже переоценки.

Цель: обучить бустинг под бизнес-цену ошибки, а не под стандартную MSE.
Чему научитесь: вывести g и h асимметричной потери и проверить их численно; передать их в XGBoost и LightGBM; своя
    метрика для ранней остановки; ловушки LightGBM: старт с нуля, `init_score`, встроенная метрика
Датасет: _data.make_houses — 20 000 квартир; цель — log(цены). Сценарий: оценщик залога, для которого
    недооценка квартиры (упущенная сделка) в 3 раза дороже переоценки.
Этапы: 1) данные  2) потеря и её производные  3) XGBoost  4) LightGBM  5) сравнение с MSE  6) выводы.
Попробуйте сами: 1) Поставьте ALPHA = 1 (симметричный случай) — совпадёт ли модель с обычной MSE? 2) Уберите
    init_score у LightGBM и посмотрите, как меняются число деревьев и цена ошибок. 3) Реализуйте асимметричную
    абсолютную потерю и сравните со встроенной objective="quantile".
Связанные уроки: 10.3 «Свои потери», 8.1 «Тейлор: g и h».
Запуск: python examples/3_medium/18_custom_loss_and_metric.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_houses  # noqa: E402

ex = Example(__file__, title="18. Своя потеря и своя метрика",
             goal="обучить бустинг под асимметричную цену ошибки")

import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import xgboost as xgb  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402

ALPHA = 3.0

# %% Этап 1. Данные
ex.stage(1, "Данные (цель — логарифм цены)")
X, price = make_houses(ex.size(20_000, 4000), seed=18)
y = np.log(price)
ex.describe(X, y, target="log(цена)", source="examples/_data.py → make_houses")
n = len(y)
perm = np.random.default_rng(0).permutation(n)
tr, va, te = perm[: int(0.6 * n)], perm[int(0.6 * n): int(0.8 * n)], perm[int(0.8 * n):]


# %% Этап 2. Потеря
ex.stage(2, "Потеря: r = y − F; при недооценке (r > 0) штраф α·r²/2, иначе r²/2")
def grad_hess(y_true, y_pred):
    r = y_true - y_pred
    return np.where(r > 0, -ALPHA * r, -r), np.where(r > 0, ALPHA, 1.0)


def cost(y_true, y_pred):
    r = y_true - y_pred
    return float(np.mean(0.5 * np.where(r > 0, ALPHA, 1.0) * r * r))


yy, FF, eps = np.array([1.0]), 0.6, 1e-5                           # численная проверка производных
L = lambda f: cost(yy, np.array([f]))
g, h = grad_hess(yy, np.array([FF]))
print(f"   g = {g[0]:+.4f} (численно {(L(FF + eps) - L(FF - eps)) / (2 * eps):+.4f}); "
      f"h = {h[0]:.4f} (численно {(L(FF + eps) - 2 * L(FF) + L(FF - eps)) / eps ** 2:.4f})")
F0 = float(np.quantile(y[tr], ALPHA / (1 + ALPHA)))                # разумный старт — верхний квантиль

# %% Этап 3. XGBoost
ex.stage(3, "XGBoost (sklearn-интерфейс): objective и eval_metric — наши функции")
xm = xgb.XGBRegressor(n_estimators=3000, learning_rate=0.05, max_depth=6, objective=grad_hess, eval_metric=cost,
                      base_score=F0, enable_categorical=True, tree_method="hist", early_stopping_rounds=100,
                      disable_default_eval_metric=True)
xm.fit(X.iloc[tr], y[tr], eval_set=[(X.iloc[va], y[va])], verbose=False)
p_x = xm.predict(X.iloc[te])
print(f"   лучшая итерация {xm.best_iteration}; асимметричная цена на тесте {cost(y[te], p_x):.5f}")

# %% Этап 4. LightGBM
ex.stage(4, "LightGBM: init_score, metric='None' и прибавление старта к прогнозу")
lm = lgb.LGBMRegressor(n_estimators=3000, learning_rate=0.05, num_leaves=31, objective=grad_hess, metric="None", verbose=-1)
lm.fit(X.iloc[tr], y[tr], init_score=np.full(len(tr), F0), eval_X=(X.iloc[va],), eval_y=(y[va],),
       eval_init_score=[np.full(len(va), F0)], eval_metric=lambda a, b: ("asym", cost(a, b), False),
       callbacks=[lgb.early_stopping(100, verbose=False)])
p_l = lm.predict(X.iloc[te]) + F0                  # init_score в модель не сохраняется!
print(f"   лучшая итерация {lm.best_iteration_}; асимметричная цена на тесте {cost(y[te], p_l):.5f}")
ex.note("""Три ловушки LightGBM: своя цель стартует с нуля (нужен init_score); init_score не входит в predict;
встроенная метрика не отключается сама (metric='None'), иначе ранняя остановка пойдёт по ней.""")

# %% Этап 5. Сравнение
ex.stage(5, "Сравнение с обычной MSE-моделью")
ms = xgb.XGBRegressor(n_estimators=3000, learning_rate=0.05, max_depth=6, enable_categorical=True, tree_method="hist",
                      early_stopping_rounds=100).fit(X.iloc[tr], y[tr], eval_set=[(X.iloc[va], y[va])], verbose=False)
p_s = ms.predict(X.iloc[te])
for name, p in (("MSE (обычная)", p_s), ("асимметричная, XGBoost", p_x), ("асимметричная, LightGBM", p_l)):
    under = np.mean(y[te] > p)
    print(f"   {name:24s} цена {cost(y[te], p):.5f}; доля недооценок {under:.1%}; средний сдвиг прогноза {np.mean(np.exp(p) / price[te] - 1):+.1%}")
assert cost(y[te], p_x) < cost(y[te], p_s)
fig, ax = plt.subplots(figsize=(8, 3.6))
bins = np.linspace(-30, 30, 61)
for name, p, c in (("MSE", p_s, ROLE["model_prev"]), ("асимметричная (XGBoost)", p_x, ROLE["tree"])):
    ax.hist(100 * (np.exp(p - y[te]) - 1), bins=bins, color=c, alpha=0.6, label=name)
ax.axvline(0, color=ROLE["data"], lw=1.5)
ax.set(xlabel="ошибка прогноза, % (меньше нуля — недооценка)", ylabel="квартир",
       title="Своя потеря сдвигает ошибки в сторону переоценки")
ax.legend()
ex.finish(fig, "18_error_shift")

# %% Этап 6. Выводы
ex.stage(6, "Выводы")
ex.note("""Своя потеря сдвигает прогноз вверх (в среднем на ~3%) настолько, насколько выгодно при цене ошибок 3:1: доля недооценок
падает с 51% до 37%, а асимметричная цена — на 15–17%. MSE-модель оптимальна для MSE, а не для бизнеса.""")
ex.done()
