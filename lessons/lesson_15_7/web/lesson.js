/* Урок 15.7: вторая производная, выпуклость, Тейлор и Ньютон. Часть 1 — вторая производная, экстремумы, выпуклость.
 * Виджеты: три модели местности (интуиция), лестница производных, путь–скорость–ускорение, вторая разность,
 * изгиб и касательная, точки перегиба, тест второй производной, высшие производные, исследование функции,
 * «найди f и f′», хорда, три признака выпуклости, спуск из многих стартов, конструктор выпуклых функций,
 * неравенство Йенсена, выпуклость потерь бустинга.
 * Общие помощники выставлены в GBC.lesson157 — ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  /* ==============================================================================
   * Общие помощники урока
   * ============================================================================== */
  /** Табуляция функции для слоя 'line': NaN там, где функции нет или она слишком велика; разрывы на скачках. */
  function curve(fn, x0, x1, n = 601, o = {}) {
    const x = [];
    const y = [];
    let prev = NaN;
    for (const t of U.linspace(x0, x1, n)) {
      let r = fn(t);
      if (!Number.isFinite(r) || (o.cap !== undefined && Math.abs(r) > o.cap)) r = NaN;
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
  /** Диапазон по y по значениям функций (с полями); cap обрезает выбросы. */
  function yRange(fns, xs, pad = 0.12, cap = Infinity) {
    const ys = [];
    for (const fn of [].concat(fns)) for (const x of xs) {
      const v = fn(x);
      if (Number.isFinite(v) && Math.abs(v) <= cap) ys.push(v);
    }
    if (!ys.length) return [-1, 1];
    const [lo, hi] = U.extent(ys);
    const d = (hi - lo) * pad || 1;
    return [lo - d, hi + d];
  }
  const sigma = (z) => U.sigmoid(z);
  const softplus = (z) => (z > 30 ? z : Math.log1p(Math.exp(z)));
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const f4 = (v) => U.fmt(v, 4);
  const py = (v) => U.pyNum(v);
  /** Полосы знака: бирюзовые — где fn > 0 (чаша), фиолетовые — где fn < 0 (купол). */
  function signBands(fn, x0, x1, opacity = 0.1, n = 600) {
    const xs = U.linspace(x0, x1, n);
    const out = [];
    let start = xs[0];
    let sg = Math.sign(fn(xs[0])) || 0;
    for (let i = 1; i <= xs.length; i++) {
      const v = i < xs.length ? fn(xs[i]) : NaN;
      const s2 = i < xs.length ? (Number.isFinite(v) ? Math.sign(v) : 0) : null;
      if (s2 !== sg) {
        if (sg) out.push({ type: 'vband', x0: start, x1: xs[i - 1], color: sg > 0 ? 'aqua' : 'violet', opacity });
        if (i < xs.length) (start = xs[i - 1]), (sg = s2);
      }
    }
    return out;
  }
  /** Корни функции на отрезке: смена знака на сетке + бисекция; точные нули узлов тоже. */
  function roots(fn, a, b, n = 2400) {
    const xs = U.linspace(a, b, n);
    const out = [];
    const push = (r) => {
      if (!out.some((q) => Math.abs(q - r) < (b - a) * 1e-5)) out.push(r);
    };
    let pv = fn(xs[0]);
    if (pv === 0) push(xs[0]);
    for (let i = 1; i < xs.length; i++) {
      const v = fn(xs[i]);
      if (v === 0) push(xs[i]);
      else if (Number.isFinite(pv) && Number.isFinite(v) && pv * v < 0) {
        let lo = xs[i - 1];
        let hi = xs[i];
        let flo = pv;
        for (let k = 0; k < 80; k++) {
          const m = (lo + hi) / 2;
          const fm = fn(m);
          if (fm === 0) {
            lo = hi = m;
            break;
          }
          if (fm * flo < 0) hi = m;
          else (lo = m), (flo = fm);
        }
        // отбрасываем «корни» в разрывах (полюсах): там |fn| велик по обе стороны
        const r = (lo + hi) / 2;
        if (Math.abs(fn(r)) < 1e-6 * (1 + Math.abs(pv) + Math.abs(v))) push(r);
      }
      pv = v;
    }
    return out.sort((p, q) => p - q);
  }
  /** Карточка с заголовком; plain — заголовок обычным шрифтом (для подписей с формулами). */
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
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;' + st }, text);
  }
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  /** Кнопки-варианты ответа (для тренажёров). */
  function choiceButtons(box, options, onPick) {
    box.textContent = '';
    return options.map((o) => ui.button(box, { label: o.label, kind: 'primary', onClick: () => onPick(o.v) }));
  }
  const STARS = ['', '★', '★★', '★★★'];
  const SUPD = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (k) => String(k).split('').map((c) => SUPD[c] || c).join('');
  /** Обозначение k-й производной: f, f′, f″, f‴, f⁽⁴⁾… */
  const dname = (k, f = 'f') => (k === 0 ? f : k === 1 ? f + '′' : k === 2 ? f + '″' : k === 3 ? f + '‴' : f + '⁽' + sup(k) + '⁾');
  function fact(k) {
    let r = 1;
    for (let i = 2; i <= k; i++) r *= i;
    return r;
  }
  const PY_HEAD = 'import numpy as np\nimport matplotlib.pyplot as plt\n';
  /** Подписи логарифмической оси: 10⁻⁶ вместо 1.0e-6. */
  function powFmt(v) {
    const e = Math.round(Math.log10(v));
    if (Math.abs(v - Math.pow(10, e)) > 1e-9 * v) return U.fmt(v, 2);
    if (e >= -2 && e <= 3) return String(Number(v.toPrecision(3)));
    return '10' + sup(e);
  }
  /** Малые числа — в виде 2.5·10⁻³ (для ошибок в таблицах). */
  function sci(v, d = 1) {
    if (v === null || v === undefined || Number.isNaN(v)) return '—';
    if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 0.01 && a < 1e5) return U.fmt(v, 3);
    const e = Math.floor(Math.log10(a));
    let m = v / Math.pow(10, e);
    if (Math.abs(Number(m.toFixed(d))) >= 10) return sci(v > 0 ? 10 ** (e + 1) : -(10 ** (e + 1)), d);
    return (m < 0 ? '−' : '') + Math.abs(m).toFixed(d) + '·10' + sup(e);
  }

  GBC.lesson157 = { curve, yRange, sigma, softplus, f2, f3, f4, py, signBands, roots, card, cardGrid, badge, rowTable, choiceButtons, STARS, sup, dname, fact, PY_HEAD, powFmt, sci };

  /* ==============================================================================
   * Интуиция. Три модели местности: высота, касательная, парабола
   * ============================================================================== */
  const OI = {
    ex: { label: 'eˣ − 2x (одна яма)', f: (x) => Math.exp(x) - 2 * x, d: (x) => Math.exp(x) - 2, d2: Math.exp, dom: [-1.5, 2.6], x0: 2, opt: Math.LN2, py: ['np.exp(x) - 2 * x', 'np.exp(x) - 2', 'np.exp(x)'] },
    w: { label: 'x⁴ − 2x² (две ямы и горб)', f: (x) => x ** 4 - 2 * x * x, d: (x) => 4 * x ** 3 - 4 * x, d2: (x) => 12 * x * x - 4, dom: [-1.7, 1.7], x0: 1.4, opt: 1, py: ['x**4 - 2 * x**2', '4 * x**3 - 4 * x', '12 * x**2 - 4'] },
  };
  GBC.widget('orders-intro', (el) => {
    const s = { fn: 'ex', x: 2, mode: 'all' };
    const w = ui.shell(el, { title: 'Что знает путник: высота, наклон, изгиб', sub: 'Синяя кривая — настоящий рельеф (его путник не видит). Серая прямая — модель нулевого порядка (только высота), оранжевая — первого (касательная), фиолетовая — второго (парабола Тейлора). Тяните точку.' });
    ui.select(w.controls, { label: 'Рельеф', value: s.fn, options: Object.entries(OI).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.fn = v;
      s.x = OI[v].x0;
      xs.input.min = OI[v].dom[0];
      xs.input.max = OI[v].dom[1];
      xs.set(s.x);
      draw();
    } });
    const xs = ui.slider(w.controls, { label: 'Где стоит путник, x', min: -1.5, max: 2.6, step: 0.01, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    ui.segmented(w.controls, { label: 'Модель', value: s.mode, options: [{ value: '0', label: '0' }, { value: '1', label: '1' }, { value: '2', label: '2' }, { value: 'all', label: 'все' }], onChange: (v) => ((s.mode = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'высота f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'f(x)' }, { key: 'd', label: 'наклон f′(x)' }, { key: 'd2', label: 'изгиб f″(x)' }, { key: 'v', label: 'дно параболы' }]);
    function draw() {
      const F = OI[s.fn];
      const x = U.clamp(s.x, F.dom[0], F.dom[1]);
      const fx = F.f(x);
      const d = F.d(x);
      const d2 = F.d2(x);
      const grid = U.linspace(F.dom[0], F.dom[1], 400);
      const yr = yRange(F.f, grid, 0.18);
      const show = (k) => s.mode === 'all' || s.mode === String(k);
      const vx = d2 > 0 ? x - d / d2 : NaN;
      const L = [
        { type: 'line', x: grid, y: grid.map(F.f), color: 'model', width: 2.6, label: 'рельеф f', hover: false },
        show(0) ? { type: 'hline', y: fx, color: 'muted', width: 1.6, dash: '2 4' } : null,
        show(1) ? { type: 'line', x: grid, y: grid.map((t) => fx + d * (t - x)), color: 'tree', width: 2, label: 'касательная (порядок 1)', hover: false } : null,
        show(2) ? { type: 'line', x: grid, y: grid.map((t) => fx + d * (t - x) + 0.5 * d2 * (t - x) ** 2), color: 'violet', width: 2.2, dash: '6 4', label: 'парабола (порядок 2)', hover: false } : null,
        show(2) && Number.isFinite(vx) ? { type: 'points', x: [vx], y: [fx - (d * d) / (2 * d2)], color: 'violet', r: 6, hollow: true } : null,
        show(2) && Number.isFinite(vx) ? { type: 'arrows', x1: [x], y1: [fx], x2: [vx], y2: [fx - (d * d) / (2 * d2)], color: 'violet', width: 1.6 } : null,
        show(1) && s.mode === '1' ? { type: 'arrows', x1: [x], y1: [fx], x2: [x - Math.sign(d) * 0.5], y2: [fx - Math.abs(d) * 0.5], color: 'tree', width: 2 } : null,
        { type: 'points', x: [x], y: [fx], color: 'tree', r: 7, draggable: true, onDrag: (i, nx) => ((s.x = Math.round(U.clamp(nx, F.dom[0], F.dom[1]) * 100) / 100), xs.set(s.x), draw()) },
      ];
      plot.render(L, { x: F.dom, y: yr });
      st.set('f', f3(fx));
      st.set('d', f3(d));
      st.set('d2', f3(d2));
      st.set('v', Number.isFinite(vx) ? 'x = ' + f3(vx) : 'нет (f″ ≤ 0)');
      const M = {
        0: 'Модель нулевого порядка — горизонтальная прямая на высоте f(x). Она ничего не говорит о том, куда идти.',
        1: 'Касательная знает направление: наклон f′ = ' + f3(d) + (d > 0 ? ', значит, спуск — влево.' : d < 0 ? ', значит, спуск — вправо.' : ' — ровное место.') + ' Но у прямой нет дна: шагать по ней можно бесконечно, длину шага приходится угадывать (это темп η градиентного спуска).',
        2: d2 > 0 ? 'Парабола знает и направление, и расстояние: её дно в x = ' + f3(vx) + '. Прыжок туда — шаг Ньютона −f′/f″ = ' + f3(-d / d2) + '.' : 'Здесь f″ = ' + f3(d2) + ' &lt; 0: парабола перевёрнута, у неё не дно, а вершина. Модель второго порядка честно говорит: «рядом горб» — и прыгать в её экстремум нельзя (шаг 24).',
      };
      note.innerHTML = s.mode === 'all' ? M[1] + ' ' + M[2] + (Number.isFinite(vx) ? ' Настоящее дно — x = ' + f3(F.opt) + (s.fn === 'w' ? ' (ближайшее)' : '') + '.' : '') : M[s.mode];
    }
    w.pythonAction(() => {
      const F = OI[s.fn];
      return PY_HEAD + '\nf = lambda x: ' + F.py[0] + '\nd1 = lambda x: ' + F.py[1] + '\nd2 = lambda x: ' + F.py[2] + '\na = ' + py(s.x) + '\nx = np.linspace(' + F.dom[0] + ', ' + F.dom[1] + ', 400)\nplt.plot(x, f(x), lw=2.6, label="рельеф f")\nplt.axhline(f(a), ls=":", color="gray", label="порядок 0")\nplt.plot(x, f(a) + d1(a) * (x - a), label="порядок 1: касательная")\nplt.plot(x, f(a) + d1(a) * (x - a) + 0.5 * d2(a) * (x - a) ** 2, "--", label="порядок 2: парабола")\nif d2(a) > 0:\n    print("дно параболы (шаг Ньютона):", a - d1(a) / d2(a))\nplt.ylim(f(x).min() - 1, f(x).max() + 0.5)\nplt.legend(); plt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * 1. Лестница производных: f, f′, f″, f‴ одной функции
   * ============================================================================== */
  const LAD = {
    cube: { label: 'x³', dom: [-2, 2], d: [(x) => x ** 3, (x) => 3 * x * x, (x) => 6 * x, () => 6], t: ['x³', '3x²', '6x', '6'], py: ['x**3', '3 * x**2', '6 * x', '6 + 0 * x'] },
    poly: { label: 'x⁴ − 3x² + 2x', dom: [-2, 2], d: [(x) => x ** 4 - 3 * x * x + 2 * x, (x) => 4 * x ** 3 - 6 * x + 2, (x) => 12 * x * x - 6, (x) => 24 * x], t: ['x⁴ − 3x² + 2x', '4x³ − 6x + 2', '12x² − 6', '24x'], py: ['x**4 - 3 * x**2 + 2 * x', '4 * x**3 - 6 * x + 2', '12 * x**2 - 6', '24 * x'] },
    sin: { label: 'sin x', dom: [-6.3, 6.3], d: [Math.sin, Math.cos, (x) => -Math.sin(x), (x) => -Math.cos(x)], t: ['sin x', 'cos x', '−sin x', '−cos x'], py: ['np.sin(x)', 'np.cos(x)', '-np.sin(x)', '-np.cos(x)'] },
    exp2: { label: 'e^(2x)', dom: [-2, 1.2], d: [(x) => Math.exp(2 * x), (x) => 2 * Math.exp(2 * x), (x) => 4 * Math.exp(2 * x), (x) => 8 * Math.exp(2 * x)], t: ['e^(2x)', '2e^(2x)', '4e^(2x)', '8e^(2x)'], py: ['np.exp(2 * x)', '2 * np.exp(2 * x)', '4 * np.exp(2 * x)', '8 * np.exp(2 * x)'] },
    ln: { label: 'ln x', dom: [0.25, 4], d: [Math.log, (x) => 1 / x, (x) => -1 / (x * x), (x) => 2 / x ** 3], t: ['ln x', '1/x', '−1/x²', '2/x³'], py: ['np.log(x)', '1 / x', '-1 / x**2', '2 / x**3'] },
    xex: { label: 'x·eˣ', dom: [-5, 1.2], d: [(x) => x * Math.exp(x), (x) => (x + 1) * Math.exp(x), (x) => (x + 2) * Math.exp(x), (x) => (x + 3) * Math.exp(x)], t: ['x·eˣ', '(x + 1)eˣ', '(x + 2)eˣ', '(x + 3)eˣ'], py: ['x * np.exp(x)', '(x + 1) * np.exp(x)', '(x + 2) * np.exp(x)', '(x + 3) * np.exp(x)'] },
    sig: { label: 'σ(x) — сигмоида', dom: [-6, 6], d: [sigma, (x) => sigma(x) * (1 - sigma(x)), (x) => sigma(x) * (1 - sigma(x)) * (1 - 2 * sigma(x)), (x) => { const s = sigma(x); return s * (1 - s) * (1 - 6 * s + 6 * s * s); }], t: ['σ', 'σ(1 − σ)', 'σ(1 − σ)(1 − 2σ)', 'σ(1 − σ)(1 − 6σ + 6σ²)'], py: ['s', 's * (1 - s)', 's * (1 - s) * (1 - 2 * s)', 's * (1 - s) * (1 - 6 * s + 6 * s**2)'] },
  };
  GBC.widget('deriv-ladder', (el) => {
    const s = { fn: 'poly', x: 1 };
    const w = ui.shell(el, { title: 'Лестница производных', sub: 'Четыре графика: функция и её первые три производные. Точка x общая для всех. Обратите внимание: нули каждого графика стоят под экстремумами графика над ним.', stack: true, foot: false });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(LAD).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.fn = v;
      const D = LAD[v].dom;
      xs.input.min = D[0];
      xs.input.max = D[1];
      s.x = U.clamp(s.x, D[0], D[1]);
      xs.set(s.x);
      draw();
    } });
    const xs = ui.slider(w.controls, { label: 'Точка x', min: -2, max: 2, step: 0.01, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const plots = [0, 1, 2, 3].map((k) => new GBC.Plot(box, { height: 190, margin: { left: 52 }, x: { label: 'x' }, y: { label: dname(k) + '(x)' } }));
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const F = LAD[s.fn];
      const x = U.clamp(s.x, F.dom[0], F.dom[1]);
      const grid = U.linspace(F.dom[0], F.dom[1], 400);
      plots.forEach((p, k) => {
        const fn = F.d[k];
        const yr = yRange(fn, grid, 0.12);
        if (yr[0] > 0) yr[0] = Math.min(yr[0], -0.05 * yr[1]);
        if (yr[1] < 0) yr[1] = Math.max(yr[1], -0.05 * yr[0]);
        p.setTitle(dname(k) + '(x) = ' + F.t[k]);
        p.render([
          { type: 'hline', y: 0, color: 'axis', width: 1 },
          { type: 'line', x: grid, y: grid.map(fn), color: k === 0 ? 'model' : k === 1 ? 'tree' : k === 2 ? 'violet' : 'aqua', width: 2.4, hover: false },
          { type: 'vline', x, color: 'ink2', width: 1, dash: '3 3' },
          { type: 'points', x: [x], y: [fn(x)], color: 'ink', r: 5, draggable: true, onDrag: (i, nx) => ((s.x = Math.round(U.clamp(nx, F.dom[0], F.dom[1]) * 100) / 100), xs.set(s.x), draw()) },
        ], { x: F.dom, y: yr });
      });
      rowTable(tbl, ['', 'f', 'f′', 'f″', 'f‴'], [['x = ' + f2(x), ...F.d.map((fn) => f4(fn(x)))]], null);
      const d2 = F.d[2](x);
      const T = {
        cube: 'У x³ третья производная — константа 6, а четвёртая — ноль: каждое дифференцирование понижает степень на 1.',
        poly: 'Многочлен степени 4: f⁽⁴⁾ = 24, f⁽⁵⁾ = 0. В x = 1 вторая производная 12 − 6 = 6.',
        sin: 'Цикл длины 4: sin → cos → −sin → −cos → sin. Графики f и f″ — зеркальные: «ускорение» синуса противоположно значению.',
        exp2: 'Каждая производная e^(2x) — та же функция, умноженная на 2: графики отличаются только масштабом.',
        ln: 'Знаки чередуются: 1/x > 0, −1/x² < 0, 2/x³ > 0. Логарифм растёт (f′ > 0), но всё медленнее (f″ < 0) — купол.',
        xex: 'К множителю при eˣ каждый раз прибавляется 1: (x + n)·eˣ. Нули сдвигаются влево на единицу.',
        sig: 'f″ = 0 в нуле — там перегиб сигмоиды и максимум f′ = ¼. Сама f′ = σ(1 − σ) — это гессиан log-loss h = p(1 − p).',
      };
      note.innerHTML = T[s.fn] + ' Сейчас f″(' + f2(x) + ') = ' + f3(d2) + (Math.abs(d2) < 1e-9 ? ' — изгиба нет.' : d2 > 0 ? ' &gt; 0: наклон растёт, график изогнут чашей.' : ' &lt; 0: наклон падает, график изогнут куполом.');
    }
    w.pythonAction(() => {
      const F = LAD[s.fn];
      const pre = s.fn === 'sig' ? 's = 1 / (1 + np.exp(-x))\n' : '';
      return PY_HEAD + '\nx = np.linspace(' + F.dom[0] + ', ' + F.dom[1] + ', 400)\n' + pre + 'ders = [' + F.py.join(', ') + ']\nnames = ["f", "f′", "f″", "f‴"]\nfig, axes = plt.subplots(2, 2, figsize=(10, 6))\nfor ax, y, name in zip(axes.flat, ders, names):\n    ax.plot(x, y, lw=2.2)\n    ax.axhline(0, color="gray", lw=0.8)\n    ax.set_title(name)\nplt.tight_layout(); plt.show()\n\n# проверка второй производной второй разностью\nf = lambda x: ' + (s.fn === 'sig' ? '1 / (1 + np.exp(-x))' : F.py[0]) + '\na, h = ' + py(s.x) + ', 1e-4\nprint("f″ ≈", (f(a + h) - 2 * f(a) + f(a - h)) / h**2)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 2. Путь → скорость → ускорение (три сценария)
   * ============================================================================== */
  const MOT = {
    trip: { label: 'Поездка из урока 15.2', T: 10, s: (t) => 3 * t * t - t ** 3 / 5, v: (t) => 6 * t - 0.6 * t * t, a: (t) => 6 - 1.2 * t, sd: [-5, 105], vd: [-1, 17], ad: [-7, 7], py: ['3 * t**2 - t**3 / 5', '6 * t - 0.6 * t**2', '6 - 1.2 * t'] },
    fall: { label: 'Свободное падение', T: 4, s: (t) => 4.9 * t * t, v: (t) => 9.8 * t, a: () => 9.8, sd: [-3, 82], vd: [-2, 42], ad: [-1, 12], py: ['4.9 * t**2', '9.8 * t', '9.8 + 0 * t'] },
    brake: { label: 'Торможение с 20 м/с', T: 4, s: (t) => 20 * t - 2.5 * t * t, v: (t) => 20 - 5 * t, a: () => -5, sd: [-2, 44], vd: [-2, 22], ad: [-7, 2], py: ['20 * t - 2.5 * t**2', '20 - 5 * t', '-5 + 0 * t'] },
  };
  GBC.widget('pos-speed-accel', (el) => {
    const s = { sc: 'trip', k: 25 };
    const N = 100;
    const w = ui.shell(el, { title: 'Путь → скорость → ускорение', sub: 'Скорость — производная пути, ускорение — производная скорости, то есть вторая производная пути. Фон графика пути: бирюзовый — ускорение положительно (чаша), фиолетовый — отрицательно (купол).', stack: true, foot: false });
    ui.select(w.controls, { label: 'Сценарий', value: s.sc, options: Object.entries(MOT).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.sc = v), draw()) });
    ui.player(w.controls, { label: 'Время', min: 0, max: N, value: s.k, fps: 12, format: (k) => 't = ' + U.fmt((k / N) * MOT[s.sc].T, 2) + ' с', onChange: (k) => ((s.k = k), draw()) });
    const box = H('div', { class: 'plots-3' });
    w.main.appendChild(box);
    const mk = (label) => new GBC.Plot(box, { height: 230, x: { label: 't, с' }, y: { label } });
    const p1 = mk('путь s, м');
    const p2 = mk('скорость v = s′, м/с');
    const p3 = mk('ускорение a = s″, м/с²');
    const note = w.note('', true);
    function draw() {
      const M = MOT[s.sc];
      const t = (s.k / N) * M.T;
      const ts = U.linspace(0, M.T, 201);
      const half = M.T * 0.12;
      const seg = (f, d) => ({ type: 'segments', x1: [t - half], y1: [f(t) - half * d], x2: [t + half], y2: [f(t) + half * d], color: 'tree', width: 2.4, opacity: 1 });
      p1.render([...signBands(M.a, 0, M.T, 0.12), { type: 'line', x: ts, y: ts.map(M.s), color: 'model', width: 2.2, hover: false }, seg(M.s, M.v(t)), { type: 'points', x: [t], y: [M.s(t)], color: 'tree', r: 5 }], { x: [0, M.T], y: M.sd });
      p2.render([{ type: 'hline', y: 0, color: 'axis' }, { type: 'line', x: ts, y: ts.map(M.v), color: 'model', width: 2.2, hover: false }, seg(M.v, M.a(t)), { type: 'points', x: [t], y: [M.v(t)], color: 'tree', r: 5 }], { x: [0, M.T], y: M.vd });
      p3.render([{ type: 'hline', y: 0, color: 'axis' }, { type: 'line', x: ts, y: ts.map(M.a), color: 'model', width: 2.2, hover: false }, { type: 'points', x: [t], y: [M.a(t)], color: 'tree', r: 5 }], { x: [0, M.T], y: M.ad });
      const a = M.a(t);
      const v = M.v(t);
      let msg = 't = ' + f2(t) + ' с: путь ' + U.fmt(M.s(t), 1) + ' м, скорость ' + f2(v) + ' м/с, ускорение ' + f2(a) + ' м/с². ';
      if (s.sc === 'trip') msg += Math.abs(a) < 0.15 ? '<b>Ускорение ноль</b> — скорость максимальна (15 м/с), график пути переходит от чаши к куполу: точка перегиба.' : a > 0 ? 'Ускорение положительно: скорость растёт, путь изогнут чашей.' : 'Ускорение отрицательно: скорость падает, путь изогнут куполом.';
      else if (s.sc === 'fall') msg += 'Ускорение постоянно (9.8 м/с²): скорость растёт равномерно, путь — парабола. Оранжевые отрезки — касательные: наклон касательной к пути равен скорости, к скорости — ускорению.';
      else msg += v > 0.01 ? 'Скорость и ускорение разных знаков — машина тормозит. Остановка через 4 с, тормозной путь 40 м.' : '<b>Остановка</b>: v = 0, пройдено 40 м.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const M = MOT[s.sc];
      return PY_HEAD + '\nt = np.linspace(0, ' + M.T + ', 201)\ns = ' + M.py[0] + '\nv = ' + M.py[1] + '\na = ' + M.py[2] + '\n# проверка: численные производные пути\nprint("max|v − ds/dt| =", np.abs(np.gradient(s, t)[5:-5] - v[5:-5]).max())\nfig, axes = plt.subplots(1, 3, figsize=(13, 3.3))\nfor ax, y, name in zip(axes, [s, v, a], ["путь s", "скорость v = s′", "ускорение a = s″"]):\n    ax.plot(t, y, lw=2.2); ax.axhline(0, color="gray", lw=0.8); ax.set(title=name, xlabel="t, с")\nplt.tight_layout(); plt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * 3. Вторая разность: парабола через три точки и выбор шага h
   * ============================================================================== */
  const SD = {
    cube: { label: 'x³ в точке 1 (точно 6)', f: (x) => x ** 3, a: 1, ex: 6, f4: 0, py: 'x**3' },
    exp: { label: 'eˣ в точке 0 (точно 1)', f: Math.exp, a: 0, ex: 1, f4: 1, py: 'np.exp(x)' },
    sin: { label: 'sin x в точке 1 (точно −sin 1)', f: Math.sin, a: 1, ex: -Math.sin(1), f4: Math.sin(1), py: 'np.sin(x)' },
    ln: { label: 'ln x в точке 1 (точно −1)', f: Math.log, a: 1, ex: -1, f4: -6, py: 'np.log(x)' },
  };
  const d2num = (f, x, h) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
  GBC.widget('second-diff', (el) => {
    const s = { fn: 'exp', h: 0.3 };
    const w = ui.shell(el, { title: 'Вторая разность и выбор шага h', sub: 'Через три точки x − h, x, x + h проходит ровно одна парабола, и её вторая производная — это и есть вторая разность. Уменьшайте h: сначала ошибка падает как h², потом её съедают ошибки округления.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(SD).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), draw()) });
    const hsl = ui.slider(w.controls, { label: 'Шаг h', min: 1e-9, max: 0.5, log: true, value: s.h, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.h = v), draw()) });
    ui.button(w.controls, { label: 'h = 10⁻⁴ (почти лучший)', onClick: () => ((s.h = 1e-4), hsl.set(1e-4), draw()) });
    ui.button(w.controls, { label: 'h = 10⁻⁸ (слишком мал)', onClick: () => ((s.h = 1e-8), hsl.set(1e-8), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 250, margin: { left: 64 }, x: { label: 'шаг h (лог. шкала)', type: 'log', domain: [1e-9, 0.5], ticks: [1e-9, 1e-7, 1e-5, 1e-3, 1e-1], format: powFmt }, y: { label: 'ошибка |Δ²f/h² − f″|', type: 'log', domain: [1e-17, 1e2], ticks: [1e-16, 1e-12, 1e-8, 1e-4, 1], format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'вторая разность' }, { key: 'e', label: 'точно f″' }, { key: 'err', label: 'ошибка' }, { key: 'th', label: 'теория h²·f⁽⁴⁾/12' }]);
    function draw() {
      const F = SD[s.fn];
      const a = F.a;
      const h = s.h;
      const fa = F.f(a);
      const v = d2num(F.f, a, h);
      // парабола через три точки: P(x) = f(a) + b·(x − a) + v/2·(x − a)²
      const b = (F.f(a + h) - F.f(a - h)) / (2 * h);
      const win = Math.max(1.2, 1.5 * Math.min(h, 0.5));
      const lo = s.fn === 'ln' ? Math.max(0.15, a - win) : a - win;
      const grid = U.linspace(lo, a + win, 300);
      const P = (x) => fa + b * (x - a) + 0.5 * v * (x - a) ** 2;
      p1.render([
        { type: 'line', x: grid, y: grid.map(F.f), color: 'model', width: 2.6, label: 'f(x)', hover: false },
        { type: 'line', x: grid, y: grid.map(P), color: 'violet', width: 2, dash: '6 4', label: 'парабола через 3 точки', hover: false },
        { type: 'points', x: [a - h, a, a + h], y: [F.f(a - h), fa, F.f(a + h)], color: 'tree', r: 5, tooltip: (i) => [['x', U.fmt([a - h, a, a + h][i], 6)], ['f', U.fmt([F.f(a - h), fa, F.f(a + h)][i], 6)]] },
      ], { x: [lo, a + win], y: yRange(F.f, grid, 0.25) });
      const hs = [];
      for (let e = -9; e <= Math.log10(0.5) + 1e-9; e += 0.05) hs.push(Math.pow(10, e));
      const errs = hs.map((t) => Math.max(Math.abs(d2num(F.f, a, t) - F.ex), 1e-17));
      const theory = hs.map((t) => (F.f4 ? Math.max((t * t * Math.abs(F.f4)) / 12, 1e-17) : NaN));
      const err = Math.max(Math.abs(v - F.ex), 1e-17);
      p2.render([
        { type: 'line', x: hs, y: errs, color: 'model', width: 2.2, label: 'фактическая ошибка' },
        F.f4 ? { type: 'line', x: hs, y: theory, color: 'muted', width: 1.6, dash: '5 4', label: 'h²·|f⁽⁴⁾|/12', hover: false } : null,
        { type: 'vline', x: h, color: 'tree', width: 1.4, dash: '3 3' },
        { type: 'points', x: [h], y: [err], color: 'tree', r: 6 },
      ]);
      st.set('v', U.fmt(v, 9));
      st.set('e', U.fmt(F.ex, 9));
      st.set('err', sci(Math.abs(v - F.ex)));
      st.set('th', F.f4 ? sci((h * h * Math.abs(F.f4)) / 12) : '0 (f⁽⁴⁾ = 0)');
      const regime = h > 3e-4 ? 'Здесь главная — <b>ошибка метода</b> ≈ h²·|f⁽⁴⁾|/12: уменьшили h в 10 раз — ошибка в 100 раз меньше (наклон 2 на графике).' : h > 2e-5 ? 'Около <b>лучшего шага</b> h ≈ 10⁻⁴: ошибка метода и ошибка округления примерно равны.' : 'Здесь главная — <b>ошибка округления</b>: в числителе вычитаются почти равные числа (≈ 10⁻¹⁶ относительной погрешности), а делим на h² = ' + U.fmt(h * h, 1) + '. Чем меньше h, тем хуже.';
      note.innerHTML = (s.fn === 'cube' ? 'Для x³ четвёртая производная равна нулю, поэтому ошибки метода нет: при больших h вторая разность точна, а вся ошибка — округление. ' : '') + regime;
    }
    w.pythonAction(() => {
      const F = SD[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + F.py + '\na, exact = ' + F.a + ', ' + py(F.ex) + '\nfor h in [0.1, 1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-8]:\n    d2 = (f(a + h) - 2 * f(a) + f(a - h)) / h**2\n    print(f"h = {h:7.0e}: Δ²f/h² = {d2:.12f}, ошибка {abs(d2 - exact):.1e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 4. Изгиб: касательная, парабола и где график относительно касательной
   * ============================================================================== */
  const CF = {
    cubic: { label: 'x³/3 − x', f: (x) => x ** 3 / 3 - x, d: (x) => x * x - 1, d2: (x) => 2 * x, dom: [-2.6, 2.6], py: ['x**3 / 3 - x', 'x**2 - 1', '2 * x'] },
    exp: { label: 'eˣ (касательная в 0: 1 + x)', f: Math.exp, d: Math.exp, d2: Math.exp, dom: [-3, 2], py: ['np.exp(x)', 'np.exp(x)', 'np.exp(x)'] },
    ln: { label: 'ln x (касательная в 1: x − 1)', f: Math.log, d: (x) => 1 / x, d2: (x) => -1 / (x * x), dom: [0.15, 4], py: ['np.log(x)', '1 / x', '-1 / x**2'] },
    sin: { label: 'sin x', f: Math.sin, d: Math.cos, d2: (x) => -Math.sin(x), dom: [-4, 4], py: ['np.sin(x)', 'np.cos(x)', '-np.sin(x)'] },
    quart: { label: 'x⁴ − 2x²', f: (x) => x ** 4 - 2 * x * x, d: (x) => 4 * x ** 3 - 4 * x, d2: (x) => 12 * x * x - 4, dom: [-1.8, 1.8], py: ['x**4 - 2 * x**2', '4 * x**3 - 4 * x', '12 * x**2 - 4'] },
    flat: { label: 'x⁴ (плоское дно)', f: (x) => x ** 4, d: (x) => 4 * x ** 3, d2: (x) => 12 * x * x, dom: [-1.5, 1.5], py: ['x**4', '4 * x**3', '12 * x**2'] },
    logloss: { label: 'log-loss ln(1 + e^(−F))', f: (x) => softplus(-x), d: (x) => sigma(x) - 1, d2: (x) => sigma(x) * (1 - sigma(x)), dom: [-5, 5], py: ['np.log1p(np.exp(-x))', '1 / (1 + np.exp(-x)) - 1', '(1 / (1 + np.exp(-x))) * (1 - 1 / (1 + np.exp(-x)))'] },
  };
  GBC.widget('curvature', (el) => {
    const s = { fn: 'cubic', x: 1 };
    const w = ui.shell(el, { title: 'Вторая производная — это изгиб', sub: 'Оранжевая прямая — касательная (учитывает f′), фиолетовая парабола — приближение с учётом f″. Фон: бирюзовый — f″ > 0 (чаша), фиолетовый — f″ < 0 (купол). Тяните точку.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(CF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.fn = v;
      s.x = v === 'exp' ? 0 : v === 'ln' ? 1 : Number((CF[v].dom[1] * 0.4).toFixed(2));
      draw();
    } });
    ui.button(w.controls, { label: 'Показать зазор ½f″Δ² при Δ = ±0.5', onClick: () => ((s.gap = !s.gap), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'f′(x)' }, { key: 'd2', label: 'f″(x)' }, { key: 'k', label: 'форма' }, { key: 'pos', label: 'график и касательная' }]);
    function draw() {
      const F = CF[s.fn];
      const x = U.clamp(s.x, F.dom[0], F.dom[1]);
      const xs = U.linspace(F.dom[0], F.dom[1], 401);
      const yr = yRange(F.f, xs, 0.15, 60);
      const fx = F.f(x);
      const d = F.d(x);
      const d2 = F.d2(x);
      const span = F.dom[1] - F.dom[0];
      const win = U.linspace(Math.max(F.dom[0], x - span * 0.25), Math.min(F.dom[1], x + span * 0.25), 120);
      const tan = (t) => fx + d * (t - x);
      const dl = span * 0.12;
      const side = [x - dl, x + dl].filter((t) => t >= F.dom[0] && t <= F.dom[1]).map((t) => F.f(t) - tan(t));
      const pos = side.every((v) => v > 1e-9) ? 'над касательной' : side.every((v) => v < -1e-9) ? 'под касательной' : 'пересекает её';
      plot.render([
        ...signBands(F.d2, F.dom[0], F.dom[1]),
        { type: 'line', x: xs, y: xs.map(F.f), color: 'model', width: 2.4, label: 'f(x)', hover: false },
        { type: 'line', x: win, y: win.map(tan), color: 'tree', width: 1.8, label: 'касательная', hover: false },
        { type: 'line', x: win, y: win.map((t) => tan(t) + 0.5 * d2 * (t - x) ** 2), color: 'violet', width: 2, dash: '6 4', label: 'парабола с f″', hover: false },
        s.gap ? { type: 'segments', x1: [x - 0.5, x + 0.5], y1: [tan(x - 0.5), tan(x + 0.5)], x2: [x - 0.5, x + 0.5], y2: [F.f(x - 0.5), F.f(x + 0.5)], color: 'red', width: 2.4, opacity: 1 } : null,
        { type: 'points', x: [x], y: [fx], color: 'tree', r: 7, draggable: true, onDrag: (i, nx) => ((s.x = Math.round(U.clamp(nx, F.dom[0], F.dom[1]) * 100) / 100), draw()) },
      ], { x: F.dom, y: yr });
      st.set('d', f3(d));
      st.set('d2', f3(d2));
      st.set('k', Math.abs(d2) < 0.05 ? 'почти прямо' : d2 > 0 ? 'чаша ∪' : 'купол ∩');
      st.set('pos', 'график ' + pos);
      let msg = 'f″ = ' + f3(d2) + ': ' + (Math.abs(d2) < 0.05 ? 'график здесь почти не изогнут — возможна точка перегиба, где чаша сменяется куполом.' : d2 > 0 ? 'наклон растёт слева направо — график изгибается вверх, как чаша, и лежит над касательной.' : 'наклон падает — график изгибается вниз, как купол, и лежит под касательной.');
      if (Math.abs(d) < 0.05) msg += ' Здесь f′ ≈ 0, и по знаку f″ видно: ' + (d2 > 0.05 ? '<b>минимум</b>.' : d2 < -0.05 ? '<b>максимум</b>.' : 'тест второй производной молчит (как у x⁴ в нуле).');
      if (s.gap) msg += ' Красные отрезки — зазор между графиком и касательной при Δ = ±0.5; по формуле он ≈ ½·f″·0.25 = ' + f3(0.125 * d2) + '.';
      if (s.fn === 'exp' && Math.abs(x) < 0.01) msg += ' Касательная 1 + x всюду под графиком: eˣ ≥ 1 + x.';
      if (s.fn === 'ln' && Math.abs(x - 1) < 0.01) msg += ' Касательная x − 1 всюду над графиком: ln x ≤ x − 1.';
      if (s.fn === 'logloss') msg += ' У log-loss f″ = p(1 − p) > 0 всюду: функция выпуклая — одна яма без ловушек.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const F = CF[s.fn];
      return PY_HEAD + '\nf = lambda x: ' + F.py[0] + '\nd1 = lambda x: ' + F.py[1] + '\nd2 = lambda x: ' + F.py[2] + '\na = ' + py(s.x) + '\nx = np.linspace(' + F.dom[0] + ', ' + F.dom[1] + ', 400)\ntan = f(a) + d1(a) * (x - a)\nplt.plot(x, f(x), lw=2.4, label="f")\nplt.plot(x, tan, label="касательная")\nplt.plot(x, tan + 0.5 * d2(a) * (x - a) ** 2, "--", label="парабола с f″")\nplt.fill_between(x, plt.ylim()[0], plt.ylim()[1], where=d2(x) > 0, alpha=0.1, label="f″ > 0")\nprint("f″(a) =", d2(a), "→", "чаша" if d2(a) > 0 else "купол")\nplt.legend(); plt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * 5. Точки перегиба: f, f′ и f″ друг под другом
   * ============================================================================== */
  const IF = {
    cub: { label: 'x³ − 3x²', dom: [-1, 3], f: (x) => x ** 3 - 3 * x * x, d: (x) => 3 * x * x - 6 * x, d2: (x) => 6 * x - 6, py: ['x**3 - 3 * x**2', '3 * x**2 - 6 * x', '6 * x - 6'], txt: 'Перегиб в x = 1: f″ = 6x − 6 меняет знак, а наклон f′ там минимален (−3) — график падает круче всего.' },
    sig: { label: 'σ(F) — сигмоида', dom: [-6, 6], f: sigma, d: (x) => sigma(x) * (1 - sigma(x)), d2: (x) => sigma(x) * (1 - sigma(x)) * (1 - 2 * sigma(x)), py: ['1 / (1 + np.exp(-x))', 'f(x) * (1 - f(x))', 'f(x) * (1 - f(x)) * (1 - 2 * f(x))'], txt: 'Перегиб в F = 0: наклон σ′ максимален и равен ¼. Логит сильнее всего двигает вероятность там, где модель не уверена.' },
    trip: { label: 'путь поездки 3t² − t³/5', dom: [0, 10], f: (t) => 3 * t * t - t ** 3 / 5, d: (t) => 6 * t - 0.6 * t * t, d2: (t) => 6 - 1.2 * t, py: ['3 * x**2 - x**3 / 5', '6 * x - 0.6 * x**2', '6 - 1.2 * x'], txt: 'Перегиб в t = 5 с: разгон сменяется торможением, скорость максимальна.' },
    xex: { label: 'x·e^(−x)', dom: [-0.5, 7], f: (x) => x * Math.exp(-x), d: (x) => (1 - x) * Math.exp(-x), d2: (x) => (x - 2) * Math.exp(-x), py: ['x * np.exp(-x)', '(1 - x) * np.exp(-x)', '(x - 2) * np.exp(-x)'], txt: 'Максимум в x = 1, перегиб в x = 2: там убывание быстрее всего (f′ минимальна).' },
    bell: { label: 'колокол e^(−x²/2)', dom: [-3.5, 3.5], f: (x) => Math.exp(-x * x / 2), d: (x) => -x * Math.exp(-x * x / 2), d2: (x) => (x * x - 1) * Math.exp(-x * x / 2), py: ['np.exp(-x**2 / 2)', '-x * np.exp(-x**2 / 2)', '(x**2 - 1) * np.exp(-x**2 / 2)'], txt: 'Два перегиба: x = ±1 — ровно одно стандартное отклонение от центра нормального распределения.' },
    x4: { label: 'x⁴ — ложный кандидат', dom: [-1.5, 1.5], f: (x) => x ** 4, d: (x) => 4 * x ** 3, d2: (x) => 12 * x * x, py: ['x**4', '4 * x**3', '12 * x**2'], txt: 'f″(0) = 0, но f″ ≥ 0 с обеих сторон: знак не меняется, перегиба нет. В нуле — минимум.' },
    cbrt: { label: '∛x — перегиб без f″', dom: [-2, 2], f: Math.cbrt, d: (x) => (x === 0 ? Infinity : 1 / (3 * Math.cbrt(x * x))), d2: (x) => (x === 0 ? NaN : -2 / (9 * Math.cbrt(x ** 5))), py: ['np.cbrt(x)', '1 / (3 * np.cbrt(x**2))', '-2 / (9 * np.cbrt(x**5))'], txt: 'В нуле f″ не существует (касательная вертикальна), но знак f″ меняется: слева чаша, справа купол — перегиб есть.' },
  };
  GBC.widget('inflection', (el) => {
    const s = { fn: 'cub', x: 0 };
    const w = ui.shell(el, { title: 'Перегиб: где f″ меняет знак', sub: 'Три графика друг под другом: f, f′ и f″. Пунктиры — кандидаты (f″ = 0 или не существует). Перегиб — там, где f″ действительно меняет знак; там же наклон f′ достигает экстремума.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(IF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.x = IF[v].dom[0] + (IF[v].dom[1] - IF[v].dom[0]) * 0.25), draw()) });
    const mk = (h, label) => new GBC.Plot(w.main, { height: h, margin: { left: 54 }, x: { label: 'x' }, y: { label } });
    const p1 = mk(220, 'f(x)');
    const p2 = mk(160, 'наклон f′');
    const p3 = mk(160, 'изгиб f″');
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'x' }, { key: 'd', label: 'f′(x)' }, { key: 'd2', label: 'f″(x)' }, { key: 'c', label: 'перегибы' }]);
    function candidates(F) {
      const r = roots(F.d2, F.dom[0], F.dom[1]);
      if (s.fn === 'cbrt' || s.fn === 'x4') return [0];
      return r;
    }
    function draw() {
      const F = IF[s.fn];
      const x = U.clamp(s.x, F.dom[0], F.dom[1]);
      const grid = U.linspace(F.dom[0], F.dom[1], 501);
      const cand = candidates(F);
      const eps = (F.dom[1] - F.dom[0]) * 0.01;
      const real = cand.filter((c) => F.d2(c - eps) * F.d2(c + eps) < 0);
      const vl = cand.map((c) => ({ type: 'vline', x: c, color: real.includes(c) ? 'tree' : 'muted', dash: '4 4', width: 1.2 }));
      const drag = (i, nx) => ((s.x = Math.round(U.clamp(nx, F.dom[0], F.dom[1]) * 100) / 100), draw());
      const tan = (t) => F.f(x) + F.d(x) * (t - x);
      const finD = Number.isFinite(F.d(x));
      p1.render([
        ...signBands(F.d2, F.dom[0], F.dom[1]),
        ...vl,
        { type: 'line', x: grid, y: grid.map(F.f), color: 'model', width: 2.4, hover: false },
        finD ? { type: 'line', x: grid, y: grid.map(tan), color: 'tree', width: 1.4, dash: '5 3', hover: false } : null,
        { type: 'points', x: real, y: real.map(F.f), color: 'tree', r: 6, hollow: true },
        { type: 'points', x: [x], y: [F.f(x)], color: 'ink', r: 6, draggable: true, onDrag: drag },
      ], { x: F.dom, y: yRange(F.f, grid, 0.15) });
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        ...vl,
        { type: 'line', x: grid, y: grid.map(F.d), color: 'tree', width: 2.2, hover: false },
        { type: 'points', x: real.filter((c) => Number.isFinite(F.d(c))), y: real.filter((c) => Number.isFinite(F.d(c))).map(F.d), color: 'tree', r: 6, hollow: true },
        finD ? { type: 'points', x: [x], y: [F.d(x)], color: 'ink', r: 5 } : null,
      ], { x: F.dom, y: yRange(F.d, grid, 0.15, 6) });
      p3.render([
        ...signBands(F.d2, F.dom[0], F.dom[1]),
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        ...vl,
        { type: 'line', x: grid, y: grid.map(F.d2), color: 'violet', width: 2.2, hover: false },
        Number.isFinite(F.d2(x)) ? { type: 'points', x: [x], y: [F.d2(x)], color: 'ink', r: 5 } : null,
      ], { x: F.dom, y: yRange(F.d2, grid, 0.15, 6) });
      st.set('x', f2(x));
      st.set('d', finD ? f3(F.d(x)) : '∞');
      st.set('d2', Number.isFinite(F.d2(x)) ? f3(F.d2(x)) : 'нет');
      st.set('c', real.length ? real.map(f2).join('; ') : 'нет');
      note.innerHTML = F.txt + ' Пунктир на верхнем графике — касательная в выбранной точке: подведите точку к перегибу, и касательная начнёт <b>пересекать</b> график.';
    }
    w.pythonAction(() => {
      const F = IF[s.fn];
      return PY_HEAD + '\nf = lambda x: ' + F.py[0] + '\nd1 = lambda x: ' + F.py[1] + '\nd2 = lambda x: ' + F.py[2] + '\nx = np.linspace(' + F.dom[0] + ', ' + F.dom[1] + ', 2001)\nwith np.errstate(all="ignore"):\n    s2 = np.sign(d2(x))\nflip = np.where(s2[:-1] * s2[1:] < 0)[0]\nprint("f″ меняет знак около x =", np.round((x[flip] + x[flip + 1]) / 2, 3))\nfig, axes = plt.subplots(3, 1, figsize=(7, 7), sharex=True)\nfor ax, fn, name in zip(axes, [f, d1, d2], ["f", "f′", "f″"]):\n    with np.errstate(all="ignore"):\n        ax.plot(x, fn(x), lw=2.2)\n    ax.axhline(0, color="gray", lw=0.8); ax.set_ylabel(name)\nplt.tight_layout(); plt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * 6. Тест второй производной: все критические точки функции
   * ============================================================================== */
  const YM = [2, 4, 3, 7, 9, 11];
  const T2 = {
    cubic: { label: 'x³/3 − x', dom: [-2.6, 2.6], f: (x) => x ** 3 / 3 - x, d: (x) => x * x - 1, d2: (x) => 2 * x, py: ['x**3 / 3 - x', 'x**2 - 1', '2 * x'] },
    xex: { label: 'x·e^(−x)', dom: [-0.6, 6], f: (x) => x * Math.exp(-x), d: (x) => (1 - x) * Math.exp(-x), d2: (x) => (x - 2) * Math.exp(-x), py: ['x * np.exp(-x)', '(1 - x) * np.exp(-x)', '(x - 2) * np.exp(-x)'] },
    inv: { label: 'x + 1/x при x > 0', dom: [0.2, 4], f: (x) => x + 1 / x, d: (x) => 1 - 1 / (x * x), d2: (x) => 2 / x ** 3, py: ['x + 1 / x', '1 - 1 / x**2', '2 / x**3'] },
    q: { label: 'x⁴ − 4x³', dom: [-1.5, 4.2], f: (x) => x ** 4 - 4 * x ** 3, d: (x) => 4 * x ** 3 - 12 * x * x, d2: (x) => 12 * x * x - 24 * x, py: ['x**4 - 4 * x**3', '4 * x**3 - 12 * x**2', '12 * x**2 - 24 * x'] },
    sin: { label: 'sin x + x/2', dom: [-6, 6], f: (x) => Math.sin(x) + x / 2, d: (x) => Math.cos(x) + 0.5, d2: (x) => -Math.sin(x), py: ['np.sin(x) + x / 2', 'np.cos(x) + 0.5', '-np.sin(x)'] },
    mse: { label: 'MSE константы: Σ(yᵢ − c)², y = 2, 4, 3, 7, 9, 11', dom: [0, 12], f: (c) => YM.reduce((a, y) => a + (y - c) ** 2, 0), d: (c) => YM.reduce((a, y) => a - 2 * (y - c), 0), d2: () => 12, py: ['((y[:, None] - x) ** 2).sum(axis=0)', '(-2 * (y[:, None] - x)).sum(axis=0)', '2 * len(y) + 0 * x'] },
  };
  GBC.widget('second-test', (el) => {
    const s = { fn: 'cubic', sel: 0 };
    const w = ui.shell(el, { title: 'Тест второй производной', sub: 'Найдены все точки, где f′ = 0. Для выбранной точки пунктиром показана парабола f(a) + ½·f″(a)·Δ² — то, как функция выглядит вблизи. Бирюзовые — минимумы, фиолетовые — максимумы, серые — тест молчит.', foot: false });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(T2).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.sel = 0), draw()) });
    const pickBox = H('div', { class: 'ctl' }, H('span', { class: 'ctl-label' }, 'Критическая точка'));
    const pickBtns = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
    pickBox.appendChild(pickBtns);
    w.controls.appendChild(pickBox);
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const kind = (v) => (Math.abs(v) < 1e-7 ? 0 : Math.sign(v));
    function draw() {
      const F = T2[s.fn];
      const crit = roots(F.d, F.dom[0], F.dom[1]);
      s.sel = U.clamp(s.sel, 0, Math.max(0, crit.length - 1));
      pickBtns.textContent = '';
      crit.forEach((c, i) => {
        const b = ui.button(pickBtns, { label: 'x = ' + f2(c), small: true, kind: i === s.sel ? 'primary' : 'ghost', onClick: () => ((s.sel = i), draw()) });
        b.setAttribute('aria-pressed', String(i === s.sel));
      });
      const grid = U.linspace(F.dom[0], F.dom[1], 501);
      const yr = yRange(F.f, grid, 0.15);
      const col = (c) => (kind(F.d2(c)) > 0 ? 'aqua' : kind(F.d2(c)) < 0 ? 'violet' : 'muted');
      const a = crit[s.sel];
      const span = (F.dom[1] - F.dom[0]) * 0.18;
      const win = a !== undefined ? U.linspace(a - span, a + span, 100) : [];
      plot.render([
        { type: 'line', x: grid, y: grid.map(F.f), color: 'model', width: 2.4, hover: false },
        a !== undefined ? { type: 'line', x: win, y: win.map((t) => F.f(a) + 0.5 * F.d2(a) * (t - a) ** 2), color: col(a), width: 2.2, dash: '6 4', hover: false } : null,
        { type: 'points', x: crit, y: crit.map(F.f), color: (i) => col(crit[i]), r: (i) => (i === s.sel ? 8 : 6), tooltip: (i) => [['x', f3(crit[i])], ['f', f3(F.f(crit[i]))], ['f″', f3(F.d2(crit[i]))]] },
      ], { x: F.dom, y: yr });
      const rows = crit.map((c) => {
        const k = kind(F.d2(c));
        return [f3(c), f3(F.f(c)), f3(F.d2(c)), k > 0 ? 'минимум' : k < 0 ? 'максимум' : 'тест молчит'];
      });
      rowTable(tbl, ['x: f′(x) = 0', 'f(x)', 'f″(x)', 'вывод'], rows, (i) => i === s.sel);
      const M = {
        cubic: 'Две критические точки: x = −1 (f″ = −2, максимум 2/3) и x = 1 (f″ = 2, минимум −2/3). Это локальные экстремумы: при x → ±∞ функция уходит в ±∞.',
        xex: 'Одна критическая точка x = 1: f″ = −1/e &lt; 0 — максимум f = 1/e ≈ 0.368.',
        inv: 'x = 1: f″ = 2 &gt; 0 — минимум f = 2. Отсюда x + 1/x ≥ 2 при x &gt; 0; а раз f″ &gt; 0 всюду, этот минимум глобальный.',
        q: 'x = 3: f″ = 36 — минимум −27. x = 0: f″ = 0, тест молчит; это терраса (шаг 7).',
        sin: 'cos x = −½: чередуются максимумы (sin x &gt; 0 → f″ &lt; 0) и минимумы. Локальных экстремумов много, глобальных нет — функция не выпукла.',
        mse: 'Единственная критическая точка c = ȳ = 6, f″ = 2n = 12 &gt; 0 — минимум. Лучшая константа для MSE — среднее.',
      };
      note.innerHTML = crit.length ? M[s.fn] : 'Критических точек на этом отрезке нет.';
    }
    w.pythonAction(() => {
      const F = T2[s.fn];
      const pre = s.fn === 'mse' ? 'y = np.array([2, 4, 3, 7, 9, 11], dtype=float)\n' : '';
      return 'import numpy as np\n\n' + pre + 'f = lambda x: ' + F.py[0] + '\nd1 = lambda x: ' + F.py[1] + '\nd2 = lambda x: ' + F.py[2] + '\nx = np.linspace(' + F.dom[0] + ', ' + F.dom[1] + ', 20001)\ng = d1(x)\nidx = np.where(np.sign(g[:-1]) * np.sign(g[1:]) <= 0)[0]\nfor i in idx:\n    a = x[i] - g[i] * (x[i + 1] - x[i]) / (g[i + 1] - g[i])   # линейная интерполяция корня f′\n    k = d2(np.array([a]))[0]\n    print(f"x = {a:.4f}: f = {f(np.array([a]))[0]:.4f}, f″ = {k:+.4f} →", "минимум" if k > 1e-7 else "максимум" if k < -1e-7 else "тест молчит")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 7. Высшие производные: первая ненулевая решает
   * ============================================================================== */
  const HT = {
    pow: { label: 'xⁿ в точке 0 (выберите n и знак)' },
    q0: { label: 'x⁴ − 4x³ в точке 0', f: (x) => x ** 4 - 4 * x ** 3, a: 0, ders: [0, 0, -24, 24, 0, 0], dom: [-1, 1.6], py: 'x**4 - 4 * x**3' },
    q3: { label: 'x⁴ − 4x³ в точке 3', f: (x) => x ** 4 - 4 * x ** 3, a: 3, ders: [0, 36, 48, 24, 0, 0], dom: [1.5, 4], py: 'x**4 - 4 * x**3' },
    cos: { label: 'cos x − 1 + x²/2 в точке 0', f: (x) => Math.cos(x) - 1 + x * x / 2, a: 0, ders: [0, 0, 0, 1, 0, -1], dom: [-2, 2], py: 'np.cos(x) - 1 + x**2 / 2' },
    sinx: { label: 'sin x − x в точке 0', f: (x) => Math.sin(x) - x, a: 0, ders: [0, 0, -1, 0, 1, 0], dom: [-2, 2], py: 'np.sin(x) - x' },
    x3x4: { label: 'x³ + x⁴ в точке 0', f: (x) => x ** 3 + x ** 4, a: 0, ders: [0, 0, 6, 24, 0, 0], dom: [-1.2, 0.8], py: 'x**3 + x**4' },
  };
  GBC.widget('higher-test', (el) => {
    const s = { fn: 'pow', n: 4, sg: 1 };
    const w = ui.shell(el, { title: 'Когда f″ = 0: первая ненулевая производная', sub: 'Таблица — производные в точке a, начиная с первой. Первая ненулевая (подсвечена) решает: чётный порядок — экстремум, нечётный — экстремума нет (терраса).', foot: false });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(HT).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), draw()) });
    const ns = ui.slider(w.controls, { label: 'Степень n для xⁿ', min: 2, max: 7, step: 1, value: s.n, format: (v) => String(v), onInput: (v) => ((s.n = v), draw()) });
    const sgs = ui.segmented(w.controls, { label: 'Знак', value: s.sg, options: [{ value: 1, label: '+xⁿ' }, { value: -1, label: '−xⁿ' }], onChange: (v) => ((s.sg = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'x' }, y: { label: 'f(x)' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function spec() {
      if (s.fn !== 'pow') return HT[s.fn];
      const n = s.n;
      const sg = s.sg;
      const ders = [1, 2, 3, 4, 5, 6].map((k) => (k === n ? sg * fact(n) : 0));
      return { f: (x) => sg * x ** n, a: 0, ders, dom: [-1.3, 1.3], py: (sg < 0 ? '-' : '') + 'x**' + n };
    }
    function draw() {
      const P = spec();
      ns.el.style.display = s.fn === 'pow' ? '' : 'none';
      sgs.el.style.display = s.fn === 'pow' ? '' : 'none';
      const m = P.ders.findIndex((v) => Math.abs(v) > 1e-12) + 1;
      const dm = P.ders[m - 1];
      const grid = U.linspace(P.dom[0], P.dom[1], 401);
      const yr = yRange(P.f, grid, 0.15);
      const fa = P.f(P.a);
      const approx = (x) => fa + (dm / fact(m)) * (x - P.a) ** m;
      plot.render([
        { type: 'hline', y: fa, color: 'muted', width: 1, dash: '3 3' },
        { type: 'line', x: grid, y: grid.map(P.f), color: 'model', width: 2.6, label: 'f(x)', hover: false },
        { type: 'line', x: grid, y: grid.map(approx), color: 'violet', width: 2, dash: '6 4', label: 'f(a) + f⁽ᵐ⁾(a)·Δᵐ/m!', hover: false },
        { type: 'points', x: [P.a], y: [fa], color: 'tree', r: 7 },
      ], { x: P.dom, y: yr });
      rowTable(tbl, ['k', ...P.ders.map((v, i) => String(i + 1))], [['f⁽ᵏ⁾(a)', ...P.ders.map((v) => U.fmt(v, 3))]], () => false);
      const cells = tbl.querySelectorAll('tbody td');
      if (cells[m]) cells[m].style.cssText = 'background:var(--accent-soft, rgba(80,140,255,.15));font-weight:700';
      const even = m % 2 === 0;
      const verdict = even ? (dm > 0 ? '<b>минимум</b>' : '<b>максимум</b>') : '<b>экстремума нет</b> — терраса (перегиб с горизонтальной касательной)';
      let msg = 'Первая ненулевая производная — порядка m = ' + m + ' (' + dname(m) + '(a) = ' + U.fmt(dm, 3) + '). m ' + (even ? 'чётное' : 'нечётное') + ' → ' + verdict + '. Пунктир — главный член f(a) + f⁽ᵐ⁾(a)·Δᵐ/m!: около точки функция ведёт себя как он.';
      if (s.fn === 'cos') msg += ' Отсюда cos x ≥ 1 − x²/2 (минимум глобальный, потому что f″ = 1 − cos x ≥ 0).';
      if (s.fn === 'sinx') msg += ' Главный член −x³/6 — вот откуда предел (sin x − x)/x³ → −1/6.';
      if (s.fn === 'x3x4') msg += ' Член x⁴ меньше по порядку: около нуля решает x³, поэтому экстремума нет, хотя дальше от нуля у функции есть минимум.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const P = spec();
      return 'import numpy as np\n\nf = lambda x: ' + P.py + '\na = ' + P.a + '\n# производные в точке a (вычислены вручную): ' + P.ders.map((v) => U.pyNum(v)).join(', ') + '\nfor d in [0.1, 0.01, 0.001]:\n    left, right = f(a - d) - f(a), f(a + d) - f(a)\n    print(f"Δ = ±{d}: f(a − Δ) − f(a) = {left:+.3e}, f(a + Δ) − f(a) = {right:+.3e}")\nprint("одинаковые знаки → экстремум, разные → терраса")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 8. Полное исследование функции: таблица знаков f′ и f″
   * ============================================================================== */
  const STU = {
    cub: { label: 'x³ − 6x² + 9x', dom: [-0.6, 4.4], f: (x) => x ** 3 - 6 * x * x + 9 * x, d: (x) => 3 * x * x - 12 * x + 9, d2: (x) => 6 * x - 12, py: ['x**3 - 6 * x**2 + 9 * x', '3 * x**2 - 12 * x + 9', '6 * x - 12'] },
    xex: { label: 'x·e^(−x)', dom: [-0.6, 6], f: (x) => x * Math.exp(-x), d: (x) => (1 - x) * Math.exp(-x), d2: (x) => (x - 2) * Math.exp(-x), py: ['x * np.exp(-x)', '(1 - x) * np.exp(-x)', '(x - 2) * np.exp(-x)'] },
    bell: { label: 'e^(−x²/2)', dom: [-3.5, 3.5], f: (x) => Math.exp(-x * x / 2), d: (x) => -x * Math.exp(-x * x / 2), d2: (x) => (x * x - 1) * Math.exp(-x * x / 2), py: ['np.exp(-x**2 / 2)', '-x * np.exp(-x**2 / 2)', '(x**2 - 1) * np.exp(-x**2 / 2)'] },
    q: { label: 'x⁴ − 4x³', dom: [-1.2, 4.2], f: (x) => x ** 4 - 4 * x ** 3, d: (x) => 4 * x ** 3 - 12 * x * x, d2: (x) => 12 * x * x - 24 * x, py: ['x**4 - 4 * x**3', '4 * x**3 - 12 * x**2', '12 * x**2 - 24 * x'] },
    rat: { label: 'x / (1 + x²)', dom: [-5, 5], f: (x) => x / (1 + x * x), d: (x) => (1 - x * x) / (1 + x * x) ** 2, d2: (x) => (2 * x * (x * x - 3)) / (1 + x * x) ** 3, py: ['x / (1 + x**2)', '(1 - x**2) / (1 + x**2)**2', '2 * x * (x**2 - 3) / (1 + x**2)**3'] },
  };
  const SHAPE = { '1,1': '↗∪', '1,-1': '↗∩', '-1,1': '↘∪', '-1,-1': '↘∩' };
  GBC.widget('study-chart', (el) => {
    const s = { fn: 'cub' };
    const w = ui.shell(el, { title: 'Исследование функции: таблица знаков', sub: 'Нули f′ и f″ делят ось на промежутки. На каждом знаки f′ и f″ постоянны и дают одну из четырёх форм: ↗∪, ↗∩, ↘∪, ↘∩. Цвет кусков графика — бирюзовый для чаши, фиолетовый для купола.', foot: false });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(STU).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const F = STU[s.fn];
      const r1 = roots(F.d, F.dom[0], F.dom[1]);
      const r2 = roots(F.d2, F.dom[0], F.dom[1]);
      const cuts = [...new Set([...r1, ...r2].map((v) => Number(v.toFixed(6))))].sort((a, b) => a - b);
      const bounds = [F.dom[0], ...cuts, F.dom[1]];
      const layers = [];
      const rows = [];
      for (let i = 0; i < bounds.length - 1; i++) {
        const a = bounds[i];
        const b = bounds[i + 1];
        if (b - a < 1e-9) continue;
        const m = (a + b) / 2;
        const s1 = Math.sign(F.d(m));
        const s2 = Math.sign(F.d2(m));
        const xs = U.linspace(a, b, 80);
        layers.push({ type: 'line', x: xs, y: xs.map(F.f), color: s2 > 0 ? 'aqua' : 'violet', width: 3, hover: false });
        rows.push([(i === 0 ? '(…' : '(' + f2(a)) + '; ' + (i === bounds.length - 2 ? '…)' : f2(b) + ')'), s1 > 0 ? '+' : '−', s2 > 0 ? '+' : '−', SHAPE[s1 + ',' + s2]]);
      }
      const ext = r1.map((c) => ({ c, k: Math.sign(F.d(c - 1e-3)) !== Math.sign(F.d(c + 1e-3)) }));
      const infl = r2.filter((c) => F.d2(c - 1e-3) * F.d2(c + 1e-3) < 0);
      const grid = U.linspace(F.dom[0], F.dom[1], 400);
      plot.render([
        ...layers,
        { type: 'points', x: ext.filter((e) => e.k).map((e) => e.c), y: ext.filter((e) => e.k).map((e) => F.f(e.c)), color: 'tree', r: 6, label: 'экстремум', tooltip: (i) => { const c = ext.filter((e) => e.k)[i].c; return [['x', f3(c)], ['f', f3(F.f(c))]]; } },
        { type: 'points', x: infl, y: infl.map(F.f), color: 'ink', r: 5, hollow: true, label: 'перегиб', tooltip: (i) => [['x', f3(infl[i])], ['f', f3(F.f(infl[i]))]] },
      ], { x: F.dom, y: yRange(F.f, grid, 0.15) });
      rowTable(tbl, ['промежуток', 'знак f′', 'знак f″', 'форма'], rows, null, false);
      const M = {
        cub: 'Максимум (1; 4), минимум (3; 0), перегиб (2; 2) — посередине между экстремумами, как у любой кубической параболы.',
        xex: 'Рост до 1, максимум 1/e, затем убывание; купол до 2, перегиб (2; 0.271), дальше чаша — график прижимается к нулю.',
        bell: 'Максимум в 0, перегибы в ±1: купол в середине, чаша по краям. Это плотность нормального распределения (без множителя).',
        q: 'Убывание до 3 (в нуле — терраса: f′ = 0, но знак не меняется), минимум (3; −27). Перегибы в 0 и 2.',
        rat: 'Нечётная функция: максимум (1; ½), минимум (−1; −½), три перегиба: 0 и ±√3 ≈ ±1.73. На краях график прижимается к нулю.',
      };
      note.innerHTML = M[s.fn];
    }
    w.pythonAction(() => {
      const F = STU[s.fn];
      return PY_HEAD + '\nf = lambda x: ' + F.py[0] + '\nd1 = lambda x: ' + F.py[1] + '\nd2 = lambda x: ' + F.py[2] + '\nx = np.linspace(' + F.dom[0] + ', ' + F.dom[1] + ', 4001)\ncuts = []\nfor fn in (d1, d2):\n    v = fn(x)\n    i = np.where(np.sign(v[:-1]) * np.sign(v[1:]) <= 0)[0]\n    cuts += list(x[i])\nbounds = [x[0], *sorted(set(np.round(cuts, 4))), x[-1]]\nfor a, b in zip(bounds[:-1], bounds[1:]):\n    m = (a + b) / 2\n    print(f"({a:6.2f}; {b:6.2f}):", "↗" if d1(m) > 0 else "↘", "∪" if d2(m) > 0 else "∩")\nv2 = d2(x)\ninfl = x[1:][np.sign(v2[1:]) * np.sign(v2[:-1]) < 0]\nplt.plot(x, f(x), lw=2.4)\nplt.scatter(infl, f(infl), zorder=3, label="перегибы")\nplt.legend(); plt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * 9. Тренажёр-чтение: какая кривая f, какая f′, какая f″
   * ============================================================================== */
  const GM = [
    { t: 'x³ − 3x', py: ['x**3 - 3 * x', '3 * x**2 - 3', '6 * x'],  dom: [-2.3, 2.3], d: [(x) => x ** 3 - 3 * x, (x) => 3 * x * x - 3, (x) => 6 * x] },
    { t: 'sin x', py: ['np.sin(x)', 'np.cos(x)', '-np.sin(x)'],  dom: [-3.5, 3.5], d: [Math.sin, Math.cos, (x) => -Math.sin(x)] },
    { t: 'x·e^(−x)', py: ['x * np.exp(-x)', '(1 - x) * np.exp(-x)', '(x - 2) * np.exp(-x)'],  dom: [-0.5, 6], d: [(x) => x * Math.exp(-x), (x) => (1 - x) * Math.exp(-x), (x) => (x - 2) * Math.exp(-x)] },
    { t: 'e^(−x²/2)', py: ['np.exp(-x**2 / 2)', '-x * np.exp(-x**2 / 2)', '(x**2 - 1) * np.exp(-x**2 / 2)'],  dom: [-3.5, 3.5], d: [(x) => Math.exp(-x * x / 2), (x) => -x * Math.exp(-x * x / 2), (x) => (x * x - 1) * Math.exp(-x * x / 2)] },
    { t: 'x⁴ − 2x²', py: ['x**4 - 2 * x**2', '4 * x**3 - 4 * x', '12 * x**2 - 4'],  dom: [-1.6, 1.6], d: [(x) => x ** 4 - 2 * x * x, (x) => 4 * x ** 3 - 4 * x, (x) => 12 * x * x - 4] },
    { t: 'σ(x)', py: ['1 / (1 + np.exp(-x))', 'np.exp(-x) / (1 + np.exp(-x))**2', 'np.exp(-x) * (np.exp(-x) - 1) / (1 + np.exp(-x))**3'],  dom: [-6, 6], d: [sigma, (x) => sigma(x) * (1 - sigma(x)), (x) => sigma(x) * (1 - sigma(x)) * (1 - 2 * sigma(x))] },
    { t: 'x³/3 − x²', py: ['x**3 / 3 - x**2', 'x**2 - 2 * x', '2 * x - 2'],  dom: [-1.5, 3.5], d: [(x) => x ** 3 / 3 - x * x, (x) => x * x - 2 * x, (x) => 2 * x - 2] },
    { t: 'ln(1 + x²)', py: ['np.log1p(x**2)', '2 * x / (1 + x**2)', '2 * (1 - x**2) / (1 + x**2)**2'],  dom: [-3, 3], d: [(x) => Math.log1p(x * x), (x) => (2 * x) / (1 + x * x), (x) => (2 * (1 - x * x)) / (1 + x * x) ** 2] },
  ];
  GBC.widget('graph-match', (el) => {
    const s = { seed: 7, round: 0, right: 0, streak: 0, q: null, stage: 0, pickF: null, done: false };
    const NAMES = ['A', 'B', 'C'];
    const COLS = ['blue', 'orange', 'aqua'];
    const w = ui.shell(el, { title: 'Где f, где f′, где f″?', sub: 'Три кривые — функция и две её производные в случайном порядке (каждая масштабирована по высоте: нули и экстремумы на месте). Сначала найдите f, потом f′.' });
    const qEl = H('div', { class: 'ctl-label', style: 'font-weight:650' });
    w.controls.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;gap:8px' });
    w.controls.appendChild(optsBox);
    const next = ui.button(w.controls, { label: 'Следующая', icon: 'step', onClick: () => newQ() });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'масштабированное значение', domain: [-1.15, 1.15], ticks: [-1, 0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function newQ() {
      const rng = new GBC.RNG(s.seed++);
      const fnI = rng.randint(GM.length);
      const perm = rng.permutation(3); // perm[curve] = порядок производной
      s.q = { G: GM[fnI], perm };
      s.stage = 0;
      s.pickF = null;
      s.done = false;
      s.round++;
      ask();
      draw();
    }
    function ask() {
      const order = s.stage === 0 ? 0 : 1;
      qEl.textContent = s.stage === 0 ? 'Какая кривая — сама функция f?' : 'А какая из оставшихся — f′?';
      const opts = NAMES.map((n, i) => ({ v: i, label: 'Кривая ' + n })).filter((o) => s.stage === 0 || o.v !== s.pickF);
      choiceButtons(optsBox, opts, (v) => pick(v, order));
    }
    function pick(v, order) {
      const ok = s.q.perm[v] === order;
      if (s.stage === 0 && ok) {
        s.pickF = v;
        s.stage = 1;
        ask();
        note.innerHTML = '<b>Верно!</b> Кривая ' + NAMES[v] + ' — это f. Теперь найдите f′: её нули должны стоять под экстремумами f.';
        return;
      }
      s.done = true;
      if (ok) (s.right++, s.streak++);
      else s.streak = 0;
      [...optsBox.querySelectorAll('button')].forEach((b) => (b.disabled = true));
      draw(ok);
    }
    function draw(ok) {
      const { G, perm } = s.q;
      const grid = U.linspace(G.dom[0], G.dom[1], 400);
      const layers = [{ type: 'hline', y: 0, color: 'axis', width: 1 }];
      for (let c = 0; c < 3; c++) {
        const fn = G.d[perm[c]];
        const m = Math.max(...grid.map((x) => Math.abs(fn(x))));
        const label = s.done ? 'кривая ' + NAMES[c] + ' = ' + dname(perm[c]) : 'кривая ' + NAMES[c];
        layers.push({ type: 'line', x: grid, y: grid.map((x) => fn(x) / m), color: COLS[c], width: 2.4, label, hover: false });
      }
      plot.render(layers, { x: G.dom });
      st.set('r', String(s.round));
      st.set('ok', s.right + ' из ' + (s.round - (s.done ? 0 : 1)));
      st.set('s', String(s.streak));
      if (s.done) {
        const fI = perm.indexOf(0);
        const dI = perm.indexOf(1);
        const d2I = perm.indexOf(2);
        note.innerHTML = (ok ? '<b>Верно!</b> ' : '<b>Не совсем.</b> ') + 'Функция ' + G.t + ': f — кривая ' + NAMES[fI] + ', f′ — ' + NAMES[dI] + ', f″ — ' + NAMES[d2I] + '. Проверка: нули кривой ' + NAMES[dI] + ' стоят под экстремумами ' + NAMES[fI] + ', а нули ' + NAMES[d2I] + ' — под экстремумами ' + NAMES[dI] + ' (перегибами f).';
      } else if (s.stage === 0) note.innerHTML = 'Подсказка: нули производной стоят под экстремумами функции. Составьте цепочку «экстремумы одной кривой → нули другой»: f — её начало (экстремумы f отмечены нулями f′), f″ — конец (её экстремумы ничем не отмечены).';
      next.textContent = '';
      next.append(ui.icon('step'), s.done ? 'Следующая' : 'Пропустить');
    }
    w.pythonAction(() => {
      const G = s.q.G;
      return PY_HEAD + '\n# ' + G.t + ' и её производные; каждая кривая масштабирована по высоте\nx = np.linspace(' + G.dom[0] + ', ' + G.dom[1] + ', 400)\ncurves = {"f": ' + G.py[0] + ', "f′": ' + G.py[1] + ', "f″": ' + G.py[2] + '}\nfor name, y in curves.items():\n    plt.plot(x, y / np.abs(y).max(), lw=2.2, label=name)\n# правило: нули f′ стоят под экстремумами f\nd1 = curves["f′"]\nzeros = x[1:][np.sign(d1[1:]) != np.sign(d1[:-1])]\nprint("нули f′:", np.round(zeros, 3))\nplt.axhline(0, color="gray", lw=0.8); plt.legend(); plt.show()\n';
    });
    newQ();
  });

  /* ==============================================================================
   * 10. Выпуклость: хорда над графиком, точка t на хорде, поиск контрпримера
   * ============================================================================== */
  const VX = {
    sq: { label: 'x² — выпуклая', f: (x) => x * x, dom: [-2, 2], py: 'x**2' },
    abs: { label: '|x| — выпуклая (с изломом)', f: Math.abs, dom: [-2, 2], py: 'np.abs(x)' },
    exp: { label: 'eˣ — выпуклая', f: Math.exp, dom: [-2, 2], py: 'np.exp(x)' },
    ll: { label: 'ln(1 + e⁻ˣ) — выпуклая', f: (x) => softplus(-x), dom: [-4, 4], py: 'np.log1p(np.exp(-x))' },
    relu: { label: 'max(0, x) — выпуклая (ReLU)', f: (x) => Math.max(0, x), dom: [-2, 2], py: 'np.maximum(0, x)' },
    w: { label: 'x⁴ − 2x² — НЕ выпуклая', f: (x) => x ** 4 - 2 * x * x, dom: [-1.7, 1.7], py: 'x**4 - 2 * x**2' },
    cube: { label: 'x³ — НЕ выпуклая на всей прямой', f: (x) => x ** 3, dom: [-2, 1.5], py: 'x**3' },
    sin: { label: 'sin x — НЕ выпуклая', f: Math.sin, dom: [-3.5, 3.5], py: 'np.sin(x)' },
  };
  GBC.widget('convex-chord', (el) => {
    const s = { fn: 'w', a: -1.4, b: 1.2, t: 0.5 };
    const w = ui.shell(el, { title: 'Выпуклость: хорда над графиком', sub: 'Функция выпуклая, если хорда между любыми двумя точками графика лежит не ниже графика. Тяните концы хорды, двигайте t и ищите контрпример — или поручите поиск кнопке.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(VX).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.a = Number((VX[v].dom[0] * 0.8).toFixed(2))), (s.b = Number((VX[v].dom[1] * 0.7).toFixed(2))), draw()) });
    ui.slider(w.controls, { label: 'Доля t (точка t·x₁ + (1 − t)·x₂)', min: 0, max: 1, step: 0.01, value: s.t, onInput: (v) => ((s.t = v), draw()) });
    ui.button(w.controls, { label: 'Искать контрпример', icon: 'step', onClick: () => search() });
    const plot = new GBC.Plot(w.main, { height: 310, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'график f(z)' }, { key: 'c', label: 'хорда' }, { key: 'd', label: 'хорда − график' }]);
    let found = null;
    function search() {
      const F = VX[s.fn];
      const xs = U.linspace(F.dom[0], F.dom[1], 61);
      let best = { v: 1e-9 };
      for (const a of xs) for (const b of xs) {
        if (b <= a) continue;
        const m = (a + b) / 2;
        const v = F.f(m) - (F.f(a) + F.f(b)) / 2;
        if (v > best.v) best = { v, a, b };
      }
      found = best.a !== undefined;
      if (found) (s.a = best.a), (s.b = best.b), (s.t = 0.5);
      draw();
    }
    function draw() {
      const F = VX[s.fn];
      const x1 = s.a;
      const x2 = s.b;
      const lo = Math.min(x1, x2);
      const hi = Math.max(x1, x2);
      const xs = U.linspace(F.dom[0], F.dom[1], 401);
      const inner = U.linspace(lo, hi, 200);
      const chord = (x) => F.f(lo) + ((F.f(hi) - F.f(lo)) * (x - lo)) / (hi - lo || 1);
      const above = inner.map((x) => (F.f(x) > chord(x) + 1e-9 ? F.f(x) : NaN));
      const bad = above.some(Number.isFinite);
      const z = s.t * x1 + (1 - s.t) * x2;
      const cz = s.t * F.f(x1) + (1 - s.t) * F.f(x2);
      const [ylo, yhi] = U.extent(xs.map(F.f));
      plot.render([
        { type: 'line', x: xs, y: xs.map(F.f), color: 'model', width: 2.4, hover: false },
        { type: 'area', x: inner, y0: inner.map(F.f), y1: inner.map((x) => Math.max(F.f(x), chord(x))), color: 'aqua', opacity: 0.18 },
        { type: 'line', x: inner, y: above, color: 'red', width: 3.4, label: 'график выше хорды', hover: false },
        { type: 'line', x: [lo, hi], y: [F.f(lo), F.f(hi)], color: 'tree', width: 2.2, label: 'хорда', hover: false },
        { type: 'segments', x1: [z], y1: [F.f(z)], x2: [z], y2: [cz], color: cz >= F.f(z) - 1e-12 ? 'aqua' : 'red', width: 2.4, opacity: 1 },
        { type: 'points', x: [z, z], y: [F.f(z), cz], color: (i) => (i ? 'tree' : 'model'), r: 5 },
        { type: 'points', x: [x1, x2], y: [F.f(x1), F.f(x2)], color: 'tree', r: 7, draggable: true, onDrag: (i, x) => {
          const xr = Math.round(U.clamp(x, F.dom[0], F.dom[1]) * 50) / 50;
          if (i === 0) s.a = xr;
          else s.b = xr;
          found = null;
          draw();
        } },
      ], { x: F.dom, y: [ylo - (yhi - ylo) * 0.1 - 0.1, yhi + (yhi - ylo) * 0.1 + 0.1] });
      st.set('g', f3(F.f(z)));
      st.set('c', f3(cz));
      st.set('d', f3(cz - F.f(z)));
      const convexFn = !['w', 'cube', 'sin'].includes(s.fn);
      let msg = bad
        ? '<b>Контрпример:</b> красный кусок графика выше хорды — функция не выпуклая. У таких функций бывает несколько ям, и спуск может застрять в неглубокой.'
        : 'Хорда не ниже графика. ' + (convexFn ? 'Как ни двигай концы, так будет всегда: функция <b>выпуклая</b>.' : 'Но это лишь одна пара точек — попробуйте другие!');
      if (found === false) msg = 'Поиск по 1830 парам точек не нашёл контрпримера: хорда всегда над графиком. Функция выпуклая.';
      msg += ' При t = ' + f2(s.t) + ' точка z = ' + f3(z) + ': хорда − график = ' + f3(cz - F.f(z)) + (s.fn === 'sq' ? ' = t(1 − t)(x₁ − x₂)² = ' + f3(s.t * (1 - s.t) * (x1 - x2) ** 2) + '.' : '.');
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const F = VX[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + F.py + '\nrng = np.random.default_rng(0)\nx1, x2 = rng.uniform(' + F.dom[0] + ', ' + F.dom[1] + ', (2, 100_000))\nt = rng.uniform(0, 1, 100_000)\ngap = t * f(x1) + (1 - t) * f(x2) - f(t * x1 + (1 - t) * x2)   # хорда − график\nprint("min(хорда − график) =", gap.min())\nprint("выпуклая" if gap.min() >= -1e-12 else "НЕ выпуклая: нашлась хорда ниже графика")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 11. Три признака выпуклости на одном экране
   * ============================================================================== */
  const CC = {
    expq: { label: 'eˣ + x²', dom: [-2, 1.5], f: (x) => Math.exp(x) + x * x, d: (x) => Math.exp(x) + 2 * x, d2: (x) => Math.exp(x) + 2, py: ['np.exp(x) + x**2', 'np.exp(x) + 2 * x', 'np.exp(x) + 2'] },
    ll: { label: 'log-loss ln(1 + e^(−x))', dom: [-5, 5], f: (x) => softplus(-x), d: (x) => sigma(x) - 1, d2: (x) => sigma(x) * (1 - sigma(x)), py: ['np.log1p(np.exp(-x))', '1 / (1 + np.exp(-x)) - 1', 'np.exp(-x) / (1 + np.exp(-x))**2'] },
    x4: { label: 'x⁴ (строго, хотя f″(0) = 0)', dom: [-1.4, 1.4], f: (x) => x ** 4, d: (x) => 4 * x ** 3, d2: (x) => 12 * x * x, py: ['x**4', '4 * x**3', '12 * x**2'] },
    x4x2: { label: 'x⁴ − x² — НЕ выпуклая', dom: [-1.1, 1.1], f: (x) => x ** 4 - x * x, d: (x) => 4 * x ** 3 - 2 * x, d2: (x) => 12 * x * x - 2, py: ['x**4 - x**2', '4 * x**3 - 2 * x', '12 * x**2 - 2'] },
    cube: { label: 'x³ — НЕ выпуклая', dom: [-1.5, 1.5], f: (x) => x ** 3, d: (x) => 3 * x * x, d2: (x) => 6 * x, py: ['x**3', '3 * x**2', '6 * x'] },
    lnx: { label: 'ln x — вогнутая', dom: [0.2, 4], f: Math.log, d: (x) => 1 / x, d2: (x) => -1 / (x * x), py: ['np.log(x)', '1 / x', '-1 / x**2'] },
  };
  GBC.widget('convex-criteria', (el) => {
    const s = { fn: 'x4x2', a: 0.2 };
    const w = ui.shell(el, { title: 'Три признака выпуклости — один ответ', sub: 'Сверху: касательная в точке a (тяните) и красные участки, где график ниже касательной. В середине: наклон f′ — выпуклость требует, чтобы он не убывал. Снизу: f″ — она не должна быть отрицательной.', foot: false });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(CC).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.a = Number(((CC[v].dom[0] + CC[v].dom[1]) / 2 + 0.2).toFixed(2))), draw()) });
    const verd = H('div', { style: 'display:grid;gap:6px' });
    w.controls.appendChild(verd);
    const p1 = new GBC.Plot(w.main, { height: 220, margin: { left: 54 }, x: { label: 'x' }, y: { label: 'f и касательная' } });
    const p2 = new GBC.Plot(w.main, { height: 150, margin: { left: 54 }, x: { label: 'x' }, y: { label: 'f′' } });
    const p3 = new GBC.Plot(w.main, { height: 150, margin: { left: 54 }, x: { label: 'x' }, y: { label: 'f″' } });
    const note = w.note('', true);
    function draw() {
      const F = CC[s.fn];
      const a = U.clamp(s.a, F.dom[0], F.dom[1]);
      const grid = U.linspace(F.dom[0], F.dom[1], 401);
      const tan = (t) => F.f(a) + F.d(a) * (t - a);
      const below = grid.map((t) => (F.f(t) < tan(t) - 1e-9 ? F.f(t) : NaN));
      const decr = grid.map((t, i) => (i && F.d(t) < F.d(grid[i - 1]) - 1e-12 ? F.d(t) : NaN));
      const neg = grid.map((t) => (F.d2(t) < -1e-12 ? F.d2(t) : NaN));
      p1.render([
        { type: 'line', x: grid, y: grid.map(F.f), color: 'model', width: 2.4, hover: false },
        { type: 'line', x: grid, y: grid.map(tan), color: 'tree', width: 1.6, hover: false },
        { type: 'line', x: grid, y: below, color: 'red', width: 3.4, hover: false },
        { type: 'points', x: [a], y: [F.f(a)], color: 'tree', r: 7, draggable: true, onDrag: (i, nx) => ((s.a = Math.round(U.clamp(nx, F.dom[0], F.dom[1]) * 100) / 100), draw()) },
      ], { x: F.dom, y: yRange(F.f, grid, 0.15) });
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: grid, y: grid.map(F.d), color: 'tree', width: 2.2, hover: false },
        { type: 'line', x: grid, y: decr, color: 'red', width: 3.4, hover: false },
      ], { x: F.dom, y: yRange(F.d, grid, 0.15, 30) });
      p3.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: grid, y: grid.map(F.d2), color: 'violet', width: 2.2, hover: false },
        { type: 'line', x: grid, y: neg, color: 'red', width: 3.4, hover: false },
      ], { x: F.dom, y: yRange(F.d2, grid, 0.15, 30) });
      // глобальные проверки на сетке
      const g = U.linspace(F.dom[0], F.dom[1], 81);
      let chordOk = true;
      for (const x1 of g) for (const x2 of g) {
        if (x2 <= x1) continue;
        if (F.f((x1 + x2) / 2) > (F.f(x1) + F.f(x2)) / 2 + 1e-9) chordOk = false;
      }
      let tanOk = true;
      for (const p of g) for (const q of g) if (F.f(q) < F.f(p) + F.d(p) * (q - p) - 1e-9) tanOk = false;
      const d2Ok = g.every((t) => F.d2(t) >= -1e-12);
      verd.textContent = '';
      [['1. хорда над графиком', chordOk], ['2. касательные под графиком', tanOk], ['3. f″ ≥ 0', d2Ok]].forEach(([t, ok]) => verd.appendChild(H('div', null, badge((ok ? '✓ ' : '✗ ') + t, ok ? 'good' : 'bad'))));
      const T = {
        expq: 'f″ = eˣ + 2 &gt; 0: все три признака выполнены — функция строго выпукла.',
        ll: 'f″ = p(1 − p) &gt; 0 — выпукла. Но в хвостах f″ почти ноль: функция почти прямая, и шаг Ньютона там огромный (шаг 25).',
        x4: 'f″(0) = 0, но нигде не отрицательна — функция выпукла (и даже строго). Касательная в нуле — ось x, график над ней.',
        x4x2: 'f″ = 12x² − 2 &lt; 0 при |x| &lt; 0.41: там наклон убывает, касательная оказывается над графиком — все три признака дружно говорят «нет».',
        cube: 'При x &lt; 0 f″ = 6x &lt; 0: касательные в отрицательных точках идут над графиком. На [0, ∞) функция была бы выпуклой.',
        lnx: 'f″ = −1/x² &lt; 0 всюду: функция вогнутая — каждая касательная над графиком (ln x ≤ x − 1 для касательной в 1).',
      };
      note.innerHTML = T[s.fn] + ' Все три проверки делаются независимо (по 81 точке сетки) — и всегда совпадают: признаки равносильны.';
    }
    w.pythonAction(() => {
      const F = CC[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + F.py[0] + '\nd1 = lambda x: ' + F.py[1] + '\nd2 = lambda x: ' + F.py[2] + '\ng = np.linspace(' + F.dom[0] + ', ' + F.dom[1] + ', 201)\nP, Q = np.meshgrid(g, g)\nchord = np.all(f((P + Q) / 2) <= (f(P) + f(Q)) / 2 + 1e-9)\ntangent = np.all(f(Q) >= f(P) + d1(P) * (Q - P) - 1e-9)\ncurv = np.all(d2(g) >= -1e-12)\nprint("хорда над графиком:", chord, "| касательные под графиком:", tangent, "| f″ ≥ 0:", curv)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 12. Спуск из девяти стартов: выпуклая функция — один финиш
   * ============================================================================== */
  const MS = {
    convex: { label: 'x² + e^(−x) — строго выпуклая', dom: [-2.2, 3], f: (x) => x * x + Math.exp(-x), d: (x) => 2 * x - Math.exp(-x), eta: 0.15, py: ['x**2 + np.exp(-x)', '2 * x - np.exp(-x)'] },
    shelf: { label: '|x − 1| + |x − 3| — полочка', dom: [-1, 5], f: (x) => Math.abs(x - 1) + Math.abs(x - 3), d: (x) => Math.sign(x - 1) + Math.sign(x - 3), eta: 0.05, py: ['np.abs(x - 1) + np.abs(x - 3)', 'np.sign(x - 1) + np.sign(x - 3)'] },
    w: { label: 'x⁴ − 2x² + 0.3x — две ямы', dom: [-1.7, 1.7], f: (x) => x ** 4 - 2 * x * x + 0.3 * x, d: (x) => 4 * x ** 3 - 4 * x + 0.3, eta: 0.05, py: ['x**4 - 2 * x**2 + 0.3 * x', '4 * x**3 - 4 * x + 0.3'] },
    wavy: { label: 'x²/8 + sin(3x) — много ям', dom: [-4, 4], f: (x) => x * x / 8 + Math.sin(3 * x), d: (x) => x / 4 + 3 * Math.cos(3 * x), eta: 0.04, py: ['x**2 / 8 + np.sin(3 * x)', 'x / 4 + 3 * np.cos(3 * x)'] },
  };
  GBC.widget('multi-start', (el) => {
    const s = { fn: 'w', k: 0 };
    const K = 80;
    const w = ui.shell(el, { title: 'Спуск из девяти стартов', sub: 'Девять шариков стартуют в разных местах и катятся градиентным спуском. На выпуклой функции все приходят в одну яму (или на одну полочку), на невыпуклой — в разные.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(MS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), pl.set(0), (s.k = 0), draw()) });
    const pl = ui.player(w.controls, { label: 'Итерация', min: 0, max: K, value: 0, fps: 10, format: (v) => 'шаг ' + v, onChange: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'разных финишей' }, { key: 'b', label: 'лучший f' }, { key: 'w', label: 'худший f' }]);
    function paths(F) {
      const starts = U.linspace(F.dom[0] + 0.15, F.dom[1] - 0.15, 9);
      return starts.map((x0) => {
        const p = [x0];
        for (let k = 0; k < K; k++) p.push(U.clamp(p[k] - F.eta * F.d(p[k]), F.dom[0], F.dom[1]));
        return p;
      });
    }
    function draw() {
      const F = MS[s.fn];
      const P = paths(F);
      const grid = U.linspace(F.dom[0], F.dom[1], 500);
      const cur = P.map((p) => p[s.k]);
      plot.render([
        { type: 'line', x: grid, y: grid.map(F.f), color: 'model', width: 2.4, hover: false },
        { type: 'points', x: P.map((p) => p[0]), y: P.map((p) => F.f(p[0])), color: 'muted', r: 4, hollow: true },
        { type: 'points', x: cur, y: cur.map(F.f), color: 'tree', r: 6, tooltip: (i) => [['старт', f2(P[i][0])], ['сейчас x', f3(cur[i])], ['f', f3(F.f(cur[i]))]] },
      ], { x: F.dom, y: yRange(F.f, grid, 0.12) });
      const fin = P.map((p) => p[K]);
      const vals = fin.map(F.f);
      const groups = [];
      fin.forEach((x) => {
        if (!groups.some((g) => Math.abs(g - x) < 0.05)) groups.push(x);
      });
      const nDistinct = s.fn === 'shelf' ? (vals.every((v) => Math.abs(v - 2) < 0.06) ? 1 : groups.length) : groups.length;
      st.set('n', s.k === K ? String(nDistinct) + (s.fn === 'shelf' ? ' (одна полочка)' : '') : '…');
      st.set('b', f3(Math.min(...vals)));
      st.set('w', f3(Math.max(...vals)));
      const T = {
        convex: 'Строго выпуклая функция: все девять шариков приходят в x* ≈ 0.352 — других ям нет.',
        shelf: 'Выпуклая, но не строго: шарики останавливаются в разных точках отрезка [1, 3], но значение везде одно — 2. Все минимумы глобальные.',
        w: 'Две ямы разной глубины: шарики слева находят глубокую яму (f ≈ −1.30), справа — мелкую (f ≈ −0.70). Спуск не знает, что где-то есть яма глубже.',
        wavy: 'Много ям: каждый шарик застревает в ближайшей. Лучший и худший финиш сильно различаются — типичная беда невыпуклой оптимизации.',
      };
      note.innerHTML = (s.k < K ? 'Нажмите ▶, чтобы покатить шарики. ' : '') + T[s.fn];
    }
    w.pythonAction(() => {
      const F = MS[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + F.py[0] + '\nd1 = lambda x: ' + F.py[1] + '\nx = np.linspace(' + (F.dom[0] + 0.15) + ', ' + (F.dom[1] - 0.15) + ', 9)   # девять стартов сразу\nfor k in range(' + K + '):\n    x = np.clip(x - ' + F.eta + ' * d1(x), ' + F.dom[0] + ', ' + F.dom[1] + ')\nprint("финиши:", np.round(x, 3))\nprint("значения:", np.round(f(x), 3))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 13. Конструктор выпуклых функций: веса деталей
   * ============================================================================== */
  const PARTS = [
    { key: 'sq', label: 'x²', f: (x) => x * x, d2: () => 2, kink: null, convex: true, py: 'x**2' },
    { key: 'abs', label: '|x − 1|', f: (x) => Math.abs(x - 1), d2: () => 0, kink: 1, convex: true, py: 'np.abs(x - 1)' },
    { key: 'sp', label: 'ln(1 + e^(−2x))', f: (x) => softplus(-2 * x), d2: (x) => 4 * sigma(2 * x) * (1 - sigma(2 * x)), kink: null, convex: true, py: 'np.log1p(np.exp(-2 * x))' },
    { key: 'cub', label: 'x³/3 (не выпукла)', f: (x) => x ** 3 / 3, d2: (x) => 2 * x, kink: null, convex: false, py: 'x**3 / 3' },
    { key: 'sin', label: 'sin 2x (не выпукла)', f: (x) => Math.sin(2 * x), d2: (x) => -4 * Math.sin(2 * x), kink: null, convex: false, py: 'np.sin(2 * x)' },
  ];
  GBC.widget('convex-builder', (el) => {
    const s = { wts: { sq: 0.5, abs: 1, sp: 1, cub: 0, sin: 0 } };
    const dom = [-2.5, 2.5];
    const w = ui.shell(el, { title: 'Конструктор: собери выпуклую функцию', sub: 'f = сумма деталей с весами. Детали x², |x − 1|, ln(1 + e^(−2x)) выпуклы; x³/3 и sin 2x — нет. Красным отмечено, где f″ < 0; в изломе |x − 1| с отрицательным весом получается «перевёрнутый» угол — тоже нарушение.' });
    const sliders = PARTS.map((p) => ui.slider(w.controls, { label: 'вес ' + p.label, min: -1, max: 2, step: 0.1, value: s.wts[p.key], format: (v) => U.fmt(v, 1), onInput: (v) => ((s.wts[p.key] = v), draw()) }));
    ui.button(w.controls, { label: 'Только выпуклые детали', onClick: () => {
      Object.assign(s.wts, { sq: 0.5, abs: 1, sp: 1, cub: 0, sin: 0 });
      PARTS.forEach((p, i) => sliders[i].set(s.wts[p.key]));
      draw();
    } });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 170, x: { label: 'x' }, y: { label: 'f″(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'вывод' }, { key: 'm', label: 'min f″' }, { key: 'x', label: 'минимумов на сетке' }]);
    function draw() {
      const f = (x) => PARTS.reduce((a, p) => a + s.wts[p.key] * p.f(x), 0);
      const d2 = (x) => PARTS.reduce((a, p) => a + s.wts[p.key] * p.d2(x), 0);
      const grid = U.linspace(dom[0], dom[1], 501);
      const bad = grid.map((x) => (d2(x) < -1e-9 ? f(x) : NaN));
      const kinkBad = s.wts.abs < 0;
      p1.render([
        { type: 'line', x: grid, y: grid.map(f), color: 'model', width: 2.6, hover: false },
        { type: 'line', x: grid, y: bad, color: 'red', width: 3.6, hover: false },
        kinkBad ? { type: 'points', x: [1], y: [f(1)], color: 'red', r: 7 } : null,
      ], { x: dom, y: yRange(f, grid, 0.12) });
      p2.render([
        ...signBands(d2, dom[0], dom[1], 0.1),
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: grid, y: grid.map(d2), color: 'violet', width: 2.2, hover: false },
        s.wts.abs ? { type: 'vline', x: 1, color: kinkBad ? 'red' : 'muted', dash: '3 3', width: 1.2, text: kinkBad ? 'излом ∩' : 'излом ∪' } : null,
      ], { x: dom, y: yRange(d2, grid, 0.15) });
      const minD2 = Math.min(...grid.map(d2));
      const convex = minD2 >= -1e-9 && !kinkBad;
      const vals = grid.map(f);
      let mins = 0;
      for (let i = 1; i < vals.length - 1; i++) if (vals[i] < vals[i - 1] && vals[i] <= vals[i + 1]) mins++;
      st.set('v', convex ? 'выпукла ✓' : 'не выпукла ✗');
      st.set('m', f3(minD2));
      st.set('x', String(mins));
      const negW = PARTS.filter((p) => p.convex && s.wts[p.key] < 0).map((p) => p.label);
      let msg = convex ? 'Сумма выпуклых деталей с неотрицательными весами выпукла: f″ ≥ 0 всюду' + (s.wts.abs ? ', а излом |x − 1| смотрит вниз (∪)' : '') + '. Минимум один.' : 'Выпуклость потеряна. ';
      if (!convex) {
        if (negW.length) msg += 'Отрицательный вес у выпуклой детали (' + negW.join(', ') + ') переворачивает её в вогнутую. ';
        if (s.wts.cub || s.wts.sin) msg += 'Невыпуклые детали можно «перекрыть» запасом кривизны других (попробуйте вес x² побольше), но не всегда — у x³ кривизна 2x растёт без ограничений. ';
      }
      note.innerHTML = msg;
    }
    w.pythonAction(() => 'import numpy as np\n\nw = {' + PARTS.map((p) => '"' + p.label + '": ' + py(s.wts[p.key])).join(', ') + '}\nparts = {' + PARTS.map((p) => '"' + p.label + '": lambda x: ' + p.py).join(', ') + '}\nf = lambda x: sum(w[k] * parts[k](x) for k in parts)\nx = np.linspace(-2.5, 2.5, 5001)\nh = x[1] - x[0]\nd2 = (f(x[2:]) - 2 * f(x[1:-1]) + f(x[:-2])) / h**2   # вторая разность\nprint("min f″ ≈", d2.min(), "→", "выпукла" if d2.min() > -1e-6 else "не выпукла")\n');
    draw();
  });

  /* ==============================================================================
   * 14. Неравенство Йенсена: центр тяжести точек графика над графиком
   * ============================================================================== */
  const JF = {
    sq: { label: 'x² (дисперсия)', f: (x) => x * x, dom: [-1, 7], pts: [1, 2, 6], py: 'x**2' },
    exp: { label: 'eˣ', f: Math.exp, dom: [-2, 2.2], pts: [-1.5, 0.3, 2], py: 'np.exp(x)' },
    loss: { label: '(F − 4)² — ошибка прогноза при y = 4', f: (x) => (x - 4) ** 2, dom: [0, 10], pts: [2, 4, 9], py: '(x - 4)**2' },
    ln: { label: 'ln x — вогнутая (знак наоборот)', f: Math.log, dom: [0.3, 9], pts: [2, 8, 8], py: 'np.log(x)' },
  };
  GBC.widget('jensen', (el) => {
    const s = { fn: 'loss', pts: JF.loss.pts.slice() };
    const w = ui.shell(el, { title: 'Неравенство Йенсена: f(среднего) против среднего f', sub: 'Три точки графика (тяните их по оси x) и их центр тяжести — квадратик. Для выпуклой функции центр тяжести лежит над графиком: среднее значений ≥ значению в среднем.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(JF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.pts = JF[v].pts.slice()), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x (или прогноз F)' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'mf', label: 'среднее f(xᵢ)' }, { key: 'fm', label: 'f(среднее xᵢ)' }, { key: 'g', label: 'разность (Йенсен)' }]);
    function draw() {
      const F = JF[s.fn];
      const grid = U.linspace(F.dom[0], F.dom[1], 400);
      const xs = s.pts;
      const ys = xs.map(F.f);
      const mx = U.mean(xs);
      const my = U.mean(ys);
      const tri = [...xs, xs[0]];
      plot.render([
        { type: 'line', x: grid, y: grid.map(F.f), color: 'model', width: 2.4, hover: false },
        { type: 'line', x: tri, y: tri.map(F.f), color: 'muted', width: 1.2, dash: '4 3', hover: false },
        { type: 'segments', x1: [mx], y1: [F.f(mx)], x2: [mx], y2: [my], color: my >= F.f(mx) ? 'aqua' : 'red', width: 3, opacity: 1 },
        { type: 'points', x: [mx], y: [my], color: 'violet', r: 8, shape: 'square', label: 'центр тяжести (x̄, среднее f)', tooltip: () => [['x̄', f3(mx)], ['среднее f', f3(my)]] },
        { type: 'points', x: [mx], y: [F.f(mx)], color: 'model', r: 6, label: 'f(x̄)', tooltip: () => [['f(x̄)', f3(F.f(mx))]] },
        { type: 'points', x: xs, y: ys, color: 'tree', r: 7, label: 'точки графика', draggable: true, onDrag: (i, nx) => ((s.pts[i] = Math.round(U.clamp(nx, F.dom[0], F.dom[1]) * 20) / 20), draw()), tooltip: (i) => [['x', f2(xs[i])], ['f', f3(ys[i])]] },
      ], { x: F.dom, y: yRange(F.f, grid, 0.1) });
      st.set('mf', f3(my));
      st.set('fm', f3(F.f(mx)));
      st.set('g', f3(my - F.f(mx)));
      const T = {
        sq: 'Для x² разность «среднее квадратов − квадрат среднего» — это дисперсия точек: ' + f3(my - F.f(mx)) + '. Она ≥ 0 — частный случай Йенсена.',
        exp: 'Экспонента выпукла: среднее eˣ больше, чем e в степени среднего. Поэтому, например, среднее экспонент прогнозов не равно экспоненте среднего логарифма — важно для потерь Пуассона.',
        loss: 'Три модели предсказали ' + xs.map(f2).join(', ') + ' при ответе y = 4. Средняя ошибка моделей — ' + f3(my) + ', ошибка их среднего прогноза ' + f2(mx) + ' — ' + f3(F.f(mx)) + '. Усреднение моделей никогда не хуже средней модели (при выпуклых потерях).',
        ln: 'ln вогнута — знак обратный: ln(среднего) ≥ среднего ln. Отсюда «среднее арифметическое ≥ среднего геометрического»: x̄ = ' + f3(mx) + ' ≥ ' + f3(Math.exp(my)) + '.',
      };
      note.innerHTML = T[s.fn];
    }
    w.pythonAction(() => {
      const F = JF[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + F.py + '\nx = np.array([' + s.pts.map(py).join(', ') + '])\nprint("среднее f(x) =", f(x).mean())\nprint("f(среднее x) =", f(x.mean()))\nprint("разность =", f(x).mean() - f(x.mean()), "(≥ 0 для выпуклой f)")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 15. Выпуклость потерь бустинга по прогнозу F
   * ============================================================================== */
  const LC = {
    mse: { label: '½(y − F)², y = 1', L: (F) => 0.5 * (1 - F) ** 2, h: () => 1, dom: [-3, 5], py: ['0.5 * (1 - F)**2', '1 + 0 * F'] },
    ll: { label: 'log-loss, y = 1', L: (F) => softplus(-F), h: (F) => sigma(F) * (1 - sigma(F)), dom: [-6, 6], py: ['np.log1p(np.exp(-F))', 'sig(F) * (1 - sig(F))'] },
    pois: { label: 'Пуассон e^F − yF, y = 3', L: (F) => Math.exp(F) - 3 * F, h: Math.exp, dom: [-2, 2.5], py: ['np.exp(F) - 3 * F', 'np.exp(F)'] },
    exp: { label: 'экспоненциальные e^(−yF), y = 1', L: (F) => Math.exp(-F), h: (F) => Math.exp(-F), dom: [-2, 4], py: ['np.exp(-F)', 'np.exp(-F)'] },
    huber: { label: 'Хьюбер δ = 1, y = 0', L: (F) => (Math.abs(F) <= 1 ? 0.5 * F * F : Math.abs(F) - 0.5), h: (F) => (Math.abs(F) <= 1 ? 1 : 0), dom: [-4, 4], py: ['np.where(np.abs(F) <= 1, 0.5 * F**2, np.abs(F) - 0.5)', '(np.abs(F) <= 1).astype(float)'] },
    mae: { label: '|y − F|, y = 0', L: Math.abs, h: () => 0, dom: [-3, 3], py: ['np.abs(F)', '0 * F'] },
    msep: { label: '(y − σ(F))², y = 1 — MSE по вероятности', L: (F) => (1 - sigma(F)) ** 2, h: (F) => { const p = sigma(F); return -2 * p * (1 - p) ** 2 * (1 - 3 * p); }, dom: [-6, 6], py: ['(1 - sig(F))**2', '-2 * sig(F) * (1 - sig(F))**2 * (1 - 3 * sig(F))'] },
    cauchy: { label: 'Коши ln(1 + (y − F)²), y = 0', L: (F) => Math.log1p(F * F), h: (F) => (2 * (1 - F * F)) / (1 + F * F) ** 2, dom: [-5, 5], py: ['np.log1p(F**2)', '2 * (1 - F**2) / (1 + F**2)**2'] },
  };
  GBC.widget('loss-convexity', (el) => {
    const s = { l: 'msep', lam: 0 };
    const w = ui.shell(el, { title: 'Выпуклы ли потери по прогнозу F?', sub: 'Сверху — потери L(F) при фиксированном ответе y, снизу — их вторая производная h(F). Красным — участки, где h < 0 (потери не выпуклы). Ползунок λ добавляет λF²/2 — так регуляризация листа добавляет λ к кривизне.' });
    ui.select(w.controls, { label: 'Потери', value: s.l, options: Object.entries(LC).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.l = v), draw()) });
    ui.slider(w.controls, { label: 'Регуляризация λ', min: 0, max: 2, step: 0.05, value: s.lam, onInput: (v) => ((s.lam = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'прогноз F' }, y: { label: 'L(F) + λF²/2' } });
    const p2 = new GBC.Plot(w.main, { height: 190, x: { label: 'прогноз F' }, y: { label: 'кривизна h + λ' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'mh', label: 'min h' }, { key: 'mhl', label: 'min (h + λ)' }, { key: 'v', label: 'вывод' }]);
    function draw() {
      const C = LC[s.l];
      const lam = s.lam;
      const Lr = (F) => C.L(F) + 0.5 * lam * F * F;
      const hr = (F) => C.h(F) + lam;
      const grid = U.linspace(C.dom[0], C.dom[1], 601);
      const bad = grid.map((F) => (hr(F) < -1e-12 ? Lr(F) : NaN));
      const badH = grid.map((F) => (hr(F) < -1e-12 ? hr(F) : NaN));
      p1.render([
        { type: 'line', x: grid, y: grid.map(Lr), color: 'model', width: 2.4, hover: false },
        { type: 'line', x: grid, y: bad, color: 'red', width: 3.6, hover: false },
      ], { x: C.dom, y: yRange(Lr, grid, 0.1, 50) });
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: grid, y: grid.map(hr), color: 'violet', width: 2.2, hover: false },
        { type: 'line', x: grid, y: badH, color: 'red', width: 3.6, hover: false },
        s.l === 'mae' ? { type: 'vline', x: 0, color: 'muted', dash: '3 3', width: 1, text: 'излом' } : null,
      ], { x: C.dom, y: yRange(hr, grid, 0.2, 50) });
      const mh = Math.min(...grid.map(C.h));
      const mhl = mh + lam;
      st.set('mh', f3(mh));
      st.set('mhl', f3(mhl));
      st.set('v', mhl > 1e-9 ? 'сильно выпукла' : mhl >= -1e-12 ? 'выпукла (нестрого)' : 'не выпукла');
      const T = {
        mse: 'h = 1 везде: строго выпукла, парабола Тейлора совпадает с самими потерями.',
        ll: 'h = p(1 − p) ∈ (0, ¼]: строго выпукла, но в хвостах кривизна почти ноль — потери почти прямые.',
        pois: 'h = e^F &gt; 0: строго выпукла, кривизна быстро растёт вправо — поэтому шаг Ньютона из F = 0 перелетает минимум ln 3 (шаг 26).',
        exp: 'h = e^(−F) &gt; 0: строго выпукла. При больших F (уверенно верные ответы) кривизна исчезает.',
        huber: 'h = 1 внутри |F| ≤ 1 и 0 снаружи: выпукла, но вне центра — прямые с h = 0. Шаг Ньютона там не определён без λ.',
        mae: 'h = 0 везде (кроме излома): выпукла, но не строго. Ньютону делить не на что — листья для MAE считают медианой (урок 5.3).',
        msep: 'h &lt; 0 при F &lt; −ln 2 ≈ −0.69: там, где модель уверенно ошибается, потери не выпуклы и почти плоские. Поэтому для классификации берут log-loss.',
        cauchy: 'h &lt; 0 при |F| &gt; 1: робастные потери Коши почти не растут для выбросов — и платят за это выпуклостью.',
      };
      let msg = T[s.l];
      if (lam > 0) msg += mhl > 0 ? ' С λ = ' + U.fmt(lam, 2) + ' кривизна h + λ ≥ ' + f3(mhl) + ' &gt; 0: задача стала сильно выпуклой, минимум единственный, шаг Ньютона определён.' : ' λ = ' + U.fmt(lam, 2) + ' мало: отрицательная кривизна (до ' + f3(mh) + ') ещё не перекрыта.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const C = LC[s.l];
      return 'import numpy as np\n\nsig = lambda z: 1 / (1 + np.exp(-z))\nL = lambda F: ' + C.py[0] + '\nh = lambda F: ' + C.py[1] + '   # ∂²L/∂F²\nF = np.linspace(' + C.dom[0] + ', ' + C.dom[1] + ', 2001)\nlam = ' + py(s.lam) + '\nprint("min h =", h(F).min(), "  min(h + λ) =", (h(F) + lam).min())\nbad = F[h(F) + lam < 0]\nif bad.size:\n    print(f"не выпукла на [{bad.min():.3f}; {bad.max():.3f}]")\neps = 1e-4   # проверка h второй разностью\nprint("max|h − Δ²L/ε²| =", np.abs(h(F) - (L(F + eps) - 2 * L(F) + L(F - eps)) / eps**2)[np.abs(F) > 0.01].max())\n';
    });
    draw();
  });
})();
