/* Урок 1 — обзор модуля «Введение»:
 *   boost-a-number  — бустинг одного числа: удары по мячу и множитель (1 − ν);
 *   hand-boost      — бустинг вручную на шести квартирах: остатки → пень → обновление;
 *   one-vs-many     — один пень, одно глубокое дерево, бэггинг и бустинг на одних данных;
 *   ensemble-schema — схема: бэггинг (параллельно) и бустинг (последовательно);
 *   concept-map     — карта формулы по косточкам (из course.json). */
(function () {
  'use strict';
  const { util: U, ui, h: H, svg: S } = GBC;

  /** Список строк псевдокода с подсветкой текущей строки. */
  function algoBox(parent, lines) {
    const box = H('div', {
      role: 'list',
      'aria-label': 'Алгоритм',
      style: {
        fontFamily: 'var(--font-mono)', fontSize: '12.5px', lineHeight: '1.55', background: 'var(--surface-2)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 0', margin: '4px 0 2px',
      },
    });
    const rows = lines.map((ln) => {
      const r = H('div', { role: 'listitem', style: { padding: '1px 10px 1px ' + (10 + 14 * (ln.indent || 0)) + 'px', borderLeft: '3px solid transparent', whiteSpace: 'pre-wrap' } });
      r.appendChild(GBC.richText(ln.text));
      box.appendChild(r);
      return r;
    });
    parent.appendChild(box);
    return {
      el: box,
      set(i) {
        rows.forEach((r, k) => {
          const on = k === i;
          r.style.background = on ? 'var(--accent-soft)' : 'transparent';
          r.style.borderLeftColor = on ? 'var(--accent)' : 'transparent';
          r.style.fontWeight = on ? '650' : '400';
        });
      },
    };
  }

  /* =================================================================================
   * boost-a-number — бустинг одного числа
   * ================================================================================= */
  GBC.widget('boost-a-number', (el) => {
    const s = { target: 10, nu: 0.5, steps: 12 };
    const w = ui.shell(el, {
      title: 'Бустинг одного числа',
      sub: 'Модель — одно число F. На каждом шаге «слабый ученик» сообщает остаток r = y − F, а модель прибавляет его долю ν. Сверху — удары по мячу, снизу — прогноз и остаток по шагам.',
    });
    const tCtl = ui.slider(w.controls, { label: 'Цель y (лунка)', min: 1, max: 20, step: 1, value: s.target, format: String, onInput: (v) => ((s.target = v), draw()) });
    const nuCtl = ui.slider(w.controls, { label: 'Темп ν', min: 0.05, max: 2.2, step: 0.05, value: s.nu, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.nu = v), preset.set(null), draw()) });
    ui.slider(w.controls, { label: 'Шагов M', min: 1, max: 40, step: 1, value: s.steps, format: String, onInput: (v) => ((s.steps = v), draw()) });
    const preset = ui.segmented(w.controls, {
      label: 'Готовые режимы',
      options: [
        { value: 0.1, label: '0.1', title: 'Осторожно: маленькие шаги' },
        { value: 0.5, label: '0.5', title: 'Половина остатка за шаг' },
        { value: 1, label: '1', title: 'Весь остаток сразу' },
        { value: 1.5, label: '1.5', title: 'Перелёт с затуханием' },
        { value: 2.1, label: '2.1', title: 'Разнос' },
      ],
      value: s.nu,
      onChange: (v) => ((s.nu = v), nuCtl.set(v), draw()),
    });
    const shots = new GBC.Plot(w.main, { height: 210, grid: 'x', margin: { left: 66, bottom: 38 }, x: { label: 'значение прогноза F' }, y: { ticks: [-1], format: (v) => 'удар ' + Math.round(-v) } });
    const plot = new GBC.Plot(w.main, {
      height: 240, x: { label: 'шаг m' }, y: { label: 'значение' }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v),
      table: () => ({ columns: ['m', 'F_m', 'остаток y − F_m', '|остаток| / y'], rows: seq().F.map((f, m) => [m, f, s.target - f, Math.abs(s.target - f) / s.target]) }),
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [
      { key: 'F', label: 'Прогноз F_M' },
      { key: 'r', label: 'Остаток y − F_M' },
      { key: 'k', label: 'Множитель остатка 1 − ν' },
      { key: 'n1', label: 'Шагов до точности 1 %' },
    ]);
    function seq() {
      const F = [0];
      for (let m = 1; m <= s.steps; m++) F.push(F[m - 1] + s.nu * (s.target - F[m - 1]));
      return { F, r: F.map((f) => s.target - f) };
    }
    function stepsTo1pct() {
      const k = Math.abs(1 - s.nu);
      if (k === 0) return '1';
      if (k >= 1) return 'никогда';
      return String(Math.ceil(Math.log(0.01) / Math.log(k) - 1e-12));
    }
    function draw() {
      const { F, r } = seq();
      const ms = U.range(F.length);
      // удары: строка k — удар с F_{k−1} в F_k
      const K = Math.min(s.steps, 10);
      const lo = Math.max(-1.6 * s.target, Math.min(0, ...F.slice(0, K + 1)));
      const hi = Math.min(2.6 * s.target, Math.max(s.target, ...F.slice(0, K + 1)));
      const pad = 0.06 * (hi - lo || 1);
      const ax = { x1: [], y1: [], x2: [], y2: [] };
      for (let k = 1; k <= K; k++) {
        ax.x1.push(F[k - 1]);
        ax.x2.push(F[k]);
        ax.y1.push(-k);
        ax.y2.push(-k);
      }
      shots.opts.y.ticks = U.range(K, 1).map((k) => -k);
      shots.render([
        { type: 'vline', x: s.target, color: 'ink2', dash: '5 4', width: 1.4 },
        { type: 'vline', x: 0, color: 'axis', width: 1 },
        { type: 'text', x: s.target, y: -0.3, dx: -5, dy: 12, anchor: 'end', text: 'лунка y = ' + s.target },
        { type: 'arrows', ...ax, color: 'tree', width: 2 },
        { type: 'points', x: F.slice(1, K + 1), y: U.range(K, 1).map((k) => -k), color: 'model', r: 4.5, tooltip: (i) => [{ label: 'после удара ' + (i + 1), value: 'F = ' + U.fmt(F[i + 1], 4) }, { label: 'до лунки', value: U.fmt(r[i + 1], 4) }] },
      ], { x: [lo - pad, hi + pad], y: [-K - 0.7, 0.4] });
      plot.render([
        { type: 'hline', y: s.target, color: 'ink2', dash: '5 4', width: 1.2, text: 'цель y = ' + s.target },
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: ms, y: r, color: 'tree', label: 'остаток y − F_m', width: 2 },
        { type: 'points', x: ms, y: r, color: 'tree', r: 3, legend: false },
        { type: 'line', x: ms, y: F, color: 'model', label: 'прогноз F_m', width: 2.4 },
        { type: 'points', x: ms, y: F, color: 'model', r: 3.5, legend: false },
      ], { y: [Math.max(-3 * s.target, Math.min(0, ...F, ...r)) - 1, Math.min(4 * s.target, Math.max(s.target, ...F, ...r)) + 1.5] });
      const k = 1 - s.nu;
      stats.set('F', U.fmt(F[F.length - 1], 4));
      stats.set('r', U.fmt(r[r.length - 1], 4));
      stats.set('k', U.fmt(k, 2));
      stats.set('n1', stepsTo1pct());
      const after = U.fmt(100 * Math.pow(Math.abs(k), s.steps), 3) + ' %';
      if (Math.abs(k) >= 1)
        note.innerHTML = '<b>|1 − ν| ≥ 1: остаток не уменьшается.</b> Каждый удар перебрасывает мяч через лунку всё дальше (или, при ν = 2, ровно на то же расстояние). Это <b>расходимость</b>: слишком смелый шаг хуже, чем никакой.';
      else if (k < 0)
        note.innerHTML = 'ν > 1: остаток каждый раз <b>меняет знак</b> — мяч перелетает лунку, — но по модулю уменьшается в ' + U.fmt(1 / Math.abs(k), 2) + ' раза, потому что |1 − ν| = ' + U.fmt(Math.abs(k), 2) + ' < 1. После ' + s.steps + ' шагов остаётся ' + after + ' исходной ошибки.';
      else if (k === 0)
        note.innerHTML = 'ν = 1: «ученик» точен, и модель прибавляет весь остаток — цель достигнута за один шаг. С настоящими деревьями так не бывает: их ответы неточны, и брать их целиком рискованно (см. шаг 6).';
      else
        note.innerHTML = 'Каждый шаг умножает остаток на 1 − ν = ' + U.fmt(k, 2) + ': r<sub>m</sub> = (1 − ν)<sup>m</sup>·y. После M = ' + s.steps + ' шагов остаётся ' + after + ' исходной ошибки' + (s.nu < 0.2 ? ' — шаги осторожные, но их нужно много.' : '.');
    }
    w.pythonAction(() =>
      'y, nu, M = ' + s.target + ', ' + U.pyNum(s.nu) + ', ' + s.steps + '\nF = 0.0                  # F_0: стартуем с нуля\nfor m in range(1, M + 1):\n    r = y - F            # остаток: сколько осталось до цели\n    F = F + nu * r       # «ученик» предсказал остаток точно, берём его долю ν\n    print(f"шаг {m:2d}: F = {F:9.4f}, остаток = {y - F:9.4f}, (1 - nu)^m * y = {(1 - nu) ** m * y:9.4f}")\n'
    );
    tCtl.el.title = 'Значение, которое модель должна предсказать';
    draw();
  });

  /* =================================================================================
   * hand-boost — бустинг вручную на шести квартирах
   * ================================================================================= */
  const FLATS6 = { x: [30, 40, 50, 60, 70, 80], y: [3, 5, 4, 8, 9, 13] };
  const MIDS = [35, 45, 55, 65, 75];
  const MAX_TREES = 8;

  /** Пень на остатках r с порогом t: средние слева/справа и ошибка пня. */
  function stumpAt(r, t) {
    const L = [];
    const R = [];
    FLATS6.x.forEach((x, i) => (x <= t ? L : R).push(r[i]));
    const mL = L.length ? U.mean(L) : 0;
    const mR = R.length ? U.mean(R) : 0;
    let sse = 0;
    FLATS6.x.forEach((x, i) => {
      const d = r[i] - (x <= t ? mL : mR);
      sse += d * d;
    });
    return { t, L: mL, R: mR, nL: L.length, nR: R.length, sse };
  }
  /** Лучший порог: первый минимум ошибки среди середин между соседями (как в RegressionTree). */
  function bestStump(r) {
    let best = null;
    for (const t of MIDS) {
      const st = stumpAt(r, t);
      if (!best || st.sse < best.sse - 1e-12) best = st;
    }
    return best;
  }

  GBC.widget('hand-boost', (el) => {
    const n = FLATS6.x.length;
    const s = { nu: 0.5, k: 0, over: {} };
    const w = ui.shell(el, {
      title: 'Бустинг вручную: шесть квартир',
      sub: 'Нажимайте «шаг вперёд»: каждое дерево проходит три фазы — остатки, обучение пня на остатках, обновление модели. Во второй фазе порог пня можно перетащить самому.',
    });
    const player = ui.player(w.controls, {
      label: 'Фаза алгоритма', min: 0, max: 3 * MAX_TREES, value: 0, fps: 1.2,
      format: (v) => (v === 0 ? 'старт' : 'дерево ' + Math.ceil(v / 3) + ', ' + ['остатки', 'пень', 'обновление'][(v - 1) % 3]),
      onChange: (v) => ((s.k = v), draw()),
    });
    ui.segmented(w.controls, {
      label: 'Темп обучения ν',
      options: [{ value: 0.2, label: '0.2' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }],
      value: s.nu,
      onChange: (v) => ((s.nu = v), draw()),
    });
    const algo = algoBox(w.controls, [
      { text: '1  F_0 ← среднее y' },
      { text: '2  для m = 1, 2, …, M:' },
      { text: '3  r_i ← y_i − F_{m−1}(x_i)', indent: 1 },
      { text: '4  h_m ← пень(x, r)', indent: 1 },
      { text: '5  F_m ← F_{m−1} + ν·h_m', indent: 1 },
    ]);
    const bestBtn = ui.button(w.controls, { label: 'Вернуть лучший порог', small: true, kind: 'ghost', onClick: () => { delete s.over[curM()]; draw(); } });
    bestBtn.style.alignSelf = 'flex-start';

    const top = new GBC.Plot(w.main, { height: 270, x: { label: 'площадь, м²', domain: [25, 85] }, y: { label: 'цена, млн', domain: [0, 15] } });
    top.setTitle('Данные и модель F');
    const bot = new GBC.Plot(w.main, { height: 210, x: { label: 'площадь, м²', domain: [25, 85] }, y: { label: 'остаток r' } });
    bot.setTitle('Остатки и пень h_m, который на них учится');
    const note = w.note('', true);
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const stats = ui.stats(w.foot, [
      { key: 'm', label: 'Деревьев в модели' },
      { key: 'sse', label: 'Сумма квадратов остатков' },
      { key: 'mse', label: 'MSE модели' },
      { key: 't', label: 'Порог текущего пня' },
    ]);

    const curM = () => Math.max(1, Math.ceil(s.k / 3));
    /** Полная история: модели F_0 … F_M и пни, с учётом порогов, выбранных руками. */
    function history() {
      const F0 = U.mean(FLATS6.y);
      const F = [FLATS6.y.map(() => F0)];
      const trees = [null];
      for (let m = 1; m <= MAX_TREES; m++) {
        const prev = F[m - 1];
        const r = FLATS6.y.map((v, i) => v - prev[i]);
        const best = bestStump(r);
        const st = s.over[m] !== undefined ? stumpAt(r, s.over[m]) : best;
        const h = FLATS6.x.map((x) => (x <= st.t ? st.L : st.R));
        trees.push(Object.assign({ r, h, best, sseR: U.sum(r.map((v) => v * v)) }, st));
        F.push(prev.map((f, i) => f + s.nu * h[i]));
      }
      return { F0, F, trees };
    }
    const sseOf = (Fm) => U.sum(FLATS6.y.map((v, i) => (v - Fm[i]) * (v - Fm[i])));
    /** Ступенчатая функция модели F_m по всем порогам её пней. */
    function modelSteps(hist, m) {
      const ts = [];
      for (let j = 1; j <= m; j++) ts.push(hist.trees[j].t);
      const cuts = [25].concat(Array.from(new Set(ts)).sort((a, b) => a - b), [85]);
      const segs = [];
      for (let q = 0; q + 1 < cuts.length; q++) {
        const mid = (cuts[q] + cuts[q + 1]) / 2;
        let v = hist.F0;
        for (let j = 1; j <= m; j++) v += s.nu * (mid <= hist.trees[j].t ? hist.trees[j].L : hist.trees[j].R);
        segs.push({ x0: cuts[q], x1: cuts[q + 1], value: v });
      }
      return segs;
    }
    const sign = (v) => (v > 0 ? '+' : '') + U.fmt(v, 3);

    function draw() {
      const hist = history();
      const k = s.k;
      const m = curM();
      const phase = k === 0 ? 'init' : ['resid', 'fit', 'update'][(k - 1) % 3];
      const mModel = phase === 'update' ? m : k === 0 ? 0 : m - 1; // сколько деревьев уже в модели
      const Fcur = hist.F[mModel];
      const tr = hist.trees[m];
      algo.set(phase === 'init' ? 0 : phase === 'resid' ? 2 : phase === 'fit' ? 3 : 4);
      bestBtn.hidden = phase !== 'fit' || s.over[m] === undefined;

      // --- верхний график: данные, модель, остатки
      const L1 = [];
      if (phase === 'update') L1.push({ type: 'steps', segments: modelSteps(hist, m - 1), color: 'model-prev', width: 1.8, dash: '5 4', label: 'F_{' + (m - 1) + '}(x)' });
      const showRes = phase !== 'init';
      if (showRes) L1.push({ type: 'segments', x1: FLATS6.x, y1: FLATS6.y, x2: FLATS6.x, y2: Fcur, color: 'residual', width: 2, opacity: phase === 'update' ? 0.5 : 0.85 });
      L1.push({ type: 'steps', segments: modelSteps(hist, mModel), color: 'model', width: 2.6, label: 'F_{' + mModel + '}(x)' });
      L1.push({
        type: 'points', x: FLATS6.x, y: FLATS6.y, color: 'data', r: 5.5, label: 'квартиры',
        tooltip: (i) => [{ label: 'квартира', value: '№' + (i + 1) }, { label: 'площадь', value: FLATS6.x[i] + ' м²' }, { label: 'цена y', value: FLATS6.y[i] + ' млн' }, { label: 'прогноз F', value: U.fmt(Fcur[i], 4) }, { label: 'остаток', value: sign(FLATS6.y[i] - Fcur[i]) }],
      });
      if (phase === 'resid')
        L1.push({ type: 'text', items: FLATS6.x.map((x, i) => ({ x, y: (FLATS6.y[i] + Fcur[i]) / 2, dx: 6, dy: 4, text: sign(FLATS6.y[i] - Fcur[i]) })) });
      top.render(L1);

      // --- нижний график: остатки и пень
      const r = phase === 'init' ? null : tr.r;
      const ext = r ? U.extent(r.concat([0])) : [-1, 1];
      const span = Math.max(1, ext[1] - ext[0]);
      const L2 = [{ type: 'hline', y: 0, color: 'axis', width: 1 }];
      if (r) {
        if (phase !== 'resid') {
          L2.push({ type: 'segments', x1: FLATS6.x, y1: r, x2: FLATS6.x, y2: tr.h, color: 'tree', width: 1.4, opacity: 0.55, dash: '3 3' });
          L2.push({ type: 'steps', segments: [{ x0: 25, x1: tr.t, value: tr.L }, { x0: tr.t, x1: 85, value: tr.R }], color: 'tree', width: 2.6, label: 'пень h_' + m + '(x)' });
          if (phase === 'update')
            L2.push({ type: 'steps', segments: [{ x0: 25, x1: tr.t, value: s.nu * tr.L }, { x0: tr.t, x1: 85, value: s.nu * tr.R }], color: 'tree', width: 1.6, dash: '5 4', label: 'ν·h_' + m + '(x)' });
          L2.push({
            type: 'vline', x: tr.t, color: 'ink2', width: 1.4, dash: '4 3',
            draggable: phase === 'fit',
            onDrag: (v) => {
              let bt = MIDS[0];
              for (const c of MIDS) if (Math.abs(c - v) < Math.abs(bt - v)) bt = c;
              if (s.over[m] === bt) return;
              s.over[m] = bt;
              for (let j = m + 1; j <= MAX_TREES; j++) delete s.over[j];
              draw();
            },
          });
        }
        if (phase !== 'resid') {
          const right = tr.t > 60;
          L2.push({ type: 'text', x: tr.t, y: ext[1] + 0.2 * span, dx: right ? -6 : 6, dy: 13, anchor: right ? 'end' : 'start', text: 'площадь ≤ ' + U.fmt(tr.t, 0) + '?' + (phase === 'fit' ? ' ↔ тащите' : '') });
        }
        L2.push({
          type: 'points', x: FLATS6.x, y: r, color: 'residual', r: 5.5, label: 'остатки',
          tooltip: (i) => [{ label: 'квартира', value: '№' + (i + 1) }, { label: 'остаток r', value: sign(r[i]) }, { label: 'пень h', value: phase === 'resid' ? '—' : U.fmt(tr.h[i], 4) }],
        });
      } else {
        L2.push({ type: 'text', x: 55, y: 0, dy: -10, anchor: 'middle', text: 'остатков пока нет' });
      }
      bot.render(L2, { y: [ext[0] - 0.15 * span, ext[1] + 0.2 * span] });

      // --- таблица
      tableBox.textContent = '';
      const cols = ['№', 'площадь x', 'цена y'];
      let rows;
      if (phase === 'init') {
        cols.push('F_0(x)', 'ошибка y − F_0');
        rows = FLATS6.x.map((x, i) => [i + 1, x, FLATS6.y[i], U.fmt(hist.F0, 4), sign(FLATS6.y[i] - hist.F0)]);
      } else {
        const Fp = hist.F[m - 1];
        cols.push('F_{' + (m - 1) + '}(x)', 'остаток r');
        if (phase !== 'resid') cols.push('h_' + m + '(x)');
        if (phase === 'update') cols.push('F_' + m + ' = F_{' + (m - 1) + '} + ' + U.fmt(s.nu, 2) + '·h_' + m);
        rows = FLATS6.x.map((x, i) => {
          const row = [i + 1, x, FLATS6.y[i], U.fmt(Fp[i], 4), sign(tr.r[i])];
          if (phase !== 'resid') row.push(sign(tr.h[i]));
          if (phase === 'update') row.push(U.fmt(hist.F[m][i], 4));
          return row;
        });
      }
      ui.table(tableBox, { columns: cols, rows, numeric: true });

      // --- показатели и рассказ
      const sseNow = sseOf(Fcur);
      stats.set('m', String(mModel));
      stats.set('sse', U.fmt(sseNow, 4));
      stats.set('mse', U.fmt(sseNow / n, 4));
      stats.set('t', phase === 'init' || phase === 'resid' ? '—' : 'площадь ≤ ' + U.fmt(tr.t, 1));
      if (phase === 'init') {
        note.innerHTML = '<b>Старт.</b> Без признаков лучший прогноз — среднее цен: F<sub>0</sub> = (3 + 5 + 4 + 8 + 9 + 13) / 6 = <b>7 млн</b> для любой квартиры. Сумма квадратов ошибок: 16 + 4 + 9 + 1 + 4 + 36 = <b>70</b>. Нажмите ⏭, чтобы начать первое дерево.';
      } else if (phase === 'resid') {
        note.innerHTML = '<b>Дерево ' + m + ', фаза 1 — остатки.</b> Для каждой квартиры считаем r = y − F<sub>' + (m - 1) + '</sub>: сколько модель недодала (+) или передала (−). Подписи у серых отрезков — эти числа. Их сумма квадратов — <b>' + U.fmt(tr.sseR, 4) + '</b>: столько ошибки осталось.';
      } else if (phase === 'fit') {
        const own = s.over[m] !== undefined && Math.abs(tr.sse - tr.best.sse) > 1e-9;
        note.innerHTML = '<b>Дерево ' + m + ', фаза 2 — пень учится на остатках.</b> Пень задаёт один вопрос «площадь ≤ t?» и в каждой группе записывает <b>средний остаток</b>: слева ' + sign(tr.L) + ', справа ' + sign(tr.R) + '. ' +
          'Ошибка пня на остатках: ' + U.fmt(tr.sse, 4) + (own ? ' — хуже, чем у лучшего порога ' + U.fmt(tr.best.t, 0) + ' (' + U.fmt(tr.best.sse, 4) + '). Попробуйте другие пороги или верните лучший.' : ' — это наименьшая ошибка из пяти возможных порогов. Перетащите пунктир, чтобы сравнить с другими.');
      } else {
        const before = sseOf(hist.F[m - 1]);
        note.innerHTML = '<b>Дерево ' + m + ', фаза 3 — обновление.</b> F<sub>' + m + '</sub> = F<sub>' + (m - 1) + '</sub> + ' + U.fmt(s.nu, 2) + '·h<sub>' + m + '</sub>: квартирам слева от ' + U.fmt(tr.t, 0) + ' м² прибавили ' + sign(s.nu * tr.L) + ', справа — ' + sign(s.nu * tr.R) + '. ' +
          'Сумма квадратов остатков: ' + U.fmt(before, 4) + ' → <b>' + U.fmt(sseNow, 4) + '</b>' + (sseNow < before - 1e-9 ? '.' : ' — не уменьшилась: неудачный порог или слишком большой ν.');
      }
    }
    w.pythonAction(() => {
      const hist = history();
      const m = s.k === 0 ? 0 : (s.k - 1) % 3 === 2 ? curM() : curM() - 1;
      const ts = U.range(m, 1).map((j) => hist.trees[j].t);
      const manual = Object.keys(s.over).some((j) => Number(j) <= m);
      let code = 'import numpy as np\n\nx = np.array([30, 40, 50, 60, 70, 80.])   # площадь, м²\ny = np.array([3, 5, 4, 8, 9, 13.])         # цена, млн\nnu = ' + U.pyNum(s.nu) + '\n\n' +
        'F = np.full_like(y, y.mean())              # F_0 = среднее = 7\nprint("F_0:", F, " сумма квадратов остатков:", ((y - F) ** 2).sum())\n' +
        'for m, t in enumerate(' + JSON.stringify(ts) + ', start=1):   # пороги пней\n' +
        '    r = y - F                                   # 1) остатки\n' +
        '    left, right = r[x <= t].mean(), r[x > t].mean()  # 2) пень: средний остаток в каждой группе\n' +
        '    h = np.where(x <= t, left, right)\n' +
        '    F = F + nu * h                              # 3) обновление\n' +
        '    print(f"дерево {m}: площадь <= {t}: {left:+.3f} / {right:+.3f};  F = {np.round(F, 3)};  SSE = {((y - F) ** 2).sum():.4f}")\n';
      if (!manual && m > 0)
        code += '\n# Проверка: те же прогнозы даёт scikit-learn с пнями (max_depth=1)\nfrom sklearn.ensemble import GradientBoostingRegressor\n' +
          'sk = GradientBoostingRegressor(n_estimators=' + m + ', learning_rate=nu, max_depth=1).fit(x[:, None], y)\nprint("sklearn:", np.round(sk.predict(x[:, None]), 3))\n';
      return code;
    });
    draw();
  });

  /* =================================================================================
   * one-vs-many — пень, глубокое дерево, бэггинг, бустинг
   * ================================================================================= */
  GBC.widget('one-vs-many', (el) => {
    const train = GBC.datasets.regression1d({ kind: 'wave', n: 60, noise: 0.35, seed: 7 });
    const test = GBC.datasets.regression1d({ kind: 'wave', n: 300, noise: 0.35, seed: 107 });
    const NOISE2 = 0.35 * 0.35;
    const s = { mode: 'boost', depth: 8, B: 50, M: 100, nu: 0.3, showTest: false, truth: true };
    const w = ui.shell(el, {
      title: 'Один против многих',
      sub: 'Одни и те же 60 точек. Слева — модель, справа — её ошибка на 300 новых точках, которых модель не видела. Пунктир на правом графике — шум данных σ² = 0.1225: ниже него не опуститься.',
    });
    const MODES = [
      { value: 'stump', label: 'Пень', title: 'Одно дерево глубины 1' },
      { value: 'deep', label: 'Дерево', title: 'Одно глубокое дерево' },
      { value: 'bag', label: 'Бэггинг', title: 'Среднее B глубоких деревьев' },
      { value: 'boost', label: 'Бустинг', title: 'Сумма M пней' },
    ];
    ui.segmented(w.controls, { label: 'Модель', options: MODES, value: s.mode, onChange: (v) => ((s.mode = v), sync(), draw()) });
    const dCtl = ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 12, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const bCtl = ui.slider(w.controls, { label: 'Деревьев в бэггинге B', min: 1, max: 100, step: 1, value: s.B, format: String, onInput: (v) => ((s.B = v), draw()) });
    const mCtl = ui.slider(w.controls, { label: 'Пней в бустинге M', min: 1, max: 300, step: 1, value: s.M, format: String, onInput: (v) => ((s.M = v), draw()) });
    const nuCtl = ui.slider(w.controls, { label: 'Темп бустинга ν', min: 0.05, max: 1, step: 0.05, value: s.nu, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.nu = v), (boost = null), draw()) });
    ui.toggle(w.controls, { label: 'Новые (тестовые) точки', checked: s.showTest, onChange: (v) => ((s.showTest = v), draw()) });
    ui.toggle(w.controls, { label: 'Истинная функция', checked: s.truth, onChange: (v) => ((s.truth = v), draw()) });
    function sync() {
      dCtl.el.hidden = !(s.mode === 'deep' || s.mode === 'bag');
      bCtl.el.hidden = s.mode !== 'bag';
      mCtl.el.hidden = s.mode !== 'boost';
      nuCtl.el.hidden = s.mode !== 'boost';
    }
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 320, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-1.6, 4.6] } });
    const p2 = new GBC.Plot(box, { height: 320, x: { label: '', domain: [-0.6, 3.6], ticks: [0, 1, 2, 3], format: (v) => ['пень', 'дерево', 'бэггинг', 'бустинг'][Math.round(v)] || '' }, y: { label: 'MSE на новых данных' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [
      { key: 'tr', label: 'MSE на обучении' },
      { key: 'te', label: 'MSE на новых данных' },
      { key: 'n', label: 'Деревьев' },
      { key: 'leaves', label: 'Листьев всего' },
    ]);
    const grid = U.linspace(0, 10, 501);
    const gridX = grid.map((v) => [v]);
    const truth = grid.map((v) => GBC.datasets.trueFunction('wave', v));
    const trees = {};
    const treeOf = (d) => trees[d] || (trees[d] = new GBC.RegressionTree({ maxDepth: d }).fit(train.X, train.y.map((v) => -v)));
    const bags = {};
    const bagOf = (d) => bags[d] || (bags[d] = new GBC.BaggingTrees({ nEstimators: 100, maxDepth: d, seed: 0 }).fit(train.X, train.y));
    let boost = null;
    const boostOf = () => boost || (boost = new GBC.GradientBoosting({ nEstimators: 300, learningRate: s.nu, maxDepth: 1 }).fit(train.X, train.y));
    const mse = (y, p) => GBC.metrics.mse(y, p);

    /** Прогнозы модели mode на наборе X. */
    function predictor(mode) {
      if (mode === 'stump') {
        const t = treeOf(1);
        return { f: (X) => t.predict(X), n: 1, leaves: t.leaves.length };
      }
      if (mode === 'deep') {
        const t = treeOf(s.depth);
        return { f: (X) => t.predict(X), n: 1, leaves: t.leaves.length };
      }
      if (mode === 'bag') {
        const b = bagOf(s.depth);
        let lv = 0;
        for (let i = 0; i < s.B; i++) lv += b.trees[i].leaves.length;
        return { f: (X) => b.predict(X, s.B), n: s.B, leaves: lv, members: b.trees.slice(0, Math.min(s.B, 12)) };
      }
      const g = boostOf();
      return { f: (X) => g.predictRaw(X, s.M), n: s.M, leaves: 2 * s.M };
    }
    function draw() {
      const P = predictor(s.mode);
      const layers = [];
      if (s.showTest) layers.push({ type: 'points', x: test.x, y: test.y, color: 'test', r: 2.6, opacity: 0.55, label: 'новые точки' });
      if (s.truth) layers.push({ type: 'line', x: grid, y: truth, color: 'truth', dash: '5 4', width: 1.6, label: 'истина f(x)' });
      if (P.members) for (const t of P.members) layers.push({ type: 'line', x: grid, y: t.predict(gridX), color: 'model-prev', width: 1, opacity: 0.45, curve: 'step', hover: false });
      layers.push({ type: 'points', x: train.x, y: train.y, color: 'data', r: 4, label: 'обучение' });
      layers.push({ type: 'line', x: grid, y: P.f(gridX), color: 'model', width: 2.4, curve: 'step', label: { stump: 'пень', deep: 'дерево глубины ' + s.depth, bag: 'среднее ' + s.B + ' деревьев', boost: 'сумма ' + s.M + ' пней' }[s.mode] });
      p1.render(layers);
      const te = MODES.map((m) => mse(test.y, predictor(m.value).f(test.X)));
      p2.render([
        { type: 'bars', x: [0, 1, 2, 3], y: te, width: 0.62, maxPx: 56, color: (i) => (MODES[i].value === s.mode ? 'model' : 'model-prev'), tooltip: (i) => [{ label: MODES[i].label, value: U.fmt(te[i], 4) }] },
        { type: 'hline', y: NOISE2, color: 'ink2', dash: '4 3', width: 1.2 },
        { type: 'text', x: -0.55, y: Math.max(...te) * 1.16, dy: 4, text: 'пунктир — шум σ² = 0.1225' },
        { type: 'text', items: te.map((v, i) => ({ x: i, y: v, dy: -6, anchor: 'middle', text: U.fmt(v, 3), bold: MODES[i].value === s.mode })) },
      ], { y: [0, Math.max(...te) * 1.22] });
      const trM = mse(train.y, P.f(train.X));
      const teM = te[MODES.findIndex((m) => m.value === s.mode)];
      stats.set('tr', U.fmt(trM, 4));
      stats.set('te', U.fmt(teM, 4));
      stats.set('n', String(P.n));
      stats.set('leaves', String(P.leaves));
      const txt = {
        stump: 'Один <b>пень</b> — слабый ученик: один вопрос «x ≤ t?» и два числа. Он улавливает только «слева ниже, справа выше» и ошибается и на обучении, и на новых данных — это <b>недообучение</b>.',
        deep: 'Одно <b>глубокое дерево</b> (' + P.leaves + ' листьев) подстраивается почти под каждую точку: на обучении MSE ' + U.fmt(trM, 3) + ', а на новых данных ' + U.fmt(teM, 3) + '. Оно выучило и закономерность, и <b>шум</b>.',
        bag: '<b>Бэггинг</b> усредняет B глубоких деревьев, обученных на разных случайных подвыборках (светлые линии — первые из них). Каждое дерево дрожит, а среднее — спокойнее: разброс уменьшается.',
        boost: '<b>Бустинг</b> складывает M пней, каждый из которых исправляет остатки суммы предыдущих с темпом ν = ' + U.fmt(s.nu, 2) + '. Из слабых учеников получается гладкая и точная модель.',
      }[s.mode];
      note.innerHTML = txt + ' Ошибка на новых данных: <b>' + U.fmt(teM, 3) + '</b> при пороге шума 0.1225.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, RegressionTree, BaggingTrees, GBRegressor\nfrom gbcourse.metrics import mse\n\n' +
      'X, y = datasets.regression_1d(kind="wave", n=60, noise=0.35, seed=7)          # обучение\nXt, yt = datasets.regression_1d(kind="wave", n=300, noise=0.35, seed=107)     # новые данные\n\n' +
      'models = {\n    "пень": RegressionTree(max_depth=1).fit(X, -y),\n    "дерево глубины ' + s.depth + '": RegressionTree(max_depth=' + s.depth + ').fit(X, -y),\n' +
      '    "бэггинг ' + s.B + ' деревьев": BaggingTrees(n_estimators=' + s.B + ', max_depth=' + s.depth + ', seed=0).fit(X, y),\n' +
      '    "бустинг ' + s.M + ' пней": GBRegressor(n_estimators=' + s.M + ', learning_rate=' + U.pyNum(s.nu) + ', max_depth=1).fit(X, y),\n}\n' +
      'for name, model in models.items():\n    print(f"{name:24s} MSE обучение = {mse(y, model.predict(X)):.4f}   новые данные = {mse(yt, model.predict(Xt)):.4f}")\n' +
      'print("шум σ² =", 0.35 ** 2)\n'
    );
    sync();
    draw();
  });

  /* =================================================================================
   * ensemble-schema — бэггинг и бустинг на одной схеме
   * ================================================================================= */
  GBC.widget('ensemble-schema', (el) => {
    const w = ui.shell(el, { title: 'Два способа собрать ансамбль', sub: 'Бэггинг учит деревья независимо и усредняет. Бустинг учит их по очереди: каждое следующее видит ошибки суммы предыдущих.', noControls: true, foot: false });
    const grid = H('div', { class: 'grid-2' });
    w.main.appendChild(grid);
    /** Подпись с индексами: 'F_{m−1}' → F + нижний индекс (tspan). */
    const T = (x, y, txt, o = {}) => {
      const t = S('text', { x, y, 'text-anchor': o.anchor || 'middle', style: 'font-size:' + (o.size || 12) + 'px;fill:var(' + (o.color || '--ink') + ');font-weight:' + (o.bold ? 650 : 400) });
      for (const part of String(txt).split(/(_\{[^}]*\}|_[A-Za-z0-9])/)) {
        if (!part) continue;
        if (part[0] === '_') t.appendChild(S('tspan', { 'baseline-shift': 'sub', 'font-size': '75%' }, part[1] === '{' ? part.slice(2, -1) : part.slice(1)));
        else t.appendChild(document.createTextNode(part));
      }
      return t;
    };
    const box = (x, y, wd, ht, fill = '--surface-2', stroke = '--c-axis') => S('rect', { x, y, width: wd, height: ht, rx: 8, style: 'fill:var(' + fill + ');stroke:var(' + stroke + ');stroke-width:1.3' });
    const arrow = (x1, y1, x2, y2, color = '--muted', dash = null) => {
      const g = S('g', { style: 'stroke:var(' + color + ');fill:var(' + color + ')' });
      const len = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / len;
      const uy = (y2 - y1) / len;
      g.appendChild(S('line', { x1, y1, x2: x2 - ux * 6, y2: y2 - uy * 6, 'stroke-width': 1.6, 'stroke-dasharray': dash }));
      g.appendChild(S('path', { d: 'M' + x2 + ',' + y2 + 'L' + (x2 - ux * 8 - uy * 4) + ',' + (y2 - uy * 8 + ux * 4) + 'L' + (x2 - ux * 8 + uy * 4) + ',' + (y2 - uy * 8 - ux * 4) + 'Z', stroke: 'none' }));
      return g;
    };
    /** Значок дерева: узел и два листа. big — глубокое дерево. */
    const treeIcon = (cx, cy, color, big) => {
      const g = S('g', { style: 'stroke:var(' + color + ');fill:var(' + color + ')' });
      const lv = big ? [[0, -14], [-9, -2], [9, -2], [-14, 10], [-4, 10], [4, 10], [14, 10]] : [[0, -8], [-8, 7], [8, 7]];
      const ed = big ? [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]] : [[0, 1], [0, 2]];
      for (const [a, b] of ed) g.appendChild(S('line', { x1: cx + lv[a][0], y1: cy + lv[a][1], x2: cx + lv[b][0], y2: cy + lv[b][1], 'stroke-width': 1.4 }));
      for (const [dx, dy] of lv) g.appendChild(S('circle', { cx: cx + dx, cy: cy + dy, r: big ? 2.6 : 3.2, stroke: 'none' }));
      return g;
    };
    // --- бэггинг
    const sv1 = S('svg', { viewBox: '0 0 360 300', width: '100%', role: 'img', 'aria-label': 'Бэггинг: из данных берут несколько случайных подвыборок, на каждой независимо учат глубокое дерево, прогнозы усредняют' });
    sv1.appendChild(T(180, 18, 'Бэггинг: параллельно, потом среднее', { bold: true, size: 13 }));
    sv1.appendChild(box(120, 32, 120, 30));
    sv1.appendChild(T(180, 52, 'данные (x, y)'));
    const cols = [50, 130, 210, 310];
    cols.forEach((cx, i) => {
      const last = i === cols.length - 1;
      sv1.appendChild(arrow(180, 62, cx, 92));
      sv1.appendChild(box(cx - 33, 94, 66, 26, '--surface'));
      sv1.appendChild(T(cx, 112, last ? 'выборка B' : 'выборка ' + (i + 1), { size: 11, color: '--ink-2' }));
      sv1.appendChild(arrow(cx, 120, cx, 140));
      sv1.appendChild(treeIcon(cx, 164, '--c-model', true));
      sv1.appendChild(T(cx, 196, last ? 'дерево B' : 'дерево ' + (i + 1), { size: 11, color: '--ink-2' }));
      sv1.appendChild(arrow(cx, 202, 180, 234));
    });
    sv1.appendChild(T(260, 112, '…', { size: 15, color: '--muted', bold: true }));
    sv1.appendChild(T(260, 168, '…', { size: 15, color: '--muted', bold: true }));
    sv1.appendChild(S('circle', { cx: 180, cy: 250, r: 16, style: 'fill:var(--accent-soft);stroke:var(--accent);stroke-width:1.4' }));
    sv1.appendChild(T(180, 254, 'ср.', { bold: true, color: '--accent' }));
    sv1.appendChild(T(180, 288, 'деревья не знают друг о друге → меньше разброс', { size: 11.5, color: '--ink-2' }));
    // --- бустинг
    const sv2 = S('svg', { viewBox: '0 0 360 300', width: '100%', role: 'img', 'aria-label': 'Бустинг: модель начинается с константы F0, каждое следующее маленькое дерево учится на остатках текущей суммы и прибавляется с темпом ν' });
    sv2.appendChild(T(180, 18, 'Бустинг: по очереди, каждое — на ошибках', { bold: true, size: 13 }));
    const xs = [40, 130, 220, 320];
    const labels = ['F_0', 'F_1', 'F_2', 'F_M'];
    xs.forEach((cx, i) => {
      sv2.appendChild(box(cx - 25, 40, 50, 30, '--surface', '--c-model'));
      sv2.appendChild(T(cx, 60, labels[i], { bold: true, color: '--c-model' }));
      if (i < xs.length - 1) sv2.appendChild(arrow(cx + 25, 55, xs[i + 1] - 25, 55, '--c-model'));
    });
    sv2.appendChild(T(270, 50, '…', { size: 15, color: '--muted', bold: true }));
    [[40, 130, 1], [130, 220, 2]].forEach(([a, b, m]) => {
      const cx = (a + b) / 2;
      sv2.appendChild(arrow(a + 4, 72, cx - 9, 112, '--c-residual', '4 3'));
      sv2.appendChild(treeIcon(cx, 126, '--c-tree', false));
      sv2.appendChild(T(cx, 150, 'h_' + m, { bold: true, color: '--c-tree' }));
      sv2.appendChild(arrow(cx + 9, 112, b - 4, 73, '--c-tree'));
    });
    // легенда стрелок
    const lg = S('g');
    lg.appendChild(S('line', { x1: 40, y1: 178, x2: 66, y2: 178, style: 'stroke:var(--c-residual);stroke-width:1.6;stroke-dasharray:4 3' }));
    lg.appendChild(T(72, 182, 'остатки текущей модели', { size: 11, color: '--ink-2', anchor: 'start' }));
    lg.appendChild(S('line', { x1: 40, y1: 198, x2: 66, y2: 198, style: 'stroke:var(--c-tree);stroke-width:1.6' }));
    lg.appendChild(T(72, 202, 'дерево прибавляется с темпом ν', { size: 11, color: '--ink-2', anchor: 'start' }));
    sv2.appendChild(lg);
    sv2.appendChild(T(180, 232, 'F_m(x) = F_{m−1}(x) + ν · h_m(x)', { size: 12.5 }));
    sv2.appendChild(T(180, 252, 'h_m учится предсказывать y − F_{m−1}(x)', { size: 11.5, color: '--ink-2' }));
    sv2.appendChild(T(180, 278, 'маленькие деревья исправляют систематическую', { size: 11.5, color: '--ink-2' }));
    sv2.appendChild(T(180, 294, 'ошибку суммы → меньше смещение', { size: 11.5, color: '--ink-2' }));
    grid.append(H('div', null, sv1), H('div', null, sv2));
  });

  /* =================================================================================
   * concept-map — карта формулы (та же, что на главной)
   * ================================================================================= */
  GBC.widget('concept-map', (el) => {
    const map = GBC_MANIFEST && GBC_MANIFEST.course.concept_map;
    if (!map) return;
    el.classList.add('formula-map');
    GBC.page.renderConceptMap(el, map);
  });
})();
