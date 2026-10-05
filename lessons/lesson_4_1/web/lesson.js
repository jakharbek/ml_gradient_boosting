/* Урок 4.1: бустинг на шести точках в виде таблицы. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('manual-boost', (el) => {
    const d = GBC.datasets.toyRegression();
    const s = { nu: 1, m: 1 };
    const w = ui.shell(el, { title: 'Бустинг на шести квартирах', sub: 'Каждая итерация: остатки r → пень h (оранжевый) → новая модель F (синяя). В таблице — все числа.' });
    ui.segmented(w.controls, { label: 'Темп ν', options: [{ value: 1, label: '1' }, { value: 0.5, label: '0.5' }, { value: 0.1, label: '0.1' }], value: s.nu, onChange: (v) => ((s.nu = v), fit()) });
    const player = ui.player(w.controls, { label: 'Итераций m', min: 0, max: 8, value: s.m, fps: 1.5, format: (v) => 'm = ' + v, onChange: (v) => ((s.m = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 260, x: { label: 'площадь x', domain: [0.5, 6.5] }, y: { label: 'цена y', domain: [0, 12] } });
    const p2 = new GBC.Plot(box, { height: 260, x: { label: 'площадь x', domain: [0.5, 6.5] }, y: { label: 'остаток', domain: [-5, 5.5] } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const stats = ui.stats(w.foot, [{ key: 'sse', label: 'Сумма квадратов остатков' }, { key: 'hist', label: 'По итерациям' }]);
    let model;
    let staged;
    function fit() {
      model = new GBC.GradientBoosting({ nEstimators: 8, learningRate: s.nu, maxDepth: 1 }).fit(d.X, d.y);
      staged = model.stagedRaw(d.X);
      draw();
    }
    const fmt = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : U.fmt(v, 3)).replace('-', '−');
    function draw() {
      const m = s.m;
      const F = staged[m];
      const Fprev = staged[Math.max(0, m - 1)];
      const segs = (t) => t.segments1d(0.5, 6.5);
      p1.render([
        { type: 'segments', x1: d.x, y1: d.y, x2: d.x, y2: F, color: 'residual', opacity: 0.7 },
        { type: 'points', x: d.x, y: d.y, color: 'data', r: 5, label: 'цены', tooltip: (i) => [{ label: 'y', value: fmt(d.y[i]) }, { label: 'F_' + m, value: fmt(F[i]) }] },
        { type: 'line', x: U.linspace(0.5, 6.5, 400), y: U.linspace(0.5, 6.5, 400).map((v) => model.predictRawOne([v], m)), color: 'model', width: 2.4, label: 'F_' + m + '(x)' },
      ]);
      const r = d.y.map((v, i) => v - Fprev[i]);
      p2.setTitle(m > 0 ? 'Остатки r^{(' + m + ')} = y − F_{' + (m - 1) + '} и дерево h_' + m : 'Остатки F_0');
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'points', x: d.x, y: m > 0 ? r : d.y.map((v, i) => v - F[i]), color: 'data', r: 5, label: 'остатки' },
        m > 0 ? { type: 'steps', segments: segs(model.trees[m - 1][0]), color: 'tree', width: 2.4, label: 'h_' + m + '(x)' } : null,
      ]);
      // Таблица: x, y, F0, (r1, h1, F1), ...
      const cols = ['x', 'y', 'F_0'];
      for (let k = 1; k <= m; k++) cols.push('r^{(' + k + ')}', 'h_' + k, 'F_' + k);
      const rows = d.x.map((x, i) => {
        const row = [fmt(x), fmt(d.y[i]), fmt(staged[0][i])];
        for (let k = 1; k <= m; k++) {
          row.push(fmt(d.y[i] - staged[k - 1][i]), fmt(model.trees[k - 1][0].predictOne([x])), fmt(staged[k][i]));
        }
        return row;
      });
      tableBox.textContent = '';
      ui.table(tableBox, { columns: cols, rows, numeric: true });
      const sse = staged.slice(0, m + 1).map((Fk) => U.sum(d.y.map((v, i) => (v - Fk[i]) ** 2)));
      stats.set('sse', fmt(sse[sse.length - 1]));
      stats.set('hist', sse.map(fmt).join(' → '));
    }
    w.pythonAction(() =>
      'from gbcourse import datasets, GBRegressor\n\nX, y = datasets.toy_regression()\nmodel = GBRegressor(n_estimators=' + s.m + ', learning_rate=' + s.nu + ', max_depth=1).fit(X, y)\n' +
      'F = model.init_\nprint("F0 =", F)\nfor m, F_m in enumerate(model.staged_predict_raw(X), start=1):\n    print(f"F{m} =", F_m.round(4), " сумма квадратов =", round(((y - F_m) ** 2).sum(), 4))\n'
    );
    fit();
  });
})();
