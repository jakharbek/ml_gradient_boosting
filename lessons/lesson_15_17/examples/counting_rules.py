"""Правила подсчёта: сумма, произведение, случаи, дополнение, деление — и правило произведения в бустинге.

Запуск:  python lessons/lesson_15_17/examples/counting_rules.py [--save] [--no-show]

1) Каждый пример урока (шаги 1–5) — формулой и перебором itertools.
2) Сетка гиперпараметров: рост числа обучений по мере добавления параметров.
3) Кандидаты в разбиения по уровням дерева: точный перебор p(n − 2ˡ) против гистограмм 2ˡ·p·(B − 1).
"""

import math
import sys
from itertools import permutations, product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE, RED

ex = Example(__file__)

# 1. Примеры урока: формула против перебора
checks = []
distinct = [n for n in range(100, 1000) if len(set(str(n))) == 3]
checks.append(("трёхзначные с разными цифрами", 9 * 9 * 8, len(distinct)))
checks.append(("…из них чётных (случаи по последней цифре)", 9 * 8 + 4 * 8 * 8, sum(n % 2 == 0 for n in distinct)))
checks.append(("кратные 2 или 3 до 100", 50 + 33 - 16, sum(i % 2 == 0 or i % 3 == 0 for i in range(1, 101))))
pins = list(product(range(10), repeat=4))
checks.append(("PIN с семёркой (дополнение)", 10**4 - 9**4, sum(7 in p for p in pins)))
checks.append(("PIN с повтором (дополнение)", 10**4 - math.perm(10, 4), sum(len(set(p)) < 4 for p in pins)))
checks.append(("подмножества 5 элементов (биекция)", 2**5, len(list(product((0, 1), repeat=5)))))
checks.append(("делители 360 (биекция)", 4 * 3 * 2, sum(360 % d == 0 for d in range(1, 361))))
canon = lambda s: min(s[i:] + s[:i] for i in range(len(s)))
checks.append(("рассадки 6 человек за круглым столом", math.factorial(5), len({canon(p) for p in permutations(range(6))})))
pairings = {frozenset(frozenset(p[i:i + 2]) for i in range(0, 6, 2)) for p in permutations(range(6))}
checks.append(("6 человек на пары (деление на 2!³·3!)", math.factorial(6) // (8 * 6), len(pairings)))
for name, formula, brute in checks:
    print(f"{name:45s} формула {formula:6d}   перебор {brute:6d}")
    assert formula == brute

# 2. Сетка гиперпараметров
values = {"learning_rate": 4, "max_depth": 4, "n_estimators": 3, "subsample": 3, "colsample": 3}
cum = np.cumprod(list(values.values()))
print("\nсетка:", " → ".join(map(str, cum)), "комбинаций; × 5 фолдов =", cum[-1] * 5, "обучений")
assert cum[3] * 5 == 720

# 3. Кандидаты в разбиения
p, B = 100, 256


def per_level(n, depth=10):
    out = []
    for lev in range(depth):
        if n // 2**lev < 2:
            break
        out.append((lev, p * (n - 2**lev), 2**lev * p * min(n // 2**lev - 1, B - 1)))
    return out


lv = per_level(10**6, 6)
exact, hist = sum(e for _, e, _ in lv), sum(h for _, _, h in lv)
print(f"n = 10⁶, p = 100, глубина 6: точно {exact:.3g}, гистограммы {hist:,} (в {exact / hist:.0f} раз меньше)")
assert round(exact / hist) == 373

fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
axes[0].plot(range(1, 6), cum, "o-", color=BLUE)
axes[0].plot(6, cum[-1] * 5, "o", color=ORANGE)
axes[0].set(yscale="log", xticks=range(1, 7), xticklabels=["lr", "depth", "trees", "subs.", "cols.", "×5 фолдов"], ylabel="вариантов", title="Сетка: каждый параметр умножает")
for n, ce, ch in ((10**4, MUTED, RED), (10**6, BLUE, ORANGE)):
    lv = per_level(n)
    axes[1].plot([lev for lev, _, _ in lv], [e for _, e, _ in lv], "o-", color=ce, label=f"точно, n = 10^{round(math.log10(n))}")
    axes[1].plot([lev for lev, _, _ in lv], [h for _, _, h in lv], "s--", color=ch, label=f"гистограмма, n = 10^{round(math.log10(n))}")
axes[1].set(yscale="log", xlabel="уровень дерева l", ylabel="порогов на уровне", title="Кандидаты в разбиения (p = 100, B = 256)")
axes[1].legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "counting_rules")
