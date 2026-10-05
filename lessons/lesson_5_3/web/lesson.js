/* Урок 5.3: предсказательный интервал квантильным бустингом. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('quantile-band', (el) => {
    const train = GBC.datasets.regression1d({ kind: 'hetero', n: 400, noise: 0.5, seed: 54 });
    const test = GBC.datasets.regression1d({ kind: 'hetero', n: 1000, noise: 0.5, seed: 55 });
    const s = { lo: 0.1, hi: 0.9, M: 200, depth: 2 };
    const w = ui.shell(el, { title: 'Интервал из двух квантильных моделей', sub: 'Серые точки — обучение. Покрытие считается на 1000 новых точках из того же распределения.' });
    ui.slider(w.controls, { label: 'Нижний квантиль', min: 0.02, max: 0.45, step: 0.01, value: s.lo, onInput: U.debounce((v) => ((s.lo = v), fit()), 150) });
    ui.slider(w.controls, { label: 'Верхний квантиль', min: 0.55, max: 0.98, step: 0.01, value: s.hi, onInput: U.debounce((v) => ((s.hi = v), fit()), 150) });
    ui.slider(w.controls, { label: 'Деревьев', min: 10, max: 500, step: 10, value: s.M, format: String, onInput: U.debounce((v) => ((s.M = v), fit()), 150) });
    ui.slider(w.controls, { label: 'Глубина', min: 1, max: 5, step: 1, value: s.depth, format: String, onInput: U.debounce((v) => ((s.depth = v), fit()), 150) });
    const plot = new GBC.Plot(w.main, { height: 330, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'target', label: 'Целевое покрытие' }, { key: 'train', label: 'Покрытие на обучении' }, { key: 'test', label: 'Покрытие на новых данных' }, { key: 'cross', label: 'Пересечений квантилей' }]);
    function fit() {
      const mk = (a) => new GBC.GradientBoosting({ loss: 'quantile', quantileAlpha: a, nEstimators: s.M, learningRate: 0.1, maxDepth: s.depth }).fit(train.X, train.y);
      const mlo = mk(s.lo);
      const mhi = mk(s.hi);
      const med = mk(0.5);
      const gx = U.linspace(0, 10, 300).map((v) => [v]);
      const lo = mlo.predictRaw(gx);
      const hi = mhi.predictRaw(gx);
      const cov = (d) => {
        const a = mlo.predictRaw(d.X);
        const b = mhi.predictRaw(d.X);
        let c = 0;
        let crosses = 0;
        d.y.forEach((v, i) => {
          const l = Math.min(a[i], b[i]);
          const h = Math.max(a[i], b[i]);
          if (a[i] > b[i]) crosses++;
          if (v >= l && v <= h) c++;
        });
        return { cov: c / d.y.length, crosses };
      };
      const ctr = cov(train);
      const cte = cov(test);
      plot.render([
        { type: 'area', x: gx.map((r) => r[0]), y0: lo, y1: hi, color: 'model', opacity: 0.16, label: 'интервал ' + Math.round(100 * s.lo) + '–' + Math.round(100 * s.hi) + '%' },
        { type: 'points', x: train.x, y: train.y, color: 'data', r: 2.6, opacity: 0.7, label: 'обучение' },
        { type: 'line', x: gx.map((r) => r[0]), y: lo, color: 'model', width: 1.6, hover: false },
        { type: 'line', x: gx.map((r) => r[0]), y: hi, color: 'model', width: 1.6, hover: false },
        { type: 'line', x: gx.map((r) => r[0]), y: med.predictRaw(gx), color: 'tree', width: 2.2, label: 'медиана' },
      ]);
      stats.set('target', U.fmt(100 * (s.hi - s.lo), 0) + '%');
      stats.set('train', U.fmt(100 * ctr.cov, 1) + '%');
      stats.set('test', U.fmt(100 * cte.cov, 1) + '%');
      stats.set('cross', String(cte.crosses));
      note.innerHTML = 'Интервал расширяется с ростом x, как и шум в данных. Сравните покрытие на обучении и на новых данных: при большом числе глубоких деревьев квантильные модели подгоняются к обучающим точкам, и честное покрытие становится меньше целевого.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, GBRegressor\n\nX, y = datasets.regression_1d(kind="hetero", n=400, noise=0.5, seed=54)\nX_te, y_te = datasets.regression_1d(kind="hetero", n=1000, noise=0.5, seed=55)\n' +
      'lo = GBRegressor(loss="quantile", quantile_alpha=' + U.pyNum(s.lo) + ', n_estimators=' + s.M + ', max_depth=' + s.depth + ').fit(X, y).predict(X_te)\n' +
      'hi = GBRegressor(loss="quantile", quantile_alpha=' + U.pyNum(s.hi) + ', n_estimators=' + s.M + ', max_depth=' + s.depth + ').fit(X, y).predict(X_te)\n' +
      'lo, hi = np.minimum(lo, hi), np.maximum(lo, hi)\nprint("покрытие на новых данных:", np.mean((y_te >= lo) & (y_te <= hi)))\n'
    );
    fit();
  });
})();
