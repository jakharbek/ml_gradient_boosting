"""Общий помощник для примеров из папки examples/.

Каждый пример начинается так:

    from _common import Example
    ex = Example(__file__, title="…", goal="…")

и дальше пользуется:

    ex.stage(1, "Данные")                  # заголовок этапа в выводе
    ex.describe(X, y, names=…, target=…)   # «раскрытие» набора данных: размер, типы, пропуски, цель
    with ex.timer("обучение"): …            # замер времени
    ex.finish(fig, "имя")                   # сохранить (--save) и/или показать рисунок

Флаги командной строки (одинаковые во всех примерах):
    --save     сохранить рисунки в examples/<уровень>/figures/
    --no-show  не открывать окна с графиками (для автоматического запуска)
    --quick    уменьшенные данные — для быстрой проверки (run_all.py --quick)

В Jupyter (ноутбуки из examples/<уровень>/notebooks/) тот же код работает в «режиме ноутбука»:
заголовки этапов — markdown-ячейки, выводы ▸ показываются оформленными блоками, первые строки
данных — таблицей, графики — прямо в ноутбуке. Уменьшенные данные в Jupyter: переменная окружения
EXAMPLES_QUICK=1 до запуска.
"""

from __future__ import annotations

import argparse
import html
import logging
import os
import re
import sys
import time
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np  # noqa: E402

logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)  # «findfont: … semibold» — шум, а не ошибка

LINE = "━" * 88


class Example:
    """Каркас примера: разбор флагов, стиль графиков, этапы, описание данных, таймер, сохранение рисунков."""

    def __init__(self, file: str, title: str, goal: str) -> None:
        for stream in (sys.stdout, sys.stderr):  # кириллица в консоли Windows
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
        self.path = Path(file).resolve()
        ap = argparse.ArgumentParser(description=title)
        ap.add_argument("--save", action="store_true", help="сохранить рисунки в figures/ уровня")
        ap.add_argument("--no-show", action="store_true", help="не показывать окна с графиками")
        ap.add_argument("--quick", action="store_true", help="уменьшенные данные для быстрой проверки")
        args, _ = ap.parse_known_args()
        self.notebook = "ipykernel" in sys.modules              # код выполняется в Jupyter / ячейках VS Code
        self.save, self.show = args.save, not args.no_show
        self.quick = args.quick or os.environ.get("EXAMPLES_QUICK") == "1"
        if not self.show:
            import matplotlib

            matplotlib.use("Agg")
        from gbcourse.style import use_course_style

        use_course_style()
        self.t0 = time.perf_counter()
        if self.notebook:                                       # название и цель уже есть в markdown ноутбука
            if self.quick:
                print("Режим EXAMPLES_QUICK: данные уменьшены, числа будут отличаться от README.")
            return
        print(LINE)
        print(f"{title}")
        print(f"Цель: {goal}")
        if self.quick:
            print("Режим --quick: данные уменьшены, числа будут отличаться от README.")
        print(LINE)

    # ------------------------------------------------------------------ вывод
    def stage(self, n: int | str, title: str) -> None:
        if self.notebook:
            print(f"\n▶ Этап {n}. {title}")
            return
        print(f"\n── Этап {n}. {title} " + "─" * max(0, 70 - len(title)))

    def note(self, text: str) -> None:
        """Вывод-пояснение: что мы только что увидели."""
        lines = [line.strip() for line in text.strip().splitlines()]
        if self.notebook:
            from IPython.display import display

            md = re.sub(r"([\\`*_\[\]#$|])", r"\\\1", html.escape(" ".join(lines), quote=False))
            display({"text/markdown": f"> ▸ **Вывод.** {md}", "text/plain": "\n".join(f"▸ {x}" for x in lines)},
                    raw=True)
            return
        for line in lines:
            print(f"   ▸ {line}")

    def size(self, full: int, quick: int) -> int:
        """Размер данных: полный или уменьшенный (--quick)."""
        return quick if self.quick else full

    def describe(self, X, y=None, names=None, target: str = "y", task: str = "regression", source: str = "") -> None:
        """«Раскрыть» набор данных: откуда, размер, память, типы, пропуски, распределение цели, первые строки."""
        import pandas as pd

        df = X.copy() if isinstance(X, pd.DataFrame) else pd.DataFrame(np.asarray(X), columns=names)
        mem = df.memory_usage(deep=True).sum() / 2**20
        if source:
            print(f"   Источник: {source}")
        print(f"   Объектов: {len(df):,}   признаков: {df.shape[1]}   память: {mem:.2f} МБ".replace(",", " "))
        kinds = df.dtypes.astype(str).value_counts().to_dict()
        print("   Типы признаков: " + ", ".join(f"{k} × {v}" for k, v in kinds.items()))
        na = df.isna().mean()
        if na.any():
            print("   Пропуски: " + ", ".join(f"{c} {v:.1%}" for c, v in na[na > 0].items()))
        else:
            print("   Пропусков нет")
        if y is not None:
            y = np.asarray(y)
            if task == "regression":
                print(f"   Цель «{target}»: среднее {y.mean():.3f}, σ {y.std():.3f}, мин {y.min():.3f}, макс {y.max():.3f}")
            else:
                vals, cnt = np.unique(y, return_counts=True)
                print(f"   Цель «{target}»: " + ", ".join(f"класс {v} — {c} ({c / len(y):.1%})" for v, c in zip(vals, cnt)))
        with pd.option_context("display.width", 140, "display.max_columns", 12):
            head = df.head(3)
            if y is not None:
                head = head.assign(**{f"[{target}]": np.asarray(y)[:3]})
            print("   Первые строки:")
            if self.notebook:
                from IPython.display import display

                display(head)
                return
            for line in head.to_string().splitlines():
                print("     " + line)

    @contextmanager
    def timer(self, what: str):
        t = time.perf_counter()
        yield
        print(f"   ⏱ {what}: {time.perf_counter() - t:.2f} с")

    # ------------------------------------------------------------------ рисунки
    @property
    def figures_dir(self) -> Path:
        d = self.path.parent / "figures"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def finish(self, fig, name: str) -> None:
        import matplotlib.pyplot as plt

        if self.save:
            out = self.figures_dir / f"{name}.png"
            fig.savefig(out, dpi=130, bbox_inches="tight")
            print(f"   рисунок сохранён: {out.relative_to(ROOT)}")
        if self.show:
            plt.show()
        plt.close(fig)

    def barh(self, values: dict, xlabel: str, title: str, name: str, errors: dict | None = None,
             best: str | None = None, fmt: str = "{:.3f}") -> None:
        """Горизонтальные столбцы «название → число» в стиле курса; лучший вариант выделен синим."""
        import matplotlib.pyplot as plt
        from gbcourse.style import INK, ROLE

        names = list(values)
        vals = [values[k] for k in names]
        fig, ax = plt.subplots(figsize=(8, 0.5 * len(names) + 1.3))
        colors = [ROLE["model"] if k == best else ROLE["model_prev"] for k in names]
        ax.barh(range(len(names)), vals, color=colors, height=0.6,
                xerr=[errors[k] for k in names] if errors else None, error_kw={"ecolor": INK, "lw": 1, "capsize": 3})
        ax.set_yticks(range(len(names)), names)
        ax.invert_yaxis()
        ends = [v + (errors[k] if errors else 0) for k, v in zip(names, vals)]
        for i, (v, e) in enumerate(zip(vals, ends)):
            ax.text(e, i, "  " + fmt.format(v), va="center", ha="left", color=INK, fontsize=9)
        ax.set_xlim(0, max(ends) * 1.2)
        ax.grid(axis="y", visible=False)
        ax.set(xlabel=xlabel, title=title)
        fig.tight_layout()
        self.finish(fig, name)

    def done(self) -> None:
        if self.notebook:
            print(f"Готово за {time.perf_counter() - self.t0:.1f} с")
            return
        print(f"\n{LINE}\nГотово за {time.perf_counter() - self.t0:.1f} с\n{LINE}")
