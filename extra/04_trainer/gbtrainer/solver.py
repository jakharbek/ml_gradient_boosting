"""Эталонный расчёт тетради — ровно так, как его ведёт ученик.

Протокол ручного счёта (он же написан на листе «Задание»):

* каждое вписанное число округляется до сотых (как ``ROUND(x; 2)`` в Excel — половина
  от нуля), а дальше считается уже округлённое число;
* выбирается колонка с меньшей суммой остатков ошибки; при равенстве — левая;
* старое предсказание следующего шага — новое предсказание этого шага.

Так ключ совпадает с тем, что получит аккуратный ученик, до копейки на всех 20 шагах — а
не только на первых, пока числа делятся без остатка.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .model import Dataset, Group

CENT = Decimal("0.01")
NEAR_TIE = Decimal("0.05")  # суммы ближе этого — ученик с другим округлением может выбрать иначе


def r2(v: Decimal) -> Decimal:
    """Округление до сотых, как ROUND(x; 2) в Excel."""
    return v.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class GroupResult:
    group: Group
    sum_r: Decimal
    gamma: Decimal
    sse: Decimal


@dataclass(frozen=True)
class StepResult:
    m: int
    f_prev: tuple[Decimal, ...]
    grad: tuple[Decimal, ...]  # ∂L/∂Fᵢ = F − y
    r: tuple[Decimal, ...]  # rᵢ = y − F
    abs_r: Decimal  # Σ|rᵢ| до шага
    groups: tuple[GroupResult, ...]
    totals: tuple[Decimal, ...]  # по признакам: сумма остатков ошибки двух групп
    choice: int  # индекс выбранного признака
    tie: bool  # точное равенство минимальных сумм (сработало правило «левая»)
    near_tie: bool  # суммы различаются меньше чем на NEAR_TIE
    h: tuple[Decimal, ...]
    step: tuple[Decimal, ...]  # ν·h
    f_new: tuple[Decimal, ...]
    r_new: tuple[Decimal, ...]
    abs_r_new: Decimal


@dataclass(frozen=True)
class Solution:
    f0: Decimal
    abs_r0: Decimal
    steps: tuple[StepResult, ...]

    @property
    def final_abs(self) -> Decimal:
        return self.steps[-1].abs_r_new if self.steps else self.abs_r0

    def near_ties(self) -> list[int]:
        return [s.m for s in self.steps if s.near_tie and not s.tie]

    def ties(self) -> list[int]:
        return [s.m for s in self.steps if s.tie]


def solve(ds: Dataset, lr: Decimal, steps: int) -> Solution:
    n = ds.n
    y = ds.y
    groups = ds.groups()
    f0 = r2(sum(y, Decimal(0)) / n)
    f = tuple(f0 for _ in range(n))
    abs_r0 = sum((abs(v - f0) for v in y), Decimal(0))
    out: list[StepResult] = []
    for m in range(1, steps + 1):
        grad = tuple(f[i] - y[i] for i in range(n))
        r = tuple(y[i] - f[i] for i in range(n))
        abs_r = sum((abs(v) for v in r), Decimal(0))
        gres = []
        for g in groups:
            s = sum((r[i] for i in g.members), Decimal(0))
            gamma = r2(s / len(g.members))
            sse = r2(sum(((r[i] - gamma) ** 2 for i in g.members), Decimal(0)))
            gres.append(GroupResult(g, s, gamma, sse))
        totals = tuple(sum((gr.sse for gr in gres if gr.group.feature == j), Decimal(0)) for j in range(ds.k))
        best = min(totals)
        choice = totals.index(best)  # при равенстве — левая колонка
        others = [t for j, t in enumerate(totals) if j != choice]
        tie = any(t == best for t in others)
        near = any(t - best < NEAR_TIE for t in others)
        gamma_of = {}
        for gr in gres:
            if gr.group.feature == choice:
                for i in gr.group.members:
                    gamma_of[i] = gr.gamma
        h = tuple(gamma_of[i] for i in range(n))
        stp = tuple(r2(lr * h[i]) for i in range(n))
        f_new = tuple(f[i] + stp[i] for i in range(n))
        r_new = tuple(y[i] - f_new[i] for i in range(n))
        abs_new = sum((abs(v) for v in r_new), Decimal(0))
        out.append(StepResult(m, f, grad, r, abs_r, tuple(gres), totals, choice, tie, near, h, stp, f_new, r_new, abs_new))
        f = f_new
    return Solution(f0, abs_r0, tuple(out))
