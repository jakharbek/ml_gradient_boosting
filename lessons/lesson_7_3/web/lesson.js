/* Урок 7.3: штрафы на листья. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('lambda-shrink', (el) => {
    const s = { lambda: 5, alpha: 0, rbar: 1 };
    const w = ui.shell(el, { title: 'Как штрафы меняют значение листа', sub: 'Лист из n объектов с одинаковым средним остатком r̄ (L2, h = 1). Без штрафов вес листа = r̄ при любом n. С λ маленькие листья сжимаются к нулю, с α слабые листья обнуляются.' });
    ui.slider(w.controls, { label: 'λ (reg_lambda)', min: 0, max: 30, step: 0.5, value: s.lambda, onInput: (v) => ((s.lambda = v), draw()) });
    ui.slider(w.controls, { label: 'α (reg_alpha)', min: 0, max: 20, step: 0.5, value: s.alpha, onInput: (v) => ((s.alpha = v), draw()) });
    ui.slider(w.controls, { label: 'Средний остаток r̄', min: 0.1, max: 2, step: 0.05, value: s.rbar, onInput: (v) => ((s.rbar = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'объектов в листе n', type: 'log', domain: [1, 1000] }, y: { label: 'вес листа w' }, crosshair: true, crosshairTitle: (v) => 'n = ' + Math.round(v) });
    function draw() {
      const ns = U.linspace(0, 3, 200).map((v) => Math.pow(10, v));
      const wOf = (n) => {
        const G = -n * s.rbar;
        const T = Math.sign(G) * Math.max(Math.abs(G) - s.alpha, 0);
        return -T / (n + s.lambda);
      };
      plot.render([
        { type: 'hline', y: s.rbar, color: 'muted', dash: '4 3', width: 1, text: 'без штрафов: r̄' },
        { type: 'line', x: ns, y: ns.map(wOf), color: 'model', width: 2.4, label: 'w = −T_α(G)/(H + λ)' },
      ], { y: [0, s.rbar * 1.15] });
    }
    draw();
  });

  GBC.widget('penalty-effect', (el) => {
    const s = { lambda: 0, gamma: 0, mcw: 0 };
    const w = ui.shell(el, { title: 'Штрафы на одномерных данных', sub: 'Бустинг второго порядка (как XGBoost), глубина 5, 60 деревьев, ν = 0.3. Смотрите, как меняются число листьев и форма модели.' });
    const refit = U.rafThrottle(() => fit());
    ui.slider(w.controls, { label: 'λ (reg_lambda)', min: 0, max: 50, step: 1, value: s.lambda, format: String, onInput: (v) => ((s.lambda = v), refit()) });
    ui.slider(w.controls, { label: 'γ (gamma)', min: 0, max: 1, step: 0.01, value: s.gamma, onInput: (v) => ((s.gamma = v), refit()) });
    ui.slider(w.controls, { label: 'min_child_weight', min: 0, max: 30, step: 1, value: s.mcw, format: String, onInput: (v) => ((s.mcw = v), refit()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const stats = ui.stats(w.foot, [{ key: 'leaves', label: 'Листьев в дереве (в среднем)' }, { key: 'train', label: '½MSE обучения' }, { key: 'test', label: '½MSE на новых данных' }]);
    const data = GBC.datasets.regression1d({ kind: 'wave', n: 120, noise: 0.6, seed: 76 });
    const test = GBC.datasets.regression1d({ kind: 'wave', n: 800, noise: 0.6, seed: 77 });
    function fit() {
      const m = new GBC.GradientBoosting({ mode: 'newton', nEstimators: 60, learningRate: 0.3, maxDepth: 5, regLambda: s.lambda, gamma: s.gamma, minChildWeight: s.mcw }).fit(data.X, data.y);
      const gx = U.linspace(0, 10, 400).map((v) => [v]);
      plot.render([
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3, label: 'данные' },
        { type: 'line', x: gx.map((r) => r[0]), y: gx.map((r) => GBC.datasets.trueFunction('wave', r[0])), color: 'truth', dash: '5 4', width: 1.4, label: 'истина', hover: false },
        { type: 'line', x: gx.map((r) => r[0]), y: m.predictRaw(gx), color: 'model', width: 2.2, label: 'модель' },
      ]);
      stats.set('leaves', U.fmt(U.mean(m.trees.map((st) => st[0].nLeaves)), 1));
      stats.set('train', U.fmt(m.history.train[m.history.train.length - 1], 4));
      stats.set('test', U.fmt(GBC.metrics.mse(test.y, m.predictRaw(test.X)) / 2, 4));
    }
    fit();
  });
})();
