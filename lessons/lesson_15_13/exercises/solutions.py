"""Решения упражнений урока 15.13.

Запуск:  python lessons/lesson_15_13/exercises/solutions.py
"""

import math
import sys
from fractions import Fraction
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np
from scipy import stats

from gbcourse.boosting import GBRegressor
from gbcourse.rng import Mulberry32

sys.stdout.reconfigure(encoding="utf-8")
np.set_printoptions(precision=4, suppress=True)
DICE = list(product(range(1, 7), repeat=2))


# 1. Серии
def p_longest_le(n, L):
    dp = np.zeros(L)
    dp[0] = 1.0
    for _ in range(n - 1):
        new = np.zeros(L)
        new[0] = 0.5 * dp.sum()
        new[1:] = 0.5 * dp[:-1]
        dp = new
    return dp.sum()


p50, p100 = 1 - p_longest_le(50, 5), 1 - p_longest_le(100, 5)
rng = Mulberry32(1)
sim = np.mean([max(len(r) for r in "".join("О" if rng.random() < 0.5 else "Р" for _ in range(50)).replace("ОР", "О Р").replace("РО", "Р О").split()) >= 6 for _ in range(4000)])
print(f"1) P(серия ≥ 6): 50 бросков {p50:.4f} (симуляция {sim:.3f}), 100 бросков {p100:.4f}")
assert abs(p50 - sim) < 0.03 and abs(p100 - 0.807) < 1e-3

# 2. Два кубика
p_ge10 = Fraction(sum(1 for a, b in DICE if a + b >= 10), 36)
p_diff = Fraction(sum(1 for a, b in DICE if a != b), 36)
rng = Mulberry32(2)
sim = np.mean([(1 + rng.randint(6)) + (1 + rng.randint(6)) >= 10 for _ in range(20000)])
print(f"2) P(сумма ≥ 10) = {p_ge10} ≈ {float(p_ge10):.4f} (симуляция {sim:.4f}); P(разные) = {p_diff}")
assert p_ge10 == Fraction(1, 6) and p_diff == Fraction(5, 6)

# 3. Формула сложения
app, web, both = 0.40, 0.30, 0.15
print(f"3) ни то, ни другое: {1 - (app + web - both):.2f};  P(приложение | веб) = {both / web:.2f};  P(A)P(B) = {app * web:.2f} ≠ {both} → зависимы")
assert abs(1 - (app + web - both) - 0.45) < 1e-12 and abs(both / web - 0.5) < 1e-12

# 4. Урна
def paths(r, b, k, replace):
    if k == 0:
        yield "", Fraction(1)
        return
    for c, cnt in (("К", r), ("С", b)):
        if cnt == 0:
            continue
        nr, nb = (r, b) if replace else ((r - 1, b) if c == "К" else (r, b - 1))
        for rest, p in paths(nr, nb, k - 1, replace):
            yield c + rest, Fraction(cnt, r + b) * p


for replace in (False, True):
    leaves = dict(paths(4, 3, 3, replace))
    two = sum(p for s, p in leaves.items() if s.count("К") == 2)
    third = sum(p for s, p in leaves.items() if s[2] == "К")
    print(f"4) {'с возвращением' if replace else 'без возвращения'}: ровно два красных {two} ≈ {float(two):.4f}, третий красный {third}")
assert sum(p for s, p in dict(paths(4, 3, 3, False)).items() if s.count("К") == 2) == Fraction(18, 35)

# 5. Мошенничество
for prev in (0.02, 0.002):
    tp, fp = 10000 * prev * 0.9, 10000 * (1 - prev) * 0.01
    odds = prev / (1 - prev) * 0.9 / 0.01
    print(f"5) мошенников {prev:.1%}: {tp:.0f} найдено, {fp:.0f} ложных → доля {tp / (tp + fp):.4f}; через шансы {odds / (1 + odds):.4f}")
assert abs(180 / 278 - 0.6475) < 1e-4

# 6. Два теста
lr_p, lr_n = 0.99 / 0.05, 0.01 / 0.95
for order in ("+-", "-+"):
    logit = math.log(0.01 / 0.99)
    out = []
    for r in order:
        logit += math.log(lr_p if r == "+" else lr_n)
        out.append(f"после «{r}»: логит {logit:+.3f}, P = {1 / (1 + math.exp(-logit)):.5f}")
    print("6) " + order + ": " + "; ".join(out))
print("   порядок не важен: логиты складываются, а сумма не зависит от порядка слагаемых")

# 7. Все грани
exact = sum(6 / (6 - j) for j in range(6))
rng = Mulberry32(7)
counts = []
for _ in range(20000):
    seen, n = set(), 0
    while len(seen) < 6:
        seen.add(rng.randint(6))
        n += 1
    counts.append(n)
print(f"7) ожидание {exact:.2f} = 6·(1 + 1/2 + … + 1/6), симуляция {np.mean(counts):.2f}")
assert abs(exact - 14.7) < 1e-12 and abs(np.mean(counts) - exact) < 0.2

# 8. Максимум и Чебышёв
x = np.arange(1, 7)
p = (2 * x - 1) / 36
mu = (x * p).sum()
sd = math.sqrt(((x - mu) ** 2 * p).sum())
tail = p[np.abs(x - mu) >= 2 * sd].sum()
print(f"8) E = {mu:.4f} (161/36), Var = {sd**2:.4f} (2555/1296), P(|X − μ| ≥ 2σ) = {tail:.4f} ≤ 0.25")
assert abs(mu - 161 / 36) < 1e-12 and abs(tail - 1 / 36) < 1e-12

# 9. Пуассон
po, bi = stats.poisson(4), stats.binom(600, 4 / 600)
print(f"9) P(0) = {po.pmf(0):.4f} (бином {bi.pmf(0):.4f}),  P(> 7) = {po.sf(7):.4f} (бином {bi.sf(7):.4f})")
assert abs(po.pmf(0) - math.exp(-4)) < 1e-12

# 10. Шум метрики
n_need = math.ceil((3 / 0.05) ** 2)
se = 3 / math.sqrt(400)
rng = Mulberry32(10)
mses = []
for _ in range(2000):                        # квадраты ошибок с E = 2 и σ = 3 (нормальное приближение)
    mses.append(np.mean([2 + 3 * rng.normal() for _ in range(400)]))
print(f"10) нужно n ≥ {n_need}; при n = 400 стандартная ошибка {se:.3f} (симуляция {np.std(mses):.3f}); разница 0.05 < 2·{se:.2f} — неразличимы")
assert n_need == 3600

# 11. Нормальный шум → среднее, Пуассон → ln среднего
y = np.array([2, 4, 3, 7, 9, 11.0])
c = np.array([0, 1, 1, 2, 3, 0, 5, 2, 1, 8.0])
Fs = np.linspace(0, 12, 12001)
nll_norm = [np.sum((y - F) ** 2) / 2 for F in Fs]                 # σ = 1, без констант
Fp = np.linspace(-1, 2, 30001)
nll_pois = [np.sum(np.exp(F) - c * F) for F in Fp]
g1 = GBRegressor(loss="squared", n_estimators=1).fit(np.zeros((6, 1)), y)
g2 = GBRegressor(loss="poisson", n_estimators=1).fit(np.zeros((10, 1)), c)
print(f"11) нормальный шум: минимум при F = {Fs[np.argmin(nll_norm)]:.3f} = ȳ = {y.mean()};  gbcourse F0 = {float(g1.init_):.4f}")
print(f"    Пуассон: минимум при F = {Fp[np.argmin(nll_pois)]:.4f}, ln ȳ = {math.log(c.mean()):.4f};  gbcourse F0 = {float(g2.init_):.4f}")
assert abs(Fs[np.argmin(nll_norm)] - 6) < 1e-9 and abs(float(g2.init_) - math.log(c.mean())) < 1e-12

# 12. Лес и бутстрэп
rho, k = 0.2, 50
v = rho + (1 - rho) / k
n = 200
exp_distinct = n * (1 - (1 - 1 / n) ** n)
rng = Mulberry32(12)
distinct = len(set(rng.bootstrap(n)))
print(f"12) Var среднего 50 деревьев = {v:.3f} (в {1 / v:.2f} раза меньше), предел {rho};  различных объектов: ожидание {exp_distinct:.1f}, в выборке {distinct}")
assert abs(v - 0.216) < 1e-12
