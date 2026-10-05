/* Урок 9.2: рост по уровням против роста по листьям; GOSS против равномерной подвыборки. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  /** 1D-данные с неравномерной сложностью: слева почти прямая, справа — частые колебания. */
  function makeData(n, seed) {
    const rng = new GBC.RNG(seed);
    const f = (x) => (x < 5 ? 0.15 * x : 0.75 + 1.4 * Math.sin(2.2 * (x - 5)));
    const x = [];
    const y = [];
    for (let i = 0; i < n; i++) {
      const xi = rng.uniform(0, 10);
      x.push(xi);
      y.push(f(xi) + rng.normal(0, 0.25));
    }
    return { x, y, X: x.map((v) => [v]), f };
  }

  function maxDepth(tree) {
    let d = 0;
    for (const nd of tree.nodes) if (nd.left < 0 && nd.depth > d) d = nd.depth;
    return d;
  }

  GBC.widget('growth-compare', (el) => {
    const s = { depth: 3, msl: 1 };
    const w = ui.shell(el, {
      title: 'Один бюджет листьев — два порядка роста',
      sub: 'Одно дерево на данных, где слева зависимость почти линейная, а справа — частые колебания. Сверху: рост по уровням (глубина d). Снизу: рост по листьям с тем же числом листьев 2^d.',
    });
    ui.slider(w.controls, { label: 'Глубина d', min: 1, max: 6, step: 1, value: s.depth, format: (v) => v + ' (листьев ' + Math.pow(2, v) + ')', onInput: (v) => ((s.depth = v), draw()) });
    ui.slider(w.controls, { label: 'Минимум объектов в листе', min: 1, max: 30, step: 1, value: s.msl, format: String, onInput: (v) => ((s.msl = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 190, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 190, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const stats = ui.stats(w.foot, [{ key: 'dw', label: 'по уровням: листьев / ½MSE обуч. / ½MSE новые' }, { key: 'lw', label: 'по листьям: листьев / глубина / ½MSE обуч. / ½MSE новые' }]);
    const data = makeData(200, 96);
    const test = makeData(2000, 97);
    const mean = U.mean(data.y);
    const g = data.y.map((v) => mean - v);

    function draw() {
      const L = Math.pow(2, s.depth);
      const dw = new GBC.RegressionTree({ maxDepth: s.depth, minSamplesLeaf: s.msl }).fit(data.X, g);
      const lw = new GBC.RegressionTree({ maxDepth: null, maxLeaves: L, growth: 'leafwise', minSamplesLeaf: s.msl }).fit(data.X, g);
      const loss = (t, d) => {
        const p = t.predict(d.X);
        return U.mean(d.y.map((v, i) => 0.5 * (v - mean - p[i]) ** 2));
      };
      const gx = U.linspace(0, 10, 300);
      const base = (t, plot, label) => plot.render([
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 2.4, opacity: 0.7, label: 'данные' },
        { type: 'line', x: gx, y: gx.map(data.f), color: 'truth', dash: '5 4', width: 1.3, label: 'истина', hover: false },
        { type: 'steps', segments: t.segments1d(0, 10).map((sg) => Object.assign({}, sg, { value: sg.value + mean })), color: 'tree', width: 2.4, label },
      ]);
      base(dw, p1, 'по уровням');
      base(lw, p2, 'по листьям');
      stats.set('dw', dw.nLeaves + ' / ' + U.fmt(loss(dw, data), 3) + ' / ' + U.fmt(loss(dw, test), 3));
      stats.set('lw', lw.nLeaves + ' / ' + maxDepth(lw) + ' / ' + U.fmt(loss(lw, data), 3) + ' / ' + U.fmt(loss(lw, test), 3));
    }
    draw();
  });

  GBC.widget('goss-demo', (el) => {
    const s = { m: 30, a: 0.2, b: 0.1 };
    const REPEATS = 60;
    const w = ui.shell(el, {
      title: 'GOSS против равномерной подвыборки',
      sub: '«Луны», 2000 объектов, бустинг второго порядка после m деревьев. Слева — какие объекты попали в одну выборку GOSS. Справа — сколько процентов выигрыша лучшего разбиения по x₀ теряется в среднем по 60 выборкам: GOSS и равномерная подвыборка того же размера (a + b)·n.',
    });
    ui.slider(w.controls, { label: 'Деревьев в модели m', min: 0, max: 100, step: 5, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'top_rate a', min: 0.05, max: 0.5, step: 0.05, value: s.a, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'other_rate b', min: 0.05, max: 0.5, step: 0.05, value: s.b, onInput: (v) => ((s.b = v), draw()) });
    const row = GBC.h('div', { class: 'plots-2' });
    w.main.appendChild(row);
    const scatter = new GBC.Plot(row, { height: 260, x: { label: 'x₀' }, y: { label: 'x₁' } });
    const bars = new GBC.Plot(row, { height: 260, x: { label: '', domain: [-0.6, 1.6], ticks: [0, 1], format: (v) => (v < 0.5 ? 'равномерно' : 'GOSS') }, y: { label: 'потеря выигрыша, %', domain: [0, 100] } });
    const stats = ui.stats(w.foot, [{ key: 'share', label: 'доля Σ|g| у топ-a объектов' }, { key: 'u', label: 'потеря: равномерно' }, { key: 'g', label: 'потеря: GOSS' }]);
    const data = GBC.datasets.classification2d({ kind: 'moons', n: 2000, noise: 0.25, seed: 93 });
    const model = new GBC.GradientBoosting({ loss: 'logistic', mode: 'newton', nEstimators: 100, learningRate: 0.3, maxDepth: 3 }).fit(data.X, data.y);
    const n = data.y.length;
    const x0 = data.X.map((r) => r[0]);
    const order = U.range(n).sort((i, j) => x0[i] - x0[j]);

    /** Лучший выигрыш по x0 при весах w; возвращает позицию порога и кривую. */
    function curve(g, h, wts) {
      let G = 0;
      let H = 0;
      for (let i = 0; i < n; i++) {
        G += g[i] * wts[i];
        H += h[i] * wts[i];
      }
      const S = (a, b) => (a * a) / (b + 1);
      const out = new Float64Array(n - 1);
      let gl = 0;
      let hl = 0;
      for (let k = 0; k < n - 1; k++) {
        const i = order[k];
        gl += g[i] * wts[i];
        hl += h[i] * wts[i];
        out[k] = 0.5 * (S(gl, hl) + S(G - gl, H - hl) - S(G, H));
      }
      return out;
    }
    function argmax(a) {
      let b = 0;
      for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i;
      return b;
    }

    function draw() {
      const F = model.predictRaw(data.X, s.m);
      const p = F.map(U.sigmoid);
      const g = p.map((pi, i) => pi - data.y[i]);
      const h = p.map((pi) => pi * (1 - pi));
      const full = curve(g, h, new Float64Array(n).fill(1));
      const kb = argmax(full);
      const byAbs = U.range(n).sort((i, j) => Math.abs(g[j]) - Math.abs(g[i]));
      const nTop = Math.round(s.a * n);
      const nOther = Math.round(s.b * n);
      const top = byAbs.slice(0, nTop);
      const rest = byAbs.slice(nTop);
      const totalAbs = U.sum(g.map(Math.abs));
      const rng = new GBC.RNG(98);
      let lossU = 0;
      let lossG = 0;
      let example = null;
      for (let r = 0; r < REPEATS; r++) {
        const wu = new Float64Array(n);
        for (const i of rng.sample(n, nTop + nOther)) wu[i] = n / (nTop + nOther);
        lossU += (full[kb] - full[argmax(curve(g, h, wu))]) / full[kb];
        const wg = new Float64Array(n);
        for (const i of top) wg[i] = 1;
        const pick = rng.sample(rest.length, nOther).map((k) => rest[k]);
        for (const i of pick) wg[i] = (1 - s.a) / s.b;
        lossG += (full[kb] - full[argmax(curve(g, h, wg))]) / full[kb];
        if (r === 0) example = wg;
      }
      lossU = (100 * lossU) / REPEATS;
      lossG = (100 * lossG) / REPEATS;
      const kind = (i) => (example[i] === 1 ? 0 : example[i] > 0 ? 1 : 2);
      const idx = [0, 1, 2].map((k) => U.range(n).filter((i) => kind(i) === k));
      scatter.render([
        { type: 'points', x: idx[2].map((i) => data.X[i][0]), y: idx[2].map((i) => data.X[i][1]), color: 'muted', r: 1.6, opacity: 0.35, label: 'не выбраны' },
        { type: 'points', x: idx[1].map((i) => data.X[i][0]), y: idx[1].map((i) => data.X[i][1]), color: 'valid', r: 2.4, label: 'случайные из остальных (вес ' + U.fmt((1 - s.a) / s.b, 3) + ')' },
        { type: 'points', x: idx[0].map((i) => data.X[i][0]), y: idx[0].map((i) => data.X[i][1]), color: 'model', r: 2.6, label: 'топ по |g| (вес 1)' },
      ]);
      bars.render([
        { type: 'bars', x: [0, 1], y: [lossU, lossG], color: (i) => (i ? 'model' : 'muted'), width: 0.5, tooltip: (i) => [['потеря выигрыша', U.fmt(i ? lossG : lossU, 3) + '%']] },
      ]);
      stats.set('share', U.fmt((100 * U.sum(top.map((i) => Math.abs(g[i])))) / totalAbs, 3) + '%');
      stats.set('u', U.fmt(lossU, 3) + '%');
      stats.set('g', U.fmt(lossG, 3) + '%');
    }
    draw();
  });
})();
