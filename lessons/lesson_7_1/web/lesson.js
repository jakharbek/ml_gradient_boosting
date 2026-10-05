/* Урок 7.1: ранняя остановка с терпением. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('early-stop', (el) => {
    const s = { patience: 20, nu: 0.1, depth: 3, valSize: 0.3, seed: 0 };
    const w = ui.shell(el, { title: 'Ранняя остановка с терпением', sub: 'Синяя — обучение, оранжевая — валидация. Точка — лучшая итерация, красная линия — где сработало правило терпения. Меняйте разбиение (зерно), чтобы увидеть, как шумна валидация.' });
    ui.slider(w.controls, { label: 'Терпение (patience)', min: 1, max: 150, step: 1, value: s.patience, format: String, onInput: (v) => ((s.patience = v), draw()) });
    ui.slider(w.controls, { label: 'Темп ν', min: 0.01, max: 0.5, log: true, value: s.nu, onInput: U.debounce((v) => ((s.nu = v), fit()), 150) });
    ui.slider(w.controls, { label: 'Глубина', min: 1, max: 6, step: 1, value: s.depth, format: String, onInput: U.debounce((v) => ((s.depth = v), fit()), 150) });
    ui.slider(w.controls, { label: 'Доля валидации', min: 0.1, max: 0.5, step: 0.05, value: s.valSize, onInput: U.debounce((v) => ((s.valSize = v), fit()), 150) });
    ui.slider(w.controls, { label: 'Зерно разбиения', min: 0, max: 20, step: 1, value: s.seed, format: String, onInput: U.debounce((v) => ((s.seed = v), fit()), 150) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'итерация' }, y: { label: '½·MSE' }, crosshair: true, crosshairTitle: (v) => 'итерация ' + Math.round(v) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'best', label: 'Лучшая итерация' }, { key: 'stop', label: 'Остановка на' }, { key: 'regret', label: 'Потеря качества от остановки' }, { key: 'test', label: '½MSE на тесте (лучшая итерация)' }]);
    const data = GBC.datasets.regression1d({ kind: 'wave', n: 600, noise: 0.6, seed: 72 });
    const test = GBC.datasets.regression1d({ kind: 'wave', n: 1000, noise: 0.6, seed: 73 });
    let model;
    let testCurve;
    const MAXM = 800;
    function fit() {
      const sp = GBC.datasets.trainTestSplit(data.X, data.y, s.valSize, s.seed);
      model = new GBC.GradientBoosting({ nEstimators: Math.min(MAXM, Math.round(80 / s.nu)), learningRate: s.nu, maxDepth: s.depth }).fit(sp.Xtrain, sp.ytrain, { evalSet: [sp.Xtest, sp.ytest] });
      const cache = new GBC.StageCache(model, test.X);
      testCurve = U.range(model.trees.length + 1).map((m) => {
        const F = cache.seek(m);
        let sse = 0;
        for (let i = 0; i < test.y.length; i++) sse += (test.y[i] - F[i]) ** 2;
        return sse / test.y.length / 2;
      });
      draw();
    }
    function draw() {
      const ev = model.history.eval;
      const tr = model.history.train;
      let best = 0;
      let stop = ev.length - 1;
      for (let m = 1; m < ev.length; m++) {
        if (ev[m] < ev[best]) best = m;
        else if (m - best >= s.patience) {
          stop = m;
          break;
        }
      }
      let trueBest = 0;
      for (let m = 1; m < ev.length; m++) if (ev[m] < ev[trueBest]) trueBest = m;
      const it = U.range(ev.length);
      plot.render([
        { type: 'line', x: it, y: tr, color: 'train', label: 'обучение' },
        { type: 'line', x: it, y: ev, color: 'valid', label: 'валидация' },
        { type: 'line', x: it, y: testCurve, color: 'test', dash: '4 3', label: 'тест (для справки)' },
        { type: 'vband', x0: stop, x1: ev.length - 1, color: 'muted', opacity: 0.1 },
        { type: 'vline', x: stop, color: 'red', width: 1.6, text: 'остановка' },
        { type: 'points', x: [best], y: [ev[best]], color: 'valid', r: 6, label: 'лучшая до остановки' },
      ], { y: [Math.min(...tr.slice(-1), ...ev) * 0.8, ev[0] * 1.02] });
      stats.set('best', String(best));
      stats.set('stop', String(stop));
      stats.set('regret', U.fmt(ev[best] - ev[trueBest], 4));
      stats.set('test', U.fmt(testCurve[best], 4));
      note.innerHTML = best < trueBest
        ? 'Терпения не хватило: остановились до настоящего минимума валидации (итерация ' + trueBest + '). Увеличьте patience.'
        : 'Остановка нашла минимум валидации. Сравните с тестом: лучшая итерация по валидации не обязательно лучшая по тесту — валидация тоже шумна.';
    }
    fit();
  });
})();
