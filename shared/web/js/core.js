/* =====================================================================================
 * GBC — «Градиентный бустинг по косточкам»: ядро веб-части курса.
 *
 * Все модули курса — обычные (не ES-модули) скрипты, которые добавляют свои части в
 * глобальный объект GBC. Так страницы работают даже при открытии файла с диска
 * (file://), где браузеры блокируют ES-модули. В Node.js тот же код подключается
 * через require() для тестов (объект попадает в globalThis.GBC).
 *
 * Здесь: конфигурация, математические утилиты, построитель DOM, событийная шина,
 * безопасное хранилище, скачивание/копирование.
 * ===================================================================================== */
(function (root) {
  'use strict';

  const GBC = root.GBC || (root.GBC = {});
  GBC.version = '1.0.0';

  /** Глобальная конфигурация. Версии KaTeX и highlight.js — в boot.js. */
  const PYODIDE_VERSION = '314.0.7';
  GBC.config = Object.assign(
    {
      courseTitle: 'Градиентный бустинг по косточкам',
      pyodideVersion: PYODIDE_VERSION,
      pyodideBase: 'https://cdn.jsdelivr.net/pyodide/v' + PYODIDE_VERSION + '/full/',
      codemirrorVersion: '5.65.18',
    },
    GBC.config || {}
  );

  /* ---------------------------------------------------------------------------------
   * Математические утилиты. Суммы — строго последовательные (как seq_sum в Python).
   * --------------------------------------------------------------------------------- */
  const util = (GBC.util = {
    range(n, start = 0) {
      const out = new Array(Math.max(0, n));
      for (let i = 0; i < out.length; i++) out[i] = start + i;
      return out;
    },
    linspace(a, b, n) {
      if (n === 1) return [a];
      const out = new Array(n);
      const step = (b - a) / (n - 1);
      for (let i = 0; i < n; i++) out[i] = a + step * i;
      out[n - 1] = b;
      return out;
    },
    sum(arr) {
      let s = 0;
      for (let i = 0; i < arr.length; i++) s += arr[i];
      return s;
    },
    mean(arr) {
      return arr.length ? util.sum(arr) / arr.length : 0;
    },
    variance(arr) {
      const m = util.mean(arr);
      let s = 0;
      for (let i = 0; i < arr.length; i++) s += (arr[i] - m) * (arr[i] - m);
      return arr.length ? s / arr.length : 0;
    },
    clamp(x, lo, hi) {
      return x < lo ? lo : x > hi ? hi : x;
    },
    extent(arr) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of arr) {
        if (Number.isNaN(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      return [lo, hi];
    },
    argmax(arr) {
      let best = -Infinity;
      let idx = -1;
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] > best) {
          best = arr[i];
          idx = i;
        }
      }
      return idx;
    },
    /** Устойчивая сортировка индексов по значениям (NaN — в конец, ничьи — по индексу). */
    argsort(values) {
      const idx = util.range(values.length);
      idx.sort((a, b) => {
        const va = values[a];
        const vb = values[b];
        const na = Number.isNaN(va);
        const nb = Number.isNaN(vb);
        if (na || nb) return na && nb ? a - b : na ? 1 : -1;
        return va < vb ? -1 : va > vb ? 1 : a - b;
      });
      return idx;
    },
    sortedNumbers(arr) {
      return Array.from(arr).sort((a, b) => a - b);
    },
    /** Квантиль с линейной интерполяцией (как quantile() в gbcourse._numeric). */
    quantile(arr, alpha) {
      const v = util.sortedNumbers(arr);
      const n = v.length;
      if (!n) return 0;
      const pos = alpha * (n - 1);
      const lo = Math.floor(pos);
      const hi = Math.min(lo + 1, n - 1);
      const frac = pos - lo;
      return v[lo] + frac * (v[hi] - v[lo]);
    },
    median(arr) {
      const v = util.sortedNumbers(arr);
      const n = v.length;
      if (!n) return 0;
      const mid = n >> 1;
      return n % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
    },
    sigmoid(z) {
      if (z >= 0) return 1 / (1 + Math.exp(-z));
      const ez = Math.exp(z);
      return ez / (1 + ez);
    },
    /** «Красивый» шаг сетки для осей (как в d3). */
    niceStep(span, count) {
      const raw = span / Math.max(1, count);
      const pow = Math.pow(10, Math.floor(Math.log10(raw)));
      const err = raw / pow;
      const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
      return mult * pow;
    },
    niceTicks(lo, hi, count = 6) {
      if (!(hi > lo)) return [lo];
      const step = util.niceStep(hi - lo, count);
      const start = Math.ceil(lo / step - 1e-9) * step;
      const out = [];
      for (let v = start; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
      return out;
    },
    /** Форматирование числа для интерфейса. */
    fmt(x, digits = 3) {
      if (x === null || x === undefined || Number.isNaN(x)) return '—';
      if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞';
      const ax = Math.abs(x);
      let s;
      if (ax !== 0 && (ax < 1e-3 || ax >= 1e6)) s = x.toExponential(Math.max(1, digits - 1));
      else s = Number(x.toFixed(digits)).toString();
      return s.replace('-', '−');
    },
    fmtFixed(x, digits = 2) {
      if (x === null || x === undefined || Number.isNaN(x)) return '—';
      return x.toFixed(digits).replace('-', '−');
    },
    fmtSigned(x, digits = 2) {
      const s = util.fmtFixed(x, digits);
      return x > 0 ? '+' + s : s;
    },
    /** Представление числа для генерации Python-кода. */
    pyNum(x) {
      if (Number.isInteger(x)) return String(x);
      return String(Number(x.toPrecision(12)));
    },
    debounce(fn, ms = 120) {
      let t = null;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
      };
    },
    /** Не чаще одного вызова за кадр анимации. */
    rafThrottle(fn) {
      let queued = false;
      let lastArgs = null;
      return function (...args) {
        lastArgs = args;
        if (queued) return;
        queued = true;
        (root.requestAnimationFrame || ((cb) => setTimeout(cb, 16)))(() => {
          queued = false;
          fn.apply(this, lastArgs);
        });
      };
    },
    uid(prefix = 'gbc') {
      util._uid = (util._uid || 0) + 1;
      return prefix + '-' + util._uid;
    },
  });

  /* ---------------------------------------------------------------------------------
   * Построитель DOM: h('div', {class: 'x', onclick: fn}, 'текст', child)
   * Текст всегда вставляется через textContent — безопасно для данных.
   * --------------------------------------------------------------------------------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function build(ns, tag, attrs, children) {
    const el = ns ? root.document.createElementNS(ns, tag) : root.document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
        else if (k === 'html') el.innerHTML = v; // только для доверенной разметки курса
        else if (k === 'text') el.textContent = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(typeof c === 'object' ? c : root.document.createTextNode(String(c)));
    }
    return el;
  }
  GBC.h = (tag, attrs, ...children) => build(null, tag, attrs, children);
  GBC.svg = (tag, attrs, ...children) => build(SVG_NS, tag, attrs, children);
  GBC.SVG_NS = SVG_NS;

  /* ---------------------------------------------------------------------------------
   * Событийная шина: GBC.bus.on('themechange', fn)
   * --------------------------------------------------------------------------------- */
  const listeners = {};
  GBC.bus = {
    on(evt, fn) {
      (listeners[evt] || (listeners[evt] = [])).push(fn);
      return () => GBC.bus.off(evt, fn);
    },
    off(evt, fn) {
      const arr = listeners[evt];
      if (arr) listeners[evt] = arr.filter((f) => f !== fn);
    },
    emit(evt, payload) {
      for (const fn of listeners[evt] || []) {
        try {
          fn(payload);
        } catch (e) {
          console.error('[GBC] обработчик события', evt, e);
        }
      }
    },
  };

  /* ---------------------------------------------------------------------------------
   * Хранилище: localStorage может быть недоступен (приватный режим, file://) —
   * тогда просто работаем без сохранения.
   * --------------------------------------------------------------------------------- */
  GBC.storage = {
    get(key, fallback = null) {
      try {
        const raw = root.localStorage.getItem('gbc:' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        root.localStorage.setItem('gbc:' + key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
  };

  /* ---------------------------------------------------------------------------------
   * Скачивание и буфер обмена
   * --------------------------------------------------------------------------------- */
  GBC.io = {
    download(filename, text, mime = 'text/plain;charset=utf-8') {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = GBC.h('a', { href: url, download: filename });
      root.document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    /** CSV из объекта столбцов {имя: массив}. Числа — кратчайшее точное представление. */
    toCSV(columns) {
      const names = Object.keys(columns);
      const n = names.length ? columns[names[0]].length : 0;
      const lines = [names.join(',')];
      for (let i = 0; i < n; i++) {
        lines.push(
          names
            .map((c) => {
              const v = columns[c][i];
              if (v === null || v === undefined || Number.isNaN(v)) return '';
              if (typeof v === 'number') return String(v);
              const s = String(v);
              return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
            })
            .join(',')
        );
      }
      return lines.join('\n') + '\n';
    },
    async copy(text) {
      try {
        await root.navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        const ta = GBC.h('textarea', { style: { position: 'fixed', opacity: '0' } });
        ta.value = text;
        root.document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try {
          ok = root.document.execCommand('copy');
        } catch (e2) {
          ok = false;
        }
        ta.remove();
        return ok;
      }
    },
  };

  /** Загрузка внешнего скрипта (один раз). */
  const scriptPromises = {};
  GBC.loadScript = function (src) {
    if (!scriptPromises[src]) {
      scriptPromises[src] = new Promise((resolve, reject) => {
        const s = root.document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Не удалось загрузить ' + src));
        root.document.head.appendChild(s);
      });
    }
    return scriptPromises[src];
  };
  GBC.loadStyle = function (href) {
    if (root.document.querySelector('link[href="' + href + '"]')) return;
    root.document.head.appendChild(GBC.h('link', { rel: 'stylesheet', href }));
  };

  /** Цвет из CSS-переменной (для canvas, которому нужны реальные значения). */
  GBC.cssVar = function (name, el) {
    const v = root.getComputedStyle(el || root.document.documentElement).getPropertyValue(name);
    return v ? v.trim() : '';
  };
})(typeof window !== 'undefined' ? window : globalThis);
