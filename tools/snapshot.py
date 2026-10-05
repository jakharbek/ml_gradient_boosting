#!/usr/bin/env python
"""Снимки страниц курса в headless Chrome/Edge для визуальной проверки.

    python tools/snapshot.py lessons/lesson_1/web/index.html --out shot.png [--width 1440] [--height 9000]
          [--crop 0,1500,1440,3000] [--dark]

Нужен запущенный сервер (python tools/serve.py) — страница берётся с http://127.0.0.1:<port>/.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path

CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "google-chrome", "chromium", "chromium-browser", "microsoft-edge",
]


def find_browser() -> str:
    for c in CANDIDATES:
        if Path(c).exists() or shutil.which(c):
            return c
    raise SystemExit("Не найден Chrome/Chromium/Edge")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("page")
    ap.add_argument("--out", required=True)
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--height", type=int, default=9000)
    ap.add_argument("--wait", type=int, default=12000, help="виртуальное время ожидания, мс")
    ap.add_argument("--crop", help="x0,y0,x1,y1 — вырезать область")
    ap.add_argument("--dark", action="store_true", help="тёмная тема")
    args = ap.parse_args()
    url = f"http://127.0.0.1:{args.port}/{args.page}"
    out = Path(args.out).resolve()
    with tempfile.TemporaryDirectory() as prof:
        cmd = [find_browser(), "--headless=new", "--disable-gpu", "--hide-scrollbars",
               f"--window-size={args.width},{args.height}", f"--virtual-time-budget={args.wait}",
               f"--user-data-dir={prof}", f"--screenshot={out}", url]
        if args.dark:
            cmd.insert(1, "--force-dark-mode")
            cmd.insert(1, "--blink-settings=preferredColorScheme=0")
        subprocess.run(cmd, capture_output=True, timeout=180)
    if args.crop:
        from PIL import Image

        x0, y0, x1, y1 = map(int, args.crop.split(","))
        Image.open(out).crop((x0, y0, x1, y1)).save(out)
    print(out)


if __name__ == "__main__":
    main()
