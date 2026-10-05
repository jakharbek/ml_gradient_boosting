#!/usr/bin/env python
"""Браузерная проверка страниц курса (Playwright + установленный Chrome/Edge).

    python tools/qa.py                       # все уроки: ошибки JS, виджеты, формулы
    python tools/qa.py --only lesson_1 --run-python --shots out_dir

Проверяет для каждой страницы:
  * нет ошибок JavaScript и сообщений console.error;
  * страница инициализировалась (класс gbc-ready), все виджеты смонтированы без ошибок;
  * формулы KaTeX отрисованы (нет «сырых» $…$ в тексте);
  * с --run-python — все Python-ячейки выполняются без ошибок (нужен интернет для Pyodide).

Требуется: pip install playwright (браузер не скачивается — используется системный Chrome).
Сервер курса поднимается автоматически на свободном порту.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def serve() -> tuple[socketserver.TCPServer, int]:
    class Quiet(http.server.SimpleHTTPRequestHandler):
        extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript"}

        def log_message(self, *args) -> None:
            pass

    handler = functools.partial(Quiet, directory=str(ROOT))
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def pages(only: str | None) -> list[str]:
    out = ["index.html"] if not only else []
    for d in sorted((ROOT / "lessons").glob("lesson_*"), key=lambda p: tuple(int(x) for x in p.name.split("_")[1:])):
        if only and d.name != only:
            continue
        if (d / "web" / "index.html").exists():
            out.append(f"lessons/{d.name}/web/index.html")
    return out


def main() -> int:
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"):
            s.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--run-python", action="store_true")
    ap.add_argument("--shots", help="папка для скриншотов")
    ap.add_argument("--dark", action="store_true")
    args = ap.parse_args()
    from playwright.sync_api import sync_playwright

    httpd, port = serve()
    failed = 0
    with sync_playwright() as p:
        browser = None
        for channel in ("chrome", "msedge", None):
            try:
                browser = p.chromium.launch(channel=channel) if channel else p.chromium.launch()
                break
            except Exception:  # noqa: BLE001
                continue
        if browser is None:
            print("Не удалось запустить браузер")
            return 2
        ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, color_scheme="dark" if args.dark else "light")
        for rel in pages(args.only):
            page = ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e, errors=errors: errors.append(f"pageerror: {e}"))
            page.on("console", lambda m, errors=errors: m.type == "error" and errors.append(f"console: {m.text}"))
            page.goto(f"http://127.0.0.1:{port}/{rel}", wait_until="load")
            try:
                page.wait_for_selector("html.gbc-ready", timeout=15000)
            except Exception:  # noqa: BLE001
                errors.append("страница не инициализировалась (нет gbc-ready)")
            page.wait_for_timeout(1500)
            report = page.evaluate(
                """() => {
                  const bad = [...document.querySelectorAll('[data-widget]')].filter(w => !w.dataset.mounted || /Ошибка виджета|не найден/.test(w.textContent.slice(0, 200)));
                  const walker = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
                  let raw = 0;
                  while (walker.nextNode()) {
                    const n = walker.currentNode;
                    if (n.parentElement.closest('pre, code, script, .CodeMirror, .pycell, textarea, .no-math')) continue;
                    if (/\\$[^$\\s][^$]*\\$/.test(n.textContent)) raw++;
                  }
                  return {widgets: document.querySelectorAll('[data-widget]').length, badWidgets: bad.map(w => w.dataset.widget),
                          rawMath: raw, katex: !!window.katex, pycells: document.querySelectorAll('.pycell').length};
                }"""
            )
            if report["badWidgets"]:
                errors.append(f"виджеты с ошибкой: {report['badWidgets']}")
            if report["katex"] and report["rawMath"]:
                errors.append(f"неотрисованных формул: {report['rawMath']}")
            if args.run_python and report["pycells"]:
                page.click(".py-toolbar button")  # «Запустить все ячейки»
                try:
                    page.wait_for_function(
                        "() => [...document.querySelectorAll('.pycell .status')].every(s => /готово|ошибка/.test(s.textContent))"
                        " || [...document.querySelectorAll('.pycell .status')].some(s => /ошибка/.test(s.textContent))",
                        timeout=240000,
                    )
                except Exception:  # noqa: BLE001
                    errors.append("Python-ячейки не завершились за 4 минуты")
                bad = page.evaluate(
                    "() => [...document.querySelectorAll('.pycell')].map((c, i) => [i + 1, c.querySelector('.status').textContent,"
                    " (c.querySelector('.pycell-out pre.error') || {}).textContent || '']).filter(x => !/готово/.test(x[1]))"
                )
                for i, st, err in bad:
                    errors.append(f"ячейка [{i}]: {st} {err[-900:]}")
            if args.shots:
                out = Path(args.shots)
                out.mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(out / (rel.replace("/", "_").replace(".html", ".png"))), full_page=True)
            status = "✓" if not errors else "✗"
            extra = f"виджетов {report['widgets']}, ячеек {report['pycells']}"
            print(f"{status} {rel}  ({extra})")
            for e in errors:
                print("    ", e)
            failed += bool(errors)
            page.close()
        browser.close()
    httpd.shutdown()
    print(f"\nСтраниц с проблемами: {failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
