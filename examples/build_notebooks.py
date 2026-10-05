"""Собрать Jupyter-ноутбуки из примеров examples/<уровень>/NN_*.py → examples/<уровень>/notebooks/NN_*.ipynb.

Источник истины — скрипт. Ноутбук генерируется из него и выполняется, поэтому в нём сохранены
выводы и графики. Не правьте ноутбуки вручную: правьте скрипт и пересоберите.

Что делает сборка:
    * из докстринга — вводная ячейка: уровень, цель, чему научитесь, данные, план этапов (из вызовов
      ex.stage), ожидаемый результат;
    * ячейка «Подключение» переписывается так, чтобы ноутбук работал из любой рабочей папки;
    * каждый этап ex.stage(...) становится markdown-заголовком, код этапа — отдельной ячейкой;
    * в конце — «Попробуйте сами» (из докстринга) и «Что дальше»: соседние примеры и уроки курса;
    * в метаданных — хеш исходника, чтобы --check находил устаревшие ноутбуки.

Запуск:
    python examples/build_notebooks.py                 # собрать и выполнить все 30 (≈ 7 минут)
    python examples/build_notebooks.py --only 01 17    # только выбранные номера
    python examples/build_notebooks.py --no-execute    # собрать без выполнения (без выводов)
    python examples/build_notebooks.py --check         # проверить, что ноутбуки соответствуют скриптам
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import os
import re
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GENERATOR_VERSION = "1"

LEVELS = {
    "1_tiny": ("1", "крошечные данные: всё считается вручную"),
    "2_small": ("2", "маленькие данные: реальные наборы и базовые приёмы"),
    "3_medium": ("3", "средние данные: полный цикл и типовые случаи"),
    "4_large": ("4", "большие данные и сложные задачи"),
}
FIELDS = ("Цель", "Чему научитесь", "Датасет", "Этапы", "Попробуйте сами", "Связанные уроки", "Запуск", "Ожидаемо")
CELL_RE = re.compile(r"^# %%(?P<md>\s*\[markdown\])?\s*(?P<title>.*)$")
LESSON_RE = re.compile(r"(\d+(?:\.\d+)*)\s*«([^»]+)»(\s*\([^)]*\))?")
SETUP_MD = """## Подготовка

Ячейка ниже находит папку `examples/` (ноутбук можно открыть из любой рабочей папки внутри
репозитория), подключает общий каркас примеров `_common.Example` и учебную библиотеку курса
`gbcourse`. Каркас печатает этапы и выводы, «раскрывает» датасет и показывает графики прямо в
ноутбуке. Выполняйте ячейки сверху вниз: **Run → Run All Cells**."""


# ----------------------------------------------------------------------------- разбор исходника
def scripts() -> list[Path]:
    return sorted(HERE.glob("[0-9]_*/[0-9][0-9]_*.py"))


def parse_docstring(src: str) -> tuple[str, dict[str, str]]:
    """Название (первая строка) и поля «Метка: текст» с продолжениями, сдвинутыми на 4 пробела."""
    doc = ast.get_docstring(ast.parse(src)) or ""
    lines = doc.splitlines()
    title, fields, key = lines[0].strip(), {}, None
    for line in lines[1:]:
        head = line.split(":", 1)[0]
        if head in FIELDS and ":" in line:
            key = head
            fields[key] = line.split(":", 1)[1].strip()
        elif key and line.startswith("    "):
            fields[key] += " " + line.strip()
        elif not line.strip():
            key = None
    return title, fields


def split_top(text: str, seps: str) -> list[str]:
    """Разбить по разделителям верхнего уровня (не внутри скобок и кавычек-ёлочек)."""
    out, depth, cur = [], 0, ""
    for ch in text:
        depth += ch in "(«[" and 1 or 0
        depth -= ch in ")»]" and 1 or 0
        if ch in seps and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return [x.strip().rstrip(".") for x in out if x.strip()]


CODE_RE = re.compile(r'[A-Za-z_][\w.]{2,}\([^()]*\)|[A-Za-z_]\w*(?:\.\w+){2,}|[\w."]*[A-Za-z][\w."]*[_=][\w.="]*|[\w."]*[_=][\w."]*[A-Za-z][\w.="]*')


def codeify(text: str) -> str:
    """Имена из кода (с «_», «=» или вызовом функции) — моноширинным шрифтом; уже размеченное не трогаем."""
    parts = text.split("`")
    for i in range(0, len(parts), 2):                      # чётные куски — вне обратных кавычек
        parts[i] = CODE_RE.sub(lambda m: f"`{m.group(0)}`", parts[i])
    return "`".join(parts)


def cap(s: str) -> str:
    """Первая буква заглавная, если пункт начинается с русского слова (ν, sklearn, `код` не трогаем)."""
    return s[:1].upper() + s[1:] if re.match(r"[а-яё]", s) else s


def numbered(text: str) -> list[str]:
    """«1) … 2) … 3) …» → список пунктов; номера ищутся по порядку, поэтому «(пример 28)» не мешает."""
    items, k, pos = [], 1, 0
    starts = []
    while True:
        m = re.compile(rf"(?:^|\s){k}\)\s").search(text, pos)
        if not m:
            break
        starts.append((m.start(), m.end()))
        pos, k = m.end(), k + 1
    for i, (_, b) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(text)
        items.append(text[b:end].strip())
    return items


def stage_calls(src: str) -> list[tuple[int, int, str, str]]:
    """Вызовы ex.stage(n, "…") верхнего уровня: (первая строка, последняя строка, номер, название)."""
    out = []
    for node in ast.parse(src).body:
        if (isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
                and isinstance(node.value.func, ast.Attribute) and node.value.func.attr == "stage"):
            n_arg, t_arg = node.value.args
            if not (isinstance(n_arg, ast.Constant) and isinstance(t_arg, ast.Constant)):
                raise ValueError(f"строка {node.lineno}: название этапа верхнего уровня должно быть литералом")
            out.append((node.lineno, node.end_lineno, str(n_arg.value), t_arg.value))
    return out


# ----------------------------------------------------------------------------- сборка ячеек
def lesson_links(text: str) -> str:
    def link(m: re.Match) -> str:
        num, name, tail = m.group(1), m.group(2), m.group(3) or ""
        lesson = "lesson_" + num.replace(".", "_")
        if (ROOT / "lessons" / lesson).is_dir():
            return f"[{num} «{name}»](../../../lessons/{lesson}/README.md){tail}"
        return m.group(0)
    return LESSON_RE.sub(link, text)


def intro_cell(path: Path, title: str, f: dict[str, str], stages: list[tuple[int, int, str, str]]) -> str:
    level_no, level_name = LEVELS[path.parent.name]
    learn_items = split_top(f.get("Чему научитесь", ""), ";")
    out = [f"# {title.rstrip('.')}", "",
           "| | |", "|---|---|",
           f"| **Уровень** | {level_no} из 4 — {level_name} (`{path.parent.name}`) |",
           f"| **Скрипт-источник** | [`{path.name}`](../{path.name}) — тот же код, запуск из терминала |",
           "| **Время выполнения** | {runtime} |", "",
           f"**Цель.** {cap(f.get('Цель', '')).rstrip('.')}.", "",
           "### Чему вы научитесь", ""]
    out += [f"- {cap(x)}" for x in learn_items]
    out += ["", "### Данные", "", codeify(cap(f.get("Датасет", ""))), "", "### План", ""]
    out += [f"{i}. **Этап {n}.** {t}" for i, (_, _, n, t) in enumerate(stages, 1)]
    if f.get("Ожидаемо"):
        out += ["", f"**Ожидаемый результат.** {codeify(f['Ожидаемо'])}"]
    rel = path.relative_to(ROOT).as_posix()
    out += ["", f"> Ноутбук собран из `{rel}` командой `python examples/build_notebooks.py`. "
                "Чтобы изменить пример, правьте скрипт и пересоберите ноутбук."]
    return "\n".join(out)


def rewrite_setup(code: str, rel_from_examples: str) -> str:
    lines = []
    for line in code.splitlines():
        line = line.replace("  # noqa: E402", "")
        if line.startswith("sys.path.insert(0, str(Path(__file__)"):
            lines += ['EXAMPLES = next(p / "examples" for p in [Path.cwd(), *Path.cwd().parents]',
                      '                if (p / "examples" / "_common.py").is_file())',
                      "sys.path.insert(0, str(EXAMPLES))"]
            continue
        lines.append(line.replace("Example(__file__,", f'Example(EXAMPLES / "{rel_from_examples}",'))
    return "\n".join(lines)


def trim(lines: list[str]) -> str:
    while lines and not lines[0].strip():
        lines = lines[1:]
    while lines and not lines[-1].strip():
        lines = lines[:-1]
    return "\n".join(line.replace("  # noqa: E402", "") for line in lines)


def outro_cell(path: Path, f: dict[str, str], order: list[Path]) -> str:
    i = order.index(path)
    out = []
    tasks = numbered(f.get("Попробуйте сами", ""))
    if tasks:
        out += ["## Попробуйте сами", "", "Измените код в ячейках выше и выполните их заново:", ""]
        out += [f"{k}. {codeify(t)}" for k, t in enumerate(tasks, 1)]
        out += [""]
    out += ["## Что дальше", ""]
    if f.get("Связанные уроки"):
        out += [f"- **Теория в курсе:** {lesson_links(f['Связанные уроки']).rstrip('.')}."]
    nb_link = lambda p: (f"../../{p.parent.name}/notebooks/{p.stem}.ipynb" if p.parent != path.parent
                         else f"{p.stem}.ipynb")
    if i > 0:
        prev = order[i - 1]
        out += [f"- **Предыдущий пример:** [{parse_docstring(prev.read_text(encoding='utf-8'))[0].rstrip('.')}]({nb_link(prev)})"]
    if i + 1 < len(order):
        nxt = order[i + 1]
        out += [f"- **Следующий пример:** [{parse_docstring(nxt.read_text(encoding='utf-8'))[0].rstrip('.')}]({nb_link(nxt)})"]
    out += ["- **Все примеры:** [examples/README.md](../../README.md)"]
    return "\n".join(out)


def build_cells(path: Path, order: list[Path]) -> tuple[list[tuple[str, str]], str]:
    src = path.read_text(encoding="utf-8")
    title, f = parse_docstring(src)
    stages = stage_calls(src)
    stage_at = {first: (last, n, t) for first, last, n, t in stages}
    lines = src.splitlines()
    # границы ячеек «# %%» (номера строк с 1)
    marks = [i + 1 for i, line in enumerate(lines) if CELL_RE.match(line)]
    cells: list[tuple[str, str]] = [("markdown", intro_cell(path, title, f, stages))]
    rel_from_examples = path.relative_to(HERE).as_posix()
    for k, start in enumerate(marks):
        end = marks[k + 1] - 1 if k + 1 < len(marks) else len(lines)
        header = CELL_RE.match(lines[start - 1]).group("title").strip()
        if CELL_RE.match(lines[start - 1]).group("md"):
            body = [re.sub(r"^# ?", "", x) for x in lines[start:end]]
            cells.append(("markdown", trim(body)))
            continue
        if k == 0 and header.startswith("Подключение"):
            cells.append(("markdown", SETUP_MD))
            cells.append(("code", rewrite_setup(trim(lines[start:end]), rel_from_examples)))
            continue
        chunk: list[str] = []
        ln = start + 1
        while ln <= end:
            if ln in stage_at:
                if trim(chunk):
                    cells.append(("code", trim(chunk)))
                last, n, t = stage_at[ln]
                cells.append(("markdown", f"## Этап {n}. {t}"))
                chunk = []
                ln = last + 1
                continue
            chunk.append(lines[ln - 1])
            ln += 1
        if trim(chunk):
            cells.append(("code", trim(chunk)))
    cells.append(("markdown", outro_cell(path, f, order)))
    digest = hashlib.sha256((GENERATOR_VERSION + src).encode()).hexdigest()[:16]
    return cells, digest


# ----------------------------------------------------------------------------- ноутбук
def notebook_path(path: Path) -> Path:
    return path.parent / "notebooks" / f"{path.stem}.ipynb"


def make_notebook(path: Path, order: list[Path]):
    import nbformat

    cells, digest = build_cells(path, order)
    nb = nbformat.v4.new_notebook()
    nb.metadata = {
        "kernelspec": {"display_name": "Python 3 (ipykernel)", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.12"},
        "examples": {"source": path.relative_to(ROOT).as_posix(), "source_hash": digest},
    }
    for i, (kind, text) in enumerate(cells):
        cell = nbformat.v4.new_markdown_cell(text) if kind == "markdown" else nbformat.v4.new_code_cell(text)
        cell["id"] = hashlib.sha1(f"{path.stem}:{i}".encode()).hexdigest()[:8]
        nb.cells.append(cell)
    return nb


def execute(nb, workdir: Path, timeout: int) -> float:
    from nbclient import NotebookClient

    env_backup = {k: os.environ.get(k) for k in ("MPLBACKEND", "PYTHONIOENCODING", "EXAMPLES_QUICK")}
    os.environ.update(MPLBACKEND="module://matplotlib_inline.backend_inline", PYTHONIOENCODING="utf-8")
    os.environ.pop("EXAMPLES_QUICK", None)
    t0 = time.perf_counter()
    try:
        NotebookClient(nb, timeout=timeout, kernel_name="python3", record_timing=False,
                       resources={"metadata": {"path": str(workdir)}}).execute()
    finally:
        for k, v in env_backup.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    return time.perf_counter() - t0


def stderr_lines(nb) -> list[str]:
    out = []
    for cell in nb.cells:
        for o in cell.get("outputs", []):
            if o.get("output_type") == "stream" and o.get("name") == "stderr":
                out += [x for x in o["text"].splitlines() if x.strip()]
    return out


def fmt_runtime(sec: float) -> str:
    return f"≈ {sec:.0f} с" if sec < 90 else f"≈ {sec / 60:.1f} мин"


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--only", nargs="*", default=[], help="номера примеров, например 01 17")
    ap.add_argument("--no-execute", action="store_true", help="не выполнять (ноутбук без выводов)")
    ap.add_argument("--check", action="store_true", help="только проверить актуальность ноутбуков")
    ap.add_argument("--timeout", type=int, default=1800, help="таймаут одной ячейки, с")
    args = ap.parse_args()

    import nbformat

    if sys.platform == "win32":  # zmq в Windows требует селекторный цикл событий
        import asyncio

        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    order = scripts()
    todo = [p for p in order if not args.only or p.name[:2] in args.only]

    if args.check:
        stale = []
        for p in todo:
            out = notebook_path(p)
            want = build_cells(p, order)[1]
            have = nbformat.read(str(out), as_version=4).metadata.get("examples", {}).get("source_hash") if out.exists() else None
            if have != want:
                stale.append(out.relative_to(ROOT).as_posix())
        for s in stale:
            print(f"✗ устарел или отсутствует: {s}")
        print(f"Проверено ноутбуков: {len(todo)}; устаревших: {len(stale)}")
        return 1 if stale else 0

    failures, t_all = [], time.perf_counter()
    for p in todo:
        out = notebook_path(p)
        out.parent.mkdir(exist_ok=True)
        nb = make_notebook(p, order)
        rel = out.relative_to(ROOT).as_posix()
        if args.no_execute:
            nb.cells[0].source = nb.cells[0].source.replace("{runtime}", "—")
            nbformat.write(nb, str(out))
            print(f"✓ {rel}")
            continue
        print(f"▶ {rel:62s}", end=" ", flush=True)
        try:
            sec = execute(nb, out.parent, args.timeout)
        except Exception as exc:  # noqa: BLE001
            failures.append(rel)
            print(f"✗\n    {str(exc).strip().splitlines()[-1] if str(exc).strip() else exc}")
            continue
        nb.cells[0].source = nb.cells[0].source.replace("{runtime}", fmt_runtime(sec))
        nb.metadata["language_info"] = {"name": "python", "version": "3.12"}
        nbformat.validate(nb)
        nbformat.write(nb, str(out))
        warn = stderr_lines(nb)
        print(f"✓ {sec:6.1f} с" + (f"   (stderr: {len(warn)} строк)" if warn else ""))
        for w in warn[:5]:
            print(f"      {w[:140]}")
    print(f"\nИтого: {len(todo) - len(failures)} из {len(todo)} ноутбуков за {time.perf_counter() - t_all:.0f} с")
    for rel in failures:
        print(f"   ✗ {rel}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
