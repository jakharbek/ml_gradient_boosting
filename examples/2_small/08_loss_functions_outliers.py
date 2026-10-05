"""08. Функции потерь для регрессии: L2, L1, Хьюбер, квантиль — на данных с выбросами.

Цель: понять, как выбор потери меняет модель, и научиться выбирать её под задачу.
Чему научитесь: чувствительность L2 к выбросам; устойчивость L1 и Хьюбера; квантильная регрессия для «верхней
    границы»; какая метрика соответствует какой потере
Датасет: 1000 точек волны с растущим шумом, у 3% обучающих объектов y испорчен на +8…+12 (сбой датчика).
    Проверка — на чистых данных.
Этапы: 1) данные  2) четыре потери  3) метрики на чистом тесте  4) квантили  5) картинка.
Попробуйте сами: 1) Увеличьте долю выбросов с 3% до 15% — какая потеря «ломается» первой? 2) Переберите alpha у
    loss="huber" и найдите лучшее значение по RMSE на тесте. 3) Постройте коридор 5%–95% и проверьте, какую долю
    точек он покрывает.
Связанные уроки: 5.3 «Потери для регрессии», 10.2 «Пропуски, выбросы, дисбаланс».
Запуск: python examples/2_small/08_loss_functions_outliers.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="08. Потери L2, L1, Хьюбер, квантиль на данных с выбросами",
             goal="увидеть, как потеря меняет модель, и выбрать её под задачу")

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from sklearn.ensemble import GradientBoostingRegressor  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные: волна, шум растёт с x, 3% выбросов вверх в обучении")
rng = np.random.default_rng(8)
n = ex.size(1000, 400)
f = lambda x: np.sin(x) + 0.3 * x
x_tr = rng.uniform(0, 10, n)
y_tr = f(x_tr) + rng.normal(0, 0.2 + 0.05 * x_tr)
bad = rng.random(n) < 0.03
y_tr[bad] += rng.uniform(8, 12, bad.sum())
x_te = rng.uniform(0, 10, 5000)
y_te = f(x_te) + rng.normal(0, 0.2 + 0.05 * x_te)
ex.describe(x_tr[:, None], y_tr, names=["x"], target="y", source="синтетика")
print(f"   выбросов в обучении: {bad.sum()}")

# %% Этап 2. Четыре потери
ex.stage(2, "Обучение: 300 деревьев глубины 3, ν = 0.05, минимум 10 объектов в листе")
P = dict(n_estimators=300, learning_rate=0.05, max_depth=3, min_samples_leaf=10, random_state=0)
models = {
    "L2 (squared_error)": GradientBoostingRegressor(loss="squared_error", **P),
    "L1 (absolute_error)": GradientBoostingRegressor(loss="absolute_error", **P),
    "Хьюбер (huber)": GradientBoostingRegressor(loss="huber", alpha=0.9, **P),
}
for m in models.values():
    m.fit(x_tr[:, None], y_tr)

# %% Этап 3. Метрики
ex.stage(3, "Ошибка на чистом тесте")
res = {}
for name, m in models.items():
    p = m.predict(x_te[:, None])
    res[name] = (np.sqrt(np.mean((y_te - p) ** 2)), np.mean(np.abs(y_te - p)), np.mean(p - f(x_te)))
    print(f"   {name:20s} RMSE {res[name][0]:.3f}, MAE {res[name][1]:.3f}, среднее смещение {res[name][2]:+.3f}")
ex.note("""L2 гонится за выбросами: её прогноз смещён вверх. L1 и Хьюбер почти не замечают 3% испорченных точек.
Правило: какой метрикой будут оценивать, ту потерю (или устойчивую к грязи её версию) и оптимизируйте.""")
assert res["L2 (squared_error)"][2] > res["L1 (absolute_error)"][2]

# %% Этап 4. Квантили
ex.stage(4, "Квантильная регрессия: 10-й и 90-й процентили — коридор, в который попадает 80% объектов")
q = {a: GradientBoostingRegressor(loss="quantile", alpha=a, **P).fit(x_tr[:, None], y_tr) for a in (0.1, 0.9)}
lo, hi = q[0.1].predict(x_te[:, None]), q[0.9].predict(x_te[:, None])
cover = np.mean((y_te >= lo) & (y_te <= hi))
print(f"   доля тестовых объектов внутри коридора: {cover:.3f} (цель 0.80); ширина растёт с x: "
      f"{np.mean((hi - lo)[x_te < 3]):.2f} при x < 3 и {np.mean((hi - lo)[x_te > 7]):.2f} при x > 7")
ex.note("Коридор расширяется там, где шум больше. Гарантии покрытия у квантилей нет — её даёт конформный метод (пример 26).")

# %% Этап 5. Картинка
ex.stage(5, "Картинка")
g = np.linspace(0, 10, 400)[:, None]
fig, ax = plt.subplots(figsize=(10, 4))
ax.scatter(x_tr, y_tr, s=5, color="#999", alpha=0.5, label="обучение (с выбросами)")
for name, m in models.items():
    ax.plot(g[:, 0], m.predict(g), lw=2, label=name)
ax.fill_between(g[:, 0], q[0.1].predict(g), q[0.9].predict(g), alpha=0.15, label="10–90% квантили")
ax.set(ylim=(-2, 8), xlabel="x", ylabel="y")
ax.legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "08_losses")
ex.done()
