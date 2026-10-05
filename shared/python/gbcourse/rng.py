"""Детерминированный генератор случайных чисел Mulberry32.

Зачем свой генератор, если есть ``numpy.random``?
Веб-страницы курса строят те же данные и те же модели прямо в браузере (JavaScript).
Чтобы эксперимент из браузера один-в-один воспроизводился в Jupyter, обе стороны
используют один и тот же алгоритм Mulberry32 с одинаковым порядком вызовов.
Реализация на JS: ``shared/web/js/engine/rng.js`` — поведение побитово совпадает.

Пример
------
>>> rng = Mulberry32(42)
>>> round(rng.random(), 6)
0.601104
"""

from __future__ import annotations

import math
from collections.abc import MutableSequence
from typing import TypeVar

T = TypeVar("T")

_MASK32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    """32-битное умножение как ``Math.imul`` в JavaScript (младшие 32 бита произведения)."""
    return (a * b) & _MASK32


class Mulberry32:
    """Маленький быстрый ГПСЧ с 32-битным состоянием (алгоритм Mulberry32).

    Все методы вызывают :meth:`random` в строго определённом порядке —
    это контракт совместимости с JS-версией. Не меняйте порядок вызовов.
    """

    def __init__(self, seed: int = 0) -> None:
        self.state = int(seed) & _MASK32

    # --- базовый поток -------------------------------------------------------------
    def next_uint32(self) -> int:
        """Следующее 32-битное беззнаковое целое."""
        self.state = (self.state + 0x6D2B79F5) & _MASK32
        a = self.state
        t = _imul(a ^ (a >> 15), 1 | a)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & _MASK32) ^ t
        return (t ^ (t >> 14)) & _MASK32

    def random(self) -> float:
        """Равномерное число из полуинтервала [0, 1)."""
        return self.next_uint32() / 4294967296.0

    # --- производные распределения -----------------------------------------------
    def uniform(self, low: float = 0.0, high: float = 1.0) -> float:
        """Равномерное число из [low, high)."""
        return low + (high - low) * self.random()

    def normal(self, mean: float = 0.0, std: float = 1.0) -> float:
        """Нормальное число (преобразование Бокса — Мюллера, одна пара равномерных на выборку)."""
        u1 = 1.0 - self.random()  # (0, 1] — защищает от log(0)
        u2 = self.random()
        z = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
        return mean + std * z

    def randint(self, n: int) -> int:
        """Целое из [0, n)."""
        return int(self.random() * n)

    # --- операции над последовательностями ----------------------------------------
    def shuffle(self, items: MutableSequence[T]) -> MutableSequence[T]:
        """Перемешивание Фишера — Йетса на месте (идём с конца)."""
        for i in range(len(items) - 1, 0, -1):
            j = self.randint(i + 1)
            items[i], items[j] = items[j], items[i]
        return items

    def permutation(self, n: int) -> list[int]:
        """Случайная перестановка чисел 0..n-1."""
        return list(self.shuffle(list(range(n))))

    def sample(self, n: int, k: int) -> list[int]:
        """k различных индексов из range(n) (частичный Фишер — Йетс), в порядке выбора."""
        k = max(0, min(k, n))
        pool = list(range(n))
        for i in range(k):
            j = i + self.randint(n - i)
            pool[i], pool[j] = pool[j], pool[i]
        return pool[:k]

    def bootstrap(self, n: int) -> list[int]:
        """n индексов с возвращением (бутстрэп-выборка)."""
        return [self.randint(n) for _ in range(n)]


def as_rng(seed_or_rng: int | Mulberry32 | None) -> Mulberry32:
    """Принимает зерно или готовый генератор и возвращает генератор."""
    if isinstance(seed_or_rng, Mulberry32):
        return seed_or_rng
    return Mulberry32(0 if seed_or_rng is None else seed_or_rng)
