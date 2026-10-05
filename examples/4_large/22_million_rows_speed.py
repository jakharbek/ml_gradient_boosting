"""22. Миллион строк: скорость обучения и прогноза, память, потоки.

Цель: научиться работать с большими данными — понимать, сколько стоит обучение и прогноз и что на это влияет.
Чему научитесь: сравнение XGBoost hist, LightGBM, sklearn HistGradientBoosting и CatBoost на 1 000 000 строк;
    экономия памяти через float32; скорость прогноза пакетами; зависимость времени от числа потоков и строк
Датасет: синтетика — 1 000 000 объектов × 20 признаков (задача Фридмана + 15 шумовых признаков), 160 МБ в float64.
Этапы: 1) данные и память  2) четыре библиотеки  3) прогноз  4) потоки  5) масштаб по строкам  6) выводы.
Попробуйте сами: 1) Сравните время обучения на float64 и float32. 2) Меняйте max_bin у LightGBM (63, 255, 1023) —
    как меняются время и RMSE? 3) Если есть видеокарта, запустите XGBoost с device="cuda" и сравните время.
Связанные уроки: 8.3 «Поиск разбиений», 9.4 «Сравнение», 13.3 «Эксплуатация».
Запуск: python examples/4_large/22_million_rows_speed.py [--save] [--no-show] [--quick] (полный режим ≈ 40 с)
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402

ex = Example(__file__, title="22. Миллион строк: скорость и память",
             goal="понять, сколько стоят обучение и прогноз на больших данных")

import os  # noqa: E402
import time  # noqa: E402

import catboost as cb  # noqa: E402
import lightgbm as lgb  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import xgboost as xgb  # noqa: E402
from gbcourse.style import ROLE  # noqa: E402
from sklearn.ensemble import HistGradientBoostingRegressor  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные и память")
n = ex.size(1_000_000, 100_000)
r = np.random.default_rng(22)
X = r.uniform(0, 1, (n, 20))
y = 10 * np.sin(np.pi * X[:, 0] * X[:, 1]) + 20 * (X[:, 2] - 0.5) ** 2 + 10 * X[:, 3] + 5 * X[:, 4] + r.normal(0, 1, n)
X32 = X.astype(np.float32)
print(f"   объектов {n:_}; признаков 20; float64 — {X.nbytes / 2**20:.0f} МБ, float32 — {X32.nbytes / 2**20:.0f} МБ".replace("_", " "))
ex.note("Гистограммные бустинги всё равно переводят признаки в номера корзин (1 байт), поэтому float32 не теряет точности.")
tr, te = slice(0, int(0.9 * n)), slice(int(0.9 * n), n)
rmse = lambda a, b: float(np.sqrt(np.mean((a - b) ** 2)))
threads = os.cpu_count()

# %% Этап 2. Четыре библиотеки
ex.stage(2, "Обучение: 300 деревьев, ~31 лист / глубина 6, темп 0.1, все ядра процессора")
print(f"   потоков: {threads}")
models = {
    "XGBoost hist": xgb.XGBRegressor(n_estimators=300, learning_rate=0.1, max_depth=6, tree_method="hist", n_jobs=threads),
    "LightGBM": lgb.LGBMRegressor(n_estimators=300, learning_rate=0.1, num_leaves=31, verbose=-1, n_jobs=threads),
    "sklearn HistGB": HistGradientBoostingRegressor(max_iter=300, learning_rate=0.1, max_leaf_nodes=31, early_stopping=False),
    "CatBoost": cb.CatBoostRegressor(iterations=300, learning_rate=0.1, depth=6, verbose=0, thread_count=threads, allow_writing_files=False),
}
fit_time = {}
for name, m in models.items():
    t = time.perf_counter()
    m.fit(X32[tr], y[tr])
    fit_time[name] = time.perf_counter() - t
    print(f"   {name:15s} обучение {fit_time[name]:6.2f} с; RMSE на тесте {rmse(y[te], m.predict(X32[te])):.3f} (шум σ = 1)")

# %% Этап 3. Прогноз
ex.stage(3, "Прогноз: один большой пакет против 1000 одиночных вызовов")
Xq = X32[te][:100_000]
print(f"   пакет: {len(Xq):_} объектов".replace("_", " "))
for name in ("XGBoost hist", "LightGBM"):
    m = models[name]
    t = time.perf_counter()
    m.predict(Xq)
    batch = time.perf_counter() - t
    t = time.perf_counter()
    for i in range(1000):
        m.predict(Xq[i:i + 1])
    single = (time.perf_counter() - t) / 1000
    print(f"   {name:13s} пакет: {len(Xq) / batch:_.0f} объектов/с ({batch / len(Xq) * 1e6:.2f} мкс на объект); "
          f"одиночный вызов: {single * 1e6:.0f} мкс".replace("_", " "))
ex.note("Одиночный вызов тратит почти всё время на накладные расходы Python — прогнозируйте пакетами.")

# %% Этап 4. Потоки
ex.stage(4, "LightGBM: время обучения от числа потоков")
base, speed = None, []
for k in sorted({1, 2, 4, 8, threads}):
    if k > threads:
        continue
    t = time.perf_counter()
    lgb.LGBMRegressor(n_estimators=100, learning_rate=0.1, num_leaves=31, verbose=-1, n_jobs=k).fit(X32[tr], y[tr])
    sec = time.perf_counter() - t
    base = base or sec
    print(f"   потоков {k:2d}: {sec:6.2f} с (ускорение ×{base / sec:.1f})")
    speed.append((k, base / sec))
ex.note("Рост ускорения замедляется: часть работы последовательна, а потоки делят память.")
fig, ax = plt.subplots(figsize=(7, 3.6))
ks = [k for k, _ in speed]
ax.plot(ks, ks, color=ROLE["truth"], ls="--", lw=1.5, label="идеальное ускорение")
ax.plot(ks, [s for _, s in speed], "o-", color=ROLE["model"], lw=2, ms=6, label="LightGBM, 100 деревьев")
ax.set(xlabel="число потоков", ylabel="ускорение, раз", title="Ускорение обучения от числа потоков")
ax.legend()
ex.finish(fig, "22_threads")

# %% Этап 5. Масштаб по строкам
ex.stage(5, "LightGBM: время обучения 100 деревьев от числа строк")
for m_ in (n // 100, n // 10, n):
    t = time.perf_counter()
    lgb.LGBMRegressor(n_estimators=100, learning_rate=0.1, num_leaves=31, verbose=-1, n_jobs=threads).fit(X32[:m_], y[:m_])
    print(f"   {m_:>9_} строк: {time.perf_counter() - t:6.2f} с".replace("_", " "))

# %% Этап 6. Выводы
ex.stage(6, "Выводы")
fastest = min(fit_time, key=fit_time.get)
print(f"   быстрее всего на этих данных обучился: {fastest} ({fit_time[fastest]:.2f} с)")
ex.barh(fit_time, best=fastest, name="22_fit_time", fmt="{:.1f} с",
        xlabel="время обучения 300 деревьев, с (меньше — лучше)", title=f"{n:_} строк × 20 признаков".replace("_", " "))
ex.note("""На миллионе числовых строк все четыре библиотеки обучают 300 деревьев за несколько секунд (здесь 2–7 с).
Время растёт медленнее числа строк: на малых данных доминируют накладные расходы, на больших — проход по данным.
Храните признаки в float32, прогнозируйте пакетами, используйте все ядра.""")
ex.done()
