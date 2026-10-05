/* Урок 4.2: кривые валидации для разных темпов обучения. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('lr-compare', (el) => {
    const s = { depth: 3, noise: 0.5 };
    const NUS = [1, 0.3, 0.1, 0.03];
    const SPLITS = 5;
    const w = ui.shell(el, { title: 'Кривые валидации для четырёх темпов обучения', sub: 'Каждая кривая усреднена по 5 случайным разбиениям на обучение и валидацию: на одном небольшом разбиении шум легко маскирует закономерность. Точка — лучшая итерация.' });
    ui.slider(w.controls, { label: 'Глубина деревьев', min: 1, max: 6, step: 1, value: s.depth, format: String, onInput: U.debounce((v) => ((s.depth = v), draw()), 200) });
    ui.slider(w.controls, { label: 'Шум данных σ', min: 0.1, max: 1, step: 0.05, value: s.noise, onInput: U.debounce((v) => ((s.noise = v), draw()), 200) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'число деревьев M', type: 'log', domain: [1, 1500] }, y: { label: '½·MSE на валидации (среднее по 5 разбиениям)' }, crosshair: true, crosshairTitle: (v) => 'M = ' + Math.round(v) });
    const tableBox = GBC.h('div');
    w.main.appendChild(tableBox);
    function draw() {
      const d = GBC.datasets.regression1d({ kind: 'wave', n: 300, noise: s.noise, seed: 7 });
      const splits = U.range(SPLITS).map((seed) => GBC.datasets.trainTestSplit(d.X, d.y, 0.3, seed));
      const layers = [];
      const rows = [];
      let ymax = 0;
      NUS.forEach((nu, k) => {
        const M = Math.min(1500, Math.round(60 / nu));
        const curves = splits.map((sp) => new GBC.GradientBoosting({ nEstimators: M, learningRate: nu, maxDepth: s.depth }).fit(sp.Xtrain, sp.ytrain, { evalSet: [sp.Xtest, sp.ytest] }).history.eval);
        const ev = curves[0].map((_, i) => U.mean(curves.map((c) => c[i])));
        const xs = U.range(ev.length - 1, 1);
        const ys = ev.slice(1);
        ymax = Math.max(ymax, ys[0]);
        const best = U.argmax(ev.map((v) => -v));
        layers.push({ type: 'line', x: xs, y: ys, color: GBC.colors.series(k), label: 'ν = ' + nu });
        layers.push({ type: 'points', x: [best], y: [ev[best]], color: GBC.colors.series(k), r: 5, legend: false });
        rows.push(['ν = ' + nu, best, U.fmt(nu * best, 3), U.fmt(ev[best], 4)]);
      });
      plot.render(layers, { y: [0, Math.min(ymax, 1.5)] });
      tableBox.textContent = '';
      ui.table(tableBox, { columns: ['темп', 'лучшее M*', 'ν · M*', 'лучшая ½MSE'], rows });
    }
    w.pythonAction(() =>
      'import matplotlib.pyplot as plt\nfrom gbcourse import datasets, GBRegressor\nfrom gbcourse.plotting import use_course_style\n\nuse_course_style()\n' +
      'import numpy as np\nX, y = datasets.regression_1d(kind="wave", n=300, noise=' + U.pyNum(s.noise) + ', seed=7)\n' +
      'fig, ax = plt.subplots(figsize=(8, 4))\nfor nu in ' + JSON.stringify(NUS).replace(/,/g, ', ') + ':\n    curves = []\n    for seed in range(' + SPLITS + '):  # усредняем по разбиениям\n' +
      '        X_tr, X_val, y_tr, y_val = datasets.train_test_split(X, y, test_size=0.3, seed=seed)\n' +
      '        m = GBRegressor(n_estimators=min(1500, round(60 / nu)), learning_rate=nu, max_depth=' + s.depth + ').fit(X_tr, y_tr, eval_set=(X_val, y_val))\n' +
      '        curves.append(m.history_["eval"])\n    ev = np.mean(curves, axis=0)\n    ax.plot(range(1, len(ev)), ev[1:], label=f"ν = {nu}: лучшее M = {int(np.argmin(ev))}")\nax.set_xscale("log")\nax.set(xlabel="число деревьев", ylabel="½·MSE на валидации")\nax.legend()\nplt.show()\n'
    );
    draw();
  });
})();
