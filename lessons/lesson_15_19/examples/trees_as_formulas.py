"""Дерево решений как логическая формула: правила, ДНФ, минимальные и жадные деревья.

Запуск:  python lessons/lesson_15_19/examples/trees_as_formulas.py [--save] [--no-show]

1) Дерево gbcourse на данных виджета «tree-rules»: правила листьев, их взаимоисключение и ДНФ класса 1;
   сверка порогов со scikit-learn.
2) Минимальное дерево (перебор подкубов) против жадного (Джини) для функций урока.
3) Перебор всех 256 функций трёх переменных и случайной выборки функций четырёх переменных.
"""

import sys
from functools import lru_cache
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.tree import DecisionTreeRegressor

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, ORANGE
from gbcourse.tree import RegressionTree

ex = Example(__file__)

# 1. Правила дерева
rng = Mulberry32(23)
X, y = [], []
for _ in range(200):
    x1, x2 = rng.uniform(0, 10), rng.uniform(0, 10)
    c = int((x1 > 6 and x2 < 4) or (x1 < 3 and x2 > 6))
    if rng.random() < 0.05:
        c = 1 - c
    X.append([x1, x2])
    y.append(c)
X, y = np.array(X), np.array(y, float)
tree = RegressionTree(max_depth=3, min_samples_leaf=5).fit(X, -y, np.ones_like(y))


def rules(t, i=0, lo=(-np.inf, -np.inf), hi=(np.inf, np.inf)):
    nd = t.nodes[i]
    if nd.left < 0:
        yield lo, hi, nd.value, nd.n
        return
    f, thr = nd.feature, nd.threshold
    yield from rules(t, nd.left, lo, tuple(min(h, thr) if j == f else h for j, h in enumerate(hi)))
    yield from rules(t, nd.right, tuple(max(l_, thr) if j == f else l_ for j, l_ in enumerate(lo)), hi)


R = list(rules(tree))
inside = lambda x, lo, hi: all(lo[j] < x[j] <= hi[j] for j in range(2))
assert all(sum(inside(x, lo, hi) for lo, hi, _, _ in R) == 1 for x in X)
cond = lambda lo, hi: " ∧ ".join((f"{lo[j]:.2f} < x{j + 1} ≤ {hi[j]:.2f}" if np.isfinite(lo[j]) and np.isfinite(hi[j]) else
                                  f"x{j + 1} ≤ {hi[j]:.2f}" if np.isfinite(hi[j]) else f"x{j + 1} > {lo[j]:.2f}")
                                 for j in range(2) if np.isfinite(lo[j]) or np.isfinite(hi[j]))
print("1) правила дерева глубины 3 (каждый объект — ровно в одном листе):")
for lo, hi, v, n in R:
    print(f"   ЕСЛИ {cond(lo, hi):34s} ТО класс {int(v >= 0.5)}   (n = {n}, доля 1 = {v:.2f})")
print("   класс 1 ⇔", " ∨ ".join(f"({cond(lo, hi)})" for lo, hi, v, _ in R if v >= 0.5))
acc = ((tree.predict(X) >= 0.5) == y).mean()
sk = DecisionTreeRegressor(max_depth=3, min_samples_leaf=5).fit(X, y)
print(f"   листьев {len(R)}, точность {acc:.2f}; порог корня gbcourse {tree.nodes[0].threshold:.4f}, sklearn {sk.tree_.threshold[0]:.4f}")
assert len(R) == 7 and round(acc, 2) == 0.94 and abs(tree.nodes[0].threshold - sk.tree_.threshold[0]) < 1e-6   # sklearn хранит пороги во float32


# 2. Минимальное и жадное дерево
def table(f, n):
    return tuple(int(f(*r)) for r in product([0, 1], repeat=n))


def sizes(tbl, n):
    R_ = list(product([0, 1], repeat=n))

    def vals(cube):
        return [v for r, v in zip(R_, tbl) if all(c < 0 or c == x for c, x in zip(cube, r))]

    @lru_cache(None)
    def best(cube):
        v = vals(cube)
        if len(set(v)) == 1:
            return 1
        return min(best(cube[:j] + (0,) + cube[j + 1:]) + best(cube[:j] + (1,) + cube[j + 1:]) for j in range(n) if cube[j] < 0)

    gini = lambda v: 2 * np.mean(v) * (1 - np.mean(v))

    def greedy(cube):
        v = vals(cube)
        if len(set(v)) == 1:
            return 1
        gains = [(gini(v) - 0.5 * gini(vals(cube[:j] + (0,) + cube[j + 1:])) - 0.5 * gini(vals(cube[:j] + (1,) + cube[j + 1:])), -j)
                 for j in range(n) if cube[j] < 0]
        g, mj = max(gains)
        j = [-mj_ for g_, mj_ in gains if g_ > g - 1e-12][0]      # первая переменная среди равных
        return greedy(cube[:j] + (0,) + cube[j + 1:]) + greedy(cube[:j] + (1,) + cube[j + 1:])

    start = (-1,) * n
    return best(start), greedy(start)


tests = {"A ∧ B ∧ C": (lambda a, b, c: a & b & c, 3), "чётность трёх": (lambda a, b, c: a ^ b ^ c, 3),
         "большинство": (lambda a, b, c: a + b + c >= 2, 3), "селектор A ? B : C": (lambda a, b, c: b if a else c, 3),
         "(A ∧ B) ∨ (C ∧ D)": (lambda a, b, c, d: (a & b) | (c & d), 4)}
print("\n2) листьев: минимальное / жадное")
res = {}
for name, (f, n) in tests.items():
    res[name] = sizes(table(f, n), n)
    print(f"   {name:22s} {res[name][0]:2d} / {res[name][1]:2d}")
assert res["A ∧ B ∧ C"] == (4, 4) and res["чётность трёх"] == (8, 8) and res["селектор A ? B : C"] == (4, 6)

# 3. Все функции трёх переменных и выборка функций четырёх
all3 = [sizes(tuple((code >> (7 - i)) & 1 for i in range(8)), 3) for code in range(256)]
worse3 = sum(g > m for m, g in all3)
print(f"\n3) n = 3: жадное больше минимального у {worse3} из 256 функций ({worse3 / 256:.1%})")
assert worse3 == 42
r = Mulberry32(4)
sample4 = [sizes(tuple(r.randint(2) for _ in range(16)), 4) for _ in range(1500)]
worse4 = np.mean([g > m for m, g in sample4])
print(f"   n = 4 (1500 случайных функций): {worse4:.1%}; полный перебор 65 536 функций в уроке даёт 57.4 %")
assert abs(worse4 - 0.574) < 0.04

m4 = np.array([m for m, g in sample4])
g4 = np.array([g for m, g in sample4])
fig, ax = plt.subplots(figsize=(9, 4.4))
bins = np.arange(1, 18) - 0.5
ax.hist(m4, bins=bins, color=BLUE, alpha=0.75, label="минимальное дерево")
ax.hist(g4, bins=bins, color=ORANGE, alpha=0.55, label="жадное дерево (Джини)")
ax.set(xlabel="листьев", ylabel="функций", title="Случайные булевы функции 4 переменных: жадное дерево в среднем больше")
ax.legend()
ex.finish(fig, "min_vs_greedy_trees")
