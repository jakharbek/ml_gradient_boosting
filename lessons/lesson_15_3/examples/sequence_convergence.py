"""Скорость сходимости: сколько членов нужно, чтобы войти в коридор ε.

Пять последовательностей с пределом 0 — 1/√n, 1/n, 1/n², 1/2ⁿ, 1/n! — и номер N(ε), начиная с
которого все члены в коридоре. Формулы из доказательств по ε–N сверяются с перебором. Слева —
сами последовательности на логарифмической шкале, справа — «цена точности» N(ε).

Запуск:  python lessons/lesson_15_3/examples/sequence_convergence.py [--save] [--no-show]
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MAGENTA, ORANGE, VIOLET

ex = Example(__file__)


def smallest_n(dev, eps: float, guess: float) -> int:
    """Наименьший номер n с dev(n) < eps для убывающего отклонения (уточняем около оценки guess)."""
    n = max(1, math.floor(guess) + 1)
    if n > 1e15:
        return n
    while n > 1 and dev(n - 1) < eps:
        n -= 1
    while not dev(n) < eps:
        n += 1
    return n


SEQS = {
    "1/√n": (lambda n: 1 / math.sqrt(n), lambda e: 1 / e**2, VIOLET),
    "1/n": (lambda n: 1 / n, lambda e: 1 / e, BLUE),
    "1/n²": (lambda n: 1 / n**2, lambda e: 1 / math.sqrt(e), AQUA),
    "1/2ⁿ": (lambda n: 0.5**n, lambda e: math.log2(1 / e), ORANGE),
    "1/n!": (lambda n: 1 / math.factorial(n), lambda e: 1, MAGENTA),
}

print("Номер N(ε) — первый член в коридоре (дальше отклонение только убывает):")
eps_list = [1e-2, 1e-4, 1e-6, 1e-9]
table = {}
for name, (a, guess, _) in SEQS.items():
    table[name] = [smallest_n(a, e, guess(e)) for e in eps_list]
    shown = [f"{N:,}" if N < 1e15 else f"≈{N:.0e}" for N in table[name]]   # огромные N — в экспоненте
    print(f"  {name:5}", "  ".join(f"ε = {e:.0e}: {t:>17}" for e, t in zip(eps_list, shown)))

# формулы из ε–N совпадают с перебором там, где перебор возможен
for name in ("1/n", "1/n²", "1/2ⁿ"):
    a = SEQS[name][0]
    for e in (1e-2, 1e-4):
        brute = next(n for n in range(1, 10**6) if all(a(m) < e for m in range(n, n + 50)))
        assert brute == table[name][eps_list.index(e)], (name, e)
assert table["1/√n"][2] == 10**12 + 1 and table["1/n"][2] == 10**6 + 1
assert table["1/n²"][2] == 1001 and table["1/2ⁿ"][2] == 20 and table["1/n!"][2] == 10
print("\nПроверено: формулы N(ε) совпадают с перебором; при ε = 1e−6 нужно 10¹² + 1, 10⁶ + 1, 1001, 20 и 10 членов.")

# линейная сходимость: у 1/2ⁿ каждые 10 членов дают одинаковое число знаков
digits = [-math.log10(0.5**n) for n in (10, 20, 30)]
print(f"1/2ⁿ: верных знаков после 10, 20, 30 членов: {digits[0]:.2f}, {digits[1]:.2f}, {digits[2]:.2f} — по 3.01 за 10 шагов")
assert abs((digits[1] - digits[0]) - (digits[2] - digits[1])) < 1e-9

fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4))
n = np.arange(1, 61)
eg = np.logspace(-1, -9, 40)
for name, (a, guess, col) in SEQS.items():
    v = np.array([a(int(k)) for k in n])
    a1.semilogy(n, np.where(v > 1e-17, v, np.nan), lw=2.2, color=col, label=name)
    a2.loglog(1 / eg, [smallest_n(a, e, guess(e)) for e in eg], lw=2.2, color=col, label=name)
a1.axhline(1e-6, color="gray", ls="--", lw=1)
a1.set(xlabel="n", ylabel="|aₙ − 0|", ylim=(1e-16, 2), title="Последовательности (лог. шкала)")
a2.set(xlabel="требуемая точность 1/ε", ylabel="номер N(ε)", title="Цена точности")
a1.legend()
a2.legend()
plt.tight_layout()
ex.finish(fig, "sequence_convergence")
