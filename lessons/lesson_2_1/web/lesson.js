/* Урок 2.1: поиск порога решающего пня. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  function scan(x, y) {
    const order = U.argsort(x);
    const xs = order.map((i) => x[i]);
    const ys = order.map((i) => y[i]);
    const n = ys.length;
    const S = U.sum(ys);
    let SL = 0;
    const out = [];
    for (let k = 0; k + 1 < n; k++) {
      SL += ys[k];
      const nL = k + 1;
      const nR = n - nL;
      const SR = S - SL;
      const valid = xs[k] < xs[k + 1];
      const gain = SL * SL / nL + SR * SR / nR - S * S / n;
      out.push({ k, t: (xs[k] + xs[k + 1]) / 2, nL, nR, SL, SR, mL: SL / nL, mR: SR / nR, gain, valid });
    }
    return { xs, ys, S, n, out };
  }

  function sseAt(x, y, t) {
    const L = [];
    const R = [];
    x.forEach((v, i) => (v <= t ? L : R).push(y[i]));
    const sse = (a) => {
      if (!a.length) return 0;
      const m = U.mean(a);
      return U.sum(a.map((v) => (v - m) ** 2));
    };
    return { L, R, mL: L.length ? U.mean(L) : NaN, mR: R.length ? U.mean(R) : NaN, sse: sse(L) + sse(R), sseL: sse(L), sseR: sse(R) };
  }

  GBC.widget('stump-explorer', (el) => {
    const s = { kind: 'step', t: 4.5, n: 50, noise: 0.4, seed: 2 };
    const w = ui.shell(el, { title: 'Найдите лучший порог', sub: 'Перетащите вертикальную линию. Горизонтальные отрезки — средние слева и справа, серые — ошибки. Внизу — SSE для всех порогов.' });
    let data;
    ui.select(w.controls, { label: 'Данные', options: [{ value: 'step', label: 'Ступеньки' }, { value: 'sine', label: 'Синус' }, { value: 'linear', label: 'Прямая' }, { value: 'toy', label: '6 точек (урок 4.1)' }], value: s.kind, onChange: (v) => ((s.kind = v), gen(), draw()) });
    const tCtl = ui.slider(w.controls, { label: 'Порог t', min: 0, max: 10, step: 0.01, value: s.t, onInput: (v) => ((s.t = v), draw()) });
    ui.slider(w.controls, { label: 'Шум σ', min: 0, max: 1.2, step: 0.05, value: s.noise, onInput: (v) => ((s.noise = v), gen(), draw()) });
    ui.button(w.controls, { label: 'Поставить лучший порог', kind: 'primary', small: true, onClick: () => ((s.t = best().t), tCtl.set(s.t), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 190, x: { label: 'порог t', domain: [0, 10] }, y: { label: 'SSE(t)' }, crosshair: true, crosshairTitle: (v) => 't = ' + U.fmt(v, 2) });
    const stats = ui.stats(w.foot, [{ key: 'l', label: 'Слева: n, среднее' }, { key: 'r', label: 'Справа: n, среднее' }, { key: 'sse', label: 'SSE(t)' }, { key: 'best', label: 'Лучший порог / SSE' }]);
    function gen() {
      if (s.kind === 'toy') {
        data = GBC.datasets.toyRegression();
        p1.opts.x.domain = [0, 7];
        p2.opts.x.domain = [0, 7];
      } else {
        data = GBC.datasets.regression1d({ kind: s.kind, n: s.n, noise: s.noise, seed: s.seed });
        p1.opts.x.domain = [0, 10];
        p2.opts.x.domain = [0, 10];
      }
    }
    function best() {
      const sc = scan(data.x, data.y);
      let b = null;
      for (const c of sc.out) if (c.valid && (!b || c.gain > b.gain)) b = c;
      return b;
    }
    function draw() {
      const x = data.x;
      const y = data.y;
      const [lo, hi] = p1.opts.x.domain;
      const r = sseAt(x, y, s.t);
      const pred = x.map((v) => (v <= s.t ? r.mL : r.mR));
      const b = best();
      p1.render([
        { type: 'segments', x1: x, y1: y, x2: x, y2: pred.map((p) => (Number.isNaN(p) ? 0 : p)), color: 'residual', opacity: 0.6 },
        { type: 'points', x, y, color: (i) => (x[i] <= s.t ? 'class0' : 'class1'), legendColor: 'data', r: 4, label: 'данные', tooltip: (i) => [{ label: 'x', value: U.fmt(x[i], 2) }, { label: 'y', value: U.fmt(y[i], 2) }] },
        r.L.length ? { type: 'line', x: [lo, s.t], y: [r.mL, r.mL], color: 'model', width: 2.6, label: 'среднее слева' } : null,
        r.R.length ? { type: 'line', x: [s.t, hi], y: [r.mR, r.mR], color: 'tree', width: 2.6, label: 'среднее справа' } : null,
        { type: 'vline', x: s.t, color: 'ink', width: 2, draggable: true, text: 't = ' + U.fmt(s.t, 2), onDrag: (v) => ((s.t = v), tCtl.set(v), draw()) },
      ]);
      const ts = U.linspace(lo, hi, 400);
      p2.render([
        { type: 'line', x: ts, y: ts.map((t) => sseAt(x, y, t).sse), color: 'model', width: 2, label: 'SSE(t)', curve: 'step' },
        { type: 'points', x: [b.t], y: [sseAt(x, y, b.t).sse], color: 'tree', r: 5, label: 'минимум' },
        { type: 'vline', x: s.t, color: 'ink', width: 1.2, dash: '3 3' },
      ]);
      stats.set('l', r.L.length + ', ' + U.fmt(r.mL, 3));
      stats.set('r', r.R.length + ', ' + U.fmt(r.mR, 3));
      stats.set('sse', U.fmt(r.sse, 3));
      stats.set('best', U.fmt(b.t, 3) + ' / ' + U.fmt(sseAt(x, y, b.t).sse, 3));
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, RegressionTree\n\n' +
      (s.kind === 'toy' ? 'X, y = datasets.toy_regression()\n' : 'X, y = datasets.regression_1d(kind="' + s.kind + '", n=' + s.n + ', noise=' + U.pyNum(s.noise) + ', seed=' + s.seed + ')\n') +
      't = ' + U.pyNum(s.t) + '\nleft = X[:, 0] <= t\nsse = ((y[left] - y[left].mean())**2).sum() + ((y[~left] - y[~left].mean())**2).sum()\nprint("SSE при t =", t, ":", sse)\n\nstump = RegressionTree(max_depth=1).fit(X, -y)\nprint("лучший порог:", stump.nodes[0].threshold)\n'
    );
    gen();
    draw();
  });

  GBC.widget('stump-scan', (el) => {
    const d = GBC.datasets.toyRegression();
    const sc = scan(d.x, d.y);
    el.textContent = '';
    el.appendChild(H('p', { class: 'widget-note' }, 'Шесть точек урока 4.1: x = [1…6], y = [2, 4, 3, 7, 9, 11]. S = ' + sc.S + ', n = ' + sc.n + ', S²/n = ' + U.fmt((sc.S * sc.S) / sc.n, 3) + '.'));
    let bestK = 0;
    sc.out.forEach((c) => {
      if (c.gain > sc.out[bestK].gain) bestK = c.k;
    });
    ui.table(el, {
      columns: ['порог t', 'n_L', 'S_L', 'S_R', 'ȳ_L', 'ȳ_R', 'S_L²/n_L + S_R²/n_R', 'выигрыш Δ'],
      rows: sc.out.map((c) => [c.t, c.nL, c.SL, c.SR, c.mL, c.mR, c.SL * c.SL / c.nL + c.SR * c.SR / c.nR, c.gain]),
      highlight: (i) => i === bestK,
    });
    el.appendChild(H('p', { class: 'widget-note' }, 'Лучший порог — 3.5: слева средние 3, справа 9, выигрыш 3·3/6·(3 − 9)² = 54.'));
  });
})();
