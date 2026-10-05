/* Урок 1.2: лучшая константа для разных потерь. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('best-constant', (el) => {
    const base = [2.1, 2.9, 3.3, 3.8, 4.1, 4.4, 4.9, 5.6, 6.2];
    let ys = base.slice();
    const s = { loss: 'squared', c: 3, delta: 1, alpha: 0.9 };
    const w = ui.shell(el, {
      title: 'Какая константа лучше всего?',
      sub: 'Сверху — ответы y_i (перетаскивайте точки влево-вправо, линию c — тоже). Снизу — суммарные потери при прогнозе c. Минимум отмечен точкой.',
    });
    ui.select(w.controls, {
      label: 'Функция потерь',
      options: [{ value: 'squared', label: 'Квадратичная (L2)' }, { value: 'absolute', label: 'Абсолютная (L1)' }, { value: 'huber', label: 'Хьюбер' }, { value: 'quantile', label: 'Квантильная' }],
      value: s.loss, onChange: (v) => ((s.loss = v), sync(), draw()),
    });
    const dCtl = ui.slider(w.controls, { label: 'δ (Хьюбер)', min: 0.2, max: 4, step: 0.1, value: s.delta, onInput: (v) => ((s.delta = v), draw()) });
    const aCtl = ui.slider(w.controls, { label: 'α (квантиль)', min: 0.05, max: 0.95, step: 0.05, value: s.alpha, onInput: (v) => ((s.alpha = v), draw()) });
    const cCtl = ui.slider(w.controls, { label: 'Ваш прогноз c', min: 0, max: 12, step: 0.01, value: s.c, onInput: (v) => ((s.c = v), draw()) });
    ui.button(w.controls, { label: 'Добавить выброс', small: true, onClick: () => ((ys = base.concat([11.5])), draw()) });
    ui.button(w.controls, { label: 'Сбросить точки', small: true, kind: 'ghost', onClick: () => ((ys = base.slice()), draw()) });
    function sync() {
      dCtl.el.hidden = s.loss !== 'huber';
      aCtl.el.hidden = s.loss !== 'quantile';
    }
    const top = new GBC.Plot(w.main, { height: 190, x: { label: 'значение y', domain: [0, 12] }, y: { domain: [-1, 1], hide: true }, grid: 'x' });
    const bottom = new GBC.Plot(w.main, { height: 220, x: { label: 'константа c', domain: [0, 12] }, y: { label: 'Σ L(y_i, c)' }, crosshair: true, crosshairTitle: (v) => 'c = ' + U.fmt(v, 2) });
    const stats = ui.stats(w.foot, [{ key: 'mean', label: 'Среднее' }, { key: 'median', label: 'Медиана' }, { key: 'opt', label: 'Оптимум для потерь' }, { key: 'yours', label: 'Ваши потери / минимум' }]);
    const lossFn = () => GBC.losses.get(s.loss, { delta: s.delta, alpha: s.alpha });
    const total = (c) => {
      const L = lossFn();
      return U.sum(L.pointwise(ys, ys.map(() => c)));
    };
    function optimum() {
      // численно на плотной сетке + точное значение init для потерь
      const grid = U.linspace(0, 12, 2401);
      let best = grid[0];
      let bv = Infinity;
      for (const c of grid) {
        const v = total(c);
        if (v < bv - 1e-12) (bv = v), (best = c);
      }
      // Для L2/L1/квантиля оптимум известен точно (среднее, медиана, квантиль)
      if (s.loss !== 'huber') best = lossFn().init(ys);
      return { c: best, v: total(best) };
    }
    function draw() {
      const opt = optimum();
      const cs = U.linspace(0, 12, 481);
      const mean = U.mean(ys);
      const med = U.median(ys);
      top.render([
        { type: 'vline', x: mean, color: 'model', width: 1.6, dash: '5 4' },
        { type: 'vline', x: med, color: 'tree', width: 1.6, dash: '2 3' },
        { type: 'text', items: [{ x: mean, y: 0.82, dx: 5, text: 'среднее' }, { x: med, y: -0.92, dx: 5, text: 'медиана' }] },
        { type: 'vline', x: s.c, color: 'ink', width: 2, text: 'c', draggable: true, onDrag: (v) => ((s.c = U.clamp(v, 0, 12)), cCtl.set(s.c), draw()) },
        {
          type: 'points', x: ys, y: ys.map((_, i) => ((i % 3) - 1) * 0.35), color: 'data', r: 6, draggable: true,
          onDrag: (i, x) => ((ys[i] = U.clamp(x, 0, 12)), draw()),
          tooltip: (i) => [{ label: 'y', value: U.fmt(ys[i], 2) }, { label: 'потеря в c', value: U.fmt(lossFn().pointwise([ys[i]], [s.c])[0], 3) }],
        },
      ]);
      bottom.render([
        { type: 'line', x: cs, y: cs.map(total), color: 'model', label: 'суммарные потери', width: 2.2 },
        { type: 'points', x: [opt.c], y: [opt.v], color: 'tree', r: 6, label: 'минимум' },
        { type: 'points', x: [s.c], y: [total(s.c)], color: 'ink', r: 5, hollow: true, label: 'ваше c' },
      ]);
      stats.set('mean', U.fmt(mean, 3));
      stats.set('median', U.fmt(med, 3));
      stats.set('opt', U.fmt(opt.c, 2));
      stats.set('yours', U.fmt(total(s.c), 2) + ' / ' + U.fmt(opt.v, 2));
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import get_loss\n\ny = np.array(' + JSON.stringify(ys.map((v) => Number(v.toFixed(3)))) + ')\n' +
      'loss = get_loss("' + s.loss + '", delta=' + U.pyNum(s.delta) + ', alpha=' + U.pyNum(s.alpha) + ')\n' +
      'cs = np.linspace(0, 12, 2401)\ntotal = [loss.pointwise(y, np.full_like(y, c)).sum() for c in cs]\n' +
      'print("численный минимум:", cs[int(np.argmin(total))])\nprint("F0 из loss.init:  ", loss.init(y))\nprint("среднее:", y.mean(), " медиана:", np.median(y))\n'
    );
    sync();
    draw();
  });
})();
