/* Модуль 3: бэггинг против бустинга. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('bag-vs-boost', (el) => {
    const data = GBC.datasets.regression1d({ kind: 'wave', n: 80, noise: 0.4, seed: 21 });
    const test = GBC.datasets.regression1d({ kind: 'wave', n: 500, noise: 0.4, seed: 22 });
    const s = { B: 10 };
    const w = ui.shell(el, { title: 'Бэггинг глубоких деревьев против бустинга пней', sub: 'Одинаковое число моделей B. Светлые линии слева — отдельные деревья леса, их среднее — синяя линия.' });
    ui.slider(w.controls, { label: 'Число моделей B', min: 1, max: 300, step: 1, value: s.B, format: String, onInput: (v) => ((s.B = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 280, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-1.5, 4.5] } });
    const p2 = new GBC.Plot(box, { height: 280, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-1.5, 4.5] } });
    p1.setTitle('Бэггинг: среднее глубоких деревьев');
    p2.setTitle('Бустинг: сумма пней (ν = 0.1)');
    const curve = new GBC.Plot(w.main, { height: 220, x: { label: 'число моделей B', type: 'log', domain: [1, 300] }, y: { label: 'MSE на новых данных' }, crosshair: true, crosshairTitle: (v) => 'B = ' + Math.round(v) });
    const stats = ui.stats(w.foot, [{ key: 'bag', label: 'MSE бэггинга' }, { key: 'boost', label: 'MSE бустинга' }, { key: 'noise', label: 'Шум σ² (предел)' }]);
    const bag = new GBC.BaggingTrees({ nEstimators: 300, maxDepth: null, seed: 1 }).fit(data.X, data.y);
    const gb = new GBC.GradientBoosting({ nEstimators: 300, learningRate: 0.1, maxDepth: 1 }).fit(data.X, data.y);
    const grid = U.linspace(0, 10, 300).map((v) => [v]);
    const gx = grid.map((r) => r[0]);
    const Bs = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100, 150, 200, 300];
    const bagCurve = Bs.map((B) => GBC.metrics.mse(test.y, bag.predict(test.X, B)));
    const boostCurve = Bs.map((B) => GBC.metrics.mse(test.y, gb.predictRaw(test.X, B)));
    function draw() {
      const B = s.B;
      const layers1 = [{ type: 'points', x: data.x, y: data.y, color: 'data', r: 3, label: 'данные' }];
      for (let b = 0; b < Math.min(B, 25); b++) layers1.push({ type: 'line', x: gx, y: grid.map((x) => bag.trees[b].predictOne(x)), color: 'model-prev', width: 1, opacity: 0.45, hover: false });
      layers1.push({ type: 'line', x: gx, y: bag.predict(grid, B), color: 'model', width: 2.4, label: 'среднее ' + B + ' деревьев' });
      p1.render(layers1);
      p2.render([
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3, label: 'данные' },
        { type: 'line', x: gx, y: gb.predictRaw(grid, B), color: 'model', width: 2.4, label: 'сумма ' + B + ' пней' },
      ]);
      curve.render([
        { type: 'line', x: Bs, y: bagCurve, color: 'blue', label: 'бэггинг' },
        { type: 'line', x: Bs, y: boostCurve, color: 'orange', label: 'бустинг' },
        { type: 'hline', y: 0.16, color: 'muted', dash: '4 3', width: 1, text: 'шум σ² = 0.16' },
        { type: 'vline', x: B, color: 'ink2', dash: '3 3', width: 1 },
      ], { y: [0, 1.4] });
      stats.set('bag', U.fmt(GBC.metrics.mse(test.y, bag.predict(test.X, B)), 3));
      stats.set('boost', U.fmt(GBC.metrics.mse(test.y, gb.predictRaw(test.X, B)), 3));
      stats.set('noise', '0.16');
    }
    w.pythonAction(() =>
      'from gbcourse import datasets, BaggingTrees, GradientBoosting\nfrom gbcourse.metrics import mse\n\nX, y = datasets.regression_1d(kind="wave", n=80, noise=0.4, seed=21)\nX_te, y_te = datasets.regression_1d(kind="wave", n=500, noise=0.4, seed=22)\n' +
      'bag = BaggingTrees(n_estimators=' + s.B + ', max_depth=None, seed=1).fit(X, y)\nboost = GradientBoosting(n_estimators=' + s.B + ', learning_rate=0.1, max_depth=1).fit(X, y)\n' +
      'print("MSE бэггинга:", mse(y_te, bag.predict(X_te)))\nprint("MSE бустинга:", mse(y_te, boost.predict(X_te)))\n'
    );
    draw();
  });
})();
