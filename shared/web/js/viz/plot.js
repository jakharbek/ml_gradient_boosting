/* =====================================================================================
 * GBC.Plot — лёгкая библиотека графиков курса (SVG + canvas для тепловых карт).
 *
 *   const p = new GBC.Plot(el, { height: 300, x: {label: 'x'}, y: {label: 'y'} });
 *   p.render([
 *     { type: 'points', x, y, color: 'data', label: 'Данные', tooltip: i => [...] },
 *     { type: 'steps', segments, color: 'model', label: 'F_m(x)' },
 *   ]);
 *
 * Слои: points, line, steps, segments, area, polygon, bars, heatmap, contour, vline, hline,
 * vband, rect, text, arrows. Цвета — роли курса ('model', 'tree', 'data', …) или CSS.
 * Легенда появляется при ≥ 2 подписанных слоях, подсказки — по ближайшей точке
 * (зона 24 px), у линий — перекрестие. Кнопка «Таблица» показывает данные текстом.
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC;
  const U = GBC.util;
  const S = GBC.svg;
  const H = GBC.h;

  /* ---------------------------------------------------------------------------------
   * Цвета: роли → CSS-переменные; для canvas — реальные RGB текущей темы.
   * --------------------------------------------------------------------------------- */
  const ROLE_VARS = {
    data: '--c-data', truth: '--c-truth', model: '--c-model', 'model-prev': '--c-model-prev',
    tree: '--c-tree', residual: '--c-residual', train: '--c-train', valid: '--c-valid', test: '--c-test',
    class0: '--c-class0', class1: '--c-class1', class2: '--c-class2',
    blue: '--c-blue', orange: '--c-orange', aqua: '--c-aqua', yellow: '--c-yellow', magenta: '--c-magenta',
    green: '--c-green', violet: '--c-violet', red: '--c-red',
    accent: '--accent', ink: '--ink', ink2: '--ink-2', muted: '--muted', grid: '--c-grid', axis: '--c-axis',
    surface: '--surface', neg: '--div-neg', pos: '--div-pos', mid: '--div-mid', good: '--good', critical: '--critical',
  };
  const SERIES = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];

  function cssColor(c) {
    if (!c) return 'var(--c-model)';
    if (ROLE_VARS[c]) return 'var(' + ROLE_VARS[c] + ')';
    return c;
  }

  function parseColor(str) {
    str = (str || '').trim();
    if (str.startsWith('#')) {
      let h = str.slice(1);
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (m) return m[1].split(',').slice(0, 3).map((v) => parseFloat(v));
    return [128, 128, 128];
  }

  function resolveRGB(c) {
    if (Array.isArray(c)) return c;
    if (ROLE_VARS[c]) return parseColor(GBC.cssVar(ROLE_VARS[c]));
    if (typeof c === 'string' && c.startsWith('var(')) return parseColor(GBC.cssVar(c.slice(4, -1)));
    return parseColor(c);
  }

  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  GBC.colors = {
    css: cssColor,
    rgb: resolveRGB,
    series: (i) => SERIES[i % SERIES.length],
    SERIES,
    rgbString: (rgb, a = 1) => 'rgba(' + rgb.map((v) => Math.round(v)).join(',') + ',' + a + ')',
    /** t ∈ [−1, 1] → синий … серый … красный */
    diverging() {
      const neg = resolveRGB('neg');
      const mid = resolveRGB('mid');
      const pos = resolveRGB('pos');
      return (t) => {
        t = U.clamp(t, -1, 1);
        return t < 0 ? mix(mid, neg, -t) : mix(mid, pos, t);
      };
    },
    /** p ∈ [0, 1] → класс 0 (синий) … серый … класс 1 (оранжевый) */
    proba() {
      const c0 = resolveRGB('class0');
      const mid = resolveRGB('mid');
      const c1 = resolveRGB('class1');
      return (p) => {
        p = U.clamp(p, 0, 1);
        return p < 0.5 ? mix(c0, mid, p / 0.5) : mix(mid, c1, (p - 0.5) / 0.5);
      };
    },
    /** t ∈ [0, 1] → от светлого к тёмному синему */
    sequential() {
      const dark = root.document && root.document.documentElement.dataset.theme === 'dark';
      const a = dark ? [24, 40, 64] : [205, 226, 251];
      const b = dark ? [134, 182, 239] : [13, 54, 107];
      return (t) => mix(a, b, U.clamp(t, 0, 1));
    },
    classes() {
      return ['class0', 'class1', 'class2'].map(resolveRGB);
    },
  };

  /* ---------------------------------------------------------------------------------
   * Подписи с индексами: 'F_{m-1}(x)' → F<sub>m−1</sub>(x) через tspan.
   * --------------------------------------------------------------------------------- */
  // Индекс ставится только после короткого символа (F_m, x_{i}); в идентификаторах
  // вроде reg_lambda или min_child_weight (≥ 2 букв перед _) подчёркивание остаётся буквальным.
  const SUBSUP = /((?<![A-Za-z]{2})_\{[^}]*\}|\^\{[^}]*\}|(?<![A-Za-z]{2})_[A-Za-z0-9]|\^[A-Za-z0-9])/;
  function richText(el, text) {
    const parts = String(text).split(SUBSUP);
    for (const part of parts) {
      if (!part) continue;
      if (part[0] === '_' || part[0] === '^') {
        const body = part[1] === '{' ? part.slice(2, -1) : part.slice(1);
        const sub = part[0] === '_';
        el.appendChild(
          S('tspan', { 'baseline-shift': sub ? 'sub' : 'super', 'font-size': '75%' }, body.replace(/-/g, '−'))
        );
      } else {
        el.appendChild(root.document.createTextNode(part));
      }
    }
    return el;
  }
  function richHTML(text) {
    const span = H('span');
    const parts = String(text).split(SUBSUP);
    for (const part of parts) {
      if (!part) continue;
      if (part[0] === '_' || part[0] === '^') {
        const body = part[1] === '{' ? part.slice(2, -1) : part.slice(1);
        span.appendChild(H(part[0] === '_' ? 'sub' : 'sup', null, body.replace(/-/g, '−')));
      } else span.appendChild(root.document.createTextNode(part));
    }
    return span;
  }
  GBC.richText = richHTML;

  /* ---------------------------------------------------------------------------------
   * Шкалы и тики
   * --------------------------------------------------------------------------------- */
  function makeScale(domain, range, type) {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    if (type === 'log') {
      const l0 = Math.log10(d0);
      const l1 = Math.log10(d1);
      const f = (v) => r0 + ((Math.log10(v) - l0) / (l1 - l0 || 1)) * (r1 - r0);
      f.invert = (p) => Math.pow(10, l0 + ((p - r0) / (r1 - r0)) * (l1 - l0));
      return f;
    }
    const k = (r1 - r0) / (d1 - d0 || 1);
    const f = (v) => r0 + (v - d0) * k;
    f.invert = (p) => d0 + (p - r0) / k;
    return f;
  }

  function logTicks(d0, d1) {
    const out = [];
    for (let e = Math.floor(Math.log10(d0)); e <= Math.ceil(Math.log10(d1)); e++) {
      for (const m of [1, 2, 5]) {
        const v = m * Math.pow(10, e);
        if (v >= d0 * 0.999 && v <= d1 * 1.001) out.push(v);
      }
    }
    return out;
  }

  /** Подписи логарифмической шкалы: у каждого значения ровно столько знаков, сколько нужно (0.02, 5, 2000). */
  function logTickFormatter(v) {
    if (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-4 && v !== 0)) return U.fmt(v, 2);
    return v.toFixed(Math.max(0, -Math.floor(Math.log10(Math.abs(v)) + 1e-9)));
  }

  function tickFormatter(ticks) {
    if (ticks.length < 2) return (v) => U.fmt(v, 3);
    const step = Math.abs(ticks[1] - ticks[0]);
    const dec = Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
    return (v) => {
      if (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-4 && v !== 0)) return U.fmt(v, 2);
      return v.toFixed(dec).replace('-', '−');
    };
  }

  /* ---------------------------------------------------------------------------------
   * Изолинии (marching squares) — для границы решения p = 0.5
   * --------------------------------------------------------------------------------- */
  function contourSegments(grid, level) {
    const { nx, ny, values, x0, x1, y0, y1 } = grid;
    const dx = (x1 - x0) / (nx - 1);
    const dy = (y1 - y0) / (ny - 1);
    const segs = [];
    const V = (i, j) => values[j * nx + i];
    const interp = (a, b, va, vb) => a + ((level - va) / (vb - va || 1e-12)) * (b - a);
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const v00 = V(i, j);
        const v10 = V(i + 1, j);
        const v01 = V(i, j + 1);
        const v11 = V(i + 1, j + 1);
        const idx = (v00 > level ? 1 : 0) | (v10 > level ? 2 : 0) | (v11 > level ? 4 : 0) | (v01 > level ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        const xa = x0 + i * dx;
        const xb = xa + dx;
        const ya = y0 + j * dy;
        const yb = ya + dy;
        const bottom = [interp(xa, xb, v00, v10), ya];
        const right = [xb, interp(ya, yb, v10, v11)];
        const top = [interp(xa, xb, v01, v11), yb];
        const left = [xa, interp(ya, yb, v00, v01)];
        const table = {
          1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[right, top]],
          5: [[left, top], [bottom, right]], 6: [[bottom, top]], 7: [[left, top]], 8: [[left, top]],
          9: [[bottom, top]], 10: [[left, bottom], [right, top]], 11: [[right, top]], 12: [[left, right]],
          13: [[bottom, right]], 14: [[left, bottom]],
        };
        for (const s of table[idx]) segs.push(s);
      }
    }
    return segs;
  }

  /* ---------------------------------------------------------------------------------
   * Plot
   * --------------------------------------------------------------------------------- */
  class Plot {
    constructor(parent, opts = {}) {
      this.opts = Object.assign(
        {
          height: 300,
          margin: { top: 10, right: 14, bottom: 42, left: 50 },
          x: {},
          y: {},
          grid: 'both',
          legend: 'auto',
          title: null,
          crosshair: false,
          equal: false,
          table: null,
          ariaLabel: null,
        },
        opts
      );
      this.opts.margin = Object.assign({ top: 10, right: 14, bottom: 42, left: 50 }, opts.margin || {});
      this.layers = [];
      this.onClick = opts.onClick || null;
      this.onHover = opts.onHover || null;
      this.root = H('div', { class: 'plot' });
      this.head = H('div', { class: 'plot-head' });
      this.titleEl = H('div', { class: 'plot-title' });
      this.legendEl = H('div', { class: 'plot-legend' });
      this.head.append(this.titleEl, this.legendEl);
      this.frame = H('div', { class: 'plot-frame' });
      this.canvas = H('canvas');
      this.svgEl = S('svg', { class: 'plot-svg', role: 'img' });
      this.tooltip = H('div', { class: 'plot-tooltip', role: 'status' });
      this.frame.append(this.canvas, this.svgEl, this.tooltip);
      this.root.append(this.head, this.frame);
      if (this.opts.table) {
        this.tableBtn = H('button', { class: 'btn ghost small plot-table-toggle', type: 'button' }, 'Показать таблицу');
        this.tableBox = H('div', { class: 'plot-table', hidden: true });
        this.tableBtn.addEventListener('click', () => this.toggleTable());
        this.root.append(this.tableBtn, this.tableBox);
      }
      parent.appendChild(this.root);
      this._hit = [];
      this._drag = null;
      this._bindEvents();
      this._lastW = 0;
      if (root.ResizeObserver) {
        this._ro = new ResizeObserver(() => {
          const w = this.frame.clientWidth;
          if (w && Math.abs(w - this._lastW) > 1) this.draw();
        });
        this._ro.observe(this.frame);
      }
      this._unsub = GBC.bus.on('themechange', () => this.draw());
    }

    setTitle(t) {
      this.opts.title = t;
      this.titleEl.textContent = '';
      if (t) this.titleEl.appendChild(richHTML(t));
    }

    render(layers, domains = {}) {
      this.layers = layers.filter(Boolean);
      if (domains.x) this.opts.x = Object.assign({}, this.opts.x, { domain: domains.x });
      if (domains.y) this.opts.y = Object.assign({}, this.opts.y, { domain: domains.y });
      this.draw();
      if (this.tableBox && !this.tableBox.hidden) this._renderTable();
    }

    /** Автоматический диапазон по данным слоёв. */
    _autoDomain(axis) {
      let lo = Infinity;
      let hi = -Infinity;
      const upd = (v) => {
        if (v === null || v === undefined || Number.isNaN(v) || !Number.isFinite(v)) return;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      };
      const each = (v) => {
        if (Array.isArray(v) || ArrayBuffer.isView(v)) for (const x of v) upd(x);
        else if (typeof v === 'number') upd(v);
      };
      for (const L of this.layers) {
        if (L.ignoreDomain || L.type === 'text' || L.type === 'rect' || L.type === 'vband') continue;
        if (axis === 'x') {
          if (L.type !== 'hline') each(L.x);
          if (L.segments) L.segments.forEach((s) => (upd(s.x0), upd(s.x1)));
          if (L.type === 'segments' || L.type === 'arrows') each(L.x1), each(L.x2);
          if (L.polys) L.polys.forEach((P) => each(P.x));
          if (L.grid) upd(L.grid.x0), upd(L.grid.x1);
        } else {
          if (L.type !== 'vline') each(L.y);
          if (L.type === 'area') each(L.y0), each(L.y1);
          if (L.segments) L.segments.forEach((s) => upd(s.value));
          if (L.type === 'segments' || L.type === 'arrows') each(L.y1), each(L.y2);
          if (L.polys) L.polys.forEach((P) => each(P.y));
          if (L.grid) upd(L.grid.y0), upd(L.grid.y1);
          if (L.type === 'bars') upd(L.base || 0);
        }
      }
      if (!Number.isFinite(lo)) return [0, 1];
      if (lo === hi) return [lo - 1, hi + 1];
      const pad = (hi - lo) * 0.06;
      return [lo - pad, hi + pad];
    }

    draw() {
      const o = this.opts;
      const m = o.margin;
      const W = Math.max(200, this.frame.clientWidth || 600);
      this._lastW = W;
      const Hh = o.height;
      this.setTitle(o.title);
      let xd = o.x.domain && o.x.domain !== 'auto' ? o.x.domain.slice() : this._autoDomain('x');
      let yd = o.y.domain && o.y.domain !== 'auto' ? o.y.domain.slice() : this._autoDomain('y');
      if (o.x.nice) {
        const st = U.niceStep(xd[1] - xd[0], 6);
        xd = [Math.floor(xd[0] / st) * st, Math.ceil(xd[1] / st) * st];
      }
      if (o.y.nice) {
        const st = U.niceStep(yd[1] - yd[0], 5);
        yd = [Math.floor(yd[0] / st) * st, Math.ceil(yd[1] / st) * st];
      }
      const pw = W - m.left - m.right;
      const ph = Hh - m.top - m.bottom;
      if (o.equal) {
        const kx = pw / (xd[1] - xd[0]);
        const ky = ph / (yd[1] - yd[0]);
        if (kx > ky) {
          const c = (xd[0] + xd[1]) / 2;
          const half = pw / ky / 2;
          xd = [c - half, c + half];
        } else {
          const c = (yd[0] + yd[1]) / 2;
          const half = ph / kx / 2;
          yd = [c - half, c + half];
        }
      }
      this.xDomain = xd;
      this.yDomain = yd;
      const X = (this.X = makeScale(xd, [m.left, m.left + pw], o.x.type));
      const Y = (this.Y = makeScale(yd, [m.top + ph, m.top], o.y.type));
      this.area = { x: m.left, y: m.top, w: pw, h: ph };

      const svg = this.svgEl;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
      svg.setAttribute('width', W);
      svg.setAttribute('height', Hh);
      svg.setAttribute('aria-label', o.ariaLabel || o.title || 'График');
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      this._hit = [];

      const clipId = this._clipId || (this._clipId = U.uid('clip'));
      svg.appendChild(
        S('defs', null, S('clipPath', { id: clipId }, S('rect', { x: m.left, y: m.top, width: pw, height: ph })))
      );

      // Сетка и оси
      const xt = o.x.ticks || (o.x.type === 'log' ? logTicks(xd[0], xd[1]) : U.niceTicks(xd[0], xd[1], Math.max(3, Math.round(pw / 90))));
      const yt = o.y.ticks || (o.y.type === 'log' ? logTicks(yd[0], yd[1]) : U.niceTicks(yd[0], yd[1], Math.max(3, Math.round(ph / 55))));
      const fx = o.x.format || (o.x.type === 'log' ? logTickFormatter : tickFormatter(xt));
      const fy = o.y.format || (o.y.type === 'log' ? logTickFormatter : tickFormatter(yt));
      const grid = S('g', { class: 'grid' });
      if (o.grid === 'both' || o.grid === 'x')
        for (const t of xt) grid.appendChild(S('line', { x1: X(t), x2: X(t), y1: m.top, y2: m.top + ph }));
      if (o.grid === 'both' || o.grid === 'y')
        for (const t of yt) grid.appendChild(S('line', { x1: m.left, x2: m.left + pw, y1: Y(t), y2: Y(t) }));
      svg.appendChild(grid);

      // Растровые слои (canvas)
      this._drawCanvas();

      const plotG = S('g', { 'clip-path': 'url(#' + clipId + ')' });
      svg.appendChild(plotG);
      const overG = S('g');
      svg.appendChild(overG);

      for (let li = 0; li < this.layers.length; li++) {
        const L = this.layers[li];
        const target = L.noClip ? overG : plotG;
        this._drawLayer(target, L, li);
      }

      // Оси поверх данных
      const axes = S('g');
      axes.appendChild(S('line', { class: 'axis-line', x1: m.left, x2: m.left + pw, y1: m.top + ph, y2: m.top + ph }));
      if (o.x.hide !== true)
        for (const t of xt) {
          const g = S('g', { class: 'tick', transform: 'translate(' + X(t) + ',' + (m.top + ph) + ')' });
          g.appendChild(S('text', { y: 16, 'text-anchor': 'middle' }, fx(t)));
          axes.appendChild(g);
        }
      if (o.y.hide !== true)
        for (const t of yt) {
          const g = S('g', { class: 'tick', transform: 'translate(' + m.left + ',' + Y(t) + ')' });
          g.appendChild(S('text', { x: -8, dy: '0.32em', 'text-anchor': 'end' }, fy(t)));
          axes.appendChild(g);
        }
      if (o.x.label) {
        const t = S('text', { class: 'axis-label', x: m.left + pw / 2, y: Hh - 6, 'text-anchor': 'middle' });
        axes.appendChild(richText(t, o.x.label));
      }
      if (o.y.label) {
        const t = S('text', {
          class: 'axis-label', 'text-anchor': 'middle',
          transform: 'translate(12,' + (m.top + ph / 2) + ') rotate(-90)',
        });
        axes.appendChild(richText(t, o.y.label));
      }
      svg.appendChild(axes);
      this.crossLine = S('line', { class: 'crosshair', y1: m.top, y2: m.top + ph, visibility: 'hidden' });
      svg.appendChild(this.crossLine);
      this._drawLegend();
    }

    _drawCanvas() {
      const cv = this.canvas;
      const a = this.area;
      const raster = this.layers.filter((L) => L.type === 'heatmap');
      if (!raster.length) {
        cv.style.display = 'none';
        return;
      }
      const dpr = root.devicePixelRatio || 1;
      cv.style.display = 'block';
      cv.style.left = a.x + 'px';
      cv.style.top = a.y + 'px';
      cv.style.width = a.w + 'px';
      cv.style.height = a.h + 'px';
      cv.width = Math.round(a.w * dpr);
      cv.height = Math.round(a.h * dpr);
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const L of raster) {
        const g = L.grid;
        const off = root.document.createElement('canvas');
        off.width = g.nx;
        off.height = g.ny;
        const octx = off.getContext('2d');
        const img = octx.createImageData(g.nx, g.ny);
        const colorFn = L.colorFn;
        const alpha = Math.round(255 * (L.opacity ?? 0.85));
        for (let j = 0; j < g.ny; j++) {
          for (let i = 0; i < g.nx; i++) {
            const v = g.values[j * g.nx + i];
            const rgb = colorFn(v);
            const k = ((g.ny - 1 - j) * g.nx + i) * 4;
            img.data[k] = rgb[0];
            img.data[k + 1] = rgb[1];
            img.data[k + 2] = rgb[2];
            img.data[k + 3] = rgb[3] === undefined ? alpha : rgb[3];
          }
        }
        octx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = L.smooth !== false;
        // Сетка задаёт центры ячеек: растягиваем на полшага за края
        const hx = (g.x1 - g.x0) / (g.nx - 1) / 2;
        const hy = (g.y1 - g.y0) / (g.ny - 1) / 2;
        const px0 = (this.X(g.x0 - hx) - a.x) * dpr;
        const px1 = (this.X(g.x1 + hx) - a.x) * dpr;
        const py0 = (this.Y(g.y1 + hy) - a.y) * dpr;
        const py1 = (this.Y(g.y0 - hy) - a.y) * dpr;
        ctx.drawImage(off, px0, py0, px1 - px0, py1 - py0);
      }
    }

    _drawLayer(g, L, li) {
      const X = this.X;
      const Y = this.Y;
      const color = cssColor(L.color);
      const style = (extra) => Object.assign({}, extra);
      const dash = L.dash === true ? '6 4' : L.dash || null;
      switch (L.type) {
        case 'points': {
          const grp = S('g', { opacity: L.opacity ?? 1 });
          const n = L.x.length;
          const rFn = typeof L.r === 'function' ? L.r : () => L.r ?? 4;
          const cFn = typeof L.color === 'function' ? (i) => cssColor(L.color(i)) : () => color;
          const hl = L.highlight;
          for (let i = 0; i < n; i++) {
            const xv = L.x[i];
            const yv = L.y[i];
            if (xv === null || yv === null || Number.isNaN(xv) || Number.isNaN(yv)) continue;
            const cx = X(xv);
            const cy = Y(yv);
            const r = rFn(i);
            const isHl = hl && (hl instanceof Set ? hl.has(i) : hl === i);
            const shape = L.shape === 'square' ? 'rect' : 'circle';
            const attrs =
              shape === 'rect'
                ? { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, rx: 1.5 }
                : { cx, cy, r: isHl ? r + 2 : r };
            attrs.style = 'fill:' + (L.hollow ? 'var(--surface)' : cFn(i)) + ';stroke:' +
              (L.hollow ? cFn(i) : isHl ? 'var(--ink)' : 'var(--surface)') + ';stroke-width:' +
              (L.hollow ? 2 : isHl ? 2 : 1.5);
            if (L.draggable) attrs.class = 'draggable';
            grp.appendChild(S(shape, attrs));
            this._hit.push({ li, i, px: cx, py: cy, kind: 'point', drag: !!L.draggable });
          }
          g.appendChild(grp);
          break;
        }
        case 'line': {
          let d = '';
          let pen = false;
          for (let i = 0; i < L.x.length; i++) {
            const yv = L.y[i];
            if (yv === null || Number.isNaN(yv) || !Number.isFinite(yv)) {
              pen = false;
              continue;
            }
            const px = X(L.x[i]);
            const py = Y(yv);
            if (L.curve === 'step' && pen) d += 'H' + px.toFixed(2) + 'V' + py.toFixed(2);
            else d += (pen ? 'L' : 'M') + px.toFixed(2) + ',' + py.toFixed(2);
            pen = true;
          }
          g.appendChild(
            S('path', {
              d, fill: 'none',
              style: 'stroke:' + color + ';stroke-width:' + (L.width ?? 2) + ';stroke-linejoin:round;stroke-linecap:round' +
                (dash ? ';stroke-dasharray:' + dash : '') + ';opacity:' + (L.opacity ?? 1),
            })
          );
          if (L.label && L.hover !== false) this._hit.push({ li, kind: 'line' });
          if (L.endLabel) {
            const k = L.x.length - 1;
            const t = S('text', { class: 'ann', x: X(L.x[k]) + 6, y: Y(L.y[k]), dy: '0.32em' });
            g.appendChild(richText(t, L.endLabel));
          }
          break;
        }
        case 'steps': {
          const segs = L.segments;
          if (!segs || !segs.length) break;
          let d = '';
          for (let k = 0; k < segs.length; k++) {
            const s = segs[k];
            const px0 = X(s.x0);
            const px1 = X(s.x1);
            const py = Y(s.value);
            d += (k === 0 ? 'M' + px0.toFixed(2) + ',' + py.toFixed(2) : 'V' + py.toFixed(2)) + 'H' + px1.toFixed(2);
          }
          g.appendChild(
            S('path', {
              d, fill: 'none',
              style: 'stroke:' + color + ';stroke-width:' + (L.width ?? 2.2) + ';stroke-linejoin:round;stroke-linecap:round' +
                (dash ? ';stroke-dasharray:' + dash : '') + ';opacity:' + (L.opacity ?? 1),
            })
          );
          if (L.label && L.hover !== false) this._hit.push({ li, kind: 'steps' });
          break;
        }
        case 'segments': {
          let d = '';
          for (let i = 0; i < L.x1.length; i++) {
            d += 'M' + X(L.x1[i]).toFixed(2) + ',' + Y(L.y1[i]).toFixed(2) + 'L' + X(L.x2[i]).toFixed(2) + ',' + Y(L.y2[i]).toFixed(2);
          }
          g.appendChild(
            S('path', {
              d, fill: 'none',
              style: 'stroke:' + color + ';stroke-width:' + (L.width ?? 1.2) + ';opacity:' + (L.opacity ?? 0.75) +
                (dash ? ';stroke-dasharray:' + dash : ''),
            })
          );
          break;
        }
        case 'arrows': {
          const grp = S('g', { style: 'stroke:' + color + ';fill:' + color + ';opacity:' + (L.opacity ?? 1) });
          for (let i = 0; i < L.x1.length; i++) {
            const ax = X(L.x1[i]);
            const ay = Y(L.y1[i]);
            const bx = X(L.x2[i]);
            const by = Y(L.y2[i]);
            const len = Math.hypot(bx - ax, by - ay);
            if (len < 1) continue;
            const ux = (bx - ax) / len;
            const uy = (by - ay) / len;
            const hs = Math.min(8, len * 0.45);
            grp.appendChild(S('line', { x1: ax, y1: ay, x2: bx - ux * hs * 0.8, y2: by - uy * hs * 0.8, 'stroke-width': L.width ?? 1.8 }));
            grp.appendChild(
              S('path', {
                d: 'M' + bx + ',' + by + 'L' + (bx - ux * hs - uy * hs * 0.5) + ',' + (by - uy * hs + ux * hs * 0.5) +
                  'L' + (bx - ux * hs + uy * hs * 0.5) + ',' + (by - uy * hs - ux * hs * 0.5) + 'Z',
                stroke: 'none',
              })
            );
          }
          g.appendChild(grp);
          break;
        }
        case 'polygon': {
          // замкнутый многоугольник (x[i], y[i]); несколько фигур — массив polys: [{x, y}, …]
          const polys = L.polys || [{ x: L.x, y: L.y }];
          let d = '';
          for (const P of polys) {
            for (let i = 0; i < P.x.length; i++) d += (i ? 'L' : 'M') + X(P.x[i]).toFixed(2) + ',' + Y(P.y[i]).toFixed(2);
            if (P.x.length) d += 'Z';
          }
          g.appendChild(
            S('path', {
              d,
              style: 'fill:' + (L.fill === false ? 'none' : cssColor(L.fill || L.color)) + ';fill-opacity:' + (L.opacity ?? 0.18) +
                ';stroke:' + (L.stroke ? cssColor(L.stroke) : 'none') + ';stroke-width:' + (L.width ?? 1.5) + ';stroke-linejoin:round' +
                (dash ? ';stroke-dasharray:' + dash : ''),
            })
          );
          break;
        }
        case 'area': {
          let d = '';
          for (let i = 0; i < L.x.length; i++) d += (i ? 'L' : 'M') + X(L.x[i]) + ',' + Y(L.y1[i]);
          for (let i = L.x.length - 1; i >= 0; i--) d += 'L' + X(L.x[i]) + ',' + Y(L.y0[i]);
          g.appendChild(S('path', { d: d + 'Z', style: 'fill:' + color + ';opacity:' + (L.opacity ?? 0.14) + ';stroke:none' }));
          break;
        }
        case 'bars': {
          const base = L.base ?? 0;
          const grp = S('g', { opacity: L.opacity ?? 1 });
          const cFn = typeof L.color === 'function' ? (i) => cssColor(L.color(i)) : () => color;
          for (let i = 0; i < L.x.length; i++) {
            const w = L.width ?? 0.8;
            let px0 = X(L.x[i] - w / 2);
            let px1 = X(L.x[i] + w / 2);
            const maxPx = L.maxPx ?? 24;
            if (px1 - px0 > maxPx) {
              const c = (px0 + px1) / 2;
              px0 = c - maxPx / 2;
              px1 = c + maxPx / 2;
            }
            px0 += 1;
            px1 -= 1;
            const yv = L.y[i];
            const pb = Y(base);
            const pt = Y(yv);
            const top = Math.min(pb, pt);
            const hgt = Math.abs(pb - pt);
            const r = Math.min(4, hgt, (px1 - px0) / 2);
            const up = yv >= base;
            let d;
            if (up)
              d = 'M' + px0 + ',' + pb + 'V' + (top + r) + 'Q' + px0 + ',' + top + ' ' + (px0 + r) + ',' + top +
                'H' + (px1 - r) + 'Q' + px1 + ',' + top + ' ' + px1 + ',' + (top + r) + 'V' + pb + 'Z';
            else
              d = 'M' + px0 + ',' + pb + 'V' + (pb + hgt - r) + 'Q' + px0 + ',' + (pb + hgt) + ' ' + (px0 + r) + ',' + (pb + hgt) +
                'H' + (px1 - r) + 'Q' + px1 + ',' + (pb + hgt) + ' ' + px1 + ',' + (pb + hgt - r) + 'V' + pb + 'Z';
            grp.appendChild(S('path', { d, style: 'fill:' + cFn(i) + ';opacity:' + (L.opacity ?? 1) }));
            this._hit.push({ li, i, px: (px0 + px1) / 2, py: (pb + pt) / 2, kind: 'bar' });
          }
          g.appendChild(grp);
          break;
        }
        case 'heatmap':
          break;
        case 'contour': {
          const segs = contourSegments(L.grid, L.level ?? 0.5);
          let d = '';
          for (const [a, b] of segs) d += 'M' + X(a[0]).toFixed(1) + ',' + Y(a[1]).toFixed(1) + 'L' + X(b[0]).toFixed(1) + ',' + Y(b[1]).toFixed(1);
          g.appendChild(
            S('path', {
              d, fill: 'none',
              style: 'stroke:' + cssColor(L.color || 'ink2') + ';stroke-width:' + (L.width ?? 1.6) + ';stroke-linecap:round' +
                (dash ? ';stroke-dasharray:' + dash : ''),
            })
          );
          break;
        }
        case 'vline':
        case 'hline': {
          const a = this.area;
          const isV = L.type === 'vline';
          const p = isV ? X(L.x) : Y(L.y);
          const attrs = isV ? { x1: p, x2: p, y1: a.y, y2: a.y + a.h } : { x1: a.x, x2: a.x + a.w, y1: p, y2: p };
          g.appendChild(
            S('line', Object.assign({}, attrs, {
              style: 'stroke:' + color + ';stroke-width:' + (L.width ?? 1.5) + (dash ? ';stroke-dasharray:' + dash : '') +
                ';opacity:' + (L.opacity ?? 1),
            }))
          );
          if (L.draggable) {
            g.appendChild(
              S('line', Object.assign({}, attrs, {
                class: 'draggable', style: 'stroke:transparent;stroke-width:18;cursor:' + (isV ? 'ew-resize' : 'ns-resize'),
              }))
            );
            this._hit.push({ li, kind: isV ? 'vline' : 'hline', p, drag: true });
          }
          if (L.text) {
            const t = isV
              ? S('text', { class: 'ann', x: p + 5, y: a.y + 12 })
              : S('text', { class: 'ann', x: a.x + a.w - 4, y: p - 6, 'text-anchor': 'end' });
            g.appendChild(richText(t, L.text));
          }
          break;
        }
        case 'vband': {
          const a = this.area;
          const x0 = X(L.x0);
          const x1 = X(L.x1);
          g.appendChild(
            S('rect', { x: Math.min(x0, x1), y: a.y, width: Math.abs(x1 - x0), height: a.h, style: 'fill:' + color + ';opacity:' + (L.opacity ?? 0.08) })
          );
          break;
        }
        case 'rect': {
          const x0 = X(L.x0);
          const x1 = X(L.x1);
          const y0 = Y(L.y0);
          const y1 = Y(L.y1);
          g.appendChild(
            S('rect', {
              x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0),
              style: 'fill:' + (L.fill ? cssColor(L.fill) : 'none') + ';fill-opacity:' + (L.opacity ?? 0.1) + ';stroke:' +
                (L.stroke ? cssColor(L.stroke) : 'none') + ';stroke-width:' + (L.width ?? 1.2) + (dash ? ';stroke-dasharray:' + dash : ''),
            })
          );
          break;
        }
        case 'text': {
          const items = Array.isArray(L.items) ? L.items : [L];
          for (const it of items) {
            const t = S('text', {
              class: 'ann', x: X(it.x) + (it.dx || 0), y: Y(it.y) + (it.dy || 0),
              'text-anchor': it.anchor || 'start', style: it.color ? 'fill:' + cssColor(it.color) : null,
              'font-weight': it.bold ? 650 : null,
            });
            g.appendChild(richText(t, it.text));
          }
          break;
        }
        default:
          console.warn('[GBC.Plot] неизвестный слой', L.type);
      }
    }

    _drawLegend() {
      const el = this.legendEl;
      el.textContent = '';
      const labeled = this.layers.filter((L) => L.label && L.legend !== false);
      const show = this.opts.legend === true || (this.opts.legend === 'auto' && labeled.length >= 2);
      if (!show) return;
      for (const L of labeled) {
        const c = typeof L.color === 'function' ? cssColor(L.legendColor || 'data') : cssColor(L.color);
        let key;
        if (L.type === 'points')
          key = S('svg', { viewBox: '0 0 18 10' }, S('circle', { cx: 9, cy: 5, r: 4, style: 'fill:' + (L.hollow ? 'var(--surface)' : c) + ';stroke:' + (L.hollow ? c : 'none') + ';stroke-width:2' }));
        else if (L.type === 'area' || L.type === 'polygon' || L.type === 'bars' || L.type === 'vband' || L.type === 'heatmap' || L.type === 'rect')
          key = S('svg', { viewBox: '0 0 18 10' }, S('rect', { x: 1, y: 1, width: 16, height: 8, rx: 2, style: 'fill:' + c + ';opacity:' + (L.type === 'bars' ? 1 : 0.35) }));
        else {
          const dash = L.dash === true ? '4 3' : L.dash || null;
          key = S('svg', { viewBox: '0 0 18 10' }, S('line', { x1: 1, x2: 17, y1: 5, y2: 5, style: 'stroke:' + c + ';stroke-width:2.2;stroke-linecap:round' + (dash ? ';stroke-dasharray:' + dash : '') }));
        }
        el.appendChild(H('span', { class: 'item' }, key, richHTML(L.label)));
      }
    }

    /* -------------------------------- события ---------------------------------------- */
    _toData(evt) {
      const r = this.svgEl.getBoundingClientRect();
      const scale = r.width ? this._lastW / r.width : 1;
      const px = (evt.clientX - r.left) * scale;
      const py = (evt.clientY - r.top) * scale;
      return { px, py, x: this.X ? this.X.invert(px) : 0, y: this.Y ? this.Y.invert(py) : 0 };
    }

    _nearest(px, py, filter) {
      let best = null;
      let bd = 24 * 24;
      for (const h of this._hit) {
        if (filter && !filter(h)) continue;
        if (h.kind === 'vline') {
          const d = (px - h.p) * (px - h.p);
          if (d < bd) (bd = d), (best = h);
        } else if (h.kind === 'hline') {
          const d = (py - h.p) * (py - h.p);
          if (d < bd) (bd = d), (best = h);
        } else if (h.px !== undefined) {
          const d = (px - h.px) * (px - h.px) + (py - h.py) * (py - h.py);
          if (d < bd) (bd = d), (best = h);
        }
      }
      return best;
    }

    _bindEvents() {
      const svg = this.svgEl;
      svg.addEventListener('pointerdown', (e) => {
        const p = this._toData(e);
        const h = this._nearest(p.px, p.py, (hh) => hh.drag);
        if (h) {
          this._drag = h;
          svg.setPointerCapture(e.pointerId);
          e.preventDefault();
        }
      });
      svg.addEventListener('pointermove', (e) => {
        const p = this._toData(e);
        if (this._drag) {
          const L = this.layers[this._drag.li];
          if (L && L.onDrag) {
            const a = this.area;
            const cx = U.clamp(p.px, a.x, a.x + a.w);
            const cy = U.clamp(p.py, a.y, a.y + a.h);
            const dx = this.X.invert(cx);
            const dy = this.Y.invert(cy);
            if (this._drag.kind === 'vline') L.onDrag(dx);
            else if (this._drag.kind === 'hline') L.onDrag(dy);
            else L.onDrag(this._drag.i, dx, dy);
          }
          return;
        }
        this._hover(p);
      });
      const end = (e) => {
        if (this._drag) {
          const L = this.layers[this._drag.li];
          if (L && L.onDragEnd) L.onDragEnd();
          this._drag = null;
          try {
            svg.releasePointerCapture(e.pointerId);
          } catch (err) {
            /* уже отпущен */
          }
        }
      };
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);
      svg.addEventListener('pointerleave', () => this._hideTip());
      svg.addEventListener('click', (e) => {
        if (!this.onClick) return;
        const p = this._toData(e);
        const a = this.area;
        if (p.px < a.x || p.px > a.x + a.w || p.py < a.y || p.py > a.y + a.h) return;
        this.onClick(p.x, p.y, e);
      });
    }

    _hideTip() {
      this.tooltip.classList.remove('show');
      if (this.crossLine) this.crossLine.setAttribute('visibility', 'hidden');
      if (this.onHover) this.onHover(null);
    }

    _showTip(px, py, rows, title) {
      const tip = this.tooltip;
      tip.textContent = '';
      if (title) tip.appendChild(H('div', { class: 'title' }, title));
      for (const r of rows) {
        const row = H('div', { class: 'row' });
        if (r.color) row.appendChild(H('i', { class: 'key', style: { background: cssColor(r.color) } }));
        row.appendChild(H('b', null, r.value));
        row.appendChild(H('span', null, r.label ? richHTML(r.label) : ''));
        tip.appendChild(row);
      }
      const W = this._lastW;
      const r = this.svgEl.getBoundingClientRect();
      const k = r.width / W || 1;
      tip.classList.add('show');
      const tw = tip.offsetWidth;
      let left = px * k + 14;
      if (left + tw > r.width) left = px * k - tw - 14;
      tip.style.left = Math.max(0, left) + 'px';
      tip.style.top = Math.max(0, py * k - 12) + 'px';
    }

    _hover(p) {
      const a = this.area;
      if (!a || p.px < a.x - 12 || p.px > a.x + a.w + 12 || p.py < a.y - 12 || p.py > a.y + a.h + 12) {
        this._hideTip();
        return;
      }
      if (this.onHover) this.onHover(p);
      // 1) ближайшая точка / столбец с подсказкой
      const h = this._nearest(p.px, p.py, (hh) => (hh.kind === 'point' || hh.kind === 'bar') && this.layers[hh.li].tooltip);
      if (h) {
        const L = this.layers[h.li];
        const res = L.tooltip(h.i);
        if (res) {
          const rows = Array.isArray(res) ? res : [{ label: '', value: String(res) }];
          this._showTip(h.px, h.py, rows.map((r) => (Array.isArray(r) ? { label: r[0], value: r[1], color: r[2] } : r)), L.tooltipTitle ? L.tooltipTitle(h.i) : null);
          this.crossLine.setAttribute('visibility', 'hidden');
          return;
        }
      }
      // 2) перекрестие для линий
      if (this.opts.crosshair) {
        const xv = this.X.invert(p.px);
        const rows = [];
        let snapX = null;
        for (const L of this.layers) {
          if (!L.label || (L.type !== 'line' && L.type !== 'steps') || L.hover === false) continue;
          let val = null;
          if (L.type === 'line') {
            let bi = 0;
            let bd = Infinity;
            for (let i = 0; i < L.x.length; i++) {
              const d = Math.abs(L.x[i] - xv);
              if (d < bd) (bd = d), (bi = i);
            }
            val = L.y[bi];
            if (snapX === null) snapX = L.x[bi];
          } else {
            const s = L.segments.find((sg) => xv >= sg.x0 && xv <= sg.x1);
            if (s) val = s.value;
          }
          if (val !== null && val !== undefined) rows.push({ label: L.label, value: (this.opts.crosshairFormat || U.fmt)(val), color: typeof L.color === 'string' ? L.color : null });
        }
        if (rows.length) {
          const sx = snapX !== null ? snapX : xv;
          const px = this.X(sx);
          this.crossLine.setAttribute('x1', px);
          this.crossLine.setAttribute('x2', px);
          this.crossLine.setAttribute('visibility', 'visible');
          const tf = this.opts.crosshairTitle || ((v) => (this.opts.x.label ? this.opts.x.label.replace(/_\{[^}]*\}|_./g, '') + ' = ' : '') + U.fmt(v, 3));
          this._showTip(px, p.py, rows, tf(sx));
          return;
        }
      }
      this.tooltip.classList.remove('show');
    }

    toggleTable() {
      const box = this.tableBox;
      box.hidden = !box.hidden;
      this.tableBtn.textContent = box.hidden ? 'Показать таблицу' : 'Скрыть таблицу';
      if (!box.hidden) this._renderTable();
    }

    _renderTable() {
      const data = this.opts.table();
      const box = this.tableBox;
      box.textContent = '';
      if (!data) return;
      const table = H('table', { class: 'data' });
      table.appendChild(H('thead', null, H('tr', null, data.columns.map((c) => H('th', { class: 'num' }, c)))));
      const tb = H('tbody');
      const maxRows = data.maxRows || 400;
      for (const row of data.rows.slice(0, maxRows)) {
        tb.appendChild(H('tr', null, row.map((v) => H('td', { class: 'num' }, typeof v === 'number' ? U.fmt(v, 4) : String(v)))));
      }
      table.appendChild(tb);
      box.appendChild(table);
    }

    destroy() {
      if (this._ro) this._ro.disconnect();
      if (this._unsub) this._unsub();
      this.root.remove();
    }
  }

  /** Сетка значений функции на прямоугольнике — для heatmap/contour. */
  Plot.grid = function (fn, x0, x1, y0, y1, nx = 90, ny = 90) {
    const values = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      const y = y0 + ((y1 - y0) * j) / (ny - 1);
      for (let i = 0; i < nx; i++) {
        const x = x0 + ((x1 - x0) * i) / (nx - 1);
        values[j * nx + i] = fn(x, y);
      }
    }
    return { x0, x1, y0, y1, nx, ny, values };
  };

  GBC.Plot = Plot;
  GBC.contourSegments = contourSegments;
})(typeof window !== 'undefined' ? window : globalThis);
