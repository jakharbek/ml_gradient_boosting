/* Урок 15.7: вторая производная, выпуклость, Тейлор и Ньютон. Часть 2 — ряд Тейлора, метод Ньютона, второй порядок в бустинге.
 * Виджеты: подбор параболы, многочлен Тейлора с центром и радиусом сходимости, порядок ошибки на лог-лог шкале,
 * вычисления рядами, шаг Ньютона, метод касательных, Ньютон против спуска, ремонт Ньютона, парабола потерь объекта,
 * значение листа, прирост разбиения, бустинг одного числа, тренажёр.
 * Помощники — из lesson.js (GBC.lesson157). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const { curve, yRange, sigma, softplus, f2, f3, f4, py, rowTable, choiceButtons, dname, fact, PY_HEAD, powFmt, sci } = GBC.lesson157;

  /* ==============================================================================
   * 16. От касательной к параболе: подбор коэффициента c₂
   * ============================================================================== */
  const FP = {
    sqrt: { label: '√x около a = 4', a: 4, win: 3, f: Math.sqrt, d: (x) => 0.5 / Math.sqrt(x), d2: (x) => -0.25 / x ** 1.5, c: [-0.1, 0.1, 0.001], py: ['np.sqrt(x)', '0.5 / np.sqrt(a)', '-0.25 / a**1.5'] },
    exp: { label: 'eˣ около a = 0', a: 0, win: 2, f: Math.exp, d: Math.exp, d2: Math.exp, c: [-1, 2, 0.01], py: ['np.exp(x)', 'np.exp(a)', 'np.exp(a)'] },
    cos: { label: 'cos x около a = 0', a: 0, win: 3, f: Math.cos, d: (x) => -Math.sin(x), d2: (x) => -Math.cos(x), c: [-1.5, 1, 0.01], py: ['np.cos(x)', '-np.sin(a)', '-np.cos(a)'] },
    ln: { label: 'ln(1 + x) около a = 0', a: 0, win: 0.9, f: (x) => (x > -1 ? Math.log1p(x) : NaN), d: (x) => 1 / (1 + x), d2: (x) => -1 / (1 + x) ** 2, c: [-1.5, 1, 0.01], py: ['np.log1p(x)', '1 / (1 + a)', '-1 / (1 + a)**2'] },
    ll: { label: 'log-loss ln(1 + e^(−F)) около 0', a: 0, win: 4, f: (x) => softplus(-x), d: (x) => sigma(x) - 1, d2: (x) => sigma(x) * (1 - sigma(x)), c: [-0.5, 0.5, 0.005], py: ['np.log1p(np.exp(-x))', '1 / (1 + np.exp(-a)) - 1', 'np.exp(-a) / (1 + np.exp(-a))**2'] },
  };
  GBC.widget('fit-parabola', (el) => {
    const s = { fn: 'exp', c2: 0 };
    const w = ui.shell(el, { title: 'Подберите параболу: какой нужен c₂?', sub: 'Парабола f(a) + f′(a)·Δ + c₂·Δ² — значение и наклон уже правильные. Двигайте c₂ и смотрите на ошибку внизу. Лучший c₂ — тот, при котором ошибка около Δ = 0 прижимается к нулю сильнее всего.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(FP).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.fn = v;
      const C = FP[v].c;
      cs.input.min = C[0];
      cs.input.max = C[1];
      cs.input.step = C[2];
      s.c2 = 0;
      cs.set(0);
      draw();
    } });
    const cs = ui.slider(w.controls, { label: 'Коэффициент c₂', min: -1, max: 2, step: 0.01, value: s.c2, format: (v) => U.fmt(v, 4), onInput: (v) => ((s.c2 = v), draw()) });
    ui.button(w.controls, { label: 'c₂ = f″(a)/2', kind: 'primary', onClick: () => {
      const F = FP[s.fn];
      s.c2 = F.d2(F.a) / 2;
      cs.set(s.c2);
      draw();
    } });
    ui.button(w.controls, { label: 'c₂ = 0 (касательная)', onClick: () => ((s.c2 = 0), cs.set(0), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'сдвиг Δ = x − a' }, y: { label: 'ошибка P − f' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'ваш c₂' }, { key: 'b', label: 'f″(a)/2' }, { key: 'e1', label: 'ошибка при Δ = 0.1' }, { key: 'e2', label: 'ошибка при Δ = 0.01' }]);
    function draw() {
      const F = FP[s.fn];
      const a = F.a;
      const fa = F.f(a);
      const d = F.d(a);
      const best = F.d2(a) / 2;
      const P = (x, c) => fa + d * (x - a) + c * (x - a) ** 2;
      const lo = a - F.win;
      const hi = a + F.win;
      const grid = U.linspace(lo, hi, 400);
      p1.render([
        { type: 'line', x: grid, y: grid.map(F.f), color: 'model', width: 2.6, label: 'f', hover: false },
        { type: 'line', x: grid, y: grid.map((x) => P(x, 0)), color: 'tree', width: 1.6, label: 'касательная', hover: false },
        { type: 'line', x: grid, y: grid.map((x) => P(x, s.c2)), color: 'violet', width: 2.2, dash: '6 4', label: 'ваша парабола', hover: false },
        { type: 'points', x: [a], y: [fa], color: 'tree', r: 6 },
      ], { x: [lo, hi], y: yRange(F.f, grid, 0.3) });
      const ds = U.linspace(-F.win, F.win, 400);
      const err = ds.map((t) => P(a + t, s.c2) - F.f(a + t));
      const errB = ds.map((t) => P(a + t, best) - F.f(a + t));
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: ds, y: errB, color: 'muted', width: 1.6, dash: '4 3', label: 'при c₂ = f″/2', hover: false },
        { type: 'line', x: ds, y: err, color: 'violet', width: 2.2, label: 'ваша ошибка', hover: false },
      ], { x: [-F.win, F.win], y: yRange([(t) => P(a + t, s.c2) - F.f(a + t), (t) => P(a + t, best) - F.f(a + t)], ds, 0.15) });
      const e1 = Math.abs(P(a + 0.1, s.c2) - F.f(a + 0.1));
      const e2 = Math.abs(P(a + 0.01, s.c2) - F.f(a + 0.01));
      st.set('c', U.fmt(s.c2, 4));
      st.set('b', U.fmt(best, 4));
      st.set('e1', U.fmt(e1, 2));
      st.set('e2', U.fmt(e2, 2));
      const close = Math.abs(s.c2 - best) < Math.max(1e-3, Math.abs(best) * 0.02);
      note.innerHTML = close
        ? '<b>Попали:</b> c₂ = f″(a)/2. Ошибка теперь порядка Δ³ (или выше): уменьшили Δ в 10 раз (0.1 → 0.01) — ошибка упала в ' + U.fmt(e1 / Math.max(e2, 1e-300), 0) + ' раз. Кривая ошибки касается нуля «плоско».'
        : 'Ошибка ≈ (c₂ − f″/2)·Δ² = ' + U.fmt(s.c2 - best, 3) + '·Δ²: кривая ошибки — парабола. Уменьшили Δ в 10 раз — ошибка упала лишь в ' + U.fmt(e1 / Math.max(e2, 1e-300), 0) + ' раз. Нужен c₂ = ' + U.fmt(best, 4) + '.';
    }
    w.pythonAction(() => {
      const F = FP[s.fn];
      return 'import numpy as np\n\na = ' + F.a + '\nf = lambda x: ' + F.py[0] + '\nd1, d2 = ' + F.py[1] + ', ' + F.py[2] + '\nfor c2 in [0, ' + py(s.c2) + ', d2 / 2]:\n    P = lambda x: f(a) + d1 * (x - a) + c2 * (x - a) ** 2\n    e = [abs(P(a + d) - f(a + d)) for d in (0.1, 0.01, 0.001)]\n    print(f"c₂ = {c2:+.4f}: ошибки при Δ = 0.1, 0.01, 0.001: {e[0]:.1e} {e[1]:.1e} {e[2]:.1e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 17, 20. Многочлен Тейлора: центр a, степень n, радиус сходимости
   * ============================================================================== */
  /** Производные сигмоиды как многочлены от s = σ: P₀ = s, Pⱼ₊₁(s) = Pⱼ′(s)·s(1 − s). */
  const SIGP = (() => {
    const out = [[0, 1]];
    for (let j = 0; j < 14; j++) {
      const P = out[j];
      const dP = P.slice(1).map((c, i) => c * (i + 1));
      const r = new Array(dP.length + 2).fill(0);
      dP.forEach((c, i) => {
        r[i + 1] += c;
        r[i + 2] -= c;
      });
      out.push(r);
    }
    return out;
  })();
  const sigDer = (k, a) => {
    const s0 = sigma(a);
    return SIGP[k].reduce((acc, c, i) => acc + c * s0 ** i, 0);
  };
  const TY = {
    exp: { label: 'eˣ', f: Math.exp, der: (k, a) => Math.exp(a), dom: [-4, 4], ydom: [-2, 14], aR: [-2, 2], R: () => Infinity, py: ['np.exp(x)', 'def der(k, a):\n    return math.exp(a)'], txt: 'Все производные eˣ равны eˣ: многочлены сходятся к функции на всей прямой, но вдали от центра нужно много членов.' },
    sin: { label: 'sin x', f: Math.sin, der: (k, a) => Math.sin(a + (k * Math.PI) / 2), dom: [-9, 9], ydom: [-2.5, 2.5], aR: [-3, 3], R: () => Infinity, py: ['np.sin(x)', 'def der(k, a):\n    return math.sin(a + k * math.pi / 2)'], txt: 'Около 0 у синуса только нечётные степени: степени 1 и 2 дают одинаковый многочлен x, 3 и 4 — x − x³/6. Сходится везде.' },
    cos: { label: 'cos x', f: Math.cos, der: (k, a) => Math.cos(a + (k * Math.PI) / 2), dom: [-9, 9], ydom: [-2.5, 2.5], aR: [-3, 3], R: () => Infinity, py: ['np.cos(x)', 'def der(k, a):\n    return math.cos(a + k * math.pi / 2)'], txt: 'Около 0 у косинуса только чётные степени: 1 − x²/2 + x⁴/24 − … Сходится везде.' },
    ln: { label: 'ln(1 + x)', f: (x) => (x > -1 ? Math.log1p(x) : NaN), der: (k, a) => (k === 0 ? Math.log1p(a) : ((k % 2 ? 1 : -1) * fact(k - 1)) / (1 + a) ** k), dom: [-1.5, 4], ydom: [-3, 2.5], aR: [-0.5, 2], R: (a) => 1 + a, py: ['np.log1p(x)', 'def der(k, a):\n    return math.log1p(a) if k == 0 else (-1) ** (k - 1) * math.factorial(k - 1) / (1 + a) ** k'], txt: 'Радиус сходимости — расстояние до особой точки x = −1. Правее границы многочлены разлетаются, сколько членов ни бери. Сдвиньте центр вправо — граница отодвинется.' },
    geom: { label: '1 / (1 − x)', f: (x) => (Math.abs(1 - x) > 1e-9 ? 1 / (1 - x) : NaN), der: (k, a) => fact(k) / (1 - a) ** (k + 1), dom: [-2.5, 2.5], ydom: [-6, 8], aR: [-1.5, 0.6], R: (a) => Math.abs(1 - a), py: ['1 / (1 - x)', 'def der(k, a):\n    return math.factorial(k) / (1 - a) ** (k + 1)'], txt: 'Геометрический ряд 1 + x + x² + …: сходится только при |x| &lt; 1 (при центре 0). Особая точка — полюс x = 1.' },
    sqrt: { label: '√(1 + x)', f: (x) => (x >= -1 ? Math.sqrt(1 + x) : NaN), der: (k, a) => { let c = 1; for (let j = 0; j < k; j++) c *= 0.5 - j; return c * (1 + a) ** (0.5 - k); }, dom: [-1.5, 4], ydom: [-1, 3.5], aR: [-0.5, 2], R: (a) => 1 + a, py: ['np.sqrt(1 + x)', 'def der(k, a):\n    return math.prod(0.5 - j for j in range(k)) * (1 + a) ** (0.5 - k)'], txt: 'Биномиальный ряд 1 + x/2 − x²/8 + …: радиус — расстояние до x = −1, где у корня вертикальная касательная.' },
    ll: { label: 'log-loss ln(1 + e^(−x))', f: (x) => softplus(-x), der: (k, a) => (k === 0 ? softplus(-a) : k === 1 ? sigma(a) - 1 : sigDer(k - 1, a)), dom: [-7, 7], ydom: [-1, 8], aR: [-3, 3], R: (a) => Math.hypot(a, Math.PI), py: ['np.log1p(np.exp(-x))', 'def der(k, a):\n    s = 1 / (1 + math.exp(-a))\n    if k == 0:\n        return math.log1p(math.exp(-a))\n    if k == 1:\n        return s - 1\n    P = np.polynomial.Polynomial([0, 1])  # σ как многочлен от s\n    for _ in range(k - 1):\n        P = P.deriv() * np.polynomial.Polynomial([0, 1, -1])  # d/dF = d/ds · s(1 − s)\n    return P(s)'], txt: 'XGBoost берёт первые три члена: ln 2 − F/2 + F²/8. Радиус сходимости около 0 равен π: у log-loss «невидимые» особые точки F = ±iπ на комплексной плоскости.' },
    runge: { label: '1 / (1 + x²)', f: (x) => 1 / (1 + x * x), der: (k, a) => { const r = Math.hypot(1, a); const ph = Math.atan2(1, a); return ((k % 2 ? -1 : 1) * fact(k) * Math.sin((k + 1) * ph)) / r ** (k + 1); }, dom: [-3, 3], ydom: [-1, 2], aR: [-2, 2], R: (a) => Math.hypot(1, a), py: ['1 / (1 + x**2)', 'def der(k, a):\n    r, phi = math.hypot(1, a), math.atan2(1, a)\n    return (-1) ** k * math.factorial(k) * math.sin((k + 1) * phi) / r ** (k + 1)'], txt: 'Функция гладкая на всей прямой, а ряд около 0 сходится только при |x| &lt; 1: мешают комплексные особые точки ±i. Радиус — √(1 + a²): сдвиньте центр, и область сходимости вырастет.' },
    flat: { label: 'e^(−1/x²) — все производные в 0 равны 0', f: (x) => (x === 0 ? 0 : Math.exp(-1 / (x * x))), der: () => 0, dom: [-3, 3], ydom: [-0.3, 1.2], aR: [0, 0], R: () => 0, py: ['math.exp(-1 / x**2) if x != 0 else 0.0', 'def der(k, a):\n    return 0.0  # все производные e^(−1/x²) в нуле равны нулю'], txt: 'Все производные в нуле равны 0, поэтому многочлен Тейлора любой степени — тождественный ноль. Функция бесконечно гладкая, но не «аналитическая»: ряд Тейлора её не описывает.' },
  };
  GBC.widget('taylor', (el, cfg) => {
    const s = { fn: cfg.fn || 'exp', n: cfg.n ?? 2, x: cfg.x ?? 1, a: cfg.a ?? 0 };
    const w = ui.shell(el, { title: 'Многочлен Тейлора: функция из производных в одной точке', sub: 'Синяя — функция, фиолетовая — многочлен степени n, построенный только по производным в центре a (оранжевая точка). Бирюзовая полоса — где ряд сходится к функции. Нажмите ▶, чтобы добавлять члены.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(TY).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.fn = v;
      const T = TY[v];
      s.a = U.clamp(0, T.aR[0], T.aR[1]);
      as.input.min = T.aR[0];
      as.input.max = T.aR[1];
      as.set(s.a);
      xs.input.min = T.dom[0];
      xs.input.max = T.dom[1];
      s.x = U.clamp(s.x, T.dom[0], T.dom[1]);
      xs.set(s.x);
      draw();
    } });
    const as = ui.slider(w.controls, { label: 'Центр a', min: TY[s.fn].aR[0], max: TY[s.fn].aR[1], step: 0.05, value: s.a, onInput: (v) => ((s.a = v), draw()) });
    ui.player(w.controls, { label: 'Степень n', min: 0, max: 14, value: s.n, fps: 1.2, format: (v) => 'n = ' + v, onChange: (v) => ((s.n = v), draw()) });
    const xs = ui.slider(w.controls, { label: 'Проверить в точке x', min: TY[s.fn].dom[0], max: TY[s.fn].dom[1], step: 0.05, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'y' } });
    const tblBox = H('div', { style: 'max-height:230px;overflow:auto' });
    w.main.appendChild(tblBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'f(x)' }, { key: 'p', label: 'Pₙ(x)' }, { key: 'e', label: 'ошибка' }, { key: 'R', label: 'радиус сходимости' }]);
    function draw() {
      const T = TY[s.fn];
      as.el.style.display = T.aR[0] === T.aR[1] ? 'none' : '';
      const a = U.clamp(s.a, T.aR[0], T.aR[1]);
      const coef = U.range(s.n + 1).map((k) => T.der(k, a) / fact(k));
      const P = (x) => coef.reduce((acc, c, k) => acc + c * (x - a) ** k, 0);
      const span = T.ydom[1] - T.ydom[0];
      const clip = (v) => (Number.isFinite(v) && v > T.ydom[0] - span && v < T.ydom[1] + span ? v : NaN);
      const fc = curve((x) => clip(T.f(x)), T.dom[0], T.dom[1], 801, { jump: span * 0.8 });
      const R = T.R(a);
      const band = Number.isFinite(R) && R > 0 ? { type: 'vband', x0: Math.max(T.dom[0], a - R), x1: Math.min(T.dom[1], a + R), color: 'aqua', opacity: 0.12 } : null;
      const grid = U.linspace(T.dom[0], T.dom[1], 801);
      plot.render([
        band,
        { type: 'line', x: fc.x, y: fc.y, color: 'model', width: 2.6, label: 'f(x)', hover: false },
        { type: 'line', x: grid, y: grid.map((x) => clip(P(x))), color: 'violet', width: 2.2, dash: '6 4', label: 'многочлен степени ' + s.n, hover: false },
        { type: 'vline', x: s.x, color: 'ink2', width: 1, dash: '3 3' },
        { type: 'points', x: [a], y: [T.f(a)], color: 'tree', r: 6 },
      ], { x: T.dom, y: T.ydom });
      rowTable(tblBox, ['k', dname(0) + '⁽ᵏ⁾(a)', 'k!', 'коэффициент cₖ', 'член cₖ·(x − a)ᵏ'], coef.map((c, k) => [String(k), U.fmt(T.der(k, a), 4), String(fact(k)), U.fmt(c, 5), U.fmt(c * (s.x - a) ** k, 5)]), (i) => i === s.n);
      const fx = T.f(s.x);
      const px = P(s.x);
      st.set('f', U.fmt(fx, 6));
      st.set('p', U.fmt(px, 6));
      st.set('e', Number.isFinite(fx) ? sci(Math.abs(fx - px)) : '—');
      st.set('R', R === Infinity ? '∞' : R === 0 ? '0 (ряд бесполезен)' : f3(R));
      const out = Number.isFinite(R) && Math.abs(s.x - a) > R;
      note.innerHTML = T.txt + (out ? ' <b>Точка x = ' + f2(s.x) + ' вне радиуса сходимости:</b> добавление членов здесь только ухудшает приближение.' : '');
    }
    w.pythonAction(() => {
      const T = TY[s.fn];
      return 'import math\nimport numpy as np\n\nf = lambda x: ' + T.py[0] + '\n' + T.py[1] + '\n\na, x = ' + py(s.a) + ', ' + py(s.x) + '\nP = 0.0\nfor n in range(' + Math.max(s.n + 1, 8) + '):\n    P += der(n, a) / math.factorial(n) * (x - a) ** n\n    print(f"n = {n:2}: Pₙ(x) = {P: .8f}   ошибка {abs(f(x) - P):.2e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 18. Порядок ошибки: |f − Pₙ| на двойной логарифмической шкале
   * ============================================================================== */
  const TE = {
    exp: { label: 'eˣ около 0', T: 'exp', a: 0 },
    sin: { label: 'sin x около 0', T: 'sin', a: 0 },
    ln: { label: 'ln(1 + x) около 0', T: 'ln', a: 0 },
    sqrt: { label: '√(1 + x) около 0', T: 'sqrt', a: 0 },
    ll: { label: 'log-loss около 0', T: 'll', a: 0 },
  };
  GBC.widget('taylor-error', (el) => {
    const s = { fn: 'exp' };
    const NMAX = 4;
    const w = ui.shell(el, { title: 'Ошибка многочлена Тейлора: прямая с наклоном n + 1', sub: 'По горизонтали — сдвиг Δ от центра, по вертикали — ошибка |f(a + Δ) − Pₙ(a + Δ)|, обе оси логарифмические. Ошибка порядка Δⁿ⁺¹ выглядит прямой с наклоном n + 1.', foot: false });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(TE).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 330, margin: { left: 64 }, x: { label: 'сдвиг Δ', type: 'log', domain: [0.01, 1], ticks: [0.01, 0.03, 0.1, 0.3, 1], format: powFmt }, y: { label: 'ошибка', type: 'log', domain: [1e-16, 10], ticks: [1e-15, 1e-12, 1e-9, 1e-6, 1e-3, 1], format: powFmt } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const E = TE[s.fn];
      const T = TY[E.T];
      const a = E.a;
      const ds = [];
      for (let e = -2; e <= 0.0001; e += 0.04) ds.push(Math.pow(10, e));
      const layers = [];
      const rows = [];
      for (let n = 0; n <= NMAX; n++) {
        const coef = U.range(n + 1).map((k) => T.der(k, a) / fact(k));
        const P = (x) => coef.reduce((acc, c, k) => acc + c * (x - a) ** k, 0);
        const err = (d) => Math.max(Math.abs(T.f(a + d) - P(a + d)), 1e-17);
        layers.push({ type: 'line', x: ds, y: ds.map(err), color: GBC.colors.series(n), width: 2.2, label: 'n = ' + n });
        const slope = Math.log(err(0.1) / err(0.05)) / Math.log(2);
        let k = n + 1;
        while (k < 20 && Math.abs(T.der(k, a)) < 1e-12) k++;
        rows.push([String(n), U.fmt(slope, 2), String(k), sci(err(0.1)), k > n + 1 ? 'член порядка ' + (n + 1) + ' равен нулю' : '']);
      }
      plot.render(layers);
      rowTable(tbl, ['степень n', 'наклон (измерен)', 'ожидается', 'ошибка при Δ = 0.1', 'почему'], rows, null);
      const T2 = {
        exp: 'Все коэффициенты ненулевые: наклоны 1, 2, 3, 4, 5. При Δ = 0.01 парабола (n = 2) ошибается на ~1.7·10⁻⁷, кубика — на ~4·10⁻¹⁰.',
        sin: 'У синуса чётных членов нет: P₁ = P₂ = x, P₃ = P₄. Поэтому наклоны 3, 3, 5, 5 вместо 2, 3, 4, 5 — «бесплатный» лишний порядок точности.',
        ln: 'Наклоны 1, 2, 3, 4, 5. Но при Δ → 1 линии сходятся: у границы радиуса сходимости ряд работает плохо.',
        sqrt: 'Биномиальный ряд: наклоны 1, 2, 3, 4, 5 — коэффициенты 1, ½, −⅛, 1/16, −5/128 ненулевые.',
        ll: 'Ряд log-loss: ln 2 − F/2 + F²/8 + 0·F³ − F⁴/192 … Коэффициент при F³ равен нулю, поэтому парабола XGBoost (n = 2) ошибается как Δ⁴, а не Δ³.',
      };
      note.innerHTML = T2[s.fn] + ' Измеренный наклон — по точкам Δ = 0.05 и 0.1.';
    }
    w.pythonAction(() => {
      const T = TY[TE[s.fn].T];
      return 'import math\nimport numpy as np\n\nf = lambda x: ' + T.py[0] + '\n' + T.py[1] + '\n\na = 0.0\nfor n in range(5):\n    c = [der(k, a) / math.factorial(k) for k in range(n + 1)]\n    P = lambda x: sum(ck * (x - a) ** k for k, ck in enumerate(c))\n    e1, e2 = abs(f(a + 0.1) - P(a + 0.1)), abs(f(a + 0.05) - P(a + 0.05))\n    print(f"n = {n}: ошибка при Δ = 0.1: {e1:.2e}, наклон ≈ {math.log2(e1 / e2):.2f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 19. Вычисления рядами: член за членом
   * ============================================================================== */
  const binom = (al, k) => {
    let c = 1;
    for (let j = 0; j < k; j++) c *= (al - j) / (j + 1);
    return c;
  };
  const TC = {
    e: { label: 'e = 1 + 1 + 1/2! + 1/3! + …', term: (k) => 1 / fact(k), exact: Math.E, bound: (n) => 3 / fact(n), py: '1 / math.factorial(k)', txt: 'Оценка Лагранжа: ошибка после n членов меньше 3/n!. Каждый член в k раз меньше предыдущего — сходимость очень быстрая.' },
    sqrt: { label: '√4.1 = 2·√(1 + 0.025)', term: (k) => 2 * binom(0.5, k) * 0.025 ** k, exact: Math.sqrt(4.1), bound: null, py: '2 * math.comb_half(k) * 0.025 ** k', txt: 'Биномиальный ряд при маленьком x = 0.025: каждый член примерно в 80 раз меньше предыдущего. Двух членов (касательная) хватает на 4 знака, трёх (парабола) — на 6.' },
    sin: { label: 'sin 0.5 = 0.5 − 0.5³/3! + 0.5⁵/5! − …', term: (k) => ((k % 2 ? -1 : 1) * 0.5 ** (2 * k + 1)) / fact(2 * k + 1), exact: Math.sin(0.5), bound: (n) => 0.5 ** (2 * n + 1) / fact(2 * n + 1), py: '(-1) ** k * 0.5 ** (2 * k + 1) / math.factorial(2 * k + 1)', txt: 'Знакочередующийся ряд с убывающими членами: ошибка меньше первого отброшенного члена (пунктир) — и почти равна ему.' },
    cos: { label: 'cos 1 = 1 − 1/2! + 1/4! − …', term: (k) => (k % 2 ? -1 : 1) / fact(2 * k), exact: Math.cos(1), bound: (n) => 1 / fact(2 * n), py: '(-1) ** k / math.factorial(2 * k)', txt: 'Даже при x = 1 (далеко от «малого угла») хватает 5–6 членов для 10 знаков: факториал в знаменателе растёт быстрее любой степени.' },
    ln15: { label: 'ln 1.5 = 0.5 − 0.5²/2 + 0.5³/3 − …', term: (k) => ((k % 2 ? -1 : 1) * 0.5 ** (k + 1)) / (k + 1), exact: Math.log(1.5), bound: (n) => 0.5 ** (n + 1) / (n + 1), py: '(-1) ** k * 0.5 ** (k + 1) / (k + 1)', txt: 'x = 0.5 — половина радиуса сходимости: каждый член примерно вдвое меньше предыдущего, один верный знак — за 3–4 члена.' },
    ln2s: { label: 'ln 2 = 1 − 1/2 + 1/3 − … (медленно)', term: (k) => (k % 2 ? -1 : 1) / (k + 1), exact: Math.LN2, bound: (n) => 1 / (n + 1), py: '(-1) ** k / (k + 1)', txt: 'x = 1 — на самой границе сходимости. После 30 членов ошибка ещё ~0.016, после 1000 — 5·10⁻⁴: каждый новый знак стоит в 10 раз больше работы.' },
    ln2f: { label: 'ln 2 = 2·(⅓ + ⅓³/3 + ⅓⁵/5 + …) (быстро)', term: (k) => (2 * (1 / 3) ** (2 * k + 1)) / (2 * k + 1), exact: Math.LN2, bound: null, py: '2 * (1 / 3) ** (2 * k + 1) / (2 * k + 1)', txt: 'Ряд ln((1 + x)/(1 − x)) при x = ⅓: каждый член примерно в 9 раз меньше предыдущего. Тот же ln 2, но 6 членов дают 7 знаков.' },
  };
  GBC.widget('taylor-calc', (el) => {
    const s = { t: 'ln2s', n: 6 };
    const w = ui.shell(el, { title: 'Считаем рядами: член за членом', sub: 'Таблица — члены ряда, частичные суммы и ошибка. График — ошибка в зависимости от числа членов (логарифмическая шкала): чем круче падает линия, тем быстрее сходится ряд.' });
    ui.select(w.controls, { label: 'Задача', value: s.t, options: Object.entries(TC).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.t = v), draw()) });
    ui.player(w.controls, { label: 'Членов ряда', min: 1, max: 30, value: s.n, fps: 3, format: (v) => v + ' чл.', onChange: (v) => ((s.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 240, margin: { left: 64 }, x: { label: 'число членов', domain: [0.5, 30.5] }, y: { label: 'ошибка (лог. шкала)', type: 'log', domain: [1e-17, 10], ticks: [1e-15, 1e-12, 1e-9, 1e-6, 1e-3, 1], format: powFmt } });
    const tblBox = H('div', { style: 'max-height:240px;overflow:auto' });
    w.main.appendChild(tblBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 's', label: 'частичная сумма' }, { key: 'x', label: 'точно' }, { key: 'e', label: 'ошибка' }]);
    function draw() {
      const T = TC[s.t];
      const sums = [];
      let acc = 0;
      for (let k = 0; k < 30; k++) {
        acc += T.term(k);
        sums.push(acc);
      }
      const ns = U.range(30, 1);
      const errs = sums.map((v) => Math.max(Math.abs(v - T.exact), 1e-17));
      plot.render([
        { type: 'line', x: ns, y: errs, color: 'model', width: 2.2, label: 'ошибка' },
        T.bound ? { type: 'line', x: ns, y: ns.map((n) => Math.max(T.bound(n), 1e-17)), color: 'muted', width: 1.6, dash: '5 4', label: 'оценка', hover: false } : null,
        { type: 'points', x: [s.n], y: [errs[s.n - 1]], color: 'tree', r: 6 },
      ]);
      const rows = U.range(s.n).map((k) => [String(k + 1), sci(T.term(k), 3), U.fmt(sums[k], 10), sci(Math.abs(sums[k] - T.exact))]);
      rowTable(tblBox, ['член №', 'член', 'частичная сумма', 'ошибка'], rows, (i) => i === s.n - 1);
      st.set('s', U.fmt(sums[s.n - 1], 10));
      st.set('x', U.fmt(T.exact, 10));
      st.set('e', sci(Math.abs(sums[s.n - 1] - T.exact)));
      let extra = '';
      if (s.t === 'ln2s') {
        let a2 = 0;
        for (let k = 0; k < 1000; k++) a2 += (k % 2 ? -1 : 1) / (k + 1);
        extra = ' Проверка: 1000 членов → ошибка ' + U.fmt(Math.abs(a2 - Math.LN2), 2) + '.';
      }
      note.innerHTML = T.txt + extra;
    }
    w.pythonAction(() => {
      const T = TC[s.t];
      const exact = { e: 'math.e', sqrt: 'math.sqrt(4.1)', sin: 'math.sin(0.5)', cos: 'math.cos(1)', ln15: 'math.log(1.5)', ln2s: 'math.log(2)', ln2f: 'math.log(2)' }[s.t];
      const term = s.t === 'sqrt' ? '2 * binom(0.5, k) * 0.025 ** k' : T.py;
      return 'import math\n\ndef binom(al, k):\n    """Обобщённый биномиальный коэффициент C(al, k)."""\n    c = 1.0\n    for j in range(k):\n        c *= (al - j) / (j + 1)\n    return c\n\nS = 0.0\nfor k in range(' + s.n + '):\n    S += ' + term + '\n    print(f"{k + 1:2} чл.: {S:.12f}   ошибка {abs(S - ' + exact + '):.1e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 21. Шаг Ньютона: прыжок в дно параболы
   * ============================================================================== */
  const ll3 = { f: (x) => 2 * softplus(-x) + softplus(x), d: (x) => 2 * (sigma(x) - 1) + sigma(x), d2: (x) => 3 * sigma(x) * (1 - sigma(x)) };
  const NS = {
    ex: { label: 'eˣ − 2x (минимум ln 2)', f: (x) => Math.exp(x) - 2 * x, d: (x) => Math.exp(x) - 2, d2: Math.exp, dom: [-1.5, 2.6], x0: 2, opt: Math.LN2, py: ['np.exp(x) - 2 * x', 'np.exp(x) - 2', 'np.exp(x)'] },
    quad: { label: '2(x − 3)² + 1 — парабола', f: (x) => 2 * (x - 3) ** 2 + 1, d: (x) => 4 * (x - 3), d2: () => 4, dom: [-0.5, 6.5], x0: 0.5, opt: 3, py: ['2 * (x - 3)**2 + 1', '4 * (x - 3)', '4 + 0 * x'] },
    ll3: { label: 'log-loss трёх объектов (1, 1, 0)', f: ll3.f, d: ll3.d, d2: ll3.d2, dom: [-3, 4], x0: -2, opt: Math.LN2, py: ['2 * np.log1p(np.exp(-x)) + np.log1p(np.exp(x))', '3 / (1 + np.exp(-x)) - 2', '3 * np.exp(-x) / (1 + np.exp(-x))**2'] },
    q: { label: 'x⁴/4 − x (плоско у нуля)', f: (x) => x ** 4 / 4 - x, d: (x) => x ** 3 - 1, d2: (x) => 3 * x * x, dom: [-1, 2.6], x0: 2, opt: 1, py: ['x**4 / 4 - x', 'x**3 - 1', '3 * x**2'] },
    w: { label: 'x⁴ − 2x² (горб в нуле)', f: (x) => x ** 4 - 2 * x * x, d: (x) => 4 * x ** 3 - 4 * x, d2: (x) => 12 * x * x - 4, dom: [-1.8, 1.8], x0: 0.3, opt: 1, py: ['x**4 - 2 * x**2', '4 * x**3 - 4 * x', '12 * x**2 - 4'] },
  };
  GBC.widget('newton-step', (el) => {
    const s = { fn: 'ex', x: 2, eta: 0.3, hist: [] };
    const w = ui.shell(el, { title: 'Шаг Ньютона: прыжок в дно параболы', sub: 'В текущей точке строится парабола Тейлора (фиолетовый пунктир). Ньютон прыгает в её дно, градиентный спуск — на −η·f′ (бирюзовая стрелка). Тяните точку или делайте шаги.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(NS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.x = NS[v].x0), (s.hist = []), draw()) });
    ui.slider(w.controls, { label: 'Темп спуска η (для сравнения)', min: 0.05, max: 1, step: 0.05, value: s.eta, onInput: (v) => ((s.eta = v), draw()) });
    ui.button(w.controls, { label: 'Шаг Ньютона', kind: 'primary', icon: 'step', onClick: () => {
      const F = NS[s.fn];
      const h = F.d2(s.x);
      if (Math.abs(h) < 1e-12) return;
      s.hist.push(s.x);
      s.x = s.x - F.d(s.x) / h;
      draw();
    } });
    ui.button(w.controls, { label: 'Сброс', onClick: () => ((s.x = NS[s.fn].x0), (s.hist = []), draw()) });
    const plot = new GBC.Plot(w.main, { height: 330, x: { label: 'x' }, y: { label: 'f(x)' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'f′(x)' }, { key: 'd2', label: 'f″(x)' }, { key: 'D', label: 'Δ = −f′/f″' }, { key: 'e', label: '|x − x*|' }]);
    function draw() {
      const F = NS[s.fn];
      const x = s.x;
      const fx = F.f(x);
      const d = F.d(x);
      const d2 = F.d2(x);
      const D = -d / d2;
      const xn = x + D;
      const grid = U.linspace(F.dom[0], F.dom[1], 400);
      const yr = yRange(F.f, grid, 0.15);
      const span = F.dom[1] - F.dom[0];
      const pw = U.linspace(x - span * 0.45, x + span * 0.45, 160);
      const parab = (t) => fx + d * (t - x) + 0.5 * d2 * (t - x) ** 2;
      const xg = x - s.eta * d;
      const inDom = (t) => Number.isFinite(t) && t >= F.dom[0] && t <= F.dom[1];
      plot.render([
        { type: 'line', x: grid, y: grid.map(F.f), color: 'model', width: 2.4, label: 'f', hover: false },
        { type: 'line', x: pw, y: pw.map(parab), color: 'violet', width: 1.8, dash: '6 4', label: 'парабола Тейлора', hover: false },
        { type: 'vline', x: F.opt, color: 'muted', dash: '3 3', width: 1, text: 'минимум' },
        s.hist.length ? { type: 'points', x: s.hist.filter(inDom), y: s.hist.filter(inDom).map(F.f), color: 'muted', r: 4, hollow: true } : null,
        inDom(xn) ? { type: 'points', x: [xn], y: [parab(xn)], color: d2 > 0 ? 'violet' : 'red', r: 6, hollow: true } : null,
        inDom(xn) ? { type: 'arrows', x1: [x], y1: [fx], x2: [xn], y2: [parab(xn)], color: d2 > 0 ? 'violet' : 'red', width: 1.8 } : null,
        inDom(xg) ? { type: 'arrows', x1: [x], y1: [fx], x2: [xg], y2: [F.f(xg)], color: 'aqua', width: 1.8 } : null,
        { type: 'points', x: [x], y: [fx], color: 'tree', r: 7, draggable: true, onDrag: (i, nx) => ((s.x = Math.round(U.clamp(nx, F.dom[0], F.dom[1]) * 100) / 100), (s.hist = []), draw()) },
      ], { x: F.dom, y: yr });
      st.set('d', f4(d));
      st.set('d2', f4(d2));
      st.set('D', Number.isFinite(D) ? f4(D) : '—');
      st.set('e', sci(Math.abs(x - F.opt)));
      const rows = [...s.hist, x].map((v, k) => [String(k), U.fmt(v, 10), sci(Math.abs(v - F.opt))]);
      rowTable(tbl, ['шаг', 'x', '|x − x*|'], rows.slice(-6), (i) => i === Math.min(rows.length, 6) - 1);
      let msg;
      if (d2 <= 0) msg = '<b>f″ = ' + f3(d2) + ' ≤ 0:</b> парабола перевёрнута, и её «дно» — это вершина (красный кружок). Шаг Ньютона ведёт к максимуму — здесь метод без ремонта бесполезен (шаг 24).';
      else msg = 'Ньютон: x → ' + f4(xn) + ' (шаг ' + f4(D) + ' — это спуск с темпом η = 1/f″ = ' + f3(1 / d2) + '). Спуск с η = ' + U.fmt(s.eta, 2) + ': x → ' + f4(xg) + '.';
      if (s.fn === 'quad') msg += ' Для параболы шаг Ньютона из любой точки попадает точно в минимум x = 3: парабола Тейлора совпадает с функцией.';
      if (s.fn === 'q' && d2 > 0 && d2 < 0.5) msg += ' f″ почти ноль — парабола очень плоская, и шаг огромный.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const F = NS[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + F.py[0] + '\nd1 = lambda x: ' + F.py[1] + '\nd2 = lambda x: ' + F.py[2] + '\nx = ' + py(s.hist.length ? s.hist[0] : s.x) + '\nfor k in range(6):\n    print(f"шаг {k}: x = {x:.12f}, |x − x*| = {abs(x - ' + py(F.opt) + '):.2e}, f″ = {d2(x):.4f}")\n    x = x - d1(x) / d2(x)          # дно параболы f + f′Δ + ½f″Δ²\n';
    });
    draw();
  });

  /* ==============================================================================
   * 22. Метод касательных: Ньютон для уравнения g(x) = 0
   * ============================================================================== */
  const NR = {
    sqrt2: { label: 'x² − 2 = 0 (√2, метод Герона)', g: (x) => x * x - 2, dg: (x) => 2 * x, dom: [-0.5, 3.2], x0: 1, root: Math.SQRT2, py: ['x**2 - 2', '2 * x'] },
    cos: { label: 'cos x − x = 0', g: (x) => Math.cos(x) - x, dg: (x) => -Math.sin(x) - 1, dom: [-1, 2.2], x0: 1, root: 0.7390851332151607, py: ['np.cos(x) - x', '-np.sin(x) - 1'] },
    ex: { label: 'eˣ − 2 = 0 (это f′ = 0 для eˣ − 2x)', g: (x) => Math.exp(x) - 2, dg: Math.exp, dom: [-1, 2.6], x0: 2, root: Math.LN2, py: ['np.exp(x) - 2', 'np.exp(x)'] },
    cyc: { label: 'x³ − 2x + 2 = 0 (цикл из 0)', g: (x) => x ** 3 - 2 * x + 2, dg: (x) => 3 * x * x - 2, dom: [-2.5, 2], x0: 0, root: -1.7692923542386314, py: ['x**3 - 2 * x + 2', '3 * x**2 - 2'] },
    atan: { label: 'arctg x = 0 (порог около 1.39)', g: Math.atan, dg: (x) => 1 / (1 + x * x), dom: [-6, 6], x0: 1.5, root: 0, py: ['np.arctan(x)', '1 / (1 + x**2)'] },
    cbrt: { label: '∛x = 0 (разбегается всегда)', g: Math.cbrt, dg: (x) => 1 / (3 * Math.cbrt(x * x)), dom: [-9, 9], x0: 1, root: 0, py: ['np.cbrt(x)', '1 / (3 * np.cbrt(x**2))'] },
  };
  GBC.widget('newton-root', (el) => {
    const s = { fn: 'sqrt2', x0: 1, k: 3 };
    const K = 10;
    const w = ui.shell(el, { title: 'Метод касательных', sub: 'Из точки на графике g проводим касательную (оранжевая) до пересечения с осью x — это следующее приближение. Потом поднимаемся к графику (пунктир) и повторяем.', foot: false });
    ui.select(w.controls, { label: 'Уравнение', value: s.fn, options: Object.entries(NR).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.fn = v;
      s.x0 = NR[v].x0;
      x0s.input.min = NR[v].dom[0];
      x0s.input.max = NR[v].dom[1];
      x0s.set(s.x0);
      draw();
    } });
    const x0s = ui.slider(w.controls, { label: 'Старт x₀', min: NR[s.fn].dom[0], max: NR[s.fn].dom[1], step: 0.01, value: s.x0, onInput: (v) => ((s.x0 = v), draw()) });
    ui.player(w.controls, { label: 'Шагов', min: 0, max: K, value: s.k, fps: 1.2, format: (v) => 'k = ' + v, onChange: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'g(x)' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function iterates(G) {
      const xs = [s.x0];
      for (let j = 0; j < K; j++) {
        const x = xs[j];
        const dv = G.dg(x);
        xs.push(Number.isFinite(x) && Number.isFinite(dv) && Math.abs(dv) > 1e-300 ? x - G.g(x) / dv : NaN);
      }
      return xs;
    }
    function draw() {
      const G = NR[s.fn];
      const xs = iterates(G);
      const grid = U.linspace(G.dom[0], G.dom[1], 500);
      const yr = yRange(G.g, grid, 0.12);
      const inDom = (t) => Number.isFinite(t) && t >= G.dom[0] - 1e-9 && t <= G.dom[1] + 1e-9;
      const tx1 = [];
      const ty1 = [];
      const tx2 = [];
      const ty2 = [];
      const vx = [];
      const vy1 = [];
      const vy2 = [];
      for (let j = 0; j < s.k; j++) {
        const a = xs[j];
        const b = xs[j + 1];
        const far = (G.dom[1] - G.dom[0]) * 50;
        if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > far || Math.abs(b) > far) break;
        tx1.push(a);
        ty1.push(G.g(a));
        tx2.push(b);
        ty2.push(0);
        vx.push(b);
        vy1.push(0);
        vy2.push(G.g(b));
      }
      const shown = xs.slice(0, s.k + 1).filter(inDom);
      plot.render([
        { type: 'hline', y: 0, color: 'axis', width: 1.2 },
        { type: 'line', x: grid, y: grid.map(G.g), color: 'model', width: 2.4, hover: false },
        { type: 'segments', x1: tx1, y1: ty1, x2: tx2, y2: ty2, color: 'tree', width: 1.8, opacity: 0.95 },
        { type: 'segments', x1: vx, y1: vy1, x2: vx, y2: vy2, color: 'muted', width: 1.2, dash: '3 3', opacity: 0.9 },
        { type: 'vline', x: G.root, color: 'aqua', dash: '2 4', width: 1, text: 'корень' },
        { type: 'points', x: shown, y: shown.map(G.g), color: 'tree', r: 5, tooltip: (i) => [['шаг', String(i)], ['x', U.fmt(shown[i], 8)]] },
        inDom(xs[s.k]) ? { type: 'points', x: [xs[s.k]], y: [G.g(xs[s.k])], color: 'ink', r: 6 } : null,
      ], { x: G.dom, y: yr });
      const rows = xs.slice(0, s.k + 1).map((v, j) => [String(j), Number.isFinite(v) ? U.fmt(v, 12) : '—', Number.isFinite(v) ? sci(G.g(v)) : '—', Number.isFinite(v) ? sci(Math.abs(v - G.root)) : '—']);
      rowTable(tbl, ['k', 'xₖ', 'g(xₖ)', '|xₖ − корень|'], rows, (i) => i === rows.length - 1);
      const last = xs[s.k];
      const T = {
        sqrt2: 'x ← (x + 2/x)/2: «среднее между x и 2/x». Из 1: 1.5, 1.416667, 1.4142157, 1.41421356237469 — число верных знаков удваивается.',
        cos: 'Уравнение не решается алгеброй, а Ньютон даёт 10 знаков за 3–4 шага.',
        ex: 'Это тот же Ньютон, что и для минимума eˣ − 2x: корень уравнения f′(x) = 0 — минимум f.',
        cyc: 'Со старта 0 касательная приводит в 1, а из 1 — обратно в 0: вечный цикл. Сдвиньте старт — метод найдёт корень −1.769.',
        atan: 'Касательные к arctg пологие вдали от нуля. Со старта меньше ≈ 1.392 метод сходится, больше — разлетается всё дальше (1.5 → −1.69 → 2.32 → −5.11 → 32.3…).',
        cbrt: 'У ∛x шаг Ньютона x − 3x = −2x: каждый шаг удваивает расстояние до корня. Касательная слишком крутая у корня — сходимости нет ни из какой точки.',
      };
      note.innerHTML = T[s.fn] + (!inDom(last) && Number.isFinite(last) ? ' <b>Приближение x = ' + U.fmt(last, 3) + ' за пределами графика.</b>' : '');
    }
    w.pythonAction(() => {
      const G = NR[s.fn];
      return 'import numpy as np\n\ng = lambda x: ' + G.py[0] + '\ndg = lambda x: ' + G.py[1] + '\nx = ' + py(s.x0) + '\nfor k in range(' + K + '):\n    print(f"k = {k}: x = {x:.15f}, g(x) = {g(x):+.2e}")\n    with np.errstate(divide="ignore"):\n        d = dg(x)\n    if d == 0 or not np.isfinite(d):\n        print("касательная горизонтальна или вертикальна — шаг невозможен")\n        break\n    x = x - g(x) / d          # пересечение касательной с осью x\n';
    });
    draw();
  });

  /* ==============================================================================
   * 23. Ньютон против градиентного спуска: квадратичная и линейная сходимость
   * ============================================================================== */
  const NF = {
    ex: { label: 'eˣ − 2x (минимум ln 2)', f: (x) => Math.exp(x) - 2 * x, d: (x) => Math.exp(x) - 2, d2: Math.exp, dom: [-1, 2.6], x0: 2, opt: Math.LN2, C: 0.5, py: ['np.exp(x) - 2 * x', 'np.exp(x) - 2', 'np.exp(x)'], popt: 'np.log(2)' },
    q: { label: 'x⁴/4 − x (минимум 1)', f: (x) => x ** 4 / 4 - x, d: (x) => x ** 3 - 1, d2: (x) => 3 * x * x, dom: [-1, 2.5], x0: 2, opt: 1, C: 1, py: ['x**4 / 4 - x', 'x**3 - 1', '3 * x**2'], popt: '1.0' },
    ll: { label: 'log-loss трёх объектов: y = 1, 1, 0', f: ll3.f, d: ll3.d, d2: ll3.d2, dom: [-3, 4], x0: -2, opt: Math.LN2, C: (1 - 2 * (2 / 3)) / 2, py: ['2 * np.log1p(np.exp(-x)) + np.log1p(np.exp(x))', '3 / (1 + np.exp(-x)) - 2', '3 * np.exp(-x) / (1 + np.exp(-x))**2'], popt: 'np.log(2)' },
  };
  GBC.widget('newton-vs-gd', (el) => {
    const s = { fn: 'ex', x0: 2, eta: 0.3, k: 0 };
    const K = 12;
    const w = ui.shell(el, { title: 'Метод Ньютона против градиентного спуска', sub: 'Спуск шагает на −η·f′, Ньютон прыгает в дно параболы −f′/f″ (пунктир). Нижний график — ошибка в логарифмической шкале: у спуска это прямая (линейная сходимость), у Ньютона — обрыв вниз (квадратичная).', foot: false });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(NF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.x0 = NF[v].x0), x0s.set(s.x0), draw()) });
    const x0s = ui.slider(w.controls, { label: 'Старт x₀', min: -2.5, max: 2.5, step: 0.05, value: s.x0, onInput: (v) => ((s.x0 = v), draw()) });
    ui.slider(w.controls, { label: 'Темп спуска η', min: 0.05, max: 1, step: 0.05, value: s.eta, onInput: (v) => ((s.eta = v), draw()) });
    ui.player(w.controls, { label: 'Шаг k', min: 0, max: K, value: 0, fps: 1.5, format: (v) => 'k = ' + v, onChange: (v) => ((s.k = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 230, margin: { left: 64 }, x: { label: 'шаг k', domain: [0, K] }, y: { label: '|xₖ − x*| (лог. шкала)', type: 'log', domain: [1e-16, 10], ticks: [1e-15, 1e-12, 1e-9, 1e-6, 1e-3, 1], format: powFmt } });
    const tblBox = H('div', { style: 'max-height:220px;overflow:auto' });
    w.main.appendChild(tblBox);
    const note = w.note('', true);
    function paths(F) {
      const g = [s.x0];
      const n = [s.x0];
      for (let k = 0; k < K; k++) {
        g.push(g[k] - s.eta * F.d(g[k]));
        const h = F.d2(n[k]);
        n.push(Number.isFinite(n[k]) && h > 1e-12 ? n[k] - F.d(n[k]) / h : NaN);
      }
      return { g, n };
    }
    function draw() {
      const F = NF[s.fn];
      const { g, n } = paths(F);
      const k = s.k;
      const xs = U.linspace(F.dom[0], F.dom[1], 300);
      const xn = n[k];
      const para = Number.isFinite(xn) ? U.linspace(xn - 1.2, xn + 1.2, 80) : [];
      const inDom = (x) => Number.isFinite(x) && x >= F.dom[0] - 0.5 && x <= F.dom[1] + 0.5;
      const gv = g.slice(0, k + 1).filter(inDom);
      const nv = n.slice(0, k + 1).filter(inDom);
      p1.render([
        { type: 'line', x: xs, y: xs.map(F.f), color: 'model', width: 2.2, hover: false },
        para.length ? { type: 'line', x: para, y: para.map((x) => F.f(xn) + F.d(xn) * (x - xn) + 0.5 * F.d2(xn) * (x - xn) ** 2), color: 'violet', width: 1.6, dash: '5 4', label: 'парабола Ньютона', hover: false } : null,
        { type: 'line', x: gv, y: gv.map(F.f), color: 'aqua', width: 1.2, hover: false },
        { type: 'points', x: gv, y: gv.map(F.f), color: 'aqua', r: 4, label: 'спуск' },
        { type: 'line', x: nv, y: nv.map(F.f), color: 'violet', width: 1.2, hover: false },
        { type: 'points', x: nv, y: nv.map(F.f), color: 'violet', r: 5, hollow: true, label: 'Ньютон' },
        { type: 'vline', x: F.opt, color: 'tree', dash: '3 3', width: 1, text: 'минимум' },
      ], { x: F.dom, y: yRange(F.f, xs, 0.1) });
      const err = (arr) => arr.map((x) => (Number.isFinite(x) ? Math.max(Math.abs(x - F.opt), 1e-16) : NaN));
      const ks = U.range(K + 1);
      const eg = err(g);
      const en = err(n);
      p2.render([
        { type: 'line', x: ks, y: eg, color: 'aqua', width: 2.2, label: 'спуск' },
        { type: 'line', x: ks, y: en, color: 'violet', width: 2.2, label: 'Ньютон' },
        { type: 'vline', x: k, color: 'ink2', width: 1, dash: '3 3' },
      ]);
      const digits = (e) => (Number.isFinite(e) ? (e <= 1e-16 ? '≥ 16' : U.fmt(Math.max(0, -Math.log10(e)), 1)) : '—');
      const rows = ks.slice(0, k + 1).map((j) => [String(j), sci(en[j]), digits(en[j]), j && en[j - 1] > 1e-15 && en[j] > 1e-15 ? U.fmt(en[j] / en[j - 1] ** 2, 3) : '—', sci(eg[j]), j && eg[j - 1] > 1e-15 ? U.fmt(eg[j] / eg[j - 1], 3) : '—']);
      rowTable(tblBox, ['k', 'Ньютон |eₖ|', 'верных знаков', 'eₖ / eₖ₋₁²', 'спуск |eₖ|', 'eₖ / eₖ₋₁'], rows, (i) => i === k);
      const rate = Math.abs(1 - s.eta * F.d2(F.opt));
      let msg = 'Вблизи минимума у Ньютона отношение eₖ/eₖ₋₁² стремится к C = f‴/(2f″) = ' + f3(Math.abs(F.C)) + ' — число верных знаков удваивается. У спуска отношение eₖ/eₖ₋₁ стремится к |1 − η·f″(x*)| = ' + f3(rate) + (rate >= 1 ? ' ≥ 1: спуск с таким η не сходится!' : ' — постоянный множитель: каждый шаг даёт одну и ту же долю знака.');
      if (s.fn === 'q') msg += ' Поставьте старт около 0: f″ = 3x² почти ноль, и Ньютон улетает далеко (со старта 0.1 — в 33.4).';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const F = NF[s.fn];
      return 'import numpy as np\n\nd1 = lambda x: ' + F.py[1] + '\nd2 = lambda x: ' + F.py[2] + '\nx_opt = ' + F.popt + '\nxn = xg = ' + py(s.x0) + '\nprev = None\nfor k in range(' + K + ' + 1):\n    e = abs(xn - x_opt)\n    r = f"{e / prev**2:.3f}" if prev else "—"\n    print(f"k = {k:2}: Ньютон {e:.2e} (eₖ/eₖ₋₁² = {r})   спуск {abs(xg - x_opt):.2e}")\n    prev = e if e > 1e-15 else None\n    xn = xn - d1(xn) / d2(xn)\n    xg = xg - ' + py(s.eta) + ' * d1(xg)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 24. Когда Ньютон ломается: демпфирование η, сдвиг λ, обрезка, |f″|
   * ============================================================================== */
  const RS = {
    hyp: { label: '√(1 + x²): перелёт и разбегание', f: (x) => Math.sqrt(1 + x * x), d: (x) => x / Math.sqrt(1 + x * x), d2: (x) => (1 + x * x) ** -1.5, dom: [-4, 4], x0: 1.5, opt: 0, py: ['np.sqrt(1 + x**2)', 'x / np.sqrt(1 + x**2)', '(1 + x**2) ** -1.5'] },
    q: { label: 'x⁴/4 − x: почти нулевая f″', f: (x) => x ** 4 / 4 - x, d: (x) => x ** 3 - 1, d2: (x) => 3 * x * x, dom: [-1, 3], x0: 0.1, opt: 1, py: ['x**4 / 4 - x', 'x**3 - 1', '3 * x**2'] },
    w: { label: 'x⁴ − 2x²: f″ < 0 у нуля', f: (x) => x ** 4 - 2 * x * x, d: (x) => 4 * x ** 3 - 4 * x, d2: (x) => 12 * x * x - 4, dom: [-1.8, 1.8], x0: 0.3, opt: 1, py: ['x**4 - 2 * x**2', '4 * x**3 - 4 * x', '12 * x**2 - 4'] },
    ll: { label: 'log-loss, все y = 1: минимума нет', f: (x) => 4 * softplus(-x), d: (x) => 4 * (sigma(x) - 1), d2: (x) => 4 * sigma(x) * (1 - sigma(x)), dom: [-2, 12], x0: 0, opt: Infinity, py: ['4 * np.log1p(np.exp(-x))', '4 * (1 / (1 + np.exp(-x)) - 1)', '4 * np.exp(-x) / (1 + np.exp(-x))**2'] },
  };
  GBC.widget('newton-rescue', (el) => {
    const s = { fn: 'hyp', x0: 1.5, eta: 1, lam: 0, clip: 0, abs: false };
    const K = 15;
    const w = ui.shell(el, { title: 'Ремонт метода Ньютона', sub: 'Шаг: x ← x + η·обрезка(−f′/(f″ + λ), c). η — демпфирование (learning_rate), λ — сдвиг кривизны (reg_lambda), c — обрезка шага (max_delta_step, 0 = нет). |f″| — делить на модуль кривизны.', foot: false });
    ui.select(w.controls, { label: 'Задача', value: s.fn, options: Object.entries(RS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.x0 = RS[v].x0), x0s.set(s.x0), draw()) });
    const x0s = ui.slider(w.controls, { label: 'Старт x₀', min: -2, max: 3, step: 0.05, value: s.x0, onInput: (v) => ((s.x0 = v), draw()) });
    const es = ui.slider(w.controls, { label: 'Демпфирование η', min: 0.1, max: 1, step: 0.05, value: s.eta, onInput: (v) => ((s.eta = v), draw()) });
    const ls = ui.slider(w.controls, { label: 'Сдвиг λ', min: 0, max: 3, step: 0.05, value: s.lam, onInput: (v) => ((s.lam = v), draw()) });
    const cs = ui.slider(w.controls, { label: 'Обрезка шага c (0 = нет)', min: 0, max: 3, step: 0.1, value: s.clip, onInput: (v) => ((s.clip = v), draw()) });
    const ab = ui.toggle(w.controls, { label: 'Делить на |f″|', checked: false, onChange: (v) => ((s.abs = v), draw()) });
    const presetBox = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
    w.controls.appendChild(presetBox);
    const preset = (label, o) => ui.button(presetBox, { label, small: true, onClick: () => {
      Object.assign(s, { eta: 1, lam: 0, clip: 0, abs: false }, o);
      es.set(s.eta);
      ls.set(s.lam);
      cs.set(s.clip);
      ab.set(s.abs);
      draw();
    } });
    preset('без ремонта', {});
    preset('обрезка 1', { clip: 1 });
    preset('λ = 1', { lam: 1 });
    preset('η = 0.3', { eta: 0.3 });
    preset('|f″|', { abs: true });
    const p1 = new GBC.Plot(w.main, { height: 270, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 200, margin: { left: 64 }, x: { label: 'шаг k', domain: [0, K] }, y: { label: '|f′(xₖ)| (лог. шкала)', type: 'log', domain: [1e-16, 1e3], ticks: [1e-15, 1e-12, 1e-9, 1e-6, 1e-3, 1], format: powFmt } });
    const tblBox = H('div', { style: 'max-height:200px;overflow:auto' });
    w.main.appendChild(tblBox);
    const note = w.note('', true);
    function run(F) {
      const xs = [s.x0];
      const steps = [];
      for (let k = 0; k < K; k++) {
        const x = xs[k];
        if (!Number.isFinite(x) || Math.abs(x) > 1e8) {
          xs.push(NaN);
          steps.push(NaN);
          continue;
        }
        const h = (s.abs ? Math.abs(F.d2(x)) : F.d2(x)) + s.lam;
        let st = Math.abs(h) > 1e-300 ? -F.d(x) / h : NaN;
        if (s.clip > 0) st = U.clamp(st, -s.clip, s.clip);
        st *= s.eta;
        steps.push(st);
        xs.push(x + st);
      }
      return { xs, steps };
    }
    function draw() {
      const F = RS[s.fn];
      const { xs, steps } = run(F);
      const grid = U.linspace(F.dom[0], F.dom[1], 400);
      const inDom = (t) => Number.isFinite(t) && t >= F.dom[0] && t <= F.dom[1];
      const vis = xs.filter(inDom);
      p1.render([
        { type: 'line', x: grid, y: grid.map(F.f), color: 'model', width: 2.4, hover: false },
        Number.isFinite(F.opt) ? { type: 'vline', x: F.opt, color: 'muted', dash: '3 3', width: 1, text: 'минимум' } : null,
        { type: 'line', x: vis, y: vis.map(F.f), color: 'tree', width: 1.2, opacity: 0.7, hover: false },
        { type: 'points', x: vis, y: vis.map(F.f), color: 'tree', r: 4.5, tooltip: (i) => [['x', U.fmt(vis[i], 6)], ['f', U.fmt(F.f(vis[i]), 6)]] },
        inDom(xs[0]) ? { type: 'points', x: [xs[0]], y: [F.f(xs[0])], color: 'ink', r: 6 } : null,
      ], { x: F.dom, y: yRange(F.f, grid, 0.12) });
      const gk = xs.map((x) => (Number.isFinite(x) && Math.abs(x) < 1e8 ? Math.max(Math.abs(F.d(x)), 1e-16) : NaN));
      p2.render([{ type: 'line', x: U.range(K + 1), y: gk, color: 'tree', width: 2.2 }, { type: 'points', x: U.range(K + 1), y: gk, color: 'tree', r: 3.5 }]);
      const rows = xs.map((x, k) => [String(k), Number.isFinite(x) && Math.abs(x) < 1e8 ? U.fmt(x, 8) : 'улетел', k < K && Number.isFinite(steps[k]) ? sci(steps[k], 3) : '—', Number.isFinite(x) && Math.abs(x) < 1e8 ? sci(Math.abs(F.d(x))) : '—']);
      rowTable(tblBox, ['k', 'xₖ', 'шаг', '|f′(xₖ)|'], rows, null);
      const fin = xs[K];
      const pure = s.eta === 1 && s.lam === 0 && s.clip === 0 && !s.abs;
      const T = {
        hyp: pure ? 'Без ремонта шаг Ньютона x → −x³: при |x₀| &gt; 1 метод разлетается, при |x₀| = 1 — цикл, при |x₀| &lt; 1 — сходится мгновенно.' : 'Обрезка 1 делает один короткий шаг (1.5 → 0.5), а дальше снова работает чистый Ньютон — квадратичная скорость сохраняется. λ и η тоже спасают, но сходимость становится линейной.',
        q: pure ? 'f″(0.1) = 0.03 — парабола почти прямая, шаг 33.3: улетаем далеко вправо и долго возвращаемся.' : 'Обрезка не даёт улететь, λ укорачивает шаг там, где f″ мала.',
        w: pure ? 'f″(0.3) = −2.92 &lt; 0: парабола перевёрнута, Ньютон идёт в её вершину и сходится к <b>максимуму</b> x = 0.' : 'С |f″| шаг всегда направлен вниз по склону: метод выходит из горба и находит минимум x = 1. λ ≥ 4 тоже делает знаменатель положительным.',
        ll: 'Все объекты класса 1: потери убывают при F → ∞, минимума нет. Чистый Ньютон делает шаги 2, 1.14, 1.04, … — F растёт бесконечно. λ ограничивает каждый шаг (в XGBoost штраф λw²/2 делает минимум конечным в каждом листе), но совсем остановить рост логита может только сама цель с регуляризацией.',
      };
      note.innerHTML = T[s.fn] + (Number.isFinite(fin) && Math.abs(fin) < 1e8 ? ' После ' + K + ' шагов x = ' + U.fmt(fin, 6) + ', |f′| = ' + U.fmt(Math.abs(F.d(fin)), 2) + '.' : ' <b>Метод разошёлся.</b>');
    }
    w.pythonAction(() => {
      const F = RS[s.fn];
      return 'import numpy as np\n\nd1 = lambda x: ' + F.py[1] + '\nd2 = lambda x: ' + F.py[2] + '\neta, lam, clip, use_abs = ' + py(s.eta) + ', ' + py(s.lam) + ', ' + py(s.clip) + ', ' + (s.abs ? 'True' : 'False') + '\nx = ' + py(s.x0) + '\nfor k in range(' + K + '):\n    h = (abs(d2(x)) if use_abs else d2(x)) + lam\n    step = -d1(x) / h\n    if clip > 0:\n        step = float(np.clip(step, -clip, clip))\n    x = x + eta * step\n    print(f"k = {k + 1:2}: x = {x: .8f}, |f′(x)| = {abs(d1(x)):.2e}")\n    if abs(x) > 1e8:\n        print("разошёлся"); break\n';
    });
    draw();
  });

  /* ==============================================================================
   * 25. Квадратичная модель потерь одного объекта: g, h и шаг −g/h
   * ============================================================================== */
  const QM = {
    mse: { label: '½(y − F)², y = 0', L: (F) => 0.5 * F * F, g: (F) => F, h: () => 1, Fr: [-4, 4], opt: () => 0, py: ['0.5 * F**2', 'F', '1.0'] },
    ll1: { label: 'log-loss, y = 1', L: (F) => softplus(-F), g: (F) => sigma(F) - 1, h: (F) => sigma(F) * (1 - sigma(F)), Fr: [-5, 5], opt: () => Infinity, py: ['np.log1p(np.exp(-F))', 'sig(F) - 1', 'sig(F) * (1 - sig(F))'] },
    ll0: { label: 'log-loss, y = 0', L: (F) => softplus(F), g: (F) => sigma(F), h: (F) => sigma(F) * (1 - sigma(F)), Fr: [-5, 5], opt: () => -Infinity, py: ['np.log1p(np.exp(F))', 'sig(F)', 'sig(F) * (1 - sig(F))'] },
    pois: { label: 'Пуассон e^F − yF, y = 3', L: (F) => Math.exp(F) - 3 * F, g: (F) => Math.exp(F) - 3, h: Math.exp, Fr: [-2, 2.5], opt: () => Math.log(3), py: ['np.exp(F) - 3 * F', 'np.exp(F) - 3', 'np.exp(F)'] },
    exp: { label: 'экспоненциальные e^(−F), y = +1', L: (F) => Math.exp(-F), g: (F) => -Math.exp(-F), h: (F) => Math.exp(-F), Fr: [-2, 4], opt: () => Infinity, py: ['np.exp(-F)', '-np.exp(-F)', 'np.exp(-F)'] },
  };
  GBC.widget('quad-model', (el) => {
    const s = { l: 'll1', F: 0 };
    const w = ui.shell(el, { title: 'Парабола потерь одного объекта', sub: 'Синяя — настоящие потери L(F + Δ) как функция поправки Δ, фиолетовый пунктир — парабола L + g·Δ + ½h·Δ² (то, что видит XGBoost). Кружок — шаг Ньютона −g/h.' });
    ui.select(w.controls, { label: 'Потери', value: s.l, options: Object.entries(QM).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.l = v), (s.F = 0), fs.set(0), draw()) });
    const fs = ui.slider(w.controls, { label: 'Текущий прогноз F', min: -5, max: 5, step: 0.05, value: s.F, onInput: (v) => ((s.F = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'поправка Δ' }, y: { label: 'потери' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'g' }, { key: 'h', label: 'h' }, { key: 'n', label: 'шаг −g/h' }, { key: 'p', label: 'p = σ(F)' }]);
    function draw() {
      const Q = QM[s.l];
      const F = U.clamp(s.F, Q.Fr[0], Q.Fr[1]);
      const g = Q.g(F);
      const h = Q.h(F);
      const N = -g / h;
      const L0 = Q.L(F);
      const lo = Math.min(-4, N - 1);
      const hi = Math.max(5, Math.min(N + 1, 40));
      const ds = U.linspace(lo, hi, 500);
      const Lt = (d) => Q.L(F + d);
      const P = (d) => L0 + g * d + 0.5 * h * d * d;
      const opt = Q.opt() - F;
      const yr = yRange(Lt, ds.filter((d) => d > lo + (hi - lo) * 0.1), 0.15, 60);
      plot.render([
        { type: 'line', x: ds, y: ds.map(Lt), color: 'model', width: 2.6, label: 'L(F + Δ)', hover: false },
        { type: 'line', x: ds, y: ds.map(P), color: 'violet', width: 2, dash: '6 4', label: 'парабола L + gΔ + ½hΔ²', hover: false },
        Number.isFinite(opt) ? { type: 'vline', x: opt, color: 'muted', dash: '3 3', width: 1, text: 'настоящий минимум' } : null,
        { type: 'points', x: [N], y: [P(N)], color: 'violet', r: 6, hollow: true, tooltip: () => [['шаг Ньютона', f3(N)]] },
        { type: 'points', x: [N], y: [Lt(N)], color: 'tree', r: 6, tooltip: () => [['L после шага', f4(Lt(N))]] },
        { type: 'points', x: [0], y: [L0], color: 'ink', r: 5 },
      ], { x: [lo, hi], y: [Math.min(yr[0], P(N) - 0.1), yr[1]] });
      st.set('g', f4(g));
      st.set('h', f4(h));
      st.set('n', f3(N));
      st.set('p', s.l.startsWith('ll') ? f3(sigma(F)) : '—');
      const T = {
        mse: 'Для MSE парабола совпадает с потерями: шаг Ньютона −g/h = y − F попадает точно в минимум. Второй порядок здесь ничего не добавляет.',
        ll1: 'y = 1: шаг Ньютона = 1/p = ' + f3(N) + '. Чем увереннее модель (p → 0 или p → 1), тем меньше h = p(1 − p) и тем «смелее» шаг. При p = 0.01 он равен 100! Минимума у одного объекта нет: потери убывают при F → ∞.',
        ll0: 'y = 0: шаг Ньютона = −1/(1 − p) = ' + f3(N) + '. Зеркально к y = 1.',
        pois: 'Кривизна e^F быстро растёт, и парабола в точке F недооценивает её справа: из F = 0 шаг 2 перелетает минимум ln 3 ≈ 1.099.',
        exp: 'g = −h: шаг Ньютона всегда равен 1, как бы далеко ни был «минимум» (его нет: потери убывают при F → ∞).',
      };
      note.innerHTML = T[s.l];
    }
    w.pythonAction(() => {
      const Q = QM[s.l];
      return 'import numpy as np\n\nsig = lambda z: 1 / (1 + np.exp(-z))\nL = lambda F: ' + Q.py[0] + '\ng = lambda F: ' + Q.py[1] + '\nh = lambda F: ' + Q.py[2] + '\nF = ' + py(s.F) + '\nstep = -g(F) / h(F)\nprint(f"g = {g(F):.4f}, h = {h(F):.4f}, шаг Ньютона −g/h = {step:.4f}")\nprint(f"потери: было {L(F):.4f}, после шага {L(F + step):.4f}, парабола обещала {L(F) - g(F)**2 / (2 * h(F)):.4f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 26. Значение листа = шаг Ньютона: G, H, λ и повторные шаги
   * ============================================================================== */
  const LOSSF = {
    ll: { L: (y, F) => (y ? softplus(-F) : softplus(F)), g: (y, F) => sigma(F) - y, h: (y, F) => sigma(F) * (1 - sigma(F)) },
    mse: { L: (y, F) => 0.5 * (y - F) ** 2, g: (y, F) => F - y, h: () => 1 },
    pois: { L: (y, F) => Math.exp(F) - y * F, g: (y, F) => Math.exp(F) - y, h: (y, F) => Math.exp(F) },
  };
  const LP = {
    ll3: { label: 'log-loss: классы 1, 1, 0', loss: 'll', ys: [1, 1, 0], wr: [-2, 4] },
    ll4: { label: 'log-loss: классы 1, 1, 1, 0', loss: 'll', ys: [1, 1, 1, 0], wr: [-2, 4] },
    pure: { label: 'log-loss: классы 1, 1, 1 (чистый лист)', loss: 'll', ys: [1, 1, 1], wr: [-1, 8] },
    mse: { label: 'MSE: ответы 3, 5, 4 (прогноз F₀)', loss: 'mse', ys: [3, 5, 4], wr: [-2, 8] },
    pois: { label: 'Пуассон: один объект y = 3', loss: 'pois', ys: [3], wr: [-1, 3] },
  };
  GBC.widget('leaf-newton', (el) => {
    const s = { p: 'll3', F0: 0, lam: 0, it: [0] };
    const w = ui.shell(el, { title: 'Значение листа = шаг Ньютона', sub: 'В лист попали объекты с общим текущим прогнозом F₀. Синяя — настоящая цель Σ L(yᵢ, F₀ + w) + λw²/2, пунктир — её парабола по G и H в текущей точке. Первый шаг из w = 0 — это и есть значение листа XGBoost −G/(H + λ).' });
    ui.select(w.controls, { label: 'Лист', value: s.p, options: Object.entries(LP).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.p = v), (s.it = [0]), draw()) });
    ui.slider(w.controls, { label: 'Текущий прогноз F₀', min: -2, max: 2, step: 0.1, value: s.F0, onInput: (v) => ((s.F0 = v), (s.it = [0]), draw()) });
    ui.slider(w.controls, { label: 'Регуляризация λ', min: 0, max: 5, step: 0.1, value: s.lam, onInput: (v) => ((s.lam = v), (s.it = [0]), draw()) });
    ui.button(w.controls, { label: 'Ещё шаг Ньютона', kind: 'primary', icon: 'step', onClick: () => {
      const { Gw, Hw } = gh(s.it[s.it.length - 1]);
      const wv = s.it[s.it.length - 1];
      s.it.push(wv - Gw / Hw);
      draw();
    } });
    ui.button(w.controls, { label: 'Сброс', onClick: () => ((s.it = [0]), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'значение листа w' }, y: { label: 'цель' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'w = −G/(H + λ)' }, { key: 't', label: 'точный минимум' }, { key: 'pr', label: 'обещано: ½G²/(H + λ)' }, { key: 'ac', label: 'на деле' }]);
    function gh(wv) {
      const P = LP[s.p];
      const Lf = LOSSF[P.loss];
      const Gw = P.ys.reduce((a, y) => a + Lf.g(y, s.F0 + wv), 0) + s.lam * wv;
      const Hw = P.ys.reduce((a, y) => a + Lf.h(y, s.F0 + wv), 0) + s.lam;
      return { Gw, Hw };
    }
    function exactMin() {
      let wv = 0;
      for (let k = 0; k < 200; k++) {
        const { Gw, Hw } = gh(wv);
        let stp = -Gw / Hw;
        stp = U.clamp(stp, -2, 2);
        wv += stp;
        if (Math.abs(stp) < 1e-13) return wv;
        if (wv > 60) return Infinity;
      }
      return wv > 30 ? Infinity : wv;
    }
    function draw() {
      const P = LP[s.p];
      const Lf = LOSSF[P.loss];
      const Phi = (wv) => P.ys.reduce((a, y) => a + Lf.L(y, s.F0 + wv), 0) + 0.5 * s.lam * wv * wv;
      const ws = U.linspace(P.wr[0], P.wr[1], 400);
      const wk = s.it[s.it.length - 1];
      const { Gw, Hw } = gh(wk);
      const quad = (wv) => Phi(wk) + Gw * (wv - wk) + 0.5 * Hw * (wv - wk) ** 2;
      const exact = exactMin();
      const yr = yRange(Phi, ws, 0.25);
      const inR = (t) => t >= P.wr[0] && t <= P.wr[1];
      plot.render([
        { type: 'line', x: ws, y: ws.map(Phi), color: 'model', width: 2.6, label: 'настоящая цель', hover: false },
        { type: 'line', x: ws, y: ws.map(quad), color: 'violet', width: 2, dash: '6 4', label: 'парабола G·w + ½(H + λ)w²', hover: false },
        Number.isFinite(exact) && inR(exact) ? { type: 'vline', x: exact, color: 'tree', dash: '3 3', width: 1.2, text: 'точный минимум' } : null,
        { type: 'points', x: s.it.filter(inR), y: s.it.filter(inR).map(Phi), color: 'violet', r: 6, label: 'шаги Ньютона', tooltip: (i) => [['шаг', String(i)], ['w', U.fmt(s.it.filter(inR)[i], 6)]] },
      ], { x: P.wr, y: yr });
      // таблица объектов (в точке w = 0)
      const rows = P.ys.map((y, i) => {
        const F = s.F0;
        return [String(i + 1), String(y), P.loss === 'll' ? f3(sigma(F)) : f3(F), f4(Lf.g(y, F)), f4(Lf.h(y, F))];
      });
      const G0 = P.ys.reduce((a, y) => a + Lf.g(y, s.F0), 0);
      const H0 = P.ys.reduce((a, y) => a + Lf.h(y, s.F0), 0);
      rows.push(['Σ', '', '', 'G = ' + f4(G0), 'H = ' + f4(H0)]);
      rowTable(tbl, ['объект', 'y', P.loss === 'll' ? 'p = σ(F₀)' : 'F₀', 'gᵢ', 'hᵢ'], rows, (i) => i === rows.length - 1);
      const w1 = -G0 / (H0 + s.lam);
      const pred = (0.5 * G0 * G0) / (H0 + s.lam);
      const act = Phi(0) - Phi(w1);
      st.set('w', f4(w1));
      st.set('t', Number.isFinite(exact) ? f4(exact) : 'нет (→ ∞)');
      st.set('pr', f4(pred));
      st.set('ac', f4(act));
      const T = {
        ll3: 'При F₀ = 0, λ = 0: G = −0.5, H = 0.75, лист 0.667 при точном ответе ln 2 = 0.693 — один шаг почти попал. Второй шаг даёт ошибку 10⁻⁴, третий — 2·10⁻⁹.',
        ll4: 'G = −1, H = 1: лист 1, точный оптимум ln 3 = 1.099. Обещанное уменьшение 0.5, фактическое 0.520.',
        pure: 'Все объекты одного класса: без λ минимума нет, шаги Ньютона растут без конца. Поставьте λ &gt; 0 — у цели появится конечный минимум.',
        mse: 'h = 1: лист = Σ(yᵢ − F₀)/(n + λ). При F₀ = 0, λ = 0 — средний остаток 4; с λ = 1 — 3: среднее сжимается в n/(n + λ) раз. Для MSE парабола точная — один шаг сразу в минимум.',
        pois: 'g = −2, h = 1: шаг 2 при точном минимуме ln 3 ≈ 1.099 — перелёт. Повторные шаги: 1.406, 1.141, 1.0995, 1.0986.',
      };
      note.innerHTML = T[s.p] + ' Сейчас: шагов ' + (s.it.length - 1) + ', w = ' + U.fmt(wk, 8) + (Number.isFinite(exact) ? ', ошибка ' + sci(Math.abs(wk - exact)) + '.' : '.');
    }
    w.pythonAction(() => {
      const P = LP[s.p];
      const L = { ll: ['np.log1p(np.exp(-F)) * y + np.log1p(np.exp(F)) * (1 - y)', 'sig(F) - y', 'sig(F) * (1 - sig(F))'], mse: ['0.5 * (y - F)**2', 'F - y', '1.0 + 0 * F'], pois: ['np.exp(F) - y * F', 'np.exp(F) - y', 'np.exp(F)'] }[P.loss];
      return 'import numpy as np\n\nsig = lambda z: 1 / (1 + np.exp(-z))\ny = np.array([' + P.ys.join(', ') + '], dtype=float)\nF0, lam = ' + py(s.F0) + ', ' + py(s.lam) + '\nloss = lambda F: ' + L[0] + '\ngrad = lambda F: ' + L[1] + '\nhess = lambda F: ' + L[2] + '\nobj = lambda w: loss(F0 + w).sum() + lam * w**2 / 2\nG, H = grad(F0 + 0 * y).sum(), hess(F0 + 0 * y).sum()\nw = -G / (H + lam)\nprint(f"G = {G:.4f}, H = {H:.4f}, лист −G/(H + λ) = {w:.4f}")\nprint(f"обещано ½G²/(H + λ) = {G**2 / (2 * (H + lam)):.4f}, на деле {obj(0) - obj(w):.4f}")\nfor k in range(4):   # повторные шаги Ньютона по той же цели\n    w = w - (grad(F0 + w).sum() + lam * w) / (hess(F0 + w).sum() + lam)\n    print(f"шаг {k + 2}: w = {w:.10f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 27. Прирост разбиения по G и H
   * ============================================================================== */
  GBC.widget('split-gain', (el) => {
    const s = { y: [0, 0, 1, 0, 1, 1, 1, 1], F0: 0, lam: 1, gam: 0, t: 4 };
    const X = [1, 2, 3, 4, 5, 6, 7, 8];
    const w = ui.shell(el, { title: 'Прирост разбиения: какой порог лучше?', sub: 'Восемь объектов на оси x, классы 0 и 1 (щёлкните по точке, чтобы поменять класс). Для каждого порога считаются G и H слева и справа и прирост. Нижний график — приросты всех семи порогов.' });
    ui.slider(w.controls, { label: 'Порог: x < …', min: 1, max: 7, step: 1, value: s.t, format: (v) => String(v + 0.5), onInput: (v) => ((s.t = v), draw()) });
    ui.slider(w.controls, { label: 'Регуляризация λ', min: 0, max: 5, step: 0.1, value: s.lam, onInput: (v) => ((s.lam = v), draw()) });
    ui.slider(w.controls, { label: 'Штраф за лист γ', min: 0, max: 2, step: 0.05, value: s.gam, onInput: (v) => ((s.gam = v), draw()) });
    ui.slider(w.controls, { label: 'Текущий логит F₀', min: -2, max: 2, step: 0.1, value: s.F0, onInput: (v) => ((s.F0 = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 210, x: { label: 'признак x', domain: [0.4, 8.6], ticks: X }, y: { label: 'класс y', domain: [-0.35, 1.35], ticks: [0, 1] }, onClick: (x) => {
      const i = U.clamp(Math.round(x), 1, 8) - 1;
      s.y[i] = 1 - s.y[i];
      draw();
    } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'порог', domain: [1, 8], ticks: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5], format: (v) => String(v) }, y: { label: 'прирост Gain' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'слева G / H' }, { key: 'R', label: 'справа G / H' }, { key: 'g', label: 'Gain' }, { key: 'x', label: 'gain в XGBoost' }, { key: 'w', label: 'листья' }]);
    function draw() {
      const p = sigma(s.F0);
      const g = s.y.map((y) => p - y);
      const hh = s.y.map(() => p * (1 - p));
      const score = (G, Hh) => (G * G) / (Hh + s.lam);
      const Gt = U.sum(g);
      const Ht = U.sum(hh);
      const gains = [];
      for (let t = 1; t < 8; t++) {
        const GL = U.sum(g.slice(0, t));
        const HL = U.sum(hh.slice(0, t));
        gains.push(0.5 * (score(GL, HL) + score(Gt - GL, Ht - HL) - score(Gt, Ht)) - s.gam);
      }
      const t = s.t;
      const GL = U.sum(g.slice(0, t));
      const HL = U.sum(hh.slice(0, t));
      const GR = Gt - GL;
      const HR = Ht - HL;
      const wL = -GL / (HL + s.lam);
      const wR = -GR / (HR + s.lam);
      const thr = t + 0.5;
      p1.render([
        { type: 'vband', x0: 0.4, x1: thr, color: 'model', opacity: 0.06 },
        { type: 'vline', x: thr, color: 'tree', width: 2 },
        { type: 'points', x: X, y: s.y, color: (i) => (s.y[i] ? 'class1' : 'class0'), r: 8, tooltip: (i) => [['x', String(X[i])], ['y', String(s.y[i])], ['g', f3(g[i])], ['h', f3(hh[i])]] },
        { type: 'text', items: [{ x: (0.4 + thr) / 2, y: 0.5, text: 'w = ' + f3(wL), anchor: 'middle', bold: true }, { x: (thr + 8.6) / 2, y: 0.5, text: 'w = ' + f3(wR), anchor: 'middle', bold: true }] },
      ]);
      const best = gains.indexOf(Math.max(...gains));
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'bars', x: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5], y: gains, width: 0.7, maxPx: 40, color: (i) => (gains[i] <= 0 ? 'muted' : i === best ? 'tree' : 'model'), tooltip: (i) => [['порог', String(i + 1.5)], ['Gain', f4(gains[i])]] },
        { type: 'vline', x: thr, color: 'ink2', width: 1, dash: '3 3' },
      ]);
      const gain = gains[t - 1];
      st.set('L', f3(GL) + ' / ' + f3(HL));
      st.set('R', f3(GR) + ' / ' + f3(HR));
      st.set('g', f4(gain));
      st.set('x', f4(2 * (gain + s.gam)) + (s.gam ? ' (γ отдельно)' : ''));
      st.set('w', f3(wL) + ' | ' + f3(wR));
      let msg = 'Лучший порог — x &lt; ' + (best + 1.5) + ' (Gain ' + f4(gains[best]) + ').';
      msg += gains[best] <= 0 ? ' <b>Все приросты ≤ 0: разбиение не делается</b> — γ перевешивает выигрыш.' : '';
      msg += ' XGBoost в отчётах показывает прирост без множителя ½ (в 2 раза больше), и его параметр gamma — это 2γ. λ уменьшает приросты и сильнее всего — у маленьких листьев.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => 'import numpy as np\n\ny = np.array([' + s.y.join(', ') + '])\nF0, lam, gamma = ' + py(s.F0) + ', ' + py(s.lam) + ', ' + py(s.gam) + '\np = 1 / (1 + np.exp(-F0)) * np.ones(8)\ng, h = p - y, p * (1 - p)\nscore = lambda G, H: G**2 / (H + lam)\nG, H = g.sum(), h.sum()\nfor t in range(1, 8):\n    GL, HL = g[:t].sum(), h[:t].sum()\n    gain = 0.5 * (score(GL, HL) + score(G - GL, H - HL) - score(G, H)) - gamma\n    print(f"x < {t + 0.5}: Gain = {gain:+.4f}  (XGBoost: {2 * (gain + gamma):.4f})  листья {-GL / (HL + lam):+.3f} {-(G - GL) / (H - HL + lam):+.3f}")\n\n# сверка с XGBoost (в Jupyter):\n# import xgboost as xgb\n# X = np.arange(1, 9, dtype=float).reshape(-1, 1)\n# m = xgb.XGBClassifier(n_estimators=1, max_depth=1, learning_rate=1, reg_lambda=lam, gamma=2 * gamma,\n#                       base_score=1 / (1 + np.exp(-F0)), min_child_weight=0, tree_method="exact").fit(X, y)\n# print(m.get_booster().get_dump(with_stats=True)[0])\n');
    draw();
  });

  /* ==============================================================================
   * 28. Бустинг одного числа: первый порядок против Ньютона
   * ============================================================================== */
  GBC.widget('boost-one-number', (el) => {
    const s = { m: 8, nu: 1, lam: 0 };
    const n = 10;
    const K = 15;
    const w = ui.shell(el, { title: 'Бустинг одного числа: градиент против Ньютона', sub: 'Модель — одна константа F (логит). На каждом шаге к ней добавляется ν·w, где w — средний остаток (первый порядок) или шаг Ньютона Σ(y − p)/(Σp(1 − p) + λ). Сверху — F по шагам, снизу — избыток потерь над оптимумом.', foot: false });
    ui.slider(w.controls, { label: 'Единиц среди 10 объектов', min: 1, max: 9, step: 1, value: s.m, format: (v) => String(v), onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'Темп обучения ν', min: 0.05, max: 1, step: 0.05, value: s.nu, onInput: (v) => ((s.nu = v), draw()) });
    ui.slider(w.controls, { label: 'Регуляризация λ', min: 0, max: 5, step: 0.1, value: s.lam, onInput: (v) => ((s.lam = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'шаг k', domain: [0, K] }, y: { label: 'логит F' } });
    const p2 = new GBC.Plot(w.main, { height: 220, margin: { left: 64 }, x: { label: 'шаг k', domain: [0, K] }, y: { label: 'избыток потерь', type: 'log', domain: [1e-16, 1], ticks: [1e-15, 1e-12, 1e-9, 1e-6, 1e-3, 1], format: powFmt } });
    const tblBox = H('div', { style: 'max-height:200px;overflow:auto' });
    w.main.appendChild(tblBox);
    const note = w.note('', true);
    function draw() {
      const ybar = s.m / n;
      const Fs = Math.log(ybar / (1 - ybar));
      const loss = (F) => -(ybar * Math.log(sigma(F)) + (1 - ybar) * Math.log(1 - sigma(F)));
      const Lmin = loss(Fs);
      const run = (newton) => {
        const F = [0];
        for (let k = 0; k < K; k++) {
          const p = sigma(F[k]);
          const r = n * (ybar - p);
          const wv = newton ? r / (n * p * (1 - p) + s.lam) : r / n;
          F.push(F[k] + s.nu * wv);
        }
        return F;
      };
      const Fg = run(false);
      const Fn = run(true);
      const ks = U.range(K + 1);
      p1.render([
        { type: 'hline', y: Fs, color: 'muted', dash: '4 4', width: 1.2, text: 'оптимум ln(ȳ/(1 − ȳ)) = ' + f3(Fs) },
        { type: 'line', x: ks, y: Fg, color: 'aqua', width: 2.2, label: 'первый порядок' },
        { type: 'points', x: ks, y: Fg, color: 'aqua', r: 3.5 },
        { type: 'line', x: ks, y: Fn, color: 'violet', width: 2.2, label: 'Ньютон' },
        { type: 'points', x: ks, y: Fn, color: 'violet', r: 3.5 },
      ], { y: yRange([(k) => Fg[k], (k) => Fn[k], () => Fs, () => 0], ks, 0.12) });
      const ex = (arr) => arr.map((F) => Math.max(loss(F) - Lmin, 1e-16));
      p2.render([
        { type: 'line', x: ks, y: ex(Fg), color: 'aqua', width: 2.2, label: 'первый порядок' },
        { type: 'line', x: ks, y: ex(Fn), color: 'violet', width: 2.2, label: 'Ньютон' },
      ]);
      rowTable(tblBox, ['k', 'F (первый порядок)', '|F − F*|', 'F (Ньютон)', '|F − F*|'], ks.slice(0, 9).map((k) => [String(k), U.fmt(Fg[k], 6), sci(Math.abs(Fg[k] - Fs)), U.fmt(Fn[k], 8), sci(Math.abs(Fn[k] - Fs))]), null);
      const kN = Fn.findIndex((F) => Math.abs(F - Fs) < 1e-6);
      const kG = Fg.findIndex((F) => Math.abs(F - Fs) < 1e-6);
      const steps = (k) => k + ' ' + (k % 10 === 1 && k % 100 !== 11 ? 'шаг' : [2, 3, 4].includes(k % 10) && ![12, 13, 14].includes(k % 100) ? 'шага' : 'шагов');
      let msg = 'Ошибка 10⁻⁶: Ньютон — ' + (kN >= 0 ? 'за ' + steps(kN) : 'не достигнута за ' + steps(K)) + ', первый порядок — ' + (kG >= 0 ? 'за ' + steps(kG) : 'не достигнута за ' + steps(K)) + '. ';
      msg += 'Средний остаток — это градиентный шаг с η = 1, а кривизна log-loss p(1 − p) ≤ ¼, поэтому он минимум в 4 раза короче нужного. ';
      if (s.nu < 1) msg += 'С темпом ν &lt; 1 Ньютон тоже сходится линейно (множитель ≈ 1 − ν за шаг), но всё равно быстрее. ';
      if (s.lam > 0) msg += 'λ уменьшает шаги Ньютона: при малом числе объектов это заметно (n·p(1 − p) сравнимо с λ). ';
      note.innerHTML = msg;
    }
    w.pythonAction(() => 'import numpy as np\n\ny = np.array([1] * ' + s.m + ' + [0] * ' + (n - s.m) + ')\nsig = lambda z: 1 / (1 + np.exp(-z))\nnu, lam = ' + py(s.nu) + ', ' + py(s.lam) + '\nF_opt = np.log(y.mean() / (1 - y.mean()))\nFg = Fn = 0.0\nfor k in range(' + K + '):\n    print(f"k = {k:2}: первый порядок F = {Fg:.6f} ({abs(Fg - F_opt):.1e})   Ньютон F = {Fn:.8f} ({abs(Fn - F_opt):.1e})")\n    pg, pn = sig(Fg), sig(Fn)\n    Fg += nu * (y - pg).mean()                                   # средний остаток\n    Fn += nu * (y - pn).sum() / (len(y) * pn * (1 - pn) + lam)   # −G/(H + λ)\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр: знак f″, тип точки, выпуклость, шаг Ньютона
   * ============================================================================== */
  const GS = [
    { t: 'x³/3 − x', f: (x) => x ** 3 / 3 - x, d: (x) => x * x - 1, d2: (x) => 2 * x, dom: [-2.6, 2.6] },
    { t: 'sin x', f: Math.sin, d: Math.cos, d2: (x) => -Math.sin(x), dom: [-4, 4] },
    { t: 'x⁴ − 2x²', f: (x) => x ** 4 - 2 * x * x, d: (x) => 4 * x ** 3 - 4 * x, d2: (x) => 12 * x * x - 4, dom: [-1.8, 1.8] },
    { t: 'x·e^(−x)', f: (x) => x * Math.exp(-x), d: (x) => (1 - x) * Math.exp(-x), d2: (x) => (x - 2) * Math.exp(-x), dom: [-0.5, 6] },
    { t: 'e^(−x²/2)', f: (x) => Math.exp(-x * x / 2), d: (x) => -x * Math.exp(-x * x / 2), d2: (x) => (x * x - 1) * Math.exp(-x * x / 2), dom: [-3, 3] },
  ];
  const GT = [
    { t: 'x³/3 − x', f: (x) => x ** 3 / 3 - x, a: 1, dom: [-2.4, 2.4], ans: 'min', why: 'f″(1) = 2 > 0 — минимум.' },
    { t: 'x³/3 − x', f: (x) => x ** 3 / 3 - x, a: -1, dom: [-2.4, 2.4], ans: 'max', why: 'f″(−1) = −2 < 0 — максимум.' },
    { t: 'x⁴ − 4x³', f: (x) => x ** 4 - 4 * x ** 3, a: 0, dom: [-1.2, 4.2], ans: 'none', why: 'f″(0) = 0, f‴(0) = −24 ≠ 0: порядок 3 нечётный — терраса.' },
    { t: 'x⁴ − 4x³', f: (x) => x ** 4 - 4 * x ** 3, a: 3, dom: [-1.2, 4.2], ans: 'min', why: 'f″(3) = 36 > 0 — минимум.' },
    { t: 'x³', f: (x) => x ** 3, a: 0, dom: [-1.5, 1.5], ans: 'none', why: 'f″(0) = 0, f‴ = 6 ≠ 0 — терраса.' },
    { t: '−x⁴', f: (x) => -(x ** 4), a: 0, dom: [-1.5, 1.5], ans: 'max', why: 'Первая ненулевая производная — f⁽⁴⁾ = −24 (чётный порядок, минус) — максимум.' },
    { t: 'x·e^(−x)', f: (x) => x * Math.exp(-x), a: 1, dom: [-0.5, 6], ans: 'max', why: 'f″(1) = −1/e < 0 — максимум.' },
    { t: 'cos x', f: Math.cos, a: Math.PI, dom: [0, 6.3], ans: 'min', why: 'f″(π) = −cos π = 1 > 0 — минимум.' },
    { t: 'x⁴', f: (x) => x ** 4, a: 0, dom: [-1.5, 1.5], ans: 'min', why: 'f″(0) = 0, но первая ненулевая — f⁽⁴⁾ = 24 > 0 (чётный порядок) — минимум.' },
  ];
  const GC = [
    { t: 'x² + eˣ', f: (x) => x * x + Math.exp(x), dom: [-2.5, 1.5], ans: true, why: 'f″ = 2 + eˣ > 0.' },
    { t: 'x⁴ − x²', f: (x) => x ** 4 - x * x, dom: [-1.2, 1.2], ans: false, why: 'f″ = 12x² − 2 < 0 при |x| < 0.41.' },
    { t: '|x| + x²', f: (x) => Math.abs(x) + x * x, dom: [-1.5, 1.5], ans: true, why: 'Сумма выпуклых функций.' },
    { t: 'sin x + x²/4', f: (x) => Math.sin(x) + x * x / 4, dom: [-4, 4], ans: false, why: 'f″ = −sin x + ½ < 0, где sin x > ½.' },
    { t: 'x² + sin x', f: (x) => x * x + Math.sin(x), dom: [-3, 3], ans: true, why: 'f″ = 2 − sin x ≥ 1 > 0.' },
    { t: 'ln(1 + eˣ)', f: (x) => softplus(x), dom: [-4, 4], ans: true, why: 'f″ = σ(1 − σ) > 0.' },
    { t: 'x³ на [−1, 2]', f: (x) => x ** 3, dom: [-1, 2], ans: false, why: 'f″ = 6x < 0 при x < 0.' },
    { t: 'e^(−x²)', f: (x) => Math.exp(-x * x), dom: [-2.5, 2.5], ans: false, why: 'Колокол: купол в середине.' },
    { t: '1/x при x > 0', f: (x) => 1 / x, dom: [0.3, 4], ans: true, why: 'f″ = 2/x³ > 0.' },
    { t: '(1 − σ(x))² — MSE по вероятности', f: (x) => (1 - sigma(x)) ** 2, dom: [-6, 6], ans: false, why: 'f″ < 0 при x < −ln 2.' },
  ];
  const GN = [
    { t: 'eˣ − 2x', f: (x) => Math.exp(x) - 2 * x, d: (x) => Math.exp(x) - 2, d2: Math.exp, x0s: [0, 1, 2, -1], dom: [-1.5, 2.6] },
    { t: '(x − 2)² + 1', f: (x) => (x - 2) ** 2 + 1, d: (x) => 2 * (x - 2), d2: () => 2, x0s: [0, 1, 3.5, 5], dom: [-0.5, 5.5] },
    { t: 'x² + e^(−x)', f: (x) => x * x + Math.exp(-x), d: (x) => 2 * x - Math.exp(-x), d2: (x) => 2 + Math.exp(-x), x0s: [0, 1, -1, 2], dom: [-1.5, 2.5] },
    { t: 'log-loss трёх объектов (1, 1, 0)', f: ll3.f, d: ll3.d, d2: ll3.d2, x0s: [0, -1, 1, 2], dom: [-3, 4] },
  ];
  GBC.widget('curvature-game', (el) => {
    const s = { seed: 21, round: 0, right: 0, streak: 0, q: null, picked: null, mode: 'mix' };
    const w = ui.shell(el, { title: 'Тренажёр второго порядка', sub: 'Выберите тип вопросов или «вперемешку». Ответ — кнопкой слева; после ответа появится разбор.' });
    ui.select(w.controls, { label: 'Вопросы', value: s.mode, options: [{ value: 'mix', label: 'вперемешку' }, { value: 'sign', label: 'знак f″ по графику' }, { value: 'type', label: 'тип критической точки' }, { value: 'convex', label: 'выпукла ли функция' }, { value: 'newton', label: 'шаг Ньютона' }], onChange: (v) => ((s.mode = v), newQ()) });
    const qEl = H('div', { class: 'ctl-label', style: 'font-weight:650;line-height:1.45' });
    w.controls.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;gap:8px' });
    w.controls.appendChild(optsBox);
    const next = ui.button(w.controls, { label: 'Следующая', icon: 'step', onClick: () => newQ() });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function newQ() {
      const rng = new GBC.RNG(s.seed++);
      const kinds = ['sign', 'type', 'convex', 'newton'];
      const kind = s.mode === 'mix' ? kinds[rng.randint(4)] : s.mode;
      let q;
      if (kind === 'sign') {
        const F = GS[rng.randint(GS.length)];
        let x = 0;
        for (let i = 0; i < 60; i++) {
          x = rng.uniform(F.dom[0] * 0.85, F.dom[1] * 0.85);
          if (Math.abs(F.d2(x)) > 0.3) break;
        }
        q = { kind, F, x, ans: Math.sign(F.d2(x)), text: 'f(x) = ' + F.t + '. Как изогнут график в оранжевой точке?', opts: [{ v: 1, label: '∪ чаша: f″ > 0' }, { v: -1, label: '∩ купол: f″ < 0' }] };
      } else if (kind === 'type') {
        const T = GT[rng.randint(GT.length)];
        q = { kind, T, ans: T.ans, text: 'f(x) = ' + T.t + ', в точке x = ' + f2(T.a) + ' производная f′ = 0. Что это за точка?', opts: [{ v: 'min', label: 'минимум' }, { v: 'max', label: 'максимум' }, { v: 'none', label: 'экстремума нет' }] };
      } else if (kind === 'convex') {
        const C = GC[rng.randint(GC.length)];
        q = { kind, C, ans: C.ans, text: 'Выпукла ли функция ' + C.t + ' на показанном промежутке?', opts: [{ v: true, label: 'да, выпукла' }, { v: false, label: 'нет' }] };
      } else {
        const N = GN[rng.randint(GN.length)];
        const x0 = N.x0s[rng.randint(N.x0s.length)];
        const d = N.d(x0);
        const d2 = N.d2(x0);
        const right = x0 - d / d2;
        const cands = [right, x0 - d, x0 + d / d2, x0 - d2 / d];
        const uniq = [];
        cands.forEach((v) => {
          if (Number.isFinite(v) && !uniq.some((u) => Math.abs(u - v) < 5e-3)) uniq.push(v);
        });
        while (uniq.length < 3) uniq.push(right + uniq.length * 0.7);
        const order = rng.permutation(uniq.length);
        q = { kind, N, x0, ans: 0, text: 'f(x) = ' + N.t + ', x₀ = ' + f2(x0) + ': f′(x₀) = ' + f3(d) + ', f″(x₀) = ' + f3(d2) + '. Куда приведёт шаг Ньютона?', opts: order.map((i) => ({ v: i, label: 'x₁ = ' + f3(uniq[i]) })) };
      }
      s.q = q;
      s.picked = null;
      s.round++;
      qEl.textContent = q.text;
      choiceButtons(optsBox, q.opts, pick);
      draw();
    }
    function pick(v) {
      if (s.picked !== null) return;
      s.picked = v;
      const ok = v === s.q.ans;
      if (ok) (s.right++, s.streak++);
      else s.streak = 0;
      [...optsBox.querySelectorAll('button')].forEach((b) => (b.disabled = true));
      draw();
    }
    function draw() {
      const q = s.q;
      const done = s.picked !== null;
      const ok = done && s.picked === q.ans;
      let layers;
      let dom;
      let why = '';
      if (q.kind === 'sign') {
        const { F, x } = q;
        dom = F.dom;
        const grid = U.linspace(F.dom[0], F.dom[1], 300);
        const win = U.linspace(x - 0.6, x + 0.6, 60);
        layers = [
          { type: 'line', x: grid, y: grid.map(F.f), color: 'model', width: 2.4, hover: false },
          done ? { type: 'line', x: win, y: win.map((t) => F.f(x) + F.d(x) * (t - x) + 0.5 * F.d2(x) * (t - x) ** 2), color: 'violet', width: 2, dash: '5 4', hover: false } : null,
          { type: 'points', x: [x], y: [F.f(x)], color: 'tree', r: 7 },
        ];
        why = 'f″(' + f2(x) + ') = ' + f3(F.d2(x)) + ': ' + (F.d2(x) > 0 ? 'чаша — наклон растёт.' : 'купол — наклон падает.') + ' Пунктир — парабола с той же f″.';
      } else if (q.kind === 'type') {
        const T = q.T;
        dom = T.dom;
        const grid = U.linspace(T.dom[0], T.dom[1], 300);
        layers = [
          { type: 'line', x: grid, y: grid.map(T.f), color: 'model', width: 2.4, hover: false },
          { type: 'hline', y: T.f(T.a), color: 'muted', dash: '3 3', width: 1 },
          { type: 'points', x: [T.a], y: [T.f(T.a)], color: 'tree', r: 7 },
        ];
        why = T.why;
      } else if (q.kind === 'convex') {
        const C = q.C;
        dom = C.dom;
        const grid = U.linspace(C.dom[0], C.dom[1], 300);
        layers = [{ type: 'line', x: grid, y: grid.map(C.f), color: 'model', width: 2.4, hover: false }];
        why = C.why;
      } else {
        const { N, x0 } = q;
        dom = N.dom;
        const grid = U.linspace(N.dom[0], N.dom[1], 300);
        const x1 = x0 - N.d(x0) / N.d2(x0);
        const par = (t) => N.f(x0) + N.d(x0) * (t - x0) + 0.5 * N.d2(x0) * (t - x0) ** 2;
        layers = [
          { type: 'line', x: grid, y: grid.map(N.f), color: 'model', width: 2.4, hover: false },
          done ? { type: 'line', x: grid, y: grid.map(par), color: 'violet', width: 1.8, dash: '5 4', hover: false } : null,
          done ? { type: 'points', x: [x1], y: [par(x1)], color: 'violet', r: 6, hollow: true } : null,
          { type: 'points', x: [x0], y: [N.f(x0)], color: 'tree', r: 7 },
        ];
        why = 'x₁ = x₀ − f′/f″ = ' + f2(x0) + ' − (' + f3(N.d(x0)) + ')/' + f3(N.d2(x0)) + ' = ' + f3(x1) + ' — дно параболы (пунктир). Частые ловушки: x₀ − f′ (это спуск с η = 1) и x₀ + f′/f″ (не тот знак).';
      }
      plot.render(layers, { x: dom, y: yRange((t) => (q.kind === 'sign' ? q.F.f(t) : q.kind === 'type' ? q.T.f(t) : q.kind === 'convex' ? q.C.f(t) : q.N.f(t)), U.linspace(dom[0], dom[1], 200), 0.15) });
      st.set('r', String(s.round));
      st.set('ok', s.right + ' из ' + (s.round - (done ? 0 : 1)));
      st.set('s', String(s.streak));
      const hint = { sign: 'Подсказка: налейте воду в график в этой точке — удержится (чаша) или стечёт (купол)?', type: 'Подсказка: посмотрите, с какой стороны от пунктирной горизонтали график слева и справа от точки.', convex: 'Подсказка: найдите хорду, которая проходит под графиком, — тогда функция не выпукла.', newton: 'Подсказка: шаг Ньютона Δ = −f′/f″.' };
      note.innerHTML = done ? (ok ? '<b>Верно!</b> ' : '<b>Нет.</b> ') + why : hint[q.kind];
      next.textContent = '';
      next.append(ui.icon('step'), done ? 'Следующая' : 'Пропустить');
    }
    w.pythonAction(() => 'import numpy as np\n\n# Самопроверка: знак f″ второй разностью\nf = lambda x: np.sin(x)\nfor x in [-2.0, -0.5, 0.5, 2.0]:\n    h = 1e-4\n    d2 = (f(x + h) - 2 * f(x) + f(x - h)) / h**2\n    print(f"x = {x:+.1f}: f″ ≈ {d2:+.4f} →", "чаша" if d2 > 0 else "купол")\n');
    newQ();
  });
})();
