/* Урок 9.4: результаты бенчмарка (данные — results.js, их пишет examples/benchmark.py). */
(function () {
  'use strict';
  const { util: U, ui } = GBC;
  const LIBS = ['XGBoost', 'LightGBM', 'CatBoost'];
  const LIB_COLOR = { XGBoost: 'blue', LightGBM: 'orange', CatBoost: 'aqua' };

  GBC.widget('benchmark', (el) => {
    const B = GBC.benchmark;
    const w = ui.shell(el, {
      title: 'Три библиотеки, три задачи',
      sub: 'Среднее по трём разбиениям; наведите на столбец, чтобы увидеть разброс. Бледные столбцы — параметры по умолчанию, насыщенные — темп 0.05 с ранней остановкой.',
    });
    if (!B) {
      w.main.textContent = 'Нет данных: запустите python lessons/lesson_9_4/examples/benchmark.py';
      return;
    }
    const s = { task: 0, what: 'score' };
    ui.select(w.controls, { label: 'Задача', value: '0', options: B.tasks.map((t, i) => ({ value: String(i), label: t.name })), onChange: (v) => ((s.task = Number(v)), draw()) });
    ui.segmented(w.controls, { label: 'Показать', value: s.what, options: [{ value: 'score', label: 'качество' }, { value: 'time', label: 'время' }, { value: 'trees', label: 'деревьев' }], onChange: (v) => ((s.what = v), draw()) });
    const note = GBC.h('p', { class: 'ctl-help' }, 'Версии: ' + Object.entries(B.versions).map(([k, v]) => k + ' ' + v).join(', '));
    w.controls.appendChild(note);
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: '', domain: [-0.6, 2.6], ticks: [0, 1, 2], format: (v) => LIBS[Math.round(v)] || '' }, y: { label: '' } });
    const stats = ui.stats(w.foot, LIBS.map((l) => ({ key: l, label: l + ': умолч. → настроено' })));

    function draw() {
      const t = B.tasks[s.task];
      const get = (lib, mode) => t.rows.find((r) => r.lib === lib && r.mode === mode);
      const lab = { score: t.metric + ' на тесте (меньше — лучше)', time: 'время обучения, с', trees: 'число деревьев' }[s.what];
      const log = s.what === 'time';
      const vals = [];
      const layers = [];
      ['default', 'early'].forEach((mode, k) => {
        const xs = LIBS.map((_, i) => i + (k - 0.5) * 0.38);
        const ys = LIBS.map((lib) => get(lib, mode)[s.what]);
        vals.push(...ys);
        layers.push({
          type: 'bars', x: xs, y: ys, width: 0.34, maxPx: 56, color: (i) => LIB_COLOR[LIBS[i]], opacity: k ? 1 : 0.4,
          label: k ? 'темп 0.05 + ранняя остановка' : 'по умолчанию',
          tooltip: (i) => {
            const r = get(LIBS[i], mode);
            return [[LIBS[i], mode === 'default' ? 'по умолчанию' : 'настроено'], [t.metric, U.fmt(r.score, 4) + ' ± ' + U.fmt(r.std, 2)], ['время', U.fmt(r.time, 3) + ' с'], ['деревьев', U.fmt(r.trees, 4)]];
          },
        });
      });
      plot.opts.y.label = lab;
      plot.opts.y.type = log ? 'log' : 'linear';
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const dom = log ? [lo / 2, hi * 2] : s.what === 'score' ? [lo - 0.25 * (hi - lo) - 1e-9, hi + 0.15 * (hi - lo) + 1e-9] : [0, hi * 1.1];
      for (const L of layers) L.base = dom[0];
      plot.render(layers, { y: dom });
      for (const lib of LIBS) {
        const a = get(lib, 'default')[s.what];
        const b = get(lib, 'early')[s.what];
        stats.set(lib, U.fmt(a, 4) + ' → ' + U.fmt(b, 4));
      }
    }
    draw();
  });
})();
