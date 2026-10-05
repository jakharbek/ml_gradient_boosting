/* Урок 15.11: дифференциальные уравнения. Часть 1 — уравнение как закон изменения и точные решения.
 * Виджеты: остывающий чай (три способа увидеть решение), проверка решения подстановкой, y′ = f(t) как интеграл,
 * приток и отток (y′ = a − b·y), поле направлений с изоклинами, фазовая прямая и устойчивость равновесий,
 * экспонента (удвоение и полураспад), решатель по шагам (разделение переменных, линейные уравнения),
 * охлаждение при колеблющейся температуре, существование и единственность, итерации Пикара,
 * логистическое уравнение, вылов и бифуркация.
 * Общие помощники (форматирование, карточки, решатели ОДУ, поле наклонов) выставлены в GBC.lesson1511 —
 * ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const R = String.raw;
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const f4 = (v) => U.fmt(v, 4);
  const f6 = (v) => U.fmt(v, 6);
  const py = (v) => U.pyNum(v);
  /** Короткая запись маленьких и больших величин: 3.6e−5 вместо «0». */
  const sci = (v) => (!Number.isFinite(v) ? (Number.isNaN(v) ? '—' : v > 0 ? '∞' : '−∞') : v === 0 ? '0' : Math.abs(v) >= 0.01 && Math.abs(v) < 1e5 ? U.fmt(v, 4) : v.toExponential(2).replace(/-/g, '−').replace('e+', 'e'));
  const SUPD = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (k) => String(k).split('').map((c) => SUPD[c] || c).join('');
  /** Подписи логарифмической оси: 10⁻⁶ вместо 1e-6. */
  function powFmt(v) {
    const e = Math.round(Math.log10(v));
    if (Math.abs(v - Math.pow(10, e)) > 1e-9 * v) return U.fmt(v, 2);
    if (e >= -2 && e <= 3) return String(Number(v.toPrecision(3)));
    return '10' + sup(e);
  }
  const decades = (a, b, step = 1) => {
    const out = [];
    for (let e = a; e <= b; e += step) out.push(Math.pow(10, e));
    return out;
  };
  /** Деления логарифмической оси по диапазону значений (не больше ~7 делений). */
  function logAxis(lo, hi) {
    let a = Math.floor(Math.log10(Math.max(lo, 1e-300)));
    let b = Math.ceil(Math.log10(Math.max(hi, 1e-300)));
    if (b <= a) b = a + 1;
    const step = Math.max(1, Math.ceil((b - a) / 6));
    a = Math.floor(a / step) * step;
    b = a + Math.ceil((b - a) / step) * step;
    return { domain: [Math.pow(10, a), Math.pow(10, b)], ticks: decades(a, b, step) };
  }
  /** Диапазон оси по значениям с полями; почти постоянные значения не ломают деления оси. */
  function yDom(vals, pad = 0.08, inc = []) {
    const v = vals.concat(inc).filter(Number.isFinite);
    if (!v.length) return [-1, 1];
    const [lo, hi] = U.extent(v);
    const span = hi - lo;
    if (span < 1e-9 * Math.max(1, Math.abs(hi))) {
      const m = (lo + hi) / 2;
      const d = Math.max(0.5, Math.abs(m) * 0.1);
      return [m - d, m + d];
    }
    return [lo - pad * span, hi + Math.max(pad, 0.14) * span];
  }
  const clampArr = (a, lo, hi) => a.map((v) => (Number.isFinite(v) && v >= lo && v <= hi ? v : NaN));

  /* ==============================================================================
   * Карточки, формулы, таблицы
   * ============================================================================== */
  function texInto(el, src, display = false) {
    el._tex = src;
    el.replaceChildren(GBC.math.tex(src, display));
    if (!window.katex && !el._texSub) {
      el._texSub = true;
      GBC.bus.on('mathready', () => el.replaceChildren(GBC.math.tex(el._tex, display)));
    }
  }
  const texEl = (src, display = false, style = '') => {
    const el = H('div', { style: 'overflow-x:auto;overflow-y:hidden;' + style });
    texInto(el, src, display);
    return el;
  };
  function card(title, plain = true) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums;overflow-x:auto;overflow-y:hidden' });
    const head = plain ? 'font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px' : 'font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px';
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' }, H('div', { style: head }, title), body);
    return { el, body };
  }
  const cardGrid = (min = 200) => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(' + min + 'px,100%),1fr));gap:10px;margin:4px 0 10px' });
  function badge(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;white-space:nowrap;' + st }, text);
  }
  /** Таблица: columns — строки; rows — массивы строк. */
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  /** Список шагов решения: [[пояснение, TeX], …], показываются первые k. */
  function stepList(box, steps, k) {
    box.textContent = '';
    steps.slice(0, k).forEach(([c, t], j) => {
      const li = H('li', { style: 'opacity:' + (j === k - 1 ? 1 : 0.8) }, H('div', { style: 'font-size:.92rem;color:var(--ink-2)' }, c));
      if (t) li.appendChild(texEl(R`\displaystyle ` + t, false, 'padding:2px 0'));
      box.appendChild(li);
    });
  }
  const STARS = ['', '★', '★★', '★★★'];
  /** Склонение: plural(3, 'шаг', 'шага', 'шагов') → 'шага'. */
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  /** Перерисовка по смене темы (для тепловых карт: их цвета вычисляются при отрисовке). */
  const onTheme = (fn) => GBC.bus.on('themechange', () => setTimeout(fn, 0));

  /* ==============================================================================
   * Решатели ОДУ: y — число или массив
   * ============================================================================== */
  const add = (y, k, c) => (Array.isArray(y) ? y.map((v, i) => v + c * k[i]) : y + c * k);
  /** Один шаг: 'euler' | 'heun' | 'mid' | 'rk4'. */
  function stepODE(f, t, y, h, m) {
    if (m === 'euler') return add(y, f(t, y), h);
    if (m === 'heun') {
      const k1 = f(t, y);
      const k2 = f(t + h, add(y, k1, h));
      return Array.isArray(y) ? y.map((v, i) => v + (h * (k1[i] + k2[i])) / 2) : y + (h * (k1 + k2)) / 2;
    }
    if (m === 'mid') return add(y, f(t + h / 2, add(y, f(t, y), h / 2)), h);
    const k1 = f(t, y);
    const k2 = f(t + h / 2, add(y, k1, h / 2));
    const k3 = f(t + h / 2, add(y, k2, h / 2));
    const k4 = f(t + h, add(y, k3, h));
    return Array.isArray(y) ? y.map((v, i) => v + (h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])) / 6) : y + (h * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
  }
  const badVal = (y, cap) => (Array.isArray(y) ? y.some((v) => !Number.isFinite(v) || Math.abs(v) > cap) : !Number.isFinite(y) || Math.abs(y) > cap);
  /** n шагов от t0 до t1 (t1 может быть меньше t0). Останавливается, если |y| > cap. */
  function solveODE(f, t0, y0, t1, n, m = 'rk4', cap = 1e8) {
    const h = (t1 - t0) / n;
    const ts = [t0];
    const ys = [y0];
    let y = y0;
    for (let i = 0; i < n; i++) {
      y = stepODE(f, t0 + i * h, y, h, m);
      ts.push(t0 + (i + 1) * h);
      ys.push(y);
      if (badVal(y, cap)) break;
    }
    return { ts, ys };
  }
  /** Кривая решения через точку (tc, yc) на всём отрезке [t0, t1]: вперёд и назад. */
  function traceCurve(f, tc, yc, t0, t1, n = 300, cap = 1e3) {
    const nf = Math.max(1, Math.round((n * (t1 - tc)) / (t1 - t0)));
    const nb = Math.max(1, Math.round((n * (tc - t0)) / (t1 - t0)));
    const fw = tc < t1 ? solveODE(f, tc, yc, t1, nf, 'rk4', cap) : { ts: [tc], ys: [yc] };
    const bw = tc > t0 ? solveODE(f, tc, yc, t0, nb, 'rk4', cap) : { ts: [tc], ys: [yc] };
    return { x: bw.ts.slice().reverse().concat(fw.ts.slice(1)), y: bw.ys.slice().reverse().concat(fw.ys.slice(1)) };
  }
  /** Размер области рисования графика в пикселях (для штрихов одинаковой длины). */
  function plotPx(plot) {
    const W = Math.max(220, (plot.frame.clientWidth || 600) - (plot.opts.margin.left + plot.opts.margin.right));
    const Hp = Math.max(120, plot.opts.height - (plot.opts.margin.top + plot.opts.margin.bottom));
    return { W, H: Hp };
  }
  /** Поле направлений y′ = f(t, y): штрихи одинаковой длины на экране. */
  function fieldSegs(plot, f, dom, nx = 21, ny = 15, frac = 0.62) {
    const [t0, t1, y0, y1] = dom;
    const { W, H: Hp } = plotPx(plot);
    const ax = W / (t1 - t0);
    const ay = Hp / (y1 - y0);
    const half = (Math.min(W / nx, Hp / ny) * frac) / 2;
    const seg = { x1: [], y1: [], x2: [], y2: [] };
    for (let i = 0; i < nx; i++) {
      const t = t0 + ((i + 0.5) * (t1 - t0)) / nx;
      for (let j = 0; j < ny; j++) {
        const y = y0 + ((j + 0.5) * (y1 - y0)) / ny;
        const s = f(t, y);
        if (!Number.isFinite(s)) continue;
        const L = Math.hypot(ax, s * ay);
        const dt = half / L;
        const dy = (half * s) / L;
        seg.x1.push(t - dt);
        seg.x2.push(t + dt);
        seg.y1.push(y - dy);
        seg.y2.push(y + dy);
      }
    }
    return seg;
  }
  /** Векторное поле системы (x′, y′) = F(x, y): стрелки одинаковой длины. */
  function fieldArrows(plot, F, dom, nx = 17, ny = 13, frac = 0.7) {
    const [x0, x1, y0, y1] = dom;
    const { W, H: Hp } = plotPx(plot);
    const ax = W / (x1 - x0);
    const ay = Hp / (y1 - y0);
    const len = Math.min(W / nx, Hp / ny) * frac;
    const out = { x1: [], y1: [], x2: [], y2: [] };
    for (let i = 0; i < nx; i++) {
      const x = x0 + ((i + 0.5) * (x1 - x0)) / nx;
      for (let j = 0; j < ny; j++) {
        const y = y0 + ((j + 0.5) * (y1 - y0)) / ny;
        const [u, v] = F(x, y);
        const L = Math.hypot(u * ax, v * ay);
        if (!(L > 1e-12)) continue;
        const dx = (len * u) / L;
        const dy = (len * v) / L;
        out.x1.push(x - dx / 2);
        out.x2.push(x + dx / 2);
        out.y1.push(y - dy / 2);
        out.y2.push(y + dy / 2);
      }
    }
    return out;
  }
  /** Python: общий решатель для экспорта. */
  const PY_RK4 = 'def rk4(f, t, y, h):\n    """Один шаг Рунге — Кутты 4-го порядка; y — число или numpy-массив."""\n    k1 = f(t, y)\n    k2 = f(t + h / 2, y + h / 2 * k1)\n    k3 = f(t + h / 2, y + h / 2 * k2)\n    k4 = f(t + h, y + h * k3)\n    return y + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6\n';
  const PY_SOLVE = PY_RK4 + '\n\ndef solve(f, y0, t0, t1, n=400):\n    ts = np.linspace(t0, t1, n + 1)\n    ys = [np.asarray(y0, dtype=float)]\n    for i in range(n):\n        ys.append(rk4(f, ts[i], ys[-1], ts[1] - ts[0]))\n    return ts, np.array(ys)\n';

  /* ==============================================================================
   * Интуиция. Остывающий чай: формула, поле наклонов и шаги Эйлера
   * ============================================================================== */
  GBC.widget('tea-cooling', (el) => {
    const s = { k: 0.1, t: 10, field: true, euler: false };
    const ROOM = 20;
    const T0 = 90;
    const HE = 5;
    const w = ui.shell(el, { title: 'Остывающий чай: три способа увидеть решение', sub: 'Закон Ньютона: dT/dt = −k·(T − 20). Серые штрихи — наклоны, которых уравнение требует при каждой температуре. Синяя кривая — точное решение. Оранжевые шаги — метод Эйлера: идём 5 минут по текущему наклону, пересчитываем наклон и идём снова. Нажмите ▶.' });
    ui.slider(w.controls, { label: 'Коэффициент k, 1/мин', min: 0.02, max: 0.3, step: 0.01, value: s.k, format: f2, onInput: (v) => ((s.k = v), draw()) });
    ui.player(w.controls, { label: 'Время', min: 0, max: 60, value: s.t, fps: 6, format: (v) => v + ' мин', onChange: (v) => ((s.t = v), draw()) });
    ui.toggle(w.controls, { label: 'Поле наклонов', checked: s.field, onChange: (v) => ((s.field = v), draw()) });
    ui.toggle(w.controls, { label: 'Шаги Эйлера (h = 5 мин)', checked: s.euler, onChange: (v) => ((s.euler = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'время t, мин', domain: [0, 60] }, y: { label: 'температура T, °C', domain: [10, 95] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'T', label: 'температура T(t)' }, { key: 'r', label: 'скорость dT/dt' }, { key: 'd', label: 'разница с комнатой' }, { key: 'e', label: 'Эйлер в этот момент' }]);
    const Tex = (t) => ROOM + (T0 - ROOM) * Math.exp(-s.k * t);
    const eulerAt = (t) => {
      const n = Math.floor(t / HE + 1e-9);
      return { n, T: ROOM + (T0 - ROOM) * Math.pow(1 - s.k * HE, n) };
    };
    function draw() {
      const k = s.k;
      const f = (t, T) => -k * (T - ROOM);
      const ts = U.linspace(0, 60, 241);
      const done = ts.filter((x) => x <= s.t + 1e-9);
      const ns = U.range(Math.floor(s.t / HE + 1e-9) + 1);
      const eT = ns.map((n) => ROOM + (T0 - ROOM) * Math.pow(1 - k * HE, n));
      plot.render([
        s.field ? { type: 'segments', ...fieldSegs(plot, f, [0, 60, 10, 95], 18, 12), color: 'muted', width: 1.4, opacity: 0.7 } : null,
        { type: 'hline', y: ROOM, color: 'ink2', dash: '4 4', text: 'комната 20 °C' },
        { type: 'line', x: ts, y: ts.map(Tex), color: 'model', width: 1.4, dash: '3 3', opacity: 0.6, hover: false },
        { type: 'line', x: done, y: done.map(Tex), color: 'model', width: 2.6, label: 'точное решение T(t)', hover: false },
        s.euler ? { type: 'line', x: ns.map((n) => n * HE), y: eT, color: 'tree', width: 2, hover: false } : null,
        s.euler ? { type: 'points', x: ns.map((n) => n * HE), y: eT, color: 'tree', r: 4.5, label: 'шаги Эйлера', tooltip: (i) => [['t', ns[i] * HE + ' мин'], ['T', f2(eT[i]) + ' °C'], ['наклон', f2(f(0, eT[i])) + ' °C/мин']] } : null,
        { type: 'points', x: [s.t], y: [Tex(s.t)], color: 'model', r: 6 },
      ]);
      const T = Tex(s.t);
      const E = eulerAt(s.t);
      st.set('T', f2(T) + ' °C');
      st.set('r', f3(f(0, T)) + ' °C/мин');
      st.set('d', f2(T - ROOM) + ' °C');
      st.set('e', f2(E.T) + ' °C (шаг ' + E.n + ')');
      const t50 = Math.log(70 / 30) / k;
      note.innerHTML = 'Уравнение задаёт не температуру, а <b>скорость её изменения</b>: при 90 °C чай остывает на ' + f2(70 * k) + ' °C/мин, при 50 °C — на ' + f2(30 * k) + ' °C/мин. Решить уравнение — найти саму функцию T(t) = 20 + 70·e<sup>−kt</sup>. Сейчас k = ' + f2(k) + ': через 10 мин в чашке ' + f2(Tex(10)) + ' °C, до 50 °C чай остынет за ' + f2(t50) + ' мин. ' + (s.euler ? 'Эйлер с шагом 5 мин даёт к 10-й минуте ' + f2(eulerAt(10).T) + ' °C: он всё время берёт «старый», слишком крутой наклон и проскакивает вниз. С меньшим шагом он приблизится к кривой (блок 3).' : 'Включите шаги Эйлера, чтобы увидеть, как решение строится численно — без всякой формулы.');
    }
    w.pythonAction(() => 'import math\n\nk, room, T0 = ' + py(s.k) + ', 20.0, 90.0\nT = lambda t: room + (T0 - room) * math.exp(-k * t)   # точное решение\n\n# метод Эйлера: шаг по текущему наклону −k(T − 20)\nh, Te = 5.0, T0\nfor n in range(12):\n    print(f"t = {n * h:4.0f} мин: точно {T(n * h):6.2f} °C, Эйлер {Te:6.2f} °C")\n    Te += h * (-k * (Te - room))\nprint("до 50 °C:", round(math.log(70 / 30) / k, 3), "мин")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 1. Проверка решения подстановкой
   * ============================================================================== */
  const EX = Math.exp;
  const CHK = {
    decay: {
      label: 'y′ = −2y', tex: R`y' = -2y`, order: 1, f: (t, y) => -2 * y, dom: [0, 2], pyf: '-2 * y',
      cands: [
        { label: 'y = 5·e⁻²ᵗ', y: (t) => 5 * EX(-2 * t), d: (t) => -10 * EX(-2 * t), py: '5 * math.exp(-2 * t)', ok: true },
        { label: 'y = e⁻²ᵗ + 1', y: (t) => EX(-2 * t) + 1, d: (t) => -2 * EX(-2 * t), py: 'math.exp(-2 * t) + 1', ok: false },
        { label: 'y = e²ᵗ', y: (t) => EX(2 * t), d: (t) => 2 * EX(2 * t), py: 'math.exp(2 * t)', ok: false },
        { label: 'y = 0', y: () => 0, d: () => 0, py: '0.0', ok: true },
      ],
    },
    tplus: {
      label: 'y′ = t + y', tex: R`y' = t + y`, order: 1, f: (t, y) => t + y, dom: [0, 1.5], pyf: 't + y',
      cands: [
        { label: 'y = eᵗ − t − 1', y: (t) => EX(t) - t - 1, d: (t) => EX(t) - 1, py: 'math.exp(t) - t - 1', ok: true },
        { label: 'y = −t − 1', y: (t) => -t - 1, d: () => -1, py: '-t - 1', ok: true },
        { label: 'y = 3eᵗ − t − 1', y: (t) => 3 * EX(t) - t - 1, d: (t) => 3 * EX(t) - 1, py: '3 * math.exp(t) - t - 1', ok: true },
        { label: 'y = eᵗ', y: (t) => EX(t), d: (t) => EX(t), py: 'math.exp(t)', ok: false },
      ],
    },
    ysq: {
      label: 'y′ = y²', tex: R`y' = y^2`, order: 1, f: (t, y) => y * y, dom: [0, 0.9], pyf: 'y ** 2',
      cands: [
        { label: 'y = 1/(1 − t)', y: (t) => 1 / (1 - t), d: (t) => 1 / ((1 - t) * (1 - t)), py: '1 / (1 - t)', ok: true },
        { label: 'y = 1/(2 − t)', y: (t) => 1 / (2 - t), d: (t) => 1 / ((2 - t) * (2 - t)), py: '1 / (2 - t)', ok: true },
        { label: 'y = 1 + t', y: (t) => 1 + t, d: () => 1, py: '1 + t', ok: false },
        { label: 'y = eᵗ', y: (t) => EX(t), d: (t) => EX(t), py: 'math.exp(t)', ok: false },
      ],
    },
    logistic: {
      label: 'y′ = y(1 − y)', tex: R`y' = y(1 - y)`, order: 1, f: (t, y) => y * (1 - y), dom: [-3, 5], pyf: 'y * (1 - y)',
      cands: [
        { label: 'y = σ(t) = 1/(1 + e⁻ᵗ)', y: (t) => 1 / (1 + EX(-t)), d: (t) => EX(-t) / (1 + EX(-t)) ** 2, py: '1 / (1 + math.exp(-t))', ok: true },
        { label: 'y = 1/(1 + 3e⁻ᵗ)', y: (t) => 1 / (1 + 3 * EX(-t)), d: (t) => (3 * EX(-t)) / (1 + 3 * EX(-t)) ** 2, py: '1 / (1 + 3 * math.exp(-t))', ok: true },
        { label: 'y = 1', y: () => 1, d: () => 0, py: '1.0', ok: true },
        { label: 'y = 1 − e⁻ᵗ', y: (t) => 1 - EX(-t), d: (t) => EX(-t), py: '1 - math.exp(-t)', ok: false },
      ],
    },
    spring: {
      label: 'y″ = −y (второй порядок)', tex: R`y'' = -y`, order: 2, f: (t, y) => -y, dom: [0, 2 * Math.PI], pyf: '-y',
      cands: [
        { label: 'y = sin t', y: Math.sin, d: (t) => -Math.sin(t), py: 'math.sin(t)', pyd: '-math.sin(t)', ok: true },
        { label: 'y = 2cos t − sin t', y: (t) => 2 * Math.cos(t) - Math.sin(t), d: (t) => -2 * Math.cos(t) + Math.sin(t), py: '2 * math.cos(t) - math.sin(t)', pyd: '-2 * math.cos(t) + math.sin(t)', ok: true },
        { label: 'y = e⁻ᵗ', y: (t) => EX(-t), d: (t) => EX(-t), py: 'math.exp(-t)', pyd: 'math.exp(-t)', ok: false },
        { label: 'y = t·sin t', y: (t) => t * Math.sin(t), d: (t) => 2 * Math.cos(t) - t * Math.sin(t), py: 't * math.sin(t)', pyd: '2 * math.cos(t) - t * math.sin(t)', ok: false },
      ],
    },
  };
  /** Подпись кандидата → TeX: «y = 5·e⁻²ᵗ» → «y = 5\cdot e^{-2t}». */
  function candTex(label) {
    return label
      .replace(/σ\(t\) = /, R`\sigma(t) = `)
      .replace(/·/g, R`\cdot `)
      .replace(/e⁻²ᵗ/g, 'e^{-2t}')
      .replace(/e²ᵗ/g, 'e^{2t}')
      .replace(/e⁻ᵗ/g, 'e^{-t}')
      .replace(/eᵗ/g, 'e^{t}')
      .replace(/cos t/g, R`\cos t`)
      .replace(/sin t/g, R`\sin t`);
  }
  GBC.widget('solution-checker', (el) => {
    const s = { eq: 'decay', c: 0, tq: 0.4 };
    const w = ui.shell(el, { title: 'Решение ли это? Проверка подстановкой', sub: 'Выберите уравнение и кандидата. Сверху — кандидат поверх поля наклонов: решение обязано везде идти вдоль штрихов. Снизу — левая и правая части уравнения вдоль кривой: у решения они совпадают при каждом t.' });
    ui.select(w.controls, { label: 'Уравнение', value: s.eq, options: Object.entries(CHK).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.eq = v), (s.c = 0), fillCands(), draw()) });
    const candBox = H('div');
    w.controls.appendChild(candBox);
    ui.slider(w.controls, { label: 'Точка проверки t (доля отрезка)', min: 0, max: 1, step: 0.01, value: s.tq, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => ((s.tq = v), draw()) });
    function fillCands() {
      candBox.textContent = '';
      ui.select(candBox, { label: 'Кандидат', value: String(s.c), options: CHK[s.eq].cands.map((c, i) => ({ value: String(i), label: c.label })), onChange: (v) => ((s.c = +v), draw()) });
    }
    fillCands();
    const texBox = H('div', { style: 'margin:0 0 6px' });
    w.main.appendChild(texBox);
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 't' }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 190, x: { label: 't' }, y: { label: 'части уравнения' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'l', label: 'левая часть в точке' }, { key: 'r', label: 'правая часть в точке' }, { key: 'm', label: 'max |левая − правая|' }, { key: 'v', label: 'вывод' }]);
    function draw() {
      const E = CHK[s.eq];
      const C = E.cands[s.c];
      texInto(texBox, E.tex + R`\qquad\text{кандидат: } ` + candTex(C.label));
      const [a, b] = E.dom;
      const ts = U.linspace(a, b, 301);
      const ys = ts.map(C.y);
      const lhs = ts.map(C.d);
      const rhs = ts.map((t, i) => E.f(t, ys[i]));
      const yd = yDom(ys.concat(E.order === 1 ? [] : []), 0.15);
      const dom = [a, b, yd[0], yd[1]];
      const tq = a + s.tq * (b - a);
      const yq = C.y(tq);
      const layers = [];
      if (E.order === 1) layers.push({ type: 'segments', ...fieldSegs(p1, E.f, dom, 20, 12), color: 'muted', width: 1.3, opacity: 0.65 });
      layers.push({ type: 'line', x: ts, y: ys, color: C.ok ? 'model' : 'tree', width: 2.6, label: 'кандидат', hover: false });
      if (E.order === 1) {
        const dt = (b - a) * 0.07;
        layers.push({ type: 'segments', x1: [tq - dt], x2: [tq + dt], y1: [yq - dt * C.d(tq)], y2: [yq + dt * C.d(tq)], color: 'tree', width: 3, opacity: 1 });
        layers.push({ type: 'segments', x1: [tq - dt], x2: [tq + dt], y1: [yq - dt * E.f(tq, yq)], y2: [yq + dt * E.f(tq, yq)], color: 'ink', width: 1.6, opacity: 1, dash: '4 3' });
      }
      layers.push({ type: 'points', x: [tq], y: [yq], color: 'ink', r: 5, hollow: true });
      p1.render(layers, { x: [a, b], y: yd });
      const gap = lhs.map((v, i) => Math.abs(v - rhs[i]));
      const mx = Math.max(...gap);
      p2.render([
        { type: 'area', x: ts, y0: lhs, y1: rhs, color: 'critical', opacity: 0.18 },
        { type: 'line', x: ts, y: lhs, color: 'tree', width: 2.4, label: E.order === 1 ? 'левая часть y′(t)' : 'левая часть y″(t)' },
        { type: 'line', x: ts, y: rhs, color: 'ink', width: 1.8, dash: '6 4', label: E.order === 1 ? 'правая часть f(t, y(t))' : 'правая часть −y(t)' },
        { type: 'vline', x: tq, color: 'axis', dash: '3 3', width: 1 },
      ], { x: [a, b], y: yDom(lhs.concat(rhs), 0.1) });
      const ok = mx < 1e-9 * Math.max(1, ...ys.map(Math.abs));
      st.set('l', f4(C.d(tq)));
      st.set('r', f4(E.f(tq, yq)));
      st.set('m', ok ? '0' : sci(mx));
      st.set('v', ok ? 'решение ✓' : 'не решение ✗');
      const why = {
        'decay:1': 'Сдвиг на константу ломает решение: (e⁻²ᵗ + 1)′ = −2e⁻²ᵗ, а −2y = −2e⁻²ᵗ − 2. Разница ровно 2 при любом t. У линейного однородного уравнения сдвигать решение нельзя, а умножать на число — можно.',
        'decay:2': 'Знак не тот: эта функция растёт, а уравнение требует убывания при y > 0.',
        'decay:3': 'Нулевое решение тоже решение: 0′ = 0 = −2·0. Это равновесие (шаг 5).',
        'decay:0': 'Любая функция C·e⁻²ᵗ — решение. Константу C выбирает начальное условие: y(0) = C = 5.',
        'tplus:0': 'Подставим: (eᵗ − t − 1)′ = eᵗ − 1, а t + y = t + eᵗ − t − 1 = eᵗ − 1. Совпало.',
        'tplus:1': 'Прямая y = −t − 1 — тоже решение (C = 0): наклон −1, и t + y = −1. Все остальные решения отходят от неё как C·eᵗ.',
        'tplus:2': 'Общее решение y = C·eᵗ − t − 1: при C = 3 тоже подходит. Одно уравнение — целое семейство.',
        'tplus:3': 'eᵗ подходит для y′ = y, но не для y′ = t + y: не хватает слагаемого t. Разница между частями — ровно t.',
        'ysq:0': '(1/(1 − t))′ = 1/(1 − t)² = y². Решение, но только при t < 1: в t = 1 оно уходит в бесконечность (шаг 9).',
        'ysq:1': '1/(2 − t) — тоже решение (с y(0) = ½): семейство y = 1/(C − t).',
        'ysq:2': 'Наклон прямой 1, а y² = (1 + t)² растёт: совпадение только в t = 0.',
        'ysq:3': '(eᵗ)′ = eᵗ ≠ e²ᵗ. Рост «как экспонента» — у y′ = y; y′ = y² растёт быстрее и взрывается.',
        'logistic:0': 'Сигмоида — решение логистического уравнения: σ′ = σ(1 − σ) (урок 15.6). Подробно — шаг 11.',
        'logistic:1': '1/(1 + 3e⁻ᵗ) — та же сигмоида, сдвинутая по времени на ln 3: начальное условие y(0) = ¼.',
        'logistic:2': 'Постоянная y = 1 — равновесие: y′ = 0 и y(1 − y) = 0.',
        'logistic:3': 'Похожа на сигмоиду, но не та: её наклон e⁻ᵗ, а y(1 − y) = (1 − e⁻ᵗ)e⁻ᵗ. Совпадают только на бесконечности.',
        'spring:0': 'Второй порядок: проверяем y″. (sin t)″ = −sin t ✓.',
        'spring:1': 'Любая комбинация A·cos t + B·sin t — решение. Двух констант две — нужны два начальных условия: положение и скорость.',
        'spring:2': '(e⁻ᵗ)″ = e⁻ᵗ, а должно быть −e⁻ᵗ. Это решение y″ = +y.',
        'spring:3': 't·sin t — решение y″ + y = 2cos t (раскачка в резонанс), а не y″ = −y.',
      };
      note.innerHTML = '<b>' + (ok ? 'Подходит. ' : 'Не подходит. ') + '</b>' + why[s.eq + ':' + s.c] + (E.order === 1 ? ' На верхнем графике в точке проверки оранжевый отрезок — наклон кандидата, чёрный пунктир — наклон, которого требует уравнение.' : '');
    }
    w.pythonAction(() => {
      const E = CHK[s.eq];
      const C = E.cands[s.c];
      const [a, b] = E.dom;
      if (E.order === 2) return 'import math\n\ny   = lambda t: ' + C.py + '\nypp = lambda t: ' + C.pyd + '   # вторая производная кандидата\n\n# y″ = −y: сравниваем левую и правую части в нескольких точках\nfor t in [' + [0, 0.25, 0.5, 0.75, 1].map((q) => py(a + q * (b - a))).join(', ') + ']:\n    print(f"t = {t:.3f}: y″ = {ypp(t):+.6f}, −y = {-y(t):+.6f}")\n';
      return 'import math\n\ny = lambda t: ' + C.py + '\nf = lambda t, y: ' + E.pyf + '      # правая часть уравнения\n\ndef dy(t, h=1e-6):\n    """Численная производная кандидата."""\n    return (y(t + h) - y(t - h)) / (2 * h)\n\nfor t in [' + [0, 0.25, 0.5, 0.75, 1].map((q) => py(a + q * (b - a) * 0.999)).join(', ') + ']:\n    print(f"t = {t:.3f}: y′ = {dy(t):+.6f}, f(t, y) = {f(t, y(t)):+.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 2. y′ = f(t): решить уравнение — значит проинтегрировать
   * ============================================================================== */
  const RATE = {
    c3: { label: 'v(t) = 3 — постоянная скорость', v: () => 3, V: (t) => 3 * t, dom: [0, 4], y0: 0, py: '3.0 + 0 * t', pyV: '3 * t', yl: 'путь y(t), м', vl: 'скорость v(t), м/с' },
    lin: { label: 'v(t) = 2t — разгон', v: (t) => 2 * t, V: (t) => t * t, dom: [0, 4], y0: 0, py: '2 * t', pyV: 't**2', yl: 'путь y(t), м', vl: 'скорость v(t), м/с' },
    cos: { label: 'v(t) = cos t — туда и обратно', v: Math.cos, V: Math.sin, dom: [0, 3 * Math.PI], y0: 0, py: 'np.cos(t)', pyV: 'np.sin(t)', yl: 'положение y(t)', vl: 'скорость v(t)' },
    slow: { label: 'v(t) = 1/(1 + t) — замедление', v: (t) => 1 / (1 + t), V: (t) => Math.log(1 + t), dom: [0, 10], y0: 0, py: '1 / (1 + t)', pyV: 'np.log(1 + t)', yl: 'путь y(t)', vl: 'скорость v(t)' },
    ball: { label: 'мяч вверх: v(t) = 15 − 9.8t', v: (t) => 15 - 9.8 * t, V: (t) => 15 * t - 4.9 * t * t, dom: [0, 3.3], y0: 2, py: '15 - 9.8 * t', pyV: '15 * t - 4.9 * t**2', yl: 'высота y(t), м', vl: 'скорость v(t), м/с' },
  };
  GBC.widget('rate-integrator', (el) => {
    const s = { key: 'lin', y0: 0, q: 0.6, fam: true };
    const w = ui.shell(el, { title: 'y′ = v(t): от спидометра к одометру', sub: 'Правая часть зависит только от времени — уравнение решается интегрированием. Сверху скорость и накопленная площадь под ней, снизу — путь: y(t) = y(0) + ∫₀ᵗ v(s) ds. Константа C сдвигает кривую вверх-вниз; начальное условие выбирает одну.' });
    ui.select(w.controls, { label: 'Скорость v(t)', value: s.key, options: Object.entries(RATE).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), (s.y0 = RATE[v].y0), y0s.set(s.y0), draw()) });
    const y0s = ui.slider(w.controls, { label: 'Начальное условие y(0)', min: -3, max: 3, step: 0.5, value: s.y0, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.y0 = v), draw()) });
    ui.player(w.controls, { label: 'Момент t', min: 0, max: 100, value: 60, fps: 10, format: (v) => v + ' %', onChange: (v) => ((s.q = v / 100), draw()) });
    ui.toggle(w.controls, { label: 'Показать семейство y = V(t) + C', checked: s.fam, onChange: (v) => ((s.fam = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 190, x: { label: 't' }, y: { label: 'скорость v(t)' } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 't' }, y: { label: 'y(t)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'скорость v(t)' }, { key: 'A', label: 'площадь ∫₀ᵗ v' }, { key: 'y', label: 'y(t) = y(0) + площадь' }]);
    function draw() {
      const Rr = RATE[s.key];
      const [a, b] = Rr.dom;
      const t = a + s.q * (b - a);
      const ts = U.linspace(a, b, 301);
      const done = ts.filter((x) => x <= t + 1e-12);
      const vs = ts.map(Rr.v);
      p1.opts.y.label = Rr.vl;
      p2.opts.y.label = Rr.yl;
      p1.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'area', x: done, y0: done.map(() => 0), y1: done.map(Rr.v), color: 'tree', opacity: 0.25 },
        { type: 'line', x: ts, y: vs, color: 'tree', width: 2.4, hover: false },
        { type: 'vline', x: t, color: 'ink2', dash: '3 3', width: 1 },
      ], { x: [a, b], y: yDom(vs.concat([0]), 0.1) });
      const layers = [];
      const ysAll = [];
      if (s.fam) {
        for (let C = -3; C <= 3; C += 1) {
          const yy = ts.map((x) => Rr.V(x) + C);
          ysAll.push(...yy);
          layers.push({ type: 'line', x: ts, y: yy, color: 'muted', width: 1, opacity: 0.55, hover: false });
        }
      }
      const yc = ts.map((x) => Rr.V(x) + s.y0);
      ysAll.push(...yc);
      layers.push({ type: 'line', x: ts, y: yc, color: 'model', width: 2.6, label: 'y(t) = V(t) + y(0)', hover: false });
      layers.push({ type: 'points', x: [0, t], y: [s.y0, Rr.V(t) + s.y0], color: (i) => (i ? 'model' : 'ink'), legendColor: 'model', r: 5 });
      p2.render(layers, { x: [a, b], y: yDom(ysAll, 0.06) });
      const A = Rr.V(t) - Rr.V(a);
      st.set('v', f3(Rr.v(t)));
      st.set('A', f3(A));
      st.set('y', f3(s.y0 + A));
      const msg = {
        c3: 'Постоянная скорость — путь растёт по прямой y = 3t + C. Наклон у всех кривых семейства одинаковый, они отличаются только сдвигом.',
        lin: 'Скорость растёт линейно — путь растёт как парабола: y = t² + C. Площадь под прямой v = 2t — треугольник t·2t/2 = t².',
        cos: 'Когда скорость отрицательна, площадь вычитается: точка идёт назад. y = sin t + C — движение туда-обратно.',
        slow: 'Скорость падает, но не настолько быстро, чтобы путь остался конечным: y = ln(1 + t) растёт без предела (ср. гармонический ряд, урок 15.10).',
        ball: 'Ускорение −9.8 м/с² дважды интегрируем: v = 15 − 9.8t, y = 2 + 15t − 4.9t². Мяч поднимается 1.53 с до высоты 13.48 м и падает на землю через 3.19 с. Для уравнения второго порядка y″ = −9.8 нужны два условия: y(0) = 2 и y′(0) = 15.',
      };
      note.innerHTML = msg[s.key] + ' Уравнения вида y′ = f(t) — это просто интегралы (урок 15.9); «настоящие» дифференциальные уравнения начинаются, когда скорость зависит от самого y.';
    }
    w.pythonAction(() => {
      const Rr = RATE[s.key];
      return 'import numpy as np\n\n# y′ = v(t), y(0) = ' + py(s.y0) + ': накапливаем площадь методом трапеций\nt = np.linspace(' + py(Rr.dom[0]) + ', ' + py(Rr.dom[1]) + ', 2001)\nv = ' + Rr.py + '\ny = ' + py(s.y0) + ' + np.concatenate([[0], np.cumsum((v[1:] + v[:-1]) / 2 * np.diff(t))])\nexact = ' + py(s.y0) + ' + ' + Rr.pyV + '\nprint("y в конце: численно", y[-1], " точно", exact[-1])\nprint("наибольшая ошибка трапеций:", np.max(np.abs(y - exact)))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 3. Приток минус отток: y′ = a − b·y
   * ============================================================================== */
  const FLOW = {
    drug: { label: 'Капельница: лекарство в крови', a: { label: 'Поступление a, мг/ч', min: 0, max: 20, step: 1, v: 10 }, b: { label: 'Выведение b, доля в час', min: 0.05, max: 1, step: 0.05, v: 0.2 }, y0: 0, T: 30, yl: 'лекарство в крови, мг', tl: 'время, ч', u: 'мг', tu: 'ч', sign: 1 },
    tank: { label: 'Бак 100 л: соль в рассоле', a: { label: 'Приток соли a, кг/мин', min: 0, max: 2, step: 0.1, v: 1 }, b: { label: 'Доля бака, вытекающая за минуту, b', min: 0.01, max: 0.2, step: 0.01, v: 0.05 }, y0: 0, T: 120, yl: 'соль в баке, кг', tl: 'время, мин', u: 'кг', tu: 'мин', sign: 1 },
    sky: { label: 'Парашютист до раскрытия', a: { label: 'Ускорение g, м/с²', min: 1.6, max: 9.8, step: 0.1, v: 9.8 }, b: { label: 'Сопротивление воздуха b, 1/с', min: 0.05, max: 1, step: 0.05, v: 0.2 }, y0: 0, T: 30, yl: 'скорость, м/с', tl: 'время, с', u: 'м/с', tu: 'с', sign: 1 },
    bank: { label: 'Вклад с пополнением (рост)', a: { label: 'Пополнение a, в год', min: 0, max: 500, step: 10, v: 100 }, b: { label: 'Ставка r (b = −r), в год', min: 0.01, max: 0.1, step: 0.005, v: 0.05 }, y0: 1000, T: 30, yl: 'сумма на счёте', tl: 'время, лет', u: '', tu: 'лет', sign: -1 },
  };
  GBC.widget('inflow-outflow', (el) => {
    const s = { key: 'drug', a: 10, b: 0.2, y0: 0 };
    const w = ui.shell(el, { title: 'Приток минус отток: y′ = a − b·y', sub: 'Четыре разные истории — одно уравнение. a — постоянный приток, b·y — отток, пропорциональный тому, что уже накопилось. Двигайте ползунки: куда стремится величина и как быстро?' });
    const ctl = H('div');
    ui.select(w.controls, { label: 'История', value: s.key, options: Object.entries(FLOW).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), build(), draw()) });
    w.controls.appendChild(ctl);
    function build() {
      const F = FLOW[s.key];
      s.a = F.a.v;
      s.b = F.b.v;
      s.y0 = F.y0;
      ctl.textContent = '';
      ui.slider(ctl, { label: F.a.label, min: F.a.min, max: F.a.max, step: F.a.step, value: s.a, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.a = v), draw()) });
      ui.slider(ctl, { label: F.b.label, min: F.b.min, max: F.b.max, step: F.b.step, value: s.b, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.b = v), draw()) });
      const top = s.key === 'bank' ? 3000 : s.key === 'sky' ? 60 : s.key === 'tank' ? 40 : 100;
      ui.slider(ctl, { label: 'Начальное значение y(0)', min: 0, max: top, step: top / 40, value: s.y0, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.y0 = v), draw()) });
    }
    const texBox = H('div', { style: 'margin:0 0 4px;overflow-x:auto;overflow-y:hidden' });
    w.main.appendChild(texBox);
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'время' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'равновесие y* = a/b' }, { key: 'tau', label: 'постоянная времени 1/|b|' }, { key: 'h', label: 'полпути: ln 2/|b|' }, { key: 'yT', label: 'y в конце' }]);
    function draw() {
      const F = FLOW[s.key];
      const b = F.sign * s.b;
      const a = s.a;
      const ys = (t) => a / b + (s.y0 - a / b) * Math.exp(-b * t);
      const ts = U.linspace(0, F.T, 301);
      const yv = ts.map(ys);
      const nb = (v) => U.fmt(v, 4);
      texInto(texBox, R`y' = ` + nb(a) + (b >= 0 ? ' - ' : ' + ') + nb(Math.abs(b)) + R`\,y,\ \ y(0) = ` + nb(s.y0) + R`\ \Rightarrow\ y(t) = ` + nb(a / b) + (s.y0 - a / b >= 0 ? ' + ' : ' - ') + nb(Math.abs(s.y0 - a / b)) + R`\,e^{` + (b >= 0 ? '-' : '') + nb(Math.abs(b)) + 't}', true);
      const eq = a / b;
      const layers = [];
      if (b > 0) {
        layers.push({ type: 'hline', y: eq, color: 'ink2', dash: '4 4', label: 'равновесие a/b' });
        const tau = 1 / b;
        [[tau, '63 %'], [3 * tau, '95 %']].forEach(([t, lab]) => {
          if (t < F.T) layers.push({ type: 'vline', x: t, color: 'axis', dash: '3 3', width: 1, text: lab });
        });
      }
      layers.push({ type: 'line', x: ts, y: yv, color: 'model', width: 2.6, label: 'y(t)' });
      plot.opts.x.label = F.tl;
      plot.opts.y.label = F.yl;
      plot.render(layers, { x: [0, F.T], y: yDom(yv.concat(b > 0 ? [eq] : []).concat([0]), 0.08) });
      st.set('e', b > 0 ? f3(eq) + ' ' + F.u : '—  (b < 0: равновесие ' + f3(eq) + ' отталкивает)');
      st.set('tau', f3(1 / Math.abs(b)) + ' ' + F.tu);
      st.set('h', f3(Math.LN2 / Math.abs(b)) + ' ' + F.tu);
      st.set('yT', f3(yv[yv.length - 1]) + ' ' + F.u);
      const msg = {
        drug: 'Лекарство поступает с постоянной скоростью, а печень и почки выводят постоянную долю того, что есть в крови. Уровень выходит на плато a/b: поступление уравновешивает выведение. Время до плато не зависит от дозы a — только от b: фармакологи говорят «стационар через 4–5 периодов полувыведения» (после 5 — это 1 − 2⁻⁵ ≈ 97 % пути).',
        tank: 'В бак втекает рассол, вытекает перемешанная смесь: соли уходит тем больше, чем её больше в баке. Равновесие — когда концентрация в баке сравнялась с входящей: 1 кг/мин ÷ 0.05/мин = 20 кг (0.2 кг/л × 100 л).',
        sky: 'Сила тяжести разгоняет, сопротивление тормозит пропорционально скорости. Предельная скорость g/b: при b = 0.2 это 49 м/с ≈ 176 км/ч. (Реальное сопротивление растёт как v², но картина та же — равновесие.)',
        bank: 'Здесь отток отрицательный: проценты добавляют деньги пропорционально сумме. b = −r < 0, и «равновесие» −a/r отталкивает: сумма растёт экспоненциально. Знак b решает всё: b > 0 — выход на плато, b < 0 — рост без предела.',
      };
      note.innerHTML = msg[s.key] + (b > 0 ? ' Общее правило: за время τ = 1/b проходится 63 % пути до равновесия, за 3τ — 95 %, за 5τ — 99.3 %.' : '');
    }
    w.pythonAction(() => {
      const F = FLOW[s.key];
      const b = F.sign * s.b;
      return 'import numpy as np\n\na, b, y0 = ' + py(s.a) + ', ' + py(b) + ', ' + py(s.y0) + '     # y′ = a − b·y\nt = np.linspace(0, ' + py(F.T) + ', 7)\ny = a / b + (y0 - a / b) * np.exp(-b * t)   # точное решение\nfor ti, yi in zip(t, y):\n    print(f"t = {ti:7.2f}: y = {yi:10.3f}")\nprint("равновесие a/b =", a / b, "  постоянная времени 1/|b| =", 1 / abs(b))\n';
    });
    build();
    draw();
  });

  /* ==============================================================================
   * Шаг 4. Поле направлений и изоклины
   * ============================================================================== */
  const EQ = {
    approach: { label: 'y′ = 1 − y (подход к 1)', f: (t, y) => 1 - y, dom: [0, 5, -1.5, 3], py: '1 - y', msg: 'y = 1 — равновесие: там штрихи горизонтальны. Решения y = 1 + C·e⁻ᵗ подтягиваются к нему снизу и сверху. Изоклины — горизонтальные прямые: наклон зависит только от y.' },
    decay: { label: 'y′ = −y (затухание)', f: (t, y) => -y, dom: [0, 5, -2.5, 2.5], py: '-y', msg: 'Все решения y = C·e⁻ᵗ стремятся к 0: штрихи сверху смотрят вниз, снизу — вверх.' },
    growth: { label: 'y′ = y (рост)', f: (t, y) => y, dom: [0, 3, -3, 3], py: 'y', msg: 'Решения y = C·eᵗ убегают от нуля всё быстрее. Ноль — неустойчивое равновесие: малейшее отклонение растёт.' },
    logistic: { label: 'y′ = y(1 − y) (логистическое)', f: (t, y) => y * (1 - y), dom: [0, 8, -0.5, 1.5], py: 'y * (1 - y)', msg: 'Два равновесия: y = 0 (неустойчивое) и y = 1 (устойчивое). Решения между ними — S-образные кривые, сигмоиды (шаг 11).' },
    tminus: { label: 'y′ = t − y', f: (t, y) => t - y, dom: [0, 5, -2, 4], py: 't - y', msg: 'Наклон зависит и от t, и от y; изоклины — наклонные прямые y = t − c. Изоклина c = 1, прямая y = t − 1, сама оказывается решением, и все остальные решения y = t − 1 + C·e⁻ᵗ прижимаются к ней.' },
    ty: { label: 'y′ = t·y', f: (t, y) => t * y, dom: [-2.5, 2.5, -3, 3], py: 't * y', msg: 'При t < 0 решения затухают, при t > 0 — растут: y = C·e^(t²/2). Изоклины t·y = c — гиперболы.' },
    ysq: { label: 'y′ = y² (взрыв)', f: (t, y) => y * y, dom: [0, 3, -2, 3], py: 'y**2', msg: 'Штрихи становятся вертикальными очень быстро: решения y = 1/(C − t) уходят в бесконечность за конечное время (шаг 9).' },
    cos: { label: 'y′ = cos t − y (раскачка)', f: (t, y) => Math.cos(t) - y, dom: [0, 12, -1.5, 1.5], py: 'np.cos(t) - y', msg: 'Все решения забывают начальное условие и выходят на одно и то же колебание — отстающее и более слабое, чем cos t (шаг 8).' },
  };
  GBC.widget('slope-field', (el) => {
    const s = { eq: 'approach', starts: null, iso: false };
    const w = ui.shell(el, { title: 'Поле направлений: карта наклонов', sub: 'В каждой точке (t, y) уравнение задаёт наклон — штрих. Решение — кривая, которая в каждой точке идёт вдоль штриха. Кликните по полю, чтобы запустить решение из этой точки; изоклины соединяют точки с одинаковым наклоном.' });
    ui.select(w.controls, { label: 'Уравнение', value: s.eq, options: Object.entries(EQ).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.eq = v), (s.starts = null), draw()) });
    ui.toggle(w.controls, { label: 'Изоклины: наклон −1, 0, 1', checked: s.iso, onChange: (v) => ((s.iso = v), draw()) });
    ui.button(w.controls, { label: 'Очистить кривые', onClick: () => ((s.starts = []), draw()) });
    const plot = new GBC.Plot(w.main, { height: 360, x: { label: 't' }, y: { label: 'y' } });
    plot.onClick = (t, y) => ((s.starts = (s.starts || []).concat([[t, y]]).slice(-10)), draw());
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'кривых' }, { key: 'p', label: 'последняя точка' }, { key: 'k', label: 'наклон в ней' }]);
    function draw() {
      const E = EQ[s.eq];
      const [t0, t1, y0, y1] = E.dom;
      if (s.starts === null) s.starts = [[t0, y0 + 0.15 * (y1 - y0)], [t0, y0 + 0.5 * (y1 - y0)], [t0, y0 + 0.85 * (y1 - y0)]];
      const layers = [{ type: 'segments', ...fieldSegs(plot, E.f, E.dom, 22, 16), color: 'muted', width: 1.4, opacity: 0.75 }];
      if (s.iso) {
        const grid = GBC.Plot.grid(E.f, t0, t1, y0, y1, 121, 121);
        [[-1, 'violet'], [0, 'ink2'], [1, 'aqua']].forEach(([c, col]) => layers.push({ type: 'contour', grid, level: c, color: col, width: 1.6, dash: c === 0 ? null : '5 3' }));
        layers.push({ type: 'line', x: [NaN], y: [NaN], color: 'ink2', label: 'изоклина: наклон 0' });
        layers.push({ type: 'line', x: [NaN], y: [NaN], color: 'aqua', dash: '5 3', label: 'наклон +1' });
        layers.push({ type: 'line', x: [NaN], y: [NaN], color: 'violet', dash: '5 3', label: 'наклон −1' });
      }
      const span = y1 - y0;
      s.starts.forEach(([tc, yc]) => {
        const c = traceCurve(E.f, tc, yc, t0, t1, 500, 1e3);
        layers.push({ type: 'line', x: c.x, y: clampArr(c.y, y0 - 2 * span, y1 + 2 * span), color: 'model', width: 2.2, hover: false });
      });
      layers.push({ type: 'points', x: s.starts.map((p) => p[0]), y: s.starts.map((p) => p[1]), color: 'model', r: 5 });
      plot.render(layers, { x: [t0, t1], y: [y0, y1] });
      const last = s.starts[s.starts.length - 1];
      st.set('n', String(s.starts.length));
      st.set('p', last ? '(' + f2(last[0]) + ', ' + f2(last[1]) + ')' : '—');
      st.set('k', last ? f3(E.f(last[0], last[1])) : '—');
      note.innerHTML = E.msg + ' Разные кривые — разные <b>начальные условия</b>: одно уравнение, целое семейство решений. Кривые не пересекаются (шаг 9).';
    }
    w.pythonAction(() => {
      const E = EQ[s.eq];
      const [t0, t1, y0, y1] = E.dom;
      return 'import numpy as np\nimport matplotlib.pyplot as plt\n\nf = lambda t, y: ' + E.py + '\nt0, t1, y0, y1 = ' + [t0, t1, y0, y1].map(py).join(', ') + '\n\n' + PY_RK4 + '\n# поле направлений: штрихи одинаковой длины\nT, Y = np.meshgrid(np.linspace(t0, t1, 22), np.linspace(y0, y1, 16))\nS = f(T, Y)\nU, V = np.ones_like(S) / (t1 - t0), S / (y1 - y0)\nN = np.hypot(U, V)\nplt.quiver(T, Y, U / N, V / N, angles="xy", pivot="middle", headwidth=0, headlength=0, headaxislength=0, color="gray")\n\nfor tc, yc in ' + JSON.stringify(s.starts.map((p) => [Number(p[0].toFixed(3)), Number(p[1].toFixed(3))])) + ':\n    for t_end in (t1, t0):                     # вперёд и назад от точки\n        n = 400\n        h = (t_end - tc) / n\n        ts, ys = [tc], [yc]\n        for i in range(n):\n            ys.append(rk4(f, ts[-1], ys[-1], h))\n            ts.append(ts[-1] + h)\n            if abs(ys[-1]) > 1e3:\n                break\n        plt.plot(ts, ys, color="C0")\nplt.xlim(t0, t1); plt.ylim(y0, y1); plt.xlabel("t"); plt.ylabel("y")\nplt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 5. Автономные уравнения: фазовая прямая и устойчивость
   * ============================================================================== */
  const PL = {
    logistic: { label: 'y′ = y(1 − y)', f: (y) => y * (1 - y), dom: [-0.4, 1.4], T: 8, eqs: [0, 1], py: 'y * (1 - y)' },
    allee: { label: 'y′ = 4y(1 − y)(y − 0.3) — эффект Олли', f: (y) => 4 * y * (1 - y) * (y - 0.3), dom: [-0.25, 1.25], T: 12, eqs: [0, 0.3, 1], py: '4 * y * (1 - y) * (y - 0.3)' },
    sq1: { label: 'y′ = y² − 1', f: (y) => y * y - 1, dom: [-2, 1.6], T: 4, eqs: [-1, 1], py: 'y**2 - 1' },
    sin: { label: 'y′ = sin y', f: Math.sin, dom: [-1, 7.3], T: 8, eqs: [0, Math.PI, 2 * Math.PI], py: 'np.sin(y)' },
    cube: { label: 'y′ = −y³ (медленный подход)', f: (y) => -y * y * y, dom: [-1.5, 1.5], T: 10, eqs: [0], py: '-y**3' },
    semi: { label: 'y′ = y² (полуустойчивое)', f: (y) => y * y, dom: [-1.5, 1.5], T: 4, eqs: [0], py: 'y**2' },
  };
  function classify(f, ys) {
    return ys.map((y) => {
      const d = 1e-5;
      const fp = (f(y + d) - f(y - d)) / (2 * d);
      const lo = f(y - 0.02);
      const hi = f(y + 0.02);
      let kind;
      if (fp < -1e-7) kind = 'stable';
      else if (fp > 1e-7) kind = 'unstable';
      else if (lo > 0 && hi < 0) kind = 'stable';
      else if (lo < 0 && hi > 0) kind = 'unstable';
      else kind = 'semi';
      return { y, fp, kind };
    });
  }
  const KIND = { stable: 'устойчиво', unstable: 'неустойчиво', semi: 'полуустойчиво' };
  GBC.widget('phase-line', (el) => {
    const s = { key: 'logistic', y0: 0.15 };
    const w = ui.shell(el, { title: 'Фазовая прямая: всё о решениях по графику f(y)', sub: 'Для y′ = f(y) наклон зависит только от y. Сверху — график f(y): где он выше нуля, y растёт (стрелка вправо), где ниже — убывает (влево). Нули f — равновесия. Снизу — решения из разных начальных значений.' });
    ui.select(w.controls, { label: 'Уравнение', value: s.key, options: Object.entries(PL).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.key = v;
      const P = PL[v];
      y0s.el.remove();
      y0s = mkY0(P);
      s.y0 = y0s.value;
      draw();
    } });
    const mkY0 = (P) => ui.slider(w.controls, { label: 'Выделенный старт y(0)', min: P.dom[0], max: P.dom[1], step: (P.dom[1] - P.dom[0]) / 100, value: P.dom[0] + 0.3 * (P.dom[1] - P.dom[0]), format: f2, onInput: (v) => ((s.y0 = v), draw()) });
    let y0s = mkY0(PL[s.key]);
    s.y0 = y0s.value;
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'y' }, y: { label: 'скорость f(y)' } });
    const p2 = new GBC.Plot(w.main, { height: 260, x: { label: 't' }, y: { label: 'y(t)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'равновесия' }, { key: 'd', label: 'f′(y*) в них' }]);
    function draw() {
      const P = PL[s.key];
      const [a, b] = P.dom;
      const ys = U.linspace(a, b, 400);
      const fs = ys.map(P.f);
      const eq = classify(P.f, P.eqs);
      const fd = yDom(fs.concat([0]), 0.12);
      // стрелки на оси: в каждом промежутке между равновесиями
      const cuts = [a].concat(P.eqs).concat([b]);
      const ar = { x1: [], y1: [], x2: [], y2: [] };
      for (let i = 0; i + 1 < cuts.length; i++) {
        const lo = cuts[i];
        const hi = cuts[i + 1];
        if (hi - lo < 0.05 * (b - a)) continue;
        const m = (lo + hi) / 2;
        const dir = Math.sign(P.f(m));
        const len = Math.min(0.35 * (hi - lo), 0.08 * (b - a));
        ar.x1.push(m - (dir * len) / 2);
        ar.x2.push(m + (dir * len) / 2);
        ar.y1.push(0);
        ar.y2.push(0);
      }
      p1.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'area', x: ys, y0: ys.map(() => 0), y1: fs.map((v) => Math.max(0, v)), color: 'aqua', opacity: 0.14 },
        { type: 'area', x: ys, y0: ys.map(() => 0), y1: fs.map((v) => Math.min(0, v)), color: 'tree', opacity: 0.14 },
        { type: 'line', x: ys, y: fs, color: 'ink', width: 2.2, hover: false },
        { type: 'arrows', ...ar, color: 'ink2', width: 2.4 },
        { type: 'points', x: eq.filter((e) => e.kind === 'stable').map((e) => e.y), y: eq.filter((e) => e.kind === 'stable').map(() => 0), color: 'model', r: 6, label: 'устойчивое' },
        { type: 'points', x: eq.filter((e) => e.kind !== 'stable').map((e) => e.y), y: eq.filter((e) => e.kind !== 'stable').map(() => 0), color: 'model', r: 6, hollow: true, label: 'неустойчивое / полуустойчивое' },
        { type: 'vline', x: s.y0, color: 'tree', dash: '3 3', width: 1.2 },
      ], { x: [a, b], y: fd });
      const layers = P.eqs.map((e) => ({ type: 'hline', y: e, color: 'ink2', dash: '4 4', width: 1 }));
      const starts = U.linspace(a + 0.04 * (b - a), b - 0.04 * (b - a), 9);
      const span = b - a;
      starts.forEach((y0) => {
        const sol = solveODE((t, y) => P.f(y), 0, y0, P.T, 400, 'rk4', 1e3);
        layers.push({ type: 'line', x: sol.ts, y: clampArr(sol.ys, a - span, b + span), color: 'model', width: 1.3, opacity: 0.5, hover: false });
      });
      const sol = solveODE((t, y) => P.f(y), 0, s.y0, P.T, 400, 'rk4', 1e3);
      layers.push({ type: 'line', x: sol.ts, y: clampArr(sol.ys, a - span, b + span), color: 'tree', width: 2.6, label: 'выделенный старт', hover: false });
      p2.render(layers, { x: [0, P.T], y: [a, b] });
      st.set('e', eq.map((e) => f2(e.y) + ' — ' + KIND[e.kind]).join('; '));
      st.set('d', eq.map((e) => f2(e.fp)).join('; '));
      const tips = {
        logistic: 'f′(0) = 1 > 0 — ноль неустойчив; f′(1) = −1 < 0 — единица устойчива. Решения у самой единицы приближаются как e⁻ᵗ: время установления 1/|f′(y*)| = 1.',
        allee: 'Эффект Олли: малой популяции трудно найти партнёров, и ниже порога 0.3 она вымирает. Равновесия чередуются: 0 устойчиво, 0.3 — порог (неустойчиво), 1 устойчиво.',
        sq1: 'y = −1 устойчиво (f′ = −2), y = 1 неустойчиво (f′ = 2). Выше единицы решения уходят в бесконечность за конечное время.',
        sin: 'Равновесия kπ чередуются: 0 и 2π неустойчивы (cos = 1), π устойчиво (cos π = −1). Вся информация — в знаке f между нулями.',
        cube: 'f′(0) = 0 — линейный признак молчит, но знак f показывает: ноль устойчив. Подход медленный, не экспоненциальный: y ≈ 1/√(2t). Похоже на градиентный спуск у плоского минимума.',
        semi: 'f ≥ 0 везде: снизу решения подходят к нулю, сверху уходят — равновесие полуустойчивое. Признак f′(y*) = 0 здесь ничего не говорит.',
      };
      note.innerHTML = '<b>Правило:</b> равновесие y* устойчиво, если f′(y*) &lt; 0 (f пересекает ноль сверху вниз), и неустойчиво, если f′(y*) &gt; 0. ' + tips[s.key];
    }
    w.pythonAction(() => {
      const P = PL[s.key];
      return 'import numpy as np\n\nf = lambda y: ' + P.py + '\n\n# равновесия: нули f; устойчивость — по знаку f′(y*)\nfor ys in ' + JSON.stringify(P.eqs.map((v) => Number(v.toFixed(6)))) + ':\n    d = (f(ys + 1e-6) - f(ys - 1e-6)) / 2e-6\n    kind = "устойчиво" if d < 0 else "неустойчиво" if d > 0 else "f′ = 0: смотрите знак f по бокам"\n    print(f"y* = {ys:.4f}: f′(y*) = {d:+.4f} — {kind}")\n\n# решение из выделенной точки (Рунге — Кутта)\ny, h = ' + py(s.y0) + ', ' + py(P.T / 400) + '\nfor n in range(400):\n    k1 = f(y); k2 = f(y + h / 2 * k1); k3 = f(y + h / 2 * k2); k4 = f(y + h * k3)\n    y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6\n    if abs(y) > 1e3:\n        print("решение ушло в бесконечность около t =", round((n + 1) * h, 3)); break\nprint("y(' + py(P.T) + ') =", y)\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 6. Экспонента: рост, затухание, удвоение
   * ============================================================================== */
  const EXPS = {
    bact: { label: 'Бактерии: удвоение за 20 мин', k: Math.LN2 / 20, y0: 1, T: 180, tu: 'мин', yl: 'клеток (в начальных)' },
    c14: { label: 'Углерод-14: полураспад 5730 лет', k: -Math.LN2 / 5730, y0: 100, T: 30000, tu: 'лет', yl: 'осталось C-14, %' },
    bank: { label: 'Вклад: 5 % в год, непрерывно', k: 0.05, y0: 1000, T: 40, tu: 'лет', yl: 'сумма' },
    custom: { label: 'Свой k (ползунок)', k: null, y0: 1, T: 10, tu: '', yl: 'y(t)' },
  };
  GBC.widget('exp-growth', (el) => {
    const s = { key: 'bact', k: 0.5, log: false };
    const w = ui.shell(el, { title: 'y′ = k·y: экспонента', sub: 'Скорость пропорциональна самой величине. Решение y = y₀·e^(kt): за равные промежутки времени величина умножается на одно и то же число. Точки отмечают моменты удвоения (k > 0) или уменьшения вдвое (k < 0).' });
    ui.select(w.controls, { label: 'Пример', value: s.key, options: Object.entries(EXPS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.slider(w.controls, { label: 'k для «своего k»', min: -1.5, max: 1.5, step: 0.05, value: s.k, format: f2, onInput: (v) => ((s.k = v === 0 ? 0.05 : v), (s.key = 'custom'), draw()) });
    ui.toggle(w.controls, { label: 'Логарифмическая шкала y', checked: s.log, onChange: (v) => ((s.log = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 't' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'k' }, { key: 'd', label: 'удвоение / полураспад' }, { key: 'y', label: 'y в конце' }, { key: 'm', label: 'множитель за единицу времени' }]);
    function draw() {
      const E = EXPS[s.key];
      const k = E.k === null ? s.k : E.k;
      const T = E.T;
      const ts = U.linspace(0, T, 400);
      const ys = ts.map((t) => E.y0 * Math.exp(k * t));
      const Td = Math.LN2 / Math.abs(k);
      const marks = [];
      for (let j = 0; j * Td <= T + 1e-9 && j <= 40; j++) marks.push(j * Td);
      const my = marks.map((t) => E.y0 * Math.exp(k * t));
      const lo = Math.min(...ys);
      const hi = Math.max(...ys);
      plot.opts.y.type = s.log ? 'log' : undefined;
      let yd;
      if (s.log) {
        const la = logAxis(lo * 0.8, hi * 1.25);
        plot.opts.y.ticks = la.ticks;
        plot.opts.y.format = powFmt;
        yd = la.domain;
      } else {
        plot.opts.y.ticks = undefined;
        plot.opts.y.format = undefined;
        yd = yDom(ys.concat([0]), 0.06);
      }
      plot.opts.x.label = 't' + (E.tu ? ', ' + E.tu : '');
      plot.opts.y.label = E.yl + (s.log ? ' (лог.)' : '');
      plot.render([
        { type: 'line', x: ts, y: ys, color: 'model', width: 2.6, label: 'y = y₀·e^{kt}', hover: false },
        { type: 'points', x: marks, y: my, color: 'tree', r: 4.5, label: k > 0 ? 'каждое удвоение' : 'каждое уменьшение вдвое', tooltip: (i) => [['t', f3(marks[i]) + ' ' + E.tu], ['y', f4(my[i])]] },
      ], { x: [0, T], y: yd });
      st.set('k', sci(k) + (E.tu ? ' 1/' + E.tu.replace('лет', 'год') : ''));
      st.set('d', f3(Td) + ' ' + E.tu);
      st.set('y', sci(ys[ys.length - 1]));
      st.set('m', f4(Math.exp(k)));
      const msg = {
        bact: 'k = ln 2 / 20 ≈ 0.0347 в минуту. За 3 часа — 9 удвоений: в 2⁹ = 512 раз больше. Включите логарифмическую шкалу: экспонента становится прямой, ln y = ln y₀ + kt, и её наклон — это k.',
        c14: 'Живой организм обновляет углерод, после смерти C-14 распадается: k = −ln 2 / 5730 ≈ −1.21·10⁻⁴ в год. Если осталось 30 %, прошло t = ln(1/0.3)/|k| ≈ 9953 года — так работает радиоуглеродный анализ.',
        bank: 'Непрерывное начисление 5 %: за 10 лет множитель e^0.5 ≈ 1.6487 (раз в год — 1.05¹⁰ ≈ 1.6289). Правило 70: удвоение за ≈ 70/5 = 14 лет, точно ln 2/0.05 ≈ 13.86.',
        custom: 'При k > 0 — рост, при k < 0 — затухание; время удвоения (полураспада) ln 2/|k| не зависит от того, сколько уже есть. На логарифмической шкале любая экспонента — прямая.',
      };
      note.innerHTML = msg[s.key];
    }
    w.pythonAction(() => {
      const E = EXPS[s.key];
      const k = E.k === null ? s.k : E.k;
      return 'import math\n\nk, y0, T = ' + py(k) + ', ' + py(E.y0) + ', ' + py(E.T) + '\ny = lambda t: y0 * math.exp(k * t)\nprint("время удвоения / полураспада ln 2/|k| =", math.log(2) / abs(k))\nprint("y(T) =", y(T))\n# по двум измерениям можно найти k: k = ln(y2 / y1) / (t2 − t1)\nt1, t2 = T / 4, T / 2\nprint("k по двум точкам:", math.log(y(t2) / y(t1)) / (t2 - t1))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаги 7–8. Решатель по шагам: разделение переменных и линейные уравнения
   * ============================================================================== */
  const SOLVE = {
    separable: [
      {
        lvl: 1, name: 'y′ = t·y, y(0) = 1', tex: R`y' = t\,y,\quad y(0) = 1`, f: (t, y) => t * y, t0: 0, y0: 1, view: [0, 2], exact: (t) => Math.exp((t * t) / 2), pyf: 't * y', pyex: 'math.exp(t**2 / 2)',
        steps: [
          ['Перепишем производную как дробь и разнесём переменные: всё с y — влево, всё с t — вправо.', R`\frac{dy}{dt} = t\,y \;\Rightarrow\; \frac{dy}{y} = t\,dt`],
          ['Проинтегрируем обе части. Константу пишем одну — справа.', R`\int\frac{dy}{y} = \int t\,dt \;\Rightarrow\; \ln|y| = \frac{t^2}{2} + c`],
          ['Экспоненцируем: |y| = eᶜ·e^(t²/2). Знак и множитель eᶜ собираем в одну константу C.', R`y = C\,e^{t^2/2}`],
          ['Начальное условие: y(0) = C = 1.', R`y = e^{t^2/2},\qquad y(2) = e^2 \approx 7.389`],
          ['Проверка подстановкой: производная равна t·y.', R`y' = t\,e^{t^2/2} = t\,y \;\checkmark`],
          ['Мы делили на y — потеряли решение y ≡ 0? Нет: оно получается при C = 0.', null],
        ],
      },
      {
        lvl: 1, name: 'y′ = y·cos t, y(0) = 1', tex: R`y' = y\cos t,\quad y(0) = 1`, f: (t, y) => y * Math.cos(t), t0: 0, y0: 1, view: [0, 4 * Math.PI], exact: (t) => Math.exp(Math.sin(t)), pyf: 'y * math.cos(t)', pyex: 'math.exp(math.sin(t))',
        steps: [
          ['Разделяем переменные.', R`\frac{dy}{y} = \cos t\,dt`],
          ['Интегрируем.', R`\ln|y| = \sin t + c`],
          ['Выражаем y и подставляем y(0) = 1: C = 1.', R`y = C e^{\sin t} = e^{\sin t}`],
          ['Смысл: скорость роста то положительна, то отрицательна, и решение колеблется между e⁻¹ ≈ 0.368 и e ≈ 2.718, никуда не уходя.', R`e^{-1} \le y(t) \le e`],
        ],
      },
      {
        lvl: 2, name: 'y′ = −t/y, y(0) = 2', tex: R`y' = -\frac{t}{y},\quad y(0) = 2`, f: (t, y) => -t / y, t0: 0, y0: 2, view: [0, 1.999], exact: (t) => Math.sqrt(Math.max(0, 4 - t * t)), pyf: '-t / y', pyex: 'math.sqrt(4 - t**2)',
        steps: [
          ['Разделяем: умножаем на y и на dt.', R`y\,dy = -t\,dt`],
          ['Интегрируем.', R`\frac{y^2}{2} = -\frac{t^2}{2} + c \;\Rightarrow\; t^2 + y^2 = C`],
          ['Решения — окружности! Из y(0) = 2: C = 4. Берём верхнюю половину (y > 0, как в начальном условии).', R`y = \sqrt{4 - t^2}`],
          ['Решение существует только при |t| < 2: в t = 2 касательная вертикальна (y = 0, наклон −t/y бесконечен), и продолжить его нельзя.', R`t \in (-2,\, 2)`],
        ],
      },
      {
        lvl: 2, name: 'y′ = y², y(0) = 1 — взрыв', tex: R`y' = y^2,\quad y(0) = 1`, f: (t, y) => y * y, t0: 0, y0: 1, view: [0, 0.95], exact: (t) => 1 / (1 - t), pyf: 'y**2', pyex: '1 / (1 - t)',
        steps: [
          ['Разделяем.', R`\frac{dy}{y^2} = dt`],
          ['Интегрируем: первообразная y⁻² равна −1/y.', R`-\frac{1}{y} = t + c`],
          ['Выражаем y; из y(0) = 1 получаем c = −1.', R`y = \frac{1}{1 - t}`],
          ['При t → 1 решение уходит в бесконечность. Правая часть y² гладкая и безобидная, а решение живёт лишь до t = 1 = 1/y(0). Чем больше старт, тем раньше взрыв.', R`\lim_{t\to 1^-} y(t) = +\infty`],
        ],
      },
      {
        lvl: 2, name: 'y′ = 1 + y², y(0) = 0 — тангенс', tex: R`y' = 1 + y^2,\quad y(0) = 0`, f: (t, y) => 1 + y * y, t0: 0, y0: 0, view: [0, 1.5], exact: Math.tan, pyf: '1 + y**2', pyex: 'math.tan(t)',
        steps: [
          ['Разделяем.', R`\frac{dy}{1 + y^2} = dt`],
          ['Первообразная 1/(1 + y²) — арктангенс (урок 15.9).', R`\operatorname{arctg} y = t + c`],
          ['y(0) = 0 даёт c = 0.', R`y = \operatorname{tg} t`],
          ['Взрыв в t = π/2 ≈ 1.571. Наклон всегда не меньше 1, а у больших y растёт как y² — этого хватает, чтобы уйти в бесконечность за конечное время.', R`t^* = \pi/2`],
        ],
      },
      {
        lvl: 3, name: 'y′ = 2√y, y(0) = 0 — решений много', tex: R`y' = 2\sqrt{y},\quad y(0) = 0`, f: (t, y) => 2 * Math.sqrt(Math.max(0, y)), t0: 0, y0: 0, view: [0, 2], exact: (t) => t * t, pyf: '2 * math.sqrt(max(y, 0.0))', pyex: 't**2',
        steps: [
          ['Разделяем — делим на √y, предполагая y > 0.', R`\frac{dy}{2\sqrt{y}} = dt`],
          ['Интегрируем: (√y)′ = 1/(2√y).', R`\sqrt{y} = t + c \;\Rightarrow\; y = (t + c)^2,\ t \ge -c`],
          ['y(0) = 0 даёт c = 0: y = t². Но при делении на √y мы потеряли y ≡ 0 — оно тоже решение!', R`y = t^2 \quad\text{и}\quad y \equiv 0`],
          ['Более того, можно «посидеть» в нуле до любого момента a и потом взлететь: y = (t − a)² при t ≥ a. Решений бесконечно много. Причина — у √y бесконечная производная в нуле (шаг 9). Численный метод из y = 0 выберет y ≡ 0: наклон в нуле равен 0.', R`y = \begin{cases}0, & t \le a\\ (t - a)^2, & t > a\end{cases}`],
        ],
      },
    ],
    linear: [
      {
        lvl: 1, name: 'y′ + y = 1, y(0) = 0', tex: R`y' + y = 1,\quad y(0) = 0`, f: (t, y) => 1 - y, t0: 0, y0: 0, view: [0, 5], exact: (t) => 1 - Math.exp(-t), pyf: '1 - y', pyex: '1 - math.exp(-t)',
        steps: [
          ['Интегрирующий множитель: μ = e^(∫p dt), здесь p = 1, μ = eᵗ. Умножаем уравнение на μ.', R`e^t y' + e^t y = e^t`],
          ['Слева — производная произведения (правило из урока 15.6).', R`(e^t y)' = e^t`],
          ['Интегрируем обе части.', R`e^t y = e^t + C \;\Rightarrow\; y = 1 + C e^{-t}`],
          ['y(0) = 0 ⇒ C = −1. Это подход к равновесию 1 из шага 3 (a = b = 1).', R`y = 1 - e^{-t}`],
        ],
      },
      {
        lvl: 1, name: 'y′ + y = t, y(0) = 0', tex: R`y' + y = t,\quad y(0) = 0`, f: (t, y) => t - y, t0: 0, y0: 0, view: [0, 5], exact: (t) => t - 1 + Math.exp(-t), pyf: 't - y', pyex: 't - 1 + math.exp(-t)',
        steps: [
          ['μ = eᵗ, умножаем и сворачиваем левую часть.', R`(e^t y)' = t\,e^t`],
          ['Интегрируем по частям: ∫t eᵗ dt = (t − 1)eᵗ.', R`e^t y = (t - 1)e^t + C`],
          ['Делим на eᵗ.', R`y = t - 1 + C e^{-t}`],
          ['y(0) = 0 ⇒ C = 1. Видна структура: частное решение t − 1 плюс затухающая добавка — решение однородного уравнения y′ + y = 0.', R`y = t - 1 + e^{-t},\qquad y(2) \approx 1.1353`],
        ],
      },
      {
        lvl: 2, name: 'y′ + 2y = e⁻ᵗ, y(0) = 0', tex: R`y' + 2y = e^{-t},\quad y(0) = 0`, f: (t, y) => Math.exp(-t) - 2 * y, t0: 0, y0: 0, view: [0, 5], exact: (t) => Math.exp(-t) - Math.exp(-2 * t), pyf: 'math.exp(-t) - 2 * y', pyex: 'math.exp(-t) - math.exp(-2 * t)',
        steps: [
          ['μ = e²ᵗ.', R`(e^{2t} y)' = e^{2t} e^{-t} = e^{t}`],
          ['Интегрируем.', R`e^{2t} y = e^{t} + C`],
          ['Делим и подставляем y(0) = 0: C = −1.', R`y = e^{-t} - e^{-2t}`],
          ['Так меняется концентрация лекарства, принятого таблеткой: всасывание (e⁻ᵗ) против выведения (e⁻²ᵗ). Максимум, где y′ = 0: t = ln 2 ≈ 0.693, y = ¼.', R`y_{\max} = y(\ln 2) = \tfrac14`],
        ],
      },
      {
        lvl: 2, name: 'y′ + y/t = 1, y(1) = 1', tex: R`y' + \frac{y}{t} = 1,\quad y(1) = 1,\ t > 0`, f: (t, y) => 1 - y / t, t0: 1, y0: 1, view: [0.2, 4], exact: (t) => t / 2 + 1 / (2 * t), pyf: '1 - y / t', pyex: 't / 2 + 1 / (2 * t)',
        steps: [
          ['Коэффициент зависит от t: p = 1/t, μ = e^(ln t) = t.', R`t\,y' + y = t \;\Rightarrow\; (t\,y)' = t`],
          ['Интегрируем.', R`t\,y = \frac{t^2}{2} + C`],
          ['y(1) = 1 ⇒ C = ½.', R`y = \frac{t}{2} + \frac{1}{2t}`],
          ['Минимум при t = 1: y = 1. Решение задано начальным условием в t = 1, а не в нуле: при t → 0 оно уходит в бесконечность, потому что там p = 1/t не определён.', null],
        ],
      },
      {
        lvl: 3, name: 'y′ + 0.5y = sin t: переходный процесс', tex: R`y' + \tfrac12 y = \sin t,\quad y(0) = 0`, f: (t, y) => Math.sin(t) - 0.5 * y, t0: 0, y0: 0, view: [0, 20], exact: (t) => 0.4 * Math.sin(t) - 0.8 * Math.cos(t) + 0.8 * Math.exp(-t / 2), pyf: 'math.sin(t) - 0.5 * y', pyex: '0.4 * math.sin(t) - 0.8 * math.cos(t) + 0.8 * math.exp(-t / 2)',
        steps: [
          ['Частное решение ищем в виде колебания той же частоты: y_p = A·sin t + B·cos t.', R`y_p' + \tfrac12 y_p = (\tfrac12 A - B)\sin t + (A + \tfrac12 B)\cos t`],
          ['Приравниваем коэффициенты к sin t: ½A − B = 1, A + ½B = 0.', R`A = 0.4,\quad B = -0.8`],
          ['Общее решение = частное + общее однородного (C·e^(−t/2)).', R`y = 0.4\sin t - 0.8\cos t + C e^{-t/2}`],
          ['y(0) = 0 ⇒ C = 0.8. Переходная часть 0.8·e^(−t/2) затухает, остаётся установившееся колебание с амплитудой √(0.4² + 0.8²) ≈ 0.894 < 2 и запаздыванием: уравнение сглаживает вход (шаг 8).', R`y = \underbrace{0.4\sin t - 0.8\cos t}_{\text{установившееся}} + \underbrace{0.8\,e^{-t/2}}_{\text{переходное}}`],
        ],
      },
    ],
  };
  GBC.widget('ode-solver', (el, cfg) => {
    const set = SOLVE[cfg.set] || SOLVE.separable;
    const s = { i: 0, k: set[0].steps.length };
    const w = ui.shell(el, { title: cfg.set === 'linear' ? 'Решатель по шагам: интегрирующий множитель' : 'Решатель по шагам: разделение переменных', sub: 'Выберите пример (★ — простой, ★★★ — с подвохом). Нажимайте «шаг вперёд» или ▶: каждое преобразование появляется с пояснением. На графике ответ проверяется: формула (линия) против численного решения Рунге — Кутты (точки), которое ничего не знает о формуле.' });
    ui.select(w.controls, { label: 'Пример', value: '0', options: set.map((X, i) => ({ value: String(i), label: STARS[X.lvl] + ' ' + X.name })), onChange: (v) => {
      s.i = +v;
      player.setMax(set[s.i].steps.length);
      player.set(1);
      s.k = 1;
      draw();
    } });
    const player = ui.player(w.controls, { label: 'Шаг решения', min: 0, max: set[0].steps.length, value: s.k, fps: 0.8, format: (k, m) => 'шаг ' + k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const prob = card('Задача');
    w.main.appendChild(prob.el);
    const probTex = H('div');
    prob.body.appendChild(probTex);
    const list = H('ol', { style: 'margin:8px 0 0;padding-left:1.4em;display:grid;gap:6px' });
    prob.body.appendChild(list);
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 't' }, y: { label: 'y(t)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't', label: 'точка проверки t' }, { key: 'F', label: 'по формуле' }, { key: 'N', label: 'численно (РК4)' }, { key: 'd', label: 'расхождение' }]);
    function draw() {
      const X = set[s.i];
      texInto(probTex, X.tex, true);
      stepList(list, X.steps, s.k);
      const [a, b] = X.view;
      const ts = U.linspace(a, b, 400);
      const ex = ts.map(X.exact);
      const fw = X.t0 < b ? solveODE(X.f, X.t0, X.y0, b, 400, 'rk4', 1e6) : { ts: [], ys: [] };
      const bw = X.t0 > a ? solveODE(X.f, X.t0, X.y0, a, 200, 'rk4', 1e6) : { ts: [], ys: [] };
      const nts = bw.ts.slice().reverse().concat(fw.ts.slice(1));
      const nys = bw.ys.slice().reverse().concat(fw.ys.slice(1));
      const pick = nts.map((_, i) => i).filter((i) => i % 20 === 0);
      const layers = [
        { type: 'line', x: ts, y: ex, color: 'model', width: 2.6, label: 'формула', hover: false },
        { type: 'points', x: pick.map((i) => nts[i]), y: pick.map((i) => nys[i]), color: 'tree', r: 3.8, label: 'численно (Рунге — Кутта)', tooltip: (j) => [['t', f3(nts[pick[j]])], ['численно', f6(nys[pick[j]])], ['формула', f6(X.exact(nts[pick[j]]))]] },
        { type: 'points', x: [X.t0], y: [X.y0], color: 'ink', r: 5, hollow: true },
      ];
      if (cfg.set !== 'linear' && s.i === 5) layers.push({ type: 'line', x: ts, y: ts.map(() => 0), color: 'violet', width: 2.2, dash: '6 4', label: 'y ≡ 0 — тоже решение', hover: false });
      plot.render(layers, { x: [a, b], y: yDom(ex.concat([X.y0]), 0.08) });
      const tq = nts[nts.length - 1];
      const num = nys[nys.length - 1];
      const fx = X.exact(tq);
      st.set('t', f3(tq));
      st.set('F', f6(fx));
      st.set('N', f6(num));
      st.set('d', sci(Math.abs(num - fx)));
      const fin = s.k >= X.steps.length;
      note.innerHTML = fin
        ? (cfg.set !== 'linear' && s.i === 5 ? 'Численный метод из y(0) = 0 честно остался в нуле — это тоже решение, просто другое. Формула y = t² и численный ответ расходятся не из-за ошибки, а потому что решение не единственно.' : 'Готово. Формула и численное решение совпадают с точностью ' + sci(Math.abs(num - fx)) + ': ответ верен. Любой найденный ответ проверяется подстановкой в уравнение или численным решением.')
        : s.k === 0 ? 'Нажмите «шаг вперёд». Сначала попробуйте сами: как отделить y от t?' : 'Шаг ' + s.k + ' из ' + X.steps.length + '. Догадайтесь, каким будет следующее преобразование.';
    }
    w.pythonAction(() => {
      const X = set[s.i];
      return 'import math\n\nf = lambda t, y: ' + X.pyf + '\nexact = lambda t: ' + X.pyex + '     # найденная формула\n\n# численное решение Рунге — Куттой от t0 = ' + py(X.t0) + ' до t1 = ' + py(X.view[1]) + '\nt, y, n = ' + py(X.t0) + ', ' + py(X.y0) + ', 4000\nh = (' + py(X.view[1]) + ' - t) / n\nfor _ in range(n):\n    k1 = f(t, y); k2 = f(t + h / 2, y + h / 2 * k1); k3 = f(t + h / 2, y + h / 2 * k2); k4 = f(t + h, y + h * k3)\n    y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6\n    t += h\nprint("численно:", y, "  формула:", exact(t))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 8. Охлаждение при колеблющейся температуре: фильтр низких частот
   * ============================================================================== */
  GBC.widget('forced-cooling', (el) => {
    const s = { k: 0.2, P: 24, T0: 26, split: false };
    const A = 20;
    const B = 5;
    const DAYS = 4;
    const w = ui.shell(el, { title: 'Дом в жару и холод: T′ = −k·(T − T_out(t))', sub: 'Снаружи температура колеблется вокруг 20 °C на ±5 °C. Дом догоняет её с «медлительностью» 1/k: скорость изменения температуры в доме пропорциональна разнице с улицей. Чем лучше теплоизоляция (меньше k), тем слабее и позже отзываются стены.' });
    ui.slider(w.controls, { label: 'Теплообмен k, 1/ч', min: 0.02, max: 2, log: true, value: s.k, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.k = v), draw()) });
    ui.slider(w.controls, { label: 'Период колебаний снаружи, ч', values: [6, 12, 24, 48], value: s.P, format: (v) => v + ' ч', onInput: (v) => ((s.P = v), draw()) });
    ui.slider(w.controls, { label: 'Начальная температура дома, °C', min: 10, max: 30, step: 1, value: s.T0, format: (v) => v + ' °C', onInput: (v) => ((s.T0 = v), draw()) });
    ui.toggle(w.controls, { label: 'Разложить: установившееся + переходное', checked: s.split, onChange: (v) => ((s.split = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 310, x: { label: 'время t, ч', domain: [0, 96] }, y: { label: 'температура, °C' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'амплитуда дома / улицы' }, { key: 'l', label: 'запаздывание пика' }, { key: 'tau', label: 'переходный процесс 1/k' }]);
    function draw() {
      const k = s.k;
      const om = (2 * Math.PI) / s.P;
      const out = (t) => A + B * Math.sin(om * (t - 0));
      // установившееся решение: A + B·k/√(k²+ω²)·sin(ωt − φ), φ = arctg(ω/k)
      const g = k / Math.sqrt(k * k + om * om);
      const phi = Math.atan(om / k);
      const ss = (t) => A + B * g * Math.sin(om * t - phi);
      const C = s.T0 - ss(0);
      const T = (t) => ss(t) + C * Math.exp(-k * t);
      const ts = U.linspace(0, DAYS * 24, 600);
      const layers = [
        { type: 'line', x: ts, y: ts.map(out), color: 'muted', width: 1.8, dash: '6 4', label: 'улица', hover: false },
        { type: 'line', x: ts, y: ts.map(T), color: 'model', width: 2.6, label: 'дом T(t)', hover: false },
      ];
      if (s.split) {
        layers.push({ type: 'line', x: ts, y: ts.map(ss), color: 'aqua', width: 1.8, label: 'установившееся', hover: false });
        layers.push({ type: 'line', x: ts, y: ts.map((t) => A + C * Math.exp(-k * t)), color: 'tree', width: 1.6, dash: '3 3', label: '20 + переходное C·e^{−kt}', hover: false });
      }
      // пик улицы на последних сутках и отстающий от него пик дома
      const lag = phi / om;
      const peakOut = Math.max(0, Math.floor((DAYS * 24 - s.P / 4 - lag) / s.P)) * s.P + s.P / 4;
      layers.push({ type: 'points', x: [peakOut, peakOut + lag], y: [out(peakOut), ss(peakOut + lag)], color: (i) => (i ? 'model' : 'ink2'), legendColor: 'ink2', r: 5, tooltip: (i) => [[i ? 'пик дома' : 'пик улицы', f2(i ? peakOut + lag : peakOut) + ' ч']] });
      plot.render(layers, { x: [0, DAYS * 24], y: yDom([A - B, A + B, s.T0], 0.08) });
      st.set('a', f3(g) + ' (±' + f2(B * g) + ' °C)');
      st.set('l', f2(lag) + ' ч');
      st.set('tau', f2(1 / k) + ' ч');
      note.innerHTML = 'Решение = <b>установившееся колебание</b> (то же, что у улицы, но слабее в k/√(k² + ω²) раз и позже на arctg(ω/k)/ω) + <b>переходная часть</b> C·e<sup>−kt</sup>, которая забывает начальную температуру. При k = 0.2 и суточном периоде дом колеблется с амплитудой 0.607 от уличной и отстаёт на 3.51 ч; при k = 0.05 (хорошая изоляция) — 0.188 и 5.28 ч. Быстрые колебания гасятся сильнее медленных: уравнение работает как <b>фильтр низких частот</b>. Его дискретный двойник — экспоненциальное среднее (EMA) из урока 15.10: m ← m + (1 − β)(x − m) — это шаг Эйлера для этого же уравнения.';
    }
    w.pythonAction(() => 'import math\nimport numpy as np\n\nk, P, T0 = ' + py(s.k) + ', ' + py(s.P) + ', ' + py(s.T0) + '\nw = 2 * math.pi / P\nout = lambda t: 20 + 5 * math.sin(w * t)\n\n# численно (Рунге — Кутта) на 10 периодов\nf = lambda t, T: -k * (T - out(t))\nt, T, h = 0.0, T0, P / 2000\nts, Ts = [], []\nfor _ in range(20000):\n    k1 = f(t, T); k2 = f(t + h / 2, T + h / 2 * k1); k3 = f(t + h / 2, T + h / 2 * k2); k4 = f(t + h, T + h * k3)\n    T += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6\n    t += h\n    ts.append(t); Ts.append(T)\nlast = np.array(Ts[-2000:])                    # последний период\nprint("амплитуда дома / улицы: численно", (last.max() - last.min()) / 2 / 5, " формула", k / math.hypot(k, w))\nlag = (ts[-2000 + int(np.argmax(last))] % P) - P / 4\nprint("запаздывание пика, ч:  численно", round(lag % P, 3), " формула", round(math.atan(w / k) / w, 3))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 9. Существование и единственность
   * ============================================================================== */
  GBC.widget('uniqueness-lab', (el) => {
    const s = { mode: 'bucket', p: 1, tobs: 25 };
    const w = ui.shell(el, { title: 'Когда решение одно, а когда — нет', sub: 'Теорема существования и единственности требует, чтобы правая часть f(t, y) менялась по y не слишком резко. Три опыта: ведро, из которого вытекает вода (единственность нарушается), и два уравнения, решения которых взрываются за конечное время.' });
    ui.segmented(w.controls, { label: 'Опыт', value: s.mode, options: [{ value: 'bucket', label: 'Ведро' }, { value: 'sq', label: 'y′ = y²' }, { value: 'tan', label: 'y′ = 1 + y²' }], onChange: (v) => ((s.mode = v), build(), draw()) });
    const ctl = H('div');
    w.controls.appendChild(ctl);
    function build() {
      ctl.textContent = '';
      if (s.mode === 'bucket') ui.slider(ctl, { label: 'Момент наблюдения t, мин', min: 0, max: 30, step: 0.5, value: s.tobs, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.tobs = v), draw()) });
      else ui.slider(ctl, { label: 'Начальное значение y(0)', min: 0.25, max: 3, step: 0.05, value: s.p, format: f2, onInput: (v) => ((s.p = v), draw()) });
    }
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 't' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '' }, { key: 'b', label: '' }]);
    const stLabels = w.foot.querySelectorAll('.stat .k');
    function setLabels(a, b) {
      stLabels[0].textContent = a;
      stLabels[1].textContent = b;
    }
    function draw() {
      if (s.mode === 'bucket') {
        // h′ = −c√h, c = 0.1: h(t) = (c/2)²(a − t)² до момента опустошения a
        const c = 0.1;
        const ts = U.linspace(0, 30, 400);
        const empties = [4, 8, 12, 16, 20];
        const layers = [];
        empties.forEach((a, i) => {
          const hv = ts.map((t) => (t < a ? Math.pow((c / 2) * (a - t), 2) : 0));
          layers.push({ type: 'line', x: ts, y: hv, color: GBC.colors.series(i), width: 2.2, label: 'пусто с ' + a + ' мин', hover: false });
        });
        layers.push({ type: 'vline', x: s.tobs, color: 'ink2', dash: '3 3', width: 1.2, text: 'смотрим' });
        plot.opts.x.label = 'время t, мин';
        plot.opts.y.label = 'уровень воды h, м';
        plot.render(layers, { x: [0, 30], y: [-0.03, 1.1] });
        const alive = empties.filter((a) => a > s.tobs);
        setLabels('вёдер ещё с водой', 'вёдер уже пустых');
        st.set('a', String(alive.length));
        st.set('b', String(empties.length - alive.length));
        note.innerHTML = 'Закон Торричелли: вода вытекает со скоростью ∝ √h, поэтому h′ = −c√h. Пять вёдер, налитых по-разному: каждое пустеет за конечное время 2√h₀/c (из полного, h₀ = 1 м, — за 20 мин). <b>Вперёд</b> всё однозначно: по уровню воды сейчас будущее восстанавливается единственным образом. <b>Назад</b> — нет: глядя на пустое ведро в момент ' + U.fmt(s.tobs, 1) + ' мин, нельзя сказать, когда оно опустело — ' + (empties.length - alive.length) + ' ' + plural(empties.length - alive.length, 'решение проходит', 'решения проходят', 'решений проходят') + ' через одну и ту же точку h = 0. Виновата функция √h: в нуле её производная бесконечна, условие теоремы нарушено.';
        return;
      }
      const y0 = s.p;
      const tan = s.mode === 'tan';
      const tStar = tan ? Math.PI / 2 - Math.atan(y0) : 1 / y0;
      const exact = (t) => (tan ? Math.tan(t + Math.atan(y0)) : y0 / (1 - y0 * t));
      const T = 4.5;
      const ts = U.linspace(0, Math.min(T, tStar * 0.999), 400);
      const layers = [{ type: 'vline', x: tStar, color: 'critical', dash: '5 4', width: 1.4, text: 't* = ' + f3(tStar) }];
      [0.5, 1, 2].forEach((q, i) => {
        const yq = y0 * q;
        if (Math.abs(yq - y0) < 1e-9) return;
        const tq = tan ? Math.PI / 2 - Math.atan(yq) : 1 / yq;
        const tt = U.linspace(0, Math.min(T, tq * 0.999), 300);
        const ex = (t) => (tan ? Math.tan(t + Math.atan(yq)) : yq / (1 - yq * t));
        layers.push({ type: 'line', x: tt, y: clampArr(tt.map(ex), -1, 25), color: 'muted', width: 1.2, opacity: 0.7, hover: false, label: i === 0 ? 'другие старты' : undefined });
      });
      layers.push({ type: 'line', x: ts, y: clampArr(ts.map(exact), -1, 25), color: 'model', width: 2.6, label: tan ? 'y = tg(t + arctg y₀)' : 'y = y₀/(1 − y₀t)', hover: false });
      const nm = solveODE((t, y) => (tan ? 1 + y * y : y * y), 0, y0, T, 90, 'rk4', 1e9);
      layers.push({ type: 'points', x: nm.ts, y: clampArr(nm.ys, -1, 25), color: 'tree', r: 3, label: 'РК4, шаг 0.05' });
      plot.opts.x.label = 't';
      plot.opts.y.label = 'y';
      plot.render(layers, { x: [0, T], y: [-0.5, 20] });
      setLabels('момент взрыва t*', 'y(t* − 0.01)');
      st.set('a', f4(tStar));
      st.set('b', f2(exact(tStar - 0.01)));
      note.innerHTML = (tan ? 'Правая часть 1 + y² ≥ 1 гладкая, но решение tg(t + arctg y₀) уходит в бесконечность при t* = π/2 − arctg y₀ = ' + f3(tStar) + '.' : 'Решение y = y₀/(1 − y₀t) живёт только до t* = 1/y₀ = ' + f3(tStar) + ': чем больше старт, тем раньше взрыв.') + ' Теорема гарантирует решение лишь <b>на каком-то</b> отрезке около начальной точки. Численный метод с постоянным шагом взрыва «не замечает» и выдаёт огромные числа (оранжевые точки уходят за край) — всегда проверяйте, не уходит ли решение в бесконечность.';
    }
    w.pythonAction(() => {
      if (s.mode === 'bucket') return 'import math\n\nc = 0.1                                   # h′ = −c·√h\nfor a in [4, 8, 12, 16, 20]:              # момент, когда ведро опустело\n    h = lambda t, a=a: (c / 2 * (a - t)) ** 2 if t < a else 0.0\n    # проверка: производная равна −c√h\n    t = a / 2\n    d = (h(t + 1e-6) - h(t - 1e-6)) / 2e-6\n    print(f"пусто с {a:2d} мин: h(0) = {h(0):.3f}, h′(t) = {d:.5f}, −c√h = {-c * math.sqrt(h(t)):.5f}, h(25) = {h(25)}")\n';
      return 'import math\n\ny0 = ' + py(s.p) + '\nf = lambda y: ' + (s.mode === 'tan' ? '1 + y**2' : 'y**2') + '\nt_star = ' + (s.mode === 'tan' ? 'math.pi / 2 - math.atan(y0)' : '1 / y0') + '\nprint("взрыв в t* =", t_star)\nt, y, h = 0.0, y0, 0.05\nwhile t < 4.5:\n    k1 = f(y); k2 = f(y + h / 2 * k1); k3 = f(y + h / 2 * k2); k4 = f(y + h * k3)\n    y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6\n    t += h\n    if abs(y) > 1e9:\n        print(f"РК4: |y| > 1e9 около t = {t:.2f}"); break\n';
    });
    build();
    draw();
  });

  /* ==============================================================================
   * Шаг 10. Итерации Пикара
   * ============================================================================== */
  const PIC = {
    exp: { label: 'y′ = y, y(0) = 1 на [0, 2]', f: (t, y) => y, y0: 1, T: 2, exact: Math.exp, pyf: 'y', pyex: 'np.exp(t)' },
    gauss: { label: 'y′ = −2t·y, y(0) = 1 на [0, 2]', f: (t, y) => -2 * t * y, y0: 1, T: 2, exact: (t) => Math.exp(-t * t), pyf: '-2 * t * y', pyex: 'np.exp(-t**2)' },
    tan: { label: 'y′ = 1 + y², y(0) = 0 на [0, 1.4]', f: (t, y) => 1 + y * y, y0: 0, T: 1.4, exact: Math.tan, pyf: '1 + y**2', pyex: 'np.tan(t)' },
  };
  GBC.widget('picard', (el) => {
    const s = { key: 'exp', n: 3 };
    const NMAX = 10;
    const w = ui.shell(el, { title: 'Итерации Пикара: решение как предел', sub: 'Уравнение y′ = f(t, y) с y(0) = y₀ равносильно интегральному: y(t) = y₀ + ∫₀ᵗ f(s, y(s)) ds. Подставим в правую часть грубую догадку y₀(t) ≡ y₀ — получим новую функцию; подставим её — ещё одну… Нажмите ▶.' });
    ui.select(w.controls, { label: 'Уравнение', value: s.key, options: Object.entries(PIC).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.player(w.controls, { label: 'Итерация n', min: 0, max: NMAX, value: s.n, fps: 1.2, format: (v) => 'n = ' + v, onChange: (v) => ((s.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 't' }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 190, x: { label: 'итерация n' }, y: { label: 'max ошибка (лог.)', type: 'log' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'max |yₙ − y| на отрезке' }, { key: 'r', label: 'во сколько раз меньше прошлой' }]);
    const cache = {};
    function iterates(key) {
      if (cache[key]) return cache[key];
      const P = PIC[key];
      const ts = U.linspace(0, P.T, 801);
      const out = [ts.map(() => P.y0)];
      for (let n = 1; n <= NMAX; n++) {
        const prev = out[n - 1];
        const g = ts.map((t, i) => P.f(t, prev[i]));
        const y = [P.y0];
        for (let i = 1; i < ts.length; i++) y.push(y[i - 1] + ((g[i] + g[i - 1]) / 2) * (ts[i] - ts[i - 1]));
        out.push(y);
      }
      const ex = ts.map(P.exact);
      const err = out.map((y) => Math.max(...y.map((v, i) => Math.abs(v - ex[i]))));
      return (cache[key] = { ts, out, ex, err });
    }
    function draw() {
      const P = PIC[s.key];
      const I = iterates(s.key);
      const layers = [{ type: 'line', x: I.ts, y: I.ex, color: 'ink', width: 2, dash: '6 4', label: 'точное решение', hover: false }];
      for (let n = 0; n < s.n; n++) layers.push({ type: 'line', x: I.ts, y: I.out[n], color: 'model', width: 1.1, opacity: 0.25 + (0.35 * n) / Math.max(1, s.n), hover: false });
      layers.push({ type: 'line', x: I.ts, y: I.out[s.n], color: 'tree', width: 2.6, label: 'итерация yₙ', hover: false });
      plot.render(layers, { x: [0, P.T], y: yDom(I.ex.concat([P.y0]), 0.08) });
      const ns = U.range(NMAX + 1);
      const la = logAxis(Math.max(1e-12, Math.min(...I.err.filter((v) => v > 0))), Math.max(...I.err));
      p2.opts.y.ticks = la.ticks;
      p2.opts.y.format = powFmt;
      p2.render([
        { type: 'line', x: ns, y: I.err.map((v) => Math.max(v, 1e-12)), color: 'model', width: 1.6, hover: false },
        { type: 'points', x: ns, y: I.err.map((v) => Math.max(v, 1e-12)), color: (i) => (i === s.n ? 'tree' : 'model'), legendColor: 'model', r: (i) => (i === s.n ? 6 : 3.5), tooltip: (i) => [['n', String(i)], ['ошибка', sci(I.err[i])]] },
      ], { x: [-0.3, NMAX + 0.3], y: la.domain });
      st.set('e', sci(I.err[s.n]));
      st.set('r', s.n > 0 ? f2(I.err[s.n - 1] / Math.max(I.err[s.n], 1e-300)) : '—');
      const msg = {
        exp: 'Для y′ = y итерации — это частичные суммы ряда Тейлора: y₁ = 1 + t, y₂ = 1 + t + t²/2, y₃ = … + t³/6. Пикар строит eᵗ тем же рядом, что и урок 15.10! Ошибка падает как tⁿ⁺¹/(n + 1)!: в точке t = 1 после n = 1, 2, 3, 4 итераций — 0.718, 0.218, 0.052, 0.0099.',
        gauss: 'Решение e^(−t²) строится чередованием «перелётов» и «недолётов»: итерации — частичные суммы знакочередующегося ряда 1 − t² + t⁴/2 − … Вдали от нуля сходимость медленнее: факториал в знаменателе должен «перебороть» t²ⁿ.',
        tan: 'Для tg t итерации сходятся только на небольшом отрезке: около t = π/2 решение взрывается, и последовательные приближения не успевают за ним. Теорема Пикара гарантирует сходимость лишь на достаточно коротком отрезке.',
      };
      note.innerHTML = msg[s.key] + ' Каждая итерация — <b>интеграл</b> от предыдущей, поэтому ошибка быстро сглаживается. Именно так доказывают, что решение существует: последовательность yₙ сходится, и её предел удовлетворяет уравнению.';
    }
    w.pythonAction(() => {
      const P = PIC[s.key];
      return 'import numpy as np\n\nf = lambda t, y: ' + P.pyf + '\nt = np.linspace(0, ' + py(P.T) + ', 801)\nexact = ' + P.pyex + '\n\ny = np.full_like(t, ' + py(P.y0) + ')                  # нулевое приближение: константа\nfor n in range(1, ' + (s.n + 1) + '):\n    g = f(t, y)\n    # y_new(t) = y0 + ∫₀ᵗ f(s, y(s)) ds — метод трапеций\n    y = ' + py(P.y0) + ' + np.concatenate([[0], np.cumsum((g[1:] + g[:-1]) / 2 * np.diff(t))])\n    print(f"итерация {n}: max ошибка {np.max(np.abs(y - exact)):.3e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 11. Логистический рост: сигмоида как решение
   * ============================================================================== */
  GBC.widget('logistic-growth', (el) => {
    const s = { r: 1, K: 1, y0: 0.01, logit: false };
    const w = ui.shell(el, { title: 'Логистический рост: откуда берётся сигмоида', sub: 'y′ = r·y·(1 − y/K): рост пропорционален размеру, но тормозится у потолка K. Сверху — решение, снизу — скорость роста как функция y (фазовая прямая из шага 5). Переключите логит-шкалу: S-кривая станет прямой.' });
    ui.slider(w.controls, { label: 'Скорость r', min: 0.3, max: 3, step: 0.1, value: s.r, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.r = v), draw()) });
    ui.slider(w.controls, { label: 'Потолок K', min: 0.5, max: 2, step: 0.1, value: s.K, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.K = v), draw()) });
    ui.slider(w.controls, { label: 'Старт y₀', min: 0.005, max: 1.9, log: true, value: s.y0, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.y0 = v), draw()) });
    ui.toggle(w.controls, { label: 'Логит-шкала: ln(y/(K − y))', checked: s.logit, onChange: (v) => ((s.logit = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 270, x: { label: 't', domain: [0, 12] }, y: { label: 'y(t)' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'y' }, y: { label: 'скорость y′' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't', label: 'время до K/2 (перегиб)' }, { key: 'm', label: 'макс. скорость rK/4' }, { key: 'e', label: 'формула vs РК4' }]);
    function draw() {
      const { r, K, y0 } = s;
      const y0c = Math.min(y0, 1.95);
      const f = (t, y) => r * y * (1 - y / K);
      const num = solveODE(f, 0, y0c, 12, 240, 'rk4');
      const exact = (t) => K / (1 + ((K - y0c) / y0c) * Math.exp(-r * t));
      const ts = U.linspace(0, 12, 300);
      const tHalf = y0c < K / 2 ? Math.log((K - y0c) / y0c) / r : NaN;
      const pick = num.ts.map((_, i) => i).filter((i) => i % 12 === 0);
      if (s.logit && y0c < K) {
        const lg = (y) => Math.log(y / (K - y));
        p1.opts.y.label = 'логит ln(y/(K − y))';
        p1.render([
          { type: 'hline', y: 0, color: 'ink2', dash: '4 4', text: 'y = K/2' },
          { type: 'line', x: ts, y: ts.map((t) => lg(exact(t))), color: 'model', width: 2.6, label: 'ln(y₀/(K − y₀)) + r·t — прямая', hover: false },
          { type: 'points', x: pick.map((i) => num.ts[i]), y: pick.map((i) => lg(num.ys[i])), color: 'tree', r: 3.5, label: 'численное решение' },
        ], { x: [0, 12], y: yDom(ts.map((t) => lg(exact(t))), 0.06) });
      } else {
        p1.opts.y.label = 'y(t)';
        p1.render([
          { type: 'hline', y: K, color: 'ink2', dash: '4 4', text: 'потолок K' },
          { type: 'line', x: ts, y: ts.map(exact), color: 'model', width: 2.6, label: 'формула K/(1 + C·e^{−rt})', hover: false },
          { type: 'points', x: pick.map((i) => num.ts[i]), y: pick.map((i) => num.ys[i]), color: 'tree', r: 3.5, label: 'численное решение (Рунге — Кутта)' },
          Number.isFinite(tHalf) && tHalf < 12 ? { type: 'points', x: [tHalf], y: [K / 2], color: 'ink', r: 6, hollow: true, label: 'перегиб y = K/2' } : null,
        ], { x: [0, 12], y: [0, Math.max(2.1, y0c * 1.05)] });
      }
      const yy = U.linspace(0, 2.1, 200);
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: yy, y: yy.map((y) => f(0, y)), color: 'tree', width: 2.4, hover: false },
        { type: 'points', x: [0, K], y: [0, 0], color: 'model', r: 6, hollow: true, label: 'равновесия 0 и K' },
        { type: 'points', x: [Math.min(y0c, 2.1)], y: [f(0, y0c)], color: 'tree', r: 5, label: 'старт' },
        { type: 'vline', x: K / 2, color: 'ink2', dash: '3 3', width: 1, text: 'K/2' },
      ], { x: [0, 2.1], y: yDom(yy.map((y) => f(0, y)).concat([0]), 0.1) });
      const err = Math.max(...num.ys.map((v, i) => Math.abs(v - exact(num.ts[i]))));
      st.set('t', Number.isFinite(tHalf) ? f3(tHalf) : '— (старт выше K/2)');
      st.set('m', f3((r * K) / 4) + ' при y = ' + f2(K / 2));
      st.set('e', sci(err));
      note.innerHTML = 'При r = K = 1 решение — это <b>сигмоида</b> σ(t − t₀): уравнение y′ = y(1 − y) — то самое свойство σ′ = σ(1 − σ) из урока 15.6. Снизу видно почему S-образно: скорость роста — парабола с максимумом при y = K/2 (точка перегиба) и нулями в равновесиях 0 и K. В логит-шкале решение — <b>прямая</b> с наклоном r: логарифм шансов ln(y/(K − y)) растёт линейно — ровно так логистическая регрессия связывает признаки с вероятностью. Со старта 0.01 половина потолка достигается за ln 99 / r = ' + f3(Math.log(99) / r) + '.';
    }
    w.pythonAction(() => 'import math\nimport numpy as np\n\nr, K, y0 = ' + py(s.r) + ', ' + py(s.K) + ', ' + py(Math.min(s.y0, 1.95)) + '\nf = lambda t, y: r * y * (1 - y / K)\nexact = lambda t: K / (1 + (K - y0) / y0 * math.exp(-r * t))\n\nt, y, h = 0.0, y0, 0.05\nerr = 0.0\nfor _ in range(240):\n    k1 = f(t, y); k2 = f(t + h / 2, y + h / 2 * k1); k3 = f(t + h / 2, y + h / 2 * k2); k4 = f(t + h, y + h * k3)\n    y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6\n    t += h\n    err = max(err, abs(y - exact(t)))\nprint("РК4 против формулы: max расхождение", err)\nif y0 < K / 2:\n    print("время до K/2:", math.log((K - y0) / y0) / r)\n# логит растёт линейно: ln(y/(K − y)) = ln(y0/(K − y0)) + r·t\nfor tt in (0, 2, 4):\n    yt = exact(tt)\n    print(tt, math.log(yt / (K - yt)))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 12. Вылов и бифуркация: y′ = y(1 − y) − H
   * ============================================================================== */
  GBC.widget('harvest-bifurcation', (el) => {
    const s = { H: 0.2, y0: 0.9 };
    const w = ui.shell(el, { title: 'Вылов рыбы: y′ = y(1 − y) − H', sub: 'Популяция растёт логистически (K = 1), а рыбаки каждый год вылавливают H. Двигайте квоту H: два равновесия сближаются, сливаются при H = 1/4 и исчезают — популяция обваливается. Снизу — бифуркационная диаграмма: равновесия как функция H.' });
    ui.slider(w.controls, { label: 'Квота вылова H', min: 0, max: 0.35, step: 0.005, value: s.H, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.H = v), draw()) });
    ui.slider(w.controls, { label: 'Начальная популяция y(0)', min: 0.05, max: 1.2, step: 0.01, value: s.y0, format: f2, onInput: (v) => ((s.y0 = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 200, x: { label: 'популяция y', domain: [0, 1.2] }, y: { label: 'скорость y′' } });
    const p2 = new GBC.Plot(w.main, { height: 240, x: { label: 'время t', domain: [0, 30] }, y: { label: 'популяция y(t)', domain: [-0.02, 1.22] } });
    const p3 = new GBC.Plot(w.main, { height: 220, x: { label: 'квота H', domain: [0, 0.35] }, y: { label: 'равновесие y*', domain: [0, 1.05] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'равновесия' }, { key: 'f', label: 'судьба популяции' }]);
    function draw() {
      const Hh = s.H;
      const f = (y) => y * (1 - y) - Hh;
      const d = 1 - 4 * Hh;
      const eqs = d >= 0 ? [(1 - Math.sqrt(d)) / 2, (1 + Math.sqrt(d)) / 2] : [];
      const yy = U.linspace(0, 1.2, 241);
      p1.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: yy, y: yy.map(f), color: 'tree', width: 2.4, hover: false },
        { type: 'line', x: yy, y: yy.map((y) => y * (1 - y)), color: 'muted', width: 1.2, dash: '4 3', label: 'прирост y(1 − y)', hover: false },
        eqs.length ? { type: 'points', x: [eqs[1]], y: [0], color: 'model', r: 6, label: 'устойчивое' } : null,
        eqs.length ? { type: 'points', x: [eqs[0]], y: [0], color: 'model', r: 6, hollow: true, label: 'порог (неустойчивое)' } : null,
      ], { y: [-0.36, 0.3] });
      const layers = eqs.map((e) => ({ type: 'hline', y: e, color: 'ink2', dash: '4 4', width: 1 }));
      const ev = (y0) => {
        const out = { ts: [0], ys: [y0] };
        let y = y0;
        const h = 0.05;
        for (let i = 0; i < 600; i++) {
          y = stepODE((t, v) => f(v), i * h, y, h, 'rk4');
          if (y <= 0) {
            out.ts.push(((i + 1) * h + i * h) / 2);
            out.ys.push(0);
            out.dead = (i + 0.5) * h;
            break;
          }
          out.ts.push((i + 1) * h);
          out.ys.push(y);
        }
        return out;
      };
      [0.1, 0.3, 0.5, 0.7, 1.1].forEach((y0) => {
        const o = ev(y0);
        layers.push({ type: 'line', x: o.ts, y: o.ys, color: 'model', width: 1.2, opacity: 0.45, hover: false });
      });
      const mine = ev(s.y0);
      layers.push({ type: 'line', x: mine.ts, y: mine.ys, color: 'tree', width: 2.6, label: 'ваш старт', hover: false });
      p2.render(layers);
      const Hs = U.linspace(0, 0.25, 200);
      p3.render([
        { type: 'line', x: Hs, y: Hs.map((q) => (1 + Math.sqrt(1 - 4 * q)) / 2), color: 'model', width: 2.6, label: 'устойчивое равновесие', hover: false },
        { type: 'line', x: Hs, y: Hs.map((q) => (1 - Math.sqrt(1 - 4 * q)) / 2), color: 'model', width: 2, dash: '6 4', label: 'неустойчивый порог', hover: false },
        { type: 'vline', x: Hh, color: 'tree', width: 1.6, text: 'H = ' + U.fmt(Hh, 3) },
        { type: 'points', x: [0.25], y: [0.5], color: 'critical', r: 5, label: 'точка бифуркации' },
      ]);
      st.set('e', eqs.length ? f3(eqs[0]) + ' (порог) и ' + f3(eqs[1]) : 'нет — f(y) < 0 везде');
      st.set('f', mine.dead !== undefined ? 'вымирает к t ≈ ' + f2(mine.dead) : 'выживает → ' + f3(mine.ys[mine.ys.length - 1]));
      note.innerHTML = (Hh < 0.25
        ? 'При H = ' + U.fmt(Hh, 3) + ' два равновесия: популяция выходит на ' + f3(eqs[1]) + ', если начальная выше порога ' + f3(eqs[0]) + ', и вымирает, если ниже. '
        : '<b>H &gt; 1/4: равновесий нет</b> — вылов больше максимально возможного прироста y(1 − y) ≤ 1/4, и популяция обваливается из любого состояния. Чем ближе H к 1/4, тем дольше она «застревает» около y = 1/2, прежде чем рухнуть (при H = 0.26 со старта 0.5 — до t ≈ 13.7). ')
        + 'Максимальный устойчивый улов — H = 1/4 = rK/4 при y = K/2, но работать на этой границе опасно: небольшое превышение квоты необратимо уничтожает популяцию. Такую смену качественного поведения при плавном изменении параметра называют <b>бифуркацией</b> (здесь — седло-узловой).';
    }
    w.pythonAction(() => 'import math\n\nH, y0 = ' + py(s.H) + ', ' + py(s.y0) + '\nf = lambda y: y * (1 - y) - H\nd = 1 - 4 * H\nif d >= 0:\n    print("равновесия:", (1 - math.sqrt(d)) / 2, "(порог),", (1 + math.sqrt(d)) / 2, "(устойчивое)")\nelse:\n    print("равновесий нет: H > 1/4")\n\ny, t, h = y0, 0.0, 0.05\nwhile t < 30 and y > 0:\n    k1 = f(y); k2 = f(y + h / 2 * k1); k3 = f(y + h / 2 * k2); k4 = f(y + h * k3)\n    y += h * (k1 + 2 * k2 + 2 * k3 + k4) / 6\n    t += h\nprint("вымерла около t =", round(t, 2) if y <= 0 else None, "  y в конце:", max(y, 0.0))\n');
    draw();
  });

  GBC.lesson1511 = {
    f2, f3, f4, f6, py, sci, sup, powFmt, decades, logAxis, yDom, clampArr,
    texInto, texEl, card, cardGrid, badge, rowTable, stepList, STARS, plural, onTheme,
    stepODE, solveODE, traceCurve, fieldSegs, fieldArrows, plotPx, PY_RK4, PY_SOLVE,
  };
})();
