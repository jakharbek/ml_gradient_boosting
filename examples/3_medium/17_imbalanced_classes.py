"""17. Редкий класс (1%): метрики, веса классов, порог и бюджет.

Цель: правильно работать с сильно несбалансированной классификацией.
Чему научитесь: почему точность бесполезна; ROC AUC против средней точности (AP); ловушка ранней остановки у
    взвешенной модели; `scale_pos_weight` и что он делает с вероятностями; выбор порога по бюджету («обзвонить 2%
    клиентов»); пересчёт вероятностей
Датасет: _data.make_customers — 100 000 клиентов, откликнулся 1%.
Этапы: 1) данные  2) ловушка ранней остановки  3) честное сравнение весов  4) порог по бюджету  5) пересчёт вероятностей.
Попробуйте сами: 1) Остановите модель с весом 99 по log-loss с теми же весами на валидации (eval_sample_weight) —
    сколько будет деревьев? 2) Возьмите бюджет обзвона 5% вместо 2% и сравните охват моделей. 3) Откалибруйте модель
    с весом 99 изотонической регрессией (пример 28) и сравните с пересчётом по формуле.
Связанные уроки: 10.2 «Пропуски, выбросы, дисбаланс», 13.2 «Калибровка и интервалы».
Запуск: python examples/3_medium/17_imbalanced_classes.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_customers  # noqa: E402

ex = Example(__file__, title="17. Редкий класс: метрики, веса, порог",
             goal="работать с классом в 1% правильно")

import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    accuracy_score,
    average_precision_score,
    log_loss,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
X, y = make_customers(ex.size(100_000, 30_000), positive_rate=0.01, seed=17)
ex.describe(X, y, target="отклик", task="classification", source="examples/_data.py → make_customers(positive_rate=0.01)")
X_tmp, X_te, y_tmp, y_te = train_test_split(X, y, test_size=0.3, stratify=y, random_state=0)
X_tr, X_va, y_tr, y_va = train_test_split(X_tmp, y_tmp, test_size=0.3, stratify=y_tmp, random_state=0)
print(f"   откликов: обучение {y_tr.sum()}, валидация {y_va.sum()}, тест {y_te.sum()}")
print(f"   точность модели «никто не откликнется»: {accuracy_score(y_te, np.zeros_like(y_te)):.3f}")


def fit(weight, metric="average_precision"):
    """Ранняя остановка ТОЛЬКО по указанной метрике на валидации."""
    m = lgb.LGBMClassifier(n_estimators=3000, learning_rate=0.03, num_leaves=15, min_child_samples=100,
                           scale_pos_weight=weight, metric=metric, verbose=-1, random_state=0)
    m.fit(X_tr, y_tr, eval_X=(X_va,), eval_y=(y_va,), callbacks=[lgb.early_stopping(200, verbose=False)])
    return m, m.predict_proba(X_te)[:, 1]


def report(name, m, p):
    print(f"   {name:22s} деревьев {m.best_iteration_:4d}; AUC {roc_auc_score(y_te, p):.4f}, AP {average_precision_score(y_te, p):.4f}, "
          f"log-loss {log_loss(y_te, p):.4f}, средний прогноз {p.mean():.4f}")


# %% Этап 2. Ловушка ранней остановки
ex.stage(2, "Ловушка: ранняя остановка по log-loss у модели с весами")
m_trap, p_trap = fit(99.0, metric="binary_logloss")
report("вес 99, стоп по log-loss", m_trap, p_trap)
ex.note("""Вес 99 раздувает вероятности, и log-loss на валидации (без весов) с первых деревьев только растёт —
остановка срабатывает почти сразу, модель остаётся недообученной. Со взвешенной моделью останавливайтесь по метрике
ранжирования (AP, AUC) — или по log-loss с теми же весами на валидации.""")
assert m_trap.best_iteration_ < 10

# %% Этап 3. Без весов и с весами
ex.stage(3, "Честное сравнение: остановка по средней точности (AP)")
print(f"   доля откликов на тесте: {y_te.mean():.4f}")
m0, p0 = fit(1.0)
m5, p5 = fit(5.0)
m1, p1 = fit(99.0)
report("без весов", m0, p0)
report("scale_pos_weight = 5", m5, p5)
report("scale_pos_weight = 99", m1, p1)
ex.note("""Веса почти не меняют ранжирование: различия AUC и AP — в пределах случайного разброса (проверено на
нескольких seed; при ~300 откликах в тесте разброс AUC около ±0.015). Зато вероятности раздуваются: средний
прогноз с весом 99 в десятки раз больше доли откликов.""")
if not ex.quick:                                              # на уменьшенных данных откликов слишком мало
    assert p1.mean() > 10 * y_te.mean() and abs(p0.mean() - y_te.mean()) < 0.003

# %% Этап 4. Порог по бюджету
ex.stage(4, "Порог по бюджету: обзвонить 2% клиентов с наибольшей вероятностью")
k = int(0.02 * len(y_te))
for name, p in (("без весов", p0), ("вес 5", p5), ("вес 99", p1)):
    top = np.argsort(-p)[:k]
    print(f"   {name:10s}: в топ-2% ({k} клиентов) — {y_te[top].sum()} откликов из {y_te.sum()} "
          f"(охват {y_te[top].sum() / y_te.sum():.0%}; случайный выбор дал бы ~2%)")
ex.note("Бюджет задаёт не порог вероятности, а число объектов сверху списка — важно только ранжирование.")
fig, ax = plt.subplots(figsize=(8, 3.8))
share = np.arange(1, len(y_te) + 1) / len(y_te)
for (name, p), c in zip((("без весов", p0), ("вес 5", p5), ("вес 99", p1)), (ROLE["model"], ROLE["tree"], ROLE["test"])):
    ax.plot(share, np.cumsum(y_te[np.argsort(-p)]) / y_te.sum(), color=c, lw=2, label=name)
ax.plot([0, 1], [0, 1], color=ROLE["truth"], ls="--", lw=1.5, label="случайный выбор")
ax.axvline(0.02, color=ROLE["data"], lw=1)
ax.set(xlabel="доля обзвоненных клиентов (сверху списка)", ylabel="доля найденных откликов",
       title="Кривая охвата: веса почти не меняют порядок")
ax.legend()
ex.finish(fig, "17_gains")

# %% Этап 5. Пересчёт вероятностей
ex.stage(5, "Вернуть вероятностям смысл: пересчёт p' = p / (p + w(1 − p)) для модели с весом w = 99")
pc = p1 / (p1 + 99.0 * (1 - p1))
report("вес 99, пересчёт", m1, pc)
ex.note("""Пересчёт возвращает вероятности к правильному масштабу (средний прогноз снова близок к доле откликов, а не к 0.28),
порядок при этом не меняется. Точным он был бы для модели, дошедшей до оптимума взвешенной потери; ранняя остановка
и сжатие оставляют погрешность, поэтому надёжнее калибровать на валидации (пример 28).
Практическое правило: при редком классе веса не обязательны — обучайте без них, а порог выбирайте по бюджету.""")
ex.done()
