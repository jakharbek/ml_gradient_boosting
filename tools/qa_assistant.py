#!/usr/bin/env python
"""Сквозная проверка ИИ-ассистента урока в браузере: python tools/qa_assistant.py [--shots папка] [--live]

Запускает курс и ПОДСТАВНОЙ сервер с тем же API, что claude-server (/health,
/v1/chat/completions с потоком SSE), поэтому проверка не обращается к Claude и ничего не
стоит. Сценарий: выделить текст урока → кнопка «Спросить ИИ» → панель → вопрос → потоковый
ответ с формулами и кодом → история после перезагрузки → остановка → ошибка сервера →
сервер выключен → узкий экран → тёмная тема. Проверяется и то, что уходит на сервер
(урок, раздел, выделенный фрагмент, размер запроса), и безопасность вывода.

--live — в конце один настоящий запрос к claude-server (должен быть запущен).
"""

from __future__ import annotations

import argparse
import http.server
import json
import socketserver
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from qa import serve  # noqa: E402

LESSON = "lessons/lesson_4_1/web/index.html"
ANSWER = (
    "**Коротко.** Остаток — это то, чего модели не хватает: $r_i = y_i - F(x_i)$.\n\n"
    "Шаг бустинга:\n\n$$F_m(x) = F_{m-1}(x) + \\nu\\, h_m(x)$$\n\n"
    "1. считаем остатки;\n2. учим дерево `h_m` на остатках;\n   - с темпом $\\nu$;\n3. прибавляем.\n\n"
    "```python\nF = F + lr * tree.predict(X)\n```\n\n"
    "| шаг | MSE |\n|---|--:|\n| 0 | 10.67 |\n| 1 | 3.92 |\n\n"
    "<img src=x onerror=\"window.__pwned = 1\"> <script>window.__pwned = 2</script> [плохая ссылка](javascript:alert(1))"
)


class Mock(http.server.BaseHTTPRequestHandler):
    """Подставной claude-server: запоминает запросы, отвечает потоком по сценарию из вопроса."""

    requests: list[dict] = []
    protocol_version = "HTTP/1.1"

    def log_message(self, *args) -> None:
        pass

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin") or "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        body = b'{"ok":true,"images":true}' if self.path == "/health" else b"{}"
        self.send_response(200 if self.path == "/health" else 404)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _chunk(self, obj) -> None:
        data = ("data: " + (obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False)) + "\n\n").encode()
        self.wfile.write(f"{len(data):X}\r\n".encode() + data + b"\r\n")
        self.wfile.flush()

    def do_POST(self) -> None:  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8"))
        body["_auth"] = self.headers.get("Authorization")
        Mock.requests.append(body)
        question = body["messages"][-1]["content"]
        if isinstance(question, list):  # вопрос со скриншотом: [{type: text}, {type: image_url}]
            question = question[0]["text"]
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()
        delta = lambda d: {"choices": [{"index": 0, "delta": d, "finish_reason": None}]}  # noqa: E731
        try:
            self._chunk(delta({"role": "assistant", "content": ""}))
            self._chunk(delta({"reasoning_tokens": 120}))
            if "ошибку" in question:
                self._chunk({"error": {"message": "API Error: 529 перегрузка (подставной сервер)"}})
            elif "медленно" in question:
                for i in range(200):
                    self._chunk(delta({"content": f"слово{i} "}))
                    time.sleep(0.05)
            else:
                text = ANSWER
                # режем посреди формул и UTF-8 символов — как настоящий поток
                for i in range(0, len(text), 7):
                    self._chunk(delta({"content": text[i:i + 7]}))
                    time.sleep(0.004)
                self._chunk({"choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]})
            self._chunk("[DONE]")
            self.wfile.write(b"0\r\n\r\n")
        except (BrokenPipeError, ConnectionError):
            pass  # клиент нажал «Остановить»


class QuietServer(socketserver.ThreadingTCPServer):
    daemon_threads = True

    def handle_error(self, request, client_address) -> None:
        pass  # оборванные браузером соединения («Остановить», закрытие страницы) — не ошибка


def mock_server() -> tuple[socketserver.TCPServer, int]:
    httpd = QuietServer(("127.0.0.1", 0), Mock)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


# Подставной захват экрана: «кадр вкладки» в 1.5 раза крупнее окна (как при масштабе экрана 150%),
# левая половина красная, правая синяя — по цвету и размеру проверяем, что вырезана нужная область.
FAKE_CAPTURE = """
navigator.mediaDevices.getDisplayMedia = async () => {
  const c = document.createElement('canvas'); c.width = Math.round(innerWidth * 1.5); c.height = Math.round(innerHeight * 1.5);
  const g = c.getContext('2d'); const paint = () => { g.fillStyle = '#e00000'; g.fillRect(0, 0, c.width / 2, c.height); g.fillStyle = '#0000e0'; g.fillRect(c.width / 2, 0, c.width / 2, c.height); };
  paint(); const timer = setInterval(paint, 50);
  const stream = c.captureStream(30); const track = stream.getVideoTracks()[0];
  track.getSettings = () => ({displaySurface: 'browser', width: c.width, height: c.height});
  const stop = track.stop.bind(track); track.stop = () => { clearInterval(timer); window.__tracksStopped = true; stop(); };
  return stream;
};
"""

SELECT_JS = """(sel) => {
  const p = [...document.querySelectorAll(sel)].find(e => e.querySelector('.katex') && e.textContent.length > 80)
         || document.querySelector(sel);
  p.scrollIntoView({block: 'center'});
  const r = document.createRange(); r.selectNodeContents(p);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
  return p.closest('section').querySelector('h2').textContent.replace(/#$/, '').trim();
}"""


def main() -> int:
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"):
            s.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--shots", help="папка для скриншотов")
    ap.add_argument("--live", action="store_true", help="дополнительно — настоящий запрос к claude-server (127.0.0.1:8137)")
    args = ap.parse_args()
    from playwright.sync_api import sync_playwright

    httpd, port = serve()
    mock, mport = mock_server()
    base = f"http://127.0.0.1:{port}/{LESSON}"
    shots = Path(args.shots) if args.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)
    results: list[tuple[bool, str]] = []

    def check(ok: bool, name: str, detail: str = "") -> None:
        results.append((bool(ok), name))
        print(("✓ " if ok else "✗ ") + name + (f" — {detail}" if detail and not ok else ""))

    def settings_script(url: str, token: str = "") -> str:
        cfg = json.dumps(json.dumps({"url": url, "model": "sonnet", "effort": "low", "token": token}))
        return f"try {{ localStorage.setItem('gbc:assistant-settings', {cfg}); }} catch (e) {{}}"

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

        def new_page(width=1440, height=900, scheme="light", url=f"http://127.0.0.1:{mport}", token="", init=""):
            ctx = browser.new_context(viewport={"width": width, "height": height}, color_scheme=scheme)
            ctx.add_init_script(settings_script(url, token))
            if init:
                ctx.add_init_script(init)
            page = ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and errors.append(m.text))
            page.goto(base, wait_until="load")
            page.wait_for_selector("html.gbc-ready", timeout=15000)
            page.wait_for_timeout(1200)
            return ctx, page, errors

        def ask(page, text: str) -> None:
            page.fill(".assistant textarea", text)
            page.keyboard.press("Enter")

        def wait_done(page, timeout=20000) -> None:
            page.wait_for_selector(".assistant.busy", timeout=5000)
            page.wait_for_selector(".assistant:not(.busy)", timeout=timeout)
            page.wait_for_timeout(150)

        # ---------------------------------------------------------------- 1. основной сценарий
        ctx, page, errors = new_page()
        check(page.locator(".assistant-ask").count() == 1 and not page.locator(".assistant-ask").is_visible(), "кнопки у выделения нет, пока ничего не выделено")
        check(page.locator(".topbar .assistant-toggle").is_visible(), "в шапке есть кнопка ассистента")
        section = page.evaluate(SELECT_JS, "main.lesson > section p")
        page.wait_for_selector(".assistant-ask.show", timeout=3000)
        box = page.locator(".assistant-ask").bounding_box()
        check(box and 0 <= box["x"] and box["x"] + box["width"] <= 1440 and 0 <= box["y"] <= 900, "кнопка «Спросить ИИ» появилась у выделения и видна на экране")
        if shots:
            page.screenshot(path=str(shots / "assistant_1_selection.png"))
        page.click(".assistant-ask")
        page.wait_for_selector(".assistant:not([hidden])")
        check(page.locator(".assistant-quote .assistant-cite").is_visible(), "панель открылась, выделенный фрагмент приложен к вопросу")
        check(page.locator(".assistant-quote .txt .katex").count() >= 1 or not page.evaluate("!!window.katex"), "формулы в цитате отрисованы")
        page.wait_for_selector(".assistant[data-status='online']", timeout=6000)
        check(True, "сервер найден (индикатор «на связи»)")
        try:
            page.wait_for_function("document.activeElement === document.querySelector('.assistant textarea')", timeout=2000)
            check(True, "фокус в поле вопроса")
        except Exception:  # noqa: BLE001
            check(False, "фокус в поле вопроса")
        check(page.locator(".assistant-chip").count() >= 3, "есть готовые вопросы-подсказки")
        covered = page.evaluate("""() => { const c = document.querySelector('main.lesson').getBoundingClientRect();
            const a = document.querySelector('.assistant').getBoundingClientRect(); return c.right > a.left + 1; }""")
        check(not covered, "на широком экране панель не закрывает текст урока")

        ask(page, "Почему дерево учится на остатках, а не на y?")
        wait_done(page)
        req = Mock.requests[-1]
        sys_msg, user_msg = req["messages"][0]["content"], req["messages"][-1]["content"]
        check(req["stream"] is True and req["model"] == "sonnet" and req["effort"] == "low", "запрос: поток, модель и глубина из настроек")
        check("allow_tools" not in req and "permission_mode" not in req and "cwd" not in req, "запрос не включает инструменты Claude Code")
        check("Урок 4.1" in sys_msg and "Бустинг на остатках вручную" in sys_msg and "Разделы урока" in sys_msg, "в системном сообщении — урок, цели и разделы")
        check("Выделенный фрагмент урока" in user_msg and f"раздел «{section}»" in user_msg, "в вопросе — выделенный фрагмент и его раздел", user_msg[:200])
        check("$x$" in user_msg and "xx" not in user_msg,"формулы выделенного фрагмента переданы модели как TeX, без дублей", user_msg[:300])
        check("Текст раздела для контекста" in user_msg and "Почему дерево учится на остатках" in user_msg, "в вопросе — текст раздела и сам вопрос")
        size = sum(len(m["content"]) for m in req["messages"])
        check(size < 24000, f"размер запроса в пределах лимита командной строки ({size} символов)")

        bot = page.locator(".assistant-msg.bot").last
        html = bot.inner_html()
        katex = page.evaluate("!!window.katex")
        check(bot.locator("strong").count() >= 1 and bot.locator("ol > li").count() == 3 and bot.locator("ol ul li").count() == 1, "ответ: жирный текст и вложенный список")
        check(bot.locator("pre code").count() == 1 and "tree.predict" in bot.locator("pre code").inner_text(), "ответ: блок кода")
        check(bot.locator("table tr").count() == 3, "ответ: таблица")
        if katex:
            check(bot.locator(".katex").count() >= 3 and bot.locator(".md-formula .katex-display").count() == 1, "ответ: формулы отрисованы KaTeX (строчные и выключная)")
        else:
            print("  (KaTeX не загрузился — формулы показаны текстом, проверка отрисовки пропущена)")
        pwned = page.evaluate("window.__pwned")
        check(pwned is None and bot.locator("img, script, a[href^='javascript']").count() == 0 and "&lt;img" in html, "HTML и javascript:-ссылки из ответа показаны текстом, не выполняются")
        check(page.locator(".assistant-msg.user .assistant-cite").count() == 1, "в ленте у вопроса показана цитата из урока")
        check(not page.locator(".assistant-quote").is_visible(), "после отправки цитата убрана из поля ввода")
        if shots:
            page.screenshot(path=str(shots / "assistant_2_answer.png"))

        # продолжение диалога без выделения: история уходит на сервер
        ask(page, "А что такое темп обучения?")
        wait_done(page)
        req = Mock.requests[-1]
        roles = [m["role"] for m in req["messages"]]
        check(roles == ["system", "user", "assistant", "user"], "второй вопрос: на сервер ушла история диалога", str(roles))
        check("Текст раздела для контекста" not in req["messages"][1]["content"], "в истории текст раздела не дублируется")

        # ---------------------------------------------------------------- 2. история после перезагрузки
        page.reload(wait_until="load")
        page.wait_for_selector("html.gbc-ready")
        page.click(".topbar .assistant-toggle")
        page.wait_for_selector(".assistant:not([hidden])")
        check(page.locator(".assistant-msg").count() == 4, "после перезагрузки диалог урока восстановлен")
        check(page.locator(".assistant-msg.bot").last.locator("[title='Ответить заново']").count() == 1, "у последнего ответа есть «Ответить заново»")

        # ---------------------------------------------------------------- 3. остановка
        ask(page, "ответь медленно")
        page.wait_for_selector(".assistant.busy")
        page.wait_for_function("document.querySelector('.assistant-log').lastChild.textContent.includes('слово3')", timeout=8000)
        page.click(".assistant-send")
        page.wait_for_selector(".assistant:not(.busy)", timeout=5000)
        last = page.locator(".assistant-msg.bot").last.inner_text()
        check("Ответ остановлен" in last and "слово3" in last and "слово150" not in last, "кнопка «Остановить» прерывает ответ, начало сохраняется")

        # ---------------------------------------------------------------- 4. ошибка сервера
        ask(page, "верни ошибку")
        wait_done(page)
        check("529" in page.locator(".assistant-msg.bot").last.locator(".assistant-error").inner_text(), "ошибка сервера показана ученику")

        # ---------------------------------------------------------------- 5. новый диалог, клавиатура
        page.click(".assistant-head [title='Новый диалог']")
        check(page.locator(".assistant-msg").count() == 0 and page.locator(".assistant-empty").is_visible(), "«Новый диалог» очищает ленту")
        page.keyboard.press("Escape")
        check(not page.locator(".assistant").is_visible(), "Esc закрывает панель")
        page.evaluate(SELECT_JS, "main.lesson > section p")
        page.keyboard.press("Alt+i")
        page.wait_for_selector(".assistant:not([hidden])")
        check(page.locator(".assistant-quote .assistant-cite").is_visible(), "Alt+I открывает чат с выделенным фрагментом")
        page.click(".assistant-chip >> nth=0")
        wait_done(page)
        check("Объясните проще" in Mock.requests[-1]["messages"][-1]["content"], "вопрос-подсказка отправляется одним нажатием")
        check(not errors, "нет ошибок JavaScript", "; ".join(errors[:3]))
        ctx.close()

        # ---------------------------------------------------------------- 5б. скриншот
        ctx, page, errors = new_page(init=FAKE_CAPTURE)
        page.click(".topbar .assistant-toggle")
        page.wait_for_selector(".assistant[data-status='online']", timeout=6000)
        check(page.locator(".assistant-camera").is_visible(), "в поле ввода есть кнопка снимка экрана")
        # отмена: Esc при выборе области ничего не прикладывает
        page.click(".assistant-camera")
        page.wait_for_selector(".assistant-region")
        hidden = page.evaluate("getComputedStyle(document.querySelector('.assistant')).visibility")
        check(hidden == "hidden", "на время выбора области панель чата скрыта (не попадает в кадр)")
        page.keyboard.press("Escape")
        page.wait_for_selector(".assistant-region", state="detached")
        page.wait_for_timeout(200)
        check(not page.locator(".assistant-shot-preview").is_visible() and page.locator(".assistant").is_visible(), "Esc отменяет снимок, панель возвращается")
        # область мышью: левая (красная) половина подставного кадра
        page.click(".assistant-camera")
        page.wait_for_selector(".assistant-region")
        page.mouse.move(100, 200)
        page.mouse.down()
        page.mouse.move(250, 300, steps=4)
        page.mouse.move(400, 400, steps=4)
        page.mouse.up()
        page.wait_for_selector(".assistant-shot-preview img", timeout=5000)
        shot = page.evaluate("""async () => { const img = document.querySelector('.assistant-shot-preview img'); await img.decode();
            const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
            const p = g.getImageData(c.width >> 1, c.height >> 1, 1, 1).data; return {w: img.naturalWidth, h: img.naturalHeight, rgb: [p[0], p[1], p[2]], type: img.src.slice(0, 22)}; }""")
        check(abs(shot["w"] - 450) <= 2 and abs(shot["h"] - 300) <= 2, "снимок: вырезана выделенная область с учётом масштаба кадра (300×200 → 450×300)", str(shot))
        check(shot["rgb"][0] > 200 and shot["rgb"][2] < 60 and shot["type"].startswith("data:image/png"), "снимок: в кадре именно выделенное место страницы", str(shot))
        check(page.evaluate("window.__tracksStopped === true"), "захват экрана остановлен сразу после снимка")
        check(not page.locator(".assistant-send").is_disabled(), "со снимком можно отправить вопрос без текста")
        page.click(".assistant-send")
        wait_done(page)
        content = Mock.requests[-1]["messages"][-1]["content"]
        ok_img = isinstance(content, list) and content[1]["type"] == "image_url" and content[1]["image_url"]["url"].startswith("data:image/png;base64,")
        check(ok_img, "на сервер ушёл вопрос с картинкой (image_url, data-URL)")
        check(ok_img and "приложен скриншот" in content[0]["text"] and "Объясните, что показано на скриншоте" in content[0]["text"], "текст вопроса сообщает модели о скриншоте")
        check(page.locator(".assistant-msg.user img.assistant-shot").count() == 1 and not page.locator(".assistant-shot-preview").is_visible(), "снимок показан в ленте, из поля ввода убран")
        # вставка из буфера обмена
        page.evaluate("""async () => { const c = document.createElement('canvas'); c.width = 60; c.height = 40; c.getContext('2d').fillRect(0, 0, 60, 40);
            const blob = await new Promise(r => c.toBlob(r, 'image/png')); const dt = new DataTransfer(); dt.items.add(new File([blob], 'shot.png', {type: 'image/png'}));
            document.querySelector('.assistant textarea').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }""")
        page.wait_for_selector(".assistant-shot-preview img", timeout=3000)
        check(True, "картинка вставляется из буфера обмена (Ctrl+V)")
        ask(page, "А здесь что?")
        wait_done(page)
        req = Mock.requests[-1]
        first_user = req["messages"][1]["content"]
        check(isinstance(req["messages"][-1]["content"], list) and isinstance(first_user, str) and "прикладывал скриншот" in first_user, "в истории прошлый снимок заменён пометкой, картинка шлётся только с текущим вопросом")
        page.reload(wait_until="load")
        page.wait_for_selector("html.gbc-ready")
        page.click(".topbar .assistant-toggle")
        page.wait_for_selector(".assistant:not([hidden])")
        stored = page.evaluate("localStorage.getItem('gbc:assistant:lesson_4_1')")
        check("data:image" not in stored and page.locator(".assistant-shot-gone").count() == 2, "снимки не сохраняются в браузере — после перезагрузки остаётся пометка")
        check(not errors, "скриншот: нет ошибок JavaScript", "; ".join(errors[:3]))
        ctx.close()

        # ---------------------------------------------------------------- 6. сервер выключен
        ctx, page, errors = new_page(url="http://127.0.0.1:9")
        page.click(".topbar .assistant-toggle")
        page.wait_for_selector(".assistant[data-status='offline']", timeout=8000)
        check(page.locator(".assistant-offline").is_visible() and "node claude-server/server.js" in page.locator(".assistant-offline").inner_text(), "сервер выключен: показана инструкция запуска")
        ask(page, "вопрос без сервера")
        page.wait_for_selector(".assistant-msg.bot .assistant-error", timeout=8000)
        check("Нет связи" in page.locator(".assistant-msg.bot .assistant-error").inner_text(), "сервер выключен: понятное сообщение вместо ответа")
        if shots:
            page.screenshot(path=str(shots / "assistant_3_offline.png"))
        # настройки: неверный адрес не сохраняется, верный — сохраняется и сервер находится
        page.click(".assistant-head [title='Настройки']")
        page.fill(".assistant-settings input[type=url]", "ftp://nope")
        page.click(".assistant-settings .btn.primary")
        check(page.locator(".assistant-settings").is_visible() and page.locator(".assistant-settings input[aria-invalid=true]").count() == 1, "настройки: неверный адрес отклонён")
        page.fill(".assistant-settings input[type=url]", f"http://127.0.0.1:{mport}/")
        page.select_option(".assistant-settings select >> nth=0", "haiku")
        page.fill(".assistant-settings input[type=password]", "secret-1")
        page.click(".assistant-settings .btn.primary")
        page.wait_for_selector(".assistant[data-status='online']", timeout=6000)
        page.click(".assistant-msg.bot [title='Ответить заново']")
        wait_done(page)
        req = Mock.requests[-1]
        check(req["model"] == "haiku" and req["_auth"] == "Bearer secret-1", "настройки: модель и токен применяются к запросу")
        check(page.locator(".assistant-msg.bot .assistant-error").count() == 0, "«Ответить заново» заменяет ответ с ошибкой")
        ctx.close()

        # ---------------------------------------------------------------- 7. узкий экран и тёмная тема
        for scheme in ("light", "dark"):
            ctx, page, errors = new_page(width=390, height=780, scheme=scheme)
            page.evaluate(f"document.documentElement.setAttribute('data-theme', '{scheme}')")
            page.evaluate(SELECT_JS, "main.lesson > section p")
            page.wait_for_selector(".assistant-ask.show", timeout=3000)
            b = page.locator(".assistant-ask").bounding_box()
            ok_btn = b and b["x"] >= 0 and b["x"] + b["width"] <= 390
            page.click(".assistant-ask")
            page.wait_for_selector(".assistant:not([hidden])")
            ask(page, "Объясните на примере")
            wait_done(page)
            m = page.evaluate("""() => { const a = document.querySelector('.assistant'); const r = a.getBoundingClientRect();
                const over = [...a.querySelectorAll('*')].filter(e => { const q = e.getBoundingClientRect(); return q.width && q.right > innerWidth + 1 && !e.closest('.md-table, .md-formula, pre'); }).length;
                const lum = c => { const v = c.match(/[\\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
                const p = a.querySelector('.assistant-msg.bot p'); const fg = lum(getComputedStyle(p).color), bg = lum(getComputedStyle(a).backgroundColor);
                return {w: r.width, left: r.left, scroll: document.documentElement.scrollWidth - innerWidth, over, contrast: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)}; }""")
            check(ok_btn and m["w"] == 390 and m["left"] == 0 and m["scroll"] <= 0 and m["over"] == 0, f"390 px, {scheme}: кнопка и панель на весь экран, ничего не выходит за край", str(m))
            check(m["contrast"] >= 4.5, f"390 px, {scheme}: контраст текста ответа {m['contrast']:.1f}")
            check(not errors, f"390 px, {scheme}: нет ошибок JavaScript", "; ".join(errors[:3]))
            if shots:
                page.screenshot(path=str(shots / f"assistant_4_mobile_{scheme}.png"))
            ctx.close()

        # ---------------------------------------------------------------- 8. настоящий сервер
        if args.live:
            ctx, page, errors = new_page(url="http://127.0.0.1:8137")
            page.evaluate(SELECT_JS, "main.lesson > section p")
            page.wait_for_selector(".assistant-ask.show", timeout=3000)
            page.click(".assistant-ask")
            try:
                page.wait_for_selector(".assistant[data-status='online']", timeout=6000)
                ask(page, "Объясните этот фрагмент в двух предложениях и приведите одну формулу.")
                t0 = time.time()
                wait_done(page, timeout=180000)
                bot = page.locator(".assistant-msg.bot").last
                text = bot.inner_text()
                check(bot.locator(".assistant-error").count() == 0 and len(text) > 40, f"настоящий claude-server ответил за {time.time() - t0:.0f} с", text[:200])
                print("  ответ:", " ".join(text.split())[:400])
                if shots:
                    page.screenshot(path=str(shots / "assistant_5_live.png"))
            except Exception as exc:  # noqa: BLE001
                check(False, "настоящий claude-server", str(exc).splitlines()[0])
            ctx.close()
        browser.close()
    httpd.shutdown()
    mock.shutdown()
    failed = [n for ok, n in results if not ok]
    print(f"\nПроверок: {len(results)}, не прошло: {len(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
