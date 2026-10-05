/* Урок 7.2: сравнение подвыборок строк и признаков. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('subsample-compare', (el) => {
    const s = { what: 'subsample', nu: 0.1 };
    const w = ui.shell(el, {
      title: 'Кривые валидации для разных подвыборок',
      sub: 'Задача Фридмана (10 признаков), глубина 3; каждая кривая — среднее по 2 разбиениям. Вычисления идут прямо в браузере — подождите пару секунд.',
    });
    ui.segmented(w.controls, { label: 'Что подвыбираем', options: [{ value: 'subsample', label: 'строки' }, { value: 'colsample', label: 'признаки' }], value: s.what, onChange: (v) => ((s.what = v), run()) });
    ui.segmented(w.controls, { label: 'Темп ν', options: [{ value: 0.1, label: '0.1' }, { value: 1, label: '1' }], value: s.nu, onChange: (v) => ((s.nu = v), run()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'итерация' }, y: { label: '½·MSE на валидации' }, crosshair: true, crosshairTitle: (v) => 'итерация ' + Math.round(v) });
    const note = w.note('', true);
    const data = GBC.datasets.friedman1({ n: 300, noise: 1, seed: 74 });
    const splits = [0, 1].map((sd) => GBC.datasets.trainTestSplit(data.X, data.y, 0.3, sd));
    function run() {
      note.textContent = 'Вычисляю…';
      setTimeout(() => {
        const fracs = [1, 0.8, 0.5, 0.2];
        const M = s.nu === 1 ? 60 : 200;
        const layers = [];
        const bests = [];
        fracs.forEach((f, k) => {
          const curves = splits.map((sp) =>
            new GBC.GradientBoosting({ nEstimators: M, learningRate: s.nu, maxDepth: 3, seed: 1, subsample: s.what === 'subsample' ? f : 1, colsample: s.what === 'colsample' ? f : 1 }).fit(sp.Xtrain, sp.ytrain, { evalSet: [sp.Xtest, sp.ytest] }).history.eval
          );
          const ev = curves[0].map((_, i) => U.mean(curves.map((c) => c[i])));
          bests.push(Math.min(...ev));
          layers.push({ type: 'line', x: U.range(ev.length), y: ev, color: GBC.colors.series(k), label: (s.what === 'subsample' ? 'subsample ' : 'colsample ') + f });
        });
        plot.render(layers, { y: [Math.min(...bests) * 0.9, Math.min(...bests) * 3] });
        const bi = U.argmax(bests.map((v) => -v));
        note.innerHTML = 'Лучшая ½MSE: ' + fracs.map((f, i) => f + ' → ' + U.fmt(bests[i], 3)).join(', ') + '. Лучше всего: <b>' + fracs[bi] + '</b>.';
      }, 20);
    }
    run();
  });
})();
