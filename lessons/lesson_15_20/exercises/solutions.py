"""Решения упражнений к уроку 15.20 «Теория чисел».

Запуск:  python lessons/lesson_15_20/exercises/solutions.py [--save] [--no-show]
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np
from sklearn.model_selection import KFold
from sklearn.tree import DecisionTreeRegressor

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32

ex = Example(__file__)
MASK = 0xFFFFFFFF

print("=== 1. Фолды и батчи")
for k in (3, 7, 10, 13):
    q, r = divmod(1000, k)
    ours = [q + 1] * r + [q] * (k - r)
    assert ours == [len(t) for _, t in KFold(k).split(np.zeros(1000))]
    print(f"k = {k:2}: {r} фолдов по {q + 1}, {k - r} по {q}")
equal = [k for k in range(2, 21) if 1000 % k == 0]
assert equal == [2, 4, 5, 8, 10, 20]
print("все фолды равны при k =", equal, "; шагов за эпоху:", {b: (1000 + b - 1) // b for b in (32, 64, 100, 128)})

print("\n=== 2. Признаки делимости")


def weighted(s: str, d: int) -> int:
    w = [pow(10, k, d) for k in range(len(s))]
    return sum(int(c) * wk for c, wk in zip(reversed(s), w))


rng = Mulberry32(2)
for _ in range(10_000):
    s = "".join(str(rng.randint(10)) for _ in range(20))
    for d in range(2, 14):
        assert weighted(s, d) % d == int(s) % d
per6 = [d for d in range(2, 14) if math.gcd(10, d) == 1 and min(k for k in range(1, 20) if pow(10, k, d) == 1) == 6]
assert per6 == [7, 13]
print("проверено на 10 000 числах; период весов 6 у d =", per6)

print("\n=== 3. Расширенный Евклид")


def ext_gcd(a: int, b: int) -> tuple[int, int, int]:
    r0, r1, x0, x1, y0, y1 = a, b, 1, 0, 0, 1
    while r1:
        q = r0 // r1
        r0, r1, x0, x1, y0, y1 = r1, r0 - q * r1, x1, x0 - q * x1, y1, y0 - q * y1
    return r0, x0, y0


for m in (13, 12):
    inv = {}
    for a in range(1, m):
        g, x, _ = ext_gcd(a, m)
        if g == 1:
            inv[a] = x % m
            assert inv[a] == pow(a, -1, m)
    print(f"mod {m}: {inv}")
print("по модулю 12 обратимы только числа, взаимно простые с 12: 1, 5, 7, 11 (φ(12) = 4)")

print("\n=== 4. Монеты")
for a in range(2, 16):
    for b in range(a + 1, 16):
        if math.gcd(a, b) != 1:
            continue
        ok = [True] + [False] * (a * b)
        for v in range(1, a * b + 1):
            ok[v] = (v >= a and ok[v - a]) or (v >= b and ok[v - b])
        bad = [v for v in range(a * b + 1) if not ok[v]]
        assert (bad[-1] if bad else -1) == a * b - a - b and len(bad) == (a - 1) * (b - 1) // 2
print("формулы Сильвестра подтверждены для всех взаимно простых пар 2 ≤ a < b ≤ 15")

print("\n=== 5. Доля взаимно простых пар")
rng = Mulberry32(5)
n = 100_000
hits = sum(math.gcd(1 + rng.randint(10**9), 1 + rng.randint(10**9)) == 1 for _ in range(n))
p = hits / n
se = math.sqrt(p * (1 - p) / n)
a = np.arange(1, 1001)
exact = float((np.gcd.outer(a, a) == 1).mean())
print(f"оценка {p:.4f} ± {se:.4f}; 6/π² = {6 / math.pi**2:.4f}; квадрат 1000×1000: {exact:.6f}")
assert abs(p - 6 / math.pi**2) < 4 * se and abs(exact - 0.608383) < 1e-6

print("\n=== 6. Решето и π(x)")
N = 10**6
is_p = np.ones(N + 1, bool)
is_p[:2] = False
for q in range(2, math.isqrt(N) + 1):
    if is_p[q]:
        is_p[q * q :: q] = False
pr = np.nonzero(is_p)[0]
gaps = np.diff(pr)
i = int(np.argmax(gaps))
first50 = int(pr[np.argmax(gaps > 50)])
print(f"π(10⁶) = {pr.size}; наибольший разрыв {gaps[i]} после {pr[i]}; первые ≥ 50 составных подряд после {first50}")
assert pr.size == 78498 and gaps[i] == 114 and first50 == 19609

print("\n=== 7. Порядки и последние цифры")
ord7 = next(k for k in range(1, 101) if pow(7, k, 100) == 1)
last2 = pow(7, 2026 % ord7, 100)
assert last2 == pow(7, 2026, 100) == 49 and ord7 == 4
roots = [g for g in range(1, 23) if all(pow(g, 22 // q, 23) != 1 for q in (2, 11))]
phi22 = sum(1 for k in range(1, 23) if math.gcd(k, 22) == 1)
assert len(roots) == phi22 == 10
print(f"ord₁₀₀(7) = {ord7}, 7²⁰²⁶ ≡ 7^{2026 % ord7} = {last2} (mod 100); первообразные корни mod 23: {roots}")

print("\n=== 8. Китайская теорема")


def crt(pairs: list[tuple[int, int]]) -> tuple[int, int]:
    x, M = 0, 1
    for r, m in pairs:
        x = (x * m * pow(m, -1, M) + r * M * pow(M, -1, m)) % (M * m) if M > 1 else r % m
        M *= m
    return x, M


x, M = crt([(2, 3), (3, 5), (2, 7), (5, 11)])
assert [y for y in range(M) if y % 3 == 2 and y % 5 == 3 and y % 7 == 2 and y % 11 == 5] == [x]
print(f"x ≡ {x} (mod {M}); система mod 6 и mod 4 несовместна: x ≡ 1 (mod 6) — нечётно, x ≡ 2 (mod 4) — чётно")

print("\n=== 9. Тесты простоты")


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


worst = (0.0, 0)
for n in range(9, 10_000, 2):
    if is_p[n]:
        continue
    share = sum(strong_liar(a, n) for a in range(1, n)) / (n - 1)
    assert share <= 0.25
    worst = max(worst, (share, n))
carm = [n for n in range(3, 10_000, 2) if not is_p[n] and all(pow(a, n - 1, n) == 1 for a in range(2, n) if math.gcd(a, n) == 1)]
print(f"наибольшая доля сильных лжецов {worst[0]:.3f} у n = {worst[1]}; числа Кармайкла: {carm}")
assert carm == [561, 1105, 1729, 2465, 2821, 6601, 8911]

print("\n=== 10. Порядок суммирования")


def seq(xs):
    s = 0.0
    for v in xs:
        s += v
    return s


def kahan(xs):
    s = c = 0.0
    for v in xs:
        y = v - c
        t = s + y
        c = (t - s) - y
        s = t
    return s


rng = Mulberry32(1)
xs = [math.floor(rng.random() * 100000) / 100 for _ in range(10**5)]
exact = math.fsum(xs)
ulp = math.ulp(exact)
for name, v in [("цикл", seq(xs)), ("обратно", seq(xs[::-1])), ("np.sum", float(np.sum(np.array(xs)))), ("Кэхэн", kahan(xs)), ("по возрастанию", seq(sorted(xs)))]:
    print(f"{name:15}: ошибка {(v - exact) / ulp:+.0f} ulp")
assert abs(kahan(xs) - exact) <= ulp
rng = Mulberry32(7)
u = [rng.random() for _ in range(10**6)]
assert seq(u) == math.fsum(u)
print("сумма 10⁶ значений random() точна: все они кратны 2⁻³², а частичные суммы < 2²⁰ помещаются в 53 бита")

print("\n=== 11. float32 и деревья")
x0 = 1_760_000_000
distinct = [d for d in range(1, 301) if np.unique((x0 + d * np.arange(60)).astype(np.float32)).size == 60]
assert all(d in distinct for d in range(128, 301))
print("все 60 значений различны во float32 при Δ ≥", min(distinct), "(шаг float32 у x₀ — 128 с)")
X = (x0 + 60 * np.arange(60)).astype(np.float64).reshape(-1, 1)
found_raw = found_shift = 0
for cut in range(1, 60):
    y = (np.arange(60) >= cut).astype(float)
    found_raw += np.abs(DecisionTreeRegressor(max_depth=1).fit(X, y).predict(X) - y).max() < 1e-9
    found_shift += np.abs(DecisionTreeRegressor(max_depth=1).fit(X - x0, y).predict(X - x0) - y).max() < 1e-9
print(f"Δ = 60: точно разделимых границ {found_raw} из 59 (после вычитания x₀ — {found_shift})")
assert found_shift == 59 and found_raw < 59

print("\n=== 12. Генераторы и хеши")


def period(a: int, c: int, m: int) -> int:
    seen, v = {}, 0
    while v not in seen:
        seen[v] = len(seen)
        v = (a * v + c) % m
    return len(seen) - seen[v]


full = {(a, c) for a in range(256) for c in range(256) if period(a, c, 256) == 256}
hd = {(a, c) for a in range(256) for c in range(256) if c % 2 == 1 and a % 4 == 1}
assert full == hd and len(full) == 128 * 64
v, low = 12345, []
for _ in range(12):
    v = (1664525 * v + 1013904223) & MASK
    low.append(v & 3)
assert low[:4] == low[4:8] == low[8:12] and len(set(low[:4])) == 4
ids = [24 * i for i in range(5000)]
for m in (96, 97, 128):
    used_mod = len({i % m for i in ids})
    used_fib = len({((i * 0x9E3779B9) & MASK) * m >> 32 for i in ids})
    print(f"m = {m:3}: id % m занимает {used_mod:3} корзин (m / НОД(24, m) = {m // math.gcd(24, m)}), мультипликативный хеш — {used_fib}")
    assert used_mod == m // math.gcd(24, m)
print("полный период mod 256: ровно пары с нечётным c и a ≡ 1 (mod 4), их", len(full), "; младшие 2 бита ЛКГ:", low[:4])
