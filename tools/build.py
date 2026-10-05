#!/usr/bin/env python
"""Сборка курса «Градиентный бустинг по косточкам».

Команды (запускать из корня репозитория):

    python tools/build.py                  # всё, кроме выполнения ноутбуков и примеров
    python tools/build.py manifest         # манифест уроков + README уроков + таблица в README.md
    python tools/build.py pybundle         # gbcourse → shared/web/js/generated/pybundle.js (для Pyodide)
    python tools/build.py data             # CSV-наборы уроков по описаниям в lesson.json
    python tools/build.py notebooks        # jupyter_notebooks/*.py (формат percent) → *.ipynb
    python tools/build.py notebooks --execute [--only lesson_4_1]   # + выполнить и сохранить выводы
    python tools/build.py examples [--only lesson_4_1]              # выполнить примеры, сохранить рисунки

Источник истины:
  * метаданные урока — lessons/<id>/lesson.json;
  * ноутбук — lessons/<id>/jupyter_notebooks/<имя>.py (ячейки «# %%»), .ipynb генерируется;
  * общая структура курса — course.json.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LESSONS = ROOT / "lessons"
GENERATED = ROOT / "shared" / "web" / "js" / "generated"
PKG = ROOT / "shared" / "python" / "gbcourse"
LEVELS = {1: "Начальный", 2: "Средний", 3: "Продвинутый", 4: "Экспертный"}
AUTOGEN = "<!-- Файл создан автоматически: python tools/build.py manifest. Правьте lesson.json. -->"

sys.path.insert(0, str(ROOT / "shared" / "python"))


# =====================================================================================
# Уроки
# =====================================================================================

def lesson_key(lesson_id: str) -> tuple[int, ...]:
    return tuple(int(p) for p in lesson_id.split("_")[1:])


def lesson_dirs() -> list[Path]:
    dirs = [p for p in LESSONS.glob("lesson_*") if p.is_dir() and re.fullmatch(r"lesson(_\d+)+", p.name)]
    return sorted(dirs, key=lambda p: lesson_key(p.name))


def load_lesson(d: Path) -> dict:
    meta_path = d / "lesson.json"
    if not meta_path.exists():
        raise SystemExit(f"Нет {meta_path.relative_to(ROOT)}")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    if meta.get("id") != d.name:
        raise SystemExit(f"{meta_path.relative_to(ROOT)}: id={meta.get('id')!r} не совпадает с папкой {d.name!r}")
    return meta


def first_heading_py(path: Path) -> str | None:
    for line in path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"#\s*#\s+(.+)", line)
        if m:
            return m.group(1).strip()
    return None


def docstring_title(path: Path) -> str | None:
    try:
        doc = ast.get_docstring(ast.parse(path.read_text(encoding="utf-8")))
    except SyntaxError:
        return None
    return doc.strip().splitlines()[0].rstrip(".") if doc else None


def discover_materials(d: Path, meta: dict) -> dict:
    rel = lambda p: p.relative_to(d).as_posix()  # noqa: E731
    nb_dir = d / "jupyter_notebooks"
    notebooks = []
    for src in sorted(nb_dir.glob("*.py")):
        ipynb = src.with_suffix(".ipynb")
        notebooks.append({"file": rel(ipynb), "source": rel(src), "title": first_heading_py(src) or ipynb.stem})
    for ipynb in sorted(nb_dir.glob("*.ipynb")):
        if not ipynb.with_suffix(".py").exists():
            notebooks.append({"file": rel(ipynb), "title": ipynb.stem})
    examples = [
        {"file": rel(p), "title": docstring_title(p) or p.stem}
        for p in sorted((d / "examples").glob("*.py"))
        if not p.name.startswith("_")
    ]
    ds_titles = {x["file"]: x.get("title") for x in meta.get("datasets", [])}
    data = [{"file": rel(p), "title": ds_titles.get(rel(p)) or p.name} for p in sorted((d / "data").glob("*.csv"))]
    exercises = []
    for p in sorted((d / "exercises").glob("*")):
        if p.suffix in (".md", ".py", ".ipynb"):
            title = "Задания" if p.suffix == ".md" else ("Решения" if "solution" in p.stem else p.stem)
            exercises.append({"file": rel(p), "title": title})
    assets = [rel(p) for p in sorted((d / "assets").rglob("*")) if p.is_file() and p.name != ".gitkeep"]
    return {"notebooks": notebooks, "examples": examples, "data": data, "exercises": exercises, "assets": assets}


def build_manifest() -> dict:
    course = json.loads((ROOT / "course.json").read_text(encoding="utf-8"))
    lessons = []
    for d in lesson_dirs():
        meta = load_lesson(d)
        parts = lesson_key(d.name)
        entry = {
            "id": d.name,
            "number": ".".join(str(p) for p in parts),
            "depth": len(parts) - 1,
            "parent": "lesson_" + "_".join(str(p) for p in parts[:-1]) if len(parts) > 1 else None,
            "title": meta["title"],
            "short": meta.get("short") or meta["title"],
            "subtitle": meta.get("subtitle", ""),
            "summary": meta.get("summary", ""),
            "level": meta.get("level", 1),
            "duration": meta.get("duration", 30),
            "prerequisites": meta.get("prerequisites", []),
            "objectives": meta.get("objectives", []),
            "keywords": meta.get("keywords", []),
            "materials": discover_materials(d, meta),
        }
        lessons.append(entry)
    manifest = {"course": course, "lessons": lessons, "generated": time.strftime("%Y-%m-%d")}
    GENERATED.mkdir(parents=True, exist_ok=True)
    js = (
        "// Создано tools/build.py — не редактируйте вручную. Источник: course.json и lesson.json уроков.\n"
        "window.GBC_MANIFEST = " + json.dumps(manifest, ensure_ascii=False, indent=1) + ";\n"
    )
    (GENERATED / "manifest.js").write_text(js, encoding="utf-8", newline="\n")
    for entry in lessons:
        write_lesson_readme(entry, {x["id"]: x for x in lessons})
    update_root_readme(course, lessons)
    print(f"✓ манифест: {len(lessons)} уроков → {(GENERATED / 'manifest.js').relative_to(ROOT)}")
    return manifest


def write_lesson_readme(e: dict, by_id: dict) -> None:
    d = LESSONS / e["id"]
    m = e["materials"]
    kind = "Модуль" if e["depth"] == 0 else "Урок"
    lines = [AUTOGEN, "", f"# {kind} {e['number']}. {e['title']}", ""]
    if e["subtitle"]:
        lines += [f"> {e['subtitle']}", ""]
    info = [f"**Уровень:** {LEVELS.get(e['level'], e['level'])}", f"**Время:** ~{e['duration']} мин"]
    if e["parent"]:
        p = by_id.get(e["parent"])
        if p:
            info.insert(0, f"**Модуль:** [{p['number']}. {p['title']}](../{p['id']}/README.md)")
    lines += [" · ".join(info), ""]
    if e["prerequisites"]:
        pre = ", ".join(
            f"[{by_id[p]['number']} {by_id[p]['title']}](../{p}/README.md)" for p in e["prerequisites"] if p in by_id
        )
        lines += [f"**Нужно знать:** {pre}", ""]
    if e["summary"]:
        lines += [e["summary"], ""]
    if e["objectives"]:
        lines += ["## После урока вы сможете", ""]
        lines += [f"- {re.sub(r'<[^>]+>', '', o)}" for o in e["objectives"]]
        lines.append("")
    kids = [x for x in by_id.values() if x["parent"] == e["id"]]
    if kids:
        lines += ["## Уроки модуля", ""]
        lines += [f"{i}. [{k['number']} {k['title']}](../{k['id']}/README.md) — {k['summary']}" for i, k in enumerate(kids, 1)]
        lines.append("")
    lines += ["## Материалы", "", "| Что | Файл |", "|---|---|", "| Интерактивный урок (открыть в браузере) | [web/index.html](web/index.html) |"]
    for nb in m["notebooks"]:
        lines.append(f"| Jupyter-ноутбук: {nb['title']} | [{nb['file']}]({nb['file']}) |")
    for ex in m["examples"]:
        lines.append(f"| Пример: {ex['title']} | [{ex['file']}]({ex['file']}) |")
    for ds in m["data"]:
        lines.append(f"| Данные: {ds['title']} | [{ds['file']}]({ds['file']}) |")
    for ex in m["exercises"]:
        lines.append(f"| {ex['title']} | [{ex['file']}]({ex['file']}) |")
    lines += [
        "",
        "## Как работать с уроком",
        "",
        "1. Откройте `web/index.html` в браузере (или запустите `python tools/serve.py` из корня курса).",
        "   Все графики интерактивны; ячейки Python выполняются прямо на странице.",
        "2. Повторите всё в ноутбуке: `jupyter lab` из корня курса → откройте файл из `jupyter_notebooks/`.",
        f"3. Запустите примеры: `python lessons/{e['id']}/examples/<файл>.py`.",
        "4. Решите упражнения из `exercises/` и сверьтесь с решениями.",
        "",
        "## Структура папки",
        "",
        "```text",
        f"{e['id']}/",
        "├── lesson.json          # метаданные урока (источник истины для навигации)",
        "├── web/                 # интерактивная страница: index.html + lesson.js",
        "├── jupyter_notebooks/   # ноутбук (.ipynb) и его исходник в формате percent (.py)",
        "├── examples/            # самостоятельные воспроизводимые скрипты",
        "├── data/                # данные урока (CSV) и их описание",
        "├── exercises/           # задания и решения",
        "└── assets/              # иллюстрации и рисунки, созданные примерами",
        "```",
        "",
    ]
    (d / "README.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")


def update_root_readme(course: dict, lessons: list[dict]) -> None:
    path = ROOT / "README.md"
    if not path.exists():
        return
    text = path.read_text(encoding="utf-8")
    start, end = "<!-- curriculum:start -->", "<!-- curriculum:end -->"
    if start not in text or end not in text:
        return
    by_id = {x["id"]: x for x in lessons}
    out = [start, ""]
    for part in course.get("parts", []):
        out += [f"### Часть {part['id']}. {part['title']}", ""]
        if part.get("description"):
            out += [part["description"], ""]
        for top_id in part["lessons"]:
            top = by_id.get(top_id)
            if not top:
                continue
            out.append(f"- **[{top['number']}. {top['title']}](lessons/{top_id}/README.md)** — {top['summary']}")
            for k in [x for x in lessons if x["parent"] == top_id]:
                out.append(f"  - [{k['number']} {k['title']}](lessons/{k['id']}/README.md)")
        out.append("")
    out.append(end)
    new = text[: text.index(start)] + "\n".join(out) + text[text.index(end) + len(end):]
    path.write_text(new, encoding="utf-8", newline="\n")


# =====================================================================================
# Pyodide-бандл
# =====================================================================================

def build_pybundle() -> None:
    files = {p.name: p.read_text(encoding="utf-8") for p in sorted(PKG.glob("*.py"))}
    GENERATED.mkdir(parents=True, exist_ok=True)
    js = (
        "/* Создано tools/build.py — исходники gbcourse для Python в браузере (Pyodide). Не редактируйте. */\n"
        "window.GBC = window.GBC || {};\nwindow.GBC.PYBUNDLE = " + json.dumps(files, ensure_ascii=False) + ";\n"
    )
    (GENERATED / "pybundle.js").write_text(js, encoding="utf-8", newline="\n")
    print(f"✓ pybundle: {len(files)} модулей gbcourse → {(GENERATED / 'pybundle.js').relative_to(ROOT)}")


# =====================================================================================
# Данные уроков
# =====================================================================================

def build_data() -> None:
    from gbcourse import datasets

    n_files = 0
    for d in lesson_dirs():
        meta = load_lesson(d)
        specs = meta.get("datasets", [])
        if not specs:
            continue
        readme = [AUTOGEN.replace("manifest", "data"), "", f"# Данные урока {'.'.join(map(str, lesson_key(d.name)))}", ""]
        readme += ["Все наборы детерминированы: их можно пересоздать в Python или получить в веб-уроке", "с теми же параметрами (генератор Mulberry32 одинаков в JS и Python).", ""]
        for spec in specs:
            gen = spec["generator"]
            params = spec.get("params", {})
            res = datasets.make(gen, **params)
            if gen in ("regression_1d", "toy_regression"):
                X, y = res
                cols = {"x": X[:, 0], "y": y}
            elif gen in ("classification_2d",):
                X, y = res
                cols = {"x0": X[:, 0], "x1": X[:, 1], "y": y}
            elif gen == "toy_classification":
                X, y = res
                cols = {"x": X[:, 0], "y": y}
            elif gen == "friedman1":
                X, y = res
                cols = {f"x{j}": X[:, j] for j in range(X.shape[1])}
                cols["y"] = y
            elif gen == "categorical_regression":
                x, cat, y = res
                cols = {"x": x, "category": [f"C{int(c):02d}" for c in cat], "y": y}
            else:
                raise SystemExit(f"Неизвестный генератор {gen}")
            out = d / spec["file"]
            datasets.save_csv(out, cols)
            n_files += 1
            args = ", ".join(f"{k}={v!r}" for k, v in params.items())
            readme += [
                f"## `{Path(spec['file']).name}` — {spec.get('title', '')}",
                "",
                spec.get("description", ""),
                "",
                f"- Столбцы: {', '.join('`' + c + '`' for c in cols)}; строк: {len(next(iter(cols.values())))}.",
                f"- Как получить в Python: `datasets.{gen}({args})`",
                "",
            ]
        (d / "data" / "README.md").write_text("\n".join(readme), encoding="utf-8", newline="\n")
    print(f"✓ данные: {n_files} CSV-файлов")


# =====================================================================================
# Ноутбуки
# =====================================================================================

CELL_RE = re.compile(r"^# %%(?P<md>\s*\[markdown\])?(?P<rest>.*)$")


def parse_percent(text: str) -> list[dict]:
    """Разобрать исходник в формате percent: ячейки начинаются строкой «# %%»."""
    cells: list[dict] = []
    cur: dict | None = None
    for line in text.splitlines():
        m = CELL_RE.match(line)
        if m:
            if cur is not None:
                cells.append(cur)
            cur = {"type": "markdown" if m.group("md") else "code", "lines": []}
            continue
        if cur is None:
            continue  # шапка файла до первой ячейки
        if cur["type"] == "markdown":
            if line.startswith("# "):
                line = line[2:]
            elif line.startswith("#"):
                line = line[1:]
        cur["lines"].append(line)
    if cur is not None:
        cells.append(cur)
    out = []
    for c in cells:
        lines = c["lines"]
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()
        if lines:
            out.append({"type": c["type"], "source": "\n".join(lines)})
    return out


def to_notebook(cells: list[dict], name: str):
    import nbformat

    nb = nbformat.v4.new_notebook()
    nb.metadata = {
        "kernelspec": {"display_name": "Python 3 (ipykernel)", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.12"},
    }
    for i, c in enumerate(cells):
        cid = hashlib.sha1(f"{name}:{i}".encode()).hexdigest()[:8]
        cell = nbformat.v4.new_markdown_cell(c["source"]) if c["type"] == "markdown" else nbformat.v4.new_code_cell(c["source"])
        cell["id"] = cid
        nb.cells.append(cell)
    return nb


def build_notebooks(execute: bool = False, only: str | None = None, timeout: int = 1200) -> None:
    import nbformat

    sources = []
    for d in lesson_dirs():
        if only and d.name != only:
            continue
        sources += sorted((d / "jupyter_notebooks").glob("*.py"))
    failures, stale = [], []
    for src in sources:
        text = src.read_text(encoding="utf-8")
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
        out = src.with_suffix(".ipynb")
        rel = out.relative_to(ROOT)
        if not execute and out.exists():
            # Без --execute не затираем выполненный ноутбук: если исходник не менялся, оставляем выводы как есть.
            old_hash = nbformat.read(str(out), as_version=4).metadata.get("gbcourse", {}).get("source_hash")
            if old_hash == digest:
                continue
            stale.append(rel)
        cells = parse_percent(text)
        nb = to_notebook(cells, src.stem)
        nb.metadata["gbcourse"] = {"source_hash": digest}
        if execute:
            from nbclient import NotebookClient

            t0 = time.time()
            env_backup = os.environ.get("MPLBACKEND")
            os.environ["MPLBACKEND"] = "module://matplotlib_inline.backend_inline"
            try:
                NotebookClient(nb, timeout=timeout, kernel_name="python3",
                               resources={"metadata": {"path": str(src.parent)}}).execute()
                print(f"✓ выполнен {rel} ({time.time() - t0:.1f} с)")
            except Exception as exc:  # noqa: BLE001
                failures.append((rel, exc))
                print(f"✗ ОШИБКА в {rel}: {str(exc).splitlines()[-1] if str(exc) else exc}")
            finally:
                if env_backup is None:
                    os.environ.pop("MPLBACKEND", None)
                else:
                    os.environ["MPLBACKEND"] = env_backup
            nb.metadata["language_info"] = {"name": "python", "version": "3.12"}
            nb.metadata["gbcourse"] = {"source_hash": digest}
        nbformat.validate(nb)
        nbformat.write(nb, str(out))
        if not execute:
            print(f"✓ {rel}")
    if stale:
        print(f"! Исходник изменился, ноутбук пересобран без выводов ({len(stale)}): выполните "
              f"python tools/build.py notebooks --execute --only <урок>")
    if failures:
        raise SystemExit(f"Ноутбуков с ошибками: {len(failures)}")


# =====================================================================================
# Примеры
# =====================================================================================

def run_examples(only: str | None = None) -> None:
    env = dict(os.environ, MPLBACKEND="Agg", PYTHONIOENCODING="utf-8")
    failures = []
    for d in lesson_dirs():
        if only and d.name != only:
            continue
        scripts = sorted((d / "examples").glob("*.py")) + sorted((d / "exercises").glob("solutions*.py"))
        for ex in scripts:
            if ex.name.startswith("_"):
                continue
            t0 = time.time()
            proc = subprocess.run([sys.executable, str(ex), "--save", "--no-show"], cwd=ROOT, env=env,
                                  capture_output=True, text=True, encoding="utf-8")
            rel = ex.relative_to(ROOT)
            if proc.returncode == 0:
                print(f"✓ {rel} ({time.time() - t0:.1f} с)")
            else:
                failures.append(rel)
                print(f"✗ {rel}\n{proc.stderr[-2000:]}")
    if failures:
        raise SystemExit(f"Примеров с ошибками: {len(failures)}")


# =====================================================================================

def main() -> None:
    for stream in (sys.stdout, sys.stderr):  # консоль Windows: печатаем кириллицу и значки без ошибок
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", nargs="?", default="all",
                    choices=["all", "manifest", "pybundle", "data", "notebooks", "examples"])
    ap.add_argument("--execute", action="store_true", help="выполнить ноутбуки (нужен установленный стек)")
    ap.add_argument("--only", help="только указанный урок, например lesson_4_1")
    ap.add_argument("--timeout", type=int, default=1200, help="таймаут ячейки ноутбука, с")
    args = ap.parse_args()
    if args.command in ("all", "pybundle"):
        build_pybundle()
    if args.command in ("all", "data"):
        build_data()
    if args.command in ("all", "notebooks"):
        build_notebooks(execute=args.execute, only=args.only, timeout=args.timeout)
    if args.command == "examples":
        run_examples(only=args.only)
    if args.command in ("all", "manifest", "notebooks", "data"):
        build_manifest()


if __name__ == "__main__":
    main()
