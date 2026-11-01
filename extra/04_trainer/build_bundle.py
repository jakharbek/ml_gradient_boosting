"""Упаковать Python-пакет gbtrainer в gbtrainer_bundle.js для веб-страницы.

Запуск: python extra/04_trainer/build_bundle.py
Страница (index.html) загружает пакет в Pyodide из этого файла, а не через fetch — так она работает
и по http://, и при открытии с диска (file://). Файл сгенерированный: правьте gbtrainer/*.py и
пересобирайте; тест tests/python/test_trainer.py проверяет, что бандл не устарел.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "gbtrainer_bundle.js"


def render() -> str:
    files = {f"gbtrainer/{p.name}": p.read_text(encoding="utf-8") for p in sorted((HERE / "gbtrainer").glob("*.py"))}
    sys.path.insert(0, str(HERE))
    from gbtrainer import __version__

    body = json.dumps({"version": __version__, "files": files}, ensure_ascii=False, indent=0)
    return ("// Сгенерировано extra/04_trainer/build_bundle.py — не редактируйте вручную.\n"
            "// Исходники Python-пакета gbtrainer для страницы генератора (Pyodide).\n"
            f"window.GBTRAINER = {body};\n")


def main() -> int:
    text = render()
    if "--check" in sys.argv:
        ok = OUT.exists() and OUT.read_text(encoding="utf-8") == text
        print("бандл актуален" if ok else "бандл устарел — запустите python extra/04_trainer/build_bundle.py")
        return 0 if ok else 1
    OUT.write_text(text, encoding="utf-8")
    print(f"✔ {OUT.name}: {len(text) // 1024} КБ")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
