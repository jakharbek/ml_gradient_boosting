"""Стохастический градиент: шум мини-батча ∝ 1/√B, пол шума ∝ η/B, расписания темпа, острые и плоские минимумы.

Запуск:  python lessons/lesson_15_15/examples/stochastic_gradient.py [--save] [--no-show]

1) Разброс оценки градиента по мини-батчу против теории σ/√B·√((N − B)/(N − 1)).
2) Пол шума SGD с постоянным темпом (4000 шагов) и четыре расписания темпа за 20 эпох.
3) Острая и плоская ямы: доля из 400 спусков, застрявших в острой, в зависимости от темпа и шума.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, RED

ex = Example(__file__)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.2))

r = Mulberry32(3)
N = 200
xs = np.array([r.uniform(-1, 1) for _ in range(N)])
ys = np.array([1 + 2 * x + r.normal(0, 0.5) for x in xs])
loss = lambda b, k: ((ys - b - k * xs) ** 2).mean() / 2  # noqa: E731
k_opt, b_opt = np.polyfit(xs, ys, 1)
L_min = loss(b_opt, k_opt)

# 1. Шум мини-батча
gb = -ys  # градиенты отдельных объектов по сдвигу b в точке (0, 0)
Bs = [1, 2, 5, 10, 20, 50, 100, 200]
emp = []
for B in Bs:
    rr = Mulberry32(900 + B)
    emp.append(np.std([gb[rr.sample(N, B)].mean() for _ in range(300)]))
theory = [gb.std() / np.sqrt(B) * np.sqrt((N - B) / (N - 1)) for B in Bs]
ax = axes[0]
ax.loglog(Bs[:-1], theory[:-1], color=BLUE, label="теория σ/√B·√((N − B)/(N − 1))")
ax.loglog(Bs[:-1], emp[:-1], "o", color=ORANGE, label="опыт: 300 батчей")
ax.set(xlabel="размер батча B", ylabel="разброс оценки ∂L/∂b", title="Шум мини-батча")
ax.legend()
print("B = 10: разброс", round(emp[3], 3), "теория", round(theory[3], 3))
assert abs(emp[3] - theory[3]) < 0.01 and emp[-1] < 1e-12


# 2. Пол шума и расписания
def floor(B, eta):
    acc = []
    for seed in range(3):
        rg = Mulberry32(300 + seed)
        b = k = 0.0
        for t in range(1, 4001):
            idx = [rg.randint(N) for _ in range(B)]
            res = ys[idx] - b - k * xs[idx]
            b += eta * res.mean()
            k += eta * (res * xs[idx]).mean()
            if t > 2000:
                acc.append(loss(b, k) - L_min)
    return np.mean(acc)


etas = [0.01, 0.02, 0.05, 0.1, 0.2]
fl1 = [floor(1, e) for e in etas]
fl10 = [floor(10, e) for e in etas]
slope = np.polyfit(np.log(etas), np.log(fl1), 1)[0]
ax = axes[1]
ax.loglog(etas, fl1, "o-", color=BLUE, label="B = 1")
ax.loglog(etas, fl10, "o-", color=AQUA, label="B = 10")
ax.set(xlabel="темп η", ylabel="потери − минимум", title=f"Пол шума ∝ η/B (наклон {slope:.2f})")
ax.legend()
print(f"наклон «пол — темп»: {slope:.2f}; B = 1 / B = 10 при η = 0.05: {fl1[2] / fl10[2]:.1f}")
assert 0.8 < slope < 1.25 and 6 < fl1[2] / fl10[2] < 16


def sgd(lr, sched, epochs=20, seed=300):
    rg = Mulberry32(seed)
    b = k = 0.0
    t, T = 0, epochs * N
    for _ in range(epochs):
        for i in rg.permutation(N):
            res = ys[i] - b - k * xs[i]
            eta = lr if sched == "const" else (lr / (1 + t / 100) if sched == "decay" else lr * (1 + np.cos(np.pi * t / T)) / 2)
            b += eta * res
            k += eta * res * xs[i]
            t += 1
    return loss(b, k) - L_min


final = {f"{s} {lr}": sgd(lr, s) for s, lr in (("const", 0.1), ("const", 0.01), ("decay", 0.1), ("cos", 0.1))}
for name, v in final.items():
    print(f"расписание {name:10}: превышение потерь {v:.1e}")
assert final["cos 0.1"] < final["const 0.01"] < final["const 0.1"]

# 3. Острые и плоские минимумы
d_sf = lambda x: 50 * (x + 2) if 25 * (x + 2) ** 2 - 1 < 0.5 * (x - 1.5) ** 2 - 0.8 else x - 1.5  # noqa: E731


def sharp_share(eta, sig):
    ends = []
    for i in range(400):
        rg = Mulberry32(50 + i)
        x = -4 + 8 * rg.random()
        for _ in range(1500):
            x = min(4, max(-4, x - eta * (d_sf(x) + sig * rg.normal())))
        ends.append(x)
    return np.mean(np.abs(np.array(ends) + 2) < 0.35)


eta_grid = [0.01, 0.02, 0.03, 0.035, 0.039, 0.041]
ax = axes[2]
for sig, col in ((0, BLUE), (5, ORANGE), (10, RED)):
    sh = [sharp_share(e, sig) for e in eta_grid]
    ax.plot(eta_grid, sh, "o-", color=col, label=f"шум σ = {sig}")
    print(f"σ = {sig:2d}: доля в острой яме", np.round(sh, 3))
ax.axvline(0.04, color=MUTED, ls="--", lw=1)
ax.set(xlabel="темп η", ylabel="доля спусков в острой яме", title="Порог устойчивости 2/50 = 0.04")
ax.legend()
assert sharp_share(0.041, 0) == 0 and sharp_share(0.02, 0) > 0.3

ex.finish(fig, "stochastic_gradient")
