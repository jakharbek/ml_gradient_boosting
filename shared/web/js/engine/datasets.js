/* =====================================================================================
 * Учебные наборы данных — зеркало gbcourse/datasets.py.
 * При одинаковых параметрах и seed данные совпадают с Python (до последнего знака
 * тригонометрии). Любой набор можно получить в Jupyter строкой из toPython().
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC || (root.GBC = {});
  const RNG = GBC.RNG;

  const TRUE_FUNCTIONS = {
    sine: (x) => Math.sin(x),
    wave: (x) => Math.sin(x) + 0.3 * x,
    step: (x) => (x < 3.0 ? 1.0 : x < 6.5 ? 3.0 : 2.0),
    linear: (x) => 0.5 * x + 1.0,
    quadratic: (x) => 0.15 * (x - 5.0) * (x - 5.0) - 1.0,
    hetero: (x) => Math.sin(x) + 0.3 * x,
  };
  const REGRESSION_KINDS = Object.keys(TRUE_FUNCTIONS);
  const CLASSIFICATION_KINDS = ['moons', 'circles', 'blobs', 'blobs3', 'xor', 'spiral', 'linear'];

  const noiseScale = (kind, x) => (kind === 'hetero' ? 0.25 + 0.15 * x : 1.0);

  /** Одномерная регрессия y = f(x) + шум. Возвращает {X: [[x]], x: [x], y: [y]}. */
  function regression1d({ kind = 'sine', n = 80, noise = 0.3, seed = 42, xMin = 0, xMax = 10, outliers = 0 } = {}) {
    const f = TRUE_FUNCTIONS[kind];
    if (!f) throw new Error('Неизвестный kind=' + kind);
    const rng = new RNG(seed);
    const xs = new Array(n);
    for (let i = 0; i < n; i++) xs[i] = rng.uniform(xMin, xMax);
    xs.sort((a, b) => a - b);
    const ys = new Array(n);
    for (let i = 0; i < n; i++) ys[i] = f(xs[i]) + noise * noiseScale(kind, xs[i]) * rng.normal();
    if (outliers > 0) {
      for (let i = 0; i < n; i++) {
        if (rng.random() < outliers) {
          const magnitude = 4.0 + 3.0 * rng.random();
          const sign = rng.random() < 0.5 ? 1.0 : -1.0;
          ys[i] += sign * magnitude;
        }
      }
    }
    return { X: xs.map((v) => [v]), x: xs, y: ys };
  }

  function toyRegression() {
    const x = [1, 2, 3, 4, 5, 6];
    return { X: x.map((v) => [v]), x, y: [2, 4, 3, 7, 9, 11] };
  }

  /** Двумерная классификация. Возвращает {X: [[x0, x1]], y: [класс]}. */
  function classification2d({ kind = 'moons', n = 200, noise = 0.2, seed = 42, balance = null } = {}) {
    if (!CLASSIFICATION_KINDS.includes(kind)) throw new Error('Неизвестный kind=' + kind);
    const rng = new RNG(seed);
    const nClasses = kind === 'blobs3' ? 3 : 2;
    const X = new Array(n);
    const y = new Array(n);
    for (let i = 0; i < n; i++) {
      let c;
      if (balance !== null && balance !== undefined && kind !== 'xor' && kind !== 'linear') {
        c = rng.random() < balance ? 1 : 0;
      } else {
        c = i % nClasses;
      }
      let a;
      let b;
      if (kind === 'moons') {
        const t = Math.PI * rng.random();
        if (c === 0) {
          a = Math.cos(t);
          b = Math.sin(t);
        } else {
          a = 1.0 - Math.cos(t);
          b = 0.5 - Math.sin(t);
        }
      } else if (kind === 'circles') {
        const ang = 2.0 * Math.PI * rng.random();
        const r = c === 0 ? 1.0 : 0.5;
        a = r * Math.cos(ang);
        b = r * Math.sin(ang);
      } else if (kind === 'blobs') {
        a = c === 0 ? -1.0 : 1.0;
        b = c === 0 ? -0.5 : 0.5;
      } else if (kind === 'blobs3') {
        const theta = Math.PI / 2.0 + (2.0 * Math.PI * c) / 3.0;
        a = 1.2 * Math.cos(theta);
        b = 1.2 * Math.sin(theta);
      } else if (kind === 'xor') {
        a = rng.uniform(-1.0, 1.0);
        b = rng.uniform(-1.0, 1.0);
        c = a * b > 0 ? 1 : 0;
      } else if (kind === 'spiral') {
        const t = rng.random();
        const r = 0.15 + 0.85 * t;
        const ang = 3.0 * Math.PI * t + Math.PI * c;
        a = r * Math.cos(ang);
        b = r * Math.sin(ang);
      } else {
        a = rng.uniform(-1.0, 1.0);
        b = rng.uniform(-1.0, 1.0);
        c = b - 0.5 * a > 0 ? 1 : 0;
      }
      X[i] = [a + noise * rng.normal(), b + noise * rng.normal()];
      y[i] = c;
    }
    return { X, y };
  }

  function toyClassification() {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    return { X: x.map((v) => [v]), x, y: [0, 0, 0, 1, 0, 1, 1, 1] };
  }

  /** Задача Фридмана №1 (5 информативных признаков + шумовые). */
  function friedman1({ n = 500, noise = 1.0, seed = 42, nFeatures = 10 } = {}) {
    if (nFeatures < 5) throw new Error('friedman1 требует nFeatures >= 5');
    const rng = new RNG(seed);
    const X = new Array(n);
    const y = new Array(n);
    for (let i = 0; i < n; i++) {
      const row = new Array(nFeatures);
      for (let j = 0; j < nFeatures; j++) row[j] = rng.random();
      const eps = rng.normal();
      const [x0, x1, x2, x3, x4] = row;
      y[i] = 10.0 * Math.sin(Math.PI * x0 * x1) + 20.0 * (x2 - 0.5) * (x2 - 0.5) + 10.0 * x3 + 5.0 * x4 + noise * eps;
      X[i] = row;
    }
    return { X, y };
  }

  /** Категориальный признак высокой кардинальности. Возвращает {x, cat, y}. */
  function categoricalRegression({ n = 400, nCategories = 30, noise = 1.0, seed = 42, informative = true } = {}) {
    const rng = new RNG(seed);
    let effects = new Array(nCategories);
    for (let k = 0; k < nCategories; k++) effects[k] = rng.normal(0.0, 1.5);
    if (!informative) effects = effects.map(() => 0.0);
    const x = new Array(n);
    const cat = new Array(n);
    const y = new Array(n);
    for (let i = 0; i < n; i++) {
      const u = rng.random();
      const k = Math.min(nCategories - 1, Math.floor(nCategories * u * u));
      const xi = rng.uniform(0.0, 10.0);
      cat[i] = k;
      x[i] = xi;
      y[i] = effects[k] + Math.sin(xi) + noise * rng.normal();
    }
    return { x, cat, y, effects };
  }

  function injectMissing(X, frac = 0.1, seed = 7) {
    const rng = new RNG(seed);
    return X.map((row) => row.map((v) => (rng.random() < frac ? NaN : v)));
  }

  /** Детерминированное разбиение (совпадает с datasets.train_test_split). */
  function trainTestSplit(X, y, testSize = 0.25, seed = 0) {
    const n = y.length;
    const nTest = Math.floor(n * testSize + 0.5);
    const perm = new RNG(seed).permutation(n);
    const test = perm.slice(0, nTest).sort((a, b) => a - b);
    const train = perm.slice(nTest).sort((a, b) => a - b);
    return {
      Xtrain: train.map((i) => X[i]),
      Xtest: test.map((i) => X[i]),
      ytrain: train.map((i) => y[i]),
      ytest: test.map((i) => y[i]),
      trainIdx: train,
      testIdx: test,
    };
  }

  const GENERATORS = {
    regression_1d: regression1d,
    classification_2d: classification2d,
    friedman1,
    categorical_regression: categoricalRegression,
    toy_regression: toyRegression,
    toy_classification: toyClassification,
  };

  /** Имена параметров JS → Python для генерации кода. */
  const PY_NAMES = { xMin: 'x_min', xMax: 'x_max', nFeatures: 'n_features', nCategories: 'n_categories' };

  function pyValue(v) {
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number') return GBC.util.pyNum(v);
    return JSON.stringify(v);
  }

  GBC.datasets = {
    TRUE_FUNCTIONS,
    REGRESSION_KINDS,
    CLASSIFICATION_KINDS,
    trueFunction: (kind, x) => TRUE_FUNCTIONS[kind](x),
    regression1d,
    toyRegression,
    classification2d,
    toyClassification,
    friedman1,
    categoricalRegression,
    injectMissing,
    trainTestSplit,
    make(name, params = {}) {
      const gen = GENERATORS[name];
      if (!gen) throw new Error('Неизвестный набор ' + name);
      return gen(params);
    },
    /** Строка Python, воспроизводящая набор: datasets.regression_1d(kind="sine", ...). */
    toPython(name, params = {}) {
      const args = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => (PY_NAMES[k] || k) + '=' + pyValue(v));
      return 'datasets.' + name + '(' + args.join(', ') + ')';
    },
    pyValue,
  };
})(typeof window !== 'undefined' ? window : globalThis);
