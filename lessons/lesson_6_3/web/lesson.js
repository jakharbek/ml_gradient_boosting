/* Урок 6.3: softmax. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('softmax-explorer', (el) => {
    const s = { F: [1.0, 0.2, -0.5], y: 0 };
    const w = ui.shell(el, { title: 'Softmax и градиент', sub: 'Три логита → три вероятности. Попробуйте прибавить ко всем логитам одно число — вероятности не изменятся.' });
    const ctl = s.F.map((v, k) => ui.slider(w.controls, { label: 'логит F_' + k, min: -4, max: 4, step: 0.1, value: v, onInput: (x) => ((s.F[k] = x), draw()) }));
    ui.button(w.controls, { label: 'Сдвинуть все на +1', small: true, onClick: () => { s.F = s.F.map((v) => Math.min(4, v + 1)); s.F.forEach((v, k) => ctl[k].set(v)); draw(); } });
    ui.segmented(w.controls, { label: 'Истинный класс', options: [{ value: 0, label: '0' }, { value: 1, label: '1' }, { value: 2, label: '2' }], value: s.y, onChange: (v) => ((s.y = v), draw()) });
    const box = GBC.h('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 240, x: { label: 'класс', domain: [-0.6, 2.6], ticks: [0, 1, 2], format: String }, y: { label: 'вероятность p_k', domain: [0, 1] }, grid: 'y' });
    const p2 = new GBC.Plot(box, { height: 240, x: { label: 'класс', domain: [-0.6, 2.6], ticks: [0, 1, 2], format: String }, y: { label: 'псевдо-остаток y_k − p_k', domain: [-1, 1] }, grid: 'y' });
    const stats = ui.stats(w.foot, [{ key: 'p', label: 'Вероятности' }, { key: 'L', label: 'Кросс-энтропия −log p_y' }]);
    function draw() {
      const p = GBC.losses.softmaxRow(s.F);
      const cls = ['class0', 'class1', 'class2'];
      p1.render([{ type: 'bars', x: [0, 1, 2], y: p, color: (i) => cls[i], width: 0.5, tooltip: (i) => [{ label: 'p_' + i, value: U.fmt(p[i], 3) }] }]);
      const r = p.map((v, k) => (k === s.y ? 1 : 0) - v);
      p2.render([{ type: 'hline', y: 0, color: 'axis', width: 1 }, { type: 'bars', x: [0, 1, 2], y: r, color: (i) => cls[i], width: 0.5, tooltip: (i) => [{ label: 'r_' + i, value: U.fmt(r[i], 3) }] }]);
      stats.set('p', p.map((v) => U.fmt(v, 3)).join(' / '));
      stats.set('L', U.fmt(-Math.log(p[s.y]), 4));
    }
    draw();
  });
})();
