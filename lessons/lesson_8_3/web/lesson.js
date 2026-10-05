/* Урок 8.3: гистограммный поиск порога и направление пропусков. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  /** Кривая выигрыша по заданным порогам; missLeft: null — пропусков нет. */
  function gainCurve(x, g, h, thresholds, lam, miss) {
    const G = U.sum(g) + (miss ? miss.G : 0);
    const H = U.sum(h) + (miss ? miss.H : 0);
    const S = (a, b) => (a * a) / (b + lam);
    const parent = S(G, H);
    const order = U.range(x.length).sort((a, b) => x[a] - x[b]);
    const out = { left: [], right: [] };
    let k = 0;
    let gl = 0;
    let hl = 0;
    for (const t of thresholds) {
      while (k < order.length && x[order[k]] <= t) {
        gl += g[order[k]];
        hl += h[order[k]];
        k++;
      }
      // пропуски вправо
      out.right.push(0.5 * (S(gl, hl) + S(G - gl, H - hl) - parent));
      if (miss) out.left.push(0.5 * (S(gl + miss.G, hl + miss.H) + S(G - gl - miss.G, H - hl - miss.H) - parent));
    }
    return out;
  }

  function argmax(a) {
    let b = 0;
    for (let i = 1; i < a.length; i++) if (a[i] > a[b]) b = i;
    return b;
  }

  GBC.widget('hist-bins', (el) => {
    const s = { bins: 8 };
    const w = ui.shell(el, {
      title: 'Точный перебор против гистограммы',
      sub: 'Первое дерево для 300 объектов (квадратичная потеря, λ = 1). Серые вертикали — границы квантильных корзин. Снизу: синяя линия — gain всех точных порогов, оранжевые точки — gain порогов-кандидатов гистограммы.',
    });
    ui.slider(w.controls, { label: 'Корзин B (max_bin)', values: [2, 3, 4, 6, 8, 12, 16, 24, 32, 64, 128, 256], value: s.bins, format: String, onInput: (v) => ((s.bins = v), draw()) });
    const top = new GBC.Plot(w.main, { height: 220, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const bot = new GBC.Plot(w.main, { height: 210, x: { label: 'порог', domain: [0, 10] }, y: { label: 'gain' } });
    const stats = ui.stats(w.foot, [{ key: 'exact', label: 'точно: порог / gain' }, { key: 'hist', label: 'гистограмма: порог / gain' }, { key: 'loss', label: 'потеря выигрыша' }, { key: 'cand', label: 'кандидатов' }]);
    const d = GBC.datasets.regression1d({ kind: 'wave', n: 300, noise: 0.5, seed: 88 });
    const F0 = U.mean(d.y);
    const g = d.y.map((v) => F0 - v);
    const h = g.map(() => 1);
    const xs = d.x.slice().sort((a, b) => a - b);
    const exactThr = [];
    for (let i = 0; i < xs.length - 1; i++) if (xs[i + 1] > xs[i]) exactThr.push((xs[i] + xs[i + 1]) / 2);
    const exact = gainCurve(d.x, g, h, exactThr, 1).right;
    const ie = argmax(exact);

    function draw() {
      const edges = GBC.makeBins(d.X, s.bins)[0];
      const hist = gainCurve(d.x, g, h, edges, 1).right;
      const ih = argmax(hist);
      top.render([
        ...edges.map((e) => ({ type: 'vline', x: e, color: 'axis', width: 1, opacity: 0.6 })),
        { type: 'points', x: d.x, y: d.y, color: 'data', r: 2.4, opacity: 0.7, label: 'данные' },
        { type: 'vline', x: exactThr[ie], color: 'model', width: 1.6, dash: '4 3' },
        { type: 'vline', x: edges[ih], color: 'tree', width: 2 },
      ]);
      bot.render([
        { type: 'line', x: exactThr, y: exact, color: 'model', width: 1.6, label: 'точный перебор', curve: 'step' },
        { type: 'points', x: edges, y: hist, color: 'tree', r: 4, label: 'кандидаты гистограммы' },
        { type: 'points', x: [edges[ih]], y: [hist[ih]], color: 'tree', r: 7, hollow: true },
      ]);
      stats.set('exact', U.fmt(exactThr[ie], 3) + ' / ' + U.fmt(exact[ie], 2));
      stats.set('hist', U.fmt(edges[ih], 3) + ' / ' + U.fmt(hist[ih], 2));
      stats.set('loss', U.fmt((100 * (exact[ie] - hist[ih])) / exact[ie], 2) + '%');
      stats.set('cand', edges.length + ' из ' + exactThr.length);
    }
    draw();
  });

  GBC.widget('missing-direction', (el) => {
    const s = { frac: 0.3, mech: 'informative' };
    const NAN_X = -1;
    const w = ui.shell(el, {
      title: 'Куда отправить пропуски',
      sub: 'Часть объектов потеряла значение x (серая колонка NaN слева). Для каждого порога считаем два выигрыша: пропуски влево и пропуски вправо. Лучшая пара «порог + направление» и есть разбиение узла.',
    });
    ui.slider(w.controls, { label: 'Доля пропусков', min: 0.05, max: 0.6, step: 0.05, value: s.frac, onInput: (v) => ((s.frac = v), draw()) });
    ui.segmented(w.controls, { label: 'Кто теряет x', value: s.mech, options: [{ value: 'random', label: 'случайные' }, { value: 'informative', label: 'чаще с большим y' }], onChange: (v) => ((s.mech = v), draw()) });
    const top = new GBC.Plot(w.main, { height: 230, x: { label: 'x (NaN — слева)', domain: [-1.8, 10] }, y: { label: 'y' } });
    const bot = new GBC.Plot(w.main, { height: 210, x: { label: 'порог', domain: [-1.8, 10] }, y: { label: 'gain' } });
    const stats = ui.stats(w.foot, [{ key: 'n', label: 'пропусков' }, { key: 'mean', label: 'средний y: пропуски / остальные' }, { key: 'best', label: 'лучшее разбиение' }]);
    const d = GBC.datasets.regression1d({ kind: 'wave', n: 200, noise: 0.4, seed: 89 });
    const u = (() => {
      const rng = new GBC.RNG(90);
      return d.x.map(() => rng.random());
    })();

    function draw() {
      const med = U.median(d.y);
      const miss = d.y.map((yv, i) => (s.mech === 'random' ? u[i] < s.frac : u[i] < (yv > med ? 1.6 : 0.4) * s.frac));
      const F0 = U.mean(d.y);
      const idx = U.range(d.y.length);
      const obs = idx.filter((i) => !miss[i]);
      const mis = idx.filter((i) => miss[i]);
      const x = obs.map((i) => d.x[i]);
      const g = obs.map((i) => F0 - d.y[i]);
      const h = g.map(() => 1);
      const mg = { G: U.sum(mis.map((i) => F0 - d.y[i])), H: mis.length };
      const xs = x.slice().sort((a, b) => a - b);
      const thr = [];
      for (let i = 0; i < xs.length - 1; i++) if (xs[i + 1] > xs[i]) thr.push((xs[i] + xs[i + 1]) / 2);
      const c = gainCurve(x, g, h, thr, 1, mg);
      const il = argmax(c.left);
      const ir = argmax(c.right);
      const leftWins = c.left[il] >= c.right[ir];
      const bt = leftWins ? thr[il] : thr[ir];
      const rng = new GBC.RNG(91);
      const yMin = Math.min(...d.y);
      const yMax = Math.max(...d.y);
      top.render([
        { type: 'vband', x0: -1.8, x1: -0.2, color: 'grid', opacity: 0.6 },
        { type: 'text', x: NAN_X, y: yMax + 0.45, text: 'NaN', anchor: 'middle', bold: true },
        { type: 'points', x: x, y: obs.map((i) => d.y[i]), color: 'data', r: 2.6, opacity: 0.7, label: 'x известен' },
        { type: 'points', x: mis.map(() => NAN_X + rng.uniform(-0.5, 0.5)), y: mis.map((i) => d.y[i]), color: leftWins ? 'train' : 'valid', r: 2.8, label: leftWins ? 'пропуски → влево' : 'пропуски → вправо' },
        { type: 'vline', x: bt, color: 'tree', width: 2 },
      ], { y: [yMin - 0.3, yMax + 0.8] });
      bot.render([
        { type: 'hline', y: 0, color: 'muted', width: 1 },
        { type: 'line', x: thr, y: c.left, color: 'train', width: 1.8, label: 'пропуски влево', curve: 'step' },
        { type: 'line', x: thr, y: c.right, color: 'valid', width: 1.8, label: 'пропуски вправо', curve: 'step' },
        { type: 'vline', x: bt, color: 'tree', width: 1.4, dash: '4 3' },
      ]);
      stats.set('n', String(mis.length));
      stats.set('mean', U.fmt(U.mean(mis.map((i) => d.y[i])), 3) + ' / ' + U.fmt(U.mean(obs.map((i) => d.y[i])), 3));
      stats.set('best', 'x ≤ ' + U.fmt(bt, 3) + ', пропуски ' + (leftWins ? 'влево' : 'вправо') + ', gain ' + U.fmt(Math.max(c.left[il], c.right[ir]), 2));
    }
    draw();
  });
})();
