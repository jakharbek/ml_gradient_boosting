"""Решения упражнений урока 15.17 «Комбинаторика: искусство считать варианты».

Запуск:  python lessons/lesson_15_17/exercises/solutions.py
"""

import math
import sys
from collections import Counter
from itertools import combinations, combinations_with_replacement, permutations, product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from scipy.special import stirling2

from gbcourse.rng import Mulberry32

comb, perm, fact = math.comb, math.perm, math.factorial

# 1. Размер сетки
combos = 5 * 4 * 3 * 3 * 3
fits = combos * 5
print(f"1) комбинаций {combos}, обучений {fits}, время {fits * 3 / 3600:.2f} ч; случайный поиск: {60 * 5} обучений")
assert fits == 2700

# 2. Взаимодействия
pairs, triples = comb(50, 2), comb(50, 3)
print(f"2) пар {pairs}, троек {triples}, отношение {triples / pairs:.0f} = (50 − 2)/3: C(n, 3)/C(n, 2) = (n − 2)/3")
assert triples / pairs == 16

# 3. Номера и случаи
four = range(1000, 10000)
a = [x for x in four if len(set(str(x))) == 4]
b = [x for x in a if x % 5 == 0]
c = [x for x in four if "0" in str(x)]
fa = 9 * 9 * 8 * 7
fb = 9 * 8 * 7 + 8 * 8 * 7          # последняя 0: 9·8·7; последняя 5: первая — 8 вариантов (не 0 и не 5)
fc = 9000 - 9**4
print(f"3) (а) {len(a)} = 9·9·8·7 = {fa}; (б) {len(b)} = 9·8·7 + 8·8·7 = {fb}; (в) {len(c)} = 9000 − 9⁴ = {fc}")
assert (len(a), len(b), len(c)) == (fa, fb, fc)

# 4. Порядок и повторения
kinds = range(8)
ans = {
    "(а) 3 разных, без порядка": (comb(8, 3), len(list(combinations(kinds, 3)))),
    "(б) 3 с повторами, без порядка": (comb(10, 3), len(list(combinations_with_replacement(kinds, 3)))),
    "(в) 3 разных детям": (perm(8, 3), len(list(permutations(kinds, 3)))),
    "(г) по коробкам, любые": (8**3, len(list(product(kinds, repeat=3)))),
}
for k, (f, br) in ans.items():
    print(f"4) {k}: {f} (перебор {br})")
    assert f == br

# 5. Различные бутстрэп-выборки
for n in range(1, 8):
    cnt = Counter(tuple(sorted(seq)) for seq in product(range(n), repeat=n))
    assert len(cnt) == comb(2 * n - 1, n)
    if n == 5:
        print(f"5) n = 5: выборок {len(cnt)} = C(9, 5); самая частая (все разные) {max(cnt.values())}/{5**5} = {max(cnt.values()) / 5**5:.4f}, "
              f"самая редкая {min(cnt.values())}/{5**5}")
print("5) различных выборок для n = 1…7 совпало с C(2n − 1, n)")


# 6. Пути с препятствием
def paths(m, n, blocked=()):
    T = [[0] * (n + 1) for _ in range(m + 1)]
    for x in range(m + 1):
        for y in range(n + 1):
            if (x, y) not in blocked:
                T[x][y] = 1 if x == y == 0 else (T[x - 1][y] if x else 0) + (T[x][y - 1] if y else 0)
    return T[m][n]


total, through = comb(10, 4), comb(5, 2) * comb(5, 2)
avoid = total - comb(4, 2) * comb(6, 2)
print(f"6) путей {paths(6, 4)} = C(10, 4) = {total}; через (3, 2): {through}; в обход (2, 2): {paths(6, 4, {(2, 2)})} = {avoid}")
assert paths(6, 4) == total and paths(6, 4, {(2, 2)}) == avoid

# 7. Включения-исключения
A, B, C, AB, AC, BC, ABC = 120, 80, 60, 30, 20, 15, 5
union = A + B + C - AB - AC - BC + ABC
exactly_one = (A + B + C) - 2 * (AB + AC + BC) + 3 * ABC
# Проверка: строим конкретные множества с заданными размерами областей Венна
only = {"ABC": ABC, "AB": AB - ABC, "AC": AC - ABC, "BC": BC - ABC}
only["A"] = A - only["AB"] - only["AC"] - ABC
only["B"] = B - only["AB"] - only["BC"] - ABC
only["C"] = C - only["AC"] - only["BC"] - ABC
print(f"7) хотя бы один пропуск: {union} (по областям {sum(only.values())}); ровно один: {exactly_one} (по областям {only['A'] + only['B'] + only['C']})")
assert union == sum(only.values()) and exactly_one == only["A"] + only["B"] + only["C"]


# 8. Разбиения категорий
def set_partitions(items):
    if not items:
        yield []
        return
    first, rest = items[0], items[1:]
    for p in set_partitions(rest):
        yield [[first]] + p
        for i in range(len(p)):
            yield p[:i] + [[first] + p[i]] + p[i + 1:]


P = list(set_partitions(list(range(6))))
by = Counter(len(p) for p in P)
print(f"8) две группы {by[2]} = 2⁵ − 1; три группы {by[3]} = S(6, 3) = {int(stirling2(6, 3, exact=True))}; всего {len(P)} = B(6)")
assert by[2] == 31 and by[3] == 90 and len(P) == 203


def gain(ns, ms, left):
    nL = sum(ns[i] for i in left)
    nR = sum(ns) - nL
    sL = sum(ns[i] * ms[i] for i in left)
    sR = sum(n * m for n, m in zip(ns, ms)) - sL
    return nL * nR / (nL + nR) * (sL / nL - sR / nR) ** 2


ok = 0
for seed in range(200):
    r = Mulberry32(seed)
    ns = [5 + r.randint(26) for _ in range(6)]
    ms = [r.normal(0, 1) for _ in range(6)]
    best = max(gain(ns, ms, {0, *rest}) for k in range(5) for rest in combinations(range(1, 6), k))
    order = sorted(range(6), key=lambda i: ms[i])
    ok += math.isclose(best, max(gain(ns, ms, set(order[:i])) for i in range(1, 6)))
print(f"8) лучшее — префикс порядка по среднему в {ok} из 200 наборов")
assert ok == 200

# 9. Беспорядки
d = [1, 0]
for m in range(2, 11):
    d.append((m - 1) * (d[-1] + d[-2]))
for n in range(1, 8):
    assert d[n] == sum(all(p[i] != i for i in range(n)) for p in permutations(range(n)))
probs = [comb(10, j) * d[10 - j] / fact(10) for j in range(4)]
pois = [math.exp(-1) / fact(j) for j in range(4)]
print("9) !n:", d, "\n   P(j совпадений), n = 10:", [round(p, 5) for p in probs], " Пуассон(1):", [round(p, 5) for p in pois])
assert all(abs(p - q) < 1e-4 for p, q in zip(probs, pois))

# 10. Дни рождения и хеши
pd = lambda n, D=365: math.prod((D - i) / D for i in range(n))
n90 = next(n for n in range(1, 200) if 1 - pd(n) > 0.9)
n99 = next(n for n in range(1, 200) if 1 - pd(n) > 0.99)
apx = lambda n, D=365: 1 - math.exp(-n * (n - 1) / (2 * D))
print(f"10) P > 0.9 при n = {n90} ({1 - pd(n90):.4f}, приближение {apx(n90):.4f}); P > 0.99 при n = {n99} ({1 - pd(n99):.4f}, {apx(n99):.4f})")
D = 2**20
nmax = max(n for n in range(1, 5000) if 1 - pd(n, D) <= 0.01)
print(f"    2²⁰ корзин, коллизия ≤ 1 %: до {nmax} ключей (≈ √(2D·ln(1/0.99)) = {math.sqrt(2 * D * -math.log(0.99)):.0f})")
assert (n90, n99) == (41, 57)


# 11. Формы деревьев
def shapes(n):
    if n == 0:
        return [None]
    return [(L, R) for i in range(n) for L in shapes(i) for R in shapes(n - 1 - i)]


depth = lambda t: 0 if t is None else 1 + max(depth(t[0]), depth(t[1]))
for n in range(8):
    assert len(shapes(n)) == comb(2 * n, n) // (n + 1)
s7 = shapes(7)
print(f"11) Каталан {[len(shapes(n)) for n in range(8)]}; с 8 листьями: глубина ≤ 3 — {sum(depth(t) <= 3 for t in s7)}, глубина 7 — {sum(depth(t) == 7 for t in s7)} = 2⁶")
assert sum(depth(t) <= 3 for t in s7) == 1 and sum(depth(t) == 7 for t in s7) == 64

# 12. Шепли по случайным порядкам
w = [1, 2, 3, 4]
M = len(w)
v = lambda S: sum(w[i] for i in S) ** 2
orders = list(permutations(range(M)))
by_orders = np.zeros(M)
for o in orders:
    for pos, j in enumerate(o):
        by_orders[j] += (v(o[:pos + 1]) - v(o[:pos])) / len(orders)
by_formula = [sum(fact(len(S)) * fact(M - len(S) - 1) / fact(M) * (v(S + (j,)) - v(S))
                  for k in range(M) for S in combinations([i for i in range(M) if i != j], k)) for j in range(M)]
print("12) точно:", np.round(by_orders, 4), " формула:", np.round(by_formula, 4), " теория w_j·Σw =", [x * sum(w) for x in w])
assert np.allclose(by_orders, by_formula) and np.allclose(by_orders, [x * sum(w) for x in w])
errs = {}
for R in (10, 100, 1000):
    e = []
    for rep in range(30):
        r = Mulberry32(1000 * R + rep)
        acc = np.zeros(M)
        for _ in range(R):
            S, prev = [], 0
            for j in r.permutation(M):
                S.append(j)
                cur = v(S)
                acc[j] += cur - prev
                prev = cur
        e.append(np.mean(np.abs(acc / R - by_orders)))
    errs[R] = float(np.mean(e))
print("    средняя ошибка по 30 повторам:", {R: round(e, 3) for R, e in errs.items()}, " отношения:", round(errs[10] / errs[100], 2), round(errs[100] / errs[1000], 2), "(≈ √10 = 3.16)")
assert 2 < errs[10] / errs[100] < 5 and 2 < errs[100] / errs[1000] < 5
