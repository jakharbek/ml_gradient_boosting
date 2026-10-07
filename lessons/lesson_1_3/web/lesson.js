/* Урок 1.3 — производная, градиент и градиентный спуск:
 *   slope-zoom         — секущая превращается в касательную: производная как предел;
 *   step-guarantee     — почему малый шаг против производной уменьшает функцию, а большой — нет;
 *   constant-pull      — спуск для константы: каждая квартира тянет прогноз к себе (L2 и L1);
 *   gd-1d              — градиентный спуск по одной переменной: постоянный, затухающий темп,
 *                        поиск с возвратом и шаг Ньютона;
 *   eta-map            — как длина шага решает судьбу спуска: карта сходимости для параболы;
 *   newton-view        — линейное и квадратичное приближение: откуда берётся шаг Ньютона;
 *   bowl-2d            — вытянутая чаша: число обусловленности, зигзаг и инерция (momentum);
 *   gd-2d              — спуск по двум параметрам: рельеф MSE прямой, зигзаг и центрирование;
 *   prediction-descent — спуск в пространстве прогнозов: «свободные» прогнозы против дерева;
 *   sgd-line           — стохастический спуск: шаг по мини-пакету из B точек. */
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
    const s = { fn: 'parabola', eta: 0.2, t0: 2.5, steps: 12, mode: 'const' };
    const MODES = [
      { value: 'const', label: 'Постоянный темп η' },
      { value: 'decay', label: 'Затухающий темп η/(1 + k/10)' },
      { value: 'back', label: 'Поиск с возвратом' },
      { value: 'newton', label: 'Шаг Ньютона: η = 1/f″' },
    ];
    const w = ui.shell(el, { title: 'Градиентный спуск по одной переменной', sub: 'Точки — путь спуска θ₀ → θ₁ → … Оранжевые отрезки — касательные: наклон = производная. Чем круче склон, тем длиннее шаг. Переключайте способ выбора шага.' });
    ui.select(w.controls, { label: 'Функция', options: Object.entries(FUNCS).map(([k, v]) => ({ value: k, label: v.label })), value: s.fn, onChange: (v) => ((s.fn = v), draw()) });
    ui.select(w.controls, { label: 'Как выбирать шаг', options: MODES, value: s.mode, onChange: (v) => ((s.mode = v), (etaCtl.el.hidden = v === 'newton'), draw()) });
    const etaCtl = ui.slider(w.controls, { label: 'Темп обучения η (начальный)', min: 0.01, max: 4, log: true, value: s.eta, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Старт θ₀', min: -2.8, max: 2.8, step: 0.05, value: s.t0, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.t0 = v), draw()) });
    ui.slider(w.controls, { label: 'Шагов', min: 1, max: 60, step: 1, value: s.steps, format: String, onInput: (v) => ((s.steps = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 300, x: { label: 'θ', domain: [-3, 3] }, y: { label: 'f(θ)' } });
    const p2 = new GBC.Plot(box, {
      height: 300, x: { label: 'шаг k' }, y: { label: 'f(θ_k)' }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v),
      table: () => {
        const F = FUNCS[s.fn];
        const P = path();
        return { columns: ['k', 'θ_k', 'f(θ_k)', 'f′(θ_k)', 'шаг η_k'], rows: P.ts.map((t, k) => [k, t, F.f(t), F.df(t), k < P.etas.length ? P.etas[k] : '—']) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 't', label: 'θ после спуска' }, { key: 'f', label: 'f(θ)' }, { key: 'g', label: 'f′(θ)' }, { key: 'e', label: 'Последний шаг η' }]);
    /** Путь спуска и фактические темпы η_k (для Ньютона η_k = 1/f″). */
    function path() {
      const F = FUNCS[s.fn];
      const ts = [s.t0];
      const etas = [];
      for (let k = 0; k < s.steps; k++) {
        const t = ts[ts.length - 1];
        const g = F.df(t);
        let eta = s.eta;
        if (s.mode === 'newton') {
          const h = F.d2f(t);
          eta = h > 1e-9 ? 1 / h : 0.05;
        } else if (s.mode === 'decay') eta = s.eta / (1 + k / 10);
        else if (s.mode === 'back') {
          // поиск с возвратом (правило Армихо): делим шаг пополам, пока f не уменьшится хотя бы на ½·η·f′²
          let tries = 0;
          while (F.f(t - eta * g) > F.f(t) - 0.5 * eta * g * g && tries < 40) (eta /= 2), tries++;
        }
        const nt = t - eta * g;
        if (!Number.isFinite(nt) || Math.abs(nt) > 1e6) break;
        ts.push(nt);
        etas.push(eta);
      }
      return { ts, etas };
    }
    function draw() {
      const F = FUNCS[s.fn];
      const { ts, etas } = path();
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
      stats.set('e', etas.length ? U.fmt(etas[etas.length - 1], 3) : '—');
      const diverged = ts.length < s.steps + 1 || Math.abs(last) > Math.abs(s.t0) * 1.5;
      if (s.mode === 'newton') {
        note.innerHTML = s.fn === 'abs'
          ? 'У |θ| вторая производная равна нулю — шаг Ньютона не определён (виджет делает маленький шаг 0.05·f′). Так же и у абсолютных потерь в бустинге: для них используют другой шаг (урок 5.3).'
          : s.fn === 'quartic'
            ? 'На плоском дне f″ → 0 вместе с f′: шаг Ньютона каждый раз уменьшает θ лишь в 3/2 раза. Даже Ньютон не спасает, если кривизна в минимуме нулевая.'
            : s.fn === 'wavy'
              ? 'Там, где f″ ≤ 0 (функция выгнута вверх), шаг Ньютона не определён — виджет делает маленький шаг спуска. Где кривизна положительна, Ньютон берёт темп η = 1/f″ сам.'
              : 'Шаг Ньютона сам выбирает длину по кривизне: η = 1/f″(θ) (см. столбец «шаг» в таблице). Для параболы он попадает в минимум за один шаг, рядом с минимумом гладкой функции — число верных знаков удваивается на каждом шаге.';
      } else if (s.mode === 'decay') {
        note.innerHTML = 'Затухающий темп η<sub>k</sub> = η/(1 + k/10): в начале шаги смелые, потом всё осторожнее. ' +
          (s.fn === 'abs' ? 'Для |θ| это лечит «дребезг»: амплитуда колебаний равна текущему шагу и уменьшается вместе с ним.' : 'Плата — медленный финиш: шаг уменьшается, даже когда уменьшать его не нужно.') +
          ' Сумма темпов η<sub>k</sub> бесконечна (как гармонический ряд), поэтому до минимума можно дойти из любой точки.';
      } else if (s.mode === 'back') {
        note.innerHTML = 'Поиск с возвратом: пробуем шаг η и, если f уменьшилась меньше чем на ½·η·f′² (а тем более выросла), делим η пополам. ' +
          'Начните со слишком большого η: спуск больше не разлетается — он сам находит безопасный шаг. Столбец «шаг» в таблице показывает, какой темп был принят.';
      } else if (s.fn === 'parabola') note.innerHTML = 'Здесь θ<sub>k+1</sub> = (1 − 3η)·θ<sub>k</sub>. ' + (s.eta > 2 / 3 ? '<b>η > 2/3: |1 − 3η| > 1 — расходимость.</b> Выберите «Поиск с возвратом» — и спуск сам подберёт шаг.' : s.eta > 1 / 3 ? 'η > 1/3: точка перепрыгивает минимум, но приближается.' : 'Монотонное приближение; η = 1/3 дало бы минимум за один шаг.');
      else if (s.fn === 'abs') note.innerHTML = 'У |θ| производная всегда ±1: шаг не уменьшается у минимума, и точка «дребезжит» вокруг нуля с амплитудой ~η. Включите затухающий темп — колебания стихнут. В бустинге L1-потери требуют особого шага в листьях (урок 5.3).';
      else if (s.fn === 'quartic') note.innerHTML = 'На плоском дне производная ≈ θ³ почти нулевая: спуск резко замедляется. Шаг Ньютона здесь заметно быстрее.';
      else if (s.fn === 'logloss') note.innerHTML = 'Log-loss константы с 30 % единиц: минимум в логите ln(0.3/0.7) ≈ −0.847. Кривизна здесь мала (f″ ≤ 0.25), поэтому темп η = 1 слишком робок — попробуйте η ≈ 4 или шаг Ньютона.';
      else note.innerHTML = diverged ? 'Спуск ушёл далеко — уменьшите η или выберите «Поиск с возвратом».' : 'Функция с «волной» имеет локальные минимумы: результат зависит от старта и темпа. Сравните старты θ₀ = 2.5 и θ₀ = −2.5.';
    }
    w.pythonAction(() => {
      const F = FUNCS[s.fn].py;
      const head = 'import numpy as np\n\nf = lambda t: ' + F[0] + '\ndf = lambda t: ' + F[1] + '\nd2f = lambda t: ' + F[2] + '\n\nt, eta0 = ' + U.pyNum(s.t0) + ', ' + U.pyNum(s.eta) + '\nfor k in range(' + s.steps + '):\n';
      const body = {
        const: '    eta = eta0\n',
        decay: '    eta = eta0 / (1 + k / 10)                # затухающий темп\n',
        back: '    eta = eta0\n    while f(t - eta * df(t)) > f(t) - 0.5 * eta * df(t) ** 2:\n        eta /= 2                                # поиск с возвратом (Армихо)\n',
        newton: '    h = d2f(t)\n    eta = 1 / h if h > 1e-9 else 0.05        # шаг Ньютона: η = 1/f″ (где f″ > 0)\n',
      }[s.mode];
      return head + body + '    t = t - eta * df(t)\n    print(f"шаг {k + 1:2d}: η = {eta:.4f}, θ = {t: .6f}, f(θ) = {f(t): .6f}, f′(θ) = {df(t): .2e}")\n';
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

  /* Шесть квартир из урока 1: цены, млн. */
  const FLATS = [3, 5, 4, 8, 9, 13];

  /* =================================================================================
   * step-guarantee — f после одного шага как функция темпа η
   * ================================================================================= */
  GBC.widget('step-guarantee', (el) => {
    const half = (c) => U.mean(FLATS.map((y) => 0.5 * (y - c) ** 2));
    const FN = {
      flats: { label: '½·MSE константы: шесть квартир', f: half, df: (c) => c - 7, d2f: () => 1, dom: [-2, 16], t: 0, etaMax: 2.5, py: ['np.mean(0.5 * (y - t) ** 2)', 't - y.mean()', '1'] },
      logloss: { ...FUNCS.logloss, dom: [-3, 3], t: 0, etaMax: 14 },
      quartic: { ...FUNCS.quartic, dom: [-2, 2], t: 1.5, etaMax: 1.1 },
    };
    const s = { fn: 'flats', t: 0, eta: 0.1 };
    const w = ui.shell(el, {
      title: 'Один шаг: что обещает касательная и что получается на самом деле',
      sub: 'Слева — значение функции после одного шага θ − η·f′(θ) в зависимости от темпа η. Касательная обещает выигрыш η·f′² (оранжевый пунктир) и не знает, где остановиться; настоящая кривая (синяя) сначала идёт за ней, потом отстаёт и поднимается. Зелёная зона — темпы, при которых функция уменьшилась.',
    });
    // ползунок точки — доля области определения функции (у функций разные области)
    const pos = (t) => (t - FN[s.fn].dom[0]) / (FN[s.fn].dom[1] - FN[s.fn].dom[0]);
    const at = (p) => FN[s.fn].dom[0] + p * (FN[s.fn].dom[1] - FN[s.fn].dom[0]);
    ui.select(w.controls, {
      label: 'Функция', options: Object.entries(FN).map(([k, v]) => ({ value: k, label: v.label })), value: s.fn,
      onChange: (v) => ((s.fn = v), (s.t = FN[v].t), (s.eta = FN[v].etaMax / 25), tCtl.set(pos(s.t)), etaCtl.setMax(FN[v].etaMax), etaCtl.set(s.eta), draw()),
    });
    const tCtl = ui.slider(w.controls, { label: 'Текущая точка θ', min: 0, max: 1, step: 0.0025, value: pos(s.t), format: (v) => U.fmt(at(v), 2), onInput: (v) => ((s.t = at(v)), draw()) });
    const etaCtl = ui.slider(w.controls, { label: 'Темп η', min: 0, max: FN[s.fn].etaMax, step: 0.01, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, {
      height: 300, x: { label: 'темп η' }, y: { label: 'f после шага' }, crosshair: true, crosshairTitle: (v) => 'η = ' + U.fmt(v, 3),
      table: () => {
        const F = FN[s.fn];
        const t = U.clamp(s.t, F.dom[0], F.dom[1]);
        const g = F.df(t);
        return { columns: ['η', 'θ − η·f′', 'по касательной', 'на самом деле', 'выигрыш'], rows: U.linspace(0, F.etaMax, 11).map((e) => [e, t - e * g, F.f(t) - e * g * g, F.f(t - e * g), F.f(t) - F.f(t - e * g)]) };
      },
    });
    const p2 = new GBC.Plot(box, { height: 300, x: { label: 'θ' }, y: { label: 'f(θ)' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'f', label: 'f(θ) сейчас' }, { key: 'lin', label: 'Обещание касательной' }, { key: 'act', label: 'На самом деле' }, { key: 'best', label: 'Лучший η' }]);
    function draw() {
      const F = FN[s.fn];
      const t = U.clamp(s.t, F.dom[0], F.dom[1]);
      const g = F.df(t);
      const f0 = F.f(t);
      const etas = U.linspace(0, F.etaMax, 400);
      const after = etas.map((e) => F.f(t - e * g));
      const eta = Math.min(s.eta, F.etaMax);
      const fe = F.f(t - eta * g);
      // зелёная зона: где f после шага меньше f(θ)
      const bands = [];
      let start = null;
      etas.forEach((e, i) => {
        const ok = after[i] < f0 - 1e-12;
        if (ok && start === null) start = e;
        if ((!ok || i === etas.length - 1) && start !== null) bands.push({ type: 'vband', x0: start, x1: e, color: 'good', opacity: 0.1 }), (start = null);
      });
      const best = etas[U.argmax(after.map((v) => -v))];
      const span = Math.max(f0, ...after.filter(Number.isFinite)) - Math.min(...after);
      const lo = Math.min(...after) - 0.15 * (span + 0.1);
      const hi = f0 + 0.6 * (span + 0.1);
      p1.render(bands.concat([
        { type: 'hline', y: f0, color: 'ink2', dash: '4 3', width: 1, text: 'f(θ) — без шага' },
        { type: 'line', x: etas, y: etas.map((e) => f0 - e * g * g), color: 'tree', dash: '6 4', width: 1.8, label: 'по касательной: f − η·f′²' },
        { type: 'line', x: etas, y: after, color: 'model', width: 2.2, label: 'на самом деле: f(θ − η·f′)' },
        { type: 'points', x: [eta], y: [fe], color: 'ink', r: 5.5, label: 'ваш η' },
      ]), { x: [0, F.etaMax], y: [lo, hi] });
      const gx = U.linspace(F.dom[0], F.dom[1], 300);
      const fy = gx.map(F.f);
      const [ylo, yhi] = U.extent(fy);
      const t1 = t - eta * g;
      p2.render([
        { type: 'line', x: gx, y: fy, color: 'model', width: 2.2, label: 'f(θ)' },
        { type: 'line', x: [F.dom[0], F.dom[1]], y: [f0 + g * (F.dom[0] - t), f0 + g * (F.dom[1] - t)], color: 'tree', dash: '6 4', width: 1.6, label: 'касательная' },
        { type: 'arrows', x1: [t], y1: [f0], x2: [t1], y2: [F.f(t1)], color: 'ink2', width: 1.4 },
        { type: 'points', x: [t], y: [f0], color: 'ink', r: 5.5, hollow: true, label: 'θ' },
        { type: 'points', x: [t1], y: [F.f(t1)], color: 'ink', r: 5.5, label: 'после шага' },
      ], { x: F.dom, y: [ylo - 0.08 * (yhi - ylo), yhi + 0.08 * (yhi - ylo)] });
      stats.set('f', U.fmt(f0, 4));
      stats.set('lin', U.fmt(f0 - eta * g * g, 4));
      stats.set('act', U.fmt(fe, 4), fe - f0);
      stats.set('best', '≈ ' + U.fmt(best, 2));
      const lead = s.fn === 'flats'
        ? 'Для параболы всё считается точно: f(θ − η·f′) = f(θ) − η·(1 − η·a/2)·f′², где a = f″ = 1. Выигрыш положителен при 0 < η < 2/a = 2 и максимален при η = 1/a = 1. '
        : s.fn === 'logloss'
          ? 'Кривизна log-loss мала (f″ ≤ 0.25), поэтому касательная «верна» долго: из θ = 0 функция уменьшается при любом темпе примерно до 9, а лучший темп — около 4. '
          : 'У θ⁴/4 кривизна быстро растёт при удалении от нуля: касательная врёт уже на небольших шагах. ';
      note.innerHTML = lead + (fe > f0 + 1e-12
        ? '<b>При η = ' + U.fmt(eta, 2) + ' функция выросла</b>: шаг улетел туда, где касательная уже не похожа на функцию.'
        : 'При η = ' + U.fmt(eta, 2) + ' касательная обещала ' + U.fmt(eta * g * g, 3) + ', получили ' + U.fmt(f0 - fe, 3) + '. Чем меньше η, тем точнее обещание: при малом шаге выигрыш ≈ η·f′².');
    }
    w.pythonAction(() => {
      const F = FN[s.fn];
      return 'import numpy as np\n\n' + (s.fn === 'flats' ? 'y = np.array([3, 5, 4, 8, 9, 13.])\n' : '') + 'f = lambda t: ' + F.py[0] + '\ndf = lambda t: ' + F.py[1] + '\n\nt = ' + U.pyNum(Number(s.t.toFixed(3))) + '\ng = df(t)\n' +
        'print(f"f(θ) = {f(t):.4f}, f′(θ) = {g:.4f}")\nfor eta in np.linspace(0, ' + U.pyNum(F.etaMax) + ', 11):\n    print(f"η = {eta:5.2f}: касательная обещает {f(t) - eta * g**2:9.4f}, на самом деле {f(t - eta * g):9.4f}")\n';
    });
    draw();
  });

  /* =================================================================================
   * constant-pull — спуск для константы: силы квартир (L2 и L1)
   * ================================================================================= */
  GBC.widget('constant-pull', (el) => {
    const MAXK = 20;
    const AREAS = [30, 40, 50, 60, 70, 80];
    const s = { loss: 'l2', eta: 0.5, c0: 0, k: 0 };
    const LOSS = {
      l2: { label: '½·MSE', pull: (y, c) => y - c, f: (c) => U.mean(FLATS.map((y) => 0.5 * (y - c) ** 2)) },
      l1: { label: 'MAE', pull: (y, c) => Math.sign(y - c), f: (c) => U.mean(FLATS.map((y) => Math.abs(y - c))) },
    };
    const w = ui.shell(el, {
      title: 'Спуск для константы: каждая квартира тянет прогноз к себе',
      sub: 'Шесть квартир — шесть сил. Сила квартиры — минус производная её потерь по c: для ½·MSE это остаток y − c, для MAE — только его знак. Средняя сила (оранжевая стрелка) — это антиградиент −f′(c); шаг спуска сдвигает c на η·(среднюю силу).',
    });
    ui.segmented(w.controls, { label: 'Потери', options: [{ value: 'l2', label: '½·MSE' }, { value: 'l1', label: 'MAE' }], value: s.loss, onChange: (v) => ((s.loss = v), draw()) });
    ui.slider(w.controls, { label: 'Темп η', min: 0.05, max: 2.2, step: 0.05, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Старт c₀', min: -1, max: 15, step: 0.5, value: s.c0, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.c0 = v), draw()) });
    ui.player(w.controls, { label: 'Шаг спуска', min: 0, max: MAXK, value: 0, fps: 2, format: (v) => 'k = ' + v, onChange: (v) => ((s.k = v), draw()) });
    const top = new GBC.Plot(w.main, { height: 250, x: { label: 'цена, млн', domain: [-1.5, 16] }, y: { label: 'квартира', domain: [-0.9, 6.7], ticks: [0, 1, 2, 3, 4, 5, 6], format: (v) => (v === 0 ? 'сумма' : String(v)) } });
    const bottom = new GBC.Plot(w.main, {
      height: 200, x: { label: 'c', domain: [-1.5, 16] }, y: { label: 'f(c)' }, crosshair: true, crosshairTitle: (v) => 'c = ' + U.fmt(v, 2),
      table: () => {
        const P = path();
        return { columns: ['k', 'c_k', 'средняя сила −f′(c_k)', 'f(c_k)'], rows: P.map((c, k) => [k, c, U.mean(FLATS.map((y) => LOSS[s.loss].pull(y, c))), LOSS[s.loss].f(c)]) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'c', label: 'c_k' }, { key: 'pull', label: 'Средняя сила −f′(c)' }, { key: 'f', label: 'f(c_k)' }, { key: 'opt', label: 'Минимум' }]);
    function path() {
      const L = LOSS[s.loss];
      const cs = [s.c0];
      for (let k = 0; k < MAXK; k++) {
        const c = cs[k];
        cs.push(c + s.eta * U.mean(FLATS.map((y) => L.pull(y, c))));
      }
      return cs;
    }
    function draw() {
      const L = LOSS[s.loss];
      const cs = path();
      const c = cs[s.k];
      const pulls = FLATS.map((y) => L.pull(y, c));
      const mean = U.mean(pulls);
      const rows = U.range(6).map((i) => i + 1);
      const scale = s.loss === 'l1' ? 1.6 : 1; // стрелку единичной силы рисуем длиной 1.6 для наглядности
      const ar = { x1: [], y1: [], x2: [], y2: [] };
      pulls.forEach((p, i) => {
        if (Math.abs(p) < 1e-9) return;
        ar.x1.push(c);
        ar.y1.push(rows[i]);
        ar.x2.push(c + scale * p);
        ar.y2.push(rows[i]);
      });
      const layers = [
        { type: 'vline', x: c, color: 'model', width: 2, text: 'c_k' },
        { type: 'arrows', ...ar, color: 'residual', width: 1.6 },
        { type: 'points', x: FLATS, y: rows, color: 'data', r: 5, label: 'цены квартир', tooltip: (i) => [{ label: 'площадь', value: AREAS[i] + ' м²' }, { label: 'цена y', value: FLATS[i] + ' млн' }, { label: 'сила', value: U.fmtSigned(pulls[i], 3) }] },
      ];
      if (Math.abs(mean) > 1e-9) layers.push({ type: 'arrows', x1: [c], y1: [0], x2: [c + scale * mean], y2: [0], color: 'tree', width: 3 });
      layers.push({ type: 'points', x: [c + s.eta * mean], y: [0], color: 'model', r: 5, hollow: true, label: 'c_{k+1} = c_k + η·сила' });
      layers.push({ type: 'text', items: FLATS.map((y, i) => ({ x: y, y: rows[i], dx: 9, dy: 4, text: U.fmtSigned(pulls[i], 2) })) });
      top.render(layers);
      const gc = U.linspace(-1.5, 16, 300);
      const vis = cs.slice(0, s.k + 1);
      bottom.render([
        { type: 'line', x: gc, y: gc.map(L.f), color: 'model', width: 2.2, label: 'f(c) = ' + L.label },
        { type: 'line', x: vis, y: vis.map(L.f), color: 'ink2', width: 1, dash: '3 3', hover: false },
        { type: 'points', x: vis, y: vis.map(L.f), color: (i) => (i === s.k ? 'tree' : 'ink'), r: (i) => (i === s.k ? 6 : 3.5), label: 'путь спуска' },
      ]);
      stats.set('c', U.fmt(c, 4));
      stats.set('pull', U.fmtSigned(mean, 4));
      stats.set('f', U.fmt(L.f(c), 4));
      stats.set('opt', s.loss === 'l2' ? 'c = 7 (среднее)' : 'c ∈ [5, 8] (медианы)');
      note.innerHTML = s.loss === 'l2'
        ? 'Сила каждой квартиры равна её остатку: чем дальше цена, тем сильнее тянет. Средняя сила ȳ − c = 7 − c, поэтому шаг c ← c + η·(7 − c) сокращает расстояние до среднего в (1 − η) раз. ' +
          (s.eta > 2 ? '<b>η > 2 — разнос: каждый шаг перелетает всё дальше.</b>' : s.eta > 1 ? 'При η > 1 точка перелетает среднее и возвращается.' : s.eta === 1 ? 'При η = 1 — сразу в среднее.' : '') +
          ' Это и есть «бустинг одного числа» из урока 1.'
        : 'Для MAE каждая квартира тянет с силой ±1, как бы далеко ни была: дорогая квартира за 13 млн тянет не сильнее квартиры за 8. Равновесие — там, где сил вверх и вниз поровну. При чётном числе квартир это целый отрезок [5, 8]: внутри него средняя сила равна нулю, и спуск останавливается в первой точке, куда попал. Медиана из учебника, 6.5, — лишь середина этого отрезка.';
    }
    w.pythonAction(() =>
      'import numpy as np\n\ny = np.array([3, 5, 4, 8, 9, 13.])\nc, eta = ' + U.pyNum(s.c0) + ', ' + U.pyNum(s.eta) + '\nfor k in range(' + Math.max(s.k, 1) + '):\n' +
      '    pull = ' + (s.loss === 'l2' ? 'y - c                     # сила квартиры для ½·MSE: остаток' : 'np.sign(y - c)            # сила для MAE: знак остатка') + '\n' +
      '    print(f"k = {k:2d}: c = {c:.4f}, средняя сила = {pull.mean():+.4f}")\n    c = c + eta * pull.mean()       # шаг против производной: −f′(c) = средняя сила\nprint(f"после спуска: c = {c:.4f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * bowl-2d — вытянутая чаша ½(θ₁² + κθ₂²): зигзаг и инерция
   * ================================================================================= */
  GBC.widget('bowl-2d', (el) => {
    const s = { kappa: 10, eta: 0.15, beta: 0.5, momentum: false, steps: 40, t1: 2.5, t2: 1 };
    const TOL = 1e-3;
    const w = ui.shell(el, {
      title: 'Вытянутая чаша: зигзаг, число обусловленности и инерция',
      sub: 'f(θ₁, θ₂) = ½·(θ₁² + κ·θ₂²): по θ₂ функция в κ раз круче, чем по θ₁. Безопасный темп ограничен самым крутым направлением (η < 2/κ), а скорость — самым пологим. Кликните по рельефу, чтобы выбрать старт.',
    });
    ui.slider(w.controls, { label: 'Вытянутость κ', min: 1, max: 50, step: 1, value: s.kappa, format: String, onInput: (v) => ((s.kappa = v), draw()) });
    ui.slider(w.controls, { label: 'Темп η', min: 0.005, max: 1.2, log: true, value: s.eta, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Шагов на рисунке', min: 1, max: 150, step: 1, value: s.steps, format: String, onInput: (v) => ((s.steps = v), draw()) });
    ui.toggle(w.controls, { label: 'Инерция (momentum)', checked: false, onChange: (v) => ((s.momentum = v), (betaCtl.el.hidden = !v), draw()) });
    const betaCtl = ui.slider(w.controls, { label: 'Коэффициент инерции β', min: 0, max: 0.95, step: 0.05, value: s.beta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.beta = v), draw()) });
    betaCtl.el.hidden = true;
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 320, x: { label: 'θ₁', domain: [-3, 3] }, y: { label: 'θ₂', domain: [-2, 2] }, grid: 'none', equal: true });
    const p2 = new GBC.Plot(box, {
      height: 320, x: { label: 'шаг k' }, y: { label: 'f(θ_k)', type: 'log' }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v),
      table: () => {
        const P = run(s.momentum ? s.beta : 0, s.steps);
        return { columns: ['k', 'θ₁', 'θ₂', 'f(θ)'], rows: P.a.map((v, k) => [k, v, P.b[k], fval(v, P.b[k])]) };
      },
    });
    p1.onClick = (a, b) => ((s.t1 = a), (s.t2 = b), draw());
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'n', label: 'Шагов до точности 0.1 %' }, { key: 'nm', label: 'С инерцией' }, { key: 'lim', label: 'Граница η < 2/κ' }, { key: 'best', label: 'Лучший постоянный η' }]);
    const fval = (a, b) => 0.5 * (a * a + s.kappa * b * b);
    /** Спуск (с инерцией β): v ← β·v − η·∇f, θ ← θ + v. */
    function run(beta, K) {
      const a = [s.t1];
      const b = [s.t2];
      let va = 0;
      let vb = 0;
      for (let k = 0; k < K; k++) {
        va = beta * va - s.eta * a[k];
        vb = beta * vb - s.eta * s.kappa * b[k];
        const na = a[k] + va;
        const nb = b[k] + vb;
        if (!Number.isFinite(na) || Math.abs(na) + Math.abs(nb) > 1e6) break;
        a.push(na);
        b.push(nb);
      }
      return { a, b };
    }
    function stepsTo(beta) {
      const r0 = Math.hypot(s.t1, s.t2);
      const P = run(beta, 5000);
      for (let k = 1; k < P.a.length; k++) if (Math.hypot(P.a[k], P.b[k]) < TOL * r0) return k;
      return P.a.length < 5001 ? 'разнос' : '> 5000';
    }
    function draw() {
      const grid = GBC.Plot.grid((a, b) => Math.log(1 + fval(a, b)), -3, 3, -2, 2, 90, 60);
      const seq = GBC.colors.sequential();
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of grid.values) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
      const layers = [{ type: 'heatmap', grid, colorFn: (v) => seq(1 - (v - lo) / (hi - lo)), opacity: 0.5 }];
      for (const lv of [0.05, 0.2, 0.5, 1, 2, 4, 8, 16, 32]) layers.push({ type: 'contour', grid, level: Math.log(1 + lv), color: 'axis', width: 1 });
      const G = run(0, s.steps);
      layers.push({ type: 'line', x: G.a, y: G.b, color: 'tree', width: 1.6, label: 'спуск' });
      layers.push({ type: 'points', x: G.a, y: G.b, color: 'tree', r: 2.5, legend: false });
      if (s.momentum) {
        const M = run(s.beta, s.steps);
        layers.push({ type: 'line', x: M.a, y: M.b, color: 'model', width: 1.8, label: 'с инерцией' });
      }
      layers.push({ type: 'points', x: [s.t1], y: [s.t2], color: 'ink', r: 5, hollow: true, label: 'старт' });
      p1.render(layers);
      const fl = (P) => P.a.map((v, k) => Math.max(fval(v, P.b[k]), 1e-12));
      const curves = [{ type: 'line', x: U.range(G.a.length), y: fl(G), color: 'tree', width: 2, label: 'спуск' }];
      if (s.momentum) {
        const M = run(s.beta, s.steps);
        curves.push({ type: 'line', x: U.range(M.a.length), y: fl(M), color: 'model', width: 2, label: 'с инерцией' });
      }
      // логарифмическая шкала: границы задаём сами (автоматический запас ушёл бы в отрицательные числа)
      const all = curves.flatMap((c) => c.y).filter(Number.isFinite);
      const ylo = Math.max(Math.min(...all), 1e-12) / 2;
      const yhi = Math.min(Math.max(...all), 1e12) * 2;
      // только степени десяти: на 10 и более порядках подписи 1, 2, 5 слипаются
      const e0 = Math.ceil(Math.log10(ylo));
      const e1 = Math.floor(Math.log10(yhi));
      const step = Math.max(1, Math.ceil((e1 - e0 + 1) / 7));
      p2.opts.y.ticks = U.range(Math.floor((e1 - e0) / step) + 1).map((i) => Math.pow(10, e0 + i * step));
      p2.render(curves, { y: [ylo, yhi] });
      const n = stepsTo(0);
      stats.set('n', String(n));
      stats.set('nm', s.momentum ? String(stepsTo(s.beta)) : 'выкл.');
      stats.set('lim', U.fmt(2 / s.kappa, 3));
      stats.set('best', U.fmt(2 / (1 + s.kappa), 3));
      const zig = s.eta * s.kappa > 1 && s.eta * s.kappa < 2;
      note.innerHTML = (s.eta * s.kappa >= 2
        ? '<b>η·κ ≥ 2: по крутому направлению θ₂ спуск разлетается</b>, хотя по пологому θ₁ шаг ещё робок. ' + (s.momentum ? 'Инерция расширяет допустимую зону темпов — проверьте, сходится ли теперь.' : '')
        : zig
          ? 'По θ₂ множитель 1 − η·κ = ' + U.fmt(1 - s.eta * s.kappa, 2) + ' отрицателен — отсюда зигзаг поперёк долины. По θ₁ множитель 1 − η = ' + U.fmt(1 - s.eta, 3) + ' близок к 1 — отсюда медленное движение вдоль неё. '
          : 'По θ₂ спуск монотонный; по θ₁ множитель 1 − η = ' + U.fmt(1 - s.eta, 3) + '. ') +
        ' Отношение кривизн κ называют <b>числом обусловленности</b>: даже с лучшим постоянным темпом 2/(1 + κ) число шагов растёт примерно пропорционально κ. ' +
        (s.momentum ? 'Инерция копит скорость вдоль долины и гасит зигзаг поперёк. При удачных η и β число шагов растёт как √κ, а не как κ: при κ = 100 это десятки шагов вместо сотен.' : 'Включите инерцию: шаг складывается с долей β предыдущего шага.');
    }
    w.pythonAction(() =>
      'import numpy as np\n\nkappa, eta, beta = ' + s.kappa + ', ' + U.pyNum(s.eta) + ', ' + U.pyNum(s.momentum ? s.beta : 0) + '   # beta = 0 — обычный спуск\n' +
      'grad = lambda t: np.array([t[0], kappa * t[1]])   # ∇f для f = ½(θ₁² + κθ₂²)\n\n' +
      't0 = np.array([' + U.pyNum(Number(s.t1.toFixed(3))) + ', ' + U.pyNum(Number(s.t2.toFixed(3))) + '])\nt, v = t0.copy(), np.zeros(2)\nfor k in range(1, 5001):\n    v = beta * v - eta * grad(t)       # инерция: копим скорость\n    t = t + v\n' +
      '    if np.linalg.norm(t) < 1e-3 * np.linalg.norm(t0) or np.linalg.norm(t) > 1e6:\n        break\nprint(f"шагов: {k}, θ = {t}, f = {0.5 * (t[0]**2 + kappa * t[1]**2):.2e}")\n'
    );
    draw();
  });

  /* =================================================================================
   * sgd-line — стохастический спуск: прямая по мини-пакетам
   * ================================================================================= */
  GBC.widget('sgd-line', (el) => {
    const d = GBC.datasets.regression1d({ kind: 'linear', n: 30, noise: 0.6, seed: 3 });
    const n = d.x.length;
    const mx = U.mean(d.x);
    const sx = Math.sqrt(U.mean(d.x.map((v) => (v - mx) ** 2)));
    const z = d.x.map((v) => (v - mx) / sx);
    const y = d.y;
    const half = (a, b) => U.mean(z.map((v, i) => (y[i] - a * v - b) ** 2)) / 2;
    const aOpt = U.mean(z.map((v, i) => v * (y[i] - U.mean(y))));
    const bOpt = U.mean(y);
    const MAXK = 80;
    const s = { B: 1, eta: 0.1, k: 60, seed: 1 };
    const w = ui.shell(el, {
      title: 'Стохастический спуск: шаг по мини-пакету',
      sub: 'Та же прямая ŷ = a·z + b, что в шаге 10, но признак стандартизован (z = (x − x̄)/s), поэтому линии уровня — окружности. На каждом шаге градиент считается не по всем 30 точкам, а по B случайным. Серая линия — полный спуск для сравнения.',
    });
    ui.segmented(w.controls, { label: 'Размер пакета B', options: [{ value: 1, label: '1' }, { value: 5, label: '5' }, { value: 30, label: 'все 30' }], value: s.B, onChange: (v) => ((s.B = Number(v)), draw()) });
    ui.slider(w.controls, { label: 'Темп η', min: 0.02, max: 1, step: 0.01, value: s.eta, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eta = v), draw()) });
    ui.player(w.controls, { label: 'Шагов', min: 0, max: MAXK, value: s.k, fps: 8, format: (v) => 'k = ' + v, onChange: (v) => ((s.k = v), draw()) });
    ui.button(w.controls, { label: 'Другие случайные пакеты', small: true, onClick: () => ((s.seed += 1), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 320, x: { label: 'наклон a', domain: [-0.6, 2.6] }, y: { label: 'сдвиг b', domain: [-0.4, 4.4] }, grid: 'none', equal: true });
    const p2 = new GBC.Plot(box, {
      height: 320, x: { label: 'шаг k', domain: [0, MAXK] }, y: { label: '½·MSE на всех 30 точках', type: 'log' }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v),
      table: () => {
        const P = run(s.B);
        return { columns: ['k', 'a', 'b', '½·MSE'], rows: P.a.slice(0, s.k + 1).map((v, k) => [k, v, P.b[k], half(v, P.b[k])]) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'm', label: '½·MSE сейчас' }, { key: 'opt', label: '½·MSE минимума' }, { key: 'seen', label: 'Просмотрено точек' }, { key: 'seed', label: 'Зерно' }]);
    /** Путь спуска; пакеты выбирает Mulberry32 (как gbcourse.rng.Mulberry32 в Python). */
    function run(B) {
      const rng = new GBC.RNG(s.seed);
      const a = [0];
      const b = [0];
      for (let k = 0; k < MAXK; k++) {
        const idx = B < n ? rng.sample(n, B) : U.range(n);
        let ga = 0;
        let gb = 0;
        for (const i of idx) {
          const r = y[i] - (a[k] * z[i] + b[k]);
          ga += r * z[i];
          gb += r;
        }
        a.push(a[k] + (s.eta * ga) / idx.length);
        b.push(b[k] + (s.eta * gb) / idx.length);
      }
      return { a, b };
    }
    function draw() {
      const grid = GBC.Plot.grid((a, b) => Math.log(half(a, b)), -0.6, 2.6, -0.4, 4.4, 70, 90);
      const seq = GBC.colors.sequential();
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of grid.values) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
      const layers = [{ type: 'heatmap', grid, colorFn: (v) => seq(1 - (v - lo) / (hi - lo)), opacity: 0.5 }];
      for (const lv of [0.25, 0.3, 0.45, 0.7, 1.2, 2, 3.5, 6]) layers.push({ type: 'contour', grid, level: Math.log(lv), color: 'axis', width: 1 });
      const full = run(n);
      const P = run(s.B);
      const K = s.k;
      layers.push({ type: 'line', x: full.a.slice(0, K + 1), y: full.b.slice(0, K + 1), color: 'ink2', width: 1.4, dash: '4 3', label: 'полный спуск' });
      layers.push({ type: 'line', x: P.a.slice(0, K + 1), y: P.b.slice(0, K + 1), color: 'tree', width: 1.6, label: 'B = ' + s.B });
      layers.push({ type: 'points', x: [aOpt], y: [bOpt], color: 'ink', r: 5, hollow: true, label: 'минимум' });
      layers.push({ type: 'points', x: [P.a[K]], y: [P.b[K]], color: 'tree', r: 5, label: 'сейчас' });
      p1.render(layers);
      const ks = U.range(MAXK + 1);
      p2.render([
        { type: 'hline', y: half(aOpt, bOpt), color: 'ink2', dash: '4 3', width: 1, text: 'минимум' },
        { type: 'line', x: ks, y: ks.map((k) => half(full.a[k], full.b[k])), color: 'ink2', width: 1.4, dash: '4 3', label: 'полный спуск' },
        { type: 'line', x: ks.slice(0, K + 1), y: ks.slice(0, K + 1).map((k) => half(P.a[k], P.b[k])), color: 'tree', width: 2, label: 'B = ' + s.B },
        { type: 'vline', x: K, color: 'ink2', dash: '3 3', width: 1 },
      ], { y: [0.2, 12] });
      const m = half(P.a[K], P.b[K]);
      stats.set('m', U.fmt(m, 4));
      stats.set('opt', U.fmt(half(aOpt, bOpt), 4));
      stats.set('seen', String(K * Math.min(s.B, n)) + ' (' + U.fmt((K * Math.min(s.B, n)) / n, 2) + ' эпох)');
      stats.set('seed', String(s.seed));
      note.innerHTML = s.B >= n
        ? 'Полный спуск: каждый шаг точный, путь гладкий и прямой (линии уровня — окружности). Зато каждый шаг просматривает все 30 точек.'
        : 'Каждый шаг смотрит лишь на ' + s.B + (s.B === 1 ? ' точку' : ' точек') + ': направление «шумное», путь петляет, но в среднем ведёт к минимуму. Вблизи минимума спуск не останавливается, а «топчется» — шум не исчезает, пока темп постоянный. ' +
          'Уменьшите η или увеличьте B, чтобы облако стало теснее. Шаг с B = 1 в 30 раз дешевле полного — поэтому на больших данных так и делают.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets\nfrom gbcourse.rng import Mulberry32\n\nX, y = datasets.regression_1d(kind="linear", n=30, noise=0.6, seed=3)\nz = (X[:, 0] - X[:, 0].mean()) / X[:, 0].std()   # стандартизация\n\n' +
      'B, eta, K = ' + s.B + ', ' + U.pyNum(s.eta) + ', ' + s.k + '\nrng = Mulberry32(' + s.seed + ')                 # тот же генератор, что в браузере\na = b = 0.0\nfor k in range(K):\n' +
      '    idx = rng.sample(30, B) if B < 30 else list(range(30))   # мини-пакет\n    r = y[idx] - (a * z[idx] + b)\n    a, b = a + eta * np.mean(r * z[idx]), b + eta * np.mean(r)\n' +
      'print(f"a = {a:.4f}, b = {b:.4f}, ½·MSE = {np.mean((y - a * z - b) ** 2) / 2:.4f}")\nprint("минимум: a =", np.mean(z * (y - y.mean())), " b =", y.mean())\n'
    );
    draw();
  });
})();
