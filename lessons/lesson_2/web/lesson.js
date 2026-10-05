/* Модуль 2: дерево решений от А до Я на одном сквозном примере (8 квартир) и на «живых» данных. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  /* ------------------------------------------------------------------ сквозной пример */
  const FLATS = {
    area: [30, 35, 42, 50, 62, 70, 78, 90], // площадь, м²
    dist: [12, 3, 9, 4, 10, 2, 8, 3], // до центра, км
    price: [3.0, 5.0, 3.6, 5.8, 7.0, 9.6, 7.8, 10.6], // цена, млн
  };
  FLATS.X = FLATS.area.map((a, i) => [a, FLATS.dist[i]]);
  const FEATS = [
    { name: 'площадь', unit: 'м²', label: 'площадь, м²', domain: [25, 95], py: 'area' },
    { name: 'до центра', unit: 'км', label: 'до центра, км', domain: [0, 14], py: 'dist' },
  ];
  const BOUNDS = { x0: 25, x1: 95, y0: 0, y1: 14 };
  const PY_FLATS =
    'import numpy as np\n\narea = np.array([30, 35, 42, 50, 62, 70, 78, 90])        # площадь, м²\n' +
    'dist = np.array([12, 3, 9, 4, 10, 2, 8, 3])               # до центра, км\n' +
    'price = np.array([3.0, 5.0, 3.6, 5.8, 7.0, 9.6, 7.8, 10.6])  # цена, млн\nX = np.c_[area, dist]\n';

  const mean = (a) => (a.length ? U.sum(a) / a.length : NaN);
  const sse = (a) => {
    if (!a.length) return 0;
    const m = mean(a);
    return U.sum(a.map((v) => (v - m) * (v - m)));
  };
  const flatTree = (depth) => new GBC.RegressionTree({ maxDepth: depth }).fit(FLATS.X, FLATS.price.map((v) => -v));
  const PRICE_MEAN = mean(FLATS.price);
  /** Цвет листа по цене: дешевле среднего — синий, дороже — красный. */
  const priceColor = (v) => GBC.colors.diverging()((v - PRICE_MEAN) / 4.2);

  /** Все пороги-кандидаты одного признака для объектов rows: середины между соседними значениями. */
  function candidates(X, y, rows, f) {
    const vals = Array.from(new Set(rows.map((i) => X[i][f]))).sort((a, b) => a - b);
    const all = rows.map((i) => y[i]);
    const before = sse(all);
    const out = [];
    for (let k = 0; k + 1 < vals.length; k++) {
      const t = (vals[k] + vals[k + 1]) / 2;
      const L = rows.filter((i) => X[i][f] <= t);
      const R = rows.filter((i) => X[i][f] > t);
      const yL = L.map((i) => y[i]);
      const yR = R.map((i) => y[i]);
      out.push({ f, t, L, R, nL: L.length, nR: R.length, mL: mean(yL), mR: mean(yR), sL: sse(yL), sR: sse(yR), after: sse(yL) + sse(yR), gain: before - sse(yL) - sse(yR) });
    }
    return out;
  }
  /** Лучшее разбиение группы rows по всем признакам (или null, если делить нечего). */
  function bestSplit(X, y, rows, minLeaf = 1) {
    let best = null;
    for (let f = 0; f < X[0].length; f++) {
      for (const c of candidates(X, y, rows, f)) {
        if (c.nL < minLeaf || c.nR < minLeaf) continue;
        if (!best || c.gain > best.gain + 1e-12) best = c;
      }
    }
    return best && best.gain > 1e-12 ? best : null;
  }
  /** Обернуть свой список узлов в RegressionTree — чтобы работали TreeView, nodeBox, segments1d. */
  function asTree(nodes, nFeatures) {
    const t = new GBC.RegressionTree();
    t.nodes = nodes;
    t.nFeatures = nFeatures;
    return t;
  }

  /* =================================================================================
   * flat-walk — прогноз как путь по дереву
   * ================================================================================= */
  GBC.widget('flat-walk', (el) => {
    const tree = flatTree(2);
    const s = { a: 60, d: 4 };
    const w = ui.shell(el, { title: 'Пройдите путь от корня до листа', sub: 'Двигайте ползунки или перетащите чёрную точку. Дерево задаёт вопросы по очереди; ответы ведут в один лист — его число и есть прогноз.' });
    const aCtl = ui.slider(w.controls, { label: 'Площадь, м²', min: 25, max: 95, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), draw()) });
    const dCtl = ui.slider(w.controls, { label: 'До центра, км', min: 0.5, max: 13.5, step: 0.5, value: s.d, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.d = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, grid: 'none', x: { label: FEATS[0].label, domain: FEATS[0].domain }, y: { label: FEATS[1].label, domain: FEATS[1].domain } });
    const tv = new GBC.TreeView(w.main, { featureNames: ['площадь', 'до центра'], valueLabel: 'цена, млн', valueFormat: (v) => U.fmt(v, 2), thresholdFormat: (v) => U.fmt(v, 1), leafColor: priceColor });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'q', label: 'Задано вопросов' }, { key: 'leaf', label: 'Лист' }, { key: 'p', label: 'Прогноз цены' }, { key: 'n', label: 'Квартир в этом листе' }]);
    function draw() {
      const x = [s.a, s.d];
      const path = tree.decisionPath(x);
      const leafId = path[path.length - 1];
      const layers = [];
      for (const lf of tree.leaves) {
        const { box } = GBC.nodeBox(tree, lf.id, BOUNDS);
        const on = lf.id === leafId;
        layers.push({ type: 'rect', ...box, fill: GBC.colors.rgbString(priceColor(lf.value)), opacity: on ? 0.75 : 0.35, stroke: on ? 'ink' : 'surface', width: on ? 2.2 : 1 });
        layers.push({ type: 'text', x: (box.x0 + box.x1) / 2, y: box.y1, dy: 16, anchor: 'middle', text: U.fmt(lf.value, 1) + ' млн', bold: on });
      }
      layers.push({
        type: 'points', x: FLATS.area, y: FLATS.dist, color: 'data', r: 4.5, label: '8 квартир',
        tooltip: (i) => [{ label: 'квартира', value: '№' + (i + 1) }, { label: 'площадь', value: FLATS.area[i] + ' м²' }, { label: 'до центра', value: FLATS.dist[i] + ' км' }, { label: 'цена', value: U.fmt(FLATS.price[i], 1) + ' млн' }],
      });
      layers.push({
        type: 'points', x: [s.a], y: [s.d], color: 'ink', r: 7, label: 'новая квартира', draggable: true,
        onDrag: (i, x0, y0) => {
          s.a = Math.round(U.clamp(x0, 25, 95));
          s.d = Math.round(U.clamp(y0, 0.5, 13.5) * 2) / 2;
          aCtl.set(s.a);
          dCtl.set(s.d);
          draw();
        },
      });
      plot.render(layers);
      tv.render(tree, { highlight: path });
      const lines = [];
      path.forEach((id, k) => {
        const nd = tree.nodes[id];
        if (nd.left < 0) {
          lines.push('<b>Лист.</b> Вопросы кончились: прогноз = <b>' + U.fmt(nd.value, 2) + ' млн</b> — среднее цен ' + nd.n + ' обучающих квартир, попавших сюда.');
        } else {
          const ft = FEATS[nd.feature];
          const v = x[nd.feature];
          const yes = v <= nd.threshold;
          lines.push('<b>Вопрос ' + (k + 1) + '.</b> ' + ft.name + ' ≤ ' + U.fmt(nd.threshold, 1) + ' ' + ft.unit + '? У нас ' + U.fmt(v, 1) + ' — <b>' + (yes ? 'да → налево' : 'нет → направо') + '</b>.');
        }
      });
      note.innerHTML = lines.join('<br>');
      const leaf = tree.nodes[leafId];
      stats.set('q', String(path.length - 1));
      stats.set('leaf', '#' + leafId);
      stats.set('p', U.fmt(leaf.value, 2) + ' млн');
      stats.set('n', String(leaf.n));
    }
    w.pythonAction(() =>
      PY_FLATS + 'from sklearn.tree import DecisionTreeRegressor, export_text\n\ntree = DecisionTreeRegressor(max_depth=2).fit(X, price)\nprint(export_text(tree, feature_names=["area", "dist"]))\n\n' +
      'x_new = np.array([[' + s.a + ', ' + U.pyNum(s.d) + ']])\nprint("узлы на пути:", tree.decision_path(x_new).indices)\nprint("прогноз:", tree.predict(x_new)[0], "млн")\n'
    );
    draw();
  });

  /* =================================================================================
   * leaf-constant — какое число записать в лист
   * ================================================================================= */
  GBC.widget('leaf-constant', (el) => {
    const GROUPS = {
      all: { label: 'Все 8 квартир', rows: U.range(8) },
      small: { label: 'Площадь ≤ 56 м² (№1–4)', rows: [0, 1, 2, 3] },
      big: { label: 'Площадь > 56 м² (№5–8)', rows: [4, 5, 6, 7] },
    };
    const s = { g: 'all', c: 5 };
    const w = ui.shell(el, { title: 'Какое одно число лучше всего описывает группу?', sub: 'Перетащите горизонтальную линию — это прогноз c для всей группы. Серые отрезки — ошибки. Справа — сумма их квадратов SSE(c).' });
    ui.select(w.controls, { label: 'Группа (будущий лист)', options: Object.entries(GROUPS).map(([value, g]) => ({ value, label: g.label })), value: s.g, onChange: (v) => ((s.g = v), draw()) });
    const cCtl = ui.slider(w.controls, { label: 'Прогноз c, млн', min: 2, max: 12, step: 0.05, value: s.c, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.c = v), draw()) });
    ui.button(w.controls, { label: 'Поставить среднее', kind: 'primary', small: true, onClick: () => ((s.c = mean(GROUPS[s.g].rows.map((i) => FLATS.price[i]))), cCtl.set(s.c), draw()) });
    const grid = H('div', { class: 'grid-2' });
    w.main.appendChild(grid);
    const p1 = new GBC.Plot(grid, { height: 250, x: { label: 'номер квартиры', domain: [0.5, 8.5], ticks: U.range(8, 1) }, y: { label: 'цена, млн', domain: [2, 12] } });
    const p2 = new GBC.Plot(grid, { height: 250, x: { label: 'прогноз c, млн', domain: [2, 12] }, y: { label: 'SSE(c)' } });
    const stats = ui.stats(w.foot, [{ key: 'c', label: 'Ваш прогноз c' }, { key: 'sse', label: 'SSE(c)' }, { key: 'm', label: 'Среднее группы' }, { key: 'min', label: 'Наименьшая SSE' }]);
    function draw() {
      const rows = GROUPS[s.g].rows;
      const ys = rows.map((i) => FLATS.price[i]);
      const xs = rows.map((i) => i + 1);
      const m = mean(ys);
      const f = (c) => U.sum(ys.map((v) => (v - c) * (v - c)));
      p1.render([
        { type: 'segments', x1: xs, y1: ys, x2: xs, y2: xs.map(() => s.c), color: 'residual', width: 2 },
        { type: 'points', x: xs, y: ys, color: 'data', r: 5, label: 'цены', tooltip: (j) => [{ label: 'квартира', value: '№' + xs[j] }, { label: 'цена', value: U.fmt(ys[j], 1) }, { label: 'ошибка', value: U.fmtSigned(ys[j] - s.c, 2) }] },
        { type: 'hline', y: m, color: 'truth', dash: '5 4', width: 1.5, text: 'среднее' },
        { type: 'hline', y: s.c, color: 'model', width: 2.6, draggable: true, text: 'c = ' + U.fmt(s.c, 2), onDrag: (v) => ((s.c = U.clamp(Math.round(v * 20) / 20, 2, 12)), cCtl.set(s.c), draw()) },
      ]);
      const cs = U.linspace(2, 12, 201);
      p2.render([
        { type: 'line', x: cs, y: cs.map(f), color: 'model', width: 2, label: 'SSE(c)' },
        { type: 'vline', x: m, color: 'truth', dash: '5 4', width: 1.5, text: 'среднее' },
        { type: 'points', x: [s.c], y: [f(s.c)], color: 'tree', r: 6, label: 'ваш прогноз' },
      ]);
      stats.set('c', U.fmt(s.c, 2));
      stats.set('sse', U.fmt(f(s.c), 3));
      stats.set('m', U.fmt(m, 3));
      stats.set('min', U.fmt(f(m), 3));
    }
    w.pythonAction(() =>
      PY_FLATS + '\ngroup = price[' + JSON.stringify(GROUPS[s.g].rows) + ']   # ' + GROUPS[s.g].label + '\nc = ' + U.pyNum(s.c) +
      '\nprint("SSE(c)       =", ((group - c) ** 2).sum())\nprint("среднее      =", group.mean())\nprint("SSE(среднее) =", ((group - group.mean()) ** 2).sum())\n'
    );
    draw();
  });

  /* =================================================================================
   * flat-split — перебор порогов и признаков для любой группы квартир
   * ================================================================================= */
  GBC.widget('flat-split', (el) => {
    const NODES = {
      root: { label: 'Корень: все 8 квартир', rows: U.range(8) },
      left: { label: 'Левый узел: площадь ≤ 56 (№1–4)', rows: [0, 1, 2, 3] },
      right: { label: 'Правый узел: площадь > 56 (№5–8)', rows: [4, 5, 6, 7] },
    };
    const s = { node: 'root', f: 0, t: 46 };
    const w = ui.shell(el, { title: 'Переберите все пороги — как это делает дерево', sub: 'Перетащите вертикальную линию. Слева и справа от неё — две группы, в каждой прогноз равен среднему. В таблице — все пороги-кандидаты: «слева» и «справа» — число квартир × их средняя цена.' });
    ui.select(w.controls, { label: 'Какой узел делим', options: Object.entries(NODES).map(([value, n]) => ({ value, label: n.label })), value: s.node, onChange: (v) => ((s.node = v), snap(), draw()) });
    const fCtl = ui.segmented(w.controls, { label: 'Признак', options: [{ value: 0, label: 'Площадь' }, { value: 1, label: 'До центра' }], value: s.f, onChange: (v) => ((s.f = v), snap(), draw()) });
    ui.button(w.controls, { label: 'Поставить лучший порог', kind: 'primary', small: true, onClick: () => { const b = bestSplit(FLATS.X, FLATS.price, NODES[s.node].rows); s.f = b.f; s.t = b.t; fCtl.set(b.f); draw(); } });
    const plot = new GBC.Plot(w.main, { height: 270, x: { label: FEATS[0].label, domain: FEATS[0].domain }, y: { label: 'цена, млн', domain: [2, 12] } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'before', label: 'SSE до разбиения' }, { key: 'after', label: 'SSE после' }, { key: 'gain', label: 'Выигрыш Δ' }, { key: 'best', label: 'Лучшее по обоим признакам' }]);
    function snap() {
      const c = candidates(FLATS.X, FLATS.price, NODES[s.node].rows, s.f);
      if (!c.some((k) => Math.abs(k.t - s.t) < 1e-9)) s.t = c[Math.floor(c.length / 2)].t;
    }
    function draw() {
      const rows = NODES[s.node].rows;
      const ft = FEATS[s.f];
      const xs = rows.map((i) => FLATS.X[i][s.f]);
      const ys = rows.map((i) => FLATS.price[i]);
      const L = rows.filter((i) => FLATS.X[i][s.f] <= s.t);
      const R = rows.filter((i) => FLATS.X[i][s.f] > s.t);
      const mL = mean(L.map((i) => FLATS.price[i]));
      const mR = mean(R.map((i) => FLATS.price[i]));
      const before = sse(ys);
      const after = sse(L.map((i) => FLATS.price[i])) + sse(R.map((i) => FLATS.price[i]));
      const pred = rows.map((i) => (FLATS.X[i][s.f] <= s.t ? mL : mR));
      const cands = candidates(FLATS.X, FLATS.price, rows, s.f); // порог «прилипает» к кандидатам
      plot.opts.x.domain = ft.domain;
      plot.opts.x.label = ft.label;
      plot.render([
        { type: 'segments', x1: xs, y1: ys, x2: xs, y2: pred.map((p) => (Number.isNaN(p) ? 0 : p)), color: 'residual', width: 2 },
        L.length ? { type: 'line', x: [ft.domain[0], s.t], y: [mL, mL], color: 'model', width: 2.6, label: 'среднее слева' } : null,
        R.length ? { type: 'line', x: [s.t, ft.domain[1]], y: [mR, mR], color: 'tree', width: 2.6, label: 'среднее справа' } : null,
        { type: 'points', x: xs, y: ys, r: 5, color: (j) => (xs[j] <= s.t ? 'class0' : 'class1'), legendColor: 'data', label: 'квартиры', tooltip: (j) => [{ label: 'квартира', value: '№' + (rows[j] + 1) }, { label: ft.name, value: xs[j] + ' ' + ft.unit }, { label: 'цена', value: U.fmt(ys[j], 1) }] },
        { type: 'vline', x: s.t, color: 'ink', width: 2, draggable: true, text: ft.name + ' ≤ ' + U.fmt(s.t, 1), onDrag: (v) => { const near = cands.reduce((a, c) => (Math.abs(c.t - v) < Math.abs(a.t - v) ? c : a)); if (near.t !== s.t) { s.t = near.t; draw(); } } },
      ]);
      let bi = 0;
      cands.forEach((c, i) => (c.gain > cands[bi].gain ? (bi = i) : 0));
      tableBox.textContent = '';
      ui.table(tableBox, {
        columns: ['порог', 'слева', 'справа', 'SSE после', 'выигрыш Δ'],
        rows: cands.map((c) => [(Math.abs(c.t - s.t) < 1e-9 ? '▸ ' : '') + '≤ ' + U.fmt(c.t, 1), c.nL + ' × ' + c.mL.toFixed(2), c.nR + ' × ' + c.mR.toFixed(2), c.after.toFixed(2), c.gain.toFixed(2)]),
        highlight: (i) => i === bi,
      });
      const b = bestSplit(FLATS.X, FLATS.price, rows);
      const bf = FEATS[b.f];
      const isBest = b.f === s.f && Math.abs(b.t - s.t) < 1e-9;
      note.innerHTML = (L.length && R.length
        ? 'Слева ' + L.length + ' кв. со средним <b>' + U.fmt(mL, 2) + '</b>, справа ' + R.length + ' со средним <b>' + U.fmt(mR, 2) + '</b>. Ошибка упала с ' + U.fmt(before, 2) + ' до <b>' + U.fmt(after, 2) + '</b>. '
        : 'Все квартиры по одну сторону порога — это не разбиение. ') +
        (isBest ? '<b>Это лучшее разбиение узла.</b>' : 'Лучшее в таблице подсвечено; среди <i>обоих</i> признаков побеждает «' + bf.name + ' ≤ ' + U.fmt(b.t, 1) + '».');
      stats.set('before', U.fmt(before, 2));
      stats.set('after', L.length && R.length ? U.fmt(after, 2) : '—');
      stats.set('gain', L.length && R.length ? U.fmt(before - after, 2) : '—');
      stats.set('best', bf.name + ' ≤ ' + U.fmt(b.t, 1) + ' (Δ = ' + U.fmt(b.gain, 2) + ')');
    }
    w.pythonAction(() =>
      PY_FLATS + '\nrows = np.array(' + JSON.stringify(NODES[s.node].rows) + ')   # ' + NODES[s.node].label + '\nsse = lambda v: ((v - v.mean()) ** 2).sum() if len(v) else 0.0\n\n' +
      'for name, col in (("area", area[rows]), ("dist", dist[rows])):\n    vals = np.unique(col)\n    for t in (vals[:-1] + vals[1:]) / 2:          # пороги — середины между соседними значениями\n' +
      '        left, right = price[rows][col <= t], price[rows][col > t]\n        gain = sse(price[rows]) - sse(left) - sse(right)\n' +
      '        print(f"{name} <= {t:5.1f}: слева {left.mean():5.2f} ({len(left)}), справа {right.mean():5.2f} ({len(right)}), SSE после {sse(left) + sse(right):6.2f}, выигрыш {gain:6.2f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * grow-tree — вырастите дерево своими руками
   * ================================================================================= */
  GBC.widget('grow-tree', (el) => {
    const s = { data: 'flats', minLeaf: 1 };
    const w = ui.shell(el, { title: 'Вырастите дерево своими руками', sub: 'Кликните по листу на схеме — он разделится лучшим для него вопросом. Или нажимайте кнопку: каждый раз делится лист с наибольшим выигрышем.' });
    ui.select(w.controls, { label: 'Данные', options: [{ value: 'flats', label: '8 квартир (2 признака)' }, { value: 'sine', label: '60 точек: синус' }, { value: 'step', label: '60 точек: ступеньки' }], value: s.data, onChange: (v) => ((s.data = v), load()) });
    ui.slider(w.controls, { label: 'Мин. объектов в листе', min: 1, max: 15, step: 1, value: s.minLeaf, format: String, onInput: (v) => ((s.minLeaf = v), reset()) });
    const bBest = ui.button(w.controls, { label: 'Разделить лучший лист', kind: 'primary', small: true, onClick: () => splitBest() });
    ui.button(w.controls, { label: 'Достроить до конца', small: true, onClick: () => { while (splitBest(true)); draw(); } });
    ui.button(w.controls, { label: 'Начать заново', kind: 'ghost', small: true, onClick: () => reset() });
    const p2d = new GBC.Plot(w.main, { height: 290, grid: 'none', x: { label: FEATS[0].label, domain: FEATS[0].domain }, y: { label: FEATS[1].label, domain: FEATS[1].domain } });
    const p1d = new GBC.Plot(w.main, { height: 290, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const tv = new GBC.TreeView(w.main, { valueFormat: (v) => U.fmt(v, 2), thresholdFormat: (v) => U.fmt(v, 2), onNodeClick: (nd) => (nd.left < 0 ? splitNode(nd.id) : null) });
    const pH = new GBC.Plot(w.main, { height: 170, x: { label: 'сделано разбиений', domain: [-0.6, 8.6] }, y: { label: 'SSE дерева', domain: [0, 1] } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'leaves', label: 'Листьев' }, { key: 'depth', label: 'Глубина' }, { key: 'sse', label: 'SSE дерева' }, { key: 'next', label: 'Лучший следующий выигрыш' }]);
    let X;
    let y;
    let nodes;
    let history;
    let lastSplit = null;
    function makeNode(rows, depth) {
      const ys = rows.map((i) => y[i]);
      const nd = { id: nodes.length, depth, rows, n: rows.length, G: -U.sum(ys), H: rows.length, value: mean(ys), sse: sse(ys), left: -1, right: -1, feature: -1, threshold: NaN, gain: 0 };
      nd.best = bestSplit(X, y, rows, s.minLeaf);
      nodes.push(nd);
      return nd;
    }
    function load() {
      if (s.data === 'flats') {
        X = FLATS.X;
        y = FLATS.price;
      } else {
        const d = GBC.datasets.regression1d({ kind: s.data, n: 60, noise: 0.25, seed: 3 });
        X = d.X;
        y = d.y;
      }
      p2d.root.hidden = s.data !== 'flats';
      p1d.root.hidden = s.data === 'flats';
      tv.opts.featureNames = s.data === 'flats' ? ['площадь', 'до центра'] : ['x'];
      tv.opts.valueLabel = s.data === 'flats' ? 'цена, млн' : 'среднее y';
      reset();
    }
    function reset() {
      nodes = [];
      makeNode(U.range(y.length), 0);
      history = [nodes[0].sse];
      lastSplit = null;
      draw();
    }
    function splitNode(id, silent) {
      const nd = nodes[id];
      if (nd.left >= 0 || !nd.best) {
        if (!silent) GBC.ui.toast('Этот лист делить нечем: в нём один объект, одинаковые ответы или сработало ограничение');
        return false;
      }
      const b = nd.best;
      nd.feature = b.f;
      nd.threshold = b.t;
      nd.gain = b.gain;
      nd.left = makeNode(b.L, nd.depth + 1).id;
      nd.right = makeNode(b.R, nd.depth + 1).id;
      history.push(history[history.length - 1] - b.gain);
      lastSplit = id;
      if (!silent) draw();
      return true;
    }
    function splitBest(silent) {
      let best = null;
      for (const nd of nodes) if (nd.left < 0 && nd.best && (!best || nd.best.gain > best.best.gain)) best = nd;
      return best ? splitNode(best.id, silent) : false;
    }
    function draw() {
      const tree = asTree(nodes, X[0].length);
      const leaves = nodes.filter((nd) => nd.left < 0);
      let next = null;
      for (const nd of leaves) if (nd.best && (!next || nd.best.gain > next.best.gain)) next = nd;
      if (s.data === 'flats') {
        const layers = [];
        for (const lf of leaves) {
          const { box } = GBC.nodeBox(tree, lf.id, BOUNDS);
          const hot = next && lf.id === next.id;
          layers.push({ type: 'rect', ...box, fill: GBC.colors.rgbString(priceColor(lf.value)), opacity: 0.5, stroke: hot ? 'ink' : 'surface', width: hot ? 2 : 1, dash: hot ? '5 4' : null });
          layers.push({ type: 'text', x: (box.x0 + box.x1) / 2, y: box.y1, dy: 16, anchor: 'middle', text: U.fmt(lf.value, 2) });
          if (hot) {
            // пунктир — где пройдёт следующий вопрос
            const b = lf.best;
            layers.push(b.f === 0 ? { type: 'line', x: [b.t, b.t], y: [box.y0, box.y1], color: 'ink', dash: '5 4', width: 1.6, legend: false } : { type: 'line', x: [box.x0, box.x1], y: [b.t, b.t], color: 'ink', dash: '5 4', width: 1.6, legend: false });
          }
        }
        layers.push({ type: 'points', x: FLATS.area, y: FLATS.dist, color: 'data', r: 4.5, label: 'квартиры', tooltip: (i) => [{ label: 'квартира', value: '№' + (i + 1) }, { label: 'цена', value: U.fmt(FLATS.price[i], 1) + ' млн' }, { label: 'прогноз', value: U.fmt(tree.predictOne(FLATS.X[i]), 2) }] });
        p2d.render(layers);
      } else {
        const xs = X.map((r) => r[0]);
        p1d.render([
          { type: 'line', x: U.linspace(0, 10, 300), y: U.linspace(0, 10, 300).map((v) => GBC.datasets.trueFunction(s.data, v)), color: 'truth', dash: '5 4', width: 1.5, label: 'истинная f(x)', hover: false },
          { type: 'points', x: xs, y, color: 'data', r: 3.6, label: 'данные' },
          { type: 'steps', segments: tree.segments1d(0, 10), color: 'model', width: 2.4, label: 'прогноз дерева' },
          next ? { type: 'vline', x: next.best.t, color: 'tree', dash: '5 4', width: 1.5, text: 'следующий порог' } : null,
        ]);
      }
      tv.opts.leafColor = s.data === 'flats' ? priceColor : null;
      tv.render(tree, { highlight: next ? [next.id] : [] });
      const k = history.length - 1;
      pH.opts.x.domain = [-0.6, Math.max(8, k) + 0.6];
      pH.opts.y.domain = [0, history[0] * 1.08];
      pH.render([{ type: 'bars', x: U.range(history.length), y: history, color: (i) => (i === k ? 'tree' : 'model'), width: 0.7, label: 'SSE после k разбиений', tooltip: (i) => [{ label: 'разбиений', value: String(i) }, { label: 'SSE', value: U.fmt(history[i], 3) }] }]);
      bBest.disabled = !next;
      const last = lastSplit !== null ? nodes[lastSplit] : null;
      const fname = (f) => (s.data === 'flats' ? FEATS[f].name : 'x');
      note.innerHTML =
        (last ? 'Последнее разбиение: <b>' + fname(last.feature) + ' ≤ ' + U.fmt(last.threshold, 2) + '</b>, ошибка уменьшилась на ' + U.fmt(last.gain, 3) + '. ' : 'Пока дерево — один лист: всем объектам предсказывается общее среднее ' + U.fmt(nodes[0].value, 2) + '. ') +
        (next ? 'Пунктиром выделен лист с наибольшим выигрышем: «' + fname(next.best.f) + ' ≤ ' + U.fmt(next.best.t, 2) + '» даст Δ = ' + U.fmt(next.best.gain, 3) + '.' : '<b>Делить больше нечего</b> — ' + (history[k] < 1e-9 ? 'дерево запомнило каждый объект: ошибка на обучении равна нулю.' : 'сработало ограничение на размер листа.'));
      stats.set('leaves', String(leaves.length));
      stats.set('depth', String(Math.max(...nodes.map((nd) => nd.depth))));
      stats.set('sse', U.fmt(history[k], 3));
      stats.set('next', next ? U.fmt(next.best.gain, 3) : '—');
    }
    w.pythonAction(() => {
      const leaves = nodes.filter((nd) => nd.left < 0).length;
      const data = s.data === 'flats' ? PY_FLATS + 'y = price\n' : 'from gbcourse import datasets\n\nX, y = datasets.regression_1d(kind="' + s.data + '", n=60, noise=0.25, seed=3)\n';
      return data + 'from sklearn.tree import DecisionTreeRegressor, export_text\n\n# max_leaf_nodes включает рост «лучший лист первым» — как кнопка «Разделить лучший лист»\n' +
        'tree = DecisionTreeRegressor(max_leaf_nodes=' + Math.max(2, leaves) + ', min_samples_leaf=' + s.minLeaf + ').fit(X, y)\nprint(export_text(tree))\nprint("листьев:", tree.get_n_leaves(), " SSE:", ((y - tree.predict(X)) ** 2).sum())\n';
    });
    load();
  });

  /* =================================================================================
   * depth-curve — глубина, недообучение и переобучение
   * ================================================================================= */
  GBC.widget('depth-curve', (el) => {
    const s = { depth: 2, noise: 0.35, minLeaf: 1, kind: 'sine' };
    const MAXD = 10;
    const w = ui.shell(el, { title: 'Глубина дерева: от «слишком просто» до «выучил шум»', sub: 'Вверху — прогноз дерева выбранной глубины. Внизу — ошибка на обучении и на 400 новых точках для каждой глубины. Перетащите линию глубины.' });
    ui.select(w.controls, { label: 'Данные', options: [{ value: 'sine', label: 'Синус' }, { value: 'wave', label: 'Волна' }, { value: 'step', label: 'Ступеньки' }, { value: 'linear', label: 'Прямая' }], value: s.kind, onChange: (v) => ((s.kind = v), fit()) });
    const dCtl = ui.slider(w.controls, { label: 'Глубина', min: 0, max: MAXD, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    ui.slider(w.controls, { label: 'Шум σ', min: 0, max: 1, step: 0.05, value: s.noise, onInput: (v) => ((s.noise = v), refit()) });
    ui.slider(w.controls, { label: 'Мин. объектов в листе', min: 1, max: 20, step: 1, value: s.minLeaf, format: String, onInput: (v) => ((s.minLeaf = v), refit()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'глубина дерева', domain: [-0.3, MAXD + 0.3], ticks: U.range(MAXD + 1) }, y: { label: 'MSE' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'leaves', label: 'Листьев' }, { key: 'tr', label: 'MSE на обучении' }, { key: 'te', label: 'MSE на новых данных' }, { key: 'best', label: 'Лучшая глубина' }]);
    const refit = U.rafThrottle(() => fit());
    let data;
    let test;
    let trees;
    let tr;
    let te;
    function fit() {
      const ds = { kind: s.kind, n: 60, noise: s.noise, seed: 3 };
      data = GBC.datasets.regression1d(ds);
      test = GBC.datasets.regression1d(Object.assign({}, ds, { seed: 1003, n: 400 }));
      trees = U.range(MAXD + 1).map((d) => new GBC.RegressionTree({ maxDepth: d, minSamplesLeaf: s.minLeaf }).fit(data.X, data.y.map((v) => -v)));
      tr = trees.map((t) => GBC.metrics.mse(data.y, t.predict(data.X)));
      te = trees.map((t) => GBC.metrics.mse(test.y, t.predict(test.X)));
      draw();
    }
    function draw() {
      const t = trees[s.depth];
      const grid = U.linspace(0, 10, 300);
      p1.render([
        { type: 'line', x: grid, y: grid.map((v) => GBC.datasets.trueFunction(s.kind, v)), color: 'truth', dash: '5 4', width: 1.5, label: 'истинная f(x)', hover: false },
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3.6, label: 'обучающие точки' },
        { type: 'steps', segments: t.segments1d(0, 10), color: 'model', width: 2.4, label: 'дерево глубины ' + s.depth },
      ]);
      let best = 0;
      te.forEach((v, i) => (v < te[best] ? (best = i) : 0));
      const ds = U.range(MAXD + 1);
      p2.render([
        { type: 'line', x: ds, y: tr, color: 'train', width: 2, label: 'обучение', marker: true },
        { type: 'points', x: ds, y: tr, color: 'train', r: 3.5, legend: false, tooltip: (i) => [{ label: 'глубина', value: String(i) }, { label: 'MSE обучения', value: U.fmt(tr[i], 4) }] },
        { type: 'line', x: ds, y: te, color: 'valid', width: 2, label: 'новые данные' },
        { type: 'points', x: ds, y: te, color: 'valid', r: 3.5, legend: false, tooltip: (i) => [{ label: 'глубина', value: String(i) }, { label: 'MSE на новых', value: U.fmt(te[i], 4) }] },
        { type: 'hline', y: s.noise * s.noise, color: 'truth', dash: '3 3', width: 1.2, text: 'уровень шума σ²' },
        { type: 'vline', x: s.depth, color: 'ink', width: 2, draggable: true, text: 'глубина ' + s.depth, onDrag: (v) => ((s.depth = U.clamp(Math.round(v), 0, MAXD)), dCtl.set(s.depth), draw()) },
      ]);
      const near = te[s.depth] <= te[best] * 1.05; // в пределах 5% от лучшей — разница меньше шума оценки
      note.innerHTML = near
        ? '<b>Золотая середина.</b> Ошибка на новых данных ' + U.fmt(te[s.depth], 3) + ' — наименьшая или почти наименьшая (лучшая ' + U.fmt(te[best], 3) + ' при глубине ' + best + ').'
        : s.depth < best
          ? '<b>Недообучение.</b> Ступенек слишком мало, чтобы повторить форму зависимости: велика ошибка и на обучении, и на новых данных.'
          : '<b>Переобучение.</b> Ошибка на обучении продолжает падать (' + U.fmt(tr[s.depth], 3) + '), а на новых данных она уже выше, чем при глубине ' + best + ' (' + U.fmt(te[s.depth], 3) + ' против ' + U.fmt(te[best], 3) + '): дерево запоминает шум.';
      stats.set('leaves', String(t.nLeaves));
      stats.set('tr', U.fmt(tr[s.depth], 4));
      stats.set('te', U.fmt(te[s.depth], 4));
      stats.set('best', best + ' (MSE ' + U.fmt(te[best], 3) + ')');
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom sklearn.tree import DecisionTreeRegressor\nfrom gbcourse import datasets\n\n' +
      'X, y = datasets.regression_1d(kind="' + s.kind + '", n=60, noise=' + U.pyNum(s.noise) + ', seed=3)\nX_new, y_new = datasets.regression_1d(kind="' + s.kind + '", n=400, noise=' + U.pyNum(s.noise) + ', seed=1003)\n\n' +
      'for depth in range(0, ' + (MAXD + 1) + '):\n    if depth == 0:\n        pred, pred_new, leaves = np.full(len(y), y.mean()), np.full(len(y_new), y.mean()), 1\n    else:\n' +
      '        t = DecisionTreeRegressor(max_depth=depth, min_samples_leaf=' + s.minLeaf + ').fit(X, y)\n        pred, pred_new, leaves = t.predict(X), t.predict(X_new), t.get_n_leaves()\n' +
      '    print(f"глубина {depth:2d}: листьев {leaves:2d}, MSE обучение {np.mean((y - pred) ** 2):.4f}, новые данные {np.mean((y_new - pred_new) ** 2):.4f}")\n'
    );
    fit();
  });

  /* =================================================================================
   * invariance — дереву важен только порядок значений
   * ================================================================================= */
  GBC.widget('invariance', (el) => {
    const TR = {
      id: { label: 'x (как есть)', f: (v) => v, inv: (v) => v, py: 'X' },
      scale: { label: '1000 · x (другие единицы)', f: (v) => 1000 * v, inv: (v) => v / 1000, py: '1000 * X' },
      cube: { label: 'x³', f: (v) => v * v * v, inv: (v) => Math.cbrt(v), py: 'X ** 3' },
      log: { label: 'ln x', f: (v) => Math.log(v), inv: (v) => Math.exp(v), py: 'np.log(X)' },
    };
    const s = { tr: 'cube', depth: 2 };
    const w = ui.shell(el, { title: 'Растянем ось x — дерево не заметит', sub: 'Признак заменяется монотонным преобразованием. Точки на оси переезжают, но их порядок сохраняется — и дерево делит их на те же группы.' });
    ui.select(w.controls, { label: 'Признак подаётся как', options: Object.entries(TR).map(([value, t]) => ({ value, label: t.label })), value: s.tr, onChange: (v) => ((s.tr = v), draw()) });
    ui.slider(w.controls, { label: 'Глубина', min: 1, max: 4, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const grid = H('div', { class: 'grid-2' });
    w.main.appendChild(grid);
    const p0 = new GBC.Plot(grid, { height: 240, title: 'Исходный признак x', x: { label: 'x' }, y: { label: 'y' } });
    const p1 = new GBC.Plot(grid, { height: 240, title: 'Преобразованный признак', x: { label: 'z' }, y: { label: 'y' } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const stats = ui.stats(w.foot, [{ key: 'same', label: 'Группы объектов в листьях' }, { key: 'diff', label: 'Макс. разница прогнозов' }, { key: 'leaves', label: 'Листьев' }]);
    const data = GBC.datasets.regression1d({ kind: 'sine', n: 40, noise: 0.25, seed: 7, xMin: 0.5, xMax: 10 });
    function draw() {
      const t = TR[s.tr];
      const z = data.x.map(t.f);
      const fit = (xs) => new GBC.RegressionTree({ maxDepth: s.depth }).fit(xs.map((v) => [v]), data.y.map((v) => -v));
      const t0 = fit(data.x);
      const t1 = fit(z);
      const [z0, z1] = U.extent(z);
      const pad = (z1 - z0) * 0.04;
      const thr = (tree) => tree.nodes.filter((nd) => nd.left >= 0).map((nd) => nd.threshold).sort((a, b) => a - b);
      p0.render([
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3.6, label: 'данные' },
        { type: 'steps', segments: t0.segments1d(0, 10.5), color: 'model', width: 2.4, label: 'дерево' },
        ...thr(t0).map((v) => ({ type: 'vline', x: v, color: 'tree', dash: '4 3', width: 1.2 })),
      ], { x: [0, 10.5] });
      p1.opts.x.label = 'z = ' + t.label;
      p1.render([
        { type: 'points', x: z, y: data.y, color: 'data', r: 3.6, label: 'данные' },
        { type: 'steps', segments: t1.segments1d(z0 - pad, z1 + pad), color: 'model', width: 2.4, label: 'дерево' },
        ...thr(t1).map((v) => ({ type: 'vline', x: v, color: 'tree', dash: '4 3', width: 1.2 })),
      ], { x: [z0 - pad, z1 + pad] });
      const a = thr(t0);
      const b = thr(t1);
      const pred0 = data.x.map((v) => t0.predictOne([v]));
      const pred1 = z.map((v) => t1.predictOne([v]));
      const diff = Math.max(...pred0.map((v, i) => Math.abs(v - pred1[i])));
      const below = (arr, xs) => arr.map((c) => xs.filter((v) => v <= c).length);
      const same = JSON.stringify(below(a, data.x)) === JSON.stringify(below(b, z));
      tableBox.textContent = '';
      ui.table(tableBox, {
        columns: ['порог', 'по x', 'по z', 'z обратно в x', 'объектов левее: x / z'],
        rows: a.map((v, i) => [String(i + 1), U.fmt(v, 3), b[i] === undefined ? '—' : U.fmt(b[i], 3), b[i] === undefined ? '—' : U.fmt(t.inv(b[i]), 3), below([v], data.x)[0] + ' / ' + (b[i] === undefined ? '—' : below([b[i]], z)[0])]),
      });
      stats.set('same', same ? 'совпали' : 'различаются');
      stats.set('diff', U.fmt(diff, 6));
      stats.set('leaves', t0.nLeaves + ' и ' + t1.nLeaves);
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom sklearn.tree import DecisionTreeRegressor\nfrom gbcourse import datasets\n\nX, y = datasets.regression_1d(kind="sine", n=40, noise=0.25, seed=7, x_min=0.5, x_max=10)\nZ = ' + TR[s.tr].py + '\n\n' +
      'a = DecisionTreeRegressor(max_depth=' + s.depth + ').fit(X, y)\nb = DecisionTreeRegressor(max_depth=' + s.depth + ').fit(Z, y)\n' +
      'print("макс. разница прогнозов на обучающих точках:", np.abs(a.predict(X) - b.predict(Z)).max())\nprint("пороги по x:", np.sort(a.tree_.threshold[a.tree_.feature >= 0]))\nprint("пороги по z:", np.sort(b.tree_.threshold[b.tree_.feature >= 0]))\n'
    );
    draw();
  });

  /* =================================================================================
   * extrapolate — за пределами данных дерево «замирает»
   * ================================================================================= */
  GBC.widget('extrapolate', (el) => {
    const s = { depth: 3, noise: 0.4, probe: 11 };
    const w = ui.shell(el, { title: 'За краем данных дерево повторяет крайний лист', sub: 'Обучающие точки лежат только в белой зоне (x от 2 до 8). Перетащите линию «новый x» в серую зону и сравните дерево с прямой.' });
    ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 6, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    ui.slider(w.controls, { label: 'Шум σ', min: 0, max: 1, step: 0.05, value: s.noise, onInput: (v) => ((s.noise = v), draw()) });
    const pCtl = ui.slider(w.controls, { label: 'Новый x', min: 0, max: 12, step: 0.1, value: s.probe, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.probe = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 12] }, y: { label: 'y' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'tree', label: 'Прогноз дерева' }, { key: 'lin', label: 'Прогноз прямой' }, { key: 'true', label: 'Истинное значение' }, { key: 'err', label: 'Ошибка дерева / прямой' }]);
    function draw() {
      const data = GBC.datasets.regression1d({ kind: 'linear', n: 40, noise: s.noise, seed: 11, xMin: 2, xMax: 8 });
      const tree = new GBC.RegressionTree({ maxDepth: s.depth }).fit(data.X, data.y.map((v) => -v));
      const mx = mean(data.x);
      const my = mean(data.y);
      const slope = U.sum(data.x.map((v, i) => (v - mx) * (data.y[i] - my))) / U.sum(data.x.map((v) => (v - mx) * (v - mx)));
      const lin = (v) => my + slope * (v - mx);
      const f = (v) => GBC.datasets.trueFunction('linear', v);
      const grid = U.linspace(0, 12, 200);
      const pt = tree.predictOne([s.probe]);
      plot.render([
        { type: 'vband', x0: 0, x1: 2, color: 'ink', opacity: 0.07 },
        { type: 'vband', x0: 8, x1: 12, color: 'ink', opacity: 0.07 },
        { type: 'line', x: grid, y: grid.map(f), color: 'truth', dash: '5 4', width: 1.5, label: 'истинная f(x)', hover: false },
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3.6, label: 'обучающие точки' },
        { type: 'line', x: [0, 12], y: [lin(0), lin(12)], color: 'tree', width: 2, label: 'линейная регрессия' },
        { type: 'steps', segments: tree.segments1d(0, 12), color: 'model', width: 2.4, label: 'дерево' },
        { type: 'vline', x: s.probe, color: 'ink', width: 2, draggable: true, text: 'новый x = ' + U.fmt(s.probe, 1), onDrag: (v) => ((s.probe = Math.round(U.clamp(v, 0, 12) * 10) / 10), pCtl.set(s.probe), draw()) },
        { type: 'points', x: [s.probe, s.probe], y: [pt, lin(s.probe)], color: (i) => (i ? 'tree' : 'model'), r: 6, legend: false },
      ]);
      const outside = s.probe < 2 || s.probe > 8;
      note.innerHTML = outside
        ? '<b>Экстраполяция.</b> Правее последнего порога все x попадают в один и тот же крайний лист, поэтому прогноз дерева застыл на ' + U.fmt(pt, 2) + ' — тренд оно не продолжает. Прямая продолжает.'
        : 'Внутри диапазона данных дерево и прямая дают близкие прогнозы. Унесите «новый x» за 8 или левее 2.';
      stats.set('tree', U.fmt(pt, 3));
      stats.set('lin', U.fmt(lin(s.probe), 3));
      stats.set('true', U.fmt(f(s.probe), 3));
      stats.set('err', U.fmt(Math.abs(pt - f(s.probe)), 2) + ' / ' + U.fmt(Math.abs(lin(s.probe) - f(s.probe)), 2));
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom sklearn.linear_model import LinearRegression\nfrom sklearn.tree import DecisionTreeRegressor\nfrom gbcourse import datasets\n\n' +
      'X, y = datasets.regression_1d(kind="linear", n=40, noise=' + U.pyNum(s.noise) + ', seed=11, x_min=2, x_max=8)\ntree = DecisionTreeRegressor(max_depth=' + s.depth + ').fit(X, y)\nline = LinearRegression().fit(X, y)\n\n' +
      'for x_new in (5.0, 8.0, 9.0, 10.0, ' + U.pyNum(s.probe) + '):\n    q = np.array([[x_new]])\n    print(f"x = {x_new:5.1f}: дерево {tree.predict(q)[0]:6.3f}, прямая {line.predict(q)[0]:6.3f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * instability — другое дерево на чуть других данных
   * ================================================================================= */
  GBC.widget('instability', (el) => {
    const s = { depth: 4, seeds: [1], avg: false };
    const w = ui.shell(el, { title: 'Чуть другие данные — совсем другое дерево', sub: 'Каждая «новая выборка» — 40 свежих точек из той же зависимости. Жирная линия — дерево на последней выборке, тонкие — на предыдущих.' });
    ui.slider(w.controls, { label: 'Глубина', min: 1, max: 8, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    ui.button(w.controls, { label: 'Новая выборка', kind: 'primary', small: true, onClick: () => { s.seeds.push(s.seeds[s.seeds.length - 1] + 1); if (s.seeds.length > 15) s.seeds.shift(); draw(); } });
    ui.button(w.controls, { label: 'Сбросить', kind: 'ghost', small: true, onClick: () => ((s.seeds = [1]), draw()) });
    ui.toggle(w.controls, { label: 'Показать среднее всех деревьев', checked: s.avg, onChange: (v) => ((s.avg = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-2.2, 2.2] } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'k', label: 'Выборок' }, { key: 'root', label: 'Порог корня (последнее дерево)' }, { key: 'spread', label: 'Пороги корня: от … до' }, { key: 'sd', label: 'Разброс прогноза при x = 5' }]);
    function draw() {
      const grid = U.linspace(0, 10, 240);
      const fits = s.seeds.map((seed) => {
        const d = GBC.datasets.regression1d({ kind: 'sine', n: 40, noise: 0.45, seed: 100 + seed });
        return { d, t: new GBC.RegressionTree({ maxDepth: s.depth }).fit(d.X, d.y.map((v) => -v)) };
      });
      const last = fits[fits.length - 1];
      const layers = [{ type: 'line', x: grid, y: grid.map((v) => GBC.datasets.trueFunction('sine', v)), color: 'truth', dash: '5 4', width: 1.5, label: 'истинная f(x)', hover: false }];
      fits.slice(0, -1).forEach((f) => layers.push({ type: 'steps', segments: f.t.segments1d(0, 10), color: 'model-prev', width: 1.2, opacity: 0.7, legend: false }));
      layers.push({ type: 'points', x: last.d.x, y: last.d.y, color: 'data', r: 3.4, label: 'последняя выборка' });
      layers.push({ type: 'steps', segments: last.t.segments1d(0, 10), color: 'model', width: 2.6, label: 'дерево на последней выборке' });
      if (s.avg && fits.length > 1) layers.push({ type: 'line', x: grid, y: grid.map((v) => mean(fits.map((f) => f.t.predictOne([v])))), color: 'tree', width: 2.6, label: 'среднее ' + fits.length + ' деревьев' });
      plot.render(layers);
      const roots = fits.map((f) => (f.t.nodes[0].left >= 0 ? f.t.nodes[0].threshold : NaN)).filter((v) => !Number.isNaN(v));
      const at5 = fits.map((f) => f.t.predictOne([5]));
      const sd = Math.sqrt(mean(at5.map((v) => (v - mean(at5)) ** 2)));
      note.innerHTML = fits.length < 3
        ? 'Нажмите «Новая выборка» несколько раз: зависимость та же, а пороги и ступеньки каждый раз другие.'
        : 'Зависимость одна, а деревья разные — это и есть <b>высокий разброс</b>. ' + (s.avg ? 'Среднее многих деревьев гораздо ближе к истинной кривой: на этом построены ансамбли (модуль 3).' : 'Включите «среднее всех деревьев» — увидите, зачем нужны ансамбли.');
      stats.set('k', String(fits.length));
      stats.set('root', U.fmt(roots[roots.length - 1], 2));
      stats.set('spread', U.fmt(Math.min(...roots), 2) + ' … ' + U.fmt(Math.max(...roots), 2));
      stats.set('sd', fits.length > 1 ? U.fmt(sd, 3) : '—');
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom sklearn.tree import DecisionTreeRegressor\nfrom gbcourse import datasets\n\ngrid = np.linspace(0, 10, 201)[:, None]\npreds = []\n' +
      'for seed in ' + JSON.stringify(s.seeds.map((v) => 100 + v)) + ':\n    X, y = datasets.regression_1d(kind="sine", n=40, noise=0.45, seed=seed)\n    t = DecisionTreeRegressor(max_depth=' + s.depth + ').fit(X, y)\n' +
      '    preds.append(t.predict(grid))\n    print(f"seed {seed}: порог корня {t.tree_.threshold[0]:.2f}, прогноз при x=5: {t.predict([[5.0]])[0]:+.3f}")\n' +
      'preds = np.array(preds)\nprint("разброс прогноза при x = 5 (ст. отклонение):", preds[:, 100].std())\n'
    );
    draw();
  });

  /* =================================================================================
   * residual-preview — мостик к бустингу: много слабых деревьев подряд
   * ================================================================================= */
  GBC.widget('residual-preview', (el) => {
    const s = { m: 1, nu: 0.5, depth: 1 };
    const MAXM = 40;
    const w = ui.shell(el, { title: 'Анонс модуля 4: складываем маленькие деревья', sub: 'Каждое следующее дерево учится не на y, а на остатках — на том, что предыдущие ещё не объяснили. Вверху — сумма деревьев, внизу — остатки и очередное дерево.' });
    const player = ui.player(w.main, { label: 'Деревьев', min: 1, max: MAXM, value: s.m, fps: 4, format: (v) => 'деревьев: ' + v, onChange: (v) => ((s.m = v), draw()) });
    ui.segmented(w.controls, { label: 'Глубина каждого дерева', options: [{ value: 1, label: '1 (пень)' }, { value: 2, label: '2' }], value: s.depth, onChange: (v) => ((s.depth = v), fit()) });
    ui.segmented(w.controls, { label: 'Доля шага ν', options: [{ value: 0.1, label: '0.1' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }], value: s.nu, onChange: (v) => ((s.nu = v), fit()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'x', domain: [0, 10] }, y: { label: 'остаток' } });
    const stats = ui.stats(w.foot, [{ key: 'm', label: 'Деревьев в сумме' }, { key: 'mse', label: 'MSE на обучении' }, { key: 'one', label: 'MSE одного такого дерева' }]);
    const data = GBC.datasets.regression1d({ kind: 'sine', n: 60, noise: 0.25, seed: 3 });
    const grid = U.linspace(0, 10, 300);
    let stages;
    function fit() {
      let F = data.y.map(() => mean(data.y));
      let G = grid.map(() => mean(data.y));
      stages = [];
      for (let m = 0; m < MAXM; m++) {
        const r = data.y.map((v, i) => v - F[i]);
        const t = new GBC.RegressionTree({ maxDepth: s.depth }).fit(data.X, r.map((v) => -v));
        const before = G.slice();
        F = F.map((v, i) => v + s.nu * t.predictOne(data.X[i]));
        G = G.map((v, i) => v + s.nu * t.predictOne([grid[i]]));
        stages.push({ r, tree: t, before, after: G.slice(), mse: GBC.metrics.mse(data.y, F) });
      }
      draw();
    }
    function draw() {
      const st = stages[s.m - 1];
      p1.render([
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3.6, label: 'данные' },
        { type: 'line', x: grid, y: st.before, color: 'model-prev', width: 1.6, label: 'сумма до этого дерева', curve: 'step' },
        { type: 'line', x: grid, y: st.after, color: 'model', width: 2.4, label: 'сумма ' + s.m + ' деревьев', curve: 'step' },
      ]);
      p2.render([
        { type: 'hline', y: 0, color: 'truth', width: 1 },
        { type: 'points', x: data.x, y: st.r, color: 'residual', r: 3.4, label: 'остатки y − сумма' },
        { type: 'steps', segments: st.tree.segments1d(0, 10), color: 'tree', width: 2.4, label: 'дерево №' + s.m + ' (учится на остатках)' },
      ]);
      const single = new GBC.RegressionTree({ maxDepth: s.depth }).fit(data.X, data.y.map((v) => -v));
      stats.set('m', String(s.m));
      stats.set('mse', U.fmt(st.mse, 4));
      stats.set('one', U.fmt(GBC.metrics.mse(data.y, single.predict(data.X)), 4));
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom sklearn.tree import DecisionTreeRegressor\nfrom gbcourse import datasets\n\nX, y = datasets.regression_1d(kind="sine", n=60, noise=0.25, seed=3)\nnu, F = ' + U.pyNum(s.nu) + ', np.full(len(y), y.mean())\n' +
      'for m in range(1, ' + (s.m + 1) + '):\n    residual = y - F                                   # что ещё не объяснено\n    tree = DecisionTreeRegressor(max_depth=' + s.depth + ').fit(X, residual)\n' +
      '    F += nu * tree.predict(X)                          # добавляем долю нового дерева\n    print(f"деревьев {m:2d}: MSE = {np.mean((y - F) ** 2):.4f}")\n'
    );
    void player;
    fit();
  });
})();
