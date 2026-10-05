"""Простые числа: решето, основная теорема арифметики, π(x) против x/ln x и Li(x), разрывы, Гольдбах, гонка простых.

Запуск:  python lessons/lesson_15_20/examples/primes_distribution.py [--save] [--no-show]

1) Решето Эратосфена до 10⁶ и разложение на множители; числа Евклида.
2) π(x), x/ln x и интегральный логарифм Li(x) (ряд Рамануджана — Гаусса).
3) Разрывы между простыми и многочлен Эйлера n² + n + 41.
4) Гипотезы: разложения Гольдбаха, близнецы, Коллатц; гонка 4k + 1 против 4k + 3.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, ORANGE

ex = Example(__file__)

N = 10**6
is_p = np.ones(N + 1, bool)
is_p[:2] = False
for p in range(2, math.isqrt(N) + 1):
    if is_p[p]:
        is_p[p * p :: p] = False
primes = np.nonzero(is_p)[0]
pi = np.cumsum(is_p)


def factorize(n: int) -> list[int]:
    out, p = [], 2
    while p * p <= n:
        while n % p == 0:
            out.append(p)
            n //= p
        p += 1
    return out + ([n] if n > 1 else [])


# 1. Разложение и числа Евклида
assert factorize(360) == [2, 2, 2, 3, 3, 5] and factorize(30031) == [59, 509]
assert factorize(2**32 + 1) == [641, 6700417] and factorize(2047) == [23, 89]
prod = 1
for p in primes[:6]:
    prod *= int(p)
    print(f"1) {' · '.join(map(str, primes[: list(primes).index(p) + 1]))} + 1 = {prod + 1} = {' · '.join(map(str, factorize(prod + 1)))}")


# 2. π(x) и приближения
def li(x: float) -> float:
    L, term, s = math.log(x), 1.0, 0.0
    for k in range(1, 200):
        term *= L / k
        s += term / k
    return 0.5772156649015329 + math.log(L) + s


table = {100: 25, 1000: 168, 10**4: 1229, 10**5: 9592, 10**6: 78498}
for x, v in table.items():
    assert pi[x] == v
    print(f"2) π({x:>7}) = {v:6}, x/ln x = {x / math.log(x):9.0f}, Li(x) = {li(x) - li(2):9.0f}")
assert round(li(10**6) - li(2)) == 78627

# 3. Разрывы и многочлен Эйлера
gaps = np.diff(primes)
i = int(np.argmax(gaps))
assert (primes[i], gaps[i]) == (492113, 114)
j = int(np.argmax(gaps[primes[:-1] < 2000]))
assert (primes[j], primes[j + 1]) == (1327, 1361)
euler = [n for n in range(100) if is_p[n * n + n + 41]]
assert len(euler) == 86 and min(set(range(100)) - set(euler)) == 40
print(f"3) наибольший разрыв до 10⁶: {gaps[i]} после {primes[i]}; n² + n + 41 простое для {len(euler)} из 100 n")


# 4. Гипотезы и гонка
def goldbach(n: int) -> list[int]:
    return [p for p in range(2, n // 2 + 1) if is_p[p] and is_p[n - p]]


assert len(goldbach(100)) == 6 and len(goldbach(1000)) == 28
twins = int(np.sum(is_p[3:N - 1] & is_p[5:N + 1]))
assert sum(1 for p in primes if p + 2 <= 1000 and is_p[p + 2]) == 35 and twins == 8169


def collatz(n: int) -> tuple[int, int]:
    k, m = 0, n
    while n != 1:
        n = 3 * n + 1 if n % 2 else n // 2
        k, m = k + 1, max(m, n)
    return k, m


assert collatz(27) == (111, 9232)
c1 = np.cumsum((primes % 4) == 1)
c3 = np.cumsum((primes % 4) == 3)
first_lead = int(primes[np.argmax(c1 > c3)])
assert first_lead == 26861 and (c1[-1], c3[-1]) == (39175, 39322)
print(f"4) Гольдбах: 100 → 6, 1000 → 28; близнецов до 10⁶: {twins}; 27 → 111 шагов; 4k + 1 впервые впереди при p = {first_lead}")

xs = np.linspace(100, N, 400).astype(int)
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.3))
a1.plot(xs, pi[xs] / (xs / np.log(xs)), color=ORANGE, label="π(x) / (x/ln x)")
a1.plot(xs, pi[xs] / np.array([li(x) - li(2) for x in xs]), color=AQUA, label="π(x) / Li(x)")
a1.axhline(1, color="0.5", lw=1, ls="--")
a1.set(title="Теорема о распределении простых", xlabel="x", ylabel="отношение")
a1.legend()
a2.plot(primes, c3 - c1, color=BLUE, lw=1)
a2.axhline(0, color="0.5", lw=1)
a2.set_xscale("log")
a2.set(title="Гонка простых: π(x; 4, 3) − π(x; 4, 1)", xlabel="x", ylabel="разность")
ex.finish(fig, "primes_distribution")
