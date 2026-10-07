/* Урок 1.2 — функции потерь и лучшая константа:
 *   best-constant    — лучшая константа и «перетягивание каната»: каждая точка тянет прогноз силой −∂L/∂c;
 *   sensitivity      — как одна точка сдвигает лучшую константу (среднее, медиана, Хьюбер);
 *   promise-time     — несимметричная цена ошибки: сколько минут обещать клиенту (квантиль);
 *   pseudo-residuals — чему учится первое дерево бустинга при разных потерях;
 *   class-losses     — потери для классификации: 0–1, квадрат вероятности, log-loss. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  const LOSS_OPTIONS = [
    { value: 'squared', label: 'Квадратичная (L2)' },
    { value: 'absolute', label: 'Абсолютная (L1)' },
    { value: 'huber', label: 'Хьюбер' },
    { value: 'quantile', label: 'Квантильная' },
  ];
  const lossName = (key) => LOSS_OPTIONS.find((o) => o.value === key).label;
  /** Число со знаком; машинный ноль (1e−16) показываем как 0. */
  const signed = (v, d = 3) => (Math.abs(v) < 1e-9 ? '0' : (v > 0 ? '+' : '') + U.fmt(v, d));

  /** «Сила», с которой точка y тянет константу c: −∂L(y, c)/∂c = ψ(y − c). */
  function pull(key, r, p) {
    if (key === 'squared') return r;
    if (key === 'absolute') return r > 0 ? 1 : r < 0 ? -1 : 0;
    if (key === 'huber') return U.clamp(r, -p.delta, p.delta);
    return r > 0 ? p.alpha : r < 0 ? p.alpha - 1 : 0; // в самой точке берём 0 из отрезка [α − 1, α]
  }
  /** Точный минимизатор суммы потерь по константе. */
  function bestConst(key, ys, p) {
    if (key === 'squared') return U.mean(ys);
    if (key === 'absolute') return U.median(ys);
    const v = U.sortedNumbers(ys);
    if (key === 'quantile') return v[Math.max(0, Math.ceil(p.alpha * v.length - 1e-9) - 1)];
    // Хьюбер: сумма сил монотонно убывает по c — ищем ноль делением пополам
    let lo = v[0];
    let hi = v[v.length - 1];
    const force = (c) => U.sum(ys.map((y) => pull('huber', y - c, p)));
    for (let k = 0; k < 80; k++) {
      const mid = (lo + hi) / 2;
      if (force(mid) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  const total = (key, ys, c, p) => U.sum(GBC.losses.get(key, p).pointwise(ys, ys.map(() => c)));

  /* =================================================================================
   * best-constant — лучшая константа и перетягивание каната
   * ================================================================================= */
  GBC.widget('best-constant', (el) => {
    const base = [2.1, 2.9, 3.3, 3.8, 4.1, 4.4, 4.9, 5.6, 6.2];
    let ys = base.slice();
    const s = { loss: 'squared', c: 3, delta: 1, alpha: 0.9, forces: true };
    const p = () => ({ delta: s.delta, alpha: s.alpha });
    const w = ui.shell(el, {
      title: 'Какая константа лучше всего?',
      sub: 'Сверху — ответы y_i (точки и линию c можно перетаскивать). Оранжевые стрелки — силы: с какой силой каждая точка тянет прогноз c к себе. Снизу — суммарные потери; минимум там, где силы уравновешены.',
    });
    ui.select(w.controls, { label: 'Функция потерь', options: LOSS_OPTIONS, value: s.loss, onChange: (v) => ((s.loss = v), sync(), draw()) });
    const dCtl = ui.slider(w.controls, { label: 'δ (Хьюбер)', min: 0.2, max: 4, step: 0.1, value: s.delta, onInput: (v) => ((s.delta = v), draw()) });
    const aCtl = ui.slider(w.controls, { label: 'α (квантиль)', min: 0.05, max: 0.95, step: 0.05, value: s.alpha, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.alpha = v), draw()) });
    const cCtl = ui.slider(w.controls, { label: 'Ваш прогноз c', min: 0, max: 12, step: 0.01, value: s.c, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.c = v), draw()) });
    ui.toggle(w.controls, { label: 'Силы −∂L/∂c', checked: s.forces, onChange: (v) => ((s.forces = v), draw()) });
    const btns = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(btns);
    ui.button(btns, { label: 'В минимум', small: true, kind: 'primary', onClick: () => ((s.c = bestConst(s.loss, ys, p())), cCtl.set(s.c), draw()) });
    ui.button(btns, { label: 'Добавить выброс', small: true, onClick: () => ((ys = base.concat([11.5])), draw()) });
    ui.button(btns, { label: 'Сбросить', small: true, kind: 'ghost', onClick: () => ((ys = base.slice()), draw()) });
    function sync() {
      dCtl.el.hidden = s.loss !== 'huber';
      aCtl.el.hidden = s.loss !== 'quantile';
    }
    const top = new GBC.Plot(w.main, { height: 210, x: { label: 'значение y', domain: [0, 12] }, y: { domain: [-1.25, 1.25], hide: true }, grid: 'x' });
    const bottom = new GBC.Plot(w.main, { height: 220, x: { label: 'константа c', domain: [0, 12] }, y: { label: 'Σ L(y_i, c)' }, crosshair: true, crosshairTitle: (v) => 'c = ' + U.fmt(v, 2) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'mean', label: 'Среднее' }, { key: 'median', label: 'Медиана' }, { key: 'opt', label: 'Оптимум для потерь' }, { key: 'force', label: 'Сумма сил в c' }, { key: 'yours', label: 'Ваши потери / минимум' }]);
    const rowY = (i) => ((i % 3) - 1) * 0.5;
    function draw() {
      const P = p();
      const opt = bestConst(s.loss, ys, P);
      const optV = total(s.loss, ys, opt, P);
      const cs = U.linspace(0, 12, 481);
      const mean = U.mean(ys);
      const med = U.median(ys);
      const forces = ys.map((y) => pull(s.loss, y - s.c, P));
      const F = U.sum(forces);
      const layers = [
        { type: 'vline', x: mean, color: 'model', width: 1.4, dash: '5 4' },
        { type: 'vline', x: med, color: 'aqua', width: 1.4, dash: '2 3' },
        { type: 'text', items: [{ x: mean, y: 1.18, dx: 4, dy: 8, text: 'среднее' }, { x: med, y: -1.18, dx: 4, text: 'медиана' }] },
        { type: 'vline', x: s.c, color: 'ink', width: 2, draggable: true, onDrag: (v) => ((s.c = U.clamp(v, 0, 12)), cCtl.set(s.c), draw()) },
      ];
      if (s.forces) {
        const ax = { x1: [], y1: [], x2: [], y2: [] };
        ys.forEach((y, i) => {
          if (Math.abs(forces[i]) < 1e-9) return;
          ax.x1.push(s.c);
          ax.x2.push(s.c + forces[i]);
          ax.y1.push(rowY(i));
          ax.y2.push(rowY(i));
        });
        layers.push({ type: 'arrows', ...ax, color: 'tree', width: 1.8, opacity: 0.85 });
      }
      layers.push({
        type: 'points', x: ys, y: ys.map((_, i) => rowY(i)), color: 'data', r: 6, draggable: true,
        onDrag: (i, x) => ((ys[i] = U.clamp(x, 0, 12)), draw()),
        tooltip: (i) => [{ label: 'y', value: U.fmt(ys[i], 2) }, { label: 'потеря в c', value: U.fmt(GBC.losses.get(s.loss, P).pointwise([ys[i]], [s.c])[0], 3) }, { label: 'сила', value: signed(forces[i]) }],
      });
      top.render(layers);
      bottom.render([
        { type: 'line', x: cs, y: cs.map((c) => total(s.loss, ys, c, P)), color: 'model', label: 'суммарные потери', width: 2.2 },
        { type: 'points', x: [opt], y: [optV], color: 'tree', r: 6, label: 'минимум' },
        { type: 'points', x: [s.c], y: [total(s.loss, ys, s.c, P)], color: 'ink', r: 5, hollow: true, label: 'ваше c' },
      ]);
      stats.set('mean', U.fmt(mean, 3));
      stats.set('median', U.fmt(med, 3));
      stats.set('opt', U.fmt(opt, 3));
      stats.set('force', signed(F, 2));
      stats.set('yours', U.fmt(total(s.loss, ys, s.c, P), 2) + ' / ' + U.fmt(optV, 2));
      const dir = Math.abs(F) < 1e-6 ? '<b>равновесие</b> — c стоит в минимуме' : F > 0 ? 'перевешивают силы вправо → c выгодно <b>увеличить</b>' : 'перевешивают силы влево → c выгодно <b>уменьшить</b>';
      const how = {
        squared: 'При квадратичных потерях сила точки равна расстоянию до неё: стрелка дотягивается ровно до точки. Далёкая точка тянет сильнее всех, поэтому равновесие — в <b>среднем</b>.',
        absolute: 'При абсолютных потерях каждая точка тянет с силой 1, как бы далеко ни была. Равновесие — где точек слева и справа поровну: в <b>медиане</b>.',
        huber: 'У Хьюбера сила равна расстоянию, но не больше δ = ' + U.fmt(s.delta, 2) + ': близкие точки тянут как в L2, далёкие — как в L1. Оптимум — между медианой и средним.',
        quantile: 'Точки выше c тянут вверх с силой α = ' + U.fmt(s.alpha, 2) + ', ниже — вниз с силой 1 − α = ' + U.fmt(1 - s.alpha, 2) + '. Равновесие — там, где ниже c лежит доля α точек: в <b>α-квантили</b>.',
      }[s.loss];
      note.innerHTML = how + ' Сейчас сумма сил ' + signed(F, 2) + ': ' + dir + '.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import get_loss\n\ny = np.array(' + JSON.stringify(ys.map((v) => Number(v.toFixed(3)))) + ')\n' +
      'loss = get_loss("' + s.loss + '"' + (s.loss === 'huber' ? ', delta=' + U.pyNum(s.delta) : s.loss === 'quantile' ? ', alpha=' + U.pyNum(s.alpha) : '') + ')\n' +
      'cs = np.linspace(0, 12, 120001)\ntotal = [loss.pointwise(y, np.full_like(y, c)).sum() for c in cs]\n' +
      'print("численный минимум:", cs[int(np.argmin(total))])\nprint("среднее:", y.mean(), " медиана:", np.median(y))\n' +
      'c = ' + U.pyNum(Number(s.c.toFixed(3))) + '\nprint("сумма сил −∂L/∂c в c:", -loss.gradient(y, np.full_like(y, c)).sum())\n'
    );
    sync();
    draw();
  });

  /* =================================================================================
   * sensitivity — влияние одной точки на лучшую константу
   * ================================================================================= */
  GBC.widget('sensitivity', (el) => {
    const base = [2, 3, 3.5, 4, 4.5, 5, 6, 7];
    const s = { z: 15, delta: 1.5 };
    const w = ui.shell(el, {
      title: 'Насколько одна точка сдвигает лучшую константу',
      sub: 'Восемь обычных значений и одно «подвижное» z. Снизу — где окажется лучшая константа для каждой из потерь, если поставить z в любое место. Перетаскивайте z.',
    });
    const zCtl = ui.slider(w.controls, { label: 'Положение точки z', min: -20, max: 40, step: 0.5, value: s.z, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.z = v), draw()) });
    ui.slider(w.controls, { label: 'δ (Хьюбер)', min: 0.5, max: 5, step: 0.1, value: s.delta, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.delta = v), draw()) });
    const top = new GBC.Plot(w.main, { height: 150, x: { label: 'значения y', domain: [-20, 40] }, y: { domain: [-1, 1], hide: true }, grid: 'x' });
    const curve = new GBC.Plot(w.main, { height: 280, x: { label: 'положение подвижной точки z', domain: [-20, 40] }, y: { label: 'лучшая константа c*' }, crosshair: true, crosshairTitle: (v) => 'z = ' + U.fmt(v, 1) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'mean', label: 'Среднее (L2)' }, { key: 'median', label: 'Медиана (L1)' }, { key: 'huber', label: 'Хьюбер' }]);
    const zs = U.linspace(-20, 40, 241);
    function draw() {
      const P = { delta: s.delta };
      const ys = base.concat([s.z]);
      const m = U.mean(ys);
      const md = U.median(ys);
      const hb = bestConst('huber', ys, P);
      top.render([
        { type: 'points', x: base, y: base.map(() => 0), color: 'data', r: 5 },
        { type: 'points', x: [s.z], y: [0], color: 'tree', r: 7, draggable: true, onDrag: (i, x) => ((s.z = Math.round(U.clamp(x, -20, 40) * 2) / 2), zCtl.set(s.z), draw()), tooltip: () => [{ label: 'z', value: U.fmt(s.z, 1) }] },
        { type: 'vline', x: m, color: 'blue', width: 1.6, dash: '5 4' },
        { type: 'vline', x: md, color: 'orange', width: 1.6, dash: '2 3' },
        { type: 'vline', x: hb, color: 'aqua', width: 1.6 },
      ]);
      curve.render([
        { type: 'line', x: zs, y: zs.map((z) => U.mean(base.concat([z]))), color: 'blue', label: 'среднее (L2)' },
        { type: 'line', x: zs, y: zs.map((z) => U.median(base.concat([z]))), color: 'orange', label: 'медиана (L1)' },
        { type: 'line', x: zs, y: zs.map((z) => bestConst('huber', base.concat([z]), P)), color: 'aqua', label: 'Хьюбер δ = ' + U.fmt(s.delta, 1) },
        { type: 'vline', x: s.z, color: 'ink2', dash: '3 3', width: 1 },
      ], { y: [0, 10] });
      stats.set('mean', U.fmt(m, 3));
      stats.set('median', U.fmt(md, 3));
      stats.set('huber', U.fmt(hb, 3));
      note.innerHTML = 'Среднее сдвигается на <b>(z − ȳ)/n</b>: каждая единица расстояния до выброса добавляет 1/9 к прогнозу, и при z → ∞ среднее уходит в бесконечность — его влияние <b>не ограничено</b>. Медиана, как бы далеко ни ушла точка, сдвигается лишь на «одну соседнюю позицию». Хьюбер — посередине: сначала идёт за точкой, но после |z − c| > δ перестаёт.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import get_loss\n\nbase = np.array(' + JSON.stringify(base) + ')\nhuber = get_loss("huber", delta=' + U.pyNum(s.delta) + ')\ncs = np.linspace(-20, 40, 60001)\n\n' +
      'for z in (5, 15, 40, 400):\n    y = np.append(base, z)\n    c_huber = cs[np.argmin([huber.pointwise(y, np.full_like(y, c)).sum() for c in cs])]\n' +
      '    print(f"z = {z:4d}: среднее {y.mean():7.3f}   медиана {np.median(y):5.2f}   Хьюбер {c_huber:6.3f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * promise-time — несимметричные потери и квантиль
   * ================================================================================= */
  GBC.widget('promise-time', (el) => {
    const rng = new GBC.RNG(7);
    const times = U.range(60).map(() => 22 + 6 * Math.exp(0.55 * rng.normal()));
    const sorted = U.sortedNumbers(times);
    const s = { k: 9, c: 30 };
    const w = ui.shell(el, {
      title: 'Сколько минут обещать клиенту',
      sub: 'Время 60 прошлых доставок. Обещаем время c. Опоздание на минуту стоит k «штрафных единиц», каждая минута лишнего запаса — одну. Какое c выгоднее всего?',
    });
    ui.slider(w.controls, { label: 'Цена минуты опоздания k', min: 1, max: 19, step: 1, value: s.k, format: (v) => v + ' : 1', onInput: (v) => ((s.k = v), draw()) });
    const cCtl = ui.slider(w.controls, { label: 'Обещаем c, мин', min: 22, max: 40, step: 0.1, value: s.c, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.c = v), draw()) });
    ui.button(w.controls, { label: 'Лучшее обещание', small: true, kind: 'primary', onClick: () => ((s.c = best()), cCtl.set(s.c), draw()) });
    const top = new GBC.Plot(w.main, { height: 180, x: { label: 'время доставки, мин', domain: [22, 40] }, y: { domain: [-1, 1], hide: true }, grid: 'x' });
    const bottom = new GBC.Plot(w.main, { height: 230, x: { label: 'обещанное время c, мин', domain: [22, 40] }, y: { label: 'средний штраф за заказ' }, crosshair: true, crosshairTitle: (v) => 'c = ' + U.fmt(v, 1) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'alpha', label: 'α = k / (k + 1)' }, { key: 'best', label: 'Лучшее обещание' }, { key: 'late', label: 'Опозданий при вашем c' }, { key: 'cost', label: 'Ваш штраф / минимум' }]);
    const alpha = () => s.k / (s.k + 1);
    const best = () => sorted[Math.ceil(alpha() * sorted.length - 1e-9) - 1];
    const cost = (c) => U.mean(times.map((t) => (t > c ? s.k * (t - c) : c - t)));
    const cs = U.linspace(22, 40, 361);
    function draw() {
      const b = best();
      const late = times.filter((t) => t > s.c).length;
      top.render([
        { type: 'vband', x0: s.c, x1: 40, color: 'critical', opacity: 0.07 },
        { type: 'points', x: times, y: times.map((_, i) => ((i % 5) - 2) * 0.33), color: (i) => (times[i] > s.c ? 'tree' : 'data'), r: 4, tooltip: (i) => [{ label: 'доставка', value: U.fmt(times[i], 1) + ' мин' }, { label: times[i] > s.c ? 'опоздание' : 'запас', value: U.fmt(Math.abs(times[i] - s.c), 1) + ' мин' }] },
        { type: 'vline', x: s.c, color: 'ink', width: 2, draggable: true, onDrag: (v) => ((s.c = Math.round(U.clamp(v, 22, 40) * 10) / 10), cCtl.set(s.c), draw()) },
        { type: 'vline', x: b, color: 'tree', width: 1.4, dash: '4 3' },
        { type: 'text', items: [{ x: s.c, y: 1, dx: 5, dy: 10, text: 'обещание' }, { x: b, y: -1, dx: 5, dy: -4, text: 'лучшее' }] },
      ]);
      bottom.render([
        { type: 'line', x: cs, y: cs.map(cost), color: 'model', width: 2.2, label: 'средний штраф' },
        { type: 'points', x: [b], y: [cost(b)], color: 'tree', r: 6, label: 'минимум' },
        { type: 'points', x: [s.c], y: [cost(s.c)], color: 'ink', r: 5, hollow: true, label: 'ваше c' },
      ]);
      stats.set('alpha', U.fmt(alpha(), 3));
      stats.set('best', U.fmt(b, 1) + ' мин');
      stats.set('late', late + ' из 60 (' + Math.round((100 * late) / 60) + ' %)');
      stats.set('cost', U.fmt(cost(s.c), 2) + ' / ' + U.fmt(cost(b), 2));
      note.innerHTML = 'Опоздание в ' + s.k + ' раз дороже запаса, поэтому выгодно опаздывать лишь в доле 1/(k + 1) = ' + U.fmt(1 / (s.k + 1), 3) + ' заказов. Лучшее обещание — <b>' + U.fmt(alpha(), 3) + '-квантиль</b> времени доставки: ' + U.fmt(b, 1) + ' мин. ' +
        (s.k === 1 ? 'При k = 1 потери симметричны — это медиана.' : 'Медиана (' + U.fmt(U.median(times), 1) + ' мин) была бы оптимальна, только если опоздание и запас стоят одинаково.');
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\nrng = Mulberry32(7)\ntimes = np.array([22 + 6 * np.exp(0.55 * rng.normal()) for _ in range(60)])\n\n' +
      'k = ' + s.k + '                       # минута опоздания в k раз дороже минуты запаса\nalpha = k / (k + 1)\n' +
      'cost = lambda c: np.mean(np.where(times > c, k * (times - c), c - times))\n' +
      'best = np.sort(times)[int(np.ceil(alpha * len(times))) - 1]   # эмпирическая α-квантиль\n' +
      'print(f"α = {alpha:.3f}; лучшее обещание {best:.1f} мин, штраф {cost(best):.3f}; опозданий {np.mean(times > best):.0%}")\n' +
      'cs = np.linspace(22, 40, 18001)\nprint("численный минимум:", cs[np.argmin([cost(c) for c in cs])])\n'
    );
    draw();
  });

  /* =================================================================================
   * pseudo-residuals — что учит первое дерево при разных потерях
   * ================================================================================= */
  GBC.widget('pseudo-residuals', (el) => {
    const data = GBC.datasets.regression1d({ kind: 'sine', n: 30, noise: 0.25, seed: 4, outliers: 0.1 });
    const s = { loss: 'squared', delta: 1, alpha: 0.9 };
    const w = ui.shell(el, {
      title: 'Чему учится первое дерево бустинга',
      sub: 'Данные с двумя выбросами. Горизонталь — стартовая константа F₀ для выбранных потерь. Стрелки — псевдо-остатки −∂L/∂F в каждой точке: именно эти числа первое дерево будет приближать.',
    });
    ui.segmented(w.controls, { label: 'Функция потерь', options: LOSS_OPTIONS.map((o) => ({ value: o.value, label: o.label.replace(/ \(.*\)/, '') })), value: s.loss, onChange: (v) => ((s.loss = v), sync(), draw()) });
    const dCtl = ui.slider(w.controls, { label: 'δ (Хьюбер)', min: 0.2, max: 3, step: 0.1, value: s.delta, onInput: (v) => ((s.delta = v), draw()) });
    const aCtl = ui.slider(w.controls, { label: 'α (квантиль)', min: 0.05, max: 0.95, step: 0.05, value: s.alpha, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.alpha = v), draw()) });
    function sync() {
      dCtl.el.hidden = s.loss !== 'huber';
      aCtl.el.hidden = s.loss !== 'quantile';
    }
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-2, 8] } });
    const bars = new GBC.Plot(w.main, { height: 170, x: { label: 'объект (по возрастанию x)', domain: [-1, 30] }, y: { label: '−∂L/∂F' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'F0', label: 'F₀ — лучшая константа' }, { key: 'sum', label: 'Сумма псевдо-остатков' }, { key: 'max', label: 'Самый большой |псевдо-остаток|' }]);
    function draw() {
      const P = { delta: s.delta, alpha: s.alpha };
      const F0 = bestConst(s.loss, data.y, P);
      const g = data.y.map((y) => pull(s.loss, y - F0, P));
      plot.render([
        { type: 'hline', y: F0, color: 'model', width: 2.2, text: 'F₀ = ' + U.fmt(F0, 3) },
        { type: 'arrows', x1: data.x, y1: data.x.map(() => F0), x2: data.x, y2: g.map((v) => F0 + v), color: 'tree', width: 1.8 },
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 4, label: 'данные', tooltip: (i) => [{ label: 'y', value: U.fmt(data.y[i], 3) }, { label: 'остаток y − F₀', value: signed(data.y[i] - F0) }, { label: '−∂L/∂F', value: signed(g[i]) }] },
      ]);
      bars.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'bars', x: U.range(30), y: g, width: 0.7, color: (i) => (g[i] >= 0 ? 'pos' : 'neg'), tooltip: (i) => [{ label: 'объект', value: String(i + 1) }, { label: '−∂L/∂F', value: signed(g[i]) }] },
      ]);
      const sum = U.sum(g);
      stats.set('F0', U.fmt(F0, 3));
      stats.set('sum', signed(sum, 3));
      stats.set('max', U.fmt(Math.max(...g.map(Math.abs)), 3));
      note.innerHTML = {
        squared: 'Псевдо-остатки — обычные остатки y − F₀. Два выброса дают огромные стрелки: первое дерево потратит свои разбиения на то, чтобы «дотянуться» до них. F₀ — среднее, и его тоже приподняли выбросы.',
        absolute: 'Псевдо-остатки — только знаки: +1 или −1. Выброс «голосует» наравне с обычной точкой, поэтому дерево его почти не замечает. F₀ — медиана.',
        huber: 'Псевдо-остатки — остатки, обрезанные до ±δ = ±' + U.fmt(s.delta, 1) + ': обычные точки учат как в L2, выбросы — не сильнее δ. Но у выбросов они всё равно самые большие, и дерево может отрезать их в отдельный лист (см. предупреждение ниже).',
        quantile: 'Псевдо-остатки — α = ' + U.fmt(s.alpha, 2) + ' для точек выше F₀ и α − 1 = ' + U.fmt(s.alpha - 1, 2) + ' ниже. Дерево будет сдвигать прогноз к α-квантили в каждой области.',
      }[s.loss] + ' Сумма псевдо-остатков ≈ 0: в лучшей константе силы уравновешены.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, get_loss\n\nX, y = datasets.regression_1d(kind="sine", n=30, noise=0.25, seed=4, outliers=0.1)\n' +
      'for name, kw in [("squared", {}), ("absolute", {}), ("huber", {"delta": ' + U.pyNum(s.delta) + '}), ("quantile", {"alpha": ' + U.pyNum(s.alpha) + '})]:\n' +
      '    loss = get_loss(name, **kw)\n    F0 = np.full_like(y, loss.init(y))          # стартовая константа (для квантиля — с интерполяцией)\n' +
      '    g = loss.negative_gradient(y, F0)           # чему учится первое дерево\n' +
      '    print(f"{name:9s} F0 = {F0[0]:+.3f}  псевдо-остатки: {np.round(g[:6], 2)} …  max |g| = {np.abs(g).max():.2f}")\n'
    );
    sync();
    draw();
  });

  /* =================================================================================
   * class-losses — потери для классификации
   * ================================================================================= */
  GBC.widget('class-losses', (el) => {
    const s = { y: 1, p: 0.8 };
    const w = ui.shell(el, {
      title: 'Потери для классификации',
      sub: 'Модель выдаёт вероятность p того, что класс равен 1. Сколько стоит такой прогноз, если на самом деле класс y? Сравните три потери.',
    });
    ui.segmented(w.controls, { label: 'Правильный класс y', options: [{ value: 1, label: 'y = 1' }, { value: 0, label: 'y = 0' }], value: s.y, onChange: (v) => ((s.y = v), draw()) });
    ui.slider(w.controls, { label: 'Прогноз вероятности p', min: 0.01, max: 0.99, step: 0.01, value: s.p, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.p = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'прогноз вероятности класса 1: p', domain: [0, 1] }, y: { label: 'потери', domain: [0, 4.7] }, crosshair: true, crosshairTitle: (v) => 'p = ' + U.fmt(v, 2) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'zo', label: '0–1 (ошибся ли класс)' }, { key: 'sq', label: 'Квадрат (y − p)²' }, { key: 'll', label: 'Log-loss −ln p(y)' }, { key: 'F', label: 'Логит F = ln(p/(1−p))' }]);
    const ps = U.linspace(0.005, 0.995, 397);
    const zeroOne = (p) => ((p >= 0.5 ? 1 : 0) === s.y ? 0 : 1);
    const sq = (p) => (s.y - p) ** 2;
    const ll = (p) => -Math.log(s.y === 1 ? p : 1 - p);
    function draw() {
      plot.render([
        { type: 'line', x: ps, y: ps.map(zeroOne), color: 'ink2', width: 2, curve: 'step', label: '0–1' },
        { type: 'line', x: ps, y: ps.map(sq), color: 'orange', width: 2, label: 'квадрат (y − p)²' },
        { type: 'line', x: ps, y: ps.map(ll), color: 'blue', width: 2.4, label: 'log-loss' },
        { type: 'vline', x: s.p, color: 'ink', dash: '3 3', width: 1.2 },
        { type: 'points', x: [s.p, s.p, s.p], y: [zeroOne(s.p), sq(s.p), ll(s.p)], color: (i) => ['ink2', 'orange', 'blue'][i], r: 5 },
      ]);
      stats.set('zo', String(zeroOne(s.p)));
      stats.set('sq', U.fmt(sq(s.p), 3));
      stats.set('ll', U.fmt(ll(s.p), 3));
      stats.set('F', U.fmt(Math.log(s.p / (1 - s.p)), 3));
      const conf = s.y === 1 ? s.p : 1 - s.p;
      note.innerHTML = '0–1 потеря видит только «угадал / не угадал» и не различает прогнозы 0.51 и 0.99; у неё нет наклона, по которому можно спускаться. ' +
        'Log-loss гладкая и <b>сурово наказывает уверенные ошибки</b>: сейчас вероятность правильного класса ' + U.fmt(conf, 2) + ', потеря ' + U.fmt(ll(s.p), 3) +
        (conf < 0.1 ? ' — модель уверенно ошиблась, и это дорого.' : conf > 0.9 ? ' — уверенный и верный прогноз почти бесплатен.' : '.') + ' Именно log-loss минимизирует бустинг для классификации (урок 6.1).';
    }
    w.pythonAction(() =>
      'import numpy as np\n\ny, p = ' + s.y + ', ' + U.pyNum(s.p) + '\nprint("0–1:", int((p >= 0.5) != y))\nprint("квадрат:", (y - p) ** 2)\n' +
      'print("log-loss:", -(y * np.log(p) + (1 - y) * np.log(1 - p)))\nprint("логит F:", np.log(p / (1 - p)))\n'
    );
    draw();
  });
})();
