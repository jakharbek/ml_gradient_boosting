"""Непрерывность: виды разрывов, доопределение, деление пополам и теорема Вейерштрасса.

Устранимый разрыв, скачок, бесконечный и колебательный разрывы; доопределение sinc и 0·ln 0 = 0 (сверка
с NumPy/SciPy); деление пополам со сверкой со scipy.optimize.bisect и ловушкой полюса; log-loss без минимума
и минимум, возвращённый штрафом λw²/2.

Запуск:  python lessons/lesson_15_4/examples/continuity_theorems.py [--save] [--no-show]
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import optimize, special

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE

ex = Example(__file__)

kinds = {"(x² − 1)/(x − 1) в 1": (lambda x: (x**2 - 1) / (x - 1), 1), "[x ≥ 0] в 0": (lambda x: float(x >= 0), 0),
         "1/x² в 0": (lambda x: 1 / x**2, 0), "sin(1/x) в 0": (lambda x: math.sin(1 / x), 0)}
for name, (f, a) in kinds.items():
    print(f"{name:20}: слева {f(a - 1e-4):10.4g}, справа {f(a + 1e-4):10.4g}")
print("np.sinc(0) =", np.sinc(0.0), "| xlogy(0, 0) =", special.xlogy(0.0, 0.0), "| p ln p при p = 1e−9:", 1e-9 * math.log(1e-9))
assert np.sinc(0.0) == 1.0 and special.xlogy(0.0, 0.0) == 0.0


def bisect(f, lo, hi, tol=1e-12):
    k = 0
    while hi - lo > tol:
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if f(lo) * f(mid) > 0 else (lo, mid)
        k += 1
    return (lo + hi) / 2, k


for name, f, lo, hi in [("x³ − 2", lambda x: x**3 - 2, 1.0, 2.0), ("cos x − x", lambda x: math.cos(x) - x, 0.0, 1.0)]:
    r, k = bisect(f, lo, hi)
    print(f"{name:10}: корень {r:.12f} за {k} шагов, scipy: {optimize.bisect(f, lo, hi, xtol=1e-12):.12f}")
    assert abs(r - optimize.bisect(f, lo, hi, xtol=1e-12)) < 1e-10
pole, _ = bisect(lambda x: 1 / (x - 0.6), 0.0, 1.0)
print(f"1/(x − 0.6): «корень» {pole:.8f}, но f там {1 / (pole - 0.6):.3g} — функция разрывна, теорема не работает")
assert abs(pole - 0.6) < 1e-9

wstar = {}
for lam in (0.1, 0.01, 0.001):
    res = optimize.minimize_scalar(lambda w, lam=lam: np.logaddexp(0, -w) + lam * w * w / 2, bounds=(-5, 100), method="bounded")
    wstar[lam] = res.x
    print(f"λ = {lam}: минимум ln(1 + e⁻ʷ) + λw²/2 в w* = {res.x:.4f}")
print("λ = 0: потери при w = 10, 20, 40:", [f"{np.logaddexp(0, -w):.2e}" for w in (10, 20, 40)], "— убывают к 0, минимума нет")
assert wstar[0.1] < wstar[0.01] < wstar[0.001] and abs(wstar[0.1] - 1.6335) < 1e-3

fig, axes = plt.subplots(1, 3, figsize=(15, 4))
x = np.linspace(-0.4, 0.4, 40001)
x = x[x != 0]
axes[0].plot(x, np.sin(1 / x), color=MUTED, lw=0.5, label="sin(1/x) — колебательный")
axes[0].plot(x, x * np.sin(1 / x), color=BLUE, lw=1.4, label="x sin(1/x) — непрерывна (f(0) = 0)")
axes[0].legend(fontsize=8, loc="upper right", framealpha=0.95)
axes[0].set(title="разрыв или нет", xlabel="x")
x = np.linspace(0.9, 2.1, 400)
axes[1].plot(x, x**3 - 2, color=BLUE, lw=2.2)
lo, hi = 1.0, 2.0
for k in range(5):
    axes[1].plot([lo, hi], [-1.5 - 0.35 * k] * 2, color=ORANGE, lw=4, solid_capstyle="butt")
    mid = (lo + hi) / 2
    lo, hi = (mid, hi) if mid**3 - 2 < 0 else (lo, mid)
axes[1].axhline(0, color=MUTED, lw=1)
axes[1].set(title="деление пополам: отрезки шагов 0–4", xlabel="x")
w = np.linspace(-2, 12, 400)
axes[2].plot(w, np.logaddexp(0, -w), color=MUTED, ls="--", lw=2, label="λ = 0")
for lam, c in zip((0.1, 0.01), (BLUE, AQUA)):
    axes[2].plot(w, np.logaddexp(0, -w) + lam * w**2 / 2, color=c, lw=2.2, label=f"λ = {lam}")
    axes[2].plot([wstar[lam]], [np.logaddexp(0, -wstar[lam]) + lam * wstar[lam] ** 2 / 2], "o", color=c)
axes[2].set(title="Вейерштрасс: штраф возвращает минимум", xlabel="w", ylim=(-0.05, 2.2))
axes[2].legend(fontsize=8)
plt.tight_layout()
ex.finish(fig, "continuity_theorems")
