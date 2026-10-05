/* Урок 3.1: бутстрэп, бэггинг, декорреляция. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('bagging-demo', (el) => {
    const data = GBC.datasets.regression1d({ kind: 'sine', n: 40, noise: 0.35, seed: 13 });
    const s = { b: 1, B: 20 };
    const bag = new GBC.BaggingTrees({ nEstimators: 100, maxDepth: null, seed: 5 }).fit(data.X, data.y);
    const w = ui.shell(el, { title: 'Бутстрэп-выборки и их среднее', sub: 'Размер точки — сколько раз объект попал в выборку дерева b. Полые точки — вне мешка (OOB). Оранжевая линия — дерево b, синяя — среднее первых B деревьев.' });
    ui.slider(w.controls, { label: 'Номер дерева b', min: 1, max: 100, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.slider(w.controls, { label: 'Деревьев в среднем B', min: 1, max: 100, step: 1, value: s.B, format: String, onInput: (v) => ((s.B = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-2, 2] } });
    const stats = ui.stats(w.foot, [{ key: 'uniq', label: 'Различных объектов в выборке b' }, { key: 'oob', label: 'Вне мешка' }, { key: 'oobmse', label: 'OOB MSE леса из B деревьев' }]);
    const grid = U.linspace(0, 10, 300).map((v) => [v]);
    function draw() {
      const c = bag.inbagCounts[s.b - 1];
      const tree = bag.trees[s.b - 1];
      const inIdx = U.range(c.length).filter((i) => c[i] > 0);
      const outIdx = U.range(c.length).filter((i) => c[i] === 0);
      plot.render([
        { type: 'points', x: outIdx.map((i) => data.x[i]), y: outIdx.map((i) => data.y[i]), color: 'data', hollow: true, r: 4, label: 'вне мешка' },
        { type: 'points', x: inIdx.map((i) => data.x[i]), y: inIdx.map((i) => data.y[i]), color: 'data', r: (j) => 2.5 + 2 * c[inIdx[j]], label: 'в выборке (размер = кратность)', tooltip: (j) => [{ label: 'кратность', value: String(c[inIdx[j]]) }] },
        { type: 'line', x: grid.map((r) => r[0]), y: grid.map((x) => tree.predictOne(x)), color: 'tree', width: 1.8, label: 'дерево b' },
        { type: 'line', x: grid.map((r) => r[0]), y: bag.predict(grid, s.B), color: 'model', width: 2.6, label: 'среднее B деревьев' },
      ]);
      // OOB для первых B деревьев
      let se = 0;
      let cnt = 0;
      data.X.forEach((x, i) => {
        let sum = 0;
        let k = 0;
        for (let b = 0; b < s.B; b++) if (bag.inbagCounts[b][i] === 0) (sum += bag.trees[b].predictOne(x)), k++;
        if (k) (se += (data.y[i] - sum / k) ** 2), cnt++;
      });
      stats.set('uniq', inIdx.length + ' из ' + data.y.length + ' (' + U.fmt((100 * inIdx.length) / data.y.length, 1) + '%)');
      stats.set('oob', String(outIdx.length));
      stats.set('oobmse', cnt ? U.fmt(se / cnt, 3) + ' (по ' + cnt + ' объектам)' : '—');
    }
    draw();
  });

  GBC.widget('rf-decorrelation', (el) => {
    const train = GBC.datasets.friedman1({ n: 300, noise: 1, seed: 31 });
    const test = GBC.datasets.friedman1({ n: 600, noise: 1, seed: 32 });
    const mfs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1.0];
    const w = ui.shell(el, { title: 'Доля признаков в узле: корреляция против качества', sub: 'Для каждого max_features обучено 60 деревьев. ρ — средняя корреляция прогнозов двух деревьев на тесте, σ² — разброс одного дерева.', noControls: true });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'max_features (доля признаков в узле)', domain: [0.05, 1.05] }, y: { label: 'значение' }, crosshair: true, crosshairTitle: (v) => 'max_features = ' + U.fmt(v, 2) });
    const note = w.note('Вычисляю…', true);
    setTimeout(() => {
      const rho = [];
      const mseForest = [];
      const mseTree = [];
      for (const mf of mfs) {
        const rf = new GBC.BaggingTrees({ nEstimators: 60, maxDepth: null, maxFeatures: mf, seed: 2 }).fit(train.X, train.y);
        const P = rf.trees.map((t) => t.predict(test.X));
        const mean = test.X.map((_, i) => U.mean(P.map((p) => p[i])));
        let cov = 0;
        let v = 0;
        let pairs = 0;
        for (let a = 0; a < P.length; a++) {
          const da = P[a].map((p, i) => p - mean[i]);
          v += U.mean(da.map((d) => d * d));
          for (let b = a + 1; b < Math.min(P.length, a + 8); b++) {
            cov += U.mean(da.map((d, i) => d * (P[b][i] - mean[i])));
            pairs++;
          }
        }
        const sigma2 = v / P.length;
        rho.push(cov / pairs / sigma2);
        mseForest.push(GBC.metrics.mse(test.y, mean));
        mseTree.push(U.mean(P.map((p) => GBC.metrics.mse(test.y, p))));
      }
      const scale = Math.max(...mseTree);
      plot.render([
        { type: 'line', x: mfs, y: rho, color: 'violet', label: 'корреляция деревьев ρ' },
        { type: 'line', x: mfs, y: mseTree.map((v) => v / scale), color: 'orange', label: 'MSE одного дерева (норм.)' },
        { type: 'line', x: mfs, y: mseForest.map((v) => v / scale), color: 'blue', width: 2.6, label: 'MSE леса (норм.)' },
      ], { y: [0, 1.05] });
      const best = mfs[U.argmax(mseForest.map((v) => -v))];
      note.innerHTML = 'Чем меньше доля признаков, тем ниже корреляция деревьев (фиолетовая) и тем хуже каждое дерево (оранжевая). Лес (синяя) лучше всего при max_features ≈ ' + best + ' — компромисс между разнообразием и силой деревьев. MSE нормированы на худшее одиночное дерево.';
    }, 30);
  });
})();
