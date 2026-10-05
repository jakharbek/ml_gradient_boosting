/* Урок 2.4: ограничения деревьев. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('tree-limits', (el) => {
    const s = { demo: 'extrap', depth: 3, shift: 0, M: 100 };
    const w = ui.shell(el, { title: 'Чего не умеет дерево', sub: 'Три демонстрации: выход за пределы данных, чувствительность к одной точке и приближение прямой ступеньками.' });
    const demoCtl = ui.segmented(w.controls, {
      label: 'Демонстрация',
      options: [{ value: 'extrap', label: 'Экстраполяция' }, { value: 'unstable', label: 'Неустойчивость' }, { value: 'stairs', label: 'Лесенка' }],
      value: s.demo, onChange: (v) => ((s.demo = v), sync(), draw()),
    });
    const depthCtl = ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 8, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const mCtl = ui.slider(w.controls, { label: 'Деревьев в бустинге', min: 1, max: 400, step: 1, value: s.M, format: String, onInput: (v) => ((s.M = v), draw()) });
    const shiftCtl = ui.slider(w.controls, { label: 'Сдвиг одной точки по y', min: -3, max: 3, step: 0.05, value: s.shift, onInput: (v) => ((s.shift = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const tvBox = H('div');
    w.main.appendChild(tvBox);
    const tv = new GBC.TreeView(tvBox, { featureNames: ['x'], valueFormat: (v) => U.fmt(v, 2) });
    const note = w.note('', true);
    function sync() {
      mCtl.el.hidden = s.demo === 'unstable';
      shiftCtl.el.hidden = s.demo !== 'unstable';
      tvBox.hidden = s.demo !== 'unstable';
    }
    const lin = GBC.datasets.regression1d({ kind: 'linear', n: 60, noise: 0.3, seed: 8, xMax: 6 });
    const sine = GBC.datasets.regression1d({ kind: 'sine', n: 40, noise: 0.3, seed: 12 });
    const linFull = GBC.datasets.regression1d({ kind: 'linear', n: 80, noise: 0.15, seed: 3 });
    function draw() {
      const gx = U.linspace(0, 10, 500);
      const G = gx.map((v) => [v]);
      if (s.demo === 'extrap') {
        const tree = new GBC.RegressionTree({ maxDepth: s.depth }).fit(lin.X, lin.y.map((v) => -v));
        const gb = new GBC.GradientBoosting({ nEstimators: s.M, learningRate: 0.1, maxDepth: 2 }).fit(lin.X, lin.y);
        plot.render([
          { type: 'vband', x0: 6, x1: 10, color: 'muted', opacity: 0.1 },
          { type: 'line', x: gx, y: gx.map((v) => 0.5 * v + 1), color: 'truth', dash: '5 4', width: 1.6, label: 'истина 0.5x + 1' },
          { type: 'points', x: lin.x, y: lin.y, color: 'data', r: 3.6, label: 'обучение (x ≤ 6)' },
          { type: 'line', x: gx, y: G.map((x) => tree.predictOne(x)), color: 'tree', width: 2, label: 'дерево' },
          { type: 'line', x: gx, y: gb.predictRaw(G), color: 'model', width: 2.4, label: 'бустинг' },
          { type: 'text', x: 8, y: 1.2, text: 'нет данных', anchor: 'middle' },
        ], { y: [0, 6.5] });
        note.innerHTML = 'Правее x = 6 и дерево, и бустинг выдают константу: все новые точки попадают в крайние правые листья. Добавление деревьев не помогает — ни одно дерево не видело x > 6.';
      } else if (s.demo === 'unstable') {
        const y = sine.y.slice();
        const i0 = 19;
        y[i0] += s.shift;
        const tree = new GBC.RegressionTree({ maxDepth: s.depth }).fit(sine.X, y.map((v) => -v));
        const base = new GBC.RegressionTree({ maxDepth: s.depth }).fit(sine.X, sine.y.map((v) => -v));
        plot.render([
          { type: 'line', x: gx, y: G.map((x) => base.predictOne(x)), color: 'model-prev', width: 1.8, label: 'дерево до сдвига' },
          { type: 'points', x: sine.x, y, color: (i) => (i === i0 ? 'orange' : 'data'), legendColor: 'data', r: (i) => (i === i0 ? 6 : 3.6), label: 'данные', draggable: true, onDrag: (i, xx, yy) => { if (i === i0) { s.shift = U.clamp(yy - sine.y[i0], -3, 3); shiftCtl.set(s.shift); draw(); } } },
          { type: 'line', x: gx, y: G.map((x) => tree.predictOne(x)), color: 'model', width: 2.4, label: 'дерево после сдвига' },
        ], { y: [-3, 3] });
        tv.render(tree);
        const changed = tree.nodes[0].threshold !== base.nodes[0].threshold;
        note.innerHTML = 'Двигайте оранжевую точку (ползунком или мышью). ' + (changed ? '<b>Корневой порог сменился</b> — перестроилось всё дерево ниже него.' : 'Пока корневое разбиение прежнее; сдвиньте точку сильнее.');
      } else {
        const tree = new GBC.RegressionTree({ maxDepth: s.depth }).fit(linFull.X, linFull.y.map((v) => -v));
        const gb = new GBC.GradientBoosting({ nEstimators: s.M, learningRate: 0.1, maxDepth: 1 }).fit(linFull.X, linFull.y);
        plot.render([
          { type: 'points', x: linFull.x, y: linFull.y, color: 'data', r: 3, label: 'данные' },
          { type: 'line', x: gx, y: G.map((x) => tree.predictOne(x)), color: 'tree', width: 2, label: 'одно дерево (' + tree.nLeaves + ' листьев)' },
          { type: 'line', x: gx, y: gb.predictRaw(G), color: 'model', width: 2.4, label: 'бустинг из ' + s.M + ' пней' },
        ], { y: [0, 6.5] });
        note.innerHTML = 'Одно дерево — грубая лесенка. Сумма сотни пней (ν = 0.1) даёт множество мелких ступенек, и кривая становится почти прямой.';
      }
    }
    sync();
    draw();
  });
})();
