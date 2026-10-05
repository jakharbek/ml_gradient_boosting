"""02. Дерево решений вручную: 10 объектов, 2 признака.

Цель: понять, как дерево выбирает признак и порог, — главный «строительный блок» бустинга.
Чему научитесь: перебор всех пар (признак, порог); критерий «уменьшение суммы квадратов»; рекурсия до глубины 2;
    значения листьев — средние; сверка с `gbcourse.RegressionTree`
Датасет: 10 квартир, придуманных для примера: площадь (м²), этаж, цена (млн). Цена растёт с площадью,
    а первый этаж дешевле — дерево должно найти и то и другое.
Этапы: 1) данные  2) лучшее разбиение корня  3) разбиения детей  4) дерево и прогнозы  4б) остатки и второе дерево  5) сверка с библиотекой.
Попробуйте сами: 1) Постройте дерево глубины 3 (RegressionTree(max_depth=3)) — появится ли этаж в разбиениях? 2) Для
    одного порога площади посчитайте SSE левой и правой частей вручную и сверьте с перебором. 3) Доведите второй шаг
    бустинга до конца: прибавьте пень по остаткам с темпом 0.5 и посчитайте новую MSE.
Связанные уроки: 2.1 «Пень», 2.2 «Критерии разбиения», 2.3 «Рост дерева».
Запуск: python examples/1_tiny/02_tree_by_hand.py
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="02. Дерево решений вручную: 10 объектов, 2 признака",
             goal="увидеть, как дерево выбирает признак и порог")

import numpy as np  # noqa: E402
from gbcourse import RegressionTree  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
area = np.array([30, 35, 42, 48, 55, 60, 68, 75, 82, 95], dtype=float)
floor = np.array([1, 3, 1, 5, 2, 1, 7, 4, 1, 9], dtype=float)
price = np.array([4.1, 5.0, 3.6, 6.6, 7.2, 5.4, 9.0, 9.6, 7.7, 12.4])
X = np.c_[area, floor]
ex.describe(X, price, names=["площадь", "этаж"], target="цена, млн", source="придуман для примера")
names = ["площадь", "этаж"]


def best_split(rows):
    """Перебор всех признаков и порогов: наибольшее уменьшение суммы квадратов отклонений (SSE)."""
    y = price[rows]
    sse_parent = np.sum((y - y.mean()) ** 2)
    best = None
    for j in range(2):
        xs = np.unique(X[rows, j])
        for t in (xs[:-1] + xs[1:]) / 2:
            left = rows[X[rows, j] <= t]
            right = rows[X[rows, j] > t]
            sse = np.sum((price[left] - price[left].mean()) ** 2) + np.sum((price[right] - price[right].mean()) ** 2)
            gain = sse_parent - sse
            if best is None or gain > best[0]:
                best = (gain, j, t, left, right)
    return best


# %% Этап 2. Корень
ex.stage(2, "Лучшее разбиение корня: перебираем оба признака и все пороги")
root = np.arange(10)
print(f"   SSE корня (все 10 объектов вокруг среднего {price.mean():.2f}): {np.sum((price - price.mean()) ** 2):.3f}")
for j in range(2):
    xs = np.unique(X[:, j])
    gains = []
    for t in (xs[:-1] + xs[1:]) / 2:
        l_, r_ = price[X[:, j] <= t], price[X[:, j] > t]
        gains.append((t, np.sum((price - price.mean()) ** 2) - np.sum((l_ - l_.mean()) ** 2) - np.sum((r_ - r_.mean()) ** 2)))
    top = max(gains, key=lambda g: g[1])
    print(f"   {names[j]:8s}: {len(gains)} порогов, лучший {top[0]:5.1f} уменьшает SSE на {top[1]:.3f}")
gain, j, t, left, right = best_split(root)
print(f"   ⇒ корень: {names[j]} ≤ {t}  (уменьшение SSE {gain:.3f})")

# %% Этап 3. Дети
ex.stage(3, "Разбиения детей (глубина 2)")
tree = {"root": (j, t)}
for side, rows in (("слева", left), ("справа", right)):
    g2, j2, t2, l2, r2 = best_split(rows)
    tree[side] = (j2, t2, price[l2].mean(), price[r2].mean())
    print(f"   {side} (n = {len(rows)}) → {names[j2]} ≤ {t2} (уменьшение SSE {g2:.3f}); "
          f"листья {price[l2].mean():.3f} (n = {len(l2)}) и {price[r2].mean():.3f} (n = {len(r2)})")
ex.note("""Этаж тоже информативен (в корне он уменьшил бы SSE на 36.5), но площадь сильнее — и в корне, и в детях.
Дереву глубины 2 не хватило «места», чтобы учесть этаж. Посмотрим, что останется ему в остатках.""")


# %% Этап 4. Прогнозы
ex.stage(4, "Дерево и его прогнозы")
def predict(row):
    j0, t0 = tree["root"]
    j2, t2, a, b = tree["слева" if row[j0] <= t0 else "справа"]
    return a if row[j2] <= t2 else b


pred = np.array([predict(r) for r in X])
for r, p, yv in zip(X, pred, price):
    print(f"   площадь {r[0]:4.0f}, этаж {r[1]:1.0f}: прогноз {p:6.3f}, факт {yv:5.2f}")
print(f"   MSE дерева на обучении: {np.mean((price - pred) ** 2):.4f} (у константы — {np.var(price):.4f})")

# %% Этап 4б. Что не успело первое дерево
ex.stage("4б", "Остатки первого дерева и второе дерево — идея бустинга")
resid = price - pred
print("   остатки: " + "  ".join(f"{v:+.2f}" for v in resid))
best2 = None
for j in range(2):
    xs = np.unique(X[:, j])
    for t in (xs[:-1] + xs[1:]) / 2:
        lft, rgt = resid[X[:, j] <= t], resid[X[:, j] > t]
        sse = np.sum((lft - lft.mean()) ** 2) + np.sum((rgt - rgt.mean()) ** 2)
        if best2 is None or sse < best2[0]:
            best2 = (sse, j, t, lft.mean(), rgt.mean())
_, j2, t2, a2, b2 = best2
print(f"   лучший пень по остаткам: {names[j2]} ≤ {t2} → {a2:+.3f}, иначе {b2:+.3f}")
assert names[j2] == "этаж"
ex.note("""Второе дерево нашло то, что пропустило первое: квартиры на первом этаже дешевле примерно на 0.7 млн.
Именно так бустинг складывает простые деревья в сложную модель.""")

# %% Этап 5. Сверка
ex.stage(5, "Сверка с gbcourse.RegressionTree(max_depth=2)")
lib = RegressionTree(max_depth=2).fit(X, price.mean() - price)   # дерево курса учится на градиентах g = F − y
lib_pred = price.mean() + lib.predict(X)                          # лист = −mean(g) = среднее остатков
print(lib.describe(feature_names=names))
print(f"   наибольшее расхождение прогнозов: {np.abs(lib_pred - pred).max():.1e}")
assert np.abs(lib_pred - pred).max() < 1e-12
ex.done()
