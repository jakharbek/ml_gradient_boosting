/* Урок 3.3: потери через отступ. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('margin-losses', (el) => {
    const s = { m: -1.5, grad: false };
    const w = ui.shell(el, { title: 'Потери как функции отступа yF', sub: 'Отступ > 0 — верный ответ, < 0 — ошибка. Двигайте точку: где потери растут медленно, а где взрываются?' });
    ui.slider(w.controls, { label: 'Отступ yF', min: -3, max: 3, step: 0.05, value: s.m, onInput: (v) => ((s.m = v), draw()) });
    ui.toggle(w.controls, { label: 'Показать производные (силу «притяжения»)', checked: false, onChange: (v) => ((s.grad = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'отступ yF', domain: [-3, 3] }, y: { label: 'потери' }, crosshair: true, crosshairTitle: (v) => 'yF = ' + U.fmt(v, 2) });
    const stats = ui.stats(w.foot, [{ key: 'z', label: '0–1 (ошибка)' }, { key: 'e', label: 'экспоненциальные' }, { key: 'l', label: 'логистические' }, { key: 'h', label: 'hinge (SVM)' }]);
    const f = {
      zero: (m) => (m <= 0 ? 1 : 0),
      exp: (m) => Math.exp(-m),
      logi: (m) => Math.log1p(Math.exp(-2 * m)) / Math.log(2),
      hinge: (m) => Math.max(0, 1 - m),
    };
    const d = { exp: (m) => Math.exp(-m), logi: (m) => (2 / Math.log(2)) / (1 + Math.exp(2 * m)), hinge: (m) => (m < 1 ? 1 : 0) };
    function draw() {
      const ms = U.linspace(-3, 3, 601);
      const src = s.grad ? d : f;
      const layers = [];
      if (!s.grad) layers.push({ type: 'line', x: ms, y: ms.map(f.zero), color: 'ink2', width: 1.6, label: '0–1 потеря', curve: 'step' });
      layers.push({ type: 'line', x: ms, y: ms.map(src.exp), color: 'orange', label: 'экспоненциальные e^{−yF}' });
      layers.push({ type: 'line', x: ms, y: ms.map(src.logi), color: 'blue', label: 'логистические (в битах)' });
      layers.push({ type: 'line', x: ms, y: ms.map(src.hinge), color: 'aqua', label: 'hinge max(0, 1 − yF)' });
      layers.push({ type: 'vline', x: s.m, color: 'ink', width: 1.4, dash: '4 3', draggable: true, onDrag: (v) => ((s.m = v), draw()) });
      plot.opts.y.label = s.grad ? '−∂L/∂(yF): сила притяжения' : 'потери';
      plot.render(layers, { y: [0, s.grad ? 8 : 8] });
      stats.set('z', U.fmt(f.zero(s.m), 2));
      stats.set('e', U.fmt(f.exp(s.m), 3));
      stats.set('l', U.fmt(f.logi(s.m), 3));
      stats.set('h', U.fmt(f.hinge(s.m), 3));
    }
    draw();
  });
})();
