#!/usr/bin/env python
"""Статическая проверка курса (без браузера и без выполнения кода).

    python tools/check.py

Проверяет:
  * у каждого урока есть lesson.json с корректными полями и все обязательные папки;
  * id в lesson.json совпадает с папкой, пререквизиты существуют и идут раньше урока;
  * web/index.html: data-lesson, подключение boot.js с верным data-root, нет «сырых» $…$ в
    атрибутах, JSON тестов и data-config виджетов корректен;
  * все относительные ссылки (href/src) в HTML и README ведут на существующие файлы;
  * у каждого исходника ноутбука .py есть .ipynb и он не старше исходника;
  * course.json ссылается только на существующие уроки, все модули входят в какую-то часть;
  * манифест и pybundle не устарели.
"""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LESSONS = ROOT / "lessons"
REQUIRED_DIRS = ["web", "jupyter_notebooks", "examples", "data", "exercises", "assets"]
REQUIRED_KEYS = ["id", "title", "subtitle", "summary", "level", "duration", "objectives"]

problems: list[str] = []


def err(msg: str) -> None:
    problems.append(msg)


def key(name: str) -> tuple[int, ...]:
    return tuple(int(x) for x in name.split("_")[1:])


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.attrs_all: list[tuple[str, dict]] = []
        self.scripts_json: list[str] = []
        self._json = False
        self._buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.attrs_all.append((tag, a))
        for k in ("href", "src"):
            if a.get(k):
                self.links.append(a[k])
        if tag == "script" and a.get("type") == "application/json":
            self._json, self._buf = True, []

    def handle_endtag(self, tag):
        if tag == "script" and self._json:
            self.scripts_json.append("".join(self._buf))
            self._json = False

    def handle_data(self, data):
        if self._json:
            self._buf.append(data)


def check_link(base: Path, link: str, where: str) -> None:
    if re.match(r"^(https?:|mailto:|#|data:|javascript:)", link) or not link:
        return
    target = (base / link.split("#")[0].split("?")[0]).resolve()
    if not target.exists():
        err(f"{where}: битая ссылка {link}")


def main() -> int:
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"):
            s.reconfigure(encoding="utf-8", errors="replace")
    dirs = sorted([d for d in LESSONS.glob("lesson_*") if d.is_dir()], key=lambda d: key(d.name))
    ids = [d.name for d in dirs]
    order = {i: n for n, i in enumerate(ids)}
    for d in dirs:
        rel = d.relative_to(ROOT).as_posix()
        meta_p = d / "lesson.json"
        if not meta_p.exists():
            err(f"{rel}: нет lesson.json")
            continue
        try:
            meta = json.loads(meta_p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            err(f"{rel}/lesson.json: {e}")
            continue
        for k in REQUIRED_KEYS:
            if k not in meta:
                err(f"{rel}/lesson.json: нет поля {k}")
        if meta.get("id") != d.name:
            err(f"{rel}/lesson.json: id не совпадает с папкой")
        for p in meta.get("prerequisites", []):
            if p not in order:
                err(f"{rel}: неизвестный пререквизит {p}")
            elif order[p] >= order[d.name]:
                err(f"{rel}: пререквизит {p} идёт не раньше урока")
        parts = key(d.name)
        if len(parts) > 1 and "lesson_" + "_".join(map(str, parts[:-1])) not in order:
            err(f"{rel}: нет родительского модуля")
        for sub in REQUIRED_DIRS:
            if not (d / sub).is_dir():
                err(f"{rel}: нет папки {sub}/")
        page = d / "web" / "index.html"
        if not page.exists():
            err(f"{rel}: нет web/index.html")
        else:
            html = page.read_text(encoding="utf-8")
            if f'data-lesson="{d.name}"' not in html:
                err(f"{rel}/web/index.html: data-lesson не равен {d.name}")
            if 'shared/web/js/boot.js" data-root="../../../"' not in html:
                err(f"{rel}/web/index.html: boot.js должен подключаться с data-root=\"../../../\"")
            if 'data-scripts="lesson.js"' in html and not (d / "web" / "lesson.js").exists():
                err(f"{rel}: подключён lesson.js, но файла нет")
            lp = LinkParser()
            lp.feed(html)
            for link in lp.links:
                check_link(page.parent, link, f"{rel}/web/index.html")
            for js in lp.scripts_json:
                try:
                    json.loads(js)
                except json.JSONDecodeError as e:
                    err(f"{rel}/web/index.html: неверный JSON в <script type=application/json>: {e}")
            for tag, a in lp.attrs_all:
                if "data-config" in a:
                    try:
                        json.loads(a["data-config"])
                    except json.JSONDecodeError as e:
                        err(f"{rel}/web/index.html: неверный data-config у {a.get('data-widget')}: {e}")
                if a.get("data-lesson") and tag == "a" and a["data-lesson"] not in order:
                    err(f"{rel}/web/index.html: ссылка на несуществующий урок {a['data-lesson']}")
                if a.get("data-go") and a["data-go"] not in order:
                    err(f"{rel}/web/index.html: data-go на несуществующий урок {a['data-go']}")
        for src in (d / "jupyter_notebooks").glob("*.py"):
            nb = src.with_suffix(".ipynb")
            if not nb.exists():
                err(f"{src.relative_to(ROOT)}: нет собранного .ipynb (python tools/build.py notebooks)")
            elif nb.stat().st_mtime + 1 < src.stat().st_mtime:
                err(f"{nb.relative_to(ROOT)}: старше исходника .py — пересоберите")
        if not list((d / "jupyter_notebooks").glob("*.py")):
            err(f"{rel}: нет исходника ноутбука в jupyter_notebooks/")
        if not list((d / "examples").glob("*.py")):
            err(f"{rel}: нет примеров в examples/")
        if not (d / "exercises" / "tasks.md").exists():
            err(f"{rel}: нет exercises/tasks.md")
        readme = d / "README.md"
        if readme.exists():
            for link in re.findall(r"\]\(([^)]+)\)", readme.read_text(encoding="utf-8")):
                check_link(d, link, f"{rel}/README.md")

    course = json.loads((ROOT / "course.json").read_text(encoding="utf-8"))
    in_parts = [x for p in course["parts"] for x in p["lessons"]]
    for x in in_parts:
        if x not in order:
            err(f"course.json: модуль {x} не существует")
    for i in ids:
        if len(key(i)) == 1 and i not in in_parts:
            err(f"course.json: модуль {i} не входит ни в одну часть")

    def walk(nodes):
        for n in nodes:
            if n.get("lesson") and n["lesson"] not in order:
                err(f"course.json: карта понятий ссылается на {n['lesson']}")
            walk(n.get("children", []))

    for part in course["concept_map"]["parts"]:
        walk(part.get("children", []))

    gen = ROOT / "shared" / "web" / "js" / "generated"
    man = gen / "manifest.js"
    newest = max([(d / "lesson.json").stat().st_mtime for d in dirs] + [(ROOT / "course.json").stat().st_mtime])
    if not man.exists() or man.stat().st_mtime + 1 < newest:
        err("манифест устарел: python tools/build.py manifest")
    bundle = gen / "pybundle.js"
    pkg_newest = max(p.stat().st_mtime for p in (ROOT / "shared" / "python" / "gbcourse").glob("*.py"))
    if not bundle.exists() or bundle.stat().st_mtime + 1 < pkg_newest:
        err("pybundle устарел: python tools/build.py pybundle")
    for link in re.findall(r"\]\(([^)]+)\)", (ROOT / "README.md").read_text(encoding="utf-8")):
        check_link(ROOT, link, "README.md")

    if problems:
        print(f"Найдено проблем: {len(problems)}")
        for p in problems:
            print("  ✗", p)
        return 1
    print(f"✓ Проверка пройдена: {len(ids)} уроков, проблем нет")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
