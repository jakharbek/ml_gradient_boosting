"""04. Темп обучения на 20 точках: быстро и переобученно или медленно и точно.

Цель: почувствовать, что делает темп ν, на данных, которые целиком видно глазами.
Чему научитесь: ν = 1 почти сразу подгоняет шум; маленький ν идёт медленнее, но приходит к лучшей ошибке на новых
    данных; число деревьев и темп связаны
Датасет: 20 точек волны y = sin-подобная функция + шум (σ = 0.4) и 2000 новых точек для проверки.
Этапы: 1) данные  2) три темпа × до 200 деревьев  3) таблица «деревья → ошибка»  4) картинка.
Попробуйте сами: 1) Добавьте в перебор ν = 0.1 и ν = 0.01: как меняется число деревьев до минимума ошибки? 2)
    Увеличьте шум при генерации данных вдвое — сдвинется ли лучший темп? 3) Замените max_depth=2 на 1 и на 4 и
    сравните лучшие ошибки на новых данных.
Связанные уроки: 4.2 «Темп обучения», 7.1 «Ранняя остановка».
Запуск: python examples/1_tiny/04_learning_rate_by_hand.py [--save] [--no-show]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="04. Темп обучения на 20 точках",
             goal="сравнить ν = 1, 0.3 и 0.05 по ошибке на обучении и на новых данных")

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from gbcourse import GBRegressor, datasets  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные: 20 точек для обучения, 2000 новых для проверки")
X, y = datasets.regression_1d(kind="wave", n=20, noise=0.4, seed=4)
X_new, y_new = datasets.regression_1d(kind="wave", n=2000, noise=0.4, seed=5)
ex.describe(X, y, names=["x"], target="y", source="gbcourse.datasets.regression_1d(kind='wave', n=20, noise=0.4)")
ex.note(f"Лучшее, что возможно на новых данных, — MSE ≈ дисперсии шума: 0.4² = {0.4 ** 2:.2f}.")

# %% Этап 2. Три темпа
ex.stage(2, "Обучение: глубина 2, до 200 деревьев, три темпа")
curves = {}
for lr in (1.0, 0.3, 0.05):
    m = GBRegressor(n_estimators=200, learning_rate=lr, max_depth=2).fit(X, y, eval_set=(X_new, y_new))
    curves[lr] = (np.array(m.history_["train"]) * 2, np.array(m.history_["eval"]) * 2)   # история — ½MSE

# %% Этап 3. Таблица
ex.stage(3, "Ошибка (MSE) после k деревьев: обучение / новые данные")
print("   деревьев │" + "│".join(f"   ν = {lr:<4}         " for lr in curves))
for k in (1, 5, 20, 50, 200):
    print(f"   {k:8d} │" + "│".join(f"  {tr[k]:6.3f} / {ev[k]:6.3f}   " for tr, ev in curves.values()))
best = {lr: (int(np.argmin(ev)), float(ev.min())) for lr, (tr, ev) in curves.items()}
for lr, (k, v) in best.items():
    print(f"   ν = {lr:<4}: лучшая MSE на новых данных {v:.3f} при {k} деревьях")
ex.note("""ν = 1 быстро доводит ошибку на обучении почти до нуля — и начинает запоминать шум 20 точек.
Маленький темп требует больше деревьев, но его лучшая ошибка на новых данных не хуже.""")
assert curves[1.0][0][200] < curves[0.05][0][200]          # на обучении ν = 1 всегда «лучше»

# %% Этап 4. Картинка
ex.stage(4, "Картинка")
fig, ax = plt.subplots(figsize=(9, 3.8))
for lr, (tr, ev) in curves.items():
    line, = ax.plot(ev, label=f"ν = {lr}: новые данные")
    ax.plot(tr, ls="--", color=line.get_color(), alpha=0.6, label=f"ν = {lr}: обучение")
ax.axhline(0.16, color="#888", lw=1, ls=":")
ax.set(yscale="log", xlabel="деревьев", ylabel="MSE", title="Сплошные — новые данные, пунктир — обучение; точки — шум 0.16")
ax.legend(fontsize=8, ncol=2)
fig.tight_layout()
ex.finish(fig, "04_learning_rate")
ex.done()
