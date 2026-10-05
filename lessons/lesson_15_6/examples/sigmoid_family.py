"""Сигмоида и её родня: σ′ = σ(1 − σ), th′ = 1 − th², softplus′ = σ, (ln σ)′ = 1 − σ.

Запуск:  python lessons/lesson_15_6/examples/sigmoid_family.py [--save] [--no-show]

Проверяет формулы численно, печатает «точные» значения σ′(0) = 1/4 и σ′(ln 3) = 3/16, насыщение при |F| ≥ 5
и затухание произведения наклонов в цепочке из k сигмоид.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET

ex = Example(__file__)

sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731
dsig = lambda z: sig(z) * (1 - sig(z))  # noqa: E731


def num_diff(f, x, eps=1e-6):
    return (f(x + eps) - f(x - eps)) / (2 * eps)


z = np.linspace(-6, 6, 25)
FAMILY = {
    "σ′ = σ(1 − σ)": (sig, dsig),
    "th′ = 1 − th²": (np.tanh, lambda t: 1 - np.tanh(t) ** 2),
    "softplus′ = σ": (lambda t: np.log1p(np.exp(t)), sig),
    "(ln σ)′ = 1 − σ": (lambda t: np.log(sig(t)), lambda t: 1 - sig(t)),
    "(ln(1 − σ))′ = −σ": (lambda t: np.log(1 - sig(t)), lambda t: -sig(t)),
    "th = 2σ(2x) − 1": (np.tanh, lambda t: num_diff(lambda s: 2 * sig(2 * s) - 1, t)),
}
for name, (f, d) in FAMILY.items():
    err = np.max(np.abs(num_diff(f, z) - d(z)))
    print(f"{name:20} max расхождение {err:.1e}")
    assert err < 1e-7, name

print("σ′(0) =", dsig(0.0), "(= 1/4);  σ′(ln 3) =", round(float(dsig(np.log(3))), 12), "(= 3/16 = 0.1875)")
assert abs(dsig(0.0) - 0.25) < 1e-15 and abs(dsig(np.log(3)) - 3 / 16) < 1e-12
print("насыщение: σ′(5) =", round(float(dsig(5.0)), 5), "σ′(−5) =", round(float(dsig(-5.0)), 5))
assert dsig(5.0) < 0.007 and abs(dsig(5.0) - dsig(-5.0)) < 1e-15  # симметрия

# Цепочка из k сигмоид: производная — произведение наклонов, ≤ (1/4)^k
for k in [1, 3, 10]:
    x, grad = 0.0, 1.0
    for _ in range(k):
        grad *= dsig(x)
        x = sig(x)
    print(f"k = {k:2}: производная цепочки в 0 = {grad:.3e}, граница 0.25^k = {0.25**k:.3e}")
    assert grad <= 0.25**k + 1e-18

zs = np.linspace(-7, 7, 500)
fig, (a1, a2) = plt.subplots(1, 2, figsize=(13, 4.2))
a1.plot(zs, sig(zs), color=BLUE, lw=2.4, label="σ(F)")
a1.plot(zs, dsig(zs), color=ORANGE, lw=2.4, label="σ′(F) = σ(1 − σ)")
a1.axhline(0.25, color=MUTED, ls="--", lw=1)
a1.plot(np.log(3), 3 / 16, "o", color=ORANGE)
a1.annotate("σ′(ln 3) = 3/16", (np.log(3), 3 / 16), xytext=(2.2, 0.35), arrowprops=dict(arrowstyle="->", color=MUTED))
a1.set(title="сигмоида и её наклон", xlabel="логит F")
a1.legend()
a2.plot(zs, 1 - np.tanh(zs) ** 2, color=AQUA, lw=2.2, label="th′")
a2.plot(zs, sig(zs), color=BLUE, lw=2.2, label="softplus′ = σ")
a2.plot(zs, 1 - sig(zs), color=VIOLET, lw=2.2, label="(ln σ)′ = 1 − σ")
a2.plot(zs, dsig(zs), color=ORANGE, lw=2.2, label="σ′")
a2.set(title="производные родни сигмоиды", xlabel="x")
a2.legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "sigmoid_family")
