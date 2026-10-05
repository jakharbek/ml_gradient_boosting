/* Урок 9.3: наивные и упорядоченные статистики категорий; симметричные деревья. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  /* ---------------- Упорядоченные статистики ---------------- */

  function makeCatData(n, K, effect, seed) {
    const rng = new GBC.RNG(seed);
    const eff = (() => {
      const r = new GBC.RNG(999);
      return U.range(K).map(() => r.normal(0, 1) * effect);
    })();
    const x = [];
    const c = [];
    const y = [];
    for (let i = 0; i < n; i++) {
      const xi = rng.uniform(0, 10);
      const ci = rng.randint(K);
      x.push(xi);
      c.push(ci);
      y.push(Math.sin(xi) + eff[ci] + rng.normal(0, 0.5));
    }
    return { x, c, y };
  }

  /** Наивная статистика: по всей обучающей выборке, включая сам объект. */
  function naiveTS(ctr, ytr, K, prior, a = 1) {
    const s = new Array(K).fill(0);
    const n = new Array(K).fill(0);
    ctr.forEach((c, i) => {
      s[c] += ytr[i];
      n[c] += 1;
    });
    return U.range(K).map((k) => (s[k] + a * prior) / (n[k] + a));
  }

  /** Упорядоченная статистика: только объекты, стоящие раньше в случайной перестановке. */
  function orderedTS(ctr, ytr, K, prior, seed, a = 1) {
    const perm = new GBC.RNG(seed).permutation(ctr.length);
    const s = new Array(K).fill(0);
    const n = new Array(K).fill(0);
    const out = new Array(ctr.length);
    for (const i of perm) {
      out[i] = (s[ctr[i]] + a * prior) / (n[ctr[i]] + a);
      s[ctr[i]] += ytr[i];
      n[ctr[i]] += 1;
    }
    return out;
  }

  function corr(a, b) {
    const ma = U.mean(a);
    const mb = U.mean(b);
    let sab = 0;
    let saa = 0;
    let sbb = 0;
    for (let i = 0; i < a.length; i++) {
      sab += (a[i] - ma) * (b[i] - mb);
      saa += (a[i] - ma) ** 2;
      sbb += (b[i] - mb) ** 2;
    }
    return sab / Math.sqrt(saa * sbb || 1);
  }

  GBC.widget('ordered-ts', (el) => {
    const s = { K: 200, effect: 0 };
    const w = ui.shell(el, {
      title: 'Утечка в кодировании категорий',
      sub: 'y = sin(x) + эффект категории + шум; 600 объектов для обучения, 400 для теста. По вертикали — y − sin(x): часть ответа, которую может объяснить категория. Синие точки — обучение, бирюзовые — тест. Если облака расположены по-разному, модель, обученная на синих, ошибётся на бирюзовых.',
    });
    ui.slider(w.controls, { label: 'Число категорий K', values: [5, 10, 20, 50, 100, 200, 300], value: s.K, format: String, onInput: (v) => ((s.K = v), draw()) });
    ui.segmented(w.controls, { label: 'Категория влияет на y?', value: s.effect, options: [{ value: 0, label: 'нет (шум)' }, { value: 1, label: 'да' }], onChange: (v) => ((s.effect = v), draw()) });
    const box = GBC.h('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const pN = new GBC.Plot(box, { height: 250, x: { label: 'наивная статистика' }, y: { label: 'y − sin(x)' } });
    const pO = new GBC.Plot(box, { height: 250, x: { label: 'упорядоченная статистика' }, y: { label: 'y − sin(x)' } });
    const stats = ui.stats(w.foot, [
      { key: 'corr', label: 'корреляция с y − sin(x): наивная обуч. / тест' },
      { key: 'mse0', label: 'MSE на тесте: без категории' },
      { key: 'mseN', label: 'с наивной' },
      { key: 'mseO', label: 'с упорядоченной' },
    ]);

    function draw() {
      const d = makeCatData(1000, s.K, s.effect, 1);
      const tr = U.range(600);
      const te = U.range(1000).slice(600);
      const ctr = tr.map((i) => d.c[i]);
      const ytr = tr.map((i) => d.y[i]);
      const yte = te.map((i) => d.y[i]);
      const prior = U.mean(ytr);
      const table = naiveTS(ctr, ytr, s.K, prior);
      const encNtr = ctr.map((c) => table[c]);
      const encTe = te.map((i) => table[d.c[i]]);
      const encOtr = orderedTS(ctr, ytr, s.K, prior, 7);
      const rtr = tr.map((i) => d.y[i] - Math.sin(d.x[i]));
      const rte = te.map((i) => d.y[i] - Math.sin(d.x[i]));
      const layers = (encTr) => [
        { type: 'points', x: encTr, y: rtr, color: 'train', r: 2.2, opacity: 0.6, label: 'обучение' },
        { type: 'points', x: encTe, y: rte, color: 'test', r: 2.2, opacity: 0.6, label: 'тест' },
      ];
      pN.render(layers(encNtr));
      pO.render(layers(encOtr));
      const fitMSE = (Xtr, Xte) => {
        const m = new GBC.GradientBoosting({ nEstimators: 100, learningRate: 0.1, maxDepth: 3 }).fit(Xtr, ytr);
        return GBC.metrics.mse(yte, m.predictRaw(Xte));
      };
      const xtr = tr.map((i) => d.x[i]);
      const xte = te.map((i) => d.x[i]);
      stats.set('corr', U.fmt(corr(encNtr, rtr), 2) + ' / ' + U.fmt(corr(encTe, rte), 2));
      stats.set('mse0', U.fmt(fitMSE(xtr.map((v) => [v]), xte.map((v) => [v])), 3));
      stats.set('mseN', U.fmt(fitMSE(xtr.map((v, k) => [v, encNtr[k]]), xte.map((v, k) => [v, encTe[k]])), 3));
      stats.set('mseO', U.fmt(fitMSE(xtr.map((v, k) => [v, encOtr[k]]), xte.map((v, k) => [v, encTe[k]])), 3));
    }
    draw();
  });

  /* ---------------- Симметричные деревья ---------------- */

  class ObliviousTree {
    constructor(depth, lam = 1, bins = 32) {
      this.depth = depth;
      this.lam = lam;
      this.bins = bins;
    }

    fit(X, g) {
      const n = X.length;
      const d = X[0].length;
      const cands = U.range(d).map((j) => {
        const col = X.map((r) => r[j]);
        const qs = U.range(this.bins - 1).map((k) => U.quantile(col, (k + 1) / this.bins));
        return [...new Set(qs)];
      });
      let leaf = new Array(n).fill(0);
      this.splits = [];
      for (let level = 0; level < this.depth; level++) {
        const L = 2 ** (level + 1);
        let best = { score: -Infinity };
        for (let j = 0; j < d; j++) {
          for (const t of cands[j]) {
            const G = new Float64Array(L);
            const H = new Float64Array(L);
            for (let i = 0; i < n; i++) {
              const k = leaf[i] * 2 + (X[i][j] > t ? 1 : 0);
              G[k] += g[i];
              H[k] += 1;
            }
            let sc = 0;
            for (let k = 0; k < L; k++) sc += (G[k] * G[k]) / (H[k] + this.lam);
            if (sc > best.score) best = { score: sc, j, t };
          }
        }
        this.splits.push([best.j, best.t]);
        leaf = leaf.map((v, i) => v * 2 + (X[i][best.j] > best.t ? 1 : 0));
      }
      const L = 2 ** this.depth;
      const G = new Float64Array(L);
      const H = new Float64Array(L);
      leaf.forEach((k, i) => {
        G[k] += g[i];
        H[k] += 1;
      });
      this.values = Array.from(G, (v, k) => -v / (H[k] + this.lam));
      return this;
    }

    leafOf(x) {
      let k = 0;
      for (const [j, t] of this.splits) k = k * 2 + (x[j] > t ? 1 : 0);
      return k;
    }

    predict(X) {
      return X.map((x) => this.values[this.leafOf(x)]);
    }

    /** Прямоугольники листьев в квадрате [0, 1]². */
    boxes() {
      const out = [];
      for (let k = 0; k < 2 ** this.depth; k++) {
        const b = { x0: 0, x1: 1, y0: 0, y1: 1 };
        this.splits.forEach(([j, t], lvl) => {
          const right = (k >> (this.depth - 1 - lvl)) & 1;
          if (j === 0) right ? (b.x0 = Math.max(b.x0, t)) : (b.x1 = Math.min(b.x1, t));
          else right ? (b.y0 = Math.max(b.y0, t)) : (b.y1 = Math.min(b.y1, t));
        });
        if (b.x0 < b.x1 && b.y0 < b.y1) out.push(Object.assign(b, { value: this.values[k] }));
      }
      return out;
    }
  }

  /** Прямоугольники листьев обычного дерева gbcourse. */
  function treeBoxes(tree) {
    const out = [];
    const walk = (id, b) => {
      const nd = tree.nodes[id];
      if (nd.left < 0) {
        out.push(Object.assign({}, b, { value: nd.value }));
        return;
      }
      const L = Object.assign({}, b);
      const R = Object.assign({}, b);
      if (nd.feature === 0) {
        L.x1 = Math.min(b.x1, nd.threshold);
        R.x0 = Math.max(b.x0, nd.threshold);
      } else {
        L.y1 = Math.min(b.y1, nd.threshold);
        R.y0 = Math.max(b.y0, nd.threshold);
      }
      walk(nd.left, L);
      walk(nd.right, R);
    };
    walk(0, { x0: 0, x1: 1, y0: 0, y1: 1 });
    return out;
  }

  function makeSurface(n, seed) {
    const rng = new GBC.RNG(seed);
    const X = [];
    const y = [];
    for (let i = 0; i < n; i++) {
      const a = rng.random();
      const b = rng.random();
      X.push([a, b]);
      y.push(10 * Math.sin(Math.PI * a * b) + 5 * b + rng.normal(0, 1));
    }
    return { X, y };
  }

  GBC.widget('oblivious-tree', (el) => {
    const s = { depth: 3 };
    const w = ui.shell(el, {
      title: 'Обычное и симметричное дерево',
      sub: 'y = 10·sin(π·x₀·x₁) + 5·x₁ + шум, 500 объектов. Цвет — значение листа. У симметричного дерева все разрезы одного уровня совпадают, поэтому листья образуют решётку. Внизу — одно дерево и бустинг из 100 деревьев (ν = 0.1).',
    });
    ui.slider(w.controls, { label: 'Глубина d', min: 1, max: 5, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const box = GBC.h('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const capA = GBC.h('div', { class: 'ctl-help' });
    const capB = GBC.h('div', { class: 'ctl-help' });
    const colA = GBC.h('div', null, capA);
    const colB = GBC.h('div', null, capB);
    box.append(colA, colB);
    const pA = new GBC.Plot(colA, { height: 260, x: { label: 'x₀', domain: [0, 1] }, y: { label: 'x₁', domain: [0, 1] } });
    const pB = new GBC.Plot(colB, { height: 260, x: { label: 'x₀', domain: [0, 1] }, y: { label: 'x₁', domain: [0, 1] } });
    const stats = ui.stats(w.foot, [
      { key: 'one', label: 'одно дерево, ½MSE на тесте: обычное / симметричное' },
      { key: 'boost', label: 'бустинг, ½MSE на тесте: обычные / симметричные' },
    ]);
    const data = makeSurface(500, 101);
    const test = makeSurface(1500, 102);
    const F0 = U.mean(data.y);
    const cache = {};

    function boostScores(depth) {
      if (cache[depth]) return cache[depth];
      const Ft = new Array(data.y.length).fill(F0);
      const Fs = new Array(data.y.length).fill(F0);
      const Tt = new Array(test.y.length).fill(F0);
      const Ts = new Array(test.y.length).fill(F0);
      for (let m = 0; m < 100; m++) {
        const t1 = new GBC.RegressionTree({ maxDepth: depth, regLambda: 1, maxBins: 32 }).fit(data.X, Ft.map((f, i) => f - data.y[i]));
        const t2 = new ObliviousTree(depth).fit(data.X, Fs.map((f, i) => f - data.y[i]));
        const a1 = t1.predict(data.X);
        const a2 = t2.predict(data.X);
        const b1 = t1.predict(test.X);
        const b2 = t2.predict(test.X);
        for (let i = 0; i < Ft.length; i++) {
          Ft[i] += 0.1 * a1[i];
          Fs[i] += 0.1 * a2[i];
        }
        for (let i = 0; i < Tt.length; i++) {
          Tt[i] += 0.1 * b1[i];
          Ts[i] += 0.1 * b2[i];
        }
      }
      cache[depth] = [GBC.metrics.mse(test.y, Tt) / 2, GBC.metrics.mse(test.y, Ts) / 2];
      return cache[depth];
    }

    function draw() {
      const g = data.y.map((v) => F0 - v);
      const std = new GBC.RegressionTree({ maxDepth: s.depth, regLambda: 1, maxBins: 32 }).fit(data.X, g);
      const obl = new ObliviousTree(s.depth).fit(data.X, g);
      const bA = treeBoxes(std);
      const bB = obl.boxes();
      const vals = bA.concat(bB).map((b) => b.value);
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const col = GBC.colors.sequential();
      const rects = (bs) => bs.map((b) => ({ type: 'rect', x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, fill: GBC.colors.rgbString(col((b.value - lo) / (hi - lo || 1))), opacity: 0.9, stroke: 'surface', width: 1.2 }));
      pA.render(rects(bA));
      pB.render(rects(bB));
      capA.textContent = 'Обычное: ' + bA.length + ' листьев';
      capB.textContent = 'Симметричное: ' + bB.length + ' непустых из ' + 2 ** s.depth;
      const one = (t) => GBC.metrics.mse(test.y, t.predict(test.X).map((v) => v + F0)) / 2;
      stats.set('one', U.fmt(one(std), 3) + ' / ' + U.fmt(one(obl), 3));
      const [b1, b2] = boostScores(s.depth);
      stats.set('boost', U.fmt(b1, 3) + ' / ' + U.fmt(b2, 3));
    }
    draw();
  });
})();
