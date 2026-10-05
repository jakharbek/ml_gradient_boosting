/* Урок 15.15: оптимизация. Часть 1 — интуиция, постановка задачи, поиск без производных, градиентный
 * спуск всерьёз.
 * Виджеты: поиск в тумане; задача о загоне; ландшафт минимумов; логистическая регрессия без минимума;
 * карта задач оптимизации; выпуклые множества; условия оптимальности на отрезке; проклятие размерности
 * сетки; сетка против случайного поиска; вероятность попасть в лучшие q %; сужение отрезка (дихотомия,
 * троичный поиск, золотое сечение); параболическая интерполяция; Нелдер — Мид; мультистарт; имитация
 * отжига; байесовская оптимизация; последовательное деление (successive halving); режимы длины шага;
 * скорости сходимости; точный поиск вдоль прямой; backtracking и правило Армихо; покоординатный спуск;
 * субградиент и проксимальный шаг.
 * Общие помощники (форматирование, карточки, карта высот, поверхности) выставлены в GBC.lesson1515 —
 * ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const R = String.raw;
  const f1 = (v) => U.fmt(v, 1);
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const f4 = (v) => U.fmt(v, 4);
  const py = (v) => U.pyNum(v);
  /** Короткая запись маленьких и больших величин: 3.6e−5 вместо «0». */
  const sci = (v) => (!Number.isFinite(v) ? (Number.isNaN(v) ? '—' : v > 0 ? '∞' : '−∞') : v === 0 ? '0' : Math.abs(v) >= 0.01 && Math.abs(v) < 1e5 ? U.fmt(v, Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 2 : 4) : v.toExponential(1).replace(/-/g, '−').replace('e+', 'e'));
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
  const pct = (p, d = 0) => (Number.isFinite(p) ? U.fmt(100 * p, d) + ' %' : '—');
  /** Склонение: plural(3, 'шаг', 'шага', 'шагов') → 'шага'. */
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  const nWord = (n, one, few, many) => n + ' ' + plural(n, one, few, many);
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
  /** Время в человеческих единицах. */
  function human(sec) {
    if (!Number.isFinite(sec)) return '∞';
    if (sec < 90) return Math.round(sec) + ' с';
    if (sec < 5400) return Math.round(sec / 60) + ' мин';
    if (sec < 1.5 * 86400) return f1(sec / 3600) + ' ч';
    if (sec < 400 * 86400) return Math.round(sec / 86400) + ' сут';
    const y = sec / (365.25 * 86400);
    return y < 1e5 ? Math.round(y).toLocaleString('ru-RU') + ' лет' : '≈ ' + y.toExponential(1).replace('e+', '·10^').replace(/\^(\d+)/, (m, d) => sup(d)) + ' лет';
  }

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
  function card(title) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums;overflow-x:auto;overflow-y:hidden' });
    const titleEl = H('div', { style: 'font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px' }, title);
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' }, titleEl, body);
    return { el, body, titleEl };
  }
  const cardGrid = (min = 200) => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(' + min + 'px,100%),1fr));gap:10px;margin:4px 0 10px' });
  function badge(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : kind === 'warn' ? 'background:var(--warn-soft);color:var(--warn-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;white-space:nowrap;' + st }, text);
  }
  /** Таблица: columns — строки; rows — массивы строк. */
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  const onTheme = (fn) => GBC.bus.on('themechange', () => setTimeout(fn, 0));
  const PY_NP = 'import numpy as np\n';
  const PY_RNG = 'from gbcourse.rng import Mulberry32\n';

  /* ==============================================================================
   * Карта высот функции двух переменных и библиотека поверхностей
   * ============================================================================== */
  /** Слои «карта высот»: заливка (темнее — ниже) и линии уровня. */
  function mapLayers(f, dom, levels, o = {}) {
    const [x0, x1, y0, y1] = dom;
    const grid = GBC.Plot.grid(f, x0, x1, y0, y1, o.n || 90, o.n || 90);
    const seq = GBC.colors.sequential();
    const vals = Array.from(grid.values).filter(Number.isFinite);
    const lo = Math.min(...vals);
    const hi = Math.max(...levels) * 1.3 + (lo < 0 ? -lo * 0.3 : 0);
    const layers = [{ type: 'heatmap', grid, colorFn: (v) => seq(1 - Math.min(1, Math.sqrt(Math.max(0, (v - lo) / (hi - lo))))), opacity: o.opacity ?? 0.45 }];
    for (const lv of levels) layers.push({ type: 'contour', grid, level: lv, color: 'axis', width: 1 });
    return layers;
  }
  const SURF = {
    bowl: {
      label: 'вытянутая чаша ½(x² + 25y²)', f: (x, y) => 0.5 * (x * x + 25 * y * y), g: (x, y) => [x, 25 * y],
      hess: () => [[1, 0], [0, 25]], dom: [-4.5, 4.5, -2, 2], p0: [-4, 1.5], levels: [0.3, 1.5, 4, 8, 14, 22], min: [0, 0], fmin: 0,
      py: 'f = lambda p: 0.5 * (p[0]**2 + 25 * p[1]**2)\ngrad = lambda p: np.array([p[0], 25 * p[1]])\n',
    },
    rotated: {
      label: 'та же чаша, повёрнутая на 45°',
      f: (x, y) => { const u = (x + y) / Math.SQRT2; const v = (y - x) / Math.SQRT2; return 0.5 * (u * u + 25 * v * v); },
      g: (x, y) => { const u = (x + y) / Math.SQRT2; const v = (y - x) / Math.SQRT2; return [(u - 25 * v) / Math.SQRT2, (u + 25 * v) / Math.SQRT2]; },
      hess: () => [[13, 12], [12, 13]], dom: [-3.2, 3.2, -2.4, 2.4], p0: [-2.8, -1.4], levels: [0.3, 1.5, 4, 8, 14, 22], min: [0, 0], fmin: 0,
      py: 'def f(p):\n    u, v = (p[0] + p[1]) / np.sqrt(2), (p[1] - p[0]) / np.sqrt(2)\n    return 0.5 * (u**2 + 25 * v**2)\ndef grad(p):\n    u, v = (p[0] + p[1]) / np.sqrt(2), (p[1] - p[0]) / np.sqrt(2)\n    return np.array([u - 25 * v, u + 25 * v]) / np.sqrt(2)\n',
    },
    banana: {
      label: 'изогнутая долина (1 − x)² + 5(y − x²)²', f: (x, y) => (1 - x) ** 2 + 5 * (y - x * x) ** 2,
      g: (x, y) => [-2 * (1 - x) - 20 * x * (y - x * x), 10 * (y - x * x)],
      hess: (x, y) => [[2 - 20 * y + 60 * x * x, -20 * x], [-20 * x, 10]], dom: [-1.6, 1.6, -0.6, 2.2], p0: [-1.2, 1.5], levels: [0.1, 0.5, 1.5, 3, 6, 10], min: [1, 1], fmin: 0,
      py: 'f = lambda p: (1 - p[0])**2 + 5 * (p[1] - p[0]**2)**2\ngrad = lambda p: np.array([-2 * (1 - p[0]) - 20 * p[0] * (p[1] - p[0]**2), 10 * (p[1] - p[0]**2)])\n',
    },
  };

  /* ==============================================================================
   * Нормальное распределение (для ожидаемого улучшения)
   * ============================================================================== */
  function erfc(x) {
    const z = Math.abs(x);
    const t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const normPdf = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const normCdf = (z) => 0.5 * erfc(-z / Math.SQRT2);

  /* ==============================================================================
   * Одномерные методы: золотое сечение
   * ============================================================================== */
  const PHI = (Math.sqrt(5) - 1) / 2;
  /** Золотое сечение на [a, b]: состояния после каждого вычисления f (начиная со второго). */
  function goldenRun(f, a, b, evals) {
    let c = b - PHI * (b - a);
    let d = a + PHI * (b - a);
    let fc = f(c);
    let fd = f(d);
    const pts = [[c, fc], [d, fd]];
    const states = [{ a, b, evals: 2, c, d, fc, fd }];
    for (let e = 3; e <= evals; e++) {
      if (fc < fd) {
        b = d;
        d = c;
        fd = fc;
        c = b - PHI * (b - a);
        fc = f(c);
        pts.push([c, fc]);
      } else {
        a = c;
        c = d;
        fc = fd;
        d = a + PHI * (b - a);
        fd = f(d);
        pts.push([d, fd]);
      }
      states.push({ a, b, evals: e, c, d, fc, fd });
    }
    let best = pts[0];
    for (const p of pts) if (p[1] < best[1]) best = p;
    return { states, pts, best };
  }
  const PY_GOLDEN = 'PHI = (np.sqrt(5) - 1) / 2\n\ndef golden(f, a, b, evals):\n    """Золотое сечение: evals вычислений f; возвращает отрезок и лучшую из вычисленных точек."""\n    c, d = b - PHI * (b - a), a + PHI * (b - a)\n    fc, fd = f(c), f(d)\n    pts = [(c, fc), (d, fd)]\n    for _ in range(evals - 2):\n        if fc < fd:\n            b, d, fd = d, c, fc\n            c = b - PHI * (b - a); fc = f(c); pts.append((c, fc))\n        else:\n            a, c, fc = c, d, fd\n            d = a + PHI * (b - a); fd = f(d); pts.append((d, fd))\n    return a, b, min(pts, key=lambda p: p[1])\n';

  /* ==============================================================================
   * Интуиция: поиск в тумане
   * ============================================================================== */
  GBC.widget('fog-search', (el) => {
    const BUDGET = 6;
    const s = { seed: 1, mode: 'val', probes: [], reveal: false };
    let T = null;
    function newTask() {
      const r = new GBC.RNG(500 + s.seed);
      const c = 1.5 + 7 * r.random();
      const k = 0.3 + 1.2 * r.random();
      const f = (x) => 1 + Math.sqrt(1 + k * (x - c) ** 2) + 0.12 * (x - c);
      const d = (x) => (k * (x - c)) / Math.sqrt(1 + k * (x - c) ** 2) + 0.12;
      const xs = c - 0.12 / Math.sqrt(k * (k - 0.0144));
      const top = Math.max(f(0), f(10));
      T = { c, k, f, d, xs, fs: f(xs), yd: [f(xs) - 0.25, top + 0.4] };
      s.probes = [];
      s.reveal = false;
    }
    const w = ui.shell(el, { title: 'Поиск в тумане: найдите минимум за 6 измерений', sub: 'Где-то на отрезке [0, 10] спрятана функция с одной ямой. Каждый клик по графику — одно измерение f(x) (в жизни — одно обучение модели, минуты или часы). Найдите x с наименьшим f. В режиме «наклон» измерение даёт ещё и производную.' });
    ui.segmented(w.controls, { label: 'Что даёт одно измерение', value: s.mode, options: [{ value: 'val', label: 'значение f' }, { value: 'slope', label: 'f и наклон f′' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.button(w.controls, { label: 'Показать функцию', onClick: () => ((s.reveal = true), draw()) });
    ui.button(w.controls, { label: 'Новая задача', kind: 'primary', onClick: () => (s.seed++, newTask(), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x (например, логарифм темпа обучения)', domain: [0, 10] }, y: { label: 'f(x) — ошибка' } });
    plot.onClick = (x) => {
      if (s.reveal || s.probes.length >= BUDGET) return;
      s.probes.push(U.clamp(x, 0, 10));
      if (s.probes.length >= BUDGET) s.reveal = true;
      draw();
    };
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'измерений' }, { key: 'best', label: 'ваше лучшее f' }, { key: 'gap', label: 'отставание от минимума' }, { key: 'gold', label: 'золотое сечение за 6 измерений' }]);
    function draw() {
      const { f, d } = T;
      const layers = [];
      const G = goldenRun(f, 0, 10, BUDGET);
      if (s.reveal) {
        const xs = U.linspace(0, 10, 300);
        layers.push({ type: 'line', x: xs, y: xs.map(f), color: 'model', width: 2.2, label: 'спрятанная функция', hover: false });
        layers.push({ type: 'vline', x: T.xs, color: 'truth', dash: '5 4', width: 1.4 });
        layers.push({ type: 'points', x: G.pts.map((p) => p[0]), y: G.pts.map((p) => p[1]), color: 'violet', r: 4.5, label: 'золотое сечение', tooltip: (i) => ['золотое сечение, измерение ' + (i + 1), 'x = ' + f3(G.pts[i][0]), 'f = ' + f3(G.pts[i][1])] });
      }
      if (s.mode === 'slope' && s.probes.length) {
        const x1 = [];
        const x2 = [];
        const y1 = [];
        const y2 = [];
        for (const x of s.probes) {
          x1.push(x - 0.6);
          x2.push(x + 0.6);
          y1.push(f(x) - 0.6 * d(x));
          y2.push(f(x) + 0.6 * d(x));
        }
        layers.push({ type: 'segments', x1, x2, y1, y2, color: 'tree', width: 2.2, opacity: 0.9 });
      }
      if (s.probes.length) {
        layers.push({ type: 'points', x: s.probes, y: s.probes.map(f), color: 'tree', r: 6, label: 'ваши измерения', tooltip: (i) => ['измерение ' + (i + 1), 'x = ' + f3(s.probes[i]), 'f = ' + f3(f(s.probes[i]))] });
        layers.push({ type: 'text', items: s.probes.map((x, i) => ({ x, y: f(x), dy: -12, text: String(i + 1), anchor: 'middle', bold: true })) });
      }
      plot.render(layers, { y: T.yd });
      const bestF = s.probes.length ? Math.min(...s.probes.map(f)) : NaN;
      st.set('n', s.probes.length + ' из ' + BUDGET);
      st.set('best', s.probes.length ? f3(bestF) : '—');
      st.set('gap', s.reveal && s.probes.length ? f3(bestF - T.fs) : '?');
      st.set('gold', s.reveal ? 'отставание ' + f3(G.best[1] - T.fs) : '?');
      if (!s.reveal) {
        note.innerHTML = s.probes.length === 0
          ? 'Кликните по графику, чтобы измерить f в точке. Подумайте заранее: где мерить первым? Что делать после двух измерений?'
          : s.mode === 'slope'
            ? 'Наклон подсказывает направление: если f′ &gt; 0, минимум левее, если f′ &lt; 0 — правее. Одно измерение с наклоном стоит почти двух без него.'
            : 'Сравнивая значения, можно отбросить часть отрезка: если f(x₁) &lt; f(x₂) при x₁ &lt; x₂, то при одной яме минимум не правее x₂. Осталось ' + (BUDGET - s.probes.length) + '.';
      } else {
        note.innerHTML = 'Минимум был в x* = ' + f3(T.xs) + ', f* = ' + f3(T.fs) + '. ' + (s.probes.length ? 'Ваше лучшее измерение отстаёт на ' + f3(bestF - T.fs) + '. ' : '') + 'Золотое сечение (фиолетовые точки, шаг 8) за те же 6 измерений отстаёт на ' + f3(G.best[1] - T.fs) + ' — без всякой удачи, только за счёт стратегии «выбрасывай часть отрезка, где минимума быть не может». Весь урок — о таких стратегиях: что они знают о функции (значения, наклон, кривизну), сколько стоит каждое измерение и что гарантируют.';
      }
    }
    w.pythonAction(() => PY_NP + PY_GOLDEN + '\nc, k = ' + py(T.c) + ', ' + py(T.k) + '      # спрятанная функция этой задачи\nf = lambda x: 1 + np.sqrt(1 + k * (x - c)**2) + 0.12 * (x - c)\nx_star = c - 0.12 / np.sqrt(k * (k - 0.0144))   # из f\'(x) = 0\na, b, (xb, fb) = golden(f, 0, 10, 6)\nprint(f"минимум x* = {x_star:.3f}, f* = {f(x_star):.3f}")\nprint(f"золотое сечение за 6 измерений: x = {xb:.3f}, отставание {fb - f(x_star):.3f}, отрезок [{a:.3f}, {b:.3f}]")\n');
    newTask();
    draw();
  });

  /* ==============================================================================
   * Шаг 1. Задача о загоне
   * ============================================================================== */
  GBC.widget('fence', (el) => {
    const s = { x: 6, river: true };
    const w = ui.shell(el, { title: 'Задача о загоне: 40 м забора', sub: 'Огораживаем прямоугольный загон. Переменная — ширина x (м); целевая функция — площадь; ограничения — длина забора 40 м и неотрицательные стороны. Вдоль реки забор не нужен.' });
    ui.segmented(w.controls, { label: 'Где ставим забор', value: 'river', options: [{ value: 'river', label: 'три стороны, четвёртая — река' }, { value: 'all', label: 'все четыре стороны' }], onChange: (v) => ((s.river = v === 'river'), (s.x = Math.min(s.x, s.river ? 20 : 20)), draw()) });
    ui.slider(w.controls, { label: 'Ширина x, м', min: 0, max: 20, step: 0.5, value: s.x, format: (v) => f1(v), onInput: (v) => ((s.x = v), draw()) });
    const box = H('div', { style: 'max-width:440px;margin:0 auto' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 250, equal: true, x: { label: 'метры', domain: [-1, 41] }, y: { label: 'м', domain: [-1, 23] }, grid: 'none' });
    const p2 = new GBC.Plot(w.main, { height: 240, x: { label: 'ширина x, м', domain: [0, 20] }, y: { label: 'площадь A(x), м²', domain: [0, 215] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'dims', label: 'размеры x × y' }, { key: 'A', label: 'площадь' }, { key: 'best', label: 'оптимум' }]);
    const area = (x, river) => (river ? x * (40 - 2 * x) : x * (20 - x));
    function draw() {
      const { x, river } = s;
      const y = river ? 40 - 2 * x : 20 - x;
      const x0 = 20 - y / 2;
      const x1 = 20 + y / 2;
      const L = [];
      if (river) L.push({ type: 'rect', x0: -1, x1: 41, y0: x, y1: x + 1.6, fill: 'aqua', opacity: 0.35 });
      L.push({ type: 'rect', x0, x1, y0: 0, y1: x, fill: 'model', opacity: 0.12 });
      L.push({ type: 'line', x: river ? [x0, x0, x1, x1] : [x0, x0, x1, x1, x0], y: river ? [x, 0, 0, x] : [x, 0, 0, x, x], color: 'tree', width: 3, hover: false });
      L.push({ type: 'text', items: [{ x: 20, y: x / 2, text: 'A = ' + f1(area(x, river)) + ' м²', anchor: 'middle', bold: true }].concat(river ? [{ x: 0, y: x + 2.6, text: 'река' }] : []) });
      p1.render(L);
      const xs = U.linspace(0, 20, 201);
      const xb = river ? 10 : 10;
      p2.render([
        { type: 'line', x: xs, y: xs.map((t) => area(t, !river)), color: 'muted', dash: '5 4', width: 1.6, label: river ? 'если бы без реки' : 'если бы у реки', hover: false },
        { type: 'line', x: xs, y: xs.map((t) => area(t, river)), color: 'model', width: 2.4, label: 'A(x)' },
        { type: 'points', x: [xb], y: [area(xb, river)], color: 'ink', r: 5, hollow: true },
        { type: 'points', x: [x], y: [area(x, river)], color: 'tree', r: 7 },
      ]);
      st.set('dims', f1(x) + ' × ' + f1(y) + ' м');
      st.set('A', f1(area(x, river)) + ' м²');
      st.set('best', river ? 'x = 10, y = 20 → 200 м²' : 'x = y = 10 → 100 м²');
      note.innerHTML = river
        ? 'Площадь A(x) = x(40 − 2x) — парабола ветвями вниз. Допустимые x — от 0 до 20 (иначе сторона y = 40 − 2x отрицательна). Максимум там, где A′(x) = 40 − 4x = 0: x = 10, y = 20, A = 200 м². Обратите внимание: сторона вдоль реки вдвое длиннее — река «дарит» длину. Задачу на максимум переписывают как задачу на минимум: максимизировать A — то же, что минимизировать −A.'
        : 'Без реки 2x + 2y = 40, y = 20 − x, A(x) = x(20 − x), максимум при x = y = 10: квадрат 100 м². Река удвоила площадь — изменилось допустимое множество, и вместе с ним оптимум.';
    }
    w.pythonAction(() => PY_NP + '\nx = np.linspace(0, 20, 2001)            # допустимые ширины\nfor name, area in [("у реки", x * (40 - 2 * x)), ("без реки", x * (20 - x))]:\n    i = area.argmax()\n    print(f"{name}: лучший x = {x[i]:.2f}, площадь {area[i]:.1f} м²")\n\n# то же как минимизация −A\nfrom scipy.optimize import minimize_scalar\nres = minimize_scalar(lambda t: -t * (40 - 2 * t), bounds=(0, 20), method="bounded")\nprint("scipy: x =", round(res.x, 4), " A =", round(-res.fun, 3))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 2. Ландшафт: глобальные, локальные минимумы, перегиб, плато
   * ============================================================================== */
  function rootsOf(d, a, b, n = 4000) {
    const out = [];
    let xp = a;
    let dp = d(a);
    for (let i = 1; i <= n; i++) {
      const x = a + ((b - a) * i) / n;
      const dx = d(x);
      if (dx === 0) out.push(x);
      else if (dp * dx < 0) {
        let lo = xp;
        let hi = x;
        for (let k = 0; k < 80; k++) {
          const m = (lo + hi) / 2;
          if (d(lo) * d(m) <= 0) hi = m;
          else lo = m;
        }
        out.push((lo + hi) / 2);
      }
      xp = x;
      dp = dx;
    }
    return out;
  }
  const LAND = {
    tilted: { label: 'две ямы: x⁴ − 4x² + x', f: (x) => x ** 4 - 4 * x * x + x, d: (x) => 4 * x ** 3 - 8 * x + 1, d2: (x) => 12 * x * x - 8, dom: [-2.4, 2.4], eta: 0.01, x0: 1.9, pyf: 'x**4 - 4*x**2 + x', pyd: '4*x**3 - 8*x + 1' },
    cubic: { label: 'перегиб: x³', f: (x) => x ** 3, d: (x) => 3 * x * x, d2: (x) => 6 * x, dom: [-1.6, 1.6], eta: 0.05, x0: 1.2, pyf: 'x**3', pyd: '3*x**2' },
    plateau: { label: 'плато: 1 − e^(−(x − 1)²)', f: (x) => 1 - Math.exp(-((x - 1) ** 2)), d: (x) => 2 * (x - 1) * Math.exp(-((x - 1) ** 2)), d2: (x) => (2 - 4 * (x - 1) ** 2) * Math.exp(-((x - 1) ** 2)), dom: [-5, 5], eta: 0.5, x0: 4, pyf: '1 - np.exp(-(x - 1)**2)', pyd: '2*(x - 1)*np.exp(-(x - 1)**2)' },
    decay: { label: 'нет минимума: e^(−x)', f: (x) => Math.exp(-x), d: (x) => -Math.exp(-x), d2: (x) => Math.exp(-x), dom: [0, 8], eta: 1, x0: 1, pyf: 'np.exp(-x)', pyd: '-np.exp(-x)' },
  };
  /** Критические точки и их типы. */
  function landPoints(F) {
    const r = rootsOf(F.d, F.dom[0], F.dom[1]);
    const mins = r.filter((x) => F.d2(x) > 1e-9);
    const fmin = mins.length ? Math.min(...mins.map(F.f)) : Infinity;
    return r.map((x) => ({ x, kind: F.d2(x) > 1e-9 ? (F.f(x) <= fmin + 1e-12 ? 'global' : 'local') : F.d2(x) < -1e-9 ? 'max' : 'flat' }));
  }
  function landRun(F, x0, n = 500) {
    const path = [x0];
    let x = x0;
    let status = 'run';
    const span = F.dom[1] - F.dom[0];
    for (let k = 0; k < n; k++) {
      const g = F.d(x);
      if (Math.abs(g) < 1e-7) {
        status = 'conv';
        break;
      }
      x -= F.eta * g;
      path.push(x);
      if (x < F.dom[0] - 0.05 * span || x > F.dom[1] + 0.05 * span || !Number.isFinite(x)) {
        status = 'out';
        break;
      }
    }
    return { path, x, status };
  }
  const KIND_RU = { global: 'глобальный минимум', local: 'локальный минимум', max: 'локальный максимум', flat: 'критическая точка — не экстремум' };
  GBC.widget('landscape', (el) => {
    const s = { fn: 'tilted', x0: LAND.tilted.x0 };
    const w = ui.shell(el, { title: 'Ландшафт: куда скатится спуск?', sub: 'Кликните по графику — из этой точки стартует градиентный спуск (500 шагов). Заливка — области притяжения: откуда спуск приходит в глобальный минимум (синяя) и в локальный (оранжевая).' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(LAND).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.x0 = LAND[v].x0), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'f(x)' } });
    plot.onClick = (x) => ((s.x0 = U.clamp(x, LAND[s.fn].dom[0], LAND[s.fn].dom[1])), draw());
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x0', label: 'старт' }, { key: 'end', label: 'финиш' }, { key: 'g', label: 'наклон в финише' }, { key: 'kind', label: 'что это' }]);
    const basinCache = {};
    function basins(F, pts) {
      const key = s.fn;
      if (basinCache[key]) return basinCache[key];
      const xs = U.linspace(F.dom[0], F.dom[1], 241);
      const lab = xs.map((x) => {
        const R0 = landRun(F, x, 3000);
        if (R0.status === 'out') return 'out';
        const near = pts.filter((p) => p.kind === 'global' || p.kind === 'local').find((p) => Math.abs(p.x - R0.x) < 0.05);
        return near ? near.kind : 'other';
      });
      const bands = [];
      let i0 = 0;
      for (let i = 1; i <= xs.length; i++) {
        if (i === xs.length || lab[i] !== lab[i0]) {
          bands.push({ x0: xs[i0], x1: xs[Math.min(i, xs.length - 1)], kind: lab[i0] });
          i0 = i;
        }
      }
      basinCache[key] = bands;
      return bands;
    }
    function draw() {
      const F = LAND[s.fn];
      const pts = landPoints(F);
      const B = basins(F, pts);
      const R0 = landRun(F, s.x0);
      const xs = U.linspace(F.dom[0], F.dom[1], 400);
      const ys = xs.map(F.f);
      const yd = yDom(ys, 0.1);
      const inDom = R0.path.filter((x) => x >= F.dom[0] && x <= F.dom[1]);
      const L = B.filter((b) => b.kind === 'global' || b.kind === 'local').map((b) => ({ type: 'vband', x0: b.x0, x1: b.x1, color: b.kind === 'global' ? 'model' : 'tree', opacity: 0.1 }));
      L.push({ type: 'line', x: xs, y: ys, color: 'ink2', width: 2.2, hover: false });
      L.push({ type: 'points', x: inDom, y: inDom.map(F.f), color: 'tree', r: 3, opacity: 0.6 });
      L.push({ type: 'points', x: [s.x0], y: [F.f(s.x0)], color: 'ink', r: 6, hollow: true });
      const endIn = R0.x >= F.dom[0] && R0.x <= F.dom[1];
      if (endIn) L.push({ type: 'points', x: [R0.x], y: [F.f(R0.x)], color: 'tree', r: 7 });
      for (const p of pts) L.push({ type: 'text', x: p.x, y: F.f(p.x), dy: p.kind === 'max' ? -12 : 20, anchor: 'middle', text: p.kind === 'global' ? 'глоб. мин.' : p.kind === 'local' ? 'лок. мин.' : p.kind === 'max' ? 'лок. макс.' : 'перегиб' });
      plot.render(L, { x: F.dom, y: yd });
      const g = F.d(R0.x);
      let kind;
      if (R0.status === 'out') kind = 'ушёл за край';
      else {
        const near = pts.find((p) => Math.abs(p.x - R0.x) < 0.03);
        kind = near && Math.abs(g) < 1e-3 ? KIND_RU[near.kind] : s.fn === 'decay' ? 'минимума нет: идёт дальше' : Math.abs(g) < 1e-3 ? 'застрял на плато' : 'не дошёл за 500 шагов';
      }
      st.set('x0', f2(s.x0));
      st.set('end', R0.status === 'out' ? 'за краем' : f3(R0.x));
      st.set('g', sci(g));
      st.set('kind', kind);
      const notes = {
        tilted: () => 'Две ямы: глобальный минимум x ≈ −1.473 (f ≈ −5.44) и локальный x ≈ 1.347 (f ≈ −2.62), между ними локальный максимум x ≈ 0.126. Спуск видит только наклон под ногами и приходит в ту яму, в чьей области притяжения стартовал: из x₀ = 1.9 — в локальную. Чтобы найти глобальный минимум невыпуклой функции, нужны несколько стартов или «встряска» (шаги 11–12).',
        cubic: () => 'У x³ производная 3x² обнуляется в x = 0, но это не минимум, а перегиб: слева функция меньше. Стартовав справа, спуск подползает к нулю всё медленнее (шаг ∝ x²); слева — уходит в −∞. Условие f′ = 0 необходимо, но не достаточно (шаг 5).',
        plateau: () => 'Минимум в x = 1, но вдали от него функция почти постоянна: в x = 4 наклон ≈ 7·10⁻⁴, и спуск с темпом 0.5 за 500 шагов из x₀ = 4 добрался лишь до x ≈ 3.25 — до минимума ещё далеко. Плато — главная беда сигмоид и насыщенных потерь: наклон есть, но крошечный. Помогают другой масштаб, другой старт или методы с инерцией и адаптивным шагом (шаги 21–22).',
        decay: () => 'У e^(−x) на [0, ∞) нижняя грань 0 не достигается: значения сколь угодно близки к нулю, но минимума нет. Спуск честно идёт вправо всё дальше и дальше. Задача «найти минимум» может не иметь решения — тот же эффект в логистической регрессии на разделимых данных (пример ниже).',
      };
      note.innerHTML = notes[s.fn]();
    }
    w.pythonAction(() => {
      const F = LAND[s.fn];
      return PY_NP + '\nf = lambda x: ' + F.pyf + '\ndf = lambda x: ' + F.pyd + '\nx, eta = ' + py(s.x0) + ', ' + py(F.eta) + '\nfor k in range(500):\n    g = df(x)\n    if abs(g) < 1e-7:\n        break\n    x -= eta * g\n    if not ' + py(F.dom[0] - 0.05 * (F.dom[1] - F.dom[0])) + ' <= x <= ' + py(F.dom[1] + 0.05 * (F.dom[1] - F.dom[0])) + ':\n        print("ушёл за край на шаге", k + 1)\n        break\nprint(f"финиш x = {x:.4f}, f = {f(x):.4f}, наклон {df(x):.2e}")\n\n# все критические точки: где df меняет знак\nxs = np.linspace(' + py(F.dom[0]) + ', ' + py(F.dom[1]) + ', 40001)\nd = df(xs)\nprint("критические точки ≈", xs[np.where(np.diff(np.sign(d)) != 0)[0]].round(3))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 2, пример. Логистическая регрессия на разделимых данных: минимума нет
   * ============================================================================== */
  GBC.widget('separable', (el) => {
    const XS = [-2, -1.2, -0.6, -0.3, 0.4, 0.8, 1.5, 2.2];
    const YS = [0, 0, 0, 0, 1, 1, 1, 1];
    const s = { lam: 0, flip: false };
    const w = ui.shell(el, { title: 'Логистическая регрессия без минимума', sub: 'Восемь точек на прямой: слева класс 0, справа класс 1 — они разделимы порогом в нуле. Модель p = σ(w·x), потери — средняя log-loss. Чем больше w, тем увереннее модель и тем меньше потери: минимум «уезжает в бесконечность».' });
    ui.slider(w.controls, { label: 'Штраф λ·w²/2', values: [0, 0.001, 0.01, 0.1], value: s.lam, format: (v) => String(v), onInput: (v) => ((s.lam = v), draw()) });
    ui.toggle(w.controls, { label: 'добавить «перепутанную» точку (x = 1, класс 0)', checked: false, onChange: (v) => ((s.flip = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'вес w', domain: [0, 12] }, y: { label: 'потери L(w)' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'шаг спуска k (лог. шкала)', type: 'log', domain: [1, 10000], ticks: [1, 10, 100, 1000, 10000] }, y: { label: 'вес w_k' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w100', label: 'w после 100 шагов' }, { key: 'w10k', label: 'w после 10 000 шагов' }, { key: 'L', label: 'потери после 10 000' }, { key: 'opt', label: 'минимум' }]);
    function data() {
      return s.flip ? { x: XS.concat([1]), y: YS.concat([0]) } : { x: XS, y: YS };
    }
    function lossGrad(D, wv) {
      let L = 0;
      let g = 0;
      for (let i = 0; i < D.x.length; i++) {
        const z = (D.y[i] ? 1 : -1) * wv * D.x[i];
        L += z > 0 ? Math.log1p(Math.exp(-z)) : -z + Math.log1p(Math.exp(z));
        g += -(D.y[i] ? 1 : -1) * D.x[i] / (1 + Math.exp(z));
      }
      const n = D.x.length;
      return [L / n + (s.lam * wv * wv) / 2, g / n + s.lam * wv];
    }
    function draw() {
      const D = data();
      const ws = U.linspace(0, 12, 241);
      let wv = 0;
      const ks = [];
      const wk = [];
      let w100 = 0;
      for (let k = 1; k <= 10000; k++) {
        wv -= 2 * lossGrad(D, wv)[1];
        if (k === 100) w100 = wv;
        if (k <= 20 || k % 25 === 0) {
          ks.push(k);
          wk.push(wv);
        }
      }
      // минимум: корень L'(w) на [0, 200]
      let opt = null;
      if (lossGrad(D, 200)[1] > 0) {
        let lo = 0;
        let hi = 200;
        for (let i = 0; i < 100; i++) {
          const m = (lo + hi) / 2;
          if (lossGrad(D, m)[1] > 0) hi = m;
          else lo = m;
        }
        opt = (lo + hi) / 2;
      }
      const L = [{ type: 'line', x: ws, y: ws.map((t) => lossGrad(D, t)[0]), color: 'model', width: 2.4, label: 'L(w)' }];
      const marks = [10, 100, 1000, 10000].map((k) => {
        let v = 0;
        for (let i = 0; i < k; i++) v -= 2 * lossGrad(D, v)[1];
        return [k, v];
      });
      L.push({ type: 'points', x: marks.map((m) => Math.min(m[1], 12)), y: marks.map((m) => lossGrad(D, Math.min(m[1], 12))[0]), color: 'tree', r: 5, label: 'спуск после 10, 100, 1000, 10 000 шагов', tooltip: (i) => [marks[i][0] + ' шагов', 'w = ' + f3(marks[i][1])] });
      if (opt !== null && opt <= 12) L.push({ type: 'vline', x: opt, color: 'ink', dash: '4 4', width: 1.2, text: 'минимум' });
      p1.render(L, { y: yDom(ws.map((t) => lossGrad(D, t)[0]), 0.05, [0]) });
      p2.render([
        { type: 'line', x: ks, y: wk, color: 'tree', width: 2.2 },
        opt !== null ? { type: 'hline', y: opt, color: 'ink', dash: '4 4', width: 1.2, text: 'w* = ' + f2(opt) } : null,
      ], { y: yDom(wk, 0.05, [0, opt !== null ? opt : 0]) });
      st.set('w100', f3(w100));
      st.set('w10k', f3(wv));
      st.set('L', sci(lossGrad(D, wv)[0]));
      st.set('opt', opt === null ? 'нет: inf L = 0' : 'w* = ' + f3(opt));
      note.innerHTML = opt === null
        ? 'Без штрафа на разделимых данных L(w) убывает при всех w и стремится к 0, но нуля не достигает: минимума нет. Спуск растит w примерно как логарифм числа шагов (' + f2(w100) + ' после 100 шагов, ' + f2(wv) + ' после 10 000) — бесконечно. Модель становится всё увереннее, вероятности — всё ближе к 0 и 1. Лечится регуляризацией (λ &gt; 0) или ранней остановкой.'
        : s.flip && s.lam === 0
          ? 'Одна «перепутанная» точка делает данные неразделимыми: при больших w её потери растут линейно, и у L(w) появляется минимум w* = ' + f3(opt) + '. Существование решения — свойство данных, а не алгоритма.'
          : 'Штраф λw²/2 растёт быстрее, чем падают потери, — и минимум появляется: w* = ' + f3(opt) + '. Чем меньше λ, тем дальше минимум. В бустинге та же история с листом, где все объекты одного класса: без λ (или ограничения max_delta_step) значение листа уходило бы в бесконечность (урок 8.2).';
    }
    w.pythonAction(() => PY_NP + '\nx = np.array(' + JSON.stringify(data().x) + ')\ny = np.array(' + JSON.stringify(data().y) + ')\nlam = ' + py(s.lam) + '\ns = 2 * y - 1                      # метки ±1\n\ndef loss_grad(w):\n    z = s * w * x\n    L = np.logaddexp(0, -z).mean() + lam * w**2 / 2\n    g = (-s * x / (1 + np.exp(z))).mean() + lam * w\n    return L, g\n\nw = 0.0\nfor k in range(1, 10001):\n    w -= 2 * loss_grad(w)[1]\n    if k in (10, 100, 1000, 10000):\n        print(f"k = {k:5d}: w = {w:.3f}, L = {loss_grad(w)[0]:.2e}")\n\nfrom scipy.optimize import minimize_scalar\nres = minimize_scalar(lambda t: loss_grad(t)[0], bounds=(0, 200), method="bounded")\nprint("минимум на [0, 200]:", round(res.x, 3), "(у края 200 → минимума нет)" if res.x > 199 else "")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 3. Карта задач оптимизации
   * ============================================================================== */
  const TASKS = [
    { key: 'split', name: 'Порог разбиения в узле дерева', vars: ['дискретные (признак и порог)', 'warn'], smooth: ['нет: ступенчатая функция', 'bad'], convex: ['не применимо', ''], cons: ['конечный список вариантов', ''], noise: ['детерминированная', 'good'], cost: ['дёшево: O(n) на порог после сортировки', 'good'], info: 'значения', method: 'полный перебор порогов (урок 2.1)', why: 'Вариантов мало (≤ n − 1 на признак) — переберём все и найдём точный оптимум.' },
    { key: 'leaf', name: 'Значения листьев при готовой структуре', vars: ['непрерывные', 'good'], smooth: ['гладкая', 'good'], convex: ['выпуклая (потери выпуклы по F)', 'good'], cons: ['нет', 'good'], noise: ['детерминированная', 'good'], cost: ['дёшево', 'good'], info: 'значения, градиент, гессиан', method: 'формула (MSE) или шаг Ньютона −G/(H + λ) (уроки 8.2, 15.7)', why: 'Каждый лист — отдельная задача с одной переменной; выпуклость гарантирует, что найденный минимум глобальный.' },
    { key: 'tree', name: 'Структура дерева целиком', vars: ['комбинаторные', 'bad'], smooth: ['нет', 'bad'], convex: ['нет', 'bad'], cons: ['глубина, min_child_weight', 'warn'], noise: ['детерминированная', 'good'], cost: ['вариантов — астрономически много', 'bad'], info: 'значения', method: 'жадный рост: лучшее разбиение на каждом шаге (шаг 32, урок 2.3)', why: 'Точная задача NP-трудна; жадность даёт хорошее дерево за O(n·d·log n).' },
    { key: 'boost', name: 'Модель бустинга F(x)', vars: ['функция — бесконечномерная', 'warn'], smooth: ['гладкая по прогнозам', 'good'], convex: ['выпуклая по прогнозам F(xᵢ)', 'good'], cons: ['F — сумма деревьев', 'warn'], noise: ['подвыборки — стохастическая', 'warn'], cost: ['одно дерево за шаг', 'good'], info: 'градиент и гессиан по прогнозам', method: 'градиентный (ньютоновский) спуск в пространстве функций (шаги 33–35)', why: 'Шаг — дерево, приближающее антиградиент; длина — поиск вдоль прямой или Ньютон в листьях.' },
    { key: 'hyper', name: 'Гиперпараметры бустинга', vars: ['смешанные: η, глубина, λ…', 'warn'], smooth: ['неизвестно, с шумом', 'bad'], convex: ['нет', 'bad'], cons: ['диапазоны', ''], noise: ['шум валидации', 'bad'], cost: ['дорого: одно значение = обучение', 'bad'], info: 'только значения', method: 'случайный поиск, байесовская оптимизация, последовательное деление (шаги 7, 13, 14)', why: '«Чёрный ящик»: производной нет, вычисления дороги — каждое измерение надо выбирать с умом.' },
    { key: 'logreg', name: 'Логистическая регрессия', vars: ['непрерывные', 'good'], smooth: ['гладкая', 'good'], convex: ['выпуклая', 'good'], cons: ['нет (или штраф)', 'good'], noise: ['детерминированная', 'good'], cost: ['O(n·d) за градиент', 'good'], info: 'градиент (и гессиан)', method: 'L-BFGS, Ньютон (шаг 24); при огромных n — SGD', why: 'Гладкая выпуклая задача — классика методов второго порядка.' },
    { key: 'lasso', name: 'Lasso (L1-регрессия)', vars: ['непрерывные', 'good'], smooth: ['нет: излом |w| в нуле', 'warn'], convex: ['выпуклая', 'good'], cons: ['эквивалентна ‖w‖₁ ≤ C', ''], noise: ['детерминированная', 'good'], cost: ['дёшево', 'good'], info: 'градиент гладкой части + формула для |w|', method: 'покоординатный спуск, проксимальный градиент (шаги 19–20)', why: 'Негладкость в нуле — именно она даёт ровные нули; обычный градиентный спуск их не получает.' },
    { key: 'nn', name: 'Нейросеть', vars: ['непрерывные, миллионы', 'warn'], smooth: ['почти гладкая (ReLU)', 'warn'], convex: ['нет', 'bad'], cons: ['нет', 'good'], noise: ['мини-батчи', 'warn'], cost: ['градиент по всем данным дорог', 'bad'], info: 'стохастический градиент', method: 'SGD с моментумом, Adam (шаги 21–27)', why: 'Гессиан не помещается в память, данных много — только дешёвые стохастические шаги первого порядка.' },
    { key: 'lp', name: 'Распределение ресурсов (план производства)', vars: ['непрерывные', 'good'], smooth: ['линейная', 'good'], convex: ['выпуклая (линейная)', 'good'], cons: ['линейные неравенства', 'warn'], noise: ['детерминированная', 'good'], cost: ['дёшево', 'good'], info: 'всё известно явно', method: 'линейное программирование: симплекс-метод (шаг 31)', why: 'Оптимум всегда в вершине многоугольника допустимых планов.' },
  ];
  GBC.widget('task-map', (el) => {
    const s = { t: 'hyper' };
    const w = ui.shell(el, { title: 'Карта задач оптимизации', sub: 'Выберите задачу — увидите её «паспорт»: какие переменные, гладкая ли и выпуклая ли функция, есть ли ограничения и шум, сколько стоит одно вычисление и что мы о функции знаем. От паспорта зависит метод.', foot: false });
    ui.select(w.controls, { label: 'Задача', value: s.t, options: TASKS.map((t) => ({ value: t.key, label: t.name })), onChange: (v) => ((s.t = v), draw()) });
    const box = H('div');
    w.main.appendChild(box);
    const note = w.note('', true);
    function draw() {
      const T = TASKS.find((t) => t.key === s.t);
      box.textContent = '';
      const g = cardGrid(190);
      const rows = [['Переменные', T.vars], ['Гладкость', T.smooth], ['Выпуклость', T.convex], ['Ограничения', T.cons], ['Шум', T.noise], ['Цена вычисления f', T.cost]];
      for (const [k, v] of rows) {
        const c = card(k);
        const bd = badge(v[0], v[1]);
        bd.style.whiteSpace = 'normal';
        c.body.appendChild(bd);
        g.appendChild(c.el);
      }
      box.appendChild(g);
      const g2 = cardGrid(260);
      const ci = card('Что знаем о функции');
      ci.body.textContent = T.info;
      const cm = card('Подходящий метод');
      cm.body.textContent = T.method;
      g2.append(ci.el, cm.el);
      box.appendChild(g2);
      note.innerHTML = T.why + ' Чем больше «зелёного» в паспорте, тем мощнее подходящие методы и тем крепче гарантии; «красное» — повод для перебора, эвристик и осторожности.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 4. Выпуклые множества
   * ============================================================================== */
  const SETS = {
    disk: { label: 'круг x² + y² ≤ 1', inn: (x, y) => x * x + y * y <= 1, A: [-0.7, 0.4], B: [0.6, -0.5], convex: true },
    square: { label: 'квадрат max(|x|, |y|) ≤ 0.9', inn: (x, y) => Math.max(Math.abs(x), Math.abs(y)) <= 0.9, A: [-0.8, 0.8], B: [0.8, -0.3], convex: true },
    diamond: { label: 'ромб |x| + |y| ≤ 1.2 (шар L1)', inn: (x, y) => Math.abs(x) + Math.abs(y) <= 1.2, A: [-1, 0.1], B: [0.2, 0.9], convex: true },
    poly: { label: 'многоугольник из полуплоскостей', inn: (x, y) => x + 2 * y <= 1.5 && x >= -1.2 && y >= -1 && 2 * x - y <= 1.5, A: [-1.1, 1.2], B: [1.1, 0.1], convex: true },
    lens: { label: 'пересечение двух кругов', inn: (x, y) => (x - 0.5) ** 2 + y * y <= 1 && (x + 0.5) ** 2 + y * y <= 1, A: [0, 0.8], B: [0, -0.8], convex: true },
    star: { label: '«звезда» √|x| + √|y| ≤ 1.1', inn: (x, y) => Math.sqrt(Math.abs(x)) + Math.sqrt(Math.abs(y)) <= 1.1, A: [1, 0], B: [0, 1], convex: false },
    ring: { label: 'кольцо 0.6 ≤ r ≤ 1.3', inn: (x, y) => { const r = Math.hypot(x, y); return r >= 0.6 && r <= 1.3; }, A: [-1, 0.2], B: [1, -0.2], convex: false },
    union: { label: 'объединение двух кругов', inn: (x, y) => (x - 0.75) ** 2 + y * y <= 0.42 || (x + 0.75) ** 2 + y * y <= 0.42, A: [-0.9, 0.3], B: [0.9, 0.3], convex: false },
  };
  GBC.widget('convex-sets', (el) => {
    const s = { set: 'star', P: [SETS.star.A.slice(), SETS.star.B.slice()] };
    const w = ui.shell(el, { title: 'Выпуклое множество: отрезок не выходит наружу', sub: 'Множество выпукло, если вместе с любыми двумя точками содержит весь отрезок между ними. Перетаскивайте точки A и B: сплошная часть отрезка — внутри, красный пунктир — снаружи.' });
    ui.select(w.controls, { label: 'Множество', value: s.set, options: Object.entries(SETS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.set = v), (s.P = [SETS[v].A.slice(), SETS[v].B.slice()]), draw()) });
    const box = H('div', { style: 'max-width:440px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 360, equal: true, x: { label: 'x', domain: [-1.6, 1.6] }, y: { label: 'y', domain: [-1.6, 1.6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ab', label: 'A и B внутри?' }, { key: 'seg', label: 'отрезок внутри?' }, { key: 'rand', label: 'плохих пар среди 2000 случайных' }, { key: 'v', label: 'вывод' }]);
    const cache = {};
    function randomShare(S0, key) {
      if (cache[key] !== undefined) return cache[key];
      const rng = new GBC.RNG(7);
      const draw1 = () => {
        for (;;) {
          const x = rng.uniform(-1.6, 1.6);
          const y = rng.uniform(-1.6, 1.6);
          if (S0.inn(x, y)) return [x, y];
        }
      };
      let bad = 0;
      for (let k = 0; k < 2000; k++) {
        const a = draw1();
        const b = draw1();
        for (let t = 1; t < 30; t++) {
          const u = t / 30;
          if (!S0.inn(a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1]))) {
            bad++;
            break;
          }
        }
      }
      cache[key] = bad / 2000;
      return cache[key];
    }
    function draw() {
      const S0 = SETS[s.set];
      const grid = GBC.Plot.grid((x, y) => (S0.inn(x, y) ? 1 : 0), -1.6, 1.6, -1.6, 1.6, 160, 160);
      const inC = GBC.colors.rgb('model');
      const [A, B] = s.P;
      const N = 300;
      const xs = [];
      const yIn = [];
      const yOut = [];
      const ysRaw = [];
      let allIn = true;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const x = A[0] + u * (B[0] - A[0]);
        const y = A[1] + u * (B[1] - A[1]);
        const ok = S0.inn(x, y);
        if (!ok) allIn = false;
        xs.push(x);
        ysRaw.push(y);
        yIn.push(ok ? y : NaN);
        yOut.push(ok ? NaN : y);
      }
      // склеить края кусков, чтобы пунктир и сплошная линия касались
      for (let i = 1; i <= N; i++) {
        if (Number.isNaN(yOut[i]) !== Number.isNaN(yOut[i - 1])) {
          yOut[i] = ysRaw[i];
          yOut[i - 1] = ysRaw[i - 1];
        }
      }
      plot.render([
        { type: 'heatmap', grid, colorFn: (v) => (v ? [inC[0], inC[1], inC[2], 70] : [0, 0, 0, 0]) },
        { type: 'contour', grid, level: 0.5, color: 'model', width: 1.6 },
        { type: 'line', x: xs, y: yIn, color: 'model', width: 3.2, hover: false },
        { type: 'line', x: xs, y: yOut, color: 'red', width: 2.6, dash: '6 4', hover: false },
        { type: 'points', x: [A[0], B[0]], y: [A[1], B[1]], color: 'tree', r: 7, draggable: true, onDrag: (i, nx, ny) => ((s.P[i] = [nx, ny]), draw()) },
        { type: 'text', items: [{ x: A[0], y: A[1], dx: 10, dy: -10, text: 'A', bold: true }, { x: B[0], y: B[1], dx: 10, dy: -10, text: 'B', bold: true }] },
      ]);
      const aIn = S0.inn(A[0], A[1]);
      const bIn = S0.inn(B[0], B[1]);
      const share = randomShare(S0, s.set);
      st.set('ab', (aIn ? 'да' : 'нет') + ' / ' + (bIn ? 'да' : 'нет'));
      st.set('seg', aIn && bIn ? (allIn ? 'да' : 'нет') : '—');
      st.set('rand', pct(share, 1));
      st.set('v', S0.convex ? 'выпуклое' : 'невыпуклое');
      note.innerHTML = S0.convex
        ? 'Выпуклое множество: ни одна из 2000 случайных пар не дала отрезка, выходящего наружу (проверка не доказательство, но подсказка). Круг, квадрат и ромб — шары норм L2, L∞ и L1; многоугольник — пересечение полуплоскостей: так выглядят допустимые множества с линейными ограничениями (шаги 28, 31). Пересечение выпуклых множеств всегда выпукло.'
        : 'Невыпуклое: нашлись точки, отрезок между которыми выходит наружу (среди случайных пар таких ' + pct(share, 1) + '). На невыпуклом допустимом множестве спуск может застрять у «внутреннего угла» — локального оптимума. Объединение выпуклых множеств выпуклым быть не обязано; «звезда» — шар квазинормы L½, она ещё сильнее, чем L1, тянет решения на оси.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 5. Условия оптимальности на отрезке
   * ============================================================================== */
  const OPTF = {
    smooth: { label: 'гладкая: (x − 1)² + 0.5', f: (x) => (x - 1) ** 2 + 0.5, d: (x) => 2 * (x - 1), kink: null },
    kink: { label: 'с изломом: |x − 1| + 0.3x', f: (x) => Math.abs(x - 1) + 0.3 * x, d: (x) => (x > 1 ? 1.3 : x < 1 ? -0.7 : NaN), kink: { x: 1, l: -0.7, r: 1.3 } },
    flat: { label: 'плоское дно: max(0, |x| − 1)²', f: (x) => Math.max(0, Math.abs(x) - 1) ** 2, d: (x) => (Math.abs(x) > 1 ? 2 * (Math.abs(x) - 1) * Math.sign(x) : 0), kink: null },
    cubic: { label: 'кубическая: x³ − 3x', f: (x) => x ** 3 - 3 * x, d: (x) => 3 * x * x - 3, kink: null },
  };
  GBC.widget('optimality', (el) => {
    const s = { fn: 'smooth', a: 1.5, b: 2.8 };
    const w = ui.shell(el, { title: 'Где минимум и как его узнать', sub: 'Ищем минимум f на отрезке [a, b]. Внутри отрезка у гладкой функции в минимуме f′ = 0; на краю производная может быть и ненулевой — но с «правильным» знаком; в изломе ноль должен попасть между наклонами слева и справа.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(OPTF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), draw()) });
    const sa = ui.slider(w.controls, { label: 'Левый край a', min: -3, max: 2.5, step: 0.1, value: s.a, format: f1, onInput: (v) => ((s.a = Math.min(v, s.b - 0.3)), draw()) });
    const sb = ui.slider(w.controls, { label: 'Правый край b', min: -2.5, max: 3, step: 0.1, value: s.b, format: f1, onInput: (v) => ((s.b = Math.max(v, s.a + 0.3)), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x', domain: [-3, 3] }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 170, x: { label: 'x', domain: [-3, 3] }, y: { label: 'f′(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'минимум на [a, b]' }, { key: 'where', label: 'где' }, { key: 'cond', label: 'условие' }]);
    function draw() {
      const F = OPTF[s.fn];
      const { a, b } = s;
      const xs = U.linspace(-3, 3, 601);
      const xi = U.linspace(a, b, 4001);
      const fi = xi.map(F.f);
      const fm = Math.min(...fi);
      const tol = 1e-9 * Math.max(1, Math.abs(fm));
      const argm = xi.filter((x, i) => fi[i] <= fm + tol);
      const xL = argm[0];
      const xR = argm[argm.length - 1];
      const xm = (xL + xR) / 2;
      const flat = xR - xL > 0.01;
      const eps = (b - a) * 1e-3;
      let where;
      let cond;
      let txt;
      if (flat) {
        where = 'целый отрезок [' + f2(xL) + ', ' + f2(xR) + ']';
        cond = 'f′ = 0 на всём отрезке';
        txt = 'Минимум не единственный: f постоянна на [' + f2(xL) + ', ' + f2(xR) + ']. Так бывает у выпуклых, но не строго выпуклых функций; argmin — множество, и разные методы вернут разные его точки (у гребневой регрессии λ &gt; 0 делает решение единственным — урок 15.12).';
      } else if (Math.abs(xm - a) < eps) {
        where = 'левый край a';
        const dv = F.d(a + 1e-9);
        cond = 'f′(a) = ' + f2(dv) + ' ≥ 0';
        txt = 'Минимум на левом краю, и производная там <b>не ноль</b>: f′(a) = ' + f2(dv) + ' &gt; 0 — функция растёт внутрь отрезка, а двигаться влево запрещает ограничение. Это «условие оптимальности с ограничением»: на левой границе нужно f′ ≥ 0, на правой f′ ≤ 0. В многомерном случае это превращается в условия Каруша — Куна — Таккера (шаг 28).';
      } else if (Math.abs(xm - b) < eps) {
        where = 'правый край b';
        const dv = F.d(b - 1e-9);
        cond = 'f′(b) = ' + f2(dv) + ' ≤ 0';
        txt = 'Минимум на правом краю: f′(b) = ' + f2(dv) + ' &lt; 0 — функция ещё убывает, но идти дальше вправо нельзя. Ноль производной искать бесполезно: его на отрезке нет (или он — не минимум).';
      } else if (F.kink && Math.abs(xm - F.kink.x) < 0.01) {
        where = 'излом внутри';
        cond = '0 ∈ [' + f2(F.kink.l) + ', ' + f2(F.kink.r) + ']';
        txt = 'В изломе x = 1 производной нет, но есть наклоны слева (' + f2(F.kink.l) + ') и справа (' + f2(F.kink.r) + '). Любое число между ними — <b>субградиент</b>; их множество ∂f(1) = [' + f2(F.kink.l) + ', ' + f2(F.kink.r) + '] содержит 0 — это и есть условие минимума для негладкой выпуклой функции (урок 15.5). Так устроены MAE, L1-штраф и шарнирные потери.';
      } else {
        where = 'внутри';
        cond = 'f′ = ' + sci(F.d(xm));
        txt = 'Минимум внутри отрезка, и там f′(x*) = 0: касательная горизонтальна. Это необходимое условие; для гладкой функции его дополняет f″(x*) &gt; 0 (урок 15.7), а для выпуклой f′ = 0 уже достаточно. На практике «ноль» означает |f′| &lt; ε: так формулируют критерий остановки методов.';
      }
      const dIn = (x) => (x >= a && x <= b ? F.f(x) : NaN);
      const L1 = [
        { type: 'vband', x0: a, x1: b, color: 'model', opacity: 0.08 },
        { type: 'line', x: xs, y: xs.map(F.f), color: 'muted', width: 1.4, dash: '4 4', hover: false },
        { type: 'line', x: xs, y: xs.map(dIn), color: 'model', width: 2.6, hover: false },
      ];
      if (F.kink && !flat && Math.abs(xm - F.kink.x) < 0.01) {
        const k0 = F.kink;
        const y0 = F.f(k0.x);
        for (const sl of [k0.l, -0.2, 0, 0.6, k0.r]) L1.push({ type: 'line', x: [k0.x - 0.8, k0.x + 0.8], y: [y0 - 0.8 * sl, y0 + 0.8 * sl], color: 'tree', width: sl === 0 ? 2 : 1, opacity: sl === 0 ? 1 : 0.55, hover: false });
      } else if (!flat) {
        const dv = F.d(Math.min(Math.max(xm, a + 1e-9), b - 1e-9));
        const y0 = F.f(xm);
        L1.push({ type: 'line', x: [xm - 0.7, xm + 0.7], y: [y0 - 0.7 * dv, y0 + 0.7 * dv], color: 'tree', width: 2, hover: false });
      } else {
        L1.push({ type: 'line', x: [xL, xR], y: [fm, fm], color: 'tree', width: 5, hover: false });
      }
      L1.push({ type: 'points', x: [xm], y: [F.f(xm)], color: 'tree', r: 7 });
      const fy = xs.map(F.f);
      p1.render(L1, { y: yDom(fy.filter((v) => v < 12), 0.06) });
      const dvals = xs.map((x) => (F.kink && Math.abs(x - F.kink.x) < 1e-9 ? NaN : F.d(x)));
      p2.render([
        { type: 'vband', x0: a, x1: b, color: 'model', opacity: 0.08 },
        { type: 'hline', y: 0, color: 'ink2', width: 1 },
        { type: 'line', x: xs, y: dvals, color: 'violet', width: 2, hover: false },
        F.kink ? { type: 'line', x: [F.kink.x, F.kink.x], y: [F.kink.l, F.kink.r], color: 'tree', width: 4, hover: false } : null,
      ], { y: yDom(dvals.filter((v) => Math.abs(v) < 30), 0.06, [0]) });
      st.set('x', flat ? f2(xL) + ' … ' + f2(xR) : f3(xm));
      st.set('where', where);
      st.set('cond', cond);
      note.innerHTML = txt;
      sa.set(s.a);
      sb.set(s.b);
    }
    w.pythonAction(() => PY_NP + 'from scipy.optimize import minimize_scalar\n\nf = lambda x: ' + { smooth: '(x - 1)**2 + 0.5', kink: 'abs(x - 1) + 0.3 * x', flat: 'max(0, abs(x) - 1)**2', cubic: 'x**3 - 3 * x' }[s.fn] + '\na, b = ' + py(s.a) + ', ' + py(s.b) + '\nres = minimize_scalar(f, bounds=(a, b), method="bounded", options={"xatol": 1e-9})\nx = res.x\nh = 1e-6\nprint(f"минимум на [{a}, {b}]: x* = {x:.5f}, f = {f(x):.5f}")\nprint("наклон слева ≈", round((f(x) - f(x - h)) / h, 4), " справа ≈", round((f(x + h) - f(x)) / h, 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 6. Сетка и проклятие размерности
   * ============================================================================== */
  GBC.widget('grid-curse', (el) => {
    const s = { d: 4, k: 5, t: 60 };
    const w = ui.shell(el, { title: 'Проклятие размерности: сколько стоит сетка', sub: 'Сетка из k значений по каждому из d гиперпараметров — это k^d запусков. Одна ось — ещё дёшево, но каждая новая ось умножает бюджет в k раз.' });
    ui.slider(w.controls, { label: 'Гиперпараметров d', min: 1, max: 10, step: 1, value: s.d, format: String, onInput: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'Значений на оси k', values: [2, 3, 5, 10], value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.select(w.controls, { label: 'Одно обучение длится', value: '60', options: [{ value: '1', label: '1 секунду' }, { value: '60', label: '1 минуту' }, { value: '600', label: '10 минут' }, { value: '3600', label: '1 час' }], onChange: (v) => ((s.t = +v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'число гиперпараметров d', domain: [0.5, 10.5], ticks: U.range(10, 1) }, y: { label: 'запусков (лог. шкала)', type: 'log', domain: [1, 1e10], ticks: decades(0, 10, 2), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'запусков сетки' }, { key: 't', label: 'время на одной машине' }, { key: 'r', label: 'случайный поиск для попадания в лучшие 5 %' }]);
    function draw() {
      const ds = U.range(10, 1);
      const L = [{ type: 'hline', y: 86400 / s.t, color: 'muted', dash: '5 4', width: 1.2, text: 'сутки вычислений' }];
      const colors = { 2: 'aqua', 3: 'violet', 5: 'model', 10: 'tree' };
      for (const k of [2, 3, 5, 10]) {
        L.push({ type: 'line', x: ds, y: ds.map((d) => Math.pow(k, d)), color: colors[k], width: k === s.k ? 2.6 : 1.4, opacity: k === s.k ? 1 : 0.55, label: 'k = ' + k, hover: false });
      }
      L.push({ type: 'hline', y: 59, color: 'ink2', dash: '2 3', width: 1.2, text: '59 случайных точек' });
      L.push({ type: 'points', x: [s.d], y: [Math.pow(s.k, s.d)], color: colors[s.k], r: 7 });
      plot.render(L);
      const n = Math.pow(s.k, s.d);
      st.set('n', n.toLocaleString('ru-RU'));
      st.set('t', human(n * s.t));
      st.set('r', '59 при любом d');
      note.innerHTML = 'Сетка ' + s.k + ' значений × ' + s.d + ' ' + plural(s.d, 'ось', 'оси', 'осей') + ' = ' + n.toLocaleString('ru-RU') + ' обучений, ' + human(n * s.t) + ' вычислений. При этом по каждой оси сетка пробует всего ' + s.k + ' ' + plural(s.k, 'значение', 'значения', 'значений') + '. Случайный поиск устроен иначе: вероятность, что хотя бы одна из n случайных точек попадёт в лучшие 5 % пространства, равна 1 − 0.95ⁿ, и от размерности она <b>не зависит</b>: 59 точек дают 95 % при любом d (шаг 7).';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 7. Сетка против случайного поиска
   * ============================================================================== */
  GBC.widget('grid-vs-random', (el) => {
    const s = { n: 9, seed: 5 };
    // качество модели: сильно зависит от x (темп обучения), почти не зависит от y
    const score = (x, y) => Math.exp(-(((x - 0.37) / 0.08) ** 2)) * (1 + 0.05 * Math.sin(6 * y));
    const good = 0.08 * Math.sqrt(-Math.log(0.9));
    const w = ui.shell(el, { title: 'Подбор гиперпараметров: сетка или случайный поиск?', sub: 'Качество модели (темнее — лучше) сильно зависит от x и почти не зависит от y. Бюджет — n запусков обучения. Сверху сетка, снизу случайные точки. Внизу каждого графика — какие значения x реально попробованы.' });
    ui.slider(w.controls, { label: 'Бюджет n запусков', values: [4, 9, 16, 25, 36], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Другие случайные точки', onClick: () => (s.seed++, draw()) });
    const opt = { height: 230, x: { label: 'x — важный параметр', domain: [0, 1] }, y: { label: 'y — неважный', domain: [-0.1, 1] }, grid: 'none' };
    const p1 = new GBC.Plot(w.main, opt);
    const p2 = new GBC.Plot(w.main, Object.assign({}, opt));
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'лучшее на сетке' }, { key: 'r', label: 'лучшее случайно' }, { key: 'avg', label: 'случайно, в среднем по 500 повторам' }, { key: 'hit', label: 'P(случайный поиск попал в полосу)' }]);
    function bestRandom(seed, n) {
      const rng = new GBC.RNG(seed);
      const pts = U.range(n).map(() => [rng.random(), rng.random()]);
      return { pts, best: Math.max(...pts.map((p) => score(p[0], p[1]))) };
    }
    const base = mapLayers((x, y) => 1 - score(x, y), [0, 1, 0, 1], [0.2, 0.5, 0.8]);
    function layersFor(P) {
      return [
        ...base,
        { type: 'vband', x0: 0.37 - good, x1: 0.37 + good, color: 'good', opacity: 0.18 },
        { type: 'points', x: P.map((p) => p[0]), y: P.map((p) => p[1]), color: 'tree', r: 5, tooltip: (i) => [['качество', U.fmt(score(P[i][0], P[i][1]), 3)]] },
        { type: 'points', x: P.map((p) => p[0]), y: P.map(() => -0.05), color: 'ink2', r: 3 },
      ];
    }
    function draw() {
      const k = Math.round(Math.sqrt(s.n));
      const gv = U.linspace(0, 1, k);
      const gpts = gv.flatMap((x) => gv.map((y) => [x, y]));
      const gBest = Math.max(...gpts.map((p) => score(p[0], p[1])));
      const R0 = bestRandom(1000 + s.seed, s.n);
      p1.setTitle('сетка ' + k + '×' + k + ': различных x всего ' + k);
      p2.setTitle('случайно: различных x — ' + s.n);
      p1.render(layersFor(gpts));
      p2.render(layersFor(R0.pts));
      let acc = 0;
      for (let r = 0; r < 500; r++) acc += bestRandom(5000 + r, s.n).best;
      const hit = 1 - Math.pow(1 - 2 * good, s.n);
      st.set('g', f3(gBest));
      st.set('r', f3(R0.best));
      st.set('avg', f3(acc / 500));
      st.set('hit', pct(hit));
      note.innerHTML = 'Зелёная полоса — «хорошие» x (качество ≥ 0.9): ширина ' + f3(2 * good) + ', то есть ' + pct(2 * good, 1) + ' отрезка. Сетка ' + k + '×' + k + ' тратит бюджет на повторы неважного y и пробует лишь ' + k + ' разных x — в полосу она ' + (gBest >= 0.9 ? 'случайно попала' : 'не попала') + '. Случайный поиск пробует ' + s.n + ' разных x, и вероятность задеть полосу хотя бы раз равна 1 − (1 − ' + f3(2 * good) + ')^' + s.n + ' ≈ ' + pct(hit) + '. Иногда сетке везёт (при n = 16 значение x = 1/3 ≈ 0.333 близко к лучшему 0.37), но в среднем выигрывает случайный поиск — и тем сильнее, чем больше неважных параметров.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nscore = lambda x, y: np.exp(-((x - 0.37) / 0.08)**2) * (1 + 0.05 * np.sin(6 * y))\nn = ' + s.n + '\nk = round(np.sqrt(n))\ng = np.linspace(0, 1, k)\nprint("лучшее на сетке:", round(max(score(a, b) for a in g for b in g), 3))\n\ndef best_random(seed):\n    r = Mulberry32(seed)\n    return max(score(r.random(), r.random()) for _ in range(n))\nprint("случайно (зерно ' + (1000 + s.seed) + '):", round(best_random(' + (1000 + s.seed) + '), 3))\nprint("в среднем по 500 повторам:", round(np.mean([best_random(5000 + r) for r in range(500)]), 3))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 7. Вероятность попасть в лучшие q %
   * ============================================================================== */
  GBC.widget('random-hit', (el) => {
    const s = { q: 0.05, conf: 0.95 };
    const w = ui.shell(el, { title: 'Сколько нужно случайных точек?', sub: 'Вероятность, что хотя бы одна из n независимых случайных точек попадёт в лучшие q % пространства: 1 − (1 − q)ⁿ. От числа гиперпараметров она не зависит.' });
    ui.slider(w.controls, { label: 'Доля лучших q', values: [0.01, 0.02, 0.05, 0.1], value: s.q, format: (v) => pct(v), onInput: (v) => ((s.q = v), draw()) });
    ui.slider(w.controls, { label: 'Нужная уверенность', values: [0.9, 0.95, 0.99], value: s.conf, format: (v) => pct(v), onInput: (v) => ((s.conf = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'число случайных точек n', domain: [0, 300] }, y: { label: 'P(хотя бы одна в лучших q)', domain: [0, 1.02] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'нужно точек' }, { key: 'p60', label: 'P при n = 60' }]);
    function draw() {
      const ns = U.range(301);
      const need = Math.ceil(Math.log(1 - s.conf) / Math.log(1 - s.q));
      const L = [];
      for (const q of [0.01, 0.02, 0.05, 0.1]) L.push({ type: 'line', x: ns, y: ns.map((n) => 1 - Math.pow(1 - q, n)), color: q === s.q ? 'model' : 'muted', width: q === s.q ? 2.6 : 1.2, opacity: q === s.q ? 1 : 0.6, label: q === s.q ? 'q = ' + pct(q) : null, hover: q === s.q });
      L.push({ type: 'hline', y: s.conf, color: 'ink2', dash: '4 4', width: 1.2 });
      if (need <= 300) {
        L.push({ type: 'vline', x: need, color: 'tree', dash: '4 4', width: 1.4, text: 'n = ' + need });
        L.push({ type: 'points', x: [need], y: [1 - Math.pow(1 - s.q, need)], color: 'tree', r: 6 });
      }
      plot.render(L);
      st.set('n', String(need));
      st.set('p60', pct(1 - Math.pow(1 - s.q, 60), 1));
      note.innerHTML = 'Чтобы с уверенностью ' + pct(s.conf) + ' задеть лучшие ' + pct(s.q) + ', нужно n = ⌈ln(1 − ' + s.conf + ') / ln(1 − ' + s.q + ')⌉ = ' + need + ' случайных точек. Знаменитое «60 точек» — это q = 5 %, уверенность 95 %. Но «лучшие 5 % пространства» — ещё не оптимум: если хорошая область узкая, нужно больше точек или умный поиск (шаг 13).';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nq, conf = ' + py(s.q) + ', ' + py(s.conf) + '\nn = int(np.ceil(np.log(1 - conf) / np.log(1 - q)))\nprint("нужно точек:", n)\n\n# проверка моделированием в 10-мерном кубе: попали ли в лучшие q % по f(x) = ||x − 0.3||²\nrng = Mulberry32(1)\nf = lambda x: ((x - 0.3)**2).sum()\nref = np.array([f(np.array([rng.random() for _ in range(10)])) for _ in range(20000)])\nthr = np.quantile(ref, q)\nhits = 0\nfor t in range(500):\n    best = min(f(np.array([rng.random() for _ in range(10)])) for _ in range(n))\n    hits += best <= thr\nprint(f"доля успехов в 500 опытах: {hits / 500:.3f} (теория {1 - (1 - q)**n:.3f})")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 8. Сужение отрезка: дихотомия, троичный поиск, золотое сечение
   * ============================================================================== */
  const SHRINKF = {
    exp: { label: 'eˣ − 3x на [0, 3]', f: (x) => Math.exp(x) - 3 * x, a: 0, b: 3, xs: Math.log(3), pyf: 'np.exp(x) - 3 * x' },
    abs: { label: '|x − 1.9| + 0.2x на [0, 3] (излом)', f: (x) => Math.abs(x - 1.9) + 0.2 * x, a: 0, b: 3, xs: 1.9, pyf: 'abs(x - 1.9) + 0.2 * x' },
    trap: { label: 'x⁴ − 4x² + x на [−2, 2.6] (две ямы)', f: (x) => x ** 4 - 4 * x * x + x, a: -2, b: 2.6, xs: -1.4729, pyf: 'x**4 - 4 * x**2 + x' },
  };
  function shrinkStates(F, method, maxE) {
    let a = F.a;
    let b = F.b;
    const states = [{ a, b, evals: 0, pts: [] }];
    if (method === 'golden') {
      const G = goldenRun(F.f, a, b, maxE);
      G.states.forEach((q, i) => states.push({ a: q.a, b: q.b, evals: q.evals, pts: G.pts.slice(0, q.evals), probe: [[q.c, q.fc], [q.d, q.fd]], i }));
      return states;
    }
    let e = 0;
    const pts = [];
    while (e + 2 <= maxE) {
      let x1;
      let x2;
      if (method === 'dich') {
        const m = (a + b) / 2;
        x1 = m - 1e-3;
        x2 = m + 1e-3;
      } else {
        x1 = a + (b - a) / 3;
        x2 = b - (b - a) / 3;
      }
      const v1 = F.f(x1);
      const v2 = F.f(x2);
      pts.push([x1, v1], [x2, v2]);
      e += 2;
      const probe = [[x1, v1], [x2, v2]];
      if (v1 < v2) b = x2;
      else a = x1;
      states.push({ a, b, evals: e, pts: pts.slice(), probe });
    }
    return states;
  }
  const atEvals = (states, E) => {
    let q = states[0];
    for (const t of states) if (t.evals <= E) q = t;
    return q;
  };
  GBC.widget('interval-shrink', (el) => {
    const s = { fn: 'exp', m: 'golden', E: 8 };
    const MAXE = 30;
    const w = ui.shell(el, { title: 'Сужаем отрезок: дихотомия, троичный поиск, золотое сечение', sub: 'Все три метода сравнивают значения f в двух точках и выбрасывают часть отрезка, где минимума быть не может (если яма одна). Различаются тем, сколько вычислений f тратят на шаг. Ползунок — бюджет вычислений.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(SHRINKF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), draw()) });
    ui.segmented(w.controls, { label: 'Метод на верхнем графике', value: s.m, options: [{ value: 'dich', label: 'дихотомия' }, { value: 'ternary', label: 'троичный' }, { value: 'golden', label: 'золотое' }], onChange: (v) => ((s.m = v), draw()) });
    ui.player(w.controls, { label: 'Вычислений f', min: 0, max: MAXE, value: s.E, fps: 2, format: (v) => v + ' выч.', onChange: (v) => ((s.E = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'вычислений f', domain: [0, MAXE] }, y: { label: 'длина отрезка (лог.)', type: 'log', domain: [1e-5, 10], ticks: decades(-5, 1), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ab', label: 'отрезок' }, { key: 'len', label: 'длина' }, { key: 'x', label: 'лучшая точка' }, { key: 'err', label: 'ошибка |x − x*|' }]);
    function draw() {
      const F = SHRINKF[s.fn];
      const all = { dich: shrinkStates(F, 'dich', MAXE), ternary: shrinkStates(F, 'ternary', MAXE), golden: shrinkStates(F, 'golden', MAXE) };
      const q = atEvals(all[s.m], s.E);
      const xs = U.linspace(F.a, F.b, 400);
      const ys = xs.map(F.f);
      const L1 = [
        { type: 'vband', x0: q.a, x1: q.b, color: 'model', opacity: 0.13 },
        { type: 'line', x: xs, y: ys, color: 'model', width: 2.2, hover: false },
        { type: 'vline', x: F.xs, color: 'truth', dash: '5 4', width: 1.2, text: 'x*' },
      ];
      if (q.pts.length) L1.push({ type: 'points', x: q.pts.map((p) => p[0]), y: q.pts.map((p) => p[1]), color: 'ink2', r: 3.5, opacity: 0.7 });
      if (q.probe) L1.push({ type: 'points', x: q.probe.map((p) => p[0]), y: q.probe.map((p) => p[1]), color: 'tree', r: 6 });
      p1.render(L1, { x: [F.a, F.b], y: yDom(ys, 0.06) });
      const L2 = [];
      const col = { dich: 'violet', ternary: 'aqua', golden: 'tree' };
      const nm = { dich: 'дихотомия', ternary: 'троичный', golden: 'золотое сечение' };
      for (const m of ['dich', 'ternary', 'golden']) {
        const S0 = all[m];
        const ex = [];
        const ly = [];
        S0.forEach((t, i) => {
          if (i > 0) {
            ex.push(t.evals);
            ly.push(S0[i - 1].b - S0[i - 1].a);
          }
          ex.push(t.evals);
          ly.push(t.b - t.a);
        });
        ex.push(MAXE);
        ly.push(ly[ly.length - 1]);
        L2.push({ type: 'line', x: ex, y: ly, color: col[m], width: m === s.m ? 2.6 : 1.6, label: nm[m] });
      }
      L2.push({ type: 'vline', x: s.E, color: 'ink2', dash: '3 3', width: 1 });
      p2.render(L2);
      const best = q.pts.length ? q.pts.reduce((m0, p) => (p[1] < m0[1] ? p : m0)) : [(q.a + q.b) / 2, F.f((q.a + q.b) / 2)];
      const len = q.b - q.a;
      st.set('ab', '[' + f4(q.a) + ', ' + f4(q.b) + ']');
      st.set('len', sci(len));
      st.set('x', f4(best[0]));
      st.set('err', sci(Math.abs(best[0] - F.xs)));
      const per = { dich: '≈ 0.5 на 2 вычисления (≈ 0.71 на одно)', ternary: '2/3 на 2 вычисления (≈ 0.82 на одно)', golden: '0.618 на одно вычисление' }[s.m];
      note.innerHTML = (s.fn === 'trap'
        ? 'Ловушка: у функции две ямы, и уже первое сравнение f(' + f2(all.golden[1].probe[0][0]) + ') против f(' + f2(all.golden[1].probe[1][0]) + ') отбрасывает левую часть с глобальным минимумом x* ≈ −1.473. Все три метода честно сходятся к <b>локальному</b> минимуму x ≈ 1.347. Предпосылка «одна яма» (унимодальность) — не формальность. '
        : '') + 'Сжатие отрезка: ' + per + '. Дихотомия сравнивает две точки вплотную у середины и выбрасывает почти половину; троичный поиск — треть; золотое сечение — 38 %, но одна из старых точек снова оказывается на «золотом» месте, и новое вычисление нужно всего одно. За 30 вычислений: дихотомия — ' + sci(all.dich[all.dich.length - 1].b - all.dich[all.dich.length - 1].a) + ', троичный — ' + sci(all.ternary[all.ternary.length - 1].b - all.ternary[all.ternary.length - 1].a) + ', золотое — ' + sci(all.golden[all.golden.length - 1].b - all.golden[all.golden.length - 1].a) + '. Если вычисление f — это обучение модели, разница огромна.';
    }
    w.pythonAction(() => {
      const F = SHRINKF[s.fn];
      return PY_NP + PY_GOLDEN + '\nf = lambda x: ' + F.pyf + '\nA, B = ' + py(F.a) + ', ' + py(F.b) + '\n\ndef two_point(f, a, b, evals, method):\n    """Дихотомия (две точки у середины) или троичный поиск: 2 вычисления на шаг."""\n    for _ in range(evals // 2):\n        if method == "dich":\n            m = (a + b) / 2; x1, x2 = m - 1e-3, m + 1e-3\n        else:\n            x1, x2 = a + (b - a) / 3, b - (b - a) / 3\n        if f(x1) < f(x2):\n            b = x2\n        else:\n            a = x1\n    return a, b\n\nfor E in (10, 20, 30):\n    d = two_point(f, A, B, E, "dich"); t = two_point(f, A, B, E, "ternary"); g = golden(f, A, B, E)\n    print(f"{E} вычислений: дихотомия {d[1] - d[0]:.2e}, троичный {t[1] - t[0]:.2e}, золотое {g[1] - g[0]:.2e}")\n\nfrom scipy.optimize import minimize_scalar\nres = minimize_scalar(f, bounds=(A, B), method="bounded")   # Брент на отрезке\nprint("scipy (bounded):", round(res.x, 5), "вычислений", res.nfev)\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 9. Параболическая интерполяция
   * ============================================================================== */
  const PARF = {
    exp: { label: 'eˣ − 3x, старт 0, 1.5, 3', f: (x) => Math.exp(x) - 3 * x, x0: [0, 1.5, 3], xs: Math.log(3), dom: [-0.2, 3.2], ab: [0, 3], pyf: 'np.exp(x) - 3 * x' },
    quartic: { label: '(x − 1)⁴, старт 0, 0.5, 3', f: (x) => (x - 1) ** 4, x0: [0, 0.5, 3], xs: 1, dom: [-0.3, 3.2], ab: [0, 3], pyf: '(x - 1)**4' },
    trap: { label: 'x⁴ − 4x² + x, старт −0.6, 0.1, 0.7', f: (x) => x ** 4 - 4 * x * x + x, x0: [-0.6, 0.1, 0.7], xs: -1.4729, dom: [-2.2, 2.2], ab: [-2, 2], pyf: 'x**4 - 4 * x**2 + x' },
  };
  /** Вершина параболы через три точки; A — старший коэффициент. */
  function parabola(p) {
    const [[x0, y0], [x1, y1], [x2, y2]] = p;
    const d01 = (y1 - y0) / (x1 - x0);
    const d12 = (y2 - y1) / (x2 - x1);
    const A = (d12 - d01) / (x2 - x0);
    const v = (x0 + x1) / 2 - d01 / (2 * A);
    return { A, v, at: (x) => y0 + d01 * (x - x0) + A * (x - x0) * (x - x1) };
  }
  function spiRun(F, K = 14) {
    const pts = F.x0.map((x) => [x, F.f(x)]);
    const hist = [];
    for (let k = 0; k < K; k++) {
      const last = pts.slice(-3);
      const P = parabola(last);
      if (!Number.isFinite(P.v) || Math.abs(P.A) < 1e-300) break;
      if (pts.some((q) => Math.abs(q[0] - P.v) < 1e-15)) break;
      hist.push({ last, P, v: P.v });
      pts.push([P.v, F.f(P.v)]);
    }
    return { pts, hist };
  }
  GBC.widget('parabolic', (el) => {
    const s = { fn: 'exp', k: 1 };
    const w = ui.shell(el, { title: 'Параболическая интерполяция: прыжок в дно параболы', sub: 'Через три последние точки проводим параболу и вычисляем f в её вершине. Не нужна производная — только значения, а сходимость гораздо быстрее золотого сечения… когда функция похожа на параболу.' });
    ui.select(w.controls, { label: 'Функция и старт', value: s.fn, options: Object.entries(PARF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.k = 1), pl.set(1), draw()) });
    const pl = ui.player(w.controls, { label: 'Шаг', min: 0, max: 10, value: s.k, fps: 1.2, format: (v) => 'шаг ' + v, onChange: (v) => ((s.k = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'вычислений f', domain: [3, 14] }, y: { label: 'ошибка |x − x*| (лог.)', type: 'log', domain: [1e-14, 10], ticks: decades(-14, 0, 2), format: powFmt } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'новая точка' }, { key: 'err', label: 'ошибка' }, { key: 'A', label: 'парабола' }]);
    function draw() {
      const F = PARF[s.fn];
      const run = spiRun(F);
      const K = Math.min(s.k, run.hist.length);
      const xs = U.linspace(F.dom[0], F.dom[1], 400);
      const ys = xs.map(F.f);
      const yd = yDom(ys, 0.06);
      const L1 = [{ type: 'line', x: xs, y: ys, color: 'model', width: 2.2, hover: false }, { type: 'vline', x: F.xs, color: 'truth', dash: '5 4', width: 1.2, text: 'x*' }];
      const seen = run.pts.slice(0, 3 + K);
      L1.push({ type: 'points', x: seen.map((p) => p[0]), y: seen.map((p) => p[1]), color: 'ink2', r: 3.5, opacity: 0.6 });
      let H0 = null;
      if (K < run.hist.length) {
        H0 = run.hist[K];
        L1.push({ type: 'line', x: xs, y: xs.map((x) => H0.P.at(x)), color: 'tree', width: 1.8, dash: '6 4', hover: false });
        L1.push({ type: 'points', x: H0.last.map((p) => p[0]), y: H0.last.map((p) => p[1]), color: 'ink', r: 5 });
        if (H0.v > F.dom[0] && H0.v < F.dom[1]) L1.push({ type: 'points', x: [H0.v], y: [F.f(H0.v)], color: 'tree', r: 7 });
      }
      p1.render(L1, { x: F.dom, y: yd });
      const errs = run.pts.slice(3).map((p, i) => [4 + i, Math.max(1e-16, Math.abs(p[0] - F.xs))]);
      const G = goldenRun(F.f, F.ab[0], F.ab[1], 14);
      const gerr = G.states.map((q) => {
        const b = q.fc < q.fd ? q.c : q.d;
        return [q.evals, Math.max(1e-16, Math.abs(b - F.xs))];
      });
      p2.render([
        { type: 'line', x: gerr.map((e) => e[0]), y: gerr.map((e) => e[1]), color: 'violet', width: 2, label: 'золотое сечение' },
        { type: 'line', x: errs.map((e) => e[0]), y: errs.map((e) => e[1]), color: 'tree', width: 2.4, label: 'параболы' },
        { type: 'points', x: errs.slice(0, K + 1).map((e) => e[0]), y: errs.slice(0, K + 1).map((e) => e[1]), color: 'tree', r: 4 },
      ]);
      const rows = run.pts.slice(3, 3 + Math.min(K + 1, run.hist.length)).map((p, i) => [String(i + 1), f4(p[0]), sci(Math.abs(p[0] - F.xs))]);
      rowTable(tbl, ['шаг', 'x_k', '|x_k − x*|'], rows.slice(-6));
      if (H0) {
        st.set('x', f4(H0.v));
        st.set('err', sci(Math.abs(H0.v - F.xs)));
        st.set('A', H0.P.A > 0 ? 'ветви вверх: вершина — минимум' : 'ветви вниз: вершина — максимум!');
      } else {
        st.set('x', '—');
        st.set('err', '—');
        st.set('A', 'точки слились');
      }
      const notes = {
        exp: 'eˣ − 3x вблизи минимума ln 3 почти парабола, и прыжки в вершину сходятся <b>сверхлинейно</b>: в среднем число верных знаков умножается примерно на 1.32 за шаг, хотя и не монотонно (у золотого сечения — фиолетовая линия — ошибка просто умножается на 0.618). Уже к 11-му вычислению ошибка ≈ 10⁻¹⁰, а дальше начинается шум округления: у дна f(x* + δ) − f(x*) ≈ ½f″δ², и при δ ≲ 10⁻⁸ эта разница тонет в машинной точности ~10⁻¹⁶. Поэтому минимум по одним значениям нельзя найти точнее, чем примерно √(машинная точность) — в отличие от корня уравнения.',
        quartic: 'У (x − 1)⁴ дно слишком плоское: f″(1) = 0, парабола — плохое приближение, и ошибка уменьшается лишь в постоянное число раз за шаг — <b>линейная</b> сходимость, не быстрее золотого сечения. Быстрые методы опираются на то, что вблизи минимума функция похожа на параболу (f″ &gt; 0).',
        trap: 'Ловушка: три стартовые точки лежат у локального максимума x ≈ 0.126, парабола через них смотрит ветвями <b>вниз</b>, и её вершина — максимум. Метод сходится к максимуму! Он ищет точку, где f′ = 0, а не минимум. Поэтому на практике используют <b>метод Брента</b> (scipy.optimize.minimize_scalar по умолчанию): он делает параболический шаг, только если тот разумен, а иначе — шаг золотого сечения.',
      };
      note.innerHTML = notes[s.fn];
    }
    w.pythonAction(() => {
      const F = PARF[s.fn];
      return PY_NP + 'from scipy.optimize import minimize_scalar\n\nf = lambda x: ' + F.pyf + '\nx_star = ' + py(F.xs) + '\npts = [(x, f(x)) for x in ' + JSON.stringify(F.x0) + ']\nfor k in range(1, 11):\n    (x0, y0), (x1, y1), (x2, y2) = pts[-3:]\n    d01, d12 = (y1 - y0) / (x1 - x0), (y2 - y1) / (x2 - x1)\n    A = (d12 - d01) / (x2 - x0)            # старший коэффициент параболы\n    if A == 0:\n        print("точки слились — парабола вырождена, стоп")\n        break\n    v =(x0 + x1) / 2 - d01 / (2 * A)       # её вершина\n    if any(abs(v - p[0]) < 1e-15 for p in pts):\n        break\n    pts.append((v, f(v)))\n    print(f"шаг {k:2d}: x = {v:.12f}, ошибка {abs(v - x_star):.1e}, ветви {\'вверх\' if A > 0 else \'вниз\'}")\n\nres = minimize_scalar(f, bracket=(' + F.x0[0] + ', ' + F.x0[1] + '), method="brent")\nprint("метод Брента (scipy):", round(res.x, 10), "за", res.nfev, "вычислений")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 10. Метод Нелдера — Мида (как в scipy.optimize)
   * ============================================================================== */
  const NMS = {
    banana: { S: SURF.banana, sim: [[-1.2, 1.5], [-0.95, 1.5], [-1.2, 1.75]] },
    bowl: { S: SURF.bowl, sim: [[-4, 1], [-3.5, 1], [-4, 1.5]] },
    corner: {
      S: { label: 'угол |x − 1| + 2|y − 0.5| (негладкая)', f: (x, y) => Math.abs(x - 1) + 2 * Math.abs(y - 0.5), dom: [-1.6, 1.6, -0.6, 2.2], levels: [0.25, 0.75, 1.5, 2.5, 3.5], min: [1, 0.5], py: 'f = lambda p: abs(p[0] - 1) + 2 * abs(p[1] - 0.5)\n' },
      sim: [[-1.2, 1.5], [-0.95, 1.5], [-1.2, 1.75]],
    },
  };
  function nelderMead(f, sim0, tol = 1e-4, maxIt = 400) {
    let sim = sim0.map((p) => p.slice());
    let fs = sim.map((p) => f(p[0], p[1]));
    let calls = 3;
    const order = () => {
      const idx = [0, 1, 2].sort((i, j) => fs[i] - fs[j]);
      sim = idx.map((i) => sim[i]);
      fs = idx.map((i) => fs[i]);
    };
    order();
    const hist = [{ sim: sim.map((p) => p.slice()), fs: fs.slice(), op: 'начальный симплекс', calls }];
    const ev = (p) => (calls++, f(p[0], p[1]));
    const comb = (a, x, b, y) => [a * x[0] + b * y[0], a * x[1] + b * y[1]];
    let it = 1;
    while (calls < 400 && it < maxIt) {
      const dx = Math.max(Math.abs(sim[1][0] - sim[0][0]), Math.abs(sim[1][1] - sim[0][1]), Math.abs(sim[2][0] - sim[0][0]), Math.abs(sim[2][1] - sim[0][1]));
      const df = Math.max(Math.abs(fs[0] - fs[1]), Math.abs(fs[0] - fs[2]));
      if (dx <= tol && df <= tol) break;
      const xbar = [(sim[0][0] + sim[1][0]) / 2, (sim[0][1] + sim[1][1]) / 2];
      const xr = comb(2, xbar, -1, sim[2]);
      const fr = ev(xr);
      let op;
      let shrink = false;
      if (fr < fs[0]) {
        const xe = comb(3, xbar, -2, sim[2]);
        const fe = ev(xe);
        if (fe < fr) {
          sim[2] = xe;
          fs[2] = fe;
          op = 'растяжение';
        } else {
          sim[2] = xr;
          fs[2] = fr;
          op = 'отражение';
        }
      } else if (fr < fs[1]) {
        sim[2] = xr;
        fs[2] = fr;
        op = 'отражение';
      } else if (fr < fs[2]) {
        const xc = comb(1.5, xbar, -0.5, sim[2]);
        const fc = ev(xc);
        if (fc <= fr) {
          sim[2] = xc;
          fs[2] = fc;
          op = 'сжатие наружу';
        } else shrink = true;
      } else {
        const xcc = comb(0.5, xbar, 0.5, sim[2]);
        const fcc = ev(xcc);
        if (fcc < fs[2]) {
          sim[2] = xcc;
          fs[2] = fcc;
          op = 'сжатие внутрь';
        } else shrink = true;
      }
      if (shrink) {
        for (const j of [1, 2]) {
          sim[j] = [sim[0][0] + 0.5 * (sim[j][0] - sim[0][0]), sim[0][1] + 0.5 * (sim[j][1] - sim[0][1])];
          fs[j] = ev(sim[j]);
        }
        op = 'сжатие всего симплекса';
      }
      it++;
      order();
      hist.push({ sim: sim.map((p) => p.slice()), fs: fs.slice(), op, calls });
    }
    return hist;
  }
  GBC.widget('nelder-mead', (el) => {
    const s = { k: 0, surf: 'banana' };
    const w = ui.shell(el, { title: 'Метод Нелдера — Мида: треугольник ползёт к минимуму', sub: 'Симплекс (на плоскости — треугольник) переворачивается через лучшую сторону, растягивается в удачном направлении и сжимается у дна. Нужны только значения f. Алгоритм и коэффициенты — как в scipy.optimize.minimize(method="Nelder-Mead").' });
    ui.select(w.controls, { label: 'Функция', value: s.surf, options: Object.entries(NMS).map(([k, v]) => ({ value: k, label: v.S.label })), onChange: (v) => ((s.surf = v), (s.k = 0), draw()) });
    const pl = ui.player(w.controls, { label: 'Итерация', min: 0, max: 100, value: 0, fps: 5, format: (v) => 'итерация ' + v, onChange: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 330, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'op', label: 'операция' }, { key: 'calls', label: 'вычислений f' }, { key: 'best', label: 'лучшая вершина' }, { key: 'f', label: 'f в ней' }]);
    function draw() {
      const N = NMS[s.surf];
      const hist = nelderMead(N.S.f, N.sim);
      pl.setMax(hist.length - 1);
      const k = Math.min(s.k, hist.length - 1);
      const q = hist[k];
      const L = mapLayers(N.S.f, N.S.dom, N.S.levels);
      const polys = hist.slice(Math.max(0, k - 14), k).map((h) => ({ x: h.sim.map((p) => p[0]), y: h.sim.map((p) => p[1]) }));
      if (polys.length) L.push({ type: 'polygon', polys, fill: false, stroke: 'muted', width: 1, opacity: 0.5 });
      L.push({ type: 'polygon', x: q.sim.map((p) => p[0]), y: q.sim.map((p) => p[1]), color: 'tree', stroke: 'tree', width: 2.2, opacity: 0.22 });
      L.push({ type: 'points', x: q.sim.map((p) => p[0]), y: q.sim.map((p) => p[1]), color: (i) => (i === 0 ? 'ink' : 'tree'), r: 4.5 });
      L.push({ type: 'points', x: [N.S.min[0]], y: [N.S.min[1]], color: 'ink', r: 6, hollow: true });
      plot.render(L, { x: [N.S.dom[0], N.S.dom[1]], y: [N.S.dom[2], N.S.dom[3]] });
      const ops = {};
      hist.slice(1, k + 1).forEach((h) => (ops[h.op] = (ops[h.op] || 0) + 1));
      st.set('op', q.op);
      st.set('calls', String(q.calls));
      st.set('best', '(' + f3(q.sim[0][0]) + ', ' + f3(q.sim[0][1]) + ')');
      st.set('f', sci(q.fs[0]));
      const last = hist[hist.length - 1];
      note.innerHTML = 'Пока сделано: ' + (Object.entries(ops).map(([o, c]) => o + ' — ' + c).join(', ') || 'ничего') + '. Всего до остановки (размер симплекса и разброс f меньше 10⁻⁴) — ' + (hist.length - 1) + ' итераций и ' + last.calls + ' вычислений f; финиш (' + f4(last.sim[0][0]) + ', ' + f4(last.sim[0][1]) + '). ' + (s.surf === 'corner'
        ? 'Функция негладкая — градиента в минимуме нет, но методу он и не нужен: Нелдер — Мид работает с одними значениями.'
        : 'В изогнутой долине симплекс вытягивается вдоль дна и «переползает» по нему; на вытянутой чаше быстро сплющивается. Метод хорош при 2–10 переменных и негладких или шумных функциях; при сотнях переменных он беспомощен и гарантий сходимости у него нет.');
    }
    w.pythonAction(() => {
      const N = NMS[s.surf];
      return PY_NP + 'from scipy.optimize import minimize\n\n' + N.S.py + 'sim0 = np.array(' + JSON.stringify(N.sim) + ')\nres = minimize(f, sim0[0], method="Nelder-Mead", options={"initial_simplex": sim0, "xatol": 1e-4, "fatol": 1e-4})\nprint("scipy: x =", res.x.round(4), " f =", f"{res.fun:.2e}", " вычислений f:", res.nfev)\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаги 11–12. Много ям: мультистарт и имитация отжига
   * ============================================================================== */
  const MM = {
    f: (x) => 0.02 * x * x - 0.8 * Math.cos(3 * x) - 1.4 * Math.exp(-((x - 2.1) ** 2) / 0.08),
    d: (x) => 0.04 * x + 2.4 * Math.sin(3 * x) + 35 * (x - 2.1) * Math.exp(-((x - 2.1) ** 2) / 0.08),
    py: 'f = lambda x: 0.02 * x**2 - 0.8 * np.cos(3 * x) - 1.4 * np.exp(-(x - 2.1)**2 / 0.08)\ndf = lambda x: 0.04 * x + 2.4 * np.sin(3 * x) + 35 * (x - 2.1) * np.exp(-(x - 2.1)**2 / 0.08)\n',
  };
  MM.xg = (() => {
    let best = 0;
    let fb = Infinity;
    for (let i = 0; i <= 24000; i++) {
      const x = -6 + (12 * i) / 24000;
      const v = MM.f(x);
      if (v < fb) (fb = v), (best = x);
    }
    for (let k = 0; k < 50; k++) best -= MM.d(best) / 400;
    return best;
  })();
  MM.fg = MM.f(MM.xg);
  function localDescent(x) {
    for (let k = 0; k < 1500; k++) x = U.clamp(x - 0.02 * MM.d(x), -6, 6);
    return x;
  }
  MM.basins = (() => {
    const xs = U.linspace(-6, 6, 601);
    const ends = xs.map(localDescent);
    const bands = [];
    let i0 = 0;
    const lab = ends.map((e) => Math.round(e * 10) / 10);
    for (let i = 1; i <= xs.length; i++) {
      if (i === xs.length || lab[i] !== lab[i0]) {
        bands.push({ x0: xs[i0], x1: xs[Math.min(i, xs.length - 1)], end: ends[i0], global: Math.abs(ends[i0] - MM.xg) < 0.05 });
        i0 = i;
      }
    }
    const share = ends.filter((e) => Math.abs(e - MM.xg) < 0.05).length / xs.length;
    return { bands, share };
  })();
  GBC.widget('multistart', (el) => {
    const s = { n: 3, seed: 1 };
    const w = ui.shell(el, { title: 'Мультистарт: несколько спусков из случайных точек', sub: 'У функции пять ям. Из каждой случайной стартовой точки (кружок) запускаем градиентный спуск и запоминаем лучший финиш. Синяя заливка — область притяжения глобального минимума.' });
    ui.slider(w.controls, { label: 'Число стартов n', values: [1, 2, 3, 5, 10, 20, 30], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Другие старты', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [-6, 6] }, y: { label: 'f(x)', domain: [-2.4, 1.6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'доля области глобального минимума' }, { key: 'found', label: 'в этот раз нашли?' }, { key: 'theory', label: 'P(найти) = 1 − (1 − w)ⁿ' }, { key: 'emp', label: 'доля успехов в 1000 повторах' }]);
    const empCache = {};
    function trial(seed, n) {
      const r = new GBC.RNG(seed);
      const starts = U.range(n).map(() => -6 + 12 * r.random());
      const ends = starts.map(localDescent);
      let bi = 0;
      ends.forEach((e, i) => {
        if (MM.f(e) < MM.f(ends[bi])) bi = i;
      });
      return { starts, ends, best: ends[bi] };
    }
    function draw() {
      const T = trial(100 + s.seed, s.n);
      const xs = U.linspace(-6, 6, 600);
      const L = MM.basins.bands.filter((b) => b.global).map((b) => ({ type: 'vband', x0: b.x0, x1: b.x1, color: 'model', opacity: 0.14 }));
      L.push({ type: 'line', x: xs, y: xs.map(MM.f), color: 'ink2', width: 2, hover: false });
      T.starts.forEach((x0, i) => {
        const e = T.ends[i];
        const seg = U.linspace(Math.min(x0, e), Math.max(x0, e), 60);
        L.push({ type: 'line', x: seg, y: seg.map(MM.f), color: 'tree', width: 3, opacity: 0.45, hover: false });
      });
      L.push({ type: 'points', x: T.starts, y: T.starts.map(MM.f), color: 'tree', r: 4, hollow: true });
      L.push({ type: 'points', x: T.ends, y: T.ends.map(MM.f), color: 'tree', r: 5 });
      L.push({ type: 'points', x: [T.best], y: [MM.f(T.best)], color: 'ink', r: 7 });
      plot.render(L);
      if (empCache[s.n] === undefined) {
        let ok = 0;
        for (let r = 0; r < 1000; r++) if (Math.abs(trial(5000 + r, s.n).best - MM.xg) < 0.05) ok++;
        empCache[s.n] = ok / 1000;
      }
      const wv = MM.basins.share;
      const found = Math.abs(T.best - MM.xg) < 0.05;
      st.set('w', pct(wv, 1));
      st.set('found', found ? 'да' : 'нет');
      st.set('theory', pct(1 - Math.pow(1 - wv, s.n), 1));
      st.set('emp', pct(empCache[s.n], 1));
      note.innerHTML = 'Глобальный минимум x* ≈ ' + f3(MM.xg) + ' (f* ≈ ' + f3(MM.fg) + ') — в узкой глубокой яме; её область притяжения занимает w ≈ ' + pct(wv, 1) + ' отрезка. Каждый старт попадает в неё с вероятностью w, поэтому n стартов находят глобальный минимум с вероятностью 1 − (1 − w)ⁿ: при n = ' + s.n + ' это ' + pct(1 - Math.pow(1 - wv, s.n), 1) + ' (в 1000 повторах — ' + pct(empCache[s.n], 1) + '). Мультистарт прост и легко распараллеливается; так поступают, например, перезапуская обучение нейросети с разными зёрнами.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\n' + MM.py + '\ndef local_descent(x):\n    for _ in range(1500):\n        x = np.clip(x - 0.02 * df(x), -6, 6)\n    return x\n\ndef trial(seed, n):\n    r = Mulberry32(seed)\n    ends = [local_descent(-6 + 12 * r.random()) for _ in range(n)]\n    return min(ends, key=f)\n\nxs = np.linspace(-6, 6, 24001)\nx_glob = xs[f(xs).argmin()]\nn = ' + s.n + '\nbest = trial(' + (100 + s.seed) + ', n)\nprint(f"глобальный минимум ≈ {x_glob:.3f}; лучший финиш {best:.3f}")\nshare = np.mean([abs(local_descent(x) - x_glob) < 0.05 for x in np.linspace(-6, 6, 601)])\nok = np.mean([abs(trial(5000 + r, n) - x_glob) < 0.05 for r in range(1000)])\nprint(f"доля области притяжения w = {share:.3f}; теория 1-(1-w)^n = {1 - (1 - share)**n:.3f}; моделирование {ok:.3f}")\n');
    draw();
  });

  function annealRun(seed, T0, K, keep = false) {
    const r = new GBC.RNG(seed);
    let x = -6 + 12 * r.random();
    let fx = MM.f(x);
    const a = T0 > 0 ? Math.pow(0.01 / T0, 1 / K) : 0;
    let T = T0;
    const path = keep ? [x] : null;
    const temps = keep ? [T] : null;
    let acc = 0;
    for (let k = 0; k < K; k++) {
      const c = U.clamp(x + 0.5 * r.normal(), -6, 6);
      const fc = MM.f(c);
      const u = r.random();
      if (fc < fx || (T > 0 && u < Math.exp(-(fc - fx) / T))) {
        if (fc >= fx) acc++;
        x = c;
        fx = fc;
      }
      T *= a;
      if (keep) {
        path.push(x);
        temps.push(T);
      }
    }
    return { x, path, temps, up: acc };
  }
  GBC.widget('annealing', (el) => {
    const s = { T0: 1, K: 3000, seed: 1 };
    const w = ui.shell(el, { title: 'Имитация отжига: иногда шагать вверх', sub: 'Предлагаем случайный шаг (σ = 0.5). Шаг вниз принимаем всегда, шаг вверх на Δ — с вероятностью e^(−Δ/T). Температура T падает от T₀ до 0.01. Горячо — блуждаем и перепрыгиваем горы; холодно — спускаемся в ближайшую яму.' });
    ui.slider(w.controls, { label: 'Начальная температура T₀', values: [0, 0.1, 0.3, 1, 3], value: s.T0, format: String, onInput: (v) => ((s.T0 = v), draw()) });
    ui.slider(w.controls, { label: 'Число шагов K', values: [300, 1000, 3000, 10000], value: s.K, format: String, onInput: (v) => ((s.K = v), draw()) });
    ui.button(w.controls, { label: 'Другой запуск', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x', domain: [-6, 6] }, y: { label: 'f(x)', domain: [-2.4, 1.6] } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'шаг k' }, y: { label: 'положение x', domain: [-6, 6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'финиш' }, { key: 'ok', label: 'глобальный?' }, { key: 'up', label: 'принято шагов вверх' }, { key: 'rate', label: 'успехов в 300 запусках' }]);
    const cache = {};
    function draw() {
      const R0 = annealRun(1000 + s.seed, s.T0, s.K, true);
      const xs = U.linspace(-6, 6, 600);
      const vis = R0.path.filter((_, i) => i % Math.max(1, Math.floor(R0.path.length / 400)) === 0);
      p1.render([
        { type: 'line', x: xs, y: xs.map(MM.f), color: 'ink2', width: 2, hover: false },
        { type: 'points', x: vis, y: vis.map(MM.f), color: 'tree', r: 2.5, opacity: 0.35 },
        { type: 'points', x: [R0.path[0]], y: [MM.f(R0.path[0])], color: 'ink', r: 5, hollow: true },
        { type: 'points', x: [R0.x], y: [MM.f(R0.x)], color: 'tree', r: 7 },
      ]);
      const ks = U.range(R0.path.length);
      p2.render([
        { type: 'hline', y: MM.xg, color: 'model', dash: '5 4', width: 1.2, text: 'глобальный минимум' },
        { type: 'line', x: ks, y: R0.path, color: 'tree', width: 1.2, hover: false },
      ], { x: [0, s.K] });
      const key = s.T0 + '|' + s.K;
      if (cache[key] === undefined) {
        let ok = 0;
        for (let r = 0; r < 300; r++) if (Math.abs(annealRun(1000 + r, s.T0, s.K).x - MM.xg) < 0.15) ok++;
        cache[key] = ok / 300;
      }
      const glob = Math.abs(R0.x - MM.xg) < 0.15;
      st.set('x', f3(R0.x));
      st.set('ok', glob ? 'да' : 'нет');
      st.set('up', String(R0.up));
      st.set('rate', pct(cache[key]));
      note.innerHTML = (s.T0 === 0
        ? 'При T₀ = 0 шаги вверх запрещены — это случайный спуск: точка падает в ближайшую яму, а перебраться в соседнюю может, только если случайный шаг сразу приземлится ниже, — это редкость, и успех лишь ' + pct(cache[key]) + ' (с числом шагов он растёт медленно). '
        : 'При T₀ = ' + s.T0 + ' и ' + s.K + ' шагах успех ' + pct(cache[key]) + '. Пока горячо, точка перепрыгивает через горы (верхний график, начало), а с остыванием застревает в одной яме — чаще в самой глубокой: при медленном охлаждении распределение точки приближается к ∝ e^(−f/T), а при малом T вся масса сосредоточена у глобального минимума. ') + 'Слишком быстрое охлаждение — «закалка»: точка застывает где попало. Отжиг применяют к дискретным задачам (расписания, размещение), где нет градиента; его родственник — шум в SGD (шаг 27).';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\n' + MM.py + '\ndef anneal(seed, T0, K):\n    r = Mulberry32(seed)\n    x = -6 + 12 * r.random(); fx = f(x)\n    a = (0.01 / T0) ** (1 / K) if T0 > 0 else 0\n    T = T0\n    for _ in range(K):\n        c = min(6, max(-6, x + 0.5 * r.normal())); fc = f(c)\n        u = r.random()\n        if fc < fx or (T > 0 and u < np.exp(-(fc - fx) / T)):\n            x, fx = c, fc\n        T *= a\n    return x\n\nxs = np.linspace(-6, 6, 24001)\nx_glob = xs[f(xs).argmin()]\nT0, K = ' + py(s.T0) + ', ' + s.K + '\nprint("этот запуск: финиш", round(anneal(' + (1000 + s.seed) + ', T0, K), 3), " глобальный минимум", round(x_glob, 3))\nok = np.mean([abs(anneal(1000 + r, T0, K) - x_glob) < 0.15 for r in range(300)])\nprint(f"успехов в 300 запусках: {ok:.0%}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 13. Байесовская оптимизация (гауссовский процесс + ожидаемое улучшение)
   * ============================================================================== */
  const BO = {
    g: (u) => 0.3 - 0.1 * Math.exp(-((u - 0.68) ** 2) / (2 * 0.035 ** 2)) - 0.05 * Math.exp(-((u - 0.22) ** 2) / (2 * 0.12 ** 2)) + 0.04 * u,
    py: 'g = lambda u: 0.3 - 0.1 * np.exp(-(u - 0.68)**2 / (2 * 0.035**2)) - 0.05 * np.exp(-(u - 0.22)**2 / (2 * 0.12**2)) + 0.04 * u\n',
    init: [0.1, 0.5, 0.9],
    grid: U.linspace(0, 1, 201),
  };
  (() => {
    let bu = 0;
    for (let i = 0; i <= 100000; i++) {
      const u = i / 100000;
      if (BO.g(u) < BO.g(bu)) bu = i / 100000;
    }
    BO.us = bu;
    BO.gs = BO.g(bu);
  })();
  /** Холецкий для небольшой положительно определённой матрицы. */
  function cholesky(A) {
    const n = A.length;
    const L = A.map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let s0 = A[i][j];
        for (let k = 0; k < j; k++) s0 -= L[i][k] * L[j][k];
        L[i][j] = i === j ? Math.sqrt(Math.max(s0, 1e-300)) : s0 / L[j][j];
      }
    }
    return L;
  }
  function cholSolve(L, b) {
    const n = L.length;
    const y = new Array(n);
    for (let i = 0; i < n; i++) {
      let s0 = b[i];
      for (let k = 0; k < i; k++) s0 -= L[i][k] * y[k];
      y[i] = s0 / L[i][i];
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s0 = y[i];
      for (let k = i + 1; k < n; k++) s0 -= L[k][i] * x[k];
      x[i] = s0 / L[i][i];
    }
    return x;
  }
  /** Гауссовский процесс с ядром RBF (длина ell), нормировка y как в sklearn (normalize_y). */
  function gpFit(X, Y, ell, noise = 1e-6) {
    const n = X.length;
    const m = U.mean(Y);
    const sd = Math.sqrt(U.mean(Y.map((v) => (v - m) ** 2))) || 1;
    const yn = Y.map((v) => (v - m) / sd);
    const k = (a, b) => Math.exp(-((a - b) ** 2) / (2 * ell * ell));
    const K = X.map((a, i) => X.map((b, j) => k(a, b) + (i === j ? noise : 0)));
    const L = cholesky(K);
    const alpha = cholSolve(L, yn);
    return (u) => {
      const ks = X.map((a) => k(a, u));
      let mu = 0;
      for (let i = 0; i < n; i++) mu += ks[i] * alpha[i];
      const v = cholSolve(L, ks);
      let q = 0;
      for (let i = 0; i < n; i++) q += ks[i] * v[i];
      const s2 = Math.max(1 - q, 0);
      return { mu: m + sd * mu, sd: sd * Math.sqrt(s2), mun: mu, sdn: Math.sqrt(s2) };
    };
  }
  /** Ход байесовской оптимизации: на каждом шаге — новая точка с максимальным EI. */
  function boRun(ell, steps, xi = 0.01) {
    const X = BO.init.slice();
    const Y = X.map(BO.g);
    const hist = [];
    for (let t = 0; t <= steps; t++) {
      const P = gpFit(X, Y, ell);
      const m = U.mean(Y);
      const sd = Math.sqrt(U.mean(Y.map((v) => (v - m) ** 2))) || 1;
      const ybn = (Math.min(...Y) - m) / sd;
      const pred = BO.grid.map(P);
      const ei = pred.map((p) => {
        if (p.sdn < 1e-12) return 0;
        const imp = ybn - p.mun - xi;
        const z = imp / p.sdn;
        return imp * normCdf(z) + p.sdn * normPdf(z);
      });
      let bi = 0;
      ei.forEach((v, i) => {
        if (v > ei[bi]) bi = i;
      });
      hist.push({ X: X.slice(), Y: Y.slice(), pred, ei, next: BO.grid[bi] });
      if (t < steps) {
        X.push(BO.grid[bi]);
        Y.push(BO.g(BO.grid[bi]));
      }
    }
    return hist;
  }
  GBC.widget('bayes-opt', (el) => {
    const STEPS = 12;
    const s = { k: 0, ell: 0.06, truth: false };
    const w = ui.shell(el, { title: 'Байесовская оптимизация: учиться на прошлых запусках', sub: 'Ищем лучший темп обучения: u = 0 — η = 0.001, u = 1 — η = 1, g(u) — ошибка на валидации. Гауссовский процесс по уже сделанным запускам даёт прогноз (линия) и неуверенность (полоса). Следующий запуск — там, где максимально ожидаемое улучшение (EI, нижний график).' });
    const pl = ui.player(w.controls, { label: 'Запуск', min: 0, max: STEPS, value: 0, fps: 1, format: (v) => (3 + v) + ' точек', onChange: (v) => ((s.k = v), draw()) });
    ui.slider(w.controls, { label: 'Длина корреляции ℓ', values: [0.03, 0.06, 0.1, 0.2], value: s.ell, format: String, onInput: (v) => ((s.ell = v), draw()) });
    ui.toggle(w.controls, { label: 'показать истинную g(u)', checked: false, onChange: (v) => ((s.truth = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'u — логарифм темпа (нормированный)', domain: [0, 1] }, y: { label: 'ошибка на валидации', domain: [0.12, 0.42] } });
    const p2 = new GBC.Plot(w.main, { height: 150, x: { label: 'u', domain: [0, 1] }, y: { label: 'EI' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'best', label: 'лучшее найденное' }, { key: 'reg', label: 'отставание от оптимума' }, { key: 'rand', label: 'случайный поиск, столько же точек (в среднем)' }, { key: 'hit', label: 'P(случайный нашёл узкую яму)' }]);
    const randCache = {};
    function draw() {
      const hist = boRun(s.ell, STEPS);
      const h = hist[Math.min(s.k, STEPS)];
      const mu = h.pred.map((p) => p.mu);
      const lo = h.pred.map((p) => p.mu - 2 * p.sd);
      const hi = h.pred.map((p) => p.mu + 2 * p.sd);
      const L = [{ type: 'area', x: BO.grid, y0: lo, y1: hi, color: 'model', opacity: 0.14, label: 'прогноз ± 2σ' }];
      if (s.truth) L.push({ type: 'line', x: BO.grid, y: BO.grid.map(BO.g), color: 'truth', dash: '5 4', width: 1.6, label: 'истинная g(u)', hover: false });
      L.push({ type: 'line', x: BO.grid, y: mu, color: 'model', width: 2.2, label: 'прогноз ГП' });
      L.push({ type: 'points', x: h.X, y: h.Y, color: (i) => (i === h.X.length - 1 && s.k > 0 ? 'tree' : 'ink'), r: 5, label: 'сделанные запуски', legendColor: 'ink' });
      if (s.k < STEPS) L.push({ type: 'vline', x: h.next, color: 'tree', dash: '5 4', width: 1.4, text: 'следующий' });
      p1.render(L);
      p2.render([
        { type: 'area', x: BO.grid, y0: BO.grid.map(() => 0), y1: h.ei, color: 'tree', opacity: 0.25 },
        { type: 'line', x: BO.grid, y: h.ei, color: 'tree', width: 2, hover: false },
        s.k < STEPS ? { type: 'vline', x: h.next, color: 'tree', dash: '5 4', width: 1.2 } : null,
      ], { y: [0, Math.max(1e-6, ...h.ei) * 1.15] });
      const best = Math.min(...h.Y);
      const n = h.X.length;
      if (randCache[n] === undefined) {
        let acc = 0;
        let hit = 0;
        for (let r = 0; r < 2000; r++) {
          const rng = new GBC.RNG(7000 + r);
          let b = Infinity;
          for (let i = 0; i < n; i++) b = Math.min(b, BO.g(rng.random()));
          acc += b - BO.gs;
          if (b < 0.25) hit++;
        }
        randCache[n] = [acc / 2000, hit / 2000];
      }
      st.set('best', f4(best));
      st.set('reg', sci(best - BO.gs));
      st.set('rand', sci(randCache[n][0]));
      st.set('hit', pct(randCache[n][1]));
      const foundNarrow = best < 0.25;
      note.innerHTML = 'Лучшая ошибка g* = ' + f4(BO.gs) + ' — в узкой яме у u ≈ ' + f2(BO.us) + '; есть и широкая, но мелкая яма у u ≈ 0.22. После ' + n + ' запусков: ' + (foundNarrow ? 'узкая яма найдена' : 'узкая яма пока не найдена') + ', отставание ' + sci(best - BO.gs) + '. Случайный поиск с тем же бюджетом отстаёт в среднем на ' + sci(randCache[n][0]) + ' и находит узкую яму лишь в ' + pct(randCache[n][1]) + ' случаев. EI велико там, где прогноз низкий <i>или</i> неуверенность высокая: так метод балансирует между <b>использованием</b> (exploitation) и <b>разведкой</b> (exploration). Длина ℓ — представление о гладкости: при большой ℓ модель «не верит» в узкие ямы и может проскочить мимо. Optuna по умолчанию использует родственный метод TPE (урок 11.2).';
    }
    w.pythonAction(() => PY_NP + 'from scipy.stats import norm\nfrom sklearn.gaussian_process import GaussianProcessRegressor\nfrom sklearn.gaussian_process.kernels import RBF\n\n' + BO.py + 'grid = np.linspace(0, 1, 201)\nX, Y = [0.1, 0.5, 0.9], [g(0.1), g(0.5), g(0.9)]\nell, xi = ' + py(s.ell) + ', 0.01\nfor t in range(' + Math.min(s.k, STEPS) + '):\n    gp = GaussianProcessRegressor(RBF(ell, length_scale_bounds="fixed"), alpha=1e-6, normalize_y=True, optimizer=None)\n    gp.fit(np.array(X)[:, None], Y)\n    mu, sd = gp.predict(grid[:, None], return_std=True)\n    m, s = np.mean(Y), np.std(Y)\n    imp = (min(Y) - m) / s - (mu - m) / s - xi        # улучшение в нормированных единицах\n    z = np.divide(imp, sd / s, out=np.zeros_like(imp), where=sd > 1e-12)\n    ei = np.where(sd > 1e-12, imp * norm.cdf(z) + sd / s * norm.pdf(z), 0)\n    u = grid[ei.argmax()]\n    X.append(u); Y.append(g(u))\n    print(f"запуск {len(X):2d}: u = {u:.3f}, g = {g(u):.4f}, лучшее {min(Y):.4f}")\nprint("истинный минимум:", round(g(grid[np.argmin(g(grid))]), 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 14. Последовательное деление (successive halving)
   * ============================================================================== */
  function makeConfigs(seed) {
    const r = new GBC.RNG(seed);
    return U.range(27).map(() => {
      const a = 0.2 + 0.15 * r.random();
      const b = 0.15 + 0.45 * r.random();
      const c = 0.05 + 0.6 * r.random();
      return { a, b, c, at: (t) => a + b / (1 + c * t) };
    });
  }
  function halving(seed, noise, r0) {
    const cf = makeConfigs(seed);
    const rn = new GBC.RNG(seed + 777);
    const rungs = r0 === 1 ? [1, 3, 9, 27] : [3, 9, 27];
    let alive = U.range(27);
    const log = [];
    let cost = 0;
    for (let k = 0; k < rungs.length; k++) {
      const t = rungs[k];
      const obs = alive.map((i) => [i, cf[i].at(t) + noise * rn.normal()]);
      cost += alive.length * t;
      obs.sort((p, q) => p[1] - q[1]);
      const keep = k === rungs.length - 1 ? 1 : Math.max(1, Math.round(alive.length / 3));
      log.push({ t, obs, keep: obs.slice(0, keep).map((p) => p[0]) });
      alive = obs.slice(0, keep).map((p) => p[0]);
    }
    const truth = cf.map((c) => c.at(27));
    let best = 0;
    truth.forEach((v, i) => {
      if (v < truth[best]) best = i;
    });
    return { cf, log, winner: alive[0], best, truth, cost, rungs };
  }
  GBC.widget('halving', (el) => {
    const s = { noise: 0.01, r0: 1, seed: 1 };
    const w = ui.shell(el, { title: 'Последовательное деление: отбраковка по ранним результатам', sub: '27 конфигураций; кривые — ошибка на валидации по мере обучения (эпохи). Обучаем всех немного, оставляем лучшую треть, обучаем её втрое дольше, снова оставляем треть… Кривые обучения пересекаются, а измерения шумят — поэтому ранняя отбраковка иногда ошибается.' });
    ui.slider(w.controls, { label: 'Шум измерения ошибки', values: [0, 0.005, 0.01, 0.02, 0.04], value: s.noise, format: String, onInput: (v) => ((s.noise = v), draw()) });
    ui.segmented(w.controls, { label: 'Первый бюджет', value: '1', options: [{ value: '1', label: '1 эпоха' }, { value: '3', label: '3 эпохи' }], onChange: (v) => ((s.r0 = +v), draw()) });
    ui.button(w.controls, { label: 'Другие конфигурации', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'эпох обучения (лог.)', type: 'log', domain: [1, 27], ticks: [1, 3, 9, 27] }, y: { label: 'ошибка на валидации' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'cost', label: 'затрачено эпох' }, { key: 'win', label: 'победитель / лучший' }, { key: 'p', label: 'лучший дожил до конца (500 повторов)' }, { key: 'reg', label: 'среднее отставание победителя' }]);
    const cache = {};
    function draw() {
      const R0 = halving(10 + s.seed, s.noise, s.r0);
      const ts = U.linspace(1, 27, 60);
      const survivors = new Set(R0.log[R0.log.length - 2] ? R0.log[R0.log.length - 2].keep : []);
      const L = [];
      R0.cf.forEach((c, i) => {
        const isBest = i === R0.best;
        L.push({ type: 'line', x: ts, y: ts.map(c.at), color: isBest ? 'tree' : i === R0.winner ? 'model' : 'muted', width: isBest || i === R0.winner ? 2.4 : 1, opacity: isBest || i === R0.winner || survivors.has(i) ? 0.95 : 0.35, dash: isBest && i !== R0.winner ? '6 4' : null, hover: false, label: isBest ? 'истинно лучшая' : i === R0.winner ? 'победитель отбора' : null });
      });
      for (const g of R0.log) {
        const keep = new Set(g.keep);
        L.push({ type: 'points', x: g.obs.map(() => g.t), y: g.obs.map((p) => p[1]), color: (k) => (keep.has(g.obs[k][0]) ? 'model' : 'red'), r: 3.5 });
      }
      plot.render(L);
      const key = s.noise + '|' + s.r0;
      if (!cache[key]) {
        let ok = 0;
        let reg = 0;
        for (let r = 0; r < 500; r++) {
          const Q = halving(2000 + r, s.noise, s.r0);
          if (Q.winner === Q.best) ok++;
          reg += Q.truth[Q.winner] - Q.truth[Q.best];
        }
        cache[key] = [ok / 500, reg / 500];
      }
      st.set('cost', R0.cost + ' из ' + 27 * 27);
      st.set('win', R0.winner === R0.best ? 'совпали' : 'разные (+' + f3(R0.truth[R0.winner] - R0.truth[R0.best]) + ')');
      st.set('p', pct(cache[key][0]));
      st.set('reg', sci(cache[key][1]));
      note.innerHTML = 'Расписание ' + R0.rungs.join(' → ') + ' эпох: 27 → 9 → 3 → 1 конфигураций. Затраты ' + R0.cost + ' эпох вместо ' + 27 * 27 + ' при полном обучении всех — в ' + f1(729 / R0.cost) + ' раза меньше. Цена экономии — риск выбросить «медленного старта»: истинно лучшая конфигурация (оранжевый пунктир) доживает до конца в ' + pct(cache[key][0]) + ' повторов, а победитель в среднем хуже лучшего на ' + sci(cache[key][1]) + '. Hyperband запускает несколько таких сеток с разным первым бюджетом; Optuna умеет отбраковывать (pruning) неудачные испытания по промежуточным значениям — для бустинга это ошибка после k деревьев.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\ndef make_configs(seed):\n    r = Mulberry32(seed)\n    cf = []\n    for _ in range(27):\n        a = 0.2 + 0.15 * r.random(); b = 0.15 + 0.45 * r.random(); c = 0.05 + 0.6 * r.random()\n        cf.append((a, b, c))\n    return cf\n\ndef halving(seed, noise, r0):\n    cf = make_configs(seed)\n    at = lambda i, t: cf[i][0] + cf[i][1] / (1 + cf[i][2] * t)\n    rn = Mulberry32(seed + 777)\n    rungs = [1, 3, 9, 27] if r0 == 1 else [3, 9, 27]\n    alive, cost = list(range(27)), 0\n    for k, t in enumerate(rungs):\n        obs = sorted(((i, at(i, t) + noise * rn.normal()) for i in alive), key=lambda p: p[1])\n        cost += len(alive) * t\n        keep = 1 if k == len(rungs) - 1 else max(1, round(len(alive) / 3))\n        alive = [i for i, _ in obs[:keep]]\n    truth = [at(i, 27) for i in range(27)]\n    return alive[0], int(np.argmin(truth)), truth, cost\n\nnoise, r0 = ' + py(s.noise) + ', ' + s.r0 + '\nwin, best, truth, cost = halving(' + (10 + s.seed) + ', noise, r0)\nprint(f"затраты {cost} эпох из 729; победитель {win}, лучший {best}")\nres = [halving(2000 + r, noise, r0) for r in range(500)]\nprint("лучший дожил:", np.mean([w == b for w, b, _, _ in res]), " среднее отставание:", round(np.mean([t[w] - t[b] for w, b, t, _ in res]), 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 15. Какой шаг допустим: режимы градиентного спуска
   * ============================================================================== */
  const STEPF = {
    quad: { label: 'парабола 2x² (L = 4)', f: (x) => 2 * x * x, d: (x) => 4 * x, dom: [-2.6, 2.6], pyf: '2 * x**2', pyd: '4 * x' },
    quartic: { label: 'x⁴/4 (кривизна 3x² растёт)', f: (x) => x ** 4 / 4, d: (x) => x ** 3, dom: [-2.6, 2.6], pyf: 'x**4 / 4', pyd: 'x**3' },
    logcosh: { label: 'ln ch(2x) (кривизна ≤ 4, наклон ≤ 2)', f: (x) => Math.log(Math.cosh(2 * x)), d: (x) => 2 * Math.tanh(2 * x), dom: [-2.6, 2.6], pyf: 'np.log(np.cosh(2 * x))', pyd: '2 * np.tanh(2 * x)' },
  };
  GBC.widget('step-regimes', (el) => {
    const s = { fn: 'quad', eta: 0.2, x0: 2 };
    const w = ui.shell(el, { title: 'Длина шага: четыре режима спуска', sub: 'x ← x − η·f′(x). Для параболы 2x² каждый шаг умножает x на (1 − 4η). Двигайте η и следите: плавный спуск, прыжки через дно, вечные качели, разлёт.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(STEPF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), draw()) });
    ui.slider(w.controls, { label: 'Темп η', min: 0.02, max: 0.7, step: 0.01, value: s.eta, format: f2, onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'Старт x₀', min: -2.5, max: 2.5, step: 0.1, value: s.x0, format: f1, onInput: (v) => ((s.x0 = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x', domain: [-2.6, 2.6] }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'шаг k', domain: [0, 30] }, y: { label: 'x_k', domain: [-2.8, 2.8] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'mode', label: 'режим' }, { key: 'q', label: 'множитель 1 − η·f″' }, { key: 'x', label: 'x через 30 шагов' }, { key: 'mono', label: 'f убывала на каждом шаге?' }]);
    function draw() {
      const F = STEPF[s.fn];
      const xs0 = [s.x0];
      let x = s.x0;
      for (let k = 0; k < 30; k++) {
        x -= s.eta * F.d(x);
        if (!Number.isFinite(x) || Math.abs(x) > 1e6) break;
        xs0.push(x);
      }
      const mono = xs0.every((v, i) => i === 0 || F.f(v) <= F.f(xs0[i - 1]) + 1e-15);
      const vis = xs0.map((v) => (Math.abs(v) <= 2.75 ? v : NaN));
      const cx = [];
      const cy = [];
      for (let i = 0; i + 1 < xs0.length; i++) {
        const a = xs0[i];
        const b = xs0[i + 1];
        if (Math.abs(a) > 2.75 || Math.abs(b) > 2.75) break;
        cx.push(a, b);
        cy.push(F.f(a), F.f(b));
      }
      const xs = U.linspace(-2.6, 2.6, 300);
      const ys = xs.map(F.f);
      p1.render([
        { type: 'line', x: xs, y: ys, color: 'model', width: 2.2, hover: false },
        { type: 'line', x: cx, y: cy, color: 'tree', width: 1.6, opacity: 0.8, hover: false },
        { type: 'points', x: vis.filter(Number.isFinite), y: vis.filter(Number.isFinite).map(F.f), color: 'tree', r: 3.5 },
        { type: 'points', x: [s.x0], y: [F.f(s.x0)], color: 'ink', r: 6, hollow: true },
      ], { y: yDom(ys, 0.05) });
      const ks = xs0.map((_, i) => i);
      p2.render([
        { type: 'hline', y: 0, color: 'ink2', width: 1 },
        { type: 'line', x: ks, y: xs0.map((v) => U.clamp(v, -2.8, 2.8)), color: 'tree', width: 1.6, hover: false },
        { type: 'points', x: ks, y: xs0.map((v) => U.clamp(v, -2.8, 2.8)), color: 'tree', r: 3 },
      ]);
      const last = xs0[xs0.length - 1];
      let mode;
      let q = NaN;
      if (s.fn === 'quad') {
        q = 1 - 4 * s.eta;
        mode = Math.abs(q) < 1e-9 ? 'одним шагом в минимум' : q > 0 ? 'плавный спуск' : q > -1 + 1e-9 ? 'прыжки через дно, сходится' : Math.abs(q + 1) < 1e-9 ? 'вечные качели' : 'разлёт';
      } else {
        q = 1 - s.eta * (s.fn === 'quartic' ? 3 * s.x0 * s.x0 : 4 / Math.cosh(2 * s.x0) ** 2);
        const conv = xs0.length === 31 && Math.abs(last) < Math.abs(s.x0) * 0.5;
        mode = xs0.length < 31 || Math.abs(last) > 1e3 ? 'разлёт' : conv ? 'сходится' : 'не сходится';
      }
      st.set('mode', mode);
      st.set('q', s.fn === 'quad' ? f2(q) : f2(q) + ' (в старте)');
      st.set('x', xs0.length < 31 ? 'улетел' : sci(last));
      st.set('mono', mono ? 'да' : 'нет');
      const notes = {
        quad: 'Для f = 2x² (f″ = L = 4): η &lt; 1/L = 0.25 — плавный спуск; η = 0.25 — ровно в минимум за шаг; 0.25 &lt; η &lt; 0.5 — прыжки через дно с затуханием; η = 2/L = 0.5 — вечные качели; η &gt; 0.5 — разлёт. Общее правило для L-гладкой функции (|f″| ≤ L): при η ≤ 1/L значение f гарантированно убывает на каждом шаге не меньше чем на (η/2)·f′², а при η &lt; 2/L спуск ещё не разваливается.',
        quartic: 'У x⁴/4 кривизна 3x² не ограничена: «безопасный» шаг зависит от того, где вы стоите: условие η &lt; 2/f″(x) = 2/(3x²) далеко от дна жёстче. Шаг, прекрасный у дна, далеко от него рвёт траекторию: при η = 0.5 старт x₀ = 1.5 сходится, x₀ = 2 вечно качается между −2 и 2, а x₀ = 2.5 улетает. Глобальной константы L нет — поэтому длину шага подбирают на ходу (шаги 17–18).',
        logcosh: 'ln ch(2x) похожа на |2x| вдали от нуля и на параболу 2x² у нуля: кривизна не больше L = 4, а наклон не больше 2. Большой шаг здесь не приводит к разлёту — траектория просто качается вокруг минимума с размахом около η·2. Так ведут себя «робастные» потери (Хьюбера, log-cosh): ограниченный градиент страхует от взрыва.',
      };
      note.innerHTML = notes[s.fn];
    }
    w.pythonAction(() => {
      const F = STEPF[s.fn];
      return PY_NP + '\nf = lambda x: ' + F.pyf + '\ndf = lambda x: ' + F.pyd + '\neta, x = ' + py(s.eta) + ', ' + py(s.x0) + '\nfor k in range(1, 31):\n    x_new = x - eta * df(x)\n    if abs(x_new) > 1e6:\n        print("разлёт на шаге", k)\n        break\n    if f(x_new) > f(x):\n        print(f"шаг {k}: f выросла ({f(x):.3g} → {f(x_new):.3g})")\n    x = x_new\nprint("x после 30 шагов:", x)\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 16. Скорости сходимости
   * ============================================================================== */
  GBC.widget('rates', (el) => {
    const s = { kappa: 10 };
    const w = ui.shell(el, { title: 'Как быстро сходится: линейно, сублинейно, квадратично', sub: 'Ошибка f(x_k) − f* по шагам в логарифмической шкале. Прямая линия — линейная сходимость (ошибка умножается на постоянное q < 1); выпуклая вниз кривая — сублинейная; обрыв — квадратичная (число верных знаков удваивается).' });
    ui.slider(w.controls, { label: 'Обусловленность κ = L/μ', values: [2, 5, 10, 25, 50, 100], value: s.kappa, format: String, onInput: (v) => ((s.kappa = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'шаг k', domain: [0, 60] }, y: { label: 'f(x_k) − f* (лог.)', type: 'log', domain: [1e-16, 10], ticks: decades(-16, 0, 2), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'lin', label: 'спуск, κ: шагов до 10⁻⁸' }, { key: 'q', label: 'множитель q за шаг' }, { key: 'sub', label: 'x⁴/4: ошибка через 60 шагов' }, { key: 'newt', label: 'Ньютон: шагов до 10⁻¹⁵' }]);
    function draw() {
      const kap = s.kappa;
      const eta = 2 / (kap + 1);
      let p = [1, 1];
      const lin = [];
      let kLin = null;
      for (let k = 0; k <= 60; k++) {
        const e = 0.5 * (p[0] * p[0] + kap * p[1] * p[1]);
        lin.push(Math.max(e, 1e-17));
        if (kLin === null && e < 1e-8) kLin = k;
        p = [p[0] - eta * p[0], p[1] - eta * kap * p[1]];
      }
      let x = 1;
      const sub = [];
      for (let k = 0; k <= 60; k++) {
        sub.push(Math.max(x ** 4 / 4, 1e-17));
        x -= 0.5 * x ** 3;
      }
      let z = 0;
      const fs = Math.log(3) * -3 + 3;
      const newt = [];
      let kN = null;
      for (let k = 0; k <= 60; k++) {
        const e = Math.exp(z) - 3 * z - fs;
        newt.push(Math.max(e, 1e-17));
        if (kN === null && e < 1e-15) kN = k;
        z -= (Math.exp(z) - 3) / Math.exp(z);
      }
      const ks = U.range(61);
      plot.render([
        { type: 'line', x: ks, y: sub, color: 'violet', width: 2.2, label: 'сублинейная: спуск по x⁴/4' },
        { type: 'line', x: ks, y: lin, color: 'model', width: 2.4, label: 'линейная: спуск по чаше с κ = ' + kap },
        { type: 'line', x: ks, y: newt.map((v, i) => (i <= (kN ?? 60) + 1 ? v : NaN)), color: 'tree', width: 2.4, label: 'квадратичная: Ньютон для eˣ − 3x' },
        { type: 'points', x: ks.slice(0, (kN ?? 0) + 1), y: newt.slice(0, (kN ?? 0) + 1), color: 'tree', r: 3.5 },
      ]);
      const q = ((kap - 1) / (kap + 1)) ** 2;
      st.set('lin', kLin === null ? '> 60' : String(kLin));
      st.set('q', f3(q));
      st.set('sub', sci(sub[60]));
      st.set('newt', kN === null ? '> 60' : String(kN));
      note.innerHTML = 'Линейная сходимость: на чаше с κ = ' + kap + ' спуск с лучшим постоянным шагом η = 2/(L + μ) умножает ошибку f на q = ((κ − 1)/(κ + 1))² = ' + f3(q) + ' за шаг; до 10⁻⁸ — ' + (kLin ?? '> 60') + ' шагов, примерно (κ/4)·ln(1/ε). Растёт κ — прямая становится пологой. Сублинейная: у x⁴/4 нет кривизны в минимуме, и ошибка падает лишь как 1/k² — за 60 шагов только ' + sci(sub[60]) + '. Квадратичная: Ньютон удваивает число верных знаков — ' + (kN ?? '> 60') + ' шагов до 10⁻¹⁵ (урок 15.7). На выпуклых, но не сильно выпуклых задачах спуск в худшем случае даёт O(1/k), ускоренный метод Нестерова — O(1/k²) (шаг 21).';
    }
    w.pythonAction(() => PY_NP + '\nkappa = ' + s.kappa + '\neta = 2 / (kappa + 1)\np = np.array([1.0, 1.0])\nfor k in range(61):\n    e = 0.5 * (p[0]**2 + kappa * p[1]**2)\n    if e < 1e-8:\n        print("линейная: до 1e-8 за", k, "шагов; q =", round(((kappa - 1) / (kappa + 1))**2, 4))\n        break\n    p = p - eta * np.array([p[0], kappa * p[1]])\n\nx = 1.0\nfor k in range(60):\n    x -= 0.5 * x**3\nprint("сублинейная: x^4/4 после 60 шагов =", x**4 / 4)\n\nz, fs = 0.0, 3 - 3 * np.log(3)\nfor k in range(8):\n    print(f"Ньютон, шаг {k}: ошибка {np.exp(z) - 3 * z - fs:.2e}")\n    z -= (np.exp(z) - 3) / np.exp(z)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 17. Точный поиск вдоль прямой: зигзаг
   * ============================================================================== */
  GBC.widget('exact-ls', (el) => {
    const s = { kappa: 25, p0: [-4, 1.2] };
    const w = ui.shell(el, { title: 'Наискорейший спуск: точный шаг и зигзаг', sub: 'На каждом шаге идём по антиградиенту до самого низа вдоль луча (точный поиск вдоль прямой). Соседние шаги получаются перпендикулярными — траектория идёт зигзагом. Кликните по карте, чтобы сменить старт.' });
    ui.slider(w.controls, { label: 'Вытянутость κ', values: [1, 2, 5, 10, 25, 50, 100], value: s.kappa, format: String, onInput: (v) => ((s.kappa = v), draw()) });
    ui.button(w.controls, { label: 'Худший старт: x₀ = −κ·y₀', onClick: () => ((s.p0 = [-4, 4 / s.kappa]), draw()) });
    ui.button(w.controls, { label: 'Старт (−4, 1.2)', onClick: () => ((s.p0 = [-4, 1.2]), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, equal: true, x: { label: 'x', domain: [-4.5, 4.5] }, y: { label: 'y', domain: [-2, 2] }, grid: 'none' });
    plot.onClick = (x, y) => ((s.p0 = [x, y]), draw());
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ex', label: 'точный шаг: шагов до f < 10⁻⁶' }, { key: 'best', label: 'постоянный η = 2/(L + μ)' }, { key: 'safe', label: 'постоянный η = 1/L' }, { key: 'cos', label: 'cos угла между соседними шагами' }]);
    function run(kap, mode) {
      let p = s.p0.slice();
      const path = [p.slice()];
      let n = null;
      let cosv = NaN;
      let prev = null;
      for (let k = 1; k <= 3000; k++) {
        const g = [p[0], kap * p[1]];
        const gg = g[0] * g[0] + g[1] * g[1];
        if (gg === 0) {
          n = k - 1;
          break;
        }
        const t = mode === 'exact' ? gg / (g[0] * g[0] + kap * g[1] * g[1]) : mode === 'best' ? 2 / (kap + 1) : 1 / kap;
        if (prev && k === 3) cosv = (prev[0] * g[0] + prev[1] * g[1]) / Math.sqrt((prev[0] ** 2 + prev[1] ** 2) * gg);
        prev = g;
        p = [p[0] - t * g[0], p[1] - t * g[1]];
        if (path.length < 400) path.push(p.slice());
        if (0.5 * (p[0] * p[0] + kap * p[1] * p[1]) < 1e-6) {
          n = k;
          break;
        }
      }
      return { path, n, cosv };
    }
    function draw() {
      const kap = s.kappa;
      const f = (x, y) => 0.5 * (x * x + kap * y * y);
      const lv = [0.3, 1.5, 4, 8, 14, 22].map((v) => v * Math.min(1, kap / 25) + 0.1);
      const E = run(kap, 'exact');
      const B = run(kap, 'best');
      const Sf = run(kap, 'safe');
      plot.render([
        ...mapLayers(f, [-4.5, 4.5, -2, 2], lv),
        { type: 'line', x: B.path.map((q) => q[0]), y: B.path.map((q) => q[1]), color: 'model', width: 1.6, label: 'постоянный η = 2/(L + μ)', hover: false },
        { type: 'line', x: E.path.map((q) => q[0]), y: E.path.map((q) => q[1]), color: 'tree', width: 2.2, label: 'точный шаг', hover: false },
        { type: 'points', x: E.path.slice(0, 40).map((q) => q[0]), y: E.path.slice(0, 40).map((q) => q[1]), color: 'tree', r: 3 },
        { type: 'points', x: [s.p0[0]], y: [s.p0[1]], color: 'ink', r: 6, hollow: true },
      ]);
      st.set('ex', E.n === null ? '> 3000' : String(E.n));
      st.set('best', B.n === null ? '> 3000' : String(B.n));
      st.set('safe', Sf.n === null ? '> 3000' : String(Sf.n));
      st.set('cos', Number.isFinite(E.cosv) ? sci(E.cosv) : '—');
      note.innerHTML = 'Точный шаг t* = (gᵀg)/(gᵀAg) для квадратичной функции считается формулой; в общем случае — одномерной минимизацией (шаги 8–9). В точке t* производная вдоль луча равна нулю, то есть новый градиент перпендикулярен старому направлению — отсюда зигзаг (cos ≈ 0). ' + (kap === 1 ? 'На круглой чаше (κ = 1) точный шаг попадает в минимум сразу.' : 'Сейчас точный шаг тратит ' + E.n + ' ' + plural(E.n || 0, 'шаг', 'шага', 'шагов') + ', постоянный η = 2/(L + μ) — ' + B.n + ', «безопасный» η = 1/L — ' + Sf.n + '. Но скорость наискорейшего спуска сильно зависит от старта: зигзаг повторяет себя, и ошибка за шаг умножается на число, которое определяется направлением старта. Худший старт — на луче x₀ = −κ·y₀ (кнопка): там точный шаг ничем не лучше постоянного, оба умножают ошибку на ((κ − 1)/(κ + 1))² за шаг. Точный поиск лечит выбор длины шага, но не плохую обусловленность — от неё лечат моментум и предобусловливание (шаги 21–24).');
    }
    w.pythonAction(() => PY_NP + '\nkappa = ' + s.kappa + '\nA = np.diag([1.0, kappa])\np0 = np.array(' + JSON.stringify(s.p0.map((v) => Math.round(v * 1000) / 1000)) + ')\n\ndef run(mode):\n    p = p0.copy()\n    for k in range(1, 3001):\n        g = A @ p\n        t = g @ g / (g @ A @ g) if mode == "exact" else (2 / (kappa + 1) if mode == "best" else 1 / kappa)\n        p = p - t * g\n        if 0.5 * p @ A @ p < 1e-6:\n            return k\n    return None\nfor mode in ("exact", "best", "safe"):\n    print(mode, run(mode))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 18. Backtracking и правило Армихо
   * ============================================================================== */
  GBC.widget('line-search', (el) => {
    const s = { x: -3, y: 1.2, c: 0.3, rho: 0.5 };
    const f = (x, y) => 0.5 * (x * x + 25 * y * y);
    const g = (x, y) => [x, 25 * y];
    const w = ui.shell(el, { title: 'Длина шага на ходу: backtracking по правилу Армихо', sub: 'Направление — антиградиент. Нижний график — функция вдоль этого луча φ(t) = f(p − t·∇f). Начинаем с t = 1 и уменьшаем в ρ раз, пока не получим «достаточное убывание» — точку под пунктирной границей Армихо. Кликните по карте, чтобы сменить точку.' });
    ui.slider(w.controls, { label: 'Требование убывания c', min: 0.01, max: 0.9, step: 0.01, value: s.c, onInput: (v) => ((s.c = v), draw()) });
    ui.slider(w.controls, { label: 'Множитель уменьшения ρ', values: [0.3, 0.5, 0.8], value: s.rho, format: String, onInput: (v) => ((s.rho = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 280, equal: true, x: { label: 'x', domain: [-4.5, 4.5] }, y: { label: 'y', domain: [-2, 2] }, grid: 'none' });
    const p2 = new GBC.Plot(w.main, { height: 240, x: { label: 'длина шага t' }, y: { label: 'φ(t) = f(p − t·∇f)' } });
    p1.onClick = (x, y) => ((s.x = x), (s.y = y), draw());
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'tries', label: 'попробованные t' }, { key: 't', label: 'принятый t' }, { key: 'best', label: 'лучший t на луче' }, { key: 'run', label: 'весь спуск: итераций / вычислений f' }]);
    function backtrack(x, y) {
      const [gx, gy] = g(x, y);
      const gg = gx * gx + gy * gy;
      const phi = (t) => f(x - t * gx, y - t * gy);
      const tries = [];
      let t = 1;
      while (phi(t) > phi(0) - s.c * t * gg && t > 1e-8) {
        tries.push(t);
        t *= s.rho;
      }
      tries.push(t);
      return { t, tries, gx, gy, gg, phi };
    }
    function draw() {
      const { x, y } = s;
      const B = backtrack(x, y);
      const { t, tries, gx, gy, gg, phi } = B;
      const tBest = gg / (gx * gx + 25 * gy * gy);
      const tmax = Math.max(2.2 * tBest, Math.min(1, tries[Math.min(2, tries.length - 1)] * 1.1), 0.1);
      const ts = U.linspace(0, tmax, 240);
      p1.render([
        ...mapLayers(f, [-4.5, 4.5, -2, 2], [0.5, 2, 5, 10, 20]),
        { type: 'line', x: [x, x - tmax * gx], y: [y, y - tmax * gy], color: 'ink2', dash: '4 4', width: 1, hover: false },
        { type: 'arrows', x1: [x], y1: [y], x2: [x - t * gx], y2: [y - t * gy], color: 'tree', width: 2.6 },
        { type: 'points', x: [x], y: [y], color: 'ink', r: 6 },
      ]);
      const shown = tries.filter((q) => q <= tmax);
      p2.render([
        { type: 'line', x: ts, y: ts.map(phi), color: 'model', width: 2.4, label: 'φ(t)', hover: false },
        { type: 'line', x: ts, y: ts.map((q) => phi(0) - s.c * q * gg), color: 'muted', width: 1.4, dash: '5 4', label: 'граница Армихо φ(0) − c·t·|∇f|²', hover: false },
        { type: 'points', x: shown, y: shown.map(phi), color: (i) => (i === shown.length - 1 && shown[i] === t ? 'tree' : 'red'), r: 5 },
        { type: 'vline', x: tBest, color: 'tree', dash: '3 3', width: 1, text: 'минимум на луче' },
      ], { y: yDom(ts.map(phi).concat([phi(0)]), 0.06) });
      // весь спуск с backtracking
      let p = [x, y];
      let it = 0;
      let calls = 0;
      while (f(p[0], p[1]) >= 1e-6 && it < 5000) {
        const Q = backtrack(p[0], p[1]);
        calls += Q.tries.length + 1;
        p = [p[0] - Q.t * Q.gx, p[1] - Q.t * Q.gy];
        it++;
      }
      st.set('tries', tries.slice(0, 7).map((q) => U.fmt(q, 3)).join(' → ') + (tries.length > 7 ? ' …' : ''));
      st.set('t', U.fmt(t, 4));
      st.set('best', U.fmt(tBest, 4));
      st.set('run', it + ' / ' + calls);
      const dphi = (t0) => -(gx * (x - t0 * gx) * 1 * 1 + gy * 25 * (y - t0 * gy));
      const wolfe = dphi(t) >= 0.9 * dphi(0);
      note.innerHTML = 'Красные точки — отвергнутые шаги (недостаточное убывание), оранжевая — принятая. Условие Армихо φ(t) ≤ φ(0) − c·t·|∇f|² требует, чтобы убывание было не меньше доли c от того, что обещает касательная. Маленькое c принимает почти любой шаг, большое — придирчиво. Второе условие Вольфе (наклон φ′(t) ≥ 0.9·φ′(0), «не слишком короткий шаг») здесь ' + (wolfe ? 'выполнено' : 'не выполнено') + ' — его проверяют методы вроде BFGS (шаг 24). Весь спуск из этой точки до f &lt; 10⁻⁶ занимает ' + it + ' итераций и ' + calls + ' вычислений f — без всякого подбора η вручную. В бустинге Фридмана то же самое: после построения дерева ищут множитель ρ, минимизирующий потери вдоль этого дерева (шаг 33).';
    }
    w.pythonAction(() => PY_NP + '\nf = lambda p: 0.5 * (p[0]**2 + 25 * p[1]**2)\ngrad = lambda p: np.array([p[0], 25 * p[1]])\nc, rho = ' + py(s.c) + ', ' + py(s.rho) + '\n\ndef backtrack(p):\n    g = grad(p); t, tries = 1.0, []\n    while f(p - t * g) > f(p) - c * t * (g @ g) and t > 1e-8:\n        tries.append(t); t *= rho\n    return t, tries + [t]\n\np = np.array([' + py(Math.round(s.x * 1000) / 1000) + ', ' + py(Math.round(s.y * 1000) / 1000) + '])\nt, tries = backtrack(p)\nprint("попробованные t:", [round(v, 4) for v in tries])\nit = calls = 0\nwhile f(p) >= 1e-6:\n    t, tries = backtrack(p)\n    calls += len(tries) + 1\n    p = p - t * grad(p); it += 1\nprint("весь спуск: итераций", it, " вычислений f", calls)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 19. Покоординатный спуск
   * ============================================================================== */
  GBC.widget('coord-descent', (el) => {
    const s = { rho: 0.8, mode: 'cyclic' };
    const w = ui.shell(el, { title: 'Покоординатный спуск: по одной переменной за раз', sub: 'f(w) = ½(w₁² + 2ρ·w₁w₂ + w₂²). Шаг — точный минимум по одной координате при замороженной другой: путь — «лесенка» из горизонтальных и вертикальных отрезков. ρ — корреляция признаков.' });
    ui.slider(w.controls, { label: 'Связь координат ρ', values: [0, 0.3, 0.6, 0.8, 0.9, 0.95, 0.99], value: s.rho, format: String, onInput: (v) => ((s.rho = v), draw()) });
    ui.segmented(w.controls, { label: 'Какую координату обновлять', value: s.mode, options: [{ value: 'cyclic', label: 'по очереди' }, { value: 'greedy', label: 'с большей |∂f|' }], onChange: (v) => ((s.mode = v), draw()) });
    const box = H('div', { style: 'max-width:460px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 360, equal: true, x: { label: 'w₁', domain: [-3, 3] }, y: { label: 'w₂', domain: [-3, 3] }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'cd', label: 'обновлений координат до f < 10⁻⁸' }, { key: 'gd', label: 'шагов спуска η = 1/L' }, { key: 'q', label: 'множитель за проход ρ²' }]);
    function draw() {
      const r = s.rho;
      const f = (a, b) => 0.5 * (a * a + 2 * r * a * b + b * b);
      let p = [2.5, -0.4 * 0 + 2.2];
      if (r === 0) p = [2.5, 2.2];
      const path = [p.slice()];
      let n = null;
      for (let k = 1; k <= 5000; k++) {
        const g1 = p[0] + r * p[1];
        const g2 = p[1] + r * p[0];
        const j = s.mode === 'cyclic' ? (k - 1) % 2 : Math.abs(g1) >= Math.abs(g2) ? 0 : 1;
        if (j === 0) p = [-r * p[1], p[1]];
        else p = [p[0], -r * p[0]];
        if (path.length < 600) path.push(p.slice());
        if (f(p[0], p[1]) < 1e-8) {
          n = k;
          break;
        }
      }
      let q = [2.5, 2.2];
      const gp = [q.slice()];
      let ng = null;
      const L = 1 + r;
      for (let k = 1; k <= 20000; k++) {
        q = [q[0] - (q[0] + r * q[1]) / L, q[1] - (q[1] + r * q[0]) / L];
        if (gp.length < 600) gp.push(q.slice());
        if (f(q[0], q[1]) < 1e-8) {
          ng = k;
          break;
        }
      }
      plot.render([
        ...mapLayers(f, [-3, 3, -3, 3], [0.2, 0.8, 1.8, 3.2, 5]),
        { type: 'line', x: gp.map((v) => v[0]), y: gp.map((v) => v[1]), color: 'model', width: 1.6, label: 'градиентный спуск', hover: false },
        { type: 'line', x: path.map((v) => v[0]), y: path.map((v) => v[1]), color: 'tree', width: 2.2, label: 'покоординатный', hover: false },
        { type: 'points', x: [2.5], y: [2.2], color: 'ink', r: 6, hollow: true },
      ]);
      st.set('cd', n === null ? '> 5000' : String(n));
      st.set('gd', ng === null ? '> 20000' : String(ng));
      st.set('q', f4(r * r));
      note.innerHTML = 'Минимизация по одной координате — одномерная задача, часто решаемая формулой: здесь w₁ ← −ρw₂, w₂ ← −ρw₁. Полный проход уменьшает ошибку в ρ² = ' + f4(r * r) + ' раза' + (r === 0 ? ': при ρ = 0 координаты независимы, и двух обновлений хватает.' : '. Чем сильнее связь координат (коррелированы признаки), тем мельче ступеньки «лесенки» вдоль диагональной долины.') + ' Каждое обновление дешевле полного градиента — поэтому покоординатный спуск — рабочая лошадка для Lasso и эластичной сети в scikit-learn (там одномерная задача решается мягким порогом, шаг 20). Бустинг — тоже покоординатный спуск: «координаты» — все возможные деревья, и на каждом шаге выбирается самая полезная (жадный выбор по |∂f|, шаг 34).';
    }
    w.pythonAction(() => PY_NP + '\nrho = ' + py(s.rho) + '\nf = lambda w: 0.5 * (w[0]**2 + 2 * rho * w[0] * w[1] + w[1]**2)\nw = np.array([2.5, 2.2])\nfor k in range(1, 5001):\n    g = np.array([w[0] + rho * w[1], w[1] + rho * w[0]])\n    j = ' + (s.mode === 'cyclic' ? '(k - 1) % 2' : 'int(abs(g[1]) > abs(g[0]))') + '\n    w[j] = -rho * w[1 - j]          # точный минимум по координате j\n    if f(w) < 1e-8:\n        print("покоординатный спуск:", k, "обновлений")\n        break\n\nq, L = np.array([2.5, 2.2]), 1 + rho\nfor k in range(1, 20001):\n    q = q - np.array([q[0] + rho * q[1], q[1] + rho * q[0]]) / L\n    if f(q) < 1e-8:\n        print("градиентный спуск:", k, "шагов")\n        break\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 20. Негладкие задачи: субградиент против проксимального шага
   * ============================================================================== */
  const soft = (z, t) => Math.sign(z) * Math.max(Math.abs(z) - t, 0);
  GBC.widget('prox-l1', (el) => {
    const s = { lam: 6, k: 60 };
    const w = ui.shell(el, { title: 'Излом в нуле: субградиент или проксимальный шаг', sub: 'Минимизируем (w₁ − 2)² + 4(w₂ − 1.5)² + λ(|w₁| + |w₂|). Субградиентный метод шагает по «наклону» с убывающим шагом и вокруг нуля дрожит. Проксимальный (ISTA) делает градиентный шаг по гладкой части, а потом мягкий порог — и попадает в ноль ровно.' });
    ui.slider(w.controls, { label: 'Сила штрафа λ', min: 0, max: 16, step: 0.5, value: s.lam, format: f1, onInput: (v) => ((s.lam = v), draw()) });
    ui.player(w.controls, { label: 'Итераций', min: 1, max: 200, value: s.k, fps: 12, format: (v) => v + ' итер.', onChange: (v) => ((s.k = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 300, equal: true, x: { label: 'w₁', domain: [-1.4, 2.6] }, y: { label: 'w₂', domain: [-0.9, 1.9] }, grid: 'none' });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'итерация k', domain: [0, 200] }, y: { label: 'расстояние до решения (лог.)', type: 'log', domain: [1e-16, 10], ticks: decades(-16, 0, 4), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'opt', label: 'точное решение' }, { key: 'ista', label: 'ISTA' }, { key: 'sub', label: 'субградиент' }, { key: 'zero', label: 'ровных нулей: ISTA / субгр.' }]);
    function draw() {
      const lam = s.lam;
      const opt = [Math.max(0, 2 - lam / 2), Math.max(0, 1.5 - lam / 8)];
      const F = (a, b) => (a - 2) ** 2 + 4 * (b - 1.5) ** 2 + lam * (Math.abs(a) + Math.abs(b));
      const Lc = 8;
      let p = [-1, -0.5];
      let q = [-1, -0.5];
      const P = [p.slice()];
      const Q = [q.slice()];
      const eP = [Math.hypot(p[0] - opt[0], p[1] - opt[1])];
      const eQ = [eP[0]];
      for (let k = 1; k <= 200; k++) {
        const g = [2 * (p[0] - 2), 8 * (p[1] - 1.5)];
        p = [soft(p[0] - g[0] / Lc, lam / Lc), soft(p[1] - g[1] / Lc, lam / Lc)];
        const h = [2 * (q[0] - 2) + lam * Math.sign(q[0]), 8 * (q[1] - 1.5) + lam * Math.sign(q[1])];
        const t = 0.12 / Math.sqrt(k);
        q = [q[0] - t * h[0], q[1] - t * h[1]];
        P.push(p.slice());
        Q.push(q.slice());
        eP.push(Math.max(1e-17, Math.hypot(p[0] - opt[0], p[1] - opt[1])));
        eQ.push(Math.max(1e-17, Math.hypot(q[0] - opt[0], q[1] - opt[1])));
      }
      const k = s.k;
      const lv = [1, 3, 6, 10, 16].map((v) => v + F(opt[0], opt[1]));
      p1.render([
        ...mapLayers(F, [-1.4, 2.6, -0.9, 1.9], lv),
        { type: 'hline', y: 0, color: 'ink2', width: 1, opacity: 0.6 },
        { type: 'vline', x: 0, color: 'ink2', width: 1, opacity: 0.6 },
        { type: 'line', x: Q.slice(0, k + 1).map((v) => v[0]), y: Q.slice(0, k + 1).map((v) => v[1]), color: 'violet', width: 1.6, label: 'субградиент', hover: false },
        { type: 'line', x: P.slice(0, k + 1).map((v) => v[0]), y: P.slice(0, k + 1).map((v) => v[1]), color: 'tree', width: 2.2, label: 'ISTA (проксимальный)', hover: false },
        { type: 'points', x: [P[k][0], Q[k][0]], y: [P[k][1], Q[k][1]], color: (i) => (i ? 'violet' : 'tree'), r: 5 },
        { type: 'points', x: [opt[0]], y: [opt[1]], color: 'ink', r: 6, hollow: true, label: 'решение' },
      ]);
      const ks = U.range(201);
      p2.render([
        { type: 'line', x: ks, y: eQ, color: 'violet', width: 2, label: 'субградиент' },
        { type: 'line', x: ks, y: eP, color: 'tree', width: 2.2, label: 'ISTA' },
        { type: 'vline', x: k, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      const zP = P[k].filter((v) => v === 0).length;
      const zQ = Q[k].filter((v) => v === 0).length;
      const zOpt = opt.filter((v) => v === 0).length;
      st.set('opt', '(' + f3(opt[0]) + ', ' + f3(opt[1]) + ')');
      st.set('ista', '(' + sci(P[k][0]) + ', ' + sci(P[k][1]) + ')');
      st.set('sub', '(' + sci(Q[k][0]) + ', ' + sci(Q[k][1]) + ')');
      st.set('zero', zP + ' / ' + zQ + ' (нужно ' + zOpt + ')');
      note.innerHTML = 'Решение: w₁ = max(0, 2 − λ/2), w₂ = max(0, 1.5 − λ/8) — при λ = ' + f1(lam) + ' это (' + f3(opt[0]) + ', ' + f3(opt[1]) + '). Субградиентный метод: у |w| в нуле вместо производной — любой наклон из [−1, 1] (шаг 5), берём sign(w). Но при w ≈ 0 знак скачет, точка прыгает через ноль, и ровно нуля метод не получает никогда; сходимость медленная, шаг обязан убывать (здесь 0.12/√k). ISTA: шаг по гладкой части с η = 1/L, затем <b>мягкий порог</b> S(z) = sign(z)·max(|z| − λη, 0) — точное решение одномерной задачи с |w|. Нули получаются ровными, а скорость — как у спуска по гладкой функции (линейная). Ускоренный вариант — FISTA; покоординатная версия того же порога — основа Lasso в scikit-learn и reg_alpha в листьях XGBoost.';
    }
    w.pythonAction(() => PY_NP + '\nlam, L = ' + py(s.lam) + ', 8.0\nsoft = lambda z, t: np.sign(z) * np.maximum(np.abs(z) - t, 0)\ngrad = lambda w: np.array([2 * (w[0] - 2), 8 * (w[1] - 1.5)])\nopt = np.array([max(0, 2 - lam / 2), max(0, 1.5 - lam / 8)])\np = q = np.array([-1.0, -0.5])\nfor k in range(1, ' + (s.k + 1) + '):\n    p = soft(p - grad(p) / L, lam / L)                        # ISTA\n    q = q - 0.12 / np.sqrt(k) * (grad(q) + lam * np.sign(q))  # субградиент\nprint("решение:", opt)\nprint("ISTA:", p, " ошибка", np.linalg.norm(p - opt))\nprint("субградиент:", q, " ошибка", np.linalg.norm(q - opt))\n');
    draw();
  });

  GBC.lesson1515 = {
    f1, f2, f3, f4, py, sci, sup, powFmt, decades, pct, plural, nWord, yDom, human,
    texInto, texEl, card, cardGrid, badge, rowTable, onTheme, PY_NP, PY_RNG,
    mapLayers, SURF, normPdf, normCdf, goldenRun, PY_GOLDEN, soft, cholesky, cholSolve,
  };
})();
