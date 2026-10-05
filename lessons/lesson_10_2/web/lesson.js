/* Урок 10.2: устойчивые потери и минимальный размер листа; веса классов. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('robust-leaf', (el) => {
    const s = { loss: 'huber', msl: 1, m: 300 };
    const w = ui.shell(el, {
      title: 'Выбросы в y: потеря и размер листа',
      sub: 'Волна, 200 объектов, у 5% к y прибавлено ±4…7. Бустинг глубины 3, ν = 0.1 (у Хьюбера δ = 0.5). Двигайте число деревьев: с листьями из одного объекта модель рано или поздно «дотягивается» до выбросов даже с устойчивой потерей.',
    });
    ui.segmented(w.controls, { label: 'Потеря', value: s.loss, options: [{ value: 'squared', label: 'L2' }, { value: 'huber', label: 'Хьюбер' }, { value: 'absolute', label: 'L1' }], onChange: (v) => ((s.loss = v), refit()) });
    ui.slider(w.controls, { label: 'Минимум объектов в листе', values: [1, 3, 5, 10, 20], value: s.msl, format: String, onInput: (v) => ((s.msl = v), refit()) });
    ui.slider(w.controls, { label: 'Деревьев', min: 10, max: 600, step: 10, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const stats = ui.stats(w.foot, [{ key: 'test', label: 'MSE относительно истинной функции' }, { key: 'far', label: 'наибольшее отклонение модели от истины' }]);
    const d = GBC.datasets.regression1d({ kind: 'wave', n: 200, noise: 0.3, seed: 151, outliers: 0.05 });
    const gx = U.linspace(0, 10, 400);
    const truth = gx.map((v) => GBC.datasets.trueFunction('wave', v));
    let model = null;
    let cache = null;

    function refit() {
      model = new GBC.GradientBoosting({ loss: s.loss, huberDelta: 0.5, nEstimators: 600, learningRate: 0.1, maxDepth: 3, minSamplesLeaf: s.msl }).fit(d.X, d.y);
      cache = new GBC.StageCache(model, gx.map((v) => [v]));
      draw();
    }

    function draw() {
      const F = cache.seek(s.m);
      const p = Array.from(F);
      plot.render([
        { type: 'points', x: d.x, y: d.y, color: 'data', r: 2.6, opacity: 0.7, label: 'данные' },
        { type: 'line', x: gx, y: truth, color: 'truth', dash: '5 4', width: 1.4, label: 'истина', hover: false },
        { type: 'line', x: gx, y: p, color: 'model', width: 2, label: 'модель' },
      ], { y: [-4.5, 8.5] });
      stats.set('test', U.fmt(U.mean(p.map((v, i) => (v - truth[i]) ** 2)), 3));
      stats.set('far', U.fmt(Math.max(...p.map((v, i) => Math.abs(v - truth[i]))), 3));
    }
    refit();
  });

  /** Данные с редким классом: признак 0 сдвинут у класса 1, признак 1 — в случайную сторону. */
  function makeImb(n, rate, seed) {
    const rng = new GBC.RNG(seed);
    const X = [];
    const y = [];
    for (let i = 0; i < n; i++) {
      const c = rng.random() < rate ? 1 : 0;
      const a = rng.normal(0, 1) + 1.5 * c;
      const b = rng.normal(0, 1) + (c ? (rng.random() < 0.5 ? -1 : 1) : 0);
      X.push([a, b, rng.normal(0, 1)]);
      y.push(c);
    }
    return { X, y };
  }

  /** Бустинг второго порядка для log-loss с весом класса 1: g и h умножаются на вес объекта. */
  function weightedBoost(X, y, wPos, nTrees = 100, lr = 0.1) {
    const n = y.length;
    const wt = y.map((v) => (v ? wPos : 1));
    const sw = U.sum(wt);
    const pw = U.sum(y.map((v, i) => v * wt[i])) / sw;
    const F0 = Math.log(pw / (1 - pw));
    const F = new Array(n).fill(F0);
    const trees = [];
    for (let m = 0; m < nTrees; m++) {
      const g = new Array(n);
      const h = new Array(n);
      for (let i = 0; i < n; i++) {
        const p = U.sigmoid(F[i]);
        g[i] = wt[i] * (p - y[i]);
        h[i] = wt[i] * p * (1 - p);
      }
      const t = new GBC.RegressionTree({ maxDepth: 3, regLambda: 1, maxBins: 64 }).fit(X, g, h);
      const u = t.predict(X);
      for (let i = 0; i < n; i++) F[i] += lr * u[i];
      trees.push(t);
    }
    return (Xn) => {
      const out = new Array(Xn.length).fill(F0);
      for (const t of trees) {
        const u = t.predict(Xn);
        for (let i = 0; i < out.length; i++) out[i] += lr * u[i];
      }
      return out.map(U.sigmoid);
    };
  }

  GBC.widget('class-weight', (el) => {
    const s = { rate: 0.05, w: 1 };
    const w = ui.shell(el, {
      title: 'Вес редкого класса',
      sub: '4000 объектов для обучения и 4000 для теста; бустинг второго порядка, 100 деревьев глубины 3. Вес w умножает g и h объектов класса 1. Гистограммы — прогнозы на тесте для каждого класса (доли внутри класса).',
    });
    ui.slider(w.controls, { label: 'Доля класса 1', values: [0.02, 0.05, 0.1, 0.2, 0.5], value: s.rate, format: (v) => Math.round(v * 100) + '%', onInput: (v) => ((s.rate = v), draw()) });
    const W = [1, 2, 5, 10, 20, 50];
    const wCtl = ui.slider(w.controls, { label: 'Вес класса 1 (w)', values: W, value: s.w, format: String, help: 'Балансирующий вес (1 − доля)/доля: 49 при 2%, 19 при 5%, 9 при 10%.', onInput: (v) => ((s.w = v), draw()) });
    ui.button(w.controls, {
      label: 'Ближайший к (1 − доля)/доля',
      onClick: () => {
        const target = (1 - s.rate) / s.rate;
        wCtl.set(W.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a)), false);
      },
    });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'прогноз вероятности класса 1', domain: [0, 1] }, y: { label: 'доля объектов класса' } });
    const stats = ui.stats(w.foot, [
      { key: 'auc', label: 'ROC AUC' },
      { key: 'll', label: 'log-loss' },
      { key: 'mean', label: 'средний прогноз / доля класса 1' },
      { key: 'rec', label: 'полнота / точность при пороге 0.5' },
      { key: 'f1', label: 'лучший F1 (порог)' },
    ]);
    const cache = {};

    function draw() {
      const key = s.rate + '|' + s.w;
      if (!cache[key]) {
        const tr = makeImb(4000, s.rate, 152);
        const te = makeImb(4000, s.rate, 153);
        const predict = weightedBoost(tr.X, tr.y, s.w);
        cache[key] = { te, p: predict(te.X) };
      }
      const { te, p } = cache[key];
      const B = 20;
      const hist = (c) => {
        const idx = U.range(p.length).filter((i) => te.y[i] === c);
        const hcount = new Array(B).fill(0);
        for (const i of idx) hcount[Math.min(B - 1, Math.floor(p[i] * B))] += 1;
        return hcount.map((v) => v / idx.length);
      };
      const xs = U.range(B).map((k) => (k + 0.5) / B);
      plot.render([
        { type: 'bars', x: xs, y: hist(0), width: 1 / B, maxPx: 60, color: 'class0', opacity: 0.55, label: 'класс 0' },
        { type: 'bars', x: xs, y: hist(1), width: 1 / B, maxPx: 60, color: 'class1', opacity: 0.55, label: 'класс 1' },
        { type: 'vline', x: 0.5, color: 'ink', dash: '4 3', width: 1 },
      ], { y: [0, 1] });
      const pos = te.y.filter((v) => v === 1).length;
      const tp = p.filter((v, i) => v > 0.5 && te.y[i] === 1).length;
      const pp = p.filter((v) => v > 0.5).length;
      let bestF1 = 0;
      let bestT = 0.5;
      for (let t = 0.01; t < 1; t += 0.01) {
        const tpt = p.filter((v, i) => v > t && te.y[i] === 1).length;
        const ppt = p.filter((v) => v > t).length;
        const f1 = ppt ? (2 * tpt) / (ppt + pos) : 0;
        if (f1 > bestF1) {
          bestF1 = f1;
          bestT = t;
        }
      }
      stats.set('auc', U.fmt(GBC.metrics.rocAuc(te.y, p), 3));
      stats.set('ll', U.fmt(GBC.metrics.logLoss(te.y, p), 3));
      stats.set('mean', U.fmt(U.mean(p), 3) + ' / ' + U.fmt(pos / te.y.length, 3));
      stats.set('rec', U.fmt(tp / pos, 2) + ' / ' + (pp ? U.fmt(tp / pp, 2) : '—'));
      stats.set('f1', U.fmt(bestF1, 3) + ' (' + U.fmt(bestT, 2) + ')');
    }
    draw();
  });
})();
