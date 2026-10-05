# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_13_3

# %% [markdown]
# # Урок 13.3. Бустинг в эксплуатации
#
# **Интерактивная версия:** `lessons/lesson_13_3/web/index.html`
#
# 1. Сдвиг данных: ошибка, PSI и состязательная проверка при разном сдвиге.
# 2. Экстраполяция: прогноз за пределами обучающих данных.
# 3. Скорость: пакетный прогноз против одиночных вызовов.
# 4. Порядок признаков: что будет, если перепутать столбцы.

# %%
import sys
import tempfile
import time
import warnings
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import lightgbm as lgb
import numpy as np
import pandas as pd
from gbcourse import datasets, GBClassifier, GBRegressor
from gbcourse.metrics import roc_auc

# %% [markdown]
# ## 1. Сдвиг данных

# %%
f = lambda x: np.sin(x) + 0.3 * x
r = np.random.default_rng(0)
x_tr = r.uniform(0, 6, 1000)
y_tr = f(x_tr) + r.normal(0, 0.3, 1000)
model = GBRegressor(n_estimators=200, learning_rate=0.1, max_depth=3).fit(x_tr[:, None], y_tr)
edges = np.quantile(x_tr, np.linspace(0, 1, 11))
edges[0], edges[-1] = -np.inf, np.inf


def psi(a, b):
    pa = np.clip(np.histogram(a, edges)[0] / len(a), 1e-4, None)
    pb = np.clip(np.histogram(b, edges)[0] / len(b), 1e-4, None)
    return float(np.sum((pb - pa) * np.log(pb / pa)))


rows = []
for s in (0, 0.5, 1, 2, 3, 4):
    rn = np.random.default_rng(10 + int(s * 10))
    x_new = rn.uniform(s, 6 + s, 1000)
    y_new = f(x_new) + rn.normal(0, 0.3, 1000)
    Z = np.r_[x_tr, x_new][:, None]
    lab = np.r_[np.zeros(1000), np.ones(1000)]
    perm = np.random.default_rng(1).permutation(2000)
    a, b = perm[:1400], perm[1400:]
    clf = GBClassifier(n_estimators=100, max_depth=2, learning_rate=0.1).fit(Z[a], lab[a])
    rows.append({"сдвиг s": s, "RMSE на новых": np.sqrt(np.mean((y_new - model.predict(x_new[:, None])) ** 2)),
                 "AUC старые/новые": roc_auc(lab[b], clf.predict_proba(Z[b])[:, 1]), "PSI": psi(x_tr, x_new)})
pd.DataFrame(rows).round(3)

# %% [markdown]
# ## 2. Экстраполяция

# %%
for x in (5.0, 6.0, 7.0, 8.0, 9.9):
    print(f"x = {x:4}: прогноз {model.predict(np.array([[x]]))[0]:.3f}, истина {f(x):.3f}")

# %% [markdown]
# ## 3. Скорость прогноза

# %%
Xb, yb = datasets.friedman1(n=20000, noise=1.0, seed=231)
m = lgb.LGBMRegressor(n_estimators=500, num_leaves=31, verbose=-1).fit(Xb[:10000], yb[:10000])
Xq = Xb[10000:]
t0 = time.perf_counter()
m.predict(Xq)
batch = time.perf_counter() - t0
t0 = time.perf_counter()
for i in range(1000):
    m.predict(Xq[i:i + 1])
single = (time.perf_counter() - t0) * 10  # пересчёт на 10 000 объектов
print(f"10 000 объектов одним пакетом: {batch * 1000:.1f} мс; по одному: ≈ {single * 1000:.0f} мс; разница ≈ {single / batch:.0f} раз")

# %% [markdown]
# ## 4. Порядок признаков
#
# Обучим на DataFrame с именами и подадим столбцы в другом порядке. Как массив — получим мусор: будет лишь
# предупреждение «X does not have valid feature names», которое легко пропустить (порядок оно не проверяет).
# Как DataFrame с `validate_features=True` — LightGBM сверит имена и откажется считать.

# %%
cols = [f"x{j}" for j in range(10)]
D = pd.DataFrame(Xb[:10000], columns=cols)
m2 = lgb.LGBMRegressor(n_estimators=200, verbose=-1).fit(D, yb[:10000])
Q = pd.DataFrame(Xb[10000:12000], columns=cols)
good = m2.predict(Q)
with warnings.catch_warnings(record=True) as caught:                 # перехватим, чтобы показать текст
    warnings.simplefilter("always")
    bad = m2.predict(Q[cols[::-1]].to_numpy())
for w in caught:
    print("предупреждение:", str(w.message).split(",")[0])
print(f"RMSE: правильный порядок {np.sqrt(np.mean((yb[10000:12000] - good) ** 2)):.3f}, "
      f"перепутанные столбцы (массив) {np.sqrt(np.mean((yb[10000:12000] - bad) ** 2)):.3f}")
try:
    m2.predict(Q[cols[::-1]], validate_features=True)
    print("DataFrame с другим порядком столбцов принят без ошибки")
except Exception as e:  # noqa: BLE001
    print("DataFrame с другим порядком: ошибка —", type(e).__name__, str(e)[:120])

# %%
with tempfile.TemporaryDirectory() as tmp:
    path = Path(tmp) / "model.txt"
    m2.booster_.save_model(str(path))
    loaded = lgb.Booster(model_file=str(path))
    print("модель сохранена и загружена, прогнозы совпадают:", np.allclose(loaded.predict(Q.to_numpy()), good))
    print("имена признаков в файле:", loaded.feature_name()[:4], "…")

# %% [markdown]
# ## Упражнения
#
# 1. Найдите, при каком сдвиге s PSI впервые превышает 0.25, а AUC состязательного классификатора — 0.6.
# 2. Сдвиньте на 2 только признак x3 в задаче Фридмана и найдите его по важностям состязательного классификатора.
#
# Решения: `python lessons/lesson_13_3/exercises/solutions.py`.
