/* =====================================================================================
 * GBC.TreeView — схема дерева решений (SVG).
 *
 *   const tv = new GBC.TreeView(el, { featureNames: ['x'], valueLabel: 'значение' });
 *   tv.render(tree, { highlight: tree.decisionPath(x) });
 *
 * Узлы — правила «x ≤ порог», листья окрашены по значению (синий < 0 < красный).
 * Наведение показывает статистику узла (n, G, H, выигрыш), клик — onNodeClick(node).
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC;
  const U = GBC.util;
  const S = GBC.svg;
  const H = GBC.h;

  class TreeView {
    constructor(parent, opts = {}) {
      this.opts = Object.assign(
        {
          featureNames: null,
          valueLabel: 'значение',
          valueFormat: (v) => U.fmtSigned(v, 2),
          thresholdFormat: (v) => U.fmt(v, 3),
          nodeW: 118,
          nodeH: 44,
          levelH: 78,
          gapX: 14,
          showStats: true,
          onNodeClick: null,
          maxWidth: null,
          colorScale: null,
        },
        opts
      );
      this.el = H('div', { class: 'treeview' });
      this.tip = H('div', { class: 'plot-tooltip' });
      this.wrap = H('div', { style: { position: 'relative' } }, this.el, this.tip);
      parent.appendChild(this.wrap);
      this._unsub = GBC.bus.on('themechange', () => this.tree && this.render(this.tree, this.state));
    }

    featureName(f) {
      const names = this.opts.featureNames;
      if (names && names[f] !== undefined) return names[f];
      if (!this.tree || this.tree.nFeatures <= 1) return 'x';
      return 'x' + String(f).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
    }

    render(tree, state = {}) {
      this.tree = tree;
      this.state = state;
      const o = this.opts;
      const nodes = tree.nodes;
      this.el.textContent = '';
      if (!nodes.length) return;
      // Раскладка: листья слева направо, родитель — по центру между детьми
      const pos = {};
      let leafX = 0;
      const place = (id) => {
        const nd = nodes[id];
        if (nd.left < 0) {
          pos[id] = leafX;
          leafX += 1;
        } else {
          place(nd.left);
          place(nd.right);
          pos[id] = (pos[nd.left] + pos[nd.right]) / 2;
        }
      };
      place(0);
      const nLeaves = leafX;
      let depth = 0;
      for (const nd of nodes) depth = Math.max(depth, nd.depth);
      const unit = o.nodeW + o.gapX;
      const W = Math.max(unit * nLeaves, o.nodeW + 20);
      const Hh = depth * o.levelH + o.nodeH + 16;
      const svg = S('svg', { width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': 'Схема дерева решений' });
      const cx = (id) => pos[id] * unit + unit / 2;
      const cy = (id) => nodes[id].depth * o.levelH + 8;
      const path = new Set(state.highlight || []);
      // Цвет листьев
      let vmax = 1e-12;
      for (const nd of nodes) if (nd.left < 0) vmax = Math.max(vmax, Math.abs(nd.value));
      const div = o.colorScale || GBC.colors.diverging();
      const edges = S('g');
      const labels = S('g');
      for (const nd of nodes) {
        if (nd.left < 0) continue;
        for (const [child, lab] of [[nd.left, 'да'], [nd.right, 'нет']]) {
          const x1 = cx(nd.id);
          const y1 = cy(nd.id) + o.nodeH;
          const x2 = cx(child);
          const y2 = cy(child);
          const on = path.has(nd.id) && path.has(child);
          edges.appendChild(
            S('path', { class: 'edge' + (on ? ' on' : ''), d: 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + (y1 + 24) + ' ' + x2 + ',' + (y2 - 24) + ' ' + x2 + ',' + y2 })
          );
          labels.appendChild(S('text', { class: 'edge-label', x: (x1 + x2) / 2 + (child === nd.left ? -8 : 8), y: (y1 + y2) / 2, 'text-anchor': child === nd.left ? 'end' : 'start' }, lab));
        }
      }
      svg.appendChild(edges);
      svg.appendChild(labels);
      for (const nd of nodes) {
        const x = cx(nd.id) - o.nodeW / 2;
        const y = cy(nd.id);
        const leaf = nd.left < 0;
        const cls = 'node ' + (leaf ? 'leaf' : 'internal') + (path.has(nd.id) ? ' on' : '') + (o.onNodeClick ? ' clickable' : '');
        const g = S('g', { class: cls, tabindex: o.onNodeClick ? 0 : null });
        let fill = null;
        let textFill = null;
        if (leaf) {
          const rgb = o.leafColor ? o.leafColor(nd.value) : div(nd.value / vmax);
          fill = GBC.colors.rgbString(rgb);
          const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
          textFill = lum < 0.55 ? '#ffffff' : '#0b0b0b';
        }
        g.appendChild(S('rect', { x, y, width: o.nodeW, height: o.nodeH, rx: 9, style: fill ? 'fill:' + fill : null }));
        const line1 = leaf ? o.valueFormat(nd.value) : this.featureName(nd.feature) + ' ≤ ' + o.thresholdFormat(nd.threshold);
        const line2 = 'n = ' + nd.n + (leaf && o.valueLabel ? ' · ' + o.valueLabel : '');
        g.appendChild(
          S('text', { x: x + o.nodeW / 2, y: y + 19, 'text-anchor': 'middle', 'font-weight': 650, style: textFill ? 'fill:' + textFill : null }, line1)
        );
        g.appendChild(S('text', { class: 'sub', x: x + o.nodeW / 2, y: y + 35, 'text-anchor': 'middle', style: textFill ? 'fill:' + textFill + ';opacity:.85' : null }, line2));
        g.addEventListener('pointerenter', () => this._tip(nd, cx(nd.id), y));
        g.addEventListener('pointerleave', () => this.tip.classList.remove('show'));
        if (o.onNodeClick) {
          g.addEventListener('click', () => o.onNodeClick(nd));
          g.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') o.onNodeClick(nd);
          });
        }
        svg.appendChild(g);
      }
      this.el.appendChild(svg);
      this.svg = svg;
      // Вписать в ширину контейнера, если уменьшение умеренное (текст остаётся читаемым)
      const cw = this.el.clientWidth;
      if (cw && W > cw && W * 0.6 <= cw) {
        svg.setAttribute('width', cw);
        svg.setAttribute('height', (Hh * cw) / W);
      }
    }

    _tip(nd, x, y) {
      if (!this.opts.showStats) return;
      const tip = this.tip;
      tip.textContent = '';
      const rows = [
        ['n (объектов)', String(nd.n)],
        ['G = Σg', U.fmt(nd.G, 4)],
        ['H = Σh', U.fmt(nd.H, 4)],
        [nd.left < 0 ? 'значение листа' : 'значение узла', U.fmt(nd.value, 4)],
      ];
      if (nd.left >= 0) rows.push(['выигрыш разбиения', U.fmt(nd.gain, 4)]);
      tip.appendChild(H('div', { class: 'title' }, nd.left < 0 ? 'Лист #' + nd.id : 'Узел #' + nd.id));
      for (const [k, v] of rows) tip.appendChild(H('div', { class: 'row' }, H('b', null, v), H('span', null, k)));
      tip.classList.add('show');
      const sx = this.el.scrollLeft;
      tip.style.left = Math.max(0, x - sx + 70) + 'px';
      tip.style.top = y + 'px';
    }

    destroy() {
      if (this._unsub) this._unsub();
      this.wrap.remove();
    }
  }

  GBC.TreeView = TreeView;
})(typeof window !== 'undefined' ? window : globalThis);
