"""От подсчёта к вероятности: беспорядки, дни рождения, бутстрэп и 1/e, собиратель купонов, фолды.

Запуск:  python lessons/lesson_15_17/examples/counting_and_probability.py [--save] [--no-show]

1) Беспорядки: !n ≈ n!/e, число совпадений → Пуассон(1) (5000 перестановок Mulberry32).
2) Парадокс дней рождения: точная формула, приближение через пары, моделирование; коллизии 32-битного хеша.
3) Бутстрэп: доля вне выборки (1 − 1/n)ⁿ → 1/e и распределение числа попаданий.
4) Собиратель купонов: n·Hₙ выборов.
5) Положительные в фолде: гипергеометрическое распределение против биномиального (scipy).
"""

import math
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import stats

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE

ex = Example(__file__)

# 1. Беспорядки
der = [1, 0]
for m in range(2, 21):
    der.append((m - 1) * (der[-1] + der[-2]))
assert all(der[n] == round(math.factorial(n) / math.e) for n in range(1, 16))  # дальше точности float не хватает
rng = Mulberry32(1)
fixed = Counter(sum(v == i for i, v in enumerate(rng.permutation(10))) for _ in range(5000))
print("!10 =", der[10], "; доля", round(der[10] / math.factorial(10), 5), "; совпадения:", {j: fixed[j] / 5000 for j in range(4)})
assert abs(fixed[0] / 5000 - 1 / math.e) < 0.02

# 2. Дни рождения
pd = lambda n, D=365: math.prod((D - i) / D for i in range(n))
n50 = next(n for n in range(1, 100) if 1 - pd(n) > 0.5)
print(f"дни рождения: половина при n = {n50} (P = {1 - pd(n50):.4f}); n = 57: {1 - pd(57):.4f}")
assert n50 == 23
sim = {}
for n in (10, 23, 40, 57):
    r = Mulberry32(n)
    sim[n] = sum(len({r.randint(365) for _ in range(n)}) < n for _ in range(2000)) / 2000
print("моделирование 2000 групп:", sim, "; 32-битный хеш, 50 %:", round(math.sqrt(2 * 2**32 * math.log(2))), "ключей")

# 3. Бутстрэп
for n in (10, 100, 10000):
    r = Mulberry32(7)
    one = [1 - len(set(r.bootstrap(n))) / n for _ in range(50)]
    print(f"бутстрэп n = {n:5}: вне выборки {one[0]:.4f} в одной выборке, {np.mean(one):.4f} в среднем по 50; формула {(1 - 1 / n) ** n:.4f}")
    assert abs(np.mean(one) - (1 - 1 / n) ** n) < 0.03
cnt = Counter(Mulberry32(7).bootstrap(10000))
hits = Counter(cnt.get(i, 0) for i in range(10000))

# 4. Купоны
runs = []
for seed in range(300):
    r, seen, t = Mulberry32(seed + 1), set(), 0
    while len(seen) < 100:
        seen.add(r.randint(100))
        t += 1
    runs.append(t)
H100 = 100 * sum(1 / i for i in range(1, 101))
print(f"купоны n = 100: в среднем {np.mean(runs):.1f} (формула {H100:.1f})")
assert abs(np.mean(runs) - H100) < 30

# 5. Фолд
hg, bn = stats.hypergeom(1000, 50, 100), stats.binom(100, 0.05)
print(f"фолд 100 из 1000: P(X ≤ 2) = {hg.cdf(2):.4f} (с возвращением {bn.cdf(2):.4f}), P(X ≥ 9) = {hg.sf(8):.4f}")

fig, axes = plt.subplots(2, 2, figsize=(11, 7))
ns = np.arange(1, 13)
axes[0, 0].plot(ns, [der[n] / math.factorial(n) for n in ns], "o-", color=BLUE, label="!n / n!")
axes[0, 0].axhline(1 / math.e, color=MUTED, ls="--", label="1/e")
axes[0, 0].set(xlabel="n", ylabel="доля беспорядков", title="Беспорядки: доля → 1/e", ylim=(0, 1))
axes[0, 0].legend()
ns = np.arange(1, 81)
axes[0, 1].plot(ns, [1 - pd(n) for n in ns], color=BLUE, lw=2, label="точно")
axes[0, 1].plot(ns, 1 - np.exp(-ns * (ns - 1) / 730), "--", color=ORANGE, label="через пары")
axes[0, 1].plot(list(sim), list(sim.values()), "o", mfc="white", color=AQUA, label="моделирование")
axes[0, 1].axhline(0.5, color=MUTED, ls=":", lw=1)
axes[0, 1].set(xlabel="человек", ylabel="P(совпадение)", title="Дни рождения")
axes[0, 1].legend()
ks = np.arange(6)
axes[1, 0].bar(ks, [hits[k] / 10000 for k in ks], color=BLUE, width=0.6, label="бутстрэп, n = 10 000")
axes[1, 0].plot(ks, stats.poisson(1).pmf(ks), "o", color=ORANGE, label="Пуассон(1)")
axes[1, 0].set(xlabel="попаданий объекта в выборку", ylabel="доля объектов", title="Бутстрэп ≈ веса Пуассон(1)")
axes[1, 0].legend()
xs = np.arange(0, 16)
axes[1, 1].bar(xs, hg.pmf(xs), color=BLUE, width=0.7, label="без возвращения")
axes[1, 1].plot(xs, bn.pmf(xs), "o", mfc="white", color=MUTED, label="с возвращением")
axes[1, 1].set(xlabel="положительных в фолде из 100", ylabel="вероятность", title="Фолд: 50 положительных из 1000")
axes[1, 1].legend()
fig.tight_layout()
ex.finish(fig, "counting_and_probability")
