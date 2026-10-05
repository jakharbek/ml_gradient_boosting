/* Урок 2.3, дополнение: рекурсия по вызовам, порядок роста, правила остановки, отсечение. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const FLATS = { area: [30, 35, 42, 50, 62, 70, 78, 90], dist: [12, 3, 9, 4, 10, 2, 8, 3], price: [3.0, 5.0, 3.6, 5.8, 7.0, 9.6, 7.8, 10.6] };
  FLATS.X = FLATS.area.map((a, i) => [a, FLATS.dist[i]]);
  const FNAMES = ['площадь', 'до центра'];
  const mean = (a) => (a.length ? U.sum(a) / a.length : NaN);
  const sse = (a) => {
    if (!a.length) return 0;
    const m = mean(a);
    return U.sum(a.map((v) => (v - m) * (v - m)));
  };

  function bestSplit(X, y, rows, minLeaf = 1) {
    let best = null;
    const before = sse(rows.map((i) => y[i]));
    for (let f = 0; f < X[0].length; f++) {
      const vals = Array.from(new Set(rows.map((i) => X[i][f]))).sort((a, b) => a - b);
      for (let k = 0; k + 1 < vals.length; k++) {
        const t = (vals[k] + vals[k + 1]) / 2;
        const L = rows.filter((i) => X[i][f] <= t);
        const R = rows.filter((i) => X[i][f] > t);
        if (L.length < minLeaf || R.length < minLeaf) continue;
        const gain = before - sse(L.map((i) => y[i])) - sse(R.map((i) => y[i]));
        if (!best || gain > best.gain + 1e-12) best = { f, t, L, R, gain };
      }
    }
    return best && best.gain > 1e-12 ? best : null;
  }

  /**
   * Жадное дерево с правилами остановки. Узлы нумеруются в порядке обхода в глубину (как идут вызовы).
   * У листа stop — причина остановки: 'depth' | 'size' | 'gain' | 'pure'.
   */
  function build(X, y, o = {}) {
    const maxDepth = o.maxDepth ?? 99;
    const minLeaf = o.minLeaf ?? 1;
    const minGain = o.minGain ?? 0;
    const nodes = [];
    const rec = (rows, depth, parent) => {
      const ys = rows.map((i) => y[i]);
      const nd = { id: nodes.length, depth, parent, rows, n: rows.length, G: -U.sum(ys), H: rows.length, value: mean(ys), sse: sse(ys), left: -1, right: -1, feature: -1, threshold: NaN, gain: 0, stop: null };
      nodes.push(nd);
      if (nd.sse < 1e-12 || rows.length < 2) nd.stop = 'pure';
      else if (depth >= maxDepth) nd.stop = 'depth';
      else {
        const b = bestSplit(X, y, rows, minLeaf);
        nd.cand = b;
        if (!b) nd.stop = rows.length < 2 * minLeaf ? 'size' : 'pure';
        else if (b.gain < minGain) nd.stop = 'gain';
        else {
          nd.feature = b.f;
          nd.threshold = b.t;
          nd.gain = b.gain;
          nd.left = rec(b.L, depth + 1, nd.id);
          nd.right = rec(b.R, depth + 1, nd.id);
        }
      }
      return nd.id;
    };
    rec(U.range(y.length), 0, -1);
    return nodes;
  }

  /** Дерево, в котором разбиты только узлы из множества split; остальные показаны листьями. */
  function partial(nodes, split, nF) {
    const keep = [];
    const walk = (id) => {
      keep.push(id);
      const nd = nodes[id];
      if (nd.left >= 0 && split.has(id)) {
        walk(nd.left);
        walk(nd.right);
      }
    };
    walk(0);
    const map = new Map(keep.map((id, i) => [id, i]));
    const t = new GBC.RegressionTree();
    t.nodes = keep.map((id) => {
      const nd = nodes[id];
      const on = nd.left >= 0 && split.has(id);
      return Object.assign({}, nd, { id: map.get(id), src: id, left: on ? map.get(nd.left) : -1, right: on ? map.get(nd.right) : -1 });
    });
    t.nFeatures = nF;
    return { tree: t, map };
  }
  const treeSSE = (t) => U.sum(t.nodes.filter((nd) => nd.left < 0).map((nd) => nd.sse));
  const mseOn = (t, d) => U.mean(d.y.map((v, i) => (v - t.predictOne(d.X[i])) ** 2));

  /* --------------------------------------------------------------- recursion-trace */
  GBC.widget('recursion-trace', (el) => {
    const s = { depth: 2, k: 0 };
    const w = ui.shell(el, { title: 'Рекурсия по вызовам: кто кого вызывает', sub: 'Восемь квартир. Каждый шаг — один вызов функции build. Слева — цепочка незавершённых вызовов (стек), справа — дерево, построенное к этому моменту.' });
    ui.slider(w.controls, { label: 'max_depth', min: 1, max: 3, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), (s.k = 0), fit()) });
    const player = ui.player(w.main, { label: 'Вызов', min: 0, max: 6, value: 0, fps: 1.2, format: (v, m) => 'вызов ' + (v + 1) + ' из ' + (m + 1), onChange: (v) => ((s.k = v), draw()) });
    const grid = H('div', { class: 'grid-2' });
    w.main.appendChild(grid);
    const stackBox = H('div', { class: 'trace-stack' });
    const tvBox = H('div');
    grid.append(stackBox, tvBox);
    const tv = new GBC.TreeView(tvBox, { featureNames: FNAMES, valueLabel: 'цена, млн', valueFormat: (v) => U.fmt(v, 2), thresholdFormat: (v) => U.fmt(v, 1) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'calls', label: 'Вызовов сделано' }, { key: 'stack', label: 'Глубина стека' }, { key: 'leaves', label: 'Готовых листьев' }, { key: 'sse', label: 'SSE дерева' }]);
    let nodes;
    const flatsOf = (rows) => '№' + rows.map((i) => i + 1).join(', ');
    function fit() {
      nodes = build(FLATS.X, FLATS.price, { maxDepth: s.depth });
      player.setMax(nodes.length - 1);
      player.set(0);
      s.k = 0;
      draw();
    }
    function draw() {
      const cur = nodes[s.k];
      const done = new Set(nodes.filter((nd) => nd.id <= s.k && nd.left >= 0).map((nd) => nd.id));
      const { tree, map } = partial(nodes, done, 2);
      const path = [];
      for (let id = cur.id; id >= 0; id = nodes[id].parent) path.unshift(id);
      tv.render(tree, { highlight: path.map((id) => map.get(id)) });
      stackBox.textContent = '';
      stackBox.appendChild(H('div', { class: 'trace-title' }, 'Стек вызовов'));
      path.forEach((id, d) => {
        const nd = nodes[id];
        stackBox.appendChild(H('div', { class: 'trace-call' + (id === cur.id ? ' cur' : ''), style: { marginLeft: d * 14 + 'px' } }, H('code', null, 'build(кв. ' + nd.rows.map((i) => i + 1).join(', ') + '; глубина ' + nd.depth + ')'), H('span', null, id === cur.id ? ' ← выполняется' : ' ждёт ' + (cur.id >= nodes[id].right && nodes[id].right > 0 ? 'правую' : 'левую') + ' ветку')));
      });
      const why = { depth: 'достигнута max_depth = ' + s.depth, pure: cur.n < 2 ? 'в узле одна квартира' : 'все ответы одинаковы', size: 'слишком мало объектов', gain: 'выигрыш меньше порога' }[cur.stop];
      note.innerHTML = '<b>Вызов ' + (s.k + 1) + ':</b> в узел пришли квартиры ' + flatsOf(cur.rows) + ', их среднее ' + U.fmt(cur.value, 2) + ', SSE ' + cur.sse.toFixed(2) + '. ' +
        (cur.left >= 0
          ? 'Лучший вопрос — «' + FNAMES[cur.feature] + ' ≤ ' + U.fmt(cur.threshold, 1) + '» (выигрыш ' + cur.gain.toFixed(2) + '). Узел делится, и функция вызывает саму себя: сначала для левой части (' + flatsOf(nodes[cur.left].rows) + '), потом для правой.'
          : '<b>Остановка</b> — ' + why + '. Возвращается лист со значением ' + U.fmt(cur.value, 2) + '; управление уходит назад, к вызову уровнем выше.');
      const leavesDone = nodes.filter((nd) => nd.id <= s.k && nd.left < 0).length;
      stats.set('calls', s.k + 1 + ' из ' + nodes.length);
      stats.set('stack', String(path.length));
      stats.set('leaves', String(leavesDone));
      stats.set('sse', treeSSE(tree).toFixed(2));
    }
    w.pythonAction(() =>
      'import numpy as np\n\narea = np.array([30, 35, 42, 50, 62, 70, 78, 90])\ndist = np.array([12, 3, 9, 4, 10, 2, 8, 3])\nprice = np.array([3.0, 5.0, 3.6, 5.8, 7.0, 9.6, 7.8, 10.6])\nX, NAMES = np.c_[area, dist], ["площадь", "до центра"]\n' +
      'sse = lambda v: ((v - v.mean()) ** 2).sum() if len(v) else 0.0\ncalls = 0\n\ndef best_split(rows):\n    best = (0.0, None, None)\n    for j in range(X.shape[1]):\n        vals = np.unique(X[rows, j])\n' +
      '        for t in (vals[:-1] + vals[1:]) / 2:\n            m = X[rows, j] <= t\n            gain = sse(price[rows]) - sse(price[rows[m]]) - sse(price[rows[~m]])\n            if gain > best[0] + 1e-12:\n                best = (gain, j, t)\n    return best\n\n' +
      'def build(rows, depth, max_depth=' + s.depth + '):\n    global calls\n    calls += 1\n    pad = "    " * depth\n    print(f"{pad}вызов {calls}: build(№{list(rows + 1)}, глубина {depth})")\n    gain, j, t = best_split(rows)\n' +
      '    if depth == max_depth or j is None:\n        print(f"{pad}  → лист {price[rows].mean():.2f}")\n        return\n    print(f"{pad}  → {NAMES[j]} <= {t} (выигрыш {gain:.2f})")\n    m = X[rows, j] <= t\n' +
      '    build(rows[m], depth + 1, max_depth)\n    build(rows[~m], depth + 1, max_depth)\n\nbuild(np.arange(8), 0)\n'
    );
    fit();
  });

  /* --------------------------------------------------------------- growth-order */
  GBC.widget('growth-order', (el) => {
    const ORD = { depth: 'В глубину (как рекурсия)', level: 'По уровням', best: 'Лучший лист первым' };
    const s = { order: 'best', leaves: 4 };
    const w = ui.shell(el, { title: 'Три порядка роста при одном бюджете листьев', sub: 'Полное жадное дерево одно и то же. Но если листьев разрешено мало, важно, какие узлы разбить первыми.' });
    ui.select(w.controls, { label: 'Порядок разбиений', options: Object.entries(ORD).map(([value, label]) => ({ value, label })), value: s.order, onChange: (v) => ((s.order = v), draw()) });
    ui.slider(w.controls, { label: 'Бюджет: листьев', min: 1, max: 16, step: 1, value: s.leaves, format: String, onInput: (v) => ((s.leaves = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const tv = new GBC.TreeView(w.main, { featureNames: ['x'], valueFormat: (v) => U.fmt(v, 2), thresholdFormat: (v) => U.fmt(v, 2) });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    const data = GBC.datasets.regression1d({ kind: 'wave', n: 80, noise: 0.3, seed: 6 });
    const nodes = build(data.X, data.y, { maxDepth: 6, minLeaf: 3 });
    const internal = nodes.filter((nd) => nd.left >= 0);
    function orderOf(kind) {
      if (kind === 'depth') return internal.map((nd) => nd.id);
      if (kind === 'level') return internal.slice().sort((a, b) => a.depth - b.depth || a.id - b.id).map((nd) => nd.id);
      const out = [];
      const frontier = [0];
      while (frontier.length) {
        frontier.sort((a, b) => nodes[b].gain - nodes[a].gain);
        const id = frontier.shift();
        if (nodes[id].left < 0) continue;
        out.push(id);
        frontier.push(nodes[id].left, nodes[id].right);
      }
      return out;
    }
    const treeFor = (kind, leaves) => partial(nodes, new Set(orderOf(kind).slice(0, leaves - 1)), 1).tree;
    function draw() {
      const t = treeFor(s.order, s.leaves);
      plot.render([
        { type: 'line', x: U.linspace(0, 10, 300), y: U.linspace(0, 10, 300).map((v) => GBC.datasets.trueFunction('wave', v)), color: 'truth', dash: '5 4', width: 1.5, label: 'истинная f(x)', hover: false },
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3.4, label: 'данные' },
        { type: 'steps', segments: t.segments1d(0, 10), color: 'model', width: 2.4, label: 'дерево: ' + s.leaves + ' листьев' },
      ]);
      tv.render(t, {});
      const res = Object.keys(ORD).map((k) => ({ k, sse: treeSSE(treeFor(k, s.leaves)), depth: Math.max(...treeFor(k, s.leaves).nodes.map((nd) => nd.depth)) }));
      const bestK = res.reduce((a, b) => (b.sse < a.sse - 1e-9 ? b : a)).k;
      tableBox.textContent = '';
      ui.table(tableBox, { columns: ['порядок', 'SSE на обучении', 'глубина'], rows: res.map((r) => [(r.k === s.order ? '▸ ' : '') + ORD[r.k], r.sse.toFixed(2), String(r.depth)]), highlight: (i) => res[i].k === bestK });
      const cur = res.find((r) => r.k === s.order);
      const top = res.find((r) => r.k === 'best');
      note.innerHTML = s.leaves === 1
        ? 'Один лист — разбиений нет, порядок не важен.'
        : Math.abs(cur.sse - top.sse) < 1e-9
          ? 'При этом бюджете порядок «' + ORD[s.order].toLowerCase() + '» дал ту же ошибку, что и «лучший лист первым».'
          : 'При ' + s.leaves + ' листьях «лучший лист первым» даёт SSE ' + top.sse.toFixed(2) + ', а «' + ORD[s.order].toLowerCase() + '» — ' + cur.sse.toFixed(2) + ': листья потрачены на менее выгодные разбиения. Когда бюджет вырастет до полного дерева, разница исчезнет.';
    }
    w.pythonAction(() =>
      'from sklearn.tree import DecisionTreeRegressor\nfrom gbcourse import datasets\n\nX, y = datasets.regression_1d(kind="wave", n=80, noise=0.3, seed=6)\n' +
      '# max_leaf_nodes включает в scikit-learn рост «лучший лист первым»; max_depth — обычный рост по глубине\nbest_first = DecisionTreeRegressor(max_leaf_nodes=' + Math.max(2, s.leaves) + ', min_samples_leaf=3).fit(X, y)\n' +
      'print("лучший лист первым:", best_first.get_n_leaves(), "листьев, глубина", best_first.get_depth(), ", SSE", round(((y - best_first.predict(X)) ** 2).sum(), 2))\n' +
      'for depth in (1, 2, 3, 4):\n    t = DecisionTreeRegressor(max_depth=depth, min_samples_leaf=3).fit(X, y)\n    print(f"по уровням, глубина {depth}: {t.get_n_leaves()} листьев, SSE {((y - t.predict(X)) ** 2).sum():.2f}")\n'
    );
    draw();
  });

  /* --------------------------------------------------------------- stop-rules */
  GBC.widget('stop-rules', (el) => {
    const WHY = { depth: 'глубина', size: 'размер листа', gain: 'малый выигрыш', pure: 'делить нечего' };
    const s = { depth: 10, minLeaf: 1, gain: 0, noise: 0.35 };
    const w = ui.shell(el, { title: 'Правила остановки в действии', sub: 'Три «тормоза» роста. Внизу — по какой причине остановился каждый лист и что получилось на новых данных.' });
    ui.slider(w.controls, { label: 'max_depth', min: 1, max: 10, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), refit()) });
    ui.slider(w.controls, { label: 'min_samples_leaf', min: 1, max: 20, step: 1, value: s.minLeaf, format: String, onInput: (v) => ((s.minLeaf = v), refit()) });
    ui.slider(w.controls, { label: 'Мин. выигрыш, % от SSE корня', min: 0, max: 5, step: 0.1, value: s.gain, format: (v) => U.fmt(v, 1) + '%', onInput: (v) => ((s.gain = v), refit()) });
    ui.slider(w.controls, { label: 'Шум σ', min: 0, max: 1, step: 0.05, value: s.noise, onInput: (v) => ((s.noise = v), refit()) });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const pB = new GBC.Plot(w.main, { height: 170, x: { label: 'почему лист перестал делиться', domain: [-0.6, 3.6], ticks: [0, 1, 2, 3], format: (v) => Object.values(WHY)[v] || '' }, y: { label: 'листьев' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'leaves', label: 'Листьев' }, { key: 'depth', label: 'Глубина' }, { key: 'tr', label: 'MSE на обучении' }, { key: 'te', label: 'MSE на новых данных' }, { key: 'free', label: 'Без ограничений: новые данные' }]);
    const refit = U.rafThrottle(() => draw());
    function draw() {
      const ds = { kind: 'sine', n: 80, noise: s.noise, seed: 5 };
      const data = GBC.datasets.regression1d(ds);
      const test = GBC.datasets.regression1d(Object.assign({}, ds, { seed: 1005, n: 400 }));
      const sse0 = sse(data.y);
      const nodes = build(data.X, data.y, { maxDepth: s.depth, minLeaf: s.minLeaf, minGain: (s.gain / 100) * sse0 });
      const t = partial(nodes, new Set(nodes.filter((nd) => nd.left >= 0).map((nd) => nd.id)), 1).tree;
      const free = partial(build(data.X, data.y, {}), new Set(U.range(1000)), 1).tree;
      plot.render([
        { type: 'line', x: U.linspace(0, 10, 300), y: U.linspace(0, 10, 300).map((v) => Math.sin(v)), color: 'truth', dash: '5 4', width: 1.5, label: 'истинная f(x)', hover: false },
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3.4, label: 'обучающие точки' },
        { type: 'steps', segments: t.segments1d(0, 10), color: 'model', width: 2.4, label: 'дерево' },
      ]);
      const keys = Object.keys(WHY);
      const cnt = keys.map((k) => nodes.filter((nd) => nd.left < 0 && nd.stop === k).length);
      pB.render([{ type: 'bars', x: [0, 1, 2, 3], y: cnt, width: 0.6, maxPx: 70, color: 'model', label: 'число листьев', tooltip: (i) => [{ label: WHY[keys[i]], value: cnt[i] + ' листьев' }] }], { y: [0, Math.max(4, ...cnt) * 1.1] });
      const te = mseOn(t, test);
      const teFree = mseOn(free, test);
      const main = keys[cnt.indexOf(Math.max(...cnt))];
      note.innerHTML = 'Чаще всего рост остановило правило «<b>' + WHY[main] + '</b>». ' +
        (te < teFree * 0.97 ? 'На новых данных ограниченное дерево лучше свободного: ' + U.fmt(te, 3) + ' против ' + U.fmt(teFree, 3) + '.' : te > teFree * 1.03 ? 'Ограничения слишком жёсткие: на новых данных ' + U.fmt(te, 3) + ' против ' + U.fmt(teFree, 3) + ' у свободного дерева.' : 'На новых данных оно почти не отличается от дерева без ограничений (' + U.fmt(teFree, 3) + ').');
      stats.set('leaves', String(t.nLeaves));
      stats.set('depth', String(Math.max(...nodes.map((nd) => nd.depth))));
      stats.set('tr', U.fmt(mseOn(t, data), 4));
      stats.set('te', U.fmt(te, 4));
      stats.set('free', U.fmt(teFree, 4));
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom sklearn.tree import DecisionTreeRegressor\nfrom gbcourse import datasets\n\nX, y = datasets.regression_1d(kind="sine", n=80, noise=' + U.pyNum(s.noise) + ', seed=5)\nX_new, y_new = datasets.regression_1d(kind="sine", n=400, noise=' + U.pyNum(s.noise) + ', seed=1005)\n' +
      '# min_impurity_decrease в scikit-learn — уменьшение MSE узла, взвешенное долей объектов: наш порог SSE делим на n\nmin_gain = ' + U.pyNum(s.gain / 100) + ' * ((y - y.mean()) ** 2).sum() / len(y)\n' +
      'limited = DecisionTreeRegressor(max_depth=' + s.depth + ', min_samples_leaf=' + s.minLeaf + ', min_impurity_decrease=min_gain).fit(X, y)\nfree = DecisionTreeRegressor().fit(X, y)\n' +
      'for name, t in (("с ограничениями", limited), ("без ограничений", free)):\n    print(f"{name}: листьев {t.get_n_leaves()}, MSE обучение {np.mean((y - t.predict(X)) ** 2):.4f}, новые данные {np.mean((y_new - t.predict(X_new)) ** 2):.4f}")\n'
    );
    draw();
  });

  /* --------------------------------------------------------------- prune-path */
  GBC.widget('prune-path', (el) => {
    const s = { step: 0 };
    const w = ui.shell(el, { title: 'Отсечение: вырастить большое дерево и срезать лишнее', sub: 'Дерево выращено до конца. Каждый шаг срезает «самое слабое звено» — ветку, которая меньше всего окупает свои листья. Найдите число листьев с наименьшей ошибкой на новых данных.' });
    const data = GBC.datasets.regression1d({ kind: 'sine', n: 60, noise: 0.35, seed: 3 });
    const test = GBC.datasets.regression1d({ kind: 'sine', n: 400, noise: 0.35, seed: 1003 });
    const nodes = build(data.X, data.y, {});
    // последовательность отсечений по «слабому звену»: α = (SSE узла − SSE его поддерева) / (листьев в поддереве − 1)
    const alive = new Set(nodes.filter((nd) => nd.left >= 0).map((nd) => nd.id));
    const seq = [{ split: new Set(alive), alpha: 0 }];
    const sub = (id, set) => {
      const nd = nodes[id];
      if (nd.left < 0 || !set.has(id)) return { sse: nd.sse, leaves: 1 };
      const a = sub(nd.left, set);
      const b = sub(nd.right, set);
      return { sse: a.sse + b.sse, leaves: a.leaves + b.leaves };
    };
    const reachable = (set) => {
      const out = [];
      const walk = (id) => {
        if (nodes[id].left >= 0 && set.has(id)) {
          out.push(id);
          walk(nodes[id].left);
          walk(nodes[id].right);
        }
      };
      walk(0);
      return out;
    };
    while (alive.size) {
      let weak = null;
      for (const id of reachable(alive)) {
        const q = sub(id, alive);
        const alpha = (nodes[id].sse - q.sse) / (q.leaves - 1);
        if (!weak || alpha < weak.alpha - 1e-12) weak = { id, alpha };
      }
      const drop = (id) => {
        if (nodes[id].left >= 0 && alive.has(id)) {
          alive.delete(id);
          drop(nodes[id].left);
          drop(nodes[id].right);
        }
      };
      drop(weak.id);
      seq.push({ split: new Set(alive), alpha: weak.alpha });
    }
    const trees = seq.map((q) => partial(nodes, q.split, 1).tree);
    const leaves = trees.map((t) => t.nLeaves);
    const tr = trees.map((t) => mseOn(t, data));
    const te = trees.map((t) => mseOn(t, test));
    let best = 0;
    te.forEach((v, i) => (v < te[best] ? (best = i) : 0));
    const player = ui.player(w.main, { label: 'Отсечений', min: 0, max: seq.length - 1, value: 0, fps: 4, format: (v) => 'срезано веток: ' + v, onChange: (v) => ((s.step = v), draw()) });
    ui.button(w.controls, { label: 'К лучшему дереву', kind: 'primary', small: true, onClick: () => ((s.step = best), player.set(best), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'листьев в дереве' }, y: { label: 'MSE' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'leaves', label: 'Листьев' }, { key: 'alpha', label: 'Цена листа α на этом шаге' }, { key: 'tr', label: 'MSE на обучении' }, { key: 'te', label: 'MSE на новых данных' }, { key: 'best', label: 'Лучшее число листьев' }]);
    function draw() {
      const t = trees[s.step];
      p1.render([
        { type: 'line', x: U.linspace(0, 10, 300), y: U.linspace(0, 10, 300).map((v) => Math.sin(v)), color: 'truth', dash: '5 4', width: 1.5, label: 'истинная f(x)', hover: false },
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3.4, label: 'обучающие точки' },
        { type: 'steps', segments: t.segments1d(0, 10), color: 'model', width: 2.4, label: 'дерево: ' + leaves[s.step] + ' листьев' },
      ]);
      p2.render([
        { type: 'line', x: leaves, y: tr, color: 'train', width: 2, label: 'обучение' },
        { type: 'line', x: leaves, y: te, color: 'valid', width: 2, label: 'новые данные' },
        { type: 'points', x: [leaves[best]], y: [te[best]], color: 'good', r: 6, label: 'минимум на новых данных' },
        { type: 'vline', x: leaves[s.step], color: 'ink', width: 2, text: leaves[s.step] + ' листьев' },
      ]);
      note.innerHTML = s.step === 0
        ? 'Полное дерево: ' + leaves[0] + ' листьев, ошибка на обучении почти нулевая, на новых данных ' + U.fmt(te[0], 3) + '. Нажмите ▶ и смотрите, как срезаются ветки.'
        : leaves[s.step] > leaves[best]
          ? 'Срезаны ветки, которые почти ничего не давали на обучении. Ошибка на новых данных ' + (te[s.step] < te[0] ? 'уже ниже, чем у полного дерева: ' : 'пока ') + U.fmt(te[s.step], 3) + '.'
          : leaves[s.step] === leaves[best]
            ? '<b>Лучшее дерево:</b> ' + leaves[best] + ' листьев, ошибка на новых данных ' + U.fmt(te[best], 3) + ' против ' + U.fmt(te[0], 3) + ' у полного.'
            : 'Срезано слишком много: дерево стало грубым, ошибка на новых данных выросла до ' + U.fmt(te[s.step], 3) + '.';
      stats.set('leaves', String(leaves[s.step]));
      stats.set('alpha', s.step ? U.fmt(seq[s.step].alpha, 4) : '—');
      stats.set('tr', U.fmt(tr[s.step], 4));
      stats.set('te', U.fmt(te[s.step], 4));
      stats.set('best', leaves[best] + ' (MSE ' + U.fmt(te[best], 3) + ')');
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom sklearn.tree import DecisionTreeRegressor\nfrom gbcourse import datasets\n\nX, y = datasets.regression_1d(kind="sine", n=60, noise=0.35, seed=3)\nX_new, y_new = datasets.regression_1d(kind="sine", n=400, noise=0.35, seed=1003)\n\n' +
      '# scikit-learn сам строит последовательность отсечений; ccp_alpha — «цена листа» (в единицах MSE)\npath = DecisionTreeRegressor().cost_complexity_pruning_path(X, y)\nfor alpha in path.ccp_alphas[::6]:\n' +
      '    t = DecisionTreeRegressor(ccp_alpha=alpha).fit(X, y)\n    print(f"alpha {alpha:.4f}: листьев {t.get_n_leaves():2d}, MSE обучение {np.mean((y - t.predict(X)) ** 2):.4f}, новые данные {np.mean((y_new - t.predict(X_new)) ** 2):.4f}")\n'
    );
    draw();
  });
})();
