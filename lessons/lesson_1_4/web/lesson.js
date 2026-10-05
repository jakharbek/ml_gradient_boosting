/* Урок 1.4: смещение и разброс на 30 обучающих выборках. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('bias-variance', (el) => {
    const s = { model: 'tree', depth: 2, M: 20, noise: 0.35, n: 30, B: 30 };
    const w = ui.shell(el, {
      title: '30 обучающих выборок — 30 моделей',
      sub: 'Светлые линии — модели, обученные на разных выборках; синяя — их среднее; пунктир — истинная функция. Справа — разложение ошибки по сложности модели.',
    });
    ui.segmented(w.controls, { label: 'Модель', options: [{ value: 'tree', label: 'Дерево' }, { value: 'gb', label: 'Бустинг' }], value: s.model, onChange: (v) => ((s.model = v), sync(), draw()) });
    const depthCtl = ui.slider(w.controls, { label: 'Глубина дерева', min: 0, max: 10, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const mCtl = ui.slider(w.controls, { label: 'Деревьев в бустинге (глубина 2, ν = 0.3)', min: 1, max: 300, step: 1, value: s.M, format: String, onInput: (v) => ((s.M = v), draw()) });
    ui.slider(w.controls, { label: 'Шум σ', min: 0.05, max: 1, step: 0.05, value: s.noise, onInput: (v) => ((s.noise = v), (curveCache = null), draw()) });
    ui.slider(w.controls, { label: 'Объектов в выборке n', min: 10, max: 150, step: 5, value: s.n, format: String, onInput: (v) => ((s.n = v), (curveCache = null), draw()) });
    function sync() {
      depthCtl.el.hidden = s.model !== 'tree';
      mCtl.el.hidden = s.model !== 'gb';
      curveCache = null;
    }
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 320, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-2.2, 2.2] } });
    const p2 = new GBC.Plot(box, { height: 320, x: { label: 'сложность', type: 'linear' }, y: { label: 'ошибка' }, crosshair: true });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'b', label: 'Смещение²' }, { key: 'v', label: 'Разброс' }, { key: 'n', label: 'Шум σ²' }, { key: 't', label: 'Ожидаемая ошибка' }]);
    const grid = U.linspace(0, 10, 120);
    const gridX = grid.map((v) => [v]);
    const truth = grid.map(Math.sin);
    let curveCache = null;

    function fitAll(model, complexity) {
      const preds = [];
      for (let b = 1; b <= s.B; b++) {
        const d = GBC.datasets.regression1d({ kind: 'sine', n: s.n, noise: s.noise, seed: b });
        if (model === 'tree') {
          const t = new GBC.RegressionTree({ maxDepth: complexity }).fit(d.X, d.y.map((v) => -v));
          preds.push(gridX.map((x) => t.predictOne(x)));
        } else {
          const m = new GBC.GradientBoosting({ nEstimators: complexity, learningRate: 0.3, maxDepth: 2 }).fit(d.X, d.y);
          preds.push(m.predictRaw(gridX));
        }
      }
      return preds;
    }
    function decompose(preds) {
      const mean = grid.map((_, j) => U.mean(preds.map((p) => p[j])));
      const bias2 = U.mean(mean.map((m, j) => (m - truth[j]) ** 2));
      const variance = U.mean(grid.map((_, j) => U.mean(preds.map((p) => (p[j] - mean[j]) ** 2))));
      return { mean, bias2, variance };
    }
    function curve() {
      if (curveCache) return curveCache;
      const xs = s.model === 'tree' ? U.range(11) : [1, 2, 4, 7, 10, 15, 20, 30, 50, 80, 120, 180, 250, 300];
      const b = [];
      const v = [];
      for (const c of xs) {
        const r = decompose(fitAll(s.model, c));
        b.push(r.bias2);
        v.push(r.variance);
      }
      curveCache = { xs, b, v };
      return curveCache;
    }
    function draw() {
      const c = s.model === 'tree' ? s.depth : s.M;
      const preds = fitAll(s.model, c);
      const { mean, bias2, variance } = decompose(preds);
      const layers = preds.map((p) => ({ type: 'line', x: grid, y: p, color: 'model-prev', width: 1, opacity: 0.55, hover: false }));
      layers.push({ type: 'line', x: grid, y: truth, color: 'ink', dash: '5 4', width: 1.8, label: 'истинная f(x)' });
      layers.push({ type: 'line', x: grid, y: mean, color: 'model', width: 2.6, label: 'среднее моделей' });
      p1.render(layers);
      const cv = curve();
      const noise2 = s.noise * s.noise;
      p2.opts.x.label = s.model === 'tree' ? 'глубина дерева' : 'число деревьев';
      p2.render([
        { type: 'line', x: cv.xs, y: cv.b, color: 'blue', label: 'смещение²' },
        { type: 'line', x: cv.xs, y: cv.v, color: 'orange', label: 'разброс' },
        { type: 'line', x: cv.xs, y: cv.xs.map((_, i) => cv.b[i] + cv.v[i] + noise2), color: 'aqua', width: 2.6, label: 'ожидаемая ошибка' },
        { type: 'hline', y: noise2, color: 'muted', dash: '4 3', width: 1, text: 'шум σ²' },
        { type: 'vline', x: c, color: 'ink2', dash: '3 3', width: 1 },
      ], { y: [0, Math.max(...cv.b.map((b, i) => b + cv.v[i] + noise2)) * 1.05] });
      stats.set('b', U.fmt(bias2, 3));
      stats.set('v', U.fmt(variance, 3));
      stats.set('n', U.fmt(noise2, 3));
      stats.set('t', U.fmt(bias2 + variance + noise2, 3));
      note.innerHTML = bias2 > variance * 2
        ? 'Преобладает <b>смещение</b>: модели похожи друг на друга, но все одинаково не повторяют форму синуса. Это недообучение.'
        : variance > bias2 * 2
          ? 'Преобладает <b>разброс</b>: в среднем модели верны, но каждая подогнана под свой шум. Это переобучение.'
          : 'Смещение и разброс сбалансированы — около минимума ожидаемой ошибки.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, RegressionTree, GradientBoosting\n\ngrid = np.linspace(0, 10, 120).reshape(-1, 1)\ntruth = np.sin(grid[:, 0])\npreds = []\nfor seed in range(1, ' + (s.B + 1) + '):\n    X, y = datasets.regression_1d(kind="sine", n=' + s.n + ', noise=' + U.pyNum(s.noise) + ', seed=seed)\n' +
      (s.model === 'tree' ? '    model = RegressionTree(max_depth=' + s.depth + ').fit(X, -y)\n    preds.append(model.predict(grid))\n' : '    model = GradientBoosting(n_estimators=' + s.M + ', learning_rate=0.3, max_depth=2).fit(X, y)\n    preds.append(model.predict(grid))\n') +
      'preds = np.array(preds)\nbias2 = np.mean((preds.mean(0) - truth) ** 2)\nvariance = np.mean(preds.var(0))\nprint(f"смещение² = {bias2:.4f}, разброс = {variance:.4f}, шум = {' + U.pyNum(s.noise) + '**2:.4f}")\n'
    );
    sync();
    draw();
  });
})();
