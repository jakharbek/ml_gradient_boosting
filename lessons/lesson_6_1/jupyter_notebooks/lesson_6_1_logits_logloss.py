# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_6_1

# %% [markdown]
# # Урок 6.1. Логиты, сигмоида и log-loss
#
# **Интерактивная версия:** `lessons/lesson_6_1/web/index.html`
#
# 1. Логит и сигмоида.
# 2. Градиент и гессиан log-loss — проверка численно.
# 3. F₀ при несбалансированных классах.
# 4. Бустинг, обученный на MSE вероятностей, против log-loss.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import matplotlib.pyplot as plt
from gbcourse import datasets, get_loss, GBClassifier, RegressionTree
from gbcourse.metrics import log_loss, accuracy
from gbcourse.plotting import use_course_style

use_course_style()

# %% [markdown]
# ## 1. Логит и сигмоида

# %%
for p in (0.5, 0.8, 0.9, 0.99, 0.999):
    print(f"p = {p:6}: шансы {p / (1 - p):8.2f} : 1, логит {np.log(p / (1 - p)):6.3f}")

# %% [markdown]
# ## 2. Градиент и гессиан

# %%
loss = get_loss("logistic")
F = np.linspace(-4, 4, 9)
for yv in (0.0, 1.0):
    y = np.full_like(F, yv)
    eps = 1e-5
    num_g = (loss.pointwise(y, F + eps) - loss.pointwise(y, F - eps)) / (2 * eps)
    print(f"y = {yv:.0f}: max|g − численный| = {np.abs(num_g - loss.gradient(y, F)).max():.1e}")

# %% [markdown]
# ## 3. Стартовая константа

# %%
X, y = datasets.classification_2d(kind="blobs", n=200, noise=0.8, seed=62, balance=0.25)
F0 = loss.init(y)
cs = np.linspace(-4, 2, 6001)
print(f"доля класса 1 = {y.mean():.3f}; F0 = {F0:.4f}; перебор: {cs[np.argmin([loss.loss(y, np.full_like(y, c, dtype=float)) for c in cs])]:.4f}")

# %% [markdown]
# ## 4. Бустинг на MSE вероятностей против log-loss
#
# «Неправильный» бустинг: структура по градиенту MSE вероятностей $2(y - p)\,p(1-p)$, лист — среднее,
# шаг в логитах. Сравниваем честно: каждой модели — её лучшее число деревьев по валидации.

# %%
Xc, yc = datasets.classification_2d(kind="moons", n=400, noise=0.3, seed=63)
X_tr, X_te, y_tr, y_te = datasets.train_test_split(Xc, yc, test_size=0.3, seed=0)
X_a, X_v, y_a, y_v = datasets.train_test_split(X_tr, y_tr, test_size=0.3, seed=1)


def boost_mse_on_proba(X, y, M=500, nu=0.3):
    f0 = np.log(y.mean() / (1 - y.mean()))
    F, trees = np.full(len(y), f0), []
    for _ in range(M):
        p = 1 / (1 + np.exp(-F))
        r = 2 * (y - p) * p * (1 - p)          # антиградиент (y − σ(F))² по F
        t = RegressionTree(max_depth=2).fit(X, -r)
        F += nu * t.predict(X)
        trees.append(t)
    return f0, trees


def staged_proba(f0, trees, X, nu=0.3):
    F = np.full(len(X), f0)
    for t in trees:
        F = F + nu * t.predict(X)
        yield 1 / (1 + np.exp(-F))


f0, trees = boost_mse_on_proba(X_a, y_a)
val_curve = [log_loss(y_v, p) for p in staged_proba(f0, trees, X_v)]
best_mse = int(np.argmin(val_curve)) + 1
p_mse = list(staged_proba(f0, trees[:best_mse], X_te))[-1]
ll_model = GBClassifier(n_estimators=500, learning_rate=0.3, max_depth=2).fit(X_a, y_a, eval_set=(X_v, y_v))
p_ll = ll_model.predict_proba(X_te, n_iter=ll_model.best_iteration_)[:, 1]
p_ll_all = ll_model.predict_proba(X_te)[:, 1]
for name, p, M in (("MSE вероятностей", p_mse, best_mse), ("log-loss", p_ll, ll_model.best_iteration_),
                   ("log-loss, все 500", p_ll_all, 500)):
    print(f"{name:18s} ({M:3d} деревьев): log-loss теста {log_loss(y_te, p):.4f}, точность {accuracy(y_te, (p > 0.5).astype(int)):.3f}")

# %% [markdown]
# При лучшем числе деревьев log-loss не хуже и требует **во много раз меньше деревьев**: градиент MSE
# содержит множитель $p(1-p)$ и почти исчезает на уверенных ошибках, поэтому такая модель учится
# медленно. Обратная сторона быстроты видна в последней строке: без ранней остановки модель на
# log-loss становится излишне уверенной и её log-loss на тесте растёт — урок 7.1.

# %% [markdown]
# ## Упражнения
#
# 1. Докажите, что $\sigma'(F) = \sigma(F)(1-\sigma(F))$.
# 2. Покажите, что ожидаемый log-loss $q\,(-\log p) + (1-q)(-\log(1-p))$ минимален при $p = q$.
#
# Решения: `python lessons/lesson_6_1/exercises/solutions.py`.
