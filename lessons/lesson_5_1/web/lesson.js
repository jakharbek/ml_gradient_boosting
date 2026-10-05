/* Урок 5.1: свободный градиентный шаг против проекции на дерево. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('free-vs-tree', (el) => {
    const data = GBC.datasets.regression1d({ kind: 'sine', n: 40, noise: 0.3, seed: 52 });
    const test = GBC.datasets.regression1d({ kind: 'sine', n: 400, noise: 0.3, seed: 53 });
    const s = { m: 5, nu: 0.3, depth: 2, loss: 'squared' };
    const w = ui.shell(el, {
      title: 'Свободный шаг против шага деревом',
      sub: 'Оранжевые кольца — «свободный» спуск по вектору прогнозов (только в обучающих точках). Синяя линия — бустинг: шаг деревом. Справа — насколько каждое дерево повторяет направление градиента.',
    });
    ui.select(w.controls, { label: 'Потери', options: [{ value: 'squared', label: 'Квадратичные' }, { value: 'absolute', label: 'Абсолютные' }, { value: 'huber', label: 'Хьюбер (δ = 0.5)' }], value: s.loss, onChange: (v) => ((s.loss = v), draw()) });
    ui.slider(w.controls, { label: 'Темп ν', min: 0.05, max: 1, step: 0.05, value: s.nu, onInput: (v) => ((s.nu = v), draw()) });
    ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 5, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const player = ui.player(w.main, { label: 'Шаг m', min: 0, max: 80, value: s.m, fps: 6, format: (v) => 'm = ' + v, onChange: (v) => ((s.m = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-2, 2] } });
    const p2 = new GBC.Plot(box, { height: 300, x: { label: 'шаг m' }, y: { label: 'значение' }, crosshair: true, crosshairTitle: (v) => 'm = ' + Math.round(v) });
    const stats = ui.stats(w.foot, [{ key: 'ftr', label: 'MSE обучения: свободный / деревом' }, { key: 'fte', label: 'MSE новых данных: свободный / деревом' }, { key: 'cos', label: 'cos∠(r, h) на шаге m' }]);
    function run() {
      const loss = GBC.losses.get(s.loss, { delta: 0.5 });
      const f0 = loss.init(data.y);
      let Ffree = data.y.map(() => f0);
      let Ftree = data.y.map(() => f0);
      const trees = [];
      const cos = [];
      const mseFree = [GBC.metrics.mse(data.y, Ffree)];
      const mseTree = [GBC.metrics.mse(data.y, Ftree)];
      for (let m = 0; m < 80; m++) {
        const rFree = loss.negativeGradient(data.y, Ffree);
        Ffree = Ffree.map((f, i) => f + s.nu * rFree[i]);
        const r = loss.negativeGradient(data.y, Ftree);
        const t = new GBC.RegressionTree({ maxDepth: s.depth }).fit(data.X, r.map((v) => -v));
        const hv = data.X.map((x) => t.predictOne(x));
        let dot = 0;
        let nr = 0;
        let nh = 0;
        r.forEach((v, i) => ((dot += v * hv[i]), (nr += v * v), (nh += hv[i] * hv[i])));
        cos.push(nr > 0 && nh > 0 ? dot / Math.sqrt(nr * nh) : 0);
        Ftree = Ftree.map((f, i) => f + s.nu * hv[i]);
        trees.push(t);
        mseFree.push(GBC.metrics.mse(data.y, Ffree));
        mseTree.push(GBC.metrics.mse(data.y, Ftree));
      }
      return { f0, trees, cos, mseFree, mseTree };
    }
    let cache = null;
    let key = '';
    function draw() {
      const k = s.loss + s.nu + s.depth;
      if (k !== key) {
        cache = run();
        key = k;
      }
      const { f0, trees, cos, mseFree, mseTree } = cache;
      const m = s.m;
      const loss = GBC.losses.get(s.loss, { delta: 0.5 });
      let Ffree = data.y.map(() => f0);
      for (let j = 0; j < m; j++) {
        const r = loss.negativeGradient(data.y, Ffree);
        Ffree = Ffree.map((f, i) => f + s.nu * r[i]);
      }
      const gx = U.linspace(0, 10, 300);
      const predTree = (x) => {
        let f = f0;
        for (let j = 0; j < m; j++) f += s.nu * trees[j].predictOne([x]);
        return f;
      };
      p1.render([
        { type: 'line', x: gx, y: gx.map(Math.sin), color: 'truth', dash: '5 4', width: 1.4, label: 'истина', hover: false },
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3.5, label: 'данные' },
        { type: 'points', x: data.x, y: Ffree, color: 'tree', hollow: true, r: 4.5, label: 'свободный спуск F_i' },
        { type: 'line', x: gx, y: gx.map(predTree), color: 'model', width: 2.4, label: 'бустинг (шаг деревом)' },
      ]);
      const ms = U.range(81);
      p2.render([
        { type: 'line', x: ms, y: mseFree, color: 'orange', label: 'MSE обучения: свободный' },
        { type: 'line', x: ms, y: mseTree, color: 'blue', label: 'MSE обучения: деревом' },
        { type: 'line', x: U.range(80, 1), y: cos, color: 'aqua', dash: '5 4', label: 'cos∠(r, h)' },
        { type: 'vline', x: m, color: 'ink2', dash: '3 3', width: 1 },
      ], { y: [0, 1.05] });
      const teTree = GBC.metrics.mse(test.y, test.X.map((x) => predTree(x[0])));
      const teFree = GBC.metrics.mse(test.y, test.y.map(() => f0));
      stats.set('ftr', U.fmt(mseFree[m], 3) + ' / ' + U.fmt(mseTree[m], 3));
      stats.set('fte', U.fmt(teFree, 3) + ' / ' + U.fmt(teTree, 3));
      stats.set('cos', m > 0 ? U.fmt(cos[m - 1], 3) : '—');
    }
    draw();
  });
})();
