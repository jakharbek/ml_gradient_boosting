/* Урок 14: результаты эталонного решения итогового проекта (results.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('capstone', (el) => {
    const C = GBC.capstone;
    const w = ui.shell(el, {
      title: 'Эталонное решение',
      sub: 'Метрика на каждом шаге для валидации (месяцы 15–18) и теста (19–24, после подорожания). Для log-loss лучше меньше, для AUC и AP — больше. Снизу — средний |SHAP| признаков лучшей модели на тесте.',
      stack: true,
    });
    if (!C) {
      w.main.textContent = 'Нет данных: запустите python lessons/lesson_14/examples/capstone.py';
      return;
    }
    const s = { metric: 'log-loss' };
    ui.segmented(w.controls, { label: 'Метрика', value: s.metric, options: ['log-loss', 'AUC', 'AP'].map((m) => ({ value: m, label: m })), onChange: (v) => ((s.metric = v), draw()) });
    const info = H('div', { class: 'ctl-help' });
    w.controls.appendChild(info);
    info.innerHTML = 'Строк: обучение ' + C.rows.train + ', валидация ' + C.rows.valid + ', тест ' + C.rows.test +
      '<br>Доля уходов: ' + U.fmt(C.rate.train, 3) + ' / ' + U.fmt(C.rate.valid, 3) + ' / ' + U.fmt(C.rate.test, 3) +
      '<br>PSI платежа обучение→тест: ' + U.fmt(C.psi_charge, 3) + '<br>AUC «обучение против теста»: ' + U.fmt(C.adv_auc, 3);
    const n = C.steps.length;
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'шаг', domain: [-0.4, n - 0.6], ticks: U.range(n), format: (v) => String(Math.round(v)) }, y: { label: '' } });
    const RU = { monthly_charge: 'платёж', contract: 'тариф', region: 'регион', usage_gb: 'трафик', tenure: 'стаж', support_calls: 'звонки', days_since_login: 'без входа', payment: 'оплата', age: 'возраст' };
    const feats = Object.keys(C.shap).sort((a, b) => C.shap[b] - C.shap[a]);
    const shap = new GBC.Plot(w.main, { height: 200, x: { label: '', domain: [-0.6, feats.length - 0.4], ticks: U.range(feats.length), format: (v) => RU[feats[Math.round(v)]] || feats[Math.round(v)] || '' }, y: { label: 'средний |SHAP|' } });
    shap.render([{ type: 'bars', x: U.range(feats.length), y: feats.map((f) => C.shap[f]), width: 0.6, maxPx: 40, color: 'model', tooltip: (i) => [[feats[i] + ' (' + RU[feats[i]] + ')', U.fmt(C.shap[feats[i]], 4)]] }]);
    const table = H('table', { class: 'data' });
    w.main.appendChild(H('div', { class: 'table-wrap' }, table));

    function draw() {
      const m = s.metric;
      const xs = U.range(n);
      const skip = m === 'log-loss' ? 0 : 1; // у константы AUC = 0.5, AP = доля — сжимают шкалу
      plot.opts.y.label = m;
      plot.render([
        { type: 'line', x: xs.slice(skip), y: C.steps.slice(skip).map((q) => q.valid[m]), color: 'valid', width: 2, label: 'валидация' },
        { type: 'points', x: xs.slice(skip), y: C.steps.slice(skip).map((q) => q.valid[m]), color: 'valid', r: 4 },
        { type: 'line', x: xs.slice(skip), y: C.steps.slice(skip).map((q) => q.test[m]), color: 'test', width: 2, label: 'тест' },
        { type: 'points', x: xs.slice(skip), y: C.steps.slice(skip).map((q) => q.test[m]), color: 'test', r: 4 },
      ]);
      table.textContent = '';
      table.appendChild(H('tr', null, H('th', null, 'Шаг'), H('th', null, 'Что сделано'), H('th', { class: 'num' }, m + ' валид.'), H('th', { class: 'num' }, m + ' тест')));
      for (const q of C.steps) table.appendChild(H('tr', null, H('td', null, q.step), H('td', null, q.note), H('td', { class: 'num' }, U.fmt(q.valid[m], 4)), H('td', { class: 'num' }, U.fmt(q.test[m], 4))));
    }
    draw();
  });
})();
