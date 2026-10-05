/* Урок 2.2, дополнение: критерии руками на восьми квартирах, геометрия выигрыша, три класса. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const FLATS = { area: [30, 35, 42, 50, 62, 70, 78, 90], dist: [12, 3, 9, 4, 10, 2, 8, 3], sold: [0, 1, 0, 1, 0, 1, 1, 1] };
  const FEATS = [{ name: 'площадь', unit: 'м²', col: FLATS.area, domain: [25, 95], py: 'area' }, { name: 'до центра', unit: 'км', col: FLATS.dist, domain: [0, 14], py: 'dist' }];
  const CRIT = {
    gini: { label: 'Джини', f: (p) => 2 * p * (1 - p), py: '2 * p * (1 - p)' },
    entropy: { label: 'Энтропия', f: (p) => (p <= 0 || p >= 1 ? 0 : -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p))), py: '0.0 if p in (0, 1) else -(p * np.log2(p) + (1 - p) * np.log2(1 - p))' },
    error: { label: 'Доля ошибок', f: (p) => Math.min(p, 1 - p), py: 'min(p, 1 - p)' },
  };
  const critOptions = Object.entries(CRIT).map(([value, c]) => ({ value, label: c.label }));
  const share = (rows) => (rows.length ? U.sum(rows.map((i) => FLATS.sold[i])) / rows.length : 0);

  function candidates(f, crit) {
    const col = FEATS[f].col;
    const vals = Array.from(new Set(col)).sort((a, b) => a - b);
    const all = U.range(8);
    const I = CRIT[crit].f;
    const out = [];
    for (let k = 0; k + 1 < vals.length; k++) {
      const t = (vals[k] + vals[k + 1]) / 2;
      const L = all.filter((i) => col[i] <= t);
      const R = all.filter((i) => col[i] > t);
      const after = (L.length * I(share(L)) + R.length * I(share(R))) / 8;
      out.push({ t, L, R, pL: share(L), pR: share(R), after, gain: I(share(all)) - after });
    }
    return out;
  }

  /* --------------------------------------------------------------- class-split */
  GBC.widget('class-split', (el) => {
    const s = { f: 1, crit: 'gini', t: 6.5 };
    const w = ui.shell(el, { title: 'Критерий руками: продадут ли квартиру за месяц', sub: 'Восемь квартир из обзора модуля; оранжевые квадраты — продали (класс 1), синие круги — нет (класс 0). Перетащите порог и следите за долями классов слева и справа.' });
    ui.segmented(w.controls, { label: 'Признак', options: [{ value: 0, label: 'Площадь' }, { value: 1, label: 'До центра' }], value: s.f, onChange: (v) => ((s.f = v), (s.t = candidates(s.f, s.crit)[2].t), draw()) });
    ui.select(w.controls, { label: 'Мера неоднородности', options: critOptions, value: s.crit, onChange: (v) => ((s.crit = v), draw()) });
    ui.button(w.controls, { label: 'Поставить лучший порог', kind: 'primary', small: true, onClick: () => { const c = candidates(s.f, s.crit); s.t = c.reduce((a, b) => (b.gain > a.gain + 1e-12 ? b : a)).t; draw(); } });
    const plot = new GBC.Plot(w.main, { height: 190, grid: 'x', x: { label: 'x', domain: [0, 14] }, y: { label: 'класс', domain: [-0.6, 1.6], ticks: [0, 1] } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'parent', label: 'Неоднородность до' }, { key: 'l', label: 'Слева' }, { key: 'r', label: 'Справа' }, { key: 'after', label: 'После (взвешенная)' }, { key: 'gain', label: 'Уменьшение' }]);
    function draw() {
      const ft = FEATS[s.f];
      const I = CRIT[s.crit].f;
      const cands = candidates(s.f, s.crit);
      const cur = cands.reduce((a, c) => (Math.abs(c.t - s.t) < Math.abs(a.t - s.t) ? c : a));
      s.t = cur.t;
      const layers = [{ type: 'vband', x0: ft.domain[0], x1: s.t, color: 'accent', opacity: 0.06 }];
      for (const c of [0, 1]) {
        const idx = U.range(8).filter((i) => FLATS.sold[i] === c);
        layers.push({ type: 'points', x: idx.map((i) => ft.col[i]), y: idx.map(() => c), color: 'class' + c, r: 6.5, shape: c ? 'square' : 'circle', label: c ? 'продали (1)' : 'не продали (0)', tooltip: (j) => [{ label: 'квартира', value: '№' + (idx[j] + 1) }, { label: ft.name, value: ft.col[idx[j]] + ' ' + ft.unit }] });
      }
      layers.push({ type: 'vline', x: s.t, color: 'ink', width: 2, draggable: true, text: ft.name + ' ≤ ' + U.fmt(s.t, 1), onDrag: (v) => { const near = cands.reduce((a, c) => (Math.abs(c.t - v) < Math.abs(a.t - v) ? c : a)); if (near.t !== s.t) { s.t = near.t; draw(); } } });
      plot.opts.x.label = ft.name + ', ' + ft.unit;
      plot.render(layers, { x: ft.domain });
      let bi = 0;
      cands.forEach((c, i) => (c.gain > cands[bi].gain + 1e-12 ? (bi = i) : 0));
      tableBox.textContent = '';
      ui.table(tableBox, {
        columns: ['порог', 'слева: 1 из n', 'справа: 1 из n', 'после', 'уменьшение'],
        rows: cands.map((c) => [(c.t === s.t ? '▸ ' : '') + '≤ ' + U.fmt(c.t, 1), Math.round(c.pL * c.L.length) + ' из ' + c.L.length, Math.round(c.pR * c.R.length) + ' из ' + c.R.length, c.after.toFixed(3), c.gain.toFixed(3)]),
        highlight: (i) => i === bi,
      });
      const p0 = share(U.range(8));
      const one = (rows, p) => Math.round(p * rows.length) + ' из ' + rows.length + ' (p = ' + U.fmt(p, 2) + ')';
      note.innerHTML = 'Слева класс 1 у ' + one(cur.L, cur.pL) + ', справа — у ' + one(cur.R, cur.pR) + '. Взвешенная неоднородность: ' + cur.L.length + '/8 · ' + I(cur.pL).toFixed(3) + ' + ' + cur.R.length + '/8 · ' + I(cur.pR).toFixed(3) + ' = <b>' + cur.after.toFixed(3) + '</b>.' +
        (cur.gain < 1e-9 ? ' <b>Уменьшение нулевое</b> — по этой мере вопрос бесполезен.' : cur.after < 1e-9 ? ' <b>Обе группы чистые</b> — идеальный вопрос.' : '');
      stats.set('parent', I(p0).toFixed(3));
      stats.set('l', I(cur.pL).toFixed(3));
      stats.set('r', I(cur.pR).toFixed(3));
      stats.set('after', cur.after.toFixed(3));
      stats.set('gain', cur.gain.toFixed(3));
    }
    w.pythonAction(() =>
      'import numpy as np\n\narea = np.array([30, 35, 42, 50, 62, 70, 78, 90])\ndist = np.array([12, 3, 9, 4, 10, 2, 8, 3])\nsold = np.array([0, 1, 0, 1, 0, 1, 1, 1])     # 1 — продали за месяц\n\n' +
      'impurity = lambda p: ' + CRIT[s.crit].py + '   # ' + CRIT[s.crit].label + '\ncol = ' + FEATS[s.f].py + '\nvals = np.unique(col)\nfor t in (vals[:-1] + vals[1:]) / 2:\n    L, R = sold[col <= t], sold[col > t]\n' +
      '    after = (len(L) * impurity(L.mean()) + len(R) * impurity(R.mean())) / len(sold)\n    print(f"<= {t:5.1f}: слева {L.sum()} из {len(L)}, справа {R.sum()} из {len(R)}, после {after:.3f}, уменьшение {impurity(sold.mean()) - after:.3f}")\n'
    );
    draw();
  });

  /* --------------------------------------------------------------- concavity */
  GBC.widget('concavity', (el) => {
    const s = { pL: 0, pR: 0.33, wL: 0.4, crit: 'gini' };
    const w = ui.shell(el, { title: 'Откуда берётся выигрыш: кривая и хорда', sub: 'Точки на кривой — левый и правый узлы. Родитель лежит между ними. Неоднородность родителя — на кривой, взвешенная неоднородность детей — на хорде. Зазор между ними и есть выигрыш.' });
    ui.select(w.controls, { label: 'Мера неоднородности', options: critOptions, value: s.crit, onChange: (v) => ((s.crit = v), draw()) });
    ui.slider(w.controls, { label: 'Доля класса 1 слева, p_L', min: 0, max: 1, step: 0.01, value: s.pL, onInput: (v) => ((s.pL = v), draw()) });
    ui.slider(w.controls, { label: 'Доля класса 1 справа, p_R', min: 0, max: 1, step: 0.01, value: s.pR, onInput: (v) => ((s.pR = v), draw()) });
    ui.slider(w.controls, { label: 'Доля объектов слева', min: 0.05, max: 0.95, step: 0.01, value: s.wL, onInput: (v) => ((s.wL = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'доля класса 1 в узле, p', domain: [0, 1] }, y: { label: 'неоднородность' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'p', label: 'p родителя' }, { key: 'par', label: 'Неоднородность родителя' }, { key: 'kids', label: 'Детей (взвешенная)' }, { key: 'gain', label: 'Выигрыш' }]);
    function draw() {
      const I = CRIT[s.crit].f;
      const p = s.wL * s.pL + (1 - s.wL) * s.pR;
      const kids = s.wL * I(s.pL) + (1 - s.wL) * I(s.pR);
      const ps = U.linspace(0, 1, 201);
      plot.render([
        { type: 'line', x: ps, y: ps.map(I), color: 'model', width: 2.2, label: CRIT[s.crit].label },
        { type: 'line', x: [s.pL, s.pR], y: [I(s.pL), I(s.pR)], color: 'tree', width: 2, dash: '6 4', label: 'хорда между детьми' },
        { type: 'segments', x1: [p], y1: [kids], x2: [p], y2: [I(p)], color: 'good', width: 4, label: 'выигрыш' },
        { type: 'points', x: [s.pL, s.pR], y: [I(s.pL), I(s.pR)], color: 'tree', r: 6, label: 'левый и правый узлы' },
        { type: 'points', x: [p], y: [I(p)], color: 'model', r: 6, label: 'родитель' },
        { type: 'points', x: [p], y: [kids], color: 'ink', r: 5, label: 'дети (взвешенно)' },
      ], { y: [0, s.crit === 'entropy' ? 1.05 : 0.55] });
      const gain = I(p) - kids;
      const sameSide = (s.pL - 0.5) * (s.pR - 0.5) >= 0;
      note.innerHTML = gain < 1e-9
        ? (s.crit === 'error' && sameSide && Math.abs(s.pL - s.pR) > 1e-9
          ? '<b>Выигрыш ноль, хотя узлы стали чище.</b> Доля ошибок — ломаная из двух прямых. Пока оба ребёнка по одну сторону от 0.5, хорда лежит на самой линии. Переключите меру на Джини: зазор появится.'
          : 'Дети не отличаются от родителя (p_L = p_R) — разбиение ничего не дало ни по какой мере.')
        : 'Кривая выгнута вверх, поэтому хорда всегда проходит <em>под</em> ней: любое разбиение с разными долями в детях даёт выигрыш <b>' + gain.toFixed(3) + '</b>. Чем дальше дети друг от друга по горизонтали, тем больше зазор.';
      stats.set('p', U.fmt(p, 3));
      stats.set('par', I(p).toFixed(3));
      stats.set('kids', kids.toFixed(3));
      stats.set('gain', gain.toFixed(3));
    }
    w.pythonAction(() =>
      'import numpy as np\n\nimpurity = lambda p: ' + CRIT[s.crit].py + '   # ' + CRIT[s.crit].label + '\np_left, p_right, w_left = ' + U.pyNum(s.pL) + ', ' + U.pyNum(s.pR) + ', ' + U.pyNum(s.wL) + '\n' +
      'p_parent = w_left * p_left + (1 - w_left) * p_right\nchildren = w_left * impurity(p_left) + (1 - w_left) * impurity(p_right)\nprint("родитель:", round(impurity(p_parent), 4))\nprint("дети:    ", round(children, 4))\nprint("выигрыш: ", round(impurity(p_parent) - children, 4))\n'
    );
    draw();
  });

  /* --------------------------------------------------------------- multiclass-impurity */
  GBC.widget('multiclass-impurity', (el) => {
    const s = { n: [10, 6, 4] };
    const NAMES = ['класс A', 'класс B', 'класс C'];
    const w = ui.shell(el, { title: 'Три класса в одном узле', sub: 'Задайте, сколько объектов каждого класса попало в узел. Формулы те же, только слагаемых три.' });
    s.n.forEach((v, k) => ui.slider(w.controls, { label: 'Объектов: ' + NAMES[k], min: 0, max: 20, step: 1, value: v, format: String, onInput: (q) => ((s.n[k] = q), draw()) }));
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'класс', domain: [-0.6, 2.6], ticks: [0, 1, 2], format: (v) => NAMES[v] || '' }, y: { label: 'доля в узле', domain: [0, 1] } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'g', label: 'Джини 1 − Σp²' }, { key: 'e', label: 'Энтропия, бит' }, { key: 'm', label: 'Доля ошибок 1 − max p' }, { key: 'pred', label: 'Прогноз узла' }]);
    function draw() {
      const tot = U.sum(s.n);
      if (!tot) {
        note.textContent = 'В узле нет объектов — добавьте хотя бы один.';
        return;
      }
      const p = s.n.map((v) => v / tot);
      const gini = 1 - U.sum(p.map((v) => v * v));
      const ent = -U.sum(p.map((v) => (v > 0 ? v * Math.log2(v) : 0)));
      const err = 1 - Math.max(...p);
      plot.render([{ type: 'bars', x: [0, 1, 2], y: p, width: 0.6, maxPx: 70, color: (k) => 'class' + k, label: 'доли классов', tooltip: (k) => [{ label: NAMES[k], value: s.n[k] + ' из ' + tot }, { label: 'доля', value: U.fmt(p[k], 3) }] }]);
      const best = p.indexOf(Math.max(...p));
      note.innerHTML = 'Доли: ' + p.map((v, k) => NAMES[k].slice(-1) + ' = ' + s.n[k] + '/' + tot + ' = ' + U.fmt(v, 2)).join(', ') + '.<br>Джини: 1 − (' + p.map((v) => U.fmt(v, 2) + '²').join(' + ') + ') = <b>' + gini.toFixed(3) + '</b>. ' +
        (gini < 1e-9 ? 'Узел чистый — все меры равны нулю.' : Math.abs(gini - 2 / 3) < 0.01 ? 'Классы поровну — неоднородность наибольшая: Джини 2/3, энтропия log₂3 ≈ 1.585.' : 'Наибольшие значения при трёх классах: Джини 2/3, энтропия log₂3 ≈ 1.585 бита.');
      stats.set('g', gini.toFixed(3));
      stats.set('e', ent.toFixed(3));
      stats.set('m', err.toFixed(3));
      stats.set('pred', NAMES[best] + ' (p = ' + U.fmt(p[best], 2) + ')');
    }
    w.pythonAction(() =>
      'import numpy as np\n\ncounts = np.array(' + JSON.stringify(s.n) + ')            # объектов классов A, B, C в узле\np = counts / counts.sum()\nnz = p[p > 0]\nprint("доли:        ", p.round(3))\n' +
      'print("Джини:       ", round(1 - (p ** 2).sum(), 3))\nprint("энтропия:    ", round(-(nz * np.log2(nz)).sum(), 3))\nprint("доля ошибок: ", round(1 - p.max(), 3))\n'
    );
    draw();
  });
})();
