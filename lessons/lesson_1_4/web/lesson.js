/* Урок 1.4 — переобучение, смещение и разброс, валидация:
 *   complexity-curve — U-кривая: ошибка на обучении и на новых данных от сложности модели;
 *   optimism         — почему ошибка на обучении занижена: разрыв 2pσ²/n, «эффективные параметры» дерева;
 *   shrink           — один лист, одно число: сжатие c·ȳ меняет смещение на разброс, λ* = σ²/μ²;
 *   dartboard        — мишень: смещение и разброс выстрелов, MSE = смещение² + разброс;
 *   bias-variance    — 30 обучающих выборок — 30 моделей: разложение ошибки по сложности и по точкам x;
 *   learning-curve   — кривые обучения: что даёт больше данных простой и сложной модели;
 *   averaging        — дисперсия среднего B моделей с корреляцией ρ: путь к бэггингу;
 *   early-stopping   — ранняя остановка бустинга по валидационной выборке;
 *   split-lottery    — оценка и выбор глубины по одному разбиению против кросс-валидации;
 *   kfold            — k-блочная кросс-валидация: фолды, оценка, выбор глубины, правило одной ст. ошибки;
 *   leakage          — отбор признаков до кросс-валидации находит закономерность в чистом шуме;
 *   time-split       — временной ряд: случайные блоки против проверки по времени. */
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
    const s = { model: 'tree', depth: 2, M: 20, noise: 0.35, n: 30, B: 30, view: 'complexity' };
    const w = ui.shell(el, {
      title: '30 обучающих выборок — 30 моделей',
      sub: 'Светлые линии — модели, обученные на разных выборках; синяя — их среднее; пунктир — истинная функция. Справа — разложение ошибки: по сложности модели или по точкам x для текущей модели.',
    });
    ui.segmented(w.controls, { label: 'Справа', options: [{ value: 'complexity', label: 'По сложности' }, { value: 'points', label: 'По точкам x' }], value: s.view, onChange: (v) => ((s.view = v), draw()) });
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
      const noise2 = s.noise * s.noise;
      if (s.view === 'points') {
        const b2x = mean.map((m, j) => (m - truth[j]) ** 2);
        const vx = grid.map((_, j) => U.mean(preds.map((p) => (p[j] - mean[j]) ** 2)));
        p2.opts.x = Object.assign({}, p2.opts.x, { label: 'x', domain: [0, 10] });
        p2.render([
          { type: 'area', x: grid, y0: grid.map(() => 0), y1: b2x, color: 'blue', opacity: 0.12 },
          { type: 'line', x: grid, y: b2x, color: 'blue', label: 'смещение²(x)' },
          { type: 'line', x: grid, y: vx, color: 'orange', label: 'разброс(x)' },
          { type: 'hline', y: noise2, color: 'muted', dash: '4 3', width: 1, text: 'шум σ²' },
        ], { y: [0, Math.max(0.3, ...b2x, ...vx) * 1.05] });
      } else {
      const cv = curve();
      p2.opts.x = Object.assign({}, p2.opts.x, { label: s.model === 'tree' ? 'глубина дерева' : 'число деревьев', domain: undefined });
      p2.render([
        { type: 'line', x: cv.xs, y: cv.b, color: 'blue', label: 'смещение²' },
        { type: 'line', x: cv.xs, y: cv.v, color: 'orange', label: 'разброс' },
        { type: 'line', x: cv.xs, y: cv.xs.map((_, i) => cv.b[i] + cv.v[i] + noise2), color: 'aqua', width: 2.6, label: 'ожидаемая ошибка' },
        { type: 'hline', y: noise2, color: 'muted', dash: '4 3', width: 1, text: 'шум σ²' },
        { type: 'vline', x: c, color: 'ink2', dash: '3 3', width: 1 },
      ], { y: [0, Math.max(...cv.b.map((b, i) => b + cv.v[i] + noise2)) * 1.05] });
      }
      stats.set('b', U.fmt(bias2, 3));
      stats.set('v', U.fmt(variance, 3));
      stats.set('n', U.fmt(noise2, 3));
      stats.set('t', U.fmt(bias2 + variance + noise2, 3));
      note.innerHTML = (bias2 > variance * 2
        ? 'Преобладает <b>смещение</b>: модели похожи друг на друга, но все одинаково не повторяют форму синуса. Это недообучение.'
        : variance > bias2 * 2
          ? 'Преобладает <b>разброс</b>: в среднем модели верны, но каждая подогнана под свой шум. Это переобучение.'
          : 'Смещение и разброс сбалансированы — около минимума ожидаемой ошибки.') +
        (s.view === 'points' ? ' Числа внизу — средние этих кривых по x. Смещение копится там, где модель не успевает за изгибом функции, разброс — там, где «гуляют» пороги разбиений и где мало точек (у краёв).' : '');
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
    const stats = ui.stats(w.foot, [{ key: 'cv', label: 'CV-оценка (среднее ± ст. откл.)' }, { key: 'te', label: 'Новые данные' }, { key: 'pick', label: 'Глубина по CV / по новым' }, { key: 'se', label: 'Правило одной ст. ошибки' }]);
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
      // правило одной стандартной ошибки: самая простая модель не хуже лучшей + ст. откл./√k
      const bestR = R[pickCV - 1];
      const thr = bestR.mean + bestR.std / Math.sqrt(s.k);
      const pick1se = DEPTHS[R.findIndex((r) => r.mean <= thr)];
      bottom.render([
        { type: 'area', x: DEPTHS, y0: lo, y1: hi, color: 'valid', opacity: 0.12 },
        { type: 'line', x: DEPTHS, y: mean, color: 'valid', width: 2.2, label: 'CV: среднее по блокам' },
        { type: 'points', x: cur.scores.map(() => s.depth), y: cur.scores, color: 'valid', r: 3.2, hollow: true, label: 'оценки отдельных блоков' },
        { type: 'line', x: DEPTHS, y: R.map((r) => r.test), color: 'test', width: 2, dash: '5 3', label: 'новые данные' },
        { type: 'hline', y: thr, color: 'ink2', dash: '2 3', width: 1, text: 'лучшая CV + 1 ст. ошибка' },
        { type: 'vline', x: pickCV, color: 'valid', dash: '2 3', width: 1.2 },
        { type: 'vline', x: s.depth, color: 'ink', dash: '4 3', width: 1.2 },
      ], { y: [0, Math.max(...hi, ...R.map((r) => r.test)) * 1.08] });
      stats.set('cv', U.fmt(cur.mean, 3) + ' ± ' + U.fmt(cur.std, 3));
      stats.set('te', U.fmt(cur.test, 3));
      stats.set('pick', pickCV + ' / ' + pickTest);
      stats.set('se', 'глубина ' + pick1se + ' (порог ' + U.fmt(thr, 3) + ')');
      note.innerHTML = 'Каждый объект ровно один раз побывал в проверке и ' + (s.k - 1) + ' раз — в обучении. CV-оценка — среднее ' + s.k + ' чисел, поэтому устойчивее одного разбиения, но её разброс по блокам (' + U.fmt(cur.std, 3) + ') напоминает: это тоже оценка, а не истина. ' +
        'По CV лучшая глубина ' + pickCV + ', по новым данным — ' + pickTest + (pickCV === pickTest ? ': совпали.' : ': близко, но не обязательно совпадает.') + ' Обучение в k раз дороже — это плата за надёжность. Правило одной стандартной ошибки берёт самую простую модель, чья оценка не выше порога «лучшая + ст. откл./√k»: здесь это глубина ' + pick1se + '.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, RegressionTree\nfrom gbcourse.metrics import mse\nfrom gbcourse.rng import Mulberry32\n\n' +
      'X, y = datasets.regression_1d(kind="sine", n=80, noise=0.4, seed=7)\nperm = Mulberry32(0).permutation(len(y))\nk = ' + s.k + '\nfold = np.empty(len(y), dtype=int)\nfold[perm] = np.arange(len(y)) % k        # блок j: perm[j], perm[j + k], …\n\n' +
      'for depth in range(1, 11):\n    scores = []\n    for j in range(k):\n        tr, va = fold != j, fold == j\n        tree = RegressionTree(max_depth=depth).fit(X[tr], -y[tr])\n        scores.append(mse(y[va], tree.predict(X[va])))\n' +
      '    print(f"глубина {depth:2d}: CV = {np.mean(scores):.3f} ± {np.std(scores):.3f}")\n'
    );
    draw();
  });
  /* =================================================================================
   * optimism — почему ошибка на обучении занижена: разрыв 2pσ²/n
   * ================================================================================= */
  GBC.widget('optimism', (el) => {
    const N = 40;
    const SIMS = 200;
    const xs = U.range(N).map((i) => ((i + 0.5) * 10) / N);
    const X = xs.map((v) => [v]);
    const f = xs.map(Math.sin);
    // нормальные числа один раз: для каждой выборки сначала N для обучения, потом N «новых» в тех же x
    const rng = new GBC.RNG(1);
    const E1 = [];
    const E2 = [];
    for (let r = 0; r < SIMS; r++) {
      E1.push(U.range(N).map(() => rng.normal()));
      E2.push(U.range(N).map(() => rng.normal()));
    }
    const s = { model: 'bins', p: 8, depth: 3, sigma: 0.35, shown: 0 };
    const w = ui.shell(el, {
      title: 'Насколько ошибка на обучении занижена',
      sub: '40 точек в фиксированных x, y = sin x + шум. Модель подгоняется под обучающий шум (синие точки), а проверяется на новом шуме в тех же x (бирюзовые кольца). Справа — средние по 200 выборкам ошибки и разрыв между ними.',
    });
    ui.segmented(w.controls, { label: 'Модель', options: [{ value: 'bins', label: 'p корзин' }, { value: 'tree', label: 'Дерево' }], value: s.model, onChange: (v) => ((s.model = v), sync(), draw()) });
    const pCtl = ui.slider(w.controls, { label: 'Корзин (параметров) p', min: 1, max: N, step: 1, value: s.p, format: String, onInput: (v) => ((s.p = v), draw()) });
    const dCtl = ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 12, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    ui.slider(w.controls, { label: 'Шум σ', min: 0.1, max: 1, step: 0.05, value: s.sigma, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.sigma = v), (cache = {}), draw()) });
    ui.button(w.controls, { label: 'Другая выборка', small: true, onClick: () => ((s.shown = (s.shown + 1) % SIMS), draw()) });
    function sync() {
      pCtl.el.hidden = s.model !== 'bins';
      dCtl.el.hidden = s.model !== 'tree';
    }
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-2.2, 2.2] } });
    const p2 = new GBC.Plot(box, { height: 300, x: { label: 'параметров p' }, y: { label: 'MSE' }, crosshair: true });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'tr', label: 'Обучение (среднее)' }, { key: 'te', label: 'Новый шум (среднее)' }, { key: 'gap', label: 'Разрыв' }, { key: 'f', label: 'Формула 2pσ²/n' }, { key: 'eff', label: 'Эффективных параметров' }]);
    const binsPredict = (y, p) => {
      const sum = new Array(p).fill(0);
      const cnt = new Array(p).fill(0);
      const bin = (i) => Math.floor((i * p) / N);
      for (let i = 0; i < N; i++) {
        sum[bin(i)] += y[i];
        cnt[bin(i)] += 1;
      }
      return U.range(N).map((i) => sum[bin(i)] / cnt[bin(i)]);
    };
    const treeFit = (y, d) => new GBC.RegressionTree({ maxDepth: d }).fit(X, y.map((v) => -v));
    const sample = (r, E) => f.map((v, i) => v + s.sigma * E[r][i]);
    const leavesOf = (pred) => new Set(pred).size;
    let cache = {};
    /** Средние по SIMS выборкам: ошибка на обучении, на новом шуме и число листьев (для дерева). */
    function curve(model) {
      if (cache[model]) return cache[model];
      const xsC = model === 'bins' ? U.range(N, 1) : U.range(12, 1);
      const tr = [];
      const te = [];
      const leaves = [];
      for (const c of xsC) {
        let a = 0;
        let b = 0;
        let l = 0;
        for (let r = 0; r < SIMS; r++) {
          const y = sample(r, E1);
          const y2 = sample(r, E2);
          const pred = model === 'bins' ? binsPredict(y, c) : treeFit(y, c).predict(X);
          a += mse(y, pred);
          b += mse(y2, pred);
          l += model === 'bins' ? c : leavesOf(pred);
        }
        tr.push(a / SIMS);
        te.push(b / SIMS);
        leaves.push(l / SIMS);
      }
      cache[model] = { xs: xsC, tr, te, leaves };
      return cache[model];
    }
    function draw() {
      const isBins = s.model === 'bins';
      const C = curve(s.model);
      const c = isBins ? s.p : s.depth;
      const i = C.xs.indexOf(c);
      const s2 = s.sigma * s.sigma;
      const y = sample(s.shown, E1);
      const y2 = sample(s.shown, E2);
      const pred = isBins ? binsPredict(y, s.p) : treeFit(y, s.depth).predict(X);
      const grid = U.linspace(0, 10, 300);
      // ступенчатая модель на сетке: значение ближайшей обучающей точки
      const fgrid = grid.map((g) => pred[U.clamp(Math.floor((g * N) / 10), 0, N - 1)]);
      p1.render([
        { type: 'line', x: grid, y: grid.map(Math.sin), color: 'truth', dash: '5 4', width: 1.4, label: 'истина' },
        { type: 'points', x: xs, y: y2, color: 'test', r: 3.6, hollow: true, label: 'новый шум' },
        { type: 'points', x: xs, y, color: 'train', r: 3.6, label: 'обучение' },
        { type: 'line', x: grid, y: fgrid, color: 'model', width: 2.4, curve: 'step', label: 'модель' },
      ]);
      const gap = C.te.map((v, k) => v - C.tr[k]);
      const formula = C.leaves.map((l) => (2 * l * s2) / N);
      p2.opts.x = Object.assign({}, p2.opts.x, isBins ? { label: 'параметров (корзин) p', domain: [1, N] } : { label: 'глубина дерева', domain: [1, 12] });
      p2.render([
        { type: 'hline', y: s2, color: 'ink2', dash: '4 3', width: 1, text: 'шум σ²' },
        { type: 'line', x: C.xs, y: C.tr, color: 'train', width: 2.2, label: 'обучение' },
        { type: 'line', x: C.xs, y: C.te, color: 'test', width: 2.2, label: 'новый шум' },
        { type: 'line', x: C.xs, y: formula, color: 'ink2', dash: '5 3', width: 1.6, label: isBins ? 'формула 2pσ²/n' : '2·(листьев)·σ²/n' },
        { type: 'points', x: C.xs, y: gap, color: 'tree', r: 3.2, label: 'разрыв (симуляция)' },
        { type: 'vline', x: c, color: 'ink', dash: '3 3', width: 1.2 },
      ], { y: [0, Math.max(...C.te, 2 * s2) * 1.08] });
      const eff = (gap[i] * N) / (2 * s2);
      stats.set('tr', U.fmt(C.tr[i] < 1e-6 ? 0 : C.tr[i], 3));
      stats.set('te', U.fmt(C.te[i], 3));
      stats.set('gap', U.fmt(gap[i], 3));
      stats.set('f', U.fmt(formula[i], 3));
      stats.set('eff', U.fmt(eff, 1) + (isBins ? '' : ' (листьев ' + U.fmt(C.leaves[i], 1) + ')'));
      note.innerHTML = isBins
        ? 'Модель из ' + s.p + ' корзин — среднее в каждой корзине — подбирает ' + s.p + ' чисел. Разрыв между новым шумом и обучением ' + U.fmt(gap[i], 3) + ' совпадает с формулой 2pσ²/n = ' + U.fmt(formula[i], 3) + ': каждый параметр «съедает» кусочек обучающего шума и занижает ошибку на обучении на σ²/n, а на новых данных этот кусочек добавляется к ошибке. При p = n = 40 модель проходит через все точки: обучение 0, новые данные 2σ² = ' + U.fmt(2 * s2, 3) + '.'
        : 'Листьев у дерева глубины ' + s.depth + ' в среднем ' + U.fmt(C.leaves[i], 1) + ', но разрыв ' + U.fmt(gap[i], 3) + ' — как у модели с ' + U.fmt(eff, 1) + ' параметрами. Дерево не просто считает средние в листьях — оно <b>выбирает пороги, глядя на ответы</b>, и этот выбор тоже подгоняется под шум. Поэтому «эффективных» параметров больше, чем листьев; только при глубине, когда в каждом листе одна точка, они сравниваются (40 и 40).';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import RegressionTree\nfrom gbcourse.metrics import mse\nfrom gbcourse.rng import Mulberry32\n\n' +
      'n, sims, sigma = ' + N + ', ' + SIMS + ', ' + U.pyNum(s.sigma) + '\nx = (np.arange(n) + 0.5) * 10 / n\nX, f = x.reshape(-1, 1), np.sin(x)\nrng = Mulberry32(1)\n' +
      'E1, E2 = [], []\nfor _ in range(sims):                      # обучающий шум и новый шум в тех же x\n    E1.append([rng.normal() for _ in range(n)])\n    E2.append([rng.normal() for _ in range(n)])\nE1, E2 = np.array(E1), np.array(E2)\n\n' +
      (s.model === 'bins'
        ? 'def bins_predict(y, p):\n    b = (np.arange(n) * p) // n                # номер корзины каждой точки\n    means = np.bincount(b, y) / np.bincount(b)\n    return means[b]\n\nfor p in (1, 2, 4, 8, 16, 40):\n    tr = np.mean([mse(f + sigma * E1[r], bins_predict(f + sigma * E1[r], p)) for r in range(sims)])\n    te = np.mean([mse(f + sigma * E2[r], bins_predict(f + sigma * E1[r], p)) for r in range(sims)])\n    print(f"p = {p:2d}: обучение {tr:.3f}  новый шум {te:.3f}  разрыв {te - tr:.3f}  формула {2 * p * sigma**2 / n:.3f}")\n'
        : 'for depth in range(1, 13):\n    tr, te, leaves = [], [], []\n    for r in range(sims):\n        y, y2 = f + sigma * E1[r], f + sigma * E2[r]\n        pred = RegressionTree(max_depth=depth).fit(X, -y).predict(X)\n        tr.append(mse(y, pred)); te.append(mse(y2, pred)); leaves.append(len(np.unique(pred)))\n' +
          '    gap = np.mean(te) - np.mean(tr)\n    print(f"глубина {depth:2d}: листьев {np.mean(leaves):4.1f}  разрыв {gap:.3f}  эффективных параметров {gap * n / (2 * sigma**2):4.1f}")\n')
    );
    sync();
    draw();
  });

  /* =================================================================================
   * shrink — оценка одного числа: сжатие c·ȳ меняет смещение на разброс
   * ================================================================================= */
  GBC.widget('shrink', (el) => {
    const R = 60;
    const LMAX = 30;
    const s = { lambda: 0, mu: 1, sigma: 2, n: 4, seed: 1 };
    const w = ui.shell(el, {
      title: 'Один лист, одно число: сжатие оценки',
      sub: 'В лист попало n объектов, их остатки = μ + шум с разбросом σ². Значение листа — среднее остатков, сжатое к нулю: c·ȳ, где c = n / (n + λ). Каждая точка сверху — значение листа по своему набору из n объектов (60 наборов). Снизу — точные формулы для всех λ.',
    });
    const lCtl = ui.slider(w.controls, { label: 'Сжатие λ', min: 0, max: LMAX, step: 0.5, value: s.lambda, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.lambda = v), draw()) });
    ui.slider(w.controls, { label: 'Истинное среднее μ', min: 0, max: 2, step: 0.1, value: s.mu, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.mu = v), draw()) });
    ui.slider(w.controls, { label: 'Шум σ', min: 0.5, max: 4, step: 0.25, value: s.sigma, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.sigma = v), draw()) });
    ui.slider(w.controls, { label: 'Объектов в листе n', min: 1, max: 30, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const btns = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(btns);
    ui.button(btns, { label: 'Лучшее λ', small: true, kind: 'primary', onClick: () => {
      const best = s.mu > 0 ? Math.min(LMAX, (s.sigma * s.sigma) / (s.mu * s.mu)) : LMAX;
      s.lambda = Math.round(best * 2) / 2;
      lCtl.set(s.lambda);
      draw();
    } });
    ui.button(btns, { label: 'Новые наборы', small: true, onClick: () => ((s.seed += 1), draw()) });
    const top = new GBC.Plot(w.main, { height: 160, x: { label: 'значение листа' }, y: { domain: [-0.6, 1.6], ticks: [0, 1], format: (v) => (v > 0.5 ? 'λ = 0' : 'сжатое') }, grid: 'x', margin: { left: 70 } });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'сжатие λ', domain: [0, LMAX] }, y: { label: 'ошибка значения листа' }, crosshair: true, crosshairTitle: (v) => 'λ ≈ ' + U.fmt(v, 1) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'c', label: 'c = n/(n + λ)' }, { key: 'b2', label: 'Смещение²' }, { key: 'v', label: 'Разброс' }, { key: 'm', label: 'Ошибка (формула)' }, { key: 'sim', label: 'Ошибка (60 наборов)' }, { key: 'best', label: 'Лучшее λ* = σ²/μ²' }]);
    const parts = (lam) => {
      const c = s.n / (s.n + lam);
      const b2 = ((1 - c) * s.mu) ** 2;
      const v = (c * c * s.sigma * s.sigma) / s.n;
      return { c, b2, v, m: b2 + v };
    };
    function draw() {
      const rng = new GBC.RNG(s.seed);
      const means = U.range(R).map(() => U.mean(U.range(s.n).map(() => s.mu + s.sigma * rng.normal())));
      const P = parts(s.lambda);
      const shr = means.map((m) => P.c * m);
      const half = 3.2 * s.sigma / Math.sqrt(s.n);
      top.opts.x = Object.assign({}, top.opts.x, { domain: [Math.min(-0.3, s.mu - half), s.mu + half] });
      const jit = (i) => ((i % 5) - 2) * 0.09;
      top.render([
        { type: 'vline', x: 0, color: 'axis', width: 1 },
        { type: 'vline', x: s.mu, color: 'ink', dash: '4 3', width: 1.4, text: 'μ' },
        { type: 'points', x: means, y: means.map((_, i) => 1 + jit(i)), color: 'model-prev', r: 3.4 },
        { type: 'points', x: shr, y: shr.map((_, i) => jit(i)), color: 'model', r: 3.4 },
        { type: 'points', x: [U.mean(means), U.mean(shr)], y: [1, 0], color: 'tree', r: 6, shape: 'square' },
      ]);
      const L = U.linspace(0, LMAX, 241);
      const C = L.map(parts);
      const best = s.mu > 0 ? (s.sigma * s.sigma) / (s.mu * s.mu) : Infinity;
      const layers = [
        { type: 'line', x: L, y: C.map((q) => q.b2), color: 'blue', label: 'смещение²' },
        { type: 'line', x: L, y: C.map((q) => q.v), color: 'orange', label: 'разброс' },
        { type: 'line', x: L, y: C.map((q) => q.m), color: 'aqua', width: 2.6, label: 'ошибка = смещение² + разброс' },
        { type: 'vline', x: s.lambda, color: 'ink', dash: '3 3', width: 1.2 },
      ];
      if (best <= LMAX) layers.push({ type: 'points', x: [best], y: [parts(best).m], color: 'aqua', r: 5, label: 'минимум' });
      plot.render(layers, { y: [0, Math.max(parts(0).m, s.mu * s.mu) * 1.08] });
      const sim = U.mean(shr.map((v) => (v - s.mu) ** 2));
      const P0 = parts(0);
      stats.set('c', U.fmt(P.c, 3));
      stats.set('b2', U.fmt(P.b2, 3));
      stats.set('v', U.fmt(P.v, 3));
      stats.set('m', U.fmt(P.m, 3));
      stats.set('sim', U.fmt(sim, 3));
      stats.set('best', Number.isFinite(best) ? U.fmt(best, 2) + ' (c* = ' + U.fmt(s.n / (s.n + best), 2) + ')' : '∞ (μ = 0)');
      const better = P.m < P0.m - 1e-9;
      note.innerHTML = (s.lambda === 0
        ? 'Без сжатия значение листа <b>несмещённое</b>: в среднем попадает в μ (квадратик стоит на пунктире), но разброс σ²/n = ' + U.fmt(P0.v, 3) + ' велик — в листе всего ' + s.n + ' объект' + (s.n === 1 ? '' : s.n < 5 ? 'а' : 'ов') + '. Подвиньте λ.'
        : 'Сжатие на c = ' + U.fmt(P.c, 2) + ' сдвинуло средний ответ к нулю (смещение² ' + U.fmt(P.b2, 3) + ') и сузило облако точек (разброс ' + U.fmt(P.v, 3) + ' вместо ' + U.fmt(P0.v, 3) + '). ' +
          (better ? 'Итог <b>лучше</b> несмещённой оценки: ' + U.fmt(P.m, 3) + ' против ' + U.fmt(P0.m, 3) + '.' : 'Итог <b>хуже</b> несмещённой оценки: ' + U.fmt(P.m, 3) + ' против ' + U.fmt(P0.m, 3) + ' — сжали слишком сильно.')) +
        ' Лучшее сжатие λ* = σ²/μ² = ' + (Number.isFinite(best) ? U.fmt(best, 2) : '∞') + ': чем шумнее остатки и чем слабее сигнал, тем сильнее выгодно сжимать. Так устроен штраф λ на значения листьев в XGBoost (урок 8.2).';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\nmu, sigma, n, lam = ' + U.pyNum(s.mu) + ', ' + U.pyNum(s.sigma) + ', ' + s.n + ', ' + U.pyNum(s.lambda) + '\nc = n / (n + lam)\n\n' +
      'rng = Mulberry32(' + s.seed + ')\nmeans = np.array([np.mean([mu + sigma * rng.normal() for _ in range(n)]) for _ in range(' + R + ')])\nleaf = c * means                               # значения листа по 60 наборам\n\n' +
      'print(f"формула:  смещение² {((1 - c) * mu) ** 2:.3f} + разброс {c**2 * sigma**2 / n:.3f} = {((1 - c) * mu) ** 2 + c**2 * sigma**2 / n:.3f}")\n' +
      'print(f"симуляция: средний квадрат ошибки {np.mean((leaf - mu) ** 2):.3f}")\nprint(f"лучшее λ* = σ²/μ² = {sigma**2 / mu**2:.2f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * split-lottery — оценка и выбор по одному разбиению против кросс-валидации
   * ================================================================================= */
  GBC.widget('split-lottery', (el) => {
    const N = 80;
    const S = 40;
    const DEPTHS = U.range(8, 1);
    const data = GBC.datasets.regression1d({ kind: 'sine', n: N, noise: 0.4, seed: 7 });
    const test = GBC.datasets.regression1d({ kind: 'sine', n: 400, noise: 0.4, seed: 107 });
    const perms = U.range(S, 1).map((sd) => new GBC.RNG(sd).permutation(N));
    const s = { frac: 0.25, depth: 4 };
    const w = ui.shell(el, {
      title: 'Лотерея разбиения',
      sub: 'Одни и те же 80 точек 40 раз случайно делим на обучение и валидацию (или на 5 блоков для CV) и оцениваем деревья глубины 1–8. Сверху — 40 оценок ошибки для выбранной глубины, снизу — какую глубину выбрало каждое из 40 разбиений.',
    });
    ui.slider(w.controls, { label: 'Доля валидации', values: [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5], value: s.frac, format: (v) => Math.round(v * 100) + ' % (' + Math.round(v * N) + ' точек)', onInput: (v) => ((s.frac = v), draw()) });
    ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 8, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const top = new GBC.Plot(w.main, { height: 170, x: { label: 'оценка MSE', domain: [0, 0.8] }, y: { domain: [-0.6, 1.6], ticks: [0, 1], format: (v) => (v > 0.5 ? 'одно разбиение' : 'CV, 5 блоков') }, grid: 'x', margin: { left: 104 } });
    const bottom = new GBC.Plot(w.main, { height: 230, x: { label: 'выбранная глубина', domain: [0.4, 8.6], ticks: DEPTHS }, y: { label: 'разбиений из 40', domain: [0, 40] } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'h', label: 'Одно разбиение: от … до' }, { key: 'hs', label: 'Ст. откл.: разбиение / CV' }, { key: 'truth', label: 'Новые данные' }, { key: 'pick', label: 'Выбрали лучшую глубину: разбиение / CV' }]);
    const fitMse = (tr, va, d) => {
      const t = new GBC.RegressionTree({ maxDepth: d }).fit(tr.map((i) => data.X[i]), tr.map((i) => -data.y[i]));
      return mse(va.map((i) => data.y[i]), t.predict(va.map((i) => data.X[i])));
    };
    const truth = DEPTHS.map((d) => mse(test.y, new GBC.RegressionTree({ maxDepth: d }).fit(data.X, data.y.map((v) => -v)).predict(test.X)));
    const bestTrue = DEPTHS[U.argmax(truth.map((v) => -v))];
    const hold = {};
    let cvCache = null;
    function holdout(frac) {
      if (hold[frac]) return hold[frac];
      const nv = Math.round(frac * N);
      hold[frac] = perms.map((p) => DEPTHS.map((d) => fitMse(p.slice(nv), p.slice(0, nv), d)));
      return hold[frac];
    }
    function cv() {
      if (cvCache) return cvCache;
      cvCache = perms.map((p) => {
        const fold = new Array(N);
        p.forEach((i, pos) => (fold[i] = pos % 5));
        return DEPTHS.map((d) => U.mean(U.range(5).map((j) => {
          const tr = [];
          const va = [];
          for (let i = 0; i < N; i++) (fold[i] === j ? va : tr).push(i);
          return fitMse(tr, va, d);
        })));
      });
      return cvCache;
    }
    const picks = (M) => {
      const cnt = new Array(DEPTHS.length).fill(0);
      M.forEach((row) => (cnt[U.argmax(row.map((v) => -v))] += 1));
      return cnt;
    };
    function draw() {
      const Hm = holdout(s.frac);
      const Cm = cv();
      const k = s.depth - 1;
      const hv = Hm.map((r) => r[k]);
      const cvv = Cm.map((r) => r[k]);
      const jit = (i) => ((i % 5) - 2) * 0.09;
      top.render([
        { type: 'vline', x: truth[k], color: 'test', dash: '4 3', width: 1.6, text: 'новые данные' },
        { type: 'points', x: hv, y: hv.map((_, i) => 1 + jit(i)), color: 'orange', r: 3.4 },
        { type: 'points', x: cvv, y: cvv.map((_, i) => jit(i)), color: 'blue', r: 3.4 },
      ]);
      const ph = picks(Hm);
      const pc = picks(Cm);
      bottom.render([
        { type: 'bars', x: DEPTHS.map((d) => d - 0.2), y: ph, color: 'orange', width: 0.38, label: 'одно разбиение' },
        { type: 'bars', x: DEPTHS.map((d) => d + 0.2), y: pc, color: 'blue', width: 0.38, label: 'CV, 5 блоков' },
        { type: 'vline', x: bestTrue, color: 'test', dash: '4 3', width: 1.4, text: 'лучшая по новым' },
      ]);
      const sdH = Math.sqrt(U.variance(hv));
      const sdC = Math.sqrt(U.variance(cvv));
      stats.set('h', U.fmt(Math.min(...hv), 3) + ' … ' + U.fmt(Math.max(...hv), 3));
      stats.set('hs', U.fmt(sdH, 3) + ' / ' + U.fmt(sdC, 3));
      stats.set('truth', U.fmt(truth[k], 3));
      stats.set('pick', ph[bestTrue - 1] + ' / ' + pc[bestTrue - 1] + ' из 40');
      const nv = Math.round(s.frac * N);
      note.innerHTML = 'Валидация из ' + nv + ' точек: оценка для глубины ' + s.depth + ' гуляет от ' + U.fmt(Math.min(...hv), 3) + ' до ' + U.fmt(Math.max(...hv), 3) + ' в зависимости от того, какие точки попали в проверку, — и выбранная глубина гуляет вместе с ней (оранжевые столбики). ' +
        'Кросс-валидация усредняет 5 оценок, где каждая точка побывала в проверке, поэтому её разброс в ' + U.fmt(sdH / sdC, 1) + ' раза меньше, а выбор устойчив. ' +
        (s.frac >= 0.4 ? 'Большая валидация точнее, но модель учится всего на ' + (N - nv) + ' точках — оценка смещается вверх (пессимистична).' : 'Маленькая валидация оставляет больше данных на обучение, но шумит сильнее.');
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, RegressionTree\nfrom gbcourse.metrics import mse\nfrom gbcourse.rng import Mulberry32\n\n' +
      'X, y = datasets.regression_1d(kind="sine", n=80, noise=0.4, seed=7)\nnv = ' + Math.round(s.frac * N) + '                                    # точек в валидации\nH, C = [], []\n' +
      'for seed in range(1, 41):\n    p = np.array(Mulberry32(seed).permutation(80))\n    va, tr = p[:nv], p[nv:]\n    H.append([mse(y[va], RegressionTree(max_depth=d).fit(X[tr], -y[tr]).predict(X[va])) for d in range(1, 9)])\n' +
      '    fold = np.empty(80, dtype=int)\n    fold[p] = np.arange(80) % 5\n    C.append([np.mean([mse(y[fold == j], RegressionTree(max_depth=d).fit(X[fold != j], -y[fold != j]).predict(X[fold == j]))\n                       for j in range(5)]) for d in range(1, 9)])\n' +
      'H, C = np.array(H), np.array(C)\nk = ' + (s.depth - 1) + '\nprint(f"глубина ' + s.depth + ': одно разбиение {H[:, k].min():.3f}…{H[:, k].max():.3f} (ст. откл. {H[:, k].std():.3f}), CV ст. откл. {C[:, k].std():.3f}")\n' +
      'print("выбранная глубина, одно разбиение:", np.bincount(H.argmin(1) + 1, minlength=9)[1:])\nprint("выбранная глубина, CV:           ", np.bincount(C.argmin(1) + 1, minlength=9)[1:])\n'
    );
    draw();
  });

  /* =================================================================================
   * leakage — отбор признаков до кросс-валидации находит закономерность в шуме
   * ================================================================================= */
  GBC.widget('leakage', (el) => {
    const N = 60;
    const P = 1000;
    const KMAX = 20;
    const rng = new GBC.RNG(42);
    const Xall = U.range(N).map(() => U.range(P).map(() => rng.normal()));
    const y = U.range(N).map(() => rng.normal());
    const fold = new Array(N);
    new GBC.RNG(0).permutation(N).forEach((i, pos) => (fold[i] = pos % 5));
    const s = { p: 1000, k: 10 };
    const w = ui.shell(el, {
      title: 'Утечка: отбор признаков до кросс-валидации',
      sub: '60 объектов, все признаки и ответ — чистый шум: предсказывать нечего. Отбираем k признаков, сильнее всего коррелирующих с ответом, и строим линейную регрессию. Слева отбор сделан по всем данным, справа — заново внутри каждого из 5 блоков. Точки — прогнозы для объектов, которых модель не видела.',
    });
    ui.slider(w.controls, { label: 'Признаков-шумов p', values: [10, 30, 100, 300, 1000], value: s.p, format: String, onInput: (v) => ((s.p = v), (cache = {}), draw()) });
    ui.slider(w.controls, { label: 'Отбираем k признаков', min: 1, max: KMAX, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const axis = { domain: [-3, 3] };
    const pw = new GBC.Plot(box, { height: 260, equal: true, x: Object.assign({ label: 'прогноз вне блока' }, axis), y: Object.assign({ label: 'ответ y' }, axis), title: 'отбор по всем данным' });
    const pr = new GBC.Plot(box, { height: 260, equal: true, x: Object.assign({ label: 'прогноз вне блока' }, axis), y: Object.assign({ label: 'ответ y' }, axis), title: 'отбор внутри блока' });
    const curvePlot = new GBC.Plot(w.main, { height: 220, x: { label: 'отобрано признаков k', domain: [1, KMAX] }, y: { label: 'R² вне блока' }, crosshair: true, crosshairTitle: (v) => 'k = ' + Math.round(v) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'w', label: 'R² с утечкой' }, { key: 'r', label: 'R² без утечки' }, { key: 'cw', label: 'Корреляция прогноза с y: с утечкой / без' }]);
    /** Признаки (j < p) по убыванию |корреляции| с ответом на объектах rows. */
    function rank(rows, p) {
      const ym = U.mean(rows.map((i) => y[i]));
      let syy = 0;
      for (const i of rows) syy += (y[i] - ym) ** 2;
      const score = new Array(p);
      for (let j = 0; j < p; j++) {
        let xm = 0;
        for (const i of rows) xm += Xall[i][j];
        xm /= rows.length;
        let sxy = 0;
        let sxx = 0;
        for (const i of rows) {
          const dx = Xall[i][j] - xm;
          sxy += dx * (y[i] - ym);
          sxx += dx * dx;
        }
        score[j] = Math.abs(sxy) / Math.sqrt(sxx * syy);
      }
      return U.argsort(score.map((v) => -v));
    }
    /** Линейная регрессия со свободным членом: нормальные уравнения, метод Гаусса. */
    function olsPredict(trRows, vaRows, feats) {
      const m = feats.length + 1;
      const row = (i) => [1, ...feats.map((j) => Xall[i][j])];
      const A = U.range(m).map(() => new Array(m + 1).fill(0));
      for (const i of trRows) {
        const r = row(i);
        for (let a = 0; a < m; a++) {
          for (let b = 0; b < m; b++) A[a][b] += r[a] * r[b];
          A[a][m] += r[a] * y[i];
        }
      }
      for (let c = 0; c < m; c++) {
        let piv = c;
        for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
        [A[c], A[piv]] = [A[piv], A[c]];
        for (let r = 0; r < m; r++) {
          if (r === c) continue;
          const k = A[r][c] / A[c][c];
          for (let q = c; q <= m; q++) A[r][q] -= k * A[c][q];
        }
      }
      const wv = U.range(m).map((a) => A[a][m] / A[a][a]);
      return vaRows.map((i) => row(i).reduce((acc, v, a) => acc + v * wv[a], 0));
    }
    let cache = {};
    function compute() {
      if (cache.res) return cache.res;
      const all = U.range(N);
      const globalRank = rank(all, s.p);
      const folds = U.range(5).map((j) => {
        const tr = all.filter((i) => fold[i] !== j);
        const va = all.filter((i) => fold[i] === j);
        return { tr, va, rank: rank(tr, s.p) };
      });
      const res = U.range(KMAX, 1).map((k) => {
        const ow = new Array(N);
        const orr = new Array(N);
        for (const F of folds) {
          const pw_ = olsPredict(F.tr, F.va, globalRank.slice(0, k));
          const pr_ = olsPredict(F.tr, F.va, F.rank.slice(0, k));
          F.va.forEach((i, q) => ((ow[i] = pw_[q]), (orr[i] = pr_[q])));
        }
        return { ow, orr, rw: r2(ow), rr: r2(orr), cw: corr(ow), cr: corr(orr) };
      });
      cache.res = res;
      return res;
    }
    const ym = U.mean(y);
    const sst = U.sum(y.map((v) => (v - ym) ** 2));
    const r2 = (p) => 1 - U.sum(y.map((v, i) => (v - p[i]) ** 2)) / sst;
    const corr = (p) => {
      const pm = U.mean(p);
      let a = 0;
      let b = 0;
      let c = 0;
      p.forEach((v, i) => ((a += (v - pm) * (y[i] - ym)), (b += (v - pm) ** 2), (c += (y[i] - ym) ** 2)));
      return a / Math.sqrt(b * c);
    };
    function draw() {
      const res = compute();
      const R = res[s.k - 1];
      const diag = { type: 'line', x: [-3, 3], y: [-3, 3], color: 'ink2', dash: '4 3', width: 1 };
      const clip = (a) => a.map((v) => U.clamp(v, -3, 3));
      pw.render([diag, { type: 'points', x: clip(R.ow), y, color: 'orange', r: 3.6 }]);
      pr.render([diag, { type: 'points', x: clip(R.orr), y, color: 'blue', r: 3.6 }]);
      const ks = U.range(KMAX, 1);
      curvePlot.render([
        { type: 'hline', y: 0, color: 'ink2', width: 1, text: 'R² = 0: не лучше среднего' },
        { type: 'line', x: ks, y: res.map((q) => q.rw), color: 'orange', width: 2.2, label: 'отбор по всем данным (утечка)' },
        { type: 'line', x: ks, y: res.map((q) => q.rr), color: 'blue', width: 2.2, label: 'отбор внутри блока' },
        { type: 'vline', x: s.k, color: 'ink', dash: '3 3', width: 1.2 },
      ], { y: [Math.min(-1, ...res.map((q) => q.rr)) * 1.05, 1] });
      stats.set('w', U.fmt(R.rw, 3));
      stats.set('r', U.fmt(R.rr, 3));
      stats.set('cw', U.fmt(R.cw, 2) + ' / ' + U.fmt(R.cr, 2));
      note.innerHTML = (R.rw > 0.05
        ? 'С утечкой кросс-валидация «находит» закономерность: R² = ' + U.fmt(R.rw, 2) + ', прогнозы выстроились вдоль диагонали. Но в данных нет ничего, кроме шума! Признаки отбирались по всем 60 объектам, включая проверочные, — из ' + s.p + ' шумов нашлись те, что <b>случайно</b> совпали с ответом именно на этих объектах. '
        : 'При p = ' + s.p + ' и k = ' + s.k + ' утечка почти не видна: среди ' + s.p + ' шумов мало «удачных» совпадений. Увеличьте p — чем больше признаков перебрали, тем сильнее обманывает отбор по всем данным. ') +
        'Честный вариант отбирает признаки заново в каждом блоке, и R² = ' + U.fmt(R.rr, 2) + ' — ниже нуля: модель на подогнанных к шуму признаках хуже простого среднего.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\nrng = Mulberry32(42)\nX = np.array([[rng.normal() for _ in range(1000)] for _ in range(60)])[:, :' + s.p + ']\ny = np.array([rng.normal() for _ in range(60)])\n' +
      'fold = np.empty(60, dtype=int)\nfold[Mulberry32(0).permutation(60)] = np.arange(60) % 5\n\n' +
      'def top(X, y, k):                       # k признаков с наибольшей |корреляцией|\n    Xc, yc = X - X.mean(0), y - y.mean()\n    score = np.abs(Xc.T @ yc) / np.sqrt((Xc**2).sum(0) * (yc**2).sum())\n    return np.argsort(-score, kind="stable")[:k]\n\n' +
      'def ols(Xa, ya, Xb):                    # линейная регрессия со свободным членом\n    w = np.linalg.lstsq(np.c_[np.ones(len(Xa)), Xa], ya, rcond=None)[0]\n    return np.c_[np.ones(len(Xb)), Xb] @ w\n\n' +
      'k = ' + s.k + '\nleak = top(X, y, k)                     # отбор по ВСЕМ данным\nwrong, right = np.zeros(60), np.zeros(60)\nfor j in range(5):\n    tr, va = fold != j, fold == j\n    wrong[va] = ols(X[tr][:, leak], y[tr], X[va][:, leak])\n    own = top(X[tr], y[tr], k)          # отбор внутри блока\n    right[va] = ols(X[tr][:, own], y[tr], X[va][:, own])\n\n' +
      'r2 = lambda p: 1 - np.sum((y - p) ** 2) / np.sum((y - y.mean()) ** 2)\nprint(f"с утечкой:  R² = {r2(wrong):.3f}")\nprint(f"без утечки: R² = {r2(right):.3f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * time-split — случайная кросс-валидация на временном ряду обманывает
   * ================================================================================= */
  GBC.widget('time-split', (el) => {
    const T = 144;
    const NH = 120;
    const t = U.range(T);
    const rng = new GBC.RNG(5);
    const y = t.map((ti) => 2 + 0.03 * ti + 0.6 * Math.sin((2 * Math.PI * ti) / 12) + 0.3 * rng.normal());
    const X = t.map((ti) => [ti]);
    const DEPTHS = U.range(10, 1);
    const fold = new Array(NH);
    new GBC.RNG(0).permutation(NH).forEach((i, pos) => (fold[i] = pos % 5));
    const s = { scheme: 'random', depth: 6 };
    const w = ui.shell(el, {
      title: 'Временной ряд: случайные блоки против проверки по времени',
      sub: '10 лет помесячных продаж (120 точек): рост + сезонность + шум. Признак — номер месяца t. Модель — дерево. Последние 24 точки — «будущее», которое модель увидит только после внедрения. Какая схема валидации честно предскажет ошибку в будущем?',
    });
    ui.segmented(w.controls, { label: 'Схема валидации', options: [{ value: 'random', label: 'Случайные блоки' }, { value: 'time', label: 'По времени' }], value: s.scheme, onChange: (v) => ((s.scheme = v), draw()) });
    ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 10, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const scheme = new GBC.Plot(w.main, { height: 150, x: { label: 'месяц t', domain: [-1, T] }, y: { label: '', domain: [0.4, 5.6] }, grid: 'none', margin: { left: 70 } });
    const series = new GBC.Plot(w.main, { height: 260, x: { label: 'месяц t', domain: [0, T - 1] }, y: { label: 'продажи' } });
    const errs = new GBC.Plot(w.main, { height: 240, x: { label: 'глубина дерева', domain: [1, 10] }, y: { label: 'MSE' }, crosshair: true, crosshairTitle: (v) => 'глубина ' + Math.round(v) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'r', label: 'Случайные блоки' }, { key: 't', label: 'По времени' }, { key: 'f', label: 'Будущее (24 месяца)' }]);
    const fitPred = (tr, te, d) => new GBC.RegressionTree({ maxDepth: d }).fit(tr.map((i) => X[i]), tr.map((i) => -y[i])).predict(te.map((i) => X[i]));
    const err = (idx, p) => mse(idx.map((i) => y[i]), p);
    /** Блоки схемы: [{train, test}] — 5 случайных блоков или 5 сдвигов «обучение до t, проверка следующие 20». */
    function splits(kind) {
      if (kind === 'random') return U.range(5).map((j) => ({ train: U.range(NH).filter((i) => fold[i] !== j), test: U.range(NH).filter((i) => fold[i] === j) }));
      return U.range(5).map((j) => ({ train: U.range(20 * (j + 1)), test: U.range(20, 20 * (j + 1)) }));
    }
    const SPL = { random: splits('random'), time: splits('time') };
    const future = U.range(T - NH, NH);
    const history = U.range(NH);
    const curves = {
      random: DEPTHS.map((d) => U.mean(SPL.random.map((q) => err(q.test, fitPred(q.train, q.test, d))))),
      time: DEPTHS.map((d) => U.mean(SPL.time.map((q) => err(q.test, fitPred(q.train, q.test, d))))),
      future: DEPTHS.map((d) => err(future, fitPred(history, future, d))),
    };
    function draw() {
      const spl = SPL[s.scheme];
      const layers = [];
      spl.forEach((q, j) => {
        const row = 5 - j;
        const role = new Array(NH).fill('none');
        q.train.forEach((i) => (role[i] = 'train'));
        q.test.forEach((i) => (role[i] = 'valid'));
        const used = history.filter((i) => role[i] !== 'none');
        const unused = history.filter((i) => role[i] === 'none');
        if (unused.length) layers.push({ type: 'points', x: unused, y: unused.map(() => row), color: 'grid', r: 1.8, shape: 'square' });
        layers.push({ type: 'points', x: used, y: used.map(() => row), color: (k) => role[used[k]], r: (k) => (role[used[k]] === 'valid' ? 3 : 2), shape: 'square' });
        layers.push({ type: 'points', x: future, y: future.map(() => row), color: 'test', r: 1.6, opacity: 0.35, shape: 'square' });
      });
      scheme.opts.y = Object.assign({}, scheme.opts.y, { ticks: [1, 2, 3, 4, 5], format: (v) => 'раунд ' + (6 - Math.round(v)) });
      scheme.render(layers);
      const all = U.range(T);
      const pred = fitPred(history, all, s.depth);
      series.render([
        { type: 'vband', x0: NH - 0.5, x1: T - 1, color: 'test', opacity: 0.08 },
        { type: 'points', x: history, y: history.map((i) => y[i]), color: 'data', r: 2.6, label: 'история' },
        { type: 'points', x: future, y: future.map((i) => y[i]), color: 'test', r: 3, hollow: true, label: 'будущее' },
        { type: 'line', x: all, y: pred, color: 'model', width: 2, curve: 'step', label: 'дерево на всей истории' },
      ]);
      const k = s.depth - 1;
      errs.render([
        { type: 'hline', y: 0.09, color: 'ink2', dash: '4 3', width: 1, text: 'шум σ² = 0.09' },
        { type: 'line', x: DEPTHS, y: curves.random, color: 'orange', width: s.scheme === 'random' ? 2.6 : 1.6, label: 'случайные блоки' },
        { type: 'line', x: DEPTHS, y: curves.time, color: 'blue', width: s.scheme === 'time' ? 2.6 : 1.6, label: 'по времени' },
        { type: 'line', x: DEPTHS, y: curves.future, color: 'test', dash: '5 3', width: 2, label: 'будущее' },
        { type: 'vline', x: s.depth, color: 'ink', dash: '3 3', width: 1.2 },
      ], { y: [0, 1.5] });
      stats.set('r', U.fmt(curves.random[k], 3));
      stats.set('t', U.fmt(curves.time[k], 3));
      stats.set('f', U.fmt(curves.future[k], 3));
      note.innerHTML = s.scheme === 'random'
        ? 'Случайные блоки перемешивают месяцы: проверочный месяц почти всегда окружён обучающими соседями слева и справа, и дерево просто <b>интерполирует</b>. Оценка ' + U.fmt(curves.random[k], 3) + ' — а в будущем ошибка ' + U.fmt(curves.future[k], 3) + ': дерево не умеет продолжать рост и рисует горизонтальную «полку» после последнего месяца.'
        : 'Проверка по времени повторяет жизнь: учимся на первых 20, 40, …, 100 месяцах и проверяем на следующих 20. Оценка ' + U.fmt(curves.time[k], 3) + ' — того же порядка, что и ошибка в будущем (' + U.fmt(curves.future[k], 3) + '): схема честно показывает, что дерево не экстраполирует тренд. Чуть пессимистичнее — ранние раунды учатся на меньшей истории.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import RegressionTree\nfrom gbcourse.metrics import mse\nfrom gbcourse.rng import Mulberry32\n\n' +
      'rng = Mulberry32(5)\nt = np.arange(144)\ny = np.array([2 + 0.03 * ti + 0.6 * np.sin(2 * np.pi * ti / 12) + 0.3 * rng.normal() for ti in t])\nX = t.reshape(-1, 1).astype(float)\n' +
      'fold = np.empty(120, dtype=int)\nfold[Mulberry32(0).permutation(120)] = np.arange(120) % 5\n\n' +
      'def err(tr, te, d):\n    return mse(y[te], RegressionTree(max_depth=d).fit(X[tr], -y[tr]).predict(X[te]))\n\n' +
      'h = np.arange(120)\nfor d in range(1, 11):\n    rnd = np.mean([err(h[fold != j], h[fold == j], d) for j in range(5)])\n' +
      '    tsp = np.mean([err(np.arange(20 * (j + 1)), np.arange(20 * (j + 1), 20 * (j + 2)), d) for j in range(5)])\n' +
      '    fut = err(h, np.arange(120, 144), d)\n    print(f"глубина {d:2d}: случайные блоки {rnd:.3f}  по времени {tsp:.3f}  будущее {fut:.3f}")\n'
    );
    draw();
  });
})();
