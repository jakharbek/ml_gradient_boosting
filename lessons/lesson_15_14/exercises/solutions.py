"""Решения упражнений урока 15.14.

Запуск:  python lessons/lesson_15_14/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from scipy import integrate, special, stats

from gbcourse.rng import Mulberry32

# 1. Описание данных
x = np.array([120, 135, 128, 142, 131, 125, 980, 138, 129, 133])
q1, q3 = np.percentile(x, [25, 75])
iqr = q3 - q1
med = np.median(x)
mad = 1.4826 * np.median(np.abs(x - med))
z980 = (980 - x.mean()) / x.std(ddof=1)
print(f"1) среднее {x.mean():.1f}, медиана {med}, s = {x.std(ddof=1):.1f}, IQR = {iqr}, 1.4826·MAD = {mad:.2f}")
print(f"   заборы Тьюки [{q1 - 1.5 * iqr}, {q3 + 1.5 * iqr}]; z(980) = {z980:.2f}; |980 − медиана|/MAD = {abs(980 - med) / mad:.0f}")
print("   |z| > 3 — нет (выброс раздул s и замаскировал себя), медиана ± 3·MAD — да, Тьюки — да")
assert z980 < 3 and abs(980 - med) > 3 * mad and 980 > q3 + 1.5 * iqr

# 2. Интервал для доли
p, n = 340 / 400, 400
se = math.sqrt(p * (1 - p) / n)
w = stats.binomtest(340, 400).proportion_ci(method="wilson")
print(f"2) Вальд [{p - 1.96 * se:.3f}, {p + 1.96 * se:.3f}], Уилсон [{w.low:.3f}, {w.high:.3f}]")
assert (round(w.low, 3), round(w.high, 3)) == (0.812, 0.882)

# 3. Размер теста
z = stats.norm.ppf(0.975)
n1, n2 = math.ceil(z**2 * 0.85 * 0.15 / 0.01**2), math.ceil(z**2 * 0.85 * 0.15 / 0.005**2)
print(f"3) ±0.01 — {n1} объектов, ±0.005 — {n2} (вчетверо больше)")
assert n1 == 4898

# 4. Смещение оценки дисперсии
rng = Mulberry32(4)
v0, v1, s1 = [], [], []
for _ in range(20000):
    s = np.array([rng.normal() for _ in range(3)])
    v0.append(s.var())
    v1.append(s.var(ddof=1))
    s1.append(s.std(ddof=1))
es = math.sqrt(2 / 2) * special.gamma(1.5) / special.gamma(1.0)
print(f"4) /n: {np.mean(v0):.3f} (теория 0.667), /(n − 1): {np.mean(v1):.3f} (теория 1), E s: {np.mean(s1):.3f} (теория {es:.3f})")
assert abs(np.mean(v0) - 2 / 3) < 0.02 and abs(np.mean(s1) - es) < 0.02

# 5. ОМП для Пуассона
c = np.array([3, 5, 2, 4, 6, 3, 4, 2, 5, 4])
lam = c.mean()
se = math.sqrt(lam / len(c))
ll = lambda t: c.sum() * np.log(t) - len(c) * t
grid = np.linspace(1, 8, 70001)
inside = grid[ll(lam) - ll(grid) <= 1.92]
print(f"5) λ̂ = {lam}, SE = {se:.3f}; по правдоподобию [{inside.min():.3f}, {inside.max():.3f}], λ̂ ± 1.96·SE = [{lam - 1.96 * se:.3f}, {lam + 1.96 * se:.3f}]")
assert inside.max() - lam > lam - inside.min()          # интервал правдоподобия несимметричен

# 6. Бутстрэп для MSE
rng = Mulberry32(5)
sq = np.array([(1.5 * rng.normal()) ** 2 for _ in range(60)])
r2 = Mulberry32(6)
boot = np.array([sq[r2.bootstrap(60)].mean() for _ in range(5000)])
se_mse = sq.std(ddof=1) / math.sqrt(60)
print(f"6) MSE = {sq.mean():.3f}; бутстрэп [{np.percentile(boot, 2.5):.3f}, {np.percentile(boot, 97.5):.3f}]; ± 1.96·SE: [{sq.mean() - 1.96 * se_mse:.3f}, {sq.mean() + 1.96 * se_mse:.3f}]")
assert abs(boot.std(ddof=1) - se_mse) < 0.05

# 7. Ноль ошибок
post = stats.beta(1, 21)
wil = stats.binomtest(0, 20).proportion_ci(method="wilson")
print(f"7) Beta(1, 21): 95-й перцентиль {post.ppf(0.95):.3f}, P(p > 0.1) = {post.sf(0.1):.3f}; правило трёх 0.15; Уилсон (двусторонний) до {wil.high:.3f}")
assert abs(post.ppf(0.95) - (1 - 0.05 ** (1 / 21))) < 1e-9

# 8. Парный или независимый
old = np.array([31.2, 28.5, 35.1, 40.3, 26.8, 33.0, 29.9, 37.4])
new = np.array([30.1, 28.1, 33.2, 39.5, 25.3, 32.8, 28.6, 36.5])
pw, pp = stats.ttest_ind(old, new, equal_var=False).pvalue, stats.ttest_rel(old, new).pvalue
print(f"8) Уэлч p = {pw:.3f}, парный p = {pp:.5f}; корреляция старой и новой {np.corrcoef(old, new)[0, 1]:.3f}")
print("   Операторы различаются по скорости гораздо сильнее, чем эффект системы; парный критерий сокращает эту разницу.")
assert pp < 0.01 and pw > 0.5

# 9. Поправки на множественность
rng = Mulberry32(9)
any_raw = any_bonf = any_holm = 0
for _ in range(2000):
    pv = np.array([2 * stats.norm.sf(abs(rng.normal())) for _ in range(20)])
    any_raw += np.any(pv <= 0.05)
    any_bonf += np.any(pv <= 0.05 / 20)
    sp = np.sort(pv)
    any_holm += sp[0] <= 0.05 / 20            # Холм отвергает хоть что-то ⇔ отвергает минимальное p
print(f"9) хотя бы одна «находка»: без поправки {any_raw / 2000:.3f} (теория {1 - 0.95**20:.3f}), Бонферрони {any_bonf / 2000:.3f}, Холм {any_holm / 2000:.3f}")
assert abs(any_raw / 2000 - (1 - 0.95**20)) < 0.03 and any_bonf / 2000 < 0.065

# 10. Проклятие победителя
rng = Mulberry32(10)
best = np.array([max(0.8 + 0.02 * rng.normal() for _ in range(50)) for _ in range(5000)])
emax = integrate.quad(lambda t: t * 50 * stats.norm.pdf(t) * stats.norm.cdf(t) ** 49, -10, 10)[0]
print(f"10) завышение в симуляции {best.mean() - 0.8:.4f}, интеграл: {emax:.3f}·0.02 = {emax * 0.02:.4f}")
assert abs(best.mean() - 0.8 - 0.02 * emax) < 0.002

# 11. Мак-Немар
p_mc = stats.binomtest(15, 45, 0.5).pvalue
pa, pb = 415 / 500, 430 / 500
pbar = (pa + pb) / 2
p_un = 2 * stats.norm.sf((pb - pa) / math.sqrt(2 * pbar * (1 - pbar) / 500))
print(f"11) точности A = {pa:.2f}, B = {pb:.2f}; Мак-Немар p = {p_mc:.4f}, непарный z p = {p_un:.3f}")
assert p_mc < 0.05 < p_un


# 12. Минимальный размер листа
def best_r2(y, min_leaf):
    n, cs, tot = len(y), np.cumsum(y), y.sum()
    b = np.arange(min_leaf, n - min_leaf + 1)
    left = cs[b - 1]
    return max(0.0, (left**2 / b + (tot - left) ** 2 / (n - b) - tot**2 / n).max()) / ((y - y.mean()) ** 2).sum()


rng = Mulberry32(12)
res = {1: [], 10: []}
for _ in range(500):
    y = [rng.normal() for _ in range(50)]
    best1 = best10 = 0.0
    for _ in range(10):
        rng.shuffle(y)
        ya = np.array(y)
        best1, best10 = max(best1, best_r2(ya, 1)), max(best10, best_r2(ya, 10))
    res[1].append(best1)
    res[10].append(best10)
for k, v in res.items():
    print(f"12) минимум {k:2d} в листе: R² лучшего шумового разбиения в среднем {np.mean(v):.3f}, 95-й перцентиль {np.quantile(v, 0.95):.3f}")
print("    Крошечные листья позволяют «отрезать» 1–2 крайних значения шума; запрет маленьких листьев убирает самые везучие пороги.")
print("    Но эффект скромный: лучшее шумовое разбиение всё равно объясняет ~15 % дисперсии. Поэтому нужны и порог γ, и λ, и валидация.")
assert np.mean(res[10]) < np.mean(res[1])
