/* Урок 1.1: подбор параметров модели руками. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('manual-fit', (el) => {
    const data = GBC.datasets.regression1d({ kind: 'wave', n: 40, noise: 0.4, seed: 11 });
    const x = data.x;
    const y = data.y;
    const s = { kind: 'const', c: 1, a: 0.2, b: 0.5, t: 5, c1: 0.5, c2: 2.5 };
    const w = ui.shell(el, {
      title: 'Подберите модель руками',
      sub: 'Двигайте ползунки и следите за MSE. Серые отрезки — ошибки на каждом объекте, их квадраты и усредняются.',
    });
    const kindCtl = ui.segmented(w.controls, {
      label: 'Модель',
      options: [{ value: 'const', label: 'Константа' }, { value: 'line', label: 'Прямая' }, { value: 'stump', label: 'Ступенька' }],
      value: s.kind, onChange: (v) => ((s.kind = v), showCtl(), draw()),
    });
    const ctl = {
      c: ui.slider(w.controls, { label: 'c (уровень)', min: -1, max: 4, step: 0.01, value: s.c, onInput: (v) => ((s.c = v), draw()) }),
      a: ui.slider(w.controls, { label: 'a (наклон)', min: -0.5, max: 0.8, step: 0.005, value: s.a, onInput: (v) => ((s.a = v), draw()) }),
      b: ui.slider(w.controls, { label: 'b (сдвиг)', min: -2, max: 3, step: 0.01, value: s.b, onInput: (v) => ((s.b = v), draw()) }),
      t: ui.slider(w.controls, { label: 't (порог)', min: 0, max: 10, step: 0.05, value: s.t, onInput: (v) => ((s.t = v), draw()) }),
      c1: ui.slider(w.controls, { label: 'c₁ (слева от порога)', min: -1, max: 4, step: 0.01, value: s.c1, onInput: (v) => ((s.c1 = v), draw()) }),
      c2: ui.slider(w.controls, { label: 'c₂ (справа)', min: -1, max: 4, step: 0.01, value: s.c2, onInput: (v) => ((s.c2 = v), draw()) }),
    };
    const best = ui.button(w.controls, { label: 'Найти лучшие параметры', kind: 'primary', small: true, onClick: fitBest });
    best.style.alignSelf = 'flex-start';
    function showCtl() {
      const vis = { const: ['c'], line: ['a', 'b'], stump: ['t', 'c1', 'c2'] }[s.kind];
      for (const k of Object.keys(ctl)) ctl[k].el.hidden = !vis.includes(k);
    }
    const plot = new GBC.Plot(w.main, {
      height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-1.5, 4.5] },
      table: () => ({ columns: ['x', 'y', 'прогноз', 'ошибка²'], rows: x.map((v, i) => [v, y[i], F(v), (y[i] - F(v)) ** 2]) }),
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'mse', label: 'MSE' }, { key: 'best', label: 'Лучшая MSE для этой модели' }, { key: 'k', label: 'Параметров' }]);
    const F = (v) => (s.kind === 'const' ? s.c : s.kind === 'line' ? s.a * v + s.b : v <= s.t ? s.c1 : s.c2);

    function optimum(kind) {
      if (kind === 'const') return { c: U.mean(y) };
      if (kind === 'line') {
        const mx = U.mean(x);
        const my = U.mean(y);
        let sxy = 0;
        let sxx = 0;
        x.forEach((v, i) => ((sxy += (v - mx) * (y[i] - my)), (sxx += (v - mx) * (v - mx))));
        const a = sxy / sxx;
        return { a, b: my - a * mx };
      }
      const tree = new GBC.RegressionTree({ maxDepth: 1 }).fit(data.X, y.map((v) => -v));
      const r = tree.nodes[0];
      return { t: r.threshold, c1: tree.nodes[r.left].value, c2: tree.nodes[r.right].value };
    }
    function mseOf(fn) {
      return U.mean(x.map((v, i) => (y[i] - fn(v)) ** 2));
    }
    function fitBest() {
      const o = optimum(s.kind);
      for (const [k, v] of Object.entries(o)) {
        s[k] = v;
        ctl[k].set(v);
      }
      draw();
    }
    function draw() {
      const pred = x.map(F);
      const gx = U.linspace(0, 10, 401);
      plot.render([
        { type: 'segments', x1: x, y1: y, x2: x, y2: pred, color: 'residual', opacity: 0.6 },
        { type: 'points', x, y, color: 'data', r: 4, label: 'данные', tooltip: (i) => [{ label: 'x', value: U.fmt(x[i], 2) }, { label: 'y', value: U.fmt(y[i], 2) }, { label: 'ошибка', value: U.fmt(y[i] - pred[i], 2) }] },
        { type: 'line', x: gx, y: gx.map(F), color: 'model', width: 2.4, label: 'модель F(x)' },
      ]);
      const cur = mseOf(F);
      const o = optimum(s.kind);
      const saved = Object.assign({}, s);
      Object.assign(s, o);
      const bestMse = mseOf(F);
      Object.assign(s, saved);
      stats.set('mse', U.fmt(cur, 4));
      stats.set('best', U.fmt(bestMse, 4));
      stats.set('k', String({ const: 1, line: 2, stump: 3 }[s.kind]));
      const gap = cur - bestMse;
      note.innerHTML = gap < 1e-4
        ? '✓ Это оптимум: лучше параметров для модели «' + { const: 'константа', line: 'прямая', stump: 'ступенька' }[s.kind] + '» нет. Попробуйте другую модель — у более гибкой оптимум ниже.'
        : 'До оптимума осталось снизить MSE на ' + U.fmt(gap, 3) + '.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, RegressionTree\n\nX, y = datasets.regression_1d(kind="wave", n=40, noise=0.4, seed=11)\nx = X[:, 0]\n\n' +
      'print("константа:  c =", y.mean(), " MSE =", np.mean((y - y.mean()) ** 2))\n' +
      'a, b = np.polyfit(x, y, 1)\nprint("прямая: a =", a, "b =", b, " MSE =", np.mean((y - (a * x + b)) ** 2))\n' +
      'stump = RegressionTree(max_depth=1).fit(X, -y)\nprint("ступенька: порог =", stump.nodes[0].threshold, " MSE =", np.mean((y - stump.predict(X)) ** 2))\n'
    );
    showCtl();
    draw();
  });
})();
