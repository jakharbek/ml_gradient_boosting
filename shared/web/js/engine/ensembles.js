/* =====================================================================================
 * Бэггинг / случайный лес и AdaBoost — зеркало gbcourse/ensembles.py.
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC || (root.GBC = {});

  class BaggingTrees {
    constructor({ nEstimators = 50, maxDepth = null, minSamplesLeaf = 1, maxFeatures = null, bootstrap = true, seed = 0 } = {}) {
      Object.assign(this, { nEstimators, maxDepth, minSamplesLeaf, maxFeatures, bootstrap, seed });
    }

    fit(X, y) {
      const n = X.length;
      const rng = new GBC.RNG(this.seed);
      this.trees = [];
      this.inbagCounts = [];
      for (let b = 0; b < this.nEstimators; b++) {
        const counts = new Array(n).fill(0);
        if (this.bootstrap) for (const i of rng.bootstrap(n)) counts[i] += 1;
        else counts.fill(1);
        const rows = [];
        for (let i = 0; i < n; i++) if (counts[i] > 0) rows.push(i);
        const g = y.map((v, i) => -counts[i] * v);
        const tree = new GBC.RegressionTree({
          maxDepth: this.maxDepth,
          minSamplesLeaf: this.minSamplesLeaf,
          maxFeatures: this.maxFeatures,
        }).fit(X, g, counts, { rows, rng });
        this.trees.push(tree);
        this.inbagCounts.push(counts);
      }
      return this;
    }

    predictOne(x, nTrees = null) {
      const B = nTrees === null ? this.trees.length : Math.min(nTrees, this.trees.length);
      let s = 0;
      for (let b = 0; b < B; b++) s += this.trees[b].predictOne(x);
      return s / Math.max(1, B);
    }

    predict(X, nTrees = null) {
      return X.map((x) => this.predictOne(x, nTrees));
    }

    oobPredict(X) {
      return X.map((x, i) => {
        let s = 0;
        let c = 0;
        this.trees.forEach((t, b) => {
          if (this.inbagCounts[b][i] === 0) {
            s += t.predictOne(x);
            c += 1;
          }
        });
        return c > 0 ? s / c : NaN;
      });
    }
  }

  class AdaBoost {
    constructor({ nEstimators = 50, maxDepth = 1, learningRate = 1.0 } = {}) {
      Object.assign(this, { nEstimators, maxDepth, learningRate });
    }

    fit(X, y) {
      const n = X.length;
      const ys = y.map((v) => (v > 0 ? 1 : -1));
      let w = new Array(n).fill(1 / n);
      this.trees = [];
      this.alphas = [];
      this.errors = [];
      this.weights = [w.slice()];
      for (let m = 0; m < this.nEstimators; m++) {
        const tree = new GBC.RegressionTree({ maxDepth: this.maxDepth }).fit(
          X,
          w.map((wi, i) => -wi * ys[i]),
          w
        );
        const pred = X.map((x) => (tree.predictOne(x) >= 0 ? 1 : -1));
        let wMiss = 0;
        let wSum = 0;
        for (let i = 0; i < n; i++) if (pred[i] !== ys[i]) wMiss += w[i];
        for (let i = 0; i < n; i++) wSum += w[i];
        const err = wMiss / wSum;
        if (err >= 0.5) break;
        const errC = Math.max(err, 1e-10);
        const alpha = this.learningRate * 0.5 * Math.log((1 - errC) / errC);
        w = w.map((wi, i) => wi * Math.exp(-alpha * ys[i] * pred[i]));
        let s = 0;
        for (const v of w) s += v;
        w = w.map((v) => v / s);
        this.trees.push(tree);
        this.alphas.push(alpha);
        this.errors.push(err);
        this.weights.push(w.slice());
        if (err === 0) break;
      }
      return this;
    }

    decisionOne(x, nTrees = null) {
      const k = nTrees === null ? this.trees.length : Math.min(nTrees, this.trees.length);
      let s = 0;
      for (let m = 0; m < k; m++) s += this.alphas[m] * (this.trees[m].predictOne(x) >= 0 ? 1 : -1);
      return s;
    }

    decisionFunction(X, nTrees = null) {
      return X.map((x) => this.decisionOne(x, nTrees));
    }

    predict(X, nTrees = null) {
      return this.decisionFunction(X, nTrees).map((v) => (v > 0 ? 1 : 0));
    }
  }

  GBC.BaggingTrees = BaggingTrees;
  GBC.AdaBoost = AdaBoost;
})(typeof window !== 'undefined' ? window : globalThis);
