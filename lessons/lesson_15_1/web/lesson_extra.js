/* Урок 15.1, часть 2: свойства графика и действия с функциями.
 * Виджеты: нули и знаки, рост/убывание и экстремумы, уравнения по графику, симметрия/период/
 * ограниченность/асимптоты, прямая, парабола, «подгони график», кусочные функции, сумма функций
 * (и бустинг как сумма ступенек), обратная функция, функция двух переменных, потери-парабола,
 * масштаб осей. Помощники — из lesson.js (GBC.lesson151). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const { curve, texInto, pt, sgnTerm, sigmoid, nanIf, ZOO } = GBC.lesson151;
  const I = Infinity;

  /** Корни f(x) = c на отрезке: смена знака f − c на сетке + уточнение делением пополам. */
  function solve(f, c, x0, x1, n = 4001) {
    const xs = U.linspace(x0, x1, n);
    const out = [];
    let prev = f(xs[0]) - c;
    if (prev === 0) out.push(xs[0]);
    for (let i = 1; i < n; i++) {
      const cur = f(xs[i]) - c;
      if (!Number.isFinite(cur) || !Number.isFinite(prev)) {
        prev = cur;
        continue;
      }
      if (cur === 0) out.push(xs[i]);
      else if (prev !== 0 && prev * cur < 0 && Math.abs(cur - prev) < 5) {
        let a = xs[i - 1];
        let b = xs[i];
        for (let k = 0; k < 60; k++) {
          const m = (a + b) / 2;
          if ((f(a) - c) * (f(m) - c) <= 0) b = m;
          else a = m;
        }
        out.push((a + b) / 2);
      }
      prev = cur;
    }
    return out;
  }
  /** Участки, где cond(x) истинно: [[a, b], …] по сетке. */
  function runs(cond, x0, x1, n = 2001) {
    const xs = U.linspace(x0, x1, n);
    const out = [];
    let start = null;
    xs.forEach((x, i) => {
      const ok = cond(x);
      if (ok && start === null) start = x;
      if ((!ok || i === n - 1) && start !== null) {
        out.push([start, ok ? x : xs[i - 1]]);
        start = null;
      }
    });
    return out;
  }
  const iv = (a, b, lo, hi, op) => {
    const L = a <= lo + 1e-9 ? '(−∞' : (op ? '[' : '(') + U.fmt(a, 2);
    const R = b >= hi - 1e-9 ? '+∞)' : U.fmt(b, 2) + (op ? ']' : ')');
    return L + '; ' + R;
  };

  /* ==============================================================================
   * 1. Нули и знаки функции
   * ============================================================================== */
  const ZS = {
    cubic: { label: '(x + 2)(x − 1)(x − 3)/4', f: (x) => ((x + 2) * (x - 1) * (x - 3)) / 4, vx: [-3.5, 4.5], vy: [-5, 5], Z: [-2, 1, 3], py: '(x + 2) * (x - 1) * (x - 3) / 4' },
    lin: { label: '2x − 3', f: (x) => 2 * x - 3, vx: [-3, 5], vy: [-7, 7], Z: [1.5], py: '2 * x - 3' },
    sq4: { label: 'x² − 4', f: (x) => x * x - 4, vx: [-4, 4], vy: [-5, 8], Z: [-2, 2], py: 'x**2 - 4' },
    touch: { label: '(x − 1)²', f: (x) => (x - 1) ** 2, vx: [-2, 4], vy: [-2, 6], Z: [1], py: '(x - 1)**2' },
    sq1: { label: 'x² + 1', f: (x) => x * x + 1, vx: [-3, 3], vy: [-2, 7], Z: [], py: 'x**2 + 1' },
    sin: { label: 'sin x', f: Math.sin, vx: [-7, 7], vy: [-1.6, 1.6], Z: [-2 * Math.PI, -Math.PI, 0, Math.PI, 2 * Math.PI], py: 'np.sin(x)' },
  };
  GBC.widget('zeros-signs', (el) => {
    const s = { fn: 'cubic', x: 2 };
    const w = ui.shell(el, { title: 'Нули и знаки функции', sub: 'Нули — где график пересекает или касается оси x (f(x) = 0). Между нулями функция сохраняет знак: красная заливка — f(x) > 0, синяя — f(x) < 0.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(ZS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.x = U.clamp(s.x, ZS[v].vx[0], ZS[v].vx[1])), draw()) });
    const signs = ui.toggle(w.controls, { label: 'Закрасить знаки', checked: true, onChange: () => draw() });
    const chips = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;padding:4px 0 8px' });
    w.main.appendChild(chips);
    const plot = new GBC.Plot(w.main, { height: 310, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'z', label: 'нули' }, { key: 'y0', label: 'пересечение с осью y: f(0)' }, { key: 'v', label: 'знак в точке' }]);
    function draw() {
      const F = ZS[s.fn];
      const c = curve(F.f, F.vx[0], F.vx[1], 1201);
      const y = F.f(s.x);
      const Z = F.Z.filter((z) => z >= F.vx[0] && z <= F.vx[1]);
      const cuts = [F.vx[0], ...Z, F.vx[1]];
      chips.textContent = '';
      for (let i = 0; i + 1 < cuts.length; i++) {
        const m = (cuts[i] + cuts[i + 1]) / 2;
        const sg = F.f(m) > 0;
        chips.appendChild(H('span', { class: 'badge', style: 'background:color-mix(in srgb, var(' + (sg ? '--div-pos' : '--div-neg') + ') 18%, var(--surface));color:var(--ink);border:1px solid var(' + (sg ? '--div-pos' : '--div-neg') + ')' }, iv(cuts[i], cuts[i + 1], F.vx[0], F.vx[1], false).replace('(−∞', '(' + U.fmt(F.vx[0], 2)).replace('+∞)', U.fmt(F.vx[1], 2) + ')') + ':  ' + (sg ? '+' : '−')));
      }
      plot.render([
        signs.checked ? { type: 'area', x: c.x, y0: c.x.map(() => 0), y1: c.y.map((v) => Math.max(0, v)), color: 'pos', opacity: 0.22 } : null,
        signs.checked ? { type: 'area', x: c.x, y0: c.x.map(() => 0), y1: c.y.map((v) => Math.min(0, v)), color: 'neg', opacity: 0.22 } : null,
        { type: 'hline', y: 0, color: 'ink2', width: 1.2 },
        { type: 'vline', x: 0, color: 'ink2', width: 1 },
        { type: 'line', x: c.x, y: c.y, color: 'model', width: 2.4, hover: false },
        { type: 'points', x: Z, y: Z.map(() => 0), color: 'ink', r: 5, hollow: true, label: 'нули', tooltip: (i) => [['нуль', 'x = ' + U.fmt(Z[i], 3)]] },
        F.vx[0] <= 0 && F.vx[1] >= 0 ? { type: 'points', x: [0], y: [F.f(0)], color: 'aqua', r: 5, shape: 'square', label: 'f(0)', tooltip: () => [['f(0)', U.fmt(F.f(0), 3)]] } : null,
        { type: 'vline', x: s.x, color: 'tree', width: 1.4, dash: '4 3', draggable: true, onDrag: (v) => ((s.x = Math.round(v * 20) / 20), draw()) },
        { type: 'points', x: [s.x], y: [y], color: 'tree', r: 6, tooltip: () => [['x', U.fmt(s.x, 2)], ['f(x)', U.fmt(y, 3)]] },
      ], { x: F.vx, y: F.vy });
      st.set('z', Z.length ? Z.map((z) => U.fmt(z, 3)).join('; ') : 'нет');
      st.set('y0', U.fmt(F.f(0), 3));
      st.set('v', Math.abs(y) < 1e-9 ? '0' : y > 0 ? '+' : '−');
      const extra = {
        cubic: 'Три нуля делят прямую на четыре участка, знаки чередуются: − + − +. Если в бустинге это остатки r = y − F, то «+» — модель занизила прогноз, «−» — завысила.',
        lin: 'У прямой y = kx + b ровно один нуль: x = −b/k = 1.5. Слева от него знак один, справа — другой.',
        sq4: 'x² − 4 = (x − 2)(x + 2): нули ±2. Между ними парабола ниже оси.',
        touch: '<b>Касание:</b> в x = 1 график лишь касается оси — нуль есть, а знак не меняется (+ слева и + справа). Поэтому «знаки чередуются» верно не всегда.',
        sq1: 'x² + 1 ≥ 1 > 0 — нулей нет, функция положительна всюду. Не каждое уравнение f(x) = 0 имеет решение.',
        sin: 'У синуса нулей бесконечно много: x = kπ (… −π, 0, π, 2π …). Знаки чередуются через каждые π ≈ 3.14.',
      }[s.fn];
      note.innerHTML = 'Чтобы найти нули, решают уравнение f(x) = 0. Пересечение с осью y — это просто f(0). ' + extra;
    }
    w.pythonAction(() => 'import numpy as np\n\nf = lambda x: ' + ZS[s.fn].py + '\nx = np.linspace(' + ZS[s.fn].vx[0] + ', ' + ZS[s.fn].vx[1] + ', 100001)\ny = f(x)\nchange = np.where(np.sign(y[:-1]) * np.sign(y[1:]) < 0)[0]   # смена знака между соседями\nprint("нули (по смене знака):", x[change].round(3))\nprint("f(0) =", f(0))\n');
    draw();
  });

  /* ==============================================================================
   * 2. Рост, убывание и экстремумы: локальные и глобальные, max и argmax
   * ============================================================================== */
  const ME = {
    mountain: { label: 'горный маршрут −0.05x⁴ + 0.9x² + 0.3x + 2', f: (x) => -0.05 * x ** 4 + 0.9 * x * x + 0.3 * x + 2, vx: [-4.5, 4.5], py: '-0.05 * x**4 + 0.9 * x**2 + 0.3 * x + 2' },
    cubic: { label: 'x³ − 3x', f: (x) => x ** 3 - 3 * x, vx: [-2.5, 2.5], py: 'x**3 - 3 * x' },
    cube: { label: 'x³ (полочка)', f: (x) => x ** 3, vx: [-2, 2], py: 'x**3' },
    abs: { label: '|x| (излом)', f: Math.abs, vx: [-3, 3], py: 'np.abs(x)' },
    sin: { label: 'sin x', f: Math.sin, vx: [-6.5, 6.5], py: 'np.sin(x)' },
  };
  GBC.widget('monotone-extrema', (el) => {
    const s = { fn: 'mountain', x1: -1, x2: 1.5 };
    const w = ui.shell(el, { title: 'Рост, убывание и экстремумы', sub: 'Красные полосы — участки роста, синие — убывания. Треугольники — локальные максимумы (▲) и минимумы (▼). Тяните две оранжевые точки x₁ < x₂ и сравнивайте f(x₁) и f(x₂).' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(ME).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.x1 = ME[v].vx[0] * 0.3), (s.x2 = ME[v].vx[1] * 0.4), draw()) });
    const bands = ui.toggle(w.controls, { label: 'Участки роста и убывания', checked: true, onChange: () => draw() });
    const marks = ui.toggle(w.controls, { label: 'Экстремумы', checked: true, onChange: () => draw() });
    const plot = new GBC.Plot(w.main, { height: 330, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'max', label: 'max f (глобальный)' }, { key: 'amax', label: 'argmax — где' }, { key: 'min', label: 'min f' }, { key: 'amin', label: 'argmin — где' }]);
    function analyse(F) {
      const xs = U.linspace(F.vx[0], F.vx[1], 3001);
      const ys = xs.map(F.f);
      const ext = [];
      for (let i = 1; i < xs.length - 1; i++) {
        const a = ys[i] - ys[i - 1];
        const b = ys[i + 1] - ys[i];
        if (a > 0 && b < 0) ext.push({ x: xs[i], y: ys[i], kind: 'max' });
        if (a < 0 && b > 0) ext.push({ x: xs[i], y: ys[i], kind: 'min' });
      }
      const cuts = [F.vx[0], ...ext.map((e) => e.x), F.vx[1]];
      const parts = [];
      for (let i = 0; i + 1 < cuts.length; i++) parts.push({ a: cuts[i], b: cuts[i + 1], up: F.f((cuts[i] + cuts[i + 1]) / 2 + 1e-6) > F.f((cuts[i] + cuts[i + 1]) / 2 - 1e-6) });
      const im = U.argmax(ys);
      const imn = U.argmax(ys.map((v) => -v));
      return { xs, ys, ext, parts, gmax: { x: xs[im], y: ys[im] }, gmin: { x: xs[imn], y: ys[imn] } };
    }
    function draw() {
      const F = ME[s.fn];
      const A = analyse(F);
      if (s.x1 > s.x2) [s.x1, s.x2] = [s.x2, s.x1];
      const y1 = F.f(s.x1);
      const y2 = F.f(s.x2);
      const lo = Math.min(...A.ys);
      const hi = Math.max(...A.ys);
      const pad = 0.12 * (hi - lo);
      const layers = [];
      if (bands.checked) A.parts.forEach((p) => layers.push({ type: 'vband', x0: p.a, x1: p.b, color: p.up ? 'pos' : 'neg', opacity: 0.08 }));
      layers.push({ type: 'line', x: A.xs, y: A.ys, color: 'model', width: 2.4, hover: false });
      if (marks.checked) {
        layers.push({ type: 'text', items: A.ext.map((e) => ({ x: e.x, y: e.y, dy: e.kind === 'max' ? -10 : 20, anchor: 'middle', text: (e.kind === 'max' ? '▲ лок. max' : '▼ лок. min') })) });
        layers.push({ type: 'points', x: [A.gmax.x, A.gmin.x], y: [A.gmax.y, A.gmin.y], color: 'ink', r: 6, hollow: true, label: 'глобальные max и min', tooltip: (i) => [[i ? 'глобальный min' : 'глобальный max', U.fmt(i ? A.gmin.y : A.gmax.y, 3)], ['в точке x', U.fmt(i ? A.gmin.x : A.gmax.x, 3)]] });
      }
      layers.push({ type: 'segments', x1: [s.x1, s.x2], y1: [y1, y2], x2: [F.vx[0], F.vx[0]], y2: [y1, y2], color: 'tree', width: 1, dash: '3 3', opacity: 0.9 });
      layers.push({ type: 'points', x: [s.x1, s.x2], y: [y1, y2], color: 'tree', r: 7, draggable: true, label: 'x₁ и x₂', onDrag: (i, x) => {
        const v = Math.round(U.clamp(x, F.vx[0], F.vx[1]) * 20) / 20;
        if (i === 0) s.x1 = v;
        else s.x2 = v;
        draw();
      }, tooltip: (i) => [[i ? 'x₂' : 'x₁', U.fmt(i ? s.x2 : s.x1, 2)], ['f', U.fmt(i ? y2 : y1, 3)]] });
      layers.push({ type: 'text', items: [{ x: s.x1, y: y1, dx: -6, dy: -10, anchor: 'end', text: 'x₁' }, { x: s.x2, y: y2, dx: 6, dy: -10, text: 'x₂' }] });
      plot.render(layers, { x: F.vx, y: [lo - pad, hi + pad] });
      st.set('max', U.fmt(A.gmax.y, 3));
      st.set('amax', 'x = ' + U.fmt(A.gmax.x, 2));
      st.set('min', U.fmt(A.gmin.y, 3));
      st.set('amin', 'x = ' + U.fmt(A.gmin.x, 2));
      const same = A.parts.find((p) => s.x1 >= p.a - 1e-9 && s.x2 <= p.b + 1e-9);
      const cmp = Math.abs(y1 - y2) < 1e-9 ? 'f(x₁) = f(x₂)' : y1 < y2 ? 'f(x₁) &lt; f(x₂)' : 'f(x₁) &gt; f(x₂)';
      let msg = 'x₁ = ' + U.fmt(s.x1, 2) + ' &lt; x₂ = ' + U.fmt(s.x2, 2) + ', и ' + cmp + '. ';
      msg += same ? 'Обе точки на участке ' + (same.up ? '<b>роста</b>: так будет для <i>любой</i> пары на нём — это и есть определение возрастания.' : '<b>убывания</b>: для любой пары x₁ &lt; x₂ на нём f(x₁) &gt; f(x₂).') : 'Точки на разных участках: между ними функция и росла, и убывала, поэтому одно сравнение ничего не говорит о монотонности.';
      msg += ' ' + {
        mountain: 'Два локальных максимума: левый (x ≈ −2.91, f ≈ 5.16) — лишь «вершина холма», правый (x ≈ 3.08, f ≈ 6.96) — глобальный. А глобальный минимум на отрезке — на краю x = −4.5, где график вовсе не горизонтален.',
        cubic: 'Локальный максимум в x = −1 (f = 2) и минимум в x = 1 (f = −2) — но не глобальные: на краях отрезка значения больше и меньше.',
        cube: 'В нуле график горизонтален, но экстремума нет: функция растёт и до, и после. «Горизонтально» — ещё не значит «экстремум» (урок 15.7).',
        abs: 'Минимум в нуле — в изломе. Здесь график не горизонтален: у него вообще нет одного наклона (урок 15.5).',
        sin: 'Максимумы повторяются через 2π. Все локальные максимумы равны 1 — каждый из них ещё и глобальный.',
      }[s.fn];
      note.innerHTML = msg;
    }
    w.pythonAction(() => 'import numpy as np\n\nf = lambda x: ' + ME[s.fn].py + '\nx = np.linspace(' + ME[s.fn].vx[0] + ', ' + ME[s.fn].vx[1] + ', 100001)\ny = f(x)\nprint("max f =", y.max().round(4), " argmax =", x[np.argmax(y)].round(3))   # значение и место — разные вещи\nprint("min f =", y.min().round(4), " argmin =", x[np.argmin(y)].round(3))\nd = np.diff(y)\nturns = np.where(np.sign(d[:-1]) != np.sign(d[1:]))[0] + 1\nprint("локальные экстремумы в x ≈", x[turns].round(3))\n');
    draw();
  });

  /* ==============================================================================
   * 3. Уравнения и неравенства по графику: f(x) = c, f(x) > c
   * ============================================================================== */
  const LV = {
    sq: { label: 'x²', f: (x) => x * x, vx: [-3, 3], vy: [-1, 9], c: 4, py: 'x**2' },
    sin: { label: 'sin x', f: Math.sin, vx: [-7, 7], vy: [-1.5, 1.5], c: 0.5, py: 'np.sin(x)' },
    cubic: { label: 'x³ − 3x', f: (x) => x ** 3 - 3 * x, vx: [-2.5, 2.5], vy: [-5, 5], c: 1, py: 'x**3 - 3 * x' },
    sigm: { label: 'вероятность σ(F)', f: sigmoid, vx: [-6, 6], vy: [-0.1, 1.1], c: 0.5, py: '1 / (1 + np.exp(-x))' },
    temp: { label: 'температура T(t)', f: (h) => 14 - 6 * Math.cos((2 * Math.PI * (h - 3)) / 24), vx: [0, 24], vy: [6, 22], c: 17, py: '14 - 6 * np.cos(2 * np.pi * (x - 3) / 24)' },
  };
  GBC.widget('level-line', (el) => {
    const s = { fn: 'temp', op: 'gt', c: 17 };
    const w = ui.shell(el, { title: 'Уравнения и неравенства по графику', sub: 'Тяните горизонтальную линию y = c. Решения уравнения f(x) = c — точки пересечения. Решения неравенства f(x) > c — участки оси x, где график выше линии.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(LV).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.c = LV[v].c), cs.el.remove(), mk(), draw()) });
    ui.segmented(w.controls, { label: 'Что решаем', value: s.op, options: [{ value: 'eq', label: 'f(x) = c' }, { value: 'gt', label: 'f(x) > c' }, { value: 'lt', label: 'f(x) < c' }], onChange: (v) => ((s.op = v), draw()) });
    let cs;
    const box = H('div');
    w.controls.appendChild(box);
    function mk() {
      const V = LV[s.fn];
      cs = ui.slider(box, { label: 'уровень c', min: V.vy[0], max: V.vy[1], step: (V.vy[1] - V.vy[0]) / 200, value: s.c, onInput: (v) => ((s.c = v), draw()) });
    }
    mk();
    const plot = new GBC.Plot(w.main, { height: 310, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'решений f(x) = c' }, { key: 'set', label: 'ответ' }]);
    function draw() {
      const V = LV[s.fn];
      cs.set(s.c);
      const c = curve(V.f, V.vx[0], V.vx[1], 1201);
      const roots = solve(V.f, s.c, V.vx[0], V.vx[1]);
      const reg = s.op === 'eq' ? [] : runs((x) => (s.op === 'gt' ? V.f(x) > s.c : V.f(x) < s.c), V.vx[0], V.vx[1]);
      plot.render([
        ...reg.map((r) => ({ type: 'vband', x0: r[0], x1: r[1], color: 'tree', opacity: 0.13 })),
        { type: 'segments', x1: reg.map((r) => r[0]), x2: reg.map((r) => r[1]), y1: reg.map(() => V.vy[0]), y2: reg.map(() => V.vy[0]), color: 'tree', width: 6, opacity: 0.8 },
        { type: 'line', x: c.x, y: c.y, color: 'model', width: 2.4, hover: false },
        { type: 'hline', y: s.c, color: 'tree', width: 1.8, draggable: true, text: 'y = ' + U.fmt(s.c, 3), onDrag: (v) => ((s.c = v), draw()) },
        { type: 'points', x: roots, y: roots.map(() => s.c), color: 'tree', r: 6, tooltip: (i) => [['x', U.fmt(roots[i], 3)], ['f(x)', U.fmt(s.c, 3)]] },
        { type: 'segments', x1: roots, x2: roots, y1: roots.map(() => s.c), y2: roots.map(() => V.vy[0]), color: 'tree', width: 1, dash: '3 3', opacity: 1 },
      ], { x: V.vx, y: V.vy });
      const fx = (v) => U.fmt(v, 2);
      const ans = s.op === 'eq' ? (roots.length ? 'x ≈ ' + roots.map(fx).join('; ') : 'решений нет') : reg.length ? reg.map((r) => (r[0] <= V.vx[0] + 1e-9 ? '[' + fx(V.vx[0]) : '(' + fx(r[0])) + '; ' + (r[1] >= V.vx[1] - 1e-9 ? fx(V.vx[1]) + ']' : fx(r[1]) + ')')).join(' ∪ ') : 'решений нет';
      st.set('n', String(roots.length));
      st.set('set', ans);
      const hint = {
        temp: 'Когда теплее 17 °C? Решаем T(t) > 17: с 11:00 до 19:00. Уравнение T(t) = 17 — два момента, 11:00 и 19:00.',
        sigm: 'Классификатор говорит «класс 1», когда вероятность σ(F) > 0.5. Линия y = 0.5 пересекает сигмоиду в F = 0, поэтому σ(F) > 0.5 ⇔ F > 0: порог по вероятности — это порог по прогнозу.',
        sq: 'x² = c: при c > 0 два решения ±√c, при c = 0 одно, при c &lt; 0 ни одного — линия проходит ниже параболы.',
        sin: 'sin x = c при |c| &lt; 1 имеет бесконечно много решений (на этом отрезке — несколько): волна пересекает линию снова и снова.',
        cubic: 'Число решений x³ − 3x = c меняется: 3 при |c| &lt; 2, 2 при |c| = 2 (касание вершины), 1 при |c| > 2.',
      }[s.fn];
      note.innerHTML = 'Графический способ: провели линию y = c и посмотрели, где график её пересекает (уравнение) или лежит выше/ниже (неравенство). ' + hint;
    }
    w.pythonAction(() => 'import numpy as np\n\nf = lambda x: ' + LV[s.fn].py + '\nc = ' + U.pyNum(Number(s.c.toFixed(4))) + '\nx = np.linspace(' + LV[s.fn].vx[0] + ', ' + LV[s.fn].vx[1] + ', 100001)\nmask = f(x) > c\nedges = np.flatnonzero(np.diff(mask.astype(int)))\nprint("f(x) = c при x ≈", x[edges].round(3))\nprint("доля отрезка, где f(x) > c:", mask.mean().round(3))\n');
    draw();
  });

  /* ==============================================================================
   * 4. Свойства формы: чётность, периодичность, ограниченность, асимптоты
   * ============================================================================== */
  const PROPS = {
    parity: {
      label: 'чётность',
      fns: {
        sq: { label: 'x²', f: (x) => x * x }, cube: { label: 'x³', f: (x) => x ** 3 }, abs: { label: '|x|', f: Math.abs }, cos: { label: 'cos x', f: Math.cos },
        sin: { label: 'sin x', f: Math.sin }, cub3: { label: 'x³ − 3x', f: (x) => x ** 3 - 3 * x }, sqx: { label: 'x² + x', f: (x) => x * x + x },
        exp: { label: 'eˣ', f: Math.exp }, sig: { label: 'σ(x) − ½', f: (x) => sigmoid(x) - 0.5 },
      },
    },
    period: {
      label: 'периодичность',
      fns: {
        sin: { label: 'sin x', f: Math.sin, T: 2 * Math.PI, Tt: '2π ≈ 6.28' }, sin2: { label: 'sin 2x', f: (x) => Math.sin(2 * x), T: Math.PI, Tt: 'π ≈ 3.14' },
        saw: { label: '«пила» x − ⌊x⌋', f: (x) => x - Math.floor(x), T: 1, Tt: '1' }, asin: { label: '|sin x|', f: (x) => Math.abs(Math.sin(x)), T: Math.PI, Tt: 'π ≈ 3.14' },
        mix: { label: 'sin x + sin 2x', f: (x) => Math.sin(x) + Math.sin(2 * x), T: 2 * Math.PI, Tt: '2π ≈ 6.28' }, sq: { label: 'x² (не периодична)', f: (x) => (x * x) / 8, T: null },
      },
    },
    bound: {
      label: 'ограниченность',
      fns: {
        sig: { label: 'σ(x)', f: sigmoid, lo: 0, hi: 1, t: 'ограничена: 0 &lt; σ(x) &lt; 1, но ни 0, ни 1 не достигаются' },
        sin: { label: 'sin x', f: Math.sin, lo: -1, hi: 1, t: 'ограничена: −1 ≤ sin x ≤ 1, обе границы достигаются' },
        bump: { label: '1/(1 + x²)', f: (x) => 1 / (1 + x * x), lo: 0, hi: 1, t: 'ограничена: 0 &lt; f ≤ 1; максимум 1 в нуле достигается, а 0 — нет' },
        sq: { label: 'x²', f: (x) => x * x, lo: 0, hi: null, t: 'ограничена только снизу (x² ≥ 0), сверху — нет' },
        exp: { label: 'eˣ', f: Math.exp, lo: 0, hi: null, t: 'ограничена снизу нулём, сверху — нет' },
        cube: { label: 'x³', f: (x) => x ** 3, lo: null, hi: null, t: 'не ограничена ни сверху, ни снизу' },
      },
    },
    asym: {
      label: 'асимптоты',
      fns: {
        recip: { label: '1/x', f: (x) => nanIf(x === 0, 1 / x), V: [0], Hz: [0], t: 'вертикальная x = 0 и горизонтальная y = 0' },
        shift: { label: '1/(x − 2) + 1', f: (x) => nanIf(x === 2, 1 / (x - 2) + 1), V: [2], Hz: [1], t: 'вертикальная x = 2, горизонтальная y = 1' },
        frac: { label: '(2x + 1)/(x − 1)', f: (x) => nanIf(x === 1, (2 * x + 1) / (x - 1)), V: [1], Hz: [2], t: 'вертикальная x = 1, горизонтальная y = 2: при больших x дробь ≈ 2x/x = 2' },
        sig: { label: 'σ(x)', f: sigmoid, V: [], Hz: [0, 1], t: 'две горизонтальные: y = 0 слева и y = 1 справа' },
        exp: { label: 'eˣ', f: Math.exp, V: [], Hz: [0], t: 'горизонтальная y = 0 только слева (при x → −∞)' },
        ln: { label: 'ln x', f: (x) => nanIf(x <= 0, Math.log(x)), V: [0], Hz: [], t: 'вертикальная x = 0; горизонтальной нет: ln x растёт бесконечно, хоть и медленно' },
      },
    },
  };
  GBC.widget('shape-properties', (el) => {
    const s = { mode: 'parity', fn: 'sq', x: 1.5, T: 1, R: 6 };
    const w = ui.shell(el, { title: 'Свойства формы графика', sub: 'Четыре вопроса, которые задают любому графику: симметричен ли он? повторяется ли? ограничен ли? к чему приближается вдали?' });
    ui.segmented(w.controls, { label: 'Свойство', value: s.mode, options: Object.entries(PROPS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.mode = v), (s.fn = Object.keys(PROPS[v].fns)[0]), build(), draw()) });
    const dyn = H('div');
    w.controls.appendChild(dyn);
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '' }, { key: 'b', label: '' }]);
    const stK = st.el.querySelectorAll('.k');
    const setK = (a, b) => ((stK[0].textContent = a), (stK[1].textContent = b));
    let tsl = null;
    function build() {
      dyn.textContent = '';
      const P = PROPS[s.mode];
      ui.select(dyn, { label: 'Функция', value: s.fn, options: Object.entries(P.fns).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), draw()) });
      if (s.mode === 'parity') ui.slider(dyn, { label: 'точка x', min: 0, max: 3.5, step: 0.05, value: s.x, onInput: (v) => ((s.x = v), draw()) });
      if (s.mode === 'period') {
        tsl = ui.slider(dyn, { label: 'сдвиг T', min: 0, max: 7, step: 0.01, value: s.T, onInput: (v) => ((s.T = v), draw()) });
        ui.button(dyn, { label: 'Найти период', onClick: () => {
          const F = PROPS.period.fns[s.fn];
          if (F.T) (s.T = Math.round(F.T * 100) / 100), tsl.set(s.T), draw();
        } });
      }
      if (s.mode === 'bound' || s.mode === 'asym') ui.slider(dyn, { label: 'обзор: x от −R до R', min: 4, max: 60, step: 1, value: s.R, onInput: (v) => ((s.R = v), draw()) });
    }
    build();
    function draw() {
      const F = PROPS[s.mode].fns[s.fn];
      const L = [];
      let msg = '';
      if (s.mode === 'parity') {
        const c0 = curve(F.f, -4, 4, 801, { cap: 40 });
        const c1 = curve((x) => F.f(-x), -4, 4, 801, { cap: 40 });
        const c2 = curve((x) => -F.f(-x), -4, 4, 801, { cap: 40 });
        const xs = U.linspace(0.1, 3, 30);
        const even = xs.every((x) => Math.abs(F.f(x) - F.f(-x)) < 1e-9);
        const odd = xs.every((x) => Math.abs(F.f(x) + F.f(-x)) < 1e-9);
        L.push({ type: 'hline', y: 0, color: 'ink2', width: 1 }, { type: 'vline', x: 0, color: 'ink2', width: 1 });
        L.push({ type: 'line', x: c0.x, y: c0.y, color: 'model', width: 2.4, label: 'f(x)', hover: false });
        L.push({ type: 'line', x: c1.x, y: c1.y, color: 'tree', width: 2, dash: '6 4', label: 'f(−x): отражение в оси y', hover: false });
        L.push({ type: 'line', x: c2.x, y: c2.y, color: 'aqua', width: 2, dash: '2 4', label: '−f(−x): отражение в начале', hover: false });
        const a = F.f(s.x);
        const b = F.f(-s.x);
        L.push({ type: 'segments', x1: [s.x], y1: [a], x2: [-s.x], y2: [b], color: 'ink2', width: 1, dash: '3 3', opacity: 1 });
        L.push({ type: 'points', x: [s.x, -s.x], y: [a, b], color: (i) => (i ? 'tree' : 'model'), r: 6, tooltip: (i) => [[i ? 'f(−x)' : 'f(x)', U.fmt(i ? b : a, 3)]] });
        plot.render(L, { x: [-4, 4], y: [-4, 4] });
        setK('f(' + U.fmt(s.x, 2) + ')  и  f(−' + U.fmt(s.x, 2) + ')', 'вывод');
        st.set('a', U.fmt(a, 3) + '  и  ' + U.fmt(b, 3));
        st.set('b', even ? 'чётная' : odd ? 'нечётная' : 'ни та, ни другая');
        msg = even ? '<b>Чётная:</b> f(−x) = f(x) — график симметричен относительно оси y (оранжевый пунктир совпал с синей линией). Пример из курса: квадратичные потери ½r² и |r| не различают знак ошибки.'
          : odd ? '<b>Нечётная:</b> f(−x) = −f(x) — график симметричен относительно начала координат (совпал бирюзовый пунктир). Сигмоида, сдвинутая на ½, — нечётная: отсюда σ(−x) = 1 − σ(x).'
            : '<b>Ни чётная, ни нечётная</b> — ни один пунктир не совпал. Так у большинства функций; чётность — особое удобное свойство, а не правило.';
      } else if (s.mode === 'period') {
        const c0 = curve(F.f, -7, 7, 1401, { jump: 0.5 });
        const c1 = curve((x) => F.f(x + s.T), -7, 7, 1401, { jump: 0.5 });
        const xs = U.linspace(-7, 7, 1401);
        const err = Math.max(...xs.map((x) => Math.abs(F.f(x + s.T) - F.f(x))));
        const okT = s.T > 0.05 && err < 0.02;
        L.push({ type: 'line', x: c1.x, y: c1.y, color: 'tree', width: 2.4, dash: '6 4', label: 'f(x + T) — сдвиг на T влево', hover: false });
        L.push({ type: 'line', x: c0.x, y: c0.y, color: 'model', width: 2, label: 'f(x)', hover: false });
        plot.render(L, { x: [-7, 7], y: s.fn === 'mix' ? [-2.2, 2.2] : s.fn === 'sq' ? [-0.5, 7] : [-1.4, 1.4] });
        setK('наибольшее |f(x + T) − f(x)|', 'период?');
        st.set('a', U.fmt(err, 3));
        st.set('b', okT ? 'да, T ≈ ' + U.fmt(s.T, 3) : 'нет');
        msg = okT ? '<b>Совпало:</b> сдвинутый график лёг на исходный, значит f(x + T) = f(x) для всех x — функция <b>периодическая</b>, T ≈ ' + U.fmt(s.T, 3) + '. Наименьший такой сдвиг: ' + F.Tt + '.'
          : F.T ? 'Двигайте T, пока пунктир не совпадёт с линией (или нажмите «Найти период»). Периодичность — когда график повторяется через равные промежутки: сезонность в продажах, время суток в данных.'
            : 'Сколько ни сдвигай — x² не совпадёт сама с собой: она не периодическая. Периодических функций среди «обычных» немного.';
      } else if (s.mode === 'bound') {
        const c0 = curve(F.f, -s.R, s.R, 1601, { cap: 1e9 });
        const vals = c0.y.filter(Number.isFinite);
        const top = F.hi !== null ? F.hi + 0.6 : Math.min(Math.max(...vals), 12);
        const bot = F.lo !== null ? F.lo - 0.6 : Math.max(Math.min(...vals), -12);
        if (F.lo !== null && F.hi !== null) L.push({ type: 'rect', x0: -s.R, x1: s.R, y0: F.lo, y1: F.hi, fill: 'aqua', opacity: 0.1 });
        if (F.lo !== null) L.push({ type: 'hline', y: F.lo, color: 'aqua', width: 1.6, dash: '6 4', text: 'снизу ' + F.lo });
        if (F.hi !== null) L.push({ type: 'hline', y: F.hi, color: 'aqua', width: 1.6, dash: '6 4', text: 'сверху ' + F.hi });
        L.push({ type: 'line', x: c0.x, y: c0.y, color: 'model', width: 2.4, hover: false });
        plot.render(L, { x: [-s.R, s.R], y: [bot, top] });
        setK('на отрезке [−R; R]: min … max', 'ограничена?');
        st.set('a', U.fmt(Math.min(...vals), 3) + ' … ' + U.fmt(Math.max(...vals), 3));
        st.set('b', F.lo !== null && F.hi !== null ? 'да' : F.lo !== null ? 'только снизу' : 'нет');
        msg = 'Функция <b>ограничена</b>, если все её значения помещаются в полосу между двумя числами. ' + F.label + ': ' + F.t + '. Увеличьте R: у ограниченной функции полоса не растёт, у неограниченной значения уходят всё дальше. Вероятности (выход сигмоиды) обязаны быть ограничены [0; 1] — поэтому прогноз бустинга перед этим пропускают через σ.';
      } else {
        const c0 = curve(F.f, -s.R, s.R, 2401, { cap: 1e4, jump: 5 });
        const yr = s.fn === 'sig' ? [-0.4, 1.4] : s.fn === 'exp' ? [-1, 6] : s.fn === 'ln' ? [-4, 4.5] : [-6, 8];
        F.V.forEach((v) => L.push({ type: 'vline', x: v, color: 'tree', width: 1.6, dash: '6 4', text: 'x = ' + v }));
        F.Hz.forEach((v) => L.push({ type: 'hline', y: v, color: 'tree', width: 1.6, dash: '6 4', text: 'y = ' + v }));
        L.push({ type: 'line', x: c0.x, y: c0.y, color: 'model', width: 2.4, hover: false });
        plot.render(L, { x: [s.fn === 'ln' ? -1 : -s.R, s.R], y: yr });
        const gap = F.Hz.length ? Math.abs(F.f(s.R) - F.Hz[F.Hz.length - 1]) : null;
        setK('f(R)', F.Hz.length ? 'расстояние до y = ' + F.Hz[F.Hz.length - 1] : 'горизонтальной асимптоты');
        st.set('a', U.fmt(F.f(s.R), 4));
        st.set('b', gap === null ? 'нет' : U.fmt(gap, 4));
        msg = '<b>Асимптота</b> — прямая, к которой график неограниченно приближается, уходя на бесконечность. У ' + F.label + ': ' + F.t + '. Увеличьте R — график всё теснее прижимается к пунктиру, но (обычно) не касается его. Строго это «предел при x → ∞» (урок 15.3).';
      }
      note.innerHTML = msg;
    }
    w.pythonAction(() => 'import numpy as np\n\nx = np.linspace(0.1, 3, 30)\nfor name, f in {"x²": lambda x: x**2, "x³": lambda x: x**3, "x² + x": lambda x: x**2 + x}.items():\n    even = np.allclose(f(-x), f(x))\n    odd = np.allclose(f(-x), -f(x))\n    print(f"{name:7s} чётная: {even},  нечётная: {odd}")\n\nt = np.linspace(-7, 7, 1401)\nprint("sin(x + 2π) == sin x:", np.allclose(np.sin(t + 2 * np.pi), np.sin(t)))\n');
    draw();
  });

  /* ==============================================================================
   * 5. Линейная функция: наклон k и сдвиг b по двум точкам
   * ============================================================================== */
  GBC.widget('line-slope', (el) => {
    const s = { A: [0, 1], B: [2, 5] };
    const w = ui.shell(el, { title: 'Прямая по двум точкам: наклон и сдвиг', sub: 'Тяните точки A и B. Наклон k = Δy / Δx — на сколько поднимается прямая при шаге вправо на 1. Сдвиг b — где прямая пересекает ось y.' });
    ui.segmented(w.controls, { label: 'Примеры', value: null, options: [{ value: 'up', label: 'растёт' }, { value: 'down', label: 'убывает' }, { value: 'flat', label: 'постоянная' }, { value: 'vert', label: 'вертикаль' }], onChange: (v) => {
      Object.assign(s, { up: { A: [0, 1], B: [2, 5] }, down: { A: [-2, 3], B: [2, 1] }, flat: { A: [-2, 2], B: [3, 2] }, vert: { A: [1, -2], B: [1, 3] } }[v]);
      draw();
    } });
    const eq = H('div', { style: 'text-align:center;font-size:1.15rem;padding:4px 0 2px;min-height:1.6em' });
    w.main.appendChild(eq);
    const plot = new GBC.Plot(w.main, { height: 340, equal: true, x: { label: 'x', domain: [-5, 5] }, y: { label: 'y', domain: [-5, 6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'наклон k = Δy/Δx' }, { key: 'b', label: 'сдвиг b = f(0)' }, { key: 'z', label: 'нуль x = −b/k' }]);
    function draw() {
      const [x1, y1] = s.A;
      const [x2, y2] = s.B;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const L = [{ type: 'hline', y: 0, color: 'ink2', width: 1 }, { type: 'vline', x: 0, color: 'ink2', width: 1 }];
      if (dx === 0) {
        L.push({ type: 'vline', x: x1, color: 'critical', width: 2.4 });
        texInto(eq, 'x = ' + x1);
        st.set('k', 'нет');
        st.set('b', '—');
        st.set('z', '—');
        note.innerHTML = '<b>Вертикальная прямая x = ' + x1 + ' — не график функции:</b> одному x соответствует бесконечно много y. Наклон «Δy/0» не определён: на ноль делить нельзя.';
      } else {
        const k = dy / dx;
        const b = y1 - k * x1;
        L.push({ type: 'line', x: [-6, 6], y: [-6 * k + b, 6 * k + b], color: 'model', width: 2.4, hover: false });
        L.push({ type: 'segments', x1: [x1], y1: [y1], x2: [x2], y2: [y1], color: 'tree', width: 2.4, opacity: 1 });
        L.push({ type: 'segments', x1: [x2], y1: [y1], x2: [x2], y2: [y2], color: 'aqua', width: 2.4, opacity: 1 });
        L.push({ type: 'text', items: [{ x: (x1 + x2) / 2, y: y1, dy: dy >= 0 ? 16 : -8, anchor: 'middle', text: 'Δx = ' + U.fmt(dx, 2) }, { x: x2, y: (y1 + y2) / 2, dx: 6, text: 'Δy = ' + U.fmt(dy, 2) }] });
        L.push({ type: 'points', x: [0], y: [b], color: 'ink', r: 5, shape: 'square', tooltip: () => [['пересечение с осью y', pt(0, b)]] });
        if (k !== 0) L.push({ type: 'points', x: [-b / k], y: [0], color: 'ink', r: 5, hollow: true, tooltip: () => [['нуль', pt(-b / k, 0)]] });
        const kk = Number(k.toFixed(3));
        texInto(eq, 'y = ' + (kk === 0 ? '' : (kk === 1 ? '' : kk === -1 ? '-' : String(kk)) + 'x') + (kk === 0 ? U.fmt(b, 3).replace('−', '-') : b === 0 ? '' : (b > 0 ? ' + ' : ' - ') + U.fmt(Math.abs(b), 3)));
        st.set('k', U.fmt(k, 3));
        st.set('b', U.fmt(b, 3));
        st.set('z', k === 0 ? (b === 0 ? 'вся ось' : 'нет') : U.fmt(-b / k, 3));
        note.innerHTML = 'Δx = ' + U.fmt(dx, 2) + ', Δy = ' + U.fmt(dy, 2) + ', k = Δy/Δx = ' + U.fmt(k, 3) + '. ' + (k > 0 ? 'k > 0: прямая <b>растёт</b> — каждый шаг вправо на 1 поднимает её на ' + U.fmt(k, 3) + '.' : k < 0 ? 'k &lt; 0: прямая <b>убывает</b> — шаг вправо опускает её на ' + U.fmt(-k, 3) + '.' : 'k = 0: <b>постоянная</b> функция y = ' + U.fmt(b, 3) + ' — горизонтальная прямая.') + ' Где бы ни взять две точки на прямой, отношение Δy/Δx одно и то же — поэтому наклон прямой — одно число. У кривых наклон меняется от точки к точке: это и будет производная (урок 15.5).';
      }
      L.push({ type: 'points', x: [x1, x2], y: [y1, y2], color: 'tree', r: 7, draggable: true, onDrag: (i, x, y) => {
        const p = [Math.round(x * 2) / 2, Math.round(y * 2) / 2];
        if (i === 0) s.A = p;
        else s.B = p;
        draw();
      }, tooltip: (i) => [[i ? 'B' : 'A', pt(...(i ? s.B : s.A))]] });
      L.push({ type: 'text', items: [{ x: x1, y: y1, dx: -8, dy: -10, anchor: 'end', text: 'A' }, { x: x2, y: y2, dx: 8, dy: -10, text: 'B' }] });
      plot.render(L);
    }
    w.pythonAction(() => 'import numpy as np\n\n(x1, y1), (x2, y2) = (' + s.A.join(', ') + '), (' + s.B.join(', ') + ')\nif x1 == x2:\n    print(f"вертикальная прямая x = {x1}: не функция, наклон не определён")\nelse:\n    k = (y2 - y1) / (x2 - x1)      # наклон: Δy / Δx\n    b = y1 - k * x1                # сдвиг: значение при x = 0\n    print(f"y = {k:.3f}·x + {b:.3f}")\n    print("через обе точки:", np.isclose(k * x2 + b, y2))\n    print("np.polyfit:", np.polyfit([x1, x2], [y1, y2], 1))\n');
    draw();
  });

  /* ==============================================================================
   * 6. Квадратичная функция: вершина, ось симметрии, корни
   * ============================================================================== */
  GBC.widget('parabola', (el) => {
    const s = { a: 1, b: -4, c: 3 };
    const w = ui.shell(el, { title: 'Парабола y = ax² + bx + c', sub: 'Меняйте коэффициенты. Вершина в x₀ = −b/(2a); дискриминант D = b² − 4ac решает, сколько у параболы корней.' });
    const sl = {
      a: ui.slider(w.controls, { label: 'a', min: -3, max: 3, step: 0.25, value: s.a, onInput: (v) => ((s.a = v), draw()) }),
      b: ui.slider(w.controls, { label: 'b', min: -6, max: 6, step: 0.5, value: s.b, onInput: (v) => ((s.b = v), draw()) }),
      c: ui.slider(w.controls, { label: 'c', min: -6, max: 6, step: 0.5, value: s.c, onInput: (v) => ((s.c = v), draw()) }),
    };
    ui.segmented(w.controls, { label: 'Примеры', value: null, options: [{ value: [1, -4, 3], label: 'D > 0' }, { value: [1, 2, 1], label: 'D = 0' }, { value: [1, 0, 1], label: 'D < 0' }, { value: [-1, 2, 3], label: 'a < 0' }], onChange: (v) => {
      [s.a, s.b, s.c] = v;
      ['a', 'b', 'c'].forEach((k) => sl[k].set(s[k]));
      draw();
    } });
    const f1 = H('div', { style: 'text-align:center;font-size:1.1rem;padding:4px 0 0;overflow-x:auto' });
    w.main.appendChild(f1);
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x', domain: [-6, 6] }, y: { label: 'y', domain: [-8, 10] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'вершина (x₀, y₀)' }, { key: 'd', label: 'D = b² − 4ac' }, { key: 'r', label: 'корни' }]);
    const n = (v) => U.fmt(v, 3).replace('−', '-');
    function draw() {
      const { a, b, c } = s;
      const f = (x) => a * x * x + b * x + c;
      const cv = curve(f, -6, 6, 601, { cap: 200 });
      const L = [{ type: 'hline', y: 0, color: 'ink2', width: 1 }, { type: 'vline', x: 0, color: 'ink2', width: 1 }];
      if (a === 0) {
        L.push({ type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.4, hover: false });
        plot.render(L);
        texInto(f1, 'y = ' + n(b) + 'x ' + (c >= 0 ? '+ ' : '- ') + n(Math.abs(c)));
        st.set('v', 'нет');
        st.set('d', '—');
        st.set('r', b ? U.fmt(-c / b, 3) : '—');
        note.innerHTML = 'При a = 0 слагаемое x² исчезает — остаётся прямая y = bx + c. У прямой нет вершины.';
        return;
      }
      const x0 = -b / (2 * a);
      const y0 = c - (b * b) / (4 * a);
      const D = b * b - 4 * a * c;
      const roots = D > 1e-12 ? [(-b - Math.sqrt(D)) / (2 * a), (-b + Math.sqrt(D)) / (2 * a)].sort((p, q) => p - q) : Math.abs(D) <= 1e-12 ? [x0] : [];
      L.push({ type: 'vline', x: x0, color: 'tree', width: 1.4, dash: '6 4', text: 'ось x = ' + U.fmt(x0, 2) });
      L.push({ type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.4, hover: false });
      L.push({ type: 'points', x: [x0], y: [y0], color: 'tree', r: 7, label: 'вершина', tooltip: () => [['вершина', pt(x0, y0)]] });
      L.push({ type: 'points', x: roots, y: roots.map(() => 0), color: 'ink', r: 5, hollow: true, label: 'корни', tooltip: (i) => [['корень', U.fmt(roots[i], 3)]] });
      L.push({ type: 'points', x: [0], y: [c], color: 'aqua', r: 5, shape: 'square', label: 'f(0) = c', tooltip: () => [['f(0)', U.fmt(c, 3)]] });
      plot.render(L);
      texInto(f1, (a === 1 ? '' : a === -1 ? '-' : n(a)) + 'x^2 ' + (b === 0 ? '' : (b > 0 ? '+ ' : '- ') + (Math.abs(b) === 1 ? '' : n(Math.abs(b))) + 'x ') + (c === 0 ? '' : (c > 0 ? '+ ' : '- ') + n(Math.abs(c))) + ' \\;=\\; ' + (a === 1 ? '' : a === -1 ? '-' : n(a)) + '\\left(x ' + (x0 >= 0 ? '- ' + n(x0) : '+ ' + n(-x0)) + '\\right)^2 ' + (y0 >= 0 ? '+ ' : '- ') + n(Math.abs(y0)));
      st.set('v', pt(x0, y0));
      st.set('d', U.fmt(D, 3));
      st.set('r', roots.length ? roots.map((r) => U.fmt(r, 3)).join('; ') : 'нет');
      note.innerHTML = (a > 0 ? 'a > 0: ветви <b>вверх</b>, вершина — наименьшее значение (минимум ' + U.fmt(y0, 3) + ').' : 'a &lt; 0: ветви <b>вниз</b>, вершина — наибольшее значение (максимум ' + U.fmt(y0, 3) + ').') + ' ' +
        (D > 1e-12 ? 'D > 0 — два корня: парабола пересекает ось x дважды, симметрично относительно оси x = x₀.' : Math.abs(D) <= 1e-12 ? 'D = 0 — один корень: вершина лежит на оси x.' : 'D &lt; 0 — корней нет: парабола целиком по одну сторону от оси x.') +
        ' Справа от «=» — та же парабола в виде a(x − x₀)² + y₀: это x², растянутая в a раз и сдвинутая вершиной в (x₀, y₀) — шаг 14.';
    }
    w.pythonAction(() => 'import numpy as np\n\na, b, c = ' + [s.a, s.b, s.c].map(U.pyNum).join(', ') + '\nx0 = -b / (2 * a)\ny0 = c - b**2 / (4 * a)\nD = b**2 - 4 * a * c\nprint(f"вершина ({x0:.3f}, {y0:.3f}), D = {D:.3f}")\nprint("корни:", np.roots([a, b, c]))\n');
    draw();
  });

  /* ==============================================================================
   * 7. Игра «Подгоните график»: подбор параметров = обучение
   * ============================================================================== */
  const FIT = ['sq', 'abs', 'sin', 'sigm', 'relu', 'sqrt'];
  GBC.widget('fit-curve', (el) => {
    const s = { seed: 21, t: null, a: 1, b: 0, c: 0, best: Infinity, hits: 0, shown: false, k: 1, hard: false };
    const w = ui.shell(el, { title: 'Игра: подгоните график', sub: 'Оранжевый пунктир — цель: функция g, сдвинутая и растянутая. Подберите a, b, c (и k на трудном уровне), чтобы синяя линия легла на цель. Число «ошибка» должно стать почти нулём.' });
    ui.segmented(w.controls, { label: 'Уровень', value: 'easy', options: [{ value: 'easy', label: 'a, b, c' }, { value: 'hard', label: '+ сжатие k' }], onChange: (v) => ((s.hard = v === 'hard'), sl.k.el.hidden = !s.hard, newT()) });
    const sl = {
      a: ui.slider(w.controls, { label: 'растяжение a', min: -3, max: 3, step: 0.25, value: 1, onInput: (v) => ((s.a = v), draw()) }),
      b: ui.slider(w.controls, { label: 'сдвиг вправо b', min: -4, max: 4, step: 0.25, value: 0, onInput: (v) => ((s.b = v), draw()) }),
      c: ui.slider(w.controls, { label: 'сдвиг вверх c', min: -4, max: 4, step: 0.25, value: 0, onInput: (v) => ((s.c = v), draw()) }),
      k: ui.slider(w.controls, { label: 'сжатие k', min: 0.5, max: 3, step: 0.25, value: 1, onInput: (v) => ((s.k = v), draw()) }),
    };
    sl.k.el.hidden = true;
    ui.button(w.controls, { label: 'Новая цель', kind: 'primary', icon: 'step', onClick: () => newT() });
    ui.button(w.controls, { label: 'Показать ответ', onClick: () => ((s.shown = true), draw()) });
    const tgt = H('div', { style: 'text-align:center;font-weight:650;padding:4px 0' });
    w.main.appendChild(tgt);
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x', domain: [-5, 5] }, y: { label: 'y', domain: [-5, 5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'ошибка (корень из средн. квадрата)' }, { key: 'best', label: 'лучшая' }, { key: 'h', label: 'попаданий' }]);
    let prevErr = null;
    let scored = false;
    function newT() {
      const rng = new GBC.RNG(s.seed++);
      const g = FIT[rng.randint(FIT.length)];
      const pick = (arr) => arr[rng.randint(arr.length)];
      s.t = { g, a: pick([-2, -1, -0.5, 0.5, 2, 1.5]), b: pick([-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2]), c: pick([-2, -1, -0.5, 0.5, 1, 2]), k: s.hard ? pick([0.5, 1.5, 2]) : 1 };
      Object.assign(s, { a: 1, b: 0, c: 0, k: 1, best: Infinity, shown: false });
      ['a', 'b', 'c', 'k'].forEach((k) => sl[k].set(s[k]));
      prevErr = null;
      scored = false;
      draw();
    }
    function err() {
      const Z = ZOO[s.t.g];
      const xs = U.linspace(-5, 5, 401);
      let sum = 0;
      let n = 0;
      for (const x of xs) {
        const yt = s.t.a * Z.g(s.t.k * (x - s.t.b)) + s.t.c;
        const yp = s.a * Z.g(s.k * (x - s.b)) + s.c;
        if (!Number.isFinite(yt) && !Number.isFinite(yp)) continue;
        const d = Number.isFinite(yt) && Number.isFinite(yp) ? U.clamp(yt - yp, -10, 10) : 3;
        sum += d * d;
        n++;
      }
      return Math.sqrt(sum / Math.max(1, n));
    }
    function draw() {
      const Z = ZOO[s.t.g];
      const T = s.t;
      const e = err();
      s.best = Math.min(s.best, e);
      const hit = e < 0.02;
      if (hit && !scored) (s.hits++, (scored = true));
      const ct = curve((x) => T.a * Z.g(T.k * (x - T.b)) + T.c, -5, 5, 801, { cap: 50, jump: 3 });
      const cp = curve((x) => s.a * Z.g(s.k * (x - s.b)) + s.c, -5, 5, 801, { cap: 50, jump: 3 });
      plot.render([
        { type: 'line', x: ct.x, y: ct.y, color: 'tree', width: 4, dash: '7 5', label: 'цель', hover: false, opacity: 0.85 },
        { type: 'line', x: cp.x, y: cp.y, color: 'model', width: 2.4, label: 'ваша функция', hover: false },
      ]);
      tgt.textContent = 'g(x) = ' + Z.tex + (s.shown ? '   ·   ответ: a = ' + U.fmt(T.a, 2) + ', b = ' + U.fmt(T.b, 2) + ', c = ' + U.fmt(T.c, 2) + (s.hard ? ', k = ' + U.fmt(T.k, 2) : '') : '');
      st.set('e', U.fmt(e, 3), prevErr === null ? null : e - prevErr);
      st.set('best', U.fmt(s.best, 3));
      st.set('h', String(s.hits));
      prevErr = e;
      note.innerHTML = hit ? '<b>Попадание!</b> Вы подобрали параметры так, что ошибка почти ноль. Именно это делает обучение модели: двигает параметры, следя за числом «ошибка» (функцией потерь), пока оно не станет маленьким. Только модель двигает их не наугад, а по производной — об этом уроки 15.5–15.8.'
        : 'Совет: сначала найдите «особую точку» цели (дно, излом, середину ступеньки) и совместите её сдвигами b и c, потом подберите a: знак — перевёрнут ли график, величину — насколько он вытянут. Стрелка ▲/▼ у ошибки показывает, стало ли лучше после последнего движения.';
    }
    w.pythonAction(() => 'import numpy as np\n\ng = lambda x: ' + ZOO[s.t.g].py + '\ntarget = lambda x: ' + U.pyNum(s.t.a) + ' * g(' + U.pyNum(s.t.k) + ' * (x - ' + U.pyNum(s.t.b) + ')) + ' + U.pyNum(s.t.c) + '\nmine = lambda x: ' + U.pyNum(s.a) + ' * g(' + U.pyNum(s.k) + ' * (x - ' + U.pyNum(s.b) + ')) + ' + U.pyNum(s.c) + '\n\nx = np.linspace(-5, 5, 401)\nwith np.errstate(all="ignore"):\n    d = target(x) - mine(x)\nd = d[np.isfinite(d)]\nprint("ошибка (RMSE):", np.sqrt(np.mean(d**2)).round(4))\n');
    newT();
  });

  /* ==============================================================================
   * 8. Кусочно заданные функции
   * ============================================================================== */
  const PW = {
    abs: { label: 'модуль |x|', vx: [-4, 4], vy: [-1, 4.5], P: [
      { a: -I, b: 0, ia: 0, ib: 0, f: (x) => -x, tex: '-x', cond: 'x < 0' }, { a: 0, b: I, ia: 1, ib: 0, f: (x) => x, tex: 'x', cond: 'x \\ge 0' }], py: 'np.where(x < 0, -x, x)' },
    relu: { label: 'ReLU = max(0, x)', vx: [-4, 4], vy: [-1, 4.5], P: [
      { a: -I, b: 0, ia: 0, ib: 0, f: () => 0, tex: '0', cond: 'x < 0' }, { a: 0, b: I, ia: 1, ib: 0, f: (x) => x, tex: 'x', cond: 'x \\ge 0' }], py: 'np.where(x < 0, 0, x)' },
    tariff: { label: 'тариф такси', vx: [0, 8], vy: [0, 360], P: [
      { a: 0, b: 2, ia: 1, ib: 1, f: () => 150, tex: '150', cond: '0 \\le x \\le 2' }, { a: 2, b: I, ia: 0, ib: 0, f: (x) => 150 + 30 * (x - 2), tex: '150 + 30(x - 2)', cond: 'x > 2' }], py: 'np.where(x <= 2, 150, 150 + 30 * (x - 2))' },
    tree: { label: 'дерево с двумя порогами', vx: [0, 6], vy: [0, 11], P: [
      { a: -I, b: 2, ia: 0, ib: 1, f: () => 3, tex: '3', cond: 'x \\le 2' }, { a: 2, b: 4, ia: 0, ib: 1, f: () => 5, tex: '5', cond: '2 < x \\le 4' }, { a: 4, b: I, ia: 0, ib: 0, f: () => 9, tex: '9', cond: 'x > 4' }], py: 'np.select([x <= 2, x <= 4], [3, 5], default=9)' },
    huber: { label: 'потери Хьюбера (δ = 1)', vx: [-4, 4], vy: [-0.3, 3.8], P: [
      { a: -I, b: -1, ia: 0, ib: 0, f: (r) => -r - 0.5, tex: '-r - \\tfrac12', cond: 'r < -1' }, { a: -1, b: 1, ia: 1, ib: 1, f: (r) => (r * r) / 2, tex: '\\tfrac12 r^2', cond: '|r| \\le 1' }, { a: 1, b: I, ia: 0, ib: 0, f: (r) => r - 0.5, tex: 'r - \\tfrac12', cond: 'r > 1' }], py: 'np.where(np.abs(x) <= 1, 0.5 * x**2, np.abs(x) - 0.5)' },
    sign: { label: 'знак sign x', vx: [-4, 4], vy: [-1.6, 1.6], P: [
      { a: -I, b: 0, ia: 0, ib: 0, f: () => -1, tex: '-1', cond: 'x < 0' }, { a: 0, b: 0, ia: 1, ib: 1, f: () => 0, tex: '0', cond: 'x = 0' }, { a: 0, b: I, ia: 0, ib: 0, f: () => 1, tex: '1', cond: 'x > 0' }], py: 'np.sign(x)' },
  };
  GBC.widget('piecewise', (el) => {
    const s = { fn: 'tree', x: 3 };
    const w = ui.shell(el, { title: 'Кусочно заданные функции', sub: 'Функция собрана из кусков: на каждом участке оси x — своя формула. Двигайте x и смотрите, какой кусок «работает». Закрашенный кружок — точка принадлежит куску, пустой — нет.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(PW).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.x = U.clamp(s.x, PW[v].vx[0], PW[v].vx[1])), mk(), draw()) });
    const box = H('div');
    w.controls.appendChild(box);
    let xs;
    function mk() {
      box.textContent = '';
      const V = PW[s.fn];
      xs = ui.slider(box, { label: s.fn === 'huber' ? 'остаток r' : 'x', min: V.vx[0], max: V.vx[1], step: 0.05, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    }
    mk();
    const list = H('div', { style: 'display:grid;gap:4px;margin-top:6px' });
    w.controls.appendChild(list);
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'работает кусок' }, { key: 'v', label: 'значение' }, { key: 'c', label: 'стыки' }]);
    const inP = (p, x) => (x > p.a || (p.ia && x === p.a)) && (x < p.b || (p.ib && x === p.b));
    function draw() {
      const V = PW[s.fn];
      const act = V.P.findIndex((p) => inP(p, s.x));
      const L = [{ type: 'hline', y: 0, color: 'ink2', width: 1 }];
      V.P.forEach((p, i) => {
        const col = GBC.colors.series(i);
        const a = Math.max(p.a, V.vx[0]);
        const b = Math.min(p.b, V.vx[1]);
        if (b > a) {
          const xx = U.linspace(a, b, 200);
          L.push({ type: 'line', x: xx, y: xx.map(p.f), color: col, width: i === act ? 4 : 2.2, opacity: i === act ? 1 : 0.55, hover: false });
        }
        for (const [v, inc] of [[p.a, p.ia], [p.b, p.ib]]) {
          if (!Number.isFinite(v) || v < V.vx[0] || v > V.vx[1]) continue;
          const yv = p.f(v);
          const twin = V.P.some((q) => q !== p && (q.a === v || q.b === v) && Math.abs(q.f(v) - yv) < 1e-9);
          if (twin) continue;
          L.push({ type: 'points', x: [v], y: [yv], color: col, r: 5, hollow: !inc, tooltip: () => [[inc ? 'входит' : 'не входит', pt(v, yv)]] });
        }
      });
      const y = act >= 0 ? V.P[act].f(s.x) : NaN;
      L.push({ type: 'vline', x: s.x, color: 'ink2', width: 1, dash: '3 3' });
      if (act >= 0) L.push({ type: 'points', x: [s.x], y: [y], color: 'ink', r: 6, tooltip: () => [['x', U.fmt(s.x, 2)], ['f(x)', U.fmt(y, 3)]] });
      plot.render(L, { x: V.vx, y: V.vy });
      list.textContent = '';
      V.P.forEach((p, i) => {
        const row = H('div', { style: 'display:flex;gap:8px;align-items:center;padding:4px 8px;border-radius:8px;border-left:4px solid ' + GBC.colors.css(GBC.colors.series(i)) + ';background:' + (i === act ? 'var(--accent-soft)' : 'transparent') });
        const f = H('span');
        const c = H('span', { style: 'color:var(--muted)' });
        texInto(f, p.tex);
        texInto(c, p.cond);
        row.append(f, H('span', { style: 'color:var(--muted)' }, 'если'), c);
        list.appendChild(row);
      });
      const jump = V.P.slice(0, -1).some((p, i) => Number.isFinite(p.b) && Math.abs(p.f(p.b) - V.P[i + 1].f(p.b)) > 1e-9);
      st.set('p', act >= 0 ? '№ ' + (act + 1) : '—');
      st.set('v', act >= 0 ? U.fmt(y, 3) : '—');
      st.set('c', jump ? 'есть скачок' : 'без разрывов');
      note.innerHTML = {
        abs: 'Модуль — две прямые, сшитые в нуле: значения кусков совпадают (0 = 0), график непрерывный, но с <b>изломом</b>.',
        relu: 'ReLU обнуляет отрицательное и пропускает положительное. Тоже излом в нуле, без скачка.',
        tariff: 'Минималка 150 ₽ до 2 км, потом +30 ₽/км. В точке x = 2 оба куска дают 150 — стык без скачка. Тарифы, налоги, скидки — типичные кусочные функции.',
        tree: 'Дерево решений — кусочно-<b>постоянная</b> функция: на каждом участке — константа (значение листа). На стыках — скачки. Кружки показывают, куда относится сама граница: «x ≤ 2» — значит x = 2 идёт в левый лист.',
        huber: 'Потери Хьюбера: около нуля — парабола (как квадратичные), дальше — прямые (как абсолютные). Куски подобраны так, что сшиваются и по значению, и по наклону — гладко. Поэтому Хьюбер устойчив к выбросам (урок 3.2).',
        sign: 'Три куска, средний — всего одна точка (0, 0). На стыках — скачки на 1: функция разрывна в нуле.',
      }[s.fn];
    }
    w.pythonAction(() => 'import numpy as np\n\nx = np.linspace(' + PW[s.fn].vx[0] + ', ' + PW[s.fn].vx[1] + ', 9)\ny = ' + PW[s.fn].py + '\nfor a, b in zip(x, y):\n    print(f"{a:6.2f} → {b:7.3f}")\n');
    draw();
  });

  /* ==============================================================================
   * 9. Сумма функций: сложение высот — и бустинг как сумма ступенек
   * ============================================================================== */
  const SUMF = {
    x: { label: 'x', f: (x) => x, py: 'x' }, half: { label: 'x/2', f: (x) => x / 2, py: 'x / 2' }, sq: { label: 'x²/4', f: (x) => (x * x) / 4, py: 'x**2 / 4' },
    sin: { label: 'sin x', f: Math.sin, py: 'np.sin(x)' }, one: { label: '1 (константа)', f: () => 1, py: '1 + 0 * x' },
    step: { label: 'ступенька [x ≥ 1]', f: (x) => (x >= 1 ? 1 : 0), py: '(x >= 1) * 1.0' }, abs: { label: '|x|', f: Math.abs, py: 'np.abs(x)' },
  };
  function fitStump(x, r) {
    const n = x.length;
    let best = { sse: Infinity };
    for (let k = 1; k < n; k++) {
      if (x[k] === x[k - 1]) continue;
      const L = r.slice(0, k);
      const R = r.slice(k);
      const ml = U.mean(L);
      const mr = U.mean(R);
      let sse = 0;
      for (const v of L) sse += (v - ml) ** 2;
      for (const v of R) sse += (v - mr) ** 2;
      if (sse < best.sse) best = { sse, t: (x[k - 1] + x[k]) / 2, l: ml, r: mr };
    }
    return best;
  }
  GBC.widget('function-sum', (el) => {
    const s = { mode: 'two', f: 'x', g: 'sin', op: '+', x: 2, m: 3, nu: 0.5 };
    const w = ui.shell(el, { title: 'Сумма функций', sub: 'Сложить две функции — значит в каждой точке x сложить их высоты: (f + g)(x) = f(x) + g(x). Во втором режиме — главная идея курса: модель бустинга — сумма ступенек.' });
    ui.segmented(w.controls, { label: 'Режим', value: s.mode, options: [{ value: 'two', label: 'две функции' }, { value: 'boost', label: 'бустинг: сумма ступенек' }], onChange: (v) => ((s.mode = v), build(), draw()) });
    const dyn = H('div');
    w.controls.appendChild(dyn);
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'y' } });
    const plot2Box = H('div');
    w.main.appendChild(plot2Box);
    const plot2 = new GBC.Plot(plot2Box, { height: 150, x: { label: 'x' }, y: { label: 'ν·h_m(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '' }, { key: 'b', label: '' }]);
    const stK = st.el.querySelectorAll('.k');
    const setK = (a, b) => ((stK[0].textContent = a), (stK[1].textContent = b));
    const data = GBC.datasets.regression1d({ kind: 'sine', n: 50, noise: 0.25, seed: 7, xMin: 0, xMax: 10 });
    let boost = null;
    function fitBoost() {
      const x = data.x;
      const F0 = U.mean(data.y);
      const pred = x.map(() => F0);
      const stumps = [];
      for (let m = 0; m < 40; m++) {
        const r = data.y.map((v, i) => v - pred[i]);
        const st0 = fitStump(x, r);
        stumps.push(st0);
        x.forEach((v, i) => (pred[i] += s.nu * (v <= st0.t ? st0.l : st0.r)));
      }
      boost = { F0, stumps, nu: s.nu };
    }
    function build() {
      dyn.textContent = '';
      plot2Box.hidden = s.mode !== 'boost';
      if (s.mode === 'two') {
        ui.select(dyn, { label: 'f', value: s.f, options: Object.entries(SUMF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.f = v), draw()) });
        ui.select(dyn, { label: 'g', value: s.g, options: Object.entries(SUMF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.g = v), draw()) });
        ui.segmented(dyn, { label: 'Действие', value: s.op, options: [{ value: '+', label: 'f + g' }, { value: '−', label: 'f − g' }, { value: '×', label: 'f · g' }], onChange: (v) => ((s.op = v), draw()) });
        ui.slider(dyn, { label: 'точка x', min: -4, max: 4, step: 0.05, value: s.x, onInput: (v) => ((s.x = v), draw()) });
      } else {
        ui.player(dyn, { label: 'Сколько ступенек сложено', min: 0, max: 40, value: s.m, fps: 3, format: (v) => 'm = ' + v, onChange: (v) => ((s.m = v), draw()) });
        ui.slider(dyn, { label: 'темп обучения ν', min: 0.1, max: 1, step: 0.1, value: s.nu, onInput: (v) => ((s.nu = v), fitBoost(), draw()) });
      }
    }
    fitBoost();
    build();
    function draw() {
      if (s.mode === 'two') {
        const f = SUMF[s.f].f;
        const g = SUMF[s.g].f;
        const op = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b }[s.op];
        const xs = U.linspace(-4, 4, 801);
        const gap = (arr) => arr.map((v, i) => (i && Math.abs(v - arr[i - 1]) > 0.5 ? NaN : v));
        const fx = f(s.x);
        const gx = g(s.x);
        const r = op(fx, gx);
        const L = [
          { type: 'hline', y: 0, color: 'ink2', width: 1 },
          { type: 'line', x: xs, y: gap(xs.map(f)), color: 'aqua', width: 1.8, dash: '6 4', label: 'f(x) = ' + SUMF[s.f].label, hover: false },
          { type: 'line', x: xs, y: gap(xs.map(g)), color: 'tree', width: 1.8, dash: '6 4', label: 'g(x) = ' + SUMF[s.g].label, hover: false },
          { type: 'line', x: xs, y: gap(xs.map((x) => op(f(x), g(x)))), color: 'model', width: 2.6, label: 'результат', hover: false },
        ];
        if (s.op !== '×') {
          L.push({ type: 'segments', x1: [s.x - 0.06], y1: [0], x2: [s.x - 0.06], y2: [fx], color: 'aqua', width: 5, opacity: 0.9 });
          L.push({ type: 'segments', x1: [s.x + 0.06], y1: [fx], x2: [s.x + 0.06], y2: [r], color: 'tree', width: 5, opacity: 0.9 });
        }
        L.push({ type: 'points', x: [s.x], y: [r], color: 'model', r: 6, tooltip: () => [['f(x)', U.fmt(fx, 3)], ['g(x)', U.fmt(gx, 3)], ['результат', U.fmt(r, 3)]] });
        plot.render(L, { x: [-4, 4], y: [-5, 6] });
        setK('f(x) ' + s.op + ' g(x) при x = ' + U.fmt(s.x, 2), 'результат');
        st.set('a', U.fmt(fx, 3) + ' ' + s.op + ' ' + U.fmt(gx, 3));
        st.set('b', U.fmt(r, 3));
        note.innerHTML = s.op === '×'
          ? 'Произведение: высоты перемножаются. Где одна из функций равна нулю, там и произведение ноль; знак «−» на «−» даёт «+».'
          : 'Бирюзовый столбик — f(x), поверх него оранжевый — ' + (s.op === '+' ? 'g(x)' : '−g(x)') + '. Верх оранжевого столбика и есть точка результата. Так сложение графиков делается «на глаз» в каждой точке: например, x/2 + sin x — волна, которая в среднем поднимается вдоль прямой.';
      } else {
        const x = data.x;
        const B = boost;
        const Fm = (v, m) => {
          let r = B.F0;
          for (let j = 0; j < m; j++) r += B.nu * (v <= B.stumps[j].t ? B.stumps[j].l : B.stumps[j].r);
          return r;
        };
        const grid = U.linspace(0, 10, 1001);
        const gap = (arr) => arr.map((v, i) => (i && Math.abs(v - arr[i - 1]) > 1e-9 && Math.abs(v - arr[i - 1]) > 0.02 ? NaN : v));
        const cur = grid.map((v) => Fm(v, s.m));
        const prev = grid.map((v) => Fm(v, Math.max(0, s.m - 1)));
        const mse = U.mean(x.map((v, i) => (data.y[i] - Fm(v, s.m)) ** 2));
        plot.render([
          { type: 'points', x, y: data.y, color: 'data', r: 4, label: 'данные', tooltip: (i) => [['x', U.fmt(x[i], 2)], ['y', U.fmt(data.y[i], 2)]] },
          s.m > 0 ? { type: 'line', x: grid, y: gap(prev), color: 'model-prev', width: 1.6, label: 'F_{m-1}(x)', hover: false } : null,
          { type: 'line', x: grid, y: gap(cur), color: 'model', width: 2.6, label: 'F_m(x) = F_0 + ν·h_1 + … + ν·h_m', hover: false },
        ], { x: [0, 10] });
        const last = s.m > 0 ? B.stumps[s.m - 1] : null;
        plot2.render([
          { type: 'hline', y: 0, color: 'ink2', width: 1 },
          last ? { type: 'steps', segments: [{ x0: 0, x1: last.t, value: B.nu * last.l }, { x0: last.t, x1: 10, value: B.nu * last.r }], color: 'tree', width: 2.4, label: 'новая ступенька ν·h_m' } : null,
        ], { x: [0, 10], y: [-1.2, 1.2] });
        setK('сложено ступенек m', 'средняя квадратичная ошибка');
        st.set('a', String(s.m));
        st.set('b', U.fmt(mse, 4));
        note.innerHTML = 'F₀ = ' + U.fmt(B.F0, 3) + ' — просто среднее (горизонтальная прямая). Каждая следующая ступенька h_m — дерево-пень, обученное на остатках, — умножается на ν и <b>прибавляется</b> к модели: ' + (last ? 'последняя прибавка: ' + U.fmt(B.nu * last.l, 3) + ' слева от x = ' + U.fmt(last.t, 2) + ' и ' + U.fmt(B.nu * last.r, 3) + ' справа. ' : '') + 'Сумма ступенек — снова ступенчатая функция, но с всё более мелкими ступенями: так бустинг рисует сложную кривую из простых кусков (модуль 4).';
      }
    }
    w.pythonAction(() => s.mode === 'two'
      ? 'import numpy as np\n\nf = lambda x: ' + SUMF[s.f].py + '\ng = lambda x: ' + SUMF[s.g].py + '\nx = np.linspace(-4, 4, 9)\nprint(np.c_[x, f(x), g(x), f(x) ' + (s.op === '×' ? '*' : s.op === '−' ? '-' : '+') + ' g(x)].round(3))\n'
      : 'import numpy as np\nfrom gbcourse import datasets\n\nX, y = datasets.regression_1d(kind="sine", n=50, noise=0.25, seed=7, x_min=0, x_max=10)\nx = X[:, 0]\nnu, M = ' + U.pyNum(s.nu) + ', ' + s.m + '\nF = np.full_like(y, y.mean())            # F0 — среднее\nfor m in range(M):\n    r = y - F                            # остатки\n    best = None\n    for t in (x[1:] + x[:-1]) / 2:       # пень: один порог\n        L, R = r[x <= t], r[x > t]\n        if len(L) == 0 or len(R) == 0:\n            continue\n        sse = ((L - L.mean())**2).sum() + ((R - R.mean())**2).sum()\n        if best is None or sse < best[0]:\n            best = (sse, t, L.mean(), R.mean())\n    _, t, l, rr = best\n    F += nu * np.where(x <= t, l, rr)    # прибавили ступеньку\nprint("MSE после", M, "ступенек:", ((y - F)**2).mean().round(4))\n');
    draw();
  });

  /* ==============================================================================
   * 10. Обратная функция: отражение в прямой y = x
   * ============================================================================== */
  const INV = {
    lin: { label: 'f(x) = 2x + 1', f: (x) => 2 * x + 1, inv: (y) => (y - 1) / 2, d: [-I, I], invTex: 'f^{-1}(x) = (x - 1)/2', ok: true },
    exp: { label: 'f(x) = eˣ', f: Math.exp, inv: (y) => nanIf(y <= 0, Math.log(y)), d: [-I, I], invTex: 'f^{-1}(x) = \\ln x', ok: true },
    sigm: { label: 'f(x) = σ(x)', f: sigmoid, inv: (p) => nanIf(p <= 0 || p >= 1, Math.log(p / (1 - p))), d: [-I, I], invTex: 'f^{-1}(p) = \\ln\\dfrac{p}{1-p}\\ \\ (\\text{логит})', ok: true },
    sqpos: { label: 'f(x) = x², только x ≥ 0', f: (x) => nanIf(x < 0, x * x), inv: (y) => nanIf(y < 0, Math.sqrt(y)), d: [0, I], invTex: 'f^{-1}(x) = \\sqrt{x}', ok: true },
    cube: { label: 'f(x) = x³', f: (x) => x ** 3, inv: Math.cbrt, d: [-I, I], invTex: 'f^{-1}(x) = \\sqrt[3]{x}', ok: true },
    sqall: { label: 'f(x) = x² на всей прямой', f: (x) => x * x, inv: null, d: [-I, I], invTex: '\\text{обратной нет}', ok: false },
  };
  GBC.widget('inverse', (el) => {
    const s = { fn: 'sigm', t: 1, c: 2 };
    const w = ui.shell(el, { title: 'Обратная функция', sub: 'Обратная функция f⁻¹ «отматывает» машинку назад: по выходу находит вход. Её график — отражение графика f в прямой y = x. Тяните синюю точку.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(INV).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.t = v === 'sqpos' ? 1 : 0.8), draw()) });
    const showInv = ui.toggle(w.controls, { label: 'Показать f⁻¹', checked: true, onChange: () => draw() });
    const hTest = ui.toggle(w.controls, { label: 'Горизонтальный тест', checked: false, onChange: () => draw() });
    const fBox = H('div', { style: 'text-align:center;font-size:1.05rem;padding:2px 0;min-height:1.8em' });
    w.main.appendChild(fBox);
    const plot = new GBC.Plot(w.main, { height: 360, equal: true, x: { label: 'x', domain: [-4, 4] }, y: { label: 'y', domain: [-4, 4] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'точка на f' }, { key: 'q', label: 'точка на f⁻¹' }, { key: 'h', label: 'пересечений с y = c' }]);
    function draw() {
      const V = INV[s.fn];
      const yt = V.f(s.t);
      const cf = curve(V.f, -8, 8, 1601, { cap: 30 });
      const L = [
        { type: 'hline', y: 0, color: 'ink2', width: 1 }, { type: 'vline', x: 0, color: 'ink2', width: 1 },
        { type: 'line', x: [-8, 8], y: [-8, 8], color: 'muted', width: 1.4, dash: '5 4', label: 'y = x (зеркало)', hover: false },
        { type: 'line', x: cf.x, y: cf.y, color: 'model', width: 2.6, label: 'f', hover: false },
      ];
      if (V.inv && showInv.checked) {
        const ci = curve(V.inv, -8, 8, 1601, { cap: 30 });
        L.push({ type: 'line', x: ci.x, y: ci.y, color: 'tree', width: 2.6, label: 'f⁻¹', hover: false });
        if (Number.isFinite(yt)) {
          L.push({ type: 'segments', x1: [s.t], y1: [yt], x2: [yt], y2: [s.t], color: 'ink2', width: 1.2, dash: '3 3', opacity: 1 });
          L.push({ type: 'points', x: [yt], y: [s.t], color: 'tree', r: 6, tooltip: () => [['на f⁻¹', pt(yt, s.t)]] });
        }
      }
      let hits = [];
      if (hTest.checked) {
        hits = solve(V.f, s.c, -4, 4);
        L.push({ type: 'hline', y: s.c, color: 'critical', width: 1.6, draggable: true, text: 'y = ' + U.fmt(s.c, 2), onDrag: (v) => ((s.c = Math.round(v * 20) / 20), draw()) });
        L.push({ type: 'points', x: hits, y: hits.map(() => s.c), color: 'critical', r: 5 });
      }
      if (Number.isFinite(yt)) L.push({ type: 'points', x: [s.t], y: [yt], color: 'model', r: 7, draggable: true, onDrag: (i, x) => ((s.t = Math.round(U.clamp(x, V.d[0] === 0 ? 0 : -4, 4) * 20) / 20), draw()), tooltip: () => [['на f', pt(s.t, yt)]] });
      plot.render(L);
      texInto(fBox, V.invTex);
      st.set('p', Number.isFinite(yt) ? pt(s.t, yt) : '—');
      st.set('q', V.inv && Number.isFinite(yt) ? pt(yt, s.t) : '—');
      st.set('h', hTest.checked ? String(hits.length) : '—');
      const back = V.inv && Number.isFinite(yt) ? V.inv(yt) : NaN;
      note.innerHTML = (V.ok
        ? 'f(' + U.fmt(s.t, 2) + ') = ' + U.fmt(yt, 3) + ', и f⁻¹(' + U.fmt(yt, 3) + ') = ' + U.fmt(back, 3) + ' — вернулись к входу. Точки (x, y) и (y, x) симметричны относительно прямой y = x. '
        : 'У x² значения повторяются: f(2) = f(−2) = 4. По выходу 4 нельзя однозначно вернуться к входу — <b>обратной функции нет</b>. Включите горизонтальный тест: линия y = c (c > 0) пересекает параболу дважды. Если оставить только x ≥ 0 — обратная появится: √x. ') +
        ({
          sigm: 'Логит — обратная к сигмоиде: переводит вероятность p обратно в «сырой» прогноз F. Бустинг-классификатор начинает с F₀ = ln(p/(1 − p)), где p — доля класса 1 (урок 6.1).',
          exp: 'Логарифм — обратная к экспоненте: e^{ln x} = x. Поэтому ln «отменяет» e, а e «отменяет» ln.',
          lin: 'Чтобы обратить y = 2x + 1, выражаем x: x = (y − 1)/2 — действия в обратном порядке и наоборот: сначала −1, потом :2.',
          sqpos: 'Ограничив область определения x ≥ 0, мы сделали x² монотонной — и обратная нашлась.',
          cube: 'x³ строго растёт — каждое значение принимается один раз, поэтому обратная есть на всей прямой.',
          sqall: '',
        }[s.fn]) + (hTest.checked && V.ok ? ' Горизонтальный тест: монотонная функция пересекается с любой горизонталью не больше одного раза — поэтому у неё есть обратная.' : '');
    }
    w.pythonAction(() => 'import numpy as np\n\nsigmoid = lambda z: 1 / (1 + np.exp(-z))\nlogit = lambda p: np.log(p / (1 - p))     # обратная к сигмоиде\n\nx = np.linspace(-5, 5, 11)\nprint("logit(σ(x)) == x:", np.allclose(logit(sigmoid(x)), x))\np = 0.3                                   # доля класса 1\nprint("стартовый прогноз F0 = logit(p) =", round(logit(p), 4), "→ σ(F0) =", sigmoid(logit(p)))\n');
    draw();
  });

  /* ==============================================================================
   * 11. Функция двух переменных: карта высот и срезы
   * ============================================================================== */
  GBC.widget('two-vars', (el) => {
    const s = { model: 'lin', d: 5, sA: 60 };
    const MODELS = {
      lin: { label: 'линейная формула', f: (a, d) => 2 + 0.1 * a - 0.15 * d, tex: 'P(s, d) = 2 + 0.1\\,s - 0.15\\,d' },
      tree: { label: 'дерево решений', f: (a, d) => (a <= 60 ? (d <= 8 ? 6 : 4) : d <= 8 ? 11 : 8), tex: 'P(s, d) = \\text{лист дерева}' },
    };
    const w = ui.shell(el, { title: 'Функция двух переменных: цена квартиры', sub: 'Два входа — площадь s (м²) и расстояние до центра d (км), один выход — цена P (млн ₽). Цвет — высота «поверхности». Тяните горизонтальный срез d = const: справа — обычный график функции одной переменной.' });
    ui.segmented(w.controls, { label: 'Модель', value: s.model, options: Object.entries(MODELS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.model = v), draw()) });
    ui.slider(w.controls, { label: 'срез: расстояние d, км', min: 0, max: 20, step: 0.5, value: s.d, onInput: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'площадь s, м²', min: 20, max: 120, step: 1, value: s.sA, onInput: (v) => ((s.sA = v), draw()) });
    const fBox = H('div', { style: 'text-align:center;padding:2px 0 4px' });
    w.main.appendChild(fBox);
    const two = H('div', { class: 'plots-2' });
    w.main.appendChild(two);
    const hov = { v: null };
    const map = new GBC.Plot(two, { height: 280, x: { label: 'площадь s, м²', domain: [20, 120] }, y: { label: 'до центра d, км', domain: [0, 20] }, onHover: (p) => ((hov.v = p ? [p.x, p.y] : null), stat()) });
    const slice = new GBC.Plot(two, { height: 280, x: { label: 'площадь s, м²', domain: [20, 120] }, y: { label: 'цена P, млн ₽', domain: [0, 15] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'P(s, d) в выбранной точке' }, { key: 'h', label: 'под курсором' }]);
    const M = () => MODELS[s.model];
    function stat() {
      const v = hov.v;
      st.set('h', v && v[0] >= 20 && v[0] <= 120 && v[1] >= 0 && v[1] <= 20 ? 'P(' + Math.round(v[0]) + ', ' + U.fmt(v[1], 1) + ') = ' + U.fmt(M().f(v[0], v[1]), 2) : '—');
    }
    function draw() {
      const f = M().f;
      const seq = GBC.colors.sequential();
      const grid = GBC.Plot.grid(f, 20, 120, 0, 20, 101, 81);
      map.render([
        { type: 'heatmap', grid, colorFn: (v) => seq(v / 14), opacity: 0.62, smooth: s.model === 'lin' },
        { type: 'hline', y: s.d, color: 'tree', width: 3, draggable: true, onDrag: (v) => ((s.d = Math.round(U.clamp(v, 0, 20) * 2) / 2), draw()) },
        { type: 'points', x: [s.sA], y: [s.d], color: 'tree', r: 6, tooltip: () => [['s', s.sA + ' м²'], ['d', U.fmt(s.d, 1) + ' км'], ['P', U.fmt(f(s.sA, s.d), 2) + ' млн']] },
      ]);
      const xs = U.linspace(20, 120, 501);
      const ys = xs.map((a) => f(a, s.d));
      slice.render([
        { type: 'line', x: xs, y: ys.map((v, i) => (i && Math.abs(v - ys[i - 1]) > 0.5 ? NaN : v)), color: 'tree', width: 2.6, label: 'срез P(s, d = ' + U.fmt(s.d, 1) + ')', hover: false },
        { type: 'points', x: [s.sA], y: [f(s.sA, s.d)], color: 'tree', r: 6, tooltip: () => [['P', U.fmt(f(s.sA, s.d), 2)]] },
      ]);
      texInto(fBox, M().tex);
      st.set('p', 'P(' + s.sA + ', ' + U.fmt(s.d, 1) + ') = ' + U.fmt(f(s.sA, s.d), 2));
      stat();
      const dark = document.documentElement.dataset.theme === 'dark';
      note.innerHTML = s.model === 'lin'
        ? (dark ? 'Светлее — дороже. Цена растёт с площадью (вправо светлее) и падает с расстоянием (вверх темнее).' : 'Темнее — дороже. Цена растёт с площадью (вправо темнее) и падает с расстоянием (вверх светлее).') + ' Срез при фиксированном d — прямая с наклоном 0.1: каждый лишний м² добавляет 0.1 млн, где бы ни стояла квартира. Наклон среза — это <b>частная производная</b> (урок 15.8).'
        : 'Дерево по двум признакам — кусочно-постоянная функция: плоскость разрезана на прямоугольники, в каждом — своё значение листа. Срез — снова ступенька. Модель бустинга — сумма многих таких «мозаик».';
    }
    GBC.bus.on('themechange', () => draw());
    w.pythonAction(() => 'import numpy as np\nimport matplotlib.pyplot as plt\n\ns, d = np.meshgrid(np.linspace(20, 120, 101), np.linspace(0, 20, 81))\nP = ' + (s.model === 'lin' ? '2 + 0.1 * s - 0.15 * d' : 'np.where(s <= 60, np.where(d <= 8, 6, 4), np.where(d <= 8, 11, 8))') + '\n\nfig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 3.8))\nim = a1.pcolormesh(s, d, P, cmap="Blues", shading="auto")\na1.axhline(' + U.pyNum(s.d) + ', color="tab:orange")\nfig.colorbar(im, ax=a1, label="цена, млн ₽")\na1.set(xlabel="площадь, м²", ylabel="до центра, км")\nrow = np.abs(d[:, 0] - ' + U.pyNum(s.d) + ').argmin()\na2.plot(s[row], P[row], color="tab:orange")\na2.set(xlabel="площадь, м²", ylabel="цена", title="срез d = ' + U.pyNum(s.d) + '")\nplt.show()\n');
    draw();
  });

  /* ==============================================================================
   * 12. Потери как функция прогноза: лучшая константа для MSE и MAE
   * ============================================================================== */
  GBC.widget('loss-parabola', (el) => {
    const Y = [2, 4, 3, 7, 9, 11];
    const s = { c: 3, loss: 'mse' };
    const LOSS = {
      mse: { label: 'квадратичные (MSE)', f: (c) => U.mean(Y.map((y) => (y - c) ** 2)), name: 'L(c) = (1/6)·Σ(yᵢ − c)²' },
      mae: { label: 'абсолютные (MAE)', f: (c) => U.mean(Y.map((y) => Math.abs(y - c))), name: 'L(c) = (1/6)·Σ|yᵢ − c|' },
    };
    const w = ui.shell(el, { title: 'Потери — функция прогноза', sub: 'Простейшая модель: для всех шести квартир один и тот же прогноз c. Слева — данные и остатки, справа — график потерь L(c). Тяните c и ищите дно.' });
    ui.segmented(w.controls, { label: 'Потери', value: s.loss, options: Object.entries(LOSS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.loss = v), draw()) });
    const csl = ui.slider(w.controls, { label: 'прогноз-константа c', min: 0, max: 12, step: 0.1, value: s.c, onInput: (v) => ((s.c = v), draw()) });
    const two = H('div', { class: 'plots-2' });
    w.main.appendChild(two);
    const pd = new GBC.Plot(two, { height: 270, x: { label: 'квартира (площадь, дес. м²)', domain: [0.5, 6.5] }, y: { label: 'цена, млн ₽', domain: [0, 12] } });
    const pl = new GBC.Plot(two, { height: 270, x: { label: 'прогноз c', domain: [0, 12] }, y: { label: 'потери L(c)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'l', label: 'L(c) сейчас' }, { key: 'best', label: 'лучшее c' }, { key: 'min', label: 'наименьшие потери' }]);
    function draw() {
      const Lz = LOSS[s.loss];
      const xs = [1, 2, 3, 4, 5, 6];
      pd.render([
        { type: 'segments', x1: xs, y1: Y, x2: xs, y2: xs.map(() => s.c), color: 'residual', width: 1.6, opacity: 0.9 },
        { type: 'hline', y: s.c, color: 'model', width: 2.4, draggable: true, text: 'c = ' + U.fmt(s.c, 2), onDrag: (v) => ((s.c = Math.round(U.clamp(v, 0, 12) * 10) / 10), csl.set(s.c), draw()) },
        { type: 'points', x: xs, y: Y, color: 'data', r: 5, tooltip: (i) => [['цена', String(Y[i])], ['остаток', U.fmt(Y[i] - s.c, 2)]] },
      ]);
      const cs = U.linspace(0, 12, 601);
      const ls = cs.map(Lz.f);
      const L = [{ type: 'line', x: cs, y: ls, color: 'tree', width: 2.4, hover: false }];
      if (s.loss === 'mse') L.push({ type: 'points', x: [6], y: [Lz.f(6)], color: 'ink', r: 6, hollow: true, tooltip: () => [['дно', 'c = 6 (среднее)'], ['L', U.fmt(Lz.f(6), 3)]] });
      else L.push({ type: 'segments', x1: [4], y1: [3], x2: [7], y2: [3], color: 'ink', width: 4, opacity: 0.8 });
      L.push({ type: 'points', x: [s.c], y: [Lz.f(s.c)], color: 'model', r: 6, tooltip: () => [['c', U.fmt(s.c, 2)], ['L(c)', U.fmt(Lz.f(s.c), 3)]] });
      pl.render(L, { y: [0, Math.max(...ls) * 1.05] });
      st.set('l', U.fmt(Lz.f(s.c), 3));
      st.set('best', s.loss === 'mse' ? '6 (среднее)' : 'любое из [4; 7]');
      st.set('min', s.loss === 'mse' ? U.fmt(64 / 6, 3) : '3');
      note.innerHTML = s.loss === 'mse'
        ? Lz.name + ' — <b>парабола</b> по c. Её дно — в среднем цен (2 + 4 + 3 + 7 + 9 + 11)/6 = 6, потери там 64/6 ≈ 10.67. Поэтому градиентный бустинг с квадратичными потерями начинает с F₀ = среднему. Найти дно — задача, ради которой нам нужна производная (урок 15.5).'
        : Lz.name + ' — <b>ломаная</b> с изломами в точках данных (кусочно-линейная функция). Её дно плоское: любое c от 4 до 7 даёт L = 3. Это медиана; при чётном числе точек медиан — целый отрезок. У ломаной в изломах нет одного наклона — отсюда особенности обучения с MAE (урок 3.2).';
    }
    w.pythonAction(() => 'import numpy as np\n\ny = np.array([2, 4, 3, 7, 9, 11.0])\nc = np.linspace(0, 12, 1201)\nmse = ((y[:, None] - c)**2).mean(axis=0)\nmae = np.abs(y[:, None] - c).mean(axis=0)\nprint("MSE: лучшее c =", c[mse.argmin()], " L =", mse.min().round(4), " (среднее:", y.mean(), ")")\nflat = c[np.isclose(mae, mae.min())]\nprint("MAE: L =", mae.min().round(4), "при c от", flat.min(), "до", flat.max(), " (медиана:", np.median(y), ")")\n');
    draw();
  });

  /* ==============================================================================
   * 13. Масштаб осей: логарифмическая шкала и обрезанная ось
   * ============================================================================== */
  GBC.widget('log-scale', (el) => {
    const s = { mode: 'log', series: 'loss', log: false, zero: false };
    const w = ui.shell(el, { title: 'Масштаб осей: как один и тот же график выглядит по-разному', sub: 'Данные не меняются — меняется только шкала. Научитесь замечать это до того, как делать выводы.' });
    ui.segmented(w.controls, { label: 'Пример', value: s.mode, options: [{ value: 'log', label: 'логарифмическая шкала' }, { value: 'cut', label: 'обрезанная ось' }], onChange: (v) => ((s.mode = v), build(), draw()) });
    const dyn = H('div');
    w.controls.appendChild(dyn);
    const plot = new GBC.Plot(w.main, { height: 310, x: { label: 'x' }, y: { label: 'y' } });
    const note = w.note('', true);
    const SER = {
      loss: { label: 'ошибка обучения по итерациям', f: (m) => 5 * 0.9 ** m + 0.05, n: 80, xl: 'итерация m', yl: 'ошибка' },
      grow: { label: 'удвоение: 2ˣ', f: (x) => 2 ** x, n: 20, xl: 'шаг x', yl: '2ˣ' },
    };
    function build() {
      dyn.textContent = '';
      if (s.mode === 'log') {
        ui.select(dyn, { label: 'Данные', value: s.series, options: Object.entries(SER).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.series = v), draw()) });
        ui.toggle(dyn, { label: 'Логарифмическая шкала по y', checked: s.log, onChange: (v) => ((s.log = v), draw()) });
      } else ui.toggle(dyn, { label: 'Ось y от нуля', checked: s.zero, onChange: (v) => ((s.zero = v), draw()) });
    }
    build();
    function draw() {
      if (s.mode === 'log') {
        const S = SER[s.series];
        const xs = U.range(S.n + 1);
        const ys = xs.map(S.f);
        const lo = Math.min(...ys);
        const hi = Math.max(...ys);
        plot.opts.y = { label: S.yl + (s.log ? ' (лог. шкала)' : ''), type: s.log ? 'log' : undefined, domain: s.log ? [Math.pow(10, Math.floor(Math.log10(lo))), Math.pow(10, Math.ceil(Math.log10(hi)))] : [0, hi * 1.05] };
        plot.opts.x = { label: S.xl, domain: [0, S.n] };
        plot.render([
          { type: 'line', x: xs, y: ys, color: 'model', width: 2.2, hover: false },
          { type: 'points', x: xs, y: ys, color: 'model', r: 2.5, tooltip: (i) => [[S.xl, String(xs[i])], [S.yl, U.fmt(ys[i], 4)]] },
        ]);
        note.innerHTML = s.series === 'grow'
          ? (s.log ? 'На логарифмической шкале каждая метка — в 10 раз больше предыдущей, и экспонента 2ˣ стала <b>прямой</b>: одинаковое умножение на каждом шаге = одинаковый подъём. Так проверяют «экспоненциальный ли рост».' : 'На обычной шкале первые 10 шагов 2ˣ (до 1024) сливаются с нулём рядом с 2²⁰ ≈ 1 000 000. Включите логарифмическую шкалу.')
          : (s.log ? 'Теперь видно, что ошибка падает как прямая (экспоненциально) до итерации ~40, а потом выходит на «полку» 0.05 — дальше обучение почти ничего не даёт. Кривые обучения бустинга часто рисуют именно так.' : 'На обычной шкале после итерации 30 кажется, что ошибка уже не меняется — всё сливается у нуля. Включите логарифмическую шкалу: она растягивает маленькие значения.');
      } else {
        const acc = [0.912, 0.918];
        plot.opts.y = { label: 'доля верных ответов', domain: s.zero ? [0, 1] : [0.91, 0.92] };
        plot.opts.x = { label: '', domain: [0.4, 2.6], ticks: [1, 2], format: (v) => (v === 1 ? 'модель A' : 'модель B') };
        plot.render([
          { type: 'bars', x: [1, 2], y: acc, base: s.zero ? 0 : 0.91, color: (i) => (i ? 'tree' : 'model'), width: 0.6, maxPx: 90, tooltip: (i) => [['точность', String(acc[i])]] },
          { type: 'text', items: acc.map((a, i) => ({ x: i + 1, y: a, dy: -8, anchor: 'middle', text: String(a) })) },
        ]);
        note.innerHTML = s.zero
          ? 'От нуля: столбики почти одинаковые — честная картина. Разница 0.6 процентного пункта (0.918 против 0.912) может оказаться и случайной (урок 15.14).'
          : 'Ось начинается с 0.91: столбик B выглядит <b>в 4 раза выше</b>, хотя разница — 0.006. Обрезанная ось преувеличивает различия. Всегда смотрите на числа на оси, прежде чем сравнивать высоты.';
      }
    }
    draw();
  });
})();
