/* Урок 15.5: производная. Часть 2 — что производная говорит о функции, как её считать, производная в ML.
 * Виджеты: знак производной, сопоставление графиков f и f′, охота за экстремумами, теорема Лагранжа,
 * линейность, производная обратной функции, ошибка численной производной, производная по шумным данным,
 * темп градиентного спуска, производные функций потерь, наклон потерь на шести квартирах,
 * псевдо-остатки и пень, производная прогноза бустинга по признаку, тренажёр.
 * Помощники — из lesson.js (GBC.lesson155). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const { curve, logspace, decadeTicks, powFmt, card, cardGrid, badge, rowTable, nd, sigma, roots, yRange, tanSeg, FN, fnOpts, pyHead, FLATS } = GBC.lesson155;

  /* ==============================================================================
   * 16. Знак производной: где функция растёт и куда идти, чтобы её уменьшить
   * ============================================================================== */
  /** Критические точки на сетке: смена знака f′ или касание нуля. */
  function criticalPoints(F) {
    const xs = U.linspace(F.dom[0], F.dom[1], 2001);
    const out = [];
    for (let i = 1; i < xs.length - 1; i++) {
      const a = F.df(xs[i - 1]);
      const b = F.df(xs[i]);
      const c = F.df(xs[i + 1]);
      const left = Number.isFinite(a) ? a : c;
      const right = Number.isFinite(c) ? c : a;
      const here = Number.isFinite(b) ? b : 0;
      const isRoot = (Math.abs(here) < 1e-9 && Math.abs(left) > 1e-12) || (left < 0 && here > 0) || (left > 0 && here < 0);
      if (!isRoot) continue;
      if (out.length && xs[i] - out[out.length - 1].x < 0.01) continue;
      let kind;
      if (left < 0 && right > 0) kind = 'минимум';
      else if (left > 0 && right < 0) kind = 'максимум';
      else kind = 'полочка';
      out.push({ x: xs[i], kind, corner: !Number.isFinite(b) });
    }
    return out;
  }
  function signBands(df, xs) {
    const out = [];
    let start = xs[0];
    let sign = Math.sign(df(xs[0]));
    for (let i = 1; i <= xs.length; i++) {
      const sg = i < xs.length ? Math.sign(df(xs[i])) || sign : null;
      if (sg !== sign) {
        if (sign !== 0 && !Number.isNaN(sign)) out.push({ type: 'vband', x0: start, x1: xs[i - 1], color: sign > 0 ? 'pos' : 'neg', opacity: 0.1 });
        if (i < xs.length) (start = xs[i - 1]), (sign = sg);
      }
    }
    return out;
  }
  GBC.widget('slope-explorer', (el) => {
    const KEYS = ['cubic', 'sq', 'cube', 'sin', 'bump', 'sigm', 'abs'];
    const s = { fn: 'cubic', x: 1.8, trace: null };
    const NV = 80;
    const w = ui.shell(el, { title: 'Знак производной: где функция растёт', sub: 'Тяните оранжевую линию. Красный фон — f′ > 0 (функция растёт), синий — f′ < 0 (убывает). Стрелка показывает, куда шагнуть, чтобы уменьшить f. ▶ прочерчивает график f′ точка за точкой.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: fnOpts(KEYS), onChange: (v) => ((s.fn = v), (s.x = FN[v].dom[0] + 0.7 * (FN[v].dom[1] - FN[v].dom[0])), (s.trace = null), pl.stop(), pl.set(0), draw()) });
    const pl = ui.player(w.controls, { label: 'Прочертить f′', min: 0, max: NV, value: 0, fps: 12, format: (v) => Math.round((100 * v) / NV) + ' %', onChange: (v) => {
      const F = FN[s.fn];
      s.trace = v;
      s.x = F.dom[0] + ((F.dom[1] - F.dom[0]) * v) / NV;
      draw();
    } });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'x' }, y: { label: 'наклон f′(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'x' }, { key: 'f', label: 'f(x)' }, { key: 'd', label: 'f′(x)' }, { key: 'go', label: 'чтобы уменьшить f' }]);
    function draw() {
      const F = FN[s.fn];
      const x = U.clamp(s.x, F.dom[0], F.dom[1]);
      const xs = U.linspace(F.dom[0], F.dom[1], 401);
      const d = F.df(x);
      const crit = criticalPoints(F);
      const span = F.dom[1] - F.dom[0];
      const layers = signBands(F.df, xs);
      layers.push({ type: 'line', x: xs, y: xs.map(F.f), color: 'model', width: 2.2, label: 'f(x)' });
      if (Number.isFinite(d)) layers.push({ type: 'segments', ...tanSeg(F, x, span * 0.14), color: 'tree', width: 2.5, opacity: 1 });
      if (crit.length) {
        layers.push({ type: 'points', x: crit.map((c) => c.x), y: crit.map((c) => F.f(c.x)), color: 'ink', r: 4, hollow: true, label: 'f′ = 0 или излом', tooltip: (i) => [['x', U.fmt(crit[i].x, 3)], ['тип', crit[i].kind + (crit[i].corner ? ' (излом)' : '')]] });
        layers.push({ type: 'text', items: crit.map((c) => ({ x: c.x, y: F.f(c.x), dy: c.kind === 'максимум' ? -12 : 20, anchor: 'middle', text: c.kind })) });
      }
      if (Number.isFinite(d) && Math.abs(d) > 1e-6) layers.push({ type: 'arrows', x1: [x], y1: [F.f(x)], x2: [x + span * 0.12 * Math.sign(-d)], y2: [F.f(x)], color: 'ink', width: 2 });
      layers.push({ type: 'vline', x, color: 'tree', width: 1.5, draggable: true, onDrag: (v) => ((s.x = v), (s.trace = null), draw()) });
      layers.push({ type: 'points', x: [x], y: [F.f(x)], color: 'tree', r: 6 });
      p1.render(layers, { x: F.dom, y: yRange(F.f, xs) });
      const dxs = s.trace === null ? xs : xs.filter((v) => v <= x + 1e-12);
      const dc = curve(F.df, 0, 0, 0, { xs: dxs, jump: 0.5 });
      const all = xs.map(F.df).filter(Number.isFinite);
      const [dlo, dhi] = U.extent(all);
      const pad = (dhi - dlo) * 0.12 || 1;
      p2.render([
        { type: 'area', x: dxs, y0: dxs.map(() => 0), y1: dxs.map((v) => (Number.isFinite(F.df(v)) ? Math.max(F.df(v), 0) : 0)), color: 'pos', opacity: 0.18 },
        { type: 'area', x: dxs, y0: dxs.map(() => 0), y1: dxs.map((v) => (Number.isFinite(F.df(v)) ? Math.min(F.df(v), 0) : 0)), color: 'neg', opacity: 0.18 },
        { type: 'hline', y: 0, color: 'axis', width: 1.2 },
        { type: 'line', x: dc.x, y: dc.y, color: 'tree', width: 2.2, label: 'f′(x)' },
        Number.isFinite(d) ? { type: 'points', x: [x], y: [d], color: 'tree', r: 6 } : null,
        { type: 'vline', x, color: 'tree', width: 1, dash: '3 3' },
      ], { x: F.dom, y: [Math.min(dlo, 0) - pad, Math.max(dhi, 0) + pad] });
      st.set('x', U.fmt(x, 3));
      st.set('f', U.fmt(F.f(x), 3));
      st.set('d', Number.isFinite(d) ? U.fmt(d, 3) : 'нет (излом)');
      st.set('go', !Number.isFinite(d) ? '— (минимум)' : Math.abs(d) < 0.02 ? 'стоять' : d > 0 ? '← влево' : 'вправо →');
      let msg;
      if (!Number.isFinite(d)) msg = 'В изломе |x| производной нет: справа наклон +1, слева −1. Но это всё равно минимум.';
      else if (Math.abs(d) < 0.02) {
        const c = crit.find((q) => Math.abs(q.x - x) < 0.15);
        msg = '<b>f′(x) ≈ 0</b> — касательная горизонтальна. ' + (c ? 'Здесь ' + c.kind + (c.kind === 'полочка' ? ': f′ касается нуля, не меняя знака, и функция продолжает расти. Нулевая производная ещё не значит экстремум!' : c.kind === 'максимум' ? ': f′ меняет знак с + на −.' : ': f′ меняет знак с − на +.') : '');
      } else msg = d > 0 ? '<b>f′(x) = ' + U.fmt(d, 2) + ' > 0</b>: функция растёт. Чтобы уменьшить f, идём <b>влево</b>, против знака производной.' : '<b>f′(x) = ' + U.fmt(d, 2) + ' &lt; 0</b>: функция убывает. Чтобы уменьшить f, идём <b>вправо</b>.';
      if (s.fn === 'sigm') msg += ' У сигмоиды f′ > 0 везде — она монотонно растёт, хотя у краёв почти горизонтальна.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const F = FN[s.fn];
      return pyHead(F) + '\nx = np.linspace(' + F.dom[0] + ', ' + F.dom[1] + ', 400)\nd = df(x)\nfig, (a1, a2) = plt.subplots(2, 1, figsize=(7, 6), sharex=True)\na1.plot(x, f(x), label="f(x)")\na1.legend()\na2.plot(x, d, color="C1", label="f\'(x)")\na2.fill_between(x, 0, d, where=d > 0, color="#e34948", alpha=0.2)\na2.fill_between(x, 0, d, where=d < 0, color="#2a78d6", alpha=0.2)\na2.axhline(0, color="gray", lw=1)\na2.legend()\nplt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * 17. Сопоставление графиков f и f′
   * ============================================================================== */
  const sg = (x) => (x > 0 ? 1 : x < 0 ? -1 : NaN);
  const PUZ = [
    { name: 'парабола x² − 1', f: (x) => x * x - 1, df: (x) => 2 * x, dom: [-2, 2], dDec: [(x) => x * x - 1.5, (x) => -2 * x], fDec: [(x) => -x * x + 1, (x) => (x * x * x) / 3], why: 'Слева от вершины f убывает — f′ < 0, справа растёт — f′ > 0, в вершине f′ = 0. Прямая через начало координат с наклоном 2.' },
    { name: 'горка и яма x³/3 − x', f: (x) => (x * x * x) / 3 - x, df: (x) => x * x - 1, dom: [-2.4, 2.4], dDec: [(x) => 1 - x * x, (x) => 2 * x], fDec: [(x) => x - (x * x * x) / 3, (x) => x * x - 1], why: 'Горка в −1 и яма в 1 — нули f′. Между ними f убывает (f′ < 0), по краям растёт: парабола ветвями вверх.' },
    { name: 'волна sin x', f: Math.sin, df: Math.cos, dom: [-4, 4], dDec: [(x) => -Math.cos(x), (x) => -Math.sin(x)], fDec: [(x) => Math.cos(x), (x) => -Math.sin(x)], why: 'Где у синуса вершины (±π/2), там у f′ нули; в нуле синус растёт круче всего — f′(0) = 1 — это cos.' },
    { name: 'экспонента eˣ', f: Math.exp, df: Math.exp, dom: [-2.5, 1.5], dDec: [(x) => Math.exp(-x), (x) => x + 1], fDec: [(x) => Math.exp(x) + 1, (x) => Math.exp(-x)], why: 'Экспонента всё время растёт и всё круче — f′ положительна и тоже растёт. Особый случай: f′ совпадает с f.' },
    { name: 'горб x·e⁻ˣ', f: (x) => x * Math.exp(-x), df: (x) => (1 - x) * Math.exp(-x), dom: [-0.5, 5], dDec: [(x) => (x - 1) * Math.exp(-x), (x) => x * Math.exp(-x) - 0.25], fDec: [(x) => -x * Math.exp(-x), (x) => (2 - x) * Math.exp(-x)], why: 'Вершина горба в x = 1 — там f′ пересекает ноль сверху вниз. Справа f медленно убывает к нулю: f′ слегка отрицательна и тоже → 0.' },
    { name: 'сигмоида σ(x)', f: sigma, df: (x) => sigma(x) * (1 - sigma(x)), dom: [-6, 6], dDec: [(x) => sigma(x) - 0.5, (x) => -sigma(x) * (1 - sigma(x))], fDec: [(x) => 1 - sigma(x), (x) => sigma(x) * (1 - sigma(x))], why: 'Сигмоида всюду растёт (f′ > 0), круче всего в нуле — там у f′ пик 0.25; на краях почти горизонтальна — f′ → 0.' },
    { name: 'модуль |x|', f: Math.abs, df: sg, dom: [-2, 2], dDec: [(x) => -sg(x), (x) => x], fDec: [(x) => -Math.abs(x), (x) => x * Math.abs(x) / 2], why: 'Две прямые с наклонами −1 и +1 дают f′ из двух горизонтальных полочек; в нуле f′ не определена — разрыв.' },
    { name: 'W-образная x⁴/4 − x²', f: (x) => x ** 4 / 4 - x * x, df: (x) => x ** 3 - 2 * x, dom: [-2.2, 2.2], dDec: [(x) => 2 * x - x ** 3, (x) => x * x - 2], fDec: [(x) => x * x - x ** 4 / 4, (x) => x ** 3 / 3 - 2 * x], why: 'Две ямы в ±√2 и горка в 0 — три нуля f′. Кубическая парабола: отрицательна слева от −√2, положительна между −√2 и 0 и так далее.' },
  ];
  const LET = ['A', 'B', 'C'];
  GBC.widget('graph-match', (el) => {
    const s = { i: 0, mode: 'd', answered: null, order: [0, 1, 2], right: 0, total: 0 };
    const w = ui.shell(el, { title: 'Сопоставьте графики f и f′', sub: 'Сверху — заданный график. Какой из трёх ниже ему соответствует? Подсказка: найдите, где сверху горки и ямы (там у f′ нули) и где функция растёт (там f′ > 0).' });
    ui.segmented(w.controls, { label: 'Задание', value: s.mode, options: [{ value: 'd', label: 'дано f → найти f′' }, { value: 'f', label: 'дано f′ → найти f' }], onChange: (v) => ((s.mode = v), shuffle(), draw()) });
    const sel = ui.select(w.controls, { label: 'Задача', value: '0', options: PUZ.map((P, i) => ({ value: String(i), label: i + 1 + '. ' + P.name })), onChange: (v) => ((s.i = +v), shuffle(), draw()) });
    const btns = LET.map((L, j) => ui.button(w.controls, { label: 'Ответ ' + L, kind: 'primary', onClick: () => answer(j) }));
    ui.button(w.controls, { label: 'Следующая задача', icon: 'step', onClick: () => ((s.i = (s.i + 1) % PUZ.length), sel.set(String(s.i)), shuffle(), draw()) });
    const top = new GBC.Plot(w.main, { height: 210, x: { label: 'x' }, y: { label: 'дано' } });
    const grid = cardGrid(180);
    w.main.appendChild(grid);
    const cards = LET.map((L) => {
      const c = card('График ' + L);
      grid.appendChild(c.el);
      const p = new GBC.Plot(c.body, { height: 140, x: { label: '' }, y: { label: '' }, margin: { left: 36, bottom: 22, top: 6, right: 8 } });
      return { c, p };
    });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ok', label: 'верно' }, { key: 'n', label: 'отвечено' }]);
    function shuffle() {
      const rng = new GBC.RNG(17 + s.i * 7 + (s.mode === 'f' ? 100 : 0));
      s.order = rng.permutation ? rng.permutation(3) : [0, 1, 2];
      s.answered = null;
    }
    function answer(j) {
      if (s.answered !== null) return;
      s.answered = j;
      s.total++;
      if (s.order[j] === 0) s.right++;
      draw();
    }
    function draw() {
      const P = PUZ[s.i];
      const xs = U.linspace(P.dom[0], P.dom[1], 401);
      const given = s.mode === 'd' ? P.f : P.df;
      const cands = s.mode === 'd' ? [P.df, ...P.dDec] : [P.f, ...P.fDec];
      const zeros = roots(P.df, P.dom[0], P.dom[1], 800);
      const show = s.answered !== null;
      const marks = show ? zeros.map((z) => ({ type: 'vline', x: z, color: 'ink2', dash: '3 3', width: 1 })) : [];
      const gc = curve(given, P.dom[0], P.dom[1], 0, { xs, jump: 0.5 });
      top.render([{ type: 'hline', y: 0, color: 'axis', width: 1 }, ...marks, { type: 'line', x: gc.x, y: gc.y, color: s.mode === 'd' ? 'model' : 'tree', width: 2.4, hover: false }], { x: P.dom });
      top.opts.y.label = s.mode === 'd' ? 'f(x)' : 'f′(x)';
      cards.forEach((C, j) => {
        const fn = cands[s.order[j]];
        const cc = curve(fn, P.dom[0], P.dom[1], 0, { xs, jump: 0.5 });
        const good = s.order[j] === 0;
        C.p.render([{ type: 'hline', y: 0, color: 'axis', width: 1 }, ...marks, { type: 'line', x: cc.x, y: cc.y, color: show && good ? 'good' : s.mode === 'd' ? 'tree' : 'model', width: 2.2, hover: false }], { x: P.dom });
        C.c.el.style.outline = show ? (good ? '2px solid var(--good)' : j === s.answered ? '2px solid var(--critical)' : 'none') : 'none';
      });
      top.draw();
      btns.forEach((b) => (b.disabled = show));
      st.set('ok', String(s.right));
      st.set('n', String(s.total));
      const corr = LET[s.order.indexOf(0)];
      note.innerHTML = !show ? 'Выберите A, B или C.' : (s.order[s.answered] === 0 ? '<b>Верно!</b> ' : '<b>Не совсем:</b> правильный — ' + corr + '. ') + P.why + ' Пунктир — точки, где f′ = 0.';
    }
    w.pythonAction(() => 'import numpy as np\nimport matplotlib.pyplot as plt\n\n# задача: ' + PUZ[s.i].name + '\nx = np.linspace(' + PUZ[s.i].dom[0] + ', ' + PUZ[s.i].dom[1] + ', 400)\nf = {"x² − 1": lambda x: x**2 - 1, "x³/3 − x": lambda x: x**3 / 3 - x, "sin": np.sin, "exp": np.exp, "x·e⁻ˣ": lambda x: x * np.exp(-x), "σ": lambda x: 1 / (1 + np.exp(-x)), "|x|": np.abs, "x⁴/4 − x²": lambda x: x**4 / 4 - x**2}\nname = list(f)[' + s.i + ']\ng = f[name]\nd = np.gradient(g(x), x)   # численная производная по сетке\nfig, (a1, a2) = plt.subplots(2, 1, figsize=(7, 5), sharex=True)\na1.plot(x, g(x)); a1.set_ylabel("f")\na2.plot(x, d, color="C1"); a2.axhline(0, color="gray", lw=1); a2.set_ylabel("f\'")\nplt.show()\n');
    shuffle();
    draw();
  });

  /* ==============================================================================
   * 18. Охота за экстремумами на отрезке
   * ============================================================================== */
  const EXT = {
    p1: { label: '★ x² − 4x на [0, 5]', f: (x) => x * x - 4 * x, df: (x) => 2 * x - 4, ab: [0, 5], lim: [-1, 6], kinks: [], py: 'x**2 - 4 * x' },
    p2: { label: '★★ x³ − 3x на [−2, 3]', f: (x) => x ** 3 - 3 * x, df: (x) => 3 * x * x - 3, ab: [-2, 3], lim: [-3, 3.2], kinks: [], py: 'x**3 - 3 * x' },
    p3: { label: '★★ x·e⁻ˣ на [0, 4]', f: (x) => x * Math.exp(-x), df: (x) => (1 - x) * Math.exp(-x), ab: [0, 4], lim: [-0.5, 6], kinks: [], py: 'x * np.exp(-x)' },
    p4: { label: '★★ x⁴ − 2x² на [−1.5, 2]', f: (x) => x ** 4 - 2 * x * x, df: (x) => 4 * x ** 3 - 4 * x, ab: [-1.5, 2], lim: [-2, 2.2], kinks: [], py: 'x**4 - 2 * x**2' },
    p5: { label: '★★★ |x² − 1| на [−2, 2] — изломы', f: (x) => Math.abs(x * x - 1), df: (x) => (Math.abs(x * x - 1) < 1e-12 ? NaN : 2 * x * Math.sign(x * x - 1)), ab: [-2, 2], lim: [-2.5, 2.5], kinks: [-1, 1], py: 'np.abs(x**2 - 1)' },
    p6: { label: '★★★ x³ на [−1, 1] — полочка', f: (x) => x ** 3, df: (x) => 3 * x * x, ab: [-1, 1], lim: [-1.5, 1.5], kinks: [], py: 'x**3' },
  };
  GBC.widget('extremum-hunter', (el) => {
    const s = { c: 'p2', a: -2, b: 3 };
    const w = ui.shell(el, { title: 'Охота за экстремумами на отрезке', sub: 'Алгоритм: 1) найти точки, где f′ = 0 или производной нет (критические точки); 2) добавить концы отрезка; 3) сравнить значения f. Наибольшее — максимум, наименьшее — минимум. Двигайте концы отрезка — ответ может переехать на край.' });
    ui.select(w.controls, { label: 'Задача', value: s.c, options: Object.entries(EXT).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.c = v;
      const E = EXT[v];
      [s.a, s.b] = E.ab;
      for (const sl of [aSl, bSl]) (sl.input.min = E.lim[0]), (sl.input.max = E.lim[1]);
      aSl.set(s.a);
      bSl.set(s.b);
      draw();
    } });
    const aSl = ui.slider(w.controls, { label: 'Левый конец a', min: -3, max: 3.2, step: 0.05, value: s.a, onInput: (v) => ((s.a = Math.min(v, s.b - 0.1)), draw()) });
    const bSl = ui.slider(w.controls, { label: 'Правый конец b', min: -3, max: 3.2, step: 0.05, value: s.b, onInput: (v) => ((s.b = Math.max(v, s.a + 0.1)), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 170, x: { label: 'x' }, y: { label: 'f′(x)' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const E = EXT[s.c];
      const [a, b] = [s.a, s.b];
      const lim = E.lim;
      const stat = roots(E.df, a + 1e-9, b - 1e-9, 3000).filter((x) => Math.abs(E.df(x)) < 1e-6 || !E.kinks.some((k) => Math.abs(k - x) < 1e-6));
      const kinks = E.kinks.filter((k) => k > a && k < b);
      const statF = stat.filter((x) => !kinks.some((k) => Math.abs(k - x) < 1e-6));
      const cands = [{ x: a, t: 'конец' }, ...statF.map((x) => ({ x, t: 'f′ = 0' })), ...kinks.map((x) => ({ x, t: 'излом' })), { x: b, t: 'конец' }].sort((p, q) => p.x - q.x);
      for (const c of cands) {
        c.f = E.f(c.x);
        if (c.t === 'конец') c.kind = '';
        else {
          const l = E.df(c.x - 1e-4);
          const r = E.df(c.x + 1e-4);
          c.kind = l < 0 && r > 0 ? 'лок. минимум' : l > 0 && r < 0 ? 'лок. максимум' : 'не экстремум';
        }
      }
      const fmax = Math.max(...cands.map((c) => c.f));
      const fmin = Math.min(...cands.map((c) => c.f));
      const xs = U.linspace(lim[0], lim[1], 601);
      const c = curve(E.f, lim[0], lim[1], 601);
      const [ylo, yhi] = yRange(E.f, xs.filter((x) => x >= a - 0.3 && x <= b + 0.3), 0.15);
      p1.render([
        { type: 'vband', x0: lim[0], x1: a, color: 'muted', opacity: 0.25 },
        { type: 'vband', x0: b, x1: lim[1], color: 'muted', opacity: 0.25 },
        { type: 'line', x: c.x, y: c.y, color: 'model', width: 2.2, hover: false },
        { type: 'points', x: cands.map((q) => q.x), y: cands.map((q) => q.f), color: (i) => (cands[i].f === fmax ? 'pos' : cands[i].f === fmin ? 'neg' : 'ink2'), r: 6, tooltip: (i) => [['x', U.fmt(cands[i].x, 4)], ['f(x)', U.fmt(cands[i].f, 4)], ['тип', cands[i].t]] },
        { type: 'text', items: cands.filter((q) => q.f === fmax || q.f === fmin).map((q) => ({ x: q.x, y: q.f, dy: q.f === fmax ? -12 : 20, anchor: 'middle', text: q.f === fmax ? 'max' : 'min', bold: true })) },
      ], { x: lim, y: [ylo, yhi] });
      const dc = curve(E.df, lim[0], lim[1], 0, { xs, jump: 1 });
      const dv = dc.y.filter(Number.isFinite);
      const [dlo, dhi] = U.extent(dv.filter((v, i) => dc.x[i] >= a && dc.x[i] <= b).concat([0]));
      p2.render([
        ...signBands(E.df, xs.filter((x) => x >= a && x <= b)),
        { type: 'hline', y: 0, color: 'axis', width: 1.2 },
        { type: 'line', x: dc.x, y: dc.y, color: 'tree', width: 2.2, hover: false },
      ], { x: lim, y: [dlo - 0.15 * (dhi - dlo + 1), dhi + 0.15 * (dhi - dlo + 1)] });
      rowTable(tbl, ['кандидат', 'x', 'f(x)', 'вывод'], cands.map((q) => [q.t, U.fmt(q.x, 4), U.fmt(q.f, 4), [q.f === fmax ? 'наибольшее' : q.f === fmin ? 'наименьшее' : '', q.kind].filter(Boolean).join(', ')]));
      const nmax = cands.filter((q) => q.f === fmax);
      const nmin = cands.filter((q) => q.f === fmin);
      let msg = 'На [' + U.fmt(a, 2) + '; ' + U.fmt(b, 2) + ']: max f = <b>' + U.fmt(fmax, 4) + '</b> при x = ' + nmax.map((q) => U.fmt(q.x, 3)).join(' и ') + ', min f = <b>' + U.fmt(fmin, 4) + '</b> при x = ' + nmin.map((q) => U.fmt(q.x, 3)).join(' и ') + '. ';
      if (nmax.concat(nmin).some((q) => q.t === 'конец')) msg += 'Ответ на <b>конце</b> отрезка: там f′ ≠ 0, но идти дальше нельзя. ';
      if (s.c === 'p6') msg += 'В x = 0 f′ = 0, но f′ не меняет знак — полочка, не экстремум. ';
      if (s.c === 'p5') msg += 'Минимумы — в изломах x = ±1, где производной нет: такие точки тоже надо проверять. ';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const E = EXT[s.c];
      return 'import numpy as np\n\nf = lambda x: ' + E.py + '\na, b = ' + U.pyNum(s.a) + ', ' + U.pyNum(s.b) + '\nx = np.linspace(a, b, 200001)        # густая сетка как проверка\ni, j = np.argmax(f(x)), np.argmin(f(x))\nprint(f"max f = {f(x[i]):.4f} при x = {x[i]:.4f}")\nprint(f"min f = {f(x[j]):.4f} при x = {x[j]:.4f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 19. Теоремы Ролля и Лагранжа: касательная, параллельная секущей
   * ============================================================================== */
  const MVT = {
    cube: { label: 'x³ на [0, 2]', f: (x) => x ** 3, df: (x) => 3 * x * x, ab: [0, 2], dom: [-1.6, 2.4], py: ['x**3', '3 * x**2'] },
    sin: { label: 'sin x на [0, π/2]', f: Math.sin, df: Math.cos, ab: [0, Math.PI / 2], dom: [-1, 3.5], py: ['np.sin(x)', 'np.cos(x)'] },
    sq: { label: 'x² — c всегда в середине', f: (x) => x * x, df: (x) => 2 * x, ab: [-1, 2], dom: [-2.2, 2.4], py: ['x**2', '2 * x'] },
    rolle: { label: 'Ролль: x³/3 − x на [−√3, √3]', f: (x) => x ** 3 / 3 - x, df: (x) => x * x - 1, ab: [-Math.sqrt(3), Math.sqrt(3)], dom: [-2.4, 2.4], py: ['x**3 / 3 - x', 'x**2 - 1'] },
    sqrt: { label: '√x на [0, 4]', f: (x) => Math.sqrt(Math.max(x, 0)), df: (x) => (x > 0 ? 0.5 / Math.sqrt(x) : NaN), ab: [0, 4], dom: [0, 4.6], py: ['np.sqrt(x)', '1 / (2 * np.sqrt(x))'] },
    abs: { label: '|x| на [−1, 2] — теорема не работает', f: Math.abs, df: (x) => (x > 0 ? 1 : x < 0 ? -1 : NaN), ab: [-1, 2], dom: [-2, 2.5], py: ['np.abs(x)', 'np.sign(x)'] },
  };
  GBC.widget('mvt-lab', (el) => {
    const s = { c: 'cube', a: 0, b: 2 };
    const w = ui.shell(el, { title: 'Теорема Лагранжа: касательная параллельна секущей', sub: 'Тяните концы a и b. Между ними найдётся точка c, где наклон касательной f′(c) равен наклону секущей (f(b) − f(a)) / (b − a) — если f гладкая на отрезке. Пример с |x| показывает, что без производной теорема ломается.' });
    ui.select(w.controls, { label: 'Пример', value: s.c, options: Object.entries(MVT).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.c = v), ([s.a, s.b] = MVT[v].ab), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'f(x)' } });
    const verdict = H('div', { style: 'margin:6px 0' });
    w.main.appendChild(verdict);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ab', label: '[a, b]' }, { key: 'k', label: 'наклон секущей' }, { key: 'c', label: 'точки c' }, { key: 'dc', label: 'f′(c)' }]);
    function draw() {
      const E = MVT[s.c];
      const { a, b } = s;
      const k = (E.f(b) - E.f(a)) / (b - a);
      const cs = roots((x) => E.df(x) - k, a + 1e-9, b - 1e-9, 3000);
      const xs = U.linspace(E.dom[0], E.dom[1], 601);
      const lx = [E.dom[0], E.dom[1]];
      const layers = [
        { type: 'vband', x0: a, x1: b, color: 'tree', opacity: 0.06 },
        { type: 'line', x: xs, y: xs.map(E.f), color: 'model', width: 2.2, label: 'f(x)', hover: false },
        { type: 'line', x: lx, y: lx.map((x) => E.f(a) + k * (x - a)), color: 'aqua', width: 2, label: 'секущая', hover: false },
      ];
      cs.forEach((c, i) => layers.push({ type: 'line', x: lx, y: lx.map((x) => E.f(c) + k * (x - c)), color: 'tree', width: 2, dash: '6 4', label: i === 0 ? 'касательная в c' : undefined, hover: false }));
      if (cs.length) layers.push({ type: 'points', x: cs, y: cs.map(E.f), color: 'tree', r: 6, tooltip: (i) => [['c', U.fmt(cs[i], 4)], ['f′(c)', U.fmt(E.df(cs[i]), 4)]] });
      layers.push({ type: 'points', x: [a, b], y: [E.f(a), E.f(b)], color: 'aqua', r: 7, draggable: true, label: 'концы (тяните)', onDrag: (i, x) => {
        const v = U.clamp(Math.round(x * 20) / 20, E.dom[0], E.dom[1]);
        if (i === 0) s.a = Math.min(v, s.b - 0.1);
        else s.b = Math.max(v, s.a + 0.1);
        draw();
      } });
      plot.render(layers, { x: E.dom, y: yRange(E.f, xs, 0.12) });
      st.set('ab', '[' + U.fmt(a, 3) + '; ' + U.fmt(b, 3) + ']');
      st.set('k', U.fmt(k, 4));
      st.set('c', cs.length ? cs.map((c) => U.fmt(c, 4)).join('; ') : 'нет');
      st.set('dc', cs.length ? U.fmt(E.df(cs[0]), 4) : '—');
      verdict.replaceChildren(cs.length ? badge('Нашлась точка c: f′(c) = наклон секущей', 'good') : badge('Такой точки нет', 'bad'));
      const msgs = {
        cube: 'Для x³ на [0, 2]: наклон секущей (8 − 0)/2 = 4, и 3c² = 4 даёт c = 2/√3 ≈ 1.1547.',
        sin: 'Для sin на [0, π/2]: наклон секущей 1/(π/2) = 2/π ≈ 0.6366, cos c = 2/π даёт c ≈ 0.8807.',
        sq: 'Для параболы точка c всегда ровно посередине отрезка: 2c = a + b. Проверьте, двигая концы.',
        rolle: 'Теорема Ролля — частный случай: f(a) = f(b), секущая горизонтальна, значит, где-то между ними f′(c) = 0 — горка или яма.',
        sqrt: 'В точке 0 у √x производной нет (касательная вертикальна), но теорема требует производную лишь <b>внутри</b> отрезка, а на концах — только непрерывность. Поэтому c = 1 существует.',
        abs: 'У |x| на [−1, 2] секущая имеет наклон (2 − 1)/3 = 1/3, а у самой функции наклоны только ±1. Теорема не обманывает: внутри отрезка есть точка 0, где производной нет, — условие нарушено.',
      };
      note.innerHTML = msgs[s.c] + (s.c !== 'abs' && cs.length > 1 ? ' Здесь таких точек несколько — теорема гарантирует хотя бы одну.' : '');
    }
    w.pythonAction(() => {
      const E = MVT[s.c];
      return 'import numpy as np\nfrom scipy.optimize import brentq\n\nf = lambda x: ' + E.py[0] + '\ndf = lambda x: ' + E.py[1] + '\na, b = ' + U.pyNum(s.a) + ', ' + U.pyNum(s.b) + '\nk = (f(b) - f(a)) / (b - a)\nprint("наклон секущей:", k)\nx = np.linspace(a + 1e-9, b - 1e-9, 3001)\ng = df(x) - k\nfor i in np.where(np.sign(g[:-1]) * np.sign(g[1:]) < 0)[0]:\n    c = brentq(lambda t: df(t) - k, x[i], x[i + 1])\n    print(f"c = {c:.6f}, f\'(c) = {df(c):.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 20. Линейность: наклон суммы — сумма наклонов
   * ============================================================================== */
  const LINF = {
    sq: { t: 'x²', f: (x) => x * x, df: (x) => 2 * x, py: ['x**2', '2 * x'] },
    sin: { t: 'sin x', f: Math.sin, df: Math.cos, py: ['np.sin(x)', 'np.cos(x)'] },
    exp: { t: 'eˣ', f: Math.exp, df: Math.exp, py: ['np.exp(x)', 'np.exp(x)'] },
    lin: { t: 'x', f: (x) => x, df: () => 1, py: ['x', '1 + 0 * x'] },
    cube: { t: 'x³', f: (x) => x ** 3, df: (x) => 3 * x * x, py: ['x**3', '3 * x**2'] },
  };
  GBC.widget('linearity-lab', (el) => {
    const s = { f: 'sq', g: 'sin', al: 1, be: 2, x0: 0.8 };
    const w = ui.shell(el, { title: 'Линейность: (αf + βg)′ = αf′ + βg′', sub: 'Сверху — две функции с весами и их сумма h = αf + βg с касательной в точке x₀. Снизу — «склад наклонов»: вклад αf′(x₀), вклад βg′(x₀) и их сумма. Наклон суммы всегда равен сумме наклонов.' });
    const opts = Object.entries(LINF).map(([k, v]) => ({ value: k, label: v.t }));
    ui.select(w.controls, { label: 'f(x)', value: s.f, options: opts, onChange: (v) => ((s.f = v), draw()) });
    ui.select(w.controls, { label: 'g(x)', value: s.g, options: opts, onChange: (v) => ((s.g = v), draw()) });
    ui.slider(w.controls, { label: 'Вес α', min: -2, max: 2, step: 0.1, value: s.al, onInput: (v) => ((s.al = v), draw()) });
    ui.slider(w.controls, { label: 'Вес β', min: -2, max: 2, step: 0.1, value: s.be, onInput: (v) => ((s.be = v), draw()) });
    ui.slider(w.controls, { label: 'Точка x₀', min: -1.8, max: 1.8, step: 0.05, value: s.x0, onInput: (v) => ((s.x0 = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x', domain: [-2, 2] }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 180, x: { label: '', domain: [0.4, 3.6], ticks: [1, 2, 3], format: (v) => (v === 1 ? 'αf′(x₀)' : v === 2 ? 'βg′(x₀)' : 'h′(x₀)') }, y: { label: 'наклон' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'αf′(x₀)' }, { key: 'b', label: 'βg′(x₀)' }, { key: 'sum', label: 'сумма' }, { key: 'num', label: 'h′(x₀) численно' }]);
    function draw() {
      const F = LINF[s.f];
      const G = LINF[s.g];
      const hf = (x) => s.al * F.f(x) + s.be * G.f(x);
      const x0 = s.x0;
      const A = s.al * F.df(x0);
      const B = s.be * G.df(x0);
      const num = nd(hf, x0, 1e-5);
      const xs = U.linspace(-2, 2, 401);
      p1.render([
        { type: 'line', x: xs, y: xs.map((x) => s.al * F.f(x)), color: 'aqua', width: 1.6, opacity: 0.8, label: 'αf', hover: false },
        { type: 'line', x: xs, y: xs.map((x) => s.be * G.f(x)), color: 'violet', width: 1.6, opacity: 0.8, label: 'βg', hover: false },
        { type: 'line', x: xs, y: xs.map(hf), color: 'model', width: 2.6, label: 'h = αf + βg', hover: false },
        { type: 'segments', x1: [x0 - 0.5], y1: [hf(x0) - 0.5 * (A + B)], x2: [x0 + 0.5], y2: [hf(x0) + 0.5 * (A + B)], color: 'tree', width: 2.5, opacity: 1 },
        { type: 'points', x: [x0], y: [hf(x0)], color: 'tree', r: 6 },
      ], { y: yRange(hf, xs, 0.2).map((v, i) => (i ? Math.max(v, ...xs.map((x) => s.al * F.f(x)), ...xs.map((x) => s.be * G.f(x))) : Math.min(v, ...xs.map((x) => s.al * F.f(x)), ...xs.map((x) => s.be * G.f(x))))) });
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1.2 },
        { type: 'bars', x: [1, 2, 3], y: [A, B, A + B], color: (i) => ['aqua', 'violet', 'tree'][i], width: 0.6, maxPx: 70 },
        { type: 'segments', x1: [1.3, 2.3], y1: [A, A], x2: [1.7, 2.3], y2: [A, A + B], color: 'ink2', width: 1, opacity: 0.7, dash: '3 3' },
        { type: 'text', items: [{ x: 1, y: A, dy: A >= 0 ? -6 : 14, anchor: 'middle', text: U.fmt(A, 3) }, { x: 2, y: B, dy: B >= 0 ? -6 : 14, anchor: 'middle', text: U.fmt(B, 3) }, { x: 3, y: A + B, dy: A + B >= 0 ? -6 : 14, anchor: 'middle', text: U.fmt(A + B, 3), bold: true }] },
      ], { y: [Math.min(0, A, B, A + B) * 1.3 - 0.3, Math.max(0, A, B, A + B) * 1.3 + 0.3] });
      st.set('a', U.fmt(A, 4));
      st.set('b', U.fmt(B, 4));
      st.set('sum', U.fmt(A + B, 4));
      st.set('num', U.fmt(num, 4));
      note.innerHTML = 'h′(x₀) = ' + U.fmt(s.al, 2) + '·' + U.fmt(F.df(x0), 3) + ' + ' + U.fmt(s.be, 2) + '·' + U.fmt(G.df(x0), 3) + ' = <b>' + U.fmt(A + B, 4) + '</b>; численная проверка даёт ' + U.fmt(num, 4) + '. Доказательство — одна строка: разностное отношение суммы равно сумме разностных отношений, а предел суммы — сумме пределов (урок 15.4). Именно поэтому производная суммарных потерь по прогнозу — сумма производных по объектам.';
    }
    w.pythonAction(() => {
      const F = LINF[s.f];
      const G = LINF[s.g];
      return 'import numpy as np\n\nf, df = (lambda x: ' + F.py[0] + '), (lambda x: ' + F.py[1] + ')\ng, dg = (lambda x: ' + G.py[0] + '), (lambda x: ' + G.py[1] + ')\nal, be, x0 = ' + U.pyNum(s.al) + ', ' + U.pyNum(s.be) + ', ' + U.pyNum(s.x0) + '\nh = lambda x: al * f(x) + be * g(x)\neps = 1e-5\nprint("по правилу:  ", al * df(x0) + be * dg(x0))\nprint("численно:    ", (h(x0 + eps) - h(x0 - eps)) / (2 * eps))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 21. Производная обратной функции: наклон в зеркале y = x
   * ============================================================================== */
  const INV = {
    sq: { label: 'x² (x ≥ 0) ↔ √x', f: (x) => x * x, df: (x) => 2 * x, inv: Math.sqrt, dom: [0, 2.1], view: [-0.4, 4.6], a0: 1.5, ft: 'x²', it: '√x' },
    exp: { label: 'eˣ ↔ ln x', f: Math.exp, df: Math.exp, inv: Math.log, dom: [-3, 1.5], view: [-3, 4.6], a0: 0.5, ft: 'eˣ', it: 'ln x' },
    cube: { label: 'x³ ↔ ∛x', f: (x) => x ** 3, df: (x) => 3 * x * x, inv: Math.cbrt, dom: [-1.4, 1.4], view: [-2.8, 2.8], a0: 0.8, ft: 'x³', it: '∛x' },
    sigm: { label: 'σ(x) ↔ logit p = ln(p/(1 − p))', f: sigma, df: (x) => sigma(x) * (1 - sigma(x)), inv: (p) => Math.log(p / (1 - p)), dom: [-5, 5], view: [-5, 5], a0: 2.2, ft: 'σ(x)', it: 'logit' },
  };
  GBC.widget('inverse-slope', (el) => {
    const s = { c: 'exp', a: 0.5 };
    const w = ui.shell(el, { title: 'Наклон обратной функции: зеркало y = x', sub: 'График обратной функции — отражение графика f относительно диагонали y = x. Точка P = (a, f(a)) переходит в Q = (f(a), a), касательная — в касательную, а при отражении подъём и пробег меняются местами. Поэтому наклоны взаимно обратны.' });
    const aSl = ui.slider(w.controls, { label: 'Точка a', min: -3, max: 1.5, step: 0.05, value: s.a, onInput: (v) => ((s.a = v), draw()) });
    ui.select(w.controls, { label: 'Пара функций', value: s.c, options: Object.entries(INV).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.c = v;
      const E = INV[v];
      aSl.input.min = E.dom[0];
      aSl.input.max = E.dom[1];
      s.a = E.a0;
      aSl.set(s.a);
      draw();
    } });
    const plot = new GBC.Plot(w.main, { height: 360, equal: true, x: { label: 'x' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'P', label: 'P = (a, f(a))' }, { key: 'k', label: 'наклон f в P' }, { key: 'ik', label: 'наклон обратной в Q' }, { key: 'pr', label: 'произведение' }]);
    function draw() {
      const E = INV[s.c];
      const a = U.clamp(s.a, E.dom[0], E.dom[1]);
      const fa = E.f(a);
      const k = E.df(a);
      const xs = U.linspace(E.dom[0], E.dom[1], 401);
      const V = E.view;
      const L = 0.9;
      const dl = L / Math.sqrt(1 + k * k);
      const layers = [
        { type: 'line', x: V, y: V, color: 'ink2', width: 1.2, dash: '4 4', label: 'y = x', hover: false },
        { type: 'line', x: xs, y: xs.map(E.f), color: 'model', width: 2.4, label: 'y = ' + E.ft, hover: false },
        { type: 'line', x: xs.map(E.f), y: xs, color: 'aqua', width: 2.4, label: 'обратная: y = ' + E.it, hover: false },
        { type: 'segments', x1: [a], y1: [fa], x2: [fa], y2: [a], color: 'ink2', width: 1, opacity: 0.6, dash: '2 3' },
        { type: 'segments', x1: [a - dl], y1: [fa - dl * k], x2: [a + dl], y2: [fa + dl * k], color: 'tree', width: 2.6, opacity: 1 },
        { type: 'segments', x1: [fa - dl * k], y1: [a - dl], x2: [fa + dl * k], y2: [a + dl], color: 'violet', width: 2.6, opacity: 1 },
        { type: 'points', x: [a], y: [fa], color: 'tree', r: 6, label: 'P' },
        { type: 'points', x: [fa], y: [a], color: 'violet', r: 6, label: 'Q' },
      ];
      plot.render(layers, { x: V, y: V });
      st.set('P', '(' + U.fmt(a, 3) + '; ' + U.fmt(fa, 3) + ')');
      st.set('k', U.fmt(k, 4));
      st.set('ik', Math.abs(k) < 1e-9 ? '∞ (вертикаль)' : U.fmt(1 / k, 4));
      st.set('pr', Math.abs(k) < 1e-9 ? '—' : U.fmt(k * (1 / k), 4));
      const msgs = {
        sq: 'Наклон x² в точке a равен 2a, значит, наклон √y в точке y = a² равен 1/(2a) = 1/(2√y) — та же формула, что «по определению» в шаге 4.',
        exp: 'Наклон eˣ в точке a равен eᵃ = y. Значит, наклон ln в точке y равен 1/y: <b>(ln y)′ = 1/y</b> — получили без единого предела.',
        cube: 'При a = 0 наклон x³ равен 0 — касательная горизонтальна, а у ∛x в нуле она вертикальна: производной нет (шаг 12). Делить на 0 нельзя, и это видно в зеркале.',
        sigm: 'Наклон сигмоиды p(1 − p), значит, наклон логита 1/(p(1 − p)): в p = 0.5 он равен 4, в p = 0.9 — 11.1, в p = 0.99 — 101. Логит очень крут у краёв: маленькое изменение уверенной вероятности — огромное изменение логита F. Поэтому бустинг для классификации работает в логитах.',
      };
      note.innerHTML = 'Формула: <b>(f⁻¹)′(y) = 1 / f′(x)</b>, где y = f(x). ' + msgs[s.c];
    }
    w.pythonAction(() => {
      const E = INV[s.c];
      const pyf = { sq: ['x**2', '2 * x', 'np.sqrt(y)'], exp: ['np.exp(x)', 'np.exp(x)', 'np.log(y)'], cube: ['x**3', '3 * x**2', 'np.cbrt(y)'], sigm: ['1 / (1 + np.exp(-x))', 'np.exp(-x) / (1 + np.exp(-x))**2', 'np.log(y / (1 - y))'] }[s.c];
      return 'import numpy as np\n\nf = lambda x: ' + pyf[0] + '\ndf = lambda x: ' + pyf[1] + '\ninv = lambda y: ' + pyf[2] + '     # обратная функция\na = ' + U.pyNum(s.a) + '\ny = f(a)\neps = 1e-6\nprint("1 / f\'(a)        =", 1 / df(a))\nprint("наклон обратной  =", (inv(y + eps) - inv(y - eps)) / (2 * eps))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 22. Ошибка численной производной: усечение против округления
   * ============================================================================== */
  const NUM = {
    sin1: { label: 'sin x в точке 1', f: Math.sin, d: Math.cos(1), a: 1, d2: Math.sin(1), d3: Math.cos(1), py: 'np.sin', dpy: 'np.cos(1.0)' },
    exp0: { label: 'eˣ в точке 0', f: Math.exp, d: 1, a: 0, d2: 1, d3: 1, py: 'np.exp', dpy: '1.0' },
    cube1: { label: 'x³ в точке 1', f: (x) => x ** 3, d: 3, a: 1, d2: 6, d3: 6, py: 'lambda x: x**3', dpy: '3.0' },
    sig: { label: 'σ(x) в точке 0.5', f: sigma, d: sigma(0.5) * (1 - sigma(0.5)), a: 0.5, d2: Math.abs(sigma(0.5) * (1 - sigma(0.5)) * (1 - 2 * sigma(0.5))), d3: 0.2, py: 'lambda x: 1 / (1 + np.exp(-x))', dpy: '0.2350037122015945' },
  };
  GBC.widget('numeric-error', (el) => {
    const s = { c: 'sin1', h: 1e-5, m: { fwd: true, bwd: false, cen: true, rich: false } };
    const w = ui.shell(el, { title: 'Ошибка численной производной', sub: 'Ось x — шаг h от 10⁻¹⁵ до 1, ось y — модуль ошибки; обе логарифмические. Справа ошибка усечения (formula error): ~h у односторонних разностей, ~h² у центральной. Слева ошибка округления: ~10⁻¹⁶/h. Минимум — где они встречаются.' });
    ui.select(w.controls, { label: 'Функция', value: s.c, options: Object.entries(NUM).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.c = v), draw()) });
    ui.slider(w.controls, { label: 'Шаг h', min: 1e-15, max: 1, log: true, value: s.h, format: powFmt, onInput: (v) => ((s.h = v), draw()) });
    [['fwd', 'вперёд (f(a + h) − f(a))/h'], ['bwd', 'назад (f(a) − f(a − h))/h'], ['cen', 'центральная'], ['rich', 'Ричардсон (4D(h/2) − D(h))/3']].forEach(([k, lab]) => ui.toggle(w.controls, { label: lab, checked: s.m[k], onChange: (v) => ((s.m[k] = v), draw()) }));
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'шаг h', type: 'log', domain: [1e-15, 1], ticks: decadeTicks(-15, 0, 3), format: powFmt }, y: { label: '|ошибка|', type: 'log', domain: [1e-16, 1], ticks: decadeTicks(-16, 0, 4), format: powFmt } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const METH = {
      fwd: { f: (E, h) => (E.f(E.a + h) - E.f(E.a)) / h, color: 'aqua', name: 'вперёд' },
      bwd: { f: (E, h) => (E.f(E.a) - E.f(E.a - h)) / h, color: 'blue', name: 'назад' },
      cen: { f: (E, h) => (E.f(E.a + h) - E.f(E.a - h)) / (2 * h), color: 'violet', name: 'центральная' },
      rich: { f: (E, h) => { const D = (t) => (E.f(E.a + t) - E.f(E.a - t)) / (2 * t); return (4 * D(h / 2) - D(h)) / 3; }, color: 'green', name: 'Ричардсон' },
    };
    function draw() {
      const E = NUM[s.c];
      const hs = logspace(-15, 0, 301);
      const keep = (v) => (Number.isFinite(v) && v > 1e-16 ? Math.min(v, 1) : NaN);
      const layers = [
        { type: 'line', x: hs, y: hs.map((h) => keep(1.1e-16 / h)), color: 'ink2', width: 1, dash: '2 3', label: 'округление ~10⁻¹⁶/h', hover: false },
        { type: 'line', x: hs, y: hs.map((h) => keep((Math.abs(E.d2) / 2) * h)), color: 'ink2', width: 1, dash: '6 3', label: 'усечение ~h', hover: false },
        { type: 'line', x: hs, y: hs.map((h) => keep((Math.abs(E.d3) / 6) * h * h)), color: 'ink2', width: 1, dash: '1 2', label: 'усечение ~h²', hover: false },
      ];
      const rows = [];
      for (const [k, M] of Object.entries(METH)) {
        if (!s.m[k]) continue;
        const errs = hs.map((h) => Math.abs(M.f(E, h) - E.d));
        layers.push({ type: 'line', x: hs, y: errs.map(keep), color: M.color, width: 2.2, label: M.name, hover: false });
        const e = Math.abs(M.f(E, s.h) - E.d);
        layers.push({ type: 'points', x: [s.h], y: [keep(e) || 1e-16], color: M.color, r: 5.5, hollow: !(e > 1e-16) });
        // оптимум по сглаженной ошибке: одиночные «удачные» h — шум округления
        const lg = errs.map((v) => Math.log10(Math.max(v, 1e-17)));
        const W = 10;
        let bi = W;
        let bs = Infinity;
        for (let i = W; i < lg.length - W; i++) {
          let m = 0;
          for (let j = i - W; j <= i + W; j++) m += lg[j];
          m /= 2 * W + 1;
          if (m < bs) (bs = m), (bi = i);
        }
        rows.push([M.name, U.fmt(M.f(E, s.h), 9), U.fmt(e, 2), powFmt(Math.pow(10, Math.round(Math.log10(hs[bi])))), '~' + powFmt(Math.pow(10, Math.round(bs)))]);
      }
      layers.push({ type: 'vline', x: s.h, color: 'tree', width: 1.2, dash: '3 3' });
      plot.render(layers);
      rowTable(tbl, ['метод', 'оценка', 'ошибка', 'лучший h', 'ошибка там'], rows);
      note.innerHTML = 'Точная производная: ' + U.fmt(E.d, 12) + '. Уменьшая h, сначала выигрываем (формула точнее), потом проигрываем: f(a + h) и f(a) совпадают почти во всех 16 значащих цифрах, и разность теряет точность. Для «вперёд» оптимум около h ≈ 10⁻⁸ (ошибка ~10⁻⁸ … 10⁻⁹), для центральной — около h ≈ 10⁻⁵ … 10⁻⁶ (ошибка ~10⁻¹¹ … 10⁻¹²). Ричардсон гасит и член ~h² — его оптимум ещё правее, при h ~ 10⁻³.' + (s.c === 'cube1' ? ' У x³ центральная разность равна 3a² + h² точно — линия ошибки ровно h².' : '');
    }
    w.pythonAction(() => {
      const E = NUM[s.c];
      return 'import numpy as np\n\nf = ' + E.py + '\na, exact = ' + E.a + ', ' + E.dpy + '\nprint("    h      вперёд     центральная   Ричардсон")\nfor k in range(1, 16):\n    h = 10.0 ** -k\n    fwd = (f(a + h) - f(a)) / h\n    D = lambda t: (f(a + t) - f(a - t)) / (2 * t)\n    rich = (4 * D(h / 2) - D(h)) / 3\n    print(f"1e-{k:02d}  {abs(fwd - exact):.1e}    {abs(D(h) - exact):.1e}      {abs(rich - exact):.1e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 23. Производная по шумным данным
   * ============================================================================== */
  GBC.widget('noisy-derivative', (el) => {
    const SIG = [0, 1e-4, 1e-3, 1e-2, 0.05];
    const KS = [1, 2, 5, 10, 20, 40, 80];
    const DX = 0.01;
    const N = 629;
    const s = { sig: 1e-3, k: 1 };
    const w = ui.shell(el, { title: 'Производная по измерениям с шумом', sub: 'Данные — sin x, измеренный с шагом 0.01 и шумом σ (генератор Mulberry32, seed 7). Производную оцениваем центральной разностью через k точек: (y[i + k] − y[i − k]) / (2h), h = 0.01·k. Маленький h усиливает шум, большой — размывает форму.' });
    ui.slider(w.controls, { label: 'Шум σ', values: SIG, value: s.sig, format: (v) => (v === 0 ? '0' : powFmt(v)), onInput: (v) => ((s.sig = v), draw()) });
    ui.slider(w.controls, { label: 'Шаг разности h', values: KS, value: s.k, format: (v) => U.fmt(v * DX, 2), onInput: (v) => ((s.k = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 190, x: { label: 'x', domain: [0, 6.3] }, y: { label: 'измерения y' } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'x', domain: [0, 6.3] }, y: { label: 'оценка y′', domain: [-2.5, 2.5] } });
    const p3 = new GBC.Plot(w.main, { height: 200, x: { label: 'h (лог. шкала)', type: 'log', domain: [0.01, 0.8], ticks: [0.01, 0.1, 0.5], format: powFmt }, y: { label: 'RMSE оценки (лог.)', type: 'log', format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'h', label: 'h' }, { key: 'rmse', label: 'RMSE оценки' }, { key: 'best', label: 'лучший h' }, { key: 'theory', label: 'шум·1/(√2·h) + h²/6' }]);
    const xs = U.range(N).map((i) => i * DX);
    const noise = (() => {
      const rng = new GBC.RNG(7);
      return xs.map(() => rng.normal());
    })();
    function estimate(sig, k) {
      const y = xs.map((x, i) => Math.sin(x) + sig * noise[i]);
      const ex = [];
      const ey = [];
      for (let i = k; i < N - k; i++) {
        ex.push(xs[i]);
        ey.push((y[i + k] - y[i - k]) / (2 * k * DX));
      }
      const rmse = Math.sqrt(U.mean(ey.map((v, j) => (v - Math.cos(ex[j])) ** 2)));
      return { y, ex, ey, rmse };
    }
    function draw() {
      const r = estimate(s.sig, s.k);
      p1.render([
        { type: 'line', x: xs, y: xs.map(Math.sin), color: 'truth', width: 1.5, dash: '5 4', label: 'sin x', hover: false },
        { type: 'points', x: xs.filter((_, i) => i % 3 === 0), y: r.y.filter((_, i) => i % 3 === 0), color: 'data', r: 1.6, label: 'измерения' },
      ]);
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: r.ex, y: r.ey.map((v) => U.clamp(v, -2.5, 2.5)), color: 'tree', width: 1.4, label: 'оценка', hover: false },
        { type: 'line', x: xs, y: xs.map(Math.cos), color: 'truth', width: 1.8, dash: '5 4', label: 'cos x (истина)', hover: false },
      ]);
      const curveR = KS.map((k) => estimate(s.sig, k).rmse);
      const hs = KS.map((k) => k * DX);
      const fine = logspace(-2, Math.log10(0.8), 60);
      const th = (h) => (s.sig > 0 ? s.sig / (Math.SQRT2 * h) : 0) + (h * h) / (6 * Math.SQRT2);
      const all = curveR.concat(fine.map(th)).filter((v) => v > 0);
      const [lo, hi] = U.extent(all);
      const p0 = Math.floor(Math.log10(lo));
      const pe = Math.ceil(Math.log10(hi));
      p3.opts.y.ticks = decadeTicks(p0, pe, Math.max(1, Math.ceil((pe - p0) / 5)));
      p3.render([
        { type: 'line', x: fine, y: fine.map(th), color: 'ink2', width: 1.2, dash: '3 3', label: 'теория', hover: false },
        { type: 'line', x: hs, y: curveR, color: 'model', width: 2.2, label: 'RMSE', hover: false },
        { type: 'points', x: hs, y: curveR, color: (i) => (KS[i] === s.k ? 'tree' : 'model'), r: (i) => (KS[i] === s.k ? 6.5 : 4) },
      ], { y: [Math.pow(10, p0), Math.pow(10, pe)] });
      let bi = 0;
      curveR.forEach((v, i) => { if (v < curveR[bi]) bi = i; });
      st.set('h', U.fmt(s.k * DX, 2));
      st.set('rmse', U.fmt(r.rmse, 3));
      st.set('best', U.fmt(hs[bi], 2));
      st.set('theory', U.fmt(th(s.k * DX), 3));
      note.innerHTML = s.sig === 0
        ? 'Без шума работает только ошибка усечения ≈ h²/6·|cos|: чем меньше h, тем лучше.'
        : 'Шум σ в каждом измерении превращается в ошибку производной порядка σ/(√2·h): при σ = ' + powFmt(s.sig) + ' и h = 0.01 это ' + U.fmt(s.sig / (Math.SQRT2 * 0.01), 3) + '. Ошибка усечения, наоборот, растёт как h². Лучший шаг здесь — h ≈ ' + U.fmt(hs[bi], 2) + ': <b>по шумным данным производную берут с большим шагом или после сглаживания</b>. Та же логика у кривых обучения бустинга: «наклон» валидационных потерь между соседними деревьями тонет в шуме.';
    }
    w.pythonAction(() => 'import numpy as np\nimport sys, pathlib\nROOT = next(p for p in [pathlib.Path.cwd(), *pathlib.Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())\nsys.path.insert(0, str(ROOT / "shared" / "python"))\nfrom gbcourse.rng import Mulberry32\n\nrng = Mulberry32(7)\nx = np.arange(629) * 0.01\nnoise = np.array([rng.normal() for _ in x])\nsig = ' + U.pyNum(s.sig) + '\ny = np.sin(x) + sig * noise\nfor k in [1, 2, 5, 10, 20, 40, 80]:\n    est = (y[2 * k:] - y[:-2 * k]) / (2 * k * 0.01)\n    rmse = np.sqrt(np.mean((est - np.cos(x[k:-k])) ** 2))\n    print(f"h = {k * 0.01:.2f}: RMSE = {rmse:.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * 24. Темп градиентного спуска на параболе
   * ============================================================================== */
  GBC.widget('gd-eta', (el) => {
    const s = { a: 2, eta: 0.3, k: 0 };
    const NK = 25;
    const w = ui.shell(el, { title: 'Темп η: спуск, зигзаг или разлёт', sub: 'f(θ) = (a/2)·θ², f′(θ) = a·θ. Шаг θ ← θ − η·aθ = (1 − ηa)·θ умножает расстояние до минимума на q = 1 − ηa. Нажмите ▶ и подберите η: от медленного спуска через зигзаг к разлёту при η > 2/a.' });
    ui.slider(w.controls, { label: 'Кривизна a', min: 0.5, max: 4, step: 0.1, value: s.a, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'Темп η', min: 0.05, max: 1.3, step: 0.01, value: s.eta, onInput: (v) => ((s.eta = v), draw()) });
    ui.player(w.controls, { label: 'Шаги', min: 0, max: NK, value: 0, fps: 3, format: (k) => 'шаг ' + k, onChange: (k) => ((s.k = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'θ', domain: [-3, 3] }, y: { label: 'f(θ)' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'номер шага k', domain: [0, NK] }, y: { label: '|θ_k| (лог.)', type: 'log', domain: [1e-8, 1e3], ticks: decadeTicks(-8, 3, 2), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'q', label: 'множитель q = 1 − ηa' }, { key: 'lim', label: 'граница 2/a' }, { key: 't', label: 'θ_k' }, { key: 'f', label: 'f(θ_k)' }]);
    function draw() {
      const { a, eta } = s;
      const q = 1 - eta * a;
      const th = [2];
      for (let k = 0; k < NK; k++) th.push(th[k] * q);
      const f = (t) => (a / 2) * t * t;
      const xs = U.linspace(-3, 3, 301);
      const path = th.slice(0, s.k + 1);
      const vis = path.map((t) => U.clamp(t, -3.2, 3.2));
      p1.render([
        { type: 'line', x: xs, y: xs.map(f), color: 'model', width: 2.2, hover: false },
        { type: 'arrows', x1: vis.slice(0, -1), y1: vis.slice(0, -1).map(f), x2: vis.slice(1), y2: vis.slice(1).map(f), color: 'tree', width: 1.6, opacity: 0.85 },
        { type: 'points', x: vis, y: vis.map(f), color: (i) => (i === vis.length - 1 ? 'tree' : 'ink2'), r: (i) => (i === vis.length - 1 ? 6 : 3.5) },
      ], { y: [-0.3, Math.max(4.5 * a, 1)] });
      const ks = U.range(NK + 1);
      const abs = th.map((t) => Math.abs(t));
      const kk = (v) => (v > 1e-8 && v < 1e3 ? v : NaN);
      p2.render([
        { type: 'line', x: ks, y: abs.map(kk), color: 'model', width: 2, hover: false },
        { type: 'points', x: ks.slice(0, s.k + 1), y: abs.slice(0, s.k + 1).map(kk), color: 'tree', r: 4 },
        { type: 'hline', y: 2, color: 'ink2', dash: '3 3', width: 1, text: 'старт |θ₀| = 2' },
      ]);
      st.set('q', U.fmt(q, 3));
      st.set('lim', U.fmt(2 / a, 3));
      st.set('t', U.fmt(th[s.k], 4));
      st.set('f', U.fmt(f(th[s.k]), 4));
      let msg;
      if (Math.abs(q) < 0.02) msg = '<b>q ≈ 0: один шаг — и мы в минимуме.</b> Это η = 1/a: шаг Ньютона, который знает кривизну (урок 15.7, XGBoost).';
      else if (q > 0) msg = '<b>0 &lt; q &lt; 1 — монотонный спуск:</b> каждый шаг сохраняет знак θ и сокращает расстояние в ' + U.fmt(1 / q, 3) + ' раза. На нижнем графике — прямая: геометрическая прогрессия (урок 15.3). ' + (q > 0.8 ? 'Но шагов нужно много: η слишком мал.' : '');
      else if (q > -1) msg = '<b>−1 &lt; q &lt; 0 — зигзаг:</b> шаг перепрыгивает минимум, но каждый раз ближе. Сходится, хотя и «качается».';
      else if (Math.abs(q + 1) < 0.02) msg = '<b>q = −1 — вечные качели:</b> θ прыгает между 2 и −2. Это граница η = 2/a.';
      else msg = '<b>q &lt; −1 — разлёт:</b> η > 2/a = ' + U.fmt(2 / a, 3) + ', каждый шаг уносит дальше. Слишком большой темп обучения ломает спуск — то же бывает и в бустинге с ν > 1 на крутых потерях.';
      note.innerHTML = msg + ' Важно: допустимый темп зависит от кривизны a — чем круче чаша, тем меньше должен быть η.';
    }
    w.pythonAction(() => 'a, eta = ' + U.pyNum(s.a) + ', ' + U.pyNum(s.eta) + '\ndf = lambda t: a * t            # производная (a/2)·θ²\nt = 2.0\nfor k in range(1, 11):\n    t = t - eta * df(t)\n    print(f"шаг {k:2d}: θ = {t: .6f}")\nprint("множитель q = 1 − ηa =", 1 - eta * a, "; сходимость при η < 2/a =", 2 / a)\n');
    draw();
  });

  /* ==============================================================================
   * 25. Производные функций потерь по прогнозу: псевдо-остатки
   * ============================================================================== */
  const LOSSES = {
    mse: { label: 'квадратичные ½(y − F)²', L: (y, F) => 0.5 * (y - F) ** 2, g: (y, F) => -(y - F), form: '−∂L/∂F = y − F — обычный остаток', py: ['0.5 * (y - F)**2', '-(y - F)'] },
    mae: { label: 'абсолютные |y − F|', L: (y, F) => Math.abs(y - F), g: (y, F) => (y === F ? NaN : -Math.sign(y - F)), form: '−∂L/∂F = sign(y − F) — только знак остатка', py: ['np.abs(y - F)', '-np.sign(y - F)'] },
    huber: { label: 'Хьюбер с порогом δ', L: (y, F, p) => (Math.abs(y - F) <= p ? 0.5 * (y - F) ** 2 : p * (Math.abs(y - F) - 0.5 * p)), g: (y, F, p) => -U.clamp(y - F, -p, p), form: '−∂L/∂F = clip(y − F, −δ, δ) — остаток, обрезанный порогом', py: ['np.where(np.abs(y - F) <= d, 0.5 * (y - F)**2, d * (np.abs(y - F) - 0.5 * d))', '-np.clip(y - F, -d, d)'] },
    quant: { label: 'квантильные (pinball) с уровнем α', L: (y, F, p) => (y >= F ? p * (y - F) : (p - 1) * (y - F)), g: (y, F, p) => (y === F ? NaN : y > F ? -p : 1 - p), form: '−∂L/∂F = α при y > F и α − 1 при y < F', py: ['np.where(y >= F, d * (y - F), (d - 1) * (y - F))', 'np.where(y > F, -d, 1 - d)'] },
    log: { label: 'log-loss, F — логит', L: (y, F) => Math.log1p(Math.exp(-Math.abs(F))) + Math.max(F, 0) - y * F, g: (y, F) => sigma(F) - y, form: '−∂L/∂F = y − σ(F) = y − p', py: ['np.logaddexp(0, F) - y * F', '1 / (1 + np.exp(-F)) - y'] },
  };
  GBC.widget('loss-derivatives', (el) => {
    const s = { l: 'mse', y: 5, F: 2, p: 1, cls: 1 };
    const w = ui.shell(el, { title: 'Производная потерь по прогнозу', sub: 'Сверху — потери L(y, F) одного объекта как функция прогноза F при известном ответе y, с касательной. Снизу — минус производная −∂L/∂F, псевдо-остаток (pseudo-residual): именно его будет предсказывать следующее дерево бустинга. Тяните прогноз F.' });
    ui.select(w.controls, { label: 'Потери', value: s.l, options: Object.entries(LOSSES).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.l = v;
      ySl.el.hidden = v === 'log';
      cSeg.el.hidden = v !== 'log';
      pSl.el.hidden = !(v === 'huber' || v === 'quant');
      if (v === 'quant') (s.p = 0.8), pSl.set(0.8);
      if (v === 'huber') (s.p = 1), pSl.set(1);
      if (v === 'log') s.F = -1;
      else if (s.F < -1) s.F = 2;
      draw();
    } });
    const ySl = ui.slider(w.controls, { label: 'Ответ y', min: -2, max: 8, step: 0.5, value: s.y, onInput: (v) => ((s.y = v), draw()) });
    const cSeg = ui.segmented(w.controls, { label: 'Класс y', value: 1, options: [{ value: 0, label: 'y = 0' }, { value: 1, label: 'y = 1' }], onChange: (v) => ((s.cls = v), draw()) });
    cSeg.el.hidden = true;
    const pSl = ui.slider(w.controls, { label: 'Параметр δ или α', min: 0.1, max: 3, step: 0.05, value: s.p, onInput: (v) => ((s.p = s.l === 'quant' ? U.clamp(v, 0.05, 0.95) : v), draw()) });
    pSl.el.hidden = true;
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'прогноз F' }, y: { label: 'потери L(y, F)' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'прогноз F' }, y: { label: 'псевдо-остаток −∂L/∂F' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'L' }, { key: 'g', label: '∂L/∂F' }, { key: 'r', label: '−∂L/∂F' }, { key: 'dir', label: 'куда сдвинуть F' }]);
    function draw() {
      const E = LOSSES[s.l];
      const y = s.l === 'log' ? s.cls : s.y;
      const dom = s.l === 'log' ? [-6, 6] : [y - 6, y + 6];
      const F = U.clamp(s.F, dom[0], dom[1]);
      const Lf = (t) => E.L(y, t, s.p);
      const gf = (t) => E.g(y, t, s.p);
      const xs = U.linspace(dom[0], dom[1], 601);
      const g = gf(F);
      const gs = Number.isFinite(g) ? g : 0;
      p1.render([
        { type: 'line', x: xs, y: xs.map(Lf), color: 'model', width: 2.2, hover: false },
        s.l !== 'log' ? { type: 'vline', x: y, color: 'ink2', dash: '3 3', width: 1, text: 'y = ' + U.fmt(y, 2) } : null,
        { type: 'segments', x1: [F - 1.5], y1: [Lf(F) - 1.5 * gs], x2: [F + 1.5], y2: [Lf(F) + 1.5 * gs], color: 'tree', width: 2.5, opacity: 1 },
        { type: 'vline', x: F, color: 'tree', width: 1, opacity: 0.4, draggable: true, onDrag: (v) => ((s.F = Math.round(v * 20) / 20), draw()) },
        { type: 'points', x: [F], y: [Lf(F)], color: 'tree', r: 6 },
      ], { x: dom, y: yRange(Lf, xs, 0.08) });
      const rc = curve((t) => -gf(t), dom[0], dom[1], 0, { xs, jump: 0.3 });
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1.2 },
        { type: 'line', x: rc.x, y: rc.y, color: 'tree', width: 2.2, hover: false },
        Number.isFinite(g) ? { type: 'points', x: [F], y: [-g], color: 'tree', r: 6 } : null,
        { type: 'vline', x: F, color: 'tree', width: 1, dash: '3 3' },
      ], { x: dom });
      st.set('L', U.fmt(Lf(F), 4));
      st.set('g', Number.isFinite(g) ? U.fmt(g, 4) : 'нет (излом)');
      st.set('r', Number.isFinite(g) ? U.fmt(-g, 4) : '—');
      st.set('dir', !Number.isFinite(g) || Math.abs(g) < 1e-9 ? 'никуда' : g < 0 ? 'вверх →' : '← вниз');
      const extra = {
        mse: 'Чем дальше прогноз от ответа, тем сильнее тянет: остаток 3 даёт силу 3. Выброс с остатком 100 тянет в 100 раз сильнее.',
        mae: 'Сила тяги всегда ±1, сколь бы далеко ни был ответ: выбросы не перетягивают модель. В F = y производной нет (излом).',
        huber: 'Пока |y − F| ≤ δ — как MSE, дальше сила ограничена δ, как у MAE. Порог δ задаёт, кого считать выбросом.',
        quant: 'Недопрогноз «штрафуется» с весом α, перепрогноз — с весом 1 − α. При α = 0.8 тянет вверх в 4 раза сильнее, чем вниз: модель учится 80-му процентилю.',
        log: 'Прогноз F — логит, p = σ(F) — вероятность класса 1. Псевдо-остаток y − p: «насколько не дотянули до ответа». Он не больше 1 по модулю, даже если модель уверенно ошибается.',
      };
      note.innerHTML = '<b>' + E.form + '.</b> ' + extra[s.l];
    }
    w.pythonAction(() => {
      const E = LOSSES[s.l];
      const y = s.l === 'log' ? s.cls : s.y;
      return 'import numpy as np\n\ny, d = ' + U.pyNum(y) + ', ' + U.pyNum(s.p) + '   # d — порог δ или уровень α\nL = lambda F: ' + E.py[0] + '\ndL = lambda F: ' + E.py[1] + '\nF = ' + U.pyNum(s.F) + '\neps = 1e-6\nprint("∂L/∂F по формуле:", dL(F))\nprint("∂L/∂F численно:   ", (L(F + eps) - L(F - eps)) / (2 * eps))\nprint("псевдо-остаток:   ", -dL(F))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 26. Наклон потерь на шести квартирах: лучшая константа
   * ============================================================================== */
  GBC.widget('loss-slope', (el) => {
    const toy = GBC.datasets.toyRegression();
    const x = toy.x;
    const y = toy.y;
    const n = y.length;
    const s = { c: 3, loss: 'mse', eta: 0.5 };
    const LOSS = {
      mse: { f: (c) => U.mean(y.map((v) => 0.5 * (v - c) * (v - c))), df: (c) => U.mean(y.map((v) => c - v)), name: '½·среднее (y − c)²' },
      mae: { f: (c) => U.mean(y.map((v) => Math.abs(v - c))), df: (c) => U.mean(y.map((v) => Math.sign(c - v))), name: 'среднее |y − c|' },
      huber: { f: (c) => U.mean(y.map((v) => (Math.abs(v - c) <= 2 ? 0.5 * (v - c) ** 2 : 2 * (Math.abs(v - c) - 1)))), df: (c) => U.mean(y.map((v) => -U.clamp(v - c, -2, 2))), name: 'Хьюбер, δ = 2' },
    };
    const w = ui.shell(el, { title: 'Наклон функции потерь по общему прогнозу', sub: 'Шесть квартир и один общий прогноз c (тяните линию). Снизу — потери L(c) и касательная. Наклон L′(c) — среднее производных по квартирам; кнопка делает шаг спуска c ← c − η·L′(c).' });
    ui.segmented(w.controls, { label: 'Потери', value: s.loss, options: [{ value: 'mse', label: 'MSE' }, { value: 'mae', label: 'MAE' }, { value: 'huber', label: 'Хьюбер δ = 2' }], onChange: (v) => ((s.loss = v), draw()) });
    ui.slider(w.controls, { label: 'Шаг спуска η', min: 0.1, max: 2, step: 0.1, value: s.eta, onInput: (v) => ((s.eta = v), draw()) });
    ui.button(w.controls, { label: 'Шаг: c ← c − η·L′(c)', kind: 'primary', onClick: () => ((s.c = U.clamp(s.c - s.eta * LOSS[s.loss].df(s.c), 0, 12)), draw()) });
    ui.button(w.controls, { label: 'Вернуть c = 3', onClick: () => ((s.c = 3), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'номер квартиры', domain: [0.5, 6.5] }, y: { label: 'цена y, млн', domain: [0, 12] } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'прогноз c', domain: [0, 12] }, y: { label: 'потери L(c)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'прогноз c' }, { key: 'L', label: 'L(c)' }, { key: 'd', label: 'наклон L′(c)' }, { key: 'r', label: 'средний остаток' }]);
    function draw() {
      const L = LOSS[s.loss];
      const c = s.c;
      const d = L.df(c);
      const res = y.map((v) => v - c);
      p1.render([
        { type: 'segments', x1: x, y1: x.map(() => c), x2: x, y2: y, color: 'residual', width: 2, opacity: 0.9 },
        { type: 'hline', y: c, color: 'model', width: 2.2, draggable: true, text: 'c = ' + U.fmt(c, 2), onDrag: (v) => ((s.c = Math.round(U.clamp(v, 0, 12) * 20) / 20), draw()) },
        { type: 'points', x, y, color: 'data', r: 5, label: 'квартиры', tooltip: (i) => [['y', U.fmt(y[i], 2)], ['остаток y − c', U.fmt(res[i], 2)]] },
      ]);
      const cs = U.linspace(0, 12, 241);
      p2.render([
        { type: 'line', x: cs, y: cs.map(L.f), color: 'model', width: 2.2, label: 'L(c) = ' + L.name },
        { type: 'segments', x1: [c - 2], y1: [L.f(c) - 2 * d], x2: [c + 2], y2: [L.f(c) + 2 * d], color: 'tree', width: 2.5, opacity: 1 },
        { type: 'points', x: [c], y: [L.f(c)], color: 'tree', r: 6, label: 'текущий прогноз', tooltip: () => [['c', U.fmt(c, 3)], ['L′(c)', U.fmt(d, 3)]] },
      ]);
      st.set('c', U.fmt(c, 3));
      st.set('L', U.fmt(L.f(c), 3));
      st.set('d', U.fmt(d, 3));
      st.set('r', U.fmt(U.mean(res), 3));
      const above = y.filter((v) => v > c).length;
      const below = y.filter((v) => v < c).length;
      if (s.loss === 'mse') note.innerHTML = 'L′(c) = c − ȳ = −(средний остаток) = ' + U.fmt(d, 3) + '. ' + (Math.abs(d) < 1e-9 ? '<b>Ноль при c = 6 — среднем.</b> Лучшая константа под MSE найдена.' : d < 0 ? 'Наклон отрицательный: прогноз занижен, двигаем c <b>вверх</b>.' : 'Наклон положительный: прогноз завышен, двигаем c <b>вниз</b>.') + ' При η = 1 один шаг сразу приводит в c = 6.';
      else if (s.loss === 'mae') note.innerHTML = 'Каждая квартира тянет с силой ±1: L′(c) = (ниже − выше)/n = (' + below + ' − ' + above + ')/' + n + ' = ' + U.fmt(d, 3) + '. ' + (Math.abs(d) < 1e-9 ? '<b>Наклон 0 — «полочка»</b>: любое c между медианными точками 4 и 7 одинаково хорошо.' : 'Величина остатков не важна, только их знак — поэтому MAE устойчива к выбросам. Но спуск с постоянным η «прыгает»: наклон не уменьшается у дна.');
      else note.innerHTML = 'Тяга каждой квартиры — остаток, обрезанный до ±2: L′(c) = −среднее clip(y − c, −2, 2) = ' + U.fmt(d, 3) + '. ' + (Math.abs(d) < 1e-3 ? '<b>Ноль при c = 5.5</b> — между средним (6) и медианой: дальние квартиры 2 и 11 тянут не сильнее остальных.' : 'Лучшая константа — 5.5: там наклон обращается в ноль.');
    }
    w.pythonAction(() => {
      const L = { mse: ['np.mean(0.5 * (y - c) ** 2)', 'np.mean(c - y)'], mae: ['np.mean(np.abs(y - c))', 'np.mean(np.sign(c - y))'], huber: ['np.mean(np.where(np.abs(y - c) <= 2, 0.5 * (y - c)**2, 2 * (np.abs(y - c) - 1)))', '-np.mean(np.clip(y - c, -2, 2))'] }[s.loss];
      return 'import numpy as np\n\ny = np.array([2, 4, 3, 7, 9, 11], dtype=float)\nc, eta = ' + U.pyNum(s.c) + ', ' + U.pyNum(s.eta) + '\nL = lambda c: ' + L[0] + '\ndL = lambda c: ' + L[1] + '\nfor k in range(8):\n    print(f"шаг {k}: c = {c:.4f}, L = {L(c):.4f}, L\'(c) = {dL(c): .4f}")\n    c = c - eta * dL(c)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 27. Псевдо-остатки и пень: шаг бустинга
   * ============================================================================== */
  GBC.widget('pseudo-residuals', (el) => {
    const toy = GBC.datasets.toyRegression();
    const X = toy.X;
    const x = toy.x;
    const y = toy.y;
    const s = { loss: 'mse', nu: 0.5, m: 0 };
    const NM = 20;
    const LS = {
      mse: { r: (yi, F) => yi - F, L: (yi, F) => 0.5 * (yi - F) ** 2, F0: 6, name: 'MSE' },
      mae: { r: (yi, F) => Math.sign(yi - F), L: (yi, F) => Math.abs(yi - F), F0: 5.5, name: 'MAE' },
      huber: { r: (yi, F) => U.clamp(yi - F, -2, 2), L: (yi, F) => (Math.abs(yi - F) <= 2 ? 0.5 * (yi - F) ** 2 : 2 * (Math.abs(yi - F) - 1)), F0: 5.5, name: 'Хьюбер δ = 2' },
    };
    const w = ui.shell(el, { title: 'Псевдо-остатки → пень → шаг бустинга', sub: 'Старт — лучшая константа F₀. На каждом шаге: 1) псевдо-остатки rᵢ = −∂L/∂Fᵢ для каждой квартиры; 2) пень (дерево глубины 1) учится их предсказывать; 3) F ← F + ν·пень. Упрощение: лист = среднее псевдо-остатков, без уточнения значений листьев (урок 5.1).' });
    ui.segmented(w.controls, { label: 'Потери', value: s.loss, options: [{ value: 'mse', label: 'MSE' }, { value: 'mae', label: 'MAE' }, { value: 'huber', label: 'Хьюбер δ = 2' }], onChange: (v) => ((s.loss = v), draw()) });
    ui.slider(w.controls, { label: 'Темп ν', min: 0.1, max: 1, step: 0.05, value: s.nu, onInput: (v) => ((s.nu = v), draw()) });
    ui.player(w.controls, { label: 'Деревья', min: 0, max: NM, value: 0, fps: 2, format: (m) => 'm = ' + m, onChange: (m) => ((s.m = m), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'номер квартиры', domain: [0.5, 6.5] }, y: { label: 'цена, млн', domain: [0, 12.5] } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'номер квартиры', domain: [0.5, 6.5] }, y: { label: 'псевдо-остаток r' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'деревьев' }, { key: 'L', label: 'средние потери' }, { key: 'split', label: 'порог пня' }, { key: 'leaf', label: 'листья пня' }]);
    function run(L, nu, M) {
      let F = y.map(() => L.F0);
      const hist = [];
      for (let m = 0; m <= M; m++) {
        const r = y.map((yi, i) => L.r(yi, F[i]));
        const tree = new GBC.RegressionTree({ maxDepth: 1 }).fit(X, r.map((v) => -v));
        const pred = tree.predict(X);
        hist.push({ F: F.slice(), r, pred, tree, loss: U.mean(y.map((yi, i) => L.L(yi, F[i]))) });
        F = F.map((f, i) => f + nu * pred[i]);
      }
      return hist;
    }
    function draw() {
      const L = LS[s.loss];
      const hist = run(L, s.nu, s.m);
      const cur = hist[s.m];
      const F = cur.F;
      const Fn = F.map((f, i) => f + s.nu * cur.pred[i]);
      p1.render([
        { type: 'segments', x1: x.map((v) => v - 0.4), y1: F, x2: x.map((v) => v + 0.4), y2: F, color: 'model', width: 3, opacity: 1 },
        { type: 'segments', x1: x.map((v) => v - 0.4), y1: Fn, x2: x.map((v) => v + 0.4), y2: Fn, color: 'model-prev', width: 2, opacity: 1, dash: '4 3' },
        { type: 'arrows', x1: x, y1: F, x2: x, y2: Fn, color: 'tree', width: 1.8 },
        { type: 'points', x, y, color: 'data', r: 5.5, label: 'цены' },
        { type: 'line', x: [-1], y: [-1], color: 'model', width: 3, label: 'F_m (сейчас)' },
        { type: 'line', x: [-1], y: [-1], color: 'model-prev', width: 2, dash: '4 3', label: 'F_m + ν·пень' },
      ]);
      const [lo, hi] = U.extent(cur.r.concat(cur.pred, [0]));
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1.2 },
        { type: 'bars', x, y: cur.r, color: (i) => (cur.r[i] >= 0 ? 'pos' : 'neg'), legendColor: 'pos', width: 0.55, maxPx: 40, label: 'псевдо-остатки' },
        { type: 'segments', x1: x.map((v) => v - 0.45), y1: cur.pred, x2: x.map((v) => v + 0.45), y2: cur.pred, color: 'tree', width: 3, opacity: 1 },
        { type: 'line', x: [-1], y: [-1], color: 'tree', width: 3, label: 'прогноз пня' },
      ], { y: [lo - 0.2 * (hi - lo + 0.5), hi + 0.2 * (hi - lo + 0.5)] });
      const t = cur.tree.nodes[0];
      st.set('m', String(s.m));
      st.set('L', U.fmt(cur.loss, 4));
      st.set('split', t && t.feature !== undefined && t.feature !== null && t.feature >= 0 ? 'x ≤ ' + U.fmt(t.threshold, 2) : '—');
      const leaves = Array.from(new Set(cur.pred.map((v) => U.fmt(v, 3))));
      st.set('leaf', leaves.join(' / '));
      const msgs = {
        mse: 'Для MSE псевдо-остатки — обычные остатки y − F: при m = 0 это −4, −2, −3, 1, 3, 5. Пень делит квартиры на 1–3 и 4–6 и предсказывает средние −3 и +3.',
        mae: 'Для MAE псевдо-остатки — только знаки ±1: дерево видит, <b>в какую сторону</b> ошибается модель, но не насколько. Шаг ν·(±1) одинаков для далёких и близких точек.',
        huber: 'Для Хьюбера остатки обрезаны до ±2: квартиры 1 и 6 с большими остатками тянут не сильнее, чем на 2.',
      };
      note.innerHTML = msgs[s.loss] + (s.m === 0 ? ' Средние потери константы: ' + U.fmt(cur.loss, 4) + '. Нажмите ▶ или «шаг вперёд».' : ' Средние потери: ' + U.fmt(hist[0].loss, 4) + ' → ' + U.fmt(cur.loss, 4) + ' после ' + s.m + ' дерев' + (s.m === 1 ? 'а' : 'ьев') + '.') + ' Каждое дерево — шаг «вниз по склону» потерь сразу для всех объектов: <b>градиентный спуск в пространстве прогнозов</b>.';
    }
    w.pythonAction(() => {
      const r = { mse: 'y - F', mae: 'np.sign(y - F)', huber: 'np.clip(y - F, -2, 2)' }[s.loss];
      const F0 = LS[s.loss].F0;
      return 'import sys, pathlib\nimport numpy as np\nROOT = next(p for p in [pathlib.Path.cwd(), *pathlib.Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())\nsys.path.insert(0, str(ROOT / "shared" / "python"))\nfrom gbcourse.tree import RegressionTree\n\nX = np.arange(1, 7, dtype=float).reshape(-1, 1)\ny = np.array([2, 4, 3, 7, 9, 11], dtype=float)\nnu = ' + U.pyNum(s.nu) + '\nF = np.full(6, ' + U.pyNum(F0) + ')\nfor m in range(' + Math.max(1, s.m) + '):\n    r = ' + r + '                      # псевдо-остатки −∂L/∂F\n    stump = RegressionTree(max_depth=1).fit(X, -r)   # лист = среднее r\n    F = F + nu * stump.predict(X)\n    print(f"дерево {m + 1}: r = {np.round(r, 3)}, F = {np.round(F, 3)}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 28. Производная прогноза бустинга по признаку: ступеньки
   * ============================================================================== */
  GBC.widget('tree-vs-smooth', (el) => {
    const data = GBC.datasets.regression1d({ kind: 'sine', n: 60, noise: 0.3, seed: 7, xMin: 0, xMax: 10 });
    const model = new GBC.GradientBoosting({ nEstimators: 60, learningRate: 0.2, maxDepth: 2, seed: 0 }).fit(data.X, data.y);
    const grid = U.linspace(0.5, 9.5, 901);
    const Fg = model.predictRaw(grid.map((v) => [v]));
    const Fx = (v) => model.predictRawOne([v]);
    const s = { h: 1e-3 };
    const w = ui.shell(el, { title: 'Наклон прогноза бустинга по признаку', sub: 'Бустинг из 60 деревьев глубины 2 обучен на зашумлённом sin x. Его прогноз — лестница. Оцениваем dF/dx центральной разностью с шагом h и сравниваем с истинным наклоном cos x. Двигайте h от крошечного к крупному.' });
    ui.slider(w.controls, { label: 'Шаг h', min: 1e-4, max: 2, log: true, value: s.h, format: powFmt, onInput: (v) => ((s.h = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'x', domain: [0, 10] }, y: { label: 'наклон dF/dx', domain: [-3, 3] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'h', label: 'h' }, { key: 'zero', label: 'доля нулевых оценок' }, { key: 'rmse', label: 'RMSE против cos x' }]);
    function draw() {
      const h = s.h;
      const est = grid.map((v) => (Fx(v + h) - Fx(v - h)) / (2 * h));
      p1.render([
        { type: 'line', x: grid, y: grid.map(Math.sin), color: 'truth', width: 1.6, dash: '5 4', label: 'sin x', hover: false },
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3.5, label: 'данные' },
        { type: 'line', x: grid, y: Fg, color: 'model', width: 2.2, label: 'прогноз F(x)', hover: false },
      ]);
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: grid, y: grid.map(Math.cos), color: 'truth', width: 1.8, dash: '5 4', label: 'cos x', hover: false },
        { type: 'line', x: grid, y: est.map((v) => U.clamp(v, -3, 3)), color: 'tree', width: 1.6, label: 'оценка dF/dx', hover: false },
      ]);
      const zero = est.filter((v) => Math.abs(v) < 1e-12).length / est.length;
      const rmse = Math.sqrt(U.mean(est.map((v, i) => (v - Math.cos(grid[i])) ** 2)));
      st.set('h', powFmt(h));
      st.set('zero', U.fmt(100 * zero, 3) + ' %');
      st.set('rmse', U.fmt(rmse, 3));
      note.innerHTML = h < 0.01
        ? 'При маленьком h почти везде оценка ровно 0 (' + U.fmt(100 * zero, 3) + ' % точек): между порогами прогноз постоянен. А возле порогов — огромные всплески: скачок, делённый на 2h. <b>Производная прогноза дерева по признаку бесполезна</b> — поэтому бустинг дифференцирует потери по прогнозу F, а не модель по x и не дерево по его порогам.'
        : 'С крупным h разностное отношение усредняет много ступенек и начинает напоминать cos x: это <b>средний наклон</b> модели на отрезке [x − h, x + h]. Так строят графики частичной зависимости и оценивают чувствительность моделей на деревьях: только конечными разностями с осмысленным шагом.';
    }
    w.pythonAction(() => 'import sys, pathlib\nimport numpy as np\nROOT = next(p for p in [pathlib.Path.cwd(), *pathlib.Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())\nsys.path.insert(0, str(ROOT / "shared" / "python"))\nfrom gbcourse import datasets\nfrom gbcourse.boosting import GBRegressor\n\nX, y = datasets.regression_1d(kind="sine", n=60, noise=0.3, seed=7)\nmodel = GBRegressor(n_estimators=60, learning_rate=0.2, max_depth=2).fit(X, y)\ngrid = np.linspace(0.5, 9.5, 901)\nF = lambda v: model.predict(v.reshape(-1, 1))\nfor h in [1e-4, 0.01, 0.3, 1.0]:\n    est = (F(grid + h) - F(grid - h)) / (2 * h)\n    print(f"h = {h:<6}: нулевых {np.mean(np.abs(est) < 1e-12):.1%}, RMSE против cos = {np.sqrt(np.mean((est - np.cos(grid))**2)):.3f}")\n');
    draw();
  });

  /* ==============================================================================
   * 29. Тренажёр: знак, значение наклона, график f′
   * ============================================================================== */
  GBC.widget('derivative-game', (el) => {
    const POOL = ['sq', 'cubic', 'cube', 'sin', 'exp', 'bump', 'sigm', 'ln'];
    const s = { mode: 'sign', seed: 1, round: 0, right: 0, streak: 0, best: 0, q: null, answered: null };
    const w = ui.shell(el, { title: 'Тренажёр по производной', sub: 'Три режима: «знак» — растёт ли функция в точке; «значение» — выберите наклон касательной из четырёх чисел (сетка поможет оценить подъём на единицу пробега); «график» — какой из трёх графиков — f′. Цель — серия из 10 верных ответов.' });
    ui.segmented(w.controls, { label: 'Режим', value: s.mode, options: [{ value: 'sign', label: 'знак' }, { value: 'value', label: 'значение' }, { value: 'graph', label: 'график' }], onChange: (v) => ((s.mode = v), (s.streak = 0), newQuestion()) });
    const optBox = H('div', { style: 'display:grid;gap:6px' });
    w.controls.appendChild(optBox);
    const next = ui.button(w.controls, { label: 'Следующий вопрос', icon: 'step', onClick: () => newQuestion() });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'f(x)' } });
    const grid = cardGrid(170);
    w.main.appendChild(grid);
    const minis = ['A', 'B', 'C'].map((L) => {
      const c = card('График ' + L);
      grid.appendChild(c.el);
      return { c, p: new GBC.Plot(c.body, { height: 120, x: { label: '' }, y: { label: '' }, margin: { left: 34, bottom: 20, top: 6, right: 6 } }) };
    });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }, { key: 'b', label: 'лучшая серия' }]);
    let btns = [];
    function setOptions(labels) {
      optBox.textContent = '';
      btns = labels.map((lab, j) => ui.button(optBox, { label: lab, kind: 'primary', onClick: () => answer(j) }));
    }
    function newQuestion() {
      const rng = new GBC.RNG(s.seed++ * 31 + (s.mode === 'value' ? 7 : s.mode === 'graph' ? 13 : 0));
      s.answered = null;
      s.round++;
      if (s.mode === 'graph') {
        const pi = rng.randint(PUZ.length);
        const order = rng.permutation(3);
        s.q = { pi, order, correct: order.indexOf(0) };
        setOptions(['Это A', 'Это B', 'Это C']);
      } else {
        const key = POOL[rng.randint(POOL.length)];
        const F = FN[key];
        let x;
        if (s.mode === 'sign' && F.crit.length && rng.random() < 0.25) x = F.crit[rng.randint(F.crit.length)];
        else {
          for (let k = 0; k < 60; k++) {
            x = Math.round(rng.uniform(F.dom[0] * 0.85 + 0.15 * F.dom[1], F.dom[1] * 0.85 + 0.15 * F.dom[0]) * 10) / 10;
            if (Math.abs(F.df(x)) >= (s.mode === 'sign' ? 0.4 : 0.3)) break;
          }
        }
        const d = F.df(x);
        if (s.mode === 'sign') {
          s.q = { key, x, correct: Math.abs(d) < 1e-9 ? 2 : d > 0 ? 0 : 1 };
          setOptions(['↗ f′ > 0 (растёт)', '↘ f′ < 0 (убывает)', '→ f′ = 0 (ровно)']);
        } else {
          const r1 = (v) => Math.round(v * 10) / 10;
          const cands = [r1(d)];
          for (const v of [r1(-d), r1(F.f(x)), r1(d * 2.5), r1(d + 1), r1(d - 1.5), r1(d / 3)]) if (cands.length < 4 && !cands.some((c) => Math.abs(c - v) < 0.15)) cands.push(v);
          const order = rng.permutation(cands.length);
          const vals = Array.from(order).map((i) => cands[i]);
          s.q = { key, x, vals, correct: vals.indexOf(cands[0]) };
          setOptions(vals.map((v) => 'f′ ≈ ' + U.fmt(v, 2)));
        }
      }
      grid.hidden = s.mode !== 'graph';
      draw();
    }
    function answer(j) {
      if (!s.q || s.answered !== null) return;
      s.answered = j;
      if (j === s.q.correct) {
        s.right++;
        s.streak++;
        s.best = Math.max(s.best, s.streak);
      } else s.streak = 0;
      draw();
    }
    function draw() {
      const show = s.answered !== null;
      btns.forEach((b) => (b.disabled = show));
      if (s.mode === 'graph') {
        const P = PUZ[s.q.pi];
        const xs = U.linspace(P.dom[0], P.dom[1], 301);
        const fc = curve(P.f, P.dom[0], P.dom[1], 0, { xs, jump: 0.5 });
        plot.render([{ type: 'hline', y: 0, color: 'axis', width: 1 }, { type: 'line', x: fc.x, y: fc.y, color: 'model', width: 2.4, hover: false }], { x: P.dom, y: 'auto' });
        const cands = [P.df, ...P.dDec];
        minis.forEach((M, j) => {
          const cc = curve(cands[s.q.order[j]], P.dom[0], P.dom[1], 0, { xs, jump: 0.5 });
          M.p.render([{ type: 'hline', y: 0, color: 'axis', width: 1 }, { type: 'line', x: cc.x, y: cc.y, color: show && j === s.q.correct ? 'good' : 'tree', width: 2, hover: false }], { x: P.dom, y: 'auto' });
          M.c.el.style.outline = show ? (j === s.q.correct ? '2px solid var(--good)' : j === s.answered ? '2px solid var(--critical)' : 'none') : 'none';
        });
        note.innerHTML = !show ? 'Где у f горки и ямы — там у f′ нули. Где f растёт — там f′ > 0.' : (s.answered === s.q.correct ? '<b>Верно!</b> ' : '<b>Не совсем:</b> правильный — ' + 'ABC'[s.q.correct] + '. ') + P.why;
      } else {
        const F = FN[s.q.key];
        const xs = U.linspace(F.dom[0], F.dom[1], 301);
        const d = F.df(s.q.x);
        const span = F.dom[1] - F.dom[0];
        const layers = [{ type: 'line', x: xs, y: xs.map(F.f), color: 'model', width: 2.2, label: 'f(x) = ' + F.label.split(' (')[0], hover: false }];
        if (show) layers.push({ type: 'segments', ...tanSeg(F, s.q.x, span * 0.15), color: 'tree', width: 2.5, opacity: 1 });
        layers.push({ type: 'points', x: [s.q.x], y: [F.f(s.q.x)], color: 'tree', r: 7, label: 'точка' });
        plot.render(layers, { x: F.dom, y: yRange(F.f, xs) });
        if (!show) note.innerHTML = s.mode === 'sign' ? 'Мысленно положите на точку линейку-касательную. Куда она наклонена?' : 'Оцените по сетке: на сколько поднимется касательная, если сдвинуться на 1 вправо? Точка x = ' + U.fmt(s.q.x, 2) + '.';
        else {
          const ok = s.answered === s.q.correct;
          note.innerHTML = (ok ? '<b>Верно!</b> ' : '<b>Не совсем.</b> ') + 'f′(' + U.fmt(s.q.x, 2) + ') = ' + (Math.abs(d) < 1e-9 ? '0' : U.fmt(d, 3)) + '. ' + (s.mode === 'sign' ? (s.q.correct === 2 ? 'Касательная горизонтальна.' : s.q.correct === 0 ? 'Касательная поднимается вправо.' : 'Касательная опускается вправо.') : 'Частые ловушки: перепутать знак (−f′) или назвать значение функции f(x) вместо наклона.');
        }
      }
      st.set('r', String(s.round));
      st.set('ok', String(s.right));
      st.set('s', String(s.streak));
      st.set('b', String(s.best));
      next.textContent = '';
      next.append(ui.icon('step'), show ? 'Следующий вопрос' : 'Пропустить');
    }
    w.pythonAction(() => {
      if (s.mode === 'graph') return '# Режим «график»: проверка численной производной\nimport numpy as np\nx = np.linspace(-2, 2, 401)\nf = x**3 / 3 - x\nprint(np.round(np.gradient(f, x)[::50], 3))   # ≈ x² − 1\n';
      const F = FN[s.q.key];
      return pyHead(F) + '\nx0 = ' + U.pyNum(s.q.x) + '\nprint(f"f\'({x0}) = {df(x0):.4f}")\neps = 1e-5\nprint("проверка центральной разностью:", (f(x0 + eps) - f(x0 - eps)) / (2 * eps))\n';
    });
    newQuestion();
  });
})();
