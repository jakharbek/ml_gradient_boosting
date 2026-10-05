/* Урок 11.1: анализ чувствительности LightGBM (данные — results.js). */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('sensitivity', (el) => {
    const S = GBC.sensitivity;
    const w = ui.shell(el, {
      title: 'Насколько ошибка зависит от каждого параметра',
      sub: 'Сверху — лучшее улучшение метрики относительно значений по умолчанию для каждого параметра; серая полоса — стандартное отклонение между разбиениями (зона шума). Снизу — кривая выбранного параметра: среднее ± стандартное отклонение.',
    });
    if (!S) {
      w.main.textContent = 'Нет данных: запустите python lessons/lesson_11_1/examples/sensitivity.py';
      return;
    }
    const s = { task: 0, param: 'num_leaves' };
    ui.select(w.controls, { label: 'Задача', value: '0', options: S.tasks.map((t, i) => ({ value: String(i), label: t.name })), onChange: (v) => ((s.task = Number(v)), draw()) });
    ui.select(w.controls, { label: 'Параметр для кривой', value: s.param, options: S.params.map((p) => ({ value: p, label: p })), onChange: (v) => ((s.param = v), draw()) });
    const note = GBC.h('p', { class: 'ctl-help' });
    w.controls.appendChild(note);
    const bars = new GBC.Plot(w.main, { height: 240, x: { label: '', domain: [-0.6, S.params.length - 0.4], ticks: U.range(S.params.length), format: (v) => String(Math.round(v) + 1) }, y: { label: 'улучшение метрики' } });
    const curve = new GBC.Plot(w.main, { height: 220, x: { label: s.param }, y: { label: '' } });
    const legend = GBC.h('ol', { class: 'ctl-help encoding-legend' }, ...S.params.map((p) => GBC.h('li', null, p)));
    w.controls.appendChild(legend);

    function draw() {
      const t = S.tasks[s.task];
      const gains = S.params.map((p) => t.params[p].gain);
      const stds = S.params.map((p) => {
        const c = t.params[p].curve;
        const base = c.find((q) => q.value === S.base[p]) || c[0];
        return base.std;
      });
      const noise = U.mean(stds);
      bars.render([
        { type: 'hline', y: noise, color: 'muted', dash: '4 3', width: 1.2 },
        { type: 'rect', x0: -0.6, x1: S.params.length - 0.4, y0: 0, y1: noise, fill: 'muted', opacity: 0.12 },
        {
          type: 'bars', x: U.range(S.params.length), y: gains, width: 0.6, maxPx: 40,
          color: (i) => (gains[i] > noise ? 'model' : 'muted'),
          tooltip: (i) => [[S.params[i], ''], ['лучшее улучшение', U.fmt(gains[i], 4)], ['размах', U.fmt(t.params[S.params[i]].range, 4)], ['шум (σ)', U.fmt(stds[i], 4)]],
        },
      ], { y: [Math.min(0, ...gains) - 0.002, Math.max(noise, ...gains) * 1.15] });
      const c = t.params[s.param].curve;
      const xs = U.range(c.length);
      curve.opts.x.label = s.param + ' (значения: ' + c.map((q) => q.value).join(', ') + ')';
      curve.opts.x.ticks = xs;
      curve.opts.x.format = (v) => String(c[Math.round(v)] ? c[Math.round(v)].value : '');
      curve.opts.x.domain = [-0.4, c.length - 0.6];
      curve.opts.y.label = t.metric + ' на валидации';
      curve.render([
        { type: 'hline', y: t.base, color: 'muted', dash: '4 3', width: 1.2 },
        { type: 'segments', x1: xs, x2: xs, y1: c.map((q) => q.score - q.std), y2: c.map((q) => q.score + q.std), color: 'model', width: 2, opacity: 0.6 },
        { type: 'line', x: xs, y: c.map((q) => q.score), color: 'model', width: 2, label: 'среднее ± σ' },
        { type: 'points', x: xs, y: c.map((q) => q.score), color: (i) => (c[i].value === S.base[s.param] ? 'tree' : 'model'), r: 4.5, label: 'оранжевая — по умолчанию' },
      ]);
      note.textContent = 'Значение по умолчанию: ' + t.metric + ' = ' + U.fmt(t.base, 4) + '. Средний шум между разбиениями σ ≈ ' + U.fmt(noise, 3) + '.';
    }
    draw();
  });
})();
