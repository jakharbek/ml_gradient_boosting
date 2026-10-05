"""Запустить все примеры из examples/ по порядку и показать сводку: успех/ошибка и время.

Запуск:
    python examples/run_all.py              # все примеры, полные данные (≈ 10 минут)
    python examples/run_all.py --quick      # уменьшенные данные — быстрая проверка, что всё работает
    python examples/run_all.py --only 1_tiny 07 22   # только уровни/номера, начинающиеся с этих строк
    python examples/run_all.py --save       # заодно сохранить рисунки в <уровень>/figures/
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--quick", action="store_true", help="уменьшенные данные")
    ap.add_argument("--save", action="store_true", help="сохранить рисунки")
    ap.add_argument("--only", nargs="*", default=[], help="префиксы папок уровней или номеров примеров")
    ap.add_argument("--verbose", action="store_true", help="показывать вывод каждого примера")
    args = ap.parse_args()

    scripts = sorted(p for p in HERE.glob("[0-9]_*/[0-9][0-9]_*.py"))
    if args.only:
        scripts = [p for p in scripts if any(p.parent.name.startswith(o) or p.name.startswith(o) for o in args.only)]
    flags = ["--no-show"] + (["--quick"] if args.quick else []) + (["--save"] if args.save else [])
    env = {**__import__("os").environ, "PYTHONIOENCODING": "utf-8", "MPLBACKEND": "Agg"}

    results, t_all = [], time.perf_counter()
    for path in scripts:
        rel = path.relative_to(HERE).as_posix()
        print(f"▶ {rel:55s}", end=" ", flush=True)
        t = time.perf_counter()
        proc = subprocess.run([sys.executable, str(path), *flags], capture_output=True, text=True,
                              encoding="utf-8", errors="replace", env=env, cwd=HERE.parent)
        sec = time.perf_counter() - t
        ok = proc.returncode == 0
        results.append((rel, ok, sec))
        print(f"{'✓' if ok else '✗'} {sec:6.1f} с")
        if args.verbose or not ok:
            tail = (proc.stdout + proc.stderr).strip().splitlines()
            print("\n".join("    " + line for line in (tail if args.verbose else tail[-15:])))

    failed = [r for r in results if not r[1]]
    print(f"\nИтого: {len(results) - len(failed)} из {len(results)} примеров успешно за {time.perf_counter() - t_all:.0f} с")
    for rel, _, _ in failed:
        print(f"   ✗ {rel}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
