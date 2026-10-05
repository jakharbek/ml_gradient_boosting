"""10. Переобучение и ранняя остановка на 300 шумных объектах.

Цель: увидеть переобучение бустинга своими глазами и научиться его останавливать.
Чему научитесь: кривые ошибки на обучении и валидации; лучшая итерация; ранняя остановка в LightGBM
    (`lgb.early_stopping`); почему решение принимается на валидации, а оценка — на отдельном тесте
Датасет: задача Фридмана — 300 объектов для обучения, 10 признаков (5 информативных, 5 шумовых), сильный шум
    σ = 2; 300 для валидации и 5000 для теста.
Этапы: 1) данные  2) 2000 деревьев без остановки  3) ранняя остановка  4) картинка.
Попробуйте сами: 1) Уменьшите learning_rate до 0.02 — где теперь минимум валидационной кривой и насколько он глубже?
    2) Увеличьте обучающую выборку с 300 до 3000 объектов — насколько слабее станет переобучение? 3) Поставьте
    min_child_samples=5 и сравните форму кривых после минимума.
Связанные уроки: 7 «Регуляризация», 7.1 «Ранняя остановка».
Запуск: python examples/2_small/10_overfitting_early_stopping.py [--save] [--no-show]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="10. Переобучение и ранняя остановка",
             goal="найти момент, когда новые деревья начинают вредить, и остановиться")

import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from gbcourse import datasets  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
X, y = datasets.friedman1(n=5600, noise=2.0, seed=10)
X_tr, y_tr, X_va, y_va, X_te, y_te = X[:300], y[:300], X[300:600], y[300:600], X[600:], y[600:]
ex.describe(X_tr, y_tr, names=[f"x{j}" for j in range(10)], target="y",
            source="gbcourse.datasets.friedman1: y = 10 sin(πx0x1) + 20(x2 − 0.5)² + 10x3 + 5x4 + шум")
ex.note("Шум σ = 2, значит лучшая возможная RMSE ≈ 2.")

# %% Этап 2. Без остановки
ex.stage(2, "2000 деревьев, ν = 0.1, 7 листьев — без остановки")
rmse = lambda a, b: float(np.sqrt(np.mean((a - b) ** 2)))
m = lgb.LGBMRegressor
full = m(n_estimators=2000, learning_rate=0.1, num_leaves=7, min_child_samples=20, verbose=-1, random_state=0)
full.fit(X_tr, y_tr, eval_X=(X_tr, X_va), eval_y=(y_tr, y_va), eval_names=["обучение", "валидация"], eval_metric="rmse")
tr_curve = np.array(full.evals_result_["обучение"]["rmse"])
va_curve = np.array(full.evals_result_["валидация"]["rmse"])
best = int(np.argmin(va_curve)) + 1
print(f"   RMSE обучение после 2000 деревьев: {tr_curve[-1]:.3f} — почти ноль, модель запомнила 300 объектов вместе с шумом")
print(f"   RMSE валидация: лучшая {va_curve.min():.3f} на {best}-м дереве, после 2000 — {va_curve[-1]:.3f}")
assert va_curve[-1] > va_curve.min()
ex.note("""Рост ошибки после лучшей итерации умеренный: когда обучение подогнано почти идеально, градиенты почти нулевые,
и новые деревья мало что меняют. Лишние деревья вредят немного, а время тратят полностью.""")

# %% Этап 4. Ранняя остановка
ex.stage(4, "Ранняя остановка: прекратить, если 50 деревьев подряд нет улучшения на валидации")
es = m(n_estimators=2000, learning_rate=0.1, num_leaves=7, min_child_samples=20, verbose=-1, random_state=0)
with ex.timer("обучение с ранней остановкой"):
    es.fit(X_tr, y_tr, eval_X=(X_va,), eval_y=(y_va,), eval_metric="rmse", callbacks=[lgb.early_stopping(50, verbose=False)])
print(f"   остановились на {es.best_iteration_} деревьях")
print(f"   RMSE на тесте: без остановки {rmse(y_te, full.predict(X_te)):.3f}, с остановкой {rmse(y_te, es.predict(X_te)):.3f}")
ex.note("""Валидацию использовали для выбора числа деревьев, поэтому оценку качества даёт только тест.
Ранняя остановка дешевле и надёжнее, чем подбирать число деревьев вручную.""")
assert rmse(y_te, es.predict(X_te)) < rmse(y_te, full.predict(X_te))

# %% Этап 5. Картинка
ex.stage(5, "Картинка")
fig, ax = plt.subplots(figsize=(9, 3.8))
ax.plot(np.arange(1, 2001), tr_curve, label="обучение")
ax.plot(np.arange(1, 2001), va_curve, label="валидация")
ax.axvline(best, color="#888", ls="--", label=f"лучшая итерация {best}")
ax.axvline(es.best_iteration_, color="#d6452a", ls=":", label=f"ранняя остановка {es.best_iteration_}")
ax.set(xscale="log", xlabel="деревьев", ylabel="RMSE")
ax.legend()
fig.tight_layout()
ex.finish(fig, "10_early_stopping")
ex.done()
