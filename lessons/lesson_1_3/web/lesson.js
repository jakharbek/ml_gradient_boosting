/* Урок 1.3 — производная, градиент и градиентный спуск:
 *   slope-zoom         — секущая превращается в касательную: производная как предел;
 *   gd-1d              — градиентный спуск по одной переменной (и шаг Ньютона);
 *   eta-map            — как длина шага решает судьбу спуска: карта сходимости для параболы;
 *   newton-view        — линейное и квадратичное приближение: откуда берётся шаг Ньютона;
 *   gd-2d              — спуск по двум параметрам: рельеф MSE прямой, зигзаг и центрирование;
 *   prediction-descent — спуск в пространстве прогнозов: «свободные» прогнозы против дерева. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  const sigmoid = (z) => U.sigmoid(z);
  const FUNCS = {
    parabola: { label: 'Парабола ½·3θ²', f: (t) => 1.5 * t * t, df: (t) => 3 * t, d2f: () => 3, dom: [-3, 3], py: ['1.5 * t**2', '3 * t', '3'] },
    wavy: { label: 'С волной ½·3θ² + sin 3θ', f: (t) => 1.5 * t * t + Math.sin(3 * t), df: (t) => 3 * t + 3 * Math.cos(3 * t), d2f: (t) => 3 - 9 * Math.sin(3 * t), dom: [-3, 3], py: ['1.5 * t**2 + np.sin(3 * t)', '3 * t + 3 * np.cos(3 * t)', '3 - 9 * np.sin(3 * t)'] },
    abs: { label: 'Модуль |θ| (L1)', f: (t) => Math.abs(t), df: (t) => Math.sign(t), d2f: () => 0, dom: [-3, 3], py: ['abs(t)', 'np.sign(t)', '0'] },
    quartic: { label: 'Плоское дно θ⁴/4', f: (t) => (t * t * t * t) / 4, df: (t) => t * t * t, d2f: (t) => 3 * t * t, dom: [-3, 3], py: ['t**4 / 4', 't**3', '3 * t**2'] },
    logloss: {
      label: 'Log-loss константы (30 % единиц)',
      f: (t) => Math.log1p(Math.exp(t)) - 0.3 * t, df: (t) => sigmoid(t) - 0.3, d2f: (t) => sigmoid(t) * (1 - sigmoid(t)), dom: [-3, 3],
      py: ['np.log1p(np.exp(t)) - 0.3 * t', '1 / (1 + np.exp(-t)) - 0.3', '(1 / (1 + np.exp(-t))) * (1 - 1 / (1 + np.exp(-t)))'],
    },
  };

  /* =================================================================================
   * slope-zoom — от секущей к касательной
   * ================================================================================= */
  GBC.widget('slope-zoom', (el) => {
    const s = { t: 1, eps: 1, fn: 'square' };
    const FN = {
      square: { label: 'f(θ) = θ²', f: (t) => t * t, df: (t) => 2 * t, dom: [-2.5, 2.5], py: 't**2' },
      loss: { label: 'f(c) = ½(4 − c)²', f: (t) => 0.5 * (4 - t) ** 2, df: (t) => t - 4, dom: [0, 6], py: '0.5 * (4 - t)**2' },
      sin: { label: 'f(θ) = sin θ', f: Math.sin, df: Math.cos, dom: [-3, 3], py: 'np.sin(t)' },
    };
    const w = ui.shell(el, {
      title: 'Производная — предел наклона секущей',
      sub: 'Секущая (оранжевая) проходит через точки θ и θ + ε. Её наклон — «средняя скорость» изменения f. Уменьшайте ε: секущая прижимается к касательной (синий пунктир), а наклон — к производной.',
    });
    ui.select(w.controls, { label: 'Функция', options: Object.entries(FN).map(([k, v]) => ({ value: k, label: v.label })), value: s.fn, onChange: (v) => ((s.fn = v), (s.t = FN[v].dom[0] + 0.6 * (FN[v].dom[1] - FN[v].dom[0])), tCtl.set(s.t), draw()) });
    const tCtl = ui.slider(w.controls, { label: 'Точка θ', min: -2.5, max: 6, step: 0.05, value: s.t, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.t = v), draw()) });
    ui.slider(w.controls, { label: 'Шаг ε (лог. шкала)', min: 0.001, max: 2, log: true, value: s.eps, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.eps = v), draw()) });
    const plot = new GBC.Plot(w.main, {
      height: 300, x: { label: 'θ' }, y: { label: 'f(θ)' },
      table: () => {
        const F = FN[s.fn];
        return { columns: ['ε', '(f(θ+ε) − f(θ)) / ε', 'f′(θ)', 'разница'], rows: [1, 0.5, 0.1, 0.01, 0.001, 0.0001].map((e) => { const q = (F.f(s.t + e) - F.f(s.t)) / e; return [e, q, F.df(s.t), q - F.df(s.t)]; }) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'q', label: 'Наклон секущей' }, { key: 'd', label: 'Производная f′(θ)' }, { key: 'err', label: 'Разница' }]);
    function draw() {
      const F = FN[s.fn];
      const t = U.clamp(s.t, F.dom[0], F.dom[1]);
      const gx = U.linspace(F.dom[0], F.dom[1], 300);
      const q = (F.f(t + s.eps) - F.f(t)) / s.eps;
      const d = F.df(t);
      const span = F.dom[1] - F.dom[0];
      const line = (slope) => [t - span, t + span].map((x) => F.f(t) + slope * (x - t));
      const ys = gx.map(F.f);
      const [lo, hi] = U.extent(ys);
      plot.render([
        { type: 'line', x: gx, y: ys, color: 'ink2', width: 2, label: F.label },
        { type: 'line', x: [t - span, t + span], y: line(d), color: 'model', width: 1.6, dash: '6 4', label: 'касательная: наклон f′(θ)' },
        { type: 'line', x: [t - span, t + span], y: line(q), color: 'tree', width: 2, label: 'секущая: наклон (f(θ+ε) − f(θ))/ε' },
        { type: 'points', x: [t, t + s.eps], y: [F.f(t), F.f(t + s.eps)], color: (i) => (i ? 'tree' : 'ink'), r: 5 },
      ], { x: F.dom, y: [lo - 0.15 * (hi - lo + 1), hi + 0.15 * (hi - lo + 1)] });
      stats.set('q', U.fmt(q, 5));
      stats.set('d', U.fmt(d, 5));
      stats.set('err', U.fmt(q - d, 3));
      note.innerHTML = 'При ε = ' + U.fmt(s.eps, 3) + ' наклон секущей ' + U.fmt(q, 4) + ' отличается от производной на ' + U.fmt(Math.abs(q - d), 3) + '. ' +
        (s.eps > 0.3 ? 'Уменьшите ε — разница исчезнет: производная и есть предел наклона секущей при ε → 0.' : 'Чем меньше ε, тем точнее: так производную и проверяют численно — «конечными разностями».') +
        ' Смысл производной: если сдвинуть θ на маленькое Δ, функция изменится примерно на f′(θ)·Δ.';
    }
    w.pythonAction(() => {
      const F = FN[s.fn];
      return 'import numpy as np\n\nf = lambda t: ' + F.py + '\nt = ' + U.pyNum(Number(s.t.toFixed(3))) + '\nfor eps in [1, 0.1, 0.01, 0.001, 1e-6]:\n    print(f"ε = {eps:<6}: (f(t+ε) − f(t))/ε = {(f(t + eps) - f(t)) / eps:.6f}")\n';
    });
    draw();
  });

  /* =================================================================================
   * gd-1d — градиентный спуск по одной переменной
   * ================================================================================= */
  GBC.widget('gd-1d', (el) => {
    const s = { fn: 'parabola', eta: 0.2, t0: 2.5, steps: 12, newton: false };
    const w = ui.shell(el, { title: 'Градиентный спуск по одной переменной', sub: 'Точки — путь спуска θ₀ → θ₁ → … Оранжевые отрезки — касательные: наклон = производная. Чем круче склон, тем длиннее шаг.' });
    ui.select(w.controls, { label: 'Функция', options: Object.entries(FUNCS).map(([k, v]) => ({ value: k, label: v.label })), value: s.fn, onChange: (v) => ((s.fn = v), draw()) });
    const etaCtl = ui.slider(w.controls, { label: 'Темп обучения η', min: 0.01, max: 4, log: true, value: s.eta, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Старт θ₀', min: -2.8, max: 2.8, step: 0.05, value: s.t0, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.t0 = v), draw()) });
    ui.slider(w.controls, { label: 'Шагов', min: 1, max: 60, step: 1, value: s.steps, format: String, onInput: (v) => ((s.steps = v), draw()) });
    ui.toggle(w.controls, { label: 'Шаг Ньютона: θ − f′/f″', checked: false, onChange: (v) => ((s.newton = v), (etaCtl.el.hidden = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 300, x: { label: 'θ', domain: [-3, 3] }, y: { label: 'f(θ)' } });
    const p2 = new GBC.Plot(box, {
      height: 300, x: { label: 'шаг k' }, y: { label: 'f(θ_k)' }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v),
      table: () => {
        const F = FUNCS[s.fn];
        return { columns: ['k', 'θ_k', 'f(θ_k)', 'f′(θ_k)'], rows: path().map((t, k) => [k, t, F.f(t), F.df(t)]) };
      },
    });
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
      const fy = gx.map(F.f);
      p1.render([
        { type: 'line', x: gx, y: fy, color: 'model', width: 2.2, label: 'f(θ)' },
        { type: 'segments', ...tan, color: 'tree', width: 2, opacity: 0.9 },
        { type: 'line', x: vis, y: vis.map(F.f), color: 'ink2', width: 1, dash: '3 3', hover: false },
        { type: 'points', x: vis, y: vis.map(F.f), color: 'ink', r: 4, label: 'путь спуска', tooltip: (i) => [{ label: 'k', value: String(i) }, { label: 'θ', value: U.fmt(vis[i], 4) }, { label: 'f′(θ)', value: U.fmt(F.df(vis[i]), 3) }] },
      ], { y: [Math.min(...fy) - 0.3, Math.max(...fy) + 0.3] });
      const ks = U.range(ts.length);
      p2.render([{ type: 'line', x: ks, y: ts.map(F.f), color: 'model', label: 'f(θ_k)' }, { type: 'points', x: ks, y: ts.map(F.f), color: 'model', r: 3, legend: false }]);
      const last = ts[ts.length - 1];
      stats.set('t', U.fmt(last, 4));
      stats.set('f', U.fmt(F.f(last), 4));
      stats.set('g', U.fmt(F.df(last), 3));
      const diverged = ts.length < s.steps + 1 || Math.abs(last) > Math.abs(s.t0) * 1.5;
      if (s.newton) {
        note.innerHTML = s.fn === 'abs'
          ? 'У |θ| вторая производная равна нулю — шаг Ньютона не определён. Так же и у абсолютных потерь в бустинге: для них используют другой шаг (урок 5.3).'
          : s.fn === 'quartic'
            ? 'На плоском дне f″ → 0 вместе с f′: шаг Ньютона каждый раз уменьшает θ лишь в 3/2 раза. Даже Ньютон не спасает, если кривизна в минимуме нулевая.'
            : 'Шаг Ньютона сам выбирает длину по кривизне: η = 1/f″(θ). Для параболы он попадает в минимум за один шаг, рядом с минимумом гладкой функции — число верных знаков удваивается на каждом шаге.';
      } else if (s.fn === 'parabola') note.innerHTML = 'Здесь θ<sub>k+1</sub> = (1 − 3η)·θ<sub>k</sub>. ' + (s.eta > 2 / 3 ? '<b>η > 2/3: |1 − 3η| > 1 — расходимость.</b>' : s.eta > 1 / 3 ? 'η > 1/3: точка перепрыгивает минимум, но приближается.' : 'Монотонное приближение; η = 1/3 дало бы минимум за один шаг.');
      else if (s.fn === 'abs') note.innerHTML = 'У |θ| производная всегда ±1: шаг не уменьшается у минимума, и точка «дребезжит» вокруг нуля с амплитудой ~η. Поэтому L1-потери в бустинге требуют особого шага в листьях.';
      else if (s.fn === 'quartic') note.innerHTML = 'На плоском дне производная ≈ θ³ почти нулевая: спуск резко замедляется. Шаг Ньютона здесь заметно быстрее.';
      else if (s.fn === 'logloss') note.innerHTML = 'Log-loss константы с 30 % единиц: минимум в логите ln(0.3/0.7) ≈ −0.847. Кривизна здесь мала (f″ ≤ 0.25), поэтому темп η = 1 слишком робок — попробуйте η ≈ 4 или шаг Ньютона.';
      else note.innerHTML = diverged ? 'Спуск ушёл далеко — уменьшите η.' : 'Функция с «волной» имеет локальные минимумы: результат зависит от старта и темпа.';
    }
    w.pythonAction(() => {
      const F = FUNCS[s.fn].py;
      const step = s.newton ? 't = t - df(t) / d2f(t)          # шаг Ньютона' : 't = t - eta * df(t)              # шаг градиентного спуска';
      return 'import numpy as np\n\nf = lambda t: ' + F[0] + '\ndf = lambda t: ' + F[1] + '\nd2f = lambda t: ' + F[2] + '\n\nt, eta = ' + U.pyNum(s.t0) + ', ' + U.pyNum(s.eta) + '\nfor k in range(' + s.steps + '):\n    ' + step + '\n    print(f"шаг {k + 1:2d}: θ = {t: .6f}, f(θ) = {f(t): .6f}, f′(θ) = {df(t): .2e}")\n';
    });
    draw();
  });

  /* =================================================================================
   * eta-map — карта сходимости по темпу для параболы f = a/2·θ²
   * ================================================================================= */
  GBC.widget('eta-map', (el) => {
    const s = { a: 2, eta: 0.25 };
    const w = ui.shell(el, {
      title: 'Карта темпа: сколько шагов до минимума',
      sub: 'Для параболы f(θ) = ½·a·θ² каждый шаг умножает расстояние до минимума на (1 − η·a). Сверху — этот множитель, снизу — сколько шагов нужно, чтобы расстояние уменьшилось в 100 раз.',
    });
    ui.slider(w.controls, { label: 'Кривизна a = f″', min: 0.5, max: 8, step: 0.1, value: s.a, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'Ваш темп η', min: 0.01, max: 2, step: 0.01, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 200, x: { label: 'темп η', domain: [0, 2] }, y: { label: '|1 − η·a|', domain: [0, 2.2] }, crosshair: true, crosshairTitle: (v) => 'η = ' + U.fmt(v, 3) });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'темп η', domain: [0, 2] }, y: { label: 'шагов до точности 1 %', domain: [0, 60] }, crosshair: true, crosshairTitle: (v) => 'η = ' + U.fmt(v, 3) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'k', label: 'Множитель 1 − η·a' }, { key: 'n', label: 'Шагов до 1 %' }, { key: 'best', label: 'Лучший темп 1/a' }, { key: 'lim', label: 'Граница расходимости 2/a' }]);
    const etas = U.linspace(0.002, 2, 1000);
    const nSteps = (eta) => {
      const k = Math.abs(1 - eta * s.a);
      if (k < 1e-9) return 1;
      if (k >= 1) return Infinity;
      return Math.ceil(Math.log(0.01) / Math.log(k) - 1e-12);
    };
    function draw() {
      const k = 1 - s.eta * s.a;
      const ns = etas.map(nSteps).map((v) => (v === Infinity ? null : Math.min(v, 60)));
      p1.render([
        { type: 'vband', x0: 2 / s.a, x1: 2, color: 'critical', opacity: 0.08 },
        { type: 'hline', y: 1, color: 'ink2', dash: '4 3', width: 1, text: 'граница: множитель 1' },
        { type: 'line', x: etas, y: etas.map((e) => Math.abs(1 - e * s.a)), color: 'model', width: 2.2, label: '|1 − η·a|' },
        { type: 'vline', x: 1 / s.a, color: 'tree', dash: '3 3', width: 1.2 },
        { type: 'points', x: [s.eta], y: [Math.abs(k)], color: 'ink', r: 5.5 },
      ]);
      p2.render([
        { type: 'vband', x0: 2 / s.a, x1: 2, color: 'critical', opacity: 0.08 },
        { type: 'line', x: etas, y: ns, color: 'model', width: 2.2, label: 'шагов до 1 %' },
        { type: 'vline', x: 1 / s.a, color: 'tree', dash: '3 3', width: 1.2, text: 'η = 1/a' },
        { type: 'points', x: [s.eta], y: [Math.min(nSteps(s.eta), 60)], color: 'ink', r: 5.5 },
      ]);
      const n = nSteps(s.eta);
      stats.set('k', U.fmt(k, 3));
      stats.set('n', n === Infinity ? 'никогда' : String(n));
      stats.set('best', U.fmt(1 / s.a, 3));
      stats.set('lim', U.fmt(2 / s.a, 3));
      note.innerHTML = (Math.abs(k) >= 1
        ? '<b>Расходимость:</b> η ≥ 2/a = ' + U.fmt(2 / s.a, 3) + ', каждый шаг отбрасывает дальше от минимума (красная зона).'
        : k < 0
          ? 'Перелёт: 1/a < η < 2/a — точка прыгает через минимум, но приближается.'
          : 'Осторожный режим: η < 1/a — монотонное, но более медленное приближение.') +
        ' Лучший темп зависит от кривизны: η* = 1/a. Чем круче функция, тем меньше допустимый шаг — поэтому один и тот же темп то медлителен, то опасен. Шаг Ньютона берёт η = 1/f″ автоматически.';
    }
    w.pythonAction(() =>
      'import numpy as np\n\na = ' + U.pyNum(s.a) + '                   # кривизна параболы f = a/2·θ²\nfor eta in [0.1 / a, 0.5 / a, 1 / a, 1.5 / a, 1.9 / a, 2.1 / a]:\n    t = 1.0\n    for k in range(1, 201):\n        t = t - eta * a * t        # θ ← θ − η·f′(θ)\n        if abs(t) < 0.01:\n            break\n' +
      '    print(f"η = {eta:.3f} (η·a = {eta * a:.2f}): множитель {1 - eta * a:+.2f}, " + (f"шагов до 1 %: {k}" if abs(t) < 0.01 else "не сошлось"))\n'
    );
    draw();
  });

  /* =================================================================================
   * newton-view — линейное и квадратичное приближение
   * ================================================================================= */
  GBC.widget('newton-view', (el) => {
    const keys = ['wavy', 'logloss', 'quartic', 'parabola'];
    const s = { fn: 'logloss', t: 0, eta: 1 };
    const w = ui.shell(el, {
      title: 'Откуда берётся шаг Ньютона',
      sub: 'В точке θ функцию можно приблизить прямой (касательной) или параболой с той же кривизной. Градиентный спуск делает шаг η вдоль касательной, Ньютон — прыгает в дно параболы.',
    });
    ui.select(w.controls, { label: 'Функция', options: keys.map((k) => ({ value: k, label: FUNCS[k].label })), value: s.fn, onChange: (v) => ((s.fn = v), draw()) });
    const tCtl = ui.slider(w.controls, { label: 'Текущая точка θ', min: -2.8, max: 2.8, step: 0.01, value: s.t, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.t = v), draw()) });
    ui.slider(w.controls, { label: 'Темп спуска η', min: 0.05, max: 5, log: true, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    const btns = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(btns);
    ui.button(btns, { label: 'Шаг Ньютона', small: true, kind: 'primary', onClick: () => step(true) });
    ui.button(btns, { label: 'Шаг спуска', small: true, onClick: () => step(false) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'θ', domain: [-3, 3] }, y: { label: 'f(θ)' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'g', label: 'f′(θ)' }, { key: 'h', label: 'f″(θ) — кривизна' }, { key: 'gd', label: 'Спуск: θ − η·f′' }, { key: 'nt', label: 'Ньютон: θ − f′/f″' }]);
    function step(newton) {
      const F = FUNCS[s.fn];
      const h = F.d2f(s.t);
      const nt = newton ? (h > 1e-9 ? s.t - F.df(s.t) / h : s.t) : s.t - s.eta * F.df(s.t);
      s.t = U.clamp(nt, -2.8, 2.8);
      tCtl.set(s.t);
      draw();
    }
    function draw() {
      const F = FUNCS[s.fn];
      const t = s.t;
      const g = F.df(t);
      const h = F.d2f(t);
      const gx = U.linspace(-3, 3, 400);
      const fy = gx.map(F.f);
      const [lo, hi] = U.extent(fy);
      const tangent = gx.map((x) => F.f(t) + g * (x - t));
      const quad = gx.map((x) => F.f(t) + g * (x - t) + 0.5 * h * (x - t) * (x - t));
      const tGD = t - s.eta * g;
      const tN = h > 1e-9 ? t - g / h : null;
      const layers = [
        { type: 'line', x: gx, y: fy, color: 'ink2', width: 2.2, label: 'f(θ)' },
        { type: 'line', x: gx, y: tangent, color: 'tree', width: 1.6, dash: '6 4', label: 'касательная' },
      ];
      if (h > 1e-9) layers.push({ type: 'line', x: gx, y: quad, color: 'model', width: 2, label: 'парабола той же кривизны' });
      layers.push({ type: 'points', x: [t], y: [F.f(t)], color: 'ink', r: 6, label: 'θ' });
      layers.push({ type: 'points', x: [tGD], y: [F.f(tGD)], color: 'tree', r: 5.5, label: 'после шага спуска' });
      if (tN !== null) layers.push({ type: 'points', x: [tN], y: [F.f(tN)], color: 'model', r: 5.5, label: 'после шага Ньютона' });
      layers.push({ type: 'arrows', x1: [t].concat(tN !== null ? [t] : []), y1: [lo - 0.04 * (hi - lo)].concat(tN !== null ? [lo - 0.04 * (hi - lo)] : []), x2: [tGD].concat(tN !== null ? [tN] : []), y2: [lo - 0.04 * (hi - lo)].concat(tN !== null ? [lo - 0.04 * (hi - lo)] : []), color: 'ink2', width: 1.4 });
      plot.render(layers, { y: [lo - 0.12 * (hi - lo), hi + 0.08 * (hi - lo)] });
      stats.set('g', U.fmt(g, 4));
      stats.set('h', U.fmt(h, 4));
      stats.set('gd', U.fmt(tGD, 4));
      stats.set('nt', tN === null ? 'не определён' : U.fmt(tN, 4));
      const tMin = gx[U.argmax(fy.map((v) => -v))];
      const overshoot = tN !== null && Math.abs(tN - tMin) > Math.abs(t - tMin) + 1e-6;
      note.innerHTML = h > 1e-9
        ? 'Парабола f(θ) + f′·Δ + ½·f″·Δ² имеет дно в Δ = −f′/f″: это и есть шаг Ньютона, то есть спуск с темпом η = 1/f″ = ' + U.fmt(1 / h, 3) + '. ' +
          (overshoot
            ? '<b>Но здесь Ньютон перелетел минимум:</b> вдали от дна парабола плохо описывает функцию, а малая кривизна даёт огромный шаг. Поэтому на практике шаг Ньютона ограничивают или уменьшают (в бустинге — темпом ν).'
            : s.fn === 'logloss' ? 'Для log-loss так считают значения листьев в классификации и весь XGBoost (уроки 6.2 и 8.1).' : 'Где кривизна большая, шаг короче; где маленькая — длиннее.')
        : 'Здесь f″ ≤ 0: парабола «вверх ногами» не имеет дна, и шаг Ньютона указал бы на максимум. Поэтому Ньютон применяют только там, где кривизна положительна (выпуклые потери).';
    }
    w.pythonAction(() => {
      const F = FUNCS[s.fn].py;
      return 'import numpy as np\n\nf = lambda t: ' + F[0] + '\ndf = lambda t: ' + F[1] + '\nd2f = lambda t: ' + F[2] + '\n\n' +
        'for name, step in [("спуск η = ' + U.pyNum(s.eta) + '", lambda t: t - ' + U.pyNum(s.eta) + ' * df(t)), ("Ньютон", lambda t: t - df(t) / d2f(t))]:\n' +
        '    t = ' + U.pyNum(Number(s.t.toFixed(3))) + '\n    for k in range(5):\n        t = step(t)\n    print(f"{name:12s}: после 5 шагов θ = {t:.8f}, f′(θ) = {df(t):.2e}")\n';
    });
    draw();
  });

  /* =================================================================================
   * gd-2d — спуск по двум параметрам: подгонка прямой
   * ================================================================================= */
  GBC.widget('gd-2d', (el) => {
    const d = GBC.datasets.regression1d({ kind: 'linear', n: 30, noise: 0.6, seed: 3 });
    const x = d.x;
    const y = d.y;
    const s = { eta: 0.045, steps: 150, a0: -0.8, b0: 5.5, center: false, grad: true };
    const w = ui.shell(el, { title: 'Градиентный спуск по двум параметрам', sub: 'Подгонка прямой ŷ = a·x + b. Слева — «рельеф» ½·MSE(a, b), линии уровня и путь спуска; справа — текущая прямая. Кликните по рельефу, чтобы выбрать старт.' });
    ui.slider(w.controls, { label: 'Темп η', min: 0.001, max: 0.05, step: 0.001, value: s.eta, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Шагов', min: 1, max: 300, step: 1, value: s.steps, format: String, onInput: (v) => ((s.steps = v), draw()) });
    ui.toggle(w.controls, { label: 'Центрировать x (x − x̄)', checked: false, onChange: (v) => ((s.center = v), draw()) });
    ui.toggle(w.controls, { label: 'Антиградиент в старте', checked: true, onChange: (v) => ((s.grad = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 320, x: { label: 'наклон a', domain: [-1.5, 2.5] }, y: { label: 'сдвиг b', domain: [-3, 7] }, grid: 'none' });
    const p2 = new GBC.Plot(box, { height: 320, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    p1.onClick = (a, b) => ((s.a0 = a), (s.b0 = b), draw());
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'g', label: '∇f в старте (∂/∂a, ∂/∂b)' }, { key: 'mse', label: '½·MSE' }, { key: 'opt', label: '½·MSE оптимума' }]);
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
      const g0 = grad(s.a0, s.b0);
      if (s.grad) {
        const len = Math.hypot(g0[0], g0[1]) || 1;
        layers.push({ type: 'arrows', x1: [s.a0], y1: [s.b0], x2: [s.a0 - (0.9 * g0[0]) / len], y2: [s.b0 - (0.9 * g0[1]) / len], color: 'ink', width: 2 });
      }
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
      const xm = U.mean(xs);
      const ym = U.mean(y);
      let sxy = 0;
      let sxx = 0;
      xs.forEach((v, i) => ((sxy += (v - xm) * (y[i] - ym)), (sxx += (v - xm) * (v - xm))));
      const aOpt = sxy / sxx;
      const bOpt = ym - aOpt * xm;
      stats.set('a', U.fmt(a, 3));
      stats.set('b', U.fmt(b, 3));
      stats.set('g', '(' + U.fmt(g0[0], 2) + ', ' + U.fmt(g0[1], 2) + ')');
      stats.set('mse', U.fmt(mse(a, b), 4));
      stats.set('opt', U.fmt(mse(aOpt, bOpt), 4));
      note.innerHTML = (s.center
        ? 'После центрирования x линии уровня стали почти круглыми, и спуск идёт к минимуму прямо. Масштаб и корреляция признаков сильно влияют на градиентный спуск — а вот деревьям бустинга масштаб безразличен.'
        : 'Линии уровня — вытянутые эллипсы: по наклону a функция крутая, по сдвигу b — пологая. Спуск быстро «падает» в долину и потом медленно ползёт вдоль неё зигзагом.') +
        ' Чёрная стрелка — антиградиент в старте: он перпендикулярен линии уровня и указывает самый крутой спуск <em>в этой точке</em>, но не обязательно в минимум.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets\n\nX, y = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)\nx = X[:, 0]' + (s.center ? ' - X[:, 0].mean()   # центрирование' : '') + '\n\n' +
      'a, b, eta = ' + U.pyNum(Number(s.a0.toFixed(3))) + ', ' + U.pyNum(Number(s.b0.toFixed(3))) + ', ' + U.pyNum(s.eta) + '\nfor k in range(' + s.steps + '):\n    r = y - (a * x + b)\n    grad_a, grad_b = -np.mean(r * x), -np.mean(r)   # частные производные ½·MSE\n    a, b = a - eta * grad_a, b - eta * grad_b\n' +
      'print(f"после спуска: a = {a:.4f}, b = {b:.4f}, ½·MSE = {np.mean((y - a * x - b) ** 2) / 2:.5f}")\nprint("точный ответ (МНК):", np.polyfit(x, y, 1))\n'
    );
    draw();
  });

  /* =================================================================================
   * prediction-descent — спуск в пространстве прогнозов
   * ================================================================================= */
  GBC.widget('prediction-descent', (el) => {
    const train = GBC.datasets.regression1d({ kind: 'wave', n: 12, noise: 0.3, seed: 3 });
    const test = GBC.datasets.regression1d({ kind: 'wave', n: 200, noise: 0.3, seed: 103 });
    const MAXK = 40;
    const s = { mode: 'free', nu: 0.3, k: 0 };
    const w = ui.shell(el, {
      title: 'Спуск по прогнозам: свободно или через дерево',
      sub: 'Параметры — сами прогнозы F(x_i) двенадцати точек. Шаг спуска сдвигает каждый прогноз на ν·(y_i − F_i). Но что тогда предсказывать в новых точках (бирюзовые)? Сравните со спуском, где поправку делает дерево.',
    });
    ui.segmented(w.controls, { label: 'Как делаем шаг', options: [{ value: 'free', label: 'Свободные прогнозы' }, { value: 'tree', label: 'Через дерево' }], value: s.mode, onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'Темп ν', min: 0.05, max: 1, step: 0.05, value: s.nu, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.nu = v), draw()) });
    const player = ui.player(w.controls, { label: 'Шагов спуска k', min: 0, max: MAXK, value: 0, fps: 4, format: (v) => 'k = ' + v, onChange: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-1, 4.6] } });
    const curve = new GBC.Plot(w.main, { height: 200, x: { label: 'шаг k', domain: [0, MAXK] }, y: { label: 'MSE' }, crosshair: true, crosshairTitle: (v) => 'k = ' + Math.round(v) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'tr', label: 'MSE на 12 точках' }, { key: 'te', label: 'MSE на новых точках' }, { key: 'k', label: 'Шагов' }]);
    const F0 = U.mean(train.y);
    const grid = U.linspace(0, 10, 400);
    const mse = (y, p) => GBC.metrics.mse(y, p);
    /** История обоих способов: прогнозы на обучении и функция на новых точках. */
    function run() {
      const free = [train.y.map(() => F0)];
      const gb = new GBC.GradientBoosting({ nEstimators: MAXK, learningRate: s.nu, maxDepth: 2 }).fit(train.X, train.y);
      for (let k = 1; k <= MAXK; k++) free.push(free[k - 1].map((f, i) => f + s.nu * (train.y[i] - f)));
      return { free, gb };
    }
    function draw() {
      const R = run();
      const k = s.k;
      let trPred;
      let tePred;
      let gridPred;
      if (s.mode === 'free') {
        trPred = R.free[k];
        tePred = test.y.map(() => F0);
        gridPred = null;
      } else {
        trPred = R.gb.predictRaw(train.X, k);
        tePred = R.gb.predictRaw(test.X, k);
        gridPred = R.gb.predictRaw(grid.map((v) => [v]), k);
      }
      const layers = [
        { type: 'points', x: test.x, y: test.y, color: 'test', r: 2.4, opacity: 0.45, label: 'новые точки' },
        { type: 'line', x: grid, y: grid.map((v) => GBC.datasets.trueFunction('wave', v)), color: 'truth', dash: '5 4', width: 1.4, label: 'истина' },
      ];
      if (gridPred) layers.push({ type: 'line', x: grid, y: gridPred, color: 'model', width: 2.4, curve: 'step', label: 'F_k(x) — функция' });
      else layers.push({ type: 'hline', y: F0, color: 'model-prev', width: 1.6, dash: '6 4', text: 'в новых точках: F₀' });
      layers.push({ type: 'segments', x1: train.x, y1: trPred, x2: train.x, y2: train.y, color: 'residual', width: 1.6, opacity: 0.8 });
      layers.push({ type: 'points', x: train.x, y: train.y, color: 'data', r: 4.5, label: 'обучение' });
      layers.push({ type: 'points', x: train.x, y: trPred, color: 'model', r: 5, shape: 'square', label: 'прогнозы F_k(x_i)', tooltip: (i) => [{ label: 'x', value: U.fmt(train.x[i], 2) }, { label: 'y', value: U.fmt(train.y[i], 3) }, { label: 'F_k', value: U.fmt(trPred[i], 3) }] });
      plot.render(layers);
      const ks = U.range(MAXK + 1);
      const trFree = ks.map((j) => mse(train.y, R.free[j]));
      const teFree = ks.map(() => mse(test.y, test.y.map(() => F0)));
      const trTree = ks.map((j) => mse(train.y, R.gb.predictRaw(train.X, j)));
      const teTree = ks.map((j) => mse(test.y, R.gb.predictRaw(test.X, j)));
      curve.render([
        { type: 'line', x: ks, y: s.mode === 'free' ? trFree : trTree, color: 'train', width: 2, label: 'обучение' },
        { type: 'line', x: ks, y: s.mode === 'free' ? teFree : teTree, color: 'test', width: 2, label: 'новые точки' },
        { type: 'vline', x: k, color: 'ink2', dash: '3 3', width: 1 },
      ], { y: [0, Math.max(...teFree, ...trFree) * 1.1] });
      stats.set('tr', U.fmt(mse(train.y, trPred), 4));
      stats.set('te', U.fmt(mse(test.y, tePred), 4));
      stats.set('k', String(k));
      note.innerHTML = s.mode === 'free'
        ? 'Свободный спуск по прогнозам — это «бустинг одного числа» для каждой точки отдельно: остаток каждой умножается на (1 − ν) за шаг, и обучающая ошибка падает к нулю. Но правила для <b>новых</b> x нет — там прогноз так и остался F₀, ошибка на новых точках не меняется. Модель лишь запомнила ответы.'
        : 'Через дерево: шаг тот же — антиградиент (остатки), — но его приближает дерево глубины 2, то есть функция от x. Поправка автоматически переносится на соседние новые точки, и ошибка на них тоже падает. Это и есть <b>градиентный бустинг</b>: градиентный спуск, где шаг обобщает дерево.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, GBRegressor\nfrom gbcourse.metrics import mse\n\n' +
      'X, y = datasets.regression_1d(kind="wave", n=12, noise=0.3, seed=3)\nXt, yt = datasets.regression_1d(kind="wave", n=200, noise=0.3, seed=103)\nnu, K = ' + U.pyNum(s.nu) + ', ' + s.k + '\n\n' +
      '# 1) свободный спуск: параметры — сами прогнозы на обучающих точках\nF = np.full_like(y, y.mean())\nfor k in range(K):\n    F = F + nu * (y - F)            # шаг против градиента ½·Σ(y − F)²\n' +
      'print("свободно:  обучение", mse(y, F), " новые точки (прогноз F0)", mse(yt, np.full_like(yt, y.mean())))\n\n' +
      '# 2) шаг через дерево — градиентный бустинг\ngb = GBRegressor(n_estimators=max(K, 1), learning_rate=nu, max_depth=2).fit(X, y)\n' +
      'print("бустинг:   обучение", mse(y, gb.predict(X, n_iter=K)), " новые точки", mse(yt, gb.predict(Xt, n_iter=K)))\n'
    );
    draw();
  });
})();
