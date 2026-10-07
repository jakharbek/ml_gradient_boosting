/* Урок 1.3 — производная, градиент и градиентный спуск. Виджеты в порядке появления на странице:
 *   fog-walk           — спуск в тумане: видно только склон под ногами (шаг 1);
 *   slope-zoom         — секущая превращается в касательную; численная производная и её ошибка (шаг 2);
 *   gd-trainer         — тренажёр: посчитайте наклон и шаг спуска сами (шаг 4);
 *   constant-pull      — спуск для константы: каждая квартира тянет прогноз к себе, L2 и L1 (шаг 4);
 *   step-guarantee     — что обещает касательная и что получается после одного шага (шаг 5);
 *   eta-map            — путь θ_k, множитель 1 − η·a и число шагов до минимума (шаг 6);
 *   gd-1d              — спуск по одной переменной: функции и способы выбора темпа; data-config (шаги 7–8);
 *   loss-doctor        — диагноз по кривой потерь (шаг 8);
 *   newton-view        — линейное и квадратичное приближение: откуда берётся шаг Ньютона (шаг 9);
 *   slices-2d          — карта высот, линии уровня, срезы и частные производные (шаг 10);
 *   bowl-2d            — вытянутая чаша: число обусловленности, зигзаг и инерция (шаг 11);
 *   gd-2d              — прямая для 30 точек: признак как есть, центрированный, стандартизованный (шаг 12);
 *   sgd-constant       — стохастический спуск для одного числа (шаг 13);
 *   sgd-line           — стохастический спуск для прямой: шаг по мини-пакету из B точек (шаг 13);
 *   stump-relief       — потери пня как функция порога: ступеньки, по которым не спуститься (шаг 14);
 *   prediction-descent — спуск в пространстве прогнозов: «свободные» прогнозы против дерева (шаг 14). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  /* Шесть квартир из урока 1: цены (млн) и площади (м²). */
  const FLATS = [3, 5, 4, 8, 9, 13];
  const AREAS = [30, 40, 50, 60, 70, 80];

  const sigmoid = (z) => U.sigmoid(z);
  const FUNCS = {
    parabola: { label: 'Парабола ½·3θ²', f: (t) => 1.5 * t * t, df: (t) => 3 * t, d2f: () => 3, dom: [-3, 3], t0: 2.5, py: ['1.5 * t**2', '3 * t', '3'] },
    pits: { label: 'Две ямы θ⁴/4 − θ² + 0.3θ', f: (t) => t ** 4 / 4 - t * t + 0.3 * t, df: (t) => t ** 3 - 2 * t + 0.3, d2f: (t) => 3 * t * t - 2, dom: [-2.2, 2.2], t0: 0.5, py: ['t**4 / 4 - t**2 + 0.3 * t', 't**3 - 2 * t + 0.3', '3 * t**2 - 2'] },
    abs: { label: 'Излом |θ| (L1)', f: (t) => Math.abs(t), df: (t) => Math.sign(t), d2f: () => 0, dom: [-3, 3], t0: 2.05, py: ['abs(t)', 'np.sign(t)', '0'] },
    quartic: { label: 'Плоское дно θ⁴/4', f: (t) => (t * t * t * t) / 4, df: (t) => t * t * t, d2f: (t) => 3 * t * t, dom: [-3, 3], t0: 2.5, py: ['t**4 / 4', 't**3', '3 * t**2'] },
    logloss: {
      label: 'Log-loss константы (30 % единиц)', f: (t) => Math.log1p(Math.exp(t)) - 0.3 * t, df: (t) => sigmoid(t) - 0.3, d2f: (t) => sigmoid(t) * (1 - sigmoid(t)), dom: [-3, 3], t0: 2.5,
      py: ['np.log1p(np.exp(t)) - 0.3 * t', '1 / (1 + np.exp(-t)) - 0.3', '(1 / (1 + np.exp(-t))) * (1 - 1 / (1 + np.exp(-t)))'],
    },
  };

  /** Разбор числа, введённого учеником: запятая, «−», пробелы. */
  function parseNum(s) {
    const t = String(s).trim().replace(/\s+/g, '').replace(',', '.').replace(/[−–—]/g, '-');
    if (!t || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
    return Number(t);
  }

  /** Перерисовать виджет при смене темы: палитру тепловых карт виджет вычисляет сам в draw(). */
  const onTheme = (fn) => GBC.bus.on('themechange', () => setTimeout(fn, 0));
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  /** Подпись степени десяти на логарифмической оси: 10⁻⁵ вместо 1.0e−5. */
  const pow10 = (v) => {
    const e = Math.round(Math.log10(v));
    if (e >= -2 && e <= 3) return String(Number(Math.pow(10, e).toPrecision(3)));
    return '10' + String(e).split('').map((c) => SUP[c] || c).join('');
  };

  /** Плашка-вердикт: kind = good | bad | neutral. */
  function verdict(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 9px;border-radius:999px;font-size:.82rem;font-weight:650;' + st }, text);
  }

  /* =================================================================================
   * fog-walk — спуск в тумане: видно только склон под ногами
   * ================================================================================= */
  GBC.widget('fog-walk', (el) => {
    const LAND = {
      flats: {
        label: 'Шесть квартир', x: 'c — прогноз, млн', v: 'c', f: (c) => U.mean(FLATS.map((y) => 0.5 * (y - c) ** 2)), df: (c) => c - 7,
        dom: [-2, 16], y: [0, 50], c0: 0.5, eta: 0.5, py: ['np.mean(0.5 * (y - t) ** 2)', 't - y.mean()'],
      },
      hills: {
        label: 'Холмы', x: 'θ', v: 'θ', f: (c) => 0.05 * (c - 8) ** 2 - 1.2 * Math.cos(1.2 * (c - 8)) + 1.5, df: (c) => 0.1 * (c - 8) + 1.44 * Math.sin(1.2 * (c - 8)),
        dom: [-2, 16], y: [0, 6.5], c0: 0.5, eta: 0.5, py: ['0.05 * (t - 8)**2 - 1.2 * np.cos(1.2 * (t - 8)) + 1.5', '0.1 * (t - 8) + 1.44 * np.sin(1.2 * (t - 8))'],
      },
    };
    const WIN = 0.75; // полуширина «видимого» участка
    const s = { land: 'flats', mode: 'self', step: 1, eta: 0.5, reveal: false, path: [] };
    const w = ui.shell(el, {
      title: 'Спуск в тумане: видно только склон под ногами',
      sub: 'Рельеф скрыт туманом. Вы знаете лишь высоту и наклон в точке, где стоите (оранжевая касательная), и помните, где уже были. Найдите дно: шагайте сами или по правилу спуска. Потом рассейте туман и посмотрите, что получилось.',
    });
    ui.select(w.controls, { label: 'Местность', options: Object.entries(LAND).map(([k, v]) => ({ value: k, label: v.label })), value: s.land, onChange: (v) => ((s.land = v), reset()) });
    ui.segmented(w.controls, {
      label: 'Как шагаем', options: [{ value: 'self', label: 'Сам' }, { value: 'rule', label: 'По правилу' }], value: s.mode,
      onChange: (v) => ((s.mode = v), (stepCtl.el.hidden = v !== 'self'), (etaCtl.el.hidden = v !== 'rule'), (selfBtns.hidden = v !== 'self'), (ruleBtns.hidden = v !== 'rule'), draw()),
    });
    const stepCtl = ui.slider(w.controls, { label: 'Длина шага', values: [0.25, 0.5, 1, 2], value: s.step, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.step = v), draw()) });
    const etaCtl = ui.slider(w.controls, { label: 'Темп η: сдвиг = −η × наклон', min: 0.05, max: 2.5, log: true, value: s.eta, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.eta = v), draw()) });
    etaCtl.el.hidden = true;
    const selfBtns = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    const ruleBtns = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' }, hidden: true });
    w.controls.append(selfBtns, ruleBtns);
    ui.button(selfBtns, { label: '← Влево', small: true, onClick: () => move(-s.step) });
    ui.button(selfBtns, { label: 'Вправо →', small: true, onClick: () => move(s.step) });
    ui.button(ruleBtns, { label: 'Шаг по правилу', small: true, kind: 'primary', onClick: () => move(-s.eta * LAND[s.land].df(cur())) });
    ui.button(ruleBtns, { label: '+10 шагов', small: true, onClick: () => { for (let i = 0; i < 10; i++) move(-s.eta * LAND[s.land].df(cur()), false); draw(); } });
    const fogCtl = ui.toggle(w.controls, { label: 'Рассеять туман', checked: false, onChange: (v) => ((s.reveal = v), draw()) });
    ui.button(w.controls, { label: 'Начать заново', small: true, kind: 'ghost', onClick: () => reset() });
    const plot = new GBC.Plot(w.main, {
      height: 300, x: { label: 'θ' }, y: { label: 'высота f(θ)' },
      table: () => {
        const L = LAND[s.land];
        return { columns: ['шаг', L.v, 'высота', 'наклон'], rows: s.path.map((c, k) => [k, c, L.f(c), L.df(c)]) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'c', label: 'Где стою' }, { key: 'f', label: 'Высота' }, { key: 'g', label: 'Наклон под ногами' }, { key: 'n', label: 'Шагов сделано' }]);
    const cur = () => s.path[s.path.length - 1];
    function reset() {
      const L = LAND[s.land];
      s.path = [L.c0];
      s.reveal = false;
      fogCtl.set(false);
      plot.opts.x.label = L.x;
      plot.opts.y.label = 'высота f(' + L.v + ')';
      draw();
    }
    function move(d, redraw = true) {
      const L = LAND[s.land];
      const nc = U.clamp(cur() + d, L.dom[0], L.dom[1]);
      if (s.path.length < 400) s.path.push(nc);
      if (redraw) draw();
    }
    function draw() {
      const L = LAND[s.land];
      const c = cur();
      const g = L.df(c);
      const fc = L.f(c);
      const layers = [];
      if (!s.reveal) {
        // туман: всё, кроме участка под ногами, затянуто серым
        layers.push({ type: 'vband', x0: L.dom[0], x1: c - WIN, color: 'ink2', opacity: 0.1 });
        layers.push({ type: 'vband', x0: c + WIN, x1: L.dom[1], color: 'ink2', opacity: 0.1 });
        const loc = U.linspace(c - WIN, c + WIN, 40);
        layers.push({ type: 'line', x: loc, y: loc.map(L.f), color: 'model', width: 2.4, label: 'рельеф под ногами' });
      } else {
        const gx = U.linspace(L.dom[0], L.dom[1], 400);
        layers.push({ type: 'line', x: gx, y: gx.map(L.f), color: 'model', width: 2.2, label: 'рельеф f(θ)' });
      }
      const span = 1.8;
      layers.push({ type: 'line', x: [c - span, c + span], y: [fc - span * g, fc + span * g], color: 'tree', width: 1.8, dash: '6 4', label: 'наклон под ногами (касательная)', hover: false });
      const P = s.path;
      layers.push({ type: 'line', x: P, y: P.map(L.f), color: 'ink2', width: 1, dash: '2 3', hover: false });
      layers.push({ type: 'points', x: P.slice(0, -1), y: P.slice(0, -1).map(L.f), color: 'ink2', r: 3, hollow: true, label: 'где уже был', tooltip: (i) => [{ label: 'шаг', value: String(i) }, { label: 'θ', value: U.fmt(P[i], 3) }, { label: 'f(θ)', value: U.fmt(L.f(P[i]), 3) }] });
      layers.push({ type: 'points', x: [c], y: [fc], color: 'ink', r: 6, label: 'вы здесь' });
      plot.render(layers, { x: L.dom, y: L.y });
      stats.set('c', U.fmt(c, 3));
      stats.set('f', U.fmt(fc, 3));
      stats.set('g', U.fmt(g, 3));
      stats.set('n', String(P.length - 1));
      const n = P.length - 1;
      const flipped = n >= 2 && Math.sign(P[n] - P[n - 1]) !== Math.sign(P[n - 1] - P[n - 2]) && Math.abs(P[n] - P[n - 1]) > 1e-12 && Math.abs(P[n - 1] - P[n - 2]) > 1e-12;
      const atBottom = Math.abs(g) < (s.land === 'flats' ? 0.05 : 0.02);
      let msg;
      if (atBottom) {
        msg = '<b>Склон почти горизонтален — вы на дне</b> (наклон ' + U.fmt(g, 3) + '). Шагов: ' + n + '. ';
        if (s.reveal) msg += s.land === 'hills' && c < 5 ? 'Но смотрите: это ближайшая ямка, а не самая глубокая. Спуск видит только склон под ногами и находит <em>ближайшее</em> дно.' : 'Туман рассеян: это и есть минимум.';
        else msg += 'Рассейте туман и проверьте, не обманулись ли вы.';
      } else if (s.mode === 'self') {
        msg = 'Наклон под ногами: ' + U.fmt(g, 3) + (g < 0 ? ': справа ниже — шагайте <b>вправо</b>.' : ': слева ниже — шагайте <b>влево</b>.');
        if (flipped) msg += ' Последние шаги шли в разные стороны: вы перешагиваете дно. Уменьшите шаг — или шагайте пропорционально наклону (режим «По правилу»).';
      } else {
        const d = -s.eta * g;
        msg = 'Правило спуска: сдвиг = −η × наклон = −' + U.fmt(s.eta, 3) + ' · (' + U.fmt(g, 3) + ') = ' + U.fmtSigned(d, 3) + '. Знак наклона выбирает сторону, его величина — длину шага: на крутом склоне шаги длинные, у дна — короткие, и спуск тормозит сам.';
      }
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const L = LAND[s.land];
      return 'import numpy as np\n\n' + (s.land === 'flats' ? 'y = np.array([3, 5, 4, 8, 9, 13.])         # цены шести квартир\n' : '') +
        'f = lambda t: ' + L.py[0] + '\ndf = lambda t: ' + L.py[1] + '\n\nt, eta = ' + U.pyNum(L.c0) + ', ' + U.pyNum(s.eta) + '\nfor k in range(' + Math.max(10, s.path.length - 1) + '):\n' +
        '    print(f"шаг {k:2d}: θ = {t:7.3f}, высота {f(t):7.3f}, наклон {df(t):+.3f}")\n    t = t - eta * df(t)                   # шаг против наклона\n';
    });
    reset();
  });

  /* =================================================================================
   * slope-zoom — от секущей к касательной + численная производная
   * ================================================================================= */
  GBC.widget('slope-zoom', (el) => {
    const FN = {
      flats: { label: 'Квартиры: f(c) = ½·MSE', v: 'c', f: (t) => U.mean(FLATS.map((y) => 0.5 * (y - t) ** 2)), df: (t) => t - 7, dom: [-1, 15], t: 0, py: 'np.mean(0.5 * (np.array([3, 5, 4, 8, 9, 13.]) - t) ** 2)' },
      square: { label: 'f(θ) = θ²', v: 'θ', f: (t) => t * t, df: (t) => 2 * t, dom: [-2.5, 4], t: 3, py: 't**2' },
      cube: { label: 'f(θ) = θ³', v: 'θ', f: (t) => t ** 3, df: (t) => 3 * t * t, dom: [-1.6, 1.8], t: 1, py: 't**3' },
      sin: { label: 'f(θ) = sin θ', v: 'θ', f: Math.sin, df: Math.cos, dom: [-3, 3], t: 1, py: 'np.sin(t)' },
    };
    const s = { fn: 'flats', t: 0, eps: 1, kind: 'fwd', err: false };
    const w = ui.shell(el, {
      title: 'Производная — предел наклона секущей',
      sub: 'Секущая (синяя) проходит через две точки графика. Её наклон — средняя скорость изменения f. Уменьшайте ε: секущая прижимается к касательной (оранжевый пунктир), а её наклон — к производной.',
    });
    ui.select(w.controls, { label: 'Функция', options: Object.entries(FN).map(([k, v]) => ({ value: k, label: v.label })), value: s.fn, onChange: (v) => ((s.fn = v), (s.t = FN[v].t), tCtl.input.min = FN[v].dom[0], tCtl.input.max = FN[v].dom[1], tCtl.set(s.t), draw()) });
    const tCtl = ui.slider(w.controls, { label: 'Точка', min: FN.flats.dom[0], max: FN.flats.dom[1], step: 0.05, value: s.t, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.t = v), draw()) });
    // дискретные ε: так можно точно повторить таблицы шага 2 урока
    const EPS = [1e-12, 1e-10, 1e-8, 1e-6, 1e-5, 1e-4, 1e-3, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2];
    ui.slider(w.controls, { label: 'Шаг ε', values: EPS, value: s.eps, format: (v) => (v < 1e-3 ? pow10(v) : U.fmt(v, 3)), onInput: (v) => ((s.eps = v), draw()) });
    ui.segmented(w.controls, { label: 'Формула', options: [{ value: 'fwd', label: 'вперёд' }, { value: 'cen', label: 'центральная' }], value: s.kind, onChange: (v) => ((s.kind = v), draw()), help: 'вперёд: (f(θ+ε) − f(θ))/ε; центральная: (f(θ+ε) − f(θ−ε))/2ε' });
    ui.toggle(w.controls, { label: 'Ошибка от ε (для любознательных)', checked: false, onChange: (v) => ((s.err = v), (ep.root.hidden = !v), draw()) });
    const plot = new GBC.Plot(w.main, {
      height: 290, x: { label: 'θ' }, y: { label: 'f(θ)' },
      table: () => {
        const F = FN[s.fn];
        return { columns: ['ε', 'вперёд', 'центральная', 'f′ (формула)', 'ошибка вперёд', 'ошибка центр.'], rows: [1, 0.1, 0.01, 1e-3, 1e-4, 1e-6, 1e-8, 1e-10, 1e-12].map((e) => { const a = fwd(F, s.t, e); const b = cen(F, s.t, e); const d = F.df(s.t); return [e, a, b, d, Math.abs(a - d), Math.abs(b - d)]; }) };
      },
    });
    const ep = new GBC.Plot(w.main, { height: 220, x: { label: 'ε', type: 'log', domain: [1e-12, 1], format: pow10 }, y: { label: '|ошибка|', type: 'log', domain: [1e-14, 10], format: pow10 }, margin: { left: 58 }, crosshair: true, crosshairTitle: (v) => 'ε = ' + v.toExponential(0) });
    ep.root.hidden = true;
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'q', label: 'Наклон секущей' }, { key: 'd', label: 'Производная f′' }, { key: 'err', label: 'Ошибка' }]);
    const fwd = (F, t, e) => (F.f(t + e) - F.f(t)) / e;
    const cen = (F, t, e) => (F.f(t + e) - F.f(t - e)) / (2 * e);
    function draw() {
      const F = FN[s.fn];
      const t = U.clamp(s.t, F.dom[0], F.dom[1]);
      plot.opts.x.label = F.v;
      plot.opts.y.label = 'f(' + F.v + ')';
      const gx = U.linspace(F.dom[0], F.dom[1], 300);
      const q = s.kind === 'fwd' ? fwd(F, t, s.eps) : cen(F, t, s.eps);
      const d = F.df(t);
      const span = F.dom[1] - F.dom[0];
      const ys = gx.map(F.f);
      const [lo, hi] = U.extent(ys);
      const xa = s.kind === 'fwd' ? t : t - s.eps;
      const xb = t + s.eps;
      const through = s.kind === 'fwd' ? [t, F.f(t)] : [xa, F.f(xa)];
      const sec = [t - span, t + span].map((x) => through[1] + q * (x - through[0]));
      plot.render([
        { type: 'line', x: gx, y: ys, color: 'ink2', width: 2, label: 'f' },
        { type: 'line', x: [t - span, t + span], y: [t - span, t + span].map((x) => F.f(t) + d * (x - t)), color: 'tree', width: 1.8, dash: '6 4', label: 'касательная: наклон f′', hover: false },
        { type: 'line', x: [t - span, t + span], y: sec, color: 'model', width: 2, label: 'секущая', hover: false },
        { type: 'points', x: [xa, xb], y: [F.f(xa), F.f(xb)], color: 'model', r: 4.5 },
        { type: 'points', x: [t], y: [F.f(t)], color: 'ink', r: 5.5 },
      ], { x: F.dom, y: [lo - 0.15 * (hi - lo + 1), hi + 0.15 * (hi - lo + 1)] });
      if (s.err) {
        const es = U.range(121).map((i) => Math.pow(10, -12 + i * 0.1));
        const clip = (v) => Math.max(v, 1e-14);
        ep.render([
          { type: 'line', x: es, y: es.map((e) => clip(Math.abs(fwd(F, t, e) - d))), color: 'orange', width: 2, label: 'вперёд' },
          { type: 'line', x: es, y: es.map((e) => clip(Math.abs(cen(F, t, e) - d))), color: 'blue', width: 2, label: 'центральная' },
          { type: 'vline', x: s.eps, color: 'ink2', dash: '3 3', width: 1 },
        ]);
      }
      stats.set('q', U.fmt(q, 6));
      stats.set('d', U.fmt(d, 6));
      const er = Math.abs(q - d);
      stats.set('err', er < 1e-15 ? '0' : er >= 1e-3 ? U.fmt(er, 4) : er.toExponential(1).replace('-', '−'));
      const tiny = s.eps < 1e-9;
      note.innerHTML = (tiny
        ? '<b>Слишком маленький ε тоже плох:</b> компьютер хранит около 16 значащих цифр, и разность двух почти равных чисел f(θ+ε) − f(θ) теряет точность (ошибка округления). Поэтому на практике берут ε ≈ 10⁻⁵…10⁻⁶ для центральной формулы и ≈ 10⁻⁸ для формулы «вперёд».'
        : s.eps > 0.3
          ? 'Сейчас ε велико, и секущая заметно отличается от касательной. Уменьшайте ε: разница исчезает — производная и есть предел наклона секущей.'
          : 'Чем меньше ε, тем точнее. ' + (s.kind === 'fwd' ? 'У формулы «вперёд» ошибка уменьшается пропорционально ε, у центральной — пропорционально ε²: при ε = 0.01 это сотые против десятитысячных.' : 'Центральная разность симметрична и точнее: её ошибка пропорциональна ε². У параболы она вообще точна при любом ε.')) +
        ' Смысл производной: если сдвинуть аргумент на маленькое Δ, функция изменится примерно на f′·Δ.';
    }
    w.pythonAction(() => {
      const F = FN[s.fn];
      return 'import numpy as np\n\nf = lambda t: ' + F.py + '\nt = ' + U.pyNum(Number(s.t.toFixed(3))) + '\nfor eps in [1, 0.1, 0.01, 1e-3, 1e-5, 1e-8, 1e-12]:\n    fwd = (f(t + eps) - f(t)) / eps\n    cen = (f(t + eps) - f(t - eps)) / (2 * eps)\n    print(f"ε = {eps:<6g}: вперёд {fwd:.10f}, центральная {cen:.10f}")\n';
    });
    draw();
  });

  /* =================================================================================
   * gd-trainer — тренажёр: посчитайте шаг спуска сами
   * ================================================================================= */
  GBC.widget('gd-trainer', (el) => {
    const TASKS = {
      flats: {
        label: 'Квартиры, ½·MSE, η = 0.5', eta: 0.5, t0: 0, dom: [-1, 15], name: 'c',
        f: (c) => U.mean(FLATS.map((y) => 0.5 * (y - c) ** 2)), df: (c) => c - 7,
        hint: (t) => 'f′(c) = c − 7 = ' + U.fmt(t, 4) + ' − 7', py: ['np.mean(0.5 * (y - t) ** 2)', 't - 7'],
      },
      quad: {
        label: 'f(θ) = (θ − 3)², η = 0.25', eta: 0.25, t0: 0, dom: [-1, 6], name: 'θ',
        f: (t) => (t - 3) ** 2, df: (t) => 2 * (t - 3),
        hint: (t) => 'f′(θ) = 2(θ − 3) = 2 · (' + U.fmt(t, 4) + ' − 3)', py: ['(t - 3) ** 2', '2 * (t - 3)'],
      },
      over: {
        label: 'f(θ) = 5θ², η = 0.15', eta: 0.15, t0: 2, dom: [-2.5, 2.5], name: 'θ',
        f: (t) => 5 * t * t, df: (t) => 10 * t,
        hint: (t) => 'f′(θ) = 10θ = 10 · ' + U.fmt(t, 4), py: ['5 * t ** 2', '10 * t'],
      },
      mae: {
        label: 'Квартиры, MAE, η = 0.5', eta: 0.5, t0: 0, dom: [-1, 15], name: 'c',
        f: (c) => U.mean(FLATS.map((y) => Math.abs(y - c))), df: (c) => U.mean(FLATS.map((y) => -Math.sign(y - c))),
        hint: (t) => { const lo = FLATS.filter((y) => y < t - 1e-12).length; const hi = FLATS.filter((y) => y > t + 1e-12).length; return 'цен ниже c: ' + lo + ', выше: ' + hi + ' (цена, равная c, не тянет никуда) → f′(c) = (' + lo + ' − ' + hi + ')/6'; },
        py: ['np.mean(np.abs(y - t))', 'np.mean(-np.sign(y - t))'],
      },
    };
    const MAXK = 8;
    const s = { task: 'flats', rows: [], t: 0, stage: 0, first: true, firstOk: 0, tries: 0 };
    const w = ui.shell(el, {
      title: 'Ваш ход: шаг спуска руками',
      sub: 'Два действия на каждом шаге: 1) найти наклон f′(θₖ) в текущей точке; 2) сделать шаг θₖ₊₁ = θₖ − η·f′(θₖ). Вводите числа (можно с запятой); точность — до сотых.',
    });
    ui.select(w.controls, { label: 'Задача', options: Object.entries(TASKS).map(([k, v]) => ({ value: k, label: v.label })), value: s.task, onChange: (v) => ((s.task = v), reset()) });
    const ask = H('div', { class: 'ctl' });
    const qLabel = H('label', { class: 'ctl-label' });
    const inp = H('input', { class: 'input', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Ваш ответ', style: 'font-family:var(--font-mono);width:100%;box-sizing:border-box' });
    ask.append(qLabel, inp);
    w.controls.appendChild(ask);
    const btns = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(btns);
    ui.button(btns, { label: 'Проверить', small: true, kind: 'primary', onClick: () => check() });
    ui.button(btns, { label: 'Подсказка', small: true, onClick: () => hint() });
    ui.button(btns, { label: 'Ответ', small: true, kind: 'ghost', onClick: () => reveal() });
    const fb = H('div', { class: 'ctl-help', role: 'status', 'aria-live': 'polite', style: 'min-height:2.6em' });
    w.controls.appendChild(fb);
    ui.button(w.controls, { label: 'Начать заново', small: true, kind: 'ghost', onClick: () => reset() });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') check();
    });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'θ' }, y: { label: 'f(θ)' } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'k', label: 'Шагов сделано' }, { key: 'ok', label: 'С первой попытки' }, { key: 't', label: 'Текущая точка' }, { key: 'd', label: 'До минимума' }]);
    const T = () => TASKS[s.task];
    const opt = () => (s.task === 'mae' ? null : s.task === 'flats' ? 7 : s.task === 'quad' ? 3 : 0);
    function reset() {
      s.rows = [];
      s.t = T().t0;
      s.stage = 0;
      s.first = true;
      s.firstOk = 0;
      s.tries = 0;
      plot.opts.x.label = T().name;
      plot.opts.y.label = 'f(' + T().name + ')';
      prompt();
      draw();
    }
    const answer = () => (s.stage === 0 ? T().df(s.t) : s.t - T().eta * T().df(s.t));
    function prompt() {
      const k = s.rows.length;
      const nm = T().name;
      qLabel.replaceChildren(GBC.richText(s.stage === 0 ? 'Шаг ' + k + ' из 2 действий: 1) наклон f′(' + nm + '_' + k + ') при ' + nm + '_' + k + ' = ' + U.fmt(s.t, 4) : 'Шаг ' + k + ': 2) ' + nm + '_{' + (k + 1) + '} = ' + nm + '_' + k + ' − η·f′(' + nm + '_' + k + ') при η = ' + U.fmt(T().eta, 3)));
      inp.value = '';
      fb.textContent = '';
    }
    function done(ok) {
      if (s.stage === 0) {
        s.stage = 1;
      } else {
        const g = T().df(s.t);
        const nt = s.t - T().eta * g;
        s.rows.push([s.rows.length, s.t, g, nt]);
        if (s.first) s.firstOk++;
        s.t = nt;
        s.stage = 0;
        s.first = true;
      }
      if (!ok) s.first = false;
      prompt();
      draw();
    }
    function check() {
      if (s.rows.length >= MAXK) return;
      const v = parseNum(inp.value);
      if (v === null) {
        fb.replaceChildren(verdict('Введите число', 'neutral'));
        return;
      }
      const a = answer();
      if (Math.abs(v - a) <= 0.01 + 1e-9 || Math.abs(v - a) <= 0.005 * Math.abs(a)) {
        const msg = s.stage === 0 ? 'Верно: f′ = ' + U.fmt(a, 4) : 'Верно: ' + U.fmt(a, 4);
        done(true);
        fb.replaceChildren(verdict(msg, 'good'));
      } else {
        s.first = false;
        s.tries++;
        const sign = s.stage === 0 && Math.abs(v + a) <= 0.01 ? ' Проверьте знак.' : s.stage === 1 && Math.abs(v - (s.t + T().eta * T().df(s.t))) <= 0.01 ? ' Шаг делается ПРОТИВ производной: минус, а не плюс.' : '';
        fb.replaceChildren(verdict('Пока нет.' + sign + ' Нажмите «Подсказка».', 'bad'));
      }
    }
    function hint() {
      s.first = false;
      const g = T().df(s.t);
      fb.textContent = s.stage === 0 ? T().hint(s.t) : T().name + '_' + (s.rows.length + 1) + ' = ' + U.fmt(s.t, 4) + ' − ' + U.fmt(T().eta, 3) + ' · (' + U.fmt(g, 4) + ')';
    }
    function reveal() {
      if (s.rows.length >= MAXK) return;
      const a = answer();
      done(false);
      fb.replaceChildren(verdict('Ответ: ' + U.fmt(a, 4), 'neutral'));
    }
    function draw() {
      const D = T();
      const gx = U.linspace(D.dom[0], D.dom[1], 300);
      const P = s.rows.map((r) => r[1]).concat([s.t]);
      plot.render([
        { type: 'line', x: gx, y: gx.map(D.f), color: 'model', width: 2.2, label: 'f' },
        { type: 'line', x: P, y: P.map(D.f), color: 'ink2', width: 1, dash: '3 3', hover: false },
        { type: 'points', x: P, y: P.map(D.f), color: (i) => (i === P.length - 1 ? 'tree' : 'ink'), r: (i) => (i === P.length - 1 ? 6 : 4), label: 'ваш путь', legend: false },
      ]);
      tableBox.textContent = '';
      const nm = D.name;
      if (s.rows.length) ui.table(tableBox, { columns: ['k', nm + '_k', 'f′(' + nm + '_k)', nm + '_{k+1}'], rows: s.rows.map((r) => [String(r[0]), U.fmt(r[1], 4), U.fmt(r[2], 4), U.fmt(r[3], 4)]) });
      stats.set('k', String(s.rows.length));
      stats.set('ok', s.rows.length ? s.firstOk + ' из ' + s.rows.length : '—');
      stats.set('t', U.fmt(s.t, 4));
      const m = opt();
      stats.set('d', m === null ? '—' : U.fmt(Math.abs(s.t - m), 4));
      const R = s.rows;
      let msg;
      if (R.length >= MAXK) msg = '<b>Готово: ' + MAXK + ' шагов.</b> Выберите другую задачу или начните заново.';
      else if (R.length >= 3 && m !== null) {
        const q = (R[R.length - 1][3] - m) / (R[R.length - 1][1] - m);
        msg = 'Посмотрите на столбец «до минимума»: каждый шаг умножает расстояние до минимума на ' + U.fmt(q, 3) + ' = 1 − η·a, где a = f″ — кривизна. ' + (q < 0 ? 'Множитель отрицательный: точка перепрыгивает минимум, но приближается.' : 'Это и есть линейная сходимость спуска.');
      } else if (s.task === 'mae' && R.length >= 2) msg = 'У MAE наклон f′(c) = (сколько цен ниже c − сколько выше) / 6, а сила −f′ — наоборот. От того, насколько далеко цены, наклон не зависит, поэтому шаги одинаковые, пока все цены по одну сторону от c.';
      else msg = 'Алгоритм один и тот же для любой функции: посчитать наклон в текущей точке → сдвинуться против него на η·наклон → повторить. Оранжевая точка — где вы сейчас.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const D = T();
      return 'import numpy as np\n\n' + (s.task === 'flats' || s.task === 'mae' ? 'y = np.array([3, 5, 4, 8, 9, 13.])\n' : '') + 'f = lambda t: ' + D.py[0] + '\ndf = lambda t: ' + D.py[1] + '\n\nt, eta = ' + U.pyNum(D.t0) + ', ' + U.pyNum(D.eta) + '\nfor k in range(' + MAXK + '):\n' +
        '    g = df(t)                                 # 1) наклон в текущей точке\n    print(f"k = {k}: θ = {t:.4f}, f′ = {g:+.4f}, θ_new = {t - eta * g:.4f}")\n    t = t - eta * g                           # 2) шаг против наклона\n';
    });
    reset();
  });

  /* =================================================================================
   * constant-pull — спуск для константы: силы квартир (L2 и L1)
   * ================================================================================= */
  GBC.widget('constant-pull', (el) => {
    const MAXK = 20;
    const s = { loss: 'l2', eta: 0.5, c0: 0, k: 0 };
    const LOSS = {
      l2: { label: '½·MSE', pull: (y, c) => y - c, f: (c) => U.mean(FLATS.map((y) => 0.5 * (y - c) ** 2)) },
      l1: { label: 'MAE', pull: (y, c) => Math.sign(y - c), f: (c) => U.mean(FLATS.map((y) => Math.abs(y - c))) },
    };
    const w = ui.shell(el, {
      title: 'Спуск для константы: каждая квартира тянет прогноз к себе',
      sub: 'Шесть квартир — шесть сил. Сила квартиры — минус производная её потерь по c: для ½·MSE это остаток y − c, для MAE — только его знак. Средняя сила (оранжевая стрелка) — это антиградиент −f′(c); шаг спуска сдвигает c на η·(среднюю силу).',
    });
    ui.segmented(w.controls, { label: 'Потери', options: [{ value: 'l2', label: '½·MSE' }, { value: 'l1', label: 'MAE' }], value: s.loss, onChange: (v) => ((s.loss = v), draw()) });
    ui.slider(w.controls, { label: 'Темп η', min: 0.05, max: 2.2, step: 0.05, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Старт c₀', min: -1, max: 15, step: 0.5, value: s.c0, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.c0 = v), draw()) });
    ui.player(w.controls, { label: 'Шаг спуска', min: 0, max: MAXK, value: 0, fps: 2, format: (v) => 'k = ' + v, onChange: (v) => ((s.k = v), draw()) });
    const top = new GBC.Plot(w.main, { height: 250, x: { label: 'цена, млн', domain: [-1.5, 16] }, y: { label: 'квартира', domain: [-0.9, 6.7], ticks: [0, 1, 2, 3, 4, 5, 6], format: (v) => (v === 0 ? 'среднее' : String(v)) } });
    const bottom = new GBC.Plot(w.main, {
      height: 200, x: { label: 'c', domain: [-1.5, 16] }, y: { label: 'f(c)' }, crosshair: true, crosshairTitle: (v) => 'c = ' + U.fmt(v, 2),
      table: () => {
        const P = path();
        return { columns: ['k', 'c_k', 'средняя сила −f′(c_k)', 'f(c_k)'], rows: P.map((c, k) => [k, c, U.mean(FLATS.map((y) => LOSS[s.loss].pull(y, c))), LOSS[s.loss].f(c)]) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'c', label: 'c_k' }, { key: 'pull', label: 'Средняя сила −f′(c)' }, { key: 'f', label: 'f(c_k)' }, { key: 'opt', label: 'Минимум' }]);
    function path() {
      const L = LOSS[s.loss];
      const cs = [s.c0];
      for (let k = 0; k < MAXK; k++) {
        const c = cs[k];
        cs.push(c + s.eta * U.mean(FLATS.map((y) => L.pull(y, c))));
      }
      return cs;
    }
    function draw() {
      const L = LOSS[s.loss];
      const cs = path();
      const c = cs[s.k];
      const pulls = FLATS.map((y) => L.pull(y, c));
      const mean = U.mean(pulls);
      const rows = U.range(6).map((i) => i + 1);
      const scale = s.loss === 'l1' ? 1.6 : 1; // стрелку единичной силы рисуем длиной 1.6 для наглядности
      const ar = { x1: [], y1: [], x2: [], y2: [] };
      pulls.forEach((p, i) => {
        if (Math.abs(p) < 1e-9) return;
        ar.x1.push(c);
        ar.y1.push(rows[i]);
        ar.x2.push(c + scale * p);
        ar.y2.push(rows[i]);
      });
      const layers = [
        { type: 'vline', x: c, color: 'model', width: 2, text: 'c_k' },
        { type: 'arrows', ...ar, color: 'residual', width: 1.6 },
        { type: 'points', x: FLATS, y: rows, color: 'data', r: 5, label: 'цены квартир', tooltip: (i) => [{ label: 'площадь', value: AREAS[i] + ' м²' }, { label: 'цена y', value: FLATS[i] + ' млн' }, { label: 'сила', value: U.fmtSigned(pulls[i], 3) }] },
      ];
      if (Math.abs(mean) > 1e-9) layers.push({ type: 'arrows', x1: [c], y1: [0], x2: [c + scale * mean], y2: [0], color: 'tree', width: 3 });
      layers.push({ type: 'points', x: [c + s.eta * mean], y: [0], color: 'model', r: 5, hollow: true, label: 'c_{k+1} = c_k + η·сила' });
      layers.push({ type: 'text', items: FLATS.map((y, i) => ({ x: y, y: rows[i], dx: 9, dy: 4, text: 'сила ' + U.fmtSigned(pulls[i], 1) })) });
      if (Math.abs(mean) > 1e-9) layers.push({ type: 'text', items: [{ x: c + scale * mean, y: 0, dx: mean > 0 ? 8 : -8, dy: 4, anchor: mean > 0 ? 'start' : 'end', text: '−f′(c) = ' + U.fmtSigned(mean, 2) }] });
      top.render(layers);
      const gc = U.linspace(-1.5, 16, 300);
      const vis = cs.slice(0, s.k + 1);
      bottom.render([
        { type: 'line', x: gc, y: gc.map(L.f), color: 'model', width: 2.2, label: 'f(c) = ' + L.label },
        { type: 'line', x: vis, y: vis.map(L.f), color: 'ink2', width: 1, dash: '3 3', hover: false },
        { type: 'points', x: vis, y: vis.map(L.f), color: (i) => (i === s.k ? 'tree' : 'ink'), r: (i) => (i === s.k ? 6 : 3.5), label: 'путь спуска' },
      ]);
      stats.set('c', U.fmt(c, 4));
      stats.set('pull', U.fmtSigned(mean, 4));
      stats.set('f', U.fmt(L.f(c), 4));
      stats.set('opt', s.loss === 'l2' ? 'c = 7 (среднее)' : 'c ∈ [5, 8] (медианы)');
      note.innerHTML = s.loss === 'l2'
        ? 'Сила каждой квартиры равна её остатку: чем дальше цена, тем сильнее тянет. Средняя сила ȳ − c = 7 − c, поэтому шаг c ← c + η·(7 − c) умножает расстояние до среднего на (1 − η). ' +
          (s.eta > 2 + 1e-9 ? '<b>η > 2 — разнос: каждый шаг перелетает всё дальше.</b>' : Math.abs(s.eta - 2) < 1e-9 ? '<b>η = 2: множитель −1 — точка вечно качается между ' + U.fmt(s.c0, 1) + ' и ' + U.fmt(14 - s.c0, 1) + ', не приближаясь.</b>' : s.eta > 1 + 1e-9 ? 'При 1 < η < 2 точка перелетает среднее, но приближается.' : Math.abs(s.eta - 1) < 1e-9 ? 'При η = 1 — сразу в среднее.' : '') +
          ' Это и есть «бустинг одного числа» из урока 1.'
        : 'Для MAE каждая квартира тянет с силой ±1 (стрелки на рисунке удлинены в 1.6 раза), как бы далеко ни была: дорогая квартира за 13 млн тянет не сильнее квартиры за 8. Равновесие — там, где сил вверх и вниз поровну. При чётном числе квартир это целый отрезок [5, 8]: внутри него средняя сила равна нулю, и спуск останавливается в первой точке, куда попал. Медиана из учебника, 6.5, — лишь середина этого отрезка.';
    }
    w.pythonAction(() =>
      'import numpy as np\n\ny = np.array([3, 5, 4, 8, 9, 13.])\nc, eta = ' + U.pyNum(s.c0) + ', ' + U.pyNum(s.eta) + '\nfor k in range(' + Math.max(s.k, 1) + '):\n' +
      '    pull = ' + (s.loss === 'l2' ? 'y - c                     # сила квартиры для ½·MSE: остаток' : 'np.sign(y - c)            # сила для MAE: знак остатка') + '\n' +
      '    print(f"k = {k:2d}: c = {c:.4f}, средняя сила = {pull.mean():+.4f}")\n    c = c + eta * pull.mean()       # шаг против производной: −f′(c) = средняя сила\nprint(f"после спуска: c = {c:.4f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * step-guarantee — f после одного шага как функция темпа η
   * ================================================================================= */
  GBC.widget('step-guarantee', (el) => {
    const half = (c) => U.mean(FLATS.map((y) => 0.5 * (y - c) ** 2));
    const FN = {
      flats: { label: 'Квартиры, ½·MSE', f: half, df: (c) => c - 7, d2f: () => 1, dom: [-2, 16], t: 0, etaMax: 2.5, py: ['np.mean(0.5 * (y - t) ** 2)', 't - y.mean()', '1'] },
      logloss: { ...FUNCS.logloss, label: 'Log-loss (30 % единиц)', dom: [-3, 3], t: 0, etaMax: 14 },
      quartic: { ...FUNCS.quartic, label: 'Плоское дно θ⁴/4', dom: [-2, 2], t: 1.5, etaMax: 1.1 },
    };
    const s = { fn: 'flats', t: 0, eta: 0.1 };
    const w = ui.shell(el, {
      title: 'Один шаг: что обещает касательная и что получается на самом деле',
      sub: 'Слева — значение функции после одного шага θ − η·f′(θ) в зависимости от темпа η. Касательная обещает выигрыш η·f′² (оранжевый пунктир) и не знает, где остановиться; настоящая кривая (синяя) сначала идёт за ней, потом отстаёт и поднимается. Зелёная зона — темпы, при которых функция уменьшилась.',
    });
    // ползунок точки — доля области определения функции (у функций разные области)
    const pos = (t) => (t - FN[s.fn].dom[0]) / (FN[s.fn].dom[1] - FN[s.fn].dom[0]);
    const at = (p) => FN[s.fn].dom[0] + p * (FN[s.fn].dom[1] - FN[s.fn].dom[0]);
    ui.select(w.controls, {
      label: 'Функция', options: Object.entries(FN).map(([k, v]) => ({ value: k, label: v.label })), value: s.fn,
      onChange: (v) => ((s.fn = v), (s.t = FN[v].t), (s.eta = FN[v].etaMax / 25), tCtl.set(pos(s.t)), etaCtl.setMax(FN[v].etaMax), etaCtl.set(s.eta), draw()),
    });
    const tCtl = ui.slider(w.controls, { label: 'Текущая точка θ', min: 0, max: 1, step: 0.0025, value: pos(s.t), format: (v) => U.fmt(at(v), 2), onInput: (v) => ((s.t = at(v)), draw()) });
    const etaCtl = ui.slider(w.controls, { label: 'Темп η', min: 0, max: FN[s.fn].etaMax, step: 0.01, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, {
      height: 300, x: { label: 'темп η' }, y: { label: 'f после шага' }, crosshair: true, crosshairTitle: (v) => 'η = ' + U.fmt(v, 3),
      table: () => {
        const F = FN[s.fn];
        const t = U.clamp(s.t, F.dom[0], F.dom[1]);
        const g = F.df(t);
        // у квартир — те же темпы, что в таблице шага 5 урока
        const es = s.fn === 'flats' ? [0.1, 0.25, 0.5, 1, 1.5, 2, 2.5] : U.linspace(0, F.etaMax, 11).slice(1);
        return { columns: ['η', 'θ − η·f′', 'по касательной', 'на самом деле', 'выигрыш', 'доля обещания'], rows: es.map((e) => [e, t - e * g, F.f(t) - e * g * g, F.f(t - e * g), F.f(t) - F.f(t - e * g), g === 0 ? '—' : (F.f(t) - F.f(t - e * g)) / (e * g * g)]) };
      },
    });
    const p2 = new GBC.Plot(box, { height: 300, x: { label: 'θ' }, y: { label: 'f(θ)' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'f', label: 'f(θ) сейчас' }, { key: 'lin', label: 'Обещание касательной' }, { key: 'act', label: 'На самом деле' }, { key: 'best', label: 'Лучший η' }]);
    function draw() {
      const F = FN[s.fn];
      const t = U.clamp(s.t, F.dom[0], F.dom[1]);
      const g = F.df(t);
      const f0 = F.f(t);
      p2.opts.x.label = s.fn === 'flats' ? 'c' : 'θ';
      const etas = U.linspace(0, F.etaMax, 400);
      const after = etas.map((e) => F.f(t - e * g));
      const eta = Math.min(s.eta, F.etaMax);
      const fe = F.f(t - eta * g);
      // зелёная зона: где f после шага меньше f(θ)
      const bands = [];
      let start = null;
      etas.forEach((e, i) => {
        const ok = after[i] < f0 - 1e-12;
        if (ok && start === null) start = e;
        if ((!ok || i === etas.length - 1) && start !== null) bands.push({ type: 'vband', x0: start, x1: e, color: 'good', opacity: 0.1 }), (start = null);
      });
      const best = etas[U.argmax(after.map((v) => -v))];
      // правая граница зелёной зоны: последний темп, при котором функция ещё уменьшилась
      let edge = 0;
      etas.forEach((e, i) => {
        if (after[i] < f0 - 1e-12) edge = e;
      });
      const span = Math.max(f0, ...after.filter(Number.isFinite)) - Math.min(...after);
      const lo = Math.min(...after) - 0.15 * (span + 0.1);
      const hi = f0 + 0.6 * (span + 0.1);
      p1.render(bands.concat([
        { type: 'hline', y: f0, color: 'ink2', dash: '4 3', width: 1, text: 'f(θ) — без шага' },
        { type: 'line', x: etas, y: etas.map((e) => f0 - e * g * g), color: 'tree', dash: '6 4', width: 1.8, label: 'по касательной: f − η·f′²' },
        { type: 'line', x: etas, y: after, color: 'model', width: 2.2, label: 'на самом деле: f(θ − η·f′)' },
        { type: 'points', x: [eta], y: [fe], color: 'ink', r: 5.5, label: 'ваш η' },
      ]), { x: [0, F.etaMax], y: [lo, hi] });
      const gx = U.linspace(F.dom[0], F.dom[1], 300);
      const fy = gx.map(F.f);
      const [ylo, yhi] = U.extent(fy);
      const t1 = t - eta * g;
      p2.render([
        { type: 'line', x: gx, y: fy, color: 'model', width: 2.2, label: 'f(θ)' },
        { type: 'line', x: [F.dom[0], F.dom[1]], y: [f0 + g * (F.dom[0] - t), f0 + g * (F.dom[1] - t)], color: 'tree', dash: '6 4', width: 1.6, label: 'касательная' },
        { type: 'arrows', x1: [t], y1: [f0], x2: [t1], y2: [F.f(t1)], color: 'ink2', width: 1.4 },
        { type: 'points', x: [t], y: [f0], color: 'ink', r: 5.5, hollow: true, label: 'θ' },
        { type: 'points', x: [t1], y: [F.f(t1)], color: 'ink', r: 5.5, label: 'после шага' },
      ], { x: F.dom, y: [ylo - 0.08 * (yhi - ylo), yhi + 0.08 * (yhi - ylo)] });
      stats.set('f', U.fmt(f0, 4));
      stats.set('lin', U.fmt(f0 - eta * g * g, 4));
      stats.set('act', U.fmt(fe, 4), fe - f0);
      stats.set('best', '≈ ' + U.fmt(best, 2));
      const lead = s.fn === 'flats'
        ? 'Для параболы всё считается точно: f(θ − η·f′) = f(θ) − η·(1 − η·a/2)·f′², где a = f″ = 1. Выигрыш положителен при 0 < η < 2/a = 2 и максимален при η = 1/a = 1. '
        : s.fn === 'logloss'
          ? 'Кривизна log-loss мала (f″ ≤ 0.25), поэтому касательная «верна» долго: из θ = ' + U.fmt(t, 2) + ' функция уменьшается при темпах примерно до ' + U.fmt(edge, 1) + ', а лучший темп ≈ ' + U.fmt(best, 2) + ' — между 1/f″ в этой точке (' + U.fmt(1 / F.d2f(t), 2) + ') и у дна (1/0.21 ≈ 4.76). Лемма о спуске гарантирует уменьшение при η < 2/0.25 = 8 из любой точки. '
          : 'У θ⁴/4 кривизна быстро растёт при удалении от нуля: касательная врёт уже на небольших шагах. ';
      note.innerHTML = lead + (fe > f0 + 1e-12
        ? '<b>При η = ' + U.fmt(eta, 2) + ' функция выросла</b>: шаг улетел туда, где касательная уже не похожа на функцию.'
        : 'При η = ' + U.fmt(eta, 2) + ' касательная обещала ' + U.fmt(eta * g * g, 3) + ', получили ' + U.fmt(f0 - fe, 3) + '. Чем меньше η, тем точнее обещание: при малом шаге выигрыш ≈ η·f′².');
    }
    w.pythonAction(() => {
      const F = FN[s.fn];
      return 'import numpy as np\n\n' + (s.fn === 'flats' ? 'y = np.array([3, 5, 4, 8, 9, 13.])\n' : '') + 'f = lambda t: ' + F.py[0] + '\ndf = lambda t: ' + F.py[1] + '\n\nt = ' + U.pyNum(Number(s.t.toFixed(3))) + '\ng = df(t)\n' +
        'print(f"f(θ) = {f(t):.4f}, f′(θ) = {g:.4f}")\nfor eta in np.linspace(0, ' + U.pyNum(F.etaMax) + ', 11):\n    print(f"η = {eta:5.2f}: касательная обещает {f(t) - eta * g**2:9.4f}, на самом деле {f(t - eta * g):9.4f}")\n';
    });
    draw();
  });

  /* =================================================================================
   * eta-map — карта темпа + путь θ_k
   * ================================================================================= */
  GBC.widget('eta-map', (el) => {
    const s = { a: 1, eta: 0.5 };
    const w = ui.shell(el, {
      title: 'Карта темпа: сколько шагов до минимума',
      sub: 'Для параболы f(θ) = ½·a·θ² каждый шаг умножает расстояние до минимума на (1 − η·a). Вверху — путь θₖ при выбранном темпе, в середине — модуль множителя, внизу — сколько шагов нужно, чтобы расстояние уменьшилось в 100 раз.',
    });
    ui.slider(w.controls, { label: 'Кривизна a = f″', min: 0.5, max: 8, step: 0.1, value: s.a, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'Ваш темп η', min: 0.01, max: 2.5, step: 0.01, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    const p0 = new GBC.Plot(w.main, { height: 190, x: { label: 'шаг k', domain: [0, 12] }, y: { label: 'θ_k', domain: [-2.2, 2.2] }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 200, x: { label: 'темп η', domain: [0, 2.5] }, y: { label: '|1 − η·a|', domain: [0, 2.2] }, crosshair: true, crosshairTitle: (v) => 'η = ' + U.fmt(v, 3) });
    const p2 = new GBC.Plot(box, { height: 200, x: { label: 'темп η', domain: [0, 2.5] }, y: { label: 'шагов до 1 %', domain: [0, 60] }, crosshair: true, crosshairTitle: (v) => 'η = ' + U.fmt(v, 3) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'k', label: 'Множитель 1 − η·a' }, { key: 'n', label: 'Шагов до 1 %' }, { key: 'best', label: 'Лучший темп 1/a' }, { key: 'lim', label: 'Граница 2/a' }]);
    const etas = U.linspace(0.002, 2.5, 1250);
    const nSteps = (eta) => {
      const k = Math.abs(1 - eta * s.a);
      if (k < 1e-9) return 1;
      if (k >= 1) return Infinity;
      return Math.ceil(Math.log(0.01) / Math.log(k) - 1e-12);
    };
    function draw() {
      const k = 1 - s.eta * s.a;
      const ks = U.range(13);
      const th = ks.map((i) => Math.pow(k, i));
      const bad = Math.abs(k) >= 1;
      p0.render([
        { type: 'hline', y: 0, color: 'ink2', dash: '4 3', width: 1, text: 'минимум θ* = 0' },
        { type: 'line', x: ks, y: th.map((v) => (Math.abs(v) > 2.6 ? null : v)), color: bad ? 'critical' : 'model', width: 2, label: 'θ_k = (1 − η·a)^k·θ₀' },
        { type: 'points', x: ks, y: th.map((v) => (Math.abs(v) > 2.6 ? null : v)), color: bad ? 'critical' : 'model', r: 3.5, legend: false },
      ]);
      const ns = etas.map(nSteps).map((v) => (v === Infinity ? null : Math.min(v, 60)));
      p1.render([
        { type: 'vband', x0: 2 / s.a, x1: 2.5, color: 'critical', opacity: 0.08 },
        { type: 'hline', y: 1, color: 'ink2', dash: '4 3', width: 1, text: 'граница: множитель 1' },
        { type: 'line', x: etas, y: etas.map((e) => Math.abs(1 - e * s.a)), color: 'model', width: 2.2, label: '|1 − η·a|' },
        { type: 'vline', x: 1 / s.a, color: 'tree', dash: '3 3', width: 1.2 },
        { type: 'points', x: [s.eta], y: [Math.min(Math.abs(k), 2.2)], color: 'ink', r: 5.5 },
      ]);
      p2.render([
        { type: 'vband', x0: 2 / s.a, x1: 2.5, color: 'critical', opacity: 0.08 },
        { type: 'line', x: etas, y: ns, color: 'model', width: 2.2, label: 'шагов до 1 %' },
        { type: 'vline', x: 1 / s.a, color: 'tree', dash: '3 3', width: 1.2, text: 'η = 1/a' },
        { type: 'points', x: [s.eta], y: [Math.min(nSteps(s.eta), 60)], color: 'ink', r: 5.5 },
      ]);
      const n = nSteps(s.eta);
      stats.set('k', U.fmt(k, 3));
      stats.set('n', n === Infinity ? 'никогда' : String(n));
      stats.set('best', U.fmt(1 / s.a, 3));
      stats.set('lim', U.fmt(2 / s.a, 3));
      note.innerHTML = (bad
        ? '<b>Расходимость:</b> η ≥ 2/a = ' + U.fmt(2 / s.a, 3) + ', |множитель| ≥ 1, и каждый шаг отбрасывает дальше от минимума (красная зона).'
        : Math.abs(k) < 1e-9
          ? '<b>Идеальный темп η = 1/a:</b> множитель 0 — минимум за один шаг.'
          : k < 0
            ? 'Перелёт: 1/a < η < 2/a — точка прыгает через минимум, но приближается. Обратите внимание: η = ' + U.fmt(s.eta, 2) + ' и η = ' + U.fmt(2 / s.a - s.eta, 2) + ' дают одинаковый |множитель| — одинаковую скорость, только с разных сторон.'
            : 'Осторожный режим: η < 1/a — монотонное, но более медленное приближение.') +
        (n !== Infinity && n > 1 ? ' Число шагов: k = ln 0.01 / ln|1 − η·a| = ' + U.fmt(Math.log(0.01) / Math.log(Math.abs(k)), 2) + ' → ' + n + '.' : '');
    }
    w.pythonAction(() =>
      'import numpy as np\n\na = ' + U.pyNum(s.a) + '                   # кривизна параболы f = a/2·θ²\nfor eta in [0.1 / a, 0.5 / a, 1 / a, 1.5 / a, 1.9 / a, 2.1 / a]:\n    t = 1.0\n    for k in range(1, 201):\n        t = t - eta * a * t        # θ ← θ − η·f′(θ)\n        if abs(t) < 0.01:\n            break\n' +
      '    print(f"η = {eta:.3f} (η·a = {eta * a:.2f}): множитель {1 - eta * a:+.2f}, " + (f"шагов до 1 %: {k}" if abs(t) < 0.01 else "не сошлось"))\n'
    );
    draw();
  });

  /* =================================================================================
   * gd-1d — градиентный спуск по одной переменной (функции, способы шага, data-config)
   * ================================================================================= */
  GBC.widget('gd-1d', (el, cfg = {}) => {
    const ALL = [
      { value: 'const', label: 'Постоянный темп η' },
      { value: 'decay', label: 'Затухающий темп η/(1 + k/10)' },
      { value: 'back', label: 'Поиск с возвратом' },
      { value: 'newton', label: 'Шаг Ньютона: η = 1/f″' },
    ];
    const MODES = cfg.modes ? ALL.filter((m) => cfg.modes.includes(m.value)) : ALL;
    const fn0 = cfg.fn && FUNCS[cfg.fn] ? cfg.fn : 'parabola';
    const s = { fn: fn0, eta: cfg.eta || 0.2, t0: cfg.t0 ?? FUNCS[fn0].t0, steps: cfg.steps || 12, mode: cfg.mode || MODES[0].value };
    const w = ui.shell(el, { title: cfg.title || 'Градиентный спуск по одной переменной', sub: 'Точки — путь спуска θ₀ → θ₁ → … Оранжевые отрезки — касательные: их наклон — производная. Справа — кривая потерь f(θₖ) по шагам.' });
    ui.select(w.controls, { label: 'Функция', options: Object.entries(FUNCS).map(([k, v]) => ({ value: k, label: v.label })), value: s.fn, onChange: (v) => ((s.fn = v), (s.t0 = FUNCS[v].t0), t0Ctl.input.min = FUNCS[v].dom[0] + 0.1, t0Ctl.input.max = FUNCS[v].dom[1] - 0.1, t0Ctl.set(s.t0), draw()) });
    if (MODES.length > 1) ui.select(w.controls, { label: 'Как выбирать шаг', options: MODES, value: s.mode, onChange: (v) => ((s.mode = v), (etaCtl.el.hidden = v === 'newton'), draw()) });
    // дискретные значения темпа: так можно точно повторить числа из текста урока
    const ETAS = [0.01, 0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.33, 0.4, 0.5, 0.6, 0.67, 0.7, 0.8, 1, 1.5, 2, 3, 4];
    const etaCtl = ui.slider(w.controls, { label: s.mode === 'const' && MODES.length === 1 ? 'Темп обучения η' : 'Темп обучения η (начальный)', values: ETAS, value: s.eta, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.eta = v), draw()) });
    etaCtl.el.hidden = s.mode === 'newton';
    const t0Ctl = ui.slider(w.controls, { label: 'Старт θ₀', min: FUNCS[s.fn].dom[0] + 0.1, max: FUNCS[s.fn].dom[1] - 0.1, step: 0.01, value: s.t0, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.t0 = v), draw()) });
    ui.slider(w.controls, { label: 'Шагов', min: 1, max: 200, step: 1, value: s.steps, format: String, onInput: (v) => ((s.steps = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 300, x: { label: 'θ' }, y: { label: 'f(θ)' } });
    const p2 = new GBC.Plot(box, {
      height: 300, x: { label: 'шаг k' }, y: { label: 'f(θ_k)' }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v),
      table: () => {
        const F = FUNCS[s.fn];
        const P = path();
        return { columns: ['k', 'θ_k', 'f(θ_k)', 'f′(θ_k)', 'темп η_k'], rows: P.ts.map((t, k) => [k, t, F.f(t), F.df(t), k < P.etas.length ? P.etas[k] : '—']) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 't', label: 'θ после спуска' }, { key: 'f', label: 'f(θ)' }, { key: 'g', label: 'f′(θ)' }, { key: 'e', label: 'Последний темп η' }]);
    /** Путь спуска и фактические темпы η_k (для Ньютона η_k = 1/f″). */
    function path() {
      const F = FUNCS[s.fn];
      const ts = [s.t0];
      const etas = [];
      for (let k = 0; k < s.steps; k++) {
        const t = ts[ts.length - 1];
        const g = F.df(t);
        let eta = s.eta;
        if (s.mode === 'newton') {
          const h = F.d2f(t);
          eta = h > 1e-9 ? 1 / h : 0.05;
        } else if (s.mode === 'decay') eta = s.eta / (1 + k / 10);
        else if (s.mode === 'back') {
          // поиск с возвратом (правило Армихо): делим шаг пополам, пока f не уменьшится хотя бы на ½·η·f′²
          let tries = 0;
          while (F.f(t - eta * g) > F.f(t) - 0.5 * eta * g * g && tries < 40) (eta /= 2), tries++;
        }
        const nt = t - eta * g;
        if (!Number.isFinite(nt) || Math.abs(nt) > 1e6) break;
        ts.push(nt);
        etas.push(eta);
      }
      return { ts, etas };
    }
    function draw() {
      const F = FUNCS[s.fn];
      const { ts, etas } = path();
      const [x0, x1] = F.dom;
      const gx = U.linspace(x0, x1, 400);
      const vis = ts.filter((t) => t >= x0 - 0.2 && t <= x1 + 0.2);
      const tan = { x1: [], y1: [], x2: [], y2: [] };
      const dd = 0.075 * (x1 - x0);
      vis.slice(0, 15).forEach((t) => {
        tan.x1.push(t - dd);
        tan.x2.push(t + dd);
        tan.y1.push(F.f(t) - dd * F.df(t));
        tan.y2.push(F.f(t) + dd * F.df(t));
      });
      const fy = gx.map(F.f);
      const [ylo, yhi] = U.extent(fy);
      const pad = 0.08 * (yhi - ylo);
      p1.render([
        { type: 'line', x: gx, y: fy, color: 'model', width: 2.2, label: 'f(θ)' },
        { type: 'segments', ...tan, color: 'tree', width: 2, opacity: 0.9 },
        { type: 'line', x: vis, y: vis.map(F.f), color: 'ink2', width: 1, dash: '3 3', hover: false },
        { type: 'points', x: vis, y: vis.map(F.f), color: 'ink', r: 4, label: 'путь спуска', tooltip: (i) => [{ label: 'k', value: String(i) }, { label: 'θ', value: U.fmt(vis[i], 4) }, { label: 'f′(θ)', value: U.fmt(F.df(vis[i]), 3) }] },
      ], { x: [x0, x1], y: [ylo - pad, yhi + pad] });
      const ks = U.range(ts.length);
      p2.render([{ type: 'line', x: ks, y: ts.map(F.f), color: 'model', label: 'f(θ_k)' }, { type: 'points', x: ks, y: ts.map(F.f), color: 'model', r: 3, legend: false }]);
      const last = ts[ts.length - 1];
      stats.set('t', U.fmt(last, 4));
      stats.set('f', U.fmt(F.f(last), 4));
      stats.set('g', U.fmt(F.df(last), 3));
      stats.set('e', etas.length ? U.fmt(etas[etas.length - 1], 3) : '—');
      const diverged = ts.length < s.steps + 1 || Math.abs(last) > Math.max(Math.abs(s.t0), 1) * 3;
      // «качели»: точка вернулась туда же через два шага, хотя наклон не нулевой
      const cycle = ts.length > 3 && Math.abs(last - ts[ts.length - 3]) < 1e-6 && Math.abs(F.df(last)) > 1e-3;
      let msg;
      if (s.mode === 'newton') {
        msg = s.fn === 'abs'
          ? 'У |θ| вторая производная равна нулю — шаг Ньютона не определён (виджет делает маленький шаг 0.05·f′). Так же и у абсолютных потерь в бустинге: для них значения листьев считают иначе (урок 5.3).'
          : s.fn === 'quartic'
            ? 'На плоском дне f″ → 0 вместе с f′: шаг Ньютона каждый раз уменьшает θ лишь в 3/2 раза. Даже Ньютон не спасает, если кривизна в минимуме нулевая.'
            : s.fn === 'pits'
              ? 'Между θ ≈ −0.82 и 0.82 кривизна отрицательна («шапка»): там шаг −f′/f″ повёл бы к максимуму, поэтому виджет делает маленький шаг спуска. Где кривизна положительна, Ньютон берёт темп η = 1/f″ сам.'
              : 'Шаг Ньютона сам выбирает темп по кривизне: η = 1/f″(θ) (столбец «темп» в таблице). Для параболы он попадает в минимум за один шаг, рядом с минимумом гладкой функции — число верных знаков удваивается на каждом шаге.';
      } else if (s.mode === 'decay') {
        msg = 'Затухающий темп η<sub>k</sub> = η/(1 + k/10): в начале шаги смелые, потом всё осторожнее. ' +
          (s.fn === 'abs' ? 'Для |θ| это лечит «дребезг»: амплитуда колебаний равна текущему шагу и уменьшается вместе с ним.' : 'Плата — медленный финиш: шаг уменьшается, даже когда уменьшать его не нужно.') +
          ' Сумма темпов η<sub>k</sub> бесконечна (как гармонический ряд), поэтому шагов хватит, чтобы дойти до минимума выпуклой функции, — если спуск не улетит раньше, пока η<sub>k</sub> ещё больше границы 2/f″.';
      } else if (s.mode === 'back') {
        msg = 'Поиск с возвратом: пробуем шаг η и, если f уменьшилась меньше чем на ½·η·f′² (а тем более выросла), делим η пополам. Начните со слишком большого η: спуск больше не разлетается — он сам находит безопасный шаг. Столбец «темп» в таблице показывает, какой темп был принят.';
      } else if (s.fn === 'parabola') msg = 'Здесь θ<sub>k+1</sub> = (1 − 3η)·θ<sub>k</sub>. ' + (s.eta >= 2 / 3 ? '<b>η ≥ 2/3: |1 − 3η| ≥ 1 — расходимость.</b>' : s.eta > 1 / 3 ? 'η > 1/3: точка перепрыгивает минимум, но приближается.' : 'Монотонное приближение; η = 1/3 дало бы минимум за один шаг.');
      else if (s.fn === 'abs') msg = 'У |θ| производная всегда ±1: шаг не уменьшается у минимума, и точка «дребезжит» вокруг нуля с размахом η. Так ведут себя абсолютные потери (MAE). Лекарство — затухающий темп (шаг 8).';
      else if (s.fn === 'quartic') msg = 'На плоском дне производная θ³ почти нулевая: спуск резко замедляется. Из θ = 0.1 шаг с η = 0.5 сдвигает точку всего на 0.0005.';
      else if (s.fn === 'logloss') msg = 'Log-loss константы с 30 % единиц: минимум в логите ln(0.3/0.7) ≈ −0.847. Кривизна здесь мала (f″ ≤ 0.25), поэтому темп η = 1 слишком робок — попробуйте η ≈ 4.';
      else msg = diverged ? 'Спуск ушёл далеко — уменьшите η.' : 'У этой функции две ямы: глобальная у θ ≈ −1.48 (f ≈ −1.43) и локальная у θ ≈ 1.33 (f ≈ −0.59), между ними — горб у θ ≈ 0.15. Спуск скатывается в ту яму, на склоне которой стартовал. Сравните старты 0.16 и 0.14.';
      if (diverged && s.mode !== 'newton') msg = '<b>Спуск разлетелся:</b> темп больше границы 2/f″ там, где точка оказалась. ' + msg;
      else if (cycle && s.mode === 'const') msg = '<b>Качели:</b> точка прыгает между двумя значениями и не приближается — темп на границе 2/f″ у дна. ' + msg;
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const F = FUNCS[s.fn].py;
      const head = 'import numpy as np\n\nf = lambda t: ' + F[0] + '\ndf = lambda t: ' + F[1] + '\nd2f = lambda t: ' + F[2] + '\n\nt, eta0 = ' + U.pyNum(s.t0) + ', ' + U.pyNum(s.eta) + '\nfor k in range(' + s.steps + '):\n';
      const body = {
        const: '    eta = eta0\n',
        decay: '    eta = eta0 / (1 + k / 10)                # затухающий темп\n',
        back: '    eta = eta0\n    while f(t - eta * df(t)) > f(t) - 0.5 * eta * df(t) ** 2:\n        eta /= 2                                # поиск с возвратом (Армихо)\n',
        newton: '    h = d2f(t)\n    eta = 1 / h if h > 1e-9 else 0.05        # шаг Ньютона: η = 1/f″ (где f″ > 0)\n',
      }[s.mode];
      return head + body + '    t = t - eta * df(t)\n    print(f"шаг {k + 1:2d}: η = {eta:.4f}, θ = {t: .6f}, f(θ) = {f(t): .6f}, f′(θ) = {df(t): .2e}")\n';
    });
    draw();
  });

  /* =================================================================================
   * loss-doctor — диагноз по кривой потерь
   * ================================================================================= */
  GBC.widget('loss-doctor', (el) => {
    const d30 = GBC.datasets.regression1d({ kind: 'linear', n: 30, noise: 0.6, seed: 3 });
    const n30 = d30.x.length;
    const mx = U.mean(d30.x);
    const sx = Math.sqrt(U.mean(d30.x.map((v) => (v - mx) ** 2)));
    const z = d30.x.map((v) => (v - mx) / sx);
    const y30 = d30.y;
    const half = (a, b) => U.mean(z.map((v, i) => (y30[i] - a * v - b) ** 2)) / 2;
    /** Спуск для прямой ŷ = a·z + b: полный (B = 30) или по мини-пакетам (Mulberry32). */
    function line(eta, K, B = n30) {
      const rng = new GBC.RNG(1);
      let a = 0;
      let b = 0;
      const out = [half(a, b)];
      for (let k = 0; k < K; k++) {
        const idx = B < n30 ? rng.sample(n30, B) : U.range(n30);
        let ga = 0;
        let gb = 0;
        for (const i of idx) {
          const r = y30[i] - (a * z[i] + b);
          ga += r * z[i];
          gb += r;
        }
        a += (eta * ga) / idx.length;
        b += (eta * gb) / idx.length;
        out.push(half(a, b));
      }
      return out;
    }
    function kink() {
      let t = 2.05;
      const out = [t];
      for (let k = 0; k < 40; k++) (t -= 0.3 * Math.sign(t)), out.push(Math.abs(t));
      return out;
    }
    /** Седло ½θ₁² + ¼(θ₂² − 1)² из (1, 0.001), η = 0.1: плато около f = 0.25, потом обвал. */
    function saddle() {
      let t1 = 1;
      let t2 = 0.001;
      const f = () => 0.5 * t1 * t1 + 0.25 * (t2 * t2 - 1) ** 2;
      const out = [f()];
      for (let k = 0; k < 100; k++) {
        const g1 = t1;
        const g2 = (t2 * t2 - 1) * t2;
        t1 -= 0.1 * g1;
        t2 -= 0.1 * g2;
        out.push(f());
      }
      return out;
    }
    let boostCache = null;
    function boost() {
      if (boostCache) return boostCache;
      const tr = GBC.datasets.regression1d({ kind: 'wave', n: 60, noise: 0.35, seed: 7 });
      const va = GBC.datasets.regression1d({ kind: 'wave', n: 300, noise: 0.35, seed: 107 });
      const gb = new GBC.GradientBoosting({ nEstimators: 150, learningRate: 0.3, maxDepth: 3 }).fit(tr.X, tr.y);
      const c1 = new GBC.StageCache(gb, tr.X);
      const c2 = new GBC.StageCache(gb, va.X);
      const a = [];
      const b = [];
      for (let m = 0; m <= 150; m++) a.push(GBC.metrics.mse(tr.y, Array.from(c1.seek(m)))), b.push(GBC.metrics.mse(va.y, Array.from(c2.seek(m))));
      boostCache = { train: a, valid: b };
      return boostCache;
    }
    const DX = {
      slow: { label: 'Темп слишком мал', fix: 'Увеличьте η в 3–10 раз: кривая падает почти по прямой и далеко от полки — спуск верный, но медленный.' },
      good: { label: 'Темп в самый раз', fix: 'Ничего не менять: быстрое падение и ровная полка на уровне минимума.' },
      big: { label: 'Темп слишком велик — разнос', fix: 'Уменьшите η в 2–10 раз или включите поиск с возвратом: каждый шаг перелетает минимум всё дальше.' },
      noise: { label: 'Шум мини-пакетов (шаг 13)', fix: 'Это стохастический спуск с постоянным темпом: полка «дрожит» выше минимума. Уменьшайте η к концу обучения или увеличьте пакет.' },
      kink: { label: 'Излом и постоянный темп — дребезг', fix: 'Функция с изломом (как |θ| или MAE): шаг не уменьшается у дна, и точка прыгает с амплитудой η. Помогает затухающий темп.' },
      plateau: { label: 'Плато у седла (шаг 10) — рано сдаваться', fix: 'Наклон почти нулевой, но это не минимум, а седло: спуск медленно сползает с него и потом снова быстро падает. Не останавливайтесь только по малому наклону — смотрите, падают ли потери дальше (и на валидацию); пройти плато быстрее помогает инерция (шаг 11).' },
      overfit: { label: 'Переобучение — пора остановиться', fix: 'Ошибка на обучении падает, а на отложенных данных — растёт: модель запоминает шум. Остановитесь у минимума валидационной кривой (ранняя остановка).' },
    };
    const SCEN = [
      { key: 'good', make: () => ({ curves: [{ y: line(0.6, 40), label: 'потери на обучении', color: 'train' }], x: 'шаг k', py: 'eta, K, B = 0.6, 40, 30' }), more: 'Прямая для 30 точек, полный спуск с η = 0.6: за десяток шагов потери почти дошли до минимума и легли на полку.' },
      { key: 'big', make: () => ({ curves: [{ y: line(2.1, 40), label: 'потери на обучении', color: 'train' }], x: 'шаг k', py: 'eta, K, B = 2.1, 40, 30' }), more: 'Та же прямая, η = 2.1: кривизна равна 1, граница устойчивости 2/a = 2. Множитель 1 − η = −1.1 по модулю больше 1 — разнос.' },
      { key: 'noise', make: () => ({ curves: [{ y: line(0.3, 60, 1), label: 'потери на всех точках', color: 'train' }], x: 'шаг k', py: 'eta, K, B = 0.3, 60, 1' }), more: 'Та же прямая, но каждый шаг — по одной случайной точке (B = 1), η = 0.3: потери быстро падают, а потом «топчутся» выше минимума.' },
      { key: 'slow', make: () => ({ curves: [{ y: line(0.03, 40), label: 'потери на обучении', color: 'train' }], x: 'шаг k', py: 'eta, K, B = 0.03, 40, 30' }), more: 'Та же прямая, η = 0.03: каждый шаг сокращает расстояние до минимума лишь на 3 %. За 40 шагов не пройдено и двух третей пути.' },
      { key: 'overfit', make: () => { const B = boost(); return { curves: [{ y: B.train, label: 'обучение', color: 'train' }, { y: B.valid, label: 'новые данные', color: 'valid' }], x: 'деревьев M', py: null }; }, more: 'Бустинг деревьев глубины 3 с ν = 0.3 на 60 точках волны (данные урока 1). Ошибка на новых данных минимальна около 13 деревьев, дальше растёт: модель подгоняет шум.' },
      { key: 'plateau', make: () => ({ curves: [{ y: saddle(), label: 'f(θ₁, θ₂)', color: 'train' }], x: 'шаг k', py: 'saddle' }), more: 'Функция ½θ₁² + ¼(θ₂² − 1)², старт (1, 0.001), η = 0.1. Сначала спуск быстро скатывается к седлу (0, 0) — потери ложатся на полку около 0.25, а длина градиента к 35-му шагу падает до 0.038. Остановка по малому наклону закончила бы обучение здесь. Но θ₂ понемногу растёт (умножается на 1.1 за шаг), после 60-го шага точка сползает с седла, и потери обваливаются к нулю.' },
      { key: 'kink', make: () => ({ curves: [{ y: kink(), label: 'f(θ) = |θ|', color: 'train' }], x: 'шаг k', py: 'kink' }), more: 'Спуск по |θ| с постоянным η = 0.3 из θ = 2.05: наклон всегда ±1, поэтому шаг не уменьшается у дна, и потери «пилят» между 0.05 и 0.25.' },
    ];
    const s = { i: 0, answered: {}, score: 0 };
    const w = ui.shell(el, {
      title: 'Диагноз по кривой потерь',
      sub: 'Кривая потерь по шагам — главный прибор того, кто обучает модели. Посмотрите на кривую и поставьте диагноз: что происходит со спуском и что делать?',
    });
    const counter = H('div', { class: 'ctl-help', style: 'font-weight:650' });
    w.controls.appendChild(counter);
    const opts = H('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
    w.controls.appendChild(opts);
    const optBtns = Object.entries(DX).map(([k, v]) => {
      const b = ui.button(opts, { label: v.label, small: true, onClick: () => answer(k) });
      Object.assign(b.style, { whiteSpace: 'normal', textAlign: 'left', width: '100%', justifyContent: 'flex-start', lineHeight: '1.3' });
      return b;
    });
    const nav = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' } });
    w.controls.appendChild(nav);
    ui.button(nav, { label: '← Назад', small: true, kind: 'ghost', onClick: () => go(s.i - 1) });
    ui.button(nav, { label: 'Следующая →', small: true, kind: 'primary', onClick: () => go(s.i + 1) });
    const plot = new GBC.Plot(w.main, {
      height: 280, x: { label: 'шаг k' }, y: { label: 'потери' }, crosshair: true,
      table: () => {
        const C = SCEN[s.i].make();
        return { columns: [C.x].concat(C.curves.map((c) => c.label)), rows: C.curves[0].y.map((v, k) => [k].concat(C.curves.map((c) => (Number.isFinite(c.y[k]) ? c.y[k] : '∞')))) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'n', label: 'Кривая' }, { key: 'score', label: 'Верных диагнозов' }]);
    function go(i) {
      s.i = (i + SCEN.length) % SCEN.length;
      draw();
    }
    function answer(k) {
      const sc = SCEN[s.i];
      if (s.answered[s.i] === undefined) {
        s.answered[s.i] = k;
        if (k === sc.key) s.score++;
      }
      draw();
    }
    function draw() {
      const sc = SCEN[s.i];
      const C = sc.make();
      const first = C.curves[0].y;
      const ks = U.range(first.length);
      const top = Math.max(...C.curves.map((c) => c.y[0])) * 1.25;
      const layers = C.curves.map((c) => ({ type: 'line', x: ks, y: c.y.map((v) => (v > 3 * top ? null : v)), color: c.color, width: 2.2, label: c.label }));
      layers.push({ type: 'points', x: ks, y: first.map((v) => (v > 3 * top ? null : v)), color: C.curves[0].color, r: 2.4, legend: false });
      plot.opts.x.label = C.x;
      plot.render(layers, { x: [0, ks.length - 1], y: [0, top] });
      counter.textContent = 'Кривая ' + (s.i + 1) + ' из ' + SCEN.length;
      stats.set('n', (s.i + 1) + ' / ' + SCEN.length);
      stats.set('score', s.score + ' из ' + Object.keys(s.answered).length);
      const a = s.answered[s.i];
      optBtns.forEach((b, j) => {
        const key = Object.keys(DX)[j];
        b.classList.toggle('primary', a !== undefined && key === sc.key);
        b.disabled = false;
      });
      if (a === undefined) note.innerHTML = 'Как ведёт себя кривая: падает ли она, как быстро, выходит ли на полку, дрожит, растёт? Выберите диагноз слева.';
      else note.innerHTML = (a === sc.key ? '<b>Верно: ' : '<b>Не совсем. Правильный диагноз: ') + DX[sc.key].label.toLowerCase() + '.</b> ' + sc.more + ' <em>Что делать:</em> ' + DX[sc.key].fix;
    }
    w.pythonAction(() => {
      const sc = SCEN[s.i];
      const C = sc.make();
      if (sc.key === 'overfit')
        return 'from gbcourse import datasets, GBRegressor\nfrom gbcourse.metrics import mse\n\nX, y = datasets.regression_1d(kind="wave", n=60, noise=0.35, seed=7)\nXv, yv = datasets.regression_1d(kind="wave", n=300, noise=0.35, seed=107)\n' +
          'gb = GBRegressor(n_estimators=150, learning_rate=0.3, max_depth=3).fit(X, y)\nvalid = [mse(yv, gb.predict(Xv, n_iter=m)) for m in range(151)]\nbest = min(range(151), key=lambda m: valid[m])\n' +
          'print(f"лучшее число деревьев {best}: MSE {valid[best]:.4f}; после 150 деревьев {valid[150]:.4f}")\n';
      if (C.py === 'saddle') return 'import numpy as np\n\nt = np.array([1.0, 0.001])                 # старт рядом с седлом (0, 0)\nf = lambda t: 0.5 * t[0]**2 + 0.25 * (t[1]**2 - 1)**2\nhist, grads = [f(t)], []\nfor k in range(100):\n    g = np.array([t[0], (t[1]**2 - 1) * t[1]])\n    grads.append(np.linalg.norm(g))\n    t = t - 0.1 * g\n    hist.append(f(t))\nprint("потери через 5 шагов:", np.round(hist[::5], 3))\nprint(f"самый пологий момент на плато: шаг {int(np.argmin(grads[:60]))}, |∇f| = {min(grads[:60]):.3f}")\n';
      if (C.py === 'kink') return 'import numpy as np\n\nt, hist = 2.05, []\nfor k in range(40):\n    t -= 0.3 * np.sign(t)           # спуск по |θ| с постоянным темпом\n    hist.append(abs(t))\nprint(np.round(hist[-8:], 3))     # «пила» у дна\n';
      return 'import numpy as np\nfrom gbcourse import datasets\nfrom gbcourse.rng import Mulberry32\n\nX, y = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)\nz = (X[:, 0] - X[:, 0].mean()) / X[:, 0].std()\nhalf = lambda a, b: np.mean((y - a * z - b) ** 2) / 2\n\n' +
        C.py + '\nrng, a, b, hist = Mulberry32(1), 0.0, 0.0, [half(0, 0)]\nfor k in range(K):\n    idx = rng.sample(30, B) if B < 30 else list(range(30))\n    r = y[idx] - (a * z[idx] + b)\n    a, b = a + eta * np.mean(r * z[idx]), b + eta * np.mean(r)\n    hist.append(half(a, b))\n' +
        'print(np.round(hist[:6], 4), "…", np.round(hist[-3:], 4))\n';
    });
    draw();
  });

  /* =================================================================================
   * newton-view — линейное и квадратичное приближение
   * ================================================================================= */
  GBC.widget('newton-view', (el) => {
    const keys = ['logloss', 'pits', 'quartic', 'parabola'];
    const s = { fn: 'logloss', t: 0, eta: 1 };
    const w = ui.shell(el, {
      title: 'Откуда берётся шаг Ньютона',
      sub: 'В точке θ функцию можно приблизить прямой (касательной) или параболой с той же кривизной. Градиентный спуск делает шаг η вдоль касательной, Ньютон — прыгает в дно параболы.',
    });
    const lim = () => [FUNCS[s.fn].dom[0] + 0.2, FUNCS[s.fn].dom[1] - 0.2];
    ui.select(w.controls, { label: 'Функция', options: keys.map((k) => ({ value: k, label: FUNCS[k].label })), value: s.fn, onChange: (v) => ((s.fn = v), (s.t = U.clamp(s.t, ...lim())), (tCtl.input.min = lim()[0]), (tCtl.input.max = lim()[1]), tCtl.set(s.t), draw()) });
    const tCtl = ui.slider(w.controls, { label: 'Текущая точка θ', min: -2.8, max: 2.8, step: 0.01, value: s.t, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.t = v), draw()) });
    ui.slider(w.controls, { label: 'Темп спуска η', min: 0.05, max: 5, log: true, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    const btns = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(btns);
    ui.button(btns, { label: 'Шаг Ньютона', small: true, kind: 'primary', onClick: () => step(true) });
    ui.button(btns, { label: 'Шаг спуска', small: true, onClick: () => step(false) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'θ', domain: [-3, 3] }, y: { label: 'f(θ)' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'g', label: 'f′(θ)' }, { key: 'h', label: 'f″(θ) — кривизна' }, { key: 'gd', label: 'Спуск: θ − η·f′' }, { key: 'nt', label: 'Ньютон: θ − f′/f″' }]);
    function step(newton) {
      const F = FUNCS[s.fn];
      const h = F.d2f(s.t);
      const nt = newton ? (h > 1e-9 ? s.t - F.df(s.t) / h : s.t) : s.t - s.eta * F.df(s.t);
      s.t = U.clamp(nt, ...lim());
      tCtl.set(s.t);
      draw();
    }
    function draw() {
      const F = FUNCS[s.fn];
      const t = s.t;
      const g = F.df(t);
      const h = F.d2f(t);
      const gx = U.linspace(F.dom[0], F.dom[1], 400);
      const fy = gx.map(F.f);
      const [lo, hi] = U.extent(fy);
      const tangent = gx.map((x) => F.f(t) + g * (x - t));
      const quad = gx.map((x) => F.f(t) + g * (x - t) + 0.5 * h * (x - t) * (x - t));
      const tGD = t - s.eta * g;
      const tN = h > 1e-9 ? t - g / h : null;
      const layers = [
        { type: 'line', x: gx, y: fy, color: 'ink2', width: 2.2, label: 'f(θ)' },
        { type: 'line', x: gx, y: tangent, color: 'tree', width: 1.6, dash: '6 4', label: 'касательная' },
      ];
      if (h > 1e-9) layers.push({ type: 'line', x: gx, y: quad, color: 'model', width: 2, label: 'парабола той же кривизны' });
      layers.push({ type: 'points', x: [t], y: [F.f(t)], color: 'ink', r: 6, label: 'θ' });
      layers.push({ type: 'points', x: [tGD], y: [F.f(tGD)], color: 'tree', r: 5.5, label: 'после шага спуска' });
      if (tN !== null) layers.push({ type: 'points', x: [tN], y: [F.f(tN)], color: 'model', r: 5.5, label: 'после шага Ньютона' });
      // стрелки шагов под графиком: спуск (оранжевая) и Ньютон (синяя) — на разной высоте, чтобы не закрывали друг друга
      const yA = lo - 0.03 * (hi - lo);
      const yB = lo - 0.08 * (hi - lo);
      const edge = (v) => U.clamp(v, F.dom[0], F.dom[1]);
      layers.push({ type: 'arrows', x1: [t], y1: [yA], x2: [edge(tGD)], y2: [yA], color: 'tree', width: 1.6 });
      if (tN !== null) layers.push({ type: 'arrows', x1: [t], y1: [yB], x2: [edge(tN)], y2: [yB], color: 'model', width: 1.6 });
      if (tN !== null && (tN < F.dom[0] || tN > F.dom[1])) layers.push({ type: 'text', items: [{ x: edge(tN), y: yB, dx: tN < F.dom[0] ? 6 : -6, dy: -6, anchor: tN < F.dom[0] ? 'start' : 'end', text: 'Ньютон → ' + U.fmt(tN, 2) }] });
      plot.render(layers, { x: F.dom, y: [lo - 0.12 * (hi - lo), hi + 0.08 * (hi - lo)] });
      stats.set('g', U.fmt(g, 4));
      stats.set('h', U.fmt(h, 4));
      stats.set('gd', U.fmt(tGD, 4));
      stats.set('nt', tN === null ? 'не определён' : U.fmt(tN, 4));
      const tMin = gx[U.argmax(fy.map((v) => -v))];
      const overshoot = tN !== null && Math.abs(tN - tMin) > Math.abs(t - tMin) + 1e-6;
      note.innerHTML = Math.abs(g) < 1e-9
        ? 'Здесь f′ = 0: мы стоим в стационарной точке, шагать некуда — ни спуску, ни Ньютону.'
        : h > 1e-9
        ? 'Парабола f(θ) + f′·Δ + ½·f″·Δ² имеет дно в Δ = −f′/f″: это и есть шаг Ньютона, то есть спуск с темпом η = 1/f″ = ' + U.fmt(1 / h, 3) + '. ' +
          (overshoot
            ? '<b>Но здесь Ньютон перелетел минимум:</b> вдали от дна парабола плохо описывает функцию, а малая кривизна даёт огромный шаг. Поэтому на практике шаг Ньютона ограничивают или уменьшают (в бустинге — темпом ν).'
            : s.fn === 'logloss' ? 'Для log-loss так считают значения листьев в классификации и весь XGBoost (уроки 6.2 и 8.1).' : 'Где кривизна большая, шаг короче; где маленькая — длиннее.')
        : h < -1e-9
          ? 'Здесь f″ < 0 («шапка»): парабола той же кривизны не имеет дна, и шаг −f′/f″ повёл бы к её вершине — к максимуму. Поэтому Ньютон применяют там, где кривизна положительна (выпуклые потери).'
          : 'Здесь f″ = 0: парабола вырождается в прямую, у неё нет дна, и шаг −f′/f″ не определён (деление на ноль).';
    }
    w.pythonAction(() => {
      const F = FUNCS[s.fn].py;
      return 'import numpy as np\n\nf = lambda t: ' + F[0] + '\ndf = lambda t: ' + F[1] + '\nd2f = lambda t: ' + F[2] + '\n\n' +
        'newton = lambda t: t - df(t) / d2f(t) if d2f(t) > 1e-9 else t   # Ньютон — только где кривизна положительна\n' +
        'for name, step in [("спуск η = ' + U.pyNum(s.eta) + '", lambda t: t - ' + U.pyNum(s.eta) + ' * df(t)), ("Ньютон", newton)]:\n' +
        '    t = ' + U.pyNum(Number(s.t.toFixed(3))) + '\n    for k in range(5):\n        t = step(t)\n    print(f"{name:12s}: после 5 шагов θ = {t:.8f}, f′(θ) = {df(t):.2e}")\n';
    });
    draw();
  });

  /* =================================================================================
   * slices-2d — рельеф двух параметров: линии уровня, срезы, частные производные
   * ================================================================================= */
  GBC.widget('slices-2d', (el) => {
    const FN = {
      bowl: {
        label: 'Чаша ½(θ₁² + 10θ₂²)', f: (a, b) => 0.5 * (a * a + 10 * b * b), g: (a, b) => [a, 10 * b], dom: [[-3.5, 3.5], [-1.6, 1.6]], p0: [1, 1],
        levels: [0.25, 1, 2.5, 5, 8], py: ['0.5 * (a**2 + 10 * b**2)', 'a', '10 * b'],
      },
      tilt: {
        label: 'Наклонная долина ½(θ₁² + θ₂²) + 0.8·θ₁θ₂', f: (a, b) => 0.5 * (a * a + b * b) + 0.8 * a * b, g: (a, b) => [a + 0.8 * b, b + 0.8 * a], dom: [[-3, 3], [-2, 2]], p0: [2, -0.4],
        levels: [0.1, 0.4, 1, 2, 3.5, 5.5], py: ['0.5 * (a**2 + b**2) + 0.8 * a * b', 'a + 0.8 * b', 'b + 0.8 * a'],
      },
      saddle: {
        label: 'Две ямы и седло: (θ₁² − 1)² + θ₂²', f: (a, b) => (a * a - 1) ** 2 + b * b, g: (a, b) => [4 * a * (a * a - 1), 2 * b], dom: [[-2, 2], [-1.5, 1.5]], p0: [0.15, 1.1],
        levels: [0.1, 0.4, 0.8, 1, 1.5, 2.5, 4], py: ['(a**2 - 1)**2 + b**2', '4 * a * (a**2 - 1)', '2 * b'],
      },
    };
    const s = { fn: 'bowl', a: 1, b: 1, eta: 0.15, anti: true, parts: true, trail: [] };
    const w = ui.shell(el, {
      title: 'Рельеф двух параметров: линии уровня и срезы',
      sub: 'Слева — карта высот f(θ₁, θ₂), как топографическая карта: линия уровня соединяет точки одинаковой высоты. Через вашу точку проходят два среза — по θ₁ (синий) и по θ₂ (оранжевый); справа они нарисованы как обычные графики. Наклон среза и есть частная производная. Тяните точку или кликайте по карте.',
    });
    ui.select(w.controls, { label: 'Функция', options: Object.entries(FN).map(([k, v]) => ({ value: k, label: v.label })), value: s.fn, onChange: (v) => ((s.fn = v), ([s.a, s.b] = FN[v].p0), (s.trail = []), draw()) });
    ui.toggle(w.controls, { label: 'Антиградиент −∇f', checked: s.anti, onChange: (v) => ((s.anti = v), draw()) });
    ui.toggle(w.controls, { label: 'Его составляющие по осям', checked: s.parts, onChange: (v) => ((s.parts = v), draw()) });
    ui.slider(w.controls, { label: 'Темп η', min: 0.02, max: 0.6, step: 0.01, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    const bb = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(bb);
    ui.button(bb, { label: 'Шаг θ − η·∇f', small: true, kind: 'primary', onClick: () => step() });
    ui.button(bb, { label: 'Сбросить', small: true, kind: 'ghost', onClick: () => (([s.a, s.b] = FN[s.fn].p0), (s.trail = []), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const map = new GBC.Plot(box, { height: 330, x: { label: 'θ₁' }, y: { label: 'θ₂' }, grid: 'none', equal: true });
    const right = H('div');
    box.appendChild(right);
    const s1 = new GBC.Plot(right, { height: 165, x: { label: 'θ₁ (θ₂ закреплён)' }, y: { label: 'f' }, margin: { bottom: 38 }, legend: false });
    const s2 = new GBC.Plot(right, { height: 165, x: { label: 'θ₂ (θ₁ закреплён)' }, y: { label: 'f' }, margin: { bottom: 38 }, legend: false });
    map.onClick = (a, b) => {
      const D = FN[s.fn].dom;
      s.a = U.clamp(a, D[0][0], D[0][1]);
      s.b = U.clamp(b, D[1][0], D[1][1]);
      s.trail = [];
      draw();
    };
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'f', label: 'f(θ₁, θ₂)' }, { key: 'g1', label: '∂f/∂θ₁ — наклон синего среза' }, { key: 'g2', label: '∂f/∂θ₂ — наклон оранжевого' }, { key: 'n', label: '|∇f| — крутизна' }]);
    function step() {
      const F = FN[s.fn];
      const [g1, g2] = F.g(s.a, s.b);
      s.trail.push([s.a, s.b]);
      s.a = U.clamp(s.a - s.eta * g1, F.dom[0][0], F.dom[0][1]);
      s.b = U.clamp(s.b - s.eta * g2, F.dom[1][0], F.dom[1][1]);
      draw();
    }
    const gridCache = {};
    function draw() {
      const F = FN[s.fn];
      const [[x0, x1], [y0, y1]] = F.dom;
      // сетка шире видимой области: при equal: true график может расшириться по одной из осей
      const grid = gridCache[s.fn] || (gridCache[s.fn] = GBC.Plot.grid(F.f, 2 * x0, 2 * x1, 2 * y0, 2 * y1, 140, 110));
      const seq = GBC.colors.sequential();
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of grid.values) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
      const tr = (v) => Math.log(1 + v - lo);
      const layers = [{ type: 'heatmap', grid, colorFn: (v) => seq(1 - tr(v) / tr(hi)), opacity: 0.45 }];
      for (const lv of F.levels) layers.push({ type: 'contour', grid, level: lv, color: 'axis', width: 1 });
      const fa = F.f(s.a, s.b);
      layers.push({ type: 'contour', grid, level: fa, color: 'ink', width: 2, label: 'линия уровня через точку' });
      layers.push({ type: 'line', x: [x0, x1], y: [s.b, s.b], color: 'blue', width: 1.6, dash: '6 4', label: 'срез по θ₁', hover: false });
      layers.push({ type: 'line', x: [s.a, s.a], y: [y0, y1], color: 'orange', width: 1.6, dash: '6 4', label: 'срез по θ₂', hover: false });
      const [g1, g2] = F.g(s.a, s.b);
      const gn = Math.hypot(g1, g2);
      // стрелки рисуем в «шагах спуска»: длина = η·|∇f|, но не короче 0.25 и не длиннее 1.4
      const L = gn > 1e-9 ? U.clamp(s.eta * gn, 0.25, 1.4) / gn : 0;
      if (s.parts && gn > 1e-9) {
        layers.push({ type: 'arrows', x1: [s.a], y1: [s.b], x2: [s.a - L * g1], y2: [s.b], color: 'blue', width: 2 });
        layers.push({ type: 'arrows', x1: [s.a], y1: [s.b], x2: [s.a], y2: [s.b - L * g2], color: 'orange', width: 2 });
      }
      if (s.anti && gn > 1e-9) layers.push({ type: 'arrows', x1: [s.a], y1: [s.b], x2: [s.a - L * g1], y2: [s.b - L * g2], color: 'ink', width: 2.4 });
      if (s.trail.length) {
        const T = s.trail.concat([[s.a, s.b]]);
        layers.push({ type: 'line', x: T.map((p) => p[0]), y: T.map((p) => p[1]), color: 'tree', width: 1.4, label: 'путь спуска', hover: false });
      }
      layers.push({
        type: 'points', x: [s.a], y: [s.b], color: 'ink', r: 6, label: 'точка θ', draggable: true,
        onDrag: (i, a, b) => ((s.a = U.clamp(a, x0, x1)), (s.b = U.clamp(b, y0, y1)), (s.trail = []), draw()),
        tooltip: () => [{ label: 'θ₁', value: U.fmt(s.a, 3) }, { label: 'θ₂', value: U.fmt(s.b, 3) }, { label: 'f', value: U.fmt(fa, 3) }],
      });
      map.render(layers, { x: [x0, x1], y: [y0, y1] });
      const slice = (P, xs, fn, slope, at, color, dom) => {
        const ys = xs.map(fn);
        const [ylo, yhi] = U.extent(ys);
        const d = 0.22 * (dom[1] - dom[0]);
        P.render([
          { type: 'line', x: xs, y: ys, color, width: 2.2, label: 'срез' },
          { type: 'line', x: [at - d, at + d], y: [fn(at) - d * slope, fn(at) + d * slope], color: 'ink', width: 1.6, dash: '5 3', label: 'наклон = ' + U.fmt(slope, 3), hover: false },
          { type: 'points', x: [at], y: [fn(at)], color: 'ink', r: 5 },
        ], { x: dom, y: [ylo - 0.08 * (yhi - ylo + 0.1), yhi + 0.08 * (yhi - ylo + 0.1)] });
      };
      slice(s1, U.linspace(x0, x1, 160), (t) => F.f(t, s.b), g1, s.a, 'blue', [x0, x1]);
      slice(s2, U.linspace(y0, y1, 160), (t) => F.f(s.a, t), g2, s.b, 'orange', [y0, y1]);
      s1.setTitle('Срез θ₂ = ' + U.fmt(s.b, 2) + ': наклон ∂f/∂θ₁ = ' + U.fmt(g1, 3));
      s2.setTitle('Срез θ₁ = ' + U.fmt(s.a, 2) + ': наклон ∂f/∂θ₂ = ' + U.fmt(g2, 3));
      stats.set('f', U.fmt(fa, 3));
      stats.set('g1', U.fmt(g1, 3));
      stats.set('g2', U.fmt(g2, 3));
      stats.set('n', U.fmt(gn, 3));
      let msg = 'Градиент ∇f = (' + U.fmt(g1, 3) + ', ' + U.fmt(g2, 3) + ') — это просто два наклона срезов, записанные вместе. Толстая стрелка — антиградиент −∇f: сумма синей и оранжевой стрелок. Она перпендикулярна линии уровня через точку (чёрная кривая в легенде) — вдоль линии уровня высота не меняется. ';
      if (gn < 1e-3) msg = '<b>Градиент равен нулю</b>: оба среза в этой точке горизонтальны. ' + (s.fn === 'saddle' && Math.abs(s.a) < 0.2 ? 'Но это <b>седло</b>: синий срез здесь — вершина, оранжевый — дно. Спуск, попавший точно сюда, остановится; чуть сдвиньтесь по θ₁ — и он скатится в одну из ям.' : 'Это минимум: дно чаши.');
      else if (s.fn === 'tilt') msg += 'Здесь линии уровня — наклонные эллипсы, и антиградиент обычно смотрит <em>не в минимум</em> (0, 0), а поперёк ближайшей линии уровня. Сделайте несколько шагов: путь изгибается.';
      else if (s.fn === 'saddle' && Math.abs(s.a) < 0.35) msg += 'Рядом седло (0, 0): по θ₁ оно — вершина (синий срез выгнут вверх), по θ₂ — дно. Градиент тут мал, и спуск замедляется.';
      else if (s.fn === 'bowl') msg += 'По θ₂ чаша в 10 раз круче, чем по θ₁, поэтому оранжевая составляющая длиннее, хотя до дна по θ₂ ближе. В точке (1, 1) наклоны срезов 1 и 10, |∇f| = √101 ≈ 10.05 — как в тексте шага.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const F = FN[s.fn];
      return 'import numpy as np\n\nf = lambda a, b: ' + F.py[0] + '\ngrad = lambda a, b: np.array([' + F.py[1] + ', ' + F.py[2] + '])   # частные производные\n\n' +
        'a, b, eps = ' + U.pyNum(Number(s.a.toFixed(3))) + ', ' + U.pyNum(Number(s.b.toFixed(3))) + ', 1e-6\n' +
        'print("формулы:          ", grad(a, b))\nprint("наклоны срезов:   ", (f(a + eps, b) - f(a - eps, b)) / (2 * eps), (f(a, b + eps) - f(a, b - eps)) / (2 * eps))\n\n' +
        't, eta = np.array([a, b]), ' + U.pyNum(s.eta) + '\nfor k in range(5):\n    t = t - eta * grad(*t)                    # шаг против градиента\n    print(f"шаг {k + 1}: θ = {np.round(t, 4)}, f = {f(*t):.4f}")\n';
    });
    [s.a, s.b] = FN[s.fn].p0;
    onTheme(draw);
    draw();
  });

  /* =================================================================================
   * bowl-2d — вытянутая чаша ½(θ₁² + κθ₂²): зигзаг и инерция
   * ================================================================================= */
  GBC.widget('bowl-2d', (el) => {
    const s = { kappa: 10, eta: 0.15, beta: 0.5, momentum: false, steps: 40, t1: 2.5, t2: 1 };
    const TOL = 1e-3;
    const w = ui.shell(el, {
      title: 'Вытянутая чаша: зигзаг, число обусловленности и инерция',
      sub: 'f(θ₁, θ₂) = ½·(θ₁² + κ·θ₂²): по θ₂ функция в κ раз круче, чем по θ₁. Безопасный темп ограничен самым крутым направлением (η < 2/κ), а скорость — самым пологим. Кликните по рельефу, чтобы выбрать старт.',
    });
    ui.slider(w.controls, { label: 'Вытянутость κ', values: [1, 2, 5, 10, 20, 50, 100], value: s.kappa, format: String, onInput: (v) => ((s.kappa = v), draw()) });
    // дискретные темпы, среди них лучшие постоянные 2/(1 + κ) для κ = 10 и 100 — как в тексте шага 11
    const ETAS = [0.005, 0.01, 0.015, 2 / 101, 0.03, 0.05, 0.1, 0.15, 2 / 11, 0.2, 0.25, 0.3, 0.4, 0.5, 0.7, 1];
    ui.slider(w.controls, { label: 'Темп η', values: ETAS, value: s.eta, format: (v) => U.fmt(v, 4), onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Шагов на рисунке', min: 1, max: 150, step: 1, value: s.steps, format: String, onInput: (v) => ((s.steps = v), draw()) });
    ui.toggle(w.controls, { label: 'Инерция (momentum)', checked: false, onChange: (v) => ((s.momentum = v), (betaCtl.el.hidden = !v), draw()) });
    const betaCtl = ui.slider(w.controls, { label: 'Коэффициент инерции β', min: 0, max: 0.95, step: 0.05, value: s.beta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.beta = v), draw()) });
    betaCtl.el.hidden = true;
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 320, x: { label: 'θ₁', domain: [-3, 3] }, y: { label: 'θ₂', domain: [-2, 2] }, grid: 'none', equal: true });
    const p2 = new GBC.Plot(box, {
      height: 320, x: { label: 'шаг k' }, y: { label: 'f(θ_k)', type: 'log', format: pow10 }, margin: { left: 58 }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v),
      table: () => {
        const P = run(s.momentum ? s.beta : 0, s.steps);
        return { columns: ['k', 'θ₁', 'θ₂', 'f(θ)'], rows: P.a.map((v, k) => [k, v, P.b[k], fval(v, P.b[k])]) };
      },
    });
    p1.onClick = (a, b) => ((s.t1 = a), (s.t2 = b), draw());
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'n', label: 'Шагов до точности 0.1 %' }, { key: 'nm', label: 'С инерцией' }, { key: 'lim', label: 'Граница η < 2/κ' }, { key: 'best', label: 'Лучший постоянный η' }]);
    const fval = (a, b) => 0.5 * (a * a + s.kappa * b * b);
    /** Спуск (с инерцией β): v ← β·v − η·∇f, θ ← θ + v. */
    function run(beta, K) {
      const a = [s.t1];
      const b = [s.t2];
      let va = 0;
      let vb = 0;
      for (let k = 0; k < K; k++) {
        va = beta * va - s.eta * a[k];
        vb = beta * vb - s.eta * s.kappa * b[k];
        const na = a[k] + va;
        const nb = b[k] + vb;
        if (!Number.isFinite(na) || Math.abs(na) + Math.abs(nb) > 1e6) break;
        a.push(na);
        b.push(nb);
      }
      return { a, b };
    }
    function stepsTo(beta) {
      const r0 = Math.hypot(s.t1, s.t2);
      const P = run(beta, 5000);
      for (let k = 1; k < P.a.length; k++) if (Math.hypot(P.a[k], P.b[k]) < TOL * r0) return k;
      return P.a.length < 5001 ? 'разнос' : '> 5000';
    }
    function draw() {
      // сетка шире видимой области: при equal: true график может расшириться по одной из осей
      const grid = GBC.Plot.grid((a, b) => Math.log(1 + fval(a, b)), -6, 6, -4, 4, 150, 100);
      const seq = GBC.colors.sequential();
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of grid.values) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
      const layers = [{ type: 'heatmap', grid, colorFn: (v) => seq(1 - (v - lo) / (hi - lo)), opacity: 0.5 }];
      for (const lv of [0.05, 0.2, 0.5, 1, 2, 4, 8, 16, 32]) layers.push({ type: 'contour', grid, level: Math.log(1 + lv), color: 'axis', width: 1 });
      const G = run(0, s.steps);
      layers.push({ type: 'line', x: G.a, y: G.b, color: 'tree', width: 1.6, label: 'спуск' });
      layers.push({ type: 'points', x: G.a, y: G.b, color: 'tree', r: 2.5, legend: false });
      if (s.momentum) {
        const M = run(s.beta, s.steps);
        layers.push({ type: 'line', x: M.a, y: M.b, color: 'model', width: 1.8, label: 'с инерцией' });
      }
      layers.push({ type: 'points', x: [s.t1], y: [s.t2], color: 'ink', r: 5, hollow: true, label: 'старт' });
      p1.render(layers);
      const fl = (P) => P.a.map((v, k) => Math.max(fval(v, P.b[k]), 1e-12));
      const curves = [{ type: 'line', x: U.range(G.a.length), y: fl(G), color: 'tree', width: 2, label: 'спуск' }];
      if (s.momentum) {
        const M = run(s.beta, s.steps);
        curves.push({ type: 'line', x: U.range(M.a.length), y: fl(M), color: 'model', width: 2, label: 'с инерцией' });
      }
      // логарифмическая шкала: границы задаём сами (автоматический запас ушёл бы в отрицательные числа)
      const all = curves.flatMap((c) => c.y).filter(Number.isFinite);
      const ylo = Math.max(Math.min(...all), 1e-12) / 2;
      const yhi = Math.min(Math.max(...all), 1e12) * 2;
      // только степени десяти: на 10 и более порядках подписи 1, 2, 5 слипаются
      const e0 = Math.ceil(Math.log10(ylo));
      const e1 = Math.floor(Math.log10(yhi));
      const step = Math.max(1, Math.ceil((e1 - e0 + 1) / 7));
      p2.opts.y.ticks = U.range(Math.floor((e1 - e0) / step) + 1).map((i) => Math.pow(10, e0 + i * step));
      p2.render(curves, { y: [ylo, yhi] });
      const n = stepsTo(0);
      stats.set('n', String(n));
      stats.set('nm', s.momentum ? String(stepsTo(s.beta)) : 'выкл.');
      stats.set('lim', U.fmt(2 / s.kappa, 3));
      stats.set('best', U.fmt(2 / (1 + s.kappa), 3));
      const zig = s.eta * s.kappa > 1 && s.eta * s.kappa < 2;
      note.innerHTML = (Math.abs(s.eta * s.kappa - 2) < 0.02
        ? '<b>η·κ = 2: по крутому направлению θ₂ множитель −1 — вечные качели</b>, хотя по пологому θ₁ шаг ещё робок. '
        : s.eta * s.kappa > 2
        ? '<b>η·κ > 2: по крутому направлению θ₂ спуск разлетается</b>, хотя по пологому θ₁ шаг ещё робок. ' + (s.momentum ? 'Инерция расширяет допустимую зону темпов — проверьте, сходится ли теперь.' : '')
        : zig
          ? 'По θ₂ множитель 1 − η·κ = ' + U.fmt(1 - s.eta * s.kappa, 2) + ' отрицателен — отсюда зигзаг поперёк долины. По θ₁ множитель 1 − η = ' + U.fmt(1 - s.eta, 3) + ' близок к 1 — отсюда медленное движение вдоль неё. '
          : 'По θ₂ спуск монотонный; по θ₁ множитель 1 − η = ' + U.fmt(1 - s.eta, 3) + '. ') +
        ' Отношение кривизн κ называют <b>числом обусловленности</b>: даже с лучшим постоянным темпом 2/(1 + κ) число шагов растёт примерно пропорционально κ. ' +
        (s.momentum ? 'Инерция копит скорость вдоль долины и гасит зигзаг поперёк. При удачных η и β число шагов растёт как √κ, а не как κ: при κ = 100 это десятки шагов вместо сотен.' : 'Включите инерцию: шаг складывается с долей β предыдущего шага.');
    }
    w.pythonAction(() =>
      'import numpy as np\n\nkappa, eta, beta = ' + s.kappa + ', ' + U.pyNum(s.eta) + ', ' + U.pyNum(s.momentum ? s.beta : 0) + '   # beta = 0 — обычный спуск\n' +
      'grad = lambda t: np.array([t[0], kappa * t[1]])   # ∇f для f = ½(θ₁² + κθ₂²)\n\n' +
      't0 = np.array([' + U.pyNum(Number(s.t1.toFixed(3))) + ', ' + U.pyNum(Number(s.t2.toFixed(3))) + '])\nt, v = t0.copy(), np.zeros(2)\nfor k in range(1, 5001):\n    v = beta * v - eta * grad(t)       # инерция: копим скорость\n    t = t + v\n' +
      '    if np.linalg.norm(t) < 1e-3 * np.linalg.norm(t0) or np.linalg.norm(t) > 1e6:\n        break\nprint(f"шагов: {k}, θ = {t}, f = {0.5 * (t[0]**2 + kappa * t[1]**2):.2e}")\n'
    );
    onTheme(draw);
    draw();
  });

  /* =================================================================================
   * gd-2d — спуск по двум параметрам: прямая для 30 точек, три масштаба признака
   * ================================================================================= */
  GBC.widget('gd-2d', (el) => {
    const d = GBC.datasets.regression1d({ kind: 'linear', n: 30, noise: 0.6, seed: 3 });
    const x = d.x;
    const y = d.y;
    const n = x.length;
    const mx = U.mean(x);
    const sx = Math.sqrt(U.mean(x.map((v) => (v - mx) ** 2)));
    const SC = {
      raw: { label: 'как есть: x', tr: (v) => v, back: 'x', eta: 0.045, dom: [[-1.5, 2.5], [-3, 7]], start: [-0.8, 5.5] },
      center: { label: 'центрировать: x − x̄', tr: (v) => v - mx, back: 'x − x̄', eta: 0.2, dom: [[-1.5, 2.5], [-1.6, 8.4]], start: [-0.8, 7.9] },
      std: { label: 'стандартизовать: (x − x̄)/s', tr: (v) => (v - mx) / sx, back: '(x − x̄)/s', eta: 0.5, dom: [[-1.6, 4.4], [-1.6, 8.4]], start: [-0.8, 7.9] },
    };
    const s = { sc: 'raw', eta: 0.045, steps: 150, grad: true };
    const w = ui.shell(el, { title: 'Градиентный спуск по двум параметрам', sub: 'Подгонка прямой ŷ = a·u + b, где u — признак x в выбранном масштабе. Слева — рельеф ½·MSE(a, b), линии уровня и путь спуска; справа — текущая прямая. Кликните по рельефу, чтобы выбрать старт.' });
    const scCtl = ui.segmented(w.controls, { label: 'Признак', options: [{ value: 'raw', label: 'x' }, { value: 'center', label: 'x − x̄' }, { value: 'std', label: '(x − x̄)/s' }], value: s.sc, onChange: (v) => ((s.sc = v), (s.eta = SC[v].eta), etaCtl.set(s.eta), ([s.a0, s.b0] = SC[v].start), draw()) });
    const etaCtl = ui.slider(w.controls, { label: 'Темп η', min: 0.001, max: 2.2, log: true, value: s.eta, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Шагов', min: 1, max: 300, step: 1, value: s.steps, format: String, onInput: (v) => ((s.steps = v), draw()) });
    ui.toggle(w.controls, { label: 'Антиградиент в старте', checked: true, onChange: (v) => ((s.grad = v), draw()) });
    [s.a0, s.b0] = SC.raw.start;
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 320, x: { label: 'наклон a' }, y: { label: 'сдвиг b' }, grid: 'none', equal: true });
    const p2 = new GBC.Plot(box, {
      height: 320, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' },
      table: () => ({ columns: ['k', 'a', 'b', '½·MSE'], rows: last.pa.map((v, k) => [k, v, last.pb[k], last.mse(v, last.pb[k])]).filter((r, k) => k < 10 || k % 10 === 0 || k === last.pa.length - 1) }),
    });
    let last = { pa: [], pb: [], mse: () => 0 };
    p1.onClick = (a, b) => ((s.a0 = a), (s.b0 = b), draw());
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'kappa', label: 'Вытянутость κ' }, { key: 'lim', label: 'Граница η < 2/a_{max}' }, { key: 'n', label: 'Шагов до 0.1 % (лучший η)' }, { key: 'mse', label: '½·MSE сейчас' }, { key: 'opt', label: '½·MSE минимума' }]);
    function draw() {
      const S = SC[s.sc];
      const u = x.map(S.tr);
      const mse = (a, b) => U.mean(u.map((v, i) => (y[i] - a * v - b) ** 2)) / 2;
      const grad = (a, b) => {
        let ga = 0;
        let gb = 0;
        u.forEach((v, i) => {
          const r = y[i] - a * v - b;
          ga -= r * v;
          gb -= r;
        });
        return [ga / n, gb / n];
      };
      // кривизны: матрица вторых производных [[mean u², mean u], [mean u, 1]] и её собственные числа
      const m2 = U.mean(u.map((v) => v * v));
      const m1 = U.mean(u);
      const tr = m2 + 1;
      const det = m2 - m1 * m1;
      const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
      const lmax = tr / 2 + disc;
      const lmin = tr / 2 - disc;
      const pa = [s.a0];
      const pb = [s.b0];
      for (let k = 0; k < s.steps; k++) {
        const [ga, gb] = grad(pa[k], pb[k]);
        const na = pa[k] - s.eta * ga;
        const nb = pb[k] - s.eta * gb;
        if (!Number.isFinite(na) || Math.abs(na) + Math.abs(nb) > 1e4) break;
        pa.push(na);
        pb.push(nb);
      }
      const [[a0, a1], [b0, b1]] = S.dom;
      const ca = (a0 + a1) / 2;
      const cb = (b0 + b1) / 2;
      const ra = a1 - a0;
      const rb = b1 - b0;
      // сетка шире видимой области: при equal: true график может расшириться по одной из осей
      const grid = GBC.Plot.grid((a, b) => Math.log(1 + mse(a, b)), ca - 1.5 * Math.max(ra, rb), ca + 1.5 * Math.max(ra, rb), cb - 1.5 * Math.max(ra, rb), cb + 1.5 * Math.max(ra, rb), 130, 130);
      const seq = GBC.colors.sequential();
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of grid.values) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
      const layers = [{ type: 'heatmap', grid, colorFn: (v) => seq(1 - (v - lo) / (hi - lo)), opacity: 0.55 }];
      for (const lv of [0.3, 0.6, 1, 1.5, 2, 2.5, 3]) layers.push({ type: 'contour', grid, level: lo + (lv / 3.2) * (hi - lo), color: 'axis', width: 1 });
      const g0 = grad(s.a0, s.b0);
      // минимум ½·MSE — формулы МНК в текущем масштабе признака
      const um0 = U.mean(u);
      const ym0 = U.mean(y);
      let sxy0 = 0;
      let sxx0 = 0;
      u.forEach((v, i) => ((sxy0 += (v - um0) * (y[i] - ym0)), (sxx0 += (v - um0) * (v - um0))));
      const aMin = sxy0 / sxx0;
      const bMin = ym0 - aMin * um0;
      layers.push({ type: 'line', x: pa, y: pb, color: 'tree', width: 1.6, label: 'путь спуска' });
      const every = pa.length > 40 ? 5 : 1;
      const idx = U.range(Math.min(pa.length, 200)).filter((i) => i % every === 0);
      layers.push({ type: 'points', x: idx.map((i) => pa[i]), y: idx.map((i) => pb[i]), color: 'tree', r: 2.2, legend: false, tooltip: (i) => [{ label: 'шаг', value: String(i) }, { label: 'a', value: U.fmt(pa[i], 3) }, { label: 'b', value: U.fmt(pb[i], 3) }, { label: '½·MSE', value: U.fmt(mse(pa[i], pb[i]), 4) }] });
      layers.push({ type: 'points', x: [aMin], y: [bMin], color: 'ink', r: 5, shape: 'square', label: 'минимум', tooltip: () => [{ label: 'минимум', value: 'a = ' + U.fmt(aMin, 3) + ', b = ' + U.fmt(bMin, 3) }] });
      layers.push({ type: 'points', x: [pa[0]], y: [pb[0]], color: 'ink', r: 5, hollow: true, label: 'старт' });
      layers.push({ type: 'points', x: [pa[pa.length - 1]], y: [pb[pb.length - 1]], color: 'tree', r: 5, label: 'после спуска' });
      if (s.grad) {
        const len = Math.hypot(g0[0], g0[1]) || 1;
        const L = 0.25 * (a1 - a0);
        layers.push({ type: 'arrows', x1: [s.a0], y1: [s.b0], x2: [s.a0 - (L * g0[0]) / len], y2: [s.b0 - (L * g0[1]) / len], color: 'ink', width: 2.5 });
      }
      p1.render(layers, { x: [a0, a1], y: [b0, b1] });
      last = { pa, pb, mse };
      const a = pa[pa.length - 1];
      const b = pb[pb.length - 1];
      const gx = U.linspace(0, 10, 50);
      p2.render([
        { type: 'points', x, y, color: 'data', r: 3.8, label: 'данные' },
        { type: 'line', x: gx, y: gx.map((v) => a * S.tr(v) + b), color: 'model', width: 2.2, label: 'прямая' },
      ]);
      const um = U.mean(u);
      const ym = U.mean(y);
      let sxy = 0;
      let sxx = 0;
      u.forEach((v, i) => ((sxy += (v - um) * (y[i] - ym)), (sxx += (v - um) * (v - um))));
      const aOpt = sxy / sxx;
      const bOpt = ym - aOpt * um;
      const best = 2 / (lmax + lmin);
      const q = (lmax - lmin) / (lmax + lmin);
      const nBest = q < 1e-9 ? 1 : Math.ceil(Math.log(1e-3) / Math.log(q));
      stats.set('kappa', U.fmt(lmax / lmin, 1));
      stats.set('lim', U.fmt(2 / lmax, 3));
      stats.set('n', String(nBest));
      stats.set('mse', U.fmt(mse(a, b), 4));
      stats.set('opt', U.fmt(mse(aOpt, bOpt), 4));
      const diverged = pa.length < s.steps + 1;
      note.innerHTML = (diverged ? '<b>Темп больше границы 2/a<sub>max</sub> = ' + U.fmt(2 / lmax, 3) + ' (a<sub>max</sub> — наибольшая кривизна рельефа) — спуск разлетается.</b> ' : '') + (s.sc === 'raw'
        ? 'Признак как есть: x̄ ≈ ' + U.fmt(mx, 2) + ' далеко от нуля, поэтому эллипсы не только вытянуты, но и <b>наклонены</b>: чуть больший наклон a и чуть меньший сдвиг b дают почти ту же прямую. Кривизна поперёк долины ≈ ' + U.fmt(lmax, 1) + ', вдоль дна ≈ ' + U.fmt(lmin, 2) + ' — κ ≈ ' + U.fmt(lmax / lmin, 0) + '. Спуск быстро падает в долину и потом медленно ползёт по ней.'
        : s.sc === 'center'
          ? 'После центрирования эллипсы выпрямились (смешанная производная mean(u) = 0), но остались вытянутыми: по a кривизна равна дисперсии x ≈ ' + U.fmt(lmax, 2) + ', по b — 1. κ ≈ ' + U.fmt(lmax / lmin, 1) + '.'
          : 'После стандартизации обе кривизны равны 1, линии уровня — окружности, κ = 1: антиградиент смотрит прямо в минимум, и с η = 1 спуск приходит в него за один шаг.') +
        (s.sc === 'std' ? ' Стрелка — антиградиент в старте: у окружностей он указывает точно в центр.' : ' Стрелка — антиградиент в старте: он перпендикулярен линии уровня и указывает самый крутой спуск <em>в этой точке</em>, но не в минимум.') + ' Деревьям бустинга масштаб признаков безразличен.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets\n\nX, y = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)\nx = X[:, 0]\n' +
      (s.sc === 'raw' ? 'u = x                                          # признак как есть\n' : s.sc === 'center' ? 'u = x - x.mean()                               # центрирование\n' : 'u = (x - x.mean()) / x.std()                   # стандартизация\n') +
      'H = np.array([[np.mean(u * u), np.mean(u)], [np.mean(u), 1]])   # вторые производные ½·MSE\nlam = np.linalg.eigvalsh(H)\nprint("кривизны:", lam, " κ =", lam[1] / lam[0])\n\n' +
      'a, b, eta = ' + U.pyNum(Number(s.a0.toFixed(3))) + ', ' + U.pyNum(Number(s.b0.toFixed(3))) + ', ' + U.pyNum(s.eta) + '\nfor k in range(' + s.steps + '):\n    r = y - (a * u + b)\n    a, b = a + eta * np.mean(r * u), b + eta * np.mean(r)   # шаг против градиента\n' +
      'print(f"после спуска: a = {a:.4f}, b = {b:.4f}, ½·MSE = {np.mean((y - a * u - b) ** 2) / 2:.5f}")\nprint("точный ответ (МНК):", np.polyfit(u, y, 1))\n'
    );
    onTheme(draw);
    draw();
  });

  /* =================================================================================
   * sgd-constant — стохастический спуск для одного числа
   * ================================================================================= */
  GBC.widget('sgd-constant', (el) => {
    const MAXK = 60;
    const s = { mode: 'const', eta: 0.5, k: 12, seed: 1 };
    const w = ui.shell(el, {
      title: 'Стохастический спуск для одного числа',
      sub: 'Шесть квартир, константа c под ½·MSE. Полный спуск на каждом шаге слушает все шесть квартир: c ← c + η·(ȳ − c). Стохастический — одну случайную: c ← c + η·(yᵢ − c). Пунктир — среднее 7, к которому мы стремимся.',
    });
    ui.segmented(w.controls, {
      label: 'Шаг', options: [{ value: 'full', label: 'Все 6' }, { value: 'const', label: '1 квартира' }, { value: 'decay', label: '1 кв., η = 1/(k+1)' }], value: s.mode,
      onChange: (v) => ((s.mode = v), (etaCtl.el.hidden = v === 'decay'), draw()),
    });
    const etaCtl = ui.slider(w.controls, { label: 'Темп η', min: 0.05, max: 1, step: 0.05, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    ui.player(w.controls, { label: 'Шагов', min: 0, max: MAXK, value: s.k, fps: 6, format: (v) => 'k = ' + v, onChange: (v) => ((s.k = v), draw()) });
    ui.button(w.controls, { label: 'Другие случайные квартиры', small: true, onClick: () => ((s.seed += 1), draw()) });
    const plot = new GBC.Plot(w.main, {
      height: 300, x: { label: 'шаг k', domain: [0, MAXK] }, y: { label: 'c_k, млн', domain: [0, 14] }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v),
      table: () => {
        const R = run();
        return { columns: ['k', 'квартира (цена)', 'темп η_k', 'c_{k+1}'], rows: R.picks.slice(0, s.k).map((p, k) => [k, p === null ? 'все шесть' : FLATS[p] + ' млн', R.etas[k], R.c[k + 1]]) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'c', label: 'c_k' }, { key: 'pick', label: 'Последняя квартира' }, { key: 'avg', label: 'Среднее выбранных цен' }, { key: 'err', label: '|c_k − 7|' }]);
    /** Путь c_k; квартиры выбирает Mulberry32 (как gbcourse.rng.Mulberry32 в Python). */
    function run() {
      const rng = new GBC.RNG(s.seed);
      const c = [0];
      const picks = [];
      const etas = [];
      for (let k = 0; k < MAXK; k++) {
        if (s.mode === 'full') {
          picks.push(null);
          etas.push(s.eta);
          c.push(c[k] + s.eta * (7 - c[k]));
        } else {
          const i = rng.sample(6, 1)[0];
          const eta = s.mode === 'decay' ? 1 / (k + 1) : s.eta;
          picks.push(i);
          etas.push(eta);
          c.push(c[k] + eta * (FLATS[i] - c[k]));
        }
      }
      return { c, picks, etas };
    }
    function draw() {
      const R = run();
      const K = s.k;
      const ks = U.range(K + 1);
      const layers = [
        { type: 'hline', y: 7, color: 'ink2', dash: '5 4', width: 1.2, text: 'среднее ȳ = 7' },
        { type: 'line', x: ks, y: R.c.slice(0, K + 1), color: 'model', width: 2.2, label: 'c_k' },
      ];
      if (s.mode !== 'full') {
        layers.push({ type: 'points', x: ks.slice(1), y: R.picks.slice(0, K).map((p) => FLATS[p]), color: 'data', r: 3.6, label: 'цена выбранной квартиры', tooltip: (i) => [{ label: 'шаг', value: String(i) }, { label: 'цена', value: FLATS[R.picks[i]] + ' млн' }, { label: 'c после шага', value: U.fmt(R.c[i + 1], 3) }] });
      }
      layers.push({ type: 'points', x: [K], y: [R.c[K]], color: 'model', r: 5.5, legend: false });
      plot.render(layers);
      const picked = R.picks.slice(0, K).filter((p) => p !== null).map((p) => FLATS[p]);
      stats.set('c', U.fmt(R.c[K], 4));
      stats.set('pick', K && R.picks[K - 1] !== null ? FLATS[R.picks[K - 1]] + ' млн' : '—');
      stats.set('avg', picked.length ? U.fmt(U.mean(picked), 4) : '—');
      stats.set('err', U.fmt(Math.abs(R.c[K] - 7), 4));
      note.innerHTML = s.mode === 'full'
        ? 'Полный спуск: расстояние до среднего каждый шаг умножается на 1 − η = ' + U.fmt(1 - s.eta, 2) + ', путь гладкий. Зато каждый шаг смотрит на все шесть квартир — на миллионах объектов это дорого.'
        : s.mode === 'const'
          ? 'Один шаг — одна квартира: c сдвигается на долю η к её цене. В среднем такой шаг ведёт к ȳ = 7 (средняя сила случайной квартиры равна полной силе), но c всё время «гоняется» за последней выбранной ценой и не успокаивается: при постоянном η шум не исчезает. Уменьшите η — колебания станут меньше, но и движение медленнее.'
          : 'Темп η<sub>k</sub> = 1/(k + 1) делает поразительную вещь: c<sub>k</sub> в точности равно <b>среднему цен, выбранных за k шагов</b> (сравните «c_k» и «среднее выбранных»). По закону больших чисел оно стремится к ȳ = 7 — шум гаснет, но медленно, примерно как 1/√k. Так затухающий темп превращает шумный спуск в сходящийся.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\ny = np.array([3, 5, 4, 8, 9, 13.])\nrng, c = Mulberry32(' + s.seed + '), 0.0\nfor k in range(' + Math.max(1, s.k) + '):\n' +
      (s.mode === 'full'
        ? '    c = c + ' + U.pyNum(s.eta) + ' * (y.mean() - c)         # полный спуск: все квартиры\n'
        : '    i = rng.sample(6, 1)[0]                  # одна случайная квартира\n    eta = ' + (s.mode === 'decay' ? '1 / (k + 1)' : U.pyNum(s.eta)) + '\n    c = c + eta * (y[i] - c)\n') +
      'print(f"c = {c:.4f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * sgd-line — стохастический спуск: прямая по мини-пакетам
   * ================================================================================= */
  GBC.widget('sgd-line', (el) => {
    const d = GBC.datasets.regression1d({ kind: 'linear', n: 30, noise: 0.6, seed: 3 });
    const n = d.x.length;
    const mx = U.mean(d.x);
    const sx = Math.sqrt(U.mean(d.x.map((v) => (v - mx) ** 2)));
    const z = d.x.map((v) => (v - mx) / sx);
    const y = d.y;
    const half = (a, b) => U.mean(z.map((v, i) => (y[i] - a * v - b) ** 2)) / 2;
    const aOpt = U.mean(z.map((v, i) => v * (y[i] - U.mean(y))));
    const bOpt = U.mean(y);
    const MAXK = 80;
    const s = { B: 1, eta: 0.1, k: 60, seed: 1 };
    const w = ui.shell(el, {
      title: 'Стохастический спуск: шаг по мини-пакету',
      sub: 'Та же прямая ŷ = a·z + b, что в шаге 12, с признаком z = (x − x̄)/s, поэтому линии уровня — окружности. На каждом шаге градиент считается не по всем 30 точкам, а по B случайным. Серая линия — полный спуск для сравнения.',
    });
    ui.segmented(w.controls, { label: 'Размер пакета B', options: [{ value: 1, label: '1' }, { value: 5, label: '5' }, { value: 30, label: 'все 30' }], value: s.B, onChange: (v) => ((s.B = Number(v)), draw()) });
    ui.slider(w.controls, { label: 'Темп η', min: 0.02, max: 1, step: 0.01, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    ui.player(w.controls, { label: 'Шагов', min: 0, max: MAXK, value: s.k, fps: 8, format: (v) => 'k = ' + v, onChange: (v) => ((s.k = v), draw()) });
    ui.button(w.controls, { label: 'Другие случайные пакеты (seed + 1)', small: true, onClick: () => ((s.seed += 1), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 320, x: { label: 'наклон a', domain: [-0.6, 2.6] }, y: { label: 'сдвиг b', domain: [-0.4, 4.4] }, grid: 'none', equal: true });
    const p2 = new GBC.Plot(box, {
      height: 320, x: { label: 'шаг k', domain: [0, MAXK] }, y: { label: '½·MSE на всех 30 точках', type: 'log' }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v),
      table: () => {
        const P = run(s.B);
        return { columns: ['k', 'a', 'b', '½·MSE'], rows: P.a.slice(0, s.k + 1).map((v, k) => [k, v, P.b[k], half(v, P.b[k])]) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'm', label: '½·MSE сейчас' }, { key: 'opt', label: '½·MSE минимума' }, { key: 'seen', label: 'Просмотрено точек' }, { key: 'seed', label: 'Зерно генератора (seed)' }]);
    /** Путь спуска; пакеты выбирает Mulberry32 (как gbcourse.rng.Mulberry32 в Python). */
    function run(B) {
      const rng = new GBC.RNG(s.seed);
      const a = [0];
      const b = [0];
      for (let k = 0; k < MAXK; k++) {
        const idx = B < n ? rng.sample(n, B) : U.range(n);
        let ga = 0;
        let gb = 0;
        for (const i of idx) {
          const r = y[i] - (a[k] * z[i] + b[k]);
          ga += r * z[i];
          gb += r;
        }
        a.push(a[k] + (s.eta * ga) / idx.length);
        b.push(b[k] + (s.eta * gb) / idx.length);
      }
      return { a, b };
    }
    function draw() {
      const grid = GBC.Plot.grid((a, b) => Math.log(half(a, b)), -0.6, 2.6, -0.4, 4.4, 70, 90);
      const seq = GBC.colors.sequential();
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of grid.values) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
      const layers = [{ type: 'heatmap', grid, colorFn: (v) => seq(1 - (v - lo) / (hi - lo)), opacity: 0.5 }];
      for (const lv of [0.25, 0.3, 0.45, 0.7, 1.2, 2, 3.5, 6]) layers.push({ type: 'contour', grid, level: Math.log(lv), color: 'axis', width: 1 });
      const full = run(n);
      const P = run(s.B);
      const K = s.k;
      layers.push({ type: 'line', x: full.a.slice(0, K + 1), y: full.b.slice(0, K + 1), color: 'ink2', width: 1.4, dash: '4 3', label: 'полный спуск' });
      layers.push({ type: 'line', x: P.a.slice(0, K + 1), y: P.b.slice(0, K + 1), color: 'tree', width: 1.6, label: 'B = ' + s.B });
      layers.push({ type: 'points', x: [aOpt], y: [bOpt], color: 'ink', r: 5, hollow: true, label: 'минимум' });
      layers.push({ type: 'points', x: [P.a[K]], y: [P.b[K]], color: 'tree', r: 5, label: 'сейчас' });
      p1.render(layers);
      const ks = U.range(MAXK + 1);
      p2.render([
        { type: 'hline', y: half(aOpt, bOpt), color: 'ink2', dash: '4 3', width: 1, text: 'минимум' },
        { type: 'line', x: ks, y: ks.map((k) => half(full.a[k], full.b[k])), color: 'ink2', width: 1.4, dash: '4 3', label: 'полный спуск' },
        { type: 'line', x: ks.slice(0, K + 1), y: ks.slice(0, K + 1).map((k) => half(P.a[k], P.b[k])), color: 'tree', width: 2, label: 'B = ' + s.B },
        { type: 'vline', x: K, color: 'ink2', dash: '3 3', width: 1 },
      ], { y: [0.2, 12] });
      const m = half(P.a[K], P.b[K]);
      stats.set('m', U.fmt(m, 4));
      stats.set('opt', U.fmt(half(aOpt, bOpt), 4));
      stats.set('seen', String(K * Math.min(s.B, n)) + ' (' + U.fmt((K * Math.min(s.B, n)) / n, 2) + ' эпох)');
      stats.set('seed', String(s.seed));
      note.innerHTML = s.B >= n
        ? 'Полный спуск: каждый шаг точный, путь гладкий и прямой (линии уровня — окружности). Зато каждый шаг просматривает все 30 точек.'
        : 'Каждый шаг смотрит лишь на ' + s.B + (s.B === 1 ? ' точку' : ' точек') + ': направление «шумное», путь петляет, но в среднем ведёт к минимуму. Вблизи минимума спуск не останавливается, а «топчется» — шум не исчезает, пока темп постоянный. ' +
          'Уменьшите η или увеличьте B, чтобы облако стало теснее. Шаг с B = 1 в 30 раз дешевле полного — поэтому на больших данных так и делают.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets\nfrom gbcourse.rng import Mulberry32\n\nX, y = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)\nz = (X[:, 0] - X[:, 0].mean()) / X[:, 0].std()   # стандартизация\n\n' +
      'B, eta, K = ' + s.B + ', ' + U.pyNum(s.eta) + ', ' + s.k + '\nrng = Mulberry32(' + s.seed + ')                 # тот же генератор, что в браузере\na = b = 0.0\nfor k in range(K):\n' +
      '    idx = rng.sample(30, B) if B < 30 else list(range(30))   # мини-пакет\n    r = y[idx] - (a * z[idx] + b)\n    a, b = a + eta * np.mean(r * z[idx]), b + eta * np.mean(r)\n' +
      'print(f"a = {a:.4f}, b = {b:.4f}, ½·MSE = {np.mean((y - a * z - b) ** 2) / 2:.4f}")\nprint("минимум: a =", np.mean(z * (y - y.mean())), " b =", y.mean())\n'
    );
    onTheme(draw);
    draw();
  });

  /* =================================================================================
   * stump-relief — потери пня как функция порога: ступеньки, по которым не спуститься
   * ================================================================================= */
  GBC.widget('stump-relief', (el) => {
    const r = FLATS.map((y) => y - 7); // остатки после F₀ = 7
    const s = { t: 47 };
    /** Пень на остатках: средние слева и справа от порога и сумма квадратов после шага ν = 1. */
    function stump(t) {
      const L = r.filter((v, i) => AREAS[i] <= t);
      const R = r.filter((v, i) => AREAS[i] > t);
      const mL = L.length ? U.mean(L) : 0;
      const mR = R.length ? U.mean(R) : 0;
      const h = AREAS.map((a) => (!L.length || !R.length ? 0 : a <= t ? mL : mR));
      return { h, sse: U.sum(r.map((v, i) => (v - h[i]) ** 2)), mL, mR, split: L.length > 0 && R.length > 0 };
    }
    const w = ui.shell(el, {
      title: 'Можно ли спуститься по порогу дерева?',
      sub: 'Пень на шести квартирах приближает остатки r = y − 7 ступенькой «площадь ≤ t». Слева — сумма квадратов остатков после шага пнём как функция порога t, справа — сам пень. Двигайте порог.',
    });
    ui.slider(w.controls, { label: 'Порог t, м²', min: 25, max: 85, step: 0.5, value: s.t, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.t = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, {
      height: 280, x: { label: 'порог t, м²', domain: [25, 85] }, y: { label: 'сумма квадратов', domain: [0, 78] },
      table: () => ({ columns: ['порог t', 'сумма квадратов'], rows: [27.5, 35, 45, 55, 65, 75, 82.5].map((t) => [t, stump(t).sse]) }),
    });
    const p2 = new GBC.Plot(box, { height: 280, x: { label: 'площадь, м²', domain: [25, 85] }, y: { label: 'остаток r = y − 7', domain: [-5, 7] } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 't', label: 'Порог t' }, { key: 'sse', label: 'Сумма квадратов' }, { key: 'd', label: 'Наклон по t' }, { key: 'best', label: 'Лучший порог (перебор)' }]);
    function draw() {
      const ts = U.linspace(25, 85, 601);
      const S = stump(s.t);
      const onEdge = AREAS.some((a) => Math.abs(a - s.t) < 1e-9);
      p1.render([
        { type: 'line', x: ts, y: ts.map((t) => stump(t).sse), color: 'model', width: 2.2, curve: 'step', label: 'сумма квадратов после пня' },
        { type: 'vline', x: 55, color: 'good', dash: '4 3', width: 1.2, text: 'лучший: 16' },
        { type: 'line', x: [s.t - 4, s.t + 4], y: [S.sse, S.sse], color: 'tree', width: 2, dash: '5 3', label: 'наклон: 0', hover: false },
        { type: 'points', x: [s.t], y: [S.sse], color: 'ink', r: 5.5, label: 'порог t' },
      ]);
      p2.render([
        { type: 'hline', y: 0, color: 'ink2', width: 1, dash: '3 3' },
        { type: 'vline', x: s.t, color: 'tree', dash: '5 3', width: 1.4, text: 't = ' + U.fmt(s.t, 1) },
        { type: 'segments', x1: AREAS, y1: S.h, x2: AREAS, y2: r, color: 'residual', width: 1.6 },
        { type: 'line', x: ts, y: ts.map((t) => (!S.split ? 0 : t <= s.t ? S.mL : S.mR)), color: 'tree', width: 2.4, label: 'пень h(x)' },
        { type: 'points', x: AREAS, y: r, color: 'data', r: 5, label: 'остатки', tooltip: (i) => [{ label: 'площадь', value: AREAS[i] + ' м²' }, { label: 'r', value: U.fmtSigned(r[i], 0) }, { label: 'h', value: U.fmt(S.h[i], 2) }] },
      ]);
      stats.set('t', U.fmt(s.t, 1) + ' м²');
      stats.set('sse', U.fmt(S.sse, 2));
      stats.set('d', onEdge ? 'не существует' : '0');
      stats.set('best', '55 → 16');
      note.innerHTML = (S.split
        ? 'Пока t не пересёк ни одну площадь, пень не меняется: сумма квадратов стоит на месте (' + U.fmt(S.sse, 2) + '), её наклон по t равен <b>нулю</b>. На площадях квартир она скачком меняется — там производной нет вовсе. '
        : 'Порог левее или правее всех квартир — разбиения нет, пень равен нулю, сумма квадратов прежняя: 70. ') +
        'Спуску по t не за что зацепиться: «склон под ногами» горизонтален. Поэтому пороги деревьев не ищут спуском, а <b>перебирают</b>: здесь кандидатов всего пять — середины между соседними площадями. А производные берут там, где потери гладкие, — по прогнозам F. Это и есть идея градиентного бустинга.';
    }
    w.pythonAction(() =>
      'import numpy as np\n\nx = np.array([30, 40, 50, 60, 70, 80.])\ny = np.array([3, 5, 4, 8, 9, 13.])\nr = y - y.mean()                              # остатки после F₀ = 7\n\n' +
      'def sse(t):\n    left, right = x <= t, x > t\n    if left.all() or right.all():\n        return np.sum(r ** 2)                 # разбиения нет\n    h = np.where(left, r[left].mean(), r[right].mean())\n    return np.sum((r - h) ** 2)\n\n' +
      'for t in [' + U.pyNum(s.t) + ', 35, 45, 55, 65, 75]:\n    print(f"t = {t:5.1f}: сумма квадратов {sse(t):.2f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * prediction-descent — спуск в пространстве прогнозов
   * ================================================================================= */
  GBC.widget('prediction-descent', (el) => {
    const train = GBC.datasets.regression1d({ kind: 'wave', n: 12, noise: 0.3, seed: 3 });
    const test = GBC.datasets.regression1d({ kind: 'wave', n: 200, noise: 0.3, seed: 103 });
    const MAXK = 40;
    const s = { mode: 'free', nu: 0.3, k: 0 };
    const w = ui.shell(el, {
      title: 'Спуск по прогнозам: свободно или через дерево',
      sub: 'Параметры — сами прогнозы F(xᵢ) двенадцати точек. Шаг спуска сдвигает каждый прогноз на ν·(yᵢ − Fᵢ). Но что тогда предсказывать в новых точках (бирюзовые)? Сравните со спуском, где поправку делает дерево.',
    });
    ui.segmented(w.controls, { label: 'Как делаем шаг', options: [{ value: 'free', label: 'Свободные прогнозы' }, { value: 'tree', label: 'Через дерево' }], value: s.mode, onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'Темп ν', min: 0.05, max: 1, step: 0.05, value: s.nu, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.nu = v), draw()) });
    const player = ui.player(w.controls, { label: 'Шагов спуска k', min: 0, max: MAXK, value: 0, fps: 4, format: (v) => 'k = ' + v, onChange: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-1, 4.6] } });
    const curve = new GBC.Plot(w.main, {
      height: 200, x: { label: 'шаг k', domain: [0, MAXK] }, y: { label: 'MSE' }, crosshair: true, crosshairTitle: (v) => 'k = ' + Math.round(v),
      table: () => {
        const R = run();
        return { columns: ['k', 'свободно: обучение', 'свободно: новые', 'дерево: обучение', 'дерево: новые'], rows: U.range(MAXK + 1).map((j) => [j, mse(train.y, R.free[j]), mse(test.y, test.y.map(() => F0)), mse(train.y, R.gb.predictRaw(train.X, j)), mse(test.y, R.gb.predictRaw(test.X, j))]) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'tr', label: 'MSE на 12 точках' }, { key: 'te', label: 'MSE на новых точках' }, { key: 'k', label: 'Шагов' }]);
    const F0 = U.mean(train.y);
    const grid = U.linspace(0, 10, 400);
    const mse = (y, p) => GBC.metrics.mse(y, p);
    /** История обоих способов: прогнозы на обучении и функция на новых точках. */
    function run() {
      const free = [train.y.map(() => F0)];
      const gb = new GBC.GradientBoosting({ nEstimators: MAXK, learningRate: s.nu, maxDepth: 2 }).fit(train.X, train.y);
      for (let k = 1; k <= MAXK; k++) free.push(free[k - 1].map((f, i) => f + s.nu * (train.y[i] - f)));
      return { free, gb };
    }
    function draw() {
      const R = run();
      const k = s.k;
      let trPred;
      let tePred;
      let gridPred;
      if (s.mode === 'free') {
        trPred = R.free[k];
        tePred = test.y.map(() => F0);
        gridPred = null;
      } else {
        trPred = R.gb.predictRaw(train.X, k);
        tePred = R.gb.predictRaw(test.X, k);
        gridPred = R.gb.predictRaw(grid.map((v) => [v]), k);
      }
      const layers = [
        { type: 'points', x: test.x, y: test.y, color: 'test', r: 2.4, opacity: 0.45, label: 'новые точки' },
        { type: 'line', x: grid, y: grid.map((v) => GBC.datasets.trueFunction('wave', v)), color: 'truth', dash: '5 4', width: 1.4, label: 'истина' },
      ];
      if (gridPred) layers.push({ type: 'line', x: grid, y: gridPred, color: 'model', width: 2.4, curve: 'step', label: 'F_k(x) — функция' });
      else layers.push({ type: 'hline', y: F0, color: 'model-prev', width: 1.6, dash: '6 4', text: 'в новых точках: F₀' });
      layers.push({ type: 'segments', x1: train.x, y1: trPred, x2: train.x, y2: train.y, color: 'residual', width: 1.6, opacity: 0.8 });
      layers.push({ type: 'points', x: train.x, y: train.y, color: 'data', r: 4.5, label: 'обучение' });
      layers.push({ type: 'points', x: train.x, y: trPred, color: 'model', r: 5, shape: 'square', label: 'прогнозы F_k(x_i)', tooltip: (i) => [{ label: 'x', value: U.fmt(train.x[i], 2) }, { label: 'y', value: U.fmt(train.y[i], 3) }, { label: 'F_k', value: U.fmt(trPred[i], 3) }] });
      plot.render(layers);
      const ks = U.range(MAXK + 1);
      const trFree = ks.map((j) => mse(train.y, R.free[j]));
      const teFree = ks.map(() => mse(test.y, test.y.map(() => F0)));
      const trTree = ks.map((j) => mse(train.y, R.gb.predictRaw(train.X, j)));
      const teTree = ks.map((j) => mse(test.y, R.gb.predictRaw(test.X, j)));
      const best = U.argmax(teTree.map((v) => -v));
      curve.render([
        { type: 'line', x: ks, y: s.mode === 'free' ? trFree : trTree, color: 'train', width: 2, label: 'обучение' },
        { type: 'line', x: ks, y: s.mode === 'free' ? teFree : teTree, color: 'test', width: 2, label: 'новые точки' },
        s.mode === 'tree' ? { type: 'vline', x: best, color: 'good', dash: '4 3', width: 1.2, text: 'минимум: k = ' + best } : null,
        { type: 'vline', x: k, color: 'ink2', dash: '3 3', width: 1 },
      ], { y: [0, Math.max(...teFree, ...trFree) * 1.1] });
      stats.set('tr', U.fmt(mse(train.y, trPred), 4));
      stats.set('te', U.fmt(mse(test.y, tePred), 4));
      stats.set('k', String(k));
      note.innerHTML = s.mode === 'free'
        ? 'Свободный спуск по прогнозам — это «бустинг одного числа» для каждой точки отдельно: остаток каждой умножается на (1 − ν) за шаг, и обучающая ошибка падает к нулю. Но правила для <b>новых</b> x нет — там прогноз так и остался F₀, ошибка на новых точках не меняется. Модель лишь запомнила ответы.'
        : 'Через дерево: шаг тот же — антиградиент (остатки), — но его приближает дерево глубины 2, то есть функция от x. Поправка автоматически переносится на соседние новые точки, и ошибка на них тоже падает — примерно до k = 10, а дальше бустинг начинает подгонять шум и она растёт (ранняя остановка, урок 7.1). Это и есть <b>градиентный бустинг</b>: градиентный спуск, где шаг обобщает дерево.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, GBRegressor\nfrom gbcourse.metrics import mse\n\n' +
      'X, y = datasets.regression_1d(kind="wave", n=12, noise=0.3, seed=3)\nXt, yt = datasets.regression_1d(kind="wave", n=200, noise=0.3, seed=103)\nnu, K = ' + U.pyNum(s.nu) + ', ' + s.k + '\n\n' +
      '# 1) свободный спуск: параметры — сами прогнозы на обучающих точках\nF = np.full_like(y, y.mean())\nfor k in range(K):\n    F = F + nu * (y - F)            # шаг против градиента ½·Σ(y − F)²\n' +
      'print("свободно:  обучение", mse(y, F), " новые точки (прогноз F0)", mse(yt, np.full_like(yt, y.mean())))\n\n' +
      '# 2) шаг через дерево — градиентный бустинг\ngb = GBRegressor(n_estimators=max(K, 1), learning_rate=nu, max_depth=2).fit(X, y)\n' +
      'print("бустинг:   обучение", mse(y, gb.predict(X, n_iter=K)), " новые точки", mse(yt, gb.predict(Xt, n_iter=K)))\n'
    );
    draw();
  });
})();
