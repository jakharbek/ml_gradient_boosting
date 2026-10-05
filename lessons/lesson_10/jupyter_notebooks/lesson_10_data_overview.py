# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_10

# %% [markdown]
# # Урок 10. Данные для бустинга: что важно, а что нет
#
# **Интерактивная версия:** `lessons/lesson_10/web/index.html`
#
# 1. Монотонные преобразования признаков не меняют прогнозы (точный перебор и гистограммы).
# 2. Выброс в признаке против выброса в y.
# 3. Наклонная граница и признак-разность.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import pandas as pd
from gbcourse import datasets, GBClassifier, GBRegressor

# %% [markdown]
# ## 1. Монотонные преобразования

# %%
X, y = datasets.friedman1(n=800, noise=1.0, seed=130)
transforms = {
    "exp": np.exp,
    "x³": lambda v: v**3,
    "ранги": lambda v: np.argsort(np.argsort(v, axis=0), axis=0).astype(float),
    "−x": lambda v: -v,
    "(x − 0.5)² — не монотонно": lambda v: (v - 0.5) ** 2,
}
rows = []
for max_bins in (None, 32):
    base = GBRegressor(n_estimators=100, max_depth=3, max_bins=max_bins).fit(X, y).predict(X)
    for name, f in transforms.items():
        p = GBRegressor(n_estimators=100, max_depth=3, max_bins=max_bins).fit(f(X), y).predict(f(X))
        rows.append({"поиск": "точный" if max_bins is None else "32 корзины", "преобразование": name,
                     "наибольшее расхождение": np.abs(p - base).max()})
pd.DataFrame(rows).pivot(index="преобразование", columns="поиск", values="наибольшее расхождение")

# %% [markdown]
# ## 2. Выброс в признаке и в целевой переменной
#
# Заменим 1% значений признака x3 на 1000 (выброс в X) или 1% значений y на +100 (выброс в y).

# %%
X_tr, X_te, y_tr, y_te = datasets.train_test_split(X, y, test_size=0.3, seed=0)
rng = np.random.default_rng(0)
idx = rng.choice(len(y_tr), size=len(y_tr) // 100, replace=False)
X_out = X_tr.copy()
X_out[idx, 3] = 1000.0
y_out = y_tr.copy()
y_out[idx] += 100.0
mse = lambda m: np.mean((y_te - m.predict(X_te)) ** 2)
params = dict(n_estimators=300, learning_rate=0.05, max_depth=3)
print(f"чистые данные:    MSE {mse(GBRegressor(**params).fit(X_tr, y_tr)):.3f}")
print(f"выбросы в X:      MSE {mse(GBRegressor(**params).fit(X_out, y_tr)):.3f}")
print(f"выбросы в y:      MSE {mse(GBRegressor(**params).fit(X_tr, y_out)):.3f}")
print(f"выбросы в y, Хьюбер: MSE {mse(GBRegressor(loss='huber', huber_delta=2.0, **params).fit(X_tr, y_out)):.3f}")

# %% [markdown]
# ## 3. Наклонная граница

# %%
rng = np.random.default_rng(0)
n = 2000
Xd = rng.uniform(0, 1, (n, 2))
yd = (Xd[:, 1] > Xd[:, 0]).astype(int)
flip = rng.random(n) < 0.05
yd[flip] = 1 - yd[flip]
a, b, c, d = datasets.train_test_split(Xd, yd, test_size=0.5, seed=0)
rows = []
for name, feats in (("x0, x1", lambda Z: Z), ("x0, x1, x1 − x0", lambda Z: np.c_[Z, Z[:, 1] - Z[:, 0]])):
    for depth in (1, 3):
        m = GBClassifier(n_estimators=200, learning_rate=0.1, max_depth=depth).fit(feats(a), c)
        rows.append({"признаки": name, "глубина": depth,
                     "точность на тесте": np.mean((m.predict_proba(feats(b))[:, 1] > 0.5) == d)})
pd.DataFrame(rows).round(3)

# %% [markdown]
# ## Упражнения
#
# 1. Проверьте, что стандартизация признаков `(X − mean)/std` не меняет прогнозы `lightgbm.LGBMRegressor`.
# 2. Сгенерируйте y = sin(3·x0/x1) + шум и сравните бустинг на (x0, x1) и на (x0, x1, x0/x1).
#
# Решения: `python lessons/lesson_10/exercises/solutions.py`.
