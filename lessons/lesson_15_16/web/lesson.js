/* Урок 15.16: теория информации. Часть 1 — интуиция, измерение информации, энтропия, сжатие.
 * Виджеты: угадай число (три стратегии вопросов); сколько бит в пароле; взвешивание монет (три исхода
 * против двух); неожиданность события; цепочка фактов о карте (условная информация); энтропия
 * распределения; бинарная энтропия и вогнутость (разрыв = прирост информации); правило группировки;
 * «20 вопросов» с неравными вероятностями; перплексия; оценка энтропии по выборке (смещение, поправка
 * Миллера — Мэдоу); максимальная энтропия (кубик Джейнса); дифференциальная энтропия и квантование;
 * неравенство Крафта; граница Шеннона; алгоритм Хаффмана по шагам; блочное кодирование; типичные
 * последовательности; сжатие текста.
 * Общие помощники (энтропия, Хаффман, дерево кода, карточки) выставлены в GBC.lesson1516 —
 * ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const f1 = (v) => U.fmt(v, 1);
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const f4 = (v) => U.fmt(v, 4);
  const py = (v) => U.pyNum(v);
  const lg = Math.log2;
  /** Короткая запись маленьких и больших величин: 3.6e−5 вместо «0». */
  const sci = (v) => (!Number.isFinite(v) ? (Number.isNaN(v) ? '—' : v > 0 ? '∞' : '−∞') : v === 0 ? '0' : Math.abs(v) >= 0.01 && Math.abs(v) < 1e5 ? U.fmt(v, Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 2 : 4) : v.toExponential(1).replace(/-/g, '−').replace('e+', 'e'));
  const SUPD = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (k) => String(k).split('').map((c) => SUPD[c] || c).join('');
  /** Большое число как 10ˣ: 3.1·10²⁰. */
  function big(v) {
    if (!Number.isFinite(v)) return '∞';
    if (v < 1e6) return Math.round(v).toLocaleString('ru-RU');
    const e = Math.floor(Math.log10(v));
    return U.fmt(v / Math.pow(10, e), 2) + '·10' + sup(e);
  }
  /** То же по двоичному логарифму (для чисел, не помещающихся в double). */
  function big2(bits) {
    if (bits < 1000) return big(Math.pow(2, bits));
    const e10 = bits * Math.log10(2);
    const e = Math.floor(e10);
    return U.fmt(Math.pow(10, e10 - e), 2) + '·10' + sup(e);
  }
  const pct = (p, d = 0) => (Number.isFinite(p) ? U.fmt(100 * p, d) + ' %' : '—');
  /** Склонение: plural(3, 'шаг', 'шага', 'шагов') → 'шага'. */
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  const nWord = (n, one, few, many) => n + ' ' + plural(n, one, few, many);
  /** Диапазон оси по значениям с полями; почти постоянные значения не ломают деления оси. */
  function yDom(vals, pad = 0.08, inc = []) {
    const v = vals.concat(inc).filter(Number.isFinite);
    if (!v.length) return [-1, 1];
    const [lo, hi] = U.extent(v);
    const span = hi - lo;
    if (span < 1e-9 * Math.max(1, Math.abs(hi))) {
      const m = (lo + hi) / 2;
      const d = Math.max(0.5, Math.abs(m) * 0.1);
      return [m - d, m + d];
    }
    return [lo - pad * span, hi + Math.max(pad, 0.14) * span];
  }
  /** Время в человеческих единицах. */
  function human(sec) {
    if (!Number.isFinite(sec)) return '∞';
    if (sec < 1e-3) return 'мгновенно';
    if (sec < 90) return U.fmt(sec, sec < 10 ? 2 : 0) + ' с';
    if (sec < 5400) return Math.round(sec / 60) + ' мин';
    if (sec < 1.5 * 86400) return f1(sec / 3600) + ' ч';
    if (sec < 400 * 86400) return Math.round(sec / 86400) + ' сут';
    const y = sec / (365.25 * 86400);
    return y < 1e5 ? Math.round(y).toLocaleString('ru-RU') + ' лет' : big(y) + ' лет';
  }

  /* ==============================================================================
   * Информационные величины
   * ============================================================================== */
  /** Энтропия в битах; нули пропускаются (0·log 0 = 0). */
  function Hb(ps) {
    let s = 0;
    for (const p of ps) if (p > 0) s -= p * lg(p);
    return s;
  }
  const hbin = (p) => (p <= 0 || p >= 1 ? 0 : -p * lg(p) - (1 - p) * lg(1 - p));
  /** Перекрёстная энтропия H(p, q) в битах. */
  function ceb(p, q) {
    let s = 0;
    for (let i = 0; i < p.length; i++) if (p[i] > 0) s += q[i] > 0 ? -p[i] * lg(q[i]) : Infinity;
    return s;
  }
  /** KL(p ‖ q) в битах. */
  function klb(p, q) {
    let s = 0;
    for (let i = 0; i < p.length; i++) if (p[i] > 0) s += q[i] > 0 ? p[i] * lg(p[i] / q[i]) : Infinity;
    return s;
  }
  const normalize = (ws) => {
    const t = U.sum(ws);
    return ws.map((v) => (t > 0 ? v / t : 1 / ws.length));
  };
  /** Обратная к бинарной энтропии на [0, ½]: p с h(p) = v. */
  function hinv(v) {
    if (v <= 0) return 0;
    if (v >= 1) return 0.5;
    let a = 0;
    let b = 0.5;
    for (let i = 0; i < 80; i++) {
      const m = (a + b) / 2;
      if (hbin(m) < v) a = m;
      else b = m;
    }
    return (a + b) / 2;
  }
  /** ln Γ(x) (Ланцош), для биномиальных коэффициентов. */
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
  const log2C = (n, k) => (lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1)) / Math.LN2;
  /** log₂ Σ 2^aᵢ без переполнения. */
  function log2sum(arr) {
    const m = Math.max(...arr);
    if (!Number.isFinite(m)) return m;
    let s = 0;
    for (const a of arr) s += Math.pow(2, a - m);
    return m + lg(s);
  }
  /** Нормальное распределение: плотность и функция распределения (erf по Абрамовицу — Стигану, 7.1.26 + уточнение). */
  const phi = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  function erfc(x) {
    // Численный рецепт (Press et al.), относительная ошибка < 1.2e−7
    const z = Math.abs(x);
    const t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const Phi = (x) => 0.5 * erfc(-x / Math.SQRT2);
  /** Квантиль нормального распределения (бисекция по Phi). */
  function probit(p) {
    let a = -9;
    let b = 9;
    for (let i = 0; i < 90; i++) {
      const m = (a + b) / 2;
      if (Phi(m) < p) a = m;
      else b = m;
    }
    return (a + b) / 2;
  }
  /** Индекс категории по равномерному u и накопленным вероятностям. */
  function pick(cum, u) {
    for (let j = 0; j < cum.length; j++) if (u < cum[j]) return j;
    return cum.length - 1;
  }
  const cumsum = (ps) => {
    const out = [];
    let s = 0;
    for (const p of ps) out.push((s += p));
    return out;
  };

  /* ==============================================================================
   * Код Хаффмана. Порядок: два узла с наименьшим (вес, номер); первый получает 0, второй 1;
   * новый узел — следующий номер. Так же устроен heapq в Python — коды совпадают.
   * ============================================================================== */
  function huffman(ps) {
    const k = ps.length;
    if (k === 1) return { codes: ['0'], lens: [1], merges: [], root: { w: ps[0], id: 0, syms: [0], leaf: 0 } };
    let nodes = ps.map((w, i) => ({ w, id: i, syms: [i], leaf: i }));
    const codes = ps.map(() => '');
    const merges = [];
    let next = k;
    while (nodes.length > 1) {
      nodes.sort((a, b) => a.w - b.w || a.id - b.id);
      const a = nodes.shift();
      const b = nodes.shift();
      a.syms.forEach((s) => (codes[s] = '0' + codes[s]));
      b.syms.forEach((s) => (codes[s] = '1' + codes[s]));
      const m = { w: a.w + b.w, id: next++, syms: a.syms.concat(b.syms), kids: [a, b], step: merges.length };
      merges.push(m);
      nodes.push(m);
    }
    return { codes, lens: codes.map((c) => c.length), merges, root: nodes[0] };
  }
  /** Только длины кодов Хаффмана — быстро, через двоичную кучу (для тысяч символов). */
  function huffLens(ps) {
    const n = ps.length;
    if (n === 1) return [1];
    const heap = [];
    const less = (a, b) => a.w < b.w || (a.w === b.w && a.id < b.id);
    const push = (x) => {
      heap.push(x);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!less(heap[i], heap[p])) break;
        [heap[i], heap[p]] = [heap[p], heap[i]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && less(heap[l], heap[m])) m = l;
          if (r < heap.length && less(heap[r], heap[m])) m = r;
          if (m === i) break;
          [heap[i], heap[m]] = [heap[m], heap[i]];
          i = m;
        }
      }
      return top;
    };
    const parent = new Int32Array(2 * n);
    ps.forEach((w, i) => push({ w, id: i }));
    let next = n;
    while (heap.length > 1) {
      const a = pop();
      const b = pop();
      parent[a.id] = next;
      parent[b.id] = next;
      push({ w: a.w + b.w, id: next++ });
    }
    const root = next - 1;
    const depth = new Int32Array(2 * n);
    for (let id = root - 1; id >= 0; id--) depth[id] = depth[parent[id]] + 1;
    return Array.from(depth.slice(0, n));
  }
  /** Средняя длина кода. */
  const avgLen = (ps, lens) => ps.reduce((s, p, i) => s + p * lens[i], 0);

  /* ==============================================================================
   * Карточки, формулы, таблицы
   * ============================================================================== */
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
  /** Таблица: columns — строки; rows — массивы строк. */
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  const scrollBox = (style = '') => H('div', { style: 'overflow-x:auto;overflow-y:hidden;margin:4px 0 8px;' + style });
  const monoBox = (style = '') => H('div', { style: 'font-family:var(--font-mono);font-size:.86rem;line-height:1.6;white-space:pre-wrap;word-break:break-all;padding:6px 2px;' + style });
  const PY_NP = 'import numpy as np\n';
  const PY_RNG = 'from gbcourse.rng import Mulberry32\n';
  const PY_H = 'def H(p):\n    p = np.asarray(p, float); p = p[p > 0]\n    return float(-(p * np.log2(p)).sum())\n';
  const PY_HUFF = 'import heapq\n\ndef huffman(ps):\n    """Коды Хаффмана: сливаем два узла с наименьшим (вес, номер); первому — 0, второму — 1."""\n    heap = [(p, i, [i]) for i, p in enumerate(ps)]\n    heapq.heapify(heap)\n    codes, nxt = [""] * len(ps), len(ps)\n    while len(heap) > 1:\n        p1, _, s1 = heapq.heappop(heap)\n        p2, _, s2 = heapq.heappop(heap)\n        for s in s1: codes[s] = "0" + codes[s]\n        for s in s2: codes[s] = "1" + codes[s]\n        heapq.heappush(heap, (p1 + p2, nxt, s1 + s2)); nxt += 1\n    return codes\n';

  /* ==============================================================================
   * Схема двоичного дерева кода: 0 — влево, 1 — вправо; листья — символы.
   * o: { dx, dy, showFree, highlight (код-путь), nodeNote(prefix) → текст, leafNote(i) → текст }
   * ============================================================================== */
  function codeTree(codes, labels, o = {}) {
    const root = { kids: {}, prefix: '' };
    codes.forEach((c, i) => {
      let n = root;
      for (const ch of c) {
        if (!n.kids[ch]) n.kids[ch] = { kids: {}, prefix: n.prefix + ch };
        n = n.kids[ch];
      }
      n.leaf = i;
    });
    let order = 0;
    let maxD = 0;
    const all = [];
    const free = [];
    (function walk(n, d) {
      n.d = d;
      maxD = Math.max(maxD, d);
      all.push(n);
      const has = ['0', '1'].filter((k) => n.kids[k]);
      if (!has.length) {
        n.x = order++;
        return;
      }
      const xs = [];
      for (const k of ['0', '1']) {
        if (n.kids[k]) {
          walk(n.kids[k], d + 1);
          xs.push(n.kids[k].x);
        } else if (o.showFree && n.leaf === undefined) {
          const fr = { x: order++, d: d + 1, parent: n, bit: k };
          free.push(fr);
          maxD = Math.max(maxD, d + 1);
          xs.push(fr.x);
        }
      }
      n.x = (Math.min(...xs) + Math.max(...xs)) / 2;
    })(root, 0);
    const dx = o.dx || 60;
    const dy = o.dy || 54;
    const pad = 26;
    const W = Math.max(order * dx, 120) + 2 * pad;
    const Hh = pad + maxD * dy + 58;
    const X = (x) => pad + x * dx + dx / 2;
    const Y = (d) => pad + d * dy;
    const svg = S('svg', { width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': o.aria || 'Дерево кода', style: 'display:block;margin:0 auto;font-family:var(--font-sans);min-width:' + W + 'px;max-width:none' });
    const onPath = (prefix) => o.highlight != null && o.highlight.startsWith(prefix);
    for (const n of all) {
      for (const k of ['0', '1']) {
        const c = n.kids[k];
        if (!c) continue;
        const hl = onPath(c.prefix);
        svg.appendChild(S('line', { x1: X(n.x), y1: Y(n.d), x2: X(c.x), y2: Y(c.d), style: 'stroke:' + (hl ? 'var(--c-tree)' : 'var(--c-axis)') + ';stroke-width:' + (hl ? 3 : 1.6) }));
        const mx = (X(n.x) + X(c.x)) / 2 + (k === '0' ? -9 : 9);
        const my = (Y(n.d) + Y(c.d)) / 2 - 2;
        svg.appendChild(S('text', { x: mx, y: my, 'text-anchor': 'middle', style: 'font-size:12px;font-weight:650;fill:' + (hl ? 'var(--c-tree)' : 'var(--ink-2)') }, k));
      }
    }
    for (const fr of free) {
      const n = fr.parent;
      svg.appendChild(S('line', { x1: X(n.x), y1: Y(n.d), x2: X(fr.x), y2: Y(fr.d), style: 'stroke:var(--c-axis);stroke-width:1.4;stroke-dasharray:4 4' }));
      svg.appendChild(S('circle', { cx: X(fr.x), cy: Y(fr.d), r: 9, style: 'fill:none;stroke:var(--muted);stroke-dasharray:3 3' }));
      svg.appendChild(S('text', { x: X(fr.x), y: Y(fr.d) + 24, 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--muted)' }, 'свободно'));
    }
    for (const n of all) {
      const cx = X(n.x);
      const cy = Y(n.d);
      if (n.leaf !== undefined && !Object.keys(n.kids).length) {
        const hl = o.highlight != null && o.highlight === n.prefix;
        const lab = String(labels[n.leaf]);
        const wBox = Math.max(30, 8 * lab.length + 14);
        svg.appendChild(S('rect', { x: cx - wBox / 2, y: cy - 12, width: wBox, height: 24, rx: 6, style: 'fill:' + (hl ? 'var(--c-tree)' : 'var(--surface-2)') + ';stroke:' + (hl ? 'var(--c-tree)' : 'var(--border)') }));
        svg.appendChild(S('text', { x: cx, y: cy + 4.5, 'text-anchor': 'middle', style: 'font-size:12.5px;font-weight:650;fill:' + (hl ? 'var(--surface)' : 'var(--ink)') }, lab));
        svg.appendChild(S('text', { x: cx, y: cy + 28, 'text-anchor': 'middle', style: 'font-size:11.5px;font-family:var(--font-mono);fill:var(--ink-2)' }, n.prefix || '—'));
        if (o.leafNote) {
          const t = o.leafNote(n.leaf);
          if (t) svg.appendChild(S('text', { x: cx, y: cy + 43, 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--muted)' }, t));
        }
      } else {
        const hl = onPath(n.prefix);
        svg.appendChild(S('circle', { cx, cy, r: 6, style: 'fill:' + (hl ? 'var(--c-tree)' : 'var(--ink-2)') + ';stroke:var(--surface);stroke-width:1.5' }));
        if (o.nodeNote) {
          const t = o.nodeNote(n.prefix);
          if (t) svg.appendChild(S('text', { x: cx + 10, y: cy - 8, style: 'font-size:11px;fill:var(--ink-2)' }, t));
        }
      }
    }
    const box = scrollBox();
    box.appendChild(svg);
    return box;
  }

  /* ==============================================================================
   * Интуиция. Угадай число: каждый ответ «да/нет» — не больше одного бита
   * ============================================================================== */
  function askLog(N, secret, strat) {
    let lo = 1;
    let hi = N;
    const log = [];
    while (lo < hi) {
      const m = hi - lo + 1;
      const left = strat === 'half' ? Math.ceil(m / 2) : strat === 'quarter' ? Math.max(1, Math.round(m / 4)) : 1;
      const t = lo + left - 1;
      const yes = secret <= t;
      if (yes) hi = t;
      else lo = t + 1;
      log.push({ t, yes, before: m, after: hi - lo + 1, lo, hi, left });
    }
    return log;
  }
  GBC.widget('guess-number', (el) => {
    const s = { N: 16, secret: 11, strat: 'half', k: 0 };
    const w = ui.shell(el, { title: 'Угадай число: сколько вопросов «да/нет» нужно', sub: 'Загадано число от 1 до N. Вопросы — только «да/нет». Сравните три стратегии: делить кандидатов пополам, отрезать четверть или перебирать по одному. Нижний график — сколько бит ещё осталось узнать: log₂ (число кандидатов).' });
    ui.select(w.controls, { label: 'Вариантов N', value: s.N, options: [8, 16, 32, 64, 100, 1000].map((v) => ({ value: v, label: String(v) })), onChange: (v) => ((s.N = +v), (s.secret = Math.min(s.secret, s.N)), sec.setMax(s.N), sec.set(s.secret), (s.k = 0), draw()) });
    const sec = ui.slider(w.controls, { label: 'Загаданное число', min: 1, max: s.N, step: 1, value: s.secret, format: String, onInput: (v) => ((s.secret = v), (s.k = 0), draw()) });
    ui.segmented(w.controls, { label: 'Стратегия', value: s.strat, options: [{ value: 'half', label: 'пополам' }, { value: 'quarter', label: 'отрезать ¼' }, { value: 'linear', label: 'по одному' }], onChange: (v) => ((s.strat = v), (s.k = 0), draw()) });
    const pl = ui.player(w.controls, { label: 'Вопросы', min: 0, max: 4, value: 0, fps: 1.5, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.k = k), draw(false)) });
    const p1 = new GBC.Plot(w.main, { height: 120, x: { label: 'кандидаты', domain: [0.5, 16.5] }, y: { label: '', domain: [-1, 1], ticks: [], hide: true }, margin: { left: 16, bottom: 36 } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'задано вопросов', domain: [0, 4] }, y: { label: 'осталось узнать, бит', domain: [0, 4.4] } });
    const log = monoBox();
    w.main.appendChild(log);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'left', label: 'осталось кандидатов' }, { key: 'q', label: 'вопросов' }, { key: 'bits', label: 'получено бит' }, { key: 'need', label: 'нужно ⌈log₂ N⌉' }]);
    function draw(resetPlayer = true) {
      const L = askLog(s.N, s.secret, s.strat);
      if (resetPlayer) {
        pl.setMax(L.length);
        pl.set(Math.min(s.k, L.length));
      }
      const k = Math.min(s.k, L.length);
      const cur = k ? L[k - 1] : { lo: 1, hi: s.N, after: s.N };
      p1.render([
        { type: 'rect', x0: 0.5, x1: s.N + 0.5, y0: -0.45, y1: 0.45, fill: 'muted', opacity: 0.18 },
        { type: 'rect', x0: cur.lo - 0.5, x1: cur.hi + 0.5, y0: -0.45, y1: 0.45, fill: 'model', stroke: 'model', opacity: 0.55 },
        { type: 'vline', x: s.secret, color: 'tree', width: 2.5, text: 'загадано' },
      ], { x: [0.5, s.N + 0.5] });
      const xs = U.range(L.length + 1);
      const rem = xs.map((i) => lg(i ? L[i - 1].after : s.N));
      const ideal = xs.map((i) => Math.max(0, lg(s.N) - i));
      const top = lg(s.N) * 1.1 + 0.1;
      p2.render([
        { type: 'line', x: xs, y: ideal, color: 'muted', dash: '6 4', width: 1.6, label: 'идеал: −1 бит за вопрос' },
        { type: 'line', x: xs.slice(0, k + 1), y: rem.slice(0, k + 1), color: 'model', width: 2.2, label: 'осталось узнать' },
        { type: 'points', x: xs.slice(0, k + 1), y: rem.slice(0, k + 1), color: 'model', r: 4 },
        { type: 'points', x: [k], y: [rem[k]], color: 'tree', r: 6 },
      ], { x: [0, Math.max(1, L.length)], y: [0, top] });
      const lines = L.slice(0, k).map((q, i) => (i + 1) + '. ' + (s.strat === 'linear' ? 'Это ' + q.t + '?' : 'Число ≤ ' + q.t + '?') + ' — ' + (q.yes ? 'да' : 'нет') + ' → осталось ' + q.after + '  (+' + f3(lg(q.before / q.after)) + ' бит)');
      log.textContent = lines.length ? lines.join('\n') : 'Вопросов ещё не было: кандидатов ' + s.N + ', неопределённость log₂ ' + s.N + ' = ' + f3(lg(s.N)) + ' бит. Нажмите ▶.';
      st.set('left', String(cur.after));
      st.set('q', k + ' из ' + L.length);
      st.set('bits', f3(lg(s.N / cur.after)));
      st.set('need', String(Math.ceil(lg(s.N) - 1e-12)));
      const per = { half: 'Пополам: каждый ответ уменьшает неопределённость на 1 бит (или почти на 1, если кандидатов нечётное число). Это лучшее, что может дать вопрос «да/нет».', quarter: 'Отрезать ¼: ответ «да» (редкий) даёт 2 бита, ответ «нет» (частый) — лишь log₂(4/3) ≈ 0.415 бита. В среднем h(¼) ≈ 0.811 бита на вопрос — меньше одного, поэтому вопросов нужно больше.', linear: 'По одному: «нет» почти ничего не сообщает — log₂(m/(m − 1)) бита. Для N = 1000 в худшем случае нужно 999 вопросов вместо 10.' };
      note.innerHTML = per[s.strat] + (k === L.length ? ' <b>Угадано за ' + nWord(L.length, 'вопрос', 'вопроса', 'вопросов') + '.</b>' : '') + ' Количество информации и есть число таких «идеальных» вопросов: log₂ N бит.';
    }
    w.pythonAction(() => `import math

def ask(N, secret, strat):
    lo, hi, log = 1, N, []
    while lo < hi:
        m = hi - lo + 1
        left = {"half": math.ceil(m / 2), "quarter": max(1, round(m / 4)), "linear": 1}[strat]
        t = lo + left - 1
        yes = secret <= t
        hi, lo = (t, lo) if yes else (hi, t + 1)
        log.append((t, yes, m, hi - lo + 1))
    return log

N, secret = ${s.N}, ${s.secret}
for strat in ("half", "quarter", "linear"):
    log = ask(N, secret, strat)
    print(f"{strat:8s}: вопросов {len(log):4d}, бит за вопрос в среднем {math.log2(N) / len(log):.3f}")
for t, yes, before, after in ask(N, secret, "${s.strat}"):
    print(f"≤ {t}? {'да ' if yes else 'нет'} → {after:4d} кандидатов  +{math.log2(before / after):.3f} бит")
print("нужно ⌈log2 N⌉ =", math.ceil(math.log2(N)))
# Внимание: round в Python округляет 0.5 к чётному, в JS — вверх; для «отрезать ¼» при m = 2, 6, 10, … ответы могут чуть различаться.
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 1. Сколько бит в выборе: алфавит, длина, перебор
   * ============================================================================== */
  GBC.widget('bits-meter', (el) => {
    const s = { A: 10, L: 4, speed: 1e10 };
    const PRE = { coin: [2, 1], die: [6, 1], letter: [33, 1], pin: [10, 4], lower8: [26, 8], mix8: [62, 8], words4: [7776, 4], full12: [94, 12] };
    const w = ui.shell(el, { title: 'Сколько бит в выборе: от монеты до пароля', sub: 'Строка длины L из алфавита в A равновероятных символов — это один выбор из Aᴸ вариантов, то есть L·log₂ A бит. Каждый бит удваивает число вариантов — и время перебора.' });
    ui.select(w.controls, { label: 'Пример', value: 'pin', options: [{ value: 'coin', label: 'монета' }, { value: 'die', label: 'кубик' }, { value: 'letter', label: 'буква (33)' }, { value: 'pin', label: 'PIN, 4 цифры' }, { value: 'lower8', label: 'пароль: 8 строчных латинских' }, { value: 'mix8', label: 'пароль: 8 из 62 (a–z, A–Z, 0–9)' }, { value: 'words4', label: '4 слова из словаря в 7776' }, { value: 'full12', label: 'пароль: 12 из 94 печатных' }], onChange: (v) => ((s.A = PRE[v][0]), (s.L = PRE[v][1]), aS.set(s.A), lS.set(s.L), draw()) });
    const aS = ui.slider(w.controls, { label: 'Алфавит A', values: [2, 6, 10, 26, 33, 36, 52, 62, 94, 256, 7776], value: s.A, format: String, onInput: (v) => ((s.A = v), draw()) });
    const lS = ui.slider(w.controls, { label: 'Длина L', min: 1, max: 24, step: 1, value: s.L, format: String, onInput: (v) => ((s.L = v), draw()) });
    ui.select(w.controls, { label: 'Скорость перебора', value: String(s.speed), options: [{ value: '1000', label: '10³ в секунду (форма входа)' }, { value: '10000000000', label: '10¹⁰ в секунду (видеокарта)' }, { value: '10000000000000', label: '10¹³ в секунду (ферма)' }], onChange: (v) => ((s.speed = +v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 270, x: { label: 'длина L', domain: [0.5, 24.5] }, y: { label: 'бит', domain: [0, 100] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'bits', label: 'бит L·log₂ A' }, { key: 'n', label: 'вариантов Aᴸ' }, { key: 't', label: 'перебор в среднем' }, { key: 'q', label: 'вопросов «да/нет»' }]);
    function draw() {
      const bits = s.L * lg(s.A);
      const Ls = U.range(24, 1);
      const thr = lg(2 * s.speed * 100 * 365.25 * 86400);
      const yMax = Math.max(thr * 1.15, bits * 1.15, 24 * lg(s.A) * 0.5);
      plot.render([
        { type: 'hline', y: thr, color: 'red', dash: '6 4', width: 1.5, label: 'перебор дольше 100 лет' },
        { type: 'line', x: Ls, y: Ls.map((l) => l * lg(s.A)), color: 'model', width: 2, label: 'L·log₂ A' },
        { type: 'points', x: Ls, y: Ls.map((l) => l * lg(s.A)), color: 'model', r: 3, tooltip: (i) => [['L', String(i + 1)], ['бит', f2((i + 1) * lg(s.A))]] },
        { type: 'points', x: [s.L], y: [bits], color: 'tree', r: 7 },
      ], { y: [0, yMax] });
      const sec = Math.pow(2, bits) / 2 / s.speed;
      st.set('bits', f2(bits));
      st.set('n', big2(bits));
      st.set('t', human(sec));
      st.set('q', String(Math.ceil(bits - 1e-9)));
      note.innerHTML = 'Выбор из A вариантов — log₂ A бит: монета 1, кубик 2.585, буква из 33 — 5.044. Длина умножает число вариантов, а биты <b>складываются</b>: PIN из 4 цифр — 4 · log₂ 10 = 13.29 бита, пароль из 8 символов из 62 — 47.63 бита. Красная линия — сколько бит нужно, чтобы средний перебор с выбранной скоростью занял больше 100 лет: ' + f1(thr) + ' бита. Всё это верно, только если символы выбраны <b>случайно и равновероятно</b> — человеческие пароли несут гораздо меньше информации (шаг 16).';
    }
    w.pythonAction(() => `import math

A, L, speed = ${s.A}, ${s.L}, ${py(s.speed)}
bits = L * math.log2(A)
print(f"{bits:.2f} бит, вариантов {A**L:.3g}")
sec = 2**bits / 2 / speed
print(f"перебор в среднем: {sec:.3g} с = {sec / 3.156e7:.3g} лет")
for name, a, l in [("PIN", 10, 4), ("8 из 62", 62, 8), ("4 слова из 7776", 7776, 4), ("12 из 94", 94, 12)]:
    print(f"{name:16s} {l * math.log2(a):6.2f} бит")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 2. Взвешивание монет: опыт с тремя исходами даёт до log₂ 3 бита
   * ============================================================================== */
  function weighLog(N, fake, strat) {
    let cand = U.range(N, 1);
    const log = [];
    while (cand.length > 1) {
      const m = cand.length;
      const a = strat === 'three' ? Math.ceil(m / 3) : Math.floor(m / 2);
      const L = cand.slice(0, a);
      const R = cand.slice(a, 2 * a);
      const rest = cand.slice(2 * a);
      let out;
      let next;
      if (L.includes(fake)) (out = 'left'), (next = L);
      else if (R.includes(fake)) (out = 'right'), (next = R);
      else (out = 'eq'), (next = rest);
      log.push({ L, R, rest, out, before: m, after: next.length, cand: cand.slice() });
      cand = next;
    }
    return log;
  }
  const rangeTxt = (arr) => {
    if (!arr.length) return '—';
    const parts = [];
    let a = arr[0];
    let b = arr[0];
    for (let i = 1; i <= arr.length; i++) {
      if (i < arr.length && arr[i] === b + 1) b = arr[i];
      else {
        parts.push(a === b ? String(a) : a + '–' + b);
        if (i < arr.length) a = b = arr[i];
      }
    }
    return parts.join(', ');
  };
  GBC.widget('weighing', (el) => {
    const s = { N: 27, fake: 20, strat: 'three', k: 0 };
    const w = ui.shell(el, { title: 'Взвешивания: найти тяжёлую монету', sub: 'Среди N монет одна фальшивая, она тяжелее. Чашечные весы дают три исхода: «левая тяжелее», «правая тяжелее», «равновесие». Сравните: класть на чаши по трети кандидатов (третья треть ждёт в стороне) или делить всех пополам.' });
    const nS = ui.slider(w.controls, { label: 'Монет N', min: 3, max: 40, step: 1, value: s.N, format: String, onInput: (v) => ((s.N = v), (s.fake = Math.min(s.fake, v)), fS.setMax(v), fS.set(s.fake), (s.k = 0), draw()) });
    const fS = ui.slider(w.controls, { label: 'Фальшивая — №', min: 1, max: s.N, step: 1, value: s.fake, format: String, onInput: (v) => ((s.fake = v), (s.k = 0), draw()) });
    ui.segmented(w.controls, { label: 'Стратегия', value: s.strat, options: [{ value: 'three', label: 'три кучки' }, { value: 'two', label: 'пополам' }], onChange: (v) => ((s.strat = v), (s.k = 0), draw()) });
    const pl = ui.player(w.controls, { label: 'Взвешивания', min: 0, max: 3, value: 0, fps: 1, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.k = k), draw(false)) });
    const coins = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;padding:8px 2px' });
    const scale = monoBox();
    w.main.append(coins, scale);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'взвешиваний' }, { key: 'left', label: 'кандидатов' }, { key: 'lb', label: 'нижняя граница ⌈log₃ N⌉' }, { key: 'bits', label: 'бит за взвешивание (в среднем)' }]);
    function draw(resetPlayer = true) {
      void nS;
      const L = weighLog(s.N, s.fake, s.strat);
      if (resetPlayer) {
        pl.setMax(L.length);
        pl.set(Math.min(s.k, L.length));
      }
      const k = Math.min(s.k, L.length);
      const cur = k < L.length ? L[k] : null;
      const candNow = k < L.length ? L[k].cand : [s.fake];
      coins.textContent = '';
      for (let i = 1; i <= s.N; i++) {
        let bg = 'var(--surface-2)';
        let bd = 'var(--border)';
        let col = 'var(--muted)';
        if (candNow.includes(i)) {
          col = 'var(--ink)';
          bd = 'var(--c-model)';
          bg = 'var(--surface)';
          if (cur && cur.L.includes(i)) (bd = 'var(--c-orange)'), (bg = 'color-mix(in srgb, var(--c-orange) 22%, var(--surface))');
          if (cur && cur.R.includes(i)) (bd = 'var(--c-aqua)'), (bg = 'color-mix(in srgb, var(--c-aqua) 22%, var(--surface))');
        }
        if (k === L.length && i === s.fake) (bd = 'var(--c-tree)'), (bg = 'var(--c-tree)'), (col = 'var(--surface)');
        coins.appendChild(H('span', { style: 'display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;font-size:.78rem;font-weight:650;border:2px solid ' + bd + ';background:' + bg + ';color:' + col }, String(i)));
      }
      const lines = L.slice(0, k).map((q, i) => (i + 1) + '. слева ' + rangeTxt(q.L) + ' | справа ' + rangeTxt(q.R) + (q.rest.length ? ' | в стороне ' + rangeTxt(q.rest) : '') + ' → ' + { left: 'левая тяжелее', right: 'правая тяжелее', eq: 'равновесие' }[q.out] + ', осталось ' + q.after);
      if (cur) lines.push('Сейчас: на левой чаше ' + rangeTxt(cur.L) + ' (оранжевые), на правой ' + rangeTxt(cur.R) + ' (бирюзовые)' + (cur.rest.length ? ', в стороне ' + rangeTxt(cur.rest) : '') + '.');
      else lines.push('Фальшивая монета найдена: № ' + s.fake + '.');
      scale.textContent = lines.join('\n');
      const lb = Math.ceil(Math.log(s.N) / Math.log(3) - 1e-12);
      st.set('k', k + ' из ' + L.length);
      st.set('left', String(candNow.length));
      st.set('lb', String(lb));
      st.set('bits', f3(lg(s.N) / Math.max(1, L.length)));
      note.innerHTML = 'Найти одну из N монет — значит получить log₂ N бит (для 27 монет — 4.755 бита). Взвешивание с тремя исходами даёт <b>не больше log₂ 3 ≈ 1.585 бита</b>, поэтому взвешиваний нужно не меньше log₃ N. Стратегия «три кучки» достигает этой границы: исходы равновероятны, и каждое взвешивание отсекает две трети. «Пополам» почти не использует исход «равновесие» и получает около 1 бита за взвешивание: для 27 монет в худшем случае ' + Math.max(...U.range(27, 1).map((f) => weighLog(27, f, 'two').length)) + ' взвешивания вместо 3 (в среднем 3.74). Опыт информативнее всего, когда его исходы <b>равновероятны</b>.';
    }
    w.pythonAction(() => `import math

def weighings(N, fake, strat):
    cand, log = list(range(1, N + 1)), []
    while len(cand) > 1:
        m = len(cand)
        a = math.ceil(m / 3) if strat == "three" else m // 2
        L, R, rest = cand[:a], cand[a:2 * a], cand[2 * a:]
        cand = L if fake in L else R if fake in R else rest
        log.append((L, R, len(cand)))
    return log

N, fake = ${s.N}, ${s.fake}
for strat in ("three", "two"):
    worst = max(len(weighings(N, f, strat)) for f in range(1, N + 1))
    print(f"{strat}: для монеты №{fake} — {len(weighings(N, fake, strat))} взвешиваний, в худшем случае {worst}")
print("нижняя граница ⌈log3 N⌉ =", math.ceil(math.log(N, 3) - 1e-12), "; log2 N =", round(math.log2(N), 3), "бит")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 3. Неожиданность события: −log₂ p
   * ============================================================================== */
  GBC.widget('surprise', (el) => {
    const s = { p: 0.25, log: false };
    const EV = [
      ['coin', 'орёл у честной монеты', 0.5], ['six', 'шестёрка на кубике', 1 / 6], ['not6', 'не шестёрка', 5 / 6], ['ace', 'туз из колоды в 52 карты', 1 / 13],
      ['as', 'пиковый туз', 1 / 52], ['ten', '10 орлов подряд', 1 / 1024], ['lotto', 'угадать 6 чисел из 45', 1 / 8145060], ['nowin', 'ни одного выигрыша за 1000 попыток с p = 1 %', Math.pow(0.99, 1000)],
    ];
    const w = ui.shell(el, { title: 'Неожиданность: чем реже событие, тем больше информации', sub: 'Информация (неожиданность, self-information) события с вероятностью p: I = −log₂ p бит. Выберите событие или двигайте p.' });
    ui.select(w.controls, { label: 'Событие', value: '', options: [{ value: '', label: '— свой p —' }].concat(EV.map((e) => ({ value: e[0], label: e[1] }))), onChange: (v) => {
      const e = EV.find((x) => x[0] === v);
      if (e) {
        s.p = e[2];
        if (s.p < 0.001 && !s.log) (s.log = true), tg.set(true);
        pS.set(s.p);
        draw();
      }
    } });
    const pS = ui.slider(w.controls, { label: 'Вероятность p', min: 1e-8, max: 1, log: true, value: s.p, format: (v) => sci(v), onInput: (v) => ((s.p = v), draw()) });
    const tg = ui.toggle(w.controls, { label: 'логарифмическая шкала p', checked: s.log, onChange: (v) => ((s.log = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'вероятность p', domain: [0, 1] }, y: { label: '−log₂ p, бит', domain: [0, 10.5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'p' }, { key: 'I', label: 'бит' }, { key: 'nat', label: 'нат (ln)' }, { key: 'eq', label: 'как орлов подряд' }]);
    function draw() {
      const I = -lg(s.p);
      if (s.log) {
        const ps = U.range(161).map((i) => Math.pow(10, -8 + i * 0.05));
        plot.opts.x = Object.assign({}, plot.opts.x, { type: 'log', ticks: [1e-8, 1e-6, 1e-4, 1e-2, 1], label: 'вероятность p (лог. шкала)' });
        plot.render([
          { type: 'line', x: ps, y: ps.map((p) => -lg(p)), color: 'model', width: 2.2 },
          { type: 'points', x: [s.p], y: [I], color: 'tree', r: 7 },
        ], { x: [1e-8, 1], y: [0, 28] });
      } else {
        const ps = U.linspace(0.002, 1, 400);
        plot.opts.x = Object.assign({}, plot.opts.x, { type: undefined, ticks: undefined, label: 'вероятность p' });
        plot.render([
          { type: 'line', x: ps, y: ps.map((p) => -lg(p)), color: 'model', width: 2.2 },
          { type: 'points', x: [Math.max(s.p, 0.002)], y: [Math.min(I, 10.3)], color: 'tree', r: 7 },
        ], { x: [0, 1], y: [0, 10.5] });
      }
      st.set('p', sci(s.p));
      st.set('I', f3(I));
      st.set('nat', f3(I * Math.LN2));
      st.set('eq', f2(I));
      note.innerHTML = 'Неожиданность события с вероятностью p равна числу честных подбрасываний монеты, у которых столь же редкий исход: p = 2<sup>−I</sup>. Орёл — 1 бит, шестёрка — 2.585, «не шестёрка» — всего 0.263, пиковый туз — 5.70, выигрыш в лотерею «6 из 45» — 22.96 бита (как 23 орла подряд). Достоверное событие (p = 1) ничего не сообщает. В логарифмической шкале график — прямая: умножение вероятностей превращается в сложение бит.';
    }
    w.pythonAction(() => `import math

p = ${py(s.p)}
print(f"p = {p:.4g}: {-math.log2(p):.3f} бит = {-math.log(p):.3f} нат")
for name, q in [("орёл", 1/2), ("шестёрка", 1/6), ("не шестёрка", 5/6), ("пиковый туз", 1/52), ("лотерея 6 из 45", 1 / math.comb(45, 6))]:
    print(f"{name:16s} {-math.log2(q):7.3f} бит")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 4. Цепочка фактов о карте: информация складывается, но условно
   * ============================================================================== */
  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'В', 'Д', 'К', 'Т'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const DECK = [];
  SUITS.forEach((su, si) => RANKS.forEach((r, ri) => DECK.push({ r, ri, su, si, red: si === 1 || si === 2 })));
  const FACTS = [
    { key: 'red', label: 'карта красная (♥ или ♦)', f: (c) => c.red },
    { key: 'hearts', label: 'масть — черви ♥', f: (c) => c.si === 1 },
    { key: 'face', label: 'картинка (валет, дама, король)', f: (c) => c.ri >= 9 && c.ri <= 11 },
    { key: 'ace', label: 'туз', f: (c) => c.ri === 12 },
    { key: 'high', label: 'старше семёрки (8 … туз)', f: (c) => c.ri >= 6 },
    { key: 'even', label: 'чётное число (2, 4, 6, 8, 10)', f: (c) => c.ri <= 8 && c.ri % 2 === 0 },
    { key: 'nospade', label: 'не пики', f: (c) => c.si !== 0 },
  ];
  const PY_FACT = { red: 'c[1] in "♥♦"', hearts: 'c[1] == "♥"', face: 'c[0] in ("В", "Д", "К")', ace: 'c[0] == "Т"', high: 'RANKS.index(c[0]) >= 6', even: 'c[0] in ("2", "4", "6", "8", "10")', nospade: 'c[1] != "♠"' };
  GBC.widget('card-facts', (el) => {
    const s = { order: [] };
    const w = ui.shell(el, { title: 'Цепочка фактов о загаданной карте', sub: 'Из колоды в 52 карты загадана одна. Включайте факты по одному — порядок важен. Информация факта = log₂ (было карт / стало карт). Сумма по цепочке всегда равна log₂ (52 / осталось), но вклад каждого факта зависит от того, что уже известно.' });
    const tgs = FACTS.map((F) => ui.toggle(w.controls, { label: F.label, checked: false, onChange: (v) => {
      s.order = s.order.filter((k) => k !== F.key);
      if (v) s.order.push(F.key);
      draw();
    } }));
    ui.button(w.controls, { label: 'Сбросить', icon: 'reset', onClick: () => ((s.order = []), tgs.forEach((t) => t.set(false)), draw()) });
    const exBtn = (label, order) => {
      const b = ui.button(w.controls, { label, onClick: () => {
        s.order = order.slice();
        tgs.forEach((t, i) => t.set(s.order.includes(FACTS[i].key)));
        draw();
      } });
      b.style.whiteSpace = 'normal';
      b.style.height = 'auto';
      b.style.textAlign = 'left';
    };
    exBtn('Красная → черви → картинка', ['red', 'hearts', 'face']);
    exBtn('Картинка → черви → красная', ['face', 'hearts', 'red']);
    const deckBox = scrollBox();
    const tbl = H('div');
    w.main.append(deckBox, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'осталось карт' }, { key: 'sum', label: 'сумма по цепочке, бит' }, { key: 'tot', label: 'log₂ (52 / осталось)' }]);
    function draw() {
      let cur = DECK.slice();
      const rows = [];
      let sum = 0;
      let contra = false;
      for (const key of s.order) {
        const F = FACTS.find((x) => x.key === key);
        const next = cur.filter(F.f);
        const info = next.length ? lg(cur.length / next.length) : Infinity;
        rows.push([F.label, String(cur.length), String(next.length), next.length ? f3(info) : '∞ (противоречие)']);
        if (!next.length) {
          contra = true;
          break;
        }
        sum += info;
        cur = next;
      }
      const alive = new Set(contra ? [] : cur);
      const cw = 34;
      const W = 13 * cw + 10;
      const svg = S('svg', { width: W, height: 4 * 34 + 8, viewBox: '0 0 ' + W + ' ' + (4 * 34 + 8), role: 'img', 'aria-label': 'Колода карт', style: 'display:block;margin:0 auto;min-width:' + W + 'px;max-width:none' });
      DECK.forEach((c) => {
        const x = 5 + c.ri * cw;
        const y = 4 + c.si * 34;
        const on = alive.has(c);
        svg.appendChild(S('rect', { x, y, width: cw - 4, height: 30, rx: 4, style: 'fill:' + (on ? 'var(--surface)' : 'var(--surface-2)') + ';stroke:' + (on ? 'var(--c-model)' : 'var(--border)') + ';stroke-width:' + (on ? 1.8 : 1) + ';opacity:' + (on ? 1 : 0.55) }));
        svg.appendChild(S('text', { x: x + (cw - 4) / 2, y: y + 19.5, 'text-anchor': 'middle', style: 'font-size:11.5px;font-weight:650;fill:' + (on ? (c.red ? 'var(--c-red)' : 'var(--ink)') : 'var(--muted)') + ';opacity:' + (on ? 1 : 0.6) }, c.r + c.su));
      });
      deckBox.replaceChildren(svg);
      tbl.textContent = '';
      if (rows.length) rowTable(tbl, ['факт', 'было', 'стало', 'информация, бит'], rows, null, false);
      st.set('n', contra ? '0' : String(cur.length));
      st.set('sum', contra ? '∞' : f3(sum));
      st.set('tot', contra ? '∞' : f3(lg(52 / cur.length)));
      note.innerHTML = contra ? 'Факт противоречит уже известным: вероятность 0, неожиданность бесконечна. В модели это катастрофа: если модель считает исход невозможным (q = 0), а он случился, log-loss бесконечен (шаг 28).' : 'Цепочка «красная → черви → картинка» даёт 1 + 1 + 2.115 = 4.115 бита, обратный порядок — 2.115 + 1 + 0: после «черви» факт «красная» уже <b>ничего не сообщает</b>. Сумма одна и та же: I(x, y) = I(x) + I(y | x). Независимые факты («картинка» и «черви») складываются без поправок, зависимые — с учётом уже известного.';
    }
    w.pythonAction(() => `import math

RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "В", "Д", "К", "Т"]
deck = [(r, su) for su in "♠♥♦♣" for r in RANKS]
facts = {
${FACTS.map((F) => '    "' + F.key + '": lambda c: ' + PY_FACT[F.key] + ',').join('\n')}
}
cur, total = deck, 0.0
for key in ${JSON.stringify(s.order.length ? s.order : ['red', 'hearts', 'face'])}:
    nxt = [c for c in cur if facts[key](c)]
    if not nxt:
        print(key, ": противоречие — неожиданность бесконечна"); break
    info = math.log2(len(cur) / len(nxt)); total += info
    print(f"{key:8s} {len(cur):2d} → {len(nxt):2d} карт: {info:.3f} бит")
    cur = nxt
print(f"сумма {total:.3f} бит = log2(52 / {len(cur)}) = {math.log2(52 / len(cur)):.3f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 5. Энтропия — средняя неожиданность
   * ============================================================================== */
  GBC.widget('entropy-bars', (el) => {
    const s = { k: 4, w: [4, 2, 1, 1, 1, 1, 1, 1] };
    const PRE = { uniform: () => [1, 1, 1, 1, 1, 1, 1, 1], peaked: () => [20, 1, 1, 1, 1, 1, 1, 1], pow2: () => ((s.k = 4), [8, 4, 2, 2, 1, 1, 1, 1]), sure: () => [1, 0, 0, 0, 0, 0, 0, 0] };
    const w = ui.shell(el, { title: 'Энтропия: средняя неожиданность исхода', sub: 'Распределение на k исходах (ползунки — веса, они нормируются в вероятности). Верхний график — вероятности pᵢ, нижний — вклад каждого исхода −pᵢ log₂ pᵢ. Сумма вкладов — энтропия H.' });
    ui.segmented(w.controls, { label: 'Готовые', value: null, options: [{ value: 'uniform', label: 'ровно' }, { value: 'peaked', label: 'пик' }, { value: 'pow2', label: '½ ¼ ⅛ ⅛' }, { value: 'sure', label: 'известно' }], onChange: (v) => ((s.w = PRE[v]()), sl.forEach((x, i) => x.set(s.w[i])), ks.set(s.k), draw()) });
    const ks = ui.slider(w.controls, { label: 'Исходов k', min: 2, max: 8, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const sl = U.range(8).map((i) => ui.slider(w.controls, { label: 'вес исхода ' + (i + 1), min: 0, max: 20, step: 0.5, value: s.w[i], format: f1, onInput: (v) => ((s.w[i] = v), draw()) }));
    const p1 = new GBC.Plot(w.main, { height: 200, x: { label: 'исход', domain: [0.4, 8.6], ticks: U.range(8, 1) }, y: { label: 'вероятность pᵢ', domain: [0, 1] } });
    const p2 = new GBC.Plot(w.main, { height: 190, x: { label: 'исход', domain: [0.4, 8.6], ticks: U.range(8, 1) }, y: { label: 'вклад −pᵢ log₂ pᵢ', domain: [0, 0.6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'H', label: 'энтропия H, бит' }, { key: 'max', label: 'максимум log₂ k' }, { key: 'eff', label: '2ᴴ — «эффективно исходов»' }, { key: 'rel', label: 'H / log₂ k' }]);
    function draw() {
      sl.forEach((x, i) => (x.el.hidden = i >= s.k));
      const ps = normalize(s.w.slice(0, s.k));
      const Hh = Hb(ps);
      const xs = U.range(s.k, 1);
      p1.render([{ type: 'bars', x: xs, y: ps, color: 'model', width: 0.7, maxPx: 46, tooltip: (i) => [['p', f3(ps[i])], ['−log₂ p', ps[i] > 0 ? f3(-lg(ps[i])) : '∞']] }], { x: [0.4, s.k + 0.6] });
      const con = ps.map((p) => (p > 0 ? -p * lg(p) : 0));
      p2.render([
        { type: 'bars', x: xs, y: con, color: 'tree', width: 0.7, maxPx: 46, tooltip: (i) => [['вклад', f4(con[i])]] },
        { type: 'hline', y: 1 / (Math.E * Math.LN2), color: 'muted', dash: '4 4', width: 1, text: 'максимум вклада 0.531 (p = 1/e)' },
      ], { x: [0.4, s.k + 0.6] });
      st.set('H', f4(Hh));
      st.set('max', f4(lg(s.k)));
      st.set('eff', f3(Math.pow(2, Hh)));
      st.set('rel', f3(Hh / lg(s.k)));
      note.innerHTML = 'Энтропия — <b>средняя неожиданность</b>: H = Σ pᵢ · (−log₂ pᵢ). Монета — 1 бит, кубик — 2.585, распределение ½, ¼, ⅛, ⅛ — 1.75 бита. Самый вероятный исход вносит не самый большой вклад: он почти не удивляет. Редкие исходы удивляют сильно, но случаются редко. Наибольший вклад −p log₂ p = 0.531 у исхода с p = 1/e ≈ 0.368.';
    }
    w.pythonAction(() => PY_NP + PY_H + `
w = np.array(${JSON.stringify(s.w.slice(0, s.k))}, float)
p = w / w.sum()
print("p =", p.round(4))
print("вклады −p·log2 p:", np.where(p > 0, -p * np.log2(np.where(p > 0, p, 1)), 0).round(4))
print(f"H = {H(p):.4f} бит, максимум log2 k = {np.log2(len(p)):.4f}, 2^H = {2 ** H(p):.3f}")
from scipy.stats import entropy
print("scipy:", entropy(p, base=2))
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 6. Бинарная энтропия и вогнутость: смешивание повышает неопределённость
   * ============================================================================== */
  GBC.widget('binary-entropy', (el) => {
    const s = { p1: 0.9, p2: 0.1, a: 0.5 };
    const w = ui.shell(el, { title: 'Бинарная энтропия h(p) и смешивание', sub: 'Две группы объектов: в первой доля класса 1 равна p₁, во второй p₂; первая составляет долю α от всех. Смешав группы, получим долю p = αp₁ + (1 − α)p₂. Энтропия смеси (точка на кривой) всегда не ниже среднего энтропий групп (точка на хорде).' });
    ui.slider(w.controls, { label: 'Доля класса 1 в группе 1: p₁', min: 0, max: 1, step: 0.01, value: s.p1, format: f2, onInput: (v) => ((s.p1 = v), draw()) });
    ui.slider(w.controls, { label: 'Доля класса 1 в группе 2: p₂', min: 0, max: 1, step: 0.01, value: s.p2, format: f2, onInput: (v) => ((s.p2 = v), draw()) });
    ui.slider(w.controls, { label: 'Вес группы 1: α', min: 0, max: 1, step: 0.01, value: s.a, format: f2, onInput: (v) => ((s.a = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'доля класса 1, p', domain: [0, 1] }, y: { label: 'h(p), бит', domain: [0, 1.12] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'h1', label: 'h(p₁)' }, { key: 'h2', label: 'h(p₂)' }, { key: 'mix', label: 'h(смеси)' }, { key: 'avg', label: 'αh(p₁) + (1 − α)h(p₂)' }, { key: 'gap', label: 'разрыв = прирост информации' }]);
    function draw() {
      const { p1, p2, a } = s;
      const pm = a * p1 + (1 - a) * p2;
      const h1 = hbin(p1);
      const h2 = hbin(p2);
      const hm = hbin(pm);
      const avg = a * h1 + (1 - a) * h2;
      const ps = U.linspace(0, 1, 401);
      plot.render([
        { type: 'line', x: ps, y: ps.map(hbin), color: 'model', width: 2.2, label: 'h(p)' },
        { type: 'segments', x1: [p1], y1: [h1], x2: [p2], y2: [h2], color: 'muted', width: 1.6, opacity: 1 },
        { type: 'segments', x1: [pm], y1: [avg], x2: [pm], y2: [hm], color: 'red', width: 4, opacity: 1 },
        { type: 'points', x: [p1, p2], y: [h1, h2], color: 'data', r: 6 },
        { type: 'points', x: [pm], y: [hm], color: 'tree', r: 6, label: 'смесь' },
        { type: 'points', x: [pm], y: [avg], color: 'ink2', r: 4 },
      ]);
      st.set('h1', f3(h1));
      st.set('h2', f3(h2));
      st.set('mix', f3(hm));
      st.set('avg', f3(avg));
      st.set('gap', f3(hm - avg));
      note.innerHTML = 'Кривая h(p) = −p log₂ p − (1 − p) log₂ (1 − p): ноль на краях, 1 бит при p = ½, h(0.11) ≈ 0.5, h(0.25) ≈ 0.811. Она <b>вогнута</b> (лежит над любой своей хордой), поэтому смесь неопределённее, чем группы в среднем. Красный разрыв — ровно то, что дерево решений выигрывает, разделив смесь обратно на группы: <b>прирост информации</b> разбиения (шаг 32). Группы 0.9 и 0.1 пополам: смесь — 1 бит, группы — по 0.469, прирост 0.531 бита.';
    }
    w.pythonAction(() => PY_NP + `
h = lambda p: 0.0 if p in (0, 1) else -p * np.log2(p) - (1 - p) * np.log2(1 - p)
p1, p2, a = ${py(s.p1)}, ${py(s.p2)}, ${py(s.a)}
pm = a * p1 + (1 - a) * p2
gap = h(pm) - (a * h(p1) + (1 - a) * h(p2))
print(f"h(смеси) = {h(pm):.4f}, среднее h групп = {a * h(p1) + (1 - a) * h(p2):.4f}, разрыв = {gap:.4f} бит")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 6. Правило группировки: энтропия = сумма энтропий вопросов
   * ============================================================================== */
  const GROUPINGS = {
    'A|BCD': { codes: ['0', '10', '110', '111'], qs: [[[0], [1, 2, 3]], [[1], [2, 3]], [[2], [3]]] },
    'AB|CD': { codes: ['00', '01', '10', '11'], qs: [[[0, 1], [2, 3]], [[0], [1]], [[2], [3]]] },
    'AC|BD': { codes: ['00', '10', '01', '11'], qs: [[[0, 2], [1, 3]], [[0], [2]], [[1], [3]]] },
  };
  GBC.widget('grouping', (el) => {
    const s = { w: [4, 2, 1, 1], g: 'A|BCD' };
    const names = ['A', 'B', 'C', 'D'];
    const w = ui.shell(el, { title: 'Правило группировки: исход узнаём серией вопросов', sub: 'Четыре исхода A, B, C, D. Узнаём исход серией вопросов «да/нет», группируя исходы по-разному. Каждый вопрос даёт h(доли ответа) бит, но задаётся не всегда — с вероятностью дойти до него. Сумма «вероятность × h» равна энтропии при любой группировке.' });
    ui.segmented(w.controls, { label: 'Первый вопрос', value: s.g, options: Object.keys(GROUPINGS).map((k) => ({ value: k, label: k.replace('|', ' | ') })), onChange: (v) => ((s.g = v), draw()) });
    names.forEach((nm, i) => ui.slider(w.controls, { label: 'вес ' + nm, min: 0.5, max: 10, step: 0.5, value: s.w[i], format: f1, onInput: (v) => ((s.w[i] = v), draw()) }));
    const treeBox = H('div');
    const tbl = H('div');
    w.main.append(treeBox, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sum', label: 'Σ P(дойти) · h, бит' }, { key: 'H', label: 'энтропия H' }, { key: 'q', label: 'среднее число вопросов' }]);
    function draw() {
      const ps = normalize(s.w);
      const G = GROUPINGS[s.g];
      const rows = [];
      let sum = 0;
      let qn = 0;
      G.qs.forEach(([L, R], qi) => {
        const pl = U.sum(L.map((i) => ps[i]));
        const pr = U.sum(R.map((i) => ps[i]));
        const reach = pl + pr;
        const hh = hbin(pl / reach);
        sum += reach * hh;
        qn += reach;
        const txt = '«' + L.map((i) => names[i]).join('') + ' или ' + R.map((i) => names[i]).join('') + '?»';
        rows.push([String(qi + 1) + '. ' + txt, f3(reach), f3(pl / reach) + ' : ' + f3(pr / reach), f3(hh), f3(reach * hh)]);
      });
      // подписи узлов: по префиксу общего кода группы
      const nodeNote = (prefix) => {
        for (const [L, R] of G.qs) {
          const all = L.concat(R);
          const pre = commonPrefix(all.map((i) => G.codes[i]));
          if (pre === prefix) {
            const pl = U.sum(L.map((i) => ps[i]));
            const reach = pl + U.sum(R.map((i) => ps[i]));
            return 'P = ' + f2(reach) + ', h = ' + f2(hbin(pl / reach));
          }
        }
        return '';
      };
      treeBox.replaceChildren(codeTree(G.codes, names, { nodeNote, leafNote: (i) => 'p = ' + f3(ps[i]), dx: 92, aria: 'Дерево вопросов' }));
      rowTable(tbl, ['вопрос', 'P(дойти)', 'доли ответа', 'h, бит', 'вклад'], rows, null, false);
      st.set('sum', f4(sum));
      st.set('H', f4(Hb(ps)));
      st.set('q', f3(qn));
      note.innerHTML = 'Для ½, ¼, ⅛, ⅛ и группировки A | BCD: 1·h(½) + ½·h(½) + ¼·h(½) = 1 + 0.5 + 0.25 = 1.75 бита. Для AB | CD: h(¾) + ¾·h(⅔) + ¼·h(½) = 0.811 + 0.689 + 0.25 — тоже 1.75. Энтропия не зависит от того, как мы дробим вопрос, — это <b>правило группировки</b> (цепное правило). А вот <b>среднее число вопросов</b> зависит: если вопрос не делит вероятность пополам, он даёт меньше бита (шаг 7).';
    }
    function commonPrefix(arr) {
      let p = arr[0];
      for (const c of arr) while (!c.startsWith(p)) p = p.slice(0, -1);
      return p;
    }
    w.pythonAction(() => PY_NP + `
h = lambda p: 0.0 if p in (0, 1) else -p * np.log2(p) - (1 - p) * np.log2(1 - p)
w = np.array(${JSON.stringify(s.w)}, float); p = w / w.sum()
questions = ${JSON.stringify(GROUPINGS[s.g].qs)}   # [левая группа, правая группа]
total = n_q = 0.0
for L, R in questions:
    pl, pr = p[L].sum(), p[R].sum()
    total += (pl + pr) * h(pl / (pl + pr)); n_q += pl + pr
H = -(p * np.log2(p)).sum()
print(f"Σ P(дойти)·h = {total:.4f}, энтропия H = {H:.4f}, среднее число вопросов {n_q:.3f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 7. «20 вопросов»: энтропия = среднее число вопросов лучшей стратегии
   * ============================================================================== */
  const ANIMALS = ['кошка', 'собака', 'попугай', 'хомяк', 'рыбка', 'черепаха', 'кролик', 'змея'];
  const ANIMAL_P = { pets: [0.3, 0.25, 0.15, 0.1, 0.08, 0.06, 0.04, 0.02], uniform: [1, 1, 1, 1, 1, 1, 1, 1].map((v) => v / 8), extreme: [0.86, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02] };
  function stratCodes(ps, strat) {
    const k = ps.length;
    if (strat === 'seq') return U.range(k).map((i) => (i < k - 1 ? '1'.repeat(i) + '0' : '1'.repeat(k - 1)));
    if (strat === 'half') return U.range(k).map((i) => i.toString(2).padStart(Math.ceil(lg(k)), '0'));
    return huffman(ps).codes;
  }
  GBC.widget('twenty-q', (el) => {
    const s = { dist: 'pets', strat: 'huff', secret: 2, games: null };
    const w = ui.shell(el, { title: '«Угадай животное»: стратегии вопросов', sub: 'Друг загадывает домашнее животное — с известными вероятностями. Стратегия вопросов — это дерево: каждый узел — вопрос «да/нет», путь к листу — код животного. Среднее число вопросов Σ pᵢ·(длина пути) не меньше энтропии и у лучшей стратегии отличается от неё меньше чем на 1.' });
    ui.segmented(w.controls, { label: 'Вероятности', value: s.dist, options: [{ value: 'pets', label: 'обычные' }, { value: 'uniform', label: 'равные' }, { value: 'extreme', label: 'почти всегда кошка' }], onChange: (v) => ((s.dist = v), (s.games = null), draw()) });
    ui.segmented(w.controls, { label: 'Стратегия', value: s.strat, options: [{ value: 'seq', label: 'по очереди' }, { value: 'half', label: 'пополам по списку' }, { value: 'huff', label: 'Хаффман' }], onChange: (v) => ((s.strat = v), (s.games = null), draw()) });
    ui.select(w.controls, { label: 'Загадано', value: String(s.secret), options: ANIMALS.map((a, i) => ({ value: String(i), label: a })), onChange: (v) => ((s.secret = +v), draw()) });
    ui.button(w.controls, { label: 'Сыграть 1000 раз', icon: 'run', onClick: () => {
      const ps = ANIMAL_P[s.dist];
      const codes = stratCodes(ps, s.strat);
      const rng = new GBC.RNG(16);
      const cum = cumsum(ps);
      let tot = 0;
      for (let g = 0; g < 1000; g++) tot += codes[pick(cum, rng.random())].length;
      s.games = tot / 1000;
      draw();
    } });
    const treeBox = H('div');
    const tbl = H('div');
    w.main.append(treeBox, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'H', label: 'энтропия H' }, { key: 'L', label: 'в среднем вопросов' }, { key: 'sim', label: '1000 игр (зерно 16)' }, { key: 'this', label: 'вопросов для загаданного' }]);
    function draw() {
      const ps = ANIMAL_P[s.dist];
      const codes = stratCodes(ps, s.strat);
      const L = avgLen(ps, codes.map((c) => c.length));
      treeBox.replaceChildren(codeTree(codes, ANIMALS, { dx: 76, highlight: codes[s.secret], leafNote: (i) => 'p = ' + U.fmt(ps[i], 3), aria: 'Дерево вопросов' }));
      rowTable(tbl, ['животное', 'p', '−log₂ p', 'вопросов', 'путь в дереве'], ANIMALS.map((a, i) => [a, U.fmt(ps[i], 3), f2(-lg(ps[i])), String(codes[i].length), codes[i]]), (i) => i === s.secret, false);
      st.set('H', f3(Hb(ps)));
      st.set('L', f3(L));
      st.set('sim', s.games === null ? 'нажмите кнопку' : f3(s.games));
      st.set('this', String(codes[s.secret].length));
      const txt = { seq: '«По очереди» спрашивает «это кошка?», «это собака?»… Хорошо, когда первое животное почти наверняка; плохо при равных вероятностях: в среднем 4.375 вопроса вместо 3.', half: '«Пополам по списку» делит список, не глядя на вероятности: всегда 3 вопроса. При равных вероятностях это идеал (H = 3), при неравных — лишние вопросы.', huff: '<b>Хаффман</b> строит дерево снизу, сливая два самых редких варианта (шаг 14). Это лучшая стратегия: среднее число вопросов не больше H + 1, а при вероятностях-степенях двойки равно H.' };
      note.innerHTML = txt[s.strat] + ' Для «обычных» вероятностей: H = 2.598 бита; по очереди — 2.83, пополам — 3, Хаффман — 2.63 вопроса. Вероятное животное получает короткий путь, редкое — длинный: длина пути ≈ −log₂ p.';
    }
    w.pythonAction(() => PY_NP + PY_HUFF + `
animals = ${JSON.stringify(ANIMALS)}
p = ${JSON.stringify(ANIMAL_P[s.dist])}
strategies = {
    "по очереди": [("1" * i + "0") if i < 7 else "1" * 7 for i in range(8)],
    "пополам": [format(i, "03b") for i in range(8)],
    "Хаффман": huffman(p),
}
H = -sum(q * np.log2(q) for q in p)
print(f"H = {H:.3f} бит")
for name, codes in strategies.items():
    print(f"{name:11s}: в среднем {sum(q * len(c) for q, c in zip(p, codes)):.3f} вопроса")
` + PY_RNG + `rng, cum = Mulberry32(16), np.cumsum(p)
codes = strategies[${JSON.stringify({ seq: 'по очереди', half: 'пополам', huff: 'Хаффман' }[s.strat])}]
games = [len(codes[next(j for j, c in enumerate(cum) if u < c)]) for u in (rng.random() for _ in range(1000))]
print("1000 игр:", np.mean(games))
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 8. Перплексия: 2ᴴ — эффективное число вариантов
   * ============================================================================== */
  GBC.widget('perplexity', (el) => {
    const s = { k: 10, z: 1 };
    const w = ui.shell(el, { title: 'Перплексия: сколько вариантов «на самом деле»', sub: 'Распределение Ципфа на k вариантах: pᵢ ∝ 1/iˢ. При s = 0 все равны, с ростом s вероятность собирается в первых вариантах. Перплексия 2ᴴ — число равновероятных вариантов с той же энтропией.' });
    ui.slider(w.controls, { label: 'Вариантов k', min: 2, max: 50, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.slider(w.controls, { label: 'Перекос s', min: 0, max: 3, step: 0.05, value: s.z, format: f2, onInput: (v) => ((s.z = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'вариант i', domain: [0.4, 10.6] }, y: { label: 'pᵢ', domain: [0, 0.5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'H', label: 'H, бит' }, { key: 'pp', label: 'перплексия 2ᴴ' }, { key: 'k', label: 'всего k' }, { key: 'top', label: 'самый частый' }]);
    function draw() {
      const ps = normalize(U.range(s.k, 1).map((i) => Math.pow(i, -s.z)));
      const Hh = Hb(ps);
      const pp = Math.pow(2, Hh);
      plot.render([
        { type: 'bars', x: U.range(s.k, 1), y: ps, color: 'model', width: 0.75, maxPx: 30, tooltip: (i) => [['i', String(i + 1)], ['p', f4(ps[i])]] },
        { type: 'vline', x: pp + 0.5, color: 'tree', width: 2, dash: '6 4', text: '2ᴴ = ' + f2(pp) },
      ], { x: [0.4, s.k + 0.6], y: [0, Math.max(0.12, ps[0] * 1.15)] });
      st.set('H', f3(Hh));
      st.set('pp', f2(pp));
      st.set('k', String(s.k));
      st.set('top', pct(ps[0], 1));
      note.innerHTML = 'Перплексия (perplexity) — «во сколько вариантов на самом деле приходится выбирать». Кубик: 6. Распределение ½, ¼, ⅛, ⅛: 2<sup>1.75</sup> ≈ 3.36 — неопределённость как у выбора из 3.36 равных вариантов. Классы 90 % / 5 % / 5 %: перплексия 1.48 — «полтора класса». У языковых моделей перплексия 20 значит: модель в среднем колеблется, как между 20 равновероятными словами. В бустинге exp(log-loss) — перплексия прогноза: 1 у идеальной модели, 2 у монетки.';
    }
    w.pythonAction(() => PY_NP + `
k, s = ${s.k}, ${py(s.z)}
p = 1 / np.arange(1, k + 1) ** s; p /= p.sum()
H = -(p * np.log2(p)).sum()
print(f"H = {H:.3f} бит, перплексия 2^H = {2**H:.2f} из {k}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 9. Энтропия по выборке: оценка «по частотам» занижает
   * ============================================================================== */
  const EST_DIST = {
    u8: { label: 'равномерное, 8 исходов', p: Array(8).fill(1 / 8) },
    skew: { label: 'перекошенное, 8 исходов', p: [1 / 2, 1 / 4, 1 / 8, 1 / 16, 1 / 32, 1 / 64, 1 / 128, 1 / 128] },
    u32: { label: 'равномерное, 32 исхода', p: Array(32).fill(1 / 32) },
  };
  const EST_NS = [5, 10, 20, 50, 100, 200, 500, 1000];
  /** R повторов: оценка «по частотам» и с поправкой Миллера — Мэдоу (m − 1)/(2n ln 2). */
  function entropySims(p, n, R, seed) {
    const rng = new GBC.RNG(seed);
    const cum = cumsum(p);
    const plug = [];
    const mm = [];
    const cnt = new Array(p.length);
    for (let r = 0; r < R; r++) {
      cnt.fill(0);
      for (let i = 0; i < n; i++) cnt[pick(cum, rng.random())]++;
      let hh = 0;
      let m = 0;
      for (const c of cnt) if (c > 0) (hh -= (c / n) * lg(c / n)), m++;
      plug.push(hh);
      mm.push(hh + (m - 1) / (2 * n * Math.LN2));
    }
    return { plug, mm };
  }
  GBC.widget('entropy-estimate', (el) => {
    const s = { d: 'u8', n: 20 };
    const R = 400;
    const w = ui.shell(el, { title: 'Энтропия по выборке: оценка по частотам занижена', sub: 'Из известного распределения берём n наблюдений и считаем энтропию по частотам (plug-in). Повторяем 400 раз. Гистограмма — разброс оценок; нижний график — среднее оценки при разных n. Поправка Миллера — Мэдоу прибавляет (m − 1)/(2n ln 2), где m — число встретившихся исходов.' });
    ui.segmented(w.controls, { label: 'Распределение', value: s.d, options: Object.keys(EST_DIST).map((k) => ({ value: k, label: EST_DIST[k].label })), onChange: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'Размер выборки n', values: EST_NS, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 210, x: { label: 'оценка энтропии, бит', domain: [0, 3.2] }, y: { label: 'доля повторов', domain: [0, 0.3] } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'размер выборки n (лог.)', type: 'log', domain: [4, 1200], ticks: [5, 10, 20, 50, 100, 200, 500, 1000] }, y: { label: 'среднее оценки, бит', domain: [0, 3.2] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'H', label: 'истинная H' }, { key: 'plug', label: 'среднее по частотам' }, { key: 'bias', label: 'смещение' }, { key: 'mm', label: 'с поправкой' }]);
    const cache = {};
    const sims = (d, n) => cache[d + n] || (cache[d + n] = entropySims(EST_DIST[d].p, n, R, 2026));
    function draw() {
      const p = EST_DIST[s.d].p;
      const Ht = Hb(p);
      const { plug, mm } = sims(s.d, s.n);
      const mP = U.mean(plug);
      const mM = U.mean(mm);
      const lo = Math.max(0, Math.floor((Math.min(...plug) - 0.1) * 10) / 10);
      const hi = Math.max(Ht * 1.08, 1);
      const nb = 40;
      const bw = (hi - lo) / nb;
      const counts = new Array(nb).fill(0);
      for (const v of plug) counts[Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / bw)))]++;
      const xs = counts.map((_, i) => lo + (i + 0.5) * bw);
      const ys = counts.map((c) => c / R);
      p1.render([
        { type: 'bars', x: xs, y: ys, width: bw, maxPx: 60, color: 'muted', label: 'оценки по частотам' },
        { type: 'vline', x: Ht, color: 'ink', width: 2, text: 'истина' },
        { type: 'vline', x: mP, color: 'model', width: 2, dash: '6 4', label: 'среднее по частотам' },
        { type: 'vline', x: mM, color: 'tree', width: 2, dash: '3 3', label: 'среднее с поправкой' },
      ], { x: [lo, hi], y: [0, Math.max(...ys) * 1.2 + 0.01] });
      const mp = EST_NS.map((n) => U.mean(sims(s.d, n).plug));
      const mmv = EST_NS.map((n) => U.mean(sims(s.d, n).mm));
      p2.render([
        { type: 'hline', y: Ht, color: 'ink', dash: '6 4', width: 1.5, label: 'истинная H' },
        { type: 'line', x: EST_NS, y: EST_NS.map((n) => Math.max(0, Ht - (p.length - 1) / (2 * n * Math.LN2))), color: 'muted', dash: '3 3', width: 1.4, label: 'H − (k − 1)/(2n ln 2)' },
        { type: 'line', x: EST_NS, y: mp, color: 'model', width: 2, label: 'по частотам' },
        { type: 'points', x: EST_NS, y: mp, color: 'model', r: 4 },
        { type: 'line', x: EST_NS, y: mmv, color: 'tree', width: 2, label: 'с поправкой Миллера — Мэдоу' },
        { type: 'points', x: EST_NS, y: mmv, color: 'tree', r: 4 },
        { type: 'points', x: [s.n], y: [mP], color: 'model', r: 7 },
      ], { y: [0, hi] });
      st.set('H', f3(Ht));
      st.set('plug', f3(mP));
      st.set('bias', U.fmtSigned(mP - Ht, 3));
      st.set('mm', f3(mM));
      note.innerHTML = 'Оценка по частотам <b>в среднем ниже истины</b>: редкие исходы в маленькую выборку не попадают, а случайные перекосы частот выглядят как «порядок». При n = 20 и 8 равновероятных исходах (H = 3 бита) средняя оценка — ' + f3(U.mean(sims('u8', 20).plug)) + ', поправка подтягивает до ' + f3(U.mean(sims('u8', 20).mm)) + '. Для 32 исходов и n = 20 оценка не может превысить log₂ 20 = 4.32, а в среднем выходит ' + f3(U.mean(sims('u32', 20).plug)) + ' вместо 5. Это важно для деревьев: энтропия маленького листа систематически занижена — лист кажется чище, чем есть.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + `
p = np.array(${JSON.stringify(EST_DIST[s.d].p)}); cum = np.cumsum(p)
n, R = ${s.n}, 400
rng = Mulberry32(2026)
plug, mm = [], []
for _ in range(R):
    cnt = np.zeros(len(p), int)
    for _ in range(n):
        u = rng.random()
        cnt[min(np.searchsorted(cum, u, side="right"), len(p) - 1)] += 1
    f = cnt[cnt > 0] / n
    hh = -(f * np.log2(f)).sum()
    plug.append(hh); mm.append(hh + (len(f) - 1) / (2 * n * np.log(2)))
H = -(p * np.log2(p)).sum()
print(f"истина {H:.3f}, по частотам {np.mean(plug):.3f}, с поправкой {np.mean(mm):.3f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 10. Максимальная энтропия: кубик Джейнса
   * ============================================================================== */
  function maxentDice(m) {
    const f = (lam) => {
      let a = 0;
      let b = 0;
      for (let i = 1; i <= 6; i++) {
        const e = Math.exp(lam * (i - 3.5));
        a += i * e;
        b += e;
      }
      return a / b - m;
    };
    let lo = -30;
    let hi = 30;
    for (let it = 0; it < 200; it++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < 0) lo = mid;
      else hi = mid;
    }
    const lam = (lo + hi) / 2;
    const ps = normalize(U.range(6, 1).map((i) => Math.exp(lam * (i - 3.5))));
    return { lam, ps };
  }
  GBC.widget('maxent-dice', (el) => {
    const s = { m: 4.5 };
    const w = ui.shell(el, { title: 'Принцип максимальной энтропии: кубик со средним 4.5', sub: 'Про кубик известно только среднее число очков. Каким распределением его описать? Среди всех распределений с этим средним выберем самое неопределённое — с наибольшей энтропией. Оно имеет вид pᵢ ∝ exp(λ·i).' });
    ui.slider(w.controls, { label: 'Известное среднее', min: 1.1, max: 5.9, step: 0.1, value: s.m, format: f1, onInput: (v) => ((s.m = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 270, x: { label: 'грань', domain: [0.4, 6.6], ticks: [1, 2, 3, 4, 5, 6] }, y: { label: 'вероятность', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'lam', label: 'λ' }, { key: 'H', label: 'H максимальная' }, { key: 'two', label: 'H «две соседние грани»' }, { key: 'max', label: 'log₂ 6' }]);
    function draw() {
      const { lam, ps } = maxentDice(s.m);
      const a = Math.floor(s.m + 1e-9);
      const two = new Array(6).fill(0);
      if (Math.abs(s.m - a) < 1e-9) two[a - 1] = 1;
      else (two[a - 1] = a + 1 - s.m), (two[a] = s.m - a);
      plot.render([
        { type: 'bars', x: U.range(6, 1).map((i) => i - 0.18), y: two, width: 0.32, maxPx: 26, color: 'muted', label: 'две соседние грани' },
        { type: 'bars', x: U.range(6, 1).map((i) => i + 0.18), y: ps, width: 0.32, maxPx: 26, color: 'model', label: 'максимум энтропии', tooltip: (i) => [['грань', String(i + 1)], ['p', f4(ps[i])]] },
      ], { y: [0, Math.max(0.4, Math.max(...ps, ...two) * 1.1)] });
      st.set('lam', f3(lam));
      st.set('H', f3(Hb(ps)));
      st.set('two', f3(Hb(two)));
      st.set('max', '2.585');
      note.innerHTML = 'Среднее 3.5 — честный кубик (λ = 0, H = 2.585). Среднее 4.5: λ = 0.371, вероятности 0.054, 0.079, 0.114, 0.165, 0.240, 0.348, H = 2.328 бита. Другие распределения с тем же средним — «только 4 и 5» (H = 1) или «равномерно на 3–6» (H = 2) — <b>утверждают больше</b>, чем мы знаем. Максимум энтропии — честный выбор «ничего лишнего». Его форма pᵢ ∝ e^{λi} — это <b>softmax</b> от линейной функции. Логистическая регрессия и softmax-модели — модели максимальной энтропии при ограничениях на средние признаков.';
    }
    w.pythonAction(() => PY_NP + `from scipy.optimize import brentq

m = ${py(s.m)}
faces = np.arange(1, 7)
mean = lambda lam: (faces * np.exp(lam * faces)).sum() / np.exp(lam * faces).sum()
lam = brentq(lambda l: mean(l) - m, -30, 30)
p = np.exp(lam * faces); p /= p.sum()
print(f"λ = {lam:.4f}; p = {p.round(4)}; H = {-(p * np.log2(p)).sum():.4f} бит")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 11. Дифференциальная энтропия и квантование
   * ============================================================================== */
  const R3 = Math.sqrt(3);
  const B2 = 1 / Math.SQRT2;
  const S2 = Math.sqrt(0.19);
  const DENS = {
    normal: { label: 'нормальное', f: (x) => phi(x), h: 0.5 * lg(2 * Math.PI * Math.E) },
    laplace: { label: 'Лапласа', f: (x) => Math.exp(-Math.abs(x) / B2) / (2 * B2), h: lg(2 * Math.E * B2) },
    uniform: { label: 'равномерное', f: (x) => (Math.abs(x) <= R3 ? 1 / (2 * R3) : 0), h: lg(2 * R3) },
    bimodal: { label: 'двугорбое', f: (x) => 0.5 * (phi((x - 0.9) / S2) + phi((x + 0.9) / S2)) / S2, h: null },
  };
  /** Вероятности корзин [kΔ, (k + 1)Δ) на [−7, 7]; равномерное — точно, остальные — Симпсоном. */
  function binProbs(key, D) {
    const out = [];
    const K = Math.ceil(7 / D);
    for (let k = -K; k < K; k++) {
      const a = k * D;
      const b = a + D;
      let P;
      if (key === 'uniform') P = Math.max(0, Math.min(b, R3) - Math.max(a, -R3)) / (2 * R3);
      else {
        const m = 16;
        const hh = D / m;
        let sm = DENS[key].f(a) + DENS[key].f(b);
        for (let j = 1; j < m; j++) sm += (j % 2 ? 4 : 2) * DENS[key].f(a + j * hh);
        P = (sm * hh) / 3;
      }
      out.push({ a, b, P });
    }
    return out;
  }
  const diffH = (key) => {
    if (DENS[key].h !== null) return DENS[key].h;
    if (DENS[key]._h === undefined) {
      const xs = U.linspace(-7, 7, 14001);
      const dx = xs[1] - xs[0];
      let sm = 0;
      for (const x of xs) {
        const f = DENS[key].f(x);
        if (f > 0) sm -= f * lg(f) * dx;
      }
      DENS[key]._h = sm;
    }
    return DENS[key]._h;
  };
  const quantH = (key, D) => Hb(binProbs(key, D).map((b) => b.P));
  GBC.widget('diff-entropy', (el) => {
    const s = { key: 'normal', D: 0.25 };
    const w = ui.shell(el, { title: 'Непрерывная величина: дифференциальная энтропия', sub: 'Четыре распределения с одинаковой дисперсией 1. Округлим x до шага Δ (корзины ширины Δ) — получится дискретная величина X_Δ с обычной энтропией. При малом Δ она растёт как h(X) − log₂ Δ, где h(X) = −∫ f log₂ f dx — дифференциальная энтропия.' });
    ui.segmented(w.controls, { label: 'Распределение', value: s.key, options: Object.keys(DENS).map((k) => ({ value: k, label: DENS[k].label })), onChange: (v) => ((s.key = v), draw()) });
    ui.slider(w.controls, { label: 'Шаг квантования Δ', min: 0.01, max: 1, log: true, value: s.D, format: f3, onInput: (v) => ((s.D = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'x', domain: [-4, 4] }, y: { label: 'плотность', domain: [0, 0.75] } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'шаг Δ (лог.)', type: 'log', domain: [0.01, 1], ticks: [0.01, 0.03, 0.1, 0.3, 1] }, y: { label: 'бит', domain: [0, 9] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'h', label: 'h(X), бит' }, { key: 'HD', label: 'H(X_Δ)' }, { key: 'appr', label: 'h − log₂ Δ' }, { key: 'diff', label: 'разница' }]);
    function draw() {
      const d = DENS[s.key];
      const hx = diffH(s.key);
      const bins = binProbs(s.key, s.D).filter((b) => b.b > -4.2 && b.a < 4.2);
      const xs = U.linspace(-4, 4, 801);
      const layers = [];
      if (s.D >= 0.04) layers.push({ type: 'bars', x: bins.map((b) => (b.a + b.b) / 2), y: bins.map((b) => b.P / s.D), width: s.D, maxPx: 400, color: 'muted', opacity: 0.55, label: 'P(корзины) / Δ' });
      layers.push({ type: 'line', x: xs, y: xs.map(d.f), color: 'model', width: 2.2, label: 'плотность f(x)' });
      p1.render(layers);
      const Ds = U.range(41).map((i) => Math.pow(10, -2 + i * 0.05));
      const HDs = Ds.map((D) => quantH(s.key, D));
      p2.render([
        { type: 'line', x: Ds, y: Ds.map((D) => hx - lg(D)), color: 'tree', dash: '6 4', width: 2, label: 'h(X) − log₂ Δ' },
        { type: 'line', x: Ds, y: HDs, color: 'model', width: 2.2, label: 'H(X_Δ)' },
        { type: 'points', x: [s.D], y: [quantH(s.key, s.D)], color: 'model', r: 6 },
      ]);
      const HD = quantH(s.key, s.D);
      st.set('h', f3(hx));
      st.set('HD', f3(HD));
      st.set('appr', f3(hx - lg(s.D)));
      st.set('diff', U.fmtSigned(HD - (hx - lg(s.D)), 3));
      note.innerHTML = 'Чем мельче шаг, тем больше бит нужно на одно значение: «точное» действительное число несёт бесконечно много информации. Конечна только поправка h(X). Она бывает отрицательной (равномерное на отрезке ширины 0.5: h = −1 бит) и зависит от единиц измерения. При дисперсии 1: нормальное — 2.047 бита, Лапласа — 1.943, равномерное — 1.792, двугорбое — ' + f3(diffH('bimodal')) + '. <b>Нормальное распределение имеет наибольшую энтропию при заданной дисперсии</b> — поэтому шум «по умолчанию» моделируют нормальным, а это ведёт к MSE (урок 15.13).';
    }
    w.pythonAction(() => PY_NP + `from scipy import stats

D = ${py(s.D)}
dists = {"нормальное": stats.norm(), "Лапласа": stats.laplace(scale=1 / np.sqrt(2)), "равномерное": stats.uniform(-np.sqrt(3), 2 * np.sqrt(3))}
edges = np.arange(-7, 7 + D / 2, D)
for name, d in dists.items():
    P = np.diff(d.cdf(edges)); P = P[P > 0]
    h = d.entropy() / np.log(2)          # scipy даёт наты
    print(f"{name:12s} h = {h:.3f} бит, H(X_Δ) = {-(P * np.log2(P)).sum():.3f}, h − log2 Δ = {h - np.log2(D):.3f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 12. Префиксные коды и неравенство Крафта
   * ============================================================================== */
  function canonical(lens) {
    const idx = U.range(lens.length).sort((a, b) => lens[a] - lens[b] || a - b);
    const codes = new Array(lens.length);
    let code = 0;
    let prev = lens[idx[0]];
    idx.forEach((i, j) => {
      if (j > 0) {
        code += 1;
        code *= Math.pow(2, lens[i] - prev);
      }
      prev = lens[i];
      codes[i] = code.toString(2).padStart(lens[i], '0');
    });
    return codes;
  }
  GBC.widget('kraft', (el) => {
    const s = { L: [1, 2, 3, 4, 4] };
    const names = ['A', 'B', 'C', 'D', 'E'];
    const ps = [0.4, 0.2, 0.2, 0.1, 0.1];
    const MSG = 'ABACADABEC';
    const w = ui.shell(el, { title: 'Неравенство Крафта: какие длины кодов возможны', sub: 'Задайте длины кодовых слов пяти символов. Префиксный код (ни одно слово не начало другого) с такими длинами существует тогда и только тогда, когда Σ 2^(−lᵢ) ≤ 1. Каждое слово длины l «занимает» долю 2^(−l) листьев бесконечного двоичного дерева.' });
    names.forEach((nm, i) => ui.slider(w.controls, { label: 'длина кода ' + nm + ' (p = ' + ps[i] + ')', min: 1, max: 6, step: 1, value: s.L[i], format: String, onInput: (v) => ((s.L[i] = v), draw()) }));
    ui.button(w.controls, { label: 'Все по 3 бита', onClick: () => ((s.L = [3, 3, 3, 3, 3]), redraw()) });
    ui.button(w.controls, { label: 'Хаффман: 1, 2, 3, 4, 4', onClick: () => ((s.L = [1, 2, 3, 4, 4]), redraw()) });
    const sliders = Array.from(w.controls.querySelectorAll('input[type=range]'));
    function redraw() {
      sliders.forEach((inp, i) => {
        inp.value = s.L[i];
        inp.dispatchEvent(new Event('input'));
      });
      draw();
    }
    const treeBox = H('div');
    const msgBox = monoBox();
    w.main.append(treeBox, msgBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'Σ 2^(−l)' }, { key: 'L', label: 'средняя длина' }, { key: 'H', label: 'энтропия' }, { key: 'v', label: 'вердикт' }]);
    function draw() {
      const K = U.sum(s.L.map((l) => Math.pow(2, -l)));
      const L = avgLen(ps, s.L);
      st.set('k', f4(K));
      st.set('L', f3(L));
      st.set('H', f3(Hb(ps)));
      if (K > 1 + 1e-12) {
        treeBox.replaceChildren(H('p', { style: 'padding:12px;color:var(--critical-text);font-weight:650' }, 'Σ 2^(−l) = ' + f4(K) + ' > 1: двоичному дереву не хватит листьев — префиксного кода с такими длинами не существует (и вообще никакого однозначно декодируемого, теорема Макмиллана).'));
        msgBox.textContent = '';
        st.set('v', 'невозможно');
        note.innerHTML = 'Уменьшите какие-нибудь длины… то есть, наоборот, <b>увеличьте</b>: короткие слова слишком «дорогие». Слово длины 1 занимает половину дерева, длины 2 — четверть.';
        return;
      }
      const codes = canonical(s.L);
      treeBox.replaceChildren(codeTree(codes, names, { showFree: true, dx: 54, leafNote: (i) => 'p = ' + ps[i], aria: 'Дерево префиксного кода' }));
      const enc = MSG.split('').map((c) => codes[names.indexOf(c)]);
      msgBox.textContent = 'Сообщение ' + MSG + ' → ' + enc.join('·') + '\n' + enc.join('').length + ' бит вместо ' + MSG.length * 3 + ' при коде по 3 бита. Декодер читает биты слева направо и отрезает слово, как только дошёл до листа — разделители не нужны.';
      st.set('v', K < 1 - 1e-12 ? 'есть лишнее' : 'ровно 1');
      note.innerHTML = K < 1 - 1e-12 ? 'Σ 2^(−l) = ' + f4(K) + ' &lt; 1: пунктирные ветви — «свободные места». Код можно укоротить, не потеряв однозначности: передвиньте символ на свободное место выше.' : 'Σ 2^(−l) = 1: дерево заполнено целиком, ни одно слово нельзя укоротить. Средняя длина ' + f3(L) + ' бита при энтропии ' + f3(Hb(ps)) + ' — меньше энтропии не бывает (шаг 13).';
    }
    w.pythonAction(() => `lens = ${JSON.stringify(s.L)}
p = ${JSON.stringify(ps)}
kraft = sum(2.0**-l for l in lens)
print("Σ 2^-l =", kraft, "→", "префиксный код существует" if kraft <= 1 else "кода нет")
if kraft <= 1:
    order = sorted(range(len(lens)), key=lambda i: (lens[i], i))
    codes, code, prev = [None] * len(lens), 0, lens[order[0]]
    for j, i in enumerate(order):        # канонический код: возрастающие двоичные числа
        if j: code = (code + 1) << (lens[i] - prev)
        prev = lens[i]; codes[i] = format(code, f"0{lens[i]}b")
    print(dict(zip("ABCDE", codes)), " средняя длина", sum(a * b for a, b in zip(p, lens)))
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 13. Граница Шеннона: H ≤ L < H + 1
   * ============================================================================== */
  GBC.widget('shannon-bound', (el) => {
    const s = { w: [0.4, 0.3, 0.2, 0.1, 0] };
    const PRE = { a: [0.4, 0.3, 0.2, 0.1, 0], pow2: [0.5, 0.25, 0.125, 0.125, 0], skew: [0.9, 0.04, 0.03, 0.02, 0.01], flat: [0.2, 0.2, 0.2, 0.2, 0.2] };
    const names = ['A', 'B', 'C', 'D', 'E'];
    const w = ui.shell(el, { title: 'Длины кодов против неожиданности', sub: 'Идеальная длина кода символа — его неожиданность −log₂ p (точки). Длины должны быть целыми: код Шеннона берёт ⌈−log₂ p⌉ (серые столбцы), код Хаффмана подбирает длины оптимально (синие). Энтропия — нижняя граница средней длины.' });
    ui.segmented(w.controls, { label: 'Готовые', value: 'a', options: [{ value: 'a', label: '.4 .3 .2 .1' }, { value: 'pow2', label: '½ ¼ ⅛ ⅛' }, { value: 'skew', label: 'перекос' }, { value: 'flat', label: 'ровно' }], onChange: (v) => ((s.w = PRE[v].slice()), sl.forEach((x, i) => x.set(s.w[i])), draw()) });
    const sl = names.map((nm, i) => ui.slider(w.controls, { label: 'вес ' + nm, min: 0, max: 1, step: 0.01, value: s.w[i], format: f2, onInput: (v) => ((s.w[i] = v), draw()) }));
    const plot = new GBC.Plot(w.main, { height: 270, x: { label: 'символ', domain: [0.4, 5.6], ticks: [1, 2, 3, 4, 5], format: (v) => names[v - 1] || '' }, y: { label: 'длина, бит', domain: [0, 8] } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'H', label: 'энтропия H' }, { key: 'Ls', label: 'код Шеннона' }, { key: 'Lh', label: 'код Хаффмана' }, { key: 'ex', label: 'избыток Хаффмана L − H' }]);
    function draw() {
      const idx = U.range(5).filter((i) => s.w[i] > 0);
      if (idx.length < 2) {
        plot.render([]);
        note.innerHTML = 'Нужно хотя бы два символа с ненулевым весом.';
        return;
      }
      const ps = normalize(idx.map((i) => s.w[i]));
      const sh = ps.map((p) => Math.ceil(-lg(p) - 1e-12));
      const hu = huffman(ps).lens;
      const xs = idx.map((i) => i + 1);
      const Hh = Hb(ps);
      plot.render([
        { type: 'bars', x: xs.map((x) => x - 0.17), y: sh, width: 0.3, maxPx: 30, color: 'muted', label: 'Шеннон ⌈−log₂ p⌉' },
        { type: 'bars', x: xs.map((x) => x + 0.17), y: hu, width: 0.3, maxPx: 30, color: 'model', label: 'Хаффман' },
        { type: 'points', x: xs, y: ps.map((p) => -lg(p)), color: 'tree', r: 6, label: 'идеал −log₂ p' },
      ], { y: [0, Math.max(4, Math.max(...sh, ...hu) + 1)] });
      rowTable(tbl, ['символ', 'p', '−log₂ p', 'Шеннон', 'Хаффман'], idx.map((i, j) => [names[i], f3(ps[j]), f3(-lg(ps[j])), String(sh[j]), String(hu[j])]), null, false);
      const Ls = avgLen(ps, sh);
      const Lh = avgLen(ps, hu);
      st.set('H', f3(Hh));
      st.set('Ls', f3(Ls));
      st.set('Lh', f3(Lh));
      st.set('ex', f3(Lh - Hh));
      note.innerHTML = 'Теорема Шеннона о кодировании источника: для любого однозначно декодируемого кода <b>L ≥ H</b>, а код с длинами ⌈−log₂ p⌉ даёт <b>L &lt; H + 1</b>. Для 0.4, 0.3, 0.2, 0.1: H = 1.846, Шеннон — 2.4, Хаффман — 1.9. Равенство L = H — только когда все p — степени двойки (½, ¼, ⅛, ⅛). При сильном перекосе даже Хаффман тратит заметно больше H: целый бит на символ — слишком крупная «монета» (шаг 15).';
    }
    w.pythonAction(() => PY_NP + PY_HUFF + `
w = np.array(${JSON.stringify(s.w)}); p = w[w > 0] / w[w > 0].sum()
shannon = np.ceil(-np.log2(p) - 1e-12)
huff = np.array([len(c) for c in huffman(list(p))])
H = -(p * np.log2(p)).sum()
print(f"H = {H:.3f}; Шеннон L = {(p * shannon).sum():.3f}; Хаффман L = {(p * huff).sum():.3f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 14. Алгоритм Хаффмана по шагам
   * ============================================================================== */
  GBC.widget('huffman-steps', (el) => {
    const s = { w: [4, 2, 2, 1, 1, 0], step: 4 };
    const PRE = { a: [4, 2, 2, 1, 1, 0], pow2: [8, 4, 2, 2, 0, 0], flat: [1, 1, 1, 1, 1, 1], skew: [99, 1, 0, 0, 0, 0], fib: [1, 1, 2, 3, 5, 8] };
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    const w = ui.shell(el, { title: 'Код Хаффмана: сливаем два самых редких', sub: 'Каждый шаг берёт два узла с наименьшими весами и объединяет их в новый узел с суммарным весом. Через k − 1 шагов остаётся одно дерево; путь от корня к листу (0 — влево, 1 — вправо) — код символа. Новый узел на схеме рисуется на «этаже» своего шага.' });
    ui.segmented(w.controls, { label: 'Частоты', value: 'a', options: [{ value: 'a', label: '4 2 2 1 1' }, { value: 'pow2', label: '8 4 2 2' }, { value: 'flat', label: 'ровно' }, { value: 'fib', label: 'Фибоначчи' }, { value: 'skew', label: '99 : 1' }], onChange: (v) => ((s.w = PRE[v].slice()), sl.forEach((x, i) => x.set(s.w[i])), (s.step = 99), draw()) });
    const sl = names.map((nm, i) => ui.slider(w.controls, { label: 'частота ' + nm, min: 0, max: 20, step: 1, value: s.w[i], format: String, onInput: (v) => ((s.w[i] = v), (s.step = 99), draw()) }));
    const pl = ui.player(w.controls, { label: 'Шаг слияния', min: 0, max: 4, value: 4, fps: 1, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.step = k), draw(false)) });
    const box = H('div');
    const tbl = H('div');
    w.main.append(box, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 's', label: 'шаг' }, { key: 'L', label: 'средняя длина' }, { key: 'H', label: 'энтропия' }, { key: 'u', label: 'равномерный код' }]);
    function draw(resetPlayer = true) {
      const idx = U.range(6).filter((i) => s.w[i] > 0);
      if (idx.length < 2) {
        box.replaceChildren(H('p', { style: 'padding:12px' }, 'Нужно хотя бы два символа с ненулевой частотой.'));
        tbl.textContent = '';
        return;
      }
      const tot = U.sum(idx.map((i) => s.w[i]));
      const ps = idx.map((i) => s.w[i] / tot);
      const hf = huffman(idx.map((i) => s.w[i]));
      const K = idx.length - 1;
      if (resetPlayer) pl.setMax(K);
      s.step = Math.min(s.step, K);
      if (resetPlayer) pl.set(s.step);
      // раскладка: листья в порядке обхода финального дерева, этаж узла = номер шага
      const order = [];
      (function walk(n) {
        if (n.leaf !== undefined) order.push(n.leaf);
        else n.kids.forEach(walk);
      })(hf.root);
      const dx = 64;
      const dy = 48;
      const pad = 24;
      const W = idx.length * dx + 2 * pad;
      const Hh = pad + (K + 1) * dy + 40;
      const xOf = {};
      order.forEach((leaf, j) => (xOf['L' + leaf] = pad + dx / 2 + j * dx));
      const yLeaf = pad + K * dy + 8;
      const svg = S('svg', { width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': 'Слияния Хаффмана', style: 'display:block;margin:0 auto;font-family:var(--font-sans);min-width:' + W + 'px;max-width:none' });
      const posOf = (n) => (n.leaf !== undefined ? [xOf['L' + n.leaf], yLeaf] : [n._x, yLeaf - (n.step + 1) * dy]);
      hf.merges.forEach((m) => {
        m._x = (posOf(m.kids[0])[0] + posOf(m.kids[1])[0]) / 2;
      });
      hf.merges.forEach((m, j) => {
        if (j >= s.step) return;
        const [x, y] = posOf(m);
        const last = j === s.step - 1;
        m.kids.forEach((c, b) => {
          const [cx, cy] = posOf(c);
          svg.appendChild(S('path', { d: 'M' + x + ',' + y + 'L' + cx + ',' + y + 'L' + cx + ',' + cy, style: 'fill:none;stroke:' + (last ? 'var(--c-tree)' : 'var(--c-axis)') + ';stroke-width:' + (last ? 2.6 : 1.6) }));
          svg.appendChild(S('text', { x: cx + (b ? 6 : -6), y: y + 13, 'text-anchor': b ? 'start' : 'end', style: 'font-size:11px;font-weight:650;fill:var(--ink-2)' }, String(b)));
        });
        svg.appendChild(S('circle', { cx: x, cy: y, r: 13, style: 'fill:' + (last ? 'var(--c-tree)' : 'var(--surface)') + ';stroke:' + (last ? 'var(--c-tree)' : 'var(--c-model)') + ';stroke-width:1.6' }));
        svg.appendChild(S('text', { x, y: y + 4, 'text-anchor': 'middle', style: 'font-size:11px;font-weight:650;fill:' + (last ? 'var(--surface)' : 'var(--ink)') }, U.fmt(m.w, 0)));
      });
      hf.merges.forEach((m) => delete m._x);
      order.forEach((leaf) => {
        const x = xOf['L' + leaf];
        svg.appendChild(S('rect', { x: x - 17, y: yLeaf - 13, width: 34, height: 26, rx: 6, style: 'fill:var(--surface-2);stroke:var(--border)' }));
        svg.appendChild(S('text', { x, y: yLeaf + 4.5, 'text-anchor': 'middle', style: 'font-size:12.5px;font-weight:700;fill:var(--ink)' }, names[idx[leaf]]));
        svg.appendChild(S('text', { x, y: yLeaf + 28, 'text-anchor': 'middle', style: 'font-size:11px;fill:var(--muted)' }, String(s.w[idx[leaf]])));
      });
      const sb = scrollBox();
      sb.appendChild(svg);
      box.replaceChildren(sb);
      const done = s.step === K;
      rowTable(tbl, ['символ', 'частота', 'p', '−log₂ p', 'код', 'длина'], idx.map((i, j) => [names[i], String(s.w[i]), f3(ps[j]), f3(-lg(ps[j])), done ? hf.codes[j] : '…', done ? String(hf.lens[j]) : '…']), null, false);
      const L = avgLen(ps, hf.lens);
      st.set('s', s.step + ' из ' + K);
      st.set('L', done ? f3(L) : '…');
      st.set('H', f3(Hb(ps)));
      st.set('u', String(Math.ceil(lg(idx.length) - 1e-12)) + ' бит');
      const cur = s.step > 0 ? hf.merges[s.step - 1] : null;
      note.innerHTML = (cur ? 'Шаг ' + s.step + ': слили узлы с весами ' + U.fmt(cur.kids[0].w, 0) + ' и ' + U.fmt(cur.kids[1].w, 0) + ' → ' + U.fmt(cur.w, 0) + '. ' : 'Пока только листья. ') + 'Почему жадность работает: два самых редких символа в оптимальном коде можно сделать «братьями» на самой глубокой ветви — и задача сводится к задаче на один символ меньше. Для 4 2 2 1 1 (вероятности 0.4 0.2 0.2 0.1 0.1) средняя длина 2.2 бита при H = 2.122. Бывает несколько оптимальных деревьев (длины 2,2,2,3,3 или 1,2,3,4,4 — обе дают 2.2), но средняя длина у них одна. Для 99 : 1 Хаффман тратит 1 бит при H = 0.081 — выручит блочное кодирование.';
    }
    w.pythonAction(() => PY_HUFF + `import math

freqs = ${JSON.stringify(Object.fromEntries(names.map((nm, i) => [nm, s.w[i]]).filter((e) => e[1] > 0)))}
codes = huffman(list(freqs.values()))
total = sum(freqs.values())
for (sym, f), c in zip(freqs.items(), codes):
    print(f"{sym}: частота {f:3d}, p = {f / total:.3f}, −log2 p = {-math.log2(f / total):.3f}, код {c}")
L = sum(f / total * len(c) for f, c in zip(freqs.values(), codes))
H = -sum(f / total * math.log2(f / total) for f in freqs.values())
print(f"средняя длина {L:.3f} бит, энтропия {H:.3f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 15. Блочное кодирование: L_n / n → H
   * ============================================================================== */
  const blockCache = {};
  function blockRate(p, n) {
    const key = p + '|' + n;
    if (blockCache[key] !== undefined) return blockCache[key];
    const ps = [];
    for (let m = 0; m < 1 << n; m++) {
      let ones = 0;
      for (let b = m; b; b >>= 1) ones += b & 1;
      ps.push(Math.pow(p, ones) * Math.pow(1 - p, n - ones));
    }
    const lens = huffLens(ps);
    return (blockCache[key] = avgLen(ps, lens) / n);
  }
  GBC.widget('block-coding', (el) => {
    const s = { p: 0.1, n: 4 };
    const w = ui.shell(el, { title: 'Блоки: кодируем сразу по n символов', sub: 'Нечестная монета: «1» с вероятностью p. Код Хаффмана для одного символа тратит 1 бит, сколько бы ни была мала энтропия. Будем кодировать блоки из n символов (2ⁿ «букв»): затраты на символ L_n / n лежат между H и H + 1/n.' });
    ui.slider(w.controls, { label: 'Вероятность единицы p', min: 0.01, max: 0.5, step: 0.01, value: s.p, format: f2, onInput: (v) => ((s.p = v), draw()) });
    ui.slider(w.controls, { label: 'Длина блока n', min: 1, max: 10, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'длина блока n', domain: [0.5, 10.5], ticks: U.range(10, 1) }, y: { label: 'бит на символ', domain: [0, 1.6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'H', label: 'энтропия H' }, { key: 'L1', label: 'по одному: L₁' }, { key: 'Ln', label: 'блоками: L_n / n' }, { key: 'gain', label: 'экономия против 1 бита' }]);
    function draw() {
      const ns = U.range(10, 1);
      const rates = ns.map((n) => blockRate(s.p, n));
      const Hh = hbin(s.p);
      plot.render([
        { type: 'line', x: ns, y: ns.map((n) => Hh + 1 / n), color: 'muted', dash: '6 4', width: 1.6, label: 'H + 1/n' },
        { type: 'hline', y: Hh, color: 'tree', width: 2, label: 'энтропия H' },
        { type: 'line', x: ns, y: rates, color: 'model', width: 2, label: 'Хаффман блоками' },
        { type: 'points', x: ns, y: rates, color: 'model', r: 4, tooltip: (i) => [['n', String(i + 1)], ['бит/символ', f4(rates[i])]] },
        { type: 'points', x: [s.n], y: [rates[s.n - 1]], color: 'tree', r: 7 },
      ], { y: [0, Math.max(1.2, Hh + 1.05)] });
      st.set('H', f4(Hh));
      st.set('L1', '1');
      st.set('Ln', f4(rates[s.n - 1]));
      st.set('gain', pct(1 - rates[s.n - 1], 1));
      note.innerHTML = 'При p = 0.1 энтропия 0.469 бита, а затраты на символ: по одному — 1, парами — 0.645, тройками — 0.533, четвёрками — 0.493, шестёрками — 0.470. Кривая не обязана убывать монотонно (n = 7 даёт 0.474), но всегда лежит в коридоре [H, H + 1/n]. Это и есть <b>теорема Шеннона</b> в полной форме: кодируя длинными блоками, можно сколь угодно близко подойти к энтропии. Современные архиваторы (арифметическое кодирование) делают это без явных блоков.';
    }
    w.pythonAction(() => PY_HUFF + `import math
from itertools import product

p = ${py(s.p)}
H = -p * math.log2(p) - (1 - p) * math.log2(1 - p)
print(f"H = {H:.4f}")
for n in range(1, ${Math.min(s.n, 10)} + 1):
    probs = [p**sum(b) * (1 - p)**(n - sum(b)) for b in product((0, 1), repeat=n)]
    codes = huffman(probs)
    print(n, round(sum(q * len(c) for q, c in zip(probs, codes)) / n, 4))
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 15. Типичные последовательности (асимптотическая равнораспределённость)
   * ============================================================================== */
  GBC.widget('typical-set', (el) => {
    const s = { p: 0.1, n: 100, e: 0.05 };
    const w = ui.shell(el, { title: 'Типичные последовательности', sub: 'Последовательность из n бросков нечестной монеты. Её «удельная неожиданность» −(1/n) log₂ P(последовательности) зависит только от числа единиц k. Столбцы — вероятность получить такое значение. С ростом n почти вся вероятность собирается у энтропии H.' });
    ui.slider(w.controls, { label: 'Вероятность единицы p', min: 0.05, max: 0.5, step: 0.01, value: s.p, format: f2, onInput: (v) => ((s.p = v), draw()) });
    ui.slider(w.controls, { label: 'Длина n', values: [10, 20, 50, 100, 200, 500, 1000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Допуск ε, бит', min: 0.01, max: 0.2, step: 0.01, value: s.e, format: f2, onInput: (v) => ((s.e = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: '−(1/n) log₂ P(последовательности), бит', domain: [0, 1.5] }, y: { label: 'вероятность', domain: [0, 0.3] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'P', label: 'P(типичная)' }, { key: 'cnt', label: 'log₂ (число типичных) / n' }, { key: 'H', label: 'H' }, { key: 'share', label: 'доля типичных среди 2ⁿ' }]);
    function draw() {
      const { p, n, e } = s;
      const Hh = hbin(p);
      const xs = [];
      const ys = [];
      const typ = [];
      let P = 0;
      for (let k = 0; k <= n; k++) {
        const v = -(k * lg(p) + (n - k) * lg(1 - p)) / n;
        const l2 = log2C(n, k);
        const pk = Math.pow(2, l2 + k * lg(p) + (n - k) * lg(1 - p));
        xs.push(v);
        ys.push(pk);
        if (Math.abs(v - Hh) <= e) {
          P += pk;
          typ.push(l2);
        }
      }
      const step = Math.abs(lg((1 - p) / p)) / n;
      const lc = typ.length ? log2sum(typ) : -Infinity;
      const yMaxV = Math.max(...ys);
      const vis = xs.filter((_, k) => ys[k] > yMaxV * 1e-3);
      const xLo = Math.max(0, Math.min(Hh - e, ...vis) - 0.05);
      const xHi = Math.max(Hh + e, ...vis) + 0.05;
      plot.render([
        { type: 'vband', x0: Hh - e, x1: Hh + e, color: 'tree', opacity: 0.12 },
        { type: 'bars', x: xs, y: ys, width: Math.max(step * 0.8, 1e-4), maxPx: 18, color: 'model', tooltip: (i) => [['единиц k', String(i)], ['−log₂ P / n', f3(xs[i])], ['вероятность', sci(ys[i])]] },
        { type: 'vline', x: Hh, color: 'tree', width: 2, text: 'H' },
      ], { x: [xLo, xHi], y: [0, yMaxV * 1.15] });
      st.set('P', pct(P, 1));
      st.set('cnt', typ.length ? f3(lc / n) : '—');
      st.set('H', f3(Hh));
      st.set('share', typ.length ? '2' + sup(Math.round(lc - n)) : '—');
      note.innerHTML = 'Закон больших чисел для неожиданности: −(1/n) log₂ P(x₁…xₙ) → H. Значит, почти наверняка выпадет одна из «типичных» последовательностей, у каждой из которых вероятность ≈ 2<sup>−nH</sup>, а всего их ≈ 2<sup>nH</sup>. При p = 0.1 и n = 100 это примерно 2<sup>47</sup> из 2<sup>100</sup> возможных — ничтожная доля. Достаточно занумеровать типичные последовательности: nH бит вместо n. Так доказывается теорема Шеннона о сжатии. Заметьте: <b>самая вероятная</b> последовательность (все нули) не типична — её неожиданность 0.152 бита на символ, а не 0.469.';
    }
    w.pythonAction(() => PY_NP + `from scipy.stats import binom
from scipy.special import gammaln

p, n, eps = ${py(s.p)}, ${s.n}, ${py(s.e)}
H = -p * np.log2(p) - (1 - p) * np.log2(1 - p)
k = np.arange(n + 1)
v = -(k * np.log2(p) + (n - k) * np.log2(1 - p)) / n       # −(1/n) log2 P(последовательности)
typ = np.abs(v - H) <= eps
log2C = (gammaln(n + 1) - gammaln(k + 1) - gammaln(n - k + 1)) / np.log(2)
cnt = np.log2(np.sum(2.0 ** (log2C[typ] - log2C[typ].max()))) + log2C[typ].max()
print(f"P(типичная) = {binom.pmf(k[typ], n, p).sum():.3f}; log2(число типичных)/n = {cnt / n:.3f}; H = {H:.3f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 16. Сжатие текста: частоты букв и контекст
   * ============================================================================== */
  const SAMPLE = 'Градиентный бустинг строит модель шаг за шагом. Каждое новое дерево исправляет ошибки предыдущих, и прогноз становится всё точнее. Теория информации объясняет, почему для классификации мы минимизируем именно log-loss: это средняя неожиданность правильных ответов для модели. Чем лучше модель предсказывает вероятности, тем меньше она удивляется и тем короче код, которым можно передать правильные ответы. Энтропия данных задаёт предел: ниже него не опустится ни одна модель, как бы долго мы ни обучали ансамбль.';
  function textStats(t) {
    const chars = Array.from(t.toLowerCase());
    const n = chars.length;
    const cnt = new Map();
    for (const c of chars) cnt.set(c, (cnt.get(c) || 0) + 1);
    const syms = Array.from(cnt.keys()).sort((a, b) => cnt.get(b) - cnt.get(a) || (a < b ? -1 : 1));
    const ps = syms.map((c) => cnt.get(c) / n);
    const H0 = Hb(ps);
    const huffL = syms.length > 1 ? avgLen(ps, huffLens(ps)) : 1;
    const pair = new Map();
    const prev = new Map();
    for (let i = 1; i < n; i++) {
      const k = chars[i - 1] + '\u0000' + chars[i];
      pair.set(k, (pair.get(k) || 0) + 1);
      prev.set(chars[i - 1], (prev.get(chars[i - 1]) || 0) + 1);
    }
    let H1 = 0;
    for (const [k, c] of pair) {
      const a = k.split('\u0000')[0];
      H1 -= (c / (n - 1)) * lg(c / prev.get(a));
    }
    let bytes = 0;
    for (const c of chars) bytes += new TextEncoder().encode(c).length;
    return { n, m: syms.length, syms, ps, cnt, H0, huffL, H1, utf8: (8 * bytes) / Math.max(1, n) };
  }
  GBC.widget('text-compress', (el) => {
    const s = { text: SAMPLE };
    const w = ui.shell(el, { title: 'Сколько бит на букву нужно тексту', sub: 'Вставьте или напишите любой текст (заглавные приводятся к строчным). Сравниваются: UTF-8, равномерный код на m разных символов, энтропия частот букв H₀, код Хаффмана и условная энтропия буквы при известной предыдущей H₁.' });
    ui.button(w.controls, { label: 'Исходный текст', onClick: () => ((s.text = SAMPLE), (ta.value = s.text), draw()) });
    ui.button(w.controls, { label: 'Перемешать буквы', onClick: () => {
      const a = Array.from(s.text.toLowerCase());
      new GBC.RNG(7).shuffle(a);
      s.text = a.join('');
      ta.value = s.text;
      draw();
    } });
    ui.button(w.controls, { label: 'Случайные буквы', onClick: () => {
      const st0 = textStats(s.text);
      const rng = new GBC.RNG(7);
      s.text = U.range(st0.n).map(() => st0.syms[rng.randint(st0.m)]).join('');
      ta.value = s.text;
      draw();
    } });
    ui.button(w.controls, { label: 'Повторы «абвгд »', onClick: () => ((s.text = 'абвгд '.repeat(80)), (ta.value = s.text), draw()) });
    const ta = H('textarea', { rows: 5, 'aria-label': 'Текст для сжатия', style: 'width:100%;box-sizing:border-box;font:inherit;font-size:.92rem;padding:8px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--ink);resize:vertical' });
    ta.value = s.text;
    ta.addEventListener('input', U.debounce(() => ((s.text = ta.value), draw()), 200));
    w.main.appendChild(ta);
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'символ (24 самых частых; ␣ — пробел)', domain: [-0.6, 23.6] }, y: { label: 'частота', domain: [0, 0.2] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'символов / разных' }, { key: 'u', label: 'UTF-8 и log₂ m' }, { key: 'H0', label: 'H₀ (частоты)' }, { key: 'hf', label: 'Хаффман' }, { key: 'H1', label: 'H₁ (по предыдущей)' }]);
    function draw() {
      if (!s.text.length) {
        plot.render([]);
        note.innerHTML = 'Текст пуст.';
        return;
      }
      const T = textStats(s.text);
      const top = T.syms.slice(0, 24);
      plot.opts.x = Object.assign({}, plot.opts.x, { ticks: U.range(top.length), format: (v) => (top[v] === ' ' ? '␣' : top[v] === '\n' ? '↵' : top[v] || '') });
      plot.render([{ type: 'bars', x: U.range(top.length), y: top.map((c) => T.cnt.get(c) / T.n), color: 'model', width: 0.75, maxPx: 22, tooltip: (i) => [['символ', top[i] === ' ' ? 'пробел' : top[i]], ['частота', f4(T.cnt.get(top[i]) / T.n)], ['−log₂ p', f2(-lg(T.cnt.get(top[i]) / T.n))]] }], { x: [-0.6, Math.max(top.length, 2) - 0.4], y: [0, (T.cnt.get(top[0]) / T.n) * 1.15] });
      st.set('n', T.n + ' / ' + T.m);
      st.set('u', f1(T.utf8) + ' и ' + f2(lg(T.m)));
      st.set('H0', f3(T.H0));
      st.set('hf', f3(T.huffL));
      st.set('H1', f3(T.H1));
      note.innerHTML = 'Сейчас: ' + T.n + ' символов, из них разных ' + T.m + '. UTF-8 тратит в среднем ' + f1(T.utf8) + ' бита на символ (кириллица — 16), равномерный код — log₂ ' + T.m + ' = ' + f2(lg(T.m)) + ', частоты символов дают H₀ = ' + f2(T.H0) + ' (Хаффман — ' + f2(T.huffL) + '), а знание предыдущего символа — H₁ = ' + f2(T.H1) + '. Для исходного текста: 4.57 и 2.96 бита. «Перемешать» сохраняет частоты (H₀ тот же), но рушит контекст — H₁ растёт до 3.48. Повторы «абвгд » имеют H₀ = 2.585, но H₁ = 0: следующий символ известен. Осторожно: на коротком тексте H₁ сильно занижена (шаг 9) — пар символов много, а примеров каждой мало. По большим корпусам русского текста частоты букв дают около 4.4 бита на букву, а длинный контекст снижает оценку до 1–2 бит.';
    }
    w.pythonAction(() => PY_NP + `from collections import Counter

text = ${JSON.stringify(s.text.slice(0, 4000))}.lower()
n = len(text)
cnt = Counter(text)
p = np.array([c / n for c in cnt.values()])
H0 = -(p * np.log2(p)).sum()
pairs, prev = Counter(zip(text, text[1:])), Counter(text[:-1])
H1 = -sum(c / (n - 1) * np.log2(c / prev[a]) for (a, b), c in pairs.items())
bits_utf8 = 8 * len(text.encode("utf-8")) / n
print(f"символов {n}, разных {len(cnt)}: UTF-8 {bits_utf8:.1f}, log2 m {np.log2(len(cnt)):.2f}, H0 {H0:.3f}, H1 {H1:.3f} бит/символ")
import zlib, lzma
print("zlib:", round(8 * len(zlib.compress(text.encode("utf-8"), 9)) / n, 2), " lzma:", round(8 * len(lzma.compress(text.encode("utf-8"))) / n, 2), "бит/символ (с заголовками)")
`);
    draw();
  });

  GBC.lesson1516 = { f1, f2, f3, f4, py, sci, big, big2, sup, pct, plural, nWord, yDom, human, lg, Hb, hbin, ceb, klb, normalize, hinv, lgamma, log2C, log2sum, phi, Phi, erfc, probit, pick, cumsum, huffman, huffLens, avgLen, texEl, texInto, card, cardGrid, badge, rowTable, scrollBox, monoBox, codeTree, PY_NP, PY_RNG, PY_H, PY_HUFF };
})();
