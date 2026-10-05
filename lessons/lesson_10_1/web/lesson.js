/* Урок 10.1: теорема Фишера о разбиении категорий; результаты сравнения способов кодирования. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  GBC.widget('category-partition', (el) => {
    const s = { K: 8, seed: 1 };
    const w = ui.shell(el, {
      title: 'Лучшее разбиение категорий на две группы',
      sub: 'У каждой категории — число объектов nₖ и средний остаток r̄ₖ (квадратичная потеря: Gₖ = −nₖ·r̄ₖ, Hₖ = nₖ). Сравниваем лучший выигрыш четырёх способов искать разбиение. Столбцы — категории в порядке r̄ₖ; цвет — группа в лучшем разбиении.',
    });
    ui.slider(w.controls, { label: 'Число категорий K', min: 3, max: 14, step: 1, value: s.K, format: String, onInput: (v) => ((s.K = v), draw()) });
    ui.button(w.controls, { label: 'Другие категории', onClick: () => ((s.seed += 1), draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'категория (в порядке среднего остатка)' }, y: { label: 'средний остаток r̄ₖ' } });
    const stats = ui.stats(w.foot, [
      { key: 'brute', label: 'полный перебор' },
      { key: 'sorted', label: 'сортировка по G/H' },
      { key: 'onevsrest', label: '«одна против всех»' },
      { key: 'ordinal', label: 'пороги по случайным кодам' },
    ]);

    function draw() {
      const rng = new GBC.RNG(1000 + s.seed);
      const K = s.K;
      const n = U.range(K).map(() => 5 + rng.randint(60));
      const r = U.range(K).map(() => rng.normal(0, 1));
      const G = n.map((nk, k) => -nk * r[k]);
      const H = n.slice();
      const Gt = U.sum(G);
      const Ht = U.sum(H);
      const gain = (mask) => {
        let gl = 0;
        let hl = 0;
        for (let k = 0; k < K; k++) if (mask[k]) {
          gl += G[k];
          hl += H[k];
        }
        if (hl === 0 || hl === Ht) return -Infinity;
        return 0.5 * ((gl * gl) / hl + ((Gt - gl) * (Gt - gl)) / (Ht - hl) - (Gt * Gt) / Ht);
      };
      // 1. Полный перебор: категория 0 всегда справа, чтобы не считать разбиения дважды
      let best = -Infinity;
      let bestMask = null;
      let checked = 0;
      for (let m = 1; m < 1 << (K - 1); m++) {
        const mask = U.range(K).map((k) => (k === 0 ? false : ((m >> (k - 1)) & 1) === 1));
        const g = gain(mask);
        checked++;
        if (g > best) {
          best = g;
          bestMask = mask;
        }
      }
      // 2. Сортировка по G/H и K − 1 порогов
      const order = U.range(K).sort((a, b) => G[a] / H[a] - G[b] / H[b]);
      let bestSorted = -Infinity;
      for (let t = 1; t < K; t++) {
        const mask = new Array(K).fill(false);
        for (let q = 0; q < t; q++) mask[order[q]] = true;
        bestSorted = Math.max(bestSorted, gain(mask));
      }
      // 3. Одна против всех
      let bestOne = -Infinity;
      for (let k = 0; k < K; k++) bestOne = Math.max(bestOne, gain(U.range(K).map((q) => q === k)));
      // 4. Пороги по случайным порядковым кодам
      const codes = rng.permutation(K);
      let bestOrd = -Infinity;
      for (let t = 1; t < K; t++) bestOrd = Math.max(bestOrd, gain(U.range(K).map((k) => codes[k] < t)));

      const byMean = U.range(K).sort((a, b) => r[a] - r[b]);
      plot.render([
        { type: 'hline', y: 0, color: 'muted', width: 1 },
        {
          type: 'bars', x: U.range(K), y: byMean.map((k) => r[k]), width: 0.7, maxPx: 40,
          color: (i) => (bestMask[byMean[i]] ? 'class0' : 'class1'),
          tooltip: (i) => {
            const k = byMean[i];
            return [['категория', 'c' + k], ['объектов nₖ', n[k]], ['средний остаток', U.fmt(r[k], 3)], ['группа', bestMask[k] ? 'S' : 'не S']];
          },
        },
      ], { x: [-0.7, K - 0.3] });
      const fmt = (g, cnt) => U.fmt(g, 2) + ' (' + cnt + ' проверок)';
      stats.set('brute', fmt(best, checked));
      stats.set('sorted', fmt(bestSorted, K - 1) + (Math.abs(bestSorted - best) < 1e-9 ? ' ✓' : ''));
      stats.set('onevsrest', fmt(bestOne, K));
      stats.set('ordinal', fmt(bestOrd, K - 1));
    }
    draw();
  });

  GBC.widget('encoding-results', (el) => {
    const B = GBC.encodingBenchmark;
    const w = ui.shell(el, {
      title: 'Семь способов подать категорию',
      sub: 'RMSE на тесте, среднее по трём разбиениям (наведите на столбец — разброс). Серый пунктир — RMSE без категории, чёрный — уровень шума σ = 1, лучше которого не бывает. Зелёный столбец — лучший способ. Данные — скрипт examples/encoding_benchmark.py.',
    });
    if (!B) {
      w.main.textContent = 'Нет данных: запустите python lessons/lesson_10_1/examples/encoding_benchmark.py';
      return;
    }
    const s = { sc: 1 };
    ui.segmented(w.controls, {
      label: 'Сценарий', value: s.sc,
      options: B.scenarios.map((sc, i) => ({ value: i, label: 'K = ' + sc.K + (sc.informative ? '' : ', шум') })),
      onChange: (v) => ((s.sc = v), draw()),
    });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: '', domain: [-0.6, B.methods.length - 0.4], ticks: U.range(B.methods.length), format: (v) => String(Math.round(v) + 1) }, y: { label: 'RMSE на тесте' } });
    const legend = GBC.h('ol', { class: 'ctl-help encoding-legend' }, ...B.methods.map((m) => GBC.h('li', null, m)));
    w.controls.appendChild(legend);
    const stats = ui.stats(w.foot, [{ key: 'best', label: 'лучший способ' }, { key: 'worst', label: 'худший способ' }]);

    function draw() {
      const sc = B.scenarios[s.sc];
      const rows = sc.rows.filter((r) => r.rmse !== null);
      const xs = rows.map((r) => B.methods.indexOf(r.method));
      const vals = rows.map((r) => r.rmse);
      const base = sc.rows.find((r) => r.method === 'без категории').rmse;
      const lo = Math.min(1, ...vals) - 0.02;
      const hi = Math.max(...vals) + 0.03;
      const best = rows.reduce((a, b) => (b.rmse < a.rmse ? b : a));
      const worst = rows.filter((r) => r.method !== 'без категории').reduce((a, b) => (b.rmse > a.rmse ? b : a));
      plot.render([
        {
          type: 'bars', x: xs, y: vals, base: lo, width: 0.7, maxPx: 44,
          color: (i) => (rows[i].method === best.method ? 'good' : rows[i].method === 'без категории' ? 'muted' : 'model'),
          tooltip: (i) => [[rows[i].method, ''], ['RMSE', U.fmt(rows[i].rmse, 4) + ' ± ' + U.fmt(rows[i].std, 2)]],
        },
        { type: 'hline', y: base, color: 'muted', dash: '4 3', width: 1.2 },
        { type: 'hline', y: 1, color: 'ink', dash: '2 3', width: 1 },
      ], { y: [lo, hi] });
      stats.set('best', best.method + ': ' + U.fmt(best.rmse, 4));
      stats.set('worst', worst.method + ': ' + U.fmt(worst.rmse, 4));
    }
    draw();
  });
})();
