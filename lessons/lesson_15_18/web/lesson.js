/* Урок 15.18: теория графов. Часть 1 — язык графов, обходы и кратчайшие пути, деревья.
 * Виджеты: мосты Кёнигсберга (прогулка по карте); граф как модель; семейства графов; степенные
 * последовательности (Гавел — Хакими); хранение графа; изоморфизм и инварианты; конструктор графа;
 * эйлеровы пути (Хирхольцер); коммивояжёр; BFS и DFS; DFS со временами, мостами и точками сочленения;
 * поиск пути в лабиринте (BFS, DFS, Дейкстра, A*); алгоритм Дейкстры; Беллман — Форд и арбитраж;
 * Флойд — Уоршелл; свойства деревьев; обходы корневого дерева; код Прюфера и формула Кэли; дерево решений
 * как граф; рост дерева по уровням и по листьям; минимальное остовное дерево; свойства разреза и цикла;
 * кластеризация через остовное дерево.
 * Общие помощники (рисование графов GraphView, алгоритмы, оформление) выставлены в GBC.lesson1518 —
 * ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const f1 = (v) => U.fmt(v, 1);
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const py = (v) => U.pyNum(v);
  const NB = '\u00a0';
  const SUPD = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (k) => String(k).split('').map((c) => SUPD[c] || c).join('');
  const grp = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  function num(v) {
    if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
    const a = Math.abs(v);
    if (a < 1e15 && Number.isInteger(v)) return (v < 0 ? '−' : '') + grp(String(a));
    if (a < 1e6) return U.fmt(v, 3);
    const e = Math.floor(Math.log10(a));
    return (v < 0 ? '−' : '') + U.fmt(a / Math.pow(10, e), 2) + '·10' + sup(e);
  }
  const pct = (p, d = 1) => (Number.isFinite(p) ? U.fmt(100 * p, d) + ' %' : '—');
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  const nWord = (n, one, few, many) => num(n) + ' ' + plural(n, one, few, many);
  const dstr = (d) => (d === Infinity || d === null || d === undefined || d < 0 ? '∞' : String(Math.round(d * 1000) / 1000));

  /* ==============================================================================
   * Оформление
   * ============================================================================== */
  const SER = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];
  const col = (c) => GBC.colors.css(c);
  const tint = (c, p = 22) => 'color-mix(in srgb, ' + col(c) + ' ' + p + '%, var(--surface))';
  const flexRow = (style = '') => H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;' + style });
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
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  const monoBox = (style = '') => H('div', { style: 'font-family:var(--font-mono);font-size:.86rem;line-height:1.6;white-space:pre-wrap;word-break:break-word;padding:6px 2px;' + style });
  function legendRow(items) {
    const row = flexRow('gap:14px;font-size:.86rem;color:var(--ink-2);margin:2px 0 6px');
    items.forEach(([c, t, dash]) => row.appendChild(H('span', { style: 'display:inline-flex;align-items:center;gap:6px' },
      dash === 'line' ? H('span', { style: 'width:18px;height:0;border-top:3px solid ' + col(c) + ';display:inline-block' }) :
        dash === 'dash' ? H('span', { style: 'width:18px;height:0;border-top:3px dashed ' + col(c) + ';display:inline-block' }) :
          H('span', { style: 'width:12px;height:12px;border-radius:50%;display:inline-block;background:' + tint(c, 40) + ';border:2px solid ' + col(c) }), t)));
    return row;
  }
  /** Таблица с подсветкой отдельных ячеек: cells[i][j] = {t, hl, bold}. */
  function cellTable(parent, head, rows, o = {}) {
    parent.textContent = '';
    const t = H('table', { class: 'data', style: 'font-variant-numeric:tabular-nums' + (o.compact ? ';font-size:.86rem' : '') });
    t.appendChild(H('thead', null, H('tr', null, head.map((c) => H('th', { class: 'num' }, c)))));
    const tb = H('tbody');
    rows.forEach((r, i) => tb.appendChild(H('tr', null, r.map((c, j) => {
      const v = typeof c === 'object' && c !== null ? c : { t: c };
      const td = H('td', { class: 'num', style: (v.hl ? 'background:' + tint(v.hl, 26) + ';' : '') + (v.bold ? 'font-weight:700;' : '') + (j === 0 ? 'font-weight:650;' : '') + (o.click ? 'cursor:pointer;' : '') }, String(v.t));
      if (o.click && j > 0) td.addEventListener('click', () => o.click(i, j - 1));
      return td;
    }))));
    t.appendChild(tb);
    parent.appendChild(H('div', { class: 'table-wrap' }, t));
  }

  /* ==============================================================================
   * GraphView — рисование графов на SVG: вершины, рёбра (прямые, дуги, стрелки), подписи
   * ============================================================================== */
  const R0 = 15;
  const unit = (dx, dy) => {
    const l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  };
  function sTxt(x, y, text, o = {}) {
    return S('text', {
      x, y, 'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'central',
      style: 'font-family:' + (o.mono ? 'var(--font-mono)' : 'var(--font-sans)') + ';font-size:' + (o.size || 13) + 'px;font-weight:' + (o.bold ? 700 : 500) +
        ';font-variant-numeric:tabular-nums;fill:' + (o.color ? col(o.color) : 'var(--ink)') +
        (o.halo ? ';paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round' : '') + (o.italic ? ';font-style:italic' : ''),
    }, text);
  }
  class GraphView {
    constructor(parent, o = {}) {
      this.o = o;
      this.w = o.w || 520;
      this.h = o.h || 300;
      this.svg = S('svg', {
        viewBox: '0 0 ' + this.w + ' ' + this.h, role: 'img', 'aria-label': o.label || 'Граф',
        style: 'display:block;width:100%;height:auto;max-width:' + (o.maxW ? o.maxW + 'px' : 'none') + ';min-width:' + (o.minW ?? 380) + 'px;margin:0 auto;user-select:none;-webkit-user-select:none',
      });
      this.box = H('div', { style: 'overflow-x:auto;overflow-y:hidden;margin:2px 0 6px' }, this.svg);
      parent.appendChild(this.box);
      this.spec = { nodes: [], edges: [] };
      if (o.onNode || o.onEdge || o.onBg) {
        this.svg.style.cursor = 'pointer';
        this.svg.addEventListener('click', (e) => this._click(e));
      }
    }
    resize(h) {
      this.h = h;
      this.svg.setAttribute('viewBox', '0 0 ' + this.w + ' ' + h);
    }
    toLocal(e) {
      const m = this.svg.getScreenCTM();
      if (!m) return null;
      const pt = this.svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(m.inverse());
      return [p.x, p.y];
    }
    _click(e) {
      const p = this.toLocal(e);
      if (!p) return;
      const [x, y] = p;
      const nodes = this.spec.nodes || [];
      let best = -1;
      let bd = Infinity;
      nodes.forEach((nd, i) => {
        if (!nd || nd.hit === false) return;
        const d = Math.hypot(nd.x - x, nd.y - y);
        if (d < (nd.r ?? R0) + 9 && d < bd) (bd = d), (best = i);
      });
      if (best >= 0 && this.o.onNode) return void this.o.onNode(best, e);
      if (this.o.onEdge) {
        let be = -1;
        let bdd = 11;
        (this.spec.edges || []).forEach((ed, i) => {
          if (!ed || ed.hit === false) return;
          const g = this._geom(ed, nodes);
          let prev = [g.ax, g.ay];
          for (let k = 1; k <= 16; k++) {
            const t = k / 16;
            const cur = [(1 - t) * (1 - t) * g.ax + 2 * t * (1 - t) * g.cx + t * t * g.bx, (1 - t) * (1 - t) * g.ay + 2 * t * (1 - t) * g.cy + t * t * g.by];
            const d = segDist(x, y, prev, cur);
            if (d < bdd) (bdd = d), (be = i);
            prev = cur;
          }
        });
        if (be >= 0) return void this.o.onEdge(be, e);
      }
      if (this.o.onBg) this.o.onBg(x, y, e);
    }
    _geom(e, nodes) {
      const A = e.a !== undefined ? nodes[e.a] : { x: e.x1, y: e.y1, r: 0 };
      const B = e.b !== undefined ? nodes[e.b] : { x: e.x2, y: e.y2, r: 0 };
      const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
      const nx = -(B.y - A.y) / len;
      const ny = (B.x - A.x) / len;
      const bend = e.bend || 0;
      const cx = e.c ? e.c[0] : (A.x + B.x) / 2 + nx * bend;
      const cy = e.c ? e.c[1] : (A.y + B.y) / 2 + ny * bend;
      const ra = (A.r ?? R0) + 1;
      const rb = (B.r ?? R0) + (e.arrow ? 2.5 : 1);
      const u1 = unit(cx - A.x, cy - A.y);
      const u2 = unit(B.x - cx, B.y - cy);
      return {
        ax: A.x, ay: A.y, bx: B.x, by: B.y, cx, cy, u2,
        sx: A.x + u1[0] * ra, sy: A.y + u1[1] * ra, ex: B.x - u2[0] * rb, ey: B.y - u2[1] * rb,
        mx: 0.25 * A.x + 0.5 * cx + 0.25 * B.x, my: 0.25 * A.y + 0.5 * cy + 0.25 * B.y, nx, ny,
      };
    }
    _edge(e, nodes, labels) {
      const g = this._geom(e, nodes);
      const c = col(e.color || 'muted');
      const wd = e.width ?? 2;
      const hs = e.arrow ? Math.max(7, 4 + wd * 1.6) : 0;
      const ex = g.ex - g.u2[0] * hs * 0.75;
      const ey = g.ey - g.u2[1] * hs * 0.75;
      const d = e.bend || e.c ? 'M' + g.sx.toFixed(1) + ',' + g.sy.toFixed(1) + 'Q' + g.cx.toFixed(1) + ',' + g.cy.toFixed(1) + ' ' + ex.toFixed(1) + ',' + ey.toFixed(1)
        : 'M' + g.sx.toFixed(1) + ',' + g.sy.toFixed(1) + 'L' + ex.toFixed(1) + ',' + ey.toFixed(1);
      const grp0 = S('g', { opacity: e.opacity ?? 1 });
      grp0.appendChild(S('path', { d, fill: 'none', style: 'stroke:' + c + ';stroke-width:' + wd + ';stroke-linecap:round' + (e.dash ? ';stroke-dasharray:' + (e.dash === true ? '6 4' : e.dash) : '') }));
      if (e.arrow) {
        const [ux, uy] = g.u2;
        grp0.appendChild(S('path', { d: 'M' + g.ex + ',' + g.ey + 'L' + (g.ex - ux * hs - uy * hs * 0.5) + ',' + (g.ey - uy * hs + ux * hs * 0.5) + 'L' + (g.ex - ux * hs + uy * hs * 0.5) + ',' + (g.ey - uy * hs - ux * hs * 0.5) + 'Z', style: 'fill:' + c + ';stroke:none' }));
      }
      if (e.label !== undefined && e.label !== '') {
        const off = e.loff || 0;
        labels.push(sTxt(g.mx + g.nx * off + (e.lx || 0), g.my + g.ny * off + (e.ly || 0), String(e.label), { size: e.lsize || 12.5, bold: e.lbold, color: e.lcolor || 'ink2', halo: true }));
      }
      return grp0;
    }
    _node(nd) {
      const r = nd.r ?? R0;
      const c = col(nd.color || 'model');
      const g = S('g', { opacity: nd.dim ? 0.32 : 1 });
      if (nd.halo) g.appendChild(S('circle', { cx: nd.x, cy: nd.y, r: r + (nd.haloR ?? 7), style: 'fill:' + col(nd.halo) + ';opacity:' + (nd.haloOpacity ?? 0.28) }));
      const fill = nd.fill ? tint(nd.fill, nd.fillP ?? 32) : 'var(--surface)';
      const st = 'fill:' + fill + ';stroke:' + c + ';stroke-width:' + (nd.width ?? 2) + (nd.dash ? ';stroke-dasharray:4 3' : '');
      g.appendChild(nd.shape === 'square' ? S('rect', { x: nd.x - r, y: nd.y - r, width: 2 * r, height: 2 * r, rx: 4, style: st }) : S('circle', { cx: nd.x, cy: nd.y, r, style: st }));
      if (nd.label !== undefined && nd.label !== '') g.appendChild(sTxt(nd.x, nd.y + 0.5, String(nd.label), { size: nd.size || (r < 11 ? 10.5 : 14), bold: true, color: nd.labelColor }));
      if (nd.sub !== undefined && nd.sub !== '') g.appendChild(sTxt(nd.x + (nd.subDx || 0), nd.y + r + (nd.subDy ?? 12), String(nd.sub), { size: nd.subSize || 12, color: nd.subColor || 'ink2', halo: true, bold: nd.subBold }));
      if (nd.top !== undefined && nd.top !== '') g.appendChild(sTxt(nd.x + (nd.topDx || 0), nd.y - r - 10, String(nd.top), { size: nd.topSize || 12, color: nd.topColor || 'ink', halo: true, bold: nd.topBold ?? true }));
      if (nd.side !== undefined && nd.side !== '') g.appendChild(sTxt(nd.x + r + 5, nd.y, String(nd.side), { size: nd.sideSize || 12, color: nd.sideColor || 'ink2', halo: true, anchor: 'start', bold: nd.sideBold }));
      return g;
    }
    draw(spec) {
      this.spec = spec;
      const svg = this.svg;
      svg.textContent = '';
      const nodes = spec.nodes || [];
      (spec.under || []).forEach((el) => svg.appendChild(el));
      const labels = [];
      (spec.edges || []).forEach((e) => e && svg.appendChild(this._edge(e, nodes, labels)));
      labels.forEach((l) => svg.appendChild(l));
      nodes.forEach((nd) => nd && svg.appendChild(this._node(nd)));
      (spec.texts || []).forEach((t) => svg.appendChild(sTxt(t.x, t.y, t.text, t)));
      (spec.over || []).forEach((el) => svg.appendChild(el));
    }
  }
  function segDist(x, y, p, q) {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const L = dx * dx + dy * dy || 1;
    const t = U.clamp(((x - p[0]) * dx + (y - p[1]) * dy) / L, 0, 1);
    return Math.hypot(x - p[0] - t * dx, y - p[1] - t * dy);
  }

  /* ==============================================================================
   * Алгоритмы на графах (общие)
   * ============================================================================== */
  /** Списки соседей (по возрастанию номера). edges: [a, b, ...]. */
  function adjList(n, edges, directed = false) {
    const adj = U.range(n).map(() => []);
    edges.forEach((e) => {
      adj[e[0]].push(e[1]);
      if (!directed) adj[e[1]].push(e[0]);
    });
    adj.forEach((a) => a.sort((x, y) => x - y));
    return adj;
  }
  function bfsDist(adj, s) {
    const d = new Array(adj.length).fill(-1);
    d[s] = 0;
    const q = [s];
    for (let h = 0; h < q.length; h++) {
      const v = q[h];
      for (const u of adj[v]) if (d[u] < 0) (d[u] = d[v] + 1), q.push(u);
    }
    return d;
  }
  function components(n, adj) {
    const comp = new Array(n).fill(-1);
    let k = 0;
    for (let s = 0; s < n; s++) {
      if (comp[s] >= 0) continue;
      const q = [s];
      comp[s] = k;
      for (let h = 0; h < q.length; h++) for (const u of adj[q[h]]) if (comp[u] < 0) (comp[u] = k), q.push(u);
      k++;
    }
    return { comp, k };
  }
  function bipartition(n, adj) {
    const color = new Array(n).fill(-1);
    let ok = true;
    for (let s = 0; s < n; s++) {
      if (color[s] >= 0) continue;
      color[s] = 0;
      const q = [s];
      for (let h = 0; h < q.length; h++) {
        const v = q[h];
        for (const u of adj[v]) {
          if (color[u] < 0) (color[u] = 1 - color[v]), q.push(u);
          else if (color[u] === color[v]) ok = false;
        }
      }
    }
    return { ok, color };
  }
  function triangles(n, adj) {
    const S2 = adj.map((a) => new Set(a));
    let t = 0;
    for (let i = 0; i < n; i++) for (const j of adj[i]) if (j > i) for (const k of adj[j]) if (k > j && S2[i].has(k)) t++;
    return t;
  }
  function diameter(n, adj) {
    let D = 0;
    for (let s = 0; s < n; s++) {
      const d = bfsDist(adj, s);
      if (d.some((v) => v < 0)) return Infinity;
      D = Math.max(D, ...d);
    }
    return D;
  }
  /** Обхват — длина кратчайшего цикла (BFS из каждой вершины). */
  function girth(n, adj) {
    let g = Infinity;
    for (let s = 0; s < n; s++) {
      const d = new Array(n).fill(-1);
      const par = new Array(n).fill(-1);
      d[s] = 0;
      const q = [s];
      for (let h = 0; h < q.length; h++) {
        const v = q[h];
        for (const u of adj[v]) {
          if (d[u] < 0) (d[u] = d[v] + 1), (par[u] = v), q.push(u);
          else if (par[v] !== u) g = Math.min(g, d[u] + d[v] + 1);
        }
      }
    }
    return g;
  }
  const circlePos = (n, cx, cy, r, phase = -Math.PI / 2, ry = r) => U.range(n).map((i) => [cx + r * Math.cos(phase + (2 * Math.PI * i) / n), cy + ry * Math.sin(phase + (2 * Math.PI * i) / n)]);
  /** Укладка корневого дерева: листья равномерно по x в порядке обхода, глубина — по y. */
  function treeLayout(n, edges, root, x0, x1, y0, dy) {
    const adj = adjList(n, edges);
    const par = new Array(n).fill(-1);
    const depth = new Array(n).fill(0);
    const kids = U.range(n).map(() => []);
    const seen = new Array(n).fill(false);
    const q = [root];
    seen[root] = true;
    for (let h = 0; h < q.length; h++) {
      const v = q[h];
      for (const u of adj[v]) if (!seen[u]) (seen[u] = true), (par[u] = v), (depth[u] = depth[v] + 1), kids[v].push(u), q.push(u);
    }
    const leaves = [];
    (function walk(v) {
      if (!kids[v].length) leaves.push(v);
      kids[v].forEach(walk);
    })(root);
    const pos = new Array(n);
    const step = (x1 - x0) / Math.max(1, leaves.length);
    leaves.forEach((v, i) => (pos[v] = [x0 + (i + 0.5) * step, 0]));
    (function place(v) {
      kids[v].forEach(place);
      if (kids[v].length) pos[v] = [U.mean(kids[v].map((u) => pos[u][0])), 0];
      pos[v][1] = y0 + depth[v] * dy;
    })(root);
    return { pos, par, depth, kids, maxDepth: Math.max(...depth) };
  }
  /** Двоичная куча (min) с порядком (приоритет, счётчик) — как heapq в Python. */
  class Heap {
    constructor() {
      this.a = [];
    }
    get size() {
      return this.a.length;
    }
    less(i, j) {
      const x = this.a[i];
      const y = this.a[j];
      return x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]);
    }
    push(item) {
      const a = this.a;
      a.push(item);
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!this.less(i, p)) break;
        [a[i], a[p]] = [a[p], a[i]];
        i = p;
      }
    }
    pop() {
      const a = this.a;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < a.length && this.less(l, m)) m = l;
          if (r < a.length && this.less(r, m)) m = r;
          if (m === i) break;
          [a[i], a[m]] = [a[m], a[i]];
          i = m;
        }
      }
      return top;
    }
  }
  const pyList = (arr) => '[' + arr.map((x) => (Array.isArray(x) ? pyList(x) : typeof x === 'string' ? '"' + x + '"' : py(x))).join(', ') + ']';

  /* ==============================================================================
   * 0. Мосты Кёнигсберга: прогулка по карте
   * ============================================================================== */
  const KB = {
    names: ['A', 'B', 'C', 'D'],
    long: ['остров Кнайпхоф', 'северный берег', 'южный берег', 'остров Ломзе'],
    node: [[235, 175], [235, 46], [235, 298], [500, 175]],
    bridges: [
      { a: 0, b: 1, r: [176, 97, 18, 52], bend: -26 },
      { a: 0, b: 1, r: [276, 97, 18, 52], bend: 26 },
      { a: 0, b: 2, r: [176, 201, 18, 52], bend: 26 },
      { a: 0, b: 2, r: [276, 201, 18, 52], bend: -26 },
      { a: 0, b: 3, r: [328, 167, 64, 16], bend: 0 },
      { a: 1, b: 3, r: [491, 97, 18, 52], bend: 30 },
      { a: 2, b: 3, r: [491, 201, 18, 52], bend: -30 },
      { a: 1, b: 2, r: [51, 97, 18, 156], bend: 250 },
    ],
  };
  GBC.widget('konigsberg-map', (el) => {
    const s = { view: 'both', eighth: false, cur: -1, route: [], msg: '' };
    const w = ui.shell(el, { title: 'Прогулка по Кёнигсбергу: пройдите по каждому мосту ровно один раз', sub: 'Щёлкните по суше, откуда начнёте, затем по мостам — по одному за раз. Попробуйте обойти все 7 мостов, не проходя ни один дважды.' });
    ui.segmented(w.controls, { label: 'Вид', value: s.view, options: [{ value: 'map', label: 'карта' }, { value: 'both', label: 'карта + граф' }, { value: 'graph', label: 'граф' }], onChange: (v) => ((s.view = v), draw()) });
    ui.toggle(w.controls, { label: 'Построить восьмой мост', checked: false, onChange: (v) => ((s.eighth = v), reset()) });
    ui.button(w.controls, { label: 'Начать заново', icon: 'reset', onClick: () => reset() });
    const svg = S('svg', { viewBox: '0 0 600 340', role: 'img', 'aria-label': 'Карта Кёнигсберга', style: 'display:block;width:100%;height:auto;min-width:390px;margin:0 auto;user-select:none' });
    w.main.appendChild(H('div', { style: 'overflow-x:auto;overflow-y:hidden;margin:2px 0 6px' }, svg));
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'пройдено мостов' }, { key: 'odd', label: 'суши с нечётным числом мостов' }, { key: 'res', label: 'вывод' }]);
    const bridges = () => KB.bridges.slice(0, s.eighth ? 8 : 7);
    function reset() {
      s.cur = -1;
      s.route = [];
      s.msg = '';
      draw();
    }
    function clickLand(i) {
      if (!s.route.length) {
        s.cur = i;
        s.msg = 'Старт: ' + KB.long[i] + '. Теперь щёлкайте по мостам.';
      } else s.msg = 'Чтобы перейти, щёлкните по мосту, который начинается там, где вы стоите.';
      draw();
    }
    function clickBridge(id) {
      const b = bridges()[id];
      if (s.cur < 0) s.msg = 'Сначала щёлкните по суше, откуда начнёте прогулку.';
      else if (s.route.includes(id)) s.msg = 'По этому мосту вы уже прошли.';
      else if (b.a !== s.cur && b.b !== s.cur) s.msg = 'Этот мост не начинается там, где вы стоите (' + KB.long[s.cur] + ').';
      else {
        s.route.push(id);
        s.cur = b.a === s.cur ? b.b : b.a;
        s.msg = '';
      }
      draw();
    }
    function draw() {
      const B = bridges();
      const deg = [0, 0, 0, 0];
      B.forEach((b) => (deg[b.a]++, deg[b.b]++));
      const odd = deg.filter((d) => d % 2).length;
      svg.textContent = '';
      const mapOp = s.view === 'graph' ? 0 : s.view === 'both' ? 0.55 : 1;
      if (mapOp > 0) {
        const g = S('g', { opacity: mapOp });
        g.appendChild(S('rect', { x: 0, y: 0, width: 600, height: 340, style: 'fill:' + tint('blue', 18) }));
        const land = 'fill:var(--surface-2);stroke:var(--border-strong);stroke-width:1.5';
        const lands = [
          S('rect', { x: 135, y: 140, width: 200, height: 70, rx: 32, style: land }),
          S('path', { d: 'M-10,-10H610V104Q450,112 300,104T-10,104Z', style: land }),
          S('path', { d: 'M-10,350H610V246Q450,238 300,246T-10,246Z', style: land }),
          S('rect', { x: 385, y: 140, width: 240, height: 70, rx: 32, style: land }),
        ];
        lands.forEach((L, i) => {
          L.style.cursor = 'pointer';
          L.addEventListener('click', () => clickLand(i));
          g.appendChild(L);
        });
        [[235, 202], [110, 30], [110, 312], [555, 200]].forEach(([x, y], i) => g.appendChild(sTxt(x, y, KB.long[i], { size: 13, color: 'ink2' })));
        B.forEach((b, id) => {
          const used = s.route.includes(id);
          const last = s.route[s.route.length - 1] === id;
          const r = S('rect', { x: b.r[0], y: b.r[1], width: b.r[2], height: b.r[3], rx: 4, style: 'cursor:pointer;fill:' + (used ? col(last ? 'tree' : 'model') : tint('yellow', 70)) + ';stroke:' + (used ? col(last ? 'tree' : 'model') : col('yellow')) + ';stroke-width:2' });
          r.addEventListener('click', () => clickBridge(id));
          g.appendChild(r);
        });
        svg.appendChild(g);
      }
      if (s.view !== 'map') {
        const nodes = KB.node.map(([x, y], i) => ({ x, y, r: 17, label: KB.names[i], fill: i === s.cur ? 'tree' : 'model', fillP: i === s.cur ? 60 : 25, color: i === s.cur ? 'tree' : 'model', width: i === s.cur ? 3 : 2, side: 'степень ' + deg[i], sideColor: deg[i] % 2 ? 'critical' : 'ink2', sideBold: true }));
        const tmp = new GraphView(H('div'), { w: 600, h: 340 });
        const edges = B.map((b, id) => ({ a: b.a, b: b.b, c: [2 * (b.r[0] + b.r[2] / 2) - (KB.node[b.a][0] + KB.node[b.b][0]) / 2, 2 * (b.r[1] + b.r[3] / 2) - (KB.node[b.a][1] + KB.node[b.b][1]) / 2], color: s.route.includes(id) ? (s.route[s.route.length - 1] === id ? 'tree' : 'model') : 'ink2', width: s.route.includes(id) ? 4 : 2.4, label: s.route.includes(id) ? String(s.route.indexOf(id) + 1) : '', lbold: true, lcolor: 'ink' }));
        const labels = [];
        edges.forEach((e, id) => {
          const p = tmp._edge(e, nodes, labels);
          p.style.cursor = 'pointer';
          const g = tmp._geom(e, nodes);
          const hit = S('path', { d: 'M' + g.sx + ',' + g.sy + 'Q' + g.cx + ',' + g.cy + ' ' + g.ex + ',' + g.ey, style: 'fill:none;stroke:transparent;stroke-width:16;cursor:pointer' });
          hit.addEventListener('click', () => clickBridge(id));
          svg.append(p, hit);
        });
        labels.forEach((l) => svg.appendChild(l));
        nodes.forEach((nd, i) => {
          const g = tmp._node(nd);
          g.style.cursor = 'pointer';
          g.addEventListener('click', () => clickLand(i));
          svg.appendChild(g);
        });
      }
      const avail = s.cur < 0 ? [] : B.map((b, id) => id).filter((id) => !s.route.includes(id) && (B[id].a === s.cur || B[id].b === s.cur));
      const done = s.route.length === B.length;
      const stuck = s.cur >= 0 && !avail.length && !done;
      const routeStr = s.cur < 0 ? '—' : [KB.names[s.route.length ? routeStart() : s.cur]].concat(s.route.map((id, k) => '(' + (k + 1) + ')→ ' + KB.names[landAfter(k)])).join(' ');
      line.textContent = 'Маршрут: ' + routeStr + (s.msg ? '\n' + s.msg : '') + (stuck ? '\nТупик! Все мосты отсюда пройдены. Не пройдены: ' + B.map((b, id) => id).filter((id) => !s.route.includes(id)).map((id) => KB.names[B[id].a] + '–' + KB.names[B[id].b]).join(', ') : '') + (done ? '\nПолучилось: все мосты пройдены ровно по разу!' : '');
      st.set('k', s.route.length + ' из ' + B.length);
      st.set('odd', String(odd));
      st.set('res', odd === 0 ? 'можно, и вернуться в начало' : odd === 2 ? 'можно, от нечётной к нечётной' : 'нельзя');
      note.innerHTML = s.eighth
        ? 'С восьмым мостом степени стали ' + deg.join(', ') + ': нечётных вершин две — ' + KB.names.filter((_, i) => deg[i] % 2).join(' и ') + '. Прогулка существует, но начинать надо с одной нечётной суши, а закончить на другой. Попробуйте начать с северного берега (B).'
        : 'Как ни старайтесь, хотя бы один мост останется непройденным. <b>Почему?</b> Каждый раз, проходя через сушу, вы тратите два моста: один — чтобы прийти, другой — чтобы уйти. Значит, у всех частей суши, кроме начала и конца, число мостов должно быть чётным. А здесь нечётно у всех четырёх: 5, 3, 3, 3. Обратите внимание: в рассуждении не участвуют ни форма островов, ни длина мостов — только <b>что с чем соединено</b>. Включите вид «граф»: суша стала точками, мосты — линиями.';
      function routeStart() {
        let c = s.cur;
        for (let k = s.route.length - 1; k >= 0; k--) c = B[s.route[k]].a === c ? B[s.route[k]].b : B[s.route[k]].a;
        return c;
      }
      function landAfter(k) {
        let c = routeStart();
        for (let t = 0; t <= k; t++) c = B[s.route[t]].a === c ? B[s.route[t]].b : B[s.route[t]].a;
        return c;
      }
    }
    w.pythonAction(() => 'bridges = ' + pyList(bridges().map((b) => [KB.names[b.a], KB.names[b.b]])) + '\ndeg = {}\nfor a, b in bridges:\n    deg[a] = deg.get(a, 0) + 1\n    deg[b] = deg.get(b, 0) + 1\nodd = [v for v, d in deg.items() if d % 2]\nprint("степени:", deg)\nprint("нечётных вершин:", len(odd), odd)\nprint("обход всех мостов", "существует" if len(odd) in (0, 2) else "невозможен")\n');
    reset();
  });

  /* ==============================================================================
   * 1. Граф как модель
   * ============================================================================== */
  const MODELS = {
    friends: {
      label: 'друзья', directed: false, weighted: false,
      v: 'человек', e: 'знакомство (взаимное)', q: 'Кто с кем может познакомиться через общих друзей? Есть ли «одиночки»? → обходы и компоненты (шаги 6, 9)',
      names: ['Аня', 'Боря', 'Вика', 'Гена', 'Даша', 'Егор', 'Женя'],
      pos: [[90, 70], [90, 210], [200, 140], [320, 140], [430, 70], [430, 210], [250, 260]],
      edges: [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [3, 5], [4, 5]],
    },
    metro: {
      label: 'метро', directed: false, weighted: true,
      v: 'станция', e: 'перегон, вес — минуты в пути', q: 'Как быстрее всего доехать с вокзала до завода? → кратчайшие пути, алгоритм Дейкстры (шаг 12)',
      names: ['Вокзал', 'Центр', 'Рынок', 'Парк', 'Порт', 'Завод'],
      pos: [[60, 150], [180, 150], [290, 70], [290, 230], [420, 70], [440, 230]],
      edges: [[0, 1, 4], [1, 2, 3], [1, 3, 5], [2, 3, 2], [2, 4, 6], [3, 5, 4], [4, 5, 3]],
    },
    links: {
      label: 'ссылки', directed: true, weighted: false,
      v: 'страница сайта', e: 'ссылка (направленная)', q: 'Какие страницы важнее? Куда «стекаются» посетители? → PageRank (шаг 31)',
      names: ['Главная', 'Новости', 'Статья', 'Автор', 'Архив'],
      pos: [[260, 50], [430, 130], [340, 250], [150, 250], [90, 120]],
      edges: [[0, 1], [0, 4], [1, 2], [2, 3], [3, 0], [4, 2], [2, 1]],
    },
    pipeline: {
      label: 'конвейер ML', directed: true, weighted: false,
      v: 'шаг обработки', e: '«сначала одно, потом другое» (зависимость)', q: 'В каком порядке запускать шаги? Что можно делать параллельно? → топологическая сортировка (шаг 22)',
      names: ['данные', 'очистка', 'признаки', 'разбиение', 'обучение', 'оценка'],
      pos: [[50, 150], [140, 150], [250, 75], [250, 225], [370, 150], [470, 150]],
      edges: [[0, 1], [1, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 5]],
    },
    tree: {
      label: 'дерево решений', directed: true, weighted: false, tree: true,
      v: 'вопрос (внутри) или ответ (лист)', e: 'ветка «да» / «нет»', q: 'Сколько вопросов нужно для ответа? Какое правило ведёт в лист? → деревья (шаги 15–19)',
      names: ['доход ≤ 50?', 'стаж ≤ 2?', 'долг ≤ 10?', 'отказ', 'одобрить', 'одобрить', 'отказ'],
      pos: [[260, 45], [140, 145], [380, 145], [70, 250], [205, 250], [315, 250], [450, 250]],
      edges: [[0, 1, 'да'], [0, 2, 'нет'], [1, 3, 'да'], [1, 4, 'нет'], [2, 5, 'да'], [2, 6, 'нет']],
    },
  };
  GBC.widget('graph-models', (el) => {
    const s = { m: 'friends', v: 0 };
    const w = ui.shell(el, { title: 'Граф как модель: что такое вершины и рёбра', sub: 'Пять задач из разных миров — один язык. Выберите задачу и щёлкните по вершине: увидите её соседей и степень.' });
    ui.segmented(w.controls, { label: 'Задача', value: s.m, options: Object.keys(MODELS).map((k) => ({ value: k, label: MODELS[k].label })), onChange: (v) => ((s.m = v), (s.v = 0), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 300, onNode: (i) => ((s.v = i), draw()) });
    const chips = flexRow('margin:2px 0 6px');
    const info = monoBox();
    w.main.append(chips, info);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 've', label: 'вершин / рёбер' }, { key: 'deg', label: 'степень выбранной' }, { key: 'kind', label: 'тип графа' }]);
    function draw() {
      const M = MODELS[s.m];
      const n = M.names.length;
      const E = M.edges;
      const adjU = adjList(n, E);
      const C = components(n, adjU);
      let cyclic;
      if (M.directed) {
        const indeg = new Array(n).fill(0);
        E.forEach((e) => indeg[e[1]]++);
        const q = U.range(n).filter((i) => !indeg[i]);
        let cnt = 0;
        for (let h = 0; h < q.length; h++) {
          cnt++;
          E.forEach((e) => e[0] === q[h] && --indeg[e[1]] === 0 && q.push(e[1]));
        }
        cyclic = cnt < n;
      } else cyclic = E.length - n + C.k > 0;
      const v = s.v;
      const outN = E.filter((e) => e[0] === v).map((e) => e[1]);
      const inN = E.filter((e) => e[1] === v).map((e) => e[0]);
      const nb = M.directed ? outN.concat(inN) : adjU[v];
      const isTree = M.tree;
      const nodes = M.names.map((nm, i) => ({
        x: M.pos[i][0], y: M.pos[i][1], r: 14, label: isTree ? '' : nm[0], shape: isTree && i >= 3 ? 'square' : undefined,
        sub: nm, subSize: 12.5, subBold: i === v, fill: i === v ? 'tree' : nb.includes(i) ? 'model' : null, fillP: i === v ? 55 : 30, color: i === v ? 'tree' : 'model', width: i === v ? 3 : 2,
      }));
      const edges = E.map((e) => {
        const hot = e[0] === v || e[1] === v;
        const both = M.directed && E.some((f) => f[0] === e[1] && f[1] === e[0]);
        return { a: e[0], b: e[1], arrow: M.directed, bend: both ? 16 : 0, color: hot ? 'tree' : 'ink2', width: hot ? 3 : 2, label: M.weighted ? String(e[2]) + ' мин' : isTree ? e[2] : '', lbold: hot };
      });
      gv.draw({ nodes, edges });
      chips.textContent = '';
      chips.append(badge(M.directed ? 'ориентированный' : 'неориентированный'), badge(M.weighted ? 'взвешенный' : 'без весов'), badge(cyclic ? 'есть циклы' : 'без циклов', cyclic ? 'warn' : 'good'), badge(C.k === 1 ? 'связный' : 'компонент: ' + C.k, C.k === 1 ? 'good' : 'warn'));
      if (isTree) chips.append(badge('дерево', 'good'));
      info.textContent = 'Вершина — ' + M.v + '. Ребро — ' + M.e + '.\n' + M.names[v] + ': ' + (M.directed ? 'выходят стрелки в ' + (outN.map((i) => M.names[i]).join(', ') || '—') + '; входят из ' + (inN.map((i) => M.names[i]).join(', ') || '—') : 'соседи — ' + (nb.map((i) => M.names[i]).join(', ') || 'нет (изолированная вершина)')) + '\nВопрос: ' + M.q;
      st.set('ve', n + ' / ' + E.length);
      st.set('deg', M.directed ? 'выход ' + outN.length + ', вход ' + inN.length : String(nb.length));
      st.set('kind', (M.directed ? 'орграф' : 'граф') + (M.weighted ? ', взвешенный' : ''));
      note.innerHTML = {
        friends: 'Знакомство взаимно, поэтому рёбра без стрелок. Женя пока ни с кем не знакома — <b>изолированная вершина</b>, граф распался на две компоненты. Вика и Гена — «мост» между двумя компаниями: уберите ребро Вика–Гена, и компаний станет три.',
        metro: 'Здесь важна не только связь, но и её «цена» — у рёбер есть <b>веса</b> (минуты). Путь Вокзал → Центр → Парк → Завод занимает 4 + 5 + 4 = 13 минут, а через Рынок и Порт — 4 + 3 + 6 + 3 = 16. Путь с наименьшим числом рёбер не обязан быть самым быстрым.',
        links: 'Ссылка ведёт в одну сторону — у рёбер есть <b>направление</b>. У вершины теперь две степени: <b>исходящая</b> (сколько ссылок на странице) и <b>входящая</b> (сколько страниц ссылаются на неё). Цикл Главная → Новости → Статья → Автор → Главная позволяет блуждать по сайту бесконечно.',
        pipeline: 'Стрелка «a → b» значит «b можно начать только после a». Такой граф обязан быть <b>без циклов</b> — иначе шаги ждали бы друг друга вечно. Это DAG (directed acyclic graph), и для него всегда есть порядок запуска.',
        tree: 'Дерево решений — тоже граф: связный, без циклов, у 7 вершин 6 рёбер. Внутренние вершины — вопросы, листья — ответы, а прогноз — <b>единственный путь</b> от корня к листу. Этот граф — главный герой всего курса.',
      }[s.m];
    }
    w.pythonAction(() => {
      const M = MODELS[s.m];
      const E = M.edges.map((e) => [M.names[e[0]], M.names[e[1]]].concat(M.weighted ? [e[2]] : []));
      return 'edges = ' + pyList(E) + '\ndirected = ' + (M.directed ? 'True' : 'False') + '\n\nadj = {v: [] for v in ' + pyList(M.names) + '}\nfor e in edges:\n    a, b = e[0], e[1]\n    adj[a].append(b)\n    if not directed:\n        adj[b].append(a)\nfor v, nb in adj.items():\n    print(f"{v:12} степень {len(nb)}:", ", ".join(nb) or "—")\nprint("вершин:", len(adj), " рёбер:", len(edges))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 2. Семейства графов и число рёбер
   * ============================================================================== */
  function zooGraph(fam, n, m) {
    const cx = 260;
    const cy = 145;
    let pos = [];
    let E = [];
    let tex = '';
    let name = '';
    if (fam === 'K') {
      pos = circlePos(n, cx, cy, 115);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) E.push([i, j]);
      name = 'K' + sub(n);
      tex = String.raw`|E(K_n)| = \binom{n}{2} = \frac{n(n-1)}{2}`;
    } else if (fam === 'C') {
      pos = circlePos(n, cx, cy, 115);
      E = U.range(n).map((i) => [i, (i + 1) % n]);
      name = 'C' + sub(n);
      tex = String.raw`|E(C_n)| = n`;
    } else if (fam === 'P') {
      pos = U.range(n).map((i) => [40 + (440 * i) / Math.max(1, n - 1), cy + (i % 2 ? 30 : -30)]);
      E = U.range(n - 1).map((i) => [i, i + 1]);
      name = 'P' + sub(n);
      tex = String.raw`|E(P_n)| = n - 1`;
    } else if (fam === 'star') {
      pos = [[cx, cy]].concat(circlePos(n, cx, cy, 115));
      E = U.range(n).map((i) => [0, i + 1]);
      name = 'K' + sub(1) + ',' + sub(n);
      tex = String.raw`|E(K_{1,n})| = n`;
    } else if (fam === 'Kmn') {
      pos = U.range(m).map((i) => [cx + (i - (m - 1) / 2) * Math.min(80, 440 / Math.max(1, m - 1 || 1)), 50]).concat(U.range(n).map((i) => [cx + (i - (n - 1) / 2) * Math.min(80, 440 / Math.max(1, n - 1 || 1)), 245]));
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) E.push([i, m + j]);
      name = 'K' + sub(m) + ',' + sub(n);
      tex = String.raw`|E(K_{m,n})| = m \cdot n`;
    } else if (fam === 'W') {
      pos = [[cx, cy]].concat(circlePos(n, cx, cy, 115));
      E = U.range(n).map((i) => [0, i + 1]).concat(U.range(n).map((i) => [i + 1, ((i + 1) % n) + 1]));
      name = 'W' + sub(n);
      tex = String.raw`|E(W_n)| = 2n`;
    } else if (fam === 'Q') {
      const V = [[150, 0], [0, 125], [62, -48], [215, 26]];
      const N = 1 << n;
      pos = U.range(N).map((b) => {
        let x = 0;
        let y = 0;
        for (let k = 0; k < n; k++) if (b & (1 << k)) (x += V[k][0]), (y += V[k][1]);
        return [x, y];
      });
      const xs = pos.map((p) => p[0]);
      const ys = pos.map((p) => p[1]);
      const ox = cx - (Math.min(...xs) + Math.max(...xs)) / 2;
      const oy = cy - (Math.min(...ys) + Math.max(...ys)) / 2;
      pos = pos.map(([x, y]) => [x + ox, y + oy]);
      for (let b = 0; b < N; b++) for (let k = 0; k < n; k++) if (!(b & (1 << k))) E.push([b, b | (1 << k)]);
      name = 'Q' + sub(n);
      tex = String.raw`|V(Q_d)| = 2^d, \quad |E(Q_d)| = d \cdot 2^{d-1}`;
    } else if (fam === 'grid') {
      const dx = Math.min(70, 440 / Math.max(1, n - 1));
      const dy = Math.min(60, 220 / Math.max(1, m - 1));
      for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) pos.push([cx + (c - (n - 1) / 2) * dx, cy + (r - (m - 1) / 2) * dy]);
      for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) {
        if (c + 1 < n) E.push([r * n + c, r * n + c + 1]);
        if (r + 1 < m) E.push([r * n + c, (r + 1) * n + c]);
      }
      name = 'решётка ' + m + '×' + n;
      tex = String.raw`|E| = m(n-1) + n(m-1)`;
    } else if (fam === 'bin') {
      const N = (1 << (n + 1)) - 1;
      const edges = U.range(N).filter((i) => i > 0).map((i) => [Math.floor((i - 1) / 2), i]);
      pos = treeLayout(N, edges, 0, 20, 500, 30, n ? 230 / n : 0).pos;
      E = edges;
      name = 'бинарное дерево глубины ' + n;
      tex = String.raw`|V| = 2^{d+1} - 1, \quad |E| = 2^{d+1} - 2, \quad \text{листьев } 2^d`;
    } else {
      pos = circlePos(5, cx, cy, 120).concat(circlePos(5, cx, cy, 55));
      E = U.range(5).map((i) => [i, (i + 1) % 5]).concat(U.range(5).map((i) => [i, i + 5])).concat(U.range(5).map((i) => [5 + i, 5 + ((i + 2) % 5)]));
      name = 'граф Петерсена';
      tex = String.raw`|V| = 10, \quad |E| = 15, \quad \text{все степени } 3`;
    }
    return { pos, E, tex, name };
  }
  function sub(k) {
    const SB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
    return String(k).split('').map((c) => SB[c] || c).join('');
  }
  const ZOO = {
    K: { label: 'полный Kₙ', n: [2, 10, 5] }, C: { label: 'цикл Cₙ', n: [3, 12, 6] }, P: { label: 'путь Pₙ', n: [2, 12, 6] }, star: { label: 'звезда', n: [2, 11, 6] },
    Kmn: { label: 'двудольный Kₘ,ₙ', n: [1, 6, 3], m: true }, W: { label: 'колесо', n: [3, 11, 6] }, Q: { label: 'гиперкуб', n: [1, 4, 3] },
    grid: { label: 'решётка', n: [2, 7, 4], m: true }, bin: { label: 'бинарное дерево', n: [0, 4, 3] }, pet: { label: 'Петерсен', n: [10, 10, 10] },
  };
  GBC.widget('graph-zoo', (el) => {
    const s = { fam: 'K', n: 5, m: 3 };
    const w = ui.shell(el, { title: 'Зоопарк графов: семейства и формулы для числа рёбер', sub: 'У часто встречающихся графов есть имена. Меняйте размер и следите, как растёт число рёбер — формула всегда выводится подсчётом степеней.' });
    ui.select(w.controls, { label: 'Семейство', value: s.fam, options: Object.keys(ZOO).map((k) => ({ value: k, label: ZOO[k].label })), onChange: (v) => {
      s.fam = v;
      const r = ZOO[v].n;
      s.n = r[2];
      ns.el.style.display = v === 'pet' ? 'none' : '';
      ms.el.style.display = ZOO[v].m ? '' : 'none';
      ns.el.querySelector('input').min = r[0];
      ns.el.querySelector('input').max = r[1];
      ns.set(s.n);
      draw();
    } });
    const ns = ui.slider(w.controls, { label: 'Размер n (для гиперкуба и дерева — d)', min: 2, max: 10, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const ms = ui.slider(w.controls, { label: 'Второй размер m', min: 1, max: 5, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ms.el.style.display = 'none';
    const gv = new GraphView(w.main, { w: 520, h: 290 });
    const fbox = H('div', { style: 'margin:0 0 4px' });
    w.main.appendChild(fbox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 've', label: 'вершин / рёбер' }, { key: 'deg', label: 'степени' }, { key: 'diam', label: 'диаметр' }, { key: 'bip', label: 'двудольный' }]);
    function draw() {
      const G = zooGraph(s.fam, s.n, s.m);
      const n = G.pos.length;
      const adj = adjList(n, G.E);
      const deg = adj.map((a) => a.length);
      const r = n > 24 ? 6 : n > 14 ? 9 : 13;
      const bp = bipartition(n, adj);
      gv.draw({
        nodes: G.pos.map(([x, y], i) => ({ x, y, r, label: n <= 16 ? String(deg[i]) : '', size: 11, fill: bp.ok ? (bp.color[i] ? 'orange' : 'blue') : 'model', fillP: 30, color: bp.ok ? (bp.color[i] ? 'orange' : 'blue') : 'model' })),
        edges: G.E.map((e) => ({ a: e[0], b: e[1], color: 'ink2', width: n > 24 ? 1.2 : 1.8, opacity: 0.85 })),
      });
      texInto(fbox, G.tex, true);
      const mn = Math.min(...deg);
      const mx = Math.max(...deg);
      const D = diameter(n, adj);
      st.set('ve', n + ' / ' + G.E.length);
      st.set('deg', mn === mx ? 'все ' + mn : mn + '…' + mx);
      st.set('diam', D === Infinity ? '∞' : String(D));
      st.set('bip', bp.ok ? 'да' : 'нет');
      const sumDeg = U.sum(deg);
      const TXT = {
        K: 'В <b>полном графе</b> каждая вершина соединена с каждой: степень n − 1, сумма степеней n(n − 1), рёбер вдвое меньше. Число рёбер растёт как n²/2 — при n = 1000 их почти полмиллиона. Это максимум для простого графа.',
        C: '<b>Цикл</b>: у каждой вершины ровно два соседа. Цикл чётной длины двудольный, нечётной — нет (проверьте n = 5 и 6).',
        P: '<b>Путь</b> — дерево без ветвлений: два конца степени 1, остальные степени 2. Диаметр n − 1 — самый «длинный» связный граф на n вершинах.',
        star: '<b>Звезда</b> — дерево с центром-хабом: n рёбер, диаметр 2. Двудольная: центр в одной доле, листья в другой. Так выглядит пользователь, переводящий деньги многим счетам.',
        Kmn: '<b>Полный двудольный граф</b>: каждая вершина верхней доли соединена с каждой нижней, внутри долей рёбер нет. m·n рёбер; K' + sub(3) + ',' + sub(3) + ' — знаменитый непланарный граф «три дома и три колодца».',
        W: '<b>Колесо</b>: цикл плюс центр. Спицы дают n рёбер, обод ещё n — всего 2n. Центр соединён со всеми, поэтому диаметр 2 (при n ≥ 4).',
        Q: '<b>Гиперкуб</b> Q<sub>d</sub>: вершины — двоичные строки длины d, ребро — строки отличаются в одном бите. Степень d, вершин 2<sup>d</sup>, рёбер d·2<sup>d−1</sup>, диаметр d. Двудолен: доли — строки с чётным и нечётным числом единиц.',
        grid: '<b>Решётка</b>: горизонтальных рёбер m(n − 1), вертикальных n(m − 1). Двудольна, как шахматная доска. На решётке ищут пути в лабиринтах (шаг 11), а пиксели изображения — тоже решётка.',
        bin: '<b>Полное бинарное дерево</b> глубины d: у каждой внутренней вершины два ребёнка. 2<sup>d</sup> листьев, 2<sup>d+1</sup> − 1 вершин и на одно ребро меньше. Это каркас дерева решений глубины d.',
        pet: '<b>Граф Петерсена</b> — любимый контрпример теории графов: 10 вершин, все степени 3, диаметр 2, нет циклов короче 5 и нет гамильтонова цикла.',
      };
      note.innerHTML = TXT[s.fam] + ' Сумма степеней ' + sumDeg + ' = 2·' + G.E.length + ' — лемма о рукопожатиях (шаг 3). ' + (bp.ok ? 'Цвета вершин — две доли: рёбра идут только между цветами.' : 'Граф не двудольный — в нём есть цикл нечётной длины.');
    }
    w.pythonAction(() => {
      const G = zooGraph(s.fam, s.n, s.m);
      return 'edges = ' + pyList(G.E) + '\nn = ' + G.pos.length + '\n\ndeg = [0] * n\nfor a, b in edges:\n    deg[a] += 1\n    deg[b] += 1\nprint("' + G.name + ': вершин", n, "рёбер", len(edges))\nprint("степени:", sorted(set(deg)), " сумма степеней:", sum(deg), "= 2 *", len(edges))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 3. Степенные последовательности: лемма о рукопожатиях и алгоритм Гавела — Хакими
   * ============================================================================== */
  function havelHakimi(seq) {
    const n = seq.length;
    const steps = [];
    const res = seq.slice();
    const edges = [];
    if (U.sum(seq) % 2) return { ok: false, why: 'parity', steps, edges };
    if (seq.some((d) => d < 0 || d > n - 1)) return { ok: false, why: 'range', steps, edges };
    for (;;) {
      const order = U.range(n).filter((i) => res[i] > 0).sort((a, b) => res[b] - res[a] || a - b);
      if (!order.length) return { ok: true, steps, edges };
      const v = order[0];
      const d = res[v];
      const others = U.range(n).filter((i) => i !== v && res[i] > 0).sort((a, b) => res[b] - res[a] || a - b);
      if (others.length < d) {
        steps.push({ v, d, targets: others.slice(), before: res.slice(), fail: true });
        return { ok: false, why: 'hh', steps, edges };
      }
      const targets = others.slice(0, d);
      const before = res.slice();
      res[v] = 0;
      targets.forEach((u) => (res[u]--, edges.push([v, u])));
      steps.push({ v, d, targets, before, after: res.slice() });
    }
  }
  const HH_PRESETS = ['3 3 3 3', '4 3 3 2 2', '3 3 2 2 2 2', '3 3 3 1', '4 4 4 1 1', '2 2 2 2 2 1', '5 5 4 3 2 2 2 1', '6 5 5 4 3 3 2 2 2'];
  GBC.widget('degree-sequence', (el) => {
    const s = { seq: [4, 3, 3, 2, 2], k: 0 };
    const w = ui.shell(el, { title: 'Бывает ли граф с такими степенями? Алгоритм Гавела — Хакими', sub: 'Задайте степени вершин. Сначала проверяется чётность суммы (лемма о рукопожатиях), затем алгоритм пробует построить граф: соединяет вершину с наибольшей степенью с самыми «голодными» соседями.' });
    const inp = H('input', { type: 'text', value: s.seq.join(' '), 'aria-label': 'Степени через пробел', style: 'width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-strong);border-radius:8px;background:var(--surface);color:var(--ink);font-family:var(--font-mono)' });
    w.controls.appendChild(H('div', { class: 'ctl' }, H('label', { class: 'ctl-label' }, 'Степени через пробел (до 9 вершин)'), inp));
    inp.addEventListener('change', () => setSeq(inp.value));
    const pre = ui.select(w.controls, { label: 'Готовые примеры', value: s.seq.join(' '), options: HH_PRESETS.map((p) => ({ value: p, label: p })), onChange: (v) => setSeq(v) });
    const pl = ui.player(w.controls, { label: 'Шаг алгоритма', min: 0, max: 1, value: 0, fps: 1, format: (k, m) => 'шаг ' + k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 290 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sum', label: 'сумма степеней' }, { key: 'edges', label: 'рёбер нужно' }, { key: 'res', label: 'вывод' }]);
    function setSeq(txt) {
      const a = String(txt).trim().split(/[\s,;]+/).map((t) => parseInt(t, 10)).filter((v) => Number.isFinite(v)).slice(0, 9);
      s.seq = a.length ? a : [0];
      inp.value = s.seq.join(' ');
      pre.set(HH_PRESETS.includes(inp.value) ? inp.value : '');
      const R = havelHakimi(s.seq);
      pl.stop();
      pl.setMax(R.steps.length);
      pl.set(R.steps.length);
      s.k = R.steps.length;
      draw();
    }
    function draw() {
      const seq = s.seq;
      const n = seq.length;
      const R = havelHakimi(seq);
      const k = Math.min(s.k, R.steps.length);
      const pos = circlePos(n, 260, 145, 110);
      const cur = k > 0 ? R.steps[k - 1] : null;
      const builtE = R.edges.slice(0, R.steps.slice(0, k).reduce((acc, stp) => acc + (stp.fail ? 0 : stp.targets.length), 0));
      const resNow = cur ? (cur.after || cur.before) : seq;
      gv.draw({
        nodes: pos.map(([x, y], i) => ({ x, y, r: 16, label: String(seq[i]), fill: cur && i === cur.v ? 'tree' : cur && cur.targets.includes(i) ? 'model' : null, fillP: 40, color: cur && i === cur.v ? 'tree' : 'model', width: cur && i === cur.v ? 3 : 2, sub: 'осталось ' + resNow[i], subColor: resNow[i] ? 'ink2' : 'muted' })),
        edges: builtE.map((e, idx) => ({ a: e[0], b: e[1], color: cur && !cur.fail && idx >= builtE.length - cur.targets.length ? 'tree' : 'model', width: 2.6 })),
      });
      const sum = U.sum(seq);
      const lines = ['Последовательность: ' + seq.join(', ') + '   (сумма ' + sum + (sum % 2 ? ' — нечётная!' : ' = 2·' + sum / 2) + ')'];
      if (R.why === 'parity') lines.push('Сумма степеней нечётна, а по лемме о рукопожатиях она равна 2|E|. Такого графа нет — дальше можно не проверять.');
      else if (R.why === 'range') lines.push('Степень не может превышать n − 1 = ' + (n - 1) + ' (простой граф: без петель и кратных рёбер).');
      R.steps.slice(0, k).forEach((stp, i) => lines.push((i + 1) + ') ' + (stp.fail ? 'вершине ' + (stp.v + 1) + ' нужно ' + stp.d + ' соседей, а «голодных» осталось ' + stp.targets.length + ' — тупик' : 'вершина ' + (stp.v + 1) + ' (степень ' + stp.d + ') ↔ ' + stp.targets.map((u) => u + 1).join(', ') + ';  остаток: ' + stp.after.join(' '))));
      line.textContent = lines.join('\n');
      st.set('sum', String(sum));
      st.set('edges', sum % 2 ? '—' : String(sum / 2));
      st.set('res', R.ok ? (k === R.steps.length ? 'граф построен' : 'строим…') : R.why === 'parity' ? 'нет: нечётная сумма' : R.why === 'range' ? 'нет: степень > n − 1' : k === R.steps.length ? 'нет: тупик' : 'строим…');
      note.innerHTML = R.why === 'parity'
        ? '<b>Лемма о рукопожатиях:</b> каждое ребро добавляет единицу к степеням двух вершин, поэтому сумма степеней всегда чётна — она равна удвоенному числу рёбер. Следствие: вершин нечётной степени всегда чётное число.'
        : R.ok
          ? 'Последовательность <b>графическая</b>: граф построен (числа в кружках — нужные степени, под кружком — сколько ещё не хватает). Алгоритм Гавела — Хакими жадный, но не ошибается: можно доказать, что если граф существует, то существует и такой, где вершина наибольшей степени соединена с вершинами следующих по величине степеней.'
          : 'Чётности мало! Сумма чётна, но граф построить нельзя: в какой-то момент вершине нужно больше соседей, чем осталось вершин с ненулевым запасом. Например, у «4 4 4 1 1» три вершины степени 4 должны быть связаны со всеми остальными, но тогда у вершин степени 1 было бы хотя бы по 3 соседа.';
    }
    w.pythonAction(() => 'def havel_hakimi(seq):\n    res = list(seq)\n    if sum(res) % 2:\n        return None                       # лемма о рукопожатиях\n    n, edges = len(res), []\n    while True:\n        order = sorted((i for i in range(n) if res[i] > 0), key=lambda i: (-res[i], i))\n        if not order:\n            return edges\n        v, d = order[0], res[order[0]]\n        others = order[1:]\n        if len(others) < d:\n            return None\n        res[v] = 0\n        for u in others[:d]:\n            res[u] -= 1\n            edges.append((v + 1, u + 1))\n\nseq = ' + pyList(s.seq) + '\nedges = havel_hakimi(seq)\nprint("сумма степеней:", sum(seq))\nprint("граф существует, рёбра:" if edges is not None else "графа нет", edges or "")\n');
    setSeq(s.seq.join(' '));
  });

  /* ==============================================================================
   * 4. Как хранить граф: матрица смежности, списки соседей, список рёбер, CSR
   * ============================================================================== */
  GBC.widget('graph-repr', (el) => {
    const n = 7;
    const NM = 'ABCDEFG';
    const s = { p: 0.4, seed: 2, v: 0, dir: false, fmt: 'matrix', N: 6, avg: 10 };
    const pos = circlePos(n, 260, 140, 112);
    const w = ui.shell(el, { title: 'Матрица смежности, списки соседей, список рёбер, CSR', sub: 'Один и тот же граф в четырёх форматах. Щёлкните по вершине: её строка в матрице — это её список соседей.' });
    ui.slider(w.controls, { label: 'Вероятность ребра', min: 0.1, max: 0.9, step: 0.05, value: s.p, onInput: (v) => ((s.p = v), draw()) });
    ui.toggle(w.controls, { label: 'Ориентированный граф', checked: s.dir, onChange: (v) => ((s.dir = v), draw()) });
    ui.button(w.controls, { label: 'Новый граф', icon: 'reset', onClick: () => (s.seed++, draw()) });
    ui.segmented(w.controls, { label: 'Формат', value: s.fmt, options: [{ value: 'matrix', label: 'матрица' }, { value: 'lists', label: 'списки' }, { value: 'edges', label: 'рёбра' }, { value: 'csr', label: 'CSR' }], onChange: (v) => ((s.fmt = v), draw()) });
    ui.slider(w.controls, { label: 'Оценка памяти: вершин', values: [3, 4, 5, 6, 7, 8, 9], value: s.N, format: (v) => '10' + sup(v), onInput: (v) => ((s.N = v), draw()) });
    ui.slider(w.controls, { label: 'Средняя степень', values: [2, 5, 10, 50, 200], value: s.avg, format: String, onInput: (v) => ((s.avg = v), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 280, onNode: (i) => ((s.v = i), draw()) });
    const view = H('div');
    const mem = monoBox();
    w.main.append(view, mem);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'рёбер |E|' }, { key: 'deg', label: 'сумма степеней' }, { key: 'dens', label: 'плотность' }]);
    function build() {
      const rng = new GBC.RNG(s.seed);
      const A = U.range(n).map(() => new Array(n).fill(0));
      const E = [];
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const r = rng.random();
          const flip = rng.random() < 0.5;
          if (r < s.p) {
            const [a, b] = s.dir && flip ? [j, i] : [i, j];
            A[a][b] = 1;
            if (!s.dir) A[b][a] = 1;
            E.push([a, b]);
          }
        }
      }
      return { A, E };
    }
    function draw() {
      const { A, E } = build();
      const nb = (i) => U.range(n).filter((j) => A[i][j]);
      const v = s.v;
      const hot = (e) => e[0] === v || (!s.dir && e[1] === v);
      gv.draw({
        nodes: pos.map(([x, y], i) => ({ x, y, label: NM[i], fill: i === v ? 'tree' : nb(v).includes(i) ? 'model' : null, fillP: i === v ? 55 : 30, color: i === v ? 'tree' : 'model', width: i === v ? 3 : 2 })),
        edges: E.map((e) => ({ a: e[0], b: e[1], arrow: s.dir, color: hot(e) ? 'tree' : 'ink2', width: hot(e) ? 3 : 1.8 })),
      });
      view.textContent = '';
      if (s.fmt === 'matrix') {
        cellTable(view, [''].concat(NM.split('')), U.range(n).map((i) => [NM[i]].concat(A[i].map((x, j) => ({ t: x, hl: i === v ? (x ? 'tree' : 'muted') : null, bold: x === 1 })))), { compact: true });
      } else {
        const box = monoBox();
        if (s.fmt === 'lists') box.textContent = U.range(n).map((i) => (i === v ? '▶ ' : '  ') + NM[i] + ': [' + nb(i).map((j) => NM[j]).join(', ') + ']').join('\n');
        else if (s.fmt === 'edges') box.textContent = 'Список рёбер (' + E.length + '):\n' + E.map((e) => '(' + NM[e[0]] + ', ' + NM[e[1]] + ')').join(' ') + '\nНужно проверить ребро — придётся просмотреть весь список.';
        else {
          const indptr = [0];
          const idx = [];
          U.range(n).forEach((i) => (nb(i).forEach((j) => idx.push(j)), indptr.push(idx.length)));
          box.textContent = 'indptr  = [' + indptr.join(', ') + ']\nindices = [' + idx.join(', ') + ']\nСоседи ' + NM[v] + ' = indices[' + indptr[v] + ':' + indptr[v + 1] + '] = [' + idx.slice(indptr[v], indptr[v + 1]).join(', ') + '] → ' + (idx.slice(indptr[v], indptr[v + 1]).map((j) => NM[j]).join(', ') || '—');
        }
        view.appendChild(box);
      }
      const N = Math.pow(10, s.N);
      const m = (N * s.avg) / 2;
      const matBytes = (N * N) / 8;
      const csrBytes = 8 * (N + 1) + 4 * (s.dir ? m : 2 * m);
      const human = (b) => (b >= 1e12 ? f1(b / 1e12) + ' ТБ' : b >= 1e9 ? f1(b / 1e9) + ' ГБ' : b >= 1e6 ? f1(b / 1e6) + ' МБ' : b >= 1e3 ? f1(b / 1e3) + ' КБ' : Math.round(b) + ' Б');
      mem.textContent = 'Граф на 10' + sup(s.N) + ' вершин со средней степенью ' + s.avg + ':\n  матрица смежности (1 бит на ячейку): ' + human(matBytes) + '\n  CSR (8 байт на указатель, 4 на номер соседа): ' + human(csrBytes) + '   — в ' + num(Math.round(matBytes / csrBytes)) + ' раз меньше';
      const sumDeg = U.sum(A.map((r) => U.sum(r)));
      st.set('e', String(E.length));
      st.set('deg', s.dir ? 'исходящих: ' + sumDeg + ' = |E|' : sumDeg + ' = 2·' + E.length);
      st.set('dens', f3(E.length / (s.dir ? n * (n - 1) : (n * (n - 1)) / 2)));
      note.innerHTML = {
        matrix: '<b>Матрица смежности</b>: A<sub>ij</sub> = 1, если есть ребро i → j. n² ячеек, зато «есть ли ребро?» — одно обращение. ' + (s.dir ? 'Для орграфа она несимметрична.' : 'У неориентированного графа симметрична: каждое ребро записано дважды.') + ' Удобна для линейной алгебры (шаги 30–34).',
        lists: '<b>Списки соседей</b>: для каждой вершины — только существующие рёбра, n + |E| памяти' + (s.dir ? '' : ' (каждое ребро — в двух списках)') + '. Перебор соседей идёт ровно по ним — поэтому обходы работают за O(|V| + |E|).',
        edges: '<b>Список рёбер</b> — самый компактный формат (|E| пар) и естественный для файлов и баз данных: «счёт-отправитель, счёт-получатель». Алгоритм Краскала (шаг 20) начинает именно с него, сортируя рёбра по весу.',
        csr: '<b>CSR</b> (compressed sparse row) — списки соседей, склеенные в один массив indices, плюс массив indptr с границами. Это формат scipy.sparse и основа быстрых графовых библиотек: данные лежат подряд в памяти.',
      }[s.fmt];
    }
    w.pythonAction(() => {
      const { E } = build();
      return 'import numpy as np\nfrom scipy.sparse import csr_matrix\n\nnames = "ABCDEFG"\nedges = ' + pyList(E) + '\ndirected = ' + (s.dir ? 'True' : 'False') + '\nn = 7\n\nA = np.zeros((n, n), dtype=int)\nfor a, b in edges:\n    A[a, b] = 1\n    if not directed:\n        A[b, a] = 1\nprint(A)\nlists = {names[i]: [names[j] for j in np.flatnonzero(A[i])] for i in range(n)}\nprint(lists)\nM = csr_matrix(A)\nprint("indptr :", M.indptr)\nprint("indices:", M.indices)\nprint("сумма степеней:", A.sum(), " рёбер:", len(edges))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 5. Изоморфизм и инварианты
   * ============================================================================== */
  function isoSearch(n, adj1, adj2, limit = 5000) {
    if (adj2.length !== n) return { first: null, count: 0 };
    const S1 = adj1.map((a) => new Set(a));
    const S2 = adj2.map((a) => new Set(a));
    const order = [];
    const seen = new Array(n).fill(false);
    for (let s0 = 0; s0 < n; s0++) {
      if (seen[s0]) continue;
      seen[s0] = true;
      const q = [s0];
      for (let h = 0; h < q.length; h++) {
        order.push(q[h]);
        for (const u of adj1[q[h]]) if (!seen[u]) (seen[u] = true), q.push(u);
      }
    }
    const map = new Array(n).fill(-1);
    const used = new Array(n).fill(false);
    let count = 0;
    let first = null;
    (function rec(k) {
      if (count >= limit) return;
      if (k === n) {
        count++;
        if (!first) first = map.slice();
        return;
      }
      const v = order[k];
      for (let u = 0; u < n; u++) {
        if (used[u] || S2[u].size !== S1[v].size) continue;
        let ok = true;
        for (let t = 0; t < k; t++) {
          const x = order[t];
          if (S1[v].has(x) !== S2[u].has(map[x])) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        map[v] = u;
        used[u] = true;
        rec(k + 1);
        used[u] = false;
        map[v] = -1;
      }
    })(0);
    return { first, count };
  }
  const ISO = (() => {
    const L = (pos, dx) => pos.map(([x, y]) => [x + dx, y]);
    const petA = circlePos(5, 130, 140, 100).concat(circlePos(5, 130, 140, 46));
    const petEA = U.range(5).map((i) => [i, (i + 1) % 5]).concat(U.range(5).map((i) => [i, i + 5])).concat(U.range(5).map((i) => [5 + i, 5 + ((i + 2) % 5)]));
    const subsets = [];
    for (let a = 1; a <= 5; a++) for (let b = a + 1; b <= 5; b++) subsets.push([a, b]);
    const center = subsets.findIndex((p) => p[0] === 4 && p[1] === 5);
    const mids = [[1, 2], [1, 3], [2, 3]].map((p) => subsets.findIndex((q) => q[0] === p[0] && q[1] === p[1]));
    const posB = new Array(10);
    posB[center] = [130, 145];
    const angs = [-90, 30, 150];
    mids.forEach((m, k) => (posB[m] = [130 + 52 * Math.cos((angs[k] * Math.PI) / 180), 145 + 52 * Math.sin((angs[k] * Math.PI) / 180)]));
    mids.forEach((m, k) => {
      const outs = subsets.map((p, i) => i).filter((i) => i !== center && !mids.includes(i) && subsets[i].every((x) => !subsets[m].includes(x)));
      outs.forEach((o, t) => (posB[o] = [130 + 112 * Math.cos(((angs[k] + (t ? 26 : -26)) * Math.PI) / 180), 145 + 112 * Math.sin(((angs[k] + (t ? 26 : -26)) * Math.PI) / 180)]));
    });
    const petEB = [];
    for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) if (subsets[i].every((x) => !subsets[j].includes(x))) petEB.push([i, j]);
    const cubeA = [[60, 60], [200, 60], [200, 220], [60, 220], [100, 100], [160, 100], [160, 180], [100, 180]];
    const cubeEA = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const cubeB = circlePos(8, 130, 140, 105, -Math.PI / 2 + Math.PI / 8);
    const cubeEB = U.range(8).map((i) => [i, (i + 1) % 8]).concat([[0, 3], [1, 6], [2, 5], [4, 7]]);
    const hexA = circlePos(6, 130, 140, 100);
    const hexE = U.range(6).map((i) => [i, (i + 1) % 6]);
    const triB = circlePos(3, 130, 85, 55).concat(circlePos(3, 130, 210, 55, Math.PI / 2));
    const triE = [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3]];
    const k33A = [[40, 60], [130, 60], [220, 60], [40, 220], [130, 220], [220, 220]];
    const k33E = [[0, 3], [0, 4], [0, 5], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5]];
    const prB = circlePos(3, 130, 145, 105).concat(circlePos(3, 130, 145, 45));
    const prE = [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [0, 3], [1, 4], [2, 5]];
    return {
      cube: { label: 'куб двумя способами', A: { pos: cubeA, E: cubeEA }, B: { pos: L(cubeB, 260), E: cubeEB } },
      pet: { label: 'граф Петерсена', A: { pos: petA, E: petEA }, B: { pos: L(posB, 260), E: petEB } },
      hex: { label: 'C₆ и два треугольника', A: { pos: hexA, E: hexE }, B: { pos: L(triB, 260), E: triE } },
      k33: { label: 'K₃,₃ и призма', A: { pos: k33A, E: k33E }, B: { pos: L(prB, 260), E: prE } },
    };
  })();
  function invariants(n, E) {
    const adj = adjList(n, E);
    const deg = adj.map((a) => a.length).sort((a, b) => b - a);
    return {
      n, m: E.length, deg: deg.join(' '), comp: components(n, adj).k, tri: triangles(n, adj), bip: bipartition(n, adj).ok ? 'да' : 'нет',
      girth: girth(n, adj), diam: diameter(n, adj),
    };
  }
  GBC.widget('isomorphism', (el) => {
    const s = { pair: 'cube', t: 0 };
    const w = ui.shell(el, { title: 'Один граф — разные рисунки: изоморфизм и инварианты', sub: 'Слева и справа нарисованы графы. Это один и тот же граф (изоморфизм) или разные? Сравните инварианты, а затем нажмите ▶ — если соответствие вершин найдено, правый граф «переедет» на левый.' });
    ui.segmented(w.controls, { label: 'Пара графов', value: s.pair, options: Object.keys(ISO).map((k) => ({ value: k, label: ISO[k].label })), onChange: (v) => ((s.pair = v), pl.stop(), pl.set(0), (s.t = 0), draw()) });
    const pl = ui.player(w.controls, { label: 'Наложение', min: 0, max: 20, value: 0, fps: 12, format: (k) => Math.round((100 * k) / 20) + ' %', onChange: (k) => ((s.t = k), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 280 });
    const tbl = H('div');
    const line = monoBox();
    w.main.append(tbl, line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'iso', label: 'изоморфны?' }, { key: 'aut', label: 'число изоморфизмов' }, { key: 'diff', label: 'различающий инвариант' }]);
    const cache = {};
    function solve(key) {
      if (cache[key]) return cache[key];
      const P = ISO[key];
      const n = P.A.pos.length;
      const R = isoSearch(n, adjList(n, P.A.E), adjList(P.B.pos.length, P.B.E));
      return (cache[key] = R);
    }
    function draw() {
      const P = ISO[s.pair];
      const n = P.A.pos.length;
      const R = solve(s.pair);
      const iA = invariants(n, P.A.E);
      const iB = invariants(P.B.pos.length, P.B.E);
      const t = R.first ? s.t / 20 : 0;
      const ease = t * t * (3 - 2 * t);
      const inv = new Array(n);
      if (R.first) R.first.forEach((u, v) => (inv[u] = v));
      const posB = P.B.pos.map(([x, y], u) => (R.first ? [x + (P.A.pos[inv[u]][0] - x) * ease, y + (P.A.pos[inv[u]][1] - y) * ease] : [x, y]));
      const nodesA = P.A.pos.map(([x, y], i) => ({ x, y, r: 13, label: String(i + 1), color: 'model', fill: 'model', fillP: 18, dim: t > 0.98 }));
      const nodesB = posB.map(([x, y], u) => ({ x, y, r: 13, label: 'abcdefghij'[u], color: 'tree', fill: 'tree', fillP: 24 }));
      const nodes = nodesA.concat(nodesB);
      const edges = P.A.E.map((e) => ({ a: e[0], b: e[1], color: 'model', width: 2, opacity: 0.6 })).concat(P.B.E.map((e) => ({ a: n + e[0], b: n + e[1], color: 'tree', width: 2.2, opacity: 0.9 })));
      gv.draw({ nodes, edges, under: [S('line', { x1: 260, y1: 10, x2: 260, y2: 270, style: 'stroke:var(--border-strong);stroke-dasharray:4 4;opacity:' + (1 - ease) })] });
      const rows = [['вершин', iA.n, iB.n], ['рёбер', iA.m, iB.m], ['степени', iA.deg, iB.deg], ['компонент', iA.comp, iB.comp], ['треугольников', iA.tri, iB.tri], ['двудольный', iA.bip, iB.bip], ['обхват (кратчайший цикл)', dstr(iA.girth), dstr(iB.girth)], ['диаметр', dstr(iA.diam), dstr(iB.diam)]];
      const diff = rows.find((r) => String(r[1]) !== String(r[2]));
      cellTable(tbl, ['инвариант', 'левый (1, 2, …)', 'правый (a, b, …)'], rows.map((r) => [r[0], { t: r[1], hl: String(r[1]) !== String(r[2]) ? 'red' : null }, { t: r[2], hl: String(r[1]) !== String(r[2]) ? 'red' : null }]), { compact: true });
      line.textContent = R.first ? 'Соответствие: ' + R.first.map((u, v) => (v + 1) + '→' + 'abcdefghij'[u]).join('  ') : 'Соответствия нет: перебор с отсечениями не нашёл ни одной подходящей нумерации.';
      st.set('iso', R.first ? 'да' : 'нет');
      st.set('aut', R.first ? String(R.count) : '0');
      st.set('diff', diff ? diff[0] : 'все совпадают');
      note.innerHTML = {
        cube: 'Справа — восьмиугольник с четырьмя хордами, слева — привычный куб. Инварианты совпадают, и перебор находит нумерацию, при которой рёбра переходят в рёбра: это <b>один и тот же граф</b> Q<sub>3</sub>. Таких нумераций ' + R.count + ' — столько у куба <b>симметрий</b> (автоморфизмов): 8 вершин, куда отправить первую, × 3 соседа × 2.',
        pet: 'Петерсен «звездой» и Петерсен с осью симметрии третьего порядка. Рисунки совсем не похожи, но граф один. Количество изоморфизмов ' + R.count + ' = 5! — симметрии Петерсена соответствуют перестановкам пяти чисел (вершины — пары чисел из 1…5, рёбра — непересекающиеся пары).',
        hex: 'Шесть вершин, шесть рёбер, все степени 2 — степени совпадают, но графы <b>разные</b>: шестиугольник связен, а два треугольника — нет. Совпадение одного инварианта ничего не доказывает; различие любого — доказывает неизоморфность.',
        k33: 'Самый коварный случай: связные, 6 вершин, 9 рёбер, все степени 3, даже диаметр 2. Различают их <b>треугольники</b>: в призме их два, в K<sub>3,3</sub> — ни одного (он двудольный). Простого полного набора инвариантов не известно; проверка изоморфизма в общем случае — открытая задача сложности (лучший алгоритм Бабаи — квазиполиномиальный).',
      }[s.pair];
    }
    w.pythonAction(() => {
      const P = ISO[s.pair];
      return 'EA = ' + pyList(P.A.E) + '\nEB = ' + pyList(P.B.E) + '\nn = ' + P.A.pos.length + '\n\ndef adj(E):\n    S = [set() for _ in range(n)]\n    for a, b in E:\n        S[a].add(b)\n        S[b].add(a)\n    return S\n\nSA, SB = adj(EA), adj(EB)\nprint("степени:", sorted(map(len, SA), reverse=True), sorted(map(len, SB), reverse=True))\n\n# перебор с отсечениями: вершине v сопоставляем u той же степени,\n# если смежность с уже сопоставленными вершинами сохраняется\nisos, phi = [], {}\n\ndef search(v):\n    if v == n:\n        isos.append(dict(phi))\n        return\n    for u in range(n):\n        if u in phi.values() or len(SB[u]) != len(SA[v]):\n            continue\n        if all((w in SA[v]) == (phi[w] in SB[u]) for w in phi):\n            phi[v] = u\n            search(v + 1)\n            del phi[v]\n\nsearch(0)\nprint("изоморфизмов найдено:", len(isos))\nif isos:\n    print("пример:", {v + 1: "abcdefghij"[u] for v, u in isos[0].items()})\n';
    });
    draw();
  });

  /* ==============================================================================
   * 6. Конструктор графа: компоненты, циклы, двудольность, эйлеровы обходы
   * ============================================================================== */
  const BUILD_PRESETS = {
    tree: { label: 'дерево', V: [[260, 40], [140, 125], [380, 125], [70, 230], [200, 230], [320, 230], [450, 230]], E: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]] },
    c5: { label: 'цикл C₅', V: circlePos(5, 260, 145, 110), E: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] },
    k33: { label: 'K₃,₃', V: [[110, 55], [260, 55], [410, 55], [110, 235], [260, 235], [410, 235]], E: [[0, 3], [0, 4], [0, 5], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5]] },
    two: { label: 'два треугольника', V: [[70, 80], [180, 70], [120, 200], [330, 80], [450, 90], [400, 210], [260, 260]], E: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3]] },
  };
  function analyse(n, E) {
    const adj = adjList(n, E);
    const C = components(n, adj);
    const bp = bipartition(n, adj);
    const deg = adj.map((a) => a.length);
    const odd = deg.filter((d) => d % 2).length;
    const active = U.range(n).filter((i) => deg[i] > 0);
    const oneComp = active.every((i) => C.comp[i] === C.comp[active[0]]);
    return { adj, comp: C.comp, nComp: C.k, bip: bp.ok, color: bp.color, deg, odd, euler: !active.length || !oneComp ? 'нет' : odd === 0 ? 'цикл' : odd === 2 ? 'путь' : 'нет', cyc: E.length - n + C.k, diam: n ? diameter(n, adj) : 0 };
  }
  GBC.widget('graph-builder', (el) => {
    const s = { V: [], E: [], sel: -1, view: 'comp' };
    const w = ui.shell(el, { title: 'Конструктор графа', sub: 'Щёлкните по пустому месту — появится вершина; по двум вершинам подряд — добавится или исчезнет ребро. Свойства пересчитываются после каждого щелчка.' });
    ui.segmented(w.controls, { label: 'Раскраска', value: s.view, options: [{ value: 'comp', label: 'компоненты' }, { value: 'bip', label: 'две доли' }], onChange: (v) => ((s.view = v), draw()) });
    const load = (k) => ((s.V = BUILD_PRESETS[k].V.map((p) => p.slice())), (s.E = BUILD_PRESETS[k].E.map((e) => e.slice())), (s.sel = -1), draw());
    const presets = flexRow();
    Object.keys(BUILD_PRESETS).forEach((k) => ui.button(presets, { label: BUILD_PRESETS[k].label, small: true, onClick: () => load(k) }));
    w.controls.appendChild(presets);
    ui.button(w.controls, { label: 'Удалить выбранную вершину', onClick: () => {
      if (s.sel < 0) return;
      const d = s.sel;
      s.V.splice(d, 1);
      s.E = s.E.filter((e) => e[0] !== d && e[1] !== d).map((e) => e.map((v) => (v > d ? v - 1 : v)));
      s.sel = -1;
      draw();
    } });
    ui.button(w.controls, { label: 'Очистить', icon: 'reset', onClick: () => ((s.V = []), (s.E = []), (s.sel = -1), draw()) });
    const gv = new GraphView(w.main, {
      w: 520, h: 290,
      onNode: (i) => {
        if (s.sel < 0) s.sel = i;
        else if (s.sel === i) s.sel = -1;
        else {
          const k = s.E.findIndex((e) => (e[0] === s.sel && e[1] === i) || (e[1] === s.sel && e[0] === i));
          if (k >= 0) s.E.splice(k, 1);
          else s.E.push([s.sel, i]);
          s.sel = -1;
        }
        draw();
      },
      onBg: (x, y) => {
        if (s.V.length < 16 && x > 18 && x < 502 && y > 18 && y < 272) s.V.push([x, y]);
        s.sel = -1;
        draw();
      },
    });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 've', label: 'вершин / рёбер' }, { key: 'c', label: 'компонент k' }, { key: 'cyc', label: 'независимых циклов |E| − |V| + k' }, { key: 'd', label: 'диаметр' }]);
    function draw() {
      const n = s.V.length;
      const A = analyse(n, s.E);
      const fillOf = (i) => (s.view === 'comp' ? SER[A.comp[i] % SER.length] : A.bip ? (A.color[i] ? 'orange' : 'blue') : 'red');
      gv.draw({
        nodes: s.V.map(([x, y], i) => ({ x, y, r: 14, label: String(i + 1), fill: fillOf(i), fillP: s.view === 'bip' && !A.bip ? 18 : 38, color: i === s.sel ? 'tree' : fillOf(i), width: i === s.sel ? 3.5 : 2, halo: i === s.sel ? 'tree' : null })),
        edges: s.E.map((e) => ({ a: e[0], b: e[1], color: 'ink2', width: 2.2 })),
        texts: n ? [] : [{ x: 260, y: 145, text: 'щёлкните, чтобы добавить вершину', color: 'muted', size: 14 }],
      });
      const tree = n > 0 && A.nComp === 1 && s.E.length === n - 1;
      line.textContent = 'Степени: ' + (A.deg.join(', ') || '—') + '   (сумма ' + U.sum(A.deg) + ' = 2·' + s.E.length + ')' +
        '\nДерево: ' + (tree ? 'да' : 'нет') + (A.cyc === 0 && A.nComp > 1 ? ' (лес из ' + A.nComp + ' деревьев)' : '') +
        '\nДвудольный: ' + (A.bip ? 'да' : 'нет — есть цикл нечётной длины') +
        '\nЭйлеров обход всех рёбер: ' + A.euler + ' (нечётных вершин ' + A.odd + ')' + (s.sel >= 0 ? '\nВыбрана вершина ' + (s.sel + 1) + ' — щёлкните по другой, чтобы соединить' : '');
      st.set('ve', n + ' / ' + s.E.length);
      st.set('c', String(A.nComp));
      st.set('cyc', String(A.cyc));
      st.set('d', A.diam === Infinity ? '∞ (несвязный)' : String(A.diam));
      note.innerHTML = '<b>Компоненты связности</b> находит один обход из каждой ещё не посещённой вершины. <b>Число независимых циклов</b> |E| − |V| + k: у дерева 0, каждое «лишнее» ребро добавляет 1 — поэтому «связный и |E| = |V| − 1» означает «дерево». <b>Двудольность</b> проверяется тем же обходом: уровни красятся поочерёдно, и если два соседа получили один цвет — найден нечётный цикл. <b>Диаметр</b> — наибольшее расстояние между вершинами (в рёбрах).';
    }
    load('tree');
  });

  /* ==============================================================================
   * 7. Эйлеровы пути: алгоритм Хирхольцера
   * ============================================================================== */
  const EG = {
    kon: { label: 'Кёнигсберг', names: ['A', 'B', 'C', 'D'], pos: [[230, 150], [300, 40], [300, 260], [460, 150]], edges: [[0, 1, -26], [0, 1, 26], [0, 2, 26], [0, 2, -26], [0, 3, 0], [1, 3, 30], [2, 3, -30]] },
    kon8: { label: '+ восьмой мост', names: ['A', 'B', 'C', 'D'], pos: [[230, 150], [300, 40], [300, 260], [460, 150]], edges: [[0, 1, -26], [0, 1, 26], [0, 2, 26], [0, 2, -26], [0, 3, 0], [1, 3, 30], [2, 3, -30], [1, 2, 230]] },
    house: { label: 'домик', names: ['1', '2', '3', '4', '5'], pos: [[170, 265], [350, 265], [350, 130], [170, 130], [260, 35]], edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3], [3, 4], [4, 2]] },
    k5: { label: 'пентаграмма K₅', names: ['1', '2', '3', '4', '5'], pos: circlePos(5, 260, 150, 120), edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [1, 3], [2, 4], [3, 0], [4, 1]] },
  };
  /** Алгоритм Хирхольцера для мультиграфа: последовательность [вершина, ребро прихода]. */
  function eulerPath(n, edges) {
    const deg = new Array(n).fill(0);
    edges.forEach(([a, b]) => (deg[a]++, deg[b]++));
    const odd = U.range(n).filter((i) => deg[i] % 2 === 1);
    if (odd.length !== 0 && odd.length !== 2) return { deg, odd, path: null };
    const adj = Array.from({ length: n }, () => []);
    edges.forEach(([a, b], id) => (adj[a].push([b, id]), adj[b].push([a, id])));
    const used = new Array(edges.length).fill(false);
    const ptr = new Array(n).fill(0);
    const stack = [[odd.length ? odd[0] : 0, -1]];
    const out = [];
    while (stack.length) {
      const v = stack[stack.length - 1][0];
      while (ptr[v] < adj[v].length && used[adj[v][ptr[v]][1]]) ptr[v]++;
      if (ptr[v] === adj[v].length) out.push(stack.pop());
      else {
        const [u, id] = adj[v][ptr[v]];
        used[id] = true;
        stack.push([u, id]);
      }
    }
    return { deg, odd, path: out.reverse() };
  }
  GBC.widget('euler', (el) => {
    const s = { g: 'kon', k: 0 };
    const w = ui.shell(el, { title: 'Эйлеров путь: пройти по каждому ребру ровно один раз', sub: 'Число у вершины — её степень; нечётные выделены. Если обход существует, ▶ покажет маршрут, найденный алгоритмом Хирхольцера.' });
    ui.segmented(w.controls, { label: 'Граф', value: s.g, options: Object.keys(EG).map((k) => ({ value: k, label: EG[k].label })), onChange: (v) => ((s.g = v), (s.k = 0), reset()) });
    const pl = ui.player(w.controls, { label: 'Обход', min: 0, max: 1, value: 0, fps: 1.5, format: (k, m) => 'ребро ' + k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 300 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'вершин / рёбер' }, { key: 'odd', label: 'нечётных вершин' }, { key: 'res', label: 'вывод' }]);
    function reset() {
      const G = EG[s.g];
      const r = eulerPath(G.names.length, G.edges);
      pl.stop();
      pl.setMax(r.path ? G.edges.length : 0);
      pl.set(0);
      draw();
    }
    function draw() {
      const G = EG[s.g];
      const { deg, odd, path } = eulerPath(G.names.length, G.edges);
      const order = new Map();
      if (path) path.slice(1, s.k + 1).forEach((p, i) => order.set(p[1], i + 1));
      const cur = path ? path[s.k][0] : null;
      gv.draw({
        nodes: G.pos.map(([x, y], i) => ({ x, y, r: 16, label: G.names[i], fill: i === cur ? 'tree' : odd.includes(i) ? 'red' : null, fillP: i === cur ? 55 : 25, color: i === cur ? 'tree' : odd.includes(i) ? 'red' : 'model', width: i === cur ? 3 : 2, side: 'deg ' + deg[i], sideColor: deg[i] % 2 ? 'critical' : 'ink2', sideBold: true })),
        edges: G.edges.map((e, id) => ({ a: e[0], b: e[1], bend: e[2] || 0, color: order.has(id) ? (order.get(id) === s.k ? 'tree' : 'model') : 'muted', width: order.has(id) ? 3.6 : 2, label: order.has(id) ? String(order.get(id)) : '', lbold: true, lcolor: 'ink' })),
      });
      const res = odd.length === 0 ? 'эйлеров цикл' : odd.length === 2 ? 'эйлеров путь' : 'обхода нет';
      line.textContent = path ? 'Маршрут: ' + path.slice(0, s.k + 1).map((p) => G.names[p[0]]).join(' → ') : 'Нечётных вершин ' + odd.length + ' — нарисовать «не отрывая карандаша» нельзя.';
      st.set('v', G.names.length + ' / ' + G.edges.length);
      st.set('odd', String(odd.length));
      st.set('res', res);
      note.innerHTML = '<b>Теорема Эйлера:</b> связный граф обходится по всем рёбрам ровно по разу тогда и только тогда, когда нечётных вершин 0 (обход замкнут — цикл) или 2 (путь от одной нечётной к другой). Необходимость — рассуждение о парах рёбер; достаточность доказывает сам <b>алгоритм Хирхольцера</b>: идём по неиспользованным рёбрам, пока не застрянем (застрять можно только в конце), а «забытые» циклы вклеиваем в маршрут. Время — O(|E|). ' + (s.g === 'house' ? 'У домика нечётны вершины 1 и 2 (степень 3), поэтому рисовать его надо от одной из них.' : s.g === 'k5' ? 'У K₅ все степени 4 — обход замкнут и может начаться где угодно.' : '');
    }
    reset();
  });

  /* ==============================================================================
   * 8. Гамильтоновы циклы и задача коммивояжёра
   * ============================================================================== */
  function tspSolve(P) {
    const n = P.length;
    const D = P.map((a) => P.map((b) => Math.hypot(a[0] - b[0], a[1] - b[1]) / 10));
    const len = (t) => U.sum(t.map((v, i) => D[v][t[(i + 1) % n]]));
    let best = null;
    let bestL = Infinity;
    let count = 0;
    const rest = U.range(n - 1, 1);
    const used = new Array(n).fill(false);
    const cur = [0];
    (function rec(acc) {
      if (acc >= bestL) return;
      if (cur.length === n) {
        count++;
        const L = acc + D[cur[n - 1]][0];
        if (L < bestL - 1e-12) (bestL = L), (best = cur.slice());
        return;
      }
      for (const v of rest) {
        if (used[v]) continue;
        used[v] = true;
        cur.push(v);
        rec(acc + D[cur[cur.length - 2]][v]);
        cur.pop();
        used[v] = false;
      }
    })(0);
    const nn = [0];
    const seen = new Set([0]);
    while (nn.length < n) {
      const v = nn[nn.length - 1];
      let b = -1;
      for (let u = 0; u < n; u++) if (!seen.has(u) && (b < 0 || D[v][u] < D[v][b])) b = u;
      nn.push(b);
      seen.add(b);
    }
    let t2 = nn.slice();
    let improved = true;
    let swaps = 0;
    while (improved) {
      improved = false;
      for (let i = 1; i < n - 1; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = t2[i - 1];
          const b = t2[i];
          const c = t2[j];
          const d = t2[(j + 1) % n];
          if (D[a][c] + D[b][d] < D[a][b] + D[c][d] - 1e-9) {
            t2 = t2.slice(0, i).concat(t2.slice(i, j + 1).reverse(), t2.slice(j + 1));
            improved = true;
            swaps++;
          }
        }
      }
    }
    return { D, best, bestL, nn, nnL: len(nn), opt2: t2, opt2L: len(t2), swaps };
  }
  GBC.widget('tsp', (el) => {
    const s = { n: 7, seed: 3, m: 'best' };
    const w = ui.shell(el, { title: 'Коммивояжёр: обойти все города и вернуться — как можно короче', sub: 'Гамильтонов цикл проходит через каждую вершину ровно один раз. Сравните полный перебор (точно, но долго) с жадным «ближайшим соседом» и его улучшением 2-opt.' });
    ui.slider(w.controls, { label: 'Городов n', min: 4, max: 9, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.segmented(w.controls, { label: 'Маршрут', value: s.m, options: [{ value: 'best', label: 'перебор' }, { value: 'nn', label: 'ближайший сосед' }, { value: 'opt2', label: '2-opt' }], onChange: (v) => ((s.m = v), draw()) });
    ui.button(w.controls, { label: 'Другие города', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 300 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'len', label: 'длина маршрута' }, { key: 'opt', label: 'оптимум' }, { key: 'ex', label: 'хуже оптимума на' }, { key: 'cnt', label: 'разных циклов (n−1)!/2' }]);
    function cities() {
      const rng = new GBC.RNG(s.seed);
      const P = [];
      while (P.length < s.n) {
        const c = [Math.round(rng.uniform(40, 480)), Math.round(rng.uniform(40, 260))];
        if (P.every((q) => Math.hypot(q[0] - c[0], q[1] - c[1]) >= 55)) P.push(c);
      }
      return P;
    }
    function draw() {
      const P = cities();
      const R = tspSolve(P);
      const tour = s.m === 'best' ? R.best : s.m === 'nn' ? R.nn : R.opt2;
      const L = s.m === 'best' ? R.bestL : s.m === 'nn' ? R.nnL : R.opt2L;
      gv.draw({
        nodes: P.map(([x, y], i) => ({ x, y, r: 12, label: String(i + 1), fill: i === 0 ? 'tree' : 'model', fillP: 35, color: i === 0 ? 'tree' : 'model' })),
        edges: [].concat(
          s.m !== 'best' ? R.best.map((v, i) => ({ a: v, b: R.best[(i + 1) % s.n], color: 'good', width: 7, opacity: 0.22, hit: false })) : [],
          tour.map((v, i) => ({ a: v, b: tour[(i + 1) % s.n], color: s.m === 'best' ? 'good' : 'tree', width: 3, arrow: true, label: f1(R.D[v][tour[(i + 1) % s.n]]), lsize: 11 })),
        ),
      });
      let fact = 1;
      for (let i = 2; i < s.n; i++) fact *= i;
      line.textContent = 'Маршрут: ' + tour.concat([tour[0]]).map((v) => v + 1).join(' → ') + '   длина ' + f2(L) + '\nОптимум: ' + R.best.concat([0]).map((v) => v + 1).join(' → ') + '   длина ' + f2(R.bestL) + (s.m === 'opt2' ? '\n2-opt сделал ' + nWord(R.swaps, 'улучшение', 'улучшения', 'улучшений') + ' (разворот куска маршрута, убирающий пересечение)' : '');
      st.set('len', f2(L));
      st.set('opt', f2(R.bestL));
      st.set('ex', pct(L / R.bestL - 1));
      st.set('cnt', num(fact / 2));
      note.innerHTML = 'Перебор фиксирует город 1 и пробует порядки остальных: (n − 1)!/2 разных циклов (направление обхода не важно). Для 9 городов это 20 160 — мгновенно, для 20 — 6·10<sup>16</sup>, а для 30 — 4·10<sup>30</sup>: не хватит возраста Вселенной. Задача <b>NP-трудная</b>: быстрых точных алгоритмов не известно. Поэтому используют эвристики: «иди в ближайший непосещённый» (быстро, но может ошибиться заметно) и <b>2-opt</b> (разворачиваем кусок маршрута, если это его укорачивает; оптимальный маршрут на плоскости никогда не пересекает сам себя). ' + (s.m === 'best' ? '' : 'Бледно-зелёным показан оптимум.') + ' Сравните с шагом 7: обойти все <i>рёбра</i> — легко, все <i>вершины</i> — трудно.';
    }
    w.pythonAction(() => 'from itertools import permutations\nfrom math import dist\n\ncities = ' + pyList(cities()) + '\nn = len(cities)\nlength = lambda t: sum(dist(cities[t[i]], cities[t[(i + 1) % n]]) / 10 for i in range(n))\n\nbest = min(((0,) + p for p in permutations(range(1, n))), key=length)\nprint("перебор:", [v + 1 for v in best], round(length(best), 2))\n\ntour, left = [0], set(range(1, n))\nwhile left:\n    nxt = min(left, key=lambda u: dist(cities[tour[-1]], cities[u]))\n    tour.append(nxt)\n    left.remove(nxt)\nprint("ближайший сосед:", [v + 1 for v in tour], round(length(tour), 2))\n');
    draw();
  });

  /* ==============================================================================
   * 9. Обходы BFS и DFS
   * ============================================================================== */
  const TG = {
    names: 'ABCDEFGHIJ'.split(''),
    pos: [[260, 30], [110, 100], [260, 100], [410, 100], [60, 185], [160, 185], [260, 185], [410, 185], [110, 265], [335, 265]],
    edges: [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 3], [2, 6], [3, 7], [4, 8], [5, 8], [6, 9], [7, 9]],
  };
  const tgAdj = adjList(10, TG.edges);
  function traversal(kind) {
    const snaps = [{ visited: [], frontier: [0], parent: {}, level: { 0: 0 } }];
    const parent = {};
    const level = { 0: 0 };
    const visited = [];
    if (kind === 'bfs') {
      const q = [0];
      const seen = new Set([0]);
      while (q.length) {
        const v = q.shift();
        visited.push(v);
        tgAdj[v].forEach((u) => {
          if (!seen.has(u)) (seen.add(u), (parent[u] = v), (level[u] = level[v] + 1), q.push(u));
        });
        snaps.push({ visited: visited.slice(), frontier: q.slice(), parent: { ...parent }, level: { ...level } });
      }
    } else {
      const stack = [0];
      const seen = new Set();
      while (stack.length) {
        const v = stack.pop();
        if (seen.has(v)) continue;
        seen.add(v);
        visited.push(v);
        tgAdj[v].slice().reverse().forEach((u) => {
          if (!seen.has(u)) ((parent[u] = v), stack.push(u));
        });
        snaps.push({ visited: visited.slice(), frontier: stack.slice(), parent: { ...parent }, level: {} });
      }
    }
    return snaps;
  }
  GBC.widget('bfs-dfs', (el) => {
    const s = { kind: 'bfs', k: 0 };
    const w = ui.shell(el, { title: 'Обход графа: в ширину и в глубину', sub: 'BFS берёт вершины из очереди (первым пришёл — первым ушёл), DFS — из стека (последним пришёл — первым ушёл). Число над вершиной — порядок посещения; у BFS под вершиной — расстояние от A.' });
    ui.segmented(w.controls, { label: 'Алгоритм', value: s.kind, options: [{ value: 'bfs', label: 'в ширину (BFS)' }, { value: 'dfs', label: 'в глубину (DFS)' }], onChange: (v) => ((s.kind = v), pl.stop(), pl.set(0), (s.k = 0), draw()) });
    const pl = ui.player(w.controls, { label: 'Шаг', min: 0, max: 10, value: 0, fps: 1.2, format: (k) => 'шаг ' + k, onChange: (k) => ((s.k = k), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 295 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'посещено' }, { key: 'f', label: 'в очереди / стеке' }, { key: 'ord', label: 'порядок' }]);
    function draw() {
      const snap = traversal(s.kind)[s.k];
      const tree = snap.visited.filter((v) => snap.parent[v] !== undefined).map((v) => [snap.parent[v], v]);
      const cur = snap.visited[snap.visited.length - 1];
      const fr = [...new Set(snap.frontier)].filter((v) => !snap.visited.includes(v));
      gv.draw({
        nodes: TG.pos.map(([x, y], i) => ({
          x, y, r: 15, label: TG.names[i], fill: i === cur ? 'tree' : snap.visited.includes(i) ? 'model' : fr.includes(i) ? 'yellow' : null, fillP: i === cur ? 60 : 32,
          color: i === cur ? 'tree' : 'model', width: i === cur ? 3 : 2,
          top: snap.visited.includes(i) ? String(snap.visited.indexOf(i) + 1) : '', topColor: 'model',
          sub: s.kind === 'bfs' && snap.level[i] !== undefined ? 'd=' + snap.level[i] : '',
        })),
        edges: TG.edges.map((e) => {
          const inTree = tree.some((t) => (t[0] === e[0] && t[1] === e[1]) || (t[0] === e[1] && t[1] === e[0]));
          return { a: e[0], b: e[1], color: inTree ? 'model' : 'muted', width: inTree ? 3.4 : 1.8 };
        }),
      });
      line.textContent = (s.kind === 'bfs' ? 'Очередь (выход слева): [' : 'Стек (верх справа): [') + snap.frontier.map((v) => TG.names[v]).join(' ') + ']\nПосещены: ' + (snap.visited.map((v) => TG.names[v]).join(' → ') || '—');
      st.set('n', String(snap.visited.length));
      st.set('f', String(snap.frontier.length));
      st.set('ord', snap.visited.map((v) => TG.names[v]).join('') || '—');
      note.innerHTML = s.kind === 'bfs'
        ? '<b>BFS</b> идёт «волнами»: сначала все вершины на расстоянии 1 от A, потом на расстоянии 2… Поэтому синие рёбра (дерево обхода) дают <b>кратчайшие пути по числу рёбер</b>: d(J) = 3. Важная деталь — вершину помечают при постановке в очередь, иначе она попадёт туда несколько раз. Так же «по уровням» растит деревья XGBoost (шаг 19).'
        : '<b>DFS</b> уходит вглубь, пока может, и возвращается назад. Стек — то же самое, что рекурсия. Дерево обхода длинное и «тощее», пути в нём не кратчайшие: G достигается цепочкой A → C → D → H → J → G из 5 рёбер, хотя d(G) = 2. Зато DFS находит циклы, мосты и порядок для графов зависимостей (шаги 10, 22). Так рекурсивно строится и сохраняется в файл дерево решений.';
    }
    w.pythonAction(() => 'from collections import deque\n\nG = {"A": "BCD", "B": "AEF", "C": "ADG", "D": "ACH", "E": "BI", "F": "BI",\n     "G": "CJ", "H": "DJ", "I": "EF", "J": "GH"}\n\ndef bfs(start):\n    dist, order, q = {start: 0}, [], deque([start])\n    while q:\n        v = q.popleft()\n        order.append(v)\n        for u in G[v]:\n            if u not in dist:           # помечаем при добавлении в очередь\n                dist[u] = dist[v] + 1\n                q.append(u)\n    return order, dist\n\ndef dfs(start):\n    seen, order, stack = set(), [], [start]\n    while stack:\n        v = stack.pop()\n        if v in seen:\n            continue\n        seen.add(v)\n        order.append(v)\n        stack.extend(u for u in reversed(G[v]) if u not in seen)\n    return order\n\norder, dist = bfs("A")\nprint("BFS:", "".join(order), dist)\nprint("DFS:", "".join(dfs("A")))\n');
    draw();
  });

  /* ==============================================================================
   * 10. DFS: времена входа и выхода, обратные рёбра, мосты и точки сочленения
   * ============================================================================== */
  const DT = {
    pos: [[50, 90], [140, 40], [140, 150], [50, 210], [250, 150], [330, 70], [370, 175], [470, 110], [470, 235], [370, 250]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [2, 4], [4, 5], [5, 6], [6, 4], [6, 7], [7, 8], [8, 6], [8, 9]],
  };
  function dfsEvents() {
    const n = DT.pos.length;
    const adj = adjList(n, DT.edges);
    const tin = new Array(n).fill(-1);
    const tout = new Array(n).fill(-1);
    const low = new Array(n).fill(-1);
    const par = new Array(n).fill(-1);
    const ev = [];
    let t = 0;
    const kids = new Array(n).fill(0);
    const bridges = [];
    const cut = new Set();
    (function dfs(v) {
      tin[v] = low[v] = ++t;
      ev.push({ type: 'in', v });
      for (const u of adj[v]) {
        if (u === par[v]) continue;
        if (tin[u] < 0) {
          par[u] = v;
          kids[v]++;
          ev.push({ type: 'tree', v, u });
          dfs(u);
          low[v] = Math.min(low[v], low[u]);
          if (low[u] > tin[v]) bridges.push([v, u]);
          if (par[v] >= 0 && low[u] >= tin[v]) cut.add(v);
          ev.push({ type: 'up', v, u, low: low[v] });
        } else if (tin[u] < tin[v]) {
          low[v] = Math.min(low[v], tin[u]);
          ev.push({ type: 'back', v, u, low: low[v] });
        }
      }
      tout[v] = ++t;
      ev.push({ type: 'out', v });
    })(0);
    if (kids[0] > 1) cut.add(0);
    return { ev, tin, tout, low, par, bridges, cut: [...cut].sort((a, b) => a - b) };
  }
  GBC.widget('dfs-times', (el) => {
    const R = dfsEvents();
    const s = { k: R.ev.length };
    const n = DT.pos.length;
    const w = ui.shell(el, { title: 'DFS изнутри: времена, обратные рёбра, мосты и точки сочленения', sub: 'Под вершиной — «вход/выход» (моменты, когда DFS пришёл и ушёл), над ней — low: самое раннее время входа, до которого можно добраться вниз по дереву и одним обратным ребром.' });
    const pl = ui.player(w.controls, { label: 'Событие обхода', min: 0, max: R.ev.length, value: R.ev.length, fps: 2.5, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 300 });
    w.main.appendChild(legendRow([['model', 'ребро дерева обхода', 'line'], ['tree', 'обратное ребро (замыкает цикл)', 'dash'], ['red', 'мост', 'line']]));
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'b', label: 'мосты' }, { key: 'c', label: 'точки сочленения' }, { key: 'cyc', label: 'обратных рёбер' }]);
    function draw() {
      const k = s.k;
      const evs = R.ev.slice(0, k);
      const tin = new Array(n).fill(-1);
      const tout = new Array(n).fill(-1);
      const low = new Array(n).fill(null);
      let t = 0;
      const treeE = [];
      const backE = [];
      evs.forEach((e) => {
        if (e.type === 'in') (tin[e.v] = ++t), (low[e.v] = tin[e.v]);
        else if (e.type === 'out') tout[e.v] = ++t;
        else if (e.type === 'tree') treeE.push([e.v, e.u]);
        else if (e.type === 'back') (backE.push([e.v, e.u]), (low[e.v] = e.low));
        else if (e.type === 'up') low[e.v] = e.low;
      });
      const done = k === R.ev.length;
      const last = evs[evs.length - 1];
      const curV = last ? last.v : -1;
      const isE = (list, e) => list.some((f) => (f[0] === e[0] && f[1] === e[1]) || (f[0] === e[1] && f[1] === e[0]));
      gv.draw({
        nodes: DT.pos.map(([x, y], i) => ({
          x, y, r: 15, label: String(i + 1), fill: i === curV ? 'tree' : tin[i] > 0 && tout[i] < 0 ? 'yellow' : tout[i] > 0 ? 'model' : null, fillP: i === curV ? 55 : 30,
          color: done && R.cut.includes(i) ? 'red' : i === curV ? 'tree' : 'model', width: done && R.cut.includes(i) ? 3.5 : 2, halo: done && R.cut.includes(i) ? 'red' : null, haloOpacity: 0.2,
          sub: tin[i] > 0 ? tin[i] + '/' + (tout[i] > 0 ? tout[i] : '…') : '', top: low[i] !== null ? 'low ' + low[i] : '', topColor: 'ink2', topBold: false, topSize: 11,
        })),
        edges: DT.edges.map((e) => {
          const br = done && isE(R.bridges, e);
          return isE(treeE, e) ? { a: e[0], b: e[1], color: br ? 'red' : 'model', width: br ? 4.5 : 3 } : isE(backE, e) ? { a: e[0], b: e[1], color: 'tree', width: 2.6, dash: true } : { a: e[0], b: e[1], color: 'muted', width: 1.6 };
        }),
      });
      const say = (e) => (e.type === 'in' ? 'вход в ' + (e.v + 1) : e.type === 'out' ? 'выход из ' + (e.v + 1) : e.type === 'tree' ? (e.v + 1) + ' → ' + (e.u + 1) + ': новая вершина, ребро дерева' : e.type === 'back' ? (e.v + 1) + ' → ' + (e.u + 1) + ': уже открыта выше — обратное ребро, цикл! low(' + (e.v + 1) + ') = ' + e.low : 'возврат ' + (e.u + 1) + ' → ' + (e.v + 1) + ', low(' + (e.v + 1) + ') = ' + e.low);
      line.textContent = 'Последнее событие: ' + (last ? say(last) : '—') + (done ? '\nМосты (low ребёнка > вход родителя): ' + R.bridges.map((b) => (b[0] + 1) + '–' + (b[1] + 1)).join(', ') + '\nТочки сочленения (low ребёнка ≥ вход родителя): ' + R.cut.map((v) => v + 1).join(', ') : '');
      st.set('b', done ? R.bridges.map((b) => (b[0] + 1) + '–' + (b[1] + 1)).join(', ') : '…');
      st.set('c', done ? R.cut.map((v) => v + 1).join(', ') : '…');
      st.set('cyc', String(backE.length));
      note.innerHTML = 'DFS делит рёбра неориентированного графа на два вида: <b>рёбра дерева</b> (ведут в новую вершину) и <b>обратные</b> (ведут к предку — каждое замыкает цикл). Обратных рёбер ' + R.ev.filter((e) => e.type === 'back').length + ' = |E| − |V| + 1 = ' + DT.edges.length + ' − ' + n + ' + 1: столько в графе независимых циклов. Значение <b>low</b> отвечает на вопрос «можно ли из поддерева подняться выше?». Если из поддерева вершины u нельзя подняться выше её родителя v (low(u) > вход(v)), ребро v–u — <b>мост</b>: его удаление разрывает граф. Если нельзя подняться выше самой v (low(u) ≥ вход(v)), то v — <b>точка сочленения</b>. Алгоритм Тарьяна находит их за один обход O(|V| + |E|) — так ищут уязвимые узлы сетей.';
    }
    w.pythonAction(() => 'import sys\nsys.setrecursionlimit(10_000)\n\nedges = ' + pyList(DT.edges.map((e) => [e[0] + 1, e[1] + 1])) + '\nadj = {}\nfor a, b in edges:\n    adj.setdefault(a, []).append(b)\n    adj.setdefault(b, []).append(a)\nfor v in adj:\n    adj[v].sort()\n\ntin, low, t = {}, {}, 0\nbridges, cut = [], set()\n\ndef dfs(v, parent):\n    global t\n    t += 1\n    tin[v] = low[v] = t\n    children = 0\n    for u in adj[v]:\n        if u == parent:\n            continue\n        if u not in tin:\n            children += 1\n            dfs(u, v)\n            low[v] = min(low[v], low[u])\n            if low[u] > tin[v]:\n                bridges.append((v, u))\n            if parent is not None and low[u] >= tin[v]:\n                cut.add(v)\n        else:\n            low[v] = min(low[v], tin[u])\n    if parent is None and children > 1:\n        cut.add(v)\n    t += 1\n\ndfs(1, None)\nprint("мосты:", bridges)\nprint("точки сочленения:", sorted(cut))\n');
    draw();
  });

  /* ==============================================================================
   * 11. Поиск пути в лабиринте: BFS, DFS, Дейкстра, A*
   * ============================================================================== */
  const GW = 18;
  const GH = 11;
  const MAZE0 = [
    '.....#............',
    '.....#............',
    '.....#....~~~~~...',
    '.....#....~~~~~...',
    '.....#....~~~~~...',
    '.S........~~~~~.G.',
    '.....#....~~~~~...',
    '.....#....~~~~~...',
    '.....#....~~~~~...',
    '.....#............',
    '.....#............',
  ];
  function gridRun(alg, cells, start, goal) {
    const N = GW * GH;
    const cost = (i) => (cells[i] === 2 ? 5 : 1);
    const nbrs = (i) => {
      const x = i % GW;
      const y = Math.floor(i / GW);
      const out = [];
      [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([dx, dy]) => {
        const X = x + dx;
        const Y = y + dy;
        if (X >= 0 && X < GW && Y >= 0 && Y < GH && cells[Y * GW + X] !== 1) out.push(Y * GW + X);
      });
      return out;
    };
    const hman = (i) => Math.abs((i % GW) - (goal % GW)) + Math.abs(Math.floor(i / GW) - Math.floor(goal / GW));
    const parent = new Array(N).fill(-1);
    const disc = new Array(N).fill(Infinity);
    const exp = new Array(N).fill(-1);
    const order = [];
    disc[start] = 0;
    let found = false;
    if (alg === 'bfs') {
      const q = [start];
      for (let h = 0; h < q.length; h++) {
        const v = q[h];
        exp[v] = order.length;
        order.push(v);
        if (v === goal) {
          found = true;
          break;
        }
        for (const u of nbrs(v)) if (disc[u] === Infinity) (disc[u] = order.length), (parent[u] = v), q.push(u);
      }
    } else if (alg === 'dfs') {
      const stack = [[start, -1]];
      while (stack.length) {
        const [v, from] = stack.pop();
        if (exp[v] >= 0) continue;
        exp[v] = order.length;
        parent[v] = from;
        order.push(v);
        if (v === goal) {
          found = true;
          break;
        }
        nbrs(v).reverse().forEach((u) => {
          if (exp[u] < 0) {
            stack.push([u, v]);
            if (disc[u] === Infinity) disc[u] = order.length;
          }
        });
      }
    } else {
      const dist = new Array(N).fill(Infinity);
      dist[start] = 0;
      const heap = new Heap();
      let cnt = 0;
      heap.push([alg === 'astar' ? hman(start) : 0, cnt++, start, -1]);
      while (heap.size) {
        const [, , v, from] = heap.pop();
        if (exp[v] >= 0) continue;
        exp[v] = order.length;
        parent[v] = from;
        order.push(v);
        if (v === goal) {
          found = true;
          break;
        }
        for (const u of nbrs(v)) {
          const nd = dist[v] + cost(u);
          if (nd < dist[u]) {
            dist[u] = nd;
            if (disc[u] === Infinity) disc[u] = order.length;
            heap.push([alg === 'astar' ? nd + hman(u) : nd, cnt++, u, v]);
          }
        }
      }
    }
    const path = [];
    if (found) for (let v = goal; v >= 0; v = parent[v]) path.unshift(v);
    const pcost = U.sum(path.slice(1).map(cost));
    return { order, exp, disc, path, pcost, found };
  }
  GBC.widget('grid-search', (el) => {
    const s = { alg: 'bfs', k: 0, tool: 'wall', cells: [], start: 0, goal: 0 };
    const reset0 = () => {
      s.cells = [];
      MAZE0.forEach((row, y) => row.split('').forEach((c, x) => {
        s.cells.push(c === '#' ? 1 : c === '~' ? 2 : 0);
        if (c === 'S') s.start = y * GW + x;
        if (c === 'G') s.goal = y * GW + x;
      }));
    };
    reset0();
    const w = ui.shell(el, { title: 'Лабиринт: BFS, DFS, Дейкстра и A* на сетке', sub: 'Клетки — вершины, соседние клетки — рёбра. Шаг по болоту (бирюзовые клетки) стоит 5, по обычной клетке — 1. Щёлкайте по сетке, чтобы ставить стены, болота, старт и финиш.' });
    ui.segmented(w.controls, { label: 'Алгоритм', value: s.alg, options: [{ value: 'bfs', label: 'BFS' }, { value: 'dfs', label: 'DFS' }, { value: 'dijkstra', label: 'Дейкстра' }, { value: 'astar', label: 'A*' }], onChange: (v) => ((s.alg = v), restart()) });
    const pl = ui.player(w.controls, { label: 'Раскрыто клеток', min: 0, max: 1, value: 0, fps: 25, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    ui.segmented(w.controls, { label: 'Щелчок ставит', value: s.tool, options: [{ value: 'wall', label: 'стену' }, { value: 'swamp', label: 'болото' }, { value: 'start', label: 'старт' }, { value: 'goal', label: 'финиш' }], onChange: (v) => (s.tool = v) });
    ui.button(w.controls, { label: 'Исходный лабиринт', icon: 'reset', onClick: () => (reset0(), restart()) });
    const CS = 28;
    const svg = S('svg', { viewBox: '0 0 ' + GW * CS + ' ' + GH * CS, role: 'img', 'aria-label': 'Лабиринт', style: 'display:block;width:100%;height:auto;min-width:380px;max-width:640px;margin:0 auto;cursor:pointer;user-select:none' });
    w.main.appendChild(H('div', { style: 'overflow-x:auto;overflow-y:hidden;margin:2px 0 6px' }, svg));
    w.main.appendChild(legendRow([['model', 'раскрыта'], ['yellow', 'в очереди'], ['aqua', 'болото (стоимость 5)'], ['tree', 'найденный путь', 'line']]));
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'exp', label: 'раскрыто клеток' }, { key: 'len', label: 'шагов в пути' }, { key: 'cost', label: 'стоимость пути' }]);
    svg.addEventListener('click', (e) => {
      const m = svg.getScreenCTM();
      if (!m) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const p = pt.matrixTransform(m.inverse());
      const x = Math.floor(p.x / CS);
      const y = Math.floor(p.y / CS);
      if (x < 0 || x >= GW || y < 0 || y >= GH) return;
      const i = y * GW + x;
      if (s.tool === 'start') {
        if (s.cells[i] !== 1 && i !== s.goal) s.start = i;
      } else if (s.tool === 'goal') {
        if (s.cells[i] !== 1 && i !== s.start) s.goal = i;
      } else if (i !== s.start && i !== s.goal) {
        const v = s.tool === 'wall' ? 1 : 2;
        s.cells[i] = s.cells[i] === v ? 0 : v;
      }
      restart();
    });
    let R = null;
    function restart() {
      R = gridRun(s.alg, s.cells, s.start, s.goal);
      pl.stop();
      pl.setMax(R.order.length);
      pl.set(R.order.length);
      s.k = R.order.length;
      draw();
    }
    function draw() {
      svg.textContent = '';
      const k = s.k;
      for (let i = 0; i < GW * GH; i++) {
        const x = (i % GW) * CS;
        const y = Math.floor(i / GW) * CS;
        const expanded = R.exp[i] >= 0 && R.exp[i] < k;
        const front = !expanded && R.disc[i] <= k && R.disc[i] !== Infinity && i !== s.start;
        const c = s.cells[i];
        let fill = 'var(--surface)';
        if (c === 1) fill = 'var(--ink-2)';
        else if (expanded) fill = tint(c === 2 ? 'aqua' : 'blue', c === 2 ? 55 : 30);
        else if (front) fill = tint('yellow', 45);
        else if (c === 2) fill = tint('aqua', 30);
        svg.appendChild(S('rect', { x: x + 0.5, y: y + 0.5, width: CS - 1, height: CS - 1, rx: 3, style: 'fill:' + fill + ';stroke:var(--border);stroke-width:1' }));
      }
      if (k >= R.order.length && R.path.length) {
        const pts = R.path.map((i) => ((i % GW) * CS + CS / 2).toFixed(1) + ',' + (Math.floor(i / GW) * CS + CS / 2).toFixed(1)).join(' ');
        svg.appendChild(S('polyline', { points: pts, style: 'fill:none;stroke:' + col('tree') + ';stroke-width:5;stroke-linejoin:round;stroke-linecap:round' }));
      }
      [[s.start, 'S'], [s.goal, 'G']].forEach(([i, t]) => {
        const x = (i % GW) * CS + CS / 2;
        const y = Math.floor(i / GW) * CS + CS / 2;
        svg.appendChild(S('circle', { cx: x, cy: y, r: 11, style: 'fill:' + col(t === 'S' ? 'model' : 'tree') + ';stroke:var(--surface);stroke-width:2' }));
        svg.appendChild(sTxt(x, y + 0.5, t, { size: 13, bold: true, color: 'surface' }));
      });
      const doneAll = k >= R.order.length;
      st.set('exp', String(Math.min(k, R.order.length)));
      st.set('len', doneAll ? (R.found ? String(R.path.length - 1) : 'пути нет') : '…');
      st.set('cost', doneAll ? (R.found ? String(R.pcost) : '—') : '…');
      note.innerHTML = {
        bfs: '<b>BFS</b> расходится ромбами-волнами и находит путь с наименьшим <b>числом шагов</b>. Но веса он не видит: путь может пройти прямо через болото и оказаться дорогим.',
        dfs: '<b>DFS</b> бежит в одном направлении, пока не упрётся, — путь находится, но часто длинный и извилистый. Для поиска кратчайших путей DFS не годится.',
        dijkstra: '<b>Дейкстра</b> раскрывает клетки в порядке <b>стоимости</b> пути от старта и находит самый дешёвый путь — обходит болото, если обход дешевле. Но раскрывает «круг» во все стороны, даже от финиша прочь.',
        astar: '<b>A*</b> — Дейкстра с подсказкой: приоритет клетки = стоимость от старта + оценка расстояния до финиша h (манхэттенское расстояние). Оценка никогда не завышает остаток пути (каждый шаг стоит не меньше 1), поэтому найденный путь так же оптимален, как у Дейкстры, а клеток раскрывается заметно меньше: поиск вытягивается к цели. Так ищут маршруты в навигаторах и играх.',
      }[s.alg];
    }
    w.pythonAction(() => {
      const rows = U.range(GH).map((y) => U.range(GW).map((x) => {
        const i = y * GW + x;
        return i === s.start ? 'S' : i === s.goal ? 'G' : s.cells[i] === 1 ? '#' : s.cells[i] === 2 ? '~' : '.';
      }).join(''));
      return 'import heapq\nfrom collections import deque\n\ngrid = [\n' + rows.map((r) => '    "' + r + '",').join('\n') + '\n]\nH, W = len(grid), len(grid[0])\nfind = lambda ch: next((y, x) for y in range(H) for x in range(W) if grid[y][x] == ch)\nstart, goal = find("S"), find("G")\ncost = lambda c: 5 if grid[c[0]][c[1]] == "~" else 1\n\ndef nbrs(c):\n    y, x = c\n    for dy, dx in ((0, 1), (1, 0), (0, -1), (-1, 0)):     # вправо, вниз, влево, вверх\n        Y, X = y + dy, x + dx\n        if 0 <= Y < H and 0 <= X < W and grid[Y][X] != "#":\n            yield (Y, X)\n\ndef path_of(parent):\n    p, c = [], goal\n    while c is not None:\n        p.append(c)\n        c = parent[c]\n    return p[::-1]\n\ndef bfs():\n    parent, q, n = {start: None}, deque([start]), 0\n    while q:\n        v = q.popleft()\n        n += 1\n        if v == goal:\n            return n, path_of(parent)\n        for u in nbrs(v):\n            if u not in parent:\n                parent[u] = v\n                q.append(u)\n\ndef best_first(astar):\n    h = lambda c: abs(c[0] - goal[0]) + abs(c[1] - goal[1]) if astar else 0\n    dist, parent, done, cnt = {start: 0}, {}, set(), 0\n    pq = [(h(start), cnt, start, None)]\n    while pq:\n        _, _, v, frm = heapq.heappop(pq)\n        if v in done:\n            continue\n        done.add(v)\n        parent[v] = frm\n        if v == goal:\n            return len(done), path_of(parent)\n        for u in nbrs(v):\n            nd = dist[v] + cost(u)\n            if nd < dist.get(u, float("inf")):\n                dist[u] = nd\n                cnt += 1\n                heapq.heappush(pq, (nd + h(u), cnt, u, v))\n\nfor name, res in (("BFS", bfs()), ("Дейкстра", best_first(False)), ("A*", best_first(True))):\n    n, p = res\n    print(f"{name:9} раскрыто {n:3}, шагов {len(p) - 1}, стоимость {sum(cost(c) for c in p[1:])}")\n';
    });
    restart();
  });

  /* ==============================================================================
   * 12. Кратчайшие пути: алгоритм Дейкстры
   * ============================================================================== */
  const DG = {
    names: ['S', 'A', 'B', 'C', 'D', 'E', 'T'],
    pos: [[40, 150], [150, 50], [150, 250], [300, 100], [300, 240], [420, 50], [480, 180]],
    edges: [[0, 1, 4], [0, 2, 2], [1, 2, 1], [1, 3, 5], [2, 3, 8], [2, 4, 10], [3, 4, 2], [3, 5, 3], [4, 6, 6], [5, 6, 1]],
  };
  function dijkstra(k) {
    const n = DG.names.length;
    const dist = new Array(n).fill(Infinity);
    const prev = new Array(n).fill(-1);
    const done = [];
    let relaxed = [];
    dist[0] = 0;
    for (let step = 0; step < k; step++) {
      let v = -1;
      for (let i = 0; i < n; i++) if (!done.includes(i) && dist[i] < Infinity && (v < 0 || dist[i] < dist[v])) v = i;
      if (v < 0) break;
      done.push(v);
      relaxed = [];
      DG.edges.forEach(([a, b, wt]) => {
        const u = a === v ? b : b === v ? a : -1;
        if (u >= 0 && !done.includes(u) && dist[v] + wt < dist[u]) (dist[u] = dist[v] + wt), (prev[u] = v), relaxed.push(u);
      });
    }
    return { dist, prev, done, relaxed };
  }
  GBC.widget('dijkstra', (el) => {
    const s = { k: 0, t: 6 };
    const n = DG.names.length;
    const w = ui.shell(el, { title: 'Алгоритм Дейкстры: кратчайший путь во взвешенном графе', sub: 'Числа на рёбрах — длины, над вершинами — текущие оценки расстояния от S. На каждом шаге окончательной становится ближайшая незавершённая вершина, и через неё улучшаются оценки соседей.' });
    ui.player(w.controls, { label: 'Шаг', min: 0, max: n, value: 0, fps: 1, format: (k) => 'шаг ' + k, onChange: (k) => ((s.k = k), draw()) });
    ui.select(w.controls, { label: 'Куда идём', value: s.t, options: U.range(n - 1, 1).map((i) => ({ value: i, label: DG.names[i] })), onChange: (v) => ((s.t = +v), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 290 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'done', label: 'завершено' }, { key: 'd', label: 'расстояние до цели' }, { key: 'p', label: 'путь' }]);
    function draw() {
      const { dist, prev, done, relaxed } = dijkstra(s.k);
      const tree = done.concat(relaxed).filter((v) => prev[v] >= 0).map((v) => [prev[v], v]);
      const path = [];
      if (done.includes(s.t)) for (let v = s.t; v >= 0; v = prev[v]) path.unshift(v);
      const onPath = (e) => path.some((v, i) => i > 0 && ((path[i - 1] === e[0] && v === e[1]) || (path[i - 1] === e[1] && v === e[0])));
      const inTree = (e) => tree.some((t) => (t[0] === e[0] && t[1] === e[1]) || (t[0] === e[1] && t[1] === e[0]));
      const cur = done[done.length - 1];
      gv.draw({
        nodes: DG.pos.map(([x, y], i) => ({
          x, y, r: 16, label: DG.names[i], fill: i === cur ? 'tree' : done.includes(i) ? 'model' : relaxed.includes(i) ? 'yellow' : null, fillP: i === cur ? 55 : 30,
          color: i === s.t ? 'tree' : 'model', width: i === s.t ? 3 : 2, top: dist[i] === Infinity ? '∞' : String(dist[i]), topColor: done.includes(i) ? 'model' : 'ink2',
        })),
        edges: DG.edges.map((e) => ({ a: e[0], b: e[1], color: onPath(e) ? 'tree' : inTree(e) ? 'model' : 'muted', width: onPath(e) ? 4.5 : inTree(e) ? 3 : 1.8, label: String(e[2]), lbold: onPath(e) })),
      });
      line.textContent = 'Оценки: ' + DG.names.map((nm, i) => nm + '=' + (dist[i] === Infinity ? '∞' : dist[i])).join('  ') + '\nЗавершены по порядку: ' + (done.map((v) => DG.names[v]).join(', ') || '—') + (relaxed.length ? '\nНа этом шаге улучшены: ' + relaxed.map((v) => DG.names[v]).join(', ') : '');
      st.set('done', done.length + ' из ' + n);
      st.set('d', done.includes(s.t) ? String(dist[s.t]) : dist[s.t] === Infinity ? '∞' : '≤ ' + dist[s.t]);
      st.set('p', path.length ? path.map((v) => DG.names[v]).join('→') : '—');
      note.innerHTML = 'Прямое ребро S–A длины 4 проигрывает обходу S → B → A длины 2 + 1 = 3 — поэтому оценки «улучшаются» (<b>релаксация</b>). Алгоритм верен, пока длины <b>неотрицательны</b>: завершённую вершину уже нельзя улучшить, ведь любой другой путь к ней проходит через вершину с не меньшей оценкой. С кучей он делает O((|V| + |E|) log |V|) операций. До T кратчайший путь S → B → A → C → E → T длины 12 — на два ребра длиннее «прямого» S → B → D → T, но короче (12 против 18).';
    }
    w.pythonAction(() => 'import heapq\n\nedges = [' + DG.edges.map(([a, b, wt]) => '("' + DG.names[a] + '", "' + DG.names[b] + '", ' + wt + ')').join(', ') + ']\nadj = {}\nfor a, b, w in edges:\n    adj.setdefault(a, []).append((b, w))\n    adj.setdefault(b, []).append((a, w))\n\ndist, prev, pq, done = {"S": 0}, {}, [(0, "S")], []\nwhile pq:\n    d, v = heapq.heappop(pq)\n    if v in done:\n        continue\n    done.append(v)\n    for u, w in adj[v]:\n        if d + w < dist.get(u, float("inf")):\n            dist[u], prev[u] = d + w, v\n            heapq.heappush(pq, (d + w, u))\n\npath, v = ["' + DG.names[s.t] + '"], "' + DG.names[s.t] + '"\nwhile v != "S":\n    v = prev[v]\n    path.append(v)\nprint("порядок завершения:", done)\nprint(dist)\nprint(" → ".join(reversed(path)), "длина", dist["' + DG.names[s.t] + '"])\n');
    draw();
  });

  /* ==============================================================================
   * 13. Отрицательные веса: Беллман — Форд и арбитраж
   * ============================================================================== */
  const NEG = {
    names: ['S', 'A', 'B', 'C', 'T'],
    pos: [[50, 150], [220, 60], [220, 240], [380, 60], [470, 190]],
    edges: [[0, 1, 2], [0, 2, 4], [2, 1, -4], [1, 3, 3], [3, 4, 2], [2, 4, 6]],
  };
  const CUR = { names: ['USD', 'EUR', 'GBP', 'JPY', 'CHF'], val: [1, 1.087, 1.264, 0.0067, 1.12] };
  function bellmanFord(n, edges, src) {
    const dist = new Array(n).fill(Infinity);
    const par = new Array(n).fill(-1);
    dist[src] = 0;
    const rounds = [{ dist: dist.slice(), changed: [] }];
    let lastChanged = -1;
    for (let r = 1; r <= n; r++) {
      const changed = [];
      edges.forEach(([a, b, wt]) => {
        if (dist[a] + wt < dist[b] - 1e-12) {
          dist[b] = dist[a] + wt;
          par[b] = a;
          changed.push(b);
          lastChanged = b;
        }
      });
      rounds.push({ dist: dist.slice(), changed, par: par.slice() });
      if (!changed.length) break;
    }
    let cycle = null;
    if (rounds.length === n + 1 && rounds[n].changed.length) {
      let v = lastChanged;
      for (let i = 0; i < n; i++) v = par[v];
      cycle = [v];
      for (let u = par[v]; u !== v; u = par[u]) cycle.push(u);
      cycle.push(v);
      cycle.reverse();
    }
    return { rounds, cycle };
  }
  function dijkstraNaive(n, edges, src) {
    const dist = new Array(n).fill(Infinity);
    dist[src] = 0;
    const done = [];
    for (;;) {
      let v = -1;
      for (let i = 0; i < n; i++) if (!done.includes(i) && dist[i] < Infinity && (v < 0 || dist[i] < dist[v])) v = i;
      if (v < 0) break;
      done.push(v);
      edges.forEach(([a, b, wt]) => a === v && !done.includes(b) && dist[v] + wt < dist[b] && (dist[b] = dist[v] + wt));
    }
    return dist;
  }
  GBC.widget('bellman-ford', (el) => {
    const s = { mode: 'neg', r: 0, gbp: 1.27 };
    const w = ui.shell(el, { title: 'Отрицательные веса: алгоритм Беллмана — Форда', sub: 'Беллман — Форд просто повторяет релаксацию всех рёбер: |V| − 1 раундов гарантированно хватает. Если и на |V|-м раунде что-то улучшилось — в графе есть цикл отрицательного веса.' });
    ui.segmented(w.controls, { label: 'Пример', value: s.mode, options: [{ value: 'neg', label: 'отрицательное ребро' }, { value: 'fx', label: 'арбитраж валют' }], onChange: (v) => ((s.mode = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Раунд', min: 0, max: 5, value: 0, fps: 0.8, format: (k) => 'раунд ' + k, onChange: (k) => ((s.r = k), draw()) });
    const rs = ui.slider(w.controls, { label: 'Курс GBP → USD', min: 1.255, max: 1.285, step: 0.001, value: s.gbp, format: (v) => v.toFixed(3), onInput: (v) => ((s.gbp = v), reset()) });
    const gv = new GraphView(w.main, { w: 520, h: 290 });
    const tbl = H('div');
    const line = monoBox();
    w.main.append(tbl, line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'раунд' }, { key: 'ch', label: 'улучшено в раунде' }, { key: 'res', label: 'вывод' }]);
    function fxEdges() {
      const n = 5;
      const E = [];
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) {
        let rate = Number(((CUR.val[a] / CUR.val[b]) * 0.999).toPrecision(5));
        if (a === 2 && b === 0) rate = s.gbp;
        E.push([a, b, -Math.log(rate), rate]);
      }
      return E;
    }
    function model() {
      if (s.mode === 'neg') return { n: 5, names: NEG.names, E: NEG.edges };
      return { n: 5, names: CUR.names, E: fxEdges() };
    }
    function reset() {
      rs.el.style.display = s.mode === 'fx' ? '' : 'none';
      const M = model();
      const R = bellmanFord(M.n, M.E, 0);
      pl.stop();
      pl.setMax(R.rounds.length - 1);
      pl.set(R.rounds.length - 1);
      s.r = R.rounds.length - 1;
      draw();
    }
    function draw() {
      const M = model();
      const R = bellmanFord(M.n, M.E, 0);
      const r = Math.min(s.r, R.rounds.length - 1);
      const cur = R.rounds[r];
      const final = r === R.rounds.length - 1;
      const showCycle = final && R.cycle;
      const cycE = showCycle ? R.cycle.slice(1).map((v, i) => [R.cycle[i], v]) : [];
      const onCyc = (e) => cycE.some((c) => c[0] === e[0] && c[1] === e[1]);
      if (s.mode === 'neg') {
        gv.draw({
          nodes: NEG.pos.map(([x, y], i) => ({ x, y, r: 16, label: NEG.names[i], fill: cur.changed.includes(i) ? 'tree' : null, fillP: 45, top: dstr(cur.dist[i]), topColor: 'model' })),
          edges: NEG.edges.map((e) => ({ a: e[0], b: e[1], arrow: true, color: e[2] < 0 ? 'red' : cur.par && cur.par[e[1]] === e[0] ? 'model' : 'ink2', width: e[2] < 0 || (cur.par && cur.par[e[1]] === e[0]) ? 3 : 1.8, label: String(e[2]).replace('-', '−'), lbold: e[2] < 0 })),
        });
        const dj = dijkstraNaive(5, NEG.edges, 0);
        const bf = R.rounds[R.rounds.length - 1].dist;
        cellTable(tbl, ['', ...NEG.names], [['Дейкстра'].concat(dj.map((d, i) => ({ t: dstr(d), hl: d !== bf[i] ? 'red' : null }))), ['Беллман — Форд'].concat(bf.map((d) => ({ t: dstr(d), hl: 'good' })))], { compact: true });
        line.textContent = 'Раунды (рёбра в порядке S→A, S→B, B→A, A→C, C→T, B→T):\n' + R.rounds.slice(0, r + 1).map((rd, i) => i + ': ' + rd.dist.map(dstr).join('  ') + (rd.changed.length ? '   улучшены ' + [...new Set(rd.changed)].map((v) => NEG.names[v]).join(', ') : i ? '   без изменений — стоп' : '')).join('\n');
        st.set('res', final ? 'расстояния найдены' : '…');
        note.innerHTML = 'Ребро B → A стоит −4 (например, это возврат денег или скидка). Дейкстра завершает A с оценкой 2 раньше, чем видит путь S → B → A = 4 − 4 = 0, — и ошибается в A, C и T (красные ячейки). <b>Беллман — Форд</b> не завершает вершины досрочно: в каждом раунде он релаксирует все рёбра. После раунда i верны все кратчайшие пути из не более чем i рёбер, а простой путь содержит не больше |V| − 1 рёбер. Цена надёжности — O(|V|·|E|) вместо O(|E| log |V|).';
      } else {
        const pos = circlePos(5, 260, 150, 115);
        gv.draw({
          nodes: pos.map(([x, y], i) => ({ x, y, r: 21, label: CUR.names[i], size: 12, fill: R.cycle && R.cycle.includes(i) && showCycle ? 'red' : cur.changed.includes(i) ? 'tree' : null, fillP: 35, top: i ? dstr(Math.round(cur.dist[i] * 1e4) / 1e4) : '0', topColor: 'model', topSize: 11 })),
          edges: M.E.map((e) => ({ a: e[0], b: e[1], arrow: true, bend: 9, color: onCyc(e) ? 'red' : 'muted', width: onCyc(e) ? 3.2 : 1, opacity: onCyc(e) ? 1 : 0.55, label: onCyc(e) ? e[3].toFixed(4) : '', lbold: true, lcolor: 'critical' })),
        });
        cellTable(tbl, ['из \\ в', ...CUR.names], CUR.names.map((nm, a) => [nm].concat(CUR.names.map((_, b) => {
          if (a === b) return '—';
          const e = M.E.find((x) => x[0] === a && x[1] === b);
          return { t: e[3] < 0.01 ? e[3].toPrecision(4) : e[3] < 10 ? e[3].toFixed(4) : e[3].toFixed(2), hl: onCyc(e) ? 'red' : null };
        }))), { compact: true });
        const prod = showCycle ? cycE.reduce((p, c) => p * M.E.find((e) => e[0] === c[0] && e[1] === c[1])[3], 1) : null;
        line.textContent = 'Вес ребра w = −ln(курс): произведение курсов > 1 ⇔ сумма весов < 0.\nНад вершинами — текущие расстояния d (лучший обмен 1 USD → e^(−d) единиц валюты).' + (showCycle ? '\nЦикл арбитража: ' + R.cycle.map((v) => CUR.names[v]).join(' → ') + ';  произведение курсов ' + prod.toFixed(5) + ' → прибыль ' + pct(prod - 1, 3) + ' за круг' : final ? '\nНа 5-м раунде ничего не улучшилось — отрицательных циклов (арбитража) нет.' : '');
        st.set('res', final ? (R.cycle ? 'арбитраж!' : 'арбитража нет') : '…');
        note.innerHTML = 'Курсы обмена — граф: из валюты a в валюту b ведёт ребро с курсом r. Обмен по цепочке перемножает курсы, а логарифм превращает произведение в сумму: с весами −ln r выгодный цикл (произведение > 1) становится <b>циклом отрицательного веса</b>. Курсы в таблице согласованы и учитывают комиссию 0.1 %, кроме одного — GBP → USD. Безубыточный курс — 1.264 / 0.999 ≈ 1.2653: сдвиньте ползунок ниже, и арбитраж исчезнет. В отрицательном цикле «кратчайшего пути» нет вовсе — можно крутиться бесконечно, и Беллман — Форд это честно сообщает.';
      }
      st.set('r', r + ' из ' + (R.rounds.length - 1));
      st.set('ch', cur.changed.length ? [...new Set(cur.changed)].map((v) => M.names[v]).join(', ') : '—');
    }
    w.pythonAction(() => {
      const M = model();
      const E = M.E.map((e) => [M.names[e[0]], M.names[e[1]], s.mode === 'fx' ? e[3] : e[2]]);
      return 'from math import log\n\nnames = ' + pyList(M.names) + '\nedges = ' + pyList(E) + (s.mode === 'fx' ? '\nedges = [(a, b, -log(rate)) for a, b, rate in edges]     # вес = −ln(курс)' : '') + '\n\ndist = {v: float("inf") for v in names}\npar = {v: None for v in names}\ndist[names[0]] = 0\nfor rnd in range(1, len(names) + 1):\n    changed = None\n    for a, b, w in edges:\n        if dist[a] + w < dist[b] - 1e-12:\n            dist[b], par[b], changed = dist[a] + w, a, b\n    if changed is None:\n        print("раунд", rnd, ": без изменений, расстояния:", {v: round(d, 4) for v, d in dist.items()})\n        break\nelse:\n    v = changed\n    for _ in names:\n        v = par[v]\n    cycle, u = [v], par[v]\n    while u != v:\n        cycle.append(u)\n        u = par[u]\n    print("цикл отрицательного веса:", " → ".join(reversed(cycle + [v])))\n';
    });
    reset();
  });

  /* ==============================================================================
   * 14. Все пары: Флойд — Уоршелл
   * ============================================================================== */
  const FW = {
    names: 'ABCDEF'.split(''),
    pos: [[60, 80], [200, 40], [190, 200], [340, 90], [330, 250], [470, 160]],
    edges: [[0, 1, 3], [0, 2, 8], [1, 2, 2], [1, 3, 5], [2, 4, 4], [3, 4, 1], [3, 5, 6], [4, 5, 2]],
  };
  function floydSteps() {
    const n = FW.names.length;
    const D = U.range(n).map((i) => U.range(n).map((j) => (i === j ? 0 : Infinity)));
    const nxt = U.range(n).map(() => new Array(n).fill(-1));
    FW.edges.forEach(([a, b, wt]) => ((D[a][b] = D[b][a] = wt), (nxt[a][b] = b), (nxt[b][a] = a)));
    for (let i = 0; i < n; i++) nxt[i][i] = i;
    const snaps = [{ D: D.map((r) => r.slice()), nxt: nxt.map((r) => r.slice()), changed: [] }];
    for (let k = 0; k < n; k++) {
      const changed = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (D[i][k] + D[k][j] < D[i][j]) (D[i][j] = D[i][k] + D[k][j]), (nxt[i][j] = nxt[i][k]), changed.push([i, j]);
      snaps.push({ D: D.map((r) => r.slice()), nxt: nxt.map((r) => r.slice()), changed });
    }
    return snaps;
  }
  GBC.widget('floyd', (el) => {
    const SN = floydSteps();
    const n = FW.names.length;
    const s = { k: n, i: 0, j: 5 };
    const w = ui.shell(el, { title: 'Флойд — Уоршелл: расстояния между всеми парами', sub: 'Шаг k разрешает проходить через вершины A…k. Ячейка обновляется, если путь «i → k → j» короче известного. Щёлкните по ячейке матрицы, чтобы увидеть сам путь.' });
    ui.player(w.controls, { label: 'Промежуточные вершины', min: 0, max: n, value: n, fps: 0.8, format: (k) => (k ? 'через A…' + FW.names[k - 1] : 'только рёбра'), onChange: (k) => ((s.k = k), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 290 });
    const tbl = H('div');
    const line = monoBox();
    w.main.append(tbl, line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ch', label: 'обновлено ячеек на шаге' }, { key: 'diam', label: 'диаметр' }, { key: 'ctr', label: 'центр графа' }]);
    function draw() {
      const sn = SN[s.k];
      const D = sn.D;
      const path = [];
      if (D[s.i][s.j] < Infinity) {
        let u = s.i;
        path.push(u);
        while (u !== s.j) (u = sn.nxt[u][s.j]), path.push(u);
      }
      const onP = (e) => path.some((v, t) => t > 0 && ((path[t - 1] === e[0] && v === e[1]) || (path[t - 1] === e[1] && v === e[0])));
      const kv = s.k ? s.k - 1 : -1;
      gv.draw({
        nodes: FW.pos.map(([x, y], i) => ({ x, y, r: 16, label: FW.names[i], fill: i === kv ? 'yellow' : i < s.k ? 'model' : null, fillP: i === kv ? 60 : 22, color: i === s.i || i === s.j ? 'tree' : 'model', width: i === s.i || i === s.j ? 3.2 : 2 })),
        edges: FW.edges.map((e) => ({ a: e[0], b: e[1], color: onP(e) ? 'tree' : 'ink2', width: onP(e) ? 4.2 : 1.8, label: String(e[2]), lbold: onP(e) })),
      });
      const ch = new Set(sn.changed.map(([i, j]) => i * n + j));
      cellTable(tbl, [''].concat(FW.names), U.range(n).map((i) => [FW.names[i]].concat(U.range(n).map((j) => ({ t: dstr(D[i][j]), hl: i === s.i && j === s.j ? 'tree' : ch.has(i * n + j) ? 'yellow' : null, bold: ch.has(i * n + j) })))), { compact: true, click: (i, j) => ((s.i = i), (s.j = j), draw()) });
      const ecc = U.range(n).map((i) => Math.max(...D[i]));
      const minE = Math.min(...ecc);
      line.textContent = 'Путь ' + FW.names[s.i] + ' → ' + FW.names[s.j] + ': ' + (path.length ? path.map((v) => FW.names[v]).join(' → ') + '  (длина ' + dstr(D[s.i][s.j]) + ')' : 'пока неизвестен (∞)') + '\nЭксцентриситеты (самое дальнее расстояние): ' + FW.names.map((nm, i) => nm + '=' + dstr(ecc[i])).join(' ');
      st.set('ch', s.k ? String(sn.changed.length) : '—');
      st.set('diam', dstr(Math.max(...ecc)));
      st.set('ctr', minE < Infinity ? FW.names.filter((_, i) => ecc[i] === minE).join(', ') + ' (' + minE + ')' : '—');
      note.innerHTML = 'Три вложенных цикла — и все расстояния найдены: <b>динамическое программирование</b> по множеству разрешённых промежуточных вершин. D<sub>k</sub>[i][j] = min(D<sub>k−1</sub>[i][j], D<sub>k−1</sub>[i][k] + D<sub>k−1</sub>[k][j]). Время O(|V|³), память O(|V|²) — хорошо для плотных графов до нескольких тысяч вершин. Работает и с отрицательными рёбрами (отрицательный цикл виден по D[i][i] &lt; 0). По готовой матрице считают <b>диаметр</b> (наибольшее расстояние), <b>эксцентриситеты</b> и <b>центр</b> — вершину, от которой до всех ближе всего: туда ставят склад или сервер.';
    }
    w.pythonAction(() => 'import numpy as np\nfrom scipy.sparse.csgraph import floyd_warshall\n\nnames = "ABCDEF"\nedges = ' + pyList(FW.edges) + '\nn = len(names)\nD = np.full((n, n), np.inf)\nnp.fill_diagonal(D, 0)\nfor a, b, w in edges:\n    D[a, b] = D[b, a] = w\nW = D.copy()\nfor k in range(n):                       # разрешаем проходить через вершину k\n    D = np.minimum(D, D[:, [k]] + D[[k], :])\nprint(D)\nprint("совпадает со scipy:", np.allclose(D, floyd_warshall(np.where(np.isinf(W), 0, W), directed=False)))\necc = D.max(axis=1)\nprint("диаметр:", ecc.max(), " центр:", names[int(ecc.argmin())], ecc.min())\n');
    draw();
  });

  /* ==============================================================================
   * 15. Что такое дерево: удаляем и добавляем рёбра
   * ============================================================================== */
  function pruferDecode(code, n) {
    const deg = new Array(n).fill(1);
    code.forEach((v) => deg[v]++);
    const E = [];
    code.forEach((v) => {
      let leaf = 0;
      while (deg[leaf] !== 1) leaf++;
      E.push([leaf, v]);
      deg[leaf]--;
      deg[v]--;
    });
    const rest = U.range(n).filter((i) => deg[i] === 1);
    E.push([rest[0], rest[1]]);
    return E;
  }
  function pruferEncode(n, E) {
    const adj = U.range(n).map(() => new Set());
    E.forEach(([a, b]) => (adj[a].add(b), adj[b].add(a)));
    const steps = [];
    for (let t = 0; t < n - 2; t++) {
      let leaf = 0;
      while (adj[leaf].size !== 1) leaf++;
      const nb = [...adj[leaf]][0];
      steps.push({ leaf, nb });
      adj[nb].delete(leaf);
      adj[leaf].clear();
    }
    return steps;
  }
  function randomTree(n, seed) {
    const rng = new GBC.RNG(seed);
    const code = U.range(n - 2).map(() => rng.randint(n));
    return { code, E: pruferDecode(code, n) };
  }
  GBC.widget('tree-props', (el) => {
    const n = 10;
    const s = { seed: 4, mode: 'remove', cut: -1, a: -1, b: -1 };
    const w = ui.shell(el, { title: 'Дерево: связно, без циклов и «на грани»', sub: 'Удалите любое ребро — дерево распадётся на две части. Добавьте любое ребро — появится ровно один цикл. Между любыми двумя вершинами путь единственный.' });
    ui.segmented(w.controls, { label: 'Что делаем', value: s.mode, options: [{ value: 'remove', label: 'удаляем ребро' }, { value: 'add', label: 'добавляем ребро' }, { value: 'path', label: 'путь между двумя' }], onChange: (v) => ((s.mode = v), (s.cut = s.a = s.b = -1), draw()) });
    ui.button(w.controls, { label: 'Другое дерево', icon: 'reset', onClick: () => (s.seed++, (s.cut = s.a = s.b = -1), draw()) });
    const gv = new GraphView(w.main, {
      w: 520, h: 290,
      onNode: (i) => {
        if (s.mode === 'remove') return;
        if (s.a < 0 || s.b >= 0) (s.a = i), (s.b = -1);
        else if (i !== s.a) s.b = i;
        draw();
      },
      onEdge: (i) => {
        if (s.mode !== 'remove') return;
        s.cut = s.cut === i ? -1 : i;
        draw();
      },
    });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 've', label: 'вершин / рёбер' }, { key: 'c', label: 'компонент' }, { key: 'cyc', label: 'циклов |E| − |V| + k' }, { key: 'leaf', label: 'листьев' }]);
    function draw() {
      const T = randomTree(n, s.seed);
      let L = treeLayout(n, T.E, 0, 20, 500, 35, 62);
      if (L.maxDepth * 62 > 230) L = treeLayout(n, T.E, 0, 20, 500, 35, 230 / L.maxDepth);
      const E = T.E.slice();
      let extra = null;
      if (s.mode === 'add' && s.a >= 0 && s.b >= 0 && !E.some((e) => (e[0] === s.a && e[1] === s.b) || (e[1] === s.a && e[0] === s.b))) extra = [s.a, s.b];
      const keep = E.filter((_, i) => !(s.mode === 'remove' && i === s.cut));
      const allE = extra ? keep.concat([extra]) : keep;
      const adjK = adjList(n, keep);
      const C = components(n, adjK);
      let path = [];
      if ((s.mode === 'add' || s.mode === 'path') && s.a >= 0 && s.b >= 0) {
        const par = new Array(n).fill(-1);
        const d = bfsDist(adjK, s.a);
        const q = [s.a];
        const seen = new Set([s.a]);
        for (let h = 0; h < q.length; h++) for (const u of adjK[q[h]]) if (!seen.has(u)) (seen.add(u), (par[u] = q[h]), q.push(u));
        if (d[s.b] >= 0) for (let v = s.b; v >= 0; v = par[v]) path.unshift(v);
      }
      const onP = (e) => path.some((v, t) => t > 0 && ((path[t - 1] === e[0] && v === e[1]) || (path[t - 1] === e[1] && v === e[0])));
      const deg = adjList(n, T.E).map((a) => a.length);
      gv.draw({
        nodes: L.pos.map(([x, y], i) => ({ x, y, r: 15, label: String(i + 1), fill: s.mode === 'remove' && s.cut >= 0 ? (C.comp[i] ? 'orange' : 'blue') : i === s.a || i === s.b ? 'tree' : deg[i] === 1 ? 'aqua' : null, fillP: 35, color: i === s.a || i === s.b ? 'tree' : 'model', width: i === s.a || i === s.b ? 3 : 2 })),
        edges: T.E.map((e, i) => (s.mode === 'remove' && i === s.cut ? { a: e[0], b: e[1], color: 'red', width: 2.5, dash: true } : { a: e[0], b: e[1], color: onP(e) ? (extra ? 'red' : 'tree') : 'ink2', width: onP(e) ? 4 : 2.2 })).concat(extra ? [{ a: extra[0], b: extra[1], color: 'red', width: 3.5, bend: 30, hit: false }] : []),
      });
      const cyc = allE.length - n + components(n, adjList(n, allE)).k;
      st.set('ve', n + ' / ' + allE.length);
      st.set('c', String(components(n, adjList(n, allE)).k));
      st.set('cyc', String(cyc));
      st.set('leaf', String(deg.filter((d) => d === 1).length));
      if (s.mode === 'remove') line.textContent = s.cut < 0 ? 'Щёлкните по любому ребру, чтобы «перерезать» его.' : 'Ребро ' + (T.E[s.cut][0] + 1) + '–' + (T.E[s.cut][1] + 1) + ' удалено: части {' + U.range(n).filter((i) => !C.comp[i]).map((i) => i + 1).join(', ') + '} и {' + U.range(n).filter((i) => C.comp[i]).map((i) => i + 1).join(', ') + '}. Каждое ребро дерева — мост.';
      else if (s.mode === 'add') line.textContent = s.a < 0 || s.b < 0 ? 'Щёлкните по двум вершинам, не соединённым ребром.' : extra ? 'Новое ребро ' + (s.a + 1) + '–' + (s.b + 1) + ' вместе с путём ' + path.map((v) => v + 1).join('–') + ' образует цикл длины ' + path.length + '.' : 'Эти вершины уже соединены ребром — выберите другую пару.';
      else line.textContent = s.a < 0 || s.b < 0 ? 'Щёлкните по двум вершинам.' : 'Единственный путь: ' + path.map((v) => v + 1).join(' → ') + ' (' + nWord(path.length - 1, 'ребро', 'ребра', 'рёбер') + ')';
      note.innerHTML = 'Дерево — граф «на грани»: рёбер ровно столько, сколько нужно для связности (|E| = |V| − 1 = ' + (n - 1) + '), и ни одного лишнего. Отсюда четыре равносильных определения: связный без циклов; связный с |V| − 1 рёбрами; без циклов с |V| − 1 рёбрами; между любыми двумя вершинами ровно один путь. Бирюзовые вершины — <b>листья</b> (степень 1); у любого дерева с ≥ 2 вершинами их не меньше двух: самый длинный путь обязан начинаться и кончаться в листьях.';
    }
    draw();
  });

  /* ==============================================================================
   * 16. Корневое дерево и его обходы
   * ============================================================================== */
  const TT = {
    expr: {
      label: 'выражение',
      lab: ['×', '+', '−', 'a', 'b', 'c', '/', 'd', 'e'], kids: [[1, 2], [3, 4], [5, 6], [], [], [], [7, 8], [], []],
      val: { a: 2, b: 3, c: 10, d: 8, e: 4 },
    },
    dtree: {
      label: 'дерево решений',
      lab: ['x₁ ≤ 5', 'x₂ ≤ 3', 'x₂ ≤ 7', '0.2', 'x₁ ≤ 2', '0.6', '0.9', '0.1', '0.4'], kids: [[1, 2], [3, 4], [5, 6], [], [7, 8], [], [], [], []],
    },
  };
  function ttOrders(T) {
    const pre = [];
    const ino = [];
    const post = [];
    (function walk(v) {
      pre.push(v);
      if (T.kids[v].length) walk(T.kids[v][0]);
      ino.push(v);
      if (T.kids[v].length) walk(T.kids[v][1]);
      post.push(v);
    })(0);
    const lvl = [];
    const q = [0];
    for (let h = 0; h < q.length; h++) (lvl.push(q[h]), T.kids[q[h]].forEach((c) => q.push(c)));
    return { pre, ino, post, lvl };
  }
  GBC.widget('tree-traversal', (el) => {
    const s = { t: 'expr', ord: 'post', k: 9 };
    const w = ui.shell(el, { title: 'Корневое дерево и четыре порядка обхода', sub: 'Прямой: узел, потом дети. Симметричный: левый, узел, правый. Обратный: дети, потом узел. По уровням: волнами, как BFS. Числа над узлами — порядок посещения.' });
    ui.segmented(w.controls, { label: 'Дерево', value: s.t, options: Object.keys(TT).map((k) => ({ value: k, label: TT[k].label })), onChange: (v) => ((s.t = v), (s.k = 9), pl.set(9), draw()) });
    ui.segmented(w.controls, { label: 'Порядок', value: s.ord, options: [{ value: 'pre', label: 'прямой' }, { value: 'ino', label: 'симметричный' }, { value: 'post', label: 'обратный' }, { value: 'lvl', label: 'по уровням' }], onChange: (v) => ((s.ord = v), pl.stop(), pl.set(0), (s.k = 0), draw()) });
    const pl = ui.player(w.controls, { label: 'Шаг', min: 0, max: 9, value: 9, fps: 1.5, format: (k) => k + ' из 9', onChange: (k) => ((s.k = k), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 270 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'h', label: 'высота' }, { key: 'in', label: 'внутренних / листьев' }, { key: 'res', label: 'результат' }]);
    function draw() {
      const T = TT[s.t];
      const E = [];
      T.kids.forEach((ks, v) => ks.forEach((c) => E.push([v, c])));
      const L = treeLayout(9, E, 0, 30, 490, 35, 66);
      const O = ttOrders(T)[s.ord];
      const vis = O.slice(0, s.k);
      const cur = vis[vis.length - 1];
      const leaf = (v) => !T.kids[v].length;
      gv.draw({
        nodes: L.pos.map(([x, y], i) => ({ x, y, r: s.t === 'dtree' && !leaf(i) ? 22 : 17, shape: leaf(i) ? 'square' : undefined, label: T.lab[i], size: s.t === 'dtree' && !leaf(i) ? 10.5 : 14, fill: i === cur ? 'tree' : vis.includes(i) ? 'model' : null, fillP: i === cur ? 55 : 30, color: i === cur ? 'tree' : 'model', width: i === cur ? 3 : 2, top: vis.includes(i) ? String(vis.indexOf(i) + 1) : '', topColor: 'model', topDx: 24 })),
        edges: E.map((e) => ({ a: e[0], b: e[1], color: 'ink2', width: 2, label: s.t === 'dtree' ? (T.kids[e[0]][0] === e[1] ? 'да' : 'нет') : '', lsize: 11 })),
      });
      const seq = vis.map((v) => T.lab[v]).join(' ');
      let extra = '';
      let res = '—';
      if (s.t === 'expr' && s.ord === 'post') {
        const stack = [];
        const trace = [];
        vis.forEach((v) => {
          const l = T.lab[v];
          if (leaf(v)) stack.push(T.val[l]);
          else {
            const b = stack.pop();
            const a = stack.pop();
            stack.push(l === '+' ? a + b : l === '−' ? a - b : l === '×' ? a * b : a / b);
          }
          trace.push('[' + stack.join(', ') + ']');
        });
        extra = '\nСтек вычисления (a=2, b=3, c=10, d=8, e=4): ' + (trace[trace.length - 1] || '[]');
        res = s.k === 9 ? String(stack[0]) : '…';
      } else if (s.t === 'expr' && s.ord === 'ino') extra = '\nСимметричный порядок теряет скобки: нужно (a + b) × (c − d / e).';
      else if (s.t === 'dtree' && s.ord === 'pre') extra = '\nТак (в прямом порядке) деревья выгружают в текст: XGBoost dump, sklearn export_text.';
      line.textContent = 'Посещено: ' + (seq || '—') + extra;
      st.set('h', String(L.maxDepth));
      st.set('in', T.kids.filter((k) => k.length).length + ' / ' + T.kids.filter((k) => !k.length).length);
      st.set('res', res);
      note.innerHTML = s.t === 'expr'
        ? 'Выражение (a + b) × (c − d / e) — бинарное дерево: операции внутри, числа в листьях. <b>Обратный</b> порядок даёт обратную польскую запись «a b + c d e / − ×», которую вычисляют одним стеком без скобок — так работают калькуляторы и интерпретаторы. <b>Прямой</b> — польская запись «× + a b − c / d e». Высота дерева 3 — столько уровней вложенности у выражения.'
        : 'Дерево решений: внутренние узлы — вопросы, листья — ответы. У бинарного дерева листьев всегда на один больше, чем внутренних узлов (каждое разбиение превращает один лист в два): здесь 4 внутренних и 5 листьев. Прогноз — путь от корня, его длина не больше высоты. Обратный порядок нужен при <b>обрезке</b> дерева: решение о узле принимают, когда дети уже обработаны.';
    }
    w.pythonAction(() => 'tree = {"×": ("+", "−"), "+": ("a", "b"), "−": ("c", "/"), "/": ("d", "e")}\nval = {"a": 2, "b": 3, "c": 10, "d": 8, "e": 4}\n\ndef pre(v):\n    return [v] + (pre(tree[v][0]) + pre(tree[v][1]) if v in tree else [])\n\ndef ino(v):\n    return ino(tree[v][0]) + [v] + ino(tree[v][1]) if v in tree else [v]\n\ndef post(v):\n    return (post(tree[v][0]) + post(tree[v][1]) if v in tree else []) + [v]\n\nprint("прямой:       ", " ".join(pre("×")))\nprint("симметричный: ", " ".join(ino("×")))\nprint("обратный:     ", " ".join(post("×")))\nstack = []\nfor t in post("×"):\n    if t in val:\n        stack.append(val[t])\n    else:\n        b, a = stack.pop(), stack.pop()\n        stack.append({"+": a + b, "−": a - b, "×": a * b, "/": a / b}[t])\nprint("значение:", stack[0])\n');
    draw();
  });

  /* ==============================================================================
   * 17. Сколько деревьев: код Прюфера и формула Кэли
   * ============================================================================== */
  GBC.widget('prufer', (el) => {
    const s = { n: 7, seed: 2, k: 0, all: false };
    const w = ui.shell(el, { title: 'Код Прюфера: каждое дерево — строка из n − 2 чисел', sub: 'Кодирование: снова и снова отрываем самый маленький лист и записываем номер его соседа. Каждое помеченное дерево даёт свою строку, и каждая строка — своё дерево. Отсюда формула Кэли.' });
    ui.slider(w.controls, { label: 'Вершин n', min: 3, max: 10, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Шаг кодирования', min: 0, max: 5, value: 0, fps: 1, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    ui.button(w.controls, { label: 'Другое дерево', icon: 'reset', onClick: () => (s.seed++, reset()) });
    ui.toggle(w.controls, { label: 'Показать все деревья для n = 4', checked: false, onChange: (v) => ((s.all = v), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 270 });
    const allBox = H('div');
    const line = monoBox();
    w.main.append(allBox, line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'code', label: 'код Прюфера' }, { key: 'cnt', label: 'деревьев nⁿ⁻²' }, { key: 'leaf', label: 'листьев = чисел, не вошедших в код' }]);
    function reset() {
      pl.stop();
      pl.setMax(s.n - 2);
      pl.set(0);
      s.k = 0;
      draw();
    }
    function draw() {
      const n = s.n;
      const T = randomTree(n, s.seed);
      const steps = pruferEncode(n, T.E);
      let L = treeLayout(n, T.E, n - 1, 20, 500, 35, 58);
      if (L.maxDepth * 58 > 210) L = treeLayout(n, T.E, n - 1, 20, 500, 35, 210 / L.maxDepth);
      const removed = new Set(steps.slice(0, s.k).map((p) => p.leaf));
      const curS = s.k > 0 ? steps[s.k - 1] : null;
      const nextS = s.k < steps.length ? steps[s.k] : null;
      gv.draw({
        nodes: L.pos.map(([x, y], i) => ({ x, y, r: 15, label: String(i + 1), dim: removed.has(i) && (!curS || curS.leaf !== i), fill: nextS && nextS.leaf === i ? 'tree' : curS && curS.nb === i ? 'yellow' : null, fillP: 45, color: nextS && nextS.leaf === i ? 'tree' : 'model', width: nextS && nextS.leaf === i ? 3 : 2 })),
        edges: T.E.map((e) => ({ a: e[0], b: e[1], color: removed.has(e[0]) || removed.has(e[1]) ? 'muted' : 'ink2', width: 2, dash: removed.has(e[0]) || removed.has(e[1]) })),
      });
      const code = steps.map((p) => p.nb + 1);
      allBox.textContent = '';
      if (s.all) {
        const grid = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px;margin:4px 0 8px' });
        for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
          const E4 = pruferDecode([a, b], 4);
          const P4 = [[18, 18], [62, 18], [62, 62], [18, 62]];
          const sv = S('svg', { viewBox: '0 0 80 92', style: 'display:block;width:100%;height:auto;border:1px solid var(--border);border-radius:8px;background:var(--surface)' });
          E4.forEach(([x, y]) => sv.appendChild(S('line', { x1: P4[x][0], y1: P4[x][1], x2: P4[y][0], y2: P4[y][1], style: 'stroke:' + col('model') + ';stroke-width:2.5' })));
          P4.forEach(([x, y], i) => (sv.appendChild(S('circle', { cx: x, cy: y, r: 8, style: 'fill:var(--surface);stroke:' + col('model') + ';stroke-width:1.5' })), sv.appendChild(sTxt(x, y + 0.5, String(i + 1), { size: 9, bold: true }))));
          sv.appendChild(sTxt(40, 82, '(' + (a + 1) + ', ' + (b + 1) + ')', { size: 10, mono: true, color: 'ink2' }));
          grid.appendChild(sv);
        }
        allBox.appendChild(grid);
      }
      line.textContent = 'Код: (' + code.map((c, i) => (i < s.k ? String(c) : '·')).join(', ') + ')' + (nextS ? '\nСледующий шаг: самый маленький лист — ' + (nextS.leaf + 1) + ', его сосед — ' + (nextS.nb + 1) + ' → пишем ' + (nextS.nb + 1) : '\nОсталось ребро ' + U.range(n).filter((i) => !removed.has(i)).map((i) => i + 1).join('–') + ' — кодирование закончено.') + '\nСтепень вершины = 1 + сколько раз она встречается в коде.';
      st.set('code', '(' + code.join(', ') + ')');
      st.set('cnt', num(Math.pow(n, n - 2)));
      st.set('leaf', String(U.range(n).filter((i) => !code.includes(i + 1)).length));
      note.innerHTML = 'Код из n − 2 чисел, каждое от 1 до n: строк ровно n<sup>n−2</sup>, и это <b>взаимно однозначное соответствие</b> с деревьями (по коду дерево восстанавливается обратным алгоритмом). Значит, помеченных деревьев на n вершинах n<sup>n−2</sup> — <b>формула Кэли</b> (1889): 3 при n = 3, 16 при n = 4, 125 при n = 5, 10<sup>8</sup> при n = 10. Включите переключатель: 16 кодов (a, b) — 16 разных деревьев на 4 вершинах. Тот же код позволяет выбирать <b>случайное дерево</b> равновероятно — так построены деревья в этом уроке.';
    }
    w.pythonAction(() => {
      const T = randomTree(s.n, s.seed);
      return 'from itertools import product\n\ndef encode(n, edges):\n    adj = {v: set() for v in range(1, n + 1)}\n    for a, b in edges:\n        adj[a].add(b)\n        adj[b].add(a)\n    code = []\n    for _ in range(n - 2):\n        leaf = min(v for v in adj if len(adj[v]) == 1)\n        nb = adj[leaf].pop()\n        adj[nb].discard(leaf)\n        del adj[leaf]\n        code.append(nb)\n    return code\n\ndef decode(code, n):\n    deg = {v: 1 for v in range(1, n + 1)}\n    for v in code:\n        deg[v] += 1\n    edges = []\n    for v in code:\n        leaf = min(u for u in deg if deg[u] == 1)\n        edges.append((leaf, v))\n        deg[leaf] -= 1\n        deg[v] -= 1\n    a, b = [u for u in deg if deg[u] == 1]\n    return edges + [(a, b)]\n\nn = ' + s.n + '\nedges = ' + pyList(T.E.map((e) => [e[0] + 1, e[1] + 1])) + '\ncode = encode(n, edges)\nprint("код Прюфера:", code)\nprint("обратно:", sorted(map(sorted, decode(code, n))) == sorted(map(sorted, edges)))\ntrees = {frozenset(map(frozenset, decode(list(c), 4))) for c in product(range(1, 5), repeat=2)}\nprint("различных деревьев на 4 вершинах:", len(trees), "= 4^2")\n';
    });
    reset();
  });

  /* ==============================================================================
   * 18. Дерево решений как граф: пути — правила
   * ============================================================================== */
  function dtData() {
    const rng = new GBC.RNG(5);
    const X = [];
    const y = [];
    for (let i = 0; i < 160; i++) {
      const a = rng.uniform(0, 10);
      const b = rng.uniform(0, 10);
      const inside = (a > 6 && b < 6) || (a < 3 && b > 7);
      X.push([a, b]);
      y.push(rng.random() < (inside ? 0.9 : 0.1) ? 1 : 0);
    }
    return { X, y };
  }
  GBC.widget('decision-paths', (el) => {
    const D = dtData();
    const s = { depth: 3, leaf: -1 };
    const w = ui.shell(el, { title: 'Дерево решений — граф: каждый путь от корня к листу — правило', sub: 'Дерево обучено на точках справа (оранжевые — класс 1). Щёлкните по листу (квадрат) или по точке на плоскости — увидите путь, правило и область, которую лист «отвечает».' });
    ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 4, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), (s.leaf = -1), draw()) });
    const cache = {};
    const fitTree = (d) => cache[d] || (cache[d] = new GBC.RegressionTree({ maxDepth: d, minSamplesLeaf: 5 }).fit(D.X, D.y.map((v) => -v)));
    const gv = new GraphView(w.main, { w: 520, h: 300, onNode: (i) => {
      const T = fitTree(s.depth);
      if (T.nodes[i] && T.nodes[i].left < 0) (s.leaf = i), draw();
    } });
    const planeBox = H('div', { style: 'max-width:440px;margin:0 auto' });
    w.main.appendChild(planeBox);
    const plane = new GBC.Plot(planeBox, { height: 300, equal: true, x: { label: 'x_1', domain: [0, 10] }, y: { label: 'x_2', domain: [0, 10] }, onClick: (x, y) => ((s.leaf = fitTree(s.depth).applyOne([x, y])), draw()) });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'nodes', label: 'узлов (внутр. / листьев)' }, { key: 'edges', label: 'рёбер' }, { key: 'cmp', label: 'сравнений до листа' }, { key: 'acc', label: 'точность на обучении' }]);
    function draw() {
      const T = fitTree(s.depth);
      const nodesT = T.nodes;
      const N = nodesT.length;
      const E = [];
      nodesT.forEach((nd) => nd.left >= 0 && E.push([nd.id, nd.left], [nd.id, nd.right]));
      const L = treeLayout(N, E, 0, 20, 500, 30, Math.min(80, 240 / Math.max(1, T.depth)));
      const leaves = nodesT.filter((nd) => nd.left < 0);
      if (s.leaf < 0 || !nodesT[s.leaf] || nodesT[s.leaf].left >= 0) s.leaf = leaves.reduce((b, nd) => (nd.value > b.value ? nd : b), leaves[0]).id;
      const path = [s.leaf];
      for (let v = s.leaf; v > 0;) {
        v = nodesT.findIndex((nd) => nd.left === v || nd.right === v);
        path.unshift(v);
      }
      const onP = (e) => path.includes(e[0]) && path.includes(e[1]);
      const fmtT = (t) => U.fmt(t, 2);
      gv.draw({
        nodes: nodesT.map((nd, i) => nd.left >= 0
          ? { x: L.pos[i][0], y: L.pos[i][1], r: 13, label: 'x' + (nd.feature ? '₂' : '₁'), size: 11, color: path.includes(i) ? 'tree' : 'model', width: path.includes(i) ? 3 : 2, fill: path.includes(i) ? 'tree' : null, fillP: 25, side: '≤ ' + fmtT(nd.threshold), sideSize: 11.5 }
          : { x: L.pos[i][0], y: L.pos[i][1], r: 14, shape: 'square', label: U.fmt(nd.value, 2).replace(/^0\./, '.'), size: 10, fill: nd.value > 0.5 ? 'orange' : 'blue', fillP: 18 + 50 * Math.abs(nd.value - 0.5), color: i === s.leaf ? 'tree' : nd.value > 0.5 ? 'orange' : 'blue', width: i === s.leaf ? 3.4 : 2, sub: 'n=' + nd.n, subSize: 10.5 }),
        edges: E.map((e) => ({ a: e[0], b: e[1], color: onP(e) ? 'tree' : 'ink2', width: onP(e) ? 3.6 : 1.8, label: nodesT[e[0]].left === e[1] ? 'да' : 'нет', lsize: 10.5 })),
      });
      const rects = [];
      (function walk(id, x0, x1, y0, y1) {
        const nd = nodesT[id];
        if (nd.left < 0) return void rects.push({ id, x0, x1, y0, y1, v: nd.value });
        if (nd.feature === 0) (walk(nd.left, x0, Math.min(x1, nd.threshold), y0, y1), walk(nd.right, Math.max(x0, nd.threshold), x1, y0, y1));
        else (walk(nd.left, x0, x1, y0, Math.min(y1, nd.threshold)), walk(nd.right, x0, x1, Math.max(y0, nd.threshold), y1));
      })(0, 0, 10, 0, 10);
      const pal = GBC.colors.proba();
      const idx0 = U.range(D.X.length).filter((i) => !D.y[i]);
      const idx1 = U.range(D.X.length).filter((i) => D.y[i]);
      plane.render([
        ...rects.map((r) => ({ type: 'rect', x0: r.x0, x1: r.x1, y0: r.y0, y1: r.y1, fill: GBC.colors.rgbString(pal(r.v)), opacity: r.id === s.leaf ? 0.5 : 0.28, stroke: r.id === s.leaf ? 'tree' : 'surface', width: r.id === s.leaf ? 3 : 1 })),
        { type: 'points', x: idx0.map((i) => D.X[i][0]), y: idx0.map((i) => D.X[i][1]), color: 'class0', r: 4, label: 'класс 0' },
        { type: 'points', x: idx1.map((i) => D.X[i][0]), y: idx1.map((i) => D.X[i][1]), color: 'class1', r: 4, label: 'класс 1' },
      ]);
      const rule = path.slice(0, -1).map((v, t) => {
        const nd = nodesT[v];
        const left = nd.left === path[t + 1];
        return 'x' + (nd.feature ? '₂' : '₁') + (left ? ' ≤ ' : ' > ') + fmtT(nd.threshold);
      });
      const lf = nodesT[s.leaf];
      const pred = T.predict(D.X);
      const acc = U.mean(pred.map((p, i) => ((p > 0.5 ? 1 : 0) === D.y[i] ? 1 : 0)));
      line.textContent = 'Правило листа: ' + (rule.join(' и ') || 'всегда (дерево из одного листа)') + '  ⇒  доля класса 1 = ' + U.fmt(lf.value, 3) + ' (объектов: ' + lf.n + ')';
      st.set('nodes', N + ' (' + (N - leaves.length) + ' / ' + leaves.length + ')');
      st.set('edges', String(E.length));
      st.set('cmp', String(path.length - 1));
      st.set('acc', pct(acc));
      note.innerHTML = 'Дерево решений — <b>корневое бинарное дерево</b>: ' + N + ' узлов, ' + E.length + ' рёбер (на одно меньше), листьев на один больше, чем внутренних узлов. Каждый лист — <b>прямоугольник</b> на плоскости признаков, а правило листа — конъюнкция условий на пути от корня. Прогноз — один проход по пути: ' + nWord(path.length - 1, 'сравнение', 'сравнения', 'сравнений') + ', а не перебор всех правил. Поэтому деревья (и ансамбли из тысяч деревьев) предсказывают так быстро. Высота дерева ограничивает длину правила: дерево глубины d описывает взаимодействия не более чем d признаков.';
    }
    w.pythonAction(() => 'from gbcourse.rng import Mulberry32\nfrom gbcourse.tree import RegressionTree\nimport numpy as np\n\nrng = Mulberry32(5)\nX, y = [], []\nfor _ in range(160):\n    a, b = rng.uniform(0, 10), rng.uniform(0, 10)\n    inside = (a > 6 and b < 6) or (a < 3 and b > 7)\n    X.append([a, b])\n    y.append(1 if rng.random() < (0.9 if inside else 0.1) else 0)\nX, y = np.array(X), np.array(y)\n\ntree = RegressionTree(max_depth=' + s.depth + ', min_samples_leaf=5).fit(X, -y.astype(float))   # лист = −G/H = среднее y\n\ndef rules(i=0, conds=()):\n    nd = tree.nodes[i]\n    if nd.left < 0:\n        print(" и ".join(conds) or "всегда", "⇒", round(nd.value, 3), f"(n={nd.n})")\n        return\n    f = f"x{nd.feature + 1}"\n    rules(nd.left, conds + (f"{f} ≤ {nd.threshold:.2f}",))\n    rules(nd.right, conds + (f"{f} > {nd.threshold:.2f}",))\n\nrules()\nleaves = sum(nd.left < 0 for nd in tree.nodes)\nprint("узлов:", len(tree.nodes), "листьев:", leaves, "рёбер:", len(tree.nodes) - 1)\n');
    draw();
  });

  /* ==============================================================================
   * 19. Рост дерева: по уровням (очередь) и по листьям (очередь с приоритетом)
   * ============================================================================== */
  GBC.widget('tree-growth', (el) => {
    const s = { L: 6, mode: 'leaf' };
    const D = GBC.datasets.regression1d({ kind: 'sine', n: 80, noise: 0.3, seed: 1 });
    const xs = D.x;
    const ys = D.y;
    const MIN = 3;
    const w = ui.shell(el, { title: 'Рост дерева: по уровням (как BFS) или по листьям (лучший первым)', sub: 'Одно и то же число листьев — два порядка роста. По уровням листья делятся в порядке очереди; по листьям всегда делится лист с наибольшим выигрышем (очередь с приоритетом).' });
    ui.segmented(w.controls, { label: 'Порядок роста', value: s.mode, options: [{ value: 'depth', label: 'по уровням' }, { value: 'leaf', label: 'по листьям' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'Листьев', min: 1, max: 16, step: 1, value: s.L, format: String, onInput: (v) => ((s.L = v), draw()) });
    const fit = new GBC.Plot(w.main, { height: 210, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const tp = new GBC.Plot(w.main, { height: 200, grid: 'none', x: { label: '', ticks: [] }, y: { label: '', ticks: [] }, margin: { left: 8, bottom: 8 } });
    const qline = monoBox();
    w.main.appendChild(qline);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'глубина' }, { key: 'mse', label: 'MSE на обучении' }, { key: 'cmp', label: 'по уровням / по листьям' }]);
    const pre = [0];
    const pre2 = [0];
    ys.forEach((y, i) => (pre.push(pre[i] + y), pre2.push(pre2[i] + y * y)));
    const sse = (lo, hi) => pre2[hi] - pre2[lo] - Math.pow(pre[hi] - pre[lo], 2) / (hi - lo);
    function split(node) {
      let best = null;
      for (let i = node.lo + MIN; i <= node.hi - MIN; i++) {
        if (xs[i - 1] === xs[i]) continue;
        const g = sse(node.lo, node.hi) - sse(node.lo, i) - sse(i, node.hi);
        if (!best || g > best.g) best = { i, g, thr: (xs[i - 1] + xs[i]) / 2 };
      }
      return best;
    }
    function grow(mode, L) {
      const root = { lo: 0, hi: xs.length, depth: 0, name: 'к' };
      root.sp = split(root);
      const leaves = [root];
      const queue = [root];
      let order = 0;
      while (leaves.length < L) {
        let node;
        if (mode === 'depth') {
          while (queue.length && !queue[0].sp) queue.shift();
          node = queue.shift();
        } else node = leaves.filter((l) => l.sp).sort((a, b) => b.sp.g - a.sp.g)[0];
        if (!node) break;
        node.order = ++order;
        node.left = { lo: node.lo, hi: node.sp.i, depth: node.depth + 1 };
        node.right = { lo: node.sp.i, hi: node.hi, depth: node.depth + 1 };
        [node.left, node.right].forEach((c) => (c.sp = split(c)));
        leaves.splice(leaves.indexOf(node), 1, node.left, node.right);
        queue.push(node.left, node.right);
      }
      const mse = U.sum(leaves.map((l) => sse(l.lo, l.hi))) / xs.length;
      return { root, leaves, queue, mse, depth: Math.max(...leaves.map((l) => l.depth)) };
    }
    function draw() {
      const T = grow(s.mode, s.L);
      const other = grow(s.mode === 'depth' ? 'leaf' : 'depth', s.L);
      const seg = { x1: [], y1: [], x2: [], y2: [] };
      T.leaves.forEach((l) => {
        const m = (pre[l.hi] - pre[l.lo]) / (l.hi - l.lo);
        seg.x1.push(l.lo === 0 ? 0 : (xs[l.lo - 1] + xs[l.lo]) / 2);
        seg.x2.push(l.hi === xs.length ? 10 : (xs[l.hi - 1] + xs[l.hi]) / 2);
        seg.y1.push(m);
        seg.y2.push(m);
      });
      fit.render([
        { type: 'points', x: xs, y: ys, color: 'data', r: 3.5, label: 'данные' },
        { type: 'segments', ...seg, color: 'model', width: 3, opacity: 1, label: 'прогноз дерева' },
      ]);
      let leafIdx = 0;
      const nodes = [];
      const edges = { x1: [], y1: [], x2: [], y2: [] };
      (function place(nd) {
        if (!nd.left) nd.x = leafIdx++;
        else {
          place(nd.left);
          place(nd.right);
          nd.x = (nd.left.x + nd.right.x) / 2;
          [nd.left, nd.right].forEach((c) => (edges.x1.push(nd.x), edges.y1.push(-nd.depth), edges.x2.push(c.x), edges.y2.push(-c.depth)));
        }
        nodes.push(nd);
      })(T.root);
      const inner = nodes.filter((nd) => nd.left);
      const lv = nodes.filter((nd) => !nd.left);
      tp.render([
        { type: 'segments', ...edges, color: 'muted', width: 1.6, opacity: 1 },
        { type: 'points', x: lv.map((nd) => nd.x), y: lv.map((nd) => -nd.depth), color: 'tree', r: 5, shape: 'square', label: 'листья' },
        { type: 'points', x: inner.map((nd) => nd.x), y: inner.map((nd) => -nd.depth), color: 'model', r: 6, label: 'разбиения (число — порядок)' },
        { type: 'text', items: inner.map((nd) => ({ x: nd.x, y: -nd.depth, dx: 12, dy: -8, anchor: 'start', text: String(nd.order), color: 'ink', bold: true })) },
      ], { x: [-0.7, Math.max(1, leafIdx - 0.3)], y: [-T.depth - 0.5, 0.6] });
      const md = (t) => f3(t.mse);
      st.set('d', String(T.depth));
      st.set('mse', md(T));
      st.set('cmp', s.mode === 'depth' ? md(T) + ' / ' + md(other) : md(other) + ' / ' + md(T));
      const cand = T.leaves.filter((l) => l.sp).sort((a, b) => b.sp.g - a.sp.g);
      qline.textContent = s.mode === 'leaf'
        ? 'Очередь с приоритетом (лист: выигрыш ΔSSE): ' + (cand.slice(0, 6).map((l) => '[x ' + U.fmt((xs[l.lo] + (l.lo ? xs[l.lo - 1] : xs[l.lo])) / 2, 1) + '…' + U.fmt(l.hi === xs.length ? 10 : xs[l.hi - 1], 1) + ']: ' + f2(l.sp.g)).join('  ') || '—') + (cand.length > 6 ? '  …' : '')
        : 'Очередь FIFO: делим листья по порядку появления, уровень за уровнем — независимо от выигрыша. Листьев на последнем уровне сейчас: ' + T.leaves.filter((l) => l.depth === T.depth).length;
      note.innerHTML = 'Порядок роста — это порядок обхода: XGBoost по умолчанию растит дерево <b>по уровням</b> (grow_policy=depthwise, как BFS с очередью), LightGBM — <b>по листьям</b>: из всех листьев делит тот, где выигрыш наибольший (очередь с приоритетом — та же идея, что в Дейкстре). При одинаковом числе листьев рост по листьям даёт меньшую ошибку на обучении (сейчас ' + md(grow('leaf', s.L)) + ' против ' + md(grow('depth', s.L)) + '), но может растить глубокие несимметричные ветви и переобучаться — поэтому в LightGBM ограничивают num_leaves и max_depth. CatBoost растит <b>симметричные</b> деревья: на каждом уровне один и тот же вопрос во всех узлах (урок 9.3).';
    }
    draw();
  });

  /* ==============================================================================
   * 20. Минимальное остовное дерево: Краскал и Прим; свойства разреза и цикла
   * ============================================================================== */
  const MG = {
    names: 'ABCDEFGH'.split(''),
    pos: [[40, 75], [150, 40], [265, 50], [420, 65], [55, 225], [180, 170], [305, 185], [430, 240]],
    edges: [[0, 1, 4], [0, 4, 7], [1, 2, 8], [1, 5, 3], [0, 5, 6], [2, 3, 5], [2, 6, 2], [3, 7, 9], [4, 5, 10], [5, 6, 1], [6, 7, 11], [3, 6, 12], [1, 4, 13], [2, 5, 14]],
  };
  function kruskalSteps() {
    const par = U.range(8);
    const find = (v) => (par[v] === v ? v : (par[v] = find(par[v])));
    const order = U.range(MG.edges.length).sort((a, b) => MG.edges[a][2] - MG.edges[b][2]);
    const steps = [];
    const tree = [];
    for (const id of order) {
      const [a, b] = MG.edges[id];
      const ok = find(a) !== find(b);
      if (ok) (par[find(a)] = find(b)), tree.push(id);
      steps.push({ id, ok, tree: tree.slice(), comp: U.range(8).map(find) });
      if (tree.length === 7) break;
    }
    return steps;
  }
  function primSteps() {
    const inT = new Set([0]);
    const tree = [];
    const steps = [];
    while (inT.size < 8) {
      const cand = U.range(MG.edges.length).filter((id) => inT.has(MG.edges[id][0]) !== inT.has(MG.edges[id][1]));
      const id = cand.reduce((b, c) => (MG.edges[c][2] < MG.edges[b][2] ? c : b), cand[0]);
      steps.push({ id, ok: true, cand, inT: [...inT], tree: [...tree, id] });
      tree.push(id);
      inT.add(MG.edges[id][0]);
      inT.add(MG.edges[id][1]);
    }
    return steps;
  }
  const MST_IDS = kruskalSteps().slice(-1)[0].tree;
  GBC.widget('mst', (el) => {
    const s = { alg: 'kruskal', k: 0 };
    const w = ui.shell(el, { title: 'Минимальное остовное дерево: Краскал и Прим', sub: 'Связать все вершины самыми дешёвыми рёбрами без циклов. Числа на рёбрах — стоимости. Оба алгоритма жадные — и оба дают оптимум.' });
    ui.segmented(w.controls, { label: 'Алгоритм', value: s.alg, options: [{ value: 'kruskal', label: 'Краскал' }, { value: 'prim', label: 'Прим' }], onChange: (v) => ((s.alg = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Шаг', min: 0, max: 7, value: 0, fps: 1, format: (k) => 'шаг ' + k, onChange: (k) => ((s.k = k), draw()) });
    const reset = () => {
      const n = (s.alg === 'kruskal' ? kruskalSteps() : primSteps()).length;
      pl.stop();
      pl.setMax(n);
      pl.set(0);
      s.k = 0;
      draw();
    };
    const gv = new GraphView(w.main, { w: 520, h: 280 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'рёбер в дереве' }, { key: 'w', label: 'вес дерева' }, { key: 'cur', label: 'текущий шаг' }]);
    function draw() {
      const steps = s.alg === 'kruskal' ? kruskalSteps() : primSteps();
      const cur = s.k > 0 ? steps[s.k - 1] : null;
      const tree = cur ? cur.tree : [];
      const inT = s.alg === 'prim' ? (s.k === steps.length ? U.range(8) : cur ? cur.inT : [0]) : [];
      const comp = s.alg === 'kruskal' && cur ? cur.comp : null;
      gv.draw({
        nodes: MG.pos.map(([x, y], i) => ({ x, y, r: 15, label: MG.names[i], fill: s.alg === 'prim' ? (inT.includes(i) ? 'model' : null) : comp ? SER[[...new Set(comp)].indexOf(comp[i]) % SER.length] : null, fillP: 30 })),
        edges: MG.edges.map((e, id) => {
          const inTree = tree.includes(id);
          const isCur = cur && cur.id === id;
          const isCand = cur && s.alg === 'prim' && cur.cand.includes(id) && !inTree;
          return { a: e[0], b: e[1], color: isCur ? (cur.ok ? 'tree' : 'red') : inTree ? 'model' : isCand ? 'aqua' : 'muted', width: isCur ? 4.5 : inTree ? 3.6 : isCand ? 2.8 : 1.6, dash: isCur && !cur.ok, label: String(e[2]), lbold: inTree, lx: e[0] === 0 && e[1] === 5 ? 25 : e[0] === 1 && e[1] === 4 ? -14 : 0, ly: e[0] === 0 && e[1] === 5 ? 17 : e[0] === 1 && e[1] === 4 ? 27 : 0 };
        }),
      });
      const wsum = U.sum(tree.map((id) => MG.edges[id][2]));
      const desc = (id) => MG.names[MG.edges[id][0]] + '–' + MG.names[MG.edges[id][1]] + ' (' + MG.edges[id][2] + ')';
      line.textContent = !cur ? (s.alg === 'kruskal' ? 'Перебираем рёбра от лёгких к тяжёлым. Цвет вершины — её «кусок» (компонента).' : 'Растим дерево из вершины A.') :
        s.alg === 'kruskal' ? 'Рассматриваем ' + desc(cur.id) + ': ' + (cur.ok ? 'соединяет разные куски — берём' : 'концы уже в одном куске, будет цикл — пропускаем') :
          'Самое лёгкое ребро между деревом и остальными: ' + desc(cur.id) + ' (кандидаты — бирюзовые)';
      st.set('n', tree.length + ' из 7');
      st.set('w', String(wsum));
      st.set('cur', cur ? desc(cur.id) : '—');
      note.innerHTML = '<b>Остовное дерево</b> связного графа — дерево на всех его вершинах (здесь |V| − 1 = 7 рёбер). <b>Краскал</b> берёт рёбра по возрастанию веса и пропускает те, что замкнули бы цикл; «в одном ли куске концы?» отвечает система непересекающихся множеств почти за O(1), итого O(|E| log |E|) на сортировку. <b>Прим</b> растит одно дерево, каждый раз добавляя самое лёгкое ребро между деревом и остальными вершинами, — это почти Дейкстра, только ключ — вес ребра, а не расстояние. Оба находят дерево веса 31. Почему жадность не ошибается — в следующем виджете.';
    }
    reset();
  });
  GBC.widget('mst-cut', (el) => {
    const s = { mode: 'cut', side: new Set([0, 1, 4]), e: 13 };
    const w = ui.shell(el, { title: 'Почему жадность права: свойства разреза и цикла', sub: 'Разрез: щёлкайте по вершинам, чтобы перекладывать их между долями S и V∖S. Самое лёгкое ребро через разрез всегда входит в минимальное остовное дерево. Цикл: щёлкните по ребру вне дерева.' });
    ui.segmented(w.controls, { label: 'Свойство', value: s.mode, options: [{ value: 'cut', label: 'разреза' }, { value: 'cycle', label: 'цикла' }], onChange: (v) => ((s.mode = v), draw()) });
    const gv = new GraphView(w.main, {
      w: 520, h: 280,
      onNode: (i) => {
        if (s.mode !== 'cut') return;
        if (s.side.has(i)) s.side.delete(i);
        else s.side.add(i);
        draw();
      },
      onEdge: (i) => {
        if (s.mode !== 'cycle') return;
        s.e = i;
        draw();
      },
    });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'рёбер через разрез / в цикле' }, { key: 'b', label: 'выделенное ребро' }, { key: 'c', label: 'в дереве?' }]);
    function draw() {
      const mst = new Set(MST_IDS);
      if (s.mode === 'cut') {
        const cross = U.range(MG.edges.length).filter((id) => s.side.has(MG.edges[id][0]) !== s.side.has(MG.edges[id][1]));
        const light = cross.length ? cross.reduce((b, c) => (MG.edges[c][2] < MG.edges[b][2] ? c : b), cross[0]) : -1;
        gv.draw({
          nodes: MG.pos.map(([x, y], i) => ({ x, y, r: 15, label: MG.names[i], fill: s.side.has(i) ? 'blue' : 'orange', fillP: 35, color: s.side.has(i) ? 'blue' : 'orange' })),
          edges: MG.edges.map((e, id) => ({ a: e[0], b: e[1], color: id === light ? 'good' : cross.includes(id) ? 'red' : mst.has(id) ? 'model' : 'muted', width: id === light ? 5 : cross.includes(id) ? 2.8 : mst.has(id) ? 2.6 : 1.4, dash: cross.includes(id) && id !== light, label: String(e[2]), lbold: id === light, opacity: cross.includes(id) || mst.has(id) ? 1 : 0.6 })),
        });
        line.textContent = 'S = {' + [...s.side].sort().map((i) => MG.names[i]).join(', ') + '};  рёбра через разрез: ' + (cross.map((id) => MG.names[MG.edges[id][0]] + MG.names[MG.edges[id][1]] + ' ' + MG.edges[id][2]).join(', ') || 'нет (S пусто или всё)') + (light >= 0 ? '\nСамое лёгкое: ' + MG.names[MG.edges[light][0]] + '–' + MG.names[MG.edges[light][1]] + ' (' + MG.edges[light][2] + ') — ' + (mst.has(light) ? 'в остовном дереве ✓' : 'не в дереве?!') : '');
        st.set('a', String(cross.length));
        st.set('b', light >= 0 ? MG.names[MG.edges[light][0]] + '–' + MG.names[MG.edges[light][1]] + ' (' + MG.edges[light][2] + ')' : '—');
        st.set('c', light >= 0 ? (mst.has(light) ? 'да' : 'нет') : '—');
        note.innerHTML = '<b>Свойство разреза.</b> Разбейте вершины на две непустые части как угодно — самое лёгкое ребро между ними (зелёное) входит в минимальное остовное дерево (синие рёбра). Доказательство обменом: если бы оно не входило, добавим его к дереву — возникнет цикл, который пересекает разрез ещё раз, по более тяжёлому ребру. Удалим то ребро — дерево осталось остовным и стало легче. Противоречие. Краскал и Прим на каждом шаге берут именно такое ребро для какого-то разреза — поэтому их жадность оптимальна.';
      } else {
        const T = MST_IDS;
        const e = MG.edges[s.e];
        const inTree = mst.has(s.e);
        let cyc = [];
        if (!inTree) {
          const adj = adjList(8, T.map((id) => MG.edges[id]));
          const par = new Array(8).fill(-1);
          const q = [e[0]];
          const seen = new Set([e[0]]);
          for (let h = 0; h < q.length; h++) for (const u of adj[q[h]]) if (!seen.has(u)) (seen.add(u), (par[u] = q[h]), q.push(u));
          const path = [];
          for (let v = e[1]; v >= 0; v = par[v]) path.push(v);
          cyc = path.slice(1).map((v, i) => MG.edges.findIndex((f) => (f[0] === v && f[1] === path[i]) || (f[1] === v && f[0] === path[i])));
        }
        const heaviest = cyc.length ? Math.max(...cyc.map((id) => MG.edges[id][2])) : null;
        gv.draw({
          nodes: MG.pos.map(([x, y], i) => ({ x, y, r: 15, label: MG.names[i] })),
          edges: MG.edges.map((f, id) => ({ a: f[0], b: f[1], color: id === s.e ? 'red' : cyc.includes(id) ? 'tree' : mst.has(id) ? 'model' : 'muted', width: id === s.e ? 4.5 : cyc.includes(id) ? 4 : mst.has(id) ? 2.6 : 1.4, dash: id === s.e, label: String(f[2]), lbold: id === s.e || cyc.includes(id) })),
        });
        line.textContent = inTree ? 'Ребро ' + MG.names[e[0]] + '–' + MG.names[e[1]] + ' уже в дереве — выберите серое ребро.' : 'Ребро ' + MG.names[e[0]] + '–' + MG.names[e[1]] + ' (' + e[2] + ') замыкает цикл с рёбрами дерева: ' + cyc.map((id) => MG.edges[id][2]).join(', ') + '. Самое тяжёлое в цикле — ' + Math.max(e[2], heaviest) + ' (это наше ребро).';
        st.set('a', inTree ? '—' : String(cyc.length + 1));
        st.set('b', MG.names[e[0]] + '–' + MG.names[e[1]] + ' (' + e[2] + ')');
        st.set('c', inTree ? 'да' : 'нет');
        note.innerHTML = '<b>Свойство цикла</b> — зеркальное: самое тяжёлое ребро любого цикла (если оно единственное) не входит в минимальное остовное дерево. Щёлкните по любому серому ребру: оно вместе с путём по дереву образует цикл, и оно в этом цикле самое тяжёлое. Из этих двух свойств следует, что при различных весах минимальное остовное дерево <b>единственно</b>.';
      }
    }
    draw();
  });

  /* ==============================================================================
   * 21. Кластеризация через остовное дерево (одиночная связь)
   * ============================================================================== */
  function clusterData(kind) {
    if (kind === 'moons') return GBC.datasets.classification2d({ kind: 'moons', n: 120, noise: 0.06, seed: 3 }).X;
    const rng = new GBC.RNG(kind === 'blobs' ? 11 : 12);
    const C = kind === 'blobs' ? [[0, 0], [2.4, 0.3], [1.1, 1.9]] : [[0, 0], [2.6, 0]];
    const X = [];
    C.forEach((c) => U.range(40).forEach(() => X.push([c[0] + 0.35 * rng.normal(), c[1] + 0.35 * rng.normal()])));
    if (kind === 'bridge') U.range(9).forEach((i) => X.push([0.55 + (1.5 * (i + 0.5)) / 9, 0.05 * rng.normal()]));
    return X;
  }
  function euclidMST(X) {
    const n = X.length;
    const inT = new Array(n).fill(false);
    const best = new Array(n).fill(Infinity);
    const from = new Array(n).fill(-1);
    best[0] = 0;
    const E = [];
    for (let it = 0; it < n; it++) {
      let v = -1;
      for (let i = 0; i < n; i++) if (!inT[i] && (v < 0 || best[i] < best[v])) v = i;
      inT[v] = true;
      if (from[v] >= 0) E.push([from[v], v, best[v]]);
      for (let u = 0; u < n; u++) {
        if (inT[u]) continue;
        const d = Math.hypot(X[u][0] - X[v][0], X[u][1] - X[v][1]);
        if (d < best[u]) (best[u] = d), (from[u] = v);
      }
    }
    return E;
  }
  GBC.widget('mst-clustering', (el) => {
    const s = { kind: 'moons', k: 2 };
    const w = ui.shell(el, { title: 'Кластеризация «одиночной связи»: остовное дерево минус самые длинные рёбра', sub: 'Точки — вершины полного графа, вес ребра — расстояние. Строим минимальное остовное дерево и удаляем k − 1 самых длинных рёбер: оставшиеся куски — кластеры.' });
    ui.segmented(w.controls, { label: 'Данные', value: s.kind, options: [{ value: 'moons', label: 'полумесяцы' }, { value: 'blobs', label: 'три облака' }, { value: 'bridge', label: 'облака с мостиком' }], onChange: (v) => ((s.kind = v), draw()) });
    ui.slider(w.controls, { label: 'Кластеров k', min: 1, max: 6, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, equal: true, x: { label: 'x_1' }, y: { label: 'x_2' } });
    const bars = new GBC.Plot(w.main, { height: 150, x: { label: 'рёбра дерева по убыванию длины', domain: [0.3, 12.7], ticks: [1, 2, 3, 4, 5, 6, 8, 10, 12] }, y: { label: 'длина' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sizes', label: 'размеры кластеров' }, { key: 'cut', label: 'самое короткое удалённое ребро' }, { key: 'keep', label: 'самое длинное оставшееся' }]);
    function draw() {
      const X = clusterData(s.kind);
      const n = X.length;
      const E = euclidMST(X);
      const ord = U.range(E.length).sort((a, b) => E[b][2] - E[a][2]);
      const cut = new Set(ord.slice(0, s.k - 1));
      const par = U.range(n);
      const find = (v) => (par[v] === v ? v : (par[v] = find(par[v])));
      E.forEach((e, i) => !cut.has(i) && (par[find(e[0])] = find(e[1])));
      const roots = [...new Set(U.range(n).map(find))];
      const sizes = roots.map((r) => U.range(n).filter((i) => find(i) === r).length);
      const rk = roots.map((r, i) => [r, sizes[i]]).sort((a, b) => b[1] - a[1]).map((p) => p[0]);
      const cl = U.range(n).map((i) => rk.indexOf(find(i)));
      const keepE = E.filter((_, i) => !cut.has(i));
      const cutE = E.filter((_, i) => cut.has(i));
      plot.render([
        { type: 'segments', x1: keepE.map((e) => X[e[0]][0]), y1: keepE.map((e) => X[e[0]][1]), x2: keepE.map((e) => X[e[1]][0]), y2: keepE.map((e) => X[e[1]][1]), color: 'ink2', width: 1.4, opacity: 0.7 },
        { type: 'segments', x1: cutE.map((e) => X[e[0]][0]), y1: cutE.map((e) => X[e[0]][1]), x2: cutE.map((e) => X[e[1]][0]), y2: cutE.map((e) => X[e[1]][1]), color: 'red', width: 2.4, opacity: 1, dash: '5 4' },
        ...U.range(Math.min(rk.length, 8)).map((c) => {
          const ids = U.range(n).filter((i) => cl[i] === c);
          return { type: 'points', x: ids.map((i) => X[i][0]), y: ids.map((i) => X[i][1]), color: SER[c], r: 4, label: 'кластер ' + (c + 1) + ' (' + ids.length + ')' };
        }),
      ]);
      const top = ord.slice(0, 12);
      bars.render([{ type: 'bars', x: top.map((_, i) => i + 1), y: top.map((i) => E[i][2]), color: (i) => (i < s.k - 1 ? 'red' : 'model'), width: 0.7, maxPx: 22 }]);
      st.set('sizes', sizes.sort((a, b) => b - a).join(' + '));
      st.set('cut', s.k > 1 ? f3(E[ord[s.k - 2]][2]) : '—');
      st.set('keep', f3(E[ord[s.k - 1]][2]));
      note.innerHTML = 'Удалить k − 1 самых длинных рёбер остовного дерева — то же самое, что иерархическая кластеризация <b>одиночной связи</b> (single linkage), остановленная на k кластерах: два кластера сливаются, если между их ближайшими точками короткое расстояние. ' + {
        moons: 'Полумесяцы k-средние разрезали бы поперёк, а одиночная связь находит их точно: внутри полумесяца точки идут «цепочкой» с маленькими шагами, а между полумесяцами — заметный разрыв (первый столбец).',
        blobs: 'Три облака разделяются при k = 3: два длинных ребра заметно выше остальных столбцов — по такому «уступу» выбирают число кластеров.',
        bridge: 'Слабость метода — <b>эффект цепочки</b>: девять точек-«мостик» соединяют облака короткими шагами, и при k = 2 отрезается одиночная точка, а не облако. Устойчивые к шуму варианты (HDBSCAN) строят остовное дерево по «взаимной достижимости», учитывающей плотность.',
      }[s.kind];
    }
    w.pythonAction(() => {
      const X = clusterData(s.kind);
      return 'import numpy as np\nfrom scipy.sparse.csgraph import connected_components, minimum_spanning_tree\nfrom scipy.spatial.distance import pdist, squareform\n\nX = np.array(' + pyList(X.map((p) => [Number(p[0].toFixed(4)), Number(p[1].toFixed(4))])) + ')\nk = ' + s.k + '\nT = minimum_spanning_tree(squareform(pdist(X))).tocoo()\norder = np.argsort(-T.data)                    # рёбра дерева по убыванию длины\nkeep = np.ones(len(T.data), bool)\nkeep[order[:k - 1]] = False\nfrom scipy.sparse import coo_matrix\nF = coo_matrix((T.data[keep], (T.row[keep], T.col[keep])), shape=T.shape)\nncomp, labels = connected_components(F, directed=False)\nprint("кластеров:", ncomp, " размеры:", sorted(np.bincount(labels), reverse=True))\nprint("длины самых длинных рёбер:", np.round(T.data[order[:6]], 3))\n';
    });
    draw();
  });

  /* ---------- общее для части 2 ---------- */
  GBC.lesson1518 = {
    f1, f2, f3, py, num, pct, plural, nWord, sup, sub, dstr,
    SER, col, tint, flexRow, texInto, texEl, card, cardGrid, badge, rowTable, monoBox, legendRow, cellTable,
    GraphView, sTxt, segDist, adjList, bfsDist, components, bipartition, triangles, diameter, girth, circlePos, treeLayout, Heap, pyList,
    pruferDecode, randomTree,
  };
})();
