"""21. Картинки рукописных цифр (1797 × 64 пикселя): где бустинг — не лучший выбор.

Цель: понять границы применимости бустинга на реальных нетабличных данных.
Чему научитесь: разбор набора-изображения: пиксели как признаки; многоклассовый бустинг на 10 классах; честное
    сравнение с логистической регрессией, случайным лесом и SVM; время обучения; матрица ошибок
Датасет: sklearn.datasets.load_digits — 1797 изображений 8×8 рукописных цифр 0–9 (яркость 0–16 в каждом из
    64 пикселей). Встроен в scikit-learn.
Этапы: 1) данные  2) модели по кросс-валидации  3) где ошибается бустинг  4) выводы.
Попробуйте сами: 1) Добавьте признаки-суммы по строкам и столбцам изображения — догонит ли бустинг SVM? 2) Нарисуйте
    важность 64 пикселей для LightGBM картой 8×8. 3) Обучите модели на 300 изображениях вместо 1437 — чья точность
    падает сильнее?
Связанные уроки: 6.3 «Многоклассовая классификация», 9.4 «Сравнение».
Запуск: python examples/3_medium/21_digits_images.py [--save] [--no-show]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="21. Рукописные цифры: где бустинг не лучший",
             goal="сравнить бустинг с другими моделями на изображениях")

import time  # noqa: E402
import warnings  # noqa: E402

import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from sklearn.datasets import load_digits  # noqa: E402
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import confusion_matrix  # noqa: E402
from sklearn.model_selection import (  # noqa: E402
    StratifiedKFold,
    cross_val_predict,
    cross_val_score,
)
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402
from sklearn.svm import SVC  # noqa: E402

warnings.filterwarnings("ignore")

# %% Этап 1. Данные
ex.stage(1, "Данные")
X, y = load_digits(return_X_y=True)
ex.describe(X[:, :8], y, names=[f"пиксель_{j}" for j in range(8)], target="цифра", task="classification",
            source="sklearn.datasets.load_digits (UCI) — показаны первые 8 из 64 пикселей")
fig, axes = plt.subplots(1, 10, figsize=(10, 1.4))
for d, ax in enumerate(axes):
    ax.imshow(X[y == d][0].reshape(8, 8), cmap="gray_r")
    ax.set(xticks=[], yticks=[], title=str(d))
ex.finish(fig, "21_digits")

# %% Этап 2. Модели
ex.stage(2, "5-кратная кросс-валидация: точность и время")
cv = StratifiedKFold(5, shuffle=True, random_state=0)
models = {
    "логистическая регрессия": make_pipeline(StandardScaler(), LogisticRegression(max_iter=5000)),
    "случайный лес": RandomForestClassifier(500, random_state=0, n_jobs=-1),
    "HistGradientBoosting": HistGradientBoostingClassifier(random_state=0),
    "LightGBM": lgb.LGBMClassifier(n_estimators=500, learning_rate=0.05, num_leaves=15, min_child_samples=5, verbose=-1, random_state=0),
    "SVM (RBF-ядро)": make_pipeline(StandardScaler(), SVC()),
}
acc = {}
for name, m in models.items():
    t = time.perf_counter()
    a = cross_val_score(m, X, y, cv=cv)
    acc[name] = a.mean()
    print(f"   {name:24s} точность {a.mean():.4f} ± {a.std():.4f}   ({time.perf_counter() - t:.1f} с)")
ex.note("SVM с RBF-ядром лучший и в 10–20 раз быстрее бустинга; бустинг не обгоняет даже случайный лес.")
assert acc["SVM (RBF-ядро)"] > acc["LightGBM"]

# %% Этап 3. Ошибки
ex.stage(3, "Какие цифры путает LightGBM")
pred = cross_val_predict(models["LightGBM"], X, y, cv=cv)
cm = confusion_matrix(y, pred)
np.fill_diagonal(cm, 0)
pairs = sorted(((cm[i, j], i, j) for i in range(10) for j in range(10) if cm[i, j]), reverse=True)[:4]
for c, i, j in pairs:
    print(f"   {i} → {j}: ошибок {c}")

# %% Этап 4. Выводы
ex.stage(4, "Выводы")
ex.note("""Пиксели — однородные признаки, важна пространственная структура (соседство пикселей, сдвиги).
Деревья смотрят на пиксели по одному и этой структуры не видят; для изображений лучше ядра и свёрточные сети.
Бустинг — лучший выбор для разнородных табличных признаков: цены, категории, счётчики, даты.""")
ex.done()
