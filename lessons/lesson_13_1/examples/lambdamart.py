"""LambdaMART своими руками на дереве gbcourse и сравнение с LightGBM (lambdarank) и XGBoost (rank:ndcg).

Синтетические запросы: у каждого 10–30 документов, 5 признаков; скрытая полезность
u = x0 + 2·x1·x2 − 0.5·x3² + шум; оценки релевантности 0…4 — квантили u внутри запроса.
Метрика — NDCG@10 на отложенных запросах.

Запуск:  python lessons/lesson_13_1/examples/lambdamart.py [--save] [--no-show]
Импорт:  from lambdamart import make_queries, ndcg_at_k, LambdaMART
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import RegressionTree


def make_queries(n_queries: int, seed: int):
    """Возвращает X, rel (0…4), qid (номер запроса для каждой строки)."""
    r = np.random.default_rng(seed)
    X, rel, qid = [], [], []
    for q in range(n_queries):
        m = int(r.integers(10, 31))
        Xq = r.uniform(-1, 1, (m, 5))
        u = Xq[:, 0] + 2 * Xq[:, 1] * Xq[:, 2] - 0.5 * Xq[:, 3] ** 2 + r.normal(0, 0.5, m)
        ranks = np.argsort(np.argsort(u)) / (m - 1)          # 0 … 1 внутри запроса
        rel_q = np.minimum((ranks * 5).astype(int), 4)
        X.append(Xq)
        rel.append(rel_q)
        qid.append(np.full(m, q))
    return np.vstack(X), np.concatenate(rel), np.concatenate(qid)


def dcg(rel_sorted, k):
    rel_sorted = np.asarray(rel_sorted, dtype=float)[:k]
    return float(np.sum((2**rel_sorted - 1) / np.log2(np.arange(2, rel_sorted.size + 2))))


def ndcg_at_k(scores, rel, qid, k=10):
    """Среднее NDCG@k по запросам."""
    out = []
    for q in np.unique(qid):
        idx = qid == q
        ideal = dcg(np.sort(rel[idx])[::-1], k)
        if ideal == 0:
            continue
        out.append(dcg(rel[idx][np.argsort(-scores[idx], kind="stable")], k) / ideal)
    return float(np.mean(out))


def lambdas(scores, rel, qid, k=10, sigma=1.0, weight_ndcg=True):
    """Градиенты g и гессианы h LambdaRank: пары (i ≻ j) внутри запроса, вес |ΔNDCG| от перестановки i и j."""
    g = np.zeros(scores.size)
    h = np.zeros(scores.size)
    for q in np.unique(qid):
        idx = np.flatnonzero(qid == q)
        s, r_ = scores[idx], rel[idx]
        order = np.argsort(-s, kind="stable")
        pos = np.empty(idx.size, dtype=int)
        pos[order] = np.arange(idx.size)
        ideal = dcg(np.sort(r_)[::-1], k) or 1.0
        gain = 2.0**r_ - 1
        disc = np.where(pos < k, 1 / np.log2(pos + 2), 0.0)
        for i in range(idx.size):
            for j in range(idx.size):
                if r_[i] <= r_[j]:
                    continue
                delta = abs((gain[i] - gain[j]) * (disc[i] - disc[j])) / ideal if weight_ndcg else 1.0
                rho = 1 / (1 + np.exp(sigma * (s[i] - s[j])))   # вероятность «неправильного» порядка
                g[idx[i]] -= sigma * rho * delta
                g[idx[j]] += sigma * rho * delta
                hh = sigma * sigma * rho * (1 - rho) * delta
                h[idx[i]] += hh
                h[idx[j]] += hh
    return g, h


class LambdaMART:
    """Бустинг второго порядка по градиентам LambdaRank."""

    def __init__(self, n_estimators=100, learning_rate=0.1, max_depth=4, weight_ndcg=True):
        self.n_estimators, self.learning_rate, self.max_depth, self.weight_ndcg = n_estimators, learning_rate, max_depth, weight_ndcg

    def fit(self, X, rel, qid, eval_set=None):
        self.trees_ = []
        F = np.zeros(len(rel))
        Fe = None if eval_set is None else np.zeros(len(eval_set[1]))
        self.history_ = []
        for _ in range(self.n_estimators):
            g, h = lambdas(F, rel, qid, weight_ndcg=self.weight_ndcg)
            t = RegressionTree(max_depth=self.max_depth, reg_lambda=1.0, min_child_weight=1e-3).fit(X, g, h + 1e-6)
            F += self.learning_rate * t.predict(X)
            self.trees_.append(t)
            if eval_set is not None:
                Fe += self.learning_rate * t.predict(eval_set[0])
                self.history_.append(ndcg_at_k(Fe, eval_set[1], eval_set[2]))
        return self

    def predict(self, X):
        return self.learning_rate * np.sum([t.predict(X) for t in self.trees_], axis=0)


if __name__ == "__main__":
    import lightgbm as lgb
    import matplotlib.pyplot as plt
    import xgboost as xgb

    from gbcourse import GBRegressor
    from gbcourse.cli import Example

    ex = Example(__file__)
    X, rel, qid = make_queries(150, seed=200)
    Xt, relt, qidt = make_queries(150, seed=201)
    res = {"случайный порядок": ndcg_at_k(np.random.default_rng(0).random(len(relt)), relt, qidt)}
    res["регрессия на оценки (поточечно)"] = ndcg_at_k(GBRegressor(n_estimators=100, max_depth=4, learning_rate=0.1).fit(X, rel).predict(Xt), relt, qidt)
    ranknet = LambdaMART(n_estimators=100, weight_ndcg=False).fit(X, rel, qid)
    res["попарно, без веса ΔNDCG (RankNet)"] = ndcg_at_k(ranknet.predict(Xt), relt, qidt)
    ours = LambdaMART(n_estimators=100).fit(X, rel, qid, eval_set=(Xt, relt, qidt))
    res["LambdaMART своими руками"] = ndcg_at_k(ours.predict(Xt), relt, qidt)
    group = np.bincount(qid)
    lm = lgb.LGBMRanker(n_estimators=100, learning_rate=0.1, num_leaves=16, verbose=-1).fit(X, rel, group=group)
    res["LightGBM lambdarank"] = ndcg_at_k(lm.predict(Xt), relt, qidt)
    xr = xgb.XGBRanker(n_estimators=100, learning_rate=0.1, max_depth=4, objective="rank:ndcg").fit(X, rel, qid=qid)
    res["XGBoost rank:ndcg"] = ndcg_at_k(xr.predict(Xt), relt, qidt)
    for k, v in res.items():
        print(f"{k:34s} NDCG@10 = {v:.4f}")
    assert res["LambdaMART своими руками"] > res["случайный порядок"] + 0.2

    fig, ax = plt.subplots(figsize=(9, 3.8))
    names = list(res)
    ax.barh(names, [res[n] for n in names], color="#2a78d6")
    ax.set(xlabel="NDCG@10 на отложенных запросах", xlim=(min(res.values()) - 0.05, 1.0))
    ax.invert_yaxis()
    fig.tight_layout()
    ex.finish(fig, "lambdamart")
