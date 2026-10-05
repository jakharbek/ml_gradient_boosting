/* Урок 15.19: математическая логика. Часть 1 — язык высказываний, таблицы истинности и рассуждения.
 * Движок формул: разбор строки (¬ ∧ ∨ → ↔ ⊕ ↑ ↓, скобки, приоритеты), вычисление, таблицы истинности,
 * равносильность и следование, СДНФ/СКНФ, минимальная ДНФ (Куайн — Мак-Класки), классы Поста,
 * минимальное и жадное дерево решений для булевой функции.
 * Виджеты: возможные миры (детектив); высказывание или нет; выключатели и связки; импликация на данных;
 * необходимое и достаточное; перевод с русского; дерево формулы; построитель таблиц истинности;
 * проверка равносильности; цепочки законов; правильные и ошибочные рассуждения; карточки Уэйсона;
 * рыцари и лжецы.
 * Общие помощники выставлены в GBC.lesson1519 — ими пользуются lesson_extra.js и lesson_ml.js. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const NB = ' ';
  const grp = (s) => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  const pct = (p, d = 1) => (Number.isFinite(p) ? U.fmt(100 * p, d) + ' %' : '—');
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  const nWord = (n, one, few, many) => grp(n) + ' ' + plural(n, one, few, many);

  /* ==============================================================================
   * Оформление
   * ============================================================================== */
  const SER = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];
  const cvar = (i) => 'var(--c-' + SER[((i % SER.length) + SER.length) % SER.length] + ')';
  const tint = (c, p = 22) => 'color-mix(in srgb, ' + c + ' ' + p + '%, var(--surface))';
  const C_TRUE = 'var(--c-blue)';
  const C_FALSE = 'var(--muted)';
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
  const texSpan = (src) => {
    const el = H('span');
    texInto(el, src, false);
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
  function legendRow(items) {
    const row = flexRow('gap:14px;font-size:.86rem;color:var(--ink-2);margin:2px 0 6px');
    items.forEach(([c, t, dashed]) => row.appendChild(H('span', { style: 'display:inline-flex;align-items:center;gap:6px' }, H('span', { style: 'width:12px;height:12px;border-radius:3px;display:inline-block;background:' + tint(c, 45) + ';border:2px ' + (dashed ? 'dashed' : 'solid') + ' ' + c }), t)));
    return row;
  }
  /** Таблица из 0/1: единицы — синим и жирно, нули — приглушённо. o: { hl(i), bad(i), good(i), outCols: Set, sepAfter } */
  function boolTable(parent, columns, rows, o = {}) {
    const t = H('table', { class: 'data', style: 'font-variant-numeric:tabular-nums' });
    const outCols = o.outCols || new Set();
    t.appendChild(H('thead', null, H('tr', null, columns.map((c, j) => H('th', { style: 'text-align:center;white-space:nowrap;' + (outCols.has(j) ? 'color:var(--ink)' : '') + (o.sepAfter !== undefined && j === o.sepAfter ? ';border-right:2px solid var(--border-strong)' : '') }, c)))));
    const tb = H('tbody');
    rows.forEach((r, i) => {
      const bad = o.bad && o.bad(i);
      const good = o.good && o.good(i);
      const tr = H('tr', { class: o.hl && o.hl(i) ? 'hl' : null, style: bad ? 'background:var(--critical-soft)' : good ? 'background:' + tint(C_TRUE, 12) : null });
      r.forEach((v, j) => {
        const isB = v === 0 || v === 1;
        const st = 'text-align:center;white-space:nowrap;' + (isB ? (v ? 'color:' + C_TRUE + ';font-weight:700' : 'color:' + C_FALSE) : '') + (outCols.has(j) ? ';font-size:1.02rem' : '') + (o.sepAfter !== undefined && j === o.sepAfter ? ';border-right:2px solid var(--border-strong)' : '');
        tr.appendChild(H('td', { style: st }, isB ? String(v) : v));
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    const wrap = H('div', { class: 'table-wrap' }, t);
    parent.appendChild(wrap);
    return wrap;
  }

  /* ==============================================================================
   * Движок логических формул
   * ============================================================================== */
  const OPS = {
    and: { sym: '∧', tex: '\\land', prec: 4, f: (a, b) => a & b, name: 'конъюнкция' },
    nand: { sym: '↑', tex: '\\uparrow', prec: 4, f: (a, b) => 1 - (a & b), name: 'штрих Шеффера' },
    or: { sym: '∨', tex: '\\lor', prec: 3, f: (a, b) => a | b, name: 'дизъюнкция' },
    xor: { sym: '⊕', tex: '\\oplus', prec: 3, f: (a, b) => a ^ b, name: 'исключающее «или»' },
    nor: { sym: '↓', tex: '\\downarrow', prec: 3, f: (a, b) => 1 - (a | b), name: 'стрелка Пирса' },
    imp: { sym: '→', tex: '\\to', prec: 2, right: true, f: (a, b) => (1 - a) | b, name: 'импликация' },
    iff: { sym: '↔', tex: '\\leftrightarrow', prec: 1, f: (a, b) => (a === b ? 1 : 0), name: 'эквивалентность' },
  };
  const ASSOC = { and: 1, or: 1, xor: 1, iff: 1 };
  const MAXV = 6;
  const MULTI = [['<->', 'iff'], ['<=>', 'iff'], ['->', 'imp'], ['=>', 'imp']];
  const SINGLE = { '¬': 'not', '!': 'not', '~': 'not', '-': 'not', '−': 'not', '∧': 'and', '&': 'and', '·': 'and', '*': 'and', '∨': 'or', '|': 'or', '⊕': 'xor', '^': 'xor', '→': 'imp', '⇒': 'imp', '↔': 'iff', '⇔': 'iff', '≡': 'iff', '=': 'iff', '↑': 'nand', '↓': 'nor' };
  const WORDS = { not: 'not', and: 'and', or: 'or', xor: 'xor', nand: 'nand', nor: 'nor', implies: 'imp', iff: 'iff', 'не': 'not', 'и': 'and', 'или': 'or' };
  function tokenize(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      const m = MULTI.find(([t]) => s.startsWith(t, i));
      if (m) {
        out.push({ k: 'op', v: m[1], s: m[0] });
        i += m[0].length;
        continue;
      }
      if (/[A-Za-zА-Яа-яЁё]/.test(c)) {
        let j = i;
        while (j < s.length && /[A-Za-zА-Яа-яЁё]/.test(s[j])) j++;
        const w = s.slice(i, j);
        const kw = WORDS[w.toLowerCase()];
        if (kw) out.push({ k: kw === 'not' ? 'not' : 'op', v: kw, s: w });
        else if (/^[A-Z]$/.test(w)) out.push({ k: 'var', v: w, s: w });
        else throw new Error('непонятное слово «' + w + '»: переменные — заглавные латинские буквы A, B, C…');
        i = j;
        continue;
      }
      if (c === '0' || c === '1') {
        out.push({ k: 'const', v: +c, s: c });
        i++;
        continue;
      }
      if (c === '(' || c === '[') {
        out.push({ k: '(', s: c });
        i++;
        continue;
      }
      if (c === ')' || c === ']') {
        out.push({ k: ')', s: c });
        i++;
        continue;
      }
      if (SINGLE[c]) {
        const v = SINGLE[c];
        out.push({ k: v === 'not' ? 'not' : 'op', v, s: c });
        i++;
        continue;
      }
      throw new Error('непонятный символ «' + c + '»');
    }
    return out;
  }
  function varsOf(n, acc = new Set()) {
    if (n.t === 'var') acc.add(n.name);
    else if (n.t === 'not') varsOf(n.a, acc);
    else if (n.t === 'bin') (varsOf(n.a, acc), varsOf(n.b, acc));
    return [...acc].sort();
  }
  /** Разбор формулы. Возвращает { ast, vars } или { error }. */
  function parse(src, maxVars = MAXV) {
    let toks;
    try {
      toks = tokenize(String(src));
    } catch (e) {
      return { error: e.message };
    }
    if (!toks.length) return { error: 'пустая формула' };
    let p = 0;
    function unary() {
      const t = toks[p];
      if (!t) throw new Error('формула оборвалась: после связки нужен операнд');
      if (t.k === 'not') {
        p++;
        return { t: 'not', a: unary() };
      }
      if (t.k === '(') {
        p++;
        const e = expr(0);
        if (!toks[p] || toks[p].k !== ')') throw new Error('не хватает закрывающей скобки');
        p++;
        return e;
      }
      if (t.k === 'var') {
        p++;
        return { t: 'var', name: t.v };
      }
      if (t.k === 'const') {
        p++;
        return { t: 'const', v: t.v };
      }
      throw new Error('на месте «' + t.s + '» ожидалась переменная, 0/1, «¬» или «(»');
    }
    function expr(minPrec) {
      let left = unary();
      for (;;) {
        const t = toks[p];
        if (!t || t.k !== 'op') break;
        const op = OPS[t.v];
        if (op.prec < minPrec) break;
        p++;
        const right = expr(op.right ? op.prec : op.prec + 1);
        left = { t: 'bin', op: t.v, a: left, b: right };
      }
      return left;
    }
    try {
      const ast = expr(0);
      if (p < toks.length) throw new Error(toks[p].k === ')' ? 'лишняя закрывающая скобка' : 'лишнее «' + toks[p].s + '»: не пропущена ли связка?');
      const vars = varsOf(ast);
      if (vars.length > maxVars) throw new Error('слишком много переменных (' + vars.length + '): не больше ' + maxVars);
      return { ast, vars };
    } catch (e) {
      return { error: e.message };
    }
  }
  const P = (src) => {
    const r = parse(src);
    if (r.error) throw new Error('формула «' + src + '»: ' + r.error);
    return r.ast;
  };
  const precOf = (n) => (n.t === 'bin' ? OPS[n.op].prec : 9);
  function needParens(parent, child, side) {
    if (child.t !== 'bin') return false;
    const o = OPS[parent.op];
    const cp = OPS[child.op].prec;
    if (cp > o.prec) return false;
    if (cp < o.prec) return true;
    if (child.op !== parent.op) return true;
    if (side === 'a') return !o.right && !!ASSOC[parent.op];
    return !!o.right ? false : true;
  }
  /** Запись формулы с минимумом скобок (full — все скобки, как понял разборщик). */
  function str(n, full = false) {
    if (n.t === 'var') return n.name;
    if (n.t === 'const') return String(n.v);
    if (n.t === 'not') return '¬' + (n.a.t === 'bin' ? '(' + str(n.a, full) + ')' : str(n.a, full));
    const w = (c, side) => {
      const s = str(c, full);
      return c.t === 'bin' && (full || needParens(n, c, side)) ? '(' + s + ')' : s;
    };
    return w(n.a, 'a') + ' ' + OPS[n.op].sym + ' ' + w(n.b, 'b');
  }
  function tex(n) {
    if (n.t === 'var') return n.name;
    if (n.t === 'const') return String(n.v);
    if (n.t === 'not') return '\\neg ' + (n.a.t === 'bin' ? '(' + tex(n.a) + ')' : tex(n.a));
    const w = (c, side) => (c.t === 'bin' && needParens(n, c, side) ? '(' + tex(c) + ')' : tex(c));
    return w(n.a, 'a') + ' ' + OPS[n.op].tex + ' ' + w(n.b, 'b');
  }
  /** Выражение Python (переменные — bool). */
  function py(n) {
    const w = (c) => (c.t === 'var' || c.t === 'const' ? py(c) : '(' + py(c) + ')');
    if (n.t === 'var') return n.name;
    if (n.t === 'const') return n.v ? 'True' : 'False';
    if (n.t === 'not') return 'not ' + w(n.a);
    const a = w(n.a);
    const b = w(n.b);
    switch (n.op) {
      case 'and': return a + ' and ' + b;
      case 'or': return a + ' or ' + b;
      case 'xor': return a + ' != ' + b;
      case 'iff': return a + ' == ' + b;
      case 'imp': return '(not ' + a + ') or ' + b;
      case 'nand': return 'not (' + a + ' and ' + b + ')';
      default: return 'not (' + a + ' or ' + b + ')';
    }
  }
  function compile(n) {
    if (n.t === 'var') {
      const k = n.name;
      return (env) => env[k];
    }
    if (n.t === 'const') {
      const v = n.v;
      return () => v;
    }
    if (n.t === 'not') {
      const f = compile(n.a);
      return (env) => 1 - f(env);
    }
    const fa = compile(n.a);
    const fb = compile(n.b);
    const op = OPS[n.op].f;
    return (env) => op(fa(env), fb(env));
  }
  /** Наборы значений: строка i, первая переменная — старший бит (00…0 первой строкой). */
  function envs(vars) {
    const n = vars.length;
    return U.range(1 << n).map((i) => {
      const e = {};
      vars.forEach((v, j) => (e[v] = (i >> (n - 1 - j)) & 1));
      return e;
    });
  }
  const outs = (ast, vars) => {
    const f = compile(ast);
    return envs(vars).map(f);
  };
  /** Подформулы (без переменных и констант) в порядке вычисления, без повторов. */
  function subformulas(n, acc = [], seen = new Set()) {
    if (n.t === 'not') subformulas(n.a, acc, seen);
    if (n.t === 'bin') (subformulas(n.a, acc, seen), subformulas(n.b, acc, seen));
    if (n.t === 'not' || n.t === 'bin') {
      const k = str(n);
      if (!seen.has(k)) (seen.add(k), acc.push(n));
    }
    return acc;
  }
  const kindOf = (o) => (o.every(Boolean) ? 'тавтология' : o.some(Boolean) ? 'выполнима' : 'противоречие');
  const unionVars = (...asts) => [...new Set(asts.flatMap((a) => varsOf(a)))].sort();
  /** Сравнение двух формул: таблицы на общем наборе переменных. */
  function compare(a, b) {
    const vars = unionVars(a, b);
    const oa = outs(a, vars);
    const ob = outs(b, vars);
    return { vars, oa, ob, eq: oa.every((v, i) => v === ob[i]), aToB: oa.every((v, i) => !v || ob[i]), bToA: ob.every((v, i) => !v || oa[i]) };
  }
  const lit = (v, val) => (val ? v : '¬' + v);
  const litTex = (v, val) => (val ? v : '\\neg ' + v);
  function sdnf(vars, o) {
    const rows = o.map((v, i) => [v, i]).filter(([v]) => v).map(([, i]) => vars.map((x, j) => [x, (i >> (vars.length - 1 - j)) & 1]));
    return { terms: rows, text: rows.length ? rows.map((r) => (r.length > 1 ? '(' : '') + r.map(([x, b]) => lit(x, b)).join(' ∧ ') + (r.length > 1 ? ')' : '')).join(' ∨ ') : '0', tex: rows.length ? rows.map((r) => (r.length > 1 && rows.length > 1 ? '(' : '') + r.map(([x, b]) => litTex(x, b)).join(' \\land ') + (r.length > 1 && rows.length > 1 ? ')' : '')).join(' \\lor ') : '0' };
  }
  function scnf(vars, o) {
    const rows = o.map((v, i) => [v, i]).filter(([v]) => !v).map(([, i]) => vars.map((x, j) => [x, 1 - ((i >> (vars.length - 1 - j)) & 1)]));
    return { terms: rows, text: rows.length ? rows.map((r) => (r.length > 1 ? '(' : '') + r.map(([x, b]) => lit(x, b)).join(' ∨ ') + (r.length > 1 ? ')' : '')).join(' ∧ ') : '1', tex: rows.length ? rows.map((r) => (r.length > 1 && rows.length > 1 ? '(' : '') + r.map(([x, b]) => litTex(x, b)).join(' \\lor ') + (r.length > 1 && rows.length > 1 ? ')' : '')).join(' \\land ') : '1' };
  }
  const popcount = (x) => {
    let c = 0;
    while (x) (c += x & 1), (x >>>= 1);
    return c;
  };
  /** Минимальная ДНФ (Куайн — Мак-Класки + точное покрытие). n ≤ 5. ones/dcs — номера строк. */
  function minDNF(n, ones, dcs = []) {
    const full = (1 << n) - 1;
    if (!ones.length) return { primes: [], cover: [], constant: 0 };
    let cur = new Map();
    [...ones, ...dcs].forEach((m) => cur.set(m + '/' + full, { v: m, mask: full }));
    const primes = [];
    while (cur.size) {
      const arr = [...cur.values()];
      const next = new Map();
      const used = new Set();
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i];
          const b = arr[j];
          if (a.mask !== b.mask) continue;
          const d = (a.v ^ b.v) & a.mask;
          if (popcount(d) !== 1) continue;
          const m = { v: a.v & ~d & full, mask: a.mask & ~d };
          next.set(m.v + '/' + m.mask, m);
          used.add(a.v + '/' + a.mask);
          used.add(b.v + '/' + b.mask);
        }
      }
      arr.forEach((x) => used.has(x.v + '/' + x.mask) || primes.push(x));
      cur = next;
    }
    const covers = (p, m) => (m & p.mask) === (p.v & p.mask);
    const lits = (p) => popcount(p.mask);
    if (primes.some((p) => p.mask === 0)) return { primes, cover: [primes.find((p) => p.mask === 0)], constant: 1 };
    let best = null;
    const cost = (c) => c.length * 100 + c.reduce((s, p) => s + lits(p), 0);
    function search(unc, chosen) {
      if (best && cost(chosen) >= cost(best)) return;
      if (!unc.length) {
        best = chosen.slice();
        return;
      }
      let pick = unc[0];
      let cands = primes.filter((p) => covers(p, pick));
      unc.forEach((m) => {
        const c = primes.filter((p) => covers(p, m));
        if (c.length < cands.length) (pick = m), (cands = c);
      });
      cands.sort((x, y) => lits(x) - lits(y));
      for (const p of cands) search(unc.filter((m) => !covers(p, m)), chosen.concat([p]));
    }
    search(ones.slice(), []);
    return { primes, cover: best, constant: null };
  }
  function implText(p, vars, tx = false) {
    const n = vars.length;
    const L = [];
    vars.forEach((x, j) => {
      const bit = 1 << (n - 1 - j);
      if (p.mask & bit) L.push(tx ? litTex(x, p.v & bit ? 1 : 0) : lit(x, p.v & bit ? 1 : 0));
    });
    return L.length ? L.join(tx ? ' \\land ' : ' ∧ ') : '1';
  }
  function dnfText(cover, vars, tx = false) {
    if (!cover || !cover.length) return '0';
    const parts = cover.map((p) => implText(p, vars, tx));
    if (parts.length === 1) return parts[0];
    return parts.map((t) => (/[∧]|\\land/.test(t) ? '(' + t + ')' : t)).join(tx ? ' \\lor ' : ' ∨ ');
  }
  /** Классы Поста для функции, заданной столбцом значений (n аргументов). */
  function postClasses(o) {
    const N = o.length;
    const n = Math.round(Math.log2(N));
    const full = N - 1;
    const T0 = o[0] === 0;
    const T1 = o[full] === 1;
    let Sd = true;
    let M = true;
    for (let i = 0; i < N; i++) {
      if (o[i] === o[full ^ i]) Sd = false;
      for (let j = 0; j < N; j++) if ((i & ~j) === 0 && o[i] > o[j]) M = false;
    }
    const c = o.slice();
    for (let b = 0; b < n; b++) for (let i = 0; i < N; i++) if (i & (1 << b)) c[i] ^= c[i ^ (1 << b)];
    const Lin = c.every((v, i) => !v || popcount(i) <= 1);
    return { T0, T1, S: Sd, M, L: Lin, zhegalkin: c };
  }
  /** Минимальное по числу листьев дерево решений для булевой функции (перебор подкубов, n ≤ 5). */
  function minTree(n, o) {
    const memo = new Map();
    const rowsOf = (cube) => {
      const res = [];
      for (let i = 0; i < 1 << n; i++) {
        let ok = true;
        for (let j = 0; j < n && ok; j++) if (cube[j] >= 0 && ((i >> (n - 1 - j)) & 1) !== cube[j]) ok = false;
        if (ok) res.push(o[i]);
      }
      return res;
    };
    function go(cube) {
      const key = cube.join(',');
      if (memo.has(key)) return memo.get(key);
      const r = rowsOf(cube);
      let res;
      if (r.every((v) => v === r[0])) res = { leaf: r[0], leaves: 1, depth: 0 };
      else {
        res = null;
        for (let j = 0; j < n; j++) {
          if (cube[j] >= 0) continue;
          const lo = go(cube.map((c, k) => (k === j ? 0 : c)));
          const hi = go(cube.map((c, k) => (k === j ? 1 : c)));
          const cand = { v: j, lo, hi, leaves: lo.leaves + hi.leaves, depth: 1 + Math.max(lo.depth, hi.depth) };
          if (!res || cand.leaves < res.leaves || (cand.leaves === res.leaves && cand.depth < res.depth)) res = cand;
        }
      }
      memo.set(key, res);
      return res;
    }
    return go(new Array(n).fill(-1));
  }
  /** Жадное дерево по Джини на полной таблице (как sklearn: делит, пока лист не чист; при равенстве — первая переменная). */
  function greedyTree(n, o) {
    const gini = (r) => {
      if (!r.length) return 0;
      const p = U.mean(r);
      return 2 * p * (1 - p);
    };
    function rowsOf(cube) {
      const res = [];
      for (let i = 0; i < 1 << n; i++) {
        let ok = true;
        for (let j = 0; j < n && ok; j++) if (cube[j] >= 0 && ((i >> (n - 1 - j)) & 1) !== cube[j]) ok = false;
        if (ok) res.push(o[i]);
      }
      return res;
    }
    function go(cube) {
      const r = rowsOf(cube);
      if (r.every((v) => v === r[0])) return { leaf: r[0], leaves: 1, depth: 0 };
      let bj = -1;
      let bg = -Infinity;
      const gains = [];
      for (let j = 0; j < n; j++) {
        if (cube[j] >= 0) continue;
        const g = gini(r) - 0.5 * gini(rowsOf(cube.map((c, k) => (k === j ? 0 : c)))) - 0.5 * gini(rowsOf(cube.map((c, k) => (k === j ? 1 : c))));
        gains.push([j, g]);
        if (g > bg + 1e-12) (bg = g), (bj = j);
      }
      const lo = go(cube.map((c, k) => (k === bj ? 0 : c)));
      const hi = go(cube.map((c, k) => (k === bj ? 1 : c)));
      return { v: bj, lo, hi, gain: bg, gains, leaves: lo.leaves + hi.leaves, depth: 1 + Math.max(lo.depth, hi.depth) };
    }
    return go(new Array(n).fill(-1));
  }

  /* ---------- поле ввода формулы ---------- */
  const KEYS = ['¬', '∧', '∨', '→', '↔', '⊕', '(', ')'];
  /** o: { label, value, presets: [{label, value}], keys, maxVars, onChange(res) } */
  function formulaInput(parent, o) {
    const box = H('div', { class: 'ctl' });
    if (o.presets) {
      const sel = ui.select(box, { label: o.presetLabel || 'Пример', value: o.presetValue ?? '', options: o.presets.map((p, i) => ({ value: i, label: p.label })), onChange: (v) => set(o.presets[+v].value) });
      box._sel = sel;
    }
    box.appendChild(H('label', { class: 'ctl-label' }, o.label || 'Формула'));
    const inp = H('input', { class: 'input', type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': o.label || 'Формула', style: 'font-family:var(--font-mono);font-size:.98rem' });
    inp.value = o.value;
    box.appendChild(inp);
    const keys = flexRow('gap:4px;margin-top:6px');
    (o.keys || KEYS).forEach((k) => {
      const b = ui.button(keys, { label: k, small: true, kind: 'ghost', title: 'Вставить ' + k });
      b.style.minWidth = '2.1em';
      b.style.fontFamily = 'var(--font-mono)';
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', () => {
        const a = inp.selectionStart ?? inp.value.length;
        const z = inp.selectionEnd ?? inp.value.length;
        const ins = /[()]/.test(k) || k === '¬' ? k : ' ' + k + ' ';
        inp.value = inp.value.slice(0, a) + ins + inp.value.slice(z);
        inp.selectionStart = inp.selectionEnd = a + ins.length;
        inp.focus();
        upd();
      });
    });
    box.appendChild(keys);
    const msg = H('div', { class: 'ctl-help', style: 'min-height:1.2em' });
    box.appendChild(msg);
    parent.appendChild(box);
    let last = null;
    function upd() {
      const r = parse(inp.value, o.maxVars || MAXV);
      if (r.error) {
        msg.textContent = '⚠ ' + r.error;
        msg.style.color = 'var(--critical-text)';
        inp.style.borderColor = 'var(--critical)';
        return;
      }
      inp.style.borderColor = '';
      msg.style.color = '';
      msg.textContent = 'разбор: ' + str(r.ast, true);
      last = r;
      o.onChange(r);
    }
    function set(v) {
      inp.value = v;
      upd();
    }
    inp.addEventListener('input', upd);
    return { el: box, set, upd, get result() { return last; }, input: inp };
  }
  /** Переключатели значений переменных (пересоздаются при смене набора). */
  function varToggles(parent, onChange) {
    const box = H('div', { class: 'ctl' });
    parent.appendChild(box);
    const env = {};
    return {
      env,
      setVars(vars) {
        box.textContent = '';
        box.appendChild(H('span', { class: 'ctl-label' }, 'Значения переменных'));
        const row = flexRow('gap:6px');
        vars.forEach((v) => {
          if (!(v in env)) env[v] = 1;
          const b = H('button', { type: 'button', class: 'btn small', style: 'font-family:var(--font-mono);min-width:3.6em' });
          const paint = () => {
            b.textContent = v + ' = ' + env[v];
            b.style.background = env[v] ? tint(C_TRUE, 30) : 'var(--surface-2)';
            b.style.borderColor = env[v] ? C_TRUE : 'var(--border-strong)';
          };
          b.addEventListener('click', () => {
            env[v] = 1 - env[v];
            paint();
            onChange();
          });
          paint();
          row.appendChild(b);
        });
        box.appendChild(row);
      },
    };
  }
  const PY_IT = 'from itertools import product\n';
  const pyLambda = (ast, vars) => 'lambda ' + vars.join(', ') + ': ' + py(ast);

  /* ---------- рисование дерева (формулы или решения) ---------- */
  /** tree: { label, kids: [..], val? } → SVG. Возвращает svg. */
  function drawTree(parent, root, o = {}) {
    const nodes = [];
    let leafX = 0;
    let maxD = 0;
    (function lay(nd, d) {
      nd._d = d;
      maxD = Math.max(maxD, d);
      if (!nd.kids || !nd.kids.length) nd._x = leafX++;
      else {
        nd.kids.forEach((k) => lay(k, d + 1));
        nd._x = (nd.kids[0]._x + nd.kids[nd.kids.length - 1]._x) / 2;
      }
      nodes.push(nd);
    })(root, 0);
    const dx = o.dx || 54;
    const dy = o.dy || 58;
    const r = o.r || 17;
    const W = Math.max(leafX, 1) * dx + 30;
    const Hh = (maxD + 1) * dy + 10;
    const svg = svgBox(parent, W, Hh, Math.min(W, o.minW || 320), o.maxW || W * 1.25);
    const X = (nd) => 15 + dx / 2 + nd._x * dx;
    const Y = (nd) => 8 + r + nd._d * dy;
    nodes.forEach((nd) => (nd.kids || []).forEach((k, i) => {
      svg.appendChild(S('line', { x1: X(nd), y1: Y(nd), x2: X(k), y2: Y(k), stroke: k.hot ? 'var(--ink)' : 'var(--border-strong)', 'stroke-width': k.hot ? 2.6 : 1.4 }));
      if (k.edge !== undefined) svg.appendChild(sText((X(nd) + X(k)) / 2 + (i ? 7 : -7), (Y(nd) + Y(k)) / 2 - 4, k.edge, { size: 11, color: 'var(--ink-2)', anchor: i ? 'start' : 'end' }));
    }));
    nodes.forEach((nd) => {
      const has = nd.val === 0 || nd.val === 1;
      const col = has ? (nd.val ? C_TRUE : 'var(--border-strong)') : 'var(--border-strong)';
      const leaf = !nd.kids || !nd.kids.length;
      const shape = leaf && o.squareLeaves ? S('rect', { x: X(nd) - r, y: Y(nd) - r * 0.8, width: 2 * r, height: 1.6 * r, rx: 6 }) : S('circle', { cx: X(nd), cy: Y(nd), r: leaf ? r * 0.92 : r });
      shape.setAttribute('fill', nd.fill || (has ? (nd.val ? tint(C_TRUE, 32) : 'var(--surface-2)') : 'var(--surface)'));
      shape.setAttribute('stroke', nd.cur ? 'var(--c-orange)' : col);
      shape.setAttribute('stroke-width', nd.cur ? 3.4 : 1.8);
      svg.appendChild(shape);
      svg.appendChild(sText(X(nd), Y(nd), nd.label, { size: nd.label.length > 3 ? 11 : 14, bold: true, mono: true }));
      if (has && !leaf && o.showVals !== false) svg.appendChild(sText(X(nd) + r + 4, Y(nd) - r + 2, String(nd.val), { size: 11, bold: true, anchor: 'start', color: nd.val ? C_TRUE : 'var(--muted)' }));
    });
    return svg;
  }
  /** AST → дерево для drawTree; vals — Map(node → значение). */
  function astTree(n, vals) {
    const lab = n.t === 'var' ? n.name : n.t === 'const' ? String(n.v) : n.t === 'not' ? '¬' : OPS[n.op].sym;
    const kids = n.t === 'not' ? [astTree(n.a, vals)] : n.t === 'bin' ? [astTree(n.a, vals), astTree(n.b, vals)] : [];
    const t = { label: lab, kids, node: n };
    if (vals && vals.has(n)) t.val = vals.get(n);
    return t;
  }
  /** Порядок вычисления узлов (после потомков). */
  function postorder(n, acc = []) {
    if (n.t === 'not') postorder(n.a, acc);
    if (n.t === 'bin') (postorder(n.a, acc), postorder(n.b, acc));
    acc.push(n);
    return acc;
  }
  /** Булево дерево решений (из minTree/greedyTree) → дерево для drawTree. */
  function boolTreeDraw(t, vars) {
    if (t.leaf !== undefined) return { label: String(t.leaf), kids: [], val: t.leaf };
    const lo = boolTreeDraw(t.lo, vars);
    const hi = boolTreeDraw(t.hi, vars);
    lo.edge = '0';
    hi.edge = '1';
    return { label: vars[t.v], kids: [lo, hi] };
  }

  /* ==============================================================================
   * 0. Возможные миры: детектив
   * ============================================================================== */
  const SUSPECTS = ['Аня', 'Борис', 'Вика'];
  const CLUES = [
    { t: 'Хотя бы один из троих виновен', f: 'A ∨ B ∨ C' },
    { t: 'Если виновна Аня, то у неё был сообщник', f: 'A → B ∨ C' },
    { t: 'Борис и Вика вместе не действовали', f: '¬(B ∧ C)' },
    { t: 'Если виновен Борис, то виновна и Аня', f: 'B → A' },
    { t: 'Вика без Ани не действовала', f: 'C → A' },
    { t: 'Аня не стала бы работать с Борисом', f: 'A → ¬B' },
  ].map((c) => ({ ...c, ast: P(c.f) }));
  GBC.widget('worlds', (el) => {
    const on = CLUES.map(() => false);
    const w = ui.shell(el, { title: 'Логика — это отсечение невозможных миров', sub: 'Трое подозреваемых; каждый либо виновен (1), либо нет (0) — всего 2³ = 8 возможных «миров». Каждая улика вычёркивает миры, где она ложна. Включайте улики по одной.' });
    CLUES.forEach((c, i) => ui.toggle(w.controls, { label: (i + 1) + '. ' + c.t + '  (' + c.f + ')', checked: false, onChange: (v) => ((on[i] = v), draw()) }));
    ui.button(w.controls, { label: 'Все улики', icon: 'check', onClick: () => (on.fill(true), w.controls.querySelectorAll('input[type=checkbox]').forEach((x) => (x.checked = true)), draw()) });
    const grid = cardGrid(150);
    const know = H('div', { style: 'margin:4px 0' });
    w.main.append(grid, know);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'осталось миров' }, { key: 'u', label: 'улик учтено' }, { key: 'c', label: 'вывод' }]);
    const worlds = envs(['A', 'B', 'C']);
    const fs = CLUES.map((c) => compile(c.ast));
    function draw() {
      grid.textContent = '';
      const alive = [];
      worlds.forEach((e, k) => {
        const kill = CLUES.findIndex((c, i) => on[i] && !fs[i](e));
        const ok = kill < 0;
        if (ok) alive.push(e);
        const cd = card('Мир ' + (k + 1) + ':  A=' + e.A + ' B=' + e.B + ' C=' + e.C);
        cd.el.style.opacity = ok ? 1 : 0.42;
        cd.el.style.borderColor = ok && on.some(Boolean) ? C_TRUE : 'var(--border)';
        cd.el.style.borderWidth = ok && on.some(Boolean) ? '2px' : '1px';
        if (!ok) cd.titleEl.style.textDecoration = 'line-through';
        const row = flexRow('gap:4px');
        ['A', 'B', 'C'].forEach((v, j) => row.appendChild(badge(SUSPECTS[j] + (e[v] ? ' — виновен' : ' — нет'), e[v] ? 'warn' : '')));
        cd.body.appendChild(row);
        cd.body.appendChild(H('div', { style: 'margin-top:6px;font-size:.85rem;color:' + (ok ? 'var(--ink-2)' : 'var(--critical-text)') }, ok ? 'возможен' : '✘ противоречит улике ' + (kill + 1)));
        grid.appendChild(cd.el);
      });
      know.textContent = '';
      const facts = ['A', 'B', 'C'].map((v, j) => {
        if (!alive.length) return SUSPECTS[j] + ': противоречие — улики несовместны';
        if (alive.every((e) => e[v])) return SUSPECTS[j] + ': точно виновен(на) — 1 во всех оставшихся мирах';
        if (alive.every((e) => !e[v])) return SUSPECTS[j] + ': точно невиновен(на) — 0 во всех оставшихся мирах';
        return SUSPECTS[j] + ': неизвестно — есть миры и с 1, и с 0';
      });
      know.appendChild(monoBox()).textContent = facts.join('\n');
      st.set('n', alive.length + ' из 8');
      st.set('u', String(on.filter(Boolean).length));
      st.set('c', alive.length === 1 ? 'виновны: ' + (['A', 'B', 'C'].filter((v) => alive[0][v]).map((v) => SUSPECTS['ABC'.indexOf(v)]).join(' и ') || 'никто') : alive.length ? 'ещё неясно' : 'противоречие');
      note.innerHTML = '<b>Главная идея урока.</b> Высказывание о подозреваемых — это множество миров, в которых оно истинно; «и» между уликами — пересечение этих множеств. <b>Вывод следует</b> из улик, если он истинен во <em>всех</em> оставшихся мирах. Включите улики 1–5: останутся два мира, но в обоих Аня виновна — это уже доказано, хотя её сообщник ещё неизвестен. Улика 6 оставляет один мир. Таблица истинности — это и есть список всех миров, а доказательство — способ вычеркнуть невозможные, не перебирая их по одному.';
    }
    w.pythonAction(() => PY_IT + '\nclues = {\n' + CLUES.map((c, i) => '    "' + (i + 1) + '. ' + c.t + '": ' + pyLambda(c.ast, ['A', 'B', 'C']) + ',').join('\n') + '\n}\nactive = [' + on.map((v, i) => (v ? i : -1)).filter((i) => i >= 0).join(', ') + ']   # номера включённых улик (с нуля)\nnames = list(clues)\nworlds = [w for w in product([0, 1], repeat=3) if all(clues[names[i]](*w) for i in active)]\nprint("осталось миров:", len(worlds))\nfor w in worlds:\n    print(dict(zip(["Аня", "Борис", "Вика"], w)))\n');
    draw();
  });

  /* ==============================================================================
   * 1. Высказывание или нет
   * ============================================================================== */
  const SENT = [
    { s: '7 — простое число', a: 0, why: 'Утверждение, и оно истинно: 7 делится только на 1 и на себя.' },
    { s: '2 + 2 = 5', a: 1, why: 'Утверждение, и оно ложно. Ложное высказывание — тоже высказывание.' },
    { s: 'Который час?', a: 3, why: 'Вопрос ничего не утверждает — его нельзя назвать ни истинным, ни ложным.' },
    { s: 'Закройте ноутбук', a: 3, why: 'Побуждение (приказ), а не утверждение.' },
    { s: 'x > 3', a: 3, why: 'Истинность зависит от x: при x = 5 — истина, при x = 1 — ложь. Это предикат (шаг 23), высказыванием он станет после подстановки x или навешивания квантора.' },
    { s: 'Существует число x, для которого x > 3', a: 0, why: 'Квантор «существует» связал переменную: утверждение больше не зависит от x и истинно (например, x = 4).' },
    { s: 'Глубина дерева равна 3', a: 3, why: 'Какого дерева? Без контекста это предикат от дерева; о конкретной обученной модели — уже высказывание.' },
    { s: 'Число 2¹⁰⁰ + 1 — простое', a: 1, why: 'Высказывание, и оно ложно: 2⁴ = 16 ≡ −1 (mod 17), значит, 2¹⁰⁰ = (2⁴)²⁵ ≡ −1 и 2¹⁰⁰ + 1 делится на 17.' },
    { s: 'Каждое чётное число больше 2 — сумма двух простых', a: 2, why: 'Гипотеза Гольдбаха: это высказывание (оно либо истинно, либо ложно), но какое — никто не знает. Проверено до 4·10¹⁸, не доказано.' },
    { s: 'Ансамбль пней (max_depth=1) не может точно выразить XOR двух признаков', a: 0, why: 'Высказывание, и оно истинно — мы докажем его от противного в шаге 37.' },
    { s: 'Это предложение ложно', a: 3, why: 'Парадокс лжеца: если оно истинно, то ложно, и наоборот. Ему нельзя приписать значение, поэтому в классической логике это не высказывание (шаг 40).' },
  ];
  const CATS = ['истинно', 'ложно', 'высказывание, истинность неизвестна', 'не высказывание'];
  GBC.widget('statement-sorter', (el) => {
    const picked = SENT.map(() => null);
    const w = ui.shell(el, { title: 'Высказывание или нет?', sub: 'Высказывание — утверждение, которое либо истинно, либо ложно. Разложите предложения по четырём корзинам; после ответа появится объяснение.', stack: true });
    const list = H('div', { style: 'display:grid;gap:8px' });
    w.main.appendChild(list);
    ui.button(w.controls, { label: 'Сбросить', icon: 'reset', onClick: () => (picked.fill(null), draw()) });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'отвечено' }, { key: 'ok', label: 'верно' }]);
    function draw() {
      list.textContent = '';
      SENT.forEach((it, i) => {
        const row = H('div', { style: 'border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:var(--surface)' });
        row.appendChild(H('div', { style: 'font-weight:650;margin-bottom:6px' }, (i + 1) + '. «' + it.s + '»'));
        const btns = flexRow('gap:4px');
        CATS.forEach((c, k) => {
          const b = ui.button(btns, { label: c, small: true, kind: picked[i] === null ? '' : k === it.a ? 'primary' : '', onClick: () => {
            if (picked[i] !== null) return;
            picked[i] = k;
            draw();
          } });
          if (picked[i] !== null) b.disabled = k !== it.a && k !== picked[i];
          if (picked[i] === k && k !== it.a) (b.style.borderColor = 'var(--critical)'), (b.style.color = 'var(--critical-text)');
        });
        row.appendChild(btns);
        if (picked[i] !== null) row.appendChild(H('div', { style: 'margin-top:6px;font-size:.88rem;color:var(--ink-2)' }, (picked[i] === it.a ? '✔ ' : '✘ Ответ: ' + CATS[it.a] + '. ') + it.why));
        list.appendChild(row);
      });
      const n = picked.filter((x) => x !== null).length;
      st.set('n', n + ' из ' + SENT.length);
      st.set('ok', String(picked.filter((x, i) => x === SENT[i].a).length));
      note.innerHTML = 'Логика высказываний не интересуется <em>смыслом</em> утверждений — только тем, истинны они или ложны. Поэтому важно отличать высказывание (у него есть значение 1 или 0, даже если мы его не знаем) от вопроса, приказа, предиката с переменной или парадокса.';
    }
    draw();
  });

  /* ==============================================================================
   * 2. Выключатели: И — последовательно, ИЛИ — параллельно, НЕ — размыкающая кнопка
   * ============================================================================== */
  const CIRCUITS = {
    and: { t: 'A ∧ B', vars: ['A', 'B'] },
    or: { t: 'A ∨ B', vars: ['A', 'B'] },
    not: { t: '¬A', vars: ['A'] },
    andor: { t: 'A ∧ (B ∨ C)', vars: ['A', 'B', 'C'] },
    orand: { t: '(A ∧ B) ∨ C', vars: ['A', 'B', 'C'] },
  };
  GBC.widget('logic-gates', (el) => {
    const s = { A: 1, B: 0, C: 1, sch: 'and' };
    const w = ui.shell(el, { title: 'Логика в проводах: связки как электрические схемы', sub: 'Лампа горит (1), если ток находит путь. Последовательно — «И», параллельно — «ИЛИ», размыкающая кнопка — «НЕ». Схемы можно комбинировать.' });
    ui.select(w.controls, { label: 'Схема', value: s.sch, options: [{ value: 'and', label: 'последовательно: A ∧ B' }, { value: 'or', label: 'параллельно: A ∨ B' }, { value: 'not', label: 'размыкающая кнопка: ¬A' }, { value: 'andor', label: 'A последовательно с (B ∥ C): A ∧ (B ∨ C)' }, { value: 'orand', label: '(A, затем B) ∥ C: (A ∧ B) ∨ C' }], onChange: (v) => ((s.sch = v), draw()) });
    const tg = ['A', 'B', 'C'].map((v) => ui.toggle(w.controls, { label: 'Выключатель ' + v + ' замкнут (' + v + ' = 1)', checked: !!s[v], onChange: (x) => ((s[v] = x ? 1 : 0), draw()) }));
    const plot = new GBC.Plot(w.main, { height: 230, equal: true, grid: 'none', x: { label: '', domain: [0, 10], ticks: [] }, y: { label: '', domain: [0.4, 6.2], ticks: [] }, margin: { left: 8, bottom: 8, right: 8, top: 8 } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'формула схемы' }, { key: 'L', label: 'лампа' }]);
    function sw(x0, x1, y, closed, name, invert) {
      return [
        { type: 'segments', x1: [x0], y1: [y], x2: closed ? [x1] : [x1 - 0.35], y2: closed ? [y] : [y + 0.85], color: 'ink', width: 3, opacity: 1 },
        { type: 'points', x: [x0, x1], y: [y, y], color: 'ink', r: 3.5 },
        { type: 'text', items: [{ x: (x0 + x1) / 2, y: y - 0.5, anchor: 'middle', text: name + ' = ' + s[name] + (invert ? (s[name] ? ' (нажата)' : ' (отпущена)') : ''), bold: true }] },
      ];
    }
    function draw() {
      const C = CIRCUITS[s.sch];
      tg.forEach((t, i) => (t.el.style.display = i < C.vars.length ? '' : 'none'));
      const ast = P(C.t);
      const lit = compile(ast)(s);
      const wire = { x1: [], y1: [], x2: [], y2: [] };
      const add = (a, b, c, d) => (wire.x1.push(a), wire.y1.push(b), wire.x2.push(c), wire.y2.push(d));
      const L = [];
      add(1, 1, 1, 2.6);
      add(1, 3.4, 1, 5);
      add(1, 1, 9, 1);
      add(9, 1, 9, 2.6);
      if (s.sch === 'and' || s.sch === 'not') {
        if (s.sch === 'and') {
          add(1, 5, 2.5, 5);
          add(4, 5, 5.5, 5);
          add(7, 5, 9, 5);
          L.push(...sw(2.5, 4, 5, !!s.A, 'A'), ...sw(5.5, 7, 5, !!s.B, 'B'));
        } else {
          add(1, 5, 4, 5);
          add(5.5, 5, 9, 5);
          L.push(...sw(4, 5.5, 5, !s.A, 'A', true));
        }
        add(9, 5, 9, 3.4);
      } else if (s.sch === 'or') {
        add(1, 5, 3, 5);
        add(3, 5.4, 3, 3.9);
        add(3, 5.4, 4.2, 5.4);
        add(3, 3.9, 4.2, 3.9);
        add(5.7, 5.4, 7, 5.4);
        add(5.7, 3.9, 7, 3.9);
        add(7, 5.4, 7, 3.9);
        add(7, 4.6, 9, 4.6);
        add(9, 4.6, 9, 3.4);
        L.push(...sw(4.2, 5.7, 5.4, !!s.A, 'A'), ...sw(4.2, 5.7, 3.9, !!s.B, 'B'));
      } else if (s.sch === 'andor') {
        add(1, 5, 1.6, 5);
        add(2.9, 5, 3.6, 5);
        add(3.6, 5.4, 3.6, 3.9);
        add(3.6, 5.4, 4.6, 5.4);
        add(3.6, 3.9, 4.6, 3.9);
        add(6.1, 5.4, 7.4, 5.4);
        add(6.1, 3.9, 7.4, 3.9);
        add(7.4, 5.4, 7.4, 3.9);
        add(7.4, 4.6, 9, 4.6);
        add(9, 4.6, 9, 3.4);
        L.push(...sw(1.6, 2.9, 5, !!s.A, 'A'), ...sw(4.6, 6.1, 5.4, !!s.B, 'B'), ...sw(4.6, 6.1, 3.9, !!s.C, 'C'));
      } else {
        add(1, 5, 2.6, 5);
        add(2.6, 5.4, 2.6, 3.9);
        add(2.6, 5.4, 3.0, 5.4);
        add(4.3, 5.4, 5.3, 5.4);
        add(6.6, 5.4, 7.6, 5.4);
        add(2.6, 3.9, 4.4, 3.9);
        add(5.7, 3.9, 7.6, 3.9);
        add(7.6, 5.4, 7.6, 3.9);
        add(7.6, 4.6, 9, 4.6);
        add(9, 4.6, 9, 3.4);
        L.push(...sw(3.0, 4.3, 5.4, !!s.A, 'A'), ...sw(5.3, 6.6, 5.4, !!s.B, 'B'), ...sw(4.4, 5.7, 3.9, !!s.C, 'C'));
      }
      L.unshift({ type: 'segments', ...wire, color: lit ? 'tree' : 'ink2', width: 2, opacity: 1 });
      L.push(
        { type: 'segments', x1: [0.6, 0.8], y1: [2.6, 3.4], x2: [1.4, 1.2], y2: [2.6, 3.4], color: 'ink', width: 3, opacity: 1 },
        { type: 'text', items: [{ x: 1.7, y: 3, dy: 4, text: 'батарея' }, { x: 9, y: 1.7, anchor: 'middle', text: lit ? 'горит' : 'не горит', bold: !!lit }] },
        { type: 'points', x: [9], y: [3], color: lit ? 'yellow' : 'muted', r: 18, hollow: !lit },
      );
      plot.render(L);
      tbl.textContent = '';
      if (C.vars.length === 2 || s.sch === 'not') {
        const rows = [[0, 0], [0, 1], [1, 0], [1, 1]];
        boolTable(tbl, ['A', 'B', '¬A', 'A ∧ B', 'A ∨ B', 'A ⊕ B', 'A → B', 'A ↔ B'], rows.map(([a, b]) => [a, b, 1 - a, a & b, a | b, a ^ b, (1 - a) | b, a === b ? 1 : 0]), { hl: (i) => rows[i][0] === s.A && (s.sch === 'not' || rows[i][1] === s.B), sepAfter: 1 });
      } else {
        const E = envs(C.vars);
        const subs = subformulas(ast);
        boolTable(tbl, [...C.vars, ...subs.map((x) => str(x))], E.map((e) => [...C.vars.map((v) => e[v]), ...subs.map((x) => compile(x)(e))]), { hl: (i) => C.vars.every((v) => E[i][v] === s[v]), outCols: new Set([C.vars.length + subs.length - 1]), sepAfter: C.vars.length - 1 });
      }
      st.set('f', C.t);
      st.set('L', lit ? 'горит (1)' : 'не горит (0)');
      const NOTES = {
        and: 'Последовательно: ток проходит, только если замкнуты <b>оба</b> выключателя — это <b>конъюнкция</b> A ∧ B («и»). В столбце A ∧ B одна единица из четырёх.',
        or: 'Параллельно: ток проходит, если замкнут <b>хотя бы один</b> — это <b>дизъюнкция</b> A ∨ B («или»). Ноль только когда оба разомкнуты. Логическое «или» <em>включающее</em>: при A = B = 1 лампа тоже горит. «Либо, либо» — это ⊕, исключающее «или».',
        not: 'Размыкающая кнопка: пока её не нажали (A = 0), цепь замкнута и лампа горит; нажали (A = 1) — цепь разорвана. Лампа показывает <b>отрицание</b> ¬A. Именно так устроены «инверторы» в микросхемах.',
        andor: 'Комбинация: A последовательно с параллельной парой (B, C). Таблица перечисляет все 2³ = 8 положений выключателей; промежуточный столбец B ∨ C — ток через параллельную часть. Скобки в формуле повторяют устройство схемы.',
        orand: 'Другая комбинация из тех же выключателей: ветка «A, затем B» параллельно с C. Сравните таблицу с предыдущей схемой — формулы A ∧ (B ∨ C) и (A ∧ B) ∨ C различаются, например, при A = 0, C = 1: здесь лампа горит, там нет. Порядок скобок важен.',
      };
      note.innerHTML = NOTES[s.sch];
    }
    w.pythonAction(() => {
      const C = CIRCUITS[s.sch];
      const ast = P(C.t);
      return PY_IT + '\nlamp = ' + pyLambda(ast, C.vars) + '   # ' + C.t + '\nfor row in product([0, 1], repeat=' + C.vars.length + '):\n    print(*row, "→", int(lamp(*map(bool, row))))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 3. Импликация на данных: «если спам, то есть ссылка»
   * ============================================================================== */
  const MAILS = [
    ['Выигрыш! Заберите приз', 1, 1], ['Отчёт за квартал', 0, 0], ['Скидка 90 % только сегодня', 1, 1], ['Встреча в 15:00', 0, 0],
    ['Подтвердите пароль', 1, 1], ['Ссылка на презентацию', 0, 1], ['Вы унаследовали миллион', 1, 0], ['Обед в пятницу?', 0, 0],
    ['Кредит без проверок', 1, 1], ['Новости курса', 0, 1], ['Код-ревью: посмотрите правки', 0, 1], ['Счёт на оплату', 0, 0],
  ].map(([subj, spam, link], i) => ({ id: i + 1, subj, spam, link }));
  const CLAIMS = [
    { t: 'Если письмо — спам, то в нём есть ссылка', p: (m) => m.spam, q: (m) => m.link, f: 'спам → ссылка', kind: 'исходное', py: ['df.spam', 'df.link'] },
    { t: 'Если в письме есть ссылка, то это спам', p: (m) => m.link, q: (m) => m.spam, f: 'ссылка → спам', kind: 'обращение', py: ['df.link', 'df.spam'] },
    { t: 'Если в письме нет ссылки, то это не спам', p: (m) => 1 - m.link, q: (m) => 1 - m.spam, f: '¬ссылка → ¬спам', kind: 'контрапозиция', py: ['~df.link', '~df.spam'] },
    { t: 'Если письмо не спам, то ссылки в нём нет', p: (m) => 1 - m.spam, q: (m) => 1 - m.link, f: '¬спам → ¬ссылка', kind: 'противоположное', py: ['~df.spam', '~df.link'] },
  ];
  GBC.widget('promise', (el) => {
    const s = { c: 0, drop: false };
    const w = ui.shell(el, { title: 'Импликация как обещание: проверяем правило на данных', sub: 'Правило «если P, то Q» про все письма — это импликация P → Q в каждой строке. Нарушить её может только строка, где P истинно, а Q ложно.' });
    ui.select(w.controls, { label: 'Правило', value: s.c, options: CLAIMS.map((c, i) => ({ value: i, label: c.f + ' (' + c.kind + ')' })), onChange: (v) => ((s.c = +v), draw()) });
    ui.toggle(w.controls, { label: 'Удалить письмо № 7 («Вы унаследовали миллион»)', checked: false, onChange: (v) => ((s.drop = v), draw()) });
    const head = H('div', { style: 'font-weight:650;margin:2px 0 6px' });
    const quad = H('div');
    const tbl = H('div');
    w.main.append(head, quad, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'правило верно для всех писем?' }, { key: 'cx', label: 'контрпримеров' }, { key: 'app', label: 'условие выполнено в' }]);
    function draw() {
      const C = CLAIMS[s.c];
      const D = MAILS.filter((m) => !(s.drop && m.id === 7));
      head.textContent = '«' + C.t + '»  —  ' + C.f;
      const cls = D.map((m) => (C.p(m) ? (C.q(m) ? 'ok' : 'bad') : 'vac'));
      quad.textContent = '';
      const cnt = (p, q) => D.filter((m) => C.p(m) === p && C.q(m) === q).length;
      boolTable(quad, ['P', 'Q', 'P → Q', 'писем', 'смысл'], [[1, 1, 1, cnt(1, 1), 'обещание выполнено'], [1, 0, 0, cnt(1, 0), 'нарушение — контрпример'], [0, 1, 1, cnt(0, 1), 'условие ложно — правило не задето'], [0, 0, 1, cnt(0, 0), 'условие ложно — правило не задето']], { bad: (i) => i === 1 && cnt(1, 0) > 0, outCols: new Set([2]), sepAfter: 1 });
      tbl.textContent = '';
      const t = H('table', { class: 'data' });
      t.appendChild(H('thead', null, H('tr', null, ['№', 'тема письма', 'спам', 'ссылка', 'для правила'].map((c) => H('th', null, c)))));
      const tb = H('tbody');
      D.forEach((m, i) => tb.appendChild(H('tr', { style: cls[i] === 'bad' ? 'background:var(--critical-soft)' : cls[i] === 'ok' ? 'background:' + tint(C_TRUE, 12) : null }, H('td', null, String(m.id)), H('td', null, m.subj), H('td', { style: 'text-align:center' }, m.spam ? 'да' : 'нет'), H('td', { style: 'text-align:center' }, m.link ? 'да' : 'нет'), H('td', { style: 'color:' + (cls[i] === 'bad' ? 'var(--critical-text)' : cls[i] === 'ok' ? 'var(--ink)' : 'var(--muted)') }, cls[i] === 'bad' ? '✘ контрпример' : cls[i] === 'ok' ? '✔ выполнено' : '— условие ложно'))));
      t.appendChild(tb);
      tbl.appendChild(H('div', { class: 'table-wrap' }, t));
      const bad = cls.filter((c) => c === 'bad').length;
      st.set('v', bad ? 'нет' : 'да');
      st.set('cx', String(bad));
      st.set('app', cls.filter((c) => c !== 'vac').length + ' из ' + D.length);
      note.innerHTML = 'Сравните правила попарно. <b>Исходное</b> «спам → ссылка» и его <b>контрапозиция</b> «нет ссылки → не спам» нарушаются одним и тем же письмом № 7: это одно и то же утверждение. <b>Обращение</b> «ссылка → спам» и <b>противоположное</b> «не спам → нет ссылки» тоже равносильны между собой, но нарушаются письмами 6, 10, 11 — другими. Удалите письмо № 7: исходное правило и контрапозиция станут верными одновременно, а обращение — нет. Строки, где условие ложно, правило не нарушают («истинно по пустому»): письмо без признаков спама ничего не говорит о правиле «если спам, то…».';
    }
    w.pythonAction(() => {
      const C = CLAIMS[s.c];
      return 'import pandas as pd\n\nmails = ' + JSON.stringify(MAILS.map((m) => [m.subj, m.spam, m.link])) + '\ndf = pd.DataFrame(mails, columns=["subj", "spam", "link"], index=range(1, 13)).astype({"spam": bool, "link": bool})\n' + (s.drop ? 'df = df.drop(index=7)\n' : '') + '\nP, Q = ' + C.py[0] + ', ' + C.py[1] + '   # ' + C.f + '\nholds = ~P | Q                      # импликация P → Q в каждой строке\nprint("контрпримеры:\\n", df[P & ~Q])\nprint("правило верно для всех писем:", holds.all())\n';
    });
    draw();
  });

  /* ==============================================================================
   * 4. Необходимое и достаточное условие на числах 1…60
   * ============================================================================== */
  const isPrime = (n) => {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  };
  const NPRED = {
    div2: { t: 'n чётно', f: (n) => n % 2 === 0, py: 'n % 2 == 0' },
    div3: { t: 'n делится на 3', f: (n) => n % 3 === 0, py: 'n % 3 == 0' },
    div4: { t: 'n делится на 4', f: (n) => n % 4 === 0, py: 'n % 4 == 0' },
    div6: { t: 'n делится на 6', f: (n) => n % 6 === 0, py: 'n % 6 == 0' },
    d23: { t: 'n делится и на 2, и на 3', f: (n) => n % 2 === 0 && n % 3 === 0, py: 'n % 2 == 0 and n % 3 == 0' },
    div12: { t: 'n делится на 12', f: (n) => n % 12 === 0, py: 'n % 12 == 0' },
    div10: { t: 'n делится на 10', f: (n) => n % 10 === 0, py: 'n % 10 == 0' },
    last0: { t: 'n оканчивается на 0', f: (n) => n % 10 === 0, py: 'str(n).endswith("0")' },
    div5: { t: 'n делится на 5', f: (n) => n % 5 === 0, py: 'n % 5 == 0' },
    prime: { t: 'n простое', f: isPrime, py: 'is_prime(n)' },
    odd: { t: 'n нечётно', f: (n) => n % 2 === 1, py: 'n % 2 == 1' },
    p_gt2: { t: 'n простое и n > 2', f: (n) => isPrime(n) && n > 2, py: 'is_prime(n) and n > 2' },
    sq: { t: 'n — точный квадрат', f: (n) => Number.isInteger(Math.sqrt(n)), py: 'int(n ** 0.5) ** 2 == n' },
    gt30: { t: 'n > 30', f: (n) => n > 30, py: 'n > 30' },
  };
  GBC.widget('nec-suf', (el) => {
    const s = { p: 'div4', q: 'div2' };
    const keys = Object.keys(NPRED);
    const w = ui.shell(el, { title: 'Необходимое и достаточное условие', sub: 'P достаточно для Q, если P → Q верно для всех n (каждое P-число — Q-число). Тогда Q необходимо для P. Числа 1…60: левая половина клетки — P, правая — Q.' });
    ui.select(w.controls, { label: 'Условие P', value: s.p, options: keys.map((k) => ({ value: k, label: NPRED[k].t })), onChange: (v) => ((s.p = v), draw()) });
    ui.select(w.controls, { label: 'Условие Q', value: s.q, options: keys.map((k) => ({ value: k, label: NPRED[k].t })), onChange: (v) => ((s.q = v), draw()) });
    const legend = legendRow([[C_TRUE, 'P истинно'], ['var(--c-orange)', 'Q истинно'], ['var(--critical)', 'контрпример к P → Q'], ['var(--ink-2)', 'контрпример к Q → P', true]]);
    w.main.appendChild(legend);
    const holder = H('div');
    const verdict = monoBox();
    w.main.append(holder, verdict);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pq', label: 'P → Q' }, { key: 'qp', label: 'Q → P' }, { key: 'rel', label: 'отношение' }]);
    function draw() {
      const Pp = NPRED[s.p];
      const Qp = NPRED[s.q];
      holder.textContent = '';
      const svg = svgBox(holder, 10 * 46 + 4, 6 * 40 + 4, 360, 560);
      const cx1 = [];
      const cx2 = [];
      for (let n = 1; n <= 60; n++) {
        const i = (n - 1) % 10;
        const j = Math.floor((n - 1) / 10);
        const x = 2 + i * 46;
        const y = 2 + j * 40;
        const p = Pp.f(n);
        const q = Qp.f(n);
        if (p && !q) cx1.push(n);
        if (q && !p) cx2.push(n);
        svg.appendChild(S('rect', { x: x + 1, y: y + 1, width: 22, height: 36, fill: p ? tint(C_TRUE, 50) : 'var(--surface-2)' }));
        svg.appendChild(S('rect', { x: x + 23, y: y + 1, width: 21, height: 36, fill: q ? tint('var(--c-orange)', 50) : 'var(--surface-2)' }));
        const bad1 = p && !q;
        const bad2 = q && !p;
        svg.appendChild(S('rect', { x: x + 1.5, y: y + 1.5, width: 42, height: 35, rx: 4, fill: 'none', stroke: bad1 ? 'var(--critical)' : bad2 ? 'var(--ink-2)' : 'var(--border)', 'stroke-width': bad1 || bad2 ? 2.6 : 1, 'stroke-dasharray': bad2 ? '4 3' : null }));
        svg.appendChild(sText(x + 23, y + 20, String(n), { size: 13, bold: p || q }));
      }
      const a = !cx1.length;
      const b = !cx2.length;
      const rel = a && b ? 'P ⇔ Q: равносильны (необходимо и достаточно)' : a ? 'P достаточно для Q; Q необходимо для P' : b ? 'P необходимо для Q; Q достаточно для P' : 'ни одно не следует из другого';
      verdict.textContent = 'P → Q: ' + (a ? '✔ верно для всех n ≤ 60' : '✘ контрпримеры: ' + cx1.slice(0, 8).join(', ') + (cx1.length > 8 ? '…' : '')) + '\nQ → P: ' + (b ? '✔ верно для всех n ≤ 60' : '✘ контрпримеры: ' + cx2.slice(0, 8).join(', ') + (cx2.length > 8 ? '…' : '')) + '\nИтог: ' + rel;
      st.set('pq', a ? 'верно' : 'нет (' + cx1.length + ')');
      st.set('qp', b ? 'верно' : 'нет (' + cx2.length + ')');
      st.set('rel', a && b ? 'равносильны' : a ? 'P ⇒ Q' : b ? 'Q ⇒ P' : 'независимы');
      note.innerHTML = '«Делится на 4» <b>достаточно</b> для чётности: все кратные 4 чётны. Но <b>не необходимо</b>: 2, 6, 10 чётны, хотя на 4 не делятся — это контрпримеры к обращению. Чётность <b>необходима</b> для делимости на 4: без неё делимости не бывает. Попробуйте «делится на 6» и «делится и на 2, и на 3» — условия равносильны, то есть одно необходимо и достаточно для другого («тогда и только тогда»). «Простое» и «нечётное» — ни одно не следует из другого: 2 простое, но чётное; 9 нечётное, но составное. Проверка до 60 — только пример: для «делится на 4 ⇒ чётно» нужно доказательство (оно в одну строку: 4k = 2·2k).';
    }
    w.pythonAction(() => 'def is_prime(n):\n    return n > 1 and all(n % d for d in range(2, int(n ** 0.5) + 1))\n\nP = lambda n: ' + NPRED[s.p].py + '   # ' + NPRED[s.p].t + '\nQ = lambda n: ' + NPRED[s.q].py + '   # ' + NPRED[s.q].t + '\nN = range(1, 61)\nprint("P → Q, контрпримеры:", [n for n in N if P(n) and not Q(n)])\nprint("Q → P, контрпримеры:", [n for n in N if Q(n) and not P(n)])\n');
    draw();
  });

  /* ==============================================================================
   * 5. Перевод с русского на язык логики
   * ============================================================================== */
  const TRANS = [
    { s: 'Модель переобучена, только если у неё много параметров.', A: 'модель переобучена', B: 'у модели много параметров', opts: ['A → B', 'B → A', 'A ∧ B', 'A ↔ B'], ans: 0, why: '«A, только если B»: без B не бывает A — значит, B необходимо для A: A → B. Частая ошибка — читать это как B → A.' },
    { s: 'Ошибка на обучении падает, если темп обучения мал.', A: 'ошибка падает', B: 'темп обучения мал', opts: ['A → B', 'B → A', 'A ↔ B', 'A ∨ B'], ans: 1, why: '«A, если B» — это «если B, то A». Условие стоит после «если», а не первым во фразе.' },
    { s: 'Для сходимости спуска необходимо, чтобы шаг был меньше 2/L.', A: 'спуск сходится', B: 'шаг меньше 2/L', opts: ['B → A', 'A → B', 'A ∧ B', '¬A → ¬B'], ans: 1, why: '«Для A необходимо B»: если A, то обязательно B, то есть A → B. «Достаточно» дало бы B → A.' },
    { s: 'Ни дождя, ни снега.', A: 'идёт дождь', B: 'идёт снег', opts: ['¬A ∨ ¬B', '¬A ∧ ¬B', '¬(A ∧ B)', '¬A → B'], ans: 1, why: '«Ни A, ни B» — оба отрицания одновременно: ¬A ∧ ¬B ≡ ¬(A ∨ B). ¬(A ∧ B) слабее: «не оба сразу».' },
    { s: 'Неверно, что признак и важен, и коррелирует с целью.', A: 'признак важен', B: 'признак коррелирует с целью', opts: ['¬A ∧ ¬B', '¬(A ∧ B)', '¬A ∧ B', 'A → B'], ans: 1, why: 'Отрицается вся конъюнкция: ¬(A ∧ B) ≡ ¬A ∨ ¬B (де Морган). Признак может быть важен без корреляции — и наоборот.' },
    { s: 'Либо модель недообучена, либо данные шумные, но не то и другое сразу.', A: 'модель недообучена', B: 'данные шумные', opts: ['A ∨ B', 'A ⊕ B', 'A ∧ B', 'A ↔ B'], ans: 1, why: '«Либо …, либо …, но не оба» — исключающее «или» ⊕. Обычное «или» (∨) допускает оба сразу.' },
    { s: 'Модель примут, если не найдут утечку.', A: 'модель примут', B: 'найдут утечку', opts: ['¬B → A', 'A ↔ ¬B', 'A → ¬B', '¬A → B'], ans: 0, why: 'Буквально: «если не B, то A», то есть ¬B → A ≡ A ∨ B. Фраза не обещает, что при найденной утечке модель отклонят — это уже A ↔ ¬B, более сильное утверждение, которое в разговоре часто подразумевают.' },
    { s: 'Модель принимается тогда и только тогда, когда AUC больше 0.8.', A: 'модель принимается', B: 'AUC > 0.8', opts: ['A → B', 'B → A', 'A ↔ B', 'A ∧ B'], ans: 2, why: '«Тогда и только тогда» — эквивалентность: и A → B, и B → A.' },
  ].map((t) => ({ ...t, asts: t.opts.map(P) }));
  GBC.widget('translator', (el) => {
    const s = { i: 0, pick: null };
    const w = ui.shell(el, { title: 'Перевод с русского на язык логики', sub: 'Выберите формулу для фразы. Если ответ неверен, таблица покажет ситуации, где ваша формула и фраза расходятся.' });
    ui.select(w.controls, { label: 'Фраза', value: 0, options: TRANS.map((t, i) => ({ value: i, label: (i + 1) + '. ' + t.s })), onChange: (v) => ((s.i = +v), (s.pick = null), draw()) });
    const sent = H('div', { style: 'font-size:1.06rem;font-weight:650;margin:2px 0 4px' });
    const legend = H('div', { style: 'font-size:.9rem;color:var(--ink-2);margin-bottom:8px' });
    const opts = flexRow('gap:8px;margin-bottom:8px');
    const tbl = H('div');
    const expl = H('div', { style: 'font-size:.92rem;margin-top:4px' });
    w.main.append(sent, legend, opts, tbl, expl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'ваш ответ' }, { key: 'd', label: 'строк расхождения' }]);
    function draw() {
      const T = TRANS[s.i];
      sent.textContent = '«' + T.s + '»';
      legend.textContent = 'A — ' + T.A + ';  B — ' + T.B + '.';
      opts.textContent = '';
      T.opts.forEach((o, k) => {
        const b = ui.button(opts, { label: o, kind: s.pick === null ? '' : k === T.ans ? 'primary' : '', onClick: () => ((s.pick = k), draw()) });
        b.style.fontFamily = 'var(--font-mono)';
        if (s.pick === k && k !== T.ans) (b.style.borderColor = 'var(--critical)'), (b.style.color = 'var(--critical-text)');
      });
      tbl.textContent = '';
      expl.textContent = '';
      if (s.pick === null) {
        st.set('r', '—');
        st.set('d', '—');
        note.innerHTML = 'Подсказки: «A, только если B» = A → B; «A, если B» = B → A; «для A необходимо B» = A → B; «для A достаточно B» = B → A; «ни A, ни B» = ¬A ∧ ¬B.';
        return;
      }
      const cmp = compare(T.asts[s.pick], T.asts[T.ans]);
      const E = envs(cmp.vars);
      const diff = cmp.oa.map((v, i) => v !== cmp.ob[i]);
      boolTable(tbl, [...cmp.vars, 'ваша: ' + T.opts[s.pick], 'фраза: ' + T.opts[T.ans]], E.map((e, i) => [...cmp.vars.map((v) => e[v]), cmp.oa[i], cmp.ob[i]]), { bad: (i) => diff[i], outCols: new Set([cmp.vars.length, cmp.vars.length + 1]), sepAfter: cmp.vars.length - 1 });
      const di = diff.indexOf(true);
      expl.appendChild(H('div', null, (s.pick === T.ans ? '✔ Верно. ' : '✘ Не совсем. ') + T.why));
      if (di >= 0) expl.appendChild(H('div', { style: 'margin-top:4px;color:var(--critical-text)' }, 'Например, когда ' + T.A + ' — ' + (E[di].A ? 'да' : 'нет') + ', а ' + T.B + ' — ' + (E[di].B ? 'да' : 'нет') + ': ваша формула даёт ' + cmp.oa[di] + ', а фраза — ' + cmp.ob[di] + '.'));
      st.set('r', s.pick === T.ans ? 'верно' : 'неверно');
      st.set('d', diff.filter(Boolean).length + ' из ' + diff.length);
      note.innerHTML = 'Естественный язык неоднозначен: «если» в речи часто означает «тогда и только тогда», «или» бывает и включающим, и исключающим. Логика заставляет выбрать один смысл. В требованиях к модели, в тестах и в коде эта точность экономит дни: «принимаем, если AUC > 0.8» и «принимаем тогда и только тогда, когда AUC > 0.8» — разные правила.';
    }
    w.pythonAction(() => {
      const T = TRANS[s.i];
      return PY_IT + '\n# ' + T.s + '\n# A — ' + T.A + '; B — ' + T.B + '\noptions = {\n' + T.opts.map((o, k) => '    "' + o + '": ' + pyLambda(T.asts[k], ['A', 'B']) + ',').join('\n') + '\n}\nfor name, f in options.items():\n    print(f"{name:8}", [int(f(A, B)) for A, B in product([False, True], repeat=2)])\n';
    });
    draw();
  });

  /* ==============================================================================
   * 6. Дерево формулы: приоритет связок и вычисление снизу вверх
   * ============================================================================== */
  const TREE_PRESETS = [
    { label: '★ A ∨ B ∧ C — что раньше?', value: 'A ∨ B ∧ C' },
    { label: '★ ¬A ∧ B — отрицание первым', value: '¬A ∧ B' },
    { label: '★★ ¬A → B ∨ C', value: '¬A → B ∨ C' },
    { label: '★★ A → B → C (справа налево)', value: 'A → B → C' },
    { label: '★★ (A → B) → C', value: '(A → B) → C' },
    { label: '★★★ ¬(A ∧ B) ↔ ¬A ∨ ¬B', value: '¬(A ∧ B) ↔ ¬A ∨ ¬B' },
    { label: '★★★ (A → B) ∧ (B → C) → (A → C)', value: '(A → B) ∧ (B → C) → (A → C)' },
  ];
  GBC.widget('formula-tree', (el) => {
    const s = { res: null, k: 0 };
    const w = ui.shell(el, { title: 'Дерево формулы: как читается и вычисляется формула', sub: 'Разборщик учитывает приоритет: ¬ сильнее ∧, ∧ сильнее ∨ и ⊕, затем →, затем ↔; цепочка импликаций читается справа налево. Значения считаются от листьев к корню. 1 — синим, 0 — серым.' });
    const fi = formulaInput(w.controls, { value: TREE_PRESETS[0].value, presets: TREE_PRESETS, onChange: (r) => ((s.res = r), tv.setVars(r.vars), (s.k = postorder(r.ast).length), pl && (pl.setMax(postorder(r.ast).length), pl.set(postorder(r.ast).length)), draw()) });
    const tv = varToggles(w.controls, () => draw());
    let pl = null;
    pl = ui.player(w.controls, { label: 'Вычисление по шагам', min: 0, max: 5, value: 5, fps: 1.4, format: (k, m) => 'шаг ' + k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const holder = H('div');
    const line = monoBox('text-align:center');
    w.main.append(holder, line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'full', label: 'со всеми скобками' }, { key: 'v', label: 'значение' }]);
    function draw() {
      if (!s.res) return;
      const ast = s.res.ast;
      const order = postorder(ast);
      const env = tv.env;
      const vals = new Map();
      order.slice(0, s.k).forEach((n) => vals.set(n, compile(n)(env)));
      const t = astTree(ast, vals);
      const cur = order[s.k - 1];
      (function mark(x) {
        if (x.node === cur) x.cur = true;
        x.kids.forEach(mark);
      })(t);
      holder.textContent = '';
      drawTree(holder, t, { dx: 58, dy: 60, minW: 300 });
      if (cur) {
        const v = vals.get(cur);
        const show = (n) => (vals.has(n) ? vals.get(n) : '?');
        line.textContent = cur.t === 'var' ? cur.name + ' = ' + v : cur.t === 'const' ? 'константа ' + v : cur.t === 'not' ? '¬' + show(cur.a) + ' = ' + v + '      (' + str(cur) + ')' : show(cur.a) + ' ' + OPS[cur.op].sym + ' ' + show(cur.b) + ' = ' + v + '      (' + str(cur) + ')';
      } else line.textContent = 'нажмите ▶ или двигайте ползунок';
      st.set('full', str(ast, true));
      st.set('v', s.k === order.length ? String(compile(ast)(env)) : '…');
      note.innerHTML = 'Корень дерева — <b>главная связка</b>: последнее действие при вычислении. В «A ∨ B ∧ C» корень — ∨, потому что ∧ связывает сильнее (как умножение сильнее сложения). «A → B → C» означает A → (B → C); сравните с «(A → B) → C» при A = 0, C = 0: первая формула истинна, вторая ложна. Если сомневаетесь в приоритете — ставьте скобки: они ничего не стоят, а ошибки в условиях стоят дорого.';
    }
    w.pythonAction(() => {
      const r = s.res;
      return '# ' + str(r.ast) + '\nf = ' + pyLambda(r.ast, r.vars) + '\n' + r.vars.map((v) => v + ' = ' + (tv.env[v] ? 'True' : 'False')).join('\n') + '\nprint(f(' + r.vars.join(', ') + '))\n\n# Python: not сильнее and, and сильнее or — как в логике. Но == и != сильнее not!\n';
    });
    fi.upd();
  });

  /* ==============================================================================
   * 7. Построитель таблиц истинности
   * ============================================================================== */
  const TT_PRESETS = [
    { label: '★ ¬A ∨ B', value: '¬A ∨ B' },
    { label: '★ A ∧ ¬A — противоречие', value: 'A ∧ ¬A' },
    { label: '★★ (A → B) ∧ (B → A)', value: '(A → B) ∧ (B → A)' },
    { label: '★★ (A ∨ B) ∧ ¬(A ∧ B)', value: '(A ∨ B) ∧ ¬(A ∧ B)' },
    { label: '★★ большинство из трёх', value: '(A ∧ B) ∨ (A ∧ C) ∨ (B ∧ C)' },
    { label: '★★★ ((A → B) → A) → A — закон Пирса', value: '((A → B) → A) → A' },
    { label: '★★★ 4 переменные: (A → B) ∧ (C → D) → (A ∨ C → B ∨ D)', value: '(A → B) ∧ (C → D) → (A ∨ C → B ∨ D)' },
  ];
  GBC.widget('truth-table-builder', (el) => {
    const s = { res: null, sub: true };
    const w = ui.shell(el, { title: 'Таблица истинности любой формулы', sub: 'Введите формулу — таблица переберёт все 2ⁿ наборов значений. Промежуточные столбцы — подформулы в порядке вычисления.' });
    const fi = formulaInput(w.controls, { value: TT_PRESETS[0].value, presets: TT_PRESETS, maxVars: 5, onChange: (r) => ((s.res = r), draw()) });
    ui.toggle(w.controls, { label: 'Промежуточные столбцы', checked: true, onChange: (v) => ((s.sub = v), draw()) });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'строк' }, { key: 'one', label: 'единиц' }, { key: 'k', label: 'тип формулы' }]);
    function draw() {
      if (!s.res) return;
      const { ast, vars } = s.res;
      const E = envs(vars);
      const subs = s.sub ? subformulas(ast) : [ast];
      const o = outs(ast, vars);
      tbl.textContent = '';
      boolTable(tbl, [...vars, ...subs.map((x) => str(x))], E.map((e) => [...vars.map((v) => e[v]), ...subs.map((x) => compile(x)(e))]), { good: (i) => o[i] === 1, outCols: new Set([vars.length + subs.length - 1]), sepAfter: vars.length - 1 });
      const k = kindOf(o);
      st.set('n', String(E.length) + ' = 2' + '⁰¹²³⁴⁵⁶⁷⁸⁹'[vars.length]);
      st.set('one', String(o.filter(Boolean).length));
      st.set('k', k);
      note.innerHTML = 'Формула от ' + vars.length + ' ' + plural(vars.length, 'переменной', 'переменных', 'переменных') + ' — это функция: каждой из ' + E.length + ' строк она сопоставляет 0 или 1. Строки упорядочены как двоичные числа: 000, 001, 010, … — так ни одна не потеряется. <b>Тавтология</b> истинна во всех строках (закон Пирса — неожиданный пример), <b>противоречие</b> ложно во всех, остальные формулы <b>выполнимы</b>: хоть одна строка даёт 1. Каждая новая переменная удваивает таблицу: 10 переменных — 1024 строки, 30 — миллиард. Поэтому для больших формул нужны законы и доказательства, а не перебор (шаг 39).';
    }
    w.pythonAction(() => {
      const { ast, vars } = s.res;
      return PY_IT + '\nf = ' + pyLambda(ast, vars) + '   # ' + str(ast) + '\nrows = list(product([False, True], repeat=' + vars.length + '))\nprint(' + JSON.stringify(vars.join(' ')) + ', "| f")\nfor r in rows:\n    print(*map(int, r), "|", int(f(*r)))\nvals = [f(*r) for r in rows]\nprint("тавтология" if all(vals) else "противоречие" if not any(vals) else "выполнима")\n';
    });
    fi.upd();
  });

  /* ==============================================================================
   * 8. Равносильность и следование
   * ============================================================================== */
  const EQ_PAIRS = [
    ['¬(A ∧ B)', '¬A ∨ ¬B', 'де Морган для ∧'],
    ['¬(A ∨ B)', '¬A ∧ ¬B', 'де Морган для ∨'],
    ['A → B', '¬A ∨ B', 'импликация через ∨'],
    ['A → B', '¬B → ¬A', 'контрапозиция'],
    ['A → B', 'B → A', 'обращение — ловушка'],
    ['A ∧ (B ∨ C)', '(A ∧ B) ∨ (A ∧ C)', 'дистрибутивность ∧ относительно ∨'],
    ['A ∨ (B ∧ C)', '(A ∨ B) ∧ (A ∨ C)', 'дистрибутивность ∨ относительно ∧'],
    ['A ∨ (A ∧ B)', 'A', 'поглощение'],
    ['A → (B → C)', 'A ∧ B → C', 'экспорт (импликация двух условий)'],
    ['(A → B) → C', 'A → (B → C)', 'скобки у импликации — ловушка'],
    ['A ⊕ B', '¬(A ↔ B)', 'XOR — отрицание эквивалентности'],
    ['A ∨ B → C', '(A → C) ∧ (B → C)', 'разбор случаев'],
    ['A ∧ B', 'A ∨ B', 'следование в одну сторону'],
  ];
  GBC.widget('equiv-checker', (el) => {
    const s = { a: null, b: null };
    const w = ui.shell(el, { title: 'Равносильны ли две формулы?', sub: 'F ≡ G, если их таблицы совпадают во всех строках. Если не совпадают, строка расхождения — контрпример. Отдельно проверяется следование F ⊨ G: G истинна везде, где истинна F.' });
    ui.select(w.controls, { label: 'Готовая пара', value: 0, options: EQ_PAIRS.map((p, i) => ({ value: i, label: p[2] })), onChange: (v) => (fa.set(EQ_PAIRS[+v][0]), fb.set(EQ_PAIRS[+v][1])) });
    const fa = formulaInput(w.controls, { label: 'Формула F', value: EQ_PAIRS[0][0], maxVars: 5, onChange: (r) => ((s.a = r), draw()) });
    const fb = formulaInput(w.controls, { label: 'Формула G', value: EQ_PAIRS[0][1], maxVars: 5, onChange: (r) => ((s.b = r), draw()) });
    const tbl = H('div');
    const verdict = H('div', { style: 'margin:4px 0;font-weight:650' });
    w.main.append(verdict, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'eq', label: 'F ≡ G' }, { key: 'ab', label: 'F ⊨ G' }, { key: 'ba', label: 'G ⊨ F' }]);
    function draw() {
      if (!s.a || !s.b) return;
      const c = compare(s.a.ast, s.b.ast);
      const E = envs(c.vars);
      const diff = c.oa.map((v, i) => v !== c.ob[i]);
      tbl.textContent = '';
      boolTable(tbl, [...c.vars, 'F = ' + str(s.a.ast), 'G = ' + str(s.b.ast)], E.map((e, i) => [...c.vars.map((v) => e[v]), c.oa[i], c.ob[i]]), { bad: (i) => diff[i], outCols: new Set([c.vars.length, c.vars.length + 1]), sepAfter: c.vars.length - 1 });
      const di = diff.indexOf(true);
      verdict.textContent = c.eq ? '✔ Равносильны: одна и та же функция, записанная по-разному.' : '✘ Не равносильны. Контрпример: ' + c.vars.map((v) => v + ' = ' + E[di][v]).join(', ') + ' — F = ' + c.oa[di] + ', G = ' + c.ob[di] + '.';
      verdict.style.color = c.eq ? 'var(--good-text)' : 'var(--critical-text)';
      st.set('eq', c.eq ? 'да' : 'нет');
      st.set('ab', c.aToB ? 'да' : 'нет');
      st.set('ba', c.bToA ? 'да' : 'нет');
      note.innerHTML = 'Равносильность = следование в обе стороны: F ≡ G тогда и только тогда, когда F ⊨ G и G ⊨ F. Пара «A ∧ B» и «A ∨ B» показывает следование в одну сторону: где истинно «и», там истинно и «или», но не наоборот. Равносильную формулу можно подставлять вместо исходной в любом месте — на этом стоят упрощения условий в коде и правил в деревьях. Ловушки «обращение» и «скобки у импликации» — самые частые ошибки рассуждений.';
    }
    w.pythonAction(() => {
      const vars = unionVars(s.a.ast, s.b.ast);
      return PY_IT + '\nF = ' + pyLambda(s.a.ast, vars) + '   # ' + str(s.a.ast) + '\nG = ' + pyLambda(s.b.ast, vars) + '   # ' + str(s.b.ast) + '\nrows = list(product([False, True], repeat=' + vars.length + '))\nprint("F ≡ G:", all(F(*r) == G(*r) for r in rows))\nprint("F ⊨ G:", all(G(*r) for r in rows if F(*r)))\nprint("контрпримеры:", [tuple(map(int, r)) for r in rows if F(*r) != G(*r)])\n';
    });
    fa.upd();
    fb.upd();
  });

  /* ==============================================================================
   * 9. Цепочки равносильных преобразований
   * ============================================================================== */
  const CHAINS = [
    { t: '★ Отрицание импликации', steps: [['¬(A → B)', ''], ['¬(¬A ∨ B)', 'импликация через ∨'], ['¬¬A ∧ ¬B', 'де Морган'], ['A ∧ ¬B', 'двойное отрицание']], moral: '«Неверно, что из A следует B» — это «A, но не B». Так отрицают любое правило: найти случай, где условие выполнено, а вывод — нет.' },
    { t: '★★ Склеивание', steps: [['(A ∧ B) ∨ (A ∧ ¬B)', ''], ['A ∧ (B ∨ ¬B)', 'дистрибутивность (вынесли A)'], ['A ∧ 1', 'исключённое третье'], ['A', 'нейтральный элемент']], moral: 'Два правила дерева, различающиеся только условием на B, склеиваются в одно: B не важно.' },
    { t: '★★ Поглощение', steps: [['A ∨ (A ∧ B)', ''], ['(A ∧ 1) ∨ (A ∧ B)', 'нейтральный элемент'], ['A ∧ (1 ∨ B)', 'дистрибутивность'], ['A ∧ 1', 'доминирование (1 ∨ B = 1)'], ['A', 'нейтральный элемент']], moral: 'Правило «A» уже покрывает все случаи «A и B»; второе слагаемое лишнее.' },
    { t: '★★ Разбор случаев', steps: [['(A → C) ∧ (B → C)', ''], ['(¬A ∨ C) ∧ (¬B ∨ C)', 'импликация через ∨'], ['(¬A ∧ ¬B) ∨ C', 'дистрибутивность ∨ относительно ∧'], ['¬(A ∨ B) ∨ C', 'де Морган'], ['A ∨ B → C', 'импликация через ∨']], moral: 'Чтобы доказать C из «A или B», достаточно вывести C из каждого случая отдельно.' },
    { t: '★★★ Экспорт: два условия', steps: [['A → (B → C)', ''], ['¬A ∨ (¬B ∨ C)', 'импликация через ∨ (дважды)'], ['(¬A ∨ ¬B) ∨ C', 'ассоциативность'], ['¬(A ∧ B) ∨ C', 'де Морган'], ['A ∧ B → C', 'импликация через ∨']], moral: '«Если A, то если B, то C» — то же, что «если A и B, то C». Вложенные if в коде можно объединять через and.' },
    { t: '★★★ Упрощение правил дерева', steps: [['(A ∧ ¬B) ∨ (A ∧ B ∧ C)', ''], ['A ∧ (¬B ∨ (B ∧ C))', 'дистрибутивность (вынесли A)'], ['A ∧ ((¬B ∨ B) ∧ (¬B ∨ C))', 'дистрибутивность ∨ относительно ∧'], ['A ∧ (1 ∧ (¬B ∨ C))', 'исключённое третье'], ['A ∧ (¬B ∨ C)', 'нейтральный элемент'], ['A ∧ (B → C)', 'импликация через ∨']], moral: 'A = «x > 5», B = «y > 2», C = «z = 1»: два листа «x > 5, y ≤ 2» и «x > 5, y > 2, z = 1» — одно правило «x > 5 и (если y > 2, то z = 1)».' },
  ].map((c) => ({ ...c, asts: c.steps.map(([f]) => P(f)) }));
  GBC.widget('law-stepper', (el) => {
    const s = { c: 0, k: 1 };
    const w = ui.shell(el, { title: 'Законы в действии: упрощение шаг за шагом', sub: 'Каждый переход — замена части формулы на равносильную по одному закону. Справа — проверка: таблица истинности нового шага совпадает с исходной.' });
    ui.select(w.controls, { label: 'Цепочка', value: 0, options: CHAINS.map((c, i) => ({ value: i, label: c.t })), onChange: (v) => ((s.c = +v), pl.setMax(CHAINS[s.c].steps.length), pl.set(1), (s.k = 1), draw()) });
    const pl = ui.player(w.controls, { label: 'Шаги', min: 1, max: CHAINS[0].steps.length, value: 1, fps: 0.9, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const list = H('div', { style: 'display:grid;gap:6px' });
    const moral = H('div', { style: 'margin-top:8px;font-size:.92rem' });
    w.main.append(list, moral);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'шаг' }, { key: 'law', label: 'закон' }, { key: 'ok', label: 'проверка таблицей' }]);
    function draw() {
      const C = CHAINS[s.c];
      list.textContent = '';
      C.steps.slice(0, s.k).forEach(([f, law], i) => {
        const okPrev = i === 0 || compare(C.asts[i - 1], C.asts[i]).eq;
        const row = H('div', { style: 'display:grid;grid-template-columns:2.2em minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid ' + (i === s.k - 1 ? C_TRUE : 'var(--border)') + ';border-radius:10px;padding:6px 10px;background:var(--surface)' });
        row.appendChild(H('span', { style: 'font-weight:700;color:var(--ink-2)' }, i === 0 ? '' : '≡'));
        const fx = H('div', { style: 'overflow-x:auto;overflow-y:hidden' });
        texInto(fx, tex(C.asts[i]));
        row.appendChild(fx);
        row.appendChild(i === 0 ? badge('исходная', '') : badge((okPrev ? '✔ ' : '✘ ') + law, okPrev ? 'good' : 'bad'));
        list.appendChild(row);
      });
      moral.textContent = s.k === C.steps.length ? 'Итог: ' + C.moral : '';
      const allOk = C.asts.slice(0, s.k).every((a) => compare(C.asts[0], a).eq);
      st.set('k', s.k + ' из ' + C.steps.length);
      st.set('law', s.k > 1 ? C.steps[s.k - 1][1] : '—');
      st.set('ok', allOk ? 'все шаги равносильны' : 'ошибка!');
      note.innerHTML = 'Таблица истинности проверяет равносильность «в лоб», но требует 2ⁿ строк. Законы дают короткий путь: каждая замена сохраняет таблицу, поэтому сохраняет её и вся цепочка. Это первый пример <b>доказательства</b> — последовательности шагов, каждый из которых обоснован правилом (шаг 29).';
    }
    w.pythonAction(() => {
      const C = CHAINS[s.c];
      const vars = unionVars(...C.asts);
      return PY_IT + '\nsteps = [\n' + C.steps.map(([f, law], i) => '    ("' + f + '", ' + pyLambda(C.asts[i], vars) + '),' + (law ? '   # ' + law : '')).join('\n') + '\n]\nrows = list(product([False, True], repeat=' + vars.length + '))\nfor (a, fa), (b, fb) in zip(steps, steps[1:]):\n    print(f"{a}  ≡  {b}:", all(fa(*r) == fb(*r) for r in rows))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 10. Правильные и ошибочные рассуждения
   * ============================================================================== */
  const ARGS = [
    { t: '★ Modus ponens', prem: ['A → B', 'A'], concl: 'B', words: 'Если признак пропущен (A), модель берёт значение по умолчанию (B). Признак пропущен. ⇒ Взято значение по умолчанию.' },
    { t: '★ Modus tollens', prem: ['A → B', '¬B'], concl: '¬A', words: 'Если модель переобучена (A), разрыв train/valid велик (B). Разрыв мал. ⇒ Модель не переобучена.' },
    { t: '★★ Цепочка (силлогизм)', prem: ['A → B', 'B → C'], concl: 'A → C', words: 'Утечка (A) ⇒ слишком высокий AUC (B); слишком высокий AUC (B) ⇒ проверка данных (C). ⇒ Утечка ⇒ проверка данных.' },
    { t: '★★ Дизъюнктивный силлогизм', prem: ['A ∨ B', '¬A'], concl: 'B', words: 'Ошибка либо в данных (A), либо в коде (B). В данных ошибки нет. ⇒ Ошибка в коде.' },
    { t: '★★ Разбор случаев', prem: ['A ∨ B', 'A → C', 'B → C'], concl: 'C', words: 'Признак числовой (A) или категориальный (B); в обоих случаях дерево умеет его делить (C). ⇒ Дерево умеет его делить.' },
    { t: '✘ Утверждение следствия', prem: ['A → B', 'B'], concl: 'A', words: 'Если модель переобучена (A), разрыв train/valid велик (B). Разрыв велик. ⇒ Модель переобучена? Нет: разрыв бывает и из-за сдвига данных.' },
    { t: '✘ Отрицание основания', prem: ['A → B', '¬A'], concl: '¬B', words: 'Если есть утечка (A), AUC завышен (B). Утечки нет. ⇒ AUC не завышен? Нет: завысить AUC можно и иначе — например, подбором порога на тесте.' },
    { t: '✘ Обращение кванторов в речи', prem: ['A → B'], concl: 'B → A', words: 'Все спам-письма со ссылками. ⇒ Все письма со ссылками — спам? Нет.' },
    { t: '★★★ Из противоречия — что угодно', prem: ['A', '¬A'], concl: 'C', words: 'Если посылки противоречат друг другу, строк, где все они истинны, нет — и следование выполнено для любого вывода. Поэтому одно противоречие в требованиях «доказывает» всё что угодно.' },
  ].map((a) => ({ ...a, pa: a.prem.map(P), ca: P(a.concl) }));
  GBC.widget('argument-checker', (el) => {
    const s = { i: 0 };
    const w = ui.shell(el, { title: 'Правильно ли рассуждение?', sub: 'Вывод следует из посылок (посылки ⊨ вывод), если он истинен в каждой строке, где истинны все посылки. Строка «все посылки 1, вывод 0» — контрпример: рассуждение ошибочно.' });
    ui.select(w.controls, { label: 'Рассуждение', value: 0, options: ARGS.map((a, i) => ({ value: i, label: a.t })), onChange: (v) => ((s.i = +v), draw()) });
    const words = H('div', { style: 'font-size:.95rem;margin:2px 0 6px' });
    const form = H('div', { style: 'margin-bottom:6px' });
    const tbl = H('div');
    w.main.append(words, form, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'рассуждение' }, { key: 'n', label: 'строк, где посылки истинны' }, { key: 'cx', label: 'контрпримеров' }]);
    function draw() {
      const A = ARGS[s.i];
      const vars = unionVars(...A.pa, A.ca);
      const E = envs(vars);
      const pv = A.pa.map((p) => outs(p, vars));
      const cv = outs(A.ca, vars);
      const all = E.map((e, i) => pv.every((col) => col[i]));
      const bad = all.map((x, i) => x && !cv[i]);
      words.textContent = A.words;
      form.textContent = '';
      texInto(form, A.pa.map(tex).join(',\\;\\; ') + '\\;\\;\\models\\;\\; ' + tex(A.ca) + (bad.some(Boolean) ? '\\;?' : ''), false);
      tbl.textContent = '';
      boolTable(tbl, [...vars, ...A.prem.map((p, k) => 'посылка ' + (k + 1) + ': ' + p), 'вывод: ' + A.concl], E.map((e, i) => [...vars.map((v) => e[v]), ...pv.map((col) => col[i]), cv[i]]), { bad: (i) => bad[i], good: (i) => all[i] && !bad[i], outCols: new Set([vars.length + A.pa.length]), sepAfter: vars.length - 1 });
      const nb = bad.filter(Boolean).length;
      st.set('v', nb ? 'ошибочно' : 'правильно');
      st.set('n', String(all.filter(Boolean).length));
      st.set('cx', String(nb));
      note.innerHTML = 'Синие строки — где все посылки истинны и вывод тоже; красные — контрпримеры. Правильность рассуждения зависит только от <b>формы</b>, а не от смысла слов: «утверждение следствия» ошибочно и про спам, и про переобучение, и про погоду. Правильные формы (modus ponens, modus tollens, цепочка, разбор случаев) — «кирпичи» доказательств. Последний пример объясняет, почему противоречивые требования к системе опасны: из них формально следует всё.';
    }
    w.pythonAction(() => {
      const A = ARGS[s.i];
      const vars = unionVars(...A.pa, A.ca);
      return PY_IT + '\npremises = [' + A.pa.map((p) => pyLambda(p, vars)).join(', ') + ']\nconclusion = ' + pyLambda(A.ca, vars) + '\nrows = list(product([False, True], repeat=' + vars.length + '))\ncounter = [r for r in rows if all(p(*r) for p in premises) and not conclusion(*r)]\nprint("правильно" if not counter else "ошибочно, контрпримеры:", [tuple(map(int, r)) for r in counter])\n';
    });
    draw();
  });

  /* ==============================================================================
   * 11. Карточки Уэйсона
   * ============================================================================== */
  const WASON = [
    { t: 'Буквы и числа', rule: 'Если на одной стороне карточки гласная, то на другой — чётное число.', cards: ['A', 'K', '4', '7'], ans: [0, 3], P: 'гласная', Q: 'чётное', why: ['A: гласная — если на обороте нечётное, правило нарушено. Нужно проверить.', 'K: согласная — правило ничего не говорит о согласных (условие ложно).', '4: чётное — на обороте может быть что угодно: «если гласная, то чётное» не запрещает согласную с чётным (это ошибка обращения).', '7: нечётное — если на обороте гласная, правило нарушено. Нужно проверить (контрапозиция: нечётное ⇒ согласная).'] },
    { t: 'Кафе: возраст и напитки', rule: 'Если человек пьёт пиво, то ему не меньше 18 лет.', cards: ['пиво', 'сок', '25 лет', '16 лет'], ans: [0, 3], P: 'пьёт пиво', Q: 'не меньше 18', why: ['Пиво: нужно узнать возраст.', 'Сок: правило про сок ничего не говорит.', '25 лет: взрослому можно пить что угодно.', '16 лет: нужно проверить, не пиво ли у него в стакане.'] },
    { t: 'Журнал прогнозов', rule: 'Если модель сказала «спам», то письмо действительно спам.', cards: ['прогноз: спам', 'прогноз: не спам', 'на деле: спам', 'на деле: не спам'], ans: [0, 3], P: 'прогноз «спам»', Q: 'на деле спам', why: ['Прогноз «спам»: проверить истинную метку — это может быть ложное срабатывание (FP).', 'Прогноз «не спам»: правило о таких прогнозах молчит.', 'На деле спам: прогноз мог быть любым — пропуск спама правило не нарушает (это уже полнота, а не точность).', 'На деле не спам: проверить прогноз — если он «спам», это ложное срабатывание.'] },
  ];
  GBC.widget('wason', (el) => {
    const s = { v: 0, sel: new Set(), done: false };
    const w = ui.shell(el, { title: 'Карточки Уэйсона: какие карточки перевернуть?', sub: 'У каждой карточки две стороны. Выберите все карточки, которые обязательно нужно перевернуть, чтобы проверить правило, — и только их.' });
    ui.segmented(w.controls, { label: 'Версия', value: 0, options: WASON.map((x, i) => ({ value: i, label: x.t })), onChange: (v) => ((s.v = v), s.sel.clear(), (s.done = false), draw()) });
    ui.button(w.controls, { label: 'Проверить', icon: 'check', onClick: () => ((s.done = true), draw()) });
    ui.button(w.controls, { label: 'Заново', icon: 'reset', onClick: () => (s.sel.clear(), (s.done = false), draw()) });
    const rule = H('div', { style: 'font-weight:650;font-size:1.02rem;margin:2px 0 10px' });
    const row = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(130px,100%),1fr));gap:10px' });
    const expl = H('div', { style: 'margin-top:10px;font-size:.92rem' });
    w.main.append(rule, row, expl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sel', label: 'выбрано' }, { key: 'r', label: 'результат' }]);
    function draw() {
      const V = WASON[s.v];
      rule.textContent = 'Правило: «' + V.rule + '»';
      row.textContent = '';
      V.cards.forEach((c, k) => {
        const on = s.sel.has(k);
        const need = V.ans.includes(k);
        const b = H('button', { type: 'button', style: 'height:110px;border-radius:12px;font-size:1.15rem;font-weight:750;cursor:pointer;border:2px solid ' + (s.done ? (need ? 'var(--good)' : on ? 'var(--critical)' : 'var(--border-strong)') : on ? C_TRUE : 'var(--border-strong)') + ';background:' + (on ? tint(C_TRUE, 22) : 'var(--surface-2)') + ';color:var(--ink)' }, c);
        b.addEventListener('click', () => {
          if (s.done) return;
          on ? s.sel.delete(k) : s.sel.add(k);
          draw();
        });
        row.appendChild(b);
      });
      expl.textContent = '';
      const right = s.sel.size === V.ans.length && V.ans.every((k) => s.sel.has(k));
      if (s.done) V.why.forEach((t, k) => expl.appendChild(H('div', { style: 'margin:3px 0;color:' + (V.ans.includes(k) ? 'var(--ink)' : 'var(--ink-2)') }, (V.ans.includes(k) ? '● ' : '○ ') + t)));
      st.set('sel', s.sel.size ? [...s.sel].sort().map((k) => V.cards[k]).join(', ') : '—');
      st.set('r', s.done ? (right ? '✔ верно' : '✘ нужно: ' + V.ans.map((k) => V.cards[k]).join(' и ')) : '—');
      note.innerHTML = 'Правило — импликация P → Q («' + V.P + '» → «' + V.Q + '»). Нарушить его может только карточка, где P истинно, а Q ложно. Поэтому переворачивают карточку с <b>P</b> (вдруг на обороте не Q) и карточку с <b>¬Q</b> (вдруг на обороте P — это контрапозиция). Карточка с Q соблазнительна, но её проверка — это проверка обращения Q → P. В классическом абстрактном опыте Уэйсона (1966) правильно отвечает лишь около одного человека из десяти, а версию про возраст и напитки решают почти все — хотя логически задачи одинаковы. В ML это та же разница, что между проверкой точности (смотрим все срабатывания) и полноты (смотрим все положительные объекты).';
    }
    draw();
  });

  /* ==============================================================================
   * 12. Рыцари и лжецы
   * ============================================================================== */
  const KNIGHTS = [
    { t: '★ «Хотя бы один из нас лжец»', people: ['A'], vars: ['A', 'B'], says: { A: '¬A ∨ ¬B' }, words: { A: '«Хотя бы один из нас лжец»' } },
    { t: '★ «Мы оба лжецы»', people: ['A'], vars: ['A', 'B'], says: { A: '¬A ∧ ¬B' }, words: { A: '«Мы оба лжецы»' } },
    { t: '★★ «Одного типа» / «разного типа»', people: ['A', 'B'], vars: ['A', 'B'], says: { A: 'A ↔ B', B: '¬(A ↔ B)' }, words: { A: '«Мы одного типа»', B: '«Мы разного типа»' } },
    { t: '★★ Если я рыцарь…', people: ['A'], vars: ['A', 'B'], says: { A: 'A → B' }, words: { A: '«Если я рыцарь, то и B рыцарь»' } },
    { t: '★★ Трое', people: ['A', 'B', 'C'], vars: ['A', 'B', 'C'], says: { A: '¬B', B: '¬C', C: '¬A ∧ ¬B' }, words: { A: '«B — лжец»', B: '«C — лжец»', C: '«A и B — оба лжецы»' } },
    { t: '★★★ «Я рыцарь» — неопределённость', people: ['A'], vars: ['A'], says: { A: 'A' }, words: { A: '«Я рыцарь»' } },
    { t: '★★★ «Я лжец» — парадокс', people: ['A'], vars: ['A'], says: { A: '¬A' }, words: { A: '«Я лжец»' } },
  ].map((k) => ({ ...k, sa: Object.fromEntries(Object.entries(k.says).map(([p, f]) => [p, P(f)])) }));
  GBC.widget('knights', (el) => {
    const s = { i: 0 };
    const w = ui.shell(el, { title: 'Рыцари и лжецы: решаем перебором миров', sub: 'Рыцари всегда говорят правду, лжецы всегда лгут. Переменная A = 1 означает «A — рыцарь». Каждое высказывание X даёт условие X ↔ (то, что сказал X). Решения — строки, где выполнены все условия.' });
    ui.select(w.controls, { label: 'Задача', value: 0, options: KNIGHTS.map((k, i) => ({ value: i, label: k.t })), onChange: (v) => ((s.i = +v), draw()) });
    const said = H('div', { style: 'margin:2px 0 8px' });
    const tbl = H('div');
    const ans = H('div', { style: 'font-weight:650;margin-top:6px' });
    w.main.append(said, tbl, ans);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'миров' }, { key: 'sol', label: 'решений' }]);
    function draw() {
      const K = KNIGHTS[s.i];
      said.textContent = '';
      K.people.forEach((p) => said.appendChild(H('div', { style: 'margin:2px 0' }, p + ' говорит: ' + K.words[p] + '   ⇒   условие ' + p + ' ↔ (' + K.says[p] + ')')));
      const E = envs(K.vars);
      const ok = E.map((e) => K.people.map((p) => (e[p] === compile(K.sa[p])(e) ? 1 : 0)));
      const sol = ok.map((r) => r.every(Boolean));
      tbl.textContent = '';
      boolTable(tbl, [...K.vars, ...K.people.map((p) => 'сказанное ' + p), ...K.people.map((p) => p + ' ↔ сказанное'), 'мир возможен'], E.map((e, i) => [...K.vars.map((v) => e[v]), ...K.people.map((p) => compile(K.sa[p])(e)), ...ok[i], sol[i] ? 1 : 0]), { good: (i) => sol[i], outCols: new Set([K.vars.length + 2 * K.people.length]), sepAfter: K.vars.length - 1 });
      const S0 = E.filter((e, i) => sol[i]);
      const desc = (e) => K.vars.map((v) => v + ' — ' + (e[v] ? 'рыцарь' : 'лжец')).join(', ');
      ans.textContent = S0.length === 0 ? '✘ Решений нет: ни в одном мире высказывание не согласовано — это парадокс.' : S0.length === 1 ? '✔ Единственное решение: ' + desc(S0[0]) + '.' : 'Решений ' + S0.length + ': ' + S0.map(desc).join('; ') + ' — задача не определяет ответ' + (K.vars.length > K.people.length ? ' полностью' : '') + '.';
      st.set('n', String(E.length));
      st.set('sol', String(S0.length));
      note.innerHTML = 'Перебор миров — надёжный и механический способ: формула всей задачи — конъюнкция условий «X ↔ сказанное X», а решения — строки, где она истинна. В «Хотя бы один из нас лжец» лжец такого сказать не может (это было бы правдой), значит, A — рыцарь, а тогда B — лжец. «Я рыцарь» может сказать любой — решений два; «Я лжец» не может сказать никто — решений нет. Так же работают SAT-решатели (шаг 39), только перебирают миры гораздо умнее.';
    }
    w.pythonAction(() => {
      const K = KNIGHTS[s.i];
      return PY_IT + '\n# A = True означает «A — рыцарь»\nsays = {\n' + K.people.map((p) => '    "' + p + '": ' + pyLambda(K.sa[p], K.vars) + ',   # ' + K.words[p]).join('\n') + '\n}\nnames = ' + JSON.stringify(K.vars) + '\nfor world in product([False, True], repeat=' + K.vars.length + '):\n    env = dict(zip(names, world))\n    if all(env[p] == f(*world) for p, f in says.items()):\n        print({k: "рыцарь" if v else "лжец" for k, v in env.items()})\n';
    });
    draw();
  });

  GBC.lesson1519 = {
    f2, f3, grp, pct, plural, nWord, NB,
    SER, cvar, tint, C_TRUE, C_FALSE, flexRow, texInto, texEl, texSpan, card, cardGrid, badge, rowTable, scrollBox, monoBox, svgBox, sText, legendRow, boolTable,
    OPS, parse, P, str, tex, py, compile, envs, outs, subformulas, kindOf, unionVars, compare, sdnf, scnf, popcount, minDNF, implText, dnfText, postClasses, minTree, greedyTree,
    formulaInput, varToggles, PY_IT, pyLambda, drawTree, astTree, postorder, boolTreeDraw, isPrime,
  };
})();
