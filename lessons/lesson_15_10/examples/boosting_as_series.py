"""Ряды в машинном обучении: бустинг как частичная сумма, ν·M ≈ const, EMA, Роббинс — Монро, ряд Неймана.

Запуск:  python lessons/lesson_15_10/examples/boosting_as_series.py [--save] [--no-show]

1) Бустинг на «волне с шумом» (80/80, глубина 2): члены ряда убывают, лучшее M — при ν·M ≈ 5.
2) Сверка с scikit-learn: при ν = 0.1 лучшее M = 46, как у gbcourse.
3) Экспоненциальное среднее: веса (1 − β)βʲ, сумма 1 − βᵗ, поправка Adam.
4) SGD для среднего: ν = 1/k — бегущее среднее; постоянный темп дрожит; 1/k² «застывает».
5) L2-бустинг со сглаживателем: итерации = геометрический ряд по частотам, ранняя остановка — фильтр.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.boosting import GBRegressor
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, ORANGE, RED, VIOLET

ex = Example(__file__)

# 1. Бустинг как частичная сумма ряда
X, y = datasets.regression_1d(kind="wave", n=160, noise=0.45, seed=11)
Xtr, Xte, ytr, yte = datasets.train_test_split(X, y, test_size=0.5, seed=3)
curves = {}
for nu in (0.03, 0.1, 0.3, 1.0):
    M = math.ceil(12 / nu)
    model = GBRegressor(n_estimators=M, learning_rate=nu, max_depth=2).fit(Xtr, ytr)
    te = np.array([np.mean((yte - model.init_) ** 2)] + [np.mean((yte - F) ** 2) for F in model.staged_predict_raw(Xte)])
    best = int(np.argmin(te))
    curves[nu] = te
    print(f"ν = {nu}: лучшее M = {best}, ν·M = {nu * best:.2f}, MSE = {te[best]:.4f}")
best_nuM = [nu * int(np.argmin(te)) for nu, te in curves.items()][:3]
assert all(4.5 <= v <= 5.2 for v in best_nuM)
assert int(np.argmin(curves[0.1])) == 46 and min(curves[1.0]) > min(curves[0.1]) + 0.02

# 2. Сверка с scikit-learn
from sklearn.ensemble import GradientBoostingRegressor  # noqa: E402

sk = GradientBoostingRegressor(n_estimators=120, learning_rate=0.1, max_depth=2).fit(Xtr, ytr)
sk_te = [np.mean((yte - p) ** 2) for p in sk.staged_predict(Xte)]
print("scikit-learn, ν = 0.1: лучшее M =", int(np.argmin(sk_te)) + 1, ", MSE =", round(float(min(sk_te)), 4))
assert int(np.argmin(sk_te)) + 1 == 46

# 3. Экспоненциальное среднее
beta = 0.9
for t in (5, 20, 100):
    print(f"β = 0.9, t = {t}: сумма весов 1 − βᵗ = {1 - beta**t:.4f}")

# 4. Роббинс — Монро
SCHED = {"0.05": lambda k: 0.05, "1/k": lambda k: 1 / k, "1/k^0.6": lambda k: k**-0.6, "1/k²": lambda k: 1 / k**2}
rng = Mulberry32(1)
ys = [rng.normal(2.0, 1.0) for _ in range(2000)]
paths = {}
for name, nu in SCHED.items():
    th, path = 0.0, []
    for k, yk in enumerate(ys, start=1):
        th += nu(k) * (yk - th)
        path.append(th)
    paths[name] = path
    print(f"ν_k = {name:7}: θ − μ после 2000 шагов = {path[-1] - 2:+.4f}")
assert abs(paths["1/k"][-1] - np.mean(ys)) < 1e-12

# 5. L2-бустинг со сглаживателем
n, nu, b = 64, 0.1, 2.0
xg = 2 * np.pi * np.arange(n) / n
f_true = np.sin(xg) + 0.5 * np.sin(3 * xg)
rng = Mulberry32(5)
yg = f_true + np.array([rng.normal(0, 0.5) for _ in range(n)])
d = np.minimum(np.arange(n), n - np.arange(n))
w = np.exp(-(d**2) / (2 * b * b))
w /= w.sum()
lam = np.real(np.fft.fft(w))
Y = np.fft.fft(yg)
err = [np.mean((np.real(np.fft.ifft(Y * (1 - (1 - nu * lam) ** M))) - f_true) ** 2) for M in range(1, 401)]
best = int(np.argmin(err)) + 1
print(f"сглаживатель: лучшее M = {best}, ошибка до истины {err[best - 1]:.4f}; при M = 400 — {err[-1]:.4f}")
assert err[best - 1] < err[-1]

fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(15, 4))
for (nu, te), c in zip(curves.items(), (VIOLET, BLUE, ORANGE, RED)):
    a1.plot(nu * np.arange(len(te)), te, color=c, lw=2, label=f"ν = {nu}")
a1.set(title="MSE на проверке по оси ν·M", xlabel="ν·M", ylim=(0.15, 0.6))
a1.legend()
for (name, path), c in zip(paths.items(), (ORANGE, BLUE, AQUA, RED)):
    a2.semilogx(np.arange(1, 2001), path, color=c, lw=1.6, label=f"νₖ = {name}")
a2.axhline(2, color="black", ls="--", lw=1)
a2.set(title="SGD для среднего: расписания темпа", xlabel="k", ylim=(-0.5, 4.5))
a2.legend()
ks = np.arange(33)
for M, c in ((5, AQUA), (best, BLUE), (400, RED)):
    a3.plot(ks, 1 - (1 - nu * lam[ks]) ** M, "o-", ms=3, color=c, label=f"M = {M}")
a3.set(title="Доля подогнанного по частотам: 1 − (1 − νλₖ)ᴹ", xlabel="частота k")
a3.legend()
ex.finish(fig, "boosting_as_series")
