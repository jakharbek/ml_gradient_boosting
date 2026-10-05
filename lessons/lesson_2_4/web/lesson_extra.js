/* Урок 2.4, дополнение: значение листа при разных потерях, глубина и взаимодействия, смещение и разброс. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const mean = (a) => U.sum(a) / a.length;
  const quantile = (a, q) => {
    const v = a.slice().sort((x, y) => x - y);
    const pos = (v.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return v[lo] + (v[hi] - v[lo]) * (pos - lo);
  };

  /* --------------------------------------------------------------- leaf-loss */
  GBC.widget('leaf-loss', (el) => {
    const BASE = [2.1, 2.6, 3.0, 3.2, 3.9, 4.4];
    const LOSS = {
      l2: { label: 'Квадратичная', f: (r) => r * r, opt: (y) => mean(y), name: 'среднее' },
      l1: { label: 'Абсолютная', f: (r) => Math.abs(r), opt: (y) => quantile(y, 0.5), name: 'медиана' },
      q: { label: 'Квантильная', f: (r, tau) => (r >= 0 ? tau * r : (tau - 1) * r), opt: (y, tau) => quantile(y, tau), name: 'квантиль' },
    };
    const s = { loss: 'l2', out: 12, tau: 0.9 };
    const w = ui.shell(el, { title: 'Какое число записать в лист — зависит от функции потерь', sub: 'В лист попали семь объектов; седьмой можно сделать выбросом. Слева — объекты и лучшие константы, справа — суммарные потери как функция константы.' });
    ui.select(w.controls, { label: 'Функция потерь', options: Object.entries(LOSS).map(([value, l]) => ({ value, label: l.label })), value: s.loss, onChange: (v) => ((s.loss = v), sync(), draw()) });
    ui.slider(w.controls, { label: 'Значение седьмого объекта', min: 1, max: 30, step: 0.5, value: s.out, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.out = v), draw()) });
    const tauCtl = ui.slider(w.controls, { label: 'Уровень квантиля τ', min: 0.05, max: 0.95, step: 0.05, value: s.tau, onInput: (v) => ((s.tau = v), draw()) });
    const grid = H('div', { class: 'grid-2' });
    w.main.appendChild(grid);
    const p1 = new GBC.Plot(grid, { height: 260, x: { label: 'номер объекта в листе', domain: [0.4, 7.6], ticks: U.range(7, 1) }, y: { label: 'y' } });
    const p2 = new GBC.Plot(grid, { height: 260, x: { label: 'константа w' }, y: { label: 'сумма потерь в листе' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'mean', label: 'Среднее' }, { key: 'med', label: 'Медиана' }, { key: 'q', label: 'Квантиль τ' }, { key: 'opt', label: 'Лучшее значение листа' }]);
    function sync() {
      tauCtl.el.hidden = s.loss !== 'q';
    }
    function draw() {
      const y = BASE.concat([s.out]);
      const L = LOSS[s.loss];
      const total = (c) => U.sum(y.map((v) => L.f(v - c, s.tau)));
      const opt = L.opt(y, s.tau);
      const m = mean(y);
      const med = quantile(y, 0.5);
      const hi = Math.max(8, s.out + 1);
      p1.render([
        { type: 'points', x: U.range(7, 1), y, color: (i) => (i === 6 ? 'tree' : 'data'), legendColor: 'data', r: 5.5, label: 'объекты листа' },
        { type: 'hline', y: m, color: 'model', width: s.loss === 'l2' ? 2.8 : 1.4, dash: s.loss === 'l2' ? null : '5 4', text: 'среднее ' + U.fmt(m, 2) },
        { type: 'hline', y: med, color: 'test', width: s.loss === 'l1' ? 2.8 : 1.4, dash: s.loss === 'l1' ? null : '5 4', text: 'медиана ' + U.fmt(med, 2) },
        s.loss === 'q' ? { type: 'hline', y: opt, color: 'tree', width: 2.8, text: 'квантиль ' + U.fmt(s.tau, 2) + ': ' + U.fmt(opt, 2) } : null,
      ], { y: [0, hi] });
      const cs = U.linspace(0, hi, 241);
      p2.render([
        { type: 'line', x: cs, y: cs.map(total), color: 'model', width: 2.2, label: 'потери: ' + L.label.toLowerCase() },
        { type: 'points', x: [opt], y: [total(opt)], color: 'tree', r: 6, label: 'минимум — ' + L.name },
      ], { x: [0, hi] });
      note.innerHTML = s.loss === 'l2'
        ? 'Квадратичные потери: лучшая константа — <b>среднее ' + U.fmt(m, 2) + '</b>. ' + (s.out > 8 ? 'Выброс утащил его вверх: шесть «обычных» объектов лежат между 2.1 и 4.4, а лист предсказывает ' + U.fmt(m, 2) + '.' : 'Сдвиньте седьмой объект вверх — среднее поедет за ним.')
        : s.loss === 'l1'
          ? 'Абсолютные потери: лучшая константа — <b>медиана ' + U.fmt(med, 2) + '</b>, середина упорядоченного списка. Двигайте выброс: пока он остаётся самым большим, медиана не меняется.'
          : 'Квантильные потери с τ = ' + U.fmt(s.tau, 2) + ': недооценка штрафуется в ' + U.fmt(s.tau / (1 - s.tau), 1) + ' раз сильнее переоценки, и лучшая константа — <b>квантиль ' + U.fmt(opt, 2) + '</b>: ниже неё лежит примерно доля τ объектов.';
      stats.set('mean', U.fmt(m, 3));
      stats.set('med', U.fmt(med, 3));
      stats.set('q', U.fmt(quantile(y, s.tau), 3));
      stats.set('opt', U.fmt(opt, 3) + ' (' + L.name + ')');
    }
    w.pythonAction(() =>
      'import numpy as np\n\ny = np.array(' + JSON.stringify(BASE.concat([s.out])) + ')   # объекты одного листа\ntau = ' + U.pyNum(s.tau) + '\ngrid = np.linspace(0, y.max() + 1, 2001)\n' +
      'losses = {\n    "квадратичная": lambda r: r ** 2,\n    "абсолютная": lambda r: np.abs(r),\n    "квантильная": lambda r: np.where(r >= 0, tau * r, (tau - 1) * r),\n}\n' +
      'for name, f in losses.items():\n    total = [f(y - c).sum() for c in grid]\n    print(f"{name:13s}: лучшая константа {grid[int(np.argmin(total))]:.2f}")\nprint(f"среднее {y.mean():.2f}, медиана {np.median(y):.2f}, квантиль {tau}: {np.quantile(y, tau):.2f}")\n'
    );
    sync();
    draw();
  });

  /* --------------------------------------------------------------- interaction-depth */
  GBC.widget('interaction-depth', (el) => {
    const TARGETS = {
      add: { label: 'Сумма: f(x₀) + g(x₁)', f: (a, b) => Math.sin(2 * Math.PI * a) + 2 * (b - 0.5), py: 'np.sin(2 * np.pi * X[:, 0]) + 2 * (X[:, 1] - 0.5)' },
      mul: { label: 'Произведение: x₀ · x₁ со знаком', f: (a, b) => 8 * (a - 0.5) * (b - 0.5), py: '8 * (X[:, 0] - 0.5) * (X[:, 1] - 0.5)' },
    };
    const s = { target: 'mul', depth: 1, m: 60 };
    const MAXM = 150;
    const NG = 36;
    const w = ui.shell(el, { title: 'Глубина дерева = сколько признаков могут «договориться»', sub: 'Слева — истинная зависимость от двух признаков, справа — сумма деревьев. Сравните пни (глубина 1) и деревья глубины 2 на двух разных зависимостях.' });
    ui.select(w.controls, { label: 'Истинная зависимость', options: Object.entries(TARGETS).map(([value, t]) => ({ value, label: t.label })), value: s.target, onChange: (v) => ((s.target = v), draw()) });
    ui.segmented(w.controls, { label: 'Глубина каждого дерева', options: [{ value: 1, label: '1 (пни)' }, { value: 2, label: '2' }, { value: 3, label: '3' }], value: s.depth, onChange: (v) => ((s.depth = v), draw()) });
    ui.slider(w.controls, { label: 'Деревьев', min: 1, max: MAXM, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    const grid = H('div', { class: 'grid-2' });
    w.main.appendChild(grid);
    const opt = { height: 250, equal: true, grid: 'none', x: { label: 'x_0', domain: [0, 1] }, y: { label: 'x_1', domain: [0, 1] } };
    const p1 = new GBC.Plot(grid, Object.assign({ title: 'Истина' }, opt));
    const p2 = new GBC.Plot(grid, Object.assign({ title: 'Сумма деревьев' }, opt));
    const p3 = new GBC.Plot(w.main, { height: 180, x: { label: 'число деревьев', domain: [1, MAXM] }, y: { label: 'MSE на сетке' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'mse', label: 'MSE модели' }, { key: 'd1', label: 'Пни, ' + MAXM + ' деревьев' }, { key: 'd2', label: 'Глубина 2, ' + MAXM + ' деревьев' }]);
    const cache = {};
    const gx = U.range(NG).map((i) => i / (NG - 1));
    function fit(target, depth) {
      const key = target + depth;
      if (cache[key]) return cache[key];
      const rng = new GBC.RNG(21);
      const f = TARGETS[target].f;
      const X = U.range(300).map(() => [rng.random(), rng.random()]);
      const y = X.map((r) => f(r[0], r[1]) + rng.normal(0, 0.1));
      const truth = new Float64Array(NG * NG);
      for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) truth[j * NG + i] = f(gx[i], gx[j]);
      let F = y.map(() => mean(y));
      let G = new Float64Array(NG * NG).fill(mean(y));
      const stages = [];
      const mse = [];
      for (let m = 0; m < MAXM; m++) {
        const t = new GBC.RegressionTree({ maxDepth: depth }).fit(X, y.map((v, i) => F[i] - v));
        F = F.map((v, i) => v + 0.3 * t.predictOne(X[i]));
        const next = new Float64Array(NG * NG);
        let e = 0;
        for (let j = 0; j < NG; j++) {
          for (let i = 0; i < NG; i++) {
            const k = j * NG + i;
            next[k] = G[k] + 0.3 * t.predictOne([gx[i], gx[j]]);
            e += (next[k] - truth[k]) ** 2;
          }
        }
        G = next;
        stages.push(next);
        mse.push(e / (NG * NG));
      }
      return (cache[key] = { truth, stages, mse });
    }
    function draw() {
      const r = fit(s.target, s.depth);
      const div = GBC.colors.diverging();
      const colorFn = (v) => div(v / 2);
      const g = (values) => ({ x0: 0, x1: 1, y0: 0, y1: 1, nx: NG, ny: NG, values });
      p1.render([{ type: 'heatmap', grid: g(r.truth), colorFn, opacity: 0.95 }], { x: [0, 1], y: [0, 1] });
      p2.render([{ type: 'heatmap', grid: g(r.stages[s.m - 1]), colorFn, opacity: 0.95, smooth: false }], { x: [0, 1], y: [0, 1] });
      const ms = U.range(MAXM, 1);
      const a = fit(s.target, 1);
      const b = fit(s.target, 2);
      p3.render([
        { type: 'line', x: ms, y: a.mse, color: 'tree', width: 2, label: 'пни (глубина 1)' },
        { type: 'line', x: ms, y: b.mse, color: 'model', width: 2, label: 'глубина 2' },
        { type: 'vline', x: s.m, color: 'ink', width: 1.5, dash: '3 3' },
      ]);
      const stuck = a.mse[MAXM - 1] > 5 * b.mse[MAXM - 1];
      note.innerHTML = s.target === 'add'
        ? 'Зависимость — сумма двух отдельных функций. Пни справляются: каждый пень смотрит на один признак, а сумма пней складывает вклады признаков. Глубина 2 здесь почти ничего не добавляет.'
        : (s.depth === 1
          ? '<b>Пни не могут.</b> Влияние x₀ зависит от x₁: в нижней половине рост x₀ уменьшает ответ, в верхней — увеличивает. Пень видит один признак и «в среднем» не находит ничего. Сколько пней ни складывай — картинка остаётся плоской.'
          : 'Дерево глубины ' + s.depth + ' сначала спрашивает про один признак, а потом — уже внутри ветки — про другой. Так появляются четыре «квадранта» с разными знаками: взаимодействие поймано.') +
        (stuck ? ' Ошибка пней после ' + MAXM + ' деревьев — ' + U.fmt(a.mse[MAXM - 1], 3) + ', у глубины 2 — ' + U.fmt(b.mse[MAXM - 1], 3) + '.' : '');
      stats.set('mse', U.fmt(r.mse[s.m - 1], 4));
      stats.set('d1', U.fmt(a.mse[MAXM - 1], 4));
      stats.set('d2', U.fmt(b.mse[MAXM - 1], 4));
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom sklearn.ensemble import GradientBoostingRegressor\n\nrng = np.random.default_rng(0)   # здесь воспроизводимость с браузером не нужна\nX = rng.uniform(0, 1, (300, 2))\n' +
      'f = lambda X: ' + TARGETS[s.target].py + '\ny = f(X) + rng.normal(0, 0.1, 300)\nX_new = rng.uniform(0, 1, (2000, 2))\n\nfor depth in (1, 2, 3):\n' +
      '    gb = GradientBoostingRegressor(n_estimators=' + MAXM + ', learning_rate=0.3, max_depth=depth).fit(X, y)\n    print(f"глубина {depth}: MSE на новых точках {np.mean((f(X_new) - gb.predict(X_new)) ** 2):.4f}")\n'
    );
    draw();
  });

  /* --------------------------------------------------------------- depth-bias-variance */
  GBC.widget('depth-bias-variance', (el) => {
    const s = { depth: 1, noise: 0.4 };
    const MAXD = 8;
    const R = 40;
    const w = ui.shell(el, { title: 'Слабый и сильный ученик: смещение против разброса', sub: 'Сорок обучающих выборок из одной зависимости — сорок деревьев одной глубины. Тонкие линии — отдельные деревья, жирная — их среднее. Внизу — из чего складывается ошибка при каждой глубине.' });
    const dCtl = ui.slider(w.controls, { label: 'Глубина', min: 1, max: MAXD, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    ui.slider(w.controls, { label: 'Шум σ', min: 0.1, max: 1, step: 0.05, value: s.noise, onInput: (v) => ((s.noise = v), refit()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-2, 2] } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'глубина дерева', domain: [0.6, MAXD + 0.4], ticks: U.range(MAXD, 1) }, y: { label: 'вклад в ошибку' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'b', label: 'Смещение²' }, { key: 'v', label: 'Разброс' }, { key: 'sum', label: 'Сумма' }, { key: 'best', label: 'Лучшая глубина одного дерева' }]);
    const refit = U.rafThrottle(() => fit());
    const grid = U.linspace(0.1, 9.9, 80);
    const truth = grid.map((v) => Math.sin(v));
    let preds;
    let bias;
    let vari;
    function fit() {
      const sets = U.range(R).map((r) => GBC.datasets.regression1d({ kind: 'sine', n: 60, noise: s.noise, seed: 300 + r }));
      preds = U.range(MAXD).map((d) => sets.map((ds) => {
        const t = new GBC.RegressionTree({ maxDepth: d + 1 }).fit(ds.X, ds.y.map((v) => -v));
        return grid.map((v) => t.predictOne([v]));
      }));
      bias = preds.map((P) => mean(grid.map((_, i) => (mean(P.map((p) => p[i])) - truth[i]) ** 2)));
      vari = preds.map((P) => mean(grid.map((_, i) => {
        const col = P.map((p) => p[i]);
        const m = mean(col);
        return mean(col.map((v) => (v - m) ** 2));
      })));
      draw();
    }
    function draw() {
      const P = preds[s.depth - 1];
      const layers = [{ type: 'line', x: grid, y: truth, color: 'truth', dash: '5 4', width: 1.6, label: 'истинная f(x)', hover: false }];
      P.slice(0, 20).forEach((p) => layers.push({ type: 'line', x: grid, y: p, color: 'model-prev', width: 1, opacity: 0.55, curve: 'step', legend: false, hover: false }));
      layers.push({ type: 'line', x: grid, y: grid.map((_, i) => mean(P.map((p) => p[i]))), color: 'model', width: 2.6, label: 'среднее ' + R + ' деревьев' });
      p1.render(layers);
      const ds = U.range(MAXD, 1);
      const sum = bias.map((v, i) => v + vari[i]);
      let best = 0;
      sum.forEach((v, i) => (v < sum[best] ? (best = i) : 0));
      p2.render([
        { type: 'line', x: ds, y: bias, color: 'tree', width: 2, label: 'смещение²' },
        { type: 'line', x: ds, y: vari, color: 'test', width: 2, label: 'разброс' },
        { type: 'line', x: ds, y: sum, color: 'model', width: 2.4, label: 'сумма' },
        { type: 'vline', x: s.depth, color: 'ink', width: 2, draggable: true, text: 'глубина ' + s.depth, onDrag: (v) => ((s.depth = U.clamp(Math.round(v), 1, MAXD)), dCtl.set(s.depth), draw()) },
      ]);
      const b = bias[s.depth - 1];
      const v = vari[s.depth - 1];
      note.innerHTML = b > 2 * v
        ? '<b>Слабый ученик.</b> Все деревья похожи друг на друга (разброс ' + U.fmt(v, 3) + '), но их общее среднее далеко от истины (смещение² ' + U.fmt(b, 3) + '). Такую ошибку усреднением не убрать — зато её убирает бустинг, добавляя деревья на остатках.'
        : v > 2 * b
          ? '<b>Сильный, но нервный ученик.</b> В среднем деревья правы (смещение² ' + U.fmt(b, 3) + '), но каждое отдельное скачет вокруг истины (разброс ' + U.fmt(v, 3) + '). Такую ошибку убирает усреднение — бэггинг и случайный лес.'
          : 'Смещение и разброс сопоставимы (' + U.fmt(b, 3) + ' и ' + U.fmt(v, 3) + ') — для одиночного дерева это близко к лучшей глубине.';
      stats.set('b', U.fmt(b, 4));
      stats.set('v', U.fmt(v, 4));
      stats.set('sum', U.fmt(b + v, 4));
      stats.set('best', String(best + 1));
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom sklearn.tree import DecisionTreeRegressor\nfrom gbcourse import datasets\n\ngrid = np.linspace(0.1, 9.9, 80)[:, None]\ntruth = np.sin(grid).ravel()\n' +
      'for depth in range(1, ' + (MAXD + 1) + '):\n    preds = []\n    for r in range(' + R + '):\n        X, y = datasets.regression_1d(kind="sine", n=60, noise=' + U.pyNum(s.noise) + ', seed=300 + r)\n' +
      '        preds.append(DecisionTreeRegressor(max_depth=depth).fit(X, y).predict(grid))\n    preds = np.array(preds)\n    bias2 = np.mean((preds.mean(0) - truth) ** 2)\n    var = np.mean(preds.var(0))\n' +
      '    print(f"глубина {depth}: смещение² {bias2:.4f}, разброс {var:.4f}, сумма {bias2 + var:.4f}")\n'
    );
    fit();
  });
})();
