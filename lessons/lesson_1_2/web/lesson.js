/* Урок 1.2 — функции потерь и лучшая константа:
 *   loss-contrib     — пять чисел: вклад каждой точки в сумму потерь;
 *   best-constant    — лучшая константа и «перетягивание каната»: каждая точка тянет прогноз силой −∂L/∂c;
 *   sensitivity      — как одна точка сдвигает лучшую константу (среднее, медиана, Хьюбер);
 *   promise-time     — несимметричная цена ошибки: сколько минут обещать клиенту (квантиль);
 *   conditional-best — от константы к модели: лучшие константы по группам расстояния;
 *   noise-loss       — откуда берутся потери: форма шума и минус логарифм плотности;
 *   pseudo-residuals — чему учится первое дерево бустинга при разных потерях;
 *   class-losses     — потери для классификации: 0–1, квадрат вероятности, log-loss; ось p или отступ m;
 *   logloss-constant — лучшая вероятность и стартовый логит для log-loss;
 *   boost-step       — первый шаг бустинга руками: F₀, псевдо-остатки, пень, значения листьев. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  const LOSS_OPTIONS = [
    { value: 'squared', label: 'Квадратичная (L2)' },
    { value: 'absolute', label: 'Абсолютная (L1)' },
    { value: 'huber', label: 'Хьюбер' },
    { value: 'quantile', label: 'Квантильная' },
  ];
  const SHORT_OPTIONS = LOSS_OPTIONS.map((o) => ({ value: o.value, label: o.label.replace(/ \(.*\)/, '') }));
  /** Число со знаком; машинный ноль (1e−16) показываем как 0. */
  const signed = (v, d = 3) => (Math.abs(v) < 1e-9 ? '0' : (v > 0 ? '+' : '') + U.fmt(v, d));
  const pct = (v) => Math.round(100 * v) + ' %';
  const lossArgs = (key, p) => (key === 'huber' ? ', delta=' + U.pyNum(p.delta) : key === 'quantile' ? ', alpha=' + U.pyNum(p.alpha) : '');

  /** «Сила», с которой точка y тянет константу c: −∂L(y, c)/∂c = ψ(y − c). */
  function pull(key, r, p) {
    if (key === 'squared') return r;
    if (key === 'absolute') return r > 0 ? 1 : r < 0 ? -1 : 0;
    if (key === 'huber') return U.clamp(r, -p.delta, p.delta);
    return r > 0 ? p.alpha : r < 0 ? p.alpha - 1 : 0; // в самой точке берём 0 из отрезка [α − 1, α]
  }
  /** Точная эмпирическая α-квантиль: наблюдение с номером ⌈αn⌉ (минимизатор pinball-потерь). */
  const exactQuantile = (v, alpha) => {
    const s = U.sortedNumbers(v);
    return s[Math.max(0, Math.ceil(alpha * s.length - 1e-9) - 1)];
  };
  /** Точный минимизатор суммы потерь по константе. */
  function bestConst(key, ys, p) {
    if (key === 'squared') return U.mean(ys);
    if (key === 'absolute') return U.median(ys);
    if (key === 'quantile') return exactQuantile(ys, p.alpha);
    // Хьюбер: сумма сил монотонно убывает по c — ищем ноль делением пополам
    const v = U.sortedNumbers(ys);
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

  /** Обратная функция нормального распределения Φ⁻¹(p) (алгоритм Акклама, точность ~1e−9). */
  function normInv(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const lo = 0.02425;
    if (p < lo) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - lo) return -normInv(1 - p);
    const q = p - 0.5;
    const r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /** Таблица, которая перерисовывается целиком. */
  function tableBox(parent) {
    const box = H('div', { class: 'lesson-table' });
    parent.appendChild(box);
    return (spec) => {
      box.textContent = '';
      ui.table(box, spec);
    };
  }

  /* =================================================================================
   * loss-contrib — пять чисел: из чего складывается сумма потерь
   * ================================================================================= */
  GBC.widget('loss-contrib', (el) => {
    const BASE = [1, 2, 3, 4, 10];
    let ys = BASE.slice();
    const s = { loss: 'squared', c: 3, delta: 3 };
    const P = () => ({ delta: s.delta, alpha: 0.9 });
    const w = ui.shell(el, {
      title: 'Из чего складывается сумма потерь',
      sub: 'Пять ответов и одна константа c для всех. Каждый столбик — потеря одной точки L(y_i, c), подпись над ним — её доля в сумме. Меняйте c и потери; замените 10 на 100.',
    });
    ui.segmented(w.controls, { label: 'Функция потерь', options: SHORT_OPTIONS.slice(0, 3), value: s.loss, onChange: (v) => ((s.loss = v), sync(), draw()) });
    const dCtl = ui.slider(w.controls, { label: 'δ (Хьюбер)', min: 0.5, max: 6, step: 0.5, value: s.delta, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.delta = v), draw()) });
    const cCtl = ui.slider(w.controls, { label: 'Константа c', min: 0, max: 25, step: 0.05, value: s.c, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.c = v), draw()) });
    const btns = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(btns);
    ui.button(btns, { label: 'c = медиана', small: true, onClick: () => setC(U.median(ys)) });
    ui.button(btns, { label: 'c = среднее', small: true, onClick: () => setC(U.mean(ys)) });
    ui.button(btns, { label: 'В минимум', small: true, kind: 'primary', onClick: () => setC(bestConst(s.loss, ys, P())) });
    const btns2 = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(btns2);
    ui.button(btns2, { label: '10 → 100', small: true, onClick: () => ((ys = [1, 2, 3, 4, 100]), draw()) });
    ui.button(btns2, { label: 'Сбросить', small: true, kind: 'ghost', onClick: () => ((ys = BASE.slice()), draw()) });
    function setC(v) {
      s.c = Math.round(v * 100) / 100;
      cCtl.set(s.c);
      draw();
    }
    function sync() {
      dCtl.el.hidden = s.loss !== 'huber';
    }
    const plot = new GBC.Plot(w.main, {
      height: 250, x: { label: 'точка (ответ y_i)', domain: [0.4, 5.6], ticks: [1, 2, 3, 4, 5], format: (v) => 'y = ' + U.fmt(ys[Math.round(v) - 1] ?? 0, 0) },
      y: { label: 'L(y_i, c)' },
      table: () => ({ columns: ['y_i', 'r_i = y_i − c', 'L(y_i, c)'], rows: ys.map((y) => [y, y - s.c, GBC.losses.get(s.loss, P()).pointwise([y], [s.c])[0]]) }),
    });
    const showTable = tableBox(w.main);
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'sum', label: 'Σ L при вашем c' }, { key: 'top', label: 'Доля самой дорогой точки' }, { key: 'best', label: 'Лучшая c для этих потерь' }, { key: 'min', label: 'Σ L в лучшей c' }]);
    function draw() {
      const p = P();
      const loss = GBC.losses.get(s.loss, p);
      const Ls = loss.pointwise(ys, ys.map(() => s.c));
      const S = U.sum(Ls);
      const xs = [1, 2, 3, 4, 5];
      const top = U.argmax(Ls);
      plot.render([
        { type: 'bars', x: xs, y: Ls, width: 0.6, maxPx: 56, color: (i) => (i === top ? 'tree' : 'model'), tooltip: (i) => [{ label: 'y', value: U.fmt(ys[i], 2) }, { label: 'r = y − c', value: signed(ys[i] - s.c, 2) }, { label: 'L', value: U.fmt(Ls[i], 3) }] },
        { type: 'text', items: xs.map((x, i) => ({ x, y: Ls[i], dy: -6, anchor: 'middle', text: S > 0 ? pct(Ls[i] / S) : '0 %' })) },
      ], { y: [0, Math.max(1, Math.max(...Ls) * 1.18)] });
      showTable({
        columns: ['y_i', 'r_i = y_i − c', 'L(y_i, c)', 'доля'],
        rows: ys.map((y, i) => [U.fmt(y, 0), signed(y - s.c, 2), U.fmt(Ls[i], 3), S > 0 ? pct(Ls[i] / S) : '—'])
          .concat([['сумма', signed(U.sum(ys.map((y) => y - s.c)), 2), U.fmt(S, 3), '100 %']]),
        highlight: (i) => i === top,
      });
      const best = bestConst(s.loss, ys, p);
      stats.set('sum', U.fmt(S, 3));
      stats.set('top', S > 0 ? pct(Ls[top] / S) : '—');
      stats.set('best', U.fmt(best, 3));
      stats.set('min', U.fmt(total(s.loss, ys, best, p), 3));
      const far = ys[4];
      note.innerHTML = {
        squared: 'При квадратичных потерях точка y = ' + far + ' платит ' + pct(Ls[4] / S) + ' всей суммы: её остаток возводится в квадрат. Чтобы уменьшить сумму, константе выгодно сдвинуться к ней — поэтому оптимум (среднее ' + U.fmt(U.mean(ys), 2) + ') правее медианы.',
        absolute: 'При абсолютных потерях вклад растёт лишь пропорционально расстоянию. Сдвиг c на ε меняет каждый вклад ровно на ε, поэтому важно только, сколько точек слева и справа, — оптимум в медиане ' + U.fmt(U.median(ys), 2) + '.',
        huber: 'У Хьюбера близкие точки платят как в L2, а дальше δ = ' + U.fmt(s.delta, 1) + ' — как в L1. Далёкая точка всё ещё дорогая, но тянет константу не сильнее δ: оптимум ' + U.fmt(best, 3) + ' — между медианой и средним.',
      }[s.loss];
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import get_loss\n\ny = np.array(' + JSON.stringify(ys) + ', dtype=float)\nc = ' + U.pyNum(s.c) + '\n' +
      'loss = get_loss("' + s.loss + '"' + lossArgs(s.loss, P()) + ')\nL = loss.pointwise(y, np.full_like(y, c))\n' +
      'print("потери точек:", L)\nprint("сумма:", L.sum(), " доли:", np.round(L / L.sum(), 3))\n'
    );
    sync();
    draw();
  });

  /* =================================================================================
   * best-constant — лучшая константа и перетягивание каната
   * ================================================================================= */
  GBC.widget('best-constant', (el) => {
    const PRESETS = {
      nine: [2.1, 2.9, 3.3, 3.8, 4.1, 4.4, 4.9, 5.6, 6.2],
      five: [1, 2, 3, 4, 10],
      two: [2, 8],
      three: [2, 3, 10],
    };
    let preset = 'nine';
    let ys = PRESETS[preset].slice();
    const s = { loss: 'squared', c: 3, delta: 1, alpha: 0.9, forces: true };
    const p = () => ({ delta: s.delta, alpha: s.alpha });
    const w = ui.shell(el, {
      title: 'Какая константа лучше всего?',
      sub: 'Сверху — ответы y_i (точки и линию c можно перетаскивать). Оранжевые стрелки — силы: с какой силой каждая точка тянет прогноз c к себе. Снизу — суммарные потери; минимум там, где силы уравновешены.',
    });
    ui.select(w.controls, {
      label: 'Данные',
      options: [{ value: 'two', label: 'Две точки: 2 и 8' }, { value: 'three', label: 'Три точки: 2, 3, 10' }, { value: 'five', label: 'Пять чисел: 1, 2, 3, 4, 10' }, { value: 'nine', label: 'Девять значений' }],
      value: preset, onChange: (v) => ((preset = v), (ys = PRESETS[v].slice()), draw()),
    });
    ui.select(w.controls, { label: 'Функция потерь', options: LOSS_OPTIONS, value: s.loss, onChange: (v) => ((s.loss = v), sync(), draw()) });
    const dCtl = ui.slider(w.controls, { label: 'δ (Хьюбер)', min: 0.2, max: 4, step: 0.1, value: s.delta, onInput: (v) => ((s.delta = v), draw()) });
    const aCtl = ui.slider(w.controls, { label: 'α (квантиль)', min: 0.05, max: 0.95, step: 0.05, value: s.alpha, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.alpha = v), draw()) });
    const cCtl = ui.slider(w.controls, { label: 'Ваш прогноз c', min: 0, max: 12, step: 0.01, value: s.c, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.c = v), draw()) });
    ui.toggle(w.controls, { label: 'Силы −∂L/∂c', checked: s.forces, onChange: (v) => ((s.forces = v), draw()) });
    const btns = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(btns);
    ui.button(btns, { label: 'В минимум', small: true, kind: 'primary', onClick: () => ((s.c = bestConst(s.loss, ys, p())), cCtl.set(s.c), draw()) });
    ui.button(btns, { label: 'Добавить выброс', small: true, onClick: () => ((ys = PRESETS[preset].concat([11.5])), draw()) });
    ui.button(btns, { label: 'Сбросить', small: true, kind: 'ghost', onClick: () => ((ys = PRESETS[preset].slice()), draw()) });
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
        absolute: 'При абсолютных потерях каждая точка тянет с силой 1, как бы далеко ни была. Равновесие — где точек слева и справа поровну: в <b>медиане</b>.' + (ys.length % 2 === 0 ? ' Точек чётное число: на всём отрезке между двумя средними точками силы уравновешены, и сумма потерь там постоянна.' : ''),
        huber: 'У Хьюбера сила равна расстоянию, но не больше δ = ' + U.fmt(s.delta, 2) + ': близкие точки тянут как в L2, далёкие — как в L1. Оптимум — между медианой и средним.',
        quantile: 'Точки выше c тянут вверх с силой α = ' + U.fmt(s.alpha, 2) + ', ниже — вниз с силой 1 − α = ' + U.fmt(1 - s.alpha, 2) + '. Равновесие — там, где ниже c лежит доля α точек: в <b>α-квантили</b>.',
      }[s.loss];
      note.innerHTML = how + ' Сейчас сумма сил ' + signed(F, 2) + ': ' + dir + '.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import get_loss\n\ny = np.array(' + JSON.stringify(ys.map((v) => Number(v.toFixed(3)))) + ')\n' +
      'loss = get_loss("' + s.loss + '"' + lossArgs(s.loss, p()) + ')\n' +
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
   * conditional-best — от константы к модели: лучшая константа в каждой группе
   * ================================================================================= */
  /** Доставки: расстояние x ∈ [0.5, 10] км, время y = 8 + 2.2x + (1 + 0.35x)·e^{0.6z}, z ~ N(0, 1). */
  function deliveries(n, seed) {
    const rng = new GBC.RNG(seed);
    const x = [];
    const y = [];
    for (let i = 0; i < n; i++) {
      const xi = rng.uniform(0.5, 10);
      const z = rng.normal();
      x.push(xi);
      y.push(8 + 2.2 * xi + (1 + 0.35 * xi) * Math.exp(0.6 * z));
    }
    return { x, y };
  }
  GBC.widget('conditional-best', (el) => {
    const train = deliveries(240, 21);
    const fresh = deliveries(240, 22);
    const s = { k: 1, alpha: 0.9, mean: true, median: true, quant: true, truth: false, fresh: false };
    const w = ui.shell(el, {
      title: 'От одной константы — к модели',
      sub: '240 доставок: расстояние и время. Делим расстояние на k одинаковых групп и в каждой ставим лучшую константу: среднее, медиану или α-квантиль. При k = 1 это константы предыдущих шагов, при большом k — ступенчатая модель.',
    });
    ui.slider(w.controls, { label: 'Групп по расстоянию k', min: 1, max: 12, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.toggle(w.controls, { label: 'Среднее (L2)', checked: s.mean, onChange: (v) => ((s.mean = v), draw()) });
    ui.toggle(w.controls, { label: 'Медиана (L1)', checked: s.median, onChange: (v) => ((s.median = v), draw()) });
    ui.toggle(w.controls, { label: 'α-квантиль (pinball)', checked: s.quant, onChange: (v) => ((s.quant = v), draw()) });
    ui.slider(w.controls, { label: 'α', min: 0.05, max: 0.95, step: 0.05, value: s.alpha, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.alpha = v), draw()) });
    ui.toggle(w.controls, { label: 'Истинные кривые', checked: s.truth, onChange: (v) => ((s.truth = v), draw()) });
    ui.toggle(w.controls, { label: 'Показать новые доставки', checked: s.fresh, onChange: (v) => ((s.fresh = v), draw()) });
    let groups = [];
    const plot = new GBC.Plot(w.main, {
      height: 330, x: { label: 'расстояние x, км', domain: [0, 10.5] }, y: { label: 'время доставки y, мин', domain: [8, 42] },
      table: () => ({ columns: ['группа', 'x от', 'x до', 'доставок', 'среднее', 'медиана', 'α-квантиль'], rows: groups.map((g, j) => [j + 1, g.x0, g.x1, g.n, g.mean, g.median, g.q]) }),
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'cov', label: 'Ниже α-квантили: обучение' }, { key: 'covNew', label: 'на новых данных' }, { key: 'near', label: 'новые, x < 3.5 км' }, { key: 'far', label: 'новые, x > 7 км' }]);
    const gid = (x) => Math.min(s.k - 1, Math.floor(((x - 0.5) / 9.5) * s.k));
    const xs = U.linspace(0.5, 10, 96);
    const truthAt = (x, m) => 8 + 2.2 * x + (1 + 0.35 * x) * m;
    function draw() {
      const k = s.k;
      groups = U.range(k).map((j) => {
        const yy = train.y.filter((_, i) => gid(train.x[i]) === j);
        return { x0: 0.5 + (9.5 * j) / k, x1: 0.5 + (9.5 * (j + 1)) / k, n: yy.length, mean: U.mean(yy), median: U.median(yy), q: exactQuantile(yy, s.alpha) };
      });
      const seg = (key) => groups.map((g) => ({ x0: g.x0, x1: g.x1, value: g[key] }));
      const pts = s.fresh ? fresh : train;
      const layers = [{ type: 'points', x: pts.x, y: pts.y, color: 'data', r: 3, opacity: 0.75, label: s.fresh ? 'новые доставки' : 'доставки (обучение)', tooltip: (i) => [{ label: 'x', value: U.fmt(pts.x[i], 2) + ' км' }, { label: 'y', value: U.fmt(pts.y[i], 1) + ' мин' }] }];
      const zq = normInv(s.alpha);
      if (s.truth) {
        if (s.mean) layers.push({ type: 'line', x: xs, y: xs.map((x) => truthAt(x, Math.exp(0.18))), color: 'blue', width: 1.4, dash: '5 4', opacity: 0.8 });
        if (s.median) layers.push({ type: 'line', x: xs, y: xs.map((x) => truthAt(x, 1)), color: 'aqua', width: 1.4, dash: '5 4', opacity: 0.8 });
        if (s.quant) layers.push({ type: 'line', x: xs, y: xs.map((x) => truthAt(x, Math.exp(0.6 * zq))), color: 'orange', width: 1.4, dash: '5 4', opacity: 0.8 });
      }
      if (s.mean) layers.push({ type: 'steps', segments: seg('mean'), color: 'blue', width: 2.4, label: 'среднее (L2)' });
      if (s.median) layers.push({ type: 'steps', segments: seg('median'), color: 'aqua', width: 2.4, label: 'медиана (L1)' });
      if (s.quant) layers.push({ type: 'steps', segments: seg('q'), color: 'orange', width: 2.4, label: U.fmt(s.alpha, 2) + '-квантиль' });
      plot.render(layers);
      const below = (d, mask) => {
        let n = 0;
        let hit = 0;
        d.x.forEach((x, i) => {
          if (mask && !mask(x)) return;
          n++;
          if (d.y[i] <= groups[gid(x)].q) hit++;
        });
        return n ? hit / n : 0;
      };
      stats.set('cov', pct(below(train)));
      stats.set('covNew', pct(below(fresh)));
      stats.set('near', pct(below(fresh, (x) => x < 3.5)));
      stats.set('far', pct(below(fresh, (x) => x > 7)));
      const gap = U.mean(groups.map((g) => g.mean - g.median));
      note.innerHTML = (k === 1
        ? 'Одна группа — одна константа на все расстояния: это ровно задача шагов 5–8. Обещание по ' + U.fmt(s.alpha, 2) + '-квантили выполняется в ' + pct(below(fresh)) + ' новых заказов, но несправедливо: близким клиентам почти всегда (' + pct(below(fresh, (x) => x < 3.5)) + '), дальним — гораздо реже (' + pct(below(fresh, (x) => x > 7)) + '). Увеличьте k.'
        : k + (k < 5 ? ' группы' : ' групп') + ': в каждой — своя лучшая константа, и ступеньки повторяют форму данных. Покрытие квантили выровнялось: близкие ' + pct(below(fresh, (x) => x < 3.5)) + ', дальние ' + pct(below(fresh, (x) => x > 7)) + '. ' + (k >= 9 ? 'Но в группах осталось по ' + Math.min(...groups.map((g) => g.n)) + '–' + Math.max(...groups.map((g) => g.n)) + ' доставок, и ступеньки начинают дрожать от случайности — это переобучение (урок 1.4).' : 'Так и работает дерево решений: его листья — группы, а значение листа — лучшая константа (урок 2).')) +
        ' Время доставки скошено вправо (редкие сильные задержки), поэтому среднее выше медианы в среднем на ' + U.fmt(gap, 2) + ' мин.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\n' +
      'def deliveries(n, seed):\n    rng = Mulberry32(seed)\n    x, y = [], []\n    for _ in range(n):\n        xi = rng.uniform(0.5, 10)\n        z = rng.normal()\n        x.append(xi)\n        y.append(8 + 2.2 * xi + (1 + 0.35 * xi) * np.exp(0.6 * z))\n    return np.array(x), np.array(y)\n\n' +
      'x, y = deliveries(240, 21)\nk, alpha = ' + s.k + ', ' + U.pyNum(s.alpha) + '\ngroup = np.minimum(((x - 0.5) / 9.5 * k).astype(int), k - 1)\n' +
      'for j in range(k):\n    yy = np.sort(y[group == j])\n    q = yy[int(np.ceil(alpha * len(yy) - 1e-9)) - 1]          # точная α-квантиль\n' +
      '    print(f"группа {j + 1}: n = {len(yy):3d}  среднее {yy.mean():5.2f}  медиана {np.median(yy):5.2f}  квантиль {q:5.2f}")\n'
    );
    draw();
  });

  /* =================================================================================
   * noise-loss — шум и потеря: −ln p(r) нормального и лапласовского шума
   * ================================================================================= */
  GBC.widget('noise-loss', (el) => {
    const N = 300;
    const KINDS = {
      normal: { label: 'Нормальный', range: 4.5 },
      laplace: { label: 'Лапласа', range: 4.5 },
      outliers: { label: 'С выбросами', range: 9 },
    };
    function sample(kind) {
      const rng = new GBC.RNG(31);
      return U.range(N).map(() => {
        if (kind === 'normal') return rng.normal();
        if (kind === 'laplace') {
          const u = rng.uniform(-0.5, 0.5);
          return (-Math.sign(u) * Math.log(Math.max(1e-12, 1 - 2 * Math.abs(u)))) / Math.SQRT2;
        }
        let v = rng.normal();
        if (rng.random() < 0.1) v *= 6;
        return v;
      });
    }
    const s = { kind: 'normal' };
    const w = ui.shell(el, {
      title: 'Шум подсказывает потерю',
      sub: '300 остатков y − F. Подгоняем к ним два закона шума — нормальный и Лапласа — и сравниваем, какой правдоподобнее. Снизу — минус логарифм плотности: это и есть функция потерь, которую «выбирает» закон шума.',
    });
    ui.segmented(w.controls, { label: 'Каким на самом деле был шум', options: Object.keys(KINDS).map((k) => ({ value: k, label: KINDS[k].label })), value: s.kind, onChange: (v) => ((s.kind = v), draw()) });
    const hist = new GBC.Plot(w.main, { height: 240, x: { label: 'остаток r' }, y: { label: 'плотность' } });
    const nll = new GBC.Plot(w.main, { height: 220, x: { label: 'остаток r' }, y: { label: '−ln p(r) + const' }, crosshair: true, crosshairTitle: (v) => 'r = ' + U.fmt(v, 2) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'mean', label: 'Среднее / медиана' }, { key: 'nllN', label: 'Средний −ln p: нормальный' }, { key: 'nllL', label: 'Средний −ln p: Лаплас' }, { key: 'win', label: 'Правдоподобнее' }]);
    function draw() {
      const r = sample(s.kind);
      const R = KINDS[s.kind].range;
      const mu = U.mean(r);
      const sd = Math.sqrt(U.mean(r.map((v) => (v - mu) ** 2)));
      const md = U.median(r);
      const b = U.mean(r.map((v) => Math.abs(v - md)));
      const lnN = (v) => 0.5 * Math.log(2 * Math.PI * sd * sd) + ((v - mu) ** 2) / (2 * sd * sd);
      const lnL = (v) => Math.log(2 * b) + Math.abs(v - md) / b;
      const nllN = U.mean(r.map(lnN));
      const nllL = U.mean(r.map(lnL));
      const bins = 36;
      const bw = (2 * R) / bins;
      const counts = new Array(bins).fill(0);
      r.forEach((v) => {
        const j = Math.floor((v + R) / bw);
        if (j >= 0 && j < bins) counts[j]++;
      });
      const centers = U.range(bins).map((j) => -R + (j + 0.5) * bw);
      const grid = U.linspace(-R, R, 301);
      hist.render([
        { type: 'bars', x: centers, y: counts.map((c) => c / (N * bw)), width: bw, color: 'data', opacity: 0.55, label: 'остатки', tooltip: (j) => [{ label: 'интервал', value: U.fmt(centers[j] - bw / 2, 2) + '…' + U.fmt(centers[j] + bw / 2, 2) }, { label: 'остатков', value: String(counts[j]) }] },
        { type: 'line', x: grid, y: grid.map((v) => Math.exp(-lnN(v))), color: 'blue', width: 2.2, label: 'нормальный закон' },
        { type: 'line', x: grid, y: grid.map((v) => Math.exp(-lnL(v))), color: 'orange', width: 2.2, label: 'закон Лапласа' },
      ], { x: [-R, R] });
      const minN = lnN(mu);
      const minL = lnL(md);
      nll.render([
        { type: 'line', x: grid, y: grid.map((v) => lnN(v) - minN), color: 'blue', width: 2.2, label: '(r − μ)²/2σ² → квадратичная' },
        { type: 'line', x: grid, y: grid.map((v) => lnL(v) - minL), color: 'orange', width: 2.2, label: '|r − m|/b → абсолютная' },
      ], { x: [-R, R], y: [0, 6] });
      stats.set('mean', U.fmt(mu, 3) + ' / ' + U.fmt(md, 3));
      stats.set('nllN', U.fmt(nllN, 3));
      stats.set('nllL', U.fmt(nllL, 3));
      stats.set('win', nllN < nllL ? 'нормальный → L2' : 'Лаплас → L1');
      note.innerHTML = {
        normal: 'Шум нормальный: колокол ложится на гистограмму лучше, средний −ln p меньше (' + U.fmt(nllN, 3) + ' против ' + U.fmt(nllL, 3) + '). Минус логарифм нормальной плотности — парабола: максимизировать правдоподобие значит минимизировать сумму квадратов. Лучший центр — среднее.',
        laplace: 'Шум Лапласа: острый пик и тяжёлые хвосты. Его плотность ∝ e<sup>−|r|/b</sup>, минус логарифм — «галочка» |r|/b. Правдоподобнее Лаплас (' + U.fmt(nllL, 3) + ' против ' + U.fmt(nllN, 3) + '), и правильная потеря — абсолютная, лучший центр — медиана.',
        outliers: 'Каждый десятый остаток в 6 раз шире: это выбросы. Нормальный закон вынужден раздуть σ до ' + U.fmt(sd, 2) + ' и всё равно проигрывает (' + U.fmt(nllN, 3) + ' против ' + U.fmt(nllL, 3) + '). Для таких данных квадратичная потеря — неверное допущение; L1 или Хьюбер честнее.',
      }[s.kind];
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\nrng = Mulberry32(31)\nkind = "' + s.kind + '"\n' +
      'def draw_noise():\n    if kind == "normal":\n        return rng.normal()\n    if kind == "laplace":\n        u = rng.uniform(-0.5, 0.5)\n        return -np.sign(u) * np.log(max(1e-12, 1 - 2 * abs(u))) / np.sqrt(2)\n' +
      '    v = rng.normal()\n    return v * 6 if rng.random() < 0.1 else v\n\nr = np.array([draw_noise() for _ in range(300)])\n' +
      'mu, sd = r.mean(), r.std()\nm = np.median(r)\nb = np.mean(np.abs(r - m))\n' +
      'nll_normal = np.mean(0.5 * np.log(2 * np.pi * sd**2) + (r - mu) ** 2 / (2 * sd**2))\nnll_laplace = np.mean(np.log(2 * b) + np.abs(r - m) / b)\n' +
      'print(f"средний −ln p: нормальный {nll_normal:.3f}, Лаплас {nll_laplace:.3f}")\n'
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
    ui.segmented(w.controls, { label: 'Функция потерь', options: SHORT_OPTIONS, value: s.loss, onChange: (v) => ((s.loss = v), sync(), draw()) });
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
    const s = { y: 1, p: 0.8, axis: 'p' };
    const w = ui.shell(el, {
      title: 'Потери для классификации',
      sub: 'Модель выдаёт вероятность p того, что класс равен 1. Сколько стоит такой прогноз, если на самом деле класс y? Переключите ось на «отступ», чтобы увидеть те же потери так, как их видит бустинг.',
    });
    ui.segmented(w.controls, { label: 'Правильный класс y', options: [{ value: 1, label: 'y = 1' }, { value: 0, label: 'y = 0' }], value: s.y, onChange: (v) => ((s.y = v), draw()) });
    ui.slider(w.controls, { label: 'Прогноз вероятности p', min: 0.01, max: 0.99, step: 0.01, value: s.p, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.p = v), draw()) });
    ui.segmented(w.controls, { label: 'Ось X', options: [{ value: 'p', label: 'вероятность p' }, { value: 'm', label: 'отступ m' }], value: s.axis, onChange: (v) => ((s.axis = v), build(), draw()) });
    let plot = null;
    const holder = H('div');
    w.main.appendChild(holder);
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'zo', label: '0–1 (ошибся ли класс)' }, { key: 'sq', label: 'Квадрат (y − p)²' }, { key: 'll', label: 'Log-loss −ln p(y)' }, { key: 'F', label: 'Логит F = ln(p/(1−p))' }, { key: 'm', label: 'Отступ m = ỹ·F' }]);
    function build() {
      holder.textContent = '';
      plot = s.axis === 'p'
        ? new GBC.Plot(holder, { height: 300, x: { label: 'прогноз вероятности класса 1: p', domain: [0, 1] }, y: { label: 'потери', domain: [0, 4.7] }, crosshair: true, crosshairTitle: (v) => 'p = ' + U.fmt(v, 2) })
        : new GBC.Plot(holder, { height: 300, x: { label: 'отступ m = ỹ·F (ỹ = ±1, F — логит)', domain: [-5, 5] }, y: { label: 'потери', domain: [0, 4.7] }, crosshair: true, crosshairTitle: (v) => 'm = ' + U.fmt(v, 2) });
    }
    const ps = U.linspace(0.005, 0.995, 397);
    const ms = U.linspace(-5, 5, 401);
    const zeroOne = (p) => ((p >= 0.5 ? 1 : 0) === s.y ? 0 : 1);
    const sq = (p) => (s.y - p) ** 2;
    const ll = (p) => -Math.log(s.y === 1 ? p : 1 - p);
    const logit = (p) => Math.log(p / (1 - p));
    function draw() {
      const ty = s.y === 1 ? 1 : -1;
      const m = ty * logit(s.p);
      if (s.axis === 'p') {
        plot.render([
          { type: 'line', x: ps, y: ps.map(zeroOne), color: 'ink2', width: 2, curve: 'step', label: '0–1' },
          { type: 'line', x: ps, y: ps.map(sq), color: 'orange', width: 2, label: 'квадрат (y − p)²' },
          { type: 'line', x: ps, y: ps.map(ll), color: 'blue', width: 2.4, label: 'log-loss' },
          { type: 'vline', x: s.p, color: 'ink', dash: '3 3', width: 1.2 },
          { type: 'points', x: [s.p, s.p, s.p], y: [zeroOne(s.p), sq(s.p), ll(s.p)], color: (i) => ['ink2', 'orange', 'blue'][i], r: 5 },
        ]);
      } else {
        const zo = (v) => (v < 0 ? 1 : 0);
        const lm = (v) => Math.log1p(Math.exp(-v));
        plot.render([
          { type: 'vband', x0: -5, x1: 0, color: 'critical', opacity: 0.05 },
          { type: 'line', x: ms, y: ms.map(zo), color: 'ink2', width: 2, curve: 'step', label: '0–1: [m < 0]' },
          { type: 'line', x: ms, y: ms.map((v) => Math.exp(-v)), color: 'orange', width: 2, label: 'экспоненциальная e^{−m} (AdaBoost)' },
          { type: 'line', x: ms, y: ms.map(lm), color: 'blue', width: 2.4, label: 'log-loss ln(1 + e^{−m})' },
          { type: 'vline', x: m, color: 'ink', dash: '3 3', width: 1.2 },
          { type: 'points', x: [m, m, m], y: [zo(m), Math.exp(-m), lm(m)], color: (i) => ['ink2', 'orange', 'blue'][i], r: 5 },
          { type: 'text', items: [{ x: -4.8, y: 4.4, text: 'ошибка: m < 0' }, { x: 0.2, y: 4.4, text: 'верно: m > 0' }] },
        ]);
      }
      stats.set('zo', String(zeroOne(s.p)));
      stats.set('sq', U.fmt(sq(s.p), 3));
      stats.set('ll', U.fmt(ll(s.p), 3));
      stats.set('F', U.fmt(logit(s.p), 3));
      stats.set('m', signed(m, 3));
      const conf = s.y === 1 ? s.p : 1 - s.p;
      note.innerHTML = s.axis === 'p'
        ? '0–1 потеря видит только «угадал / не угадал» и не различает прогнозы 0.51 и 0.99; у неё нет наклона, по которому можно спускаться. ' +
          'Log-loss гладкая и <b>сурово наказывает уверенные ошибки</b>: сейчас вероятность правильного класса ' + U.fmt(conf, 2) + ', потеря ' + U.fmt(ll(s.p), 3) +
          (conf < 0.1 ? ' — модель уверенно ошиблась, и это дорого.' : conf > 0.9 ? ' — уверенный и верный прогноз почти бесплатен.' : '.') + ' Именно log-loss минимизирует бустинг для классификации (урок 6.1).'
        : 'Отступ m = ỹ·F объединяет оба класса: ỹ = +1 для y = 1 и −1 для y = 0, F — логит. m > 0 — класс угадан, и чем больше m, тем увереннее. Сейчас m = ' + signed(m, 2) + '. ' +
          'Обе гладкие потери — «заменители» ступеньки 0–1: убывают с ростом m и лежат над ней (log-loss — с точностью до множителя 1/ln 2). Экспоненциальная растёт при ошибке как e<sup>|m|</sup> — поэтому AdaBoost так чувствителен к ошибочным меткам; log-loss растёт лишь линейно.';
    }
    w.pythonAction(() =>
      'import numpy as np\n\ny, p = ' + s.y + ', ' + U.pyNum(s.p) + '\nF = np.log(p / (1 - p))          # логит\nm = (2 * y - 1) * F              # отступ\n' +
      'print("0–1:", int((p >= 0.5) != y))\nprint("квадрат:", (y - p) ** 2)\n' +
      'print("log-loss:", -(y * np.log(p) + (1 - y) * np.log(1 - p)), "= ln(1 + e^(−m)):", np.log1p(np.exp(-m)))\nprint("экспоненциальная e^(−m):", np.exp(-m))\n'
    );
    build();
    draw();
  });

  /* =================================================================================
   * logloss-constant — лучшая вероятность для log-loss и стартовый логит
   * ================================================================================= */
  GBC.widget('logloss-constant', (el) => {
    const n = 10;
    const s = { k: 3, p: 0.5, axis: 'p' };
    const w = ui.shell(el, {
      title: 'Лучшая константа для log-loss',
      sub: 'Десять клиентов, k из них не вернули кредит (y = 1). Модель-константа даёт всем одну вероятность p. Какая p лучшая? Пунктиры — вклады двух групп: единицы тянут p вверх, нули — вниз.',
    });
    ui.slider(w.controls, { label: 'Клиентов с y = 1: k из 10', min: 1, max: 9, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const pCtl = ui.slider(w.controls, { label: 'Ваша вероятность p', min: 0.01, max: 0.99, step: 0.01, value: s.p, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.p = v), draw()) });
    ui.button(w.controls, { label: 'В минимум', small: true, kind: 'primary', onClick: () => ((s.p = s.k / n), pCtl.set(s.p), draw()) });
    ui.segmented(w.controls, { label: 'Ось X', options: [{ value: 'p', label: 'вероятность p' }, { value: 'F', label: 'логит F' }], value: s.axis, onChange: (v) => ((s.axis = v), build(), draw()) });
    const strip = new GBC.Plot(w.main, { height: 90, x: { label: 'клиенты', domain: [0.4, 10.6], ticks: [] }, y: { domain: [-1, 1], hide: true }, grid: false });
    const holder = H('div');
    w.main.appendChild(holder);
    let plot = null;
    function build() {
      holder.textContent = '';
      plot = s.axis === 'p'
        ? new GBC.Plot(holder, { height: 280, x: { label: 'вероятность p для всех', domain: [0, 1] }, y: { label: 'средний log-loss', domain: [0, 2.5] }, crosshair: true, crosshairTitle: (v) => 'p = ' + U.fmt(v, 2) })
        : new GBC.Plot(holder, { height: 280, x: { label: 'логит F = ln(p/(1−p))', domain: [-4.5, 4.5] }, y: { label: 'средний log-loss', domain: [0, 2.5] }, crosshair: true, crosshairTitle: (v) => 'F = ' + U.fmt(v, 2) });
    }
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'share', label: 'Доля k/n' }, { key: 'F0', label: 'Стартовый логит F₀' }, { key: 'yours', label: 'Log-loss: ваш / минимум' }, { key: 'force', label: 'Сумма сил Σ(y_i − p)' }]);
    const ll = (k, p) => -((k / n) * Math.log(p) + (1 - k / n) * Math.log(1 - p));
    function draw() {
      const k = s.k;
      const best = k / n;
      const xsP = U.linspace(0.01, 0.99, 197);
      const toX = (p) => (s.axis === 'p' ? p : Math.log(p / (1 - p)));
      const xsF = U.linspace(-4.5, 4.5, 181);
      const grid = s.axis === 'p' ? xsP : xsF.map(U.sigmoid);
      const X = grid.map(toX);
      strip.render([
        { type: 'points', x: U.range(n).map((i) => i + 1), y: U.range(n).map(() => 0), color: (i) => (i < k ? 'class1' : 'class0'), r: 8, tooltip: (i) => [{ label: 'клиент', value: String(i + 1) }, { label: 'y', value: i < k ? '1 (не вернул)' : '0 (вернул)' }, { label: 'сила y − p', value: signed((i < k ? 1 : 0) - s.p, 2) }] },
        { type: 'text', items: U.range(n).map((i) => ({ x: i + 1, y: 0, dy: 4, anchor: 'middle', text: i < k ? '1' : '0', color: 'surface', bold: true })) },
      ]);
      plot.render([
        { type: 'line', x: X, y: grid.map((p) => -(k / n) * Math.log(p)), color: 'class1', width: 1.4, dash: '5 4', label: 'вклад единиц: −(k/n)·ln p' },
        { type: 'line', x: X, y: grid.map((p) => -(1 - k / n) * Math.log(1 - p)), color: 'class0', width: 1.4, dash: '5 4', label: 'вклад нулей: −(1 − k/n)·ln(1 − p)' },
        { type: 'line', x: X, y: grid.map((p) => ll(k, p)), color: 'ink', width: 2.4, label: 'средний log-loss' },
        { type: 'points', x: [toX(best)], y: [ll(k, best)], color: 'tree', r: 6, label: 'минимум' },
        { type: 'points', x: [toX(s.p)], y: [ll(k, s.p)], color: 'ink', r: 5, hollow: true, label: 'ваше p' },
      ]);
      const F0 = Math.log(best / (1 - best));
      const force = k * (1 - s.p) - (n - k) * s.p;
      stats.set('share', U.fmt(best, 2));
      stats.set('F0', signed(F0, 3));
      stats.set('yours', U.fmt(ll(k, s.p), 3) + ' / ' + U.fmt(ll(k, best), 3));
      stats.set('force', signed(force, 2));
      note.innerHTML = 'Средний log-loss = −[' + k + '·ln p + ' + (n - k) + '·ln(1 − p)] / 10. Производная по p равна нулю, когда ' + k + '/p = ' + (n - k) + '/(1 − p), то есть при <b>p = k/n = ' + U.fmt(best, 2) + '</b>: лучшая вероятность — доля единиц. ' +
        'Сейчас p = ' + U.fmt(s.p, 2) + ', сумма сил Σ(y_i − p) = ' + signed(force, 2) + (Math.abs(force) < 1e-9 ? ' — равновесие.' : force > 0 ? ': единицы перетягивают, p выгодно увеличить.' : ': нули перетягивают, p выгодно уменьшить.') +
        ' Бустинг начинает не с p, а с логита: F₀ = ln(' + k + '/' + (n - k) + ') = ' + signed(F0, 3) + (s.axis === 'F' ? '. По оси логита кривая — гладкая «чаша» без краёв: F может быть любым числом.' : '.');
    }
    w.pythonAction(() =>
      'import numpy as np\n\ny = np.array([1] * ' + s.k + ' + [0] * ' + (n - s.k) + ')\np = ' + U.pyNum(s.p) + '\n' +
      'logloss = lambda p: -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))\n' +
      'print("log-loss при p:", logloss(p), "  при доле y.mean():", logloss(y.mean()))\nprint("сумма сил Σ(y − p):", np.sum(y - p))\n' +
      'print("стартовый логит F0 =", np.log(y.mean() / (1 - y.mean())))\n'
    );
    build();
    draw();
  });

  /* =================================================================================
   * boost-step — первый шаг бустинга руками на пяти числах
   * ================================================================================= */
  GBC.widget('boost-step', (el) => {
    const X = [1, 2, 3, 4, 5];
    const Y = [1, 2, 3, 4, 10];
    const SPLITS = [1.5, 2.5, 3.5, 4.5];
    const s = { loss: 'squared', split: 'best', nu: 1 };
    const params = { delta: 3, alpha: 0.9 };
    const w = ui.shell(el, {
      title: 'Первый шаг бустинга руками',
      sub: 'Пять точек (x = 1…5, y = 1, 2, 3, 4, 10). Бустинг стартует с константы F₀, считает псевдо-остатки, строит по ним пень (одно разбиение) и ставит в каждый лист лучшую добавку γ для своих потерь. Хьюбер — с δ = 3, квантиль — с α = 0.9.',
    });
    ui.segmented(w.controls, { label: 'Функция потерь', options: SHORT_OPTIONS, value: s.loss, onChange: (v) => ((s.loss = v), draw()) });
    ui.select(w.controls, { label: 'Разбиение пня', options: [{ value: 'best', label: 'лучшее по псевдо-остаткам' }, ...SPLITS.map((v) => ({ value: String(v), label: 'x ≤ ' + v })) ], value: s.split, onChange: (v) => ((s.split = v), draw()) });
    ui.slider(w.controls, { label: 'Темп обучения ν', min: 0.1, max: 1, step: 0.1, value: s.nu, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.nu = v), draw()) });
    const top = new GBC.Plot(w.main, { height: 260, x: { label: 'x', domain: [0.4, 5.6], ticks: X }, y: { label: 'y и прогноз', domain: [0, 11.5] } });
    const bottom = new GBC.Plot(w.main, { height: 190, x: { label: 'x', domain: [0.4, 5.6], ticks: X }, y: { label: 'псевдо-остаток −∂L/∂F' } });
    const showTable = tableBox(w.main);
    const showSplits = tableBox(w.main);
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'F0', label: 'Старт F₀' }, { key: 'split', label: 'Разбиение' }, { key: 'gamma', label: 'γ слева / справа' }, { key: 'risk', label: 'Средние потери: до → после' }]);
    function draw() {
      const loss = GBC.losses.get(s.loss, params);
      const F0 = loss.init(Y);
      const F = Y.map(() => F0);
      const g = loss.negativeGradient(Y, F);
      const sse = SPLITS.map((t) => {
        const L = g.filter((_, i) => X[i] < t);
        const R = g.filter((_, i) => X[i] > t);
        const ml = U.mean(L);
        const mr = U.mean(R);
        return U.sum(L.map((v) => (v - ml) ** 2)) + U.sum(R.map((v) => (v - mr) ** 2));
      });
      let bi = 0;
      sse.forEach((v, i) => {
        if (v < sse[bi] - 1e-12) bi = i;
      });
      const t = s.split === 'best' ? SPLITS[bi] : Number(s.split);
      const left = X.map((x) => x < t);
      const pick = (arr, side) => arr.filter((_, i) => left[i] === side);
      const gamma = [loss.leafValue(pick(Y, true), pick(F, true)), loss.leafValue(pick(Y, false), pick(F, false))];
      const fitG = [U.mean(pick(g, true)), U.mean(pick(g, false))];
      const F1 = X.map((_, i) => F0 + s.nu * gamma[left[i] ? 0 : 1]);
      const r0 = loss.loss(Y, F);
      const r1 = loss.loss(Y, F1);
      top.render([
        { type: 'hline', y: F0, color: 'model-prev', width: 1.6, dash: '5 4', text: 'F₀ = ' + U.fmt(F0, 2) },
        { type: 'vline', x: t, color: 'ink2', width: 1, dash: '3 3' },
        { type: 'steps', segments: [{ x0: 0.4, x1: t, value: F1[0] }, { x0: t, x1: 5.6, value: F1[4] }], color: 'model', width: 2.4, label: 'F₁ = F₀ + ν·γ' },
        { type: 'segments', x1: X, y1: F1, x2: X, y2: Y, color: 'residual', width: 1.2, dash: '3 3' },
        { type: 'points', x: X, y: Y, color: 'data', r: 6, label: 'данные', tooltip: (i) => [{ label: 'y', value: String(Y[i]) }, { label: 'F₀', value: U.fmt(F0, 3) }, { label: 'F₁', value: U.fmt(F1[i], 3) }] },
      ]);
      bottom.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'bars', x: X, y: g, width: 0.5, maxPx: 40, color: (i) => (g[i] >= 0 ? 'pos' : 'neg'), tooltip: (i) => [{ label: 'x', value: String(X[i]) }, { label: '−∂L/∂F', value: signed(g[i], 3) }] },
        { type: 'steps', segments: [{ x0: 0.4, x1: t, value: fitG[0] }, { x0: t, x1: 5.6, value: fitG[1] }], color: 'tree', width: 2.4, label: 'пень по псевдо-остаткам' },
        { type: 'vline', x: t, color: 'ink2', width: 1, dash: '3 3' },
      ]);
      showTable({
        columns: ['x', 'y', 'F₀', '−∂L/∂F', 'лист', 'γ листа', 'F₁'],
        rows: X.map((x, i) => [String(x), String(Y[i]), U.fmt(F0, 3), signed(g[i], 3), left[i] ? 'левый' : 'правый', signed(gamma[left[i] ? 0 : 1], 3), U.fmt(F1[i], 3)]),
      });
      showSplits({
        columns: ['Разбиение', ...SPLITS.map((v) => 'x ≤ ' + v)],
        rows: [['Разброс псевдо-остатков в листах', ...sse.map((v, i) => U.fmt(v, 3) + (i === bi ? ' ★' : ''))]],
        numeric: false,
      });
      stats.set('F0', U.fmt(F0, 3));
      stats.set('split', 'x ≤ ' + t);
      stats.set('gamma', signed(gamma[0], 3) + ' / ' + signed(gamma[1], 3));
      stats.set('risk', U.fmt(r0, 3) + ' → ' + U.fmt(r1, 3));
      const tie = sse.filter((v) => Math.abs(v - sse[bi]) < 1e-12).length > 1;
      note.innerHTML = {
        squared: 'L2: псевдо-остатки — обычные остатки, и самый большой (+6) у точки 10. Лучший пень отрезает её одну: дерево тратит своё единственное разбиение на выброс. Значение листа — средний остаток, оно совпадает со «средним псевдо-остатком» пня.',
        absolute: 'L1: псевдо-остатки — знаки (−1, −1, 0, +1, +1), выброс голосует как обычная точка.' + (tie ? ' Разбиения x ≤ 2.5 и x ≤ 3.5 одинаково хороши; берём первое.' : '') + ' Пень делит основную массу, а значение листа — медиана остатков, а не среднее знаков: справа медиана остатков 0, 1, 7 — это 1, выброс почти не влияет.',
        huber: 'Хьюбер, δ = 3: старт — медиана 3 (как в scikit-learn), псевдо-остаток выброса обрезан с 7 до 3. Значение листа — шаг Фридмана: медиана остатков листа плюс средняя обрезанная поправка.',
        quantile: 'Квантиль 0.9: старт F₀ = ' + U.fmt(F0, 2) + ' (интерполированная квантиль). Псевдо-остатки — 0.9 выше F₀ и −0.1 ниже. Значение листа — 0.9-квантиль остатков в листе.',
      }[s.loss] + ' «Разброс» в таблице — сумма квадратов отклонений псевдо-остатков от среднего своего листа: пень выбирает разбиение с наименьшим. Средние потери упали с ' + U.fmt(r0, 3) + ' до ' + U.fmt(r1, 3) + (s.nu < 1 ? ' — с темпом ν = ' + U.fmt(s.nu, 1) + ' шаг осторожнее, остальное доделают следующие деревья.' : '.');
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import get_loss\n\nx = np.arange(1, 6.0)\ny = np.array([1, 2, 3, 4, 10.0])\n' +
      'loss = get_loss("' + s.loss + '"' + lossArgs(s.loss, params) + ')\nF = np.full_like(y, loss.init(y))       # шаг 0: лучшая константа\n' +
      'g = loss.negative_gradient(y, F)        # шаг 1: псевдо-остатки\n' +
      'sse = {t: sum(((g[m] - g[m].mean()) ** 2).sum() for m in (x < t, x > t)) for t in (1.5, 2.5, 3.5, 4.5)}\n' +
      't = min(sse, key=sse.get)               # шаг 2: лучшее разбиение пня\nleft = x < t\n' +
      'gamma = {side: loss.leaf_value(y[m], F[m]) for side, m in (("L", left), ("R", ~left))}   # шаг 3: значения листьев\n' +
      'nu = ' + U.pyNum(s.nu) + '\nF1 = F + nu * np.where(left, gamma["L"], gamma["R"])\n' +
      'print("F0 =", F[0], " g =", g, " разбиение x ≤", t, " γ =", gamma)\nprint("F1 =", F1, " потери:", loss.loss(y, F), "→", loss.loss(y, F1))\n'
    );
    draw();
  });
})();
