/* =====================================================================================
 * Регрессионное дерево CART по градиентам и гессианам — зеркало gbcourse/tree.py.
 *
 *   вес листа          w* = −T_α(G) / (H + λ)
 *   качество листа     S(G, H) = T_α(G)² / (H + λ)
 *   выигрыш разбиения  gain = ½ [S(G_L, H_L) + S(G_R, H_R) − S(G, H)] − γ
 *
 * С g = −остаток, h = 1, λ = 0 это обычное дерево на остатках (критерий — уменьшение
 * суммы квадратов, лист — средний остаток). Перебор: признаки по возрастанию номера,
 * пороги слева направо, побеждает первый максимум (строгое «>»).
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC || (root.GBC = {});
  const U = GBC.util;

  function softThreshold(G, alpha) {
    if (alpha <= 0) return G;
    const s = G > 0 ? 1 : G < 0 ? -1 : 0;
    return s * Math.max(Math.abs(G) - alpha, 0);
  }

  function score(G, H, lam, alpha) {
    const T = softThreshold(G, alpha);
    const den = H + lam;
    return den > 0 ? (T * T) / den : 0;
  }

  /** Границы гистограммных корзин (как make_bins в Python). X — строки. */
  function makeBins(X, maxBins = 32) {
    const d = X.length ? X[0].length : 0;
    const bins = [];
    for (let j = 0; j < d; j++) {
      const col = [];
      for (const row of X) if (!Number.isNaN(row[j])) col.push(row[j]);
      const uniq = Array.from(new Set(col)).sort((a, b) => a - b);
      if (uniq.length <= 1) {
        bins.push([]);
        continue;
      }
      let edges;
      if (uniq.length <= maxBins) {
        edges = [];
        for (let i = 0; i + 1 < uniq.length; i++) edges.push((uniq[i] + uniq[i + 1]) / 2);
      } else {
        const qs = [];
        for (let k = 1; k < maxBins; k++) qs.push(U.quantile(col, k / maxBins));
        edges = Array.from(new Set(qs)).sort((a, b) => a - b);
      }
      bins.push(edges);
    }
    return bins;
  }

  /** Номер корзины: число границ, строго меньших x (NaN → −1). */
  function binCode(edges, x) {
    if (Number.isNaN(x)) return -1;
    let lo = 0;
    let hi = edges.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (edges[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function binCodes(X, bins) {
    return X.map((row) => row.map((v, j) => binCode(bins[j], v)));
  }

  class RegressionTree {
    /**
     * @param {object} opts maxDepth (null — без ограничения), minSamplesLeaf, minChildWeight,
     *   regLambda, regAlpha, gamma, maxLeaves, growth ('depthwise'|'leafwise'), maxFeatures, maxBins
     */
    constructor(opts = {}) {
      this.maxDepth = opts.maxDepth === undefined ? 3 : opts.maxDepth;
      this.minSamplesLeaf = opts.minSamplesLeaf ?? 1;
      this.minChildWeight = opts.minChildWeight ?? 0;
      this.regLambda = opts.regLambda ?? 0;
      this.regAlpha = opts.regAlpha ?? 0;
      this.gamma = opts.gamma ?? 0;
      this.maxLeaves = opts.maxLeaves ?? null;
      this.growth = opts.growth ?? 'depthwise';
      this.maxFeatures = opts.maxFeatures ?? null;
      this.maxBins = opts.maxBins ?? null;
      this.nodes = [];
      this.nFeatures = 0;
    }

    /**
     * @param {number[][]} X строки признаков
     * @param {number[]} g градиенты; h — гессианы (по умолчанию 1)
     * @param {object} o rows (подвыборка), rng (для maxFeatures), bins, features (colsample)
     */
    fit(X, g, h = null, o = {}) {
      const n = X.length;
      const d = n ? X[0].length : 0;
      if (!h) h = new Array(n).fill(1);
      const rows = o.rows ? Array.from(o.rows).sort((a, b) => a - b) : U.range(n);
      this._X = X;
      this._g = g;
      this._h = h;
      this._rng = GBC.asRNG(o.rng);
      this.nFeatures = d;
      this._allowed = o.features ? Array.from(o.features).sort((a, b) => a - b) : U.range(d);
      if (this.maxBins) {
        this.bins = o.bins || makeBins(rows.map((i) => X[i]), this.maxBins);
        this._codes = binCodes(X, this.bins);
        this._order = null;
      } else {
        this.bins = null;
        this._codes = null;
        this._order = [];
        for (let f = 0; f < d; f++) this._order.push(U.argsort(X.map((r) => r[f])));
      }
      this._inNode = new Uint8Array(n);
      this.nodes = [];
      const rootNode = this._newNode(rows, 0);
      if (this.growth === 'depthwise') this._growDepthwise(rootNode);
      else this._growLeafwise(rootNode);
      this._finalize();
      delete this._X;
      delete this._g;
      delete this._h;
      delete this._codes;
      delete this._order;
      delete this._inNode;
      return this;
    }

    _leafWeight(G, H) {
      const den = H + this.regLambda;
      if (den <= 0) return 0;
      return -softThreshold(G, this.regAlpha) / den;
    }

    _newNode(rows, depth) {
      let G = 0;
      let H = 0;
      for (const i of rows) G += this._g[i];
      for (const i of rows) H += this._h[i];
      const node = {
        id: this.nodes.length, depth, n: rows.length, G, H, value: this._leafWeight(G, H),
        feature: -1, threshold: NaN, left: -1, right: -1, gain: 0, missingLeft: true, rows,
      };
      this.nodes.push(node);
      return node;
    }

    _canSplit(node) {
      if (this.maxDepth !== null && node.depth >= this.maxDepth) return false;
      return node.n >= 2 * this.minSamplesLeaf && node.n >= 2;
    }

    _featuresForNode() {
      const baseF = this._allowed;
      if (this.maxFeatures === null) return baseF;
      const k = Math.max(1, Math.floor(this.maxFeatures * baseF.length));
      if (k >= baseF.length) return baseF;
      return this._rng
        .sample(baseF.length, k)
        .map((i) => baseF[i])
        .sort((a, b) => a - b);
    }

    _growDepthwise(node) {
      if (!this._canSplit(node)) return;
      const split = this._bestSplit(node);
      if (!split) return;
      const [left, right] = this._applySplit(node, split);
      this._growDepthwise(left);
      this._growDepthwise(right);
    }

    _growLeafwise(rootNode) {
      const candidates = new Map();
      const consider = (nd) => {
        if (this._canSplit(nd)) {
          const sp = this._bestSplit(nd);
          if (sp) candidates.set(nd.id, sp);
        }
      };
      consider(rootNode);
      let nLeaves = 1;
      while (candidates.size && (this.maxLeaves === null || nLeaves < this.maxLeaves)) {
        let bestId = null;
        let bestGain = -Infinity;
        for (const id of Array.from(candidates.keys()).sort((a, b) => a - b)) {
          if (candidates.get(id).gain > bestGain) {
            bestGain = candidates.get(id).gain;
            bestId = id;
          }
        }
        const split = candidates.get(bestId);
        candidates.delete(bestId);
        const [left, right] = this._applySplit(this.nodes[bestId], split);
        nLeaves += 1;
        consider(left);
        consider(right);
      }
    }

    _applySplit(node, split) {
      node.feature = split.feature;
      node.threshold = split.threshold;
      node.gain = split.gain;
      node.missingLeft = split.missingLeft;
      const left = this._newNode(split.leftRows, node.depth + 1);
      const right = this._newNode(split.rightRows, node.depth + 1);
      node.left = left.id;
      node.right = right.id;
      return [left, right];
    }

    _bestSplit(node) {
      const rows = node.rows;
      const X = this._X;
      const g = this._g;
      const h = this._h;
      const lam = this.regLambda;
      const alpha = this.regAlpha;
      const gamma = this.gamma;
      const msl = this.minSamplesLeaf;
      const mcw = this.minChildWeight;
      const G = node.G;
      const H = node.H;
      const n = node.n;
      const parent = score(G, H, lam, alpha);
      let best = null;
      let bestGain = 0;
      const inNode = this._inNode;
      if (!this._codes) for (const i of rows) inNode[i] = 1;

      for (const f of this._featuresForNode()) {
        // Кандидаты: массивы накопленных сумм слева и пороги
        const GLs = [];
        const HLs = [];
        const nLs = [];
        const okPos = [];
        const thr = [];
        let missRows = [];
        if (!this._codes) {
          const valid = [];
          for (const i of this._order[f]) {
            if (!inNode[i]) continue;
            if (Number.isNaN(X[i][f])) missRows.push(i);
            else valid.push(i);
          }
          if (valid.length < 2) continue;
          let gl = 0;
          let hl = 0;
          for (let p = 0; p + 1 < valid.length; p++) {
            gl += g[valid[p]];
            hl += h[valid[p]];
            const xa = X[valid[p]][f];
            const xb = X[valid[p + 1]][f];
            GLs.push(gl);
            HLs.push(hl);
            nLs.push(p + 1);
            okPos.push(xa < xb);
            thr.push((xa + xb) / 2);
          }
        } else {
          const edges = this.bins[f];
          if (!edges.length) continue;
          const nb = edges.length + 1;
          const Gb = new Array(nb).fill(0);
          const Hb = new Array(nb).fill(0);
          const Nb = new Array(nb).fill(0);
          for (const i of rows) {
            const c = this._codes[i][f];
            if (c < 0) {
              missRows.push(i);
              continue;
            }
            Gb[c] += g[i];
            Hb[c] += h[i];
            Nb[c] += 1;
          }
          let gl = 0;
          let hl = 0;
          let nl = 0;
          for (let b = 0; b + 1 < nb; b++) {
            gl += Gb[b];
            hl += Hb[b];
            nl += Nb[b];
            GLs.push(gl);
            HLs.push(hl);
            nLs.push(nl);
            okPos.push(true);
            thr.push(edges[b]);
          }
        }
        let Gm = 0;
        let Hm = 0;
        for (const i of missRows) Gm += g[i];
        for (const i of missRows) Hm += h[i];
        const nm = missRows.length;
        const nVariants = nm > 0 ? 2 : 1;

        let featGain = -Infinity;
        let featPos = -1;
        let featVar = 0;
        for (let p = 0; p < GLs.length; p++) {
          for (let v = 0; v < nVariants; v++) {
            const gl = v === 0 ? GLs[p] : GLs[p] + Gm;
            const hl = v === 0 ? HLs[p] : HLs[p] + Hm;
            const nl = v === 0 ? nLs[p] : nLs[p] + nm;
            const gr = G - gl;
            const hr = H - hl;
            const nr = n - nl;
            const valid = okPos[p] && nl >= msl && nr >= msl && hl >= mcw && hr >= mcw;
            if (!valid) continue;
            const gain = 0.5 * (score(gl, hl, lam, alpha) + score(gr, hr, lam, alpha) - parent) - gamma;
            if (gain > featGain) {
              featGain = gain;
              featPos = p;
              featVar = v;
            }
          }
        }
        if (featGain > bestGain) {
          bestGain = featGain;
          best = { feature: f, threshold: thr[featPos], missingLeft: featVar === 1, hadMissing: nm > 0 };
        }
      }
      if (!this._codes) for (const i of rows) inNode[i] = 0;
      if (!best) return null;

      const f = best.feature;
      const t = best.threshold;
      let missingLeft = best.missingLeft;
      if (!best.hadMissing) {
        let nLeft = 0;
        for (const i of rows) if (!Number.isNaN(X[i][f]) && X[i][f] <= t) nLeft++;
        missingLeft = nLeft >= rows.length - nLeft;
      }
      const leftRows = [];
      const rightRows = [];
      for (const i of rows) {
        const v = X[i][f];
        const goLeft = Number.isNaN(v) ? missingLeft : v <= t;
        (goLeft ? leftRows : rightRows).push(i);
      }
      return { feature: f, threshold: t, gain: bestGain, missingLeft, leftRows, rightRows };
    }

    _finalize() {
      for (const nd of this.nodes) if (nd.left >= 0) nd.rows = null;
    }

    /** Номер листа для одного объекта x (массив признаков). */
    applyOne(x) {
      let nd = this.nodes[0];
      while (nd.left >= 0) {
        const v = x[nd.feature];
        const goLeft = Number.isNaN(v) ? nd.missingLeft : v <= nd.threshold;
        nd = this.nodes[goLeft ? nd.left : nd.right];
      }
      return nd.id;
    }

    predictOne(x) {
      return this.nodes[this.applyOne(x)].value;
    }

    predict(X) {
      const out = new Array(X.length);
      for (let i = 0; i < X.length; i++) out[i] = this.predictOne(X[i]);
      return out;
    }

    apply(X) {
      return X.map((x) => this.applyOne(x));
    }

    /** Путь от корня до листа (номера узлов). */
    decisionPath(x) {
      const path = [0];
      let nd = this.nodes[0];
      while (nd.left >= 0) {
        const v = x[nd.feature];
        const goLeft = Number.isNaN(v) ? nd.missingLeft : v <= nd.threshold;
        nd = this.nodes[goLeft ? nd.left : nd.right];
        path.push(nd.id);
      }
      return path;
    }

    get leaves() {
      return this.nodes.filter((nd) => nd.left < 0);
    }

    get nLeaves() {
      return this.leaves.length;
    }

    get depth() {
      let d = 0;
      for (const nd of this.nodes) if (nd.depth > d) d = nd.depth;
      return d;
    }

    featureGains() {
      const out = new Array(this.nFeatures).fill(0);
      for (const nd of this.nodes) if (nd.left >= 0) out[nd.feature] += nd.gain;
      return out;
    }

    /** Кусочно-постоянная функция одного признака (для 1D-графиков): [{x0, x1, value}]. */
    segments1d(xMin, xMax) {
      const out = [];
      const walk = (id, lo, hi) => {
        const nd = this.nodes[id];
        if (nd.left < 0) {
          out.push({ x0: lo, x1: hi, value: nd.value, node: id, n: nd.n });
          return;
        }
        walk(nd.left, lo, Math.min(hi, nd.threshold));
        walk(nd.right, Math.max(lo, nd.threshold), hi);
      };
      walk(0, xMin, xMax);
      return out.filter((s) => s.x1 > s.x0).sort((a, b) => a.x0 - b.x0);
    }

    toJSON() {
      return {
        nodes: this.nodes.map((nd) => ({
          id: nd.id, depth: nd.depth, n: nd.n, G: nd.G, H: nd.H, value: nd.value, feature: nd.feature,
          threshold: Number.isNaN(nd.threshold) ? null : nd.threshold, left: nd.left, right: nd.right,
          gain: nd.gain, missing_left: nd.missingLeft,
        })),
      };
    }
  }

  GBC.RegressionTree = RegressionTree;
  GBC.makeBins = makeBins;
  GBC.binCodes = binCodes;
  GBC.treeScore = score;
})(typeof window !== 'undefined' ? window : globalThis);
