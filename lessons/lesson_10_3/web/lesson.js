/* Урок 10.3: бустинг на асимметричной квадратичной потере (свои g и h). */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  /** Лучшая константа асимметричной потери (экспектиль): несколько шагов Ньютона от среднего. */
  function bestConstant(y, alpha) {
    let c = U.mean(y);
    for (let it = 0; it < 50; it++) {
      let g = 0;
      let h = 0;
      for (const v of y) {
        const r = v - c;
        g += r > 0 ? -alpha * r : -r;
        h += r > 0 ? alpha : 1;
      }
      c -= g / h;
    }
    return c;
  }

  /** Бустинг второго порядка со своей потерей: на каждом шаге дерево по (g, h). */
  function boostAsym(X, y, alpha, nTrees = 150, lr = 0.1) {
    const F0 = bestConstant(y, alpha);
    const F = new Array(y.length).fill(F0);
    const trees = [];
    for (let m = 0; m < nTrees; m++) {
      const g = y.map((v, i) => (v - F[i] > 0 ? -alpha * (v - F[i]) : -(v - F[i])));
      const h = y.map((v, i) => (v - F[i] > 0 ? alpha : 1));
      const t = new GBC.RegressionTree({ maxDepth: 2, minSamplesLeaf: 10 }).fit(X, g, h);
      const u = t.predict(X);
      for (let i = 0; i < F.length; i++) F[i] += lr * u[i];
      trees.push(t);
    }
    return (Xn) => {
      const out = new Array(Xn.length).fill(F0);
      for (const t of trees) {
        const u = t.predict(Xn);
        for (let i = 0; i < out.length; i++) out[i] += lr * u[i];
      }
      return out;
    };
  }

  const cost = (y, p, alpha) => U.mean(y.map((v, i) => {
    const r = v - p[i];
    return 0.5 * (r > 0 ? alpha : 1) * r * r;
  }));

  GBC.widget('asymmetric', (el) => {
    const s = { alpha: 5 };
    const w = ui.shell(el, {
      title: 'Недопрогноз дороже в α раз',
      sub: 'Волна, шум растёт с x. 400 объектов для обучения, 2000 для теста. Бустинг второго порядка со своими g и h: 150 деревьев глубины 2, ν = 0.1. Серая линия — обычная L2-модель (α = 1).',
    });
    ui.slider(w.controls, { label: 'Цена недопрогноза α', values: [1, 1.5, 2, 3, 5, 10, 20], value: s.alpha, format: String, onInput: (v) => ((s.alpha = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const stats = ui.stats(w.foot, [
      { key: 'under', label: 'доля недопрогнозов на тесте: α-модель / L2' },
      { key: 'cost', label: 'асимметричная цена на тесте: α-модель / L2' },
      { key: 'tau', label: 'уровень экспектиля α/(1+α)' },
    ]);
    const tr = GBC.datasets.regression1d({ kind: 'hetero', n: 400, noise: 0.5, seed: 161 });
    const te = GBC.datasets.regression1d({ kind: 'hetero', n: 2000, noise: 0.5, seed: 162 });
    const gx = U.linspace(0, 10, 300).map((v) => [v]);
    const base = boostAsym(tr.X, tr.y, 1);
    const baseGrid = base(gx);
    const baseTe = base(te.X);
    const cache = {};

    function draw() {
      if (!cache[s.alpha]) cache[s.alpha] = boostAsym(tr.X, tr.y, s.alpha);
      const f = cache[s.alpha];
      const pTe = f(te.X);
      plot.render([
        { type: 'points', x: tr.x, y: tr.y, color: 'data', r: 2.3, opacity: 0.6, label: 'данные' },
        { type: 'line', x: gx.map((r) => r[0]), y: baseGrid, color: 'muted', width: 2, label: 'L2 (α = 1)' },
        { type: 'line', x: gx.map((r) => r[0]), y: f(gx), color: 'model', width: 2.4, label: 'α = ' + s.alpha },
      ]);
      const under = (p) => U.mean(te.y.map((v, i) => (v > p[i] ? 1 : 0)));
      stats.set('under', U.fmt(under(pTe), 2) + ' / ' + U.fmt(under(baseTe), 2));
      stats.set('cost', U.fmt(cost(te.y, pTe, s.alpha), 3) + ' / ' + U.fmt(cost(te.y, baseTe, s.alpha), 3));
      stats.set('tau', U.fmt(s.alpha / (1 + s.alpha), 3));
    }
    draw();
  });
})();
