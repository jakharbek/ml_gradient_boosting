"""Метод Ньютона против градиентного спуска: квадратичная сходимость, поломки и ремонт.

Запуск:  python lessons/lesson_15_7/examples/newton_vs_gradient.py [--save] [--no-show]

1) eˣ − 2x со старта 2: ошибка Ньютона возводится в квадрат (eₖ/eₖ₋₁² → f‴/(2f″) = ½), ошибка спуска
умножается на постоянное число. 2) Метод касательных для √2. 3) √(1 + x²) из 1.5: чистый Ньютон
разлетается, обрезка шага, сдвиг λ и демпфирование η его спасают — по-разному быстро.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, ORANGE, RED, VIOLET

ex = Example(__file__)

f = lambda x: math.exp(x) - 2 * x  # noqa: E731
d1 = lambda x: math.exp(x) - 2     # noqa: E731
d2 = math.exp
opt = math.log(2)

# 1. Ньютон против спуска
xn, xg = 2.0, 2.0
err_n, err_g, path_n, path_g = [], [], [xn], [xg]
for _ in range(12):
    err_n.append(max(abs(xn - opt), 1e-16))
    err_g.append(abs(xg - opt))
    xn -= d1(xn) / d2(xn)
    xg -= 0.3 * d1(xg)
    path_n.append(xn)
    path_g.append(xg)
for k in range(6):
    ratio = err_n[k] / err_n[k - 1] ** 2 if k else float("nan")
    print(f"шаг {k}: Ньютон {err_n[k]:.2e} (eₖ/eₖ₋₁² = {ratio:.3f}), спуск {err_g[k]:.2e}")
assert err_n[5] < 1e-9 < err_g[5]
assert abs(err_n[5] / err_n[4] ** 2 - 0.5) < 0.01   # C = f‴/(2f″) = ½
assert abs(err_g[11] / err_g[10] - 0.4) < 0.01       # |1 − η·f″(x*)| = |1 − 0.3·2| = 0.4

# 2. Метод касательных: √2
x = 1.0
errs = []
for _ in range(5):
    errs.append(abs(x - math.sqrt(2)))
    x = (x + 2 / x) / 2
print("√2 (метод Герона), ошибки:", " ".join(f"{e:.1e}" for e in errs))
assert errs[4] < 1e-11


# 3. Поломка и ремонт
def run(x, eta=1.0, lam=0.0, clip=0.0, steps=8):
    out = [x]
    for _ in range(steps):
        g, h = x / math.sqrt(1 + x * x), (1 + x * x) ** -1.5
        st = -g / (h + lam)
        if clip:
            st = max(-clip, min(clip, st))
        x += eta * st
        out.append(x)
        if abs(x) > 1e6:
            break
    return out


runs = {"без ремонта": run(1.5, steps=3), "обрезка |Δ| ≤ 1": run(1.5, clip=1), "λ = 1": run(1.5, lam=1), "η = 0.3": run(1.5, eta=0.3)}
for name, tr in runs.items():
    print(f"√(1 + x²) из 1.5, {name:16}: {' '.join(f'{v:.4g}' for v in tr[:6])}")
assert abs(runs["без ремонта"][-1]) > 1e4
assert abs(runs["обрезка |Δ| ≤ 1"][5]) < 1e-12 and abs(runs["λ = 1"][8]) > 1e-3

fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(16.5, 4.4))
xs = np.linspace(-1, 2.6, 300)
a1.plot(xs, np.exp(xs) - 2 * xs, color=BLUE, lw=2.2)
a1.plot(path_g[:8], [f(v) for v in path_g[:8]], "o-", color=AQUA, ms=4, label="спуск η = 0.3")
a1.plot(path_n[:6], [f(v) for v in path_n[:6]], "s--", color=VIOLET, ms=5, mfc="white", label="Ньютон")
a1.set(title="f(x) = eˣ − 2x", xlabel="x")
a1.legend()
a2.semilogy(err_g, "o-", color=AQUA, label="спуск: линейно")
a2.semilogy(err_n, "s-", color=VIOLET, label="Ньютон: квадратично")
a2.set(title="ошибка |xₖ − x*|", xlabel="шаг k", ylim=(1e-16, 10))
a2.legend()
for (name, tr), col in zip(runs.items(), [RED, ORANGE, VIOLET, AQUA]):
    tr = np.array(tr, float)
    a3.semilogy(np.maximum(np.abs(tr), 1e-16), "o-", color=col, ms=4, label=name)
a3.set(title="√(1 + x²) из 1.5: |xₖ − 0|", xlabel="шаг k", ylim=(1e-16, 1e6))
a3.legend()
ex.finish(fig, "newton_vs_gradient")
