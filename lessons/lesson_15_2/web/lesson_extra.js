/* Урок 15.2, часть 2: скорость как функция и скорость изменения в ML.
 * Виджеты: скорость из наклонов (поездка, мяч, прогулка), путь — скорость — ускорение, путь по
 * скорости (суммы v·Δt), скорости вокруг нас (издержки, бактерии, кофе, вклад, камень),
 * скорость изменения потерь и шаги против неё, скорость падения потерь бустинга по числу деревьев,
 * тренажёр. Помощники — из lesson.js (GBC.lesson152). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const { s, v, acc, PY_TRIP, curve, tangentLayer, lineLayer } = GBC.lesson152;

  /** Участки знака: [[x0, x1, знак], …] по сетке. */
  function signRuns(g, x0, x1, n = 400) {
    const xs = U.linspace(x0, x1, n + 1);
    const out = [];
    let start = x0;
    let sg = Math.sign(g((xs[0] + xs[1]) / 2));
    for (let i = 1; i < n; i++) {
      const m = (xs[i] + xs[i + 1]) / 2;
      const cur = Math.sign(g(m));
      if (cur !== sg) {
        out.push([start, xs[i], sg]);
        start = xs[i];
        sg = cur;
      }
    }
    out.push([start, x1, sg]);
    return out;
  }

  /* ==============================================================================
   * 15. Скорость — тоже функция: снимаем наклоны и рисуем v(t)
   * ============================================================================== */
  const SCEN = {
    trip: { label: 'Поездка: разгон и торможение', f: s, df: v, dom: [0, 10], xl: 'время t, с', yl: 'путь s(t), м', vl: 'скорость v(t), м/с', unit: 'м/с', py: 'f = lambda t: 3 * t**2 - t**3 / 5\ndf = lambda t: 6 * t - 0.6 * t**2\nt = np.linspace(0, 10, 201)' },
    ball: { label: 'Мяч подбросили вверх', f: (t) => 20 * t - 5 * t * t, df: (t) => 20 - 10 * t, dom: [0, 4], xl: 'время t, с', yl: 'высота y(t), м', vl: 'скорость, м/с', unit: 'м/с', py: 'f = lambda t: 20 * t - 5 * t**2\ndf = lambda t: 20 - 10 * t\nt = np.linspace(0, 4, 201)' },
    walk: { label: 'Прогулка до магазина и обратно', f: (t) => 200 * (1 - Math.cos((Math.PI * t) / 10)), df: (t) => 20 * Math.PI * Math.sin((Math.PI * t) / 10), dom: [0, 20], xl: 'время, мин', yl: 'расстояние от дома, м', vl: 'скорость, м/мин', unit: 'м/мин', py: 'f = lambda t: 200 * (1 - np.cos(np.pi * t / 10))\ndf = lambda t: 20 * np.pi * np.sin(np.pi * t / 10)\nt = np.linspace(0, 20, 201)' },
  };
  GBC.widget('speed-trace', (el) => {
    const st0 = { c: 'trip', k: 24 };
    const N = 80;
    const w = ui.shell(el, { title: 'Скорость — тоже функция', sub: 'Нажмите ▶: в каждый момент снимаем наклон касательной к графику пути (оранжевый отрезок) и записываем его на правый график. Фон: красный — путь растёт (v > 0), синий — убывает (v < 0).' });
    ui.select(w.controls, { label: 'Сценарий', value: st0.c, options: Object.entries(SCEN).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), draw()) });
    ui.player(w.controls, { label: 'Время', min: 0, max: N, value: st0.k, fps: 12, format: (k) => Math.round((100 * k) / N) + '%', onChange: (k) => ((st0.k = k), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 280, x: { label: '' }, y: { label: '' } });
    const p2 = new GBC.Plot(box, { height: 280, x: { label: '' }, y: { label: '' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't', label: 'момент' }, { key: 's', label: 'положение' }, { key: 'v', label: 'наклон = скорость' }]);
    function draw() {
      const C = SCEN[st0.c];
      const [t0, t1] = C.dom;
      const t = t0 + ((t1 - t0) * st0.k) / N;
      const ts = U.linspace(t0, t1, 301);
      const done = ts.filter((x) => x <= t + 1e-9);
      const fs = ts.map(C.f);
      const vs = ts.map(C.df);
      const [flo, fhi] = U.extent(fs);
      const [vlo, vhi] = U.extent(vs);
      const fpad = (fhi - flo) * 0.1;
      const vpad = (vhi - vlo) * 0.12 + 0.5;
      const bands = signRuns(C.df, t0, t1).filter((r) => r[2] !== 0).map((r) => ({ type: 'vband', x0: r[0], x1: r[1], color: r[2] > 0 ? 'pos' : 'neg', opacity: 0.07 }));
      p1.opts.x.label = C.xl;
      p1.opts.y.label = C.yl;
      p2.opts.x.label = C.xl;
      p2.opts.y.label = C.vl;
      const half = (t1 - t0) * 0.1;
      p1.render([
        ...bands,
        { type: 'line', x: ts, y: fs, color: 'model', width: 2.2, label: 'путь', hover: false },
        tangentLayer(C.f, t, C.df(t), half, { label: 'касательная' }),
        { type: 'points', x: [t], y: [C.f(t)], color: 'tree', r: 6 },
      ], { x: C.dom, y: [flo - fpad, fhi + fpad] });
      p2.render([
        ...bands,
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: ts, y: vs, color: 'muted', width: 1, dash: '3 4', hover: false },
        { type: 'line', x: done, y: done.map(C.df), color: 'tree', width: 2.4, label: 'скорость', hover: false },
        { type: 'points', x: [t], y: [C.df(t)], color: 'tree', r: 6, tooltip: () => [['t', U.fmt(t, 2)], ['v', U.fmt(C.df(t), 3)]] },
      ], { x: C.dom, y: [vlo - vpad, vhi + vpad] });
      const vt = C.df(t);
      st.set('t', U.fmt(t, 2));
      st.set('s', U.fmt(C.f(t), 2));
      st.set('v', U.fmt(vt, 3) + ' ' + C.unit);
      let txt;
      if (st0.c === 'trip') txt = Math.abs(t - 5) < 0.2 ? 'Максимум скорости — 15 м/с: здесь график пути круче всего.' : t < 5 ? 'Скорость растёт — график пути становится круче.' : 'Скорость падает — график пути выполаживается; к t = 10 с она равна нулю.';
      else if (st0.c === 'ball') txt = Math.abs(t - 2) < 0.06 ? 'Верхняя точка: скорость 0, мяч на миг замер на высоте 20 м. Касательная горизонтальна.' : t < 2 ? 'Мяч летит вверх: высота растёт, скорость положительна, но уменьшается.' : 'Мяч падает: высота убывает — скорость <b>отрицательна</b>. Знак скорости — направление движения.';
      else txt = Math.abs(t - 10) < 0.3 ? 'Дальняя точка — магазин: скорость 0, разворот.' : t < 10 ? 'Идём к магазину: расстояние растёт, скорость положительна; быстрее всего — в середине пути (5 мин).' : 'Возвращаемся: расстояние от дома уменьшается, скорость отрицательна.';
      note.innerHTML = 'Наклон касательной = ' + U.fmt(vt, 3) + ' ' + C.unit + '. ' + txt + ' Функцию «скорость в каждый момент» скоро назовём <b>производной</b> (урок 15.5).';
    }
    w.pythonAction(() => 'import numpy as np\nimport matplotlib.pyplot as plt\n\n' + SCEN[st0.c].py + '\nfig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 3.5))\na1.plot(t, f(t)); a1.set_title("положение")\na2.plot(t, df(t), color="C1"); a2.axhline(0, color="gray"); a2.set_title("скорость")\nplt.show()\n');
    draw();
  });

  /* ==============================================================================
   * 16. Путь → скорость → ускорение
   * ============================================================================== */
  const ACC = {
    trip: { label: 'Поездка: разгон и торможение', f: s, df: v, ddf: acc, dom: [0, 10], py: 's = lambda t: 3 * t**2 - t**3 / 5\nv = lambda t: 6 * t - 0.6 * t**2\na = lambda t: 6 - 1.2 * t\nT = 10' },
    ball: { label: 'Мяч подбросили вверх', f: (t) => 20 * t - 5 * t * t, df: (t) => 20 - 10 * t, ddf: () => -10, dom: [0, 4], py: 's = lambda t: 20 * t - 5 * t**2\nv = lambda t: 20 - 10 * t\na = lambda t: -10 + 0 * t\nT = 4' },
    brake: { label: 'Торможение перед светофором', f: (t) => 20 * t - 2 * t * t, df: (t) => 20 - 4 * t, ddf: () => -4, dom: [0, 5], py: 's = lambda t: 20 * t - 2 * t**2\nv = lambda t: 20 - 4 * t\na = lambda t: -4 + 0 * t\nT = 5' },
  };
  GBC.widget('acceleration', (el) => {
    const st0 = { c: 'trip', k: 20 };
    const N = 100;
    const w = ui.shell(el, { title: 'Путь, скорость, ускорение', sub: 'Три графика с общим курсором времени. Каждый следующий — скорость изменения предыдущего: наклон касательной сверху = высота точки ниже.' });
    ui.select(w.controls, { label: 'Сценарий', value: st0.c, options: Object.entries(ACC).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), draw()) });
    ui.player(w.controls, { label: 'Время', min: 0, max: N, value: st0.k, fps: 15, format: (k) => Math.round((100 * k) / N) + '%', onChange: (k) => ((st0.k = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 170, x: { label: '' }, y: { label: 'путь, м' } });
    const p2 = new GBC.Plot(w.main, { height: 170, x: { label: '' }, y: { label: 'скорость, м/с' } });
    const p3 = new GBC.Plot(w.main, { height: 170, x: { label: 'время t, с' }, y: { label: 'ускорение, м/с²' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 's', label: 'путь' }, { key: 'v', label: 'скорость' }, { key: 'a', label: 'ускорение' }]);
    function draw() {
      const C = ACC[st0.c];
      const [t0, t1] = C.dom;
      const t = t0 + ((t1 - t0) * st0.k) / N;
      const ts = U.linspace(t0, t1, 201);
      const ext = (arr, p = 0.12) => {
        const [lo, hi] = U.extent(arr);
        const d = (hi - lo) * p + 1;
        return [lo - d, hi + d];
      };
      const half = (t1 - t0) * 0.09;
      const fs = ts.map(C.f);
      const vs = ts.map(C.df);
      const as = ts.map(C.ddf);
      p1.render([
        { type: 'line', x: ts, y: fs, color: 'model', width: 2.2, hover: false },
        tangentLayer(C.f, t, C.df(t), half),
        { type: 'vline', x: t, color: 'muted', dash: '3 3', width: 1 },
        { type: 'points', x: [t], y: [C.f(t)], color: 'tree', r: 5 },
      ], { x: C.dom, y: ext(fs) });
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: ts, y: vs, color: 'tree', width: 2.2, hover: false },
        tangentLayer(C.df, t, C.ddf(t), half, { color: 'aqua' }),
        { type: 'vline', x: t, color: 'muted', dash: '3 3', width: 1 },
        { type: 'points', x: [t], y: [C.df(t)], color: 'tree', r: 5 },
      ], { x: C.dom, y: ext(vs) });
      p3.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: ts, y: as, color: 'aqua', width: 2.2, hover: false },
        { type: 'vline', x: t, color: 'muted', dash: '3 3', width: 1 },
        { type: 'points', x: [t], y: [C.ddf(t)], color: 'aqua', r: 5 },
      ], { x: C.dom, y: ext(as.concat([0])) });
      const a = C.ddf(t);
      const vv = C.df(t);
      st.set('s', U.fmt(C.f(t), 2) + ' м');
      st.set('v', U.fmt(vv, 2) + ' м/с');
      st.set('a', U.fmt(a, 2) + ' м/с²');
      const speeding = Math.abs(vv) > 1e-9 && a * vv > 0;
      note.innerHTML = 't = ' + U.fmt(t, 2) + ' с. ' + (Math.abs(a) < 1e-9 ? 'Ускорение 0: скорость на пике и на миг не меняется; график пути здесь переходит от «улыбки» к «хмурой» дуге.'
        : a > 0 ? 'Ускорение положительно: скорость растёт, график пути изгибается вверх.' : 'Ускорение отрицательно: скорость уменьшается, график пути изгибается вниз.') +
        (st0.c === 'ball' ? ' У мяча ускорение −10 м/с² всё время — и на подъёме, и на спуске. В верхней точке скорость 0, но ускорение не 0: поэтому мяч не зависает, а падает.' : '') +
        (st0.c === 'brake' ? ' Скорость падает на 4 м/с каждую секунду; через 5 с машина стоит, пройдя 50 м.' : '') +
        (speeding ? ' Знаки скорости и ускорения совпадают — тело разгоняется.' : Math.abs(vv) > 1e-9 && Math.abs(a) > 1e-9 ? ' Знаки скорости и ускорения разные — тело тормозит.' : '');
    }
    w.pythonAction(() => 'import numpy as np\n\n' + ACC[st0.c].py + '\nt = np.linspace(0, T, 11)\nvel = np.gradient(s(t), t)\nprint("t:", t)\nprint("v (численно):", np.round(vel, 3))\nprint("v (точно):    ", np.round(v(t), 3))\nprint("a (численно):", np.round(np.gradient(vel, t), 3))\n');
    draw();
  });

  /* ==============================================================================
   * 17. Обратная задача: путь как сумма v·Δt
   * ============================================================================== */
  GBC.widget('speed-to-path', (el) => {
    const DT = [2, 1, 0.5, 0.25, 0.1];
    const st0 = { dt: 1, rule: 'left', k: 10 };
    const w = ui.shell(el, { title: 'Путь по показаниям спидометра', sub: 'Отрезок Δt: скорость считаем постоянной и берём путь v·Δt — площадь прямоугольника. Нажмите ▶: прямоугольники складываются, справа растёт восстановленный путь.' });
    ui.slider(w.controls, { label: 'Шаг Δt', values: DT, value: st0.dt, format: (x) => x + ' с', onInput: (x) => ((st0.dt = x), pl.setMax(Math.round(10 / x)), pl.set(Math.round(10 / x)), (st0.k = Math.round(10 / x)), draw()) });
    ui.segmented(w.controls, { label: 'Какую скорость брать', value: st0.rule, options: [{ value: 'left', label: 'в начале' }, { value: 'mid', label: 'в середине' }], onChange: (r) => ((st0.rule = r), draw()) });
    const pl = ui.player(w.controls, { label: 'Сложено отрезков', min: 0, max: 10, value: 10, fps: 4, format: (k) => k + ' шт.', onChange: (k) => ((st0.k = k), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 280, x: { label: 'время t, с', domain: [0, 10] }, y: { label: 'скорость v(t), м/с', domain: [0, 17] } });
    const p2 = new GBC.Plot(box, { height: 280, x: { label: 'время t, с', domain: [0, 10] }, y: { label: 'путь, м', domain: [-3, 108] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sum', label: 'сумма v·Δt' }, { key: 'exact', label: 'настоящий путь' }, { key: 'err', label: 'ошибка' }]);
    function draw() {
      const dt = st0.dt;
      const n = Math.round(10 / dt);
      const k = Math.min(st0.k, n);
      const tk = U.range(n).map((i) => i * dt);
      const vk = tk.map((t) => v(st0.rule === 'left' ? t : t + dt / 2));
      const cum = [0];
      for (let i = 0; i < n; i++) cum.push(cum[i] + vk[i] * dt);
      const ts = U.linspace(0, 10, 201);
      const rects = tk.map((t, i) => ({ type: 'rect', x0: t, x1: t + dt, y0: 0, y1: vk[i], fill: i < k ? 'aqua' : 'grid', stroke: i < k ? 'aqua' : 'muted', opacity: i < k ? 0.3 : 0.08, width: 1 }));
      p1.render([
        ...rects,
        { type: 'line', x: ts, y: ts.map(v), color: 'tree', width: 2.4, label: 'спидометр v(t)', hover: false },
        { type: 'points', x: tk.map((t) => (st0.rule === 'left' ? t : t + dt / 2)), y: vk, color: 'tree', r: n > 40 ? 2.5 : 4 },
      ]);
      const tt = U.range(k + 1).map((i) => i * dt);
      p2.render([
        { type: 'line', x: ts, y: ts.map(s), color: 'model', width: 2, dash: '5 4', label: 'настоящий путь s(t)', hover: false },
        { type: 'line', x: tt, y: cum.slice(0, k + 1), color: 'aqua', width: 2.4, label: 'сумма v·Δt' },
        { type: 'points', x: tt, y: cum.slice(0, k + 1), color: 'aqua', r: n > 40 ? 2 : 4, tooltip: (i) => [['t', U.fmt(tt[i], 2)], ['сумма', U.fmt(cum[i], 4)], ['точно', U.fmt(s(tt[i]), 4)]] },
      ]);
      const tEnd = k * dt;
      st.set('sum', U.fmt(cum[k], 4) + ' м');
      st.set('exact', U.fmt(s(tEnd), 4) + ' м');
      st.set('err', U.fmt(cum[k] - s(tEnd), 4) + ' м');
      note.innerHTML = 'За ' + U.fmt(tEnd, 2) + ' с: сумма ' + k + ' прямоугольников = ' + U.fmt(cum[k], 4) + ' м, настоящий путь ' + U.fmt(s(tEnd), 4) + ' м. ' +
        (st0.rule === 'left' ? 'Скорость в начале отрезка при разгоне занижает путь, при торможении — завышает; ошибки частично гасятся.' : 'Скорость в середине отрезка гораздо точнее — как центральная разность в шаге 13.') +
        ' Уменьшайте Δt — ошибка исчезает: это интеграл (урок 15.9).';
    }
    w.pythonAction(() => 'import numpy as np\n\n' + PY_TRIP + '\nfor dt in [2, 1, 0.5, 0.25, 0.1]:\n    t = np.arange(0, 10, dt)\n    left = np.sum(v(t) * dt)\n    mid = np.sum(v(t + dt / 2) * dt)\n    print(f"Δt = {dt:<5} в начале: {left:9.4f} м   в середине: {mid:9.4f} м   (точно {s(10)})")\n');
    draw();
  });

  /* ==============================================================================
   * 18. Скорости изменения вокруг нас
   * ============================================================================== */
  const ZOO = {
    cost: { label: 'Издержки фабрики C(q)', f: (q) => 5000 + 40 * q - 0.05 * q * q + 0.0001 * q * q * q, dom: [0, 400], x0: 100, step: 10, xl: 'выпуск q, шт.', yl: 'издержки, ₽', unit: '₽ за шт.', rel: false,
      say: (x, y, r) => 'При выпуске ' + U.fmt(x, 0) + ' шт. ещё одно изделие обходится примерно в ' + U.fmt(r, 2) + ' ₽ — это <b>предельные издержки</b>. ' + (x > 0 ? 'А средние издержки C/q = ' + U.fmt(y / x, 2) + ' ₽ за шт. включают и постоянные 5000 ₽. ' : '') + 'Справа видно: предельные издержки сначала падают (налаживается производство), минимальны около 167 шт. (≈ 31.7 ₽), а потом растут (перегрузка).', py: 'f = lambda q: 5000 + 40 * q - 0.05 * q**2 + 0.0001 * q**3' },
    bact: { label: 'Бактерии N(t) = 100·2^(t/3)', f: (t) => 100 * Math.pow(2, t / 3), dom: [0, 12], x0: 3, step: 0.5, xl: 'время, ч', yl: 'клеток', unit: 'клеток/ч', rel: true,
      say: (x, y, r) => 'Через ' + U.fmt(x, 1) + ' ч бактерий ' + U.fmt(y, 0) + ', прибавляется ' + U.fmt(r, 1) + ' клеток в час. Абсолютная скорость растёт вместе с числом бактерий, а относительная постоянна: ln 2 / 3 ≈ 23.1% в час.', py: 'f = lambda t: 100 * 2 ** (t / 3)' },
    coffee: { label: 'Кофе остывает: 22 + 68·e^(−t/12)', f: (t) => 22 + 68 * Math.exp(-t / 12), dom: [0, 40], x0: 5, step: 1, xl: 'время, мин', yl: 'температура, °C', unit: '°C/мин', rel: false,
      say: (x, y, r) => 'Через ' + U.fmt(x, 0) + ' мин кофе ' + U.fmt(y, 1) + ' °C и остывает со скоростью ' + U.fmt(-r, 2) + ' °C в минуту. Чем ближе к комнатной температуре 22 °C, тем медленнее: скорость пропорциональна разнице T − 22 (закон охлаждения Ньютона).', py: 'f = lambda t: 22 + 68 * np.exp(-t / 12)' },
    deposit: { label: 'Вклад 100 000 ₽ под 10% годовых', f: (t) => 100000 * Math.pow(1.1, t), dom: [0, 10], x0: 5, step: 0.5, xl: 'время, лет', yl: 'сумма, ₽', unit: '₽ в год', rel: true,
      say: (x, y, r) => 'Через ' + U.fmt(x, 1) + ' лет на вкладе ' + U.fmt(y, 0) + ' ₽, и сумма растёт со скоростью ' + U.fmt(r, 0) + ' ₽ в год. Мгновенная относительная скорость ln 1.1 ≈ 9.53% в год — чуть меньше 10%: проценты начисляются раз в год, а доход «внутри года» уже идёт со старой суммы.', py: 'f = lambda t: 100000 * 1.1 ** t' },
    stone: { label: 'Камень падает: s = 4.9t²', f: (t) => 4.9 * t * t, dom: [0, 4], x0: 2, step: 0.1, xl: 'время, с', yl: 'пролетел, м', unit: 'м/с', rel: false,
      say: (x, y, r) => 'Через ' + U.fmt(x, 1) + ' с камень пролетел ' + U.fmt(y, 2) + ' м и летит со скоростью ' + U.fmt(r, 2) + ' м/с = 9.8·t: каждую секунду скорость прибавляет 9.8 м/с (ускорение свободного падения).', py: 'f = lambda t: 4.9 * t**2' },
  };
  GBC.widget('rate-zoo', (el) => {
    const st0 = { c: 'cost', x: 100 };
    const w = ui.shell(el, { title: 'Скорости изменения вокруг нас', sub: 'Выберите явление и точку. Оранжевая касательная показывает мгновенную скорость; под графиком — что это число значит в жизни.' });
    ui.select(w.controls, { label: 'Явление', value: st0.c, options: Object.entries(ZOO).map(([k, c]) => ({ value: k, label: c.label })), onChange: (k) => ((st0.c = k), (st0.x = ZOO[k].x0), xs.el.remove(), mk(), draw()) });
    const sb = H('div');
    w.controls.appendChild(sb);
    let xs;
    function mk() {
      const C = ZOO[st0.c];
      xs = ui.slider(sb, { label: 'Точка', min: C.dom[0], max: C.dom[1], step: C.step, value: st0.x, onInput: (x) => ((st0.x = x), draw()) });
    }
    mk();
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 280, x: { label: '' }, y: { label: '' }, margin: { left: 64 } });
    const p2 = new GBC.Plot(box, { height: 280, x: { label: '' }, y: { label: '' }, margin: { left: 64 } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'y', label: 'значение' }, { key: 'r', label: 'мгновенная скорость' }, { key: 'rel', label: 'относительная скорость' }]);
    function draw() {
      const C = ZOO[st0.c];
      const x = st0.x;
      const y = C.f(x);
      const h = (C.dom[1] - C.dom[0]) * 1e-6;
      const r = (C.f(x + h) - C.f(x - h)) / (2 * h);
      const cv = curve(C.f, C.dom[0], C.dom[1], 300);
      const [lo, hi] = U.extent(cv.y);
      const pad = (hi - lo) * 0.1;
      plot.opts.x.label = C.xl;
      plot.opts.y.label = C.yl;
      plot.render([
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.2, hover: false },
        tangentLayer(C.f, x, r, (C.dom[1] - C.dom[0]) * 0.15),
        { type: 'points', x: [x], y: [y], color: 'tree', r: 6, tooltip: () => [['точка', U.fmt(x, 2)], ['значение', U.fmt(y, 4)], ['скорость', U.fmt(r, 4)]] },
      ], { x: C.dom, y: [Math.min(lo - pad, 0), hi + pad] });
      const rate = (t) => (C.f(t + h) - C.f(t - h)) / (2 * h);
      const rs = cv.x.map(rate);
      const [rlo, rhi] = U.extent(rs);
      const rpad = (rhi - rlo) * 0.12 + Math.abs(rhi) * 0.05 + 1e-9;
      p2.opts.x.label = C.xl;
      p2.opts.y.label = 'скорость, ' + C.unit;
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: cv.x, y: rs, color: 'tree', width: 2.2, label: 'скорость изменения', hover: false },
        { type: 'points', x: [x], y: [r], color: 'tree', r: 6, tooltip: () => [['точка', U.fmt(x, 2)], ['скорость', U.fmt(r, 4)]] },
      ], { x: C.dom, y: [Math.min(rlo - rpad, 0), Math.max(rhi + rpad, 0)] });
      st.set('y', U.fmt(y, 2));
      st.set('r', U.fmt(r, 3) + ' ' + C.unit);
      st.set('rel', Math.abs(y) > 1e-9 ? U.fmt((100 * r) / y, 3) + '% на единицу' : '—');
      note.innerHTML = C.say(x, y, r);
    }
    w.pythonAction(() => 'import numpy as np\n\n' + ZOO[st0.c].py + '\nx, h = ' + U.pyNum(st0.x) + ', 1e-5\nrate = (f(x + h) - f(x - h)) / (2 * h)\nprint("значение:", round(f(x), 4), " скорость:", round(rate, 4), " относительная:", round(100 * rate / f(x), 3) if f(x) else None, "%")\n');
    draw();
  });

  /* ==============================================================================
   * 19. Скорость изменения потерь по прогнозу и шаги против неё
   * ============================================================================== */
  GBC.widget('loss-rate', (el) => {
    const st0 = { y: 3, F: 1, loss: 'sq', nu: 0.5, path: [1] };
    const w = ui.shell(el, { title: 'Скорость изменения потерь по прогнозу', sub: 'Тяните прогноз F по кривой потерь. Касательная — мгновенная скорость изменения потерь. Стрелка внизу — куда сдвинуть прогноз, чтобы потери уменьшились. Кнопка «Шаг» делает F ← F − ν·скорость.' });
    ui.segmented(w.controls, { label: 'Потери', value: st0.loss, options: [{ value: 'sq', label: '½(y − F)²' }, { value: 'abs', label: '|y − F|' }], onChange: (l) => ((st0.loss = l), (st0.path = [st0.F]), draw()) });
    ui.slider(w.controls, { label: 'Правильный ответ y', min: -1, max: 6, step: 0.5, value: st0.y, onInput: (x) => ((st0.y = x), (st0.path = [st0.F]), draw()) });
    ui.slider(w.controls, { label: 'Темп шага ν', min: 0.1, max: 2.2, step: 0.1, value: st0.nu, format: (x) => U.fmt(x, 1), onInput: (x) => ((st0.nu = x), draw()) });
    ui.button(w.controls, { label: 'Шаг против скорости', kind: 'primary', icon: 'step', onClick: () => step() });
    ui.button(w.controls, { label: 'Сбросить', icon: 'reset', onClick: () => ((st0.F = 1), (st0.path = [1]), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'прогноз F', domain: [-3, 8] }, y: { label: 'потери L(F)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'потери L(F)' }, { key: 'r', label: 'скорость изменения' }, { key: 'res', label: 'остаток y − F' }, { key: 'next', label: 'следующий F' }]);
    const Lf = (F) => (st0.loss === 'sq' ? 0.5 * (st0.y - F) * (st0.y - F) : Math.abs(st0.y - F));
    const rate = (F) => (st0.loss === 'sq' ? F - st0.y : Math.abs(F - st0.y) < 1e-12 ? NaN : Math.sign(F - st0.y));
    function step() {
      const r = rate(st0.F);
      if (!Number.isFinite(r)) return;
      st0.F = U.clamp(st0.F - st0.nu * r, -3, 8);
      st0.path.push(st0.F);
      if (st0.path.length > 30) st0.path.shift();
      draw();
    }
    function draw() {
      const F = st0.F;
      const cv = curve(Lf, -3, 8, 400);
      const [, hi] = U.extent(cv.y);
      const base = -hi * 0.09;
      const r = rate(F);
      const nxt = Number.isFinite(r) ? F - st0.nu * r : F;
      const pts = st0.path;
      plot.render([
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.2, label: st0.loss === 'sq' ? 'L = ½(y − F)²' : 'L = |y − F|', hover: false },
        { type: 'vline', x: st0.y, color: 'muted', dash: '3 3', width: 1, text: 'y = ' + U.fmt(st0.y, 2) },
        Number.isFinite(r) ? tangentLayer(Lf, F, r, 1.4, { label: 'касательная' }) : null,
        pts.length > 1 ? { type: 'segments', x1: pts.slice(0, -1), y1: pts.slice(0, -1).map(Lf), x2: pts.slice(1), y2: pts.slice(1).map(Lf), color: 'aqua', width: 1.6, opacity: 0.8 } : null,
        pts.length > 1 ? { type: 'points', x: pts.slice(0, -1), y: pts.slice(0, -1).map(Lf), color: 'aqua', r: 3.5 } : null,
        Number.isFinite(r) && Math.abs(nxt - F) > 1e-9 ? { type: 'arrows', x1: [F], y1: [base], x2: [U.clamp(nxt, -3, 8)], y2: [base], color: 'tree', width: 2.6 } : null,
        { type: 'points', x: [F], y: [Lf(F)], color: 'tree', r: 7, draggable: true, onDrag: (i, x) => {
          st0.F = Math.round(U.clamp(x, -3, 8) * 20) / 20;
          st0.path = [st0.F];
          draw();
        }, tooltip: () => [['F', U.fmt(F, 3)], ['L', U.fmt(Lf(F), 4)]] },
      ], { y: [base * 1.8, hi * 1.05] });
      st.set('L', U.fmt(Lf(F), 4));
      st.set('r', Number.isFinite(r) ? U.fmt(r, 4) : 'не определена');
      st.set('res', U.fmt(st0.y - F, 4));
      st.set('next', U.fmt(nxt, 4));
      if (!Number.isFinite(r)) note.innerHTML = 'F = y: потери минимальны. У |y − F| здесь излом — мгновенной скорости нет (шаг 12); библиотеки условно считают её нулём, и прогноз стоит на месте.';
      else if (Math.abs(r) < 1e-9) note.innerHTML = 'Скорость 0: касательная горизонтальна, прогноз совпал с ответом — двигаться некуда.';
      else {
        let txt = 'Скорость ' + U.fmt(r, 3) + ' ' + (r < 0 ? '&lt; 0: потери падают при <b>увеличении</b> F' : '&gt; 0: потери падают при <b>уменьшении</b> F') + '. ';
        if (st0.loss === 'sq') {
          txt += 'Скорость = F − y = −(остаток). Шаг против неё: F ← F + ν·(y − F) — сдвиг на долю ν остатка. ';
          txt += st0.nu < 1 ? 'При ν &lt; 1 подходим к ответу плавно, без перелёта.' : Math.abs(st0.nu - 1) < 1e-9 ? 'При ν = 1 попадаем в ответ за один шаг.' : st0.nu < 2 ? 'При 1 &lt; ν &lt; 2 перелетаем ответ, но колебания затухают.' : Math.abs(st0.nu - 2) < 1e-9 ? 'При ν = 2 прыгаем туда-обратно вечно.' : 'При ν &gt; 2 шаги раскачиваются и уходят всё дальше — расходимость.';
        } else txt += 'У |y − F| скорость всегда ±1: она говорит, <em>куда</em> двигаться, но не <em>насколько</em> — величина шага всегда ν, и около ответа прогноз начинает скакать.';
        note.innerHTML = txt;
      }
    }
    w.pythonAction(() => 'y, F, nu = ' + U.pyNum(st0.y) + ', ' + U.pyNum(st0.path[0]) + ', ' + U.pyNum(st0.nu) + '\n' +
      (st0.loss === 'sq' ? 'rate = lambda F: F - y                 # для L = ½(y − F)²\n' : 'import numpy as np\nrate = lambda F: np.sign(F - y)        # для L = |y − F|\n') +
      'for step in range(8):\n    print(f"шаг {step}: F = {F:.4f}, скорость {rate(F):+.4f}")\n    F = F - nu * rate(F)\n');
    draw();
  });

  /* ==============================================================================
   * 20. Бустинг: скорость падения потерь по числу деревьев
   * ============================================================================== */
  GBC.widget('boosting-rate', (el) => {
    const st0 = { nu: 0.1, m: 50, zoom: false };
    const NE = 200;
    const cache = {};
    const data = GBC.datasets.regression1d({ kind: 'sine', n: 200, noise: 0.3, seed: 42 });
    const sp = GBC.datasets.trainTestSplit(data.X, data.y, 0.3, 0);
    function fit(nu) {
      if (cache[nu]) return cache[nu];
      const m = new GBC.GradientBoosting({ nEstimators: NE, learningRate: nu, maxDepth: 2 });
      m.fit(sp.Xtrain, sp.ytrain, { evalSet: [sp.Xtest, sp.ytest] });
      const tr = m.history.train;
      const va = m.history.eval;
      const dtr = U.range(NE).map((i) => tr[i + 1] - tr[i]);
      const dva = U.range(NE).map((i) => va[i + 1] - va[i]);
      const ma = dva.map((_, i) => (i < 9 ? NaN : U.mean(dva.slice(i - 9, i + 1))));
      const best = U.argmin ? U.argmin(va) : va.indexOf(Math.min(...va));
      cache[nu] = { tr, va, dtr, dva, ma, best };
      return cache[nu];
    }
    const w = ui.shell(el, { title: 'Как быстро падают потери с каждым деревом', sub: 'Слева — потери (½·среднее квадратов остатков) после M деревьев на обучении и на проверке. Справа — их конечные разности: на сколько изменились потери от M-го дерева. Пунктир — лучшее число деревьев по проверке.' });
    ui.segmented(w.controls, { label: 'Темп обучения ν', value: st0.nu, options: [{ value: 0.1, label: '0.1' }, { value: 0.3, label: '0.3' }, { value: 1, label: '1' }], onChange: (x) => ((st0.nu = x), draw()) });
    ui.player(w.controls, { label: 'Деревьев M', min: 1, max: NE, value: st0.m, fps: 15, format: (k) => 'M = ' + k, onChange: (k) => ((st0.m = k), draw()) });
    ui.toggle(w.controls, { label: 'Крупно: разности около нуля', checked: false, onChange: (c) => ((st0.zoom = c), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 280, x: { label: 'число деревьев M', domain: [0, NE] }, y: { label: 'потери' } });
    const p2 = new GBC.Plot(box, { height: 280, x: { label: 'номер дерева M', domain: [0, NE] }, y: { label: 'Δ потерь от M-го дерева' }, margin: { left: 62 } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'tr', label: 'обучение: потери / Δ' }, { key: 'va', label: 'проверка: потери / Δ' }, { key: 'best', label: 'лучшее M по проверке' }]);
    function draw() {
      const R = fit(st0.nu);
      const M = st0.m;
      const ms = U.range(NE + 1);
      const ds = U.range(NE).map((i) => i + 1);
      p1.render([
        { type: 'line', x: ms, y: R.tr, color: 'train', width: 2.2, label: 'обучение' },
        { type: 'line', x: ms, y: R.va, color: 'valid', width: 2.2, label: 'проверка' },
        { type: 'vline', x: R.best, color: 'valid', dash: '5 4', width: 1.2, text: 'лучшее: ' + R.best },
        { type: 'vline', x: M, color: 'muted', width: 1 },
        { type: 'points', x: [M, M], y: [R.tr[M], R.va[M]], color: (i) => (i ? 'valid' : 'train'), r: 5 },
      ], { y: [0, Math.max(R.tr[0], R.va[0]) * 1.05] });
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: ds, y: R.dtr, color: 'train', width: 1.8, label: 'обучение' },
        { type: 'line', x: ds, y: R.dva, color: 'valid', width: 1.2, opacity: 0.55, label: 'проверка' },
        { type: 'line', x: ds, y: R.ma, color: 'valid', width: 2.4, label: 'проверка, среднее по 10' },
        { type: 'vline', x: R.best, color: 'valid', dash: '5 4', width: 1.2 },
        { type: 'vline', x: M, color: 'muted', width: 1 },
        { type: 'points', x: [M, M], y: [R.dtr[M - 1], R.dva[M - 1]], color: (i) => (i ? 'valid' : 'train'), r: 5, tooltip: (i) => [[i ? 'проверка' : 'обучение', U.fmt((i ? R.dva : R.dtr)[M - 1], 6)]] },
      ], st0.zoom ? { y: [-0.004, 0.003] } : { y: U.extent(R.dtr.concat(R.dva, [0])).map((x, i) => x * 1.08 + (i ? 1e-4 : -1e-4)) });
      st.set('tr', U.fmt(R.tr[M], 4) + ' / ' + U.fmtFixed(R.dtr[M - 1], 6));
      st.set('va', U.fmt(R.va[M], 4) + ' / ' + U.fmtFixed(R.dva[M - 1], 6));
      st.set('best', R.best + ' (' + U.fmt(R.va[R.best], 4) + ')');
      const after = M > R.best;
      note.innerHTML = 'Дерево №' + M + ' изменило потери на обучении на ' + U.fmtFixed(R.dtr[M - 1], 6) + ' (первое — на ' + U.fmtFixed(R.dtr[0], 4) + '): скорость обучения падает, каждое новое дерево приносит всё меньше. ' +
        (after ? 'Мы уже правее лучшего M = ' + R.best + ': на проверке потери в среднем перестали падать — новые деревья подгоняются под шум. Здесь сработала бы ранняя остановка.' : (Number.isFinite(R.ma[M - 1]) ? 'На проверке потери пока падают: средняя разность за последние 10 деревьев ' + U.fmtFixed(R.ma[M - 1], 6) + '.' : 'На проверке потери пока падают.')) +
        ' Сравните ν: чем больше темп, тем быстрее падение в начале и тем раньше наступает лучшее M.';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse import datasets, GradientBoosting\n\nX, y = datasets.regression_1d(kind="sine", n=200, noise=0.3, seed=42)\nXtr, Xva, ytr, yva = datasets.train_test_split(X, y, test_size=0.3, seed=0)\nm = GradientBoosting(n_estimators=200, learning_rate=' + st0.nu + ', max_depth=2).fit(Xtr, ytr, eval_set=(Xva, yva))\ntr, va = np.array(m.history_["train"]), np.array(m.history_["eval"])\nprint("Δ потерь на обучении от деревьев 1, 10, 100:", np.round(np.diff(tr)[[0, 9, 99]], 6))\nprint("лучшее M по проверке:", va.argmin(), round(va.min(), 4))\n');
    draw();
  });

  /* ==============================================================================
   * 21. Тренажёр: средняя скорость по графику, по таблице и мгновенная по касательной
   * ============================================================================== */
  GBC.widget('rate-game', (el) => {
    const st0 = { mode: 'graph', seed: 5, round: 0, right: 0, streak: 0, q: null, picked: null };
    const w = ui.shell(el, { title: 'Тренажёр скорости изменения', sub: 'Выберите режим и ответьте. Точки и касательные проходят через узлы сетки — считайте клетки.' });
    ui.segmented(w.controls, { label: 'Режим', value: st0.mode, options: [{ value: 'graph', label: 'по графику' }, { value: 'table', label: 'по таблице' }, { value: 'tangent', label: 'касательная' }], onChange: (m) => ((st0.mode = m), newQ()) });
    const optsBox = H('div', { style: 'display:grid;gap:8px' });
    w.controls.appendChild(optsBox);
    const next = ui.button(w.controls, { label: 'Следующий', icon: 'step', onClick: () => newQ() });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 8], ticks: U.range(9) }, y: { label: 'f(x)', domain: [0, 10], ticks: U.range(11) } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function options(rng, ans, cand) {
      const set = new Set([Math.round(ans * 100) / 100]);
      for (const c of cand) if (set.size < 4 && Number.isFinite(c)) set.add(Math.round(c * 100) / 100);
      let extra = 1;
      while (set.size < 4) set.add(Math.round((ans + extra++) * 100) / 100);
      const opts = [...set];
      for (let i = opts.length - 1; i > 0; i--) {
        const j = rng.randint(i + 1);
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      return opts;
    }
    function newQ() {
      const rng = new GBC.RNG(st0.seed++);
      let q;
      if (st0.mode === 'graph') {
        let a;
        let b;
        let fa;
        let fb;
        do {
          a = rng.randint(4);
          b = a + 1 + rng.randint(4);
          fa = 1 + rng.randint(9);
          fb = 1 + rng.randint(9);
        } while (fa === fb && rng.random() < 0.7);
        const bump = (rng.random() - 0.5) * 1.2;
        const f = (x) => fa + ((fb - fa) * (x - a)) / (b - a) + bump * (x - a) * (x - b) * 0.5;
        const ans = (fb - fa) / (b - a);
        q = { a, b, fa, fb, f, ans, opts: options(rng, ans, [(fb - fa) / (b - a + 1), (fa - fb) / (b - a), (b - a) / (fb - fa || 1), fb - fa, ans + 0.5]) };
      } else if (st0.mode === 'table') {
        const xs = U.range(6).map((k) => 2 * k);
        const ys = [10 + rng.randint(20)];
        for (let k = 1; k < 6; k++) ys.push(ys[k - 1] + rng.randint(13) - 4);
        const i = rng.randint(4);
        const j = i + 1 + rng.randint(5 - i);
        const ans = (ys[j] - ys[i]) / (xs[j] - xs[i]);
        q = { xs, ys, i, j, ans, opts: options(rng, ans, [ys[j] - ys[i], (ys[j] - ys[i]) / (j - i), (xs[j] - xs[i]) / (ys[j] - ys[i] || 1), -ans, (ys[j] + ys[i]) / 2]) };
      } else {
        const a = [0.5, 1, -0.5, -1][rng.randint(4)];
        const p = 2 + rng.randint(5);
        let x0;
        do x0 = 1 + rng.randint(7);
        while (Math.abs(x0 - p) > 3);
        const Y0 = a > 0 ? 2 + rng.randint(4) : 5 + rng.randint(4);
        const qv = Y0 - a * (x0 - p) * (x0 - p);
        const f = (x) => a * (x - p) * (x - p) + qv;
        const ans = 2 * a * (x0 - p);
        q = { a, p, x0, Y0, f, ans, opts: options(rng, ans, [f(x0 + 1) - f(x0), -ans, ans / 2, ans === 0 ? a : 2 * ans, f(x0 + 1) - f(x0 - 1)]) };
      }
      st0.q = q;
      st0.picked = null;
      st0.round++;
      optsBox.textContent = '';
      q.opts.forEach((o) => ui.button(optsBox, { label: U.fmt(o, 2), kind: 'primary', onClick: () => pick(o) }));
      draw();
    }
    function pick(o) {
      if (st0.picked !== null) return;
      st0.picked = o;
      if (Math.abs(o - st0.q.ans) < 1e-9) (st0.right++, st0.streak++);
      else st0.streak = 0;
      [...optsBox.querySelectorAll('button')].forEach((b) => (b.disabled = true));
      draw();
    }
    function draw() {
      const q = st0.q;
      const shown = st0.picked !== null;
      const ok = shown && Math.abs(st0.picked - q.ans) < 1e-9;
      const head = shown ? (ok ? '<b>Верно!</b> ' : '<b>Нет.</b> ') : '';
      const xs = U.linspace(0, 8, 200);
      tableBox.textContent = '';
      if (st0.mode === 'graph') {
        const { a, b, fa, fb, f, ans } = q;
        plot.opts.x = { label: 'x', domain: [0, 8], ticks: U.range(9) };
        plot.opts.y = { label: 'f(x)', domain: [0, 10], ticks: U.range(11) };
        plot.render([
          { type: 'line', x: xs, y: xs.map(f), color: 'model', width: 2.2, hover: false },
          shown ? { type: 'segments', x1: [a, b], y1: [fa, fa], x2: [b, b], y2: [fa, fb], color: 'tree', width: 2, dash: '5 4', opacity: 1 } : null,
          shown ? lineLayer(a, fa, ans, [0, 8], { width: 1.8 }) : null,
          { type: 'points', x: [a, b], y: [fa, fb], color: 'tree', r: 7, tooltip: (i) => [['x', String(i ? b : a)], ['f', String(i ? fb : fa)]] },
        ]);
        note.innerHTML = !shown ? 'Точки: (' + a + ', ' + fa + ') и (' + b + ', ' + fb + '). Сколько клеток вправо и сколько вверх (или вниз)?'
          : head + 'Δf / Δx = (' + fb + ' − ' + fa + ') / (' + b + ' − ' + a + ') = ' + (fb - fa) + ' / ' + (b - a) + ' = ' + U.fmt(ans, 3) + '. Форма кривой между точками на среднюю скорость не влияет — важны только концы.';
      } else if (st0.mode === 'table') {
        const { xs: tx, ys: ty, i, j, ans } = q;
        plot.opts.x = { label: 'время, ч', domain: [-0.5, 10.5], ticks: tx };
        plot.opts.y = { label: 'температура, °C' };
        plot.render([
          { type: 'line', x: tx, y: ty, color: 'muted', width: 1.4, hover: false },
          { type: 'points', x: tx, y: ty, color: (k) => (k === i || k === j ? 'tree' : 'model'), r: (k) => (k === i || k === j ? 7 : 4.5) },
          shown ? lineLayer(tx[i], ty[i], ans, [-0.5, 10.5], { width: 1.8 }) : null,
        ], { y: [Math.min(...ty) - 3, Math.max(...ty) + 3] });
        ui.table(tableBox, { columns: ['время, ч'].concat(tx.map(String)), rows: [['°C'].concat(ty.map(String))], highlight: null });
        note.innerHTML = !shown ? 'Средняя скорость изменения температуры с ' + tx[i] + ' до ' + tx[j] + ' ч (°C в час)?'
          : head + '(' + ty[j] + ' − ' + ty[i] + ') / (' + tx[j] + ' − ' + tx[i] + ') = ' + (ty[j] - ty[i]) + ' / ' + (tx[j] - tx[i]) + ' = ' + U.fmt(ans, 3) + ' °C/ч. Делим на часы, а не на число строк таблицы.';
      } else {
        const { x0, Y0, f, ans } = q;
        plot.opts.x = { label: 'x', domain: [0, 8], ticks: U.range(9) };
        plot.opts.y = { label: 'f(x)', domain: [0, 10], ticks: U.range(11) };
        plot.render([
          { type: 'line', x: xs, y: xs.map(f), color: 'model', width: 2.2, hover: false },
          lineLayer(x0, Y0, ans, [0, 8], { color: 'tree', width: 2, label: 'касательная' }),
          shown ? { type: 'segments', x1: [x0, x0 + 1], y1: [Y0, Y0], x2: [x0 + 1, x0 + 1], y2: [Y0, Y0 + ans], color: 'aqua', width: 2.4, dash: '5 4', opacity: 1 } : null,
          { type: 'points', x: [x0], y: [Y0], color: 'tree', r: 7 },
        ]);
        note.innerHTML = !shown ? 'Мгновенная скорость f в точке x = ' + x0 + ' — наклон оранжевой касательной. Шагните по касательной на 1 клетку вправо: на сколько она поднимется?'
          : head + 'Наклон касательной = ' + U.fmt(ans, 3) + ': на 1 клетку вправо касательная ' + (ans > 0 ? 'поднимается на ' + U.fmt(ans, 2) : ans < 0 ? 'опускается на ' + U.fmt(-ans, 2) : 'не меняется (вершина)') + '. Не путайте с секущей на [' + x0 + ', ' + (x0 + 1) + ']: её наклон ' + U.fmt(f(x0 + 1) - f(x0), 3) + '.';
      }
      st.set('r', String(st0.round));
      st.set('ok', st0.right + ' из ' + (st0.round - (shown ? 0 : 1)));
      st.set('s', String(st0.streak));
      next.textContent = '';
      next.append(ui.icon('step'), shown ? 'Следующий' : 'Пропустить');
    }
    w.pythonAction(() => {
      const q = st0.q;
      if (st0.mode === 'graph') return 'a, fa = ' + q.a + ', ' + q.fa + '\nb, fb = ' + q.b + ', ' + q.fb + '\nprint("средняя скорость:", (fb - fa) / (b - a))\n';
      if (st0.mode === 'table') return 'x = ' + JSON.stringify(q.xs) + '\ny = ' + JSON.stringify(q.ys) + '\ni, j = ' + q.i + ', ' + q.j + '\nprint("средняя скорость:", (y[j] - y[i]) / (x[j] - x[i]), "°C/ч")\n';
      return 'f = lambda x: ' + U.pyNum(q.a) + ' * (x - ' + q.p + ')**2 + ' + U.pyNum(Number((q.Y0 - q.a * (q.x0 - q.p) ** 2).toFixed(6))) + '\nx0, h = ' + q.x0 + ', 1e-5\nprint("наклон касательной:", round((f(x0 + h) - f(x0 - h)) / (2 * h), 6))\n';
    });
    newQ();
  });
})();
