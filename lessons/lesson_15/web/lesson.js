/* Модуль 15: демонстрация «наклон под курсором». */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('tangent-hover', (el) => {
    const f = (t) => Math.sin(1.3 * t) + 0.15 * t * t;
    const df = (t) => 1.3 * Math.cos(1.3 * t) + 0.3 * t;
    const s = { t: 0.6 };
    const w = ui.shell(el, { title: 'Наклон под курсором', sub: 'Ведите курсором по графику: касательная следует за ним, а внизу — её наклон f′(θ).', noControls: true });
    const plot = new GBC.Plot(w.main, {
      height: 300,
      x: { label: 'θ', domain: [-4, 4] },
      y: { label: 'f(θ)', domain: [-1.5, 3.5] },
      onHover: (p) => {
        if (p && Number.isFinite(p.x) && Math.abs(p.x - s.t) > 1e-3) {
          s.t = U.clamp(p.x, -4, 4);
          draw();
        }
      },
    });
    plot.onClick = (x) => ((s.t = x), draw());
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't', label: 'θ' }, { key: 'f', label: 'f(θ)' }, { key: 'd', label: 'наклон f′(θ)' }]);
    function draw() {
      const xs = U.linspace(-4, 4, 400);
      const t = s.t;
      const d = df(t);
      plot.render([
        { type: 'line', x: xs, y: xs.map(f), color: 'model', width: 2.2, label: 'f(θ)', hover: false },
        { type: 'segments', x1: [t - 0.9], y1: [f(t) - 0.9 * d], x2: [t + 0.9], y2: [f(t) + 0.9 * d], color: 'tree', width: 2.5, opacity: 1 },
        { type: 'points', x: [t], y: [f(t)], color: 'tree', r: 6 },
      ]);
      st.set('t', U.fmt(t, 2));
      st.set('f', U.fmt(f(t), 3));
      st.set('d', U.fmt(d, 3));
      note.innerHTML = Math.abs(d) < 0.05 ? 'Наклон ≈ 0: касательная горизонтальна — вершина или яма.' : d > 0 ? 'Наклон положительный: функция растёт вправо.' : 'Наклон отрицательный: функция убывает вправо.';
    }
    w.pythonAction(() => 'import numpy as np\nimport matplotlib.pyplot as plt\n\nf = lambda t: np.sin(1.3 * t) + 0.15 * t**2\ndf = lambda t: 1.3 * np.cos(1.3 * t) + 0.3 * t\n\nt0 = ' + U.pyNum(s.t) + '\nx = np.linspace(-4, 4, 400)\nplt.plot(x, f(x), label="f(θ)")\nseg = np.array([t0 - 0.9, t0 + 0.9])\nplt.plot(seg, f(t0) + df(t0) * (seg - t0), label=f"касательная, наклон {df(t0):.3f}")\nplt.legend()\nplt.show()\n');
    draw();
  });
})();
