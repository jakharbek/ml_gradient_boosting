/* Урок 15.3, часть 2: бесконечность, строгое определение, пределы в анализе и ML.
 * Виджеты: вертикальные асимптоты и планка M, пределы на бесконечности, главные слагаемые, портрет
 * асимптот, игра ε–δ, формула δ(ε) против наибольшего δ, секущая → касательная, сходимость бустинга,
 * сигмоида и log-loss, закон больших чисел, ловушки вычислений, тренажёр.
 * Помощники — из lesson.js (GBC.lesson153). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const { curve, fmtInt, smallestN, card, cardGrid, badge } = GBC.lesson153;

  /** Сетка по x, сгущающаяся к точке a (чтобы крутые участки у асимптоты были гладкими). */
  function denseNear(x0, x1, a, scale, n = 900) {
    const xs = U.linspace(x0, x1, n);
    for (let i = 0; i <= 300; i++) {
      const t = scale * Math.pow(10, -4 + (5.5 * i) / 300);
      if (a + t > x0 && a + t < x1) xs.push(a + t);
      if (a - t > x0 && a - t < x1) xs.push(a - t);
    }
    return xs.sort((p, q) => p - q).filter((x) => Math.abs(x - a) > 1e-12);
  }
  const tab = (fn, xs, cap) => xs.map((x) => {
    const v = fn(x);
    return Number.isFinite(v) && Math.abs(v) <= cap ? v : NaN;
  });

  /* ==============================================================================
   * 15. Бесконечные пределы: планка M и вертикальная асимптота
   * ============================================================================== */
  const VA = {
    inv2: { label: '1/x² при x → 0', f: (x) => 1 / (x * x), a: 0, dom: [-1.5, 1.5], sides: 'both', sgn: 1, delta: (M) => 1 / Math.sqrt(M), dTex: 'δ = 1/√M', xl: 'x', py: '1 / x**2', note: '1/x² &gt; M ⇔ |x| &lt; 1/√M. Для планки M = 100 подходит δ = 0.1, для M = 10⁶ — δ = 0.001. На любую планку есть ответ δ — значит, lim 1/x² = +∞.' },
    shift: { label: '1/(x − 2)² при x → 2', f: (x) => 1 / ((x - 2) * (x - 2)), a: 2, dom: [0.5, 3.5], sides: 'both', sgn: 1, delta: (M) => 1 / Math.sqrt(M), dTex: 'δ = 1/√M', xl: 'x', py: '1 / (x - 2)**2', note: 'Тот же график, сдвинутый вправо на 2: вертикальная асимптота x = 2. Асимптоты появляются там, где знаменатель обращается в ноль, а числитель — нет.' },
    inv: { label: '1/x при x → 0: слева −∞, справа +∞', f: (x) => 1 / x, a: 0, dom: [-1.5, 1.5], sides: 'both', sgn: 0, delta: (M) => 1 / M, dTex: 'δ = 1/M', xl: 'x', py: '1 / x', note: 'Справа 1/x &gt; M при 0 &lt; x &lt; 1/M, слева 1/x &lt; −M. Односторонние пределы +∞ и −∞ разные: про двусторонний предел говорить нельзя, но асимптота x = 0 есть.' },
    ln: { label: 'ln x при x → 0⁺', f: (x) => (x > 0 ? Math.log(x) : NaN), a: 0, dom: [-0.3, 3], sides: 'right', sgn: -1, delta: (M) => Math.exp(-M), dTex: 'δ = e^(−M)', xl: 'x', py: 'np.log(x)', note: 'ln x &lt; −M при x &lt; e^(−M). Логарифм уходит в −∞ очень неохотно: чтобы опуститься ниже −20, нужно x &lt; 2·10⁻⁹.' },
    logloss: { label: 'потери −ln p при p → 0⁺', f: (p) => (p > 0 && p <= 1 ? -Math.log(p) : NaN), a: 0, dom: [-0.05, 1], sides: 'right', sgn: 1, delta: (M) => Math.exp(-M), dTex: 'δ = e^(−M)', xl: 'p — вероятность, которую модель дала верному классу', py: '-np.log(x)  # x — вероятность p верного класса', note: 'Это log-loss одного объекта: −ln p. Прогноз p = 0.5 стоит 0.693, p = 0.01 — 4.6, p = 10⁻⁶ — 13.8. При p → 0 потери → +∞: уверенная ошибка наказывается неограниченно. Поэтому библиотеки обрезают p до [10⁻¹⁵, 1 − 10⁻¹⁵] (потолок потерь ≈ 34.5), а бустинг работает с логитом F, у которого p = σ(F) никогда не равна 0 (шаг 23).' },
  };
  GBC.widget('vertical-asymptote', (el) => {
    const st0 = { fn: 'inv2', M: 10, zoom: false };
    const w = ui.shell(el, { title: 'Предел равен бесконечности: игра с планкой M', sub: 'Соперник ставит планку M (любой высоты). Вы отвечаете δ: все x на расстоянии меньше δ от a (кроме самой a) должны дать значения выше планки. Если ответ есть для любой планки — предел равен +∞.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(VA).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.slider(w.controls, { label: 'Планка M', min: 1, max: 1e6, log: true, value: st0.M, format: (v) => U.fmt(v, 3), onInput: (v) => ((st0.M = v), draw()) });
    ui.toggle(w.controls, { label: 'Лупа: окно подстраивается под δ', checked: false, onChange: (c) => ((st0.zoom = c), draw()) });
    const plot = new GBC.Plot(w.main, { height: 310, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'M', label: 'планка M' }, { key: 'd', label: 'ответ δ(M)' }, { key: 'f', label: 'f на краю: a ± δ' }]);
    function draw() {
      const V = VA[st0.fn];
      const M = st0.M;
      const d = V.delta(M);
      plot.opts.x.label = V.xl;
      const xd = st0.zoom ? (V.sides === 'right' ? [V.a - 0.6 * d, V.a + 5 * d] : [V.a - 4 * d, V.a + 4 * d]) : V.dom;
      const xs = denseNear(xd[0], xd[1], V.a, Math.max(d, (xd[1] - xd[0]) / 20));
      const top = Math.max(1.5 * M, 6);
      const cap = top * 50;
      const ys = tab(V.f, xs, cap);
      const yd = V.sgn > 0 ? [-0.12 * top, top] : V.sgn < 0 ? [-top, Math.max(0.12 * top, 2)] : [-top, top];
      const bands = V.sides === 'right' ? [{ type: 'vband', x0: V.a, x1: V.a + d, color: 'tree', opacity: 0.16 }] : [{ type: 'vband', x0: V.a - d, x1: V.a + d, color: 'tree', opacity: 0.16 }];
      plot.render([
        ...bands,
        V.sgn >= 0 ? { type: 'hline', y: M, color: 'red', width: 1.8, text: 'M = ' + U.fmt(M, 3) } : null,
        V.sgn <= 0 ? { type: 'hline', y: -M, color: 'red', width: 1.8, text: '−M = −' + U.fmt(M, 3) } : null,
        { type: 'vline', x: V.a, color: 'ink2', dash: '4 4', width: 1.2 },
        { type: 'line', x: xs, y: ys, color: 'model', width: 2.2, hover: false },
      ], { x: xd, y: yd });
      st.set('M', U.fmt(M, 3));
      st.set('d', V.dTex + ' = ' + U.fmt(d, 3));
      const edge = V.sides === 'right' ? 'f(a + δ) = ' + U.fmt(V.f(V.a + d), 4) : 'f(a − δ) = ' + U.fmt(V.f(V.a - d), 4) + ', f(a + δ) = ' + U.fmt(V.f(V.a + d), 4);
      st.set('f', edge);
      note.innerHTML = 'Внутри оранжевой полосы ' + (V.sides === 'right' ? 'a &lt; x &lt; a + δ' : '0 &lt; |x − a| &lt; δ') + ' функция ' + (V.sgn > 0 ? 'выше планки M' : V.sgn < 0 ? 'ниже −M' : 'выше M справа и ниже −M слева') + '. ' + V.note + ' Прямая x = ' + V.a + ' — <b>вертикальная асимптота</b>.';
    }
    w.pythonAction(() => {
      const V = VA[st0.fn];
      return 'import numpy as np\n\nf = lambda x: ' + V.py + '\nfor d in [0.1, 0.01, 0.001, 1e-6]:\n    x = ' + V.a + ' + d\n    print(f"f(' + V.a + ' + {d}) = {f(x):.6g}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 16. Предел на бесконечности
   * ============================================================================== */
  const INF = {
    ratio: { label: '(2x + 1)/(x + 3)', f: (x) => (2 * x + 1) / (x + 3), Lp: 2, Lm: 2, py: '(2 * x + 1) / (x + 3)', np: 'При больших |x| слагаемые +1 и +3 ничтожны рядом с 2x и x — остаётся 2x/x = 2. При x → +∞ график подходит снизу, при x → −∞ — сверху.' },
    quad: { label: '(3x² + x)/(x² + 1)', f: (x) => (3 * x * x + x) / (x * x + 1), Lp: 3, Lm: 3, py: '(3 * x**2 + x) / (x**2 + 1)', np: 'Главные слагаемые 3x² и x²: предел 3. Разделите числитель и знаменатель на x²: (3 + 1/x)/(1 + 1/x²) → 3.' },
    inv: { label: '1/x', f: (x) => 1 / x, Lp: 0, Lm: 0, py: '1 / x', np: 'Чем больше |x|, тем меньше дробь: асимптота y = 0, к ней график подходит сверху справа и снизу слева.' },
    exp: { label: 'e^(−x)', f: (x) => Math.exp(-x), Lp: 0, Lm: Infinity, py: 'np.exp(-x)', np: 'При x → +∞ экспонента e^(−x) тает очень быстро (e^(−10) ≈ 4.5·10⁻⁵), а при x → −∞ растёт без границ — предела нет (+∞).' },
    sigm: { label: 'σ(x) = 1/(1 + e^(−x)) — сигмоида', f: (x) => U.sigmoid(x), Lp: 1, Lm: 0, py: '1 / (1 + np.exp(-x))', np: 'Две разные асимптоты: y = 1 справа и y = 0 слева. Сигмоида подходит к ним, но не достигает: σ(10) = 0.99995, а не 1. Поэтому вероятность σ(F) в бустинге никогда не равна ровно 0 или 1.' },
    sinc: { label: 'sin x / x', f: (x) => Math.sin(x) / x, Lp: 0, Lm: 0, py: 'np.sin(x) / x', np: 'Колебания не прекращаются, но их размах не больше 1/|x| → 0. Предел 0, хотя график пересекает асимптоту бесконечно много раз — асимптота вовсе не обязана «не касаться» графика.' },
    sin: { label: 'sin x — предела нет', f: (x) => Math.sin(x), Lp: null, Lm: null, py: 'np.sin(x)', np: 'Синус вечно колеблется между −1 и 1 и ни к чему не подходит: у него нет предела на бесконечности, хотя он и ограничен.' },
  };
  GBC.widget('limit-infinity', (el) => {
    const st0 = { fn: 'ratio', k: 0, eps: 0.05, dir: 1 };
    const NK = 60;
    const tOf = (k) => Math.pow(10, (4 * k) / NK);
    const w = ui.shell(el, { title: 'Предел на бесконечности', sub: 'x уходит всё дальше: 1, 10, 100, … 10 000 (или в минус). Ось расстояния |x| — логарифмическая. Нажмите ▶ и следите, к чему подходит f(x) и с какого X график навсегда входит в коридор ε.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(INF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.segmented(w.controls, { label: 'Куда уходит x', value: 1, options: [{ value: 1, label: 'x → +∞' }, { value: -1, label: 'x → −∞' }], onChange: (v) => ((st0.dir = v), draw()) });
    ui.slider(w.controls, { label: 'Коридор ε', min: 0.001, max: 0.5, log: true, value: st0.eps, onInput: (v) => ((st0.eps = v), draw()) });
    ui.player(w.controls, { label: 'Уходим дальше', min: 0, max: NK, value: 0, fps: 8, format: (k) => 'x = ' + (st0.dir < 0 ? '−' : '') + U.fmt(tOf(k), 3), onChange: (k) => ((st0.k = k), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: '|x| (лог. шкала)', type: 'log', domain: [1, 10000], ticks: [1, 10, 100, 1000, 10000] }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'x' }, { key: 'f', label: 'f(x)' }, { key: 'd', label: '|f(x) − L|' }, { key: 'X', label: 'дальше какого |x| всё в коридоре' }]);
    function draw() {
      const F = INF[st0.fn];
      const s = st0.dir;
      const L = s > 0 ? F.Lp : F.Lm;
      const g = (t) => F.f(s * t);
      const t = tOf(st0.k);
      const ts = U.range(801).map((i) => Math.pow(10, (4 * i) / 800));
      const ys = ts.map(g).map((v) => (Number.isFinite(v) && Math.abs(v) < 1e4 ? v : NaN));
      const fin = Number.isFinite(L);
      let X = 1;
      if (fin) for (const tt of ts) if (!(Math.abs(g(tt) - L) < st0.eps)) X = tt;
      const vis = ys.filter(Number.isFinite);
      let [lo, hi] = U.extent(vis.concat(fin ? [L - st0.eps, L + st0.eps] : []));
      if (!fin && L === Infinity) hi = Math.min(hi, 60);
      plot.render([
        fin ? { type: 'rect', x0: 1, x1: 10000, y0: L - st0.eps, y1: L + st0.eps, fill: 'tree', opacity: 0.14 } : null,
        fin ? { type: 'hline', y: L, color: 'tree', dash: '6 4', text: 'асимптота y = ' + L } : null,
        { type: 'line', x: ts, y: ys, color: 'model', width: 2.2, hover: false },
        fin && X > 1 && X < 10000 ? { type: 'vline', x: X, color: 'ink2', dash: '3 3', text: '|x| > ' + U.fmt(X, 3) } : null,
        { type: 'points', x: [t], y: [Number.isFinite(g(t)) && Math.abs(g(t)) < 1e4 ? g(t) : NaN], color: 'orange', r: 6 },
      ], { y: [lo - (hi - lo) * 0.08, hi + (hi - lo) * 0.08] });
      st.set('x', (s < 0 ? '−' : '') + U.fmt(t, 4));
      st.set('f', U.fmt(g(t), 6));
      st.set('d', fin ? U.fmt(Math.abs(g(t) - L), 3) : '—');
      st.set('X', !fin ? 'предела нет' : X >= 10000 ? '> 10 000' : X <= 1 ? 'с самого начала' : U.fmt(X, 3));
      note.innerHTML = F.np + (fin ? ' <b>Определение:</b> lim f(x) = L при x → ' + (s > 0 ? '+' : '−') + '∞, если для любого ε найдётся такое X, что дальше него все значения в коридоре — как номер N у последовательностей.' : '');
    }
    w.pythonAction(() => 'import numpy as np\n\nf = lambda x: ' + INF[st0.fn].py + '\nfor x in [10, 100, 1000, 10**6]:\n    print(f"f({x}) = {f(' + (st0.dir < 0 ? '-' : '') + 'x):.8f}")\n');
    draw();
  });

  /* ==============================================================================
   * 16б. Главные слагаемые: почему (2x + 1)/(x + 3) → 2
   * ============================================================================== */
  const DOM = {
    r1: { label: '(2x + 1)/(x + 3)', num: [[2, 1, '2x'], [1, 0, '1']], den: [[1, 1, 'x'], [3, 0, '3']], L: 2, lead: '2x/x = 2' },
    r2: { label: '(3x² + x)/(x² + 1)', num: [[3, 2, '3x²'], [1, 1, 'x']], den: [[1, 2, 'x²'], [1, 0, '1']], L: 3, lead: '3x²/x² = 3' },
    r3: { label: '(x² + 5x)/(2x³ + 1)', num: [[1, 2, 'x²'], [5, 1, '5x']], den: [[2, 3, '2x³'], [1, 0, '1']], L: 0, lead: 'x²/(2x³) = 1/(2x) → 0' },
    r4: { label: '(x³ − 100x)/(x² + 1)', num: [[1, 3, 'x³'], [-100, 1, '−100x']], den: [[1, 2, 'x²'], [1, 0, '1']], L: Infinity, lead: 'x³/x² = x → +∞' },
  };
  GBC.widget('dominant-terms', (el) => {
    const st0 = { fn: 'r1', x: 10 };
    const w = ui.shell(el, { title: 'Кто главный при больших x', sub: 'Полосы показывают долю каждого слагаемого в числителе и знаменателе. Увеличивайте x: младшие слагаемые тают, и дробь ведёт себя как отношение старших.' });
    ui.select(w.controls, { label: 'Дробь', value: st0.fn, options: Object.entries(DOM).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.slider(w.controls, { label: 'x', min: 1, max: 1e6, log: true, value: st0.x, format: (v) => U.fmt(v, 3), onInput: (v) => ((st0.x = v), draw()) });
    const bars = H('div', { style: 'display:grid;gap:10px;margin-bottom:10px' });
    w.main.appendChild(bars);
    const plot = new GBC.Plot(w.main, { height: 230, x: { label: 'x (лог. шкала)', type: 'log', domain: [1, 1e6], ticks: [1, 10, 100, 1e3, 1e4, 1e5, 1e6] }, y: { label: 'значение' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'f(x)' }, { key: 'lead', label: 'отношение старших' }, { key: 'L', label: 'предел' }]);
    const COLS = ['var(--c-blue)', 'var(--c-orange)'];
    function bar(title, terms, x) {
      const vals = terms.map(([c, p]) => Math.abs(c * Math.pow(x, p)));
      const tot = U.sum(vals);
      const row = H('div', { style: 'display:flex;height:26px;border-radius:8px;overflow:hidden;border:1px solid var(--border)' });
      terms.forEach(([c, p, name], i) => {
        const share = vals[i] / tot;
        const seg = H('div', { style: 'width:' + (share * 100).toFixed(3) + '%;background:' + COLS[i] + ';color:#fff;font-size:.78rem;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden' }, share > 0.12 ? name + ' · ' + (share * 100).toFixed(share > 0.999 ? 3 : 1) + '%' : '');
        seg.title = name + ': ' + (share * 100).toFixed(4) + '%';
        row.appendChild(seg);
      });
      const leg = H('div', { style: 'font-size:.82rem;color:var(--muted)' }, terms.map(([c, p, name], i) => name + ' = ' + U.fmt(c * Math.pow(x, p), 4) + ' (' + (vals[i] / tot * 100).toFixed(4) + '%)').join('   ·   '));
      return H('div', null, H('div', { style: 'font-weight:650;font-size:.86rem;margin-bottom:4px' }, title), row, leg);
    }
    function draw() {
      const D = DOM[st0.fn];
      const val = (terms, x) => U.sum(terms.map(([c, p]) => c * Math.pow(x, p)));
      const f = (x) => val(D.num, x) / val(D.den, x);
      const ld = (x) => (D.num[0][0] * Math.pow(x, D.num[0][1])) / (D.den[0][0] * Math.pow(x, D.den[0][1]));
      bars.replaceChildren(bar('Числитель', D.num, st0.x), bar('Знаменатель', D.den, st0.x));
      const xs = U.range(301).map((i) => Math.pow(10, (6 * i) / 300));
      const fin = Number.isFinite(D.L);
      const fy = xs.map(f);
      const ly = xs.map(ld);
      const yd = fin ? U.extent(fy.concat([D.L])).map((v, i) => v + (i ? 0.3 : -0.3)) : [-50, 1e3];
      plot.render([
        fin ? { type: 'hline', y: D.L, color: 'tree', dash: '6 4', text: 'предел ' + D.L } : null,
        { type: 'line', x: xs, y: ly.map((v) => (Math.abs(v) > 1e5 ? NaN : v)), color: 'muted', dash: '4 4', width: 1.6, label: 'отношение старших' },
        { type: 'line', x: xs, y: fy.map((v) => (Math.abs(v) > 1e5 ? NaN : v)), color: 'model', width: 2.2, label: 'f(x)' },
        { type: 'points', x: [st0.x], y: [f(st0.x)], color: 'orange', r: 6, legend: false },
      ], { y: yd });
      st.set('f', U.fmt(f(st0.x), 7));
      st.set('lead', D.lead.split('=')[0].trim() + ' = ' + U.fmt(ld(st0.x), 6));
      st.set('L', fin ? String(D.L) : '+∞');
      note.innerHTML = 'При x = ' + U.fmt(st0.x, 3) + ' старшее слагаемое числителя занимает ' + (Math.abs(D.num[0][0] * Math.pow(st0.x, D.num[0][1])) / U.sum(D.num.map(([c, p]) => Math.abs(c * Math.pow(st0.x, p)))) * 100).toFixed(3) + '% его величины. Поэтому дробь ведёт себя как <b>' + D.lead + '</b>. Правило: степени равны — предел равен отношению коэффициентов; в знаменателе степень больше — предел 0; в числителе больше — бесконечность. Строгий приём «делим на старшую степень» — урок 15.4.' + (st0.fn === 'r4' ? ' Заметьте: при x &lt; 10 слагаемое −100x по модулю больше x³ — главенство наступает не сразу.' : '');
    }
    w.pythonAction(() => {
      const D = DOM[st0.fn];
      const poly = (t) => t.map(([c, p]) => U.pyNum(c) + ' * x**' + p).join(' + ');
      return 'num = lambda x: ' + poly(D.num) + '\nden = lambda x: ' + poly(D.den) + '\nfor x in [10, 100, 1000, 10**6]:\n    print(f"x = {x:>7}: f = {num(x) / den(x):.8f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 17. Портрет асимптот
   * ============================================================================== */
  const PORT = {
    ob: { label: '(x² + 1)/(x − 1)', f: (x) => (x * x + 1) / (x - 1), V: [1], A: [{ k: 1, b: 1, txt: 'y = x + 1' }], gap: (R) => 2 / (R - 1), gapTxt: 'f(x) − (x + 1) = 2/(x − 1)', py: '(x**2 + 1) / (x - 1)', note: 'Деление с остатком: (x² + 1)/(x − 1) = x + 1 + 2/(x − 1). Вертикальная асимптота x = 1 (знаменатель 0), а вдали остаток 2/(x − 1) → 0, и график прижимается к <b>наклонной</b> прямой y = x + 1. При x = 100 зазор 2/99 ≈ 0.0202.' },
    two: { label: '2x²/(x² − 4)', f: (x) => (2 * x * x) / (x * x - 4), V: [-2, 2], A: [{ k: 0, b: 2, txt: 'y = 2' }], gap: (R) => 8 / (R * R - 4), gapTxt: 'f(x) − 2 = 8/(x² − 4)', py: '2 * x**2 / (x**2 - 4)', note: 'Две вертикальные асимптоты x = ±2 и одна горизонтальная y = 2 (степени равны, отношение коэффициентов 2/1). Между асимптотами график «проваливается» вниз.' },
    sig: { label: 'σ(x) — сигмоида', f: (x) => U.sigmoid(x), V: [], A: [{ k: 0, b: 1, txt: 'y = 1 (x → +∞)' }, { k: 0, b: 0, txt: 'y = 0 (x → −∞)' }], gap: (R) => 1 - U.sigmoid(R), gapTxt: '1 − σ(x) ≈ e^(−x)', py: '1 / (1 + np.exp(-x))', note: 'Вертикальных асимптот нет, горизонтальных — две, разные справа и слева. Зазор 1 − σ(x) = σ(−x) ≈ e^(−x) тает экспоненциально быстро.' },
    xinv: { label: 'x + 1/x', f: (x) => x + 1 / x, V: [0], A: [{ k: 1, b: 0, txt: 'y = x' }], gap: (R) => 1 / R, gapTxt: 'f(x) − x = 1/x', py: 'x + 1 / x', note: 'Вертикальная асимптота x = 0 и наклонная y = x. Чем дальше, тем меньше зазор 1/x.' },
  };
  GBC.widget('asymptote-portrait', (el) => {
    const st0 = { fn: 'ob', R: 8, show: true };
    const w = ui.shell(el, { title: 'Портрет функции: все асимптоты', sub: 'Вертикальные — где функция уходит в бесконечность; горизонтальные и наклонные — к чему прижимается график вдали. Отодвигайте камеру и смотрите, как график «прилипает» к асимптотам.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(PORT).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.slider(w.controls, { label: 'Окно: от −R до R', min: 5, max: 500, log: true, value: st0.R, format: (v) => 'R = ' + U.fmt(v, 3), onInput: (v) => ((st0.R = v), draw()) });
    ui.toggle(w.controls, { label: 'Показать асимптоты', checked: true, onChange: (c) => ((st0.show = c), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'вертикальные' }, { key: 'a', label: 'горизонт. / наклонные' }, { key: 'g', label: 'зазор при x = R' }]);
    function draw() {
      const P = PORT[st0.fn];
      const R = st0.R;
      let xs = U.linspace(-R, R, 1600);
      for (const v of P.V) xs = xs.concat(denseNear(-R, R, v, R / 30, 200));
      xs = xs.sort((a, b) => a - b).filter((x) => P.V.every((v) => Math.abs(x - v) > 1e-9));
      const isOb = P.A.some((A) => A.k !== 0);
      const yd = isOb ? [-1.3 * R, 1.3 * R] : st0.fn === 'sig' ? [-0.3, 1.3] : [-3 * Math.max(1, Math.log10(R)) - 2, 3 * Math.max(1, Math.log10(R)) + 6];
      const cap = Math.abs(yd[1]) * 20;
      const ys = xs.map((x) => {
        const v = P.f(x);
        return Number.isFinite(v) && Math.abs(v) < cap ? v : NaN;
      });
      for (let i = 1; i < ys.length; i++) if (P.V.some((v) => xs[i - 1] < v && xs[i] > v)) ys[i] = NaN;
      const lay = [];
      if (st0.show) {
        for (const v of P.V) lay.push({ type: 'vline', x: v, color: 'tree', dash: '6 4', width: 1.6, text: 'x = ' + v });
        for (const A of P.A) lay.push({ type: 'line', x: [-R, R], y: [A.b - A.k * R, A.b + A.k * R], color: 'tree', dash: '6 4', width: 1.6, hover: false }, { type: 'text', items: [{ x: -R * 0.6, y: A.b - A.k * R * 0.6, dy: A.k ? -10 : -8, text: A.txt }] });
      }
      lay.push({ type: 'line', x: xs, y: ys, color: 'model', width: 2.2, hover: false });
      plot.render(lay, { x: [-R, R], y: yd });
      st.set('v', P.V.length ? P.V.map((v) => 'x = ' + v).join(', ') : 'нет');
      st.set('a', P.A.map((A) => A.txt).join('; '));
      st.set('g', U.fmt(P.gap(R), 4) + '  (' + P.gapTxt + ')');
      note.innerHTML = P.note;
    }
    w.pythonAction(() => 'import numpy as np\n\nf = lambda x: ' + PORT[st0.fn].py + '\nfor x in [10, 100, 1000]:\n    print(f"x = {x}: f(x) = {f(x):.6f}")\n');
    draw();
  });

  /* ==============================================================================
   * 18. Игра ε–δ
   * ============================================================================== */
  const ED = {
    lin: { label: '3x − 1, x → 2, L = 5', f: (x) => 3 * x - 1, a: 2, L: 5, dom: [0.5, 3.5], formula: (e) => e / 3, fTex: 'δ = ε/3', hint: 'Отклонение |3x − 1 − 5| = 3|x − 2|: по вертикали втрое больше, чем по горизонтали. Формула δ = ε/3 выигрывает при любом ε.' },
    sq: { label: 'x², x → 2, L = 4', f: (x) => x * x, a: 2, L: 4, dom: [0.5, 3.5], formula: (e) => Math.min(1, e / 5), fTex: 'δ = min(1, ε/5)', hint: 'Формула δ = min(1, ε/5) всегда выигрывает (доказательство — шаг 19), хотя наибольшее δ чуть больше.' },
    inv: { label: '1/x, x → 2, L = 1/2', f: (x) => 1 / x, a: 2, L: 0.5, dom: [0.4, 4], formula: (e) => Math.min(1, 2 * e), fTex: 'δ = min(1, 2ε)', hint: 'Справа график пологий, слева круче — допуск съедает левая сторона. Формула δ = min(1, 2ε) из шага 19 работает всегда.' },
    sqrt: { label: '√x, x → 4, L = 2', f: (x) => (x >= 0 ? Math.sqrt(x) : NaN), a: 4, L: 2, dom: [0, 8], formula: (e) => Math.min(4, 2 * e), fTex: 'δ = min(4, 2ε)', hint: '|√x − 2| = |x − 4|/(√x + 2) ≤ |x − 4|/2, поэтому δ = min(4, 2ε) годится.' },
    hole: { label: '(x² − 1)/(x − 1), x → 1, L = 2', f: (x) => (x * x - 1) / (x - 1), a: 1, L: 2, dom: [-0.5, 2.5], formula: (e) => e, fTex: 'δ = ε', hint: 'Это прямая x + 1 с дыркой: δ = ε. Значение в самой точке не проверяется (условие 0 < |x − a|), поэтому дырка не мешает.' },
    step: { label: 'ступенька, x → 0, «L = 0.5»', f: (x) => (x >= 0 ? 1 : 0), a: 0, L: 0.5, dom: [-1.5, 1.5], formula: null, hint: 'При ε ≤ 0.5 никакое δ не подходит: рядом с нулём есть точки со значениями 0 и 1, а коридор шириной 2ε ≤ 1 их не вмещает. С любым другим L — та же история. Предела нет.' },
    osc: { label: 'sin(1/x), x → 0, «L = 0»', f: (x) => Math.sin(1 / x), a: 0, dom: [-0.5, 0.5], L: 0, formula: null, n: 4001, hint: 'При ε &lt; 1 соперник побеждает: в любой окрестности нуля есть точки, где sin(1/x) = ±1. Предела нет.' },
  };
  function okDelta(F, eps, d) {
    const xs = U.linspace(F.a - d, F.a + d, F.n || 1601);
    for (let k = 1; k <= 8; k++) xs.push(F.a - d * Math.pow(10, -k), F.a + d * Math.pow(10, -k));
    return xs.every((x) => Math.abs(x - F.a) < 1e-12 || Math.abs(F.f(x) - F.L) < eps);
  }
  function bestDelta(F, eps, dMax = 2) {
    if (okDelta(F, eps, dMax)) return dMax;
    if (!okDelta(F, eps, 1e-6)) return null;
    let lo = 1e-6;
    let hi = dMax;
    for (let i = 0; i < 45; i++) {
      const m = (lo + hi) / 2;
      if (okDelta(F, eps, m)) lo = m;
      else hi = m;
    }
    return lo;
  }
  GBC.widget('epsilon-delta', (el) => {
    const st0 = { fn: 'sq', eps: 0.5, del: 0.5 };
    const w = ui.shell(el, { title: 'Игра «ε–δ»', sub: 'Соперник задаёт допуск ε по вертикали (оранжевая полоса). Вы выбираете δ по горизонтали (синяя полоса). Вы выиграли, если весь кусок графика над синей полосой (кроме самой точки a) лежит внутри оранжевой.' });
    ui.select(w.controls, { label: 'Задача', value: st0.fn, options: Object.entries(ED).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    const sE = ui.slider(w.controls, { label: 'Допуск соперника ε', min: 0.005, max: 1, log: true, value: st0.eps, onInput: (v) => ((st0.eps = v), draw()) });
    const sD = ui.slider(w.controls, { label: 'Ваш ответ δ', min: 0.0005, max: 2, log: true, value: st0.del, onInput: (v) => ((st0.del = v), draw()) });
    const bx = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
    w.controls.appendChild(bx);
    ui.button(bx, { label: 'Подобрать δ', kind: 'primary', small: true, onClick: () => {
      const d = bestDelta(ED[st0.fn], st0.eps);
      if (d) (st0.del = Math.max(0.0005, d * 0.97)), sD.set(st0.del);
      draw();
    } });
    ui.button(bx, { label: 'Формула δ(ε)', small: true, onClick: () => {
      const F = ED[st0.fn];
      if (F.formula) (st0.del = F.formula(st0.eps)), sD.set(st0.del);
      draw();
    } });
    ui.button(bx, { label: 'Соперник: ε вдвое меньше', small: true, onClick: () => ((st0.eps = Math.max(0.005, st0.eps / 2)), sE.set(st0.eps), draw()) });
    const plot = new GBC.Plot(w.main, { height: 330, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'ε' }, { key: 'd', label: 'δ' }, { key: 'res', label: 'итог' }, { key: 'best', label: 'наибольшее подходящее δ' }, { key: 'form', label: 'формула' }]);
    function draw() {
      const F = ED[st0.fn];
      const d = st0.del;
      const win = okDelta(F, st0.eps, d);
      const best = bestDelta(F, st0.eps);
      const xs = U.linspace(F.dom[0], F.dom[1], F.n || 1601).filter((x) => Math.abs(x - F.a) > 1e-9);
      let ys = xs.map(F.f);
      if (st0.fn === 'step') ys = ys.map((v, i) => (i && Math.abs(v - ys[i - 1]) > 0.5 ? NaN : v));
      const inWin = (x) => Math.abs(x - F.a) < d;
      const good = xs.map((x, i) => (inWin(x) && Math.abs(ys[i] - F.L) < st0.eps ? ys[i] : NaN));
      const bad = xs.map((x, i) => (inWin(x) && !(Math.abs(ys[i] - F.L) < st0.eps) ? ys[i] : NaN));
      const yv = ys.filter(Number.isFinite);
      const [lo, hi] = U.extent(yv.concat([F.L - st0.eps, F.L + st0.eps]));
      plot.render([
        { type: 'rect', x0: F.dom[0], x1: F.dom[1], y0: F.L - st0.eps, y1: F.L + st0.eps, fill: 'tree', opacity: 0.16 },
        { type: 'vband', x0: F.a - d, x1: F.a + d, color: 'model', opacity: 0.12 },
        { type: 'line', x: xs, y: ys, color: 'muted', width: 1.6, hover: false },
        { type: 'line', x: xs, y: good, color: 'model', width: 3.2, label: 'внутри коридора', hover: false },
        { type: 'line', x: xs, y: bad, color: 'red', width: 3.2, label: 'вылезает', hover: false },
        { type: 'points', x: [F.a], y: [F.L], color: 'ink', r: 5, hollow: true },
        { type: 'text', items: [{ x: F.dom[0], y: F.L + st0.eps, dx: 4, dy: -4, text: 'L + ε' }, { x: F.dom[0], y: F.L - st0.eps, dx: 4, dy: 12, text: 'L − ε' }] },
      ], { x: F.dom, y: [lo - (hi - lo) * 0.06, hi + (hi - lo) * 0.06] });
      st.set('e', U.fmt(st0.eps, 3));
      st.set('d', U.fmt(d, 3));
      st.set('res', win ? '✓ вы выиграли' : '✗ график вылезает');
      st.set('best', best === null ? 'нет такого' : best >= 2 ? '≥ 2' : U.fmt(best, 4));
      st.set('form', F.formula ? F.fTex + ' = ' + U.fmt(F.formula(st0.eps), 4) : 'нет');
      note.innerHTML = (win ? '<b>Победа:</b> при 0 &lt; |x − ' + F.a + '| &lt; ' + U.fmt(d, 3) + ' все значения в пределах ' + U.fmt(st0.eps, 3) + ' от L. ' : '<b>Пока нет:</b> красные куски графика вылезают из коридора — уменьшите δ. ') + 'Предел равен L, если вы выигрываете при <b>любом</b> ε соперника — а для этого нужна <b>формула</b> δ(ε). ' + (win || !F.formula ? F.hint : 'Нажмите «Формула δ(ε)», чтобы увидеть готовое правило.');
    }
    draw();
  });

  /* ==============================================================================
   * 19. Формула δ(ε) против наибольшего δ
   * ============================================================================== */
  GBC.widget('delta-formula', (el) => {
    const st0 = { fn: 'sq', eps: 0.1 };
    const cache = {};
    const keys = ['lin', 'sq', 'inv', 'sqrt', 'hole'];
    const w = ui.shell(el, { title: 'Формула δ(ε) и наибольшее δ', sub: 'Синяя линия — наибольшее δ, найденное перебором; оранжевая — δ из доказательства. Формула годится, если она нигде не выше синей линии. Обе оси логарифмические.' });
    ui.select(w.controls, { label: 'Задача', value: st0.fn, options: keys.map((k) => ({ value: k, label: ED[k].label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.slider(w.controls, { label: 'ε', min: 0.001, max: 1, log: true, value: st0.eps, onInput: (v) => ((st0.eps = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'допуск ε (лог.)', type: 'log', domain: [0.001, 1] }, y: { label: 'δ (лог.)', type: 'log' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'b', label: 'наибольшее δ*' }, { key: 'f', label: 'формула δ(ε)' }, { key: 'r', label: 'доля δ/δ*' }]);
    function curveFor(k) {
      if (cache[k]) return cache[k];
      const es = U.range(31).map((i) => Math.pow(10, -3 + (3 * i) / 30));
      return (cache[k] = { es, best: es.map((e) => bestDelta(ED[k], e, 4)) });
    }
    function draw() {
      const F = ED[st0.fn];
      const C = curveFor(st0.fn);
      const fb = C.es.map(F.formula);
      const b = bestDelta(F, st0.eps, 4);
      const fv = F.formula(st0.eps);
      plot.render([
        { type: 'line', x: C.es, y: C.best, color: 'model', width: 2.4, label: 'наибольшее δ* (перебор)' },
        { type: 'line', x: C.es, y: fb, color: 'tree', width: 2.4, dash: '6 4', label: F.fTex + ' (доказательство)' },
        { type: 'vline', x: st0.eps, color: 'ink2', dash: '3 3', width: 1 },
        { type: 'points', x: [st0.eps, st0.eps], y: [b, fv], color: (i) => (i ? 'tree' : 'model'), r: 5, legend: false },
      ], { y: [Math.min(...fb, ...C.best) * 0.6, Math.max(...fb, ...C.best) * 1.6] });
      st.set('b', U.fmt(b, 5));
      st.set('f', U.fmt(fv, 5));
      st.set('r', U.fmt(fv / b, 3));
      note.innerHTML = 'Оранжевая линия всюду ниже (или на) синей — значит, формула выигрывает при любом ε. Она не обязана давать наибольшее δ: в доказательстве мы огрубляем оценки ради простоты (например, |x + 2| &lt; 5). Обе линии на логарифмических осях идут с наклоном 1: при малых ε δ пропорционально ε. У наибольшего δ* коэффициент близок к 1/|наклон графика в точке a|: чем круче график, тем уже приходится брать окрестность.';
    }
    draw();
  });

  /* ==============================================================================
   * 21. Секущая → касательная: производная как предел
   * ============================================================================== */
  const SEC = {
    trip: { label: 'путь s(t) = 3t² − t³/5 в t = 2', f: (t) => 3 * t * t - (t * t * t) / 5, a: 2, dom: [0, 5], lim: [9.6, 9.6], py: '3 * x**2 - x**3 / 5', note: 'Средняя скорость на [2, 2 + h] равна 9.6 + 1.8h − 0.2h² и подходит к 9.6 с обеих сторон. Секущие поворачиваются и прижимаются к одной прямой — касательной с наклоном 9.6 м/с.' },
    sq: { label: 'x² в x = 1', f: (x) => x * x, a: 1, dom: [-1, 3], lim: [2, 2], py: 'x**2', note: '((1 + h)² − 1)/h = 2 + h → 2. График отношения — прямая 2 + h с дыркой при h = 0: та же картина, что у (x² − 1)/(x − 1) в шаге 10!' },
    abs: { label: '|x| в x = 0 — излом', f: Math.abs, a: 0, dom: [-2, 2], lim: [-1, 1], py: 'np.abs(x)', note: 'Справа отношение |h|/h = 1, слева −1. Односторонние пределы разные — общего предела нет, значит, <b>производной в нуле нет</b>. Сама функция при этом непрерывна.' },
    cbrt: { label: '∛x в x = 0 — вертикальная касательная', f: Math.cbrt, a: 0, dom: [-2, 2], lim: [Infinity, Infinity], py: 'np.cbrt(x)', note: 'Отношение ∛h/h = h^(−2/3) → +∞: секущие встают вертикально. Конечного предела нет — производной нет, касательная вертикальна.' },
    step: { label: 'ступенька [x ≥ 0] в x = 0 — скачок', f: (x) => (x >= 0 ? 1 : 0), a: 0, dom: [-2, 2], lim: [Infinity, 0], py: '(x >= 0) * 1.0', note: 'Справа отношение (1 − 1)/h = 0, слева (0 − 1)/h = −1/h → +∞. На скачке производной нет. Так и у деревьев решений: на пороге наклона нет, а между порогами он равен нулю (урок 15.4).' },
  };
  GBC.widget('secant-limit', (el) => {
    const st0 = { fn: 'trip', side: 1, h: 1 };
    const w = ui.shell(el, { title: 'Секущая превращается в касательную', sub: 'Сверху — график и секущая через точки a и a + h. Снизу — наклон секущей (f(a + h) − f(a))/h как функция от h. При h = 0 отношение не определено — выколотая точка. Предел при h → 0 и есть производная.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(SEC).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.segmented(w.controls, { label: 'С какой стороны', value: 1, options: [{ value: 1, label: 'справа h > 0' }, { value: -1, label: 'слева h < 0' }], onChange: (v) => ((st0.side = v), draw()) });
    ui.slider(w.controls, { label: '|h|', min: 0.001, max: 1.5, log: true, value: st0.h, onInput: (v) => ((st0.h = v), draw()) });
    const pg = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'f(x)' } });
    const pq = new GBC.Plot(w.main, { height: 220, x: { label: 'h', domain: [-1.5, 1.5] }, y: { label: 'наклон секущей Q(h)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'h', label: 'h' }, { key: 'q', label: 'Q(h)' }, { key: 'l', label: 'предел слева' }, { key: 'r', label: 'предел справа' }, { key: 'd', label: 'производная' }]);
    function draw() {
      const S = SEC[st0.fn];
      const h = st0.side * st0.h;
      const fa = S.f(S.a);
      const Q = (t) => (S.f(S.a + t) - fa) / t;
      const q = Q(h);
      const cv = curve(S.f, S.dom[0], S.dom[1], 801, { jump: st0.fn === 'step' ? 0.5 : undefined });
      const [ylo, yhi] = U.extent(cv.y.filter(Number.isFinite));
      const span = yhi - ylo;
      const sx = [S.dom[0], S.dom[1]];
      pg.render([
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.2, hover: false },
        { type: 'line', x: sx, y: sx.map((x) => fa + q * (x - S.a)), color: 'tree', width: 2, hover: false },
        { type: 'points', x: [S.a, S.a + h], y: [fa, S.f(S.a + h)], color: (i) => (i ? 'tree' : 'ink'), r: 5, tooltip: (i) => [['x', U.fmt(i ? S.a + h : S.a, 5)], ['f', U.fmt(i ? S.f(S.a + h) : fa, 5)]] },
      ], { x: S.dom, y: [ylo - span * 0.15, yhi + span * 0.15] });
      const hs = U.linspace(-1.5, 1.5, 1201).filter((t) => Math.abs(t) > 1e-9);
      const qs = hs.map(Q);
      const fin = qs.filter((v) => Number.isFinite(v) && Math.abs(v) < 50);
      let [qlo, qhi] = U.extent(fin.concat(S.lim.filter(Number.isFinite)));
      if (S.lim.some((v) => !Number.isFinite(v))) qhi = Math.max(qhi, 12);
      qhi = Math.min(qhi, 25);
      const qp = qs.map((v) => (Math.abs(v) > 40 ? NaN : v));
      pq.render([
        ...S.lim.filter(Number.isFinite).filter((v, i, arr) => arr.indexOf(v) === i).map((v) => ({ type: 'hline', y: v, color: 'tree', dash: '6 4', text: 'предел ' + v })),
        { type: 'vline', x: 0, color: 'ink2', dash: '3 3', width: 1 },
        { type: 'line', x: hs, y: qp.map((v, i) => (hs[i] < 0 ? v : NaN)), color: 'blue', width: 2, label: 'h < 0' },
        { type: 'line', x: hs, y: qp.map((v, i) => (hs[i] > 0 ? v : NaN)), color: 'orange', width: 2, label: 'h > 0' },
        { type: 'points', x: [h], y: [Math.abs(q) < 40 ? q : NaN], color: st0.side > 0 ? 'orange' : 'blue', r: 6, legend: false },
      ], { y: [qlo - (qhi - qlo) * 0.1 - 0.2, qhi + (qhi - qlo) * 0.1 + 0.2] });
      const lt = (v) => (v === Infinity ? '+∞' : U.fmt(v, 4));
      st.set('h', U.fmt(h, 4));
      st.set('q', U.fmt(q, 6));
      st.set('l', lt(S.lim[0]));
      st.set('r', lt(S.lim[1]));
      st.set('d', S.lim[0] === S.lim[1] && Number.isFinite(S.lim[0]) ? U.fmt(S.lim[0], 4) : 'нет');
      note.innerHTML = S.note;
    }
    w.pythonAction(() => {
      const S = SEC[st0.fn];
      return 'import numpy as np\n\nf = lambda x: ' + S.py + '\na = ' + S.a + '\nfor h in [0.1, 0.01, 0.001, -0.001, -0.01, -0.1]:\n    print(f"h = {h:7}: (f(a + h) − f(a)) / h = {(f(a + h) - f(a)) / h:.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 22. Пределы в бустинге: прогноз и потери как последовательности
   * ============================================================================== */
  const bCache = {};
  function boostRun(nu) {
    if (bCache[nu]) return bCache[nu];
    const data = GBC.datasets.regression1d({ kind: 'sine', n: 200, noise: 0.3, seed: 42 });
    const sp = GBC.datasets.trainTestSplit(data.X, data.y, 0.3, 0);
    const m = new GBC.GradientBoosting({ nEstimators: 400, learningRate: nu, maxDepth: 2 });
    m.fit(sp.Xtrain, sp.ytrain, { evalSet: [sp.Xtest, sp.ytest] });
    return (bCache[nu] = { tr: m.history.train, va: m.history.eval });
  }
  GBC.widget('boosting-limit', (el) => {
    const st0 = { nu: 0.1, M: 50, boost: 0.1 };
    const w = ui.shell(el, { title: 'Бустинг как последовательность', sub: 'Сверху — прогноз для одного объекта: Fₘ = Fₘ₋₁ + ν(y − Fₘ₋₁), y = 10. Снизу — настоящие потери бустинга на обучении и проверке после M деревьев (ось M логарифмическая).' });
    ui.slider(w.controls, { label: 'Темп ν (верхний график)', min: 0.02, max: 1, step: 0.01, value: st0.nu, onInput: (v) => ((st0.nu = v), draw()) });
    ui.segmented(w.controls, { label: 'Темп ν бустинга (нижний график)', value: 0.1, options: [{ value: 0.1, label: '0.1' }, { value: 0.3, label: '0.3' }], onChange: (v) => ((st0.boost = v), draw()) });
    ui.player(w.controls, { label: 'Шагов / деревьев M', min: 1, max: 400, value: st0.M, fps: 20, format: (k) => 'M = ' + k, onChange: (k) => ((st0.M = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'шаг m', domain: [0, 60] }, y: { label: 'прогноз Fₘ', domain: [0, 11] } });
    const p2 = new GBC.Plot(w.main, { height: 260, x: { label: 'деревьев M (лог.)', type: 'log', domain: [1, 400] }, y: { label: 'потери' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'F', label: 'Fₘ (сверху)' }, { key: 'r', label: 'остаток y − Fₘ' }, { key: 'tr', label: 'обучение' }, { key: 'va', label: 'проверка' }]);
    function draw() {
      const nu = st0.nu;
      const ms = U.range(61);
      const Fs = ms.map((m) => 10 * (1 - Math.pow(1 - nu, m)));
      const m = Math.min(st0.M, 60);
      p1.render([
        { type: 'hline', y: 10, color: 'tree', dash: '6 4', text: 'y = 10 — предел' },
        { type: 'line', x: ms, y: Fs, color: 'model', width: 1, opacity: 0.4, hover: false },
        { type: 'points', x: ms, y: Fs, color: (i) => (i === m ? 'tree' : 'model'), r: (i) => (i === m ? 6 : 3), tooltip: (i) => [['m', String(i)], ['Fₘ', U.fmt(Fs[i], 5)], ['остаток', U.fmt(10 - Fs[i], 4)]] },
      ]);
      const R = boostRun(st0.boost);
      const Ms = U.range(400, 1);
      const M = st0.M;
      const tr = Ms.map((k) => R.tr[k]);
      const va = Ms.map((k) => R.va[k]);
      let best = 1;
      for (let k = 1; k <= 400; k++) if (R.va[k] < R.va[best]) best = k;
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: Ms, y: tr, color: 'train', width: 2.2, label: 'обучение' },
        { type: 'line', x: Ms, y: va, color: 'valid', width: 2.2, label: 'проверка' },
        { type: 'vline', x: best, color: 'valid', dash: '5 4', width: 1.2, text: 'M* = ' + best },
        { type: 'points', x: [M, M], y: [R.tr[M], R.va[M]], color: (i) => (i ? 'valid' : 'train'), r: 5, legend: false },
      ], { y: [0, Math.max(R.tr[1], R.va[1]) * 1.05] });
      st.set('F', U.fmt(Fs[m], 5) + ' (m = ' + m + ')');
      st.set('r', '10·(1 − ν)^m = ' + U.fmt(10 - Fs[m], 4));
      st.set('tr', U.fmt(R.tr[M], 4) + ' (Δ ' + U.fmtFixed(R.tr[M] - R.tr[M - 1], 6) + ')');
      st.set('va', U.fmt(R.va[M], 4));
      note.innerHTML = '<b>Сверху:</b> остаток умножается на (1 − ν) на каждом шаге — геометрическая прогрессия из шага 5. При 0 &lt; ν &lt; 2 он стремится к нулю, а прогноз — к y. При ν = 0.1 до 10% остатка нужно 22 шага, до 1% — 44. <b>Снизу:</b> потери на обучении после каждого дерева не растут и не бывают меньше нуля — последовательность монотонная и ограниченная снизу, поэтому по теореме Вейерштрасса (шаг 7) у неё <b>есть предел</b>, хотя заранее мы его не знаем. Потери на проверке не монотонны: они падают до минимума (M = ' + best + ') и затем медленно растут — модель начинает подгоняться под шум. Предел обучения и лучшая модель — разные вещи.';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse import datasets, GradientBoosting\n\n# один объект: остаток умножается на (1 − ν)\nnu, y, F = ' + U.pyNum(st0.nu) + ', 10.0, 0.0\nfor m in range(1, 61):\n    F += nu * (y - F)\n    if m in (1, 10, 22, 44, 60):\n        print(f"m = {m:2d}: F = {F:.5f}, остаток {y - F:.5f}")\n\nX, y_all = datasets.regression_1d(kind="sine", n=200, noise=0.3, seed=42)\nXtr, Xva, ytr, yva = datasets.train_test_split(X, y_all, test_size=0.3, seed=0)\nm = GradientBoosting(n_estimators=400, learning_rate=' + st0.boost + ', max_depth=2).fit(Xtr, ytr, eval_set=(Xva, yva))\ntr, va = np.array(m.history_["train"]), np.array(m.history_["eval"])\nprint("потери на обучении не растут:", bool(np.all(np.diff(tr) <= 1e-12)), " последние:", np.round(tr[-3:], 5))\nprint("минимум на проверке при M =", int(va.argmin()))\n');
    draw();
  });

  /* ==============================================================================
   * 23. Сигмоида и log-loss на бесконечностях
   * ============================================================================== */
  GBC.widget('sigmoid-limits', (el) => {
    const st0 = { F: 3 };
    const w = ui.shell(el, { title: 'Сигмоида и log-loss на краях', sub: 'Бустинг для классификации выдаёт число F (логит), вероятность класса 1 — p = σ(F). Двигайте F к ±∞ и смотрите на асимптоты вероятности и потерь при верном ответе y = 1.' });
    ui.slider(w.controls, { label: 'Логит F', min: -40, max: 40, step: 0.1, value: st0.F, onInput: (v) => ((st0.F = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'F' }, y: { label: 'p = σ(F)', domain: [-0.1, 1.1] } });
    const p2 = new GBC.Plot(w.main, { height: 240, x: { label: 'F' }, y: { label: 'потери при y = 1' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'p = σ(F)' }, { key: 'q', label: '1 − p' }, { key: 'l', label: 'потери' }, { key: 'one', label: 'в float64 σ(F) == 1?' }]);
    const loss = (F) => (F > 0 ? Math.log1p(Math.exp(-F)) : -F + Math.log1p(Math.exp(F)));
    function draw() {
      const F = st0.F;
      const R = Math.max(10, Math.abs(F) + 2);
      const xs = U.linspace(-R, R, 801);
      p1.render([
        { type: 'hline', y: 1, color: 'tree', dash: '6 4', text: 'y = 1' },
        { type: 'hline', y: 0, color: 'tree', dash: '6 4', text: 'y = 0' },
        { type: 'line', x: xs, y: xs.map(U.sigmoid), color: 'model', width: 2.2, hover: false },
        { type: 'points', x: [F], y: [U.sigmoid(F)], color: 'orange', r: 6 },
      ], { x: [-R, R] });
      const ls = xs.map(loss);
      p2.render([
        { type: 'line', x: xs, y: xs.map((x) => (x < 0 ? -x : NaN)), color: 'tree', dash: '6 4', width: 1.4, label: 'асимптота −F', hover: false },
        { type: 'hline', y: 0, color: 'tree', dash: '6 4' },
        { type: 'line', x: xs, y: ls, color: 'model', width: 2.2, label: 'ln(1 + e^(−F))', hover: false },
        { type: 'points', x: [F], y: [loss(F)], color: 'orange', r: 6, legend: false },
      ], { x: [-R, R], y: [-0.05 * R, R * 1.05] });
      const p = U.sigmoid(F);
      const q = U.sigmoid(-F);
      st.set('p', U.fmt(p, 12));
      st.set('q', U.fmt(q, 4));
      st.set('l', U.fmt(loss(F), 6));
      st.set('one', 1 / (1 + Math.exp(-F)) === 1 ? 'да (округление)' : 'нет');
      note.innerHTML = 'Математически 0 &lt; σ(F) &lt; 1 при любом конечном F: асимптоты y = 0 и y = 1 не достигаются. Потери ln(1 + e^(−F)) при F → +∞ стремятся к 0 (≈ e^(−F)), а при F → −∞ — к бесконечности, прижимаясь к наклонной асимптоте y = −F: уверенный ошибочный прогноз штрафуется почти линейно. В компьютере же при F &gt; 36.7 вычисление 1/(1 + e^(−F)) уже даёт ровно 1.0 — предел «достигается» из-за округления. Поэтому потери считают устойчивой формулой (урок 15.4), а не через −ln σ(F).';
    }
    w.pythonAction(() => 'import numpy as np\n\nF = ' + U.pyNum(st0.F) + '\np = 1 / (1 + np.exp(-F))\nloss = np.logaddexp(0, -F)          # ln(1 + e^(−F)) без переполнения\nprint("p =", p, " 1 − p =", 1 / (1 + np.exp(F)), " потери =", loss)\nprint("σ(37) == 1.0 в float64:", 1 / (1 + np.exp(-37.0)) == 1.0)\n');
    draw();
  });

  /* ==============================================================================
   * 24. Закон больших чисел: предел среднего
   * ============================================================================== */
  GBC.widget('running-mean', (el) => {
    const st0 = { seed: 1, traj: 5, eps: 0.1 };
    const NM = 100000;
    const SD = Math.sqrt(35 / 12);
    const w = ui.shell(el, { title: 'Среднее бросков кубика → 3.5', sub: 'Бросаем кубик n раз и считаем среднее выпавших очков. Каждая линия — свой эксперимент. Пунктир — типичный разброс ±2σ/√n. Ось n логарифмическая.' });
    ui.segmented(w.controls, { label: 'Экспериментов', value: 5, options: [{ value: 1, label: '1' }, { value: 5, label: '5' }, { value: 20, label: '20' }], onChange: (v) => ((st0.traj = v), draw()) });
    ui.slider(w.controls, { label: 'Коридор ε', min: 0.005, max: 0.5, log: true, value: st0.eps, onInput: (v) => ((st0.eps = v), draw()) });
    ui.button(w.controls, { label: 'Новые броски', icon: 'step', onClick: () => ((st0.seed += 1), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'число бросков n (лог.)', type: 'log', domain: [1, NM], ticks: [1, 10, 100, 1e3, 1e4, 1e5] }, y: { label: 'среднее очков', domain: [1, 6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'среднее после 100 000 (эксп. 1)' }, { key: 'e', label: 'ошибка' }, { key: 'N', label: 'последний выход из коридора (эксп. 1)' }]);
    const cache = {};
    function run(seed) {
      if (cache[seed]) return cache[seed];
      const rng = new GBC.RNG(seed);
      const xs = [];
      const ys = [];
      let s = 0;
      let next = 1;
      const out = [];
      for (let n = 1; n <= NM; n++) {
        s += rng.randint(6) + 1;
        const m = s / n;
        out.push(m);
        if (n >= next) {
          xs.push(n);
          ys.push(m);
          next = Math.max(n + 1, Math.floor(n * 1.02));
        }
      }
      return (cache[seed] = { xs, ys, all: out, mean: s / NM });
    }
    function draw() {
      const lay = [];
      lay.push({ type: 'rect', x0: 1, x1: NM, y0: 3.5 - st0.eps, y1: 3.5 + st0.eps, fill: 'tree', opacity: 0.14 });
      lay.push({ type: 'hline', y: 3.5, color: 'tree', dash: '6 4', text: 'математическое ожидание 3.5' });
      const ns = U.range(200).map((i) => Math.pow(NM, i / 199));
      lay.push({ type: 'line', x: ns, y: ns.map((n) => Math.min(6, 3.5 + (2 * SD) / Math.sqrt(n))), color: 'muted', dash: '4 4', width: 1.2, hover: false });
      lay.push({ type: 'line', x: ns, y: ns.map((n) => Math.max(1, 3.5 - (2 * SD) / Math.sqrt(n))), color: 'muted', dash: '4 4', width: 1.2, hover: false });
      let first = null;
      for (let t = 0; t < st0.traj; t++) {
        const R = run(st0.seed * 100 + t);
        if (!first) first = R;
        lay.push({ type: 'line', x: R.xs, y: R.ys, color: t === 0 ? 'model' : 'muted', width: t === 0 ? 2.2 : 1, opacity: t === 0 ? 1 : 0.6, hover: false });
      }
      plot.render(lay);
      let last = 0;
      for (let n = 1; n <= NM; n++) if (!(Math.abs(first.all[n - 1] - 3.5) < st0.eps)) last = n;
      st.set('m', U.fmt(first.mean, 5));
      st.set('e', U.fmt(Math.abs(first.mean - 3.5), 3));
      st.set('N', last >= NM ? 'ещё не вошёл' : fmtInt(last));
      note.innerHTML = 'Все эксперименты рано или поздно входят в коридор вокруг 3.5 — это <b>закон больших чисел</b>. Но это предел другого рода: номер, после которого среднее остаётся в коридоре, <b>случаен</b> (нажмите «Новые броски»), а гарантии вероятностные (урок 15.13). Сходимость медленная — ошибка падает как 1/√n, как у 1/√n из шага 6: чтобы уменьшить ошибку в 10 раз, нужно в 100 раз больше бросков. Так же ведут себя оценки метрик на проверке и усреднение деревьев в бэггинге.';
    }
    w.pythonAction(() => 'from gbcourse.rng import Mulberry32\n\nrng = Mulberry32(' + st0.seed * 100 + ')\ns = 0\nfor n in range(1, 100001):\n    s += rng.randint(6) + 1\n    if n in (10, 100, 1000, 10000, 100000):\n        print(f"n = {n:6d}: среднее {s / n:.5f}, ошибка {abs(s / n - 3.5):.5f}")\n');
    draw();
  });

  /* ==============================================================================
   * 25. Пределы в компьютере: где округление ломает предел
   * ============================================================================== */
  const FT = {
    e: { label: '(1 + 1/n)ⁿ при огромных n', xl: 'n (лог.)', x: [1, 1e18], x0: 1e6, naive: (n) => Math.pow(1 + 1 / n, n), stable: (n) => Math.exp(n * Math.log1p(1 / n)), L: Math.E, Ltxt: 'e', yl: 'значение', py: 'naive = (1 + 1 / n)**n\nstable = math.exp(n * math.log1p(1 / n))', note: 'Пока n &lt; 10⁸ всё хорошо. Дальше 1 + 1/n округляется (в double ~16 значащих цифр), и ошибка возводится в огромную степень: при n = 10¹⁵ получается 3.035, а при n ≥ 10¹⁶ — ровно 1, ведь 1 + 10⁻¹⁶ == 1. Устойчивая формула exp(n·log1p(1/n)) не теряет 1/n.' },
    cos: { label: '(1 − cos x)/x² при x → 0', xl: 'x (лог.)', x: [1e-10, 1], x0: 1e-3, naive: (x) => (1 - Math.cos(x)) / (x * x), stable: (x) => (2 * Math.pow(Math.sin(x / 2), 2)) / (x * x), L: 0.5, Ltxt: '1/2', yl: 'значение', py: 'naive = (1 - math.cos(x)) / x**2\nstable = 2 * math.sin(x / 2)**2 / x**2', note: 'Предел 1/2, но при x &lt; 10⁻⁵ разность 1 − cos x теряет цифры (вычитание близких чисел), а при x ≤ 10⁻⁸ cos x == 1 и результат — 0. Формула 2·sin²(x/2)/x² без вычитания точна.' },
    expm: { label: '(eˣ − 1)/x при x → 0', xl: 'x (лог.)', x: [1e-17, 1], x0: 1e-9, naive: (x) => (Math.exp(x) - 1) / x, stable: (x) => Math.expm1(x) / x, L: 1, Ltxt: '1', yl: 'значение', py: 'naive = (math.exp(x) - 1) / x\nstable = math.expm1(x) / x', note: 'Предел 1, но eˣ − 1 при малых x — вычитание почти равных чисел: ошибка растёт как 10⁻¹⁶/x, а при x &lt; 10⁻¹⁶ ответ 0. Для этого в библиотеках есть специальная функция expm1.' },
    sig: { label: '1 − σ(F) при F → +∞', xl: 'F (лог.)', x: [1, 60], x0: 30, naive: (F) => 1 - 1 / (1 + Math.exp(-F)), stable: (F) => 1 / (1 + Math.exp(F)), L: 0, Ltxt: '0 (≈ e^(−F))', yl: 'значение (лог.)', ylog: true, py: 'naive = 1 - 1 / (1 + math.exp(-F))\nstable = 1 / (1 + math.exp(F))   # = σ(−F)', note: 'Математически 1 − σ(F) = σ(−F) ≈ e^(−F) &gt; 0. «В лоб» при F &gt; 36.7 получаем ровно 0 — и log-loss −ln(1 − p) для класса 0 обращается в бесконечность. Формула σ(−F) точна при любом F.' },
  };
  GBC.widget('float-traps', (el) => {
    const st0 = { fn: 'e', k: 0.5 };
    const w = ui.shell(el, { title: 'Когда компьютер ломает предел', sub: 'Синяя линия — вычисление «в лоб», оранжевый пунктир — устойчивая формула. Математически обе подходят к пределу; численно «в лоб» в какой-то момент разваливается.' });
    ui.select(w.controls, { label: 'Выражение', value: st0.fn, options: Object.entries(FT).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.slider(w.controls, { label: 'Положение точки', min: 0, max: 1, step: 0.001, value: st0.k, format: (v) => U.fmt(xOf(v), 3), onInput: (v) => ((st0.k = v), draw()) });
    function xOf(k) {
      const T = FT[st0.fn];
      return Math.pow(10, Math.log10(T.x[0]) + k * (Math.log10(T.x[1]) - Math.log10(T.x[0])));
    }
    const plot = new GBC.Plot(w.main, { height: 300, x: { type: 'log' }, y: { label: 'значение' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'аргумент' }, { key: 'n', label: '«в лоб»' }, { key: 's', label: 'устойчиво' }, { key: 'r', label: 'относит. ошибка «в лоб»' }]);
    function draw() {
      const T = FT[st0.fn];
      const x = xOf(st0.k);
      const xs = U.range(601).map((i) => Math.pow(10, Math.log10(T.x[0]) + (i / 600) * (Math.log10(T.x[1]) - Math.log10(T.x[0]))));
      const nv = xs.map(T.naive);
      const sv = xs.map(T.stable);
      const d0 = Math.ceil(Math.log10(T.x[0]));
      const d1 = Math.floor(Math.log10(T.x[1]));
      const stp = Math.max(1, Math.ceil((d1 - d0) / 6));
      const ticks = [];
      for (let d = d0; d <= d1; d += stp) ticks.push(Math.pow(10, d));
      plot.opts.x = { label: T.xl, type: 'log', domain: T.x, ticks };
      plot.opts.y = { label: T.yl, type: T.ylog ? 'log' : undefined };
      const clean = (arr) => arr.map((v) => (Number.isFinite(v) && (!T.ylog || v > 1e-300) ? v : NaN));
      plot.render([
        !T.ylog ? { type: 'hline', y: T.L, color: 'tree', dash: '2 3', width: 1, text: 'предел ' + T.Ltxt } : null,
        { type: 'line', x: xs, y: clean(nv), color: 'model', width: 2, label: '«в лоб»' },
        { type: 'line', x: xs, y: clean(sv), color: 'tree', width: 2, dash: '6 4', label: 'устойчиво' },
        { type: 'vline', x, color: 'ink2', dash: '3 3', width: 1 },
      ], T.ylog ? { y: [1e-27, 1] } : { y: [Math.min(...clean(nv).filter(Number.isFinite), T.L) - 0.15 * Math.abs(T.L || 1), Math.max(...clean(nv).filter(Number.isFinite), T.L) + 0.15 * Math.abs(T.L || 1)] });
      const a = T.naive(x);
      const b = T.stable(x);
      st.set('x', U.fmt(x, 3));
      st.set('n', U.fmt(a, 10));
      st.set('s', U.fmt(b, 10));
      st.set('r', U.fmt(Math.abs(a - b) / Math.abs(b), 2));
      note.innerHTML = T.note + ' <b>Вывод:</b> таблица значений подсказывает предел, но на компьютере «подходить ближе» можно лишь до предела точности чисел.';
    }
    w.pythonAction(() => {
      const T = FT[st0.fn];
      const v = st0.fn === 'e' ? 'n' : st0.fn === 'sig' ? 'F' : 'x';
      return 'import math\n\nfor ' + v + ' in ' + (st0.fn === 'e' ? '[1e6, 1e8, 1e12, 1e15, 1e16]' : st0.fn === 'sig' ? '[10, 30, 36, 37, 50]' : '[1e-2, 1e-5, 1e-8, 1e-12, 1e-17]') + ':\n    ' + T.py.replace(/\n/g, '\n    ') + '\n    print(f"' + v + ' = {' + v + ':g}: в лоб {naive:.12g}, устойчиво {stable:.12g}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Тренажёр: чему равен предел?
   * ============================================================================== */
  const CASES = [
    { q: 'lim (x² − 4)/(x − 2) при x → 2', f: (x) => (x * x - 4) / (x - 2), a: 2, dom: [0, 4], hole: 4, opts: ['4', '0', '2', 'не существует'], ans: 0, why: '(x² − 4)/(x − 2) = x + 2 при x ≠ 2 → 4.' },
    { q: 'lim (x² + 1) при x → 1', f: (x) => x * x + 1, a: 1, dom: [-1, 3], opts: ['1', '2', '0', '∞'], ans: 1, why: 'Функция непрерывна — просто подставляем: 1 + 1 = 2.' },
    { q: 'lim [x ≥ 0] при x → 0', f: (x) => (x >= 0 ? 1 : 0), a: 0, dom: [-2, 2], jump: true, opts: ['0', '1', '0.5', 'не существует'], ans: 3, why: 'Слева 0, справа 1 — односторонние пределы разные.' },
    { q: 'lim [x ≥ 0] при x → 0⁻ (слева)', f: (x) => (x >= 0 ? 1 : 0), a: 0, dom: [-2, 2], jump: true, opts: ['0', '1', '0.5', 'не существует'], ans: 0, why: 'Левый предел смотрит только на x < 0, где функция равна 0.' },
    { q: 'lim 1/x² при x → 0', f: (x) => 1 / (x * x), a: 0, dom: [-2, 2], cap: 30, opts: ['0', '1', '+∞ (конечного нет)', '−∞'], ans: 2, why: 'Значения растут без границ с обеих сторон.' },
    { q: 'lim 1/x при x → 0⁺ (справа)', f: (x) => 1 / x, a: 0, dom: [-2, 2], cap: 30, sym: true, opts: ['0', '+∞', '−∞', '1'], ans: 1, why: 'Справа 1/x положительна и неограниченно растёт.' },
    { q: 'lim sin x / x при x → 0', f: (x) => Math.sin(x) / x, a: 0, dom: [-8, 8], hole: 1, opts: ['0', '1', '∞', 'не существует'], ans: 1, why: 'Первый замечательный предел: sin x ≈ x около нуля.' },
    { q: 'lim sin(1/x) при x → 0', f: (x) => Math.sin(1 / x), a: 0, dom: [-0.5, 0.5], n: 6001, opts: ['0', '1', '−1', 'не существует'], ans: 3, why: 'Бесконечные колебания между −1 и 1: разные последовательности дают разные ответы.' },
    { q: 'lim x·sin(1/x) при x → 0', f: (x) => x * Math.sin(1 / x), a: 0, dom: [-0.5, 0.5], n: 6001, hole: 0, opts: ['0', '1', '−1', 'не существует'], ans: 0, why: '|x·sin(1/x)| ≤ |x| → 0: колебания зажаты.' },
    { q: 'lim (2x + 1)/(x + 3) при x → +∞', f: (x) => (2 * x + 1) / (x + 3), a: null, dom: [0, 60], opts: ['1/3', '2', '0', '∞'], ans: 1, why: 'Главные слагаемые 2x и x: 2x/x = 2.' },
    { q: 'lim e^(−x) при x → +∞', f: (x) => Math.exp(-x), a: null, dom: [0, 8], opts: ['1', '0', '+∞', 'не существует'], ans: 1, why: 'Экспонента с минусом быстро тает к нулю.' },
    { q: 'lim f(x) при x → 1, где f(x) = x + 1, но f(1) = 5', f: (x) => x + 1, a: 1, dom: [-1, 3], hole: 2, dot: 5, opts: ['5', '2', '3.5', 'не существует'], ans: 1, why: 'Значение в самой точке не влияет на предел: соседи подходят к 2.' },
    { q: 'lim (√x − 1)/(x − 1) при x → 1', f: (x) => (Math.sqrt(x) - 1) / (x - 1), a: 1, dom: [0.01, 3], hole: 0.5, opts: ['0', '1', '1/2', '2'], ans: 2, why: 'x − 1 = (√x − 1)(√x + 1), дробь = 1/(√x + 1) → 1/2.' },
    { q: 'lim (x³ − 1)/(x − 1) при x → 1', f: (x) => (x * x * x - 1) / (x - 1), a: 1, dom: [-1, 2], hole: 3, opts: ['0', '1', '3', 'не существует'], ans: 2, why: 'x³ − 1 = (x − 1)(x² + x + 1) → 3.' },
  ];
  const SCASES = [
    { q: 'aₙ = (3n + 1)/n', a: (n) => (3 * n + 1) / n, opts: ['1', '3', '4', 'нет предела'], ans: 1, why: '(3n + 1)/n = 3 + 1/n → 3.' },
    { q: 'aₙ = (−1)ⁿ/n²', a: (n) => (n % 2 ? -1 : 1) / (n * n), opts: ['0', '1', '−1', 'нет предела'], ans: 0, why: '|aₙ| = 1/n² → 0, знак не мешает.' },
    { q: 'aₙ = n/(n² + 1)', a: (n) => n / (n * n + 1), opts: ['1', '0', '1/2', '+∞'], ans: 1, why: 'Степень знаменателя больше: ≈ 1/n → 0.' },
    { q: 'aₙ = 1 + 0.5ⁿ', a: (n) => 1 + Math.pow(0.5, n), opts: ['1', '1.5', '0', '2'], ans: 0, why: '0.5ⁿ → 0 (геометрическая прогрессия, |q| < 1).' },
    { q: 'aₙ = (−1)ⁿ·(1 + 1/n)', a: (n) => (n % 2 ? -1 : 1) * (1 + 1 / n), opts: ['1', '0', '−1', 'нет предела'], ans: 3, why: 'Чётные члены → 1, нечётные → −1: два разных «хвоста».' },
    { q: 'aₙ = √(n + 1) − √n', a: (n) => Math.sqrt(n + 1) - Math.sqrt(n), opts: ['1', '+∞', '0', '1/2'], ans: 2, why: '= 1/(√(n + 1) + √n) → 0 (домножили на сопряжённое).' },
    { q: 'aₙ = n²/(2n² + 1)', a: (n) => (n * n) / (2 * n * n + 1), opts: ['1/2', '1', '0', '2'], ans: 0, why: 'Равные степени: отношение коэффициентов 1/2.' },
    { q: 'aₙ = cos(πn)', a: (n) => Math.cos(Math.PI * n), opts: ['1', '0', '−1', 'нет предела'], ans: 3, why: 'cos(πn) = (−1)ⁿ: −1, 1, −1, … — предела нет.' },
    { q: 'aₙ = (1 + 2/n)ⁿ', a: (n) => Math.pow(1 + 2 / n, n), opts: ['1', 'e', 'e² ≈ 7.389', '+∞'], ans: 2, why: 'Как (1 + 1/n)ⁿ → e, только «процент» вдвое больше: предел e² ≈ 7.389 (урок 15.4).' },
  ];
  GBC.widget('limit-game', (el) => {
    const st0 = { seed: 11, round: 0, right: 0, streak: 0, q: null, picked: null, mode: 'graph' };
    const w = ui.shell(el, { title: 'Тренажёр: чему равен предел?', sub: 'Режим «График» — по рисунку (кружок — выколотая точка, закрашенная — значение в точке). Режим «Последовательность» — по формуле и первым членам.' });
    ui.segmented(w.controls, { label: 'Режим', value: 'graph', options: [{ value: 'graph', label: 'График' }, { value: 'seq', label: 'Последовательность' }], onChange: (v) => {
      st0.mode = v;
      order = [];
      newQ();
    } });
    const qEl = H('div', { style: 'font-weight:650;padding:4px 0 10px' });
    w.controls.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;gap:8px' });
    w.controls.appendChild(optsBox);
    const next = ui.button(w.controls, { label: 'Следующий', icon: 'step', onClick: () => newQ() });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    let order = [];
    function pool() {
      return st0.mode === 'graph' ? CASES : SCASES;
    }
    function newQ() {
      const P = pool();
      if (!order.length) {
        const rng = new GBC.RNG(st0.seed++);
        order = U.range(P.length);
        for (let i = order.length - 1; i > 0; i--) {
          const j = rng.randint(i + 1);
          [order[i], order[j]] = [order[j], order[i]];
        }
      }
      st0.q = P[order.pop()];
      st0.picked = null;
      st0.round++;
      qEl.textContent = st0.mode === 'graph' ? st0.q.q : 'К чему стремится ' + st0.q.q + '?';
      optsBox.textContent = '';
      st0.q.opts.forEach((o, i) => ui.button(optsBox, { label: o, kind: 'primary', onClick: () => pick(i) }));
      draw();
    }
    function pick(i) {
      if (st0.picked !== null) return;
      st0.picked = i;
      if (i === st0.q.ans) (st0.right++, st0.streak++);
      else st0.streak = 0;
      [...optsBox.querySelectorAll('button')].forEach((b) => (b.disabled = true));
      draw();
    }
    function draw() {
      const C = st0.q;
      if (st0.mode === 'graph') {
        plot.opts.x.label = 'x';
        plot.opts.y.label = 'f(x)';
        const cv = curve(C.f, C.dom[0], C.dom[1], C.n || 1201, { skip: C.a, jump: C.jump ? 0.5 : undefined, cap: C.cap ? C.cap * 3 : undefined });
        const layers = [{ type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.2, hover: false }];
        if (C.hole !== undefined) layers.push({ type: 'points', x: [C.a], y: [C.hole], color: 'model', r: 5, hollow: true });
        if (C.dot !== undefined) layers.push({ type: 'points', x: [C.a], y: [C.dot], color: 'model', r: 5 });
        if (C.a !== null) layers.push({ type: 'vline', x: C.a, color: 'ink2', dash: '3 3', width: 1 });
        plot.render(layers, C.cap ? { x: C.dom, y: C.sym ? [-C.cap, C.cap] : [0, C.cap] } : { x: C.dom, y: 'auto' });
      } else {
        plot.opts.x.label = 'номер n';
        plot.opts.y.label = 'aₙ';
        const ns = U.range(40, 1);
        const ys = ns.map(C.a);
        layers0(ns, ys);
      }
      st.set('r', String(st0.round));
      st.set('ok', st0.right + ' из ' + (st0.round - (st0.picked === null ? 1 : 0)));
      st.set('s', String(st0.streak));
      const hint = st0.mode === 'graph' ? 'Помните: значение в самой точке на предел не влияет — важно, к чему подходят соседи.' : 'Первые члены: ' + U.range(6, 1).map((n) => U.fmt(C.a(n), 4)).join(', ') + ', …, a₄₀ = ' + U.fmt(C.a(40), 5) + '. Ищите главное слагаемое или «хвосты».';
      note.innerHTML = st0.picked === null ? hint : (st0.picked === C.ans ? '<b>Верно!</b> ' : '<b>Нет</b>, ответ: ' + C.opts[C.ans] + '. ') + C.why;
      next.textContent = '';
      next.append(ui.icon('step'), st0.picked === null ? 'Пропустить' : 'Следующий');
    }
    function layers0(ns, ys) {
      const [lo, hi] = U.extent(ys);
      const pad = Math.max((hi - lo) * 0.1, 0.1);
      plot.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'points', x: ns, y: ys, color: 'model', r: 3.5, tooltip: (i) => [['n', String(ns[i])], ['aₙ', U.fmt(ys[i], 6)]] },
      ], { x: [0, 41], y: [lo - pad, hi + pad] });
    }
    newQ();
  });
})();
