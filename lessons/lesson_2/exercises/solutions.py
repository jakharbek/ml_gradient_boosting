"""Решения упражнений модуля 2.

Запуск:  python lessons/lesson_2/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import RegressionTree, datasets

X, y = datasets.regression_1d(kind="sine", n=60, noise=0.25, seed=3)
tree = RegressionTree(max_depth=2).fit(X, -y)

# 1
for x in (1.0, 8.5):
    nd = tree.nodes[0]
    while not nd.is_leaf:
        nd = tree.nodes[nd.left if x <= nd.threshold else nd.right]
    print(f"1) x = {x}: вручную {nd.value:.4f}, predict {tree.predict(np.array([[x]]))[0]:.4f}")

# 2
deep = RegressionTree(max_depth=6).fit(X, -y)
print(f"2) листьев: {deep.n_leaves} из 64 возможных — ветка перестаёт делиться, когда в ней один объект")
print("   или все значения признака одинаковы (min_samples_leaf=1, разбивать нечего).")

# 3
t3 = RegressionTree(max_depth=2).fit(X ** 3, -y)
same_groups = np.array_equal(tree.apply(X), t3.apply(X ** 3))
print(f"3) группы листьев совпадают: {same_groups}; прогнозы равны: {np.allclose(tree.predict(X), t3.predict(X ** 3))}")
print(f"   пороги: {tree.nodes[0].threshold:.3f} vs {t3.nodes[0].threshold:.3f} (= середина между кубами соседей,")
print("   не куб старого порога — поэтому на новых точках прогнозы могут чуть отличаться)")

# ---------------------------------------------------------------- восемь квартир (задачи 4–7)
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor  # noqa: E402

area = np.array([30, 35, 42, 50, 62, 70, 78, 90])
dist = np.array([12, 3, 9, 4, 10, 2, 8, 3])
price = np.array([3.0, 5.0, 3.6, 5.8, 7.0, 9.6, 7.8, 10.6])
F = np.c_[area, dist]


def sse(v):
    return float(((v - v.mean()) ** 2).sum()) if len(v) else 0.0


# 4
left, right = price[dist <= 6], price[dist > 6]
gain = sse(price) - sse(left) - sse(right)
print(f"4) слева {left.mean():.2f} (SSE {sse(left):.2f}), справа {right.mean():.2f} (SSE {sse(right):.2f}); "
      f"SSE после {sse(left) + sse(right):.2f}, выигрыш {gain:.2f} — против 38.72 у «площадь ≤ 56»")
assert np.isclose(gain, 11.52)

# 5
flat_tree = DecisionTreeRegressor(max_depth=2).fit(F, price)
p200, p70 = flat_tree.predict([[200, 1]])[0], flat_tree.predict([[70, 1]])[0]
print(f"5) 200 м²: {p200:.1f} млн, 70 м²: {p70:.1f} млн — одинаково: правее порога 56 все площади в одной ветке,")
print("   дерево не видело квартир больше 90 м² и не продолжает рост цены (нет экстраполяции).")
assert p200 == p70

# 6
cm_tree = DecisionTreeRegressor(max_depth=2).fit(np.c_[area * 10_000, dist], price)
same = np.allclose(cm_tree.predict(np.c_[area * 10_000, dist]), flat_tree.predict(F))
print(f"6) порог корня: {flat_tree.tree_.threshold[0]:g} м² → {cm_tree.tree_.threshold[0]:g} см²; "
      f"прогнозы совпали: {same}; группы в листьях те же: "
      f"{np.array_equal(cm_tree.apply(np.c_[area * 10_000, dist]), flat_tree.apply(F))}")

# 7
sold = np.array([0, 1, 0, 1, 0, 1, 1, 1])
gini = lambda v: 2 * v.mean() * (1 - v.mean()) if len(v) else 0.0  # noqa: E731
near, far = sold[dist <= 6.5], sold[dist > 6.5]
after = (len(near) * gini(near) + len(far) * gini(far)) / len(sold)
print(f"7) Джини в корне {gini(sold):.3f}; после «до центра ≤ 6.5»: слева {gini(near):.3f}, справа {gini(far):.3f}, "
      f"средневзвешенный {after:.3f}")
clf = DecisionTreeClassifier(max_depth=1, random_state=0).fit(F, sold)
print(f"   DecisionTreeClassifier выбирает: {['площадь', 'до центра'][clf.tree_.feature[0]]} ≤ {clf.tree_.threshold[0]:g}")
assert np.isclose(gini(sold), 0.46875) and np.isclose(after, 0.1875)


# 8
def best_split(Xm, ym, min_leaf):
    best = (0.0, None, None)
    for j in range(Xm.shape[1]):
        vals = np.unique(Xm[:, j])
        for t in (vals[:-1] + vals[1:]) / 2:
            m = Xm[:, j] <= t
            if m.sum() < min_leaf or (~m).sum() < min_leaf:
                continue
            g = sse(ym) - sse(ym[m]) - sse(ym[~m])
            if g > best[0] + 1e-12:
                best = (g, j, t)
    return best


def grow(Xm, ym, max_depth, min_samples_leaf=1, depth=0):
    g, j, t = best_split(Xm, ym, min_samples_leaf)
    if depth == max_depth or j is None:
        return {"value": float(ym.mean())}
    m = Xm[:, j] <= t
    return {"feature": j, "threshold": float(t),
            "left": grow(Xm[m], ym[m], max_depth, min_samples_leaf, depth + 1),
            "right": grow(Xm[~m], ym[~m], max_depth, min_samples_leaf, depth + 1)}


def predict_one(node, x):
    while "value" not in node:
        node = node["left"] if x[node["feature"]] <= node["threshold"] else node["right"]
    return node["value"]


mine = grow(X, y, max_depth=3, min_samples_leaf=2)
sk = DecisionTreeRegressor(max_depth=3, min_samples_leaf=2).fit(X, y)
diff = max(abs(predict_one(mine, x) - p) for x, p in zip(X, sk.predict(X)))
print(f"8) своя функция роста против scikit-learn: наибольшее расхождение прогнозов {diff:.1e}")
assert diff < 1e-12
