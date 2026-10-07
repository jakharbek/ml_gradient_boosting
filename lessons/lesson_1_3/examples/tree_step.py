"""Шаг-дерево как направление спуска: шесть квартир, свободный шаг и пни.

Запуск:  python lessons/lesson_1_3/examples/tree_step.py [--save] [--no-show]

Шаг 14 урока. Параметры — сами прогнозы Fᵢ шести квартир; в F₀ = 7 антиградиент ½·суммы квадратов —
вектор остатков r. Свободный шаг F + ν·r двигает каждый прогноз отдельно и ничего не говорит о новой
квартире 65 м². Пень приближает r ступенькой «площадь ≤ t»: шаг хуже на обучении, зато определён для
любой площади. Скрипт проверяет по косточкам:
1) рельеф по порогу ступенчатый (50.8 / 43.0 / 16.0 / 22.0 / 26.8): наклон по t — ноль, порог
   ищут перебором;
2) пень с листьями-средними — направление спуска: h·r > 0, ‖h‖² = h·r, поэтому
   ‖r − νh‖² = ‖r‖² − (2ν − ν²)·h·r, а лучшая длина шага ρ* = h·r/‖h‖² = 1;
3) три раунда «свободно ↔ пни» (таблица шага 14): свободный спуск быстрее на обучении, но квартира
   65 м² у него навсегда 7; бустинг даёт ей 8.5 → 8.05 → 7.65.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import style
from gbcourse.cli import Example

ex = Example(__file__)

x = np.array([30, 40, 50, 60, 70, 80.0])  # площади, м²
y = np.array([3, 5, 4, 8, 9, 13.0])  # цены, млн
NEW = 65.0  # новая квартира, которой нет в обучении
NU = 0.5
F0 = np.full(6, y.mean())
r = y - F0  # антиградиент ½·Σ(y − F)²
THRESHOLDS = (x[:-1] + x[1:]) / 2  # кандидаты: середины между соседними площадями


def stump(res: np.ndarray, t: float) -> tuple[np.ndarray, float, float]:
    """Пень «площадь ≤ t» на остатках res: значения h на квартирах и листья (слева, справа)."""
    left, right = float(res[x <= t].mean()), float(res[x > t].mean())
    return np.where(x <= t, left, right), left, right


def sse_after(res: np.ndarray, t: float, nu: float) -> float:
    """Сумма квадратов остатков после шага пнём с темпом nu."""
    return float(np.sum((res - nu * stump(res, t)[0]) ** 2))


# --- 1. Рельеф по порогу ---
print(f"антиградиент r = {r}, ‖r‖² = {r @ r:.0f}")
print(f"свободный шаг ν = {NU}: сумма квадратов {np.sum((r - NU * r) ** 2):.1f}, "
      f"квартира {NEW:.0f} м² → {y.mean():.1f} (шаг её не касается)")
print(f"\n{'порог':>6s} {'интервал t':>11s} {'Σ(r − h)², ν = 1':>17s} {'h·r':>6s} "
      f"{'cos(h, r)':>10s} "
      f"{'после шага ν = 0.5':>19s}")
relief = {}
for t in THRESHOLDS:
    h, _, _ = stump(r, t)
    relief[t] = sse_after(r, t, 1.0)
    inside = {round(sse_after(r, s, 1.0), 9) for s in np.linspace(t - 5, t + 5, 21)[:-1]}
    assert len(inside) == 1, "внутри интервала между площадями пень не меняется: наклон по t — ноль"
    cos = h @ r / np.linalg.norm(h) / np.linalg.norm(r)
    interval = f"[{t - 5:.0f}, {t + 5:.0f})"
    print(f"{t:6.0f} {interval:>11s} {relief[t]:17.1f} {h @ r:6.1f} {cos:10.3f} "
          f"{sse_after(r, t, NU):19.2f}")
    assert h @ r > 0, "любой пень на остатках — направление спуска"
    assert abs(h @ h - h @ r) < 1e-9, "листья — средние, поэтому ‖h‖² = h·r"
    assert abs(sse_after(r, t, NU) - (r @ r - (2 * NU - NU**2) * (h @ r))) < 1e-9, "тождество"
assert np.allclose(list(relief.values()), [50.8, 43.0, 16.0, 22.0, 26.8]), "рельеф шага 14"
best_t = min(relief, key=relief.get)
assert best_t == 55 and relief[best_t] == 16, "перебор: лучший порог 55 (сумма 16)"

# --- 2. Лучший пень как шаг спуска ---
h, left, right = stump(r, best_t)
rho = (h @ r) / (h @ h)
print(f"\nлучший пень: порог {best_t:.0f}, h = {h}")
cos_best = h @ r / np.linalg.norm(h) / np.linalg.norm(r)
print(f"h·r = {h @ r:.0f}, ‖h‖² = {h @ h:.0f}, cos(h, r) = {cos_best:.3f}, "
      f"ρ* = h·r/‖h‖² = {rho:.0f}")
print(f"‖r − νh‖² = ‖r‖² − (2ν − ν²)·h·r = 70 − 0.75·54 = {r @ r - 0.75 * (h @ r):.1f}; "
      f"квартира {NEW:.0f} м² → 7 + 0.5·{right:.0f} = {7 + NU * right:.1f}")
assert h @ r == 54 and h @ h == 54 and rho == 1, "ρ* = 1: точный поиск по линии ничего не меняет"
assert sse_after(r, best_t, NU) == 29.5 and 7 + NU * right == 8.5, "числа шага 14"
assert abs(np.sum((r - NU * r) ** 2) - 17.5) < 1e-12, "свободный шаг: 70·(1 − ν)²"
nus = np.linspace(0.01, 1.99, 199)
assert all(sse_after(r, best_t, nu) < r @ r for nu in nus), "падает при любом 0 < ν < 2"
assert abs(sse_after(r, best_t, 2.0) - r @ r) < 1e-9, "при ν = 2 — граница 2/a, a = 1"
h75 = stump(r, 75)[0]  # упражнение 16: пень хуже согласован с антиградиентом
assert abs(h75 @ r - 43.2) < 1e-9 and abs(sse_after(r, 75, NU) - 37.6) < 1e-9

# --- 3. Три раунда: свободно ↔ пни ---
print(f"\n{'шаг':>3s} | {'свободно: Σr²':>13s} {'80 м²':>6s} {'65 м²':>6s} | "
      f"{'пни: Σr²':>9s} {'80 м²':>6s} {'65 м²':>6s} {'порог':>6s} {'cos(h, r)':>9s}")
F_free, F_boost, F_new = F0.copy(), F0.copy(), float(y.mean())
rounds = []
for k in range(4):
    res = y - F_boost
    t_k = min(THRESHOLDS, key=lambda t: sse_after(res, t, 1.0))  # перебор порогов
    h_k, left_k, right_k = stump(res, t_k)
    cos_k = h_k @ res / np.linalg.norm(h_k) / np.linalg.norm(res)
    assert abs((h_k @ res) / (h_k @ h_k) - 1) < 1e-12, "ρ* = 1 в каждом раунде"
    row = (np.sum((y - F_free) ** 2), F_free[-1], float(y.mean()), res @ res, F_boost[-1], F_new,
           t_k, cos_k)
    rounds.append(row)
    print(f"{k:3d} | {row[0]:13.3f} {row[1]:6.2f} {row[2]:6.2f} | {row[3]:9.3f} {row[4]:6.2f} "
          f"{row[5]:6.2f} {row[6]:6.0f} {row[7]:9.3f}")
    F_free = F_free + NU * (y - F_free)
    F_new += NU * (left_k if NEW <= t_k else right_k)  # новая квартира попадает в свой лист
    F_boost = F_boost + NU * h_k

expected = [(70, 7, 7, 70, 7, 7, 55, 0.878), (17.5, 10, 7, 29.5, 8.5, 8.5, 75, 0.908),
            (4.375, 11.5, 7, 11.275, 10.75, 8.05, 65, 0.825),
            (1.094, 12.25, 7, 5.515, 11.55, 7.65, 35, 0.770)]
for row, want in zip(rounds, expected):
    assert np.allclose(row, want, atol=5e-4), f"таблица шага 14: {row} против {want}"
assert all(row[7] > 0 for row in rounds), "каждый шаг-пень — направление спуска"
assert all(row[0] < row[3] for row in rounds[1:]), "свободно быстрее на обучении"

# --- рисунок ---
fig, axes = plt.subplots(1, 3, figsize=(14, 4.1))
ax = axes[0]
ax.bar(x - 2.2, r, width=4, color=style.MUTED, label="антиградиент r (остатки)")
ax.bar(x + 2.2, h, width=4, color=style.ORANGE, label=f"шаг-пень h, порог {best_t:.0f}")
ax.axhline(0, color=style.INK_2, lw=0.8)
ax.set(xlabel="площадь, м²", ylabel="поправка, млн", title="Пень огрубляет антиградиент")
ax.legend(fontsize=8, loc="upper left")

ax = axes[1]
ts = np.linspace(25, 85, 1201)
sse_t = [sse_after(r, t, 1.0) if x[0] <= t < x[-1] else float(r @ r) for t in ts]
ax.plot(ts, sse_t, color=style.BLUE, drawstyle="steps-post", label="сумма квадратов после пня")
for t in THRESHOLDS:
    ax.annotate(f"{relief[t]:.1f}", (t, relief[t]), xytext=(0, 6), textcoords="offset points",
                ha="center", fontsize=8.5, color=style.INK_2)
ax.plot([best_t], [relief[best_t]], "o", color=style.BLUE, ms=7, mec=style.SURFACE)
ax.set(xlabel="порог t, м²", ylabel="Σ(rᵢ − hᵢ)²", title="Рельеф по порогу: ступеньки, наклон 0",
       ylim=(0, 78))
ax.legend(fontsize=8, loc="lower right")

ax = axes[2]
ks = np.arange(4)
ax.axhline(13, color=style.MUTED, lw=1.2, ls=(0, (1, 3)))
ax.annotate("цена квартиры 80 м²: 13", (0, 13), xytext=(0, 5), textcoords="offset points",
            fontsize=8.5, color=style.INK_2)
ax.plot(ks, [row[1] for row in rounds], color=style.ORANGE, marker="s", ms=6, mec=style.SURFACE,
        label="свободно: 80 м² (обучение)")
ax.plot(ks, [row[2] for row in rounds], color=style.ORANGE, ls=(0, (4, 3)), marker="s", ms=6,
        mec=style.SURFACE, label="свободно: 65 м² (новая)")
ax.plot(ks, [row[4] for row in rounds], color=style.BLUE, marker="o", ms=6, mec=style.SURFACE,
        label="через пни: 80 м²")
ax.plot(ks, [row[5] for row in rounds], color=style.BLUE, ls=(0, (4, 3)), marker="o", ms=6,
        mec=style.SURFACE, label="через пни: 65 м²")
ax.set(xlabel="шаг", ylabel="прогноз, млн", title="Свободный шаг не трогает новую квартиру",
       xticks=ks, ylim=(3, 14))
ax.legend(fontsize=7.5, loc="lower right")
fig.tight_layout()
ex.finish(fig, "tree_step")
