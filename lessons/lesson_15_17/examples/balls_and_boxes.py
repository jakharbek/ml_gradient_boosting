"""Шары и ящики: звёзды и перегородки, числа Стирлинга и Белла, все 12 случаев перебором, неравновероятные исходы.

Запуск:  python lessons/lesson_15_17/examples/balls_and_boxes.py [--save] [--no-show]

1) Целые решения x₁ + … + xₙ = k: без ограничений, со сдвигом и с включениями-исключениями.
2) Разбиения множества: числа Стирлинга S(n, r) (сверка со scipy) и Белла; S(k, 2) = 2^(k−1) − 1.
3) Двенадцать задач о шарах и ящиках: формула против перебора для n ≤ 6, k ≤ 4.
4) Мультимножества неравновероятны: два кубика и бутстрэп из 4 (с моделированием Mulberry32).
"""

import math
import sys
from collections import Counter
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
from scipy.special import stirling2

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, ORANGE, RED

ex = Example(__file__)
comb, fact = math.comb, math.factorial


# 1. Целые решения
def count(n, k, lo=0, hi=None):
    hi = k if hi is None else hi
    return sum(1 for t in product(range(lo, hi + 1), repeat=n) if sum(t) == k)


def formula(n, k, lo=0, hi=None):
    K = k - n * lo
    if K < 0:
        return 0
    if hi is None:
        return comb(K + n - 1, n - 1)
    step = hi - lo + 1
    return sum((-1) ** j * comb(n, j) * comb(K - j * step + n - 1, n - 1) for j in range(n + 1) if K - j * step >= 0)


for args in [(3, 10), (3, 10, 1), (3, 10, 0, 4), (4, 12, 1, 5), (5, 9, 0, 3)]:
    assert count(*args) == formula(*args)
print("конфеты 3 детям: всего", formula(3, 10), ", каждому ≥ 1:", formula(3, 10, 1), ", никому > 4:", formula(3, 10, 0, 4))

# 2. Стирлинг и Белл
S = lambda n, k: int(stirling2(n, k, exact=True))
bell = [sum(S(n, k) for k in range(n + 1)) for n in range(11)]
print("числа Белла:", bell)
assert bell[10] == 115975 and all(S(k, 2) == 2 ** (k - 1) - 1 for k in range(2, 20))


def partitions_k(n, k):
    """Разбиения числа n ровно на k слагаемых."""
    if n == 0 and k == 0:
        return 1
    if n <= 0 or k <= 0:
        return 0
    return partitions_k(n - 1, k - 1) + partitions_k(n - k, k)


# 3. Двенадцать задач: формула против перебора
def brute(n, k, balls_same, boxes_same, rule):
    seen = set()
    for f in product(range(k), repeat=n):
        cnt = [f.count(j) for j in range(k)]
        if rule == "le1" and max(cnt) > 1 or rule == "ge1" and min(cnt) == 0:
            continue
        boxes = [cnt[j] if balls_same else tuple(i for i in range(n) if f[i] == j) for j in range(k)]
        seen.add(tuple(sorted(boxes)) if boxes_same else tuple(boxes))
    return len(seen)


F = {
    (False, False): (lambda n, k: k**n, lambda n, k: math.perm(k, n), lambda n, k: fact(k) * S(n, k)),
    (True, False): (lambda n, k: comb(n + k - 1, n), lambda n, k: comb(k, n), lambda n, k: comb(n - 1, k - 1)),
    (False, True): (lambda n, k: sum(S(n, j) for j in range(k + 1)), lambda n, k: int(n <= k), lambda n, k: S(n, k)),
    (True, True): (lambda n, k: sum(partitions_k(n, j) for j in range(k + 1)), lambda n, k: int(n <= k), lambda n, k: partitions_k(n, k)),
}
checked = 0
for (bs, xs), fs in F.items():
    for ri, rule in enumerate(("any", "le1", "ge1")):
        for n in range(1, 7):
            for k in range(1, 5):
                assert fs[ri](n, k) == brute(n, k, bs, xs, rule), (bs, xs, rule, n, k)
                checked += 1
print(f"двенадцать задач: {checked} проверок формул перебором — все совпали")
print("4 шара по 3 ящикам: разные/разные", brute(4, 3, False, False, "any"), ", одинаковые/разные ≥1", brute(4, 3, True, False, "ge1"), ", одинаковые/одинаковые", brute(4, 3, True, True, "any"))

# 4. Неравновероятные мультимножества
fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
for ax, (n, k, title) in zip(axes, ((6, 2, "Два кубика: 21 исход"), (4, 4, "Бутстрэп из 4: 35 исходов"))):
    exact = Counter(tuple(sorted(t)) for t in product(range(n), repeat=k))
    order = sorted(exact, key=lambda m: (-exact[m], m))
    rng = Mulberry32(1)
    sim = Counter(tuple(sorted(rng.randint(n) for _ in range(k))) for _ in range(5000))
    ax.bar(range(len(order)), [exact[m] / n**k for m in order], color=BLUE, label="точно")
    ax.plot(range(len(order)), [sim[m] / 5000 for m in order], "o", mfc="white", color=ORANGE, ms=4, label="5000 опытов")
    ax.axhline(1 / len(order), color=RED, ls="--", label=f"ошибочно «все равны» 1/{len(order)}")
    ax.set(title=title, xlabel="исход (по убыванию вероятности)", ylabel="вероятность", xticks=[])
    ax.legend(fontsize=8)
    print(f"{title}: от {min(exact.values())}/{n**k} до {max(exact.values())}/{n**k}")
print("бутстрэп из 10 без повторов:", fact(10) / 10**10)
fig.tight_layout()
ex.finish(fig, "balls_and_boxes")
