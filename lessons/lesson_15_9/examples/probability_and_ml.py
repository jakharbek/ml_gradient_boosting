"""Интегралы в вероятности и машинном обучении: плотность, ожидаемые потери, AUC, интегрированные градиенты.

Запуск:  python lessons/lesson_15_9/examples/probability_and_ml.py [--save] [--no-show]

1) Вероятность — площадь под плотностью; F′ = p; правило 68–95–99.7.
2) Лучшая константа: минимум ∫L(y, c)p(y)dy — среднее, медиана, квантиль; на выборке — то же для выборки.
3) AUC = площадь под ROC-кривой = доля пар «класс 1 выше класса 0»; сверка с gbcourse и scikit-learn.
4) Интегрированные градиенты: вклады в сумме дают F(x) − F(x′); для ступенчатой модели метод ломается.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import math

import matplotlib.pyplot as plt
import numpy as np
from scipy import integrate, special
from sklearn.metrics import roc_auc_score

from gbcourse import metrics
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, ORANGE, VIOLET

ex = Example(__file__)

pdf = lambda z: np.exp(-z**2 / 2) / np.sqrt(2 * np.pi)  # noqa: E731
Phi = lambda z: 0.5 * (1 + special.erf(z / np.sqrt(2)))  # noqa: E731

# 1. Плотность
for k in (1, 2, 3):
    P = integrate.quad(pdf, -k, k)[0]
    print(f"1) P(|Z| ≤ {k}) = {P:.4%}")
    assert abs(P - (Phi(k) - Phi(-k))) < 1e-12
assert abs((Phi(0.7 + 1e-6) - Phi(0.7 - 1e-6)) / 2e-6 - pdf(0.7)) < 1e-8

# 2. Лучшая константа для Y ~ Exp(λ = 0.5)
lam = 0.5
y = np.linspace(0, 80, 400_001)
dy = y[1] - y[0]
p = lam * np.exp(-lam * y)
cs = np.linspace(0, 6, 1201)
losses = {"квадрат": lambda c: (y - c) ** 2, "модуль": lambda c: np.abs(y - c), "квантиль 0.8": lambda c: np.where(y >= c, 0.8 * (y - c), 0.2 * (c - y))}
theory = {"квадрат": 1 / lam, "модуль": math.log(2) / lam, "квантиль 0.8": -math.log(0.2) / lam}
risks = {}
for name, L in losses.items():
    risks[name] = np.array([np.sum(L(c) * p) * dy for c in cs])
    best = cs[np.argmin(risks[name])]
    print(f"2) {name:13}: минимум R(c) при c = {best:.3f}, теория {theory[name]:.3f}")
    assert abs(best - theory[name]) < 0.01
rng = Mulberry32(11)
sample = np.array([-math.log(1 - rng.random()) / lam for _ in range(20000)])
print(f"   выборка 20000: среднее {sample.mean():.3f}, медиана {np.median(sample):.3f}, 0.8-квантиль {np.quantile(sample, 0.8):.3f}")

# 3. AUC
rng = Mulberry32(7)
n = 2000
yy = np.r_[np.zeros(n), np.ones(n)]
score = np.array([rng.normal(0, 1) for _ in range(n)] + [rng.normal(1, 1) for _ in range(n)])
order = np.argsort(-score)
tpr = np.r_[0, np.cumsum(yy[order] == 1) / n]
fpr = np.r_[0, np.cumsum(yy[order] == 0) / n]
area = float(np.sum(np.diff(fpr) * (tpr[1:] + tpr[:-1]) / 2))
pairs = float((score[n:][:, None] > score[:n][None, :]).mean())
print(f"3) площадь {area:.6f}, доля пар {pairs:.6f}, gbcourse {metrics.roc_auc(yy, score):.6f}, sklearn {roc_auc_score(yy, score):.6f}, теория {Phi(1 / math.sqrt(2)):.4f}")
assert abs(area - pairs) < 1e-12 and abs(area - roc_auc_score(yy, score)) < 1e-12
assert roc_auc_score([0, 0, 1, 1], [0.7, 0.2, 0.9, 0.6]) == 0.75

# 4. Интегрированные градиенты
sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731
F = lambda x: sig(1.5 * x[0] + x[1] + 2 * x[0] * x[1] - 1)  # noqa: E731


def grad_F(x):
    q = F(x)
    return q * (1 - q) * np.array([1.5 + 2 * x[1], 1 + 2 * x[0]])


base, xin = np.array([-1.0, -1.0]), np.array([1.2, 0.8])
alphas = (np.arange(2000) + 0.5) / 2000
ig = (xin - base) * np.mean([grad_F(base + a * (xin - base)) for a in alphas], axis=0)
print(f"4) IG = {ig.round(5)}, сумма {ig.sum():.6f}, F(x) − F(x′) = {F(xin) - F(base):.6f}, градиент × Δx = {grad_F(xin) @ (xin - base):.6f}")
assert abs(ig.sum() - (F(xin) - F(base))) < 1e-6
tree = lambda x: 0.2 + 0.5 * (x[0] > 0.5) + 0.3 * (x[1] > 0.2)  # noqa: E731
print("   ступенчатая модель: градиент почти везде 0 → IG = (0, 0), а F(x) − F(x′) =", tree(xin) - tree(base))

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
for (name, R), c in zip(risks.items(), [BLUE, ORANGE, VIOLET]):
    a1.plot(cs, R / R.min(), color=c, lw=2.2, label=f"{name}: c* = {cs[np.argmin(R)]:.2f}")
a1.set(title="Ожидаемые потери, Y ~ Exp(0.5)", xlabel="константа c", ylabel="R(c) / min R", ylim=(0.9, 3))
a1.legend()
a2.fill_between(fpr, 0, tpr, color=BLUE, alpha=0.2)
a2.plot(fpr, tpr, color=BLUE, lw=2)
a2.plot([0, 1], [0, 1], "--", color="gray")
a2.set(title=f"AUC = площадь = доля пар = {area:.3f}", xlabel="FPR", ylabel="TPR", aspect="equal")
ex.finish(fig, "probability_and_ml")
