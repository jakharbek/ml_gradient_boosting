/* Урок 10: инвариантность к монотонным преобразованиям; наклонная граница и признак-разность. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  const TRANSFORMS = {
    none: { label: 'без преобразования', f: (x) => x },
    log: { label: 'log(x + 1)', f: (x) => Math.log(x + 1) },
    exp: { label: 'eˣ', f: (x) => Math.exp(x) },
    cube: { label: '(x − 5)³', f: (x) => (x - 5) ** 3 },
    neg: { label: '−x', f: (x) => -x },
    square: { label: '(x − 5)² — не монотонно!', f: (x) => (x - 5) ** 2 },
  };

  GBC.widget('monotone', (el) => {
    const s = { tr: 'exp' };
    const w = ui.shell(el, {
      title: 'Преобразуем признак — что с моделью?',
      sub: 'Бустинг (50 деревьев глубины 2) обучается на преобразованном признаке z = f(x), но оба прогноза нарисованы над исходным x. Сверху — сам признак до и после преобразования.',
    });
    ui.select(w.controls, { label: 'Преобразование f', value: s.tr, options: Object.entries(TRANSFORMS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.tr = v), draw()) });
    const pf = new GBC.Plot(w.main, { height: 160, x: { label: 'x', domain: [0, 10] }, y: { label: 'z = f(x)' } });
    const pm = new GBC.Plot(w.main, { height: 250, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const stats = ui.stats(w.foot, [{ key: 'diff', label: 'наибольшее расхождение прогнозов на обучении' }, { key: 'thr', label: 'первый порог: по x / по z' }]);
    const d = GBC.datasets.regression1d({ kind: 'wave', n: 150, noise: 0.4, seed: 131 });
    const base = new GBC.GradientBoosting({ nEstimators: 50, maxDepth: 2 }).fit(d.X, d.y);
    const pBase = base.predictRaw(d.X);
    const order = U.range(d.x.length).sort((a, b) => d.x[a] - d.x[b]);
    const xs = order.map((i) => d.x[i]);

    function draw() {
      const f = TRANSFORMS[s.tr].f;
      const Z = d.X.map((r) => [f(r[0])]);
      const m = new GBC.GradientBoosting({ nEstimators: 50, maxDepth: 2 }).fit(Z, d.y);
      const p = m.predictRaw(Z);
      const gx = U.linspace(0, 10, 200);
      pf.render([{ type: 'line', x: gx, y: gx.map(f), color: 'model', width: 2, label: 'z = f(x)' }]);
      pm.render([
        { type: 'points', x: d.x, y: d.y, color: 'data', r: 2.4, opacity: 0.6, label: 'данные' },
        { type: 'line', x: xs, y: order.map((i) => pBase[i]), color: 'muted', width: 4, curve: 'step', label: 'модель на x' },
        { type: 'line', x: xs, y: order.map((i) => p[i]), color: 'tree', width: 1.8, curve: 'step', label: 'модель на z' },
      ]);
      let diff = 0;
      for (let i = 0; i < p.length; i++) diff = Math.max(diff, Math.abs(p[i] - pBase[i]));
      stats.set('diff', diff === 0 ? '0 — совпадают точно' : U.fmt(diff, 4));
      stats.set('thr', U.fmt(base.trees[0][0].nodes[0].threshold, 3) + ' / ' + U.fmt(m.trees[0][0].nodes[0].threshold, 3));
    }
    draw();
  });

  GBC.widget('diagonal', (el) => {
    const s = { diff: false, depth: 1 };
    const NG = 70;
    const w = ui.shell(el, {
      title: 'Наклонная граница',
      sub: 'Класс 1, если x₁ > x₀; 5% меток перевёрнуто (потолок точности 0.95). 1000 объектов для обучения, 1000 для теста, 200 деревьев, ν = 0.1. Цвет — вероятность класса 1, линия — граница p = 0.5.',
    });
    ui.toggle(w.controls, { label: 'Добавить признак x₁ − x₀', checked: s.diff, onChange: (v) => ((s.diff = v), draw()) });
    ui.slider(w.controls, { label: 'Глубина деревьев', min: 1, max: 4, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x₀', domain: [0, 1] }, y: { label: 'x₁', domain: [0, 1] } });
    const stats = ui.stats(w.foot, [{ key: 'acc', label: 'точность на тесте' }, { key: 'splits', label: 'разбиений по x₀ / x₁ / x₁ − x₀' }]);
    const rng = new GBC.RNG(132);
    const make = (n) => {
      const X = [];
      const y = [];
      for (let i = 0; i < n; i++) {
        const a = rng.random();
        const b = rng.random();
        let c = b > a ? 1 : 0;
        if (rng.random() < 0.05) c = 1 - c;
        X.push([a, b]);
        y.push(c);
      }
      return { X, y };
    };
    const tr = make(1000);
    const te = make(1000);
    const grid = { x0: 0, x1: 1, y0: 0, y1: 1, nx: NG, ny: NG };
    const pts = [];
    for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) pts.push([i / (NG - 1), j / (NG - 1)]);

    function draw() {
      const feats = (X) => (s.diff ? X.map((r) => [r[0], r[1], r[1] - r[0]]) : X);
      const m = new GBC.GradientBoosting({ loss: 'logistic', nEstimators: 200, learningRate: 0.1, maxDepth: s.depth }).fit(feats(tr.X), tr.y);
      const values = Float64Array.from(m.predictProba(feats(pts)).map((r) => (Array.isArray(r) ? r[1] : r)));
      const pf = GBC.colors.proba();
      const g = Object.assign({ values }, grid);
      const idx = (c) => U.range(tr.y.length).filter((i) => tr.y[i] === c).slice(0, 300);
      plot.render([
        { type: 'heatmap', grid: g, colorFn: pf, opacity: 0.85 },
        { type: 'contour', grid: g, level: 0.5, color: 'ink2', width: 1.8 },
        { type: 'line', x: [0, 1], y: [0, 1], color: 'ink', dash: '4 3', width: 1, label: 'истинная граница' },
        { type: 'points', x: idx(0).map((i) => tr.X[i][0]), y: idx(0).map((i) => tr.X[i][1]), color: 'class0', r: 2.2, label: 'класс 0' },
        { type: 'points', x: idx(1).map((i) => tr.X[i][0]), y: idx(1).map((i) => tr.X[i][1]), color: 'class1', r: 2.2, label: 'класс 1' },
      ]);
      const pt = m.predictProba(feats(te.X)).map((r) => (Array.isArray(r) ? r[1] : r));
      stats.set('acc', U.fmt(U.mean(pt.map((p, i) => ((p > 0.5 ? 1 : 0) === te.y[i] ? 1 : 0))), 3));
      const cnt = [0, 0, 0];
      for (const st of m.trees) for (const nd of st[0].nodes) if (nd.left >= 0) cnt[nd.feature] += 1;
      stats.set('splits', cnt[0] + ' / ' + cnt[1] + ' / ' + (s.diff ? cnt[2] : '—'));
    }
    draw();
  });
})();
