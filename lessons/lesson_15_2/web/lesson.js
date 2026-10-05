/* Урок 15.2: скорость изменения. Часть 1 — от изменения Δ до мгновенной скорости.
 * Виджеты: поездка со спидометром и «призраком», изменение на числовой прямой, абсолютное и
 * относительное изменение, конечные разности, средняя скорость = наклон секущей, узнаём семейство
 * по разностям, туда-обратно, теорема о среднем, скользящее окно, лупа, сжатие интервала,
 * выколотая точка разностного отношения, односторонние скорости, ошибка округления.
 * Общие помощники выставлены в GBC.lesson152 — ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;

  /* ==============================================================================
   * Общие помощники урока
   * ============================================================================== */
  // Поездка: разгон и торможение, 100 м за 10 с.
  const s = (t) => 3 * t * t - (t * t * t) / 5;
  const v = (t) => 6 * t - 0.6 * t * t;
  const acc = (t) => 6 - 1.2 * t;
  const PY_TRIP = 's = lambda t: 3 * t**2 - t**3 / 5     # путь, м\nv = lambda t: 6 * t - 0.6 * t**2      # спидометр, м/с\n';

  /** Табуляция функции для слоя 'line' (NaN там, где функция не определена). */
  function curve(fn, x0, x1, n = 401) {
    const x = U.linspace(x0, x1, n);
    return { x, y: x.map((t) => {
      const r = fn(t);
      return Number.isFinite(r) ? r : NaN;
    }) };
  }
  /** Центральная разность — численная мгновенная скорость. */
  const slope = (f, x, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);

  /** Формула KaTeX в элементе; если KaTeX ещё грузится — перерисуем по событию mathready. */
  function texInto(el, src, display = false) {
    el._tex = src;
    el.replaceChildren(GBC.math.tex(src, display));
    if (!window.katex && !el._texSub) {
      el._texSub = true;
      GBC.bus.on('mathready', () => el.replaceChildren(GBC.math.tex(el._tex, display)));
    }
  }
  /** Число для TeX: минус — настоящий минус KaTeX. */
  const tnum = (x, d = 4) => U.fmt(x, d).replace('−', '-');
  /** Многочлен c0 + c1·h + c2·h² + … в TeX. */
  function polyTex(cs, v = 'h') {
    let out = '';
    cs.forEach((c, k) => {
      if (Math.abs(c) < 1e-12) return;
      const a = Math.abs(c);
      const coef = k > 0 && Math.abs(a - 1) < 1e-12 ? '' : tnum(a);
      const term = coef + (k === 0 ? '' : k === 1 ? v : v + '^{' + k + '}');
      if (!out) out = (c < 0 ? '-' : '') + term;
      else out += (c < 0 ? ' - ' : ' + ') + term;
    });
    return out || '0';
  }
  const sgnWord = (r, up = 'растёт', down = 'убывает', flat = 'не меняется') => (r > 1e-12 ? up : r < -1e-12 ? down : flat);
  /** Отрезок касательной длиной 2·half по x. */
  const tangentLayer = (f, x, k, half, extra = {}) => Object.assign({ type: 'segments', x1: [x - half], y1: [f(x) - k * half], x2: [x + half], y2: [f(x) + k * half], color: 'tree', width: 2.4, opacity: 1 }, extra);
  /** Прямая через (x0, y0) с наклоном k на отрезке dom. */
  const lineLayer = (x0, y0, k, dom, extra = {}) => Object.assign({ type: 'line', x: dom, y: dom.map((x) => y0 + k * (x - x0)), color: 'aqua', width: 2, hover: false }, extra);

  function card(title) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums' });
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' },
      H('div', { style: 'font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px' }, title), body);
    return { el, body };
  }
  const cardGrid = () => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:4px 0 10px' });

  /** Стрелочный прибор (спидометр) на SVG: set(значение, подпись). */
  function gauge(parent, { max = 20, step = 5, unit = 'м/с', mark = null } = {}) {
    const svg = S('svg', { viewBox: '-6 -6 232 150', role: 'img', 'aria-label': 'Спидометр', style: 'width:100%;max-width:250px;display:block;margin:0 auto' });
    const cx = 110;
    const cy = 112;
    const R = 92;
    const pt = (val, r) => {
      const a = Math.PI * (1 - U.clamp(val, 0, max) / max);
      return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    };
    const arc = (v0, v1, r) => {
      const [x0, y0] = pt(v0, r);
      const [x1, y1] = pt(v1, r);
      return 'M' + x0.toFixed(2) + ',' + y0.toFixed(2) + ' A' + r + ',' + r + ' 0 0 1 ' + x1.toFixed(2) + ',' + y1.toFixed(2);
    };
    svg.appendChild(S('path', { d: arc(0, max, R), style: 'fill:none;stroke:var(--border-strong);stroke-width:10;stroke-linecap:round' }));
    const fill = S('path', { d: '', style: 'fill:none;stroke:var(--c-tree);stroke-width:10;stroke-linecap:round' });
    svg.appendChild(fill);
    for (let k = 0; k <= max + 1e-9; k += step) {
      const [a, b] = pt(k, R - 8);
      const [c, d] = pt(k, R - 18);
      svg.appendChild(S('line', { x1: a, y1: b, x2: c, y2: d, style: 'stroke:var(--ink-2);stroke-width:2' }));
      const [tx, ty] = pt(k, R + 14);
      svg.appendChild(S('text', { x: tx, y: ty + 4, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:11px' }, String(k)));
    }
    if (mark !== null) {
      const [a, b] = pt(mark, R + 7);
      const [c, d] = pt(mark, R - 7);
      svg.appendChild(S('line', { x1: a, y1: b, x2: c, y2: d, style: 'stroke:var(--muted);stroke-width:2;stroke-dasharray:3 2' }));
    }
    const needle = S('line', { x1: cx, y1: cy, x2: cx - R + 30, y2: cy, style: 'stroke:var(--ink);stroke-width:3;stroke-linecap:round;transition:all .12s linear' });
    svg.appendChild(needle);
    svg.appendChild(S('circle', { cx, cy, r: 6, style: 'fill:var(--ink)' }));
    const label = S('text', { x: cx, y: cy + 26, 'text-anchor': 'middle', style: 'fill:var(--ink);font-size:15px;font-weight:650' }, '');
    svg.appendChild(label);
    parent.appendChild(svg);
    return {
      set(val, text) {
        const [x, y] = pt(val, R - 26);
        needle.setAttribute('x2', x.toFixed(2));
        needle.setAttribute('y2', y.toFixed(2));
        fill.setAttribute('d', val > max * 0.004 ? arc(0, val, R) : '');
        label.textContent = text || U.fmt(val, 1) + ' ' + unit;
      },
    };
  }

  /* ==============================================================================
   * 1. Поездка: засечки, спидометр и «призрак» с постоянной скоростью
   * ============================================================================== */
  GBC.widget('car-trip', (el) => {
    const st0 = { k: 0 };
    const N = 100;
    const w = ui.shell(el, { title: 'Поездка: разгон и торможение', sub: 'Нажмите ▶. Сверху — дорога: засечки ставятся каждую секунду, чем дальше они друг от друга, тем быстрее ехала машина. Нижняя полоса — «призрак», всё время едущий 10 м/с.' });
    ui.player(w.controls, { label: 'Время', min: 0, max: N, value: 0, fps: 15, format: (k) => 't = ' + U.fmt(k / 10, 1) + ' с', onChange: (k) => ((st0.k = k), draw()) });
    const ghostT = ui.toggle(w.controls, { label: 'Показать «призрака» (10 м/с)', checked: true, onChange: () => draw() });
    const road = new GBC.Plot(w.main, { height: 140, x: { label: 'положение на дороге, м', domain: [-2, 104] }, y: { label: '', domain: [-1.7, 1.7], ticks: [] }, margin: { left: 20 }, grid: 'x' });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const gBox = H('div', { style: 'display:flex;flex-direction:column;justify-content:center;gap:4px' });
    box.appendChild(gBox);
    gBox.appendChild(H('div', { class: 'widget-sub', style: 'text-align:center;margin:0' }, 'Спидометр (пунктир — средняя за поездку)'));
    const g = gauge(gBox, { max: 20, step: 5, mark: 10 });
    const plot = new GBC.Plot(box, { height: 250, x: { label: 'время t, с', domain: [0, 10] }, y: { label: 'путь s(t), м', domain: [0, 105] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't', label: 'время' }, { key: 's', label: 'пройдено' }, { key: 'avg', label: 'средняя с начала' }, { key: 'v', label: 'спидометр' }, { key: 'gap', label: 'призрак впереди на' }]);
    function draw() {
      const t = st0.k / 10;
      const secs = U.range(Math.floor(t + 1e-9) + 1);
      const ghost = ghostT.checked;
      road.render([
        { type: 'hline', y: 0.75, color: 'axis', width: 10, opacity: 0.45 },
        ghost ? { type: 'hline', y: -0.75, color: 'axis', width: 10, opacity: 0.25 } : null,
        { type: 'segments', x1: secs.map(s), y1: secs.map(() => 0.35), x2: secs.map(s), y2: secs.map(() => 1.15), color: 'ink2', width: 2, opacity: 0.85 },
        ghost ? { type: 'segments', x1: secs.map((k) => 10 * k), y1: secs.map(() => -1.15), x2: secs.map((k) => 10 * k), y2: secs.map(() => -0.35), color: 'muted', width: 2, opacity: 0.7 } : null,
        { type: 'text', items: secs.filter((k) => k >= 1 && (k % 2 === 0 || k === secs.length - 1)).map((k) => ({ x: s(k), y: 1.2, dy: -3, anchor: 'middle', text: k + ' с' })) },
        { type: 'points', x: [s(t)], y: [0.75], color: 'tree', r: 9, tooltip: () => [['машина', U.fmt(s(t), 1) + ' м'], ['t', U.fmt(t, 1) + ' с']] },
        ghost ? { type: 'points', x: [10 * t], y: [-0.75], color: 'muted', r: 8, hollow: true, tooltip: () => [['призрак', U.fmt(10 * t, 1) + ' м']] } : null,
      ]);
      const ts = U.linspace(0, 10, 201);
      const done = ts.filter((x) => x <= t + 1e-9);
      plot.render([
        { type: 'line', x: ts, y: ts.map(s), color: 'muted', width: 1.2, dash: '4 4', hover: false },
        ghost ? { type: 'line', x: [0, 10], y: [0, 100], color: 'ink2', width: 1.6, dash: '6 4', label: 'призрак: 10t', hover: false } : null,
        { type: 'line', x: done, y: done.map(s), color: 'model', width: 2.6, label: 'путь s(t)', hover: false },
        ghost ? { type: 'points', x: [t], y: [10 * t], color: 'muted', r: 5, hollow: true } : null,
        { type: 'points', x: [t], y: [s(t)], color: 'tree', r: 6 },
      ]);
      g.set(v(t), U.fmt(v(t), 1) + ' м/с');
      st.set('t', U.fmt(t, 1) + ' с');
      st.set('s', U.fmt(s(t), 1) + ' м');
      st.set('avg', t > 0 ? U.fmt(s(t) / t, 2) + ' м/с' : '—');
      st.set('v', U.fmt(v(t), 1) + ' м/с = ' + U.fmt(v(t) * 3.6, 1) + ' км/ч');
      st.set('gap', U.fmt(10 * t - s(t), 1) + ' м');
      if (t === 0) note.innerHTML = 'Машина стоит. Нажмите ▶ и следите за расстоянием между засечками.';
      else if (t < 4) note.innerHTML = 'Разгон: засечки расходятся всё шире, график пути загибается вверх. «Призрак» пока впереди — мы стартовали медленнее его.';
      else if (t < 5) note.innerHTML = 'Спидометр уже за 10 м/с: мы едем быстрее «призрака» и догоняем его.';
      else if (t <= 6) note.innerHTML = 'Около 5 с скорость максимальна: 15 м/с (54 км/ч). Ровно в 5 с мы поравнялись с «призраком» — оба проехали 50 м.';
      else if (t < 10) note.innerHTML = 'Торможение: засечки сближаются, график выполаживается. Мы впереди «призрака», но он нагоняет.';
      else note.innerHTML = 'Приехали одновременно: 100 м за 10 с. <b>Средняя</b> скорость 10 м/с — это и есть постоянная скорость «призрака», хотя спидометр показывал и 0, и 15. Средняя скорость прячет подробности.';
    }
    w.pythonAction(() => PY_TRIP + '\nfor t in range(11):\n    print(f"t = {t:2d} с: s = {s(t):6.1f} м, призрак {10 * t:5.1f} м, спидометр {v(t):5.1f} м/с")\nprint("средняя за всю поездку:", s(10) / 10, "м/с")\n');
    draw();
  });

  /* ==============================================================================
   * 2. Изменение Δ: на числовой прямой и для функции
   * ============================================================================== */
  const DELTA_CASES = {
    temp: { label: 'Числа: температура −3 → 5 °C', kind: 'num', a: -3, b: 5, dom: [-10, 10], step: 1, unit: '°C' },
    debt: { label: 'Числа: долг −2000 → −500 ₽', kind: 'num', a: -2000, b: -500, dom: [-2500, 500], step: 100, unit: '₽' },
    loss: { label: 'Числа: потери 2 → 0.5', kind: 'num', a: 2, b: 0.5, dom: [0, 3], step: 0.1, unit: '' },
    sq: { label: 'Функция x²', kind: 'fn', f: (x) => x * x, a: 1, b: 3, dom: [-4, 4], step: 0.5, tex: 'x^2', py: 'x**2' },
    trip: { label: 'Функция: путь машины s(t)', kind: 'fn', f: s, a: 2, b: 4, dom: [0, 10], step: 0.5, tex: 's(t)', py: '3 * x**2 - x**3 / 5' },
  };
  GBC.widget('delta-line', (el) => {
    const st0 = { c: 'temp', a: -3, b: 5 };
    const w = ui.shell(el, { title: 'Изменение: «стало минус было»', sub: 'Тяните точки «было» и «стало». Стрелка идёт от начала к концу; её длина со знаком — изменение Δ. Для функции — две стрелки: Δx по входу и Δf по выходу.' });
    ui.select(w.controls, { label: 'Что меняется', value: st0.c, options: Object.entries(DELTA_CASES).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), (st0.a = DELTA_CASES[k].a), (st0.b = DELTA_CASES[k].b), draw()) });
    ui.button(w.controls, { label: 'Поменять местами', onClick: () => (([st0.a, st0.b] = [st0.b, st0.a]), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: '' }, y: { label: '' } });
    const formula = H('div', { class: 'formula', style: 'margin:6px 0' });
    w.main.appendChild(formula);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'было' }, { key: 'b', label: 'стало' }, { key: 'd', label: 'изменение Δ' }]);
    const snap = (x, C) => Math.round(U.clamp(x, C.dom[0], C.dom[1]) / C.step) * C.step;
    function draw() {
      const C = DELTA_CASES[st0.c];
      const { a, b } = st0;
      if (C.kind === 'num') {
        const d = b - a;
        plot.opts.x.label = 'значение' + (C.unit ? ', ' + C.unit : '');
        plot.opts.y = { label: '', ticks: [] };
        plot.render([
          { type: 'hline', y: 0, color: 'axis', width: 2 },
          C.dom[0] < 0 && C.dom[1] > 0 ? { type: 'vline', x: 0, color: 'muted', dash: '3 3', width: 1 } : null,
          Math.abs(d) > 1e-12 ? { type: 'arrows', x1: [a], y1: [0.45], x2: [b], y2: [0.45], color: d > 0 ? 'pos' : 'neg', width: 3 } : null,
          { type: 'text', items: [{ x: (a + b) / 2, y: 0.45, dy: -10, anchor: 'middle', bold: true, text: 'Δ = ' + (d > 0 ? '+' : '') + U.fmt(d, 3) + (C.unit ? ' ' + C.unit : '') }, { x: a, y: 0, dy: 22, anchor: 'middle', text: 'было' }, { x: b, y: 0, dy: 22, anchor: 'middle', text: 'стало' }] },
          { type: 'points', x: [a, b], y: [0, 0], color: (i) => (i ? 'tree' : 'ink2'), r: 8, draggable: true, onDrag: (i, x) => {
            if (i === 0) st0.a = snap(x, C);
            else st0.b = snap(x, C);
            draw();
          }, tooltip: (i) => [[i ? 'стало' : 'было', U.fmt(i ? st0.b : st0.a, 3)]] },
        ], { x: C.dom, y: [-1, 1] });
        texInto(formula, '\\Delta = ' + tnum(b) + ' - ' + (a < 0 ? '(' + tnum(a) + ')' : tnum(a)) + ' = ' + (d > 0 ? '+' : '') + tnum(d), true);
        st.set('a', U.fmt(a, 3));
        st.set('b', U.fmt(b, 3));
        st.set('d', (d > 0 ? '+' : '') + U.fmt(d, 3) + (C.unit ? ' ' + C.unit : ''));
        note.innerHTML = Math.abs(d) < 1e-12 ? 'Δ = 0: величина вернулась к прежнему значению.'
          : 'Δ ' + (d > 0 ? '&gt; 0 — величина <b>выросла</b>' : '&lt; 0 — величина <b>уменьшилась</b>') + '. ' +
            (st0.c === 'debt' ? 'Баланс отрицательный, но изменение положительное: долг уменьшился. Знак Δ — про направление, а не про знак самих чисел.' : 'Нажмите «Поменять местами»: величина изменения останется прежней, знак перевернётся.');
        return;
      }
      const fa = C.f(a);
      const fb = C.f(b);
      const dx = b - a;
      const df = fb - fa;
      const cv = curve(C.f, C.dom[0], C.dom[1]);
      const [lo, hi] = U.extent(cv.y);
      const pad = (hi - lo) * 0.12;
      const y0 = lo - pad;
      const x0 = C.dom[0];
      plot.opts.x.label = st0.c === 'trip' ? 'вход t, с' : 'вход x';
      plot.opts.y = { label: st0.c === 'trip' ? 'выход s(t), м' : 'выход f(x)' };
      plot.render([
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.2, hover: false },
        { type: 'segments', x1: [a, b, x0, x0], y1: [y0, y0, fa, fb], x2: [a, b, a, b], y2: [fa, fb, fa, fb], color: 'muted', dash: '3 3', width: 1, opacity: 0.8 },
        Math.abs(dx) > 1e-12 ? { type: 'arrows', x1: [a], y1: [y0 + pad * 0.45], x2: [b], y2: [y0 + pad * 0.45], color: 'aqua', width: 2.6 } : null,
        Math.abs(df) > 1e-12 ? { type: 'arrows', x1: [x0 + (C.dom[1] - C.dom[0]) * 0.03], y1: [fa], x2: [x0 + (C.dom[1] - C.dom[0]) * 0.03], y2: [fb], color: df > 0 ? 'pos' : 'neg', width: 2.6 } : null,
        { type: 'text', items: [{ x: (a + b) / 2, y: y0 + pad * 0.45, dy: -7, anchor: 'middle', text: 'Δx = ' + U.fmt(dx, 2) }, { x: x0 + (C.dom[1] - C.dom[0]) * 0.03, y: (fa + fb) / 2, dx: 8, text: 'Δf = ' + U.fmt(df, 3) }] },
        { type: 'points', x: [a, b], y: [fa, fb], color: (i) => (i ? 'tree' : 'ink2'), r: 7, draggable: true, onDrag: (i, x) => {
          if (i === 0) st0.a = snap(x, C);
          else st0.b = snap(x, C);
          draw();
        }, tooltip: (i) => [['x', U.fmt(i ? st0.b : st0.a, 2)], ['f', U.fmt(C.f(i ? st0.b : st0.a), 3)]] },
      ], { x: C.dom, y: [y0, hi + pad] });
      texInto(formula, '\\Delta x = ' + tnum(b) + ' - ' + (a < 0 ? '(' + tnum(a) + ')' : tnum(a)) + ' = ' + tnum(dx) + ',\\qquad \\Delta f = f(' + tnum(b) + ') - f(' + tnum(a) + ') = ' + tnum(fb) + ' - ' + (fa < 0 ? '(' + tnum(fa) + ')' : tnum(fa)) + ' = ' + tnum(df), true);
      st.set('a', 'f(' + U.fmt(a, 2) + ') = ' + U.fmt(fa, 3));
      st.set('b', 'f(' + U.fmt(b, 2) + ') = ' + U.fmt(fb, 3));
      st.set('d', 'Δx = ' + U.fmt(dx, 2) + ', Δf = ' + U.fmt(df, 3));
      note.innerHTML = 'Вход сдвинули на ' + U.fmt(dx, 2) + ', а выход изменился на ' + U.fmt(df, 3) + ' — это <b>разные</b> числа. ' +
        (st0.c === 'sq' ? 'Попробуйте шаг Δx = 2 в разных местах: [1, 3] даёт +8, [−3, −1] даёт −8, [−1, 1] даёт 0. Изменение зависит от того, <em>где</em> шагнуть.' : 'Один и тот же шаг по времени в начале и в середине поездки даёт очень разный путь.');
    }
    w.pythonAction(() => {
      const C = DELTA_CASES[st0.c];
      if (C.kind === 'num') return 'before, after = ' + U.pyNum(st0.a) + ', ' + U.pyNum(st0.b) + '\nprint("Δ =", round(after - before, 6))\n';
      return 'f = lambda x: ' + C.py + '\na, b = ' + U.pyNum(st0.a) + ', ' + U.pyNum(st0.b) + '\nprint("Δx =", b - a, " Δf =", round(f(b) - f(a), 6))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 3. Абсолютное и относительное изменение
   * ============================================================================== */
  GBC.widget('relative-change', (el) => {
    const st0 = { mode: 'one', a: 200, b: 250, p1: 10, p2: -10 };
    const w = ui.shell(el, { title: 'Абсолютное и относительное изменение', sub: '«Одно изменение»: сравните Δ в рублях и в процентах. «Цепочка»: два изменения в процентах подряд — проценты не складываются, а перемножаются.' });
    ui.segmented(w.controls, { label: 'Режим', value: st0.mode, options: [{ value: 'one', label: 'Одно изменение' }, { value: 'chain', label: 'Цепочка' }], onChange: (m) => ((st0.mode = m), sync(), draw()) });
    const oneBox = H('div');
    const chainBox = H('div');
    w.controls.append(oneBox, chainBox);
    ui.slider(oneBox, { label: 'Было', min: 50, max: 1000, step: 10, value: st0.a, format: (x) => x + ' ₽', onInput: (x) => ((st0.a = x), draw()) });
    ui.slider(oneBox, { label: 'Стало', min: 50, max: 1000, step: 10, value: st0.b, format: (x) => x + ' ₽', onInput: (x) => ((st0.b = x), draw()) });
    ui.slider(chainBox, { label: 'Первое изменение', min: -50, max: 100, step: 5, value: st0.p1, format: (x) => (x > 0 ? '+' : '') + x + '%', onInput: (x) => ((st0.p1 = x), draw()) });
    ui.slider(chainBox, { label: 'Второе изменение', min: -50, max: 100, step: 5, value: st0.p2, format: (x) => (x > 0 ? '+' : '') + x + '%', onInput: (x) => ((st0.p2 = x), draw()) });
    const sync = () => {
      oneBox.hidden = st0.mode !== 'one';
      chainBox.hidden = st0.mode !== 'chain';
    };
    sync();
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: '', domain: [-0.6, 2.6], ticks: [] }, y: { label: 'цена, ₽' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'abs', label: 'абсолютное Δ' }, { key: 'rel', label: 'относительное Δ / было' }, { key: 'ratio', label: 'отношение стало / было' }, { key: 'log', label: 'ln(стало / было)' }]);
    function draw() {
      let vals;
      let names;
      if (st0.mode === 'one') {
        vals = [st0.a, st0.b];
        names = ['было', 'стало'];
      } else {
        const m1 = 100 * (1 + st0.p1 / 100);
        vals = [100, m1, m1 * (1 + st0.p2 / 100)];
        names = ['начало', 'после 1-го', 'после 2-го'];
      }
      const xs = vals.map((_, i) => i);
      const first = vals[0];
      const last = vals[vals.length - 1];
      const top = Math.max(...vals) * 1.18;
      plot.render([
        { type: 'bars', x: xs, y: vals, width: 0.6, maxPx: 70, color: (i) => (i === 0 ? 'muted' : 'model'), tooltip: (i) => [[names[i], U.fmt(vals[i], 2) + ' ₽']] },
        { type: 'text', items: vals.map((y, i) => ({ x: i, y, dy: -8, anchor: 'middle', bold: true, text: U.fmt(y, 2) + ' ₽' })).concat(xs.map((i) => ({ x: i, y: 0, dy: 16, anchor: 'middle', text: names[i] }))) },
        st0.mode === 'chain' ? { type: 'hline', y: 100, color: 'ink2', dash: '4 4', width: 1.2, text: 'начальный уровень' } : null,
      ], { y: [0, top] });
      const d = last - first;
      st.set('abs', (d > 0 ? '+' : '') + U.fmt(d, 2) + ' ₽');
      st.set('rel', (d > 0 ? '+' : '') + U.fmt((100 * d) / first, 2) + '%');
      st.set('ratio', U.fmt(last / first, 4));
      st.set('log', U.fmt(Math.log(last / first), 4));
      if (st0.mode === 'one') {
        note.innerHTML = 'Изменение ' + (d >= 0 ? '+' : '') + U.fmt(d, 2) + ' ₽ — это ' + (d >= 0 ? '+' : '') + U.fmt((100 * d) / first, 2) + '% от «было». ' +
          'Обратное изменение (' + U.fmt(st0.b, 2) + ' → ' + U.fmt(st0.a, 2) + ') — это ' + U.fmt((100 * -d) / st0.b, 2) + '%: проценты несимметричны, потому что считаются от разных «было». А логарифм отношения просто меняет знак: ±' + U.fmt(Math.abs(Math.log(st0.b / st0.a)), 4) + '.';
      } else {
        const naive = st0.p1 + st0.p2;
        note.innerHTML = 'Наивная сумма процентов: ' + (naive >= 0 ? '+' : '') + naive + '%. На самом деле: ' + U.fmt(1 + st0.p1 / 100, 3) + ' × ' + U.fmt(1 + st0.p2 / 100, 3) + ' = ' + U.fmt(last / 100, 4) + ', то есть ' + (d >= 0 ? '+' : '') + U.fmt(d, 2) + '%. ' +
          (st0.p1 === -st0.p2 && st0.p1 !== 0 ? 'Рост и падение на одинаковый процент всегда дают убыток: (1 + p)(1 − p) = 1 − p² &lt; 1.' : 'Логарифмы складываются честно: ' + U.fmt(Math.log(1 + st0.p1 / 100), 4) + ' + ' + U.fmt(Math.log(1 + st0.p2 / 100), 4) + ' = ' + U.fmt(Math.log(last / 100), 4) + '.');
      }
    }
    w.pythonAction(() => (st0.mode === 'one'
      ? 'import math\n\nbefore, after = ' + st0.a + ', ' + st0.b + '\nprint("абсолютное:", after - before)\nprint("относительное:", round(100 * (after - before) / before, 2), "%")\nprint("ln отношения:", round(math.log(after / before), 4))\n'
      : 'p1, p2 = ' + st0.p1 / 100 + ', ' + st0.p2 / 100 + '\ntotal = (1 + p1) * (1 + p2) - 1\nprint("наивно:", round(100 * (p1 + p2), 2), "%;  на самом деле:", round(100 * total, 2), "%")\n'));
    draw();
  });

  /* ==============================================================================
   * 4. Конечные разности и их телескопическая сумма
   * ============================================================================== */
  const TEMP = (h) => 14 - 6 * Math.cos((2 * Math.PI * (h - 3)) / 24);
  const TABLES = {
    trip: { label: 'Поездка: путь каждую секунду', xs: U.range(11), f: s, xl: 'время t, с', yl: 'путь, м', unit: 'м', py: 's = lambda t: 3 * t**2 - t**3 / 5\nx = np.arange(11)' },
    temp: { label: 'Температура каждые 3 часа', xs: U.range(9).map((k) => 3 * k), f: TEMP, xl: 'время, ч', yl: 'температура, °C', unit: '°C', py: 's = lambda t: 14 - 6 * np.cos(2 * np.pi * (t - 3) / 24)\nx = np.arange(0, 25, 3)' },
    sq: { label: 'Парабола x² с шагом 1', xs: U.range(8), f: (x) => x * x, xl: 'x', yl: 'x²', unit: '', py: 's = lambda x: x**2\nx = np.arange(8)' },
  };
  GBC.widget('differences-table', (el) => {
    const st0 = { c: 'trip', k: 10, second: false };
    const w = ui.shell(el, { title: 'Разности по таблице и их сумма', sub: 'Каждый оранжевый «подъём» лесенки — разность соседних значений. Нажмите ▶: разности складываются одна за другой, и их сумма всегда равна общему изменению f(конец) − f(начало).' });
    ui.select(w.controls, { label: 'Таблица', value: st0.c, options: Object.entries(TABLES).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), pl.setMax(TABLES[k].xs.length - 1), pl.set(TABLES[k].xs.length - 1), (st0.k = TABLES[k].xs.length - 1), draw()) });
    const pl = ui.player(w.controls, { label: 'Сколько разностей сложили', min: 0, max: 10, value: 10, fps: 2, format: (k) => k + ' шт.', onChange: (k) => ((st0.k = k), draw()) });
    ui.toggle(w.controls, { label: 'Вторые разности (разности разностей)', checked: false, onChange: (c) => ((st0.second = c), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 260, x: { label: '' }, y: { label: '' } });
    const p2 = new GBC.Plot(box, { height: 260, x: { label: '' }, y: { label: 'разность Δ' } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sum', label: 'сумма сложенных Δ' }, { key: 'tot', label: 'f(xₖ) − f(x₀)' }, { key: 'all', label: 'общее изменение' }]);
    function draw() {
      const T = TABLES[st0.c];
      const xs = T.xs;
      const ys = xs.map(T.f);
      const n = xs.length;
      const d = U.range(n - 1).map((i) => ys[i + 1] - ys[i]);
      const d2 = U.range(n - 2).map((i) => d[i + 1] - d[i]);
      const k = Math.min(st0.k, n - 1);
      p1.opts.x.label = T.xl;
      p1.opts.y.label = T.yl;
      p2.opts.x.label = T.xl;
      const hx1 = [];
      const hy = [];
      const hx2 = [];
      for (let i = 0; i < k; i++) {
        hx1.push(xs[i]);
        hy.push(ys[i]);
        hx2.push(xs[i + 1]);
      }
      const cv = curve(T.f, xs[0], xs[n - 1], 200);
      p1.render([
        { type: 'line', x: cv.x, y: cv.y, color: 'muted', width: 1.2, dash: '4 4', hover: false },
        { type: 'segments', x1: hx1, y1: hy, x2: hx2, y2: hy, color: 'ink2', width: 1.4, opacity: 0.8 },
        { type: 'segments', x1: hx2, y1: hy, x2: hx2, y2: hx2.map((_, i) => ys[i + 1]), color: 'tree', width: 3, opacity: 1 },
        { type: 'points', x: xs, y: ys, color: 'model', r: 4.5, tooltip: (i) => [['x', U.fmt(xs[i], 2)], ['f', U.fmt(ys[i], 3)]] },
      ]);
      const mids = U.range(n - 1).map((i) => (xs[i] + xs[i + 1]) / 2);
      const bw = (xs[1] - xs[0]) * 0.7;
      p2.render([
        { type: 'bars', x: mids, y: d, width: bw, maxPx: 40, color: (i) => (i < k ? (d[i] >= 0 ? 'tree' : 'neg') : 'grid'), tooltip: (i) => [['Δ на [' + U.fmt(xs[i], 2) + ', ' + U.fmt(xs[i + 1], 2) + ']', U.fmt(d[i], 3)]] },
        st0.second ? { type: 'points', x: U.range(n - 2).map((i) => xs[i + 1]), y: d2, color: 'aqua', r: 5, label: 'вторые разности', tooltip: (i) => [['Δ²', U.fmt(d2[i], 3)]] } : null,
        st0.second ? { type: 'line', x: U.range(n - 2).map((i) => xs[i + 1]), y: d2, color: 'aqua', width: 1.6, hover: false } : null,
        { type: 'hline', y: 0, color: 'axis' },
      ]);
      tableBox.textContent = '';
      const cols = ['x'].concat(xs.map((x) => U.fmt(x, 2)));
      const rows = [['f'].concat(ys.map((y) => U.fmt(y, 2))), ['Δf', ''].concat(d.map((y) => U.fmt(y, 2)))];
      if (st0.second) rows.push(['Δ²f', '', ''].concat(d2.map((y) => U.fmt(y, 2))));
      ui.table(tableBox, { columns: cols, rows }).style.fontSize = '.8rem';
      const sumK = U.sum(d.slice(0, k));
      st.set('sum', U.fmt(sumK, 3) + (T.unit ? ' ' + T.unit : ''));
      st.set('tot', U.fmt(ys[k] - ys[0], 3));
      st.set('all', U.fmt(ys[n - 1] - ys[0], 3));
      let txt = 'Сложили ' + k + ' разност' + (k === 1 ? 'ь' : k >= 2 && k <= 4 ? 'и' : 'ей') + ': сумма ' + U.fmt(sumK, 3) + ' = f(' + U.fmt(xs[k], 2) + ') − f(' + U.fmt(xs[0], 2) + '). Промежуточные значения сократились — сумма телескопическая. ';
      if (st0.second) {
        txt += st0.c === 'sq' ? 'У параболы вторые разности постоянны (2) — её «почерк».' : st0.c === 'trip' ? 'Вторые разности падают на 1.2 каждую секунду: положительны при разгоне, 0 на пике скорости, отрицательны при торможении — это ускорение (шаг 15).' : 'Вторые разности меняют знак там, где рост температуры сменяется замедлением.';
      } else txt += st0.c === 'temp' ? 'Разности положительны до 15:00 и отрицательны после — температура росла, потом падала.' : 'Высота столбиков — скорость изменения на каждом шаге.';
      note.innerHTML = txt;
    }
    w.pythonAction(() => 'import numpy as np\n\n' + TABLES[st0.c].py + '\nd = np.diff(s(x))\nprint("разности:", np.round(d, 3))\nprint("сумма:", round(d.sum(), 6), "=", round(s(x[-1]) - s(x[0]), 6))\nprint("вторые разности:", np.round(np.diff(d), 3))\n');
    draw();
  });

  /* ==============================================================================
   * 5. Средняя скорость = наклон секущей
   * ============================================================================== */
  const COFFEE = (t) => 22 + 68 * Math.exp(-t / 12);
  const CURVES = {
    trip: { label: 'Поездка s(t), м', f: s, dom: [0, 10], xl: 'время t, с', yl: 'путь, м', unit: 'м/с', a: 2, b: 4, step: 0.25, py: '3 * t**2 - t**3 / 5' },
    uniform: { label: 'Равномерно: 10 м/с', f: (t) => 10 * t, dom: [0, 10], xl: 'время t, с', yl: 'путь, м', unit: 'м/с', a: 2, b: 4, step: 0.25, py: '10 * t' },
    temp: { label: 'Температура за сутки', f: TEMP, dom: [0, 24], xl: 'время, ч', yl: '°C', unit: '°C/ч', a: 3, b: 9, step: 0.5, py: '14 - 6 * np.cos(2 * np.pi * (t - 3) / 24)' },
    coffee: { label: 'Кофе остывает', f: COFFEE, dom: [0, 40], xl: 'время, мин', yl: 'температура, °C', unit: '°C/мин', a: 0, b: 10, step: 0.5, py: '22 + 68 * np.exp(-t / 12)' },
    sq: { label: 'Парабола x²', f: (x) => x * x, dom: [-3, 3], xl: 'x', yl: 'x²', unit: '', a: 1, b: 3, step: 0.25, py: 't**2' },
    loss: { label: 'Потери ½(3 − F)²', f: (F) => 0.5 * (3 - F) * (3 - F), dom: [-1, 6], xl: 'прогноз F', yl: 'потери L(F)', unit: 'на ед. прогноза', a: 1, b: 2, step: 0.25, py: '0.5 * (3 - t)**2' },
  };
  GBC.widget('average-rate', (el) => {
    const st0 = { c: 'trip', a: 2, b: 4, lock: false };
    const w = ui.shell(el, { title: 'Средняя скорость — это наклон секущей', sub: 'Тяните две точки по графику. Пунктирный треугольник: пробег Δx и подъём Δf. Наклон секущей = подъём / пробег = средняя скорость изменения.' });
    ui.select(w.controls, { label: 'Что меняется', value: st0.c, options: Object.entries(CURVES).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), (st0.a = CURVES[k].a), (st0.b = CURVES[k].b), draw()) });
    ui.toggle(w.controls, { label: 'Окно фиксированной ширины (точки едут вместе)', checked: false, onChange: (c) => (st0.lock = c) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'f' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'dx', label: 'Δx (пробег)' }, { key: 'df', label: 'Δf (подъём)' }, { key: 'r', label: 'средняя скорость Δf/Δx' }]);
    function drag(i, x) {
      const C = CURVES[st0.c];
      const xr = Math.round(U.clamp(x, C.dom[0], C.dom[1]) / C.step) * C.step;
      if (st0.lock) {
        const shift = xr - (i === 0 ? st0.a : st0.b);
        const na = st0.a + shift;
        const nb = st0.b + shift;
        if (Math.min(na, nb) >= C.dom[0] - 1e-9 && Math.max(na, nb) <= C.dom[1] + 1e-9) {
          st0.a = na;
          st0.b = nb;
        }
      } else if (i === 0) st0.a = xr;
      else st0.b = xr;
      draw();
    }
    function draw() {
      const C = CURVES[st0.c];
      plot.opts.x.label = C.xl;
      plot.opts.y.label = C.yl;
      const cv = curve(C.f, C.dom[0], C.dom[1], 300);
      const [lo, hi] = U.extent(cv.y);
      const pad = (hi - lo) * 0.1 + 0.5;
      const a = Math.min(st0.a, st0.b);
      const b = Math.max(st0.a, st0.b);
      const fa = C.f(a);
      const fb = C.f(b);
      const r = b - a > 1e-9 ? (fb - fa) / (b - a) : NaN;
      plot.render([
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.2, label: C.label, hover: false },
        Number.isFinite(r) ? lineLayer(a, fa, r, C.dom, { label: 'секущая' }) : null,
        { type: 'segments', x1: [a, b], y1: [fa, fa], x2: [b, b], y2: [fa, fb], color: 'tree', width: 2, dash: '5 4', opacity: 1 },
        { type: 'text', items: [{ x: (a + b) / 2, y: fa, dy: fb >= fa ? 16 : -8, anchor: 'middle', text: 'Δx = ' + U.fmt(b - a, 2) }, { x: b, y: (fa + fb) / 2, dx: 6, text: 'Δf = ' + U.fmt(fb - fa, 2) }] },
        { type: 'points', x: [st0.a, st0.b], y: [C.f(st0.a), C.f(st0.b)], color: 'tree', r: 7, draggable: true, onDrag: drag, tooltip: (i) => [['x', U.fmt(i ? st0.b : st0.a, 2)], ['f', U.fmt(C.f(i ? st0.b : st0.a), 2)]] },
      ], { x: C.dom, y: [lo - pad, hi + pad] });
      st.set('dx', U.fmt(b - a, 2));
      st.set('df', U.fmt(fb - fa, 3));
      st.set('r', Number.isFinite(r) ? U.fmt(r, 3) + (C.unit ? ' ' + C.unit : '') : '—');
      if (!Number.isFinite(r)) note.innerHTML = 'Точки совпали: Δx = 0, делить на ноль нельзя. Что делать, когда интервал «сжимается в точку», — шаг 10.';
      else if (st0.c === 'uniform') note.innerHTML = 'График — прямая, и средняя скорость <b>одна и та же</b> на любом интервале: 10 м/с. Постоянная скорость = линейная функция (шаг 6).';
      else {
        let extra = r > 0 ? 'Положительная — функция в среднем росла.' : r < 0 ? 'Отрицательная — функция в среднем убывала.' : 'Ноль — в среднем не изменилась (хотя внутри могла меняться!).';
        if (st0.c === 'coffee') extra += ' Возьмите окно фиксированной ширины и двигайте его вправо: кофе остывает всё медленнее.';
        if (st0.c === 'loss') extra += ' Минус означает: увеличивая прогноз, мы уменьшаем потери.';
        note.innerHTML = 'С ' + U.fmt(a, 2) + ' по ' + U.fmt(b, 2) + ': f изменилась на ' + U.fmt(fb - fa, 3) + ' за ' + U.fmt(b - a, 2) + ' → в среднем ' + U.fmt(r, 3) + (C.unit ? ' ' + C.unit : '') + ' на каждую единицу входа. ' + extra;
      }
    }
    w.pythonAction(() => {
      const C = CURVES[st0.c];
      return 'import numpy as np\n\nf = lambda t: ' + C.py + '\na, b = ' + U.pyNum(Math.min(st0.a, st0.b)) + ', ' + U.pyNum(Math.max(st0.a, st0.b)) + '\nprint("Δx =", b - a, " Δf =", round(f(b) - f(a), 4))\nprint("средняя скорость:", round((f(b) - f(a)) / (b - a), 4))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 6. Узнаём семейство по разностям: прямая, парабола, экспонента
   * ============================================================================== */
  const PATTERNS = {
    lin: { label: 'прямая 2x + 1', f: (x) => 2 * x + 1, fam: 'lin', py: '2 * x + 1' },
    sq: { label: 'парабола x²', f: (x) => x * x, fam: 'sq', py: 'x**2' },
    exp: { label: 'экспонента 2ˣ', f: (x) => Math.pow(2, x), fam: 'exp', py: '2.0**x' },
    trip: { label: 'путь машины s(t)', f: s, fam: 'cube', py: '3 * x**2 - x**3 / 5' },
    riddle: { label: 'Загадка: угадайте семейство', fam: null },
  };
  const FAM_NAMES = { lin: 'прямая', sq: 'парабола', exp: 'экспонента', cube: 'кубическая' };
  GBC.widget('pattern-detector', (el) => {
    const st0 = { c: 'lin', seed: 3, riddle: null, guess: null, score: 0, tries: 0 };
    const w = ui.shell(el, { title: 'Что постоянно в таблице?', sub: 'Таблица с шагом 1. Столбец, который не меняется, подсвечен — по нему узнаётся семейство функции. В режиме «Загадка» угадайте семейство сами.' });
    ui.select(w.controls, { label: 'Таблица', value: st0.c, options: Object.entries(PATTERNS).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), k === 'riddle' && !st0.riddle ? newRiddle() : draw()) });
    const guessBox = H('div', { style: 'display:grid;gap:6px' });
    w.controls.appendChild(guessBox);
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'x', domain: [-0.3, 6.3] }, y: { label: 'f(x)' } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    function newRiddle() {
      const rng = new GBC.RNG(st0.seed++);
      const fam = ['lin', 'sq', 'exp'][rng.randint(3)];
      const k = [1, 2, 3, -2, 0.5][rng.randint(5)];
      const m = rng.randint(7) - 3;
      let f;
      if (fam === 'lin') f = (x) => k * x + m;
      else if (fam === 'sq') f = (x) => (k / 2) * x * x + (rng.randint(5) - 2) * x + m;
      else {
        const q = [2, 3, 1.5][rng.randint(3)];
        const c = [1, 2, 0.5][rng.randint(3)];
        f = (x) => c * Math.pow(q, x);
      }
      st0.riddle = { fam, f };
      st0.guess = null;
      draw();
    }
    function guess(fam) {
      if (st0.guess !== null) return;
      st0.guess = fam;
      st0.tries++;
      if (fam === st0.riddle.fam) st0.score++;
      draw();
    }
    function draw() {
      const P = PATTERNS[st0.c];
      const isR = st0.c === 'riddle';
      const f = isR ? st0.riddle.f : P.f;
      const fam = isR ? st0.riddle.fam : P.fam;
      const reveal = !isR || st0.guess !== null;
      const xs = U.range(7);
      const ys = xs.map(f);
      const d1 = U.range(6).map((i) => ys[i + 1] - ys[i]);
      const d2 = U.range(5).map((i) => d1[i + 1] - d1[i]);
      const d3 = U.range(4).map((i) => d2[i + 1] - d2[i]);
      const ratio = U.range(6).map((i) => (Math.abs(ys[i]) > 1e-12 ? ys[i + 1] / ys[i] : NaN));
      const isConst = (arr) => arr.every((a) => Math.abs(a - arr[0]) < 1e-9 * Math.max(1, Math.abs(arr[0])));
      const cs = { d1: isConst(d1), d2: isConst(d2), d3: isConst(d3), r: ratio.every(Number.isFinite) && isConst(ratio) };
      guessBox.textContent = '';
      if (isR) {
        ['lin', 'sq', 'exp'].forEach((k) => ui.button(guessBox, { label: FAM_NAMES[k], kind: 'primary', onClick: () => guess(k) }).toggleAttribute('disabled', st0.guess !== null));
        ui.button(guessBox, { label: 'Новая загадка', icon: 'step', onClick: () => newRiddle() });
      }
      plot.render([
        { type: 'segments', x1: xs.slice(0, 6), y1: ys.slice(0, 6), x2: xs.slice(1), y2: ys.slice(1), color: 'aqua', width: 1.6, opacity: 0.8 },
        { type: 'points', x: xs, y: ys, color: 'model', r: 5, tooltip: (i) => [['x', String(i)], ['f', U.fmt(ys[i], 4)]] },
      ]);
      tableBox.textContent = '';
      const mark = (arr, ok) => arr.map((a) => (Number.isFinite(a) ? U.fmt(a, 3) : '—') + (reveal && ok ? ' ✓' : ''));
      const rows = [
        ['f(x)'].concat(ys.map((y) => U.fmt(y, 3))),
        ['Δf'].concat(['']).concat(mark(d1, cs.d1)),
        ['Δ²f'].concat(['', '']).concat(mark(d2, cs.d2 && !cs.d1)),
        ['Δ³f'].concat(['', '', '']).concat(mark(d3, cs.d3 && !cs.d2)),
        ['f(x+1) / f(x)'].concat(['']).concat(mark(ratio, cs.r)),
      ];
      const hl = (i) => reveal && ((i === 1 && cs.d1) || (i === 2 && cs.d2 && !cs.d1) || (i === 3 && cs.d3 && !cs.d2) || (i === 4 && cs.r));
      ui.table(tableBox, { columns: ['x'].concat(xs.map(String)), rows, highlight: hl });
      if (isR && st0.guess === null) note.innerHTML = 'Посмотрите на столбцы разностей и отношений. Какой из них постоянен? Счёт: ' + st0.score + ' из ' + st0.tries + '.';
      else {
        const why = fam === 'lin' ? 'постоянны первые разности — скорость изменения одна и та же, это прямая.'
          : fam === 'sq' ? 'первые разности растут равномерно, а вторые постоянны — это парабола.'
            : fam === 'exp' ? 'разности растут, но постоянно <b>отношение</b> соседних значений — каждое следующее во столько же раз больше. Это экспонента: её скорость пропорциональна величине.'
              : 'постоянны только третьи разности (−1.2) — это кубическая функция.';
        note.innerHTML = (isR ? (st0.guess === fam ? '<b>Верно!</b> ' : '<b>Нет</b>, это ' + FAM_NAMES[fam] + '. ') + 'Счёт: ' + st0.score + ' из ' + st0.tries + '. ' : '') + 'Здесь ' + why;
      }
    }
    w.pythonAction(() => {
      const P = PATTERNS[st0.c];
      const code = P.py || '3 * x**2 + 1  # загадка: подставьте свою функцию';
      return 'import numpy as np\n\nx = np.arange(7)\nf = ' + code + '\nprint("f:  ", np.round(f, 3))\nprint("Δ:  ", np.round(np.diff(f), 3))\nprint("Δ²: ", np.round(np.diff(f, n=2), 3))\nprint("отношения:", np.round(f[1:] / f[:-1], 3))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 7. Туда-обратно: средняя скорость ≠ среднее скоростей
   * ============================================================================== */
  GBC.widget('round-trip', (el) => {
    const st0 = { v1: 60, v2: 40, D: 120 };
    const w = ui.shell(el, { title: 'Туда и обратно', sub: 'Выберите скорости туда и обратно. График — сколько всего проехано к каждому моменту. Наклон бирюзовой секущей от старта до финиша — настоящая средняя скорость; пунктир — машина со «средним арифметическим», она приехала бы раньше.' });
    ui.slider(w.controls, { label: 'Скорость туда', min: 10, max: 120, step: 5, value: st0.v1, format: (x) => x + ' км/ч', onInput: (x) => ((st0.v1 = x), draw()) });
    ui.slider(w.controls, { label: 'Скорость обратно', min: 5, max: 120, step: 5, value: st0.v2, format: (x) => x + ' км/ч', onInput: (x) => ((st0.v2 = x), draw()) });
    ui.slider(w.controls, { label: 'Расстояние в одну сторону', min: 20, max: 200, step: 10, value: st0.D, format: (x) => x + ' км', onInput: (x) => ((st0.D = x), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 270, x: { label: 'время, ч' }, y: { label: 'проехано всего, км' } });
    const p2 = new GBC.Plot(box, { height: 270, x: { label: '', domain: [-0.6, 2.6], ticks: [] }, y: { label: 'км/ч' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't1', label: 'время туда' }, { key: 't2', label: 'время обратно' }, { key: 'avg', label: 'средняя = путь / время' }, { key: 'am', label: 'среднее арифметическое' }]);
    function draw() {
      const { v1, v2, D } = st0;
      const t1 = D / v1;
      const t2 = D / v2;
      const T = t1 + t2;
      const avg = (2 * D) / T;
      const am = (v1 + v2) / 2;
      const tam = (2 * D) / am;
      p1.render([
        { type: 'line', x: [0, t1, T], y: [0, D, 2 * D], color: 'model', width: 2.6, label: 'поездка' },
        { type: 'line', x: [0, T], y: [0, 2 * D], color: 'aqua', width: 2, label: 'секущая: ' + U.fmt(avg, 1) + ' км/ч' },
        { type: 'line', x: [0, tam], y: [0, 2 * D], color: 'ink2', width: 1.6, dash: '6 4', label: 'среднее арифм.: ' + U.fmt(am, 1), hover: false },
        { type: 'vline', x: t1, color: 'muted', dash: '3 3', width: 1, text: 'разворот' },
        { type: 'points', x: [0, t1, T], y: [0, D, 2 * D], color: 'tree', r: 5 },
      ], { x: [0, T * 1.04], y: [0, 2 * D * 1.08] });
      p2.render([
        { type: 'bars', x: [0, 1], y: [am, avg], width: 0.6, maxPx: 70, color: (i) => (i ? 'aqua' : 'grid'), tooltip: (i) => [[i ? 'средняя скорость' : 'среднее арифметическое', U.fmt(i ? avg : am, 2) + ' км/ч']] },
        { type: 'text', items: [{ x: 0, y: am, dy: -8, anchor: 'middle', bold: true, text: U.fmt(am, 1) }, { x: 1, y: avg, dy: -8, anchor: 'middle', bold: true, text: U.fmt(avg, 1) }, { x: 0, y: 0, dy: 16, anchor: 'middle', text: '(v₁ + v₂)/2' }, { x: 1, y: 0, dy: 16, anchor: 'middle', text: 'путь / время' }] },
      ], { y: [0, Math.max(am, avg) * 1.25 + 1] });
      st.set('t1', U.fmt(t1, 2) + ' ч');
      st.set('t2', U.fmt(t2, 2) + ' ч');
      st.set('avg', U.fmt(avg, 2) + ' км/ч');
      st.set('am', U.fmt(am, 2) + ' км/ч');
      note.innerHTML = v1 === v2 ? 'Скорости равны — и средняя совпадает с ними. Разница появляется, только когда скорости разные.'
        : 'Медленный участок длился ' + U.fmt(Math.max(t1, t2), 2) + ' ч, быстрый — ' + U.fmt(Math.min(t1, t2), 2) + ' ч, и медленная скорость «весит» больше. Средняя = 2·v₁·v₂ / (v₁ + v₂) = ' + U.fmt(avg, 2) + ' км/ч — всегда меньше среднего арифметического. Расстояние на ответ не влияет: оно сокращается.' +
          (Math.min(v1, v2) <= 10 ? ' Медленный участок «съедает» всё: даже с бесконечной скоростью на другом участке средняя не превысит 2 × ' + Math.min(v1, v2) + ' км/ч.' : '');
    }
    w.pythonAction(() => 'v1, v2, D = ' + st0.v1 + ', ' + st0.v2 + ', ' + st0.D + '\nT = D / v1 + D / v2\nprint("средняя скорость:", round(2 * D / T, 3), "км/ч")\nprint("среднее арифметическое:", (v1 + v2) / 2)\nprint("формула 2·v1·v2/(v1 + v2):", round(2 * v1 * v2 / (v1 + v2), 3))\n');
    draw();
  });

  /* ==============================================================================
   * 8. Теорема о среднем: где касательная параллельна секущей
   * ============================================================================== */
  const MVT = {
    trip: { label: 'Поездка s(t)', f: s, df: v, dom: [0, 10], a: 0, b: 10, step: 0.25 },
    cubic: { label: 'Кубическая x³ − 3x', f: (x) => x * x * x - 3 * x, df: (x) => 3 * x * x - 3, dom: [-2.2, 2.2], a: -2, b: 2, step: 0.1 },
    temp: { label: 'Температура за сутки', f: TEMP, df: (h) => ((6 * 2 * Math.PI) / 24) * Math.sin((2 * Math.PI * (h - 3)) / 24), dom: [0, 24], a: 0, b: 24, step: 0.5 },
    abs: { label: 'Излом |x|', f: Math.abs, df: (x) => (x > 0 ? 1 : x < 0 ? -1 : NaN), dom: [-2, 2], a: -1, b: 2, step: 0.1, kink: 0 },
    stump: { label: 'Ступенька (решающий пень)', f: (x) => (x < 0 ? 1 : 3), df: (x) => (x === 0 ? NaN : 0), dom: [-2, 2], a: -1, b: 1, step: 0.1, kink: 0 },
  };
  GBC.widget('mean-value', (el) => {
    const st0 = { c: 'trip', a: 0, b: 10 };
    const w = ui.shell(el, { title: 'Теорема о среднем: касательная ∥ секущая', sub: 'Тяните концы отрезка. Бирюзовая секущая — средняя скорость. Оранжевые касательные отмечают моменты, когда мгновенная скорость равна средней. Попробуйте излом и ступеньку.' });
    ui.select(w.controls, { label: 'Функция', value: st0.c, options: Object.entries(MVT).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), (st0.a = MVT[k].a), (st0.b = MVT[k].b), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'средняя скорость' }, { key: 'c', label: 'где мгновенная = средней' }]);
    function roots(g, a, b) {
      const n = 2000;
      const xs = U.linspace(a, b, n + 1).slice(1, -1);
      const out = [];
      for (let i = 1; i < xs.length; i++) {
        const p = g(xs[i - 1]);
        const q = g(xs[i]);
        if (!Number.isFinite(p) || !Number.isFinite(q)) continue;
        if (q === 0) out.push(xs[i]);
        else if (p * q < 0) {
          let lo = xs[i - 1];
          let hi = xs[i];
          for (let k = 0; k < 50; k++) {
            const m = (lo + hi) / 2;
            if (g(lo) * g(m) <= 0) hi = m;
            else lo = m;
          }
          out.push((lo + hi) / 2);
        }
      }
      return out.filter((x, i) => i === 0 || Math.abs(x - out[i - 1]) > 1e-6);
    }
    function draw() {
      const C = MVT[st0.c];
      const a = Math.min(st0.a, st0.b);
      const b = Math.max(st0.a, st0.b);
      const fa = C.f(a);
      const fb = C.f(b);
      const r = b - a > 1e-9 ? (fb - fa) / (b - a) : NaN;
      const span = C.dom[1] - C.dom[0];
      const noKink = C.kink !== undefined && (a >= C.kink || b <= C.kink);
      const cs = !Number.isFinite(r) ? [] : noKink ? ['всюду'] : C.kink !== undefined ? [] : roots((x) => C.df(x) - r, a, b);
      const xs = U.linspace(C.dom[0], C.dom[1], 600);
      const ys = xs.map(C.f);
      if (st0.c === 'stump') for (let i = 1; i < ys.length; i++) if (ys[i] !== ys[i - 1]) ys[i] = NaN;
      const [lo, hi] = U.extent(ys.filter(Number.isFinite));
      const pad = (hi - lo) * 0.15 + 0.3;
      const numC = cs.filter((c) => typeof c === 'number');
      plot.render([
        { type: 'vband', x0: a, x1: b, color: 'aqua', opacity: 0.06 },
        { type: 'line', x: xs, y: ys, color: 'model', width: 2.2, label: C.label, hover: false },
        Number.isFinite(r) ? lineLayer(a, fa, r, C.dom, { label: 'секущая', width: 1.8 }) : null,
        ...numC.map((c, i) => tangentLayer(C.f, c, r, span * 0.14, { width: 2.6, label: i === 0 ? 'касательная ∥ секущей' : null })),
        numC.length ? { type: 'segments', x1: numC, y1: numC.map(() => lo - pad), x2: numC, y2: numC.map(C.f), color: 'tree', dash: '3 3', width: 1, opacity: 0.8 } : null,
        numC.length ? { type: 'points', x: numC, y: numC.map(C.f), color: 'tree', r: 5, tooltip: (i) => [['c', U.fmt(numC[i], 3)], ['скорость', U.fmt(C.df(numC[i]), 3)]] } : null,
        { type: 'points', x: [st0.a, st0.b], y: [C.f(st0.a), C.f(st0.b)], color: 'aqua', r: 7, draggable: true, onDrag: (i, x) => {
          const xr = Math.round(U.clamp(x, C.dom[0], C.dom[1]) / C.step) * C.step;
          if (i === 0) st0.a = xr;
          else st0.b = xr;
          draw();
        } },
      ], { x: C.dom, y: [lo - pad, hi + pad] });
      st.set('r', Number.isFinite(r) ? U.fmt(r, 3) : '—');
      st.set('c', !Number.isFinite(r) ? '—' : cs.length ? (cs[0] === 'всюду' ? 'везде, где нет скачка' : numC.map((c) => 'c ≈ ' + U.fmt(c, 3)).join(', ')) : 'нигде');
      if (!Number.isFinite(r)) note.innerHTML = 'Концы совпали — отрезка нет.';
      else if (noKink) note.innerHTML = 'Отрезок не задевает ' + (st0.c === 'abs' ? 'излом' : 'скачок') + ' в нуле: здесь функция — прямая, и мгновенная скорость в каждой точке равна средней ' + U.fmt(r, 3) + '. Перетащите концы по разные стороны от нуля.';
      else if ((st0.c === 'abs' || st0.c === 'stump') && a < C.kink && b > C.kink && !cs.length) note.innerHTML = 'Равенства нет нигде! Отрезок содержит ' + (st0.c === 'abs' ? 'излом' : 'скачок') + ' в нуле, а там мгновенной скорости нет. Теорема о среднем требует, чтобы функция менялась плавно, — без этого условия она неверна. ' + (st0.c === 'stump' ? 'У пня скорость слева и справа от порога равна 0, а средняя через порог положительна.' : 'Скорость |x| равна только −1 или +1, а средняя — ' + U.fmt(r, 3) + '.');
      else if (st0.c === 'trip' && Math.abs(a) < 1e-9 && Math.abs(b - 10) < 1e-9) note.innerHTML = 'Средняя скорость за поездку 10 м/с, и спидометр показывал ровно 10 м/с дважды: при разгоне (≈ 2.11 с) и при торможении (≈ 7.89 с). Касательные там параллельны секущей.';
      else note.innerHTML = 'Средняя скорость на [' + U.fmt(a, 2) + ', ' + U.fmt(b, 2) + '] равна ' + U.fmt(r, 3) + '. Мгновенная скорость принимает это значение ' + (numC.length === 1 ? 'в одной точке' : 'в ' + numC.length + ' точках') + ' внутри отрезка — касательная там параллельна секущей. Теорема говорит лишь, что такая точка <em>есть</em>, но не где именно.';
    }
    w.pythonAction(() => {
      const a = Math.min(st0.a, st0.b);
      const b = Math.max(st0.a, st0.b);
      return PY_TRIP + '\nimport numpy as np\n\na, b = ' + U.pyNum(a) + ', ' + U.pyNum(b) + '  # для поездки\nr = (s(b) - s(a)) / (b - a)\n# корни v(c) = r: 0.6c² − 6c + r = 0\nc = np.roots([-0.6, 6, -r])\nprint("средняя:", r, " моменты:", np.round(np.sort(c[(c > a) & (c < b)]), 4))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 9. Скользящее окно: средняя скорость в окне всё меньшей ширины
   * ============================================================================== */
  GBC.widget('sliding-window', (el) => {
    const W = [10, 5, 2, 1, 0.5, 0.1];
    const st0 = { wi: 2, k: 20, speed: true };
    const N = 40;
    const w = ui.shell(el, { title: 'Скользящее окно', sub: 'Окно ширины w скользит по времени (▶). В каждом положении считаем среднюю скорость в окне и ставим точку над серединой окна. Уменьшайте ширину — кривая средних превращается в спидометр.' });
    ui.slider(w.controls, { label: 'Ширина окна w', values: W, value: W[st0.wi], format: (x) => U.fmt(x, 2) + ' с', onInput: (x) => ((st0.wi = W.indexOf(x)), draw()) });
    ui.player(w.controls, { label: 'Положение окна', min: 0, max: N, value: st0.k, fps: 8, format: (k) => k + ' / ' + N, onChange: (k) => ((st0.k = k), draw()) });
    ui.toggle(w.controls, { label: 'Показать спидометр v(t)', checked: true, onChange: (c) => ((st0.speed = c), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 270, x: { label: 'время t, с', domain: [0, 10] }, y: { label: 'путь s(t), м', domain: [-5, 105] } });
    const p2 = new GBC.Plot(box, { height: 270, x: { label: 'середина окна, с', domain: [0, 10] }, y: { label: 'средняя скорость в окне, м/с', domain: [-0.5, 16.5] } });
    const note = w.note('', true);
    function draw() {
      const wd = W[st0.wi];
      const lo = wd / 2;
      const hi = 10 - wd / 2;
      const c = hi > lo ? lo + ((hi - lo) * st0.k) / N : 5;
      const a = c - wd / 2;
      const b = c + wd / 2;
      const r = (s(b) - s(a)) / wd;
      const cs = hi > lo ? U.linspace(lo, hi, 200) : [5];
      const rs = cs.map((x) => (s(x + wd / 2) - s(x - wd / 2)) / wd);
      const ts = U.linspace(0, 10, 201);
      p1.render([
        { type: 'vband', x0: a, x1: b, color: 'aqua', opacity: 0.12 },
        { type: 'line', x: ts, y: ts.map(s), color: 'model', width: 2.2, hover: false },
        lineLayer(a, s(a), r, [Math.max(0, a - 1.5), Math.min(10, b + 1.5)], { width: 2.2 }),
        { type: 'points', x: [a, b], y: [s(a), s(b)], color: 'aqua', r: 5 },
      ]);
      p2.render([
        st0.speed ? { type: 'line', x: ts, y: ts.map(v), color: 'tree', width: 1.8, dash: '6 4', label: 'спидометр v(t)', hover: false } : null,
        cs.length > 1 ? { type: 'line', x: cs, y: rs, color: 'aqua', width: 2.4, label: 'средняя в окне ' + U.fmt(wd, 2) + ' с' } : { type: 'points', x: cs, y: rs, color: 'aqua', r: 6, label: 'средняя за всю поездку' },
        { type: 'points', x: [c], y: [r], color: 'aqua', r: 6, tooltip: () => [['окно', '[' + U.fmt(a, 2) + ', ' + U.fmt(b, 2) + ']'], ['средняя', U.fmt(r, 3) + ' м/с']] },
      ]);
      const maxErr = Math.max(...cs.map((x, i) => Math.abs(rs[i] - v(x))));
      note.innerHTML = wd === 10 ? 'Окно во всю поездку: одно число — 10 м/с. Подробностей никаких.'
        : 'Окно [' + U.fmt(a, 2) + ', ' + U.fmt(b, 2) + '] с: средняя скорость ' + U.fmt(r, 3) + ' м/с, спидометр в середине окна ' + U.fmt(v(c), 3) + ' м/с. Наибольшее расхождение кривых при этой ширине — ' + U.fmt(maxErr, 4) + ' м/с' + (wd <= 0.1 ? ': глазом уже не отличить. Средние скорости по узким окнам и есть мгновенная скорость.' : '. Уменьшайте окно.');
    }
    w.pythonAction(() => 'import numpy as np\n\n' + PY_TRIP + '\nfor w in [10, 2, 0.5, 0.1]:\n    c = np.linspace(w / 2, 10 - w / 2, 201)\n    avg = (s(c + w / 2) - s(c - w / 2)) / w\n    print(f"w = {w:<4} макс. отличие от спидометра: {np.max(np.abs(avg - v(c))):.5f} м/с")\n');
    draw();
  });

  /* ==============================================================================
   * 10. Лупа: гладкая кривая вблизи выглядит прямой
   * ============================================================================== */
  const ZOOMS = {
    trip: { label: 'Поездка s(t) около t = 2', f: s, x0: 2, W: 2, rate: 9.6 },
    sq: { label: 'x² около x = 1', f: (x) => x * x, x0: 1, W: 1.5, rate: 2 },
    sin: { label: 'sin x около x = 1', f: Math.sin, x0: 1, W: 2.5, rate: Math.cos(1) },
    abs: { label: '|x| около x = 0 (излом)', f: Math.abs, x0: 0, W: 1.5, rate: NaN },
  };
  GBC.widget('zoom-in', (el) => {
    const Z = [1, 2, 5, 10, 20, 50, 100, 1000, 10000];
    const st0 = { c: 'trip', z: 1 };
    const w = ui.shell(el, { title: 'Кривая под лупой', sub: 'Увеличивайте масштаб вокруг отмеченной точки. Масштаб по вертикали подстраивается сам. Гладкая кривая выпрямляется и сливается с бирюзовой пунктирной секущей окна; излом остаётся изломом при любом увеличении.' });
    ui.select(w.controls, { label: 'Функция и точка', value: st0.c, options: Object.entries(ZOOMS).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), draw()) });
    ui.slider(w.controls, { label: 'Увеличение', values: Z, value: st0.z, format: (x) => '×' + x, onInput: (x) => ((st0.z = x), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'f(x)' }, margin: { left: 66 } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'окно по x' }, { key: 'k', label: 'наклон секущей окна' }, { key: 'dev', label: 'изгиб: отклонение от прямой' }]);
    function draw() {
      const C = ZOOMS[st0.c];
      const half = C.W / st0.z;
      const a = C.x0 - half;
      const b = C.x0 + half;
      const cv = curve(C.f, a, b, 400);
      const [lo, hi] = U.extent(cv.y);
      const pad = (hi - lo) * 0.12 || 1e-6;
      const k = (C.f(b) - C.f(a)) / (b - a);
      const dev = Math.max(...cv.x.map((x, i) => Math.abs(cv.y[i] - (C.f(a) + k * (x - a)))));
      const devRel = hi - lo > 0 ? dev / (hi - lo) : 0;
      plot.opts.x.format = (x) => U.fmt(x, Math.max(3, Math.ceil(Math.log10(st0.z)) + 2));
      plot.opts.y.format = (y) => U.fmt(y, Math.max(3, Math.ceil(Math.log10(st0.z)) + 3));
      plot.render([
        lineLayer(a, C.f(a), k, [a, b], { width: 1.8, dash: '6 4', label: 'секущая окна' }),
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.4, label: C.label, hover: false },
        { type: 'points', x: [C.x0], y: [C.f(C.x0)], color: 'tree', r: 6 },
      ], { x: [a, b], y: [lo - pad, hi + pad] });
      st.set('w', '±' + U.fmt(half, 5));
      st.set('k', U.fmt(k, 6));
      st.set('dev', U.fmt(100 * devRel, 3) + '% высоты окна');
      note.innerHTML = st0.c === 'abs'
        ? 'При любом увеличении картинка одна и та же — «галочка». Секущая окна горизонтальна (наклон 0), а кривая отходит от неё на 100% высоты окна. Единого наклона у излома нет: слева он −1, справа +1.'
        : 'При ×' + st0.z + ' кривая отходит от прямой на ' + U.fmt(100 * devRel, 3) + '% высоты окна' + (st0.z >= 100 ? ' — глазом это уже прямая.' : '.') + ' Наклон секущей окна ' + U.fmt(k, 6) + ' подходит к ' + U.fmt(C.rate, 6) + ' — мгновенной скорости в этой точке. Увеличение в 10 раз уменьшает изгиб примерно в 10 раз.';
    }
    w.pythonAction(() => 'import numpy as np\n\nf = lambda x: np.sin(x)\nx0 = 1\nfor z in [1, 10, 100, 1000]:\n    half = 2.5 / z\n    a, b = x0 - half, x0 + half\n    k = (f(b) - f(a)) / (b - a)\n    xs = np.linspace(a, b, 401)\n    dev = np.max(np.abs(f(xs) - (f(a) + k * (xs - a)))) / np.ptp(f(xs))\n    print(f"×{z:<5} наклон секущей {k:.6f}, изгиб {100 * dev:.4f}% высоты окна")\nprint("cos(1) =", np.cos(1))\n');
    draw();
  });

  /* ==============================================================================
   * 11. Сжимаем интервал: справа, слева, по центру
   * ============================================================================== */
  GBC.widget('shrink-interval', (el) => {
    const st0 = { t: 2, k: 0, mode: 'right' };
    const NK = 40;
    const hOf = (k) => 2 * Math.pow(10, (-3 * k) / NK);
    const w = ui.shell(el, { title: 'Сжимаем интервал до точки', sub: 'Средняя скорость на интервале длины h около момента t. Нажмите ▶: h уменьшается от 2 с до 0.002 с, и все три средние подходят к показанию спидометра.' });
    ui.slider(w.controls, { label: 'Момент t, с', min: 2, max: 8, step: 0.5, value: st0.t, onInput: (x) => ((st0.t = x), draw()) });
    ui.player(w.controls, { label: 'Сужаем h', min: 0, max: NK, value: 0, fps: 6, format: (k) => 'h = ' + U.fmt(hOf(k), 3), onChange: (k) => ((st0.k = k), draw()) });
    ui.segmented(w.controls, { label: 'Интервал на графике пути', value: st0.mode, options: [{ value: 'right', label: 'справа' }, { value: 'left', label: 'слева' }, { value: 'center', label: 'по центру' }], onChange: (m) => ((st0.mode = m), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 280, x: { label: 'время t, с', domain: [0, 10] }, y: { label: 'путь, м', domain: [-5, 105] } });
    const p2 = new GBC.Plot(box, { height: 280, x: { label: 'длина интервала h, с (лог. шкала)', type: 'log', domain: [0.002, 2], ticks: [0.002, 0.01, 0.1, 1] }, y: { label: 'средняя скорость, м/с' } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    const R = (t, h) => (s(t + h) - s(t)) / h;
    const L = (t, h) => (s(t) - s(t - h)) / h;
    const Cn = (t, h) => (s(t + h) - s(t - h)) / (2 * h);
    function draw() {
      const t = st0.t;
      const h = hOf(st0.k);
      const [a, b] = st0.mode === 'right' ? [t, t + h] : st0.mode === 'left' ? [t - h, t] : [t - h, t + h];
      const r = (s(b) - s(a)) / (b - a);
      const ts = U.linspace(0, 10, 201);
      p1.render([
        { type: 'line', x: ts, y: ts.map(s), color: 'model', width: 2.2, label: 's(t)', hover: false },
        lineLayer(a, s(a), r, [0, 10], { label: 'секущая' }),
        lineLayer(t, s(t), v(t), [0, 10], { color: 'tree', width: 1.6, dash: '6 4', label: 'касательная' }),
        { type: 'points', x: [a, b], y: [s(a), s(b)], color: 'aqua', r: 5 },
        { type: 'points', x: [t], y: [s(t)], color: 'tree', r: 5 },
      ]);
      const hs = U.range(NK + 1).map(hOf);
      p2.render([
        { type: 'line', x: hs, y: hs.map((x) => R(t, x)), color: 'aqua', width: 2.2, label: 'справа' },
        { type: 'line', x: hs, y: hs.map((x) => L(t, x)), color: 'violet', width: 2.2, label: 'слева' },
        { type: 'line', x: hs, y: hs.map((x) => Cn(t, x)), color: 'model', width: 2.2, label: 'по центру' },
        { type: 'hline', y: v(t), color: 'tree', dash: '6 4', text: 'спидометр ' + U.fmt(v(t), 3) },
        { type: 'points', x: [h, h, h], y: [R(t, h), L(t, h), Cn(t, h)], color: (i) => ['aqua', 'violet', 'model'][i], r: 5, tooltip: (i) => [[['справа', 'слева', 'по центру'][i], U.fmt([R, L, Cn][i](t, h), 6)]] },
      ]);
      tableBox.textContent = '';
      const hv = [1, 0.5, 0.1, 0.01, 0.001];
      ui.table(tableBox, { columns: ['h, с', 'справа', 'слева', 'по центру'], rows: hv.map((x) => [U.fmt(x, 3), U.fmt(R(t, x), 7), U.fmt(L(t, x), 7), U.fmt(Cn(t, x), 8)]) });
      const acc0 = acc(t);
      note.innerHTML = 'Все три подходят к ' + U.fmt(v(t), 4) + ' м/с. ' +
        (Math.abs(acc0) < 1e-9 ? 'В момент 5 с скорость максимальна и не меняется — правая и левая средние совпадают.'
          : acc0 > 0 ? 'Машина разгоняется, поэтому правая средняя (после момента t) больше, а левая — меньше.' : 'Машина тормозит, поэтому правая средняя меньше, а левая — больше.') +
        ' Центральная ошибается на 0.2h² вместо ~h — при h = 0.01 это 0.00002. Поставить h = 0 нельзя: получится 0/0 (урок 15.3 о пределах).';
    }
    w.pythonAction(() => PY_TRIP + '\nt = ' + U.pyNum(st0.t) + '\nfor h in [1, 0.5, 0.1, 0.01, 0.001]:\n    right = (s(t + h) - s(t)) / h\n    left = (s(t) - s(t - h)) / h\n    center = (s(t + h) - s(t - h)) / (2 * h)\n    print(f"h = {h:<6} справа {right:.6f}  слева {left:.6f}  центр {center:.7f}")\nprint("спидометр:", v(t))\n');
    draw();
  });

  /* ==============================================================================
   * 12. Разностное отношение как функция h: выколотая точка
   * ============================================================================== */
  const QFUN = {
    const: { label: 'Константа 5', f: () => 5, a: 1, dom: [-3, 3], H: 2, q: () => [0], rate: () => 0, tex: '5', py: '5 + 0 * x' },
    lin: { label: 'Прямая 3x + 2', f: (x) => 3 * x + 2, a: 1, dom: [-3, 3], H: 2, q: () => [3], rate: () => 3, tex: '3x + 2', py: '3 * x + 2' },
    sq: { label: 'Парабола x²', f: (x) => x * x, a: 3, dom: [-4, 4], H: 2, q: (a) => [2 * a, 1], rate: (a) => 2 * a, tex: 'x^2', py: 'x**2' },
    cube: { label: 'Кубическая x³', f: (x) => x * x * x, a: 1, dom: [-2, 2], H: 1.5, q: (a) => [3 * a * a, 3 * a, 1], rate: (a) => 3 * a * a, tex: 'x^3', py: 'x**3' },
    recip: { label: 'Гипербола 1/x', f: (x) => 1 / x, a: 2, dom: [0.5, 4], H: 1.5, rate: (a) => -1 / (a * a), qTex: (a) => '-\\dfrac{1}{' + tnum(a) + '\\,(' + tnum(a) + ' + h)}', tex: '\\dfrac1x', py: '1 / x' },
    sqrt: { label: 'Корень √x', f: Math.sqrt, a: 4, dom: [0.5, 9], H: 3, rate: (a) => 1 / (2 * Math.sqrt(a)), qTex: (a) => '\\dfrac{1}{\\sqrt{' + tnum(a) + ' + h} + ' + tnum(Math.sqrt(a)) + '}', tex: '\\sqrt{x}', py: 'np.sqrt(x)' },
    trip: { label: 'Поездка s(t)', f: s, a: 2, dom: [0.5, 9.5], H: 2, q: (a) => [6 * a - 0.6 * a * a, 3 - 0.6 * a, -0.2], rate: v, tex: 's(t)', py: '3 * x**2 - x**3 / 5' },
  };
  GBC.widget('quotient-hole', (el) => {
    const st0 = { c: 'sq', a: 3, h: 0.5 };
    const w = ui.shell(el, { title: 'Разностное отношение и выколотая точка', sub: 'Выберите функцию и точку a. Сверху — упрощённое разностное отношение. Справа — его график как функции от h: при h = 0 оно не определено (0/0), на графике там дырка. Её высота — мгновенная скорость.' });
    ui.select(w.controls, { label: 'Функция', value: st0.c, options: Object.entries(QFUN).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), (st0.a = QFUN[k].a), aSl.el.remove(), mkA(), draw()) });
    const aBox = H('div');
    w.controls.appendChild(aBox);
    let aSl;
    function mkA() {
      const C = QFUN[st0.c];
      aSl = ui.slider(aBox, { label: 'Точка a', min: C.dom[0] + (st0.c === 'recip' || st0.c === 'sqrt' ? 0.5 : 0), max: C.dom[1] - (st0.c === 'trip' ? 0 : 0), step: 0.5, value: st0.a, onInput: (x) => ((st0.a = x), draw()) });
    }
    mkA();
    ui.slider(w.controls, { label: 'Шаг h', min: -1, max: 1, step: 0.05, value: st0.h, format: (x) => U.fmt(x, 2), onInput: (x) => ((st0.h = x), draw()) });
    const formula = H('div', { class: 'formula', style: 'margin:4px 0 8px' });
    w.main.appendChild(formula);
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 270, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(box, { height: 270, x: { label: 'шаг h' }, y: { label: 'разностное отношение q(h)' } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    function draw() {
      const C = QFUN[st0.c];
      const a = st0.a;
      const fa = C.f(a);
      const Hm = Math.min(C.H, st0.c === 'recip' || st0.c === 'sqrt' ? 0.9 * (a - (st0.c === 'recip' ? 0.1 : 0)) : C.H);
      const h = U.clamp(st0.h, -Hm, Hm);
      const q = (x) => (C.f(a + x) - fa) / x;
      const rate = C.rate(a);
      const qT = C.q ? polyTex(C.q(a)) : C.qTex(a);
      texInto(formula, 'f(x) = ' + C.tex + ',\\quad \\frac{f(' + tnum(a) + ' + h) - f(' + tnum(a) + ')}{h} = ' + qT + '\\;\\xrightarrow[h \\to 0]{}\\; ' + tnum(rate, 4), true);
      const cv = curve(C.f, C.dom[0], C.dom[1], 300);
      const [lo, hi] = U.extent(cv.y);
      const pad = (hi - lo) * 0.1 + 0.5;
      const okH = Math.abs(h) > 1e-9;
      p1.render([
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.2, hover: false },
        okH ? lineLayer(a, fa, q(h), C.dom, { label: 'секущая, шаг h' }) : null,
        lineLayer(a, fa, rate, C.dom, { color: 'tree', width: 1.6, dash: '6 4', label: 'касательная' }),
        { type: 'points', x: okH ? [a, a + h] : [a], y: okH ? [fa, C.f(a + h)] : [fa], color: 'aqua', r: 5 },
      ], { x: C.dom, y: [lo - pad, hi + pad] });
      const hs = U.linspace(-Hm, Hm, 401).filter((x) => Math.abs(x) > 1e-9);
      const left = hs.filter((x) => x < 0);
      const right = hs.filter((x) => x > 0);
      const qs = hs.map(q);
      const [qlo, qhi] = U.extent(qs.concat([rate]));
      const qpad = (qhi - qlo) * 0.15 + 0.3;
      p2.render([
        { type: 'line', x: left, y: left.map(q), color: 'aqua', width: 2.4, label: 'q(h)' },
        { type: 'line', x: right, y: right.map(q), color: 'aqua', width: 2.4, hover: false },
        { type: 'vline', x: 0, color: 'muted', dash: '3 3', width: 1 },
        okH ? { type: 'points', x: [h], y: [q(h)], color: 'aqua', r: 6, tooltip: () => [['h', U.fmt(h, 3)], ['q(h)', U.fmt(q(h), 6)]] } : null,
        { type: 'points', x: [0], y: [rate], color: 'tree', r: 6, hollow: true, tooltip: () => [['h = 0', 'не определено: 0/0'], ['высота дырки', U.fmt(rate, 6)]] },
        { type: 'text', items: [{ x: 0, y: rate, dx: 10, dy: -10, text: 'дырка: ' + U.fmt(rate, 4) }] },
      ], { x: [-Hm, Hm], y: [qlo - qpad, qhi + qpad] });
      tableBox.textContent = '';
      const hv = [-0.1, -0.01, -0.001, 0.001, 0.01, 0.1].filter((x) => Math.abs(x) < Hm);
      ui.table(tableBox, { columns: ['h'].concat(hv.map((x) => U.fmt(x, 3))), rows: [['q(h)'].concat(hv.map((x) => U.fmt(q(x), 6)))] });
      note.innerHTML = (st0.c === 'const' || st0.c === 'lin')
        ? 'У ' + (st0.c === 'const' ? 'константы' : 'прямой') + ' разностное отношение одно и то же при любом h — график q(h) горизонтален. И всё равно в нуле дырка: 0/0 не определено даже здесь. Но дырку очевидно «заткнуть» значением ' + U.fmt(rate, 3) + '.'
        : 'При h = ' + U.fmt(h, 2) + ' разностное отношение ' + (okH ? U.fmt(q(h), 5) : 'не определено') + '. Чем ближе h к нулю (с любой стороны), тем ближе q(h) к ' + U.fmt(rate, 5) + '. Это и есть мгновенная скорость: значение, которым естественно заполнить дырку. Само q(0) не существует — строго это обсуждается в уроке о пределах.';
    }
    w.pythonAction(() => {
      const C = QFUN[st0.c];
      return 'import numpy as np\n\nf = lambda x: ' + C.py + '\na = ' + U.pyNum(st0.a) + '\nfor h in [0.1, 0.01, 0.001, -0.001, -0.01, -0.1]:\n    print(f"h = {h:<7} q(h) = {(f(a + h) - f(a)) / h:.6f}")\nprint("мгновенная скорость:", ' + U.pyNum(C.rate(st0.a)) + ')\n';
    });
    draw();
  });

  /* ==============================================================================
   * 13. Когда мгновенной скорости нет: излом, скачок, вертикаль
   * ============================================================================== */
  const ONES = {
    sq: { label: 'Гладкая: x²', f: (x) => x * x, verdict: 'есть, равна 0' },
    abs: { label: 'Излом: |x|', f: Math.abs, verdict: 'нет: справа 1, слева −1' },
    stump: { label: 'Скачок: ступенька 1 → 3 (пень)', f: (x) => (x < 0 ? 1 : 3), verdict: 'нет: слева средняя уходит в бесконечность' },
    cbrt: { label: 'Вертикаль: ∛x', f: Math.cbrt, verdict: 'нет: обе средние уходят в бесконечность' },
  };
  GBC.widget('one-sided', (el) => {
    const st0 = { c: 'abs', k: 10 };
    const NK = 30;
    const hOf = (k) => Math.pow(10, -k / 10);
    const w = ui.shell(el, { title: 'Справа и слева в точке 0', sub: 'Бирюзовая секущая — интервал справа [0, h], фиолетовая — слева [−h, 0]. Уменьшайте h и смотрите, сходятся ли две средние скорости к одному числу.' });
    ui.select(w.controls, { label: 'Функция', value: st0.c, options: Object.entries(ONES).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), draw()) });
    ui.player(w.controls, { label: 'Сужаем h', min: 0, max: NK, value: st0.k, fps: 5, format: (k) => 'h = ' + U.fmt(hOf(k), 3), onChange: (k) => ((st0.k = k), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 270, x: { label: 'x', domain: [-1.5, 1.5] }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(box, { height: 270, x: { label: 'h (лог. шкала)', type: 'log', domain: [0.001, 1], ticks: [0.001, 0.01, 0.1, 1] }, y: { label: 'средняя скорость', domain: [-2.5, 12] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'справа' }, { key: 'l', label: 'слева' }, { key: 'v', label: 'мгновенная скорость' }]);
    function draw() {
      const C = ONES[st0.c];
      const f = C.f;
      const h = hOf(st0.k);
      const R = (x) => (f(x) - f(0)) / x;
      const Lq = (x) => (f(0) - f(-x)) / x;
      const xs = U.linspace(-1.5, 1.5, 601);
      const ys = xs.map(f);
      if (st0.c === 'stump') for (let i = 1; i < ys.length; i++) if (ys[i] !== ys[i - 1]) ys[i] = NaN;
      const r = R(h);
      const l = Lq(h);
      p1.render([
        { type: 'line', x: xs, y: ys, color: 'model', width: 2.4, hover: false },
        st0.c === 'stump' ? { type: 'points', x: [0], y: [3], color: 'model', r: 5 } : null,
        st0.c === 'stump' ? { type: 'points', x: [0], y: [1], color: 'model', r: 5, hollow: true } : null,
        lineLayer(0, f(0), r, [-1.5, 1.5], { label: 'справа' }),
        lineLayer(0, f(0), l, [-1.5, 1.5], { color: 'violet', label: 'слева' }),
        { type: 'points', x: [h, -h, 0], y: [f(h), f(-h), f(0)], color: (i) => ['aqua', 'violet', 'tree'][i], r: 5 },
      ], { y: st0.c === 'stump' ? [-0.5, 4.5] : st0.c === 'cbrt' ? [-1.6, 1.6] : [-0.3, 2.3] });
      const hs = U.range(NK + 1).map(hOf);
      const clip = (y) => (y > 12 || y < -2.5 ? NaN : y);
      p2.render([
        { type: 'line', x: hs, y: hs.map((x) => clip(R(x))), color: 'aqua', width: 2.4, label: 'справа' },
        { type: 'line', x: hs, y: hs.map((x) => clip(Lq(x))), color: 'violet', width: 2.4, label: 'слева' },
        { type: 'points', x: [h, h], y: [clip(r), clip(l)], color: (i) => (i ? 'violet' : 'aqua'), r: 5 },
        { type: 'hline', y: 0, color: 'axis' },
      ]);
      st.set('r', U.fmt(r, 4));
      st.set('l', U.fmt(l, 4));
      st.set('v', C.verdict);
      note.innerHTML = {
        sq: 'Правая средняя равна h, левая −h: обе подходят к 0. Секущие с двух сторон прижимаются к одной горизонтальной касательной — скорость в нуле существует и равна 0.',
        abs: 'Справа средняя всегда 1, слева всегда −1, при любом h. Двух разных «касательных» не бывает — мгновенной скорости в изломе нет. Так устроены абсолютные потери |y − F| в точке F = y.',
        stump: 'Справа функция постоянна — средняя 0. Слева секущая перепрыгивает скачок высотой 2: средняя 2/h = ' + U.fmt(l, 4) + ' и растёт без предела. Так ведёт себя дерево решений на пороге разбиения: скорости по признаку там нет.',
        cbrt: 'Обе средние равны h^(−2/3) = ' + U.fmt(r, 4) + ' и неограниченно растут: касательная в нуле вертикальна, её наклон «бесконечен». Конечной мгновенной скорости нет.',
      }[st0.c];
    }
    w.pythonAction(() => 'import numpy as np\n\nf = ' + { sq: 'lambda x: x**2', abs: 'abs', stump: 'lambda x: 1 if x < 0 else 3', cbrt: 'np.cbrt' }[st0.c] + '\nfor h in [0.1, 0.01, 0.001]:\n    right = (f(h) - f(0)) / h\n    left = (f(0) - f(-h)) / h\n    print(f"h = {h:<6} справа {right:10.4f}   слева {left:10.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * 14. Численная скорость: ошибка метода против ошибки округления
   * ============================================================================== */
  const FLOATS = {
    trip: { label: 'Поездка s(t) в t = 2 (точно 9.6)', f: s, x: 2, exact: 9.6, py: 'f = lambda t: 3 * t * t - t * t * t / 5\nx, exact = 2.0, 9.6' },
    sin: { label: 'sin x в x = 1 (точно cos 1)', f: Math.sin, x: 1, exact: Math.cos(1), py: 'f = np.sin\nx, exact = 1.0, np.cos(1.0)' },
    exp: { label: 'eˣ в x = 0 (точно 1)', f: Math.exp, x: 0, exact: 1, py: 'f = np.exp\nx, exact = 0.0, 1.0' },
  };
  GBC.widget('float-error', (el) => {
    const st0 = { c: 'trip', k: 8 };
    const w = ui.shell(el, { title: 'Как маленькое h портит ответ', sub: 'Ошибка численной скорости в зависимости от h (обе оси логарифмические). Справа налево: сначала ошибка падает (метод точнее), потом растёт (ошибки округления делятся на крошечное h).' });
    ui.select(w.controls, { label: 'Функция', value: st0.c, options: Object.entries(FLOATS).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), draw()) });
    ui.slider(w.controls, { label: 'h = 10^(−k)', min: 1, max: 16, step: 1, value: st0.k, format: (k) => 'k = ' + k, onInput: (k) => ((st0.k = k), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'шаг h', type: 'log', domain: [1e-16, 1], ticks: [1e-16, 1e-12, 1e-8, 1e-4, 1] }, y: { label: 'ошибка (лог. шкала)', type: 'log', domain: [1e-14, 100], ticks: [1e-12, 1e-8, 1e-4, 1] }, margin: { left: 64 } });
    const out = H('pre', { style: 'margin:6px 0;font-size:.85rem;white-space:pre-wrap' });
    w.main.appendChild(out);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'справа: значение / ошибка' }, { key: 'c', label: 'по центру: значение / ошибка' }]);
    const floor = (e) => Math.max(e, 1e-14);
    function draw() {
      const C = FLOATS[st0.c];
      const { f, x, exact } = C;
      const fw = (h) => (f(x + h) - f(x)) / h;
      const ce = (h) => (f(x + h) - f(x - h)) / (2 * h);
      const hs = U.range(65).map((k) => Math.pow(10, -k / 4));
      const h = Math.pow(10, -st0.k);
      const ef = hs.map((t) => floor(Math.abs(fw(t) - exact)));
      const ec = hs.map((t) => floor(Math.abs(ce(t) - exact)));
      plot.render([
        { type: 'line', x: hs, y: ef, color: 'aqua', width: 2.2, label: 'справа' },
        { type: 'line', x: hs, y: ec, color: 'model', width: 2.2, label: 'по центру' },
        { type: 'vline', x: 1e-8, color: 'muted', dash: '3 3', width: 1, text: '√ε ≈ 1e−8' },
        { type: 'vline', x: 1e-5, color: 'muted', dash: '3 3', width: 1, text: '∛ε ≈ 1e−5' },
        { type: 'points', x: [h, h], y: [floor(Math.abs(fw(h) - exact)), floor(Math.abs(ce(h) - exact))], color: (i) => (i ? 'model' : 'aqua'), r: 6, tooltip: (i) => [['h', '1e−' + st0.k], ['ошибка', (Math.abs((i ? ce : fw)(h) - exact)).toExponential(2)]] },
      ]);
      const xa = x + h;
      out.textContent = 'x + h        = ' + xa.toPrecision(17) + (xa === x ? '   ← компьютер считает, что x + h = x!' : '') +
        '\nf(x + h)     = ' + f(xa).toPrecision(17) + '\nf(x)         = ' + f(x).toPrecision(17) +
        '\nf(x+h) − f(x) = ' + (f(xa) - f(x)).toPrecision(6) + '   (верных цифр всё меньше)' +
        '\nделим на h   = ' + fw(h).toPrecision(12) + '   точно: ' + exact.toPrecision(12);
      const e1 = Math.abs(fw(h) - exact);
      const e2 = Math.abs(ce(h) - exact);
      st.set('f', U.fmt(fw(h), 8) + ' / ' + e1.toExponential(1));
      st.set('c', U.fmt(ce(h), 8) + ' / ' + e2.toExponential(1));
      note.innerHTML = st0.k <= 4 ? 'Пока h крупное, главная ошибка — ошибка метода: у правой разности она ≈ ' + (st0.c === 'trip' ? '1.8h' : 'h·(кривизна)') + ', у центральной ≈ h². Уменьшаем h — ошибка падает.'
        : st0.k <= 8 ? 'Около h = 1e−5 центральная разность лучшая (ошибка ~1e−11…1e−10), около h = 1e−8 — правая (~1e−9…1e−7). Это предел точности чисел с плавающей точкой.'
          : st0.k < 16 ? 'h слишком маленькое: f(x + h) и f(x) совпадают почти во всех цифрах, вычитание оставляет только «шум» последних цифр, а деление на h его раздувает. Ошибка растёт как ε/h.'
            : 'x + 1e−16 = x: шаг меньше точности хранения числа. Числитель равен нулю, и компьютер уверенно отвечает, что скорость 0.';
    }
    w.pythonAction(() => 'import numpy as np\n\n' + FLOATS[st0.c].py + '\nfor k in range(1, 17):\n    h = 10.0 ** -k\n    fwd = (f(x + h) - f(x)) / h\n    cen = (f(x + h) - f(x - h)) / (2 * h)\n    print(f"h = 1e-{k:<3} ошибка справа {abs(fwd - exact):9.1e}   по центру {abs(cen - exact):9.1e}")\n');
    draw();
  });

  GBC.lesson152 = { s, v, acc, PY_TRIP, curve, slope, texInto, tnum, polyTex, sgnWord, tangentLayer, lineLayer, card, cardGrid, gauge, TEMP, COFFEE };
})();
