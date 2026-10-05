/* Урок 2.2: меры неоднородности и сравнение критериев. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const gini = (p) => 2 * p * (1 - p);
  const entropy = (p) => (p <= 0 || p >= 1 ? 0 : -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p)));
  const miscl = (p) => Math.min(p, 1 - p);
  const variance = (p) => p * (1 - p);

  GBC.widget('impurity-curves', (el) => {
    const s = { p: 0.3, scale: true };
    const w = ui.shell(el, { title: 'Меры неоднородности для двух классов', sub: 'По горизонтали — доля класса 1 в узле. Все меры равны нулю в чистом узле и максимальны при p = 0.5.' });
    ui.slider(w.controls, { label: 'Доля класса 1, p', min: 0, max: 1, step: 0.01, value: s.p, onInput: (v) => ((s.p = v), draw()) });
    ui.toggle(w.controls, { label: 'Нормировать максимум к 1', checked: s.scale, onChange: (v) => ((s.scale = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'доля класса 1, p', domain: [0, 1] }, y: { label: 'неоднородность' }, crosshair: true, crosshairTitle: (v) => 'p = ' + U.fmt(v, 2) });
    const stats = ui.stats(w.foot, [{ key: 'g', label: 'Джини 2p(1−p)' }, { key: 'e', label: 'Энтропия, бит' }, { key: 'm', label: 'Доля ошибок' }, { key: 'v', label: 'Дисперсия p(1−p)' }]);
    function draw() {
      const ps = U.linspace(0, 1, 201);
      const k = s.scale ? { g: 2, e: 1, m: 2, v: 4 } : { g: 1, e: 1, m: 1, v: 1 };
      plot.render([
        { type: 'line', x: ps, y: ps.map((p) => gini(p) * k.g), color: 'blue', label: 'Джини' },
        { type: 'line', x: ps, y: ps.map((p) => entropy(p) * k.e), color: 'orange', label: 'энтропия' },
        { type: 'line', x: ps, y: ps.map((p) => miscl(p) * k.m), color: 'aqua', label: 'доля ошибок' },
        { type: 'line', x: ps, y: ps.map((p) => variance(p) * k.v), color: 'violet', dash: '5 4', label: 'дисперсия меток' },
        { type: 'vline', x: s.p, color: 'ink2', width: 1, dash: '3 3' },
      ], { y: [0, 1.05] });
      stats.set('g', U.fmt(gini(s.p), 3));
      stats.set('e', U.fmt(entropy(s.p), 3));
      stats.set('m', U.fmt(miscl(s.p), 3));
      stats.set('v', U.fmt(variance(s.p), 3));
    }
    draw();
  });

  GBC.widget('criteria-compare', (el) => {
    let d = GBC.datasets.toyClassification();
    const s = { data: 'toy' };
    const w = ui.shell(el, { title: 'Уменьшение неоднородности для каждого порога', sub: 'Верх — объекты двух классов. Низ — выигрыш каждого критерия (нормирован к максимуму). Кликайте по точкам, чтобы менять их класс.' });
    ui.segmented(w.controls, { label: 'Данные', options: [{ value: 'toy', label: '8 точек' }, { value: 'noisy', label: '40 точек' }], value: s.data, onChange: (v) => ((s.data = v), load(), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 150, x: { label: 'x' }, y: { domain: [-0.5, 1.5], hide: true, ticks: [0, 1] }, grid: 'x' });
    const p2 = new GBC.Plot(w.main, { height: 240, x: { label: 'порог t' }, y: { label: 'выигрыш / максимум', domain: [0, 1.08] }, crosshair: true, crosshairTitle: (v) => 't = ' + U.fmt(v, 2) });
    const note = w.note('', true);
    function load() {
      if (s.data === 'toy') d = GBC.datasets.toyClassification();
      else {
        const rng = new GBC.RNG(3);
        const x = U.range(40).map(() => rng.uniform(0, 10)).sort((a, b) => a - b);
        d = { x, X: x.map((v) => [v]), y: x.map((v) => (rng.random() < U.sigmoid(1.4 * (v - 5)) ? 1 : 0)) };
      }
    }
    function scores() {
      const x = d.x;
      const y = d.y;
      const n = y.length;
      const p = U.mean(y);
      const xs = Array.from(new Set(x)).sort((a, b) => a - b);
      const out = [];
      for (let k = 0; k + 1 < xs.length; k++) {
        const t = (xs[k] + xs[k + 1]) / 2;
        const L = y.filter((_, i) => x[i] <= t);
        const R = y.filter((_, i) => x[i] > t);
        const pl = U.mean(L);
        const pr = U.mean(R);
        const dec = (f) => f(p) - (L.length / n) * f(pl) - (R.length / n) * f(pr);
        out.push({ t, gini: dec(gini), entropy: dec(entropy), miscl: dec(miscl) });
      }
      return out;
    }
    function draw() {
      const sc = scores();
      const norm = (key) => {
        const m = Math.max(...sc.map((r) => r[key]), 1e-12);
        return sc.map((r) => r[key] / m);
      };
      const ts = sc.map((r) => r.t);
      const idx = (key) => U.argmax(sc.map((r) => r[key]));
      p1.render([
        { type: 'points', x: d.x, y: d.y, color: (i) => 'class' + d.y[i], legendColor: 'data', r: 6, shape: 'circle', draggable: false, tooltip: (i) => [{ label: 'x', value: U.fmt(d.x[i], 2) }, { label: 'класс', value: String(d.y[i]) }] },
      ]);
      p2.render([
        { type: 'line', x: ts, y: norm('gini'), color: 'blue', label: 'Джини' },
        { type: 'line', x: ts, y: norm('entropy'), color: 'orange', label: 'энтропия' },
        { type: 'line', x: ts, y: norm('miscl'), color: 'aqua', label: 'доля ошибок' },
        { type: 'points', x: ts, y: norm('gini'), color: 'blue', r: 3, legend: false },
      ]);
      const best = { g: ts[idx('gini')], e: ts[idx('entropy')], m: ts[idx('miscl')] };
      note.innerHTML = 'Лучший порог: Джини — ' + U.fmt(best.g, 2) + ', энтропия — ' + U.fmt(best.e, 2) + ', доля ошибок — ' + U.fmt(best.m, 2) + '. ' + (best.g === best.e ? 'Джини и энтропия согласны.' : 'Джини и энтропия разошлись — редкий случай.');
    }
    p1.onClick = (xv) => {
      let bi = 0;
      d.x.forEach((v, i) => {
        if (Math.abs(v - xv) < Math.abs(d.x[bi] - xv)) bi = i;
      });
      d.y[bi] = 1 - d.y[bi];
      draw();
    };
    draw();
  });
})();
