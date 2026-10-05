// Тесты JS-движка курса: node --test "tests/js/*.test.js"
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const JS = path.resolve(__dirname, '..', '..', 'shared', 'web', 'js');
for (const f of ['core.js', 'engine/rng.js', 'engine/datasets.js', 'engine/losses.js', 'engine/tree.js',
  'engine/boosting.js', 'engine/ensembles.js', 'engine/explain.js', 'engine/metrics.js']) {
  require(path.join(JS, f));
}
const GBC = globalThis.GBC;
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('Mulberry32 совпадает с эталонными значениями (как в Python)', () => {
  const r = new GBC.RNG(42);
  assert.equal(r.random(), 0.6011037519201636);
  assert.equal(r.random(), 0.44829055899754167);
});

test('sample и permutation дают перестановки без повторов', () => {
  const r = new GBC.RNG(1);
  const p = r.permutation(50);
  assert.equal(new Set(p).size, 50);
  const s = r.sample(20, 7);
  assert.equal(new Set(s).size, 7);
});

test('ручной пример урока 4.1: F0 = 6, первое дерево — листья −3 и +3', () => {
  const d = GBC.datasets.toyRegression();
  const m = new GBC.GradientBoosting({ nEstimators: 1, learningRate: 1, maxDepth: 1 }).fit(d.X, d.y);
  close(m.init, 6);
  const t = m.trees[0][0];
  close(t.nodes[0].threshold, 3.5);
  close(t.nodes[t.nodes[0].left].value, -3);
  close(t.nodes[t.nodes[0].right].value, 3);
});

test('потери на обучении монотонно не растут (L2, без подвыборки)', () => {
  const d = GBC.datasets.regression1d({ kind: 'wave', n: 100, noise: 0.3, seed: 5 });
  const m = new GBC.GradientBoosting({ nEstimators: 50, learningRate: 0.2, maxDepth: 2 }).fit(d.X, d.y);
  const h = m.history.train;
  for (let i = 1; i < h.length; i++) assert.ok(h[i] <= h[i - 1] + 1e-12);
});

test('StageCache совпадает с predictRaw', () => {
  const d = GBC.datasets.regression1d({ kind: 'sine', n: 60, seed: 3 });
  const m = new GBC.GradientBoosting({ nEstimators: 30, maxDepth: 2 }).fit(d.X, d.y);
  const grid = GBC.util.linspace(0, 10, 25).map((v) => [v]);
  const c = new GBC.StageCache(m, grid);
  for (const k of [10, 3, 30, 0, 17]) {
    const F = c.seek(k);
    const ref = m.predictRaw(grid, k);
    F.forEach((v, i) => close(v, ref[i], 1e-9));
  }
});

test('значения Шепли аддитивны: φ0 + Σφ = f(x)', () => {
  const d = GBC.datasets.friedman1({ n: 120, nFeatures: 5, seed: 2 });
  const m = new GBC.GradientBoosting({ nEstimators: 10, maxDepth: 3 }).fit(d.X, d.y);
  const s = GBC.explain.shapleyValues(m, d.X[0]);
  close(s.base + GBC.util.sum(s.phi), m.predictRawOne(d.X[0]), 1e-9);
});

test('логистическая классификация: точность на лунах > 90%', () => {
  const d = GBC.datasets.classification2d({ kind: 'moons', n: 200, noise: 0.2, seed: 1 });
  const m = new GBC.GradientBoosting({ loss: 'logistic', nEstimators: 60, learningRate: 0.3, maxDepth: 3 }).fit(d.X, d.y);
  assert.ok(GBC.metrics.accuracy(d.y, m.predict(d.X)) > 0.9);
});

test('ROC AUC: идеальный и случайный ранжировщики', () => {
  close(GBC.metrics.rocAuc([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9]), 1);
  close(GBC.metrics.rocAuc([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5]), 0.5);
});
