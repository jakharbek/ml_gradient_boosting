"""Игра ε–δ численно: наибольшее δ против формулы из доказательства.

Для четырёх пределов (3x − 1 → 5, x² → 4, 1/x → 1/2, √x → 2) перебором находим наибольшее δ*,
при котором |f(x) − L| < ε во всей проколотой окрестности, и проверяем, что формула δ(ε) из
доказательства никогда его не превышает. Для ступеньки подходящего δ нет — предела нет.

Запуск:  python lessons/lesson_15_3/examples/epsilon_delta_check.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, ORANGE, VIOLET

ex = Example(__file__)


def best_delta(f, a: float, L: float, eps: float, d_max: float = 4.0):
    """Наибольшее δ ≤ d_max с |f(x) − L| < ε при 0 < |x − a| < δ (проверка по сетке); None — нет такого."""
    def ok(d: float) -> bool:
        x = np.linspace(a - d, a + d, 20001)
        x = x[x != a]
        with np.errstate(all="ignore"):
            return bool(np.all(np.abs(f(x) - L) < eps))

    if ok(d_max):
        return d_max
    if not ok(1e-9):
        return None
    lo, hi = 0.0, d_max
    for _ in range(50):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if ok(mid) else (lo, mid)
    return lo


TASKS = {
    "3x − 1 → 5, x → 2": (lambda x: 3 * x - 1, 2, 5, lambda e: e / 3, BLUE),
    "x² → 4, x → 2": (lambda x: x**2, 2, 4, lambda e: min(1, e / 5), ORANGE),
    "1/x → 1/2, x → 2": (lambda x: 1 / x, 2, 0.5, lambda e: min(1, 2 * e), AQUA),
    "√x → 2, x → 4": (np.sqrt, 4, 2, lambda e: min(4, 2 * e), VIOLET),
}
eps_grid = np.logspace(-3, 0, 16)
fig, ax = plt.subplots(figsize=(8, 4.5))
for name, (f, a, L, formula, col) in TASKS.items():
    best = np.array([best_delta(f, a, L, e) for e in eps_grid])
    form = np.array([formula(e) for e in eps_grid])
    assert np.all(form <= best * (1 + 1e-6)), name         # формула всегда выигрывает
    print(f"{name:18} ε = 0.01: δ* = {best_delta(f, a, L, 0.01):.5f}, формула δ = {formula(0.01):.5f}, "
          f"запас ×{best_delta(f, a, L, 0.01) / formula(0.01):.2f}")
    ax.loglog(eps_grid, best, color=col, lw=2.4, label=name + ": δ* (перебор)")
    ax.loglog(eps_grid, form, color=col, lw=1.4, ls="--")

step = lambda x: (x >= 0) * 1.0  # noqa: E731
for eps in (0.6, 0.5, 0.4):
    print(f"ступенька, L = 0.5, ε = {eps}: δ* = {best_delta(step, 0, 0.5, eps)}")
assert best_delta(step, 0, 0.5, 0.4) is None and best_delta(step, 0, 0.5, 0.6) is not None
print("Итог: для ступеньки при ε ≤ 0.5 соперник выигрывает — предела нет.")

ax.set(xlabel="допуск ε", ylabel="δ", title="Наибольшее δ* (сплошные) и формулы из доказательств (пунктир)")
ax.legend(fontsize=8)
plt.tight_layout()
ex.finish(fig, "epsilon_delta_check")
