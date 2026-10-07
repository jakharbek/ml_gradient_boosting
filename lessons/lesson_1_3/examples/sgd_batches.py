"""Стохастический спуск: одно число, прямая и мини-пакеты разного размера.

Запуск:  python lessons/lesson_1_3/examples/sgd_batches.py [--save] [--no-show]

Шаг 13 урока, в два захода — как на странице.
1) Одно число. Константа c для шести квартир, на каждом шаге — одна случайная квартира:
   c ← c + η·(yᵢ − c). В среднем шаг совпадает с полным, но при постоянном η прогноз «гоняется» за
   последней ценой; с затухающим темпом ηₖ = 1/(k + 1) он в точности равен среднему выбранных цен.
2) Прямая ŷ = a·z + b для 30 точек (стандартизованный признак), темп 0.1, 60 шагов,
   пакеты B = 1, 5, 30.
   По номеру шага полный спуск побеждает, а при равной стоимости (просмотренных точках) — SGD.
   Шум у минимума растёт с η и падает с B (средний избыток по 40 зёрнам).
Квартиры и пакеты выбирает Mulberry32 — тот же генератор, что в виджетах sgd-constant и sgd-line,
поэтому числа совпадают с браузером.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets, style
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32

ex = Example(__file__)

# --- 1. Одно число: шесть квартир ---
FLATS = np.array([3, 5, 4, 8, 9, 13.0])


def sgd_constant(eta: float | None, steps: int, seed: int = 1) -> tuple[np.ndarray, list[float]]:
    """Путь c₀ = 0, c₁, …: на шаге k одна случайная квартира; eta=None — темп 1/(k + 1)."""
    rng, c, path, picked = Mulberry32(seed), 0.0, [0.0], []
    for k in range(steps):
        price = float(FLATS[rng.sample(6, 1)[0]])
        c += (1 / (k + 1) if eta is None else eta) * (price - c)
        path.append(c)
        picked.append(price)
    return np.array(path), picked


single = 0 + 0.5 * (FLATS - 0)  # шаг по одной квартире из c = 0
print(f"из c = 0, η = 0.5: полный шаг {0.5 * FLATS.mean():.1f}; по одной квартире {single} — "
      f"их среднее {single.mean():.1f}")
print(f"из c = 7 (дно): полный шаг стоит на месте, по одной квартире — {7 + 0.5 * (FLATS - 7)}")
const_path, picked = sgd_constant(0.5, 6)
decay_path, _ = sgd_constant(None, 6)
print(f"Mulberry32(1) выбрал цены {[int(p) for p in picked]}")
print(f"  η = 0.5:        c = {', '.join(f'{v:.6g}' for v in const_path[1:])}")
print(f"  ηₖ = 1/(k + 1): c = {', '.join(f'{v:.6g}' for v in decay_path[1:])} "
      "— бегущее среднее цен")

assert single.mean() == 0.5 * FLATS.mean() == 3.5, "в среднем стохастический шаг равен полному"
assert np.allclose(7 + 0.5 * (FLATS - 7), [5, 6, 5.5, 7.5, 8, 10]), "у дна SGD не стоит на месте"
assert picked == [8, 3, 8, 13, 13, 5], "те же квартиры, что в виджете (зерно 1)"
assert np.allclose(const_path[1:], [4, 3.5, 5.75, 9.375, 11.1875, 8.09375])
assert np.allclose(decay_path[1:], np.cumsum(picked) / np.arange(1, 7)), "1/(k + 1) — среднее цен"
assert np.allclose(np.round(decay_path[1:], 2), [8, 5.5, 6.33, 8, 9, 8.33])
long_const, _ = sgd_constant(0.5, 600)
long_decay, long_picked = sgd_constant(None, 600)
assert np.std(long_const[-300:]) > 1, "постоянный темп: шум не гаснет"
assert abs(long_decay[-1] - np.mean(long_picked)) < 1e-9 and abs(long_decay[-1] - 7) < 0.3

# --- 2. Прямая для 30 точек ---
X, y = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)
z = (X[:, 0] - X[:, 0].mean()) / X[:, 0].std()
a_opt, b_opt = np.mean(z * (y - y.mean())), y.mean()


def half_mse(a: float, b: float) -> float:
    """½·MSE прямой a·z + b на всех 30 точках."""
    return float(np.mean((y - a * z - b) ** 2) / 2)


def sgd(batch: int, eta: float = 0.1, steps: int = 60,
        seed: int = 1) -> tuple[np.ndarray, np.ndarray]:
    """Путь (a, b) и ½·MSE по шагам для спуска по мини-пакетам размера batch."""
    rng = Mulberry32(seed)
    a = b = 0.0
    path, hist = [(a, b)], [half_mse(a, b)]
    for _ in range(steps):
        idx = rng.sample(len(y), batch) if batch < len(y) else list(range(len(y)))
        res = y[idx] - (a * z[idx] + b)
        a, b = a + eta * np.mean(res * z[idx]), b + eta * np.mean(res)
        path.append((a, b))
        hist.append(half_mse(a, b))
    return np.array(path), np.array(hist)


opt = half_mse(a_opt, b_opt)
print(f"\nпрямая: минимум a = {a_opt:.4f}, b = {b_opt:.4f}, ½·MSE = {opt:.5f}")
runs, spread = {}, {}
EPOCHS = {1: "2 эпохи", 5: "10 эпох", 30: "60 эпох"}
for B in (1, 5, 30):
    runs[B] = sgd(B)
    tail = runs[B][1][-20:]
    spread[B] = tail.max() - tail.min()
    print(f"B = {B:2d}: после 60 шагов ½·MSE = {runs[B][1][-1]:.5f}; последние 20 шагов "
          f"{tail.min():.4f}–{tail.max():.4f}; просмотрено точек {60 * B} ({EPOCHS[B]})")

full = sgd(30, steps=10)[1]
print("при равной стоимости (просмотренные точки):")
print(f"  2 эпохи:  полный спуск, 2 шага — {full[2]:.3f};  "
      f"SGD, B = 1, 60 шагов — {runs[1][1][-1]:.4f}")
print(f"  10 эпох: полный спуск, 10 шагов — {full[10]:.3f}; "
      f"SGD, B = 5, 60 шагов — {runs[5][1][-1]:.4f}")

excess = {}
for B in (1, 5):
    for eta in (0.1, 0.05):  # установившийся режим: шаги 200–400, среднее по 40 зёрнам
        excess[B, eta] = np.mean([sgd(B, eta, 400, s)[1][200:].mean() - opt for s in range(1, 41)])
print("средний избыток ½·MSE над минимумом (шаги 200–400, 40 зёрен):")
for (B, eta), v in excess.items():
    print(f"  B = {B}, η = {eta:<4}: {v:.4f}")

# --- числа шага 13 урока ---
assert abs(opt - 0.23688) < 5e-6, "минимум ½·MSE"
assert abs(runs[1][1][-1] - 0.2547) < 5e-5 and abs(runs[5][1][-1] - 0.2409) < 5e-5
assert abs(runs[30][1][-1] - 0.23690) < 5e-6
ranges = {B: (runs[B][1][-20:].min(), runs[B][1][-20:].max()) for B in runs}
assert np.allclose(ranges[1], [0.239, 0.334], atol=5e-4), "разброс B = 1"
assert np.allclose(ranges[5], [0.238, 0.252], atol=5e-4), "разброс B = 5"
assert np.allclose(ranges[30], [0.2369, 0.2381], atol=5e-5)
assert spread[1] > spread[5] > spread[30], "шум у минимума убывает с размером пакета"
assert abs(full[2] - 4.590) < 5e-4 and abs(full[10] - 1.044) < 5e-4, "полный спуск за 2 и 10 шагов"
assert full[2] > 10 * runs[1][1][-1] and full[10] > 4 * runs[5][1][-1], "равная стоимость: SGD"
page_excess = {(1, 0.1): (0.032, 5e-4), (1, 0.05): (0.015, 5e-4), (5, 0.1): (0.005, 5e-4),
               (5, 0.05): (0.0025, 5e-5)}  # число на странице и половина последнего разряда
for key, (shown, tol) in page_excess.items():
    assert abs(excess[key] - shown) <= tol, f"избыток при B, η = {key}: {excess[key]:.5f}"
for eta in (0.1, 0.05):
    assert 5 < excess[1, eta] / excess[5, eta] < 7, "при B = 5 избыток в 6 раз меньше"

# --- рисунок ---
COLORS = {1: style.ORANGE, 5: style.AQUA, 30: style.BLUE}
fig, axes = plt.subplots(1, 3, figsize=(14, 4.1))
ax = axes[0]
ks = np.arange(61)
full_c = 7 - 7 * 0.5**ks  # полный спуск: расстояние до 7 вдвое за шаг
ax.plot(ks, full_c, color=style.BLUE, label="все 6 квартир, η = 0.5")
ax.plot(ks, sgd_constant(0.5, 60)[0], color=style.ORANGE, label="1 квартира, η = 0.5")
ax.plot(ks, sgd_constant(None, 60)[0], color=style.AQUA, label="1 квартира, ηₖ = 1/(k + 1)")
ax.axhline(7, color=style.MUTED, lw=1.2, ls=(0, (4, 3)), label="среднее ȳ = 7")
ax.set(xlabel="шаг k", ylabel="cₖ, млн", title="Одно число: шум и затухающий темп", ylim=(0, 14))
ax.legend(fontsize=8, loc="lower right")

ax = axes[1]
ga, gb = np.meshgrid(np.linspace(-0.6, 2.6, 160), np.linspace(-0.4, 4.4, 200))
levels = np.mean((y[None, None, :] - ga[..., None] * z - gb[..., None]) ** 2, axis=-1) / 2
ax.contour(ga, gb, levels, levels=[0.25, 0.3, 0.45, 0.7, 1.2, 2, 3.5, 6], colors=style.AXIS,
           linewidths=0.8)
for B in (1, 5, 30):
    ax.plot(runs[B][0][:, 0], runs[B][0][:, 1], color=COLORS[B], lw=1.4, label=f"B = {B}")
ax.plot([a_opt], [b_opt], "o", color=style.INK, ms=7, mec=style.SURFACE, label="минимум")
ax.set(xlabel="наклон a", ylabel="сдвиг b", aspect="equal", title="Прямая: путь по мини-пакетам")
ax.legend(fontsize=8, loc="lower right")

ax = axes[2]
for B, steps in ((1, 300), (5, 60), (30, 10)):  # 10 эпох для каждого
    hist = sgd(B, steps=steps)[1]
    ax.semilogy(np.arange(steps + 1) * B / 30, hist, color=COLORS[B],
                label=f"B = {B}: {steps} шагов",
                marker="o" if B == 30 else None, ms=4.5, mec=style.SURFACE)
for epoch, value in ((2, full[2]), (10, full[10])):
    ax.plot([epoch], [value], "o", color=style.BLUE, ms=6, mec=style.SURFACE)
    ax.annotate(f"{value:.3f}", (epoch, value), xytext=(6, 4), textcoords="offset points",
                fontsize=8.5, color=style.INK_2)
ax.axhline(opt, color=style.MUTED, lw=1.2, ls=(0, (4, 3)), label="минимум")
ax.set(xlabel="эпохи (просмотрено точек / 30)", ylabel="½·MSE на всех точках",
       title="При равной стоимости SGD впереди")
ax.set_yticks([0.25, 0.5, 1, 2, 4, 8], labels=["0.25", "0.5", "1", "2", "4", "8"])
ax.minorticks_off()
ax.legend(fontsize=8, loc="upper right")
fig.tight_layout()
ex.finish(fig, "sgd_batches")
