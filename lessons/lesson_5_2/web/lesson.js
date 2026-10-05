/* Урок 5.2: значения листьев — среднее псевдо-остатков против линейного поиска. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('leaf-update', (el) => {
    const data = GBC.datasets.regression1d({ kind: 'wave', n: 100, noise: 0.3, seed: 53, outliers: 0.1 });
    const s = { loss: 'absolute', m: 1, alpha: 0.9 };
    const w = ui.shell(el, {
      title: 'Два способа задать значения листьев',
      sub: 'Точки — настоящие остатки y − F_{m−1}. Пунктир — листья как среднее псевдо-остатков, сплошная — оптимальный шаг γ по исходным потерям (TreeBoost). Структура дерева у обоих одна.',
    });
    ui.select(w.controls, { label: 'Потери', options: [{ value: 'absolute', label: 'Абсолютные (L1)' }, { value: 'quantile', label: 'Квантильные' }, { value: 'huber', label: 'Хьюбер (δ = 1)' }, { value: 'squared', label: 'Квадратичные (L2)' }], value: s.loss, onChange: (v) => ((s.loss = v), fit()) });
    const aCtl = ui.slider(w.controls, { label: 'α (квантиль)', min: 0.1, max: 0.9, step: 0.05, value: s.alpha, onInput: (v) => ((s.alpha = v), fit()) });
    const player = ui.player(w.main, { label: 'Итерация m', min: 1, max: 60, value: 1, fps: 3, format: (v) => 'm = ' + v, onChange: (v) => ((s.m = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'остаток y − F_{m−1}' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'before', label: 'Потери до шага' }, { key: 'mean', label: 'после шага: среднее псевдо-остатков' }, { key: 'ls', label: 'после шага: линейный поиск γ' }]);
    let model;
    let staged;
    function fit() {
      aCtl.el.hidden = s.loss !== 'quantile';
      model = new GBC.GradientBoosting({ loss: s.loss, huberDelta: 1, quantileAlpha: s.alpha, nEstimators: 60, learningRate: 1, maxDepth: 2 }).fit(data.X, data.y);
      staged = model.stagedRaw(data.X);
      draw();
    }
    function draw() {
      const m = s.m;
      const loss = model.lossFn;
      const F = staged[m - 1];
      const resid = data.y.map((v, i) => v - F[i]);
      const pseudo = loss.negativeGradient(data.y, F);
      // Та же структура: дерево по псевдо-остаткам; значения — среднее псевдо-остатков
      const tMean = new GBC.RegressionTree({ maxDepth: 2 }).fit(data.X, pseudo.map((v) => -v));
      const tLs = model.trees[m - 1][0];
      const segM = tMean.segments1d(0, 10);
      const segL = tLs.segments1d(0, 10);
      plot.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'points', x: data.x, y: resid, color: 'data', r: 3.4, label: 'остатки y − F' },
        { type: 'steps', segments: segM, color: 'tree', dash: '5 4', width: 2, label: 'среднее псевдо-остатков' },
        { type: 'steps', segments: segL, color: 'tree', width: 2.6, label: 'TreeBoost γ' },
      ], { y: [Math.min(-3, ...resid.map((v) => Math.max(v, -8))), Math.max(3, ...resid.map((v) => Math.min(v, 8)))] });
      const L = (F2) => loss.loss(data.y, F2);
      const Fmean = F.map((f, i) => f + tMean.predictOne(data.X[i]));
      const Fls = F.map((f, i) => f + tLs.predictOne(data.X[i]));
      stats.set('before', U.fmt(L(F), 4));
      stats.set('mean', U.fmt(L(Fmean), 4));
      stats.set('ls', U.fmt(L(Fls), 4));
      note.innerHTML = s.loss === 'squared'
        ? 'Для L2 обе линии совпадают: среднее псевдо-остатков и есть оптимальный шаг.'
        : s.loss === 'absolute'
          ? 'Псевдо-остатки L1 — это ±1, поэтому пунктир живёт в диапазоне [−1, 1]. Линейный поиск берёт медиану настоящих остатков — шаг нужного размера.'
          : 'Линейный поиск подстраивает высоту каждой ступеньки под исходные потери; структура (пороги) у обоих вариантов общая.';
    }
    fit();
  });
})();
