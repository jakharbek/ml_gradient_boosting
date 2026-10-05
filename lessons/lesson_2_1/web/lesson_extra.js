/* Урок 2.1, дополнение: проход по шагам, турнир признаков, выигрыш на шуме, тренажёр. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const FLATS = { area: [30, 35, 42, 50, 62, 70, 78, 90], dist: [12, 3, 9, 4, 10, 2, 8, 3], price: [3.0, 5.0, 3.6, 5.8, 7.0, 9.6, 7.8, 10.6] };

  /** Один проход по отсортированным точкам: для каждой границы k — накопленные суммы и выигрыш. */
  function scan(x, y) {
    const order = U.argsort(x);
    const xs = order.map((i) => x[i]);
    const ys = order.map((i) => y[i]);
    const n = ys.length;
    const S = U.sum(ys);
    let SL = 0;
    const rows = [];
    for (let k = 0; k + 1 < n; k++) {
      SL += ys[k];
      const nL = k + 1;
      const nR = n - nL;
      const SR = S - SL;
      rows.push({ k, t: (xs[k] + xs[k + 1]) / 2, nL, nR, SL, SR, score: (SL * SL) / nL + (SR * SR) / nR, gain: (SL * SL) / nL + (SR * SR) / nR - (S * S) / n, valid: xs[k] < xs[k + 1] });
    }
    let best = null;
    for (const r of rows) if (r.valid && (!best || r.gain > best.gain)) best = r;
    return { xs, ys, n, S, rows, best, sse0: U.sum(ys.map((v) => (v - S / n) ** 2)) };
  }

  /* --------------------------------------------------------------- scan-steps */
  GBC.widget('scan-steps', (el) => {
    const SETS = {
      toy: { label: '6 точек: x = 1…6', x: [1, 2, 3, 4, 5, 6], y: [2, 4, 3, 7, 9, 11], xl: 'x', yl: 'y' },
      area: { label: '8 квартир: площадь', x: FLATS.area, y: FLATS.price, xl: 'площадь, м²', yl: 'цена, млн' },
      dist: { label: '8 квартир: до центра (есть одинаковые значения)', x: FLATS.dist, y: FLATS.price, xl: 'до центра, км', yl: 'цена, млн' },
    };
    const s = { set: 'toy', k: 0 };
    const w = ui.shell(el, { title: 'Один проход слева направо', sub: 'Каждый шаг переносит одну точку из правой части в левую: к сумме слева прибавляется её y, из суммы справа вычитается. Средние заново не считаются.' });
    ui.select(w.controls, { label: 'Данные', options: Object.entries(SETS).map(([value, d]) => ({ value, label: d.label })), value: s.set, onChange: (v) => ((s.set = v), (s.k = 0), load()) });
    const player = ui.player(w.main, { label: 'Шаг', min: 0, max: 4, value: 0, fps: 1.5, format: (v, m) => 'шаг ' + (v + 1) + ' из ' + (m + 1), onChange: (v) => ((s.k = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'x' }, y: { label: 'y' } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'S', label: 'Сумма всех y, S' }, { key: 'base', label: 'S²/n' }, { key: 'cur', label: 'Выигрыш на этом шаге' }, { key: 'best', label: 'Лучший из просмотренных' }]);
    let sc;
    function load() {
      const d = SETS[s.set];
      sc = scan(d.x, d.y);
      p1.opts.x.label = d.xl;
      p1.opts.y.label = d.yl;
      s.k = 0;
      player.setMax(sc.rows.length - 1);
      player.set(0);
      draw();
    }
    function draw() {
      if (!sc) return;
      const r = sc.rows[Math.min(s.k, sc.rows.length - 1)];
      const seen = sc.rows.slice(0, r.k + 1).filter((q) => q.valid);
      let best = null;
      for (const q of seen) if (!best || q.gain > best.gain) best = q;
      const pad = (sc.xs[sc.n - 1] - sc.xs[0]) * 0.08;
      p1.render([
        { type: 'vband', x0: sc.xs[0] - pad, x1: r.t, color: 'class0', opacity: 0.08 },
        { type: 'points', x: sc.xs, y: sc.ys, r: 5.5, color: (i) => (i <= r.k ? 'class0' : 'class1'), legendColor: 'data', label: 'точки по возрастанию x', highlight: r.k },
        { type: 'line', x: [sc.xs[0] - pad, r.t], y: [r.SL / r.nL, r.SL / r.nL], color: 'model', width: 2.4, label: 'среднее слева' },
        { type: 'line', x: [r.t, sc.xs[sc.n - 1] + pad], y: [r.SR / r.nR, r.SR / r.nR], color: 'tree', width: 2.4, label: 'среднее справа' },
        { type: 'vline', x: r.t, color: 'ink', width: 2, dash: r.valid ? null : '4 3', text: r.valid ? 't = ' + U.fmt(r.t, 1) : 'порог невозможен' },
      ], { x: [sc.xs[0] - pad, sc.xs[sc.n - 1] + pad] });
      tableBox.textContent = '';
      ui.table(tableBox, {
        columns: ['шаг', 't', 'n_L', 'S_L', 'n_R', 'S_R', 'выигрыш Δ'],
        rows: sc.rows.slice(0, r.k + 1).map((q) => [String(q.k + 1), q.valid ? U.fmt(q.t, 1) : '—', String(q.nL), U.fmt(q.SL, 1), String(q.nR), U.fmt(q.SR, 1), q.valid ? q.gain.toFixed(2) : 'пропуск']),
        highlight: (i) => best && sc.rows[i].k === best.k,
      });
      const moved = sc.ys[r.k];
      note.innerHTML = (r.k === 0 ? 'Начало: слева одна точка. ' : 'Точка с y = ' + U.fmt(moved, 1) + ' переехала налево: S_L = ' + U.fmt(r.SL - moved, 1) + ' + ' + U.fmt(moved, 1) + ' = <b>' + U.fmt(r.SL, 1) + '</b>, S_R = ' + U.fmt(sc.S, 1) + ' − ' + U.fmt(r.SL, 1) + ' = <b>' + U.fmt(r.SR, 1) + '</b>. ') +
        (r.valid
          ? 'Выигрыш: ' + U.fmt(r.SL, 1) + '²/' + r.nL + ' + ' + U.fmt(r.SR, 1) + '²/' + r.nR + ' − ' + U.fmt(sc.S, 1) + '²/' + sc.n + ' = <b>' + r.gain.toFixed(2) + '</b>.'
          : '<b>Порог поставить нельзя:</b> у следующей точки то же значение x = ' + U.fmt(sc.xs[r.k], 1) + ', разделить их вопросом «x ≤ t» невозможно. Суммы обновляем, кандидата пропускаем.') +
        (r.k === sc.rows.length - 1 ? ' <b>Проход окончен:</b> лучший порог t = ' + U.fmt(sc.best.t, 1) + '.' : '');
      stats.set('S', U.fmt(sc.S, 1));
      stats.set('base', ((sc.S * sc.S) / sc.n).toFixed(2));
      stats.set('cur', r.valid ? r.gain.toFixed(2) : '—');
      stats.set('best', best ? 't = ' + U.fmt(best.t, 1) + ' (Δ = ' + best.gain.toFixed(2) + ')' : '—');
    }
    w.pythonAction(() => {
      const d = SETS[s.set];
      return 'import numpy as np\n\nx = np.array(' + JSON.stringify(d.x) + ', dtype=float)\ny = np.array(' + JSON.stringify(d.y) + ', dtype=float)\n\norder = np.argsort(x, kind="stable")\nxs, ys = x[order], y[order]\nn, S, SL = len(ys), ys.sum(), 0.0\n' +
        'for k in range(n - 1):\n    SL += ys[k]                      # точка k переехала налево\n    nL, SR = k + 1, S - SL\n    if xs[k] == xs[k + 1]:\n        print(f"шаг {k + 1}: одинаковые x — порог невозможен")\n        continue\n' +
        '    gain = SL**2 / nL + SR**2 / (n - nL) - S**2 / n\n    print(f"шаг {k + 1}: t = {(xs[k] + xs[k + 1]) / 2:5.1f}, S_L = {SL:5.1f}, S_R = {SR:5.1f}, выигрыш = {gain:6.2f}")\n';
    });
    load();
  });

  /* --------------------------------------------------------------- feature-race */
  GBC.widget('feature-race', (el) => {
    const s = { n: 200, noise: 1, seed: 1, f: 3 };
    const w = ui.shell(el, { title: 'Турнир признаков: кто станет корнем', sub: 'Десять признаков; ответ зависит только от первых пяти (x₀…x₄), остальные пять — шум. Для каждого найден лучший порог. Кликните по столбцу — внизу его кривая выигрыша.' });
    ui.slider(w.controls, { label: 'Объектов n', min: 30, max: 600, step: 10, value: s.n, format: String, onInput: (v) => ((s.n = v), refit()) });
    ui.slider(w.controls, { label: 'Шум σ', min: 0, max: 5, step: 0.25, value: s.noise, onInput: (v) => ((s.noise = v), refit()) });
    ui.slider(w.controls, { label: 'Показать кривую признака', min: 0, max: 9, step: 1, value: s.f, format: (v) => 'x' + v, onInput: (v) => ((s.f = v), draw()) });
    ui.button(w.controls, { label: 'Новая выборка', kind: 'primary', small: true, onClick: () => ((s.seed += 1), fit()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'номер признака', domain: [-0.6, 9.6], ticks: U.range(10) }, y: { label: 'лучший выигрыш, % от SSE' }, onClick: (x) => ((s.f = U.clamp(Math.round(x), 0, 9)), draw()) });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'порог t', domain: [0, 1] }, y: { label: 'выигрыш, % от SSE' }, crosshair: true });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'win', label: 'Победитель' }, { key: 't', label: 'Его порог' }, { key: 'share', label: 'Убирает ошибки' }, { key: 'noise', label: 'Лучший из шумовых' }]);
    const refit = U.rafThrottle(() => fit());
    let scans;
    function fit() {
      const d = GBC.datasets.friedman1({ n: s.n, noise: s.noise, seed: 40 + s.seed });
      scans = U.range(10).map((j) => scan(d.X.map((r) => r[j]), d.y));
      draw();
    }
    function draw() {
      const pct = scans.map((sc) => (100 * sc.best.gain) / sc.sse0);
      let win = 0;
      pct.forEach((v, j) => (v > pct[win] ? (win = j) : 0));
      const noiseBest = Math.max(...pct.slice(5));
      p1.render([{ type: 'bars', x: U.range(10), y: pct, width: 0.7, color: (j) => (j === s.f ? 'tree' : j < 5 ? 'model' : 'residual'), label: 'лучший выигрыш признака', tooltip: (j) => [{ label: 'признак', value: 'x' + j + (j < 5 ? ' (влияет на ответ)' : ' (шум)') }, { label: 'лучший порог', value: U.fmt(scans[j].best.t, 3) }, { label: 'выигрыш', value: U.fmt(pct[j], 1) + '%' }] }]);
      const sc = scans[s.f];
      const v = sc.rows.filter((r) => r.valid);
      p2.render([
        { type: 'line', x: v.map((r) => r.t), y: v.map((r) => (100 * r.gain) / sc.sse0), color: s.f < 5 ? 'model' : 'residual', width: 1.8, label: 'x' + s.f + (s.f < 5 ? ' (влияет на ответ)' : ' (шумовой)') + ': выигрыш каждого порога' },
        { type: 'points', x: [sc.best.t], y: [(100 * sc.best.gain) / sc.sse0], color: 'tree', r: 5.5, label: 'лучший порог' },
      ]);
      note.innerHTML = 'Корнем станет <b>x' + win + '</b>: его лучший порог убирает ' + U.fmt(pct[win], 1) + '% ошибки. ' +
        (win >= 5 ? '<b>Победил шумовой признак</b> — при малом n или большом шуме такое случается.' : 'Шумовые признаки (серые) тоже дают ненулевой выигрыш — до ' + U.fmt(noiseBest, 1) + '%: это подгонка под случайность.');
      stats.set('win', 'x' + win);
      stats.set('t', U.fmt(scans[win].best.t, 3));
      stats.set('share', U.fmt(pct[win], 1) + '%');
      stats.set('noise', U.fmt(noiseBest, 1) + '%');
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets\n\nX, y = datasets.friedman1(n=' + s.n + ', noise=' + U.pyNum(s.noise) + ', seed=' + (40 + s.seed) + ')\nsse0 = ((y - y.mean()) ** 2).sum()\n\n' +
      'def best_split(x, y):\n    order = np.argsort(x, kind="stable")\n    xs, ys = x[order], y[order]\n    n, S = len(ys), ys.sum()\n    SL, nL = np.cumsum(ys)[:-1], np.arange(1, n)\n' +
      '    gain = SL**2 / nL + (S - SL)**2 / (n - nL) - S**2 / n\n    gain[xs[:-1] == xs[1:]] = -np.inf\n    k = int(np.argmax(gain))\n    return (xs[k] + xs[k + 1]) / 2, gain[k]\n\n' +
      'for j in range(X.shape[1]):\n    t, g = best_split(X[:, j], y)\n    print(f"x{j}: порог {t:.3f}, выигрыш {100 * g / sse0:5.1f}% от SSE" + ("" if j < 5 else "   (шумовой)"))\n'
    );
    fit();
  });

  /* --------------------------------------------------------------- noise-gain */
  GBC.widget('noise-gain', (el) => {
    const s = { n: 30, seed: 1 };
    const R = 300;
    const w = ui.shell(el, { title: 'Пень на чистом шуме', sub: 'Здесь y вообще не зависит от x. Но лучший из n − 1 порогов всё равно «находит» разницу средних. Справа — какой процент ошибки убирает лучший порог в 300 таких выборках.' });
    ui.slider(w.controls, { label: 'Объектов n', min: 6, max: 400, step: 2, value: s.n, format: String, onInput: (v) => ((s.n = v), refit()) });
    ui.button(w.controls, { label: 'Новая выборка', kind: 'primary', small: true, onClick: () => ((s.seed += 1), draw()) });
    const grid = H('div', { class: 'grid-2' });
    w.main.appendChild(grid);
    const p1 = new GBC.Plot(grid, { height: 250, x: { label: 'x', domain: [0, 10] }, y: { label: 'y (чистый шум)' } });
    const p2 = new GBC.Plot(grid, { height: 250, x: { label: 'выигрыш лучшего порога, % от SSE' }, y: { label: 'выборок из 300' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'one', label: 'Эта выборка' }, { key: 'avg', label: 'В среднем по 300' }, { key: 'max', label: 'Наибольший' }]);
    const refit = U.rafThrottle(() => draw());
    const sample = (seed) => {
      const rng = new GBC.RNG(seed);
      const x = U.range(s.n).map(() => rng.uniform(0, 10));
      const y = U.range(s.n).map(() => rng.normal());
      return { x, y };
    };
    function draw() {
      const d = sample(7000 + s.seed);
      const sc = scan(d.x, d.y);
      const b = sc.best;
      p1.render([
        { type: 'points', x: d.x, y: d.y, color: 'data', r: 3.6, label: 'данные' },
        { type: 'line', x: [0, b.t], y: [b.SL / b.nL, b.SL / b.nL], color: 'model', width: 2.4, label: 'среднее слева' },
        { type: 'line', x: [b.t, 10], y: [b.SR / b.nR, b.SR / b.nR], color: 'tree', width: 2.4, label: 'среднее справа' },
        { type: 'vline', x: b.t, color: 'ink', width: 1.6, text: 'лучший порог' },
      ]);
      const shares = U.range(R).map((r) => {
        const q = sample(90000 + 1000 * s.n + r);
        const qs = scan(q.x, q.y);
        return (100 * qs.best.gain) / qs.sse0;
      });
      const hi = Math.max(5, Math.ceil(Math.max(...shares) / 5) * 5);
      const nb = 20;
      const counts = new Array(nb).fill(0);
      shares.forEach((v) => (counts[Math.min(nb - 1, Math.floor((v / hi) * nb))] += 1));
      const one = (100 * b.gain) / sc.sse0;
      p2.render([
        { type: 'bars', x: U.range(nb).map((i) => ((i + 0.5) * hi) / nb), y: counts, width: (hi / nb) * 0.9, maxPx: 60, color: 'model', label: 'распределение по 300 выборкам' },
        { type: 'vline', x: Math.min(one, hi), color: 'tree', width: 2, text: 'эта выборка' },
      ], { x: [0, hi] });
      const avg = U.mean(shares);
      note.innerHTML = 'Сигнала нет, а лучший порог «убирает» в среднем <b>' + U.fmt(avg, 1) + '%</b> ошибки. Это цена перебора: из ' + (s.n - 1) + ' порогов какой-нибудь случайно окажется удачным. ' +
        (s.n <= 20 ? 'При маленьком n иллюзия особенно сильна.' : s.n >= 200 ? 'С ростом n иллюзия слабеет, но не исчезает.' : 'Увеличьте n — иллюзия ослабнет; уменьшите — усилится.');
      stats.set('one', U.fmt(one, 1) + '%');
      stats.set('avg', U.fmt(avg, 1) + '%');
      stats.set('max', U.fmt(Math.max(...shares), 1) + '%');
    }
    w.pythonAction(() =>
      'import numpy as np\n\ndef best_gain_share(x, y):\n    order = np.argsort(x)\n    ys = y[order]\n    n, S = len(ys), ys.sum()\n    SL, nL = np.cumsum(ys)[:-1], np.arange(1, n)\n' +
      '    gain = SL**2 / nL + (S - SL)**2 / (n - nL) - S**2 / n\n    return 100 * gain.max() / ((y - y.mean()) ** 2).sum()\n\nrng = np.random.default_rng(0)   # здесь воспроизводимость с браузером не нужна\n' +
      'for n in (10, ' + s.n + ', 1000):\n    shares = [best_gain_share(rng.uniform(0, 10, n), rng.normal(size=n)) for _ in range(300)]\n    print(f"n = {n:4d}: лучший порог на чистом шуме убирает в среднем {np.mean(shares):5.1f}% SSE")\n'
    );
    draw();
  });

  /* --------------------------------------------------------------- stump-trainer */
  GBC.widget('stump-trainer', (el) => {
    const s = { seed: 1, t: 5, shown: false, score: 0, tries: 0 };
    const w = ui.shell(el, { title: 'Тренажёр: найдите порог на глаз', sub: 'Поставьте линию туда, где, по-вашему, лучший порог, и нажмите «Проверить». Потом сравните с перебором.' });
    const bCheck = ui.button(w.controls, { label: 'Проверить', kind: 'primary', small: true, onClick: () => check() });
    ui.button(w.controls, { label: 'Новая задача', small: true, onClick: () => ((s.seed += 1), (s.shown = false), (s.t = 5), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'you', label: 'Ваш выигрыш' }, { key: 'best', label: 'Лучший возможный' }, { key: 'pct', label: 'Вы взяли от лучшего' }, { key: 'score', label: 'Средний результат' }]);
    function data() {
      const rng = new GBC.RNG(500 + s.seed);
      const n = 14 + rng.randint(10);
      const cut = rng.uniform(2.5, 7.5);
      const jump = rng.uniform(1.2, 3) * (rng.random() < 0.5 ? -1 : 1);
      const slope = rng.uniform(-0.25, 0.25);
      const x = U.range(n).map(() => rng.uniform(0.3, 9.7));
      const y = x.map((v) => (v > cut ? jump : 0) + slope * v + rng.normal(0, 0.7));
      return { x, y };
    }
    function gainAt(d, t) {
      const L = d.y.filter((_, i) => d.x[i] <= t);
      const Rr = d.y.filter((_, i) => d.x[i] > t);
      if (!L.length || !Rr.length) return 0;
      const S = U.sum(d.y);
      return (U.sum(L) ** 2) / L.length + (U.sum(Rr) ** 2) / Rr.length - (S * S) / d.y.length;
    }
    function check() {
      if (s.shown) return;
      const d = data();
      const sc = scan(d.x, d.y);
      s.shown = true;
      s.tries += 1;
      s.score += gainAt(d, s.t) / sc.best.gain;
      draw();
    }
    function draw() {
      const d = data();
      const sc = scan(d.x, d.y);
      const g = gainAt(d, s.t);
      const L = d.y.filter((_, i) => d.x[i] <= s.t);
      const Rr = d.y.filter((_, i) => d.x[i] > s.t);
      plot.render([
        { type: 'points', x: d.x, y: d.y, color: 'data', r: 4.5, label: 'данные' },
        L.length ? { type: 'line', x: [0, s.t], y: [U.mean(L), U.mean(L)], color: 'model', width: 2.4, label: 'среднее слева' } : null,
        Rr.length ? { type: 'line', x: [s.t, 10], y: [U.mean(Rr), U.mean(Rr)], color: 'tree', width: 2.4, label: 'среднее справа' } : null,
        s.shown ? { type: 'vline', x: sc.best.t, color: 'good', width: 2, dash: '5 4', text: 'лучший: ' + U.fmt(sc.best.t, 2) } : null,
        { type: 'vline', x: s.t, color: 'ink', width: 2, draggable: !s.shown, text: 'ваш порог ' + U.fmt(s.t, 2), onDrag: (v) => ((s.t = Math.round(v * 20) / 20), draw()) },
      ]);
      bCheck.disabled = s.shown;
      const pct = (100 * g) / sc.best.gain;
      note.innerHTML = s.shown
        ? (pct >= 99.5 ? '<b>Точно в цель!</b> ' : pct >= 90 ? '<b>Очень близко.</b> ' : pct >= 60 ? '<b>Неплохо.</b> ' : '<b>Мимо.</b> ') + 'Ваш порог взял ' + U.fmt(pct, 0) + '% возможного выигрыша. Лучший порог — ' + U.fmt(sc.best.t, 2) + ' (зелёный пунктир). Нажмите «Новая задача».'
        : 'Ищите место, где средний уровень точек меняется сильнее всего. Двигайте чёрную линию.';
      stats.set('you', s.shown ? g.toFixed(2) : '?');
      stats.set('best', s.shown ? sc.best.gain.toFixed(2) : '?');
      stats.set('pct', s.shown ? U.fmt(pct, 0) + '%' : '?');
      stats.set('score', s.tries ? U.fmt((100 * s.score) / s.tries, 0) + '% за ' + s.tries + ' задач' : '—');
    }
    draw();
  });
})();
