/* Урок 6.2: шаг Ньютона для значения листа при log-loss. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('newton-leaf', (el) => {
    const s = { n1: 4, n0: 1, F: 0 };
    const w = ui.shell(el, {
      title: 'Лист под лупой: точные потери и их парабола',
      sub: 'В листе n₁ объектов класса 1 и n₀ класса 0, у всех текущий логит F. Синяя кривая — точные потери Φ(γ), оранжевая — парабола Тейлора. Её минимум — шаг Ньютона.',
    });
    ui.slider(w.controls, { label: 'Объектов класса 1, n₁', min: 0, max: 10, step: 1, value: s.n1, format: String, onInput: (v) => ((s.n1 = v), draw()) });
    ui.slider(w.controls, { label: 'Объектов класса 0, n₀', min: 0, max: 10, step: 1, value: s.n0, format: String, onInput: (v) => ((s.n0 = v), draw()) });
    ui.slider(w.controls, { label: 'Текущий логит F', min: -4, max: 4, step: 0.1, value: s.F, onInput: (v) => ((s.F = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'добавка γ', domain: [-6, 6] }, y: { label: 'потери листа' }, crosshair: true, crosshairTitle: (v) => 'γ = ' + U.fmt(v, 2) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'G', label: 'G = Σ(p − y)' }, { key: 'H', label: 'H = Σp(1 − p)' }, { key: 'newton', label: 'Шаг Ньютона −G/H' }, { key: 'exact', label: 'Точный минимум' }, { key: 'mean', label: 'Среднее псевдо-остатков' }]);
    function draw() {
      const n = s.n1 + s.n0;
      if (n === 0) {
        plot.render([]);
        return;
      }
      const p = U.sigmoid(s.F);
      const G = s.n0 * p + s.n1 * (p - 1);
      const H = n * p * (1 - p);
      const Phi = (g) => {
        const f = s.F + g;
        const l1 = Math.max(f, 0) + Math.log1p(Math.exp(-Math.abs(f)));
        return s.n1 * (l1 - f) + s.n0 * l1;
      };
      const newton = H > 1e-12 ? -G / H : 0;
      let exact;
      if (s.n1 > 0 && s.n0 > 0) exact = Math.log(s.n1 / s.n0) - s.F;
      else exact = s.n1 > 0 ? Infinity : -Infinity;
      const gs = U.linspace(-6, 6, 400);
      const quad = gs.map((g) => Phi(0) + G * g + 0.5 * H * g * g);
      const vals = gs.map(Phi);
      const ymax = Math.max(...vals) * 1.05;
      plot.render([
        { type: 'line', x: gs, y: vals, color: 'model', width: 2.4, label: 'точные потери Φ(γ)' },
        { type: 'line', x: gs, y: quad.map((v) => (v > ymax * 1.5 ? null : v)), color: 'tree', width: 2, dash: '6 4', label: 'парабола Тейлора' },
        { type: 'vline', x: U.clamp(newton, -6, 6), color: 'tree', width: 1.4, text: 'Ньютон' },
        Number.isFinite(exact) ? { type: 'vline', x: U.clamp(exact, -6, 6), color: 'model', width: 1.4, dash: '3 3', text: 'точный' } : null,
      ], { y: [0, ymax] });
      stats.set('G', U.fmt(G, 3));
      stats.set('H', U.fmt(H, 3));
      stats.set('newton', U.fmt(newton, 3));
      stats.set('exact', Number.isFinite(exact) ? U.fmt(exact, 3) : exact > 0 ? '+∞' : '−∞');
      stats.set('mean', U.fmt(-G / n, 3));
      note.innerHTML = !Number.isFinite(exact)
        ? 'Лист «чистый» — все объекты одного класса: точный минимум уходит в бесконечность, а шаг Ньютона конечен. Чем увереннее модель (|F| больше), тем меньше H и тем больше шаг — XGBoost сдерживает его регуляризацией λ.'
        : 'Точный минимум — там, где средняя вероятность в листе равна доле единиц: σ(F + γ) = n₁/n. Шаг Ньютона — минимум параболы; он близок к точному, если F + γ недалеко от F.';
    }
    draw();
  });
})();
