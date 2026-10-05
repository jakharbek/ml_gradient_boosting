"""01. Градиентный бустинг вручную на 6 точках.

Цель: увидеть весь алгоритм бустинга числами — без библиотек, без «магии».
Чему научитесь: стартовая константа F₀; остатки; выбор лучшего пня перебором; значения листьев; шаг с темпом ν; как
    ошибка падает от дерева к дереву; сверка с `gbcourse`
Датасет: toy_regression — 6 объектов, 1 признак x = 1…6, цель y = (2, 4, 3, 7, 9, 11). Специально
    такой маленький, чтобы каждое число можно было проверить на листке бумаги.
Этапы: 1) данные  2) старт F₀  3) три итерации по шагам  4) сверка с библиотекой  5) картинка.
Попробуйте сами: 1) Поставьте LR = 1.0: за сколько итераций MSE станет почти нулевой и почему на новых данных это
    плохо? 2) После загрузки данных сделайте y[5] = 30 (выброс) и проследите, как он перетягивает пороги и значения
    листьев. 3) Добавьте четвёртую итерацию, проверьте её числа на листке и сверьте с GBRegressor(n_estimators=4).
Связанные уроки: 4.1 «Остатки вручную», 2.1 «Пень».
Запуск: python examples/1_tiny/01_boosting_by_hand.py [--save] [--no-show]
Ожидаемо: MSE 10.67 → 3.92 → 1.57 → 0.81; прогнозы совпадают с gbcourse точно (расхождение 0).
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="01. Градиентный бустинг вручную на 6 точках",
             goal="пройти алгоритм бустинга по шагам и проверить каждое число")

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from gbcourse import GBRegressor, datasets  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
X, y = datasets.toy_regression()
x = X[:, 0]
ex.describe(X, y, names=["x"], target="y", source="gbcourse.datasets.toy_regression() — учебный набор курса")

# %% Этап 2. Старт: лучшая константа
ex.stage(2, "Старт: лучшая константа для квадратичной потери — среднее")
F = np.full_like(y, y.mean())
print(f"   F₀ = mean(y) = {y.mean():.4f};  MSE = {np.mean((y - F) ** 2):.4f}")

# %% Этап 3. Итерации
LR = 0.5
history = [np.mean((y - F) ** 2)]
trees = []
for m in range(1, 4):
    ex.stage(f"3.{m}", f"Итерация {m}: остатки → лучший пень → шаг ν = {LR}")
    r = y - F                                            # остатки = антиградиент квадратичной потери
    print("   x:        " + "  ".join(f"{v:6.2f}" for v in x))
    print("   y:        " + "  ".join(f"{v:6.2f}" for v in y))
    print("   F:        " + "  ".join(f"{v:6.2f}" for v in F))
    print("   r = y−F:  " + "  ".join(f"{v:+6.2f}" for v in r))
    # Перебираем все пороги между соседними x и считаем сумму квадратов ошибок пня на остатках
    best = None
    print("   порог  | лист слева | лист справа | SSE")
    for k in range(1, len(x)):
        t = (x[k - 1] + x[k]) / 2
        left, right = r[x <= t].mean(), r[x > t].mean()
        sse = np.sum((r[x <= t] - left) ** 2) + np.sum((r[x > t] - right) ** 2)
        print(f"   {t:5.1f}  | {left:+10.3f} | {right:+11.3f} | {sse:7.3f}")
        if best is None or sse < best[0]:
            best = (sse, t, left, right)
    sse, t, left, right = best
    print(f"   лучший пень: x ≤ {t} → {left:+.3f}, иначе {right:+.3f}  (SSE {sse:.3f})")
    h = np.where(x <= t, left, right)
    F = F + LR * h                                       # маленький шаг в сторону пня
    history.append(np.mean((y - F) ** 2))
    trees.append((t, left, right))
    print("   новый F:  " + "  ".join(f"{v:6.2f}" for v in F) + f"   MSE = {history[-1]:.4f}")

ex.note("Ошибка падает с каждым деревом, но не до нуля сразу: темп ν = 0.5 оставляет работу следующим деревьям.")
assert all(a > b for a, b in zip(history, history[1:])), "MSE должна убывать"

# %% Этап 4. Сверка с библиотекой
ex.stage(4, "Сверка с gbcourse.GBRegressor (глубина 1, 3 дерева, ν = 0.5)")
lib = GBRegressor(n_estimators=3, learning_rate=LR, max_depth=1).fit(X, y)
diff = np.abs(lib.predict(X) - F).max()
print(f"   наибольшее расхождение прогнозов: {diff:.1e}")
assert diff < 1e-12
ex.note("Библиотека делает ровно то же самое, что мы посчитали руками.")

# %% Этап 5. Картинка
ex.stage(5, "Картинка")
fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
grid = np.linspace(0.5, 6.5, 300)
axes[0].scatter(x, y, color="#444", zorder=3, label="данные")
Fg = np.full_like(grid, y.mean())
axes[0].plot(grid, Fg, lw=1, ls="--", label="F₀")
for m, (t, left, right) in enumerate(trees, 1):
    Fg = Fg + LR * np.where(grid <= t, left, right)
    axes[0].step(grid, Fg, where="mid", lw=2, label=f"F{m}")
axes[0].set(xlabel="x", ylabel="y", title="Модель после каждого дерева")
axes[0].legend()
axes[1].plot(range(len(history)), history, marker="o")
axes[1].set(xlabel="число деревьев", ylabel="MSE на обучении", title="Ошибка по итерациям")
fig.tight_layout()
ex.finish(fig, "01_boosting_by_hand")
ex.done()
