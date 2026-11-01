/* =====================================================================================
 * Генератор рабочих тетрадей — логика страницы.
 *
 * Тетрадь собирает Python-пакет gbtrainer (тот же, что в командной строке): он лежит в
 * gbtrainer_bundle.js, загружается в Pyodide, а openpyxl ставится колесом с PyPI.
 * Всё считается в браузере; данные никуда не отправляются.
 * ===================================================================================== */
(function () {
  'use strict';

  var PYODIDE_FALLBACK = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
  var WHEELS = [
    'https://files.pythonhosted.org/packages/c1/8b/5fe2cc11fee489817272089c4203e679c63b570a5aaeb18d852ae3cbba6a/et_xmlfile-2.0.0-py3-none-any.whl',
    'https://files.pythonhosted.org/packages/c0/da/977ded879c29cbd04de313843e76868e6e13408a94ed6b987245dc7c8506/openpyxl-3.1.5-py2.py3-none-any.whl',
  ];
  var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  var LETTERS = 'ABCDEFGHIJKLMNOP';

  var $ = function (id) { return document.getElementById(id); };
  var py = null;
  var api = null;
  var info = null;
  var last = null; // последний удачный предпросмотр
  var st = {
    source: 'random', level: 3, theme: 'random', seed: randSeed(),
    steps: '', lr: '', mode: 'gradient', check: 'chain', key: true,
    number: '', catalog: '', protect: false, allow_formulas: false,
    data: null,
  };

  function randSeed() { return Math.floor(Math.random() * 1000000); }
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] == null) return;
      if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    if (text != null) e.textContent = text;
    return e;
  }
  function fmt(v) {
    if (v == null || v === '') return '—';
    return Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  }
  function status(kind, text) {
    var b = $('boot');
    b.className = 'boot' + (kind ? ' ' + kind : '');
    $('bootText').textContent = text;
  }

  /* ---------------- загрузка Python ---------------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('не загрузился ' + src)); };
      document.head.appendChild(s);
    });
  }

  async function installOpenpyxl() {
    try {
      for (var i = 0; i < WHEELS.length; i++) {
        var r = await fetch(WHEELS[i]);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        py.unpackArchive(await r.arrayBuffer(), 'wheel');
      }
      py.runPython('import openpyxl');
    } catch (e) {
      console.warn('[trainer] колёса с PyPI не загрузились, пробую micropip', e);
      await py.loadPackage('micropip');
      await py.pyimport('micropip').install('openpyxl');
    }
  }

  async function boot() {
    var base = (window.GBC && window.GBC.config && window.GBC.config.pyodideBase) || PYODIDE_FALLBACK;
    if (!window.GBTRAINER) throw new Error('нет gbtrainer_bundle.js — запустите python extra/04_trainer/build_bundle.py');
    status('', 'Загружаю Python в браузер (Pyodide, ≈10 МБ — один раз, дальше из кэша)…');
    if (!window.loadPyodide) await loadScript(base + 'pyodide.js');
    py = await window.loadPyodide({ indexURL: base });
    status('', 'Устанавливаю openpyxl…');
    await installOpenpyxl();
    var files = window.GBTRAINER.files;
    py.FS.mkdirTree('/home/pyodide/gbtrainer');
    Object.keys(files).forEach(function (path) { py.FS.writeFile('/home/pyodide/' + path, files[path]); });
    py.runPython('import sys\nif "/home/pyodide" not in sys.path: sys.path.insert(0, "/home/pyodide")\nimport gbtrainer.web');
    api = py.pyimport('gbtrainer.web');
    info = JSON.parse(api.info());
    status('ready', 'Готово: генератор работает в браузере (gbtrainer ' + window.GBTRAINER.version + ').');
  }

  /* ---------------- запрос к Python ---------------- */
  function request() {
    var r = {
      source: st.source, level: st.level, theme: st.theme, seed: st.seed,
      steps: st.steps, lr: st.lr, mode: st.mode, check: st.check, key: st.key,
      number: st.number, catalog: st.catalog, protect: st.protect, allow_formulas: st.allow_formulas,
    };
    if (st.source === 'custom') r.data = st.data;
    var ai = aiThemeOf(st.theme);
    if (ai) { r.theme = null; r.theme_def = ai.theme; }
    return JSON.stringify(r);
  }

  var timer = null;
  function refreshSoon() { clearTimeout(timer); timer = setTimeout(refresh, 250); }

  function refresh() {
    syncControls();
    if (!api) return;
    var res = JSON.parse(api.preview_json(request()));
    if (!res.ok) {
      last = null;
      $('pvError').hidden = false;
      $('pvError').textContent = 'Тетрадь не собрать: ' + res.error;
      $('pvBody').hidden = true;
      setDownloads(false);
      if (st.source === 'random') renderTable(null);
      return;
    }
    last = res;
    $('pvError').hidden = true;
    $('pvBody').hidden = false;
    if (st.source === 'random') {
      st.data = JSON.parse(JSON.stringify(res.dataset));
      renderTable(st.data);
    }
    renderPreview(res);
    setDownloads(true);
  }

  function setDownloads(on) {
    $('dlStudent').disabled = !on;
    $('dlTeacher').disabled = !on;
    $('dlZip').disabled = !on || st.source !== 'random';
  }

  /* ---------------- настройки ---------------- */
  function segment(id, key, after) {
    var box = $(id);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      st[key] = b.getAttribute('data-v');
      if (after) after();
      refresh();
    });
  }
  function syncSeg(id, value) {
    Array.prototype.forEach.call($(id).querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === value);
    });
  }

  function buildLevels() {
    var box = $('levels');
    box.textContent = '';
    info.levels.forEach(function (lv) {
      var b = el('button', { type: 'button', 'data-v': String(lv.number) });
      b.appendChild(el('b', null, lv.number + '. ' + lv.name));
      var n = Math.pow(2, lv.features);
      b.appendChild(el('span', null, 'ν = ' + fmt(lv.lr) + ' · ' + n + (n === 4 ? ' объекта' : ' объектов') +
        ' · ' + (lv.noise ? 'шум' : 'без шума') + ' · ' + lv.steps + ' ш.'));
      b.addEventListener('click', function () {
        st.level = lv.number;
        refresh();
      });
      box.appendChild(b);
    });
    fillThemes();
  }

  function fillThemes() {
    var sel = $('theme');
    sel.textContent = '';
    sel.appendChild(el('option', { value: 'random' }, 'Наугад (по seed)'));
    var g1 = el('optgroup', { label: 'Встроенные' });
    info.themes.forEach(function (t) { g1.appendChild(el('option', { value: t.key }, t.title)); });
    sel.appendChild(g1);
    if (aiState.saved.length) {
      var g2 = el('optgroup', { label: 'От ИИ-ассистента' });
      aiState.saved.forEach(function (x) { g2.appendChild(el('option', { value: 'ai:' + x.id }, '✦ ' + x.theme.title)); });
      sel.appendChild(g2);
    }
    if (st.theme.indexOf('ai:') === 0 && !aiThemeOf(st.theme)) st.theme = 'random';
    sel.value = st.theme;
  }

  function syncControls() {
    if (info) {
      Array.prototype.forEach.call($('levels').querySelectorAll('button'), function (b) {
        b.classList.toggle('on', b.getAttribute('data-v') === String(st.level));
      });
      var lv = info.levels.filter(function (l) { return l.number === st.level; })[0];
      if (lv) {
        $('levelAbout').textContent = lv.about;
        $('steps').placeholder = String(lv.steps);
        $('lr').placeholder = String(lv.lr);
      }
    }
    syncSeg('sourceSeg', st.source);
    syncSeg('modeSeg', st.mode);
    syncSeg('checkSeg', st.check);
    $('theme').value = st.theme;
    $('seed').value = st.seed;
    $('theme').disabled = st.source !== 'random';
    $('seed').disabled = st.source !== 'random';
    $('seedBtn').disabled = st.source !== 'random';
    $('key').checked = st.key;
    $('key').disabled = st.check === 'strict';
    $('checkAbout').textContent = st.check === 'chain'
      ? 'Каждое число сверяется с тем, что должно выйти из чисел самого ученика: ✗ — ровно там, где ошибка.'
      : 'Каждое число сверяется со скрытым ключом, как в тетрадях № 2–7: ошибка тянется в следующие шаги.';
    $('srcNote').textContent = st.source === 'random'
      ? 'Случайные данные (seed ' + st.seed + '). Поправьте любую ячейку — и данные станут вашими.'
      : 'Ваши данные. Чтобы вернуться к случайным — «Данные → Случайные» в настройках.';
  }

  function bindInputs() {
    segment('sourceSeg', 'source', function () { renderSaved(); });
    segment('modeSeg', 'mode');
    segment('checkSeg', 'check', function () { if (st.check === 'strict') st.key = true; });
    $('theme').addEventListener('change', function () { st.theme = this.value; renderSaved(); refresh(); });
    $('seed').addEventListener('input', function () {
      var v = parseInt(this.value, 10);
      if (!isNaN(v) && v >= 0) { st.seed = v; refreshSoon(); }
    });
    $('seedBtn').addEventListener('click', function () { st.seed = randSeed(); refresh(); });
    ['steps', 'lr', 'number', 'catalog'].forEach(function (id) {
      $(id).addEventListener('input', function () { st[id] = this.value.trim().replace(',', '.'); refreshSoon(); });
    });
    $('key').addEventListener('change', function () { st.key = this.checked; refresh(); });
    $('protect').addEventListener('change', function () { st.protect = this.checked; refresh(); });
    $('formulas').addEventListener('change', function () { st.allow_formulas = this.checked; refresh(); });

    $('addRow').addEventListener('click', function () {
      var d = ensureCustom();
      var k = d.features.length;
      var prev = d.rows[d.rows.length - 1] || [];
      var row = [LETTERS[d.rows.length] || String(d.rows.length + 1)];
      for (var j = 0; j < k; j++) row.push(prev[j + 1] || '');
      row.push(prev[k + 1] != null ? prev[k + 1] : 0);
      d.rows.push(row);
      renderTable(d);
      refreshSoon();
    });
    $('addFeat').addEventListener('click', function () {
      var d = ensureCustom();
      if (d.features.length >= 4) return;
      d.features.push('Признак ' + (d.features.length + 1));
      d.rows.forEach(function (r, i) { r.splice(r.length - 1, 0, i % 2 ? 'да' : 'нет'); });
      renderTable(d);
      refreshSoon();
    });
    $('delFeat').addEventListener('click', function () {
      var d = ensureCustom();
      if (d.features.length <= 1) return;
      d.features.pop();
      d.rows.forEach(function (r) { r.splice(r.length - 2, 1); });
      renderTable(d);
      refreshSoon();
    });
    $('importBtn').addEventListener('click', function () { $('importBox').hidden = false; $('importText').focus(); });
    $('importCancel').addEventListener('click', function () { $('importBox').hidden = true; });
    $('importApply').addEventListener('click', function () { importText($('importText').value); });
    $('fileIn').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      f.text().then(function (text) {
        if (/\.json$/i.test(f.name)) {
          try { applyJson(JSON.parse(text)); } catch (e) { alert('Неверный JSON: ' + e.message); }
        } else importText(text);
      });
      this.value = '';
    });
    $('exportBtn').addEventListener('click', function () {
      if (!api) return;
      var res = JSON.parse(api.spec_json(request()));
      if (!res.ok) { alert(res.error); return; }
      var blob = new Blob([JSON.stringify(res.spec, null, 2)], { type: 'application/json' });
      save(blob, 'тетрадь_данные.json');
    });
    $('dlStudent').addEventListener('click', function () { download(false); });
    $('dlTeacher').addEventListener('click', function () { download(true); });
    $('dlZip').addEventListener('click', downloadZip);
  }

  /* ---------------- таблица данных ---------------- */
  function ensureCustom() {
    if (!st.data) st.data = { object: 'Объект', target: 'y', features: ['Признак 1'], rows: [] };
    if (st.source !== 'custom') {
      st.source = 'custom';
      delete st.data.structure; // «устройство данных» больше не про эти числа
      syncControls();
    }
    return st.data;
  }

  function importText(text) {
    if (!api) return;
    var res = JSON.parse(api.parse_csv(text));
    if (!res.ok) { alert('Не получилось прочитать таблицу: ' + res.error); return; }
    applyJson(res.data);
    $('importBox').hidden = true;
  }

  function applyJson(d) {
    st.source = 'custom';
    st.data = d;
    if (d.rows) d.rows = d.rows.map(function (r, i) {
      return Array.isArray(r) ? r : [r.name || LETTERS[i], ].concat(r.x || [], [r.y]);
    });
    ['steps', 'lr', 'number', 'catalog'].forEach(function (k) {
      if (d[k] != null) { st[k] = String(d[k]); $(k).value = st[k]; }
    });
    if (d.mode) st.mode = d.mode;
    if (d.check) st.check = d.check;
    if (d.level) st.level = Number(d.level);
    renderTable(st.data);
    refresh();
  }

  function cellInput(value, onChange, cls) {
    var i = el('input', { type: 'text', class: cls || '' });
    i.value = value == null ? '' : String(value);
    i.addEventListener('input', function () { onChange(i.value); refreshSoon(); });
    return i;
  }

  function renderTable(d) {
    var t = $('dataTable');
    t.textContent = '';
    if (!d) return;
    var thead = el('thead');
    var hr = el('tr');
    var th0 = el('th');
    th0.appendChild(cellInput(d.object, function (v) { ensureCustom().object = v; }));
    hr.appendChild(th0);
    d.features.forEach(function (f, j) {
      var th = el('th');
      th.appendChild(cellInput(f, function (v) { ensureCustom().features[j] = v; }));
      hr.appendChild(th);
    });
    var thy = el('th');
    thy.appendChild(cellInput(d.target, function (v) { ensureCustom().target = v; }));
    hr.appendChild(thy);
    hr.appendChild(el('th'));
    thead.appendChild(hr);
    t.appendChild(thead);
    var tb = el('tbody');
    d.rows.forEach(function (row, i) {
      var tr = el('tr');
      var k = d.features.length;
      var tdn = el('td', { class: 'nm' });
      tdn.appendChild(cellInput(row[0], function (v) { ensureCustom().rows[i][0] = v; }));
      tr.appendChild(tdn);
      for (var j = 0; j < k; j++) {
        (function (j) {
          var td = el('td');
          td.appendChild(cellInput(row[j + 1], function (v) { ensureCustom().rows[i][j + 1] = v; }));
          tr.appendChild(td);
        })(j);
      }
      var tdy = el('td', { class: 'y' });
      tdy.appendChild(cellInput(String(row[k + 1]).replace('.', ','), function (v) {
        ensureCustom().rows[i][k + 1] = v.replace(/\s/g, '').replace(',', '.');
      }));
      tr.appendChild(tdy);
      var tdx = el('td');
      tdx.appendChild(el('button', {
        type: 'button', class: 'x', title: 'Удалить объект', 'aria-label': 'Удалить объект',
        onclick: function () { ensureCustom().rows.splice(i, 1); renderTable(st.data); refreshSoon(); },
      }, '×'));
      tr.appendChild(tdx);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
  }

  /* ---------------- предпросмотр ---------------- */
  function stat(label, value) {
    var d = el('div', { class: 'stat' });
    d.appendChild(el('div', { class: 'l' }, label));
    d.appendChild(el('div', { class: 'v' }, value));
    return d;
  }

  function renderPreview(p) {
    var s = $('stats');
    s.textContent = '';
    var lastAbs = p.steps.length ? p.steps[p.steps.length - 1].abs : p.abs0;
    s.appendChild(stat('F₀ — среднее', fmt(p.f0)));
    s.appendChild(stat('Σ|rᵢ|: старт → конец', fmt(p.abs0) + ' → ' + fmt(lastAbs)));
    if (p.floor != null) s.appendChild(stat('Пол Σ|шум|', fmt(p.floor)));
    s.appendChild(stat('Шагов · ν', p.settings.steps + ' · ' + fmt(p.settings.lr)));
    s.appendChild(stat('Проверок ✓/✗', fmt(p.checks)));

    var tb = $('trajBody');
    tb.textContent = '';
    var t0 = el('tr');
    t0.appendChild(el('td', null, '0'));
    t0.appendChild(el('td', null, '— (среднее)'));
    t0.appendChild(el('td', { class: 'n' }, fmt(p.abs0)));
    tb.appendChild(t0);
    p.steps.forEach(function (x) {
      var tr = el('tr', { class: x.tie || x.near ? 'tie' : '' });
      tr.appendChild(el('td', null, String(x.m)));
      tr.appendChild(el('td', null, x.choice + (x.tie ? ' (равенство → верхняя)' : x.near ? ' (почти равенство)' : '')));
      tr.appendChild(el('td', { class: 'n' }, fmt(x.abs)));
      tb.appendChild(tr);
    });
    drawSpark(p);

    var w = $('warnings');
    w.textContent = '';
    p.warnings.forEach(function (m) { w.appendChild(el('div', { class: 'callout amber' }, m)); });
    $('dlNote').textContent = 'Файл: ' + p.file_name + '. Открывается в Excel, LibreOffice и Google Таблицах.';
  }

  function drawSpark(p) {
    var svg = $('spark');
    var NS = 'http://www.w3.org/2000/svg';
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var vals = [p.abs0].concat(p.steps.map(function (x) { return x.abs; }));
    var W = 600, H = 220, l = 46, r = 14, t = 16, b = 30;
    var max = Math.max.apply(null, vals) || 1;
    var X = function (i) { return l + (W - l - r) * (vals.length > 1 ? i / (vals.length - 1) : 0); };
    var Y = function (v) { return t + (H - t - b) * (1 - v / max); };
    function add(tag, attrs, text) {
      var e = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (text != null) e.textContent = text;
      svg.appendChild(e);
      return e;
    }
    add('line', { class: 'axis', x1: l, y1: H - b, x2: W - r, y2: H - b });
    add('line', { class: 'axis', x1: l, y1: t, x2: l, y2: H - b });
    add('text', { x: l - 6, y: Y(max) + 4, 'text-anchor': 'end' }, fmt(max));
    add('text', { x: l - 6, y: Y(0) + 4, 'text-anchor': 'end' }, '0');
    var stepEvery = Math.max(1, Math.ceil(vals.length / 10));
    for (var i = 0; i < vals.length; i += stepEvery) add('text', { x: X(i), y: H - b + 18, 'text-anchor': 'middle' }, String(i));
    add('text', { x: W - r, y: H - 4, 'text-anchor': 'end' }, 'шаг');
    if (p.floor) {
      add('line', { class: 'floor', x1: l, y1: Y(p.floor), x2: W - r, y2: Y(p.floor) });
      add('text', { class: 'floor-t', x: W - r, y: Y(p.floor) - 6, 'text-anchor': 'end' }, 'пол Σ|шум| = ' + fmt(p.floor));
    }
    add('polyline', { class: 'line', points: vals.map(function (v, i) { return X(i) + ',' + Y(v); }).join(' ') });
    vals.forEach(function (v, i) { add('circle', { class: 'pt', cx: X(i), cy: Y(v), r: 3.5 }); });
  }

  /* ---------------- сюжет от ИИ-ассистента ----------------
   * Промпт, JSON-схема и проверка ответа — в Python (gbtrainer/ai.py, тот же код, что в CLI).
   * Запрос уходит через GBC.assistant.complete — те же адрес, модель и токен, что у панели
   * ассистента. Ответ модели — недоверенные данные: его разбирает и проверяет Python, а на
   * страницу попадает только через textContent. */
  var AI_STORE = 'trainer-ai-themes';
  var AI_MAX_SAVED = 12;
  var aiState = { saved: [], busy: false, abort: null, timer: null, last: null };

  function aiThemeOf(key) {
    if (!key || key.indexOf('ai:') !== 0) return null;
    var id = key.slice(3);
    return aiState.saved.filter(function (x) { return x.id === id; })[0] || null;
  }

  function storeGet() {
    try { return (window.GBC && GBC.storage) ? GBC.storage.get(AI_STORE, []) : JSON.parse(localStorage.getItem('gbc:' + AI_STORE) || '[]'); }
    catch (e) { return []; }
  }
  function storeSet(v) {
    try { if (window.GBC && GBC.storage) GBC.storage.set(AI_STORE, v); else localStorage.setItem('gbc:' + AI_STORE, JSON.stringify(v)); }
    catch (e) { /* хранилище недоступно — сюжет проживёт до перезагрузки */ }
  }

  /** Сохранённые сюжеты проверяются заново: localStorage мог быть изменён вручную. */
  function loadSavedThemes() {
    var raw = storeGet();
    var ok = [];
    (Array.isArray(raw) ? raw : []).slice(0, AI_MAX_SAVED).forEach(function (x) {
      if (!x || typeof x.id !== 'string' || !x.theme) return;
      var res = JSON.parse(api.theme_check(JSON.stringify(x.theme)));
      if (res.ok) ok.push({ id: x.id, theme: res.theme, prompt: String(x.prompt || '').slice(0, 600), at: x.at || 0 });
    });
    aiState.saved = ok;
    if (ok.length !== (Array.isArray(raw) ? raw.length : 0)) storeSet(ok);
  }

  function addTheme(theme, prompt) {
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    aiState.saved.unshift({ id: id, theme: theme, prompt: prompt || '', at: Date.now() });
    aiState.saved = aiState.saved.slice(0, AI_MAX_SAVED);
    storeSet(aiState.saved);
    return id;
  }

  function useTheme(id) {
    st.source = 'random';
    st.theme = 'ai:' + id;
    fillThemes();
    renderSaved();
    refresh();
  }

  function aiStatus(kind, text, spin) {
    var box = $('aiStatus');
    box.className = 'ai-status' + (kind ? ' ' + kind : '');
    box.textContent = '';
    if (spin) box.appendChild(el('span', { class: 'spin', 'aria-hidden': 'true' }));
    if (text) box.appendChild(el('span', null, text));
  }

  function aiHelp(kind, url) {
    var box = $('aiHelp');
    box.textContent = '';
    if (!kind) { box.hidden = true; return; }
    box.hidden = false;
    if (kind === 'forbidden') {
      box.appendChild(el('p', null, 'claude-server запущен, но не разрешает запросы с адреса этой страницы (' + location.origin + ').'));
      var p = el('p', null, 'Перезапустите его с переменной ');
      p.appendChild(el('code', null, 'CLAUDE_SERVER_ALLOWED_ORIGINS=' + location.origin));
      p.appendChild(document.createTextNode(' или откройте курс локально: '));
      p.appendChild(el('code', null, 'python tools/serve.py'));
      box.appendChild(p);
      return;
    }
    box.appendChild(el('p', null, 'Сюжет придумывает Claude через локальный claude-server — тот же, что у ИИ-ассистента курса' + (url ? ' (' + url + ')' : '') + '. Сейчас он не отвечает.'));
    var ol = el('ol');
    var li1 = el('li', null, 'Один раз: установите Claude Code и войдите — ');
    li1.appendChild(el('code', null, 'claude login'));
    var li2 = el('li', null, 'Запустите курс вместе с сервером: ');
    li2.appendChild(el('code', null, 'python tools/serve.py'));
    li2.appendChild(document.createTextNode(' (или только сервер: '));
    li2.appendChild(el('code', null, 'node claude-server/server.js'));
    li2.appendChild(document.createTextNode(').'));
    var li3 = el('li', null, 'Нажмите «Придумать сюжет» ещё раз. Адрес сервера, модель и токен — в «Настройках ИИ».');
    ol.appendChild(li1); ol.appendChild(li2); ol.appendChild(li3);
    box.appendChild(ol);
  }

  function setAiBusy(on) {
    aiState.busy = on;
    $('aiGo').disabled = on;
    $('aiMore').disabled = on;
    $('aiStop').hidden = !on;
    $('aiText').readOnly = on;
    if (!on) { clearInterval(aiState.timer); aiState.timer = null; }
  }

  function ticking(prefix) {
    var t0 = Date.now();
    clearInterval(aiState.timer);
    var draw = function () { aiStatus('', prefix + ' ' + Math.round((Date.now() - t0) / 1000) + ' с', true); };
    draw();
    aiState.timer = setInterval(draw, 1000);
    return t0;
  }

  async function aiGenerate(more) {
    if (!api || aiState.busy) return;
    var A = window.GBC && GBC.assistant;
    if (!A || !A.complete) { aiStatus('err', 'Модуль ИИ-ассистента не загрузился — обновите страницу.'); return; }
    var description = $('aiText').value.trim();
    var avoid = more ? aiState.saved.slice(0, 8).map(function (x) { return x.theme.title; }) : [];
    aiHelp(null);
    setAiBusy(true);
    aiState.abort = new AbortController();
    var tStart = Date.now();
    try {
      aiStatus('', 'Проверяю claude-server…', true);
      var srv = await A.ping();
      if (!srv.online) {
        aiStatus('err', srv.forbidden ? 'Сервер не разрешает этот адрес страницы.' : 'claude-server не отвечает.');
        aiHelp(srv.forbidden ? 'forbidden' : 'offline', srv.url);
        return;
      }
      var req = JSON.parse(api.ai_request(JSON.stringify({ description: description, avoid: avoid })));
      var messages = req.messages;
      var lastError = '';
      for (var attempt = 1; attempt <= 2; attempt++) {
        ticking(attempt === 1 ? 'Claude (' + srv.model + ') придумывает сюжет…' : 'Ответ не прошёл проверку, прошу Claude исправить…');
        var reply = await A.complete(messages, { jsonSchema: req.schema, signal: aiState.abort.signal });
        var res = JSON.parse(api.ai_accept(reply));
        if (res.ok) {
          var id = addTheme(res.theme, description);
          aiState.last = { id: id, notes: res.notes };
          useTheme(id);
          renderAiResult(aiThemeOf('ai:' + id), res.notes);
          setAiBusy(false);
          aiStatus('ok', 'Готово за ' + Math.max(1, Math.round((Date.now() - tStart) / 1000)) + ' с' + (attempt > 1 ? ' (со второй попытки)' : '') + ' — сюжет выбран, данные и предпросмотр ниже обновлены.');
          $('aiMore').hidden = false;
          return;
        }
        lastError = res.error;
        if (attempt === 1) messages = JSON.parse(api.ai_repair(JSON.stringify({ messages: messages, reply: reply, error: res.error }))).messages;
      }
      aiStatus('err', 'Модель дважды вернула некорректный сюжет (' + lastError + '). Переформулируйте описание или попробуйте ещё раз.');
    } catch (e) {
      if (e && e.name === 'AbortError') aiStatus('', 'Остановлено.');
      else {
        aiStatus('err', (e && e.message) || 'Ошибка запроса к ИИ.');
        if (e && (e.kind === 'offline' || e.kind === 'forbidden')) aiHelp(e.kind);
      }
    } finally {
      setAiBusy(false);
      aiState.abort = null;
    }
  }

  function scaleText(t) {
    var b = t.base, e = t.effect, n = t.noise;
    return 'база ' + fmt(b[0]) + '–' + fmt(b[1]) + ' (шаг ' + fmt(b[2]) + '), вклад признака ±' + fmt(e[0]) + '…' + fmt(e[1]) +
      ' и больше (шаг ' + fmt(e[2]) + '), шум ±' + (n[0] === n[1] ? fmt(n[0]) : fmt(n[0]) + '…' + fmt(n[1]));
  }

  function renderAiResult(item, notes) {
    var box = $('aiResult');
    box.textContent = '';
    if (!item) { box.hidden = true; return; }
    var t = item.theme;
    box.hidden = false;
    box.appendChild(el('h3', null, '✦ ' + t.title));
    if (t.rationale) box.appendChild(el('p', { class: 'why' }, t.rationale));
    var tbl = el('table');
    var hr = el('tr');
    ['Признак', 'y меньше', 'y больше'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
    tbl.appendChild(hr);
    t.features.forEach(function (f) {
      var tr = el('tr');
      tr.appendChild(el('td', null, f.name));
      tr.appendChild(el('td', null, f.levels[0]));
      tr.appendChild(el('td', null, f.levels[1]));
      tbl.appendChild(tr);
    });
    box.appendChild(tbl);
    var meta = el('div', { class: 'ai-meta' });
    [['Объект', t.object + ' (' + t.each + ')'], ['Колонка y', t.target], ['Что такое y', t.quantity], ['Масштаб', scaleText(t)]].forEach(function (kv, i) {
      var d = el('div', i === 3 ? { class: 'wide' } : null);
      d.appendChild(el('b', null, kv[0] + ':'));
      d.appendChild(document.createTextNode(kv[1]));
      meta.appendChild(d);
    });
    box.appendChild(meta);
    if (notes && notes.length) {
      var c = el('div', { class: 'callout amber' });
      c.appendChild(el('p', null, 'Генератор поправил ответ модели:'));
      notes.forEach(function (n) { c.appendChild(el('p', null, '· ' + n)); });
      box.appendChild(c);
    }
    var row = el('div', { class: 'row' });
    row.appendChild(el('button', { type: 'button', class: 'btn', onclick: function () { saveThemeFile(item); } }, 'Сохранить сюжет (JSON)'));
    row.appendChild(el('span', { class: 'src-note' }, 'Уровни 1–4 берут первые два признака, уровень 5 — все три. Новый seed — новые числа в том же сюжете.'));
    box.appendChild(row);
  }

  function saveThemeFile(item) {
    var blob = new Blob([JSON.stringify(item.theme, null, 2)], { type: 'application/json' });
    save(blob, 'сюжет_' + item.theme.object.replace(/[^\wа-яё]+/gi, '_').toLowerCase() + '.json');
  }

  function renderSaved() {
    var box = $('aiSaved');
    box.textContent = '';
    if (!aiState.saved.length) return;
    box.appendChild(el('p', { class: 'src-note' }, 'Ваши сюжеты от ИИ (хранятся только в этом браузере, они же — в списке «Сюжет» в настройках):'));
    aiState.saved.forEach(function (x) {
      var on = st.theme === 'ai:' + x.id && st.source === 'random';
      var it = el('div', { class: 'item' + (on ? ' on' : '') });
      var t = el('span', { class: 't' }, '✦ ' + x.theme.title + ' ');
      t.appendChild(el('small', null, x.theme.features.map(function (f) { return f.name; }).join(' · ')));
      it.appendChild(t);
      it.appendChild(el('button', { type: 'button', class: 'btn', disabled: on ? 'disabled' : null, onclick: function () { useTheme(x.id); renderAiResult(x, null); } }, on ? 'Выбран' : 'Использовать'));
      it.appendChild(el('button', { type: 'button', class: 'btn', onclick: function () { saveThemeFile(x); } }, 'JSON'));
      it.appendChild(el('button', {
        type: 'button', class: 'btn', title: 'Удалить сюжет', 'aria-label': 'Удалить сюжет ' + x.theme.title,
        onclick: function () {
          aiState.saved = aiState.saved.filter(function (y) { return y.id !== x.id; });
          storeSet(aiState.saved);
          if (st.theme === 'ai:' + x.id) st.theme = 'random';
          if (aiState.last && aiState.last.id === x.id) renderAiResult(null);
          fillThemes();
          renderSaved();
          refresh();
        },
      }, '×'));
      box.appendChild(it);
    });
  }

  function loadThemeFile(file) {
    file.text().then(function (text) {
      var res;
      try { res = JSON.parse(api.theme_check(text)); } catch (e) { res = { ok: false, error: e.message }; }
      if (!res.ok) { aiStatus('err', 'Сюжет из файла не подошёл: ' + res.error); return; }
      var id = addTheme(res.theme, '');
      useTheme(id);
      renderAiResult(aiThemeOf('ai:' + id), null);
      aiStatus('ok', 'Сюжет «' + res.theme.title + '» загружен и выбран.');
    });
  }

  function bindAi() {
    $('aiGo').addEventListener('click', function () { aiGenerate(false); });
    $('aiMore').addEventListener('click', function () { aiGenerate(true); });
    $('aiStop').addEventListener('click', function () { if (aiState.abort) aiState.abort.abort(); });
    $('aiSettings').addEventListener('click', function () {
      var A = window.GBC && GBC.assistant;
      if (!(A && A.openSettings && A.openSettings())) aiStatus('err', 'Панель ИИ-ассистента ещё не загрузилась — попробуйте через секунду.');
    });
    $('aiText').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); aiGenerate(false); }
    });
    Array.prototype.forEach.call($('aiChips').querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { $('aiText').value = b.textContent; $('aiText').focus(); });
    });
    $('aiFile').addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (f && api) loadThemeFile(f);
      this.value = '';
    });
  }

  /* ---------------- скачивание ---------------- */
  function save(blob, name) {
    var a = el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function pyBytes(proxy) {
    var u8 = proxy.toJs();
    if (proxy.destroy) proxy.destroy();
    return u8;
  }

  function busy(btn, on, text) {
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = text; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label; btn.disabled = false; }
  }

  function download(teacher) {
    if (!api || !last) return;
    var btn = teacher ? $('dlTeacher') : $('dlStudent');
    busy(btn, true, 'Собираю…');
    setTimeout(function () {
      try {
        var req = request();
        var bytes = pyBytes(api.build(req, teacher));
        save(new Blob([bytes], { type: XLSX_MIME }), api.build_name(req, teacher));
      } catch (e) {
        alert('Не удалось собрать тетрадь: ' + e.message);
      } finally {
        busy(btn, false);
      }
    }, 30);
  }

  function downloadZip() {
    if (!api || !last) return;
    var btn = $('dlZip');
    var n = Math.max(2, Math.min(60, parseInt($('count').value, 10) || 25));
    busy(btn, true, 'Собираю ' + n + ' вариантов…');
    setTimeout(function () {
      try {
        var bytes = pyBytes(api.build_zip(request(), n, $('zipTeacher').checked));
        save(new Blob([bytes], { type: 'application/zip' }), 'тетради_' + n + '_вариантов_seed' + st.seed + '.zip');
      } catch (e) {
        alert('Не удалось собрать архив: ' + e.message);
      } finally {
        busy(btn, false);
      }
    }, 30);
  }

  /* ---------------- тема и старт ---------------- */
  function themeButton() {
    var root = document.documentElement;
    function sync() {
      var dark = root.getAttribute('data-theme') === 'dark';
      $('themeIco').textContent = dark ? '☾' : '☀';
      $('themeTxt').textContent = dark ? 'Тёмная' : 'Светлая';
    }
    sync();
    $('themeBtn').addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      if (window.GBC && GBC.page && GBC.page.setTheme) GBC.page.setTheme(next);
      else {
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('gbc:theme', JSON.stringify(next)); } catch (e) { /* без хранилища */ }
      }
      sync();
    });
  }

  function start() {
    themeButton();
    bindInputs();
    syncControls();
    bindAi();
    boot().then(function () {
      loadSavedThemes();
      buildLevels();
      renderSaved();
      $('aiGo').disabled = false;
      refresh();
    }).catch(function (e) {
      console.error(e);
      status('fail', 'Python в браузере не загрузился (' + e.message + '). Нужен интернет для Pyodide и openpyxl; ' +
        'без него тот же генератор работает из командной строки: python extra/04_trainer/generate.py');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
