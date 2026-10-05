/* Урок 8: один шаг XGBoost как взвешенная регрессия на рабочий отклик. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  /** Одномерная бинарная классификация: P(y = 1 | x) = σ(2.5·sin(0.9x)). */
  function makeData(n, seed) {
    const rng = new GBC.RNG(seed);
    const x = [];
    const y = [];
    for (let i = 0; i < n; i++) {
      const xi = rng.uniform(0, 10);
      x.push(xi);
      y.push(rng.random() < U.sigmoid(2.5 * Math.sin(0.9 * xi)) ? 1 : 0);
    }
    return { x, y, X: x.map((v) => [v]) };
  }

  GBC.widget('xgb-step', (el) => {
    const ZMAX = 6;
    const s = { m: 3, lambda: 1, depth: 2 };
    const w = ui.shell(el, {
      title: 'Анатомия одного шага',
      sub: 'Сверху — текущая модель после m деревьев (ν = 0.5, режим newton). Снизу — что увидит следующее дерево: рабочий отклик z = −g/h каждого объекта (размер точки ∝ весу h) и сами значения листьев w = −G/(H + λ).',
    });
    ui.slider(w.controls, { label: 'Деревьев в модели m', min: 0, max: 30, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'λ (reg_lambda)', min: 0, max: 20, step: 0.5, value: s.lambda, onInput: (v) => ((s.lambda = v), refit()) });
    ui.slider(w.controls, { label: 'Глубина деревьев', min: 1, max: 4, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), refit()) });
    const top = new GBC.Plot(w.main, { height: 200, x: { label: 'x', domain: [0, 10] }, y: { label: 'p(y = 1)', domain: [-0.05, 1.05] } });
    const bot = new GBC.Plot(w.main, { height: 250, x: { label: 'x', domain: [0, 10] }, y: { label: 'z = −g/h', domain: [-ZMAX, ZMAX] } });
    const stats = ui.stats(w.foot, [{ key: 'loss', label: 'log-loss обучения' }, { key: 'hmin', label: 'наименьший вес h' }, { key: 'zmax', label: 'наибольший |z|' }]);
    const data = makeData(90, 83);
    const gx = U.linspace(0, 10, 300);
    let model = null;

    function refit() {
      model = new GBC.GradientBoosting({ loss: 'logistic', mode: 'newton', nEstimators: 30, learningRate: 0.5, maxDepth: s.depth, regLambda: s.lambda }).fit(data.X, data.y);
      draw();
    }

    function draw() {
      const F = model.predictRaw(data.X, s.m);
      const p = F.map(U.sigmoid);
      const g = p.map((pi, i) => pi - data.y[i]);
      const h = p.map((pi) => Math.max(pi * (1 - pi), 1e-12));
      const z = g.map((gi, i) => -gi / h[i]);
      const zc = z.map((v) => Math.max(-ZMAX, Math.min(ZMAX, v)));
      const next = new GBC.RegressionTree({ maxDepth: s.depth, regLambda: s.lambda }).fit(data.X, g, h);
      const hmax = Math.max(...h);
      const gridP = model.predictRaw(gx.map((v) => [v]), s.m).map(U.sigmoid);
      top.render([
        { type: 'line', x: gx, y: gx.map((v) => U.sigmoid(2.5 * Math.sin(0.9 * v))), color: 'truth', dash: '5 4', width: 1.4, label: 'истинная P(y = 1)', hover: false },
        { type: 'points', x: data.x, y: data.y, color: (i) => (data.y[i] ? 'class1' : 'class0'), r: 3.2, label: 'объекты' },
        { type: 'line', x: gx, y: gridP, color: 'model', width: 2.2, label: 'p = σ(F_{' + s.m + '}(x))' },
      ]);
      bot.render([
        { type: 'hline', y: 0, color: 'muted', width: 1 },
        {
          type: 'points', x: data.x, y: zc, color: (i) => (data.y[i] ? 'class1' : 'class0'),
          r: (i) => 1.5 + 6 * Math.sqrt(h[i] / hmax), hollow: false, label: 'z_i (размер ∝ h_i)',
          tooltip: (i) => [['y', data.y[i]], ['p', U.fmt(p[i], 3)], ['g = p − y', U.fmt(g[i], 3)], ['h = p(1 − p)', U.fmt(h[i], 4)], ['z = −g/h', U.fmt(z[i], 3)]],
        },
        { type: 'steps', segments: next.segments1d(0, 10), color: 'tree', width: 2.6, label: 'следующее дерево: w = −G/(H + λ)' },
      ]);
      stats.set('loss', U.fmt(GBC.losses.get('logistic').loss(data.y, F), 4));
      stats.set('hmin', U.fmt(Math.min(...h), 3));
      stats.set('zmax', U.fmt(Math.max(...z.map(Math.abs)), 3));
    }
    refit();
  });
})();
