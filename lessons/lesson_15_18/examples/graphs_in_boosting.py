"""Графы в бустинге: структура деревьев, графовые признаки без утечки, честное разбиение, граф взаимодействий.

Запуск:  python lessons/lesson_15_18/examples/graphs_in_boosting.py [--save] [--no-show]

1) Деревья LightGBM как графы: num_leaves = L ⇒ 2L − 1 узлов; глубина деревьев «по листьям».
2) Графовые признаки для поиска мошенников: свои, графовые, графовые с утечкой (среднее по 10 графам).
3) Случайное разбиение против разбиения по сообществам.
4) Граф взаимодействий признаков: совместное появление на путях против H-статистики Фридмана.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np

from gbcourse import GBClassifier, GBRegressor
from gbcourse.cli import Example
from gbcourse.datasets import friedman1
from gbcourse.metrics import roc_auc
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, GREEN, MUTED, ORANGE, RED

ex = Example(__file__)

# 1. Деревья LightGBM как графы
Xf, yf = friedman1(n=400, noise=1.0, seed=1)
for L in (7, 31):
    m = lgb.LGBMRegressor(n_estimators=3, num_leaves=L, min_child_samples=5, verbose=-1).fit(Xf, yf)
    td = m.booster_.trees_to_dataframe()
    per = td.groupby("tree_index").agg(nodes=("node_index", "size"), depth=("node_depth", "max"))
    print(f"LightGBM num_leaves = {L}: узлов {per.nodes.tolist()} (2L − 1 = {2 * L - 1}), глубина {per.depth.tolist()}")
    assert (per.nodes == 2 * L - 1).all()


# 2–3. Графовые признаки и разбиения
def fraud_graph(seed):
    rng = Mulberry32(seed)
    n = 400
    comm, fraud, x1, x2 = [], [], [], []
    for i in range(n):
        comm.append(rng.randint(6))
        fraud.append(1 if rng.random() < (0.6 if comm[i] < 2 else 0.04) else 0)
        x1.append(rng.normal(0.7 if fraud[i] else 0, 1))
        x2.append(rng.normal(0, 1))
    nb = [[] for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            if rng.random() < (0.08 if comm[i] == comm[j] else 0.003):
                nb[i].append(j)
                nb[j].append(i)
    perm = rng.permutation(n)
    train = [False] * n
    for i in perm[:240]:
        train[i] = True
    return dict(n=n, comm=comm, fraud=fraud, x1=x1, x2=x2, nb=nb, train=train)


def auc(G, train, cols, leak=False):
    F = []
    for i in range(G["n"]):
        tr = [j for j in G["nb"][i] if train[j]]
        ft = sum(G["fraud"][j] for j in tr)
        if leak:
            fa = sum(G["fraud"][j] for j in G["nb"][i])
            F.append([G["x1"][i], G["x2"][i], len(G["nb"][i]), len(tr), fa, fa / max(1, len(G["nb"][i]))])
        else:
            F.append([G["x1"][i], G["x2"][i], len(G["nb"][i]), len(tr), ft, ft / max(1, len(tr))])
    tri = [i for i in range(G["n"]) if train[i]]
    te = [i for i in range(G["n"]) if not train[i]]
    m = GBClassifier(n_estimators=60, learning_rate=0.05, max_depth=2, min_samples_leaf=10)
    m.fit([[F[i][c] for c in cols] for i in tri], [G["fraud"][i] for i in tri])
    return roc_auc([G["fraud"][i] for i in te], m.predict_proba([[F[i][c] for c in cols] for i in te])[:, 1])


OWN, ALL = [0, 1], list(range(6))
res = []
for seed in range(7, 17):
    G = fraud_graph(seed)
    ct = [c in (0, 2, 3) for c in G["comm"]]
    res.append([auc(G, G["train"], OWN), auc(G, G["train"], ALL), auc(G, G["train"], ALL, leak=True), auc(G, ct, OWN), auc(G, ct, ALL)])
res = np.array(res)
labels = ["случайное: свои", "случайное: + графовые", "случайное: утечка", "сообщества: свои", "сообщества: + графовые"]
print("\nСредний ROC AUC по 10 графам:")
for name, v in zip(labels, res.mean(0)):
    print(f"  {name:24} {v:.3f}")
assert res[:, 1].mean() - res[:, 0].mean() > 0.1
assert res[:, 2].mean() > res[:, 1].mean()
assert res[:, 4].mean() - res[:, 3].mean() < 0.05


# 4. Взаимодействия
def path_pairs(model, d):
    S = np.zeros((d, d))

    def walk(nodes, i, anc):
        nd = nodes[i]
        if nd.left < 0:
            return
        for f in anc:
            if f != nd.feature:
                S[f, nd.feature] += nd.gain
                S[nd.feature, f] += nd.gain
        walk(nodes, nd.left, anc + [nd.feature])
        walk(nodes, nd.right, anc + [nd.feature])

    for stage in model.trees_:
        for t in stage:
            walk(t.nodes, 0, [])
    return S / max(S.sum() / 2, 1e-12)


def h_stat(model, X):
    bg, pts = X[:60], X[200:225]
    fp = model.predict(pts)
    var = ((fp - fp.mean()) ** 2).sum()

    def pd(cols):
        o = []
        for p in pts:
            Z = bg.copy()
            Z[:, cols] = p[cols]
            o.append(model.predict(Z).mean())
        o = np.array(o)
        return o - o.mean()

    single = [pd([j]) for j in range(X.shape[1])]
    Hm = np.zeros((X.shape[1],) * 2)
    for a in range(X.shape[1]):
        for b in range(a + 1, X.shape[1]):
            Hm[a, b] = Hm[b, a] = ((pd([a, b]) - single[a] - single[b]) ** 2).sum() / var
    return Hm


m3 = GBRegressor(n_estimators=80, learning_rate=0.1, max_depth=3, min_samples_leaf=5).fit(Xf, yf)
S, Hm = path_pairs(m3, 10), h_stat(m3, Xf)
pairs = [(a, b) for a in range(10) for b in range(a + 1, 10)]
topS = sorted(pairs, key=lambda p: -S[p])[:5]
topH = sorted(pairs, key=lambda p: -Hm[p])[:5]
fmt = lambda p: f"x{p[0] + 1}–x{p[1] + 1}"
print("\nВзаимодействия (глубина 3):")
print("  вместе на пути:", [(fmt(p), round(S[p], 3)) for p in topS])
print("  H²:            ", [(fmt(p), round(Hm[p], 4)) for p in topH])
assert topS[0] != (0, 1) and topH[0] == (0, 1)

fig, axes = plt.subplots(1, 2, figsize=(13, 4))
axes[0].bar(range(5), res.mean(0), color=[BLUE, GREEN, RED, BLUE, GREEN])
axes[0].set_xticks(range(5), ["случ.:\nсвои", "случ.:\n+ граф", "случ.:\nутечка", "сообщ.:\nсвои", "сообщ.:\n+ граф"])
axes[0].axhline(0.5, color=MUTED, ls=":")
axes[0].set_ylim(0.4, 0.9)
axes[0].set_ylabel("ROC AUC, среднее по 10 графам")
axes[0].set_title("Прирост, утечка и честное разбиение", fontsize=11)
x = np.arange(5)
axes[1].bar(x - 0.2, [S[p] / S[topS[0]] for p in topS], 0.4, color=MUTED, label="вместе на пути (норм.)")
axes[1].bar(x + 0.2, [Hm[p] / Hm[topH[0]] for p in topS], 0.4, color=ORANGE, label="H² (норм.)")
axes[1].set_xticks(x, [fmt(p) for p in topS])
axes[1].legend()
axes[1].set_title("Пути деревьев против H-статистики", fontsize=11)
ex.finish(fig, "graphs_in_boosting")
