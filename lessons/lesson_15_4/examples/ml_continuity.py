"""Пределы и непрерывность в бустинге: разрывные деревья, accuracy против log-loss, число e, устойчивые формулы.

Модель из пней (библиотека курса) — ступенчатая функция; accuracy — ступенчатая функция порога, log-loss —
гладкая; доля out-of-bag → 1/e; (1 − ν)^(T/ν) → e^(−T); устойчивые log-loss и log-sum-exp против наивных.

Запуск:  python lessons/lesson_15_4/examples/ml_continuity.py [--save] [--no-show]
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import special

from gbcourse.boosting import GBRegressor
from gbcourse.cli import Example
from gbcourse.losses import get_loss
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)

xg = np.linspace(0, 10, 200)
yg = np.sin(xg) + 0.3 * xg
fine = np.linspace(0, 10, 20001)
model = GBRegressor(n_estimators=60, learning_rate=0.5, max_depth=1).fit(xg.reshape(-1, 1), yg)
pred = model.predict(fine.reshape(-1, 1))
jumps = int(np.sum(np.abs(np.diff(pred)) > 1e-12))
print(f"60 пней: скачков на сетке {jumps}, модель горизонтальна на {100 * np.mean(np.abs(np.diff(pred)) < 1e-12):.2f} % сетки")
assert 0 < jumps < 61

X = np.array([0.5, 1.1, 1.8, 2.3, 3.4, 4.1, 2.9, 3.7, 4.6, 5.2, 5.9, 6.5])
y = np.array([0] * 6 + [1] * 6)
bs = np.linspace(0, 7, 7001)
acc = np.array([np.mean((X > b) == (y == 1)) for b in bs])
ll = np.array([np.mean(np.logaddexp(0, 1.5 * (X - b)) - y * 1.5 * (X - b)) for b in bs])
print(f"accuracy: {len(np.unique(acc))} разных значений, максимум {acc.max():.3f}; log-loss: минимум {ll.min():.4f} при b ≈ {bs[ll.argmin()]:.3f}, accuracy там {acc[ll.argmin()]:.3f}")
assert abs(ll.min() - 0.351) < 1e-3 and acc[ll.argmin()] == acc.max()

rng = Mulberry32(3)
n = 1000
share = np.mean(np.bincount([rng.randint(n) for _ in range(n)], minlength=n) == 0)
print(f"бутстрэп n = {n}: не попали {share:.3f}, формула {(1 - 1 / n) ** n:.4f}, 1/e = {1 / math.e:.4f}")
assert abs(share - 1 / math.e) < 0.05
for nu in (0.5, 0.1, 0.01):
    print(f"ν = {nu:<5}: (1 − ν)^(2/ν) = {(1 - nu) ** round(2 / nu):.5f}  (e⁻² = {math.exp(-2):.5f})")

F = np.array([-800.0, 30.0, 40.0])
with np.errstate(over="ignore"):
    naive = np.log(1 + np.exp(-F))
stable = np.logaddexp(0, -F)
lib = get_loss("logistic").pointwise(np.ones_like(F), F)
print("log-loss при F =", F, ": наивно", naive, "| logaddexp", stable, "| gbcourse", lib)
# общая формула библиотеки max(F, 0) + log1p(e^(−|F|)) − yF при y = 1 и больших F теряет крошечные потери
# (абсолютная ошибка ~1e−15 — для суммы потерь несущественно), но никогда не переполняется
assert np.isinf(naive[0]) and naive[2] == 0 and np.allclose(stable, lib, rtol=1e-6, atol=1e-12)
z = np.array([1000.0, 1001.0, 1002.0])
print("log-sum-exp:", z.max() + np.log(np.exp(z - z.max()).sum()), "| scipy", special.logsumexp(z))

fig, axes = plt.subplots(1, 3, figsize=(15, 4))
axes[0].plot(xg, yg, "--", color=MUTED, label="гладкая цель")
axes[0].plot(fine, pred, color=BLUE, lw=2, label=f"60 пней: {jumps} скачков")
axes[0].set(title="модель бустинга — ступенчатая функция", xlabel="x")
axes[0].legend(fontsize=8)
axes[1].step(bs, acc, where="post", color=BLUE, lw=2, label="accuracy")
axes[1].plot(bs, ll, color=ORANGE, lw=2.2, label="log-loss")
axes[1].set(title="ступеньки против гладкой кривой", xlabel="порог b")
axes[1].legend(fontsize=8)
nn = np.logspace(0.3, 4, 200)
axes[2].semilogx(nn, (1 - 1 / nn) ** nn, color=BLUE, lw=2.2, label="(1 − 1/n)ⁿ")
axes[2].axhline(1 / math.e, color=ORANGE, ls="--", label="1/e")
axes[2].set(title="доля out-of-bag → 1/e", xlabel="n")
axes[2].legend(fontsize=8)
plt.tight_layout()
ex.finish(fig, "ml_continuity")
