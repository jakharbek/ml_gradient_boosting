/* Урок 15.17: комбинаторика. Часть 1 — правила подсчёта, перестановки, размещения и сочетания,
 * треугольник Паскаля и бином Ньютона.
 * Виджеты: дерево выбора; правило суммы на числах 1…N; конструктор чисел (правило произведения и разбор
 * на случаи); дополнение «хотя бы один»; биекции (подмножества ↔ строки, делители ↔ показатели);
 * круглый стол (правило деления); сетка гиперпараметров; кандидаты в разбиения по уровням дерева;
 * перестановки; величина n! (Стирлинг, цифры, нули); пьедестал (размещения); размещения → сочетания;
 * анаграммы (мультиномиальный коэффициент); пути по решётке; выбор формулы; треугольник Паскаля и его
 * чётность; бином Ньютона; тождества двойного подсчёта; величина C(n, k) и энтропия.
 * Общие помощники (точная арифметика BigInt, форматирование, плитки, SVG) выставлены в GBC.lesson1517 —
 * ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const f4 = (v) => U.fmt(v, 4);
  const py = (v) => U.pyNum(v);
  const lg = Math.log2;
  const SUPD = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (k) => String(k).split('').map((c) => SUPD[c] || c).join('');
  const NB = '\u00a0';
  /** Целое с разделителями разрядов: 1 728 000. */
  const grp = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  /** Число: целые до 10¹⁵ — полностью, остальное — как 8.07·10⁶⁷. */
  function num(v) {
    if (typeof v === 'bigint') return fmtB(v);
    if (!Number.isFinite(v)) return '∞';
    const a = Math.abs(v);
    if (a < 1e15 && Number.isInteger(v)) return (v < 0 ? '−' : '') + grp(String(a));
    if (a < 1e15) return U.fmt(v, 4);
    const e = Math.floor(Math.log10(a));
    return (v < 0 ? '−' : '') + U.fmt(a / Math.pow(10, e), 2) + '·10' + sup(e);
  }
  /** BigInt: до maxDigits цифр — полностью, иначе m·10ᵉ. */
  function fmtB(b, maxDigits = 15) {
    const neg = b < 0n;
    const s = (neg ? -b : b).toString();
    if (s.length <= maxDigits) return (neg ? '−' : '') + grp(s);
    return (neg ? '−' : '') + s[0] + '.' + s.slice(1, 3) + '·10' + sup(s.length - 1);
  }
  /** Число по его десятичному логарифму: 4.02·10²⁵⁶⁷. */
  function numLog10(l10) {
    if (l10 < 15) return num(Math.round(Math.pow(10, l10)));
    const e = Math.floor(l10);
    return U.fmt(Math.pow(10, l10 - e), 2) + '·10' + sup(e);
  }
  const pct = (p, d = 1) => (Number.isFinite(p) ? U.fmt(100 * p, d) + ' %' : '—');
  /** Склонение: plural(3, 'шаг', 'шага', 'шагов') → 'шага'. */
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  const nWord = (n, one, few, many) => num(n) + ' ' + plural(n, one, few, many);

  /* ==============================================================================
   * Точная комбинаторная арифметика
   * ============================================================================== */
  function fact(n) {
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }
  function comb(n, k) {
    if (k < 0 || k > n) return 0;
    const kk = Math.min(k, n - k);
    let r = 1;
    for (let i = 1; i <= kk; i++) r = (r * (n - kk + i)) / i;
    return Math.round(r);
  }
  const perm = (n, k) => (k < 0 || k > n ? 0 : Math.round(comb(n, k) * fact(k)));
  function factB(n) {
    let r = 1n;
    for (let i = 2n; i <= BigInt(n); i++) r *= i;
    return r;
  }
  function permB(n, k) {
    if (k < 0 || k > n) return 0n;
    let r = 1n;
    for (let i = 0; i < k; i++) r *= BigInt(n - i);
    return r;
  }
  function combB(n, k) {
    if (k < 0 || k > n) return 0n;
    const kk = Math.min(k, n - k);
    let r = 1n;
    for (let i = 1; i <= kk; i++) r = (r * BigInt(n - kk + i)) / BigInt(i);
    return r;
  }
  const powB = (a, b) => BigInt(a) ** BigInt(b);
  function lgamma(x) {
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    let a = c[0];
    const t = x + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  /** ln n! — точной суммой до 10⁵ (без потерь на округлении), дальше через lgamma. */
  function lnFact(n) {
    if (n < 2) return 0;
    if (n <= 1e5) {
      let s = 0;
      for (let i = 2; i <= n; i++) s += Math.log(i);
      return s;
    }
    return lgamma(n + 1);
  }
  const log2C = (n, k) => (k < 0 || k > n ? -Infinity : (lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1)) / Math.LN2);
  const hbin = (q) => (q <= 0 || q >= 1 ? 0 : -q * lg(q) - (1 - q) * lg(1 - q));
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const lcm = (a, b) => (a / gcd(a, b)) * b;

  /* ---------- перечисление ---------- */
  /** Все сочетания k из [0..n) в лексикографическом порядке. */
  function combos(n, k) {
    const out = [];
    const cur = [];
    (function rec(start) {
      if (cur.length === k) return void out.push(cur.slice());
      for (let i = start; i < n; i++) {
        cur.push(i);
        rec(i + 1);
        cur.pop();
      }
    })(0);
    return out;
  }
  /** Все перестановки массива в лексикографическом порядке (по индексам). */
  function perms(arr) {
    if (arr.length <= 1) return [arr.slice()];
    const out = [];
    arr.forEach((x, i) => perms(arr.slice(0, i).concat(arr.slice(i + 1))).forEach((p) => out.push([x].concat(p))));
    return out;
  }
  /** Размещения k из n: все упорядоченные выборки без повторений. */
  function arrangements(n, k) {
    const out = [];
    const cur = [];
    const used = new Uint8Array(n);
    (function rec() {
      if (cur.length === k) return void out.push(cur.slice());
      for (let i = 0; i < n; i++) {
        if (used[i]) continue;
        used[i] = 1;
        cur.push(i);
        rec();
        cur.pop();
        used[i] = 0;
      }
    })();
    return out;
  }
  /** Все слова длины k над алфавитом из n букв (с повторениями, порядок важен). */
  function words(n, k, limit = 1e6) {
    const out = [];
    const total = Math.pow(n, k);
    for (let t = 0; t < Math.min(total, limit); t++) {
      const wd = new Array(k);
      let r = t;
      for (let i = k - 1; i >= 0; i--) {
        wd[i] = r % n;
        r = Math.floor(r / n);
      }
      out.push(wd);
    }
    return out;
  }
  /** Мультимножества размера k из n типов (неубывающие последовательности). */
  function multisets(n, k) {
    const out = [];
    const cur = [];
    (function rec(start) {
      if (cur.length === k) return void out.push(cur.slice());
      for (let t = start; t < n; t++) {
        cur.push(t);
        rec(t);
        cur.pop();
      }
    })(0);
    return out;
  }
  /** Различные перестановки мультимножества (следующая перестановка Нараяны), не больше limit. */
  function multisetPerms(arr, limit = 5000) {
    const a = arr.slice().sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    const out = [a.slice()];
    while (out.length < limit) {
      let i = a.length - 2;
      while (i >= 0 && a[i] >= a[i + 1]) i--;
      if (i < 0) break;
      let j = a.length - 1;
      while (a[j] <= a[i]) j--;
      [a[i], a[j]] = [a[j], a[i]];
      for (let l = i + 1, r = a.length - 1; l < r; l++, r--) [a[l], a[r]] = [a[r], a[l]];
      out.push(a.slice());
    }
    return out;
  }

  /* ==============================================================================
   * Оформление
   * ============================================================================== */
  const LET = 'ABCDEFGHIJKLMNOP';
  const SER = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];
  const cvar = (i) => 'var(--c-' + SER[((i % SER.length) + SER.length) % SER.length] + ')';
  const tint = (c, p = 22) => 'color-mix(in srgb, ' + c + ' ' + p + '%, var(--surface))';
  /** Плитка-предмет: буква в цветной рамке. o: { size, font, dim, on, color } */
  function tile(text, i, o = {}) {
    const c = o.color || (i === null || i === undefined ? 'var(--border-strong)' : cvar(i));
    const sz = o.size || 2.1;
    const el = H('span', {
      style: 'display:inline-flex;align-items:center;justify-content:center;min-width:' + sz + 'em;height:' + sz + 'em;padding:0 5px;' +
        'border-radius:8px;font-family:var(--font-mono);font-weight:700;font-size:' + (o.font || 1) + 'rem;border:2px solid ' + c + ';' +
        'background:' + (o.on ? tint(c, 34) : 'var(--surface-2)') + ';color:var(--ink);box-sizing:border-box;opacity:' + (o.dim ? 0.3 : 1) +
        (o.click ? ';cursor:pointer;user-select:none' : ''),
    }, text);
    if (o.click) el.addEventListener('click', o.click);
    return el;
  }
  const flexRow = (style = '') => H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;' + style });
  function texInto(el, src, display = false) {
    el._tex = src;
    el.replaceChildren(GBC.math.tex(src, display));
    if (!window.katex && !el._texSub) {
      el._texSub = true;
      GBC.bus.on('mathready', () => el.replaceChildren(GBC.math.tex(el._tex, display)));
    }
  }
  const texEl = (src, display = false, style = '') => {
    const el = H('div', { style: 'overflow-x:auto;overflow-y:hidden;' + style });
    texInto(el, src, display);
    return el;
  };
  function card(title) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums;overflow-x:auto;overflow-y:hidden' });
    const titleEl = H('div', { style: 'font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px' }, title);
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' }, titleEl, body);
    return { el, body, titleEl };
  }
  const cardGrid = (min = 200) => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(' + min + 'px,100%),1fr));gap:10px;margin:4px 0 10px' });
  function badge(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : kind === 'warn' ? 'background:var(--warn-soft);color:var(--warn-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;white-space:nowrap;' + st }, text);
  }
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  const scrollBox = (style = '') => H('div', { style: 'overflow-x:auto;overflow-y:hidden;margin:4px 0 8px;' + style });
  const monoBox = (style = '') => H('div', { style: 'font-family:var(--font-mono);font-size:.86rem;line-height:1.6;white-space:pre-wrap;word-break:break-word;padding:6px 2px;' + style });
  /** SVG-полотно в прокручиваемой рамке: на узком экране не сжимается меньше minW. */
  function svgBox(parent, w, h, minW = 0, maxW = 0) {
    const svg = S('svg', { viewBox: '0 0 ' + w + ' ' + h, style: 'display:block;width:100%;height:auto;max-width:' + (maxW ? maxW + 'px' : 'none') + ';min-width:' + (minW || 0) + 'px;margin:0 auto' });
    const box = scrollBox();
    box.appendChild(svg);
    parent.appendChild(box);
    return svg;
  }
  const sText = (x, y, text, o = {}) => S('text', { x, y, 'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'central', style: 'font-family:' + (o.mono ? 'var(--font-mono)' : 'var(--font-sans)') + ';font-size:' + (o.size || 13) + 'px;font-weight:' + (o.bold ? 700 : 500) + ';fill:' + (o.color || 'var(--ink)') }, text);
  /** Цветовая легенда из кружков. */
  function legendRow(items) {
    const row = flexRow('gap:14px;font-size:.86rem;color:var(--ink-2);margin:2px 0 6px');
    items.forEach(([c, t]) => row.appendChild(H('span', { style: 'display:inline-flex;align-items:center;gap:6px' }, H('span', { style: 'width:12px;height:12px;border-radius:3px;display:inline-block;background:' + tint(c, 45) + ';border:2px solid ' + c }), t)));
    return row;
  }
  const PY_MATH = 'from math import comb, factorial, perm\n';
  const PY_IT = 'from itertools import combinations, combinations_with_replacement, permutations, product\n';

  /* ==============================================================================
   * 0. Дерево выбора: правило произведения
   * ============================================================================== */
  GBC.widget('choice-tree', (el) => {
    const s = { a: 3, b: 2, c: 2, leaf: 0 };
    const STAGES = ['рубашка', 'брюки', 'обувь'];
    const SHORT = ['Р', 'Б', 'О'];
    const w = ui.shell(el, { title: 'Дерево выбора: правило произведения', sub: 'Одеваемся в три этапа: рубашка, брюки, обувь. Каждый путь от корня до листа — один комплект. Сколько всего комплектов?' });
    const total = () => s.a * s.b * s.c;
    const reset = () => {
      s.leaf = 0;
      pl.stop();
      pl.setMax(total() - 1);
      pl.set(0);
      draw();
    };
    ui.slider(w.controls, { label: 'Рубашек', min: 1, max: 4, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), reset()) });
    ui.slider(w.controls, { label: 'Брюк', min: 1, max: 4, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), reset()) });
    ui.slider(w.controls, { label: 'Пар обуви', min: 1, max: 3, step: 1, value: s.c, format: String, onInput: (v) => ((s.c = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Перебор комплектов', min: 0, max: total() - 1, value: 0, fps: 2, format: (k, m) => k + 1 + ' из ' + (m + 1), onChange: (k) => ((s.leaf = k), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, grid: 'none', x: { label: '', domain: [-0.25, 3.75], ticks: [] }, y: { label: '', domain: [0, 1.1], ticks: [] }, margin: { left: 10, bottom: 10 } });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'после этапа 1' }, { key: 'ab', label: 'после этапа 2' }, { key: 'n', label: 'всего комплектов' }]);
    function draw() {
      const N = total();
      const counts = [1, s.a, s.a * s.b, N];
      const br = [1, s.a, s.b, s.c];
      const yOf = (l, i) => 1 - (i + 0.5) / counts[l];
      const path = [0, Math.floor(s.leaf / (s.b * s.c)), Math.floor(s.leaf / s.c), s.leaf];
      const seg = { x1: [], y1: [], x2: [], y2: [] };
      const hot = { x1: [], y1: [], x2: [], y2: [] };
      const nodes = { x: [], y: [] };
      const labels = [];
      for (let l = 1; l <= 3; l++) {
        for (let i = 0; i < counts[l]; i++) {
          const p = Math.floor(i / br[l]);
          const t = path[l] === i && path[l - 1] === p ? hot : seg;
          t.x1.push(l - 1);
          t.y1.push(yOf(l - 1, p));
          t.x2.push(l);
          t.y2.push(yOf(l, i));
          nodes.x.push(l);
          nodes.y.push(yOf(l, i));
          if (counts[l] <= 16) labels.push({ x: l, y: yOf(l, i), dx: 8, dy: 4, text: SHORT[l - 1] + ((i % br[l]) + 1) });
        }
      }
      plot.render([
        { type: 'segments', ...seg, color: 'muted', width: 1.2, opacity: 0.8 },
        { type: 'segments', ...hot, color: 'tree', width: 3, opacity: 1 },
        { type: 'points', x: [0], y: [0.5], color: 'ink', r: 5 },
        { type: 'points', ...nodes, color: 'model', r: N > 24 ? 2.5 : 4 },
        { type: 'points', x: [1, 2, 3], y: [yOf(1, path[1]), yOf(2, path[2]), yOf(3, path[3])], color: 'tree', r: 5 },
        { type: 'text', items: [...STAGES.map((t, i) => ({ x: i + 1, y: 1.06, anchor: 'middle', text: t })), ...labels] },
      ]);
      line.textContent = 'Комплект ' + (s.leaf + 1) + ': рубашка ' + (path[1] + 1) + ' → брюки ' + ((path[2] % s.b) + 1) + ' → обувь ' + ((s.leaf % s.c) + 1);
      st.set('a', String(s.a));
      st.set('ab', s.a + ' · ' + s.b + ' = ' + s.a * s.b);
      st.set('n', s.a + ' · ' + s.b + ' · ' + s.c + ' = ' + N);
      note.innerHTML = 'Каждая рубашка «размножает» все дальнейшие ветки: после первого этапа ' + s.a + ' ' + plural(s.a, 'ветка', 'ветки', 'веток') + ', после второго — ' + s.a + ' · ' + s.b + ' = ' + s.a * s.b + ', после третьего — ' + N + '. <b>Правило произведения</b> работает, потому что число вариантов на каждом этапе не зависит от того, что выбрано раньше: к любой рубашке подходят любые брюки. Плеер обходит листья по порядку — так же, как <code>itertools.product</code> перебирает комбинации.';
    }
    w.pythonAction(() => PY_IT + '\nshirts, trousers, shoes = range(1, ' + (s.a + 1) + '), range(1, ' + (s.b + 1) + '), range(1, ' + (s.c + 1) + ')\noutfits = list(product(shirts, trousers, shoes))\nprint(len(outfits), "=", len(shirts), "*", len(trousers), "*", len(shoes))\nprint("первые:", outfits[:4])\n');
    draw();
  });

  /* ==============================================================================
   * 1. Правило суммы: числа 1…N, кратные a или b
   * ============================================================================== */
  GBC.widget('sum-rule', (el) => {
    const s = { N: 60, a: 2, b: 3, fix: true };
    const w = ui.shell(el, { title: 'Правило суммы: складываем только непересекающееся', sub: 'Числа от 1 до N. A — кратные a, B — кратные b. Сколько чисел кратны a или b? Если просто сложить |A| и |B|, общие числа посчитаются дважды.' });
    ui.slider(w.controls, { label: 'N', min: 10, max: 120, step: 10, value: s.N, format: String, onInput: (v) => ((s.N = v), draw()) });
    ui.slider(w.controls, { label: 'a', min: 2, max: 9, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'b', min: 2, max: 9, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.toggle(w.controls, { label: 'Вычитать общие (A ∩ B)', checked: s.fix, onChange: (v) => ((s.fix = v), draw()) });
    const leg = H('div');
    const box = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(34px,1fr));gap:4px;margin:6px 0 4px' });
    const eq = texEl('', true, 'margin:6px 0');
    w.main.append(leg, box, eq);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'A', label: '|A|' }, { key: 'B', label: '|B|' }, { key: 'AB', label: '|A ∩ B|' }, { key: 'sum', label: '|A| + |B|' }, { key: 'U', label: '|A ∪ B| (перебор)' }]);
    function draw() {
      const { N, a, b } = s;
      const L = lcm(a, b);
      leg.replaceChildren(legendRow([['var(--c-blue)', 'только A (кратные ' + a + ')'], ['var(--c-orange)', 'только B (кратные ' + b + ')'], ['var(--c-aqua)', 'в обоих (кратные ' + L + ')']]));
      box.textContent = '';
      let union = 0;
      for (let i = 1; i <= N; i++) {
        const inA = i % a === 0;
        const inB = i % b === 0;
        if (inA || inB) union++;
        const c = inA && inB ? 'var(--c-aqua)' : inA ? 'var(--c-blue)' : inB ? 'var(--c-orange)' : null;
        box.appendChild(H('span', { style: 'text-align:center;font-family:var(--font-mono);font-size:.8rem;padding:4px 0;border-radius:6px;font-variant-numeric:tabular-nums;' + (c ? 'border:2px solid ' + c + ';background:' + tint(c, 26) + ';color:var(--ink);font-weight:650' : 'border:1px solid var(--border);color:var(--muted)') }, String(i)));
      }
      const nA = Math.floor(N / a);
      const nB = Math.floor(N / b);
      const nAB = Math.floor(N / L);
      texInto(eq, s.fix ? '|A \\cup B| = |A| + |B| - |A \\cap B| = ' + nA + ' + ' + nB + ' - ' + nAB + ' = ' + (nA + nB - nAB) : '|A| + |B| = ' + nA + ' + ' + nB + ' = ' + (nA + nB) + (nAB ? ' \\ne ' + union : ''), true);
      st.set('A', '⌊' + N + '/' + a + '⌋ = ' + nA);
      st.set('B', '⌊' + N + '/' + b + '⌋ = ' + nB);
      st.set('AB', '⌊' + N + '/' + L + '⌋ = ' + nAB);
      st.set('sum', String(nA + nB));
      st.set('U', String(union));
      const same = a % b === 0 || b % a === 0;
      note.innerHTML = (nAB === 0
        ? 'Сейчас общих чисел нет (НОК(' + a + ', ' + b + ') = ' + L + ' больше N) — множества не пересекаются, и правило суммы работает «как есть»: ' + nA + ' + ' + nB + ' = ' + union + '.'
        : s.fix
          ? 'Числа, кратные и ' + a + ', и ' + b + ', — это кратные НОК(' + a + ', ' + b + ') = ' + L + ' (бирюзовые). В сумме |A| + |B| каждое из них посчитано <b>дважды</b> — один раз вычитаем: ' + nA + ' + ' + nB + ' − ' + nAB + ' = ' + union + '. Это формула включений-исключений для двух множеств (шаг 23).'
          : '<b>Ошибка двойного счёта:</b> |A| + |B| = ' + (nA + nB) + ', а настоящих чисел ' + union + ' — лишние ' + nAB + ' (бирюзовые) попали в обе группы. Правило суммы требует <b>непересекающихся</b> групп.') +
        (same ? ' Здесь одно из чисел делит другое: B ⊂ A или A ⊂ B, и объединение — просто большее множество.' : '');
    }
    w.pythonAction(() => 'N, a, b = ' + s.N + ', ' + s.a + ', ' + s.b + '\nA = {i for i in range(1, N + 1) if i % a == 0}\nB = {i for i in range(1, N + 1) if i % b == 0}\nprint("|A| =", len(A), " |B| =", len(B), " |A & B| =", len(A & B))\nprint("|A| + |B| =", len(A) + len(B), " |A | B| =", len(A | B), "=", len(A) + len(B) - len(A & B))\n');
    draw();
  });

  /* ==============================================================================
   * 2. Конструктор чисел: правило произведения и разбор на случаи
   * ============================================================================== */
  GBC.widget('number-builder', (el) => {
    const s = { L: 3, distinct: true, lead: true, even: false, order: 'lr' };
    const w = ui.shell(el, { title: 'Конструктор чисел: когда правило произведения работает', sub: 'Сколько L-значных записей из цифр 0–9 удовлетворяют условиям? Заполняем позиции по одной и считаем варианты на каждом этапе. Если число вариантов зависит от прошлых выборов, задачу делят на случаи.' });
    ui.slider(w.controls, { label: 'Длина L', min: 2, max: 5, step: 1, value: s.L, format: String, onInput: (v) => ((s.L = v), draw()) });
    ui.toggle(w.controls, { label: 'Цифры не повторяются', checked: s.distinct, onChange: (v) => ((s.distinct = v), draw()) });
    ui.toggle(w.controls, { label: 'Первая цифра не 0', checked: s.lead, onChange: (v) => ((s.lead = v), draw()) });
    ui.toggle(w.controls, { label: 'Число чётное', checked: s.even, onChange: (v) => ((s.even = v), draw()) });
    ui.segmented(w.controls, { label: 'Порядок заполнения', value: s.order, options: [{ value: 'lr', label: 'слева направо' }, { value: 'last', label: 'сначала последняя' }], onChange: (v) => ((s.order = v), draw()) });
    const slots = flexRow('justify-content:center;gap:10px;padding:8px 0');
    const eq = texEl('', true, 'margin:4px 0');
    const cases = H('div');
    w.main.append(slots, eq, cases);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'all', label: 'всего записей 10ᴸ' }, { key: 'ok', label: 'подходят (перебор)' }, { key: 'rule', label: 'произведение работает?' }]);
    const okDigit = (pos, d, used) => !(s.distinct && used[d]) && !(s.lead && pos === 0 && d === 0) && !(s.even && pos === s.L - 1 && d % 2);
    /** Число способов дозаполнить позиции order[from..] при занятых цифрах used. */
    function completions(order, from, used) {
      if (from === order.length) return 1;
      let c = 0;
      const pos = order[from];
      for (let d = 0; d < 10; d++) {
        if (!okDigit(pos, d, used)) continue;
        used[d]++;
        c += completions(order, from + 1, used);
        used[d]--;
      }
      return c;
    }
    /** Для каждого этапа — множество возможных чисел вариантов (по всем допустимым началам). */
    function stageSets(order, from0, used0) {
      const sets = order.map(() => new Set());
      (function rec(i, used) {
        if (i === order.length) return;
        const pos = order[i];
        const ok = [];
        for (let d = 0; d < 10; d++) if (okDigit(pos, d, used)) ok.push(d);
        sets[i].add(ok.length);
        ok.forEach((d) => {
          used[d]++;
          rec(i + 1, used);
          used[d]--;
        });
      })(from0, used0);
      return sets;
    }
    const posName = (p) => (s.L === 3 ? ['сотни', 'десятки', 'единицы'][p] : p + 1 + '-я цифра');
    function draw() {
      const L = s.L;
      const order = s.order === 'lr' ? U.range(L) : [L - 1, ...U.range(L - 1)];
      const total = completions(order, 0, new Array(10).fill(0));
      const sets = stageSets(order, 0, new Array(10).fill(0));
      const fixed = sets.every((z) => z.size === 1);
      slots.textContent = '';
      U.range(L).forEach((p) => {
        const stage = order.indexOf(p);
        const vals = [...sets[stage]].sort((x, y) => x - y);
        const txt = vals.length === 1 ? String(vals[0]) : vals[0] + '–' + vals[vals.length - 1];
        slots.appendChild(H('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:4px;min-width:64px' },
          H('span', { style: 'font-size:.75rem;color:var(--ink-2)' }, 'этап ' + (stage + 1)),
          H('span', { style: 'display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:12px;font-family:var(--font-mono);font-size:1.25rem;font-weight:700;border:2px solid ' + (vals.length === 1 ? 'var(--c-blue)' : 'var(--c-orange)') + ';background:' + tint(vals.length === 1 ? 'var(--c-blue)' : 'var(--c-orange)', 18) + ';color:var(--ink)' }, txt),
          H('span', { style: 'font-size:.75rem;color:var(--ink-2)' }, posName(p))));
      });
      cases.textContent = '';
      if (fixed) {
        texInto(eq, order.map((p, i) => [...sets[i]][0]).join(' \\cdot ') + ' = ' + total, true);
      } else {
        texInto(eq, '\\text{число вариантов зависит от прошлых выборов — делим на случаи}', true);
        const first = order[0];
        const groups = new Map();
        for (let d = 0; d < 10; d++) {
          const used = new Array(10).fill(0);
          if (!okDigit(first, d, used)) continue;
          used[d]++;
          const c = completions(order, 1, used);
          const sub = stageSets(order, 1, used);
          const key = c;
          if (!groups.has(key)) groups.set(key, { digits: [], c, prod: sub.slice(1).every((z) => z.size === 1) ? sub.slice(1).map((z) => [...z][0]) : null });
          groups.get(key).digits.push(d);
        }
        const lines = [];
        let sum = 0;
        groups.forEach((g) => {
          sum += g.c * g.digits.length;
          lines.push((g.digits.length === 1 ? posName(first) + ' = ' + g.digits[0] : posName(first) + ' ∈ {' + g.digits.join(', ') + '}') + ': ' + (g.digits.length > 1 ? g.digits.length + ' × ' : '') + (g.prod ? g.prod.join(' · ') + ' = ' : '') + g.c + (g.digits.length > 1 ? ' = ' + g.c * g.digits.length : ''));
        });
        const m = monoBox('border-left:3px solid var(--c-orange);padding-left:10px;margin:4px 0');
        m.textContent = 'Случаи по этапу 1 (' + posName(first) + '):\n' + lines.join('\n') + '\nИтого по правилу суммы: ' + sum;
        cases.appendChild(m);
      }
      st.set('all', num(Math.pow(10, L)));
      st.set('ok', num(total));
      st.set('rule', fixed ? 'да' : 'нет — случаи');
      const conds = [s.distinct && 'цифры разные', s.lead && 'без нуля впереди', s.even && 'чётное'].filter(Boolean);
      note.innerHTML = (conds.length ? 'Условия: ' + conds.join(', ') + '. ' : 'Без условий: каждая позиция — любая из 10 цифр, 10<sup>' + L + '</sup> записей. ') +
        (fixed
          ? 'На каждом этапе число вариантов <b>одно и то же</b> при любых прошлых выборах (синие ячейки) — значит, правило произведения применимо. Важно не <em>какие</em> цифры остаются, а <em>сколько</em>.'
          : '<b>Оранжевая ячейка</b>: число вариантов зависит от того, что выбрано раньше. Например, при «цифры разные + чётное» последняя цифра может быть 0, и тогда для первой позиции остаётся 9 цифр, а не 8. Выход — правило суммы: разбить на случаи по самому «трудному» месту, в каждом случае применить произведение и сложить.') +
        ' Совет: начинайте с самой ограниченной позиции — так случаев меньше. Попробуйте переключить порядок заполнения.';
    }
    w.pythonAction(() => {
      const c = [];
      if (s.distinct) c.push('len(set(t)) == len(t)');
      if (s.lead) c.push('t[0] != 0');
      if (s.even) c.push('t[-1] % 2 == 0');
      return PY_IT + '\nL = ' + s.L + '\nok = [t for t in product(range(10), repeat=L) if ' + (c.length ? c.join(' and ') : 'True') + ']\nprint("подходят:", len(ok), "из", 10**L)\nprint("примеры:", ["".join(map(str, t)) for t in ok[:5]])\n';
    });
    draw();
  });

  /* ==============================================================================
   * 3. Дополнение: «хотя бы один» = всё минус «ни одного»
   * ============================================================================== */
  GBC.widget('complement', (el) => {
    const s = { n: 4, k: 3, mode: 'one' };
    const w = ui.shell(el, { title: 'Правило дополнения: «хотя бы один» = всё − «ни одного»', sub: 'Слова длины k из букв A, B, C, … (буквы могут повторяться). Сколько слов содержат хотя бы одну A? Или хотя бы одну повторяющуюся букву? Легче посчитать противоположное.' });
    ui.slider(w.controls, { label: 'Букв в алфавите n', min: 2, max: 10, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Длина слова k', min: 1, max: 6, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.segmented(w.controls, { label: 'Событие', value: s.mode, options: [{ value: 'one', label: 'есть A' }, { value: 'rep', label: 'есть повтор' }], onChange: (v) => ((s.mode = v), draw()) });
    const bar = H('div', { style: 'display:flex;height:34px;border-radius:10px;overflow:hidden;margin:8px 0 4px;border:1px solid var(--border)' });
    const barLeg = H('div');
    const eq = texEl('', true, 'margin:4px 0');
    const list = H('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin:6px 0' });
    w.main.append(bar, barLeg, eq, list);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'all', label: 'всего nᵏ' }, { key: 'bad', label: 'противоположных' }, { key: 'good', label: 'с событием' }, { key: 'p', label: 'доля' }]);
    function draw() {
      const { n, k } = s;
      const all = Math.pow(n, k);
      const bad = s.mode === 'one' ? Math.pow(n - 1, k) : perm(n, k);
      const good = all - bad;
      bar.textContent = '';
      const seg = (v, c, t) => {
        if (!v) return;
        bar.appendChild(H('div', { style: 'flex:' + v + ' 0 0;background:' + tint(c, 40) + ';display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:650;color:var(--ink);white-space:nowrap;overflow:hidden;min-width:0' }, v / all > 0.08 ? t : ''));
      };
      seg(good, 'var(--c-orange)', num(good));
      seg(bad, 'var(--c-blue)', num(bad));
      barLeg.replaceChildren(legendRow([['var(--c-orange)', s.mode === 'one' ? 'есть хотя бы одна A' : 'есть повторяющаяся буква'], ['var(--c-blue)', s.mode === 'one' ? 'ни одной A' : 'все буквы разные']]));
      if (s.mode === 'one') {
        const terms = U.range(k, 1).map((j) => '\\tbinom{' + k + '}{' + j + '}' + (n - 1) + '^{' + (k - j) + '}');
        texInto(eq, '\\begin{gathered}' + n + '^{' + k + '} - ' + (n - 1) + '^{' + k + '} = ' + all + ' - ' + bad + ' = ' + good + (k <= 4 ? '\\\\ \\text{напрямую: }' + terms.join(' + ') + ' = ' + good : '') + '\\end{gathered}', true);
      } else {
        texInto(eq, n + '^{' + k + '} - A_{' + n + '}^{' + k + '} = ' + all + ' - ' + bad + ' = ' + good, true);
      }
      list.textContent = '';
      if (all <= 256) {
        words(n, k).forEach((wd) => {
          const txt = wd.map((i) => LET[i]).join('');
          const has = s.mode === 'one' ? wd.includes(0) : new Set(wd).size < wd.length;
          list.appendChild(H('span', { style: 'font-family:var(--font-mono);font-size:.8rem;padding:2px 6px;border-radius:6px;border:1px solid ' + (has ? 'var(--c-orange)' : 'var(--c-blue)') + ';background:' + tint(has ? 'var(--c-orange)' : 'var(--c-blue)', 14) + ';color:var(--ink)' }, txt));
        });
      } else list.appendChild(H('span', { style: 'font-size:.86rem;color:var(--ink-2)' }, 'Слов ' + num(all) + ' — список показан, когда их не больше 256.'));
      st.set('all', n + sup(k) + ' = ' + num(all));
      st.set('bad', num(bad));
      st.set('good', num(good));
      st.set('p', pct(good / all));
      note.innerHTML = s.mode === 'one'
        ? 'Прямой подсчёт «хотя бы одной A» требует случаев: ровно одна A, ровно две, … (формула справа — сумма по числу A, она станет понятной после сочетаний в шаге 10). Противоположное событие «ни одной A» — одно произведение: на каждом из k мест одна из n − 1 = ' + (n - 1) + ' букв. Поэтому <b>«хотя бы один» почти всегда считают через дополнение</b>. При больших k доля слов с A стремится к 1: 1 − ((n − 1)/n)<sup>k</sup>.'
        : 'Противоположное событие «все буквы разные» — это размещения A(n, k) = n·(n − 1)·…·(n − k + 1) (шаг 9). ' + (k > n ? 'Сейчас k > n, разных букв не хватает, и повтор есть <b>в каждом</b> слове — это принцип Дирихле (шаг 25).' : 'При n = 10 и k = 4 это PIN-коды: 10⁴ − 5040 = 4960 кодов с повтором цифры — почти половина.');
    }
    w.pythonAction(() => PY_IT + PY_MATH + '\nn, k = ' + s.n + ', ' + s.k + '\nletters = "ABCDEFGHIJ"[:n]\nwords = ["".join(t) for t in product(letters, repeat=k)]\n' + (s.mode === 'one' ? 'good = [w for w in words if "A" in w]\nprint(len(good), "=", n**k, "-", (n - 1)**k, "=", n**k - (n - 1)**k)\nprint("по случаям:", sum(comb(k, j) * (n - 1)**(k - j) for j in range(1, k + 1)))\n' : 'good = [w for w in words if len(set(w)) < k]\nprint(len(good), "=", n**k, "-", perm(n, k), "=", n**k - perm(n, k))\n'));
    draw();
  });

  /* ==============================================================================
   * 4. Биекции: подмножества ↔ двоичные строки, делители ↔ наборы показателей
   * ============================================================================== */
  function factorize(N) {
    const out = [];
    let m = N;
    for (let p = 2; p * p <= m; p++) {
      if (m % p) continue;
      let e = 0;
      while (m % p === 0) (m /= p), e++;
      out.push([p, e]);
    }
    if (m > 1) out.push([m, 1]);
    return out;
  }
  GBC.widget('bijection', (el) => {
    const s = { mode: 'sub', n: 4, mask: 5, N: 360, di: 0 };
    const w = ui.shell(el, { title: 'Биекция: посчитать другое, но столько же', sub: 'Если между двумя множествами есть взаимно однозначное соответствие, в них одинаково элементов. Подмножество — это строка из 0 и 1; делитель — набор показателей простых множителей.' });
    ui.segmented(w.controls, { label: 'Соответствие', value: s.mode, options: [{ value: 'sub', label: 'подмножества' }, { value: 'div', label: 'делители' }], onChange: (v) => ((s.mode = v), sync(), draw()) });
    const cN = ui.slider(w.controls, { label: 'Элементов n', min: 1, max: 6, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), (s.mask = 0), pl.stop(), pl.setMax(Math.pow(2, v) - 1), pl.set(0), draw()) });
    const pl = ui.player(w.controls, { label: 'Перебор подмножеств', min: 0, max: Math.pow(2, s.n) - 1, value: s.mask, fps: 2, format: (k, m) => 'маска ' + k + ' из 0…' + m, onChange: (k) => ((s.mask = k), draw()) });
    const cD = ui.select(w.controls, { label: 'Число N', value: s.N, options: [12, 36, 60, 72, 360, 1000, 5040].map((v) => ({ value: v, label: String(v) })), onChange: (v) => ((s.N = +v), (s.di = 0), draw()) });
    const top = H('div');
    const mid = H('div');
    w.main.append(top, mid);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'объект' }, { key: 'b', label: 'его образ' }, { key: 'n', label: 'всего' }]);
    function sync() {
      cN.el.style.display = s.mode === 'sub' ? '' : 'none';
      pl.el.style.display = s.mode === 'sub' ? '' : 'none';
      cD.el.style.display = s.mode === 'div' ? '' : 'none';
    }
    function draw() {
      top.textContent = '';
      mid.textContent = '';
      if (s.mode === 'sub') {
        const n = s.n;
        const bits = U.range(n).map((i) => (s.mask >> (n - 1 - i)) & 1);
        const row = flexRow('justify-content:center;gap:10px;padding:8px 0');
        bits.forEach((b, i) => {
          row.appendChild(H('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:4px' },
            tile(LET[i], i, { on: !!b, dim: !b, size: 2.4, click: () => ((s.mask ^= 1 << (n - 1 - i)), pl.set(s.mask), draw()) }),
            H('span', { style: 'font-family:var(--font-mono);font-weight:700;font-size:1.1rem;color:' + (b ? 'var(--ink)' : 'var(--muted)') }, String(b))));
        });
        top.appendChild(row);
        top.appendChild(H('div', { style: 'text-align:center;font-size:.85rem;color:var(--ink-2)' }, 'Щёлкните по букве, чтобы взять её в подмножество или убрать.'));
        const byK = U.range(n + 1).map(() => []);
        for (let m = 0; m < Math.pow(2, n); m++) {
          const set = U.range(n).filter((i) => (m >> (n - 1 - i)) & 1);
          byK[set.length].push({ m, txt: set.length ? set.map((i) => LET[i]).join('') : '∅' });
        }
        byK.forEach((arr) => arr.sort((x, y) => (x.txt < y.txt ? -1 : 1)));
        const g = cardGrid(150);
        byK.forEach((arr, k) => {
          const c = card('размер ' + k + ': ' + arr.length);
          const r = flexRow('gap:4px');
          arr.forEach((o) => r.appendChild(H('span', { style: 'font-family:var(--font-mono);font-size:.8rem;padding:1px 6px;border-radius:6px;border:1px solid ' + (o.m === s.mask ? 'var(--c-orange)' : 'var(--border)') + ';background:' + (o.m === s.mask ? tint('var(--c-orange)', 24) : 'transparent') + ';color:var(--ink)' }, o.txt)));
          c.body.appendChild(r);
          g.appendChild(c.el);
        });
        mid.appendChild(g);
        const set = U.range(n).filter((i) => bits[i]);
        st.set('a', '{' + set.map((i) => LET[i]).join(', ') + '}');
        st.set('b', bits.join('') + ' = ' + s.mask);
        st.set('n', '2' + sup(n) + ' = ' + Math.pow(2, n));
        note.innerHTML = 'Каждому подмножеству соответствует ровно одна строка из ' + n + ' нулей и единиц (1 — элемент взят), и наоборот. Строк 2<sup>' + n + '</sup> — по правилу произведения, значит, и подмножеств 2<sup>' + n + '</sup> = ' + Math.pow(2, n) + '. Строку можно прочитать как двоичное число от 0 до ' + (Math.pow(2, n) - 1) + ' — так подмножества нумеруют в программах (битовые маски). Карточки внизу группируют подмножества по размеру: их число — строка треугольника Паскаля ' + byK.map((a) => a.length).join(', ') + ' (шаг 14).';
      } else {
        const N = s.N;
        const fz = factorize(N);
        const tuples = [];
        (function rec(i, cur) {
          if (i === fz.length) return void tuples.push(cur.slice());
          for (let e = 0; e <= fz[i][1]; e++) {
            cur.push(e);
            rec(i + 1, cur);
            cur.pop();
          }
        })(0, []);
        const divs = tuples.map((t) => t.reduce((acc, e, i) => acc * Math.pow(fz[i][0], e), 1));
        top.appendChild(texEl(N + ' = ' + fz.map(([p, e]) => p + (e > 1 ? '^{' + e + '}' : '')).join(' \\cdot ') + '\\qquad d = ' + fz.map(([p], i) => p + '^{e_' + (i + 1) + '}').join(' \\cdot ') + ',\\ ' + fz.map(([, e], i) => '0 \\le e_' + (i + 1) + ' \\le ' + e).join(',\\ '), true, 'margin:6px 0'));
        const box = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px' });
        tuples.forEach((t, i) => {
          const b = H('button', { type: 'button', style: 'text-align:left;font-family:var(--font-mono);font-size:.8rem;padding:4px 8px;border-radius:8px;cursor:pointer;color:var(--ink);border:1px solid ' + (i === s.di ? 'var(--c-orange)' : 'var(--border)') + ';background:' + (i === s.di ? tint('var(--c-orange)', 22) : 'var(--surface)') }, '(' + t.join(', ') + ') → ' + divs[i]);
          b.addEventListener('click', () => ((s.di = i), draw()));
          box.appendChild(b);
        });
        mid.appendChild(box);
        const t = tuples[s.di];
        st.set('a', 'делитель ' + divs[s.di]);
        st.set('b', '(' + t.join(', ') + ')');
        st.set('n', fz.map(([, e]) => e + 1).join(' · ') + ' = ' + tuples.length);
        note.innerHTML = 'Делитель числа ' + N + ' однозначно задаётся показателями простых множителей: ' + divs[s.di] + ' = ' + fz.map(([p], i) => p + '<sup>' + t[i] + '</sup>').join('·') + '. Показатель простого p<sub>i</sub> выбирается независимо из e<sub>i</sub> + 1 вариантов (от 0 до e<sub>i</sub>), так что делителей <b>' + fz.map(([, e]) => '(' + e + ' + 1)').join('·') + ' = ' + tuples.length + '</b> — правило произведения на наборах, а не на самих делителях. Щёлкните по набору, чтобы увидеть его делитель.';
      }
    }
    w.pythonAction(() => (s.mode === 'sub'
      ? PY_IT + '\nitems = "' + LET.slice(0, s.n) + '"\nmasks = list(product((0, 1), repeat=len(items)))\nsubsets = [{x for x, b in zip(items, m) if b} for m in masks]\nprint(len(subsets), "=", 2**len(items))\nfor m, sub in list(zip(masks, subsets))[:6]:\n    print("".join(map(str, m)), sorted(sub))\n'
      : 'N = ' + s.N + '\ndivs = [d for d in range(1, N + 1) if N % d == 0]\nf, m, p = {}, N, 2\nwhile m > 1:\n    while m % p == 0:\n        f[p] = f.get(p, 0) + 1\n        m //= p\n    p += 1\nfrom math import prod\nprint("разложение:", f, " делителей:", len(divs), "=", prod(e + 1 for e in f.values()))\n'));
    sync();
    draw();
  });

  /* ==============================================================================
   * 5. Круглый стол: правило деления
   * ============================================================================== */
  GBC.widget('round-table', (el) => {
    const s = { n: 5, mirror: false, cls: 0 };
    const w = ui.shell(el, { title: 'Круглый стол: правило деления', sub: 'n гостей садятся за круглый стол. Рассадки, которые отличаются только поворотом, одинаковы: у всех те же соседи. Каждая «настоящая» рассадка получается из n записей-поворотов — делим n! на n.' });
    ui.slider(w.controls, { label: 'Гостей n', min: 3, max: 7, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), reset()) });
    ui.toggle(w.controls, { label: 'Зеркальные тоже одинаковы (ожерелье)', checked: s.mirror, onChange: (v) => ((s.mirror = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Рассадка', min: 0, max: 1, value: 0, fps: 1.5, format: (k, m) => k + 1 + ' из ' + (m + 1), onChange: (k) => ((s.cls = k), draw()) });
    const bigBox = H('div', { style: 'display:flex;justify-content:center' });
    const miniHead = H('div', { style: 'font-size:.86rem;color:var(--ink-2);margin:6px 0 2px' });
    const minis = flexRow('justify-content:center;gap:4px');
    w.main.append(bigBox, miniHead, minis);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'all', label: 'записей n!' }, { key: 'per', label: 'записей на рассадку' }, { key: 'cls', label: 'разных рассадок' }]);
    let classes = [];
    function build() {
      const rest = perms(U.range(s.n - 1, 1));
      classes = rest.filter((r) => !s.mirror || r.length < 2 || r[0] < r[r.length - 1]).map((r) => [0, ...r]);
    }
    function reset() {
      build();
      s.cls = 0;
      pl.stop();
      pl.setMax(classes.length - 1);
      pl.set(0);
      draw();
    }
    function circle(seq, size, hl) {
      const R = size * 0.36;
      const c = size / 2;
      const svg = S('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, style: 'display:block' });
      svg.appendChild(S('circle', { cx: c, cy: c, r: R * 0.62, style: 'fill:var(--surface-2);stroke:var(--border-strong);stroke-width:1.5' }));
      seq.forEach((g, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / seq.length;
        const x = c + R * Math.cos(a);
        const y = c + R * Math.sin(a);
        const rr = size > 120 ? 17 : 10;
        svg.appendChild(S('circle', { cx: x, cy: y, r: rr, style: 'fill:' + tint(cvar(g), 40) + ';stroke:' + cvar(g) + ';stroke-width:2' }));
        svg.appendChild(sText(x, y, LET[g], { size: size > 120 ? 15 : 10, bold: true, mono: true }));
      });
      if (hl) svg.appendChild(S('rect', { x: 1, y: 1, width: size - 2, height: size - 2, rx: 10, style: 'fill:none;stroke:var(--c-orange);stroke-width:2' }));
      return svg;
    }
    function draw() {
      const n = s.n;
      const rep = classes[s.cls];
      bigBox.replaceChildren(circle(rep, 220, false));
      minis.textContent = '';
      const recs = [];
      for (let r = 0; r < n; r++) recs.push(rep.slice(r).concat(rep.slice(0, r)));
      if (s.mirror && n >= 3) for (let r = 0; r < n; r++) recs.push(recs[r].slice().reverse());
      recs.forEach((q, i) => {
        const box = H('div', { style: 'display:flex;flex-direction:column;align-items:center' }, circle(q, 74, i === 0), H('span', { style: 'font-family:var(--font-mono);font-size:.7rem;color:var(--ink-2)' }, q.map((g) => LET[g]).join('')));
        minis.appendChild(box);
      });
      miniHead.textContent = 'Одна и та же рассадка — ' + recs.length + ' ' + plural(recs.length, 'запись', 'записи', 'записей') + ' в ряд (место 1 — сверху, дальше по часовой стрелке)' + (s.mirror ? ': ' + n + ' поворотов и ' + n + ' зеркальных отражений' : ': ' + n + ' поворотов') + '.';
      const per = s.mirror ? 2 * n : n;
      st.set('all', n + '! = ' + fact(n));
      st.set('per', String(per));
      st.set('cls', fact(n) + ' / ' + per + ' = ' + classes.length);
      note.innerHTML = '<b>Правило деления:</b> если каждый интересующий нас объект посчитан ровно ' + per + ' раз, делим на ' + per + '. Записей в ряд n! = ' + fact(n) + ', каждая рассадка встречается среди них ' + per + ' раз, значит, рассадок ' + (s.mirror ? '(n − 1)!/2' : '(n − 1)!') + ' = ' + classes.length + '. Тот же приём: рукопожатий у n человек n(n − 1)/2 — упорядоченных пар n(n − 1), и каждое рукопожатие посчитано дважды. Главное — убедиться, что <em>каждый</em> объект посчитан одинаковое число раз; с симметричными бусами одного цвета это уже не так, и простое деление ошибается.';
    }
    w.pythonAction(() => 'from itertools import permutations\nfrom math import factorial\n\nn, mirror = ' + s.n + ', ' + (s.mirror ? 'True' : 'False') + '\n\ndef canon(seq):\n    """Каноническая запись рассадки: минимум по всем поворотам (и отражениям)."""\n    seqs = [seq, seq[::-1]] if mirror else [seq]\n    return min(q[i:] + q[:i] for q in seqs for i in range(len(q)))\n\nseatings = {canon(p) for p in permutations(range(n))}\nprint("записей:", factorial(n), " рассадок:", len(seatings), "=", factorial(n - 1) // (2 if mirror else 1))\n');
    build();
    pl.setMax(classes.length - 1);
    draw();
  });

  /* ==============================================================================
   * 6. Сетка гиперпараметров: правило произведения в ML
   * ============================================================================== */
  GBC.widget('grid-count', (el) => {
    const P = [
      { name: 'learning_rate', short: 'lr', vals: [0.01, 0.03, 0.05, 0.1, 0.2, 0.3], v: 4 },
      { name: 'max_depth', short: 'depth', vals: [2, 3, 4, 5, 6, 8], v: 4 },
      { name: 'n_estimators', short: 'trees', vals: [100, 200, 300, 500, 1000, 2000], v: 3 },
      { name: 'subsample', short: 'subs.', vals: [0.5, 0.6, 0.7, 0.8, 1.0], v: 3 },
      { name: 'colsample', short: 'cols.', vals: [0.5, 0.6, 0.7, 0.8, 1.0], v: 1 },
    ];
    const s = { folds: 5, sec: 2 };
    const w = ui.shell(el, { title: 'Сетка гиперпараметров: сколько обучений?', sub: 'Поиск по сетке (grid search) перебирает все сочетания значений. Добавляйте значения и смотрите, как растёт число обучений (шкала логарифмическая).' });
    P.forEach((p) => ui.slider(w.controls, { label: p.name.replace('_', '_​') + ': значений', min: 1, max: p.vals.length, step: 1, value: p.v, format: String, onInput: (v) => ((p.v = v), draw()) }));
    ui.slider(w.controls, { label: 'Фолдов кросс-валидации', values: [1, 3, 5, 10], value: s.folds, format: String, onInput: (v) => ((s.folds = v), draw()) });
    ui.slider(w.controls, { label: 'Секунд на одно обучение', values: [0.5, 1, 2, 5, 10, 30], value: s.sec, format: (v) => v + ' с', onInput: (v) => ((s.sec = v), draw()) });
    const fy = (v) => (v < 1e4 ? String(v) : '10' + sup(Math.round(Math.log10(v))));
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'добавляем параметр за параметром', domain: [0.5, 6.5], ticks: [] }, y: { label: 'число вариантов', type: 'log', domain: [1, 3e5], ticks: [1, 10, 100, 1000, 1e4, 1e5], format: fy } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'комбинаций' }, { key: 'f', label: 'обучений' }, { key: 't', label: 'время' }]);
    const dur = (sec) => (sec < 60 ? U.fmt(sec, 3) + ' с' : sec < 3600 ? U.fmt(sec / 60, 3) + ' мин' : sec < 86400 ? U.fmt(sec / 3600, 3) + ' ч' : U.fmt(sec / 86400, 3) + ' сут');
    function draw() {
      const cum = [];
      let c = 1;
      P.forEach((p) => cum.push((c *= p.v)));
      const fits = c * s.folds;
      const xs = [1, 2, 3, 4, 5, 6];
      const ys = [...cum, fits];
      const names = [...P.map((p) => p.short), '×фолды'];
      plot.render([
        { type: 'line', x: xs, y: ys, color: 'model', width: 2, label: 'вариантов', hover: false },
        { type: 'points', x: xs, y: ys, color: (i) => (i === 5 ? 'tree' : 'model'), r: 5, tooltip: (i) => [['этап', names[i]], ['вариантов', num(ys[i])]] },
        { type: 'text', items: xs.map((x, i) => ({ x, y: ys[i], dy: -12, anchor: 'middle', text: num(ys[i]) })) },
        { type: 'text', items: xs.map((x, i) => ({ x, y: 1.6, anchor: 'middle', text: names[i] })) },
      ]);
      st.set('c', P.map((p) => p.v).join(' · ') + ' = ' + num(c));
      st.set('f', num(fits));
      st.set('t', dur(fits * s.sec));
      note.innerHTML = 'Каждый новый параметр <b>умножает</b> число вариантов на число своих значений — это правило произведения. Пять параметров по 4–5 значений и 5 фолдов — уже тысячи обучений. Поэтому вместо полной сетки берут <b>случайный поиск</b> или Optuna с фиксированным бюджетом (урок 11.2, урок 15.15, шаги 6–7): бюджет растёт линейно, а не как произведение.';
    }
    w.pythonAction(() => {
      const g = P.map((p) => '    "' + p.name + '": [' + p.vals.slice(0, p.v).map(py).join(', ') + '],').join('\n');
      return 'from itertools import product\n\ngrid = {\n' + g + '\n}\nfolds = ' + s.folds + '\ncombos = list(product(*grid.values()))\nprint(len(combos), "комбинаций ×", folds, "фолдов =", len(combos) * folds, "обучений")\nprint("первые три:", combos[:3])\n';
    });
    draw();
  });

  /* ==============================================================================
   * 7. Кандидаты в разбиения: точный перебор против гистограмм
   * ============================================================================== */
  GBC.widget('split-candidates', (el) => {
    const s = { n: 1e5, p: 20, B: 256, d: 6 };
    const w = ui.shell(el, { title: 'Сколько разбиений проверяет дерево', sub: 'У числового признака с n разными значениями n − 1 порогов, у p признаков — p(n − 1) кандидатов на узел. Гистограмма из B корзин оставляет не больше B − 1 порогов. Считаем по уровням дерева (узлы одного уровня делят объекты между собой поровну).' });
    ui.slider(w.controls, { label: 'Объектов n', values: [100, 1000, 1e4, 1e5, 1e6, 1e7], value: s.n, format: num, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Признаков p', values: [1, 5, 10, 20, 50, 100, 500], value: s.p, format: String, onInput: (v) => ((s.p = v), draw()) });
    ui.slider(w.controls, { label: 'Корзин гистограммы B (max_bin)', values: [16, 32, 64, 128, 256, 1024], value: s.B, format: String, onInput: (v) => ((s.B = v), draw()) });
    ui.slider(w.controls, { label: 'Глубина дерева d', min: 1, max: 12, step: 1, value: s.d, format: String, onInput: (v) => ((s.d = v), draw()) });
    const fy = (v) => '10' + sup(Math.round(Math.log10(v)));
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'уровень дерева l (2ˡ узлов)' }, y: { label: 'кандидатов на уровне', type: 'log', format: fy } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'в корне: точно / гистограмма' }, { key: 'te', label: 'за дерево точно' }, { key: 'th', label: 'за дерево с гистограммой' }, { key: 'x', label: 'выигрыш' }]);
    function levels() {
      const out = [];
      for (let l = 0; l < s.d; l++) {
        const nodes = Math.pow(2, l);
        const per = s.n / nodes;
        if (per < 2) break;
        out.push({ l, exact: s.p * (s.n - nodes), hist: nodes * s.p * Math.min(Math.floor(per) - 1, s.B - 1) });
      }
      return out;
    }
    function draw() {
      const L = levels();
      const xs = L.map((o) => o.l);
      const ex = L.map((o) => o.exact);
      const hi = L.map((o) => o.hist);
      const all = ex.concat(hi).filter((v) => v > 0);
      const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...all))));
      const top = Math.pow(10, Math.ceil(Math.log10(Math.max(...all)) + 0.3));
      const ticks = [];
      for (let v = lo; v <= top; v *= 10) ticks.push(v);
      plot.opts.y = Object.assign({}, plot.opts.y, { ticks: ticks.length > 8 ? ticks.filter((_, i) => i % 2 === 0) : ticks });
      plot.render([
        { type: 'line', x: xs, y: ex, color: 'model', width: 2, label: 'точный перебор p(n − 2ˡ)', hover: false },
        { type: 'points', x: xs, y: ex, color: 'model', r: 4.5, tooltip: (i) => [['уровень', String(xs[i])], ['точно', num(ex[i])], ['гистограмма', num(hi[i])]] },
        { type: 'line', x: xs, y: hi, color: 'tree', width: 2, label: 'гистограмма 2ˡ·p·(B − 1)', hover: false },
        { type: 'points', x: xs, y: hi, color: 'tree', r: 4.5, tooltip: (i) => [['уровень', String(xs[i])], ['гистограмма', num(hi[i])]] },
      ], { x: [-0.4, Math.max(1, xs.length - 1) + 0.4], y: [lo, top] });
      const te = U.sum(ex);
      const th = U.sum(hi);
      st.set('r', num(ex[0]) + ' / ' + num(hi[0]));
      st.set('te', num(te));
      st.set('th', num(th));
      st.set('x', '×' + U.fmt(te / th, te / th < 10 ? 2 : 0));
      note.innerHTML = 'На уровне l узлов 2<sup>l</sup>, и в узле с n<sub>i</sub> объектами n<sub>i</sub> − 1 порогов: вместе ∑(n<sub>i</sub> − 1) = n − 2<sup>l</sup> на признак — точный перебор почти не дешевеет с глубиной. Гистограмма даёт каждому узлу не больше B − 1 порогов: в корне это ' + num(s.p * (s.B - 1)) + ' кандидатов вместо ' + num(ex[0]) + '. Глубже узлов становится много, и выигрыш тает: когда в узле меньше B объектов, гистограмма ничего не экономит (кривые сходятся). Честная оговорка: чтобы <em>построить</em> гистограммы, всё равно нужен проход по n·p значениям; экономится перебор порогов и сортировка (урок 8.3).' + (L.length < s.d ? ' Уровни глубже ' + (L.length - 1) + ' не показаны: в узлах осталось меньше двух объектов.' : '');
    }
    w.pythonAction(() => 'n, p, B, d = ' + s.n + ', ' + s.p + ', ' + s.B + ', ' + s.d + '\nexact = hist = 0\nfor l in range(d):\n    nodes = 2**l\n    if n // nodes < 2:\n        break\n    e, h = p * (n - nodes), nodes * p * min(n // nodes - 1, B - 1)\n    exact, hist = exact + e, hist + h\n    print(f"уровень {l}: точно {e:,}  гистограмма {h:,}")\nprint(f"за дерево: {exact:,} против {hist:,} (в {exact / hist:.1f} раза меньше)")\n');
    draw();
  });

  /* ==============================================================================
   * 8. Перестановки и факториал
   * ============================================================================== */
  const nthPerm = (n, k) => {
    const pool = LET.slice(0, n).split('');
    const out = [];
    let r = k;
    for (let i = n; i >= 1; i--) {
      const f = fact(i - 1);
      const j = Math.floor(r / f);
      out.push(pool.splice(j, 1)[0]);
      r %= f;
    }
    return out;
  };
  GBC.widget('permutations', (el) => {
    const s = { n: 4, idx: 0 };
    const w = ui.shell(el, { title: 'Перестановки: сколькими способами выстроить n предметов', sub: 'На первое место — любой из n, на второе — любой из оставшихся n − 1, … Плеер перебирает все перестановки в алфавитном порядке; строка под плитками показывает выбор на каждом этапе.' });
    ui.slider(w.controls, { label: 'Предметов n', min: 1, max: 6, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), pl.stop(), pl.setMax(fact(v) - 1), pl.set(0), (s.idx = 0), draw()) });
    const pl = ui.player(w.controls, { label: 'Перестановка', min: 0, max: fact(s.n) - 1, value: 0, fps: 3, format: (k, m) => k + 1 + ' из ' + (m + 1), onChange: (k) => ((s.idx = k), draw()) });
    const tiles = flexRow('justify-content:center;gap:8px;padding:10px 0');
    const stages = flexRow('justify-content:center;gap:8px;font-family:var(--font-mono);font-size:.85rem;color:var(--ink-2)');
    const list = monoBox('font-size:.8rem;color:var(--ink-2)');
    w.main.append(tiles, stages, list);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'n!' }, { key: 'pos', label: 'номер перестановки' }]);
    function draw() {
      const n = s.n;
      const p = nthPerm(n, s.idx);
      tiles.textContent = '';
      p.forEach((c) => tiles.appendChild(tile(c, LET.indexOf(c), { size: 2.6, font: 1.25, on: true })));
      stages.textContent = '';
      // Номер выбора на каждом этапе (смешанная система счисления).
      let r = s.idx;
      U.range(n).forEach((i) => {
        const f = fact(n - 1 - i);
        const j = Math.floor(r / f);
        r %= f;
        stages.appendChild(H('span', { style: 'padding:2px 8px;border:1px solid var(--border);border-radius:8px' }, 'место ' + (i + 1) + ': ' + (j + 1) + '-й из ' + (n - i)));
      });
      const done = [];
      const from = Math.max(0, s.idx - 29);
      for (let k = from; k <= s.idx; k++) done.push(nthPerm(n, k).join(''));
      list.textContent = 'Перечислено: ' + (from > 0 ? '… ' : '') + done.join(' ');
      st.set('f', U.range(n, 1).reverse().join(' · ') + ' = ' + num(fact(n)));
      st.set('pos', String(s.idx + 1));
      note.innerHTML = 'На место 1 — любой из n предметов, на место 2 — любой из n − 1 оставшихся, …, на последнее — единственный оставшийся. Набор «номеров выборов» (строка под плитками) — это запись номера перестановки в <b>смешанной системе счисления</b> с основаниями n, n − 1, …, 1: каждая перестановка получает ровно один номер от 1 до n!. Так перестановку можно закодировать числом и восстановить без перебора. По определению 0! = 1: пустой ряд можно составить одним способом.';
    }
    w.pythonAction(() => 'from itertools import permutations\nfrom math import factorial\n\nitems = "' + LET.slice(0, s.n) + '"\nall_p = ["".join(p) for p in permutations(items)]\nprint(len(all_p), "=", factorial(len(items)))\nprint("перестановка №' + (s.idx + 1) + ':", all_p[' + s.idx + '])\n');
    draw();
  });

  /* ==============================================================================
   * 9. Насколько велик n!: Стирлинг, число цифр, нули в конце
   * ============================================================================== */
  GBC.widget('factorial-size', (el) => {
    const NS = [1, 2, 3, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30, 40, 52, 60, 70, 100, 200, 500, 1000, 2000, 5000, 10000, 100000, 1000000];
    const s = { n: 52 };
    const w = ui.shell(el, { title: 'Насколько велик n!', sub: 'Факториал растёт быстрее любой показательной функции. Сколько у n! цифр, сколько нулей в конце и насколько точна формула Стирлинга?' });
    ui.slider(w.controls, { label: 'n', values: NS, value: s.n, format: num, onInput: (v) => ((s.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'n', domain: [0, 60] }, y: { label: 'десятичных цифр (log₁₀ значения)', domain: [0, 110] } });
    const digitsEl = monoBox('font-size:.8rem;color:var(--ink-2)');
    w.main.appendChild(digitsEl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'n!' }, { key: 'd', label: 'цифр' }, { key: 'z', label: 'нулей в конце' }, { key: 's', label: 'ошибка Стирлинга' }, { key: 's2', label: 'с поправкой 1 + 1/(12n)' }]);
    const xs = U.range(60, 1);
    const l10f = (n) => lnFact(n) / Math.LN10;
    const zeros = (n) => {
      let z = 0;
      const parts = [];
      for (let p = 5; p <= n; p *= 5) {
        z += Math.floor(n / p);
        parts.push('⌊' + n + '/' + p + '⌋');
      }
      return { z, parts };
    };
    function draw() {
      const n = s.n;
      const l10 = l10f(n);
      const digits = n <= 1000 ? factB(n).toString().length : Math.floor(l10) + 1;
      // ln(Стирлинг) − ln n! — ошибка считается в логарифмах, чтобы не переполняться.
      const lnSt = 0.5 * Math.log(2 * Math.PI * n) + n * (Math.log(n) - 1);
      const err = 1 - Math.exp(lnSt - lnFact(n));
      const err2 = 1 - Math.exp(lnSt + Math.log1p(1 / (12 * n)) - lnFact(n));
      const L = [
        { type: 'line', x: xs, y: xs.map((x) => x * Math.log10(2)), color: 'aqua', width: 2, label: '2ⁿ', hover: false },
        { type: 'line', x: xs, y: xs.map((x) => l10f(x)), color: 'model', width: 2.4, label: 'n!', hover: false },
        { type: 'line', x: xs, y: xs.map((x) => x * Math.log10(x)), color: 'tree', width: 2, label: 'nⁿ', dash: '6 4', hover: false },
        { type: 'hline', y: 80, color: 'ink2', dash: '4 4', width: 1, text: 'атомов во Вселенной ≈ 10⁸⁰' },
      ];
      if (n <= 60) L.push({ type: 'points', x: [n], y: [l10], color: 'model', r: 6, tooltip: () => [['n', String(n)], ['цифр n!', String(digits)]] });
      plot.render(L);
      const z = zeros(n);
      if (n <= 200) {
        const str = factB(n).toString();
        digitsEl.textContent = n + '! = ' + grp(str);
      } else {
        const e = Math.floor(l10);
        digitsEl.textContent = n + '! ≈ ' + U.fmt(Math.pow(10, l10 - e), 4) + ' · 10^' + e + ' (полная запись не показана: ' + num(digits) + ' цифр)';
      }
      st.set('v', numLog10(l10));
      st.set('d', num(digits));
      st.set('z', num(z.z));
      st.set('s', pct(err, err < 0.001 ? 4 : 2));
      const e10 = Math.floor(Math.log10(Math.abs(err2)));
      st.set('s2', Math.abs(err2) < 1e-12 ? '< 10⁻¹²' : Math.abs(err2) >= 1e-3 ? pct(err2, 2) : U.fmt(err2 / Math.pow(10, e10), 2) + '·10' + sup(e10));
      note.innerHTML = 'Число цифр n! — это ⌊log<sub>10</sub> n!⌋ + 1, а log<sub>10</sub> n! = log<sub>10</sub> 1 + log<sub>10</sub> 2 + … + log<sub>10</sub> n — сумма, а не огромное произведение. Так факториалы и считают на практике: <code>math.lgamma(n + 1)</code> = ln n!. На графике n! (синяя) обгоняет любую степень 2<sup>n</sup>, но отстаёт от n<sup>n</sup>. <b>Формула Стирлинга</b> √(2πn)·(n/e)<sup>n</sup> занижает n! примерно на 1/(12n): сейчас ' + pct(err, 3) + '; множитель 1 + 1/(12n) почти убирает ошибку. <b>Нули в конце</b> дают пары 2·5, а пятёрок меньше, чем двоек: ' + (z.parts.length ? z.parts.join(' + ') + ' = ' + z.z : '0') + ' (формула Лежандра).';
    }
    w.pythonAction(() => 'import math\n\nn = ' + s.n + '\nl10 = math.lgamma(n + 1) / math.log(10)\nprint("цифр в n!:", int(l10) + 1' + (s.n <= 5000 ? ', len(str(math.factorial(n)))' : '') + ')\nstirling = 0.5 * math.log(2 * math.pi * n) + n * (math.log(n) - 1)\nprint("ошибка Стирлинга:", 1 - math.exp(stirling - math.lgamma(n + 1)), " 1/(12n) =", 1 / (12 * n))\nzeros, p = 0, 5\nwhile p <= n:\n    zeros, p = zeros + n // p, p * 5\nprint("нулей в конце:", zeros)\n');
    draw();
  });

  /* ==============================================================================
   * 10. Размещения: пьедестал
   * ============================================================================== */
  function nthArr(n, k, idx) {
    const pool = U.range(n);
    const out = [];
    let r = idx;
    for (let i = 0; i < k; i++) {
      const rest = perm(n - i - 1, k - i - 1);
      const j = Math.floor(r / rest);
      r %= rest;
      out.push(pool.splice(j, 1)[0]);
    }
    return out;
  }
  GBC.widget('podium', (el) => {
    const s = { n: 8, k: 3, idx: 0 };
    const w = ui.shell(el, { title: 'Размещения: кто займёт k призовых мест', sub: 'Из n бегунов выбираем победителей на k мест. Порядок важен: «A первый, B второй» и «B первый, A второй» — разные исходы. Каждое следующее место — на одного кандидата меньше.' });
    const reset = () => {
      s.k = Math.min(s.k, s.n);
      cK.setMax(s.n);
      s.idx = 0;
      pl.stop();
      pl.setMax(Math.max(0, Math.min(perm(s.n, s.k), 5040) - 1));
      pl.set(0);
      draw();
    };
    ui.slider(w.controls, { label: 'Бегунов n', min: 2, max: 10, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), reset()) });
    const cK = ui.slider(w.controls, { label: 'Призовых мест k', min: 1, max: 10, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = Math.min(v, s.n)), reset()) });
    const pl = ui.player(w.controls, { label: 'Исход', min: 0, max: perm(s.n, s.k) - 1, value: 0, fps: 3, format: (k, m) => k + 1 + ' из ' + (m + 1), onChange: (k) => ((s.idx = k), draw()) });
    const field = flexRow('justify-content:center;gap:6px;padding:6px 0');
    const pod = flexRow('justify-content:center;align-items:flex-end;gap:10px;padding:10px 0');
    const eq = texEl('', true);
    w.main.append(field, pod, eq);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'A(n, k)' }, { key: 'f', label: 'n!/(n − k)!' }, { key: 'c', label: 'без учёта порядка C(n, k)' }]);
    function draw() {
      const { n, k } = s;
      const cur = nthArr(n, k, s.idx);
      field.textContent = '';
      U.range(n).forEach((i) => field.appendChild(tile(LET[i], i, { dim: cur.includes(i) })));
      pod.textContent = '';
      cur.forEach((g, i) => {
        const hgt = Math.max(30, 90 - i * 14);
        pod.appendChild(H('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:4px' },
          tile(LET[g], g, { on: true, size: 2.4 }),
          H('div', { style: 'width:62px;height:' + hgt + 'px;border-radius:8px 8px 0 0;background:var(--surface-2);border:1px solid var(--border-strong);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:.8rem;color:var(--ink-2)' }, H('b', { style: 'color:var(--ink);font-size:1rem' }, String(i + 1)), 'из ' + (n - i))));
      });
      texInto(eq, 'A_{' + n + '}^{' + k + '} = ' + U.range(k).map((i) => n - i).join(' \\cdot ') + ' = ' + num(perm(n, k)).replace(/\u00a0/g, '\\,'), true);
      st.set('a', num(perm(n, k)));
      st.set('f', n + '!/' + (n - k) + '! = ' + num(perm(n, k)));
      st.set('c', num(comb(n, k)));
      note.innerHTML = '<b>Размещения</b> (arrangements, k-перестановки): упорядоченные выборки k из n без повторений. Это правило произведения на k этапах: n·(n − 1)·…·(n − k + 1) — то же, что n!, но оборванное после k множителей; поэтому A<sub>n</sub><sup>k</sup> = n!/(n − k)!. При k = n получаем все перестановки n!. Плеер перебирает исходы' + (perm(n, k) > 5040 ? ' (первые 5040 из ' + num(perm(n, k)) + ')' : '') + '. Если порядок мест не важен (просто «тройка призёров»), исходов в k! = ' + fact(k) + ' раз меньше — это сочетания (шаг 10).';
    }
    w.pythonAction(() => 'from itertools import permutations\nfrom math import perm, factorial\n\nn, k = ' + s.n + ', ' + s.k + '\nrunners = "' + LET.slice(0, s.n) + '"\npodiums = list(permutations(runners, k))\nprint(len(podiums), "=", perm(n, k), "=", factorial(n) // factorial(n - k))\nprint("исход №' + (s.idx + 1) + ':", podiums[' + Math.min(s.idx, perm(s.n, s.k) - 1) + '])\n');
    draw();
  });

  /* ==============================================================================
   * 11. От размещений к сочетаниям: группы по k! записей
   * ============================================================================== */
  GBC.widget('group-arrangements', (el) => {
    const s = { n: 5, k: 3, row: 0 };
    const w = ui.shell(el, { title: 'Сочетания: размещения, сгруппированные по составу', sub: 'Выпишем все размещения k из n и сложим в одну строку те, у которых одинаковый состав. В каждой строке ровно k! записей, а строк — C(n, k).' });
    const reset = () => {
      s.k = Math.min(s.k, s.n);
      s.row = 0;
      pl.stop();
      pl.setMax(comb(s.n, s.k) - 1);
      pl.set(0);
      draw();
    };
    ui.slider(w.controls, { label: 'Предметов n', min: 2, max: 6, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), reset()) });
    ui.slider(w.controls, { label: 'Выбираем k', min: 1, max: 4, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Состав', min: 0, max: comb(s.n, s.k) - 1, value: 0, fps: 1.5, format: (k, m) => k + 1 + ' из ' + (m + 1), onChange: (k) => ((s.row = k), draw()) });
    const tbl = scrollBox();
    const eq = texEl('', true);
    w.main.append(tbl, eq);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'размещений A(n, k)' }, { key: 'kf', label: 'в строке k!' }, { key: 'c', label: 'строк C(n, k)' }]);
    function draw() {
      const { n, k } = s;
      const kk = Math.min(k, n);
      const cs = combos(n, kk);
      const t = H('table', { class: 'data', style: 'font-family:var(--font-mono);font-size:.8rem' });
      const head = H('tr', null, H('th', null, 'состав'), ...U.range(fact(kk)).map((i) => H('th', null, String(i + 1))));
      t.appendChild(H('thead', null, head));
      const tb = H('tbody');
      cs.forEach((c, r) => {
        const tr = H('tr', { style: r === s.row ? 'background:' + tint('var(--c-orange)', 18) : '' }, H('td', { style: 'font-weight:700' }, '{' + c.map((i) => LET[i]).join(', ') + '}'), ...perms(c).map((p) => H('td', null, p.map((i) => LET[i]).join(''))));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      tbl.replaceChildren(t);
      texInto(eq, '\\binom{' + n + '}{' + kk + '} = \\frac{A_{' + n + '}^{' + kk + '}}{' + kk + '!} = \\frac{' + perm(n, kk) + '}{' + fact(kk) + '} = ' + comb(n, kk) + ' = \\frac{' + n + '!}{' + kk + '!\\,' + (n - kk) + '!}', true);
      st.set('a', String(perm(n, kk)));
      st.set('kf', kk + '! = ' + fact(kk));
      st.set('c', String(comb(n, kk)));
      note.innerHTML = 'Таблица — это все ' + perm(n, kk) + ' размещений. В строке {' + cs[s.row].map((i) => LET[i]).join(', ') + '} — все ' + fact(kk) + ' способов упорядочить один и тот же состав. Если порядок не важен, строка — <b>один</b> объект, поэтому делим: C(n, k) = A(n, k)/k!. Это правило деления из шага 5: каждый набор посчитан ровно k! раз. Обозначения: в русских учебниках C<sub>n</sub><sup>k</sup>, в мировой литературе и в Python — <code>comb(n, k)</code>, «из n по k».';
    }
    w.pythonAction(() => 'from itertools import combinations, permutations\nfrom math import comb, factorial, perm\n\nn, k = ' + s.n + ', ' + Math.min(s.k, s.n) + '\nitems = "' + LET.slice(0, s.n) + '"\nfor c in combinations(items, k):\n    print("".join(c), "→", ["".join(p) for p in permutations(c)])\nprint(perm(n, k), "/", factorial(k), "=", comb(n, k))\n');
    draw();
  });

  /* ==============================================================================
   * 12. Анаграммы: перестановки с повторениями
   * ============================================================================== */
  GBC.widget('anagrams', (el) => {
    const WORDS = ['МАМА', 'ДЕРЕВО', 'ПАПАХА', 'МИССИСИПИ', 'КОМБИНАТОРИКА', 'БУСТИНГ'];
    const s = { word: 'МАМА', custom: false, a: 3, b: 2, c: 1 };
    const w = ui.shell(el, { title: 'Анаграммы: перестановки с повторениями', sub: 'Сколько разных слов можно составить, переставляя буквы? Одинаковые буквы неразличимы: перестановки внутри группы одинаковых букв слово не меняют.' });
    ui.select(w.controls, { label: 'Слово', value: s.word, options: WORDS.map((x) => ({ value: x, label: x })).concat([{ value: '*', label: 'свой набор A, B, C' }]), onChange: (v) => ((s.custom = v === '*'), v !== '*' && (s.word = v), sync(), draw()) });
    const cs = ['a', 'b', 'c'].map((key, i) => ui.slider(w.controls, { label: 'Копий буквы ' + 'ABC'[i], min: 0, max: 5, step: 1, value: s[key], format: String, onInput: (v) => ((s[key] = v), draw()) }));
    const lettersEl = flexRow('justify-content:center;padding:6px 0');
    const eq = texEl('', true);
    const idxEl = H('div');
    const list = monoBox('font-size:.82rem;color:var(--ink-2)');
    w.main.append(lettersEl, eq, idxEl, list);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'букв' }, { key: 'all', label: 'перестановок n!' }, { key: 'd', label: 'разных слов' }]);
    function sync() {
      cs.forEach((c) => (c.el.style.display = s.custom ? '' : 'none'));
    }
    const current = () => (s.custom ? 'A'.repeat(s.a) + 'B'.repeat(s.b) + 'C'.repeat(s.c) : s.word);
    function draw() {
      const word = current();
      const chars = word.split('');
      const cnt = new Map();
      chars.forEach((ch) => cnt.set(ch, (cnt.get(ch) || 0) + 1));
      const keys = [...cnt.keys()];
      lettersEl.textContent = '';
      keys.forEach((ch, i) => lettersEl.appendChild(H('span', { style: 'display:inline-flex;align-items:center;gap:4px;margin:0 6px' }, tile(ch, i, { on: cnt.get(ch) > 1 }), H('span', { style: 'font-family:var(--font-mono);color:var(--ink-2)' }, '×' + cnt.get(ch)))));
      const n = chars.length;
      const total = n ? factB(n) / [...cnt.values()].reduce((acc, v) => acc * factB(v), 1n) : 1n;
      const denom = [...cnt.entries()].filter(([, v]) => v > 1);
      texInto(eq, n === 0 ? '\\text{пустое слово — одна перестановка}' : '\\frac{' + n + '!}{' + (denom.length ? denom.map(([, v]) => v + '!').join('\\,') : '1') + '} = \\frac{' + fmtB(factB(n)).replace(/\u00a0/g, '\\,') + '}{' + fmtB(factB(n) / total).replace(/\u00a0/g, '\\,') + '} = ' + fmtB(total).replace(/\u00a0/g, '\\,'), true);
      idxEl.textContent = '';
      const rep = denom.reduce((acc, [, v]) => acc * fact(v), 1);
      if (n && rep > 1 && rep <= 24 && n <= 9) {
        // Пометим копии индексами и покажем все записи одного слова.
        const seen = new Map();
        const labeled = chars.map((ch) => {
          const j = (seen.get(ch) || 0) + 1;
          seen.set(ch, j);
          return { ch, j, many: cnt.get(ch) > 1 };
        });
        const groups = keys.filter((ch) => cnt.get(ch) > 1).map((ch) => perms(labeled.filter((o) => o.ch === ch).map((o) => o.j)));
        const variants = [];
        (function rec(gi, chosen) {
          if (gi === groups.length) {
            const ptr = new Map();
            variants.push(labeled.map((o) => {
              if (!o.many) return o.ch;
              const gIdx = keys.filter((ch) => cnt.get(ch) > 1).indexOf(o.ch);
              const k = ptr.get(o.ch) || 0;
              ptr.set(o.ch, k + 1);
              return o.ch + '₀₁₂₃₄₅'[chosen[gIdx][k]];
            }).join(''));
            return;
          }
          groups[gi].forEach((p) => rec(gi + 1, chosen.concat([p])));
        })(0, []);
        const c = card('Одно слово «' + word + '» — ' + rep + ' ' + plural(rep, 'запись', 'записи', 'записей') + ' с индексами');
        const r = flexRow('gap:4px');
        variants.forEach((v) => r.appendChild(H('span', { style: 'font-family:var(--font-mono);font-size:.82rem;padding:1px 6px;border:1px solid var(--border);border-radius:6px' }, v)));
        c.body.appendChild(r);
        idxEl.appendChild(c.el);
      }
      const show = total <= 2000n ? multisetPerms(chars, 2000) : multisetPerms(chars, 120);
      list.textContent = (total <= 2000n ? 'Все слова (' + show.length + '): ' : 'Первые 120 из ' + fmtB(total) + ': ') + show.slice(0, 400).map((p) => p.join('')).join(' ') + (show.length > 400 ? ' …' : '');
      st.set('n', String(n));
      st.set('all', fmtB(factB(n)));
      st.set('d', fmtB(total));
      note.innerHTML = 'Пометим одинаковые буквы индексами (М₁А₁М₂А₂) — тогда все n! перестановок различны. Сотрём индексы: каждое слово получилось из n<sub>1</sub>!·n<sub>2</sub>!·… записей, которые отличаются только порядком одинаковых букв. Делим — получаем <b>мультиномиальный коэффициент</b> n!/(n<sub>1</sub>!·n<sub>2</sub>!·…·n<sub>m</sub>!). Две буквы, A и B, дают обычное сочетание C(n, n<sub>A</sub>): слово задаётся выбором мест для A. Тот же счёт в ML: сколькими способами разложить n объектов по фолдам заданных размеров (шаг 35).';
    }
    w.pythonAction(() => 'from collections import Counter\nfrom itertools import permutations\nfrom math import factorial, prod\n\nword = "' + current() + '"\ncnt = Counter(word)\nformula = factorial(len(word)) // prod(factorial(v) for v in cnt.values())\nprint(dict(cnt), "→", formula, "разных слов")\n' + (current().length <= 8 ? 'print("перебор:", len(set(permutations(word))))\n' : ''));
    sync();
    draw();
  });

  /* ==============================================================================
   * 13. Пути по решётке
   * ============================================================================== */
  GBC.widget('lattice-paths', (el) => {
    const s = { m: 4, n: 3, blocked: new Set(), idx: 0 };
    const w = ui.shell(el, { title: 'Пути по решётке: только вправо и вверх', sub: 'Из левого нижнего угла в правый верхний, шагая вправо (R) и вверх (U). Путь — это слово из m букв R и n букв U, поэтому путей C(m + n, n). Щёлкайте по узлам, чтобы перекрыть их: числа в узлах — сколько путей ведёт в узел (сумма слева и снизу).' });
    const reset = () => {
      s.blocked.forEach((key) => {
        const [x, y] = key.split(',').map(Number);
        if (x > s.m || y > s.n) s.blocked.delete(key);
      });
      s.idx = 0;
      draw();
    };
    ui.slider(w.controls, { label: 'Шагов вправо m', min: 1, max: 7, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), reset()) });
    ui.slider(w.controls, { label: 'Шагов вверх n', min: 1, max: 6, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Путь', min: 0, max: 1, value: 0, fps: 2, format: (k, m) => k + 1 + ' из ' + (m + 1), onChange: (k) => ((s.idx = k), draw(false)) });
    ui.button(w.controls, { label: 'Снять перекрытия', icon: 'reset', onClick: () => (s.blocked.clear(), reset()) });
    const host = H('div');
    const word = monoBox('text-align:center;font-size:1rem');
    w.main.append(host, word);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'без перекрытий C(m + n, n)' }, { key: 'dp', label: 'путей сейчас' }, { key: 'w', label: 'слово пути' }]);
    function dp() {
      const T = [];
      for (let x = 0; x <= s.m; x++) {
        T.push([]);
        for (let y = 0; y <= s.n; y++) {
          if (s.blocked.has(x + ',' + y)) T[x].push(0);
          else if (x === 0 && y === 0) T[x].push(1);
          else T[x].push((x > 0 ? T[x - 1][y] : 0) + (y > 0 ? T[x][y - 1] : 0));
        }
      }
      return T;
    }
    function paths(limit = 3000) {
      const out = [];
      const cur = [];
      (function rec(x, y) {
        if (out.length >= limit) return;
        if (s.blocked.has(x + ',' + y)) return;
        if (x === s.m && y === s.n) return void out.push(cur.join(''));
        if (x < s.m) {
          cur.push('R');
          rec(x + 1, y);
          cur.pop();
        }
        if (y < s.n) {
          cur.push('U');
          rec(x, y + 1);
          cur.pop();
        }
      })(0, 0);
      return out;
    }
    function draw(rebuild = true) {
      const T = dp();
      const P = paths();
      if (rebuild) {
        pl.stop();
        pl.setMax(Math.max(0, P.length - 1));
        pl.set(Math.min(s.idx, Math.max(0, P.length - 1)));
      }
      const cell = 58;
      const pad = 30;
      const W = pad * 2 + cell * s.m;
      const Hh = pad * 2 + cell * s.n;
      host.textContent = '';
      const svg = svgBox(host, W, Hh, Math.min(W, 340), W * 1.15);
      const X = (x) => pad + x * cell;
      const Y = (y) => Hh - pad - y * cell;
      for (let x = 0; x <= s.m; x++) svg.appendChild(S('line', { x1: X(x), y1: Y(0), x2: X(x), y2: Y(s.n), style: 'stroke:var(--c-grid);stroke-width:2' }));
      for (let y = 0; y <= s.n; y++) svg.appendChild(S('line', { x1: X(0), y1: Y(y), x2: X(s.m), y2: Y(y), style: 'stroke:var(--c-grid);stroke-width:2' }));
      const path = P[s.idx];
      if (path) {
        let x = 0;
        let y = 0;
        let d = 'M' + X(0) + ',' + Y(0);
        for (const c of path) {
          if (c === 'R') x++;
          else y++;
          d += 'L' + X(x) + ',' + Y(y);
        }
        svg.appendChild(S('path', { d, style: 'fill:none;stroke:var(--c-orange);stroke-width:5;stroke-linecap:round;stroke-linejoin:round;opacity:.85' }));
      }
      for (let x = 0; x <= s.m; x++) {
        for (let y = 0; y <= s.n; y++) {
          const key = x + ',' + y;
          const blk = s.blocked.has(key);
          const end = (x === 0 && y === 0) || (x === s.m && y === s.n);
          const g = S('g', { style: end ? '' : 'cursor:pointer' });
          g.appendChild(S('circle', { cx: X(x), cy: Y(y), r: 17, style: 'fill:' + (blk ? 'var(--critical-soft)' : 'var(--surface)') + ';stroke:' + (blk ? 'var(--critical)' : end ? 'var(--c-blue)' : 'var(--border-strong)') + ';stroke-width:' + (end ? 2.5 : 1.5) }));
          g.appendChild(sText(X(x), Y(y), blk ? '×' : String(T[x][y]), { size: T[x][y] > 999 ? 10 : 12, bold: true, mono: true, color: blk ? 'var(--critical-text)' : 'var(--ink)' }));
          if (!end) {
            g.addEventListener('click', () => {
              if (blk) s.blocked.delete(key);
              else s.blocked.add(key);
              s.idx = 0;
              draw();
            });
          }
          svg.appendChild(g);
        }
      }
      word.textContent = path ? path.split('').join(' ') : 'путей нет — перекрытия отрезали угол';
      st.set('c', 'C(' + (s.m + s.n) + ', ' + s.n + ') = ' + num(comb(s.m + s.n, s.n)));
      st.set('dp', num(T[s.m][s.n]));
      st.set('w', path || '—');
      note.innerHTML = 'Каждый путь — слово из ' + s.m + ' букв R и ' + s.n + ' букв U: выбираем, на каких ' + s.n + ' из ' + (s.m + s.n) + ' мест стоят U, — это <b>биекция</b> с сочетаниями (шаг 4): C(' + (s.m + s.n) + ', ' + s.n + ') = ' + comb(s.m + s.n, s.n) + '. Числа в узлах складываются по правилу «слева + снизу» — в узел можно прийти только оттуда (правило суммы). Повернув решётку на 45°, вы увидите треугольник Паскаля (шаг 14). ' + (s.blocked.size ? 'С перекрытиями формула не работает, а сумма по узлам (динамическое программирование) — работает: путей ' + T[s.m][s.n] + '.' : 'Перекройте узел: путей станет меньше ровно на число путей через него — произведение путей «до» и «после» узла.');
    }
    w.pythonAction(() => 'from math import comb\n\nm, n = ' + s.m + ', ' + s.n + '\nblocked = {' + [...s.blocked].map((k) => '(' + k + ')').join(', ') + '}\nT = [[0] * (n + 1) for _ in range(m + 1)]\nfor x in range(m + 1):\n    for y in range(n + 1):\n        if (x, y) in blocked:\n            continue\n        T[x][y] = 1 if x == y == 0 else (T[x - 1][y] if x else 0) + (T[x][y - 1] if y else 0)\nprint("путей:", T[m][n], " без перекрытий C(m+n, n) =", comb(m + n, n))\n');
    draw();
  });

  /* ==============================================================================
   * 14. Какая формула? Порядок × повторения
   * ============================================================================== */
  GBC.widget('formula-chooser', (el) => {
    const s = { order: true, rep: false, n: 4, k: 2 };
    const w = ui.shell(el, { title: 'Какая формула? Два вопроса — четыре ответа', sub: 'Выбираем k раз из n предметов. Важен ли порядок? Можно ли брать один предмет несколько раз? Ответы определяют формулу; ниже — все варианты для текущего случая.' });
    const so = ui.segmented(w.controls, { label: 'Порядок', value: s.order, options: [{ value: true, label: 'важен' }, { value: false, label: 'не важен' }], onChange: (v) => ((s.order = v), draw()) });
    const sr = ui.segmented(w.controls, { label: 'Повторения', value: s.rep, options: [{ value: false, label: 'нельзя' }, { value: true, label: 'можно' }], onChange: (v) => ((s.rep = v), draw()) });
    ui.slider(w.controls, { label: 'Предметов n', min: 1, max: 6, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Выборов k', min: 1, max: 4, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const grid = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:8px;margin:4px 0 10px' });
    const list = monoBox('font-size:.82rem');
    w.main.append(grid, list);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'формула' }, { key: 'v', label: 'вариантов' }, { key: 'b', label: 'перебор' }]);
    const CELLS = [
      { order: true, rep: false, name: 'размещения', tex: (n, k) => 'A_n^k = \\frac{n!}{(n-k)!}', val: (n, k) => perm(n, k), story: 'k разных призов, каждому — не больше одного', py: 'permutations(items, k)' },
      { order: false, rep: false, name: 'сочетания', tex: () => '\\binom{n}{k}', val: (n, k) => comb(n, k), story: 'k одинаковых призов, каждому — не больше одного', py: 'combinations(items, k)' },
      { order: true, rep: true, name: 'слова (размещения с повторениями)', tex: () => 'n^k', val: (n, k) => Math.pow(n, k), story: 'k разных призов, можно несколько одному', py: 'product(items, repeat=k)' },
      { order: false, rep: true, name: 'сочетания с повторениями', tex: () => '\\binom{n+k-1}{k}', val: (n, k) => comb(n + k - 1, k), story: 'k одинаковых призов, можно несколько одному', py: 'combinations_with_replacement(items, k)' },
    ];
    function enumerate() {
      const { n, k } = s;
      if (s.order && !s.rep) return arrangements(n, k);
      if (!s.order && !s.rep) return combos(n, k);
      if (s.order && s.rep) return words(n, k);
      return multisets(n, k);
    }
    function draw() {
      const { n, k } = s;
      grid.textContent = '';
      CELLS.forEach((c) => {
        const on = c.order === s.order && c.rep === s.rep;
        const box = H('button', { type: 'button', style: 'text-align:left;cursor:pointer;border-radius:12px;padding:8px 10px;min-width:0;color:var(--ink);border:2px solid ' + (on ? 'var(--accent)' : 'var(--border)') + ';background:' + (on ? 'var(--accent-soft)' : 'var(--surface)') },
          H('div', { style: 'font-size:.75rem;color:var(--ink-2)' }, 'порядок ' + (c.order ? 'важен' : 'не важен') + ', повторы ' + (c.rep ? 'можно' : 'нельзя')),
          H('div', { style: 'font-weight:700;font-size:.92rem' }, c.name),
          texEl(c.tex(n, k) + ' = ' + num(c.val(n, k)).replace(/ /g, '\\,'), false, 'margin:2px 0'),
          H('div', { style: 'font-size:.75rem;color:var(--ink-2)' }, c.story));
        box.addEventListener('click', () => ((s.order = c.order), (s.rep = c.rep), so.set(c.order), sr.set(c.rep), draw()));
        grid.appendChild(box);
      });
      const cur = CELLS.find((c) => c.order === s.order && c.rep === s.rep);
      const all = enumerate();
      const fmtItem = (t) => (s.order ? t.map((i) => LET[i]).join('') : '{' + t.map((i) => LET[i]).join(',') + '}');
      list.textContent = all.length ? 'Все ' + all.length + ': ' + all.slice(0, 300).map(fmtItem).join(' ') + (all.length > 300 ? ' …' : '') : 'Вариантов нет: без повторений нельзя выбрать k > n предметов.';
      st.set('f', cur.name);
      st.set('v', num(cur.val(n, k)));
      st.set('b', num(all.length));
      note.innerHTML = 'Пример для n = ' + n + ' людей и k = ' + k + ' ' + plural(k, 'приза', 'призов', 'призов') + ': <b>' + cur.story + '</b>. Сравните клетки: порядок «важен» — значит, призы разные, и важно, кому какой; «не важен» — призы одинаковые, важно лишь, кто получил. Переход по строке таблицы (порядок → без порядка) — деление на k!, но <em>только без повторений</em>: при повторениях одно мультимножество даёт разное число слов (у {A, A} одно слово AA, у {A, B} — два: AB и BA), и простое деление ошибается. Отсюда отдельная формула звёзд и перегородок (шаг 18).';
    }
    w.pythonAction(() => {
      const cur = CELLS.find((c) => c.order === s.order && c.rep === s.rep);
      return PY_IT + '\nitems, k = "' + LET.slice(0, s.n) + '", ' + s.k + '\nres = list(' + cur.py + ')\nprint(len(res), "вариантов:", ["".join(t) for t in res[:12]])\n';
    });
    draw();
  });

  /* ==============================================================================
   * 15. Треугольник Паскаля (и его чётность)
   * ============================================================================== */
  GBC.widget('pascal', (el) => {
    const s = { n: 5, k: 2, mode: 'num' };
    const w = ui.shell(el, { title: 'Треугольник Паскаля: сочетания C(n, k)', sub: 'Строка n, место k — число способов выбрать k предметов из n. Каждое число — сумма двух над ним. Режим «нечётность» раскрашивает нечётные числа первых 32 строк.' });
    ui.segmented(w.controls, { label: 'Режим', value: s.mode, options: [{ value: 'num', label: 'числа' }, { value: 'odd', label: 'нечётность' }], onChange: (v) => ((s.mode = v), sync(), draw()) });
    const cn = ui.slider(w.controls, { label: 'n', min: 0, max: 10, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const ck = ui.slider(w.controls, { label: 'k (не больше n)', min: 0, max: 10, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const tri = new GBC.Plot(w.main, { height: 270, grid: 'none', x: { label: '', domain: [-5.7, 5.7], ticks: [] }, y: { label: '', domain: [-10.6, 0.6], ticks: [] }, margin: { left: 8, bottom: 8 } });
    const oddBox = H('div');
    w.main.appendChild(oddBox);
    const bars = new GBC.Plot(w.main, { height: 160, x: { label: 'k — число орлов в n бросках монеты', domain: [-0.6, 10.6], ticks: [0, 2, 4, 6, 8, 10] }, y: { label: 'вероятность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'C(n, k)' }, { key: 'rule', label: 'правило Паскаля' }, { key: 'sum', label: 'сумма строки' }, { key: 'p', label: 'P(k орлов)' }]);
    function sync() {
      const num_ = s.mode === 'num';
      tri.root.style.display = num_ ? '' : 'none';
      bars.root.style.display = num_ ? '' : 'none';
      oddBox.style.display = num_ ? 'none' : '';
      cn.el.style.display = num_ ? '' : 'none';
      ck.el.style.display = num_ ? '' : 'none';
    }
    function drawOdd() {
      oddBox.textContent = '';
      const R = 32;
      const cw = 18;
      const W = cw * R + 20;
      const Hh = cw * 0.9 * R + 20;
      const svg = svgBox(oddBox, W, Hh, 360);
      let odd = 0;
      for (let r = 0; r < R; r++) {
        for (let j = 0; j <= r; j++) {
          // C(r, j) нечётно ⇔ (j & r) == j (теорема Люка).
          const isOdd = (j & r) === j;
          if (isOdd) odd++;
          const x = W / 2 + (j - r / 2) * cw - cw / 2 + 1;
          const y = 10 + r * cw * 0.9;
          svg.appendChild(S('rect', { x, y, width: cw - 2, height: cw * 0.9 - 2, rx: 3, style: 'fill:' + (isOdd ? 'var(--c-blue)' : 'var(--surface-2)') + ';stroke:var(--border);stroke-width:.5' }));
        }
      }
      st.set('c', '—');
      st.set('rule', '—');
      st.set('sum', 'нечётных: ' + odd + ' из ' + (R * (R + 1)) / 2);
      st.set('p', '—');
      note.innerHTML = 'Синие клетки — нечётные C(n, k). Получается <b>треугольник Серпинского</b>: каждая половина размера 2<sup>m</sup> повторяет весь треугольник в уменьшенном виде. Причина — правило Паскаля по модулю 2: «нечётное + нечётное = чётное». Красивый факт (теорема Люка): C(n, k) нечётно ровно тогда, когда каждый двоичный разряд k не больше разряда n, поэтому в строке n нечётных чисел 2<sup>(число единиц в двоичной записи n)</sup>: в строке 10 = 1010<sub>2</sub> их 2² = 4 (1, 45, 45, 1).';
    }
    function draw() {
      if (s.mode === 'odd') return drawOdd();
      const n = s.n;
      const k = Math.min(s.k, n);
      const items = [];
      for (let r = 0; r <= 10; r++) for (let j = 0; j <= r; j++) items.push({ x: j - r / 2, y: -r, dy: 4, anchor: 'middle', text: String(comb(r, j)), bold: r === n && j === k });
      const box = (r, j, fill, op) => ({ type: 'rect', x0: j - r / 2 - 0.45, x1: j - r / 2 + 0.45, y0: -r - 0.42, y1: -r + 0.42, fill, stroke: fill, opacity: op });
      const L = [{ type: 'rect', x0: -n / 2 - 0.55, x1: n / 2 + 0.55, y0: -n - 0.48, y1: -n + 0.48, fill: 'muted', stroke: 'muted', opacity: 0.12 }];
      if (n >= 1 && k >= 1) L.push(box(n - 1, k - 1, 'model', 0.3));
      if (n >= 1 && k <= n - 1) L.push(box(n - 1, k, 'model', 0.3));
      L.push(box(n, k, 'tree', 0.45));
      L.push({ type: 'text', items });
      tri.render(L);
      const ks = U.range(n + 1);
      const ps = ks.map((j) => comb(n, j) / Math.pow(2, n));
      bars.render([{ type: 'bars', x: ks, y: ps, color: (i) => (i === k ? 'tree' : 'model'), width: 0.8, maxPx: 28, tooltip: (i) => [['k', String(i)], ['C(n, k)', String(comb(n, i))], ['вероятность', f4(ps[i])]] }], { y: [0, Math.max(...ps) * 1.15] });
      st.set('c', String(comb(n, k)));
      st.set('rule', n >= 1 ? comb(n - 1, k - 1) + ' + ' + comb(n - 1, k) + ' = ' + comb(n, k) : '—');
      st.set('sum', '2' + sup(n) + ' = ' + Math.pow(2, n));
      st.set('p', comb(n, k) + '/' + Math.pow(2, n) + ' ≈ ' + f3(comb(n, k) / Math.pow(2, n)));
      const rec = n >= 1 ? ' <b>Правило Паскаля</b>: C(' + n + ', ' + k + ') = C(' + (n - 1) + ', ' + (k - 1) + ') + C(' + (n - 1) + ', ' + k + ') = ' + comb(n - 1, k - 1) + ' + ' + comb(n - 1, k) + ' (синие клетки) — правило суммы по случаям «предмет A взят» (из остальных n − 1 берём ещё k − 1) и «A не взят» (берём все k из остальных).' : '';
      note.innerHTML = 'C(' + n + ', ' + k + ') = ' + n + '!/(' + k + '!·' + (n - k) + '!) = ' + comb(n, k) + '.' + rec + ' <b>Симметрия</b> C(n, k) = C(n, n − k): выбрать, что взять, — то же, что выбрать, что оставить. <b>Сумма строки</b> 2<sup>n</sup>: каждое подмножество имеет какой-то размер k. Разделив строку на 2<sup>n</sup>, получаем распределение числа орлов в n бросках (нижний график, урок 15.13).';
    }
    w.pythonAction(() => 'from math import comb\n\nfor n in range(' + (s.mode === 'odd' ? 16 : 11) + '):\n    row = [comb(n, k) for k in range(n + 1)]\n' + (s.mode === 'odd' ? '    print("".join("#" if c % 2 else "." for c in row).center(32))\n' : '    print(" ".join(f"{c:3}" for c in row).center(60))\nn, k = ' + s.n + ', ' + Math.min(s.k, s.n) + '\nprint(f"C({n},{k}) = {comb(n, k)}, сумма строки = {2**n}, P = {comb(n, k) / 2**n:.4f}")\n'));
    sync();
    draw();
  });

  /* ==============================================================================
   * 16. Бином Ньютона
   * ============================================================================== */
  GBC.widget('binomial-expand', (el) => {
    const s = { n: 4, a: 1, b: 1 };
    const w = ui.shell(el, { title: 'Бином Ньютона: откуда берутся коэффициенты', sub: 'Раскрываем (a + b)ⁿ: из каждой из n скобок берём a или b. Слагаемое aⁿ⁻ᵏbᵏ появляется столько раз, сколькими способами можно выбрать k скобок, из которых берём b, — C(n, k).' });
    ui.slider(w.controls, { label: 'Степень n', min: 1, max: 8, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'a', min: -3, max: 3, step: 0.5, value: s.a, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'b', min: -3, max: 3, step: 0.5, value: s.b, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.b = v), draw()) });
    const eq = texEl('', true, 'margin:4px 0');
    const wordsBox = H('div');
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'k — сколько раз взяли b' }, y: { label: 'слагаемое C(n,k)·aⁿ⁻ᵏ·bᵏ' } });
    w.main.insertBefore(eq, plot.root);
    w.main.insertBefore(wordsBox, plot.root);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sum', label: 'сумма слагаемых' }, { key: 'pow', label: '(a + b)ⁿ' }, { key: 'w', label: 'слов при раскрытии 2ⁿ' }]);
    function draw() {
      const { n, a, b } = s;
      const term = (k) => '\\tbinom{' + n + '}{' + k + '}a^{' + (n - k) + '}b^{' + k + '}';
      const coefTerm = (k) => {
        const c = comb(n, k);
        const pa = n - k === 0 ? '' : n - k === 1 ? 'a' : 'a^{' + (n - k) + '}';
        const pb = k === 0 ? '' : k === 1 ? 'b' : 'b^{' + k + '}';
        return (c === 1 && (pa || pb) ? '' : String(c)) + pa + pb;
      };
      texInto(eq, '\\begin{aligned}(a+b)^{' + n + '} &= ' + (n <= 4 ? U.range(n + 1).map(term).join(' + ') + ' \\\\ &= ' : '') + U.range(n + 1).map(coefTerm).join(' + ') + '\\end{aligned}', true);
      wordsBox.textContent = '';
      if (n <= 4) {
        const g = cardGrid(130);
        U.range(n + 1).forEach((k) => {
          const ws = words(2, n).filter((wd) => U.sum(wd) === k).map((wd) => wd.map((x) => (x ? 'b' : 'a')).join(''));
          const c = card('k = ' + k + ': ' + ws.length + ' ' + plural(ws.length, 'слово', 'слова', 'слов'));
          c.body.appendChild(H('div', { style: 'font-family:var(--font-mono);font-size:.8rem;color:var(--ink-2)' }, ws.join(' ')));
          g.appendChild(c.el);
        });
        wordsBox.appendChild(g);
      }
      const ks = U.range(n + 1);
      const T = ks.map((k) => comb(n, k) * Math.pow(a, n - k) * Math.pow(b, k));
      const lo = Math.min(0, ...T);
      const hi = Math.max(0, ...T);
      const pad = (hi - lo || 1) * 0.12;
      plot.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'bars', x: ks, y: T, color: (i) => (T[i] >= 0 ? 'model' : 'tree'), width: 0.7, maxPx: 30, tooltip: (i) => [['k', String(i)], ['C(n, k)', String(comb(n, i))], ['слагаемое', f4(T[i])]] },
      ], { x: [-0.6, n + 0.6], y: [lo - (lo < 0 ? pad : 0), hi + pad] });
      const sum = U.sum(T);
      st.set('sum', f4(sum));
      st.set('pow', f4(Math.pow(a + b, n)));
      st.set('w', String(Math.pow(2, n)));
      note.innerHTML = 'Раскрыть скобки — значит перебрать все 2<sup>n</sup> слов из букв a и b (по одной букве из каждой скобки)' + (n <= 4 ? ' — они выписаны в карточках' : '') + '. Слова с k буквами b дают одно и то же слагаемое a<sup>n−k</sup>b<sup>k</sup>, а таких слов C(n, k) — выбираем, в каких скобках взяли b. Столбики — вклад каждого слагаемого при a = ' + U.fmt(a, 1) + ', b = ' + U.fmt(b, 1) + '; их сумма равна (a + b)<sup>n</sup> = ' + f4(Math.pow(a + b, n)) + '. Попробуйте a = 1, b = 1 (сумма строки 2<sup>n</sup>) и a = 1, b = −1 (знакопеременная сумма 0: подмножеств чётного размера столько же, сколько нечётного).';
    }
    w.pythonAction(() => 'from math import comb\n\nn, a, b = ' + s.n + ', ' + py(s.a) + ', ' + py(s.b) + '\nterms = [comb(n, k) * a**(n - k) * b**k for k in range(n + 1)]\nprint("слагаемые:", terms)\nprint("сумма:", sum(terms), " (a + b)^n:", (a + b)**n)\n');
    draw();
  });

  /* ==============================================================================
   * 17. Тождества: доказательство двойным подсчётом
   * ============================================================================== */
  GBC.widget('identities', (el) => {
    const s = { id: 'hockey', n: 6, k: 2, m: 3 };
    const ID = {
      hockey: { name: 'клюшка: Σ C(i, k) = C(n + 1, k + 1)', story: 'Выбираем k + 1 чисел из 1, …, n + 1 и смотрим на наибольшее: если это i + 1, остальные k выбираются из первых i чисел — C(i, k) способов. Сумма по случаям «наибольшее = k + 1, …, n + 1» и есть левая часть.' },
      captain: { name: 'капитан: k·C(n, k) = n·C(n − 1, k − 1)', story: 'Сколькими способами выбрать команду из k человек с капитаном? Сначала команду, потом капитана в ней: C(n, k)·k. Или сначала капитана из всех n, потом ещё k − 1 из оставшихся: n·C(n − 1, k − 1). Считаем одно и то же двумя способами — ответы равны.' },
      vander: { name: 'Вандермонд: Σ C(m, j)·C(n − m, k − j) = C(n, k)', story: 'В группе m мужчин и n − m женщин; выбираем комиссию из k человек. Сразу — C(n, k) способов. По случаям «в комиссии j мужчин»: C(m, j) способов выбрать мужчин и C(n − m, k − j) — женщин; складываем по j.' },
      squares: { name: 'квадраты: Σ C(n, j)² = C(2n, n)', story: 'Частный случай Вандермонда: из n мужчин и n женщин выбираем n человек. j мужчин можно выбрать C(n, j) способами, а n − j женщин — C(n, n − j) = C(n, j) способами.' },
      row: { name: 'строка: Σ C(n, j) = 2ⁿ', story: 'Подмножества множества из n элементов можно считать целиком (2ⁿ — каждый элемент взят или нет) или по размеру j (C(n, j) подмножеств размера j). Итоги равны.' },
    };
    const w = ui.shell(el, { title: 'Тождества: одно и то же, посчитанное двумя способами', sub: 'Доказательство двойным подсчётом: придумываем историю, где одно множество считается двумя способами. Клетки треугольника, которые складываются, — синие; результат — оранжевый.' });
    ui.select(w.controls, { label: 'Тождество', value: s.id, options: Object.keys(ID).map((key) => ({ value: key, label: ID[key].name })), onChange: (v) => ((s.id = v), draw()) });
    const cn = ui.slider(w.controls, { label: 'n', min: 1, max: 10, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const ck = ui.slider(w.controls, { label: 'k', min: 0, max: 10, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const cm = ui.slider(w.controls, { label: 'm (мужчин)', min: 0, max: 10, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    const tri = new GBC.Plot(w.main, { height: 300, grid: 'none', x: { label: '', domain: [-6.3, 6.3], ticks: [] }, y: { label: '', domain: [-12.6, 0.6], ticks: [] }, margin: { left: 8, bottom: 8 } });
    const eq = texEl('', true, 'margin:4px 0');
    w.main.appendChild(eq);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'l', label: 'левая часть' }, { key: 'r', label: 'правая часть' }, { key: 'ok', label: 'равны?' }]);
    function draw() {
      const id = s.id;
      cm.el.style.display = id === 'vander' ? '' : 'none';
      ck.el.style.display = id === 'row' || id === 'squares' ? 'none' : '';
      const nMax = id === 'squares' ? 6 : id === 'hockey' ? 11 : 12;
      const n = Math.min(s.n, nMax);
      const k = Math.min(s.k, n);
      const m = Math.min(s.m, n);
      const blue = [];
      const orange = [];
      let lhs = 0;
      let rhs = 0;
      let tex = '';
      if (id === 'hockey') {
        for (let i = k; i <= n; i++) blue.push([i, k]);
        orange.push([n + 1, k + 1]);
        lhs = U.sum(blue.map(([r, j]) => comb(r, j)));
        rhs = comb(n + 1, k + 1);
        tex = '\\sum_{i=' + k + '}^{' + n + '}\\binom{i}{' + k + '} = ' + blue.map(([r, j]) => comb(r, j)).join(' + ') + ' = ' + lhs + ' = \\binom{' + (n + 1) + '}{' + (k + 1) + '}';
      } else if (id === 'captain') {
        blue.push([n, k]);
        orange.push([n - 1, k - 1]);
        lhs = k * comb(n, k);
        rhs = n * comb(n - 1, k - 1);
        tex = k + '\\cdot\\binom{' + n + '}{' + k + '} = ' + k + '\\cdot ' + comb(n, k) + ' = ' + lhs + ' = ' + n + '\\cdot\\binom{' + (n - 1) + '}{' + (k - 1) + '} = ' + n + '\\cdot ' + comb(n - 1, k - 1);
      } else if (id === 'vander') {
        const terms = [];
        for (let j = 0; j <= k; j++) {
          const t = comb(m, j) * comb(n - m, k - j);
          if (j <= m && k - j <= n - m) {
            blue.push([m, j]);
            blue.push([n - m, k - j]);
          }
          lhs += t;
          terms.push(comb(m, j) + '\\cdot' + comb(n - m, k - j));
        }
        orange.push([n, k]);
        rhs = comb(n, k);
        tex = '\\sum_{j=0}^{' + k + '}\\binom{' + m + '}{j}\\binom{' + (n - m) + '}{' + k + '-j} = ' + terms.join(' + ') + ' = ' + lhs + ' = \\binom{' + n + '}{' + k + '}';
      } else if (id === 'squares') {
        for (let j = 0; j <= n; j++) blue.push([n, j]);
        orange.push([2 * n, n]);
        lhs = U.sum(U.range(n + 1).map((j) => comb(n, j) * comb(n, j)));
        rhs = comb(2 * n, n);
        tex = '\\sum_{j=0}^{' + n + '}\\binom{' + n + '}{j}^2 = ' + U.range(n + 1).map((j) => comb(n, j) + '^2').join(' + ') + ' = ' + lhs + ' = \\binom{' + 2 * n + '}{' + n + '}';
      } else {
        for (let j = 0; j <= n; j++) blue.push([n, j]);
        lhs = Math.pow(2, n);
        rhs = lhs;
        tex = '\\sum_{j=0}^{' + n + '}\\binom{' + n + '}{j} = ' + U.range(n + 1).map((j) => comb(n, j)).join(' + ') + ' = 2^{' + n + '} = ' + lhs;
      }
      const R = 12;
      const items = [];
      for (let r = 0; r <= R; r++) for (let j = 0; j <= r; j++) items.push({ x: j - r / 2, y: -r, dy: 4, anchor: 'middle', text: String(comb(r, j)) });
      const box = ([r, j], fill, op) => (r > R || j < 0 || j > r ? null : { type: 'rect', x0: j - r / 2 - 0.47, x1: j - r / 2 + 0.47, y0: -r - 0.44, y1: -r + 0.44, fill, stroke: fill, opacity: op });
      tri.render([...blue.map((c) => box(c, 'model', 0.32)), ...orange.map((c) => box(c, 'tree', 0.5)), { type: 'text', items }].filter(Boolean));
      texInto(eq, tex, true);
      st.set('l', num(lhs));
      st.set('r', num(rhs));
      st.set('ok', lhs === rhs ? 'да' : 'нет');
      note.innerHTML = '<b>История:</b> ' + ID[id].story + (id === 'hockey' ? ' В треугольнике это «клюшка»: столбец синих клеток по диагонали и оранжевая «крюком» под ним.' : '') + (id === 'squares' && s.n > 6 ? ' (n ограничено 6, чтобы строка 2n поместилась.)' : '');
    }
    w.pythonAction(() => 'from math import comb\n\nn, k, m = ' + s.n + ', ' + s.k + ', ' + s.m + '\nprint("клюшка:", sum(comb(i, k) for i in range(k, n + 1)), comb(n + 1, k + 1))\nprint("капитан:", k * comb(n, k), n * comb(n - 1, k - 1))\nprint("Вандермонд:", sum(comb(m, j) * comb(n - m, k - j) for j in range(k + 1)), comb(n, k))\nprint("квадраты:", sum(comb(n, j)**2 for j in range(n + 1)), comb(2 * n, n))\nprint("строка:", sum(comb(n, j) for j in range(n + 1)), 2**n)\n');
    draw();
  });

  /* ==============================================================================
   * 18. Насколько велико C(n, k): форма строки, оценки, энтропия
   * ============================================================================== */
  GBC.widget('binom-size', (el) => {
    const s = { n: 100, q: 0.1 };
    const w = ui.shell(el, { title: 'Насколько велико C(n, k)', sub: 'Строка треугольника с ростом n похожа на колокол, а log₂ C(n, k) почти равен n·H(k/n), где H — бинарная энтропия. Двигайте долю k/n.' });
    ui.slider(w.controls, { label: 'n', values: [10, 20, 50, 100, 200, 500, 1000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Доля k/n', min: 0, max: 1, step: 0.01, value: s.q, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.q = v), draw()) });
    const bars = new GBC.Plot(w.main, { height: 200, x: { label: 'k' }, y: { label: 'C(n, k) / 2ⁿ' } });
    const ent = new GBC.Plot(w.main, { height: 240, x: { label: 'доля k/n', domain: [0, 1] }, y: { label: 'бит на объект', domain: [0, 1.25] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'C(n, k)' }, { key: 'l', label: 'log₂ C(n, k)' }, { key: 'h', label: 'n·H(k/n)' }, { key: 'cen', label: 'C(n, n/2) против 2ⁿ·√(2/(πn))' }]);
    function draw() {
      const n = s.n;
      const k = Math.round(s.q * n);
      const ks = U.range(n + 1);
      const ln2n = n * Math.LN2;
      const pmf = ks.map((j) => Math.exp((log2C(n, j) * Math.LN2) - ln2n));
      const sd = Math.sqrt(n) / 2;
      const xs = U.linspace(0, n, 300);
      const top = Math.max(...pmf) * 1.15;
      bars.render([
        n <= 100 ? { type: 'bars', x: ks, y: pmf, color: (i) => (i === k ? 'tree' : 'model'), width: 0.8, maxPx: 16, label: 'C(n, k)/2ⁿ', tooltip: (i) => [['k', String(i)], ['C(n, k)/2ⁿ', U.fmt(pmf[i], 4)]] } : { type: 'line', x: ks, y: pmf, color: 'model', width: 2, label: 'C(n, k)/2ⁿ', hover: false },
        { type: 'line', x: xs, y: xs.map((x) => Math.exp(-((x - n / 2) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI))), color: 'truth', width: 2, dash: '6 4', label: 'нормальная кривая N(n/2, n/4)', hover: false },
        { type: 'vline', x: k, color: 'tree', width: 1.5, dash: '3 3' },
      ], { x: [-0.5, n + 0.5], y: [0, top] });
      const qs = U.linspace(0.001, 0.999, 300);
      const exact = U.range(n + 1).map((j) => ({ x: j / n, y: log2C(n, j) / n }));
      ent.render([
        { type: 'line', x: qs, y: qs.map(hbin), color: 'tree', width: 2, label: 'H(k/n) — энтропия', hover: false },
        { type: 'line', x: qs, y: qs.map((q) => (q * lg(Math.E / q) <= 1.25 ? q * lg(Math.E / q) : NaN)), color: 'aqua', width: 1.6, dash: '5 4', label: 'верхняя оценка (k/n)·log₂(e·n/k)', hover: false },
        { type: 'line', x: qs, y: qs.map((q) => q * lg(1 / q)), color: 'truth', width: 1.6, dash: '2 3', label: 'нижняя оценка (k/n)·log₂(n/k)', hover: false },
        { type: 'line', x: exact.map((o) => o.x), y: exact.map((o) => o.y), color: 'model', width: 2.4, label: 'точно: log₂ C(n, k) / n', hover: false },
        { type: 'points', x: [k / n], y: [log2C(n, k) / n], color: 'model', r: 6, tooltip: () => [['k', String(k)], ['log₂C / n', f4(log2C(n, k) / n)], ['H(k/n)', f4(hbin(k / n))]] },
      ]);
      st.set('c', fmtB(combB(n, k)));
      st.set('l', U.fmt(log2C(n, k), 2));
      st.set('h', U.fmt(n * hbin(k / n), 2));
      const cen = log2C(n, Math.floor(n / 2));
      const appr = n + 0.5 * lg(2 / (Math.PI * n));
      st.set('cen', 'ошибка ' + pct(1 - Math.pow(2, appr - cen), 2));
      note.innerHTML = '<b>Колокол.</b> Почти вся масса строки сосредоточена в полосе n/2 ± √n: при n = ' + n + ' это k от ' + Math.round(n / 2 - Math.sqrt(n)) + ' до ' + Math.round(n / 2 + Math.sqrt(n)) + '. Нормальная кривая (центральная предельная теорема, урок 15.13) повторяет форму столбиков. Центральный коэффициент C(n, n/2) ≈ 2<sup>n</sup>·√(2/(πn)) (из формулы Стирлинга). <b>Оценки.</b> (n/k)<sup>k</sup> ≤ C(n, k) ≤ (en/k)<sup>k</sup> — грубые, а энтропия даёт главный член: log<sub>2</sub> C(n, k) = n·H(k/n) − O(log n). Сейчас ' + U.fmt(log2C(n, k), 1) + ' против ' + U.fmt(n * hbin(k / n), 1) + ' бита. Смысл (урок 15.16): указать, какие k из n объектов выбраны, стоит около n·H(k/n) бит.';
    }
    w.pythonAction(() => 'from math import comb, log2, pi, sqrt\n\nn, k = ' + s.n + ', ' + Math.round(s.q * s.n) + '\nH = lambda q: 0 if q in (0, 1) else -q * log2(q) - (1 - q) * log2(1 - q)\nc = comb(n, k)\nprint(f"C({n}, {k}) = {c:.4g}, log2 = {log2(c):.2f}, n*H(k/n) = {n * H(k / n):.2f}")\nprint("центральный:", comb(n, n // 2), "≈", round(2**n * sqrt(2 / (pi * n))))\n');
    draw();
  });

  GBC.lesson1517 = {
    f2, f3, f4, py, lg, sup, grp, num, fmtB, numLog10, pct, plural, nWord,
    fact, comb, perm, factB, permB, combB, powB, lgamma, lnFact, log2C, hbin, gcd, lcm,
    combos, perms, arrangements, words, multisets, multisetPerms,
    LET, SER, cvar, tint, tile, flexRow, texInto, texEl, card, cardGrid, badge, rowTable, scrollBox, monoBox, svgBox, sText, legendRow,
    PY_MATH, PY_IT,
  };
})();
