/* =====================================================================================
 * Общие виджеты (не бустинг):
 *   loss-explorer — функции потерь L(r) и их антиградиенты (псевдо-остатки);
 *   tree-1d       — регрессионное дерево на одномерных данных + схема дерева.
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC;
  const U = GBC.util;
  const H = GBC.h;
  const ui = GBC.ui;

  /* =================================================================================
   * loss-explorer
   * ================================================================================= */
  GBC.widget('loss-explorer', (el, cfg) => {
    const state = Object.assign({ losses: ['squared', 'absolute', 'huber'], delta: 1, alpha: 0.8, rmax: 3 }, cfg);
    const all = [
      { key: 'squared', label: 'Квадратичная ½r²' },
      { key: 'absolute', label: 'Абсолютная |r|' },
      { key: 'huber', label: 'Хьюбер' },
      { key: 'quantile', label: 'Квантильная' },
    ];
    const colors = { squared: 'blue', absolute: 'orange', huber: 'aqua', quantile: 'yellow' };
    const w = ui.shell(el, {
      title: cfg.title || 'Функции потерь и их градиенты',
      sub: cfg.sub || 'Слева — сколько «стоит» ошибка r = y − F. Справа — псевдо-остаток −∂L/∂F: именно его будет предсказывать дерево.',
    });
    for (const l of all) {
      ui.toggle(w.controls, {
        label: l.label, checked: state.losses.includes(l.key),
        onChange: (v) => {
          state.losses = v ? state.losses.concat(l.key) : state.losses.filter((k) => k !== l.key);
          draw();
        },
      });
    }
    ui.slider(w.controls, { label: 'δ (Хьюбер)', min: 0.1, max: 3, step: 0.1, value: state.delta, onInput: (v) => ((state.delta = v), draw()) });
    ui.slider(w.controls, { label: 'α (квантиль)', min: 0.05, max: 0.95, step: 0.05, value: state.alpha, onInput: (v) => ((state.alpha = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 280, x: { label: 'остаток r = y − F', domain: [-state.rmax, state.rmax] }, y: { label: 'L(r)' }, crosshair: true, crosshairTitle: (v) => 'r = ' + U.fmt(v, 2) });
    const p2 = new GBC.Plot(box, { height: 280, x: { label: 'остаток r = y − F', domain: [-state.rmax, state.rmax] }, y: { label: '−∂L/∂F', domain: [-state.rmax, state.rmax] }, crosshair: true, crosshairTitle: (v) => 'r = ' + U.fmt(v, 2) });
    const note = w.note('', true);
    const rs = U.linspace(-state.rmax, state.rmax, 241);
    function draw() {
      const L1 = [];
      const L2 = [];
      for (const key of all.map((a) => a.key)) {
        if (!state.losses.includes(key)) continue;
        const loss = GBC.losses.get(key, { delta: state.delta, alpha: state.alpha });
        const zeros = rs.map(() => 0);
        const label = key === 'huber' ? 'Хьюбер δ=' + U.fmt(state.delta, 2) : key === 'quantile' ? 'квантильная α=' + U.fmt(state.alpha, 2) : all.find((a) => a.key === key).label;
        L1.push({ type: 'line', x: rs, y: loss.pointwise(rs, zeros), color: colors[key], label });
        L2.push({ type: 'line', x: rs, y: loss.negativeGradient(rs, zeros), color: colors[key], label });
      }
      p1.render(L1, { y: [0, (state.rmax * state.rmax) / 2 + 0.2] });
      p2.render([{ type: 'hline', y: 0, color: 'axis', width: 1 }, ...L2]);
      note.innerHTML = 'Квадратичная потеря растёт как r², поэтому её градиент (справа) растёт линейно: большая ошибка тянет модель сильно — выбросы «кричат». У абсолютной потери градиент равен ±1 при любой величине ошибки. Хьюбер ведёт себя как L2 при |r| ≤ δ и как L1 дальше.';
    }
    w.pythonAction(() =>
      'import matplotlib.pyplot as plt\nfrom gbcourse.plotting import use_course_style, plot_loss_functions\n\nuse_course_style()\nfig, ax = plt.subplots(figsize=(7, 4))\nplot_loss_functions(ax, names=' +
      JSON.stringify(state.losses).replace(/"/g, '"') + ', r_max=' + state.rmax + ', delta=' + U.pyNum(state.delta) + ', alpha=' + U.pyNum(state.alpha) + ')\nplt.show()\n'
    );
    draw();
  });

  /* =================================================================================
   * tree-1d
   * ================================================================================= */
  GBC.widget('tree-1d', (el, cfg) => {
    const ds = Object.assign({ kind: 'sine', n: 60, noise: 0.25, seed: 3 }, cfg.dataset || {});
    const tp = Object.assign({ maxDepth: 2, minSamplesLeaf: 1 }, cfg.tree || {});
    const controls = cfg.controls || ['dataset', 'depth', 'minleaf', 'noise'];
    const w = ui.shell(el, {
      title: cfg.title || 'Регрессионное дерево на одном признаке',
      sub: cfg.sub || 'Дерево режет ось x на отрезки и в каждом предсказывает среднее. Кликните по листу на схеме — подсветится его область.',
    });
    const refit = U.rafThrottle(() => fit());
    if (controls.includes('dataset'))
      ui.select(w.controls, {
        label: 'Данные',
        options: [{ value: 'sine', label: 'Синус' }, { value: 'step', label: 'Ступеньки' }, { value: 'wave', label: 'Волна' }, { value: 'linear', label: 'Прямая' }, { value: 'quadratic', label: 'Парабола' }],
        value: ds.kind, onChange: (v) => ((ds.kind = v), fit()),
      });
    if (controls.includes('noise')) ui.slider(w.controls, { label: 'Шум σ', min: 0, max: 1, step: 0.05, value: ds.noise, onInput: (v) => ((ds.noise = v), refit()) });
    if (controls.includes('n')) ui.slider(w.controls, { label: 'Объектов n', min: 10, max: 200, step: 5, value: ds.n, format: String, onInput: (v) => ((ds.n = v), refit()) });
    if (controls.includes('depth')) ui.slider(w.controls, { label: 'Максимальная глубина', min: 0, max: 8, step: 1, value: tp.maxDepth, format: String, onInput: (v) => ((tp.maxDepth = v), refit()) });
    if (controls.includes('minleaf')) ui.slider(w.controls, { label: 'Мин. объектов в листе', min: 1, max: 30, step: 1, value: tp.minSamplesLeaf, format: String, onInput: (v) => ((tp.minSamplesLeaf = v), refit()) });
    const plot = new GBC.Plot(w.main, {
      height: cfg.height || 280, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' },
      table: () => ({ columns: ['x', 'y', 'лист', 'прогноз'], rows: data.x.map((x, i) => [x, data.y[i], tree.applyOne([x]), tree.predictOne([x])]) }),
    });
    const tv = new GBC.TreeView(w.main, { featureNames: ['x'], valueFormat: (v) => U.fmt(v, 2), onNodeClick: (nd) => ((selected = nd.id), draw()) });
    const stats = ui.stats(w.foot, [
      { key: 'leaves', label: 'Листьев' },
      { key: 'depth', label: 'Глубина' },
      { key: 'mse', label: 'MSE на обучении' },
      { key: 'test', label: 'MSE на новых данных' },
    ]);
    let data;
    let test;
    let tree;
    let selected = null;
    function fit() {
      data = GBC.datasets.regression1d(ds);
      test = GBC.datasets.regression1d(Object.assign({}, ds, { seed: ds.seed + 1000, n: 400 }));
      tree = new GBC.RegressionTree({ maxDepth: tp.maxDepth, minSamplesLeaf: tp.minSamplesLeaf }).fit(data.X, data.y.map((v) => -v));
      selected = null;
      draw();
    }
    function draw() {
      const segs = tree.segments1d(0, 10);
      const selSeg = selected !== null ? segsOf(selected) : [];
      const leafOf = data.x.map((x) => tree.applyOne([x]));
      plot.render([
        ...selSeg.map((s) => ({ type: 'vband', x0: s.x0, x1: s.x1, color: 'accent', opacity: 0.1 })),
        { type: 'line', x: U.linspace(0, 10, 300), y: U.linspace(0, 10, 300).map((v) => GBC.datasets.trueFunction(ds.kind, v)), color: 'truth', dash: '5 4', width: 1.5, label: 'истинная f(x)', hover: false },
        {
          type: 'points', x: data.x, y: data.y, r: 3.6, label: 'данные',
          color: (i) => (selected !== null && tree.decisionPath([data.x[i]]).includes(selected) ? 'accent' : 'data'), legendColor: 'data',
          tooltip: (i) => [{ label: 'x', value: U.fmt(data.x[i], 3) }, { label: 'y', value: U.fmt(data.y[i], 3) }, { label: 'лист', value: '#' + leafOf[i] }],
        },
        { type: 'steps', segments: segs, color: 'model', width: 2.4, label: 'прогноз дерева' },
      ]);
      tv.render(tree, { highlight: selected !== null ? pathTo(selected) : [] });
      stats.set('leaves', String(tree.nLeaves));
      stats.set('depth', String(tree.depth));
      stats.set('mse', U.fmt(GBC.metrics.mse(data.y, tree.predict(data.X)), 4));
      stats.set('test', U.fmt(GBC.metrics.mse(test.y, tree.predict(test.X)), 4));
    }
    function pathTo(id) {
      const parent = {};
      tree.nodes.forEach((nd) => {
        if (nd.left >= 0) {
          parent[nd.left] = nd.id;
          parent[nd.right] = nd.id;
        }
      });
      const path = [id];
      while (parent[path[0]] !== undefined) path.unshift(parent[path[0]]);
      return path;
    }
    function segsOf(id) {
      // область узла на оси x — интервал, заданный порогами на пути
      let lo = 0;
      let hi = 10;
      const path = pathTo(id);
      for (let k = 0; k + 1 < path.length; k++) {
        const nd = tree.nodes[path[k]];
        if (path[k + 1] === nd.left) hi = Math.min(hi, nd.threshold);
        else lo = Math.max(lo, nd.threshold);
      }
      return [{ x0: lo, x1: hi }];
    }
    w.pythonAction(() =>
      'import matplotlib.pyplot as plt\nfrom gbcourse import datasets, RegressionTree\nfrom gbcourse.plotting import use_course_style, plot_data, plot_predict_1d, plot_tree\n\nuse_course_style()\n' +
      'X, y = ' + GBC.datasets.toPython('regression_1d', ds) + '\n' +
      '# Дерево на (g, h): g = −y, h = 1 → в листе среднее y\ntree = RegressionTree(max_depth=' + tp.maxDepth + ', min_samples_leaf=' + tp.minSamplesLeaf + ').fit(X, -y)\n\n' +
      'fig, ax = plt.subplots(figsize=(7, 3.6))\nplot_data(ax, X, y)\nplot_predict_1d(ax, tree.predict, X, label="прогноз дерева")\nax.legend()\nplt.show()\n\nplot_tree(tree, feature_names=["x"])\nplt.show()\nprint(tree.describe(["x"]))\n'
    );
    fit();
  });

  /* =================================================================================
   * tree-2d — дерево классификации на плоскости: прямоугольные области + схема
   * ================================================================================= */
  /** Прямоугольник области узла: ограничения порогов на пути от корня. */
  function nodeBox(tree, id, bounds) {
    const parent = {};
    tree.nodes.forEach((nd) => {
      if (nd.left >= 0) {
        parent[nd.left] = nd.id;
        parent[nd.right] = nd.id;
      }
    });
    const path = [id];
    while (parent[path[0]] !== undefined) path.unshift(parent[path[0]]);
    const box = { x0: bounds.x0, x1: bounds.x1, y0: bounds.y0, y1: bounds.y1 };
    for (let k = 0; k + 1 < path.length; k++) {
      const nd = tree.nodes[path[k]];
      const left = path[k + 1] === nd.left;
      if (nd.feature === 0) left ? (box.x1 = Math.min(box.x1, nd.threshold)) : (box.x0 = Math.max(box.x0, nd.threshold));
      else left ? (box.y1 = Math.min(box.y1, nd.threshold)) : (box.y0 = Math.max(box.y0, nd.threshold));
    }
    return { box, path };
  }
  GBC.nodeBox = nodeBox;

  GBC.widget('tree-2d', (el, cfg) => {
    const ds = Object.assign({ kind: 'moons', n: 160, noise: 0.25, seed: 4 }, cfg.dataset || {});
    const tp = Object.assign({ maxDepth: 2, minSamplesLeaf: 1 }, cfg.tree || {});
    const w = ui.shell(el, {
      title: cfg.title || 'Дерево классификации режет плоскость на прямоугольники',
      sub: cfg.sub || 'Каждое разбиение — вертикальная или горизонтальная линия. Цвет области — доля класса 1 в листе. Кликните по листу на схеме.',
    });
    const refit = U.rafThrottle(() => fit());
    ui.select(w.controls, {
      label: 'Данные',
      options: [{ value: 'moons', label: 'Луны' }, { value: 'blobs', label: 'Два облака' }, { value: 'xor', label: 'XOR' }, { value: 'circles', label: 'Круги' }, { value: 'linear', label: 'Наклонная граница' }],
      value: ds.kind, onChange: (v) => ((ds.kind = v), fit()),
    });
    ui.slider(w.controls, { label: 'Максимальная глубина', min: 0, max: 8, step: 1, value: tp.maxDepth, format: String, onInput: (v) => ((tp.maxDepth = v), refit()) });
    ui.slider(w.controls, { label: 'Мин. объектов в листе', min: 1, max: 30, step: 1, value: tp.minSamplesLeaf, format: String, onInput: (v) => ((tp.minSamplesLeaf = v), refit()) });
    ui.slider(w.controls, { label: 'Шум', min: 0, max: 0.8, step: 0.05, value: ds.noise, onInput: (v) => ((ds.noise = v), refit()) });
    const plot = new GBC.Plot(w.main, { height: cfg.height || 330, equal: true, x: { label: 'x_0' }, y: { label: 'x_1' }, grid: 'none' });
    const tv = new GBC.TreeView(w.main, {
      featureNames: ['x₀', 'x₁'], valueLabel: 'p(класс 1)', valueFormat: (v) => U.fmt(v, 2),
      leafColor: (v) => GBC.colors.proba()(v), onNodeClick: (nd) => ((sel = nd.id), draw()),
    });
    const stats = ui.stats(w.foot, [{ key: 'leaves', label: 'Листьев' }, { key: 'acc', label: 'Точность (обучение)' }, { key: 'test', label: 'Точность (новые данные)' }]);
    let data;
    let test;
    let tree;
    let bounds;
    let sel = null;
    function fit() {
      data = GBC.datasets.classification2d(ds);
      test = GBC.datasets.classification2d(Object.assign({}, ds, { seed: ds.seed + 500, n: 600 }));
      // Регрессионное дерево на метках 0/1: критерий = уменьшение дисперсии ≡ индекс Джини
      tree = new GBC.RegressionTree({ maxDepth: tp.maxDepth, minSamplesLeaf: tp.minSamplesLeaf }).fit(data.X, data.y.map((v) => -v));
      const [x0, x1] = U.extent(data.X.map((r) => r[0]));
      const [y0, y1] = U.extent(data.X.map((r) => r[1]));
      bounds = { x0: x0 - 0.3, x1: x1 + 0.3, y0: y0 - 0.3, y1: y1 + 0.3 };
      sel = null;
      draw();
    }
    function draw() {
      const pf = GBC.colors.proba();
      const layers = [];
      for (const lf of tree.leaves) {
        const { box } = nodeBox(tree, lf.id, bounds);
        layers.push({ type: 'rect', ...box, fill: GBC.colors.rgbString(pf(lf.value)), opacity: sel === lf.id ? 0.85 : 0.5, stroke: sel === lf.id ? 'ink' : 'surface', width: sel === lf.id ? 2 : 1 });
      }
      for (const c of [0, 1]) {
        const idx = data.y.map((v, i) => (v === c ? i : -1)).filter((i) => i >= 0);
        layers.push({
          type: 'points', x: idx.map((i) => data.X[i][0]), y: idx.map((i) => data.X[i][1]), color: 'class' + c, r: 4, shape: c ? 'square' : 'circle', label: 'класс ' + c,
          tooltip: (j) => [{ label: 'класс', value: String(c) }, { label: 'лист', value: '#' + tree.applyOne(data.X[idx[j]]) }],
        });
      }
      plot.render(layers, { x: [bounds.x0, bounds.x1], y: [bounds.y0, bounds.y1] });
      tv.render(tree, { highlight: sel !== null ? nodeBox(tree, sel, bounds).path : [] });
      const pred = (X) => X.map((x) => (tree.predictOne(x) > 0.5 ? 1 : 0));
      stats.set('leaves', String(tree.nLeaves));
      stats.set('acc', U.fmt(100 * GBC.metrics.accuracy(data.y, pred(data.X)), 1) + '%');
      stats.set('test', U.fmt(100 * GBC.metrics.accuracy(test.y, pred(test.X)), 1) + '%');
    }
    w.pythonAction(() =>
      'from sklearn.tree import DecisionTreeClassifier, export_text\nfrom gbcourse import datasets\n\nX, y = ' + GBC.datasets.toPython('classification_2d', ds) + '\n' +
      'clf = DecisionTreeClassifier(max_depth=' + tp.maxDepth + ', min_samples_leaf=' + tp.minSamplesLeaf + ', criterion="gini").fit(X, y)\n' +
      'print(export_text(clf, feature_names=["x0", "x1"]))\nprint("точность на обучении:", clf.score(X, y))\n'
    );
    fit();
  });
})(typeof window !== 'undefined' ? window : globalThis);
