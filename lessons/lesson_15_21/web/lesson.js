/* Урок 15.21: теория игр. Часть 1 — язык игр, рассуждения о соперниках, смешанные стратегии.
 * Ядро (GBC.lesson1521): наилучшие ответы, доминирование, последовательное удаление доминируемых стратегий,
 * чистые и смешанные равновесия, перебор носителей, игры с нулевой суммой (симплекс-метод), линейные системы,
 * дроби, платёжные таблицы, редактор матриц, стрелки SVG.
 * Виджеты: стрелки отклонений (интуиция); редактор игры; доминирование; удаление доминируемых и пляж
 * Хотеллинга; «угадай 2/3 среднего»; поиск равновесий и случайные игры; плоскость T–S; парадокс Браеса и цена
 * анархии; дуополия Курно; пенальти; принцип безразличия; кривые наилучших ответов; коррелированное
 * равновесие; перебор носителей; отображение Нэша.
 * Общие помощники выставлены в GBC.lesson1521 — ими пользуются lesson_extra.js и lesson_ml.js. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const pct = (p, d = 1) => (Number.isFinite(p) ? U.fmt(100 * p, d) + ' %' : '—');
  const minus = (s) => String(s).replace(/-/g, '−');
  const P1 = 'var(--c-blue)';
  const P2 = 'var(--c-orange)';
  const EPS = 1e-9;
  /** Число как дробь p/q (знаменатель ≤ maxDen), иначе десятичная запись. */
  function frac(x, maxDen = 64) {
    if (!Number.isFinite(x)) return '—';
    if (Math.abs(x - Math.round(x)) < 1e-9) return minus(String(Math.round(x)));
    for (let d = 2; d <= maxDen; d++) {
      const n = Math.round(x * d);
      if (Math.abs(x - n / d) < 1e-9) return (n < 0 ? '−' : '') + Math.abs(n) + '/' + d;
    }
    return U.fmt(x, 3);
  }
  const pyNum = (x) => U.pyNum(x);
  const pyVec = (v) => '[' + v.map(pyNum).join(', ') + ']';
  const pyMat = (M) => '[' + M.map(pyVec).join(', ') + ']';
  const pyStr = (s) => JSON.stringify(s);
  const vecStr = (v, d = 2) => '(' + v.map((x) => U.fmt(x, d)).join('; ') + ')';
  const fracVec = (v) => '(' + v.map((x) => frac(x)).join('; ') + ')';

  /* ==============================================================================
   * Оформление
   * ============================================================================== */
  const SER = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];
  const cvar = (i) => 'var(--c-' + SER[((i % SER.length) + SER.length) % SER.length] + ')';
  const tint = (c, p = 22) => 'color-mix(in srgb, ' + c + ' ' + p + '%, var(--surface))';
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
  function chip(text, kind, c = 'var(--c-blue)') {
    const st = kind === 'on' ? 'background:' + tint(c, 30) + ';border-color:' + c + ';color:var(--ink);font-weight:700' : kind === 'dim' ? 'opacity:.4' : '';
    return H('span', { style: 'display:inline-block;min-width:26px;text-align:center;padding:2px 7px;border:1.5px solid var(--border-strong);border-radius:8px;font-family:var(--font-mono);font-size:.86rem;background:var(--surface);' + st }, text);
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
  /** Стрелка в SVG; o: {width, head, dash, noHead}. */
  function svgArrow(g, x1, y1, x2, y2, color, o = {}) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / len;
    const uy = (y2 - y1) / len;
    const hs = o.head ?? 11;
    const ex = o.noHead ? x2 : x2 - ux * hs * 0.8;
    const ey = o.noHead ? y2 : y2 - uy * hs * 0.8;
    g.appendChild(S('line', { x1, y1, x2: ex, y2: ey, style: 'stroke:' + color + ';stroke-width:' + (o.width || 3) + ';stroke-linecap:round' + (o.dash ? ';stroke-dasharray:' + o.dash : '') }));
    if (!o.noHead) g.appendChild(S('path', { d: 'M' + x2 + ',' + y2 + 'L' + (x2 - ux * hs - uy * hs * 0.55) + ',' + (y2 - uy * hs + ux * hs * 0.55) + 'L' + (x2 - ux * hs + uy * hs * 0.55) + ',' + (y2 - uy * hs - ux * hs * 0.55) + 'Z', style: 'fill:' + color }));
  }
  function legendRow(items) {
    const row = flexRow('gap:14px;font-size:.86rem;color:var(--ink-2);margin:2px 0 6px');
    items.forEach(([c, t, kind]) => {
      const key = kind === 'line' ? H('span', { style: 'width:18px;height:0;border-top:3px solid ' + c + ';display:inline-block' }) : H('span', { style: 'width:12px;height:12px;border-radius:3px;display:inline-block;background:' + tint(c, 45) + ';border:2px solid ' + c });
      row.appendChild(H('span', { style: 'display:inline-flex;align-items:center;gap:6px' }, key, t));
    });
    return row;
  }
  /** Поле для числа. o: {label, value, onChange(v), help, min, max, step} */
  function numField(parent, o) {
    const inp = H('input', { class: 'input', type: 'text', inputmode: 'decimal', spellcheck: 'false', autocomplete: 'off', 'aria-label': o.label, value: String(o.value), style: 'font-family:var(--font-mono)' });
    const msg = H('div', { class: 'ctl-help', style: 'min-height:1em' }, o.help || '');
    const el = H('div', { class: 'ctl' }, H('label', { class: 'ctl-label' }, o.label), inp, msg);
    const apply = () => {
      const v = parseFloat(inp.value.replace(',', '.').replace('−', '-'));
      if (!Number.isFinite(v)) {
        msg.textContent = 'Введите число';
        return;
      }
      msg.textContent = o.help || '';
      o.onChange(v);
    };
    inp.addEventListener('change', apply);
    inp.addEventListener('keydown', (e) => e.key === 'Enter' && apply());
    parent.appendChild(el);
    return { el, inp, set: (v) => (inp.value = String(v)) };
  }

  /* ==============================================================================
   * Ядро: биматричные игры
   * ============================================================================== */
  const transpose = (M) => M[0].map((_, j) => M.map((r) => r[j]));
  const neg = (M) => M.map((r) => r.map((v) => -v));
  const clone = (M) => M.map((r) => r.slice());
  function matVec(M, y) {
    return M.map((r) => {
      let s = 0;
      for (let j = 0; j < r.length; j++) s += r[j] * y[j];
      return s;
    });
  }
  function vecMat(x, M) {
    const out = new Array(M[0].length).fill(0);
    for (let i = 0; i < M.length; i++) for (let j = 0; j < M[0].length; j++) out[j] += x[i] * M[i][j];
    return out;
  }
  const dot = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  };
  const expPay = (M, x, y) => dot(x, matVec(M, y));
  const pay2 = (M, p, q) => p * q * M[0][0] + p * (1 - q) * M[0][1] + (1 - p) * q * M[1][0] + (1 - p) * (1 - q) * M[1][1];
  function softmax(L) {
    const m = Math.max(...L);
    const e = L.map((v) => Math.exp(v - m));
    let z = 0;
    for (const v of e) z += v;
    return e.map((v) => v / z);
  }
  /** Наилучшие ответы игрока 1 (строки) на столбец j среди строк rows. */
  function brRows(A, j, rows = U.range(A.length)) {
    let best = -Infinity;
    for (const i of rows) best = Math.max(best, A[i][j]);
    return rows.filter((i) => A[i][j] >= best - EPS);
  }
  function brCols(B, i, cols = U.range(B[0].length)) {
    let best = -Infinity;
    for (const j of cols) best = Math.max(best, B[i][j]);
    return cols.filter((j) => B[i][j] >= best - EPS);
  }
  function pureNE(A, B, rows = U.range(A.length), cols = U.range(A[0].length)) {
    const out = [];
    for (const i of rows) for (const j of cols) if (brRows(A, j, rows).includes(i) && brCols(B, i, cols).includes(j)) out.push([i, j]);
    return out;
  }
  /** Доминирует ли вектор va над vb: 'strict' | 'weak' | null. */
  function dom(va, vb) {
    let ge = true;
    let gt = true;
    let any = false;
    for (let k = 0; k < va.length; k++) {
      if (va[k] < vb[k] - EPS) ge = false;
      if (!(va[k] > vb[k] + EPS)) gt = false;
      else any = true;
    }
    return gt ? 'strict' : ge && any ? 'weak' : null;
  }
  /** Последовательное удаление доминируемых стратегий (по одной, сначала игрок 1). */
  function iesds(A, B, weak = false) {
    let rows = U.range(A.length);
    let cols = U.range(A[0].length);
    const steps = [];
    for (let guard = 0; guard < 100; guard++) {
      let found = null;
      for (const r of rows) {
        for (const r2 of rows) {
          if (r2 === r) continue;
          const d = dom(cols.map((j) => A[r2][j]), cols.map((j) => A[r][j]));
          if (d === 'strict' || (weak && d === 'weak')) {
            found = { pl: 0, k: r, by: r2, kind: d };
            break;
          }
        }
        if (found) break;
      }
      if (!found)
        for (const c of cols) {
          for (const c2 of cols) {
            if (c2 === c) continue;
            const d = dom(rows.map((i) => B[i][c2]), rows.map((i) => B[i][c]));
            if (d === 'strict' || (weak && d === 'weak')) {
              found = { pl: 1, k: c, by: c2, kind: d };
              break;
            }
          }
          if (found) break;
        }
      if (!found) break;
      found.rows = rows.slice();
      found.cols = cols.slice();
      steps.push(found);
      if (found.pl === 0) rows = rows.filter((x) => x !== found.k);
      else cols = cols.filter((x) => x !== found.k);
    }
    return { steps, rows, cols };
  }
  /** Внутреннее смешанное равновесие игры 2×2: {p, q, u1, u2} или null. p, q — вероятности первой строки/столбца. */
  function mixed2(A, B) {
    const dp = B[0][0] - B[1][0] - B[0][1] + B[1][1];
    const dq = A[0][0] - A[0][1] - A[1][0] + A[1][1];
    if (Math.abs(dp) < EPS || Math.abs(dq) < EPS) return null;
    const p = (B[1][1] - B[1][0]) / dp;
    const q = (A[1][1] - A[0][1]) / dq;
    if (p <= EPS || p >= 1 - EPS || q <= EPS || q >= 1 - EPS) return null;
    return { p, q, u1: pay2(A, p, q), u2: pay2(B, p, q) };
  }
  /** Все равновесия 2×2: чистые как (p, q) ∈ {0, 1}² и внутреннее смешанное. */
  function allNE2(A, B) {
    const out = pureNE(A, B).map(([i, j]) => ({ p: i === 0 ? 1 : 0, q: j === 0 ? 1 : 0, pure: true }));
    const mx = mixed2(A, B);
    if (mx) out.push({ p: mx.p, q: mx.q, pure: false });
    return out;
  }
  /** Решение линейной системы (метод Гаусса с выбором главного элемента); null — если система вырождена. */
  function solveLin(M0, b0) {
    const n = b0.length;
    const M = M0.map((r, i) => [...r, b0[i]]);
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-12) return null;
      [M[c], M[piv]] = [M[piv], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const k = M[r][c] / M[c][c];
        if (k) for (let t = c; t <= n; t++) M[r][t] -= k * M[c][t];
      }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  function subsets(n, k) {
    const out = [];
    const rec = (s, cur) => {
      if (cur.length === k) return void out.push(cur.slice());
      for (let i = s; i < n; i++) {
        cur.push(i);
        rec(i + 1, cur);
        cur.pop();
      }
    };
    rec(0, []);
    return out;
  }
  /** Перебор носителей одинакового размера: для каждой пары (I, J) — решение и проверка. */
  function supportEnum(A, B, names1, names2) {
    const m = A.length;
    const n = A[0].length;
    const out = [];
    for (let k = 1; k <= Math.min(m, n); k++)
      for (const I of subsets(m, k))
        for (const J of subsets(n, k)) {
          const Mq = I.map((i) => [...J.map((j) => A[i][j]), -1]);
          Mq.push([...J.map(() => 1), 0]);
          const sq = solveLin(Mq, [...I.map(() => 0), 1]);
          const Mp = J.map((j) => [...I.map((i) => B[i][j]), -1]);
          Mp.push([...I.map(() => 1), 0]);
          const sp = solveLin(Mp, [...J.map(() => 0), 1]);
          const row = { I, J, ok: false, reason: '' };
          if (!sq || !sp) {
            row.reason = 'система вырождена';
            out.push(row);
            continue;
          }
          const q = new Array(n).fill(0);
          J.forEach((j, t) => (q[j] = sq[t]));
          const p = new Array(m).fill(0);
          I.forEach((i, t) => (p[i] = sp[t]));
          Object.assign(row, { p, q, u: sq[k], w: sp[k] });
          if (Math.min(...J.map((j) => q[j])) < -EPS) row.reason = 'у игрока 2 отрицательная вероятность';
          else if (Math.min(...I.map((i) => p[i])) < -EPS) row.reason = 'у игрока 1 отрицательная вероятность';
          else {
            const Aq = matVec(A, q);
            const pB = vecMat(p, B);
            const i2 = U.range(m).find((i) => !I.includes(i) && Aq[i] > row.u + 1e-9);
            const j2 = U.range(n).find((j) => !J.includes(j) && pB[j] > row.w + 1e-9);
            if (i2 !== undefined) row.reason = 'игроку 1 выгоднее «' + names1[i2] + '»';
            else if (j2 !== undefined) row.reason = 'игроку 2 выгоднее «' + names2[j2] + '»';
            else row.ok = true;
          }
          out.push(row);
        }
    return out;
  }
  /**
   * Игра с нулевой суммой (M — выигрыш строк) симплекс-методом с правилом Бланда.
   * Столбцы: max Σy при (M + c)y ≤ 1, y ≥ 0; строки — двойственные переменные. Возвращает {p, q, v, pivots}.
   */
  function zeroSum(M) {
    const m = M.length;
    const n = M[0].length;
    let mn = Infinity;
    for (const r of M) for (const v of r) mn = Math.min(mn, v);
    const shift = 1 - mn;
    const W = n + m + 1;
    const T = M.map((r, i) => {
      const row = new Array(W).fill(0);
      for (let j = 0; j < n; j++) row[j] = r[j] + shift;
      row[n + i] = 1;
      row[W - 1] = 1;
      return row;
    });
    const z = new Array(W).fill(0);
    for (let j = 0; j < n; j++) z[j] = -1;
    const basis = U.range(m, n);
    let pivots = 0;
    for (let guard = 0; guard < 500; guard++) {
      let e = -1;
      for (let j = 0; j < W - 1; j++)
        if (z[j] < -1e-12) {
          e = j;
          break;
        }
      if (e < 0) break;
      let r = -1;
      let best = Infinity;
      for (let i = 0; i < m; i++)
        if (T[i][e] > 1e-12) {
          const ratio = T[i][W - 1] / T[i][e];
          if (ratio < best - 1e-12 || (Math.abs(ratio - best) <= 1e-12 && basis[i] < basis[r])) {
            best = ratio;
            r = i;
          }
        }
      if (r < 0) break;
      const pv = T[r][e];
      for (let t = 0; t < W; t++) T[r][t] /= pv;
      for (let i = 0; i < m; i++)
        if (i !== r && T[i][e]) {
          const k = T[i][e];
          for (let t = 0; t < W; t++) T[i][t] -= k * T[r][t];
        }
      const k = z[e];
      for (let t = 0; t < W; t++) z[t] -= k * T[r][t];
      basis[r] = e;
      pivots++;
    }
    const y = new Array(n).fill(0);
    basis.forEach((b, i) => b < n && (y[b] = T[i][W - 1]));
    const x = U.range(m).map((i) => Math.max(0, z[n + i]));
    const sy = U.sum(y);
    const sx = U.sum(x);
    return { p: x.map((v) => v / sx), q: y.map((v) => v / sy), v: 1 / sy - shift, pivots };
  }
  /** Уязвимость пары стратегий в игре с нулевой суммой: max_i (Mq)_i − min_j (pM)_j ≥ 0. */
  function exploit(M, p, q) {
    return Math.max(...matVec(M, q)) - Math.min(...vecMat(p, M));
  }

  /**
   * Платёжная таблица. g = {A, B (нет — нулевая сумма), rows, cols}.
   * o: {sel, onCell(i, j), ne, br1, br2, aliveR, aliveC, cellBg(i, j), fmtv, corner}
   */
  function gameTable(parent, g, o = {}) {
    const m = g.A.length;
    const n = g.A[0].length;
    const aliveR = o.aliveR || U.range(m);
    const aliveC = o.aliveC || U.range(n);
    const fmtv = o.fmtv || ((v) => minus(U.fmt(v, 2)));
    const zero = !g.B;
    const B = g.B || neg(g.A);
    const ne = o.ne ? pureNE(g.A, B, aliveR, aliveC) : [];
    const t = H('table', { class: 'data', style: 'width:auto;margin:0 auto;font-variant-numeric:tabular-nums' });
    const dead = 'opacity:.35;text-decoration:line-through;';
    t.appendChild(H('thead', null, H('tr', null, H('th', { style: 'font-size:.76rem;color:var(--muted);text-align:left;font-weight:500;white-space:nowrap' }, o.corner || '1 ↓   2 →'), ...g.cols.map((c, j) => H('th', { style: 'text-align:center;white-space:nowrap;' + (aliveC.includes(j) ? '' : dead) }, c)))));
    const tb = H('tbody');
    for (let i = 0; i < m; i++) {
      const tr = H('tr', null, H('th', { style: 'white-space:nowrap;' + (aliveR.includes(i) ? '' : dead) }, g.rows[i]));
      for (let j = 0; j < n; j++) {
        const alive = aliveR.includes(i) && aliveC.includes(j);
        const u1 = o.br1 && alive && brRows(g.A, j, aliveR).includes(i);
        const u2 = o.br2 && !zero && alive && brCols(B, i, aliveC).includes(j);
        const sel = o.sel && o.sel[0] === i && o.sel[1] === j;
        const isNE = alive && ne.some(([a, b]) => a === i && b === j);
        const a = H('span', { style: 'padding:0 1px;' + (u1 ? 'border-bottom:3px solid ' + P1 + ';font-weight:700' : '') }, fmtv(g.A[i][j]));
        const parts = zero ? [a] : [a, H('span', { style: 'color:var(--muted)' }, ', '), H('span', { style: 'padding:0 1px;' + (u2 ? 'border-bottom:3px solid ' + P2 + ';font-weight:700' : '') }, fmtv(B[i][j]))];
        const bg = o.cellBg ? o.cellBg(i, j) : null;
        const td = H('td', { style: 'text-align:center;font-family:var(--font-mono);white-space:nowrap;padding:7px 11px;' + (o.onCell ? 'cursor:pointer;' : '') + (alive ? '' : 'opacity:.3;') + (bg ? 'background:' + bg + ';' : isNE ? 'background:var(--good-soft);' : '') + (sel ? 'outline:2.5px solid var(--ink);outline-offset:-4px;' : '') }, ...parts, isNE ? H('span', { style: 'color:var(--good-text);margin-left:4px' }, '★') : null);
        if (o.onCell) td.addEventListener('click', () => o.onCell(i, j));
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    const box = scrollBox();
    box.appendChild(t);
    parent.appendChild(box);
    return box;
  }
  /** Редактор биматрицы: в каждой клетке два поля. onChange() вызывается после правки g.A/g.B. */
  function matrixEditor(parent, g, onChange) {
    parent.textContent = '';
    const m = g.A.length;
    const n = g.A[0].length;
    const inp = (M, i, j, c) => {
      const el = H('input', { class: 'input', type: 'text', inputmode: 'decimal', 'aria-label': 'выигрыш', value: minus(String(M[i][j])), style: 'width:3.6em;padding:3px 4px;text-align:center;font-family:var(--font-mono);border-bottom:3px solid ' + c });
      el.addEventListener('change', () => {
        const v = parseFloat(el.value.replace(',', '.').replace('−', '-'));
        if (Number.isFinite(v)) M[i][j] = v;
        el.value = minus(String(M[i][j]));
        onChange();
      });
      return el;
    };
    const t = H('table', { class: 'data', style: 'width:auto;margin:0 auto' });
    t.appendChild(H('thead', null, H('tr', null, H('th', { style: 'font-size:.76rem;color:var(--muted);font-weight:500' }, '1 ↓   2 →'), ...g.cols.map((c) => H('th', { style: 'text-align:center' }, c)))));
    const tb = H('tbody');
    for (let i = 0; i < m; i++) {
      const tr = H('tr', null, H('th', null, g.rows[i]));
      for (let j = 0; j < n; j++) tr.appendChild(H('td', { style: 'white-space:nowrap;text-align:center;padding:6px 8px' }, inp(g.A, i, j, P1), H('span', { style: 'color:var(--muted)' }, ' , '), inp(g.B, i, j, P2)));
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    const box = scrollBox();
    box.appendChild(t);
    parent.appendChild(box);
  }
  const brLegend = () => legendRow([[P1, 'лучший ответ игрока 1 (строки)', 'line'], [P2, 'лучший ответ игрока 2 (столбцы)', 'line'], ['var(--good)', '★ равновесие Нэша']]);

  /* Библиотека классических игр 2×2 (строки — игрок 1, столбцы — игрок 2). */
  const G2 = {
    pd: { label: 'Дилемма заключённого', rows: ['молчать', 'сдать'], cols: ['молчать', 'сдать'], A: [[-1, -3], [0, -2]], B: [[-1, 0], [-3, -2]], text: '«Сдать» выгоднее при любом ходе сообщника, поэтому оба сдают и получают по −2, хотя молчание дало бы по −1. Равновесие одно — и оно плохое для обоих.' },
    stag: { label: 'Охота на оленя', rows: ['олень', 'заяц'], cols: ['олень', 'заяц'], A: [[4, 0], [3, 3]], B: [[4, 3], [0, 3]], text: 'Два равновесия: вместе на оленя (4, 4) — выгоднее, но рискованно; оба на зайца (3, 3) — надёжно. Игра о доверии.' },
    bos: { label: 'Где встретиться', rows: ['театр', 'футбол'], cols: ['театр', 'футбол'], A: [[2, 0], [0, 1]], B: [[1, 0], [0, 2]], text: 'Оба хотят встретиться, но предпочитают разные места: два равновесия, и каждое выгоднее одному из игроков.' },
    hd: { label: 'Ястреб и голубь', rows: ['ястреб', 'голубь'], cols: ['ястреб', 'голубь'], A: [[-1, 4], [0, 2]], B: [[-1, 0], [4, 2]], text: 'Спор за ресурс ценностью 4; драка двух ястребов стоит каждому 3 (итог −1). Чистые равновесия асимметричны: один уступает, другой забирает всё.' },
    coord: { label: 'По какой стороне идти', rows: ['справа', 'слева'], cols: ['справа', 'слева'], A: [[1, 0], [0, 1]], B: [[1, 0], [0, 1]], text: 'Чистая координация: неважно, какое правило, лишь бы общее. Два равновесия — так возникают соглашения и стандарты.' },
    mp: { label: 'Монетки', rows: ['орёл', 'решка'], cols: ['орёл', 'решка'], A: [[1, -1], [-1, 1]], B: [[-1, 1], [1, -1]], text: 'Первый хочет совпадения, второй — несовпадения: из любой клетки кто-то хочет уйти, стрелки идут по кругу. Чистого равновесия нет.' },
  };
  const g2Options = (keys) => keys.map((k) => ({ value: k, label: G2[k].label }));

  /* ==============================================================================
   * Интуиция. Стрелки отклонений в игре 2×2
   * ============================================================================== */
  GBC.widget('deviation-arrows', (el) => {
    const s = { g: 'pd', sel: [0, 0] };
    const w = ui.shell(el, { title: 'Кто захочет передумать? Стрелки отклонений', sub: 'Строки — ходы игрока 1, столбцы — игрока 2, в клетке (выигрыш 1, выигрыш 2). Синяя стрелка показывает, куда сдвинется игрок 1, если второй свой ход не меняет; оранжевая — то же для игрока 2. Клетка, из которой не выходит ни одной стрелки, — равновесие Нэша. Щёлкните по клетке.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: g2Options(Object.keys(G2)), onChange: (v) => ((s.g = v), draw()) });
    w.controls.appendChild(legendRow([[P1, 'игрок 1 меняет строку', 'line'], [P2, 'игрок 2 меняет столбец', 'line']]));
    const svgHost = H('div');
    w.main.appendChild(svgHost);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ne', label: 'равновесий Нэша' }, { key: 'cell', label: 'выбранная клетка' }, { key: 'opt', label: 'лучшая для обоих вместе' }]);
    w.pythonAction(() => {
      const g = G2[s.g];
      return `import numpy as np

A = np.array(${pyMat(g.A)})   # выигрыши игрока 1
B = np.array(${pyMat(g.B)})   # выигрыши игрока 2
rows, cols = ${pyStr(g.rows)}, ${pyStr(g.cols)}
for i in range(2):
    for j in range(2):
        d1 = A[1 - i, j] - A[i, j]      # выгода игрока 1 от смены строки
        d2 = B[i, 1 - j] - B[i, j]      # выгода игрока 2 от смены столбца
        mark = "★ равновесие Нэша" if d1 <= 0 and d2 <= 0 else ""
        print(f"({rows[i]}, {cols[j]}): ({A[i, j]}, {B[i, j]})  отклонение 1: {d1:+}, 2: {d2:+}  {mark}")`;
    });
    function draw() {
      const g = G2[s.g];
      const ne = pureNE(g.A, g.B);
      const svg = S('svg', { viewBox: '0 0 470 300', style: 'display:block;width:100%;height:auto;max-width:560px;min-width:340px;margin:0 auto' });
      const cx = (j) => 205 + 160 * j;
      const cy = (i) => 110 + 120 * i;
      g.cols.forEach((c, j) => svg.appendChild(sText(cx(j), 28, c, { bold: true, color: P2 })));
      g.rows.forEach((r, i) => svg.appendChild(sText(112, cy(i), r, { bold: true, anchor: 'end', color: P1 })));
      svg.appendChild(sText(40, 28, 'игрок 1 ↓ / 2 →', { size: 11, color: 'var(--muted)', anchor: 'start' }));
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const isNE = ne.some(([a, b]) => a === i && b === j);
          const sel = s.sel[0] === i && s.sel[1] === j;
          const r = S('rect', { x: cx(j) - 78, y: cy(i) - 58, width: 156, height: 116, rx: 10, style: 'cursor:pointer;fill:' + (isNE ? 'var(--good-soft)' : 'var(--surface)') + ';stroke:' + (sel ? 'var(--ink)' : isNE ? 'var(--good)' : 'var(--border-strong)') + ';stroke-width:' + (sel || isNE ? 2.5 : 1.2) });
          r.addEventListener('click', () => ((s.sel = [i, j]), draw()));
          svg.appendChild(r);
          const t1 = sText(cx(j) - 24, cy(i) - 10, minus(String(g.A[i][j])), { size: 20, bold: true, mono: true });
          const t2 = sText(cx(j) + 24, cy(i) - 10, minus(String(g.B[i][j])), { size: 20, bold: true, mono: true });
          [t1, t2].forEach((t) => (t.style.pointerEvents = 'none'));
          svg.append(t1, sText(cx(j), cy(i) - 10, ',', { size: 18, color: 'var(--muted)' }), t2);
          svg.appendChild(S('line', { x1: cx(j) - 36, x2: cx(j) - 12, y1: cy(i) + 6, y2: cy(i) + 6, style: 'stroke:' + P1 + ';stroke-width:3;stroke-linecap:round' }));
          svg.appendChild(S('line', { x1: cx(j) + 12, x2: cx(j) + 36, y1: cy(i) + 6, y2: cy(i) + 6, style: 'stroke:' + P2 + ';stroke-width:3;stroke-linecap:round' }));
          if (isNE) svg.appendChild(sText(cx(j), cy(i) + 30, '★ равновесие', { size: 12, bold: true, color: 'var(--good-text)' }));
        }
      const arrows = S('g');
      for (let j = 0; j < 2; j++) {
        const d = g.A[1][j] - g.A[0][j];
        const x = cx(j) - 56;
        if (Math.abs(d) < EPS) svgArrow(arrows, x, cy(0) + 30, x, cy(1) - 30, P1, { noHead: true, dash: '4 5', width: 2 });
        else if (d > 0) svgArrow(arrows, x, cy(0) + 30, x, cy(1) - 30, P1);
        else svgArrow(arrows, x, cy(1) - 30, x, cy(0) + 30, P1);
      }
      for (let i = 0; i < 2; i++) {
        const d = g.B[i][1] - g.B[i][0];
        const y = cy(i) + 44;
        if (Math.abs(d) < EPS) svgArrow(arrows, cx(0) + 40, y, cx(1) - 40, y, P2, { noHead: true, dash: '4 5', width: 2 });
        else if (d > 0) svgArrow(arrows, cx(0) + 40, y, cx(1) - 40, y, P2);
        else svgArrow(arrows, cx(1) - 40, y, cx(0) + 40, y, P2);
      }
      arrows.style.pointerEvents = 'none';
      svg.appendChild(arrows);
      svgHost.textContent = '';
      const box = scrollBox();
      box.appendChild(svg);
      svgHost.appendChild(box);
      const [i, j] = s.sel;
      const d1 = g.A[1 - i][j] - g.A[i][j];
      const d2 = g.B[i][1 - j] - g.B[i][j];
      const say = (who, from, to, d) => who + ': сменить «' + from + '» на «' + to + '» — ' + (d > 0 ? '<b>выгодно</b> (+' + d + ')' : d < 0 ? 'невыгодно (' + minus(String(d)) + ')' : 'всё равно (0)');
      let best = [0, 0];
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if (g.A[a][b] + g.B[a][b] > g.A[best[0]][best[1]] + g.B[best[0]][best[1]]) best = [a, b];
      st.set('ne', String(ne.length));
      st.set('cell', g.rows[i] + ' / ' + g.cols[j]);
      st.set('opt', g.rows[best[0]] + ' / ' + g.cols[best[1]] + ' (' + minus(String(g.A[best[0]][best[1]] + g.B[best[0]][best[1]])) + ')');
      note.innerHTML = 'Клетка (' + g.rows[i] + ', ' + g.cols[j] + ') = (' + minus(String(g.A[i][j])) + ', ' + minus(String(g.B[i][j])) + '). ' + say('Игрок 1', g.rows[i], g.rows[1 - i], d1) + '; ' + say('игрок 2', g.cols[j], g.cols[1 - j], d2) + '. ' + (d1 <= 0 && d2 <= 0 ? '⇒ <b>никто не хочет уходить в одиночку — это равновесие Нэша.</b> ' : '⇒ не равновесие: кто-то уйдёт. ') + g.text;
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 1. Редактор игры: из истории — в таблицу
   * ============================================================================== */
  const STORIES = {
    cafe: { label: 'Два кафе и цены', rows: ['высокая', 'низкая'], cols: ['высокая', 'низкая'], A: [[5, 1], [7, 3]], B: [[5, 7], [1, 3]], text: 'Кафе напротив друг друга выбирают цену на обед. Обе высокие — каждое зарабатывает 5 (тыс. руб. в день); одно снижает — переманивает гостей (7 против 1); обе низкие — по 3.' },
    project: { label: 'Совместный проект', rows: ['стараться', 'халтурить'], cols: ['стараться', 'халтурить'], A: [[4, 0], [3, 2]], B: [[4, 3], [0, 2]], text: 'Двое делают проект. Отличный результат (4) — только если стараются оба; халтурить вдвоём — средне (2); старался один — он зря потратил силы (0), а халтурщик получил 3.' },
    walk: { label: 'Встречные пешеходы', rows: ['вправо', 'влево'], cols: ['вправо', 'влево'], A: [[1, 0], [0, 1]], B: [[1, 0], [0, 1]], text: 'Двое идут навстречу по узкому тротуару. Если оба шагнут каждый вправо (или оба влево) — разойдутся (1); иначе столкнутся (0).' },
    parking: { label: 'Спор за парковку', rows: ['настаивать', 'уступить'], cols: ['настаивать', 'уступить'], A: [[-1, 4], [0, 2]], B: [[-1, 0], [4, 2]], text: 'Двое подъехали к одному месту. Уступил один — другой занял место (4 против 0); оба уступили — договорились, кто следующий (2 и 2); оба настаивают — ссора, обоим плохо (−1).' },
    kick: { label: 'Пенальти (нулевая сумма)', rows: ['бить влево', 'бить вправо'], cols: ['прыгать влево', 'прыгать вправо'], A: [[0, 1], [1, 0]], B: [[0, -1], [-1, 0]], text: 'Бьющий забивает (1), если вратарь прыгнул не туда; иначе гол не засчитан (0). Сколько получил один — столько потерял другой: выигрыш вратаря равен минус выигрышу бьющего.' },
  };
  function classify(A, B) {
    const m = A.length;
    const n = A[0].length;
    let constSum = true;
    let symm = m === n;
    const c0 = A[0][0] + B[0][0];
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++) {
        if (Math.abs(A[i][j] + B[i][j] - c0) > EPS) constSum = false;
        if (m === n && Math.abs(B[i][j] - A[j][i]) > EPS) symm = false;
      }
    if (constSum) return Math.abs(c0) < EPS ? 'игра с нулевой суммой: выигрыш одного — проигрыш другого' : 'игра с постоянной суммой (по сути — с нулевой)';
    if (symm && m === 2) {
      const [R, Sx, T, P] = [A[0][0], A[0][1], A[1][0], A[1][1]];
      if (T > R && R > P && P > Sx) return 'дилемма заключённого: T > R > P > S';
      if (T > R && Sx > P) return 'ястреб и голубь («слабак»): T > R, S > P';
      if (R > T && P > Sx) return 'координация / охота на оленя: R > T, P > S';
      if (R >= T && Sx >= P) return 'гармония: сотрудничать выгодно всегда';
      return 'симметричная игра';
    }
    return symm ? 'симметричная игра' : 'несимметричная игра';
  }
  function paretoCells(A, B) {
    const m = A.length;
    const n = A[0].length;
    const out = [];
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++) {
        let dominated = false;
        for (let a = 0; a < m && !dominated; a++)
          for (let b = 0; b < n; b++)
            if (A[a][b] >= A[i][j] && B[a][b] >= B[i][j] && (A[a][b] > A[i][j] || B[a][b] > B[i][j])) {
              dominated = true;
              break;
            }
        if (!dominated) out.push([i, j]);
      }
    return out;
  }
  function dominantOf(A, B, pl) {
    const M = pl === 0 ? A : transpose(B);
    const k = M.length;
    for (let r = 0; r < k; r++) {
      let all = true;
      let strict = true;
      for (let r2 = 0; r2 < k; r2++) {
        if (r2 === r) continue;
        const d = dom(M[r], M[r2]);
        if (!d) all = false;
        if (d !== 'strict') strict = false;
      }
      if (all) return { r, strict };
    }
    return null;
  }
  GBC.widget('payoff-editor', (el) => {
    const s = { story: 'cafe' };
    let g = null;
    const w = ui.shell(el, { title: 'Из истории — в игру: редактор платёжной таблицы', sub: 'Выберите историю или впишите свои числа (синие поля — выигрыш игрока 1, оранжевые — игрока 2). Виджет сразу найдёт доминирующие стратегии, равновесия Нэша, Парето-оптимальные исходы и назовёт тип игры.' });
    ui.select(w.controls, { label: 'История', value: s.story, options: Object.keys(STORIES).map((k) => ({ value: k, label: STORIES[k].label })), onChange: (v) => ((s.story = v), load()) });
    ui.button(w.controls, { label: 'Вернуть числа истории', icon: 'reset', small: true, onClick: () => load() });
    const story = H('p', { style: 'margin:2px 0 8px;color:var(--ink-2)' });
    const ed = H('div');
    const grid = cardGrid(210);
    const cDom = card('Доминирующие стратегии');
    const cNE = card('Равновесия Нэша');
    const cPar = card('Парето-оптимальные исходы');
    const cType = card('Тип игры');
    grid.append(cDom.el, cNE.el, cPar.el, cType.el);
    const tbl = H('div');
    w.main.append(story, ed, H('div', { style: 'font-size:.86rem;color:var(--ink-2);margin:6px 0 0' }, 'Анализ: подчёркнуты наилучшие ответы, ★ — равновесия'), tbl, grid);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ne', label: 'чистых равновесий' }, { key: 'par', label: 'Парето-оптимальных' }, { key: 'gap', label: 'равновесие ⇄ максимум суммы' }]);
    w.pythonAction(() => `import numpy as np
from itertools import product

A = np.array(${pyMat(g.A)})   # игрок 1
B = np.array(${pyMat(g.B)})   # игрок 2
rows, cols = ${pyStr(g.rows)}, ${pyStr(g.cols)}
cells = list(product(range(A.shape[0]), range(A.shape[1])))
ne = [(i, j) for i, j in cells if A[i, j] == A[:, j].max() and B[i, j] == B[i, :].max()]
pareto = [(i, j) for i, j in cells
          if not any(A[a, b] >= A[i, j] and B[a, b] >= B[i, j] and (A[a, b], B[a, b]) != (A[i, j], B[i, j]) for a, b in cells)]
best = max(cells, key=lambda c: A[c] + B[c])
print("равновесия Нэша:", [(rows[i], cols[j]) for i, j in ne])
print("Парето-оптимальны:", [(rows[i], cols[j]) for i, j in pareto])
print("максимум суммы:", (rows[best[0]], cols[best[1]]), A[best] + B[best])`);
    function load() {
      const st0 = STORIES[s.story];
      g = { rows: st0.rows, cols: st0.cols, A: clone(st0.A), B: clone(st0.B) };
      story.textContent = st0.text;
      matrixEditor(ed, g, draw);
      draw();
    }
    function draw() {
      tbl.textContent = '';
      gameTable(tbl, g, { ne: true, br1: true, br2: true });
      const ne = pureNE(g.A, g.B);
      const par = paretoCells(g.A, g.B);
      const cell = ([i, j]) => '(' + g.rows[i] + ', ' + g.cols[j] + ')';
      cDom.body.textContent = '';
      [0, 1].forEach((pl) => {
        const d = dominantOf(g.A, g.B, pl);
        const names = pl === 0 ? g.rows : g.cols;
        cDom.body.appendChild(H('div', null, H('b', { style: 'color:' + (pl ? P2 : P1) }, 'Игрок ' + (pl + 1) + ': '), d ? '«' + names[d.r] + '» (' + (d.strict ? 'строго' : 'слабо') + ')' : 'нет'));
      });
      cNE.body.textContent = ne.length ? ne.map(cell).join('; ') : 'в чистых стратегиях нет';
      cPar.body.textContent = par.map(cell).join('; ');
      cType.body.textContent = classify(g.A, g.B);
      let best = [0, 0];
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) if (g.A[i][j] + g.B[i][j] > g.A[best[0]][best[1]] + g.B[best[0]][best[1]]) best = [i, j];
      const neBest = ne.some(([i, j]) => g.A[i][j] + g.B[i][j] >= g.A[best[0]][best[1]] + g.B[best[0]][best[1]] - EPS);
      const neInPar = ne.filter(([i, j]) => par.some(([a, b]) => a === i && b === j)).length;
      st.set('ne', String(ne.length));
      st.set('par', String(par.length));
      st.set('gap', ne.length ? (neBest ? 'совпадают' : 'расходятся') : '—');
      note.innerHTML = '<b>Игра в нормальной форме</b> — это три вещи: <b>игроки</b>, их <b>стратегии</b> и <b>выигрыши</b> при каждом сочетании стратегий. Числа нужны только для сравнения: важно, что лучше и что хуже (а для смешанных стратегий позже — и насколько). ' + (ne.length && !neInPar ? '<b>Здесь все равновесия не Парето-оптимальны</b>: есть исход, лучший для обоих, но до него не дойти поодиночке — признак дилеммы. ' : '') + (ne.length === 0 ? 'Чистого равновесия нет — понадобятся смешанные стратегии (блок 2). ' : '') + 'Исход <b>Парето-оптимален</b>, если нельзя улучшить положение одного, не ухудшив другому.';
    }
    load();
  });

  /* ==============================================================================
   * Шаг 2. Доминирование
   * ============================================================================== */
  const DG = {
    pd: { label: 'Дилемма заключённого', rows: ['молчать', 'сдать'], cols: ['молчать', 'сдать'], A: [[-1, -3], [0, -2]], B: [[-1, 0], [-3, -2]] },
    cafe: { label: 'Два кафе и цены', rows: ['высокая', 'низкая'], cols: ['высокая', 'низкая'], A: [[5, 1], [7, 3]], B: [[5, 7], [1, 3]] },
    price: { label: 'Цены 10, 8 или 6', rows: ['10', '8', '6'], cols: ['10', '8', '6'], A: [[30, 0, 0], [40, 20, 0], [20, 20, 10]], B: [[30, 40, 20], [0, 20, 20], [0, 0, 10]] },
    mix: { label: 'Доминирование смесью', rows: ['верх', 'середина', 'низ'], cols: ['левый', 'правый'], A: [[3, 0], [0, 3], [1, 1]], B: [[1, 0], [0, 1], [2, 2]] },
  };
  GBC.widget('dominance', (el) => {
    const s = { g: 'pd', pl: 0, mix: true };
    const w = ui.shell(el, { title: 'Доминирование: лучше при любом ходе соперника', sub: 'Столбики сгруппированы по ходу соперника; внутри группы — ваши стратегии. Стратегия строго доминирует другую, если её столбик выше в каждой группе; слабо — если не ниже нигде и выше хотя бы в одной.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: Object.keys(DG).map((k) => ({ value: k, label: DG[k].label })), onChange: (v) => ((s.g = v), draw()) });
    ui.segmented(w.controls, { label: 'Чьи стратегии', value: s.pl, options: [{ value: 0, label: 'игрок 1' }, { value: 1, label: 'игрок 2' }], onChange: (v) => ((s.pl = v), draw()) });
    ui.toggle(w.controls, { label: 'искать доминирование смесью двух стратегий', checked: s.mix, onChange: (v) => ((s.mix = v), draw()) });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'ход соперника' }, y: { label: 'ваш выигрыш' } });
    const list = monoBox();
    w.main.appendChild(list);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'dom', label: 'доминирующая стратегия' }, { key: 'sd', label: 'строго доминируемых' }, { key: 'wd', label: 'слабо доминируемых' }]);
    w.pythonAction(() => {
      const g = DG[s.g];
      return `import numpy as np

A = np.array(${pyMat(g.A)}, float)   # игрок 1
B = np.array(${pyMat(g.B)}, float)   # игрок 2
M, names = ${s.pl === 0 ? 'A, ' + pyStr(g.rows) : 'B.T, ' + pyStr(g.cols)}   # строки M — стратегии игрока ${s.pl + 1}
for a in range(len(M)):
    for b in range(len(M)):
        if a != b and (M[a] >= M[b]).all():
            kind = "строго" if (M[a] > M[b]).all() else ("слабо" if (M[a] > M[b]).any() else None)
            if kind:
                print(f"«{names[a]}» {kind} доминирует «{names[b]}»: {M[a]} против {M[b]}")
# доминирование смесью: alpha·M[a] + (1 − alpha)·M[b] > M[c] во всех столбцах
for c in range(len(M)):
    for a in range(len(M)):
        for b in range(a + 1, len(M)):
            if c in (a, b):
                continue
            al = np.linspace(0, 1, 101)
            margin = np.min(al[:, None] * M[a] + (1 - al[:, None]) * M[b] - M[c], axis=1)
            k = margin.argmax()
            if margin[k] > 0:
                print(f"«{names[c]}» строго доминируется смесью {al[k]:.2f}·«{names[a]}» + {1 - al[k]:.2f}·«{names[b]}»")`;
    });
    function draw() {
      const g = DG[s.g];
      tbl.textContent = '';
      gameTable(tbl, g, { ne: true, br1: s.pl === 0, br2: s.pl === 1 });
      const M = s.pl === 0 ? g.A : transpose(g.B);
      const own = s.pl === 0 ? g.rows : g.cols;
      const opp = s.pl === 0 ? g.cols : g.rows;
      const k = M.length;
      const nOpp = M[0].length;
      const bw = 0.8 / k;
      const layers = M.map((row, r) => ({ type: 'bars', x: U.range(nOpp).map((j) => j + 1 + (r - (k - 1) / 2) * bw), y: row, width: bw * 0.92, maxPx: 46, color: SER[r], label: '«' + own[r] + '»', tooltip: (j) => [{ label: 'против «' + opp[j] + '»', value: minus(String(row[j])), color: SER[r] }] }));
      const all = M.flat();
      plot.opts.x.ticks = U.range(nOpp, 1);
      plot.opts.x.format = (v) => '«' + (opp[Math.round(v) - 1] || '') + '»';
      plot.render([{ type: 'hline', y: 0, color: 'axis', width: 1 }, ...layers, { type: 'text', items: M.flatMap((row, r) => row.map((v, j) => ({ x: j + 1 + (r - (k - 1) / 2) * bw, y: v, dy: v >= 0 ? -6 : 14, anchor: 'middle', text: minus(String(v)) }))) }], { x: [0.4, nOpp + 0.6], y: [Math.min(0, ...all) - 1, Math.max(0, ...all) * 1.18 + 1] });
      const lines = [];
      let sd = 0;
      let wd = 0;
      const dominated = new Set();
      for (let b = 0; b < k; b++) {
        let kind = null;
        for (let a = 0; a < k; a++) {
          if (a === b) continue;
          const d = dom(M[a], M[b]);
          if (d) {
            lines.push('«' + own[a] + '» ' + (d === 'strict' ? 'строго' : 'слабо') + ' доминирует «' + own[b] + '»: ' + M[a].map((v, j) => minus(String(v)) + (v > M[b][j] + EPS ? ' > ' : ' = ') + minus(String(M[b][j]))).join(', '));
            if (d === 'strict') kind = 'strict';
            else if (!kind) kind = 'weak';
          }
        }
        if (!kind && s.mix && k >= 3)
          for (let a = 0; a < k && !kind; a++)
            for (let c = a + 1; c < k && !kind; c++) {
              if (a === b || c === b) continue;
              let bestA = -1;
              let bestM = -Infinity;
              for (let t = 0; t <= 100; t++) {
                const al = t / 100;
                const mg = Math.min(...M[b].map((v, j) => al * M[a][j] + (1 - al) * M[c][j] - v));
                if (mg > bestM) (bestM = mg), (bestA = al);
              }
              if (bestM > EPS) {
                kind = 'strict';
                lines.push('«' + own[b] + '» строго доминируется смесью ' + f2(bestA) + '·«' + own[a] + '» + ' + f2(1 - bestA) + '·«' + own[c] + '»: ' + M[b].map((v, j) => f2(bestA * M[a][j] + (1 - bestA) * M[c][j]) + ' > ' + minus(String(v))).join(', '));
              }
            }
        if (kind === 'strict') sd++;
        else if (kind === 'weak') wd++;
        if (kind) dominated.add(b);
      }
      list.textContent = lines.length ? lines.join('\n') : 'Ни одна стратегия не доминирует другую.';
      const d = dominantOf(g.A, g.B, s.pl);
      st.set('dom', d ? '«' + own[d.r] + '» (' + (d.strict ? 'строго' : 'слабо') + ')' : 'нет');
      st.set('sd', String(sd));
      st.set('wd', String(wd));
      const texts = {
        pd: '«Сдать» строго доминирует «молчать»: 0 > −1 и −2 > −3. Игроку даже не нужно гадать о сообщнике — у него есть <b>доминирующая стратегия</b>. Рациональный игрок никогда не играет строго доминируемую стратегию.',
        cafe: 'Та же дилемма в ценах: низкая цена выгоднее при любой цене соседа (7 > 5, 3 > 1), и оба кафе приходят к (3, 3) вместо (5, 5). Это <b>ценовая война</b>.',
        price: 'Цена 8 только <b>слабо</b> доминирует 10: против цены 6 обе дают 0. Слабое доминирование коварнее строгого: удаляя слабо доминируемые стратегии в разном порядке, можно получить разные ответы (шаг 3). Строго доминируемых здесь нет.',
        mix: 'Ни «верх», ни «середина» не лучше «низа» поодиночке: против «левого» верх даёт 3, а середина 0. Но смесь ½·верх + ½·середина гарантирует 1.5 против любого хода — строго больше, чем 1 у «низа». <b>Стратегию может доминировать смесь</b>, даже если не доминирует ни одна чистая.',
      };
      note.innerHTML = texts[s.g] + (s.pl === 1 && s.g !== 'mix' ? ' Игра симметрична, поэтому у игрока 2 то же самое.' : '');
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 3. Последовательное удаление доминируемых стратегий; пляж Хотеллинга
   * ============================================================================== */
  function hotelling(n) {
    const share = (i, j) => {
      let s = 0;
      for (let x = 0; x < n; x++) {
        const di = Math.abs(x - i);
        const dj = Math.abs(x - j);
        s += di < dj ? 1 : di === dj ? 0.5 : 0;
      }
      return s;
    };
    const A = U.range(n).map((i) => U.range(n).map((j) => share(i, j)));
    return { rows: U.range(n, 1).map(String), cols: U.range(n, 1).map(String), A, B: transpose(A).map((r) => r.slice()), hot: true };
  }
  const IG = {
    ex: { label: 'Игра 3×3 из упражнений', rows: ['верх', 'середина', 'низ'], cols: ['левый', 'центр', 'правый'], A: [[3, 0, 0.5], [2, 1, 1], [1, 0, 0]], B: [[1, 2, 0], [0, 1, 2], [3, 2, 1]] },
    hot: { label: 'Пляж Хотеллинга' },
    price: { label: 'Цены 10, 8 или 6', rows: ['10', '8', '6'], cols: ['10', '8', '6'], A: [[30, 0, 0], [40, 20, 0], [20, 20, 10]], B: [[30, 40, 20], [0, 20, 20], [0, 0, 10]] },
    bos: { label: 'Где встретиться', rows: ['театр', 'футбол'], cols: ['театр', 'футбол'], A: [[2, 0], [0, 1]], B: [[1, 0], [0, 2]] },
  };
  GBC.widget('iesds', (el) => {
    const s = { g: 'ex', n: 7, weak: false, k: 0 };
    const w = ui.shell(el, { title: 'Удаляем доминируемые стратегии шаг за шагом', sub: 'Рациональный игрок не играет строго доминируемую стратегию, и соперник это знает — значит, её можно вычеркнуть. После вычёркивания у кого-то могут появиться новые доминируемые стратегии. Проиграйте шаги.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: Object.keys(IG).map((k) => ({ value: k, label: IG[k].label })), onChange: (v) => ((s.g = v), (s.k = 0), rebuild()) });
    const nSl = ui.slider(w.controls, { label: 'Мест на пляже n', min: 3, max: 11, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), (s.k = 0), rebuild()) });
    ui.toggle(w.controls, { label: 'удалять и слабо доминируемые', checked: s.weak, onChange: (v) => ((s.weak = v), (s.k = 0), rebuild()) });
    const pl = ui.player(w.controls, { label: 'Шаг удаления', min: 0, max: 1, value: 0, fps: 1.2, format: (k, mx) => k + ' из ' + mx, onChange: (k) => ((s.k = k), draw()) });
    const beach = H('div');
    const tbl = H('div');
    const list = monoBox();
    w.main.append(beach, tbl, list);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'left', label: 'осталось стратегий' }, { key: 'res', label: 'итог' }, { key: 'ne', label: 'равновесия исходной игры' }]);
    let g = null;
    let R = null;
    w.pythonAction(() => `import numpy as np

${s.g === 'hot' ? `n = ${s.n}   # мест на пляже; покупатели — по одному на каждом месте
def share(i, j):
    return sum(1 if abs(x - i) < abs(x - j) else 0.5 if abs(x - i) == abs(x - j) else 0 for x in range(n))
A = np.array([[share(i, j) for j in range(n)] for i in range(n)])
B = A.T.copy()
rows = cols = [str(i + 1) for i in range(n)]` : `A = np.array(${pyMat(g.A)}, float)
B = np.array(${pyMat(g.B)}, float)
rows, cols = ${pyStr(g.rows)}, ${pyStr(g.cols)}`}
WEAK = ${s.weak ? 'True' : 'False'}

def dominated(M, a, b):   # строка a доминирует строку b?
    return (M[a] > M[b]).all() or (WEAK and (M[a] >= M[b]).all() and (M[a] > M[b]).any())

R, C = list(range(len(rows))), list(range(len(cols)))
while True:
    sub1 = A[np.ix_(R, C)]
    r = next((R[b] for b in range(len(R)) for a in range(len(R)) if a != b and dominated(sub1, a, b)), None)
    if r is not None:
        print("игрок 1 вычёркивает", rows[r]); R.remove(r); continue
    sub2 = B[np.ix_(R, C)].T
    c = next((C[b] for b in range(len(C)) for a in range(len(C)) if a != b and dominated(sub2, a, b)), None)
    if c is not None:
        print("игрок 2 вычёркивает", cols[c]); C.remove(c); continue
    break
print("осталось:", [rows[i] for i in R], [cols[j] for j in C])`);
    function rebuild() {
      nSl.el.style.display = s.g === 'hot' ? '' : 'none';
      g = s.g === 'hot' ? hotelling(s.n) : IG[s.g];
      R = iesds(g.A, g.B, s.weak);
      pl.setMax(R.steps.length);
      pl.set(Math.min(s.k, R.steps.length));
      draw();
    }
    function draw() {
      const k = s.k;
      const cur = k < R.steps.length ? R.steps[k] : { rows: R.rows, cols: R.cols };
      const fmtv = (v) => minus(U.fmt(v, 2));
      tbl.textContent = '';
      gameTable(tbl, g, { aliveR: cur.rows, aliveC: cur.cols, fmtv, ne: k === R.steps.length });
      beach.textContent = '';
      if (g.hot) {
        const row = flexRow('justify-content:center;margin:2px 0 6px');
        row.appendChild(H('span', { style: 'font-size:.86rem;color:var(--ink-2);margin-right:6px' }, 'пляж:'));
        g.rows.forEach((name, i) => row.appendChild(chip(name, cur.rows.includes(i) ? 'on' : 'dim', 'var(--c-aqua)')));
        beach.appendChild(row);
      }
      const names = (pl0) => (pl0 === 0 ? g.rows : g.cols);
      list.textContent = R.steps.length
        ? R.steps.map((t, i) => (i < k ? '✓ ' : i === k ? '→ ' : '  ') + (i + 1) + '. игрок ' + (t.pl + 1) + ' вычёркивает «' + names(t.pl)[t.k] + '»: её ' + (t.kind === 'strict' ? 'строго' : 'слабо') + ' доминирует «' + names(t.pl)[t.by] + '»').join('\n')
        : 'Доминируемых стратегий нет — удалять нечего.';
      st.set('left', cur.rows.length + ' × ' + cur.cols.length);
      st.set('res', k === R.steps.length ? (R.rows.length === 1 && R.cols.length === 1 ? '(' + g.rows[R.rows[0]] + ', ' + g.cols[R.cols[0]] + ')' : R.rows.length + ' × ' + R.cols.length + ' — не решается') : '…');
      st.set('ne', pureNE(g.A, g.B).map(([i, j]) => '(' + g.rows[i] + ', ' + g.cols[j] + ')').join(' ') || 'нет');
      const texts = {
        ex: 'Цепочка из четырёх шагов: «низ» хуже «середины» всегда; без «низа» у игрока 2 «левый» хуже «центра»; без «левого» «верх» хуже «середины»; наконец, «центр» хуже «правого». Остаётся (середина, правый) — единственное равновесие Нэша. Каждый шаг требует ещё одного уровня «я знаю, что он знает, что я рационален».',
        hot: 'Два продавца мороженого выбирают место на пляже из ' + s.n + ' мест; покупатели идут к ближайшему. Крайние места строго хуже соседних, после их удаления крайними становятся следующие — и так до центра. Поэтому магазины, кафе и даже политические программы <b>сходятся к середине</b> (Хотеллинг, 1929). ' + (s.n % 2 === 0 ? 'При чётном n остаются два центральных места.' : 'При нечётном n остаётся одно центральное место.'),
        price: s.weak ? 'Со слабым доминированием: цена 10 уходит (её слабо доминирует 8), затем 8 (её слабо доминирует 6), и остаётся (6, 6) — хотя (8, 8) тоже равновесие Нэша. Удаление слабо доминируемых может выбросить равновесия, а результат может зависеть от порядка.' : 'Строго доминируемых стратегий нет — процедура сразу останавливается. Включите удаление слабо доминируемых.',
        bos: 'Здесь удалять нечего: каждая стратегия — наилучший ответ на что-то. Удаление доминируемых решает лишь часть игр; для остальных нужно равновесие Нэша.',
      };
      note.innerHTML = '<b>Последовательное удаление строго доминируемых стратегий</b> (iterated elimination) не теряет ни одного равновесия Нэша, и его результат не зависит от порядка удаления. ' + texts[s.g];
    }
    rebuild();
  });

  /* ==============================================================================
   * Шаг 4. «Угадай 2/3 среднего»: уровни рассуждения
   * ============================================================================== */
  GBC.widget('beauty-contest', (el) => {
    const N = 100;
    const rng = new GBC.RNG(4);
    const l0 = U.range(N).map(() => rng.uniform(0, 100));
    const jit = U.range(N).map(() => rng.uniform(-0.28, 0.28));
    const s = { p: 2 / 3, sh: [30, 40, 20, 10, 0] };
    const LV = ['L0: наугад', 'L1', 'L2', 'L3', 'равновесие: 0'];
    const w = ui.shell(el, { title: 'Угадай 2/3 среднего', sub: 'Каждый из 100 игроков называет число от 0 до 100; побеждает тот, кто ближе всех к p·(среднее). Игрок уровня 0 называет случайное число, уровня k считает, что все остальные — уровня k − 1, и отвечает наилучшим образом: 50·pᵏ.' });
    ui.slider(w.controls, { label: 'Множитель p', values: [0.5, 0.6, 2 / 3, 0.7, 0.8, 0.9], value: s.p, format: (v) => frac(v), onInput: (v) => ((s.p = v), draw()) });
    const sls = LV.map((name, k) => ui.slider(w.controls, { label: 'Доля ' + name + ', %', min: 0, max: 100, step: 5, value: s.sh[k], format: String, onInput: (v) => ((s.sh[k] = v), draw()) }));
    void sls;
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'названное число', domain: [0, 100] }, y: { label: '', domain: [-0.6, 4.6], ticks: [0, 1, 2, 3, 4], format: (v) => ['L0', 'L1', 'L2', 'L3', 'Нэш'][Math.round(v)] || '' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'mean', label: 'среднее' }, { key: 'tg', label: 'цель p·среднее' }, { key: 'win', label: 'ближе всех' }]);
    const counts = () => {
      const tot = U.sum(s.sh) || 1;
      const raw = s.sh.map((v) => (v / tot) * N);
      const c = raw.map(Math.floor);
      let rest = N - U.sum(c);
      U.argsort(raw.map((v, i) => -(v - c[i]))).forEach((i) => rest-- > 0 && c[i]++);
      return c;
    };
    function guesses() {
      const c = counts();
      const out = [];
      let idx = 0;
      c.forEach((cnt, k) => {
        for (let t = 0; t < cnt; t++, idx++) out.push({ k, g: k === 0 ? l0[idx] : k === 4 ? 0 : 50 * Math.pow(s.p, k), j: jit[idx] });
      });
      return out;
    }
    w.pythonAction(() => {
      const c = counts();
      return `from gbcourse.rng import Mulberry32

N, p = 100, ${pyNum(s.p)}
rng = Mulberry32(4)
l0 = [rng.uniform(0, 100) for _ in range(N)]      # случайные числа игроков уровня 0
counts = ${pyVec(c)}    # сколько игроков уровней L0, L1, L2, L3 и «равновесных»
guess, level, idx = [], [], 0
for k, cnt in enumerate(counts):
    for _ in range(cnt):
        guess.append(l0[idx] if k == 0 else 0.0 if k == 4 else 50 * p**k)
        level.append(k)
        idx += 1
mean = sum(guess) / N
target = p * mean
win = min(range(N), key=lambda i: abs(guess[i] - target))
print(f"среднее {mean:.2f}, цель {target:.2f}, победитель: уровень {level[win]}, число {guess[win]:.2f}")
print("после k шагов удаления доминируемых чисел остаются [0, 100·p^k]:", [round(100 * p**k, 1) for k in range(1, 6)])`;
    });
    function draw() {
      const G = guesses();
      const mean = U.mean(G.map((o) => o.g));
      const tg = s.p * mean;
      let win = 0;
      G.forEach((o, i) => Math.abs(o.g - tg) < Math.abs(G[win].g - tg) && (win = i));
      const bounds = U.range(4, 1).map((k) => 100 * Math.pow(s.p, k));
      plot.render([
        { type: 'vband', x0: 100 * s.p, x1: 100, color: 'critical', opacity: 0.08 },
        ...bounds.slice(1).map((b, i) => ({ type: 'vline', x: b, color: 'muted', width: 1, dash: '3 4', text: (i + 2) + ' шага' })),
        { type: 'vline', x: 100 * s.p, color: 'critical', width: 1.2, dash: '3 4', text: '1 шаг' },
        { type: 'points', x: G.map((o) => o.g), y: G.map((o) => o.k + o.j), r: 4, color: (i) => SER[G[i].k], label: 'названные числа', legend: false, tooltip: (i) => [{ label: LV[G[i].k], value: f2(G[i].g) }] },
        { type: 'vline', x: mean, color: 'ink2', width: 1.5, dash: '6 4', label: 'среднее' },
        { type: 'vline', x: tg, color: 'model', width: 2.5, label: 'цель p·среднее' },
        { type: 'points', x: [G[win].g], y: [G[win].k + G[win].j], r: 8, hollow: true, color: 'ink', label: 'победитель' },
      ]);
      st.set('mean', f2(mean));
      st.set('tg', f2(tg));
      st.set('win', (G[win].k === 4 ? 'Нэш' : 'L' + G[win].k) + ': ' + f2(G[win].g));
      note.innerHTML = 'Число выше 100·p = ' + f2(100 * s.p) + ' никогда не выигрывает: цель не может быть больше (закрашенная зона — <b>строго доминируемые</b> числа). Если все это понимают, цель не больше 100·p², затем 100·p³… Последовательное удаление доминируемых стратегий оставляет единственное число — <b>0, равновесие Нэша</b>. Но выигрывает не тот, кто «рационален до конца», а тот, кто <b>угадал глубину рассуждений других</b>. В экспериментах среднее в первом раунде обычно получается между 20 и 40: большинство делает один-два шага. При повторении игры ответы быстро сползают к нулю — люди учатся (блок 4). Добавьте «равновесных» игроков: пока их мало, они проигрывают.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 5. Наилучшие ответы и поиск равновесий; случайные игры
   * ============================================================================== */
  function randomGame(n, seed) {
    const rng = new GBC.RNG(seed);
    const A = U.range(n).map(() => U.range(n).map(() => rng.randint(10)));
    const B = U.range(n).map(() => U.range(n).map(() => rng.randint(10)));
    return { A, B };
  }
  GBC.widget('nash-finder', (el) => {
    const s = { n: 3, seed: 7, br1: true, br2: true, sel: [0, 0] };
    const w = ui.shell(el, { title: 'Метод подчёркивания: ищем равновесия Нэша', sub: 'В каждом столбце подчеркните лучший выигрыш игрока 1 (синий), в каждой строке — лучший выигрыш игрока 2 (оранжевый). Клетка, где подчёркнуты оба числа, — равновесие Нэша. Ниже — сколько таких клеток в случайных играх.' });
    ui.slider(w.controls, { label: 'Размер игры n × n', min: 2, max: 6, step: 1, value: s.n, format: (v) => v + ' × ' + v, onInput: (v) => ((s.n = v), (s.sel = [0, 0]), draw()) });
    ui.slider(w.controls, { label: 'Номер случайной игры', min: 1, max: 40, step: 1, value: s.seed, format: String, onInput: (v) => ((s.seed = v), draw()) });
    ui.toggle(w.controls, { label: 'подчёркивать ответы игрока 1', checked: s.br1, onChange: (v) => ((s.br1 = v), draw()) });
    ui.toggle(w.controls, { label: 'подчёркивать ответы игрока 2', checked: s.br2, onChange: (v) => ((s.br2 = v), draw()) });
    w.main.appendChild(brLegend());
    const tbl = H('div');
    const line = monoBox();
    w.main.append(tbl, line);
    // доля случайных игр с чистым равновесием
    const K = 1000;
    const stat = U.range(9, 2).map((n) => {
      const rng = new GBC.RNG(2026 + n);
      let has = 0;
      let tot = 0;
      for (let t = 0; t < K; t++) {
        const A = U.range(n).map(() => U.range(n).map(() => rng.random()));
        const B = U.range(n).map(() => U.range(n).map(() => rng.random()));
        const c = pureNE(A, B).length;
        tot += c;
        if (c) has++;
      }
      return { n, p: has / K, m: tot / K };
    });
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'размер n случайной игры n × n', domain: [1.4, 10.6], ticks: U.range(9, 2) }, y: { label: 'доля игр с чистым равновесием', domain: [0, 1] } });
    plot.render([
      { type: 'bars', x: stat.map((o) => o.n), y: stat.map((o) => o.p), color: 'model', width: 0.6, maxPx: 34, label: 'доля (1000 игр)', tooltip: (i) => [{ label: 'с равновесием', value: pct(stat[i].p) }, { label: 'среднее число равновесий', value: f2(stat[i].m) }] },
      { type: 'hline', y: 1 - 1 / Math.E, color: 'tree', width: 2, dash: '6 4', label: 'предел 1 − 1/e ≈ 0.632' },
    ]);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ne', label: 'равновесий в этой игре' }, { key: 'cell', label: 'выбранная клетка' }, { key: 'p2', label: 'игр 2 × 2 с равновесием' }]);
    st.set('p2', pct(stat[0].p));
    w.pythonAction(() => `from gbcourse.rng import Mulberry32

def random_game(n, seed):
    rng = Mulberry32(seed)
    A = [[rng.randint(10) for _ in range(n)] for _ in range(n)]
    B = [[rng.randint(10) for _ in range(n)] for _ in range(n)]
    return A, B

def pure_ne(A, B):
    n, m = len(A), len(A[0])
    return [(i, j) for i in range(n) for j in range(m)
            if A[i][j] == max(A[k][j] for k in range(n)) and B[i][j] == max(B[i])]

A, B = random_game(${s.n}, ${s.seed})
for i in range(${s.n}):
    print("  ".join(f"({A[i][j]},{B[i][j]})" for j in range(${s.n})))
print("равновесия Нэша:", pure_ne(A, B))

K = 1000   # доля случайных игр n×n (непрерывные выигрыши) с чистым равновесием
for n in range(2, 11):
    rng = Mulberry32(2026 + n)
    has = tot = 0
    for _ in range(K):
        A = [[rng.random() for _ in range(n)] for _ in range(n)]
        B = [[rng.random() for _ in range(n)] for _ in range(n)]
        c = len(pure_ne(A, B))
        has += c > 0
        tot += c
    print(f"n = {n:2}: доля {has / K:.3f}, среднее число {tot / K:.3f}")`);
    function draw() {
      const { A, B } = randomGame(s.n, s.seed);
      const names = U.range(s.n).map((i) => String.fromCharCode(1072 + i));
      const g = { A, B, rows: names.map((c) => c.toUpperCase()), cols: U.range(s.n, 1).map(String) };
      const [i, j] = s.sel;
      tbl.textContent = '';
      gameTable(tbl, g, { ne: s.br1 && s.br2, br1: s.br1, br2: s.br2, sel: s.sel, onCell: (a, b) => ((s.sel = [a, b]), draw()) });
      const ne = pureNE(A, B);
      const b1 = brRows(A, j);
      const b2 = brCols(B, i);
      line.textContent = 'Клетка (' + g.rows[i] + ', ' + g.cols[j] + ') = (' + A[i][j] + ', ' + B[i][j] + ')\nЛучший ответ игрока 1 на столбец ' + g.cols[j] + ': ' + b1.map((r) => g.rows[r]).join(', ') + ' (' + A[b1[0]][j] + ')' + (b1.includes(i) ? ' ✓' : ' — игрок 1 уйдёт') + '\nЛучший ответ игрока 2 на строку ' + g.rows[i] + ': ' + b2.map((c) => g.cols[c]).join(', ') + ' (' + B[i][b2[0]] + ')' + (b2.includes(j) ? ' ✓' : ' — игрок 2 уйдёт') + '\n' + (b1.includes(i) && b2.includes(j) ? '⇒ равновесие Нэша ★' : '⇒ не равновесие');
      st.set('ne', String(ne.length));
      st.set('cell', '(' + g.rows[i] + ', ' + g.cols[j] + ')');
      note.innerHTML = '<b>Наилучший ответ</b> — стратегия, дающая максимум выигрыша при фиксированных ходах остальных. <b>Равновесие Нэша</b> — набор стратегий, где каждая — наилучший ответ на остальные, то есть никому не выгодно отклоняться в одиночку. Метод подчёркивания проверяет это за n² сравнений на игрока. В случайной игре у каждой клетки шанс быть равновесием 1/n · 1/n, клеток n², поэтому <b>среднее число чистых равновесий равно 1</b> при любом n. Но это лишь среднее: доля игр хотя бы с одним равновесием ' + pct(stat[0].p) + ' при n = 2 (точно — 7/8) и убывает к 1 − 1/e ≈ 63 %. Примерно треть больших игр не имеет чистого равновесия вовсе — отсюда блок 2.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 6. Зоопарк игр 2×2: плоскость T–S
   * ============================================================================== */
  function tsType(T, Sx) {
    if (T > 1 && Sx < 0) return { key: 'pd', name: 'дилемма заключённого' };
    if (T > 1 && Sx >= 0) return { key: 'hd', name: 'ястреб и голубь' };
    if (T <= 1 && Sx < 0) return { key: 'stag', name: 'охота на оленя' };
    return { key: 'harm', name: 'гармония' };
  }
  GBC.widget('ts-plane', (el) => {
    const s = { T: 1.5, S: -0.5 };
    const w = ui.shell(el, { title: 'Четыре мира симметричных игр 2×2', sub: 'Сотрудничество вдвоём даёт каждому R = 1, взаимное предательство P = 0. Тащите точку: T — «соблазн», выигрыш предавшего сотрудничающего; S — выигрыш того, кого предали. От знаков T − 1 и S зависит, какая получится игра.' });
    const tSl = ui.slider(w.controls, { label: 'T (соблазн)', min: 0, max: 2, step: 0.05, value: s.T, onInput: (v) => ((s.T = v), draw()) });
    const sSl = ui.slider(w.controls, { label: 'S (выигрыш «простака»)', min: -1, max: 1, step: 0.05, value: s.S, onInput: (v) => ((s.S = v), draw()) });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const plot = new GBC.Plot(w.main, {
      height: 320,
      x: { label: 'T — соблазн предать', domain: [0, 2] },
      y: { label: 'S — выигрыш преданного', domain: [-1, 1] },
      onClick: (x, y) => set(x, y),
    });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'type', label: 'тип игры' }, { key: 'ne', label: 'равновесия' }, { key: 'coop', label: 'сотрудничество в устойчивом исходе' }]);
    const set = (x, y) => {
      s.T = Math.round(U.clamp(x, 0, 2) * 20) / 20;
      s.S = Math.round(U.clamp(y, -1, 1) * 20) / 20;
      tSl.set(s.T);
      sSl.set(s.S);
      draw();
    };
    w.pythonAction(() => `import numpy as np

R, S, T, P = 1.0, ${pyNum(s.S)}, ${pyNum(s.T)}, 0.0
A = np.array([[R, S], [T, P]])     # строки: сотрудничать, предать
B = A.T
ne = [(i, j) for i in range(2) for j in range(2) if A[i, j] == A[:, j].max() and B[i, j] == B[i, :].max()]
print("чистые равновесия (0 — сотрудничать, 1 — предать):", ne)
den = S + T - 1                    # смешанное: соперник безразличен, p·R + (1 − p)·S = p·T + (1 − p)·P
if den != 0 and 0 < S / den < 1:
    print("смешанное равновесие: P(сотрудничать) =", round(S / den, 4))
kind = ("дилемма заключённого" if T > 1 and S < 0 else "ястреб и голубь" if T > 1 else
        "охота на оленя" if S < 0 else "гармония")
print("тип:", kind)`);
    function draw() {
      const { T } = s;
      const Sx = s.S;
      const A = [[1, Sx], [T, 0]];
      const B = transpose(A);
      const ty = tsType(T, Sx);
      const ne = pureNE(A, B);
      const mx = mixed2(A, B);
      tbl.textContent = '';
      gameTable(tbl, { A, B, rows: ['сотр.', 'предать'], cols: ['сотр.', 'предать'] }, { ne: true, br1: true, br2: true, fmtv: (v) => minus(U.fmt(v, 2)) });
      plot.render([
        { type: 'rect', x0: 1, x1: 2, y0: -1, y1: 0, fill: 'red', opacity: 0.1 },
        { type: 'rect', x0: 1, x1: 2, y0: 0, y1: 1, fill: 'yellow', opacity: 0.12 },
        { type: 'rect', x0: 0, x1: 1, y0: -1, y1: 0, fill: 'aqua', opacity: 0.1 },
        { type: 'rect', x0: 0, x1: 1, y0: 0, y1: 1, fill: 'green', opacity: 0.1 },
        { type: 'vline', x: 1, color: 'axis', width: 1.2 },
        { type: 'hline', y: 0, color: 'axis', width: 1.2 },
        { type: 'text', items: [{ x: 1.5, y: -0.82, text: 'дилемма заключённого', anchor: 'middle', bold: true }, { x: 1.5, y: 0.82, text: 'ястреб и голубь', anchor: 'middle', bold: true }, { x: 0.5, y: -0.82, text: 'охота на оленя', anchor: 'middle', bold: true }, { x: 0.5, y: 0.82, text: 'гармония', anchor: 'middle', bold: true }] },
        { type: 'points', x: [s.T], y: [s.S], r: 8, color: 'model', draggable: true, onDrag: (i, x, y) => set(x, y), tooltip: () => [{ label: 'T', value: f2(s.T) }, { label: 'S', value: f2(s.S) }] },
      ]);
      const neStr = ne.map(([i, j]) => ['С', 'П'][i] + '/' + ['С', 'П'][j]);
      if (mx) neStr.push('смешанное p = ' + f2(mx.p));
      let coop;
      if (ty.key === 'pd') coop = '0 %: все предают';
      else if (ty.key === 'harm') coop = '100 %';
      else if (ty.key === 'hd') coop = mx ? pct(mx.p, 0) + ' (смешанное)' : '—';
      else coop = '100 % или 0 %';
      st.set('type', ty.name);
      st.set('ne', neStr.join('; ') || 'нет');
      st.set('coop', coop);
      const texts = {
        pd: '<b>Дилемма заключённого</b> (T > 1, S < 0): предать выгодно и против сотрудничающего (T > R), и против предателя (P > S). Единственное равновесие — взаимное предательство, хотя (R, R) лучше для обоих.',
        hd: '<b>Ястреб и голубь</b> (T > 1, S > 0): предавать выгодно против сотрудничающего, а против предателя лучше уступить. Два асимметричных равновесия и смешанное, в котором доля сотрудничающих S/(S + T − 1). В популяции именно эта доля устойчива (шаг 25).',
        stag: '<b>Охота на оленя</b> (T < 1, S < 0): сотрудничать выгодно, только если сотрудничает и другой. Два равновесия — «все сотрудничают» и «все предают»; какое случится, решает доверие. Смешанное равновесие неустойчиво: это граница между двумя мирами.',
        harm: '<b>Гармония</b> (T < 1, S > 0): сотрудничать выгодно всегда, конфликта интересов нет.',
      };
      note.innerHTML = texts[ty.key] + ' Все симметричные игры 2×2 с R > P делятся этими двумя линиями на четыре типа; виджет шага 1 узнаёт их по неравенствам между R, S, T и P.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 7. Равновесие против оптимума: парадокс Браеса и цена анархии
   * ============================================================================== */
  /** Равновесие в сети Браеса: x — по S→A→E, y — по S→B→E, z — по перемычке S→A→B→E. */
  function braessEq(N, shortcut) {
    if (!shortcut) return { x: N / 2, y: N / 2, z: 0, t: N / 200 + 45 };
    if (N <= 4500) return { x: 0, y: 0, z: N, t: N / 50 };
    if (N <= 9000) return { x: N - 4500, y: N - 4500, z: 9000 - N, t: 90 };
    return { x: N / 2, y: N / 2, z: 0, t: N / 200 + 45 };
  }
  function braessOpt(N) {
    const x = U.clamp(N - 2250, 0, N / 2);
    const z = N - 2 * x;
    const cost = (2 * (N - x) * (N - x)) / 100 + 90 * x;
    return { x, y: x, z, t: cost / N };
  }
  GBC.widget('braess', (el) => {
    const s = { mode: 'braess', N: 4000, sc: true, d: 1 };
    const w = ui.shell(el, { title: 'Эгоистичные маршруты: парадокс Браеса и цена анархии', sub: 'Каждый водитель выбирает самый быстрый для себя путь. Время на дорогах «T/100» растёт с числом машин T, на дорогах «45» — всегда 45 минут. Включите перемычку A → B нулевой длины.' });
    ui.segmented(w.controls, { label: 'Сеть', value: s.mode, options: [{ value: 'braess', label: 'Браес' }, { value: 'pigou', label: 'Пигу' }], onChange: (v) => ((s.mode = v), draw()) });
    const nSl = ui.slider(w.controls, { label: 'Водителей N', min: 500, max: 10000, step: 100, value: s.N, format: String, onInput: (v) => ((s.N = v), draw()) });
    const scT = ui.toggle(w.controls, { label: 'перемычка A → B', checked: s.sc, onChange: (v) => ((s.sc = v), draw()) });
    const dSl = ui.slider(w.controls, { label: 'Степень d загруженной дороги', min: 1, max: 10, step: 1, value: s.d, format: String, onInput: (v) => ((s.d = v), draw()) });
    const svgHost = H('div');
    w.main.appendChild(svgHost);
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: '' }, y: { label: '' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'eq', label: 'время в равновесии' }, { key: 'opt', label: 'лучшее возможное' }, { key: 'poa', label: 'цена анархии' }]);
    w.pythonAction(() => (s.mode === 'braess'
      ? `import numpy as np

N, shortcut = ${s.N}, ${s.sc ? 'True' : 'False'}
def times(x, y, z):          # x: S→A→E, y: S→B→E, z: S→A→B→E (перемычка)
    sa, be = (x + z) / 100, (y + z) / 100
    return sa + 45, 45 + be, sa + be

# равновесие ищем «динамикой»: по 1 машине переходят на самый быстрый путь
flows = np.array([N / 2, N / 2, 0.0])
for _ in range(200000):
    t = np.array(times(*flows))
    if not shortcut:
        t[2] = np.inf
    used = flows > 0.5
    worst, best = np.argmax(np.where(used, t, -np.inf)), np.argmin(t)
    if t[worst] - t[best] < 1e-9:
        break
    step = min(flows[worst], max(1.0, (t[worst] - t[best]) * 25))
    flows[worst] -= step
    flows[best] += step
t = times(*flows)
print("потоки (x, y, z):", flows.round(1), " времена путей:", np.round(t, 2))
# социальный оптимум (симметрия x = y): перебор
best = min(((2 * x + 0.0, x) for x in np.arange(0, N / 2 + 1, 1.0)),
           key=lambda c: (2 * c[1] * ((N - c[1]) / 100 + 45) + (N - 2 * c[1]) * 2 * (N - c[1]) / 100))
x = best[1]
opt = (2 * x * ((N - x) / 100 + 45) + (N - 2 * x) * 2 * (N - x) / 100) / N
print("среднее время: без перемычки", N / 200 + 45, ", оптимум с перемычкой", round(opt, 2))`
      : `import numpy as np

d = ${s.d}               # время на загруженной дороге x**d (x — доля машин), на другой — всегда 1
x = np.linspace(0, 1, 100001)
avg = x * x**d + (1 - x) * 1.0
k = avg.argmin()
print(f"равновесие: все на загруженной дороге, среднее время 1.0")
print(f"оптимум: доля {x[k]:.4f} (формула {(d + 1) ** (-1 / d):.4f}), среднее {avg[k]:.4f}")
print(f"цена анархии: {1 / avg[k]:.4f}  (при d = 1 — 4/3)")`));
    function edge(g, x1, y1, x2, y2, flow, label, on = true) {
      const wdt = on ? 1.5 + (7 * flow) / Math.max(1, s.N) : 1.5;
      g.appendChild(S('line', { x1, y1, x2, y2, style: 'stroke:' + (on ? 'var(--c-model)' : 'var(--border-strong)') + ';stroke-width:' + wdt + ';stroke-linecap:round' + (on ? '' : ';stroke-dasharray:6 6') }));
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      g.appendChild(sText(mx, my - 14, label, { size: 12, color: 'var(--ink-2)' }));
      if (on) g.appendChild(sText(mx, my + 14, Math.round(flow) + ' маш.', { size: 12, bold: true }));
    }
    function draw() {
      const isB = s.mode === 'braess';
      nSl.el.style.display = isB ? '' : 'none';
      scT.el.style.display = isB ? '' : 'none';
      dSl.el.style.display = isB ? 'none' : '';
      svgHost.textContent = '';
      const svg = S('svg', { viewBox: '0 0 520 230', style: 'display:block;width:100%;height:auto;max-width:560px;min-width:380px;margin:0 auto' });
      const node = (x, y, t) => {
        svg.appendChild(S('circle', { cx: x, cy: y, r: 17, style: 'fill:var(--surface);stroke:var(--ink);stroke-width:2' }));
        svg.appendChild(sText(x, y, t, { bold: true }));
      };
      if (isB) {
        const e = braessEq(s.N, s.sc);
        const g = S('g');
        edge(g, 60, 115, 260, 30, e.x + e.z, 'T/100');
        edge(g, 260, 30, 460, 115, e.x, '45');
        edge(g, 60, 115, 260, 200, e.y, '45');
        edge(g, 260, 200, 460, 115, e.y + e.z, 'T/100');
        edge(g, 260, 30, 260, 200, e.z, '0', s.sc);
        svg.appendChild(g);
        node(60, 115, 'S');
        node(260, 30, 'A');
        node(260, 200, 'B');
        node(460, 115, 'E');
        const o = braessOpt(s.N);
        const eq = e.t;
        const opt = s.sc ? o.t : s.N / 200 + 45;
        const Ns = U.linspace(500, 10000, 191);
        plot.opts.x.label = 'водителей N';
        plot.opts.y.label = 'среднее время в пути, мин';
        plot.render([
          { type: 'vband', x0: 3000, x1: 9000, color: 'critical', opacity: 0.06 },
          { type: 'line', x: Ns, y: Ns.map((n) => n / 200 + 45), color: 'model-prev', width: 2, label: 'без перемычки' },
          { type: 'line', x: Ns, y: Ns.map((n) => braessEq(n, true).t), color: 'tree', width: 2.5, label: 'с перемычкой: равновесие' },
          { type: 'line', x: Ns, y: Ns.map((n) => braessOpt(n).t), color: 'aqua', width: 2, dash: '6 4', label: 'с перемычкой: оптимум' },
          { type: 'vline', x: s.N, color: 'ink2', width: 1, dash: '3 3' },
        ], { x: [500, 10000], y: [0, 105] });
        st.set('eq', U.fmt(eq, 1) + ' мин');
        st.set('opt', U.fmt(opt, 1) + ' мин');
        st.set('poa', U.fmt(eq / opt, 3));
        note.innerHTML = 'Без перемычки водители делятся поровну: ' + U.fmt(s.N / 200 + 45, 1) + ' мин. С перемычкой каждому выгоднее ехать S → A → B → E, пока T/100 < 45, — и все застревают на «резиновых» дорогах: ' + U.fmt(braessEq(s.N, true).t, 1) + ' мин. <b>Новая дорога сделала хуже всем</b> (при 3000 < N < 9000 — закрашенная зона), хотя никто не обязан ею пользоваться. Это <b>парадокс Браеса</b> (1968): равновесие Нэша — не оптимум. Отношение времени в равновесии к лучшему возможному называют <b>ценой анархии</b>. Похожее наблюдали в Сеуле и Нью-Йорке: закрытие улиц иногда ускоряло движение.';
      } else {
        const d = s.d;
        const xs = U.linspace(0, 1, 201);
        const avg = (x) => x * Math.pow(x, d) + (1 - x);
        const xo = Math.pow(d + 1, -1 / d);
        const co = avg(xo);
        const g = S('g');
        g.appendChild(S('path', { d: 'M60,115 Q260,-10 460,115', style: 'fill:none;stroke:var(--c-model-prev);stroke-width:3' }));
        g.appendChild(S('path', { d: 'M60,115 Q260,240 460,115', style: 'fill:none;stroke:var(--c-tree);stroke-width:5' }));
        g.appendChild(sText(260, 40, 'широкая дорога: всегда 1 час', { size: 13 }));
        g.appendChild(sText(260, 190, 'узкая дорога: x^d часа (x — доля машин)', { size: 13 }));
        svg.appendChild(g);
        node(60, 115, 'S');
        node(460, 115, 'E');
        plot.opts.x.label = 'доля машин x на узкой дороге';
        plot.opts.y.label = 'среднее время, ч';
        plot.render([
          { type: 'line', x: xs, y: xs.map(avg), color: 'model', width: 2.5, label: 'среднее время' },
          { type: 'points', x: [1], y: [1], r: 7, color: 'tree', label: 'равновесие: x = 1' },
          { type: 'points', x: [xo], y: [co], r: 7, color: 'aqua', label: 'оптимум' },
        ], { x: [0, 1], y: [0, 1.1] });
        st.set('eq', '1 ч');
        st.set('opt', U.fmt(co, 3) + ' ч');
        st.set('poa', U.fmt(1 / co, 3));
        note.innerHTML = 'Пример Пигу (1920). Узкая дорога никогда не хуже широкой (x<sup>d</sup> ≤ 1), поэтому в равновесии туда едут все, и каждый тратит 1 час. Если бы диспетчер отправил на узкую дорогу долю ' + f2(xo) + ', среднее время было бы ' + f3(co) + '. Цена анархии ' + f3(1 / co) + (d === 1 ? ' = 4/3 — и это худший случай для любых сетей с линейными задержками (Рафгарден и Тардош, 2002)' : '; с ростом крутизны d она растёт без ограничений') + '. Каждый водитель не учитывает, что сам замедляет других, — это <b>внешний эффект</b>; платные дороги и налоги «выравнивают» равновесие и оптимум.';
      }
      const box = scrollBox();
      box.appendChild(svg);
      svgHost.appendChild(box);
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 8. Непрерывные стратегии: дуополия Курно
   * ============================================================================== */
  GBC.widget('cournot', (el) => {
    const a = 100;
    const s = { c: 10, q0: [5, 75], n: 2 };
    const w = ui.shell(el, { title: 'Дуополия Курно: кривые наилучших ответов', sub: 'Две фирмы выбирают объём выпуска q₁, q₂; цена P = 100 − q₁ − q₂, издержки c за единицу. Синяя кривая — лучший ответ фирмы 1 на q₂, оранжевая — фирмы 2 на q₁. Щёлкните по графику — фирмы начнут по очереди отвечать друг другу.' });
    ui.slider(w.controls, { label: 'Издержки c', min: 0, max: 60, step: 5, value: s.c, format: String, onInput: (v) => ((s.c = v), draw()) });
    ui.slider(w.controls, { label: 'Фирм на рынке (нижний график)', min: 1, max: 10, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const cbox = H('div', { style: 'max-width:440px;margin:0 auto' });
    w.main.appendChild(cbox);
    const plot = new GBC.Plot(cbox, { height: 330, equal: true, x: { label: 'q₁ — выпуск фирмы 1' }, y: { label: 'q₂ — выпуск фирмы 2' }, onClick: (x, y) => ((s.q0 = [Math.max(0, x), Math.max(0, y)]), draw()) });
    const plot2 = new GBC.Plot(w.main, { height: 190, x: { label: 'число фирм n', domain: [0.4, 10.6], ticks: U.range(10, 1) }, y: { label: 'цена в равновесии' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ne', label: 'равновесие: q каждой, цена' }, { key: 'pr', label: 'прибыль: равновесие / сговор' }, { key: 'dev', label: 'нарушить сговор' }]);
    w.pythonAction(() => `a, c = ${a}, ${s.c}
br = lambda q_other: max(0.0, (a - c - q_other) / 2)    # максимум (a − q − q_other − c)·q
q1, q2 = ${pyNum(+s.q0[0].toFixed(2))}, ${pyNum(+s.q0[1].toFixed(2))}
for t in range(8):                                      # по очереди отвечают друг другу
    q1 = br(q2)
    q2 = br(q1)
    print(f"раунд {t + 1}: q1 = {q1:.3f}, q2 = {q2:.3f}")
q = (a - c) / 3
print("равновесие Курно:", q, " цена", a - 2 * q, " прибыль", (a - 2 * q - c) * q)
qm = (a - c) / 4                                        # сговор: делят монопольный выпуск
print("сговор:", qm, " прибыль", (a - 2 * qm - c) * qm)
qd = br(qm)
print("нарушитель сговора:", qd, " прибыль", (a - qd - qm - c) * qd)
for n in range(1, 11):
    print(f"n = {n:2}: цена {(a + n * c) / (n + 1):.2f}")`);
    function draw() {
      const { c } = s;
      const K = a - c;
      const br = (qo) => Math.max(0, (K - qo) / 2);
      const qs = U.linspace(0, K, 101);
      const path = { x: [s.q0[0]], y: [s.q0[1]] };
      let [q1, q2] = s.q0;
      for (let t = 0; t < 8; t++) {
        q1 = br(q2);
        path.x.push(q1);
        path.y.push(q2);
        q2 = br(q1);
        path.x.push(q1);
        path.y.push(q2);
      }
      const qn = K / 3;
      const qm = K / 4;
      const profit = (qa, qb) => (a - qa - qb - c) * qa;
      const qd = br(qm);
      plot.render([
        { type: 'line', x: qs.map(br), y: qs, color: 'blue', width: 2.5, label: 'ответ фирмы 1: q₁(q₂)' },
        { type: 'line', x: qs, y: qs.map(br), color: 'orange', width: 2.5, label: 'ответ фирмы 2: q₂(q₁)' },
        { type: 'line', x: [0, K / 2], y: [K / 2, 0], color: 'aqua', width: 1.8, dash: '6 4', label: 'сговор: q₁ + q₂ = монопольный выпуск' },
        { type: 'line', x: path.x, y: path.y, color: 'ink2', width: 1.4, label: 'ответы по очереди', hover: false },
        { type: 'points', x: [s.q0[0]], y: [s.q0[1]], r: 5, color: 'ink2' },
        { type: 'points', x: [qn], y: [qn], r: 8, color: 'ink', hollow: true, label: 'равновесие Курно' },
        { type: 'points', x: [qm], y: [qm], r: 6, color: 'aqua' },
      ], { x: [0, K], y: [0, K] });
      const ns = U.range(10, 1);
      plot2.render([
        { type: 'bars', x: ns, y: ns.map((n) => (a + n * c) / (n + 1)), color: (i) => (i + 1 === s.n ? 'tree' : 'model'), width: 0.6, maxPx: 30, tooltip: (i) => [{ label: 'цена при n = ' + (i + 1), value: f2((a + (i + 1) * c) / (i + 2)) }] },
        { type: 'hline', y: c, color: 'ink2', dash: '5 4', width: 1.5, label: 'издержки c' },
      ], { y: [0, a] });
      st.set('ne', U.fmt(qn, 2) + ', цена ' + U.fmt(a - 2 * qn, 2));
      st.set('pr', U.fmt(profit(qn, qn), 1) + ' / ' + U.fmt(profit(qm, qm), 1));
      st.set('dev', 'q = ' + U.fmt(qd, 2) + ' → ' + U.fmt(profit(qd, qm), 1));
      note.innerHTML = 'Стратегии бывают и непрерывными. Прибыль фирмы 1 равна (100 − q₁ − q₂ − c)·q₁; приравняв производную по q₁ к нулю (урок 15.5), получаем лучший ответ q₁ = (100 − c − q₂)/2. Равновесие — пересечение кривых: q₁ = q₂ = (100 − c)/3 = ' + U.fmt(qn, 2) + '. Ответы по очереди сходятся к нему из любой стартовой точки: это сжимающее отображение (наклон ½). Если бы фирмы договорились делить монопольный выпуск, каждая получала бы ' + U.fmt(profit(qm, qm), 1) + ' вместо ' + U.fmt(profit(qn, qn), 1) + ', но каждой выгодно нарушить сговор и выпустить ' + U.fmt(qd, 2) + ' (прибыль ' + U.fmt(profit(qd, qm), 1) + ') — снова дилемма заключённого. С ростом числа фирм цена (100 + n·c)/(n + 1) падает к издержкам c — конкуренция работает.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 9. Пенальти: зачем быть непредсказуемым
   * ============================================================================== */
  const PEN = { A: [[0.583, 0.9497], [0.9291, 0.6992]], rows: ['в «свой» угол', 'в другой угол'], cols: ['вратарь: «свой» угол', 'вратарь: другой'] };
  GBC.widget('penalty', (el) => {
    const s = { p: 0.7 };
    const w = ui.shell(el, { title: 'Пенальти: чем грозит предсказуемость', sub: 'Вероятности гола по 1417 пенальти европейских лиг (Паласиос-Уэрта, 2003). «Свой» угол — естественный для бьющего (левый у правши). Бьющий выбирает долю ударов p в свой угол; вратарь, изучив его статистику, прыгает туда, где гол вероятнее отразить.' });
    ui.slider(w.controls, { label: 'p — доля ударов в «свой» угол', min: 0, max: 1, step: 0.01, value: s.p, onInput: (v) => ((s.p = v), draw()) });
    const tbl = H('div');
    w.main.appendChild(tbl);
    gameTable(tbl, { A: PEN.A, rows: ['свой угол', 'другой'], cols: ['вр. свой', 'вр. другой'] }, { fmtv: (v) => pct(v, 2), corner: 'бьющий ↓' });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'p — доля ударов в «свой» угол', domain: [0, 1] }, y: { label: 'вероятность гола', domain: [0.55, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'шанс гола против знающего вратаря' }, { key: 'ps', label: 'оптимальное p*' }, { key: 'v', label: 'цена игры v' }]);
    const M = PEN.A;
    const den = M[0][0] - M[0][1] - M[1][0] + M[1][1];
    const pS = (M[1][1] - M[1][0]) / den;
    const qS = (M[1][1] - M[0][1]) / den;
    const v = pS * M[0][0] + (1 - pS) * M[1][0];
    w.pythonAction(() => `import numpy as np

M = np.array(${pyMat(M)})    # вероятность гола: строки — удар, столбцы — прыжок вратаря
p = ${pyNum(s.p)}
goal = p * M[0] + (1 - p) * M[1]           # против каждого прыжка вратаря
print("гол против прыжка в свой / другой угол:", goal.round(4), " гарантия:", goal.min().round(4))
den = M[0, 0] - M[0, 1] - M[1, 0] + M[1, 1]
p_star = (M[1, 1] - M[1, 0]) / den          # вратарю всё равно, куда прыгать
q_star = (M[1, 1] - M[0, 1]) / den          # бьющему всё равно, куда бить
print(f"p* = {p_star:.4f}, q* = {q_star:.4f}, цена игры v = {p_star * M[0, 0] + (1 - p_star) * M[1, 0]:.4f}")`);
    function draw() {
      const xs = U.linspace(0, 1, 101);
      const gL = (p) => p * M[0][0] + (1 - p) * M[1][0];
      const gR = (p) => p * M[0][1] + (1 - p) * M[1][1];
      const env = (p) => Math.min(gL(p), gR(p));
      plot.render([
        { type: 'line', x: xs, y: xs.map(gL), color: 'blue', width: 1.8, label: 'вратарь прыгает в «свой» угол' },
        { type: 'line', x: xs, y: xs.map(gR), color: 'aqua', width: 1.8, label: 'вратарь прыгает в другой' },
        { type: 'line', x: xs, y: xs.map(env), color: 'tree', width: 3.5, label: 'гарантия бьющего' },
        { type: 'vline', x: s.p, color: 'ink2', dash: '4 4', width: 1 },
        { type: 'points', x: [pS], y: [v], r: 7, color: 'tree', hollow: true, label: 'оптимум p*' },
        { type: 'points', x: [s.p], y: [env(s.p)], r: 6, color: 'model' },
      ]);
      const reply = gL(s.p) < gR(s.p) ? 'в «свой» угол' : 'в другой угол';
      st.set('g', pct(env(s.p)) + ' (вратарь: ' + reply + ')');
      st.set('ps', pct(pS));
      st.set('v', pct(v));
      note.innerHTML = 'Бить всегда в «свой» угол (p = 1) — значит дать вратарю 100 % подсказку: шанс гола упадёт до ' + pct(M[0][0]) + '. Всегда в другой — ' + pct(M[1][1]) + '. Лучшая <b>гарантия</b> — на пересечении прямых: p* = ' + pct(pS) + ', шанс ' + pct(v) + ' при любом поведении вратаря. При этом вратарю оптимально прыгать в «свой» угол бьющего с вероятностью q* = ' + pct(qS) + '. В данных реальные частоты оказались очень близки к этим числам, а последовательные удары одного игрока — почти независимыми: профессионалы действительно «играют минимакс». <b>Смешанная стратегия</b> — не неуверенность, а способ не дать себя прочитать.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 10. Принцип безразличия
   * ============================================================================== */
  const IND = { mp: G2.mp, bos: G2.bos, stag: G2.stag, hd: G2.hd, pen: { label: 'Пенальти', rows: ['свой', 'другой'], cols: ['вр. свой', 'вр. другой'], A: PEN.A, B: neg(PEN.A) } };
  GBC.widget('indifference', (el) => {
    const s = { g: 'bos', p: 0.5, q: 0.5, bonus: 0 };
    const w = ui.shell(el, { title: 'Принцип безразличия: кто кого делает безразличным', sub: 'Верхний график — ожидаемый выигрыш игрока 2 от каждого его хода при вероятности p первой строки; нижний — то же для игрока 1 при вероятности q. Равновесная вероятность — там, где прямые пересекаются.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: Object.keys(IND).map((k) => ({ value: k, label: IND[k].label })), onChange: (v) => ((s.g = v), draw()) });
    ui.slider(w.controls, { label: 'p (игрок 1, строка 1)', min: 0, max: 1, step: 0.01, value: s.p, onInput: (v) => ((s.p = v), draw()) });
    ui.slider(w.controls, { label: 'q (игрок 2, столбец 1)', min: 0, max: 1, step: 0.01, value: s.q, onInput: (v) => ((s.q = v), draw()) });
    ui.slider(w.controls, { label: 'Бонус игроку 1 в клетке (1, 1)', min: -3, max: 3, step: 0.5, value: s.bonus, format: (v) => (v > 0 ? '+' : '') + minus(String(v)), onInput: (v) => ((s.bonus = v), draw()) });
    const tbl = H('div');
    const tex = H('div', { style: 'overflow-x:auto;margin:2px 0 6px' });
    w.main.append(tbl, tex);
    const plot2 = new GBC.Plot(w.main, { height: 190, x: { label: 'p — вероятность строки 1 у игрока 1', domain: [0, 1] }, y: { label: 'выигрыш игрока 2' } });
    const plot1 = new GBC.Plot(w.main, { height: 190, x: { label: 'q — вероятность столбца 1 у игрока 2', domain: [0, 1] }, y: { label: 'выигрыш игрока 1' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'p* (делает безразличным игрока 2)' }, { key: 'q', label: 'q* (делает безразличным игрока 1)' }, { key: 'u', label: 'выигрыши в равновесии' }]);
    const game = () => {
      const g = IND[s.g];
      const A = clone(g.A);
      A[0][0] += s.bonus;
      return { ...g, A };
    };
    w.pythonAction(() => {
      const g = game();
      return `from fractions import Fraction as F

A = [[F(${g.A[0][0]}), F(${g.A[0][1]})], [F(${g.A[1][0]}), F(${g.A[1][1]})]]   # игрок 1 (с бонусом)
B = [[F(${g.B[0][0]}), F(${g.B[0][1]})], [F(${g.B[1][0]}), F(${g.B[1][1]})]]   # игрок 2
# p — вероятность строки 1: игрок 2 безразличен p·B11 + (1 − p)·B21 = p·B12 + (1 − p)·B22
p = (B[1][1] - B[1][0]) / (B[0][0] - B[1][0] - B[0][1] + B[1][1])
# q — вероятность столбца 1: игрок 1 безразличен q·A11 + (1 − q)·A12 = q·A21 + (1 − q)·A22
q = (A[1][1] - A[0][1]) / (A[0][0] - A[0][1] - A[1][0] + A[1][1])
u1 = q * A[0][0] + (1 - q) * A[0][1]
u2 = p * B[0][0] + (1 - p) * B[1][0]
print("p* =", p, " q* =", q, " выигрыши:", float(u1), float(u2))
print("в (0, 1) ли:", 0 < p < 1 and 0 < q < 1)`;
    });
    function draw() {
      const g = game();
      const { A, B } = g;
      tbl.textContent = '';
      gameTable(tbl, g, { ne: true, br1: true, br2: true, fmtv: (v) => minus(U.fmt(v, 3)) });
      const xs = [0, 1];
      const c1 = (p) => p * B[0][0] + (1 - p) * B[1][0];
      const c2 = (p) => p * B[0][1] + (1 - p) * B[1][1];
      const r1 = (q) => q * A[0][0] + (1 - q) * A[0][1];
      const r2 = (q) => q * A[1][0] + (1 - q) * A[1][1];
      const dp = B[0][0] - B[1][0] - B[0][1] + B[1][1];
      const dq = A[0][0] - A[0][1] - A[1][0] + A[1][1];
      const pS = Math.abs(dp) > EPS ? (B[1][1] - B[1][0]) / dp : NaN;
      const qS = Math.abs(dq) > EPS ? (A[1][1] - A[0][1]) / dq : NaN;
      const inP = pS > 0 && pS < 1;
      const inQ = qS > 0 && qS < 1;
      plot2.render([
        { type: 'line', x: xs, y: xs.map(c1), color: 'orange', width: 2.5, label: '«' + g.cols[0] + '»' },
        { type: 'line', x: xs, y: xs.map(c2), color: 'yellow', width: 2.5, dash: '7 4', label: '«' + g.cols[1] + '»' },
        { type: 'vline', x: s.p, color: 'ink2', dash: '3 3', width: 1 },
        inP ? { type: 'points', x: [pS], y: [c1(pS)], r: 7, hollow: true, color: 'ink', label: 'p*: безразлично' } : { type: 'points', x: [], y: [] },
      ]);
      plot1.render([
        { type: 'line', x: xs, y: xs.map(r1), color: 'blue', width: 2.5, label: '«' + g.rows[0] + '»' },
        { type: 'line', x: xs, y: xs.map(r2), color: 'aqua', width: 2.5, dash: '7 4', label: '«' + g.rows[1] + '»' },
        { type: 'vline', x: s.q, color: 'ink2', dash: '3 3', width: 1 },
        inQ ? { type: 'points', x: [qS], y: [r1(qS)], r: 7, hollow: true, color: 'ink', label: 'q*: безразлично' } : { type: 'points', x: [], y: [] },
      ]);
      const n = (v) => (Number.isInteger(v) ? String(v) : U.fmt(v, 3)).replace('-', '−');
      texInto(tex, String.raw`p\cdot ${n(B[0][0])} + (1-p)\cdot ${n(B[1][0])} \;=\; p\cdot ${n(B[0][1])} + (1-p)\cdot ${n(B[1][1])} \;\Rightarrow\; p^* = ` + (Number.isFinite(pS) ? frac(pS).replace('−', '-') : String.raw`\text{нет}`), true);
      st.set('p', Number.isFinite(pS) ? frac(pS) + (inP ? '' : ' (вне [0, 1])') : '—');
      st.set('q', Number.isFinite(qS) ? frac(qS) + (inQ ? '' : ' (вне [0, 1])') : '—');
      st.set('u', inP && inQ ? f3(r1(qS)) + ' и ' + f3(c1(pS)) : '—');
      const b2 = c1(s.p) > c2(s.p) + EPS ? '«' + g.cols[0] + '»' : c2(s.p) > c1(s.p) + EPS ? '«' + g.cols[1] + '»' : 'любой ход';
      note.innerHTML = 'При вашем p игроку 2 выгоднее ' + b2 + '. Если бы одному ходу соперника было выгоднее, он играл бы его <b>наверняка</b> — и смешивать вам было бы незачем. Поэтому в смешанном равновесии каждый подбирает свои вероятности так, чтобы <b>соперник стал безразличен</b>. Отсюда парадокс: p* находится из выигрышей <em>игрока 2</em>. Двигайте бонус игроку 1 — p* не меняется, а меняется q*: если игроку 1 стало выгоднее «' + g.rows[0] + '», то это компенсирует <em>соперник</em>, реже выбирая «' + g.cols[0] + '». В равновесии выигрыш игрока 1 одинаков от обеих строк — и равен ' + (inQ ? f3(r1(qS)) : '—') + '.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 11. Кривые наилучших ответов и число равновесий
   * ============================================================================== */
  function brPieces(a, b) {
    if (Math.abs(b) < 1e-12) return { pieces: [[0, 1, a > 0 ? 1 : a < 0 ? 0 : 0.5]], star: null, flat: Math.abs(a) < 1e-12 };
    const t = -a / b;
    if (t <= 0 || t >= 1) return { pieces: [[0, 1, a + b * 0.5 > 0 ? 1 : 0]], star: null };
    return { pieces: [[0, t, a > 0 ? 1 : 0], [t, 1, a + b > 0 ? 1 : 0]], star: t };
  }
  GBC.widget('br-curves', (el) => {
    const s = { g: 'bos', p: 0.3, q: 0.7 };
    const w = ui.shell(el, { title: 'Кривые наилучших ответов: равновесия — их пересечения', sub: 'По горизонтали p — вероятность строки 1 у игрока 1, по вертикали q — столбца 1 у игрока 2. Оранжевая ломаная — лучший ответ игрока 2 на p, синяя — игрока 1 на q. Каждое пересечение — равновесие Нэша.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: g2Options(['mp', 'bos', 'stag', 'hd', 'coord', 'pd']), onChange: (v) => ((s.g = v), draw()) });
    ui.slider(w.controls, { label: 'p (игрок 1)', min: 0, max: 1, step: 0.01, value: s.p, onInput: (v) => ((s.p = v), draw()) });
    ui.slider(w.controls, { label: 'q (игрок 2)', min: 0, max: 1, step: 0.01, value: s.q, onInput: (v) => ((s.q = v), draw()) });
    const box = H('div', { style: 'max-width:440px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 330, equal: true, x: { label: 'p', domain: [-0.04, 1.04] }, y: { label: 'q', domain: [-0.04, 1.04] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'всего равновесий' }, { key: 'list', label: 'равновесия (p, q)' }, { key: 'u', label: 'выигрыши при текущих (p, q)' }]);
    w.pythonAction(() => {
      const g = G2[s.g];
      return `import numpy as np

A = np.array(${pyMat(g.A)}, float)
B = np.array(${pyMat(g.B)}, float)
# лучший ответ игрока 2 на p: сравниваем выигрыш столбцов; игрока 1 на q — строк
def br2(p):
    d = p * (B[0, 0] - B[0, 1]) + (1 - p) * (B[1, 0] - B[1, 1])
    return 1.0 if d > 0 else 0.0 if d < 0 else None   # None — любое q
def br1(q):
    d = q * (A[0, 0] - A[1, 0]) + (1 - q) * (A[0, 1] - A[1, 1])
    return 1.0 if d > 0 else 0.0 if d < 0 else None
eq = [(p, q) for p in (0.0, 1.0) for q in (0.0, 1.0) if br2(p) == q and br1(q) == p]
dp = B[0, 0] - B[1, 0] - B[0, 1] + B[1, 1]
dq = A[0, 0] - A[0, 1] - A[1, 0] + A[1, 1]
if dp and dq:
    p, q = (B[1, 1] - B[1, 0]) / dp, (A[1, 1] - A[0, 1]) / dq
    if 0 < p < 1 and 0 < q < 1:
        eq.append((round(p, 4), round(q, 4)))
print("равновесия (p, q):", eq, " всего:", len(eq))`;
    });
    function draw() {
      const g = G2[s.g];
      const { A, B } = g;
      const b2 = brPieces(B[1][0] - B[1][1], B[0][0] - B[1][0] - B[0][1] + B[1][1]);
      const b1 = brPieces(A[0][1] - A[1][1], A[0][0] - A[0][1] - A[1][0] + A[1][1]);
      const path = (pieces, swap) => {
        const xs = [];
        const ys = [];
        pieces.forEach(([t0, t1, r], k) => {
          if (k > 0) {
            xs.push(swap ? r : t0);
            ys.push(swap ? t0 : r);
          }
          xs.push(swap ? r : t0, swap ? r : t1);
          ys.push(swap ? t0 : r, swap ? t1 : r);
        });
        return { x: xs, y: ys };
      };
      const ne = allNE2(A, B);
      plot.render([
        { type: 'rect', x0: 0, x1: 1, y0: 0, y1: 1, stroke: 'axis', width: 1 },
        { type: 'line', ...path(b2.pieces, false), color: 'orange', width: 3.5, label: 'ответ игрока 2: q(p)', hover: false },
        { type: 'line', ...path(b1.pieces, true), color: 'blue', width: 3, dash: '7 4', label: 'ответ игрока 1: p(q)', hover: false },
        { type: 'points', x: ne.map((o) => o.p), y: ne.map((o) => o.q), color: 'ink', r: 8, hollow: true, label: 'равновесия', tooltip: (i) => [{ label: 'p', value: frac(ne[i].p) }, { label: 'q', value: frac(ne[i].q) }] },
        { type: 'points', x: [s.p], y: [s.q], color: 'model', r: 5, label: 'текущие (p, q)' },
      ]);
      st.set('n', String(ne.length));
      st.set('list', ne.map((o) => '(' + frac(o.p) + ', ' + frac(o.q) + ')').join(' '));
      st.set('u', f3(pay2(A, s.p, s.q)) + ' и ' + f3(pay2(B, s.p, s.q)));
      note.innerHTML = 'Пока соперник смешивает «невыгодно» для вас, ваш лучший ответ — чистая стратегия (горизонтальные и вертикальные отрезки); ровно в точке безразличия годится любое смешивание (переход ломаной). ' + g.text + ' Посчитайте равновесия во всех играх: 1, 3, 3, 3, 3, 1 — всегда <b>нечётное</b> число. Это не совпадение: в «типичной» конечной игре (без случайных равенств выигрышей) число равновесий нечётно (Уилсон, 1971). Двух равновесий почти не бывает — где два чистых, там посередине прячется смешанное.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 12. Коррелированное равновесие: светофор
   * ============================================================================== */
  GBC.widget('correlated', (el) => {
    const CH = { rows: ['дерзить', 'уступить'], cols: ['дерзить', 'уступить'], A: [[0, 7], [2, 6]], B: [[0, 2], [7, 6]] };
    const s = { x: [0, 0.5, 0.5, 0] };
    const w = ui.shell(el, { title: 'Коррелированное равновесие: игра «слабак» и светофор', sub: 'Посредник (светофор) по жребию выбирает клетку с вероятностями ниже и сообщает каждому игроку только его ход. Распределение — коррелированное равновесие, если каждому выгодно слушаться, зная лишь свою рекомендацию.' });
    const names = ['Д/Д', 'Д/У', 'У/Д', 'У/У'];
    const sls = names.map((nm, k) => ui.slider(w.controls, { label: 'вес клетки ' + nm, min: 0, max: 1, step: 0.05, value: s.x[k], onInput: (v) => ((s.x[k] = v), draw()) }));
    const pres = flexRow('margin:4px 0');
    const preset = (label, x) => ui.button(pres, { label, small: true, onClick: () => ((s.x = x.slice()), sls.forEach((sl, k) => sl.set(x[k])), draw()) });
    preset('светофор', [0, 0.5, 0.5, 0]);
    preset('по трети', [0, 1 / 3, 1 / 3, 1 / 3]);
    preset('лучшее', [0, 0.25, 0.25, 0.5]);
    preset('смешанное Нэша', [1 / 9, 2 / 9, 2 / 9, 4 / 9]);
    w.controls.appendChild(pres);
    const tbl = H('div');
    const checks = monoBox();
    w.main.append(tbl, checks);
    const box = H('div', { style: 'max-width:460px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 320, equal: true, x: { label: 'выигрыш игрока 1', domain: [-0.5, 7.5] }, y: { label: 'выигрыш игрока 2', domain: [-0.5, 7.5] } });
    const rng = new GBC.RNG(12);
    const cloud = { x: [], y: [] };
    const isCE = (x, slack) => {
      const { A, B } = CH;
      const X = [[x[0], x[1]], [x[2], x[3]]];
      for (let r = 0; r < 2; r++) {
        let g1 = 0;
        for (let j = 0; j < 2; j++) g1 += X[r][j] * (A[r][j] - A[1 - r][j]);
        slack.push(g1);
      }
      for (let c = 0; c < 2; c++) {
        let g2 = 0;
        for (let i = 0; i < 2; i++) g2 += X[i][c] * (B[i][c] - B[i][1 - c]);
        slack.push(g2);
      }
      return slack.every((v) => v >= -1e-9);
    };
    for (let t = 0; t < 6000; t++) {
      const e = U.range(4).map(() => -Math.log(1 - rng.random()));
      const z = U.sum(e);
      const x = e.map((v) => v / z);
      if (isCE(x, [])) {
        cloud.x.push(x[1] * 7 + x[2] * 2 + x[3] * 6);
        cloud.y.push(x[1] * 2 + x[2] * 7 + x[3] * 6);
      }
    }
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ce', label: 'коррелированное равновесие?' }, { key: 'u', label: 'выигрыши (1; 2)' }, { key: 'sum', label: 'сумма' }]);
    const norm = () => {
      const z = U.sum(s.x) || 1;
      return s.x.map((v) => v / z);
    };
    w.pythonAction(() => `import numpy as np
from scipy.optimize import linprog

A = np.array([[0, 7], [2, 6]])          # строки/столбцы: дерзить, уступить
B = A.T
x = np.array(${pyVec(norm().map((v) => +v.toFixed(6)))}).reshape(2, 2)   # распределение посредника
def constraints(x):
    g = [sum(x[r, j] * (A[r, j] - A[1 - r, j]) for j in range(2)) for r in range(2)]
    g += [sum(x[i, c] * (B[i, c] - B[i, 1 - c]) for i in range(2)) for c in range(2)]
    return np.array(g)                  # все ≥ 0 — слушаться выгодно
print("запасы условий:", constraints(x).round(4), " выигрыши:", (x * A).sum(), (x * B).sum())

# лучшее для суммы коррелированное равновесие — линейная программа
G = np.array([[A[0, 0] - A[1, 0], A[0, 1] - A[1, 1], 0, 0], [0, 0, A[1, 0] - A[0, 0], A[1, 1] - A[0, 1]],
              [B[0, 0] - B[0, 1], 0, B[1, 0] - B[1, 1], 0], [0, B[0, 1] - B[0, 0], 0, B[1, 1] - B[1, 0]]])
res = linprog(-(A + B).ravel(), A_ub=-G, b_ub=np.zeros(4), A_eq=[np.ones(4)], b_eq=[1], bounds=[(0, 1)] * 4)
print("лучшее распределение:", res.x.round(4), " сумма выигрышей:", -res.fun)`);
    function draw() {
      const x = norm();
      const slack = [];
      const ok = isCE(x, slack);
      tbl.textContent = '';
      gameTable(tbl, CH, { ne: true, cellBg: (i, j) => tint('var(--c-violet)', Math.round(70 * x[2 * i + j])) });
      const u1 = x[1] * 7 + x[2] * 2 + x[3] * 6;
      const u2 = x[1] * 2 + x[2] * 7 + x[3] * 6;
      const lab = ['игроку 1 сказали «дерзить»', 'игроку 1 сказали «уступить»', 'игроку 2 сказали «дерзить»', 'игроку 2 сказали «уступить»'];
      checks.textContent = slack.map((v, k) => (v >= -1e-9 ? '✓ ' : '✗ ') + lab[k] + ': выгода от послушания ' + minus(U.fmt(v, 3))).join('\n');
      plot.render([
        { type: 'polygon', x: [0, 7, 6, 2], y: [0, 2, 6, 7], fill: 'muted', opacity: 0.1, stroke: 'muted', width: 1 },
        { type: 'points', x: cloud.x, y: cloud.y, r: 2, color: 'violet', opacity: 0.35, label: 'коррелированные равновесия' },
        { type: 'points', x: [7, 2, 14 / 3], y: [2, 7, 14 / 3], r: 7, color: 'ink', hollow: true, label: 'равновесия Нэша' },
        { type: 'points', x: [u1], y: [u2], r: 7, color: ok ? 'good' : 'critical', label: 'ваше распределение' },
      ]);
      st.set('ce', ok ? 'да' : 'нет');
      st.set('u', f2(u1) + '; ' + f2(u2));
      st.set('sum', f2(u1 + u2));
      note.innerHTML = 'В игре «слабак» (Ауманн, 1974) три равновесия Нэша: (7, 2), (2, 7) и смешанное (14/3, 14/3) ≈ (4.67, 4.67), в котором с вероятностью 1/9 оба дерзят и ничего не получают. <b>Светофор</b> — половина «Д/У», половина «У/Д» — даёт по 4.5 и никогда не сталкивает игроков. Распределение «по трети» на три клетки без «Д/Д» даёт по 5: игроку, которому сказали «уступить», соперник дерзит с вероятностью ½ — слушаться выгодно. Лучшее для суммы — 5.25 каждому. <b>Коррелированное равновесие</b> — обобщение равновесия Нэша (любое равновесие Нэша — коррелированное, без связи между игроками); множество таких распределений — многогранник, его находят линейным программированием, а обучающиеся алгоритмы без «сожаления о замене» сходятся именно к нему (блок 4).';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 13. Перебор носителей: смешанные равновесия в играх 3×3
   * ============================================================================== */
  const RPSM = [[0, -1, 1], [1, 0, -1], [-1, 1, 0]];
  const SE = {
    rps: { label: 'Камень, ножницы, бумага', rows: ['камень', 'бумага', 'ножницы'], cols: ['камень', 'бумага', 'ножницы'], A: RPSM, B: neg(RPSM) },
    rps2: { label: 'КНБ: камень бьёт вдвойне', rows: ['камень', 'бумага', 'ножницы'], cols: ['камень', 'бумага', 'ножницы'], A: [[0, -1, 2], [1, 0, -1], [-2, 1, 0]], B: neg([[0, -1, 2], [1, 0, -1], [-2, 1, 0]]) },
    coord: { label: 'Координация 3×3', rows: ['A', 'B', 'C'], cols: ['A', 'B', 'C'], A: [[3, 0, 0], [0, 2, 0], [0, 0, 1]], B: [[3, 0, 0], [0, 2, 0], [0, 0, 1]] },
    rand: { label: 'Случайная игра 3×3' },
  };
  GBC.widget('support-enum', (el) => {
    const s = { g: 'rps2', seed: 3 };
    const w = ui.shell(el, { title: 'Перебор носителей: все равновесия игры 3×3', sub: 'Носитель — множество ходов, которые игрок играет с положительной вероятностью. Для каждой пары носителей решаем уравнения безразличия и проверяем: вероятности не отрицательны, а ходы вне носителя не выгоднее.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: Object.keys(SE).map((k) => ({ value: k, label: SE[k].label })), onChange: (v) => ((s.g = v), draw()) });
    const sdSl = ui.slider(w.controls, { label: 'Номер случайной игры', min: 1, max: 40, step: 1, value: s.seed, format: String, onInput: (v) => ((s.seed = v), draw()) });
    const tbl = H('div');
    const res = H('div');
    w.main.append(tbl, res);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'равновесий найдено' }, { key: 'pairs', label: 'пар носителей проверено' }, { key: 'list', label: 'равновесия: p ; q' }]);
    const game = () => {
      if (s.g !== 'rand') return SE[s.g];
      const r = randomGame(3, s.seed + 100);
      return { rows: ['a', 'b', 'c'], cols: ['1', '2', '3'], A: r.A, B: r.B };
    };
    w.pythonAction(() => {
      const g = game();
      return `import numpy as np
from itertools import combinations

A = np.array(${pyMat(g.A)}, float)
B = np.array(${pyMat(g.B)}, float)
m, n = A.shape
found = []
for k in range(1, min(m, n) + 1):
    for I in combinations(range(m), k):
        for J in combinations(range(n), k):
            # q на J делает игрока 1 безразличным между строками I: A[I, J] q_J = u; p на I — наоборот
            Mq = np.block([[A[np.ix_(I, J)], -np.ones((k, 1))], [np.ones((1, k)), np.zeros((1, 1))]])
            Mp = np.block([[B[np.ix_(I, J)].T, -np.ones((k, 1))], [np.ones((1, k)), np.zeros((1, 1))]])
            rhs = np.r_[np.zeros(k), 1]
            try:
                sq, sp = np.linalg.solve(Mq, rhs), np.linalg.solve(Mp, rhs)
            except np.linalg.LinAlgError:
                continue
            q, p = np.zeros(n), np.zeros(m)
            q[list(J)], p[list(I)] = sq[:k], sp[:k]
            if (q < -1e-9).any() or (p < -1e-9).any():
                continue
            if (A @ q > sq[k] + 1e-9).any() or (p @ B > sp[k] + 1e-9).any():
                continue
            if not any(np.allclose(p, a) and np.allclose(q, b) for a, b in found):
                found.append((p, q))
for p, q in found:
    print("p =", p.round(4), " q =", q.round(4), " выигрыши:", round(p @ A @ q, 4), round(p @ B @ q, 4))`;
    });
    function draw() {
      sdSl.el.style.display = s.g === 'rand' ? '' : 'none';
      const g = game();
      tbl.textContent = '';
      gameTable(tbl, g, { ne: true, br1: true, br2: true });
      const rows = supportEnum(g.A, g.B, g.rows, g.cols);
      const found = [];
      rows.forEach((r) => {
        if (r.ok && !found.some((f) => f.p.every((v, i) => Math.abs(v - r.p[i]) < 1e-7) && f.q.every((v, j) => Math.abs(v - r.q[j]) < 1e-7))) found.push(r);
      });
      const nm = (I, names) => '{' + I.map((i) => names[i]).join(', ') + '}';
      rowTable(res, ['носитель 1', 'носитель 2', 'p', 'q', 'итог'], rows.map((r) => [nm(r.I, g.rows), nm(r.J, g.cols), r.p ? fracVec(r.p) : '—', r.q ? fracVec(r.q) : '—', r.ok ? '★ равновесие' : r.reason]), (i) => rows[i].ok, false);
      st.set('n', String(found.length));
      st.set('pairs', String(rows.length));
      st.set('list', found.map((f) => fracVec(f.p) + ' ; ' + fracVec(f.q)).join('  '));
      const texts = {
        rps: 'Единственное равновесие — по трети на каждый ход. Любые две стратегии не годятся: третья их бьёт.',
        rps2: 'Камень теперь бьёт ножницы вдвойне, и… <b>чаще всего играют бумагу</b>, а не камень: p = (1/4; 1/2; 1/4). Равновесные вероятности подбираются так, чтобы сопернику было безразлично, — выгодный для камня исход заставляет соперника реже играть ножницы, а это делает бумагу безопасной. Цена игры по-прежнему 0.',
        coord: 'Семь равновесий: три чистых, три смешанных на парах ходов и одно на всех трёх. Чем меньше выигрыш, тем <em>чаще</em> его ход в полностью смешанном равновесии: (2/11; 3/11; 6/11) — снова безразличие.',
        rand: 'Случайная игра: равновесий нечётное число (если игра невырождена). Меняйте номер игры.',
      };
      note.innerHTML = '<b>Перебор носителей</b> (support enumeration): если носители известны, равновесие находится из линейных уравнений безразличия. Для игр m × n пар носителей экспоненциально много, поэтому на практике используют алгоритм Лемке — Хоусона или обучение (блок 4). ' + texts[s.g];
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 14. Теорема Нэша: отображение Нэша и неподвижные точки
   * ============================================================================== */
  function nashMap(A, B, p, q) {
    const r1 = q * A[0][0] + (1 - q) * A[0][1];
    const r2 = q * A[1][0] + (1 - q) * A[1][1];
    const u = p * r1 + (1 - p) * r2;
    const g1 = Math.max(0, r1 - u);
    const g2 = Math.max(0, r2 - u);
    const c1 = p * B[0][0] + (1 - p) * B[1][0];
    const c2 = p * B[0][1] + (1 - p) * B[1][1];
    const wv = q * c1 + (1 - q) * c2;
    const h1 = Math.max(0, c1 - wv);
    const h2 = Math.max(0, c2 - wv);
    return [(p + g1) / (1 + g1 + g2), (q + h1) / (1 + h1 + h2)];
  }
  GBC.widget('nash-map', (el) => {
    const s = { g: 'mp', start: [0.15, 0.85] };
    const w = ui.shell(el, { title: 'Почему равновесие всегда существует: отображение Нэша', sub: 'Каждой паре смешанных стратегий (p, q) отображение Нэша сопоставляет новую пару: вероятность хода растёт пропорционально тому, насколько он лучше текущей смеси. Стрелки — сдвиг f(p, q) − (p, q). Неподвижные точки — ровно равновесия. Щёлкните, чтобы запустить итерации.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: g2Options(['mp', 'bos', 'stag', 'hd', 'pd']), onChange: (v) => ((s.g = v), draw()) });
    const box = H('div', { style: 'max-width:440px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 330, equal: true, x: { label: 'p', domain: [-0.03, 1.03] }, y: { label: 'q', domain: [-0.03, 1.03] }, onClick: (x, y) => ((s.start = [U.clamp(x, 0, 1), U.clamp(y, 0, 1)]), draw()) });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'fix', label: 'неподвижные точки = равновесия' }, { key: 'end', label: 'после 60 итераций' }, { key: 'd', label: '|f(x) − x| в конце' }]);
    w.pythonAction(() => {
      const g = G2[s.g];
      return `import numpy as np

A = np.array(${pyMat(g.A)}, float)
B = np.array(${pyMat(g.B)}, float)
def nash_map(p, q):
    r = A @ [q, 1 - q]                     # выигрыши строк против q
    u = p * r[0] + (1 - p) * r[1]
    g = np.maximum(0, r - u)               # насколько каждая строка лучше текущей смеси
    c = np.array([p, 1 - p]) @ B
    w = q * c[0] + (1 - q) * c[1]
    h = np.maximum(0, c - w)
    return (p + g[0]) / (1 + g.sum()), (q + h[0]) / (1 + h.sum())

x = ${pyVec(s.start.map((v) => +v.toFixed(3)))}
for t in range(60):
    x = nash_map(*x)
print("после 60 итераций:", np.round(x, 4), " сдвиг:", np.abs(np.array(nash_map(*x)) - x).max())
grid = np.linspace(0, 1, 201)
d = np.array([[np.abs(np.array(nash_map(p, q)) - (p, q)).max() for p in grid] for q in grid])
j, i = np.unravel_index(d.argmin(), d.shape)
print("ближайшая к неподвижной точка сетки:", grid[i], grid[j], " |f − x| =", d[j, i])`;
    });
    function draw() {
      const g = G2[s.g];
      const { A, B } = g;
      const gr = GBC.Plot.grid((p, q) => {
        const [a, b] = nashMap(A, B, p, q);
        return Math.hypot(a - p, b - q);
      }, 0, 1, 0, 1, 81, 81);
      let mx = 0;
      for (const v of gr.values) mx = Math.max(mx, v);
      const seq = GBC.colors.sequential();
      const ar = { x1: [], y1: [], x2: [], y2: [] };
      for (let i = 0; i <= 10; i++)
        for (let j = 0; j <= 10; j++) {
          const p = i / 10;
          const q = j / 10;
          const [a, b] = nashMap(A, B, p, q);
          const L = Math.hypot(a - p, b - q);
          if (L < 1e-6) continue;
          const k = 0.07 / Math.max(L, 0.02);
          ar.x1.push(p);
          ar.y1.push(q);
          ar.x2.push(p + (a - p) * Math.min(k, 3));
          ar.y2.push(q + (b - q) * Math.min(k, 3));
        }
      const path = { x: [s.start[0]], y: [s.start[1]] };
      let x = s.start.slice();
      for (let t = 0; t < 60; t++) {
        x = nashMap(A, B, x[0], x[1]);
        path.x.push(x[0]);
        path.y.push(x[1]);
      }
      const ne = allNE2(A, B);
      plot.render([
        { type: 'heatmap', grid: gr, colorFn: (v) => seq(1 - Math.min(1, v / (0.35 * mx || 1))), opacity: 0.55 },
        { type: 'arrows', ...ar, color: 'ink2', width: 1.2, opacity: 0.7 },
        { type: 'line', x: path.x, y: path.y, color: 'tree', width: 2, label: 'итерации f' },
        { type: 'points', x: [s.start[0]], y: [s.start[1]], r: 5, color: 'tree' },
        { type: 'points', x: ne.map((o) => o.p), y: ne.map((o) => o.q), r: 8, hollow: true, color: 'ink', label: 'равновесия = неподвижные точки' },
      ]);
      const end = nashMap(A, B, x[0], x[1]);
      st.set('fix', ne.map((o) => '(' + frac(o.p) + ', ' + frac(o.q) + ')').join(' '));
      st.set('end', '(' + f3(x[0]) + ', ' + f3(x[1]) + ')');
      st.set('d', U.fmt(Math.hypot(end[0] - x[0], end[1] - x[1]), 2));
      note.innerHTML = 'Цвет показывает длину сдвига: чем насыщеннее, тем ближе точка к неподвижной. Отображение Нэша <b>непрерывно</b> и переводит квадрат стратегий (выпуклое замкнутое ограниченное множество) в себя. По <b>теореме Брауэра о неподвижной точке</b> у такого отображения есть неподвижная точка, а неподвижные точки — ровно равновесия: если какой-то ход лучше смеси, его вероятность растёт, и точка сдвигается. Так Нэш (1951) доказал, что <b>в любой конечной игре есть равновесие в смешанных стратегиях</b>. Но доказательство не даёт алгоритма: итерации f могут кружить, как в «монетках». Теорема гарантирует существование, а не способ найти; в общем случае поиск равновесия — вычислительно трудная задача (класс PPAD).';
    }
    draw();
  });

  GBC.lesson1521 = {
    f2, f3, pct, minus, frac, pyNum, pyVec, pyMat, pyStr, vecStr, fracVec, P1, P2, EPS, SER, cvar, tint, flexRow, texInto, texEl, card, cardGrid, badge, chip, rowTable, scrollBox, monoBox, svgBox, sText, svgArrow, legendRow, numField,
    transpose, neg, clone, matVec, vecMat, dot, expPay, pay2, softmax, brRows, brCols, pureNE, dom, iesds, mixed2, allNE2, solveLin, subsets, supportEnum, zeroSum, exploit, gameTable, matrixEditor, brLegend, G2, g2Options, RPSM, randomGame,
  };
})();
