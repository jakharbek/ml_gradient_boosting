/* Урок 15.8: функции многих переменных. Часть 1 — функции и карты высот, частные производные, градиент.
 * Виджеты: рельеф и карта (интуиция), «машина» с двумя входами, галерея поверхностей, срез уровнем,
 * профиль вдоль пути, предел по разным путям, частные производные, «заморозка» переменных, численные частные,
 * смешанные производные, касательная плоскость, векторы, поле градиентов, производная по направлению,
 * перпендикулярность линиям уровня, цепное правило вдоль пути, матрица Якоби softmax.
 * Общие помощники (библиотека поверхностей, 3D-вид Surface3D, карты высот) выставлены в GBC.lesson158 —
 * ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const E = Math.exp;
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const f4 = (v) => U.fmt(v, 4);
  const py = (v) => U.pyNum(v);
  const vec = (a, b, d = 2) => '(' + U.fmt(a, d) + ', ' + U.fmt(b, d) + ')';
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const SUPD = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (k) => String(k).split('').map((c) => SUPD[c] || c).join('');
  /** Подписи логарифмической оси: 10⁻⁶ вместо 1e-6. */
  function powFmt(v) {
    const e = Math.round(Math.log10(v));
    if (Math.abs(v - Math.pow(10, e)) > 1e-9 * v) return U.fmt(v, 2);
    if (e >= -2 && e <= 3) return String(Number(v.toPrecision(3)));
    return '10' + sup(e);
  }
  /** Декадные деления логарифмической оси от 10^a до 10^b с шагом step. */
  const decades = (a, b, step = 1) => {
    const out = [];
    for (let e = a; e <= b; e += step) out.push(Math.pow(10, e));
    return out;
  };

  /** Диапазон оси по значениям с полями; почти постоянные значения не ломают деления оси. */
  function yDom(vals, pad = 0.08) {
    const v = vals.filter(Number.isFinite);
    if (!v.length) return [-1, 1];
    const [lo, hi] = U.extent(v);
    const span = hi - lo;
    if (span < 1e-9 * Math.max(1, Math.abs(hi))) {
      const m = (lo + hi) / 2;
      const d = Math.max(0.5, Math.abs(m) * 0.1);
      return [m - d, m + d];
    }
    return [lo - pad * span, hi + pad * span];
  }

  /* ==============================================================================
   * Библиотека поверхностей: f, градиент g = [fx, fy], гессиан h = [fxx, fxy, fyy]
   * ============================================================================== */
  const SURF = {
    plane: {
      label: 'плоскость: 0.5x + y', f: (x, y) => 0.5 * x + y, g: () => [0.5, 1], h: () => [0, 0, 0],
      dom: [-2, 2, -2, 2], p0: [0.5, -0.5], py: '0.5 * x + y',
      about: 'Наклонная плоскость: высота растёт с постоянной скоростью — на 0.5 за единицу x и на 1 за единицу y. Линии уровня — параллельные прямые на равных расстояниях: крутизна везде одинакова.',
    },
    round: {
      label: 'круглая чаша: x² + y²', f: (x, y) => x * x + y * y, g: (x, y) => [2 * x, 2 * y], h: () => [2, 0, 2],
      dom: [-2, 2, -2, 2], p0: [1, 0.5], py: 'x**2 + y**2', crit: [[0, 0]],
      about: 'Круглая чаша: одинакова во всех направлениях, линии уровня — концентрические окружности x² + y² = c радиуса √c. Минимум 0 в начале координат.',
    },
    bowl: {
      label: 'вытянутая чаша: x² + 3y²', f: (x, y) => x * x + 3 * y * y, g: (x, y) => [2 * x, 6 * y], h: () => [2, 0, 6],
      dom: [-2.5, 2.5, -2, 2], p0: [1, 1], py: 'x**2 + 3 * y**2', crit: [[0, 0]],
      about: 'Вытянутая чаша: вдоль y стенки в 3 раза круче, чем вдоль x, поэтому линии уровня — эллипсы, сплюснутые по y. Минимум 0 в начале координат.',
    },
    dome: {
      label: 'купол: 4 − x² − y²', f: (x, y) => 4 - x * x - y * y, g: (x, y) => [-2 * x, -2 * y], h: () => [-2, 0, -2],
      dom: [-2, 2, -2, 2], p0: [1, 0.5], py: '4 - x**2 - y**2', crit: [[0, 0]],
      about: 'Купол — перевёрнутая чаша: вершина (максимум) 4 в начале координат. Линии уровня — те же окружности, что у чаши, поэтому по одной карте без подписей купол от чаши не отличить: нужен цвет или значения.',
    },
    saddle: {
      label: 'седло: x² − y²', f: (x, y) => x * x - y * y, g: (x, y) => [2 * x, -2 * y], h: () => [2, 0, -2],
      dom: [-2, 2, -2, 2], p0: [1, 0.5], py: 'x**2 - y**2', crit: [[0, 0]],
      about: 'Седло: вдоль x — чаша, вдоль y — купол. В центре склон горизонтален, но это ни минимум, ни максимум. Линии уровня — гиперболы, а уровень 0 — две прямые y = ±x.',
    },
    twist: {
      label: 'седло: xy', f: (x, y) => x * y, g: (x, y) => [y, x], h: () => [0, 1, 0],
      dom: [-2, 2, -2, 2], p0: [1, 0.5], py: 'x * y', crit: [[0, 0]],
      about: 'Седло xy — то же седло, повёрнутое на 45°: вдоль диагонали y = x поверхность растёт как x², вдоль y = −x падает как −x². Вдоль осей она плоская (f = 0).',
    },
    trough: {
      label: 'жёлоб: x²', f: (x) => x * x, g: (x) => [2 * x, 0], h: () => [2, 0, 0],
      dom: [-2, 2, -2, 2], p0: [1, 0.5], py: 'x**2 + 0 * y', crit: [[0, 0]],
      about: 'Жёлоб: от y не зависит вовсе (∂f/∂y = 0). Дно — целая прямая x = 0, минимумов бесконечно много, линии уровня — пары вертикальных прямых.',
    },
    hill: {
      label: 'холм: 3·e^(−(x²+y²)/2)',
      f: (x, y) => 3 * E(-(x * x + y * y) / 2),
      g: (x, y) => { const v = 3 * E(-(x * x + y * y) / 2); return [-x * v, -y * v]; },
      h: (x, y) => { const v = 3 * E(-(x * x + y * y) / 2); return [(x * x - 1) * v, x * y * v, (y * y - 1) * v]; },
      dom: [-3, 3, -3, 3], p0: [1, 0.5], py: '3 * np.exp(-(x**2 + y**2) / 2)', crit: [[0, 0]],
      about: 'Гладкий холм («колокол» Гаусса): вершина 3 в центре, во все стороны склон сначала крутеет, потом выполаживается и почти сливается с равниной. Самый крутой склон — на окружности радиуса 1.',
    },
    wave: {
      label: 'волны: sin x · cos y',
      f: (x, y) => Math.sin(x) * Math.cos(y),
      g: (x, y) => [Math.cos(x) * Math.cos(y), -Math.sin(x) * Math.sin(y)],
      h: (x, y) => [-Math.sin(x) * Math.cos(y), -Math.cos(x) * Math.sin(y), -Math.sin(x) * Math.cos(y)],
      dom: [-3.5, 3.5, -3.5, 3.5], p0: [0.8, 0.6], py: 'np.sin(x) * np.cos(y)',
      about: 'Волны: холмы и ямы в шахматном порядке, а между ними — сёдла. Один рельеф содержит все виды критических точек сразу.',
    },
    cone: {
      label: 'конус: √(x² + y²)',
      f: (x, y) => Math.hypot(x, y),
      g: (x, y) => { const r = Math.hypot(x, y); return r > 1e-12 ? [x / r, y / r] : [NaN, NaN]; },
      h: (x, y) => { const r = Math.hypot(x, y); return r > 1e-12 ? [(y * y) / r ** 3, (-x * y) / r ** 3, (x * x) / r ** 3] : [NaN, NaN, NaN]; },
      dom: [-2, 2, -2, 2], p0: [1, 0.5], py: 'np.hypot(x, y)',
      about: 'Конус: высота равна расстоянию до начала координат. Крутизна склона везде одна и та же (1), но внизу — острие: там нет ни частных производных, ни касательной плоскости.',
    },
    valley: {
      label: 'изогнутая долина: (1 − x)² + 5(y − x²)²',
      f: (x, y) => (1 - x) ** 2 + 5 * (y - x * x) ** 2,
      g: (x, y) => [-2 * (1 - x) - 20 * x * (y - x * x), 10 * (y - x * x)],
      h: (x, y) => [2 - 20 * y + 60 * x * x, -20 * x, 10],
      dom: [-1.5, 2, -1, 3], p0: [-1, 2], py: '(1 - x)**2 + 5 * (y - x**2)**2', crit: [[1, 1]],
      levels: [0.1, 0.5, 1.5, 3, 6, 10, 20], zr: [0, 25],
      about: 'Изогнутая долина (функция типа Розенброка): дно идёт по параболе y = x², минимум 0 — в точке (1, 1). Стенки крутые, дно пологое — классическое испытание для градиентного спуска.',
    },
    pits: {
      label: 'две ямы',
      f: (x, y) => 2 - 2 * E(-((x - 1) ** 2 + y * y)) - 1.4 * E(-(((x + 1.2) ** 2 + (y - 0.8) ** 2) / 0.5)),
      g: (x, y) => {
        const a = E(-((x - 1) ** 2 + y * y));
        const b = E(-(((x + 1.2) ** 2 + (y - 0.8) ** 2) / 0.5));
        return [4 * (x - 1) * a + 5.6 * (x + 1.2) * b, 4 * y * a + 5.6 * (y - 0.8) * b];
      },
      dom: [-2.5, 2.5, -2, 2], p0: [-0.1, -1.2],
      py: '2 - 2 * np.exp(-((x - 1)**2 + y**2)) - 1.4 * np.exp(-((x + 1.2)**2 + (y - 0.8)**2) / 0.5)',
      about: 'Две ямы разной глубины: глубокая около (1, 0) — глобальный минимум, мелкая около (−1.2, 0.8) — локальный. Между ними — седловина, через которую идёт «перевал».',
    },
    cubic: {
      label: 'x³ − 3x + y²', f: (x, y) => x ** 3 - 3 * x + y * y, g: (x, y) => [3 * x * x - 3, 2 * y], h: (x) => [6 * x, 0, 2],
      dom: [-2.2, 2.2, -2, 2], p0: [0.3, 1], py: 'x**3 - 3 * x + y**2', crit: [[1, 0], [-1, 0]],
      about: 'x³ − 3x + y²: яма в (1, 0) (f = −2) и седло в (−1, 0) (f = 2). Срез вдоль x — кубическая парабола с горбом и ямкой, вдоль y — всегда чаша.',
    },
    quartic: {
      label: 'x⁴ + y⁴ − 4xy', f: (x, y) => x ** 4 + y ** 4 - 4 * x * y, g: (x, y) => [4 * x ** 3 - 4 * y, 4 * y ** 3 - 4 * x], h: (x, y) => [12 * x * x, -4, 12 * y * y],
      dom: [-2, 2, -2, 2], p0: [0.4, -0.6], py: 'x**4 + y**4 - 4 * x * y', crit: [[0, 0], [1, 1], [-1, -1]], zr: [-2.5, 10],
      about: 'x⁴ + y⁴ − 4xy: две одинаковые ямы в (1, 1) и (−1, −1) (f = −2) и седло между ними в начале координат.',
    },
    monkey: {
      label: 'обезьянье седло: x³ − 3xy²', f: (x, y) => x ** 3 - 3 * x * y * y, g: (x, y) => [3 * x * x - 3 * y * y, -6 * x * y], h: (x, y) => [6 * x, -6 * y, -6 * x],
      dom: [-1.5, 1.5, -1.5, 1.5], p0: [0.6, 0.5], py: 'x**3 - 3 * x * y**2', crit: [[0, 0]],
      about: 'Обезьянье седло x³ − 3xy²: три спуска (для двух ног и хвоста) и три подъёма. В центре равны нулю и градиент, и все вторые производные — тест второго порядка молчит.',
    },
    xexp: {
      label: 'x·e^(xy)',
      f: (x, y) => x * E(x * y),
      g: (x, y) => { const e = E(x * y); return [(1 + x * y) * e, x * x * e]; },
      h: (x, y) => { const e = E(x * y); return [y * (2 + x * y) * e, x * (2 + x * y) * e, x ** 3 * e]; },
      dom: [-1.5, 1.5, -1.5, 1.5], p0: [1, 0.5], py: 'x * np.exp(x * y)',
      about: 'x·e^(xy): по x — произведение, по y — экспонента с множителем x. Удобна для тренировки правил дифференцирования.',
    },
    ecos: {
      label: 'eˣ · cos y',
      f: (x, y) => E(x) * Math.cos(y),
      g: (x, y) => [E(x) * Math.cos(y), -E(x) * Math.sin(y)],
      h: (x, y) => [E(x) * Math.cos(y), -E(x) * Math.sin(y), -E(x) * Math.cos(y)],
      dom: [-1.5, 1.5, -2, 2], p0: [0, 0], py: 'np.exp(x) * np.cos(y)',
      about: 'eˣ·cos y: вдоль x растёт как экспонента, вдоль y колеблется. В нуле: f = 1, ∇f = (1, 0), гессиан diag(1, −1).',
    },
    cubed: {
      label: 'x³y²', f: (x, y) => x ** 3 * y * y, g: (x, y) => [3 * x * x * y * y, 2 * x ** 3 * y], h: (x, y) => [6 * x * y * y, 6 * x * x * y, 2 * x ** 3],
      dom: [-1.6, 1.6, -1.6, 1.6], p0: [1, 1], py: 'x**3 * y**2',
      about: 'x³y²: многочлен двух переменных — частные производные любого порядка считаются по правилу степени.',
    },
  };
  // критические точки волн: (±π/2, 0), (±π/2, ±π), (0, ±π/2), (±π, ±π/2)
  SURF.wave.crit = [];
  for (const x of [-Math.PI / 2, Math.PI / 2]) for (const y of [-Math.PI, 0, Math.PI]) SURF.wave.crit.push([x, y]);
  for (const x of [-Math.PI, 0, Math.PI]) for (const y of [-Math.PI / 2, Math.PI / 2]) SURF.wave.crit.push([x, y]);
  for (const [k, S] of Object.entries(SURF)) S.key = k;

  function gradNum(f, x, y, e = 1e-5) {
    return [(f(x + e, y) - f(x - e, y)) / (2 * e), (f(x, y + e) - f(x, y - e)) / (2 * e)];
  }
  function hessNum(f, x, y, e = 1e-4) {
    const fxx = (f(x + e, y) - 2 * f(x, y) + f(x - e, y)) / (e * e);
    const fyy = (f(x, y + e) - 2 * f(x, y) + f(x, y - e)) / (e * e);
    const fxy = (f(x + e, y + e) - f(x + e, y - e) - f(x - e, y + e) + f(x - e, y - e)) / (4 * e * e);
    return [fxx, fxy, fyy];
  }
  const grad = (S, x, y) => (S.g ? S.g(x, y) : gradNum(S.f, x, y));
  const hess = (S, x, y) => (S.h ? S.h(x, y) : hessNum(S.f, x, y));

  /** Сетка значений (с кешем по поверхности и области). */
  function gridOf(S, dom = S.dom, n = 90) {
    const key = dom.join(',') + ':' + n;
    S._grids = S._grids || {};
    if (!S._grids[key]) S._grids[key] = GBC.Plot.grid((x, y) => S.f(x, y), dom[0], dom[1], dom[2], dom[3], n, n);
    return S._grids[key];
  }
  /** Диапазон высот поверхности (для цвета и 3D). */
  function heightRange(S) {
    if (S.zr) return S.zr;
    if (!S._range) {
      const v = Array.from(gridOf(S).values).filter(Number.isFinite);
      const [lo, hi] = U.extent(v);
      S._range = [lo, hi > lo ? hi : lo + 1];
    }
    return S._range;
  }
  /** Равноотстоящие «круглые» уровни внутри диапазона высот. */
  function levelsOf(S, count = 7) {
    if (S.levels) return S.levels;
    if (!S._levels) {
      const [lo, hi] = heightRange(S);
      const step = U.niceStep(hi - lo, count);
      const out = [];
      for (let v = Math.ceil((lo + 1e-9) / step) * step; v < hi - 1e-9; v += step) out.push(Number(v.toPrecision(10)));
      S._levels = out;
    }
    return S._levels;
  }
  /** Цвет высоты: низины — насыщенный синий, вершины — почти цвет фона (как глубина воды). */
  function rangeColor(lo, hi) {
    const seq = GBC.colors.sequential();
    return (v) => seq(1 - U.clamp((v - lo) / (hi - lo || 1), 0, 1));
  }
  const heightColor = (S) => rangeColor(...heightRange(S));
  /** Карта высот: тепловая подложка + линии уровня. */
  function mapLayers(S, o = {}) {
    const dom = o.dom || S.dom;
    const grid = gridOf(S, dom, o.n || 90);
    const layers = [];
    if (o.heat !== false) layers.push({ type: 'heatmap', grid, colorFn: heightColor(S), opacity: o.opacity ?? 0.7 });
    for (const lv of o.levels || levelsOf(S)) layers.push({ type: 'contour', grid, level: lv, color: 'axis', width: o.width || 1 });
    return layers;
  }
  const domOf = (S, dom = S.dom) => ({ x: [dom[0], dom[1]], y: [dom[2], dom[3]] });
  const snap = (v, s = 0.05) => Math.round(v / s) * s;
  /** Перетаскиваемая точка карты: pt = {x, y}. */
  function dragPoint(pt, dom, onMove, o = {}) {
    return {
      type: 'points', x: [pt.x], y: [pt.y], color: o.color || 'tree', r: o.r || 7, draggable: true,
      onDrag: (i, nx, ny) => {
        pt.x = snap(U.clamp(nx, dom[0], dom[1]), o.snap || 0.05);
        pt.y = snap(U.clamp(ny, dom[2], dom[3]), o.snap || 0.05);
        onMove();
      },
    };
  }
  /** Изолинии (marching squares) — для линий уровня в 3D и измерений. */
  function contourSegs(grid, level) {
    const { nx, ny, values, x0, x1, y0, y1 } = grid;
    const dx = (x1 - x0) / (nx - 1);
    const dy = (y1 - y0) / (ny - 1);
    const segs = [];
    const V = (i, j) => values[j * nx + i];
    const lerp = (a, b, va, vb) => a + ((level - va) / (vb - va || 1e-12)) * (b - a);
    const T = { 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 5: [[3, 2], [0, 1]], 6: [[0, 2]], 7: [[3, 2]], 8: [[3, 2]], 9: [[0, 2]], 10: [[3, 0], [1, 2]], 11: [[1, 2]], 12: [[3, 1]], 13: [[0, 1]], 14: [[3, 0]] };
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const v00 = V(i, j);
        const v10 = V(i + 1, j);
        const v01 = V(i, j + 1);
        const v11 = V(i + 1, j + 1);
        if (!(Number.isFinite(v00) && Number.isFinite(v10) && Number.isFinite(v01) && Number.isFinite(v11))) continue;
        const idx = (v00 > level ? 1 : 0) | (v10 > level ? 2 : 0) | (v11 > level ? 4 : 0) | (v01 > level ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        const xa = x0 + i * dx;
        const xb = xa + dx;
        const ya = y0 + j * dy;
        const yb = ya + dy;
        const P = [[lerp(xa, xb, v00, v10), ya], [xb, lerp(ya, yb, v10, v11)], [lerp(xa, xb, v01, v11), yb], [xa, lerp(ya, yb, v00, v01)]];
        for (const [a, b] of T[idx]) segs.push([P[a], P[b]]);
      }
    }
    return segs;
  }
  const rgbStr = (c, a = 1) => 'rgba(' + c.map((v) => Math.round(U.clamp(v, 0, 255))).join(',') + ',' + a + ')';
  const roleRGB = (c) => (Array.isArray(c) ? c : GBC.colors.rgb(c));

  /* ==============================================================================
   * Surface3D — лёгкий 3D-вид поверхности на canvas: вращение мышью/пальцем,
   * сортировка граней по глубине, тень от «солнца», линии уровня на полу.
   * spec: {S | f + dom, z?, n?, levels?, planes?, walls?, curves?, segs3?, arrows?, points?, colorFn?, alpha?}
   * ============================================================================== */
  class Surface3D {
    constructor(parent, o = {}) {
      this.o = Object.assign({ height: 320, az: -0.72, el: 0.5, zScale: 0.62 }, o);
      this.az = this.o.az;
      this.el = this.o.el;
      this.root = H('div', { style: 'position:relative;min-width:0' });
      this.canvas = H('canvas', {
        role: 'img', 'aria-label': o.aria || 'Поверхность z = f(x, y) в объёме',
        style: 'display:block;width:100%;height:' + this.o.height + 'px;touch-action:pan-y;cursor:grab;user-select:none;-webkit-user-select:none',
      });
      this.root.append(this.canvas, H('div', { style: 'position:absolute;right:6px;bottom:2px;font-size:.72rem;color:var(--muted);pointer-events:none' }, '↻ тяните, чтобы вращать'));
      parent.appendChild(this.root);
      const cv = this.canvas;
      let drag = null;
      cv.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY, az: this.az, el: this.el };
        try {
          cv.setPointerCapture(e.pointerId);
        } catch (err) {
          /* захват недоступен — вращаем без него */
        }
        cv.style.cursor = 'grabbing';
      });
      cv.addEventListener('pointermove', (e) => {
        if (!drag) return;
        this.az = drag.az - (e.clientX - drag.x) * 0.01;
        this.el = U.clamp(drag.el + (e.clientY - drag.y) * 0.008, 0.06, 1.45);
        this._req();
      });
      const end = () => {
        drag = null;
        cv.style.cursor = 'grab';
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      if (window.ResizeObserver) {
        let lw = 0;
        new ResizeObserver(() => {
          const ww = cv.clientWidth;
          if (ww && Math.abs(ww - lw) > 1) {
            lw = ww;
            this._req();
          }
        }).observe(cv);
      }
      GBC.bus.on('themechange', () => this._req());
    }
    _req() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this.draw();
      });
    }
    render(spec) {
      this.spec = spec;
      this.draw();
    }
    draw() {
      const sp = this.spec;
      const cv = this.canvas;
      const W = cv.clientWidth;
      const Hh = this.o.height;
      if (!sp || !W) return;
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(Hh * dpr);
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, Hh);
      const S = sp.S || {};
      const f = sp.f || S.f;
      const dom = sp.dom || S.dom;
      const [x0, x1, y0, y1] = dom;
      const n = sp.n || 34;
      const xs = U.linspace(x0, x1, n + 1);
      const ys = U.linspace(y0, y1, n + 1);
      const Z = ys.map((y) => xs.map((x) => f(x, y)));
      let z0;
      let z1;
      if (sp.z) [z0, z1] = sp.z;
      else if (sp.S && !sp.dom) [z0, z1] = heightRange(S);
      else {
        const v = [].concat(...Z).filter(Number.isFinite);
        [z0, z1] = v.length ? U.extent(v) : [0, 1];
      }
      if (!(z1 > z0)) {
        z0 -= 0.5;
        z1 += 0.5;
      }
      const color = sp.colorFn || (sp.S ? heightColor(S) : rangeColor(z0, z1));
      const dark = isDark();
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const sc = Math.max(x1 - x0, y1 - y0) / 2;
      const zh = this.o.zScale * (sp.zScale || 1);
      const nzRaw = (z) => ((z - z0) / (z1 - z0)) * 2 * zh - zh;
      const nz = (z) => nzRaw(U.clamp(z, z0, z1));
      const ca = Math.cos(this.az);
      const sa = Math.sin(this.az);
      const ce = Math.cos(this.el);
      const se = Math.sin(this.el);
      const pr = (x, y, zn) => {
        const X = (x - cx) / sc;
        const Y = (y - cy) / sc;
        const xr = X * ca - Y * sa;
        const yr = X * sa + Y * ca;
        return [xr, zn * ce + yr * se, yr * ce - zn * se];
      };
      let mnx = Infinity;
      let mxx = -Infinity;
      let mny = Infinity;
      let mxy = -Infinity;
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const zn of [-zh, zh]) {
        const p = pr(x, y, zn);
        mnx = Math.min(mnx, p[0]);
        mxx = Math.max(mxx, p[0]);
        mny = Math.min(mny, p[1]);
        mxy = Math.max(mxy, p[1]);
      }
      const pad = 24;
      const k = Math.min((W - 2 * pad) / (mxx - mnx), (Hh - 2 * pad) / (mxy - mny));
      const ox = W / 2 - (k * (mnx + mxx)) / 2;
      const oy = Hh / 2 + (k * (mny + mxy)) / 2;
      const Pn = (x, y, zn) => {
        const p = pr(x, y, zn);
        return [ox + k * p[0], oy - k * p[1], p[2]];
      };
      const P = (x, y, z) => Pn(x, y, nz(z));
      const PR = (x, y, z) => Pn(x, y, nzRaw(z));
      const ink = roleRGB('ink');
      const muted = roleRGB('muted');
      const font = '12px ' + getComputedStyle(document.body).fontFamily;
      // пол
      const fl = [Pn(x0, y0, -zh), Pn(x1, y0, -zh), Pn(x1, y1, -zh), Pn(x0, y1, -zh)];
      ctx.beginPath();
      fl.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fillStyle = rgbStr(ink, dark ? 0.06 : 0.035);
      ctx.fill();
      ctx.strokeStyle = rgbStr(muted, 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
      // задняя вертикальная ось — в самом дальнем углу
      let back = 0;
      fl.forEach((p, i) => {
        if (p[2] > fl[back][2]) back = i;
      });
      const bxy = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]][back];
      const vt = Pn(bxy[0], bxy[1], zh);
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(fl[back][0], fl[back][1]);
      ctx.lineTo(vt[0], vt[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      // линии уровня на полу
      const lv = sp.levels || [];
      if (lv.length) {
        const g = GBC.Plot.grid(f, x0, x1, y0, y1, 61, 61);
        ctx.strokeStyle = rgbStr(muted, 0.75);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const L of lv) for (const [a, b] of contourSegs(g, L)) {
          const pa = Pn(a[0], a[1], -zh);
          const pb = Pn(b[0], b[1], -zh);
          ctx.moveTo(pa[0], pa[1]);
          ctx.lineTo(pb[0], pb[1]);
        }
        ctx.stroke();
      }
      for (const fp of sp.floor || []) {
        const c = roleRGB(fp.color || 'tree');
        if (fp.type === 'seg') {
          const a = Pn(fp.a[0], fp.a[1], -zh);
          const b = Pn(fp.b[0], fp.b[1], -zh);
          ctx.strokeStyle = rgbStr(c, 0.9);
          ctx.lineWidth = fp.width || 1.6;
          ctx.setLineDash(fp.dash ? [5, 4] : []);
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // грани: поверхность + плоскости + стенки, затем линии на поверхности — всё сортируется по глубине
      const items = [];
      const Ld = [-0.45, -0.55, 0.7];
      const Ln = Math.hypot(...Ld);
      const stroke = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)';
      const alpha = sp.alpha ?? 0.97;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const z00 = Z[j][i];
          const z10 = Z[j][i + 1];
          const z11 = Z[j + 1][i + 1];
          const z01 = Z[j + 1][i];
          if (!(Number.isFinite(z00) && Number.isFinite(z10) && Number.isFinite(z11) && Number.isFinite(z01))) continue;
          const q = [P(xs[i], ys[j], z00), P(xs[i + 1], ys[j], z10), P(xs[i + 1], ys[j + 1], z11), P(xs[i], ys[j + 1], z01)];
          const dxn = (xs[i + 1] - xs[i]) / sc;
          const dyn = (ys[j + 1] - ys[j]) / sc;
          const zx = (nz(z10) - nz(z00) + nz(z11) - nz(z01)) / 2;
          const zy = (nz(z01) - nz(z00) + nz(z11) - nz(z10)) / 2;
          const nx = -zx / dxn;
          const ny = -zy / dyn;
          const lam = Math.abs((nx * Ld[0] + ny * Ld[1] + Ld[2]) / (Math.hypot(nx, ny, 1) * Ln));
          const shade = 0.68 + 0.32 * lam;
          const c = color((z00 + z10 + z11 + z01) / 4).map((v) => v * shade);
          items.push({ q, d: (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4, fill: rgbStr(c, alpha), stroke });
        }
      }
      for (const pl of sp.planes || []) {
        const [a0, a1, b0, b1] = pl.dom || dom;
        const m = pl.n || 12;
        const c = roleRGB(pl.color || 'tree');
        const us = U.linspace(a0, a1, m + 1);
        const vs = U.linspace(b0, b1, m + 1);
        for (let j = 0; j < m; j++) {
          for (let i = 0; i < m; i++) {
            const q = [[us[i], vs[j]], [us[i + 1], vs[j]], [us[i + 1], vs[j + 1]], [us[i], vs[j + 1]]].map(([x, y]) => PR(x, y, pl.f(x, y)));
            if (q.some((p) => !Number.isFinite(p[1]))) continue;
            items.push({ q, d: (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4 - 0.002, fill: rgbStr(c, pl.alpha ?? 0.4), stroke: rgbStr(c, Math.min(1, (pl.alpha ?? 0.4) + 0.25)) });
          }
        }
      }
      for (const wl of sp.walls || []) {
        const c = roleRGB(wl.color || 'violet');
        const m = wl.n || 14;
        const za = wl.z0 ?? z0;
        const zb = wl.z1 ?? z1;
        for (let i = 0; i < m; i++) {
          for (let j = 0; j < 6; j++) {
            const t0 = i / m;
            const t1 = (i + 1) / m;
            const s0 = za + ((zb - za) * j) / 6;
            const s1 = za + ((zb - za) * (j + 1)) / 6;
            const at = (t, z) => P(wl.a[0] + (wl.b[0] - wl.a[0]) * t, wl.a[1] + (wl.b[1] - wl.a[1]) * t, z);
            const q = [at(t0, s0), at(t1, s0), at(t1, s1), at(t0, s1)];
            items.push({ q, d: (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4, fill: rgbStr(c, wl.alpha ?? 0.16), stroke: rgbStr(c, 0.05) });
          }
        }
      }
      const lineItem = (a, b, c, width, dash, al = 1) => items.push({ line: [a, b], d: (a[2] + b[2]) / 2 - 0.02, stroke: rgbStr(c, al), width, dash });
      for (const cu of sp.curves || []) {
        const c = roleRGB(cu.color || 'tree');
        const pts = cu.pts.map((p) => (cu.raw ? PR : P)(p[0], p[1], p[2]));
        for (let i = 1; i < pts.length; i++) {
          if (!Number.isFinite(pts[i][1]) || !Number.isFinite(pts[i - 1][1])) continue;
          lineItem(pts[i - 1], pts[i], c, cu.width || 2.4, cu.dash, cu.alpha ?? 1);
        }
      }
      for (const sg of sp.segs3 || []) {
        const c = roleRGB(sg.color || 'tree');
        for (const [a, b] of sg.segs) lineItem(P(a[0], a[1], sg.z), P(b[0], b[1], sg.z), c, sg.width || 2.4, false);
      }
      items.sort((a, b) => b.d - a.d);
      for (const it of items) {
        if (it.line) {
          ctx.strokeStyle = it.stroke;
          ctx.lineWidth = it.width;
          ctx.setLineDash(it.dash ? [5, 4] : []);
          ctx.beginPath();
          ctx.moveTo(it.line[0][0], it.line[0][1]);
          ctx.lineTo(it.line[1][0], it.line[1][1]);
          ctx.stroke();
          continue;
        }
        ctx.beginPath();
        it.q.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.fillStyle = it.fill;
        ctx.fill();
        ctx.strokeStyle = it.stroke;
        ctx.lineWidth = 0.6;
        ctx.setLineDash([]);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // стрелки и точки — поверх всего
      const arrow = (a, b, c, width) => {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 2) return;
        const ux = (b[0] - a[0]) / len;
        const uy = (b[1] - a[1]) / len;
        const hs = Math.min(9, len * 0.45);
        ctx.strokeStyle = c;
        ctx.fillStyle = c;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0] - ux * hs * 0.8, b[1] - uy * hs * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(b[0], b[1]);
        ctx.lineTo(b[0] - ux * hs - uy * hs * 0.5, b[1] - uy * hs + ux * hs * 0.5);
        ctx.lineTo(b[0] - ux * hs + uy * hs * 0.5, b[1] - uy * hs - ux * hs * 0.5);
        ctx.closePath();
        ctx.fill();
      };
      for (const ar of sp.arrows || []) {
        const proj = ar.floor ? (x, y) => Pn(x, y, -zh) : ar.raw ? PR : P;
        arrow(proj(ar.a[0], ar.a[1], ar.a[2]), proj(ar.b[0], ar.b[1], ar.b[2]), rgbStr(roleRGB(ar.color || 'tree')), ar.width || 2.4);
      }
      const surf = roleRGB('surface');
      for (const pt of sp.points || []) {
        const c = roleRGB(pt.color || 'tree');
        const z = pt.z ?? f(pt.x, pt.y);
        const p = P(pt.x, pt.y, z);
        if (pt.drop) {
          const q = Pn(pt.x, pt.y, -zh);
          ctx.strokeStyle = rgbStr(c, 0.8);
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(p[0], p[1]);
          ctx.lineTo(q[0], q[1]);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = rgbStr(c, 0.85);
          ctx.beginPath();
          ctx.arc(q[0], q[1], 3, 0, 2 * Math.PI);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p[0], p[1], pt.r || 5.5, 0, 2 * Math.PI);
        ctx.fillStyle = pt.hollow ? rgbStr(surf) : rgbStr(c);
        ctx.fill();
        ctx.lineWidth = pt.hollow ? 2 : 1.5;
        ctx.strokeStyle = pt.hollow ? rgbStr(c) : rgbStr(surf);
        ctx.stroke();
        if (pt.label) {
          ctx.font = font;
          ctx.fillStyle = rgbStr(ink);
          ctx.fillText(pt.label, p[0] + 8, p[1] - 6);
        }
      }
      // подписи осей: у ближних рёбер пола
      ctx.font = font;
      ctx.fillStyle = rgbStr(muted);
      const label = (txt, a, b, outward) => {
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const c0 = [W / 2, Hh / 2];
        const dx = m[0] - c0[0];
        const dy = m[1] - c0[1];
        const dl = Math.hypot(dx, dy) || 1;
        ctx.textAlign = 'center';
        ctx.fillText(txt, m[0] + (dx / dl) * outward, m[1] + (dy / dl) * outward + 4);
      };
      const ex = [[0, 1], [3, 2]].map(([a, b]) => [fl[a], fl[b]]);
      const ey = [[0, 3], [1, 2]].map(([a, b]) => [fl[a], fl[b]]);
      const nearX = ex[0][0][2] + ex[0][1][2] < ex[1][0][2] + ex[1][1][2] ? ex[0] : ex[1];
      const nearY = ey[0][0][2] + ey[0][1][2] < ey[1][0][2] + ey[1][1][2] ? ey[0] : ey[1];
      label('x', nearX[0], nearX[1], 14);
      label('y', nearY[0], nearY[1], 14);
      ctx.textAlign = 'left';
      ctx.fillText((sp.zLabel || 'f') + ' от ' + U.fmt(z0, 2) + ' до ' + U.fmt(z1, 2), vt[0] + 5, vt[1] - 2);
      ctx.textAlign = 'start';
    }
  }
  /** Python: поверхность и карта высот рядом (matplotlib). */
  function pySurface(S, extra = '') {
    const [x0, x1, y0, y1] = S.dom;
    const zr = S.zr ? '\nZ = np.clip(Z, ' + py(S.zr[0]) + ', ' + py(S.zr[1]) + ')' : '';
    return 'import numpy as np\nimport matplotlib.pyplot as plt\n\nf = lambda x, y: ' + S.py + '\n\nX, Y = np.meshgrid(np.linspace(' + py(x0) + ', ' + py(x1) + ', 120), np.linspace(' + py(y0) + ', ' + py(y1) + ', 120))\nZ = f(X, Y)' + zr + '\n\nfig = plt.figure(figsize=(11, 4.8))\nax = fig.add_subplot(1, 2, 1, projection="3d")\nax.plot_surface(X, Y, Z, cmap="Blues_r", linewidth=0, alpha=0.95)\nax.contour(X, Y, Z, levels=10, offset=Z.min(), colors="gray", linewidths=0.8)\nax.set(xlabel="x", ylabel="y", zlabel="f(x, y)")\nax2 = fig.add_subplot(1, 2, 2)\nax2.contourf(X, Y, Z, levels=30, cmap="Blues_r", alpha=0.6)\ncs = ax2.contour(X, Y, Z, levels=10, colors="gray", linewidths=1)\nax2.clabel(cs, fontsize=8)\nax2.set(aspect="equal", xlabel="x", ylabel="y", title="Карта высот")\n' + extra + 'plt.show()\n';
  }
  function surfSelect(parent, keys, value, onChange, label = 'Поверхность') {
    return ui.select(parent, { label, value, options: keys.map((k) => ({ value: k, label: SURF[k].label })), onChange });
  }
  /** Между какими линиями уровня лежит значение v. */
  function between(S, v) {
    const lv = levelsOf(S);
    let lo = -Infinity;
    let hi = Infinity;
    for (const l of lv) {
      if (l <= v && l > lo) lo = l;
      if (l > v && l < hi) hi = l;
    }
    if (!Number.isFinite(lo)) return 'ниже ' + f2(hi);
    if (!Number.isFinite(hi)) return 'выше ' + f2(lo);
    return f2(lo) + ' … ' + f2(hi);
  }
  /** Формула KaTeX в элементе; если KaTeX ещё грузится — перерисуем по событию mathready. */
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
  function card(title, plain = false) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums;overflow-x:auto;overflow-y:hidden' });
    const head = plain ? 'font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px' : 'font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px';
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' }, H('div', { style: head }, title), body);
    return { el, body };
  }
  const cardGrid = (min = 200) => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(' + min + 'px,1fr));gap:10px;margin:4px 0 10px' });
  function badge(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;' + st }, text);
  }
  /** Таблица: columns — строки или {key, label}; rows — массивы или объекты с теми же ключами. */
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    const keyed = columns.length && typeof columns[0] === 'object';
    const cols = keyed ? columns.map((c) => c.label) : columns;
    const rr = keyed ? rows.map((r) => (Array.isArray(r) ? r : columns.map((c) => r[c.key]))) : rows;
    ui.table(parent, { columns: cols, rows: rr, highlight, numeric });
  }
  function choiceButtons(box, options, onPick) {
    box.textContent = '';
    return options.map((o) => ui.button(box, { label: o.label, kind: 'primary', onClick: () => onPick(o.v) }));
  }
  /** Цвет текста, читаемый на фоне rgb. */
  const textOn = (rgb) => (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 145 ? '#14181f' : '#ffffff');
  /** Клетка-«тепловая» ячейка таблицы. */
  function heatCell(text, rgb, o = {}) {
    return H('td', {
      style: 'text-align:center;padding:4px 6px;font-variant-numeric:tabular-nums;min-width:44px;border:1px solid var(--surface);' +
        (rgb ? 'background:' + rgbStr(rgb) + ';color:' + textOn(rgb) + ';' : 'background:var(--surface-2);color:var(--muted);') +
        (o.hl ? 'outline:3px solid var(--c-tree);outline-offset:-3px;font-weight:700;' : ''),
      title: o.title || null,
    }, text);
  }

  /* ==============================================================================
   * Интуиция. Рельеф и его карта
   * ============================================================================== */
  GBC.widget('landscape', (el, cfg) => {
    const keys = ['hill', 'round', 'bowl', 'saddle', 'pits', 'wave', 'valley'];
    const s = { k: cfg.surface || 'hill', floor: true };
    [s.x, s.y] = SURF[s.k].p0;
    const w = ui.shell(el, { title: 'Рельеф и его карта', sub: 'Слева — график функции двух переменных: над каждой точкой (x, y) на высоте f(x, y) лежит точка поверхности. Справа — тот же рельеф сверху, карта высот: цвет и линии уровня. Тяните оранжевую точку на карте — она движется и по поверхности. Поверхность можно вращать.', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      [s.x, s.y] = SURF[v].p0;
      draw();
    });
    ui.toggle(w.controls, { label: 'Линии уровня на «полу»', checked: true, onChange: (v) => ((s.floor = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const s3 = new Surface3D(box, { height: 330 });
    const map = new GBC.Plot(box, { height: 330, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'точка (x, y)' }, { key: 'f', label: 'высота f(x, y)' }, { key: 'lv', label: 'между линиями уровня' }]);
    function draw() {
      const S = SURF[s.k];
      const z = S.f(s.x, s.y);
      s3.render({ S, levels: s.floor ? levelsOf(S) : [], points: [{ x: s.x, y: s.y, z, color: 'tree', r: 6, drop: true }] });
      map.render([...mapLayers(S), dragPoint(s, S.dom, draw)], domOf(S));
      st.set('p', vec(s.x, s.y));
      st.set('f', f3(z));
      st.set('lv', between(S, z));
      note.innerHTML = '<b>' + S.label + '.</b> ' + S.about + ' Цвет на обеих картинках один и тот же: низины — насыщенный синий, возвышенности — бледнее, почти цвет фона. Пунктир от точки вниз показывает, какой точке карты она соответствует.';
    }
    w.pythonAction(() => pySurface(SURF[s.k], 'ax2.plot(' + py(s.x) + ', ' + py(s.y) + ', "o", color="tab:orange", ms=9)\n'));
    draw();
  });

  /* ==============================================================================
   * Шаг 1. Функция с двумя входами: «машина» и таблица значений
   * ============================================================================== */
  const FM = {
    area: {
      label: 'площадь прямоугольника', tex: String.raw`S(a, b) = a \cdot b`, out: 'S', unit: 'м²',
      a: { label: 'длина a, м', min: 0, max: 10, step: 0.5, v: 3 }, b: { label: 'ширина b, м', min: 0, max: 10, step: 0.5, v: 4 },
      f: (a, b) => a * b, pyf: 'a * b',
      about: 'Самая простая функция двух переменных. Площадь растёт и от длины, и от ширины, причём скорость роста по длине равна ширине (и наоборот) — к этому вернёмся в шаге 7.',
    },
    price: {
      label: 'цена квартиры (модель)', tex: String.raw`P(s, d) = 2 + 0.1\,s - 0.4\,d`, out: 'P', unit: 'млн ₽',
      a: { label: 'площадь s, м²', min: 20, max: 120, step: 5, v: 60 }, b: { label: 'до центра d, км', min: 0, max: 15, step: 0.5, v: 5 },
      f: (s, d) => 2 + 0.1 * s - 0.4 * d, pyf: '2 + 0.1 * a - 0.4 * b',
      about: 'Линейная модель цены: каждый квадратный метр добавляет 0.1 млн, каждый километр до центра отнимает 0.4 млн. Коэффициенты 0.1 и −0.4 — это и есть частные производные (шаг 6).',
    },
    bmi: {
      label: 'индекс массы тела', tex: String.raw`\text{ИМТ}(m, h) = \dfrac{m}{h^2}`, out: 'ИМТ', unit: 'кг/м²',
      a: { label: 'масса m, кг', min: 40, max: 120, step: 1, v: 70 }, b: { label: 'рост h, м', min: 1.4, max: 2.1, step: 0.01, v: 1.75 },
      f: (m, h) => m / (h * h), pyf: 'a / b**2',
      about: 'Нелинейная функция: по массе ИМТ растёт равномерно, а по росту падает всё медленнее. При m = 70, h = 1.75 ИМТ = 22.86.',
    },
    mse: {
      label: 'ошибка прямой на шести квартирах', tex: String.raw`L(w, b) = \tfrac16 \sum_{i=1}^{6} \big(y_i - (w x_i + b)\big)^2`, out: 'L', unit: '',
      a: { label: 'наклон w', min: -1, max: 4, step: 0.1, v: 1 }, b: { label: 'сдвиг b', min: -4, max: 6, step: 0.1, v: 0 },
      f: (w, b) => { const x = [1, 2, 3, 4, 5, 6]; const y = [2, 4, 3, 7, 9, 11]; return U.mean(x.map((xi, i) => (y[i] - w * xi - b) ** 2)); },
      pyf: 'np.mean((np.array([2, 4, 3, 7, 9, 11]) - a * np.arange(1, 7) - b) ** 2)',
      about: 'Главная функция многих переменных в машинном обучении — потери как функция параметров модели. Здесь параметров два: наклон и сдвиг прямой y = w·x + b. Лучшая прямая — минимум этой функции: w = 1.83, b = −0.4, L = 0.914 (шаг 24).',
    },
    sphere: {
      label: 'полусфера (область — круг)', tex: String.raw`f(x, y) = \sqrt{4 - x^2 - y^2}`, out: 'f', unit: '',
      a: { label: 'x', min: -3, max: 3, step: 0.1, v: 1 }, b: { label: 'y', min: -3, max: 3, step: 0.1, v: 1 },
      f: (x, y) => (4 - x * x - y * y >= 0 ? Math.sqrt(4 - x * x - y * y) : NaN), pyf: 'np.sqrt(4 - a**2 - b**2) if a**2 + b**2 <= 4 else float("nan")',
      domain: 'x² + y² ≤ 4 — круг радиуса 2',
      about: 'Корень определён, только если 4 − x² − y² ≥ 0. Область определения — круг радиуса 2, а график — верхняя половина сферы. Вне круга функции нет — в таблице там прочерки.',
    },
    log: {
      label: 'логарифм суммы (область — полуплоскость)', tex: String.raw`f(x, y) = \ln(x + y)`, out: 'f', unit: '',
      a: { label: 'x', min: -3, max: 3, step: 0.1, v: 1 }, b: { label: 'y', min: -3, max: 3, step: 0.1, v: 0.5 },
      f: (x, y) => (x + y > 0 ? Math.log(x + y) : NaN), pyf: 'np.log(a + b) if a + b > 0 else float("nan")',
      domain: 'x + y > 0 — полуплоскость выше прямой y = −x',
      about: 'Логарифм определён для положительных чисел, поэтому область — полуплоскость x + y > 0, граница — прямая y = −x (сама она не входит). Вдоль любой прямой x + y = c значение одно и то же: это линии уровня.',
    },
  };
  GBC.widget('func-machine', (el) => {
    const s = { k: 'area' };
    const w = ui.shell(el, { foot: false, title: 'Функция с двумя входами', sub: 'Задайте оба входа ползунками — функция выдаст одно число. Ниже — таблица значений: столбцы — первый вход, строки — второй. Раскрашенная таблица — это уже почти карта высот.' });
    ui.select(w.controls, { label: 'Функция', value: s.k, options: Object.entries(FM).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.k = v), build()) });
    const sbox = H('div');
    w.controls.appendChild(sbox);
    const formula = H('div', { style: 'font-size:1.1rem;margin:4px 0 6px' });
    const result = H('div', { style: 'font-size:1.05rem;margin:0 0 10px;font-variant-numeric:tabular-nums' });
    const tbox = H('div', { style: 'overflow-x:auto' });
    w.main.append(formula, result, tbox);
    const note = w.note('', true);
    function build() {
      const M = FM[s.k];
      s.a = M.a.v;
      s.b = M.b.v;
      sbox.textContent = '';
      ui.slider(sbox, { label: M.a.label, min: M.a.min, max: M.a.max, step: M.a.step, value: s.a, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.a = v), draw()) });
      ui.slider(sbox, { label: M.b.label, min: M.b.min, max: M.b.max, step: M.b.step, value: s.b, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.b = v), draw()) });
      texInto(formula, M.tex, true);
      draw();
    }
    function draw() {
      const M = FM[s.k];
      const v = M.f(s.a, s.b);
      result.textContent = '';
      result.append(
        H('span', { style: 'color:var(--muted)' }, M.out + '(' + U.fmt(s.a, 2) + ', ' + U.fmt(s.b, 2) + ') = '),
        Number.isFinite(v) ? H('b', null, U.fmt(v, 4) + (M.unit ? ' ' + M.unit : '')) : H('b', { style: 'color:var(--critical-text)' }, 'не определена: точка вне области' + (M.domain ? ' (' + M.domain + ')' : ''))
      );
      const cols = U.linspace(M.a.min, M.a.max, 7);
      const rows = U.linspace(M.b.max, M.b.min, 7);
      const vals = [];
      for (const b of rows) for (const a of cols) vals.push(M.f(a, b));
      const fin = vals.filter(Number.isFinite);
      const [lo, hi] = fin.length ? U.extent(fin) : [0, 1];
      const col = rangeColor(lo, hi);
      const ia = U.argmax(cols.map((c) => -Math.abs(c - s.a)));
      const ib = U.argmax(rows.map((c) => -Math.abs(c - s.b)));
      const t = H('table', { style: 'border-collapse:collapse;font-size:.85rem;margin:0 auto' });
      const head = H('tr', null, H('th', { style: 'padding:4px 6px;color:var(--muted);font-weight:600;text-align:right' }, M.b.label.split(',')[0] + ' ↓  ' + M.a.label.split(',')[0] + ' →'));
      for (const a of cols) head.appendChild(H('th', { style: 'padding:4px 6px;color:var(--muted);font-weight:600' }, U.fmt(a, 3)));
      t.appendChild(head);
      rows.forEach((b, r) => {
        const tr = H('tr', null, H('th', { style: 'padding:4px 6px;color:var(--muted);font-weight:600;text-align:right' }, U.fmt(b, 3)));
        cols.forEach((a, c) => {
          const x = vals[r * 7 + c];
          tr.appendChild(heatCell(Number.isFinite(x) ? U.fmt(x, 3) : '—', Number.isFinite(x) ? col(x) : null, { hl: r === ib && c === ia }));
        });
        t.appendChild(tr);
      });
      tbox.replaceChildren(t);
      note.innerHTML = M.about + ' Рамкой выделена клетка таблицы, ближайшая к выбранным входам.';
    }
    w.pythonAction(() => {
      const M = FM[s.k];
      return 'import numpy as np\n\nf = lambda a, b: ' + M.pyf + '\nprint("f(' + py(s.a) + ', ' + py(s.b) + ') =", f(' + py(s.a) + ', ' + py(s.b) + '))\n\n# таблица значений: строки — второй вход, столбцы — первый\ncols = np.linspace(' + py(M.a.min) + ', ' + py(M.a.max) + ', 7)\nrows = np.linspace(' + py(M.b.max) + ', ' + py(M.b.min) + ', 7)\nfor b in rows:\n    print(f"{b:7.2f} |", " ".join(f"{f(a, b):8.3f}" for a in cols))\n';
    });
    build();
  });

  /* ==============================================================================
   * Шаг 2. Галерея поверхностей
   * ============================================================================== */
  GBC.widget('surface-3d', (el, cfg) => {
    const keys = cfg.keys || ['plane', 'round', 'bowl', 'dome', 'saddle', 'twist', 'trough', 'hill', 'cone', 'wave', 'pits', 'valley', 'monkey'];
    const s = { k: cfg.surface || keys[0], floor: true, zs: 1 };
    const w = ui.shell(el, { foot: false, title: cfg.title || 'Галерея поверхностей', sub: cfg.sub || 'График функции двух переменных — поверхность z = f(x, y). Выбирайте поверхность и вращайте её мышью или пальцем. Внизу, на «полу», — её линии уровня.', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => ((s.k = v), draw()));
    ui.slider(w.controls, { label: 'Вертикальный масштаб', min: 0.4, max: 1.6, step: 0.05, value: 1, format: (v) => '×' + U.fmt(v, 2), onInput: (v) => ((s.zs = v), draw()) });
    ui.toggle(w.controls, { label: 'Линии уровня на «полу»', checked: true, onChange: (v) => ((s.floor = v), draw()) });
    const s3 = new Surface3D(w.main, { height: 380 });
    const note = w.note('', true);
    function draw() {
      const S = SURF[s.k];
      s3.render({ S, levels: s.floor ? levelsOf(S) : [], zScale: s.zs, n: 40 });
      note.innerHTML = '<b>' + S.label + '.</b> ' + S.about;
    }
    w.pythonAction(() => pySurface(SURF[s.k]));
    draw();
  });

  /* ==============================================================================
   * Шаг 3. Срез уровнем: линия уровня f(x, y) = c
   * ============================================================================== */
  GBC.widget('level-slicer', (el) => {
    const keys = ['round', 'bowl', 'plane', 'saddle', 'hill', 'pits', 'valley'];
    const s = { k: 'bowl', all: true };
    const w = ui.shell(el, { title: 'Линия уровня — срез на высоте c', sub: 'Горизонтальная плоскость z = c разрезает поверхность. Линия разреза, спроецированная на карту, — линия уровня f(x, y) = c: все точки, где высота равна c. Двигайте c.', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      mkSlider();
      draw();
    });
    const cbox = H('div', { style: 'flex:1 1 220px' });
    w.controls.appendChild(cbox);
    ui.toggle(w.controls, { label: 'Остальные линии уровня', checked: true, onChange: (v) => ((s.all = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const s3 = new Surface3D(box, { height: 330 });
    const map = new GBC.Plot(box, { height: 330, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'уровень c' }, { key: 'shape', label: 'форма линии' }]);
    function mkSlider() {
      const S = SURF[s.k];
      const [lo, hi] = heightRange(S);
      const span = S.key === 'valley' ? 12 : hi - lo;
      s.c = Number((lo + span * 0.3).toPrecision(3));
      cbox.textContent = '';
      ui.slider(cbox, { label: 'Уровень c', min: Number(lo.toPrecision(3)), max: Number((lo + span).toPrecision(3)), step: Number((span / 200).toPrecision(2)), value: s.c, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.c = v), draw()) });
    }
    function shape(S, c) {
      const r = (v) => U.fmt(Math.sqrt(v), 3);
      switch (S.key) {
        case 'round': return c > 0 ? ['окружность радиуса ' + r(c), 'x² + y² = ' + U.fmt(c, 3) + ' — окружность радиуса √c = ' + r(c) + '. Чем выше уровень, тем шире кольцо.'] : ['точка', 'Уровень 0 — одна точка, дно чаши.'];
        case 'bowl': return c > 0 ? ['эллипс', 'x² + 3y² = ' + U.fmt(c, 3) + ' — эллипс с полуосями √c = ' + r(c) + ' по x и √(c/3) = ' + r(c / 3) + ' по y: по y он в √3 ≈ 1.73 раза уже, потому что по y чаша круче.'] : ['точка', 'Уровень 0 — одна точка, дно чаши.'];
        case 'plane': return ['прямая', '0.5x + y = ' + U.fmt(c, 3) + ' — прямая y = ' + U.fmt(c, 3) + ' − 0.5x. Все линии уровня плоскости параллельны, а при равном шаге по c — ещё и на равных расстояниях.'];
        case 'saddle': return Math.abs(c) < 1e-9 ? ['две прямые y = ±x', 'x² − y² = 0 — пара прямых y = x и y = −x: на них седло имеет ту же высоту, что и центр.'] : c > 0 ? ['гипербола (ветви по x)', 'x² − y² = ' + U.fmt(c, 3) + ' — гипербола, ветви которой уходят влево и вправо: вдоль x седло поднимается.'] : ['гипербола (ветви по y)', 'x² − y² = ' + U.fmt(c, 3) + ' — гипербола с ветвями вверх и вниз: вдоль y седло опускается.'];
        case 'hill': return c > 0 && c < 3 ? ['окружность радиуса ' + U.fmt(Math.sqrt(-2 * Math.log(c / 3)), 3), 'Холм симметричен, поэтому линии уровня — окружности: 3e^(−r²/2) = c даёт r = √(2 ln(3/c)).'] : ['—', 'Вне диапазона высот холма линии нет.'];
        default: return ['кривая', 'Линия уровня может состоять из нескольких отдельных кусков: у двух ям при средних c это два замкнутых контура, которые с ростом c сливаются в один.'];
      }
    }
    function draw() {
      const S = SURF[s.k];
      const grid = gridOf(S, S.dom, 120);
      const segs = contourSegs(grid, s.c);
      const [x0, x1, y0, y1] = S.dom;
      s3.render({
        S, levels: [],
        planes: [{ f: () => s.c, color: 'violet', alpha: 0.22, n: 14 }],
        segs3: [{ segs, z: s.c, color: 'tree', width: 2.6 }],
      });
      map.render([
        ...mapLayers(S, { levels: s.all ? levelsOf(S) : [] }),
        { type: 'contour', grid, level: s.c, color: 'tree', width: 2.8 },
      ], domOf(S));
      const [sh, txt] = shape(S, s.c);
      st.set('c', U.fmt(s.c, 3));
      st.set('shape', sh);
      note.innerHTML = txt + ' Серые линии на карте — уровни с равным шагом по высоте. <b>Где они гуще, там склон круче</b>: высота меняется на один и тот же шаг на меньшем расстоянии.';
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      const [x0, x1, y0, y1] = S.dom;
      return 'import numpy as np\nimport matplotlib.pyplot as plt\n\nf = lambda x, y: ' + S.py + '\nX, Y = np.meshgrid(np.linspace(' + py(x0) + ', ' + py(x1) + ', 300), np.linspace(' + py(y0) + ', ' + py(y1) + ', 300))\nZ = f(X, Y)\nc = ' + py(s.c) + '\n\nfig, ax = plt.subplots(figsize=(6, 5))\nax.contour(X, Y, Z, levels=12, colors="gray", linewidths=0.8)\nax.contour(X, Y, Z, levels=[c], colors="tab:orange", linewidths=2.5)\nax.set(aspect="equal", xlabel="x", ylabel="y", title=f"линия уровня f(x, y) = {c}")\nplt.show()\n';
    });
    mkSlider();
    draw();
  });

  /* ==============================================================================
   * Шаг 4. Срезы и профиль вдоль пути
   * ============================================================================== */
  GBC.widget('profile-path', (el) => {
    const keys = ['bowl', 'hill', 'saddle', 'pits', 'wave', 'valley'];
    const s = { k: 'bowl' };
    const reset = () => {
      const S = SURF[s.k];
      const [x0, x1] = S.dom;
      s.A = { x: snap(x0 + 0.1 * (x1 - x0)), y: snap(S.p0[1]) };
      s.B = { x: snap(x1 - 0.1 * (x1 - x0)), y: snap(S.p0[1]) };
    };
    reset();
    const w = ui.shell(el, { title: 'Срез — профиль рельефа вдоль пути', sub: 'Вертикальная стенка над отрезком AB режет поверхность. Линия разреза — обычная функция одной переменной: высота как функция пройденного пути. Тяните концы A и B или выберите стандартный срез.', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      reset();
      draw();
    });
    const bx = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end' });
    w.controls.appendChild(bx);
    const setSlice = (axis) => {
      const S = SURF[s.k];
      const [x0, x1, y0, y1] = S.dom;
      if (axis === 'x') {
        const y = s.A.y;
        s.A = { x: x0, y };
        s.B = { x: x1, y };
      } else {
        const x = s.A.x;
        s.A = { x, y: y0 };
        s.B = { x, y: y1 };
      }
      s.mode = axis;
      draw();
    };
    ui.button(bx, { label: 'Срез вдоль x (y заморожен)', small: true, onClick: () => setSlice('x') });
    ui.button(bx, { label: 'Срез вдоль y (x заморожен)', small: true, onClick: () => setSlice('y') });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const s3 = new Surface3D(box, { height: 300 });
    const map = new GBC.Plot(box, { height: 300, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const prof = new GBC.Plot(w.main, { height: 220, x: { label: 'путь от A к B, s' }, y: { label: 'высота f' }, crosshair: true });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'A', label: 'A' }, { key: 'B', label: 'B' }, { key: 'len', label: 'длина AB' }, { key: 'n', label: 'пересечено линий уровня' }]);
    function draw() {
      const S = SURF[s.k];
      const { A, B } = s;
      const len = Math.hypot(B.x - A.x, B.y - A.y);
      const ts = U.linspace(0, 1, 241);
      const pts = ts.map((t) => [A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t]);
      const zs = pts.map(([x, y]) => S.f(x, y));
      const [lo, hi] = heightRange(S);
      s3.render({
        S, levels: levelsOf(S),
        walls: [{ a: [A.x, A.y], b: [B.x, B.y], color: 'violet', alpha: 0.14, n: 16 }],
        curves: [{ pts: pts.map((p, i) => [p[0], p[1], zs[i]]), color: 'tree', width: 3 }],
      });
      map.render([
        ...mapLayers(S),
        { type: 'segments', x1: [A.x], y1: [A.y], x2: [B.x], y2: [B.y], color: 'tree', width: 2.4, opacity: 1 },
        { type: 'text', items: [{ x: A.x, y: A.y, dx: -14, dy: -8, text: 'A', bold: true }, { x: B.x, y: B.y, dx: 6, dy: -8, text: 'B', bold: true }] },
        dragPoint(A, S.dom, () => ((s.mode = 'free'), draw()), { r: 6 }),
        dragPoint(B, S.dom, () => ((s.mode = 'free'), draw()), { r: 6 }),
      ], domOf(S));
      let crossings = 0;
      const lv = levelsOf(S);
      for (const L of lv) for (let i = 1; i < zs.length; i++) if ((zs[i - 1] - L) * (zs[i] - L) < 0) crossings++;
      const sv = ts.map((t) => t * len);
      const zc = zs.map((z) => (S.zr ? U.clamp(z, lo, hi) : z));
      prof.render([
        ...lv.filter((L) => L <= Math.max(...zc) && L >= Math.min(...zc)).map((L) => ({ type: 'hline', y: L, color: 'grid', width: 1 })),
        { type: 'line', x: sv, y: zc, color: 'tree', width: 2.6, label: 'f вдоль пути' },
        { type: 'points', x: [0, len], y: [zc[0], zc[zc.length - 1]], color: 'tree', r: 5 },
      ], { y: yDom(zc) });
      st.set('A', vec(A.x, A.y));
      st.set('B', vec(B.x, B.y));
      st.set('len', f3(len));
      st.set('n', String(crossings));
      const mode = Math.abs(A.y - B.y) < 1e-9 ? 'x' : Math.abs(A.x - B.x) < 1e-9 ? 'y' : 'free';
      note.innerHTML = (mode === 'x' ? '<b>Срез вдоль x при y = ' + f2(A.y) + '</b>: y заморожен, осталась функция одной переменной g(x) = f(x, ' + f2(A.y) + '). Её наклон в точке — <b>частная производная ∂f/∂x</b> (шаг 6). ' : mode === 'y' ? '<b>Срез вдоль y при x = ' + f2(A.x) + '</b>: x заморожен, g(y) = f(' + f2(A.x) + ', y). Её наклон — <b>частная производная ∂f/∂y</b>. ' : 'Произвольный срез: высота как функция пути s вдоль AB. Его наклон — <b>производная по направлению</b> AB (шаг 13). ') + 'Горизонтальные линии на профиле — уровни карты: каждое пересечение профилем такой линии — это пересечение отрезком AB линии уровня. Где пересечения частые — профиль крутой.';
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      return 'import numpy as np\nimport matplotlib.pyplot as plt\n\nf = lambda x, y: ' + S.py + '\nA, B = np.array([' + py(s.A.x) + ', ' + py(s.A.y) + ']), np.array([' + py(s.B.x) + ', ' + py(s.B.y) + '])\nt = np.linspace(0, 1, 300)\nP = A + np.outer(t, B - A)              # точки отрезка AB\ns = t * np.linalg.norm(B - A)           # пройденный путь\nplt.plot(s, f(P[:, 0], P[:, 1]), color="tab:orange", lw=2.5)\nplt.xlabel("путь от A к B"); plt.ylabel("высота f")\nplt.title("Профиль рельефа вдоль AB")\nplt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 5. Предел по разным путям
   * ============================================================================== */
  const LIM = {
    a: { label: 'xy / (x² + y²)', f: (x, y) => (x * y) / (x * x + y * y), mid: 0, span: 0.5, py: 'x * y / (x**2 + y**2)',
      line: (k) => k / (1 + k * k), par: () => 0, verdict: 'Предела нет: вдоль прямых y = kx функция постоянна и равна k/(1 + k²) — для разных k разные числа.' },
    b: { label: 'x²y / (x⁴ + y²)', f: (x, y) => (x * x * y) / (x ** 4 + y * y), mid: 0, span: 0.5, py: 'x**2 * y / (x**4 + y**2)',
      line: () => 0, par: (a) => a / (1 + a * a), verdict: 'Ловушка: вдоль всех прямых предел 0, но вдоль параболы y = ax² — a/(1 + a²). Проверки по прямым недостаточно: предела нет.' },
    c: { label: 'x²y / (x² + y²)', f: (x, y) => (x * x * y) / (x * x + y * y), mid: 0, span: 0.5, py: 'x**2 * y / (x**2 + y**2)',
      line: () => 0, par: () => 0, lim: 0, verdict: 'Предел есть и равен 0: |x²y/(x² + y²)| ≤ |y| → 0, какой бы путь ни выбрать (теорема о сжатии, урок 15.4).' },
    d: { label: 'sin(x² + y²) / (x² + y²)', f: (x, y) => { const r = x * x + y * y; return Math.sin(r) / r; }, mid: 0.9, span: 0.1, py: 'np.sin(x**2 + y**2) / (x**2 + y**2)',
      line: () => 1, par: () => 1, lim: 1, verdict: 'Предел есть и равен 1: функция зависит только от r² = x² + y², а sin t / t → 1 (замечательный предел).' },
  };
  GBC.widget('path-limit', (el) => {
    const s = { k: 'a', path: 'line', k_: 1, a: 1 };
    const w = ui.shell(el, { title: 'Предел в точке (0, 0) по разным путям', sub: 'В одной переменной к точке подходят слева и справа, а на плоскости — по бесконечному числу путей. Предел существует, только если все пути ведут к одному числу.' });
    ui.select(w.controls, { label: 'Функция', value: s.k, options: Object.entries(LIM).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.k = v), draw()) });
    ui.segmented(w.controls, { label: 'Путь к (0, 0)', value: s.path, options: [{ value: 'line', label: 'прямая y = kx' }, { value: 'par', label: 'парабола y = ax²' }], onChange: (v) => ((s.path = v), draw()) });
    ui.slider(w.controls, { label: 'k (наклон прямой)', min: -3, max: 3, step: 0.1, value: s.k_, onInput: (v) => ((s.k_ = v), draw()) });
    ui.slider(w.controls, { label: 'a (раскрытие параболы)', min: -3, max: 3, step: 0.1, value: s.a, onInput: (v) => ((s.a = v), draw()) });
    const map = new GBC.Plot(w.main, { height: 300, equal: true, x: { label: 'x', domain: [-1, 1] }, y: { label: 'y', domain: [-1, 1] }, grid: 'none' });
    const pl = new GBC.Plot(w.main, { height: 220, x: { label: 'x (расстояние до нуля по горизонтали)', type: 'log', domain: [1e-3, 1], ticks: decades(-3, 0), format: powFmt }, y: { label: 'значение f на пути' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'f при x = 0.001' }, { key: 'L', label: 'предел вдоль пути' }, { key: 'all', label: 'общий предел' }]);
    function draw() {
      const F = LIM[s.k];
      const div = GBC.colors.diverging();
      const grid = GBC.Plot.grid(F.f, -1, 1, -1, 1, 121, 121);
      const xs = decades(-3, 0, 0.02);
      const yOf = (x) => (s.path === 'line' ? s.k_ * x : s.a * x * x);
      const vals = xs.map((x) => F.f(x, yOf(x)));
      const pathX = U.linspace(0.001, 1, 200);
      const L = s.path === 'line' ? F.line(s.k_) : F.par(s.a);
      map.render([
        { type: 'heatmap', grid, colorFn: (v) => div((v - F.mid) / F.span), opacity: 0.6 },
        { type: 'line', x: pathX, y: pathX.map(yOf), color: 'tree', width: 2.6, hover: false },
        { type: 'points', x: [0], y: [0], color: 'ink', r: 5, hollow: true },
      ], { x: [-1, 1], y: [-1, 1] });
      const all = [...vals, L, F.mid - F.span, F.mid + F.span];
      const [lo, hi] = U.extent(all);
      pl.render([
        { type: 'hline', y: L, color: 'muted', dash: '5 4', text: 'предел вдоль пути ' + f3(L) },
        { type: 'line', x: xs, y: vals, color: 'tree', width: 2.4, label: 'f на пути' },
      ], { y: [lo - 0.18 * (hi - lo), hi + 0.18 * (hi - lo)] });
      st.set('v', f4(vals[0]));
      st.set('L', f3(L));
      st.set('all', F.lim !== undefined ? String(F.lim) : 'нет');
      note.innerHTML = 'Путь подходит к нулю справа: x идёт от 1 к 0.001 (ось x логарифмическая — справа налево мы приближаемся к нулю). Цвет карты — значение функции: красный — положительное, синий — отрицательное. ' + F.verdict;
    }
    w.pythonAction(() => {
      const F = LIM[s.k];
      return 'import numpy as np\n\nf = lambda x, y: ' + F.py + '\nfor x in [0.1, 0.01, 0.001, 1e-6]:\n    line = f(x, ' + py(s.k_) + ' * x)      # по прямой y = kx\n    par = f(x, ' + py(s.a) + ' * x**2)     # по параболе y = ax²\n    print(f"x = {x:g}: по прямой {line:.6f}, по параболе {par:.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 6. Частные производные — наклоны срезов
   * ============================================================================== */
  GBC.widget('partials', (el) => {
    const keys = ['bowl', 'xexp', 'hill', 'saddle', 'wave', 'valley', 'plane'];
    const s = { k: 'bowl', h: 0.5 };
    [s.x, s.y] = SURF[s.k].p0;
    const w = ui.shell(el, { title: 'Частные производные — наклоны двух срезов', sub: 'Через точку проходят два среза: вдоль x (оранжевый, y заморожен) и вдоль y (фиолетовый, x заморожен). Наклон каждого среза — частная производная. Ползунок h показывает секущую: при h → 0 она превращается в касательную.', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      [s.x, s.y] = SURF[v].p0;
      draw();
    });
    ui.slider(w.controls, { label: 'шаг секущей h', min: 0.01, max: 1, step: 0.01, value: s.h, onInput: (v) => ((s.h = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const s3 = new Surface3D(box, { height: 300 });
    const map = new GBC.Plot(box, { height: 300, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const box2 = H('div', { class: 'plots-2' });
    w.main.appendChild(box2);
    const sx = new GBC.Plot(box2, { height: 210, x: { label: 'x  (y заморожен)' }, y: { label: 'f' } });
    const sy = new GBC.Plot(box2, { height: 210, x: { label: 'y  (x заморожен)' }, y: { label: 'f' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'точка' }, { key: 'f', label: 'f' }, { key: 'qx', label: '[f(x+h, y) − f]/h' }, { key: 'dx', label: '∂f/∂x' }, { key: 'qy', label: '[f(x, y+h) − f]/h' }, { key: 'dy', label: '∂f/∂y' }]);
    function slicePlot(P, ts, fn, t0, slope, h, color, z) {
      const d = (ts[ts.length - 1] - ts[0]) * 0.18;
      P.render([
        { type: 'line', x: ts, y: ts.map(fn), color, width: 2.4, hover: false },
        { type: 'segments', x1: [t0 - d], y1: [z - d * slope], x2: [t0 + d], y2: [z + d * slope], color: 'ink', width: 2, opacity: 0.9 },
        { type: 'segments', x1: [t0 - d * 0.6], y1: [z - d * 0.6 * ((fn(t0 + h) - z) / h)], x2: [t0 + h + d * 0.6], y2: [z + (h + d * 0.6) * ((fn(t0 + h) - z) / h)], color: 'muted', width: 1.4, dash: '5 4', opacity: 0.9 },
        { type: 'points', x: [t0, t0 + h], y: [z, fn(t0 + h)], color: color, r: 5 },
      ], { y: yDom(ts.map(fn)) });
    }
    function draw() {
      const S = SURF[s.k];
      const [x0, x1, y0, y1] = S.dom;
      const { x, y, h } = s;
      const z = S.f(x, y);
      const [gx, gy] = grad(S, x, y);
      const xs = U.linspace(x0, x1, 160);
      const ys = U.linspace(y0, y1, 160);
      const dd = (x1 - x0) * 0.16;
      s3.render({
        S, levels: levelsOf(S),
        curves: [
          { pts: xs.map((t) => [t, y, S.f(t, y)]), color: 'tree', width: 2.8 },
          { pts: ys.map((t) => [x, t, S.f(x, t)]), color: 'violet', width: 2.8 },
          { pts: [[x - dd, y, z - dd * gx], [x + dd, y, z + dd * gx]], color: 'ink', width: 2, raw: true },
          { pts: [[x, y - dd, z - dd * gy], [x, y + dd, z + dd * gy]], color: 'ink', width: 2, raw: true },
        ],
        points: [{ x, y, z, color: 'tree', r: 5.5 }],
      });
      map.render([
        ...mapLayers(S),
        { type: 'segments', x1: [x0], y1: [y], x2: [x1], y2: [y], color: 'tree', width: 1.6, dash: '6 4', opacity: 0.95 },
        { type: 'segments', x1: [x], y1: [y0], x2: [x], y2: [y1], color: 'violet', width: 1.6, dash: '6 4', opacity: 0.95 },
        dragPoint(s, S.dom, draw),
      ], domOf(S));
      slicePlot(sx, xs, (t) => S.f(t, y), x, gx, h, 'tree', z);
      slicePlot(sy, ys, (t) => S.f(x, t), y, gy, h, 'violet', z);
      const qx = (S.f(x + h, y) - z) / h;
      const qy = (S.f(x, y + h) - z) / h;
      st.set('p', vec(x, y));
      st.set('f', f3(z));
      st.set('qx', f3(qx));
      st.set('dx', f3(gx));
      st.set('qy', f3(qy));
      st.set('dy', f3(gy));
      note.innerHTML = 'Чёрные отрезки — касательные к срезам, их наклоны — частные производные ∂f/∂x = ' + f3(gx) + ' и ∂f/∂y = ' + f3(gy) + '. Серый пунктир — секущая через точки с шагом h: её наклон ' + f3(qx) + ' (по x) и ' + f3(qy) + ' (по y). Уменьшайте h — секущая прижмётся к касательной, а разностное отношение — к производной.' + (S.key === 'bowl' ? ' Для x² + 3y²: ∂f/∂x = 2x, ∂f/∂y = 6y.' : '');
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      return 'import numpy as np\n\nf = lambda x, y: ' + S.py + '\nx, y = ' + py(s.x) + ', ' + py(s.y) + '\nfor h in [0.5, 0.1, 0.01, 0.001]:\n    qx = (f(x + h, y) - f(x, y)) / h      # y заморожен\n    qy = (f(x, y + h) - f(x, y)) / h      # x заморожен\n    print(f"h = {h:<6} ∂f/∂x ≈ {qx:.6f}   ∂f/∂y ≈ {qy:.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 7. «Заморозка»: частные производные по правилам
   * ============================================================================== */
  const G = (v) => String.raw`\textcolor{#8a8f98}{` + v + '}';
  const PD = [
    {
      name: 'x² + 3y²', stars: 1, vars: ['x', 'y'], pt: [1, 1], fn: (x, y) => x * x + 3 * y * y, tex: String.raw`f(x, y) = x^2 + 3y^2`,
      d: [
        { frozen: String.raw`x^2 + 3` + G('y') + '^2', steps: [[String.raw`(x^2)' + (3` + G('y^2') + ")'", 'второе слагаемое — константа'], [String.raw`2x + 0`, '']], res: String.raw`\dfrac{\partial f}{\partial x} = 2x`, fn: (x) => 2 * x },
        { frozen: G('x') + String.raw`^2 + 3y^2`, steps: [[String.raw`(` + G('x^2') + ")' + (3y^2)'", 'первое слагаемое — константа'], [String.raw`0 + 6y`, '']], res: String.raw`\dfrac{\partial f}{\partial y} = 6y`, fn: (x, y) => 6 * y },
      ],
    },
    {
      name: '3x − 5y + 7', stars: 1, vars: ['x', 'y'], pt: [2, 1], fn: (x, y) => 3 * x - 5 * y + 7, tex: String.raw`f(x, y) = 3x - 5y + 7`,
      d: [
        { frozen: String.raw`3x - 5` + G('y') + ' + 7', steps: [[String.raw`3 - 0 + 0`, 'линейная функция: коэффициент при x']], res: String.raw`\dfrac{\partial f}{\partial x} = 3`, fn: () => 3 },
        { frozen: '3' + G('x') + String.raw` - 5y + 7`, steps: [[String.raw`0 - 5 + 0`, 'коэффициент при y']], res: String.raw`\dfrac{\partial f}{\partial y} = -5`, fn: () => -5 },
      ],
    },
    {
      name: 'x²y', stars: 1, vars: ['x', 'y'], pt: [1, 2], fn: (x, y) => x * x * y, tex: String.raw`f(x, y) = x^2 y`,
      d: [
        { frozen: String.raw`x^2 \cdot ` + G('y'), steps: [[G('y') + String.raw`\cdot (x^2)'`, 'константный множитель выносится — он не ноль!'], [String.raw`y \cdot 2x`, '']], res: String.raw`\dfrac{\partial f}{\partial x} = 2xy`, fn: (x, y) => 2 * x * y },
        { frozen: G('x^2') + String.raw` \cdot y`, steps: [[G('x^2') + String.raw`\cdot (y)'`, 'теперь константа — множитель x²'], [String.raw`x^2 \cdot 1`, '']], res: String.raw`\dfrac{\partial f}{\partial y} = x^2`, fn: (x) => x * x },
      ],
    },
    {
      name: 'x·e^(xy)', stars: 2, vars: ['x', 'y'], pt: [1, 0.5], fn: (x, y) => x * E(x * y), tex: String.raw`f(x, y) = x\,e^{xy}`,
      d: [
        { frozen: String.raw`x\,e^{x` + G('y') + '}', steps: [[String.raw`(x)'\,e^{xy} + x\,(e^{x` + G('y') + "})'", 'правило произведения: x есть в обоих множителях'], [String.raw`e^{xy} + x \cdot e^{xy} \cdot ` + G('y'), 'цепное правило: (e^{xy})′ по x = e^{xy}·y'], [String.raw`(1 + xy)\,e^{xy}`, '']], res: String.raw`\dfrac{\partial f}{\partial x} = (1 + xy)\,e^{xy}`, fn: (x, y) => (1 + x * y) * E(x * y) },
        { frozen: G('x') + String.raw`\,e^{` + G('x') + 'y}', steps: [[G('x') + String.raw`\cdot (e^{` + G('x') + "y})'", 'x — константный множитель'], [String.raw`x \cdot e^{xy} \cdot ` + G('x'), 'цепное правило: внутренняя производная x'], [String.raw`x^2 e^{xy}`, '']], res: String.raw`\dfrac{\partial f}{\partial y} = x^2 e^{xy}`, fn: (x, y) => x * x * E(x * y) },
      ],
    },
    {
      name: 'ln(x² + y²)', stars: 2, vars: ['x', 'y'], pt: [1, 2], fn: (x, y) => Math.log(x * x + y * y), tex: String.raw`f(x, y) = \ln(x^2 + y^2)`,
      d: [
        { frozen: String.raw`\ln(x^2 + ` + G('y^2') + ')', steps: [[String.raw`\dfrac{1}{x^2 + y^2} \cdot (x^2 + ` + G('y^2') + ")'", 'цепное правило: (ln u)′ = u′/u'], [String.raw`\dfrac{1}{x^2 + y^2} \cdot 2x`, '']], res: String.raw`\dfrac{\partial f}{\partial x} = \dfrac{2x}{x^2 + y^2}`, fn: (x, y) => (2 * x) / (x * x + y * y) },
        { frozen: String.raw`\ln(` + G('x^2') + ' + y^2)', steps: [[String.raw`\dfrac{1}{x^2 + y^2} \cdot (` + G('x^2') + " + y^2)'", 'то же самое по y'], [String.raw`\dfrac{2y}{x^2 + y^2}`, '']], res: String.raw`\dfrac{\partial f}{\partial y} = \dfrac{2y}{x^2 + y^2}`, fn: (x, y) => (2 * y) / (x * x + y * y) },
      ],
    },
    {
      name: 'sin x · cos y', stars: 2, vars: ['x', 'y'], pt: [Math.PI / 3, Math.PI / 4], ptLabel: '(π/3, π/4)', fn: (x, y) => Math.sin(x) * Math.cos(y), tex: String.raw`f(x, y) = \sin x \cdot \cos y`,
      d: [
        { frozen: String.raw`\sin x \cdot ` + G(String.raw`\cos y`), steps: [[G(String.raw`\cos y`) + String.raw`\cdot (\sin x)'`, 'cos y — константный множитель']], res: String.raw`\dfrac{\partial f}{\partial x} = \cos x \cos y`, fn: (x, y) => Math.cos(x) * Math.cos(y) },
        { frozen: G(String.raw`\sin x`) + String.raw` \cdot \cos y`, steps: [[G(String.raw`\sin x`) + String.raw`\cdot (\cos y)'`, 'sin x — константный множитель']], res: String.raw`\dfrac{\partial f}{\partial y} = -\sin x \sin y`, fn: (x, y) => -Math.sin(x) * Math.sin(y) },
      ],
    },
    {
      name: 'ИМТ = m/h²', stars: 2, vars: ['m', 'h'], pt: [70, 1.75], fn: (m, h) => m / (h * h), tex: String.raw`\text{ИМТ}(m, h) = \dfrac{m}{h^2}`,
      d: [
        { frozen: String.raw`m \cdot ` + G('h^{-2}'), steps: [[G('h^{-2}') + String.raw`\cdot (m)'`, 'h — константа'], [String.raw`\dfrac{1}{h^2}`, '']], res: String.raw`\dfrac{\partial\,\text{ИМТ}}{\partial m} = \dfrac{1}{h^2}`, fn: (m, h) => 1 / (h * h), unit: 'кг/м² на каждый килограмм' },
        { frozen: G('m') + String.raw` \cdot h^{-2}`, steps: [[G('m') + String.raw`\cdot (h^{-2})'`, 'm — константный множитель'], [String.raw`m \cdot (-2)\,h^{-3}`, 'правило степени']], res: String.raw`\dfrac{\partial\,\text{ИМТ}}{\partial h} = -\dfrac{2m}{h^3}`, fn: (m, h) => (-2 * m) / h ** 3, unit: 'кг/м² на метр роста (на сантиметр — в 100 раз меньше)' },
      ],
    },
    {
      name: 'x^y', stars: 3, vars: ['x', 'y'], pt: [2, 3], fn: (x, y) => Math.pow(x, y), tex: String.raw`f(x, y) = x^{y}\quad (x > 0)`,
      d: [
        { frozen: String.raw`x^{` + G('y') + '}', steps: [[String.raw`x^{` + G('y') + "}\\text{ — степень с постоянным показателем}", 'правило степени, как у x³'], [String.raw`y\,x^{y-1}`, '']], res: String.raw`\dfrac{\partial f}{\partial x} = y\,x^{y - 1}`, fn: (x, y) => y * Math.pow(x, y - 1) },
        { frozen: G('x') + String.raw`^{\,y}`, steps: [[G('x') + String.raw`^{\,y}\text{ — показательная функция}`, 'как у 2^y: основание постоянно'], [String.raw`x^y \ln x`, '']], res: String.raw`\dfrac{\partial f}{\partial y} = x^{y} \ln x`, fn: (x, y) => Math.pow(x, y) * Math.log(x) },
      ],
    },
    {
      name: '√(x² + y²)', stars: 3, vars: ['x', 'y'], pt: [3, 4], fn: (x, y) => Math.hypot(x, y), tex: String.raw`f(x, y) = \sqrt{x^2 + y^2}`,
      d: [
        { frozen: String.raw`\sqrt{x^2 + ` + G('y^2') + '}', steps: [[String.raw`\dfrac{1}{2\sqrt{x^2 + y^2}} \cdot 2x`, 'цепное правило: (√u)′ = u′/(2√u)']], res: String.raw`\dfrac{\partial f}{\partial x} = \dfrac{x}{\sqrt{x^2 + y^2}}`, fn: (x, y) => x / Math.hypot(x, y) },
        { frozen: String.raw`\sqrt{` + G('x^2') + ' + y^2}', steps: [[String.raw`\dfrac{1}{2\sqrt{x^2 + y^2}} \cdot 2y`, 'то же по y']], res: String.raw`\dfrac{\partial f}{\partial y} = \dfrac{y}{\sqrt{x^2 + y^2}}`, fn: (x, y) => y / Math.hypot(x, y) },
      ],
      extra: 'В точке (3, 4): (0.6, 0.8) — единичный вектор, направленный от начала координат. В самом начале координат формулы делят на ноль: у конуса там острие, частных производных нет.',
    },
    {
      name: 'потери (y − wx − b)²', stars: 3, vars: ['w', 'b'], pt: [1, 0], fn: (w, b) => (5 - w * 2 - b) ** 2, tex: String.raw`L(w, b) = \big(y - (w x + b)\big)^2,\quad x = 2,\; y = 5`,
      d: [
        { frozen: String.raw`\big(` + G('y') + ' - w' + G('x') + ' - ' + G('b') + String.raw`\big)^2`, steps: [[String.raw`2\big(y - wx - b\big) \cdot (` + G('y') + ' - w' + G('x') + ' - ' + G('b') + ")'", 'цепное правило; данные x, y — константы!'], [String.raw`2\big(y - wx - b\big) \cdot (-` + G('x') + ')', '']], res: String.raw`\dfrac{\partial L}{\partial w} = -2x\,\big(y - wx - b\big)`, fn: (w, b) => -2 * 2 * (5 - 2 * w - b) },
        { frozen: String.raw`\big(` + G('y') + ' - ' + G('w') + G('x') + String.raw` - b\big)^2`, steps: [[String.raw`2\big(y - wx - b\big) \cdot (-1)`, 'внутренняя производная по b равна −1']], res: String.raw`\dfrac{\partial L}{\partial b} = -2\,\big(y - wx - b\big)`, fn: (w, b) => -2 * (5 - 2 * w - b) },
      ],
      extra: 'Здесь переменные — параметры модели w и b, а x = 2 и y = 5 — данные, то есть константы. В точке (w, b) = (1, 0): остаток y − wx − b = 3, ∂L/∂w = −12, ∂L/∂b = −6. Знаки отрицательные: увеличивая w и b, ошибку можно уменьшить.',
    },
  ];
  GBC.widget('partial-freezer', (el) => {
    const s = { i: 0, v: 0 };
    const STARS = ['', '★', '★★', '★★★'];
    const w = ui.shell(el, { foot: false, title: 'Частная производная: «заморозь» остальное', sub: 'Выберите функцию и переменную. Серым выделено всё, что при этом дифференцировании — константа. Дальше работают обычные правила урока 15.6. Внизу — проверка численно.' });
    ui.select(w.controls, { label: 'Функция', value: '0', options: PD.map((p, i) => ({ value: String(i), label: STARS[p.stars] + ' ' + p.name })), onChange: (v) => ((s.i = Number(v)), (s.v = 0), build()) });
    const segBox = H('div');
    w.controls.appendChild(segBox);
    const main = H('div');
    w.main.appendChild(main);
    const note = w.note('', true);
    function build() {
      const p = PD[s.i];
      segBox.textContent = '';
      ui.segmented(segBox, { label: 'Дифференцируем по', value: s.v, options: p.vars.map((v, i) => ({ value: i, label: v })), onChange: (v) => ((s.v = v), draw()) });
      draw();
    }
    function draw() {
      const p = PD[s.i];
      const d = p.d[s.v];
      const vn = p.vars[s.v];
      const other = p.vars[1 - s.v];
      main.textContent = '';
      main.appendChild(texEl(p.tex, true, 'font-size:1.05rem'));
      const c1 = card('1. Замораживаем ' + other + ' — теперь это число', true);
      c1.body.appendChild(texEl(d.frozen, true));
      const c2 = card('2. Дифференцируем по ' + vn, true);
      for (const [tx, cm] of d.steps) {
        const row = H('div', { style: 'display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;margin:2px 0' }, texEl('= ' + tx, false), cm ? H('span', { style: 'color:var(--muted);font-size:.88rem' }, cm) : null);
        c2.body.appendChild(row);
      }
      const c3 = card('3. Ответ', true);
      c3.body.appendChild(texEl(d.res, true));
      const [a, b] = p.pt;
      const exact = d.fn(a, b);
      const e = 1e-6;
      const num = s.v === 0 ? (p.fn(a + e, b) - p.fn(a - e, b)) / (2 * e) : (p.fn(a, b + e) - p.fn(a, b - e)) / (2 * e);
      const c4 = card('4. Проверка в точке ' + (p.ptLabel || vec(a, b, 3)), true);
      c4.body.append(
        H('div', null, 'по формуле: ', H('b', null, U.fmt(exact, 6))),
        H('div', null, 'численно, центральная разность с h = 10⁻⁶: ', H('b', null, U.fmt(num, 6))),
        H('div', { style: 'margin-top:4px' }, badge(Math.abs(num - exact) < 1e-5 * (1 + Math.abs(exact)) ? 'совпадает' : 'расходится', Math.abs(num - exact) < 1e-5 * (1 + Math.abs(exact)) ? 'good' : 'bad')),
      );
      if (d.unit) c4.body.appendChild(H('div', { style: 'color:var(--muted);font-size:.88rem;margin-top:4px' }, 'Единицы: ' + d.unit));
      const grid = cardGrid(240);
      grid.append(c1.el, c2.el, c3.el, c4.el);
      main.appendChild(grid);
      note.innerHTML = 'Правило одно: <b>все переменные, кроме той, по которой дифференцируем, — константы</b>. Константа-слагаемое даёт ноль, константа-множитель остаётся множителем. ' + (p.extra || '');
    }
    const PYF = [
      ['x**2 + 3 * y**2', '2 * x', '6 * y'], ['3 * x - 5 * y + 7', '3 + 0 * x', '-5 + 0 * x'], ['x**2 * y', '2 * x * y', 'x**2'],
      ['x * np.exp(x * y)', '(1 + x * y) * np.exp(x * y)', 'x**2 * np.exp(x * y)'], ['np.log(x**2 + y**2)', '2 * x / (x**2 + y**2)', '2 * y / (x**2 + y**2)'],
      ['np.sin(x) * np.cos(y)', 'np.cos(x) * np.cos(y)', '-np.sin(x) * np.sin(y)'], ['x / y**2', '1 / y**2', '-2 * x / y**3'],
      ['x**y', 'y * x**(y - 1)', 'x**y * np.log(x)'], ['np.hypot(x, y)', 'x / np.hypot(x, y)', 'y / np.hypot(x, y)'],
      ['(5 - (x * 2 + y))**2', '-2 * 2 * (5 - 2 * x - y)', '-2 * (5 - 2 * x - y)'],
    ];
    w.pythonAction(() => {
      const p = PD[s.i];
      const [ff, dx, dy] = PYF[s.i];
      const nm = p.vars;
      return 'import numpy as np\n\n# переменные: ' + nm.join(', ') + ' (в коде — x и y)\nf = lambda x, y: ' + ff + '\ndfdx = lambda x, y: ' + dx + '     # ∂f/∂' + nm[0] + ' по правилам\ndfdy = lambda x, y: ' + dy + '     # ∂f/∂' + nm[1] + ' по правилам\n\nx, y, e = ' + py(p.pt[0]) + ', ' + py(p.pt[1]) + ', 1e-6\nnum_x = (f(x + e, y) - f(x - e, y)) / (2 * e)   # ' + nm[1] + ' заморожен\nnum_y = (f(x, y + e) - f(x, y - e)) / (2 * e)   # ' + nm[0] + ' заморожен\nprint(f"∂f/∂' + nm[0] + ': формула {dfdx(x, y):.6f}, численно {num_x:.6f}")\nprint(f"∂f/∂' + nm[1] + ': формула {dfdy(x, y):.6f}, численно {num_y:.6f}")\n';
    });
    build();
  });

  /* ==============================================================================
   * Шаг 8. Частные производные численно
   * ============================================================================== */
  GBC.widget('stencil', (el) => {
    const keys = ['xexp', 'bowl', 'wave', 'hill'];
    const s = { k: 'xexp', h: 1e-3, scheme: 'c' };
    const w = ui.shell(el, { foot: false, title: 'Частная производная численно', sub: 'Чтобы найти ∂f/∂x численно, сдвигаем только x: (f(x + h, y) − f(x, y))/h (вперёд) или (f(x + h, y) − f(x − h, y))/(2h) (центральная). Как у одной переменной (урок 15.5), ошибка сначала падает вместе с h, а потом растёт из-за округления.' });
    surfSelect(w.controls, keys, s.k, (v) => ((s.k = v), draw()));
    ui.slider(w.controls, { label: 'шаг h', min: 1e-12, max: 1, log: true, value: s.h, format: (v) => v.toExponential(0).replace('-', '−'), onInput: (v) => ((s.h = v), draw()) });
    ui.segmented(w.controls, { label: 'Формула', value: s.scheme, options: [{ value: 'f', label: 'вперёд' }, { value: 'c', label: 'центральная' }], onChange: (v) => ((s.scheme = v), draw()) });
    const pl = new GBC.Plot(w.main, { height: 260, x: { label: 'шаг h', type: 'log', domain: [1e-12, 1], ticks: decades(-12, 0, 2), format: powFmt }, y: { label: 'ошибка |оценка − ∂f/∂x|', type: 'log', domain: [1e-17, 1], ticks: decades(-16, 0, 2), format: powFmt } });
    const grid = cardGrid(240);
    w.main.appendChild(grid);
    const cA = card('Вычисления в точке');
    const cB = card('Цена градиента для n переменных');
    grid.append(cA.el, cB.el);
    const note = w.note('', true);
    function draw() {
      const S = SURF[s.k];
      const [x, y] = S.p0[0] === 0 && S.p0[1] === 0 ? [0.5, 0.5] : S.p0;
      const ex = grad(S, x, y)[0];
      const hs = decades(-12, 0, 0.1);
      const fw = (h) => Math.max(1e-17, Math.abs((S.f(x + h, y) - S.f(x, y)) / h - ex));
      const ce = (h) => Math.max(1e-17, Math.abs((S.f(x + h, y) - S.f(x - h, y)) / (2 * h) - ex));
      const cur = s.scheme === 'f' ? fw(s.h) : ce(s.h);
      pl.render([
        { type: 'line', x: hs, y: hs.map(fw), color: 'model', width: 2, label: 'вперёд: ошибка ~ h' },
        { type: 'line', x: hs, y: hs.map(ce), color: 'tree', width: 2, label: 'центральная: ошибка ~ h²' },
        { type: 'points', x: [s.h], y: [cur], color: s.scheme === 'f' ? 'model' : 'tree', r: 6 },
      ]);
      const h = s.h;
      const est = s.scheme === 'f' ? (S.f(x + h, y) - S.f(x, y)) / h : (S.f(x + h, y) - S.f(x - h, y)) / (2 * h);
      rowTable(cA.body, [{ key: 'k', label: 'величина' }, { key: 'v', label: 'значение' }], [
        { k: 'точка (x, y)', v: vec(x, y) },
        { k: s.scheme === 'f' ? 'f(x + h, y)' : 'f(x ± h, y)', v: s.scheme === 'f' ? U.fmt(S.f(x + h, y), 12) : U.fmt(S.f(x + h, y), 10) + ' / ' + U.fmt(S.f(x - h, y), 10) },
        { k: 'оценка', v: U.fmt(est, 12) },
        { k: '∂f/∂x по формуле', v: U.fmt(ex, 12) },
        { k: 'ошибка', v: U.fmt(Math.abs(est - ex), 2) },
      ], null, false);
      rowTable(cB.body, [{ key: 'n', label: 'переменных n' }, { key: 'f', label: 'вперёд: n + 1' }, { key: 'c', label: 'центральная: 2n' }], [
        { n: '2', f: '3', c: '4' }, { n: '100', f: '101', c: '200' }, { n: '10⁶ (нейросеть)', f: '≈ 10⁶', c: '2·10⁶' },
      ]);
      note.innerHTML = 'Для каждой переменной — свои вычисления f, а по остальным переменным ничего не меняется. Лучший шаг: около 10⁻⁸ для формулы «вперёд» и около 10⁻⁵ для центральной. Для миллиона параметров это миллионы вычислений функции на один градиент — поэтому в обучении градиент считают по формулам (аналитически) или автоматическим дифференцированием (урок 15.6), а численные разности оставляют для <b>проверки</b> формул.';
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      const [x, y] = S.p0[0] === 0 && S.p0[1] === 0 ? [0.5, 0.5] : S.p0;
      return 'import numpy as np\n\nf = lambda x, y: ' + S.py + '\nx, y = ' + py(x) + ', ' + py(y) + '\nexact = (f(x + 1e-5, y) - f(x - 1e-5, y)) / 2e-5   # эталон (или формула)\nfor h in [1e-1, 1e-2, 1e-4, 1e-6, 1e-8, 1e-10]:\n    fwd = (f(x + h, y) - f(x, y)) / h\n    cen = (f(x + h, y) - f(x - h, y)) / (2 * h)\n    print(f"h = {h:.0e}: вперёд {fwd:.10f}, центральная {cen:.10f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 9. Смешанные производные и теорема Шварца
   * ============================================================================== */
  GBC.widget('mixed-partials', (el) => {
    const keys = ['twist', 'cubed', 'xexp', 'bowl', 'saddle', 'wave'];
    const s = { k: 'twist', d: 0.5 };
    [s.x, s.y] = SURF[s.k].p0;
    const w = ui.shell(el, { foot: false, title: 'Смешанная производная: как наклон по x меняется вдоль y', sub: 'Слева — карта, справа — два среза вдоль x: при y и при y + Δ. Их наклоны в точке x — это ∂f/∂x при двух значениях y. Изменение наклона, делённое на Δ, — смешанная производная ∂²f/∂y∂x. Внизу — то же «наоборот»: изменение ∂f/∂y при сдвиге x.', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      [s.x, s.y] = SURF[v].p0;
      draw();
    });
    ui.slider(w.controls, { label: 'сдвиг Δ', min: 0.02, max: 1, step: 0.02, value: s.d, onInput: (v) => ((s.d = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const map = new GBC.Plot(box, { height: 280, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const px = new GBC.Plot(box, { height: 280, x: { label: 'x' }, y: { label: 'f' } });
    const box2 = H('div', { class: 'plots-2' });
    w.main.appendChild(box2);
    const pyP = new GBC.Plot(box2, { height: 240, x: { label: 'y' }, y: { label: 'f' } });
    const cN = card('Две смешанные производные');
    box2.appendChild(cN.el);
    const note = w.note('', true);
    function slices(P, ts, fa, fb, t0, sa, sb, la, lb) {
      const all = ts.map(fa).concat(ts.map(fb));
      const dd = (ts[ts.length - 1] - ts[0]) * 0.15;
      const za = fa(t0);
      const zb = fb(t0);
      P.render([
        { type: 'line', x: ts, y: ts.map(fa), color: 'model-prev', width: 2.2, label: la, hover: false },
        { type: 'line', x: ts, y: ts.map(fb), color: 'model', width: 2.2, label: lb, hover: false },
        { type: 'segments', x1: [t0 - dd, t0 - dd], y1: [za - dd * sa, zb - dd * sb], x2: [t0 + dd, t0 + dd], y2: [za + dd * sa, zb + dd * sb], color: 'tree', width: 2.2, opacity: 1 },
        { type: 'points', x: [t0, t0], y: [za, zb], color: 'tree', r: 5 },
      ], { y: yDom(all) });
    }
    function draw() {
      const S = SURF[s.k];
      const [x0, x1, y0, y1] = S.dom;
      const { x, y, d } = s;
      const gA = grad(S, x, y);
      const gY = grad(S, x, y + d);
      const gX = grad(S, x + d, y);
      const hh = hess(S, x, y);
      map.render([
        ...mapLayers(S),
        { type: 'segments', x1: [x0, x0], y1: [y, y + d], x2: [x1, x1], y2: [y, y + d], color: 'model', width: 1.6, dash: '6 4', opacity: 0.9 },
        { type: 'segments', x1: [x, x + d], y1: [y0, y0], x2: [x, x + d], y2: [y1, y1], color: 'violet', width: 1.2, dash: '2 4', opacity: 0.9 },
        dragPoint(s, S.dom, draw),
      ], domOf(S));
      const xs = U.linspace(x0, x1, 160);
      const ys = U.linspace(y0, y1, 160);
      slices(px, xs, (t) => S.f(t, y), (t) => S.f(t, y + d), x, gA[0], gY[0], 'f(x, y)', 'f(x, y + Δ)');
      slices(pyP, ys, (t) => S.f(x, t), (t) => S.f(x + d, t), y, gA[1], gX[1], 'f(x, y)', 'f(x + Δ, y)');
      const m1 = (gY[0] - gA[0]) / d;
      const m2 = (gX[1] - gA[1]) / d;
      rowTable(cN.body, [{ key: 'k', label: '' }, { key: 'v', label: 'значение' }], [
        { k: '∂f/∂x при y и y + Δ', v: f3(gA[0]) + ' → ' + f3(gY[0]) },
        { k: 'изменение / Δ', v: f4(m1) },
        { k: '∂f/∂y при x и x + Δ', v: f3(gA[1]) + ' → ' + f3(gX[1]) },
        { k: 'изменение / Δ', v: f4(m2) },
        { k: 'точно ∂²f/∂x∂y', v: f4(hh[1]) },
      ], null, false);
      note.innerHTML = 'Два разных опыта — «как меняется наклон по x, если сдвинуть y» и «как меняется наклон по y, если сдвинуть x» — при Δ → 0 дают одно и то же число ' + f4(hh[1]) + '. Это <b>теорема Шварца</b>: для гладких функций порядок дифференцирования не важен, ∂²f/∂x∂y = ∂²f/∂y∂x. ' + (S.key === 'twist' ? 'Для xy: ∂f/∂x = y — наклон по x растёт ровно на Δ при сдвиге y на Δ, поэтому смешанная производная равна 1 везде: поверхность «закручена».' : S.key === 'bowl' || S.key === 'saddle' ? 'Здесь переменные не взаимодействуют: наклон по x от y не зависит, смешанная производная — ноль. Касательные на правом графике параллельны.' : '');
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      return 'import numpy as np\n\nf = lambda x, y: ' + S.py + '\nx, y, h = ' + py(s.x) + ', ' + py(s.y) + ', 1e-3\n# смешанная разность: одна и та же формула для ∂²f/∂x∂y и ∂²f/∂y∂x\nfxy = (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h)\nfxx = (f(x + h, y) - 2 * f(x, y) + f(x - h, y)) / h**2\nfyy = (f(x, y + h) - 2 * f(x, y) + f(x, y - h)) / h**2\nprint("гессиан ≈", np.round([[fxx, fxy], [fxy, fyy]], 5))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 10. Касательная плоскость и дифференцируемость
   * ============================================================================== */
  GBC.widget('tangent-plane', (el) => {
    const keys = ['bowl', 'hill', 'wave', 'ecos', 'valley', 'cone'];
    const s = { k: 'hill', r: 1.2 };
    [s.x, s.y] = SURF[s.k].p0;
    const w = ui.shell(el, { title: 'Касательная плоскость: вблизи поверхность — почти плоскость', sub: 'Оранжевая плоскость z = f(a) + ∂f/∂x·Δx + ∂f/∂y·Δy касается поверхности в точке. Уменьшайте окно ρ — поверхность всё сильнее похожа на плоскость. Внизу — наибольшее отклонение от плоскости на окружности радиуса ρ.', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      [s.x, s.y] = v === 'cone' ? [0, 0] : SURF[v].p0;
      draw();
    });
    ui.slider(w.controls, { label: 'окно ρ (масштаб)', min: 0.02, max: 1.5, log: true, value: s.r, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.r = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const s3 = new Surface3D(box, { height: 300, el: 0.42 });
    const map = new GBC.Plot(box, { height: 300, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const pe = new GBC.Plot(w.main, { height: 220, x: { label: 'радиус ρ', type: 'log', domain: [0.01, 1.5], ticks: [0.01, 0.03, 0.1, 0.3, 1], format: powFmt }, y: { label: 'max |f − плоскость|', type: 'log', domain: [1e-6, 10], ticks: decades(-6, 1), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'точка a' }, { key: 'pl', label: 'плоскость' }, { key: 'e', label: 'отклонение при ρ' }]);
    function draw() {
      const S = SURF[s.k];
      const { x, y, r } = s;
      const z = S.f(x, y);
      let [gx, gy] = grad(S, x, y);
      const smooth = Number.isFinite(gx) && Number.isFinite(gy);
      if (!smooth) [gx, gy] = [0, 0];
      const T = (u, v) => z + gx * (u - x) + gy * (v - y);
      const errAt = (rho) => {
        let m = 0;
        for (let i = 0; i < 64; i++) {
          const a = (2 * Math.PI * i) / 64;
          const u = x + rho * Math.cos(a);
          const v = y + rho * Math.sin(a);
          m = Math.max(m, Math.abs(S.f(u, v) - T(u, v)));
        }
        return m;
      };
      const dom = [x - r, x + r, y - r, y + r];
      const vals = [];
      for (const u of U.linspace(dom[0], dom[1], 9)) for (const v of U.linspace(dom[2], dom[3], 9)) vals.push(S.f(u, v), T(u, v));
      const [lo, hi] = U.extent(vals.filter(Number.isFinite));
      const [r0, r1] = heightRange(S);
      s3.render({
        f: S.f, dom, z: [lo, hi > lo ? hi : lo + 1e-9], colorFn: rangeColor(r0, r1), n: 28,
        planes: [{ f: T, color: 'tree', alpha: 0.42, n: 28 }],
        points: [{ x, y, z, color: 'tree', r: 5.5 }],
      });
      map.render([
        ...mapLayers(S),
        { type: 'rect', x0: dom[0], x1: dom[1], y0: dom[2], y1: dom[3], stroke: 'tree', width: 1.6, opacity: 0.08, fill: 'tree' },
        dragPoint(s, S.dom, draw),
      ], domOf(S));
      const rs = decades(-2, Math.log10(1.5), 0.05);
      const es = rs.map(errAt).map((e) => Math.max(e, 1e-12));
      const e1 = errAt(r);
      const ref = rs.map((t) => 0.25 * es[0] * (t / rs[0]) ** (smooth ? 2 : 1));
      pe.render([
        { type: 'line', x: rs, y: ref, color: 'muted', width: 1.4, dash: '5 4', label: smooth ? 'наклон 2: ошибка ~ ρ²' : 'наклон 1: ошибка ~ ρ' },
        { type: 'line', x: rs, y: es, color: 'tree', width: 2.4, label: 'отклонение от плоскости' },
        { type: 'points', x: [r], y: [Math.max(e1, 1e-12)], color: 'tree', r: 6 },
      ]);
      st.set('p', vec(x, y));
      st.set('pl', smooth ? 'z = ' + f3(z) + (gx >= 0 ? ' + ' : ' − ') + f3(Math.abs(gx)) + 'Δx' + (gy >= 0 ? ' + ' : ' − ') + f3(Math.abs(gy)) + 'Δy' : 'нет');
      st.set('e', U.fmt(e1, 3));
      note.innerHTML = smooth
        ? 'На лог-лог шкале отклонение идёт параллельно пунктиру с наклоном 2: уменьшили окно в 10 раз — отклонение упало в 100 раз. Это и есть <b>дифференцируемость</b>: Δf = f<sub>x</sub>Δx + f<sub>y</sub>Δy + o(ρ), ошибка исчезает быстрее самого сдвига. Именно поэтому градиентный спуск работает: при маленьком шаге поверхность ведёт себя как плоскость.'
        : '<b>В острие конуса касательной плоскости нет.</b> Лучшее, что можно взять, — горизонтальная плоскость z = 0, но отклонение от неё равно ρ (наклон 1 на лог-лог шкале): при любом увеличении конус остаётся конусом. Функция непрерывна, но не дифференцируема — как |x| в одной переменной.';
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      return 'import numpy as np\n\nf = lambda x, y: ' + S.py + '\na = np.array([' + py(s.x) + ', ' + py(s.y) + '])\ne = 1e-6\ng = np.array([(f(a[0] + e, a[1]) - f(a[0] - e, a[1])) / (2 * e),\n              (f(a[0], a[1] + e) - f(a[0], a[1] - e)) / (2 * e)])\nprint("f(a) =", f(*a), " ∇f(a) =", g.round(6))\nfor rho in [1, 0.1, 0.01, 0.001]:\n    ang = np.linspace(0, 2 * np.pi, 64, endpoint=False)\n    P = a + rho * np.c_[np.cos(ang), np.sin(ang)]\n    err = np.abs(f(P[:, 0], P[:, 1]) - (f(*a) + (P - a) @ g)).max()\n    print(f"ρ = {rho:<6} max |f − плоскость| = {err:.3e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 11. Векторы: длина, скалярное произведение, проекция
   * ============================================================================== */
  GBC.widget('vectors', (el) => {
    const s = { u: { x: 2, y: 1 }, v: { x: 1, y: 3 }, unit: false };
    const w = ui.shell(el, { title: 'Векторы и скалярное произведение', sub: 'Тяните концы стрелок u (оранжевая) и v (синяя). Скалярное произведение u·v = uₓvₓ + u_yv_y = |u|·|v|·cos α. Фиолетовым показана проекция v на направление u.' });
    ui.toggle(w.controls, { label: 'Сделать u единичным (|u| = 1)', checked: false, onChange: (v) => ((s.unit = v), draw()) });
    const bx = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
    w.controls.appendChild(bx);
    const preset = (u, v) => () => ((s.u = { x: u[0], y: u[1] }), (s.v = { x: v[0], y: v[1] }), draw());
    ui.button(bx, { label: 'угол 45°', small: true, onClick: preset([2, 1], [1, 3]) });
    ui.button(bx, { label: 'перпендикуляр', small: true, onClick: preset([2, 1], [-1, 2]) });
    ui.button(bx, { label: 'тупой угол', small: true, onClick: preset([2, 1], [-2, 0.5]) });
    const pl = new GBC.Plot(w.main, { height: 330, equal: true, x: { label: 'x', domain: [-4, 4] }, y: { label: 'y', domain: [-3.5, 3.5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'u', label: 'u' }, { key: 'v', label: 'v' }, { key: 'len', label: '|u|, |v|' }, { key: 'dot', label: 'u · v' }, { key: 'ang', label: 'угол α' }, { key: 'pr', label: 'проекция v на u' }]);
    function draw() {
      let { x: ux, y: uy } = s.u;
      const nu = Math.hypot(ux, uy) || 1;
      if (s.unit) {
        ux /= nu;
        uy /= nu;
      }
      const { x: vx, y: vy } = s.v;
      const dot = ux * vx + uy * vy;
      const lu = Math.hypot(ux, uy);
      const lv = Math.hypot(vx, vy);
      const cos = dot / (lu * lv || 1);
      const ang = (Math.acos(U.clamp(cos, -1, 1)) * 180) / Math.PI;
      const k = dot / (lu * lu || 1);
      const prx = k * ux;
      const pry = k * uy;
      pl.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'vline', x: 0, color: 'axis', width: 1 },
        { type: 'segments', x1: [-6 * ux / lu], y1: [-6 * uy / lu], x2: [6 * ux / lu], y2: [6 * uy / lu], color: 'tree', width: 1, dash: '3 5', opacity: 0.5 },
        { type: 'segments', x1: [vx], y1: [vy], x2: [prx], y2: [pry], color: 'violet', width: 1.4, dash: '5 4', opacity: 0.9 },
        { type: 'arrows', x1: [0], y1: [0], x2: [prx], y2: [pry], color: 'violet', width: 4, opacity: 0.55 },
        { type: 'arrows', x1: [0, 0], y1: [0, 0], x2: [ux, vx], y2: [uy, vy], color: (i) => (i === 0 ? 'tree' : 'model'), width: 2.6 },
        { type: 'text', items: [{ x: ux, y: uy, dx: 8, dy: -6, text: 'u', bold: true }, { x: vx, y: vy, dx: 8, dy: -6, text: 'v', bold: true }] },
        { type: 'points', x: [s.u.x], y: [s.u.y], color: 'tree', r: 6, draggable: true, onDrag: (i, nx, ny) => ((s.u = { x: snap(U.clamp(nx, -4, 4), 0.1), y: snap(U.clamp(ny, -3.5, 3.5), 0.1) }), draw()) },
        { type: 'points', x: [vx], y: [vy], color: 'model', r: 6, draggable: true, onDrag: (i, nx, ny) => ((s.v = { x: snap(U.clamp(nx, -4, 4), 0.1), y: snap(U.clamp(ny, -3.5, 3.5), 0.1) }), draw()) },
      ], { x: [-4, 4], y: [-3.5, 3.5] });
      st.set('u', vec(ux, uy));
      st.set('v', vec(vx, vy));
      st.set('len', f3(lu) + ', ' + f3(lv));
      st.set('dot', f3(dot));
      st.set('ang', U.fmt(ang, 1) + '°');
      st.set('pr', f3(dot / (lu || 1)));
      note.innerHTML = (Math.abs(cos) < 0.01 ? '<b>Векторы перпендикулярны</b>: u·v = 0, проекция — ноль. ' : cos > 0 ? '<b>Острый угол</b>: u·v > 0, проекция v смотрит туда же, куда u. ' : '<b>Тупой угол</b>: u·v < 0, проекция v направлена против u. ') + 'Если |u| = 1, скалярное произведение u·v — это просто длина проекции v на направление u (со знаком). Именно так устроена производная по направлению: D_u f = ∇f · u — проекция градиента на направление движения.';
    }
    w.pythonAction(() => 'import numpy as np\n\nu = np.array([' + py(s.u.x) + ', ' + py(s.u.y) + '])\nv = np.array([' + py(s.v.x) + ', ' + py(s.v.y) + '])\ndot = u @ v                                   # uₓvₓ + u_yv_y\ncos = dot / (np.linalg.norm(u) * np.linalg.norm(v))\nprint("u·v =", dot, " |u| =", np.linalg.norm(u).round(4), " |v| =", np.linalg.norm(v).round(4))\nprint("угол =", np.degrees(np.arccos(cos)).round(2), "°")\nprint("проекция v на u:", (dot / np.linalg.norm(u)).round(4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 12. Поле градиентов
   * ============================================================================== */
  GBC.widget('gradient-field', (el) => {
    const keys = ['bowl', 'round', 'hill', 'saddle', 'plane', 'pits', 'wave', 'valley'];
    const s = { k: 'bowl', anti: false, unit: true };
    [s.x, s.y] = SURF[s.k].p0;
    const w = ui.shell(el, { title: 'Градиент — стрелка в каждой точке', sub: 'В каждой точке карты нарисован градиент ∇f = (∂f/∂x, ∂f/∂y) — вектор, а все вместе они образуют поле. Большая стрелка — градиент в оранжевой точке; тонкая оранжевая линия — линия уровня через неё.' });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      [s.x, s.y] = SURF[v].p0;
      draw();
    });
    ui.segmented(w.controls, { label: 'Стрелки поля', value: 'g', options: [{ value: 'g', label: '∇f (вверх)' }, { value: 'a', label: '−∇f (вниз)' }], onChange: (v) => ((s.anti = v === 'a'), draw()) });
    ui.toggle(w.controls, { label: 'Стрелки одной длины (только направление)', checked: true, onChange: (v) => ((s.unit = v), draw()) });
    const map = new GBC.Plot(w.main, { height: 380, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'точка' }, { key: 'g', label: '∇f' }, { key: 'n', label: '|∇f|' }, { key: 'a', label: 'направление ∇f' }]);
    function draw() {
      const S = SURF[s.k];
      const [x0, x1, y0, y1] = S.dom;
      const span = Math.min(x1 - x0, y1 - y0);
      const fx = [];
      const fy = [];
      const tx = [];
      const ty = [];
      let maxN = 0;
      const pts = [];
      for (const a of U.linspace(x0 + 0.06 * (x1 - x0), x1 - 0.06 * (x1 - x0), 13)) for (const b of U.linspace(y0 + 0.06 * (y1 - y0), y1 - 0.06 * (y1 - y0), 11)) {
        const g = grad(S, a, b);
        const nn = Math.hypot(g[0], g[1]);
        if (Number.isFinite(nn)) {
          pts.push([a, b, g, nn]);
          maxN = Math.max(maxN, nn);
        }
      }
      const sgn = s.anti ? -1 : 1;
      for (const [a, b, g, nn] of pts) {
        if (nn < 1e-9) continue;
        const len = s.unit ? span * 0.05 : (span * 0.075 * nn) / (maxN || 1);
        fx.push(a);
        fy.push(b);
        tx.push(a + (sgn * len * g[0]) / nn);
        ty.push(b + (sgn * len * g[1]) / nn);
      }
      const { x, y } = s;
      const [gx, gy] = grad(S, x, y);
      const n = Math.hypot(gx, gy);
      const L = span * 0.2;
      const grid = gridOf(S, S.dom, 120);
      map.render([
        ...mapLayers(S),
        { type: 'arrows', x1: fx, y1: fy, x2: tx, y2: ty, color: 'model', width: 1.2, opacity: 0.6 },
        { type: 'contour', grid, level: S.f(x, y), color: 'tree', width: 1.2 },
        { type: 'arrows', x1: n > 1e-9 ? [x] : [], y1: n > 1e-9 ? [y] : [], x2: [x + (L * gx) / (n || 1)], y2: [y + (L * gy) / (n || 1)], color: 'tree', width: 3 },
        dragPoint(s, S.dom, draw),
      ], domOf(S));
      st.set('p', vec(x, y));
      st.set('g', vec(gx, gy));
      st.set('n', f3(n));
      st.set('a', n > 1e-9 ? U.fmt(((Math.atan2(gy, gx) * 180) / Math.PI + 360) % 360, 1) + '°' : '—');
      note.innerHTML = (s.anti ? 'Стрелки −∇f показывают, куда <b>стекает вода</b>: к дну ям. ' : 'Стрелки ∇f смотрят <b>вверх по склону</b> — от низин к вершинам. ') + 'Обратите внимание: каждая стрелка пересекает линии уровня под прямым углом (шаг 14). ' + (s.unit ? 'Включите разную длину — стрелки станут длиннее там, где склон круче (где линии уровня гуще).' : 'Длина стрелки пропорциональна |∇f| — крутизне склона.') + (n < 1e-9 ? ' <b>В этой точке ∇f = 0</b> — склона нет: это критическая точка (шаг 18).' : '');
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      const [x0, x1, y0, y1] = S.dom;
      return 'import numpy as np\nimport matplotlib.pyplot as plt\n\nf = lambda x, y: ' + S.py + '\n\nX, Y = np.meshgrid(np.linspace(' + py(x0) + ', ' + py(x1) + ', 200), np.linspace(' + py(y0) + ', ' + py(y1) + ', 200))\nQX, QY = np.meshgrid(np.linspace(' + py(x0) + ', ' + py(x1) + ', 15), np.linspace(' + py(y0) + ', ' + py(y1) + ', 13))\ne = 1e-6\nGX = (f(QX + e, QY) - f(QX - e, QY)) / (2 * e)\nGY = (f(QX, QY + e) - f(QX, QY - e)) / (2 * e)\nN = np.hypot(GX, GY) + 1e-12\nplt.contour(X, Y, f(X, Y), levels=10, colors="gray", linewidths=0.8)\nplt.quiver(QX, QY, GX / N, GY / N, color="tab:blue", alpha=0.7)\nplt.gca().set_aspect("equal")\nplt.title("Поле направлений градиента")\nplt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 13. Производная по направлению
   * ============================================================================== */
  GBC.widget('directional', (el) => {
    const keys = ['bowl', 'hill', 'saddle', 'plane', 'valley', 'wave'];
    const s = { k: 'bowl', ang: 53 };
    [s.x, s.y] = SURF[s.k].p0;
    const w = ui.shell(el, { title: 'Производная по направлению', sub: 'Выберите направление u (серая стрелка). Справа — профиль рельефа вдоль прямой через точку в этом направлении: его наклон в точке и есть производная по направлению D_u f. Внизу — D_u f для всех направлений сразу.', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      [s.x, s.y] = SURF[v].p0;
      draw();
    });
    const angS = ui.slider(w.controls, { label: 'направление u, градусы', min: 0, max: 359, step: 1, value: s.ang, format: (v) => v + '°', onInput: (v) => ((s.ang = v), draw()) });
    const bx = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end' });
    w.controls.appendChild(bx);
    const aim = (off) => () => {
      const S = SURF[s.k];
      const [gx, gy] = grad(S, s.x, s.y);
      s.ang = Math.round((((Math.atan2(gy, gx) * 180) / Math.PI + off) % 360 + 360) % 360);
      angS.set(s.ang);
      draw();
    };
    ui.button(bx, { label: 'вдоль ∇f', small: true, onClick: aim(0) });
    ui.button(bx, { label: 'против ∇f', small: true, onClick: aim(180) });
    ui.button(bx, { label: 'поперёк', small: true, onClick: aim(90) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const map = new GBC.Plot(box, { height: 300, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const prof = new GBC.Plot(box, { height: 300, x: { label: 'шаг t вдоль u' }, y: { label: 'f(точка + t·u)' } });
    const dirp = new GBC.Plot(w.main, { height: 210, x: { label: 'направление u, градусы', domain: [0, 360], ticks: [0, 90, 180, 270, 360] }, y: { label: 'D_u f = ∇f · u' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: '∇f' }, { key: 'n', label: '|∇f|' }, { key: 'u', label: 'u' }, { key: 'al', label: 'угол между u и ∇f' }, { key: 'du', label: 'D_u f' }]);
    function draw() {
      const S = SURF[s.k];
      const [x0, x1, y0, y1] = S.dom;
      const { x, y } = s;
      const [gx, gy] = grad(S, x, y);
      const n = Math.hypot(gx, gy);
      const rad = (s.ang * Math.PI) / 180;
      const ux = Math.cos(rad);
      const uy = Math.sin(rad);
      const du = gx * ux + gy * uy;
      const span = Math.min(x1 - x0, y1 - y0);
      const L = span * 0.2;
      const T = span * 0.45;
      map.render([
        ...mapLayers(S),
        { type: 'segments', x1: [x - T * ux], y1: [y - T * uy], x2: [x + T * ux], y2: [y + T * uy], color: 'ink2', width: 1.4, dash: '6 4', opacity: 0.9 },
        { type: 'arrows', x1: n > 1e-9 ? [x] : [], y1: n > 1e-9 ? [y] : [], x2: [x + (L * gx) / (n || 1)], y2: [y + (L * gy) / (n || 1)], color: 'tree', width: 3 },
        { type: 'arrows', x1: [x], y1: [y], x2: [x + L * ux], y2: [y + L * uy], color: 'ink2', width: 2.2 },
        dragPoint(s, S.dom, draw),
      ], domOf(S));
      const ts = U.linspace(-T, T, 201);
      const z = S.f(x, y);
      const vals = ts.map((t) => S.f(x + t * ux, y + t * uy));
      const dd = T * 0.4;
      prof.render([
        { type: 'line', x: ts, y: vals, color: 'model', width: 2.4, hover: false },
        { type: 'segments', x1: [-dd], y1: [z - dd * du], x2: [dd], y2: [z + dd * du], color: 'tree', width: 2.4, opacity: 1 },
        { type: 'points', x: [0], y: [z], color: 'tree', r: 6 },
      ], { y: yDom(vals) });
      const angs = U.range(361);
      const gAng = ((Math.atan2(gy, gx) * 180) / Math.PI + 360) % 360;
      dirp.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: angs, y: angs.map((a) => gx * Math.cos((a * Math.PI) / 180) + gy * Math.sin((a * Math.PI) / 180)), color: 'model', width: 2.2, hover: false },
        { type: 'vline', x: gAng, color: 'tree', dash: '5 4', text: 'вдоль ∇f: +|∇f|' },
        { type: 'points', x: [s.ang], y: [du], color: 'ink', r: 6 },
      ]);
      const alpha = n > 1e-9 ? (Math.acos(U.clamp(du / n, -1, 1)) * 180) / Math.PI : NaN;
      st.set('g', vec(gx, gy));
      st.set('n', f3(n));
      st.set('u', vec(ux, uy, 3));
      st.set('al', Number.isFinite(alpha) ? U.fmt(alpha, 1) + '°' : '—');
      st.set('du', f3(du));
      note.innerHTML = 'D_u f = ∇f · u = |∇f|·cos α = ' + f3(n) + ' · cos ' + (Number.isFinite(alpha) ? U.fmt(alpha, 1) : '—') + '° = ' + f3(du) + '. ' + (alpha < 3 ? '<b>Вдоль градиента</b> рост самый быстрый: D_u f = |∇f|.' : alpha > 177 ? '<b>Против градиента</b> — самый быстрый спуск: D_u f = −|∇f|. Туда шагает градиентный спуск.' : Math.abs(alpha - 90) < 3 ? '<b>Поперёк градиента</b> — вдоль линии уровня: профиль в точке горизонтален, D_u f = 0.' : 'Синусоида внизу — скорость роста в каждом направлении: максимум |∇f| — вдоль градиента, минимум −|∇f| — против, нули — поперёк.');
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      return 'import numpy as np\n\nf = lambda x, y: ' + S.py + '\np = np.array([' + py(s.x) + ', ' + py(s.y) + '])\ne = 1e-6\ng = np.array([(f(p[0] + e, p[1]) - f(p[0] - e, p[1])) / (2 * e), (f(p[0], p[1] + e) - f(p[0], p[1] - e)) / (2 * e)])\nfor deg in [0, 45, 90, ' + s.ang + ', np.degrees(np.arctan2(g[1], g[0]))]:\n    u = np.array([np.cos(np.radians(deg)), np.sin(np.radians(deg))])   # единичный вектор\n    t = 1e-6\n    by_limit = (f(*(p + t * u)) - f(*p)) / t                      # по определению\n    print(f"угол {deg:6.1f}°: ∇f·u = {g @ u:+.5f}, предел = {by_limit:+.5f}")\nprint("|∇f| =", np.linalg.norm(g).round(5), "— наибольшая скорость роста")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 14. Градиент перпендикулярен линии уровня (увеличение)
   * ============================================================================== */
  GBC.widget('level-zoom', (el) => {
    const keys = ['bowl', 'hill', 'valley', 'pits', 'wave', 'cubic'];
    const s = { k: 'bowl', z: 4 };
    [s.x, s.y] = SURF[s.k].p0;
    const w = ui.shell(el, { title: 'Под лупой: линия уровня — прямая, перпендикулярная градиенту', sub: 'Слева — вся карта, рамка — область под лупой. Справа — увеличение: линия уровня через точку (оранжевая), градиент (синяя стрелка) и касательная (пунктир). При сильном увеличении линия уровня неотличима от прямой, и угол с градиентом — 90°.', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      [s.x, s.y] = SURF[v].p0;
      draw();
    });
    ui.slider(w.controls, { label: 'увеличение', min: 1, max: 256, log: true, value: s.z, format: (v) => '×' + U.fmt(v, 3), onInput: (v) => ((s.z = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const map = new GBC.Plot(box, { height: 300, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const zm = new GBC.Plot(box, { height: 300, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ang', label: 'угол хорды с ∇f' }, { key: 'g', label: '|∇f|' }, { key: 'dist', label: 'до соседнего уровня: Δc/|∇f|' }, { key: 'real', label: 'на самом деле' }]);
    function draw() {
      const S = SURF[s.k];
      const [x0, x1, y0, y1] = S.dom;
      const { x, y } = s;
      const half = Math.min(x1 - x0, y1 - y0) / 2 / s.z;
      const dom = [x - half, x + half, y - half, y + half];
      const c = S.f(x, y);
      const [gx, gy] = grad(S, x, y);
      const n = Math.hypot(gx, gy);
      // хорда линии уровня на окружности радиуса ρ: два ближайших к касательной пересечения
      const rho = half * 0.6;
      const N = 1440;
      const vals = U.range(N + 1).map((i) => S.f(x + rho * Math.cos((2 * Math.PI * i) / N), y + rho * Math.sin((2 * Math.PI * i) / N)) - c);
      const cross = [];
      for (let i = 1; i <= N; i++) if (vals[i - 1] === 0 || vals[i - 1] * vals[i] < 0) cross.push((2 * Math.PI * (i - 0.5)) / N);
      const tAng = Math.atan2(gx, -gy);
      const near = (t) => Math.min(...cross.map((a) => Math.abs(((a - t + 3 * Math.PI) % (2 * Math.PI)) - Math.PI)));
      let chord = null;
      if (cross.length >= 2 && n > 1e-9) {
        const pick = (t) => cross.reduce((b, a) => (Math.abs(((a - t + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < Math.abs(((b - t + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) ? a : b));
        const a1 = pick(tAng);
        const a2 = pick(tAng + Math.PI);
        if (a1 !== a2 && near(tAng) < 1) chord = [[x + rho * Math.cos(a1), y + rho * Math.sin(a1)], [x + rho * Math.cos(a2), y + rho * Math.sin(a2)]];
      }
      let ang = NaN;
      if (chord) {
        const cx = chord[1][0] - chord[0][0];
        const cy = chord[1][1] - chord[0][1];
        ang = (Math.acos(Math.abs(cx * gx + cy * gy) / (Math.hypot(cx, cy) * n)) * 180) / Math.PI;
      }
      const lv = levelsOf(S);
      const step = lv.length > 1 ? lv[1] - lv[0] : 1;
      let real = NaN;
      if (n > 1e-9) {
        const ux = gx / n;
        const uy = gy / n;
        let lo = 0;
        let hi = 0;
        const target = c + step;
        for (let t = step / n / 20; t < 10; t *= 1.3) if (S.f(x + t * ux, y + t * uy) >= target) { hi = t; break; } else lo = t;
        if (hi > 0) {
          for (let k = 0; k < 60; k++) {
            const m = (lo + hi) / 2;
            if (S.f(x + m * ux, y + m * uy) >= target) hi = m;
            else lo = m;
          }
          real = (lo + hi) / 2;
        }
      }
      map.render([
        ...mapLayers(S),
        { type: 'rect', x0: dom[0], x1: dom[1], y0: dom[2], y1: dom[3], stroke: 'tree', width: 1.6, fill: 'tree', opacity: 0.1 },
        dragPoint(s, S.dom, draw),
      ], domOf(S));
      const L = half * 0.55;
      const zgrid = GBC.Plot.grid(S.f, dom[0], dom[1], dom[2], dom[3], 80, 80);
      zm.render([
        { type: 'heatmap', grid: zgrid, colorFn: heightColor(S), opacity: 0.45 },
        { type: 'contour', grid: zgrid, level: c, color: 'tree', width: 2.6 },
        { type: 'segments', x1: n > 1e-9 ? [x + (L * gy) / n] : [], y1: n > 1e-9 ? [y - (L * gx) / n] : [], x2: [x - (L * gy) / (n || 1)], y2: [y + (L * gx) / (n || 1)], color: 'ink', width: 1.4, dash: '6 4', opacity: 0.9 },
        { type: 'segments', x1: chord ? [chord[0][0]] : [], y1: chord ? [chord[0][1]] : [], x2: chord ? [chord[1][0]] : [], y2: chord ? [chord[1][1]] : [], color: 'violet', width: 2, opacity: 1 },
        { type: 'arrows', x1: n > 1e-9 ? [x] : [], y1: n > 1e-9 ? [y] : [], x2: [x + (L * gx) / (n || 1)], y2: [y + (L * gy) / (n || 1)], color: 'model', width: 3 },
        { type: 'points', x: [x], y: [y], color: 'tree', r: 6 },
      ], domOf(S, dom));
      st.set('ang', Number.isFinite(ang) ? U.fmt(ang, 3) + '°' : '—');
      st.set('g', f3(n));
      st.set('dist', n > 1e-9 ? f4(step / n) : '∞');
      st.set('real', Number.isFinite(real) ? f4(real) : '—');
      note.innerHTML = 'Фиолетовая хорда соединяет две точки линии уровня на окружности радиуса ρ = ' + U.fmt(rho, 3) + ' вокруг точки. Её угол с градиентом стремится к 90° при увеличении. Причина: вдоль линии уровня f не меняется, значит, D_u f = ∇f·u = 0 — а это и есть перпендикулярность. Второе следствие — <b>густота линий</b>: соседний уровень (шаг Δc = ' + U.fmt(step, 3) + ') лежит на расстоянии примерно Δc/|∇f| вдоль градиента. Сравните с точным расстоянием справа внизу.';
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      return 'import numpy as np\n\nf = lambda x, y: ' + S.py + '\np = np.array([' + py(s.x) + ', ' + py(s.y) + '])\ne = 1e-6\ng = np.array([(f(p[0] + e, p[1]) - f(p[0] - e, p[1])) / (2 * e), (f(p[0], p[1] + e) - f(p[0], p[1] - e)) / (2 * e)])\nfor rho in [0.5, 0.1, 0.01, 0.001]:\n    a = np.linspace(0, 2 * np.pi, 20001)\n    v = f(p[0] + rho * np.cos(a), p[1] + rho * np.sin(a)) - f(*p)\n    idx = np.where(np.sign(v[:-1]) != np.sign(v[1:]))[0]      # пересечения с линией уровня\n    q = p + rho * np.c_[np.cos(a[idx]), np.sin(a[idx])]\n    chord = q[1] - q[0]\n    ang = np.degrees(np.arccos(abs(chord @ g) / (np.linalg.norm(chord) * np.linalg.norm(g))))\n    print(f"ρ = {rho:<6} угол хорды с ∇f = {ang:.4f}°")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 16. Цепное правило вдоль пути
   * ============================================================================== */
  const PATHS = {
    circle: { label: 'окружность радиуса 1', r: (t) => [Math.cos(t), Math.sin(t)], v: (t) => [-Math.sin(t), Math.cos(t)], py: ['np.cos(t)', 'np.sin(t)'] },
    ellipse: { label: 'эллипс 1.5 × 0.8', r: (t) => [1.5 * Math.cos(t), 0.8 * Math.sin(t)], v: (t) => [-1.5 * Math.sin(t), 0.8 * Math.cos(t)], py: ['1.5 * np.cos(t)', '0.8 * np.sin(t)'] },
    line: { label: 'прямая от (−1.8, −1.2) до (1.8, 1.2)', r: (t) => [-1.8 + (3.6 * t) / (2 * Math.PI), -1.2 + (2.4 * t) / (2 * Math.PI)], v: () => [3.6 / (2 * Math.PI), 2.4 / (2 * Math.PI)], py: ['-1.8 + 3.6 * t / (2 * np.pi)', '-1.2 + 2.4 * t / (2 * np.pi)'] },
    eight: { label: 'восьмёрка', r: (t) => [1.5 * Math.sin(t), 0.9 * Math.sin(2 * t)], v: (t) => [1.5 * Math.cos(t), 1.8 * Math.cos(2 * t)], py: ['1.5 * np.sin(t)', '0.9 * np.sin(2 * t)'] },
  };
  GBC.widget('chain-path', (el) => {
    const keys = ['bowl', 'hill', 'saddle', 'twist'];
    const s = { k: 'bowl', p: 'circle', i: 15 };
    const NT = 120;
    const w = ui.shell(el, { title: 'Цепное правило: высота при движении по пути', sub: 'Точка движется по пути r(t) = (x(t), y(t)). Высота h(t) = f(x(t), y(t)) — функция одной переменной. Её скорость складывается из двух вкладов: «склон по x × скорость по x» и «склон по y × скорость по y».', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => ((s.k = v), draw()));
    ui.select(w.controls, { label: 'Путь', value: s.p, options: Object.entries(PATHS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.p = v), draw()) });
    ui.player(w.controls, { label: 'Время t', min: 0, max: NT, value: s.i, fps: 12, format: (v) => 't = ' + U.fmt((2 * Math.PI * v) / NT, 2), onChange: (v) => ((s.i = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const map = new GBC.Plot(box, { height: 290, equal: true, x: { label: 'x', domain: [-2, 2] }, y: { label: 'y', domain: [-2, 2] }, grid: 'none' });
    const ph = new GBC.Plot(box, { height: 290, x: { label: 't', domain: [0, 2 * Math.PI], ticks: [0, Math.PI / 2, Math.PI, 1.5 * Math.PI, 2 * Math.PI], format: (v) => ({ 0: '0', 1: 'π/2', 2: 'π', 3: '3π/2', 4: '2π' }[Math.round(v / (Math.PI / 2))]) }, y: { label: 'h(t) = f(r(t))' } });
    const pd = new GBC.Plot(w.main, { height: 230, x: { label: 't', domain: [0, 2 * Math.PI], ticks: [0, Math.PI / 2, Math.PI, 1.5 * Math.PI, 2 * Math.PI], format: (v) => ({ 0: '0', 1: 'π/2', 2: 'π', 3: '3π/2', 4: '2π' }[Math.round(v / (Math.PI / 2))]) }, y: { label: 'dh/dt' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'fₓ · x′' }, { key: 'b', label: 'f_y · y′' }, { key: 's', label: 'сумма = ∇f · r′' }, { key: 'n', label: 'численно (h(t+ε) − h(t−ε))/2ε' }]);
    function draw() {
      const S = SURF[s.k];
      const Pth = PATHS[s.p];
      const ts = U.linspace(0, 2 * Math.PI, 241);
      const t = (2 * Math.PI * s.i) / NT;
      const [x, y] = Pth.r(t);
      const [vx, vy] = Pth.v(t);
      const [gx, gy] = grad(S, x, y);
      const hfun = (tt) => S.f(...Pth.r(tt));
      const ca = (tt) => { const [a, b] = Pth.r(tt); return grad(S, a, b)[0] * Pth.v(tt)[0]; };
      const cb = (tt) => { const [a, b] = Pth.r(tt); return grad(S, a, b)[1] * Pth.v(tt)[1]; };
      const route = ts.map(Pth.r);
      const ng = Math.hypot(gx, gy);
      map.render([
        ...mapLayers(S, { dom: [-2, 2, -2, 2] }),
        { type: 'line', x: route.map((p) => p[0]), y: route.map((p) => p[1]), color: 'ink2', width: 1.6, hover: false },
        { type: 'arrows', x1: [x], y1: [y], x2: [x + 0.5 * vx], y2: [y + 0.5 * vy], color: 'violet', width: 2.6 },
        { type: 'arrows', x1: ng > 1e-9 ? [x] : [], y1: ng > 1e-9 ? [y] : [], x2: [x + (0.6 * gx) / (ng || 1)], y2: [y + (0.6 * gy) / (ng || 1)], color: 'tree', width: 2.6 },
        { type: 'points', x: [x], y: [y], color: 'tree', r: 6 },
      ], { x: [-2, 2], y: [-2, 2] });
      ph.render([
        { type: 'line', x: ts, y: ts.map(hfun), color: 'model', width: 2.4, hover: false },
        { type: 'vline', x: t, color: 'muted', dash: '4 4' },
        { type: 'points', x: [t], y: [hfun(t)], color: 'tree', r: 6 },
      ], { y: yDom(ts.map(hfun)) });
      pd.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: ts, y: ts.map(ca), color: 'aqua', width: 1.8, dash: '6 4', label: 'fₓ · x′' },
        { type: 'line', x: ts, y: ts.map(cb), color: 'violet', width: 1.8, dash: '6 4', label: 'f_y · y′' },
        { type: 'line', x: ts, y: ts.map((tt) => ca(tt) + cb(tt)), color: 'model', width: 2.4, label: 'dh/dt = сумма' },
        { type: 'vline', x: t, color: 'muted', dash: '4 4' },
      ], { y: yDom([...ts.map(ca), ...ts.map(cb), ...ts.map((tt) => ca(tt) + cb(tt)), 0]) });
      const a = gx * vx;
      const b = gy * vy;
      const e = 1e-5;
      st.set('a', f3(a));
      st.set('b', f3(b));
      st.set('s', f3(a + b));
      st.set('n', f3((hfun(t + e) - hfun(t - e)) / (2 * e)));
      note.innerHTML = 'Цепное правило: dh/dt = ∂f/∂x · dx/dt + ∂f/∂y · dy/dt = ∇f · r′(t). Фиолетовая стрелка — скорость r′(t), оранжевая — направление градиента. Когда они перпендикулярны, точка идёт вдоль линии уровня и высота не меняется (dh/dt = 0); когда угол острый — точка поднимается. ' + (s.k === 'bowl' && s.p === 'circle' ? 'Для x² + 3y² на единичной окружности: h(t) = 1 + 2 sin²t, dh/dt = 2 sin 2t; при t = π/4 вклады −1 и 3, сумма 2.' : '');
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      const Pth = PATHS[s.p];
      return 'import numpy as np\n\nf = lambda x, y: ' + S.py + '\nr = lambda t: (' + Pth.py[0] + ', ' + Pth.py[1] + ')\nt, e = ' + py((2 * Math.PI * s.i) / NT) + ', 1e-6\nx, y = r(t)\ndx, dy = [(a - b) / (2 * e) for a, b in zip(r(t + e), r(t - e))]       # скорость r′(t)\nfx = (f(x + e, y) - f(x - e, y)) / (2 * e)\nfy = (f(x, y + e) - f(x, y - e)) / (2 * e)\nprint("цепное правило: fx·x′ + fy·y′ =", round(fx * dx + fy * dy, 6))\nprint("напрямую: dh/dt =", round((f(*r(t + e)) - f(*r(t - e))) / (2 * e), 6))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 17. Матрица Якоби softmax и градиент перекрёстной энтропии
   * ============================================================================== */
  GBC.widget('softmax-jacobian', (el) => {
    const s = { z: [2, 1, 0], y: 0 };
    const w = ui.shell(el, { title: 'Softmax: три входа, три выхода и матрица Якоби', sub: 'Softmax превращает три логита z в три вероятности p (как сигмоида — для двух классов). Это векторная функция: её производная — таблица 3 × 3 частных производных ∂pₖ/∂zⱼ (матрица Якоби). Справа — градиент потерь −ln p_y по логитам.' });
    s.z.forEach((v, i) => ui.slider(w.controls, { label: 'логит z_' + (i + 1), min: -4, max: 4, step: 0.1, value: v, onInput: (val) => ((s.z[i] = val), draw()) }));
    ui.segmented(w.controls, { label: 'Верный класс y', value: 0, options: [{ value: 0, label: '1' }, { value: 1, label: '2' }, { value: 2, label: '3' }], onChange: (v) => ((s.y = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const pp = new GBC.Plot(box, { height: 220, x: { label: 'класс', domain: [0.4, 3.6], ticks: [1, 2, 3] }, y: { label: 'вероятность p', domain: [0, 1] } });
    const pg = new GBC.Plot(box, { height: 220, x: { label: 'логит', domain: [0.4, 3.6], ticks: [1, 2, 3] }, y: { label: '∂L/∂z = p − y', domain: [-1, 1] } });
    const jbox = H('div', { style: 'overflow-x:auto;margin-top:8px' });
    w.main.appendChild(jbox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sp', label: 'Σ p' }, { key: 'L', label: 'потери −ln p_y' }, { key: 'rs', label: 'суммы строк Якоби' }, { key: 'gs', label: 'Σ градиента' }]);
    function draw() {
      const m = Math.max(...s.z);
      const ex = s.z.map((v) => E(v - m));
      const Z = U.sum(ex);
      const p = ex.map((v) => v / Z);
      const J = p.map((pk, k) => p.map((pj, j) => (k === j ? pk * (1 - pk) : -pk * pj)));
      const g = p.map((pk, k) => pk - (k === s.y ? 1 : 0));
      pp.render([{ type: 'bars', x: [1, 2, 3], y: p, color: (i) => ['class0', 'class1', 'class2'][i], width: 0.6, maxPx: 60, tooltip: (i) => [['p', f4(p[i])]] }]);
      pg.render([{ type: 'hline', y: 0, color: 'axis' }, { type: 'bars', x: [1, 2, 3], y: g, color: (i) => (g[i] < 0 ? 'neg' : 'pos'), width: 0.6, maxPx: 60, tooltip: (i) => [['p − y', f4(g[i])]] }]);
      const div = GBC.colors.diverging();
      const t = H('table', { style: 'border-collapse:collapse;font-size:.88rem;margin:0 auto' });
      t.appendChild(H('caption', { style: 'caption-side:top;color:var(--muted);font-size:.85rem;padding-bottom:4px' }, 'Матрица Якоби ∂pₖ/∂zⱼ = pₖ(δₖⱼ − pⱼ): строка — выход pₖ, столбец — вход zⱼ'));
      const hr = H('tr', null, H('th'));
      for (let j = 0; j < 3; j++) hr.appendChild(H('th', { style: 'padding:4px 8px;color:var(--muted);font-weight:600' }, 'z' + (j + 1)));
      t.appendChild(hr);
      J.forEach((row, k) => {
        const tr = H('tr', null, H('th', { style: 'padding:4px 8px;color:var(--muted);font-weight:600' }, 'p' + (k + 1)));
        row.forEach((v) => tr.appendChild(heatCell(f4(v), div(v / 0.25))));
        t.appendChild(tr);
      });
      jbox.replaceChildren(t);
      st.set('sp', f4(U.sum(p)));
      st.set('L', f4(-Math.log(p[s.y])));
      const z0 = (v) => (Math.abs(v) < 1e-12 ? 0 : v);
      st.set('rs', J.map((r) => U.fmt(z0(U.sum(r)), 3)).join(', '));
      st.set('gs', U.fmt(z0(U.sum(g)), 3));
      note.innerHTML = 'Диагональ положительна: свой логит поднимает свою вероятность (pₖ(1 − pₖ), как у сигмоиды). Вне диагонали — минус: поднимая один логит, мы отнимаем вероятность у остальных. Суммы строк равны нулю — вероятности всегда в сумме 1. Градиент потерь по логитам удивительно прост: <b>p − y</b> (y — «один-горячий» вектор класса). Его минус — псевдо-остатки многоклассового бустинга: по одному дереву на класс за раунд (урок 6.3).';
    }
    w.pythonAction(() => 'import numpy as np\n\nz = np.array([' + s.z.map(py).join(', ') + '])\ny = ' + s.y + '                                   # верный класс (с нуля)\np = np.exp(z - z.max()); p /= p.sum()          # softmax\nJ = np.diag(p) - np.outer(p, p)                # матрица Якоби ∂p_k/∂z_j\nprint("p =", p.round(4))\nprint("Якоби:\\n", J.round(4), "\\nсуммы строк:", J.sum(1).round(12))\ng = p - np.eye(3)[y]                           # градиент −ln p_y по логитам\nprint("∂L/∂z = p − y =", g.round(4))\n# проверка численно\ne = 1e-6\nL = lambda z: -np.log(np.exp(z[y] - z.max()) / np.exp(z - z.max()).sum())\nprint("численно:", np.array([(L(z + e * np.eye(3)[j]) - L(z - e * np.eye(3)[j])) / (2 * e) for j in range(3)]).round(4))\n');
    draw();
  });

  GBC.lesson158 = {
    SURF, grad, hess, gradNum, hessNum, gridOf, heightRange, levelsOf, rangeColor, heightColor, mapLayers, domOf, snap, dragPoint,
    contourSegs, Surface3D, pySurface, surfSelect, between, texInto, texEl, card, cardGrid, badge, rowTable, choiceButtons, heatCell,
    f2, f3, f4, py, vec, powFmt, decades, sup, rgbStr, yDom,
  };
})();
