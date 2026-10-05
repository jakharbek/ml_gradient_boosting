/* Урок 12.2: значения Шепли по определению (все коалиции); сводный график и график зависимости. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));

  GBC.widget('coalitions', (el) => {
    const s = { i: 0, j: 0 };
    const NAMES = ['x0', 'x1', 'x3'];
    const w = ui.shell(el, {
      title: 'Значения Шепли по определению',
      sub: 'Модель на трёх признаках задачи Фридмана (x0, x1, x3): 50 деревьев глубины 2. Для выбранного объекта считаем ценность всех 8 коалиций, затем предельные вклады выбранного признака с весами |S|!(d − |S| − 1)!/d!.',
      stack: true,
    });
    const src = GBC.datasets.friedman1({ n: 600, noise: 1, seed: 180, nFeatures: 7 });
    const X = src.X.map((r) => [r[0], r[1], r[3]]);
    const model = new GBC.GradientBoosting({ nEstimators: 50, maxDepth: 2, learningRate: 0.2 }).fit(X, src.y);
    ui.slider(w.controls, { label: 'Объект №', min: 0, max: 99, step: 1, value: s.i, format: String, onInput: (v) => ((s.i = v), draw()) });
    ui.segmented(w.controls, { label: 'Признак j', value: s.j, options: NAMES.map((n, k) => ({ value: k, label: n })), onChange: (v) => ((s.j = v), draw()) });
    const left = H('div');
    const right = H('div');
    w.main.append(left, right);
    const stats = ui.stats(w.foot, [{ key: 'phi', label: 'φⱼ по определению' }, { key: 'lib', label: 'φⱼ из explain.shapleyValues' }, { key: 'eff', label: 'φ₀ + Σφ = F(x)?' }]);

    function draw() {
      const x = X[s.i];
      const v = (S) => {
        const known = new Set(S);
        let sum = model.init;
        for (const st of model.trees) sum += model.learningRate * GBC.explain.expectedValue(st[0], x, known);
        return sum;
      };
      const subsets = [[], [0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]];
      const label = (S) => (S.length ? '{' + S.map((k) => NAMES[k]).join(', ') + '}' : '∅');
      left.textContent = '';
      right.textContent = '';
      const t1 = H('table', { class: 'data' },
        H('tr', null, H('th', null, 'Коалиция S'), H('th', { class: 'num' }, 'v(S)')),
        ...subsets.map((S) => H('tr', null, H('td', null, label(S)), H('td', { class: 'num' }, U.fmt(v(S), 4)))));
      left.append(H('p', { class: 'ctl-help' }, 'Объект: ' + NAMES.map((n, k) => n + ' = ' + U.fmt(x[k], 3)).join(', ')), H('div', { class: 'table-wrap' }, t1));
      const j = s.j;
      const others = [0, 1, 2].filter((k) => k !== j);
      const rows = [[], [others[0]], [others[1]], others];
      let phi = 0;
      const tr = rows.map((S) => {
        const wgt = (fact(S.length) * fact(3 - S.length - 1)) / fact(3);
        const delta = v(S.concat([j]).sort()) - v(S);
        phi += wgt * delta;
        return H('tr', null, H('td', null, label(S)), H('td', { class: 'num' }, U.fmt(wgt, 3)), H('td', { class: 'num' }, U.fmt(delta, 4)), H('td', { class: 'num' }, U.fmt(wgt * delta, 4)));
      });
      const t2 = H('table', { class: 'data' },
        H('tr', null, H('th', null, 'S без ' + NAMES[j]), H('th', { class: 'num' }, 'вес'), H('th', { class: 'num' }, 'v(S ∪ j) − v(S)'), H('th', { class: 'num' }, 'вклад')),
        ...tr);
      right.append(H('p', { class: 'ctl-help' }, 'Предельные вклады признака ' + NAMES[j] + ':'), H('div', { class: 'table-wrap' }, t2));
      const lib = GBC.explain.shapleyValues(model, x);
      stats.set('phi', U.fmt(phi, 6));
      stats.set('lib', U.fmt(lib.phi[j], 6));
      stats.set('eff', U.fmt(lib.base + U.sum(lib.phi), 4) + ' = ' + U.fmt(model.predictRaw([x])[0], 4));
    }
    draw();
  });

  GBC.widget('shap-plots', (el) => {
    const s = { feat: 0, color: 1 };
    const d = 7;
    const NAMES = U.range(d).map((j) => 'x' + j);
    const w = ui.shell(el, {
      title: 'Сводный график и график зависимости',
      sub: 'Бустинг из 100 деревьев глубины 3 на задаче Фридмана с 7 признаками; вклады 250 объектов. Цвет — значение признака: синий — малое, красный — большое.',
    });
    const data = GBC.datasets.friedman1({ n: 600, noise: 1, seed: 180, nFeatures: 7 });
    const model = new GBC.GradientBoosting({ nEstimators: 100, maxDepth: 3, learningRate: 0.1 }).fit(data.X, data.y);
    const N = 250;
    const PHI = [];
    for (let i = 0; i < N; i++) PHI.push(GBC.explain.shapleyValues(model, data.X[i]).phi);
    ui.select(w.controls, { label: 'Признак для графика зависимости', value: '0', options: NAMES.map((n, j) => ({ value: String(j), label: n })), onChange: (v) => ((s.feat = Number(v)), drawDep()) });
    ui.select(w.controls, { label: 'Цвет — значение признака', value: '1', options: NAMES.map((n, j) => ({ value: String(j), label: n })), onChange: (v) => ((s.color = Number(v)), drawDep()) });
    const order = U.range(d).sort((a, b) => U.mean(PHI.map((p) => Math.abs(p[b]))) - U.mean(PHI.map((p) => Math.abs(p[a]))));
    const bee = new GBC.Plot(w.main, { height: 280, x: { label: 'вклад в прогноз φⱼ' }, y: { label: '', domain: [-0.7, d - 0.3], ticks: U.range(d), format: (v) => NAMES[order[d - 1 - Math.round(v)]] || '' } });
    const dep = new GBC.Plot(w.main, { height: 250, x: { label: 'x0' }, y: { label: 'φ' } });
    const div = GBC.colors.diverging();
    const colorOf = (v) => GBC.colors.rgbString(div(2 * v - 1));
    const rng = new GBC.RNG(5);
    const jitter = U.range(N).map(() => rng.uniform(-0.3, 0.3));
    bee.render(U.range(d).map((row) => {
      const j = order[d - 1 - row];
      return {
        type: 'points', x: PHI.map((p) => p[j]), y: jitter.map((q) => row + q), r: 2.6,
        color: (i) => colorOf(data.X[i][j]), tooltip: (i) => [[NAMES[j], U.fmt(data.X[i][j], 3)], ['φ', U.fmt(PHI[i][j], 3)]],
      };
    }).concat([{ type: 'vline', x: 0, color: 'muted', width: 1 }]));

    function drawDep() {
      dep.opts.x.label = NAMES[s.feat];
      dep.opts.y.label = 'φ(' + NAMES[s.feat] + ')';
      dep.render([
        { type: 'hline', y: 0, color: 'muted', width: 1 },
        {
          type: 'points', x: U.range(N).map((i) => data.X[i][s.feat]), y: PHI.map((p) => p[s.feat]), r: 3,
          color: (i) => colorOf(data.X[i][s.color]),
          tooltip: (i) => [[NAMES[s.feat], U.fmt(data.X[i][s.feat], 3)], [NAMES[s.color], U.fmt(data.X[i][s.color], 3)], ['φ', U.fmt(PHI[i][s.feat], 3)]],
        },
      ]);
    }
    drawDep();
  });
})();
