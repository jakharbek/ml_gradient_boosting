"""Сжатие: неравенство Крафта, коды Шеннона и Хаффмана, блочное кодирование, типичные последовательности, текст.

Запуск:  python lessons/lesson_15_16/examples/coding_and_compression.py [--save] [--no-show]

1) Длины кодов: идеал −log₂ p, код Шеннона ⌈−log₂ p⌉, код Хаффмана; проверка H ≤ L < H + 1 на 500 случайных распределениях.
2) Блочное кодирование нечестной монеты: L_n / n → H.
3) Типичные последовательности: −(1/n) log₂ P собирается у H с ростом n.
4) Текст: энтропия по частотам и по предыдущему символу, сравнение с zlib и lzma.
"""

import heapq
import lzma
import math
import sys
import zlib
from collections import Counter
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy.stats import binom

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)


def H(p):
    p = np.asarray(p, float)
    p = p[p > 0]
    return float(-(p * np.log2(p)).sum())


def huffman_lengths(ps):
    heap = [(p, i, [i]) for i, p in enumerate(ps)]
    heapq.heapify(heap)
    L, nxt = [0] * len(ps), len(ps)
    while len(heap) > 1:
        p1, _, s1 = heapq.heappop(heap)
        p2, _, s2 = heapq.heappop(heap)
        for s in s1 + s2:
            L[s] += 1
        heapq.heappush(heap, (p1 + p2, nxt, s1 + s2))
        nxt += 1
    return L


# 1. Границы Шеннона на случайных распределениях
rng = Mulberry32(16)
worst_gap = 0.0
for _ in range(500):
    k = 2 + rng.randint(9)
    w = np.array([rng.random() ** 3 + 1e-6 for _ in range(k)])
    p = w / w.sum()
    Ls = (p * np.ceil(-np.log2(p) - 1e-12)).sum()
    Lh = (p * np.array(huffman_lengths(list(p)))).sum()
    assert H(p) - 1e-12 <= Lh <= Ls < H(p) + 1
    assert sum(2.0 ** -ln for ln in huffman_lengths(list(p))) <= 1 + 1e-12   # неравенство Крафта
    worst_gap = max(worst_gap, Lh - H(p))
print(f"500 случайных распределений: H ≤ L_Хаффман ≤ L_Шеннон < H + 1 всегда; наибольший избыток Хаффмана {worst_gap:.3f} бита")

# 2. Блочное кодирование
p1 = 0.1
ns = list(range(1, 11))
rates = []
for n in ns:
    probs = [p1 ** sum(b) * (1 - p1) ** (n - sum(b)) for b in product((0, 1), repeat=n)]
    rates.append(sum(q * ln for q, ln in zip(probs, huffman_lengths(probs))) / n)
Hm = -p1 * math.log2(p1) - (1 - p1) * math.log2(1 - p1)
print("L_n / n:", np.round(rates, 4), " H =", round(Hm, 4))
assert all(Hm - 1e-12 <= r < Hm + 1 / n for r, n in zip(rates, ns))

# 3. Типичные последовательности
share = {}
for n in (20, 100, 500):
    k = np.arange(n + 1)
    v = -(k * np.log2(p1) + (n - k) * np.log2(1 - p1)) / n
    share[n] = binom.pmf(k[np.abs(v - Hm) <= 0.05], n, p1).sum()
    print(f"n = {n:3d}: P(|−(1/n)log2 P − H| ≤ 0.05) = {share[n]:.3f}")
assert share[20] < share[100] < share[500]

# 4. Текст
text = ("Градиентный бустинг строит модель шаг за шагом. Каждое новое дерево исправляет ошибки предыдущих, и прогноз "
        "становится всё точнее. Теория информации объясняет, почему для классификации мы минимизируем именно log-loss: "
        "это средняя неожиданность правильных ответов для модели. ") * 6
t = text.lower()
n = len(t)
cnt = Counter(t)
H0 = H([c / n for c in cnt.values()])
pairs, prev = Counter(zip(t, t[1:])), Counter(t[:-1])
H1 = -sum(c / (n - 1) * math.log2(c / prev[a]) for (a, _), c in pairs.items())
z = 8 * len(zlib.compress(t.encode(), 9)) / n
x = 8 * len(lzma.compress(t.encode())) / n
print(f"текст ×6 ({n} символов): H0 = {H0:.2f}, H1 = {H1:.2f}, zlib {z:.2f}, lzma {x:.2f} бит/символ")
print("повторы текста архиватор «видит» через длинный контекст — поэтому он сжимает лучше H0 и даже H1")
assert z < H1 < H0

fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))
ax = axes[0]
p = np.array([0.4, 0.3, 0.2, 0.1])
xs = np.arange(4)
ax.bar(xs - 0.2, np.ceil(-np.log2(p)), width=0.38, color=MUTED, label="Шеннон ⌈−log₂ p⌉")
ax.bar(xs + 0.2, huffman_lengths(list(p)), width=0.38, color=BLUE, label="Хаффман")
ax.plot(xs, -np.log2(p), "o", color=ORANGE, label="идеал −log₂ p")
ax.set(xticks=xs, xticklabels=list("ABCD"), ylabel="длина, бит", title="Длины кодов для 0.4, 0.3, 0.2, 0.1")
ax.legend(fontsize=8)

ax = axes[1]
ax.plot(ns, rates, "o-", color=BLUE, label="Хаффман блоками")
ax.plot(ns, [Hm + 1 / n for n in ns], "--", color=MUTED, label="H + 1/n")
ax.axhline(Hm, color=ORANGE, label="H")
ax.set(xlabel="длина блока n", ylabel="бит на символ", title="p = 0.1: блоки приближают L к H")
ax.legend()

ax = axes[2]
for n, col in ((20, MUTED), (100, ORANGE), (500, BLUE)):
    k = np.arange(n + 1)
    v = -(k * np.log2(p1) + (n - k) * np.log2(1 - p1)) / n
    ax.plot(v, binom.pmf(k, n, p1) * n, "-", color=col, label=f"n = {n}")
ax.axvline(Hm, color="k", ls="--", lw=1)
ax.set(xlim=(0, 1.2), xlabel="−(1/n) log₂ P(последовательности)", ylabel="плотность (масштаб ×n)", title="Типичные последовательности")
ax.legend()

ex.finish(fig, "coding_and_compression")
