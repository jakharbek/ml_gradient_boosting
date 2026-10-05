/* Урок 13: диаграмма надёжности переобучающегося бустинга. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  /** Корзины диаграммы надёжности: средний прогноз, доля класса 1, число объектов. */
  function reliability(y, p, bins = 10) {
    const out = [];
    for (let b = 0; b < bins; b++) {
      const idx = [];
      for (let i = 0; i < p.length; i++) if (Math.min(bins - 1, Math.floor(p[i] * bins)) === b) idx.push(i);
      if (!idx.length) continue;
      out.push({ conf: U.mean(idx.map((i) => p[i])), acc: U.mean(idx.map((i) => y[i])), n: idx.length });
    }
    return out;
  }
  GBC.reliability = reliability;

  GBC.widget('reliability', (el) => {
    const s = { m: 10 };
    const w = ui.shell(el, {
      title: 'Диаграмма надёжности',
      sub: '«Луны» с сильным шумом: 600 объектов для обучения, 3000 для теста. Бустинг, ν = 0.3, глубина 4. Точка — корзина прогнозов: по горизонтали средний прогноз, по вертикали реальная доля класса 1, размер — число объектов. Диагональ — идеальная калибровка.',
    });
    const tr = GBC.datasets.classification2d({ kind: 'moons', n: 600, noise: 0.35, seed: 190 });
    const te = GBC.datasets.classification2d({ kind: 'moons', n: 3000, noise: 0.35, seed: 191 });
    const model = new GBC.GradientBoosting({ loss: 'logistic', nEstimators: 500, learningRate: 0.3, maxDepth: 4 }).fit(tr.X, tr.y);
    const cache = new GBC.StageCache(model, te.X);
    ui.slider(w.controls, { label: 'Деревьев', values: [1, 3, 10, 30, 100, 300, 500], value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'средний прогноз в корзине', domain: [0, 1] }, y: { label: 'доля класса 1', domain: [0, 1] }, equal: true });
    const stats = ui.stats(w.foot, [{ key: 'acc', label: 'точность' }, { key: 'ece', label: 'ECE' }, { key: 'll', label: 'log-loss' }]);

    function draw() {
      const p = Array.from(cache.seek(s.m)).map(U.sigmoid);
      const r = reliability(te.y, p);
      const nmax = Math.max(...r.map((q) => q.n));
      plot.render([
        { type: 'line', x: [0, 1], y: [0, 1], color: 'muted', dash: '4 3', width: 1.2, label: 'идеальная калибровка', hover: false },
        { type: 'line', x: r.map((q) => q.conf), y: r.map((q) => q.acc), color: 'model', width: 1.6 },
        { type: 'points', x: r.map((q) => q.conf), y: r.map((q) => q.acc), color: 'model', r: (i) => 3 + 9 * Math.sqrt(r[i].n / nmax), label: 'корзины', tooltip: (i) => [['средний прогноз', U.fmt(r[i].conf, 3)], ['доля класса 1', U.fmt(r[i].acc, 3)], ['объектов', r[i].n]] },
      ]);
      const ece = U.sum(r.map((q) => (q.n / p.length) * Math.abs(q.conf - q.acc)));
      stats.set('acc', U.fmt(U.mean(p.map((v, i) => ((v > 0.5 ? 1 : 0) === te.y[i] ? 1 : 0))), 3));
      stats.set('ece', U.fmt(ece, 3));
      stats.set('ll', U.fmt(GBC.metrics.logLoss(te.y, p), 3));
    }
    draw();
  });
})();
