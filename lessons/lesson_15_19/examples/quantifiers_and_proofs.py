"""Кванторы, доказательства и контрпримеры.

Запуск:  python lessons/lesson_15_19/examples/quantifiers_and_proofs.py [--save] [--no-show]

1) Кванторы как all/any: порядок кванторов, ограниченные кванторы и пустая область.
2) Игра ε–N: наименьший номер N для разных ε.
3) Монотонность модели из «ступенек»: точная проверка по интервалам против случайного теста.
4) Доказательства: разбор остатков, числа Евклида, индукция L = I + 1 на деревьях sklearn.
5) Контрпримеры: Эйлер, Ферма, гипотеза Гольдбаха о нечётных числах (рисунок).
"""

import sys
from math import prod
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.tree import DecisionTreeRegressor

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, RED

ex = Example(__file__)

# 1. Кванторы
D = range(10)
P = lambda x, y: x + y == 9
ae, ea = all(any(P(x, y) for y in D) for x in D), any(all(P(x, y) for x in D) for y in D)
print("1) x + y = 9:  ∀x ∃y —", ae, "  ∃y ∀x —", ea)
assert ae and not ea
print("   y > x на {0..9}: ∀x ∃y —", all(any(y > x for y in D) for x in D), "(для x = 9 большего y нет)")
leaves = [(62, 0.31), (41, -0.12), (35, 0.45), (18, 0.08), (12, -0.37), (7, 0.62), (4, 0.15), (2, -0.8)]
for k in (30, 63):
    Dk = [v for n, v in leaves if n >= k]
    right = all(v > 0 for v in Dk)
    wrong_and = all(n >= k and v > 0 for n, v in leaves)
    wrong_imp = any((not n >= k) or v > 0.5 for n, v in leaves)
    print(f"   k = {k}: |D| = {len(Dk)}; ∀x∈D v > 0: {right}; ошибочные записи: ∀(D ∧ P) = {wrong_and}, ∃(D → P) = {wrong_imp}")
assert all([]) and not any([])

# 2. ε–N
for name, a_n, a in [("1/n", lambda n: 1 / n, 0), ("n/(n+1)", lambda n: n / (n + 1), 1)]:
    Ns = {eps: max([n for n in range(1, 5001) if not abs(a_n(n) - a) < eps], default=0) for eps in (0.1, 0.01, 0.001)}
    print(f"\n2) {name}: наименьшее N для ε:", Ns)
assert max(n for n in range(1, 5001) if not abs(1 / n) < 0.1) == 10

# 3. Монотонность
w = 0.1
steps = [(1, 0.2), (2.5, 0.3), (4, -0.08), (4 + w, 0.08), (6, 0.25), (8, 0.2)]
f = lambda x: sum(h for t, h in steps if x > t)
edges = [0] + [t for t, _ in steps] + [10]
vals = [f((a_ + b_) / 2) for a_, b_ in zip(edges, edges[1:])]
exact = all(a_ <= b_ + 1e-12 for a_, b_ in zip(vals, vals[1:]))
print("\n3) точная проверка по", len(vals), "интервалам — монотонна:", exact)
for m in (20, 200):
    hits = 0
    for seed in range(2000):
        r = Mulberry32(seed)
        pts = sorted(r.uniform(0, 10) for _ in range(m))
        hits += any(f(p) > f(q) + 1e-12 for i, p in enumerate(pts) for q in pts[i + 1:])
    formula = 1 - (1 - w / 10) ** m - 0.85**m + (0.85 - w / 10) ** m
    print(f"   {m} случайных точек: нашёл нарушение в {hits / 2000:.1%} тестов (формула {formula:.1%})")
    assert abs(hits / 2000 - formula) < 0.03
assert not exact

# 4. Доказательства
assert all((r**3 - r) % 6 == 0 for r in range(6)) and all((r * r - 1) % 8 == 0 for r in range(1, 8, 2))
assert any((r * r - 1) % 8 for r in range(8))
print("\n4) n³ − n делится на 6 — доказано разбором 6 остатков; n² − 1 делится на 8 — только для нечётных")


def factor(n):
    out, d = [], 2
    while d * d <= n:
        while n % d == 0:
            out.append(d)
            n //= d
        d += 1
    return out + ([n] if n > 1 else [])


primes = [2, 3, 5, 7, 11, 13, 17, 19, 23]
for k in range(1, 10):
    N = prod(primes[:k]) + 1
    assert not set(factor(N)) & set(primes[:k])
print("   числа Евклида: делители всегда новые; k = 6:", prod(primes[:6]) + 1, "=", factor(prod(primes[:6]) + 1))
r = Mulberry32(0)
X = np.array([[r.random() for _ in range(3)] for _ in range(300)])
y = np.array([r.random() for _ in range(300)])
for d in range(1, 8):
    t = DecisionTreeRegressor(max_depth=d, random_state=0).fit(X, y).tree_
    assert t.n_leaves == t.node_count - t.n_leaves + 1 and t.n_leaves <= 2**d
print("   L = I + 1 и L ≤ 2^d выполняются для деревьев sklearn глубины 1…7")


# 5. Контрпримеры
def is_prime(n):
    return n > 1 and all(n % d for d in range(2, int(n**0.5) + 1))


euler = next(n for n in range(100) if not is_prime(n * n + n + 41))
fermat = next(n for n in range(6) if not is_prime(2 ** (2**n) + 1))
print(f"\n5) n² + n + 41 ломается при n = {euler}; 2^(2^n) + 1 — при n = {fermat}: {2 ** 32 + 1} = {factor(2 ** 32 + 1)}")
assert euler == 40 and fermat == 5
odd = np.arange(3, 6001, 2)
reps = np.array([sum(is_prime(n - 2 * k * k) for k in range(1, int((n / 2) ** 0.5) + 1)) for n in odd])
comp = np.array([not is_prime(n) for n in odd])
bad = odd[comp & (reps == 0)]
print("   нечётные составные без представления p + 2k²:", bad.tolist())
assert bad.tolist() == [5777, 5993]

fig, ax = plt.subplots(figsize=(10, 4.4))
ax.scatter(odd[comp], reps[comp], s=4, color=BLUE, label="нечётные составные n")
ax.scatter(bad, [0, 0], s=60, color=RED, zorder=3, label="контрпримеры 5777 и 5993")
ax.set(xlabel="n", ylabel="способов записать n = p + 2k²", title="Гипотеза Гольдбаха о нечётных числах держится до 5777")
ax.legend()
ex.finish(fig, "goldbach_odd")
