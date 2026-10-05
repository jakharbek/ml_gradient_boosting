/* Модуль 2, дополнение: соберите дерево сами и сравните с жадным алгоритмом. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const FLATS = { area: [30, 35, 42, 50, 62, 70, 78, 90], dist: [12, 3, 9, 4, 10, 2, 8, 3], price: [3.0, 5.0, 3.6, 5.8, 7.0, 9.6, 7.8, 10.6] };
  FLATS.X = FLATS.area.map((a, i) => [a, FLATS.dist[i]]);
  const FN = ['площадь', 'до центра'];
  const BOUNDS = { x0: 25, x1: 95, y0: 0, y1: 14 };
  const mean = (a) => (a.length ? U.sum(a) / a.length : NaN);
  const sseRows = (rows) => {
    const ys = rows.map((i) => FLATS.price[i]);
    if (!ys.length) return 0;
    const m = mean(ys);
    return U.sum(ys.map((v) => (v - m) * (v - m)));
  };
  const PMEAN = mean(FLATS.price);
  const priceColor = (v) => GBC.colors.diverging()((v - PMEAN) / 4.2);

  function cands(rows) {
    const out = [];
    for (let f = 0; f < 2; f++) {
      const vals = Array.from(new Set(rows.map((i) => FLATS.X[i][f]))).sort((a, b) => a - b);
      for (let k = 0; k + 1 < vals.length; k++) {
        const t = (vals[k] + vals[k + 1]) / 2;
        const L = rows.filter((i) => FLATS.X[i][f] <= t);
        const R = rows.filter((i) => FLATS.X[i][f] > t);
        out.push({ key: f + ':' + t, f, t, L, R, gain: sseRows(rows) - sseRows(L) - sseRows(R) });
      }
    }
    return out;
  }
  const label = (c) => FN[c.f] + ' ≤ ' + U.fmt(c.t, 1);

  GBC.widget('tree-challenge', (el) => {
    const all = U.range(8);
    const rootC = cands(all);
    // все деревья глубины 2: для каждого корня — лучшие вопросы в детях
    const bestChild = (rows) => cands(rows).reduce((a, c) => (c.gain > a.gain + 1e-12 ? c : a), { gain: 0, key: 'none' });
    const table = rootC.map((c) => ({ c, sse: sseRows(c.L) - bestChild(c.L).gain + sseRows(c.R) - bestChild(c.R).gain }));
    const optimum = Math.min(...table.map((r) => r.sse));
    let count = 0;
    rootC.forEach((c) => (count += (cands(c.L).length + 1) * (cands(c.R).length + 1)));
    const s = { root: '1:11', left: 'none', right: 'none' };
    const w = ui.shell(el, { title: 'Соберите дерево сами — и попробуйте обыграть жадный алгоритм', sub: 'Выберите вопрос в корне и по вопросу в каждой ветке. Цель — наименьшая ошибка SSE. Жадный алгоритм получил 1.32.' });
    const rootBox = H('div');
    const leftBox = H('div');
    const rightBox = H('div');
    w.controls.append(rootBox, leftBox, rightBox);
    ui.button(w.controls, { label: 'Показать жадное дерево', small: true, onClick: () => { const g = rootC.reduce((a, c) => (c.gain > a.gain ? c : a)); s.root = g.key; s.left = bestChild(g.L).key; s.right = bestChild(g.R).key; controls(); draw(); } });
    const plot = new GBC.Plot(w.main, { height: 280, grid: 'none', x: { label: 'площадь, м²', domain: [25, 95] }, y: { label: 'до центра, км', domain: [0, 14] } });
    const tv = new GBC.TreeView(w.main, { featureNames: FN, valueLabel: 'цена, млн', valueFormat: (v) => U.fmt(v, 2), thresholdFormat: (v) => U.fmt(v, 1), leafColor: priceColor });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'sse', label: 'SSE вашего дерева' }, { key: 'greedy', label: 'Жадное дерево' }, { key: 'opt', label: 'Лучшее из всех ' + count + ' деревьев' }, { key: 'rootgain', label: 'Выигрыш вашего корня' }]);
    const rootOf = () => rootC.find((c) => c.key === s.root);
    function controls() {
      const r = rootOf();
      const opts = (rows) => [{ value: 'none', label: 'не делить (лист)' }].concat(cands(rows).map((c) => ({ value: c.key, label: label(c) + '  (Δ ' + c.gain.toFixed(2) + ')' })));
      if (s.left !== 'none' && !cands(r.L).some((c) => c.key === s.left)) s.left = 'none';
      if (s.right !== 'none' && !cands(r.R).some((c) => c.key === s.right)) s.right = 'none';
      rootBox.textContent = '';
      leftBox.textContent = '';
      rightBox.textContent = '';
      ui.select(rootBox, { label: 'Вопрос в корне', options: rootC.map((c) => ({ value: c.key, label: label(c) })), value: s.root, onChange: (v) => ((s.root = v), controls(), draw()) });
      ui.select(leftBox, { label: 'Левая ветка («да»), ' + r.L.length + ' кв.', options: opts(r.L), value: s.left, onChange: (v) => ((s.left = v), draw()) });
      ui.select(rightBox, { label: 'Правая ветка («нет»), ' + r.R.length + ' кв.', options: opts(r.R), value: s.right, onChange: (v) => ((s.right = v), draw()) });
    }
    function draw() {
      const r = rootOf();
      const nodes = [];
      const add = (rows, depth) => {
        const ys = rows.map((i) => FLATS.price[i]);
        nodes.push({ id: nodes.length, depth, n: rows.length, G: -U.sum(ys), H: rows.length, value: mean(ys), sse: sseRows(rows), left: -1, right: -1, feature: -1, threshold: NaN, gain: 0 });
        return nodes.length - 1;
      };
      const split = (id, c) => {
        Object.assign(nodes[id], { feature: c.f, threshold: c.t, gain: c.gain });
        nodes[id].left = add(c.L, nodes[id].depth + 1);
        nodes[id].right = add(c.R, nodes[id].depth + 1);
      };
      add(all, 0);
      split(0, r);
      const lc = cands(r.L).find((c) => c.key === s.left);
      const rc = cands(r.R).find((c) => c.key === s.right);
      const li = nodes[0].left;
      const ri = nodes[0].right;
      if (lc) split(li, lc);
      if (rc) split(ri, rc);
      const tree = new GBC.RegressionTree();
      tree.nodes = nodes;
      tree.nFeatures = 2;
      const leaves = nodes.filter((nd) => nd.left < 0);
      const total = U.sum(leaves.map((nd) => nd.sse));
      const layers = [];
      for (const lf of leaves) {
        const { box } = GBC.nodeBox(tree, lf.id, BOUNDS);
        layers.push({ type: 'rect', ...box, fill: GBC.colors.rgbString(priceColor(lf.value)), opacity: 0.5, stroke: 'surface', width: 1 });
        layers.push({ type: 'text', x: (box.x0 + box.x1) / 2, y: box.y1, dy: 16, anchor: 'middle', text: U.fmt(lf.value, 2) });
      }
      layers.push({ type: 'points', x: FLATS.area, y: FLATS.dist, color: 'data', r: 4.5, label: 'квартиры', tooltip: (i) => [{ label: 'квартира', value: '№' + (i + 1) }, { label: 'цена', value: U.fmt(FLATS.price[i], 1) + ' млн' }, { label: 'прогноз', value: U.fmt(tree.predictOne(FLATS.X[i]), 2) }] });
      plot.render(layers);
      tv.render(tree, {});
      const greedyRoot = rootC.reduce((a, c) => (c.gain > a.gain ? c : a));
      const isOpt = Math.abs(total - optimum) < 1e-9;
      note.innerHTML = isOpt
        ? (r.key === greedyRoot.key
          ? '<b>Это жадное дерево — и оно же лучшее из всех ' + count + ' возможных.</b> Но попробуйте корень «до центра ≤ 6»: у него выигрыш втрое меньше.'
          : '<b>Та же ошибка 1.32 — с другим корнем!</b> Ваш корень «' + label(r) + '» сам по себе слабый (выигрыш ' + r.gain.toFixed(2) + ' против 38.72), но после вторых вопросов получились те же четыре группы квартир. Жадный алгоритм до такого дерева не дошёл бы — и здесь это не страшно.')
        : 'SSE ' + total.toFixed(2) + ' — хуже лучшего дерева (' + optimum.toFixed(2) + ') на ' + (total - optimum).toFixed(2) + '. ' + (lc && rc ? 'Попробуйте другой корень.' : 'Вы ещё не задали вопросы в обеих ветках.');
      stats.set('sse', total.toFixed(2));
      stats.set('greedy', '1.32');
      stats.set('opt', optimum.toFixed(2));
      stats.set('rootgain', r.gain.toFixed(2));
    }
    w.pythonAction(() =>
      'import numpy as np\n\narea = np.array([30, 35, 42, 50, 62, 70, 78, 90])\ndist = np.array([12, 3, 9, 4, 10, 2, 8, 3])\nprice = np.array([3.0, 5.0, 3.6, 5.8, 7.0, 9.6, 7.8, 10.6])\nX, NAMES = np.c_[area, dist], ["area", "dist"]\n' +
      'sse = lambda v: ((v - v.mean()) ** 2).sum() if len(v) else 0.0\n\ndef questions(rows):\n    for j in range(2):\n        vals = np.unique(X[rows, j])\n        for t in (vals[:-1] + vals[1:]) / 2:\n            yield j, t, rows[X[rows, j] <= t], rows[X[rows, j] > t]\n\n' +
      'def best_two_leaves(rows):   # лучшее, что можно сделать с группой одним вопросом (или без него)\n    return min([sse(price[rows])] + [sse(price[L]) + sse(price[R]) for _, _, L, R in questions(rows)])\n\n' +
      '# полный перебор: каждый корень + лучшие вопросы в обеих ветках\nresults = sorted((best_two_leaves(L) + best_two_leaves(R), f"{NAMES[j]} <= {t}") for j, t, L, R in questions(np.arange(8)))\n' +
      'for total, root in results[:5]:\n    print(f"корень {root:14s} → лучшая SSE дерева глубины 2: {total:.2f}")\n'
    );
    controls();
    draw();
  });
})();
