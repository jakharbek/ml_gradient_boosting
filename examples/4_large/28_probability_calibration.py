"""28. Калибровка вероятностей: когда «70%» действительно означает 70%.

Цель: проверить и исправить вероятности классификатора, если по ним принимают денежные решения.
Чему научитесь: диаграмма надёжности (reliability diagram); ожидаемая ошибка калибровки (ECE), Брайер и log-loss;
    почему калибровка ломается: веса классов и переобучение; Платт (сигмоида) и изотоническая регрессия на отдельной
    выборке через `CalibratedClassifierCV(FrozenEstimator(model))`
Датасет: _data.make_customers — 60 000 клиентов, отклик 5%.
Этапы: 1) данные  2) три модели  3) метрики калибровки  4) исправление  5) диаграмма  6) выводы.
Попробуйте сами: 1) Сравните Платта и изотоническую калибровку при калибровочной выборке 1000 объектов. 2)
    Посчитайте ECE с 20 корзинами — как меняются числа? 3) Откалибруйте модель с ранней остановкой по log-loss —
    нужна ли ей калибровка?
Связанные уроки: 13.2 «Калибровка и интервалы».
Запуск: python examples/4_large/28_probability_calibration.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_customers  # noqa: E402

ex = Example(__file__, title="28. Калибровка вероятностей",
             goal="проверить и исправить вероятности классификатора")

import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402
from sklearn.calibration import CalibratedClassifierCV, calibration_curve  # noqa: E402
from sklearn.frozen import FrozenEstimator  # noqa: E402
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score  # noqa: E402
from sklearn.model_selection import train_test_split  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные: обучение 50%, калибровка 25%, тест 25%")
X, y = make_customers(ex.size(60_000, 20_000), positive_rate=0.05, seed=28)
ex.describe(X, y, target="отклик", task="classification", source="examples/_data.py → make_customers")
X_tr, X_rest, y_tr, y_rest = train_test_split(X, y, test_size=0.5, stratify=y, random_state=0)
X_cal, X_te, y_cal, y_te = train_test_split(X_rest, y_rest, test_size=0.5, stratify=y_rest, random_state=0)


def ece(y_true, p, bins=10):
    """Ожидаемая ошибка калибровки: средний |доля класса 1 − средняя вероятность| по корзинам равного размера."""
    order = np.argsort(p)
    return float(sum(len(b) / len(p) * abs(y_true[b].mean() - p[b].mean()) for b in np.array_split(order, bins)))


# %% Этап 2. Три модели
ex.stage(2, "Три модели: разумная, с весами классов и переобученная")
models = {
    "разумная (300 деревьев, ν=0.05)": lgb.LGBMClassifier(n_estimators=300, learning_rate=0.05, num_leaves=15,
                                                          min_child_samples=100, verbose=-1, random_state=0),
    "с весами классов (balanced)": lgb.LGBMClassifier(n_estimators=300, learning_rate=0.05, num_leaves=15,
                                                      min_child_samples=100, class_weight="balanced", verbose=-1, random_state=0),
    "переобученная (2000 глубоких)": lgb.LGBMClassifier(n_estimators=2000, learning_rate=0.1, num_leaves=127,
                                                        min_child_samples=5, verbose=-1, random_state=0),
}
for m in models.values():
    m.fit(X_tr, y_tr)

# %% Этап 3. Метрики
ex.stage(3, "Качество ранжирования и калибровки на тесте")
print(f"   {'модель':32s} {'AUC':>6s} {'Брайер':>8s} {'log-loss':>9s} {'ECE':>7s} {'ср. p':>7s}")
print(f"   {'(доля откликов на тесте)':32s} {'':6s} {'':8s} {'':9s} {'':7s} {y_te.mean():7.4f}")
for name, m in models.items():
    p = m.predict_proba(X_te)[:, 1]
    print(f"   {name:32s} {roc_auc_score(y_te, p):6.4f} {brier_score_loss(y_te, p):8.5f} {log_loss(y_te, p):9.4f} "
          f"{ece(y_te, p):7.4f} {p.mean():7.4f}")
ex.note("""Веса классов раздувают вероятности (средняя 0.33 при доле откликов 0.05). Переобученная модель слишком уверена:
почти всем даёт вероятность около нуля, а на редких ошибках log-loss взлетает. Разумная модель откалибрована и без
исправлений — бустинг с log-loss и ранней остановкой обычно калиброван неплохо.""")

# %% Этап 4. Исправление
ex.stage(4, "Калибровка на отдельной выборке: Платт (sigmoid) и изотоническая")
curves = {}
for name, m in models.items():
    row = []
    for method in ("sigmoid", "isotonic"):
        cal = CalibratedClassifierCV(FrozenEstimator(m), method=method).fit(X_cal, y_cal)
        p = cal.predict_proba(X_te)[:, 1]
        row.append((method, ece(y_te, p), log_loss(y_te, p), roc_auc_score(y_te, p)))
        if method == "isotonic":
            curves[name] = p
    print(f"   {name:32s} " + "   ".join(f"{mt}: ECE {e:.4f}, log-loss {ll:.4f}, AUC {a:.4f}" for mt, e, ll, a in row))
ex.note("""Калибровка монотонна и почти не меняет AUC (изотоническая даёт ступеньки, отсюда мелкие изменения),
но возвращает вероятностям смысл. Калибровочную выборку нельзя использовать при обучении модели.""")

# %% Этап 5. Диаграмма
ex.stage(5, "Диаграмма надёжности: средняя вероятность в корзине против доли откликов")
fig, axes = plt.subplots(1, 2, figsize=(10, 4.2), sharey=True)
colors = [ROLE["model"], ROLE["tree"], ROLE["test"]]
for ax, title, source in ((axes[0], "до калибровки", None), (axes[1], "после изотонической", curves)):
    for (name, m), c in zip(models.items(), colors):
        p = m.predict_proba(X_te)[:, 1] if source is None else source[name]
        frac, mean_p = calibration_curve(y_te, p, n_bins=10, strategy="quantile")
        ax.plot(mean_p, frac, "o-", color=c, lw=2, ms=5, label=name)
    lim = 0.45
    ax.plot([0, lim], [0, lim], color=ROLE["truth"], ls="--", lw=1.5, label="идеальная калибровка")
    ax.set(xlim=(0, lim), ylim=(0, lim), title=title, xlabel="средняя предсказанная вероятность")
axes[0].set_ylabel("доля откликов")
axes[0].legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "28_reliability")

# %% Этап 6. Выводы
ex.stage(6, "Выводы")
ex.note("""Хорошая AUC не означает хороших вероятностей. Если вероятности идут в расчёт денег (ожидаемая выручка,
резервы, ставки) — проверяйте ECE и диаграмму надёжности и калибруйте на отдельной выборке.""")
ex.done()
