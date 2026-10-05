# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_11_1

# %% [markdown]
# # Урок 11.1. Карта гиперпараметров и стратегия настройки
#
# **Интерактивная версия:** `lessons/lesson_11_1/web/index.html`
#
# 1. Результаты анализа чувствительности (`examples/sensitivity.py`, ≈ 3 минуты).
# 2. Пошаговая стратегия на задаче Фридмана: выбор по валидации, контроль по тесту после каждого шага.

# %%
import itertools
import json
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import lightgbm as lgb
import numpy as np
import pandas as pd
from gbcourse import datasets

# %% [markdown]
# ## 1. Чувствительность

# %%
js = (ROOT / "lessons" / "lesson_11_1" / "web" / "results.js").read_text(encoding="utf-8")
S = json.loads(js[js.index(".sensitivity = ") + len(".sensitivity = "): js.rindex(";\n})")])
rows = []
for t in S["tasks"]:
    for p, v in t["params"].items():
        best = min(v["curve"], key=lambda c: c["score"])
        base = next(c for c in v["curve"] if c["value"] == S["base"][p])
        rows.append({"задача": t["name"].split(" (")[0], "параметр": p, "по умолчанию": base["score"], "лучшее": best["score"],
                     "при значении": best["value"], "улучшение": t["base"] - best["score"], "шум σ": base["std"]})
df = pd.DataFrame(rows)
df["больше шума"] = df["улучшение"] > df["шум σ"]
df.round(4)

# %% [markdown]
# ## 2. Пошаговая стратегия
#
# Каждый шаг выбирает параметры по валидации и фиксирует их для следующих шагов. Тест смотрим только для отчёта.

# %%
X, y = datasets.friedman1(n=4000, noise=1.0, seed=170)
perm = np.random.default_rng(0).permutation(len(y))
tr, va, te = perm[:2400], perm[2400:3200], perm[3200:]


def evaluate(params):
    kw = dict(params)
    if kw.get("subsample", 1.0) < 1:
        kw["subsample_freq"] = 1
    m = lgb.LGBMRegressor(n_estimators=10000, verbose=-1, random_state=0, **kw)
    m.fit(X[tr], y[tr], eval_X=(X[va],), eval_y=(y[va],), callbacks=[lgb.early_stopping(100, verbose=False)])
    val = np.sqrt(min(m.evals_result_["valid_0"]["l2"]))
    test = np.sqrt(np.mean((y[te] - m.predict(X[te])) ** 2))
    return val, test, m.best_iteration_


def step(current, grid):
    best = None
    for combo in itertools.product(*grid.values()):
        cand = {**current, **dict(zip(grid, combo))}
        val, test, trees = evaluate(cand)
        if best is None or val < best[0]:
            best = (val, test, trees, cand)
    return best


log = []
params = {"learning_rate": 0.1}
val, test, trees = evaluate(params)
log.append({"шаг": "0. по умолчанию, ν = 0.1", "параметры": "—", "валидация": val, "тест": test, "деревьев": trees})
steps = [
    ("1. сложность деревьев", {"num_leaves": [4, 8, 16, 31, 64, 128], "min_child_samples": [5, 20, 100]}),
    ("2. случайность", {"colsample_bytree": [0.5, 0.7, 1.0], "subsample": [0.5, 0.7, 1.0]}),
    ("3. штрафы", {"reg_lambda": [0.0, 1.0, 10.0, 100.0], "min_split_gain": [0.0, 0.1, 1.0]}),
    ("4. меньший темп", {"learning_rate": [0.02]}),
]
for name, grid in steps:
    val, test, trees, params = step(params, grid)
    log.append({"шаг": name, "параметры": ", ".join(f"{k}={params[k]}" for k in grid), "валидация": val, "тест": test, "деревьев": trees})
pd.DataFrame(log).round(4)

# %% [markdown]
# Главный выигрыш даёт шаг сложности деревьев (на тесте 1.254 → 1.147). Случайность и штрафы почти ничего не добавили
# (штрафы выбрались нулевыми), меньший темп дал небольшое улучшение. Уровни валидации и теста различаются — это разные
# выборки, одна может быть «легче» другой. Важно другое: направление улучшений на валидации подтвердилось на тесте.
#
# ## Упражнения
#
# 1. Пройдите стратегию на задаче «луны + 8 шумовых признаков». Какой шаг даёт больше всего?
# 2. Поменяйте шаги 1 и 2 местами. Изменится ли итог?
#
# Решения: `python lessons/lesson_11_1/exercises/solutions.py`.
