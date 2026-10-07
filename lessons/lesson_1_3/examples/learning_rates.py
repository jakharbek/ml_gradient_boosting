"""Темп обучения и шаг Ньютона на «двух ямах»: кто куда приходит.

Запуск:  python lessons/lesson_1_3/examples/learning_rates.py [--save] [--no-show]

Шаги 6–9 урока на одной функции f(θ) = θ⁴/4 − θ² + 0.3θ: глубокая яма у θ ≈ −1.484, мелкая у
θ ≈ 1.332 и горб между ними у θ ≈ 0.152. Кривизна f″ = 3θ² − 2 разная в разных местах, поэтому и
граница темпа 2/f″ у каждой ямы своя (шаг 6), а куда скатится спуск, решает старт (шаг 7).

Сравниваем градиентный спуск с темпами η = 0.05, 0.2, 0.45 и шаг Ньютона θ ← θ − f′/f″ (шаг 9) из
двух стартов: θ₀ = −2 (склон глубокой ямы) и θ₀ = 0.5 (там f″ < 0 — «шапка»). Что увидим:
* η = 0.05 и η = 0.2 сходятся в глубокую яму, но с разной скоростью: множители 1 − ηf″ — 0.77
  и 0.08;
* η = 0.45 больше границы 2/4.61 = 0.434 глубокой ямы — спуск навсегда качается вокруг её дна;
  у мелкой ямы граница 2/3.32 = 0.60, и из θ₀ = 0.5 тот же темп спокойно сходится;
* Ньютон из −2 приходит в яму за 4 шага (верные знаки удваиваются), а из 0.5 — прямиком на горб:
  где f″ < 0, приближающая парабола смотрит вниз, и её «дно» — это вершина.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import style
from gbcourse.cli import Example

ex = Example(__file__)


def f(t: float) -> float:
    """«Две ямы»: θ⁴/4 − θ² + 0.3θ."""
    return t**4 / 4 - t**2 + 0.3 * t


def df(t: float) -> float:
    return t**3 - 2 * t + 0.3


def d2f(t: float) -> float:
    return 3 * t**2 - 2


DEEP, HUMP, SHALLOW = np.sort(np.roots([1, 0, -2, 0.3]).real)  # корни f′(θ) = 0
NAMES = {DEEP: "глубокая яма", HUMP: "горб (максимум)", SHALLOW: "мелкая яма"}
RATES = (0.05, 0.2, 0.45)
COLORS = {0.05: style.BLUE, 0.2: style.AQUA, 0.45: style.ORANGE, "Ньютон": style.VIOLET}
K = 200  # шагов: η = 0.05 нужно ~60 шагов до 1e-6 и больше — до 1e-9


def run(t0: float, method: float | str, steps: int = K) -> np.ndarray:
    """Путь θ₀, θ₁, …: спуск с темпом method или шаг Ньютона (method = "Ньютон")."""
    path = [t0]
    for _ in range(steps):
        t = path[-1]
        path.append(t - df(t) / d2f(t) if method == "Ньютон" else t - method * df(t))
    return np.array(path)


def verdict(path: np.ndarray) -> tuple[str, float | None, int | None]:
    """Куда пришёл путь: имя точки, сама точка и число шагов до точности 1e-6 (или качели)."""
    end = path[-1]
    for point, name in NAMES.items():
        if abs(end - point) < 1e-9:
            k = int(np.argmax(np.abs(path - point) < 1e-6))
            return name, point, k
    if abs(path[-1] - path[-3]) < 1e-9:
        lo, hi = sorted(path[-2:])
        return f"качели {lo:.3f} ↔ {hi:.3f}".replace("-", "−"), None, None
    return "не сошёлся", None, None


print("Особые точки f′(θ) = 0:")
print(f"{'точка':>16s} {'θ':>8s} {'f(θ)':>8s} {'f″(θ)':>8s} {'граница 2/f″':>13s}")
for point, name in NAMES.items():
    border = f"{2 / d2f(point):13.3f}" if d2f(point) > 0 else f"{'—':>13s}"
    print(f"{name:>16s} {point:8.3f} {f(point):8.3f} {d2f(point):8.3f} {border}")

paths = {}
print(f"\n{'метод':>10s}   {'старт θ₀ = −2':<34s} {'старт θ₀ = 0.5':<34s}")
for method in (*RATES, "Ньютон"):
    cells = []
    for t0 in (-2.0, 0.5):
        paths[method, t0] = run(t0, method)
        name, _, k = verdict(paths[method, t0])
        cells.append(f"{name}" + (f", шагов до 1e-6: {k}" if k is not None else ""))
    label = f"η = {method:g}" if method != "Ньютон" else method
    print(f"{label:>10s}   {cells[0]:<34s} {cells[1]:<34s}")

print("\nМножители 1 − η·f″ у дна каждой ямы (шаг 6: |множитель| < 1 — сходимость):")
for eta in RATES:
    q_deep, q_shallow = 1 - eta * d2f(DEEP), 1 - eta * d2f(SHALLOW)
    print(f"  η = {eta:<4g}: глубокая {q_deep:+.3f}, мелкая {q_shallow:+.3f}")

newton = paths["Ньютон", -2.0]
errors = np.abs(newton[:6] - DEEP)
print("\nНьютон из −2: ошибка |θₖ − θ*| по шагам —", ", ".join(f"{e:.1e}" for e in errors))
print(f"Ньютон из 0.5: θ = {', '.join(f'{v:.4f}' for v in paths['Ньютон', 0.5][:4])} — "
      f"f″(0.5) = {d2f(0.5):.2f} < 0, и шаг ведёт вверх: f {f(0.5):.4f} → {f(HUMP):.4f}")
print("Водораздел у горба (η = 0.2): старт 0.16 →",
      verdict(run(0.16, 0.2, 400))[0], "| старт 0.14 →", verdict(run(0.14, 0.2, 400))[0])

# --- ключевые утверждения (числа шагов 6–9 урока) ---
assert np.allclose([DEEP, HUMP, SHALLOW], [-1.484, 0.152, 1.332], atol=5e-4)
assert d2f(DEEP) > 0 and d2f(SHALLOW) > 0 and d2f(HUMP) < 0, "две ямы и горб"
assert np.allclose([d2f(DEEP), d2f(SHALLOW), d2f(HUMP)], [4.6, 3.3, -1.9], atol=0.05)
assert f(DEEP) < f(SHALLOW), "глубокая яма — глобальный минимум, мелкая — локальный"
assert abs(2 / d2f(DEEP) - 0.434) < 5e-4 and abs(2 / d2f(SHALLOW) - 0.602) < 5e-4
for eta in (0.05, 0.2):
    assert verdict(paths[eta, -2.0])[1] == DEEP, f"η = {eta} из −2 — в глубокую яму"
    assert verdict(paths[eta, 0.5])[1] == SHALLOW, f"η = {eta} из 0.5 — в мелкую яму"
assert verdict(paths[0.2, -2.0])[2] < verdict(paths[0.05, -2.0])[2] / 5, "η = 0.2 быстрее"
swing = paths[0.45, -2.0]
assert verdict(swing)[1] is None, "η = 0.45 > 2/f″ глубокой ямы — не сходится"
assert abs(swing[-1] - swing[-3]) < 1e-9 and abs(swing[-1] - swing[-2]) > 0.2, "устойчивые качели"
assert np.allclose(sorted(swing[-2:]), [-1.609, -1.317], atol=5e-4)
assert verdict(paths[0.45, 0.5])[1] == SHALLOW, "в мелкой яме тот же темп ниже границы 0.602"
assert verdict(newton)[1] == DEEP and verdict(newton)[2] == 4, "Ньютон: 4 шага до 1e-6"
assert all(errors[k + 1] < errors[k] ** 2 for k in range(3)), "квадратичная сходимость"
assert verdict(paths["Ньютон", 0.5])[1] == HUMP, "где f″ < 0, Ньютон идёт к максимуму"
assert f(HUMP) > f(0.5), "Ньютон из 0.5 поднялся, а не спустился"
assert verdict(run(0.16, 0.2, 400))[1] == SHALLOW and verdict(run(0.14, 0.2, 400))[1] == DEEP

# --- рисунок ---
fig, axes = plt.subplots(1, 3, figsize=(14, 4.1))
ax = axes[0]
grid = np.linspace(-2.15, 2.0, 400)
ax.plot(grid, [f(t) for t in grid], color=style.INK_2, lw=1.6, label="f(θ)")
for method, t0 in ((0.2, 0.5), ("Ньютон", 0.5)):
    p = paths[method, t0][:12]
    label = f"η = {method:g} из 0.5" if method != "Ньютон" else "Ньютон из 0.5"
    ax.plot(p, [f(t) for t in p], color=COLORS[method], marker="o", ms=5, mec=style.SURFACE,
            lw=1.2, label=label)
for point, name in NAMES.items():
    ax.annotate(name.split(" (")[0], (point, f(point)), xytext=(0, -16 if d2f(point) > 0 else 9),
                textcoords="offset points", ha="center", fontsize=8.5, color=style.INK_2)
ax.set(xlabel="θ", ylabel="f(θ)", title="Из одной точки: спуск вниз, Ньютон — на горб",
       ylim=(-1.75, 1.0))
ax.legend(fontsize=8, loc="upper center")

ax = axes[1]
for method in (*RATES, "Ньютон"):
    label = f"η = {method:g}" if method != "Ньютон" else "Ньютон"
    ax.plot(paths[method, -2.0][:31], color=COLORS[method], label=label,
            marker="o" if method == "Ньютон" else None, ms=5, mec=style.SURFACE)
ax.axhline(DEEP, color=style.MUTED, lw=1.2, ls=(0, (4, 3)), label="дно глубокой ямы")
ax.set(xlabel="шаг k", ylabel="θₖ", title="Старт −2: η = 0.45 > 2/f″ = 0.434 качается",
       ylim=(-2.1, -0.2))
ax.legend(fontsize=8, loc="upper right")

ax = axes[2]
for method in (*RATES, "Ньютон"):
    err = np.abs(paths[method, -2.0][:41] - DEEP)
    err = np.where(err > 0, err, np.nan)
    label = f"η = {method:g}" if method != "Ньютон" else "Ньютон"
    ax.semilogy(err, color=COLORS[method], marker="o" if method == "Ньютон" else None, ms=5,
                mec=style.SURFACE, label=label)
ax.set(xlabel="шаг k", ylabel="|θₖ − θ*|", title="Линейная сходимость против квадратичной",
       ylim=(1e-12, 3))
ax.legend(fontsize=8, loc="lower right")
fig.tight_layout()
ex.finish(fig, "learning_rates")
