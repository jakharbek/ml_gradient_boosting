/* Урок 15.3: пределы. Часть 1 — последовательности и предел функции в точке.
 * Виджеты: шаги к стене, способы задать последовательность, зоопарк поведений, коридор ε и N(ε),
 * доказательство по ε–N, геометрическая прогрессия, скорость сходимости, монотонная и ограниченная,
 * лестница Ламерея (рекуррентные последовательности), частичные суммы, подход к точке, предел и
 * значение, определение через последовательности (Гейне), односторонние пределы, микроскоп для
 * колебаний. Общие помощники выставлены в GBC.lesson153 — ими пользуется lesson_extra.js (часть 2). */
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
    for (const t of U.linspace(x0, x1, n)) {
      if (o.skip !== undefined && o.skip !== null && Math.abs(t - o.skip) < 1e-9) {
        x.push(t);
        y.push(NaN);
        prev = NaN;
        continue;
      }
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
  /** Большое целое с разделителями разрядов (или в экспоненте, если совсем большое). */
  const fmtInt = (n) => (n === null || n === undefined ? '—' : !Number.isFinite(n) ? '∞' : n < 1e15 ? Math.round(n).toLocaleString('ru-RU') : n.toExponential(2).replace('e+', '·10^'));
  /** Наименьшее N, начиная с которого dev(n) < eps для всех проверенных n ≤ nMax; null — «не найдётся». */
  function scanN(dev, eps, nMax = 100000) {
    let last = 0;
    for (let n = 1; n <= nMax; n++) if (!(dev(n) < eps)) last = n;
    return last > nMax * 0.9 ? null : last + 1;
  }
  /** Наименьшее n с dev(n) < eps для монотонно убывающего dev (уточнение около оценки). */
  function smallestN(dev, eps, guess) {
    let N = Math.max(1, Math.floor(guess) + 1);
    if (N > 1e15) return N;
    while (N > 1 && dev(N - 1) < eps) N--;
    while (!(dev(N) < eps)) N++;
    return N;
  }
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
  /** Горизонтальная таблица «n | aₙ». */
  function rowTable(parent, head, rows) {
    parent.textContent = '';
    ui.table(parent, { columns: head, rows });
  }
  const PHI = (1 + Math.sqrt(5)) / 2;
  const fact = (n) => {
    let r = 1;
    for (let k = 2; k <= n; k++) r *= k;
    return r;
  };

  /* ==============================================================================
   * 0. Шаги к стене: каждый раз половина оставшегося
   * ============================================================================== */
  GBC.widget('half-steps', (el) => {
    const st0 = { k: 0, eps: 0.001, zoom: false, log: false };
    const K = 30;
    const w = ui.shell(el, { title: 'Шаги к стене', sub: 'Каждым шагом проходим половину оставшегося расстояния. Нажмите ▶, включите «лупу у стены» и назовите своё маленькое число ε.' });
    ui.player(w.controls, { label: 'Шаги', min: 0, max: K, value: 0, fps: 2, format: (k) => 'шаг ' + k, onChange: (k) => ((st0.k = k), draw()) });
    ui.slider(w.controls, { label: 'Ваше маленькое число ε', min: 1e-9, max: 0.5, log: true, value: st0.eps, format: (v) => U.fmt(v, 3), onInput: (v) => ((st0.eps = v), draw()) });
    ui.toggle(w.controls, { label: 'Лупа у стены (увеличение растёт вместе с номером шага)', checked: false, onChange: (c) => ((st0.zoom = c), draw()) });
    ui.segmented(w.controls, { label: 'Шкала остатка', value: 'lin', options: [{ value: 'lin', label: 'обычная' }, { value: 'log', label: 'логарифмическая' }], onChange: (v) => ((st0.log = v === 'log'), draw()) });
    const road = new GBC.Plot(w.main, { height: 120, x: { label: 'пройдено, доли пути до стены' }, y: { label: '', domain: [-1, 1], ticks: [] }, margin: { left: 20 }, grid: 'x' });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'номер шага n', domain: [0, K] }, y: { label: 'осталось до стены' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'шаг' }, { key: 'done', label: 'пройдено' }, { key: 'left', label: 'осталось' }, { key: 'N', label: 'шагов, чтобы остаток < ε' }]);
    function draw() {
      const k = st0.k;
      const left = Math.pow(0.5, k);
      const N = smallestN((n) => Math.pow(0.5, n), st0.eps, Math.log2(1 / st0.eps));
      const pos = U.range(k + 1).map((i) => 1 - Math.pow(0.5, i));
      const half = st0.zoom ? Math.max(left * 2.2, 1e-12) : 0.52;
      const xd = st0.zoom ? [1 - 2 * half, 1 + 0.25 * half] : [-0.02, 1.04];
      road.render([
        { type: 'hline', y: 0, color: 'axis', width: 6, opacity: 0.6 },
        { type: 'rect', x0: 1, x1: 1 + 0.25 * half * (st0.zoom ? 1 : 0.16), y0: -0.9, y1: 0.9, fill: 'ink', stroke: 'ink', opacity: 0.85 },
        { type: 'points', x: pos.slice(0, -1), y: pos.slice(0, -1).map(() => 0), color: 'ink2', r: 3, opacity: 0.6 },
        { type: 'points', x: [pos[k]], y: [0], color: 'tree', r: 8, tooltip: () => [['пройдено', U.fmt(pos[k], 12)], ['осталось', U.fmt(left, 4)]] },
        { type: 'text', items: [{ x: 1, y: 0.55, dx: -6, anchor: 'end', text: 'стена' }] },
      ], { x: xd });
      const ns = U.range(k + 1);
      const ys = ns.map((n) => Math.pow(0.5, n));
      plot.opts.y.type = st0.log ? 'log' : undefined;
      plot.opts.y.ticks = st0.log ? [1e-10, 1e-8, 1e-6, 1e-4, 1e-2, 1] : undefined;
      plot.render([
        { type: 'hline', y: st0.eps, color: 'tree', dash: '6 4', text: 'ε = ' + U.fmt(st0.eps, 3) },
        N <= K ? { type: 'vline', x: N, color: 'ink2', dash: '3 3', text: 'n = ' + N } : null,
        { type: 'line', x: ns, y: ys, color: 'model', width: 1.4, hover: false },
        { type: 'points', x: ns, y: ys, color: (i) => (ys[i] < st0.eps ? 'model' : 'muted'), r: 4, tooltip: (i) => [['n', String(i)], ['осталось', '1/' + fmtInt(Math.pow(2, i)) + ' ≈ ' + U.fmt(ys[i], 4)]] },
      ], st0.log ? { y: [1e-10, 1.5] } : { y: [0, 1.05] });
      st.set('k', String(k));
      st.set('done', U.fmt(1 - left, 10));
      st.set('left', k ? '1/' + fmtInt(Math.pow(2, k)) : '1');
      st.set('N', String(N));
      note.innerHTML = (k === 0 ? 'До стены расстояние 1. ' : 'После ' + k + ' шагов осталось 1/' + fmtInt(Math.pow(2, k)) + (k >= 10 ? ' — меньше одной тысячной' : '') + '. ') +
        (st0.zoom && k > 0 ? 'Под лупой картина каждый раз одна и та же: шаг закрывает ровно половину щели, и щель не исчезает. ' : '') +
        'Вы назвали ε = ' + U.fmt(st0.eps, 3) + ' — остаток станет меньше него после <b>' + N + '</b> шагов и дальше будет только уменьшаться. Какое бы ε вы ни назвали, такой номер найдётся: остаток <b>стремится к нулю</b>, а пройденный путь — <b>к 1</b>.';
    }
    w.pythonAction(() => 'left = 1.0\nfor n in range(1, 31):\n    left /= 2\n    print(f"шаг {n:2d}: пройдено {1 - left:.10f}, осталось {left:.2e}")\n\neps = ' + U.pyNum(st0.eps) + '\nn, left = 0, 1.0\nwhile left >= eps:\n    n, left = n + 1, left / 2\nprint("остаток < ε начиная с шага", n)\n');
    draw();
  });

  /* ==============================================================================
   * 1. Как задают последовательность: формула, рекуррентное правило, таблица
   * ============================================================================== */
  let lossCache = null;
  function lossTable() {
    if (lossCache) return lossCache;
    const data = GBC.datasets.regression1d({ kind: 'sine', n: 200, noise: 0.3, seed: 42 });
    const m = new GBC.GradientBoosting({ nEstimators: 30, learningRate: 0.3, maxDepth: 2 });
    m.fit(data.X, data.y);
    lossCache = m.history.train;
    return lossCache;
  }
  const SEQX = {
    inv: { label: 'aₙ = 1/n — формула', how: 'формула', tex: 'a_n = \\dfrac{1}{n}', L: 0, terms: (N) => U.range(N, 1).map((n) => 1 / n), py: 'a = [1 / n for n in range(1, N + 1)]', note: 'Формула даёт любой член сразу по номеру: a₁₀₀₀ = 0.001, не вычисляя предыдущих. Члены приближаются к 0.' },
    sq: { label: 'aₙ = n² — формула', how: 'формула', tex: 'a_n = n^2', L: Infinity, terms: (N) => U.range(N, 1).map((n) => n * n), py: 'a = [n**2 for n in range(1, N + 1)]', note: 'Члены растут без границ — ни к какому числу не подходят. Про такую последовательность говорят «стремится к +∞».' },
    alt: { label: 'aₙ = (−1)ⁿ — формула', how: 'формула', tex: 'a_n = (-1)^n', L: null, terms: (N) => U.range(N, 1).map((n) => (n % 2 ? -1 : 1)), py: 'a = [(-1)**n for n in range(1, N + 1)]', note: 'Члены прыгают между −1 и 1 и никуда не приближаются. На числовой прямой все бусины лежат в двух точках.' },
    rec: { label: 'a₁ = 1, aₙ₊₁ = aₙ/2 + 1 — рекуррентно', how: 'рекуррентное правило', tex: 'a_1 = 1, \\qquad a_{n+1} = \\dfrac{a_n}{2} + 1', L: 2, terms: (N) => {
      const out = [1];
      while (out.length < N) out.push(out[out.length - 1] / 2 + 1);
      return out;
    }, py: 'a = [1.0]\nwhile len(a) < N:\n    a.append(a[-1] / 2 + 1)', note: 'Рекуррентное правило говорит, как получить следующий член из предыдущего. Чтобы узнать a₁₀₀, придётся пройти все 99 шагов. Члены 1, 1.5, 1.75, 1.875, … подходят к 2: расстояние до 2 каждый раз уменьшается вдвое.' },
    fib: { label: 'Fₙ₊₁/Fₙ, Фибоначчи — рекуррентно', how: 'рекуррентное правило', tex: 'F_1 = F_2 = 1,\\; F_{n+1} = F_n + F_{n-1}, \\qquad a_n = \\dfrac{F_{n+1}}{F_n}', L: PHI, terms: (N) => {
      let f0 = 1;
      let f1 = 1;
      const out = [];
      for (let n = 1; n <= N; n++) {
        out.push(f1 / f0);
        [f0, f1] = [f1, f0 + f1];
      }
      return out;
    }, py: 'F = [1, 1]\nwhile len(F) < N + 1:\n    F.append(F[-1] + F[-2])\na = [F[n] / F[n - 1] for n in range(1, N + 1)]', note: 'Числа Фибоначчи 1, 1, 2, 3, 5, 8, 13, … растут без конца, а отношения соседних 1, 2, 1.5, 1.667, 1.6, 1.625, … колеблются и подходят к «золотому сечению» φ = (1 + √5)/2 ≈ 1.618034.' },
    loss: { label: 'потери бустинга после n деревьев — таблица', how: 'таблица (измерения)', tex: 'a_n = \\text{потери после } n \\text{ деревьев}', L: undefined, terms: (N) => lossTable().slice(1, N + 1), py: 'from gbcourse import datasets, GradientBoosting\nX, y = datasets.regression_1d(kind="sine", n=200, noise=0.3, seed=42)\nm = GradientBoosting(n_estimators=30, learning_rate=0.3, max_depth=2).fit(X, y)\na = m.history_["train"][1:N + 1]', note: 'Таблица — просто измеренные числа: потери модели после 1, 2, 3, … деревьев. Формулы нет, и по конечной таблице предел не установить — видно лишь, что значения убывают всё медленнее. Будет ли у них предел, мы выясним в шаге 22.' },
  };
  GBC.widget('sequence-explorer', (el) => {
    const st0 = { seq: 'rec', n: 6 };
    const NMAX = 30;
    const w = ui.shell(el, { title: 'Последовательность: номер → число', sub: 'Выберите способ задать последовательность и добавляйте члены кнопкой ▶. Сверху — те же числа «бусинами» на числовой прямой, снизу — график: номер n по горизонтали, значение aₙ по вертикали.' });
    ui.select(w.controls, { label: 'Последовательность', value: st0.seq, options: Object.entries(SEQX).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.seq = v), draw()) });
    ui.player(w.controls, { label: 'Сколько членов', min: 1, max: NMAX, value: st0.n, fps: 3, format: (k) => 'n = 1…' + k, onChange: (k) => ((st0.n = k), draw()) });
    const texBox = H('div', { style: 'padding:2px 2px 6px;overflow-x:auto;text-align:center' });
    w.main.appendChild(texBox);
    const howBox = H('div', { class: 'widget-sub', style: 'margin:0' });
    w.controls.appendChild(howBox);
    const line = new GBC.Plot(w.main, { height: 110, x: { label: 'числовая прямая: значения aₙ' }, y: { label: '', domain: [-1, 1], ticks: [] }, margin: { left: 20 }, grid: 'x' });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'номер n', domain: [0, NMAX + 1] }, y: { label: 'aₙ' }, table: true });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const S = SEQX[st0.seq];
      const all = S.terms(NMAX);
      const a = all.slice(0, st0.n);
      const ns = U.range(st0.n, 1);
      texInto(texBox, S.tex, true);
      howBox.textContent = 'Способ: ' + S.how + '.';
      const fin = Number.isFinite(S.L);
      const [lo, hi] = U.extent(a.concat(fin ? [S.L] : []));
      const pad = Math.max((hi - lo) * 0.08, 0.1);
      const last = st0.n - 1;
      line.render([
        { type: 'hline', y: 0, color: 'axis', width: 4, opacity: 0.6 },
        fin ? { type: 'vline', x: S.L, color: 'tree', dash: '5 4' } : null,
        { type: 'points', x: a, y: a.map(() => 0), color: (i) => (i === last ? 'tree' : 'model'), r: (i) => (i === last ? 7 : 4.5), opacity: 0.85, tooltip: (i) => [['n', String(i + 1)], ['aₙ', U.fmt(a[i], 6)]] },
        { type: 'text', items: a.slice(0, Math.min(3, st0.n)).map((v, i) => ({ x: v, y: 0.45, anchor: 'middle', text: 'a_' + (i + 1) })) },
      ], { x: [lo - pad, hi + pad] });
      plot.render([
        fin ? { type: 'hline', y: S.L, color: 'tree', dash: '6 4', text: S.L === PHI ? 'φ ≈ 1.618034' : 'предел ' + U.fmt(S.L, 4) } : null,
        { type: 'line', x: ns, y: a, color: 'model', width: 1, opacity: 0.45, hover: false },
        { type: 'points', x: ns, y: a, color: (i) => (i === last ? 'tree' : 'model'), r: (i) => (i === last ? 6 : 4), label: 'aₙ', legend: false, tooltip: (i) => [['n', String(i + 1)], ['aₙ', U.fmt(a[i], 6)]] },
      ], { y: [lo - pad, hi + pad] });
      const show = Math.min(st0.n, 8);
      const head = ['n'].concat(U.range(show, 1).map(String)).concat(st0.n > show ? ['…', String(st0.n)] : []);
      const row = ['aₙ'].concat(a.slice(0, show).map((v) => U.fmt(v, 5))).concat(st0.n > show ? ['…', U.fmt(a[last], 6)] : []);
      rowTable(tbl, head, [row]);
      note.innerHTML = S.note;
    }
    w.pythonAction(() => 'N = ' + st0.n + '\n' + SEQX[st0.seq].py + '\nfor n, v in enumerate(a, start=1):\n    print(f"a_{n} = {v:.6f}")\n');
    draw();
  });

  /* ==============================================================================
   * 2. Зоопарк поведений: восемь последовательностей рядом
   * ============================================================================== */
  const ZOO = [
    { name: '1/n', a: (n) => 1 / n, L: 0, verdict: 'сходится к 0', kind: 'good', how: 'монотонно убывает — подходит с одной стороны' },
    { name: '(n − 1)/(n + 1)', a: (n) => (n - 1) / (n + 1), L: 1, verdict: 'сходится к 1', kind: 'good', how: 'монотонно растёт, но не выше 1' },
    { name: '(−1)ⁿ/n', a: (n) => (n % 2 ? -1 : 1) / n, L: 0, verdict: 'сходится к 0', kind: 'good', how: 'прыгает через предел, размах затухает' },
    { name: '1 + sin(n)/n', a: (n) => 1 + Math.sin(n) / n, L: 1, verdict: 'сходится к 1', kind: 'good', how: 'неравномерно, то ближе, то дальше, но всё теснее' },
    { name: '√n', a: (n) => Math.sqrt(n), L: Infinity, verdict: '→ +∞, предела нет', kind: 'bad', how: 'растёт всё медленнее, но без границ' },
    { name: '(−1)ⁿ', a: (n) => (n % 2 ? -1 : 1), L: null, verdict: 'предела нет', kind: 'bad', how: 'ограничена, но мечется между двумя значениями' },
    { name: '(−1)ⁿ·n', a: (n) => (n % 2 ? -n : n), L: null, verdict: 'предела нет (и не ±∞)', kind: 'bad', how: 'размах растёт в обе стороны' },
    { name: 'sin n', a: (n) => Math.sin(n), L: null, verdict: 'предела нет', kind: 'bad', how: 'ограничена, мечется без закономерности' },
  ];
  GBC.widget('sequence-zoo', (el) => {
    const st0 = { N: 30 };
    const w = ui.shell(el, { title: 'Зоопарк последовательностей', sub: 'Восемь характеров. Первые четыре сходятся (по-разному!), остальные — нет. Переключите число членов: что видно на длинной дистанции?', noControls: true });
    const bar = H('div', { style: 'margin-bottom:8px' });
    w.main.appendChild(bar);
    ui.segmented(bar, { label: 'Показать членов', value: 30, options: [{ value: 30, label: '30' }, { value: 300, label: '300' }], onChange: (v) => ((st0.N = v), draw()) });
    const grid = cardGrid(240);
    w.main.appendChild(grid);
    const panels = ZOO.map((Z) => {
      const c = card('aₙ = ' + Z.name, true);
      grid.appendChild(c.el);
      const plot = new GBC.Plot(c.body, { height: 150, x: { label: 'n' }, y: { label: '' }, margin: { top: 6, right: 8, bottom: 30, left: 40 } });
      const info = H('div', { style: 'font-size:.86rem;margin-top:4px;display:flex;flex-wrap:wrap;gap:6px;align-items:center' });
      c.body.appendChild(info);
      return { Z, plot, info };
    });
    function draw() {
      const ns = U.range(st0.N, 1);
      for (const P of panels) {
        const ys = ns.map(P.Z.a);
        P.plot.render([
          Number.isFinite(P.Z.L) ? { type: 'hline', y: P.Z.L, color: 'tree', dash: '5 4' } : null,
          { type: 'points', x: ns, y: ys, color: P.Z.kind === 'good' ? 'model' : 'muted', r: st0.N > 100 ? 1.8 : 2.8, tooltip: (i) => [['n', String(ns[i])], ['aₙ', U.fmt(ys[i], 5)]] },
        ], { x: [0, st0.N + 1] });
        P.info.replaceChildren(badge(P.Z.verdict, P.Z.kind), H('span', { style: 'color:var(--muted)' }, P.Z.how));
      }
    }
    w.pythonAction(() => 'import numpy as np\n\nn = np.arange(1, ' + (st0.N + 1) + ')\nzoo = {\n    "1/n": 1 / n,\n    "(n-1)/(n+1)": (n - 1) / (n + 1),\n    "(-1)^n/n": (-1.0) ** n / n,\n    "1 + sin(n)/n": 1 + np.sin(n) / n,\n    "sqrt(n)": np.sqrt(n),\n    "(-1)^n": (-1.0) ** n,\n    "(-1)^n * n": (-1.0) ** n * n,\n    "sin(n)": np.sin(n),\n}\nfor name, a in zoo.items():\n    print(f"{name:14} последние члены: {np.round(a[-4:], 4)}")\n');
    draw();
  });

  /* ==============================================================================
   * 3. Предел последовательности: коридор ε и номер N(ε)
   * ============================================================================== */
  const SEQ = {
    inv: { label: '1/n → 0', a: (n) => 1 / n, L: 0, dev: (n) => 1 / n, py: '1 / n', y: [-0.15, 1.1] },
    frac: { label: '(n + 1)/n → 1', a: (n) => (n + 1) / n, L: 1, dev: (n) => 1 / n, py: '(n + 1) / n', y: [0.85, 2.1] },
    lin: { label: '(2n + 1)/(n + 3) → 2', a: (n) => (2 * n + 1) / (n + 3), L: 2, dev: (n) => 5 / (n + 3), py: '(2 * n + 1) / (n + 3)', y: [0.6, 2.3] },
    alt: { label: '(−1)ⁿ/n → 0 — прыгает и затухает', a: (n) => (n % 2 ? -1 : 1) / n, L: 0, dev: (n) => 1 / n, py: '(-1.0)**n / n', y: [-1.1, 0.6] },
    sinn: { label: 'sin(n)/n → 0 — неравномерно', a: (n) => Math.sin(n) / n, L: 0, dev: (n) => Math.abs(Math.sin(n)) / n, py: 'np.sin(n) / n', y: [-0.3, 0.9] },
    geo: { label: '1/2ⁿ → 0 — очень быстро', a: (n) => Math.pow(0.5, n), L: 0, dev: (n) => Math.pow(0.5, n), py: '0.5**n', y: [-0.1, 0.6] },
    e: { label: '(1 + 1/n)ⁿ → e', a: (n) => Math.pow(1 + 1 / n, n), L: Math.E, dev: (n) => Math.E - Math.pow(1 + 1 / n, n), py: '(1 + 1 / n)**n', y: [1.9, 2.85] },
    flip: { label: '(−1)ⁿ — предела нет', a: (n) => (n % 2 ? -1 : 1), L: null, py: '(-1.0)**n', y: [-1.4, 1.4] },
  };
  GBC.widget('sequence-limit', (el) => {
    const st0 = { seq: 'inv', eps: 0.1, n: 40, Lc: 0 };
    const nCache = {};
    const w = ui.shell(el, { title: 'Коридор ε и номер N', sub: 'Число L — предел, если для ЛЮБОЙ ширины коридора ε все члены, начиная с какого-то номера N, лежат внутри коридора [L − ε, L + ε]. Сужайте коридор и попробуйте «чужое» L.' });
    ui.select(w.controls, { label: 'Последовательность', value: st0.seq, options: Object.entries(SEQ).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      st0.seq = v;
      st0.Lc = SEQ[v].L === null ? 0 : SEQ[v].L;
      sL.set(st0.Lc);
      draw();
    } });
    ui.slider(w.controls, { label: 'Полуширина коридора ε', min: 0.001, max: 0.5, log: true, value: st0.eps, onInput: (v) => ((st0.eps = v), draw()) });
    const sL = ui.slider(w.controls, { label: 'Кандидат в пределы L', min: -1.5, max: 3, step: 0.01, value: st0.Lc, onInput: (v) => ((st0.Lc = v), draw()) });
    ui.button(w.controls, { label: 'Вернуть настоящее L', small: true, onClick: () => {
      const S = SEQ[st0.seq];
      st0.Lc = S.L === null ? 0 : S.L;
      sL.set(st0.Lc);
      draw();
    } });
    ui.player(w.controls, { label: 'Сколько членов показать', min: 1, max: 100, value: st0.n, fps: 10, format: (v) => 'n ≤ ' + v, onChange: (v) => ((st0.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'номер n', domain: [0, 101] }, y: { label: 'aₙ' } });
    const pN = new GBC.Plot(w.main, { height: 210, x: { label: 'требуемая точность 1/ε (лог.)', type: 'log', domain: [2, 1000], ticks: [2, 10, 100, 1000] }, y: { label: 'N(ε) (лог.)', type: 'log', domain: [1, 1e5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'an', label: 'последний член' }, { key: 'L', label: 'кандидат L' }, { key: 'N', label: 'N(ε): дальше все внутри' }]);
    function isTrue(S) {
      return S.L !== null && Math.abs(st0.Lc - S.L) < 0.006;
    }
    function devFor(S) {
      return isTrue(S) && S.dev ? S.dev : (n) => Math.abs(S.a(n) - st0.Lc);
    }
    function nCurve(S) {
      if (nCache[st0.seq]) return nCache[st0.seq];
      const es = U.range(25).map((i) => 0.5 * Math.pow(0.002, i / 24));
      const ns = es.map((e) => scanN(S.dev, e));
      return (nCache[st0.seq] = { inv: es.map((e) => 1 / e), ns });
    }
    function draw() {
      const S = SEQ[st0.seq];
      const L = isTrue(S) ? S.L : st0.Lc;
      const ns = U.range(st0.n, 1);
      const as = ns.map(S.a);
      const dev = devFor(S);
      const N = scanN(dev, st0.eps);
      const inside = (i) => dev(ns[i]) < st0.eps;
      plot.render([
        { type: 'rect', x0: 0, x1: 101, y0: L - st0.eps, y1: L + st0.eps, fill: 'tree', opacity: 0.14 },
        { type: 'hline', y: L, color: 'tree', dash: '6 4', text: 'L = ' + U.fmt(L, 4) },
        N !== null && N <= 100 ? { type: 'vline', x: N, color: 'ink2', dash: '3 3', text: 'N = ' + N } : null,
        { type: 'points', x: ns, y: as, r: 4, color: (i) => (inside(i) ? 'model' : 'red'), legend: false, tooltip: (i) => [['n', String(ns[i])], ['aₙ', U.fmt(as[i], 6)], ['|aₙ − L|', U.fmt(dev(ns[i]), 4)]] },
      ], { y: S.y });
      if (S.L !== null) {
        const C = nCurve(S);
        pN.render([
          { type: 'line', x: C.inv, y: C.ns, color: 'model', width: 2, hover: false },
          { type: 'points', x: C.inv, y: C.ns, color: 'model', r: 2.5, tooltip: (i) => [['ε', U.fmt(1 / C.inv[i], 3)], ['N(ε)', fmtInt(C.ns[i])]] },
          isTrue(S) && N !== null ? { type: 'points', x: [1 / st0.eps], y: [N], color: 'tree', r: 7 } : null,
        ]);
      } else pN.render([{ type: 'text', items: [{ x: 30, y: 300, anchor: 'middle', text: 'предела нет — N(ε) не существует' }] }]);
      st.set('an', 'a' + st0.n + ' = ' + U.fmt(as[as.length - 1], 6));
      st.set('L', U.fmt(L, 4) + (isTrue(S) ? ' (верное)' : ''));
      st.set('N', N === null ? 'не найдётся' : fmtInt(N));
      if (N === null) note.innerHTML = S.L === null ? 'Члены прыгают между −1 и 1. Какое бы L вы ни взяли, коридор шириной 2ε &lt; 2 не вместит оба значения: красные точки будут появляться всегда. <b>Предела нет.</b>' : 'Для L = ' + U.fmt(L, 4) + ' члены снова и снова вылезают из коридора, сколько ни жди: N не найдётся. Значит, это <b>не предел</b>. Нажмите «Вернуть настоящее L».';
      else if (!isTrue(S)) note.innerHTML = 'При этом ε коридор вокруг L = ' + U.fmt(L, 4) + ' ещё захватывает «хвост» последовательности (N = ' + fmtInt(N) + '). Но сузьте ε меньше ' + U.fmt(Math.abs(L - S.L), 3) + ' — и N перестанет находиться: у последовательности только <b>один</b> предел, ' + U.fmt(S.L, 4) + '.';
      else note.innerHTML = 'При ε = ' + U.fmt(st0.eps, 3) + ' все члены начиная с номера <b>N = ' + fmtInt(N) + '</b> лежат в коридоре (синие точки; красные — вне). Сузьте коридор — N вырастет, но <b>всегда найдётся</b>. Правый график показывает, как быстро растёт N, когда мы требуем всё большей точности: ' + (st0.seq === 'geo' ? 'для 1/2ⁿ — очень медленно (каждые 10 шагов дают 3 знака).' : st0.seq === 'e' ? 'для (1 + 1/n)ⁿ N растёт примерно как 1.36/ε — сходимость медленная.' : 'здесь N растёт примерно пропорционально 1/ε.');
    }
    w.pythonAction(() => {
      const S = SEQ[st0.seq];
      return 'import numpy as np\n\na = lambda n: ' + S.py + '\nn = np.arange(1, 100001, dtype=float)\nL, eps = ' + U.pyNum(st0.Lc) + ', ' + U.pyNum(st0.eps) + '\nbad = n[np.abs(a(n) - L) >= eps]          # номера членов вне коридора\nif len(bad) == 0:\n    print("все члены внутри: N = 1")\nelif bad.max() > 90000:\n    print("члены вылезают снова и снова — L не предел")\nelse:\n    print("N(ε) =", int(bad.max()) + 1)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 4. Доказательство по ε–N: решаем неравенство и проверяем
   * ============================================================================== */
  const PROOF = {
    inv: { label: '1/n → 0', aTex: '\\frac{1}{n}', L: 0, a: (n) => 1 / n, dev: (n) => 1 / n, devTex: '\\left|\\frac{1}{n} - 0\\right| = \\frac{1}{n}', bound: (e) => 1 / e, solveTex: (e) => '\\frac{1}{n} < \\varepsilon \\iff n > \\frac{1}{\\varepsilon} = ' + tnum(1 / e, 4), gen: 'N(\\varepsilon) = \\left\\lfloor \\tfrac{1}{\\varepsilon} \\right\\rfloor + 1', py: '1 / n' },
    frac: { label: '(n + 1)/n → 1', aTex: '\\frac{n+1}{n}', L: 1, a: (n) => (n + 1) / n, dev: (n) => 1 / n, devTex: '\\left|\\frac{n+1}{n} - 1\\right| = \\left|\\frac{n + 1 - n}{n}\\right| = \\frac{1}{n}', bound: (e) => 1 / e, solveTex: (e) => '\\frac{1}{n} < \\varepsilon \\iff n > \\frac{1}{\\varepsilon} = ' + tnum(1 / e, 4), gen: 'N(\\varepsilon) = \\left\\lfloor \\tfrac{1}{\\varepsilon} \\right\\rfloor + 1', py: '(n + 1) / n' },
    lin: { label: '(2n + 1)/(n + 3) → 2', aTex: '\\frac{2n+1}{n+3}', L: 2, a: (n) => (2 * n + 1) / (n + 3), dev: (n) => 5 / (n + 3), devTex: '\\left|\\frac{2n+1}{n+3} - 2\\right| = \\left|\\frac{2n + 1 - 2n - 6}{n+3}\\right| = \\frac{5}{n+3}', bound: (e) => 5 / e - 3, solveTex: (e) => '\\frac{5}{n+3} < \\varepsilon \\iff n > \\frac{5}{\\varepsilon} - 3 = ' + tnum(5 / e - 3, 4), gen: 'N(\\varepsilon) = \\max\\left(1,\\; \\left\\lfloor \\tfrac{5}{\\varepsilon} - 3 \\right\\rfloor + 1\\right)', py: '(2 * n + 1) / (n + 3)' },
    sq: { label: '1/n² → 0', aTex: '\\frac{1}{n^2}', L: 0, a: (n) => 1 / (n * n), dev: (n) => 1 / (n * n), devTex: '\\left|\\frac{1}{n^2} - 0\\right| = \\frac{1}{n^2}', bound: (e) => 1 / Math.sqrt(e), solveTex: (e) => 'n^2 > \\frac{1}{\\varepsilon} \\iff n > \\frac{1}{\\sqrt{\\varepsilon}} = ' + tnum(1 / Math.sqrt(e), 4), gen: 'N(\\varepsilon) = \\left\\lfloor \\tfrac{1}{\\sqrt{\\varepsilon}} \\right\\rfloor + 1', py: '1 / n**2' },
    geo: { label: '1/2ⁿ → 0', aTex: '\\frac{1}{2^n}', L: 0, a: (n) => Math.pow(0.5, n), dev: (n) => Math.pow(0.5, n), devTex: '\\left|\\frac{1}{2^n} - 0\\right| = \\frac{1}{2^n}', bound: (e) => Math.log2(1 / e), solveTex: (e) => '2^n > \\frac{1}{\\varepsilon} \\iff n > \\log_2 \\frac{1}{\\varepsilon} = ' + tnum(Math.log2(1 / e), 4), gen: 'N(\\varepsilon) = \\left\\lfloor \\log_2 \\tfrac{1}{\\varepsilon} \\right\\rfloor + 1', py: '0.5**n' },
    alt: { label: '(−1)ⁿ/n → 0', aTex: '\\frac{(-1)^n}{n}', L: 0, a: (n) => (n % 2 ? -1 : 1) / n, dev: (n) => 1 / n, devTex: '\\left|\\frac{(-1)^n}{n} - 0\\right| = \\frac{|(-1)^n|}{n} = \\frac{1}{n}', bound: (e) => 1 / e, solveTex: (e) => '\\frac{1}{n} < \\varepsilon \\iff n > \\frac{1}{\\varepsilon} = ' + tnum(1 / e, 4), gen: 'N(\\varepsilon) = \\left\\lfloor \\tfrac{1}{\\varepsilon} \\right\\rfloor + 1', py: '(-1.0)**n / n' },
  };
  GBC.widget('en-proof', (el) => {
    const st0 = { p: 'lin', eps: 0.01 };
    const w = ui.shell(el, { title: 'Доказательство по ε–N своими руками', sub: 'Рецепт: 1) запишите отклонение |aₙ − L| и упростите; 2) решите неравенство «отклонение < ε» относительно n; 3) N — первое целое, которое ему удовлетворяет; 4) проверьте.' });
    ui.select(w.controls, { label: 'Последовательность', value: st0.p, options: Object.entries(PROOF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.p = v), draw()) });
    ui.slider(w.controls, { label: 'Допуск ε', min: 0.0005, max: 0.5, log: true, value: st0.eps, onInput: (v) => ((st0.eps = v), draw()) });
    const grid = cardGrid(260);
    w.main.appendChild(grid);
    const c1 = card('1. Отклонение');
    const c2 = card('2. Неравенство');
    const c3 = card('3. Номер N и общая формула');
    [c1, c2, c3].forEach((c) => grid.appendChild(c.el));
    const plot = new GBC.Plot(w.main, { height: 230, x: { label: 'номер n (лог.)', type: 'log' }, y: { label: '|aₙ − L| (лог.)', type: 'log' } });
    const tbl = H('div', { style: 'min-width:0' });
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const P = PROOF[st0.p];
      const e = st0.eps;
      const N = smallestN(P.dev, e, P.bound(e));
      texInto(c1.body, P.devTex, true);
      texInto(c2.body, P.solveTex(e), true);
      texInto(c3.body, 'N = ' + N + ', \\qquad ' + P.gen, true);
      const nMax = Math.max(10, N * 4);
      const ns = U.range(240).map((i) => Math.pow(nMax, i / 239)).filter((v, i, arr) => i === 0 || Math.floor(v) !== Math.floor(arr[i - 1])).map(Math.floor);
      const ds = ns.map(P.dev);
      plot.render([
        { type: 'hline', y: e, color: 'tree', dash: '6 4', text: 'ε = ' + U.fmt(e, 3) },
        { type: 'vline', x: N, color: 'ink2', dash: '3 3', text: 'N = ' + N },
        { type: 'points', x: ns, y: ds, r: 3, color: (i) => (ds[i] < e ? 'model' : 'red'), tooltip: (i) => [['n', String(ns[i])], ['|aₙ − L|', U.fmt(ds[i], 4)]] },
      ], { x: [1, nMax], y: [Math.min(...ds) * 0.7, Math.max(...ds) * 1.4] });
      const rows = U.range(6).map((i) => Math.max(1, N - 3) + i).map((n) => [String(n), U.fmt(P.a(n), 7), U.fmt(P.dev(n), 5), P.dev(n) < e ? '✓ < ε' : '✗ ≥ ε']);
      tbl.textContent = '';
      ui.table(tbl, { columns: ['n', 'aₙ', '|aₙ − L|', 'в коридоре?'], rows, highlight: (i) => Number(rows[i][0]) === N });
      note.innerHTML = 'Для ε = ' + U.fmt(e, 3) + ' получилось <b>N = ' + N + '</b>: член с этим номером уже в коридоре, предыдущий — ещё нет (выделенная строка таблицы). Дальше отклонение только уменьшается, поэтому все следующие члены тоже внутри. Главное — у нас есть <b>формула</b> N(ε), которая работает для любого ε: это и есть доказательство, что предел равен ' + P.L + '.';
    }
    w.pythonAction(() => {
      const P = PROOF[st0.p];
      return 'import math\n\na = lambda n: ' + P.py + '\nL, eps = ' + P.L + ', ' + U.pyNum(st0.eps) + '\nN = 1\nwhile abs(a(N) - L) >= eps:     # отклонение убывает: ищем первый номер в коридоре\n    N += 1\nprint("N(ε) =", N)\nprint("проверка до 10·N:", all(abs(a(n) - L) < eps for n in range(N, 10 * N)))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 5. Геометрическая прогрессия qⁿ
   * ============================================================================== */
  GBC.widget('geometric', (el) => {
    const st0 = { q: 0.8 };
    const NN = 40;
    const w = ui.shell(el, { title: 'Геометрическая прогрессия qⁿ', sub: 'Каждый член — предыдущий, умноженный на q. Двигайте q и смотрите, когда последовательность сходится, к чему и как.' });
    const sq = ui.slider(w.controls, { label: 'Множитель q', min: -1.3, max: 1.3, step: 0.01, value: st0.q, onInput: (v) => ((st0.q = v), draw()) });
    const pre = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
    w.controls.appendChild(pre);
    [0.5, 0.9, -0.8, 1, -1, 1.1].forEach((q) => ui.button(pre, { label: 'q = ' + U.fmt(q, 2), small: true, onClick: () => ((st0.q = q), sq.set(q), draw()) }));
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'номер n', domain: [-0.5, NN + 0.5] }, y: { label: 'qⁿ', domain: [-2.2, 2.2] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'q10', label: 'q¹⁰' }, { key: 'q40', label: 'q⁴⁰' }, { key: 'N', label: 'N для ε = 0.01' }, { key: 'v', label: 'вердикт' }]);
    function draw() {
      const q = st0.q;
      const ns = U.range(NN + 1);
      const ys = ns.map((n) => Math.pow(q, n));
      const conv = Math.abs(q) < 1 - 1e-12;
      const N = conv ? (Math.abs(q) < 1e-12 ? 1 : smallestN((n) => Math.pow(Math.abs(q), n), 0.01, Math.log(0.01) / Math.log(Math.abs(q)))) : null;
      plot.render([
        conv ? { type: 'rect', x0: -0.5, x1: NN + 0.5, y0: -0.01, y1: 0.01, fill: 'tree', opacity: 0.35 } : null,
        { type: 'hline', y: 0, color: 'axis' },
        Math.abs(q - 1) < 1e-12 ? { type: 'hline', y: 1, color: 'tree', dash: '6 4', text: 'предел 1' } : null,
        conv && N <= NN ? { type: 'vline', x: N, color: 'ink2', dash: '3 3', text: 'N = ' + N } : null,
        { type: 'line', x: ns, y: ys.map((v) => (Math.abs(v) > 50 ? NaN : v)), color: 'model', width: 1, opacity: 0.4, hover: false },
        { type: 'points', x: ns, y: ys.map((v) => (Math.abs(v) > 50 ? NaN : v)), color: 'model', r: 4, tooltip: (i) => [['n', String(i)], ['qⁿ', U.fmt(ys[i], 6)]] },
      ]);
      st.set('q10', U.fmt(Math.pow(q, 10), 4));
      st.set('q40', U.fmt(Math.pow(q, 40), 4));
      st.set('N', N === null ? '—' : String(N));
      const verdict = conv ? '→ 0' : Math.abs(q - 1) < 1e-12 ? '→ 1 (стоит)' : q > 1 ? '→ +∞' : Math.abs(q + 1) < 1e-12 ? 'нет предела' : q < -1 ? 'нет предела, |qⁿ| → ∞' : '—';
      st.set('v', verdict);
      let t;
      if (Math.abs(q) < 1e-12) t = 'При q = 0 все члены после нулевого равны 0.';
      else if (conv && q > 0) t = 'При 0 &lt; q &lt; 1 каждый член — доля предыдущего: последовательность монотонно убывает к нулю. Чем ближе q к 1, тем медленнее: для ε = 0.01 нужно n &gt; ln 0.01 / ln q.';
      else if (conv) t = 'При −1 &lt; q &lt; 0 знак меняется на каждом шаге, но размах |q|ⁿ затухает: последовательность сходится к нулю, перепрыгивая его.';
      else if (Math.abs(q - 1) < 1e-12) t = 'При q = 1 все члены равны 1: постоянная последовательность сходится к самой себе.';
      else if (Math.abs(q + 1) < 1e-12) t = 'При q = −1 члены 1, −1, 1, −1, … — предела нет.';
      else if (q > 1) t = 'При q &gt; 1 каждый член больше предыдущего в q раз: рост без границ, qⁿ → +∞ (точки выше 50 не показаны).';
      else t = 'При q &lt; −1 члены меняют знак, а их модуль растёт: предела нет, даже бесконечного определённого знака.';
      note.innerHTML = t + ' <b>Итог:</b> qⁿ → 0 при |q| &lt; 1, → 1 при q = 1, иначе предела нет.';
    }
    w.pythonAction(() => 'q = ' + U.pyNum(st0.q) + '\nfor n in [0, 1, 2, 5, 10, 20, 40]:\n    print(f"q^{n} = {q**n:.6f}")\n');
    draw();
  });

  /* ==============================================================================
   * 6. Скорость сходимости: гонка к нулю
   * ============================================================================== */
  const RACE = [
    { key: 'sqrt', name: '1/√n', color: 'violet', a: (n) => 1 / Math.sqrt(n), guess: (e) => 1 / (e * e) },
    { key: 'inv', name: '1/n', color: 'blue', a: (n) => 1 / n, guess: (e) => 1 / e },
    { key: 'sq', name: '1/n²', color: 'aqua', a: (n) => 1 / (n * n), guess: (e) => 1 / Math.sqrt(e) },
    { key: 'geo', name: '1/2ⁿ', color: 'orange', a: (n) => Math.pow(0.5, n), guess: (e) => Math.log2(1 / e) },
    { key: 'fact', name: '1/n!', color: 'magenta', a: (n) => 1 / fact(n), guess: () => 1 },
  ];
  GBC.widget('convergence-race', (el) => {
    const st0 = { eps: 1e-6 };
    const w = ui.shell(el, { title: 'Гонка к нулю: кто сходится быстрее', sub: 'Пять последовательностей с пределом 0. Ось y логарифмическая: каждое деление — в 10 раз ближе к нулю. Выберите точность ε и сравните, сколько членов нужно каждой.' });
    ui.slider(w.controls, { label: 'Точность ε', min: 1e-12, max: 0.1, log: true, value: st0.eps, onInput: (v) => ((st0.eps = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'номер n', domain: [1, 60] }, y: { label: '|aₙ − 0| (лог.)', type: 'log', domain: [1e-16, 2], ticks: [1e-16, 1e-12, 1e-8, 1e-4, 1] } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const ns = U.range(60, 1);
      const layers = [{ type: 'hline', y: st0.eps, color: 'ink2', dash: '6 4', text: 'ε = ' + U.fmt(st0.eps, 3) }];
      for (const R of RACE) {
        const ys = ns.map((n) => {
          const v = R.a(n);
          return v < 1e-17 ? NaN : v;
        });
        layers.push({ type: 'line', x: ns, y: ys, color: R.color, width: 2.2, label: R.name });
      }
      plot.render(layers);
      const rows = RACE.map((R) => {
        const N = R.key === 'fact' ? smallestN(R.a, st0.eps, 1) : smallestN(R.a, st0.eps, R.guess(st0.eps));
        return [R.name, fmtInt(N)];
      });
      tbl.textContent = '';
      ui.table(tbl, { columns: ['последовательность', 'N(ε) — членов до коридора'], rows, numeric: false });
      note.innerHTML = 'Все пять сходятся к нулю, но с очень разной скоростью. 1/√n при ε = 10⁻⁶ нужен <b>триллион</b> членов, 1/n — миллион, 1/n² — тысяча, 1/2ⁿ — двадцать, 1/n! — десять. У 1/2ⁿ график на логарифмической шкале — прямая: каждый шаг добавляет одинаковое число верных знаков (около 0.3). Такую сходимость называют <b>линейной</b> (геометрической); именно с ней сходятся многие алгоритмы обучения.';
    }
    w.pythonAction(() => 'import math\n\neps = ' + U.pyNum(st0.eps) + '\nraces = {\n    "1/sqrt(n)": lambda n: 1 / math.sqrt(n),\n    "1/n": lambda n: 1 / n,\n    "1/n^2": lambda n: 1 / n**2,\n    "1/2^n": lambda n: 0.5**n,\n    "1/n!": lambda n: 1 / math.factorial(n),\n}\nguess = {"1/sqrt(n)": 1 / eps**2, "1/n": 1 / eps, "1/n^2": 1 / math.sqrt(eps), "1/2^n": math.log2(1 / eps), "1/n!": 1}\nfor name, a in races.items():\n    N = max(1, int(guess[name]))          # начинаем с оценки и уточняем\n    while N > 1 and a(N - 1) < eps:\n        N -= 1\n    while a(N) >= eps:\n        N += 1\n    print(f"{name:10} N(ε) = {N:,}")\n');
    draw();
  });

  /* ==============================================================================
   * 7. Монотонная и ограниченная — значит, сходится
   * ============================================================================== */
  const MONO = {
    e: { label: '(1 + 1/n)ⁿ — растёт', a: (n) => Math.pow(1 + 1 / n, n), L: Math.E, Ltxt: 'e ≈ 2.718282', c: [2.3, 3.2], c0: 3, py: '(1 + 1 / n)**n' },
    efact: { label: '1 + 1/1! + 1/2! + … + 1/n! — растёт', a: null, L: Math.E, Ltxt: 'e ≈ 2.718282', c: [2.3, 3.2], c0: 3, py: 'sum(1 / math.factorial(k) for k in range(n + 1))' },
    basel: { label: '1 + 1/4 + 1/9 + … + 1/n² — растёт', a: null, L: (Math.PI * Math.PI) / 6, Ltxt: 'π²/6 ≈ 1.644934', c: [1.2, 2.2], c0: 2, py: 'sum(1 / k**2 for k in range(1, n + 1))' },
    harm: { label: '1 + 1/2 + 1/3 + … + 1/n — растёт', a: null, L: Infinity, Ltxt: 'предела нет: → +∞', c: [2, 12], c0: 5, py: 'sum(1 / k for k in range(1, n + 1))' },
  };
  const monoCache = {};
  function monoTerms(key, N) {
    if (monoCache[key]) return monoCache[key];
    const out = new Float64Array(N + 1);
    let s = 0;
    let f = 1;
    for (let n = 1; n <= N; n++) {
      if (key === 'e') out[n] = Math.pow(1 + 1 / n, n);
      else if (key === 'efact') {
        if (n === 1) s = 2;
        else {
          f *= n;
          s += 1 / f;
        }
        out[n] = s;
      } else if (key === 'basel') out[n] = s += 1 / (n * n);
      else out[n] = s += 1 / n;
    }
    return (monoCache[key] = out);
  }
  GBC.widget('monotone-bounded', (el) => {
    const st0 = { seq: 'e', c: 3, show: false };
    const NM = 100000;
    const w = ui.shell(el, { title: 'Потолок для растущей последовательности', sub: 'Последовательность растёт. Опустите «потолок» c как можно ниже так, чтобы ни один из 100 000 членов его не пробил. Где окажется самый низкий потолок?' });
    ui.select(w.controls, { label: 'Последовательность', value: st0.seq, options: Object.entries(MONO).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      st0.seq = v;
      const M = MONO[v];
      sC.el.remove();
      sC = mkSlider(M);
      st0.c = M.c0;
      draw();
    } });
    const sBox = H('div');
    w.controls.appendChild(sBox);
    const mkSlider = (M) => ui.slider(sBox, { label: 'Потолок c', min: M.c[0], max: M.c[1], step: 0.001, value: M.c0, onInput: (v) => ((st0.c = v), draw()) });
    let sC = mkSlider(MONO[st0.seq]);
    ui.toggle(w.controls, { label: 'Показать предел', checked: false, onChange: (c) => ((st0.show = c), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'номер n', domain: [0, 61] }, y: { label: 'aₙ' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'потолок c' }, { key: 'above', label: 'членов выше c (из 100 000)' }, { key: 'first', label: 'первый пробивший' }, { key: 'last', label: 'член №100 000' }]);
    function draw() {
      const M = MONO[st0.seq];
      const a = monoTerms(st0.seq, NM);
      let above = 0;
      let first = null;
      for (let n = 1; n <= NM; n++) if (a[n] > st0.c) {
        above++;
        if (first === null) first = n;
      }
      const ns = U.range(60, 1);
      const ys = ns.map((n) => a[n]);
      const [lo, hi] = U.extent(ys.concat([st0.c]));
      plot.render([
        { type: 'hline', y: st0.c, color: above ? 'red' : 'good', width: 2.2, text: 'потолок c = ' + U.fmt(st0.c, 4) },
        st0.show && Number.isFinite(M.L) ? { type: 'hline', y: M.L, color: 'tree', dash: '6 4', text: 'предел ' + M.Ltxt } : null,
        { type: 'points', x: ns, y: ys, r: 4, color: (i) => (ys[i] > st0.c ? 'red' : 'model'), tooltip: (i) => [['n', String(ns[i])], ['aₙ', U.fmt(ys[i], 7)]] },
      ], { y: [lo - (hi - lo) * 0.08, hi + (hi - lo) * 0.12] });
      st.set('c', U.fmt(st0.c, 4));
      st.set('above', fmtInt(above));
      st.set('first', first === null ? 'никто' : 'n = ' + fmtInt(first));
      st.set('last', U.fmt(a[NM], 7));
      if (st0.seq === 'harm') note.innerHTML = above ? 'Потолок c = ' + U.fmt(st0.c, 3) + ' пробит на члене №' + fmtInt(first) + '. Поднимайте выше — его всё равно пробьют, только позже: сумма 1 + 1/2 + 1/3 + … растёт медленно (как ln n), но <b>без границ</b>. Монотонная, но не ограниченная — предела нет, она стремится к +∞.' : 'Среди первых 100 000 членов никто не пробил c = ' + U.fmt(st0.c, 3) + '. Но это не гарантия: если продолжить, пробьют и этот потолок. Монотонность без ограниченности не даёт предела.';
      else note.innerHTML = (above ? 'Потолок пробит (первый — член №' + fmtInt(first) + '). Поднимите его чуть выше.' : 'Ни один член не выше c — это <b>верхняя граница</b>.') + ' Самый низкий возможный потолок — и есть предел: ' + (st0.show ? M.Ltxt : '(включите «Показать предел»)') + '. <b>Теорема Вейерштрасса:</b> растущая (неубывающая) последовательность, ограниченная сверху, обязательно имеет предел — так доказывают, что предел существует, даже не зная его значения.';
    }
    w.pythonAction(() => 'import math\n\na = lambda n: ' + MONO[st0.seq].py + '\nc = ' + U.pyNum(st0.c) + '\nvals = [a(n) for n in range(1, 2001)]\nprint("растёт:", all(x <= y for x, y in zip(vals, vals[1:])))\nprint("выше потолка c среди первых 2000:", sum(v > c for v in vals))\nprint("a_2000 =", vals[-1])\n');
    draw();
  });

  /* ==============================================================================
   * 8. Рекуррентные последовательности: лестница Ламерея
   * ============================================================================== */
  const ITER = {
    half: { label: 'aₙ₊₁ = aₙ/2 + 1', g: (a) => a / 2 + 1, a0: 0, s: [-0.5, 3], dom: [-0.6, 3.2], py: 'a / 2 + 1', note: 'Прямая y = x/2 + 1 пересекает диагональ в точке 2. Лестница сходится к ней, и каждый пролёт вдвое короче предыдущего — наклон g равен ½.' },
    heron: { label: 'aₙ₊₁ = (aₙ + 2/aₙ)/2 — Герон, √2', g: (a) => (a + 2 / a) / 2, a0: 1, s: [0.6, 2.5], dom: [0.5, 2.7], py: '(a + 2 / a) / 2', note: 'Древний метод Герона (и частный случай метода Ньютона, урок 15.7): 1 → 1.5 → 1.416667 → 1.414216 → 1.41421356… Ошибка 0.086, 0.0025, 2.1·10⁻⁶, 1.6·10⁻¹² — число верных знаков <b>удваивается</b> каждый шаг. Кривая касается диагонали горизонтально — поэтому так быстро.' },
    sqrt: { label: 'aₙ₊₁ = √(2 + aₙ)', g: (a) => Math.sqrt(2 + a), a0: 0, s: [0, 2.5], dom: [-0.2, 2.7], py: 'math.sqrt(2 + a)', note: '0 → 1.414 → 1.848 → 1.962 → 1.990 → … → 2. Предел решает уравнение L = √(2 + L), то есть L² − L − 2 = 0, L = 2 (корень −1 не подходит: члены положительны).' },
    cos: { label: 'aₙ₊₁ = cos aₙ', g: (a) => Math.cos(a), a0: 1, s: [0, 1.5], dom: [-0.1, 1.6], py: 'math.cos(a)', note: 'Нажимайте «cos» на калькуляторе снова и снова: 1, 0.5403, 0.8576, 0.6543, 0.7935, … Лестница превращается в спираль, члены прыгают через предел 0.739085 (решение cos L = L). Для шести верных знаков нужно 34 шага: наклон g около предела ≈ −0.67, ошибка уменьшается лишь в 1.5 раза за шаг.' },
    log28: { label: 'aₙ₊₁ = 2.8·aₙ(1 − aₙ) — логистическое', g: (a) => 2.8 * a * (1 - a), a0: 0.2, s: [0.02, 0.98], dom: [0, 1], py: '2.8 * a * (1 - a)', note: 'Модель роста популяции. При r = 2.8 члены сходятся к 1 − 1/r ≈ 0.642857, обходя его по спирали.' },
    log32: { label: 'aₙ₊₁ = 3.2·aₙ(1 − aₙ) — цикл', g: (a) => 3.2 * a * (1 - a), a0: 0.2, s: [0.02, 0.98], dom: [0, 1], py: '3.2 * a * (1 - a)', note: 'При r = 3.2 точка L = 0.6875 по-прежнему решает L = g(L), но лестница от неё <b>уходит</b> и выходит на цикл 0.513 ↔ 0.7995. Предела нет. Решение уравнения L = g(L) — лишь кандидат!' },
    log39: { label: 'aₙ₊₁ = 3.9·aₙ(1 − aₙ) — хаос', g: (a) => 3.9 * a * (1 - a), a0: 0.2, s: [0.02, 0.98], dom: [0, 1], py: '3.9 * a * (1 - a)', note: 'При r = 3.9 — хаос: члены мечутся без всякой закономерности, хотя правило совсем простое. Предела нет.' },
    dbl: { label: 'aₙ₊₁ = 2aₙ — удвоение', g: (a) => 2 * a, a0: 0.05, s: [0.01, 0.5], dom: [-0.1, 3], py: '2 * a', note: 'Ловушка: «пусть предел L, тогда L = 2L, значит L = 0». Но 0.05, 0.1, 0.2, 0.4, … уходят в бесконечность! Уравнение L = g(L) верно <b>только если предел уже существует</b>. Сначала докажите существование (например, монотонность и ограниченность), потом решайте уравнение.' },
  };
  function fixedPoints(g, dom) {
    const out = [];
    const xs = U.linspace(dom[0], dom[1], 2001);
    const d = (x) => g(x) - x;
    for (let i = 1; i < xs.length; i++) {
      const a = d(xs[i - 1]);
      const b = d(xs[i]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (a === 0) out.push(xs[i - 1]);
      else if (a * b < 0) {
        let lo = xs[i - 1];
        let hi = xs[i];
        for (let k = 0; k < 60; k++) {
          const m = (lo + hi) / 2;
          if (d(lo) * d(m) <= 0) hi = m;
          else lo = m;
        }
        out.push((lo + hi) / 2);
      }
    }
    return out;
  }
  GBC.widget('cobweb', (el) => {
    const st0 = { fn: 'half', a0: 0, k: 6 };
    const K = 40;
    const w = ui.shell(el, { title: 'Лестница Ламерея: итерации aₙ₊₁ = g(aₙ)', sub: 'Сверху: график g (синий) и диагональ y = x. От точки aₙ идём по вертикали до графика — получаем aₙ₊₁, затем по горизонтали до диагонали — переносим значение на ось x. Снизу — сами члены. Нажмите ▶.' });
    ui.select(w.controls, { label: 'Правило', value: st0.fn, options: Object.entries(ITER).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      st0.fn = v;
      const G = ITER[v];
      st0.a0 = G.a0;
      sA.el.remove();
      sA = mkA(G);
      pl.set(6);
      st0.k = 6;
      draw();
    } });
    const aBox = H('div');
    w.controls.appendChild(aBox);
    const mkA = (G) => ui.slider(aBox, { label: 'Старт a₁', min: G.s[0], max: G.s[1], step: 0.01, value: G.a0, onInput: (v) => ((st0.a0 = v), draw()) });
    let sA = mkA(ITER[st0.fn]);
    const pl = ui.player(w.controls, { label: 'Шагов', min: 0, max: K, value: st0.k, fps: 3, format: (k) => k + ' шаг.', onChange: (k) => ((st0.k = k), draw()) });
    const pc = new GBC.Plot(w.main, { height: 330, x: { label: 'aₙ' }, y: { label: 'aₙ₊₁ = g(aₙ)' }, equal: false });
    const ps = new GBC.Plot(w.main, { height: 200, x: { label: 'номер n', domain: [0.5, K + 1.5] }, y: { label: 'aₙ' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'an', label: 'текущий член' }, { key: 'step', label: '|aₙ₊₁ − aₙ|' }, { key: 'fp', label: 'решения L = g(L)' }]);
    function draw() {
      const G = ITER[st0.fn];
      const seq = [st0.a0];
      for (let i = 0; i < K; i++) seq.push(G.g(seq[i]));
      const k = st0.k;
      // пролёт лестницы: вверх (aᵢ, aᵢ) → (aᵢ, aᵢ₊₁), затем вбок → (aᵢ₊₁, aᵢ₊₁)
      const lim = (v) => U.clamp(v, -1e3, 1e3);
      const vx = [];
      const vy1 = [];
      const vy2 = [];
      const hx2 = [];
      for (let i = 0; i < k; i++) {
        vx.push(lim(seq[i]));
        vy1.push(lim(seq[i]));
        vy2.push(lim(seq[i + 1]));
        hx2.push(lim(seq[i + 1]));
      }
      const cv = curve(G.g, G.dom[0], G.dom[1], 601);
      const fps = fixedPoints(G.g, G.dom);
      const dom = G.dom;
      pc.render([
        { type: 'line', x: dom, y: dom, color: 'muted', width: 1.4, dash: '5 4', hover: false },
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.2, hover: false },
        { type: 'segments', x1: vx, y1: vy1, x2: vx, y2: vy2, color: 'tree', width: 1.6, opacity: 0.9 },
        { type: 'segments', x1: vx, y1: vy2, x2: hx2, y2: vy2, color: 'tree', width: 1.6, opacity: 0.9 },
        { type: 'points', x: fps, y: fps, color: 'ink', r: 5, hollow: true, tooltip: (i) => [['L = g(L)', U.fmt(fps[i], 6)]] },
        { type: 'points', x: [seq[k]], y: [seq[k]], color: 'tree', r: 6 },
      ], { x: dom, y: dom });
      const ns = U.range(k + 1, 1);
      const vis = seq.slice(0, k + 1).map((v) => (Math.abs(v) > 1e6 ? NaN : v));
      ps.render([
        ...fps.map((p) => ({ type: 'hline', y: p, color: 'ink2', dash: '4 4', width: 1 })),
        { type: 'line', x: ns, y: vis, color: 'model', width: 1, opacity: 0.45, hover: false },
        { type: 'points', x: ns, y: vis, color: 'model', r: 4, tooltip: (i) => [['n', String(i + 1)], ['aₙ', U.fmt(seq[i], 8)]] },
      ], { y: st0.fn === 'dbl' ? [0, Math.max(3, Math.min(1e6, seq[k]) * 1.1)] : dom });
      st.set('an', 'a' + (k + 1) + ' = ' + U.fmt(seq[k], 8));
      st.set('step', k ? U.fmt(Math.abs(seq[k] - seq[k - 1]), 3) : '—');
      st.set('fp', fps.length ? fps.map((p) => U.fmt(p, 6)).join(', ') : 'нет');
      note.innerHTML = G.note + ' <span style="color:var(--muted)">Если предел L есть и g непрерывна, то в равенстве aₙ₊₁ = g(aₙ) обе части стремятся к L, и L = g(L): предел — точка, где график пересекает диагональ.</span>';
    }
    w.pythonAction(() => 'import math\n\ng = lambda a: ' + ITER[st0.fn].py + '\na = ' + U.pyNum(st0.a0) + '\nfor n in range(1, ' + (Math.max(st0.k, 10) + 2) + '):\n    print(f"a_{n} = {a:.10f}")\n    a = g(a)\n');
    draw();
  });

  /* ==============================================================================
   * 9. Бесконечные суммы: предел частичных сумм
   * ============================================================================== */
  const SUMS = {
    geo: { label: '½ + ¼ + ⅛ + … (шаги к стене)', t: (k) => Math.pow(0.5, k), S: 1, Stxt: '1', py: '0.5**k' },
    nines: { label: '0.9 + 0.09 + 0.009 + … = 0.999…', t: (k) => 9 / Math.pow(10, k), S: 1, Stxt: '1', py: '9 / 10**k' },
    basel: { label: '1 + 1/4 + 1/9 + 1/16 + …', t: (k) => 1 / (k * k), S: (Math.PI * Math.PI) / 6, Stxt: 'π²/6 ≈ 1.644934', py: '1 / k**2' },
    harm: { label: '1 + 1/2 + 1/3 + 1/4 + … — гармонический', t: (k) => 1 / k, S: Infinity, Stxt: '+∞ (расходится)', py: '1 / k' },
    alth: { label: '1 − 1/2 + 1/3 − 1/4 + …', t: (k) => (k % 2 ? 1 : -1) / k, S: Math.LN2, Stxt: 'ln 2 ≈ 0.693147', py: '(-1)**(k + 1) / k' },
    grandi: { label: '1 − 1 + 1 − 1 + … — Гранди', t: (k) => (k % 2 ? 1 : -1), S: null, Stxt: 'нет (0, 1, 0, 1, …)', py: '(-1)**(k + 1)' },
  };
  GBC.widget('partial-sums', (el) => {
    const st0 = { s: 'geo', n: 10, far: false };
    const w = ui.shell(el, { title: 'Бесконечная сумма — это предел частичных сумм', sub: 'Сверху — слагаемые aₖ, снизу — частичные суммы Sₙ = a₁ + … + aₙ. Сумма ряда — предел Sₙ при n → ∞, если он есть.' });
    ui.select(w.controls, { label: 'Ряд', value: st0.s, options: Object.entries(SUMS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.s = v), draw()) });
    ui.player(w.controls, { label: 'Слагаемых n', min: 1, max: 60, value: st0.n, fps: 6, format: (k) => 'n = ' + k, onChange: (k) => ((st0.n = k), draw()) });
    ui.toggle(w.controls, { label: 'Далеко: Sₙ до n = 100 000 (лог. ось)', checked: false, onChange: (c) => ((st0.far = c), draw()) });
    const pt = new GBC.Plot(w.main, { height: 170, x: { label: 'номер слагаемого k', domain: [0, 61] }, y: { label: 'aₖ' } });
    const ps = new GBC.Plot(w.main, { height: 250, x: { label: 'n', domain: [0, 61] }, y: { label: 'Sₙ' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'an', label: 'последнее слагаемое' }, { key: 'Sn', label: 'частичная сумма Sₙ' }, { key: 'S', label: 'сумма ряда' }, { key: 'gap', label: 'осталось до неё' }]);
    function draw() {
      const R = SUMS[st0.s];
      const n = st0.n;
      const ks = U.range(60, 1);
      const ts = ks.map(R.t);
      let acc = 0;
      const Ss = ks.map((k) => (acc += R.t(k)));
      pt.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'segments', x1: ks.slice(0, n), y1: ks.slice(0, n).map(() => 0), x2: ks.slice(0, n), y2: ts.slice(0, n), color: 'model', width: 2, opacity: 0.7 },
        { type: 'points', x: ks.slice(0, n), y: ts.slice(0, n), color: 'model', r: 3.5, tooltip: (i) => [['k', String(i + 1)], ['aₖ', U.fmt(ts[i], 6)]] },
      ], { y: U.extent(ts.concat([0])).map((v, i) => v + (i ? 0.08 : -0.08) * Math.max(...ts.map(Math.abs))) });
      const fin = Number.isFinite(R.S);
      if (!st0.far) {
        ps.opts.x.type = undefined;
        ps.render([
          fin ? { type: 'hline', y: R.S, color: 'tree', dash: '6 4', text: 'сумма ' + R.Stxt } : null,
          { type: 'line', x: ks.slice(0, n), y: Ss.slice(0, n), color: 'model', width: 1.2, opacity: 0.5, hover: false },
          { type: 'points', x: ks.slice(0, n), y: Ss.slice(0, n), color: 'model', r: 4, tooltip: (i) => [['n', String(i + 1)], ['Sₙ', U.fmt(Ss[i], 7)]] },
        ], { x: [0, 61], y: U.extent(Ss.concat(fin ? [R.S] : [])).map((v, i) => v + (i ? 0.1 : -0.1)) });
      } else {
        const xs = [];
        const ys = [];
        let s = 0;
        let next = 1;
        for (let k = 1; k <= 100000; k++) {
          s += R.t(k);
          if (k >= next) {
            xs.push(k);
            ys.push(s);
            next = Math.max(k + 1, Math.floor(k * 1.03));
          }
        }
        ps.opts.x.type = 'log';
        ps.render([
          fin ? { type: 'hline', y: R.S, color: 'tree', dash: '6 4', text: 'сумма ' + R.Stxt } : null,
          { type: 'line', x: xs, y: ys, color: 'model', width: 2, hover: false },
          st0.s === 'harm' ? { type: 'line', x: xs, y: xs.map((k) => Math.log(k) + 0.5772156649), color: 'muted', dash: '4 4', width: 1.4, hover: false } : null,
        ], { x: [1, 100000], y: U.extent(ys.concat(fin ? [R.S] : [])).map((v, i) => v + (i ? 0.1 : -0.1)) });
      }
      const Sn = Ss[n - 1];
      st.set('an', 'a' + n + ' = ' + U.fmt(ts[n - 1], 5));
      st.set('Sn', U.fmt(Sn, 8));
      st.set('S', R.Stxt);
      st.set('gap', fin ? U.fmt(Math.abs(R.S - Sn), 3) : '—');
      const msg = {
        geo: 'Те самые шаги к стене: Sₙ = 1 − 1/2ⁿ → 1. Бесконечно много слагаемых, а сумма конечна — так разрешается парадокс Зенона.',
        nines: 'Sₙ = 0.99…9 (n девяток) = 1 − 10⁻ⁿ → 1. Поэтому 0.999… — просто другая запись числа 1: бесконечная десятичная дробь и есть предел своих обрывков.',
        basel: 'Слагаемые убывают быстро, суммы растут и упираются в π²/6 — знаменитая «Базельская задача», решённая Эйлером в 1734 году. Сходится медленно: остаток после n слагаемых ≈ 1/n.',
        harm: 'Главная ловушка: слагаемые 1/k стремятся к нулю, а сумма — к бесконечности! Растёт как ln n + 0.577 (пунктир на дальнем виде): S₁₀₀₀ ≈ 7.49, а 10 сумма превысит только на 12 367-м слагаемом. <b>Слагаемые → 0 — необходимо, но не достаточно.</b>',
        alth: 'Знаки чередуются, суммы прыгают вокруг ln 2 ≈ 0.693 и сходятся к нему — медленно, ошибка около 1/(2n).',
        grandi: 'Частичные суммы 1, 0, 1, 0, … не имеют предела — у ряда нет суммы. Слагаемые здесь даже не стремятся к нулю.',
      };
      note.innerHTML = msg[st0.s] + ' Подробно о рядах — в уроке <a href="../../lesson_15_10/web/index.html">15.10</a>.';
    }
    w.pythonAction(() => 'S = 0.0\nfor k in range(1, 100001):\n    S += ' + SUMS[st0.s].py + '\n    if k in (10, 100, 1000, 10000, 100000):\n        print(f"S_{k} = {S:.8f}")\n');
    draw();
  });

  /* ==============================================================================
   * 10. Подходим к точке слева и справа
   * ============================================================================== */
  const PTS = {
    simple: { label: 'x² + 1 в x = 1 — просто подставить', f: (x) => x * x + 1, a: 1, dom: [-1, 3], y: [-0.5, 7], L: 2, fa: 2, steps: [0.5, 0.1, 0.01, 0.001], py: 'x**2 + 1', verdict: 'Слева и справа значения подходят к 2, и f(1) = 2. Для «хороших» (непрерывных, урок 15.4) функций предел — просто подстановка.' },
    hole: { label: '(x² − 1)/(x − 1) в x = 1 — дырка', f: (x) => (x * x - 1) / (x - 1), a: 1, dom: [-1, 3], y: [-0.5, 4.5], L: 2, fa: null, steps: [0.5, 0.1, 0.01, 0.001], py: '(x**2 - 1) / (x - 1)', verdict: 'Подставить нельзя: 0/0. Но слева и справа значения подходят к 2. Алгебра объясняет почему: x² − 1 = (x − 1)(x + 1), и при x ≠ 1 дробь равна x + 1. На графике — прямая с «дыркой».' },
    cube: { label: '(x³ − 1)/(x − 1) в x = 1', f: (x) => (x * x * x - 1) / (x - 1), a: 1, dom: [-1, 2.5], y: [-0.5, 9], L: 3, fa: null, steps: [0.5, 0.1, 0.01, 0.001], py: '(x**3 - 1) / (x - 1)', verdict: 'Снова 0/0, таблица подходит к 3. Разложение x³ − 1 = (x − 1)(x² + x + 1): при x ≠ 1 дробь равна x² + x + 1 → 1 + 1 + 1 = 3.' },
    sqrt: { label: '(√x − 1)/(x − 1) в x = 1', f: (x) => (Math.sqrt(x) - 1) / (x - 1), a: 1, dom: [0, 3], y: [0, 1.2], L: 0.5, fa: null, steps: [0.5, 0.1, 0.01, 0.001], py: '(np.sqrt(x) - 1) / (x - 1)', verdict: 'Таблица подходит к 0.5. Секрет: x − 1 = (√x − 1)(√x + 1), дробь = 1/(√x + 1) → 1/2. Такой приём (сопряжённое) разберём в уроке 15.4.' },
    sinc: { label: 'sin x / x в x = 0', f: (x) => Math.sin(x) / x, a: 0, dom: [-8, 8], y: [-0.4, 1.3], L: 1, fa: null, steps: [1, 0.1, 0.01, 0.001], py: 'np.sin(x) / x', verdict: 'В нуле 0/0, сократить нечего, но таблица уверенно подходит к 1: при малых x синус почти равен самому x. Это «первый замечательный предел» — строгое доказательство в уроке 15.4.' },
    expm: { label: '(eˣ − 1)/x в x = 0', f: (x) => (Math.exp(x) - 1) / x, a: 0, dom: [-2, 2], y: [0, 3.5], L: 1, fa: null, steps: [1, 0.1, 0.01, 0.001], py: '(np.exp(x) - 1) / x', verdict: 'Таблица: 0.632 и 1.718 при ±1, 0.995 и 1.005 при ±0.01 — к 1. Около нуля eˣ ≈ 1 + x. Этот предел — ключ к производной экспоненты (урок 15.6).' },
    trap: { label: 'sin(π/x) в x = 0 — ловушка таблицы', f: (x) => Math.sin(Math.PI / x), a: 0, dom: [-0.5, 0.5], y: [-1.3, 1.3], L: null, fa: null, steps: [0.1, 0.01, 0.001, 0.0001], n: 12001, py: 'np.sin(np.pi / x)', verdict: '<b>Таблица врёт!</b> В точках ±0.1, ±0.01, ±0.001 значение sin(10π), sin(100π), … равно 0 (компьютер печатает ~10⁻¹⁵), и кажется, что предел 0. Но точки 0.1, 0.01, … попали ровно в нули синуса. Посмотрите на график и на движущиеся точки: значения мечутся между −1 и 1. Предела нет.' },
  };
  GBC.widget('approach-point', (el) => {
    const st0 = { fn: 'hole', k: 0, zoom: false };
    const NK = 40;
    const w = ui.shell(el, { title: 'Подходим к точке с двух сторон', sub: 'Две точки подбираются к x = a: слева (синяя) и справа (оранжевая). Нажмите ▶, включите лупу и сверьтесь с таблицей.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(PTS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.player(w.controls, { label: 'Приближаемся', min: 0, max: NK, value: 0, fps: 6, format: (k) => 'расстояние ' + U.fmt(dOf(k), 3), onChange: (k) => ((st0.k = k), draw()) });
    ui.toggle(w.controls, { label: 'Лупа: окно сужается вместе с точками', checked: false, onChange: (c) => ((st0.zoom = c), draw()) });
    function dOf(k) {
      const F = PTS[st0.fn];
      const span = (F.dom[1] - F.dom[0]) / 4;
      return span * Math.pow(10, (-3 * k) / NK);
    }
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    function draw() {
      const F = PTS[st0.fn];
      const d = dOf(st0.k);
      const xl = F.a - d;
      const xr = F.a + d;
      const xd = st0.zoom ? [F.a - 2.5 * d, F.a + 2.5 * d] : F.dom;
      const cv = curve(F.f, xd[0], xd[1], F.n || 1201, { skip: F.a });
      let yd = F.y;
      if (st0.zoom && F.L !== null) {
        const ys = cv.y.filter(Number.isFinite);
        const [lo, hi] = U.extent(ys.concat([F.L]));
        const pad = Math.max((hi - lo) * 0.15, 1e-9);
        yd = [lo - pad, hi + pad];
      }
      const layers = [
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2, hover: false },
        { type: 'vline', x: F.a, color: 'ink2', width: 1, dash: '3 3', text: 'x = ' + F.a },
      ];
      if (F.L !== null) {
        layers.push({ type: 'hline', y: F.L, color: 'tree', dash: '6 4', width: 1.2, text: 'предел ' + F.L });
        layers.push({ type: 'points', x: [F.a], y: [F.L], color: 'model', r: 5, hollow: true });
      }
      if (F.fa !== null) layers.push({ type: 'points', x: [F.a], y: [F.fa], color: 'model', r: 5 });
      layers.push({ type: 'points', x: [xl], y: [F.f(xl)], color: 'blue', r: 6, label: 'слева', tooltip: () => [['x', U.fmt(xl, 6)], ['f(x)', U.fmt(F.f(xl), 6)]] });
      layers.push({ type: 'points', x: [xr], y: [F.f(xr)], color: 'orange', r: 6, label: 'справа', tooltip: () => [['x', U.fmt(xr, 6)], ['f(x)', U.fmt(F.f(xr), 6)]] });
      plot.render(layers, { x: xd, y: yd });
      tableBox.textContent = '';
      const rows = F.steps.map((dd) => [U.fmt(F.a - dd, 6), U.fmt(F.f(F.a - dd), 7), U.fmt(F.a + dd, 6), U.fmt(F.f(F.a + dd), 7)]);
      ui.table(tableBox, { columns: ['x слева', 'f(x)', 'x справа', 'f(x)'], rows });
      note.innerHTML = F.verdict + (st0.zoom && F.L !== null ? ' Под лупой видно: сколько ни увеличивай, кривая подходит к выколотой точке (' + F.a + ', ' + F.L + ').' : '');
    }
    w.pythonAction(() => {
      const F = PTS[st0.fn];
      return 'import numpy as np\n\nf = lambda x: ' + F.py + '\na = ' + F.a + '\nfor d in ' + JSON.stringify(F.steps) + ':\n    print(f"f(a − {d}) = {f(a - d):.7f}   f(a + {d}) = {f(a + d):.7f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 11. Предел и значение в точке — разные вещи
   * ============================================================================== */
  const LV = {
    lin: { label: 'x + 1, точка a = 1', g: (x) => x + 1, a: 1, dom: [-1, 3], y: [-0.5, 5], py: 'x + 1' },
    par: { label: 'x² − 2x + 2, точка a = 1.5', g: (x) => x * x - 2 * x + 2, a: 1.5, dom: [-0.5, 3.5], y: [0, 6], py: 'x**2 - 2 * x + 2' },
    sinc: { label: 'sin x / x, точка a = 0', g: (x) => (Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x), a: 0, dom: [-8, 8], y: [-0.5, 2.5], py: 'np.sinc(x / np.pi)' },
  };
  GBC.widget('limit-vs-value', (el) => {
    const st0 = { fn: 'lin', mode: 'other', val: 3.5, far: false };
    const w = ui.shell(el, { title: 'Пределу всё равно, что в самой точке', sub: 'Меняйте значение в точке a: оставьте «как у соседей», выколите его или перетащите закрашенную точку куда угодно. Можно испортить функцию и вдали от a.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(LV).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.segmented(w.controls, { label: 'Значение f(a)', value: st0.mode, options: [{ value: 'same', label: 'как у соседей' }, { value: 'none', label: 'выколото' }, { value: 'other', label: 'другое' }], onChange: (v) => ((st0.mode = v), draw()) });
    const sv = ui.slider(w.controls, { label: 'Другое значение f(a)', min: -0.5, max: 5, step: 0.05, value: st0.val, onInput: (v) => ((st0.val = v), (st0.mode = 'other'), seg(), draw()) });
    const seg = () => w.controls.querySelectorAll('.segmented button').forEach((b, i) => b.setAttribute('aria-pressed', String(['same', 'none', 'other'][i] === st0.mode)));
    ui.toggle(w.controls, { label: 'Испортить функцию вдали от a (|x − a| > 1)', checked: false, onChange: (c) => ((st0.far = c), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const grid = cardGrid(150);
    w.main.appendChild(grid);
    const cL = card('Предел при x → a', true);
    const cV = card('Значение f(a)', true);
    const cC = card('Совпадают?', true);
    [cL, cV, cC].forEach((c) => grid.appendChild(c.el));
    const note = w.note('', true);
    function f(x) {
      const L = LV[st0.fn];
      const base = L.g(x);
      return st0.far && Math.abs(x - L.a) > 1 ? base + 1.2 * Math.sin(3 * x) + 0.8 : base;
    }
    function draw() {
      const L = LV[st0.fn];
      const lim = L.g(L.a);
      const fa = st0.mode === 'same' ? lim : st0.mode === 'none' ? null : st0.val;
      const cv = curve(f, L.dom[0], L.dom[1], 1201, { skip: L.a, jump: 0.5 });
      plot.render([
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.2, hover: false },
        { type: 'vband', x0: L.a - 1, x1: L.a + 1, color: 'tree', opacity: 0.06 },
        { type: 'hline', y: lim, color: 'tree', dash: '6 4', width: 1.2, text: 'предел ' + U.fmt(lim, 3) },
        { type: 'points', x: [L.a], y: [lim], color: 'model', r: 5, hollow: true },
        fa !== null ? { type: 'points', x: [L.a], y: [fa], color: 'tree', r: 7, draggable: true, onDrag: (i, dx, dy) => {
          st0.mode = 'other';
          st0.val = U.clamp(Math.round(dy * 20) / 20, -0.5, 5);
          sv.set(st0.val);
          seg();
          draw();
        }, tooltip: () => [['f(a)', U.fmt(fa, 3)]] } : null,
      ], { x: L.dom, y: L.y });
      cL.body.textContent = U.fmt(lim, 4);
      cV.body.textContent = fa === null ? 'не определено' : U.fmt(fa, 4);
      cC.body.replaceChildren(fa !== null && Math.abs(fa - lim) < 1e-9 ? badge('да — непрерывна в a', 'good') : badge(fa === null ? 'значения нет' : 'нет: ' + U.fmt(fa, 3) + ' ≠ ' + U.fmt(lim, 3), 'bad'));
      note.innerHTML = 'Предел остаётся равным <b>' + U.fmt(lim, 4) + '</b>, что бы ни происходило в самой точке: он смотрит только на соседей с x ≠ a. ' + (st0.far ? 'И функция вдали от a (вне подсвеченной полосы) на предел тоже не влияет — <b>предел — местное свойство</b>: достаточно знать функцию в сколь угодно малой окрестности a.' : 'Попробуйте испортить функцию вдали от a — предел и тогда не изменится.') + ' Когда предел и значение совпадают, функцию называют <b>непрерывной</b> в точке (урок 15.4).';
    }
    w.pythonAction(() => {
      const L = LV[st0.fn];
      return 'import numpy as np\n\ng = lambda x: ' + L.py + '\na = ' + L.a + '\ndef f(x):\n    return ' + (st0.mode === 'other' ? U.pyNum(st0.val) : st0.mode === 'none' ? 'float("nan")' : 'g(x)') + ' if x == a else g(x)\nfor d in [0.1, 0.01, 0.001]:\n    print(f"f(a − {d}) = {f(a - d):.6f}, f(a + {d}) = {f(a + d):.6f}")\nprint("f(a) =", f(a))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 12. Определение через последовательности (по Гейне)
   * ============================================================================== */
  const HF = {
    osc: { label: 'sin(1/x) в x = 0', f: (x) => Math.sin(1 / x), a: 0, dom: [-0.4, 0.4], y: [-1.3, 1.3], n: 8001, py: 'np.sin(1 / x)' },
    xosc: { label: 'x·sin(1/x) в x = 0', f: (x) => x * Math.sin(1 / x), a: 0, dom: [-0.4, 0.4], y: [-0.45, 0.45], n: 8001, py: 'x * np.sin(1 / x)' },
    hole: { label: '(x² − 1)/(x − 1) в x = 1', f: (x) => (x * x - 1) / (x - 1), a: 1, dom: [0.5, 1.5], y: [1.4, 2.6], py: '(x**2 - 1) / (x - 1)' },
    step: { label: 'ступенька [x ≥ 0] в x = 0', f: (x) => (x >= 0 ? 1 : 0), a: 0, dom: [-0.4, 0.4], y: [-0.3, 1.3], jump: true, py: '(x >= 0) * 1.0' },
  };
  const HSEQ = {
    right: { label: 'справа: a + 1/n', d: (n) => 1 / n, py: '1 / n' },
    left: { label: 'слева: a − 1/n', d: (n) => -1 / n, py: '-1 / n' },
    alt: { label: 'по очереди: a + (−1)ⁿ/n', d: (n) => (n % 2 ? -1 : 1) / n, py: '(-1)**n / n' },
    zeros: { label: '«нули»: a + 1/(πn)', d: (n) => 1 / (Math.PI * n), py: '1 / (np.pi * n)' },
    peaks: { label: '«пики»: a + 1/(2πn + π/2)', d: (n) => 1 / (2 * Math.PI * n + Math.PI / 2), py: '1 / (2 * np.pi * n + np.pi / 2)' },
    pits: { label: '«ямы»: a + 1/(2πn − π/2)', d: (n) => 1 / (2 * Math.PI * n - Math.PI / 2), py: '1 / (2 * np.pi * n - np.pi / 2)' },
  };
  GBC.widget('heine', (el) => {
    const st0 = { fn: 'osc', sq: 'zeros', n: 12 };
    const NMX = 40;
    const w = ui.shell(el, { title: 'Предел через последовательности', sub: 'Возьмём последовательность точек xₙ → a (xₙ ≠ a) и посмотрим на значения f(xₙ). Предел L существует, если для ЛЮБОЙ такой последовательности f(xₙ) → L. Найдите две последовательности с разными ответами — и предела нет.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(HF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.select(w.controls, { label: 'Последовательность xₙ → a', value: st0.sq, options: Object.entries(HSEQ).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.sq = v), draw()) });
    ui.player(w.controls, { label: 'Членов', min: 1, max: NMX, value: st0.n, fps: 5, format: (k) => 'n ≤ ' + k, onChange: (k) => ((st0.n = k), draw()) });
    const pg = new GBC.Plot(w.main, { height: 270, x: { label: 'x' }, y: { label: 'f(x)' } });
    const pv = new GBC.Plot(w.main, { height: 190, x: { label: 'номер n', domain: [0, NMX + 1] }, y: { label: 'f(xₙ)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'xₙ' }, { key: 'f', label: 'f(xₙ)' }, { key: 'to', label: 'f(xₙ) подходит к' }]);
    const memo = {};
    function draw() {
      const F = HF[st0.fn];
      const Q = HSEQ[st0.sq];
      const scale = F.dom[1] - F.a;
      const sc = st0.sq === 'zeros' || st0.sq === 'peaks' || st0.sq === 'pits' ? 1 : scale;
      const ns = U.range(st0.n, 1);
      const xs = ns.map((n) => F.a + sc * Q.d(n));
      const fs = xs.map(F.f);
      const cv = curve(F.f, F.dom[0], F.dom[1], F.n || 1201, { skip: F.a, jump: F.jump ? 0.5 : undefined });
      pg.render([
        { type: 'line', x: cv.x, y: cv.y, color: 'muted', width: 1.4, hover: false },
        { type: 'vline', x: F.a, color: 'ink2', dash: '3 3', width: 1 },
        { type: 'points', x: xs, y: fs, color: 'tree', r: 4.5, tooltip: (i) => [['n', String(i + 1)], ['xₙ', U.fmt(xs[i], 6)], ['f(xₙ)', U.fmt(fs[i], 6)]] },
      ], { x: F.dom, y: F.y });
      const tail = U.range(200).map((i) => F.f(F.a + sc * Q.d(1000 + i)));
      const [tlo, thi] = U.extent(tail);
      const lim = thi - tlo < 1e-3 ? (tlo + thi) / 2 : null;
      memo[st0.fn + ':' + st0.sq] = lim;
      pv.render([
        lim !== null ? { type: 'hline', y: lim, color: 'tree', dash: '6 4', text: '→ ' + U.fmt(Math.abs(lim) < 1e-9 ? 0 : lim, 4) } : null,
        { type: 'line', x: ns, y: fs, color: 'tree', width: 1, opacity: 0.4, hover: false },
        { type: 'points', x: ns, y: fs, color: 'tree', r: 4, tooltip: (i) => [['n', String(i + 1)], ['f(xₙ)', U.fmt(fs[i], 6)]] },
      ], { y: F.y });
      st.set('x', 'x' + st0.n + ' = ' + U.fmt(xs[xs.length - 1], 6));
      const fl = fs[fs.length - 1];
      st.set('f', Math.abs(fl) < 1e-9 ? '≈ 0 (' + U.fmt(fl, 2) + ')' : U.fmt(fl, 6));
      st.set('to', lim === null ? 'ни к чему (мечется)' : U.fmt(Math.abs(lim) < 1e-9 ? 0 : lim, 6));
      const seen = Object.entries(memo).filter(([k, v]) => k.startsWith(st0.fn + ':') && v !== null).map(([, v]) => Math.round(v * 1e6) / 1e6);
      const distinct = [...new Set(seen)];
      let t;
      if (st0.fn === 'osc') t = 'Для sin(1/x) «нули» дают f(xₙ) = 0, «пики» — 1, «ямы» — −1, а «справа» значения мечутся. Разные последовательности — разные ответы, значит, <b>предела нет</b>.';
      else if (st0.fn === 'xosc') t = 'Для x·sin(1/x) любая последовательность даёт f(xₙ) → 0: множитель x прижимает колебания к нулю. Предел есть и равен 0.';
      else if (st0.fn === 'step') t = 'Справа ступенька даёт 1, слева 0, а «по очереди» значения прыгают 0, 1, 0, 1. Разные ответы — предела нет.';
      else t = 'Какую последовательность xₙ → 1 ни возьми, f(xₙ) = xₙ + 1 → 2. Предел есть.';
      note.innerHTML = t + (distinct.length > 1 ? ' <b>Вы уже нашли ' + distinct.length + ' разных ответа: ' + distinct.join(', ') + '.</b>' : '') + ' Это определение по Гейне; оно равносильно определению через коридор (шаг 18) и удобно, чтобы доказать, что предела <b>нет</b>.';
    }
    w.pythonAction(() => {
      const F = HF[st0.fn];
      const Q = HSEQ[st0.sq];
      return 'import numpy as np\n\nf = lambda x: ' + F.py + '\na = ' + F.a + '\nn = np.arange(1, 21)\nx = a + ' + (st0.sq === 'zeros' || st0.sq === 'peaks' || st0.sq === 'pits' ? '' : U.pyNum(F.dom[1] - F.a) + ' * ') + '(' + Q.py + ')\nprint(np.round(f(x), 6))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 13. Односторонние пределы
   * ============================================================================== */
  const ONE = {
    step: { label: 'ступенька [x ≥ 0] в 0', f: (x) => (x >= 0 ? 1 : 0), a: 0, dom: [-2, 2], y: [-0.4, 1.4], left: 0, right: 1, fa: 1, py: '(x >= 0) * 1.0' },
    sign: { label: '|x|/x в 0', f: (x) => Math.abs(x) / x, a: 0, dom: [-2, 2], y: [-1.5, 1.5], left: -1, right: 1, fa: null, py: 'np.abs(x) / x' },
    floor: { label: '⌊x⌋ — целая часть, в 2', f: Math.floor, a: 2, dom: [0, 4], y: [-0.5, 4.5], left: 1, right: 2, fa: 2, py: 'np.floor(x)' },
    tree: { label: 'дерево с порогом 1.5', f: (x) => (x < 1.5 ? 1.2 : x < 3 ? 2.6 : 1.9), a: 1.5, dom: [0, 4], y: [0.6, 3.1], left: 1.2, right: 2.6, fa: 2.6, py: 'np.where(x < 1.5, 1.2, np.where(x < 3, 2.6, 1.9))' },
    sqrt: { label: '√x в 0 — слева не определена', f: (x) => (x >= 0 ? Math.sqrt(x) : NaN), a: 0, dom: [-2, 4], y: [-0.5, 2.2], left: undefined, right: 0, fa: 0, py: 'np.sqrt(x)' },
    abs: { label: '|x| в 0 — стороны согласны', f: Math.abs, a: 0, dom: [-2, 2], y: [-0.3, 2.2], left: 0, right: 0, fa: 0, py: 'np.abs(x)' },
    inv: { label: '1/x в 0 — в разные бесконечности', f: (x) => 1 / x, a: 0, dom: [-2, 2], y: [-12, 12], left: -Infinity, right: Infinity, fa: null, cap: 40, py: '1 / x' },
    exp: { label: 'e^(1/x) в 0 — слева 0, справа ∞', f: (x) => Math.exp(1 / x), a: 0, dom: [-2, 2], y: [-0.5, 8], left: 0, right: Infinity, fa: null, cap: 60, py: 'np.exp(1 / x)' },
  };
  const limTxt = (v) => (v === undefined ? 'нет (не определена)' : v === Infinity ? '+∞' : v === -Infinity ? '−∞' : U.fmt(v, 4));
  GBC.widget('one-sided', (el) => {
    const st0 = { fn: 'tree', d: 0.5 };
    const w = ui.shell(el, { title: 'Левый и правый пределы', sub: 'Левая ветвь (x < a) — синяя, правая (x > a) — оранжевая. Приближайте пробные точки к a и сравнивайте, к чему подходит каждая сторона.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(ONE).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.slider(w.controls, { label: 'Расстояние до a', min: 0.0001, max: 1, log: true, value: st0.d, onInput: (v) => ((st0.d = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const grid = cardGrid(150);
    w.main.appendChild(grid);
    const cLeft = card('Левый предел, x → a⁻', true);
    const cRight = card('Правый предел, x → a⁺', true);
    const cBoth = card('Предел', true);
    const cVal = card('Значение f(a)', true);
    [cLeft, cRight, cBoth, cVal].forEach((c) => grid.appendChild(c.el));
    const note = w.note('', true);
    function draw() {
      const F = ONE[st0.fn];
      const opt = { cap: F.cap };
      const L = curve(F.f, F.dom[0], F.a - 1e-9, 900, opt);
      const R = curve(F.f, F.a + 1e-9, F.dom[1], 900, opt);
      const clipJ = (c) => {
        const y = c.y.slice();
        for (let i = 1; i < y.length; i++) if (Math.abs(y[i] - y[i - 1]) > 0.5 && !F.cap) y[i] = NaN;
        return y;
      };
      const xl = F.a - st0.d;
      const xr = F.a + st0.d;
      const capv = (v) => (Number.isFinite(v) && Math.abs(v) < 1e6 ? v : NaN);
      const lines = [];
      [L, R].forEach((c, side) => {
        const y = clipJ(c);
        lines.push({ type: 'line', x: c.x, y, color: side ? 'orange' : 'blue', width: 2.4, label: side ? 'справа от a' : 'слева от a' });
      });
      const ends = [];
      if (Number.isFinite(F.left)) ends.push({ x: F.a, y: F.left, side: 0 });
      if (Number.isFinite(F.right)) ends.push({ x: F.a, y: F.right, side: 1 });
      plot.render([
        { type: 'vline', x: F.a, color: 'ink2', dash: '3 3', width: 1, text: 'a = ' + F.a },
        ...lines,
        { type: 'points', x: ends.map((e) => e.x), y: ends.map((e) => e.y), color: (i) => (ends[i].side ? 'orange' : 'blue'), r: 5, hollow: true, legend: false },
        F.fa !== null ? { type: 'points', x: [F.a], y: [F.fa], color: 'ink', r: 5, legend: false, tooltip: () => [['f(a)', U.fmt(F.fa, 4)]] } : null,
        { type: 'points', x: [xl], y: [capv(F.f(xl))], color: 'blue', r: 7, legend: false, tooltip: () => [['x', U.fmt(xl, 6)], ['f(x)', U.fmt(F.f(xl), 6)]] },
        { type: 'points', x: [xr], y: [capv(F.f(xr))], color: 'orange', r: 7, legend: false, tooltip: () => [['x', U.fmt(xr, 6)], ['f(x)', U.fmt(F.f(xr), 6)]] },
      ], { x: F.dom, y: F.y });
      cLeft.body.textContent = limTxt(F.left) + '   (сейчас f = ' + U.fmt(F.f(xl), 5) + ')';
      cRight.body.textContent = limTxt(F.right) + '   (сейчас f = ' + U.fmt(F.f(xr), 5) + ')';
      const same = F.left !== undefined && F.left === F.right && Number.isFinite(F.left);
      cBoth.body.replaceChildren(same ? badge('есть: ' + U.fmt(F.left, 4), 'good') : F.left === undefined ? badge('только правый: ' + limTxt(F.right), 'neutral') : badge('нет', 'bad'));
      cVal.body.textContent = F.fa === null ? 'не определено' : U.fmt(F.fa, 4);
      const msgs = {
        step: 'Слева 0, справа 1 — односторонние пределы есть, но разные. Общего предела нет.',
        sign: '|x|/x равна −1 при x &lt; 0 и 1 при x &gt; 0 — это «знак числа». В нуле функция не определена, односторонние пределы −1 и 1 различны.',
        floor: 'Целая часть ⌊x⌋ слева от 2 равна 1, справа — 2. Скачок на каждом целом числе.',
        tree: 'Так выглядит прогноз дерева решений: константы на участках, скачки на порогах. На пороге 1.5 левый предел 1.2, правый 2.6, а значение — правое (условие x &lt; 1.5 ложно). Общего предела нет — дерево разрывно (урок 15.4).',
        sqrt: 'Левее нуля √x не определена, поэтому говорить можно только о правом пределе: √x → 0 при x → 0⁺. Для точки на краю области определения «предел» обычно понимают как односторонний.',
        abs: 'У |x| в нуле излом, но обе стороны подходят к 0 — предел есть, равен 0 и совпадает со значением. (А вот наклоны слева и справа различаются — см. шаг 21.)',
        inv: 'Слева 1/x → −∞, справа → +∞. Конечных пределов нет ни с одной стороны: это вертикальная асимптота (шаг 15).',
        exp: 'Слева 1/x → −∞, и e^(1/x) → 0; справа 1/x → +∞, и e^(1/x) → +∞. Стороны ведут себя совсем по-разному.',
      };
      note.innerHTML = msgs[st0.fn] + ' <b>Правило:</b> предел существует ⇔ оба односторонних существуют и равны.';
    }
    w.pythonAction(() => {
      const F = ONE[st0.fn];
      return 'import numpy as np\n\nf = lambda x: ' + F.py + '\na = ' + F.a + '\nwith np.errstate(all="ignore"):\n    for d in [0.1, 0.01, 0.001, 1e-6]:\n        print(f"слева f({a - d}) = {f(a - d):.6g}   справа f({a + d}) = {f(a + d):.6g}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 14. Микроскоп: колебания у нуля
   * ============================================================================== */
  const ZM = {
    osc: { label: 'sin(1/x) — предела нет', f: (x) => Math.sin(1 / x), env: () => 1, L: null, py: 'np.sin(1 / x)' },
    xosc: { label: 'x·sin(1/x) → 0', f: (x) => x * Math.sin(1 / x), env: (x) => Math.abs(x), L: 0, py: 'x * np.sin(1 / x)' },
    x2osc: { label: 'x²·sin(1/x) → 0, ещё теснее', f: (x) => x * x * Math.sin(1 / x), env: (x) => x * x, L: 0, py: 'x**2 * np.sin(1 / x)' },
    step: { label: 'ступенька — скачок не исчезает', f: (x) => (x >= 0 ? 1 : 0) - 0.5, env: () => 0.5, L: null, py: '(x >= 0) - 0.5' },
  };
  GBC.widget('zoom-oscillation', (el) => {
    const st0 = { fn: 'osc', z: 1, scaleY: false };
    const w = ui.shell(el, { title: 'Микроскоп у нуля', sub: 'Окно [−w, w] вокруг нуля сужается при увеличении. Следите за размахом значений в окне: если он стремится к нулю, значения «сжимаются» к одному числу — пределу.' });
    ui.select(w.controls, { label: 'Функция', value: st0.fn, options: Object.entries(ZM).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.fn = v), draw()) });
    ui.slider(w.controls, { label: 'Увеличение', min: 1, max: 10000, log: true, value: st0.z, format: (v) => '×' + U.fmt(v, 3), onInput: (v) => ((st0.z = v), draw()) });
    ui.toggle(w.controls, { label: 'Масштабировать и ось y', checked: false, onChange: (c) => ((st0.scaleY = c), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'окно ±w' }, { key: 'r', label: 'размах значений в окне' }, { key: 'L', label: 'предел' }]);
    function draw() {
      const Z = ZM[st0.fn];
      const wd = 0.5 / st0.z;
      const cv = curve(Z.f, -wd, wd, 6001, { skip: 0, jump: st0.fn === 'step' ? 0.5 : undefined });
      const ys = cv.y.filter(Number.isFinite);
      const [lo, hi] = U.extent(ys);
      const ex = U.linspace(-wd, wd, 401);
      const yMax = st0.scaleY ? Math.max(Z.env(wd), 1e-12) * 1.25 : st0.fn === 'osc' || st0.fn === 'step' ? 1.3 : 0.6;
      plot.render([
        { type: 'line', x: ex, y: ex.map(Z.env), color: 'tree', dash: '5 4', width: 1.2, hover: false },
        { type: 'line', x: ex, y: ex.map((x) => -Z.env(x)), color: 'tree', dash: '5 4', width: 1.2, hover: false },
        { type: 'line', x: cv.x, y: cv.y, color: 'model', width: 1.4, hover: false },
        { type: 'vline', x: 0, color: 'ink2', dash: '3 3', width: 1 },
      ], { x: [-wd, wd], y: [-yMax, yMax] });
      st.set('w', U.fmt(wd, 3));
      st.set('r', U.fmt(hi - lo, 3));
      st.set('L', Z.L === null ? 'нет' : String(Z.L));
      const msg = {
        osc: 'Сколько ни увеличивай, в окне умещаются бесконечно много колебаний от −1 до 1: размах остаётся 2. Значения не сжимаются ни к какому числу — <b>предела нет</b>.',
        xosc: 'Размах не больше 2w и стремится к нулю: колебания зажаты между −|x| и |x| (пунктир). Предел 0. Включите «масштабировать ось y» — картинка похожа сама на себя, но её масштаб уменьшается вместе с окном. Это идея «теоремы о сжатии» (урок 15.4).',
        x2osc: 'Здесь размах ≈ 2w² — ещё быстрее к нулю. Предел 0.',
        step: 'Скачок не исчезает ни при каком увеличении: размах всегда 1. Предела нет.',
      };
      note.innerHTML = msg[st0.fn];
    }
    w.pythonAction(() => 'import numpy as np\n\nf = lambda x: ' + ZM[st0.fn].py + '\nfor w in [0.5, 0.05, 0.005, 0.0005]:\n    x = np.linspace(-w, w, 200001)\n    x = x[x != 0]\n    y = f(x)\n    print(f"окно ±{w}: размах значений {y.max() - y.min():.6f}")\n');
    draw();
  });

  GBC.lesson153 = { curve, texInto, tnum, fmtInt, scanN, smallestN, card, cardGrid, badge, fact };
})();
