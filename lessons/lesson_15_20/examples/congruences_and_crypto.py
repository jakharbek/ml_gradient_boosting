"""Сравнения по модулю и криптография: порядок, Ферма и Эйлер, КТО, тесты простоты, RSA, Диффи — Хеллман.

Запуск:  python lessons/lesson_15_20/examples/congruences_and_crypto.py [--save] [--no-show]

1) Обратные элементы, линейные сравнения, порядки и первообразные корни.
2) Теоремы Ферма, Эйлера и Вильсона; функция Эйлера.
3) Быстрое возведение в степень (с подсчётом умножений) и китайская теорема об остатках.
4) Тесты Ферма и Миллера — Рабина: лжецы у псевдопростых и чисел Кармайкла.
5) Учебные RSA и Диффи — Хеллман.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)


def order(a: int, m: int) -> int:
    k, x = 1, a % m
    while x != 1:
        x, k = x * a % m, k + 1
    return k


def phi(n: int) -> int:
    return sum(1 for k in range(1, n + 1) if math.gcd(k, n) == 1)


# 1. Обратные, сравнения, порядки
assert pow(3, -1, 7) == 5 and [x for x in range(10) if (6 * x - 4) % 10 == 0] == [4, 9]
assert not [x for x in range(10) if (6 * x - 5) % 10 == 0]
assert order(2, 11) == 10 and order(3, 11) == 5
roots = [a for a in range(1, 11) if order(a, 11) == 10]
assert roots == [2, 6, 7, 8] and pow(7, 2026, 10) == 9
print("1) 3⁻¹ ≡ 5 (mod 7); 6x ≡ 4 (mod 10) → x ∈ {4, 9}; первообразные корни mod 11:", roots, "; последняя цифра 7²⁰²⁶ = 9")

# 2. Ферма, Эйлер, Вильсон
assert pow(2, 10, 11) == 1 and phi(12) == 4 and pow(5, 4, 12) == 1 and pow(3, 100, 7) == 4
assert math.factorial(12) % 13 == 12 and phi(36) == phi(4) * phi(9) == 12 and phi(100) == 40
for n in (12, 36, 100):
    assert sum(phi(d) for d in range(1, n + 1) if n % d == 0) == n
print("2) 2¹⁰ ≡ 1 (mod 11), 5⁴ ≡ 1 (mod 12), 3¹⁰⁰ ≡ 4 (mod 7), 12! ≡ −1 (mod 13), φ(36) = 12")


# 3. Быстрое возведение в степень и КТО
def fast_pow(a: int, e: int, m: int) -> tuple[int, int]:
    r, mults = 1, 0
    for i, bit in enumerate(bin(e)[2:]):
        if i:
            r, mults = r * r % m, mults + 1
        if bit == "1":
            r = r * a % m
            mults += i > 0
    return r, mults


assert fast_pow(3, 100, 7) == (4, 8) and fast_pow(3, 13, 10**9) == (1594323, 5)
assert fast_pow(2, 10**18, 10**9 + 7)[1] == 82
print("3) 3¹⁰⁰ mod 7 за", fast_pow(3, 100, 7)[1], "умножений; 2^(10¹⁸) mod (10⁹ + 7) за", fast_pow(2, 10**18, 10**9 + 7)[1])


def crt(r1: int, m1: int, r2: int, m2: int) -> int:
    return (r1 * m2 * pow(m2, -1, m1) + r2 * m1 * pow(m1, -1, m2)) % (m1 * m2)


assert crt(2, 3, 3, 5) == 8 and crt(crt(2, 3, 3, 5), 15, 2, 7) == 23
assert len({(k % 4, k % 6) for k in range(24)}) == 12
print("   КТО: 8 (mod 15), задача Сунь-цзы → 23; при m = 4, n = 6 достижимо 12 пар остатков из 24")


# 4. Тесты простоты
def strong_liar(a: int, n: int) -> bool:
    d, s = n - 1, 0
    while d % 2 == 0:
        d, s = d // 2, s + 1
    x = pow(a, d, n)
    if x in (1, n - 1):
        return True
    for _ in range(s - 1):
        x = x * x % n
        if x == n - 1:
            return True
    return False


def is_prime(n: int) -> bool:
    return n > 1 and all(n % d for d in range(2, math.isqrt(n) + 1))


rows = []
for n in (341, 561, 1105, 1729, 2047, 8911):
    fl = sum(pow(a, n - 1, n) == 1 for a in range(2, n - 1))
    sl = sum(strong_liar(a, n) for a in range(2, n - 1))
    rows.append((n, fl / (n - 3), sl / (n - 3)))
    print(f"4) n = {n:5}: лжецов Ферма {fl:5} ({fl / (n - 3):.1%}), сильных лжецов {sl:3} ({sl / (n - 3):.1%})")
    assert sl / (n - 3) <= 0.25
assert [r for r in rows if r[0] == 561][0][1] == 318 / 558
carm = [n for n in range(3, 10**4, 2) if not is_prime(n) and all(pow(a, n - 1, n) == 1 for a in range(2, n) if math.gcd(a, n) == 1)]
assert carm == [561, 1105, 1729, 2465, 2821, 6601, 8911]
assert strong_liar(2, 2047) and not strong_liar(3, 2047)
print("   числа Кармайкла до 10⁴:", carm)

# 5. RSA и Диффи — Хеллман
p, q, e = 61, 53, 17
n, ph = p * q, (p - 1) * (q - 1)
d = pow(e, -1, ph)
assert (n, ph, d, pow(65, e, n), pow(pow(65, e, n), d, n)) == (3233, 3120, 2753, 2790, 65)
A, B = pow(5, 6, 23), pow(5, 15, 23)
assert (A, B, pow(B, 6, 23), pow(A, 15, 23)) == (8, 19, 2, 2)
print(f"5) RSA: n = {n}, d = {d}, 65 → 2790 → 65;  Диффи — Хеллман: A = {A}, B = {B}, общий ключ 2")

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.2))
x = np.arange(1, 22)
a1.scatter(x, [pow(5, int(k), 23) for k in x], color=ORANGE, label="5ˣ mod 23")
a1.scatter(x, [5 * int(k) % 23 for k in x], color=BLUE, marker="s", s=18, label="5·x mod 23")
a1.set(title="Степень по модулю перемешивает остатки", xlabel="x", ylabel="значение")
a1.legend()
names = [str(r[0]) for r in rows]
a2.bar(np.arange(len(rows)) - 0.2, [r[1] for r in rows], width=0.4, color=MUTED, label="лжецы Ферма")
a2.bar(np.arange(len(rows)) + 0.2, [r[2] for r in rows], width=0.4, color=BLUE, label="сильные лжецы")
a2.axhline(0.25, color=ORANGE, ls="--", label="граница 1/4")
a2.set_xticks(range(len(rows)), names)
a2.set(title="Доля оснований-лжецов у составных n", ylabel="доля")
a2.legend()
ex.finish(fig, "congruences_and_crypto")
