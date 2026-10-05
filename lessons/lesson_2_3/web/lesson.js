/* Урок 2.3: рост дерева шаг за шагом. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  /** Частичное дерево: только первые k разбиений (в порядке создания узлов). */
  /** Порядок разбиений при росте в глубину — прямой обход внутренних узлов. */
  function splitOrderOf(tree) {
    const order = [];
    const pre = (id) => {
      const nd = tree.nodes[id];
      if (nd.left < 0) return;
      order.push(id);
      pre(nd.left);
      pre(nd.right);
    };
    pre(0);
    return order;
  }

  function partialTree(tree, k) {
    const splitOrder = splitOrderOf(tree);
    const allowed = new Set(splitOrder.slice(0, k));
    const keep = [];
    const walk = (id) => {
      keep.push(id);
      const nd = tree.nodes[id];
      if (nd.left >= 0 && allowed.has(id)) {
        walk(nd.left);
        walk(nd.right);
      }
    };
    walk(0);
    keep.sort((a, b) => a - b);
    const map = new Map(keep.map((id, i) => [id, i]));
    const nodes = keep.map((id) => {
      const nd = tree.nodes[id];
      const split = nd.left >= 0 && allowed.has(id);
      return Object.assign({}, nd, { id: map.get(id), left: split ? map.get(nd.left) : -1, right: split ? map.get(nd.right) : -1 });
    });
    const t = new GBC.RegressionTree();
    t.nodes = nodes;
    t.nFeatures = tree.nFeatures;
    return { tree: t, total: splitOrder.length, current: k < splitOrder.length ? map.get(splitOrder[k]) : null };
  }

  GBC.widget('tree-growth', (el) => {
    const s = { kind: 'moons', depth: 4, minLeaf: 1, gamma: 0, k: 0 };
    const w = ui.shell(el, { title: 'Дерево растёт шаг за шагом', sub: 'Каждый шаг — одно разбиение в порядке обхода в глубину: сначала левая ветка до конца, потом правая. Пунктиром — узел, который будет разбит следующим.' });
    ui.select(w.controls, { label: 'Данные', options: [{ value: 'moons', label: 'Луны' }, { value: 'xor', label: 'XOR' }, { value: 'circles', label: 'Круги' }, { value: 'blobs', label: 'Два облака' }], value: s.kind, onChange: (v) => ((s.kind = v), fit()) });
    ui.slider(w.controls, { label: 'max_depth', min: 1, max: 8, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), fit()) });
    ui.slider(w.controls, { label: 'min_samples_leaf', min: 1, max: 40, step: 1, value: s.minLeaf, format: String, onInput: (v) => ((s.minLeaf = v), fit()) });
    ui.slider(w.controls, { label: 'Минимальный выигрыш (γ)', min: 0, max: 0.05, step: 0.001, value: s.gamma, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.gamma = v), fit()) });
    const player = ui.player(w.main, { label: 'Разбиений сделано', min: 0, max: 1, value: 0, fps: 2, format: (v, m) => v + ' / ' + m, onChange: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, equal: true, x: { label: 'x_0' }, y: { label: 'x_1' }, grid: 'none' });
    const tv = new GBC.TreeView(w.main, { featureNames: ['x₀', 'x₁'], valueFormat: (v) => U.fmt(v, 2), leafColor: (v) => GBC.colors.proba()(v) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'leaves', label: 'Листьев' }, { key: 'acc', label: 'Точность' }, { key: 'gain', label: 'Выигрыш текущего разбиения' }]);
    let data;
    let tree;
    let bounds;
    function fit() {
      data = GBC.datasets.classification2d({ kind: s.kind, n: 200, noise: s.kind === 'xor' ? 0.12 : 0.25, seed: 9 });
      // γ задаётся на долю: выигрыш в gbcourse = ½·SSE-уменьшение → переводим в абсолютные единицы
      tree = new GBC.RegressionTree({ maxDepth: s.depth, minSamplesLeaf: s.minLeaf, gamma: s.gamma * data.y.length }).fit(data.X, data.y.map((v) => -v));
      const [x0, x1] = U.extent(data.X.map((r) => r[0]));
      const [y0, y1] = U.extent(data.X.map((r) => r[1]));
      bounds = { x0: x0 - 0.3, x1: x1 + 0.3, y0: y0 - 0.3, y1: y1 + 0.3 };
      const total = tree.nodes.filter((nd) => nd.left >= 0).length;
      player.setMax(total);
      s.k = Math.min(s.k, total);
      player.set(s.k);
      draw();
    }
    function draw() {
      const part = partialTree(tree, s.k);
      const pt = part.tree;
      const pf = GBC.colors.proba();
      const layers = [];
      for (const lf of pt.leaves) {
        const { box } = GBC.nodeBox(pt, lf.id, bounds);
        layers.push({ type: 'rect', ...box, fill: GBC.colors.rgbString(pf(lf.value)), opacity: 0.5, stroke: lf.id === part.current ? 'ink' : 'surface', width: lf.id === part.current ? 2.2 : 1, dash: lf.id === part.current ? '5 4' : null });
      }
      for (const c of [0, 1]) {
        const idx = data.y.map((v, i) => (v === c ? i : -1)).filter((i) => i >= 0);
        layers.push({ type: 'points', x: idx.map((i) => data.X[i][0]), y: idx.map((i) => data.X[i][1]), color: 'class' + c, r: 3.6, shape: c ? 'square' : 'circle', label: 'класс ' + c });
      }
      plot.render(layers, { x: [bounds.x0, bounds.x1], y: [bounds.y0, bounds.y1] });
      tv.render(pt, { highlight: part.current !== null ? [part.current] : [] });
      const acc = GBC.metrics.accuracy(data.y, data.X.map((x) => (pt.predictOne(x) > 0.5 ? 1 : 0)));
      stats.set('leaves', String(pt.nLeaves));
      stats.set('acc', U.fmt(acc * 100, 1) + '%');
      const cur = s.k > 0 ? tree.nodes[splitOrderOf(tree)[s.k - 1]] : null;
      stats.set('gain', cur ? U.fmt(cur.gain, 3) : '—');
      note.innerHTML = part.total === 0
        ? '<b>Ни одного разбиения:</b> выигрыш лучшего кандидата меньше порога γ. ' + (s.kind === 'xor' ? 'На XOR любое одиночное разбиение почти бесполезно — жадность останавливается на корне.' : '')
        : s.k >= part.total
          ? 'Дерево достроено: дальше делить запрещают правила остановки (глубина, размер листа или минимальный выигрыш).'
          : 'Следующим будет разбит выделенный узел (обход в глубину: сначала левые ветки).';
    }
    w.pythonAction(() =>
      'from gbcourse import datasets, RegressionTree\n\nX, y = datasets.classification_2d(kind="' + s.kind + '", n=200, noise=' + (s.kind === 'xor' ? 0.12 : 0.25) + ', seed=9)\n' +
      'tree = RegressionTree(max_depth=' + s.depth + ', min_samples_leaf=' + s.minLeaf + ', gamma=' + U.pyNum(s.gamma * 200) + ').fit(X, -y)\n' +
      'for nd in tree.nodes:\n    if not nd.is_leaf:\n        print(f"разбиение #{nd.id}: x{nd.feature} ≤ {nd.threshold:.3f}, выигрыш {nd.gain:.3f}, глубина {nd.depth}")\nprint("листьев:", tree.n_leaves)\n'
    );
    fit();
  });
})();
