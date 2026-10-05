"""Числовые примитивы с фиксированным порядком операций.

``numpy.sum`` и ``numpy.quantile`` используют попарное суммирование и особую
формулу интерполяции — результат может отличаться от JavaScript в последнем
знаке. Для точного совпадения с веб-движком курса здесь собраны функции,
которые считают *последовательно*, в точности как циклы в
``shared/web/js/engine/*.js``.
"""

from __future__ import annotations

import math

import numpy as np


def seq_sum(a) -> float:
    """Последовательная сумма слева направо (как цикл ``s += a[i]``)."""
    a = np.asarray(a, dtype=float).ravel()
    if a.size == 0:
        return 0.0
    return float(np.cumsum(a)[-1])


def seq_mean(a) -> float:
    """Среднее через последовательную сумму."""
    a = np.asarray(a, dtype=float).ravel()
    if a.size == 0:
        return 0.0
    return seq_sum(a) / a.size


def quantile(a, alpha: float) -> float:
    """Квантиль с линейной интерполяцией: позиция ``alpha·(n−1)`` в отсортированном массиве.

    Совпадает с ``numpy.quantile(a, alpha)`` по смыслу (метод ``linear``),
    но использует ровно одну формулу ``v[lo] + frac·(v[hi] − v[lo])`` — как в JS.
    """
    v = np.sort(np.asarray(a, dtype=float).ravel())
    n = v.size
    if n == 0:
        return 0.0
    pos = alpha * (n - 1)
    lo = int(math.floor(pos))
    hi = min(lo + 1, n - 1)
    frac = pos - lo
    return float(v[lo] + frac * (v[hi] - v[lo]))


def median(a) -> float:
    """Медиана (для чётного n — среднее двух центральных значений)."""
    v = np.sort(np.asarray(a, dtype=float).ravel())
    n = v.size
    if n == 0:
        return 0.0
    mid = n // 2
    if n % 2 == 1:
        return float(v[mid])
    return float((v[mid - 1] + v[mid]) / 2.0)


def sigmoid(z):
    """Численно устойчивая сигмоида σ(z) = 1 / (1 + e^(−z))."""
    z = np.asarray(z, dtype=float)
    out = np.empty_like(z)
    pos = z >= 0
    out[pos] = 1.0 / (1.0 + np.exp(-z[pos]))
    ez = np.exp(z[~pos])
    out[~pos] = ez / (1.0 + ez)
    return out


def softmax(F):
    """Построчный softmax для матрицы сырых оценок формы (n, K)."""
    F = np.asarray(F, dtype=float)
    m = F.max(axis=1, keepdims=True)
    e = np.exp(F - m)
    return e / e.sum(axis=1, keepdims=True)
