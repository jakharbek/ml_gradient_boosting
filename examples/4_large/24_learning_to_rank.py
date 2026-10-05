"""24. Ранжирование поисковой выдачи: 5000 запросов, ~150 000 пар «запрос — документ».

Цель: обучить бустинг упорядочивать документы внутри запроса, а не предсказывать числа.
Чему научитесь: данные с группами (`qid`); разбиение по запросам; метрика NDCG@k; три подхода: поточечный (регрессия
    оценки), попарный (`rank:pairwise`) и списочный (LambdaMART: `rank:ndcg`, `lambdarank`); `XGBRanker` и
    `LGBMRanker`; почему ранжирующая модель выдаёт не вероятности, а баллы
Датасет: _data.make_search — 5000 запросов по 10–50 документов, 12 признаков (сходство текста, популярность,
    свежесть …), оценка релевантности 0–4 (3% документов — «отлично»).
Этапы: 1) данные  2) разбиение по запросам  3) метрика NDCG  4) три подхода  5) разбор одного запроса  6) выводы.
Попробуйте сами: 1) Считайте NDCG@3 вместо NDCG@10 — растёт ли разрыв между подходами? 2) Для поточечной модели
    вычтите из оценок среднее по запросу — изменится ли качество? 3) Поменяйте lambdarank_truncation_level у
    LightGBM и сравните NDCG.
Связанные уроки: 13.1 «Ранжирование: LambdaMART».
Запуск: python examples/4_large/24_learning_to_rank.py [--save] [--no-show] [--quick]
"""

# %% Подключение
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from _common import Example  # noqa: E402
from _data import make_search  # noqa: E402

ex = Example(__file__, title="24. Ранжирование поисковой выдачи",
             goal="обучить бустинг упорядочивать документы внутри запроса")

import lightgbm as lgb  # noqa: E402
import numpy as np  # noqa: E402
import xgboost as xgb  # noqa: E402
from sklearn.metrics import ndcg_score  # noqa: E402

# %% Этап 1. Данные
ex.stage(1, "Данные")
X, rel, qid = make_search(ex.size(5000, 1500))
ex.describe(X, rel, names=[f"x{j}" for j in range(12)], target="релевантность", task="classification",
            source="examples/_data.py → make_search (строки упорядочены по запросу)")
sizes = np.bincount(qid)
print(f"   запросов {len(sizes)}; документов на запрос: от {sizes.min()} до {sizes.max()}, в среднем {sizes.mean():.1f}")

# %% Этап 2. Разбиение по запросам
ex.stage(2, "Разбиение по запросам: документы одного запроса не должны попасть в разные части")
queries = np.random.default_rng(0).permutation(len(sizes))
nq = len(sizes)
part = np.empty(nq, int)
part[queries[: int(0.7 * nq)]], part[queries[int(0.7 * nq): int(0.85 * nq)]], part[queries[int(0.85 * nq):]] = 0, 1, 2
row_part = part[qid]
sel = {k: np.flatnonzero(row_part == i) for i, k in enumerate(("tr", "va", "te"))}   # строки сохраняют порядок qid
group = {k: np.bincount(qid[idx])[np.unique(qid[idx])] for k, idx in sel.items()}
print("   запросов: " + ", ".join(f"{k} {len(v)}" for k, v in group.items()))
ex.note("Ранжировщикам нужны размеры групп в порядке следования строк: строки одного запроса идут подряд.")


# %% Этап 3. Метрика
ex.stage(3, "NDCG@10: насколько верх выдачи близок к идеальному порядку (1 — идеально)")
def ndcg_at(scores, idx, k=10):
    vals = []
    for q in np.unique(qid[idx]):
        rows = idx[qid[idx] == q]
        if rel[rows].max() == 0:
            continue
        vals.append(ndcg_score([rel[rows]], [scores[np.searchsorted(idx, rows)]], k=k))
    return float(np.mean(vals))


te_idx = sel["te"]
rng = np.random.default_rng(1)
print(f"   случайный порядок {ndcg_at(rng.random(len(te_idx)), te_idx):.4f}; "
      f"по одному лучшему признаку x0 {ndcg_at(X[te_idx, 0], te_idx):.4f}")

# %% Этап 4. Три подхода
ex.stage(4, "Три подхода на одних признаках (ранняя остановка по валидации)")
common = dict(n_estimators=2000, learning_rate=0.05, max_depth=6, tree_method="hist", early_stopping_rounds=50)
results = {}
pointwise = xgb.XGBRegressor(**common).fit(X[sel["tr"]], rel[sel["tr"]], eval_set=[(X[sel["va"]], rel[sel["va"]])], verbose=False)
results["поточечный: регрессия оценки"] = pointwise.predict(X[te_idx])
for obj, name in (("rank:pairwise", "попарный: rank:pairwise"), ("rank:ndcg", "списочный: rank:ndcg (LambdaMART)")):
    rk = xgb.XGBRanker(objective=obj, eval_metric="ndcg@10", **common)
    rk.fit(X[sel["tr"]], rel[sel["tr"]], qid=qid[sel["tr"]], eval_set=[(X[sel["va"]], rel[sel["va"]])],
           eval_qid=[qid[sel["va"]]], verbose=False)
    results[name] = rk.predict(X[te_idx])
lr = lgb.LGBMRanker(n_estimators=2000, learning_rate=0.05, num_leaves=31, verbose=-1, random_state=0)
lr.fit(X[sel["tr"]], rel[sel["tr"]], group=group["tr"], eval_X=(X[sel["va"]],), eval_y=(rel[sel["va"]],),
       eval_group=[group["va"]], eval_at=[10], callbacks=[lgb.early_stopping(50, verbose=False)])
results["списочный: LightGBM lambdarank"] = lr.predict(X[te_idx])
ndcg = {"случайный порядок": ndcg_at(rng.random(len(te_idx)), te_idx), "один признак x0": ndcg_at(X[te_idx, 0], te_idx)}
for name, s in results.items():
    ndcg[name] = ndcg_at(s, te_idx)
    print(f"   {name:36s} NDCG@10 {ndcg[name]:.4f}")
ex.barh(ndcg, best=max(ndcg, key=ndcg.get), name="24_ndcg", fmt="{:.3f}",
        xlabel="NDCG@10 на тестовых запросах (больше — лучше)", title="Ранжирование: базы и три подхода")

# %% Этап 5. Один запрос
ex.stage(5, "Один запрос из теста: как модель переставила документы")
q = np.unique(qid[te_idx])[0]
rows = np.flatnonzero(qid[te_idx] == q)
s = results["списочный: LightGBM lambdarank"][rows]
order = np.argsort(-s)
print(f"   запрос {q}, документов {len(rows)}")
print(f"   исходный порядок, первые 10 оценок:   {rel[te_idx][rows][:10].tolist()}")
print(f"   после ранжирования, первые 10 оценок: {rel[te_idx][rows][order][:10].tolist()}")
print(f"   баллы модели у первых трёх: {np.round(s[order][:3], 2).tolist()} — это не вероятности, важен только порядок")

# %% Этап 6. Выводы
ex.stage(6, "Выводы")
ex.note("""Любой подход многократно лучше случайного порядка и лучше одного признака.
На этих данных все четыре подхода совпали с точностью до 0.001: признаки хорошо объясняют оценку, и точная
регрессия оценки сама даёт хороший порядок. Списочные цели выигрывают, когда шкалы оценок в запросах разные
или важны только первые позиции, — сравнивайте на своих данных.
Главное — корректные группы и разбиение по запросам.""")
ex.done()
