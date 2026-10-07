/* Урок 1.4 — переобучение, смещение и разброс, валидация:
 *   complexity-curve — U-кривая: ошибка на обучении и на новых данных от сложности модели;
 *   dartboard        — мишень: смещение и разброс выстрелов, MSE = смещение² + разброс;
 *   bias-variance    — 30 обучающих выборок — 30 моделей: разложение ошибки по сложности;
 *   learning-curve   — кривые обучения: что даёт больше данных простой и сложной модели;
 *   averaging        — дисперсия среднего B моделей с корреляцией ρ: путь к бэггингу;
 *   early-stopping   — ранняя остановка бустинга по валидационной выборке;
 *   kfold            — k-блочная кросс-валидация: фолды, оценка и выбор глубины. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const mse = (y, p) => GBC.metrics.mse(y, p);

  /* =================================================================================
   * complexity-curve — U-кривая сложности
   * ================================================================================= */
  GBC.widget('complexity-curve', (el) => {
    const train = GBC.datasets.regression1d({ kind: 'sine', n: 40, noise: 0.35, seed: 2 });
    const test = GBC.datasets.regression1d({ kind: 'sine', n: 400, noise: 0.35, seed: 102 });
    const NOISE2 = 0.35 * 0.35;
    const M_VALUES = [1, 2, 3, 5, 8, 12, 20, 30, 50, 80, 120, 200, 300, 500];
    const s = { model: 'tree', depth: 3, M: 12, showTest: false };
    const w = ui.shell(el, {
      title: 'Сложность модели: обучение против новых данных',
      sub: 'Слева — 40 обучающих точек и модель. Справа — ошибка на этих точках (синяя) и на 400 новых (бирюзовая) для всех уровней сложности. Двигайте сложность и найдите дно бирюзовой кривой.',
    });
    ui.segmented(w.controls, { label: 'Модель', options: [{ value: 'tree', label: 'Дерево' }, { value: 'gb', label: 'Бустинг' }], value: s.model, onChange: (v) => ((s.model = v), sync(), draw()) });
    const dCtl = ui.slider(w.controls, { label: 'Глубина дерева', min: 0, max: 12, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const mCtl = ui.slider(w.controls, { label: 'Деревьев M (глубина 2, ν = 0.3)', values: M_VALUES, value: s.M, format: String, onInput: (v) => ((s.M = v), draw()) });
    ui.toggle(w.controls, { label: 'Показать новые точки', checked: s.showTest, onChange: (v) => ((s.showTest = v), draw()) });
    function sync() {
      dCtl.el.hidden = s.model !== 'tree';
      mCtl.el.hidden = s.model !== 'gb';
    }
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-2, 2] } });
    const p2 = new GBC.Plot(box, { height: 300, x: { label: 'глубина дерева' }, y: { label: 'MSE' }, crosshair: true });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'tr', label: 'MSE на обучении' }, { key: 'te', label: 'MSE на новых данных' }, { key: 'best', label: 'Лучшая сложность' }, { key: 'diag', label: 'Диагноз' }]);
    const grid = U.linspace(0, 10, 500);
    const gridX = grid.map((v) => [v]);
    const trees = {};
    const treeOf = (d) => trees[d] || (trees[d] = new GBC.RegressionTree({ maxDepth: d }).fit(train.X, train.y.map((v) => -v)));
    const c0 = U.mean(train.y);
    const predTree = (d, X) => (d === 0 ? X.map(() => c0) : treeOf(d).predict(X));
    let gb = null;
    const gbm = () => gb || (gb = new GBC.GradientBoosting({ nEstimators: 500, learningRate: 0.3, maxDepth: 2 }).fit(train.X, train.y));
    let curves = null;
    function allCurves() {
      if (curves) return curves;
      const tree = { xs: U.range(13), tr: [], te: [] };
      for (const d of tree.xs) {
        tree.tr.push(mse(train.y, predTree(d, train.X)));
        tree.te.push(mse(test.y, predTree(d, test.X)));
      }
      const g = gbm();
      const boost = { xs: M_VALUES, tr: M_VALUES.map((m) => mse(train.y, g.predictRaw(train.X, m))), te: M_VALUES.map((m) => mse(test.y, g.predictRaw(test.X, m))) };
      curves = { tree, boost };
      return curves;
    }
    function draw() {
      const C = allCurves();
      const isTree = s.model === 'tree';
      const cur = isTree ? C.tree : C.boost;
      const c = isTree ? s.depth : s.M;
      const idx = cur.xs.indexOf(c);
      const fn = isTree ? predTree(s.depth, gridX) : gbm().predictRaw(gridX, s.M);
      const layers = [];
      if (s.showTest) layers.push({ type: 'points', x: test.x, y: test.y, color: 'test', r: 2.2, opacity: 0.5, label: 'новые точки' });
      layers.push({ type: 'line', x: grid, y: grid.map(Math.sin), color: 'truth', dash: '5 4', width: 1.6, label: 'истина' });
      layers.push({ type: 'points', x: train.x, y: train.y, color: 'data', r: 4.2, label: 'обучение' });
      layers.push({ type: 'line', x: grid, y: fn, color: 'model', width: 2.4, curve: 'step', label: 'модель' });
      p1.render(layers);
      const bestI = U.argmax(cur.te.map((v) => -v));
      p2.opts.x = Object.assign({}, p2.opts.x, isTree ? { label: 'глубина дерева', type: 'linear', domain: [0, 12] } : { label: 'число деревьев M (лог. шкала)', type: 'log', domain: [1, 500] });
      p2.render([
        { type: 'hline', y: NOISE2, color: 'ink2', dash: '4 3', width: 1, text: 'шум σ²' },
        { type: 'line', x: cur.xs, y: cur.tr, color: 'train', width: 2.2, label: 'обучение' },
        { type: 'points', x: cur.xs, y: cur.tr, color: 'train', r: 3, legend: false },
        { type: 'line', x: cur.xs, y: cur.te, color: 'test', width: 2.2, label: 'новые данные' },
        { type: 'points', x: cur.xs, y: cur.te, color: 'test', r: 3, legend: false },
        { type: 'vline', x: cur.xs[bestI], color: 'test', dash: '2 3', width: 1.2 },
        { type: 'vline', x: c, color: 'ink', dash: '4 3', width: 1.4 },
      ], { y: [0, Math.max(...cur.te, ...cur.tr) * 1.08] });
      const tr = cur.tr[idx];
      const te = cur.te[idx];
      const diag = idx < bestI ? 'недообучение' : idx > bestI && te > cur.te[bestI] * 1.08 ? 'переобучение' : 'близко к лучшему';
      stats.set('tr', U.fmt(tr, 4));
      stats.set('te', U.fmt(te, 4));
      stats.set('best', (isTree ? 'глубина ' : 'M = ') + cur.xs[bestI] + ' (' + U.fmt(cur.te[bestI], 3) + ')');
      stats.set('diag', diag);
      note.innerHTML = {
        'недообучение': '<b>Недообучение</b> (underfitting): модель слишком проста и ошибается одинаково плохо и на обучении (' + U.fmt(tr, 3) + '), и на новых данных (' + U.fmt(te, 3) + '). Закономерность не уловлена — усложняйте.',
        'переобучение': '<b>Переобучение</b> (overfitting): на обучении ошибка ' + U.fmt(tr, 3) + (tr < NOISE2 ? ' — <b>ниже уровня шума</b> σ² = 0.1225, то есть модель выучила сам шум' : '') + ', а на новых данных ' + U.fmt(te, 3) + ' — хуже, чем у лучшей сложности. Упрощайте или останавливайтесь раньше.',
        'близко к лучшему': 'Около дна U-кривой: ошибка на новых данных ' + U.fmt(te, 3) + ' близка к минимальной. Ошибка на обучении при этом всё ещё падает дальше — по ней одной дно не найти.',
      }[diag];
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, RegressionTree, GBRegressor\nfrom gbcourse.metrics import mse\n\n' +
      'X, y = datasets.regression_1d(kind="sine", n=40, noise=0.35, seed=2)\nXt, yt = datasets.regression_1d(kind="sine", n=400, noise=0.35, seed=102)\n\n' +
      'for d in range(1, 13):\n    t = RegressionTree(max_depth=d).fit(X, -y)\n    print(f"глубина {d:2d}: обучение {mse(y, t.predict(X)):.4f}   новые {mse(yt, t.predict(Xt)):.4f}")\n\n' +
      'gb = GBRegressor(n_estimators=500, learning_rate=0.3, max_depth=2).fit(X, y)\nfor M in ' + JSON.stringify(M_VALUES) + ':\n    print(f"M = {M:3d}: обучение {mse(y, gb.predict(X, n_iter=M)):.4f}   новые {mse(yt, gb.predict(Xt, n_iter=M)):.4f}")\n'
    );
    sync();
    draw();
  });

  /* =================================================================================
   * dartboard — смещение и разброс на мишени
   * ================================================================================= */
  GBC.widget('dartboard', (el) => {
    const N = 30;
    const s = { bias: 1.2, spread: 0.35, seed: 1 };
    const w = ui.shell(el, {
      title: 'Мишень: смещение и разброс',
      sub: 'Каждая точка — «выстрел»: прогноз модели, обученной на своей выборке. Центр мишени — правильный ответ. Квадратик — средний выстрел. Средний квадрат промаха раскладывается на две части.',
    });
    const bCtl = ui.slider(w.controls, { label: 'Смещение (сдвиг прицела)', min: 0, max: 2, step: 0.05, value: s.bias, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.bias = v), draw()) });
    const sCtl = ui.slider(w.controls, { label: 'Разброс (дрожание руки)', min: 0.05, max: 1.5, step: 0.05, value: s.spread, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.spread = v), draw()) });
    const presets = H('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' } });
    w.controls.appendChild(presets);
    const set = (b, sp) => ((s.bias = b), (s.spread = sp), bCtl.set(b), sCtl.set(sp), draw());
    ui.button(presets, { label: 'мало / мало', small: true, title: 'низкое смещение, низкий разброс', onClick: () => set(0.1, 0.25) });
    ui.button(presets, { label: 'мало / много', small: true, title: 'низкое смещение, высокий разброс', onClick: () => set(0.1, 1.1) });
    ui.button(presets, { label: 'много / мало', small: true, title: 'высокое смещение, низкий разброс', onClick: () => set(1.4, 0.25) });
    ui.button(presets, { label: 'много / много', small: true, title: 'высокое смещение, высокий разброс', onClick: () => set(1.4, 1.1) });
    const hint = H('div', { class: 'ctl-help' }, 'Подписи: смещение / разброс.');
    w.controls.appendChild(hint);
    ui.button(w.controls, { label: 'Новые выстрелы', small: true, kind: 'primary', onClick: () => ((s.seed += 1), draw()) });
    const plot = new GBC.Plot(w.main, { height: 340, equal: true, grid: 'none', x: { label: '', domain: [-3, 3] }, y: { label: '', domain: [-3, 3] } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'b2', label: 'Смещение²' }, { key: 'v', label: 'Разброс' }, { key: 'sum', label: 'Смещение² + разброс' }, { key: 'mse', label: 'Средний квадрат промаха' }]);
    const angle = (35 * Math.PI) / 180;
    const circle = (r) => {
      const t = U.linspace(0, 2 * Math.PI, 120);
      return { x: t.map((a) => r * Math.cos(a)), y: t.map((a) => r * Math.sin(a)) };
    };
    function draw() {
      const rng = new GBC.RNG(s.seed);
      const mu = [s.bias * Math.cos(angle), s.bias * Math.sin(angle)];
      const shots = U.range(N).map(() => [mu[0] + (s.spread / Math.SQRT2) * rng.normal(), mu[1] + (s.spread / Math.SQRT2) * rng.normal()]);
      const mean = [U.mean(shots.map((p) => p[0])), U.mean(shots.map((p) => p[1]))];
      const b2 = mean[0] ** 2 + mean[1] ** 2;
      const v = U.mean(shots.map((p) => (p[0] - mean[0]) ** 2 + (p[1] - mean[1]) ** 2));
      const m = U.mean(shots.map((p) => p[0] ** 2 + p[1] ** 2));
      const layers = [];
      [2.5, 1.5, 0.6].forEach((r, i) => layers.push({ type: 'polygon', ...circle(r), fill: i === 2 ? 'accent' : 'surface', opacity: i === 2 ? 0.18 : 1, stroke: 'axis', width: 1.2 }));
      layers.push({ type: 'points', x: [0], y: [0], color: 'ink', r: 3, label: 'правильный ответ' });
      layers.push({ type: 'segments', x1: shots.map((p) => p[0]), y1: shots.map((p) => p[1]), x2: shots.map(() => mean[0]), y2: shots.map(() => mean[1]), color: 'model-prev', width: 1, opacity: 0.5 });
      layers.push({ type: 'points', x: shots.map((p) => p[0]), y: shots.map((p) => p[1]), color: 'model', r: 4, label: 'выстрелы (модели)', tooltip: (i) => [{ label: 'промах²', value: U.fmt(shots[i][0] ** 2 + shots[i][1] ** 2, 3) }] });
      if (b2 > 1e-4) layers.push({ type: 'arrows', x1: [0], y1: [0], x2: [mean[0]], y2: [mean[1]], color: 'tree', width: 2.4 });
      layers.push({ type: 'points', x: [mean[0]], y: [mean[1]], color: 'tree', r: 6, shape: 'square', label: 'средний выстрел' });
      plot.render(layers);
      stats.set('b2', U.fmt(b2, 3));
      stats.set('v', U.fmt(v, 3));
      stats.set('sum', U.fmt(b2 + v, 3));
      stats.set('mse', U.fmt(m, 3));
      const hiB = s.bias >= 0.6;
      const hiV = s.spread >= 0.6;
      note.innerHTML = (hiB ? (hiV ? 'Плохо во всём: прицел сбит и рука дрожит.' : '<b>Высокое смещение, низкий разброс:</b> выстрелы кучные, но систематически мимо — так ведёт себя слишком простая модель.') : hiV ? '<b>Низкое смещение, высокий разброс:</b> в среднем в центр, но каждый выстрел далеко — так ведёт себя слишком гибкая модель, подогнанная под свою выборку.' : 'Идеал: кучно и в центр.') +
        ' Оранжевая стрелка — смещение (от центра до среднего выстрела), светлые отрезки — разброс вокруг среднего. Проверьте: ' + U.fmt(b2, 3) + ' + ' + U.fmt(v, 3) + ' = ' + U.fmt(m, 3) + '.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\nrng = Mulberry32(' + s.seed + ')\nbias, spread = ' + U.pyNum(s.bias) + ', ' + U.pyNum(s.spread) + '\nmu = bias * np.array([np.cos(np.radians(35)), np.sin(np.radians(35))])\n' +
      'shots = np.array([[mu[0] + spread / np.sqrt(2) * rng.normal(), mu[1] + spread / np.sqrt(2) * rng.normal()] for _ in range(' + N + ')])\n' +
      'mean = shots.mean(axis=0)\nbias2 = np.sum(mean ** 2)                              # смещение²\nvariance = np.mean(np.sum((shots - mean) ** 2, axis=1))  # разброс\nmse = np.mean(np.sum(shots ** 2, axis=1))              # средний квадрат промаха\n' +
      'print(f"смещение² {bias2:.4f} + разброс {variance:.4f} = {bias2 + variance:.4f};  MSE = {mse:.4f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * bias-variance — 30 обучающих выборок — 30 моделей
   * ================================================================================= */
  GBC.widget('bias-variance', (el) => {
    const s = { model: 'tree', depth: 2, M: 20, noise: 0.35, n: 30, B: 30 };
    const w = ui.shell(el, {
      title: '30 обучающих выборок — 30 моделей',
      sub: 'Светлые линии — модели, обученные на разных выборках; синяя — их среднее; пунктир — истинная функция. Справа — разложение ошибки по сложности модели.',
    });
    ui.segmented(w.controls, { label: 'Модель', options: [{ value: 'tree', label: 'Дерево' }, { value: 'gb', label: 'Бустинг' }], value: s.model, onChange: (v) => ((s.model = v), sync(), draw()) });
    const depthCtl = ui.slider(w.controls, { label: 'Глубина дерева', min: 0, max: 10, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const mCtl = ui.slider(w.controls, { label: 'Деревьев в бустинге (глубина 2, ν = 0.3)', min: 1, max: 300, step: 1, value: s.M, format: String, onInput: (v) => ((s.M = v), draw()) });
    ui.slider(w.controls, { label: 'Шум σ', min: 0.05, max: 1, step: 0.05, value: s.noise, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.noise = v), (curveCache = null), draw()) });
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
          if (complexity === 0) {
            const c = U.mean(d.y);
            preds.push(gridX.map(() => c));
            continue;
          }
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
      'import numpy as np\nfrom gbcourse import datasets, RegressionTree, GBRegressor\n\ngrid = np.linspace(0, 10, 120).reshape(-1, 1)\ntruth = np.sin(grid[:, 0])\npreds = []\nfor seed in range(1, ' + (s.B + 1) + '):\n    X, y = datasets.regression_1d(kind="sine", n=' + s.n + ', noise=' + U.pyNum(s.noise) + ', seed=seed)\n' +
      (s.model === 'tree' ? '    model = RegressionTree(max_depth=' + Math.max(1, s.depth) + ').fit(X, -y)\n    preds.append(model.predict(grid))\n' : '    model = GBRegressor(n_estimators=' + s.M + ', learning_rate=0.3, max_depth=2).fit(X, y)\n    preds.append(model.predict(grid))\n') +
      'preds = np.array(preds)\nbias2 = np.mean((preds.mean(0) - truth) ** 2)\nvariance = np.mean(preds.var(0))\nprint(f"смещение² = {bias2:.4f}, разброс = {variance:.4f}, шум = {' + U.pyNum(s.noise) + '**2:.4f}")\n'
    );
    sync();
    draw();
  });

  /* =================================================================================
   * learning-curve — что даёт больше данных
   * ================================================================================= */
  GBC.widget('learning-curve', (el) => {
    const NS = [10, 15, 20, 30, 40, 60, 80, 120, 160, 240, 320];
    const SEEDS = 10;
    const NOISE2 = 0.35 * 0.35;
    const test = GBC.datasets.regression1d({ kind: 'sine', n: 500, noise: 0.35, seed: 999 });
    const s = { depth: 8 };
    const w = ui.shell(el, {
      title: 'Кривые обучения: что даёт больше данных',
      sub: 'Для каждого размера выборки n обучаем дерево на 10 разных выборках и усредняем ошибку на обучении и на 500 новых точках. Сравните простое дерево и сложное.',
    });
    const dCtl = ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 10, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const presets = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(presets);
    for (const d of [1, 3, 8]) ui.button(presets, { label: 'Глубина ' + d, small: true, onClick: () => ((s.depth = d), dCtl.set(d), draw()) });
    const plot = new GBC.Plot(w.main, {
      height: 300, x: { label: 'объектов в обучающей выборке n (лог. шкала)', type: 'log', domain: [10, 320] }, y: { label: 'MSE' }, crosshair: true, crosshairTitle: (v) => 'n ≈ ' + Math.round(v),
      table: () => {
        const C = curves(s.depth);
        return { columns: ['n', 'MSE обучение', 'MSE новые', 'разрыв'], rows: NS.map((n, i) => [n, C.tr[i], C.te[i], C.te[i] - C.tr[i]]) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'tr', label: 'Обучение при n = 320' }, { key: 'te', label: 'Новые данные при n = 320' }, { key: 'gap', label: 'Разрыв при n = 20 → 320' }]);
    const cache = {};
    function curves(d) {
      if (cache[d]) return cache[d];
      const tr = [];
      const te = [];
      for (const n of NS) {
        let a = 0;
        let b = 0;
        for (let sd = 1; sd <= SEEDS; sd++) {
          const data = GBC.datasets.regression1d({ kind: 'sine', n, noise: 0.35, seed: sd });
          const t = new GBC.RegressionTree({ maxDepth: d }).fit(data.X, data.y.map((v) => -v));
          a += mse(data.y, t.predict(data.X));
          b += mse(test.y, t.predict(test.X));
        }
        tr.push(a / SEEDS);
        te.push(b / SEEDS);
      }
      cache[d] = { tr, te };
      return cache[d];
    }
    function draw() {
      const C = curves(s.depth);
      plot.render([
        { type: 'hline', y: NOISE2, color: 'ink2', dash: '4 3', width: 1, text: 'шум σ² = 0.1225' },
        { type: 'area', x: NS, y0: C.tr, y1: C.te, color: 'test', opacity: 0.1 },
        { type: 'line', x: NS, y: C.tr, color: 'train', width: 2.2, label: 'обучение' },
        { type: 'points', x: NS, y: C.tr, color: 'train', r: 3, legend: false },
        { type: 'line', x: NS, y: C.te, color: 'test', width: 2.2, label: 'новые данные' },
        { type: 'points', x: NS, y: C.te, color: 'test', r: 3, legend: false },
      ], { y: [0, Math.max(0.65, ...C.te) * 1.05] });
      const last = NS.length - 1;
      stats.set('tr', U.fmt(C.tr[last], 3));
      stats.set('te', U.fmt(C.te[last], 3));
      stats.set('gap', U.fmt(C.te[2] - C.tr[2], 3) + ' → ' + U.fmt(C.te[last] - C.tr[last], 3));
      note.innerHTML = s.depth <= 2
        ? '<b>Простая модель (высокое смещение):</b> кривые быстро сходятся и упираются в «потолок» ошибки ~' + U.fmt(C.te[last], 2) + ', далеко над шумом. Больше данных почти не помогает — нужна более гибкая модель.'
        : '<b>Гибкая модель (высокий разброс):</b> на малых выборках огромный разрыв между обучением и новыми данными — модель запоминает. С ростом n обучающая ошибка растёт, а ошибка на новых падает: разброс уменьшается, и больше данных — лучшее лекарство.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, RegressionTree\nfrom gbcourse.metrics import mse\n\nXt, yt = datasets.regression_1d(kind="sine", n=500, noise=0.35, seed=999)\n' +
      'for n in ' + JSON.stringify(NS) + ':\n    tr, te = [], []\n    for seed in range(1, ' + (SEEDS + 1) + '):\n        X, y = datasets.regression_1d(kind="sine", n=n, noise=0.35, seed=seed)\n' +
      '        t = RegressionTree(max_depth=' + s.depth + ').fit(X, -y)\n        tr.append(mse(y, t.predict(X)))\n        te.append(mse(yt, t.predict(Xt)))\n' +
      '    print(f"n = {n:3d}: обучение {np.mean(tr):.3f}   новые {np.mean(te):.3f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * averaging — дисперсия среднего коррелированных моделей
   * ================================================================================= */
  GBC.widget('averaging', (el) => {
    const REPS = 60;
    const s = { B: 10, rho: 0.3 };
    const w = ui.shell(el, {
      title: 'Усреднение моделей: насколько уменьшается разброс',
      sub: 'Прогноз каждой модели = правда + случайная ошибка с разбросом σ² = 1. Ошибки разных моделей коррелированы с коэффициентом ρ (они учились на похожих данных). Насколько спокойнее среднее B моделей?',
    });
    ui.slider(w.controls, { label: 'Моделей в среднем B', min: 1, max: 100, step: 1, value: s.B, format: String, onInput: (v) => ((s.B = v), draw()) });
    ui.slider(w.controls, { label: 'Корреляция ошибок ρ', min: 0, max: 1, step: 0.05, value: s.rho, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.rho = v), draw()) });
    const top = new GBC.Plot(w.main, { height: 150, x: { label: 'ошибка прогноза', domain: [-3.5, 3.5] }, y: { domain: [-0.6, 1.6], ticks: [0, 1], format: (v) => (v > 0.5 ? 'одна модель' : 'среднее B') }, grid: 'x', margin: { left: 92 } });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'моделей в среднем B (лог. шкала)', type: 'log', domain: [1, 100] }, y: { label: 'разброс среднего', domain: [0, 1.05] }, crosshair: true, crosshairTitle: (v) => 'B ≈ ' + Math.round(v) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'f', label: 'Формула ρ + (1 − ρ)/B' }, { key: 'sim', label: 'Симуляция' }, { key: 'floor', label: 'Предел при B → ∞' }]);
    const Bs = [1, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70, 100];
    /** Средние ошибки REPS повторов для B моделей: общая часть √ρ·z₀ + индивидуальные √(1−ρ)·z_b. */
    function simulate(B, reps, seed) {
      const rng = new GBC.RNG(seed);
      const single = [];
      const avg = [];
      for (let r = 0; r < reps; r++) {
        const common = Math.sqrt(s.rho) * rng.normal();
        let sum = 0;
        let first = 0;
        for (let b = 0; b < B; b++) {
          const e = common + Math.sqrt(1 - s.rho) * rng.normal();
          if (b === 0) first = e;
          sum += e;
        }
        single.push(first);
        avg.push(sum / B);
      }
      return { single, avg };
    }
    function draw() {
      const S = simulate(s.B, REPS, 5);
      top.render([
        { type: 'vline', x: 0, color: 'axis', width: 1 },
        { type: 'points', x: S.single, y: S.single.map((_, i) => 1 + ((i % 5) - 2) * 0.09), color: 'model-prev', r: 3.4 },
        { type: 'points', x: S.avg, y: S.avg.map((_, i) => ((i % 5) - 2) * 0.09), color: 'model', r: 3.4 },
      ]);
      const formula = (B) => s.rho + (1 - s.rho) / B;
      const grid = U.linspace(0, 2, 200).map((t) => Math.pow(10, t));
      const sims = Bs.map((B) => U.variance(simulate(B, 400, 11).avg));
      plot.render([
        { type: 'hline', y: s.rho, color: 'ink2', dash: '4 3', width: 1.2, text: 'предел ρ = ' + U.fmt(s.rho, 2) },
        { type: 'line', x: grid, y: grid.map(formula), color: 'model', width: 2.2, label: 'формула ρσ² + (1 − ρ)σ²/B' },
        { type: 'points', x: Bs, y: sims, color: 'tree', r: 4, label: 'симуляция (400 повторов)' },
        { type: 'vline', x: s.B, color: 'ink', dash: '3 3', width: 1.2 },
      ]);
      const simB = U.variance(simulate(s.B, 400, 11).avg);
      stats.set('f', U.fmt(formula(s.B), 3));
      stats.set('sim', U.fmt(simB, 3));
      stats.set('floor', U.fmt(s.rho, 2));
      note.innerHTML = 'Среднее B <b>независимых</b> моделей (ρ = 0) колеблется в B раз меньше одной модели. Но ошибки моделей, обученных на похожих данных, коррелированы, и общая часть ρσ² <b>не усредняется</b>: сколько моделей ни бери, разброс не опустится ниже ' + U.fmt(s.rho, 2) + '. ' +
        'Поэтому бэггинг уменьшает разброс, а случайный лес вдобавок «развязывает» деревья, давая каждому узлу случайные признаки (урок 3.1). На смещение усреднение не влияет: среднее смещённых моделей смещено так же.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\nrho = ' + U.pyNum(s.rho) + '\nrng = Mulberry32(11)\nfor B in ' + JSON.stringify(Bs) + ':\n    avg = []\n    for _ in range(400):\n        common = np.sqrt(rho) * rng.normal()\n' +
      '        avg.append(np.mean([common + np.sqrt(1 - rho) * rng.normal() for _ in range(B)]))\n    print(f"B = {B:3d}: симуляция {np.var(avg):.3f}   формула {rho + (1 - rho) / B:.3f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * early-stopping — ранняя остановка бустинга
   * ================================================================================= */
  GBC.widget('early-stopping', (el) => {
    const all = GBC.datasets.regression1d({ kind: 'sine', n: 300, noise: 0.4, seed: 7 });
    const sp = GBC.datasets.trainTestSplit(all.X, all.y, 0.3, 0);
    const test = GBC.datasets.regression1d({ kind: 'sine', n: 500, noise: 0.4, seed: 107 });
    const MAXM = 500;
    const s = { nu: 0.1, depth: 2, patience: 30 };
    const w = ui.shell(el, {
      title: 'Ранняя остановка бустинга',
      sub: 'Бустинг учится на 210 точках, а ещё 90 отложены как валидационные. Деревья добавляются, пока ошибка на валидации улучшается; если она не улучшилась за «терпение» итераций — стоп, и берём лучшую итерацию. Бирюзовая кривая — честная проверка на 500 новых точках.',
    });
    ui.slider(w.controls, { label: 'Темп ν', min: 0.02, max: 1, log: true, value: s.nu, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.nu = v), refit()) });
    ui.slider(w.controls, { label: 'Глубина деревьев', min: 1, max: 5, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), refit()) });
    ui.slider(w.controls, { label: 'Терпение (итераций без улучшения)', min: 5, max: 100, step: 5, value: s.patience, format: String, onInput: (v) => ((s.patience = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-2.2, 2.2] } });
    const p2 = new GBC.Plot(box, { height: 300, x: { label: 'итерация (лог. шкала)', type: 'log', domain: [1, MAXM] }, y: { label: 'MSE' }, crosshair: true, crosshairTitle: (v) => 'итерация ' + Math.round(v) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'best', label: 'Лучшая итерация по валидации' }, { key: 'stop', label: 'Остановились на' }, { key: 'te', label: 'Новые данные: при остановке' }, { key: 'te500', label: '… и после 500 деревьев' }]);
    const grid = U.linspace(0, 10, 400);
    const gridX = grid.map((v) => [v]);
    let model = null;
    let curves = null;
    function fit() {
      model = new GBC.GradientBoosting({ nEstimators: MAXM, learningRate: s.nu, maxDepth: s.depth }).fit(sp.Xtrain, sp.ytrain);
      const ctr = new GBC.StageCache(model, sp.Xtrain);
      const cva = new GBC.StageCache(model, sp.Xtest);
      const cte = new GBC.StageCache(model, test.X);
      const tr = [];
      const va = [];
      const te = [];
      for (let m = 0; m <= MAXM; m++) {
        tr.push(mse(sp.ytrain, Array.from(ctr.seek(m))));
        va.push(mse(sp.ytest, Array.from(cva.seek(m))));
        te.push(mse(test.y, Array.from(cte.seek(m))));
      }
      curves = { tr, va, te };
    }
    const refit = U.rafThrottle(() => (fit(), draw()));
    function draw() {
      if (!model) fit();
      const { tr, va, te } = curves;
      // ранняя остановка с терпением
      let best = 0;
      let stop = MAXM;
      for (let m = 1; m <= MAXM; m++) {
        if (va[m] < va[best] - 1e-12) best = m;
        else if (m - best >= s.patience) {
          stop = m;
          break;
        }
      }
      const ms = U.range(MAXM, 1);
      p1.render([
        { type: 'points', x: sp.Xtrain.map((r) => r[0]), y: sp.ytrain, color: 'data', r: 2.6, opacity: 0.55, label: 'обучение' },
        { type: 'line', x: grid, y: grid.map(Math.sin), color: 'truth', dash: '5 4', width: 1.4, label: 'истина' },
        { type: 'line', x: grid, y: model.predictRaw(gridX, MAXM), color: 'model-prev', width: 1.6, curve: 'step', label: 'после 500 деревьев' },
        { type: 'line', x: grid, y: model.predictRaw(gridX, best), color: 'model', width: 2.4, curve: 'step', label: 'ранняя остановка: ' + best },
      ]);
      p2.render([
        { type: 'vband', x0: best, x1: Math.max(best + 1, stop), color: 'tree', opacity: 0.08 },
        { type: 'line', x: ms, y: tr.slice(1), color: 'train', width: 2, label: 'обучение' },
        { type: 'line', x: ms, y: va.slice(1), color: 'valid', width: 2, label: 'валидация' },
        { type: 'line', x: ms, y: te.slice(1), color: 'test', width: 2, dash: '5 3', label: 'новые данные' },
        { type: 'vline', x: Math.max(1, best), color: 'valid', width: 1.4, text: 'лучшая' },
        { type: 'vline', x: stop, color: 'ink2', dash: '3 3', width: 1.2 },
      ], { y: [0, Math.max(...va.slice(1, 60), ...te.slice(1, 60)) * 1.05] });
      stats.set('best', String(best));
      stats.set('stop', stop === MAXM ? MAXM + ' (не остановились)' : String(stop));
      stats.set('te', U.fmt(te[best], 4));
      stats.set('te500', U.fmt(te[MAXM], 4));
      const teBest = U.argmax(te.map((v) => -v));
      note.innerHTML = 'Ошибка на обучении падает всегда, а на валидации — до итерации ' + best + ', потом растёт: дальше деревья учат шум. Останавливаемся на итерации ' + stop + ' (ещё ' + s.patience + ' без улучшения) и возвращаемся к лучшей. ' +
        'На новых данных это ' + U.fmt(te[best], 3) + ' против ' + U.fmt(te[MAXM], 3) + ' после всех 500 деревьев; лучшее, что вообще было возможно, — ' + U.fmt(te[teBest], 3) + ' (итерация ' + teBest + '). ' +
        (s.nu >= 0.5 ? 'С большим ν минимум наступает за считанные итерации и очень острый — легко проскочить.' : 'Чем меньше ν, тем позже и «площе» минимум — остановка надёжнее, но нужно больше деревьев.');
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, GBRegressor\nfrom gbcourse.metrics import mse\n\nX, y = datasets.regression_1d(kind="sine", n=300, noise=0.4, seed=7)\nX_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=0)\nXt, yt = datasets.regression_1d(kind="sine", n=500, noise=0.4, seed=107)\n\n' +
      'gb = GBRegressor(n_estimators=' + MAXM + ', learning_rate=' + U.pyNum(s.nu) + ', max_depth=' + s.depth + ', early_stopping_rounds=' + s.patience + ')\ngb.fit(X_tr, y_tr, eval_set=(X_val, y_val))\n' +
      'print("лучшая итерация:", gb.best_iteration_, "  деревьев оставлено:", gb.n_trees_)\nprint("MSE на новых данных:", mse(yt, gb.predict(Xt)))\n\n' +
      'full = GBRegressor(n_estimators=' + MAXM + ', learning_rate=' + U.pyNum(s.nu) + ', max_depth=' + s.depth + ').fit(X_tr, y_tr)\nprint("без остановки (500 деревьев):", mse(yt, full.predict(Xt)))\n'
    );
    draw();
  });

  /* =================================================================================
   * kfold — k-блочная кросс-валидация
   * ================================================================================= */
  GBC.widget('kfold', (el) => {
    const N = 80;
    const data = GBC.datasets.regression1d({ kind: 'sine', n: N, noise: 0.4, seed: 7 });
    const test = GBC.datasets.regression1d({ kind: 'sine', n: 400, noise: 0.4, seed: 107 });
    const perm = new GBC.RNG(0).permutation(N);
    const DEPTHS = U.range(10, 1);
    const s = { k: 5, depth: 4, fold: 0 };
    const w = ui.shell(el, {
      title: 'k-блочная кросс-валидация',
      sub: 'Данные перемешиваются и делятся на k блоков (фолдов). Сверху — k раундов: в каждом один блок (оранжевый) — проверка, остальные (синие) — обучение. Снизу — оценка CV для каждой глубины дерева и, для сравнения, ошибка на 400 новых точках.',
    });
    ui.slider(w.controls, { label: 'Число блоков k', min: 2, max: 10, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), (cache = null), draw()) });
    ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 10, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const top = new GBC.Plot(w.main, { height: 190, x: { label: 'объекты (по возрастанию x)', domain: [-1, N] }, y: { label: '', domain: [0.4, 10.6] }, grid: 'none', margin: { left: 70 } });
    const bottom = new GBC.Plot(w.main, { height: 260, x: { label: 'глубина дерева', domain: [0.5, 10.5] }, y: { label: 'MSE' }, crosshair: true, crosshairTitle: (v) => 'глубина ' + Math.round(v) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'cv', label: 'CV-оценка (среднее ± ст. откл.)' }, { key: 'te', label: 'Новые данные' }, { key: 'pick', label: 'Глубина по CV / по новым' }]);
    const order = U.argsort(data.x);
    const rankOf = new Array(N);
    order.forEach((i, r) => (rankOf[i] = r));
    let cache = null;
    /** Номер блока каждого объекта: perm[j], perm[j + k], … → блок j. */
    function foldsOf(k) {
      const f = new Array(N);
      perm.forEach((i, pos) => (f[i] = pos % k));
      return f;
    }
    function compute() {
      if (cache) return cache;
      const f = foldsOf(s.k);
      const res = DEPTHS.map((d) => {
        const scores = [];
        for (let j = 0; j < s.k; j++) {
          const tr = [];
          const va = [];
          for (let i = 0; i < N; i++) (f[i] === j ? va : tr).push(i);
          const t = new GBC.RegressionTree({ maxDepth: d }).fit(tr.map((i) => data.X[i]), tr.map((i) => -data.y[i]));
          scores.push(mse(va.map((i) => data.y[i]), t.predict(va.map((i) => data.X[i]))));
        }
        const full = new GBC.RegressionTree({ maxDepth: d }).fit(data.X, data.y.map((v) => -v));
        const m = U.mean(scores);
        return { scores, mean: m, std: Math.sqrt(U.variance(scores)), test: mse(test.y, full.predict(test.X)) };
      });
      cache = { f, res };
      return cache;
    }
    function draw() {
      const C = compute();
      const layers = [];
      for (let j = 0; j < s.k; j++) {
        const row = s.k - j;
        const xs = U.range(N).map((i) => rankOf[i]);
        layers.push({ type: 'points', x: xs, y: xs.map(() => row), color: (i) => (C.f[i] === j ? 'valid' : 'train'), r: (i) => (C.f[i] === j ? 3.4 : 2.2), shape: 'square' });
      }
      top.opts.y = Object.assign({}, top.opts.y, { domain: [0.4, s.k + 0.6], ticks: U.range(s.k, 1), format: (v) => 'раунд ' + (s.k - Math.round(v) + 1) });
      top.render(layers);
      const R = C.res;
      const mean = R.map((r) => r.mean);
      const lo = R.map((r) => r.mean - r.std);
      const hi = R.map((r) => r.mean + r.std);
      const cur = R[s.depth - 1];
      const pickCV = DEPTHS[U.argmax(mean.map((v) => -v))];
      const pickTest = DEPTHS[U.argmax(R.map((r) => -r.test))];
      bottom.render([
        { type: 'area', x: DEPTHS, y0: lo, y1: hi, color: 'valid', opacity: 0.12 },
        { type: 'line', x: DEPTHS, y: mean, color: 'valid', width: 2.2, label: 'CV: среднее по блокам' },
        { type: 'points', x: cur.scores.map(() => s.depth), y: cur.scores, color: 'valid', r: 3.2, hollow: true, label: 'оценки отдельных блоков' },
        { type: 'line', x: DEPTHS, y: R.map((r) => r.test), color: 'test', width: 2, dash: '5 3', label: 'новые данные' },
        { type: 'vline', x: pickCV, color: 'valid', dash: '2 3', width: 1.2 },
        { type: 'vline', x: s.depth, color: 'ink', dash: '4 3', width: 1.2 },
      ], { y: [0, Math.max(...hi, ...R.map((r) => r.test)) * 1.08] });
      stats.set('cv', U.fmt(cur.mean, 3) + ' ± ' + U.fmt(cur.std, 3));
      stats.set('te', U.fmt(cur.test, 3));
      stats.set('pick', pickCV + ' / ' + pickTest);
      note.innerHTML = 'Каждый объект ровно один раз побывал в проверке и ' + (s.k - 1) + ' раз — в обучении. CV-оценка — среднее ' + s.k + ' чисел, поэтому устойчивее одного разбиения, но её разброс по блокам (' + U.fmt(cur.std, 3) + ') напоминает: это тоже оценка, а не истина. ' +
        'По CV лучшая глубина ' + pickCV + ', по новым данным — ' + pickTest + (pickCV === pickTest ? ': совпали.' : ': близко, но не обязательно совпадает.') + ' Обучение в k раз дороже — это плата за надёжность.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, RegressionTree\nfrom gbcourse.metrics import mse\nfrom gbcourse.rng import Mulberry32\n\n' +
      'X, y = datasets.regression_1d(kind="sine", n=80, noise=0.4, seed=7)\nperm = Mulberry32(0).permutation(len(y))\nk = ' + s.k + '\nfold = np.empty(len(y), dtype=int)\nfold[perm] = np.arange(len(y)) % k        # блок j: perm[j], perm[j + k], …\n\n' +
      'for depth in range(1, 11):\n    scores = []\n    for j in range(k):\n        tr, va = fold != j, fold == j\n        tree = RegressionTree(max_depth=depth).fit(X[tr], -y[tr])\n        scores.append(mse(y[va], tree.predict(X[va])))\n' +
      '    print(f"глубина {depth:2d}: CV = {np.mean(scores):.3f} ± {np.std(scores):.3f}")\n'
    );
    draw();
  });
})();
