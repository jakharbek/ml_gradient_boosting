#!/usr/bin/env node
/**
 * Прогоняет эксперименты из cases.json на JS-движке курса и печатает JSON с
 * результатами. Python-тест tests/python/test_parity.py сравнивает их с gbcourse.
 *
 *   node tests/parity/run_js.js > out.json
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const JS = path.join(ROOT, 'shared', 'web', 'js');
for (const f of [
  'core.js', 'engine/rng.js', 'engine/datasets.js', 'engine/losses.js', 'engine/tree.js',
  'engine/boosting.js', 'engine/ensembles.js', 'engine/explain.js', 'engine/metrics.js',
]) {
  require(path.join(JS, f));
}
const GBC = globalThis.GBC;

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const camelize = (obj) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [camel(k), v]));

function loadData(c) {
  const d = GBC.datasets.make(c.data.name, camelize(c.data.params));
  let X = d.X;
  let y = d.y;
  if (c.missing) X = GBC.datasets.injectMissing(X, c.missing, 7);
  if (c.y_transform === 'floor_abs') y = y.map((v) => Math.floor(Math.abs(v)));
  return { X, y };
}

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
const out = {};
for (const c of cases) {
  let { X, y } = loadData(c);
  let evalSet = null;
  if (c.split) {
    const s = GBC.datasets.trainTestSplit(X, y, c.split.test_size, c.split.seed);
    X = s.Xtrain;
    y = s.ytrain;
    evalSet = [s.Xtest, s.ytest];
  }
  const model = new GBC.GradientBoosting(camelize(c.model)).fit(X, y, { evalSet });
  const nNodes = model.trees.reduce((acc, st) => acc + st.reduce((a, t) => a + t.nodes.length, 0), 0);
  out[c.name] = {
    X: X.map((r) => r.map((v) => (Number.isNaN(v) ? null : v))),
    y,
    X_eval: evalSet ? evalSet[0].map((r) => r.map((v) => (Number.isNaN(v) ? null : v))) : null,
    y_eval: evalSet ? evalSet[1] : null,
    raw: model.predictRaw(X),
    train: model.history.train,
    eval: model.history.eval,
    n_trees: model.trees.length,
    n_nodes: nNodes,
    best_iteration: model.bestIteration,
  };
}

// Ансамбли и интерпретация
{
  const d = GBC.datasets.classification2d({ kind: 'circles', n: 160, noise: 0.15, seed: 5 });
  const ada = new GBC.AdaBoost({ nEstimators: 25 }).fit(d.X, d.y);
  out.adaboost = { decision: ada.decisionFunction(d.X), alphas: ada.alphas, errors: ada.errors };
  const r = GBC.datasets.regression1d({ kind: 'wave', n: 100, noise: 0.3, seed: 4 });
  const bag = new GBC.BaggingTrees({ nEstimators: 15, maxDepth: 4, seed: 3 }).fit(r.X, r.y);
  out.bagging = { pred: bag.predict(r.X), oob: bag.oobPredict(r.X).map((v) => (Number.isNaN(v) ? null : v)) };
  const f = GBC.datasets.friedman1({ n: 150, noise: 0.5, seed: 2, nFeatures: 6 });
  const rf = new GBC.BaggingTrees({ nEstimators: 8, maxDepth: 5, maxFeatures: 0.5, seed: 9 }).fit(f.X, f.y);
  out.random_forest = { pred: rf.predict(f.X) };
  const gb = new GBC.GradientBoosting({ nEstimators: 20, maxDepth: 3, learningRate: 0.2 }).fit(f.X, f.y);
  out.shapley = [0, 1, 2].map((i) => {
    const s = GBC.explain.shapleyValues(gb, f.X[i]);
    return { base: s.base, phi: s.phi, fx: s.fx };
  });
}

process.stdout.write(JSON.stringify(out));
