/* Урок 1: «бустинг одного числа» и карта формулы. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('boost-a-number', (el) => {
    const s = { target: 10, nu: 0.5, steps: 12 };
    const w = ui.shell(el, {
      title: 'Бустинг одного числа',
      sub: 'Модель — одно число F. На каждом шаге «дерево» предсказывает остаток r = y − F, а мы прибавляем его долю ν.',
    });
    ui.slider(w.controls, { label: 'Цель y', min: 1, max: 20, step: 1, value: s.target, format: String, onInput: (v) => ((s.target = v), draw()) });
    ui.slider(w.controls, { label: 'Темп ν', min: 0.05, max: 2.2, step: 0.05, value: s.nu, onInput: (v) => ((s.nu = v), draw()) });
    ui.slider(w.controls, { label: 'Шагов M', min: 1, max: 40, step: 1, value: s.steps, format: String, onInput: (v) => ((s.steps = v), draw()) });
    const plot = new GBC.Plot(w.main, {
      height: 260, x: { label: 'шаг m' }, y: { label: 'значение' }, crosshair: true, crosshairTitle: (v) => 'шаг ' + Math.round(v),
      table: () => ({ columns: ['m', 'F_m', 'остаток'], rows: seq().F.map((f, m) => [m, f, s.target - f]) }),
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'F', label: 'Прогноз F_M' }, { key: 'r', label: 'Остаток y − F_M' }, { key: 'k', label: 'Множитель остатка (1 − ν)' }]);
    function seq() {
      const F = [0];
      for (let m = 1; m <= s.steps; m++) F.push(F[m - 1] + s.nu * (s.target - F[m - 1]));
      return { F, r: F.map((f) => s.target - f) };
    }
    function draw() {
      const { F, r } = seq();
      const ms = U.range(F.length);
      plot.render([
        { type: 'hline', y: s.target, color: 'ink2', dash: '5 4', width: 1.2, text: 'цель y = ' + s.target },
        { type: 'line', x: ms, y: r, color: 'tree', label: 'остаток y − F_m', width: 1.8 },
        { type: 'points', x: ms, y: r, color: 'tree', r: 3, legend: false },
        { type: 'line', x: ms, y: F, color: 'model', label: 'прогноз F_m', width: 2.4 },
        { type: 'points', x: ms, y: F, color: 'model', r: 3.5, legend: false },
      ], { y: [Math.min(0, ...F, ...r) - 1, Math.max(s.target, ...F) + 1.5] });
      const k = 1 - s.nu;
      stats.set('F', U.fmt(F[F.length - 1], 4));
      stats.set('r', U.fmt(r[r.length - 1], 4));
      stats.set('k', U.fmt(k, 2));
      note.innerHTML = Math.abs(k) >= 1
        ? '<b>|1 − ν| ≥ 1: остаток не уменьшается</b> — шаги так велики, что прогноз раскачивается всё сильнее. Это расходимость.'
        : k < 0
          ? 'ν > 1: остаток меняет знак — прогноз <b>перелетает</b> цель, но колебания затухают, потому что |1 − ν| < 1.'
          : 'Каждый шаг умножает остаток на ' + U.fmt(k, 2) + '. После M шагов остаётся (1 − ν)<sup>M</sup> = ' + U.fmt(Math.pow(k, s.steps), 3) + ' от исходной ошибки.';
    }
    w.pythonAction(() =>
      'y, nu, M = ' + s.target + ', ' + U.pyNum(s.nu) + ', ' + s.steps + '\nF = 0.0\nfor m in range(1, M + 1):\n    r = y - F          # остаток: сколько осталось до цели\n    F = F + nu * r     # «дерево» предсказывает остаток, берём его долю\n    print(f"шаг {m:2d}: F = {F:8.4f}, остаток = {y - F:8.4f}")\n'
    );
    draw();
  });

  GBC.widget('concept-map', (el) => {
    const map = GBC_MANIFEST && GBC_MANIFEST.course.concept_map;
    if (!map) return;
    el.classList.add('formula-map');
    GBC.page.renderConceptMap(el, map);
  });
})();
