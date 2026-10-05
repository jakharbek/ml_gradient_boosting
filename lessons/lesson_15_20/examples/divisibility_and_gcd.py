"""Делимость и НОД: фолды и батчи, алгоритм Евклида, Безу, монеты Фробениуса, доля взаимно простых пар.

Запуск:  python lessons/lesson_15_20/examples/divisibility_and_gcd.py [--save] [--no-show]

1) Деление с остатком: размеры фолдов KFold и StratifiedKFold, батчи за эпоху, остаток отрицательных чисел.
2) Алгоритм Евклида: шаги, худший случай (Фибоначчи), карта числа шагов для пар до 100.
3) Расширенный алгоритм Евклида и линейные диофантовы уравнения; число Фробениуса.
4) Доля взаимно простых пар стремится к 6/π².
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from sklearn.model_selection import KFold, StratifiedKFold

from gbcourse.cli import Example
from gbcourse.style import BLUE, ORANGE

ex = Example(__file__)

# 1. Деление с остатком в ML
for n, k in ((23, 5), (1000, 7), (1000, 13)):
    q, r = divmod(n, k)
    sizes = [len(t) for _, t in KFold(k).split(np.zeros(n))]
    assert sizes == [q + 1] * r + [q] * (k - r)
    print(f"1) {n} = {q}·{k} + {r}: KFold {sizes}")
y = np.array([0] * 77 + [1] * 23)
pos = sorted(int(y[t].sum()) for _, t in StratifiedKFold(5).split(np.zeros(100), y))
assert pos == [4, 4, 5, 5, 5]
print("   StratifiedKFold: положительных в фолдах", pos, "(23 = 4·5 + 3)")
assert (1000 + 64 - 1) // 64 == 16 and 1000 % 64 == 40
assert divmod(-7, 3) == (-3, 2) and math.fmod(-7, 3) == -1.0
print("   батчей за эпоху при n = 1000, b = 64:", (1000 + 63) // 64, "; divmod(-7, 3) =", divmod(-7, 3))


# 2. Алгоритм Евклида
def steps(a: int, b: int) -> int:
    k = 0
    while b:
        a, b, k = b, a % b, k + 1
    return k


assert steps(252, 198) == 4 and steps(89, 55) == 9
S = np.array([[steps(a, b) for a in range(1, 101)] for b in range(1, 101)])
b_max, a_max = np.unravel_index(S.argmax(), S.shape)
assert S.max() == 10 and (a_max + 1, b_max + 1) == (55, 89)
print(f"2) НОД(252, 198) = {math.gcd(252, 198)} за 4 шага; максимум шагов до 100: {S.max()} у пары ({a_max + 1}, {b_max + 1}); в среднем {S.mean():.2f}")


# 3. Безу, диофантовы уравнения, Фробениус
def ext_gcd(a: int, b: int) -> tuple[int, int, int]:
    r0, r1, x0, x1, y0, y1 = a, b, 1, 0, 0, 1
    while r1:
        q = r0 // r1
        r0, r1, x0, x1, y0, y1 = r1, r0 - q * r1, x1, x0 - q * x1, y1, y0 - q * y1
    return r0, x0, y0


assert ext_gcd(252, 198) == (18, 4, -5) and pow(17, -1, 3120) == 2753
print("3) 252·4 + 198·(−5) = 18; обратный к 17 по модулю 3120:", pow(17, -1, 3120))
sols = [(x, (22 - 3 * x) // 5) for x in range(-10, 20) if (22 - 3 * x) % 5 == 0]
assert (4, 2) in sols and all(x2 - x1 == 5 for (x1, _), (x2, _) in zip(sols, sols[1:]))


def representable(limit: int, coins: list[int]) -> list[bool]:
    ok = [True] + [False] * limit
    for v in range(1, limit + 1):
        ok[v] = any(v >= c and ok[v - c] for c in coins)
    return ok


for coins, frob, count in (([3, 5], 7, 4), ([6, 9, 20], 43, 22), ([5, 8], 27, 14)):
    ok = representable(300, coins)
    bad = [v for v in range(301) if not ok[v]]
    assert max(bad) == frob and len(bad) == count
    print(f"   монеты {coins}: число Фробениуса {frob}, ненабираемых {count}")

# 4. Взаимная простота
Ns = [10, 20, 50, 100, 200, 500, 1000]
share = []
for N in Ns:
    a = np.arange(1, N + 1)
    G = np.gcd.outer(a, a)
    share.append(float((G == 1).mean()))
assert abs(share[-1] - 0.608383) < 1e-6
print("4) доля взаимно простых пар:", [round(s, 4) for s in share], " 6/π² =", round(6 / math.pi**2, 4))

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.3))
im = a1.imshow(S, origin="lower", extent=(0.5, 100.5, 0.5, 100.5), cmap="Blues")
fig.colorbar(im, ax=a1, label="шагов алгоритма Евклида")
a1.set(title="Шаги алгоритма Евклида для пар (a, b)", xlabel="a", ylabel="b")
a2.plot(Ns, share, "o-", color=BLUE, label="доля пар с НОД = 1")
a2.axhline(6 / math.pi**2, color=ORANGE, ls="--", label="6/π²")
a2.set_xscale("log")
a2.set(title="Взаимно простые пары в квадрате N × N", xlabel="N", ylabel="доля")
a2.legend()
ex.finish(fig, "divisibility_and_gcd")
