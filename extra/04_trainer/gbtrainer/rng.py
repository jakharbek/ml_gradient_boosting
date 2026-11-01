"""Mulberry32 — тот же генератор, что ``gbcourse.rng`` и ``GBC.RNG`` в браузере.

Пакет тренажёров самостоятельный (его целиком загружает веб-страница в Pyodide), поэтому
алгоритм продублирован здесь; ``tests/python/test_trainer.py`` сверяет поток чисел с
``gbcourse.rng.Mulberry32``. Один и тот же ``seed`` даёт одну и ту же тетрадь в командной
строке и на странице.
"""

from __future__ import annotations

from collections.abc import MutableSequence, Sequence
from typing import TypeVar

T = TypeVar("T")
_MASK32 = 0xFFFFFFFF


def _imul(a: int, b: int) -> int:
    return (a * b) & _MASK32


class Mulberry32:
    """Детерминированный ГПСЧ с 32-битным состоянием."""

    def __init__(self, seed: int = 0) -> None:
        self.state = int(seed) & _MASK32

    def next_uint32(self) -> int:
        self.state = (self.state + 0x6D2B79F5) & _MASK32
        a = self.state
        t = _imul(a ^ (a >> 15), 1 | a)
        t = ((t + _imul(t ^ (t >> 7), 61 | t)) & _MASK32) ^ t
        return (t ^ (t >> 14)) & _MASK32

    def random(self) -> float:
        """Равномерное число из [0, 1)."""
        return self.next_uint32() / 4294967296.0

    def randint(self, n: int) -> int:
        """Целое из [0, n)."""
        return int(self.random() * n)

    def shuffle(self, items: MutableSequence[T]) -> MutableSequence[T]:
        """Перемешивание Фишера — Йетса на месте (порядок вызовов как в gbcourse)."""
        for i in range(len(items) - 1, 0, -1):
            j = self.randint(i + 1)
            items[i], items[j] = items[j], items[i]
        return items

    def choice(self, items: Sequence[T]) -> T:
        return items[self.randint(len(items))]

    def grid(self, lo: int, hi: int, step: int) -> int:
        """Случайное значение из сетки lo, lo+step, …, ≤ hi."""
        return lo + step * self.randint((hi - lo) // step + 1)
