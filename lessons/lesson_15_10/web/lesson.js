/* Урок 15.10: ряды. Часть 1 — ряд и его сумма, геометрический ряд, положительные ряды и признаки сходимости.
 * Виджеты: квадрат из кусочков (интуиция), частичные суммы, ε-полоса и виды расходимости, телескопические ряды,
 * ловушки скобок, доказательство «умножить на q и вычесть», геометрический ряд и его остаток, периодические дроби,
 * прыгающий мяч, ожидание через ряд Σ k·qᵏ⁻¹, бустинг одного числа, группы гармонического ряда, стопка книг,
 * признак сравнения, p-ряды, интегральные оценки, признаки Д’Аламбера и Коши, выбор признака.
 * Общие помощники (форматирование, карточки, формулы, суммы) выставлены в GBC.lesson1510 —
 * ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const R = String.raw;
  const PI = Math.PI;
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const f4 = (v) => U.fmt(v, 4);
  const f6 = (v) => U.fmt(v, 6);
  const py = (v) => U.pyNum(v);
  /** Короткая запись маленьких величин: 3.6e−5 вместо «0». */
  const sci = (v) => (!Number.isFinite(v) ? U.fmt(v) : v === 0 ? '0' : Math.abs(v) >= 0.01 && Math.abs(v) < 1e5 ? U.fmt(v, 4) : v.toExponential(2).replace(/-/g, '−').replace('e+', 'e'));
  const SUPD = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (k) => String(k).split('').map((c) => SUPD[c] || c).join('');
  /** Подписи логарифмической оси: 10⁻⁶ вместо 1e-6. */
  function powFmt(v) {
    const e = Math.round(Math.log10(v));
    if (Math.abs(v - Math.pow(10, e)) > 1e-9 * v) return U.fmt(v, 2);
    if (e >= -2 && e <= 3) return String(Number(v.toPrecision(3)));
    return '10' + sup(e);
  }
  const decades = (a, b, step = 1) => {
    const out = [];
    for (let e = a; e <= b; e += step) out.push(Math.pow(10, e));
    return out;
  };
  /** Деления логарифмической оси по диапазону значений (не больше ~7 делений). */
  function logAxis(lo, hi) {
    let a = Math.floor(Math.log10(Math.max(lo, 1e-300)));
    let b = Math.ceil(Math.log10(Math.max(hi, 1e-300)));
    if (b <= a) b = a + 1;
    const step = Math.max(1, Math.ceil((b - a) / 6));
    a = Math.floor(a / step) * step;
    b = a + Math.ceil((b - a) / step) * step;
    return { domain: [Math.pow(10, a), Math.pow(10, b)], ticks: decades(a, b, step) };
  }
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
    // сверху запас побольше: там подписи горизонтальных линий
    return [lo - pad * span, hi + Math.max(pad, 0.14) * span];
  }
  /** Частичные суммы S_start … S_{start+n−1} ряда с членами a(k). */
  function psums(a, n, start = 1) {
    const out = new Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) out[i] = acc += a(start + i);
    return out;
  }
  /** ln n! — для членов с факториалами (без переполнения). */
  const LF = [0];
  function lfact(n) {
    for (let k = LF.length; k <= n; k++) LF.push(LF[k - 1] + Math.log(k));
    return LF[n];
  }
  const fact = (n) => Math.exp(lfact(n));
  const harm = (n) => {
    let s = 0;
    for (let k = 1; k <= n; k++) s += 1 / k;
    return s;
  };
  const GAMMA = 0.5772156649015329;
  /** Отсчёты n на логарифмической оси: 1 … nMax, плотнее в начале. */
  function logGrid(nMax, per = 40) {
    const out = [];
    const steps = Math.ceil(Math.log10(nMax) * per);
    let last = 0;
    for (let i = 0; i <= steps; i++) {
      const n = Math.min(nMax, Math.round(Math.pow(10, i / per)));
      if (n > last) (out.push(n), (last = n));
    }
    if (last < nMax) out.push(nMax);
    return out;
  }
  /** Частичные суммы в точках сетки ns (ns возрастает). */
  function sumsAt(a, ns) {
    const out = [];
    let acc = 0;
    let k = 0;
    for (const n of ns) {
      while (k < n) acc += a(++k);
      out.push(acc);
    }
    return out;
  }

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
  function card(title, plain = true) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums;overflow-x:auto;overflow-y:hidden' });
    const head = plain ? 'font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px' : 'font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px';
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' }, H('div', { style: head }, title), body);
    return { el, body };
  }
  const cardGrid = (min = 200) => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(' + min + 'px,100%),1fr));gap:10px;margin:4px 0 10px' });
  function badge(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;white-space:nowrap;' + st }, text);
  }
  /** Таблица: columns — строки; rows — массивы строк. */
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  /** Список шагов решения: [[пояснение, TeX, метка?], …], показываются первые k. Метка: 'good' | 'bad' | 'skip'. */
  function stepList(box, steps, k) {
    box.textContent = '';
    steps.slice(0, k).forEach(([c, t, mark], j) => {
      const head = H('div', { style: 'font-size:.92rem;color:var(--ink-2);display:flex;gap:8px;align-items:baseline;flex-wrap:wrap' });
      if (mark) head.appendChild(badge(mark === 'good' ? 'да' : mark === 'bad' ? 'нет' : 'не помог', mark === 'good' ? 'good' : mark === 'bad' ? 'bad' : ''));
      head.appendChild(H('span', null, c));
      const li = H('li', { style: 'opacity:' + (j === k - 1 ? 1 : 0.8) }, head);
      if (t) li.appendChild(texEl(R`\displaystyle ` + t, false, 'padding:2px 0'));
      box.appendChild(li);
    });
  }
  const STARS = ['', '★', '★★', '★★★'];
  /** Склонение: plural(3, 'член', 'члена', 'членов') → 'члена'. */
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  /** Поле для ввода цифр (периодические дроби). */
  function digitInput(parent, label, value, onInput, maxLen = 6) {
    const inp = H('input', { class: 'input', type: 'text', inputmode: 'numeric', value, maxlength: String(maxLen), 'aria-label': label, autocomplete: 'off', spellcheck: 'false' });
    inp.addEventListener('input', () => {
      const clean = inp.value.replace(/\D/g, '').slice(0, maxLen);
      if (clean !== inp.value) inp.value = clean;
      onInput(clean);
    });
    parent.appendChild(H('div', { class: 'ctl' }, H('label', { class: 'ctl-label' }, label), inp));
    return inp;
  }

  /* ==============================================================================
   * Интуиция. Квадрат из кусочков: 1/2 + 1/4 + 1/8 + … = 1
   * ============================================================================== */
  GBC.widget('square-tiling', (el) => {
    const st0 = { k: 1 };
    const K = 12;
    const w = ui.shell(el, { title: 'Бесконечная сумма с конечным ответом', sub: 'Квадрат площади 1. Отрезаем половину, потом половину остатка, потом ещё половину… Нажмите ▶: кусочков бесконечно много, а все вместе они — ровно один квадрат.' });
    ui.player(w.controls, { label: 'Сколько кусочков', min: 1, max: K, value: 1, fps: 1.5, format: (k) => k + ' шт.', onChange: (k) => ((st0.k = k), draw()) });
    const box = H('div', { style: 'max-width:420px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 330, equal: true, x: { label: '', domain: [0, 1] }, y: { label: '', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'last', label: 'последний кусочек' }, { key: 'S', label: 'сумма' }, { key: 'R', label: 'осталось' }]);
    function draw() {
      const layers = [{ type: 'rect', x0: 0, x1: 1, y0: 0, y1: 1, stroke: 'axis', opacity: 0 }];
      let x0 = 0;
      let y0 = 0;
      let wdt = 1;
      let hgt = 1;
      const roles = ['blue', 'orange', 'aqua', 'violet', 'magenta', 'green'];
      for (let i = 0; i < st0.k; i++) {
        let r;
        if (i % 2 === 0) {
          r = { x0, x1: x0 + wdt / 2, y0, y1: y0 + hgt };
          x0 += wdt / 2;
          wdt /= 2;
        } else {
          r = { x0, x1: x0 + wdt, y0, y1: y0 + hgt / 2 };
          y0 += hgt / 2;
          hgt /= 2;
        }
        layers.push({ type: 'rect', ...r, fill: roles[i % roles.length], stroke: 'surface', opacity: 0.75, width: 1.5 });
        if (i < 6) layers.push({ type: 'text', items: [{ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, anchor: 'middle', dy: 4, text: '1/' + Math.pow(2, i + 1), bold: true }] });
      }
      plot.render(layers);
      const S = 1 - Math.pow(2, -st0.k);
      st.set('last', '1/' + Math.pow(2, st0.k));
      st.set('S', U.fmt(S, 6));
      st.set('R', '1/' + Math.pow(2, st0.k) + ' ≈ ' + sci(1 - S));
      note.innerHTML = (st0.k === 1 ? '½ = 0.5' : st0.k === 2 ? '½ + ¼ = 0.75' : '½ + ¼ + … + 1/' + Math.pow(2, st0.k) + ' = ' + U.fmt(S, 6)) + '. Незакрашенный уголок равен последнему кусочку: 1/' + Math.pow(2, st0.k) + '. ' + (st0.k < K ? 'Добавляйте кусочки — уголок будет уменьшаться вдвое.' : 'Уголок можно сделать меньше любого числа, поэтому <b>сумма бесконечного ряда равна 1</b>.');
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 1. Частичные суммы: члены и суммы рядом
   * ============================================================================== */
  const PS = {
    half: { label: '½ + ¼ + ⅛ + … (члены 1/2ᵏ)', tex: R`\sum_{k=1}^{\infty}\frac{1}{2^k}`, a: (k) => Math.pow(2, -k), L: 1, py: '1 / 2**k', say: 'Суммы растут и подходят к 1 — ряд сходится, его сумма 1.' },
    tele: { label: '1/(1·2) + 1/(2·3) + … (члены 1/(k(k+1)))', tex: R`\sum_{k=1}^{\infty}\frac{1}{k(k+1)}`, a: (k) => 1 / (k * (k + 1)), L: 1, py: '1 / (k * (k + 1))', say: 'Суммы равны 1/2, 2/3, 3/4, 4/5, … = n/(n + 1) → 1 (шаг 3 объяснит почему).' },
    basel: { label: '1 + ¼ + 1/9 + … (члены 1/k²)', tex: R`\sum_{k=1}^{\infty}\frac{1}{k^2}`, a: (k) => 1 / (k * k), L: (PI * PI) / 6, py: '1 / k**2', say: 'Суммы растут, но всё медленнее; предел π²/6 ≈ 1.6449 (шаг 14).' },
    alt: { label: '1 − ½ + ⅓ − ¼ + … (знаки чередуются)', tex: R`\sum_{k=1}^{\infty}\frac{(-1)^{k+1}}{k}`, a: (k) => (k % 2 ? 1 : -1) / k, L: Math.LN2, py: '(-1)**(k + 1) / k', say: 'Суммы прыгают то выше, то ниже предела ln 2 ≈ 0.6931 — «ёлочкой» (шаг 17).' },
    harm: { label: '1 + ½ + ⅓ + … (члены 1/k)', tex: R`\sum_{k=1}^{\infty}\frac{1}{k}`, a: (k) => 1 / k, L: Infinity, py: '1 / k', say: 'Члены стремятся к нулю, а суммы растут без предела, хоть и очень медленно (шаг 11).' },
    nat: { label: '1 + 2 + 3 + … (члены k)', tex: R`\sum_{k=1}^{\infty} k`, a: (k) => k, L: Infinity, py: 'k', say: 'Суммы n(n + 1)/2 растут неограниченно — ряд расходится к ∞.' },
    grandi: { label: '1 − 1 + 1 − 1 + … (ряд Гранди)', tex: R`\sum_{k=1}^{\infty}(-1)^{k+1}`, a: (k) => (k % 2 ? 1 : -1), L: NaN, py: '(-1)**(k + 1)', say: 'Суммы 1, 0, 1, 0, … никуда не подходят — предела нет, ряд расходится.' },
  };
  GBC.widget('partial-sums', (el) => {
    const s = { key: 'half', n: 6 };
    const N = 30;
    const w = ui.shell(el, { title: 'Члены и частичные суммы', sub: 'Сверху — члены ряда aₖ, снизу — частичные суммы Sₙ = a₁ + … + aₙ. Каждый новый член — это «ступенька» от Sₙ₋₁ к Sₙ. Выберите ряд и нажмите ▶.' });
    ui.select(w.controls, { label: 'Ряд', value: s.key, options: Object.entries(PS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.player(w.controls, { label: 'Сколько членов n', min: 1, max: N, value: s.n, fps: 3, format: (v) => 'n = ' + v, onChange: (v) => ((s.n = v), draw()) });
    const texBox = H('div', { style: 'margin:2px 0 6px' });
    w.main.appendChild(texBox);
    const p1 = new GBC.Plot(w.main, { height: 180, x: { label: 'номер k', domain: [0.3, N + 0.7] }, y: { label: 'член a_k' } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'n', domain: [0.3, N + 0.7] }, y: { label: 'сумма S_n' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'aₙ' }, { key: 'S', label: 'Sₙ' }, { key: 'L', label: 'сумма ряда' }]);
    function draw() {
      const P = PS[s.key];
      const ks = U.range(N, 1);
      const terms = ks.map(P.a);
      const sums = psums(P.a, N);
      const shown = (i) => i < s.n;
      p1.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'bars', x: ks, y: terms, color: (i) => (!shown(i) ? 'grid' : terms[i] >= 0 ? 'model' : 'pos'), width: 0.7, maxPx: 16, tooltip: (i) => [['k', String(i + 1)], ['aₖ', f6(terms[i])]] },
      ], { y: yDom(terms.concat([0]), 0.1) });
      const xs = ks.slice(0, s.n);
      const ys = sums.slice(0, s.n);
      p2.render([
        Number.isFinite(P.L) ? { type: 'hline', y: P.L, color: 'tree', dash: '6 4', text: 'предел ' + f4(P.L) } : null,
        { type: 'line', x: xs, y: ys, color: 'model', width: 1.4, curve: 'step', hover: false },
        { type: 'points', x: xs, y: ys, color: 'model', r: 4, tooltip: (i) => [['n', String(i + 1)], ['Sₙ', f6(ys[i])]] },
      ], { y: yDom(sums.concat(Number.isFinite(P.L) ? [P.L] : []), 0.08) });
      const show = Math.min(s.n, 4);
      const parts = U.range(show, 1).map((k) => f4(P.a(k)).replace('−', '-'));
      let src = 'S_{' + s.n + '} = ' + parts.map((t, i) => (i && !t.startsWith('-') ? '+' + t : t)).join('') + (s.n > 4 ? R`+\dots` : '') + ' = ' + f4(sums[s.n - 1]).replace('−', '-');
      src = src.replace(/(\d)-/g, '$1 - ').replace(/\+/g, ' + ');
      texInto(texBox, src, true);
      const from = Math.max(1, s.n - 4);
      rowTable(tbl, ['k', 'a_k', 'S_k = S_{k−1} + a_k'], U.range(s.n - from + 1, from).map((k) => [String(k), f6(P.a(k)), f6(sums[k - 1])]), (i) => i === s.n - from);
      st.set('a', f6(P.a(s.n)));
      st.set('S', f6(sums[s.n - 1]));
      st.set('L', Number.isFinite(P.L) ? f6(P.L) : P.L === Infinity ? '∞ (расходится)' : 'нет (расходится)');
      note.innerHTML = P.say + ' Не путайте: <b>члены</b> aₖ — отдельные слагаемые, <b>частичные суммы</b> Sₙ — накопленный итог. У сходящегося ряда члены стремятся к 0, а суммы — к сумме ряда.';
    }
    w.pythonAction(() => {
      const P = PS[s.key];
      return 'S = 0.0\nfor k in range(1, ' + (s.n + 1) + '):\n    a = ' + P.py + '\n    S += a\n    print(f"k = {k:2d}:  a_k = {a:+.6f},  S_k = {S:.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 2. Сумма ряда — предел частичных сумм; ε-полоса и виды расходимости
   * ============================================================================== */
  const EB = {
    half: { label: '½ + ¼ + ⅛ + … → 1', a: (k) => Math.pow(2, -k), L: 1, kind: 'conv', py: '1 / 2**k' },
    alt: { label: '1 − ½ + ⅓ − … → ln 2', a: (k) => (k % 2 ? 1 : -1) / k, L: Math.LN2, kind: 'conv', py: '(-1)**(k + 1) / k' },
    basel: { label: '1 + ¼ + 1/9 + … → π²/6', a: (k) => 1 / (k * k), L: (PI * PI) / 6, kind: 'conv', py: '1 / k**2' },
    harm: { label: '1 + ½ + ⅓ + … (к бесконечности)', a: (k) => 1 / k, L: Infinity, kind: 'inf', py: '1 / k' },
    grandi: { label: '1 − 1 + 1 − … (колеблется)', a: (k) => (k % 2 ? 1 : -1), L: 0.5, kind: 'osc', py: '(-1)**(k + 1)' },
    wild: { label: '1 − 2 + 3 − 4 + … (размах растёт)', a: (k) => (k % 2 ? k : -k), L: NaN, kind: 'wild', py: '(-1)**(k + 1) * k' },
  };
  GBC.widget('epsilon-band', (el) => {
    const s = { key: 'half', eps: 0.05 };
    const NMAX = 3000;
    const w = ui.shell(el, { title: 'Сходимость — это попадание в ε-полосу навсегда', sub: 'Ряд сходится к S, если для любого допуска ε найдётся номер N, после которого все частичные суммы лежат в полосе S ± ε. Уменьшайте ε: N растёт, но всегда находится. У расходящихся рядов полосы нет — посмотрите, как по-разному они «не сходятся».' });
    ui.select(w.controls, { label: 'Ряд', value: s.key, options: Object.entries(EB).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.slider(w.controls, { label: 'Допуск ε', values: [0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001], value: s.eps, format: (v) => String(v), onInput: (v) => ((s.eps = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'n (лог. шкала)', type: 'log', domain: [1, NMAX], ticks: [1, 10, 100, 1000] }, y: { label: 'S_n' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'N', label: 'номер N(ε)' }, { key: 'SN', label: 'S_N' }, { key: 'v', label: 'итог' }]);
    function draw() {
      const P = EB[s.key];
      const sums = psums(P.a, NMAX);
      const ns = U.range(NMAX, 1);
      let N = null;
      if (P.kind === 'conv') {
        N = NMAX + 1;
        for (let i = NMAX - 1; i >= 0; i--) {
          if (Math.abs(sums[i] - P.L) >= s.eps) break;
          N = i + 1;
        }
      }
      const inBand = (i) => P.kind !== 'wild' && Number.isFinite(P.L) && Math.abs(sums[i] - P.L) < s.eps;
      const few = ns.filter((n) => n <= 60 || n % Math.ceil(n / 60) === 0);
      const yv = few.map((n) => sums[n - 1]);
      const ydom = P.kind === 'wild' ? [-35, 35] : P.kind === 'inf' ? [0, 9] : P.kind === 'osc' ? [-0.4, 1.4] : yDom(sums.slice(0, 200).concat([P.L - s.eps, P.L + s.eps]), 0.06);
      plot.render([
        Number.isFinite(P.L) && P.kind !== 'wild' ? { type: 'rect', x0: 1, x1: NMAX, y0: P.L - s.eps, y1: P.L + s.eps, fill: P.kind === 'conv' ? 'tree' : 'muted', opacity: 0.14, label: P.kind === 'conv' ? 'полоса S ± ε' : 'полоса ½ ± ε (кандидат)', color: P.kind === 'conv' ? 'tree' : 'muted' } : null,
        Number.isFinite(P.L) && P.kind !== 'wild' ? { type: 'hline', y: P.L, color: P.kind === 'conv' ? 'tree' : 'muted', dash: '6 4' } : null,
        { type: 'line', x: few, y: yv.map((v) => U.clamp(v, -1e3, 1e3)), color: 'model', width: 1.4, opacity: 0.7, hover: false },
        { type: 'points', x: few.filter((n) => n <= 60), y: yv.filter((v, i) => few[i] <= 60).map((v) => U.clamp(v, -1e3, 1e3)), r: 3.5, color: (i) => (inBand(i) ? 'model' : 'pos'), legendColor: 'model', label: 'частичные суммы', tooltip: (i) => [['n', String(i + 1)], ['Sₙ', f6(sums[i])]] },
        N && N <= NMAX ? { type: 'vline', x: N, color: 'ink2', dash: '3 3', width: 1.2, text: 'N = ' + N } : null,
      ], { y: ydom });
      st.set('N', P.kind === 'conv' ? (N <= NMAX ? String(N) : '> ' + NMAX) : '—');
      st.set('SN', P.kind === 'conv' && N <= NMAX ? f6(sums[N - 1]) : '—');
      st.set('v', P.kind === 'conv' ? 'сходится' : 'расходится');
      const msg = {
        conv: 'Начиная с N = ' + N + ' все суммы лежат в полосе ' + f4(P.L) + ' ± ' + s.eps + ' (синие точки; красные — ещё вне полосы). Это и есть определение предела из урока 15.3, применённое к последовательности Sₙ. ' + (s.key === 'basel' ? 'Здесь N растёт примерно как 1/ε: суммы подходят медленно.' : s.key === 'alt' ? 'Суммы прыгают вокруг ln 2, но размах прыжков уменьшается — полоса ловит их все.' : 'Здесь N растёт как log₂(1/ε): каждый член вдвое уменьшает расстояние до 1.'),
        inf: '<b>Расходится к бесконечности.</b> Суммы растут без предела: любую высоту рано или поздно превысят (здесь — очень поздно: S₃₀₀₀ ≈ ' + f3(sums[NMAX - 1]) + '). Никакая полоса их не удержит.',
        osc: '<b>Расходится колебаниями.</b> Суммы 1, 0, 1, 0… ограничены, но никуда не подходят. Даже «естественный кандидат» ½ не годится: при ε < ½ ни одна сумма не попадает в полосу.',
        wild: '<b>Колебания с растущим размахом.</b> Суммы 1, −1, 2, −2, 3, … уходят и вверх, и вниз. Ни полосы, ни бесконечности одного знака.',
      };
      note.innerHTML = msg[P.kind];
    }
    w.pythonAction(() => {
      const P = EB[s.key];
      if (P.kind !== 'conv') return 'S = 0.0\nfor k in range(1, 21):\n    S += ' + P.py + '\n    print(k, S)\n';
      return 'import math\n\nL = ' + ({ half: '1.0', alt: 'math.log(2)', basel: 'math.pi**2 / 6' }[s.key]) + '\neps = ' + s.eps + '\nsums, S = [], 0.0\nfor k in range(1, ' + (NMAX + 1) + '):\n    S += ' + P.py + '\n    sums.append(S)\n# N — номер, после которого все суммы в полосе L ± eps\nN = next(n for n in range(1, len(sums) + 1) if all(abs(s - L) < eps for s in sums[n - 1:]))\nprint("N(ε) =", N, "  S_N =", sums[N - 1])\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 3. Телескопические ряды: всё сокращается, кроме краёв
   * ============================================================================== */
  const TEL = {
    t1: { lvl: 1, label: '1/(k(k+1)) = 1/k − 1/(k+1)', tex: R`\frac{1}{k(k+1)}=\frac1k-\frac1{k+1}`, b: (k) => 1 / k, bt: (k) => R`\tfrac{1}{${k}}`, g: 1, c: 1, L: 1, py: '1 / (k * (k + 1))', why: 'Остаётся первый «кирпичик» 1 и последний −1/(n + 1): Sₙ = 1 − 1/(n + 1) → 1.' },
    t4: { lvl: 1, label: '1/√k − 1/√(k+1)', tex: R`a_k=\frac{1}{\sqrt k}-\frac{1}{\sqrt{k+1}}`, b: (k) => 1 / Math.sqrt(k), bt: (k) => (k === 1 ? '1' : R`\tfrac{1}{\sqrt{${k}}}`), g: 1, c: 1, L: 1, py: '1 / math.sqrt(k) - 1 / math.sqrt(k + 1)', why: 'Sₙ = 1 − 1/√(n + 1) → 1, хотя подходит медленно.' },
    t3: { lvl: 2, label: 'ln(1 + 1/k) = ln(k+1) − ln k', tex: R`\ln\Bigl(1+\frac1k\Bigr)=\ln(k+1)-\ln k`, b: (k) => -Math.log(k), bt: (k) => (k === 1 ? R`(-\ln 1)` : R`(-\ln ${k})`), g: 1, c: 1, L: Infinity, py: 'math.log(1 + 1 / k)', why: 'Sₙ = ln(n + 1) − ln 1 = ln(n + 1) → ∞. Члены ln(1 + 1/k) → 0, а ряд <b>расходится</b> — ещё одно предупреждение: «члены → 0» не гарантирует сходимости (шаг 11).' },
    t2: { lvl: 2, label: '2/(k(k+2)) = 1/k − 1/(k+2)', tex: R`\frac{2}{k(k+2)}=\frac1k-\frac1{k+2}`, b: (k) => 1 / k, bt: (k) => R`\tfrac{1}{${k}}`, g: 2, c: 1, L: 1.5, py: '2 / (k * (k + 2))', why: 'Сокращение «через одно»: выживают два первых кирпичика 1 + ½ и два последних. Sₙ = 3/2 − 1/(n + 1) − 1/(n + 2) → 3/2.' },
    t5: { lvl: 3, label: '1/(k(k+1)(k+2))', tex: R`\frac{1}{k(k+1)(k+2)}=\frac12\Bigl(\frac{1}{k(k+1)}-\frac{1}{(k+1)(k+2)}\Bigr)`, b: (k) => 1 / (k * (k + 1)), bt: (k) => R`\tfrac{1}{${k * (k + 1)}}`, g: 1, c: 0.5, L: 0.25, py: '1 / (k * (k + 1) * (k + 2))', why: 'Разность соседних «кирпичиков» 1/(k(k + 1)) даёт 2/(k(k+1)(k+2)) — отсюда множитель ½. Sₙ = ½(½ − 1/((n + 1)(n + 2))) → ¼.' },
  };
  GBC.widget('telescope', (el) => {
    const s = { key: 't1', n: 4 };
    const N = 40;
    const w = ui.shell(el, { title: 'Телескоп: сумма складывается, как подзорная труба', sub: 'Если член ряда — разность соседних «кирпичиков» aₖ = bₖ − bₖ₊₁, то в частичной сумме почти всё сокращается. Смотрите, какие слагаемые зачёркиваются, а какие выживают.' });
    ui.select(w.controls, { label: 'Ряд', value: s.key, options: Object.entries(TEL).map(([k, v]) => ({ value: k, label: STARS[v.lvl] + ' ' + v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.player(w.controls, { label: 'Членов n', min: 1, max: N, value: s.n, fps: 2, format: (v) => 'n = ' + v, onChange: (v) => ((s.n = v), draw()) });
    const c1 = card('Разложение члена');
    const c2 = card('Частичная сумма');
    const grid = cardGrid(480);
    grid.append(c1.el, c2.el);
    w.main.appendChild(grid);
    const t1 = H('div');
    const t2 = H('div');
    c1.body.appendChild(t1);
    c2.body.appendChild(t2);
    const plot = new GBC.Plot(w.main, { height: 230, x: { label: 'n', domain: [0, N + 1] }, y: { label: 'S_n' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'S', label: 'Sₙ (сложением)' }, { key: 'F', label: 'Sₙ (по формуле краёв)' }, { key: 'L', label: 'сумма ряда' }]);
    function draw() {
      const T = TEL[s.key];
      const n = s.n;
      const g = T.g;
      const bt = T.bt;
      texInto(t1, T.tex, true);
      const term = (k) => {
        const plus = k > g ? R`\cancel{${bt(k)}}` : bt(k);
        const minus = k + g <= n ? R`\cancel{${bt(k + g)}}` : bt(k + g);
        return R`\bigl(${plus}-${minus}\bigr)`;
      };
      const idx = n <= 4 ? U.range(n, 1) : [1, 2, 3, null, n];
      let src = (T.c !== 1 ? R`\tfrac12\Bigl[` : '') + idx.map((k) => (k === null ? R`\dots` : term(k))).join('+') + (T.c !== 1 ? R`\Bigr]` : '');
      src = 'S_{' + n + '}=' + src;
      const keepHead = U.range(g, 1).map(bt).join('+');
      const keepTail = U.range(g, n + 1).map(bt).join('-');
      const formula = (T.c !== 1 ? R`\tfrac12\bigl(` : '') + keepHead + '-' + keepTail + (T.c !== 1 ? R`\bigr)` : '');
      texInto(t2, src + R`\;=\;` + formula, true);
      const sums = psums((k) => T.c * (T.b(k) - T.b(k + g)), N);
      let head = 0;
      for (let k = 1; k <= g; k++) head += T.b(k);
      let tail = 0;
      for (let k = n + 1; k <= n + g; k++) tail += T.b(k);
      const Fn = T.c * (head - tail);
      const ks = U.range(N, 1);
      plot.render([
        Number.isFinite(T.L) ? { type: 'hline', y: T.L, color: 'tree', dash: '6 4', text: 'предел ' + U.fmt(T.L, 4) } : null,
        { type: 'line', x: ks, y: sums, color: 'model', width: 1.2, opacity: 0.4, hover: false },
        { type: 'points', x: ks, y: sums, r: (i) => (i === n - 1 ? 6 : 3), color: (i) => (i < n ? 'model' : 'grid'), legendColor: 'model', tooltip: (i) => [['n', String(i + 1)], ['Sₙ', f6(sums[i])]] },
      ], { y: yDom(sums.concat(Number.isFinite(T.L) ? [T.L, 0] : [0]), 0.06) });
      st.set('S', f6(sums[n - 1]));
      st.set('F', f6(Fn));
      st.set('L', Number.isFinite(T.L) ? U.fmt(T.L, 4) : '∞');
      const pairs = Math.max(0, n - g);
      note.innerHTML = T.why + ' Сложение n членов и формула «первые минус последние» дают одно и то же число — телескоп сократил ' + pairs + ' ' + plural(pairs, 'пару', 'пары', 'пар') + ' слагаемых.';
    }
    w.pythonAction(() => {
      const T = TEL[s.key];
      return 'import math\n\nS = 0.0\nfor k in range(1, ' + (s.n + 1) + '):\n    S += ' + T.py + '\nprint("S_n сложением:", S)\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 4. Ловушки: скобки, «S = 1 − S» и «S = 1 + 2S»
   * ============================================================================== */
  const BR = {
    grandi: { label: '1 − 1 + 1 − 1 + … (ряд Гранди)', a: (k) => (k % 2 ? 1 : -1), L: null, trick: R`S = 1-(1-1+1-\dots)=1-S\;\Rightarrow\;S=\tfrac12\;?`, claim: 0.5 },
    altgeo: { label: '1 − ½ + ¼ − ⅛ + … (сходится к 2/3)', a: (k) => Math.pow(-0.5, k - 1), L: 2 / 3, trick: R`S = 1-\tfrac12\bigl(1-\tfrac12+\tfrac14-\dots\bigr)=1-\tfrac12 S\;\Rightarrow\;S=\tfrac23\ \checkmark`, claim: 2 / 3 },
    pow2: { label: '1 + 2 + 4 + 8 + … (расходится)', a: (k) => Math.pow(2, k - 1), L: null, trick: R`S = 1+2(1+2+4+\dots)=1+2S\;\Rightarrow\;S=-1\;?!`, claim: -1 },
  };
  GBC.widget('bracket-trap', (el) => {
    const s = { key: 'grandi', grp: 'none' };
    const N = 20;
    const w = ui.shell(el, { title: 'Ловушки: скобки и алгебра с бесконечными суммами', sub: 'Расставить скобки — значит смотреть не на все частичные суммы, а только на часть из них (через одну). Если ряд сходится, ответ от этого не меняется; если нет — можно «получить» что угодно.' });
    ui.select(w.controls, { label: 'Ряд', value: s.key, options: Object.entries(BR).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.segmented(w.controls, { label: 'Скобки', value: s.grp, options: [{ value: 'none', label: 'нет' }, { value: 'even', label: '(a₁+a₂)+(a₃+a₄)+…' }, { value: 'odd', label: 'a₁+(a₂+a₃)+…' }], onChange: (v) => ((s.grp = v), draw()) });
    const cTrick = card('«Алгебраический фокус»');
    const trickTex = H('div');
    cTrick.body.appendChild(trickTex);
    w.main.appendChild(cTrick.el);
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'n', domain: [0, N + 1] }, y: { label: 'S_n' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'суммы со скобками' }, { key: 'c', label: 'ответ фокуса' }, { key: 'v', label: 'на самом деле' }]);
    function draw() {
      const B = BR[s.key];
      const sums = psums(B.a, N);
      const ks = U.range(N, 1);
      const pick = (n) => (s.grp === 'even' ? n % 2 === 0 : s.grp === 'odd' ? n % 2 === 1 : true);
      const cap = (v) => U.clamp(v, -2, 60);
      const sub = ks.filter(pick);
      plot.render([
        B.claim !== null ? { type: 'hline', y: B.claim, color: s.key === 'altgeo' ? 'tree' : 'pos', dash: '6 4', text: (s.key === 'altgeo' ? 'сумма ' : 'ответ фокуса ') + U.fmt(B.claim, 4) } : null,
        { type: 'points', x: ks, y: sums.map(cap), color: 'grid', r: 3.5, label: 'все суммы Sₙ', legendColor: 'muted' },
        { type: 'line', x: sub, y: sub.map((n) => cap(sums[n - 1])), color: 'model', width: 1.4, opacity: 0.6, hover: false },
        { type: 'points', x: sub, y: sub.map((n) => cap(sums[n - 1])), color: 'model', r: 5, label: s.grp === 'none' ? 'без скобок' : 'суммы со скобками', tooltip: (i) => [['n', String(sub[i])], ['Sₙ', f6(sums[sub[i] - 1])]] },
      ], { y: s.key === 'pow2' ? [-2, 40] : s.key === 'grandi' ? [-0.5, 1.5] : [0.3, 1.1] });
      texInto(trickTex, B.trick, true);
      const tail = sub.slice(-2).map((n) => sums[n - 1]);
      st.set('g', s.grp === 'none' ? '—' : tail.map((v) => U.fmt(v, 4)).join(', ') + ', …');
      st.set('c', U.fmt(B.claim, 4));
      st.set('v', B.L === null ? 'расходится' : 'сумма ' + U.fmt(B.L, 4));
      const notes = {
        grandi: s.grp === 'none' ? 'Суммы 1, 0, 1, 0, … — предела нет. Включите скобки: «через одну» получатся постоянные 0 или 1 — два разных «ответа» у одного ряда. А фокус «S = 1 − S» даёт третий: ½. Все три — ошибка: мы обращались с S как с числом, а его нет.' : 'Скобки выбрали подпоследовательность сумм: ' + (s.grp === 'even' ? 'S₂, S₄, … = 0' : 'S₁, S₃, … = 1') + '. У расходящегося ряда разные подпоследовательности могут сходиться к разным числам.',
        altgeo: 'Ряд сходится (геометрический с q = −½, шаг 6), и всё законно: любые скобки дают ту же сумму 2/3, и алгебраический фокус тоже верен. Правило: <b>сначала докажите сходимость — потом делайте алгебру</b>.',
        pow2: 'Суммы 1, 3, 7, 15, … = 2ⁿ − 1 → ∞. Фокус «S = 1 + 2S» даёт −1: сумма положительных чисел вышла отрицательной! Ошибка та же: S не существует как число. Формула 1/(1 − q) верна только при |q| < 1.',
      };
      note.innerHTML = notes[s.key];
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 5. Конечная геометрическая сумма: «умножить на q и вычесть»
   * ============================================================================== */
  GBC.widget('geo-proof', (el) => {
    const s = { q: 0.6, n: 5 };
    const w = ui.shell(el, { title: 'Почему Sₙ = (1 − qⁿ)/(1 − q)', sub: 'Верхний ряд столбиков — Sₙ = 1 + q + … + qⁿ⁻¹. Нижний — qSₙ = q + q² + … + qⁿ: те же столбики, сдвинутые на одну позицию. Одинаковые столбики стоят друг под другом и при вычитании исчезают; остаются только крайние: 1 и qⁿ.' });
    ui.slider(w.controls, { label: 'Знаменатель q', min: 0.1, max: 0.95, step: 0.05, value: s.q, onInput: (v) => ((s.q = v), draw()) });
    ui.slider(w.controls, { label: 'Членов n', min: 1, max: 9, step: 1, value: s.n, format: (v) => String(v), onInput: (v) => ((s.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'степень qᵏ: k', domain: [-0.6, 9.6] }, y: { label: '', domain: [-0.08, 2.5], ticks: [] } });
    const res = H('div');
    w.main.appendChild(res);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'S', label: 'Sₙ (сложением)' }, { key: 'F', label: '(1 − qⁿ)/(1 − q)' }, { key: 'r', label: 'Sₙ − qSₙ' }]);
    function draw() {
      const { q, n } = s;
      const L = [];
      const top = 1.35;
      for (let k = 0; k < n; k++) {
        const v = Math.pow(q, k);
        const keep = k === 0;
        L.push({ type: 'rect', x0: k - 0.38, x1: k + 0.38, y0: top, y1: top + v, fill: keep ? 'model' : 'grid', stroke: keep ? 'model' : 'axis', opacity: keep ? 0.7 : 0.6, width: 1 });
      }
      for (let k = 1; k <= n; k++) {
        const v = Math.pow(q, k);
        const keep = k === n;
        L.push({ type: 'rect', x0: k - 0.38, x1: k + 0.38, y0: 0, y1: v, fill: keep ? 'tree' : 'grid', stroke: keep ? 'tree' : 'axis', opacity: keep ? 0.75 : 0.6, width: 1 });
      }
      L.push({ type: 'hline', y: top, color: 'axis', width: 1 });
      L.push({ type: 'hline', y: 0, color: 'axis', width: 1 });
      L.push({ type: 'text', items: [{ x: -0.55, y: top + 1.02, text: 'Sₙ', bold: true }, { x: -0.55, y: 1.05, text: 'q·Sₙ', bold: true }, { x: 0, y: top - 0.12, anchor: 'middle', text: 'остаётся 1' }, { x: n, y: Math.pow(q, n) + 0.12, anchor: 'middle', text: 'вычитается qⁿ' }] });
      plot.render(L);
      const Sn = (1 - Math.pow(q, n)) / (1 - q);
      let add = 0;
      for (let k = 0; k < n; k++) add += Math.pow(q, k);
      texInto(res, R`S_{${n}}-q\,S_{${n}} = 1 - q^{${n}}\quad\Rightarrow\quad S_{${n}}=\frac{1-q^{${n}}}{1-q}=\frac{1-${f3(q)}^{${n}}}{1-${f3(q)}}=${f4(Sn)}`, true);
      st.set('S', f6(add));
      st.set('F', f6(Sn));
      st.set('r', f6(add - q * add) + ' = 1 − qⁿ');
      note.innerHTML = 'Серые столбики сверху и снизу совпадают попарно (k = 1, …, ' + (n - 1) + ') и при вычитании исчезают. Остаются синий столбик 1 сверху и оранжевый q' + sup(n) + ' = ' + f4(Math.pow(q, n)) + ' снизу. Чем больше n, тем меньше оранжевый столбик — в пределе остаётся только 1, и S = 1/(1 − q) = ' + f4(1 / (1 - q)) + '.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 6. Геометрический ряд, его остаток и сколько членов нужно
   * ============================================================================== */
  GBC.widget('geometric', (el) => {
    const s = { a: 1, q: 0.5, n: 10, eps: 0.001 };
    const N = 40;
    const w = ui.shell(el, { title: 'Геометрический ряд a + aq + aq² + …', sub: 'Каждый член в q раз больше предыдущего. Сверху — члены, снизу — частичные суммы и предел a/(1 − q). Оранжевый отрезок — остаток rₙ = S − Sₙ: сколько ещё «не досуммировано».' });
    ui.segmented(w.controls, { label: 'Первый член a', value: s.a, options: [{ value: 1, label: '1' }, { value: 3, label: '3' }, { value: 0.9, label: '0.9' }], onChange: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'Знаменатель q', min: -1.3, max: 1.3, step: 0.05, value: s.q, onInput: (v) => ((s.q = Math.round(v * 100) / 100), draw()) });
    ui.player(w.controls, { label: 'Членов n', min: 1, max: N, value: s.n, fps: 4, format: (v) => 'n = ' + v, onChange: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Нужная точность ε', values: [0.1, 0.01, 0.001, 1e-6], value: s.eps, format: (v) => (v < 1e-3 ? '10⁻⁶' : String(v)), onInput: (v) => ((s.eps = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 180, x: { label: 'номер k', domain: [0.3, N + 0.7] }, y: { label: 'член a·q^{k−1}' } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'n', domain: [0.3, N + 0.7] }, y: { label: 'частичная сумма S_n' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'S', label: 'Sₙ' }, { key: 'L', label: 'a/(1 − q)' }, { key: 'r', label: 'остаток rₙ' }, { key: 'ne', label: 'членов для ε' }]);
    function draw() {
      const { a, q, n } = s;
      const ks = U.range(N, 1);
      const terms = ks.map((k) => a * Math.pow(q, k - 1));
      const sums = psums((k) => a * Math.pow(q, k - 1), N);
      const conv = Math.abs(q) < 1;
      const L = a / (1 - q);
      const cap = (v) => U.clamp(v, -60, 60);
      p1.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'bars', x: ks, y: terms.map(cap), color: (i) => (i >= n ? 'grid' : terms[i] >= 0 ? 'model' : 'pos'), width: 0.7, maxPx: 14, tooltip: (i) => [['k', String(i + 1)], ['член', f6(terms[i])]] },
      ], { y: yDom(terms.slice(0, Math.max(n, 6)).map(cap).concat([0]), 0.1) });
      const xs = ks.slice(0, n);
      const ys = sums.slice(0, n).map(cap);
      p2.render([
        conv ? { type: 'hline', y: L, color: 'tree', dash: '6 4', text: 'a/(1 − q) = ' + f4(L) } : null,
        conv ? { type: 'segments', x1: [n], y1: [ys[n - 1]], x2: [n], y2: [L], color: 'tree', width: 3, opacity: 0.9 } : null,
        { type: 'line', x: xs, y: ys, color: 'model', width: 1.4, hover: false },
        { type: 'points', x: xs, y: ys, color: 'model', r: 3.5, tooltip: (i) => [['n', String(i + 1)], ['Sₙ', f6(sums[i])]] },
      ], { y: yDom(sums.slice(0, Math.max(n, 6)).map(cap).concat(conv ? [L] : []), 0.08) });
      const rn = conv ? L - sums[n - 1] : NaN;
      let ne = null;
      if (conv && q !== 0) {
        ne = 1;
        while (Math.abs((a * Math.pow(q, ne)) / (1 - q)) >= s.eps && ne < 1e6) ne++;
      } else if (q === 0) ne = 1;
      st.set('S', f6(sums[n - 1]));
      st.set('L', conv ? f6(L) : '—');
      st.set('r', conv ? sci(rn) : '—');
      st.set('ne', conv ? String(ne) : '—');
      if (!conv) {
        note.innerHTML = Math.abs(q) === 1 ? 'При |q| = 1 члены не уменьшаются (' + (q > 0 ? 'суммы растут: a, 2a, 3a, …' : 'суммы прыгают a, 0, a, 0, …') + ') — ряд <b>расходится</b>.' : 'При |q| > 1 члены растут по модулю, суммы улетают' + (q < 0 ? ' то вверх, то вниз' : '') + '. Ряд <b>расходится</b>, и формула a/(1 − q) = ' + f3(L) + ' здесь бессмысленна (шаг 4).';
        return;
      }
      note.innerHTML = 'Остаток после n членов — тоже геометрический ряд: rₙ = aqⁿ + aqⁿ⁺¹ + … = <b>aqⁿ/(1 − q)</b> = ' + sci(rn) + '. Чтобы ошибка стала меньше ε = ' + (s.eps < 1e-3 ? '10⁻⁶' : s.eps) + ', нужно ' + ne + ' ' + plural(ne, 'член', 'члена', 'членов') + '. ' + (Math.abs(q) > 0.85 ? 'При q близком к 1 сходимость медленная: каждый член убирает лишь ' + U.fmt(100 * (1 - Math.abs(q)), 1) + ' % остатка.' : q < 0 ? 'При q < 0 знаки чередуются, и суммы подходят к пределу «ёлочкой» — то с недолётом, то с перелётом.' : 'Каждый член уменьшает остаток в ' + U.fmt(1 / Math.abs(q), 3) + ' раза.');
    }
    w.pythonAction(() => 'a, q = ' + py(s.a) + ', ' + py(s.q) + '\nS = 0.0\nfor n in range(1, ' + (s.n + 1) + '):\n    S += a * q ** (n - 1)\n    print(f"n = {n:2d}: S_n = {S:.6f}")\n' + (Math.abs(s.q) < 1 ? 'L = a / (1 - q)\nprint("a/(1 − q) =", L, "  остаток r_n =", L - S, " = a q^n/(1 − q) =", a * q ** ' + s.n + ' / (1 - q))\n' : ''));
    draw();
  });

  /* ==============================================================================
   * Шаг 7. Периодические дроби: 0.1(6) = 1/6 и 0.(9) = 1
   * ============================================================================== */
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  GBC.widget('repeating-decimal', (el) => {
    const s = { pre: '1', per: '6' };
    const PRE = [['', '3', '0.(3)'], ['', '9', '0.(9)'], ['1', '6', '0.1(6)'], ['', '142857', '0.(142857)'], ['', '12', '0.(12)'], ['58', '3', '0.58(3)'], ['', '0', '0.(0)']];
    const w = ui.shell(el, { title: 'Периодическая дробь → обыкновенная', sub: 'Период повторяется бесконечно — это геометрический ряд с q = 10⁻ᵖ (p — длина периода). Введите цифры до периода и сам период или выберите готовый пример.' });
    ui.select(w.controls, { label: 'Пример', value: '2', options: PRE.map((p, i) => ({ value: String(i), label: p[2] })), onChange: (v) => {
      const p = PRE[+v];
      s.pre = p[0];
      s.per = p[1];
      inPre.value = s.pre;
      inPer.value = s.per;
      draw();
    } });
    const inPre = digitInput(w.controls, 'Цифры до периода (можно пусто)', s.pre, (v) => ((s.pre = v), draw()), 4);
    const inPer = digitInput(w.controls, 'Период (1–6 цифр)', s.per, (v) => ((s.per = v), draw()), 6);
    const head = H('div', { style: 'font-size:1.3rem;font-weight:650;padding:2px 0 6px;font-variant-numeric:tabular-nums' });
    w.main.appendChild(head);
    const steps = H('ol', { style: 'margin:0 0 6px;padding-left:1.4em;display:grid;gap:6px' });
    w.main.appendChild(steps);
    const plot = new GBC.Plot(w.main, { height: 210, x: { label: 'сколько периодов выписано, j', domain: [0.5, 8.5] }, y: { label: 'ошибка |S_j − x|', type: 'log' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'дробь' }, { key: 'd', label: 'проверка делением' }, { key: 'q', label: 'q ряда' }]);
    function draw() {
      const pre = s.pre;
      const per = s.per || '0';
      const m = pre.length;
      const p = per.length;
      const A = pre ? parseInt(pre, 10) : 0;
      const B = parseInt(per, 10);
      const tenP = Math.pow(10, p);
      const tenM = Math.pow(10, m);
      let num = A * (tenP - 1) + B;
      let den = tenM * (tenP - 1);
      const g = gcd(num, den) || 1;
      num /= g;
      den /= g;
      head.textContent = '0.' + pre + '(' + per + ') = 0.' + pre + per.repeat(Math.max(1, Math.ceil(12 / p))).slice(0, 12) + '…';
      steps.textContent = '';
      const items = [
        ['Выпишем как сумму: цифры до периода плюс бесконечно много копий периода, каждая в ' + tenP.toLocaleString('ru-RU') + ' раз меньше предыдущей', (m ? R`\frac{${A}}{10^{${m}}}+` : '') + R`\frac{${B}}{10^{${m + p}}}+\frac{${B}}{10^{${m + 2 * p}}}+\dots`],
        ['Копии периода — геометрический ряд: первый член ' + B + '/10' + sup(m + p) + ', знаменатель q = 10' + sup(-p), (m ? R`\frac{${A}}{10^{${m}}}+` : '') + R`\frac{${B}/10^{${m + p}}}{1-10^{-${p}}}`],
        ['Упростим: ' + B + '/(10' + sup(m + p) + ' − 10' + sup(m) + ')' + (m ? ' и приведём к общему знаменателю' : ''), (m ? R`\frac{${A}}{${tenM}}+` : '') + R`\frac{${B}}{${tenM * (tenP - 1)}}=\frac{${A * (tenP - 1) + B}}{${tenM * (tenP - 1)}}`],
        ['Сократим на НОД = ' + g, R`=\frac{${num}}{${den}}`],
      ];
      items.forEach(([c, t]) => steps.appendChild(H('li', null, H('div', { style: 'font-size:.92rem;color:var(--ink-2)' }, c), texEl(R`\displaystyle ` + t, false, 'padding:2px 0'))));
      const x = num / den;
      const js = U.range(8, 1);
      const errs = js.map((j) => {
        let v = A / tenM;
        for (let r = 1; r <= j; r++) v += B / (tenM * Math.pow(tenP, r));
        return Math.max(Math.abs(v - x), 1e-17);
      });
      const ax = logAxis(Math.min(...errs), Math.max(...errs, 1e-3));
      plot.opts.y.ticks = ax.ticks;
      plot.opts.y.format = powFmt;
      plot.render([
        { type: 'line', x: js, y: errs, color: 'model', width: 1.6, hover: false },
        { type: 'points', x: js, y: errs, color: 'model', r: 4, tooltip: (i) => [['j', String(js[i])], ['ошибка', sci(errs[i])]] },
      ], { y: ax.domain });
      st.set('f', num + '/' + den);
      st.set('d', num + ' : ' + den + ' = ' + (num / den).toFixed(10).replace(/0+$/, '').replace(/\.$/, ''));
      st.set('q', '10' + sup(-p));
      note.innerHTML = (B === 0 ? 'Период 0 — обычная конечная дробь.' : per.split('').every((c) => c === '9') ? 'Период из одних девяток: ряд даёт <b>ровно</b> ' + num + '/' + den + '. Две записи одного числа — 0.' + pre + '(' + per + ') и конечная дробь; так же 0.(9) = 1. Никакого «бесконечно малого зазора» нет: зазор после j периодов равен 10⁻ʲᵖ и стремится к 0.' : 'Каждый новый период уменьшает ошибку в ' + tenP.toLocaleString('ru-RU') + ' раз — на графике ступени ровно по ' + p + ' ' + plural(p, 'порядку', 'порядка', 'порядков') + '.') + ' Верно и обратное: любая обыкновенная дробь даёт конечную или периодическую десятичную запись.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 8. Прыгающий мяч: бесконечно много отскоков за конечное время
   * ============================================================================== */
  GBC.widget('bouncing-ball', (el) => {
    const s = { r: 0.6, n: 6 };
    const G = 9.81;
    const H0 = 1;
    const NB = 25;
    const w = ui.shell(el, { title: 'Мяч прыгает бесконечно — но недолго', sub: 'Мяч падает с высоты 1 м; после каждого отскока он поднимается на долю r прежней высоты. Отскоков бесконечно много, но путь и время — суммы геометрических рядов, и они конечны.' });
    ui.slider(w.controls, { label: 'Доля высоты r', min: 0.3, max: 0.9, step: 0.05, value: s.r, onInput: (v) => ((s.r = v), draw()) });
    ui.player(w.controls, { label: 'Отскоков показать', min: 0, max: NB, value: s.n, fps: 3, format: (v) => v + ' отск.', onChange: (v) => ((s.n = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 't, с' }, y: { label: 'высота, м', domain: [0, 1.08] } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'число отскоков n', domain: [-0.5, NB + 0.5] }, y: { label: 'накопленное' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'путь после n отскоков' }, { key: 'D', label: 'весь путь' }, { key: 't', label: 'время после n' }, { key: 'T', label: 'всё время' }]);
    function draw() {
      const { r, n } = s;
      const t0 = Math.sqrt((2 * H0) / G);
      const sr = Math.sqrt(r);
      const T = (t0 * (1 + sr)) / (1 - sr);
      const D = (H0 * (1 + r)) / (1 - r);
      const xs = [];
      const ys = [];
      const fall = U.linspace(0, t0, 40);
      fall.forEach((t) => (xs.push(t), ys.push(H0 - (G * t * t) / 2)));
      let tc = t0;
      const dist = [H0];
      const times = [t0];
      for (let k = 1; k <= NB; k++) {
        const hk = H0 * Math.pow(r, k);
        const tk = 2 * Math.sqrt((2 * hk) / G);
        if (k <= n) {
          const ts = U.linspace(0, tk, 30);
          ts.forEach((t) => (xs.push(tc + t), ys.push(Math.max(0, (G * tk * t) / 2 - (G * t * t) / 2))));
        }
        tc += tk;
        dist.push(dist[k - 1] + 2 * hk);
        times.push(tc);
      }
      p1.render([
        { type: 'vline', x: T, color: 'tree', dash: '6 4' },
        { type: 'text', items: [{ x: T, y: 1.0, dx: -6, anchor: 'end', text: 'конец: T = ' + U.fmt(T, 3) + ' с' }] },
        { type: 'line', x: xs, y: ys, color: 'model', width: 2, hover: false },
      ], { x: [0, T * 1.08] });
      const ns = U.range(NB + 1);
      p2.render([
        { type: 'hline', y: D, color: 'model', dash: '6 4' },
        { type: 'hline', y: T, color: 'tree', dash: '6 4' },
        { type: 'points', x: ns, y: dist, color: (i) => (i <= n ? 'model' : 'grid'), legendColor: 'model', r: 3.5, label: 'путь, м (пунктир — весь путь ' + U.fmt(D, 3) + ')', tooltip: (i) => [['отскоков', String(i)], ['путь', f4(dist[i]) + ' м']] },
        { type: 'points', x: ns, y: times, color: (i) => (i <= n ? 'tree' : 'grid'), legendColor: 'tree', r: 3.5, label: 'время, с (пунктир — всё время ' + U.fmt(T, 3) + ')', shape: 'square', tooltip: (i) => [['отскоков', String(i)], ['время', f4(times[i]) + ' с']] },
      ], { y: [0, Math.max(D, T) * 1.12] });
      const nb = Math.ceil(Math.log(1e-3) / Math.log(r));
      st.set('d', f4(dist[n]) + ' м');
      st.set('D', f4(D) + ' м');
      st.set('t', f4(times[n]) + ' с');
      st.set('T', f4(T) + ' с');
      note.innerHTML = 'Путь: 1 + 2r + 2r² + … = 1 + 2r/(1 − r) = <b>(1 + r)/(1 − r) = ' + U.fmt(D, 3) + ' м</b>. Время полёта пропорционально корню из высоты, поэтому время — геометрический ряд со знаменателем √r = ' + U.fmt(sr, 3) + ': T = t₀(1 + √r)/(1 − √r) = <b>' + U.fmt(T, 3) + ' с</b>. После ' + nb + ' отскоков высота меньше миллиметра, но формально отскоков бесконечно много — и все они укладываются в конечное время. Это и есть разгадка апорий Зенона.';
    }
    w.pythonAction(() => 'import math\n\ng, h0, r = 9.81, 1.0, ' + py(s.r) + '\nt0 = math.sqrt(2 * h0 / g)\npath, time, h = h0, t0, h0\nfor k in range(1, 201):          # 200 отскоков — «почти бесконечность»\n    h *= r\n    path += 2 * h\n    time += 2 * math.sqrt(2 * h / g)\nprint("путь :", path, " формула (1 + r)/(1 − r) =", (1 + r) / (1 - r))\nprint("время:", time, " формула t0(1 + √r)/(1 − √r) =", t0 * (1 + math.sqrt(r)) / (1 - math.sqrt(r)))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 9. Сколько ждать успеха: Σ k·p·(1 − p)ᵏ⁻¹ = 1/p
   * ============================================================================== */
  GBC.widget('dice-wait', (el) => {
    const s = { p: 1 / 6, trials: 1000, seed: 1 };
    const w = ui.shell(el, { title: 'Сколько бросков до первой шестёрки', sub: 'Бросаем кубик до первой шестёрки (вероятность успеха p). Вероятность, что это случится ровно на k-м броске, — p(1 − p)ᵏ⁻¹: это геометрический ряд, и его сумма равна 1. Среднее число бросков — ряд Σ k·p(1 − p)ᵏ⁻¹ = 1/p. Сравним теорию с опытом.' });
    ui.segmented(w.controls, { label: 'Вероятность успеха p', value: s.p, options: [{ value: 1 / 2, label: '½ (монета)' }, { value: 1 / 6, label: '1/6 (кубик)' }, { value: 1 / 10, label: '1/10' }], onChange: (v) => ((s.p = v), draw()) });
    ui.slider(w.controls, { label: 'Опытов', values: [10, 30, 100, 300, 1000, 3000, 10000], value: s.trials, format: (v) => String(v), onInput: (v) => ((s.trials = v), draw()) });
    ui.button(w.controls, { label: 'Новая серия опытов', icon: 'step', onClick: () => (s.seed++, draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'номер броска с первым успехом, k' }, y: { label: 'доля' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'сколько членов ряда учтено, K' }, y: { label: 'Σ k·P(k)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'P', label: 'Σ P(k)' }, { key: 'E', label: 'теория 1/p' }, { key: 'm', label: 'среднее в опыте' }]);
    function draw() {
      const p = s.p;
      const q = 1 - p;
      const Kmax = Math.ceil(4 / p);
      const rng = new GBC.RNG(s.seed);
      const counts = new Array(Kmax + 2).fill(0);
      let total = 0;
      for (let t = 0; t < s.trials; t++) {
        let k = 1;
        while (rng.random() >= p) k++;
        total += k;
        counts[Math.min(k, Kmax + 1)]++;
      }
      const ks = U.range(Kmax, 1);
      const P = ks.map((k) => p * Math.pow(q, k - 1));
      p1.render([
        { type: 'bars', x: ks, y: P, color: 'model', width: 0.8, maxPx: 18, opacity: 0.55, label: 'теория p(1 − p)ᵏ⁻¹', tooltip: (i) => [['k', String(ks[i])], ['P(k)', f4(P[i])], ['в опыте', f4(counts[ks[i]] / s.trials)]] },
        { type: 'points', x: ks, y: ks.map((k) => counts[k] / s.trials), color: 'tree', r: 3.5, label: 'частота в опыте' },
      ], { x: [0.3, Kmax + 0.7], y: [0, Math.max(p, ...ks.map((k) => counts[k] / s.trials)) * 1.12] });
      const KK = U.range(Kmax * 2, 1);
      const part = psums((k) => k * p * Math.pow(q, k - 1), Kmax * 2);
      const mean = total / s.trials;
      p2.render([
        { type: 'hline', y: 1 / p, color: 'model', dash: '6 4', label: 'теория 1/p = ' + U.fmt(1 / p, 3) },
        { type: 'hline', y: mean, color: 'tree', dash: '3 3', label: 'среднее в опыте ' + U.fmt(mean, 3) },
        { type: 'line', x: KK, y: part, color: 'model', width: 2, label: 'частичная сумма ряда', hover: false },
      ], { x: [1, Kmax * 2], y: [0, Math.max(1 / p, mean) * 1.15] });
      st.set('P', f6(1 - Math.pow(q, 1e4)));
      st.set('E', U.fmt(1 / p, 4));
      st.set('m', U.fmt(mean, 4));
      note.innerHTML = 'Теория: Σ P(k) = p(1 + q + q² + …) = p/(1 − q) = 1 — какой-то бросок обязательно будет первым успешным. Среднее: Σ k·p·qᵏ⁻¹ = p/(1 − q)² = <b>1/p = ' + U.fmt(1 / p, 3) + '</b>. В ' + s.trials + ' опытах среднее ' + U.fmt(mean, 3) + ' — чем больше опытов, тем ближе к теории. Ряд Σ k·qᵏ⁻¹ = 1/(1 − q)² получается из геометрического почленным дифференцированием (шаг 21).';
    }
    w.pythonAction(() => 'from gbcourse.rng import Mulberry32\n\np, trials = ' + py(s.p) + ', ' + s.trials + '\nrng = Mulberry32(' + s.seed + ')\nwaits = []\nfor _ in range(trials):\n    k = 1\n    while rng.random() >= p:\n        k += 1\n    waits.append(k)\nprint("среднее в опыте:", sum(waits) / trials, "  теория 1/p =", 1 / p)\nq = 1 - p\nprint("ряд Σ k p q^(k−1):", sum(k * p * q ** (k - 1) for k in range(1, 2000)))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 10. Бустинг одного числа: геометрический ряд поправок
   * ============================================================================== */
  GBC.widget('boost-number', (el) => {
    const s = { nu: 0.3, M: 12 };
    const T = 10;
    const MM = 50;
    const w = ui.shell(el, { title: 'Бустинг одного числа: поправки — геометрический ряд', sub: 'Цель y = 10, старт F₀ = 0. Каждый шаг прибавляет долю ν оставшегося расстояния: Fₘ = Fₘ₋₁ + ν(y − Fₘ₋₁). Остаток умножается на q = 1 − ν. Попробуйте ν > 1, ν = 2 и ν > 2.' });
    ui.slider(w.controls, { label: 'Темп обучения ν', values: [0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 1.2, 1.5, 1.8, 2, 2.1], value: s.nu, format: (v) => String(v), onInput: (v) => ((s.nu = v), draw()) });
    ui.player(w.controls, { label: 'Шагов M', min: 0, max: MM, value: s.M, fps: 4, format: (v) => 'M = ' + v, onChange: (v) => ((s.M = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'шаг m', domain: [-0.5, MM + 0.5] }, y: { label: 'прогноз F_m' } });
    const p2 = new GBC.Plot(w.main, { height: 190, x: { label: 'шаг m', domain: [0.3, MM + 0.7] }, y: { label: 'поправка на шаге m' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'F', label: 'F_M' }, { key: 'r', label: 'доля остатка |1 − ν|ᴹ' }, { key: 'S', label: 'сумма поправок' }, { key: 'k', label: 'шагов до 1 %' }]);
    function draw() {
      const { nu, M } = s;
      const q = 1 - nu;
      const ms = U.range(MM + 1);
      const F = ms.map((m) => T * (1 - Math.pow(q, m)));
      const corr = U.range(MM, 1).map((m) => nu * T * Math.pow(q, m - 1));
      const cap = (v) => U.clamp(v, -40, 60);
      const show = ms.slice(0, M + 1);
      p1.render([
        { type: 'hline', y: T, color: 'tree', dash: '6 4', text: 'цель y = 10' },
        { type: 'line', x: show, y: show.map((m) => cap(F[m])), color: 'model', width: 1.6, hover: false },
        { type: 'points', x: show, y: show.map((m) => cap(F[m])), color: 'model', r: 3.5, tooltip: (i) => [['m', String(i)], ['Fₘ', f6(F[i])]] },
      ], { y: Math.abs(q) <= 1 ? [Math.min(-1, ...F.map(cap)) - 0.5, Math.max(12, ...F.map(cap)) + 0.5] : [-40, 60] });
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'bars', x: U.range(MM, 1), y: corr.map(cap), color: (i) => (i >= M ? 'grid' : corr[i] >= 0 ? 'model' : 'pos'), width: 0.7, maxPx: 12, tooltip: (i) => [['m', String(i + 1)], ['поправка', f4(corr[i])]] },
      ], { y: Math.abs(q) <= 1 ? yDom(corr.concat([0]), 0.1) : [-40, 60] });
      const steps = Math.abs(q) < 1 && q !== 0 ? Math.ceil(Math.log(0.01) / Math.log(Math.abs(q)) - 1e-12) : q === 0 ? 1 : null;
      st.set('F', f4(F[M]));
      st.set('r', sci(Math.pow(Math.abs(q), M)));
      st.set('S', f4(U.sum(corr.slice(0, M))));
      st.set('k', steps === null ? 'никогда' : String(steps));
      let msg;
      if (nu < 1) msg = '0 < ν < 1: q = ' + U.fmt(q, 2) + ' > 0, поправки одного знака и убывают — прогноз подходит к цели снизу. Сумма всех поправок: ν·10·(1 + q + q² + …) = ν·10/(1 − q) = <b>10</b>. Шагов до 1 %: ln 0.01 / ln q ≈ ' + steps + ' (≈ 4.6/ν при малом ν).';
      else if (nu === 1) msg = 'ν = 1: q = 0 — цель достигнута за один шаг, дальше поправки нулевые. Для одного числа это идеально, но для настоящих данных ν = 1 означает «поверить первому дереву полностью» — со всем его шумом.';
      else if (nu < 2) msg = '1 < ν < 2: q = ' + U.fmt(q, 2) + ' < 0 — каждый шаг перелетает цель, поправки чередуют знак, а прогноз колеблется «ёлочкой» вокруг 10. Ряд всё равно сходится, потому что |q| < 1.';
      else if (nu === 2) msg = 'ν = 2: q = −1 — вечные качели 0, 20, 0, 20… Поправки не уменьшаются, ряд <b>расходится</b> (колебаниями).';
      else msg = 'ν > 2: |q| > 1 — каждая поправка больше предыдущей, прогноз разлетается. Отсюда правило «темп меньше 2» для квадратичных потерь (урок 15.11).';
      note.innerHTML = msg;
    }
    w.pythonAction(() => 'target, F, nu = 10.0, 0.0, ' + py(s.nu) + '\nfor m in range(1, ' + (s.M + 1) + '):\n    step = nu * (target - F)\n    F += step\n    print(f"m = {m:2d}: поправка {step:+.5f}, F = {F:.5f}")\nprint("остаток |1 − ν|^M =", abs(1 - nu) ** ' + s.M + ')\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 11. Гармонический ряд: группы по 2ᵏ членов
   * ============================================================================== */
  GBC.widget('harmonic-groups', (el) => {
    const s = { G: 5 };
    const GM = 12;
    const w = ui.shell(el, { title: 'Почему гармонический ряд расходится', sub: 'Разобьём 1 + ½ + ⅓ + … на группы: {½}, {⅓, ¼}, {⅕ … ⅛}, {1/9 … 1/16}, … В j-й группе 2ʲ⁻¹ членов, каждый не меньше последнего 1/2ʲ, поэтому сумма группы ≥ ½. Групп бесконечно много — сумма бесконечна.' });
    ui.player(w.controls, { label: 'Групп учтено', min: 1, max: GM, value: s.G, fps: 1.5, format: (v) => v + ' гр. (n = ' + Math.pow(2, v) + ')', onChange: (v) => ((s.G = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 210, x: { label: 'номер группы j', domain: [0.3, GM + 0.7] }, y: { label: 'сумма группы', domain: [0, 0.8] } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'n (лог. шкала)', type: 'log', domain: [1, 4096], ticks: [1, 4, 16, 64, 256, 1024, 4096] }, y: { label: 'H_n = 1 + ½ + … + 1/n', domain: [0, 9.5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'n = 2ᴳ' }, { key: 'H', label: 'Hₙ' }, { key: 'lb', label: 'оценка снизу 1 + G/2' }, { key: 'ln', label: 'ln n + γ' }]);
    function draw() {
      const G = s.G;
      const js = U.range(GM, 1);
      const gs = js.map((j) => {
        let v = 0;
        for (let k = Math.pow(2, j - 1) + 1; k <= Math.pow(2, j); k++) v += 1 / k;
        return v;
      });
      p1.render([
        { type: 'hline', y: 0.5, color: 'tree', dash: '6 4', text: '½' },
        { type: 'hline', y: Math.LN2, color: 'muted', dash: '2 4', text: 'ln 2' },
        { type: 'bars', x: js, y: gs, color: (i) => (i < G ? (i % 2 ? 'aqua' : 'model') : 'grid'), width: 0.75, maxPx: 30, tooltip: (i) => [['группа', String(i + 1)], ['члены', '1/' + (Math.pow(2, i) + 1) + ' … 1/' + Math.pow(2, i + 1)], ['сумма', f4(gs[i])]] },
      ]);
      const ns = logGrid(4096, 60);
      const Hs = sumsAt((k) => 1 / k, ns);
      const n = Math.pow(2, G);
      const pts = U.range(GM + 1).map((j) => Math.pow(2, j));
      p2.render([
        { type: 'line', x: ns, y: ns.map((v) => Math.log(v) + GAMMA), color: 'muted', dash: '5 4', width: 1.4, label: 'ln n + 0.5772', hover: false },
        { type: 'line', x: ns, y: Hs, color: 'model', width: 2.2, label: 'Hₙ', hover: false },
        { type: 'points', x: pts, y: pts.map((v, j) => 1 + j / 2), color: (i) => (i <= G ? 'tree' : 'grid'), legendColor: 'tree', r: 4, label: 'оценка 1 + j/2', tooltip: (i) => [['n', String(pts[i])], ['оценка', f3(1 + i / 2)], ['Hₙ', f4(harm(pts[i]))]] },
        { type: 'vline', x: n, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      const Hn = harm(n);
      st.set('n', String(n));
      st.set('H', f4(Hn));
      st.set('lb', f3(1 + G / 2));
      st.set('ln', f4(Math.log(n) + GAMMA));
      note.innerHTML = 'Каждая группа ≥ ½ (суммы групп растут к ln 2 ≈ 0.693), поэтому H<sub>2ᴳ</sub> ≥ 1 + G/2: при G = ' + G + ' это ' + f3(1 + G / 2) + ', а на самом деле ' + f4(Hn) + '. Оценка грубая, но неограниченная — значит, ряд расходится. Растёт он как ln n + 0.5772 (постоянная Эйлера γ): сумма превысит 10 только при n = 12 367, а 20 — примерно при n = 272 400 600.';
    }
    w.pythonAction(() => 'import math\n\nH, n = 0.0, 0\nfor G in range(1, ' + (s.G + 1) + '):\n    group = sum(1 / k for k in range(2 ** (G - 1) + 1, 2 ** G + 1))\n    H = sum(1 / k for k in range(1, 2 ** G + 1))\n    print(f"группа {G:2d}: сумма {group:.4f} ≥ 0.5;  H_{2**G} = {H:.4f} ≥ 1 + G/2 = {1 + G / 2};  ln n + γ = {math.log(2**G) + 0.5772:.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 12. Стопка книг: свес Hₙ/2 растёт без предела
   * ============================================================================== */
  GBC.widget('book-stack', (el) => {
    const s = { n: 4 };
    const NM = 40;
    const w = ui.shell(el, { title: 'Стопка книг над краем стола', sub: 'Длина книги — 1. Верхняя книга выступает над второй на ½, вторая над третьей — на ¼, k-я над (k + 1)-й — на 1/(2k). Так стопка ещё не падает: центр тяжести верхних k книг лежит точно над краем (k + 1)-й. Общий свес — Hₙ/2: половина гармонического ряда.' });
    ui.player(w.controls, { label: 'Книг n', min: 1, max: NM, value: s.n, fps: 2, format: (v) => 'n = ' + v, onChange: (v) => ((s.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 360, x: { label: 'по горизонтали (длина книги = 1)', domain: [-1.3, 2.4] }, y: { label: '', ticks: [] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'o', label: 'свес Hₙ/2' }, { key: '1', label: 'книг для свеса 1' }, { key: '2', label: 'для свеса 2' }, { key: '3', label: 'для свеса 3' }]);
    function draw() {
      const n = s.n;
      const right = new Array(n + 2).fill(0);
      for (let k = n; k >= 1; k--) right[k] = right[k + 1] + 1 / (2 * k);
      const L = [{ type: 'rect', x0: -1.3, x1: 0, y0: -1, y1: 0, fill: 'muted', stroke: 'muted', opacity: 0.35 }];
      const th = 1;
      for (let k = 1; k <= n; k++) {
        const y0 = (n - k) * th;
        L.push({ type: 'rect', x0: right[k] - 1, x1: right[k], y0, y1: y0 + th * 0.9, fill: k % 2 ? 'model' : 'aqua', stroke: 'surface', opacity: 0.75, width: 1 });
      }
      L.push({ type: 'vline', x: 0, color: 'ink2', dash: '3 3', width: 1, text: 'край стола' });
      L.push({ type: 'vline', x: 1, color: 'tree', dash: '6 4', width: 1.2, text: 'книга целиком за краем' });
      L.push({ type: 'segments', x1: [0], y1: [n * th + 0.4], x2: [right[1]], y2: [n * th + 0.4], color: 'tree', width: 3, opacity: 1 });
      L.push({ type: 'text', items: [{ x: right[1] / 2, y: n * th + 0.9, anchor: 'middle', text: 'свес ' + f3(right[1]), bold: true }] });
      plot.render(L, { y: [-1.2, Math.max(n, 8) * th + 1.6] });
      st.set('o', f4(right[1]));
      st.set('1', '4');
      st.set('2', '31');
      st.set('3', '227');
      note.innerHTML = n < 4 ? 'Пока свес меньше длины книги. Добавляйте книги снизу.' : 'При ' + n + ' книгах свес ' + f3(right[1]) + ' — ' + (right[1] >= 1 ? 'верхняя книга целиком висит в воздухе за краем стола! ' : '') + 'Поскольку гармонический ряд расходится, свес можно сделать <b>сколь угодно большим</b> — но очень дорого: для свеса 2 нужна 31 книга, для 3 — 227, для 10 — около 272 миллионов. Медленная расходимость — это всё-таки расходимость.';
    }
    w.pythonAction(() => 'n = ' + s.n + '\noverhang = sum(1 / (2 * k) for k in range(1, n + 1))\nprint("свес", n, "книг:", overhang)\nfor target in (1, 2, 3):\n    H, k = 0.0, 0\n    while H / 2 < target:\n        k += 1\n        H += 1 / k\n    print(f"свес {target}: нужно {k} книг")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 13. Признак сравнения и предельный признак
   * ============================================================================== */
  const CMP = {
    c1: { lvl: 1, a: (k) => 1 / (k * k + 1), b: (k) => 1 / (k * k), at: R`\frac{1}{k^2+1}`, bt: R`\frac{1}{k^2}`, c: 1, conv: true, how: R`0<\frac{1}{k^2+1}<\frac{1}{k^2},\ \ \sum\frac1{k^2}\ \text{сходится}\ \Rightarrow\ \text{сходится}`, py: ['1 / (k**2 + 1)', '1 / k**2'] },
    c2: { lvl: 1, a: (k) => 1 / (Math.pow(2, k) + k), b: (k) => Math.pow(2, -k), at: R`\frac{1}{2^k+k}`, bt: R`\frac{1}{2^k}`, c: 1, conv: true, how: R`\frac{1}{2^k+k}<\frac{1}{2^k},\ \ \text{геометрический ряд сходится}\ \Rightarrow\ \text{сходится}`, py: ['1 / (2**k + k)', '1 / 2**k'] },
    c3: { lvl: 1, a: (k) => 1 / (2 * k - 1), b: (k) => 1 / (2 * k), at: R`\frac{1}{2k-1}`, bt: R`\frac{1}{2k}`, c: 1, conv: false, how: R`\frac{1}{2k-1}>\frac{1}{2k},\ \ \sum\frac1{2k}=\frac12\sum\frac1k=\infty\ \Rightarrow\ \text{расходится}`, py: ['1 / (2 * k - 1)', '1 / (2 * k)'] },
    c4: { lvl: 2, a: (k) => Math.sin(1 / k), b: (k) => 1 / k, at: R`\sin\frac1k`, bt: R`\frac1k`, c: 1, conv: false, how: R`\sin\frac1k\sim\frac1k\ (\text{урок 15.4}),\ \ \frac{a_k}{b_k}\to1\ \Rightarrow\ \text{расходится, как }\sum\frac1k`, py: ['math.sin(1 / k)', '1 / k'] },
    c5: { lvl: 2, a: (k) => (2 * k + 1) / (k * k * k + 5), b: (k) => 1 / (k * k), at: R`\frac{2k+1}{k^3+5}`, bt: R`\frac{1}{k^2}`, c: 2, conv: true, how: R`\frac{2k+1}{k^3+5}\sim\frac{2k}{k^3}=\frac{2}{k^2},\ \ \frac{a_k}{b_k}\to2\ \Rightarrow\ \text{сходится}`, py: ['(2 * k + 1) / (k**3 + 5)', '1 / k**2'] },
    c6: { lvl: 2, a: (k) => k / (k * k + 3), b: (k) => 1 / k, at: R`\frac{k}{k^2+3}`, bt: R`\frac1k`, c: 1, conv: false, how: R`a_k<b_k\ (\text{не помогает}),\ \ \frac{k}{k^2+3}\sim\frac1k\ \Rightarrow\ \text{расходится}`, py: ['k / (k**2 + 3)', '1 / k'] },
    c7: { lvl: 3, a: (k) => 1 - Math.cos(1 / k), b: (k) => 1 / (k * k), at: R`1-\cos\frac1k`, bt: R`\frac{1}{k^2}`, c: 0.5, conv: true, how: R`1-\cos t\sim\frac{t^2}{2}\ \Rightarrow\ 1-\cos\frac1k\sim\frac{1}{2k^2}\ \Rightarrow\ \text{сходится}`, py: ['1 - math.cos(1 / k)', '1 / k**2'] },
    c8: { lvl: 3, a: (k) => Math.log1p(1 / (k * k)), b: (k) => 1 / (k * k), at: R`\ln\Bigl(1+\frac{1}{k^2}\Bigr)`, bt: R`\frac{1}{k^2}`, c: 1, conv: true, how: R`\ln(1+t)\sim t\ \Rightarrow\ \ln\Bigl(1+\frac1{k^2}\Bigr)\sim\frac1{k^2}\ \Rightarrow\ \text{сходится}`, py: ['math.log1p(1 / k**2)', '1 / k**2'] },
  };
  GBC.widget('comparison', (el) => {
    const s = { key: 'c1' };
    const NM = 10000;
    const w = ui.shell(el, { title: 'Сравнить с известным рядом', sub: 'Неизвестный ряд Σaₖ (синий) сравниваем с эталоном Σbₖ (оранжевый): геометрическим или p-рядом. Сверху — отношение aₖ/bₖ: если оно стремится к числу 0 < c < ∞, ряды ведут себя одинаково. Снизу — частичные суммы обоих.' });
    ui.select(w.controls, { label: 'Пример', value: s.key, options: Object.entries(CMP).map(([k, v]) => ({ value: k, label: STARS[v.lvl] + ' Σ ' + ({ c1: '1/(k²+1)', c2: '1/(2ᵏ+k)', c3: '1/(2k−1)', c4: 'sin(1/k)', c5: '(2k+1)/(k³+5)', c6: 'k/(k²+3)', c7: '1 − cos(1/k)', c8: 'ln(1 + 1/k²)' })[k] })), onChange: (v) => ((s.key = v), draw()) });
    const cc = card('Рассуждение');
    const how = H('div');
    cc.body.appendChild(how);
    w.main.appendChild(cc.el);
    const p1 = new GBC.Plot(w.main, { height: 190, x: { label: 'k (лог.)', type: 'log', domain: [1, NM], ticks: [1, 10, 100, 1000, 10000] }, y: { label: 'a_k / b_k' } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'n (лог.)', type: 'log', domain: [1, NM], ticks: [1, 10, 100, 1000, 10000] }, y: { label: 'частичные суммы' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'a/b при k = 10⁴' }, { key: 'sa', label: 'Σa до 10⁴' }, { key: 'sb', label: 'Σb до 10⁴' }, { key: 'v', label: 'итог' }]);
    function draw() {
      const C = CMP[s.key];
      texInto(how, R`\begin{gathered}a_k=${C.at},\qquad b_k=${C.bt}\\[4pt] ` + C.how + R`\end{gathered}`, true);
      const ns = logGrid(NM, 30);
      const ratio = ns.map((k) => C.a(k) / C.b(k));
      p1.render([
        { type: 'hline', y: C.c, color: 'ink2', dash: '6 4', text: 'c = ' + U.fmt(C.c, 3) },
        { type: 'line', x: ns, y: ratio, color: 'violet', width: 2.2, hover: false },
      ], { y: yDom(ratio.concat([C.c, 0]), 0.1) });
      const sa = sumsAt(C.a, ns);
      const sb = sumsAt(C.b, ns);
      p2.render([
        { type: 'line', x: ns, y: sb, color: 'tree', width: 2, dash: '6 4', label: 'эталон Σbₖ', hover: false },
        { type: 'line', x: ns, y: sa, color: 'model', width: 2.4, label: 'исследуемый Σaₖ', hover: false },
      ], { y: [0, Math.max(...sa, ...sb) * 1.08] });
      st.set('r', f4(ratio[ratio.length - 1]));
      st.set('sa', f4(sa[sa.length - 1]));
      st.set('sb', f4(sb[sb.length - 1]));
      st.set('v', C.conv ? 'сходится' : 'расходится');
      note.innerHTML = C.conv ? 'Эталон сходится, и синяя кривая выходит на «полку» вместе с оранжевой. ' + (C.c !== 1 && s.key !== 'c1' && s.key !== 'c2' ? 'Отношение стремится к ' + U.fmt(C.c, 3) + ': на хвосте aₖ ≈ ' + U.fmt(C.c, 3) + '·bₖ, поэтому хвосты рядов отличаются примерно в ' + U.fmt(C.c, 3) + ' раза.' : 'Сами суммы рядов разные — признак говорит только «сходится или нет», а не «чему равно».') : 'Эталон расходится — и исследуемый ряд растёт вместе с ним, медленно, как логарифм. ' + (s.key === 'c6' ? 'Обратите внимание: aₖ < bₖ, и обычное сравнение ничего не даёт («меньше расходящегося» может быть чем угодно). Помогает предельный признак: aₖ/bₖ → 1.' : '');
    }
    w.pythonAction(() => {
      const C = CMP[s.key];
      return 'import math\n\na = lambda k: ' + C.py[0] + '\nb = lambda k: ' + C.py[1] + '\nfor k in (10, 100, 1000, 10000):\n    print(f"k = {k:5d}: a_k/b_k = {a(k) / b(k):.6f}")\nfor n in (100, 10000, 1000000):\n    print(f"n = {n:7d}: Σa = {sum(a(k) for k in range(1, n + 1)):.6f},  Σb = {sum(b(k) for k in range(1, n + 1)):.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 14. p-ряды и интегральный признак
   * ============================================================================== */
  function zeta(p) {
    // ∑_{k=1}^{N} k^{−p} + хвост по Эйлеру — Маклорену (две поправки) — точность ~1e−10 при p ≥ 1.05
    const N = 2000;
    let s = 0;
    for (let k = 1; k <= N; k++) s += Math.pow(k, -p);
    return s + Math.pow(N, 1 - p) / (p - 1) - 0.5 * Math.pow(N, -p) + (p * Math.pow(N, -p - 1)) / 12;
  }
  GBC.widget('p-series', (el) => {
    const s = { p: 1 };
    const w = ui.shell(el, { title: 'Ряды 1 + 1/2ᵖ + 1/3ᵖ + …: где граница?', sub: 'Сверху — члены 1/kᵖ столбиками и кривая 1/xᵖ: сумма столбиков близка к площади под кривой (урок 15.9). Снизу — частичные суммы (ось n логарифмическая). Двигайте p через 1.' });
    const sl = ui.slider(w.controls, { label: 'Степень p', min: 0.5, max: 3, step: 0.05, value: s.p, onInput: (v) => ((s.p = Math.round(v * 100) / 100), draw()) });
    ui.segmented(w.controls, { label: 'Готовые', value: null, options: [{ value: 0.5, label: 'p = ½' }, { value: 1, label: 'p = 1' }, { value: 1.1, label: '1.1' }, { value: 2, label: 'p = 2' }], onChange: (v) => ((s.p = v), sl.set(v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 200, x: { label: 'k', domain: [0.5, 10.5] }, y: { label: '1/k^p', domain: [0, 1.05] } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'n (лог.)', type: 'log', domain: [1, 100000], ticks: [1, 10, 100, 1000, 10000, 100000] }, y: { label: 'S_n' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 's1', label: 'S₁₀₀₀' }, { key: 's2', label: 'S₁₀₀₀₀₀' }, { key: 'I', label: '∫₁^∞ x⁻ᵖ dx' }, { key: 'lim', label: 'сумма ряда' }]);
    function draw() {
      const p = s.p;
      const ks = U.range(10, 1);
      const xs = U.linspace(0.5, 10.5, 240).filter((x) => x >= 1);
      p1.render([
        { type: 'bars', x: ks, y: ks.map((k) => Math.pow(k, -p)), color: 'model', width: 0.98, maxPx: 80, opacity: 0.5, label: 'члены 1/kᵖ' },
        { type: 'line', x: xs, y: xs.map((x) => Math.pow(x, -p)), color: 'tree', width: 2.4, label: 'кривая 1/xᵖ', hover: false },
      ]);
      const ns = logGrid(100000, 20);
      const sums = sumsAt((k) => Math.pow(k, -p), ns);
      const conv = p > 1.0001;
      const Z = conv ? zeta(p) : null;
      p2.render([
        conv ? { type: 'hline', y: Z, color: 'tree', dash: '6 4', text: 'сумма ≈ ' + U.fmt(Z, 4) } : null,
        Math.abs(p - 1) < 0.001 ? { type: 'line', x: ns, y: ns.map((n) => Math.log(n) + GAMMA), color: 'muted', dash: '4 4', width: 1.4, label: 'ln n + 0.5772', hover: false } : null,
        { type: 'line', x: ns, y: sums, color: 'model', width: 2.4, label: 'Sₙ', hover: false },
      ], { y: [0, Math.min(Math.max(...sums, conv ? Z : 0) * 1.08, 700)] });
      const at = (n) => sums[ns.indexOf(n)];
      st.set('s1', f4(at(1000)));
      st.set('s2', f4(at(100000)));
      st.set('I', conv ? f4(1 / (p - 1)) : '∞');
      st.set('lim', conv ? f4(Z) : '∞');
      note.innerHTML = conv
        ? 'p > 1: площадь под 1/xᵖ от 1 до ∞ конечна и равна 1/(p − 1), а сумма столбиков не больше 1 + 1/(p − 1) — ряд <b>сходится</b>.' + (Math.abs(p - 2) < 0.001 ? ' При p = 2 сумма равна π²/6 ≈ 1.6449 (задача Базеля, Эйлер, 1734).' : Math.abs(p - 1.1) < 0.001 ? ' Но как медленно! Сумма ≈ 10.58, а сто тысяч членов дают только ' + f3(at(100000)) + '. Сходимость — это обещание «когда-нибудь», а не «быстро».' : '')
        : 'p ≤ 1: площадь под 1/xᵖ бесконечна, и ряд <b>расходится</b>, хотя члены стремятся к нулю. ' + (Math.abs(p - 1) < 0.001 ? 'Граничный случай p = 1 — гармонический ряд: растёт как ln n + γ.' : 'При p < 1 частичные суммы растут как n¹⁻ᵖ/(1 − p) — быстрее логарифма.');
    }
    w.pythonAction(() => 'import numpy as np\n\np = ' + py(s.p) + '\nk = np.arange(1, 100001)\nS = np.cumsum(1 / k**p)\nfor n in (10, 1000, 100000):\n    print(f"S_{n} = {S[n - 1]:.6f}")\n' + (s.p > 1 ? 'print("площадь ∫₁^∞ x^(−p) dx =", 1 / (p - 1))\n' : ''));
    draw();
  });

  /* ==============================================================================
   * Шаг 14. Интегральные оценки суммы и остатка
   * ============================================================================== */
  const IB = {
    p2: { label: '1/x² → Σ 1/k² = π²/6', f: (x) => 1 / (x * x), tail: (n) => 1 / n, S: (PI * PI) / 6, ftex: R`\frac{1}{x^2}`, tailTex: R`\int_n^\infty\frac{dx}{x^2}=\frac1n`, py: ['1 / x**2', '1 / n'] },
    p15: { label: '1/x^1.5 → Σ 1/k^1.5 ≈ 2.6124', f: (x) => Math.pow(x, -1.5), tail: (n) => 2 / Math.sqrt(n), S: 2.612375348685488, ftex: R`\frac{1}{x^{3/2}}`, tailTex: R`\int_n^\infty\frac{dx}{x^{3/2}}=\frac{2}{\sqrt n}`, py: ['x**-1.5', '2 / math.sqrt(n)'] },
    arc: { label: '1/(1 + x²) → Σ 1/(1 + k²) ≈ 1.0767', f: (x) => 1 / (1 + x * x), tail: (n) => PI / 2 - Math.atan(n), S: 1.0766740474685811, ftex: R`\frac{1}{1+x^2}`, tailTex: R`\int_n^\infty\frac{dx}{1+x^2}=\frac{\pi}{2}-\operatorname{arctg} n`, py: ['1 / (1 + x**2)', 'math.pi / 2 - math.atan(n)'] },
    p1: { label: '1/x → гармонический (расходится)', f: (x) => 1 / x, tail: () => Infinity, S: Infinity, ftex: R`\frac1x`, tailTex: R`\int_n^\infty\frac{dx}{x}=\infty`, py: ['1 / x', 'math.inf'] },
  };
  GBC.widget('integral-bounds', (el) => {
    const s = { key: 'p2', n: 5 };
    const w = ui.shell(el, { title: 'Ряд зажат между двумя площадями', sub: 'Для убывающей f: столбик f(k) на [k, k + 1] лежит выше кривой (оранжевый), столбик f(k + 1) на [k, k + 1] — ниже (синий). Поэтому сумма ряда зажата между площадями — и мы получаем не только «сходится», но и оценку суммы и её остатка.' });
    ui.select(w.controls, { label: 'Функция', value: s.key, options: Object.entries(IB).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.player(w.controls, { label: 'Сложено членов n', min: 1, max: 20, value: s.n, fps: 2, format: (v) => 'n = ' + v, onChange: (v) => ((s.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'f(x)' } });
    const tb = H('div');
    w.main.appendChild(tb);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'S', label: 'Sₙ' }, { key: 'lo', label: 'нижняя оценка суммы' }, { key: 'hi', label: 'верхняя оценка' }, { key: 'mid', label: 'Sₙ + ∫ от n + ½' }, { key: 'ex', label: 'точная сумма' }]);
    function draw() {
      const B = IB[s.key];
      const n = s.n;
      const view = Math.min(Math.max(n + 3, 7), 22);
      const L = [];
      for (let k = 1; k <= Math.min(view, n + 3); k++) {
        const on = k <= n;
        L.push({ type: 'rect', x0: k, x1: k + 1, y0: 0, y1: B.f(k), fill: on ? 'tree' : 'grid', stroke: on ? 'tree' : 'grid', opacity: on ? 0.22 : 0.1, width: 1 });
        L.push({ type: 'rect', x0: k, x1: k + 1, y0: 0, y1: B.f(k + 1), fill: on ? 'model' : 'grid', stroke: on ? 'model' : 'grid', opacity: on ? 0.35 : 0.12, width: 1 });
      }
      const xs = U.linspace(1, view + 1, 400);
      L.push({ type: 'line', x: xs, y: xs.map(B.f), color: 'ink', width: 2.2, label: 'f(x) = ' + ({ p2: '1/x²', p15: '1/x^1.5', arc: '1/(1 + x²)', p1: '1/x' })[s.key], hover: false });
      L.push({ type: 'vline', x: n + 1, color: 'ink2', dash: '3 3', width: 1, text: 'x = n + 1' });
      plot.render(L, { x: [0.8, view + 1.2], y: [0, B.f(1) * 1.08] });
      let Sn = 0;
      for (let k = 1; k <= n; k++) Sn += B.f(k);
      const lo = Sn + B.tail(n + 1);
      const hi = Sn + B.tail(n);
      const mid = Sn + B.tail(n + 0.5);
      texInto(tb, R`S_n+\int_{n+1}^{\infty}f\;\le\;S\;\le\;S_n+\int_{n}^{\infty}f,\qquad ` + B.tailTex, true);
      st.set('S', f6(Sn));
      st.set('lo', Number.isFinite(lo) ? f6(lo) : '∞');
      st.set('hi', Number.isFinite(hi) ? f6(hi) : '∞');
      st.set('mid', Number.isFinite(mid) ? f6(mid) : '∞');
      st.set('ex', Number.isFinite(B.S) ? f6(B.S) : '∞');
      note.innerHTML = Number.isFinite(B.S)
        ? 'Остаток rₙ = f(n + 1) + f(n + 2) + … зажат между ∫ от n + 1 и ∫ от n до ∞. Значит, точная сумма лежит в отрезке [' + f6(lo) + ', ' + f6(hi) + '] шириной ' + sci(hi - lo) + '. А поправка «интеграл от n + ½» даёт ' + f6(mid) + ' — ошибка всего ' + sci(Math.abs(mid - B.S)) + ' при ' + n + ' член' + (n === 1 ? 'е' : 'ах') + '. Так интегралы ускоряют суммирование медленных рядов.'
        : 'Площадь под 1/x от 1 до ∞ бесконечна, а синие столбики (сумма 1/2 + … + 1/(n + 1)) лежат ниже кривой, оранжевые — выше. Hₙ ≥ ∫₁ⁿ⁺¹ dx/x = ln(n + 1) → ∞: ряд расходится.';
    }
    w.pythonAction(() => {
      const B = IB[s.key];
      return 'import math\n\nf = lambda x: ' + B.py[0] + '\ntail = lambda n: ' + B.py[1] + '   # ∫_n^∞ f(x) dx\nn = ' + s.n + '\nS_n = sum(f(k) for k in range(1, n + 1))\nprint("S_n =", S_n)\nprint("сумма в отрезке [", S_n + tail(n + 1), ",", S_n + tail(n), "]")\nprint("оценка S_n + ∫ от n + ½:", S_n + tail(n + 0.5))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 15. Признаки Д’Аламбера (отношения) и Коши (корневой)
   * ============================================================================== */
  const RT = {
    r1: { lvl: 1, label: 'Σ n/2ⁿ', la: (n) => Math.log(n) - n * Math.LN2, r: 0.5, conv: true, sum: 2, sumTxt: '2', tex: R`\frac{a_{n+1}}{a_n}=\frac{n+1}{2n}\to\frac12`, py: 'n / 2**n', nMax: 60 },
    r2: { lvl: 1, label: 'Σ 2ⁿ/n!', la: (n) => n * Math.LN2 - lfact(n), r: 0, conv: true, sum: Math.exp(2) - 1, sumTxt: 'e² − 1 ≈ 6.389', tex: R`\frac{a_{n+1}}{a_n}=\frac{2}{n+1}\to0`, py: '2**n / math.factorial(n)', nMax: 60 },
    r3: { lvl: 2, label: 'Σ n!/nⁿ', la: (n) => lfact(n) - n * Math.log(n), r: 1 / Math.E, conv: true, sum: 1.8798538621752585, sumTxt: '≈ 1.8799', tex: R`\frac{a_{n+1}}{a_n}=\Bigl(\frac{n}{n+1}\Bigr)^{n}\to\frac1e`, py: 'math.factorial(n) / n**n', nMax: 60 },
    r4: { lvl: 3, label: 'Σ n¹⁰/1.1ⁿ', la: (n) => 10 * Math.log(n) - n * Math.log(1.1), r: 1 / 1.1, conv: true, sum: 6.155039657940986e17, sumTxt: '≈ 6.16·10¹⁷', tex: R`\frac{a_{n+1}}{a_n}=\Bigl(\frac{n+1}{n}\Bigr)^{10}\frac{1}{1.1}\to\frac{1}{1.1}`, py: 'n**10 / 1.1**n', nMax: 600 },
    r5: { lvl: 2, label: 'Σ (n/(2n + 1))ⁿ — корневой', la: (n) => n * Math.log(n / (2 * n + 1)), r: 0.5, conv: true, sum: 0.6497624069507308, sumTxt: '≈ 0.6498', tex: R`\sqrt[n]{a_n}=\frac{n}{2n+1}\to\frac12`, py: '(n / (2 * n + 1))**n', nMax: 60 },
    r6: { lvl: 2, label: 'Σ 3ⁿ/n³', la: (n) => n * Math.log(3) - 3 * Math.log(n), r: 3, conv: false, sumTxt: '∞', tex: R`\frac{a_{n+1}}{a_n}=3\Bigl(\frac{n}{n+1}\Bigr)^{3}\to3>1`, py: '3**n / n**3', nMax: 60 },
    r7: { lvl: 2, label: 'Σ 1/n — признак молчит', la: (n) => -Math.log(n), r: 1, conv: false, sumTxt: '∞', tex: R`\frac{a_{n+1}}{a_n}=\frac{n}{n+1}\to1\ (\text{неизвестно})`, py: '1 / n', nMax: 60 },
    r8: { lvl: 2, label: 'Σ 1/n² — признак молчит', la: (n) => -2 * Math.log(n), r: 1, conv: true, sum: (PI * PI) / 6, sumTxt: 'π²/6', tex: R`\frac{a_{n+1}}{a_n}=\Bigl(\frac{n}{n+1}\Bigr)^2\to1\ (\text{неизвестно})`, py: '1 / n**2', nMax: 60 },
  };
  GBC.widget('ratio-root', (el) => {
    const s = { key: 'r1' };
    const w = ui.shell(el, { title: 'Признаки отношения и корня: «похож ли ряд на геометрический?»', sub: 'Если отношение соседних членов aₙ₊₁/aₙ (или корень ⁿ√aₙ) стремится к r < 1, хвост ряда ведёт себя как геометрический ряд со знаменателем r — ряд сходится. r > 1 — члены растут, ряд расходится. r = 1 — признак ничего не говорит.' });
    ui.select(w.controls, { label: 'Ряд', value: s.key, options: Object.entries(RT).map(([k, v]) => ({ value: k, label: STARS[v.lvl] + ' ' + v.label })), onChange: (v) => ((s.key = v), draw()) });
    const tx = H('div', { style: 'margin:2px 0 6px' });
    w.main.appendChild(tx);
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'n' }, y: { label: 'отношение и корень' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'n' }, y: { label: 'член a_n (лог.)', type: 'log' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'q', label: 'aₙ₊₁/aₙ (последнее n)' }, { key: 'rt', label: 'ⁿ√aₙ (последнее n)' }, { key: 'r', label: 'предел r' }, { key: 'S', label: 'сумма' }]);
    function draw() {
      const T = RT[s.key];
      const N = T.nMax;
      const ns = U.range(N, 1);
      texInto(tx, T.tex, true);
      const ratio = ns.map((n) => Math.exp(T.la(n + 1) - T.la(n)));
      const root = ns.map((n) => Math.exp(T.la(n) / n));
      const ymax = Math.max(1.4, Math.min(4, Math.max(...ratio.slice(2), ...root.slice(2)) * 1.1));
      p1.render([
        { type: 'hline', y: 1, color: 'pos', width: 1.2, text: 'граница 1' },
        { type: 'hline', y: T.r, color: 'ink2', dash: '6 4', text: 'r = ' + U.fmt(T.r, 3) },
        { type: 'line', x: ns, y: ratio.map((v) => Math.min(v, 6)), color: 'violet', width: 2.2, label: 'aₙ₊₁/aₙ (Д’Аламбер)', hover: false },
        { type: 'line', x: ns, y: root.map((v) => Math.min(v, 6)), color: 'aqua', width: 2.2, dash: '6 3', label: 'ⁿ√aₙ (Коши)', hover: false },
      ], { x: [1, N], y: [0, ymax] });
      const la = ns.map(T.la).map((v) => v / Math.LN10);
      const lo = Math.max(Math.min(...la), -300);
      const hi = Math.min(Math.max(...la), 300);
      let a = Math.floor(lo);
      let b = Math.ceil(hi);
      if (b <= a) b = a + 1;
      const stp = Math.max(1, Math.ceil((b - a) / 6));
      a = Math.floor(a / stp) * stp;
      b = a + Math.ceil((b - a) / stp) * stp;
      p2.opts.y.ticks = decades(a, b, stp);
      p2.opts.y.format = powFmt;
      p2.render([
        { type: 'line', x: ns, y: la.map((v) => Math.pow(10, v)), color: 'model', width: 2, hover: false },
        { type: 'points', x: ns, y: la.map((v) => Math.pow(10, v)), color: 'model', r: N > 100 ? 1.8 : 3, tooltip: (i) => [['n', String(i + 1)], ['aₙ', sci(Math.pow(10, la[i]))]] },
      ], { x: [1, N], y: [Math.pow(10, a), Math.pow(10, b)] });
      st.set('q', f4(ratio[N - 1]));
      st.set('rt', f4(root[N - 1]));
      st.set('r', U.fmt(T.r, 4));
      st.set('S', T.sumTxt);
      const tips = {
        r1: 'Начиная с некоторого n каждый член меньше предыдущего примерно вдвое — хвост похож на геометрический ряд с q = ½. Сумма Σ n/2ⁿ = 2 (шаг 9).',
        r2: 'Отношение → 0: факториал побеждает любую показательную функцию. Это ряд Тейлора для eˣ при x = 2 без первого члена: сумма e² − 1.',
        r3: 'Отношение (n/(n + 1))ⁿ = 1/(1 + 1/n)ⁿ → 1/e ≈ 0.368 — замечательный предел из урока 15.4. Ряд сходится.',
        r4: 'Подвох: первые сто членов <b>растут</b> (максимум при n = 105, около 10¹⁶), и кажется, что ряд расходится. Но отношение → 1/1.1 < 1: показательная функция всё равно побеждает степень. Сумма огромна (≈ 6.16·10¹⁷), но конечна. Признак смотрит только на хвост.',
        r5: 'Члены — n-е степени, поэтому удобнее корень: ⁿ√aₙ = n/(2n + 1) → ½. Отношение тоже стремится к ½, но считать его тяжелее.',
        r6: 'r = 3 > 1: члены сами растут к бесконечности — ряд расходится (необходимое условие нарушено).',
        r7: 'r = 1, а ряд расходится. Сравните со следующим примером: там тоже r = 1, но ряд сходится. Признак отношения не различает «степенные» ряды — для них нужны сравнение или интегральный признак.',
        r8: 'r = 1, а ряд сходится (p-ряд с p = 2). При r = 1 признак отношения бессилен.',
      };
      note.innerHTML = tips[s.key];
    }
    w.pythonAction(() => {
      const T = RT[s.key];
      return 'import math\n\na = lambda n: ' + T.py + '\nfor n in (5, 20, ' + T.nMax + '):\n    print(f"n = {n:3d}: a(n+1)/a(n) = {a(n + 1) / a(n):.5f},  a(n)^(1/n) = {a(n) ** (1 / n):.5f}")\n' + (T.conv ? 'print("сумма ≈", sum(a(n) for n in range(1, ' + (s.key === 'r4' ? 2000 : 150) + ')))\n' : '');
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 16. Как выбрать признак: решатель по шагам
   * ============================================================================== */
  const CH = [
    { lvl: 1, name: 'Σ (n + 1)/(2n + 3)', tex: R`\sum_{n=1}^\infty\frac{n+1}{2n+3}`, a: (n) => (n + 1) / (2 * n + 3), conv: false, steps: [
      ['Члены стремятся к нулю?', R`\frac{n+1}{2n+3}\to\frac12\ne0`, 'bad'],
      ['Необходимое условие нарушено — дальше можно не проверять', R`\Rightarrow\ \text{расходится}`]] },
    { lvl: 1, name: 'Σ 5/3ⁿ', tex: R`\sum_{n=1}^\infty\frac{5}{3^n}`, a: (n) => 5 / Math.pow(3, n), conv: true, sum: 2.5, steps: [
      ['Члены → 0?', R`\frac{5}{3^n}\to0`, 'good'],
      ['Известный тип? Да — геометрический, q = 1/3', R`\sum_{n=1}^\infty\frac{5}{3^n}=\frac{5/3}{1-1/3}=\frac52`, 'good'],
      ['Сразу и сходимость, и сумма', R`\Rightarrow\ \text{сходится к } 2.5`]] },
    { lvl: 2, name: 'Σ (3n² + 1)/(n⁴ + n)', tex: R`\sum_{n=1}^\infty\frac{3n^2+1}{n^4+n}`, a: (n) => (3 * n * n + 1) / (Math.pow(n, 4) + n), conv: true, steps: [
      ['Члены → 0?', R`\frac{3n^2+1}{n^4+n}\to0`, 'good'],
      ['Дробь из многочленов — оставим старшие степени', R`\frac{3n^2+1}{n^4+n}\sim\frac{3n^2}{n^4}=\frac{3}{n^2}`, 'good'],
      ['Предельный признак сравнения с p-рядом, p = 2 > 1', R`\Rightarrow\ \text{сходится}`]] },
    { lvl: 2, name: 'Σ 1/(2n + 5)', tex: R`\sum_{n=1}^\infty\frac{1}{2n+5}`, a: (n) => 1 / (2 * n + 5), conv: false, steps: [
      ['Члены → 0?', R`\frac{1}{2n+5}\to0`, 'good'],
      ['Признак отношения?', R`\frac{a_{n+1}}{a_n}=\frac{2n+5}{2n+7}\to1`, 'skip'],
      ['Сравним со старшей частью', R`\frac{1}{2n+5}\sim\frac{1}{2n}`, 'good'],
      ['Половина гармонического ряда расходится', R`\Rightarrow\ \text{расходится (как }\ln n)`]] },
    { lvl: 2, name: 'Σ n³/3ⁿ', tex: R`\sum_{n=1}^\infty\frac{n^3}{3^n}`, a: (n) => Math.pow(n, 3) / Math.pow(3, n), conv: true, sum: 4.125, steps: [
      ['Члены → 0?', R`\frac{n^3}{3^n}\to0`, 'good'],
      ['Есть показательная функция — признак отношения', R`\frac{a_{n+1}}{a_n}=\Bigl(\frac{n+1}{n}\Bigr)^3\frac13\to\frac13<1`, 'good'],
      ['Хвост — почти геометрический ряд', R`\Rightarrow\ \text{сходится (сумма } 33/8 = 4.125)`]] },
    { lvl: 2, name: 'Σ n!/10ⁿ', tex: R`\sum_{n=1}^\infty\frac{n!}{10^n}`, a: (n) => Math.exp(lfact(n) - n * Math.LN10), conv: false, steps: [
      ['Факториал — признак отношения', R`\frac{a_{n+1}}{a_n}=\frac{n+1}{10}\to\infty`, 'bad'],
      ['Члены сначала убывают (до n = 9), потом растут без предела', R`a_n\to\infty\ \Rightarrow\ \text{расходится}`]] },
    { lvl: 2, name: 'Σ sin²n / n²', tex: R`\sum_{n=1}^\infty\frac{\sin^2 n}{n^2}`, a: (n) => Math.pow(Math.sin(n), 2) / (n * n), conv: true, steps: [
      ['Члены неотрицательны и → 0', R`0\le\frac{\sin^2 n}{n^2}`, 'good'],
      ['Предела отношения нет — sin² n скачет', R`\frac{a_{n+1}}{a_n}\ \text{не имеет предела}`, 'skip'],
      ['Оценим сверху: sin² n ≤ 1', R`\frac{\sin^2 n}{n^2}\le\frac{1}{n^2}`, 'good'],
      ['Признак сравнения', R`\Rightarrow\ \text{сходится}`]] },
    { lvl: 2, name: 'Σ (−1)ⁿ⁺¹/ln(n + 1)', tex: R`\sum_{n=1}^\infty\frac{(-1)^{n+1}}{\ln(n+1)}`, a: (n) => (n % 2 ? 1 : -1) / Math.log(n + 1), conv: true, steps: [
      ['Знаки чередуются — признак Лейбница (шаг 17)', R`\frac{1}{\ln(n+1)}\downarrow0`, 'good'],
      ['Модули убывают и → 0', R`\Rightarrow\ \text{сходится}`, 'good'],
      ['А абсолютно? Ряд из модулей больше гармонического', R`\frac{1}{\ln(n+1)}>\frac{1}{n+1}\ \Rightarrow\ \sum|a_n|=\infty`, 'bad'],
      ['Итог', R`\text{сходится условно (шаг 18)}`]] },
    { lvl: 3, name: 'Σ 1/(n ln n), n ≥ 2', tex: R`\sum_{n=2}^\infty\frac{1}{n\ln n}`, a: (n) => (n < 2 ? 0 : 1 / (n * Math.log(n))), conv: false, steps: [
      ['Члены → 0', R`\frac{1}{n\ln n}\to0`, 'good'],
      ['Отношение', R`\frac{a_{n+1}}{a_n}\to1`, 'skip'],
      ['Сравнение с 1/n: члены меньше — не помогает', R`\frac{1}{n\ln n}<\frac1n`, 'skip'],
      ['Интегральный признак: f(x) = 1/(x ln x) убывает', R`\int_2^N\frac{dx}{x\ln x}=\ln\ln N-\ln\ln 2\to\infty`, 'bad'],
      ['Итог: расходится — медленнее любой «обычной» функции', R`S_N\approx\ln\ln N`]] },
    { lvl: 3, name: 'Σ (1 − 1/n)^(n²)', tex: R`\sum_{n=1}^\infty\Bigl(1-\frac1n\Bigr)^{n^2}`, a: (n) => Math.pow(1 - 1 / n, n * n), conv: true, steps: [
      ['Показатель n² — удобен корневой признак', R`\sqrt[n]{a_n}=\Bigl(1-\frac1n\Bigr)^{n}`, 'good'],
      ['Замечательный предел (урок 15.4)', R`\Bigl(1-\frac1n\Bigr)^{n}\to\frac1e<1`, 'good'],
      ['Итог', R`\Rightarrow\ \text{сходится}`]] },
  ];
  GBC.widget('test-chooser', (el) => {
    const s = { i: 0, k: 1 };
    const NM = 10000;
    const w = ui.shell(el, { foot: false, title: 'Какой признак применить: разбор по шагам', sub: 'Порядок проверки: члены → 0? → известный тип (геометрический, p-ряд, телескоп)? → факториалы и степени — отношение или корень → дроби из многочленов — сравнение → знаки чередуются — Лейбниц → если ничего не помогло — интегральный признак. Нажимайте «шаг вперёд».' });
    const player = ui.player(w.controls, { label: 'Шаг разбора', min: 0, max: CH[0].steps.length, value: 1, fps: 0.8, format: (k, m) => 'шаг ' + k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    ui.select(w.controls, { label: 'Ряд', value: '0', options: CH.map((C, i) => ({ value: String(i), label: STARS[C.lvl] + ' ' + C.name })), onChange: (v) => {
      s.i = +v;
      player.setMax(CH[s.i].steps.length);
      player.set(1);
      s.k = 1;
      draw();
    } });
    const pc = card('Ряд');
    const probTex = H('div');
    pc.body.appendChild(probTex);
    const list = H('ol', { style: 'margin:8px 0 0;padding-left:1.4em;display:grid;gap:6px' });
    pc.body.appendChild(list);
    w.main.appendChild(pc.el);
    const plot = new GBC.Plot(w.main, { height: 210, x: { label: 'n (лог.)', type: 'log', domain: [1, NM], ticks: [1, 10, 100, 1000, 10000] }, y: { label: 'S_n' } });
    const note = w.note('', true);
    function draw() {
      const C = CH[s.i];
      texInto(probTex, C.tex, true);
      stepList(list, C.steps, s.k);
      const ns = logGrid(NM, 25);
      const sums = sumsAt(C.a, ns).map((v) => (Number.isFinite(v) && Math.abs(v) < 1e9 ? v : NaN));
      plot.render([
        C.sum !== undefined ? { type: 'hline', y: C.sum, color: 'tree', dash: '6 4', text: 'сумма ' + U.fmt(C.sum, 4) } : null,
        { type: 'line', x: ns, y: sums, color: 'model', width: 2.2, hover: false },
      ], { y: yDom(sums.filter((v, i) => ns[i] > 3).concat(C.sum !== undefined ? [C.sum] : [], [0]), 0.08) });
      const fin = s.k >= C.steps.length;
      note.innerHTML = fin ? 'Итог: ряд <b>' + (C.conv ? 'сходится' : 'расходится') + '</b>. График частичных сумм (до n = 10 000) — численная проверка, а не доказательство: ' + (s.i === 8 ? 'здесь суммы растут как ln ln n и к n = 10 000 едва достигают ' + f3(sums[sums.length - 1]) + ' — на глаз не отличить от сходящегося ряда!' : 'по картинке легко ошибиться, поэтому нужны признаки.') : s.k === 0 ? 'Попробуйте сначала решить сами, затем нажимайте «шаг вперёд».' : 'Шаг ' + s.k + ' из ' + C.steps.length + '. Какую проверку вы сделали бы следующей?';
    }
    draw();
  });

  GBC.lesson1510 = {
    f2, f3, f4, f6, py, sci, sup, powFmt, decades, logAxis, yDom, psums, lfact, fact, harm, GAMMA, logGrid, sumsAt,
    texInto, texEl, card, cardGrid, badge, rowTable, stepList, STARS, plural,
  };
})();
