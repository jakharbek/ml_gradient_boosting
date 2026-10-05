"""Мини-помощник для скриптов из ``lessons/*/examples`` и ``exercises``.

    ex = Example(__file__)        # разбирает --save / --no-show, включает стиль курса
    ...
    ex.finish(fig, "имя_рисунка")  # сохранит в <урок>/assets/figures/имя.png (с --save) и покажет

Флаги командной строки:
    --save     сохранить рисунки в папку assets/figures урока;
    --no-show  не открывать окна (для автоматического запуска: tools/build.py examples).
"""

from __future__ import annotations

import argparse
from pathlib import Path


class Example:
    def __init__(self, file: str, description: str | None = None) -> None:
        import sys

        for stream in (sys.stdout, sys.stderr):  # кириллица в консоли Windows
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
        self.path = Path(file).resolve()
        self.lesson_dir = self.path.parents[1]
        ap = argparse.ArgumentParser(description=description)
        ap.add_argument("--save", action="store_true", help="сохранить рисунки в assets/figures урока")
        ap.add_argument("--no-show", action="store_true", help="не показывать окна с графиками")
        args, _ = ap.parse_known_args()
        self.save = args.save
        self.show = not args.no_show
        if not self.show:
            import matplotlib

            matplotlib.use("Agg")
        from .style import use_course_style

        use_course_style()

    @property
    def figures_dir(self) -> Path:
        d = self.lesson_dir / "assets" / "figures"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def finish(self, fig, name: str) -> None:
        import matplotlib.pyplot as plt

        if self.save:
            out = self.figures_dir / f"{name}.png"
            fig.savefig(out, dpi=130, bbox_inches="tight")
            print(f"рисунок сохранён: {out.relative_to(self.lesson_dir.parents[1])}")
        if self.show:
            plt.show()
        plt.close(fig)
