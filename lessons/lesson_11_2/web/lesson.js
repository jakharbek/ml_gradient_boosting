/* Урок 11.2: сетка против случайного поиска на готовой поверхности ошибки (results.js). */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('search-sim', (el) => {
    const G = GBC.searchGrid;
    const w = ui.shell(el, {
      title: 'Сетка против случайного поиска',
      sub: 'Бюджет — число запусков. Сетка берёт k значений каждого из трёх параметров (k³ запусков); случайный поиск — столько же случайных точек. Сверху: лучшая найденная RMSE в зависимости от бюджета (у случайного — среднее по 400 повторам). Снизу: какие значения num_leaves и colsample_bytree проверили обе стратегии.',
    });
    if (!G) {
      w.main.textContent = 'Нет данных: запустите python lessons/lesson_11_2/examples/search_grid.py';
      return;
    }
    const s = { k: 3, seed: 1 };
    const [n0, n1, n2] = G.shape;
    const V = G.values;
    const at = (i, j, k) => V[(i * n1 + j) * n2 + k];
    const globalBest = Math.min(...V);
    const axisIdx = (n, k) => [...new Set(U.range(k).map((q) => Math.round((q * (n - 1)) / (k - 1 || 1))))];
    const gridBest = (k) => {
      let b = Infinity;
      for (const i of axisIdx(n0, k)) for (const j of axisIdx(n1, k)) for (const q of axisIdx(n2, k)) b = Math.min(b, at(i, j, q));
      return b;
    };
    // Средняя лучшая RMSE случайного поиска для бюджетов 1…70
    const rng = new GBC.RNG(7);
    const budgets = U.range(70).map((b) => b + 1);
    const REP = 400;
    const randMean = budgets.map((b) => {
      let sum = 0;
      for (let r = 0; r < REP; r++) {
        let best = Infinity;
        for (const t of rng.sample(V.length, b)) best = Math.min(best, V[t]);
        sum += best;
      }
      return sum / REP;
    });

    ui.slider(w.controls, { label: 'Значений на параметр в сетке k', min: 2, max: 4, step: 1, value: s.k, format: (v) => v + ' (бюджет ' + v ** 3 + ')', onInput: (v) => ((s.k = v), draw()) });
    ui.button(w.controls, { label: 'Другая случайная выборка', onClick: () => ((s.seed += 1), draw()) });
    const top = new GBC.Plot(w.main, { height: 230, x: { label: 'бюджет (запусков)', domain: [0, 70] }, y: { label: 'лучшая найденная RMSE' } });
    const proj = new GBC.Plot(w.main, { height: 240, x: { label: 'num_leaves', domain: [-0.5, n0 - 0.5], ticks: U.range(n0), format: (v) => String(G.axes.num_leaves[Math.round(v)] ?? '') }, y: { label: 'colsample_bytree', domain: [-0.5, n1 - 0.5], ticks: U.range(n1), format: (v) => String(G.axes.colsample_bytree[Math.round(v)] ?? '') } });
    const stats = ui.stats(w.foot, [{ key: 'grid', label: 'сетка: лучшая RMSE' }, { key: 'rand', label: 'эта случайная выборка' }, { key: 'best', label: 'глобальный минимум' }]);

    function draw() {
      const k = s.k;
      const N = k ** 3;
      const gk = [2, 3, 4].map((q) => ({ n: q ** 3, v: gridBest(q) }));
      top.render([
        { type: 'hline', y: globalBest, color: 'muted', dash: '4 3', width: 1.2 },
        { type: 'line', x: budgets, y: randMean, color: 'model', width: 2, label: 'случайный (среднее)' },
        { type: 'points', x: gk.map((g) => g.n), y: gk.map((g) => g.v), color: 'tree', r: 5, label: 'сетка k³' },
        { type: 'vline', x: N, color: 'ink', dash: '3 3', width: 1 },
      ]);
      // Проекция: какие (num_leaves, colsample) проверили
      const gi = axisIdx(n0, k);
      const gj = axisIdx(n1, k);
      const draw1 = new GBC.RNG(1000 + s.seed).sample(V.length, N);
      const pts = draw1.map((t) => [Math.floor(t / (n1 * n2)), Math.floor(t / n2) % n1]);
      const rBest = Math.min(...draw1.map((t) => V[t]));
      const gx = [];
      const gy = [];
      for (const i of gi) for (const j of gj) {
        gx.push(i);
        gy.push(j);
      }
      const bestLeaves = U.range(n0).reduce((a, i) => {
        let b = Infinity;
        for (let j = 0; j < n1; j++) for (let q = 0; q < n2; q++) b = Math.min(b, at(i, j, q));
        return b < a.v ? { i, v: b } : a;
      }, { i: 0, v: Infinity });
      proj.render([
        { type: 'vband', x0: bestLeaves.i - 0.5, x1: bestLeaves.i + 0.5, color: 'good', opacity: 0.12 },
        { type: 'points', x: pts.map((p) => p[0] + 0.12), y: pts.map((p) => p[1] + 0.12), color: 'model', r: 4, label: 'случайный поиск' },
        { type: 'points', x: gx.map((v) => v - 0.12), y: gy.map((v) => v - 0.12), color: 'tree', r: 5, shape: 'square', label: 'сетка (повторяется по subsample)' },
      ]);
      stats.set('grid', U.fmt(gridBest(k), 4) + ' (' + N + ' запусков)');
      stats.set('rand', U.fmt(rBest, 4));
      stats.set('best', U.fmt(globalBest, 4) + ' (из ' + V.length + ')');
    }
    draw();
  });
})();
