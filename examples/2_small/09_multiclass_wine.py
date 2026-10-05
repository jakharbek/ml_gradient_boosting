"""09. Многоклассовая классификация: реальные данные «Вино» (178 образцов, 3 сорта).

Цель: разобраться с многоклассовым бустингом (softmax) и его вероятностями на маленьком реальном наборе.
Чему научитесь: K деревьев на итерацию — по одному на класс; вероятности через softmax; log-loss и точность; матрица
    ошибок; почему на 178 объектах нужны регуляризация и честное сравнение с логистической регрессией
Датасет: sklearn.datasets.load_wine — 178 вин трёх сортов из одного региона Италии, 13 химических
    показателей (алкоголь, яблочная кислота, флавоноиды, цвет…). Встроен в scikit-learn.
Этапы: 1) данные  2) модели по кросс-валидации  3) устройство softmax-бустинга  4) матрица ошибок  5) выводы.
Попробуйте сами: 1) Оставьте треть обучающих данных — кто теряет больше: логистическая регрессия или LightGBM? 2)
    Найдите, какие признаки важнее всего для каждого из трёх сортов (у каждого класса свои деревья). 3) Замените
    objective на "multiclassova" (один против всех) и сравните log-loss.
Связанные уроки: 6.3 «Многоклассовая классификация».
Запуск: python examples/2_small/09_multiclass_wine.py [--save] [--no-show]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="09. Многоклассовая классификация: «Вино»",
             goal="понять softmax-бустинг и честно сравнить его с линейной моделью")

import lightgbm as lgb  # noqa: E402
import numpy as np  # noqa: E402
from sklearn.datasets import load_wine  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import confusion_matrix  # noqa: E402
from sklearn.model_selection import (  # noqa: E402
    RepeatedStratifiedKFold,
    cross_val_score,
    train_test_split,
)
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
data = load_wine(as_frame=True)
X, y = data.data, data.target.to_numpy()
ex.describe(X, y, target="сорт", task="classification", source="sklearn.datasets.load_wine (UCI Wine)")

# %% Этап 2. Модели
ex.stage(2, "Кросс-валидация: 5 фолдов × 3 повтора")
cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=0)
models = {
    "логистическая регрессия": make_pipeline(StandardScaler(), LogisticRegression(max_iter=5000)),
    "LightGBM по умолчанию": lgb.LGBMClassifier(verbose=-1, random_state=0),
    "LightGBM для малых данных": lgb.LGBMClassifier(n_estimators=300, learning_rate=0.03, num_leaves=4,
                                                   min_child_samples=5, verbose=-1, random_state=0),
}
res = {}
for name, m in models.items():
    acc = cross_val_score(m, X, y, cv=cv, scoring="accuracy")
    ll = -cross_val_score(m, X, y, cv=cv, scoring="neg_log_loss")
    res[name] = (acc.mean(), ll.mean())
    print(f"   {name:26s} точность {acc.mean():.4f}, log-loss {ll.mean():.4f}")
ex.note("""Логистическая регрессия лучше обеих версий бустинга: сорта почти линейно разделимы по 13 химическим признакам.
Наша «настройка для малых данных» оказалась хуже умолчаний по log-loss — интуиция о параметрах часто ошибается,
поэтому любую настройку проверяют кросс-валидацией, а не принимают на веру.""")
ex.barh({k: v[1] for k, v in res.items()}, best=min(res, key=lambda k: res[k][1]), name="09_models_logloss",
        xlabel="log-loss (меньше — лучше)", title="Вино: 3 сорта, 5 фолдов × 3 повтора", fmt="{:.4f}")
assert res["логистическая регрессия"][1] < min(res["LightGBM по умолчанию"][1], res["LightGBM для малых данных"][1])

# %% Этап 3. Устройство
ex.stage(3, "Устройство softmax-бустинга: K деревьев на итерацию")
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.3, stratify=y, random_state=0)
m = models["LightGBM для малых данных"].fit(X_tr, y_tr)
info = m.booster_.dump_model()
print(f"   деревьев в модели: {len(info['tree_info'])} = {m.n_estimators} итераций × {m.n_classes_} класса")
raw = m.predict(X_te[:1], raw_score=True)[0]
p = np.exp(raw - raw.max()) / np.exp(raw - raw.max()).sum()
print(f"   сырые оценки первого объекта: {np.round(raw, 3)} → softmax {np.round(p, 3)}; predict_proba {np.round(m.predict_proba(X_te[:1])[0], 3)}")
assert np.allclose(p, m.predict_proba(X_te[:1])[0])

# %% Этап 4. Матрица ошибок
ex.stage(4, "Матрица ошибок на отложенных 30%")
cm = confusion_matrix(y_te, m.predict(X_te))
print("   строки — истинный сорт, столбцы — предсказанный")
for i, row in enumerate(cm):
    print(f"   сорт {i}: " + " ".join(f"{v:4d}" for v in row))

# %% Этап 5. Выводы
ex.stage(5, "Выводы")
ex.note("""Многоклассовый бустинг строит по дереву на класс; вероятности — softmax сырых оценок.
На маленьких данных легко ошибиться с настройкой: наша «версия для малых данных» проиграла умолчаниям по log-loss.
Любое изменение параметров проверяйте кросс-валидацией, а простую модель держите как ориентир.""")
ex.done()
