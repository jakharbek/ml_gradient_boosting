"""Ошибка классификатора: матрица ошибок, доля верных, полнота и точность.

Запуск:  python lessons/lesson_1_1/examples/classification_by_hand.py [--save] [--no-show]

12 заёмщиков (шаг 10 урока): признак — доля дохода, уходящая на платежи, ответ — вернул ли кредит.
Правило «x ≥ t → не вернёт». Скрипт считает матрицу ошибок руками при t = 50, перебирает пороги
и показывает, как доля верных обманывает на редком классе (50 операций, 2 мошеннические).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import style
from gbcourse.cli import Example
from gbcourse.rng import Mulberry32

ex = Example(__file__)

x = np.array([12, 18, 25, 30, 34, 41, 47, 52, 58, 63, 71, 80.0])  # платежи, % дохода
y = np.array([0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1])  # 1 — не вернул


def report(x: np.ndarray, y: np.ndarray, t: float) -> dict:
    """Матрица ошибок и метрики правила «x ≥ t → класс 1»."""
    pred = (x >= t).astype(int)
    tp = int(np.sum((pred == 1) & (y == 1)))
    fp = int(np.sum((pred == 1) & (y == 0)))
    fn = int(np.sum((pred == 0) & (y == 1)))
    tn = int(np.sum((pred == 0) & (y == 0)))
    return {
        "TP": tp, "FP": fp, "FN": fn, "TN": tn,
        "accuracy": (tp + tn) / len(y),
        "recall": tp / (tp + fn) if tp + fn else float("nan"),
        "precision": tp / (tp + fp) if tp + fp else float("nan"),
    }


r50 = report(x, y, 50)
print("Порог t = 50:")
print("                 прогноз 0   прогноз 1")
print(f"  на деле 0 (вернул)    {r50['TN']:2d}          {r50['FP']:2d}")
print(f"  на деле 1 (не вернул) {r50['FN']:2d}          {r50['TP']:2d}")
base = max(y.mean(), 1 - y.mean())
print(f"  доля верных {r50['accuracy']:.3f} (базовая «все вернут» {base:.3f}), "
      f"полнота {r50['recall']:.2f}, точность {r50['precision']:.2f}\n")
assert (r50["TN"], r50["FP"], r50["FN"], r50["TP"]) == (6, 1, 1, 4), "числа шага 10 урока"

print("Порог   TP FP FN TN   доля верных  полнота  точность")
for t in (0, 32, 50, 66, 101):
    r = report(x, y, t)
    print(f"  {t:4d}   {r['TP']:2d} {r['FP']:2d} {r['FN']:2d} {r['TN']:2d}     {r['accuracy']:.3f}     "
          f"{r['recall']:.2f}     {r['precision']:.2f}")
assert report(x, y, 32)["recall"] == 1.0 and report(x, y, 66)["FP"] == 0

# редкий класс: 48 обычных операций и 2 мошеннические (как в виджете)
rng = Mulberry32(4)
xf = np.array([int(rng.uniform(5, 75)) for _ in range(48)] + [61.5, 86.5])
yf = np.array([0] * 48 + [1, 1])
print("\n50 операций, 2 мошеннические:")
for t, name in ((101, "всё обычное"), (80, "порог 80"), (60, "порог 60")):
    r = report(xf, yf, t)
    print(f"  {name:12s}: доля верных {r['accuracy']:.2f}, поймано {r['TP']} из 2, ложных тревог {r['FP']}")
assert report(xf, yf, 101)["accuracy"] == 0.96 and report(xf, yf, 101)["TP"] == 0

ts = np.arange(0, 101, 0.5)
curves = {k: [report(x, y, t)[k] for t in ts] for k in ("accuracy", "recall", "precision")}
fig, axes = plt.subplots(1, 2, figsize=(11, 3.8))
ax = axes[0]
for cls, marker in ((0, "o"), (1, "s")):
    m = y == cls
    ax.scatter(x[m], y[m], color=style.ROLE["classes"][cls], marker=marker, s=60, zorder=3,
               label=("0: вернул", "1: не вернул")[cls])
ax.axvline(50, color=style.INK, ls=(0, (5, 3)), lw=1.5)
ax.axvspan(50, 100, color=style.ORANGE, alpha=0.08)
ax.set(xlabel="платежи по кредитам, % дохода", ylabel="класс", yticks=[0, 1], xlim=(0, 100),
       title="Правило «x ≥ 50 → не вернёт»")
ax.legend(loc="center left")
ax = axes[1]
ax.plot(ts, curves["accuracy"], label="доля верных", color=style.BLUE)
ax.plot(ts, curves["recall"], label="полнота", color=style.ORANGE)
ax.plot(ts, curves["precision"], label="точность", color=style.AQUA)
ax.axhline(base, color=style.MUTED, ls=(0, (4, 3)), lw=1, label="базовая доля верных")
ax.set(xlabel="порог t", ylabel="значение метрики", ylim=(0, 1.05), title="Порог меняет один вид ошибок на другой")
ax.legend(fontsize=8, loc="lower left")
fig.tight_layout()
ex.finish(fig, "classification_by_hand")
