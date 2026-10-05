/* Урок 15.4, часть 2: сравнение скоростей, непрерывность, пределы и непрерывность в ML, тренажёр.
 * Виджеты: порядок малости на двойной логарифмической шкале, замена на эквивалентные и её ловушка,
 * гонка роста (лестница и пары), неопределённости 0·∞, 0⁰, ∞⁰, проверка непрерывности, доопределение,
 * склейка кусков (в том числе потери Хьюбера), деление пополам, теорема Вейерштрасса, сумма пней,
 * accuracy против log-loss, число e в бэггинге и бустинге, устойчивые формулы, тренажёр.
 * Помощники — из lesson.js (GBC.lesson154). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const { powFmt, curve, denseNear, logspace, clipLog, decadeTicks, texInto, texEl, card, cardGrid, badge, rowTable, fmtL, paramBox, sigma } = GBC.lesson154;
  const R = String.raw;

  /* ==============================================================================
   * 16. Порядок малости: наклон на двойной логарифмической шкале
   * ============================================================================== */
  const IO = {
    sin: { label: 'sin x', f: Math.sin, k: 1, C: 1, ct: '1', py: 'np.sin(x)' },
    tan: { label: 'tan x', f: Math.tan, k: 1, C: 1, ct: '1', py: 'np.tan(x)' },
    cos: { label: '1 − cos x', f: (x) => 2 * Math.sin(x / 2) ** 2, k: 2, C: 0.5, ct: '1/2', py: '1 - np.cos(x)' },
    exp: { label: 'eˣ − 1 − x', f: (x) => Math.expm1(x) - x, k: 2, C: 0.5, ct: '1/2', py: 'np.expm1(x) - x' },
    xsin: { label: 'x − sin x', f: (x) => x - Math.sin(x), k: 3, C: 1 / 6, ct: '1/6', py: 'x - np.sin(x)' },
    tansin: { label: 'tan x − sin x', f: (x) => Math.tan(x) * 2 * Math.sin(x / 2) ** 2, k: 3, C: 0.5, ct: '1/2', py: 'np.tan(x) - np.sin(x)' },
    sqrt: { label: '√x', f: Math.sqrt, k: 0.5, C: 1, ct: '1', py: 'np.sqrt(x)' },
    xlnx: { label: '−x ln x', f: (x) => -x * Math.log(x), k: null, C: null, ct: '—', py: '-x * np.log(x)' },
  };
  const supK = (k) => ({ 0.5: '^½', 1: '', 2: '²', 3: '³' })[k];
  GBC.widget('infinitesimal-orders', (el) => {
    const st0 = { fn: 'cos', x0: 0.01 };
    const w = ui.shell(el, { title: 'Порядок бесконечно малой = наклон на лог-лог графике', sub: 'Обе оси логарифмические. Серые пунктиры — эталоны √x, x, x², x³. Выбранная функция (синяя) около нуля идёт параллельно одному из них — это и есть её порядок. Ползунок задаёт точку, где измеряется наклон.' });
    ui.select(w.controls, { label: 'Бесконечно малая', value: st0.fn, options: Object.entries(IO).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.slider(w.controls, { label: 'Точка измерения x₀', min: 0.001, max: 0.5, log: true, value: st0.x0, format: (v) => U.fmt(v, 3), onInput: (v) => ((st0.x0 = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 330, x: { label: 'x (лог. шкала)', type: 'log', domain: [1e-3, 1], ticks: [1e-3, 1e-2, 0.1, 1], format: powFmt }, y: { label: '|f(x)| (лог. шкала)', type: 'log', domain: [1e-12, 2], ticks: decadeTicks(-12, 0, 2), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 's', label: 'наклон около x₀' }, { key: 'k', label: 'порядок k' }, { key: 'r', label: 'f(x₀)/x₀ᵏ' }, { key: 'C', label: 'константа C' }]);
    function draw() {
      const I = IO[st0.fn];
      const xs = logspace(-3, 0, 300);
      const ref = (p) => ({ type: 'line', x: xs, y: xs.map((x) => clipLog(Math.pow(x, p), 1e-12, 2)), color: 'muted', width: 1.2, dash: '4 4', hover: false });
      const x0 = st0.x0;
      const s = (Math.log(I.f(x0 * 1.5)) - Math.log(I.f(x0 / 1.5))) / (2 * Math.log(1.5));
      plot.render([
        ref(0.5), ref(1), ref(2), ref(3),
        { type: 'text', items: [[0.5, '√x'], [1, 'x'], [2, 'x²'], [3, 'x³']].map(([q, t]) => ({ x: 1.15e-3, y: Math.pow(1.15e-3, q), dy: -6, text: t, color: 'muted' })) },
        { type: 'line', x: xs, y: xs.map((x) => clipLog(I.f(x), 1e-12, 2)), color: 'model', width: 2.8, label: I.label, hover: false },
        { type: 'points', x: [x0], y: [I.f(x0)], color: 'tree', r: 6 },
      ]);
      st.set('s', U.fmt(s, 4));
      st.set('k', I.k === null ? 'нет' : String(I.k));
      st.set('r', I.k === null ? '—' : U.fmt(I.f(x0) / Math.pow(x0, I.k), 5));
      st.set('C', I.ct);
      note.innerHTML = I.k === null
        ? 'Наклон −x ln x около x₀ = ' + U.fmt(x0, 3) + ' равен ' + U.fmt(s, 3) + ' и очень медленно растёт к 1 при x₀ → 0. Целого порядка нет: функция медленнее x (отношение к x равно −ln x → ∞), но быстрее любой x^{0.9}.'
        : 'Наклон около x₀: <b>' + U.fmt(s, 3) + '</b> ≈ ' + I.k + '. Значит, ' + I.label + ' — бесконечно малая порядка ' + I.k + ': f(x) ≈ C·x' + supK(I.k) + ' с C = ' + I.ct + ' (отношение f(x₀)/x₀' + supK(I.k) + ' = ' + U.fmt(I.f(x0) / Math.pow(x0, I.k), 4) + '). Чем круче прямая, тем быстрее функция бежит к нулю.';
    }
    w.pythonAction(() => {
      const I = IO[st0.fn];
      return 'import numpy as np\n\nf = lambda x: ' + I.py + '\nfor x in [0.1, 0.01, 0.001]:\n    s = (np.log(f(x * 1.5)) - np.log(f(x / 1.5))) / (2 * np.log(1.5))\n    print(f"x = {x:<6}: f = {f(x):.3e}, локальный наклон (порядок) = {s:.4f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 17. Замена на эквивалентные и её ловушка
   * ============================================================================== */
  const EQ = [
    { lab: 'ln(1 + 3x)/sin 2x', tex: R`\lim_{x\to0}\frac{\ln(1+3x)}{\sin 2x}`, f: (x) => Math.log1p(3 * x) / Math.sin(2 * x), naive: R`\frac{3x}{2x}=\frac32`, nL: 1.5, L: 1.5, right: R`\text{замена верна: числитель и знаменатель — множители}`, dom: [-0.25, 0.6], py: 'np.log1p(3*x) / np.sin(2*x)' },
    { lab: '(e²ˣ − 1)/tan 5x', tex: R`\lim_{x\to0}\frac{e^{2x}-1}{\tan 5x}`, f: (x) => Math.expm1(2 * x) / Math.tan(5 * x), naive: R`\frac{2x}{5x}=\frac25`, nL: 0.4, L: 0.4, right: R`\text{замена верна}`, dom: [-0.25, 0.25], py: 'np.expm1(2*x) / np.tan(5*x)' },
    { lab: '(1 − cos 4x)/x²', tex: R`\lim_{x\to0}\frac{1-\cos 4x}{x^2}`, f: (x) => (2 * Math.sin(2 * x) ** 2) / (x * x), naive: R`\frac{(4x)^2/2}{x^2}=8`, nL: 8, L: 8, right: R`\text{замена верна: }u=4x\to0`, dom: [-0.6, 0.6], py: '(1 - np.cos(4*x)) / x**2' },
    { lab: '(√(1 + x) − 1)/sin x', tex: R`\lim_{x\to0}\frac{\sqrt{1+x}-1}{\sin x}`, f: (x) => x / (Math.sqrt(1 + x) + 1) / Math.sin(x), naive: R`\frac{x/2}{x}=\frac12`, nL: 0.5, L: 0.5, right: R`\text{замена верна}`, dom: [-0.8, 1.5], py: '(np.sqrt(1 + x) - 1) / np.sin(x)' },
    { lab: '(tan x − sin x)/x³ — ловушка', tex: R`\lim_{x\to0}\frac{\tan x-\sin x}{x^3}`, f: (x) => (Math.tan(x) * 2 * Math.sin(x / 2) ** 2) / x ** 3, naive: R`\frac{x-x}{x^3}=0\;?`, nL: 0, L: 0.5, right: R`\tan x-\sin x=\tan x\,(1-\cos x)\sim x\cdot\frac{x^2}{2}\;\Rightarrow\;\frac12`, dom: [-0.8, 0.8], py: '(np.tan(x) - np.sin(x)) / x**3', trap: true },
    { lab: '(sin x − x)/x³ — ловушка', tex: R`\lim_{x\to0}\frac{\sin x-x}{x^3}`, f: (x) => (Math.sin(x) - x) / x ** 3, naive: R`\frac{x-x}{x^3}=0\;?`, nL: 0, L: -1 / 6, right: R`\sin x=x-\frac{x^3}{6}+\dots\;\Rightarrow\;-\frac16`, dom: [-1.5, 1.5], py: '(np.sin(x) - x) / x**3', trap: true },
    { lab: '(eˣ − 1 − x)/x² — ловушка', tex: R`\lim_{x\to0}\frac{e^x-1-x}{x^2}`, f: (x) => (Math.expm1(x) - x) / (x * x), naive: R`\frac{x-x}{x^2}=0\;?`, nL: 0, L: 0.5, right: R`e^x=1+x+\frac{x^2}{2}+\dots\;\Rightarrow\;\frac12`, dom: [-1.5, 1.5], py: '(np.expm1(x) - x) / x**2', trap: true },
  ];
  GBC.widget('equivalence-trap', (el) => {
    const st0 = { i: 0 };
    const w = ui.shell(el, { title: 'Замена на эквивалентные: когда можно, когда нельзя', sub: 'Слева — «наивная» замена каждой части её главной частью, справа — верный ответ. График и таблица показывают настоящий предел. Последние три примера — ловушки: замена внутри разности.' });
    ui.select(w.controls, { label: 'Предел', value: '0', options: EQ.map((E, i) => ({ value: String(i), label: E.lab })), onChange: (v) => ((st0.i = +v), draw()) });
    const top = H('div');
    w.main.appendChild(top);
    const grid = cardGrid(230);
    const c1 = card('Наивная замена');
    const c2 = card('Как правильно');
    grid.append(c1.el, c2.el);
    w.main.appendChild(grid);
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: 'дробь' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const E = EQ[st0.i];
      texInto(top, E.tex, true);
      c1.body.textContent = '';
      c1.body.append(texEl(E.naive), H('div', { style: 'margin-top:6px' }, badge(E.trap ? 'неверно' : 'верно', E.trap ? 'bad' : 'good')));
      c2.body.textContent = '';
      c2.body.append(E.trap ? texEl(E.right) : H('div', { style: 'font-size:.95rem' }, 'Замена законна: числитель и знаменатель — множители, а не слагаемые.'), H('div', { style: 'margin-top:6px' }, badge('предел ' + U.fmt(E.L, 4), 'neutral')));
      const c = curve(E.f, E.dom[0], E.dom[1], 0, { xs: denseNear(E.dom[0], E.dom[1], 0, 600), skip: 0, cap: 50, jump: 5 });
      const fin = c.y.filter(Number.isFinite);
      let [lo, hi] = U.extent(fin.concat([E.L, E.nL]));
      const pad = Math.max((hi - lo) * 0.1, 0.05);
      plot.render([
        { type: 'line', x: c.x, y: c.y, color: 'violet', width: 2.4, hover: false },
        { type: 'hline', y: E.L, color: 'good', width: 1.6, dash: '6 4', text: 'верный предел ' + U.fmt(E.L, 4) },
        E.trap ? { type: 'hline', y: E.nL, color: 'critical', width: 1.6, dash: '2 4', text: 'наивный ответ ' + U.fmt(E.nL, 3) } : null,
        { type: 'points', x: [0], y: [E.L], color: 'violet', r: 5, hollow: true },
      ], { x: E.dom, y: [lo - pad, hi + pad] });
      rowTable(tbl, ['x', '0.1', '0.01', '0.001', '−0.001'], [['дробь', ...[0.1, 0.01, 0.001, -0.001].map((x) => U.fmt(E.f(x), 7))]]);
      note.innerHTML = E.trap
        ? 'Главные части числителя сокращаются (x − x = 0), и «наивный» ответ 0 <b>неверен</b>: таблица уверенно идёт к ' + U.fmt(E.L, 4) + '. В разности решает следующий, отброшенный член. Выход — превратить разность в произведение или взять больше членов разложения (урок 15.7).'
        : 'Числитель и знаменатель — <b>множители</b> дроби, поэтому каждый можно заменить эквивалентным: ответ ' + U.fmt(E.L, 4) + ' получается в одну строку, а таблица его подтверждает.';
    }
    w.pythonAction(() => {
      const E = EQ[st0.i];
      return 'import numpy as np\n\nf = lambda x: ' + E.py + '\nfor x in [0.1, 0.01, 0.001, -0.001]:\n    print(f"x = {x:<7}: {f(x):.8f}")\nprint("предел:", ' + U.pyNum(E.L) + ')\n';
    });
    draw();
  });

  /* ==============================================================================
   * 18a. Гонка роста: лестница и пары (сравнение через логарифмы)
   * ============================================================================== */
  const LN10 = Math.LN10;
  const lgFact = (() => {
    const t = [0];
    for (let n = 1; n <= 400; n++) t.push(t[n - 1] + Math.log10(n));
    return (n) => t[Math.round(n)];
  })();
  const GP = {
    lnsqrt: { label: 'ln x  против  √x', f: (x) => Math.log10(Math.log(x)), g: (x) => 0.5 * Math.log10(x), ft: 'ln x', gt: '√x', log: true, x0: 1.5, kmin: 1, kmax: 8, k: 4, py: ['np.log(x)', 'np.sqrt(x)'], lpy: ['np.log10(np.log(x))', '0.5 * np.log10(x)'], pts: '[10, 1e4, 1e8]' },
    ln01: { label: 'ln x  против  x^{0.1}', f: (x) => Math.log10(Math.log(x)), g: (x) => 0.1 * Math.log10(x), ft: 'ln x', gt: 'x^{0.1}', log: true, x0: 1.5, kmin: 2, kmax: 20, k: 18, py: ['np.log(x)', 'x**0.1'], lpy: ['np.log10(np.log(x))', '0.1 * np.log10(x)'], pts: '[10, 1e10, 3.4e15, 1e20]' },
    x5exp: { label: 'x⁵  против  eˣ', f: (x) => 5 * Math.log10(x), g: (x) => x / LN10, ft: 'x⁵', gt: 'eˣ', log: false, x0: 0.5, kmin: 5, kmax: 60, k: 20, py: ['x**5', 'np.exp(x)'], lpy: ['5 * np.log10(x)', 'x / np.log(10)'], pts: '[5, 12, 13, 30, 60]' },
    x100: { label: 'x¹⁰⁰  против  1.01ˣ', f: (x) => 100 * Math.log10(x), g: (x) => x * Math.log10(1.01), ft: 'x¹⁰⁰', gt: '1.01ˣ', log: true, x0: 1, kmin: 2, kmax: 6.5, k: 6, py: ['x**100', '1.01**x'], lpy: ['100 * np.log10(x)', 'x * np.log10(1.01)'], pts: '[10, 1e4, 1.2e5, 1e6]' },
    fact: { label: '2ⁿ  против  n!', f: (n) => n * Math.log10(2), g: lgFact, ft: '2ⁿ', gt: 'n!', disc: true, x0: 1, kmin: 5, kmax: 60, k: 15, py: ['2.0**n', 'math.factorial(n)'] },
    nn: { label: 'n!  против  nⁿ', f: lgFact, g: (n) => n * Math.log10(n), ft: 'n!', gt: 'nⁿ', disc: true, x0: 1, kmin: 5, kmax: 60, k: 20, py: ['math.factorial(n)', 'n**n'] },
  };
  const LADDER = [
    { label: 'ln x', f: Math.log, color: 'aqua' },
    { label: '√x', f: Math.sqrt, color: 'green' },
    { label: 'x', f: (x) => x, color: 'model' },
    { label: 'x²', f: (x) => x * x, color: 'violet' },
    { label: 'x⁵', f: (x) => x ** 5, color: 'magenta' },
    { label: 'eˣ', f: Math.exp, color: 'tree' },
  ];
  GBC.widget('growth-race', (el) => {
    const st0 = { mode: 'ladder', xmax: 10, pair: 'x5exp', k: 20 };
    const w = ui.shell(el, { title: 'Гонка роста: кто быстрее уходит в бесконечность', sub: 'Режим «Лестница» — шесть функций на логарифмической шкале. Режим «Пара» — две функции и их отношение; сравниваем десятичные логарифмы значений, иначе числа не поместятся ни в какой компьютер.' });
    ui.segmented(w.controls, { label: 'Режим', value: 'ladder', options: [{ value: 'ladder', label: 'Лестница' }, { value: 'pair', label: 'Пара' }], onChange: (v) => ((st0.mode = v), sync(), draw()) });
    const lad = H('div');
    const par = H('div');
    w.controls.append(lad, par);
    ui.slider(lad, { label: 'Финиш x', min: 5, max: 60, step: 1, value: st0.xmax, onInput: (v) => ((st0.xmax = v), draw()) });
    ui.select(par, { label: 'Пара', value: st0.pair, options: Object.entries(GP).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.pair = v), (st0.k = GP[v].k), kSl.set(GP[v].k), draw()) });
    const kOf = (v) => GP[st0.pair].kmin + v * (GP[st0.pair].kmax - GP[st0.pair].kmin);
    const kSl = ui.slider(par, { label: 'Финиш', min: 0, max: 1, step: 0.005, value: 0.5, format: (v) => fmtEnd(kOf(v)), onInput: (v) => ((st0.k = kOf(v)), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 280, x: { label: 'x' }, y: { label: 'значение' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'x' }, y: { label: 'lg(первая / вторая)' } });
    const note = w.note('', true);
    function endX() {
      const P = GP[st0.pair];
      return P.log ? Math.pow(10, st0.k) : st0.k;
    }
    function fmtEnd(k) {
      const P = GP[st0.pair];
      return P.log ? '10^' + U.fmt(k, 3) : (P.disc ? 'n = ' : 'x = ') + Math.round(k);
    }
    function sync() {
      lad.style.display = st0.mode === 'ladder' ? '' : 'none';
      par.style.display = st0.mode === 'pair' ? '' : 'none';
      p2.root.style.display = st0.mode === 'pair' ? '' : 'none';
      const P = GP[st0.pair];
      kSl.set((st0.k - P.kmin) / (P.kmax - P.kmin));
    }
    function crossings(P, xs) {
      const out = [];
      for (let i = 1; i < xs.length; i++) {
        const d0 = P.f(xs[i - 1]) - P.g(xs[i - 1]);
        const d1 = P.f(xs[i]) - P.g(xs[i]);
        if (Number.isFinite(d0) && Number.isFinite(d1) && d0 * d1 < 0) out.push(xs[i - 1] + (xs[i] - xs[i - 1]) * (d0 / (d0 - d1)));
      }
      return out;
    }
    function draw() {
      if (st0.mode === 'ladder') {
        const xs = U.linspace(1.01, st0.xmax, 300);
        const top = Math.min(Math.ceil(st0.xmax / LN10) + 1, 26);
        const stepD = Math.max(1, Math.ceil((top + 2) / 6));
        p1.opts.x = { label: 'x' };
        p1.opts.y = { label: 'значение (лог. шкала)', type: 'log', ticks: decadeTicks(-2, top, stepD), format: powFmt };
        p1.render(LADDER.map((F) => ({ type: 'line', x: xs, y: xs.map((x) => clipLog(F.f(x), 0.009, Math.pow(10, top) * 1.01)), color: F.color, width: 2.2, label: F.label, hover: false })), { x: [1, st0.xmax], y: [0.01, Math.pow(10, top)] });
        const x = st0.xmax;
        note.innerHTML = 'При x = ' + x + ': ln x = ' + U.fmt(Math.log(x), 3) + ', x² = ' + U.fmt(x * x, 4) + ', x⁵ = ' + U.fmt(x ** 5, 3) + ', eˣ = ' + U.fmt(Math.exp(x), 3) + '. ' + (x < 12.71
          ? 'Пока <b>x⁵ впереди eˣ</b>! Но сдвиньте финиш дальше 12.71 — экспонента обгонит и уже не отпустит.'
          : 'Экспонента обогнала x⁵ (при x ≈ 12.71) и уходит всё дальше. Порядок в итоге всегда один: <b>ln x ≪ √x ≪ x ≪ x² ≪ x⁵ ≪ eˣ</b>.');
        return;
      }
      const P = GP[st0.pair];
      const X1 = endX();
      let xs;
      if (P.disc) xs = U.range(Math.max(2, Math.round(X1)), 1);
      else if (P.log) xs = logspace(Math.log10(P.x0), Math.log10(X1), 500);
      else xs = U.linspace(P.x0, X1, 500);
      const xAx = P.log ? { label: 'x (лог. шкала)', type: 'log', domain: [P.x0, X1], ticks: decadeTicks(0, Math.floor(Math.log10(X1)), Math.max(1, Math.ceil(Math.log10(X1) / 6))), format: powFmt } : { label: P.disc ? 'n' : 'x', domain: [P.x0 - (P.disc ? 0.5 : 0), X1 + (P.disc ? 0.5 : 0)] };
      p1.opts.x = Object.assign({}, xAx);
      p2.opts.x = Object.assign({}, xAx);
      p1.opts.y = { label: 'lg значения' };
      const fy = xs.map(P.f);
      const gy = xs.map(P.g);
      const kind = P.disc ? 'points' : 'line';
      p1.render([
        { type: kind, x: xs, y: fy, color: 'model', width: 2.2, r: 3.5, label: P.ft, hover: false },
        { type: kind, x: xs, y: gy, color: 'tree', width: 2.2, r: 3.5, label: P.gt, hover: false },
      ]);
      const cr = crossings(P, P.disc ? xs : P.log ? logspace(Math.log10(P.x0), Math.log10(X1), 4000) : U.linspace(P.x0, X1, 4000));
      p2.render([
        { type: 'hline', y: 0, color: 'ink2', dash: '4 4', width: 1, text: 'поровну' },
        ...cr.map((c) => ({ type: 'vline', x: c, color: 'tree', dash: '3 3', width: 1 })),
        { type: kind, x: xs, y: fy.map((v, i) => v - gy[i]), color: 'violet', width: 2.2, r: 3.5, hover: false },
      ]);
      const d = P.f(X1) - P.g(X1);
      note.innerHTML = 'На финише lg(' + P.ft + ') = ' + U.fmt(P.f(X1), 4) + ', lg(' + P.gt + ') = ' + U.fmt(P.g(X1), 4) + ': отношение ' + P.ft + ' / ' + P.gt + ' = 10^' + U.fmt(d, 3) + '. ' + (cr.length ? 'Пересечения (пунктир): ' + cr.map((c) => U.fmt(c, 4)).join(' и ') + '. ' : '') + (d < 0 ? 'Вторая функция впереди, и отношение продолжает падать: <b>' + P.ft + ' ≪ ' + P.gt + '</b>.' : 'Пока впереди первая — двигайте финиш дальше: обгон обязательно случится.');
    }
    w.pythonAction(() => {
      if (st0.mode === 'ladder') return 'import numpy as np\n\nfor x in [10, 20, 50, 100]:\n    print(f"x = {x:>3}: ln x = {np.log(x):5.2f}, x² = {x**2:6d}, eˣ = {np.exp(x):.3e}, x⁵/eˣ = {x**5 / np.exp(x):.3e}")\n';
      const P = GP[st0.pair];
      if (P.disc) return 'import math\n\nfor n in [2, 4, 5, 10, 20, 50]:\n    a, b = ' + P.py[0] + ', ' + P.py[1] + '\n    print(f"n = {n:>2}: ' + P.ft + ' / ' + P.gt + ' = {a / b:.3e}")\n';
      return 'import numpy as np\n\n# сравниваем десятичные логарифмы: lg(f/g) = lg f − lg g (сами числа не поместятся в double)\nlgf = lambda x: ' + P.lpy[0] + '\nlgg = lambda x: ' + P.lpy[1] + '\nfor x in ' + P.pts + ':\n    print(f"x = {x:.4g}: lg f = {lgf(x):.4f}, lg g = {lgg(x):.4f}, lg(f/g) = {lgf(x) - lgg(x):+.4f}")\n';
    });
    sync();
    draw();
  });

  /* ==============================================================================
   * 18b. Неопределённости 0·∞, 0⁰, ∞⁰ на краях: яма, горб и возврат к пределу
   * ============================================================================== */
  const ZI = {
    xalnx: { label: 'xᵃ · ln x при x → 0⁺ (0 · ∞)', param: { key: 'a', label: 'показатель a', min: 0.1, max: 2, step: 0.05, value: 0.5 }, f: (x, p) => Math.pow(x, p.a) * Math.log(x), dom: [1e-6, 1.5], L: 0, ext: (p) => ({ x: Math.exp(-1 / p.a), y: -1 / (p.a * Math.E), t: 'минимум' }), log: true, py: (p) => 'x**' + U.pyNum(p.a) + ' * np.log(x)', note: (p) => 'Логарифм тянет в −∞, степень — к нулю. Побеждает степень (иерархия роста): предел 0 при любом a &gt; 0. Но чем меньше a, тем глубже и левее яма: минимум −1/(ae) = ' + U.fmt(-1 / (p.a * Math.E), 4) + ' при x = e^(−1/a) = ' + U.fmt(Math.exp(-1 / p.a), 3) + '.' },
    xx: { label: 'xˣ при x → 0⁺ (0⁰)', f: (x) => Math.pow(x, x), dom: [1e-6, 1.5], L: 1, ext: () => ({ x: 1 / Math.E, y: Math.pow(1 / Math.E, 1 / Math.E), t: 'минимум' }), log: true, py: () => 'x**x', note: () => 'xˣ = e^(x ln x), а x ln x → 0 (форма 0 · ∞), поэтому xˣ → e⁰ = 1. Наименьшее значение 0.6922 — при x = 1/e.' },
    nroot: { label: 'ⁿ√n при n → ∞ (∞⁰)', disc: true, f: (n) => Math.pow(n, 1 / n), dom: [1, 60], L: 1, ext: () => ({ x: 3, y: Math.pow(3, 1 / 3), t: 'максимум' }), py: () => 'n**(1/n)', note: () => 'ⁿ√n = e^(ln n / n), а ln n / n → 0: предел e⁰ = 1. Наибольший член — ³√3 ≈ 1.4422; дальше последовательность медленно спускается: 1.2589 при n = 10, 1.0471 при n = 100.' },
    xke: { label: 'xᵏ · e⁻ˣ при x → ∞ (∞ · 0)', param: { key: 'k', label: 'степень k', min: 1, max: 10, step: 1, value: 3 }, f: (x, p) => Math.pow(x, p.k) * Math.exp(-x), dom: [0, 40], L: 0, ext: (p) => ({ x: p.k, y: Math.pow(p.k / Math.E, p.k), t: 'максимум' }), py: (p) => 'x**' + p.k + ' * np.exp(-x)', note: (p) => 'Степень растёт, экспонента гаснет. Сначала побеждает степень — горб высотой (k/e)^k = ' + U.fmt(Math.pow(p.k / Math.E, p.k), 4) + ' при x = k = ' + p.k + ', но экспонента всегда берёт своё: предел 0 при любом k.' },
  };
  GBC.widget('zero-infinity', (el) => {
    const st0 = { fn: 'xalnx', p: {} };
    const w = ui.shell(el, { title: 'Неопределённости 0 · ∞, 0⁰ и ∞⁰: кто сильнее', sub: 'Во всех примерах две силы тянут в разные стороны. Отмечена «яма» или «горб» — место, где они уравновешиваются. Дальше побеждает более быстрая функция из иерархии роста.' });
    ui.select(w.controls, { label: 'Выражение', value: st0.fn, options: Object.entries(ZI).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), reset(), draw()) });
    const pbox = paramBox(w.controls);
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'значение' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'предел' }, { key: 'e', label: 'экстремум' }, { key: 'v', label: 'значения' }]);
    function reset() {
      const Z = ZI[st0.fn];
      pbox.reset(Z.param ? [Z.param] : [], st0.p, draw);
    }
    function draw() {
      const Z = ZI[st0.fn];
      const p = st0.p;
      const E = Z.ext(p);
      const layers = [{ type: 'hline', y: Z.L, color: 'tree', dash: '6 4', width: 1.4, text: 'предел ' + Z.L }];
      if (Z.disc) {
        const ns = U.range(60, 1);
        plot.opts.x = { label: 'n', domain: [0, 61] };
        layers.push({ type: 'points', x: ns, y: ns.map(Z.f), color: 'model', r: 3.5, tooltip: (i) => [['n', String(ns[i])], ['ⁿ√n', U.fmt(Z.f(ns[i]), 5)]] });
      } else {
        const xs = Z.log ? logspace(-6, Math.log10(Z.dom[1]), 600) : U.linspace(Z.dom[0], Z.dom[1], 600);
        plot.opts.x = Z.log ? { label: 'x (лог. шкала)', type: 'log', domain: [1e-6, Z.dom[1]], ticks: [1e-6, 1e-4, 1e-2, 1], format: powFmt } : { label: 'x', domain: Z.dom };
        layers.push({ type: 'line', x: xs, y: xs.map((x) => Z.f(x, p)), color: 'model', width: 2.4, hover: false });
      }
      layers.push({ type: 'points', x: [E.x], y: [E.y], color: 'violet', r: 6 });
      layers.push({ type: 'text', items: [{ x: E.x, y: E.y, dx: 8, dy: E.t === 'минимум' ? 14 : -8, text: E.t }] });
      plot.render(layers, { y: 'auto' });
      const pts = Z.disc ? [10, 100, 1000] : Z.log ? [0.1, 0.01, 1e-6] : [10, 30, 40];
      st.set('L', String(Z.L));
      st.set('e', E.t + ' ' + U.fmt(E.y, 4) + ' при ' + (Z.disc ? 'n' : 'x') + ' = ' + U.fmt(E.x, 4));
      st.set('v', pts.map((t) => U.fmt(Z.f(t, p), 4)).join(', ') + ' (при ' + pts.map((t) => U.fmt(t, 2)).join(', ') + ')');
      note.innerHTML = Z.note(p);
    }
    w.pythonAction(() => {
      const Z = ZI[st0.fn];
      const v = Z.disc ? 'n' : 'x';
      const pts = Z.disc ? '[3, 10, 100, 1000, 10**6]' : Z.log ? '[0.5, 0.1, 0.01, 1e-4, 1e-8]' : '[1, 5, 10, 30, 100]';
      return 'import numpy as np\n\nf = lambda ' + v + ': ' + Z.py(st0.p) + '\nfor ' + v + ' in ' + pts + ':\n    print(f"' + v + ' = {' + v + '}: {f(' + v + '):.6g}")\n';
    });
    reset();
    draw();
  });

  /* ==============================================================================
   * 19. Непрерывна ли функция в точке: значение, левый и правый пределы
   * ============================================================================== */
  const CT = {
    smooth: { label: 'x² в точке 1', f: (x) => x * x, dom: [-1, 2.5], a: 1, val: 1, lL: 1, lR: 1, py: 'x**2' },
    hole: { label: '(x² − 1)/(x − 1) — дырка', f: (x) => x + 1, dom: [-1, 3], a: 1, val: null, lL: 2, lR: 2, py: '(x**2 - 1) / (x - 1)' },
    moved: { label: 'x + 1, но f(1) = 3', f: (x) => x + 1, dom: [-1, 3], a: 1, val: 3, lL: 2, lR: 2, py: 'np.where(x == 1, 3.0, x + 1)' },
    abs: { label: '|x| — излом в нуле', f: Math.abs, dom: [-2, 2], a: 0, val: 0, lL: 0, lR: 0, py: 'np.abs(x)' },
    jump: { label: 'ступенька [x ≥ 0]', f: (x) => (x >= 0 ? 1 : 0), dom: [-2, 2], a: 0, val: 1, lL: 0, lR: 1, py: '(x >= 0) * 1.0' },
    sqrt: { label: '√x на краю области', f: (x) => (x >= 0 ? Math.sqrt(x) : NaN), dom: [-1, 3], a: 0, val: 0, lL: 'none', lR: 0, py: 'np.sqrt(x)' },
    inf: { label: '1/x', f: (x) => 1 / x, dom: [-2, 2], a: 0, val: null, lL: -Infinity, lR: Infinity, py: '1 / x' },
    osc: { label: 'sin(1/x), f(0) = 0', f: (x) => Math.sin(1 / x), dom: [-0.5, 0.5], a: 0, val: 0, lL: null, lR: null, py: 'np.sin(1 / x)' },
    xosc: { label: 'x sin(1/x), f(0) = 0', f: (x) => x * Math.sin(1 / x), dom: [-0.5, 0.5], a: 0, val: 0, lL: 0, lR: 0, py: 'x * np.sin(1 / x)' },
  };
  const limTxt = (v) => (v === 'none' ? 'функции нет' : v === null ? 'нет' : fmtL(v, 3));
  GBC.widget('continuity-check', (el) => {
    const st0 = { fn: 'smooth', zoom: false };
    const w = ui.shell(el, { title: 'Непрерывна ли функция в точке?', sub: 'Проверяем по порядку: значение f(a), предел слева, предел справа и совпадают ли они. Закрашенная точка — значение в точке, кружок — предел, который не принимается. «Лупа» увеличивает окрестность a.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(CT).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.toggle(w.controls, { label: 'Лупа: окно ±0.05 около a', checked: false, onChange: (c) => ((st0.zoom = c), draw()) });
    const checks = H('div', { style: 'display:grid;gap:6px;padding-top:6px;font-size:.93rem' });
    w.controls.appendChild(checks);
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    function draw() {
      const C = CT[st0.fn];
      const dom = st0.zoom ? [C.a - 0.05, C.a + 0.05] : C.dom;
      const xs = denseNear(dom[0], dom[1], C.a, 1500);
      const cv = curve(C.f, 0, 0, 0, { xs, cap: 12, jump: st0.fn.includes('osc') ? undefined : 0.5 });
      const layers = [{ type: 'line', x: cv.x, y: cv.y, color: 'model', width: st0.fn === 'osc' ? 1 : 2.4, hover: false }, { type: 'vline', x: C.a, color: 'ink2', dash: '3 3', width: 1, text: 'a = ' + C.a }];
      const hol = [];
      if (typeof C.lL === 'number' && Number.isFinite(C.lL) && C.lL !== C.val) hol.push(C.lL);
      if (typeof C.lR === 'number' && Number.isFinite(C.lR) && C.lR !== C.val && C.lR !== C.lL) hol.push(C.lR);
      if (hol.length) layers.push({ type: 'points', x: hol.map(() => C.a), y: hol, color: 'model', r: 5, hollow: true });
      if (C.val !== null) layers.push({ type: 'points', x: [C.a], y: [C.val], color: 'model', r: 5 });
      plot.render(layers, { x: dom, y: st0.fn === 'inf' ? [-8, 8] : 'auto' });
      const c1 = C.val !== null;
      const left = C.lL;
      const right = C.lR;
      const fin = (v) => typeof v === 'number' && Number.isFinite(v);
      const twoSided = fin(left) && fin(right) && left === right;
      const contR = c1 && fin(right) && right === C.val;
      const cont = c1 && (twoSided ? left === C.val : left === 'none' && contR);
      checks.textContent = '';
      const row = (ok, t) => checks.appendChild(H('div', { style: 'color:' + (ok ? 'var(--good-text)' : 'var(--critical-text)') }, (ok ? '✓ ' : '✗ ') + t));
      row(c1, '1. f(a) ' + (c1 ? '= ' + C.val : 'не определено'));
      row(fin(left) || left === 'none', '2. предел слева: ' + limTxt(left));
      row(fin(right), '3. предел справа: ' + limTxt(right));
      row(cont, '4. совпадают со значением');
      let msg;
      if (cont && left === 'none') msg = '<b>Непрерывна справа</b>: слева функции нет, справа значения подходят к f(0) = 0. На своей области [0, ∞) √x непрерывна.';
      else if (cont && st0.fn === 'abs') msg = '<b>Непрерывна</b>: пределы слева и справа равны 0 = f(0). Но у графика угол — непрерывность не означает гладкость; производной в нуле нет (урок 15.5).';
      else if (cont && st0.fn === 'xosc') msg = '<b>Непрерывна</b>: колебания зажаты между −|x| и |x| (сжатие), предел 0 = f(0). Включите лупу — картинка «подобна себе», но масштаб по высоте тоже сжимается.';
      else if (cont) msg = '<b>Непрерывна</b> в точке ' + C.a + ': предел — просто подстановка f(a).';
      else if (st0.fn === 'hole') msg = '<b>Устранимый разрыв</b>: предел 2 есть, а значения нет. Доопределите f(1) = 2 — и дырка «заклеится» (шаг 20).';
      else if (st0.fn === 'moved') msg = '<b>Устранимый разрыв</b>: предел 2, а значение 3. Достаточно исправить одно число.';
      else if (st0.fn === 'jump') msg = '<b>Скачок</b>: слева 0, справа 1. При этом f(0) = 1 совпадает с правым пределом — функция <b>непрерывна справа</b>. Так ведёт себя дерево с правилом «x &lt; t — налево» (XGBoost).';
      else if (st0.fn === 'inf') msg = '<b>Бесконечный разрыв</b> (второго рода): слева −∞, справа +∞, значения нет.';
      else msg = '<b>Колебательный разрыв</b> (второго рода): в любой окрестности нуля функция пробегает все значения от −1 до 1, предела нет. Никакое f(0) не сделает её непрерывной.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const C = CT[st0.fn];
      return 'import numpy as np\n\nf = lambda x: ' + C.py + '\na = ' + C.a + '\nwith np.errstate(divide="ignore", invalid="ignore"):\n    for d in [0.1, 0.01, 0.001]:\n        print(f"f(a − {d}) = {f(np.float64(a - d)):.6f},  f(a + {d}) = {f(np.float64(a + d)):.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 20. Доопределение по непрерывности
   * ============================================================================== */
  const RH = {
    sinc: { label: 'sin x / x в 0 (sinc)', f: (x) => Math.sin(x) / x, a: 0, L: 1, dom: [-10, 10], kind: 'rem', py: 'np.sin(x) / x' },
    frac: { label: '(x² − 1)/(x − 1) в 1', f: (x) => (x * x - 1) / (x - 1), a: 1, L: 2, dom: [-1, 3], kind: 'rem', py: '(x**2 - 1) / (x - 1)' },
    expm1: { label: '(eˣ − 1)/x в 0', f: (x) => Math.expm1(x) / x, a: 0, L: 1, dom: [-2, 2], kind: 'rem', py: 'np.expm1(x) / x' },
    cos: { label: '(1 − cos x)/x² в 0', f: (x) => (2 * Math.sin(x / 2) ** 2) / (x * x), a: 0, L: 0.5, dom: [-6, 6], kind: 'rem', py: '(1 - np.cos(x)) / x**2' },
    plogp: { label: 'p · ln p в 0 (энтропия)', f: (x) => (x > 0 ? x * Math.log(x) : NaN), a: 0, L: 0, dom: [-0.1, 1], kind: 'rem', side: 'right', py: 'x * np.log(x)' },
    jump: { label: 'ступенька: 0 слева, 1 справа', f: (x) => (x > 0 ? 1 : 0), a: 0, L: null, dom: [-2, 2], kind: 'jump', py: '(x > 0) * 1.0' },
    inv2: { label: '1/x² в 0', f: (x) => 1 / (x * x), a: 0, L: null, dom: [-2, 2], kind: 'inf', py: '1 / x**2' },
    osc: { label: 'sin(1/x) в 0', f: (x) => Math.sin(1 / x), a: 0, L: null, dom: [-0.4, 0.4], kind: 'osc', py: 'np.sin(1 / x)' },
  };
  GBC.widget('repair-hole', (el) => {
    const st0 = { fn: 'sinc', c: 0.5 };
    const w = ui.shell(el, { title: 'Доопределение: заклеить дырку', sub: 'Функция в точке a не определена (или определена «не так»). Задайте значение c = f(a) ползунком. Найдите c, при котором разрыв исчезает, — или убедитесь, что такого c нет.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(RH).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    const cSl = ui.slider(w.controls, { label: 'Значение в точке c', min: -1, max: 3, step: 0.01, value: st0.c, onInput: (v) => ((st0.c = v), draw()) });
    ui.button(w.controls, { label: 'Доопределить пределом', kind: 'primary', onClick: () => {
      const Rr = RH[st0.fn];
      if (Rr.L !== null) (st0.c = Rr.L), cSl.set(Rr.L), draw();
    } });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'предел в a' }, { key: 'c', label: 'f(a) = c' }, { key: 'g', label: 'зазор |c − предел|' }, { key: 'v', label: 'вердикт' }]);
    function draw() {
      const Rr = RH[st0.fn];
      const c = st0.c;
      const xs = denseNear(Rr.dom[0], Rr.dom[1], Rr.a, 1500);
      const cv = curve(Rr.f, 0, 0, 0, { xs, skip: Rr.a, cap: 20, jump: Rr.kind === 'osc' ? undefined : 0.5 });
      const layers = [{ type: 'line', x: cv.x, y: cv.y, color: 'model', width: Rr.kind === 'osc' ? 1 : 2.4, hover: false }, { type: 'vline', x: Rr.a, color: 'ink2', dash: '3 3', width: 1 }];
      const ok = Rr.L !== null && Math.abs(c - Rr.L) < 0.005;
      if (Rr.L !== null && !ok) layers.push({ type: 'points', x: [Rr.a], y: [Rr.L], color: 'model', r: 5, hollow: true });
      if (Rr.kind === 'jump') layers.push({ type: 'points', x: [0, 0], y: [0, 1], color: 'model', r: 5, hollow: true });
      layers.push({ type: 'points', x: [Rr.a], y: [c], color: ok ? 'good' : 'critical', r: 6 });
      plot.render(layers, { x: Rr.dom, y: Rr.kind === 'inf' ? [-1.2, 10] : [Math.min(-1.2, ...cv.y.filter(Number.isFinite)), Math.max(3.2, ...cv.y.filter(Number.isFinite)) ] });
      st.set('L', Rr.L === null ? 'нет' : U.fmt(Rr.L, 4));
      st.set('c', U.fmt(c, 3));
      st.set('g', Rr.L === null ? '—' : U.fmt(Math.abs(c - Rr.L), 3));
      st.set('v', Rr.L === null ? 'неустранимый' : ok ? 'непрерывна' : 'разрыв');
      const msgs = {
        rem: ok ? '<b>Готово:</b> c совпало с пределом ' + U.fmt(Rr.L, 4) + ' — функция непрерывна' + (Rr.side ? ' (справа: левее нуля p ln p не определена)' : '') + '. Это <b>доопределение по непрерывности</b>.' + (st0.fn === 'plogp' ? ' Поэтому в энтропии полагают 0 · ln 0 = 0.' : st0.fn === 'sinc' ? ' np.sinc уже доопределена так.' : '') : 'Разрыв <b>устранимый</b>: предел ' + U.fmt(Rr.L, 4) + ' существует, и подходит ровно одно значение c — само это число. Нажмите кнопку или подведите ползунок.',
        jump: '<b>Скачок</b>: слева 0, справа 1. Какое бы c ни выбрать, хотя бы с одной стороны останется зазор не меньше ½. Неустранимо.',
        inf: '<b>Бесконечный разрыв</b>: значения около нуля неограниченно растут, и конечное c их не догонит.',
        osc: '<b>Колебательный разрыв</b>: предела нет — нечем заклеивать. Любое c будет «чужим» для бесконечно частых колебаний.',
      };
      note.innerHTML = msgs[Rr.kind];
    }
    w.pythonAction(() => {
      const Rr = RH[st0.fn];
      return 'import numpy as np\n\nf = lambda x: ' + Rr.py + '\na = ' + Rr.a + '\nwith np.errstate(divide="ignore", invalid="ignore"):\n    for d in [0.1, 0.01, 0.001, 1e-6]:\n        print(f"f(a − {d}) = {f(np.float64(a - d)):.6f},  f(a + {d}) = {f(np.float64(a + d)):.6f}")\n' + (st0.fn === 'sinc' ? 'print("np.sinc(0) =", np.sinc(0.0))  # sin(πx)/(πx), уже доопределена\n' : '');
    });
    draw();
  });

  /* ==============================================================================
   * 21. Склейка кусков: значения и наклоны в стыке
   * ============================================================================== */
  const GL = {
    linquad: { label: 'ax + 1 при x < 1, x² + b при x ≥ 1', params: [{ key: 'a', label: 'a', min: -2, max: 4, step: 0.25, value: 1 }, { key: 'b', label: 'b', min: -2, max: 3, step: 0.25, value: 0 }], dom: [-1, 3], x0: 1,
      segs: (p) => [{ x0: -1, x1: 1, f: (x) => p.a * x + 1 }, { x0: 1, x1: 3, f: (x) => x * x + p.b }], L: (x, p) => p.a * x + 1, Rf: (x, p) => x * x + p.b, valueRight: true,
      hint: 'Непрерывна ⇔ a + 1 = 1 + b, то есть a = b. Гладкая — ещё и наклоны равны: a = 2 (наклон x² в точке 1). Попробуйте a = b = 2.' },
    huber: { label: 'потери Хьюбера: r²/2 и δ(|r| − c)', params: [{ key: 'd', label: 'порог δ', min: 0.25, max: 2, step: 0.25, value: 1 }, { key: 'c', label: 'сдвиг c', min: -0.5, max: 1.5, step: 0.05, value: 0 }], dom: [-3, 3], x0: null,
      segs: (p) => [{ x0: -3, x1: -p.d, f: (r) => p.d * (Math.abs(r) - p.c) }, { x0: -p.d, x1: p.d, f: (r) => (r * r) / 2 }, { x0: p.d, x1: 3, f: (r) => p.d * (Math.abs(r) - p.c) }], L: (r) => (r * r) / 2, Rf: (r, p) => p.d * (Math.abs(r) - p.c), valueRight: false,
      hint: 'В стыке r = δ: слева δ²/2, справа δ(δ − c). Равны ⇔ c = δ/2. Наклоны: слева r = δ, справа δ — совпадают при любом c, поэтому при c = δ/2 склейка сразу гладкая.' },
    relu: { label: 'ReLU: 0 при x < 0, kx + b при x ≥ 0', params: [{ key: 'k', label: 'наклон k', min: -1, max: 2, step: 0.25, value: 1 }, { key: 'b', label: 'сдвиг b', min: -1, max: 1, step: 0.05, value: 0 }], dom: [-2, 2], x0: 0,
      segs: (p) => [{ x0: -2, x1: 0, f: () => 0 }, { x0: 0, x1: 2, f: (x) => p.k * x + p.b }], L: () => 0, Rf: (x, p) => p.k * x + p.b, valueRight: true,
      hint: 'Непрерывна ⇔ b = 0. Гладкая — только при k = 0 (тогда это константа). ReLU max(0, x) — непрерывна, но с изломом.' },
    tree: { label: 'пень: v₁ при x ≤ 0, v₂ при x > 0', params: [{ key: 'v1', label: 'лист v₁', min: -1, max: 2, step: 0.1, value: 0.2 }, { key: 'v2', label: 'лист v₂', min: -1, max: 2, step: 0.1, value: 1.2 }], dom: [-2, 2], x0: 0,
      segs: (p) => [{ x0: -2, x1: 0, f: () => p.v1 }, { x0: 0, x1: 2, f: () => p.v2 }], L: (x, p) => p.v1, Rf: (x, p) => p.v2, valueRight: false,
      hint: 'Непрерывен ⇔ v₁ = v₂. Но тогда разбиение ничего не делает: пень предсказывает одну константу. Полезное дерево обязательно разрывно.' },
  };
  GBC.widget('glue-pieces', (el) => {
    const st0 = { fn: 'linquad', p: {} };
    const w = ui.shell(el, { title: 'Склейка кусков: подбираем параметры', sub: 'Кусочная функция непрерывна, если куски сходятся в стыке, и гладкая, если там совпадают ещё и наклоны. Двигайте параметры и следите за вердиктом.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(GL).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), (st0.p = {}), reset(), draw()) });
    const pbox = paramBox(w.controls);
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'l', label: 'левый кусок в стыке' }, { key: 'r', label: 'правый кусок в стыке' }, { key: 'j', label: 'скачок' }, { key: 's', label: 'наклоны слева : справа' }, { key: 'v', label: 'вердикт' }]);
    function reset() {
      pbox.reset(GL[st0.fn].params, st0.p, draw);
    }
    function draw() {
      const G = GL[st0.fn];
      const p = st0.p;
      const x0 = G.x0 === null ? p.d : G.x0;
      const segs = G.segs(p);
      const layers = segs.map((s) => {
        const xs = U.linspace(s.x0, s.x1, 200);
        return { type: 'line', x: xs, y: xs.map(s.f), color: 'model', width: 2.4, hover: false };
      });
      const lv = G.L(x0, p);
      const rv = G.Rf(x0, p);
      const jump = rv - lv;
      const h = 1e-6;
      const sl = (G.L(x0, p) - G.L(x0 - h, p)) / h;
      const sr = (G.Rf(x0 + h, p) - G.Rf(x0, p)) / h;
      layers.push({ type: 'vline', x: x0, color: 'ink2', dash: '3 3', width: 1, text: 'стык' });
      if (Math.abs(jump) > 1e-9) {
        layers.push({ type: 'points', x: [x0], y: [G.valueRight ? lv : rv], color: 'model', r: 5, hollow: true });
        layers.push({ type: 'points', x: [x0], y: [G.valueRight ? rv : lv], color: 'model', r: 5 });
      } else layers.push({ type: 'points', x: [x0], y: [lv], color: 'model', r: 5 });
      plot.render(layers, { x: G.dom });
      const smooth = Math.abs(jump) <= 1e-9 && Math.abs(sl - sr) < 1e-4;
      const verdict = Math.abs(jump) > 1e-9 ? 'разрыв' : smooth ? 'гладкая' : 'непрерывна, излом';
      st.set('l', U.fmt(lv, 4));
      st.set('r', U.fmt(rv, 4));
      st.set('j', U.fmt(jump, 4));
      st.set('s', U.fmt(sl, 3) + ' : ' + U.fmt(sr, 3));
      st.set('v', verdict);
      note.innerHTML = '<b>' + (verdict === 'разрыв' ? 'Разрыв-скачок величины ' + U.fmt(Math.abs(jump), 3) : verdict === 'гладкая' ? 'Гладкая склейка' : 'Непрерывна, но с изломом') + '.</b> ' + G.hint;
    }
    w.pythonAction(() => {
      const G = GL[st0.fn];
      const p = st0.p;
      const x0 = G.x0 === null ? p.d : G.x0;
      const segs = G.segs(p);
      return '# значения кусков в стыке x0 = ' + U.pyNum(x0) + '\nleft = ' + U.pyNum(Number(G.L(x0, p).toPrecision(12))) + '\nright = ' + U.pyNum(Number(G.Rf(x0, p).toPrecision(12))) + '\nprint("скачок:", right - left, "-> непрерывна" if abs(right - left) < 1e-12 else "-> разрыв")\n# число кусков: ' + segs.length + '\n';
    });
    reset();
    draw();
  });

  /* ==============================================================================
   * 22. Деление пополам
   * ============================================================================== */
  const BS = {
    cube: { label: 'x³ − 2 на [1, 2]', f: (x) => x ** 3 - 2, a: 1, b: 2, root: Math.cbrt(2), py: 'x**3 - 2' },
    cos: { label: 'cos x − x на [0, 1]', f: (x) => Math.cos(x) - x, a: 0, b: 1, root: 0.7390851332151607, py: 'np.cos(x) - x' },
    poly: { label: 'x³ − x − 1 на [1, 2]', f: (x) => x ** 3 - x - 1, a: 1, b: 2, root: 1.324717957244746, py: 'x**3 - x - 1' },
    jump: { label: 'ступенька −1 / 1 на [0, 1] — разрыв', f: (x) => (x < 0.3 ? -1 : 1), a: 0, b: 1, root: null, py: 'np.where(x < 0.3, -1.0, 1.0)' },
    pole: { label: '1/(x − 0.6) на [0, 1] — полюс', f: (x) => 1 / (x - 0.6), a: 0, b: 1, root: null, py: '1 / (x - 0.6)' },
  };
  GBC.widget('bisection', (el) => {
    const st0 = { fn: 'cube', k: 3 };
    const KMAX = 30;
    const w = ui.shell(el, { title: 'Деление пополам: корень зажимается вдвое за шаг', sub: 'Оранжевая полоса — отрезок, где гарантированно есть смена знака. Каждый шаг берёт середину и оставляет ту половину, на концах которой знаки разные. Последние два примера — без непрерывности.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(BS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.player(w.controls, { label: 'Шаг', min: 0, max: KMAX, value: st0.k, fps: 2, format: (k) => 'шаг ' + k, onChange: (k) => ((st0.k = k), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'x' }, y: { label: 'f(x)' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'шаг' }, { key: 'i', label: 'отрезок' }, { key: 'w', label: 'длина' }, { key: 'm', label: 'середина' }, { key: 'f', label: 'f(середины)' }]);
    function run(B) {
      const it = [];
      let lo = B.a;
      let hi = B.b;
      for (let k = 1; k <= KMAX; k++) {
        const mid = (lo + hi) / 2;
        const fm = B.f(mid);
        it.push({ k, lo, hi, mid, fm });
        if (B.f(lo) * fm > 0) lo = mid;
        else hi = mid;
      }
      it.push({ k: KMAX + 1, lo, hi, mid: (lo + hi) / 2, fm: B.f((lo + hi) / 2) });
      return it;
    }
    function draw() {
      const B = BS[st0.fn];
      const it = run(B);
      const cur = st0.k === 0 ? { lo: B.a, hi: B.b } : { lo: it[st0.k].lo, hi: it[st0.k].hi };
      const xs = denseNear(B.a - 0.1, B.b + 0.1, st0.fn === 'pole' ? 0.6 : 0.3, 800);
      const cv = curve(B.f, 0, 0, 0, { xs, cap: 12, jump: 1 });
      const lastMid = st0.k ? it[st0.k - 1].mid : null;
      plot.render([
        { type: 'vband', x0: cur.lo, x1: cur.hi, color: 'tree', opacity: 0.18 },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.4, hover: false },
        { type: 'points', x: [cur.lo, cur.hi], y: [B.f(cur.lo), B.f(cur.hi)], color: (i) => (B.f([cur.lo, cur.hi][i]) < 0 ? 'neg' : 'pos'), r: 5 },
        lastMid !== null ? { type: 'points', x: [lastMid], y: [B.f(lastMid)], color: 'violet', r: 6 } : null,
      ], { x: [B.a - 0.1, B.b + 0.1], y: st0.fn === 'pole' ? [-8, 8] : 'auto' });
      const shown = it.slice(Math.max(0, st0.k - 6), st0.k);
      rowTable(tbl, ['шаг', 'отрезок', 'середина', 'f(середины)'], shown.map((r) => [String(r.k), '[' + U.fmt(r.lo, 9) + ', ' + U.fmt(r.hi, 9) + ']', U.fmt(r.mid, 10), U.fmt(r.fm, 4)]), (i) => i === shown.length - 1);
      const width = (B.b - B.a) / Math.pow(2, st0.k);
      st.set('k', String(st0.k));
      st.set('i', '[' + U.fmt(cur.lo, 7) + ', ' + U.fmt(cur.hi, 7) + ']');
      st.set('w', U.fmt(width, 3));
      st.set('m', lastMid === null ? '—' : U.fmt(lastMid, 9));
      st.set('f', lastMid === null ? '—' : U.fmt(B.f(lastMid), 3));
      if (B.root !== null) note.innerHTML = 'Длина отрезка после ' + st0.k + ' шагов: (b − a)/2^' + st0.k + ' = ' + U.fmt(width, 3) + '. Истинный корень ' + U.fmt(B.root, 10) + ' всегда внутри полосы — это гарантирует теорема о промежуточном значении, ведь функция непрерывна.';
      else note.innerHTML = 'Знаки на концах разные, но функция <b>разрывна</b> — теорема не работает. Алгоритм честно сжимает отрезок к точке ' + (st0.fn === 'pole' ? 'полюса 0.6, где f уходит в ±∞' : 'скачка 0.3, где f = 1') + ', но корня там нет. Всегда проверяйте значение f в найденной точке!';
    }
    w.pythonAction(() => {
      const B = BS[st0.fn];
      return 'import numpy as np\n\nf = lambda x: ' + B.py + '\nlo, hi = ' + B.a + ', ' + B.b + '\nfor k in range(1, ' + (st0.k || 30) + ' + 1):\n    mid = (lo + hi) / 2\n    if f(lo) * f(mid) > 0:\n        lo = mid\n    else:\n        hi = mid\nprint(f"после {k} шагов: [{lo:.10f}, {hi:.10f}], f(середины) = {f((lo + hi) / 2):.3g}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 23. Теорема Вейерштрасса: достигаются ли максимум и минимум
   * ============================================================================== */
  const LAMS = [0, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3];
  function regMin(lam) {
    let lo = 0;
    let hi = 200;
    for (let i = 0; i < 200; i++) {
      const m = (lo + hi) / 2;
      if (-1 / (1 + Math.exp(m)) + lam * m < 0) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }
  const softplusNeg = (w) => Math.max(-w, 0) + Math.log1p(Math.exp(-Math.abs(w)));
  const EV = {
    ok: { label: 'x³ − 3x на отрезке [−1.5, 2.2]', note: 'Непрерывна на отрезке — всё достигается: максимум 4.048 на правом конце, минимум −2 при x = 1. Кандидаты — концы отрезка и точки, где наклон равен нулю (урок 15.5).' },
    open: { label: 'x на интервале (0, 1)', note: 'Концы не входят: значения сколь угодно близки к 0 и 1, но не равны им. Наибольшего и наименьшего значения <b>нет</b> — есть только точные границы (sup = 1, inf = 0).' },
    jump: { label: 'x на [0, 1) и f(1) = 0 — разрыв', note: 'Отрезок есть, но функция разрывна в 1. Значения подходят к 1, не достигая; максимума нет. Минимум 0 при этом достигается (в точках 0 и 1).' },
    exp: { label: 'e⁻ˣ на [0, ∞)', note: 'Промежуток неограничен: e⁻ˣ убывает к 0, но не достигает его. Максимум 1 (при x = 0) есть, минимума нет.' },
    reg: { label: 'log-loss ln(1 + e⁻ʷ) + λw²/2', note: '' },
  };
  GBC.widget('extreme-value', (el) => {
    const st0 = { fn: 'ok', lam: 0.01 };
    const w = ui.shell(el, { title: 'Достигает ли функция максимума и минимума?', sub: 'Закрашенная точка — значение достигается; кружок — граница, к которой значения подходят, но не равны ей. Для log-loss двигайте силу штрафа λ.' });
    ui.select(w.controls, { label: 'Случай', value: st0.fn, options: Object.entries(EV).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), (lamSl.el.style.display = v === 'reg' ? '' : 'none'), draw()) });
    const lamSl = ui.slider(w.controls, { label: 'Штраф λ', values: LAMS, value: st0.lam, format: (v) => (v === 0 ? '0 (без штрафа)' : String(v)), onInput: (v) => ((st0.lam = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'M', label: 'наибольшее / sup' }, { key: 'm', label: 'наименьшее / inf' }, { key: 'a', label: 'достигаются?' }]);
    function draw() {
      const f = st0.fn;
      const L = [];
      if (f === 'ok') {
        const g = (x) => x ** 3 - 3 * x;
        const xs = U.linspace(-1.5, 2.2, 400);
        L.push({ type: 'line', x: xs, y: xs.map(g), color: 'model', width: 2.4, hover: false });
        L.push({ type: 'points', x: [2.2, 1], y: [g(2.2), g(1)], color: (i) => (i ? 'aqua' : 'tree'), r: 6 });
        L.push({ type: 'points', x: [-1.5], y: [g(-1.5)], color: 'model', r: 4 });
        plot.opts.x.label = 'x';
        plot.render(L, { x: [-1.8, 2.5], y: [-2.5, 4.5] });
        st.set('M', '4.048 (x = 2.2)');
        st.set('m', '−2 (x = 1)');
        st.set('a', 'оба');
        note.innerHTML = EV.ok.note;
        return;
      }
      if (f === 'open' || f === 'jump') {
        const xs = U.linspace(f === 'open' ? 0.0001 : 0, 0.9999, 200);
        L.push({ type: 'line', x: xs, y: xs, color: 'model', width: 2.4, hover: false });
        L.push({ type: 'hline', y: 1, color: 'tree', dash: '6 4', width: 1.2, text: 'sup = 1' });
        L.push({ type: 'points', x: [1], y: [1], color: 'tree', r: 6, hollow: true });
        if (f === 'open') L.push({ type: 'points', x: [0], y: [0], color: 'aqua', r: 6, hollow: true });
        else L.push({ type: 'points', x: [0, 1], y: [0, 0], color: 'aqua', r: 6 });
        plot.opts.x.label = 'x';
        plot.render(L, { x: [-0.2, 1.2], y: [-0.2, 1.2] });
        st.set('M', 'нет (sup = 1)');
        st.set('m', f === 'open' ? 'нет (inf = 0)' : '0 (x = 0 и 1)');
        st.set('a', f === 'open' ? 'ни один' : 'только минимум');
        note.innerHTML = EV[f].note;
        return;
      }
      if (f === 'exp') {
        const xs = U.linspace(0, 8, 300);
        L.push({ type: 'line', x: xs, y: xs.map((x) => Math.exp(-x)), color: 'model', width: 2.4, hover: false });
        L.push({ type: 'hline', y: 0, color: 'aqua', dash: '6 4', width: 1.2, text: 'inf = 0' });
        L.push({ type: 'points', x: [0], y: [1], color: 'tree', r: 6 });
        L.push({ type: 'arrows', x1: [6.6], y1: [0.12], x2: [7.9], y2: [0.03], color: 'ink2' });
        plot.opts.x.label = 'x';
        plot.render(L, { x: [-0.3, 8], y: [-0.1, 1.15] });
        st.set('M', '1 (x = 0)');
        st.set('m', 'нет (inf = 0)');
        st.set('a', 'только максимум');
        note.innerHTML = EV.exp.note;
        return;
      }
      const lam = st0.lam;
      const xs = U.linspace(-2, 12, 400);
      const loss = (wv) => softplusNeg(wv) + (lam * wv * wv) / 2;
      L.push({ type: 'line', x: xs, y: xs.map(loss), color: 'model', width: 2.4, label: 'потери + штраф', hover: false });
      if (lam > 0) L.push({ type: 'line', x: xs, y: xs.map(softplusNeg), color: 'ink2', width: 1.4, dash: '5 4', label: 'без штрафа', hover: false });
      plot.opts.x.label = 'вес w (прогноз F для объекта класса 1)';
      let msg;
      if (lam === 0) {
        L.push({ type: 'hline', y: 0, color: 'aqua', dash: '6 4', width: 1.2, text: 'inf = 0' });
        st.set('M', '—');
        st.set('m', 'нет (inf = 0)');
        st.set('a', 'нет');
        msg = 'Без штрафа потери ln(1 + e⁻ʷ) убывают к 0, но не достигают его — промежуток (−∞, ∞) не отрезок. Минимума нет: градиентный спуск будет увеличивать w бесконечно (модель становится всё увереннее).';
      } else {
        const wm = regMin(lam);
        L.push({ type: 'points', x: [wm], y: [loss(wm)], color: 'aqua', r: 6 });
        st.set('M', '—');
        st.set('m', U.fmt(loss(wm), 4) + ' (w* = ' + U.fmt(wm, 4) + ')');
        st.set('a', 'минимум — да');
        msg = 'Штраф λw²/2 растёт на краях, и сумма непрерывна: минимум существует, w* = ' + U.fmt(wm, 4) + '. Уменьшайте λ — оптимум убегает вправо (λ = 0.1 → 1.63, 0.01 → 3.36, 0.001 → 5.25), а при λ = 0 исчезает совсем.';
      }
      plot.render(L, { x: [-2, 12], y: [-0.1, 2.3] });
      note.innerHTML = msg;
    }
    w.pythonAction(() => 'import numpy as np\n\n# минимум ln(1 + e^(−w)) + λw²/2: нуль производной −1/(1 + e^w) + λw ищем делением пополам\nfor lam in [0.1, 0.01, 0.001]:\n    lo, hi = 0.0, 200.0\n    for _ in range(200):\n        m = (lo + hi) / 2\n        lo, hi = (m, hi) if -1 / (1 + np.exp(m)) + lam * m < 0 else (lo, m)\n    w = (lo + hi) / 2\n    print(f"λ = {lam}: w* = {w:.4f}, потери = {np.log1p(np.exp(-w)) + lam * w * w / 2:.4f}")\n');
    lamSl.el.style.display = 'none';
    draw();
  });

  /* ==============================================================================
   * 24. Деревья — разрывные функции: сумма ступенек
   * ============================================================================== */
  GBC.widget('stumps-sum', (el) => {
    const n = 200;
    const xs = U.linspace(0, 10, n);
    const truth = (x) => Math.sin(x) + 0.3 * x;
    const ys = xs.map(truth);
    const st0 = { M: 1, lr: 0.5, zoom: false };
    let cache = null;
    function fit() {
      // градиентный бустинг пнями на квадратичных потерях (без шума): F ← F + ν·h
      const F = new Array(n).fill(U.mean(ys));
      const models = [F.slice()];
      const thresholds = [];
      for (let m = 0; m < 120; m++) {
        const r = ys.map((y, i) => y - F[i]);
        let best = null;
        let sl = 0;
        const tot = U.sum(r);
        for (let i = 0; i < n - 1; i++) {
          sl += r[i];
          const nl = i + 1;
          const nr = n - nl;
          const gain = (sl * sl) / nl + ((tot - sl) * (tot - sl)) / nr;
          if (!best || gain > best.gain) best = { gain, i, vl: sl / nl, vr: (tot - sl) / nr };
        }
        const thr = (xs[best.i] + xs[best.i + 1]) / 2;
        thresholds.push(thr);
        for (let i = 0; i < n; i++) F[i] += st0.lr * (xs[i] <= thr ? best.vl : best.vr);
        models.push(F.slice());
      }
      return { models, thresholds };
    }
    const w = ui.shell(el, { title: 'Модель бустинга — сумма ступенек', sub: 'Каждое дерево-пень добавляет одну ступеньку. Нажмите ▶: ступенек всё больше, модель всё ближе к гладкой кривой — но остаётся разрывной. «Лупа» показывает участок в 20 раз крупнее.' });
    ui.player(w.controls, { label: 'Число деревьев M', min: 1, max: 120, value: 1, fps: 8, format: (v) => 'M = ' + v, onChange: (v) => ((st0.M = v), draw()) });
    ui.slider(w.controls, { label: 'Темп обучения ν', min: 0.1, max: 1, step: 0.1, value: st0.lr, onInput: (v) => ((st0.lr = v), (cache = null), draw()) });
    ui.toggle(w.controls, { label: 'Лупа: участок x ∈ [4.5, 5]', checked: false, onChange: (c) => ((st0.zoom = c), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'значение' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'деревьев' }, { key: 'j', label: 'разных порогов (скачков)' }, { key: 'e', label: 'макс. ошибка' }]);
    function draw() {
      if (!cache) cache = fit();
      const F = cache.models[st0.M];
      const jumps = new Set(cache.thresholds.slice(0, st0.M).map((t) => t.toFixed(4))).size;
      const err = Math.max(...F.map((v, i) => Math.abs(v - ys[i])));
      const dom = st0.zoom ? [4.5, 5] : [0, 10];
      const fine = U.linspace(dom[0], dom[1], 400);
      plot.render([
        { type: 'line', x: fine, y: fine.map(truth), color: 'truth', width: 2, dash: '6 4', label: 'гладкая цель', hover: false },
        { type: 'line', x: xs, y: F, color: 'model', width: 2.4, curve: 'step', label: 'модель F_M(x)', hover: false },
      ], { x: dom, y: st0.zoom ? 'auto' : undefined });
      st.set('m', String(st0.M));
      st.set('j', String(jumps));
      st.set('e', U.fmt(err, 3));
      note.innerHTML = 'Каждое дерево — разрывная функция, и сумма разрывных тоже разрывна: у модели ' + jumps + ' скачков. Между скачками график горизонтален, поэтому <b>производная модели по x почти везде равна 0</b>, а в скачках её нет. Вот почему градиентный бустинг берёт производную не по признаку x, а <b>по прогнозу F</b> — у функции потерь она есть всегда (урок 5.1).';
    }
    w.pythonAction(() => 'import numpy as np\nfrom sklearn.ensemble import GradientBoostingRegressor\n\nx = np.linspace(0, 10, 200)\ny = np.sin(x) + 0.3 * x\nm = GradientBoostingRegressor(n_estimators=' + st0.M + ', learning_rate=' + st0.lr + ', max_depth=1).fit(x[:, None], y)\ngrid = np.linspace(0, 10, 100001)\npred = m.predict(grid[:, None])\njumps = np.count_nonzero(np.diff(pred))\nprint("скачков на сетке:", jumps, " доля участков с нулевым наклоном:", 1 - jumps / (len(grid) - 1))\n');
    draw();
  });

  /* ==============================================================================
   * 25. Accuracy ступенчата, log-loss гладкий
   * ============================================================================== */
  const SX = [0.5, 1.1, 1.8, 2.3, 3.4, 4.1, 2.9, 3.7, 4.6, 5.2, 5.9, 6.5];
  const SY = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
  const SS = 1.5;
  const acc = (b) => U.mean(SX.map((x, i) => ((x > b) === (SY[i] === 1) ? 1 : 0)));
  const llossB = (b) => U.mean(SX.map((x, i) => {
    const F = SS * (x - b);
    return Math.max(F, 0) + Math.log1p(Math.exp(-Math.abs(F))) - SY[i] * F;
  }));
  GBC.widget('surrogate-loss', (el) => {
    const st0 = { b: 2 };
    const w = ui.shell(el, { title: 'Accuracy против log-loss: что можно оптимизировать градиентом', sub: '12 объектов: синие — класс 0, оранжевые — класс 1. Модель p(x) = σ(1.5·(x − b)), прогноз «класс 1», если x > b. Двигайте порог b и смотрите на две функции качества ниже.' });
    ui.slider(w.controls, { label: 'Порог b', min: 0, max: 7, step: 0.01, value: st0.b, onInput: (v) => ((st0.b = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 190, x: { label: 'признак x', domain: [0, 7] }, y: { label: 'p(класс 1)', domain: [-0.1, 1.1] } });
    const p2 = new GBC.Plot(w.main, { height: 170, x: { label: 'порог b', domain: [0, 7] }, y: { label: 'accuracy', domain: [0.4, 0.9] } });
    const p3 = new GBC.Plot(w.main, { height: 170, x: { label: 'порог b', domain: [0, 7] }, y: { label: 'log-loss' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'accuracy' }, { key: 'l', label: 'log-loss' }, { key: 'da', label: 'наклон accuracy' }, { key: 'dl', label: 'наклон log-loss' }]);
    const BG = U.linspace(0, 7, 1401);
    const AG = BG.map(acc);
    const LG = BG.map(llossB);
    function draw() {
      const b = st0.b;
      const xs = U.linspace(0, 7, 300);
      p1.render([
        { type: 'line', x: xs, y: xs.map((x) => sigma(SS * (x - b))), color: 'violet', width: 2.2, hover: false },
        { type: 'vline', x: b, color: 'ink2', dash: '4 4', width: 1.2, text: 'b' },
        { type: 'points', x: SX, y: SY, color: (i) => (SY[i] ? 'class1' : 'class0'), r: 5.5, tooltip: (i) => [['x', String(SX[i])], ['класс', String(SY[i])], ['p', U.fmt(sigma(SS * (SX[i] - b)), 3)]] },
      ]);
      p2.render([
        { type: 'line', x: BG, y: AG, color: 'model', width: 2.2, curve: 'step', hover: false },
        { type: 'points', x: [b], y: [acc(b)], color: 'model', r: 6 },
      ]);
      p3.render([
        { type: 'line', x: BG, y: LG, color: 'tree', width: 2.2, hover: false },
        { type: 'points', x: [b], y: [llossB(b)], color: 'tree', r: 6 },
        { type: 'vline', x: 3.509, color: 'ink2', dash: '3 3', width: 1, text: 'минимум' },
      ]);
      const h = 1e-4;
      const onPoint = SX.some((x) => Math.abs(x - b) < 1e-9);
      st.set('a', U.fmt(acc(b), 3));
      st.set('l', U.fmt(llossB(b), 4));
      st.set('da', onPoint ? 'нет (скачок)' : '0');
      st.set('dl', U.fmt((llossB(b + h) - llossB(b - h)) / (2 * h), 4));
      note.innerHTML = 'Accuracy меняется только тогда, когда порог пересекает объект, — скачком на 1/12. Между скачками её наклон 0: градиент молчит, куда двигать b. Максимум 0.833 достигается на трёх отдельных участках. Log-loss — гладкая функция b: её наклон (' + U.fmt((llossB(b + h) - llossB(b - h)) / (2 * h), 3) + ') всегда подсказывает направление, а минимум 0.351 при b ≈ 3.51 лежит там, где accuracy тоже максимальна. Поэтому учат по гладкой <b>суррогатной</b> функции потерь, а метрикой проверяют.';
    }
    w.pythonAction(() => 'import numpy as np\n\nX = np.array([0.5, 1.1, 1.8, 2.3, 3.4, 4.1, 2.9, 3.7, 4.6, 5.2, 5.9, 6.5])\ny = np.array([0] * 6 + [1] * 6)\naccuracy = lambda b: np.mean((X > b) == (y == 1))\nlogloss = lambda b: np.mean(np.logaddexp(0, 1.5 * (X - b)) - y * 1.5 * (X - b))\nb = ' + U.pyNum(st0.b) + '\nh = 1e-4\nprint("accuracy:", accuracy(b), " наклон:", (accuracy(b + h) - accuracy(b - h)) / (2 * h))\nprint("log-loss:", round(logloss(b), 4), " наклон:", round((logloss(b + h) - logloss(b - h)) / (2 * h), 4))\n');
    draw();
  });

  /* ==============================================================================
   * 26. Число e в бэггинге и бустинге
   * ============================================================================== */
  const BOOT_N = [2, 3, 5, 10, 20, 50, 100, 1000, 10000];
  GBC.widget('e-in-ml', (el) => {
    const st0 = { mode: 'boot', n: 100, seed: 1, T: 2 };
    const w = ui.shell(el, { title: 'Число e в ансамблях деревьев', sub: '«Бэггинг»: тянем n объектов с возвращением из n и считаем, сколько раз попал каждый. «Бустинг»: остаток (1 − ν)^M при фиксированном произведении T = νM.' });
    ui.segmented(w.controls, { label: 'Опыт', value: 'boot', options: [{ value: 'boot', label: 'Бэггинг' }, { value: 'shrink', label: 'Бустинг' }], onChange: (v) => ((st0.mode = v), sync(), draw()) });
    const bc = H('div');
    const sc = H('div');
    w.controls.append(bc, sc);
    ui.slider(bc, { label: 'Объектов n', values: BOOT_N, value: st0.n, format: (v) => String(v), onInput: (v) => ((st0.n = v), draw()) });
    ui.button(bc, { label: 'Новая выборка', icon: 'step', onClick: () => (st0.seed++, draw()) });
    ui.slider(sc, { label: 'Общий путь T = νM', min: 0.5, max: 4, step: 0.5, value: st0.T, onInput: (v) => ((st0.T = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'x' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '' }, { key: 'b', label: '' }, { key: 'c', label: '' }]);
    const statKeys = st.el.querySelectorAll('.stat .k');
    const setLabels = (ls) => ls.forEach((t, i) => (statKeys[i].textContent = t));
    function sync() {
      bc.style.display = st0.mode === 'boot' ? '' : 'none';
      sc.style.display = st0.mode === 'shrink' ? '' : 'none';
      p2.root.style.display = st0.mode === 'boot' ? '' : 'none';
    }
    function draw() {
      if (st0.mode === 'boot') {
        const n = st0.n;
        const rng = new GBC.RNG(st0.seed);
        const cnt = new Array(n).fill(0);
        for (let i = 0; i < n; i++) cnt[rng.randint(n)]++;
        const hist = new Array(7).fill(0);
        cnt.forEach((c) => hist[Math.min(c, 6)]++);
        const ks = U.range(7);
        let fact = 1;
        const pois = ks.map((k) => {
          if (k > 0) fact *= k;
          return (n * Math.exp(-1)) / fact;
        });
        p1.opts.x = { label: 'сколько раз объект попал в выборку (6 — «6 и больше»)', domain: [-0.6, 6.6] };
        p1.opts.y = { label: 'объектов' };
        p1.render([
          { type: 'bars', x: ks, y: hist, color: (k) => (k === 0 ? 'tree' : 'model'), width: 0.7, maxPx: 46, label: 'эта выборка (оранжевый — ни разу)' },
          { type: 'points', x: ks, y: pois, color: 'ink', r: 4, label: 'предел: n·e⁻¹/k!' },
        ]);
        const ns = logspace(0.3, 4, 200);
        const share = cnt.filter((c) => c === 0).length / n;
        p2.opts.x = { label: 'n (лог. шкала)', type: 'log', domain: [2, 10000], ticks: [2, 10, 100, 1000, 10000] };
        p2.opts.y = { label: 'доля не попавших', domain: [0.2, 0.42] };
        p2.render([
          { type: 'line', x: ns, y: ns.map((m) => Math.pow(1 - 1 / m, m)), color: 'model', width: 2.2, label: '(1 − 1/n)ⁿ', hover: false },
          { type: 'hline', y: Math.exp(-1), color: 'tree', dash: '6 4', text: '1/e ≈ 0.368' },
          { type: 'points', x: [n], y: [share], color: 'violet', r: 6, label: 'эта выборка' },
        ]);
        setLabels(['не попали (опыт)', 'формула (1 − 1/n)ⁿ', 'предел 1/e']);
        st.set('a', U.fmt(share, 4));
        st.set('b', U.fmt(Math.pow(1 - 1 / n, n), 4));
        st.set('c', '0.3679');
        note.innerHTML = 'Из ' + n + ' объектов ни разу не вытянуты ' + cnt.filter((c) => c === 0).length + ' (оранжевый столбец, доля ' + U.fmt(share, 3) + '). Вероятность «ни разу» — (1 − 1/n)ⁿ → <b>1/e ≈ 0.368</b>: каждое дерево случайного леса не видит около 37 % объектов, и на них бесплатно проверяется (out-of-bag). Точки — предельное распределение n·e⁻¹/k! (Пуассона): уже при n = 20 столбцы почти с ним совпадают.';
        return;
      }
      const T = st0.T;
      const NUS = [0.5, 0.25, 0.1, 0.01];
      const COLS = ['red', 'tree', 'aqua', 'model'];
      const ts = U.linspace(0, T, 200);
      p1.opts.x = { label: 'общий путь t = ν·m', domain: [0, T] };
      p1.opts.y = { label: 'остаток (доля от начального)', domain: [0, 1.02] };
      const L = NUS.map((nu, j) => {
        const M = Math.round(T / nu);
        const ms = U.range(M + 1);
        return { type: 'line', x: ms.map((m) => nu * m), y: ms.map((m) => Math.pow(1 - nu, m)), color: COLS[j], width: 2, curve: 'step', label: 'ν = ' + nu + ' (M = ' + M + ')', hover: false };
      });
      L.push({ type: 'line', x: ts, y: ts.map((t) => Math.exp(-t)), color: 'ink', width: 2, dash: '6 4', label: 'предел e^{−t}', hover: false });
      p1.render(L);
      setLabels(['ν = 0.1: (1 − ν)^(T/ν)', 'ν = 0.01: (1 − ν)^(T/ν)', 'предел e^(−T)']);
      st.set('a', U.fmt(Math.pow(0.9, Math.round(T / 0.1)), 4));
      st.set('b', U.fmt(Math.pow(0.99, Math.round(T / 0.01)), 4));
      st.set('c', U.fmt(Math.exp(-T), 4));
      note.innerHTML = 'Чем меньше шаг ν, тем больше деревьев M = T/ν нужно на тот же путь T, и тем ближе ступенчатая кривая к e^(−t). При T = ' + T + ': ν = 0.5 даёт ' + U.fmt(Math.pow(0.5, Math.round(T / 0.5)), 4) + ', ν = 0.01 — ' + U.fmt(Math.pow(0.99, Math.round(T / 0.01)), 4) + ', предел e^(−T) = ' + U.fmt(Math.exp(-T), 4) + '. Важно произведение νM: <b>уменьшили темп вдвое — удвойте число деревьев</b> (урок 4.2).';
    }
    w.pythonAction(() => (st0.mode === 'boot'
      ? 'import numpy as np\n\n# генератор курса (тот же, что в браузере) — если библиотека доступна\ntry:\n    from gbcourse.rng import Mulberry32\n    rng = Mulberry32(' + st0.seed + ')\n    draw = lambda n: [rng.randint(n) for _ in range(n)]\nexcept ImportError:\n    g = np.random.default_rng(' + st0.seed + ')\n    draw = lambda n: g.integers(0, n, n)\n\nn = ' + st0.n + '\ncounts = np.bincount(draw(n), minlength=n)\nprint("не попали:", np.mean(counts == 0), " формула:", (1 - 1/n)**n, " 1/e:", 1/np.e)\n'
      : 'import numpy as np\n\nT = ' + U.pyNum(st0.T) + '\nfor nu in [0.5, 0.25, 0.1, 0.01, 0.001]:\n    M = round(T / nu)\n    print(f"ν = {nu:<6} M = {M:>5}: (1 − ν)^M = {(1 - nu)**M:.5f}")\nprint("e^(−T) =", np.exp(-T))\n'));
    sync();
    draw();
  });

  /* ==============================================================================
   * 27. Устойчивые формулы: log(1 + e^(−F)) и log-sum-exp
   * ============================================================================== */
  const stableSP = (F) => Math.max(-F, 0) + Math.log1p(Math.exp(-Math.abs(F)));
  const naiveSP = (F) => Math.log(1 + Math.exp(-F));
  GBC.widget('stable-logloss', (el) => {
    const st0 = { mode: 'sp', F: -800, a: 1000 };
    const w = ui.shell(el, { title: 'Наивная формула против устойчивой', sub: 'Режим «log-loss» — потери ln(1 + e^(−F)) объекта класса 1. Режим «log-sum-exp» — ln(e^a + e^(a+1) + e^(a+2)), основа softmax. Двигайте ползунок к краям.' });
    ui.segmented(w.controls, { label: 'Формула', value: 'sp', options: [{ value: 'sp', label: 'log-loss' }, { value: 'lse', label: 'log-sum-exp' }], onChange: (v) => ((st0.mode = v), sync(), draw()) });
    const c1 = H('div');
    const c2 = H('div');
    w.controls.append(c1, c2);
    ui.slider(c1, { label: 'Логит F', values: [-1000, -800, -710, -700, -100, -30, -5, 0, 5, 30, 36, 37, 40, 100, 800], value: st0.F, format: (v) => String(v), onInput: (v) => ((st0.F = v), draw()) });
    ui.slider(c2, { label: 'Сдвиг a', min: -1000, max: 1000, step: 10, value: st0.a, format: (v) => String(v), onInput: (v) => ((st0.a = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'F' }, y: { label: 'значение' } });
    const p2 = new GBC.Plot(w.main, { height: 200, margin: { left: 58 }, x: { label: 'F' }, y: { label: 'ошибка наивной', type: 'log', domain: [1e-17, 10], ticks: [1e-16, 1e-12, 1e-8, 1e-4, 1], format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'наивно' }, { key: 's', label: 'устойчиво' }, { key: 'x', label: 'асимптотика' }]);
    function sync() {
      c1.style.display = st0.mode === 'sp' ? '' : 'none';
      c2.style.display = st0.mode === 'lse' ? '' : 'none';
      p2.root.style.display = st0.mode === 'sp' ? '' : 'none';
    }
    const show = (v) => (Number.isFinite(v) ? U.fmt(v, 6) : v > 0 ? 'inf (переполнение)' : v < 0 ? '−inf' : 'nan');
    function draw() {
      if (st0.mode === 'sp') {
        const F = st0.F;
        const xs = U.linspace(-40, 40, 401);
        p1.opts.x = { label: 'логит F', domain: [-40, 40] };
        p1.opts.y = { label: 'ln(1 + e^{−F})', domain: [-2, 42] };
        p1.render([
          { type: 'line', x: xs, y: xs.map(stableSP), color: 'model', width: 2.4, label: 'устойчивая формула', hover: false },
          { type: 'line', x: xs, y: xs.map((t) => (t < 0 ? -t : NaN)), color: 'ink', width: 1.6, dash: '5 5', label: 'асимптота −F', hover: false },
          Math.abs(F) <= 40 ? { type: 'points', x: [F], y: [stableSP(F)], color: 'violet', r: 6 } : null,
        ]);
        const gs = U.linspace(0, 45, 451);
        p2.opts.x = { label: 'логит F', domain: [0, 45] };
        p2.render([
          { type: 'line', x: gs, y: gs.map((t) => { const e = Math.abs(naiveSP(t) - stableSP(t)) / stableSP(t); return e > 0 ? Math.min(e, 5) : 1e-17; }), color: 'critical', width: 2, hover: false },
          { type: 'vline', x: 37, color: 'ink2', dash: '3 3', width: 1, text: 'F = 37' },
        ]);
        const asym = F > 0 ? Math.exp(-F) : -F;
        st.set('n', show(naiveSP(F)));
        st.set('s', show(stableSP(F)));
        st.set('x', (F > 0 ? 'e^(−F) = ' : '−F = ') + U.fmt(asym, 6));
        note.innerHTML = F < -709
          ? 'При F = ' + F + ' наивная формула считает e^' + -F + ' — больше максимального double (e^709.78) — и получает <b>inf</b>. Устойчивая формула max(−F, 0) + log1p(e^(−|F|)) никогда не вычисляет больших экспонент: ответ ' + U.fmt(stableSP(F), 6) + ' ≈ −F.'
          : F >= 37
            ? 'При F = ' + F + ' число 1 + e^(−F) в double уже равно 1, и наивная формула даёт <b>ровно 0</b>. Устойчивая (через log1p) сохраняет верный ответ ' + U.fmt(stableSP(F), 4) + ' ≈ e^(−F) — нижний график показывает, как наивная ошибка растёт до 100 %.'
            : 'Здесь обе формулы работают (наивная — с потерей точности при больших положительных F, см. нижний график). Края — F &lt; −709 и F ≥ 37 — проверьте ползунком.';
        return;
      }
      const a = st0.a;
      const lseN = (t) => Math.log(Math.exp(t) + Math.exp(t + 1) + Math.exp(t + 2));
      const lseS = (t) => t + 2 + Math.log(Math.exp(-2) + Math.exp(-1) + 1);
      const xs = U.linspace(-1000, 1000, 801);
      p1.opts.x = { label: 'сдвиг a', domain: [-1000, 1000] };
      p1.opts.y = { label: 'ln(eᵃ + eᵃ⁺¹ + eᵃ⁺²)', domain: [-1100, 1100] };
      p1.render([
        { type: 'line', x: xs, y: xs.map(lseS), color: 'model', width: 2.4, label: 'устойчиво: m + ln Σ e^{z−m}', hover: false },
        { type: 'line', x: xs, y: xs.map((t) => { const v = lseN(t); return Number.isFinite(v) ? v : NaN; }), color: 'tree', width: 4, opacity: 0.55, label: 'наивно (там, где не переполнилось)', hover: false },
        { type: 'points', x: [a], y: [lseS(a)], color: 'violet', r: 6 },
      ]);
      st.set('n', show(lseN(a)));
      st.set('s', show(lseS(a)));
      st.set('x', 'max = ' + (a + 2));
      note.innerHTML = 'Наивная формула работает лишь при −745 &lt; a &lt; 707: дальше e^a переполняется (inf) или обнуляется (ln 0 = −inf). Устойчивая выносит наибольшее m = a + 2: ln Σ e^z = m + ln Σ e^(z − m), все показатели ≤ 0. Ответ всегда ≈ m + 0.4076 — «главное слагаемое плюс поправка», как в пределах на бесконечности.';
    }
    w.pythonAction(() => (st0.mode === 'sp'
      ? 'import numpy as np\n\nF = np.float64(' + st0.F + ')\nwith np.errstate(over="ignore"):\n    print("наивно:    ", np.log(1 + np.exp(-F)))\nprint("устойчиво: ", np.maximum(-F, 0) + np.log1p(np.exp(-np.abs(F))))\nprint("logaddexp: ", np.logaddexp(0, -F))\n'
      : 'import numpy as np\n\nz = np.array([' + st0.a + ', ' + (st0.a + 1) + ', ' + (st0.a + 2) + '], dtype=float)\nwith np.errstate(over="ignore", divide="ignore"):\n    print("наивно:    ", np.log(np.exp(z).sum()))\nm = z.max()\nprint("устойчиво: ", m + np.log(np.exp(z - m).sum()))\n'));
    sync();
    draw();
  });

  /* ==============================================================================
   * Тренажёр: какой приём и чему равен предел
   * ============================================================================== */
  const METHODS = ['подставить', 'разложить и сократить', 'домножить на сопряжённое', 'разделить на старшую степень', 'общий знаменатель / записать дробью', 'первый замечательный (sin x / x)', 'второй замечательный (e, 1^∞)', 'эквивалентности / иерархия роста'];
  const TQ = [
    { t: R`\lim_{x\to2}(x^2+3x)`, m: 0, o: ['10', '0/0', '4', '∞'], v: 0, why: 'Многочлен непрерывен: подставляем, 4 + 6 = 10.' },
    { t: R`\lim_{x\to2}\frac{x^2-4}{x-2}`, m: 1, o: ['0', '2', '4', 'не существует'], v: 2, why: '0/0; x² − 4 = (x − 2)(x + 2), остаётся x + 2 → 4.' },
    { t: R`\lim_{x\to0}\frac{\sqrt{x+4}-2}{x}`, m: 2, o: ['0', '1/4', '1/2', '2'], v: 1, why: 'Домножаем на √(x + 4) + 2: получаем 1/(√(x + 4) + 2) → 1/4.' },
    { t: R`\lim_{x\to\infty}\frac{5x^3-x}{2x^3+7}`, m: 3, o: ['0', '5/2', '5/7', '∞'], v: 1, why: 'Делим на x³: (5 − 1/x²)/(2 + 7/x³) → 5/2.' },
    { t: R`\lim_{x\to0}\frac{\sin 3x}{x}`, m: 5, o: ['1', '3', '1/3', '0'], v: 1, why: 'sin(3x)/x = 3 · sin(3x)/(3x) → 3.' },
    { t: R`\lim_{n\to\infty}\left(1+\frac1n\right)^{2n}`, m: 6, o: ['1', 'e', 'e²', '∞'], v: 2, why: '((1 + 1/n)ⁿ)² → e².' },
    { t: R`\lim_{x\to\infty}x^2e^{-x}`, m: 7, o: ['0', '1', '∞', '2/e'], v: 0, why: 'Экспонента обгоняет любую степень: → 0.' },
    { t: R`\lim_{x\to1}\frac{x^3-1}{x-1}`, m: 1, o: ['0', '1', '3', '∞'], v: 2, why: 'x³ − 1 = (x − 1)(x² + x + 1) → 3.' },
    { t: R`\lim_{x\to0}\frac{3-x}{x+1}`, m: 0, o: ['3', '0/0', '−1', '∞'], v: 0, why: 'Знаменатель не ноль — просто подставляем: 3/1 = 3.' },
    { t: R`\lim_{x\to1}\left(\frac1{x-1}-\frac2{x^2-1}\right)`, m: 4, o: ['0', '1/2', '1', '∞'], v: 1, why: 'Общий знаменатель: (x − 1)/((x − 1)(x + 1)) = 1/(x + 1) → 1/2.' },
    { t: R`\lim_{x\to\infty}\left(\sqrt{x^2+2x}-x\right)`, m: 2, o: ['0', '1', '2', '∞'], v: 1, why: 'Сопряжённое: 2x/(√(x² + 2x) + x) → 2/2 = 1.' },
    { t: R`\lim_{x\to0}\frac{1-\cos x}{x^2}`, m: 5, o: ['0', '1/2', '1', '2'], v: 1, why: '1 − cos x = 2 sin²(x/2) ~ x²/2.' },
    { t: R`\lim_{x\to0}(1+2x)^{1/x}`, m: 6, o: ['1', 'e', 'e²', '∞'], v: 2, why: '1^∞: e^(lim (1/x)·2x) = e².' },
    { t: R`\lim_{x\to0}\frac{\ln(1+5x)}{\sin x}`, m: 7, o: ['1', '5', '1/5', '0'], v: 1, why: 'ln(1 + 5x) ~ 5x, sin x ~ x — частное, замена законна: 5.' },
    { t: R`\lim_{x\to0^+}x\ln x`, m: 7, o: ['−∞', '0', '1', '−1'], v: 1, why: 'Степень побеждает логарифм: x ln x → 0.' },
    { t: R`\lim_{x\to9}\frac{x-9}{\sqrt x-3}`, m: 2, o: ['0', '3', '6', '9'], v: 2, why: 'Домножаем на √x + 3: остаётся √x + 3 → 6.' },
    { t: R`\lim_{x\to\infty}\frac{\ln x}{\sqrt x}`, m: 7, o: ['0', '1', '∞', '1/2'], v: 0, why: 'Логарифм растёт медленнее любой степени: → 0.' },
    { t: R`\lim_{x\to-\infty}\frac{\sqrt{9x^2+1}}{x-2}`, m: 3, o: ['3', '−3', '9', '0'], v: 1, why: 'При x < 0 √(x²) = −x: ответ −3. Ловушка знака!' },
    { t: R`\lim_{x\to2}(x-2)\cdot\frac{1}{x^2-4}`, m: 4, o: ['0', '1/4', '1/2', '∞'], v: 1, why: '0 · ∞ → дробь (x − 2)/(x² − 4) = 1/(x + 2) → 1/4.' },
    { t: R`\lim_{x\to0}\frac{\tan 2x}{x}`, m: 5, o: ['1', '2', '1/2', '0'], v: 1, why: 'tan 2x ~ 2x: ответ 2.' },
    { t: R`\lim_{x\to4}\sqrt x\,(x+1)`, m: 0, o: ['10', '20', '5', '0/0'], v: 0, why: 'Непрерывна: √4 · 5 = 10.' },
    { t: R`\lim_{x\to\infty}\left(\frac{x+3}{x}\right)^{x}`, m: 6, o: ['1', 'e', 'e³', '∞'], v: 2, why: '1^∞: x · (3/x) = 3, ответ e³.' },
    { t: R`\lim_{x\to0}\frac{\tan x-\sin x}{x^3}`, m: 7, o: ['0', '1/2', '1', '−1/6'], v: 1, why: 'tan x − sin x = tan x(1 − cos x) ~ x · x²/2. Наивная замена слагаемых дала бы 0!' },
    { t: R`\lim_{x\to1}\frac{\sqrt[3]{x}-1}{x-1}`, m: 2, o: ['1/2', '1/3', '3', '1'], v: 1, why: 'Разность кубов: x − 1 = (∛x − 1)(∛x² + ∛x + 1), ответ 1/3.' },
  ];
  GBC.widget('technique-game', (el) => {
    const st0 = { mode: 'method', seed: 7, round: 0, right: 0, streak: 0, q: null, picked: null };
    const w = ui.shell(el, { title: 'Тренажёр: техника пределов', sub: 'Режим «Какой приём?» — выберите первый шаг решения. Режим «Чему равен?» — выберите ответ. Сначала мысленно подставьте предельное значение и назовите форму.' });
    ui.segmented(w.controls, { label: 'Режим', value: 'method', options: [{ value: 'method', label: 'Какой приём?' }, { value: 'value', label: 'Чему равен?' }], onChange: (v) => ((st0.mode = v), (order = []), newQ()) });
    const next = ui.button(w.controls, { label: 'Следующий', icon: 'step', onClick: () => newQ() });
    const qEl = H('div', { style: 'font-size:1.15rem;padding:8px 0 14px;overflow-x:auto;overflow-y:hidden' });
    w.main.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px' });
    w.main.appendChild(optsBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    let order = [];
    function newQ() {
      if (!order.length) {
        const rng = new GBC.RNG(st0.seed++);
        order = U.range(TQ.length);
        for (let i = order.length - 1; i > 0; i--) {
          const j = rng.randint(i + 1);
          [order[i], order[j]] = [order[j], order[i]];
        }
      }
      st0.q = TQ[order.pop()];
      st0.picked = null;
      st0.round++;
      draw();
    }
    function draw() {
      const Q = st0.q;
      texInto(qEl, Q.t, true);
      const opts = st0.mode === 'method' ? METHODS : Q.o;
      const ans = st0.mode === 'method' ? Q.m : Q.v;
      optsBox.textContent = '';
      opts.forEach((m, k) => {
        const b = ui.button(optsBox, { label: m, kind: st0.picked === null || k === ans ? 'primary' : '', onClick: () => {
          if (st0.picked !== null) return;
          st0.picked = k;
          if (k === ans) (st0.right++, st0.streak++);
          else st0.streak = 0;
          draw();
        } });
        b.style.whiteSpace = 'normal';
        b.style.textAlign = 'left';
        b.style.height = 'auto';
        if (st0.picked !== null) b.disabled = true;
      });
      st.set('r', String(st0.round));
      st.set('ok', st0.right + ' из ' + (st0.round - (st0.picked === null ? 1 : 0)));
      st.set('s', String(st0.streak));
      note.innerHTML = st0.picked === null ? 'Подставьте предельное значение: что получилось — число, «c/0», 0/0, ∞/∞, ∞ − ∞ или 1^∞?' : (st0.picked === ans ? '<b>Верно!</b> ' : '<b>Нет.</b> ' + (st0.mode === 'method' ? 'Нужно: «' + METHODS[Q.m] + '». ' : 'Ответ: ' + Q.o[Q.v] + '. ')) + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), st0.picked === null ? 'Пропустить' : 'Следующий');
    }
    newQ();
  });
})();
