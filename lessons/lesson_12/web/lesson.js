/* Урок 12: разложение прогноза одного объекта на вклады признаков (точные значения Шепли). */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('explain-one', (el) => {
    const s = { i: 0 };
    const w = ui.shell(el, {
      title: 'Почему у объекта такой прогноз',
      sub: 'Бустинг из 100 деревьев глубины 3 на задаче Фридмана с 7 признаками (x5, x6 — шум). Слева направо: база φ₀ (средний прогноз), затем вклад каждого признака; последний столбец — итоговый прогноз. Снизу — глобальная важность: средний |φⱼ| по 200 объектам.',
    });
    const data = GBC.datasets.friedman1({ n: 600, noise: 1, seed: 180, nFeatures: 7 });
    const d = 7;
    const model = new GBC.GradientBoosting({ nEstimators: 100, maxDepth: 3, learningRate: 0.1 }).fit(data.X, data.y);
    ui.slider(w.controls, { label: 'Объект №', min: 0, max: 199, step: 1, value: s.i, format: String, onInput: (v) => ((s.i = v), draw()) });
    const vals = GBC.h('div', { class: 'ctl-help' });
    w.controls.appendChild(vals);
    const box = w.main;
    const wf = new GBC.Plot(box, { height: 260, x: { label: '', domain: [-0.6, d + 1.6], ticks: U.range(d + 2), format: (v) => (Math.round(v) === 0 ? 'φ₀' : Math.round(v) === d + 1 ? 'F(x)' : 'x' + (Math.round(v) - 1)) }, y: { label: 'прогноз' } });
    const gl = new GBC.Plot(box, { height: 180, x: { label: '', domain: [-0.6, d - 0.4], ticks: U.range(d), format: (v) => 'x' + Math.round(v) }, y: { label: 'средний |φ|' } });
    const stats = ui.stats(w.foot, [{ key: 'base', label: 'база φ₀' }, { key: 'sum', label: 'φ₀ + Σφ' }, { key: 'fx', label: 'прогноз модели F(x)' }, { key: 'y', label: 'истинный y' }]);
    const global = new Array(d).fill(0);
    for (let i = 0; i < 200; i++) {
      const r = GBC.explain.shapleyValues(model, data.X[i]);
      for (let j = 0; j < d; j++) global[j] += Math.abs(r.phi[j]) / 200;
    }
    gl.render([{ type: 'bars', x: U.range(d), y: global, width: 0.6, maxPx: 36, color: (j) => (j < 5 ? 'model' : 'muted'), tooltip: (j) => [['x' + j, U.fmt(global[j], 3)]] }]);

    function draw() {
      const x = data.X[s.i];
      const r = GBC.explain.shapleyValues(model, x);
      const fx = model.predictRaw([x])[0];
      // Водопад: каждый столбец начинается там, где закончился предыдущий
      const x0 = [];
      const x1 = [];
      const y0 = [];
      const y1 = [];
      const fills = [];
      let cur = r.base;
      x0.push(-0.35);
      x1.push(0.35);
      y0.push(NaN);
      y1.push(r.base);
      fills.push('muted');
      for (let j = 0; j < d; j++) {
        x0.push(j + 1 - 0.35);
        x1.push(j + 1 + 0.35);
        y0.push(cur);
        y1.push(cur + r.phi[j]);
        fills.push(r.phi[j] >= 0 ? 'pos' : 'neg');
        cur += r.phi[j];
      }
      x0.push(d + 1 - 0.35);
      x1.push(d + 1 + 0.35);
      y0.push(NaN);
      y1.push(fx);
      fills.push('model');
      const finite = y0.concat(y1).filter(Number.isFinite);
      const lo = Math.min(...finite);
      const hi = Math.max(...finite);
      const pad = 0.12 * (hi - lo || 1);
      const bottom = lo - pad;
      y0[0] = bottom;
      y0[d + 1] = bottom;
      wf.render([
        ...x0.map((_, k) => ({ type: 'rect', x0: x0[k], x1: x1[k], y0: y0[k], y1: y1[k], fill: fills[k], opacity: 0.85 })),
        {
          type: 'text',
          items: r.phi
            .map((p, j) => ({ p, j }))
            .filter(({ p }) => Math.abs(p) > 0.06 * (hi - lo))
            .map(({ p, j }) => ({ x: j + 1, y: Math.max(y0[j + 1], y1[j + 1]) + pad * 0.25, text: (p >= 0 ? '+' : '−') + U.fmt(Math.abs(p), 2), anchor: 'middle' })),
        },
      ], { y: [bottom, hi + pad] });
      vals.textContent = 'Признаки объекта: ' + x.map((v, j) => 'x' + j + ' = ' + U.fmt(v, 2)).join(', ');
      stats.set('base', U.fmt(r.base, 4));
      stats.set('sum', U.fmt(r.base + U.sum(r.phi), 4));
      stats.set('fx', U.fmt(fx, 4));
      stats.set('y', U.fmt(data.y[s.i], 3));
    }
    draw();
  });
})();
