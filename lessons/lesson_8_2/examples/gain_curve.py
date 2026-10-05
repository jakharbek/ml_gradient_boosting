"""Выигрыш разбиения по всем порогам признака при разных λ (первое дерево, квадратичная потеря).

Запуск:  python lessons/lesson_8_2/examples/gain_curve.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import RegressionTree, datasets
from gbcourse.cli import Example

ex = Example(__file__)

X, y = datasets.regression_1d(kind="wave", n=60, noise=0.4, seed=82)
g = y.mean() - y
order = np.argsort(X[:, 0], kind="stable")
xs, gs = X[order, 0], g[order]
G, H = gs.sum(), float(len(gs))
thr = (xs[:-1] + xs[1:]) / 2
GL = np.cumsum(gs)[:-1]
HL = np.arange(1, len(gs), dtype=float)

fig, ax = plt.subplots(figsize=(9, 3.8))
for lam in (0.0, 5.0, 30.0):
    S = lambda G_, H_, lam=lam: G_**2 / (H_ + lam)
    gain = 0.5 * (S(GL, HL) + S(G - GL, H - HL) - S(G, H))
    k = int(np.argmax(gain))
    tree = RegressionTree(max_depth=1, reg_lambda=lam).fit(X, g)
    assert np.isclose(tree.nodes[0].gain, gain[k]) and np.isclose(tree.nodes[0].threshold, thr[k])
    ax.step(thr, gain, where="mid", label=f"λ = {lam:g}: лучший порог {thr[k]:.2f}, gain {gain[k]:.2f}")
    print(f"λ = {lam:4g}: лучший порог {thr[k]:.3f}, gain {gain[k]:.3f} (совпадает с RegressionTree)")
ax.set(xlabel="порог t", ylabel="gain", title="λ уменьшает выигрыш, сильнее всего — у порогов с маленькими листьями")
ax.legend(fontsize=8)
fig.tight_layout()
ex.finish(fig, "gain_curve")
