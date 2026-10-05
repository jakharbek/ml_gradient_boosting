/* Урок 13.1: «лямбды» одного запроса и градиентные шаги по оценкам документов. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;
  const REL = [4, 3, 3, 2, 2, 1, 1, 0, 0, 0];

  function dcg(rels, k) {
    let s = 0;
    for (let i = 0; i < Math.min(k, rels.length); i++) s += (2 ** rels[i] - 1) / Math.log2(i + 2);
    return s;
  }

  /** Лямбды документов: с весом |ΔNDCG@k| или без (RankNet). */
  function lambdas(scores, k, weighted) {
    const n = scores.length;
    const order = U.range(n).sort((a, b) => scores[b] - scores[a]);
    const pos = new Array(n);
    order.forEach((d, i) => (pos[d] = i));
    const ideal = dcg(REL.slice().sort((a, b) => b - a), k);
    const disc = (p) => (p < k ? 1 / Math.log2(p + 2) : 0);
    const lam = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (REL[i] <= REL[j]) continue;
        const rho = 1 / (1 + Math.exp(scores[i] - scores[j]));
        const w = weighted ? Math.abs((2 ** REL[i] - 2 ** REL[j]) * (disc(pos[i]) - disc(pos[j]))) / ideal : 1;
        lam[i] += rho * w; // тянуть вверх
        lam[j] -= rho * w; // тянуть вниз
      }
    }
    return { lam, order, ndcg: dcg(order.map((d) => REL[d]), k) / ideal };
  }

  GBC.widget('lambda-toy', (el) => {
    const s = { weighted: true, k: 5, step: 0 };
    const w = ui.shell(el, {
      title: 'Лямбды одного запроса',
      sub: '10 документов с оценками релевантности 4…0. Документы стоят в порядке текущих оценок s (сверху — первый). Стрелка — лямбда: куда и с какой силой документ надо сдвинуть. «Шаг» прибавляет к оценкам η·λ — так двигался бы бустинг, если бы каждое дерево могло точно воспроизвести лямбды.',
    });
    let scores = null;
    const reset = () => {
      const rng = new GBC.RNG(210);
      scores = REL.map(() => rng.normal(0, 1));
      s.step = 0;
    };
    reset();
    ui.segmented(w.controls, { label: 'Градиенты', value: s.weighted ? 1 : 0, options: [{ value: 1, label: 'LambdaRank (вес |ΔNDCG|)' }, { value: 0, label: 'RankNet (без веса)' }], onChange: (v) => ((s.weighted = v === 1), draw()) });
    ui.slider(w.controls, { label: 'k в NDCG@k', values: [3, 5, 10], value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.button(w.controls, { label: 'Шаг (η = 2)', onClick: () => {
      const r = lambdas(scores, s.k, s.weighted);
      const scale = s.weighted ? 2 : 0.2;
      scores = scores.map((v, i) => v + scale * r.lam[i]);
      s.step += 1;
      draw();
    } });
    ui.button(w.controls, { label: 'Сначала', onClick: () => (reset(), draw()) });
    const plot = new GBC.Plot(w.main, { height: 330, x: { label: 'лямбда (вверх → вправо)' }, y: { label: 'позиция', domain: [10.5, 0.5], ticks: U.range(10).map((i) => i + 1) } });
    const stats = ui.stats(w.foot, [{ key: 'ndcg', label: 'NDCG@k' }, { key: 'steps', label: 'шагов' }]);

    function draw() {
      const r = lambdas(scores, s.k, s.weighted);
      const mx = Math.max(...r.lam.map(Math.abs)) || 1;
      const ys = r.order.map((_, p) => p + 1);
      const lamOrdered = r.order.map((d) => r.lam[d] / mx);
      plot.render([
        { type: 'vline', x: 0, color: 'muted', width: 1 },
        { type: 'hline', y: s.k + 0.5, color: 'tree', dash: '4 3', width: 1.2 },
        { type: 'arrows', x1: ys.map(() => 0), y1: ys, x2: lamOrdered, y2: ys, color: 'model', width: 2 },
        {
          type: 'points', x: ys.map(() => 0), y: ys, r: 8,
          color: (i) => GBC.colors.rgbString(GBC.colors.sequential()(REL[r.order[i]] / 4)),
          tooltip: (i) => [['документ', 'd' + r.order[i]], ['релевантность', REL[r.order[i]]], ['оценка s', U.fmt(scores[r.order[i]], 3)], ['лямбда', U.fmt(r.lam[r.order[i]], 4)]],
        },
        { type: 'text', items: ys.map((y, i) => ({ x: -0.95, y, text: 'rel ' + REL[r.order[i]], anchor: 'start' })) },
      ], { x: [-1.05, 1.05] });
      stats.set('ndcg', U.fmt(r.ndcg, 4));
      stats.set('steps', String(s.step));
    }
    draw();
  });
})();
