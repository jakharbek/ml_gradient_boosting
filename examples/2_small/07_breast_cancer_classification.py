"""07. Реальные данные «Рак груди» (569 опухолей): бинарная классификация и выбор порога.

Цель: пройти задачу бинарной классификации от данных до решения с выбранным порогом.
Чему научитесь: разбор набора и баланса классов; ROC AUC и точность; матрица ошибок; почему порог 0.5 — не закон
    (пропустить злокачественную опухоль дороже); сравнение с логистической регрессией
Датасет: sklearn.datasets.load_breast_cancer — 569 опухолей, 30 признаков (размер, форма, текстура ядер клеток
    по снимку), класс 1 — доброкачественная (357), 0 — злокачественная (212). Встроен в scikit-learn.
Этапы: 1) данные  2) модели по кросс-валидации  3) одна модель на отложенных данных  4) порог  5) выводы.
Попробуйте сами: 1) Сделайте цену пропуска злокачественной опухоли 50 вместо 10 — какой порог станет лучшим? 2)
    Проверьте калибровку вероятностей LightGBM на этих данных (методы из примера 28). 3) Оставьте 5 самых важных
    признаков: сколько AUC потеряется?
Связанные уроки: 6 «Классификация», 13.2 «Калибровка и интервалы».
Запуск: python examples/2_small/07_breast_cancer_classification.py [--save] [--no-show]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="07. Реальные данные «Рак груди»: классификация и порог",
             goal="построить классификатор и выбрать порог по цене ошибок")

import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402
from sklearn.datasets import load_breast_cancer  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import confusion_matrix, roc_auc_score  # noqa: E402
from sklearn.model_selection import (  # noqa: E402
    RepeatedStratifiedKFold,
    cross_val_score,
    train_test_split,
)
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
data = load_breast_cancer(as_frame=True)
X, y = data.data, data.target.to_numpy()
ex.describe(X, y, target="1 = доброкачественная", task="classification", source="sklearn.datasets.load_breast_cancer (Wisconsin)")

# %% Этап 2. Модели
ex.stage(2, "Сравнение по кросс-валидации (5 фолдов × 3 повтора)")
cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=0)
models = {"логистическая регрессия": make_pipeline(StandardScaler(), LogisticRegression(max_iter=5000)),
          "LightGBM по умолчанию": lgb.LGBMClassifier(verbose=-1, random_state=0)}
auc = {}
for name, m in models.items():
    a = cross_val_score(m, X, y, cv=cv, scoring="roc_auc")
    acc = cross_val_score(m, X, y, cv=cv, scoring="accuracy")
    auc[name] = a.mean()
    print(f"   {name:24s} ROC AUC {a.mean():.4f} ± {a.std():.4f}, точность {acc.mean():.4f}")
ex.note("Обе модели почти безошибочны; логистическая регрессия не хуже — признаки хорошо разделяют классы и линейно.")

# %% Этап 3. Отложенные данные
ex.stage(3, "LightGBM: обучение на 70%, проверка на 30%")
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3, stratify=y, random_state=0)
m = lgb.LGBMClassifier(verbose=-1, random_state=0).fit(X_tr, y_tr)
p = m.predict_proba(X_te)[:, 1]
print(f"   ROC AUC на отложенных: {roc_auc_score(y_te, p):.4f}")
tn, fp, fn, tp = confusion_matrix(y_te, p > 0.5).ravel()
print(f"   порог 0.5: злокачественных пропущено (названы доброкачественными) — {fp}, ложных тревог — {fn}")

# %% Этап 4. Порог
ex.stage(4, "Порог: пропуск злокачественной опухоли в 10 раз дороже ложной тревоги")
best, curve = None, []
for t in np.linspace(0.05, 0.95, 91):
    tn, fp, fn, tp = confusion_matrix(y_te, p > t).ravel()
    cost = 10 * fp + fn          # fp: злокачественная (0) названа доброкачественной (1)
    curve.append((t, cost))
    if best is None or cost < best[0]:
        best = (cost, t, fp, fn)
tn, fp5, fn5, tp = confusion_matrix(y_te, p > 0.5).ravel()
print(f"   порог 0.5: цена {10 * fp5 + fn5} (пропусков {fp5}, тревог {fn5})")
print(f"   лучший порог {best[1]:.2f}: цена {best[0]} (пропусков {best[2]}, тревог {best[3]})")
assert best[0] <= 10 * fp5 + fn5
fig, ax = plt.subplots(figsize=(8, 3.4))
ax.plot(*zip(*curve), color=ROLE["model"], lw=2, label="цена ошибок = 10 × пропуски + тревоги")
ax.axvline(0.5, color=ROLE["truth"], ls="--", lw=1.5, label="порог по умолчанию 0.5")
ax.axvline(best[1], color=ROLE["tree"], lw=2, label=f"лучший порог {best[1]:.2f}")
ax.set(xlabel="порог: «доброкачественная», если p > порога", ylabel="цена ошибок на тесте",
       title="Порог выбирают по цене ошибок")
ax.legend()
ex.finish(fig, "07_threshold_cost")
ex.note("Порог выбирают по цене ошибок, а не по умолчанию. На честной задаче его подбирают на валидации, а не на тесте.")

# %% Этап 5. Вывод
ex.stage(5, "Вывод")
ex.note("""Модель — это ещё и порог: одна и та же вероятность ведёт к разным решениям при разной цене ошибок.
На 569 объектах и хорошо разделимых признаках бустинг не обязан обгонять логистическую регрессию.""")
ex.done()
