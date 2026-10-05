"""03. Бустинг для классификации вручную: 8 объектов, логиты и шаг Ньютона.

Цель: понять, почему классификатор бустинга работает с логитами и чем отличается шаг Ньютона.
Чему научитесь: старт F₀ = log(p / (1 − p)); вероятность p = σ(F); градиент g = p − y и гессиан h = p(1 − p);
    значение листа w = −G / H; как падает log-loss; сверка с `gbcourse` в режиме `newton`
Датасет: toy_classification — 8 объектов, x = 1…8, класс y = (0, 0, 0, 1, 0, 1, 1, 1): классы «перемешаны»
    посередине, как почти всегда в жизни.
Этапы: 1) данные  2) старт  3) одно дерево по шагам  4) ещё два дерева  5) сверка.
Попробуйте сами: 1) Возьмите темп ν = 0.3 вместо полного шага Ньютона и сравните log-loss после трёх деревьев. 2)
    Замените шаг Ньютона градиентным (лист = −среднее g): насколько медленнее падает log-loss? 3) Добавьте дубликат
    объекта класса 1 и посмотрите, как изменится стартовый логит F₀.
Связанные уроки: 6.1 «Логиты и log-loss», 6.2 «Шаг Ньютона».
Запуск: python examples/1_tiny/03_classification_by_hand.py
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="03. Бустинг для классификации вручную: 8 объектов",
             goal="пройти шаги бустинга для log-loss: логиты, g, h, лист −G/H")

import numpy as np  # noqa: E402
from gbcourse import GBClassifier, datasets  # noqa: E402

sigmoid = lambda z: 1 / (1 + np.exp(-z))
logloss = lambda y, p: float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))

# %% Этап 1. Данные
ex.stage(1, "Данные")
X, y = datasets.toy_classification()
x = X[:, 0]
ex.describe(X, y, names=["x"], target="класс", task="classification", source="gbcourse.datasets.toy_classification()")

# %% Этап 2. Старт
ex.stage(2, "Старт: логит доли класса 1")
p1 = y.mean()
F = np.full(len(y), np.log(p1 / (1 - p1)))
print(f"   доля класса 1 = {p1}, F₀ = log({p1}/{1 - p1}) = {F[0]:.4f}, p = σ(F₀) = {sigmoid(F[0]):.4f}")
print(f"   log-loss = {logloss(y, sigmoid(F)):.4f} (так же, как у «монетки» 0.5: log 2 = {np.log(2):.4f})")


def one_tree(F, verbose):
    p = sigmoid(F)
    g, h = p - y, p * (1 - p)
    if verbose:
        print("   x:          " + " ".join(f"{v:6.0f}" for v in x))
        print("   y:          " + " ".join(f"{v:6.0f}" for v in y))
        print("   p = σ(F):   " + " ".join(f"{v:6.3f}" for v in p))
        print("   g = p − y:  " + " ".join(f"{v:+6.3f}" for v in g))
        print("   h = p(1−p): " + " ".join(f"{v:6.3f}" for v in h))
    best = None
    for k in range(1, len(x)):
        t = (x[k - 1] + x[k]) / 2
        L, R = x <= t, x > t
        gain = g[L].sum() ** 2 / h[L].sum() + g[R].sum() ** 2 / h[R].sum() - g.sum() ** 2 / h.sum()
        if best is None or gain > best[0]:
            best = (gain, t, -g[L].sum() / h[L].sum(), -g[R].sum() / h[R].sum())
    return best


# %% Этап 3. Первое дерево по шагам
ex.stage(3, "Дерево 1: g, h, выигрыш G²/H и значения листьев −G/H")
gain, t, wl, wr = one_tree(F, verbose=True)
print(f"   лучший пень: x ≤ {t}; листья w = −G/H: {wl:+.4f} и {wr:+.4f}  (выигрыш {gain:.3f})")
F = F + np.where(x <= t, wl, wr)          # темп ν = 1: полный шаг Ньютона
print(f"   log-loss после дерева 1: {logloss(y, sigmoid(F)):.4f}")
ex.note("Лист — это шаг Ньютона: сумма градиентов, делённая на сумму «кривизн» h.")

# %% Этап 4. Ещё два дерева
ex.stage(4, "Деревья 2 и 3")
for m in (2, 3):
    gain, t, wl, wr = one_tree(F, verbose=False)
    F = F + np.where(x <= t, wl, wr)
    print(f"   дерево {m}: x ≤ {t}, листья {wl:+.3f} / {wr:+.3f} → log-loss {logloss(y, sigmoid(F)):.4f}")
print("   итоговые вероятности: " + " ".join(f"{v:.2f}" for v in sigmoid(F)))
ex.note("Объекты x = 4 (класс 1) и x = 5 (класс 0) стоят «не на своих местах»: модель менее уверена в них (0.75 и 0.34), чем в остальных (0.11 и 0.88).")

# %% Этап 5. Сверка
ex.stage(5, "Сверка с gbcourse.GBClassifier(mode='newton', max_depth=1, 3 дерева, ν = 1)")
lib = GBClassifier(mode="newton", n_estimators=3, max_depth=1, learning_rate=1.0).fit(X, y)
diff = np.abs(lib.predict_proba(X)[:, 1] - sigmoid(F)).max()
print(f"   наибольшее расхождение вероятностей: {diff:.1e}")
assert diff < 1e-10
ex.done()
