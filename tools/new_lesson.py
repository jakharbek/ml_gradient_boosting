#!/usr/bin/env python
"""Создать заготовку нового урока со стандартной структурой.

    python tools/new_lesson.py lesson_5_4 "Название урока" [--short "Коротко"] [--level 2] [--duration 40]

Создаёт lessons/<id>/ с lesson.json, web/index.html (каркас разделов), web/lesson.js,
исходником ноутбука, примером, упражнениями и пустыми data/ и assets/.
Затем: заполните содержимое и выполните python tools/build.py && python tools/check.py.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

HTML = """<!doctype html>
<html lang="ru" data-lesson="{id}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{number} {title}</title>
  <link rel="icon" href="../../../shared/web/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../../../shared/web/css/course.css">
  <script src="../../../shared/web/js/boot.js" data-root="../../../" data-scripts="lesson.js"></script>
</head>
<body>
<main class="lesson" id="lesson">

<section id="why">
  <h2>Зачем это нужно</h2>
  <p class="lead">…</p>
</section>

<section id="intuition">
  <h2>Интуиция</h2>
  <div class="callout intuition"><p>…</p></div>
</section>

<section id="formal">
  <h2>Формально</h2>
  <div class="formula">$$ … $$</div>
</section>

<section id="bones">
  <h2>Разбор по косточкам</h2>
  <div class="bones">
    <details class="bone"><summary>…</summary><div class="bone-body"><p>…</p></div></details>
  </div>
</section>

<section id="code">
  <h2>В коде</h2>
  <div class="pycell" data-title="…">
<pre><code class="language-python">print("Привет, бустинг!")</code></pre>
  </div>
</section>

<section id="summary">
  <h2>Итоги</h2>
  <div class="key-points"><ol><li>…</li></ol></div>
</section>

<section id="quiz">
  <h2>Проверь себя</h2>
  <div class="quiz"><script type="application/json">
  [{{"q": "…", "options": ["…", "…"], "answer": 0, "explain": "…"}}]
  </script></div>
</section>

</main>
</body>
</html>
"""

NOTEBOOK = '''# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only {id}

# %% [markdown]
# # Урок {number}. {title}
#
# **Интерактивная версия:** `lessons/{id}/web/index.html`

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import numpy as np
import matplotlib.pyplot as plt
from gbcourse import datasets
from gbcourse.plotting import use_course_style

use_course_style()
'''

EXAMPLE = '''"""{title}: пример.

Запуск:  python lessons/{id}/examples/example.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt

from gbcourse.cli import Example

ex = Example(__file__)
fig, ax = plt.subplots()
ex.finish(fig, "example")
'''


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("id")
    ap.add_argument("title")
    ap.add_argument("--short")
    ap.add_argument("--level", type=int, default=1)
    ap.add_argument("--duration", type=int, default=40)
    a = ap.parse_args()
    if not re.fullmatch(r"lesson(_\d+)+", a.id):
        sys.exit("id должен выглядеть как lesson_4 или lesson_4_2")
    d = ROOT / "lessons" / a.id
    if d.exists():
        sys.exit(f"{d} уже существует")
    number = ".".join(a.id.split("_")[1:])
    for sub in ("web", "jupyter_notebooks", "examples", "data", "exercises", "assets/figures"):
        (d / sub).mkdir(parents=True)
    meta = {"id": a.id, "title": a.title, "short": a.short or a.title, "subtitle": "", "summary": "",
            "level": a.level, "duration": a.duration, "prerequisites": [], "objectives": [], "keywords": [], "datasets": []}
    (d / "lesson.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    fmt = dict(id=a.id, number=number, title=a.title)
    (d / "web" / "index.html").write_text(HTML.format(**fmt), encoding="utf-8")
    (d / "web" / "lesson.js").write_text(f"/* Урок {number}: виджеты урока. */\n(function () {{\n  'use strict';\n}})();\n", encoding="utf-8")
    (d / "jupyter_notebooks" / f"{a.id}_notebook.py").write_text(NOTEBOOK.format(**fmt), encoding="utf-8")
    (d / "examples" / "example.py").write_text(EXAMPLE.format(**fmt), encoding="utf-8")
    (d / "exercises" / "tasks.md").write_text(f"# Упражнения к уроку {number}\n\n## 1. … ★☆☆\n", encoding="utf-8")
    (d / "exercises" / "solutions.py").write_text(f'"""Решения упражнений урока {number}."""\n', encoding="utf-8")
    (d / "assets" / "figures" / ".gitkeep").write_text("", encoding="utf-8")
    print(f"Создан {d.relative_to(ROOT)}. Если это новый модуль — добавьте его в course.json → parts.")


if __name__ == "__main__":
    main()
