/* Урок 13.3: сдвиг данных — экстраполяция деревьев, PSI и состязательная проверка. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;
  const f = (x) => Math.sin(x) + 0.3 * x;

  function sample(n, lo, hi, seed) {
    const rng = new GBC.RNG(seed);
    const x = [];
    const y = [];
    for (let i = 0; i < n; i++) {
      const v = rng.uniform(lo, hi);
      x.push(v);
      y.push(f(v) + rng.normal(0, 0.3));
    }
    return { x, y };
  }

  function psi(old, fresh, bins = 10) {
    const sorted = old.slice().sort((a, b) => a - b);
    const edges = U.range(bins - 1).map((k) => U.quantile(sorted, (k + 1) / bins));
    const hist = (a) => {
      const h = new Array(bins).fill(0);
      for (const v of a) {
        let k = 0;
        while (k < edges.length && v > edges[k]) k++;
        h[k] += 1 / a.length;
      }
      return h.map((p) => Math.max(p, 1e-4));
    };
    const po = hist(old);
    const pn = hist(fresh);
    return U.sum(pn.map((p, k) => (p - po[k]) * Math.log(p / po[k])));
  }

  GBC.widget('drift', (el) => {
    const s = { shift: 1 };
    const w = ui.shell(el, {
      title: 'Сдвиг данных',
      sub: 'Модель обучена на x ∈ [0, 6] (серые точки), новые данные — на [s, 6 + s] (оранжевые). Бустинг: 200 деревьев глубины 3, ν = 0.1. Состязательный классификатор отличает старые данные от новых (100 деревьев глубины 2, AUC на отложенных 30%).',
    });
    const tr = sample(1000, 0, 6, 230);
    const model = new GBC.GradientBoosting({ nEstimators: 200, maxDepth: 3, learningRate: 0.1 }).fit(tr.x.map((v) => [v]), tr.y);
    const gx = U.linspace(-0.5, 10.5, 300);
    const pred = model.predictRaw(gx.map((v) => [v]));
    ui.slider(w.controls, { label: 'Сдвиг s', min: 0, max: 4, step: 0.25, value: s.shift, onInput: (v) => ((s.shift = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [-0.5, 10.5] }, y: { label: 'y' } });
    const stats = ui.stats(w.foot, [{ key: 'rmse', label: 'RMSE на новых данных' }, { key: 'psi', label: 'PSI признака' }, { key: 'auc', label: 'AUC «старые / новые»' }]);
    const cache = {};

    function draw() {
      if (!cache[s.shift]) {
        const fresh = sample(1000, s.shift, 6 + s.shift, 300 + Math.round(s.shift * 4));
        const p = model.predictRaw(fresh.x.map((v) => [v]));
        const rmse = Math.sqrt(U.mean(p.map((v, i) => (v - fresh.y[i]) ** 2)));
        const Z = tr.x.concat(fresh.x).map((v) => [v]);
        const lab = tr.x.map(() => 0).concat(fresh.x.map(() => 1));
        const perm = new GBC.RNG(1).permutation(Z.length);
        const a = perm.slice(0, 1400);
        const b = perm.slice(1400);
        const clf = new GBC.GradientBoosting({ loss: 'logistic', nEstimators: 100, maxDepth: 2, learningRate: 0.1 }).fit(a.map((i) => Z[i]), a.map((i) => lab[i]));
        const auc = GBC.metrics.rocAuc(b.map((i) => lab[i]), clf.predictRaw(b.map((i) => Z[i])));
        cache[s.shift] = { fresh, rmse, auc, psi: psi(tr.x, fresh.x) };
      }
      const c = cache[s.shift];
      plot.render([
        { type: 'vband', x0: 0, x1: 6, color: 'muted', opacity: 0.08 },
        { type: 'points', x: tr.x.slice(0, 250), y: tr.y.slice(0, 250), color: 'data', r: 2.2, opacity: 0.5, label: 'обучение' },
        { type: 'points', x: c.fresh.x.slice(0, 250), y: c.fresh.y.slice(0, 250), color: 'valid', r: 2.2, opacity: 0.6, label: 'новые данные' },
        { type: 'line', x: gx, y: gx.map(f), color: 'truth', dash: '5 4', width: 1.4, label: 'истина', hover: false },
        { type: 'line', x: gx, y: pred, color: 'model', width: 2.4, label: 'модель' },
      ]);
      stats.set('rmse', U.fmt(c.rmse, 3));
      stats.set('psi', U.fmt(c.psi, 3) + (c.psi < 0.1 ? ' (стабильно)' : c.psi < 0.25 ? ' (заметно)' : ' (сильный сдвиг)'));
      stats.set('auc', U.fmt(c.auc, 3));
    }
    draw();
  });
})();
