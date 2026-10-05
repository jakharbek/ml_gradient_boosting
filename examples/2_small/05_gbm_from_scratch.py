"""05. Градиентный бустинг с нуля за 30 строк — и точное совпадение с scikit-learn.

Цель: написать рабочий бустинг самостоятельно и убедиться, что библиотека делает то же самое.
Чему научитесь: класс бустинга: старт, цикл по деревьям, псевдо-остатки, шаг ν, прогноз; деревья scikit-learn как
    «слабые модели»; проверка реализации сравнением с эталоном до 1e-12
Датасет: 500 точек, y = sin(x) + 0.3x + шум (σ = 0.3), x ∈ [0, 10] — синтетика, чтобы видеть модель глазами.
Этапы: 1) данные  2) реализация  3) обучение и проверка на отложенных данных  4) сверка с sklearn  5) картинка.
Попробуйте сами: 1) Добавьте в MyGBM подвыборку строк (subsample = 0.5): почему точного совпадения с sklearn больше
    нет? 2) Замените квадратичные потери абсолютными: псевдо-остаток sign(y − F), значение листа — медиана остатков.
    3) Добавьте раннюю остановку по отложенной выборке и сравните число деревьев.
Связанные уроки: 4.3 «Бустинг с нуля».
Запуск: python examples/2_small/05_gbm_from_scratch.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="05. Градиентный бустинг с нуля за 30 строк",
             goal="написать бустинг и совпасть с sklearn.GradientBoostingRegressor")

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from sklearn.ensemble import GradientBoostingRegressor  # noqa: E402
from sklearn.tree import DecisionTreeRegressor  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
rng = np.random.default_rng(5)
n = ex.size(500, 200)
x = np.sort(rng.uniform(0, 10, n))
y = np.sin(x) + 0.3 * x + rng.normal(0, 0.3, n)
X = x[:, None]
idx = rng.permutation(n)
tr, te = idx[: int(0.7 * n)], idx[int(0.7 * n):]
ex.describe(X, y, names=["x"], target="y", source="синтетика: sin(x) + 0.3x + N(0, 0.3²)")


# %% Этап 2. Реализация
ex.stage(2, "Реализация: весь алгоритм в одном классе")
class MyGBM:
    """Градиентный бустинг для квадратичной потери."""

    def __init__(self, n_estimators=100, learning_rate=0.1, max_depth=3):
        self.n_estimators, self.learning_rate, self.max_depth = n_estimators, learning_rate, max_depth

    def fit(self, X, y):
        self.f0 = y.mean()                              # 1. старт: лучшая константа
        F = np.full(len(y), self.f0)
        self.trees = []
        for m in range(self.n_estimators):
            r = y - F                                   # 2. псевдо-остатки = антиградиент ½(y − F)²
            tree = DecisionTreeRegressor(max_depth=self.max_depth, criterion="squared_error", random_state=m)
            tree.fit(X, r)                              # 3. дерево приближает остатки
            F += self.learning_rate * tree.predict(X)   # 4. маленький шаг
            self.trees.append(tree)
        return self

    def predict(self, X):
        return self.f0 + self.learning_rate * sum(t.predict(X) for t in self.trees)


print("   MyGBM: старт → цикл (остатки → дерево → шаг ν) → прогноз = F₀ + ν·Σ деревьев")

# %% Этап 3. Обучение
ex.stage(3, "Обучение и проверка на отложенных 30%")
with ex.timer("обучение 100 деревьев"):
    my = MyGBM().fit(X[tr], y[tr])
rmse = lambda a, b: float(np.sqrt(np.mean((a - b) ** 2)))
print(f"   RMSE: константа {rmse(y[te], y[tr].mean()):.3f}, MyGBM {rmse(y[te], my.predict(X[te])):.3f} (шум σ = 0.3)")
assert rmse(y[te], my.predict(X[te])) < 0.4

# %% Этап 4. Сверка
ex.stage(4, "Сверка с sklearn.GradientBoostingRegressor (те же параметры)")
sk = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=0).fit(X[tr], y[tr])
diff = np.abs(sk.predict(X[te]) - my.predict(X[te])).max()
print(f"   наибольшее расхождение прогнозов: {diff:.1e}")
assert diff < 1e-10
ex.note("30 строк повторяют промышленную реализацию. Остальное в библиотеках — скорость, удобство и регуляризация.")

# %% Этап 5. Картинка
ex.stage(5, "Картинка: модель после 1, 10 и 100 деревьев")
fig, ax = plt.subplots(figsize=(9, 3.8))
ax.scatter(x, y, s=6, color="#888", alpha=0.6, label="данные")
g = np.linspace(0, 10, 400)[:, None]
for k in (1, 10, 100):
    ax.plot(g[:, 0], my.f0 + my.learning_rate * sum(t.predict(g) for t in my.trees[:k]), lw=2, label=f"{k} деревьев")
ax.set(xlabel="x", ylabel="y")
ax.legend()
fig.tight_layout()
ex.finish(fig, "05_gbm_from_scratch")
ex.done()
