/* =====================================================================================
 * Интерпретация — зеркало gbcourse/explain.py: EXPVALUE, точные значения Шепли,
 * PDP/ICE, перестановочная важность.
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC || (root.GBC = {});

  /** E[f(X) | X_S = x_S] для одного дерева; known — Set номеров признаков. */
  function expectedValue(tree, x, known, cover = 'n') {
    const nodes = tree.nodes;
    const weight = (nd) => (cover === 'n' ? nd.n : nd.H);
    const go = (id) => {
      const nd = nodes[id];
      if (nd.left < 0) return nd.value;
      if (known.has(nd.feature)) {
        const v = x[nd.feature];
        const left = Number.isNaN(v) ? nd.missingLeft : v <= nd.threshold;
        return go(left ? nd.left : nd.right);
      }
      const a = nodes[nd.left];
      const b = nodes[nd.right];
      const wa = weight(a);
      const wb = weight(b);
      const tot = wa + wb;
      if (tot <= 0) return 0.5 * (go(a.id) + go(b.id));
      return (wa * go(a.id) + wb * go(b.id)) / tot;
    };
    return go(0);
  }

  function modelTrees(model, classIndex = 0) {
    if (model instanceof GBC.GradientBoosting) {
      const k = model.multiclass ? classIndex : 0;
      const base = model.multiclass ? model.init[k] : model.init;
      return { trees: model.trees.map((stage) => [stage[k], model.learningRate]), base };
    }
    if (model instanceof GBC.BaggingTrees) {
      const B = model.trees.length;
      return { trees: model.trees.map((t) => [t, 1 / B]), base: 0 };
    }
    if (model.nodes) return { trees: [[model, 1]], base: 0 };
    throw new Error('Неподдерживаемая модель');
  }

  /** Точные значения Шепли: {base, phi, fx}. Сложность O(2^M·T·L). */
  function shapleyValues(model, x, { cover = 'n', classIndex = 0 } = {}) {
    const { trees, base } = modelTrees(model, classIndex);
    const usedSet = new Set();
    for (const [t] of trees) for (const nd of t.nodes) if (nd.left >= 0) usedSet.add(nd.feature);
    const used = Array.from(usedSet).sort((a, b) => a - b);
    const M = used.length;
    const cache = new Map();
    const v = (mask) => {
      if (!cache.has(mask)) {
        const S = new Set();
        for (let j = 0; j < M; j++) if ((mask >> j) & 1) S.add(used[j]);
        let s = base;
        for (const [t, c] of trees) s += c * expectedValue(t, x, S, cover);
        cache.set(mask, s);
      }
      return cache.get(mask);
    };
    const fact = [1];
    for (let k = 1; k <= M; k++) fact.push(fact[k - 1] * k);
    const phi = new Array(x.length).fill(0);
    const popcount = (m) => {
      let c = 0;
      while (m) {
        c += m & 1;
        m >>= 1;
      }
      return c;
    };
    for (let j = 0; j < M; j++) {
      const bit = 1 << j;
      let total = 0;
      for (let mask = 0; mask < 1 << M; mask++) {
        if (mask & bit) continue;
        const s = popcount(mask);
        const w = (fact[s] * fact[M - s - 1]) / fact[M];
        total += w * (v(mask | bit) - v(mask));
      }
      phi[used[j]] = total;
    }
    const full = (1 << M) - 1;
    return { base: v(0), phi, fx: v(full) };
  }

  function partialDependence(predictOne, X, feature, grid) {
    return grid.map((gv) => {
      let s = 0;
      for (const row of X) {
        const r = row.slice();
        r[feature] = gv;
        s += predictOne(r);
      }
      return s / X.length;
    });
  }

  function iceCurves(predictOne, X, feature, grid) {
    return X.map((row) =>
      grid.map((gv) => {
        const r = row.slice();
        r[feature] = gv;
        return predictOne(r);
      })
    );
  }

  function permutationImportance(predict, X, y, metric, { nRepeats = 5, seed = 0, greaterIsBetter = false } = {}) {
    const rng = new GBC.RNG(seed);
    const baseScore = metric(y, predict(X));
    const d = X[0].length;
    const mean = [];
    const std = [];
    for (let j = 0; j < d; j++) {
      const drops = [];
      for (let r = 0; r < nRepeats; r++) {
        const perm = rng.permutation(X.length);
        const Xp = X.map((row, i) => {
          const c = row.slice();
          c[j] = X[perm[i]][j];
          return c;
        });
        const sc = metric(y, predict(Xp));
        drops.push(greaterIsBetter ? baseScore - sc : sc - baseScore);
      }
      const m = GBC.util.mean(drops);
      mean.push(m);
      std.push(Math.sqrt(GBC.util.variance(drops)));
    }
    return { mean, std };
  }

  GBC.explain = { expectedValue, shapleyValues, partialDependence, iceCurves, permutationImportance };
})(typeof window !== 'undefined' ? window : globalThis);
