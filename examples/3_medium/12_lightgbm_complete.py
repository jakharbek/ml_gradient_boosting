"""12. LightGBM от начала до конца: отклик клиентов, 50 000 объектов, редкий класс.

Цель: полный рабочий цикл LightGBM для бинарной классификации.
Чему научитесь: нативный `lgb.Dataset` и `lgb.train`; категориальные признаки; колбэки: журнал и ранняя остановка;
    метрики AUC и log-loss; важности split и gain; вклады признаков (`pred_contrib=True`); сохранение в текстовый
    формат
Датасет: _data.make_customers — 50 000 клиентов, 8 признаков (возраст, доход с пропусками, стаж, покупки,
    дни с последней покупки, канал, регион из 50 значений, подписка), откликнулись 5%.
Этапы: 1) данные  2) разбиение  3) обучение с журналом  4) качество  5) важности  6) вклады  7) сохранение.
Попробуйте сами: 1) Уберите categorical_feature: регион станет числом — как изменится AUC? 2) Включите GOSS
    (data_sample_strategy="goss") и сравните время и качество. 3) Нарисуйте кривые log-loss и AUC по итерациям из
    словаря history.
Связанные уроки: 9.2 «LightGBM», 10.2 «Пропуски, выбросы, дисбаланс».
Запуск: python examples/3_medium/12_lightgbm_complete.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_customers  # noqa: E402

ex = Example(__file__, title="12. LightGBM от начала до конца: отклик клиентов",
             goal="пройти полный цикл LightGBM для бинарной классификации")

import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402
from sklearn.metrics import average_precision_score, log_loss, roc_auc_score  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
X, y = make_customers(ex.size(50_000, 10_000), positive_rate=0.05)
ex.describe(X, y, target="отклик", task="classification", source="examples/_data.py → make_customers")

# %% Этап 2. Разбиение
ex.stage(2, "Разбиение 60 / 20 / 20 со стратификацией по классу")
from sklearn.model_selection import train_test_split  # noqa: E402

X_tmp, X_te, y_tmp, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=0)
X_tr, X_va, y_tr, y_va = train_test_split(X_tmp, y_tmp, test_size=0.25, stratify=y_tmp, random_state=0)
print(f"   {len(y_tr)} / {len(y_va)} / {len(y_te)}; доля класса 1: {y_tr.mean():.3f} / {y_va.mean():.3f} / {y_te.mean():.3f}")

# %% Этап 3. Обучение
ex.stage(3, "lgb.train: Dataset, категории, журнал каждые 100 деревьев, ранняя остановка по log-loss")
dtr = lgb.Dataset(X_tr, y_tr, categorical_feature=["канал", "регион"])
dva = lgb.Dataset(X_va, y_va, reference=dtr)
params = {"objective": "binary", "metric": ["binary_logloss", "auc"], "learning_rate": 0.05, "num_leaves": 31,
          "min_child_samples": 50, "feature_fraction": 0.8, "bagging_fraction": 0.8, "bagging_freq": 1,
          "cat_smooth": 20, "verbose": -1, "seed": 0}
history = {}
with ex.timer("обучение"):
    bst = lgb.train(params, dtr, num_boost_round=5000, valid_sets=[dva], valid_names=["валидация"],
                    callbacks=[lgb.log_evaluation(100), lgb.early_stopping(100, first_metric_only=True, verbose=False),
                               lgb.record_evaluation(history)])
print(f"   лучшая итерация {bst.best_iteration}")
ex.note("first_metric_only=True: останавливаемся по первой метрике (log-loss), AUC только записывается.")
fig, axes = plt.subplots(1, 2, figsize=(10, 3.4))
for ax, key, label in ((axes[0], "binary_logloss", "log-loss (меньше — лучше)"), (axes[1], "auc", "ROC AUC (больше — лучше)")):
    ax.plot(history["валидация"][key], color=ROLE["valid"], lw=2, label="валидация")
    ax.axvline(bst.best_iteration, color=ROLE["truth"], ls="--", lw=1.5, label=f"лучшая итерация {bst.best_iteration}")
    ax.set(xlabel="число деревьев", title=label)
axes[0].legend()
fig.tight_layout()
ex.finish(fig, "12_validation_curves")

# %% Этап 4. Качество
ex.stage(4, "Качество на тесте")
p = bst.predict(X_te, num_iteration=bst.best_iteration)
print(f"   ROC AUC {roc_auc_score(y_te, p):.4f}, средняя точность (AP) {average_precision_score(y_te, p):.4f}, "
      f"log-loss {log_loss(y_te, p):.4f} (константа: {log_loss(y_te, np.full(len(y_te), y_tr.mean())):.4f})")
top = np.argsort(-p)[: len(p) // 10]
print(f"   в 10% клиентов с наибольшей вероятностью — {y_te[top].sum()} из {y_te.sum()} откликов ({y_te[top].sum() / y_te.sum():.0%})")
ex.note("При редком классе точность (accuracy) бесполезна: «никто не откликнется» даёт 95%. Смотрим AUC, AP и охват верха списка.")

# %% Этап 5. Важности
ex.stage(5, "Важности: split (число разбиений) против gain (выигрыш)")
split = bst.feature_importance("split")
gain = bst.feature_importance("gain")
for f, s_, g_ in sorted(zip(bst.feature_name(), split, gain), key=lambda t: -t[2]):
    print(f"   {f:14s} разбиений {s_:5d}   выигрыш {g_:10.1f}")

# %% Этап 6. Вклады
ex.stage(6, "Вклады признаков (TreeSHAP встроен: pred_contrib=True)")
contrib = bst.predict(X_te.iloc[:1000], num_iteration=bst.best_iteration, pred_contrib=True)
mean_abs = np.abs(contrib[:, :-1]).mean(0)
print("   средний |вклад| в логит: " + ", ".join(f"{f} {v:.3f}" for f, v in sorted(zip(bst.feature_name(), mean_abs), key=lambda t: -t[1])))
raw = bst.predict(X_te.iloc[:1000], num_iteration=bst.best_iteration, raw_score=True)
assert np.allclose(contrib.sum(1), raw)
ex.note("Сумма вкладов и базы равна сырому прогнозу (логиту) — свойство значений Шепли.")

# %% Этап 7. Сохранение
ex.stage(7, "Сохранение в текстовый формат и загрузка")
with tempfile.TemporaryDirectory() as d:
    path = Path(d) / "customers.txt"
    bst.save_model(str(path), num_iteration=bst.best_iteration)
    loaded = lgb.Booster(model_file=str(path))
    same = np.allclose(loaded.predict(X_te), p)
    print(f"   файл {path.stat().st_size / 1024:.0f} КБ, деревьев {loaded.num_trees()}; прогнозы совпадают: {same}")
assert same
ex.done()
