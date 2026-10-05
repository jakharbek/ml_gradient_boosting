"""Случайность и хеширование: ЛКГ и Халл — Добелл, плоскости RANDU, Mulberry32, смещение по модулю, корзины и коллизии.

Запуск:  python lessons/lesson_15_20/examples/randomness_and_hashing.py [--save] [--no-show]

1) Периоды ЛКГ и теорема Халла — Добелла (перебор всех пар для m = 64); младшие биты.
2) RANDU: x_{n+2} = 6x_{n+1} − 9x_n (mod 2³¹) и 15 плоскостей.
3) Mulberry32: ручная реализация = gbcourse, лавинный эффект, повторы выходов.
4) Смещение по модулю и отбраковка.
5) Хеширование: m / НОД(шаг, m) корзин, мультипликативный хеш, коллизии, стабильное разбиение crc32.
"""

import math
import sys
import zlib
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, ORANGE

ex = Example(__file__)
M32 = 0xFFFFFFFF


# 1. ЛКГ
def period(a: int, c: int, m: int, x0: int = 0) -> int:
    seen, x = {}, x0 % m
    while x not in seen:
        seen[x] = len(seen)
        x = (a * x + c) % m
    return len(seen) - seen[x]


def hull_dobell(a: int, c: int, m: int) -> bool:
    ps = [p for p in range(2, m + 1) if m % p == 0 and all(p % q for q in range(2, p))]
    return math.gcd(c, m) == 1 and all((a - 1) % p == 0 for p in ps) and (m % 4 != 0 or (a - 1) % 4 == 0)


assert period(5, 3, 16, 1) == 16 and period(3, 3, 16, 1) == 8 and period(5, 4, 16, 1) == 2 and period(3, 0, 31, 1) == 30
full = [(a, c) for a in range(64) for c in range(1, 64) if period(a, c, 64) == 64]
assert len(full) == 512 and all(hull_dobell(a, c, 64) for a, c in full)
assert all(hull_dobell(a, c, 64) == (period(a, c, 64) == 64) for a in range(64) for c in range(1, 64))
x, bits = 1, []
for _ in range(8):
    x = (1664525 * x + 1013904223) % 2**32
    bits.append(x & 1)
assert bits == [0, 1] * 4
print("1) m = 64: полный период у 512 пар (a, c) — ровно тех, что дают условия Халла — Добелла; младший бит ЛКГ:", bits)

# 2. RANDU
m, a = 2**31, 65539
assert a * a % m == (6 * a - 9) % m
v, vals = 1, []
for _ in range(3002):
    v = a * v % m
    vals.append(v)
vals = np.array(vals, dtype=np.int64)
P = np.stack([vals[:-2], vals[1:-1], vals[2:]], axis=1)
k = (9 * P[:, 0] - 6 * P[:, 1] + P[:, 2])
assert np.all(k % m == 0)
planes = np.unique(k // m)
assert len(planes) <= 15 and planes.min() >= -5 and planes.max() <= 9
print(f"2) RANDU: 9x − 6y + z кратно 2³¹; у 3000 троек — {len(planes)} плоскостей ({planes.min()}…{planes.max()}); младший бит всегда {sorted(set(int(b) for b in vals % 2))}")


# 3. Mulberry32
def mix(state: np.ndarray) -> np.ndarray:
    a_ = state.astype(np.uint64)
    t = ((a_ ^ (a_ >> np.uint64(15))) * (np.uint64(1) | a_)) & np.uint64(M32)
    t = ((t + (((t ^ (t >> np.uint64(7))) * (np.uint64(61) | t)) & np.uint64(M32))) & np.uint64(M32)) ^ t
    return (t ^ (t >> np.uint64(14))) & np.uint64(M32)


ref = Mulberry32(42)
first = [ref.next_uint32() for _ in range(3)]
states = (42 + np.arange(1, 4, dtype=np.uint64) * np.uint64(0x6D2B79F5)) & np.uint64(M32)
assert [int(t) for t in mix(states)] == first
assert [round(t / 2**32, 6) for t in first] == [0.601104, 0.448291, 0.852466]
r = Mulberry32(3)
S = np.array([r.next_uint32() for _ in range(3000)], dtype=np.uint64)
base = mix(S)
flips = np.array([[bin(int(z)).count("1") for z in (base ^ mix(S ^ np.uint64(1 << b)))] for b in range(32)])
assert abs(flips.mean() - 16) < 0.2
n_out = 2**22
outs = mix((np.arange(1, n_out + 1, dtype=np.uint64) * np.uint64(0x6D2B79F5)) & np.uint64(M32))
dups = n_out - np.unique(outs).size
assert dups == 4591
print(f"3) Mulberry32(42) = {[round(t / 2**32, 6) for t in first]}; лавина: {flips.mean():.2f} бит из 32; повторов среди 2²² выходов: {dups} (случайная функция: {n_out**2 // 2**33})")

# 4. Смещение по модулю
assert sorted(Counter(u % 3 for u in range(16)).values()) == [5, 5, 6]
assert 2**32 // 3 == 1431655765 and 2**32 % 3 == 1
limit = 16 - 16 % 3
assert set(Counter(u % 3 for u in range(limit)).values()) == {5}
print("4) 4 бита на 3 исхода: 6/5/5 значений; с отбраковкой (u < 15) — по 5")

# 5. Хеширование
ids = [10 * i for i in range(200)]
assert len({i % 100 for i in ids}) == 10 and len({i % 97 for i in ids}) == 97
ids64 = [64 * i for i in range(200)]
fib = {((i * 0x9E3779B9) & M32) * 128 >> 32 for i in ids64}
assert len({i % 128 for i in ids64}) == 2 and len(fib) == 121
mb, nb = 2**20, 10**5
occ = mb * (1 - (1 - 1 / mb) ** nb)
assert round(occ) == 95380
p_none = 1.0
for i in range(23):
    p_none *= 1 - i / 365
assert abs((1 - p_none) - 0.5073) < 1e-4 and round(math.sqrt(2 * math.log(2) * 2**32)) == 77163
assert zlib.crc32(b"user_42") % 100 == 13
test_users = [u for u in range(10_000) if zlib.crc32(f"user_{u}".encode()) % 100 < 20]
print(f"5) шаг 10: 10 корзин из 100, 97 из 97; кратные 64 при m = 128: 2 корзины, мультипликативный хеш — {len(fib)}")
print(f"   FeatureHasher 2²⁰, 10⁵ категорий: занято ≈ {occ:.0f}; 23 человека: {1 - p_none:.1%}; доля теста crc32: {len(test_users) / 10_000:.3f}")

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.2))
nrm = np.array([9, -6, 1]) / np.linalg.norm([9, -6, 1])
U = P / m
up = np.array([0, 0, 1.0]) - nrm[2] * nrm
up /= np.linalg.norm(up)
a1.scatter(U @ nrm, U @ up, s=2, color=BLUE)
a1.set(title="RANDU вдоль плоскостей: 15 полос", xlabel="проекция на нормаль (9, −6, 1)", ylabel="проекция вдоль плоскости")
F = flips.mean(axis=1)
a2.bar(range(32), F, color=BLUE)
a2.axhline(16, color=ORANGE, ls="--", label="идеал: 16 бит")
a2.set(title="Mulberry32: сколько выходных бит меняет один входной", xlabel="изменённый входной бит", ylabel="бит в среднем")
a2.legend()
ex.finish(fig, "randomness_and_hashing")
