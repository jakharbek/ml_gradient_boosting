"""События, условная вероятность и Байес: кубики, ложные тревоги, Монти Холл.

Запуск:  python lessons/lesson_15_13/examples/events_and_bayes.py [--save] [--no-show]

1) Классическая вероятность: распределение суммы двух и трёх кубиков, точно и симуляцией (Mulberry32).
2) Формула Байеса: P(болен | +) в зависимости от доли больных; шансы и логиты при нескольких тестах.
3) Монти Холл: доля выигрышей «остаться» и «сменить» сходится к 1/3 и 2/3.
"""

import math
import sys
from collections import Counter
from fractions import Fraction
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))

# 1. Сумма кубиков
two = Counter(a + b for a, b in product(range(1, 7), repeat=2))
three = Counter(sum(d) for d in product(range(1, 7), repeat=3))
print("P(сумма 7 на двух кубиках) =", Fraction(two[7], 36))
print("Галилей: сумма 9 —", three[9], "троек, сумма 10 —", three[10], "из 216")
assert two[7] == 6 and (three[9], three[10]) == (25, 27)
rng = Mulberry32(1)
N = 20000
sim = Counter(1 + rng.randint(6) + 1 + rng.randint(6) for _ in range(N))
print(f"симуляция {N} бросков: доля сумм 7 = {sim[7] / N:.4f} (точно {1 / 6:.4f})")
assert abs(sim[7] / N - 1 / 6) < 0.01
ax = axes[0]
s = np.arange(2, 13)
ax.bar(s, [two[k] / 36 for k in s], color=BLUE, alpha=0.7, label="точно: число исходов / 36")
ax.plot(s, [sim[k] / N for k in s], "o", color=ORANGE, label=f"частота в {N} бросках")
ax.set(xlabel="сумма двух кубиков", ylabel="вероятность", title="классическая вероятность и частота")
ax.legend()

# 2. Байес
def posterior(prev, sens=0.99, spec=0.95):
    return prev * sens / (prev * sens + (1 - prev) * (1 - spec))

print(f"P(болен | +) при 1 %: {posterior(0.01):.4f}")
assert abs(posterior(0.01) - 1 / 6) < 1e-9
logit = math.log(0.01 / 0.99)
for res in "++-":
    logit += math.log(0.99 / 0.05 if res == "+" else 0.01 / 0.95)
    print(f"  после «{res}»: логит {logit:+.3f}, P = {1 / (1 + math.exp(-logit)):.4f}")
ax = axes[1]
prev = np.logspace(-3, np.log10(0.5), 200)
ax.plot(prev, posterior(prev), color=BLUE, lw=2.2, label="P(болен | +), один тест")
odds2 = prev / (1 - prev) * (0.99 / 0.05) ** 2
ax.plot(prev, odds2 / (1 + odds2), color=ORANGE, lw=2.2, label="два независимых «+»")
ax.plot(prev, prev, "--", color=MUTED, label="без теста")
ax.set(xscale="log", xlabel="доля больных", ylabel="вероятность болезни", title="формула Байеса", ylim=(0, 1))
ax.legend()

# 3. Монти Холл
rng = Mulberry32(1)
stay = []
for _ in range(5000):
    car, pick = rng.randint(3), rng.randint(3)
    goats = [d for d in range(3) if d not in (pick, car)]
    _opened = goats[rng.randint(2)] if len(goats) == 2 else goats[0]
    stay.append(pick == car)
stay = np.array(stay)
run = stay.cumsum() / np.arange(1, len(stay) + 1)
print(f"Монти Холл, 5000 игр: остаться {run[-1]:.3f}, сменить {1 - run[-1]:.3f}")
assert abs(run[-1] - 1 / 3) < 0.03
ax = axes[2]
n = np.arange(1, len(stay) + 1)
ax.plot(n, 1 - run, color=ORANGE, lw=2, label="сменить")
ax.plot(n, run, color=BLUE, lw=2, label="остаться")
ax.axhline(2 / 3, color=ORANGE, ls="--", lw=1)
ax.axhline(1 / 3, color=BLUE, ls="--", lw=1)
ax.set(xscale="log", ylim=(0, 1), xlabel="сыграно игр", ylabel="доля выигрышей", title="Монти Холл")
ax.legend()

fig.tight_layout()
ex.finish(fig, "events_and_bayes")
