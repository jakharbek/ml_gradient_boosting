/* Урок 12.1: пять видов важности на данных с копией признака и шумом. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  const KINDS = [
    { key: 'splits', label: 'разбиений' },
    { key: 'gain', label: 'выигрыш' },
    { key: 'permTe', label: 'перестановка (тест)' },
    { key: 'permTr', label: 'перестановка (обучение)' },
    { key: 'shap', label: 'средний |SHAP|' },
  ];

  GBC.widget('importance-lab', (el) => {
    const s = { copy: true, noise: true, kind: 'splits' };
    const w = ui.shell(el, {
      title: 'Пять важностей на одних данных',
      sub: 'Задача Фридмана с 5 признаками, 1000 объектов (70% обучение), 150 деревьев глубины 4, ν = 0.15. Включайте копию x3 и шумовые признаки и сравнивайте виды важности. x3′ — копия x3 (оранжевые — оба), «шум» — непрерывный шум, «шум01» — бинарный; серые — признаки, которых нет в формуле задачи. Каждый вид нормирован на свой максимум.',
    });
    ui.toggle(w.controls, { label: 'Копия x3 (шум σ = 0.02)', checked: s.copy, onChange: (v) => ((s.copy = v), refit()) });
    ui.toggle(w.controls, { label: 'Шумовые признаки (непрерывный и бинарный)', checked: s.noise, onChange: (v) => ((s.noise = v), refit()) });
    ui.select(w.controls, { label: 'Вид важности', value: s.kind, options: KINDS.map((k) => ({ value: k.key, label: k.label })), onChange: (v) => ((s.kind = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: '' }, y: { label: 'важность / максимум', domain: [0, 1.08] } });
    const stats = ui.stats(w.foot, [{ key: 'mse', label: 'MSE на тесте' }, { key: 'x3', label: 'x3 + x3′ (эта важность)' }]);
    const base = GBC.datasets.friedman1({ n: 1000, noise: 1, seed: 181, nFeatures: 5 });
    const rng = new GBC.RNG(182);
    const copy = base.X.map((r) => r[3] + rng.normal(0, 0.02));
    const nCont = base.X.map(() => rng.random());
    const nBin = base.X.map(() => (rng.random() < 0.5 ? 1 : 0));
    let res = null;

    function refit() {
      const names = ['x0', 'x1', 'x2', 'x3', 'x4'];
      const X = base.X.map((r, i) => {
        const row = r.slice();
        if (s.copy) row.push(copy[i]);
        if (s.noise) row.push(nCont[i], nBin[i]);
        return row;
      });
      if (s.copy) names.push('x3′');
      if (s.noise) names.push('шум', 'шум01');
      const d = names.length;
      const Xtr = X.slice(0, 700);
      const ytr = base.y.slice(0, 700);
      const Xte = X.slice(700);
      const yte = base.y.slice(700);
      const model = new GBC.GradientBoosting({ nEstimators: 150, maxDepth: 4, learningRate: 0.15 }).fit(Xtr, ytr);
      const splits = new Array(d).fill(0);
      const gain = new Array(d).fill(0);
      for (const st of model.trees) for (const nd of st[0].nodes) if (nd.left >= 0) {
        splits[nd.feature] += 1;
        gain[nd.feature] += nd.gain;
      }
      const mse = (a, b) => GBC.metrics.mse(a, b);
      const predict = (Z) => model.predictRaw(Z);
      const pTe = GBC.explain.permutationImportance(predict, Xte, yte, mse, { nRepeats: 3, seed: 0 });
      const pTr = GBC.explain.permutationImportance(predict, Xtr, ytr, mse, { nRepeats: 3, seed: 0 });
      const shap = new Array(d).fill(0);
      const nS = 40;
      for (let i = 0; i < nS; i++) {
        const r = GBC.explain.shapleyValues(model, Xte[i]);
        for (let j = 0; j < d; j++) shap[j] += Math.abs(r.phi[j]) / nS;
      }
      res = { names, splits, gain, permTe: pTe.mean, permTr: pTr.mean, shap, mse: mse(yte, predict(Xte)) };
      draw();
    }

    function draw() {
      const v = res[s.kind];
      const mx = Math.max(...v.map((q) => Math.max(q, 0))) || 1;
      const d = res.names.length;
      plot.opts.x.domain = [-0.6, d - 0.4];
      plot.opts.x.ticks = U.range(d);
      plot.opts.x.format = (q) => res.names[Math.round(q)] || '';
      plot.render([
        {
          type: 'bars', x: U.range(d), y: v.map((q) => Math.max(q, 0) / mx), width: 0.6, maxPx: 44,
          color: (j) => (j < 5 ? (j === 3 ? 'tree' : 'model') : res.names[j] === 'x3′' ? 'tree' : 'muted'),
          tooltip: (j) => [[res.names[j], U.fmt(v[j], 4)]],
        },
      ]);
      stats.set('mse', U.fmt(res.mse, 3));
      const i3 = res.names.indexOf('x3′');
      stats.set('x3', U.fmt(v[3], 3) + (i3 >= 0 ? ' + ' + U.fmt(v[i3], 3) : ''));
    }
    refit();
  });
})();
