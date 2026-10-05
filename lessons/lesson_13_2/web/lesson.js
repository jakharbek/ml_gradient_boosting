/* Урок 13.2: калибровка (Платт, изотоническая) и интервалы (квантили, сплит-конформный, CQR). */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  /** Метод Платта: логистическая регрессия p' = σ(aF + b) методом Ньютона. */
  function plattFit(F, y) {
    const loss = (a, b) => {
      let l = 0;
      for (let i = 0; i < F.length; i++) {
        const z = a * F[i] + b;
        l += Math.max(z, 0) + Math.log1p(Math.exp(-Math.abs(z))) - y[i] * z;
      }
      return l;
    };
    let a = 1;
    let b = 0;
    for (let it = 0; it < 100; it++) {
      let ga = 0;
      let gb = 0;
      let haa = 1e-9;
      let hab = 0;
      let hbb = 1e-9;
      for (let i = 0; i < F.length; i++) {
        const p = U.sigmoid(a * F[i] + b);
        const r = p - y[i];
        const w = p * (1 - p);
        ga += r * F[i];
        gb += r;
        haa += w * F[i] * F[i];
        hab += w * F[i];
        hbb += w;
      }
      const det = haa * hbb - hab * hab;
      const da = (hbb * ga - hab * gb) / det;
      const db = (haa * gb - hab * ga) / det;
      // Шаг Ньютона с дроблением: при насыщенных логитах полный шаг может «перелететь»
      const cur = loss(a, b);
      let t = 1;
      while (t > 1e-6 && loss(a - t * da, b - t * db) > cur) t /= 2;
      a -= t * da;
      b -= t * db;
      if (Math.abs(t * da) + Math.abs(t * db) < 1e-10) break;
    }
    return { a, b, predict: (Fn) => Fn.map((f) => U.sigmoid(a * f + b)) };
  }

  /** Изотоническая регрессия (PAV) y по p; прогноз — ступенчатая функция. */
  function isotonicFit(p, y) {
    const order = U.range(p.length).sort((i, j) => p[i] - p[j]);
    const blocks = [];
    for (const i of order) {
      blocks.push({ lo: p[i], hi: p[i], sum: y[i], n: 1 });
      while (blocks.length > 1 && blocks[blocks.length - 2].sum / blocks[blocks.length - 2].n >= blocks[blocks.length - 1].sum / blocks[blocks.length - 1].n) {
        const bl = blocks.pop();
        const prev = blocks[blocks.length - 1];
        prev.sum += bl.sum;
        prev.n += bl.n;
        prev.hi = bl.hi;
      }
    }
    return {
      predict: (pn) => pn.map((v) => {
        let k = 0;
        while (k < blocks.length - 1 && v > blocks[k].hi) k++;
        return blocks[k].sum / blocks[k].n;
      }),
    };
  }

  const ece = (y, p, bins = 10) => {
    const r = GBC.reliability(y, p, bins);
    return U.sum(r.map((q) => (q.n / p.length) * Math.abs(q.conf - q.acc)));
  };
  // Та же функция диаграммы надёжности, что в уроке 13
  GBC.reliability = GBC.reliability || function (y, p, bins = 10) {
    const out = [];
    for (let b = 0; b < bins; b++) {
      const idx = [];
      for (let i = 0; i < p.length; i++) if (Math.min(bins - 1, Math.floor(p[i] * bins)) === b) idx.push(i);
      if (idx.length) out.push({ conf: U.mean(idx.map((i) => p[i])), acc: U.mean(idx.map((i) => y[i])), n: idx.length });
    }
    return out;
  };

  GBC.widget('calibrate', (el) => {
    const s = { method: 'platt' };
    const w = ui.shell(el, {
      title: 'Калибровка на отложенной выборке',
      sub: 'Переобученный бустинг (500 деревьев, ν = 0.3, глубина 4) на «лунах». Калибратор обучается на 300 отложенных объектах, проверка — на 3000 тестовых. Серая линия — до калибровки, синяя — после.',
    });
    const all = GBC.datasets.classification2d({ kind: 'moons', n: 900, noise: 0.35, seed: 190 });
    const te = GBC.datasets.classification2d({ kind: 'moons', n: 3000, noise: 0.35, seed: 191 });
    const Xtr = all.X.slice(0, 600);
    const ytr = all.y.slice(0, 600);
    const Xca = all.X.slice(600);
    const yca = all.y.slice(600);
    const model = new GBC.GradientBoosting({ loss: 'logistic', nEstimators: 500, learningRate: 0.3, maxDepth: 4 }).fit(Xtr, ytr);
    const Fca = model.predictRaw(Xca);
    const Fte = model.predictRaw(te.X);
    const pte = Fte.map(U.sigmoid);
    const platt = plattFit(Fca, yca);
    const iso = isotonicFit(Fca.map(U.sigmoid), yca);
    ui.segmented(w.controls, { label: 'Метод', value: s.method, options: [{ value: 'none', label: 'без калибровки' }, { value: 'platt', label: 'Платт' }, { value: 'iso', label: 'изотоническая' }], onChange: (v) => ((s.method = v), draw()) });
    const note = GBC.h('p', { class: 'ctl-help' }, 'Платт: p′ = σ(' + U.fmt(platt.a, 3) + '·F + ' + U.fmt(platt.b, 3) + ')');
    w.controls.appendChild(note);
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'средний прогноз в корзине', domain: [0, 1] }, y: { label: 'доля класса 1', domain: [0, 1] }, equal: true });
    const stats = ui.stats(w.foot, [{ key: 'ece', label: 'ECE: до → после' }, { key: 'll', label: 'log-loss: до → после' }, { key: 'acc', label: 'точность после' }]);

    function draw() {
      const p = s.method === 'none' ? pte : s.method === 'platt' ? platt.predict(Fte) : iso.predict(pte);
      const r0 = GBC.reliability(te.y, pte);
      const r1 = GBC.reliability(te.y, p);
      plot.render([
        { type: 'line', x: [0, 1], y: [0, 1], color: 'muted', dash: '4 3', width: 1.2, hover: false },
        { type: 'line', x: r0.map((q) => q.conf), y: r0.map((q) => q.acc), color: 'muted', width: 1.6, label: 'до калибровки' },
        { type: 'line', x: r1.map((q) => q.conf), y: r1.map((q) => q.acc), color: 'model', width: 2.2, label: 'после' },
        { type: 'points', x: r1.map((q) => q.conf), y: r1.map((q) => q.acc), color: 'model', r: 4 },
      ]);
      const clip = (v) => Math.min(1 - 1e-12, Math.max(1e-12, v));
      stats.set('ece', U.fmt(ece(te.y, pte), 3) + ' → ' + U.fmt(ece(te.y, p), 3));
      stats.set('ll', U.fmt(GBC.metrics.logLoss(te.y, pte), 3) + ' → ' + U.fmt(GBC.metrics.logLoss(te.y, p.map(clip)), 3));
      stats.set('acc', U.fmt(U.mean(p.map((v, i) => ((v > 0.5 ? 1 : 0) === te.y[i] ? 1 : 0))), 3));
    }
    draw();
  });

  GBC.widget('intervals', (el) => {
    const s = { method: 'cqr', alpha: 0.1 };
    const w = ui.shell(el, {
      title: 'Интервалы прогноза',
      sub: 'Шум растёт с x. 1000 объектов для обучения, 500 для калибровки, 1500 для теста (точки — часть теста). Бустинг: 200 деревьев, глубина 3, ν = 0.05. Покрытие — доля тестовых объектов внутри интервала.',
    });
    const d = GBC.datasets.regression1d({ kind: 'hetero', n: 3000, noise: 0.5, seed: 220 });
    const perm = new GBC.RNG(1).permutation(3000);
    const pick = (ix) => ({ X: ix.map((i) => d.X[i]), y: ix.map((i) => d.y[i]) });
    const tr = pick(perm.slice(0, 1000));
    const ca = pick(perm.slice(1000, 1500));
    const te = pick(perm.slice(1500));
    const gx = U.linspace(0, 10, 200).map((v) => [v]);
    const P = { nEstimators: 200, learningRate: 0.05, maxDepth: 3 };
    const mid = new GBC.GradientBoosting(P).fit(tr.X, tr.y);
    const cache = {};
    const quant = (a) => {
      if (!cache[a]) cache[a] = new GBC.GradientBoosting(Object.assign({ loss: 'quantile', quantileAlpha: a }, P)).fit(tr.X, tr.y);
      return cache[a];
    };
    const confQ = (scores, alpha) => {
      const sorted = scores.slice().sort((a, b) => a - b);
      const n = sorted.length;
      const k = Math.min(n, Math.ceil((n + 1) * (1 - alpha)));
      return sorted[k - 1];
    };
    ui.segmented(w.controls, { label: 'Метод', value: s.method, options: [{ value: 'quant', label: 'квантили' }, { value: 'split', label: 'сплит-конформный' }, { value: 'cqr', label: 'CQR' }], onChange: (v) => ((s.method = v), draw()) });
    ui.slider(w.controls, { label: 'Целевое покрытие 1 − α', values: [0.8, 0.9, 0.95], value: 1 - s.alpha, format: (v) => Math.round(v * 100) + '%', onInput: (v) => ((s.alpha = Math.round((1 - v) * 100) / 100), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const stats = ui.stats(w.foot, [{ key: 'cov', label: 'покрытие на тесте' }, { key: 'width', label: 'средняя ширина' }, { key: 'q', label: 'поправка q' }]);

    function bounds(X, method, alpha) {
      if (method === 'split') {
        const q = confQ(ca.y.map((v, i) => Math.abs(v - mid.predictRaw([ca.X[i]])[0])), alpha);
        const m = mid.predictRaw(X);
        return { L: m.map((v) => v - q), H: m.map((v) => v + q), q };
      }
      const lo = quant(Math.round((alpha / 2) * 1000) / 1000);
      const hi = quant(Math.round((1 - alpha / 2) * 1000) / 1000);
      let q = 0;
      if (method === 'cqr') {
        const L = lo.predictRaw(ca.X);
        const H = hi.predictRaw(ca.X);
        q = confQ(ca.y.map((v, i) => Math.max(L[i] - v, v - H[i])), alpha);
      }
      return { L: lo.predictRaw(X).map((v) => v - q), H: hi.predictRaw(X).map((v) => v + q), q };
    }

    function draw() {
      const g = bounds(gx, s.method, s.alpha);
      const t = bounds(te.X, s.method, s.alpha);
      const inside = te.y.map((v, i) => v >= t.L[i] && v <= t.H[i]);
      const show = U.range(400);
      plot.render([
        { type: 'area', x: gx.map((r) => r[0]), y0: g.L, y1: g.H, color: 'model', opacity: 0.18, label: 'интервал' },
        { type: 'points', x: show.map((i) => te.X[i][0]), y: show.map((i) => te.y[i]), r: 2.3, color: (k) => (inside[show[k]] ? 'data' : 'critical'), opacity: 0.7, label: 'тест (красные — вне интервала)' },
      ]);
      stats.set('cov', U.fmt(U.mean(inside.map((v) => (v ? 1 : 0))), 3) + ' (цель ' + U.fmt(1 - s.alpha, 2) + ')');
      stats.set('width', U.fmt(U.mean(t.H.map((v, i) => v - t.L[i])), 3));
      stats.set('q', s.method === 'quant' ? '—' : U.fmt(t.q, 3));
    }
    draw();
  });
})();
