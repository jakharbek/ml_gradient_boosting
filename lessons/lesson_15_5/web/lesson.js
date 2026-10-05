/* Урок 15.5: производная. Часть 1 — определение, три смысла производной, точки без производной.
 * Виджеты: спуск в тумане, приращения, предел разностного отношения, решатель «по определению»,
 * построение f′ по точкам, наклон прямой, секущая → касательная, касательная и нормаль, движение мяча,
 * микроскоп, линейное приближение, скорости в разных науках, односторонние производные, галерея точек
 * без производной, лестница гладкости, субградиент.
 * Общие помощники выставлены в GBC.lesson155 — ими пользуется lesson_extra.js (часть 2). */
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
  /** Сетка по x, сгущающаяся к точке a (крутые и колеблющиеся участки выходят гладкими). */
  function denseNear(x0, x1, a, n = 700) {
    const xs = U.linspace(x0, x1, n);
    const span = Math.max(Math.abs(x1 - a), Math.abs(a - x0));
    for (let i = 0; i <= 300; i++) {
      const t = span * Math.pow(10, -5 + (5 * i) / 300);
      if (a + t > x0 && a + t < x1) xs.push(a + t);
      if (a - t > x0 && a - t < x1) xs.push(a - t);
    }
    return xs.sort((p, q) => p - q);
  }
  const logspace = (p0, p1, n) => U.linspace(p0, p1, n).map((p) => Math.pow(10, p));
  const decadeTicks = (p0, p1, step = 1) => {
    const t = [];
    for (let p = p0; p <= p1; p += step) t.push(Math.pow(10, p));
    return t;
  };
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  /** Подпись логарифмической оси: 10⁻⁶, 0.01, 1, 100, 10⁴. */
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
  function rowTable(parent, columns, rows, highlight) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight });
  }
  /** Числовая производная (центральная разность). */
  const nd = (f, x, h = 1e-6) => (f(x + h) - f(x - h)) / (2 * h);
  const py = (v) => (v === Infinity ? 'np.inf' : v === -Infinity ? '-np.inf' : U.pyNum(v));
  const sigma = (z) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));
  const STARS = ['', '★', '★★', '★★★'];
  /** Корни g на [x0, x1]: смена знака на сетке + деление пополам. */
  function roots(g, x0, x1, n = 2000) {
    const xs = U.linspace(x0, x1, n + 1);
    const out = [];
    let pa = g(xs[0]);
    for (let i = 1; i <= n; i++) {
      const b = xs[i];
      const pb = g(b);
      if (Number.isFinite(pa) && Number.isFinite(pb)) {
        if (pa === 0) out.push(xs[i - 1]);
        else if (pa * pb < 0) {
          let lo = xs[i - 1];
          let hi = b;
          let flo = pa;
          for (let k = 0; k < 60; k++) {
            const m = (lo + hi) / 2;
            const fm = g(m);
            if (fm === 0) (lo = m), (hi = m);
            else if (flo * fm < 0) hi = m;
            else (lo = m), (flo = fm);
          }
          out.push((lo + hi) / 2);
        }
      }
      pa = pb;
    }
    return out.filter((r, i) => i === 0 || Math.abs(r - out[i - 1]) > 1e-6);
  }
  /** Диапазон по y по значениям функции (с полями). */
  const yRange = (fn, xs, pad = 0.12) => {
    const ys = xs.map(fn).filter(Number.isFinite);
    const [lo, hi] = U.extent(ys);
    const d = (hi - lo) * pad || 1;
    return [lo - d, hi + d];
  };
  /** Отрезок касательной в точке a длиной 2·half по оси x. */
  function tanSeg(F, a, half) {
    const s = F.df(a);
    return { x1: [a - half], y1: [F.f(a) - half * s], x2: [a + half], y2: [F.f(a) + half * s] };
  }

  /* ------------------------------------------------------------------------------
   * Библиотека функций урока: значение, производная, область, код для Python.
   * ------------------------------------------------------------------------------ */
  const FN = {
    sq: { label: 'x² (парабола)', f: (x) => x * x, df: (x) => 2 * x, dom: [-2.5, 2.5], py: ['x**2', '2 * x'], crit: [0], a0: 1 },
    cubic: { label: 'x³/3 − x (горка и яма)', f: (x) => (x * x * x) / 3 - x, df: (x) => x * x - 1, dom: [-2.6, 2.6], py: ['x**3 / 3 - x', 'x**2 - 1'], crit: [-1, 1], a0: 0.5 },
    cube: { label: 'x³ («полочка»)', f: (x) => x * x * x, df: (x) => 3 * x * x, dom: [-1.6, 1.6], py: ['x**3', '3 * x**2'], crit: [0], a0: 1 },
    sin: { label: 'sin x (волна)', f: Math.sin, df: Math.cos, dom: [-3.5, 3.5], py: ['np.sin(x)', 'np.cos(x)'], crit: [-Math.PI / 2, Math.PI / 2], a0: 1 },
    exp: { label: 'eˣ (экспонента)', f: Math.exp, df: Math.exp, dom: [-2.5, 1.6], py: ['np.exp(x)', 'np.exp(x)'], crit: [], a0: 0 },
    ln: { label: 'ln x (логарифм)', f: Math.log, df: (x) => 1 / x, dom: [0.1, 4], py: ['np.log(x)', '1 / x'], crit: [], a0: 1 },
    sqrt: { label: '√x (корень)', f: (x) => Math.sqrt(x), df: (x) => (x > 0 ? 1 / (2 * Math.sqrt(x)) : NaN), dom: [0, 4], py: ['np.sqrt(x)', '1 / (2 * np.sqrt(x))'], crit: [], a0: 1, edge: 0 },
    recip: { label: '1/x (гипербола)', f: (x) => 1 / x, df: (x) => -1 / (x * x), dom: [0.25, 4], py: ['1 / x', '-1 / x**2'], crit: [], a0: 1 },
    abs: { label: '|x| (излом в нуле)', f: Math.abs, df: (x) => (x > 0 ? 1 : x < 0 ? -1 : NaN), dom: [-2, 2], py: ['np.abs(x)', 'np.sign(x)'], crit: [], a0: 1, kink: [0] },
    bump: { label: 'x·e⁻ˣ (горб)', f: (x) => x * Math.exp(-x), df: (x) => (1 - x) * Math.exp(-x), dom: [-0.6, 5], py: ['x * np.exp(-x)', '(1 - x) * np.exp(-x)'], crit: [1], a0: 2 },
    sigm: { label: 'σ(x) (сигмоида)', f: sigma, df: (x) => sigma(x) * (1 - sigma(x)), dom: [-6, 6], py: ['1 / (1 + np.exp(-x))', 'np.exp(-x) / (1 + np.exp(-x))**2'], crit: [], a0: 0 },
  };
  const fnOpts = (keys) => keys.map((k) => ({ value: k, label: FN[k].label }));
  const pyHead = (F) => 'import numpy as np\nimport matplotlib.pyplot as plt\n\nf = lambda x: ' + F.py[0] + '\ndf = lambda x: ' + F.py[1] + '  # производная\n';

  /* ==============================================================================
   * 0. Спуск в тумане: видно только склон под ногами
   * ============================================================================== */
  const HILL = { f: (t) => 0.1 * t ** 4 - 0.6 * t * t + 0.3 * t + 2, df: (t) => 0.4 * t ** 3 - 1.2 * t + 0.3 };
  GBC.widget('fog-walk', (el) => {
    const s = { t0: 2.5, eta: 0.3, fog: true, r: 0.6, k: 0 };
    const MAXK = 40;
    const w = ui.shell(el, { title: 'Спуск в тумане', sub: 'Путник видит только землю под ногами (светлое окно). Каждый шаг: θ ← θ − η·f′(θ). Кликните по графику, чтобы поставить путника в другое место.' });
    ui.slider(w.controls, { label: 'Длина шага η', min: 0.05, max: 1, step: 0.05, value: s.eta, onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Видимость в тумане', min: 0.2, max: 3, step: 0.1, value: s.r, onInput: (v) => ((s.r = v), draw()) });
    ui.toggle(w.controls, { label: 'Туман', checked: true, onChange: (v) => ((s.fog = v), draw()) });
    const pl = ui.player(w.controls, { label: 'Шаги', min: 0, max: MAXK, value: 0, fps: 4, format: (v) => 'шаг ' + v, onChange: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'положение θ', domain: [-3, 3] }, y: { label: 'высота f(θ)', domain: [0, 6] } });
    plot.onClick = (x) => {
      s.t0 = U.clamp(x, -2.9, 2.9);
      pl.stop();
      pl.set(0);
      s.k = 0;
      draw();
    };
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'шаг' }, { key: 't', label: 'θ' }, { key: 'f', label: 'высота f(θ)' }, { key: 'g', label: 'уклон f′(θ)' }, { key: 'dir', label: 'куда шагнуть' }]);
    function path() {
      const ts = [s.t0];
      for (let k = 0; k < MAXK; k++) ts.push(U.clamp(ts[k] - s.eta * HILL.df(ts[k]), -3, 3));
      return ts;
    }
    function draw() {
      const ts = path();
      const t = ts[s.k];
      const g = HILL.df(t);
      const xs = U.linspace(-3, 3, 400);
      const lo = s.fog ? t - s.r : -3;
      const hi = s.fog ? t + s.r : 3;
      const vis = xs.filter((x) => x >= lo && x <= hi);
      const trail = ts.slice(0, s.k + 1);
      const step = -s.eta * g;
      const layers = [];
      if (s.fog) {
        layers.push({ type: 'vband', x0: -3, x1: Math.max(-3, lo), color: 'muted', opacity: 0.38 });
        layers.push({ type: 'vband', x0: Math.min(3, hi), x1: 3, color: 'muted', opacity: 0.38 });
      }
      layers.push({ type: 'line', x: vis, y: vis.map(HILL.f), color: 'model', width: 2.2, label: s.fog ? 'видимый склон' : 'рельеф f(θ)' });
      layers.push({ type: 'segments', ...tanSeg(HILL, t, 0.55), color: 'tree', width: 2.5, opacity: 1 });
      layers.push({ type: 'points', x: trail.slice(0, -1), y: trail.slice(0, -1).map(HILL.f), color: 'ink2', r: 3, opacity: 0.55, label: 'пройденный путь', tooltip: (i) => [['шаг', String(i)], ['θ', U.fmt(trail[i], 3)]] });
      if (Math.abs(step) > 0.02) layers.push({ type: 'arrows', x1: [t], y1: [HILL.f(t) - 0.45], x2: [U.clamp(t + step, -3, 3)], y2: [HILL.f(t) - 0.45], color: 'ink', width: 2 });
      layers.push({ type: 'points', x: [t], y: [HILL.f(t)], color: 'tree', r: 7, label: 'путник', tooltip: () => [['θ', U.fmt(t, 3)], ['f′(θ)', U.fmt(g, 3)]] });
      plot.render(layers);
      st.set('k', String(s.k));
      st.set('t', U.fmt(t, 3));
      st.set('f', U.fmt(HILL.f(t), 3));
      st.set('g', U.fmt(g, 3));
      st.set('dir', Math.abs(g) < 0.01 ? 'стоим' : g > 0 ? '← влево' : 'вправо →');
      if (Math.abs(g) < 0.01) {
        note.innerHTML = 'Уклон под ногами ≈ 0 — шагать некуда: путник в яме. ' + (t > 0
          ? '<b>Но это не самая низкая яма:</b> f ≈ ' + U.fmt(HILL.f(t), 2) + ', а слева, при θ ≈ −1.85, есть яма глубже (f ≈ 0.56). Снимите туман, чтобы её увидеть. Производная знает только то, что рядом.'
          : 'Это самая глубокая яма рельефа: θ ≈ −1.85, f ≈ 0.56.');
      } else if (Math.abs(step) > 1.2) note.innerHTML = 'Склон крутой, а шаг длинный: путник перепрыгивает через яму. Длина шага — это η·|f′|.';
      else note.innerHTML = 'Уклон f′(θ) = ' + U.fmt(g, 2) + (g > 0 ? ' > 0: справа выше, поэтому идём <b>влево</b>.' : ' &lt; 0: слева выше, поэтому идём <b>вправо</b>.') + ' Чем круче склон, тем длиннее шаг.';
    }
    w.pythonAction(() => 'import numpy as np\n\nf = lambda t: 0.1 * t**4 - 0.6 * t**2 + 0.3 * t + 2\ndf = lambda t: 0.4 * t**3 - 1.2 * t + 0.3   # уклон под ногами\n\nt, eta = ' + U.pyNum(s.t0) + ', ' + U.pyNum(s.eta) + '\nfor k in range(' + Math.max(1, s.k) + '):\n    t = float(np.clip(t - eta * df(t), -3, 3))\n    print(f"шаг {k + 1:2d}: θ = {t: .4f}, f = {f(t):.4f}, f\'(θ) = {df(t): .4f}")\n');
    draw();
  });

  /* ==============================================================================
   * 1. Приращения Δx, Δf и разностное отношение
   * ============================================================================== */
  GBC.widget('increment-lab', (el) => {
    const KEYS = ['sq', 'sqrt', 'recip', 'sin', 'cubic'];
    const s = { fn: 'sq', a: 1, dx: 0.5 };
    const w = ui.shell(el, { title: 'Приращения и разностное отношение', sub: 'A = (a, f(a)), B = (a + Δx, f(a + Δx)). Тяните точку B или ползунки; Δx может быть и отрицательным. Отношение Δf / Δx — средняя скорость изменения f на отрезке и наклон прямой AB.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: fnOpts(KEYS), onChange: (v) => {
      s.fn = v;
      const F = FN[v];
      aSl.input.min = F.dom[0] + (F.edge === 0 ? 0.5 : 0.3);
      aSl.input.max = F.dom[1] - 0.3;
      s.a = F.a0;
      aSl.set(s.a);
      draw();
    } });
    const aSl = ui.slider(w.controls, { label: 'Точка a', min: -2.2, max: 2.2, step: 0.05, value: s.a, onInput: (v) => ((s.a = v), draw()) });
    const dSl = ui.slider(w.controls, { label: 'Сдвиг Δx', min: -1.5, max: 1.5, step: 0.05, value: s.dx, onInput: (v) => ((s.dx = Math.abs(v) < 0.025 ? 0.05 : v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'fa', label: 'f(a)' }, { key: 'dx', label: 'Δx' }, { key: 'df', label: 'Δf = f(a + Δx) − f(a)' }, { key: 'q', label: 'Δf / Δx' }]);
    function draw() {
      const F = FN[s.fn];
      const a = U.clamp(s.a, F.dom[0] + (F.edge === 0 ? 0.5 : 0.3), F.dom[1] - 0.3);
      const dx = U.clamp(s.dx, F.dom[0] - a, F.dom[1] - a) || 0.05;
      const b = a + dx;
      const fa = F.f(a);
      const fb = F.f(b);
      const df = fb - fa;
      const q = df / dx;
      const c = curve(F.f, F.dom[0], F.dom[1], 501);
      const lx = [F.dom[0], F.dom[1]];
      plot.render([
        { type: 'line', x: c.x, y: c.y, color: 'model', width: 2.2, label: 'f(x) = ' + F.label.split(' (')[0], hover: false },
        { type: 'line', x: lx, y: lx.map((x) => fa + q * (x - a)), color: 'aqua', width: 1.8, label: 'прямая AB (секущая)', hover: false },
        { type: 'segments', x1: [a, b], y1: [fa, fa], x2: [b, b], y2: [fa, fb], color: 'tree', width: 2.2, opacity: 1, dash: '5 4' },
        { type: 'text', items: [
          { x: (a + b) / 2, y: fa, dy: df >= 0 ? 16 : -8, anchor: 'middle', text: 'Δx = ' + U.fmt(dx, 2) },
          { x: b, y: (fa + fb) / 2, dx: dx >= 0 ? 6 : -6, anchor: dx >= 0 ? 'start' : 'end', text: 'Δf = ' + U.fmt(df, 3) },
          { x: a, y: fa, dx: -8, dy: -8, anchor: 'end', text: 'A', bold: true },
          { x: b, y: fb, dx: 8, dy: -8, text: 'B', bold: true },
        ] },
        { type: 'points', x: [a], y: [fa], color: 'ink', r: 6 },
        { type: 'points', x: [b], y: [fb], color: 'tree', r: 7, draggable: true, onDrag: (i, x) => {
          let v = Math.round((x - a) * 20) / 20;
          if (Math.abs(v) < 0.05) v = v < 0 ? -0.05 : 0.05;
          s.dx = U.clamp(v, -1.5, 1.5);
          dSl.set(s.dx);
          draw();
        } },
      ], { x: F.dom, y: yRange(F.f, U.linspace(F.dom[0], F.dom[1], 200), 0.15) });
      st.set('fa', U.fmt(fa, 4));
      st.set('dx', U.fmt(dx, 3));
      st.set('df', U.fmt(df, 4));
      st.set('q', U.fmt(q, 4));
      const ds = [1, 0.5, 0.1, -0.1, -0.5, -1].filter((d) => a + d >= F.dom[0] && a + d <= F.dom[1] && Number.isFinite(F.f(a + d)));
      rowTable(tbl, ['Δx', ...ds.map((d) => U.fmt(d, 2))], [
        ['Δf', ...ds.map((d) => U.fmt(F.f(a + d) - fa, 4))],
        ['Δf / Δx', ...ds.map((d) => U.fmt((F.f(a + d) - fa) / d, 4))],
      ]);
      let msg = 'На отрезке от ' + U.fmt(Math.min(a, b), 2) + ' до ' + U.fmt(Math.max(a, b), 2) + ' функция в среднем меняется на <b>' + U.fmt(q, 3) + '</b> на единицу x. ';
      if (dx < 0) msg += 'Δx &lt; 0: точка B левее A. ' + (df < 0 ? 'Δf тоже отрицательно, и отношение положительно — функция растёт.' : 'Δf ≥ 0 при Δx &lt; 0 — функция убывает: отношение ≤ 0.');
      else msg += Math.abs(dx) <= 0.1 ? 'Сдвиг уже маленький — отношение почти не меняется при дальнейшем уменьшении Δx. К какому числу оно стремится, — следующий шаг.' : 'Уменьшайте |Δx| и следите за таблицей: отношения с разных сторон сближаются.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const F = FN[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + F.py[0] + '\na = ' + U.pyNum(s.a) + '\nfor dx in [1, 0.5, 0.1, ' + U.pyNum(s.dx) + ', -0.1, -0.5]:\n    df = f(a + dx) - f(a)\n    print(f"Δx = {dx:6}: Δf = {df: .5f}, Δf/Δx = {df / dx: .5f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 2. Предел разностного отношения: график q(h) с дыркой в нуле
   * ============================================================================== */
  const LIMQ = {
    sq3: { label: 'x² в точке a = 3', f: (x) => x * x, a: 3, L: 6, py: 'x**2' },
    sqrt4: { label: '√x в точке a = 4', f: Math.sqrt, a: 4, L: 0.25, py: 'np.sqrt(x)' },
    recip1: { label: '1/x в точке a = 1', f: (x) => 1 / x, a: 1, L: -1, py: '1 / x', hmax: 0.8 },
    sin0: { label: 'sin x в точке a = 0', f: Math.sin, a: 0, L: 1, py: 'np.sin(x)' },
    exp0: { label: 'eˣ в точке a = 0', f: Math.exp, a: 0, L: 1, py: 'np.exp(x)' },
    abs0: { label: '|x| в точке a = 0 — ловушка', f: Math.abs, a: 0, L: null, py: 'np.abs(x)' },
  };
  GBC.widget('limit-table', (el) => {
    const s = { c: 'sqrt4', k: 0 };
    const NK = 40;
    const hOf = (k) => Math.pow(10, (-4 * k) / NK);
    const w = ui.shell(el, { title: 'Предел разностного отношения', sub: 'График q(h) = (f(a + h) − f(a)) / h как функции шага h. В самой точке h = 0 он не определён (делить на 0 нельзя) — там дырка. Нажмите ▶: h сжимается от 1 до 0.0001 с обеих сторон, а значения q подходят к пределу — производной f′(a).' });
    ui.select(w.controls, { label: 'Функция и точка', value: s.c, options: Object.entries(LIMQ).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.c = v), draw()) });
    ui.player(w.controls, { label: 'Сжимаем h', min: 0, max: NK, value: 0, fps: 6, format: (k) => 'h = ±' + powFmt(hOf(k)), onChange: (k) => ((s.k = k), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'шаг h', domain: [-1.05, 1.05] }, y: { label: 'q(h) — наклон секущей' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'h', label: '|h|' }, { key: 'qp', label: 'q(+h)' }, { key: 'qm', label: 'q(−h)' }, { key: 'L', label: 'предел' }]);
    function draw() {
      const C = LIMQ[s.c];
      const q = (h) => (C.f(C.a + h) - C.f(C.a)) / h;
      const hm = C.hmax || 1;
      const hs = U.linspace(-hm, hm, 801).filter((h) => Math.abs(h) > 1e-9);
      const left = hs.filter((h) => h < 0);
      const right = hs.filter((h) => h > 0);
      const h = Math.min(hOf(s.k), hm);
      const layers = [
        { type: 'vline', x: 0, color: 'axis', width: 1 },
        { type: 'line', x: left, y: left.map(q), color: 'model', width: 2.4, label: 'q(h)', hover: false },
        { type: 'line', x: right, y: right.map(q), color: 'model', width: 2.4, hover: false },
      ];
      if (C.L !== null) {
        layers.push({ type: 'hline', y: C.L, color: 'tree', dash: '6 4', width: 1.4, text: 'f′(a) = ' + U.fmt(C.L, 4) });
        layers.push({ type: 'points', x: [0], y: [C.L], color: 'model', r: 5.5, hollow: true, label: 'дырка: q(0) не определено' });
      } else layers.push({ type: 'points', x: [0, 0], y: [1, -1], color: 'model', r: 5.5, hollow: true, label: 'дырки: справа 1, слева −1' });
      layers.push({ type: 'points', x: [-h, h], y: [q(-h), q(h)], color: (i) => (i ? 'violet' : 'aqua'), r: 6, label: 'текущие ±h', legendColor: 'violet', tooltip: (i) => [['h', U.fmt(i ? h : -h, 5)], ['q(h)', U.fmt(q(i ? h : -h), 6)]] });
      const yv = hs.map(q).filter(Number.isFinite);
      let [lo, hi] = U.extent(yv);
      if (C.L !== null) (lo = Math.min(lo, C.L)), (hi = Math.max(hi, C.L));
      const pad = (hi - lo) * 0.15 || 0.5;
      plot.render(layers, { y: [lo - pad, hi + pad] });
      const H4 = [0.1, 0.01, 0.001].map((v) => v * hm);
      rowTable(tbl, ['h', ...H4.map((v) => '−' + U.fmt(v, 4)), ...H4.slice().reverse().map((v) => '+' + U.fmt(v, 4))],
        [['q(h)', ...H4.map((v) => U.fmt(q(-v), 6)), ...H4.slice().reverse().map((v) => U.fmt(q(v), 6))]]);
      st.set('h', powFmt(h));
      st.set('qp', U.fmt(q(h), 7));
      st.set('qm', U.fmt(q(-h), 7));
      st.set('L', C.L === null ? 'нет' : U.fmt(C.L, 4));
      if (C.L === null) note.innerHTML = 'Справа q(h) = |h|/h = <b>+1</b> при любом h, слева <b>−1</b>. Две ветки не сходятся к одному числу — предела нет, и <b>производной |x| в нуле не существует</b>. Подробно — шаги 11–12.';
      else note.innerHTML = 'При |h| = ' + powFmt(h) + ' значения с двух сторон отличаются от ' + U.fmt(C.L, 4) + ' на ' + U.fmt(Math.max(Math.abs(q(h) - C.L), Math.abs(q(-h) - C.L)), 2) + '. Дырку в h = 0 «заклеивает» предел: <b>f′(' + C.a + ') = ' + U.fmt(C.L, 4) + '</b>. ' + (s.c === 'sqrt4' ? 'Слева значения чуть больше, справа чуть меньше: корень изгибается вниз.' : s.c === 'sq3' ? 'Для x² график q(h) — прямая q = 6 + h: ошибка ровно h.' : '');
    }
    w.pythonAction(() => {
      const C = LIMQ[s.c];
      return 'import numpy as np\n\nf = lambda x: ' + C.py + '\na = ' + C.a + '\nq = lambda h: (f(a + h) - f(a)) / h   # разностное отношение\nfor h in [' + [1, 0.1, 0.01, 0.001, 1e-4].map((v) => U.pyNum(v * (C.hmax || 1))).join(', ') + ']:\n    print(f"h = ±{h:<6}: q(+h) = {q(h):.7f}, q(−h) = {q(-h):.7f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 3. Производная по определению: решатель по шагам
   * ============================================================================== */
  const R = String.raw;
  const DEF = [
    { lvl: 1, name: 'константа f(x) = 5', tex: R`f(x)=5`, x0: 1, q: () => 0, L: 0, py: 'lambda x: 5 + 0 * x', steps: [
      ['Приращение функции', R`\Delta f=f(x+h)-f(x)=5-5=0`], ['Разностное отношение', R`\frac{\Delta f}{h}=\frac0h=0`], ['Предел', R`f'(x)=\lim_{h\to0}0=0`]] },
    { lvl: 1, name: 'прямая f(x) = 3x + 2', tex: R`f(x)=3x+2`, x0: 1, q: () => 3, L: 3, py: 'lambda x: 3 * x + 2', steps: [
      ['Значение в сдвинутой точке', R`f(x+h)=3x+3h+2`], ['Приращение', R`\Delta f=3h`], ['Отношение — уже без h', R`\frac{3h}{h}=3`], ['Предел', R`f'(x)=3`]] },
    { lvl: 1, name: 'парабола f(x) = x²', tex: R`f(x)=x^2`, x0: 1, q: (h) => 2 + h, L: 2, py: 'lambda x: x**2', steps: [
      ['Квадрат суммы', R`f(x+h)=x^2+2xh+h^2`], ['Приращение: x² сократилось', R`\Delta f=2xh+h^2`], ['Делим на h', R`\frac{\Delta f}{h}=2x+h`], ['Предел', R`f'(x)=\lim_{h\to0}(2x+h)=2x`], ['При x = 1 (график ниже)', R`f'(1)=2`]] },
    { lvl: 2, name: 'куб f(x) = x³', tex: R`f(x)=x^3`, x0: 1, q: (h) => 3 + 3 * h + h * h, L: 3, py: 'lambda x: x**3', steps: [
      ['Куб суммы', R`(x+h)^3=x^3+3x^2h+3xh^2+h^3`], ['Приращение', R`\Delta f=3x^2h+3xh^2+h^3`], ['Делим на h', R`\frac{\Delta f}{h}=3x^2+3xh+h^2`], ['Предел', R`f'(x)=3x^2`], ['При x = 1', R`f'(1)=3`]] },
    { lvl: 2, name: 'многочлен x² − 3x + 1 в точке a = 2', tex: R`f(x)=x^2-3x+1,\ a=2`, x0: 2, q: (h) => 1 + h, L: 1, py: 'lambda x: x**2 - 3 * x + 1', steps: [
      ['Значения', R`f(2)=-1,\quad f(2+h)=(2+h)^2-3(2+h)+1=h^2+h-1`], ['Приращение', R`\Delta f=h^2+h`], ['Делим на h', R`\frac{\Delta f}{h}=h+1`], ['Предел', R`f'(2)=1`]] },
    { lvl: 2, name: 'гипербола f(x) = 1/x', tex: R`f(x)=\frac1x`, x0: 1, q: (h) => -1 / (1 + h), L: -1, py: 'lambda x: 1 / x', steps: [
      ['Приращение к общему знаменателю', R`\frac1{x+h}-\frac1x=\frac{x-(x+h)}{x(x+h)}=\frac{-h}{x(x+h)}`], ['Делим на h', R`\frac{\Delta f}{h}=-\frac{1}{x(x+h)}`], ['Предел (x ≠ 0)', R`f'(x)=-\frac1{x^2}`], ['При x = 1', R`f'(1)=-1`]] },
    { lvl: 2, name: 'корень f(x) = √x', tex: R`f(x)=\sqrt x`, x0: 1, q: (h) => (Math.sqrt(1 + h) - 1) / h, L: 0.5, py: 'lambda x: np.sqrt(x)', steps: [
      ['Отношение: неопределённость 0/0', R`\frac{\sqrt{x+h}-\sqrt x}{h}`], ['Домножаем на сопряжённое (урок 15.4)', R`\frac{(x+h)-x}{h\,(\sqrt{x+h}+\sqrt x)}=\frac{1}{\sqrt{x+h}+\sqrt x}`], ['Предел (x > 0)', R`f'(x)=\frac{1}{2\sqrt x}`], ['При x = 1', R`f'(1)=\tfrac12`]] },
    { lvl: 3, name: 'экспонента f(x) = eˣ', tex: R`f(x)=e^x`, x0: 0, q: (h) => Math.expm1(h) / h, L: 1, py: 'lambda x: np.exp(x)', steps: [
      ['Выносим eˣ', R`\frac{e^{x+h}-e^x}{h}=e^x\cdot\frac{e^h-1}{h}`], ['Замечательный предел (урок 15.4)', R`\lim_{h\to0}\frac{e^h-1}{h}=1`], ['Ответ: экспонента — сама себе производная', R`(e^x)'=e^x`], ['При x = 0', R`f'(0)=1`]] },
    { lvl: 3, name: 'синус f(x) = sin x', tex: R`f(x)=\sin x`, x0: 0, q: (h) => Math.sin(h) / h, L: 1, py: 'lambda x: np.sin(x)', steps: [
      ['Разность синусов', R`\sin(x+h)-\sin x=2\cos\!\left(x+\tfrac h2\right)\sin\tfrac h2`], ['Делим на h', R`\frac{\Delta f}{h}=\cos\!\left(x+\tfrac h2\right)\cdot\frac{\sin(h/2)}{h/2}`], ['Первый замечательный предел и непрерывность cos', R`\frac{\sin(h/2)}{h/2}\to1,\quad \cos\!\left(x+\tfrac h2\right)\to\cos x`], ['Ответ', R`(\sin x)'=\cos x`], ['При x = 0', R`f'(0)=1`]] },
    { lvl: 3, name: 'потери ½(y − F)² по прогнозу F', tex: R`L(F)=\tfrac12(y-F)^2`, x0: 2, q: (h) => -(5 - 2) + h / 2, L: -3, py: 'lambda F: 0.5 * (5 - F)**2', ytxt: 'y = 5, F = 2', steps: [
      ['Сдвигаем прогноз на h', R`L(F+h)=\tfrac12\bigl((y-F)-h\bigr)^2=\tfrac12(y-F)^2-h(y-F)+\tfrac12h^2`], ['Приращение', R`\Delta L=-h\,(y-F)+\tfrac12h^2`], ['Делим на h', R`\frac{\Delta L}{h}=-(y-F)+\tfrac h2`], ['Предел', R`L'(F)=-(y-F)`], ['Минус производная — остаток (y = 5, F = 2)', R`-L'(2)=5-2=3`]] },
    { lvl: 3, name: 'модуль |x| в точке 0 — производной нет', tex: R`f(x)=|x|,\ a=0`, x0: 0, q: (h) => Math.sign(h), L: null, py: 'lambda x: np.abs(x)', steps: [
      ['Приращение', R`\Delta f=|0+h|-|0|=|h|`], ['Отношение', R`\frac{|h|}{h}=\begin{cases}+1,&h>0\\-1,&h<0\end{cases}`], ['Односторонние пределы различны', R`\lim_{h\to0^+}=1\ne-1=\lim_{h\to0^-}`], ['Вывод', R`f'(0)\ \text{не существует}`]] },
  ];
  GBC.widget('deriv-solver', (el) => {
    const s = { i: 0, k: 1 };
    const w = ui.shell(el, { title: 'Производная по определению — решатель по шагам', sub: 'Выберите функцию (★ — разминка, ★★★ — с подвохом) и нажимайте «шаг вперёд»: приращение → разностное отношение → упрощение → предел. График показывает отношение q(h) около h = 0 в конкретной точке; выколотая точка — ответ.' });
    ui.select(w.controls, { label: 'Функция', value: '0', options: DEF.map((E, i) => ({ value: String(i), label: STARS[E.lvl] + ' ' + E.name })), onChange: (v) => {
      s.i = +v;
      player.setMax(DEF[s.i].steps.length);
      player.set(1);
      s.k = 1;
      draw();
    } });
    const player = ui.player(w.controls, { label: 'Шаг решения', min: 0, max: DEF[0].steps.length, value: 1, fps: 0.8, format: (k, m) => 'шаг ' + k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const prob = card('Задача', true);
    w.main.appendChild(prob.el);
    const probTex = H('div');
    prob.body.appendChild(probTex);
    prob.body.appendChild(texEl(R`f'(x)=\lim_{h\to0}\frac{f(x+h)-f(x)}{h}`, false, 'color:var(--ink-2);font-size:.95rem'));
    const list = H('ol', { style: 'margin:8px 0 0;padding-left:1.4em;display:grid;gap:6px' });
    prob.body.appendChild(list);
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'шаг h', domain: [-1, 1] }, y: { label: 'q(h)' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const E = DEF[s.i];
      texInto(probTex, R`\text{Найти } f'(x):\ ` + E.tex, true);
      list.textContent = '';
      E.steps.slice(0, s.k).forEach(([c, t], j) => {
        const li = H('li', { style: 'opacity:' + (j === s.k - 1 ? 1 : 0.78) }, H('div', { style: 'font-size:.92rem;color:var(--ink-2)' }, c));
        li.appendChild(texEl('\\displaystyle ' + t, false, 'padding:2px 0'));
        list.appendChild(li);
      });
      const fin = s.k >= E.steps.length;
      const hs = U.linspace(-1, 1, 801).filter((h) => Math.abs(h) > 1e-9);
      const L1 = hs.filter((h) => h < 0);
      const R1 = hs.filter((h) => h > 0);
      const qs = (h) => {
        const v = E.q(h);
        return Number.isFinite(v) && Math.abs(v) < 50 ? v : NaN;
      };
      const layers = [
        { type: 'vline', x: 0, color: 'axis', width: 1 },
        { type: 'line', x: L1, y: L1.map(qs), color: 'model', width: 2.4, hover: false },
        { type: 'line', x: R1, y: R1.map(qs), color: 'model', width: 2.4, hover: false },
      ];
      if (E.L !== null) {
        if (fin) layers.push({ type: 'hline', y: E.L, color: 'tree', dash: '6 4', width: 1.4, text: 'предел ' + U.fmt(E.L, 4) });
        layers.push({ type: 'points', x: [0], y: [E.L], color: 'model', r: 5.5, hollow: true });
      } else layers.push({ type: 'points', x: [0, 0], y: [1, -1], color: 'model', r: 5.5, hollow: true });
      const yv = hs.filter((h) => Math.abs(h) < 0.6).map(qs).filter(Number.isFinite);
      let [lo, hi] = U.extent(yv);
      if (E.L !== null) (lo = Math.min(lo, E.L)), (hi = Math.max(hi, E.L));
      const pad = Math.max((hi - lo) * 0.2, 0.5);
      plot.render(layers, { y: [lo - pad, hi + pad] });
      const xs = [-0.1, -0.01, -0.001, 0.001, 0.01, 0.1];
      rowTable(tbl, ['h', ...xs.map((x) => U.fmt(x, 3))], [['q(h)' + (E.ytxt ? ' при ' + E.ytxt : ' при x = ' + E.x0), ...xs.map((x) => U.fmt(E.q(x), 6))]]);
      note.innerHTML = fin
        ? (E.L === null ? 'Ответ: <b>производной нет</b> — у отношения разные пределы справа и слева.' : 'Ответ проверен: таблица с обеих сторон подходит к <b>' + U.fmt(E.L, 4) + '</b>. Алгоритм всегда один: Δf → Δf/h → сократить h → подставить h = 0.')
        : s.k === 0 ? 'Нажмите «шаг вперёд»: первый шаг — всегда приращение функции.' : 'Шаг ' + s.k + ' из ' + E.steps.length + '. Попробуйте сделать следующий шаг сами, потом проверьте.';
    }
    w.pythonAction(() => {
      const E = DEF[s.i];
      return 'import numpy as np\n\nf = ' + E.py + '\nx0 = ' + E.x0 + '\nfor h in [0.1, 0.01, 0.001, -0.001, -0.01, -0.1]:\n    q = (f(x0 + h) - f(x0)) / h\n    print(f"h = {h:7}: q(h) = {q:.6f}")\nprint("предел:", ' + (E.L === null ? '"нет"' : py(E.L)) + ')\n';
    });
    draw();
  });

  /* ==============================================================================
   * 4. Производная как функция: строим f′ по точкам
   * ============================================================================== */
  GBC.widget('derivative-builder', (el) => {
    const KEYS = ['sq', 'cubic', 'sin', 'exp', 'sqrt', 'abs', 'ln'];
    const s = { fn: 'cubic', x: -1.8, pts: [], show: false, auto: 0 };
    const NA = 24;
    const w = ui.shell(el, { title: 'Постройте f′ по точкам', sub: 'Тяните оранжевую линию по верхнему графику и нажимайте «Записать наклон»: точка (x, f′(x)) появится на нижнем графике. Наберите 8–10 точек и угадайте форму f′, затем откройте её целиком. ▶ делает то же самое автоматически.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: fnOpts(KEYS), onChange: (v) => {
      s.fn = v;
      s.pts = [];
      s.x = FN[v].dom[0] + 0.15 * (FN[v].dom[1] - FN[v].dom[0]);
      pl.stop();
      pl.set(0);
      draw();
    } });
    ui.button(w.controls, { label: 'Записать наклон', kind: 'primary', onClick: () => record(s.x) });
    const pl = ui.player(w.controls, { label: 'Автозаполнение', min: 0, max: NA, value: 0, fps: 5, format: (v) => v + ' из ' + NA, onChange: (v) => {
      const F = FN[s.fn];
      if (v === 0) s.pts = [];
      else {
        s.x = F.dom[0] + ((F.dom[1] - F.dom[0]) * (v - 0.5)) / NA;
        record(s.x, true);
      }
      draw();
    } });
    const tg = ui.toggle(w.controls, { label: 'Показать f′ целиком', checked: false, onChange: (v) => ((s.show = v), draw()) });
    ui.button(w.controls, { label: 'Очистить точки', onClick: () => ((s.pts = []), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'x' }, y: { label: 'наклон f′(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'x' }, { key: 'f', label: 'f(x)' }, { key: 'd', label: 'наклон касательной' }, { key: 'n', label: 'записано точек' }]);
    function measured(F, x) {
      const v = nd(F.f, x, 1e-5);
      if (F.kink && F.kink.some((k) => Math.abs(k - x) < 2e-5)) return NaN;
      if (F.edge === 0 && x < 1e-4) return NaN;
      return v;
    }
    function record(x, quiet) {
      const F = FN[s.fn];
      const v = measured(F, x);
      if (!s.pts.some((p) => Math.abs(p.x - x) < 1e-9)) s.pts.push({ x, y: v });
      if (!quiet) draw();
    }
    function draw() {
      const F = FN[s.fn];
      const x = U.clamp(s.x, F.dom[0], F.dom[1]);
      const d = measured(F, x);
      const c = curve(F.f, F.dom[0], F.dom[1], 601);
      const span = F.dom[1] - F.dom[0];
      p1.render([
        { type: 'line', x: c.x, y: c.y, color: 'model', width: 2.2, label: 'f(x)', hover: false },
        Number.isFinite(d) ? { type: 'segments', x1: [x - span * 0.12], y1: [F.f(x) - span * 0.12 * d], x2: [x + span * 0.12], y2: [F.f(x) + span * 0.12 * d], color: 'tree', width: 2.5, opacity: 1 } : null,
        { type: 'vline', x, color: 'tree', width: 1.5, draggable: true, onDrag: (v) => ((s.x = U.clamp(v, F.dom[0], F.dom[1])), draw()) },
        { type: 'points', x: [x], y: [F.f(x)], color: 'tree', r: 6 },
      ], { x: F.dom, y: yRange(F.f, U.linspace(F.dom[0], F.dom[1], 200)) });
      const fine = U.linspace(F.dom[0], F.dom[1], 801);
      const dc = curve((t) => measured(F, t), F.dom[0], F.dom[1], 0, { xs: fine, jump: 0.5, cap: 12 });
      const good = s.pts.filter((p) => Number.isFinite(p.y));
      const yAll = dc.y.filter(Number.isFinite);
      let [lo, hi] = U.extent(yAll.concat([0]));
      if (s.fn === 'sqrt' || s.fn === 'ln') hi = Math.min(hi, 5);
      const pad = (hi - lo) * 0.12 || 1;
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1.2 },
        s.show ? { type: 'line', x: dc.x, y: dc.y, color: 'tree', width: 2.2, label: 'f′(x)', hover: false } : null,
        { type: 'points', x: good.map((p) => p.x), y: good.map((p) => p.y), color: 'tree', r: 5, label: 'записанные наклоны', tooltip: (i) => [['x', U.fmt(good[i].x, 3)], ['f′(x)', U.fmt(good[i].y, 4)]] },
        { type: 'vline', x, color: 'tree', width: 1, dash: '3 3' },
        Number.isFinite(d) && d <= hi + pad ? { type: 'points', x: [x], y: [d], color: 'tree', r: 6, hollow: true } : null,
      ], { x: F.dom, y: [lo - pad, hi + pad] });
      st.set('x', U.fmt(x, 3));
      st.set('f', U.fmt(F.f(x), 4));
      st.set('d', Number.isFinite(d) ? U.fmt(d, 4) : 'нет');
      st.set('n', String(s.pts.length));
      const bad = s.pts.length - good.length;
      const hints = {
        sq: 'Точки ложатся на прямую через начало координат: (x²)′ = 2x.',
        cubic: 'Точки рисуют параболу с нулями в x = ±1 — там у f горка и яма: (x³/3 − x)′ = x² − 1.',
        sin: 'Точки рисуют волну, сдвинутую на четверть периода: это cos x.',
        exp: 'Точки ложатся на сам график f: наклон экспоненты равен её значению.',
        sqrt: 'Около нуля точки улетают вверх: касательная к √x в нуле вертикальна, f′(0) не существует, хотя f(0) = 0 определено. Область определения f′ — x > 0.',
        abs: 'Две полочки: −1 слева, +1 справа. В нуле наклона нет — f′ определена везде, кроме x = 0.',
        ln: 'Точки рисуют гиперболу 1/x: чем больше x, тем положе логарифм.',
      };
      note.innerHTML = s.pts.length < 6
        ? 'Наклон касательной в каждой точке — число. Собрав эти числа, мы получим новую функцию <b>x ↦ f′(x)</b> — производную. ' + (Number.isFinite(d) ? 'Сейчас f′(' + U.fmt(x, 2) + ') ≈ ' + U.fmt(d, 3) + '.' : 'В этой точке касательной нет — записать нечего.')
        : hints[s.fn] + (bad ? ' (' + bad + ' точк' + (bad === 1 ? 'а' : 'и') + ' без наклона пропущены.)' : '');
      tg.set(s.show);
    }
    w.pythonAction(() => {
      const F = FN[s.fn];
      return pyHead(F) + '\nx = np.linspace(' + U.pyNum(F.dom[0] + (F.edge === 0 ? 0.05 : 0)) + ', ' + U.pyNum(F.dom[1]) + ', 400)\nxs = np.linspace(x[0], x[-1], 12)        # «записанные» точки\nh = 1e-5\nmeasured = (f(xs + h) - f(xs - h)) / (2 * h)  # наклоны, измеренные секущими\nfig, (a1, a2) = plt.subplots(2, 1, figsize=(7, 6), sharex=True)\na1.plot(x, f(x), label="f(x)")\na1.legend()\na2.plot(x, df(x), color="C1", label="f\'(x)")\na2.plot(xs, measured, "o", color="C1", label="измеренные наклоны")\na2.axhline(0, color="gray", lw=1)\na2.legend()\nplt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * 5. Наклон прямой: подъём / пробег
   * ============================================================================== */
  GBC.widget('line-slope', (el) => {
    const s = { ax: -1.5, ay: -0.5, bx: 2, by: 1.5 };
    const PRESETS = { up: [-1.5, -0.5, 2, 1.5], steep: [-0.5, -2, 1, 2.5], down: [-2, 2, 2, -1], flat: [-2, 1, 2, 1] };
    const w = ui.shell(el, { title: 'Наклон прямой = подъём / пробег', sub: 'Перетаскивайте точки A и B. Наклон показывает, на сколько изменится y, если сдвинуться по x на единицу вправо; угол α — наклон в градусах, k = tg α.' });
    ui.segmented(w.controls, { label: 'Примеры', value: 'up', options: [{ value: 'up', label: 'вверх' }, { value: 'steep', label: 'круто' }, { value: 'down', label: 'вниз' }, { value: 'flat', label: 'ровно' }], onChange: (v) => (([s.ax, s.ay, s.bx, s.by] = PRESETS[v]), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, equal: true, x: { label: 'x', domain: [-4, 4] }, y: { label: 'y', domain: [-3, 3.5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'dx', label: 'пробег Δx' }, { key: 'dy', label: 'подъём Δy' }, { key: 'k', label: 'наклон k = Δy / Δx' }, { key: 'deg', label: 'угол α' }]);
    function draw() {
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const vertical = Math.abs(dx) < 0.05;
      const k = dy / dx;
      const layers = [];
      if (!vertical) {
        const xs = [-4.5, 4.5];
        layers.push({ type: 'line', x: xs, y: xs.map((x) => s.ay + k * (x - s.ax)), color: 'model', width: 2.2, label: 'прямая через A и B' });
      }
      layers.push({ type: 'segments', x1: [s.ax, s.bx], y1: [s.ay, s.ay], x2: [s.bx, s.bx], y2: [s.ay, s.by], color: 'tree', width: 2.2, opacity: 1, dash: '5 4' });
      layers.push({ type: 'text', items: [
        { x: (s.ax + s.bx) / 2, y: s.ay, dy: dy >= 0 ? 16 : -8, anchor: 'middle', text: 'Δx = ' + U.fmt(dx, 2) },
        { x: s.bx, y: (s.ay + s.by) / 2, dx: dx >= 0 ? 6 : -6, anchor: dx >= 0 ? 'start' : 'end', text: 'Δy = ' + U.fmt(dy, 2) },
        { x: s.ax, y: s.ay, dx: -8, dy: -8, anchor: 'end', text: 'A', bold: true },
        { x: s.bx, y: s.by, dx: 8, dy: -8, text: 'B', bold: true },
      ] });
      layers.push({ type: 'points', x: [s.ax, s.bx], y: [s.ay, s.by], color: 'tree', r: 7, draggable: true, label: 'точки (тяните)', onDrag: (i, x, y) => {
        const r = (v) => Math.round(v * 4) / 4;
        if (i === 0) (s.ax = r(x)), (s.ay = r(y));
        else (s.bx = r(x)), (s.by = r(y));
        draw();
      } });
      plot.render(layers);
      st.set('dx', U.fmt(dx, 2));
      st.set('dy', U.fmt(dy, 2));
      st.set('k', vertical ? 'нет' : U.fmt(k, 3));
      st.set('deg', vertical ? '90°' : U.fmt((Math.atan(k) * 180) / Math.PI, 1) + '°');
      if (vertical) note.innerHTML = 'Пробег почти нулевой — прямая вертикальна, наклон не определён (делить на 0 нельзя), угол 90°.';
      else if (Math.abs(k) < 1e-9) note.innerHTML = '<b>Наклон 0:</b> прямая горизонтальна, y не меняется при сдвиге x.';
      else note.innerHTML = 'Наклон ' + U.fmt(k, 3) + (k > 0 ? ' > 0: при движении вправо y <b>растёт</b>' : ' &lt; 0: при движении вправо y <b>падает</b>') + ' — на ' + U.fmt(Math.abs(k), 3) + ' на каждую единицу x. ' + (Math.abs(k) > 2 ? 'Это крутая прямая.' : Math.abs(k) < 0.5 ? 'Это пологая прямая.' : '') + ' Наклон один и тот же для любой пары точек прямой.';
    }
    w.pythonAction(() => 'import numpy as np\n\nA = (' + U.pyNum(s.ax) + ', ' + U.pyNum(s.ay) + ')\nB = (' + U.pyNum(s.bx) + ', ' + U.pyNum(s.by) + ')\n\nrun = B[0] - A[0]     # пробег Δx\nrise = B[1] - A[1]    # подъём Δy\nk = rise / run\nprint(f"наклон = {rise} / {run} = {k:.3f}, угол = {np.degrees(np.arctan(k)):.1f}°")\n');
    draw();
  });

  /* ==============================================================================
   * 6. От секущей к касательной: h → 0 (справа, слева, центральная)
   * ============================================================================== */
  GBC.widget('secant', (el) => {
    const s = { fn: 'cubic', a: 0.5, v: 0, mode: 'right' };
    const NV = 60;
    const epsOf = (v) => 2 * Math.pow(10, (-3 * v) / NV);
    const w = ui.shell(el, { title: 'Секущая превращается в касательную', sub: 'Через точки a и a + h проводим прямую — секущую. Нажмите ▶: h уменьшается от 2 до 0.002, секущая поворачивается вокруг точки a и прижимается к касательной, а её наклон (нижний график) подходит к f′(a).' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: fnOpts(['sq', 'cubic', 'sin', 'exp', 'abs']), onChange: (v) => ((s.fn = v), draw()) });
    ui.slider(w.controls, { label: 'Точка a', min: -2, max: 1.5, step: 0.05, value: s.a, onInput: (v) => ((s.a = v), draw()) });
    ui.player(w.controls, { label: 'Сжимаем h', min: 0, max: NV, value: 0, fps: 8, format: (v) => 'h = ' + U.fmt(epsOf(v), 3), onChange: (v) => ((s.v = v), draw()) });
    ui.segmented(w.controls, { label: 'Вторая точка', value: s.mode, options: [{ value: 'right', label: 'справа' }, { value: 'left', label: 'слева' }, { value: 'central', label: 'обе (центр.)' }], onChange: (v) => ((s.mode = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 280, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'h (логарифмическая шкала)', type: 'log', domain: [0.002, 2], ticks: [0.002, 0.01, 0.1, 1] }, y: { label: 'наклон секущей' }, crosshair: true, crosshairTitle: (v) => 'h = ' + U.fmt(v, 3) });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'h' }, { key: 'sec', label: 'наклон секущей' }, { key: 'd', label: 'f′(a)' }, { key: 'err', label: 'ошибка' }, { key: 'ratio', label: 'ошибка / h' }]);
    const slope = (F, a, e, mode) => (mode === 'central' ? (F.f(a + e) - F.f(a - e)) / (2 * e) : mode === 'left' ? (F.f(a) - F.f(a - e)) / e : (F.f(a + e) - F.f(a)) / e);
    function draw() {
      const F = FN[s.fn];
      const a = U.clamp(s.a, F.dom[0] + 0.1, F.dom[1] - 0.1);
      const e = epsOf(s.v);
      const k = slope(F, a, e, s.mode);
      const d = F.df(a);
      const xs = U.linspace(F.dom[0], F.dom[1], 300);
      const p = s.mode === 'right' ? a : a - e;
      const q = s.mode === 'left' ? a : a + e;
      const lineX = [F.dom[0], F.dom[1]];
      p1.render([
        { type: 'line', x: xs, y: xs.map(F.f), color: 'model', width: 2.2, label: 'f(x)' },
        Number.isFinite(d) ? { type: 'line', x: lineX, y: lineX.map((x) => F.f(a) + d * (x - a)), color: 'tree', width: 1.8, dash: '6 4', label: 'касательная', hover: false } : null,
        { type: 'line', x: lineX, y: lineX.map((x) => F.f(p) + k * (x - p)), color: 'aqua', width: 2, label: 'секущая', hover: false },
        { type: 'points', x: [p, q], y: [F.f(p), F.f(q)], color: 'aqua', r: 5, tooltip: (i) => [['x', U.fmt(i ? q : p, 4)], ['f', U.fmt(F.f(i ? q : p), 4)]] },
        { type: 'points', x: [a], y: [F.f(a)], color: 'tree', r: 6, tooltip: () => [['a', U.fmt(a, 3)], ['f′(a)', U.fmt(d, 4)]] },
      ], { x: F.dom, y: yRange(F.f, xs) });
      const es = U.range(NV + 1).map(epsOf);
      p2.render([
        { type: 'line', x: es, y: es.map((v) => slope(F, a, v, 'right')), color: 'aqua', width: 2, label: 'справа', dash: s.mode === 'right' ? null : '2 3' },
        { type: 'line', x: es, y: es.map((v) => slope(F, a, v, 'left')), color: 'blue', width: 2, label: 'слева', dash: s.mode === 'left' ? null : '2 3' },
        { type: 'line', x: es, y: es.map((v) => slope(F, a, v, 'central')), color: 'violet', width: 2, label: 'центральная', dash: s.mode === 'central' ? null : '2 3' },
        Number.isFinite(d) ? { type: 'hline', y: d, color: 'tree', dash: '6 4', text: 'f′(a) = ' + U.fmt(d, 3) } : null,
        { type: 'vline', x: e, color: 'ink2', width: 1, dash: '3 3' },
        { type: 'points', x: [e], y: [k], color: s.mode === 'central' ? 'violet' : s.mode === 'left' ? 'blue' : 'aqua', r: 5 },
      ]);
      const err = Math.abs(k - d);
      st.set('e', U.fmt(e, 4));
      st.set('sec', U.fmt(k, 5));
      st.set('d', Number.isFinite(d) ? U.fmt(d, 5) : 'нет');
      st.set('err', Number.isFinite(d) ? U.fmt(err, 3) : '—');
      st.set('ratio', Number.isFinite(d) ? U.fmt(err / e, 3) : '—');
      if (s.fn === 'abs' && Math.abs(a) < 0.03) note.innerHTML = 'В изломе |x| секущая справа всегда даёт +1, слева −1, а центральная — 0. Секущие не сходятся к одному числу: <b>производной в нуле нет</b>.';
      else if (s.fn === 'sq') note.innerHTML = s.mode === 'central' ? 'Для параболы центральная разность точна при любом h: (a + h)² − (a − h)² = 4ah.' : 'Для x² наклон секущей ровно 2a ± h: ошибка равна h и исчезает при h → 0. Это предел из определения производной.';
      else note.innerHTML = s.mode === 'central' ? 'Центральная секущая ошибается примерно как h² — при h = 0.01 ошибка уже ~10⁻⁴. Справа и слева ошибки примерно равны по величине и противоположны по знаку, а центральная — их среднее, поэтому они почти сокращаются.' : 'Ошибка односторонней секущей убывает примерно пропорционально h (ошибка/h почти постоянна). <b>Касательная — предельное положение секущей</b> при h → 0.';
    }
    w.pythonAction(() => {
      const F = FN[s.fn];
      return pyHead(F) + '\na = ' + U.pyNum(s.a) + '\nprint("        h    справа     слева  центральная   f\'(a)")\nfor h in [1, 0.1, 0.01, 0.001, 1e-4]:\n    right = (f(a + h) - f(a)) / h\n    left = (f(a) - f(a - h)) / h\n    cen = (f(a + h) - f(a - h)) / (2 * h)\n    print(f"{h:9.0e} {right:9.6f} {left:9.6f} {cen:12.6f} {df(a):9.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 7. Касательная и нормаль; точки с заданным наклоном
   * ============================================================================== */
  const TAN = {
    sq: { dom: [-3, 3], ydom: [-1.5, 6] },
    cubic: { dom: [-2.8, 2.8], ydom: [-3, 3] },
    sin: { dom: [-3.5, 3.5], ydom: [-2.2, 2.2] },
    exp: { dom: [-3, 2], ydom: [-0.8, 5] },
    recip: { dom: [0.2, 4.5], ydom: [-0.5, 4.5] },
    ln: { dom: [0.1, 5], ydom: [-2.5, 2.2] },
  };
  GBC.widget('tangent-lab', (el) => {
    const s = { fn: 'sq', a: 1, mode: 'tn', k: 1 };
    const w = ui.shell(el, { title: 'Касательная, нормаль и угол наклона', sub: 'Режим «касательная»: тяните точку касания — уравнение, угол и нормаль (перпендикуляр к касательной) пересчитываются. Режим «наклон k»: выберите наклон — виджет найдёт все точки, где касательная параллельна прямой y = kx.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: fnOpts(Object.keys(TAN)), onChange: (v) => ((s.fn = v), (s.a = FN[v].a0), draw()) });
    ui.segmented(w.controls, { label: 'Режим', value: s.mode, options: [{ value: 'tn', label: 'касательная' }, { value: 'k', label: 'наклон k' }], onChange: (v) => ((s.mode = v), (kSl.el.hidden = v !== 'k'), draw()) });
    const kSl = ui.slider(w.controls, { label: 'Наклон k', min: -3, max: 3, step: 0.1, value: s.k, onInput: (v) => ((s.k = v), draw()) });
    kSl.el.hidden = true;
    const eq = card('Уравнения', true);
    w.main.appendChild(eq.el);
    const eqTan = H('div');
    const eqNor = H('div');
    eq.body.append(eqTan, eqNor);
    const plot = new GBC.Plot(w.main, { height: 340, equal: true, x: { label: 'x' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'a' }, { key: 'fa', label: 'f(a)' }, { key: 'k', label: 'f′(a) = tg α' }, { key: 'deg', label: 'угол α' }]);
    const lineEq = (k, b) => 'y=' + (Math.abs(k) < 1e-12 ? '' : (U.fmt(k, 3) === '1' ? '' : U.fmt(k, 3) === '−1' ? '-' : U.fmt(k, 3).replace('−', '-')) + 'x') + (Math.abs(b) < 1e-12 ? (Math.abs(k) < 1e-12 ? '0' : '') : (b > 0 && Math.abs(k) >= 1e-12 ? '+' : '') + U.fmt(b, 3).replace('−', '-'));
    function draw() {
      const F = FN[s.fn];
      const T = TAN[s.fn];
      const a = U.clamp(s.a, T.dom[0] + 0.05, T.dom[1] - 0.05);
      const fa = F.f(a);
      const k = F.df(a);
      const c = curve(F.f, T.dom[0], T.dom[1], 801, { cap: 50 });
      const lx = [T.dom[0] - 5, T.dom[1] + 5];
      const layers = [{ type: 'line', x: c.x, y: c.y, color: 'model', width: 2.4, label: 'y = f(x)', hover: false }];
      if (s.mode === 'tn') {
        layers.push({ type: 'line', x: lx, y: lx.map((x) => fa + k * (x - a)), color: 'tree', width: 2, label: 'касательная', hover: false });
        if (Math.abs(k) > 1e-9) layers.push({ type: 'line', x: lx, y: lx.map((x) => fa - (x - a) / k), color: 'violet', width: 1.6, dash: '6 4', label: 'нормаль', hover: false });
        else layers.push({ type: 'vline', x: a, color: 'violet', width: 1.6, dash: '6 4' });
        layers.push({ type: 'points', x: [a], y: [fa], color: 'tree', r: 7, draggable: true, label: 'точка касания (тяните)', onDrag: (i, x) => ((s.a = Math.round(x * 20) / 20), draw()) });
        texInto(eqTan, R`\text{касательная: } y=f(a)+f'(a)(x-a)\;\Rightarrow\;` + lineEq(k, fa - k * a));
        texInto(eqNor, Math.abs(k) > 1e-9 ? R`\text{нормаль: } y=f(a)-\frac{x-a}{f'(a)}\;\Rightarrow\;` + lineEq(-1 / k, fa + a / k) : R`\text{нормаль: } x=` + U.fmt(a, 3));
      } else {
        const rs = roots((x) => F.df(x) - s.k, T.dom[0], T.dom[1]);
        layers.push({ type: 'line', x: lx, y: lx.map((x) => s.k * x), color: 'ink2', width: 1.2, dash: '3 4', label: 'y = kx (образец)', hover: false });
        rs.forEach((r, i) => layers.push({ type: 'line', x: lx, y: lx.map((x) => F.f(r) + s.k * (x - r)), color: 'tree', width: 2, label: i === 0 ? 'касательные с наклоном k' : undefined, hover: false }));
        if (rs.length) layers.push({ type: 'points', x: rs, y: rs.map(F.f), color: 'tree', r: 6.5, tooltip: (i) => [['x', U.fmt(rs[i], 4)], ['f′(x)', U.fmt(F.df(rs[i]), 4)]] });
        texInto(eqTan, R`\text{ищем } x:\ f'(x)=` + U.fmt(s.k, 2).replace('−', '-') + (rs.length ? R`\;\Rightarrow\; x\in\{` + rs.map((r) => U.fmt(r, 3).replace('−', '-')).join(R`;\ `) + R`\}` : R`\;\Rightarrow\;\text{решений нет}`));
        texInto(eqNor, R`\text{касательная в каждой такой точке параллельна } y=kx`);
        s._roots = rs;
      }
      plot.render(layers, { x: T.dom, y: T.ydom });
      st.set('a', U.fmt(a, 3));
      st.set('fa', U.fmt(fa, 4));
      st.set('k', U.fmt(k, 4));
      st.set('deg', U.fmt((Math.atan(k) * 180) / Math.PI, 1) + '°');
      if (s.mode === 'k') {
        const n = s._roots.length;
        note.innerHTML = n === 0 ? 'Нет ни одной точки с наклоном ' + U.fmt(s.k, 2) + ': ' + (s.fn === 'exp' ? 'у eˣ наклон всегда положителен.' : s.fn === 'recip' ? 'у 1/x наклон всегда отрицателен.' : s.fn === 'ln' ? 'у ln x наклон 1/x всегда положителен.' : s.fn === 'sin' ? 'наклон синуса — cos x — не выходит за [−1, 1].' : s.fn === 'cubic' ? 'наклон x² − 1 не бывает меньше −1.' : '') : 'Найдено точек: <b>' + n + '</b>. Это решения уравнения f′(x) = k. ' + (s.fn === 'sq' ? 'Для параболы ответ один: 2x = k, x = k/2.' : s.fn === 'cubic' ? 'Для x³/3 − x: x² − 1 = k, x = ±√(k + 1) — касательные-«близнецы» по обе стороны.' : '');
      } else if (Math.abs(k) < 1e-9) note.innerHTML = 'f′(a) = 0: касательная горизонтальна (α = 0°), нормаль вертикальна.';
      else note.innerHTML = 'Касательная проходит через (a, f(a)) с наклоном f′(a) = tg α. Нормаль перпендикулярна ей: её наклон −1/f′(a), и произведение наклонов равно −1. Масштаб осей одинаковый, поэтому прямой угол виден честно.';
    }
    w.pythonAction(() => {
      const F = FN[s.fn];
      return pyHead(F) + '\na = ' + U.pyNum(s.a) + '\nk = df(a)\nb = f(a) - k * a\nprint(f"касательная: y = {k:.4f}·x + {b:.4f}, угол {np.degrees(np.arctan(k)):.1f}°")\nif k != 0:\n    print(f"нормаль: y = {-1 / k:.4f}·x + {f(a) + a / k:.4f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 8. Производная — скорость: мяч, брошенный вверх
   * ============================================================================== */
  GBC.widget('motion-lab', (el) => {
    const s = { v0: 20, k: 10, dt: 0.5 };
    const NK = 40;
    const w = ui.shell(el, { title: 'Скорость — производная координаты', sub: 'Мяч брошен вверх со скоростью v₀; высота s(t) = v₀t − 5t² (g ≈ 10 м/с²). Справа от графика — сам мяч. Наклон касательной к s(t) — мгновенная скорость v(t) = s′(t); наклон секущей на [t, t + Δt] — средняя скорость.' });
    ui.slider(w.controls, { label: 'Начальная скорость v₀, м/с', min: 10, max: 30, step: 1, value: s.v0, onInput: (v) => ((s.v0 = v), draw()) });
    ui.player(w.controls, { label: 'Время', min: 0, max: NK, value: s.k, fps: 6, format: (k) => 't = ' + U.fmt((k / NK) * ((2 * s.v0) / 10), 2) + ' с', onChange: (k) => ((s.k = k), draw()) });
    ui.slider(w.controls, { label: 'Интервал Δt для средней скорости, с', min: 0.05, max: 2, step: 0.05, value: s.dt, onInput: (v) => ((s.dt = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 270, x: { label: 'время t, с' }, y: { label: 'высота s, м' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'время t, с' }, y: { label: 'скорость v, м/с' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't', label: 't, с' }, { key: 's', label: 's(t), м' }, { key: 'v', label: 'v(t) = s′(t), м/с' }, { key: 'avg', label: 'средняя на [t, t + Δt]' }]);
    function draw() {
      const v0 = s.v0;
      const T = (2 * v0) / 10;
      const pos = (t) => v0 * t - 5 * t * t;
      const vel = (t) => v0 - 10 * t;
      const t = (s.k / NK) * T;
      const t2 = Math.min(T, t + s.dt);
      const avg = t2 > t ? (pos(t2) - pos(t)) / (t2 - t) : vel(t);
      const ts = U.linspace(0, T, 300);
      const top = (v0 * v0) / 20;
      const xBall = T * 1.1;
      const half = T * 0.12;
      p1.render([
        { type: 'line', x: ts, y: ts.map(pos), color: 'model', width: 2.2, label: 's(t)', hover: false },
        { type: 'segments', x1: [t - half], y1: [pos(t) - half * vel(t)], x2: [t + half], y2: [pos(t) + half * vel(t)], color: 'tree', width: 2.5, opacity: 1 },
        t2 > t ? { type: 'segments', x1: [t], y1: [pos(t)], x2: [t2], y2: [pos(t2)], color: 'aqua', width: 2, opacity: 1 } : null,
        t2 > t ? { type: 'points', x: [t2], y: [pos(t2)], color: 'aqua', r: 4.5 } : null,
        { type: 'points', x: [t], y: [pos(t)], color: 'tree', r: 6 },
        { type: 'segments', x1: [xBall], y1: [0], x2: [xBall], y2: [top], color: 'ink2', width: 1, opacity: 0.5, dash: '2 3' },
        { type: 'points', x: [xBall], y: [pos(t)], color: 'tree', r: 8, label: 'мяч' },
        Math.abs(vel(t)) > 0.5 ? { type: 'arrows', x1: [xBall + T * 0.04], y1: [pos(t)], x2: [xBall + T * 0.04], y2: [pos(t) + (vel(t) / v0) * 0.3 * top], color: 'ink', width: 2 } : null,
      ], { x: [0, T * 1.18], y: [-top * 0.05, top * 1.12] });
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1.2 },
        { type: 'line', x: ts, y: ts.map(vel), color: 'tree', width: 2.2, label: 'v(t) = s′(t)', hover: false },
        t2 > t ? { type: 'segments', x1: [t], y1: [avg], x2: [t2], y2: [avg], color: 'aqua', width: 2.4, opacity: 1 } : null,
        { type: 'points', x: [t], y: [vel(t)], color: 'tree', r: 6 },
      ], { x: [0, T * 1.18], y: [-v0 * 1.1, v0 * 1.1] });
      st.set('t', U.fmt(t, 3));
      st.set('s', U.fmt(pos(t), 3));
      st.set('v', U.fmt(vel(t), 3));
      st.set('avg', U.fmt(avg, 3));
      const v = vel(t);
      note.innerHTML = (Math.abs(v) < 0.26 ? '<b>Верхняя точка:</b> скорость 0, касательная горизонтальна. Мяч на мгновение замер на высоте ' + U.fmt(top, 3) + ' м. ' : v > 0 ? 'v > 0 — мяч летит <b>вверх</b>, но всё медленнее. ' : 'v &lt; 0 — мяч падает: высота убывает, наклон касательной отрицателен. ')
        + 'Средняя скорость на [' + U.fmt(t, 2) + '; ' + U.fmt(t2, 2) + '] = ' + U.fmt(avg, 3) + ' м/с ' + (Math.abs(avg - v) < 0.05 ? '— почти мгновенная: интервал мал.' : '— отличается от мгновенной на ' + U.fmt(Math.abs(avg - v), 3) + ' м/с. Уменьшите Δt.')
        + ' Скорость падает на 10 м/с каждую секунду: v′(t) = −10 — это ускорение.';
    }
    w.pythonAction(() => 'import numpy as np\n\nv0 = ' + s.v0 + '\ns = lambda t: v0 * t - 5 * t**2     # высота, м\nv = lambda t: v0 - 10 * t           # скорость = s\'(t), м/с\n\nt = ' + U.pyNum((s.k / NK) * ((2 * s.v0) / 10)) + '\nfor dt in [1, 0.1, 0.01, 0.001]:\n    print(f"Δt = {dt:<6}: средняя скорость = {(s(t + dt) - s(t)) / dt:.4f} м/с")\nprint("мгновенная v(t) =", v(t))\nprint("верхняя точка: t =", v0 / 10, "с, высота", s(v0 / 10), "м")\n');
    draw();
  });

  /* ==============================================================================
   * 9. Микроскоп: вблизи гладкая кривая — прямая
   * ============================================================================== */
  GBC.widget('zoom-tangent', (el) => {
    const s = { fn: 'cubic', a: 1.6, v: 0 };
    const NV = 60;
    const zoomOf = (v) => Math.pow(10, v / 20);
    const w = ui.shell(el, { title: 'Микроскоп: вблизи кривая становится прямой', sub: 'Окно увеличивается вокруг точки a. Нажмите ▶: у гладкой функции кривая всё сильнее прижимается к касательной; у |x| в нуле «галочка» остаётся галочкой при любом увеличении.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: fnOpts(['cubic', 'sin', 'exp', 'sq', 'abs']), onChange: (v) => ((s.fn = v), draw()) });
    ui.slider(w.controls, { label: 'Точка a', min: -1.6, max: 1.6, step: 0.05, value: s.a, onInput: (v) => ((s.a = v), draw()) });
    ui.player(w.controls, { label: 'Увеличение', min: 0, max: NV, value: 0, fps: 8, format: (v) => '×' + U.fmt(zoomOf(v), 3), onChange: (v) => ((s.v = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'z', label: 'увеличение' }, { key: 'w', label: 'ширина окна' }, { key: 'dev', label: 'отход от касательной' }, { key: 'rel', label: 'в долях высоты окна' }]);
    function draw() {
      const F = FN[s.fn];
      const a = s.a;
      const z = zoomOf(s.v);
      const half = 1.5 / z;
      const d = F.df(a);
      const sl = Number.isFinite(d) ? d : 0;
      const hy = half * Math.max(1, Math.abs(sl)) * 1.25;
      const xs = U.linspace(a - half, a + half, 300);
      const line = (x) => F.f(a) + sl * (x - a);
      let dev = 0;
      for (const x of xs) dev = Math.max(dev, Math.abs(F.f(x) - line(x)));
      plot.render([
        { type: 'line', x: xs, y: xs.map(F.f), color: 'model', width: 2.4, label: 'f(x)' },
        { type: 'line', x: [a - half, a + half], y: [line(a - half), line(a + half)], color: 'tree', width: 2, dash: '6 4', label: Number.isFinite(d) ? 'касательная' : 'прямая с наклоном 0', hover: false },
        { type: 'points', x: [a], y: [F.f(a)], color: 'tree', r: 5 },
      ], { x: [a - half, a + half], y: [F.f(a) - hy, F.f(a) + hy] });
      const rel = dev / (2 * hy);
      st.set('z', '×' + U.fmt(z, 3));
      st.set('w', U.fmt(2 * half, 3));
      st.set('dev', U.fmt(dev, 3));
      st.set('rel', U.fmt(100 * rel, 2) + ' %');
      if (!Number.isFinite(d)) note.innerHTML = 'В изломе |x| увеличение ничего не меняет: при любом масштабе видна «галочка». Ни одна прямая не прилегает к ней — производной здесь нет.';
      else if (rel < 0.01) note.innerHTML = 'Кривая и касательная неразличимы: отход меньше 1 % высоты окна. Поэтому <b>f(a + Δx) ≈ f(a) + f′(a)·Δx</b> при малых Δx.';
      else note.innerHTML = 'Пока видна кривизна. При увеличении в 10 раз отход в долях окна тоже уменьшается примерно в 10 раз: сама ошибка приближения убывает как Δx².';
    }
    w.pythonAction(() => {
      const F = FN[s.fn];
      return pyHead(F) + '\na = ' + U.pyNum(s.a) + '\nfig, axes = plt.subplots(1, 3, figsize=(12, 3.5))\nfor ax, half in zip(axes, [1.5, 0.15, 0.015]):\n    x = np.linspace(a - half, a + half, 300)\n    ax.plot(x, f(x), label="f(x)")\n    ax.plot(x, f(a) + df(a) * (x - a), "--", label="касательная")\n    ax.set_title(f"окно ±{half}")\naxes[0].legend()\nplt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * 10. Линейное приближение: f(a + Δ) ≈ f(a) + f′(a)Δ и его ошибка
   * ============================================================================== */
  const LIN = {
    sqrt4: { label: '√x около 4: √4.1', f: Math.sqrt, df: (x) => 0.5 / Math.sqrt(x), d2: (x) => -0.25 * Math.pow(x, -1.5), a: 4, R: 2, d0: 0.1, py: 'np.sqrt(x)', dpy: '1 / (2 * np.sqrt(x))' },
    pow10: { label: 'x¹⁰ около 1: 1.02¹⁰', f: (x) => Math.pow(x, 10), df: (x) => 10 * Math.pow(x, 9), d2: (x) => 90 * Math.pow(x, 8), a: 1, R: 0.1, d0: 0.02, py: 'x**10', dpy: '10 * x**9' },
    exp0: { label: 'eˣ около 0: e^0.1', f: Math.exp, df: Math.exp, d2: Math.exp, a: 0, R: 1, d0: 0.1, py: 'np.exp(x)', dpy: 'np.exp(x)' },
    ln1: { label: 'ln x около 1: ln 1.05', f: Math.log, df: (x) => 1 / x, d2: (x) => -1 / (x * x), a: 1, R: 0.5, d0: 0.05, py: 'np.log(x)', dpy: '1 / x' },
    sin0: { label: 'sin x около 0: sin 0.1', f: Math.sin, df: Math.cos, d2: (x) => -Math.sin(x), d3: 1, a: 0, R: 1.5, d0: 0.1, py: 'np.sin(x)', dpy: 'np.cos(x)' },
    cos0: { label: 'cos x около 0: cos 0.1', f: Math.cos, df: (x) => -Math.sin(x), d2: (x) => -Math.cos(x), a: 0, R: 1.5, d0: 0.1, py: 'np.cos(x)', dpy: '-np.sin(x)' },
    cbrt8: { label: '∛x около 8: ∛8.3', f: Math.cbrt, df: (x) => 1 / (3 * Math.cbrt(x * x)), d2: (x) => (-2 / 9) * Math.pow(x, -5 / 3), a: 8, R: 4, d0: 0.3, py: 'np.cbrt(x)', dpy: '1 / (3 * np.cbrt(x)**2)' },
    recip1: { label: '1/x около 1: 1/0.98', f: (x) => 1 / x, df: (x) => -1 / (x * x), d2: (x) => 2 / (x * x * x), a: 1, R: 0.5, d0: -0.02, py: '1 / x', dpy: '-1 / x**2' },
  };
  GBC.widget('linear-approx', (el) => {
    const s = { c: 'sqrt4', d: 0.1 };
    const w = ui.shell(el, { title: 'Линейное приближение и его ошибка', sub: 'Вместо f(a + Δ) считаем f(a) + f′(a)·Δ — значение на касательной. Сверху — функция, касательная и ошибка (вертикальный отрезок). Снизу — модуль ошибки в зависимости от |Δ| в логарифмическом масштабе: наклон 2 означает «ошибка ∝ Δ²».' });
    ui.select(w.controls, { label: 'Пример', value: s.c, options: Object.entries(LIN).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.c = v;
      const E = LIN[v];
      dSl.input.min = -E.R;
      dSl.input.max = E.R;
      dSl.input.step = E.R / 200;
      s.d = E.d0;
      dSl.set(s.d);
      draw();
    } });
    const dSl = ui.slider(w.controls, { label: 'Сдвиг Δ', min: -2, max: 2, step: 0.01, value: s.d, format: (v) => U.fmt(v, 4), onInput: (v) => ((s.d = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: '|Δ| (лог. шкала)', type: 'log', format: powFmt }, y: { label: '|ошибка| (лог. шкала)', type: 'log', format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ex', label: 'точно f(a + Δ)' }, { key: 'ap', label: 'f(a) + f′(a)·Δ' }, { key: 'err', label: 'ошибка' }, { key: 'k', label: 'ошибка / Δ²' }]);
    function draw() {
      const E = LIN[s.c];
      const a = E.a;
      const d = s.d;
      const tan = (x) => E.f(a) + E.df(a) * (x - a);
      const exact = E.f(a + d);
      const appr = tan(a + d);
      const err = appr - exact;
      const lo = a - E.R;
      const c = curve(E.f, lo, a + E.R, 401);
      p1.render([
        { type: 'line', x: c.x, y: c.y, color: 'model', width: 2.2, label: 'f(x)', hover: false },
        { type: 'line', x: [lo, a + E.R], y: [tan(lo), tan(a + E.R)], color: 'tree', width: 2, dash: '6 4', label: 'касательная в a', hover: false },
        { type: 'segments', x1: [a + d], y1: [exact], x2: [a + d], y2: [appr], color: 'critical', width: 3, opacity: 1 },
        { type: 'points', x: [a], y: [E.f(a)], color: 'tree', r: 5 },
        { type: 'points', x: [a + d, a + d], y: [exact, appr], color: (i) => (i ? 'tree' : 'model'), r: 5, tooltip: (i) => [[i ? 'приближение' : 'точно', U.fmt(i ? appr : exact, 6)]] },
      ], { y: yRange(E.f, U.linspace(lo, a + E.R, 100).concat([a]), 0.1) });
      const ds = logspace(Math.log10(E.R) - 4, Math.log10(E.R), 120);
      const e = (t) => Math.abs(tan(a + t) - E.f(a + t));
      const c2 = Math.abs(E.d2(a)) / 2;
      const yp = ds.map(e);
      const ym = ds.map((t) => e(-t));
      const keep = (v) => (Number.isFinite(v) && v > 1e-16 ? v : NaN);
      const layers = [
        { type: 'line', x: ds, y: yp.map(keep), color: 'model', width: 2.2, label: 'Δ > 0', hover: false },
        { type: 'line', x: ds, y: ym.map(keep), color: 'aqua', width: 2, dash: '5 3', label: 'Δ < 0', hover: false },
      ];
      if (c2 > 0) layers.push({ type: 'line', x: ds, y: ds.map((t) => c2 * t * t), color: 'ink2', width: 1.2, dash: '2 3', label: '½|f″(a)|·Δ²', hover: false });
      else layers.push({ type: 'line', x: ds, y: ds.map((t) => (t * t * t) / 6), color: 'ink2', width: 1.2, dash: '2 3', label: 'Δ³/6 (f″(a) = 0)', hover: false });
      if (Math.abs(d) > 0 && Math.abs(err) > 1e-16) layers.push({ type: 'points', x: [Math.abs(d)], y: [Math.abs(err)], color: 'critical', r: 6 });
      const allY = yp.concat(ym).map(keep).filter(Number.isFinite);
      const [ylo, yhi] = U.extent(allY);
      const p0 = Math.floor(Math.log10(Math.max(ylo, 1e-16)));
      const p1e = Math.ceil(Math.log10(yhi));
      const step = Math.max(1, Math.ceil((p1e - p0) / 6));
      p2.opts.y.ticks = decadeTicks(p0, p1e, step);
      p2.opts.x.ticks = decadeTicks(Math.ceil(Math.log10(E.R) - 4), Math.floor(Math.log10(E.R)));
      p2.render(layers, { x: [ds[0], ds[ds.length - 1]], y: [Math.pow(10, p0), Math.pow(10, p1e)] });
      st.set('ex', U.fmt(exact, 7));
      st.set('ap', U.fmt(appr, 7));
      st.set('err', U.fmt(err, 3));
      st.set('k', Math.abs(d) > 1e-12 ? U.fmt(err / (d * d), 4) : '—');
      const msgs = {
        sqrt4: 'f′(4) = 1/(2√4) = 0.25, поэтому √(4 + Δ) ≈ 2 + 0.25·Δ. При Δ = 0.1: 2.025 против точного 2.0248457 — ошибка 0.00015.',
        pow10: 'f′(1) = 10, поэтому (1 + Δ)¹⁰ ≈ 1 + 10Δ. При Δ = 0.02: 1.2 против 1.2190 — ошибка 0.019, уже заметная: вторая производная x¹⁰ в единице равна 90, касательная быстро отходит от кривой. Это «ошибка сложных процентов».',
        exp0: 'e^Δ ≈ 1 + Δ около нуля. При Δ = 0.1: 1.1 против 1.10517 — касательная лежит под выпуклой экспонентой.',
        ln1: 'ln(1 + Δ) ≈ Δ. При Δ = 0.05: 0.05 против 0.04879. Отсюда правило «логарифм малого изменения ≈ относительное изменение».',
        sin0: 'sin Δ ≈ Δ. При Δ = 0.1 ошибка всего 0.00017: в нуле f″ = 0, и ошибка убывает как Δ³ (наклон 3 на нижнем графике), а не Δ².',
        cos0: 'f′(0) = 0: касательная горизонтальна, cos Δ ≈ 1. Ошибка ≈ Δ²/2: при Δ = 0.1 она 0.005. Линейное приближение в экстремуме ничего не говорит о форме — нужен квадратичный член (урок 15.7).',
        cbrt8: 'f′(8) = 1/(3·∛64) = 1/12, поэтому ∛8.3 ≈ 2 + 0.3/12 = 2.025 против 2.02469 — ошибка 0.0003.',
        recip1: 'f′(1) = −1, поэтому 1/(1 + Δ) ≈ 1 − Δ. При Δ = −0.02: 1/0.98 ≈ 1.02 против 1.020408.',
      };
      note.innerHTML = msgs[s.c] + ' Нижний график: в логарифмическом масштабе ошибка — прямая с наклоном 2 (или 3), то есть <b>ошибка убывает быстрее самого Δ</b>: f(a + Δ) = f(a) + f′(a)Δ + o(Δ).';
    }
    w.pythonAction(() => {
      const E = LIN[s.c];
      return 'import numpy as np\n\nf = lambda x: ' + E.py + '\ndf = lambda x: ' + E.dpy + '\na = ' + E.a + '\nfor d in [' + U.pyNum(s.d) + ', 0.1, 0.01, 0.001]:\n    approx = f(a) + df(a) * d\n    err = approx - f(a + d)\n    print(f"Δ = {d:<6}: точно {f(a + d):.8f}, приближение {approx:.8f}, ошибка {err:.2e}, ошибка/Δ² = {err / d**2:.4f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 11. Скорости изменения в разных науках: единицы, относительная скорость, эластичность
   * ============================================================================== */
  const RATES = {
    cost: { label: 'Экономика: издержки C(q)', f: (q) => 1000 + 5 * q + 0.01 * q * q, df: (q) => 5 + 0.02 * q, dom: [0, 300], x0: 100, xl: 'объём выпуска q, шт.', yl: 'издержки C, ₽', fu: '₽', du: '₽ за штуку', py: ['1000 + 5 * x + 0.01 * x**2', '5 + 0.02 * x'],
      say: (x, f, d) => 'Предельные издержки C′(' + U.fmt(x, 0) + ') = ' + U.fmt(d, 3) + ' ₽/шт.: столько примерно стоит выпуск ещё одной штуки. Точная разница C(q + 1) − C(q) = ' + U.fmt(1000 + 5 * (x + 1) + 0.01 * (x + 1) ** 2 - f, 4) + ' ₽.' },
    rod: { label: 'Физика: масса стержня m(x)', f: (x) => 2 * x + x * x, df: (x) => 2 + 2 * x, dom: [0, 3], x0: 1, xl: 'расстояние от конца x, м', yl: 'масса куска [0, x], кг', fu: 'кг', du: 'кг/м', py: ['2 * x + x**2', '2 + 2 * x'],
      say: (x, f, d) => 'Линейная плотность ρ(' + U.fmt(x, 2) + ') = m′(x) = ' + U.fmt(d, 3) + ' кг/м: сантиметр стержня здесь весит ≈ ' + U.fmt(d * 10, 3) + ' г. Стержень утолщается к правому концу.' },
    charge: { label: 'Электричество: заряд q(t)', f: (t) => 2 * t * t + t, df: (t) => 4 * t + 1, dom: [0, 5], x0: 2, xl: 'время t, с', yl: 'прошедший заряд q, Кл', fu: 'Кл', du: 'А (Кл/с)', py: ['2 * x**2 + x', '4 * x + 1'],
      say: (x, f, d) => 'Сила тока I(' + U.fmt(x, 2) + ') = q′(t) = ' + U.fmt(d, 3) + ' А — столько кулонов в секунду проходит через провод в этот момент.' },
    pop: { label: 'Биология: популяция P(t)', f: (t) => 1000 * Math.exp(0.03 * t), df: (t) => 30 * Math.exp(0.03 * t), dom: [0, 50], x0: 20, xl: 'время t, лет', yl: 'численность P, особей', fu: 'особей', du: 'особей в год', py: ['1000 * np.exp(0.03 * x)', '30 * np.exp(0.03 * x)'],
      say: (x, f, d) => 'Абсолютная скорость P′ = ' + U.fmt(d, 4) + ' особей в год растёт вместе с популяцией, а <b>относительная</b> P′/P = 0.03 = 3 % в год постоянна — признак экспоненты.' },
    demand: { label: 'Спрос Q(p) и эластичность', f: (p) => 1000 / (p * p), df: (p) => -2000 / (p * p * p), dom: [1, 10], x0: 4, xl: 'цена p, ₽', yl: 'спрос Q, шт.', fu: 'шт.', du: 'шт. на рубль', py: ['1000 / x**2', '-2000 / x**3'],
      say: (x, f, d) => 'Наклон Q′ = ' + U.fmt(d, 4) + ' шт./₽ зависит от цены, а <b>эластичность</b> p·Q′/Q = −2 везде: цена +1 % → спрос примерно −2 %. Эластичность не зависит от единиц (рубли или доллары).' },
    loss: { label: 'Обучение: потери L(m) после m деревьев', f: (m) => 0.2 + 0.8 * Math.exp(-m / 30), df: (m) => (-0.8 / 30) * Math.exp(-m / 30), dom: [0, 150], x0: 30, xl: 'число деревьев m', yl: 'потери на валидации L', fu: '', du: 'на одно дерево', py: ['0.2 + 0.8 * np.exp(-x / 30)', '-0.8 / 30 * np.exp(-x / 30)'],
      say: (x, f, d) => 'Каждое следующее дерево уменьшает потери примерно на ' + U.fmt(-d, 3) + '. Когда этот выигрыш становится меньше шума валидации, добавлять деревья бессмысленно — так рассуждает ранняя остановка (урок 4.2).' },
  };
  GBC.widget('rates-around', (el) => {
    const s = { c: 'cost', x: 100 };
    const w = ui.shell(el, { title: 'Производная в разных науках', sub: 'Одна и та же идея — «на сколько изменится величина при малом изменении аргумента» — под разными именами. Обратите внимание на единицы: [f′] = [f] / [x]. Относительная скорость f′/f и эластичность x·f′/f отвечают на вопрос «на сколько процентов».' });
    ui.select(w.controls, { label: 'Контекст', value: s.c, options: Object.entries(RATES).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.c = v;
      const E = RATES[v];
      xSl.input.min = E.dom[0];
      xSl.input.max = E.dom[1];
      xSl.input.step = (E.dom[1] - E.dom[0]) / 300;
      s.x = E.x0;
      xSl.set(s.x);
      draw();
    } });
    const xSl = ui.slider(w.controls, { label: 'Точка x', min: 0, max: 300, step: 1, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'x' }, y: { label: 'f' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'значение' }, { key: 'd', label: 'производная' }, { key: 'rel', label: 'относит. f′/f' }, { key: 'el', label: 'эластичность x·f′/f' }]);
    function draw() {
      const E = RATES[s.c];
      const x = U.clamp(s.x, E.dom[0], E.dom[1]);
      const fx = E.f(x);
      const d = E.df(x);
      const xs = U.linspace(E.dom[0], E.dom[1], 400);
      const half = (E.dom[1] - E.dom[0]) * 0.15;
      plot.opts.x.label = E.xl;
      plot.opts.y.label = E.yl;
      plot.render([
        { type: 'line', x: xs, y: xs.map(E.f), color: 'model', width: 2.2, hover: false },
        { type: 'segments', x1: [x - half], y1: [fx - half * d], x2: [x + half], y2: [fx + half * d], color: 'tree', width: 2.5, opacity: 1 },
        { type: 'vline', x, color: 'tree', width: 1, opacity: 0.4, draggable: true, onDrag: (v) => ((s.x = U.clamp(v, E.dom[0], E.dom[1])), xSl.set(s.x), draw()) },
        { type: 'points', x: [x], y: [fx], color: 'tree', r: 6 },
      ], { x: E.dom, y: yRange(E.f, xs, 0.12) });
      st.set('f', U.fmt(fx, 4) + (E.fu ? ' ' + E.fu : ''));
      st.set('d', U.fmt(d, 4) + ' ' + E.du);
      st.set('rel', U.fmt((100 * d) / fx, 3) + ' %');
      st.set('el', x > 0 ? U.fmt((x * d) / fx, 3) : '—');
      note.innerHTML = E.say(x, fx, d);
    }
    w.pythonAction(() => {
      const E = RATES[s.c];
      return 'import numpy as np\n\nf = lambda x: ' + E.py[0] + '\ndf = lambda x: ' + E.py[1] + '\nx = ' + U.pyNum(s.x) + '\nprint("значение:", f(x))\nprint("производная:", df(x))\nprint("относительная скорость f\'/f:", df(x) / f(x))\nprint("эластичность x·f\'/f:", x * df(x) / f(x))\nprint("проверка: (f(x + 1) − f(x)) =", f(x + 1) - f(x))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 12. Односторонние производные
   * ============================================================================== */
  const SIDES = {
    abs: { label: '|x| в точке 0', f: Math.abs, a: 0, L: -1, Rr: 1, dom: [-1.5, 1.5], py: 'np.abs(x)' },
    relu: { label: 'ReLU = max(0, x) в точке 0', f: (x) => Math.max(0, x), a: 0, L: 0, Rr: 1, dom: [-1.5, 1.5], py: 'np.maximum(0, x)' },
    hinge: { label: 'hinge = max(0, 1 − x) в точке 1', f: (x) => Math.max(0, 1 - x), a: 1, L: -1, Rr: 0, dom: [-0.5, 2.5], py: 'np.maximum(0, 1 - x)' },
    absq: { label: '|x² − 1| в точке 1', f: (x) => Math.abs(x * x - 1), a: 1, L: -2, Rr: 2, dom: [-0.2, 2.2], py: 'np.abs(x**2 - 1)' },
    glueC: { label: 'x² при x < 1, 3x − 2 при x ≥ 1 — угол', f: (x) => (x < 1 ? x * x : 3 * x - 2), a: 1, L: 2, Rr: 3, dom: [-0.5, 2.5], py: 'np.where(x < 1, x**2, 3 * x - 2)' },
    glueS: { label: 'x² при x < 1, 2x − 1 при x ≥ 1 — гладко', f: (x) => (x < 1 ? x * x : 2 * x - 1), a: 1, L: 2, Rr: 2, dom: [-0.5, 2.5], py: 'np.where(x < 1, x**2, 2 * x - 1)' },
  };
  GBC.widget('one-sided', (el) => {
    const s = { c: 'abs', k: 0 };
    const NK = 30;
    const hOf = (k) => Math.pow(10, (-3 * k) / NK);
    const w = ui.shell(el, { title: 'Производная слева и справа', sub: 'Две секущие: слева (через a − h и a) и справа (через a и a + h). Нажмите ▶: h → 0. Если их наклоны подходят к одному числу — производная существует; если к разным — в точке излом.' });
    ui.select(w.controls, { label: 'Функция', value: s.c, options: Object.entries(SIDES).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.c = v), draw()) });
    ui.player(w.controls, { label: 'Сжимаем h', min: 0, max: NK, value: 0, fps: 5, format: (k) => 'h = ' + powFmt(hOf(k)), onChange: (k) => ((s.k = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'h (лог. шкала)', type: 'log', domain: [0.001, 1], ticks: [0.001, 0.01, 0.1, 1] }, y: { label: 'наклон секущей' } });
    const verdict = H('div', { style: 'margin:6px 0' });
    w.main.appendChild(verdict);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'h', label: 'h' }, { key: 'l', label: 'наклон слева' }, { key: 'r', label: 'наклон справа' }, { key: 'lim', label: 'f′₋(a) и f′₊(a)' }]);
    function draw() {
      const C = SIDES[s.c];
      const a = C.a;
      const h = hOf(s.k);
      const fa = C.f(a);
      const ql = (t) => (fa - C.f(a - t)) / t;
      const qr = (t) => (C.f(a + t) - fa) / t;
      const c = curve(C.f, C.dom[0], C.dom[1], 801);
      const lx = [C.dom[0], C.dom[1]];
      const fin = s.k === NK;
      p1.render([
        { type: 'line', x: c.x, y: c.y, color: 'model', width: 2.4, label: 'f(x)', hover: false },
        { type: 'line', x: lx, y: lx.map((x) => fa + ql(h) * (x - a)), color: 'aqua', width: 1.8, label: 'секущая слева', hover: false },
        { type: 'line', x: lx, y: lx.map((x) => fa + qr(h) * (x - a)), color: 'violet', width: 1.8, label: 'секущая справа', hover: false },
        fin ? { type: 'line', x: [C.dom[0], a], y: [fa + C.L * (C.dom[0] - a), fa], color: 'aqua', width: 3, opacity: 0.6, hover: false } : null,
        fin ? { type: 'line', x: [a, C.dom[1]], y: [fa, fa + C.Rr * (C.dom[1] - a)], color: 'violet', width: 3, opacity: 0.6, hover: false } : null,
        { type: 'points', x: [a - h, a + h], y: [C.f(a - h), C.f(a + h)], color: (i) => (i ? 'violet' : 'aqua'), r: 5 },
        { type: 'points', x: [a], y: [fa], color: 'tree', r: 6 },
      ], { x: C.dom, y: yRange(C.f, U.linspace(C.dom[0], C.dom[1], 200), 0.15) });
      const hs = logspace(-3, 0, 120);
      p2.render([
        { type: 'line', x: hs, y: hs.map(ql), color: 'aqua', width: 2.2, label: 'слева', hover: false },
        { type: 'line', x: hs, y: hs.map(qr), color: 'violet', width: 2.2, label: 'справа', hover: false },
        { type: 'hline', y: C.L, color: 'aqua', dash: '6 4', width: 1, text: C.L === C.Rr ? 'f′(a) = ' + C.L : 'f′₋ = ' + C.L },
        C.L !== C.Rr ? { type: 'hline', y: C.Rr, color: 'violet', dash: '6 4', width: 1, text: 'f′₊ = ' + C.Rr } : null,
        { type: 'vline', x: h, color: 'ink2', dash: '3 3', width: 1 },
      ], { y: [Math.min(C.L, C.Rr, ...hs.map(ql), ...hs.map(qr)) - 0.4, Math.max(C.L, C.Rr, ...hs.map(ql), ...hs.map(qr)) + 0.4] });
      st.set('h', powFmt(h));
      st.set('l', U.fmt(ql(h), 5));
      st.set('r', U.fmt(qr(h), 5));
      st.set('lim', C.L + ' и ' + C.Rr);
      verdict.replaceChildren(C.L === C.Rr ? badge('f′₋(a) = f′₊(a) = ' + C.L + ' — производная существует', 'good') : badge('f′₋(a) = ' + C.L + ' ≠ f′₊(a) = ' + C.Rr + ' — производной нет (излом)', 'bad'));
      const msgs = {
        abs: 'Слева наклон −1, справа +1. Это и есть «галочка» модуля и функции потерь MAE в нуле остатка.',
        relu: 'ReLU — главная функция активации нейросетей: слева 0, справа 1. В нуле производной нет, и библиотеки просто договариваются брать 0 (или 1).',
        hinge: 'Потери hinge (метод опорных векторов) в точке 1: слева −1, справа 0.',
        absq: 'Модуль «переворачивает» отрицательный кусок параболы вверх: наклон слева −2, справа +2. Внутри каждого куска функция гладкая — излом только там, где выражение под модулем меняет знак.',
        glueC: 'Куски склеены непрерывно (1 = 1), но наклоны 2 и 3 разные — получился угол. Непрерывность не гарантирует производную.',
        glueS: 'Склеены и значения (1 = 1), и наклоны (2 = 2) — излома нет, производная существует и равна 2. Так склеивают куски потерь Хьюбера (шаг 13).',
      };
      note.innerHTML = msgs[s.c];
    }
    w.pythonAction(() => {
      const C = SIDES[s.c];
      return 'import numpy as np\n\nf = lambda x: ' + C.py + '\na = ' + C.a + '\nfor h in [0.1, 0.01, 0.001, 1e-6]:\n    left = (f(a) - f(a - h)) / h\n    right = (f(a + h) - f(a)) / h\n    print(f"h = {h:<6}: слева {left:.6f}, справа {right:.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 13. Галерея: где производной нет
   * ============================================================================== */
  const GAL = {
    corner: { label: 'излом: |x|', f: Math.abs, f0: 0, py: 'np.abs(x)', verdict: ['нет: наклоны −1 и +1', 'bad'], note: 'Односторонние пределы конечны, но различны — угол. Под микроскопом угол не исчезает.' },
    cusp: { label: 'остриё: √|x|', f: (x) => Math.sqrt(Math.abs(x)), f0: 0, py: 'np.sqrt(np.abs(x))', verdict: ['нет: наклоны −∞ и +∞', 'bad'], note: 'Справа отношение √h/h = 1/√h → +∞, слева → −∞. Обе ветви подходят к точке вертикально, но с разных сторон — остриё (касп).' },
    vert: { label: 'вертикальная касательная: ∛x', f: Math.cbrt, f0: 0, py: 'np.cbrt(x)', verdict: ['нет: наклон → +∞', 'bad'], note: 'Отношение ∛h/h = h^(−2/3) → +∞ с обеих сторон. Касательная есть — это вертикальная прямая x = 0, но её наклон не число. Говорят: производная бесконечна.' },
    jump: { label: 'скачок: ступенька [x ≥ 0]', f: (x) => (x >= 0 ? 1 : 0), f0: 1, step: true, py: '(x >= 0) * 1.0', verdict: ['нет: функция разрывна', 'bad'], note: 'Справа отношение (1 − 1)/h = 0, слева (0 − 1)/(−h) = 1/h → +∞. Разрывная функция не дифференцируема (шаг 13). Так устроено каждое дерево решений на пороге.' },
    osc: { label: 'колебания: x·sin(1/x)', f: (x) => (x === 0 ? 0 : x * Math.sin(1 / x)), f0: 0, osc: true, py: 'np.where(x == 0, 0, x * np.sin(1 / np.where(x == 0, 1, x)))', verdict: ['нет: отношение колеблется', 'bad'], note: 'Функция непрерывна (|x sin(1/x)| ≤ |x| → 0), но отношение f(h)/h = sin(1/h) бесконечно колеблется между −1 и 1 и предела не имеет. Под микроскопом картинка не распрямляется: зубцы только мельчают.' },
    wild: { label: 'с подвохом: x²·sin(1/x)', f: (x) => (x === 0 ? 0 : x * x * Math.sin(1 / x)), f0: 0, osc: true, py: 'np.where(x == 0, 0, x**2 * np.sin(1 / np.where(x == 0, 1, x)))', verdict: ['есть: f′(0) = 0', 'good'], note: 'Здесь f(h)/h = h·sin(1/h) → 0: производная в нуле <b>существует</b> и равна 0, под микроскопом график прижимается к оси x. Но сама f′(x) = 2x·sin(1/x) − cos(1/x) при x → 0 колеблется и предела не имеет — производная есть, но разрывна.' },
  };
  GBC.widget('nondiff-gallery', (el) => {
    const s = { c: 'corner', v: 0 };
    const NV = 50;
    const zoomOf = (v) => Math.pow(10, v / 25);
    const w = ui.shell(el, { title: 'Галерея: где производной нет', sub: 'Шесть «плохих» точек — все в x = 0. Нажмите ▶, чтобы увеличить окно в 100 раз: гладкая функция под микроскопом распрямилась бы в прямую. Таблица — разностные отношения справа и слева.' });
    ui.select(w.controls, { label: 'Случай', value: s.c, options: Object.entries(GAL).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.c = v), draw()) });
    ui.player(w.controls, { label: 'Увеличение', min: 0, max: NV, value: 0, fps: 8, format: (v) => '×' + U.fmt(zoomOf(v), 3), onChange: (v) => ((s.v = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'x' }, y: { label: 'f(x)' } });
    const verdict = H('div', { style: 'margin:6px 0' });
    w.main.appendChild(verdict);
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const C = GAL[s.c];
      const half = 1 / zoomOf(s.v);
      const xs = C.osc ? denseNear(-half, half, 0, 2400) : U.linspace(-half, half, 801);
      const c = curve(C.f, -half, half, 0, { xs: xs.filter((x) => !C.step || Math.abs(x) > 1e-12), jump: C.step ? 0.5 : undefined });
      let ylo;
      let yhi;
      if (s.c === 'cusp' || s.c === 'vert') {
        const m = (s.c === 'vert' ? Math.cbrt(half) : Math.sqrt(half)) * 1.15;
        ylo = s.c === 'cusp' ? -0.1 * m : -m;
        yhi = m;
      } else if (C.step) (ylo = -0.3), (yhi = 1.3);
      else (ylo = -half * (s.c === 'wild' ? 0.6 : 1.15)), (yhi = half * 1.15);
      if (s.c === 'corner') ylo = -0.15 * half;
      plot.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'vline', x: 0, color: 'axis', width: 1 },
        { type: 'line', x: c.x, y: c.y, color: 'model', width: 2.2, hover: false },
        C.step ? { type: 'points', x: [0], y: [0], color: 'model', r: 5, hollow: true } : null,
        { type: 'points', x: [0], y: [C.f0], color: 'tree', r: 6 },
      ], { x: [-half, half], y: [ylo, yhi] });
      const hs = [0.1, 0.01, 0.001, 0.0001];
      const qr = (h) => (C.f(h) - C.f0) / h;
      const ql = (h) => (C.f0 - C.f(-h)) / h;
      rowTable(tbl, ['h', ...hs.map((h) => powFmt(h))], [['справа (f(h) − f(0))/h', ...hs.map((h) => U.fmt(qr(h), 4))], ['слева (f(0) − f(−h))/h', ...hs.map((h) => U.fmt(ql(h), 4))]]);
      verdict.replaceChildren(H('span', { style: 'margin-right:8px;color:var(--ink-2)' }, 'Производная в нуле:'), badge(C.verdict[0], C.verdict[1]));
      note.innerHTML = C.note;
    }
    w.pythonAction(() => {
      const C = GAL[s.c];
      return 'import numpy as np\n\nf = lambda x: ' + C.py + '\nf0 = ' + C.f0 + '\nfor h in [0.1, 0.01, 0.001, 1e-4, 1e-5]:\n    right = (f(np.float64(h)) - f0) / h\n    left = (f0 - f(np.float64(-h))) / h\n    print(f"h = {h:<7}: справа {right: .5f}, слева {left: .5f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 14. Лестница гладкости: f, f′, f″ рядом
   * ============================================================================== */
  const SMOOTH = {
    step: { label: 'ступенька [x ≥ 0] — дерево', f: (x) => (x >= 0 ? 1 : 0), d1: (x) => (x === 0 ? NaN : 0), d2: (x) => (x === 0 ? NaN : 0), cls: 'разрывна: даже не C⁰', kind: 'bad', jumps: [0], py: ['(x >= 0) * 1.0', '0 * x', '0 * x'], note: 'Прогноз дерева — ступенька: на пороге скачок, вне порога наклон 0. Поэтому деревья не обучают градиентом по их параметрам — бустинг дифференцирует потери, а не дерево (шаг 27).' },
    abs: { label: '|x| — MAE', f: Math.abs, d1: (x) => (x === 0 ? NaN : Math.sign(x)), d2: (x) => (x === 0 ? NaN : 0), cls: 'C⁰: непрерывна, но с изломом', kind: 'neutral', jumps: [0], py: ['np.abs(x)', 'np.sign(x)', '0 * x'], note: 'Сама функция непрерывна, производная — ступенька от −1 к +1. Ньютоновские методы, которым нужна f″, на MAE работают плохо: f″ = 0 почти везде.' },
    relu: { label: 'ReLU max(0, x)', f: (x) => Math.max(0, x), d1: (x) => (x === 0 ? NaN : x > 0 ? 1 : 0), d2: (x) => (x === 0 ? NaN : 0), cls: 'C⁰: непрерывна, но с изломом', kind: 'neutral', jumps: [0], py: ['np.maximum(0, x)', '(x > 0) * 1.0', '0 * x'], note: 'Как и у |x|, производная — ступенька. Нейросетям этого хватает: точно в ноль аргумент почти никогда не попадает.' },
    huber: { label: 'Хьюбер, δ = 1', f: (x) => (Math.abs(x) <= 1 ? 0.5 * x * x : Math.abs(x) - 0.5), d1: (x) => U.clamp(x, -1, 1), d2: (x) => (Math.abs(x) === 1 ? NaN : Math.abs(x) < 1 ? 1 : 0), cls: 'C¹: f′ непрерывна, f″ со скачками', kind: 'neutral', jumps: [-1, 1], py: ['np.where(np.abs(x) <= 1, 0.5 * x**2, np.abs(x) - 0.5)', 'np.clip(x, -1, 1)', '(np.abs(x) < 1) * 1.0'], note: 'Склейка параболы и прямых по значению и наклону: f′ = clip(x, −1, 1) непрерывна (наклоны не прыгают), а f″ прыгает с 1 на 0 при |x| = 1. Лучшее из MSE (гладкость у нуля) и MAE (устойчивость к выбросам).' },
    xabs: { label: 'x·|x|', f: (x) => x * Math.abs(x), d1: (x) => 2 * Math.abs(x), d2: (x) => (x === 0 ? NaN : 2 * Math.sign(x)), cls: 'C¹: f′ непрерывна, f″ со скачком', kind: 'neutral', jumps: [0], py: ['x * np.abs(x)', '2 * np.abs(x)', '2 * np.sign(x)'], note: 'Гладкая на вид функция: производная 2|x| непрерывна, но сама с изломом — поэтому второй производной в нуле нет.' },
    sq: { label: '½x² — MSE', f: (x) => 0.5 * x * x, d1: (x) => x, d2: () => 1, cls: 'C^∞: сколько угодно производных', kind: 'good', jumps: [], py: ['0.5 * x**2', 'x', '1 + 0 * x'], note: 'Все производные существуют и непрерывны: f′ = x, f″ = 1, дальше нули. Поэтому квадратичные потери так удобны.' },
    soft: { label: 'softplus ln(1 + eˣ) — log-loss', f: (x) => Math.log1p(Math.exp(x)), d1: sigma, d2: (x) => sigma(x) * (1 - sigma(x)), cls: 'C^∞: сколько угодно производных', kind: 'good', jumps: [], py: ['np.log1p(np.exp(x))', '1 / (1 + np.exp(-x))', 'np.exp(-x) / (1 + np.exp(-x))**2'], note: 'Сглаженный ReLU. Это log-loss как функция прогноза (при y = 0): f′ = σ(x) — вероятность, f″ = σ(1 − σ). Обе гладкие — XGBoost пользуется ими как g и h.' },
  };
  GBC.widget('smoothness-ladder', (el) => {
    const s = { c: 'huber' };
    const w = ui.shell(el, { title: 'Лестница гладкости: f, f′ и f″', sub: 'Три графика друг под другом: функция, её производная и производная производной. Где на графике скачок или излом — там следующая производная перестаёт существовать. Выколотые точки — места, где производной нет.' });
    ui.select(w.controls, { label: 'Функция', value: s.c, options: Object.entries(SMOOTH).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.c = v), draw()) });
    const verdict = H('div', { style: 'margin:6px 0' });
    w.main.appendChild(verdict);
    const ps = ['f(x)', 'f′(x)', 'f″(x)'].map((lab) => new GBC.Plot(w.main, { height: 160, x: { label: 'x', domain: [-2.5, 2.5] }, y: { label: lab }, margin: { bottom: 36 } }));
    const note = w.note('', true);
    function draw() {
      const C = SMOOTH[s.c];
      const xs = U.linspace(-2.5, 2.5, 1001).concat(C.jumps).sort((a, b) => a - b);
      [C.f, C.d1, C.d2].forEach((fn, j) => {
        const c = curve(fn, -2.5, 2.5, 0, { xs: xs.filter((x) => !C.jumps.some((q) => Math.abs(x - q) < 1e-12)), jump: 0.3 });
        const ys = c.y.filter(Number.isFinite);
        let [lo, hi] = U.extent(ys);
        if (hi - lo < 0.5) (lo -= 0.5), (hi += 0.5);
        const pad = (hi - lo) * 0.15;
        const holes = [];
        for (const q of C.jumps) {
          const v = fn(q);
          if (!Number.isFinite(v)) {
            const l = fn(q - 1e-9);
            const r = fn(q + 1e-9);
            if (Number.isFinite(l)) holes.push([q, l]);
            if (Number.isFinite(r) && Math.abs(r - l) > 1e-6) holes.push([q, r]);
          }
        }
        ps[j].render([
          { type: 'hline', y: 0, color: 'axis', width: 1 },
          { type: 'line', x: c.x, y: c.y, color: j === 0 ? 'model' : j === 1 ? 'tree' : 'violet', width: 2.2, hover: false },
          holes.length ? { type: 'points', x: holes.map((p) => p[0]), y: holes.map((p) => p[1]), color: j === 0 ? 'model' : j === 1 ? 'tree' : 'violet', r: 4.5, hollow: true } : null,
          C.jumps.length ? { type: 'vband', x0: C.jumps[0] - 0.02, x1: C.jumps[0] + 0.02, color: 'critical', opacity: 0.12 } : null,
          C.jumps.length > 1 ? { type: 'vband', x0: C.jumps[1] - 0.02, x1: C.jumps[1] + 0.02, color: 'critical', opacity: 0.12 } : null,
        ], { y: [lo - pad, hi + pad] });
      });
      verdict.replaceChildren(H('span', { style: 'margin-right:8px;color:var(--ink-2)' }, 'Класс гладкости:'), badge(C.cls, C.kind));
      note.innerHTML = C.note;
    }
    w.pythonAction(() => {
      const C = SMOOTH[s.c];
      return 'import numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(-2.5, 2.5, 1001)\nf = lambda x: ' + C.py[0] + '\nd1 = lambda x: ' + C.py[1] + '\nd2 = lambda x: ' + C.py[2] + '\nfig, axes = plt.subplots(3, 1, figsize=(7, 7), sharex=True)\nfor ax, g, name in zip(axes, [f, d1, d2], ["f", "f\'", "f\'\'"]):\n    ax.plot(x, g(x), ".", ms=1.5)\n    ax.set_ylabel(name)\nplt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * 15. Субградиент: опорные прямые в изломе
   * ============================================================================== */
  const FLATS = [2, 4, 3, 7, 9, 11];
  const SUBG = {
    abs: { label: '|x|', f: Math.abs, dom: [-2, 2], x0: 0, xr: [-1.8, 1.8], kinks: [0], py: 'np.abs(x)' },
    mae: { label: 'MAE шести квартир L(c) = среднее |y − c|', f: (c) => U.mean(FLATS.map((y) => Math.abs(y - c))), dom: [0, 13], x0: 4, xr: [1, 12], kinks: [2, 3, 4, 7, 9, 11], py: 'np.mean(np.abs(np.array([2, 4, 3, 7, 9, 11]) - x))' },
    hinge: { label: 'hinge max(0, 1 − x)', f: (x) => Math.max(0, 1 - x), dom: [-1, 3], x0: 1, xr: [-0.8, 2.8], kinks: [1], py: 'np.maximum(0, 1 - x)' },
  };
  GBC.widget('subgradient', (el) => {
    const s = { c: 'abs', x0: 0, g: 0.5 };
    const w = ui.shell(el, { title: 'Субградиент: опорные прямые в изломе', sub: 'Через точку графика проводим прямую с наклоном g. Если она нигде не поднимается выше графика выпуклой функции, g — субградиент (subgradient). В гладкой точке такой наклон один — производная; в изломе их целый отрезок [f′₋, f′₊].' });
    ui.select(w.controls, { label: 'Функция', value: s.c, options: Object.entries(SUBG).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.c = v;
      const E = SUBG[v];
      xSl.input.min = E.xr[0];
      xSl.input.max = E.xr[1];
      s.x0 = E.x0;
      xSl.set(s.x0);
      draw();
    } });
    const xSl = ui.slider(w.controls, { label: 'Точка x₀', min: -1.8, max: 1.8, step: 0.05, value: s.x0, onInput: (v) => {
      const E = SUBG[s.c];
      const k = E.kinks.find((q) => Math.abs(q - v) < 0.08);
      s.x0 = k !== undefined ? k : v;
      draw();
    } });
    ui.slider(w.controls, { label: 'Наклон прямой g', min: -1.5, max: 1.5, step: 0.01, value: s.g, onInput: (v) => ((s.g = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const verdict = H('div', { style: 'margin:6px 0' });
    w.main.appendChild(verdict);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'l', label: 'f′₋(x₀)' }, { key: 'r', label: 'f′₊(x₀)' }, { key: 'set', label: 'субдифференциал ∂f(x₀)' }, { key: 'min', label: '0 ∈ ∂f?' }]);
    function draw() {
      const E = SUBG[s.c];
      const x0 = s.x0;
      const f0 = E.f(x0);
      const h = 1e-7;
      const dl = Math.round(((f0 - E.f(x0 - h)) / h) * 1e4) / 1e4;
      const dr = Math.round(((E.f(x0 + h) - f0) / h) * 1e4) / 1e4;
      const xs = U.linspace(E.dom[0], E.dom[1], 801).concat(E.kinks).sort((a, b) => a - b);
      const ok = xs.every((x) => f0 + s.g * (x - x0) <= E.f(x) + 1e-9);
      const lx = [E.dom[0], E.dom[1]];
      const fan = [];
      if (dr - dl > 1e-6) for (const t of U.linspace(0, 1, 7)) fan.push(dl + t * (dr - dl));
      plot.render([
        ...fan.map((g) => ({ type: 'line', x: lx, y: lx.map((x) => f0 + g * (x - x0)), color: 'good', width: 1, opacity: 0.35, hover: false })),
        { type: 'line', x: xs, y: xs.map(E.f), color: 'model', width: 2.4, label: 'f(x)', hover: false },
        { type: 'line', x: lx, y: lx.map((x) => f0 + s.g * (x - x0)), color: ok ? 'good' : 'critical', width: 2.2, label: 'прямая с наклоном g', hover: false },
        { type: 'points', x: [x0], y: [f0], color: 'tree', r: 6 },
      ], { x: E.dom, y: yRange(E.f, U.linspace(E.dom[0], E.dom[1], 100), 0.25) });
      st.set('l', U.fmt(dl, 4));
      st.set('r', U.fmt(dr, 4));
      st.set('set', Math.abs(dr - dl) < 1e-6 ? '{' + U.fmt(dl, 4) + '}' : '[' + U.fmt(dl, 4) + '; ' + U.fmt(dr, 4) + ']');
      const zero = dl <= 1e-9 && dr >= -1e-9;
      st.set('min', zero ? 'да — минимум' : 'нет');
      verdict.replaceChildren(ok ? badge('g = ' + U.fmt(s.g, 2) + ' — субградиент: прямая всюду под графиком', 'good') : badge('g = ' + U.fmt(s.g, 2) + ' — не субградиент: прямая пересекает график', 'bad'));
      let msg = Math.abs(dr - dl) < 1e-6 ? 'В гладкой точке подходит единственный наклон — производная ' + U.fmt(dl, 4) + '. Любой другой g пересечёт график.' : 'В изломе подходит целый веер наклонов от ' + U.fmt(dl, 4) + ' до ' + U.fmt(dr, 4) + ' (зелёные линии).';
      if (zero) msg += ' <b>Ноль входит в ∂f(x₀)</b> — горизонтальная прямая тоже опорная, значит, x₀ — точка минимума. Это аналог условия f′ = 0 для функций с изломами.';
      if (s.c === 'mae') msg += ' Для MAE наклоны считаются по числу квартир ниже и выше c: ровно на точке данных счёт «неопределённый», отсюда отрезок. Ноль в ∂L при всех c из [4, 7] — это медианы.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const E = SUBG[s.c];
      return 'import numpy as np\n\nf = np.vectorize(lambda x: ' + E.py + ')\nx0, g = ' + U.pyNum(s.x0) + ', ' + U.pyNum(s.g) + '\nh = 1e-7\nleft = (f(x0) - f(x0 - h)) / h\nright = (f(x0 + h) - f(x0)) / h\nprint(f"∂f(x0) = [{left:.4f}; {right:.4f}]")\nx = np.linspace(' + E.dom[0] + ', ' + E.dom[1] + ', 2001)\nprint("прямая с наклоном g — опорная:", bool(np.all(f(x0) + g * (x - x0) <= f(x) + 1e-9)))\n';
    });
    draw();
  });

  GBC.lesson155 = { curve, denseNear, logspace, decadeTicks, powFmt, texInto, texEl, card, cardGrid, badge, rowTable, nd, py, sigma, STARS, roots, yRange, tanSeg, FN, fnOpts, pyHead, FLATS };
})();
