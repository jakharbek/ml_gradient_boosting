"""29. От данных до сервиса: конвейер, проверка, сохранение, функция прогноза и карточка модели.

Цель: собрать всё вместе так, как это делают в рабочем проекте, — чтобы модель можно было отдать в эксплуатацию.
Чему научитесь: sklearn `Pipeline`: признаки и модель одним объектом; кросс-валидация всего конвейера; финальное
    обучение; сохранение `joblib` и проверка после загрузки; функция прогноза для JSON-запросов со схемой и
    проверкой входа; неизвестные категории; карточка модели в JSON; замер задержки
Датасет: _data.make_customers — 80 000 клиентов, отклик 5%; последние 20% — отложенный тест.
Этапы: 1) данные  2) конвейер  3) кросс-валидация  4) финальная модель и тест  5) сохранение и загрузка
    6) функция прогноза  7) карточка модели  8) выводы.
Попробуйте сами: 1) Добавьте в конвейер отбор признаков и проверьте, изменилась ли CV. 2) Сохраните бустер LightGBM
    в текстовый формат и сделайте прогноз без sklearn. 3) Добавьте в predict_json проверку диапазонов (возраст
    18–100) с понятной ошибкой.
Связанные уроки: 13.3 «Эксплуатация», 14 «Итоговый проект».
Запуск: python examples/4_large/29_end_to_end_pipeline.py [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_customers  # noqa: E402

ex = Example(__file__, title="29. От данных до сервиса",
             goal="собрать конвейер, готовый к эксплуатации")

import datetime as dt  # noqa: E402
import hashlib  # noqa: E402
import json  # noqa: E402
import tempfile  # noqa: E402
import time  # noqa: E402

import joblib  # noqa: E402
import lightgbm as lgb  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import sklearn  # noqa: E402
from sklearn.metrics import average_precision_score, log_loss, roc_auc_score  # noqa: E402
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402
from sklearn.preprocessing import FunctionTransformer  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
X, y = make_customers(ex.size(80_000, 20_000), positive_rate=0.05, seed=29)
ex.describe(X, y, target="отклик", task="classification", source="examples/_data.py → make_customers")
X_dev, X_te, y_dev, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=0)
SCHEMA = {c: ("category", list(X[c].cat.categories)) if isinstance(X[c].dtype, pd.CategoricalDtype) else ("number", None)
          for c in X.columns}


# %% Этап 2. Конвейер
ex.stage(2, "Конвейер: производные признаки → LightGBM")
def add_features(df: pd.DataFrame) -> pd.DataFrame:
    """Производные признаки. Та же функция работает и при обучении, и при прогнозе — нет рассинхронизации."""
    out = df.copy()
    out["покупок_в_месяц"] = df["покупок"] / np.maximum(df["стаж_мес"], 1)
    out["доход_неизвестен"] = df["доход"].isna().astype(int)
    return out


PARAMS = dict(n_estimators=400, learning_rate=0.03, num_leaves=15, min_child_samples=100, subsample=0.8,
              subsample_freq=1, colsample_bytree=0.8, verbose=-1, random_state=0)
pipe = Pipeline([("features", FunctionTransformer(add_features)), ("model", lgb.LGBMClassifier(**PARAMS))])
print("   " + " → ".join(name for name, _ in pipe.steps))
ex.note("Число деревьев заранее подобрано ранней остановкой; внутри CV его не меняем, чтобы оценка была честной.")

# %% Этап 3. Кросс-валидация
ex.stage(3, "5-кратная стратифицированная CV всего конвейера")
with ex.timer("кросс-валидация"):
    cv = cross_validate(pipe, X_dev, y_dev, cv=StratifiedKFold(5, shuffle=True, random_state=0),
                        scoring={"auc": "roc_auc", "ap": "average_precision", "logloss": "neg_log_loss"})
cv_summary = {k: (float(np.mean(v)), float(np.std(v))) for k, v in
              (("roc_auc", cv["test_auc"]), ("average_precision", cv["test_ap"]), ("log_loss", -cv["test_logloss"]))}
for k, (m, s) in cv_summary.items():
    print(f"   {k:18s} {m:.4f} ± {s:.4f}")

# %% Этап 4. Финальная модель
ex.stage(4, "Финальное обучение на всех 80% и один взгляд на отложенный тест")
pipe.fit(X_dev, y_dev)
p_te = pipe.predict_proba(X_te)[:, 1]
test_metrics = {"roc_auc": roc_auc_score(y_te, p_te), "average_precision": average_precision_score(y_te, p_te),
                "log_loss": log_loss(y_te, p_te)}
print("   " + ", ".join(f"{k} {v:.4f}" for k, v in test_metrics.items()))
ex.note("""Тест чуть ниже среднего по CV (около двух стандартных отклонений по фолдам) — обычный разброс, когда в тесте
~800 положительных примеров. Порядок величин совпадает, серьёзной утечки или переобучения на CV нет.""")

# %% Этап 5. Сохранение
ex.stage(5, "Сохранение конвейера (joblib) и проверка после загрузки")
tmp = tempfile.TemporaryDirectory()                     # артефакты примера не засоряют диск
workdir = Path(tmp.name)
model_path = workdir / "customers_pipeline.joblib"
joblib.dump(pipe, model_path)
loaded = joblib.load(model_path)
same = np.array_equal(loaded.predict_proba(X_te)[:, 1], p_te)
digest = hashlib.sha256(model_path.read_bytes()).hexdigest()[:16]
print(f"   файл {model_path.stat().st_size / 1024:.0f} КБ, sha256 {digest}…; прогнозы совпадают побитово: {same}")
assert same
ex.note("""joblib хранит объект Python: загружать можно только той же версией библиотек (записываем их в карточку).
Для переноса между языками сохраняйте саму модель в формате библиотеки (txt/json/cbm) или ONNX.""")


# %% Этап 6. Функция прогноза
ex.stage(6, "Функция прогноза для JSON-запросов: схема, проверка, неизвестные категории")
class InputError(ValueError):
    """Ошибка входных данных — вернуть клиенту понятное сообщение, а не трассировку."""


def predict_json(records: list[dict], model=loaded) -> list[float]:
    missing = [c for c in SCHEMA if any(c not in r for r in records)]
    if missing:
        raise InputError(f"нет полей: {missing}")
    df = pd.DataFrame.from_records(records)[list(SCHEMA)]
    for col, (kind, cats) in SCHEMA.items():
        if kind == "category":
            known = df[col].where(df[col].isin(cats))           # неизвестное значение → явный пропуск
            df[col] = pd.Categorical(known, categories=cats)    # те же категории и порядок, что при обучении
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return model.predict_proba(df)[:, 1].round(5).tolist()


request = json.loads(X_te.iloc[:3].to_json(orient="records", force_ascii=False))
print(f"   запрос из 3 клиентов → {predict_json(request)} (напрямую: {p_te[:3].round(5).tolist()})")
assert np.allclose(predict_json(request), p_te[:3], atol=1e-5)
odd = dict(request[0], регион="неизвестный_регион", доход=None)
print(f"   неизвестный регион и пустой доход → {predict_json([odd])} (категория станет пропуском, модель это умеет)")
try:
    predict_json([{"возраст": 30}])
except InputError as e:
    print(f"   неполный запрос → InputError: {str(e)[:70]}…")
t = time.perf_counter()
for _ in range(200):
    predict_json(request[:1])
single_ms = (time.perf_counter() - t) / 200 * 1000
t = time.perf_counter()
predict_json(json.loads(X_te.iloc[:10_000].to_json(orient="records", force_ascii=False)))
batch_us = (time.perf_counter() - t) / 10_000 * 1e6
print(f"   задержка: один клиент {single_ms:.1f} мс; пакет 10 000 — {batch_us:.0f} мкс на клиента")

# %% Этап 7. Карточка модели
ex.stage(7, "Карточка модели: что это, на чём обучена, как проверена, чем ограничена")
card = {
    "name": "customers_response", "version": "1.0.0", "created": dt.date.today().isoformat(),
    "task": "бинарная классификация: отклик клиента на предложение",
    "data": {"source": "examples/_data.py → make_customers(seed=29)", "rows_train": int(len(y_dev)),
             "rows_test": int(len(y_te)), "positive_rate": round(float(y.mean()), 4)},
    "features": {c: k for c, (k, _) in SCHEMA.items()},
    "model": {"library": f"lightgbm {lgb.__version__}", "sklearn": sklearn.__version__, "params": PARAMS},
    "validation": {"cv_5fold": {k: [round(m, 4), round(s, 4)] for k, (m, s) in cv_summary.items()},
                   "holdout": {k: round(float(v), 4) for k, v in test_metrics.items()}},
    "artifact": {"file": model_path.name, "sha256_16": digest},
    "limitations": ["обучена на синтетических данных", "новые регионы трактуются как пропуск",
                    "вероятности не перекалиброваны — см. пример 28", "нужен мониторинг сдвига — см. пример 30"],
}
card_path = workdir / "model_card.json"
card_path.write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding="utf-8")
print("   " + "\n   ".join(card_path.read_text(encoding="utf-8").splitlines()[:14]) + "\n   …")

# %% Этап 8. Выводы
ex.stage(8, "Выводы")
ex.note("""Конвейер = один объект, в котором признаки и модель не могут разойтись. Проверка входа и схема категорий
защищают от тихих ошибок в эксплуатации. Карточка модели фиксирует данные, версии, метрики и ограничения.""")
print(f"   артефакты: {model_path.name}, {card_path.name} — во временной папке, которая сейчас будет удалена")
tmp.cleanup()
ex.done()
