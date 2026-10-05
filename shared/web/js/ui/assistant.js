/* =====================================================================================
 * GBC.assistant — ИИ-ассистент урока.
 *
 * Ученик выделяет фрагмент урока → рядом появляется кнопка «Спросить ИИ» → открывается
 * панель чата. Вопрос уходит на локальный claude-server (папка claude-server в корне
 * курса, OpenAI-совместимый API поверх Claude Code CLI) вместе с контекстом: какой это
 * урок, из какого раздела фрагмент, текст раздела и сам выделенный фрагмент. Ответ
 * приходит потоком (SSE) и показывается с формулами и подсветкой кода.
 *
 * Запуск сервера:  node claude-server/server.js   (или python tools/serve.py — запустит сам)
 * Настройки по умолчанию — GBC.config.assistant; ученик может поменять их в панели
 * (хранятся в этом браузере). Диалог хранится отдельно для каждого урока.
 *
 * Без сервера курс работает как раньше: панель покажет, как его запустить.
 * Ответ модели — недоверенные данные: он отображается через GBC.md (без innerHTML).
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC || (root.GBC = {});
  GBC.config = GBC.config || {};
  GBC.config.assistant = Object.assign(
    {
      url: 'http://127.0.0.1:8137', // адрес claude-server
      model: 'sonnet', // opus | sonnet | haiku
      effort: 'low', // low | medium | high — сколько модель «думает» перед ответом
      token: '', // Bearer-токен, если сервер запущен с CLAUDE_SERVER_TOKEN
    },
    GBC.config.assistant || {}
  );

  /* =================================================================================
   * Чистая логика (без DOM) — проверяется в tests/js/assistant.test.js
   * ================================================================================= */

  /* claude-server передаёт запрос в командную строку `claude -p …`; в Windows длина
   * командной строки ограничена ~32 тыс. символов. Поэтому контекст дозируется. */
  const LIMITS = { selection: 2500, section: 7000, lesson: 2500, history: 6000, question: 4000, total: 22000, storedTurns: 40 };

  const SYSTEM_PROMPT = [
    'Ты — ИИ-наставник интерактивного курса «Градиентный бустинг по косточкам». Ученик читает урок, выделил фрагмент текста и задаёт по нему вопрос.',
    '',
    'Правила ответа:',
    '1. Отвечай по-русски, на «вы», дружелюбно и по существу. Сначала прямой ответ на вопрос, потом пояснение.',
    '2. Объясняй «по косточкам»: от простого к сложному, каждое новое понятие — простыми словами. Английский термин давай в скобках при первом упоминании.',
    '3. Опирайся на текст урока и его обозначения (F_m — модель после m деревьев, h_m — дерево, ν — темп обучения, g и h — градиент и гессиан). Не выдумывай числа, которых нет в уроке; если приводишь свой пример — так и скажи.',
    '4. Будь краток: обычно 80–250 слов. Развёрнуто — только если ученик просит подробнее.',
    '5. Формулы пиши в LaTeX: строчные — $…$, выключные — $$…$$. Код — на Python в блоках ```python. Разметка — Markdown.',
    '6. Где уместно, дай маленький числовой пример или аналогию и одной фразой свяжи с практикой (scikit-learn, XGBoost, LightGBM, CatBoost).',
    '7. Если вопрос не относится к курсу, ответь коротко и предложи вернуться к теме урока. Если не уверен — скажи об этом прямо.',
    '8. Отвечай сразу текстом: файлы, команды и другие инструменты не нужны — весь контекст уже в сообщении.',
    '9. Если к вопросу приложен скриншот — это снимок страницы урока (график, виджет, формула, вывод кода). Сначала коротко скажи, что на нём видно, затем отвечай по нему.',
  ].join('\n');

  /** Обрезать текст до max символов; around — подстрока, вокруг которой оставить окно. */
  function clip(text, max, around) {
    text = String(text || '');
    if (text.length <= max) return text;
    if (around) {
      const key = around.trim().slice(0, 80);
      const at = key ? text.indexOf(key) : -1;
      if (at >= 0) {
        const start = Math.max(0, Math.min(at - Math.floor(max * 0.4), text.length - max));
        return (start > 0 ? '…' : '') + text.slice(start, start + max).trim() + (start + max < text.length ? '…' : '');
      }
    }
    return text.slice(0, max).trim() + '…';
  }

  /** Привести текст, извлечённый из страницы, в порядок: пробелы, пустые строки. */
  function tidy(text) {
    return String(text || '')
      .replace(/ /g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function lessonBlock(lesson) {
    if (!lesson) return '';
    const lines = ['Урок ' + (lesson.number || '') + ' «' + (lesson.title || '') + '»' + (lesson.module ? ' (модуль: ' + lesson.module + ')' : '')];
    if (lesson.subtitle) lines.push('Подзаголовок: ' + lesson.subtitle);
    if (lesson.summary) lines.push('Кратко: ' + lesson.summary);
    if ((lesson.objectives || []).length) lines.push('Цели урока: ' + lesson.objectives.join('; '));
    if ((lesson.outline || []).length) lines.push('Разделы урока: ' + lesson.outline.join(' → '));
    return clip(lines.join('\n'), LIMITS.lesson);
  }

  /** Текст одного хода ученика для модели. full — добавлять ли текст раздела. */
  function userContent(turn, full) {
    const parts = [];
    const where = turn.section ? ' (раздел «' + turn.section + '»)' : '';
    if (turn.quote) parts.push('Выделенный фрагмент урока' + where + ':\n«' + clip(turn.quote, LIMITS.selection) + '»');
    else if (turn.section && full) parts.push('Ученик сейчас читает раздел «' + turn.section + '».');
    if (full && turn.context) parts.push('Текст раздела для контекста:\n"""\n' + clip(turn.context, LIMITS.section, turn.quote) + '\n"""');
    if (turn.image && full) parts.push('К вопросу приложен скриншот страницы урока.');
    else if (turn.image || turn.hadImage) parts.push('(К этому вопросу ученик прикладывал скриншот; сейчас он недоступен.)');
    parts.push('Вопрос ученика: ' + clip(turn.text, LIMITS.question));
    return parts.join('\n\n');
  }

  /**
   * Сообщения для /v1/chat/completions. turns — весь диалог (последний ход — вопрос ученика).
   * История обрезается с начала, пока запрос не уложится в лимит.
   */
  function buildMessages(lesson, turns) {
    const system = SYSTEM_PROMPT + '\n\nКонтекст — что читает ученик:\n' + lessonBlock(lesson);
    const last = turns[turns.length - 1];
    const sizeOf = (list) => list.reduce((s, m) => s + m.content.length + 12, 0);
    let latest = userContent(last, true);
    const history = [];
    let used = 0;
    for (let i = turns.length - 2; i >= 0; i--) {
      const t = turns[i];
      if (t.role === 'assistant' && (t.error || !t.text)) continue;
      const content = t.role === 'user' ? userContent(t, false) : clip(t.text, 2500);
      if (used + content.length > LIMITS.history) break;
      used += content.length;
      history.unshift({ role: t.role, content });
    }
    // история должна начинаться с хода ученика
    while (history.length && history[0].role !== 'user') history.shift();
    let messages = [{ role: 'system', content: system }, ...history, { role: 'user', content: latest }];
    while (sizeOf(messages) > LIMITS.total && history.length) {
      history.splice(0, 2);
      messages = [{ role: 'system', content: system }, ...history, { role: 'user', content: latest }];
    }
    if (sizeOf(messages) > LIMITS.total) {
      const over = sizeOf(messages) - LIMITS.total;
      const ctx = clip(last.context || '', Math.max(500, Math.min(LIMITS.section, (last.context || '').length) - over - 50), last.quote);
      latest = userContent(Object.assign({}, last, { context: ctx }), true);
      messages = [{ role: 'system', content: system }, ...history, { role: 'user', content: latest }];
    }
    // Скриншот — в формате OpenAI (image_url с data-URL); claude-server передаёт его модели как изображение
    if (last.image) messages[messages.length - 1].content = [{ type: 'text', text: latest }, { type: 'image_url', image_url: { url: last.image } }];
    return messages;
  }

  /** Разбор потока Server-Sent Events: feed(кусок текста) → onEvent(объект | '[DONE]'). */
  function sseParser(onEvent) {
    let buf = '';
    const emit = (block) => {
      const data = block
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).replace(/^ /, ''))
        .join('\n');
      if (!data) return;
      if (data.trim() === '[DONE]') return onEvent('[DONE]');
      try {
        onEvent(JSON.parse(data));
      } catch (e) {
        /* неполная или посторонняя строка — пропускаем */
      }
    };
    return {
      feed(chunk) {
        buf += chunk;
        let m;
        while ((m = /\r?\n\r?\n/.exec(buf))) {
          emit(buf.slice(0, m.index));
          buf = buf.slice(m.index + m[0].length);
        }
      },
      end() {
        if (buf.trim()) emit(buf);
        buf = '';
      },
    };
  }

  /** Привести адрес сервера к виду http(s)://host[:port] или вернуть null. */
  function normalizeUrl(url) {
    const s = String(url || '').trim().replace(/\/+$/, '');
    return /^https?:\/\/[^\s/]+(\/[^\s]*)?$/i.test(s) ? s.replace(/\/v1$/i, '') : null;
  }

  /** Размер картинки после вписывания в квадрат max×max (без увеличения). */
  function fitSize(w, h, max) {
    const k = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
  }

  /**
   * Область кадра для вырезания: rect — прямоугольник в координатах окна (CSS-пиксели),
   * view — размер окна, frame — размер кадра захвата (он крупнее при масштабе экрана > 100%).
   */
  function cropRect(rect, view, frame) {
    const sx = frame.w / view.w;
    const sy = frame.h / view.h;
    const x = Math.max(0, Math.min(frame.w - 1, Math.round(rect.x * sx)));
    const y = Math.max(0, Math.min(frame.h - 1, Math.round(rect.y * sy)));
    return { x, y, w: Math.max(1, Math.min(frame.w - x, Math.round(rect.w * sx))), h: Math.max(1, Math.min(frame.h - y, Math.round(rect.h * sy))) };
  }

  const pure = { LIMITS, SYSTEM_PROMPT, clip, tidy, lessonBlock, userContent, buildMessages, sseParser, normalizeUrl, fitSize, cropRect };
  GBC.assistant = { _pure: pure };
  if (!root.document) return; // Node.js (тесты): только чистая логика

  /* =================================================================================
   * Браузер
   * ================================================================================= */
  const doc = root.document;
  const H = GBC.h;
  const icon = (n) => GBC.ui.icon(n);
  const SERVER_CMD = 'node claude-server/server.js';

  const state = {
    main: null,
    lesson: null, // запись манифеста
    turns: [],
    quote: null, // {text, section, context} — фрагмент, приложенный к следующему вопросу
    image: null, // data-URL скриншота, приложенного к следующему вопросу
    serverImages: null, // умеет ли запущенный claude-server принимать изображения
    busy: false,
    abort: null,
    online: null, // null — не проверяли, true/false
    open: false,
  };
  const el = {}; // узлы интерфейса

  const settings = () => Object.assign({}, GBC.config.assistant, GBC.storage.get('assistant-settings', {}) || {});
  const storeKey = () => 'assistant:' + (state.lesson ? state.lesson.id : 'course');
  const saveTurns = () =>
    GBC.storage.set(
      storeKey(),
      // сами скриншоты не сохраняем (они большие) — только отметку, что он был
      state.turns.slice(-LIMITS.storedTurns).map((t) => ({ role: t.role, text: t.text, quote: t.quote, section: t.section, error: t.error, stopped: t.stopped, hadImage: !!(t.image || t.hadImage) || undefined }))
    );

  /* --------------------------------- текст урока ---------------------------------- */
  const SKIP = 'script, style, noscript, button, .katex-html, .copy-btn, .anchor, .widget-actions, .visually-hidden, .assistant-ask, .lvl, .go, .callout-title svg, .plot-tip, .steps-nav';
  const BLOCK = /^(P|DIV|SECTION|ARTICLE|H[1-6]|LI|UL|OL|DL|DT|DD|TR|TABLE|PRE|BLOCKQUOTE|DETAILS|SUMMARY|HEADER|FOOTER|FIGURE|FIGCAPTION|HR)$/;

  /** Текст узла так, как его стоит показать модели: формулы — в TeX, виджеты — пометкой. */
  function textOf(node) {
    let out = '';
    const walk = (n) => {
      if (n.nodeType === 3) {
        out += n.nodeValue;
        return;
      }
      if (n.nodeType !== 1 && n.nodeType !== 11) return;
      if (n.nodeType === 1) {
        if (n.matches(SKIP)) return;
        if (n.classList.contains('katex')) {
          const ann = n.querySelector('annotation');
          const html = n.querySelector('.katex-html');
          const display = n.parentElement && n.parentElement.classList.contains('katex-display');
          if (ann) out += display ? '\n$$' + ann.textContent.trim() + '$$\n' : '$' + ann.textContent.trim() + '$';
          else out += (html || n).textContent;
          return;
        }
        if (n.classList.contains('katex-mathml')) return;
        if (n.matches('[data-widget], .widget')) {
          const t = n.querySelector('.widget-title, .widget-head h3');
          out += '\n[интерактивный виджет' + (t ? ': ' + t.textContent.trim() : '') + ']\n';
          return;
        }
        if (n.classList.contains('quiz')) {
          out += '\n[тест «Проверь себя»]\n';
          return;
        }
        if (n.classList.contains('pycell')) {
          const cm = n.querySelector('.CodeMirror');
          const code = cm && cm.CodeMirror ? cm.CodeMirror.getValue() : (n.querySelector('pre code') || {}).textContent;
          out += code ? '\n```python\n' + code.trim() + '\n```\n' : '\n[ячейка Python]\n';
          return;
        }
        if (n.tagName === 'PRE') {
          out += '\n```\n' + n.textContent.trim() + '\n```\n';
          return;
        }
        if (n.tagName === 'BR') {
          out += '\n';
          return;
        }
        if (n.tagName === 'LI') out += '\n- ';
        else if (n.tagName === 'TD' || n.tagName === 'TH') out += ' | ';
        else if (BLOCK.test(n.tagName)) out += '\n';
      }
      for (const c of n.childNodes) walk(c);
      if (n.nodeType === 1 && BLOCK.test(n.tagName)) out += '\n';
    };
    walk(node);
    return tidy(out);
  }

  const headingText = (h) => (h ? tidy(textOf(h)).replace(/#$/, '').trim() : '');

  /** Раздел урока, к которому относится узел: {title, node}. */
  function sectionOf(node) {
    const start = node && node.nodeType === 3 ? node.parentElement : node;
    const sec = start && start.closest ? start.closest('main section[id], main > section, main .lesson-hero, main .lesson-end') : null;
    if (sec && sec.matches('section')) return { title: headingText(sec.querySelector('h2, h3')), node: sec };
    return { title: sec && sec.matches('.lesson-hero') ? 'Начало урока' : '', node: sec || state.main };
  }

  /** Раздел, который сейчас на экране (когда чат открыт без выделения). */
  function visibleSection() {
    const top = 90;
    let best = null;
    for (const s of state.main.querySelectorAll(':scope > section')) {
      const r = s.getBoundingClientRect();
      if (r.bottom > top + 40) {
        best = s;
        break;
      }
    }
    return best ? sectionOf(best) : { title: '', node: null };
  }

  function lessonInfo() {
    const l = state.lesson;
    if (!l) return null;
    const parent = l.parent && GBC.page.byId ? GBC.page.byId(l.parent) : null;
    const strip = (html) => tidy(String(html || '').replace(/<[^>]+>/g, ''));
    return {
      number: l.number,
      title: l.title,
      module: parent ? parent.number + ' ' + parent.title : '',
      subtitle: l.subtitle,
      summary: l.summary,
      objectives: (l.objectives || []).map(strip),
      outline: Array.from(state.main.querySelectorAll(':scope > section > h2')).map(headingText).filter(Boolean),
    };
  }

  /* --------------------------------- выделение ------------------------------------ */
  function currentSelection() {
    const sel = root.getSelection && root.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const inMain = (n) => n && state.main.contains(n);
    if (!inMain(sel.anchorNode) || !inMain(sel.focusNode)) return null;
    const host = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (host && host.closest('input, textarea, select, [contenteditable="true"], .CodeMirror, .assistant')) return null;
    const text = textOf(range.cloneContents());
    if (!text.replace(/\s/g, '')) return null; // достаточно одного символа: «ν», «h»
    return { range, text };
  }

  function quoteFromSelection(s) {
    const sec = sectionOf(s.range.startContainer);
    return { text: clip(s.text, LIMITS.selection), section: sec.title, context: sec.node ? textOf(sec.node) : '' };
  }

  function placeAsk() {
    const s = currentSelection();
    if (!s || mouseDown) return hideAsk();
    const rects = Array.from(s.range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) return hideAsk();
    const last = rects[rects.length - 1];
    const first = rects[0];
    const vw = doc.documentElement.clientWidth;
    const vh = root.innerHeight;
    el.ask.hidden = false;
    const w = el.ask.offsetWidth;
    const h = el.ask.offsetHeight;
    let top = last.bottom + 8;
    let left = last.right - w / 2;
    if (top + h > vh - 8) top = first.top - h - 8; // снизу нет места — над выделением
    if (top < 8 || last.bottom < 0 || first.top > vh) return hideAsk(); // выделение ушло с экрана
    left = Math.max(8, Math.min(left, vw - w - 8));
    el.ask.style.top = Math.round(top) + 'px';
    el.ask.style.left = Math.round(left) + 'px';
    el.ask.classList.add('show');
  }
  function hideAsk() {
    if (!el.ask) return;
    el.ask.classList.remove('show');
    el.ask.hidden = true;
  }

  let mouseDown = false;
  let selTimer = null;
  function watchSelection() {
    const later = (ms) => {
      clearTimeout(selTimer);
      selTimer = setTimeout(placeAsk, ms);
    };
    doc.addEventListener('mousedown', (e) => {
      if (el.ask.contains(e.target)) return;
      mouseDown = true;
      hideAsk();
    });
    doc.addEventListener('mouseup', () => {
      mouseDown = false;
      later(10);
    });
    doc.addEventListener('keyup', (e) => {
      if (e.shiftKey || e.key === 'Shift' || (e.key === 'a' && (e.ctrlKey || e.metaKey))) later(10);
    });
    doc.addEventListener('touchend', () => later(350), { passive: true });
    doc.addEventListener('selectionchange', () => later(mouseDown ? 100000 : 300));
    const follow = GBC.util.rafThrottle(() => {
      if (!el.ask.hidden) placeAsk();
    });
    root.addEventListener('scroll', follow, { passive: true, capture: true });
    root.addEventListener('resize', follow);
  }

  /* --------------------------------- сервер --------------------------------------- */
  function headers() {
    const h = { 'Content-Type': 'application/json' };
    const t = settings().token;
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }

  async function checkServer() {
    const url = normalizeUrl(settings().url);
    setStatus(null);
    let ok = false;
    if (url) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 3500);
      try {
        const r = await fetch(url + '/health', { signal: ctl.signal, cache: 'no-store' });
        ok = r.ok;
        // сервер из папки claude-server сообщает {images: true}; старая запущенная копия — нет
        state.serverImages = ok ? !!((await r.json().catch(() => ({}))) || {}).images : null;
      } catch (e) {
        ok = false;
      }
      clearTimeout(timer);
    }
    setStatus(ok);
    return ok;
  }

  function setStatus(online) {
    state.online = online;
    if (!el.panel) return;
    el.panel.dataset.status = online === null ? 'checking' : online ? 'online' : 'offline';
    const s = settings();
    el.status.textContent = online === null ? 'проверяю сервер…' : online ? 'Claude · ' + s.model + ' · локально' : 'сервер не запущен';
    el.offline.hidden = online !== false;
  }

  /** Потоковый запрос. cb: {onText(полный текст), onThinking(число токенов)}. */
  async function streamChat(messages, signal, cb) {
    const s = settings();
    const url = normalizeUrl(s.url);
    if (!url) throw Object.assign(new Error('В настройках указан неверный адрес сервера.'), { kind: 'config' });
    let res;
    try {
      res = await fetch(url + '/v1/chat/completions', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ model: s.model, effort: s.effort, stream: true, messages }),
        signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw Object.assign(new Error('Не удалось связаться с claude-server.'), { kind: 'offline' });
    }
    if (!res.ok) {
      let msg = 'Сервер ответил ошибкой ' + res.status + '.';
      try {
        const j = await res.json();
        if (j && j.error && j.error.message) msg = j.error.message;
      } catch (e) {
        /* тело не JSON */
      }
      if (res.status === 401) msg = 'Сервер требует токен: укажите его в настройках ассистента.';
      throw Object.assign(new Error(msg), { kind: 'server' });
    }
    let text = '';
    let failed = null;
    const parser = sseParser((ev) => {
      if (ev === '[DONE]') return;
      if (ev.error) {
        failed = ev.error.message || 'Ошибка генерации.';
        return;
      }
      const d = ev.choices && ev.choices[0] && ev.choices[0].delta;
      if (!d) return;
      if (typeof d.reasoning_tokens === 'number') cb.onThinking(d.reasoning_tokens);
      if (d.content) {
        text += d.content;
        cb.onText(text);
      }
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(dec.decode(value, { stream: true }));
    }
    parser.end();
    if (failed) throw Object.assign(new Error(failed), { kind: 'server', partial: text });
    if (!text.trim()) throw Object.assign(new Error('Модель вернула пустой ответ. Попробуйте ещё раз.'), { kind: 'server' });
    return text;
  }

  /* --------------------------------- сообщения ------------------------------------ */
  const nearBottom = () => el.body.scrollHeight - el.body.scrollTop - el.body.clientHeight < 80;
  const toBottom = () => (el.body.scrollTop = el.body.scrollHeight);

  /** Текст фрагмента урока с отрисованными формулами ($…$ → KaTeX); остальное — как есть. */
  function withMath(text) {
    const out = [];
    const re = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g;
    let at = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > at) out.push(text.slice(at, m.index));
      out.push(GBC.math.tex((m[1] || m[2]).trim(), false));
      at = m.index + m[0].length;
    }
    if (at < text.length) out.push(text.slice(at));
    return out;
  }

  function quoteBlock(q, section) {
    return H('blockquote', { class: 'assistant-cite' }, section ? H('span', { class: 'src' }, 'Из урока · ' + section) : null, H('span', { class: 'txt' }, withMath(clip(q, 600))));
  }

  function renderUser(t) {
    const shot = t.image
      ? H('img', { class: 'assistant-shot', src: t.image, alt: 'Скриншот, приложенный к вопросу' })
      : t.hadImage
        ? H('span', { class: 'assistant-shot-gone' }, icon('image'), 'скриншот (не сохраняется после перезагрузки)')
        : null;
    return H('div', { class: 'assistant-msg user' }, t.quote ? quoteBlock(t.quote, t.section) : null, shot, H('div', { class: 'bubble' }, t.text));
  }

  /* --------------------------------- скриншот ------------------------------------- */
  const SHOT_MAX = 1568; // длинная сторона, пикселей: больше модели не нужно
  const canCapture = () => !!(root.navigator.mediaDevices && root.navigator.mediaDevices.getDisplayMedia);

  /** Холст → data-URL: PNG, а если он тяжёлый (фото, градиенты) — JPEG. */
  function canvasToDataUrl(canvas) {
    const png = canvas.toDataURL('image/png');
    return png.length < 1500000 ? png : canvas.toDataURL('image/jpeg', 0.9);
  }

  /** Вырезать область из источника (видео-кадр или картинка) и уменьшить до SHOT_MAX. */
  function drawShot(source, frame, crop) {
    const c = crop || { x: 0, y: 0, w: frame.w, h: frame.h };
    const size = pure.fitSize(c.w, c.h, SHOT_MAX);
    const canvas = H('canvas', { width: size.w, height: size.h });
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, c.x, c.y, c.w, c.h, 0, 0, size.w, size.h);
    return canvasToDataUrl(canvas);
  }

  function attachImage(dataUrl) {
    state.image = dataUrl;
    renderShot();
    updateSend();
    if (state.serverImages === false) GBC.ui.toast('Запущенный claude-server не принимает картинки — перезапустите его');
  }

  /** Картинка из файла или буфера обмена. */
  function attachFile(file) {
    if (!file || !/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return GBC.ui.toast('Подойдёт картинка PNG, JPEG, WebP или GIF');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      attachImage(drawShot(img, { w: img.naturalWidth, h: img.naturalHeight }));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      GBC.ui.toast('Не удалось прочитать картинку');
    };
    img.src = url;
  }

  /**
   * Выбор области мышью на застывшем снимке окна. Возвращает {x, y, w, h} в координатах окна,
   * 'full' (Enter или щелчок без протяжки — всё окно) или null (Esc).
   */
  function pickRegion(frozen) {
    return new Promise((resolve) => {
      frozen.className = 'assistant-region-frame';
      const box = H('div', { class: 'assistant-region-box', hidden: true });
      const hint = H('div', { class: 'assistant-region-hint' }, 'Выделите мышью область для снимка · Enter — всё окно · Esc — отмена');
      const layer = H('div', { class: 'assistant-region', tabindex: '-1', role: 'dialog', 'aria-label': 'Выбор области снимка' }, frozen, box, hint);
      let start = null;
      const rectOf = (e) => ({ x: Math.min(start.x, e.clientX), y: Math.min(start.y, e.clientY), w: Math.abs(e.clientX - start.x), h: Math.abs(e.clientY - start.y) });
      const finish = (value) => {
        layer.remove();
        doc.removeEventListener('keydown', onKey, true);
        resolve(value);
      };
      const onKey = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          finish(e.key === 'Enter' ? 'full' : null);
        }
      };
      layer.addEventListener('pointerdown', (e) => {
        start = { x: e.clientX, y: e.clientY };
        layer.setPointerCapture(e.pointerId);
        hint.hidden = true;
      });
      layer.addEventListener('pointermove', (e) => {
        if (!start) return;
        const r = rectOf(e);
        box.hidden = false;
        Object.assign(box.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      });
      layer.addEventListener('pointerup', (e) => {
        if (!start) return;
        const r = rectOf(e);
        finish(r.w >= 8 && r.h >= 8 ? r : 'full');
      });
      doc.addEventListener('keydown', onKey, true);
      doc.body.appendChild(layer);
      layer.focus();
    });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => (root.requestAnimationFrame || setTimeout)(() => r()));

  /**
   * Снимок экрана, как в «ножницах»: браузер спрашивает разрешение на показ вкладки, мы берём ОДИН кадр
   * и сразу останавливаем показ; затем ученик выделяет область уже на застывшем кадре. Так в снимок
   * не попадает рамка выбора, а координаты области точно соответствуют тому, что ученик видит.
   */
  async function captureScreenshot() {
    if (state.capturing) return;
    if (!canCapture()) return el.file.click(); // телефон и старые браузеры — выбрать файл
    state.capturing = true;
    let stream = null;
    const video = H('video', { class: 'assistant-capture-video', muted: true, playsinline: true });
    try {
      stream = await root.navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' });
      const track = stream.getVideoTracks()[0];
      const isTab = (track.getSettings ? track.getSettings().displaySurface : 'browser') === 'browser';
      doc.body.classList.add('assistant-shooting'); // прячем панель и кнопку — в кадре только урок
      doc.body.appendChild(video); // в документе: иначе браузер может не обновлять кадры
      video.srcObject = stream;
      await video.play();
      // страница перерисовывается без панели; захват отстаёт на несколько кадров — ждём, но не вечно
      await nextFrame();
      await nextFrame();
      await Promise.race([new Promise((r) => (video.requestVideoFrameCallback ? video.requestVideoFrameCallback(() => r()) : r())), sleep(500)]);
      await sleep(250);
      const frame = { w: video.videoWidth, h: video.videoHeight };
      if (!frame.w || !frame.h) throw new Error('пустой кадр');
      const frozen = H('canvas', { width: frame.w, height: frame.h });
      frozen.getContext('2d').drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop()); // показ экрана больше не нужен
      stream = null;
      const region = isTab ? await pickRegion(frozen) : 'full';
      if (region) attachImage(drawShot(frozen, frame, region === 'full' ? null : pure.cropRect(region, { w: root.innerWidth, h: root.innerHeight }, frame)));
    } catch (e) {
      if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') GBC.ui.toast('Не удалось сделать снимок: ' + (e.message || e.name));
    } finally {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      video.remove();
      doc.body.classList.remove('assistant-shooting');
      state.capturing = false;
      if (el.input) el.input.focus({ preventScroll: true });
    }
  }

  function renderShot() {
    el.shot.textContent = '';
    el.shot.hidden = !state.image;
    if (!state.image) return;
    const x = H('button', { type: 'button', class: 'icon-btn', title: 'Убрать скриншот', 'aria-label': 'Убрать скриншот' }, icon('close'));
    x.addEventListener('click', () => {
      state.image = null;
      renderShot();
      updateSend();
      el.input.focus();
    });
    el.shot.append(H('img', { src: state.image, alt: 'Скриншот к вопросу' }), H('span', null, 'Скриншот будет отправлен с вопросом'), x);
  }

  function renderBot(t, isLast) {
    const body = H('div', { class: 'assistant-answer' });
    if (t.text) body.appendChild(GBC.md.toElement(t.text));
    if (t.stopped) body.appendChild(H('p', { class: 'assistant-note' }, 'Ответ остановлен.'));
    if (t.error) body.appendChild(H('p', { class: 'assistant-error', role: 'alert' }, icon('alert'), H('span', null, t.error)));
    const actions = H('div', { class: 'assistant-actions' });
    if (t.text) {
      const copy = H('button', { type: 'button', class: 'icon-btn', title: 'Копировать ответ', 'aria-label': 'Копировать ответ' }, icon('copy'));
      copy.addEventListener('click', async () => GBC.ui.toast((await GBC.io.copy(t.text)) ? 'Ответ скопирован' : 'Не удалось скопировать'));
      actions.appendChild(copy);
    }
    if (isLast) {
      const retry = H('button', { type: 'button', class: 'icon-btn', title: 'Ответить заново', 'aria-label': 'Ответить заново' }, icon('reset'));
      retry.addEventListener('click', regenerate);
      actions.appendChild(retry);
    }
    return H('div', { class: 'assistant-msg bot' }, body, actions);
  }

  function renderAll() {
    el.log.textContent = '';
    state.turns.forEach((t, i) => el.log.appendChild(t.role === 'user' ? renderUser(t) : renderBot(t, i === state.turns.length - 1 && !state.busy)));
    el.empty.hidden = state.turns.length > 0;
    renderChips();
    toBottom();
  }

  const CHIPS_QUOTE = ['Объясните проще', 'Приведите пример на числах', 'Зачем это нужно?', 'Как это выглядит в коде?'];
  const CHIPS_EMPTY = ['Перескажите главную мысль раздела', 'Проверьте меня: задайте 3 вопроса', 'Какие здесь частые ошибки?'];
  function renderChips() {
    el.chips.textContent = '';
    const list = state.quote ? CHIPS_QUOTE : state.turns.length ? [] : CHIPS_EMPTY;
    for (const c of list) {
      const b = H('button', { type: 'button', class: 'assistant-chip' }, c);
      b.addEventListener('click', () => send(c));
      el.chips.appendChild(b);
    }
    el.chips.hidden = !list.length || state.busy;
  }

  function renderQuote() {
    el.quote.textContent = '';
    el.quote.hidden = !state.quote;
    if (state.quote) {
      const x = H('button', { type: 'button', class: 'icon-btn', title: 'Убрать фрагмент', 'aria-label': 'Убрать фрагмент' }, icon('close'));
      x.addEventListener('click', () => {
        state.quote = null;
        renderQuote();
        renderChips();
        el.input.focus();
      });
      el.quote.append(quoteBlock(state.quote.text, state.quote.section), x);
    }
  }

  function setBusy(b) {
    state.busy = b;
    el.panel.classList.toggle('busy', b);
    el.log.setAttribute('aria-busy', String(b));
    el.send.replaceChildren(icon(b ? 'stop' : 'send'));
    el.send.title = b ? 'Остановить' : 'Отправить (Enter)';
    el.send.setAttribute('aria-label', el.send.title);
    updateSend();
    renderChips();
  }
  const updateSend = () => (el.send.disabled = !state.busy && !el.input.value.trim() && !state.image);

  /* --------------------------------- отправка ------------------------------------- */
  async function send(textArg) {
    if (state.busy) return;
    const text = (textArg || el.input.value).trim() || (state.image ? 'Объясните, что показано на скриншоте.' : '');
    if (!text) return;
    const q = state.quote;
    const sec = q ? null : visibleSection();
    const turn = { role: 'user', text, quote: q ? q.text : undefined, section: q ? q.section : sec.title || undefined, image: state.image || undefined };
    turn.context = q ? q.context : sec.node ? textOf(sec.node) : '';
    state.turns.push(turn);
    state.quote = null;
    state.image = null;
    renderShot();
    if (!textArg) {
      el.input.value = '';
      autosize();
    }
    renderQuote();
    await answer();
  }

  function regenerate() {
    if (state.busy) return;
    while (state.turns.length && state.turns[state.turns.length - 1].role === 'assistant') state.turns.pop();
    if (state.turns.length) answer();
  }

  async function answer() {
    const bot = { role: 'assistant', text: '' };
    const messages = buildMessages(lessonInfo(), state.turns);
    state.turns.push(bot);
    setBusy(true);
    renderAll();
    // «живой» узел ответа: индикатор размышления → текст по мере поступления
    const node = el.log.lastChild;
    const body = node.querySelector('.assistant-answer');
    const think = H('div', { class: 'assistant-thinking' }, H('span', { class: 'dots', 'aria-hidden': 'true' }, H('i'), H('i'), H('i')), H('span', { class: 'label' }, 'Думаю…'));
    body.replaceChildren(think);
    const t0 = Date.now();
    const tick = setInterval(() => {
      const label = think.querySelector('.label');
      if (label && think.isConnected) label.textContent = 'Думаю… ' + Math.round((Date.now() - t0) / 1000) + ' с' + (think.dataset.tokens ? ' · ≈ ' + think.dataset.tokens + ' токенов рассуждений' : '');
    }, 1000);
    const paint = GBC.util.rafThrottle(() => {
      const stick = nearBottom();
      body.replaceChildren(GBC.md.toElement(bot.text), H('span', { class: 'assistant-caret', 'aria-hidden': 'true' }));
      if (stick) toBottom();
    });
    state.abort = new AbortController();
    try {
      bot.text = await streamChat(messages, state.abort.signal, {
        onThinking: (n) => (think.dataset.tokens = String(n)),
        onText: (text) => {
          bot.text = text;
          paint();
        },
      });
      if (state.online !== true) setStatus(true);
    } catch (e) {
      if (e.name === 'AbortError') bot.stopped = true;
      else {
        if (e.partial) bot.text = e.partial;
        bot.error = e.message || 'Не удалось получить ответ.';
        if (e.kind === 'offline') {
          setStatus(false);
          bot.error = 'Нет связи с claude-server. Запустите его и нажмите «Ответить заново».';
        }
      }
    } finally {
      clearInterval(tick);
      state.abort = null;
      setBusy(false);
      saveTurns();
      // Лента перерисовывается целиком; отложенный paint() попадёт в уже отсоединённый узел — это безвредно
      renderAllKeepScroll(nearBottom());
    }
  }

  function renderAllKeepScroll(stick) {
    const top = el.body.scrollTop;
    renderAll();
    if (!stick) el.body.scrollTop = top;
  }

  /* --------------------------------- панель --------------------------------------- */
  function autosize() {
    el.input.style.height = 'auto';
    el.input.style.height = Math.min(160, el.input.scrollHeight) + 'px';
    updateSend();
  }

  function buildSettings() {
    const s = settings();
    const field = (label, control, hint) => H('label', { class: 'assistant-field' }, H('span', null, label), control, hint ? H('small', null, hint) : null);
    const url = H('input', { type: 'url', value: s.url, spellcheck: 'false', autocomplete: 'off' });
    const option = (v, label, cur) => H('option', { value: v, selected: v === cur }, label);
    const model = H('select', null, option('sonnet', 'Sonnet — быстро и точно', s.model), option('opus', 'Opus — глубже, медленнее', s.model), option('haiku', 'Haiku — самый быстрый', s.model));
    const effort = H('select', null, option('low', 'Быстрый ответ', s.effort), option('medium', 'Обдуманный', s.effort), option('high', 'Глубокий (дольше)', s.effort));
    const token = H('input', { type: 'password', value: s.token, autocomplete: 'off', placeholder: 'не требуется' });
    const save = GBC.ui.button(null, { label: 'Сохранить', kind: 'primary', small: true });
    const reset = GBC.ui.button(null, { label: 'По умолчанию', kind: 'ghost', small: true });
    save.addEventListener('click', () => {
      const u = normalizeUrl(url.value);
      if (!u) {
        url.setAttribute('aria-invalid', 'true');
        url.focus();
        return GBC.ui.toast('Адрес должен начинаться с http:// или https://');
      }
      GBC.storage.set('assistant-settings', { url: u, model: model.value, effort: effort.value, token: token.value.trim() });
      toggleSettings(false);
      checkServer();
      GBC.ui.toast('Настройки сохранены');
    });
    reset.addEventListener('click', () => {
      GBC.storage.set('assistant-settings', {});
      el.settings.replaceChildren(...buildSettings());
      checkServer();
    });
    return [
      field('Адрес claude-server', url, 'Локальный сервер из папки claude-server. Запросы уходят только на этот адрес.'),
      field('Модель', model),
      field('Глубина ответа', effort),
      field('Токен доступа', token, 'Нужен, только если сервер запущен с CLAUDE_SERVER_TOKEN.'),
      H('div', { class: 'assistant-settings-foot' }, reset, save),
    ];
  }

  function toggleSettings(show) {
    const on = show === undefined ? el.settings.hidden : show;
    if (on) el.settings.replaceChildren(...buildSettings());
    el.settings.hidden = !on;
    el.settingsBtn.setAttribute('aria-expanded', String(on));
  }

  function buildPanel() {
    const l = state.lesson;
    const iconBtn = (name, label, fn) => {
      const b = H('button', { type: 'button', class: 'icon-btn', title: label, 'aria-label': label }, icon(name));
      b.addEventListener('click', fn);
      return b;
    };
    el.status = H('span', { class: 'assistant-status' });
    el.settingsBtn = iconBtn('settings', 'Настройки', () => toggleSettings());
    el.settingsBtn.setAttribute('aria-expanded', 'false');
    const head = H(
      'header',
      { class: 'assistant-head' },
      H('span', { class: 'assistant-logo' }, icon('chat')),
      H('div', { class: 'assistant-title' }, H('strong', null, 'ИИ-ассистент'), H('span', { class: 'sub' }, H('i', { class: 'dot', 'aria-hidden': 'true' }), el.status)),
      iconBtn('plus', 'Новый диалог', newChat),
      el.settingsBtn,
      iconBtn('close', 'Закрыть (Esc)', () => close())
    );
    el.settings = H('div', { class: 'assistant-settings', hidden: true });

    const cmd = H('code', null, SERVER_CMD);
    const copyCmd = GBC.ui.button(null, { label: 'Копировать', icon: 'copy', kind: 'ghost', small: true });
    copyCmd.addEventListener('click', async () => GBC.ui.toast((await GBC.io.copy(SERVER_CMD)) ? 'Команда скопирована' : 'Не удалось скопировать'));
    const retry = GBC.ui.button(null, { label: 'Проверить снова', icon: 'reset', small: true });
    retry.addEventListener('click', async () => {
      if (await checkServer()) GBC.ui.toast('Сервер на связи');
    });
    el.offline = H(
      'div',
      { class: 'assistant-offline', hidden: true, role: 'status' },
      H('strong', null, icon('alert'), 'Локальный сервер ИИ не запущен'),
      H('p', null, 'Ассистент работает через Claude Code на вашем компьютере. Запустите сервер в терминале из корня курса:'),
      H('div', { class: 'cmd' }, cmd, copyCmd),
      H('p', { class: 'muted' }, 'Нужны Node.js 18+ и выполненный вход ', H('code', null, 'claude login'), '. Команда ', H('code', null, 'python tools/serve.py'), ' запускает сервер вместе с курсом.'),
      retry
    );

    el.empty = H(
      'div',
      { class: 'assistant-empty' },
      H('span', { class: 'big' }, icon('chat')),
      H('strong', null, 'Спросите об уроке'),
      H('p', null, 'Выделите в уроке любое место — слово, формулу, абзац — и нажмите «Спросить ИИ». Ассистент увидит выделенный фрагмент и раздел, в котором он находится.'),
      H('p', { class: 'muted' }, l ? 'Сейчас открыт урок ' + l.number + ' «' + l.title + '».' : '')
    );
    el.log = H('div', { class: 'assistant-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Диалог с ассистентом' });
    el.body = H('div', { class: 'assistant-body' }, el.empty, el.log);

    el.quote = H('div', { class: 'assistant-quote', hidden: true });
    el.chips = H('div', { class: 'assistant-chips' });
    el.input = H('textarea', { rows: '1', placeholder: 'Ваш вопрос…', 'aria-label': 'Вопрос ассистенту', maxlength: String(LIMITS.question) });
    el.input.addEventListener('input', autosize);
    el.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        send();
      }
    });
    // картинка из буфера обмена (Ctrl+V) — например, снимок, сделанный «ножницами»
    el.input.addEventListener('paste', (e) => {
      const file = Array.from((e.clipboardData && e.clipboardData.files) || []).find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        attachFile(file);
      }
    });
    el.send = H('button', { type: 'button', class: 'assistant-send' }, icon('send'));
    el.send.addEventListener('click', () => (state.busy ? state.abort && state.abort.abort() : send()));
    el.shot = H('div', { class: 'assistant-shot-preview', hidden: true });
    el.file = H('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true, 'aria-hidden': 'true', tabindex: '-1' });
    el.file.addEventListener('change', () => {
      if (el.file.files[0]) attachFile(el.file.files[0]);
      el.file.value = '';
    });
    const shotLabel = canCapture() ? 'Сделать скриншот и приложить к вопросу' : 'Приложить картинку';
    el.camera = H('button', { type: 'button', class: 'icon-btn assistant-camera', title: shotLabel, 'aria-label': shotLabel }, icon('camera'));
    el.camera.addEventListener('click', captureScreenshot);
    const foot = H(
      'footer',
      { class: 'assistant-foot' },
      el.quote,
      el.shot,
      el.chips,
      H('div', { class: 'assistant-input' }, el.camera, el.input, el.send, el.file),
      H('p', { class: 'assistant-hint' }, 'Enter — отправить, Shift+Enter — новая строка. Картинку можно вставить из буфера (Ctrl+V). ИИ может ошибаться — сверяйтесь с уроком.')
    );

    el.panel = H('aside', { class: 'assistant', 'aria-label': 'ИИ-ассистент урока', hidden: true }, head, el.settings, el.offline, el.body, foot);
    el.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!el.settings.hidden) toggleSettings(false);
        else close();
      }
    });
    doc.body.appendChild(el.panel);
    setBusy(false);
  }

  function newChat() {
    if (state.abort) state.abort.abort();
    state.turns = [];
    state.quote = null;
    state.image = null;
    saveTurns();
    renderQuote();
    renderShot();
    renderAll();
    el.input.focus();
  }

  let returnFocus = null;
  /** Открыть панель; quote — {text, section, context} или null. */
  function open(quote) {
    if (!el.panel) buildPanel();
    if (quote) state.quote = quote;
    if (!state.open) {
      returnFocus = doc.activeElement;
      state.open = true;
      el.panel.hidden = false;
      doc.body.classList.add('assistant-open');
      el.toggle.setAttribute('aria-pressed', 'true');
      renderAll();
      checkServer();
    }
    renderQuote();
    renderChips();
    hideAsk();
    setTimeout(() => el.input.focus({ preventScroll: true }), 30);
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    el.panel.hidden = true;
    doc.body.classList.remove('assistant-open');
    el.toggle.setAttribute('aria-pressed', 'false');
    if (returnFocus && returnFocus.focus && doc.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  }

  /* --------------------------------- инициализация -------------------------------- */
  function init() {
    const main = doc.querySelector('main.lesson');
    const id = doc.documentElement.dataset.lesson;
    const lesson = id && GBC.page && GBC.page.byId ? GBC.page.byId(id) : null;
    if (!main || !lesson || el.ask) return; // ассистент — только на страницах уроков
    state.main = main;
    state.lesson = lesson;
    state.turns = (GBC.storage.get(storeKey(), []) || []).filter((t) => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string');

    // кнопка у выделенного текста
    el.ask = H('button', { type: 'button', class: 'assistant-ask', hidden: true, title: 'Задать вопрос ИИ-ассистенту по выделенному фрагменту (Alt+I)' }, icon('chat'), H('span', null, 'Спросить ИИ'));
    el.ask.addEventListener('mousedown', (e) => e.preventDefault()); // не сбрасывать выделение
    el.ask.addEventListener('click', () => {
      const s = currentSelection();
      if (s) open(quoteFromSelection(s));
    });
    doc.body.appendChild(el.ask);
    watchSelection();

    // кнопка в шапке
    el.toggle = H('button', { type: 'button', class: 'icon-btn assistant-toggle', 'aria-label': 'ИИ-ассистент', 'aria-pressed': 'false', title: 'ИИ-ассистент урока (Alt+I)' }, icon('chat'));
    el.toggle.addEventListener('click', () => (state.open ? close() : open(null)));
    const topbar = doc.querySelector('.topbar');
    if (topbar) topbar.insertBefore(el.toggle, topbar.lastElementChild);

    doc.addEventListener('keydown', (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyI' || e.key === 'i' || e.key === 'ш')) {
        e.preventDefault();
        const s = currentSelection();
        if (s) open(quoteFromSelection(s));
        else if (state.open) close();
        else open(null);
      } else if (e.key === 'Escape' && !el.ask.hidden) hideAsk();
    });
  }

  Object.assign(GBC.assistant, { init, open, close, textOf, captureScreenshot });
  if (GBC.bus) GBC.bus.on('pageready', init);
})(typeof window !== 'undefined' ? window : globalThis);
