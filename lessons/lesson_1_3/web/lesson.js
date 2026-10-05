/* Урок 1.3: градиентный спуск в 1D и 2D. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  const FUNCS = {
    parabola: { label: 'Парабола ½·3θ²', f: (t) => 1.5 * t * t, df: (t) => 3 * t, d2f: () => 3, dom: [-3, 3] },
    wavy: { label: 'С волной ½·3θ² + sin 3θ', f: (t) => 1.5 * t * t + Math.sin(3 * t), df: (t) => 3 * t + 3 * Math.cos(3 * t), d2f: (t) => 3 - 9 * Math.sin(3 * t), dom: [-3, 3] },
    abs: { label: 'Модуль |θ| (L1)', f: (t) => Math.abs(t), df: (t) => Math.sign(t), d2f: () => 0, dom: [-3, 3] },
    quartic: { label: 'Плоское дно θ⁴/4', f: (t) => (t * t * t * t) / 4, df: (t) => t * t * t, d2f: (t) => 3 * t * t, dom: [-3, 3] },
  };

  GBC.widget('gd-1d', (el) => {
    const s = { fn: 'parabola', eta: 0.2, t0: 2.5, steps: 12, newton: false };
    const w = ui.shell(el, { title: 'Градиентный спуск по одной переменной', sub: 'Точки — путь спуска θ₀ → θ₁ → … Оранжевые отрезки — касательные: наклон = производная.' });
    ui.select(w.controls, { label: 'Функция', options: Object.entries(FUNCS).map(([k, v]) => ({ value: k, label: v.label })), value: s.fn, onChange: (v) => ((s.fn = v), draw()) });
    const etaCtl = ui.slider(w.controls, { label: 'Темп обучения η', min: 0.01, max: 1, step: 0.01, value: s.eta, onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Старт θ₀', min: -2.8, max: 2.8, step: 0.05, value: s.t0, onInput: (v) => ((s.t0 = v), draw()) });
    ui.slider(w.controls, { label: 'Шагов', min: 1, max: 60, step: 1, value: s.steps, format: String, onInput: (v) => ((s.steps = v), draw()) });
    ui.toggle(w.controls, { label: 'Шаг Ньютона: θ − f′/f″', checked: false, onChange: (v) => ((s.newton = v), (etaCtl.el.hidden = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 300, x: { label: 'θ', domain: [-3, 3] }, y: { label: 'f(θ)' } });
    const p2 = new GBC.Plot(box, { height: 300, x: { label: 'шаг k' }, y: { label: 'f(θ_k)' }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 't', label: 'θ после спуска' }, { key: 'f', label: 'f(θ)' }, { key: 'g', label: 'f′(θ)' }]);
    function path() {
      const F = FUNCS[s.fn];
      const ts = [s.t0];
      for (let k = 0; k < s.steps; k++) {
        const t = ts[ts.length - 1];
        let nt;
        if (s.newton) {
          const h = F.d2f(t);
          nt = h > 1e-9 ? t - F.df(t) / h : t - 0.05 * F.df(t);
        } else nt = t - s.eta * F.df(t);
        if (!Number.isFinite(nt) || Math.abs(nt) > 1e6) break;
        ts.push(nt);
      }
      return ts;
    }
    function draw() {
      const F = FUNCS[s.fn];
      const ts = path();
      const gx = U.linspace(-3, 3, 400);
      const vis = ts.filter((t) => Math.abs(t) <= 3.2);
      const tan = { x1: [], y1: [], x2: [], y2: [] };
      vis.slice(0, 15).forEach((t) => {
        const d = 0.45;
        tan.x1.push(t - d);
        tan.x2.push(t + d);
        tan.y1.push(F.f(t) - d * F.df(t));
        tan.y2.push(F.f(t) + d * F.df(t));
      });
      const ymax = Math.max(...gx.map(F.f));
      p1.render([
        { type: 'line', x: gx, y: gx.map(F.f), color: 'model', width: 2.2, label: 'f(θ)' },
        { type: 'segments', ...tan, color: 'tree', width: 2, opacity: 0.9 },
        { type: 'line', x: vis, y: vis.map(F.f), color: 'ink2', width: 1, dash: '3 3', hover: false },
        { type: 'points', x: vis, y: vis.map(F.f), color: 'ink', r: 4, label: 'путь спуска', tooltip: (i) => [{ label: 'k', value: String(i) }, { label: 'θ', value: U.fmt(vis[i], 4) }, { label: 'f′(θ)', value: U.fmt(F.df(vis[i]), 3) }] },
      ], { y: [Math.min(...gx.map(F.f)) - 0.3, ymax + 0.3] });
      const ks = U.range(ts.length);
      p2.render([{ type: 'line', x: ks, y: ts.map(F.f), color: 'model', label: 'f(θ_k)' }, { type: 'points', x: ks, y: ts.map(F.f), color: 'model', r: 3, legend: false }]);
      const last = ts[ts.length - 1];
      stats.set('t', U.fmt(last, 4));
      stats.set('f', U.fmt(F.f(last), 4));
      stats.set('g', U.fmt(F.df(last), 3));
      const diverged = ts.length < s.steps + 1 || Math.abs(last) > Math.abs(s.t0) * 1.5;
      if (s.newton) note.innerHTML = s.fn === 'abs' ? 'У |θ| вторая производная равна нулю — шаг Ньютона не определён. Так же и у абсолютных потерь в бустинге: для них используют другой шаг (урок 5.3).' : 'Шаг Ньютона сам выбирает длину по кривизне. Для параболы он попадает в минимум за один шаг.';
      else if (s.fn === 'parabola') note.innerHTML = 'Здесь θ<sub>k+1</sub> = (1 − 3η)·θ<sub>k</sub>. ' + (s.eta > 2 / 3 ? '<b>η > 2/3: |1 − 3η| > 1 — расходимость.</b>' : s.eta > 1 / 3 ? 'η > 1/3: точка перепрыгивает минимум, но приближается.' : 'Монотонное приближение; η = 1/3 дало бы минимум за один шаг.');
      else if (s.fn === 'abs') note.innerHTML = 'У |θ| производная всегда ±1: шаг не уменьшается у минимума, и точка «дребезжит» вокруг нуля с амплитудой ~η. Поэтому L1-потери в бустинге требуют особого шага в листьях.';
      else if (s.fn === 'quartic') note.innerHTML = 'На плоском дне производная ≈ θ³ почти нулевая: спуск резко замедляется. Шаг Ньютона здесь заметно быстрее.';
      else note.innerHTML = diverged ? 'Спуск ушёл далеко — уменьшите η.' : 'Функция с «волной» имеет локальные минимумы: результат зависит от старта и темпа.';
    }
    w.pythonAction(() => {
      const F = { parabola: ['1.5 * t**2', '3 * t'], wavy: ['1.5 * t**2 + np.sin(3 * t)', '3 * t + 3 * np.cos(3 * t)'], abs: ['abs(t)', 'np.sign(t)'], quartic: ['t**4 / 4', 't**3'] }[s.fn];
      return 'import numpy as np\n\nf = lambda t: ' + F[0] + '\ndf = lambda t: ' + F[1] + '\n\nt, eta = ' + U.pyNum(s.t0) + ', ' + U.pyNum(s.eta) + '\nfor k in range(' + s.steps + '):\n    t = t - eta * df(t)\n    print(f"шаг {k + 1:2d}: θ = {t: .5f}, f(θ) = {f(t): .5f}")\n';
    });
    draw();
  });

  GBC.widget('gd-2d', (el) => {
    const d = GBC.datasets.regression1d({ kind: 'linear', n: 30, noise: 0.6, seed: 3 });
    const x = d.x;
    const y = d.y;
    const s = { eta: 0.02, steps: 40, a0: -0.8, b0: 5.5, center: false };
    const w = ui.shell(el, { title: 'Градиентный спуск по двум параметрам', sub: 'Подгонка прямой ŷ = a·x + b. Слева — «рельеф» MSE(a, b) и путь спуска, справа — текущая прямая. Кликните по рельефу, чтобы выбрать старт.' });
    ui.slider(w.controls, { label: 'Темп η', min: 0.001, max: 0.05, step: 0.001, value: s.eta, onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Шагов', min: 1, max: 300, step: 1, value: s.steps, format: String, onInput: (v) => ((s.steps = v), draw()) });
    ui.toggle(w.controls, { label: 'Центрировать x (x − x̄)', checked: false, onChange: (v) => ((s.center = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 320, x: { label: 'наклон a', domain: [-1.5, 2.5] }, y: { label: 'сдвиг b', domain: [-3, 7] }, grid: 'none' });
    const p2 = new GBC.Plot(box, { height: 320, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    p1.onClick = (a, b) => ((s.a0 = a), (s.b0 = b), draw());
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'mse', label: 'MSE' }, { key: 'opt', label: 'MSE оптимума' }]);
    function draw() {
      const mx = s.center ? U.mean(x) : 0;
      const xs = x.map((v) => v - mx);
      const mse = (a, b) => U.mean(xs.map((v, i) => (y[i] - a * v - b) ** 2)) / 2;
      const grad = (a, b) => {
        let ga = 0;
        let gb = 0;
        xs.forEach((v, i) => {
          const r = y[i] - a * v - b;
          ga -= r * v;
          gb -= r;
        });
        return [ga / xs.length, gb / xs.length];
      };
      const pa = [s.a0];
      const pb = [s.b0];
      for (let k = 0; k < s.steps; k++) {
        const [ga, gb] = grad(pa[k], pb[k]);
        const na = pa[k] - s.eta * ga;
        const nb = pb[k] - s.eta * gb;
        if (!Number.isFinite(na) || Math.abs(na) > 1e4) break;
        pa.push(na);
        pb.push(nb);
      }
      const grid = GBC.Plot.grid((a, b) => Math.log(1 + mse(a, b)), -1.5, 2.5, -3, 7, 80, 80);
      const seq = GBC.colors.sequential();
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of grid.values) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
      const layers = [{ type: 'heatmap', grid, colorFn: (v) => seq(1 - (v - lo) / (hi - lo)), opacity: 0.55 }];
      for (const lv of [0.3, 0.6, 1, 1.5, 2, 2.5, 3]) layers.push({ type: 'contour', grid, level: lo + (lv / 3.2) * (hi - lo), color: 'axis', width: 1 });
      layers.push({ type: 'line', x: pa, y: pb, color: 'tree', width: 1.6, label: 'путь спуска' });
      layers.push({ type: 'points', x: [pa[0]], y: [pb[0]], color: 'ink', r: 5, hollow: true, label: 'старт' });
      layers.push({ type: 'points', x: [pa[pa.length - 1]], y: [pb[pb.length - 1]], color: 'tree', r: 5, label: 'после спуска' });
      p1.render(layers);
      const a = pa[pa.length - 1];
      const b = pb[pb.length - 1];
      const gx = U.linspace(0, 10, 50);
      p2.render([
        { type: 'points', x, y, color: 'data', r: 3.8, label: 'данные' },
        { type: 'line', x: gx, y: gx.map((v) => a * (v - mx) + b), color: 'model', width: 2.2, label: 'прямая' },
      ]);
      // точный оптимум (наименьшие квадраты)
      const xm = U.mean(xs);
      const ym = U.mean(y);
      let sxy = 0;
      let sxx = 0;
      xs.forEach((v, i) => ((sxy += (v - xm) * (y[i] - ym)), (sxx += (v - xm) * (v - xm))));
      const aOpt = sxy / sxx;
      const bOpt = ym - aOpt * xm;
      stats.set('a', U.fmt(a, 3));
      stats.set('b', U.fmt(b, 3));
      stats.set('mse', U.fmt(mse(a, b), 4));
      stats.set('opt', U.fmt(mse(aOpt, bOpt), 4));
      note.innerHTML = s.center
        ? 'После центрирования x линии уровня стали почти круглыми, и спуск идёт к минимуму прямо. Масштаб и корреляция признаков сильно влияют на градиентный спуск — а вот деревьям бустинга масштаб безразличен.'
        : 'Линии уровня — вытянутые эллипсы: по наклону a функция крутая, по сдвигу b — пологая. Спуск быстро «падает» в долину и потом медленно ползёт вдоль неё зигзагом.';
    }
    draw();
  });
})();
