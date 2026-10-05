/* Урок 8.1: приближения Тейлора для потерь одного объекта; единицы шага первого и второго порядка. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  /** Потери одного объекта как функция сырого прогноза F: значение, g, h. */
  const LOSSES = {
    squared: { title: 'Квадратичная, y = 1', y: 1, f: (F, y) => 0.5 * (F - y) ** 2, g: (F, y) => F - y, h: () => 1 },
    logistic: {
      title: 'Логистическая, y = 1', y: 1,
      f: (F, y) => Math.max(F, 0) + Math.log1p(Math.exp(-Math.abs(F))) - y * F,
      g: (F, y) => U.sigmoid(F) - y,
      h: (F) => U.sigmoid(F) * (1 - U.sigmoid(F)),
    },
    poisson: { title: 'Пуассон, y = 3', y: 3, f: (F, y) => Math.exp(F) - y * F, g: (F, y) => Math.exp(F) - y, h: (F) => Math.exp(F) },
    huber: {
      title: 'Хьюбер (δ = 1), y = 0', y: 0,
      f: (F, y) => (Math.abs(F - y) <= 1 ? 0.5 * (F - y) ** 2 : Math.abs(F - y) - 0.5),
      g: (F, y) => Math.max(-1, Math.min(1, F - y)),
      h: (F, y) => (Math.abs(F - y) <= 1 ? 1 : 0),
    },
    pseudohuber: {
      title: 'Псевдо-Хьюбер (δ = 1), y = 0', y: 0,
      f: (F, y) => Math.sqrt(1 + (F - y) ** 2) - 1,
      g: (F, y) => (F - y) / Math.sqrt(1 + (F - y) ** 2),
      h: (F, y) => Math.pow(1 + (F - y) ** 2, -1.5),
    },
    absolute: { title: 'Абсолютная, y = 0', y: 0, f: (F, y) => Math.abs(F - y), g: (F, y) => Math.sign(F - y), h: () => 0 },
  };

  GBC.widget('taylor-loss', (el) => {
    const s = { loss: 'logistic', F: -1, order: 2 };
    const w = ui.shell(el, {
      title: 'Потери одного объекта и их приближения',
      sub: 'По горизонтали — шаг w, на который мы сдвигаем текущий прогноз F. Синяя кривая — точные потери L(y, F + w), серая прямая — приближение 1-го порядка, оранжевая парабола — 2-го. Двигайте F: парабола хороша рядом с w = 0 и может ошибаться вдали.',
    });
    ui.select(w.controls, { label: 'Функция потерь', value: s.loss, options: Object.entries(LOSSES).map(([k, v]) => ({ value: k, label: v.title })), onChange: (v) => ((s.loss = v), draw()) });
    ui.slider(w.controls, { label: 'Текущий прогноз F', min: -3, max: 3, step: 0.05, value: s.F, onInput: (v) => ((s.F = v), draw()) });
    ui.segmented(w.controls, { label: 'Показать приближения', value: s.order, options: [{ value: 1, label: 'до 1-го' }, { value: 2, label: 'до 2-го' }], onChange: (v) => ((s.order = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'шаг w', domain: [-4, 4] }, y: { label: 'L(y, F + w)' }, crosshair: true });
    const stats = ui.stats(w.foot, [{ key: 'g', label: 'g' }, { key: 'h', label: 'h' }, { key: 'newton', label: 'шаг Ньютона −g/h' }, { key: 'best', label: 'лучший шаг на [−4, 4]' }]);
    const ws = U.linspace(-4, 4, 401);

    function draw() {
      const L = LOSSES[s.loss];
      const y = L.y;
      const L0 = L.f(s.F, y);
      const g = L.g(s.F, y);
      const h = L.h(s.F, y);
      const exact = ws.map((v) => L.f(s.F + v, y));
      const lo = Math.min(...exact);
      const hi = Math.max(...exact);
      const pad = 0.15 * (hi - lo || 1);
      const clip = (v) => Math.max(lo - 3 * pad, Math.min(hi + 3 * pad, v));
      let ib = 0;
      for (let i = 1; i < exact.length; i++) if (exact[i] < exact[ib] - 1e-12) ib = i;
      const layers = [
        { type: 'line', x: ws, y: exact, color: 'model', width: 2.6, label: 'точные потери' },
        { type: 'line', x: ws, y: ws.map((v) => clip(L0 + g * v)), color: 'muted', width: 1.6, dash: '6 4', label: '1-й порядок: L₀ + g·w' },
        { type: 'points', x: [0], y: [L0], color: 'model', r: 5, label: 'текущий прогноз' },
      ];
      const newton = h > 1e-12 ? -g / h : null;
      if (s.order === 2) {
        layers.push({ type: 'line', x: ws, y: ws.map((v) => clip(L0 + g * v + 0.5 * h * v * v)), color: 'tree', width: 2, label: '2-й порядок: + ½h·w²' });
        if (newton !== null && Math.abs(newton) <= 4) {
          layers.push({ type: 'vline', x: newton, color: 'tree', dash: '3 3', width: 1.2, text: 'Ньютон' });
          layers.push({ type: 'points', x: [newton], y: [L.f(s.F + newton, y)], color: 'tree', r: 5, label: 'потери после шага Ньютона' });
        }
      }
      plot.render(layers, { y: [lo - pad, hi + pad] });
      stats.set('g', U.fmt(g, 4));
      stats.set('h', U.fmt(h, 4));
      stats.set('newton', newton === null ? 'не определён (h = 0)' : U.fmt(newton, 3));
      const edge = ib === 0 || ib === ws.length - 1;
      stats.set('best', U.fmt(ws[ib], 2) + (edge ? ' (край: минимум дальше)' : ''));
    }
    draw();
  });

  /** Пуассоновская выборка (Кнут; для средних до ~200 достаточно точно в double). */
  function poisson(rng, mu) {
    if (mu > 60) return Math.max(0, Math.round(rng.normal(mu, Math.sqrt(mu))));
    const Lm = Math.exp(-mu);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng.random();
    } while (p > Lm);
    return k - 1;
  }

  GBC.widget('step-units', (el) => {
    const s = { scale: 10, lr: 0.3 };
    const w = ui.shell(el, {
      title: 'Шаг первого порядка против шага Ньютона',
      sub: 'Счётные данные: y ~ Пуассон(s · exp(0.8 sin x)), модель F = log μ, деревья глубины 2, 40 итераций. «Первый порядок» — лист −G/n, «Ньютон» — лист −G/H. Меняйте масштаб s при одном и том же темпе ν.',
    });
    ui.slider(w.controls, { label: 'Масштаб счётчиков s', min: 0.5, max: 50, step: 0.5, value: s.scale, onInput: (v) => ((s.scale = v), run()) });
    ui.slider(w.controls, { label: 'Темп ν', min: 0.01, max: 1, step: 0.01, value: s.lr, onInput: (v) => ((s.lr = v), run()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'итерация', domain: [0, 40] }, y: { label: 'средняя пуассоновская девиация', type: 'log' } });
    const stats = ui.stats(w.foot, [{ key: 'first', label: 'первый порядок: итог' }, { key: 'newton', label: 'Ньютон: итог' }]);
    const M = 40;

    function boost(X, y, newton) {
      const n = y.length;
      let F = new Array(n).fill(Math.log(U.mean(y)));
      const dev = [];
      for (let m = 0; m <= M; m++) {
        let d = 0;
        for (let i = 0; i < n; i++) {
          const mu = Math.exp(F[i]);
          d += 2 * ((y[i] > 0 ? y[i] * Math.log(y[i] / mu) : 0) - (y[i] - mu));
        }
        d /= n;
        if (!Number.isFinite(d) || d > 1e6) {
          dev.push(null);
          break;
        }
        dev.push(d);
        if (m === M) break;
        const g = F.map((f, i) => Math.exp(f) - y[i]);
        const h = newton ? F.map((f) => Math.exp(f)) : null;
        const t = new GBC.RegressionTree({ maxDepth: 2 }).fit(X, g, h);
        const upd = t.predict(X);
        F = F.map((f, i) => f + s.lr * upd[i]);
      }
      return dev;
    }

    function run() {
      const rng = new GBC.RNG(81);
      const x = [];
      const y = [];
      for (let i = 0; i < 200; i++) {
        const xi = rng.uniform(0, 10);
        x.push(xi);
        y.push(poisson(rng, s.scale * Math.exp(0.8 * Math.sin(xi))));
      }
      const X = x.map((v) => [v]);
      const a = boost(X, y, false);
      const b = boost(X, y, true);
      const series = (d) => {
        const k = d.indexOf(null);
        const ok = k < 0 ? d : d.slice(0, k);
        return { x: ok.map((_, i) => i), y: ok };
      };
      const sa = series(a);
      const sb = series(b);
      const all = sa.y.concat(sb.y);
      plot.render([
        { type: 'line', x: sa.x, y: sa.y, color: 'valid', width: 2.2, label: 'первый порядок: −G/n' },
        { type: 'line', x: sb.x, y: sb.y, color: 'model', width: 2.2, label: 'Ньютон: −G/H' },
      ], { y: [Math.min(...all) / 1.5, Math.max(...all) * 1.5] });
      const fin = (d) => (d.includes(null) ? 'разошёлся на итерации ' + d.indexOf(null) : U.fmt(d[d.length - 1], 4));
      stats.set('first', fin(a));
      stats.set('newton', fin(b));
    }
    run();
  });
})();
