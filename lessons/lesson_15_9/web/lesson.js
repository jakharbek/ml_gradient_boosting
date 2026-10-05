/* Урок 15.9: интегралы. Часть 1 — накопление и площадь, свойства интеграла, основная теорема анализа.
 * Виджеты: бак с водой (интуиция), путь по спидометру, площади из геометрии, знак суммы Σ, суммы Римана,
 * предел сумм Римана вручную, нижние и верхние суммы, площадь со знаком, свойства интеграла, среднее значение,
 * функция накопления, «сжатие» полоски (доказательство основной теоремы), семейство первообразных F + C,
 * формула Ньютона — Лейбница.
 * Общие помощники (численные интегралы, erf/Φ, карточки, формулы) выставлены в GBC.lesson159 —
 * ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const R = String.raw;
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const f4 = (v) => U.fmt(v, 4);
  const f6 = (v) => U.fmt(v, 6);
  const py = (v) => U.pyNum(v);
  /** Цвета площади со знаком: «+» — синий, «−» — красный (расходящаяся шкала курса). */
  const C_POS = 'model';
  const C_NEG = 'pos';
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
    return [lo - pad * span, hi + pad * span];
  }

  /* ==============================================================================
   * Численные интегралы и специальные функции
   * ============================================================================== */
  /** Формула Симпсона (n делается чётным). Работает и при a > b (знак меняется сам). */
  function simpson(f, a, b, n = 600) {
    if (a === b) return 0;
    if (n % 2) n += 1;
    const h = (b - a) / n;
    let acc = f(a) + f(b);
    for (let i = 1; i < n; i++) acc += (i % 2 ? 4 : 2) * f(a + i * h);
    return (acc * h) / 3;
  }
  /** Сумма Римана: off = 0 (левые концы), 0.5 (середины), 1 (правые) или массив точек-«меток» в долях шага. */
  function rsum(f, a, b, n, off) {
    const h = (b - a) / n;
    let acc = 0;
    for (let i = 0; i < n; i++) acc += f(a + (i + (Array.isArray(off) ? off[i] : off)) * h);
    return acc * h;
  }
  function trap(f, a, b, n) {
    const h = (b - a) / n;
    let acc = (f(a) + f(b)) / 2;
    for (let i = 1; i < n; i++) acc += f(a + i * h);
    return acc * h;
  }
  /** Функция ошибок: ряд Тейлора при |x| < 3, цепная дробь для хвоста (точность ~1e−14). */
  function erf(x) {
    const ax = Math.abs(x);
    if (ax < 3) {
      let term = x;
      let acc = x;
      const x2 = x * x;
      for (let n = 1; n < 80; n++) {
        term *= -x2 / n;
        const add = term / (2 * n + 1);
        acc += add;
        if (Math.abs(add) < 1e-17 * Math.abs(acc)) break;
      }
      return (2 / Math.sqrt(Math.PI)) * acc;
    }
    let K = ax;
    for (let k = 60; k >= 1; k--) K = ax + k / 2 / K;
    const erfc = Math.exp(-ax * ax) / (Math.sqrt(Math.PI) * K);
    return Math.sign(x) * (1 - erfc);
  }
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  const pdf = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const sigma = (z) => U.sigmoid(z);

  /** Отсчёты графика; нечисловые значения — разрывы линии. */
  function curve(f, a, b, n = 400) {
    const x = U.linspace(a, b, n);
    return { x, y: x.map((t) => { const v = f(t); return Number.isFinite(v) ? v : NaN; }) };
  }
  /** Площадь со знаком между графиком и осью на [a, b]: синие (+) и красные (−) слои. */
  function signedArea(f, a, b, o = {}) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (hi - lo < 1e-12) return [];
    const xs = U.linspace(lo, hi, o.n || 300);
    const ys = xs.map(f);
    const z = xs.map(() => 0);
    return [
      { type: 'area', x: xs, y0: z, y1: ys.map((v) => Math.max(v, 0)), color: o.pos || C_POS, opacity: o.opacity ?? 0.3, label: o.labels ? o.labels[0] : undefined },
      { type: 'area', x: xs, y0: z, y1: ys.map((v) => Math.min(v, 0)), color: o.neg || C_NEG, opacity: o.opacity ?? 0.3, label: o.labels ? o.labels[1] : undefined },
    ];
  }
  /** Нули функции на сетке (смена знака + точные нули в узлах). */
  function rootsOf(f, a, b, n = 2000) {
    const out = [];
    let x0 = a;
    let y0 = f(a);
    if (y0 === 0) out.push(a);
    for (let i = 1; i <= n; i++) {
      const x1 = a + ((b - a) * i) / n;
      const y1 = f(x1);
      if (y1 === 0) out.push(x1);
      else if (y0 !== 0 && Number.isFinite(y0) && Number.isFinite(y1) && y0 * y1 < 0) {
        let l = x0;
        let r = x1;
        let fl = y0;
        for (let k = 0; k < 60; k++) {
          const m = (l + r) / 2;
          const fm = f(m);
          if (fm * fl <= 0) r = m;
          else (l = m), (fl = fm);
        }
        out.push((l + r) / 2);
      }
      x0 = x1;
      y0 = y1;
    }
    return out;
  }
  const snap = (v, step) => Math.round(v / step) * step;

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
  const cardGrid = (min = 200) => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(' + min + 'px,1fr));gap:10px;margin:4px 0 10px' });
  function badge(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;' + st }, text);
  }
  /** Таблица: columns — строки; rows — массивы строк. */
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  /** Список шагов решения: [[пояснение, TeX], …], показываются первые k. */
  function stepList(box, steps, k) {
    box.textContent = '';
    steps.slice(0, k).forEach(([c, t], j) => {
      const li = H('li', { style: 'opacity:' + (j === k - 1 ? 1 : 0.8) }, H('div', { style: 'font-size:.92rem;color:var(--ink-2)' }, c));
      if (t) li.appendChild(texEl(R`\displaystyle ` + t, false, 'padding:2px 0'));
      box.appendChild(li);
    });
  }
  const STARS = ['', '★', '★★', '★★★'];

  /* ==============================================================================
   * Скорость поездки из уроков 15.2 и 15.7 и путь — её первообразная
   * ============================================================================== */
  const vTrip = (t) => 6 * t - 0.6 * t * t;
  const sTrip = (t) => 3 * t * t - (t * t * t) / 5;

  /* ==============================================================================
   * Интуиция. Бак с водой: приток → объём
   * ============================================================================== */
  const TANK_T = [0, 2, 4, 6, 8, 10];
  const TANK_PRESETS = {
    mix: [3, 4, 1, -2, -1, 2],
    const: [2, 2, 2, 2, 2, 2],
    fill: [0, 1, 2, 3, 4, 5],
    drain: [0, -0.5, -1, -1.5, -1.5, -1],
  };
  GBC.widget('tank', (el) => {
    const s = { r: TANK_PRESETS.mix.slice(), V0: 10, k: 60 };
    const w = ui.shell(el, { title: 'Бак с водой: по скорости притока найти объём', sub: 'Сверху — скорость притока r(t) в литрах в минуту (минус — вода вытекает). Тяните точки графика. Снизу — сколько воды в баке. Нажмите ▶: объём меняется на площадь под графиком притока.', stack: true });
    ui.player(w.controls, { label: 'Время', min: 0, max: 100, value: s.k, fps: 12, format: (k) => 't = ' + U.fmt(k / 10, 1) + ' мин', onChange: (k) => ((s.k = k), draw()) });
    const preset = ui.segmented(w.controls, { label: 'Готовый режим притока', value: 'mix', options: [{ value: 'mix', label: 'смешанный' }, { value: 'const', label: 'постоянный' }, { value: 'fill', label: 'нарастает' }, { value: 'drain', label: 'слив' }], onChange: (v) => ((s.r = TANK_PRESETS[v].slice()), draw()) });
    ui.slider(w.controls, { label: 'Было в начале V₀', min: 0, max: 30, step: 1, value: s.V0, format: (v) => v + ' л', onInput: (v) => ((s.V0 = v), draw()) });
    const pr = new GBC.Plot(w.main, { height: 240, x: { label: 'время t, мин', domain: [0, 10] }, y: { label: 'приток r(t), л/мин', domain: [-5.5, 5.5] } });
    const row = H('div', { style: 'display:grid;grid-template-columns:110px minmax(0,1fr);gap:12px;align-items:center' });
    w.main.appendChild(row);
    const tank = S('svg', { viewBox: '0 0 110 230', width: '100%', style: 'max-width:110px;display:block' });
    const water = S('rect', { x: 17, y: 200, width: 76, height: 0, style: 'fill:var(--c-model);opacity:.35' });
    const surface = S('line', { x1: 17, x2: 93, y1: 200, y2: 200, style: 'stroke:var(--c-model);stroke-width:2.5' });
    const label = S('text', { x: 55, y: 222, 'text-anchor': 'middle', style: 'fill:var(--ink);font-size:14px;font-weight:650' });
    const marks = [0, 10, 20, 30, 40].map((v) => S('g', null,
      S('line', { x1: 93, x2: 99, y1: 200 - v * 4.5, y2: 200 - v * 4.5, style: 'stroke:var(--muted);stroke-width:1' }),
      S('text', { x: 101, y: 204 - v * 4.5, style: 'fill:var(--muted);font-size:9px' }, String(v))));
    tank.append(water, surface, S('path', { d: 'M15 18 V202 H95 V18', style: 'fill:none;stroke:var(--ink-2);stroke-width:3;stroke-linejoin:round' }), ...marks, label);
    row.appendChild(tank);
    const pvBox = H('div', { style: 'min-width:0' });
    row.appendChild(pvBox);
    const pv = new GBC.Plot(pvBox, { height: 230, x: { label: 'время t, мин', domain: [0, 10] }, y: { label: 'объём V(t), л' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'приток сейчас' }, { key: 'dv', label: 'ΔV = площадь под r' }, { key: 'v', label: 'в баке V(t)' }]);
    const rate = (t) => {
      const i = Math.min(4, Math.floor(t / 2));
      const u = (t - TANK_T[i]) / 2;
      return s.r[i] * (1 - u) + s.r[i + 1] * u;
    };
    /** Точный интеграл кусочно-линейной функции от 0 до t. */
    const accum = (t) => {
      let acc = 0;
      for (let i = 0; i < 5; i++) {
        const a = TANK_T[i];
        if (t <= a) break;
        const d = Math.min(t, TANK_T[i + 1]) - a;
        acc += s.r[i] * d + ((s.r[i + 1] - s.r[i]) / 4) * d * d;
      }
      return acc;
    };
    function draw() {
      const t = s.k / 10;
      const ts = U.linspace(0, 10, 201);
      pr.render([
        ...signedArea(rate, 0, t, { n: 200, opacity: 0.32, labels: ['вода прибывает', 'вода убывает'] }),
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: ts, y: ts.map(rate), color: 'tree', width: 2.4, hover: false },
        { type: 'vline', x: t, color: 'ink2', dash: '3 3', width: 1 },
        { type: 'points', x: TANK_T, y: s.r, color: 'tree', r: 7, draggable: true, onDrag: (i, nx, ny) => {
          s.r[i] = U.clamp(snap(ny, 0.25), -5, 5);
          preset.set(null);
          draw();
        } },
      ]);
      const Vs = ts.map((x) => s.V0 + accum(x));
      const V = s.V0 + accum(t);
      pv.render([
        { type: 'hline', y: s.V0, color: 'muted', dash: '4 4', width: 1.2, text: 'V₀ = ' + s.V0 + ' л' },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: ts, y: Vs, color: 'muted', width: 1.2, dash: '4 4', hover: false },
        { type: 'line', x: ts.filter((x) => x <= t + 1e-9), y: Vs.filter((_, j) => ts[j] <= t + 1e-9), color: 'model', width: 2.6, hover: false },
        { type: 'points', x: [t], y: [V], color: 'model', r: 6 },
      ], { y: yDom(Vs, 0.1, [0, s.V0 + 2]) });
      const lvl = U.clamp(V, 0, 40);
      water.setAttribute('y', 200 - lvl * 4.5);
      water.setAttribute('height', lvl * 4.5);
      surface.setAttribute('y1', 200 - lvl * 4.5);
      surface.setAttribute('y2', 200 - lvl * 4.5);
      label.textContent = U.fmt(V, 1) + ' л';
      const r = rate(t);
      st.set('r', U.fmtSigned(r, 2) + ' л/мин');
      st.set('dv', U.fmtSigned(accum(t), 2) + ' л');
      st.set('v', U.fmt(V, 2) + ' л');
      const mode = Math.abs(r) < 1e-9 ? 'Приток равен нулю — уровень на мгновение замер: на графике объёма здесь вершина, впадина или площадка.' : r > 0 ? 'Приток положительный — уровень растёт, и тем быстрее, чем выше график притока.' : 'Приток отрицательный — вода вытекает, уровень падает.';
      note.innerHTML = mode + ' За время от 0 до ' + U.fmt(t, 1) + ' мин объём изменился на <b>' + U.fmtSigned(accum(t), 2) + ' л</b> — это синяя площадь под графиком притока минус красная. ' + (V < 0 ? '<b>Объём ушёл в минус</b> — в реальном баке столько воды не было; увеличьте V₀.' : V > 40 ? 'Бак переполнен (вмещает 40 л).' : 'Объём = было + накоплено: V(t) = V₀ + ∫₀ᵗ r.');
    }
    w.pythonAction(() => 'import numpy as np\n\nt_nodes = np.array([' + TANK_T.join(', ') + '])\nr_nodes = np.array([' + s.r.map(py).join(', ') + '])          # приток, л/мин\nV0 = ' + s.V0 + '\nt = np.linspace(0, 10, 1001)\nr = np.interp(t, t_nodes, r_nodes)\n# накопленный объём: сумма площадей трапеций под графиком притока\nV = V0 + np.concatenate([[0], np.cumsum((r[1:] + r[:-1]) / 2 * np.diff(t))])\nfor tt in [2, 4, 6, 8, 10]:\n    print(f"t = {tt:2d} мин: V = {np.interp(tt, t, V):.3f} л")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 1. Путь по спидометру
   * ============================================================================== */
  const PROF = {
    trip: { label: 'поездка: v = 6t − 0.6t²', T: 10, v: vTrip, s: sTrip, vmax: 17, py: '6 * t - 0.6 * t**2' },
    const: { label: 'постоянная: 20 м/с', T: 5, v: () => 20, s: (t) => 20 * t, vmax: 25, py: '20 + 0 * t' },
    piece: { label: '3 с по 10 м/с, затем 20 м/с', T: 5, v: (t) => (t < 3 ? 10 : 20), s: (t) => (t < 3 ? 10 * t : 30 + 20 * (t - 3)), vmax: 25, py: 'np.where(t < 3, 10, 20)' },
    ramp: { label: 'равномерный разгон: v = 3t', T: 4, v: (t) => 3 * t, s: (t) => 1.5 * t * t, vmax: 14, py: '3 * t' },
    city: {
      label: 'разгон — ровно — торможение', T: 10, vmax: 13, py: 'np.interp(t, [0, 2, 8, 10], [0, 10, 10, 0])',
      v: (t) => (t < 2 ? 5 * t : t < 8 ? 10 : 10 - 5 * (t - 8)),
      s: (t) => (t < 2 ? 2.5 * t * t : t < 8 ? 10 + 10 * (t - 2) : 70 + 10 * (t - 8) - 2.5 * (t - 8) ** 2),
    },
  };
  GBC.widget('speed-to-distance', (el) => {
    const s = { p: 'trip', k: 60, n: 0 };
    const w = ui.shell(el, { title: 'Обратная задача: по спидометру найти путь', sub: 'Сверху — скорость v(t), снизу — пройденный путь. Путь к моменту t равен площади под графиком скорости от 0 до t. Включите «показания спидометра»: путь складывается из прямоугольников v·Δt.', stack: true });
    ui.select(w.controls, { label: 'Как ехала машина', value: s.p, options: Object.entries(PROF).map(([k, P]) => ({ value: k, label: P.label })), onChange: (v) => ((s.p = v), draw()) });
    ui.player(w.controls, { label: 'Момент времени', min: 0, max: 100, value: s.k, fps: 12, format: (k) => U.fmt(k, 0) + ' % поездки', onChange: (k) => ((s.k = k), draw()) });
    ui.segmented(w.controls, { label: 'Показания спидометра', value: 0, options: [{ value: 0, label: 'непрерывно' }, { value: 5, label: '5 раз' }, { value: 10, label: '10 раз' }, { value: 50, label: '50 раз' }], onChange: (v) => ((s.n = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'время t, с' }, y: { label: 'скорость v, м/с' } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'время t, с' }, y: { label: 'путь, м' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't', label: 'время' }, { key: 's', label: 'путь = площадь' }, { key: 'R', label: 'Σ v·Δt' }, { key: 'e', label: 'ошибка суммы' }]);
    function draw() {
      const P = PROF[s.p];
      const t = (P.T * s.k) / 100;
      const ts = U.linspace(0, P.T, 401);
      const done = ts.filter((x) => x <= t + 1e-9);
      const L1 = [];
      const L2 = [];
      let Rt = null;
      if (s.n) {
        const dt = P.T / s.n;
        const rects = [];
        const sx = [0];
        const sy = [0];
        let acc = 0;
        for (let i = 0; i < s.n; i++) {
          const x0 = i * dt;
          const vi = P.v(x0);
          rects.push({ type: 'rect', x0, x1: x0 + dt, y0: 0, y1: vi, fill: x0 < t ? 'model' : 'muted', stroke: 'model', opacity: x0 < t ? 0.3 : 0.08, width: s.n > 20 ? 0.5 : 1 });
          if (x0 < t) {
            const d = Math.min(dt, t - x0);
            acc += vi * d;
            sx.push(x0 + d);
            sy.push(acc);
          }
        }
        Rt = acc;
        L1.push(...rects);
        L2.push({ type: 'line', x: sx, y: sy, color: 'tree', width: 2.2, label: 'сумма прямоугольников', hover: false });
      } else {
        L1.push({ type: 'area', x: done, y0: done.map(() => 0), y1: done.map(P.v), color: 'model', opacity: 0.3, label: 'площадь = путь' });
      }
      p1.render([...L1, { type: 'line', x: ts, y: ts.map(P.v), color: 'tree', width: 2.4, label: 'v(t)', hover: false }, { type: 'vline', x: t, color: 'ink2', width: 1, dash: '3 3' }], { x: [0, P.T], y: [0, P.vmax] });
      const sEnd = P.s(P.T);
      p2.render([
        { type: 'line', x: ts, y: ts.map(P.s), color: 'muted', width: 1.2, dash: '4 4', hover: false },
        { type: 'line', x: done, y: done.map(P.s), color: 'model', width: 2.6, label: 'путь s(t) — точно', hover: false },
        ...L2,
        { type: 'points', x: [t], y: [P.s(t)], color: 'model', r: 6 },
      ], { x: [0, P.T], y: [0, sEnd * 1.08] });
      st.set('t', U.fmt(t, 2) + ' с');
      st.set('s', U.fmt(P.s(t), 3) + ' м');
      st.set('R', Rt === null ? '—' : U.fmt(Rt, 3) + ' м');
      st.set('e', Rt === null ? '—' : U.fmt(Rt - P.s(t), 3) + ' м');
      const shape = { const: 'прямоугольник 5 × 20 = 100 м', piece: 'два прямоугольника: 10 × 3 = 30 м и 20 × 2 = 40 м, всего 70 м', ramp: 'треугольник: ½ · 4 · 12 = 24 м', city: 'трапеция: (6 + 10)/2 · 10 = 80 м', trip: 'область под параболой; её площадь (100 м) найдём в шаге 13' }[s.p];
      note.innerHTML = 'Площадь под скоростью от 0 до ' + U.fmt(t, 2) + ' с = <b>' + U.fmt(P.s(t), 2) + ' м</b> — ровно столько проехала машина. За всю поездку под графиком — ' + shape + '. ' + (s.n ? 'Спидометр записан ' + s.n + ' раз: на каждом интервале Δt = ' + U.fmt(P.T / s.n, 3) + ' с считаем скорость постоянной (равной показанию в начале) и складываем прямоугольники v·Δt — оранжевая ломаная. Чем чаще записи, тем точнее сумма.' : 'Выберите «5 раз», «10 раз», «50 раз» — увидите, как площадь собирается из прямоугольников.');
    }
    w.pythonAction(() => {
      const P = PROF[s.p];
      return 'import numpy as np\n\nv = lambda t: ' + P.py + '      # скорость, м/с\nT = ' + P.T + '\nfor n in [5, 10, 50, 1000]:\n    dt = T / n\n    t = np.arange(n) * dt               # моменты показаний (начала интервалов)\n    print(f"n = {n:4d}: Σ v·Δt = {np.sum(v(t)) * dt:.4f} м")\nprint("точно:", ' + py(P.s(P.T)) + ', "м")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 2. Площади, которые даёт геометрия
   * ============================================================================== */
  const GEO = {
    c3: { label: 'f(x) = 3', f: () => 3, F: (x) => 3 * x, view: [-0.5, 4.5], y: [-0.4, 4], a: 0, b: 2, py: '3 + 0 * x' },
    x: { label: 'f(x) = x', f: (x) => x, F: (x) => (x * x) / 2, view: [-2.5, 4.5], y: [-2.7, 4.7], a: 0, b: 4, py: 'x' },
    aff: { label: 'f(x) = 2x + 1', f: (x) => 2 * x + 1, F: (x) => x * x + x, view: [-0.5, 4], y: [-0.5, 9.5], a: 1, b: 3, lim: [-0.5, 4], py: '2 * x + 1' },
    abs: { label: 'f(x) = |x|', f: Math.abs, F: (x) => (x * Math.abs(x)) / 2, view: [-2.5, 2.5], y: [-0.3, 2.7], a: -1, b: 2, py: 'np.abs(x)' },
    circ: { label: 'f(x) = √(4 − x²) — полукруг', f: (x) => Math.sqrt(Math.max(0, 4 - x * x)), F: (x) => (x * Math.sqrt(Math.max(0, 4 - x * x)) + 4 * Math.asin(U.clamp(x / 2, -1, 1))) / 2, view: [-2.4, 2.4], y: [-0.3, 2.4], a: -2, b: 2, lim: [-2, 2], py: 'np.sqrt(4 - x**2)', equal: true },
  };
  GBC.widget('geometry-area', (el) => {
    const s = { k: 'aff', a: 1, b: 3 };
    const w = ui.shell(el, { title: 'Площадь под графиком из школьной геометрии', sub: 'Для прямых и окружностей площадь под графиком — это прямоугольники, треугольники, трапеции и части круга. Тяните границы a и b (оранжевые линии): формула пересчитается.' });
    ui.select(w.controls, { label: 'Функция', value: s.k, options: Object.entries(GEO).map(([k, G]) => ({ value: k, label: G.label })), onChange: (v) => ((s.k = v), (s.a = GEO[v].a), (s.b = GEO[v].b), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const cF = card('Как сосчитать площадь');
    w.main.appendChild(cF.el);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ab', label: 'отрезок' }, { key: 'I', label: 'площадь со знаком' }]);
    function explain(G, lo, hi) {
      const f = G.f;
      const I = G.F(hi) - G.F(lo);
      const W = hi - lo;
      if (s.k === 'c3') return 'Прямоугольник: высота 3 × ширина ' + f2(W) + ' = <b>' + f3(I) + '</b>.';
      if (s.k === 'aff' || ((s.k === 'x' || s.k === 'abs') && (lo >= 0 || hi <= 0))) {
        const sign = hi <= 0 && s.k === 'x' ? ' Фигура под осью — площадь со знаком «−».' : '';
        if (Math.abs(f(lo)) < 1e-12 || Math.abs(f(hi)) < 1e-12) return 'Треугольник: ½ · основание ' + f2(W) + ' · высота ' + f2(Math.max(Math.abs(f(lo)), Math.abs(f(hi)))) + ' = <b>' + f3(Math.abs(I)) + '</b>.' + sign;
        return 'Трапеция: (f(a) + f(b))/2 · (b − a) = (' + f2(f(lo)) + ' + ' + f2(f(hi)) + ')/2 · ' + f2(W) + ' = <b>' + f3(I) + '</b>.' + sign;
      }
      if (s.k === 'x') return 'Два треугольника: под осью ½ · ' + f2(-lo) + '² = ' + f3(lo * lo / 2) + ' (со знаком «−»), над осью ½ · ' + f2(hi) + '² = ' + f3(hi * hi / 2) + '. Итого <b>' + f3(I) + '</b>.';
      if (s.k === 'abs') return 'Два треугольника над осью: ½ · ' + f2(-lo) + '² + ½ · ' + f2(hi) + '² = ' + f3(lo * lo / 2) + ' + ' + f3(hi * hi / 2) + ' = <b>' + f3(I) + '</b>.';
      if (Math.abs(lo + 2) < 1e-9 && Math.abs(hi - 2) < 1e-9) return 'Половина круга радиуса 2: πr²/2 = 2π = <b>' + f4(I) + '</b>.';
      if ((Math.abs(lo) < 1e-9 && Math.abs(hi - 2) < 1e-9) || (Math.abs(lo + 2) < 1e-9 && Math.abs(hi) < 1e-9)) return 'Четверть круга радиуса 2: πr²/4 = π = <b>' + f4(I) + '</b>.';
      return 'Кусок круга: сектор плюс треугольники. Формула площади от −2 до x — ½(x√(4 − x²) + 4·arcsin(x/2)) + π; разность при x = b и x = a даёт <b>' + f4(I) + '</b>. Без геометрии такой ответ не угадать — нужен общий метод.';
    }
    function draw() {
      const G = GEO[s.k];
      const lo = Math.min(s.a, s.b);
      const hi = Math.max(s.a, s.b);
      const c = curve(G.f, G.view[0], G.view[1], 500);
      const outline = [];
      if (s.k !== 'circ') {
        const xs = s.k === 'x' || s.k === 'abs' ? [lo, ...(lo < 0 && hi > 0 ? [0] : []), hi] : [lo, hi];
        outline.push({ type: 'segments', x1: xs, y1: xs.map(() => 0), x2: xs, y2: xs.map(G.f), color: 'model', width: 1.6, opacity: 0.9 });
      }
      const lim = G.lim || G.view;
      plot.opts.equal = !!G.equal;
      plot.render([
        ...signedArea(G.f, lo, hi, { n: 400 }),
        ...outline,
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: c.x, y: c.y, color: 'tree', width: 2.4, hover: false },
        { type: 'vline', x: s.a, color: 'tree', width: 1.6, draggable: true, text: 'a', onDrag: (x) => ((s.a = U.clamp(snap(x, 0.25), lim[0], lim[1])), draw()) },
        { type: 'vline', x: s.b, color: 'tree', width: 1.6, draggable: true, text: 'b', onDrag: (x) => ((s.b = U.clamp(snap(x, 0.25), lim[0], lim[1])), draw()) },
      ], { x: G.view, y: G.y });
      cF.body.innerHTML = explain(G, lo, hi);
      const I = G.F(hi) - G.F(lo);
      st.set('ab', '[' + f2(lo) + ', ' + f2(hi) + ']');
      st.set('I', f4(I));
      note.innerHTML = 'Геометрия выручает только для прямых и окружностей. Уже для параболы y = x² готовой формулы площади нет — её мы получим из прямоугольников (шаги 4–5), а потом общим способом (шаг 13).';
    }
    w.pythonAction(() => {
      const G = GEO[s.k];
      const lo = Math.min(s.a, s.b);
      const hi = Math.max(s.a, s.b);
      return 'import numpy as np\n\nf = lambda x: ' + G.py + '\na, b = ' + py(lo) + ', ' + py(hi) + '\nn = 100000\nh = (b - a) / n\nx = a + (np.arange(n) + 0.5) * h          # середины узких полосок\nprint("площадь ≈", np.sum(f(x)) * h)\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 3. Знак суммы Σ и полезные суммы
   * ============================================================================== */
  const SIG = {
    k: { label: 'Σ k = 1 + 2 + … + n', max: 12, sum: (n) => (n * (n + 1)) / 2, tex: R`\sum_{k=1}^{n} k = 1 + 2 + \dots + n = \frac{n(n+1)}{2}` },
    odd: { label: 'Σ (2k − 1) = 1 + 3 + 5 + …', max: 12, sum: (n) => n * n, tex: R`\sum_{k=1}^{n} (2k-1) = 1 + 3 + \dots + (2n-1) = n^2` },
    k2: { label: 'Σ k² = 1 + 4 + 9 + …', max: 30, sum: (n) => (n * (n + 1) * (2 * n + 1)) / 6, tex: R`\sum_{k=1}^{n} k^2 = \frac{n(n+1)(2n+1)}{6} \approx \frac{n^3}{3}`, area: (n) => (n ** 3) / 3, pw: 2 },
    k3: { label: 'Σ k³ = 1 + 8 + 27 + …', max: 30, sum: (n) => ((n * (n + 1)) / 2) ** 2, tex: R`\sum_{k=1}^{n} k^3 = \left(\frac{n(n+1)}{2}\right)^2 \approx \frac{n^4}{4}`, area: (n) => (n ** 4) / 4, pw: 3 },
  };
  GBC.widget('sigma-sums', (el) => {
    const s = { k: 'k', n: 5 };
    const w = ui.shell(el, { title: 'Знак суммы Σ: складываем по правилу', sub: 'Σ (сигма) — короткая запись длинной суммы: «сложить выражение для k = 1, 2, …, n». Картинки показывают, почему верны готовые формулы, а для k² и k³ — что сумма столбиков близка к площади под кривой.' });
    const player = ui.player(w.controls, { label: 'Сколько слагаемых n', min: 1, max: 12, value: s.n, fps: 2, format: (k) => 'n = ' + k, onChange: (k) => ((s.n = k), draw()) });
    ui.select(w.controls, { label: 'Сумма', value: s.k, options: Object.entries(SIG).map(([k, G]) => ({ value: k, label: G.label })), onChange: (v) => {
      s.k = v;
      player.setMax(SIG[v].max);
      draw();
    } });
    const fBox = H('div', { style: 'margin:2px 0 6px' });
    w.main.appendChild(fBox);
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'k' }, y: { label: '' }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'сумма по слагаемым' }, { key: 's', label: 'по формуле' }, { key: 'r', label: 'сумма / площадь' }]);
    function draw() {
      const G = SIG[s.k];
      const n = Math.min(s.n, G.max);
      texInto(fBox, G.tex, true);
      const L = [];
      const terms = U.range(n, 1).map((k) => (s.k === 'k' ? k : s.k === 'odd' ? 2 * k - 1 : k ** G.pw));
      if (s.k === 'k') {
        plot.opts.equal = true;
        for (let k = 1; k <= n; k++) {
          for (let j = 0; j < k; j++) L.push({ type: 'rect', x0: k - 1, x1: k, y0: j, y1: j + 1, fill: 'model', stroke: 'surface', opacity: 0.55, width: 1.5 });
          for (let j = k; j < n + 1; j++) L.push({ type: 'rect', x0: k - 1, x1: k, y0: j, y1: j + 1, fill: 'tree', stroke: 'surface', opacity: 0.45, width: 1.5 });
        }
        plot.opts.x.ticks = U.range(n + 1);
        plot.render(L, { x: [0, n], y: [0, n + 1] });
      } else if (s.k === 'odd') {
        plot.opts.equal = true;
        for (let i = 1; i <= n; i++) {
          for (let j = 1; j <= n; j++) {
            const g = Math.max(i, j);
            L.push({ type: 'rect', x0: i - 1, x1: i, y0: j - 1, y1: j, fill: g % 2 ? 'model' : 'aqua', stroke: 'surface', opacity: 0.55, width: 1.5 });
          }
        }
        plot.opts.x.ticks = U.range(n + 1);
        plot.render(L, { x: [0, n], y: [0, n] });
      } else {
        plot.opts.equal = false;
        plot.opts.x.ticks = undefined;
        for (let k = 1; k <= n; k++) L.push({ type: 'rect', x0: k - 1, x1: k, y0: 0, y1: k ** G.pw, fill: 'model', stroke: 'model', opacity: 0.3, width: n > 20 ? 0.5 : 1 });
        const c = curve((x) => x ** G.pw, 0, n, 200);
        L.push({ type: 'line', x: c.x, y: c.y, color: 'tree', width: 2.4, label: s.k === 'k2' ? 'кривая x²' : 'кривая x³', hover: false });
        plot.render(L, { x: [0, n], y: [0, n ** G.pw * 1.05] });
      }
      const sum = U.sum(terms);
      st.set('w', terms.length <= 6 ? terms.join(' + ') + ' = ' + sum : terms.slice(0, 3).join(' + ') + ' + … + ' + terms[terms.length - 1] + ' = ' + sum);
      st.set('s', String(G.sum(n)));
      st.set('r', G.area ? f4(sum / G.area(n)) : '—');
      const msg = {
        k: () => 'Синие ступеньки — 1 + 2 + … + ' + n + '. Такая же лесенка, перевёрнутая (оранжевая), дополняет её до прямоугольника ' + n + ' × ' + (n + 1) + '. Значит, сумма — половина прямоугольника: ' + n + '·' + (n + 1) + '/2 = <b>' + sum + '</b>. Так, по легенде, юный Гаусс сложил числа от 1 до 100 за минуту: 5050.',
        odd: () => 'Каждое следующее нечётное число — «уголок», который достраивает квадрат на единицу шире: 1, 1 + 3 = 4, 4 + 5 = 9, … Сумма первых ' + n + ' нечётных чисел — квадрат ' + n + '² = <b>' + sum + '</b>.',
        k2: () => 'Столбики k² стоят на отрезках [k − 1, k] — это сумма прямоугольников под кривой x² (правые концы). Их сумма ' + sum + ' лишь чуть больше площади под кривой n³/3 = ' + f2(G.area(n)) + '; отношение ' + f4(sum / G.area(n)) + ' → 1. Отсюда Σk²/n³ → 1/3 — ключ к площади под параболой (шаг 5).',
        k3: () => 'Сумма кубов ' + sum + ' — квадрат суммы 1 + … + ' + n + ' = ' + (n * (n + 1)) / 2 + '. Она близка к площади n⁴/4 = ' + f2(G.area(n)) + ' под кривой x³: отношение ' + f4(sum / G.area(n)) + ' → 1.',
      }[s.k]();
      note.innerHTML = msg;
    }
    w.pythonAction(() => 'import numpy as np\n\nfor n in [5, 10, 100, 1000]:\n    k = np.arange(1, n + 1)\n    print(f"n = {n:4d}: Σk = {k.sum():>9} (формула {n * (n + 1) // 2}),  Σk² = {(k**2).sum():>12} (формула {n * (n + 1) * (2 * n + 1) // 6}),  Σk²/n³ = {(k**2).sum() / n**3:.6f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 4. Суммы Римана
   * ============================================================================== */
  const RF = {
    sq: { label: 'x² на [0, 2]', f: (x) => x * x, a: 0, b: 2, exact: 8 / 3, py: 'x**2' },
    sin: { label: 'sin x на [0, π]', f: Math.sin, a: 0, b: Math.PI, exact: 2, py: 'np.sin(x)' },
    exp: { label: 'eˣ на [0, 1]', f: Math.exp, a: 0, b: 1, exact: Math.E - 1, py: 'np.exp(x)' },
    inv: { label: '1/x на [1, 2]', f: (x) => 1 / x, a: 1, b: 2, exact: Math.LN2, py: '1 / x' },
    sqrt: { label: '√x на [0, 1]', f: Math.sqrt, a: 0, b: 1, exact: 2 / 3, py: 'np.sqrt(x)' },
    v: { label: 'скорость v(t) на [0, 10]', f: vTrip, a: 0, b: 10, exact: 100, py: '6 * x - 0.6 * x**2' },
    wave: { label: '1 + sin 3x на [0, 3]', f: (x) => 1 + Math.sin(3 * x), a: 0, b: 3, exact: 3 + (1 - Math.cos(9)) / 3, py: '1 + np.sin(3 * x)' },
  };
  const NS = [1, 2, 3, 4, 6, 8, 12, 16, 25, 40, 64, 100];
  /** Случайные метки в долях шага (воспроизводимо: свой генератор на каждое n). */
  const tags = (n, seed) => {
    const rng = new GBC.RNG(seed * 1000 + n);
    return U.range(n).map(() => rng.random());
  };
  GBC.widget('riemann', (el) => {
    const s = { fn: 'sq', k: 3, rule: 'left', seed: 1 };
    const w = ui.shell(el, { title: 'Суммы Римана: площадь из прямоугольников', sub: 'Делим отрезок на n частей и ставим на каждую прямоугольник. Высота — значение функции в выбранной точке части («метке»): слева, в середине, справа или в случайном месте. Нажмите ▶: n растёт, сумма подходит к точной площади.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(RF).map(([k, f]) => ({ value: k, label: f.label })), onChange: (x) => ((s.fn = x), draw()) });
    ui.segmented(w.controls, { label: 'Метка — где берём высоту', value: s.rule, options: [{ value: 'left', label: 'слева' }, { value: 'mid', label: 'середина' }, { value: 'right', label: 'справа' }, { value: 'rand', label: 'случайно' }], onChange: (x) => ((s.rule = x), draw()) });
    ui.player(w.controls, { label: 'Число частей n', min: 0, max: NS.length - 1, value: s.k, fps: 1.5, format: (k) => 'n = ' + NS[k], onChange: (k) => ((s.k = k), draw()) });
    ui.button(w.controls, { label: 'Новые случайные метки', kind: 'ghost', small: true, onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'n и ширина h' }, { key: 'S', label: 'сумма прямоугольников' }, { key: 'I', label: 'точная площадь' }, { key: 'e', label: 'ошибка' }]);
    const offOf = (rule, n) => (rule === 'left' ? 0 : rule === 'mid' ? 0.5 : rule === 'right' ? 1 : tags(n, s.seed));
    function draw() {
      const F = RF[s.fn];
      const n = NS[s.k];
      const h = (F.b - F.a) / n;
      const off = offOf(s.rule, n);
      const px = U.range(n).map((i) => F.a + (i + (Array.isArray(off) ? off[i] : off)) * h);
      const rects = U.range(n).map((i) => {
        const x0 = F.a + i * h;
        return { type: 'rect', x0, x1: x0 + h, y0: 0, y1: F.f(px[i]), fill: 'model', stroke: 'model', opacity: 0.28, width: n > 40 ? 0.4 : 1 };
      });
      const c = curve(F.f, F.a, F.b, 400);
      plot.render([...rects, { type: 'line', x: c.x, y: c.y, color: 'tree', width: 2.4, hover: false }, { type: 'hline', y: 0, color: 'axis' }, n <= 40 ? { type: 'points', x: px, y: px.map(F.f), color: 'model', r: n > 16 ? 3 : 4.5 } : { type: 'points', x: [], y: [] }]);
      const Sn = rsum(F.f, F.a, F.b, n, off);
      st.set('n', n + ', h = ' + f4(h));
      st.set('S', f6(Sn));
      st.set('I', f6(F.exact));
      st.set('e', U.fmt(Sn - F.exact, 3));
      rowTable(tableBox, ['n', 'слева', 'середина', 'справа', 'случайно'], [4, 10, 100, 1000].map((m) => [String(m), U.fmt(rsum(F.f, F.a, F.b, m, 0), 5), U.fmt(rsum(F.f, F.a, F.b, m, 0.5), 6), U.fmt(rsum(F.f, F.a, F.b, m, 1), 5), U.fmt(rsum(F.f, F.a, F.b, m, tags(m, s.seed)), 5)]));
      const mono = s.fn === 'sq' || s.fn === 'exp' || s.fn === 'sqrt' ? 'Функция возрастает, поэтому левые прямоугольники всегда ниже кривой (недобор), правые — выше (перебор), а точная площадь зажата между ними. ' : s.fn === 'inv' ? 'Функция убывает: теперь левые суммы — перебор, правые — недобор. ' : '';
      note.innerHTML = mono + 'С ростом n все суммы — с любыми метками, даже случайными, — подходят к одному числу ' + f4(F.exact) + '. Этот предел и называется <b>определённым интегралом</b>. Середина обычно точнее краёв: ошибки слева и справа от метки частично гасят друг друга.';
    }
    w.pythonAction(() => {
      const F = RF[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + F.py + '\na, b = ' + py(F.a) + ', ' + py(F.b) + '\nrng = np.random.default_rng(0)\nfor n in [4, 10, 100, 1000]:\n    h = (b - a) / n\n    x = a + np.arange(n) * h           # левые концы частей\n    print(f"n = {n:4d}: слева {np.sum(f(x)) * h:.6f}, середина {np.sum(f(x + h / 2)) * h:.6f}, "\n          f"справа {np.sum(f(x + h)) * h:.6f}, случайно {np.sum(f(x + rng.random(n) * h)) * h:.6f}")\nprint("точно:", ' + py(F.exact) + ')\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 5. Предел сумм Римана вручную
   * ============================================================================== */
  const RL = {
    c: {
      label: 'f(x) = 2', f: () => 2, Sn: (b) => 2 * b, I: (b) => 2 * b, Itex: '2b', py: '2 + 0 * x',
      steps: [['Ширина части h = b/n, правые концы xₖ = kb/n', R`h=\frac bn,\quad x_k=\frac{kb}{n}`], ['Все прямоугольники одной высоты 2', R`S_n=\sum_{k=1}^{n}2\cdot\frac bn=n\cdot\frac{2b}{n}=2b`], ['Сумма не зависит от n — предел тот же', R`\int_0^b 2\,dx = 2b`]],
    },
    x: {
      label: 'f(x) = x', f: (x) => x, Sn: (b, n) => ((b * b) / 2) * (1 + 1 / n), I: (b) => (b * b) / 2, Itex: R`\frac{b^2}{2}`, py: 'x',
      steps: [['Ширина h = b/n, правые концы xₖ = kb/n', R`S_n=\sum_{k=1}^{n}\frac{kb}{n}\cdot\frac bn=\frac{b^2}{n^2}\sum_{k=1}^{n}k`], ['Формула суммы из шага 3', R`\sum_{k=1}^{n}k=\frac{n(n+1)}{2}`], ['Подставляем и упрощаем', R`S_n=\frac{b^2}{n^2}\cdot\frac{n(n+1)}{2}=\frac{b^2}{2}\left(1+\frac1n\right)`], ['1/n → 0', R`\int_0^b x\,dx=\lim_{n\to\infty}S_n=\frac{b^2}{2}`]],
    },
    x2: {
      label: 'f(x) = x²', f: (x) => x * x, Sn: (b, n) => ((b ** 3) / 3) * (1 + 1 / n) * (1 + 1 / (2 * n)), I: (b) => (b ** 3) / 3, Itex: R`\frac{b^3}{3}`, py: 'x**2',
      steps: [['Высота k-го прямоугольника (kb/n)², ширина b/n', R`S_n=\sum_{k=1}^{n}\left(\frac{kb}{n}\right)^2\frac bn=\frac{b^3}{n^3}\sum_{k=1}^{n}k^2`], ['Формула суммы квадратов', R`\sum_{k=1}^{n}k^2=\frac{n(n+1)(2n+1)}{6}`], ['Подставляем и делим каждую скобку на n', R`S_n=\frac{b^3}{6}\cdot\frac{n+1}{n}\cdot\frac{2n+1}{n}=\frac{b^3}{3}\left(1+\frac1n\right)\left(1+\frac1{2n}\right)`], ['Скобки → 1', R`\int_0^b x^2\,dx=\frac{b^3}{3}`]],
    },
    x3: {
      label: 'f(x) = x³', f: (x) => x ** 3, Sn: (b, n) => ((b ** 4) / 4) * (1 + 1 / n) ** 2, I: (b) => (b ** 4) / 4, Itex: R`\frac{b^4}{4}`, py: 'x**3',
      steps: [['Высоты (kb/n)³, ширина b/n', R`S_n=\frac{b^4}{n^4}\sum_{k=1}^{n}k^3`], ['Сумма кубов — квадрат суммы', R`\sum_{k=1}^{n}k^3=\left(\frac{n(n+1)}{2}\right)^2`], ['Подставляем', R`S_n=\frac{b^4}{4}\left(1+\frac1n\right)^2`], ['Предел и закономерность', R`\int_0^b x^3\,dx=\frac{b^4}{4};\qquad \int_0^b x^p\,dx=\frac{b^{p+1}}{p+1}\ \ (?)`]],
    },
  };
  const NL = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];
  GBC.widget('riemann-limit', (el) => {
    const s = { fn: 'x2', b: 2, k: 4, step: 4 };
    const w = ui.shell(el, { title: 'Предел сумм Римана — вручную', sub: 'Для степеней x сумму прямоугольников можно записать формулой от n — благодаря суммам из шага 3. Потом n → ∞, и остаётся точная площадь. Сверху — вывод по шагам, ниже — прямоугольники и то, как сумма подходит к пределу.', stack: true });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(RL).map(([k, G]) => ({ value: k, label: G.label })), onChange: (v) => {
      s.fn = v;
      stepPlayer.setMax(RL[v].steps.length);
      stepPlayer.set(RL[v].steps.length);
      s.step = RL[v].steps.length;
      draw();
    } });
    ui.slider(w.controls, { label: 'Правый конец b', min: 0.5, max: 3, step: 0.5, value: s.b, onInput: (v) => ((s.b = v), draw()) });
    ui.player(w.controls, { label: 'Число частей n', min: 0, max: NL.length - 1, value: s.k, fps: 1.5, format: (k) => 'n = ' + NL[k], onChange: (k) => ((s.k = k), draw()) });
    const stepPlayer = ui.player(w.controls, { label: 'Шаг вывода', min: 0, max: RL.x2.steps.length, value: s.step, fps: 0.8, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.step = k), draw()) });
    const cS = card('Вывод формулы');
    w.main.appendChild(cS.el);
    const list = H('ol', { style: 'margin:4px 0 0;padding-left:1.4em;display:grid;gap:6px' });
    cS.body.appendChild(list);
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'n (лог. шкала)', type: 'log', domain: [0.8, 1300], ticks: [1, 10, 100, 1000] }, y: { label: 'сумма Sₙ' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const G = RL[s.fn];
      const b = s.b;
      const n = NL[s.k];
      stepList(list, G.steps, s.step);
      const h = b / n;
      const rects = n <= 200 ? U.range(n).map((i) => ({ type: 'rect', x0: i * h, x1: (i + 1) * h, y0: 0, y1: G.f((i + 1) * h), fill: 'model', stroke: 'model', opacity: 0.28, width: n > 40 ? 0.3 : 1 })) : [];
      const c = curve(G.f, 0, b, 200);
      p1.render([...rects, { type: 'line', x: c.x, y: c.y, color: 'tree', width: 2.4, hover: false }], { x: [0, b], y: [0, Math.max(2, G.f(b)) * 1.08] });
      const I = G.I(b);
      const Ss = NL.map((m) => G.Sn(b, m));
      p2.render([
        { type: 'hline', y: I, color: 'tree', dash: '6 4', width: 1.6, text: 'предел ' + f4(I) },
        { type: 'line', x: NL, y: Ss, color: 'model', width: 1.6, hover: false },
        { type: 'points', x: NL, y: Ss, color: 'model', r: 4, tooltip: (i) => [['n', String(NL[i])], ['Sₙ', f6(Ss[i])]] },
        { type: 'points', x: [n], y: [G.Sn(b, n)], color: 'tree', r: 7 },
      ], { y: yDom(Ss, 0.1, [I]) });
      rowTable(tbl, ['n', 'сумма прямоугольников', 'по формуле', 'ошибка', 'ошибка × n'], [1, 10, 100, 1000].map((m) => {
        const direct = rsum(G.f, 0, b, m, 1);
        const e = G.Sn(b, m) - I;
        return [String(m), f6(direct), f6(G.Sn(b, m)), U.fmt(e, 4), U.fmt(e * m, 4)];
      }), (i) => [1, 10, 100, 1000][i] === n);
      note.innerHTML = 'При n = ' + n + ': Sₙ = ' + f6(G.Sn(b, n)) + ', предел ' + f4(I) + '. ' + (s.fn === 'c' ? 'Для константы все суммы равны площади прямоугольника.' : 'Ошибка × n почти постоянна — значит, ошибка правых сумм убывает как 1/n: в 10 раз больше частей — в 10 раз точнее. Итог: ∫₀ᵇ ' + G.label.slice(7) + ' dx = ' + (s.fn === 'x' ? 'b²/2' : s.fn === 'x2' ? 'b³/3' : 'b⁴/4') + '. Видна закономерность: показатель растёт на 1 и уходит в знаменатель. Почему — объяснит основная теорема (шаг 11).');
    }
    w.pythonAction(() => {
      const G = RL[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + G.py + '\nb = ' + py(s.b) + '\nfor n in [1, 10, 100, 1000, 10000]:\n    k = np.arange(1, n + 1)\n    S = np.sum(f(k * b / n)) * b / n      # правые концы\n    print(f"n = {n:5d}: S_n = {S:.8f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 6. Нижние и верхние суммы: что значит «интегрируема»
   * ============================================================================== */
  const DB = {
    sq: { label: 'x² на [0, 2]', f: (x) => x * x, a: 0, b: 2, I: 8 / 3, y: [0, 4.3] },
    sin: { label: 'sin x на [0, π] — не монотонна', f: Math.sin, a: 0, b: Math.PI, I: 2, y: [0, 1.15] },
    step: { label: 'ступенька: 1, затем 2.5 — со скачком', f: (x) => (x < 1.5 ? 1 : 2.5), a: 0, b: 3, I: 5.25, y: [0, 2.8], jump: 1.5 },
    wig: { label: 'x + 0.6·sin 5x на [0, 3]', f: (x) => x + 0.6 * Math.sin(5 * x), a: 0, b: 3, I: 4.5 + (0.6 * (1 - Math.cos(15))) / 5, y: [0, 3.8] },
    rsq: { label: '1/√x на (0, 1] — неограниченная', f: (x) => (x > 0 ? 1 / Math.sqrt(x) : Infinity), a: 0, b: 1, I: 2, y: [0, 6], unbounded: true },
  };
  const DN = [1, 2, 4, 8, 16, 32, 64, 128];
  /** Нижняя и верхняя грани на отрезке (по сетке; концы включены). */
  function infSup(f, x0, x1, m = 48) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = 0; j <= m; j++) {
      const v = f(x0 + ((x1 - x0) * j) / m);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return [lo, hi];
  }
  function darbouxSums(D, n) {
    const h = (D.b - D.a) / n;
    let L = 0;
    let Uu = 0;
    const cells = [];
    for (let i = 0; i < n; i++) {
      const x0 = D.a + i * h;
      const [lo, hi] = infSup(D.f, x0, x0 + h);
      cells.push([x0, x0 + h, lo, hi]);
      L += lo * h;
      Uu += hi * h;
    }
    return { L, U: Uu, cells };
  }
  GBC.widget('darboux', (el) => {
    const s = { fn: 'sq', k: 2 };
    const w = ui.shell(el, { title: 'Нижние и верхние суммы: зажимаем площадь', sub: 'На каждой части берём самое низкое значение функции (нижняя сумма — синие прямоугольники) и самое высокое (верхняя — оранжевые контуры). Площадь зажата между ними. Если зазор U − L стремится к нулю, функция интегрируема.', stack: true });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(DB).map(([k, D]) => ({ value: k, label: D.label })), onChange: (v) => ((s.fn = v), draw()) });
    ui.player(w.controls, { label: 'Число частей n', min: 0, max: DN.length - 1, value: s.k, fps: 1.2, format: (k) => 'n = ' + DN[k], onChange: (k) => ((s.k = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 270, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'n (лог. шкала)', type: 'log', domain: [0.8, 160], ticks: [1, 2, 4, 8, 16, 32, 64, 128] }, y: { label: 'нижняя и верхняя суммы' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'нижняя сумма L' }, { key: 'U', label: 'верхняя сумма U' }, { key: 'g', label: 'зазор U − L' }, { key: 'I', label: 'интеграл' }]);
    function draw() {
      const D = DB[s.fn];
      const n = DN[s.k];
      const { L, U: Up, cells } = darbouxSums(D, n);
      const top = D.y[1];
      const layers = [];
      for (const [x0, x1, lo, hi] of cells) {
        layers.push({ type: 'rect', x0, x1, y0: 0, y1: lo, fill: 'model', stroke: 'model', opacity: 0.35, width: n > 32 ? 0.3 : 1 });
        layers.push({ type: 'rect', x0, x1, y0: lo, y1: Math.min(hi, top), fill: 'tree', stroke: 'tree', opacity: 0.12, width: n > 32 ? 0.4 : 1.2 });
      }
      const c = curve(D.f, D.a + (D.unbounded ? 1e-3 : 0), D.b, 600);
      if (D.jump) {
        const j = c.x.findIndex((x) => x >= D.jump);
        c.x.splice(j, 0, D.jump);
        c.y.splice(j, 0, NaN);
      }
      layers.push({ type: 'line', x: c.x, y: c.y.map((v) => Math.min(v, top * 1.2)), color: 'ink', width: 2.2, hover: false });
      if (D.unbounded) layers.push({ type: 'text', x: cells[0][0] + (cells[0][1] - cells[0][0]) / 2, y: top * 0.93, text: '∞', anchor: 'middle', bold: true });
      p1.render(layers, { x: [D.a, D.b], y: D.y });
      const Ls = DN.map((m) => darbouxSums(D, m).L);
      const Us = DN.map((m) => darbouxSums(D, m).U);
      const fin = Us.filter(Number.isFinite);
      p2.render([
        { type: 'hline', y: D.I, color: 'ink2', dash: '6 4', width: 1.4, text: (D.unbounded ? 'несобственный интеграл ' : 'интеграл ') + f3(D.I) },
        { type: 'line', x: DN, y: Ls, color: 'model', width: 2, label: 'нижняя L', hover: false },
        { type: 'points', x: DN, y: Ls, color: 'model', r: 4 },
        { type: 'line', x: DN, y: Us.map((v) => (Number.isFinite(v) ? v : NaN)), color: 'tree', width: 2, label: 'верхняя U', hover: false },
        { type: 'points', x: DN.filter((_, i) => Number.isFinite(Us[i])), y: fin, color: 'tree', r: 4 },
        { type: 'vline', x: n, color: 'ink2', dash: '3 3', width: 1 },
      ], { y: yDom(Ls.concat(fin), 0.1, [D.I]) });
      st.set('L', f4(L));
      st.set('U', Number.isFinite(Up) ? f4(Up) : '∞');
      st.set('g', Number.isFinite(Up) ? f4(Up - L) : '∞');
      st.set('I', f4(D.I));
      const msg = {
        sq: 'Функция возрастает: нижняя сумма — левые концы, верхняя — правые. Зазор U − L = (f(b) − f(a))·h = 4·' + f4(2 / n) + ' = ' + f4(Up - L) + ' → 0. Площадь зажата: ' + f4(L) + ' ≤ 8/3 ≤ ' + f4(Up) + '.',
        sin: 'Функция не монотонна: на части с вершиной верхняя грань — сама вершина, а не конец. Зазор всё равно тает как 1/n — непрерывная функция интегрируема.',
        step: 'Скачок портит только одну часть — ту, что его содержит: там нижняя грань 1, верхняя 2.5. Зазор U − L = 1.5·h = ' + f4(Up - L) + ' → 0. Функция с конечным числом скачков интегрируема.',
        wig: 'Функция колеблется, но непрерывна: на мелких частях её перепад мал, и зазор стремится к нулю.',
        rsq: 'Функция неограничена: на первой части её верхняя грань бесконечна, и верхняя сумма — ∞ при любом n. Интеграла Римана нет! Тем не менее площадь конечна (= 2) — это <b>несобственный</b> интеграл (шаг 22).',
      }[s.fn];
      note.innerHTML = msg;
    }
    w.pythonAction(() => 'import numpy as np\n\nf = lambda x: x**2\na, b = 0.0, 2.0\nfor n in [1, 4, 16, 64, 256]:\n    edges = np.linspace(a, b, n + 1)\n    lo = np.array([f(np.linspace(edges[i], edges[i + 1], 50)).min() for i in range(n)])\n    hi = np.array([f(np.linspace(edges[i], edges[i + 1], 50)).max() for i in range(n)])\n    h = (b - a) / n\n    print(f"n = {n:3d}: L = {lo.sum() * h:.5f}, U = {hi.sum() * h:.5f}, U − L = {(hi - lo).sum() * h:.5f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 7. Площадь со знаком: перемещение и путь
   * ============================================================================== */
  const SA = {
    sin: { label: 'sin x', f: Math.sin, view: [-1, 7], y: [-1.3, 1.3], a: 0, b: 4.7, step: 0.05, py: 'np.sin(x)' },
    lin: { label: 'x − 1', f: (x) => x - 1, view: [-0.5, 3.5], y: [-1.6, 2.6], a: 0, b: 3, step: 0.1, py: 'x - 1' },
    vel: { label: 'скорость v = 4 − 2t (вперёд, потом назад)', f: (t) => 4 - 2 * t, view: [0, 4.5], y: [-5.5, 4.5], a: 0, b: 4, step: 0.1, py: '4 - 2 * x', vel: true },
    cub: { label: 'x³ − x', f: (x) => x ** 3 - x, view: [-1.6, 1.6], y: [-1.2, 1.2], a: -1, b: 1, step: 0.05, py: 'x**3 - x' },
  };
  GBC.widget('signed-area', (el) => {
    const s = { k: 'sin', a: 0, b: 4.7, abs: false };
    const w = ui.shell(el, { title: 'Интеграл — площадь со знаком', sub: 'Над осью площадь считается со знаком «+» (синяя), под осью — со знаком «−» (красная). Тяните границы a и b. Переключатель |f| отражает нижние куски вверх — так считают «геометрическую» площадь.' });
    ui.select(w.controls, { label: 'Функция', value: s.k, options: Object.entries(SA).map(([k, A]) => ({ value: k, label: A.label })), onChange: (v) => ((s.k = v), (s.a = SA[v].a), (s.b = SA[v].b), draw()) });
    ui.toggle(w.controls, { label: 'показать |f(x)|', checked: s.abs, onChange: (v) => ((s.abs = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'над осью' }, { key: 'n', label: 'под осью' }, { key: 'I', label: '∫ f dx (со знаком)' }, { key: 'A', label: '∫ |f| dx' }]);
    function draw() {
      const A = SA[s.k];
      const lo = Math.min(s.a, s.b);
      const hi = Math.max(s.a, s.b);
      const pos = simpson((x) => Math.max(A.f(x), 0), lo, hi, 2000);
      const neg = simpson((x) => Math.min(A.f(x), 0), lo, hi, 2000);
      const c = curve(A.f, A.view[0], A.view[1], 500);
      const xs = U.linspace(lo, hi, 300);
      plot.render([
        ...signedArea(A.f, lo, hi, { n: 400, labels: ['«+»', '«−»'] }),
        s.abs ? { type: 'line', x: xs, y: xs.map((x) => Math.abs(A.f(x))), color: 'violet', width: 2, dash: '5 4', label: '|f(x)|', hover: false } : { type: 'points', x: [], y: [] },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: c.x, y: c.y, color: 'ink', width: 2.2, hover: false },
        { type: 'vline', x: s.a, color: 'tree', width: 1.8, draggable: true, text: 'a', onDrag: (x) => ((s.a = U.clamp(snap(x, A.step), A.view[0], A.view[1])), draw()) },
        { type: 'vline', x: s.b, color: 'tree', width: 1.8, draggable: true, text: 'b', onDrag: (x) => ((s.b = U.clamp(snap(x, A.step), A.view[0], A.view[1])), draw()) },
      ], { x: A.view, y: A.y });
      st.set('p', f4(pos));
      st.set('n', f4(-neg));
      st.set('I', f4(pos + neg));
      st.set('A', f4(pos - neg));
      const base = '∫ f = (над осью) − (под осью) = ' + f3(pos) + ' − ' + f3(-neg) + ' = <b>' + f3(pos + neg) + '</b>, а «геометрическая» площадь ∫|f| = ' + f3(pos - neg) + '. ';
      note.innerHTML = base + (A.vel ? 'Для скорости это <b>перемещение</b> и <b>путь</b>: до t = 2 машина едет вперёд, потом назад. За 4 с перемещение 0 — вернулась туда, откуда выехала, — а проехала 8 м.' : s.k === 'sin' ? 'На [0, π] интеграл sin x равен 2, а на [0, 2π] — нулю: верхняя и нижняя половины волны сокращаются.' : s.k === 'cub' ? 'x³ − x — нечётная функция: на симметричном отрезке [−1, 1] площади слева и справа равны и противоположны по знаку, интеграл 0.' : 'На [0, 3]: под осью треугольник 0.5, над осью треугольник 2; интеграл 1.5.');
    }
    w.pythonAction(() => {
      const A = SA[s.k];
      return 'import numpy as np\n\nf = lambda x: ' + A.py + '\na, b = ' + py(Math.min(s.a, s.b)) + ', ' + py(Math.max(s.a, s.b)) + '\nx = np.linspace(a, b, 200001)\ny = f(x)\ndx = x[1] - x[0]\nprint("∫ f   =", np.sum((y[1:] + y[:-1]) / 2) * dx)\nprint("∫ |f| =", np.sum((np.abs(y[1:]) + np.abs(y[:-1])) / 2) * dx)\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 8. Свойства определённого интеграла
   * ============================================================================== */
  GBC.widget('integral-properties', (el) => {
    const s = { mode: 'add', b: 2.5, al: 1, be: 2, odd: true, h: 1.5, ea: 0, eb: 1 };
    const w = ui.shell(el, { title: 'Свойства интеграла на картинках', sub: 'Четыре свойства, которые сильно сокращают вычисления: склейка отрезков, линейность, симметрия и оценка. Выберите свойство; в каждом что-то можно тянуть или двигать.' });
    ui.segmented(w.controls, { label: 'Свойство', value: s.mode, options: [{ value: 'add', label: 'склейка' }, { value: 'lin', label: 'линейность' }, { value: 'sym', label: 'симметрия' }, { value: 'est', label: 'оценка' }], onChange: (v) => ((s.mode = v), mk(), draw()) });
    const box = H('div', { style: 'display:flex;flex-direction:column;gap:14px' });
    w.controls.appendChild(box);
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const fBox = card('Проверка числами');
    w.main.appendChild(fBox.el);
    const note = w.note('', true);
    const fAdd = (x) => 2 + Math.sin(1.5 * x);
    const fLin = (x) => x;
    const gLin = (x) => Math.sin((Math.PI * x) / 2);
    const fOdd = (x) => x ** 3 - 2 * x;
    const fEven = (x) => x * x - 1;
    const fEst = (x) => Math.exp(-x * x);
    function mk() {
      box.textContent = '';
      if (s.mode === 'lin') {
        ui.slider(box, { label: 'α (множитель f)', min: -2, max: 2, step: 0.5, value: s.al, onInput: (v) => ((s.al = v), draw()) });
        ui.slider(box, { label: 'β (множитель g)', min: -2, max: 2, step: 0.5, value: s.be, onInput: (v) => ((s.be = v), draw()) });
      } else if (s.mode === 'sym') {
        ui.segmented(box, { label: 'Функция', value: s.odd, options: [{ value: true, label: 'нечётная x³ − 2x' }, { value: false, label: 'чётная x² − 1' }], onChange: (v) => ((s.odd = v), draw()) });
        ui.slider(box, { label: 'Полуширина отрезка h', min: 0.25, max: 2, step: 0.25, value: s.h, onInput: (v) => ((s.h = v), draw()) });
      } else if (s.mode === 'add') {
        box.appendChild(H('p', { class: 'ctl-help' }, 'Тяните точку склейки c (оранжевая линия) — в том числе за пределы отрезка [0, 5].'));
      } else {
        box.appendChild(H('p', { class: 'ctl-help' }, 'Тяните границы a и b: прямоугольники высотой min f и max f зажимают площадь.'));
      }
    }
    function draw() {
      const L = [];
      let html = '';
      if (s.mode === 'add') {
        const a = 0;
        const c = 5;
        const b = s.b;
        const c1 = curve(fAdd, -1, 6.5, 400);
        const I1 = simpson(fAdd, a, b);
        const I2 = simpson(fAdd, b, c);
        const I = simpson(fAdd, a, c);
        const band = (x0, x1, label) => {
          const xs = U.linspace(x0, x1, 120);
          return { type: 'area', x: xs, y0: xs.map(() => 0), y1: xs.map(fAdd), color: 'tree', opacity: 0.45, label };
        };
        if (b > a && b < c) {
          L.push(...signedArea(fAdd, a, b, { pos: 'model', labels: ['от a до c', ''] }), band(b, c, 'от c до b'));
        } else if (b <= a) {
          L.push(...signedArea(fAdd, b, c, { pos: 'model', labels: ['∫ от c до b — больше целого', ''] }), band(b, a, 'вычитается: ∫ от a до c < 0'));
        } else {
          L.push(...signedArea(fAdd, a, b, { pos: 'model', labels: ['∫ от a до c — больше целого', ''] }), band(c, b, 'вычитается: ∫ от c до b < 0'));
        }
        L.push({ type: 'line', x: c1.x, y: c1.y, color: 'ink', width: 2.2, hover: false }, { type: 'hline', y: 0, color: 'axis' }, { type: 'vline', x: a, color: 'ink2', width: 1, text: 'a' }, { type: 'vline', x: c, color: 'ink2', width: 1, text: 'b' }, { type: 'vline', x: b, color: 'tree', width: 2, draggable: true, text: 'c', onDrag: (x) => ((s.b = U.clamp(snap(x, 0.25), -1, 6.5)), draw()) });
        plot.render(L, { x: [-1, 6.5], y: [-0.3, 3.4] });
        html = '∫ f на [0, c] + ∫ f на [c, 5] = ' + f4(I1) + ' + (' + f4(I2) + ') = <b>' + f4(I1 + I2) + '</b>; ∫ f на [0, 5] = <b>' + f4(I) + '</b>.';
        note.innerHTML = b > a && b < c ? 'Отрезок разрезан в точке c: две площади в сумме дают целую.' : 'Точка c вне отрезка [0, 5] — склейка всё равно работает! Один из интегралов идёт «справа налево» (от большего предела к меньшему) и поэтому отрицателен. Оранжевый кусок вычитается.';
      } else if (s.mode === 'lin') {
        const h = (x) => s.al * fLin(x) + s.be * gLin(x);
        const If = simpson(fLin, 0, 2);
        const Ig = simpson(gLin, 0, 2);
        const Ih = simpson(h, 0, 2);
        const cx = U.linspace(-0.3, 2.3, 300);
        L.push(...signedArea(h, 0, 2), { type: 'hline', y: 0, color: 'axis' }, { type: 'line', x: cx, y: cx.map(fLin), color: 'aqua', width: 1.8, dash: '6 4', label: 'f = x', hover: false }, { type: 'line', x: cx, y: cx.map(gLin), color: 'violet', width: 1.8, dash: '2 3', label: 'g = sin(πx/2)', hover: false }, { type: 'line', x: cx, y: cx.map(h), color: 'ink', width: 2.4, label: 'αf + βg', hover: false });
        plot.render(L, { x: [-0.3, 2.3], y: yDom(cx.map(h).concat(cx.map(fLin), cx.map(gLin)), 0.1, [0]) });
        html = 'α∫f + β∫g = ' + U.fmt(s.al, 1) + '·' + f4(If) + ' + ' + U.fmt(s.be, 1) + '·' + f4(Ig) + ' = <b>' + f4(s.al * If + s.be * Ig) + '</b>; ∫(αf + βg) = <b>' + f4(Ih) + '</b>.';
        note.innerHTML = 'Интеграл суммы — сумма интегралов, множитель выносится. Поэтому таблицы и формулы нужны только для «кирпичиков»: ∫₀² x dx = 2, ∫₀² sin(πx/2) dx = 4/π ≈ 1.2732 — всё остальное собирается линейностью.';
      } else if (s.mode === 'sym') {
        const f = s.odd ? fOdd : fEven;
        const hh = s.h;
        const cx = U.linspace(-2.3, 2.3, 400);
        const I = simpson(f, -hh, hh);
        const half = simpson(f, 0, hh);
        L.push(...signedArea(f, -hh, hh), { type: 'hline', y: 0, color: 'axis' }, { type: 'vline', x: 0, color: 'axis' }, { type: 'line', x: cx, y: cx.map(f), color: 'ink', width: 2.2, hover: false });
        plot.render(L, { x: [-2.3, 2.3], y: s.odd ? [-5, 5] : [-1.5, 4.5] });
        html = s.odd ? '∫₋ₕʰ f = ' + f4(I) + ' — ноль при любом h.' : '∫₋ₕʰ f = <b>' + f4(I) + '</b> = 2·∫₀ʰ f = 2·' + f4(half) + '.';
        note.innerHTML = s.odd ? 'Нечётная функция (f(−x) = −f(x)) симметрична относительно начала координат: каждой синей площади справа соответствует такая же красная слева. Интеграл по симметричному отрезку равен нулю — считать ничего не нужно.' : 'Чётная функция (f(−x) = f(x)) симметрична относительно оси y: интеграл по [−h, h] вдвое больше интеграла по [0, h].';
      } else {
        const a = Math.min(s.ea, s.eb);
        const b = Math.max(s.ea, s.eb);
        const [m, M] = infSup(fEst, a, b, 400);
        const I = simpson(fEst, a, b);
        const cx = U.linspace(-2.5, 2.5, 400);
        L.push(...signedArea(fEst, a, b), { type: 'rect', x0: a, x1: b, y0: 0, y1: m, fill: 'model', stroke: 'model', opacity: 0.05, width: 1.8, dash: '5 3' }, { type: 'rect', x0: a, x1: b, y0: 0, y1: M, stroke: 'tree', opacity: 0, width: 1.8 }, { type: 'line', x: cx, y: cx.map(fEst), color: 'ink', width: 2.2, hover: false },
          { type: 'vline', x: s.ea, color: 'tree', width: 1.6, draggable: true, text: 'a', onDrag: (x) => ((s.ea = U.clamp(snap(x, 0.1), -2.5, 2.5)), draw()) },
          { type: 'vline', x: s.eb, color: 'tree', width: 1.6, draggable: true, text: 'b', onDrag: (x) => ((s.eb = U.clamp(snap(x, 0.1), -2.5, 2.5)), draw()) });
        plot.render(L, { x: [-2.5, 2.5], y: [0, 1.15] });
        html = 'm(b − a) = ' + f4(m * (b - a)) + ' ≤ ∫ e^(−x²) dx = <b>' + f4(I) + '</b> ≤ M(b − a) = ' + f4(M * (b - a)) + '.';
        note.innerHTML = 'Если m ≤ f ≤ M на [a, b], то площадь не меньше нижнего прямоугольника и не больше верхнего. Интеграл e^(−x²) не выражается формулой, но оценка мгновенна: на [0, 1] он между e⁻¹ ≈ 0.368 и 1 (точно 0.7468).';
      }
      fBox.body.innerHTML = html;
    }
    w.pythonAction(() => 'import numpy as np\n\ndef integral(f, a, b, n=100000):\n    h = (b - a) / n\n    x = a + (np.arange(n) + 0.5) * h\n    return np.sum(f(x)) * h\n\nf = lambda x: 2 + np.sin(1.5 * x)\nprint("склейка:", integral(f, 0, 2.5) + integral(f, 2.5, 5), "=", integral(f, 0, 5))\nprint("линейность:", integral(lambda x: x + 2 * np.sin(np.pi * x / 2), 0, 2), "=", integral(lambda x: x, 0, 2) + 2 * integral(lambda x: np.sin(np.pi * x / 2), 0, 2))\nprint("нечётная:", round(integral(lambda x: x**3 - 2 * x, -1.5, 1.5), 12))\ng = lambda x: np.exp(-x**2)\nprint("оценка:", np.exp(-1), "≤", integral(g, 0, 1), "≤", 1)\n');
    mk();
    draw();
  });

  /* ==============================================================================
   * Шаг 9. Среднее значение функции и теорема о среднем
   * ============================================================================== */
  const MV = {
    v: { label: 'скорость v(t) на [0, 10]', f: vTrip, a: 0, b: 10, view: [0, 10], y: [0, 17], step: 0.5, py: '6 * x - 0.6 * x**2' },
    sq: { label: 'x² на [0, 2]', f: (x) => x * x, a: 0, b: 2, view: [0, 2.5], y: [0, 6.5], step: 0.05, py: 'x**2' },
    sin: { label: 'sin x на [0, π]', f: Math.sin, a: 0, b: Math.PI, view: [0, 2 * Math.PI], y: [-1.1, 1.15], step: 0.05, py: 'np.sin(x)' },
    exp: { label: 'eˣ на [0, 1]', f: Math.exp, a: 0, b: 1, view: [-0.5, 1.5], y: [0, 4.6], step: 0.05, py: 'np.exp(x)' },
    step: { label: 'ступенька 1 → 3 (разрыв)', f: (x) => (x < 1 ? 1 : 3), a: 0, b: 2, view: [0, 2], y: [0, 3.4], step: 0.05, py: 'np.where(x < 1, 1.0, 3.0)', jump: 1 },
  };
  GBC.widget('mean-value', (el) => {
    const s = { k: 'v', a: 0, b: 10, n: 5 };
    const w = ui.shell(el, { title: 'Среднее значение: прямоугольник той же площади', sub: 'Среднее значение функции на [a, b] — высота прямоугольника с тем же основанием и той же площадью: f̄ = (1/(b − a))·∫f. Точки на кривой — n равномерных замеров; их обычное среднее подходит к f̄.' });
    ui.select(w.controls, { label: 'Функция', value: s.k, options: Object.entries(MV).map(([k, M]) => ({ value: k, label: M.label })), onChange: (v) => ((s.k = v), (s.a = MV[v].a), (s.b = MV[v].b), draw()) });
    ui.slider(w.controls, { label: 'Число замеров n', values: [1, 2, 3, 5, 10, 20, 50, 200], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'I', label: '∫ f dx' }, { key: 'm', label: 'среднее f̄' }, { key: 's', label: 'среднее n замеров' }, { key: 'c', label: 'где f(c) = f̄' }]);
    function draw() {
      const M = MV[s.k];
      const a = Math.min(s.a, s.b);
      const b = Math.max(s.a, s.b);
      if (b - a < 1e-9) return;
      const I = simpson(M.f, a, b, 2000);
      const mean = I / (b - a);
      const xs = U.range(s.n).map((i) => a + ((i + 0.5) * (b - a)) / s.n);
      const sm = U.mean(xs.map(M.f));
      const cs = rootsOf((x) => M.f(x) - mean, a, b, 2000).filter((x) => !M.jump || Math.abs(x - M.jump) > 1e-6);
      const c = curve(M.f, M.view[0], M.view[1], 500);
      if (M.jump) {
        const j = c.x.findIndex((x) => x >= M.jump);
        c.x.splice(j, 0, M.jump);
        c.y.splice(j, 0, NaN);
      }
      plot.render([
        ...signedArea(M.f, a, b, { opacity: 0.22, labels: ['площадь под f', ''] }),
        { type: 'rect', x0: a, x1: b, y0: 0, y1: mean, color: 'tree', fill: 'tree', stroke: 'tree', opacity: 0.1, width: 2, label: 'прямоугольник f̄·(b − a)' },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: c.x, y: c.y, color: 'ink', width: 2.2, hover: false },
        { type: 'points', x: xs, y: xs.map(M.f), color: 'model', r: s.n > 50 ? 2.5 : 4.5 },
        { type: 'points', x: cs, y: cs.map(() => mean), color: 'tree', r: 6, hollow: true },
        { type: 'vline', x: s.a, color: 'tree', width: 1.4, draggable: true, text: 'a', onDrag: (x) => ((s.a = U.clamp(snap(x, M.step), M.view[0], M.view[1])), draw()) },
        { type: 'vline', x: s.b, color: 'tree', width: 1.4, draggable: true, text: 'b', onDrag: (x) => ((s.b = U.clamp(snap(x, M.step), M.view[0], M.view[1])), draw()) },
      ], { x: M.view, y: M.y });
      st.set('I', f4(I));
      st.set('m', f4(mean));
      st.set('s', f4(sm));
      st.set('c', cs.length ? cs.map(f3).join('; ') : 'нет');
      note.innerHTML = 'f̄ = ' + f4(I) + ' / ' + f3(b - a) + ' = <b>' + f4(mean) + '</b>. Обычное среднее ' + s.n + ' замеров = ' + f4(sm) + ' — это сумма Римана (середины), делённая на длину отрезка, поэтому при росте n она подходит к f̄. ' + (cs.length ? '<b>Теорема о среднем</b>: непрерывная функция хотя бы раз принимает своё среднее значение — кружки на кривой (c = ' + cs.map(f3).join(', ') + ').' : 'Функция со скачком своё среднее не принимает нигде: теорема о среднем требует непрерывности.') + (s.k === 'v' && a === 0 && b === 10 ? ' Средняя скорость поездки — 100 м / 10 с = 10 м/с.' : '');
    }
    w.pythonAction(() => {
      const M = MV[s.k];
      return 'import numpy as np\n\nf = lambda x: ' + M.py + '\na, b = ' + py(Math.min(s.a, s.b)) + ', ' + py(Math.max(s.a, s.b)) + '\nfor n in [1, 5, 20, 1000]:\n    x = a + (np.arange(n) + 0.5) * (b - a) / n      # n равномерных замеров\n    print(f"n = {n:4d}: среднее замеров {f(x).mean():.6f}")\nx = np.linspace(a, b, 200001)\ny = f(x)\nprint("f̄ = ∫f / (b − a) =", np.sum((y[1:] + y[:-1]) / 2) * (x[1] - x[0]) / (b - a))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 10. Функция накопления
   * ============================================================================== */
  const AF = {
    v: { label: 'скорость v(t) = 6t − 0.6t²', f: vTrip, F: sTrip, dom: [0, 10], a: 0, x: 4, Fl: 's(t) = 3t² − t³/5', py: '6 * x - 0.6 * x**2' },
    lin: { label: 'f(x) = x', f: (x) => x, F: (x) => (x * x) / 2, dom: [-2, 3], a: -2, x: 1, Fl: 'x²/2', py: 'x' },
    quad: { label: 'f(x) = x² − 1', f: (x) => x * x - 1, F: (x) => (x ** 3) / 3 - x, dom: [-2, 2.5], a: 0, x: 1.5, Fl: 'x³/3 − x', py: 'x**2 - 1' },
    cos: { label: 'f(x) = cos x', f: Math.cos, F: Math.sin, dom: [0, 7], a: 0, x: 2, Fl: 'sin x', py: 'np.cos(x)' },
    bell: { label: 'f(x) = σ′(x) — «колокол»', f: (x) => sigma(x) * (1 - sigma(x)), F: (x) => sigma(x), dom: [-6, 6], a: -6, x: 0, Fl: 'σ(x)', py: '1 / (1 + np.exp(-x)) * (1 - 1 / (1 + np.exp(-x)))' },
    step: {
      label: 'ступеньки: 1, −1, 0.5', f: (x) => (x < 2 ? 1 : x < 3 ? -1 : 0.5), dom: [0, 5], a: 0, x: 2.5, Fl: 'ломаная', py: 'np.where(x < 2, 1.0, np.where(x < 3, -1.0, 0.5))', jumps: [2, 3],
      F: (x) => (x < 2 ? x : x < 3 ? 2 - (x - 2) : 1 + 0.5 * (x - 3)),
    },
  };
  GBC.widget('accumulate', (el) => {
    const s = { fn: 'v', x: 4, h: 0.5, a: 0 };
    const w = ui.shell(el, { title: 'Функция накопления A(x) = ∫ₐˣ f(t) dt', sub: 'A(x) — площадь под f от начала a до переменного конца x (снизу — её график). Тяните точку по графику f. Сдвинем x на h: площадь изменится на узкую полоску ≈ f(x)·h. Значит, скорость роста площади — сама функция f.', stack: true });
    ui.select(w.controls, { label: 'Функция f', value: s.fn, options: Object.entries(AF).map(([k, A]) => ({ value: k, label: A.label })), onChange: (k) => {
      s.fn = k;
      s.x = AF[k].x;
      s.a = AF[k].a;
      mkA();
      draw();
    } });
    ui.slider(w.controls, { label: 'Ширина полоски h', min: 0.02, max: 1.5, step: 0.02, value: s.h, onInput: (x) => ((s.h = x), draw()) });
    const aBox = H('div', { class: 'ctl', style: 'flex:1 1 200px' });
    w.controls.appendChild(aBox);
    let aSl = null;
    function mkA() {
      aBox.textContent = '';
      const A = AF[s.fn];
      aSl = ui.slider(aBox, { label: 'Начало отсчёта a', min: A.dom[0], max: A.dom[1], step: (A.dom[1] - A.dom[0]) / 40, value: s.a, onInput: (v) => ((s.a = v), draw()) });
    }
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: 'A(x) — накопленная площадь' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'A', label: 'A(x)' }, { key: 'dA', label: 'прирост ΔA' }, { key: 'r', label: 'ΔA / h' }, { key: 'f', label: 'f(x)' }]);
    function draw() {
      const A = AF[s.fn];
      const x = U.clamp(s.x, A.dom[0], A.dom[1] - s.h);
      const h = s.h;
      const a = s.a;
      const area = (t) => A.F(t) - A.F(a);
      const c = curve(A.f, A.dom[0], A.dom[1], 600);
      for (const j of A.jumps || []) {
        const k = c.x.findIndex((t) => t >= j);
        c.x.splice(k, 0, j);
        c.y.splice(k, 0, NaN);
      }
      const ext = rootsOf(A.f, A.dom[0], A.dom[1], 1200);
      p1.render([
        ...signedArea(A.f, a, x, { n: 400, opacity: 0.25 }),
        { type: 'area', x: U.linspace(x, x + h, 60), y0: U.linspace(0, 0, 60), y1: U.linspace(x, x + h, 60).map(A.f), color: 'tree', opacity: 0.55, label: 'полоска ΔA' },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'vline', x: a, color: 'ink2', width: 1, dash: '3 3', text: 'a' },
        { type: 'line', x: c.x, y: c.y, color: 'ink', width: 2.2, label: 'f', hover: false },
        { type: 'points', x: [x], y: [A.f(x)], color: 'tree', r: 7, draggable: true, onDrag: (i, nx) => ((s.x = U.clamp(snap(nx, 0.02), A.dom[0], A.dom[1])), draw()) },
      ], { x: A.dom, y: yDom(c.y, 0.1, [0]) });
      const xs = U.linspace(A.dom[0], A.dom[1], 400);
      const ys = xs.map(area);
      const span = (A.dom[1] - A.dom[0]) * 0.12;
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: xs, y: ys, color: 'model', width: 2.4, label: 'A(x) = ' + A.Fl + ' + C', hover: false },
        { type: 'points', x: ext, y: ext.map(area), color: 'violet', r: 4.5, hollow: true },
        { type: 'segments', x1: [x - span], y1: [area(x) - A.f(x) * span], x2: [x + span], y2: [area(x) + A.f(x) * span], color: 'tree', width: 2.2, opacity: 1 },
        { type: 'points', x: [x, x + h], y: [area(x), area(x + h)], color: 'tree', r: 5 },
      ], { x: A.dom, y: yDom(ys, 0.12) });
      const dA = area(x + h) - area(x);
      st.set('A', f4(area(x)));
      st.set('dA', f4(dA));
      st.set('r', f4(dA / h));
      st.set('f', f4(A.f(x)));
      const fx = A.f(x);
      const sign = Math.abs(fx) < 1e-9 ? 'f(x) = 0 — график A здесь горизонтален.' : fx > 0 ? 'f(x) > 0 — площадь растёт, график A идёт вверх.' : 'f(x) < 0 — полоска под осью, площадь убывает, график A идёт вниз.';
      note.innerHTML = sign + ' ΔA / h = ' + f4(dA / h) + ', f(x) = ' + f4(fx) + ': уменьшайте h — числа сольются. <b>Наклон касательной к графику A (оранжевый отрезок) равен высоте f.</b> Фиолетовые кружки — где f меняет знак: там у A вершина или впадина. ' + (A.jumps ? 'Скачки f дают изломы A: сама A непрерывна, но в изломах производной нет.' : 'Сдвиньте начало a — график A сдвинется по вертикали, форма не изменится: A определена с точностью до константы.');
    }
    w.pythonAction(() => {
      const A = AF[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + A.py + '\na = ' + py(s.a) + '\nx = np.linspace(a, ' + py(A.dom[1]) + ', 100001)\ny = f(x)\nA = np.concatenate([[0], np.cumsum((y[1:] + y[:-1]) / 2 * np.diff(x))])   # накопленная площадь\nslope = np.gradient(A, x)                   # численная производная A\nfor t in np.linspace(x[100], x[-100], 5):\n    i = np.searchsorted(x, t)\n    print(f"x = {x[i]:6.3f}: A(x) = {A[i]:8.4f},  A′(x) = {slope[i]:7.4f},  f(x) = {y[i]:7.4f}")\n';
    });
    mkA();
    draw();
  });

  /* ==============================================================================
   * Шаг 11. Основная теорема: полоска зажата двумя прямоугольниками
   * ============================================================================== */
  const SQZ = {
    v: { label: 'скорость v(t)', f: vTrip, F: sTrip, dom: [0, 10], x: 3 },
    sq: { label: 'x²', f: (x) => x * x, F: (x) => (x ** 3) / 3, dom: [0, 3], x: 1 },
    exp: { label: 'eˣ', f: Math.exp, F: Math.exp, dom: [-1, 2], x: 0.5 },
    cos: { label: 'cos x', f: Math.cos, F: Math.sin, dom: [0, 6], x: 1 },
  };
  const HS = [1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];
  GBC.widget('ftc-squeeze', (el) => {
    const s = { fn: 'sq', x: 1, k: 1 };
    const w = ui.shell(el, { title: 'Почему A′(x) = f(x): полоска в тисках', sub: 'Полоска между x и x + h (заливка) больше прямоугольника высотой min f и меньше прямоугольника высотой max f. Поделим на h: ΔA/h зажато между min f и max f на полоске. При h → 0 оба стремятся к f(x).', stack: true });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(SQZ).map(([k, Q]) => ({ value: k, label: Q.label })), onChange: (v) => {
      s.fn = v;
      s.x = SQZ[v].x;
      xs.set(s.x);
      draw();
    } });
    const xs = ui.slider(w.controls, { label: 'Точка x', min: 0, max: 3, step: 0.05, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    ui.player(w.controls, { label: 'Ширина h', min: 0, max: HS.length - 1, value: s.k, fps: 1.2, format: (k) => 'h = ' + HS[k], onChange: (k) => ((s.k = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x (вид приближается вместе с h)' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'ширина h (лог.)', type: 'log', domain: [5e-4, 2], ticks: [0.001, 0.01, 0.1, 1], format: powFmt }, y: { label: '|ΔA/h − f(x)| (лог.)', type: 'log', domain: [1e-8, 50], ticks: decades(-8, 0, 2), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'lo', label: 'min f на полоске' }, { key: 'r', label: 'ΔA / h' }, { key: 'hi', label: 'max f на полоске' }, { key: 'f', label: 'f(x)' }]);
    function draw() {
      const Q = SQZ[s.fn];
      const x = U.clamp(s.x, Q.dom[0], Q.dom[1]);
      const h = HS[s.k];
      const dA = Q.F(x + h) - Q.F(x);
      const [m, M] = infSup(Q.f, x, x + h, 200);
      const pad = Math.max(1.2 * h, 0.002);
      const view = [x - pad, x + h + pad];
      const c = curve(Q.f, view[0], view[1], 300);
      const strip = U.linspace(x, x + h, 80);
      p1.render([
        { type: 'area', x: strip, y0: strip.map(() => 0), y1: strip.map(Q.f), color: 'model', opacity: 0.3, label: 'полоска ΔA' },
        { type: 'rect', x0: x, x1: x + h, y0: 0, y1: m, color: 'aqua', stroke: 'aqua', opacity: 0, width: 2, label: 'min f · h' },
        { type: 'rect', x0: x, x1: x + h, y0: 0, y1: M, color: 'tree', stroke: 'tree', opacity: 0, width: 2, dash: '5 3', label: 'max f · h' },
        { type: 'line', x: c.x, y: c.y, color: 'ink', width: 2.2, hover: false },
        { type: 'points', x: [x], y: [Q.f(x)], color: 'ink', r: 5 },
      ], { x: view, y: yDom(c.y.concat([0]), 0.08) });
      const errs = HS.map((hh) => Math.max(Math.abs((Q.F(x + hh) - Q.F(x)) / hh - Q.f(x)), 1e-8));
      p2.render([
        { type: 'line', x: HS, y: errs, color: 'model', width: 2, hover: false },
        { type: 'points', x: HS, y: errs, color: 'model', r: 4, tooltip: (i) => [['h', String(HS[i])], ['ошибка', U.fmt(errs[i], 3)]] },
        { type: 'points', x: [h], y: [errs[s.k]], color: 'tree', r: 7 },
      ]);
      st.set('lo', f6(m));
      st.set('r', f6(dA / h));
      st.set('hi', f6(M));
      st.set('f', f6(Q.f(x)));
      note.innerHTML = 'min f · h ≤ ΔA ≤ max f · h, то есть ' + f6(m) + ' ≤ ΔA/h = ' + f6(dA / h) + ' ≤ ' + f6(M) + '. Для непрерывной f обе границы при h → 0 сходятся к f(x) = ' + f6(Q.f(x)) + ' — и ΔA/h вместе с ними (теорема о сжатии, урок 15.4). Снизу видно: ошибка убывает пропорционально h (прямая с наклоном 1 на лог-шкале).';
    }
    w.pythonAction(() => 'import numpy as np\n\nf = np.exp                       # любая непрерывная функция\nF = np.exp                       # её первообразная (площадь с точностью до константы)\nx = 0.5\nfor h in [1, 0.1, 0.01, 0.001]:\n    t = np.linspace(x, x + h, 1001)\n    print(f"h = {h:<6}: min f = {f(t).min():.6f} ≤ ΔA/h = {(F(x + h) - F(x)) / h:.6f} ≤ max f = {f(t).max():.6f}")\nprint("f(x) =", f(x))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 12. Первообразная и семейство F + C
   * ============================================================================== */
  const FAM = {
    lin: { label: 'f(x) = 2x', f: (x) => 2 * x, F: (x) => x * x, view: [-2.5, 2.5], y: [-3, 6], p: [1, 2], Ft: 'x²' },
    cos: { label: 'f(x) = cos x', f: Math.cos, F: Math.sin, view: [-1, 7], y: [-2.5, 3.5], p: [0, 2], Ft: 'sin x' },
    inv: { label: 'f(x) = 1/x (x > 0)', f: (x) => 1 / x, F: Math.log, view: [0.15, 5], y: [-3, 3], p: [1, 0], Ft: 'ln x' },
    exp: { label: 'f(x) = e^(−x)', f: (x) => Math.exp(-x), F: (x) => -Math.exp(-x), view: [-1, 4], y: [-3.5, 2.5], p: [0, 0], Ft: '−e^(−x)' },
    cub: { label: 'f(x) = 3x² − 3', f: (x) => 3 * x * x - 3, F: (x) => x ** 3 - 3 * x, view: [-2.2, 2.2], y: [-4.5, 4.5], p: [0, 1], Ft: 'x³ − 3x' },
  };
  GBC.widget('antiderivative-family', (el) => {
    const s = { k: 'lin', p: FAM.lin.p.slice(), field: true };
    const w = ui.shell(el, { title: 'Первообразные: целое семейство F + C', sub: 'Чёрточки показывают наклон, который требует f: в точке x наклон кривой должен быть f(x). Подходят все кривые F(x) + C — они сдвинуты по вертикали и параллельны. Тяните точку: через неё пройдёт ровно одна первообразная.' });
    ui.select(w.controls, { label: 'Функция f (заданный наклон)', value: s.k, options: Object.entries(FAM).map(([k, G]) => ({ value: k, label: G.label })), onChange: (v) => ((s.k = v), (s.p = FAM[v].p.slice()), draw()) });
    ui.toggle(w.controls, { label: 'поле наклонов', checked: s.field, onChange: (v) => ((s.field = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 340, x: { label: 'x' }, y: { label: 'F(x) + C' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'точка (x₀, y₀)' }, { key: 'C', label: 'константа C' }, { key: 'F', label: 'первообразная' }]);
    function draw() {
      const G = FAM[s.k];
      const [x0, x1] = G.view;
      const [y0, y1] = G.y;
      const L = [];
      if (s.field) {
        const W = plot.root.clientWidth || 600;
        const Hp = 340 - 52;
        const sx = (W - 64) / (x1 - x0);
        const sy = Hp / (y1 - y0);
        const len = 9;
        const X1 = [];
        const Y1 = [];
        const X2 = [];
        const Y2 = [];
        for (const gx of U.linspace(x0, x1, 21).slice(1, -1)) {
          const k = G.f(gx);
          const dxp = len / Math.sqrt(1 + ((k * sy) / sx) ** 2);
          const dx = dxp / sx;
          for (const gy of U.linspace(y0, y1, 15).slice(1, -1)) {
            X1.push(gx - dx);
            Y1.push(gy - k * dx);
            X2.push(gx + dx);
            Y2.push(gy + k * dx);
          }
        }
        L.push({ type: 'segments', x1: X1, y1: Y1, x2: X2, y2: Y2, color: 'muted', width: 1.4, opacity: 0.7 });
      }
      const xs = U.linspace(x0, x1, 300);
      const C = s.p[1] - G.F(s.p[0]);
      for (let cc = -6; cc <= 6; cc += 1) L.push({ type: 'line', x: xs, y: xs.map((x) => G.F(x) + cc), color: 'model-prev', width: 1.1, opacity: 0.55, hover: false });
      L.push({ type: 'line', x: xs, y: xs.map((x) => G.F(x) + C), color: 'model', width: 2.8, hover: false });
      L.push({ type: 'points', x: [s.p[0]], y: [s.p[1]], color: 'tree', r: 7, draggable: true, onDrag: (i, nx, ny) => {
        s.p = [U.clamp(snap(nx, 0.05), x0 + 0.05, x1 - 0.05), U.clamp(snap(ny, 0.05), y0, y1)];
        draw();
      } });
      plot.render(L, { x: G.view, y: G.y });
      st.set('p', '(' + f2(s.p[0]) + ', ' + f2(s.p[1]) + ')');
      st.set('C', f3(C));
      st.set('F', G.Ft + (Math.abs(C) < 5e-4 ? '' : (C > 0 ? ' + ' : ' − ') + f3(Math.abs(C))));
      note.innerHTML = 'Все синие кривые — первообразные ' + G.label.slice(G.label.indexOf('=') + 2) + ': у каждой в любой точке наклон f(x), а различаются они только сдвигом C. Поэтому пишут ∫ f dx = ' + G.Ft + ' + C (<b>неопределённый интеграл</b>). Условие «кривая проходит через (x₀, y₀)» — <b>начальное условие</b> — выбирает одну: C = y₀ − F(x₀) = ' + f3(C) + '.';
    }
    w.pythonAction(() => 'import numpy as np\n\n# первообразная с начальным условием: F(x0) = y0 → C = y0 − F(x0)\nF = lambda x: x**2           # одна из первообразных 2x\nx0, y0 = ' + py(s.p[0]) + ', ' + py(s.p[1]) + '\nC = y0 - F(x0)\nprint("C =", C)\nx = np.linspace(-2, 2, 5)\nprint("F(x) + C:", F(x) + C)\n# проверка: численная производная совпадает с 2x при любом C\nh = 1e-6\nprint(np.round(((F(x + h) + C) - (F(x - h) + C)) / (2 * h), 6), "=", 2 * x)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 13. Формула Ньютона — Лейбница
   * ============================================================================== */
  const NLF = {
    sq: { label: 'f(x) = x²', f: (x) => x * x, F: (x) => (x ** 3) / 3, view: [-1, 2.5], a: 0, b: 2, Ft: 'x³/3', py: ['x**2', 'x**3 / 3'] },
    sin: { label: 'f(x) = sin x', f: Math.sin, F: (x) => -Math.cos(x), view: [-0.5, 7], a: 0, b: Math.PI, Ft: '−cos x', py: ['np.sin(x)', '-np.cos(x)'] },
    inv: { label: 'f(x) = 1/x', f: (x) => 1 / x, F: Math.log, view: [0.3, 4], a: 1, b: Math.E, Ft: 'ln x', py: ['1 / x', 'np.log(x)'] },
    v: { label: 'скорость v(t) = 6t − 0.6t²', f: vTrip, F: sTrip, view: [0, 10], a: 0, b: 10, Ft: '3t² − t³/5', py: ['6 * x - 0.6 * x**2', '3 * x**2 - x**3 / 5'] },
    quad: { label: 'f(x) = x² − 2x + 3', f: (x) => x * x - 2 * x + 3, F: (x) => (x ** 3) / 3 - x * x + 3 * x, view: [-1.5, 3], a: -1, b: 2, Ft: 'x³/3 − x² + 3x', py: ['x**2 - 2 * x + 3', 'x**3 / 3 - x**2 + 3 * x'] },
    exp: { label: 'f(x) = eˣ', f: Math.exp, F: Math.exp, view: [-1, 2], a: 0, b: 1, Ft: 'eˣ', py: ['np.exp(x)', 'np.exp(x)'] },
  };
  GBC.widget('newton-leibniz', (el) => {
    const s = { k: 'sq', a: 0, b: 2, C: 0 };
    const w = ui.shell(el, { title: 'Ньютон — Лейбниц: площадь = прирост первообразной', sub: 'Сверху — площадь под f на [a, b]. Снизу — график первообразной F: оранжевый отрезок показывает, насколько F выросла от a до b. Числа совпадают при любых a, b и при любом сдвиге C.', stack: true });
    ui.select(w.controls, { label: 'Функция', value: s.k, options: Object.entries(NLF).map(([k, G]) => ({ value: k, label: G.label })), onChange: (v) => ((s.k = v), (s.a = NLF[v].a), (s.b = NLF[v].b), draw()) });
    ui.slider(w.controls, { label: 'Сдвиг первообразной C', min: -3, max: 3, step: 0.5, value: s.C, onInput: (v) => ((s.C = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'F(x) + C' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'A', label: 'площадь (численно)' }, { key: 'D', label: 'F(b) − F(a)' }, { key: 'ab', label: 'отрезок' }]);
    function draw() {
      const G = NLF[s.k];
      const a = s.a;
      const b = s.b;
      const c = curve(G.f, G.view[0], G.view[1], 500);
      p1.render([
        ...signedArea(G.f, a, b, { n: 400 }),
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: c.x, y: c.y, color: 'ink', width: 2.2, hover: false },
        { type: 'vline', x: a, color: 'tree', width: 1.6, draggable: true, text: 'a', onDrag: (x) => ((s.a = U.clamp(snap(x, 0.05), G.view[0], G.view[1])), draw()) },
        { type: 'vline', x: b, color: 'tree', width: 1.6, draggable: true, text: 'b', onDrag: (x) => ((s.b = U.clamp(snap(x, 0.05), G.view[0], G.view[1])), draw()) },
      ], { x: G.view, y: yDom(c.y, 0.08, [0]) });
      const Fc = (x) => G.F(x) + s.C;
      const cF = curve(Fc, G.view[0], G.view[1], 500);
      p2.render([
        { type: 'line', x: cF.x, y: cF.y, color: 'model', width: 2.4, label: 'F(x) = ' + G.Ft + ' + C', hover: false },
        { type: 'segments', x1: [a], y1: [Fc(a)], x2: [b], y2: [Fc(a)], color: 'muted', width: 1.2, opacity: 0.9, dash: '4 3' },
        { type: 'segments', x1: [b], y1: [Fc(a)], x2: [b], y2: [Fc(b)], color: 'tree', width: 3.5, opacity: 1 },
        { type: 'points', x: [a, b], y: [Fc(a), Fc(b)], color: 'model', r: 5.5 },
        { type: 'text', x: b, y: (Fc(a) + Fc(b)) / 2, text: 'F(b) − F(a)', dx: 8 },
      ], { x: G.view, y: yDom(cF.y, 0.08, [Fc(a), Fc(b)]) });
      const A = simpson(G.f, a, b, 2000);
      const D = G.F(b) - G.F(a);
      st.set('A', f6(A));
      st.set('D', f6(D));
      st.set('ab', '[' + f3(a) + ', ' + f3(b) + ']');
      note.innerHTML = '∫ₐᵇ f dx = F(b) − F(a) = (' + f4(Fc(b)) + ') − (' + f4(Fc(a)) + ') = <b>' + f4(D) + '</b>. Площадь — это прирост первообразной. Константа C сдвигает график F, но прирост не меняет: при вычитании она сокращается. ' + (b < a ? 'Сейчас b < a — интеграл «справа налево» меняет знак.' : '');
    }
    w.pythonAction(() => {
      const G = NLF[s.k];
      return 'import numpy as np\n\nf = lambda x: ' + G.py[0] + '\nF = lambda x: ' + G.py[1] + '      # первообразная: F′ = f\na, b = ' + py(s.a) + ', ' + py(s.b) + '\nx = np.linspace(a, b, 200001)\ny = f(x)\nprint("площадь численно:", np.sum((y[1:] + y[:-1]) / 2) * (x[1] - x[0]))\nprint("F(b) − F(a)     :", F(b) - F(a))\n';
    });
    draw();
  });

  GBC.lesson159 = {
    f2, f3, f4, f6, py, sup, powFmt, decades, yDom, simpson, rsum, trap, erf, Phi, pdf, sigma, curve, signedArea, rootsOf, snap, infSup,
    texInto, texEl, card, cardGrid, badge, rowTable, stepList, STARS, vTrip, sTrip, C_POS, C_NEG,
  };
})();
