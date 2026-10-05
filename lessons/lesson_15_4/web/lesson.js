/* Урок 15.4: техника пределов и непрерывность. Часть 1 — правила, алгебраические приёмы, сжатие и
 * замечательные пределы.
 * Виджеты: арифметика пределов, предел сложной функции, лаборатория форм (определённые формы и семь
 * неопределённостей), гонка к нулю, пошаговый решатель (сокращение, сопряжённое, старшая степень,
 * ∞ − ∞ и 0·∞), разность бесконечностей, теорема о сжатии, площади на окружности, семейство синуса,
 * сложные проценты, форма 1^∞, экспонента и логарифм около нуля.
 * Общие помощники выставлены в GBC.lesson154 — ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  /* ==============================================================================
   * Общие помощники урока
   * ============================================================================== */
  /** Табуляция функции для слоя 'line': NaN там, где функции нет, разрывы на скачках. */
  function curve(fn, x0, x1, n = 801, o = {}) {
    const x = [];
    const y = [];
    let prev = NaN;
    const xs = o.xs || U.linspace(x0, x1, n);
    for (const t of xs) {
      if (o.skip !== undefined && o.skip !== null && Math.abs(t - o.skip) < 1e-12) {
        x.push(t);
        y.push(NaN);
        prev = NaN;
        continue;
      }
      let r = fn(t);
      if (!Number.isFinite(r) || (o.cap !== undefined && Math.abs(r) > o.cap) || (o.pos && !(r > 0))) r = NaN;
      if (o.jump !== undefined && Number.isFinite(prev) && Number.isFinite(r) && Math.abs(r - prev) > o.jump) {
        x.push(t);
        y.push(NaN);
      }
      x.push(t);
      y.push(r);
      prev = r;
    }
    return { x, y };
  }
  /** Сетка по x, сгущающаяся к точке a (крутые и колеблющиеся участки выходят гладкими). */
  function denseNear(x0, x1, a, n = 700) {
    const xs = U.linspace(x0, x1, n);
    const span = Math.max(Math.abs(x1 - a), Math.abs(a - x0));
    for (let i = 0; i <= 300; i++) {
      const t = span * Math.pow(10, -5 + (5 * i) / 300);
      if (a + t > x0 && a + t < x1) xs.push(a + t);
      if (a - t > x0 && a - t < x1) xs.push(a - t);
    }
    return xs.sort((p, q) => p - q).filter((x) => Math.abs(x - a) > 1e-13);
  }
  /** n точек, равномерных в логарифмическом масштабе от 10^p0 до 10^p1. */
  const logspace = (p0, p1, n) => U.linspace(p0, p1, n).map((p) => Math.pow(10, p));
  /** Значение для логарифмической оси: NaN вне (lo, hi). */
  const clipLog = (v, lo, hi) => (Number.isFinite(v) && v > lo && v < hi ? v : NaN);
  /** Деления логарифмической оси: каждые step порядков. */
  const decadeTicks = (p0, p1, step = 1) => {
    const t = [];
    for (let p = p0; p <= p1; p += step) t.push(Math.pow(10, p));
    return t;
  };
  /** Подпись логарифмической оси: 10⁻⁶, 0.01, 1, 100, 10⁴. */
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function powFmt(v) {
    const e = Math.round(Math.log10(v));
    if (Math.abs(v - Math.pow(10, e)) > 1e-9 * v) return U.fmt(v, 2);
    if (e >= -2 && e <= 3) return String(Number(v.toPrecision(3)));
    return '10' + String(e).split('').map((c) => SUP[c]).join('');
  }
  /** Формула KaTeX в элементе; если KaTeX ещё грузится — перерисуем по событию mathready. */
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
  function card(title, plain = false) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums;overflow-x:auto;overflow-y:hidden' });
    const head = plain ? 'font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px' : 'font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px';
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' },
      H('div', { style: head }, title), body);
    return { el, body };
  }
  const cardGrid = (min = 200) => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(' + min + 'px,1fr));gap:10px;margin:4px 0 10px' });
  /** Плашка-вердикт: kind = good | bad | neutral. */
  function badge(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : 'background:var(--surface-2, rgba(127,127,127,.12));color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;' + st }, text);
  }
  /** Таблица в контейнере (перерисовка). */
  function rowTable(parent, columns, rows, highlight) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight });
  }
  /** Числовая производная (центральная разность). */
  const slope = (f, x, h = 1e-6) => (f(x + h) - f(x - h)) / (2 * h);
  /** Текст предела: число или ±∞. */
  const fmtL = (L, d = 4) => (L === Infinity ? '+∞' : L === -Infinity ? '−∞' : L === null || L === undefined ? 'нет' : U.fmt(L, d));
  /** Число для Python. */
  const py = (v) => (v === Infinity ? 'np.inf' : v === -Infinity ? '-np.inf' : U.pyNum(v));
  /** Контейнер параметров, которые меняются вместе с выбранным примером. */
  function paramBox(parent) {
    const box = H('div');
    parent.appendChild(box);
    return {
      box,
      reset(specs, values, onInput) {
        box.textContent = '';
        for (const s of specs) {
          if (values[s.key] === undefined) values[s.key] = s.value;
          ui.slider(box, { label: s.label, min: s.min, max: s.max, step: s.step, value: values[s.key], format: s.format, onInput: (v) => ((values[s.key] = v), onInput()) });
        }
      },
    };
  }
  const sigma = (z) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));

  /* ==============================================================================
   * 1. Арифметика пределов: пределы частей → предел комбинации
   * ============================================================================== */
  const PAIRS = {
    poly: { label: 'f = x², g = 3x − 1, x → 2', f: (x) => x * x, g: (x) => 3 * x - 1, a: 2, A: 4, B: 5, dom: [0.4, 3.6], fpy: 'x**2', gpy: '3*x - 1', ft: 'x²', gt: '3x − 1' },
    root: { label: 'f = √x, g = x − 1, x → 4', f: Math.sqrt, g: (x) => x - 1, a: 4, A: 2, B: 3, dom: [0.5, 7.5], fpy: 'np.sqrt(x)', gpy: 'x - 1', ft: '√x', gt: 'x − 1' },
    zero: { label: 'f = x² − 4, g = x − 2, x → 2 (оба → 0)', f: (x) => x * x - 4, g: (x) => x - 2, a: 2, A: 0, B: 0, dom: [0.4, 3.6], fpy: 'x**2 - 4', gpy: 'x - 2', ft: 'x² − 4', gt: 'x − 2', quot: 4 },
    pole: { label: 'f = x + 1, g = x − 2, x → 2 (g → 0)', f: (x) => x + 1, g: (x) => x - 2, a: 2, A: 3, B: 0, dom: [0.4, 3.6], fpy: 'x + 1', gpy: 'x - 2', ft: 'x + 1', gt: 'x − 2' },
  };
  const OPS = {
    sum: { label: 'f + g', h: (f, g) => f + g, rule: (A, B) => A + B, txt: 'A + B', pyop: 'f(x) + g(x)' },
    diff: { label: 'f − g', h: (f, g) => f - g, rule: (A, B) => A - B, txt: 'A − B', pyop: 'f(x) - g(x)' },
    prod: { label: 'f · g', h: (f, g) => f * g, rule: (A, B) => A * B, txt: 'A · B', pyop: 'f(x) * g(x)' },
    quot: { label: 'f / g', h: (f, g) => f / g, rule: (A, B) => (B !== 0 ? A / B : NaN), txt: 'A / B', pyop: 'f(x) / g(x)' },
    lin: { label: '3f − 2g', h: (f, g) => 3 * f - 2 * g, rule: (A, B) => 3 * A - 2 * B, txt: '3A − 2B', pyop: '3*f(x) - 2*g(x)' },
    sq: { label: 'f²', h: (f) => f * f, rule: (A) => A * A, txt: 'A²', pyop: 'f(x)**2' },
  };
  GBC.widget('limit-algebra', (el) => {
    const st0 = { pair: 'poly', op: 'sum', k: 0 };
    const NK = 40;
    const dOf = (k) => 0.8 * Math.pow(10, (-3 * k) / NK);
    const w = ui.shell(el, { title: 'Арифметика пределов', sub: 'Выберите две функции и действие. Сверху — сами функции, снизу — их комбинация. Нажмите ▶: x подходит к a с обеих сторон, а значения комбинации — к числу, которое даёт правило. Последние два набора показывают, когда правило частного молчит.' });
    ui.select(w.controls, { label: 'Функции', value: st0.pair, options: Object.entries(PAIRS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.pair = v), draw()) });
    ui.segmented(w.controls, { label: 'Действие', value: st0.op, options: Object.entries(OPS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.op = v), draw()) });
    ui.player(w.controls, { label: 'Приближаемся к a', min: 0, max: NK, value: 0, fps: 6, format: (k) => '|x − a| = ' + U.fmt(dOf(k), 3), onChange: (k) => ((st0.k = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'x' }, y: { label: 'f и g' } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'x' }, y: { label: 'комбинация' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'A', label: 'lim f = A' }, { key: 'B', label: 'lim g = B' }, { key: 'r', label: 'по правилу' }, { key: 'l', label: 'значение при x = a − d' }, { key: 'rr', label: 'при x = a + d' }]);
    function draw() {
      const P = PAIRS[st0.pair];
      const O = OPS[st0.op];
      const d = dOf(st0.k);
      const hf = (x) => O.h(P.f(x), P.g(x));
      const xl = P.a - d;
      const xr = P.a + d;
      const pf = curve(P.f, P.dom[0], P.dom[1], 501);
      const pg = curve(P.g, P.dom[0], P.dom[1], 501);
      p1.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: pf.x, y: pf.y, color: 'model', width: 2.2, label: 'f(x) = ' + P.ft, hover: false },
        { type: 'line', x: pg.x, y: pg.y, color: 'tree', width: 2.2, label: 'g(x) = ' + P.gt, hover: false },
        { type: 'vline', x: P.a, color: 'ink2', dash: '3 3', width: 1, text: 'a = ' + P.a },
        { type: 'points', x: [xl, xr, xl, xr], y: [P.f(xl), P.f(xr), P.g(xl), P.g(xr)], color: (i) => (i < 2 ? 'model' : 'tree'), r: 4.5 },
      ]);
      const rule = O.rule(P.A, P.B);
      const qBad = st0.op === 'quot' && P.B === 0;
      const trueL = qBad ? (P.quot !== undefined ? P.quot : null) : rule;
      const cv = curve(hf, P.dom[0], P.dom[1], 1601, { skip: P.a, cap: 60, jump: 8 });
      const layers = [
        { type: 'line', x: cv.x, y: cv.y, color: 'violet', width: 2.4, label: O.label, hover: false },
        { type: 'vline', x: P.a, color: 'ink2', dash: '3 3', width: 1 },
        { type: 'points', x: [xl, xr], y: [hf(xl), hf(xr)], color: 'violet', r: 5 },
      ];
      if (trueL !== null && Number.isFinite(trueL)) {
        layers.push({ type: 'hline', y: trueL, color: 'ink2', dash: '6 4', width: 1.2, text: 'предел ' + U.fmt(trueL, 4) });
        layers.push({ type: 'points', x: [P.a], y: [trueL], color: 'violet', r: 5, hollow: true });
      }
      const yv = cv.y.filter(Number.isFinite);
      const [lo, hi] = U.extent(yv);
      p2.render(layers, { y: qBad && P.quot === undefined ? [-30, 30] : [Math.min(lo, trueL ?? lo) - 0.6, Math.max(hi, trueL ?? hi) + 0.6] });
      st.set('A', U.fmt(P.A, 4));
      st.set('B', U.fmt(P.B, 4));
      st.set('r', qBad ? (P.A === 0 ? '0/0 — ?' : U.fmt(P.A, 3) + '/0 — ?') : O.txt.replace('A', U.fmt(P.A, 3)).replace('B', U.fmt(P.B, 3)) + ' = ' + U.fmt(rule, 4));
      st.set('l', U.fmt(hf(xl), 6));
      st.set('rr', U.fmt(hf(xr), 6));
      if (qBad && P.A === 0) note.innerHTML = 'Оба предела равны 0, и правило частного <b>не применимо</b> (B = 0). Но график комбинации подходит к 4: x² − 4 = (x − 2)(x + 2), и после сокращения остаётся x + 2 → 4. Это неопределённость 0/0 — шаги 4–7.';
      else if (qBad) note.innerHTML = 'Числитель → 3, знаменатель → 0: дробь по модулю неограниченно растёт. Слева (x − 2 &lt; 0) — к −∞, справа — к +∞. Это форма «число / 0» — шаг 3.';
      else note.innerHTML = 'Правило: lim (' + O.label + ') = ' + O.txt + ' = <b>' + U.fmt(rule, 4) + '</b>. Значения при x = a ± ' + U.fmt(d, 3) + ' уже отличаются от него на ' + U.fmt(Math.max(Math.abs(hf(xl) - rule), Math.abs(hf(xr) - rule)), 3) + ' — и отклонение уменьшается вместе с |x − a|. Таблица не нужна: предел комбинации собирается из пределов частей.';
    }
    w.pythonAction(() => {
      const P = PAIRS[st0.pair];
      const O = OPS[st0.op];
      return 'import numpy as np\n\nf = lambda x: ' + P.fpy + '\ng = lambda x: ' + P.gpy + '\na = ' + P.a + '\nfor d in [0.1, 0.01, 0.001, 1e-6]:\n    for x in (a - d, a + d):\n        print(f"x = {x:.6f}: ' + O.label + ' = {' + O.pyop + ':.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 2. Предел сложной функции: x → u = g(x) → f(u)
   * ============================================================================== */
  const CMP = {
    expsin: { label: 'e^(sin x), x → 0', g: Math.sin, f: Math.exp, a: 0, B: 0, L: 1, fB: 1, xd: [-1.5, 1.5], ud: [-1.2, 1.2], gt: 'u = sin x', ft: 'y = eᵘ', gpy: 'np.sin(x)', fpy: 'np.exp(u)', note: 'sin x → 0, а экспонента непрерывна в 0: e^(sin x) → e⁰ = 1.' },
    sqrt: { label: '√(x² + 5), x → 2', g: (x) => x * x + 5, f: Math.sqrt, a: 2, B: 9, L: 3, fB: 3, xd: [0, 4], ud: [3, 22], gt: 'u = x² + 5', ft: 'y = √u', gpy: 'x**2 + 5', fpy: 'np.sqrt(u)', note: 'Внутри u → 9, корень непрерывен в 9: ответ √9 = 3.' },
    sigm: { label: 'σ(4x − 2) — вероятность от логита, x → 0.5', g: (x) => 4 * x - 2, f: sigma, a: 0.5, B: 0, L: 0.5, fB: 0.5, xd: [-0.5, 1.5], ud: [-6, 6], gt: 'u = F(x) = 4x − 2', ft: 'y = σ(u)', gpy: '4*x - 2', fpy: '1 / (1 + np.exp(-u))', note: 'Так устроен прогноз вероятности в бустинге: σ(F(x)). Логит F → 0, сигмоида непрерывна: вероятность → σ(0) = 0.5.' },
    lnhole: { label: 'ln((x² − 1)/(x − 1)), x → 1', g: (x) => (x * x - 1) / (x - 1), f: Math.log, a: 1, B: 2, L: Math.log(2), fB: Math.log(2), xd: [0.05, 3], ud: [0.5, 4.5], gt: 'u = (x² − 1)/(x − 1)', ft: 'y = ln u', gpy: '(x**2 - 1) / (x - 1)', fpy: 'np.log(u)', hole: true, note: 'Внутренняя функция в x = 1 не определена (дырка), но её предел 2 существует. Логарифм непрерывен в 2 — ответ ln 2 ≈ 0.6931.' },
    step: { label: '[−x² ≥ 0] — внешняя функция разрывна', g: (x) => -x * x, f: (u) => (u >= 0 ? 1 : 0), a: 0, B: 0, L: 0, fB: 1, xd: [-1.5, 1.5], ud: [-2.4, 1], gt: 'u = −x²', ft: 'y = [u ≥ 0]', gpy: '-x**2', fpy: '(u >= 0) * 1.0', bad: true, note: 'u = −x² подходит к 0 <b>снизу</b> (u &lt; 0 при x ≠ 0), и ступенька там равна 0. Предел сложной функции 0, а «внесение» дало бы f(0) = 1. Внешняя функция разрывна в точке B — правило не работает.' },
  };
  GBC.widget('composition-limit', (el) => {
    const st0 = { fn: 'expsin', k: 0, side: 1 };
    const NK = 30;
    const dOf = (k) => 0.9 * Math.pow(10, (-2.5 * k) / NK);
    const w = ui.shell(el, { title: 'Предел сложной функции: цепочка x → u → y', sub: 'Сверху — внутренняя функция u = g(x), снизу — внешняя y = f(u). Нажмите ▶: x подходит к a, точка u = g(x) подходит к B, а y = f(u) — к f(B), если f непрерывна в B.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(CMP).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.segmented(w.controls, { label: 'С какой стороны', value: 1, options: [{ value: -1, label: 'слева' }, { value: 1, label: 'справа' }], onChange: (v) => ((st0.side = v), draw()) });
    ui.player(w.controls, { label: 'x → a', min: 0, max: NK, value: 0, fps: 5, format: (k) => '|x − a| = ' + U.fmt(dOf(k), 3), onChange: (k) => ((st0.k = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'x' }, y: { label: 'u = g(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'u' }, y: { label: 'y = f(u)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'x' }, { key: 'u', label: 'u = g(x)' }, { key: 'y', label: 'y = f(g(x))' }, { key: 'fB', label: 'f(B)' }]);
    function draw() {
      const C = CMP[st0.fn];
      const x = C.a + st0.side * dOf(st0.k);
      const u = C.g(x);
      const y = C.f(u);
      p1.opts.y.label = C.gt;
      p2.opts.y.label = C.ft;
      const gc = curve(C.g, C.xd[0], C.xd[1], 801, { skip: C.hole ? C.a : undefined });
      p1.render([
        { type: 'line', x: gc.x, y: gc.y, color: 'tree', width: 2.2, hover: false },
        { type: 'hline', y: C.B, color: 'ink2', dash: '6 4', width: 1.2, text: 'B = ' + U.fmt(C.B, 3) },
        { type: 'vline', x: C.a, color: 'ink2', dash: '3 3', width: 1 },
        C.hole ? { type: 'points', x: [C.a], y: [C.B], color: 'tree', r: 5, hollow: true } : null,
        { type: 'points', x: [x], y: [u], color: 'tree', r: 6 },
      ], { x: C.xd });
      const fc = curve(C.f, C.ud[0], C.ud[1], 1201, { jump: 0.5 });
      p2.render([
        { type: 'line', x: fc.x, y: fc.y, color: 'model', width: 2.2, hover: false },
        { type: 'vline', x: C.B, color: 'ink2', dash: '3 3', width: 1, text: 'u = B' },
        C.bad ? { type: 'points', x: [0], y: [0], color: 'model', r: 5, hollow: true } : null,
        { type: 'points', x: [C.B], y: [C.fB], color: 'model', r: 5 },
        { type: 'points', x: [u], y: [y], color: 'violet', r: 6.5 },
      ], { x: C.ud });
      st.set('x', U.fmt(x, 6));
      st.set('u', U.fmt(u, 6));
      st.set('y', U.fmt(y, 6));
      st.set('fB', U.fmt(C.fB, 4));
      note.innerHTML = C.note;
    }
    w.pythonAction(() => {
      const C = CMP[st0.fn];
      return 'import numpy as np\n\ng = lambda x: ' + C.gpy + '\nf = lambda u: ' + C.fpy + '\na = ' + C.a + '\nfor d in [0.1, 0.01, 0.001, 1e-6]:\n    for x in (a - d, a + d):\n        u = g(x)\n        print(f"x = {x:.6f}: u = {u:.6f}, f(u) = {f(u):.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 3. Лаборатория форм: определённые формы и семь неопределённостей (x → +∞)
   * ============================================================================== */
  const ex = (v) => Math.exp(v);
  const FORMS = {
    'inf+inf': { group: 'det', label: '∞ + ∞', reals: [
      { lab: 'x + x²', f: (x) => x + x * x, py: 'x + x**2', L: Infinity },
      { lab: 'x + ln x', f: (x) => x + Math.log(x), py: 'x + np.log(x)', L: Infinity },
      { lab: '√x + ln(x + 1)', f: (x) => Math.sqrt(x) + Math.log(x + 1), py: 'np.sqrt(x) + np.log(x + 1)', L: Infinity },
    ], note: 'Все варианты уходят в +∞ — разной скоростью, но в одну сторону. Форма <b>определённая</b>: ∞ + ∞ = ∞.' },
    'c*inf': { group: 'det', label: 'c · ∞ (c > 0)', reals: [
      { lab: '2 · x', f: (x) => 2 * x, py: '2 * x', L: Infinity },
      { lab: '0.5 · √x', f: (x) => 0.5 * Math.sqrt(x), py: '0.5 * np.sqrt(x)', L: Infinity },
      { lab: '(3 − 1/x) · ln(x + 1)', f: (x) => (3 - 1 / x) * Math.log(x + 1), py: '(3 - 1/x) * np.log(x + 1)', L: Infinity },
    ], note: 'Множитель, стремящийся к положительному числу, не может остановить рост: c · ∞ = ∞ (при c &lt; 0 — −∞). Даже логарифм, растущий очень медленно, в итоге уходит в бесконечность.' },
    'c/inf': { group: 'det', label: 'c / ∞', reals: [
      { lab: '5 / x', f: (x) => 5 / x, py: '5 / x', L: 0 },
      { lab: '5 / √x', f: (x) => 5 / Math.sqrt(x), py: '5 / np.sqrt(x)', L: 0 },
      { lab: '5 / ln(x + 1)', f: (x) => 5 / Math.log(x + 1), py: '5 / np.log(x + 1)', L: 0 },
    ], note: 'Число, делённое на неограниченно растущее, → 0. Скорость разная (у 5/ln(x + 1) — очень медленно: при x = 10⁴ ещё 0.54), но предел один: 0.' },
    'c/0': { group: 'det', label: 'c / 0⁺ (c > 0)', reals: [
      { lab: '1 / (1/x)', f: (x) => 1 / (1 / x), py: '1 / (1/x)', L: Infinity },
      { lab: '2 / (1/√x)', f: (x) => 2 / (1 / Math.sqrt(x)), py: '2 / (1/np.sqrt(x))', L: Infinity },
      { lab: '1 / e^(−√x)', f: (x) => 1 / ex(-Math.sqrt(x)), py: '1 / np.exp(-np.sqrt(x))', L: Infinity },
    ], note: 'Положительное число, делённое на положительную величину, стремящуюся к нулю, → +∞. Если бы знаменатель подходил к нулю со стороны отрицательных чисел, получилось бы −∞: знак знаменателя важен.' },
    'inf*inf': { group: 'det', label: '∞ · ∞', reals: [
      { lab: 'x · √x', f: (x) => x * Math.sqrt(x), py: 'x * np.sqrt(x)', L: Infinity },
      { lab: '√x · ln(x + 1)', f: (x) => Math.sqrt(x) * Math.log(x + 1), py: 'np.sqrt(x) * np.log(x + 1)', L: Infinity },
      { lab: 'ln(x + 1) · ln(x + 1)', f: (x) => Math.log(x + 1) ** 2, py: 'np.log(x + 1)**2', L: Infinity },
    ], note: 'Произведение двух неограниченно растущих — тоже растёт: ∞ · ∞ = ∞.' },
    '0^inf': { group: 'det', label: '(0⁺)^∞', reals: [
      { lab: '(1/x)^√x', f: (x) => ex(-Math.sqrt(x) * Math.log(x)), py: '(1/x)**np.sqrt(x)', L: 0 },
      { lab: '(1/√x)^ln(x + 1)', f: (x) => ex(-0.5 * Math.log(x) * Math.log(x + 1)), py: '(1/np.sqrt(x))**np.log(x + 1)', L: 0 },
      { lab: '(1/ln(x + 2))^x', f: (x) => ex(-x * Math.log(Math.log(x + 2))), py: '(1/np.log(x + 2))**x', L: 0 },
    ], note: 'Маленькое основание в большой степени становится ещё меньше: (0⁺)^∞ = 0. (А вот 1^∞ — неопределённость: основание, близкое к единице, может и расти, и падать.)' },
    '0/0': { group: 'indet', label: '0 / 0', reals: [
      { lab: '(1/x²) / (1/x)', f: (x) => 1 / (x * x) / (1 / x), py: '(1/x**2) / (1/x)', L: 0 },
      { lab: '(2/x) / (1/x)', f: (x) => 2 / x / (1 / x), py: '(2/x) / (1/x)', L: 2 },
      { lab: '(1/x) / (1/x²)', f: (x) => 1 / x / (1 / (x * x)), py: '(1/x) / (1/x**2)', L: Infinity },
    ], note: 'Числитель и знаменатель → 0, а ответы 0, 2 и ∞: решает, кто быстрее идёт к нулю. Форма 0/0 — <b>неопределённость</b>.' },
    'inf/inf': { group: 'indet', label: '∞ / ∞', reals: [
      { lab: '√x / x', f: (x) => Math.sqrt(x) / x, py: 'np.sqrt(x) / x', L: 0 },
      { lab: '(2x + 3) / (x + 1)', f: (x) => (2 * x + 3) / (x + 1), py: '(2*x + 3) / (x + 1)', L: 2 },
      { lab: 'x² / (x + 1)', f: (x) => (x * x) / (x + 1), py: 'x**2 / (x + 1)', L: Infinity },
    ], note: 'Всё решает, кто быстрее растёт: знаменатель (ответ 0), одинаково (число — отношение старших коэффициентов) или числитель (∞). Шаг 8.' },
    '0*inf': { group: 'indet', label: '0 · ∞', reals: [
      { lab: '(1/x²) · x', f: (x) => (1 / (x * x)) * x, py: '(1/x**2) * x', L: 0 },
      { lab: '((2x + 1)/x²) · x', f: (x) => ((2 * x + 1) / (x * x)) * x, py: '((2*x + 1)/x**2) * x', L: 2 },
      { lab: '(1/x) · x²', f: (x) => (1 / x) * x * x, py: '(1/x) * x**2', L: Infinity },
    ], note: 'Один множитель тянет к нулю, другой — к бесконечности. Победитель определяет ответ: 0, 2 или ∞. Приём — записать произведение дробью (шаг 9).' },
    'inf-inf': { group: 'indet', label: '∞ − ∞', reals: [
      { lab: '√(x² + 1) − x', f: (x) => 1 / (Math.sqrt(x * x + 1) + x), py: 'np.sqrt(x**2 + 1) - x', L: 0 },
      { lab: '√(x² + 4x) − x', f: (x) => (4 * x) / (Math.sqrt(x * x + 4 * x) + x), py: 'np.sqrt(x**2 + 4*x) - x', L: 2 },
      { lab: 'x² − x', f: (x) => x * x - x, py: 'x**2 - x', L: Infinity },
    ], note: 'Обе части огромны, а разность может быть почти нулём, числом или снова бесконечностью. ∞ − ∞ ≠ 0! (Первые две разности вычислены через сопряжённое, чтобы компьютер не терял точность при вычитании близких чисел.)' },
    '1^inf': { group: 'indet', label: '1^∞', reals: [
      { lab: '(1 − 1/x)^(x²)', f: (x) => ex(x * x * Math.log1p(-1 / x)), py: '(1 - 1/x)**(x**2)', L: 0 },
      { lab: '(1 + 1/x²)^x', f: (x) => ex(x * Math.log1p(1 / (x * x))), py: '(1 + 1/x**2)**x', L: 1 },
      { lab: '(1 + 2/x)^x', f: (x) => ex(x * Math.log1p(2 / x)), py: '(1 + 2/x)**x', L: Math.E * Math.E },
      { lab: '(1 + 1/x)^(x²)', f: (x) => ex(x * x * Math.log1p(1 / x)), py: '(1 + 1/x)**(x**2)', L: Infinity },
    ], note: 'Основание → 1, показатель → ∞, а ответы 0, 1, e² ≈ 7.39 и ∞. Решает произведение «показатель × (основание − 1)»: −x, 1/x, 2 и x соответственно (шаг 14).' },
    '0^0': { group: 'indet', label: '0⁰', reals: [
      { lab: '(e^(−x²))^(1/x)', f: (x) => ex(-x), py: 'np.exp(-x**2)**(1/x)', L: 0 },
      { lab: '(1/x)^(2/ln(x + 1))', f: (x) => ex((-2 * Math.log(x)) / Math.log(x + 1)), py: '(1/x)**(2/np.log(x + 1))', L: Math.exp(-2) },
      { lab: '(1/x)^(1/x)', f: (x) => ex(-Math.log(x) / x), py: '(1/x)**(1/x)', L: 1 },
    ], note: 'Основание → 0 (тянет вниз), показатель → 0 (тянет к 1). Ответы 0, e⁻² ≈ 0.135 и 1. Через логарифм: u^v = e^(v ln u), в показателе — форма 0 · ∞.' },
    'inf^0': { group: 'indet', label: '∞⁰', reals: [
      { lab: 'x^(1/x)', f: (x) => ex(Math.log(x) / x), py: 'x**(1/x)', L: 1 },
      { lab: '(x² + 1)^(1/ln(x + 1))', f: (x) => ex(Math.log(x * x + 1) / Math.log(x + 1)), py: '(x**2 + 1)**(1/np.log(x + 1))', L: Math.E * Math.E },
      { lab: '(e^(x²))^(1/x)', f: (x) => ex(x), py: 'np.exp(x**2)**(1/x)', L: Infinity },
    ], note: 'Основание → ∞, показатель → 0: ответы 1, e² и ∞. Опять всё решает показатель e^(v ln u): ln x / x → 0, ln(x² + 1)/ln(x + 1) → 2, x → ∞.' },
  };
  GBC.widget('form-lab', (el, cfg) => {
    const group = cfg.group || 'indet';
    const keys = Object.keys(FORMS).filter((k) => FORMS[k].group === group);
    const st0 = { form: keys[0], k: 20 };
    const NK = 40;
    const xOf = (k) => Math.pow(10, (4 * k) / NK);
    const det = group === 'det';
    const w = ui.shell(el, {
      title: det ? 'Определённые формы: ответ один на всех' : 'Семь неопределённостей: одна форма — разные ответы',
      sub: (det ? 'Каждая кривая — своё выражение одной и той же формы. Все они ведут себя одинаково.' : 'Каждая кривая — своё выражение одной и той же формы, и у каждой свой предел.') + ' Оси логарифмические: x растёт от 1 до 10⁴, по вертикали — от 10⁻⁶ до 10⁶. Ведите ползунок вправо.',
    });
    ui.segmented(w.controls, { label: 'Форма', value: st0.form, options: keys.map((k) => ({ value: k, label: FORMS[k].label })), onChange: (v) => ((st0.form = v), draw()) });
    ui.player(w.controls, { label: 'x → +∞', min: 0, max: NK, value: st0.k, fps: 5, format: (k) => 'x = ' + U.fmt(xOf(k), 3), onChange: (k) => ((st0.k = k), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x (лог. шкала)', type: 'log', domain: [1, 1e4], ticks: [1, 10, 100, 1000, 10000] }, y: { label: 'значение (лог. шкала)', type: 'log', domain: [1e-6, 1e6], ticks: decadeTicks(-6, 6, 2), format: powFmt } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const COLORS = ['model', 'tree', 'aqua', 'violet'];
    function draw() {
      const F = FORMS[st0.form];
      const xs = logspace(0, 4, 400);
      const x = xOf(st0.k);
      const layers = F.reals.map((R, i) => {
        const c = curve(R.f, 0, 0, 0, { xs });
        return { type: 'line', x: c.x, y: c.y.map((v) => clipLog(v, 1e-6, 1e6)), color: COLORS[i], width: 2.2, label: R.lab, hover: false };
      });
      F.reals.forEach((R) => {
        if (Number.isFinite(R.L) && R.L > 0) layers.push({ type: 'hline', y: R.L, color: 'ink2', dash: '4 4', width: 1, opacity: 0.6 });
      });
      layers.push({ type: 'vline', x, color: 'ink2', dash: '3 3', width: 1 });
      layers.push({ type: 'points', x: F.reals.map(() => x), y: F.reals.map((R) => clipLog(R.f(x), 1e-6, 1e6)), color: (i) => COLORS[i], r: 5 });
      plot.render(layers);
      const cols = ['выражение', 'x = 10', 'x = 100', 'x = 1000', 'сейчас (x = ' + U.fmt(x, 3) + ')', 'предел'];
      rowTable(tbl, cols, F.reals.map((R) => [R.lab, ...[10, 100, 1000, x].map((t) => U.fmt(R.f(t), 4)), fmtL(R.L, 4)]));
      note.innerHTML = F.note;
    }
    w.pythonAction(() => {
      const F = FORMS[st0.form];
      return 'import numpy as np\n\n# форма ' + F.label + ' при x → +∞\nexprs = {\n' + F.reals.map((R) => '    "' + R.lab + '": lambda x: ' + R.py + ',').join('\n') + '\n}\nwith np.errstate(over="ignore"):\n    for name, f in exprs.items():\n        print(f"{name:24}", ", ".join(f"{f(np.float64(x)):.4g}" for x in (10, 100, 1000)))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 4. Неопределённость 0/0: гонка к нулю, дробь ≈ отношение наклонов
   * ============================================================================== */
  const ZZ = {
    sq: { label: '(x² − 1)/(x − 1), x → 1', num: (x) => x * x - 1, den: (x) => x - 1, a: 1, L: 2, dom: [0, 2], how: 'Сокращение: x² − 1 = (x − 1)(x + 1), остаётся x + 1 → 2.', py: ['x**2 - 1', 'x - 1'] },
    ratio: { label: '(x² − 4)/(x³ − 8), x → 2', num: (x) => x * x - 4, den: (x) => x ** 3 - 8, a: 2, L: 1 / 3, dom: [1, 3], how: 'Наклоны 4 и 12: дробь → 1/3. Сокращение: (x + 2)/(x² + 2x + 4) → 4/12.', py: ['x**2 - 4', 'x**3 - 8'] },
    cube: { label: '(x³ − 8)/(x − 2), x → 2', num: (x) => x ** 3 - 8, den: (x) => x - 2, a: 2, L: 12, dom: [1, 3], how: 'Сокращение: x³ − 8 = (x − 2)(x² + 2x + 4), остаётся x² + 2x + 4 → 12.', py: ['x**3 - 8', 'x - 2'] },
    root: { label: '(√x − 1)/(x − 1), x → 1', num: (x) => Math.sqrt(x) - 1, den: (x) => x - 1, a: 1, L: 0.5, dom: [0.05, 2], how: 'Сопряжённое: x − 1 = (√x − 1)(√x + 1), остаётся 1/(√x + 1) → 1/2.', py: ['np.sqrt(x) - 1', 'x - 1'] },
    sin: { label: 'sin x / x, x → 0', num: Math.sin, den: (x) => x, a: 0, L: 1, dom: [-1.5, 1.5], how: 'Первый замечательный предел (шаг 12): около нуля sin x ≈ x.', py: ['np.sin(x)', 'x'] },
    exp: { label: '(eˣ − 1)/x, x → 0', num: (x) => Math.expm1(x), den: (x) => x, a: 0, L: 1, dom: [-1.5, 1.5], how: 'Следствие второго замечательного предела (шаг 15): около нуля eˣ ≈ 1 + x.', py: ['np.expm1(x)', 'x'] },
    fast: { label: 'x²/x, x → 0 — числитель быстрее', num: (x) => x * x, den: (x) => x, a: 0, L: 0, dom: [-1.5, 1.5], how: 'Числитель касается оси (наклон 0) и бежит к нулю быстрее знаменателя: x²/x = x → 0.', py: ['x**2', 'x'] },
  };
  GBC.widget('race-to-zero', (el) => {
    const st0 = { fn: 'sq', k: 0 };
    const NK = 40;
    const dOf = (k) => 0.5 * Math.pow(10, (-3 * k) / NK);
    const w = ui.shell(el, { title: '0/0: гонка к нулю', sub: 'И числитель (синий), и знаменатель (оранжевый) подходят к нулю. Пунктир — касательные: около точки обе функции почти прямые. Предел дроби — отношение их наклонов. Нажмите ▶.' });
    ui.select(w.controls, { label: 'Пример', value: st0.fn, options: Object.entries(ZZ).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.player(w.controls, { label: 'Приближаемся к a', min: 0, max: NK, value: 0, fps: 6, format: (k) => 'x − a = ' + U.fmt(dOf(k), 3), onChange: (k) => ((st0.k = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: 'числитель и знаменатель' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'x' }, y: { label: 'дробь' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'x' }, { key: 'n', label: 'числитель' }, { key: 'd', label: 'знаменатель' }, { key: 'r', label: 'дробь' }, { key: 'k', label: 'наклоны k₁ : k₂' }]);
    function draw() {
      const Z = ZZ[st0.fn];
      const x = Z.a + dOf(st0.k);
      const xs = U.linspace(Z.dom[0], Z.dom[1], 401).filter((t) => Math.abs(t - Z.a) > 1e-9);
      const k1 = slope(Z.num, Z.a);
      const k2 = slope(Z.den, Z.a);
      const span = (Z.dom[1] - Z.dom[0]) / 2;
      const tx = [Z.a - span * 0.6, Z.a + span * 0.6];
      p1.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: tx, y: tx.map((t) => k1 * (t - Z.a)), color: 'model', width: 1.3, dash: '5 4', opacity: 0.8, hover: false },
        { type: 'line', x: tx, y: tx.map((t) => k2 * (t - Z.a)), color: 'tree', width: 1.3, dash: '5 4', opacity: 0.8, hover: false },
        { type: 'line', x: xs, y: xs.map(Z.num), color: 'model', width: 2.2, label: 'числитель', hover: false },
        { type: 'line', x: xs, y: xs.map(Z.den), color: 'tree', width: 2.2, label: 'знаменатель', hover: false },
        { type: 'points', x: [x, x], y: [Z.num(x), Z.den(x)], color: (i) => (i ? 'tree' : 'model'), r: 5 },
        { type: 'vline', x: Z.a, color: 'ink2', dash: '3 3', width: 1 },
      ], { x: Z.dom });
      const rs = xs.map((t) => Z.num(t) / Z.den(t));
      p2.render([
        { type: 'line', x: xs, y: rs, color: 'violet', width: 2.2, label: 'числитель / знаменатель', hover: false },
        { type: 'hline', y: Z.L, color: 'ink2', dash: '6 4', text: 'предел ' + U.fmt(Z.L, 4) },
        { type: 'points', x: [Z.a], y: [Z.L], color: 'violet', r: 5, hollow: true },
        { type: 'points', x: [x], y: [Z.num(x) / Z.den(x)], color: 'violet', r: 5 },
      ], { x: Z.dom });
      st.set('x', U.fmt(x, 5));
      st.set('n', U.fmt(Z.num(x), 4));
      st.set('d', U.fmt(Z.den(x), 4));
      st.set('r', U.fmt(Z.num(x) / Z.den(x), 6));
      st.set('k', U.fmt(k1, 3) + ' : ' + U.fmt(k2, 3));
      note.innerHTML = 'Оба стремятся к нулю, но их <b>отношение</b> подходит к ' + U.fmt(Z.L, 4) + '. Наклоны в точке a: k₁ = ' + U.fmt(k1, 3) + ', k₂ = ' + U.fmt(k2, 3) + ', их отношение ' + U.fmt(k1 / k2, 4) + ' — тот же предел. ' + Z.how;
    }
    w.pythonAction(() => {
      const Z = ZZ[st0.fn];
      return 'import numpy as np\n\nnum = lambda x: ' + Z.py[0] + '\nden = lambda x: ' + Z.py[1] + '\na = ' + U.pyNum(Z.a) + '\nfor d in [0.1, 0.01, 0.001, 1e-6]:\n    x = a + d\n    print(f"x = {x}: {num(x):.3e} / {den(x):.3e} = {num(x) / den(x):.6f}")\n\n# отношение наклонов (центральные разности)\nh = 1e-6\nk1 = (num(a + h) - num(a - h)) / (2 * h)\nk2 = (den(a + h) - den(a - h)) / (2 * h)\nprint("k1 / k2 =", k1 / k2)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 5. Пошаговый решатель: сокращение, сопряжённое, старшая степень, ∞ − ∞ и 0·∞
   * ============================================================================== */
  const R = String.raw;
  const SUBST = 'Подставляем предельное значение';
  const SOLVER = {
    factor: [
      { lvl: 1, name: '(x² − 9)/(x − 3), x → 3', tex: R`\lim_{x\to 3}\frac{x^2-9}{x-3}`, f: (x) => (x * x - 9) / (x - 3), a: 3, L: 6, dom: [1, 5], py: '(x**2 - 9) / (x - 3)', steps: [
        [SUBST, R`\frac{3^2-9}{3-3}=\frac00`], ['Разность квадратов', R`x^2-9=(x-3)(x+3)`], ['Сокращаем на x − 3 ≠ 0', R`\frac{(x-3)(x+3)}{x-3}=x+3`], ['Подставляем снова', R`\lim_{x\to3}(x+3)=6`]] },
      { lvl: 1, name: '(x² − 5x + 6)/(x² − 4), x → 2', tex: R`\lim_{x\to 2}\frac{x^2-5x+6}{x^2-4}`, f: (x) => (x * x - 5 * x + 6) / (x * x - 4), a: 2, L: -0.25, dom: [0.5, 3.5], py: '(x**2 - 5*x + 6) / (x**2 - 4)', steps: [
        [SUBST, R`\frac{4-10+6}{4-4}=\frac00`], ['Корни числителя 2 и 3, знаменателя 2 и −2', R`x^2-5x+6=(x-2)(x-3),\quad x^2-4=(x-2)(x+2)`], ['Сокращаем на x − 2', R`\frac{x-3}{x+2}`], ['Подставляем', R`\frac{2-3}{2+2}=-\frac14`]] },
      { lvl: 2, name: '(x³ − 8)/(x − 2), x → 2', tex: R`\lim_{x\to 2}\frac{x^3-8}{x-2}`, f: (x) => (x ** 3 - 8) / (x - 2), a: 2, L: 12, dom: [0.5, 3.5], py: '(x**3 - 8) / (x - 2)', steps: [
        [SUBST, R`\frac{2^3-8}{2-2}=\frac00`], ['Разность кубов', R`x^3-8=(x-2)(x^2+2x+4)`], ['Сокращаем', R`x^2+2x+4`], ['Подставляем', R`4+4+4=12`]] },
      { lvl: 2, name: '((1 + x)³ − 1)/x, x → 0', tex: R`\lim_{x\to 0}\frac{(1+x)^3-1}{x}`, f: (x) => ((1 + x) ** 3 - 1) / x, a: 0, L: 3, dom: [-1, 1], py: '((1 + x)**3 - 1) / x', steps: [
        [SUBST, R`\frac{1-1}{0}=\frac00`], ['Раскрываем куб суммы', R`(1+x)^3-1=3x+3x^2+x^3`], ['Сокращаем на x', R`3+3x+x^2`], ['Подставляем', R`3`]] },
      { lvl: 2, name: '(x⁴ − 1)/(x − 1), x → 1', tex: R`\lim_{x\to 1}\frac{x^4-1}{x-1}`, f: (x) => (x ** 4 - 1) / (x - 1), a: 1, L: 4, dom: [0, 2], py: '(x**4 - 1) / (x - 1)', steps: [
        [SUBST, R`\frac{1-1}{1-1}=\frac00`], ['Разность степеней', R`x^4-1=(x-1)(x^3+x^2+x+1)`], ['Сокращаем', R`x^3+x^2+x+1`], ['Подставляем: четыре единицы', R`1+1+1+1=4`], ['Обобщение', R`\lim_{x\to a}\frac{x^n-a^n}{x-a}=n\,a^{n-1}`]] },
      { lvl: 2, name: '(2x² + x − 3)/(x² + 2x − 3), x → 1', tex: R`\lim_{x\to 1}\frac{2x^2+x-3}{x^2+2x-3}`, f: (x) => (2 * x * x + x - 3) / (x * x + 2 * x - 3), a: 1, L: 1.25, dom: [0, 2], py: '(2*x**2 + x - 3) / (x**2 + 2*x - 3)', steps: [
        [SUBST, R`\frac{2+1-3}{1+2-3}=\frac00`], ['Корни: числитель 1 и −3/2, знаменатель 1 и −3', R`2x^2+x-3=(x-1)(2x+3),\quad x^2+2x-3=(x-1)(x+3)`], ['Сокращаем', R`\frac{2x+3}{x+3}`], ['Подставляем', R`\frac54`]] },
      { lvl: 3, name: '(x³ − 3x + 2)/(x³ − x² − x + 1), x → 1 — двойной корень', tex: R`\lim_{x\to 1}\frac{x^3-3x+2}{x^3-x^2-x+1}`, f: (x) => (x ** 3 - 3 * x + 2) / (x ** 3 - x * x - x + 1), a: 1, L: 1.5, dom: [0, 2], py: '(x**3 - 3*x + 2) / (x**3 - x**2 - x + 1)', steps: [
        [SUBST, R`\frac{1-3+2}{1-1-1+1}=\frac00`], ['Схема Горнера: делим числитель на x − 1', R`x^3-3x+2=(x-1)(x^2+x-2)`], ['x² + x − 2 тоже обращается в 0 при x = 1', R`x^3-3x+2=(x-1)^2(x+2)`], ['Знаменатель — группировкой', R`x^3-x^2-x+1=x^2(x-1)-(x-1)=(x-1)^2(x+1)`], ['Сокращаем (x − 1)² и подставляем', R`\frac{x+2}{x+1}\to\frac32`]] },
    ],
    conj: [
      { lvl: 1, name: '(√x − 1)/(x − 1), x → 1', tex: R`\lim_{x\to 1}\frac{\sqrt x-1}{x-1}`, f: (x) => (Math.sqrt(x) - 1) / (x - 1), a: 1, L: 0.5, dom: [0, 3], py: '(np.sqrt(x) - 1) / (x - 1)', steps: [
        [SUBST, R`\frac{\sqrt1-1}{1-1}=\frac00`], ['Знаменатель — разность квадратов «с корнем»', R`x-1=(\sqrt x-1)(\sqrt x+1)`], ['Сокращаем', R`\frac{1}{\sqrt x+1}`], ['Подставляем', R`\frac{1}{1+1}=\frac12`]] },
      { lvl: 1, name: '(√(x + 4) − 2)/x, x → 0', tex: R`\lim_{x\to 0}\frac{\sqrt{x+4}-2}{x}`, f: (x) => (Math.sqrt(x + 4) - 2) / x, a: 0, L: 0.25, dom: [-3, 3], py: '(np.sqrt(x + 4) - 2) / x', steps: [
        [SUBST, R`\frac{\sqrt4-2}{0}=\frac00`], ['Домножаем на сопряжённое √(x + 4) + 2', R`\frac{(\sqrt{x+4}-2)(\sqrt{x+4}+2)}{x(\sqrt{x+4}+2)}=\frac{x+4-4}{x(\sqrt{x+4}+2)}`], ['Сокращаем x', R`\frac{1}{\sqrt{x+4}+2}`], ['Подставляем', R`\frac{1}{2+2}=\frac14`]] },
      { lvl: 2, name: '(x − 9)/(√x − 3), x → 9 — корень внизу', tex: R`\lim_{x\to 9}\frac{x-9}{\sqrt x-3}`, f: (x) => (x - 9) / (Math.sqrt(x) - 3), a: 9, L: 6, dom: [1, 16], py: '(x - 9) / (np.sqrt(x) - 3)', steps: [
        [SUBST, R`\frac{9-9}{\sqrt9-3}=\frac00`], ['Корень в знаменателе: домножаем на √x + 3', R`\frac{(x-9)(\sqrt x+3)}{(\sqrt x-3)(\sqrt x+3)}=\frac{(x-9)(\sqrt x+3)}{x-9}`], ['Сокращаем', R`\sqrt x+3`], ['Подставляем', R`3+3=6`]] },
      { lvl: 2, name: '(√(1 + x) − √(1 − x))/x, x → 0', tex: R`\lim_{x\to 0}\frac{\sqrt{1+x}-\sqrt{1-x}}{x}`, f: (x) => (Math.sqrt(1 + x) - Math.sqrt(1 - x)) / x, a: 0, L: 1, dom: [-1, 1], py: '(np.sqrt(1 + x) - np.sqrt(1 - x)) / x', steps: [
        [SUBST, R`\frac{1-1}{0}=\frac00`], ['Сопряжённое для разности двух корней', R`\frac{(1+x)-(1-x)}{x\,(\sqrt{1+x}+\sqrt{1-x})}`], ['Упрощаем: 2x / x', R`\frac{2}{\sqrt{1+x}+\sqrt{1-x}}`], ['Подставляем', R`\frac{2}{1+1}=1`]] },
      { lvl: 3, name: '(√(x + 1) − 1)/(√(x + 4) − 2), x → 0 — корни сверху и снизу', tex: R`\lim_{x\to 0}\frac{\sqrt{x+1}-1}{\sqrt{x+4}-2}`, f: (x) => (Math.sqrt(x + 1) - 1) / (Math.sqrt(x + 4) - 2), a: 0, L: 2, dom: [-1, 3], py: '(np.sqrt(x + 1) - 1) / (np.sqrt(x + 4) - 2)', steps: [
        [SUBST, R`\frac{1-1}{2-2}=\frac00`], ['Домножаем на оба сопряжённых', R`\frac{(x+1-1)(\sqrt{x+4}+2)}{(x+4-4)(\sqrt{x+1}+1)}`], ['Сокращаем x', R`\frac{\sqrt{x+4}+2}{\sqrt{x+1}+1}`], ['Подставляем', R`\frac{2+2}{1+1}=2`]] },
      { lvl: 3, name: '(∛x − 1)/(x − 1), x → 1 — кубический корень', tex: R`\lim_{x\to 1}\frac{\sqrt[3]x-1}{x-1}`, f: (x) => (Math.cbrt(x) - 1) / (x - 1), a: 1, L: 1 / 3, dom: [0, 3], py: '(np.cbrt(x) - 1) / (x - 1)', steps: [
        [SUBST, R`\frac{1-1}{1-1}=\frac00`], ['Разность кубов с a = ∛x, b = 1', R`x-1=(\sqrt[3]{x}-1)\left(\sqrt[3]{x^2}+\sqrt[3]{x}+1\right)`], ['Сокращаем', R`\frac{1}{\sqrt[3]{x^2}+\sqrt[3]{x}+1}`], ['Подставляем', R`\frac{1}{1+1+1}=\frac13`]] },
    ],
    inf: [
      { lvl: 1, name: '(3x² + x)/(x² + 1), x → ∞', tex: R`\lim_{x\to\infty}\frac{3x^2+x}{x^2+1}`, f: (x) => (3 * x * x + x) / (x * x + 1), a: 'inf', L: 3, py: '(3*x**2 + x) / (x**2 + 1)', steps: [
        [SUBST, R`\frac{\infty}{\infty}`], ['Делим числитель и знаменатель на x²', R`\frac{3+\frac1x}{1+\frac{1}{x^2}}`], ['1/x и 1/x² → 0', R`\frac{3+0}{1+0}=3`]] },
      { lvl: 1, name: '(4x² − 1)/(2x³ + x), x → ∞', tex: R`\lim_{x\to\infty}\frac{4x^2-1}{2x^3+x}`, f: (x) => (4 * x * x - 1) / (2 * x ** 3 + x), a: 'inf', L: 0, py: '(4*x**2 - 1) / (2*x**3 + x)', steps: [
        [SUBST, R`\frac\infty\infty`], ['Делим на старшую степень x³', R`\frac{\frac4x-\frac1{x^3}}{2+\frac1{x^2}}`], ['Предел', R`\frac{0-0}{2+0}=0`]] },
      { lvl: 2, name: '(x³ − 2x)/(5x² + 1), x → ∞', tex: R`\lim_{x\to\infty}\frac{x^3-2x}{5x^2+1}`, f: (x) => (x ** 3 - 2 * x) / (5 * x * x + 1), a: 'inf', L: Infinity, py: '(x**3 - 2*x) / (5*x**2 + 1)', steps: [
        [SUBST, R`\frac\infty\infty`], ['Делим на x² (старшая степень знаменателя)', R`\frac{x-\frac2x}{5+\frac1{x^2}}`], ['Числитель растёт, знаменатель → 5', R`\frac{\infty}{5}=+\infty`]] },
      { lvl: 2, name: '√(4x² + 1)/(x + 3), x → +∞', tex: R`\lim_{x\to+\infty}\frac{\sqrt{4x^2+1}}{x+3}`, f: (x) => Math.sqrt(4 * x * x + 1) / (x + 3), a: 'inf', L: 2, py: 'np.sqrt(4*x**2 + 1) / (x + 3)', steps: [
        [SUBST, R`\frac\infty\infty`], ['Выносим x² из-под корня; при x > 0 |x| = x', R`\sqrt{4x^2+1}=|x|\sqrt{4+\tfrac1{x^2}}=x\sqrt{4+\tfrac1{x^2}}`], ['Делим на x', R`\frac{\sqrt{4+\frac1{x^2}}}{1+\frac3x}`], ['Предел', R`\frac{\sqrt4}{1}=2`]] },
      { lvl: 3, name: '√(4x² + 1)/(x + 3), x → −∞ — ловушка знака', tex: R`\lim_{x\to-\infty}\frac{\sqrt{4x^2+1}}{x+3}`, f: (x) => Math.sqrt(4 * x * x + 1) / (x + 3), a: '-inf', L: -2, py: 'np.sqrt(4*x**2 + 1) / (x + 3)', steps: [
        [SUBST, R`\frac{+\infty}{-\infty}`], ['При x < 0: √(x²) = |x| = −x', R`\sqrt{4x^2+1}=-x\sqrt{4+\tfrac1{x^2}}`], ['Делим на x — знак переходит в ответ', R`\frac{-\sqrt{4+\frac1{x^2}}}{1+\frac3x}`], ['Предел', R`-2`]] },
      { lvl: 3, name: '(2ˣ + 3ˣ)/(3ˣ⁺¹ − 2ˣ), x → ∞ — экспоненты', tex: R`\lim_{x\to\infty}\frac{2^x+3^x}{3^{x+1}-2^x}`, f: (x) => (2 ** x + 3 ** x) / (3 ** (x + 1) - 2 ** x), a: 'inf', L: 1 / 3, linear: [1, 40], tx: [2, 5, 10, 30], py: '(2**x + 3**x) / (3**(x + 1) - 2**x)', steps: [
        [SUBST, R`\frac\infty\infty`], ['Самая быстрая экспонента — 3ˣ: делим на неё', R`\frac{\left(\frac23\right)^x+1}{3-\left(\frac23\right)^x}`], ['(2/3)ˣ → 0 — геометрическая прогрессия', R`\frac{0+1}{3-0}=\frac13`]] },
    ],
    diff: [
      { lvl: 1, name: '1/(x − 1) − 2/(x² − 1), x → 1', tex: R`\lim_{x\to 1}\left(\frac{1}{x-1}-\frac{2}{x^2-1}\right)`, f: (x) => 1 / (x - 1) - 2 / (x * x - 1), a: 1, L: 0.5, dom: [0.2, 3], py: '1/(x - 1) - 2/(x**2 - 1)', steps: [
        [SUBST, R`\infty-\infty`], ['Общий знаменатель x² − 1 = (x − 1)(x + 1)', R`\frac{x+1-2}{(x-1)(x+1)}=\frac{x-1}{(x-1)(x+1)}`], ['Сокращаем', R`\frac1{x+1}`], ['Подставляем', R`\frac12`]] },
      { lvl: 1, name: '(x − 2) · 1/(x² − 4), x → 2 — форма 0 · ∞', tex: R`\lim_{x\to 2}\,(x-2)\cdot\frac{1}{x^2-4}`, f: (x) => (x - 2) * (1 / (x * x - 4)), a: 2, L: 0.25, dom: [0.5, 3.5], py: '(x - 2) * (1 / (x**2 - 4))', steps: [
        [SUBST, R`0\cdot\infty`], ['Записываем произведение дробью', R`\frac{x-2}{x^2-4}`], ['Это 0/0: раскладываем', R`\frac{x-2}{(x-2)(x+2)}=\frac{1}{x+2}`], ['Подставляем', R`\frac14`]] },
      { lvl: 2, name: '√(x² + x) − x, x → ∞', tex: R`\lim_{x\to\infty}\left(\sqrt{x^2+x}-x\right)`, f: (x) => Math.sqrt(x * x + x) - x, a: 'inf', L: 0.5, py: 'np.sqrt(x**2 + x) - x', steps: [
        [SUBST, R`\infty-\infty`], ['Умножаем и делим на сопряжённое', R`\frac{(x^2+x)-x^2}{\sqrt{x^2+x}+x}=\frac{x}{\sqrt{x^2+x}+x}`], ['Делим на x', R`\frac{1}{\sqrt{1+\frac1x}+1}`], ['Предел', R`\frac1{1+1}=\frac12`]] },
      { lvl: 2, name: '√(x + 1) − √x, x → ∞', tex: R`\lim_{x\to\infty}\left(\sqrt{x+1}-\sqrt x\right)`, f: (x) => Math.sqrt(x + 1) - Math.sqrt(x), a: 'inf', L: 0, py: 'np.sqrt(x + 1) - np.sqrt(x)', steps: [
        [SUBST, R`\infty-\infty`], ['Сопряжённое', R`\frac{(x+1)-x}{\sqrt{x+1}+\sqrt x}=\frac{1}{\sqrt{x+1}+\sqrt x}`], ['Знаменатель → ∞', R`\frac1\infty=0`]] },
      { lvl: 2, name: 'ln(2x + 1) − ln x, x → ∞', tex: R`\lim_{x\to\infty}\bigl(\ln(2x+1)-\ln x\bigr)`, f: (x) => Math.log(2 * x + 1) - Math.log(x), a: 'inf', L: Math.log(2), py: 'np.log(2*x + 1) - np.log(x)', steps: [
        [SUBST, R`\infty-\infty`], ['Разность логарифмов — логарифм частного', R`\ln\frac{2x+1}{x}=\ln\left(2+\frac1x\right)`], ['Вносим предел под непрерывный логарифм', R`\ln 2\approx 0.6931`]] },
      { lvl: 2, name: 'x(√(x² + 1) − x), x → ∞ — форма ∞ · 0', tex: R`\lim_{x\to\infty}x\left(\sqrt{x^2+1}-x\right)`, f: (x) => x / (Math.sqrt(x * x + 1) + x), a: 'inf', L: 0.5, py: 'x * (np.sqrt(x**2 + 1) - x)', steps: [
        [SUBST, R`\infty\cdot0`], ['Сопряжённое к скобке', R`\frac{x\,(x^2+1-x^2)}{\sqrt{x^2+1}+x}=\frac{x}{\sqrt{x^2+1}+x}`], ['Делим на x', R`\frac1{\sqrt{1+\frac1{x^2}}+1}\to\frac12`]] },
      { lvl: 3, name: 'x² − √(x⁴ + 3x²), x → ∞', tex: R`\lim_{x\to\infty}\left(x^2-\sqrt{x^4+3x^2}\right)`, f: (x) => (-3 * x * x) / (x * x + Math.sqrt(x ** 4 + 3 * x * x)), a: 'inf', L: -1.5, py: 'x**2 - np.sqrt(x**4 + 3*x**2)', steps: [
        [SUBST, R`\infty-\infty`], ['Сопряжённое', R`\frac{x^4-(x^4+3x^2)}{x^2+\sqrt{x^4+3x^2}}=\frac{-3x^2}{x^2+\sqrt{x^4+3x^2}}`], ['Делим на x²', R`\frac{-3}{1+\sqrt{1+\frac3{x^2}}}`], ['Предел', R`-\frac32`]] },
    ],
  };
  const STARS = ['', '★', '★★', '★★★'];
  GBC.widget('step-solver', (el, cfg) => {
    const set = SOLVER[cfg.set] || SOLVER.factor;
    const st0 = { i: 0, k: 1 };
    const w = ui.shell(el, { title: 'Решатель по шагам', sub: 'Выберите пример (★ — простой, ★★★ — с подвохом). Нажимайте «шаг вперёд» или ▶: каждое преобразование появляется с пояснением. График и таблица значений проверяют ответ.' });
    ui.select(w.controls, { label: 'Пример', value: '0', options: set.map((E, i) => ({ value: String(i), label: STARS[E.lvl] + ' ' + E.name })), onChange: (v) => {
      st0.i = +v;
      player.setMax(set[st0.i].steps.length);
      player.set(1);
      st0.k = 1;
      draw();
    } });
    const player = ui.player(w.controls, { label: 'Шаг решения', min: 0, max: set[0].steps.length, value: 1, fps: 0.8, format: (k, m) => 'шаг ' + k + ' из ' + m, onChange: (k) => ((st0.k = k), draw()) });
    const prob = card('Задача', true);
    w.main.appendChild(prob.el);
    const probTex = H('div');
    prob.body.appendChild(probTex);
    const list = H('ol', { style: 'margin:8px 0 0;padding-left:1.4em;display:grid;gap:6px' });
    prob.body.appendChild(list);
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'f(x)' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function tablePoints(E) {
      if (E.a === 'inf') return E.tx || [10, 100, 1000, 10000];
      if (E.a === '-inf') return [-10, -100, -1000, -10000];
      return [-0.1, -0.01, -0.001, 0.001, 0.01, 0.1].map((d) => E.a + d);
    }
    function draw() {
      const E = set[st0.i];
      texInto(probTex, E.tex, true);
      list.textContent = '';
      E.steps.slice(0, st0.k).forEach(([c, t], j) => {
        const li = H('li', { style: 'opacity:' + (j === st0.k - 1 ? 1 : 0.78) }, H('div', { style: 'font-size:.92rem;color:var(--ink-2)' }, c));
        li.appendChild(texEl('\\displaystyle ' + t, false, 'padding:2px 0'));
        list.appendChild(li);
      });
      const fin = st0.k >= E.steps.length;
      const layers = [];
      if (E.a === 'inf' || E.a === '-inf') {
        const sg = E.a === 'inf' ? 1 : -1;
        if (E.linear) {
          const c = curve(E.f, E.linear[0], E.linear[1], 400);
          plot.opts.x = { label: 'x' };
          layers.push({ type: 'line', x: c.x, y: c.y, color: 'model', width: 2.4, hover: false });
        } else {
          const ts = logspace(0, 4, 400);
          plot.opts.x = { label: sg > 0 ? 'x (лог. шкала)' : '|x|, x отрицательный (лог. шкала)', type: 'log', domain: [1, 1e4], ticks: [1, 10, 100, 1000, 10000] };
          const ys = ts.map((t) => E.f(sg * t));
          layers.push({ type: 'line', x: ts, y: ys.map((v) => (Number.isFinite(v) && Math.abs(v) < 1e3 ? v : NaN)), color: 'model', width: 2.4, hover: false });
        }
        if (Number.isFinite(E.L)) layers.push({ type: 'hline', y: E.L, color: 'tree', dash: '6 4', width: 1.6, text: fin ? 'предел ' + U.fmt(E.L, 4) : '' });
        const yv = layers[0].y.filter(Number.isFinite);
        let [lo, hi] = U.extent(yv);
        if (Number.isFinite(E.L)) (lo = Math.min(lo, E.L)), (hi = Math.max(hi, E.L));
        const pad = (hi - lo) * 0.12 || 0.5;
        plot.opts.y.domain = [lo - pad, hi + pad];
      } else {
        plot.opts.x = { label: 'x' };
        const c = curve(E.f, E.dom[0], E.dom[1], 0, { xs: denseNear(E.dom[0], E.dom[1], E.a), skip: E.a, cap: 40, jump: 5 });
        layers.push({ type: 'line', x: c.x, y: c.y, color: 'model', width: 2.4, hover: false });
        layers.push({ type: 'vline', x: E.a, color: 'ink2', dash: '3 3', width: 1, text: 'a = ' + E.a });
        if (fin) layers.push({ type: 'hline', y: E.L, color: 'tree', dash: '6 4', width: 1.4, text: 'предел ' + U.fmt(E.L, 4) });
        layers.push({ type: 'points', x: [E.a], y: [E.L], color: 'model', r: 5, hollow: true });
        const loc = c.y.filter((v, j) => Number.isFinite(v) && Math.abs(c.x[j] - E.a) < (E.dom[1] - E.dom[0]) * 0.35);
        let [lo, hi] = U.extent(loc.concat([E.L]));
        const pad = Math.max((hi - lo) * 0.25, 0.4);
        plot.opts.y.domain = [lo - pad, hi + pad];
        plot.opts.x.domain = E.dom;
      }
      plot.render(layers);
      const xs = tablePoints(E);
      rowTable(tbl, ['x', ...xs.map((x) => U.fmt(x, 4))], [['f(x)', ...xs.map((x) => U.fmt(E.f(x), 6))]]);
      note.innerHTML = fin
        ? 'Ответ: <b>' + fmtL(E.L, 5) + '</b>. Таблица подтверждает его ' + (typeof E.a === 'number' ? 'с обеих сторон от точки ' + E.a + '.' : 'при удалении x на бесконечность.') + ' Выколотая точка на графике — предел, которого функция в самой точке не принимает.'
        : st0.k === 0 ? 'Нажмите «шаг вперёд»: первый шаг — всегда подстановка.' : 'Шаг ' + st0.k + ' из ' + E.steps.length + '. Догадайтесь, каким будет следующее преобразование, и проверьте себя.';
    }
    w.pythonAction(() => {
      const E = set[st0.i];
      const xs = tablePoints(E);
      return 'import numpy as np\n\nf = lambda x: ' + E.py + '\nfor x in [' + xs.map(U.pyNum).join(', ') + ']:\n    print(f"x = {x:>8}: f(x) = {f(np.float64(x)):.8f}")\nprint("предел:", ' + py(E.L) + ')\n';
    });
    draw();
  });

  /* ==============================================================================
   * 6. ∞ − ∞: две огромные величины и их конечная разность
   * ============================================================================== */
  const IMI = {
    sqrt: { label: '√(x² + bx) − x, x → +∞', param: true, f: (x, b) => Math.sqrt(x * x + b * x), g: (x) => x, diff: (x, b) => (b * x) / (Math.sqrt(x * x + b * x) + x), L: (b) => b / 2, inf: true, ft: '√(x² + bx)', gt: 'x', py: (b) => ['np.sqrt(x**2 + ' + U.pyNum(b) + '*x)', 'x'], note: (b) => 'Корень «чуть больше x»: √(x² + bx) ≈ x + b/2. Разность → b/2 = <b>' + U.fmt(b / 2, 3) + '</b>. Меняйте b — предел следует за ним.' },
    frac: { label: '1/(x − 1) − 2/(x² − 1), x → 1⁺', f: (x) => 1 / (x - 1), g: (x) => 2 / (x * x - 1), diff: (x) => 1 / (x + 1), L: () => 0.5, inf: false, ft: '1/(x − 1)', gt: '2/(x² − 1)', py: () => ['1/(x - 1)', '2/(x**2 - 1)'], note: () => 'Обе дроби → +∞ при x → 1⁺, но их разность после общего знаменателя равна 1/(x + 1) → <b>1/2</b>.' },
    ln: { label: 'ln(2x + 1) − ln x, x → +∞', f: (x) => Math.log(2 * x + 1), g: (x) => Math.log(x), diff: (x) => Math.log(2 + 1 / x), L: () => Math.log(2), inf: true, ft: 'ln(2x + 1)', gt: 'ln x', py: () => ['np.log(2*x + 1)', 'np.log(x)'], note: () => 'Логарифмы растут медленно, но без границ. Разность — логарифм частного: ln((2x + 1)/x) → <b>ln 2 ≈ 0.6931</b>.' },
    poly: { label: '(x² + 3x) − x², x → +∞', f: (x) => x * x + 3 * x, g: (x) => x * x, diff: (x) => 3 * x, L: () => Infinity, inf: true, ft: 'x² + 3x', gt: 'x²', py: () => ['x**2 + 3*x', 'x**2'], note: () => 'И так бывает: разность 3x тоже растёт без границ. Форма ∞ − ∞ может дать и число, и бесконечность.' },
  };
  GBC.widget('inf-minus-inf', (el) => {
    const st0 = { fn: 'sqrt', b: 1, k: 20 };
    const NK = 40;
    const w = ui.shell(el, { title: '∞ − ∞: две огромные величины, конечный зазор', sub: 'Сверху — обе величины (логарифмическая шкала по вертикали): они неотличимо растут вместе. Снизу — их разность. Ведите ползунок и следите, куда она выходит.' });
    ui.select(w.controls, { label: 'Разность', value: st0.fn, options: Object.entries(IMI).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), (bSl.el.style.display = IMI[v].param ? '' : 'none'), draw()) });
    const bSl = ui.slider(w.controls, { label: 'Параметр b', min: -4, max: 4, step: 0.5, value: st0.b, onInput: (v) => ((st0.b = v), draw()) });
    ui.player(w.controls, { label: 'Ход', min: 0, max: NK, value: st0.k, fps: 5, format: (k) => 'x = ' + U.fmt(xOf(k), 4), onChange: (k) => ((st0.k = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'x' }, y: { label: 'значения (лог. шкала)', type: 'log' } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'x' }, y: { label: 'разность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'x' }, { key: 'f', label: 'первая' }, { key: 'g', label: 'вторая' }, { key: 'd', label: 'разность' }, { key: 'L', label: 'предел' }]);
    function xOf(k) {
      const I = IMI[st0.fn];
      return I.inf ? Math.pow(10, 0.3 + (3.7 * k) / NK) : 1 + Math.pow(10, -0.3 - (3.7 * k) / NK);
    }
    function draw() {
      const I = IMI[st0.fn];
      const b = st0.b;
      const x = xOf(st0.k);
      const xs = I.inf ? logspace(0.3, 4, 300) : U.range(300).map((i) => 1 + Math.pow(10, -0.3 - (3.7 * i) / 299)).reverse();
      const xAx = I.inf ? { label: 'x (лог. шкала)', type: 'log', domain: [2, 1e4], ticks: [2, 10, 100, 1000, 10000] } : { label: 'x − 1 (лог. шкала), x → 1⁺', type: 'log', domain: [1e-4, 0.5], ticks: [1e-4, 1e-3, 1e-2, 0.1, 0.5] };
      const xv = I.inf ? xs : xs.map((t) => t - 1);
      const xc = I.inf ? x : x - 1;
      p1.opts.x = xAx;
      p2.opts.x = Object.assign({}, xAx);
      const fy = xs.map((t) => clipLog(I.f(t, b), 1e-3, 1e12));
      const gy = xs.map((t) => clipLog(I.g(t, b), 1e-3, 1e12));
      const all = fy.concat(gy).filter(Number.isFinite);
      const ylo = Math.max(1e-3, Math.min(...all) / 2);
      const yhi = Math.max(...all) * 2;
      p1.opts.y.domain = [ylo, yhi];
      p1.opts.y.ticks = decadeTicks(Math.ceil(Math.log10(ylo)), Math.floor(Math.log10(yhi)));
      p1.opts.y.format = powFmt;
      p1.render([
        { type: 'line', x: xv, y: fy, color: 'model', width: 2.2, label: I.ft, hover: false },
        { type: 'line', x: xv, y: gy, color: 'tree', width: 2.2, dash: '6 4', label: I.gt, hover: false },
        { type: 'vline', x: xc, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      const L = I.L(b);
      const dy = xs.map((t) => I.diff(t, b));
      const dyf = dy.filter(Number.isFinite);
      const yl = Number.isFinite(L) ? [Math.min(L, ...dyf) - 0.3, Math.max(L, ...dyf) + 0.3] : 'auto';
      p2.render([
        { type: 'line', x: xv, y: dy, color: 'violet', width: 2.4, label: 'разность', hover: false },
        Number.isFinite(L) ? { type: 'hline', y: L, color: 'ink2', dash: '6 4', text: 'предел ' + U.fmt(L, 4) } : null,
        { type: 'points', x: [xc], y: [I.diff(x, b)], color: 'violet', r: 5 },
      ], { y: yl });
      st.set('x', U.fmt(x, 6));
      st.set('f', U.fmt(I.f(x, b), 6));
      st.set('g', U.fmt(I.g(x, b), 6));
      st.set('d', U.fmt(I.diff(x, b), 6));
      st.set('L', fmtL(L, 4));
      note.innerHTML = I.note(b);
    }
    w.pythonAction(() => {
      const I = IMI[st0.fn];
      const [a, c] = I.py(st0.b);
      const pts = I.inf ? '[10, 100, 1000, 10**4]' : '[1.1, 1.01, 1.001, 1.0001]';
      return 'import numpy as np\n\nf = lambda x: ' + a + '\ng = lambda x: ' + c + '\nfor x in ' + pts + ':\n    print(f"x = {x}: f = {f(x):.6f}, g = {g(x):.6f}, f − g = {f(x) - g(x):.6f}")\n';
    });
    bSl.el.style.display = '';
    draw();
  });

  /* ==============================================================================
   * 7. Теорема о сжатии: функция между двумя «милиционерами»
   * ============================================================================== */
  const SQ = {
    x2sin: { label: 'x² sin(1/x), x → 0', at0: true, f: (x) => x * x * Math.sin(1 / x), g: (x) => -x * x, h: (x) => x * x, L: 0, ok: true, gt: '−x²', ht: 'x²', py: ['x**2 * np.sin(1/x)', '-x**2', 'x**2'], note: 'Синус мечется бесконечно часто, но его амплитуда зажата параболами ±x². Коридор сужается к нулю — и f → 0.' },
    xsin: { label: 'x sin(1/x), x → 0', at0: true, f: (x) => x * Math.sin(1 / x), g: (x) => -Math.abs(x), h: (x) => Math.abs(x), L: 0, ok: true, gt: '−|x|', ht: '|x|', py: ['x * np.sin(1/x)', '-np.abs(x)', 'np.abs(x)'], note: 'Коридор ±|x| сужается медленнее, чем ±x², но тоже к нулю. Ограниченная (sin) × бесконечно малая (x) → 0.' },
    sininf: { label: 'sin x / x, x → +∞', at0: false, f: (x) => Math.sin(x) / x, g: (x) => -1 / x, h: (x) => 1 / x, L: 0, ok: true, gt: '−1/x', ht: '1/x', py: ['np.sin(x) / x', '-1/x', '1/x'], note: 'График пересекает асимптоту y = 0 бесконечно много раз, но остаётся в коридоре ±1/x, который сжимается к нулю.' },
    xsinx: { label: '(x + sin x)/x, x → +∞', at0: false, f: (x) => (x + Math.sin(x)) / x, g: (x) => 1 - 1 / x, h: (x) => 1 + 1 / x, L: 1, ok: true, gt: '1 − 1/x', ht: '1 + 1/x', py: ['(x + np.sin(x)) / x', '1 - 1/x', '1 + 1/x'], note: 'Милиционеры 1 ± 1/x оба → 1, значит, и (x + sin x)/x → 1.' },
    floor: { label: '⌊x⌋/x, x → +∞', at0: false, f: (x) => Math.floor(x) / x, g: (x) => (x - 1) / x, h: () => 1, L: 1, ok: true, gt: '(x − 1)/x', ht: '1', py: ['np.floor(x) / x', '(x - 1) / x', 'np.ones_like(x)'], note: 'x − 1 &lt; ⌊x⌋ ≤ x, делим на x: «пила» зажата между 1 − 1/x и 1. Предел 1.' },
    sin1x: { label: 'sin(1/x), x → 0 — теорема молчит', at0: true, f: (x) => Math.sin(1 / x), g: () => -1, h: () => 1, L: null, ok: false, gt: '−1', ht: '1', py: ['np.sin(1/x)', '-np.ones_like(x)', 'np.ones_like(x)'], note: 'Функция зажата между −1 и 1, но милиционеры идут к <b>разным</b> числам. Теорема ничего не утверждает — и предела действительно нет.' },
  };
  GBC.widget('squeeze-play', (el) => {
    const st0 = { fn: 'x2sin', zoom: 0.5 };
    const w = ui.shell(el, { title: 'Теорема о двух милиционерах', sub: 'Функция (синяя) зажата между нижней и верхней границами (оранжевые). Сужайте окно: если границы сходятся к одному числу, функции деваться некуда.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(SQ).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.slider(w.controls, { label: 'Окно: ближе к пределу →', min: 0, max: 1, step: 0.01, value: st0.zoom, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => ((st0.zoom = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'значение' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'окно' }, { key: 'c', label: 'ширина коридора на краю' }, { key: 'f', label: 'f на краю окна' }, { key: 'L', label: 'предел' }]);
    function draw() {
      const S = SQ[st0.fn];
      let xs;
      let edge;
      let wtxt;
      if (S.at0) {
        const wd = Math.pow(10, -0.0 - 3 * st0.zoom);
        xs = denseNear(-wd, wd, 0, 2400);
        edge = wd;
        wtxt = '±' + U.fmt(wd, 3);
        plot.opts.x.domain = [-wd, wd];
      } else {
        const x0 = Math.pow(10, 3 * st0.zoom);
        const x1 = x0 * 6 + 20;
        xs = U.linspace(x0, x1, 2400);
        edge = x0;
        wtxt = '[' + U.fmt(x0, 4) + ', ' + U.fmt(x1, 4) + ']';
        plot.opts.x.domain = [x0, x1];
      }
      const fy = xs.map(S.f);
      const gy = xs.map(S.g);
      const hy = xs.map(S.h);
      const lo = Math.min(...gy);
      const hi = Math.max(...hy);
      const pad = (hi - lo) * 0.08 || 0.1;
      plot.render([
        { type: 'area', x: xs, y0: gy, y1: hy, color: 'tree', opacity: 0.12 },
        { type: 'line', x: xs, y: gy, color: 'tree', width: 2, label: 'снизу: ' + S.gt, hover: false },
        { type: 'line', x: xs, y: hy, color: 'tree', width: 2, dash: '6 4', label: 'сверху: ' + S.ht, hover: false },
        { type: 'line', x: xs, y: fy, color: 'model', width: 1.6, label: 'f(x)', hover: false },
        S.L !== null ? { type: 'hline', y: S.L, color: 'ink2', dash: '3 3', width: 1 } : null,
      ], { y: [lo - pad, hi + pad] });
      st.set('w', wtxt);
      st.set('c', U.fmt(S.h(edge) - S.g(edge), 4));
      st.set('f', U.fmt(S.f(edge), 4));
      st.set('L', S.L === null ? 'нет' : String(S.L));
      note.innerHTML = S.note;
    }
    w.pythonAction(() => {
      const S = SQ[st0.fn];
      const pts = S.at0 ? '[0.1, 0.01, 0.001, 0.0001]' : '[10.5, 100.5, 1000.5, 10000.5]';
      return 'import numpy as np\n\nf = lambda x: ' + S.py[0] + '\ng = lambda x: ' + S.py[1] + '   # снизу\nh = lambda x: ' + S.py[2] + '   # сверху\nfor x in np.array(' + pts + '):\n    print(f"x = {x}: {g(x):.6f} ≤ f = {f(x):.6f} ≤ {h(x):.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 8. Сжатие на единичной окружности: sin x ≤ x ≤ tan x
   * ============================================================================== */
  GBC.widget('squeeze-circle', (el) => {
    const st0 = { x: 0.8 };
    const w = ui.shell(el, { title: 'Почему sin x / x → 1: доказательство площадями', sub: 'Угол x (в радианах) на окружности радиуса 1. Три вложенные фигуры: треугольник (площадь ½ sin x) ⊂ сектор (½ x) ⊂ большой треугольник (½ tan x). Уменьшайте угол.' });
    ui.slider(w.controls, { label: 'Угол x, радиан', min: 0.02, max: 1.4, step: 0.01, value: st0.x, onInput: (v) => ((st0.x = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 300, equal: true, x: { label: '', domain: [-0.1, 1.15] }, y: { label: '', domain: [-0.1, 1.6] } });
    const p2 = new GBC.Plot(w.main, { height: 240, x: { label: 'x, радиан', domain: [-1.4, 1.4] }, y: { label: 'значение', domain: [0, 1.15] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 's', label: '½ sin x' }, { key: 'x', label: '½ x (сектор)' }, { key: 't', label: '½ tan x' }, { key: 'c', label: 'cos x' }, { key: 'r', label: 'sin x / x' }]);
    function draw() {
      const x = st0.x;
      const c = Math.cos(x);
      const s = Math.sin(x);
      const t = Math.tan(x);
      const T = U.linspace(0, 1, 201);
      const ray = (u) => u * (s / c);
      const big = T.map((u) => Math.min(ray(u), 1.6));
      const sector = T.map((u) => (u <= c ? ray(u) : Math.sqrt(Math.max(0, 1 - u * u))));
      const small = T.map((u) => (u <= c ? ray(u) : (s * (1 - u)) / (1 - c)));
      const arc = U.linspace(0, Math.PI / 2, 120);
      p1.render([
        { type: 'area', x: T, y0: T.map(() => 0), y1: big, color: 'tree', opacity: 0.18, label: 'большой треугольник: ½ tan x' },
        { type: 'area', x: T, y0: T.map(() => 0), y1: sector, color: 'aqua', opacity: 0.3, label: 'сектор: ½ x' },
        { type: 'area', x: T, y0: T.map(() => 0), y1: small, color: 'model', opacity: 0.4, label: 'треугольник: ½ sin x' },
        { type: 'line', x: arc.map(Math.cos), y: arc.map(Math.sin), color: 'ink2', width: 1.5, hover: false },
        { type: 'segments', x1: [0, c, 1], y1: [0, 0, 0], x2: [Math.min(1, (1.6 * c) / s), c, 1], y2: [Math.min(t, 1.6), s, Math.min(t, 1.6)], color: 'ink', width: 1.4, opacity: 0.9 },
        { type: 'text', items: [{ x: c, y: s / 2, dx: 4, text: 'sin x' }, { x: 1, y: Math.min(t, 1.55) / 2, dx: -6, anchor: 'end', text: 'tan x' }] },
      ]);
      const xs = U.linspace(-1.4, 1.4, 281).filter((v) => Math.abs(v) > 1e-9);
      p2.render([
        { type: 'line', x: xs, y: xs.map(() => 1), color: 'tree', width: 2, label: '1 (сверху)', hover: false },
        { type: 'line', x: xs, y: xs.map((v) => Math.sin(v) / v), color: 'model', width: 2.4, label: 'sin x / x', hover: false },
        { type: 'line', x: xs, y: xs.map(Math.cos), color: 'aqua', width: 2, label: 'cos x (снизу)', hover: false },
        { type: 'points', x: [x, x, x], y: [1, s / x, c], color: (i) => ['tree', 'model', 'aqua'][i], r: 5 },
        { type: 'points', x: [0], y: [1], color: 'model', r: 5, hollow: true },
      ]);
      st.set('s', U.fmt(s / 2, 4));
      st.set('x', U.fmt(x / 2, 4));
      st.set('t', U.fmt(t / 2, 4));
      st.set('c', U.fmt(c, 5));
      st.set('r', U.fmt(s / x, 6));
      note.innerHTML = 'Площади вложены: ½ sin x ≤ ½ x ≤ ½ tan x. Делим на ½ sin x и переворачиваем: <b>cos x ≤ sin x / x ≤ 1</b> — сейчас ' + U.fmt(c, 5) + ' ≤ ' + U.fmt(s / x, 5) + ' ≤ 1. При уменьшении угла cos x → 1, и sin x / x зажата между двумя величинами, стремящимися к 1. Значит, и она → 1.';
    }
    w.pythonAction(() => 'import numpy as np\n\nfor x in [0.8, 0.5, 0.1, 0.01]:\n    print(f"x = {x:<5}: cos x = {np.cos(x):.6f} ≤ sin x / x = {np.sin(x) / x:.6f} ≤ 1")\n');
    draw();
  });

  /* ==============================================================================
   * 9. Семейство синуса: tan, 1 − cos, arcsin, sin ax / sin bx, градусы
   * ============================================================================== */
  const SF = {
    sinax: { label: 'sin(ax)/x → a', params: ['a'], f: (x, p) => Math.sin(p.a * x) / x, L: (p) => p.a, num: (x, p) => Math.sin(p.a * x), app: (x, p) => p.a * x, nt: 'sin(ax)', at: 'ax', dom: 0.6, py: (p) => ['np.sin(' + p.a + '*x) / x', p.a], note: (p) => 'sin(ax)/x = a · sin(ax)/(ax), а замена t = ax сводит всё к sin t / t → 1. Предел — <b>' + U.fmt(p.a, 3) + '</b>.' },
    tan: { label: 'tan x / x → 1', params: [], f: (x) => Math.tan(x) / x, L: () => 1, num: Math.tan, app: (x) => x, nt: 'tan x', at: 'x', dom: 1.2, py: () => ['np.tan(x) / x', 1], note: () => 'tan x / x = (sin x / x) · (1 / cos x) → 1 · 1. Тангенс чуть больше угла, синус чуть меньше.' },
    cos: { label: '(1 − cos x)/x² → 1/2', params: [], f: (x) => (2 * Math.sin(x / 2) ** 2) / (x * x), L: () => 0.5, num: (x) => 1 - Math.cos(x), app: (x) => (x * x) / 2, nt: '1 − cos x', at: 'x²/2', dom: 2.5, py: () => ['(1 - np.cos(x)) / x**2', 0.5], note: () => '1 − cos x = 2 sin²(x/2), поэтому дробь = ½ · (sin(x/2)/(x/2))² → ½. Косинус около нуля — перевёрнутая парабола 1 − x²/2.' },
    asin: { label: 'arcsin x / x → 1', params: [], f: (x) => Math.asin(x) / x, L: () => 1, num: Math.asin, app: (x) => x, nt: 'arcsin x', at: 'x', dom: 1, py: () => ['np.arcsin(x) / x', 1], note: () => 'Замена t = arcsin x, x = sin t: дробь превращается в t / sin t → 1.' },
    ratio: { label: 'sin(ax)/sin(bx) → a/b', params: ['a', 'b'], f: (x, p) => Math.sin(p.a * x) / Math.sin(p.b * x), L: (p) => p.a / p.b, num: (x, p) => Math.sin(p.a * x), app: (x, p) => p.a * x, nt: 'sin(ax)', at: 'ax', dom: 0.6, py: (p) => ['np.sin(' + p.a + '*x) / np.sin(' + p.b + '*x)', p.a / p.b], note: (p) => 'Каждый синус ≈ своему аргументу: sin(ax)/sin(bx) ≈ ax/bx = a/b = <b>' + U.fmt(p.a / p.b, 4) + '</b>. Чем больше a и b, тем ближе к нулю нужно подойти, чтобы приближение стало точным.' },
    deg: { label: 'sin(x°)/x — угол в градусах', params: [], f: (x) => Math.sin((Math.PI * x) / 180) / x, L: () => Math.PI / 180, num: (x) => Math.sin((Math.PI * x) / 180), app: (x) => (Math.PI * x) / 180, nt: 'sin(x°)', at: 'πx/180', dom: 90, py: () => ['np.sin(np.radians(x)) / x', Math.PI / 180], note: () => 'x градусов = πx/180 радиан. Поэтому sin(x°)/x → π/180 ≈ <b>0.017453</b>, а не 1. Замечательный предел верен только в радианах.' },
  };
  GBC.widget('sin-family', (el) => {
    const st0 = { fn: 'sinax', zoom: 0, p: { a: 3, b: 2 } };
    const w = ui.shell(el, { title: 'Семейство первого замечательного предела', sub: 'Сверху — дробь около нуля и её предел. Снизу — числитель и его «главная часть»: около нуля они почти совпадают. Приближайтесь к нулю ползунком «окно».' });
    ui.select(w.controls, { label: 'Предел', value: st0.fn, options: Object.entries(SF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), resetParams(), draw()) });
    const pbox = paramBox(w.controls);
    ui.slider(w.controls, { label: 'Окно: ближе к нулю →', min: 0, max: 1, step: 0.01, value: 0, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => ((st0.zoom = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'x' }, y: { label: 'дробь' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'x' }, y: { label: 'числитель' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'предел' }, { key: 'v', label: 'дробь на краю окна' }, { key: 'e', label: 'отн. ошибка «главной части» на краю' }]);
    const SPEC = { a: { key: 'a', label: 'a', min: 0.5, max: 5, step: 0.5, value: 3 }, b: { key: 'b', label: 'b', min: 0.5, max: 5, step: 0.5, value: 2 } };
    function resetParams() {
      pbox.reset(SF[st0.fn].params.map((k) => SPEC[k]), st0.p, draw);
    }
    function draw() {
      const S = SF[st0.fn];
      const p = st0.p;
      const scale = st0.fn === 'sinax' ? 3 / p.a : st0.fn === 'ratio' ? 2 / Math.max(p.a, p.b) : 1;
      const wd = S.dom * scale * Math.pow(10, -2 * st0.zoom);
      const xs = U.linspace(-wd, wd, 801).filter((x) => Math.abs(x) > 1e-12);
      const L = S.L(p);
      const fy = xs.map((x) => S.f(x, p));
      const fin = fy.filter((v) => Number.isFinite(v) && Math.abs(v) < 50);
      let [lo, hi] = U.extent(fin.concat([L]));
      const pad = Math.max((hi - lo) * 0.12, Math.abs(L) * 0.02 + 1e-4);
      p1.render([
        { type: 'line', x: xs, y: fy.map((v) => (Math.abs(v) < 50 ? v : NaN)), color: 'violet', width: 2.4, hover: false },
        { type: 'hline', y: L, color: 'ink2', dash: '6 4', text: 'предел ' + U.fmt(L, 4) },
        { type: 'points', x: [0], y: [L], color: 'violet', r: 5, hollow: true },
      ], { x: [-wd, wd], y: [lo - pad, hi + pad] });
      p2.render([
        { type: 'line', x: xs, y: xs.map((x) => S.num(x, p)), color: 'model', width: 2.4, label: S.nt, hover: false },
        { type: 'line', x: xs, y: xs.map((x) => S.app(x, p)), color: 'tree', width: 2, dash: '6 4', label: 'главная часть ' + S.at, hover: false },
      ], { x: [-wd, wd] });
      const e = Math.abs(S.num(wd, p) - S.app(wd, p)) / Math.abs(S.num(wd, p));
      st.set('L', U.fmt(L, 6));
      st.set('v', U.fmt(S.f(wd, p), 6));
      st.set('e', U.fmt(100 * e, 3) + ' %');
      note.innerHTML = S.note(p);
    }
    w.pythonAction(() => {
      const S = SF[st0.fn];
      const [expr, L] = S.py(st0.p);
      const pts = st0.fn === 'deg' ? '[10, 1, 0.1, 0.01]' : '[0.5, 0.1, 0.01, 0.001]';
      return 'import numpy as np\n\nf = lambda x: ' + expr + '\nfor x in ' + pts + ':\n    print(f"x = {x:<6}: {f(x):.8f}")\nprint("предел:", ' + U.pyNum(L) + ')\n';
    });
    resetParams();
    draw();
  });

  /* ==============================================================================
   * 10. Сложные проценты и число e
   * ============================================================================== */
  const NS = [1, 2, 4, 12, 52, 365, 8760];
  const NSL = ['раз в год', 'раз в полгода', 'раз в квартал', 'ежемесячно', 'еженедельно', 'ежедневно', 'ежечасно'];
  GBC.widget('compound-interest', (el) => {
    const st0 = { k: 0, r: 1 };
    const w = ui.shell(el, { title: 'Сложные проценты: откуда берётся число e', sub: 'Вклад 100 тыс. ₽ под ставку r годовых. Проценты начисляют n раз в год, каждый раз по r/n — и сразу добавляют к вкладу. Чем чаще начисляют, тем больше в конце года, но рост упирается в предел.' });
    ui.player(w.controls, { label: 'Как часто начислять', min: 0, max: NS.length - 1, value: 0, fps: 1, format: (k) => NSL[k], onChange: (k) => ((st0.k = k), draw()) });
    ui.slider(w.controls, { label: 'Ставка r', min: 0.1, max: 1, step: 0.05, value: st0.r, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => ((st0.r = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'время, доли года', domain: [0, 1] }, y: { label: 'на счёте, тыс. ₽' } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    function draw() {
      const n = NS[st0.k];
      const r = st0.r;
      const pts = Math.min(n, 400);
      const steps = U.range(pts + 1).map((i) => i / pts);
      const val = (t) => 100 * Math.pow(1 + r / n, Math.floor(t * n + 1e-9));
      const ts = U.linspace(0, 1, 301);
      plot.render([
        { type: 'line', x: ts, y: ts.map((t) => 100 * Math.exp(r * t)), color: 'tree', width: 2, dash: '6 4', label: 'непрерывно: 100·e^{rt}' },
        { type: 'line', x: n <= 400 ? steps : ts, y: (n <= 400 ? steps : ts).map(val), color: 'model', width: 2.2, curve: n <= 400 ? 'step' : null, label: 'начисление ' + n + ' раз в год' },
        { type: 'hline', y: 100 * Math.exp(r), color: 'ink2', dash: '3 3', text: '100·e^r ≈ ' + U.fmt(100 * Math.exp(r), 5) },
      ], { y: [95, 100 * Math.exp(r) * 1.04] });
      rowTable(tableBox, ['n раз в год', '(1 + r/n)ⁿ', 'через год, ₽'], NS.slice(0, st0.k + 1).map((m) => [String(m), U.fmt(Math.pow(1 + r / m, m), 6), Math.round(100000 * Math.pow(1 + r / m, m)).toLocaleString('ru-RU')]), (i) => i === st0.k);
      note.innerHTML = 'Множитель за год — (1 + r/n)ⁿ. При r = 100 %: раз в год ×2, ежемесячно ×' + U.fmt(Math.pow(13 / 12, 12), 5) + ', ежедневно ×' + U.fmt(Math.pow(366 / 365, 365), 5) + '. Даже при начислении каждую секунду больше <b>e ≈ 2.71828</b> не получится — это второй замечательный предел. При ставке r предел множителя — <b>e^r = ' + U.fmt(Math.exp(r), 5) + '</b> (непрерывное начисление).';
    }
    w.pythonAction(() => 'r = ' + U.pyNum(st0.r) + '\nfor n in [1, 2, 4, 12, 52, 365, 8760, 525600]:\n    k = (1 + r / n) ** n\n    print(f"n = {n:>6}: множитель {k:.6f}, через год {100000 * k:,.0f} ₽")\nimport math\nprint("предел e^r =", math.exp(r))\n');
    draw();
  });

  /* ==============================================================================
   * 11. Форма 1^∞: решает произведение v·(u − 1)
   * ============================================================================== */
  const OTI = {
    a: { label: '(1 + a/n)ⁿ → eᵃ', param: true, u: (n, a) => 1 + a / n, v: (n) => n, L: (a) => Math.exp(a), lt: (a) => 'e^' + U.fmt(a, 2), py: (a) => ['1 + ' + U.pyNum(a) + '/n', 'n'] },
    boot: { label: '(1 − 1/n)ⁿ → 1/e (бутстрэп)', u: (n) => 1 - 1 / n, v: (n) => n, L: () => Math.exp(-1), lt: () => 'e⁻¹', py: () => ['1 - 1/n', 'n'] },
    ratio: { label: '((n + 1)/(n − 1))ⁿ → e²', u: (n) => (n + 1) / (n - 1), v: (n) => n, L: () => Math.E * Math.E, lt: () => 'e²', n0: 2, py: () => ['(n + 1)/(n - 1)', 'n'] },
    fast: { label: '(1 + 1/n)^(n²) → ∞', u: (n) => 1 + 1 / n, v: (n) => n * n, L: () => Infinity, lt: () => '∞', log: true, py: () => ['1 + 1/n', 'n**2'] },
    slow: { label: '(1 + 1/n²)ⁿ → 1', u: (n) => 1 + 1 / (n * n), v: (n) => n, L: () => 1, lt: () => '1', py: () => ['1 + 1/n**2', 'n'] },
  };
  GBC.widget('one-to-infinity', (el) => {
    const st0 = { fn: 'a', a: 2, n: 10 };
    const NMAX = 60;
    const w = ui.shell(el, { title: 'Форма 1^∞: основание → 1, показатель → ∞', sub: 'Точки — члены последовательности uₙ в степени vₙ. Внизу, в строке показателей, — главная величина vₙ·(uₙ − 1): если она стремится к числу c, то ответ e^c. Двигайте n.' });
    ui.select(w.controls, { label: 'Последовательность', value: st0.fn, options: Object.entries(OTI).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), (aSl.el.style.display = OTI[v].param ? '' : 'none'), draw()) });
    const aSl = ui.slider(w.controls, { label: 'a', min: -2, max: 3, step: 0.25, value: st0.a, onInput: (v) => ((st0.a = v), draw()) });
    ui.player(w.controls, { label: 'Номер n', min: 2, max: NMAX, value: st0.n, fps: 6, format: (k) => 'n = ' + k, onChange: (k) => ((st0.n = k), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'n', domain: [0, NMAX + 1] }, y: { label: 'член последовательности' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'u', label: 'основание uₙ' }, { key: 'v', label: 'показатель vₙ' }, { key: 'c', label: 'vₙ·(uₙ − 1)' }, { key: 'x', label: 'uₙ^vₙ' }, { key: 'L', label: 'предел' }]);
    const val = (O, n, a) => Math.exp(O.v(n, a) * Math.log(O.u(n, a)));
    function draw() {
      const O = OTI[st0.fn];
      const a = st0.a;
      const n0 = O.n0 || 1;
      const ns = U.range(NMAX - n0 + 1, n0);
      const ys = ns.map((n) => val(O, n, a));
      const L = O.L(a);
      plot.opts.y = O.log ? { label: 'член (лог. шкала)', type: 'log', ticks: decadeTicks(0, 30, 5), format: powFmt } : { label: 'член последовательности' };
      const yf = ys.filter(Number.isFinite);
      const yd = O.log ? [1, 1e30] : [Math.min(...yf, L) - 0.1 * Math.abs(L || 1), Math.max(...yf, L) + 0.1 * Math.abs(L || 1)];
      plot.render([
        Number.isFinite(L) ? { type: 'hline', y: L, color: 'tree', dash: '6 4', width: 1.6, text: 'предел ' + O.lt(a) + ' ≈ ' + U.fmt(L, 5) } : null,
        { type: 'points', x: ns, y: O.log ? ys.map((v) => clipLog(v, 1, 1e30)) : ys, color: 'model', r: 3.5, tooltip: (i) => [['n', String(ns[i])], ['uₙ^vₙ', U.fmt(ys[i], 6)]] },
        { type: 'points', x: [st0.n], y: [val(O, st0.n, a)], color: 'violet', r: 6.5 },
      ], { y: yd });
      const n = st0.n;
      st.set('u', U.fmt(O.u(n, a), 6));
      st.set('v', U.fmt(O.v(n, a), 5));
      st.set('c', U.fmt(O.v(n, a) * (O.u(n, a) - 1), 5));
      st.set('x', U.fmt(val(O, n, a), 6));
      st.set('L', fmtL(L, 5));
      const c = O.v(n, a) * (O.u(n, a) - 1);
      note.innerHTML = 'Сейчас vₙ·(uₙ − 1) = ' + U.fmt(c, 4) + '. ' + ({
        a: 'Это ровно a при любом n — ответ e^a. При a = 1 — число e, при a = −1 — 1/e, при a = 0 последовательность тождественно 1.',
        boot: 'Произведение равно −1 при любом n — ответ e⁻¹ ≈ 0.3679: такова доля объектов, не попавших в бутстрэп-выборку (шаг 26).',
        ratio: 'Произведение 2n/(n − 1) → 2 — ответ e² ≈ 7.389.',
        fast: 'Произведение равно n и растёт без границ — значит, и uₙ^vₙ → ∞ (при n = 20 уже 3 · 10⁸). Основание стремится к 1, но показатель растёт слишком быстро.',
        slow: 'Произведение 1/n → 0 — ответ e⁰ = 1. Здесь, наоборот, основание приближается к 1 слишком быстро.',
      })[st0.fn];
    }
    w.pythonAction(() => {
      const O = OTI[st0.fn];
      const [u, v] = O.py(st0.a);
      return 'import numpy as np\n\nfor n in [10, 100, 1000, 10**4]:\n    u, v = ' + u + ', ' + v + '\n    print(f"n = {n:>5}: v·(u − 1) = {v * (u - 1):.6f}, u^v = {np.exp(v * np.log(u)):.6g}")\n';
    });
    aSl.el.style.display = '';
    draw();
  });

  /* ==============================================================================
   * 12. Экспонента, логарифм и степени около нуля: касательные
   * ============================================================================== */
  const EL = {
    exp: { label: 'eˣ ≈ 1 + x', f: Math.exp, k: () => 1, f0: 1, ft: 'eˣ', tt: '1 + x', py: () => 'np.exp(x)', dom: 2 },
    ln: { label: 'ln(1 + x) ≈ x', f: Math.log1p, k: () => 1, f0: 0, ft: 'ln(1 + x)', tt: 'x', py: () => 'np.log1p(x)', dom: 0.95 },
    pow: { label: 'aˣ ≈ 1 + x·ln a', param: 'a', f: (x, p) => Math.pow(p.a, x), k: (p) => Math.log(p.a), f0: 1, ft: 'aˣ', tt: '1 + x ln a', py: (p) => U.pyNum(p.a) + '**x', dom: 2 },
    binom: { label: '(1 + x)ᵖ ≈ 1 + px', param: 'p', f: (x, p) => Math.pow(1 + x, p.p), k: (p) => p.p, f0: 1, ft: '(1 + x)ᵖ', tt: '1 + px', py: (p) => '(1 + x)**' + U.pyNum(p.p), dom: 0.95 },
    sqrt: { label: '√(1 + x) ≈ 1 + x/2', f: (x) => Math.sqrt(1 + x), k: () => 0.5, f0: 1, ft: '√(1 + x)', tt: '1 + x/2', py: () => 'np.sqrt(1 + x)', dom: 0.95 },
  };
  GBC.widget('exp-log-zero', (el) => {
    const st0 = { fn: 'exp', zoom: 0.35, p: { a: 2, p: 3 } };
    const w = ui.shell(el, { title: 'Около нуля кривая ≈ касательная', sub: 'Сверху — функция (синяя) и её касательная в нуле (оранжевый пунктир). Снизу — отношение (f(x) − f(0))/x: оно стремится к наклону касательной. Сужайте окно — кривая и прямая сливаются.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(EL).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), resetParams(), draw()) });
    const pbox = paramBox(w.controls);
    ui.slider(w.controls, { label: 'Окно: ближе к нулю →', min: 0, max: 1, step: 0.01, value: st0.zoom, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => ((st0.zoom = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'x' }, y: { label: '(f(x) − f(0))/x' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'наклон (предел)' }, { key: 'r', label: 'отношение на краю' }, { key: 'e', label: 'отн. ошибка касательной на краю' }]);
    const SPEC = { a: { key: 'a', label: 'основание a', min: 0.25, max: 5, step: 0.25, value: 2 }, p: { key: 'p', label: 'показатель p', min: -2, max: 3, step: 0.25, value: 3 } };
    function resetParams() {
      const E = EL[st0.fn];
      pbox.reset(E.param ? [SPEC[E.param]] : [], st0.p, draw);
    }
    function draw() {
      const E = EL[st0.fn];
      const p = st0.p;
      const k = E.k(p);
      const wd = E.dom * Math.pow(10, -2 * st0.zoom);
      const xs = U.linspace(-wd, wd, 401);
      const fx = (x) => E.f(x, p);
      p1.render([
        { type: 'line', x: xs, y: xs.map(fx), color: 'model', width: 2.4, label: E.ft, hover: false },
        { type: 'line', x: xs, y: xs.map((x) => E.f0 + k * x), color: 'tree', width: 2, dash: '6 4', label: 'касательная ' + E.tt, hover: false },
        { type: 'points', x: [0], y: [E.f0], color: 'model', r: 4.5 },
      ], { x: [-wd, wd] });
      const xr = xs.filter((x) => Math.abs(x) > 1e-12);
      const rs = xr.map((x) => (fx(x) - E.f0) / x);
      const [lo, hi] = U.extent(rs.concat([k]));
      const pad = Math.max((hi - lo) * 0.15, Math.abs(k) * 0.01 + 1e-4);
      p2.render([
        { type: 'line', x: xr, y: rs, color: 'violet', width: 2.4, hover: false },
        { type: 'hline', y: k, color: 'ink2', dash: '6 4', text: 'наклон ' + U.fmt(k, 4) },
        { type: 'points', x: [0], y: [k], color: 'violet', r: 5, hollow: true },
      ], { x: [-wd, wd], y: [lo - pad, hi + pad] });
      const r = (fx(wd) - E.f0) / wd;
      st.set('k', U.fmt(k, 6));
      st.set('r', U.fmt(r, 6));
      st.set('e', U.fmt((100 * Math.abs(fx(wd) - (E.f0 + k * wd))) / Math.abs(fx(wd)), 3) + ' %');
      note.innerHTML = 'При x = ' + U.fmt(wd, 3) + ' касательная ' + E.tt + ' отличается от ' + E.ft + ' на ' + U.fmt((100 * Math.abs(fx(wd) - (E.f0 + k * wd))) / Math.abs(fx(wd)), 3) + ' %. Сократите окно в 10 раз — ошибка упадёт примерно в 100 раз: она второго порядка (шаг 16). Наклон касательной — это производная в нуле (урок 15.5).';
    }
    w.pythonAction(() => {
      const E = EL[st0.fn];
      const k = E.k(st0.p);
      return 'import numpy as np\n\nf = lambda x: ' + E.py(st0.p) + '\nk = ' + U.pyNum(Number(k.toPrecision(12))) + '  # наклон касательной в нуле\nfor x in [0.1, 0.01, 0.001, -0.01]:\n    print(f"x = {x:<6}: (f(x) − f(0))/x = {(f(x) - f(0)) / x:.6f},  касательная ошибается на {abs(f(x) - (f(0) + k*x)):.2e}")\n';
    });
    resetParams();
    draw();
  });

  GBC.lesson154 = { powFmt, curve, denseNear, logspace, clipLog, decadeTicks, texInto, texEl, card, cardGrid, badge, rowTable, slope, fmtL, py, paramBox, sigma };
})();
