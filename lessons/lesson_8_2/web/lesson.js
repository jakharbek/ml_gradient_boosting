/* Урок 8.2: выигрыш разбиения по всем порогам одного признака. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  /** Одномерные задачи: g, h в текущей точке F. */
  function makeTask(kind) {
    if (kind === 'regression') {
      const d = GBC.datasets.regression1d({ kind: 'wave', n: 60, noise: 0.4, seed: 82 });
      const F0 = U.mean(d.y);
      return { x: d.x, g: d.y.map((v) => F0 - v), h: d.y.map(() => 1), color: () => 'data' };
    }
    const rng = new GBC.RNG(83);
    const x = [];
    const y = [];
    for (let i = 0; i < 90; i++) {
      const xi = rng.uniform(0, 10);
      x.push(xi);
      y.push(rng.random() < U.sigmoid(2.5 * Math.sin(0.9 * xi)) ? 1 : 0);
    }
    // Текущая модель — три пня второго порядка: веса h уже разные
    const m = new GBC.GradientBoosting({ loss: 'logistic', mode: 'newton', nEstimators: 3, learningRate: 0.5, maxDepth: 1 }).fit(x.map((v) => [v]), y);
    const p = m.predictRaw(x.map((v) => [v])).map(U.sigmoid);
    return { x, g: p.map((pi, i) => pi - y[i]), h: p.map((pi) => pi * (1 - pi)), color: (i) => (y[i] ? 'class1' : 'class0') };
  }

  GBC.widget('split-gain', (el) => {
    const s = { kind: 'regression', lambda: 1, gamma: 0, t: 5 };
    const w = ui.shell(el, {
      title: 'Выигрыш разбиения: все пороги сразу',
      sub: 'Сверху — рабочий отклик z = −g/h каждого объекта (размер точки ∝ h) и значения двух листьев. Снизу — gain для каждого возможного порога. Двигайте порог t, λ и γ.',
    });
    ui.segmented(w.controls, { label: 'Задача', value: s.kind, options: [{ value: 'regression', label: 'регрессия (h = 1)' }, { value: 'classification', label: 'классификация' }], onChange: (v) => ((s.kind = v), setTask()) });
    const tCtl = ui.slider(w.controls, { label: 'Порог t', min: 0, max: 10, step: 0.01, value: s.t, onInput: (v) => ((s.t = v), draw()) });
    ui.slider(w.controls, { label: 'λ (reg_lambda)', min: 0, max: 30, step: 0.5, value: s.lambda, onInput: (v) => ((s.lambda = v), draw()) });
    ui.slider(w.controls, { label: 'γ (gamma)', min: 0, max: 5, step: 0.05, value: s.gamma, onInput: (v) => ((s.gamma = v), draw()) });
    ui.button(w.controls, { label: 'Лучший порог', onClick: () => bestButton() });
    const top = new GBC.Plot(w.main, { height: 230, x: { label: 'x', domain: [0, 10] }, y: { label: 'z = −g/h' } });
    const bot = new GBC.Plot(w.main, { height: 200, x: { label: 'порог t', domain: [0, 10] }, y: { label: 'gain' }, crosshair: true });
    const stats = ui.stats(w.foot, [{ key: 'L', label: 'слева G_L, H_L' }, { key: 'R', label: 'справа G_R, H_R' }, { key: 'w', label: 'w_L, w_R' }, { key: 'gain', label: 'gain при t' }]);
    let task = null;
    let order = null;
    let lastBest = null;

    function setTask() {
      task = makeTask(s.kind);
      order = U.range(task.x.length).sort((a, b) => task.x[a] - task.x[b]);
      draw();
    }

    function score(G, H) {
      return H + s.lambda > 0 ? (G * G) / (H + s.lambda) : 0;
    }

    function draw() {
      const n = order.length;
      const G = U.sum(task.g);
      const H = U.sum(task.h);
      const parent = score(G, H);
      // Все пороги: середины между соседними различными x
      const tx = [];
      const gains = [];
      let gl = 0;
      let hl = 0;
      for (let k = 0; k < n - 1; k++) {
        const i = order[k];
        gl += task.g[i];
        hl += task.h[i];
        const x0 = task.x[i];
        const x1 = task.x[order[k + 1]];
        if (x1 <= x0) continue;
        tx.push((x0 + x1) / 2);
        gains.push(0.5 * (score(gl, hl) + score(G - gl, H - hl) - parent) - s.gamma);
      }
      let ib = 0;
      for (let k = 1; k < gains.length; k++) if (gains[k] > gains[ib]) ib = k;
      lastBest = tx[ib];
      // Суммы для выбранного t
      let GL = 0;
      let HL = 0;
      for (let i = 0; i < n; i++) {
        if (task.x[i] <= s.t) {
          GL += task.g[i];
          HL += task.h[i];
        }
      }
      const GR = G - GL;
      const HR = H - HL;
      const wL = HL + s.lambda > 0 ? -GL / (HL + s.lambda) : 0;
      const wR = HR + s.lambda > 0 ? -GR / (HR + s.lambda) : 0;
      const gainT = 0.5 * (score(GL, HL) + score(GR, HR) - parent) - s.gamma;
      const hmax = Math.max(...task.h);
      const z = task.g.map((g, i) => Math.max(-8, Math.min(8, -g / task.h[i])));
      top.render([
        { type: 'hline', y: 0, color: 'muted', width: 1 },
        { type: 'points', x: task.x, y: z, color: task.color, r: (i) => 1.5 + 5 * Math.sqrt(task.h[i] / hmax), opacity: 0.85, label: 'z_i' },
        { type: 'vline', x: s.t, color: 'ink', width: 1.4 },
        { type: 'segments', x1: [0, s.t], x2: [s.t, 10], y1: [wL, wR], y2: [wL, wR], color: 'tree', width: 3, opacity: 1, label: 'w_L, w_R' },
      ]);
      bot.render([
        { type: 'hline', y: 0, color: 'muted', width: 1 },
        { type: 'line', x: tx, y: gains, color: 'model', width: 2, label: 'gain(t)', curve: 'step' },
        { type: 'vline', x: s.t, color: 'ink', width: 1.4 },
        { type: 'points', x: [tx[ib]], y: [gains[ib]], color: 'tree', r: 5, label: 'лучший порог' },
      ]);
      stats.set('L', U.fmt(GL, 3) + ', ' + U.fmt(HL, 3));
      stats.set('R', U.fmt(GR, 3) + ', ' + U.fmt(HR, 3));
      stats.set('w', U.fmt(wL, 3) + ', ' + U.fmt(wR, 3));
      stats.set('gain', U.fmt(gainT, 4) + (gainT <= 0 ? ' — не выгодно' : ''));
    }

    function bestButton() {
      tCtl.set(lastBest, false);
    }

    setTask();
  });
})();
