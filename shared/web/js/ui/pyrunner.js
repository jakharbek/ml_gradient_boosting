/* =====================================================================================
 * GBC.py — настоящий Python прямо в уроке (Pyodide в Web Worker).
 * Если страница открыта с диска (file://), воркер недоступен — движок работает в самой странице.
 *
 * Все Python-ячейки страницы работают в одном интерпретаторе, как ячейки Jupyter:
 * переменные из одной ячейки видны в следующих. Если запустить ячейку, не выполнив
 * предыдущие, они выполнятся автоматически. Графики matplotlib выводятся картинками,
 * таблицы pandas — HTML. Учебная библиотека gbcourse загружается из
 * shared/web/js/generated/pybundle.js (собирается tools/build.py).
 *
 * Разметка ячейки:
 *   <div class="pycell" data-title="Обучаем модель"><pre><code class="language-python">…</code></pre></div>
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC;
  const H = GBC.h;

  const WORKER_SRC = function (BASE) {
    // Модульный воркер: importScripts() из blob-воркера блокируется браузерами, import — нет
    return `
import { loadPyodide } from ${JSON.stringify(BASE + 'pyodide.mjs')};
const BASE = ${JSON.stringify(BASE)};
let py = null;
let currentId = null;
const post = (m) => self.postMessage(m);
const HELPER = \`
import io, base64
def _gbc_figures():
    try:
        import matplotlib.pyplot as plt
    except Exception:
        return []
    out = []
    for num in plt.get_fignums():
        fig = plt.figure(num)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=110, bbox_inches="tight")
        out.append(base64.b64encode(buf.getvalue()).decode("ascii"))
    plt.close("all")
    return out

def _gbc_repr(value):
    if value is None:
        return None
    h = getattr(value, "_repr_html_", None)
    if callable(h):
        try:
            s = h()
            if s:
                return ["html", s]
        except Exception:
            pass
    return ["text", repr(value)]
\`;
async function init(files) {
  post({ type: 'status', text: 'Загрузка Python (Pyodide, ~10 МБ, один раз)…' });
  py = await loadPyodide({ indexURL: BASE });
  py.setStdout({ batched: (s) => post({ id: currentId, type: 'stdout', text: s }) });
  py.setStderr({ batched: (s) => post({ id: currentId, type: 'stderr', text: s }) });
  post({ type: 'status', text: 'Установка numpy и matplotlib…' });
  await py.loadPackage(['numpy', 'matplotlib']);
  py.FS.mkdirTree('/home/pyodide/gbcourse');
  for (const [name, src] of Object.entries(files)) py.FS.writeFile('/home/pyodide/gbcourse/' + name, src);
  await py.runPythonAsync("import sys\\nsys.path.insert(0, '/home/pyodide')\\nimport matplotlib\\nmatplotlib.use('Agg')\\n" + HELPER +
    "\\nfrom gbcourse.style import use_course_style\\nuse_course_style()\\n");
}
function cleanTraceback(msg) {
  const lines = String(msg).split('\\n');
  const start = lines.findIndex((l) => l.includes('File "<cell>"'));
  if (start < 0) return msg;
  return ['Traceback (most recent call last):'].concat(lines.slice(start)).join('\\n');
}
self.onmessage = async (e) => {
  const { id, type, code, files } = e.data;
  if (type === 'init') {
    try { await init(files); post({ type: 'ready' }); }
    catch (err) { post({ type: 'fatal', text: String(err && err.message || err) }); }
    return;
  }
  if (type === 'run') {
    currentId = id;
    const t0 = performance.now();
    try {
      await py.loadPackagesFromImports(code, { messageCallback: (m) => post({ id, type: 'status', text: m }) });
      // sklearn-API XGBoost и LightGBM требуют scikit-learn, хотя код его явно не импортирует
      if (/\\b(xgboost|lightgbm)\\b/.test(code)) await py.loadPackage(['scikit-learn']);
      const res = await py.runPythonAsync(code, { filename: '<cell>' });
      let out = null;
      if (res !== undefined && res !== null) {
        py.globals.set('_gbc_last', res);
        const r = py.runPython('_gbc_repr(_gbc_last)');
        out = r && r.toJs ? r.toJs() : r;
        if (r && r.destroy) r.destroy();
        py.runPython('del _gbc_last');
        if (res && res.destroy) res.destroy();
      }
      const figsProxy = py.runPython('_gbc_figures()');
      const figs = figsProxy.toJs();
      figsProxy.destroy();
      post({ id, type: 'done', result: out, figures: figs, ms: performance.now() - t0 });
    } catch (err) {
      try { py.runPython('import matplotlib.pyplot as _p\\n_p.close("all")'); } catch (e2) {}
      post({ id, type: 'error', text: cleanTraceback(err && err.message || err), ms: performance.now() - t0 });
    }
  }
};`;
  };

  /**
   * Запасной движок: тот же код, что в воркере, но в самой странице. Нужен, когда страница открыта
   * с диска (file://): там браузеры не запускают модульные воркеры, а Pyodide поставляется только
   * ES-модулем. Цена — страница не отвечает, пока код считается; для учебных примеров это секунды.
   * Возвращает объект с интерфейсом Worker (postMessage / onmessage / terminate).
   */
  async function inPageEngine() {
    const BASE = GBC.config.pyodideBase;
    const { loadPyodide } = await import(BASE + 'pyodide.mjs');
    const src = WORKER_SRC(BASE);
    const body = src.slice(src.indexOf('let py = null;')); // без строк import и const BASE
    const fake = { onmessage: null, onerror: null, inPage: true, terminate() {} };
    const scope = { onmessage: null, postMessage: (m) => setTimeout(() => fake.onmessage && fake.onmessage({ data: m }), 0) };
    new Function('self', 'loadPyodide', 'BASE', body)(scope, loadPyodide, BASE);
    fake.postMessage = (m) => setTimeout(() => scope.onmessage({ data: m }), 0);
    return fake;
  }

  let worker = null;
  let readyPromise = null;
  let seq = 0;
  const pending = new Map();
  const statusListeners = new Set();
  let state = 'idle';

  function setState(s, text) {
    state = s;
    for (const fn of statusListeners) fn(s, text);
  }

  function bundleUrl() {
    const base = (root.GBC_BOOT && root.GBC_BOOT.root) || './';
    return base + 'shared/web/js/generated/pybundle.js';
  }

  function ensure() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      setState('loading', 'Подготовка…');
      if (!GBC.PYBUNDLE) {
        try {
          await GBC.loadScript(bundleUrl());
        } catch (e) {
          console.warn('[GBC] pybundle.js не найден — gbcourse недоступен в браузере');
        }
      }
      const init = (w) =>
        new Promise((resolve, reject) => {
          w.onmessage = (e) => {
            const m = e.data;
            if (m.type === 'status' && m.id === undefined) setState('loading', m.text);
            else if (m.type === 'ready') resolve();
            else if (m.type === 'fatal') reject(new Error(m.text));
            else route(m);
          };
          w.onerror = (e) => reject(Object.assign(new Error(e.message || 'Ошибка запуска Python'), { workerFailed: true }));
          w.postMessage({ type: 'init', files: GBC.PYBUNDLE || {} });
        });
      try {
        // страница открыта с диска — модульный воркер заведомо не запустится, не тратим на него время
        if (root.location.protocol === 'file:') throw Object.assign(new Error('file://'), { workerFailed: true });
        const blob = new Blob([WORKER_SRC(GBC.config.pyodideBase)], { type: 'text/javascript' });
        worker = new Worker(URL.createObjectURL(blob), { type: 'module' });
        await init(worker);
      } catch (err) {
        if (!err.workerFailed) throw err;
        if (worker) worker.terminate();
        worker = await inPageEngine();
        await init(worker);
      }
      worker.onmessage = (e) => route(e.data);
      setState('ready', 'Python готов');
    })().catch((err) => {
      readyPromise = null;
      if (worker) worker.terminate();
      worker = null;
      setState('error', 'Не удалось запустить Python: ' + err.message + '. Нужен интернет (Pyodide загружается с CDN).');
      throw err;
    });
    return readyPromise;
  }

  function route(m) {
    const p = pending.get(m.id);
    if (!p) return;
    if (m.type === 'stdout' || m.type === 'stderr' || m.type === 'status') p.onEvent(m);
    else if (m.type === 'done' || m.type === 'error') {
      pending.delete(m.id);
      p.resolve(m);
    }
  }

  async function run(code, onEvent = () => {}) {
    await ensure();
    const id = ++seq;
    setState('busy', 'Выполняется…');
    return new Promise((resolve) => {
      pending.set(id, {
        onEvent,
        resolve: (m) => {
          setState('ready', 'Python готов');
          resolve(m);
        },
      });
      worker.postMessage({ type: 'run', id, code });
    });
  }

  function restart() {
    if (worker) worker.terminate();
    worker = null;
    readyPromise = null;
    for (const [, p] of pending) p.resolve({ type: 'error', text: 'Выполнение прервано: интерпретатор перезапущен.' });
    pending.clear();
    for (const c of cells) c.ran = false;
    setState('idle', 'Интерпретатор остановлен — следующий запуск начнётся с чистого листа');
  }

  /** Отрисовать результат выполнения в элемент. */
  function renderOutput(out, m, streamed) {
    if (!streamed) out.textContent = '';
    if (m.type === 'error') {
      out.appendChild(H('pre', { class: 'error' }, m.text));
      return;
    }
    if (m.result) {
      const [kind, payload] = m.result;
      if (kind === 'html') {
        const div = H('div', { class: 'html-out' });
        div.innerHTML = payload; // HTML из собственного кода ученика (например, таблица pandas)
        out.appendChild(div);
      } else out.appendChild(H('pre', null, payload));
    }
    for (const b64 of m.figures || []) out.appendChild(H('img', { src: 'data:image/png;base64,' + b64, alt: 'График, построенный кодом ячейки' }));
  }

  /** Выполнить код и показать вывод в элементе out (для окна «Экспорт в Python»). */
  async function runInto(code, out) {
    out.textContent = '';
    const note = H('div', { class: 'note' }, 'Запуск…');
    out.appendChild(note);
    const unsub = onStatus((s, text) => (note.textContent = text));
    try {
      const m = await run(code, (ev) => {
        if (ev.type === 'stdout' || ev.type === 'stderr') out.appendChild(H('pre', { class: ev.type }, ev.text));
        if (ev.type === 'status') note.textContent = ev.text;
      });
      note.remove();
      renderOutput(out, m, true);
    } catch (e) {
      note.textContent = e.message;
    } finally {
      unsub();
    }
  }

  function onStatus(fn) {
    statusListeners.add(fn);
    return () => statusListeners.delete(fn);
  }

  /** Убрать общий отступ (код в HTML можно писать с отступами разметки). */
  function dedent(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/^\n+|\s+$/g, '').split('\n');
    let common = Infinity;
    for (const l of lines) {
      if (!l.trim()) continue;
      common = Math.min(common, l.match(/^[ \t]*/)[0].length);
    }
    if (!Number.isFinite(common) || common === 0) return lines.join('\n');
    return lines.map((l) => l.slice(common)).join('\n');
  }
  GBC.dedent = dedent;

  /* ------------------------------- ячейки на странице ----------------------------- */
  const cells = [];
  let cmPromise = null;

  function loadCodeMirror() {
    if (cmPromise) return cmPromise;
    const v = GBC.config.codemirrorVersion;
    const base = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/' + v + '/';
    GBC.loadStyle(base + 'codemirror.min.css');
    cmPromise = GBC.loadScript(base + 'codemirror.min.js')
      .then(() => GBC.loadScript(base + 'mode/python/python.min.js'))
      .then(() => root.CodeMirror)
      .catch(() => null);
    return cmPromise;
  }

  function mountCells(scope) {
    const els = Array.from((scope || root.document).querySelectorAll('.pycell:not([data-mounted])'));
    if (!els.length) return;
    // Панель «Python в браузере» перед первой ячейкой
    if (!root.document.querySelector('.py-toolbar')) {
      const status = H('span', null, 'Python выполняется прямо в браузере (Pyodide). Первая загрузка — 10–30 секунд.');
      const bar = H('div', { class: 'py-toolbar' });
      const runAll = GBC.ui.button(bar, { label: 'Запустить все ячейки', icon: 'run', small: true, kind: 'ghost' });
      const stopBtn = GBC.ui.button(bar, { label: 'Перезапустить Python', icon: 'reset', small: true, kind: 'ghost' });
      bar.appendChild(status);
      runAll.addEventListener('click', async () => {
        for (const c of cells) {
          const ok = await c.run(false);
          if (!ok) break;
        }
      });
      stopBtn.addEventListener('click', restart);
      onStatus((s, text) => (status.textContent = text));
      els[0].parentNode.insertBefore(bar, els[0]);
    }
    for (const el of els) {
      el.dataset.mounted = '1';
      const codeEl = el.querySelector('code') || el.querySelector('pre') || el;
      const original = dedent(codeEl.textContent);
      const index = cells.length + 1;
      const statusEl = H('span', { class: 'status' });
      const label = H('span', { class: 'label' }, H('span', { class: 'in' }, '[' + index + ']'), el.dataset.title || 'Python · выполняется в браузере');
      const bar = H('div', { class: 'pycell-bar' }, label, statusEl);
      const runBtn = GBC.ui.button(bar, { label: 'Запустить', icon: 'run', kind: 'primary', small: true, title: 'Shift+Enter' });
      const resetBtn = GBC.ui.button(bar, { label: '', icon: 'reset', kind: 'ghost', small: true, title: 'Вернуть исходный код' });
      const copyBtn = GBC.ui.button(bar, { label: '', icon: 'copy', kind: 'ghost', small: true, title: 'Копировать код' });
      const editorBox = H('div', { class: 'pycell-editor' });
      const out = H('div', { class: 'pycell-out', 'aria-live': 'polite' });
      const pre = GBC.ui.codeBlock(original);
      editorBox.appendChild(pre);
      el.textContent = '';
      el.append(bar, editorBox, out);

      const cell = {
        el, ran: false,
        getCode: () => original,
        setCode: null,
        async run(withDeps = true) {
          const my = cells.indexOf(cell);
          if (withDeps) {
            for (let k = 0; k < my; k++) {
              if (!cells[k].ran) {
                const ok = await cells[k].run(false);
                if (!ok) return false;
              }
            }
          }
          runBtn.disabled = true;
          statusEl.className = 'status run';
          statusEl.textContent = 'выполняется…';
          out.textContent = '';
          const unsub = onStatus((s, text) => {
            if (s === 'loading') statusEl.textContent = text;
          });
          let m;
          try {
            m = await run(cell.getCode(), (ev) => {
              if (ev.type === 'stdout' || ev.type === 'stderr') out.appendChild(H('pre', { class: ev.type }, ev.text));
              if (ev.type === 'status') statusEl.textContent = ev.text;
            });
          } catch (e) {
            m = { type: 'error', text: e.message };
          } finally {
            unsub();
            runBtn.disabled = false;
          }
          renderOutput(out, m, true);
          const ok = m.type === 'done';
          cell.ran = ok;
          statusEl.className = 'status ' + (ok ? 'ok' : 'err');
          statusEl.textContent = ok ? '✓ готово за ' + (m.ms / 1000).toFixed(2) + ' с' : '✗ ошибка';
          return ok;
        },
      };
      cells.push(cell);
      runBtn.addEventListener('click', () => cell.run(true));
      copyBtn.addEventListener('click', async () => GBC.ui.toast((await GBC.io.copy(cell.getCode())) ? 'Код скопирован' : 'Не удалось скопировать'));

      // Редактор: CodeMirror (если доступен) или textarea
      const makeEditable = (CM) => {
        editorBox.textContent = '';
        if (CM) {
          const cm = CM(editorBox, {
            value: original, mode: 'python', theme: 'gbc', lineNumbers: true, indentUnit: 4,
            viewportMargin: Infinity, extraKeys: { 'Shift-Enter': () => cell.run(true), Tab: (c) => c.replaceSelection('    ') },
          });
          cell.getCode = () => cm.getValue();
          cell.setCode = (s) => cm.setValue(s);
        } else {
          const ta = H('textarea', { spellcheck: 'false', 'aria-label': 'Код Python' });
          ta.value = original;
          ta.rows = Math.min(28, original.split('\n').length + 1);
          ta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.shiftKey) {
              e.preventDefault();
              cell.run(true);
            } else if (e.key === 'Tab') {
              e.preventDefault();
              const s = ta.selectionStart;
              ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(ta.selectionEnd);
              ta.selectionStart = ta.selectionEnd = s + 4;
            }
          });
          editorBox.appendChild(ta);
          cell.getCode = () => ta.value;
          cell.setCode = (s) => (ta.value = s);
        }
      };
      resetBtn.addEventListener('click', () => cell.setCode && cell.setCode(original));
      loadCodeMirror().then(makeEditable);
    }
  }

  GBC.py = {
    ensure, run, runInto, restart, onStatus, mountCells, renderOutput,
    get state() {
      return state;
    },
    cells,
  };
})(typeof window !== 'undefined' ? window : globalThis);
