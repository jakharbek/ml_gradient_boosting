/* Урок 15.15: оптимизация. Часть 2 — ускорение и второй порядок, стохастическая оптимизация,
 * ограничения и дискретные задачи, оптимизация внутри бустинга.
 * Виджеты: моментум и √κ; поправка смещения в Adam; Adam и поворот осей; гонка оптимизаторов;
 * спуск, Ньютон и BFGS; шум мини-батча; стохастический градиент; пол шума и расписания темпа; острые и
 * плоские минимумы; ККТ — проекция на многоугольник; штраф, барьер и проекция; L1 и L2 как ограничения;
 * линейное программирование; рюкзак (жадность против динамики); шаг бустинга (градиент, ρ, листья,
 * Ньютон); поэтапный бустинг и путь Lasso; ранняя остановка и гребневая регрессия; тренажёр.
 * Помощники — из lesson.js (GBC.lesson1515). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const L0 = GBC.lesson1515;
  const { f1, f2, f3, f4, py, sci, powFmt, decades, pct, plural, yDom, card, cardGrid, badge, rowTable, PY_NP, PY_RNG, mapLayers, SURF, soft } = L0;

  /* ==============================================================================
   * Шаг 21. Моментум: тяжёлый шарик и √κ
   * ============================================================================== */
  /** Шагов до f < tol на чаше ½(x² + κy²) из (−4, 1.5). */
  function bowlSteps(kap, method, beta, eta, tol = 1e-6, max = 20000, keep = 0) {
    let p = [-4, 1.5];
    let v = [0, 0];
    const path = keep ? [p.slice()] : null;
    for (let k = 1; k <= max; k++) {
      let g;
      if (method === 'nest') g = [p[0] + beta * v[0], kap * (p[1] + beta * v[1])];
      else g = [p[0], kap * p[1]];
      if (method === 'gd') p = [p[0] - eta * g[0], p[1] - eta * g[1]];
      else {
        v = [beta * v[0] - eta * g[0], beta * v[1] - eta * g[1]];
        p = [p[0] + v[0], p[1] + v[1]];
      }
      if (keep && path.length < keep) path.push(p.slice());
      if (!Number.isFinite(p[0]) || Math.abs(p[0]) + Math.abs(p[1]) > 1e8) return { n: null, path };
      if (0.5 * (p[0] * p[0] + kap * p[1] * p[1]) < tol) return { n: k, path };
    }
    return { n: null, path };
  }
  GBC.widget('momentum-kappa', (el) => {
    const s = { kappa: 25, beta: 0.6 };
    const w = ui.shell(el, { title: 'Моментум: шарик с инерцией в вытянутой чаше', sub: 'Чаша ½(x² + κy²), темп η = 1/L = 1/κ. Спуск (синий) шагает по градиенту; моментум (оранжевый) копит скорость v ← βv − η∇f, θ ← θ + v. Нижний график: сколько шагов нужно при разных κ, если β выбрать наилучшим образом.' });
    ui.slider(w.controls, { label: 'Обусловленность κ', values: [4, 10, 25, 50, 100], value: s.kappa, format: String, onInput: (v) => ((s.kappa = v), draw()) });
    const bs = ui.slider(w.controls, { label: 'Инерция β', min: 0, max: 0.98, step: 0.01, value: s.beta, format: f2, onInput: (v) => ((s.beta = v), draw()) });
    ui.button(w.controls, { label: 'β = (1 − 1/√κ)²', onClick: () => ((s.beta = Math.round((1 - 1 / Math.sqrt(s.kappa)) ** 2 * 100) / 100), bs.set(s.beta), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 270, equal: true, x: { label: 'x', domain: [-4.5, 4.5] }, y: { label: 'y', domain: [-2, 2] }, grid: 'none' });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'κ (лог.)', type: 'log', domain: [1, 1000], ticks: [1, 10, 100, 1000] }, y: { label: 'шагов до f < 10⁻⁶ (лог.)', type: 'log', domain: [1, 1e5], ticks: decades(0, 5), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'gd', label: 'спуск: шагов' }, { key: 'hb', label: 'моментум с этим β' }, { key: 'best', label: 'лучшее β (перебор)' }, { key: 'ratio', label: 'выигрыш' }]);
    const KS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const curves = (() => {
      const gd = [];
      const hb = [];
      const ne = [];
      for (const k of KS) {
        gd.push(bowlSteps(k, 'gd', 0, 1 / k, 1e-6, 200000).n);
        hb.push(bowlSteps(k, 'mom', (1 - 1 / Math.sqrt(k)) ** 2, 1 / k).n);
        ne.push(bowlSteps(k, 'nest', (Math.sqrt(k) - 1) / (Math.sqrt(k) + 1), 1 / k).n);
      }
      return { gd, hb, ne };
    })();
    const bestCache = {};
    function draw() {
      const k = s.kappa;
      const f = (x, y) => 0.5 * (x * x + k * y * y);
      const lv = [0.3, 1.5, 4, 8, 14].map((v) => v * Math.min(1.2, k / 25) + 0.05);
      const G = bowlSteps(k, 'gd', 0, 1 / k, 1e-6, 200000, 400);
      const M = bowlSteps(k, 'mom', s.beta, 1 / k, 1e-6, 200000, 400);
      if (!bestCache[k]) {
        let bb = 0;
        let bn = Infinity;
        for (let b = 0; b <= 0.99 + 1e-9; b += 0.01) {
          const n = bowlSteps(k, 'mom', Math.round(b * 100) / 100, 1 / k).n;
          if (n !== null && n < bn) (bn = n), (bb = Math.round(b * 100) / 100);
        }
        bestCache[k] = [bb, bn];
      }
      p1.render([
        ...mapLayers(f, [-4.5, 4.5, -2, 2], lv),
        { type: 'line', x: G.path.map((q) => q[0]), y: G.path.map((q) => U.clamp(q[1], -2, 2)), color: 'model', width: 1.8, label: 'спуск', hover: false },
        { type: 'line', x: M.path.map((q) => U.clamp(q[0], -4.5, 4.5)), y: M.path.map((q) => U.clamp(q[1], -2, 2)), color: 'tree', width: 2.2, label: 'моментум β = ' + f2(s.beta), hover: false },
        { type: 'points', x: [-4], y: [1.5], color: 'ink', r: 6, hollow: true },
      ]);
      const ref = KS.map((q) => 14 * q);
      const ref2 = KS.map((q) => 14 * Math.sqrt(q));
      p2.render([
        { type: 'line', x: KS, y: ref, color: 'muted', dash: '3 4', width: 1, hover: false },
        { type: 'line', x: KS, y: ref2, color: 'muted', dash: '3 4', width: 1, hover: false },
        { type: 'line', x: KS, y: curves.gd, color: 'model', width: 2.2, label: 'спуск ∝ κ' },
        { type: 'line', x: KS, y: curves.hb, color: 'tree', width: 2.2, label: 'моментум, β = (1 − 1/√κ)² ∝ √κ' },
        { type: 'line', x: KS, y: curves.ne, color: 'violet', width: 2.2, label: 'Нестеров, β = (√κ − 1)/(√κ + 1)' },
        { type: 'points', x: [k, k], y: [G.n, bestCache[k][1]], color: (i) => (i ? 'tree' : 'model'), r: 5 },
      ]);
      st.set('gd', G.n === null ? 'не сошёлся' : String(G.n));
      st.set('hb', M.n === null ? 'разошёлся' : String(M.n));
      st.set('best', 'β = ' + f2(bestCache[k][0]) + ' → ' + bestCache[k][1] + ' шагов');
      st.set('ratio', G.n && M.n ? '×' + f1(G.n / M.n) : '—');
      note.innerHTML = 'Без инерции на чаше с κ = ' + k + ' спуск с η = 1/L тратит ' + G.n + ' шагов: по крутому направлению он ограничен темпом, а по пологому ползёт со скоростью η·μ = 1/κ за шаг. Инерция накапливает движение вдоль пологой долины (сумма геометрического ряда: скорость растёт до η/(1 − β)·|∇f|, урок 15.10, шаг 28) и гасит колебания поперёк — как шарик с трением (урок 15.11, шаг 26). При β = (1 − 1/√κ)² ошибка убывает как (1 − 1/√κ)ᵏ вместо (1 − 1/κ)ᵏ: число шагов растёт как √κ, а не как κ (нижний график: наклоны ½ и 1). При κ = 1000 это ' + curves.hb[KS.indexOf(1000)] + ' шагов против ' + curves.gd[KS.indexOf(1000)] + '. Слишком большая β снова раскачивает траекторию — попробуйте 0.95.';
    }
    w.pythonAction(() => PY_NP + '\nkappa, beta = ' + s.kappa + ', ' + py(s.beta) + '\neta = 1 / kappa\n\ndef steps(method, beta, tol=1e-6):\n    p, v = np.array([-4.0, 1.5]), np.zeros(2)\n    for k in range(1, 200001):\n        q = p + beta * v if method == "nest" else p\n        g = np.array([q[0], kappa * q[1]])\n        if method == "gd":\n            p = p - eta * g\n        else:\n            v = beta * v - eta * g\n            p = p + v\n        if 0.5 * (p[0]**2 + kappa * p[1]**2) < tol:\n            return k\n    return None\n\nprint("спуск:", steps("gd", 0), " моментум:", steps("mom", beta))\nbest = min((steps("mom", b / 100) or 10**9, b / 100) for b in range(100))\nprint("лучшее β:", best[1], "→", best[0], "шагов; формула (1 - 1/sqrt(κ))² =", round((1 - 1 / np.sqrt(kappa))**2, 3))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 22. Адаптивные методы: поправка смещения в Adam
   * ============================================================================== */
  GBC.widget('adam-bias', (el) => {
    const s = { b1: 0.9, b2: 0.999, noisy: false };
    const w = ui.shell(el, { title: 'Adam: зачем делить на 1 − βᵏ', sub: 'Скользящие средние m (градиента) и s (его квадрата) стартуют с нуля и первые шаги сильно занижены. Adam делит их на 1 − β₁ᵏ и 1 − β₂ᵏ. Градиент здесь постоянный (g = 1) или шумный. Нижний график — фактический шаг в долях темпа lr.' });
    ui.slider(w.controls, { label: 'β₁ (среднее градиента)', values: [0.8, 0.9, 0.95], value: s.b1, format: String, onInput: (v) => ((s.b1 = v), draw()) });
    ui.slider(w.controls, { label: 'β₂ (среднее квадрата)', values: [0.99, 0.999], value: s.b2, format: String, onInput: (v) => ((s.b2 = v), draw()) });
    ui.toggle(w.controls, { label: 'шумный градиент g = 1 + N(0, 1)', checked: false, onChange: (v) => ((s.noisy = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'шаг k', domain: [1, 60] }, y: { label: 'оценка среднего градиента' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'шаг k', domain: [1, 60] }, y: { label: 'шаг / lr' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 's1', label: 'первый шаг без поправки' }, { key: 's1c', label: 'с поправкой' }, { key: 'k', label: 'без поправки шаг > 1.5·lr до k' }]);
    function draw() {
      const rng = new GBC.RNG(4);
      let m = 0;
      let v = 0;
      const ks = [];
      const gs = [];
      const mr = [];
      const mc = [];
      const sr = [];
      const sc = [];
      for (let k = 1; k <= 60; k++) {
        const g = s.noisy ? 1 + rng.normal() : 1;
        m = s.b1 * m + (1 - s.b1) * g;
        v = s.b2 * v + (1 - s.b2) * g * g;
        const mh = m / (1 - Math.pow(s.b1, k));
        const vh = v / (1 - Math.pow(s.b2, k));
        ks.push(k);
        gs.push(g);
        mr.push(m);
        mc.push(mh);
        sr.push(m / (Math.sqrt(v) + 1e-8));
        sc.push(mh / (Math.sqrt(vh) + 1e-8));
      }
      p1.render([
        s.noisy ? { type: 'points', x: ks, y: gs, color: 'data', r: 2.5, label: 'градиент g_k' } : null,
        { type: 'hline', y: 1, color: 'ink2', dash: '4 4', width: 1 },
        { type: 'line', x: ks, y: mr, color: 'muted', width: 2, label: 'm_k без поправки' },
        { type: 'line', x: ks, y: mc, color: 'model', width: 2.4, label: 'm̂_k = m_k / (1 − β₁ᵏ)' },
      ]);
      p2.render([
        { type: 'hline', y: 1, color: 'ink2', dash: '4 4', width: 1 },
        { type: 'line', x: ks, y: sr, color: 'red', width: 2, label: 'без поправки m/√s' },
        { type: 'line', x: ks, y: sc, color: 'model', width: 2.4, label: 'Adam m̂/√ŝ' },
      ], { y: yDom(sr.concat(sc), 0.05, [0]) });
      let kk = 0;
      sr.forEach((v0, i) => {
        if (v0 > 1.5) kk = i + 1;
      });
      st.set('s1', f2(sr[0]) + '·lr');
      st.set('s1c', f2(sc[0]) + '·lr');
      st.set('k', kk ? String(kk) : '—');
      note.innerHTML = 'Без поправки среднее m на первом шаге равно (1 − β₁)·g = ' + f2(1 - s.b1) + 'g, а s — (1 − β₂)·g² = ' + U.fmt(1 - s.b2, 3) + 'g². Их отношение m/√s = ' + f2(sr[0]) + ' — первый шаг в ' + f1(sr[0]) + ' раза длиннее задуманного, а дальше ещё хуже: среднее квадрата копится медленнее среднего градиента, и на шаге ' + (sr.indexOf(Math.max(...sr)) + 1) + ' шаг достигает ' + f1(Math.max(...sr)) + '·lr. Поправка 1/(1 − βᵏ) превращает начальное «взвешенное среднее с нулями» в честное среднее. При постоянном градиенте шаг Adam равен lr при любом масштабе g: метод нормирует градиент покоординатно. Для шумного градиента m̂/√ŝ &lt; 1: шаг автоматически уменьшается там, где знак градиента неустойчив — встроенная осторожность.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nb1, b2 = ' + py(s.b1) + ', ' + py(s.b2) + '\nrng = Mulberry32(4)\nm = v = 0.0\nfor k in range(1, 11):\n    g = ' + (s.noisy ? '1 + rng.normal()' : '1.0') + '\n    m = b1 * m + (1 - b1) * g\n    v = b2 * v + (1 - b2) * g * g\n    raw = m / (np.sqrt(v) + 1e-8)\n    adam = (m / (1 - b1**k)) / (np.sqrt(v / (1 - b2**k)) + 1e-8)\n    print(f"k = {k:2d}: шаг без поправки {raw:.3f}·lr, с поправкой {adam:.3f}·lr")\n');
    draw();
  });

  /* ==============================================================================
   * Шаги 22–23. Адаптивные методы и гонка оптимизаторов
   * ============================================================================== */
  /** Чаша ½(u² + 25v²), повёрнутая на угол th. */
  function rotBowl(th) {
    const c = Math.cos(th);
    const s0 = Math.sin(th);
    const f = (x, y) => {
      const u = c * x + s0 * y;
      const v = -s0 * x + c * y;
      return 0.5 * (u * u + 25 * v * v);
    };
    const g = (x, y) => {
      const u = c * x + s0 * y;
      const v = -s0 * x + c * y;
      return [c * u - s0 * 25 * v, s0 * u + c * 25 * v];
    };
    return { f, g };
  }
  const OPT = [
    { key: 'gd', label: 'спуск', color: 'muted' },
    { key: 'mom', label: 'моментум', color: 'blue' },
    { key: 'nest', label: 'Нестеров', color: 'violet' },
    { key: 'rms', label: 'RMSProp', color: 'aqua' },
    { key: 'adam', label: 'Adam', color: 'orange' },
  ];
  /** Один запуск метода; P = {eta, beta, lrA, lrR}. */
  function runOpt(S, key, P, steps, p0, fmin = 0, tol = 1e-4) {
    let p = p0.slice();
    let v = [0, 0];
    let m = [0, 0];
    let s = [0, 0];
    const path = [p.slice()];
    let hit = null;
    for (let k = 1; k <= steps; k++) {
      if (key === 'gd') {
        const g = S.g(p[0], p[1]);
        p = [p[0] - P.eta * g[0], p[1] - P.eta * g[1]];
      } else if (key === 'mom') {
        const g = S.g(p[0], p[1]);
        v = [P.beta * v[0] - P.eta * g[0], P.beta * v[1] - P.eta * g[1]];
        p = [p[0] + v[0], p[1] + v[1]];
      } else if (key === 'nest') {
        const g = S.g(p[0] + P.beta * v[0], p[1] + P.beta * v[1]);
        v = [P.beta * v[0] - P.eta * g[0], P.beta * v[1] - P.eta * g[1]];
        p = [p[0] + v[0], p[1] + v[1]];
      } else if (key === 'rms') {
        const g = S.g(p[0], p[1]);
        s = [0.9 * s[0] + 0.1 * g[0] * g[0], 0.9 * s[1] + 0.1 * g[1] * g[1]];
        p = [p[0] - (P.lrR * g[0]) / (Math.sqrt(s[0]) + 1e-8), p[1] - (P.lrR * g[1]) / (Math.sqrt(s[1]) + 1e-8)];
      } else {
        const g = S.g(p[0], p[1]);
        m = [0.9 * m[0] + 0.1 * g[0], 0.9 * m[1] + 0.1 * g[1]];
        s = [0.999 * s[0] + 0.001 * g[0] * g[0], 0.999 * s[1] + 0.001 * g[1] * g[1]];
        const c1 = 1 - Math.pow(0.9, k);
        const c2 = 1 - Math.pow(0.999, k);
        p = [p[0] - (P.lrA * m[0]) / c1 / (Math.sqrt(s[0] / c2) + 1e-8), p[1] - (P.lrA * m[1]) / c1 / (Math.sqrt(s[1] / c2) + 1e-8)];
      }
      if (!p.every(Number.isFinite) || Math.abs(p[0]) > 1e4 || Math.abs(p[1]) > 1e4) break;
      path.push(p.slice());
      if (hit === null && S.f(p[0], p[1]) - fmin < tol) hit = k;
    }
    return { path, hit };
  }
  const PY_OPT = 'def run(method, f, grad, p0, eta=0.04, beta=0.8, lr_adam=0.1, lr_rms=0.05, fmin=0.0, steps=3000):\n    p, v, m, s = np.array(p0, float), np.zeros(2), np.zeros(2), np.zeros(2)\n    for k in range(1, steps + 1):\n        if method == "спуск":\n            p = p - eta * grad(p)\n        elif method in ("моментум", "Нестеров"):\n            g = grad(p + beta * v) if method == "Нестеров" else grad(p)\n            v = beta * v - eta * g; p = p + v\n        elif method == "RMSProp":\n            g = grad(p); s = 0.9 * s + 0.1 * g**2\n            p = p - lr_rms * g / (np.sqrt(s) + 1e-8)\n        else:  # Adam\n            g = grad(p); m = 0.9 * m + 0.1 * g; s = 0.999 * s + 0.001 * g**2\n            p = p - lr_adam * (m / (1 - 0.9**k)) / (np.sqrt(s / (1 - 0.999**k)) + 1e-8)\n        if not np.all(np.isfinite(p)) or np.abs(p).max() > 1e4:\n            return "разошёлся"\n        if f(p) - fmin < 1e-4:\n            return k\n    return f"> {steps}"\n';
  GBC.widget('adam-rotation', (el) => {
    const s = { deg: 0 };
    const w = ui.shell(el, { title: 'Adam любит оси координат', sub: 'Та же вытянутая чаша ½(u² + 25v²), но повёрнутая на угол θ. Спуск не замечает поворота. Adam и RMSProp делят шаг по каждой координате x, y отдельно — и выигрывают, только если «крутое» и «пологое» направления совпадают с осями.' });
    ui.slider(w.controls, { label: 'Поворот θ, градусы', min: 0, max: 90, step: 5, value: s.deg, format: (v) => v + '°', onInput: (v) => ((s.deg = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 280, equal: true, x: { label: 'x', domain: [-4.5, 4.5] }, y: { label: 'y', domain: [-2.6, 2.6] }, grid: 'none' });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'поворот θ, градусы', domain: [0, 90], ticks: [0, 15, 30, 45, 60, 75, 90] }, y: { label: 'шагов до f < 10⁻⁴' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'gd', label: 'спуск' }, { key: 'rms', label: 'RMSProp' }, { key: 'adam', label: 'Adam' }]);
    const P = { eta: 2 / 26, beta: 0, lrA: 0.1, lrR: 0.05 };
    const p0 = [-4, 1.5];
    const degs = U.range(19).map((i) => i * 5);
    const curve = { gd: [], rms: [], adam: [] };
    for (const d of degs) {
      const S0 = rotBowl((d * Math.PI) / 180);
      for (const k of ['gd', 'rms', 'adam']) curve[k].push(runOpt(S0, k, P, 3000, p0).hit);
    }
    function draw() {
      const S0 = rotBowl((s.deg * Math.PI) / 180);
      const L = mapLayers(S0.f, [-4.5, 4.5, -2.6, 2.6], [0.3, 1.5, 4, 8, 14, 22]);
      const res = {};
      for (const o of OPT.filter((q) => q.key === 'gd' || q.key === 'rms' || q.key === 'adam')) {
        const R0 = runOpt(S0, o.key, P, 3000, p0);
        res[o.key] = R0.hit;
        const sh = R0.path.slice(0, 300);
        L.push({ type: 'line', x: sh.map((q) => q[0]), y: sh.map((q) => U.clamp(q[1], -2.6, 2.6)), color: o.color, width: 2, label: o.label, hover: false });
      }
      L.push({ type: 'points', x: [p0[0]], y: [p0[1]], color: 'ink', r: 6, hollow: true });
      p1.render(L);
      p2.render([
        { type: 'line', x: degs, y: curve.gd, color: 'muted', width: 2.2, label: 'спуск, η = 2/(L + μ)' },
        { type: 'line', x: degs, y: curve.rms, color: 'aqua', width: 2.2, label: 'RMSProp, lr = 0.05' },
        { type: 'line', x: degs, y: curve.adam, color: 'orange', width: 2.2, label: 'Adam, lr = 0.1' },
        { type: 'vline', x: s.deg, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      const fmt = (v) => (v === null ? '> 3000' : String(v));
      st.set('gd', fmt(res.gd));
      st.set('rms', fmt(res.rms));
      st.set('adam', fmt(res.adam));
      const i0 = 0;
      const i45 = 9;
      note.innerHTML = 'При θ = 0° крутое направление совпадает с осью y, и деление на √s_y почти «выравнивает» чашу: Adam доходит до цели за ' + curve.adam[i0] + ' шагов — сопоставимо со спуском, которому шаг η = 2/(L + μ) подобрали по точно известной кривизне (' + curve.gd[i0] + '), хотя Adam о кривизне ничего не знает. При θ = 45° обе координаты смешивают крутое и пологое направления, их градиенты одного порядка, и покоординатное деление уже ничего не выравнивает: Adam — ' + curve.adam[i45] + ' шагов (в ' + f1(curve.adam[i45] / curve.adam[i0]) + ' раза больше), а спуск — ' + curve.gd[i45] + ', для него поворот почти ничего не меняет. Adam — это <b>диагональное</b> предобусловливание: оно лечит разный масштаб признаков, но не корреляцию между ними. Полное предобусловливание даёт метод Ньютона и его приближения (шаг 24). Для деревьев эта проблема вообще не стоит: разбиения не зависят от масштаба признаков (урок 2).';
    }
    w.pythonAction(() => PY_NP + PY_OPT + '\nth = np.deg2rad(' + s.deg + ')\nRm = np.array([[np.cos(th), np.sin(th)], [-np.sin(th), np.cos(th)]])   # (u, v) = Rm @ (x, y)\nD = np.diag([1.0, 25.0])\nA = Rm.T @ D @ Rm\nf = lambda p: 0.5 * p @ A @ p\ngrad = lambda p: A @ p\nfor meth in ["спуск", "RMSProp", "Adam"]:\n    print(f"{meth:9}: {run(meth, f, grad, [-4, 1.5], eta=2 / 26)}")\n');
    draw();
  });

  const RACE = {
    bowl: { S: SURF.bowl, p0: [-4, 1.5], eta: 0.04, fmin: 0 },
    rotated: { S: SURF.rotated, p0: [-2.8, -1.4], eta: 0.04, fmin: 0 },
    banana: { S: SURF.banana, p0: [-1.2, 1.5], eta: 0.02, fmin: 0 },
    saddle: {
      S: { label: 'седло и две ямы ½x² + ¼y⁴ − ½y²', f: (x, y) => 0.5 * x * x + 0.25 * y ** 4 - 0.5 * y * y, g: (x, y) => [x, y ** 3 - y], dom: [-4.5, 4.5, -1.8, 1.8], levels: [-0.2, 0, 0.5, 1.5, 3.5, 6], py: 'f = lambda p: 0.5 * p[0]**2 + 0.25 * p[1]**4 - 0.5 * p[1]**2\ngrad = lambda p: np.array([p[0], p[1]**3 - p[1]])\n' },
      p0: [-4, 0.001], eta: 0.1, fmin: -0.25,
    },
  };
  GBC.widget('optimizer-race', (el) => {
    const s = { s: 'bowl', eta: 0.04, beta: 0.8, lrA: 0.1, k: 60 };
    const MAX = 400;
    const w = ui.shell(el, { title: 'Гонка оптимизаторов', sub: 'Пять методов стартуют из одной точки. Спуск шагает по антиградиенту; моментум копит скорость; Нестеров смотрит градиент «на шаг вперёд»; RMSProp и Adam подстраивают шаг по каждой координате. Нажмите ▶.' });
    const etaS = ui.slider(w.controls, { label: 'Темп η (спуск, моментум, Нестеров)', min: 0.005, max: 0.15, step: 0.005, value: s.eta, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.eta = v), draw()) });
    ui.select(w.controls, { label: 'Поверхность', value: s.s, options: Object.entries(RACE).map(([k, v]) => ({ value: k, label: v.S.label })), onChange: (v) => ((s.s = v), (s.eta = RACE[v].eta), etaS.set(s.eta), draw()) });
    ui.slider(w.controls, { label: 'Инерция β', min: 0, max: 0.95, step: 0.05, value: s.beta, format: f2, onInput: (v) => ((s.beta = v), draw()) });
    ui.slider(w.controls, { label: 'Темп Adam', min: 0.01, max: 0.5, step: 0.01, value: s.lrA, format: f2, onInput: (v) => ((s.lrA = v), draw()) });
    ui.player(w.controls, { label: 'Шаги', min: 1, max: MAX, value: s.k, fps: 20, format: (v) => 'шаг ' + v, onChange: (v) => ((s.k = v), draw()) });
    const map = new GBC.Plot(w.main, { height: 330, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, OPT.map((o) => ({ key: o.key, label: o.label + ': шагов до цели' })));
    function draw() {
      const Rc = RACE[s.s];
      const S = Rc.S;
      const layers = mapLayers(S.f, S.dom, S.levels);
      const P = { eta: s.eta, beta: s.beta, lrA: s.lrA, lrR: 0.05 };
      const hits = {};
      const esc = {};
      for (const o of OPT) {
        const { path, hit } = runOpt(S, o.key, P, MAX, Rc.p0, Rc.fmin);
        hits[o.key] = hit === null ? (path.length < MAX + 1 ? 'разошёлся' : '> ' + MAX) : String(hit);
        const ie = path.findIndex((q) => Math.abs(q[1]) > 0.5);
        esc[o.key] = ie < 0 ? '> ' + MAX : String(ie);
        const shown = path.slice(0, s.k + 1);
        layers.push({ type: 'line', x: shown.map((q) => U.clamp(q[0], S.dom[0], S.dom[1])), y: shown.map((q) => U.clamp(q[1], S.dom[2], S.dom[3])), color: o.color, width: 2, label: o.label, hover: false });
        const last = shown[shown.length - 1];
        layers.push({ type: 'points', x: [U.clamp(last[0], S.dom[0], S.dom[1])], y: [U.clamp(last[1], S.dom[2], S.dom[3])], color: o.color, r: 5 });
        st.set(o.key, hits[o.key]);
      }
      const mins = s.s === 'saddle' ? [[0, 1], [0, -1]] : [S.min];
      layers.push({ type: 'points', x: mins.map((q) => q[0]), y: mins.map((q) => q[1]), color: 'ink', r: 6, hollow: true, label: 'минимум' });
      map.render(layers, { x: [S.dom[0], S.dom[1]], y: [S.dom[2], S.dom[3]] });
      const notes = {
        bowl: 'Вытянутая чаша: спуск ограничен крутым направлением (η &lt; 2/25 = 0.08) и медленно ползёт вдоль пологого. При η = 0.04, β = 0.8: спуск — ' + hits.gd + ' шагов до f &lt; 10⁻⁴, моментум — ' + hits.mom + ', Нестеров — ' + hits.nest + ', Adam — ' + hits.adam + '. Нестеров меньше «перелетает», потому что считает градиент там, куда его уже несёт инерция.',
        rotated: 'Повёрнутая чаша: спуск, моментум и Нестеров не зависят от поворота осей (' + hits.gd + ', ' + hits.mom + ', ' + hits.nest + ' шагов; числа чуть другие лишь из-за другой стартовой точки). Adam замедлился: ' + hits.adam + ' шагов против 105 на неповёрнутой чаше. RMSProp здесь справился за ' + hits.rms + ': адаптивные методы чувствительны к старту и параметрам, и общий вывод виден только на многих углах (виджет выше) — покоординатная нормировка надёжно помогает, лишь когда оси задачи совпадают с осями координат.',
        banana: 'Изогнутая долина: дно — парабола y = x². Нужно повернуть вдоль долины, и инерция здесь и помогает (разгон по дну), и мешает (вылет на поворотах). Спуск с малым η — ' + hits.gd + ' шагов, моментум — ' + hits.mom + ', Adam — ' + hits.adam + '.',
        saddle: 'Старт почти точно на гребне седла (y = 0.001). Градиент по y там крошечный (≈ −y), и уход с седла (|y| &gt; 0.5) занимает: спуск — ' + esc.gd + ' шагов, моментум — ' + esc.mom + ', Нестеров — ' + esc.nest + ', RMSProp — ' + esc.rms + ', Adam — ' + esc.adam + '. Адаптивные методы делят крошечный градиент на его же размер и сразу делают шаг нормальной длины. Зато потом, у дна ямы, Adam и RMSProp колеблются, и до цели f − f* &lt; 10⁻⁴ доходят позже инерционных методов (' + hits.adam + ' и ' + hits.rms + ' против ' + hits.mom + ' у моментума). В многомерных невыпуклых задачах (нейросети) сёдел гораздо больше, чем локальных минимумов, и быстрый уход с них — одна из причин популярности Adam.',
      };
      note.innerHTML = notes[s.s];
    }
    w.pythonAction(() => {
      const Rc = RACE[s.s];
      return PY_NP + PY_OPT + '\n' + Rc.S.py + '\nfor meth in ["спуск", "моментум", "Нестеров", "RMSProp", "Adam"]:\n    print(f"{meth:9}: {run(meth, f, grad, ' + JSON.stringify(Rc.p0) + ', eta=' + py(s.eta) + ', beta=' + py(s.beta) + ', lr_adam=' + py(s.lrA) + ', fmin=' + py(Rc.fmin) + ', steps=' + MAX + ')}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 24. Второй порядок: Ньютон и BFGS
   * ============================================================================== */
  function inv2(A) {
    const d = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    return [[A[1][1] / d, -A[0][1] / d], [-A[1][0] / d, A[0][0] / d]];
  }
  const mv = (A, v) => [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];
  function secondOrderRun(S, p0, method, maxIt = 3000) {
    let p = p0.slice();
    let Hk = [[1, 0], [0, 1]];
    let fc = S.f(p[0], p[1]);
    let g = S.g(p[0], p[1]);
    let fev = 1;
    let gev = 1;
    let hev = 0;
    const path = [p.slice()];
    const err = [fc];
    let it = 0;
    while (it < maxIt && fc > 1e-12 && Math.hypot(g[0], g[1]) > 1e-10) {
      let d;
      if (method === 'gd') d = [-g[0], -g[1]];
      else if (method === 'newton') {
        let Hm = S.hess(p[0], p[1]);
        hev++;
        // если гессиан не положительно определён — сдвигаем на τI
        const tr = Hm[0][0] + Hm[1][1];
        const det = Hm[0][0] * Hm[1][1] - Hm[0][1] * Hm[1][0];
        const lmin = tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
        if (lmin <= 1e-6) Hm = [[Hm[0][0] - lmin + 1e-3, Hm[0][1]], [Hm[1][0], Hm[1][1] - lmin + 1e-3]];
        const s0 = mv(inv2(Hm), g);
        d = [-s0[0], -s0[1]];
      } else {
        const s0 = mv(Hk, g);
        d = [-s0[0], -s0[1]];
      }
      const gd = g[0] * d[0] + g[1] * d[1];
      let t = 1;
      let fn = S.f(p[0] + d[0], p[1] + d[1]);
      fev++;
      while (fn > fc + 1e-4 * t * gd && t > 1e-12) {
        t *= 0.5;
        fn = S.f(p[0] + t * d[0], p[1] + t * d[1]);
        fev++;
      }
      const pn = [p[0] + t * d[0], p[1] + t * d[1]];
      const gn = S.g(pn[0], pn[1]);
      gev++;
      if (method === 'bfgs') {
        const sv = [pn[0] - p[0], pn[1] - p[1]];
        const yv = [gn[0] - g[0], gn[1] - g[1]];
        const sy = sv[0] * yv[0] + sv[1] * yv[1];
        if (sy > 1e-12) {
          if (it === 0) {
            const yy = yv[0] * yv[0] + yv[1] * yv[1];
            Hk = [[sy / yy, 0], [0, sy / yy]];
          }
          const rho = 1 / sy;
          const Hy = mv(Hk, yv);
          const yHy = yv[0] * Hy[0] + yv[1] * Hy[1];
          const Hn = [[0, 0], [0, 0]];
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) Hn[i][j] = Hk[i][j] - rho * (Hy[i] * sv[j] + sv[i] * Hy[j]) + (rho * rho * yHy + rho) * sv[i] * sv[j];
          Hk = Hn;
        }
      }
      p = pn;
      g = gn;
      fc = fn;
      it++;
      path.push(p.slice());
      err.push(Math.max(fc, 1e-17));
    }
    return { path, err, it, fev, gev, hev };
  }
  GBC.widget('second-order', (el) => {
    const s = { start: 'a' };
    const STARTS = { a: [-1.2, 1.5], b: [1.5, -0.4], c: [-0.5, -0.4] };
    const w = ui.shell(el, { title: 'Второй порядок: спуск, Ньютон и BFGS', sub: 'Изогнутая долина (1 − x)² + 5(y − x²)². Все три метода с одним и тем же поиском шага (backtracking по Армихо). Ньютон использует гессиан; BFGS строит его приближение по изменениям градиента — только из первых производных.' });
    ui.segmented(w.controls, { label: 'Старт', value: s.start, options: [{ value: 'a', label: '(−1.2, 1.5)' }, { value: 'b', label: '(1.5, −0.4)' }, { value: 'c', label: '(−0.5, −0.4)' }], onChange: (v) => ((s.start = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 300, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'итерация (лог.)', type: 'log', domain: [1, 3000], ticks: [1, 10, 100, 1000] }, y: { label: 'f − f* (лог.)', type: 'log', domain: [1e-13, 100], ticks: decades(-12, 2, 2), format: powFmt } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const S = SURF.banana;
      const p0 = STARTS[s.start];
      const R = { gd: secondOrderRun(S, p0, 'gd'), newton: secondOrderRun(S, p0, 'newton'), bfgs: secondOrderRun(S, p0, 'bfgs') };
      const L = mapLayers(S.f, S.dom, S.levels);
      const col = { gd: 'model', newton: 'tree', bfgs: 'violet' };
      const nm = { gd: 'спуск + Армихо', newton: 'Ньютон', bfgs: 'BFGS' };
      for (const k of ['gd', 'bfgs', 'newton']) {
        const pth = R[k].path.slice(0, 800);
        L.push({ type: 'line', x: pth.map((q) => U.clamp(q[0], -1.6, 1.6)), y: pth.map((q) => U.clamp(q[1], -0.6, 2.2)), color: col[k], width: k === 'gd' ? 1.4 : 2.2, label: nm[k], hover: false });
        if (k !== 'gd') L.push({ type: 'points', x: pth.map((q) => U.clamp(q[0], -1.6, 1.6)), y: pth.map((q) => U.clamp(q[1], -0.6, 2.2)), color: col[k], r: 3 });
      }
      L.push({ type: 'points', x: [p0[0], 1], y: [p0[1], 1], color: 'ink', r: 6, hollow: true });
      p1.render(L, { x: [-1.6, 1.6], y: [-0.6, 2.2] });
      const L2 = [];
      for (const k of ['gd', 'bfgs', 'newton']) {
        const e = R[k].err;
        L2.push({ type: 'line', x: e.map((_, i) => i + 1), y: e, color: col[k], width: 2.2, label: nm[k] });
      }
      p2.render(L2);
      rowTable(tbl, ['метод', 'итераций', 'вычислений f', 'градиентов', 'гессианов', 'память и цена шага при n переменных'], [
        ['спуск + Армихо', String(R.gd.it), String(R.gd.fev), String(R.gd.gev), '0', 'O(n)'],
        ['BFGS', String(R.bfgs.it), String(R.bfgs.fev), String(R.bfgs.gev), '0', 'O(n²); L-BFGS — O(m·n)'],
        ['Ньютон', String(R.newton.it), String(R.newton.fev), String(R.newton.gev), String(R.newton.hev), 'O(n²) память, O(n³) решение'],
      ], null, false);
      note.innerHTML = 'Цель — f &lt; 10⁻¹². Спуск зигзагует в узкой долине и тратит ' + R.gd.it + ' итераций; Ньютон заменяет функцию параболоидом и прыгает в его дно — ' + R.newton.it + ' итераций с квадратичной сходимостью у цели (урок 15.7, урок 15.8, шаг 21). BFGS (Бройден — Флетчер — Гольдфарб — Шанно) — ' + R.bfgs.it + ' итераций без единого гессиана: матрица H обновляется по паре (s, y) = (сдвиг, изменение градиента) так, чтобы выполнялось «секущее» условие H·y = s, и становится всё лучшим приближением обратного гессиана. Сходимость сверхлинейная. L-BFGS хранит лишь последние m пар — так обучают логистическую регрессию в scikit-learn (solver="lbfgs"). Бустинг использует второй порядок иначе: гессиан по прогнозам диагональный, и шаг Ньютона в листе — одна дробь (шаг 33).';
    }
    w.pythonAction(() => PY_NP + 'from scipy.optimize import minimize\n\n' + SURF.banana.py + 'hess = lambda p: np.array([[2 - 20 * p[1] + 60 * p[0]**2, -20 * p[0]], [-20 * p[0], 10]])\np0 = np.array(' + JSON.stringify(STARTS[s.start]) + ')\nfor method in ["BFGS", "Newton-CG", "CG"]:\n    kw = {"hess": hess} if method == "Newton-CG" else {}\n    res = minimize(f, p0, jac=grad, method=method, tol=1e-12, **kw)\n    print(f"{method:9}: итераций {res.nit:3d}, вычислений f {res.nfev:3d}, x = {res.x.round(6)}")\n# у scipy другой поиск шага (условия Вольфе), поэтому числа немного отличаются от страницы\n');
    draw();
  });

  /* ==============================================================================
   * Шаги 25–26. Стохастический градиент
   * ============================================================================== */
  const LIN = (() => {
    const N = 200;
    const r = new GBC.RNG(3);
    const xs = U.range(N).map(() => r.uniform(-1, 1));
    const ys = xs.map((x) => 1 + 2 * x + r.normal(0, 0.5));
    const xm = U.mean(xs);
    const ym = U.mean(ys);
    const kOpt = U.sum(xs.map((x, i) => (x - xm) * (ys[i] - ym))) / U.sum(xs.map((x) => (x - xm) ** 2));
    const bOpt = ym - kOpt * xm;
    const loss = (b, k) => {
      let s = 0;
      for (let i = 0; i < N; i++) s += (ys[i] - b - k * xs[i]) ** 2;
      return s / N / 2;
    };
    return { N, xs, ys, kOpt, bOpt, loss, Lmin: loss(bOpt, kOpt) };
  })();
  const PY_LIN = PY_NP + PY_RNG + '\nr = Mulberry32(3)\nN = 200\nxs = np.array([r.uniform(-1, 1) for _ in range(N)])\nys = np.array([1 + 2 * x + r.normal(0, 0.5) for x in xs])\nloss = lambda b, k: ((ys - b - k * xs)**2).mean() / 2\nk_opt, b_opt = np.polyfit(xs, ys, 1)\nL_min = loss(b_opt, k_opt)\n';
  GBC.widget('grad-noise', (el) => {
    const s = { B: 10 };
    const w = ui.shell(el, { title: 'Градиент по мини-батчу: шумная, но честная оценка', sub: 'Подбираем прямую y = b + kx к 200 точкам; стоим в точке (b, k) = (0, 0). Каждая точка облака — градиент по случайной пачке из B объектов; чёрная стрелка — полный градиент. В среднем облако указывает туда же, а его разброс тает как 1/√B.' });
    ui.slider(w.controls, { label: 'Размер батча B', values: [1, 2, 5, 10, 20, 50, 100, 200], value: s.B, format: String, onInput: (v) => ((s.B = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 300, equal: true, x: { label: '∂L/∂b' }, y: { label: '∂L/∂k' } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'размер батча B (лог.)', type: 'log', domain: [1, 200], ticks: [1, 2, 5, 10, 20, 50, 100, 200] }, y: { label: 'разброс оценки ∂L/∂b (лог.)', type: 'log', domain: [0.005, 5], ticks: [0.01, 0.1, 1], format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'full', label: 'полный градиент' }, { key: 'mean', label: 'среднее 300 оценок' }, { key: 'sd', label: 'разброс ∂L/∂b: опыт' }, { key: 'th', label: 'теория σ/√B·√((N − B)/(N − 1))' }]);
    const { N, xs, ys } = LIN;
    const gb = ys.map((y) => -y);
    const gk = ys.map((y, i) => -y * xs[i]);
    const full = [U.mean(gb), U.mean(gk)];
    const sdb = Math.sqrt(U.mean(gb.map((v) => (v - full[0]) ** 2)));
    const th = (B) => (sdb / Math.sqrt(B)) * Math.sqrt((N - B) / (N - 1));
    function cloud(B, seed) {
      const r = new GBC.RNG(seed);
      const out = [];
      for (let t = 0; t < 300; t++) {
        const idx = r.sample(N, B);
        let a = 0;
        let c = 0;
        for (const i of idx) {
          a += gb[i];
          c += gk[i];
        }
        out.push([a / B, c / B]);
      }
      return out;
    }
    const BS = [1, 2, 5, 10, 20, 50, 100, 200];
    const sdCurve = BS.map((B) => {
      const C = cloud(B, 900 + B);
      const m = U.mean(C.map((q) => q[0]));
      return Math.max(1e-6, Math.sqrt(U.mean(C.map((q) => (q[0] - m) ** 2))));
    });
    function draw() {
      const C = cloud(s.B, 900 + s.B);
      const m = [U.mean(C.map((q) => q[0])), U.mean(C.map((q) => q[1]))];
      const sd = Math.sqrt(U.mean(C.map((q) => (q[0] - m[0]) ** 2)));
      p1.render([
        { type: 'points', x: C.map((q) => q[0]), y: C.map((q) => q[1]), color: 'tree', r: 3, opacity: 0.55 },
        { type: 'arrows', x1: [0], y1: [0], x2: [full[0]], y2: [full[1]], color: 'ink', width: 2.6 },
        { type: 'points', x: [m[0]], y: [m[1]], color: 'model', r: 6, hollow: true, label: 'среднее оценок' },
        { type: 'points', x: [0], y: [0], color: 'ink2', r: 3 },
      ], { x: [-3.6, 1], y: [-2.6, 1] });
      p2.render([
        { type: 'line', x: BS, y: BS.map(th).map((v) => Math.max(v, 0.005)), color: 'model', width: 2, label: 'теория' },
        { type: 'points', x: BS, y: sdCurve.map((v) => Math.max(v, 0.005)), color: 'tree', r: 5, label: 'опыт (300 батчей)' },
        { type: 'vline', x: s.B, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      st.set('full', '(' + f3(full[0]) + ', ' + f3(full[1]) + ')');
      st.set('mean', '(' + f3(m[0]) + ', ' + f3(m[1]) + ')');
      st.set('sd', f3(sd));
      st.set('th', f3(th(s.B)));
      note.innerHTML = 'Оценка по мини-батчу <b>несмещённая</b>: её среднее совпадает с полным градиентом (сравните стрелку и кружок). Разброс — как у выборочного среднего (урок 15.14): σ/√B, с поправкой √((N − B)/(N − 1)) за выбор без возвращения; при B = N = 200 он нулевой. Вчетверо больший батч — вдвое меньший шум, но вчетверо дороже шаг. Поэтому выгодно делать много дешёвых шумных шагов, а не мало точных: за одну эпоху SGD с B = 1 делает 200 шагов, полный спуск — один.';
    }
    w.pythonAction(() => PY_LIN + '\ngb, gk = -ys, -ys * xs                   # градиенты отдельных объектов в точке (0, 0)\nfull = np.array([gb.mean(), gk.mean()])\nB = ' + s.B + '\nr = Mulberry32(' + (900 + s.B) + ')\nest = []\nfor _ in range(300):\n    idx = r.sample(N, B)\n    est.append([gb[idx].mean(), gk[idx].mean()])\nest = np.array(est)\nprint("полный градиент:", full.round(3), " среднее оценок:", est.mean(axis=0).round(3))\nsd_theory = gb.std() / np.sqrt(B) * np.sqrt((N - B) / (N - 1))\nprint("разброс dL/db: опыт", est[:, 0].std().round(3), " теория", sd_theory.round(3))\n');
    draw();
  });

  /** SGD на линейной регрессии; sched: 'const' | 'decay' | 'cos'. */
  function sgdRun(B, lr, epochs, sched, seed = 17, keepPath = false) {
    const { N, xs, ys, loss } = LIN;
    const rng = new GBC.RNG(seed);
    let b = 0;
    let k = 0;
    const path = keepPath ? [[b, k]] : null;
    const curve = [[0, loss(b, k)]];
    let seen = 0;
    let t = 0;
    const T = epochs * Math.ceil(N / B);
    for (let e = 0; e < epochs; e++) {
      const perm = rng.permutation(N);
      for (let s0 = 0; s0 < N; s0 += B) {
        const idx = perm.slice(s0, s0 + B);
        let gb = 0;
        let gk = 0;
        for (const i of idx) {
          const r = ys[i] - b - k * xs[i];
          gb -= r;
          gk -= r * xs[i];
        }
        const eta = sched === 'const' ? lr : sched === 'decay' ? lr / (1 + t / 100) : (lr * (1 + Math.cos((Math.PI * t) / T))) / 2;
        b -= (eta * gb) / idx.length;
        k -= (eta * gk) / idx.length;
        seen += idx.length;
        t++;
        if (keepPath) path.push([b, k]);
        curve.push([seen, loss(b, k)]);
      }
    }
    return { b, k, path, curve };
  }
  const SCHED_PY = { const: 'lr', decay: 'lr / (1 + t / 100)', cos: 'lr * (1 + np.cos(np.pi * t / T)) / 2' };
  GBC.widget('sgd', (el) => {
    const s = { batch: 10, lr: 0.1, epochs: 3, sched: 'const' };
    const w = ui.shell(el, { title: 'Стохастический градиент: шаги по кусочкам данных', sub: 'Та же прямая y = b + kx. Каждый шаг — по случайной пачке из B объектов, эпоха — проход по всем 200 точкам в случайном порядке. Батч 200 — обычный (полный) градиентный спуск.' });
    ui.slider(w.controls, { label: 'Размер батча B', values: [1, 5, 10, 50, 200], value: s.batch, format: String, onInput: (v) => ((s.batch = v), draw()) });
    ui.slider(w.controls, { label: 'Темп η', min: 0.01, max: 0.5, step: 0.01, value: s.lr, format: f2, onInput: (v) => ((s.lr = v), draw()) });
    ui.slider(w.controls, { label: 'Эпох (проходов по данным)', min: 1, max: 10, step: 1, value: s.epochs, format: String, onInput: (v) => ((s.epochs = v), draw()) });
    ui.select(w.controls, { label: 'Расписание темпа', value: s.sched, options: [{ value: 'const', label: 'постоянный' }, { value: 'decay', label: 'убывающий η/(1 + t/100)' }, { value: 'cos', label: 'косинусный до нуля' }], onChange: (v) => ((s.sched = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 280, equal: true, x: { label: 'сдвиг b', domain: [-0.5, 2.5] }, y: { label: 'наклон k', domain: [-0.5, 3] }, grid: 'none' });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'просмотрено объектов' }, y: { label: 'потери − минимум (лог.)', type: 'log', domain: [1e-6, 10], ticks: decades(-6, 1), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'steps', label: 'шагов' }, { key: 'L', label: 'потери − минимум в конце' }, { key: 'opt', label: 'минимум потерь' }]);
    const base = mapLayers((bb, kk) => LIN.loss(bb, kk), [-0.5, 2.5, -0.5, 3], [0.2, 0.4, 0.8, 1.5, 2.5]);
    function draw() {
      const R0 = sgdRun(s.batch, s.lr, s.epochs, s.sched, 17, true);
      p1.render([
        ...base,
        { type: 'line', x: R0.path.map((q) => q[0]), y: R0.path.map((q) => q[1]), color: 'tree', width: 1.4, hover: false },
        { type: 'points', x: [LIN.bOpt], y: [LIN.kOpt], color: 'ink', r: 6, hollow: true, label: 'оптимум' },
      ]);
      p2.render([{ type: 'line', x: R0.curve.map((q) => q[0]), y: R0.curve.map((q) => Math.max(q[1] - LIN.Lmin, 1e-7)), color: 'model', width: 1.6, hover: false }], { x: [0, 200 * s.epochs] });
      const ex = LIN.loss(R0.b, R0.k) - LIN.Lmin;
      st.set('steps', String(R0.path.length - 1));
      st.set('L', sci(ex));
      st.set('opt', f4(LIN.Lmin));
      note.innerHTML = 'Батч 200 — полный градиент: один шаг за эпоху, гладкий путь, но медленно. Батч 1 — 200 шагов за эпоху: путь дрожит, зато к окрестности минимума приходит за меньшее число просмотренных объектов. С постоянным темпом шум не даёт сойтись точно — потери «зависают» на уровне, пропорциональном η (следующий виджет). Убывающий или косинусный темп гасит дрожание к концу обучения. Стохастический бустинг (урок 7.2) тоже строит каждое дерево по случайной подвыборке — ради скорости и регуляризации.';
    }
    w.pythonAction(() => PY_LIN + '\nB, lr, epochs = ' + s.batch + ', ' + py(s.lr) + ', ' + s.epochs + '\nrng = Mulberry32(17)\nb = k = 0.0\nt, T = 0, epochs * int(np.ceil(N / B))\nfor e in range(epochs):\n    perm = rng.permutation(N)\n    for s in range(0, N, B):\n        idx = perm[s:s + B]\n        r = ys[idx] - b - k * xs[idx]\n        eta = ' + SCHED_PY[s.sched] + '\n        b += eta * r.mean(); k += eta * (r * xs[idx]).mean()\n        t += 1\nprint(f"b = {b:.4f}, k = {k:.4f}; потери − минимум = {loss(b, k) - L_min:.2e}")\nprint(f"оптимум: b = {b_opt:.4f}, k = {k_opt:.4f}")\n');
    draw();
  });

  GBC.widget('noise-floor', (el) => {
    const s = { B: 1 };
    const w = ui.shell(el, { title: 'Пол шума: куда «зависает» SGD с постоянным темпом', sub: 'Верхний график: 4000 шагов SGD с постоянным η; среднее превышение потерь над минимумом по второй половине пути (3 запуска). Оно растёт с η и падает с ростом батча B. Нижний — расписания темпа при B = 1 за 20 эпох.' });
    ui.segmented(w.controls, { label: 'Размер батча', value: '1', options: [{ value: '1', label: 'B = 1' }, { value: '10', label: 'B = 10' }], onChange: (v) => ((s.B = +v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'темп η (лог.)', type: 'log', domain: [0.005, 0.4], ticks: [0.005, 0.01, 0.02, 0.05, 0.1, 0.2] }, y: { label: 'потери − минимум (лог.)', type: 'log', domain: [1e-5, 0.1], ticks: decades(-5, -1), format: powFmt } });
    p1.setTitle('пол шума при постоянном темпе');
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'эпоха', domain: [0, 20] }, y: { label: 'потери − минимум (лог.)', type: 'log', domain: [1e-6, 10], ticks: decades(-6, 1), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'slope', label: 'наклон по η (лог.)' }, { key: 'r', label: 'B = 1 против B = 10 при η = 0.05' }, { key: 'best', label: 'лучшее расписание' }]);
    const ETAS = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2];
    const xm = U.mean(LIN.xs);
    const x2m = U.mean(LIN.xs.map((x) => x * x));
    /** Превышение потерь над минимумом — точная квадратичная форма (потери квадратичны по b, k). */
    const excess = (b, k) => {
      const db = b - LIN.bOpt;
      const dk = k - LIN.kOpt;
      return 0.5 * (db * db + 2 * db * dk * xm + dk * dk * x2m);
    };
    /** Пол шума: 4000 шагов SGD (объекты батча — с возвращением), среднее превышение по шагам 2001–4000. */
    function floor(B, eta) {
      let acc = 0;
      let cnt = 0;
      for (let seed = 0; seed < 3; seed++) {
        const r = new GBC.RNG(300 + seed);
        let b = 0;
        let k = 0;
        for (let t = 1; t <= 4000; t++) {
          let gb = 0;
          let gk = 0;
          for (let j = 0; j < B; j++) {
            const i = r.randint(LIN.N);
            const res = LIN.ys[i] - b - k * LIN.xs[i];
            gb -= res;
            gk -= res * LIN.xs[i];
          }
          b -= (eta * gb) / B;
          k -= (eta * gk) / B;
          if (t > 2000) {
            acc += excess(b, k);
            cnt++;
          }
        }
      }
      return acc / cnt;
    }
    const FL = { 1: ETAS.map((e) => floor(1, e)), 10: ETAS.map((e) => floor(10, e)) };
    const SCH = [
      { key: 'c1', label: 'постоянный 0.1', run: () => sgdRun(1, 0.1, 20, 'const', 300), color: 'red' },
      { key: 'c2', label: 'постоянный 0.01', run: () => sgdRun(1, 0.01, 20, 'const', 300), color: 'muted' },
      { key: 'd', label: 'убывающий 0.1/(1 + t/100)', run: () => sgdRun(1, 0.1, 20, 'decay', 300), color: 'model' },
      { key: 'cos', label: 'косинусный от 0.1 до 0', run: () => sgdRun(1, 0.1, 20, 'cos', 300), color: 'tree' },
    ].map((q) => Object.assign(q, { R: q.run() }));
    function draw() {
      const fl = FL[s.B];
      const other = FL[s.B === 1 ? 10 : 1];
      p1.render([
        { type: 'line', x: ETAS, y: other, color: 'muted', width: 1.4, dash: '5 4', label: 'B = ' + (s.B === 1 ? 10 : 1) },
        { type: 'line', x: ETAS, y: fl, color: 'model', width: 2.4, label: 'B = ' + s.B },
        { type: 'points', x: ETAS, y: fl, color: 'model', r: 4.5 },
      ]);
      const L2 = [];
      for (const q of SCH) {
        const c = q.R.curve.filter((_, i) => i % 20 === 0);
        L2.push({ type: 'line', x: c.map((v) => v[0] / 200), y: c.map((v) => Math.max(v[1] - LIN.Lmin, 1e-7)), color: q.color, width: 1.8, label: q.label });
      }
      p2.render(L2);
      const slope = (Math.log(fl[4]) - Math.log(fl[1])) / (Math.log(ETAS[4]) - Math.log(ETAS[1]));
      const fin = SCH.map((q) => [q.label, LIN.loss(q.R.b, q.R.k) - LIN.Lmin]);
      fin.sort((a, b) => a[1] - b[1]);
      st.set('slope', f2(slope));
      st.set('r', '×' + f1(FL[1][3] / FL[10][3]));
      st.set('best', fin[0][0] + ' (' + sci(fin[0][1]) + ')');
      note.innerHTML = 'С постоянным темпом SGD не сходится к минимуму, а «танцует» вокруг него: каждый шаг добавляет шум размером ~η·σ/√B, а притяжение к минимуму убирает долю ~η от отклонения. Баланс даёт превышение потерь ≈ c·η/B: наклон на логарифмическом графике ≈ ' + f2(slope) + ' (теория — 1), а батч 10 вместо 1 уменьшает пол в ' + f1(FL[1][3] / FL[10][3]) + ' раза. Отсюда рецепт: начинать с большого темпа (быстрый грубый прогресс), а потом уменьшать — условия Роббинса — Монро Σηₜ = ∞, Σηₜ² &lt; ∞ (урок 15.10, шаг 29). Маленький постоянный темп даёт низкий пол, но долго до него идёт; убывающий и косинусный совмещают оба достоинства. Итог после 20 эпох: ' + fin.map((q) => q[0] + ' — ' + sci(q[1])).join('; ') + '.';
    }
    w.pythonAction(() => PY_LIN + '\ndef floor(B, eta):\n    """4000 шагов SGD (батч с возвращением), среднее превышение потерь по шагам 2001–4000, 3 запуска."""\n    acc = []\n    for seed in range(3):\n        r = Mulberry32(300 + seed)\n        b = k = 0.0\n        for t in range(1, 4001):\n            idx = [r.randint(N) for _ in range(B)]\n            res = ys[idx] - b - k * xs[idx]\n            b += eta * res.mean(); k += eta * (res * xs[idx]).mean()\n            if t > 2000:\n                acc.append(loss(b, k) - L_min)\n    return np.mean(acc)\n\nfor B in (1, 10):\n    print(f"B = {B}:", "  ".join(f"η={eta}: {floor(B, eta):.2e}" for eta in (0.01, 0.05, 0.2)))\n\ndef sgd(B, lr, epochs, sched, seed):\n    rng = Mulberry32(seed)\n    b = k = 0.0; t = 0; T = epochs * int(np.ceil(N / B))\n    for e in range(epochs):\n        perm = rng.permutation(N)\n        for s in range(0, N, B):\n            idx = perm[s:s + B]\n            r = ys[idx] - b - k * xs[idx]\n            eta = lr if sched == "const" else (lr / (1 + t / 100) if sched == "decay" else lr * (1 + np.cos(np.pi * t / T)) / 2)\n            b += eta * r.mean(); k += eta * (r * xs[idx]).mean(); t += 1\n    return loss(b, k) - L_min\n\nfor sched, lr in (("const", 0.1), ("const", 0.01), ("decay", 0.1), ("cos", 0.1)):\n    print("расписание", sched, lr, f"→ {sgd(1, lr, 20, sched, 300):.2e}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 27. Острые и плоские минимумы
   * ============================================================================== */
  const SF = {
    f: (x) => Math.min(25 * (x + 2) ** 2 - 1, 0.5 * (x - 1.5) ** 2 - 0.8),
    d: (x) => (25 * (x + 2) ** 2 - 1 < 0.5 * (x - 1.5) ** 2 - 0.8 ? 50 * (x + 2) : x - 1.5),
    py: 'f = lambda x: np.minimum(25 * (x + 2)**2 - 1, 0.5 * (x - 1.5)**2 - 0.8)\ndf = lambda x: 50 * (x + 2) if 25 * (x + 2)**2 - 1 < 0.5 * (x - 1.5)**2 - 0.8 else x - 1.5\n',
  };
  function sfRun(eta, sig, seed) {
    const r = new GBC.RNG(seed);
    let x = -4 + 8 * r.random();
    for (let k = 0; k < 1500; k++) x = U.clamp(x - eta * (SF.d(x) + sig * r.normal()), -4, 4);
    return x;
  }
  GBC.widget('sharp-flat', (el) => {
    const s = { eta: 0.02, sig: 0, shift: 0.25 };
    const w = ui.shell(el, { title: 'Острый или плоский минимум?', sub: 'Слева острая глубокая яма (кривизна 50), справа плоская чуть менее глубокая (кривизна 1). 400 спусков из случайных точек: x ← x − η(f′(x) + σ·шум). Внизу — где они закончили. Сдвиг δ имитирует отличие тестовых данных от обучающих.' });
    ui.slider(w.controls, { label: 'Темп η', values: [0.01, 0.02, 0.03, 0.035, 0.039, 0.041, 0.05], value: s.eta, format: String, onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Шум σ (как в SGD)', values: [0, 2, 5, 10, 20], value: s.sig, format: String, onInput: (v) => ((s.sig = v), draw()) });
    ui.slider(w.controls, { label: 'Сдвиг на тесте δ', min: 0, max: 0.4, step: 0.05, value: s.shift, format: f2, onInput: (v) => ((s.shift = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'параметр x', domain: [-4, 4] }, y: { label: 'потери', domain: [-1.2, 2.5] } });
    const p2 = new GBC.Plot(w.main, { height: 170, x: { label: 'где закончили 400 спусков', domain: [-4, 4] }, y: { label: 'доля', domain: [0, 0.8] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sharp', label: 'в острой яме' }, { key: 'flat', label: 'в плоской' }, { key: 'tr', label: 'средние потери: обучение' }, { key: 'te', label: 'тест (сдвиг δ)' }]);
    const cache = {};
    function draw() {
      const key = s.eta + '|' + s.sig;
      if (!cache[key]) cache[key] = U.range(400).map((i) => sfRun(s.eta, s.sig, 50 + i));
      const ends = cache[key];
      const xs = U.linspace(-4, 4, 800);
      p1.render([
        { type: 'line', x: xs, y: xs.map(SF.f), color: 'model', width: 2.4, label: 'обучение f(x)', hover: false },
        { type: 'line', x: xs, y: xs.map((x) => SF.f(x - s.shift)), color: 'tree', width: 1.8, dash: '6 4', label: 'тест f(x − δ)', hover: false },
      ]);
      const bins = U.linspace(-4, 4, 81);
      const cnt = new Array(80).fill(0);
      for (const e of ends) cnt[Math.min(79, Math.max(0, Math.floor((e + 4) / 0.1)))]++;
      p2.render([{ type: 'bars', x: bins.slice(0, 80).map((b) => b + 0.05), y: cnt.map((c) => c / 400), width: 0.1, color: (i) => (bins[i] < 0 ? 'red' : 'model') }]);
      const sharp = ends.filter((e) => Math.abs(e + 2) < 0.35).length / 400;
      const flat = ends.filter((e) => e > 0).length / 400;
      const tr = U.mean(ends.map(SF.f));
      const te = U.mean(ends.map((e) => SF.f(e - s.shift)));
      st.set('sharp', pct(sharp));
      st.set('flat', pct(flat));
      st.set('tr', f3(tr));
      st.set('te', f3(te));
      note.innerHTML = 'Острая яма глубже (−1 против −0.8), но устойчиво сидеть в ней спуск может, только если η &lt; 2/50 = 0.04 (шаг 15): при больших шагах колебания в ней нарастают, точка вылетает и оседает в плоской яме. Шум выбрасывает из узкой ямы и при меньшем шаге: при η = 0.02 и σ = 10 в острой яме остаются лишь единицы процентов спусков, а из широкой ямы тот же шум не выбрасывает — только размывает положение точки (средние потери растут, поэтому к концу обучения шум гасят расписанием темпа, шаг 26). Сейчас в острой яме ' + pct(sharp) + ' спусков. На «тесте» (функция сдвинута на δ = ' + f2(s.shift) + ') острый минимум катастрофически портится: 25δ² − 1 = ' + f3(25 * s.shift ** 2 - 1) + ', а плоский почти не меняется: 0.5δ² − 0.8 = ' + f3(0.5 * s.shift ** 2 - 0.8) + '. Отсюда популярная (хоть и не бесспорная) гипотеза: большие шаги и шум SGD тянут к плоским минимумам, а они лучше обобщаются. Для бустинга аналог — маленький темп ν и подвыборки (урок 7.2).';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\n' + SF.py + '\ndef run(eta, sig, seed):\n    r = Mulberry32(seed)\n    x = -4 + 8 * r.random()\n    for _ in range(1500):\n        x = min(4, max(-4, x - eta * (df(x) + sig * r.normal())))\n    return x\n\neta, sig, delta = ' + py(s.eta) + ', ' + py(s.sig) + ', ' + py(s.shift) + '\nends = np.array([run(eta, sig, 50 + i) for i in range(400)])\nprint("в острой яме:", np.mean(np.abs(ends + 2) < 0.35), " в плоской:", np.mean(ends > 0))\nprint("потери: обучение", f(ends).mean().round(3), " тест", f(ends - delta).mean().round(3))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 28. Ограничения-неравенства и условия ККТ
   * ============================================================================== */
  const KKT_C = [
    { a: [-1, 0], b: 0, name: 'w₁ ≥ 0' },
    { a: [0, -1], b: 0, name: 'w₂ ≥ 0' },
    { a: [1, 2], b: 4, name: 'w₁ + 2w₂ ≤ 4' },
    { a: [1, 0], b: 3, name: 'w₁ ≤ 3' },
  ];
  /** Проекция точки t на многоугольник {a·w ≤ b}: перебор граней и вершин. */
  function projPoly(t, C) {
    const feas = (w) => C.every((c) => c.a[0] * w[0] + c.a[1] * w[1] <= c.b + 1e-9);
    if (feas(t)) return t.slice();
    let best = null;
    let bd = Infinity;
    const tryP = (w) => {
      if (!feas(w)) return;
      const d = (w[0] - t[0]) ** 2 + (w[1] - t[1]) ** 2;
      if (d < bd - 1e-15) (bd = d), (best = w);
    };
    for (const c of C) {
      const aa = c.a[0] ** 2 + c.a[1] ** 2;
      const viol = (c.a[0] * t[0] + c.a[1] * t[1] - c.b) / aa;
      tryP([t[0] - viol * c.a[0], t[1] - viol * c.a[1]]);
    }
    for (let i = 0; i < C.length; i++) {
      for (let j = i + 1; j < C.length; j++) {
        const A = C[i].a;
        const B = C[j].a;
        const d = A[0] * B[1] - A[1] * B[0];
        if (Math.abs(d) < 1e-12) continue;
        tryP([(C[i].b * B[1] - A[1] * C[j].b) / d, (A[0] * C[j].b - C[i].b * B[0]) / d]);
      }
    }
    return best;
  }
  GBC.widget('kkt', (el) => {
    const s = { t: [3.6, 2.4], b3: 4 };
    const w = ui.shell(el, { title: 'Условия ККТ: ближайшая допустимая точка', sub: 'Минимизируем ½‖w − t‖² — ищем ближайшую к цели t точку многоугольника. Перетаскивайте t. В решении антиградиент (чёрная стрелка) уравновешен «силами» активных ограничений — их нормалями с множителями μ ≥ 0 (оранжевые).' });
    ui.slider(w.controls, { label: 'Бюджет b в ограничении w₁ + 2w₂ ≤ b', min: 2, max: 6, step: 0.25, value: s.b3, format: f2, onInput: (v) => ((s.b3 = v), draw()) });
    const box = H('div', { style: 'max-width:470px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 360, equal: true, x: { label: 'w₁', domain: [-1, 5] }, y: { label: 'w₂', domain: [-1, 4] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'решение w*' }, { key: 'act', label: 'активные ограничения' }, { key: 'mu', label: 'множители μ' }, { key: 'sh', label: 'теневая цена бюджета: μ / численно' }]);
    function solveFor(b3, t) {
      const C = KKT_C.map((c, i) => (i === 2 ? Object.assign({}, c, { b: b3 }) : c));
      const wv = projPoly(t, C);
      const fval = 0.5 * ((wv[0] - t[0]) ** 2 + (wv[1] - t[1]) ** 2);
      return { C, wv, fval };
    }
    function draw() {
      const { C, wv, fval } = solveFor(s.b3, s.t);
      const act = C.map((c, i) => [i, Math.abs(c.a[0] * wv[0] + c.a[1] * wv[1] - c.b) < 1e-7]).filter((q) => q[1]).map((q) => q[0]);
      // t − w = Σ μ_i a_i  → решаем по активным
      const r = [s.t[0] - wv[0], s.t[1] - wv[1]];
      let mu = [];
      if (act.length === 1) {
        const a = C[act[0]].a;
        mu = [(r[0] * a[0] + r[1] * a[1]) / (a[0] ** 2 + a[1] ** 2)];
      } else if (act.length >= 2) {
        const A = C[act[0]].a;
        const B = C[act[1]].a;
        const d = A[0] * B[1] - A[1] * B[0];
        mu = [(r[0] * B[1] - B[0] * r[1]) / d, (A[0] * r[1] - r[0] * A[1]) / d];
      }
      const verts = [];
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const A = C[i].a;
          const B = C[j].a;
          const d = A[0] * B[1] - A[1] * B[0];
          if (Math.abs(d) < 1e-12) continue;
          const p = [(C[i].b * B[1] - A[1] * C[j].b) / d, (A[0] * C[j].b - C[i].b * B[0]) / d];
          if (C.every((c) => c.a[0] * p[0] + c.a[1] * p[1] <= c.b + 1e-9)) verts.push(p);
        }
      }
      const cx = U.mean(verts.map((p) => p[0]));
      const cy = U.mean(verts.map((p) => p[1]));
      verts.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
      const fobj = (x, y) => 0.5 * ((x - s.t[0]) ** 2 + (y - s.t[1]) ** 2);
      const grid = GBC.Plot.grid(fobj, -1, 5, -1, 4, 90, 90);
      const L = [
        { type: 'polygon', x: verts.map((p) => p[0]), y: verts.map((p) => p[1]), color: 'model', stroke: 'model', width: 1.6, opacity: 0.14, label: 'допустимое множество' },
        { type: 'contour', grid, level: fval, color: 'violet', width: 1.6, dash: '5 4' },
        { type: 'line', x: [s.t[0], wv[0]], y: [s.t[1], wv[1]], color: 'ink2', dash: '3 3', width: 1.2, hover: false },
      ];
      if (act.length) {
        L.push({ type: 'arrows', x1: [wv[0]], y1: [wv[1]], x2: [wv[0] + r[0]], y2: [wv[1] + r[1]], color: 'ink', width: 2.4 });
        L.push({ type: 'arrows', x1: act.map(() => wv[0]), y1: act.map(() => wv[1]), x2: act.map((i, k) => wv[0] + mu[k] * C[i].a[0]), y2: act.map((i, k) => wv[1] + mu[k] * C[i].a[1]), color: 'tree', width: 2 });
      }
      L.push({ type: 'points', x: [wv[0]], y: [wv[1]], color: 'tree', r: 7, label: 'решение w*' });
      L.push({ type: 'points', x: [s.t[0]], y: [s.t[1]], color: 'ink', r: 7, hollow: true, draggable: true, onDrag: (i, x, y) => ((s.t = [x, y]), draw()), label: 't (перетащите)' });
      plot.render(L);
      // теневая цена бюджета: производная оптимума по b3
      const h = 1e-4;
      const num = (solveFor(s.b3 - h, s.t).fval - solveFor(s.b3 + h, s.t).fval) / (2 * h);
      const i3 = act.indexOf(2);
      st.set('w', '(' + f3(wv[0]) + ', ' + f3(wv[1]) + ')');
      st.set('act', act.length ? act.map((i) => C[i].name.replace('4', f2(s.b3))).join('; ') : 'нет (t внутри)');
      st.set('mu', act.length ? mu.map(f3).join('; ') : '—');
      st.set('sh', (i3 >= 0 ? f3(mu[i3]) : '0') + ' / ' + f3(num));
      note.innerHTML = (act.length === 0
        ? 'Цель t допустима — она и есть решение, ограничения неактивны и их множители равны нулю.'
        : 'Решение — проекция t на многоугольник. Условия Каруша — Куна — Таккера (ККТ): (1) w* допустимо; (2) −∇f(w*) = t − w* = Σ μᵢ·aᵢ — антиградиент раскладывается по нормалям активных ограничений; (3) μᵢ ≥ 0 — ограничения «толкают», а не «тянут»; (4) μᵢ = 0 для неактивных (дополняющая нежёсткость). Здесь активны: ' + act.map((i) => C[i].name).join(', ') + '; μ = ' + mu.map(f3).join(', ') + '.') + ' Множитель — <b>теневая цена</b>: на сколько уменьшится оптимум, если ослабить ограничение на единицу. Для бюджета μ = ' + (i3 >= 0 ? f3(mu[i3]) : '0') + ', а численная производная оптимума по b равна ' + f3(num) + '. В ML множитель штрафа λ — та же теневая цена «размера» модели (шаг 30).';
    }
    w.pythonAction(() => PY_NP + 'from scipy.optimize import minimize\n\nt = np.array([' + py(Math.round(s.t[0] * 1000) / 1000) + ', ' + py(Math.round(s.t[1] * 1000) / 1000) + '])\nb = ' + py(s.b3) + '\ncons = [{"type": "ineq", "fun": lambda w: w[0]}, {"type": "ineq", "fun": lambda w: w[1]},\n        {"type": "ineq", "fun": lambda w: b - w[0] - 2 * w[1]}, {"type": "ineq", "fun": lambda w: 3 - w[0]}]\nres = minimize(lambda w: 0.5 * ((w - t)**2).sum(), x0=np.zeros(2), constraints=cons, method="SLSQP")\nprint("решение:", res.x.round(4), " f* =", round(res.fun, 4))\n# теневая цена бюджета: производная оптимума по b\ndef opt(bb):\n    c = cons[:2] + [{"type": "ineq", "fun": lambda w: bb - w[0] - 2 * w[1]}, cons[3]]\n    return minimize(lambda w: 0.5 * ((w - t)**2).sum(), np.zeros(2), constraints=c, method="SLSQP", tol=1e-12).fun\nprint("df*/db ≈", round((opt(b - 1e-3) - opt(b + 1e-3)) / 2e-3, 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 29. Штраф, барьер, проекция
   * ============================================================================== */
  GBC.widget('penalty-barrier', (el) => {
    const s = { mode: 'penalty', mu: 3, t: 1, eta: 0.2 };
    const w = ui.shell(el, { title: 'Три способа соблюсти ограничение', sub: 'Минимизируем (x − 3)² при условии x ≤ 1 (ответ: x* = 1). Штраф подходит к границе снаружи, барьер — изнутри, проекция просто возвращает шаг в допустимую область.' });
    ui.segmented(w.controls, { label: 'Способ', value: s.mode, options: [{ value: 'penalty', label: 'штраф' }, { value: 'barrier', label: 'барьер' }, { value: 'proj', label: 'проекция' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'Сила штрафа μ', min: 0.1, max: 1000, log: true, value: s.mu, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.mu = v), draw()) });
    ui.slider(w.controls, { label: 'Вес барьера t', min: 0.001, max: 10, log: true, value: s.t, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.t = v), draw()) });
    ui.slider(w.controls, { label: 'Шаг проекционного спуска η', min: 0.05, max: 0.9, step: 0.05, value: s.eta, format: f2, onInput: (v) => ((s.eta = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [-1.5, 4] }, y: { label: 'значение', domain: [-0.5, 12] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'решение вспомогательной задачи' }, { key: 'viol', label: 'нарушение x − 1' }, { key: 'f', label: '(x − 3)²' }]);
    function draw() {
      const xs = U.linspace(-1.5, 4, 551);
      const f = (x) => (x - 3) ** 2;
      const L = [{ type: 'vband', x0: -1.5, x1: 1, color: 'model', opacity: 0.08 }, { type: 'vline', x: 1, color: 'ink2', width: 1.4, text: 'x = 1' }, { type: 'line', x: xs, y: xs.map(f), color: 'muted', width: 1.6, dash: '5 4', label: '(x − 3)²', hover: false }];
      let x;
      let txt;
      if (s.mode === 'penalty') {
        x = (3 + s.mu) / (1 + s.mu);
        L.push({ type: 'line', x: xs, y: xs.map((t) => f(t) + s.mu * Math.max(0, t - 1) ** 2), color: 'model', width: 2.4, label: '(x − 3)² + μ·max(0, x − 1)²' });
        txt = 'Штраф: нарушение разрешено, но стоит μ·(x − 1)². Решение x = (3 + μ)/(1 + μ) всегда чуть правее 1 — <b>недопустимо</b>, и лишь при μ → ∞ стремится к 1. Большое μ делает задачу плохо обусловленной (резкая стенка). Так устроены мягкие ограничения в ML: L1/L2-штрафы не запрещают большие веса, а делают их дорогими.';
      } else if (s.mode === 'barrier') {
        x = 2 - Math.sqrt(1 + s.t / 2);
        L.push({ type: 'line', x: xs, y: xs.map((u) => (u < 1 ? f(u) - s.t * Math.log(1 - u) : NaN)), color: 'model', width: 2.4, label: '(x − 3)² − t·ln(1 − x)' });
        txt = 'Барьер: −t·ln(1 − x) уходит в +∞ у границы, и решение x = 2 − √(1 + t/2) всегда строго <b>внутри</b> допустимой области; при t → 0 оно стремится к 1. На этой идее построены методы внутренней точки — стандарт для больших линейных и выпуклых задач.';
      } else {
        const it = [-1];
        let z = -1;
        for (let k = 0; k < 12; k++) {
          z = Math.min(1, z - s.eta * 2 * (z - 3));
          it.push(z);
        }
        x = z;
        L.push({ type: 'points', x: it, y: it.map(f), color: 'tree', r: 5, label: 'итерации проекционного спуска' });
        L.push({ type: 'line', x: it, y: it.map(f), color: 'tree', width: 1.2, opacity: 0.6, hover: false });
        txt = 'Проекция: делаем обычный шаг спуска, а если он вывел за границу — возвращаемся в ближайшую допустимую точку: x ← min(1, x − η·f′(x)). Для простых множеств (отрезок, шар, «коробка») проекция — одна формула, и метод точно соблюдает ограничение. В XGBoost так работает max_delta_step: шаг листа обрезается до ±max_delta_step.';
      }
      L.push({ type: 'points', x: [x], y: [f(x)], color: 'tree', r: 7 });
      plot.render(L);
      st.set('x', f4(x));
      st.set('viol', U.fmt(x - 1, 4));
      st.set('f', f4(f(x)));
      note.innerHTML = txt;
    }
    w.pythonAction(() => PY_NP + '\nfor mu in (1, 10, 100, 1000):\n    print(f"штраф μ = {mu:5}: x = {(3 + mu) / (1 + mu):.5f}")\nfor t in (1, 0.1, 0.01, 0.001):\n    print(f"барьер t = {t:6}: x = {2 - np.sqrt(1 + t / 2):.5f}")\nx, eta = -1.0, ' + py(s.eta) + '\nfor k in range(12):\n    x = min(1.0, x - eta * 2 * (x - 3))\nprint("проекционный спуск:", x)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 30. Штраф = ограничение: L2 и L1
   * ============================================================================== */
  GBC.widget('constraint-penalty', (el) => {
    const s = { lam: 2, kind: 'l2' };
    const f = (a, b) => (a - 2) ** 2 + 4 * (b - 1.5) ** 2;
    const sol = (lam, kind) => (kind === 'l2' ? [2 / (1 + lam), 6 / (4 + lam)] : [Math.max(0, 2 - lam / 2), Math.max(0, 1.5 - lam / 8)]);
    const w = ui.shell(el, { title: 'Штраф = ограничение: L2 и L1', sub: 'Минимизируем потери (линии уровня, минимум в (2, 1.5)) плюс штраф λ·‖w‖. Решение — точка, где линия уровня касается «шара» нормы радиуса C. Каждому λ соответствует своё C.' });
    ui.segmented(w.controls, { label: 'Штраф', value: s.kind, options: [{ value: 'l2', label: 'L2: λ‖w‖²' }, { value: 'l1', label: 'L1: λ‖w‖₁' }], onChange: (v) => ((s.kind = v), draw()) });
    ui.slider(w.controls, { label: 'Сила штрафа λ', min: 0, max: 16, step: 0.25, value: s.lam, onInput: (v) => ((s.lam = v), draw()) });
    const box = H('div', { style: 'max-width:520px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 340, equal: true, x: { label: 'вес w₁', domain: [-1.2, 3] }, y: { label: 'вес w₂', domain: [-1, 2.4] }, grid: 'none' });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'λ', domain: [0, 16] }, y: { label: 'радиус C шара' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'решение (w₁, w₂)' }, { key: 'loss', label: 'потери' }, { key: 'norm', label: 'C = норма решения' }]);
    function draw() {
      const kind = s.kind;
      const [a, b] = sol(s.lam, kind);
      const lams = U.linspace(0, 16, 161);
      const path = lams.map((l) => sol(l, kind));
      const t = U.linspace(0, 2 * Math.PI, 200);
      const nrm = (p) => (kind === 'l2' ? Math.hypot(p[0], p[1]) : Math.abs(p[0]) + Math.abs(p[1]));
      const r = nrm([a, b]);
      const ball = kind === 'l2' ? t.map((q) => [r * Math.cos(q), r * Math.sin(q)]) : [[r, 0], [0, r], [-r, 0], [0, -r], [r, 0]];
      const lv = f(a, b);
      plot.render([
        ...mapLayers(f, [-1.2, 3, -1, 2.4], [0.25, 1, 2.5, 5, 9]),
        { type: 'contour', grid: GBC.Plot.grid(f, -1.2, 3, -1, 2.4, 120, 120), level: Math.max(lv, 1e-6), color: 'model', width: 2.2 },
        { type: 'line', x: ball.map((q) => q[0]), y: ball.map((q) => q[1]), color: 'tree', width: 2.2, label: 'шар нормы радиуса C', hover: false },
        { type: 'line', x: path.map((q) => q[0]), y: path.map((q) => q[1]), color: 'ink2', width: 1.4, dash: '4 3', label: 'путь решения при росте λ', hover: false },
        { type: 'points', x: [2], y: [1.5], color: 'ink', r: 5, hollow: true },
        { type: 'points', x: [a], y: [b], color: 'tree', r: 7 },
      ]);
      p2.render([
        { type: 'line', x: lams, y: path.map(nrm), color: 'tree', width: 2.2, hover: false },
        { type: 'points', x: [s.lam], y: [r], color: 'tree', r: 6 },
      ]);
      st.set('w', '(' + f3(a) + ', ' + f3(b) + ')');
      st.set('loss', f3(lv));
      st.set('norm', f3(r));
      note.innerHTML = kind === 'l2'
        ? 'L2 плавно стягивает оба веса к нулю, но ни один не обнуляет: w = (2/(1 + λ), 6/(4 + λ)). Задача «потери + λ‖w‖²» даёт то же решение, что «потери при ‖w‖ ≤ C» с C = ' + f3(r) + ' (нижний график: C убывает с ростом λ). λ — множитель Лагранжа этого ограничения, его теневая цена (шаг 28). Так работает reg_lambda в XGBoost (урок 7.3).'
        : 'У L1-шара острые углы на осях — линия уровня чаще касается его в углу, и вес становится <b>ровно нулём</b>: при λ ≥ 4 обнуляется w₁, при λ ≥ 12 — и w₂. Поэтому L1 отбирает признаки. Решение покомпонентно — мягкий порог (шаг 20): wᵢ = max(0, wᵢ⁰ − λ/(2aᵢ)). В XGBoost это reg_alpha.';
    }
    w.pythonAction(() => PY_NP + '\nfor lam in [0, 2, 4, 8, 12]:\n    l2 = np.array([2 / (1 + lam), 6 / (4 + lam)])\n    l1 = np.array([max(0, 2 - lam / 2), max(0, 1.5 - lam / 8)])\n    print(f"λ = {lam:2d}: L2 → {l2.round(3)}, C = {np.linalg.norm(l2):.3f};   L1 → {l1.round(3)}, C = {np.abs(l1).sum():.3f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 31. Линейное программирование
   * ============================================================================== */
  const LPC = [
    { a: [1, 1], b: 4, name: 'сырьё: x + y ≤ 4' },
    { a: [1, 3], b: 9, name: 'труд: x + 3y ≤ 9' },
    { a: [1, 0], b: 3, name: 'станок: x ≤ 3' },
    { a: [-1, 0], b: 0, name: 'x ≥ 0' },
    { a: [0, -1], b: 0, name: 'y ≥ 0' },
  ];
  function lpVertices(C) {
    const out = [];
    for (let i = 0; i < C.length; i++) {
      for (let j = i + 1; j < C.length; j++) {
        const A = C[i].a;
        const B = C[j].a;
        const d = A[0] * B[1] - A[1] * B[0];
        if (Math.abs(d) < 1e-12) continue;
        const p = [(C[i].b * B[1] - A[1] * C[j].b) / d, (A[0] * C[j].b - C[i].b * B[0]) / d];
        if (C.every((c) => c.a[0] * p[0] + c.a[1] * p[1] <= c.b + 1e-9) && !out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9)) out.push(p);
      }
    }
    const cx = U.mean(out.map((p) => p[0]));
    const cy = U.mean(out.map((p) => p[1]));
    out.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
    return out;
  }
  function lpSolve(C, c) {
    const V = lpVertices(C);
    let bi = 0;
    V.forEach((p, i) => {
      if (c[0] * p[0] + c[1] * p[1] > c[0] * V[bi][0] + c[1] * V[bi][1] + 1e-12) bi = i;
    });
    return { V, bi, val: c[0] * V[bi][0] + c[1] * V[bi][1] };
  }
  GBC.widget('lp', (el) => {
    const s = { pA: 3, pB: 2 };
    const w = ui.shell(el, { title: 'Линейное программирование: план производства', sub: 'Цех делает изделия A (x штук) и B (y штук). Ограничения по сырью, труду и станку задают многоугольник допустимых планов. Прибыль pA·x + pB·y — линейна; линии равной прибыли — параллельные прямые. Оптимум всегда в вершине.' });
    ui.slider(w.controls, { label: 'Прибыль с изделия A, pA', min: 0.5, max: 5, step: 0.1, value: s.pA, format: f1, onInput: (v) => ((s.pA = v), draw()) });
    ui.slider(w.controls, { label: 'Прибыль с изделия B, pB', min: 0.5, max: 5, step: 0.1, value: s.pB, format: f1, onInput: (v) => ((s.pB = v), draw()) });
    const box = H('div', { style: 'max-width:470px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 340, equal: true, x: { label: 'x — изделий A', domain: [-0.5, 5] }, y: { label: 'y — изделий B', domain: [-0.5, 4.2] } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'plan', label: 'оптимальный план' }, { key: 'val', label: 'прибыль' }, { key: 'path', label: 'путь симплекс-метода' }, { key: 'dual', label: 'теневые цены: сырьё / труд / станок' }]);
    function draw() {
      const c = [s.pA, s.pB];
      const R0 = lpSolve(LPC, c);
      const V = R0.V;
      const val = (p) => c[0] * p[0] + c[1] * p[1];
      // симплекс: из (0, 0) по соседним вершинам, пока прибыль растёт (выбираем наибольший рост)
      let cur = V.findIndex((p) => Math.abs(p[0]) < 1e-9 && Math.abs(p[1]) < 1e-9);
      const path = [cur];
      for (;;) {
        const nb = [(cur + 1) % V.length, (cur + V.length - 1) % V.length];
        let nx = cur;
        for (const j of nb) if (val(V[j]) > val(V[nx]) + 1e-12) nx = j;
        if (nx === cur) break;
        cur = nx;
        path.push(cur);
      }
      const L = [{ type: 'polygon', x: V.map((p) => p[0]), y: V.map((p) => p[1]), color: 'model', stroke: 'model', width: 1.6, opacity: 0.14, label: 'допустимые планы' }];
      // линии ограничений
      const xs = [-0.5, 5];
      for (const q of LPC.slice(0, 2)) L.push({ type: 'line', x: xs, y: xs.map((x) => (q.b - q.a[0] * x) / q.a[1]), color: 'ink2', width: 1, opacity: 0.5, hover: false });
      L.push({ type: 'vline', x: 3, color: 'ink2', width: 1, opacity: 0.5 });
      // изолинии прибыли
      const best = R0.val;
      for (const fr of [0.25, 0.5, 0.75, 1]) {
        const v0 = best * fr;
        const pts = s.pB > 1e-9 ? xs.map((x) => [x, (v0 - s.pA * x) / s.pB]) : null;
        if (pts) L.push({ type: 'line', x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), color: fr === 1 ? 'tree' : 'muted', width: fr === 1 ? 2.2 : 1, dash: fr === 1 ? null : '4 4', hover: false });
      }
      const ctr = [U.mean(V.map((p) => p[0])), U.mean(V.map((p) => p[1]))];
      const cn = Math.hypot(c[0], c[1]);
      L.push({ type: 'arrows', x1: [ctr[0]], y1: [ctr[1]], x2: [ctr[0] + (0.9 * c[0]) / cn], y2: [ctr[1] + (0.9 * c[1]) / cn], color: 'violet', width: 2.2 });
      if (path.length > 1) L.push({ type: 'arrows', x1: path.slice(0, -1).map((i) => V[i][0]), y1: path.slice(0, -1).map((i) => V[i][1]), x2: path.slice(1).map((i) => V[i][0]), y2: path.slice(1).map((i) => V[i][1]), color: 'tree', width: 2.4, opacity: 0.8 });
      L.push({ type: 'points', x: V.map((p) => p[0]), y: V.map((p) => p[1]), color: (i) => (i === R0.bi ? 'tree' : 'ink2'), r: (i) => (i === R0.bi ? 7 : 4.5), tooltip: (i) => ['вершина (' + f2(V[i][0]) + ', ' + f2(V[i][1]) + ')', 'прибыль ' + f2(val(V[i]))] });
      plot.render(L);
      // теневые цены: +1 к ресурсу
      const dual = [0, 1, 2].map((k) => lpSolve(LPC.map((q, i) => (i === k ? Object.assign({}, q, { b: q.b + 1e-3 }) : q)), c).val - best).map((d) => d / 1e-3);
      const order = V.map((p, i) => i).sort((i, j) => val(V[j]) - val(V[i]));
      rowTable(tbl, ['вершина (x, y)', 'прибыль'], order.map((i) => ['(' + f2(V[i][0]) + ', ' + f2(V[i][1]) + ')' + (i === R0.bi ? ' ← оптимум' : ''), f2(val(V[i]))]), (k) => k === 0, false);
      const ties = V.filter((p) => Math.abs(val(p) - best) < 1e-9).length;
      st.set('plan', 'x = ' + f2(V[R0.bi][0]) + ', y = ' + f2(V[R0.bi][1]));
      st.set('val', f2(best));
      st.set('path', path.map((i) => '(' + f1(V[i][0]) + ', ' + f1(V[i][1]) + ')').join(' → '));
      st.set('dual', dual.map(f2).join(' / '));
      note.innerHTML = 'Линейная целевая функция растёт в направлении фиолетовой стрелки, и самая «дальняя» точка многоугольника по этому направлению — вершина (или целое ребро, если стрелка перпендикулярна ребру' + (ties > 1 ? ' — как сейчас: оптимальных вершин ' + ties : '') + '). <b>Симплекс-метод</b> идёт от вершины к соседней, пока прибыль растёт: ' + path.length + ' ' + plural(path.length, 'вершина', 'вершины', 'вершин') + ' на пути. Теневые цены (двойственные переменные) показывают, сколько добавит единица ресурса: ' + ['сырьё', 'труд', 'станок'].map((n, k) => n + ' — ' + f2(dual[k])).join(', ') + '. Ресурс с нулевой ценой лежит с избытком — его ограничение неактивно (как μ = 0 в ККТ). Линейным программированием решают матричные игры (урок 15.21), транспортные задачи и расписания.';
    }
    w.pythonAction(() => PY_NP + 'from scipy.optimize import linprog\n\nA = np.array([[1, 1], [1, 3], [1, 0]])     # сырьё, труд, станок\nb = np.array([4, 9, 3])\nc = np.array([' + py(s.pA) + ', ' + py(s.pB) + '])\nres = linprog(-c, A_ub=A, b_ub=b, bounds=[(0, None), (0, None)], method="highs")   # linprog минимизирует\nprint("план:", res.x.round(4), " прибыль:", round(-res.fun, 4))\nprint("теневые цены (сырьё, труд, станок):", (-res.ineqlin.marginals).round(4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 32. Дискретная оптимизация: рюкзак
   * ============================================================================== */
  const KN = { w: [5, 7, 4, 6, 9, 5, 1, 6, 9, 9], v: [6, 12, 7, 9, 15, 8, 2, 11, 8, 16] };
  function knap(cap) {
    const n = KN.w.length;
    // динамическое программирование по весу
    const best = Array.from({ length: n + 1 }, () => new Array(cap + 1).fill(0));
    for (let i = 1; i <= n; i++) {
      for (let c = 0; c <= cap; c++) {
        best[i][c] = best[i - 1][c];
        if (KN.w[i - 1] <= c) best[i][c] = Math.max(best[i][c], best[i - 1][c - KN.w[i - 1]] + KN.v[i - 1]);
      }
    }
    const opt = [];
    let c = cap;
    for (let i = n; i >= 1; i--) {
      if (best[i][c] !== best[i - 1][c]) {
        opt.push(i - 1);
        c -= KN.w[i - 1];
      }
    }
    const greedy = (keyFn) => {
      const idx = U.range(n).sort((a, b) => keyFn(b) - keyFn(a) || a - b);
      const take = [];
      let left = cap;
      for (const i of idx) {
        if (KN.w[i] <= left) {
          take.push(i);
          left -= KN.w[i];
        }
      }
      return take;
    };
    const ratio = greedy((i) => KN.v[i] / KN.w[i]);
    const byV = greedy((i) => KN.v[i]);
    const val = (S) => S.reduce((a, i) => a + KN.v[i], 0);
    const wt = (S) => S.reduce((a, i) => a + KN.w[i], 0);
    return { opt, ratio, byV, val, wt, dp: best[n][cap] };
  }
  GBC.widget('knapsack', (el) => {
    const s = { cap: 10 };
    const w = ui.shell(el, { title: 'Рюкзак: жадность против полного решения', sub: 'Десять предметов с весом и ценностью; вместимость рюкзака — C. Жадный выбор берёт предметы по убыванию «ценность/вес», пока помещаются. Динамическое программирование находит точный оптимум; полный перебор проверяет 2¹⁰ = 1024 наборов.' });
    ui.slider(w.controls, { label: 'Вместимость C', min: 3, max: 40, step: 1, value: s.cap, format: String, onInput: (v) => ((s.cap = v), draw()) });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const plot = new GBC.Plot(w.main, { height: 230, x: { label: 'вместимость C', domain: [1, 40] }, y: { label: 'суммарная ценность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'opt', label: 'оптимум (ДП)' }, { key: 'ratio', label: 'жадно по ценности/весу' }, { key: 'byv', label: 'жадно по ценности' }, { key: 'bf', label: 'полный перебор' }]);
    const curve = U.range(40, 1).map((c) => {
      const K = knap(c);
      return [c, K.dp, K.val(K.ratio), K.val(K.byV)];
    });
    const lose = curve.filter((q) => q[2] < q[1] - 1e-9).length;
    function brute(cap) {
      let best = 0;
      for (let m = 0; m < 1024; m++) {
        let wt = 0;
        let v = 0;
        for (let i = 0; i < 10; i++) {
          if (m & (1 << i)) {
            wt += KN.w[i];
            v += KN.v[i];
          }
        }
        if (wt <= cap && v > best) best = v;
      }
      return best;
    }
    function draw() {
      const K = knap(s.cap);
      const mark = (S, i) => (S.includes(i) ? '✓' : '');
      rowTable(tbl, ['№', 'вес', 'ценн.', 'ц/в', 'жадно ц/в', 'жадно ц', 'оптимум'], U.range(10).map((i) => [String(i + 1), String(KN.w[i]), String(KN.v[i]), f2(KN.v[i] / KN.w[i]), mark(K.ratio, i), mark(K.byV, i), mark(K.opt, i)]), (i) => K.opt.includes(i));
      plot.render([
        { type: 'line', x: curve.map((q) => q[0]), y: curve.map((q) => q[3]), color: 'violet', width: 1.6, label: 'жадно по ценности', curve: 'step' },
        { type: 'line', x: curve.map((q) => q[0]), y: curve.map((q) => q[2]), color: 'tree', width: 2, label: 'жадно по ценности/весу', curve: 'step' },
        { type: 'line', x: curve.map((q) => q[0]), y: curve.map((q) => q[1]), color: 'model', width: 2.4, label: 'оптимум', curve: 'step' },
        { type: 'vline', x: s.cap, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      const bf = brute(s.cap);
      st.set('opt', U.fmt(K.dp, 1) + ' (вес ' + K.wt(K.opt) + ')');
      st.set('ratio', U.fmt(K.val(K.ratio), 1) + ' (вес ' + K.wt(K.ratio) + ')');
      st.set('byv', U.fmt(K.val(K.byV), 1) + ' (вес ' + K.wt(K.byV) + ')');
      st.set('bf', U.fmt(bf, 1));
      const gap = K.dp - K.val(K.ratio);
      note.innerHTML = (gap > 1e-9
        ? 'При C = ' + s.cap + ' жадность проигрывает: она хватает самый «выгодный» предмет, а оставшееся место потом не заполнить — потеря ' + U.fmt(gap, 1) + '. '
        : 'При C = ' + s.cap + ' жадный выбор совпал с оптимумом. ') + 'Из 40 вместимостей жадность по ценности/весу ошибается в ' + lose + '. Динамическое программирование решает задачу точно за O(n·C): лучший набор для вместимости c из первых i предметов выражается через ответы для меньших задач. Полный перебор — 2ⁿ наборов: при n = 10 это 1024, при n = 60 — больше 10¹⁸. Дерево решений строится так же, как жадный рюкзак: лучшее разбиение сейчас, без оглядки на будущее. Найти оптимальное дерево — NP-трудная задача; урок 2 показывал, что для маленького примера жадное дерево глубины 2 оказалось оптимальным, но так бывает не всегда.';
    }
    w.pythonAction(() => PY_NP + 'from itertools import combinations\n\nw = ' + JSON.stringify(KN.w) + '\nv = ' + JSON.stringify(KN.v) + '\nC = ' + s.cap + '\n# динамическое программирование\nbest = [0.0] * (C + 1)\nfor wi, vi in zip(w, v):\n    for c in range(C, wi - 1, -1):\n        best[c] = max(best[c], best[c - wi] + vi)\nprint("оптимум (ДП):", best[C])\n# полный перебор\nbf = max(sum(v[i] for i in S) for r in range(11) for S in combinations(range(10), r) if sum(w[i] for i in S) <= C)\nprint("полный перебор:", bf)\n# жадно по ценности/весу\nleft, val = C, 0\nfor i in sorted(range(10), key=lambda i: (-v[i] / w[i], i)):\n    if w[i] <= left:\n        left -= w[i]; val += v[i]\nprint("жадно:", val)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 33. Шаг бустинга: градиент, поиск вдоль прямой, листья, Ньютон
   * ============================================================================== */
  const BST = (() => {
    const n = 40;
    const r = new GBC.RNG(11);
    const x = U.range(n).map((i) => (i + 0.5) / n);
    const y = x.map((t) => (r.random() < 1 / (1 + Math.exp(-1.5 * Math.sin(2 * Math.PI * t))) ? 1 : 0));
    const pbar = U.mean(y);
    const F0 = Math.log(pbar / (1 - pbar));
    const p0 = 1 / (1 + Math.exp(-F0));
    const res = y.map((v) => v - p0);
    // лучший пень по сумме квадратов остатков
    let best = null;
    for (let k = 1; k < n; k++) {
      const thr = (x[k - 1] + x[k]) / 2;
      const L = res.slice(0, k);
      const R = res.slice(k);
      const mL = U.mean(L);
      const mR = U.mean(R);
      const sse = L.reduce((a, v) => a + (v - mL) ** 2, 0) + R.reduce((a, v) => a + (v - mR) ** 2, 0);
      if (!best || sse < best.sse - 1e-12) best = { k, thr, mL, mR, sse };
    }
    const leaf = x.map((t) => (t <= best.thr ? 0 : 1));
    const h = leaf.map((j) => (j ? best.mR : best.mL));
    const loss = (F) => U.mean(F.map((f, i) => (y[i] ? Math.log1p(Math.exp(-f)) : Math.log1p(Math.exp(f)))));
    return { n, x, y, F0, p0, res, stump: best, leaf, h, loss };
  })();
  function boostVariants() {
    const { y, F0, p0, h, leaf, loss, n } = BST;
    const phi = (rho) => loss(h.map((v) => F0 + rho * v));
    // поиск вдоль прямой: золотое сечение на [0, 20]
    const G = L0.goldenRun(phi, 0, 20, 80);
    const rho = (G.states[G.states.length - 1].a + G.states[G.states.length - 1].b) / 2;
    const gam = [0, 1].map((j) => {
      const idx = U.range(n).filter((i) => leaf[i] === j);
      const pj = U.mean(idx.map((i) => y[i]));
      const exact = Math.log(pj / (1 - pj)) - F0;
      const newton = U.sum(idx.map((i) => y[i] - p0)) / (idx.length * p0 * (1 - p0));
      return { exact, newton, pj, size: idx.length };
    });
    return {
      phi, rho,
      grad: { name: 'градиентный шаг h(x)', leaves: [BST.stump.mL, BST.stump.mR] },
      line: { name: 'шаг ρ·h(x), ρ — поиск вдоль прямой', leaves: [rho * BST.stump.mL, rho * BST.stump.mR] },
      newton: { name: 'Ньютон в каждом листе', leaves: [gam[0].newton, gam[1].newton] },
      leaf: { name: 'точный минимум в каждом листе', leaves: [gam[0].exact, gam[1].exact] },
      gam,
    };
  }
  GBC.widget('boost-step', (el) => {
    const s = { v: 'newton', nu: 1 };
    const w = ui.shell(el, { title: 'Один шаг бустинга: куда и насколько', sub: '40 объектов, классификация с log-loss. Старт F₀ = логарифм шансов доли класса 1. Дерево-пень уже построено по псевдоостаткам y − p (направление). Осталось выбрать, насколько сдвинуть прогноз в каждом листе — четыре способа.' });
    ui.select(w.controls, { label: 'Как выбрать значения листьев', value: s.v, options: [{ value: 'grad', label: 'градиент: среднее остатков' }, { value: 'line', label: 'ρ·h: поиск вдоль прямой' }, { value: 'newton', label: 'шаг Ньютона в листе' }, { value: 'leaf', label: 'точный минимум в листе' }], onChange: (v) => ((s.v = v), draw()) });
    ui.slider(w.controls, { label: 'Темп ν', values: [0.1, 0.3, 1], value: s.nu, format: String, onInput: (v) => ((s.nu = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x', domain: [0, 1] }, y: { label: 'класс / вероятность', domain: [-0.08, 1.08] } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'множитель ρ при дереве h', domain: [0, 12] }, y: { label: 'средняя log-loss' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L0', label: 'потери F₀' }, { key: 'L', label: 'потери после шага' }, { key: 'leaves', label: 'значения листьев (×ν)' }, { key: 'rho', label: 'ρ* вдоль прямой' }]);
    const V = boostVariants();
    function draw() {
      const { x, y, F0, leaf, loss, stump } = BST;
      const lossOf = (key, nu) => loss(leaf.map((j) => F0 + nu * V[key].leaves[j]));
      const cur = V[s.v];
      const F = leaf.map((j) => F0 + s.nu * cur.leaves[j]);
      const sig = (z) => 1 / (1 + Math.exp(-z));
      p1.render([
        { type: 'points', x, y: y.map((v, i) => v + (i % 2 ? 0.025 : -0.025)), color: (i) => (y[i] ? 'class1' : 'class0'), r: 4 },
        { type: 'hline', y: sig(F0), color: 'muted', dash: '5 4', width: 1.4, label: 'p₀ = σ(F₀)' },
        { type: 'line', x: [0, stump.thr, stump.thr, 1], y: [sig(F0 + s.nu * cur.leaves[0]), sig(F0 + s.nu * cur.leaves[0]), sig(F0 + s.nu * cur.leaves[1]), sig(F0 + s.nu * cur.leaves[1])], color: 'model', width: 2.6, label: 'p после шага', hover: false },
        { type: 'vline', x: stump.thr, color: 'tree', dash: '3 3', width: 1.2, text: 'порог пня' },
      ]);
      const rs = U.linspace(0, 12, 241);
      p2.render([
        { type: 'line', x: rs, y: rs.map(V.phi), color: 'model', width: 2.4, label: 'φ(ρ) = L(F₀ + ρh)' },
        { type: 'points', x: [1, V.rho], y: [V.phi(1), V.phi(V.rho)], color: (i) => (i ? 'tree' : 'ink2'), r: 6, tooltip: (i) => [i ? 'ρ* = ' + f3(V.rho) : 'ρ = 1 (градиент)', 'потери ' + f4(V.phi(i ? V.rho : 1))] },
        { type: 'hline', y: lossOf('leaf', 1), color: 'violet', dash: '4 4', width: 1.2, text: 'точный минимум в листьях' },
      ]);
      const rows = ['grad', 'line', 'newton', 'leaf'].map((k) => [V[k].name, f3(V[k].leaves[0]) + ' / ' + f3(V[k].leaves[1]), f4(lossOf(k, 1)), f4(lossOf(k, 0.1))]);
      rowTable(tbl, ['способ', 'листья (лев. / прав.)', 'потери при ν = 1', 'при ν = 0.1'], rows, (i) => ['grad', 'line', 'newton', 'leaf'][i] === s.v, false);
      st.set('L0', f4(loss(BST.x.map(() => F0))));
      st.set('L', f4(lossOf(s.v, s.nu)));
      st.set('leaves', f3(s.nu * cur.leaves[0]) + ' / ' + f3(s.nu * cur.leaves[1]));
      st.set('rho', f3(V.rho));
      const L = (k) => f4(lossOf(k, 1));
      const rr = Math.round(V.rho);
      note.innerHTML = 'Градиент по прогнозам — это −(y − p), а значения листьев пня — средние остатки (' + f3(stump.mL) + ' и ' + f3(stump.mR) + '): по шкале логитов это робкий шаг, потери ' + L('grad') + '. Поиск вдоль прямой (шаг 18) находит ρ* = ' + f3(V.rho) + ': дерево правильное по направлению, но примерно в ' + rr + ' ' + plural(rr, 'раз', 'раза', 'раз') + ' «короче», чем нужно; потери ' + L('line') + '. Фридман пошёл дальше (TreeBoost): листья не пересекаются, поэтому задачу можно решить в каждом листе отдельно — одномерная выпуклая минимизация. Её точный ответ — логит доли класса 1 в листе минус F₀ (' + f3(V.gam[0].exact) + ' и ' + f3(V.gam[1].exact) + '), потери ' + L('leaf') + ' — лучше всех. Одна итерация Ньютона −G/H (урок 15.7, шаг 26) даёт ' + f3(V.gam[0].newton) + ' и ' + f3(V.gam[1].newton) + ' — недолёт, потери ' + L('newton') + ': здесь даже чуть хуже общего ρ*, зато формула простая, не требует итераций и всегда конечна (в «чистом» листе точный минимум уходит в бесконечность, как в шаге 2). Так считают листья scikit-learn и, с λ в знаменателе, XGBoost. В бустинге шаг всё равно умножают на ν &lt; 1: при ν = 0.1 различия способов почти исчезают, а маленькие шаги регуляризуют (шаги 34–35).';
    }
    w.pythonAction(() => PY_NP + PY_RNG + 'from sklearn.ensemble import GradientBoostingClassifier\n\nr = Mulberry32(11)\nn = 40\nx = (np.arange(n) + 0.5) / n\ny = np.array([int(r.random() < 1 / (1 + np.exp(-1.5 * np.sin(2 * np.pi * t)))) for t in x])\nF0 = np.log(y.mean() / (1 - y.mean())); p0 = 1 / (1 + np.exp(-F0))\nloss = lambda F: np.mean(np.logaddexp(0, -F) * y + np.logaddexp(0, F) * (1 - y))\n\n# пень по остаткам y − p0 (порог — середина между соседними x)\nres = y - p0\nk = min(range(1, n), key=lambda k: ((res[:k] - res[:k].mean())**2).sum() + ((res[k:] - res[k:].mean())**2).sum())\nthr = (x[k - 1] + x[k]) / 2\nleaf = (x > thr).astype(int)\nnewton = [res[leaf == j].sum() / ((leaf == j).sum() * p0 * (1 - p0)) for j in (0, 1)]\nexact = [np.log(y[leaf == j].mean() / (1 - y[leaf == j].mean())) - F0 for j in (0, 1)]\nprint("порог", round(thr, 4), " Ньютон:", np.round(newton, 4), " точно:", np.round(exact, 4))\nprint("потери: F0", round(loss(np.full(n, F0)), 4), " Ньютон", round(loss(F0 + np.array(newton)[leaf]), 4))\n\n# scikit-learn строит лист шагом Ньютона\ngb = GradientBoostingClassifier(n_estimators=1, learning_rate=1.0, max_depth=1).fit(x[:, None], y)\nprint("sklearn F(x) в листьях:", np.unique(gb.decision_function(x[:, None]).round(4)), " наше:", np.round(F0 + np.array(newton), 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 34. Поэтапный бустинг и путь Lasso
   * ============================================================================== */
  const SW = (() => {
    const n = 60;
    const p = 5;
    const r = new GBC.RNG(21);
    const Z = U.range(n).map(() => U.range(p).map(() => r.normal()));
    const X = Z.map((z) => [z[0], 0.6 * z[0] + 0.8 * z[1], z[2], 0.5 * z[2] + 0.5 * z[3] + 0.7 * z[1], z[4]]);
    // центрируем и нормируем столбцы: среднее 0, Σx² = n
    for (let j = 0; j < p; j++) {
      const m = U.mean(X.map((row) => row[j]));
      X.forEach((row) => (row[j] -= m));
      const sd = Math.sqrt(U.mean(X.map((row) => row[j] ** 2)));
      X.forEach((row) => (row[j] /= sd));
    }
    let y = X.map((row) => 3 * row[0] - 2 * row[2] + 1.5 * row[4] + 0.5 * row[1] + r.normal(0, 1.5));
    const ym = U.mean(y);
    y = y.map((v) => v - ym);
    return { n, p, X, y };
  })();
  function stagewise(eps, maxSteps = 6000) {
    const { n, p, X, y } = SW;
    const wv = new Array(p).fill(0);
    const r = y.slice();
    const path = [[0, wv.slice()]];
    for (let t = 0; t < maxSteps; t++) {
      const c = U.range(p).map((j) => X.reduce((a, row, i) => a + row[j] * r[i], 0) / n);
      let j = 0;
      for (let k = 1; k < p; k++) if (Math.abs(c[k]) > Math.abs(c[j])) j = k;
      if (Math.abs(c[j]) < eps / 2) break;
      const d = eps * Math.sign(c[j]);
      wv[j] += d;
      for (let i = 0; i < n; i++) r[i] -= d * X[i][j];
      path.push([wv.reduce((a, v) => a + Math.abs(v), 0), wv.slice()]);
    }
    return path;
  }
  /** Путь Lasso покоординатным спуском (цель sklearn: 1/(2n)·‖y − Xw‖² + α‖w‖₁). */
  const LASSO = (() => {
    const { n, p, X, y } = SW;
    const amax = Math.max(...U.range(p).map((j) => Math.abs(X.reduce((a, row, i) => a + row[j] * y[i], 0) / n)));
    const alphas = U.range(120).map((k) => amax * Math.pow(10, (-3 * k) / 119));
    const wv = new Array(p).fill(0);
    const r = y.slice();
    const out = [];
    for (const a of alphas) {
      for (let sweep = 0; sweep < 2000; sweep++) {
        let dmax = 0;
        for (let j = 0; j < p; j++) {
          let rho = 0;
          for (let i = 0; i < n; i++) rho += X[i][j] * (r[i] + X[i][j] * wv[j]);
          rho /= n;
          const nw = soft(rho, a);
          const d = nw - wv[j];
          if (d !== 0) {
            for (let i = 0; i < n; i++) r[i] -= d * X[i][j];
            wv[j] = nw;
          }
          dmax = Math.max(dmax, Math.abs(d));
        }
        if (dmax < 1e-10) break;
      }
      out.push([wv.reduce((a2, v) => a2 + Math.abs(v), 0), wv.slice(), a]);
    }
    return out;
  })();
  GBC.widget('stagewise-lasso', (el) => {
    const s = { eps: 0.01 };
    const w = ui.shell(el, { title: 'Бустинг крошечными шагами ≈ Lasso', sub: 'Линейная регрессия с 5 признаками (часть из них коррелирует). Поэтапный (forward stagewise) бустинг: на каждом шаге выбираем признак, сильнее всего связанный с остатками, и сдвигаем его вес на ±ε. Сплошные линии — его путь, пунктир — путь Lasso при уменьшении λ.' });
    ui.slider(w.controls, { label: 'Шаг ε', values: [0.005, 0.01, 0.05, 0.2, 0.5], value: s.eps, format: String, onInput: (v) => ((s.eps = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'сумма модулей весов ‖w‖₁' }, y: { label: 'вес признака' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'steps', label: 'шагов бустинга' }, { key: 'diff', label: 'макс. расхождение с Lasso' }, { key: 'end', label: 'веса в конце' }]);
    const COLS = ['blue', 'orange', 'aqua', 'violet', 'magenta'];
    function draw() {
      const P = stagewise(s.eps);
      const L = [];
      for (let j = 0; j < SW.p; j++) {
        L.push({ type: 'line', x: LASSO.map((q) => q[0]), y: LASSO.map((q) => q[1][j]), color: COLS[j], width: 1.6, dash: '5 4', hover: false });
        L.push({ type: 'line', x: P.map((q) => q[0]), y: P.map((q) => q[1][j]), color: COLS[j], width: 2.2, label: 'w' + (j + 1), curve: s.eps >= 0.2 ? 'step' : null });
      }
      plot.render(L);
      // расхождение: для каждой точки пути бустинга — Lasso с той же ‖w‖₁ (линейная интерполяция)
      let dmax = 0;
      for (const [nb, wb] of P) {
        let k = LASSO.findIndex((q) => q[0] >= nb);
        if (k <= 0) continue;
        const a = LASSO[k - 1];
        const b = LASSO[k];
        const t = (nb - a[0]) / Math.max(1e-12, b[0] - a[0]);
        for (let j = 0; j < SW.p; j++) dmax = Math.max(dmax, Math.abs(wb[j] - (a[1][j] + t * (b[1][j] - a[1][j]))));
      }
      const last = P[P.length - 1][1];
      st.set('steps', String(P.length - 1));
      st.set('diff', f3(dmax));
      st.set('end', last.map(f2).join(', '));
      note.innerHTML = 'Каждый шаг — это бустинг с «признаками вместо деревьев» и крошечным темпом: выбор лучшей координаты (жадный покоординатный спуск, шаг 19) и сдвиг на ε. При малом ε путь весов почти совпадает с путём Lasso (максимальное расхождение ' + f3(dmax) + ' — пунктир почти целиком спрятан под сплошными линиями; увеличьте ε, чтобы их различить): признаки входят в модель по одному, в том же порядке, а веса растут плавно. Чем крупнее ε, тем «ступенчатее» путь и тем дальше он от Lasso. Это объясняет, почему маленький темп ν в градиентном бустинге работает как регуляризация: ранняя остановка поэтапного процесса похожа на L1-штраф (Hastie, Tibshirani, Friedman, «Elements of Statistical Learning», §16.2).';
    }
    w.pythonAction(() => PY_NP + PY_RNG + 'from sklearn.linear_model import lasso_path\n\nr = Mulberry32(21)\nn, p = 60, 5\nZ = np.array([[r.normal() for _ in range(p)] for _ in range(n)])\nX = np.column_stack([Z[:, 0], 0.6 * Z[:, 0] + 0.8 * Z[:, 1], Z[:, 2], 0.5 * Z[:, 2] + 0.5 * Z[:, 3] + 0.7 * Z[:, 1], Z[:, 4]])\nX = (X - X.mean(0)) / X.std(0)\ny = np.array([3 * a - 2 * c + 1.5 * e + 0.5 * b + r.normal(0, 1.5) for a, b, c, d, e in X])\ny = y - y.mean()\n\neps = ' + py(s.eps) + '\nw, res, steps = np.zeros(p), y.copy(), 0\nwhile True:\n    c = X.T @ res / n\n    j = np.argmax(np.abs(c))\n    if abs(c[j]) < eps / 2 or steps >= 6000:\n        break\n    w[j] += eps * np.sign(c[j]); res -= eps * np.sign(c[j]) * X[:, j]; steps += 1\nprint("поэтапный бустинг:", steps, "шагов, веса", w.round(3))\nalphas, coefs, _ = lasso_path(X, y, n_alphas=120, eps=1e-3)\nprint("Lasso при самом малом α:", coefs[:, -1].round(3))\nprint("МНК:", np.linalg.lstsq(X, y, rcond=None)[0].round(3))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 35. Ранняя остановка ≈ гребневая регрессия
   * ============================================================================== */
  const ES = (() => {
    const n = 30;
    const r = new GBC.RNG(8);
    const X = U.range(n).map(() => {
      const a = r.normal();
      return [a, 0.85 * a + 0.53 * r.normal()];
    });
    const y = X.map((row) => 1.5 * row[0] + 0.5 * row[1] + r.normal(0, 0.8));
    const A = [[0, 0], [0, 0]];
    const c = [0, 0];
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < 2; a++) {
        c[a] += (X[i][a] * y[i]) / n;
        for (let b = 0; b < 2; b++) A[a][b] += (X[i][a] * X[i][b]) / n;
      }
    }
    const tr = A[0][0] + A[1][1];
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    const Lmax = tr / 2 + Math.sqrt((tr * tr) / 4 - det);
    const Lmin = tr / 2 - Math.sqrt((tr * tr) / 4 - det);
    const ridge = (lam) => {
      const M = [[A[0][0] + lam, A[0][1]], [A[1][0], A[1][1] + lam]];
      const d = M[0][0] * M[1][1] - M[0][1] * M[1][0];
      return [(M[1][1] * c[0] - M[0][1] * c[1]) / d, (-M[1][0] * c[0] + M[0][0] * c[1]) / d];
    };
    const loss = (w0, w1) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += (y[i] - w0 * X[i][0] - w1 * X[i][1]) ** 2;
      return s / (2 * n);
    };
    return { n, X, y, A, c, Lmax, Lmin, ridge, loss, ols: ridge(0) };
  })();
  GBC.widget('early-stop-ridge', (el) => {
    const s = { k: 20 };
    const w = ui.shell(el, { title: 'Ранняя остановка ≈ гребневая регрессия', sub: 'Градиентный спуск по МНК стартует из нуля (синий путь). Гребневая регрессия при убывающем λ даёт путь решений (оранжевый пунктир). Остановить спуск на шаге k — почти то же, что взять гребневое решение с λ ≈ 1/(η·k).' });
    ui.slider(w.controls, { label: 'Шаг остановки k', values: [1, 2, 3, 5, 10, 20, 50, 100, 200, 500], value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const box = H('div', { style: 'max-width:500px;margin:0 auto' });
    w.main.appendChild(box);
    const ext = [Math.min(0, ES.ols[0]) - 0.4, Math.max(0, ES.ols[0]) + 0.6, Math.min(0, ES.ols[1]) - 0.6, Math.max(0, ES.ols[1]) + 0.6];
    const plot = new GBC.Plot(box, { height: 340, equal: true, x: { label: 'w₁', domain: [ext[0], ext[1]] }, y: { label: 'w₂', domain: [ext[2], ext[3]] }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'gd', label: 'спуск, шаг k' }, { key: 'ridge', label: 'гребневая, λ = 1/(ηk)' }, { key: 'dist', label: 'расстояние' }, { key: 'lam', label: 'λ' }]);
    const eta = 1 / ES.Lmax;
    const gdPath = (() => {
      let wv = [0, 0];
      const out = [wv.slice()];
      for (let k = 1; k <= 2000; k++) {
        const g = [ES.A[0][0] * wv[0] + ES.A[0][1] * wv[1] - ES.c[0], ES.A[1][0] * wv[0] + ES.A[1][1] * wv[1] - ES.c[1]];
        wv = [wv[0] - eta * g[0], wv[1] - eta * g[1]];
        out.push(wv.slice());
      }
      return out;
    })();
    const ridgePath = U.range(200).map((i) => ES.ridge(Math.pow(10, 3 - (7 * i) / 199)));
    function draw() {
      const k = s.k;
      const lam = 1 / (eta * k);
      const g = gdPath[k];
      const rr = ES.ridge(lam);
      plot.render([
        ...mapLayers(ES.loss, ext, [0.4, 0.6, 1, 1.6, 2.5].map((v) => v * ES.loss(0, 0) / 2.5)),
        { type: 'line', x: ridgePath.map((q) => q[0]), y: ridgePath.map((q) => q[1]), color: 'tree', width: 2, dash: '6 4', label: 'гребневая: λ от 1000 до 10⁻⁴', hover: false },
        { type: 'line', x: gdPath.slice(0, 600).map((q) => q[0]), y: gdPath.slice(0, 600).map((q) => q[1]), color: 'model', width: 2, label: 'градиентный спуск из нуля', hover: false },
        { type: 'points', x: [g[0]], y: [g[1]], color: 'model', r: 7 },
        { type: 'points', x: [rr[0]], y: [rr[1]], color: 'tree', r: 6, hollow: true },
        { type: 'points', x: [ES.ols[0]], y: [ES.ols[1]], color: 'ink', r: 5, label: 'МНК (λ = 0, k = ∞)' },
        { type: 'points', x: [0], y: [0], color: 'ink2', r: 4 },
      ]);
      st.set('gd', '(' + f3(g[0]) + ', ' + f3(g[1]) + ')');
      st.set('ridge', '(' + f3(rr[0]) + ', ' + f3(rr[1]) + ')');
      st.set('dist', f3(Math.hypot(g[0] - rr[0], g[1] - rr[1])));
      st.set('lam', sci(lam));
      note.innerHTML = 'Признаки сильно коррелируют: собственные числа XᵀX/n равны ' + f3(ES.Lmax) + ' и ' + f3(ES.Lmin) + '. Спуск сначала быстро проходит «крутое» направление (вклад общего сигнала обоих признаков), а «пологое» (разницу между ними) — медленно, за ~1/(η·λ_min) шагов. Гребневая регрессия с параметром λ подавляет направления с собственными числами меньше λ — почти так же, как спуск, не успевший их пройти: вклад направления с числом σ у спуска равен 1 − (1 − ησ)ᵏ, у гребневой — σ/(σ + λ). Поэтому число итераций — это регуляризация: меньше шагов ≈ больше λ. В бустинге число деревьев M и темп ν играют ту же роль (урок 15.10, шаг 27), а ранняя остановка по валидации выбирает «λ» автоматически.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nr = Mulberry32(8)\nn = 30\nX = []\nfor _ in range(n):\n    a = r.normal(); X.append([a, 0.85 * a + 0.53 * r.normal()])\nX = np.array(X)\ny = np.array([1.5 * a + 0.5 * b + r.normal(0, 0.8) for a, b in X])\nA, c = X.T @ X / n, X.T @ y / n\neta = 1 / np.linalg.eigvalsh(A).max()\nw = np.zeros(2)\nfor k in range(1, ' + (s.k + 1) + '):\n    w -= eta * (A @ w - c)\nlam = 1 / (eta * ' + s.k + ')\nridge = np.linalg.solve(A + lam * np.eye(2), c)\nprint("спуск, k = ' + s.k + ':", w.round(3), "  гребневая, λ =", round(lam, 4), ":", ridge.round(3))\nprint("собственные числа XᵀX/n:", np.linalg.eigvalsh(A).round(3))\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр
   * ============================================================================== */
  const OQ = [
    { q: 'Что нужно задать, чтобы поставить задачу оптимизации?', opts: ['только данные', 'целевую функцию, переменные и допустимое множество', 'только темп обучения', 'число деревьев'], a: 1, why: 'Что минимизируем, по чему и при каких ограничениях (шаг 1).' },
    { q: 'Логистическая регрессия без штрафа на линейно разделимых данных…', opts: ['имеет единственный минимум', 'не имеет минимума: веса растут бесконечно', 'всегда даёт нулевые веса', 'сходится за один шаг'], a: 1, why: 'Потери убывают к 0, не достигая его (шаг 2).' },
    { q: 'Почему для выпуклой задачи локальный минимум — глобальный?', opts: ['так принято', 'хорда над графиком: любая точка «лучше» локального минимума дала бы точки ниже него рядом с ним', 'у выпуклых функций нет минимумов', 'из-за градиента'], a: 1, why: 'Шаг 4 и урок 15.7.' },
    { q: 'Минимум функции на отрезке [a, b] оказался в точке a. Что верно?', opts: ['обязательно f′(a) = 0', 'f′(a) ≥ 0 — функция растёт внутрь отрезка', 'f′(a) ≤ 0', 'f не дифференцируема'], a: 1, why: 'На границе производная не обязана обнуляться (шаг 5).' },
    { q: 'Сколько случайных точек нужно, чтобы с вероятностью 95 % попасть в лучшие 5 % пространства из 10 гиперпараметров?', opts: ['10¹⁰', '59 — от размерности не зависит', '100 · 10', '5'], a: 1, why: '1 − 0.95ⁿ ≥ 0.95 ⇒ n ≥ 59 (шаг 7).' },
    { q: 'Чем золотое сечение лучше троичного поиска?', opts: ['не требует одной ямы', 'одно новое вычисление f на шаг вместо двух', 'работает с производной', 'находит глобальный минимум'], a: 1, why: 'Одна из старых точек снова на «золотом» месте (шаг 8).' },
    { q: 'Параболическая интерполяция может сойтись…', opts: ['только к минимуму', 'к максимуму, если парабола смотрит ветвями вниз', 'только к нулю', 'никогда'], a: 1, why: 'Поэтому метод Брента страхует её золотым сечением (шаг 9).' },
    { q: 'Зачем имитация отжига принимает шаги вверх?', opts: ['по ошибке', 'чтобы выбираться из локальных ям, пока температура высока', 'чтобы ускорить сходимость в выпуклой задаче', 'для экономии памяти'], a: 1, why: 'Вероятность e^(−Δ/T) падает с остыванием (шаг 12).' },
    { q: 'Что выбирает следующую точку в байесовской оптимизации?', opts: ['случайность', 'максимум ожидаемого улучшения по суррогатной модели', 'градиент', 'сетка'], a: 1, why: 'EI балансирует разведку и использование (шаг 13).' },
    { q: 'Для f = 2x² при каком темпе спуск разлетается?', opts: ['η > 0.05', 'η > 0.5 = 2/L', 'η > 0.25', 'никогда'], a: 1, why: 'Множитель 1 − 4η по модулю больше 1 (шаг 15).' },
    { q: 'Почему наискорейший спуск идёт зигзагом?', opts: ['из-за шума', 'в точке точного минимума на луче новый градиент перпендикулярен старому направлению', 'из-за моментума', 'так задумано'], a: 1, why: 'φ′(t*) = 0 ⇔ ∇f(новой точки) ⊥ d (шаг 17).' },
    { q: 'Почему проксимальный метод (ISTA) даёт ровные нули, а субградиентный — нет?', opts: ['ISTA быстрее', 'мягкий порог точно решает задачу с |w|', 'субградиент не применим', 'из-за округления'], a: 1, why: 'S(z) = sign(z)·max(|z| − τ, 0) (шаг 20).' },
    { q: 'Во сколько раз меньше шагов нужно моментуму с хорошим β при κ = 100?', opts: ['одинаково', 'примерно в √κ = 10 раз', 'в 100 раз', 'в 2 раза'], a: 1, why: 'Шагов ∝ √κ вместо κ (шаг 21).' },
    { q: 'Когда Adam почти не выигрывает у обычного спуска на вытянутой чаше?', opts: ['никогда', 'когда оси чаши повёрнуты относительно координат', 'когда κ = 1000', 'при маленьком lr'], a: 1, why: 'Adam — диагональное предобусловливание (шаг 22).' },
    { q: 'BFGS отличается от метода Ньютона тем, что…', opts: ['не использует градиент', 'строит приближение обратного гессиана по изменениям градиента', 'всегда медленнее спуска', 'работает только в 2D'], a: 1, why: 'Секущее условие H·y = s (шаг 24).' },
    { q: 'SGD с постоянным темпом η…', opts: ['сходится точно', 'колеблется вокруг минимума с превышением потерь ∝ η/B', 'расходится', 'не зависит от B'], a: 1, why: 'Пол шума (шаг 26).' },
    { q: 'Что означает множитель ККТ μ = 0 у ограничения?', opts: ['ограничение нарушено', 'ограничение неактивно — его ослабление не улучшит оптимум', 'задача невыпукла', 'решения нет'], a: 1, why: 'Дополняющая нежёсткость; μ — теневая цена (шаг 28).' },
    { q: 'Где оптимум задачи линейного программирования?', opts: ['в центре многоугольника', 'в вершине (или на ребре) допустимого многоугольника', 'всегда в нуле', 'где угодно'], a: 1, why: 'Линейная функция максимальна на «краю» (шаг 31).' },
    { q: 'Как scikit-learn выбирает значение листа в бустинге с log-loss?', opts: ['среднее остатков', 'шаг Ньютона: Σ(y − p) / Σp(1 − p)', 'медиана', 'случайно'], a: 1, why: 'Шаг 33; XGBoost добавляет λ в знаменатель.' },
    { q: 'Почему маленький темп ν в бустинге регуляризует?', opts: ['деревья мельче', 'поэтапный путь с малыми шагами похож на путь Lasso, а ранняя остановка — на штраф', 'ν уменьшает данные', 'не регуляризует'], a: 1, why: 'Шаги 34–35.' },
  ];
  GBC.widget('optim-game', (el) => {
    const s = { i: 0, right: 0, streak: 0, picked: null, round: 1 };
    const w = ui.shell(el, { title: 'Тренажёр: оптимизация', sub: 'Двадцать вопросов о методах оптимизации и о том, где они живут в бустинге.' });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.05rem;padding:6px 0 12px' });
    w.main.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:8px' });
    w.main.appendChild(optsBox);
    const next = ui.button(w.controls, { label: 'Следующий', icon: 'step', onClick: () => ((s.i = (s.i + 1) % OQ.length), s.round++, (s.picked = null), draw()) });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function draw() {
      const Q0 = OQ[s.i];
      // варианты в перемешанном (но воспроизводимом) порядке
      const perm = new GBC.RNG(100 + s.i).permutation(Q0.opts.length);
      const Q = { q: Q0.q, why: Q0.why, opts: perm.map((k) => Q0.opts[k]), a: perm.indexOf(Q0.a) };
      qEl.textContent = Q.q;
      optsBox.textContent = '';
      Q.opts.forEach((o, k) => {
        const b = ui.button(optsBox, { label: o, kind: s.picked === null || k === Q.a ? 'primary' : '', onClick: () => {
          if (s.picked !== null) return;
          s.picked = k;
          if (k === Q.a) (s.right++, s.streak++);
          else s.streak = 0;
          draw();
        } });
        b.style.whiteSpace = 'normal';
        b.style.textAlign = 'left';
        b.style.height = 'auto';
        if (s.picked !== null) b.disabled = true;
      });
      st.set('r', String(s.round));
      st.set('ok', s.right + ' из ' + (s.round - (s.picked === null ? 1 : 0)));
      st.set('s', String(s.streak));
      note.innerHTML = s.picked === null ? 'Подумайте, какую информацию о функции использует метод и что он гарантирует.' : (s.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет</b>, ответ: ' + Q.opts[Q.a] + '. ') + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), s.picked === null ? 'Пропустить' : 'Следующий');
    }
    draw();
  });
})();
