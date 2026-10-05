/* Урок 12.3: PDP и ICE; монотонные ограничения (кривые LightGBM — results.js). */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('pdp-ice', (el) => {
    const s = { j: 0, centered: false };
    const w = ui.shell(el, {
      title: 'PDP и ICE',
      sub: 'Бустинг из 100 деревьев глубины 3 на задаче Фридмана с 7 признаками. Тонкие линии — ICE для 50 объектов (цвет — значение x1), толстая — PDP (среднее по 200 объектам).',
    });
    const data = GBC.datasets.friedman1({ n: 600, noise: 1, seed: 180, nFeatures: 7 });
    const model = new GBC.GradientBoosting({ nEstimators: 100, maxDepth: 3, learningRate: 0.1 }).fit(data.X, data.y);
    const predictOne = (r) => model.predictRawOne(r);
    ui.select(w.controls, { label: 'Признак', value: '0', options: U.range(7).map((j) => ({ value: String(j), label: 'x' + j + (j >= 5 ? ' (шум)' : '') })), onChange: (v) => ((s.j = Number(v)), draw()) });
    ui.toggle(w.controls, { label: 'Центрировать ICE (c-ICE)', checked: s.centered, onChange: (v) => ((s.centered = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x0', domain: [0, 1] }, y: { label: 'прогноз' } });
    const stats = ui.stats(w.foot, [{ key: 'range', label: 'размах PDP' }, { key: 'spread', label: 'разброс c-ICE в правом конце (σ)' }]);
    const grid = U.linspace(0, 1, 21);
    const div = GBC.colors.diverging();

    function draw() {
      const Xs = data.X.slice(0, 50);
      let ice = GBC.explain.iceCurves(predictOne, Xs, s.j, grid);
      let pd = GBC.explain.partialDependence(predictOne, data.X.slice(0, 200), s.j, grid);
      const cice = ice.map((c) => c.map((v) => v - c[0]));
      if (s.centered) {
        ice = cice;
        pd = pd.map((v) => v - pd[0]);
      }
      plot.opts.x.label = 'x' + s.j;
      plot.opts.y.label = s.centered ? 'прогноз − прогноз при x' + s.j + ' = 0' : 'прогноз';
      plot.render([
        ...ice.map((c, i) => ({ type: 'line', x: grid, y: c, color: GBC.colors.rgbString(div(2 * Xs[i][1] - 1)), width: 1, opacity: 0.55, hover: false })),
        { type: 'line', x: grid, y: pd, color: 'ink', width: 3.2, label: 'PDP' },
      ]);
      const last = cice.map((c) => c[c.length - 1]);
      stats.set('range', U.fmt(Math.max(...pd) - Math.min(...pd), 3));
      stats.set('spread', U.fmt(Math.sqrt(U.variance(last)), 3));
    }
    draw();
  });

  GBC.widget('monotone', (el) => {
    const M = GBC.monotone;
    const w = ui.shell(el, {
      title: 'Модель с монотонным ограничением и без',
      sub: 'LightGBM, y = g(x0) + 0.5·sin(2πx1) + шум (σ = 0.5). Кривые — частичная зависимость от x0 (вклад x1 вычтен), точки — данные первой выборки без вклада x1. RMSE — относительно истинной функции, среднее по 5 выборкам. Данные — скрипт examples/monotone.py.',
    });
    if (!M) {
      w.main.textContent = 'Нет данных: запустите python lessons/lesson_12_3/examples/monotone.py';
      return;
    }
    const s = { sc: 0, n: 1 };
    ui.segmented(w.controls, { label: 'Истинная зависимость от x0', value: s.sc, options: M.scenarios.map((q, i) => ({ value: i, label: q.name })), onChange: (v) => ((s.sc = v), draw()) });
    ui.segmented(w.controls, { label: 'Объектов в обучении', value: s.n, options: M.scenarios[0].sizes.map((q, i) => ({ value: i, label: String(q.n) })), onChange: (v) => ((s.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x0', domain: [0, 1] }, y: { label: 'вклад x0' } });
    const stats = ui.stats(w.foot, [{ key: 'free', label: 'без ограничения: RMSE / шагов вниз' }, { key: 'mono', label: 'монотонная: RMSE / шагов вниз' }]);

    function draw() {
      const sc = M.scenarios[s.sc];
      const r = sc.sizes[s.n];
      plot.render([
        { type: 'points', x: r.points.x, y: r.points.y, color: 'data', r: 2.4, opacity: 0.5, label: 'данные' },
        { type: 'line', x: M.grid, y: sc.truth, color: 'truth', dash: '5 4', width: 1.6, label: 'истина', hover: false },
        { type: 'line', x: M.grid, y: r.free_curve, color: 'model', width: 2.2, label: 'без ограничения' },
        { type: 'line', x: M.grid, y: r.mono_curve, color: 'tree', width: 2.2, label: 'монотонная' },
      ]);
      stats.set('free', U.fmt(r.free_rmse, 3) + ' / ' + r.free_down);
      stats.set('mono', U.fmt(r.mono_rmse, 3) + ' / ' + r.mono_down);
    }
    draw();
  });
})();
