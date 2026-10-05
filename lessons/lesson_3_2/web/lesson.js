/* Урок 3.2: AdaBoost на плоскости. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('adaboost-2d', (el) => {
    const s = { kind: 'circles', m: 1, flip: 0, M: 60 };
    const w = ui.shell(el, { title: 'AdaBoost шаг за шагом', sub: 'Размер точки — её вес перед шагом m. Пунктир — разбиение пня hₘ. Фон — знак суммы Σαₖhₖ(x) после шага m.' });
    ui.select(w.controls, { label: 'Данные', options: [{ value: 'circles', label: 'Круги' }, { value: 'moons', label: 'Луны' }, { value: 'xor', label: 'XOR' }, { value: 'blobs', label: 'Два облака' }], value: s.kind, onChange: (v) => ((s.kind = v), fit()) });
    ui.slider(w.controls, { label: 'Доля неверных меток', min: 0, max: 0.2, step: 0.01, value: s.flip, onInput: (v) => ((s.flip = v), fit()) });
    const player = ui.player(w.main, { label: 'Шаг m', min: 1, max: s.M, value: 1, fps: 3, format: (v, mx) => 'm = ' + v + ' / ' + mx, onChange: (v) => ((s.m = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const surf = new GBC.Plot(box, { height: 320, equal: true, x: { label: 'x_0' }, y: { label: 'x_1' }, grid: 'none' });
    const curve = new GBC.Plot(box, { height: 320, x: { label: 'шаг m' }, y: { label: 'значение', domain: [0, 1] }, crosshair: true, crosshairTitle: (v) => 'm = ' + Math.round(v) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'eps', label: 'εₘ (взвешенная ошибка)' }, { key: 'alpha', label: 'αₘ (голос)' }, { key: 'acc', label: 'Точность ансамбля' }, { key: 'wmax', label: 'Макс. вес / средний' }]);
    let data;
    let ada;
    let flipped;
    let bounds;
    function fit() {
      data = GBC.datasets.classification2d({ kind: s.kind, n: 160, noise: 0.15, seed: 5 });
      const rng = new GBC.RNG(99);
      flipped = new Set();
      data.y = data.y.map((v, i) => {
        if (rng.random() < s.flip) {
          flipped.add(i);
          return 1 - v;
        }
        return v;
      });
      ada = new GBC.AdaBoost({ nEstimators: s.M }).fit(data.X, data.y);
      player.setMax(ada.trees.length);
      s.m = Math.min(s.m, ada.trees.length);
      const [x0, x1] = U.extent(data.X.map((r) => r[0]));
      const [y0, y1] = U.extent(data.X.map((r) => r[1]));
      bounds = { x0: x0 - 0.3, x1: x1 + 0.3, y0: y0 - 0.3, y1: y1 + 0.3 };
      draw();
    }
    function draw() {
      const m = s.m;
      const wts = ada.weights[m - 1];
      const wMean = 1 / wts.length;
      const grid = GBC.Plot.grid((a, b) => ada.decisionOne([a, b], m), bounds.x0, bounds.x1, bounds.y0, bounds.y1, 70, 70);
      const pf = GBC.colors.proba();
      const layers = [{ type: 'heatmap', grid, colorFn: (v) => pf(v > 0 ? 0.78 : 0.22), opacity: 0.55, smooth: false }];
      const stump = ada.trees[m - 1].nodes[0];
      if (stump.left >= 0) {
        if (stump.feature === 0) layers.push({ type: 'vline', x: stump.threshold, color: 'ink', width: 1.8, dash: '6 4' });
        else layers.push({ type: 'hline', y: stump.threshold, color: 'ink', width: 1.8, dash: '6 4' });
      }
      for (const c of [0, 1]) {
        const idx = data.y.map((v, i) => (v === c ? i : -1)).filter((i) => i >= 0);
        layers.push({
          type: 'points', x: idx.map((i) => data.X[i][0]), y: idx.map((i) => data.X[i][1]), color: 'class' + c, shape: c ? 'square' : 'circle',
          r: (j) => 2 + 3.2 * Math.sqrt(wts[idx[j]] / wMean), label: 'класс ' + c,
          highlight: new Set(idx.map((i, j) => (flipped.has(i) ? j : -1)).filter((j) => j >= 0)),
          tooltip: (j) => [{ label: 'вес / средний', value: U.fmt(wts[idx[j]] / wMean, 2) }, { label: 'метка', value: String(c) + (flipped.has(idx[j]) ? ' (испорчена)' : '') }],
        });
      }
      surf.render(layers, { x: [bounds.x0, bounds.x1], y: [bounds.y0, bounds.y1] });
      const ms = U.range(ada.trees.length, 1);
      const accs = ms.map((k) => GBC.metrics.accuracy(data.y, ada.predict(data.X, k)));
      curve.render([
        { type: 'line', x: ms, y: ada.errors, color: 'orange', label: 'εₘ пня' },
        { type: 'line', x: ms, y: accs.map((a) => 1 - a), color: 'blue', label: 'ошибка ансамбля' },
        { type: 'line', x: ms, y: ada.alphas.map((a) => a / Math.max(...ada.alphas)), color: 'aqua', dash: '5 4', label: 'α (норм.)' },
        { type: 'vline', x: m, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      stats.set('eps', U.fmt(ada.errors[m - 1], 3));
      stats.set('alpha', U.fmt(ada.alphas[m - 1], 3));
      stats.set('acc', U.fmt(accs[m - 1] * 100, 1) + '%');
      stats.set('wmax', U.fmt(Math.max(...wts) / wMean, 1) + '×');
      note.innerHTML = s.flip > 0
        ? 'Точки с испорченными метками обведены. С ростом m их веса становятся огромными — AdaBoost изо всех сил подгоняется под ошибки разметки.'
        : 'Каждый пень ошибается почти на половине веса (ε ≈ 0.3–0.45), но сумма пней строит сложную границу. Трудные точки у границы классов растут в размере.';
    }
    w.pythonAction(() =>
      'from gbcourse import datasets, AdaBoost\n\nX, y = datasets.classification_2d(kind="' + s.kind + '", n=160, noise=0.15, seed=5)\nada = AdaBoost(n_estimators=' + s.M + ').fit(X, y)\n' +
      'm = ' + s.m + '\nprint(f"шаг {m}: ε = {ada.errors_[m - 1]:.3f}, α = {ada.alphas_[m - 1]:.3f}")\nprint("точность после m шагов:", (ada.predict(X, n_trees=m) == y).mean())\n'
    );
    fit();
  });
})();
