/* Урок 6.1: шансы, логит, log-loss. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('odds-explorer', (el) => {
    const s = { p: 0.8 };
    const w = ui.shell(el, { title: 'Вероятность, шансы и логит', sub: 'Двигайте вероятность: логит растёт медленно в середине и стремительно у краёв.' });
    ui.slider(w.controls, { label: 'Вероятность p', min: 0.01, max: 0.99, step: 0.01, value: s.p, onInput: (v) => ((s.p = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'логит F', domain: [-6, 6] }, y: { label: 'p = σ(F)', domain: [0, 1] }, crosshair: true, crosshairTitle: (v) => 'F = ' + U.fmt(v, 2) });
    const stats = ui.stats(w.foot, [{ key: 'p', label: 'Вероятность p' }, { key: 'odds', label: 'Шансы p/(1−p)' }, { key: 'logit', label: 'Логит F' }]);
    function draw() {
      const F = Math.log(s.p / (1 - s.p));
      const fs = U.linspace(-6, 6, 300);
      plot.render([
        { type: 'line', x: fs, y: fs.map(U.sigmoid), color: 'model', width: 2.4, label: 'σ(F)' },
        { type: 'vline', x: F, color: 'ink2', dash: '3 3', width: 1 },
        { type: 'hline', y: s.p, color: 'ink2', dash: '3 3', width: 1 },
        { type: 'points', x: [F], y: [s.p], color: 'tree', r: 6, label: 'текущая точка' },
      ]);
      stats.set('p', U.fmt(s.p, 2));
      stats.set('odds', U.fmt(s.p / (1 - s.p), 3) + ' : 1');
      stats.set('logit', U.fmt(F, 3));
    }
    draw();
  });

  GBC.widget('logloss-explorer', (el) => {
    const s = { y: 1, mse: false };
    const w = ui.shell(el, { title: 'Log-loss, его градиент и гессиан', sub: 'Как функции логита F для объекта с ответом y. Сравните с MSE на вероятностях: у неё градиент гаснет при уверенных ошибках.' });
    ui.segmented(w.controls, { label: 'Истинный класс y', options: [{ value: 1, label: 'y = 1' }, { value: 0, label: 'y = 0' }], value: s.y, onChange: (v) => ((s.y = v), draw()) });
    ui.toggle(w.controls, { label: 'Показать MSE на вероятностях', checked: false, onChange: (v) => ((s.mse = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 260, x: { label: 'F', domain: [-5, 5] }, y: { label: 'потери' }, crosshair: true, crosshairTitle: (v) => 'F = ' + U.fmt(v, 2) });
    const p2 = new GBC.Plot(box, { height: 260, x: { label: 'F', domain: [-5, 5] }, y: { label: 'производные', domain: [-1.05, 1.05] }, crosshair: true, crosshairTitle: (v) => 'F = ' + U.fmt(v, 2) });
    function draw() {
      const fs = U.linspace(-5, 5, 301);
      const y = s.y;
      const p = fs.map(U.sigmoid);
      const L = fs.map((f) => Math.max(f, 0) + Math.log1p(Math.exp(-Math.abs(f))) - y * f);
      const g = p.map((v) => v - y);
      const h = p.map((v) => v * (1 - v));
      const l1 = [{ type: 'line', x: fs, y: L, color: 'blue', label: 'log-loss' }];
      const l2 = [
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: fs, y: g, color: 'blue', label: 'градиент p − y' },
        { type: 'line', x: fs, y: h, color: 'aqua', label: 'гессиан p(1 − p)' },
      ];
      if (s.mse) {
        l1.push({ type: 'line', x: fs, y: p.map((v) => (y - v) ** 2), color: 'orange', label: 'MSE (y − p)²' });
        l2.push({ type: 'line', x: fs, y: p.map((v) => -2 * (y - v) * v * (1 - v)), color: 'orange', label: 'градиент MSE' });
      }
      p1.render(l1, { y: [0, 5.2] });
      p2.render(l2);
    }
    draw();
  });
})();
