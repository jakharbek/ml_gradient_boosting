/* Урок 15.11, часть 2 — численные методы, второй порядок и системы, дифференциальные уравнения в ML.
 * Виджеты: шаги Эйлера, ошибка и порядок (с экстраполяцией Ричардсона), устойчивость hλ < 2, жёсткое уравнение,
 * области устойчивости на комплексной плоскости, анатомия шага Хойна и Рунге — Кутты, сравнение методов,
 * адаптивный шаг, затухающий осциллятор, фазовые портреты линейных систем, маятник, хищник — жертва, SIR,
 * дрейф энергии, градиентный поток и спуск, обусловленность, моментум как шарик с трением, бустинг как
 * метод Эйлера, неявный шаг и λ в XGBoost, тренажёр. Помощники — из lesson.js (GBC.lesson1511). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const {
    f2, f3, f4, f6, py, sci, powFmt, logAxis, yDom, clampArr,
    texInto, badge, rowTable, plural, onTheme,
    stepODE, solveODE, fieldArrows, PY_RK4,
  } = GBC.lesson1511;
  const R = String.raw;
  const PI = Math.PI;
  /** Точки (x, y) вне квадрата [lo, hi]² → разрыв линии (NaN в обеих координатах). */
  function xyClamp(xs, ys, lo, hi) {
    const ok = (i) => Number.isFinite(xs[i]) && Number.isFinite(ys[i]) && xs[i] >= lo && xs[i] <= hi && ys[i] >= lo && ys[i] <= hi;
    return { x: xs.map((v, i) => (ok(i) ? v : NaN)), y: ys.map((v, i) => (ok(i) ? v : NaN)) };
  }
  const MCOL = { euler: 'tree', heun: 'aqua', mid: 'magenta', rk4: 'violet', implicit: 'model', sympl: 'green' };
  const MNAME = { euler: 'Эйлер', heun: 'Хойн', mid: 'средняя точка', rk4: 'Рунге — Кутта 4', implicit: 'неявный Эйлер', sympl: 'симплектический Эйлер' };

  /* ==============================================================================
   * Шаг 13. Метод Эйлера: шаг по касательной
   * ============================================================================== */
  const EE = {
    grow: { label: 'y′ = y, y(0) = 1 на [0, 1]', f: (t, y) => y, y0: 1, T: 1, exact: (t) => Math.exp(t), sol: (t0, y0) => (t) => y0 * Math.exp(t - t0), pyf: 'y', pyex: 'math.exp(t)' },
    decay: { label: 'y′ = −y, y(0) = 1 на [0, 2]', f: (t, y) => -y, y0: 1, T: 2, exact: (t) => Math.exp(-t), sol: (t0, y0) => (t) => y0 * Math.exp(-(t - t0)), pyf: '-y', pyex: 'math.exp(-t)' },
    tmy: { label: 'y′ = t − y, y(0) = 1 на [0, 2]', f: (t, y) => t - y, y0: 1, T: 2, exact: (t) => t - 1 + 2 * Math.exp(-t), sol: (t0, y0) => (t) => t - 1 + (y0 - t0 + 1) * Math.exp(-(t - t0)), pyf: 't - y', pyex: 't - 1 + 2 * math.exp(-t)' },
    logi: { label: 'y′ = y(1 − y), y(0) = 0.1 на [0, 6]', f: (t, y) => y * (1 - y), y0: 0.1, T: 6, exact: (t) => 1 / (1 + 9 * Math.exp(-t)), sol: (t0, y0) => (t) => 1 / (1 + ((1 - y0) / y0) * Math.exp(-(t - t0))), pyf: 'y * (1 - y)', pyex: '1 / (1 + 9 * math.exp(-t))' },
  };
  GBC.widget('euler-steps', (el) => {
    const s = { key: 'grow', h: 0.25, k: 4, local: true };
    const w = ui.shell(el, { title: 'Метод Эйлера: шаг по касательной', sub: 'В текущей точке считаем наклон f(tₙ, yₙ), идём по нему на h вперёд, повторяем. Пунктир — точное решение. Фиолетовая кривая — точное решение, проходящее через текущую точку: каждый шаг Эйлера «перепрыгивает» с одной кривой семейства на соседнюю.' });
    ui.select(w.controls, { label: 'Уравнение', value: s.key, options: Object.entries(EE).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), reset(), draw()) });
    ui.slider(w.controls, { label: 'Шаг h', values: [1, 0.5, 0.25, 0.1, 0.05], value: s.h, format: String, onInput: (v) => ((s.h = v), reset(), draw()) });
    const pl = ui.player(w.controls, { label: 'Шаги', min: 0, max: 4, value: 4, fps: 2, format: (v, m) => 'шаг ' + v + ' из ' + m, onChange: (v) => ((s.k = v), draw()) });
    ui.toggle(w.controls, { label: 'Решение через текущую точку', checked: s.local, onChange: (v) => ((s.local = v), draw()) });
    function reset() {
      const n = Math.round(EE[s.key].T / s.h);
      pl.setMax(n);
      s.k = n;
      pl.set(n);
    }
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 't' }, y: { label: 'y' } });
    const tbl = H('div', { class: 'table-wrap', style: 'margin-top:6px' });
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'y', label: 'Эйлер в конце' }, { key: 'e', label: 'точно' }, { key: 'err', label: 'ошибка' }]);
    function draw() {
      const E = EE[s.key];
      const n = Math.round(E.T / s.h);
      const sol = solveODE(E.f, 0, E.y0, E.T, n, 'euler');
      const k = Math.min(s.k, n);
      const fine = U.linspace(0, E.T, 300);
      const ex = fine.map(E.exact);
      const layers = [{ type: 'line', x: fine, y: ex, color: 'model', width: 2, dash: '6 4', label: 'точное решение', hover: false }];
      if (s.local && k > 0) {
        const g = E.sol(sol.ts[k], sol.ys[k]);
        layers.push({ type: 'line', x: fine, y: fine.map(g), color: 'violet', width: 1.6, opacity: 0.8, label: 'решение через текущую точку', hover: false });
      }
      layers.push({ type: 'line', x: sol.ts.slice(0, k + 1), y: sol.ys.slice(0, k + 1), color: 'tree', width: 2.4, hover: false });
      if (k < n) {
        const t = sol.ts[k];
        const y = sol.ys[k];
        layers.push({ type: 'arrows', x1: [t], y1: [y], x2: [t + s.h], y2: [y + s.h * E.f(t, y)], color: 'tree', width: 1.6, opacity: 0.6 });
      }
      layers.push({ type: 'points', x: sol.ts.slice(0, k + 1), y: sol.ys.slice(0, k + 1), color: 'tree', r: 5, label: 'шаги Эйлера', tooltip: (i) => [['t', f3(sol.ts[i])], ['yₙ', f6(sol.ys[i])], ['наклон f', f4(E.f(sol.ts[i], sol.ys[i]))], ['точно', f6(E.exact(sol.ts[i]))]] });
      plot.render(layers, { x: [0, E.T], y: yDom(ex.concat(sol.ys), 0.06) });
      const rows = [];
      for (let i = Math.max(0, k - 5); i < Math.min(k, n); i++) {
        const fv = E.f(sol.ts[i], sol.ys[i]);
        rows.push([String(i), f3(sol.ts[i]), f6(sol.ys[i]), f4(fv), f6(sol.ys[i]) + ' + ' + s.h + '·' + f4(fv) + ' = ' + f6(sol.ys[i + 1])]);
      }
      rowTable(tbl, ['n', 'tₙ', 'yₙ', 'f(tₙ, yₙ)', 'yₙ₊₁ = yₙ + h·f'], rows.length ? rows : [['—', '—', '—', '—', 'нажмите «шаг вперёд»']], (i) => i === rows.length - 1);
      const yEnd = sol.ys[n];
      st.set('y', f6(yEnd));
      st.set('e', f6(E.exact(E.T)));
      st.set('err', sci(Math.abs(yEnd - E.exact(E.T))));
      const msg = {
        grow: 'Для y′ = y каждый шаг умножает y на (1 + h): за 1/h шагов получается (1 + h)<sup>1/h</sup>. При h = 0.25 это 2.4414, при 0.1 — 2.5937, при 0.01 — 2.7048, а точно e = 2.7183. Метод Эйлера — это второй замечательный предел из урока 15.4, сосчитанный по шагам. Решение выпукло, касательная лежит под ним — Эйлер систематически отстаёт.',
        decay: 'y ← (1 − h)·y: за 2/h шагов (1 − h)<sup>2/h</sup>. При h = 0.5 это 0.0625, при 0.1 — 0.1216, при 0.01 — 0.1340; точно e⁻² = 0.1353. При h = 1 первый же шаг даёт ровно ноль — грубая ошибка, но ещё не катастрофа (шаг 15).',
        tmy: 'y′ = t − y при h = 0.5 даёт 1 → 0.5 → 0.5 → 0.75 → 1.125, а точно y(2) = 1 + 2e⁻² ≈ 1.2707. Фиолетовые кривые показывают, что ошибка накапливается: каждый шаг сбивает на соседнее решение, и дальше мы идём уже по нему.',
        logi: 'Логистическое уравнение: даже при h = 1 Эйлер узнаёт S-образную форму, хотя разгоняется с запаздыванием. У потолка он не взрывается: около равновесия y = 1 уравнение ведёт себя как y′ ≈ −(y − 1), и шаг устойчив при h < 2 (шаг 15).',
      };
      note.innerHTML = msg[s.key] + ' Метод Эйлера — то же линейное приближение y(t + h) ≈ y(t) + y′(t)·h из урока 15.5, применённое много раз подряд.';
    }
    w.pythonAction(() => {
      const E = EE[s.key];
      return 'import math\n\nf = lambda t, y: ' + E.pyf + '\nexact = lambda t: ' + E.pyex + '\nh, T = ' + py(s.h) + ', ' + py(E.T) + '\n\nt, y = 0.0, ' + py(E.y0) + '\nfor n in range(round(T / h)):\n    slope = f(t, y)\n    print(f"n = {n:2d}: t = {t:.3f}, y = {y:.6f}, наклон {slope:+.4f}")\n    y += h * slope            # шаг по касательной\n    t += h\nprint("Эйлер:", y, " точно:", exact(T), " ошибка:", abs(y - exact(T)))\n';
    });
    reset();
    draw();
  });

  /* ==============================================================================
   * Шаг 14. Ошибка: локальная, глобальная, порядок; экстраполяция Ричардсона
   * ============================================================================== */
  GBC.widget('euler-error', (el) => {
    const s = { j: 3, rich: true };
    const HS = U.range(11).map((j) => Math.pow(2, -j));
    const w = ui.shell(el, { title: 'Порядок метода: ошибка ~ h', sub: 'y′ = y, y(0) = 1, считаем y(1) = e методом Эйлера с шагами h = 1, ½, ¼, … Сверху — ошибка в зависимости от h в логарифмическом масштабе: прямая с наклоном 1 значит «ошибка пропорциональна h». Снизу — сам расчёт для выбранного h.' });
    ui.slider(w.controls, { label: 'Шаг h', values: HS, value: HS[s.j], format: (v) => (v >= 0.01 ? String(v) : '1/' + Math.round(1 / v)), onInput: (v) => ((s.j = HS.indexOf(v)), draw()) });
    ui.toggle(w.controls, { label: 'Экстраполяция Ричардсона 2·y_{h/2} − y_h', checked: s.rich, onChange: (v) => ((s.rich = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 280, x: { label: 'шаг h (лог.)', type: 'log', domain: [5e-4, 1.5], ticks: [0.001, 0.01, 0.1, 1], format: powFmt }, y: { label: 'ошибка в t = 1 (лог.)', type: 'log', domain: [1e-7, 2], ticks: [1e-6, 1e-4, 1e-2, 1], format: powFmt } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 't', domain: [0, 1] }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'ошибка E(h)' }, { key: 'e2', label: 'E(h/2)' }, { key: 'r', label: 'E(h) / E(h/2)' }, { key: 'R', label: 'Ричардсон: ошибка' }]);
    const eul = (h) => Math.pow(1 + h, Math.round(1 / h));
    function draw() {
      const errs = HS.map((h) => Math.abs(eul(h) - Math.E));
      const rich = HS.map((h) => Math.abs(2 * eul(h / 2) - eul(h) - Math.E));
      const h = HS[s.j];
      p1.render([
        { type: 'line', x: [1e-3, 1], y: [1.4e-3, 1.4], color: 'muted', width: 1.2, dash: '4 4', label: 'наклон 1: ~h', hover: false },
        s.rich ? { type: 'line', x: [1e-3, 1], y: [1e-6, 1], color: 'muted', width: 1.2, dash: '1 4', label: 'наклон 2: ~h²', hover: false } : null,
        { type: 'line', x: HS, y: errs, color: 'tree', width: 2.2, hover: false },
        { type: 'points', x: HS, y: errs, color: (i) => (i === s.j ? 'ink' : 'tree'), legendColor: 'tree', r: (i) => (i === s.j ? 6.5 : 4), label: 'Эйлер', tooltip: (i) => [['h', String(HS[i])], ['ошибка', sci(errs[i])]] },
        s.rich ? { type: 'line', x: HS, y: rich, color: 'violet', width: 2.2, hover: false } : null,
        s.rich ? { type: 'points', x: HS, y: rich, color: 'violet', r: 4, label: 'Ричардсон', tooltip: (i) => [['h', String(HS[i])], ['ошибка', sci(rich[i])]] } : null,
      ]);
      const n = Math.round(1 / h);
      const sol = solveODE((t, y) => y, 0, 1, 1, n, 'euler');
      const fine = U.linspace(0, 1, 200);
      const gaps = { x1: sol.ts, x2: sol.ts, y1: sol.ys, y2: sol.ts.map(Math.exp) };
      p2.render([
        { type: 'line', x: fine, y: fine.map(Math.exp), color: 'model', width: 2, dash: '6 4', label: 'eᵗ', hover: false },
        { type: 'segments', ...gaps, color: 'critical', width: 1.4, opacity: 0.8 },
        { type: 'line', x: sol.ts, y: sol.ys, color: 'tree', width: 1.8, hover: false },
        n <= 64 ? { type: 'points', x: sol.ts, y: sol.ys, color: 'tree', r: 3.5, label: 'Эйлер' } : null,
      ], { x: [0, 1], y: [0.95, 2.8] });
      const e1 = errs[s.j];
      const e2 = Math.abs(eul(h / 2) - Math.E);
      st.set('e', sci(e1));
      st.set('e2', sci(e2));
      st.set('r', f3(e1 / e2));
      st.set('R', sci(rich[s.j]));
      note.innerHTML = '<b>Локальная ошибка</b> одного шага — остаток формулы Тейлора: y(t + h) − [y + h·y′] = h²/2·y″(ξ), то есть ~h². Шагов 1/h, ошибки складываются (и немного усиливаются), поэтому <b>глобальная ошибка</b> ~ h²·(1/h) = h — метод <b>первого порядка</b>: уменьшили шаг вдвое — ошибка уменьшилась примерно вдвое (сейчас в ' + f3(e1 / e2) + ' раза). Отсюда трюк Ричардсона: раз E(h) ≈ C·h, то 2·y<sub>h/2</sub> − y<sub>h</sub> сокращает главную часть ошибки. Из 2.5937 (h = 0.1) и 2.6533 (h = 0.05) получается 2.7129 — ошибка 0.0054 вместо 0.065. Так из метода первого порядка получается второй — это идея метода Хойна (шаг 17).';
    }
    w.pythonAction(() => 'import math\n\nfor k in range(11):\n    h = 2.0 ** -k\n    yh = (1 + h) ** round(1 / h)          # Эйлер для y′ = y, y(0) = 1, до t = 1\n    yh2 = (1 + h / 2) ** round(2 / h)\n    print(f"h = {h:.5f}: ошибка {abs(yh - math.e):.3e}, отношение E(h)/E(h/2) = {abs(yh - math.e) / abs(yh2 - math.e):.3f}, "\n          f"Ричардсон {abs(2 * yh2 - yh - math.e):.3e}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 15. Устойчивость: hλ < 2
   * ============================================================================== */
  GBC.widget('stability', (el) => {
    const s = { hl: 0.5, imp: false };
    const w = ui.shell(el, { title: 'Устойчивость: слишком большой шаг взрывает решение', sub: 'Уравнение y′ = −λy: точное решение всегда затухает. Метод Эйлера умножает y на (1 − hλ) за шаг — всё решает произведение hλ. Двигайте его и сравните с неявным методом (шаг 16).' });
    ui.slider(w.controls, { label: 'Шаг × жёсткость: hλ', min: 0.05, max: 2.5, step: 0.05, value: s.hl, format: f2, onInput: (v) => ((s.hl = v), draw()) });
    ui.toggle(w.controls, { label: 'Неявный Эйлер: множитель 1/(1 + hλ)', checked: s.imp, onChange: (v) => ((s.imp = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'номер шага n', domain: [0, 20] }, y: { label: 'yₙ', domain: [-2.2, 2.2] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'q', label: 'множитель 1 − hλ' }, { key: 'v', label: 'поведение' }, { key: 'y', label: 'y₂₀' }, { key: 'i', label: 'неявный: множитель' }]);
    function draw() {
      const hl = s.hl;
      const q = 1 - hl;
      const ns = U.range(21);
      const ys = ns.map((n) => Math.pow(q, n));
      const yi = ns.map((n) => Math.pow(1 / (1 + hl), n));
      plot.render([
        { type: 'rect', x0: 0, x1: 20, y0: -1, y1: 1, fill: 'good', opacity: 0.06 },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: ns, y: ns.map((n) => Math.exp(-hl * n)), color: 'model', width: 2, dash: '6 4', label: 'точно e^{−λt}', hover: false },
        { type: 'line', x: ns, y: clampArr(ys, -3, 3), color: 'tree', width: 1.4, hover: false },
        { type: 'points', x: ns, y: clampArr(ys, -3, 3), color: 'tree', r: 4, label: 'Эйлер', tooltip: (i) => [['n', String(i)], ['yₙ', sci(ys[i])]] },
        s.imp ? { type: 'points', x: ns, y: yi, color: 'violet', r: 3.5, shape: 'square', label: 'неявный Эйлер', tooltip: (i) => [['n', String(i)], ['yₙ', sci(yi[i])]] } : null,
      ]);
      const verdict = hl < 1 - 1e-9 ? 'плавно затухает' : Math.abs(hl - 1) < 1e-9 ? 'сразу в ноль' : hl < 2 - 1e-9 ? 'затухает зигзагом' : Math.abs(hl - 2) < 1e-9 ? 'качается вечно' : 'разлетается';
      st.set('q', f3(q));
      st.set('v', verdict);
      st.set('y', sci(ys[20]));
      st.set('i', f3(1 / (1 + hl)));
      note.innerHTML = '|1 − hλ| &lt; 1 ⇔ <b>0 &lt; hλ &lt; 2</b>. После 10 шагов: при hλ = 0.5 или 1.5 остаётся ≈ 0.001, при 1.9 — 0.349 (медленный зигзаг), при 2.1 — уже 2.59 и растёт. Точное решение от h не зависит — неустойчивость принадлежит <b>методу</b>, а не уравнению. Узнаёте? Та же граница у градиентного спуска (η &lt; 2/a, урок 1.3) и у темпа бустинга (ν &lt; 2, урок 15.10): оба — метод Эйлера для «градиентного потока» (шаги 24 и 27). Неявный метод затухает при любом шаге.';
    }
    w.pythonAction(() => 'hl = ' + py(s.hl) + '          # произведение шага на жёсткость\ny_exp = y_imp = 1.0\nfor n in range(1, 21):\n    y_exp *= 1 - hl          # явный Эйлер\n    y_imp /= 1 + hl          # неявный Эйлер\n    if n % 5 == 0:\n        print(f"n = {n:2d}: явный {y_exp:+.5f}, неявный {y_imp:.5f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 15. Жёсткое уравнение
   * ============================================================================== */
  GBC.widget('stiff', (el) => {
    const s = { h: 0.03, m: 'both' };
    const LAM = 50;
    const w = ui.shell(el, { title: 'Жёсткое уравнение: y′ = −50·(y − cos t)', sub: 'Решение быстро (за сотые доли) прилипает к медленной кривой ≈ cos t и дальше меняется плавно. Казалось бы, шаг можно брать крупным — но явный Эйлер устойчив только при 50h < 2, то есть h < 0.04. Неявный метод этого ограничения не знает.' });
    ui.slider(w.controls, { label: 'Шаг h', values: [0.005, 0.01, 0.02, 0.03, 0.039, 0.041, 0.05, 0.1, 0.2], value: s.h, format: String, onInput: (v) => ((s.h = v), draw()) });
    ui.segmented(w.controls, { label: 'Метод', value: s.m, options: [{ value: 'explicit', label: 'явный' }, { value: 'implicit', label: 'неявный' }, { value: 'both', label: 'оба' }], onChange: (v) => ((s.m = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 't', domain: [0, 2] }, y: { label: 'y', domain: [-1.6, 1.6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'hl', label: 'hλ' }, { key: 'q', label: 'множитель явного 1 − hλ' }, { key: 'ee', label: 'ошибка явного в t = 2' }, { key: 'ei', label: 'ошибка неявного' }, { key: 'n', label: 'шагов' }]);
    const REF = -0.3978017673037144;
    function run(h) {
      const n = Math.round(2 / h);
      const te = [0];
      const ye = [0];
      const yi = [0];
      let a = 0;
      let b = 0;
      for (let i = 0; i < n; i++) {
        const t = i * h;
        a = a + h * (-LAM * (a - Math.cos(t)));
        b = (b + h * LAM * Math.cos(t + h)) / (1 + LAM * h);
        te.push(t + h);
        ye.push(a);
        yi.push(b);
      }
      return { te, ye, yi, n };
    }
    function draw() {
      const r = run(s.h);
      const ref = solveODE((t, y) => -LAM * (y - Math.cos(t)), 0, 0, 2, 4000, 'rk4');
      plot.render([
        { type: 'line', x: ref.ts, y: ref.ys, color: 'ink', width: 2, dash: '6 4', label: 'точное (очень мелкий шаг)', hover: false },
        s.m !== 'implicit' ? { type: 'line', x: r.te, y: clampArr(r.ye, -50, 50), color: 'tree', width: 1.8, label: 'явный Эйлер', hover: false } : null,
        s.m !== 'implicit' && r.n <= 40 ? { type: 'points', x: r.te, y: clampArr(r.ye, -50, 50), color: 'tree', r: 3 } : null,
        s.m !== 'explicit' ? { type: 'line', x: r.te, y: r.yi, color: 'violet', width: 1.8, label: 'неявный Эйлер', hover: false } : null,
        s.m !== 'explicit' && r.n <= 40 ? { type: 'points', x: r.te, y: r.yi, color: 'violet', r: 3, shape: 'square' } : null,
      ]);
      const ee = Math.abs(r.ye[r.n] - REF);
      st.set('hl', f2(LAM * s.h));
      st.set('q', f2(1 - LAM * s.h));
      st.set('ee', Number.isFinite(r.ye[r.n]) ? sci(ee) : '∞');
      st.set('ei', sci(Math.abs(r.yi[r.n] - REF)));
      st.set('n', String(r.n));
      note.innerHTML = 'Явный Эйлер: при h = 0.01 ошибка 4·10⁻⁵, при 0.03 — 0.009 (зигзаг затухает с множителем −0.5), при 0.039 зигзаг почти не гаснет, при 0.041 уже растёт, а при 0.05 к t = 2 решение улетает к −1.1·10⁷. Неявный метод при h = 0.05 даёт ошибку 2·10⁻⁴, а при h = 0.2 — всего 10 шагов на весь отрезок, и решение остаётся разумным. Уравнения, где быстрые и медленные процессы идут вместе, называют <b>жёсткими</b>: шаг явного метода ограничен самым быстрым процессом, даже когда тот давно закончился.';
    }
    w.pythonAction(() => 'import math\n\nlam, h = 50.0, ' + py(s.h) + '\nn = round(2 / h)\nye = yi = 0.0\nfor i in range(n):\n    t = i * h\n    ye = ye + h * (-lam * (ye - math.cos(t)))                  # явный: наклон в начале шага\n    yi = (yi + h * lam * math.cos(t + h)) / (1 + lam * h)      # неявный: наклон в конце шага\nref = -0.3978017673037144                                       # y(2) с очень мелким шагом\nprint("явный  :", ye, " ошибка", abs(ye - ref))\nprint("неявный:", yi, " ошибка", abs(yi - ref))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 16. Области устойчивости на комплексной плоскости
   * ============================================================================== */
  const cx = (re, im = 0) => ({ re, im });
  const cmul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const cadd = (a, b) => cx(a.re + b.re, a.im + b.im);
  const cabs = (a) => Math.hypot(a.re, a.im);
  const cdiv = (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  };
  const RFN = {
    euler: (z) => cadd(cx(1), z),
    implicit: (z) => cdiv(cx(1), cadd(cx(1), cx(-z.re, -z.im))),
    heun: (z) => {
      const z2 = cmul(z, z);
      return cadd(cadd(cx(1), z), cx(z2.re / 2, z2.im / 2));
    },
    rk4: (z) => {
      const z2 = cmul(z, z);
      const z3 = cmul(z2, z);
      const z4 = cmul(z3, z);
      return cx(1 + z.re + z2.re / 2 + z3.re / 6 + z4.re / 24, z.im + z2.im / 2 + z3.im / 6 + z4.im / 24);
    },
  };
  GBC.widget('stability-regions', (el) => {
    const s = { m: 'euler', z: cx(-1.5, 0) };
    const dom = [-4.2, 2.4, -3.3, 3.3];
    const w = ui.shell(el, { title: 'Области устойчивости: где |R(hλ)| < 1', sub: 'Для пробного уравнения y′ = λy (λ может быть комплексным: Re λ < 0 — затухание, Im λ — колебание) любой из методов делает yₙ₊₁ = R(z)·yₙ, z = hλ. Метод устойчив, если |R(z)| < 1. Закрашена область выбранного метода, линии — границы всех четырёх. Перетащите точку z.' });
    ui.segmented(w.controls, { label: 'Закрасить область', value: s.m, options: [{ value: 'euler', label: 'Эйлер' }, { value: 'heun', label: 'Хойн' }, { value: 'rk4', label: 'РК4' }, { value: 'implicit', label: 'неявный' }], onChange: (v) => ((s.m = v), draw()) });
    ui.select(w.controls, { label: 'Готовые примеры', value: 'decay', options: [
      { value: 'decay', label: 'затухание λ = −1, h = 1.5' },
      { value: 'stiff', label: 'жёсткое λ = −50, h = 0.05' },
      { value: 'osc', label: 'колебание λ = i, h = 0.5' },
      { value: 'osc2', label: 'колебание λ = i, h = 2.5' },
      { value: 'damped', label: 'затухающее λ = −0.5 + 2i, h = 1' },
    ], onChange: (v) => {
      s.z = { decay: cx(-1.5, 0), stiff: cx(-2.5, 0), osc: cx(0, 0.5), osc2: cx(0, 2.5), damped: cx(-0.5, 2) }[v];
      draw();
    } });
    const box = H('div', { style: 'max-width:560px;margin:0 auto' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 340, equal: true, x: { label: 'Re z = Re(hλ)', domain: [dom[0], dom[1]] }, y: { label: 'Im z', domain: [dom[2], dom[3]] } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'номер шага n', domain: [0, 30] }, y: { label: '|yₙ| (лог.)', type: 'log', domain: [1e-6, 1e6], ticks: [1e-6, 1e-4, 1e-2, 1, 1e2, 1e4, 1e6], format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'z', label: 'z = hλ' }, { key: 'euler', label: '|R| Эйлер' }, { key: 'heun', label: '|R| Хойн' }, { key: 'rk4', label: '|R| РК4' }, { key: 'implicit', label: '|R| неявный' }]);
    const grids = {};
    for (const m of Object.keys(RFN)) grids[m] = GBC.Plot.grid((x, y) => cabs(RFN[m](cx(x, y))), dom[0], dom[1], dom[2], dom[3], 151, 151);
    function draw() {
      const blue = GBC.colors.rgb('model');
      const layers = [
        { type: 'heatmap', grid: grids[s.m], colorFn: (v) => (v < 1 ? [blue[0], blue[1], blue[2], 70] : [0, 0, 0, 0]), smooth: true },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'vline', x: 0, color: 'axis' },
      ];
      ['euler', 'heun', 'rk4', 'implicit'].forEach((m) => {
        layers.push({ type: 'contour', grid: grids[m], level: 1, color: MCOL[m], width: m === s.m ? 2.6 : 1.5 });
        layers.push({ type: 'line', x: [NaN], y: [NaN], color: MCOL[m], label: MNAME[m] });
      });
      layers.push({ type: 'points', x: [s.z.re], y: [s.z.im], color: 'critical', r: 7, draggable: true, onDrag: (i, x, y) => ((s.z = cx(x, Math.abs(y) < 0.06 ? 0 : y)), draw()), label: 'z = hλ' });
      p1.render(layers, { x: [dom[0], dom[1]], y: [dom[2], dom[3]] });
      const ns = U.range(31);
      const l2 = [];
      ['euler', 'heun', 'rk4', 'implicit'].forEach((m) => {
        const a = cabs(RFN[m](s.z));
        l2.push({ type: 'line', x: ns, y: ns.map((n) => U.clamp(Math.pow(a, n), 1e-6, 1e6)), color: MCOL[m], width: m === s.m ? 2.8 : 1.6, label: MNAME[m] });
      });
      l2.push({ type: 'hline', y: 1, color: 'ink2', dash: '4 4', width: 1 });
      p2.render(l2);
      st.set('z', f2(s.z.re) + (s.z.im >= 0 ? ' + ' : ' − ') + f2(Math.abs(s.z.im)) + 'i');
      ['euler', 'heun', 'rk4', 'implicit'].forEach((m) => {
        const a = cabs(RFN[m](s.z));
        st.set(m, f3(a) + (a < 1 ? ' ✓' : a > 1 + 1e-9 ? ' ✗' : ''));
      });
      note.innerHTML = '<b>Эйлер</b>: R = 1 + z, область — круг радиуса 1 с центром −1. На вещественной оси это 0 &lt; hλ &lt; 2 из шага 15; мнимой оси (чистые колебания) круг касается только в нуле — поэтому Эйлер всегда раскручивает колебания (шаг 23). <b>Хойн</b>: R = 1 + z + z²/2, на вещественной оси та же граница −2. <b>РК4</b>: R — первые пять членов ряда Тейлора e<sup>z</sup>; область больше: вещественная граница −2.785, по мнимой оси до ±2.83. <b>Неявный Эйлер</b>: R = 1/(1 − z), устойчив вне круга с центром +1 — во всей левой полуплоскости (A-устойчивость). Плата — на каждом шаге решать уравнение относительно yₙ₊₁.';
    }
    onTheme(draw);
    w.pythonAction(() => 'import numpy as np\n\nz = complex(' + py(s.z.re) + ', ' + py(s.z.im) + ')        # z = h·λ\nR = {\n    "Эйлер":         1 + z,\n    "Хойн":          1 + z + z**2 / 2,\n    "Рунге — Кутта": 1 + z + z**2 / 2 + z**3 / 6 + z**4 / 24,\n    "неявный Эйлер": 1 / (1 - z),\n}\nfor name, r in R.items():\n    print(f"{name:14}: |R(z)| = {abs(r):.4f} -> {\'устойчив\' if abs(r) < 1 else \'НЕустойчив\'}; |y_30| = {abs(r) ** 30:.3e}")\n\n# граница области РК4 на вещественной оси\nx = np.linspace(-3.5, 0, 350001)\nr4 = np.abs(1 + x + x**2 / 2 + x**3 / 6 + x**4 / 24)\nprint("РК4 устойчив на вещественной оси при hλ >", x[np.argmax(r4 <= 1)])\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 17. Анатомия шага: Хойн, средняя точка, Рунге — Кутта
   * ============================================================================== */
  const AN = {
    grow: { label: 'y′ = y, y(0) = 1', f: (t, y) => y, t0: 0, y0: 1, exact: (t) => Math.exp(t), pyf: 'y', pyex: 'math.exp(t)' },
    tmy: { label: 'y′ = t − y, y(0) = 1', f: (t, y) => t - y, t0: 0, y0: 1, exact: (t) => t - 1 + 2 * Math.exp(-t), pyf: 't - y', pyex: 't - 1 + 2 * math.exp(-t)' },
    gauss: { label: 'y′ = −2t·y, y(0.5) = e^(−0.25)', f: (t, y) => -2 * t * y, t0: 0.5, y0: Math.exp(-0.25), exact: (t) => Math.exp(-t * t), pyf: '-2 * t * y', pyex: 'math.exp(-t**2)' },
  };
  GBC.widget('rk4-anatomy', (el) => {
    const s = { key: 'grow', h: 1, m: 'rk4' };
    const w = ui.shell(el, { title: 'Один шаг под микроскопом', sub: 'Эйлер смотрит на наклон только в начале шага. Хойн «подсматривает» наклон в конце и усредняет. Средняя точка берёт наклон в середине. Рунге — Кутта 4 пробует четыре наклона (кружки k₁…k₄) и усредняет их с весами 1 : 2 : 2 : 1. Чёрная стрелка — итоговый шаг, пунктир — точное решение.' });
    ui.select(w.controls, { label: 'Уравнение', value: s.key, options: Object.entries(AN).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.segmented(w.controls, { label: 'Метод', value: s.m, options: [{ value: 'euler', label: 'Эйлер' }, { value: 'heun', label: 'Хойн' }, { value: 'mid', label: 'ср. точка' }, { value: 'rk4', label: 'РК4' }], onChange: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'Шаг h', min: 0.2, max: 1.5, step: 0.05, value: s.h, format: f2, onInput: (v) => ((s.h = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 't' }, y: { label: 'y' } });
    const tbl = H('div', { class: 'table-wrap', style: 'margin-top:6px' });
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'y', label: 'результат шага y₁' }, { key: 'e', label: 'точно y(t₀ + h)' }, { key: 'err', label: 'ошибка шага' }]);
    function draw() {
      const A = AN[s.key];
      const { f, t0, y0 } = A;
      const h = s.h;
      const probes = [];
      const k1 = f(t0, y0);
      probes.push({ name: 'k₁', t: t0, y: y0, k: k1, from: null });
      let y1;
      let wts;
      if (s.m === 'euler') {
        y1 = y0 + h * k1;
        wts = [1];
      } else if (s.m === 'heun') {
        const k2 = f(t0 + h, y0 + h * k1);
        probes.push({ name: 'k₂', t: t0 + h, y: y0 + h * k1, k: k2, from: 0 });
        y1 = y0 + (h * (k1 + k2)) / 2;
        wts = [0.5, 0.5];
      } else if (s.m === 'mid') {
        const k2 = f(t0 + h / 2, y0 + (h / 2) * k1);
        probes.push({ name: 'k₂', t: t0 + h / 2, y: y0 + (h / 2) * k1, k: k2, from: 0 });
        y1 = y0 + h * k2;
        wts = [0, 1];
      } else {
        const k2 = f(t0 + h / 2, y0 + (h / 2) * k1);
        const k3 = f(t0 + h / 2, y0 + (h / 2) * k2);
        const k4 = f(t0 + h, y0 + h * k3);
        probes.push({ name: 'k₂', t: t0 + h / 2, y: y0 + (h / 2) * k1, k: k2, from: 0 });
        probes.push({ name: 'k₃', t: t0 + h / 2, y: y0 + (h / 2) * k2, k: k3, from: 1 });
        probes.push({ name: 'k₄', t: t0 + h, y: y0 + h * k3, k: k4, from: 2 });
        y1 = y0 + (h * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
        wts = [1 / 6, 2 / 6, 2 / 6, 1 / 6];
      }
      const fine = U.linspace(t0 - 0.1 * h, t0 + 1.15 * h, 200);
      const cols = ['tree', 'aqua', 'magenta', 'green'];
      const layers = [{ type: 'line', x: fine, y: fine.map(A.exact), color: 'model', width: 2, dash: '6 4', label: 'точное решение', hover: false }];
      const d = 0.14 * h;
      probes.forEach((p, i) => {
        if (p.from !== null) layers.push({ type: 'arrows', x1: [t0], y1: [y0], x2: [p.t], y2: [p.y], color: cols[i], width: 1.2, opacity: 0.55 });
        layers.push({ type: 'segments', x1: [p.t - d], x2: [p.t + d], y1: [p.y - d * p.k], y2: [p.y + d * p.k], color: cols[i], width: 4, opacity: 1 });
        layers.push({ type: 'points', x: [p.t], y: [p.y], color: cols[i], r: 5.5, hollow: true, label: p.name + ' = ' + f3(p.k), tooltip: () => [['где', '(' + f3(p.t) + ', ' + f3(p.y) + ')'], ['наклон', f4(p.k)], ['вес', f3(wts[i])]] });
      });
      layers.push({ type: 'arrows', x1: [t0], y1: [y0], x2: [t0 + h], y2: [y1], color: 'ink', width: 2.4 });
      layers.push({ type: 'points', x: [t0 + h], y: [A.exact(t0 + h)], color: 'model', r: 5, label: 'точно в t₀ + h' });
      const allY = fine.map(A.exact).concat(probes.map((p) => p.y)).concat([y1]);
      plot.render(layers, { x: [fine[0], fine[fine.length - 1]], y: yDom(allY, 0.08) });
      rowTable(tbl, ['наклон', 'где берём', 'значение', 'вес'], probes.map((p, i) => [p.name, '(' + f3(p.t) + ', ' + f4(p.y) + ')', f4(p.k), wts[i] === 0 ? '0' : f3(wts[i])]));
      const ex = A.exact(t0 + h);
      st.set('y', f6(y1));
      st.set('e', f6(ex));
      st.set('err', sci(Math.abs(y1 - ex)));
      const msg = {
        euler: 'Эйлер верит наклону в начале: для выпуклого решения он всегда недолетает. Ошибка одного шага ~h².',
        heun: 'Хойн: шаг Эйлера — разведка, наклон в её конце — поправка, итог — среднее двух наклонов. Это формула трапеций для интеграла наклона (урок 15.9). Ошибка шага ~h³, глобальная ~h².',
        mid: 'Средняя точка: пол-шага Эйлером, берём наклон там и с ним делаем целый шаг. Тот же второй порядок, что у Хойна. Для y′ = λy оба метода совпадают: R = 1 + z + z²/2.',
        rk4: 'Рунге — Кутта 4: веса 1 : 2 : 2 : 1 — это формула Симпсона для интеграла наклона. Для y′ = y с h = 1 наклоны 1, 1.5, 1.75, 2.75 дают 1 + (1 + 3 + 3.5 + 2.75)/6 = 2.7083 = 1 + 1 + ½ + ⅙ + 1/24 — ровно пять членов ряда Тейлора eᵗ (урок 15.10), а e = 2.7183. Ошибка шага ~h⁵, глобальная ~h⁴.',
      };
      note.innerHTML = msg[s.m];
    }
    w.pythonAction(() => {
      const A = AN[s.key];
      return 'import math\n\nf = lambda t, y: ' + A.pyf + '\nexact = lambda t: ' + A.pyex + '\nt0, y0, h = ' + py(A.t0) + ', ' + py(A.y0) + ', ' + py(s.h) + '\n\nk1 = f(t0, y0)\nk2 = f(t0 + h / 2, y0 + h / 2 * k1)\nk3 = f(t0 + h / 2, y0 + h / 2 * k2)\nk4 = f(t0 + h, y0 + h * k3)\nprint("наклоны:", k1, k2, k3, k4)\nsteps = {\n    "Эйлер":         y0 + h * k1,\n    "Хойн":          y0 + h * (k1 + f(t0 + h, y0 + h * k1)) / 2,\n    "средняя точка": y0 + h * k2,\n    "РК4":           y0 + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6,\n}\nfor name, y1 in steps.items():\n    print(f"{name:14}: {y1:.6f}, ошибка {abs(y1 - exact(t0 + h)):.2e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 17. Сравнение методов: порядок на практике
   * ============================================================================== */
  const OM = {
    decay: { label: 'y′ = −y на [0, 2]', f: (t, y) => -y, y0: 1, T: 2, exact: (t) => Math.exp(-t), pyf: '-y', pyex: 'math.exp(-T)' },
    grow: { label: 'y′ = y на [0, 2]', f: (t, y) => y, y0: 1, T: 2, exact: (t) => Math.exp(t), pyf: 'y', pyex: 'math.exp(T)' },
    logi: { label: 'y′ = y(1 − y), y(0) = 0.1 на [0, 8]', f: (t, y) => y * (1 - y), y0: 0.1, T: 8, exact: (t) => 1 / (1 + 9 * Math.exp(-t)), pyf: 'y * (1 - y)', pyex: '1 / (1 + 9 * math.exp(-T))' },
  };
  GBC.widget('ode-methods', (el) => {
    const s = { key: 'decay', h: 0.2 };
    const HS = [0.5, 0.25, 0.2, 0.1, 0.05, 0.025];
    const w = ui.shell(el, { title: 'Эйлер, Хойн, Рунге — Кутта: кто точнее', sub: 'Сверху — решения тремя методами с выбранным шагом. Снизу — ошибка в конце отрезка при разных h в логарифмическом масштабе: наклон прямой — порядок метода (1, 2 и 4).' });
    ui.select(w.controls, { label: 'Уравнение', value: s.key, options: Object.entries(OM).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.slider(w.controls, { label: 'Шаг h', values: HS, value: s.h, format: String, onInput: (v) => ((s.h = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 't' }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'h (лог.)', type: 'log', domain: [0.02, 0.6], ticks: [0.025, 0.05, 0.1, 0.25, 0.5], format: (v) => String(v) }, y: { label: 'ошибка в конце (лог.)', type: 'log' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'euler', label: 'Эйлер' }, { key: 'heun', label: 'Хойн' }, { key: 'rk4', label: 'Рунге — Кутта' }, { key: 'ev', label: 'вычислений f: 1 / 2 / 4 на шаг' }]);
    const err = (E, m, h) => {
      const sol = solveODE(E.f, 0, E.y0, E.T, Math.round(E.T / h), m);
      return Math.abs(sol.ys[sol.ys.length - 1] - E.exact(E.T));
    };
    function draw() {
      const E = OM[s.key];
      const fine = U.linspace(0, E.T, 300);
      const layers = [{ type: 'line', x: fine, y: fine.map(E.exact), color: 'model', width: 2, dash: '6 4', label: 'точно', hover: false }];
      const allY = fine.map(E.exact);
      ['euler', 'heun', 'rk4'].forEach((m) => {
        const sol = solveODE(E.f, 0, E.y0, E.T, Math.round(E.T / s.h), m);
        allY.push(...sol.ys);
        layers.push({ type: 'line', x: sol.ts, y: sol.ys, color: MCOL[m], width: 1.6, hover: false });
        if (sol.ts.length <= 60) layers.push({ type: 'points', x: sol.ts, y: sol.ys, color: MCOL[m], r: 3.8, label: MNAME[m] });
        else layers.push({ type: 'line', x: [NaN], y: [NaN], color: MCOL[m], label: MNAME[m] });
      });
      p1.render(layers, { x: [0, E.T], y: yDom(allY, 0.06) });
      const all = [];
      const l2 = [];
      ['euler', 'heun', 'rk4'].forEach((m, i) => {
        const es = HS.map((h) => Math.max(err(E, m, h), 1e-16));
        all.push(...es);
        l2.push({ type: 'line', x: HS, y: es, color: MCOL[m], width: 2.2, label: MNAME[m] + ' ~ h' + ['', '²', '⁴'][i] });
        l2.push({ type: 'points', x: HS, y: es, color: MCOL[m], r: 3.5, tooltip: (j) => [['h', String(HS[j])], ['ошибка', sci(es[j])]] });
      });
      l2.push({ type: 'vline', x: s.h, color: 'ink2', dash: '3 3', width: 1 });
      const la = logAxis(Math.min(...all), Math.max(...all));
      p2.opts.y.ticks = la.ticks;
      p2.opts.y.format = powFmt;
      p2.render(l2, { y: la.domain });
      ['euler', 'heun', 'rk4'].forEach((m) => st.set(m, sci(err(E, m, s.h))));
      st.set('ev', String(Math.round(E.T / s.h)) + ' / ' + 2 * Math.round(E.T / s.h) + ' / ' + 4 * Math.round(E.T / s.h));
      note.innerHTML = 'Уменьшили h вдвое — ошибка Эйлера уменьшилась в 2 раза, Хойна — в 4, Рунге — Кутты — в 16. Для y′ = −y при h = 0.2: 0.028, 0.0021 и 4.3·10⁻⁶. Рунге — Кутта считает f вчетверо чаще Эйлера, но при одинаковом числе вычислений всё равно точнее на порядки. Если правая часть зависит только от t, решить уравнение — значит проинтегрировать, и методы превращаются в прямоугольники, трапеции и Симпсона (урок 15.9).';
    }
    w.pythonAction(() => {
      const E = OM[s.key];
      return 'import math\n\nf = lambda t, y: ' + E.pyf + '\nT, y0 = ' + py(E.T) + ', ' + py(E.y0) + '\nexact = ' + E.pyex + '\n\n' + PY_RK4 + '\n\ndef euler(f, t, y, h):\n    return y + h * f(t, y)\n\n\ndef heun(f, t, y, h):\n    k1 = f(t, y)\n    return y + h * (k1 + f(t + h, y + h * k1)) / 2\n\n\nfor h in ' + JSON.stringify(HS) + ':\n    errs = []\n    for step in (euler, heun, rk4):\n        y = y0\n        for i in range(round(T / h)):\n            y = step(f, i * h, y, h)\n        errs.append(abs(y - exact))\n    print(f"h = {h:<6}: Эйлер {errs[0]:.2e}, Хойн {errs[1]:.2e}, РК4 {errs[2]:.2e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 18. Адаптивный шаг
   * ============================================================================== */
  GBC.widget('adaptive-step', (el) => {
    const s = { lt: -3 };
    const f = (t, y) => 10 * y * (1 - y);
    const ex = (t) => 1 / (1 + 999 * Math.exp(-10 * t));
    const w = ui.shell(el, { title: 'Адаптивный шаг: мелко там, где трудно', sub: 'y′ = 10y(1 − y), y(0) = 0.001: экспоненциальный разгон (y растёт в e раз каждые 0.1), скачок около t ≈ 0.69 и плато. На каждом шаге считаем два ответа — Эйлером и Хойном; их разность оценивает ошибку. Допуск относительный: ошибка шага должна быть меньше tol·(|y| + 0.001). Больше — шаг отвергаем и уменьшаем, меньше — принимаем и увеличиваем.' });
    ui.slider(w.controls, { label: 'Допуск на шаг tol', min: -6, max: -2, step: 0.5, value: s.lt, format: (v) => '10' + (v < 0 ? '⁻' : '') + String(Math.abs(v)).replace('.5', '.5').split('').map((c) => ({ 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', '.': '·' }[c] || c)).join(''), onInput: (v) => ((s.lt = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 't', domain: [0, 2] }, y: { label: 'y', domain: [-0.05, 1.08] } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 't', domain: [0, 2] }, y: { label: 'шаг h (лог.)', type: 'log', domain: [1e-4, 1], ticks: [1e-4, 1e-3, 1e-2, 0.1, 1], format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'принято шагов' }, { key: 'r', label: 'отвергнуто' }, { key: 'e', label: 'max ошибка' }, { key: 'fx', label: 'постоянный шаг для той же точности' }]);
    function adaptive(tol) {
      let t = 0;
      let y = 1e-3;
      let h = 0.05;
      const ts = [0];
      const ys = [y];
      const hs = [];
      const rej = { t: [], h: [] };
      let maxe = 0;
      let guard = 0;
      while (t < 2 - 1e-12 && guard++ < 20000) {
        h = Math.min(h, 2 - t);
        const k1 = f(t, y);
        const k2 = f(t + h, y + h * k1);
        const e = (h * Math.abs(k2 - k1)) / 2;
        const sc = tol * (1e-3 + Math.abs(y));
        if (e <= sc) {
          t += h;
          y += (h * (k1 + k2)) / 2;
          ts.push(t);
          ys.push(y);
          hs.push(h);
          maxe = Math.max(maxe, Math.abs(y - ex(t)));
        } else {
          rej.t.push(t);
          rej.h.push(h);
        }
        h *= Math.min(4, Math.max(0.2, 0.9 * Math.sqrt(sc / Math.max(e, 1e-300))));
      }
      return { ts, ys, hs, rej, maxe };
    }
    function fixedErr(N) {
      const h = 2 / N;
      let y = 1e-3;
      let m = 0;
      for (let i = 0; i < N; i++) {
        const t = i * h;
        const k1 = f(t, y);
        const k2 = f(t + h, y + h * k1);
        y += (h * (k1 + k2)) / 2;
        m = Math.max(m, Math.abs(y - ex(t + h)));
      }
      return m;
    }
    function draw() {
      const tol = Math.pow(10, s.lt);
      const A = adaptive(tol);
      const fine = U.linspace(0, 2, 400);
      p1.render([
        { type: 'line', x: fine, y: fine.map(ex), color: 'model', width: 2, dash: '6 4', label: 'точно', hover: false },
        { type: 'points', x: A.ts, y: A.ys, color: 'tree', r: A.ts.length > 150 ? 2 : 3.5, label: 'принятые шаги' },
      ]);
      p2.render([
        { type: 'points', x: A.ts.slice(0, -1), y: A.hs, color: 'tree', r: 2.6, label: 'принятый шаг' },
        { type: 'points', x: A.rej.t, y: A.rej.h.map((v) => U.clamp(v, 1e-4, 1)), color: 'critical', r: 3.5, shape: 'square', label: 'отвергнутый' },
      ]);
      let N = 10;
      while (fixedErr(N) > A.maxe && N < 200000) N = Math.ceil(N * 1.05);
      st.set('n', String(A.hs.length));
      st.set('r', String(A.rej.t.length));
      st.set('e', sci(A.maxe));
      st.set('fx', '≈ ' + N + ' ' + plural(N, 'шаг', 'шага', 'шагов'));
      note.innerHTML = 'Шаги мелкие, пока решение быстро меняется <em>относительно своей величины</em> — на всём экспоненциальном разгоне, — и крупнеют на плато, где почти ничего не происходит. Сейчас принято ' + A.hs.length + ' ' + plural(A.hs.length, 'шаг', 'шага', 'шагов') + ' при наибольшей ошибке ' + sci(A.maxe) + ', а постоянному шагу того же метода Хойна для такой же точности понадобилось бы ≈ ' + N + ' — в ' + U.fmt(N / A.hs.length, 2) + ' раза больше. Шаг подбирается по правилу h ← h·0.9·√(допуск/err): ошибка шага пары Эйлер — Хойн ~h², поэтому корень. Допуск относительный (как <code>rtol</code> и <code>atol</code> в <code>scipy.integrate.solve_ivp</code>): пока y ≈ 0.001, абсолютная ошибка должна быть крошечной, иначе её раздует последующий экспоненциальный рост. Отвергнутые шаги — плата за надёжность: метод не знает заранее, где будет трудно.';
    }
    w.pythonAction(() => 'import math\n\nf = lambda t, y: 10 * y * (1 - y)\nexact = lambda t: 1 / (1 + 999 * math.exp(-10 * t))\ntol = ' + py(Math.pow(10, s.lt)) + '\n\nt, y, h = 0.0, 1e-3, 0.05\naccepted = rejected = 0\nmax_err = 0.0\nwhile t < 2 - 1e-12:\n    h = min(h, 2 - t)\n    k1 = f(t, y)\n    k2 = f(t + h, y + h * k1)\n    err = h * abs(k2 - k1) / 2               # |Хойн − Эйлер| — оценка ошибки шага\n    sc = tol * (1e-3 + abs(y))               # относительный допуск (как rtol + atol)\n    if err <= sc:\n        t, y = t + h, y + h * (k1 + k2) / 2\n        accepted += 1\n        max_err = max(max_err, abs(y - exact(t)))\n    else:\n        rejected += 1\n    h *= min(4, max(0.2, 0.9 * math.sqrt(sc / max(err, 1e-300))))\nprint("принято", accepted, "отвергнуто", rejected, "max ошибка", max_err)\n\n# библиотечный решатель с той же идеей (пара Рунге — Кутты 5(4))\ntry:\n    from scipy.integrate import solve_ivp\n    sol = solve_ivp(lambda t, y: 10 * y * (1 - y), (0, 2), [1e-3], rtol=1e-6, atol=1e-9)\n    print("solve_ivp: шагов", len(sol.t) - 1, " y(2) =", sol.y[0, -1], " точно", exact(2))\nexcept ImportError:\n    pass\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 19. Затухающий осциллятор: x″ + c·x′ + ω²x = 0
   * ============================================================================== */
  GBC.widget('damped-oscillator', (el) => {
    const s = { w0: 1, c: 0.4 };
    const T = 30;
    const w = ui.shell(el, { title: 'Пружина с трением: x″ + c·x′ + ω²·x = 0', sub: 'Груз отпустили из x = 1 без толчка. ω — собственная частота пружины, c — трение. Корни характеристического уравнения r² + c·r + ω² = 0 решают всё: комплексные — колебания, вещественные — плавный подход.' });
    ui.slider(w.controls, { label: 'Собственная частота ω', min: 0.5, max: 2, step: 0.05, value: s.w0, format: f2, onInput: (v) => ((s.w0 = v), draw()) });
    const cs = ui.slider(w.controls, { label: 'Трение c', min: 0, max: 5, step: 0.05, value: s.c, format: f2, onInput: (v) => ((s.c = v), draw()) });
    ui.button(w.controls, { label: 'Критическое: c = 2ω', onClick: () => ((s.c = 2 * s.w0), cs.set(s.c), draw()) });
    const texBox = H('div', { style: 'margin:0 0 4px' });
    w.main.appendChild(texBox);
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 't', domain: [0, T] }, y: { label: 'положение x(t)', domain: [-1.05, 1.1] } });
    const box = H('div', { style: 'max-width:380px;margin:0 auto' });
    w.main.appendChild(box);
    const p2 = new GBC.Plot(box, { height: 260, equal: true, x: { label: 'x', domain: [-1.2, 1.2] }, y: { label: 'скорость v = x′', domain: [-1.4, 1.4] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'reg', label: 'режим' }, { key: 'r', label: 'корни r₁, r₂' }, { key: 'p', label: 'период' }, { key: 'set', label: 'установление в ±5 %' }]);
    function draw() {
      const { w0, c } = s;
      const sys = (t, u) => [u[1], -c * u[1] - w0 * w0 * u[0]];
      const sol = solveODE(sys, 0, [1, 0], T, 3000, 'rk4');
      const xs = sol.ys.map((u) => u[0]);
      const vs = sol.ys.map((u) => u[1]);
      const disc = (c * c) / 4 - w0 * w0;
      let reg;
      let roots;
      if (Math.abs(disc) < 1e-9) {
        reg = 'критическое';
        roots = f3(-c / 2) + ' (двойной)';
      } else if (disc < 0) {
        reg = c === 0 ? 'без трения' : 'колебания';
        roots = f3(-c / 2) + ' ± ' + f3(Math.sqrt(-disc)) + 'i';
      } else {
        reg = 'апериодический';
        roots = f3(-c / 2 + Math.sqrt(disc)) + ', ' + f3(-c / 2 - Math.sqrt(disc));
      }
      let last = -1;
      xs.forEach((x, i) => (Math.abs(x) > 0.05 ? (last = i) : null));
      const settle = last < xs.length - 1 ? sol.ts[last + 1] : NaN;
      const env = U.linspace(0, T, 200);
      p1.render([
        { type: 'rect', x0: 0, x1: T, y0: -0.05, y1: 0.05, fill: 'good', opacity: 0.12 },
        { type: 'hline', y: 0, color: 'axis' },
        disc < 0 && c > 0 ? { type: 'line', x: env, y: env.map((t) => Math.exp((-c * t) / 2)), color: 'muted', width: 1.2, dash: '4 3', label: 'огибающая ±e^{−ct/2}', hover: false } : null,
        disc < 0 && c > 0 ? { type: 'line', x: env, y: env.map((t) => -Math.exp((-c * t) / 2)), color: 'muted', width: 1.2, dash: '4 3', hover: false } : null,
        { type: 'line', x: sol.ts, y: xs, color: 'model', width: 2.4, label: 'x(t)', hover: false },
        Number.isFinite(settle) ? { type: 'vline', x: settle, color: 'tree', dash: '3 3', width: 1.2, text: 'в полосе ±5 %' } : null,
      ]);
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'vline', x: 0, color: 'axis' },
        { type: 'line', x: xs, y: vs, color: 'model', width: 2, hover: false },
        { type: 'points', x: [1], y: [0], color: 'ink', r: 5, hollow: true, label: 'старт' },
      ]);
      texInto(texBox, R`r^2 + ` + f2(c) + R`\,r + ` + f3(w0 * w0) + R` = 0\quad\Rightarrow\quad r = -\tfrac{c}{2} \pm \sqrt{\tfrac{c^2}{4} - \omega^2}`);
      st.set('reg', reg);
      st.set('r', roots);
      st.set('p', disc < 0 ? f3((2 * PI) / Math.sqrt(-disc)) : '—');
      st.set('set', Number.isFinite(settle) ? f2(settle) : '> ' + T);
      note.innerHTML = 'Подставим x = e<sup>rt</sup>: r² + c·r + ω² = 0. <b>c &lt; 2ω</b> — корни комплексные −c/2 ± iω<sub>d</sub>: колебания с частотой ω<sub>d</sub> = √(ω² − c²/4) внутри огибающей e<sup>−ct/2</sup>. <b>c = 2ω</b> — критическое затухание, двойной корень −ω. <b>c &gt; 2ω</b> — два отрицательных корня, медленный из них −c/2 + √(c²/4 − ω²) → 0 при росте c: сильное трение возвращает груз <em>медленно</em>, как сквозь мёд. При ω = 1 время установления в полосе ±5 %: c = 0.4 — 13.7, c = 1.5 — 3.1, c = 2 — 4.7, c = 4 — 11.5. Быстрее всех чуть недодемпфированная система (лёгкий перелёт); критическое затухание — самое быстрое <b>без</b> перелёта. Эта же картина объясняет выбор моментума в оптимизации (шаг 26).';
    }
    w.pythonAction(() => 'import numpy as np\n\nw0, c = ' + py(s.w0) + ', ' + py(s.c) + '\nf = lambda t, u: np.array([u[1], -c * u[1] - w0**2 * u[0]])   # x″ + c x′ + ω² x = 0 как система\n\n' + PY_RK4 + '\nh, u = 0.01, np.array([1.0, 0.0])\nts, xs = [0.0], [1.0]\nfor i in range(3000):\n    u = rk4(f, i * h, u, h)\n    ts.append((i + 1) * h); xs.append(u[0])\nxs = np.array(xs)\nprint("корни:", np.roots([1, c, w0**2]))\nbig = np.nonzero(np.abs(xs) > 0.05)[0]\nprint("в полосе ±5 % с t =", ts[big[-1] + 1] if big[-1] + 1 < len(ts) else "> 30")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 20. Линейные системы и фазовый портрет
   * ============================================================================== */
  const LP = {
    saddle: { label: 'седло', m: [1, 0, 0, -1] },
    node: { label: 'устойчивый узел', m: [-1, 0, 0, -3] },
    unode: { label: 'неустойчивый узел', m: [2, 1, 0, 1] },
    spiral: { label: 'устойчивый фокус', m: [-0.3, 1, -1, -0.3] },
    uspiral: { label: 'неустойчивый фокус', m: [0.2, -1, 1, 0.2] },
    center: { label: 'центр', m: [0, 1, -1, 0] },
    spring: { label: 'пружина с трением (c = 0.5)', m: [0, 1, -1, -0.5] },
  };
  function eig2(a, b, c, d) {
    const tr = a + d;
    const det = a * d - b * c;
    const disc = tr * tr - 4 * det;
    if (disc >= 0) return { tr, det, disc, re: [(tr + Math.sqrt(disc)) / 2, (tr - Math.sqrt(disc)) / 2], im: 0 };
    return { tr, det, disc, re: [tr / 2, tr / 2], im: Math.sqrt(-disc) / 2 };
  }
  function kindOf(E) {
    const eps = 1e-9;
    if (Math.abs(E.det) < eps) return 'вырожденный (det = 0)';
    if (E.det < 0) return 'седло';
    if (Math.abs(E.tr) < eps) return 'центр';
    const st = E.tr < 0 ? 'устойчивый' : 'неустойчивый';
    return E.disc < 0 ? st + ' фокус' : st + ' узел';
  }
  GBC.widget('linear-phase', (el) => {
    const s = { m: LP.spiral.m.slice(), starts: null };
    const dom = [-3, 3, -3, 3];
    const w = ui.shell(el, { title: 'Фазовый портрет системы x′ = A·x', sub: 'Состояние — точка (x, y), стрелки — куда она движется. Вид портрета определяют два числа матрицы: след τ = a + d и определитель Δ = ad − bc. Справа (ниже на телефоне) — карта «след — определитель»: точка показывает, где ваша матрица. Кликните по портрету, чтобы добавить траекторию.' });
    ui.select(w.controls, { label: 'Готовые матрицы', value: 'spiral', options: Object.entries(LP).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.m = LP[v].m.slice();
      sl.forEach((x, i) => x.set(s.m[i]));
      s.starts = null;
      draw();
    } });
    const sl = ['a', 'b', 'c', 'd'].map((nm, i) => ui.slider(w.controls, { label: nm, min: -3, max: 3, step: 0.1, value: s.m[i], format: (v) => U.fmt(v, 2), onInput: (v) => ((s.m[i] = v), draw()) }));
    const texBox = H('div', { style: 'margin:0 0 4px' });
    w.main.appendChild(texBox);
    const grid = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:10px' });
    w.main.appendChild(grid);
    const b1 = H('div');
    const b2 = H('div');
    grid.append(b1, b2);
    const p1 = new GBC.Plot(b1, { height: 320, equal: true, x: { label: 'x', domain: [-3, 3] }, y: { label: 'y', domain: [-3, 3] } });
    p1.onClick = (x, y) => ((s.starts = (s.starts || []).concat([[x, y]]).slice(-14)), draw());
    const p2 = new GBC.Plot(b2, { height: 320, x: { label: 'след τ = a + d', domain: [-4, 4] }, y: { label: 'определитель Δ', domain: [-3, 5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'tr', label: 'τ' }, { key: 'det', label: 'Δ' }, { key: 'ev', label: 'собственные числа' }, { key: 'k', label: 'тип' }]);
    function draw() {
      const [a, b, c, d] = s.m;
      const F = (x, y) => [a * x + b * y, c * x + d * y];
      const E = eig2(a, b, c, d);
      if (s.starts === null) s.starts = U.range(8).map((i) => [2.6 * Math.cos((i * PI) / 4 + 0.3), 2.6 * Math.sin((i * PI) / 4 + 0.3)]);
      const layers = [
        { type: 'arrows', ...fieldArrows(p1, F, dom, 15, 15), color: 'muted', width: 1.3, opacity: 0.7 },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'vline', x: 0, color: 'axis' },
      ];
      if (E.im === 0 && Math.abs(E.det) > 1e-9) {
        E.re.forEach((lam, i) => {
          let vx = b;
          let vy = lam - a;
          if (Math.hypot(vx, vy) < 1e-9) {
            vx = lam - d;
            vy = c;
          }
          if (Math.hypot(vx, vy) < 1e-9) [vx, vy] = i ? [0, 1] : [1, 0];
          const L = Math.hypot(vx, vy);
          layers.push({ type: 'line', x: [(-5 * vx) / L, (5 * vx) / L], y: [(-5 * vy) / L, (5 * vy) / L], color: i ? 'aqua' : 'violet', width: 1.6, dash: '6 4', label: 'собств. вектор, λ = ' + f2(lam), hover: false });
        });
      }
      const Fs = (t, u) => F(u[0], u[1]);
      s.starts.forEach(([x0, y0]) => {
        const fw = solveODE(Fs, 0, [x0, y0], 6, 600, 'rk4', 50);
        const bw = solveODE(Fs, 0, [x0, y0], -6, 600, 'rk4', 50);
        const pts = bw.ys.slice().reverse().concat(fw.ys.slice(1));
        layers.push({ type: 'line', ...xyClamp(pts.map((p) => p[0]), pts.map((p) => p[1]), -20, 20), color: 'model', width: 2, hover: false });
        const mid = fw.ys[Math.min(60, fw.ys.length - 1)];
        const nxt = fw.ys[Math.min(66, fw.ys.length - 1)];
        if (Math.hypot(nxt[0] - mid[0], nxt[1] - mid[1]) > 0.02) layers.push({ type: 'arrows', x1: [mid[0]], y1: [mid[1]], x2: [nxt[0]], y2: [nxt[1]], color: 'model', width: 2 });
      });
      layers.push({ type: 'points', x: s.starts.map((p) => p[0]), y: s.starts.map((p) => p[1]), color: 'model', r: 3.5 });
      p1.render(layers, { x: [-3, 3], y: [-3, 3] });
      const taus = U.linspace(-4, 4, 200);
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'vline', x: 0, color: 'axis' },
        { type: 'line', x: taus, y: taus.map((t) => (t * t) / 4), color: 'ink2', width: 1.6, dash: '5 4', label: 'Δ = τ²/4: узел ↔ фокус', hover: false },
        { type: 'text', items: [
          { x: 0, y: -1.8, text: 'сёдла', anchor: 'middle' },
          { x: -2.4, y: 4.4, text: 'уст. фокус', anchor: 'middle' },
          { x: 2.4, y: 4.4, text: 'неуст. фокус', anchor: 'middle' },
          { x: -3.9, y: 1.2, text: 'уст. узел', anchor: 'start' },
          { x: 3.9, y: 1.2, text: 'неуст. узел', anchor: 'end' },
        ] },
        { type: 'points', x: [U.clamp(E.tr, -4, 4)], y: [U.clamp(E.det, -3, 5)], color: 'critical', r: 7, label: 'ваша матрица' },
      ]);
      texInto(texBox, R`\begin{pmatrix}x\\y\end{pmatrix}' = \begin{pmatrix}` + f2(a) + '&' + f2(b) + R`\\` + f2(c) + '&' + f2(d) + R`\end{pmatrix}\begin{pmatrix}x\\y\end{pmatrix}`);
      st.set('tr', f2(E.tr));
      st.set('det', f2(E.det));
      st.set('ev', E.im === 0 ? f3(E.re[0]) + ', ' + f3(E.re[1]) : f3(E.re[0]) + ' ± ' + f3(E.im) + 'i');
      st.set('k', kindOf(E));
      note.innerHTML = 'Решения — комбинации e<sup>λt</sup>, где λ — собственные числа A: корни λ² − τλ + Δ = 0. <b>Δ &lt; 0</b> — числа разных знаков: седло, почти все траектории уходят. <b>Δ &gt; 0, τ² &gt; 4Δ</b> — вещественные одного знака: узел (пунктиры — собственные векторы, вдоль них решения идут по прямой). <b>τ² &lt; 4Δ</b> — комплексные: фокус, траектории закручиваются. Знак τ решает, к центру или от него; при τ = 0 — центр, замкнутые орбиты. Пружина с трением из шага 19 — это фокус (или узел при сильном трении). Собственные векторы подробно — в уроке 15.12.';
    }
    w.pythonAction(() => 'import numpy as np\n\nA = np.array([[' + py(s.m[0]) + ', ' + py(s.m[1]) + '], [' + py(s.m[2]) + ', ' + py(s.m[3]) + ']])\ntau, det = np.trace(A), np.linalg.det(A)\nlam, V = np.linalg.eig(A)\nprint("след", tau, " определитель", det, " τ² − 4Δ =", tau**2 - 4 * det)\nprint("собственные числа:", lam)\n\n# решение x(t) = expm(A t) x0 через собственные векторы (A диагонализуема)\nx0 = np.array([2.0, 1.0])\nc = np.linalg.solve(V, x0)\nfor t in (0.0, 1.0, 2.0):\n    print(t, np.real(V @ (c * np.exp(lam * t))))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 21. Маятник: нелинейность и линеаризация
   * ============================================================================== */
  function agm(a, b) {
    for (let i = 0; i < 40; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
    return a;
  }
  const pendPeriod = (A) => (2 * PI) / agm(1, Math.cos(A / 2));
  GBC.widget('pendulum', (el) => {
    const s = { A: 90 };
    const T = 30;
    const w = ui.shell(el, { title: 'Маятник: θ″ = −sin θ', sub: 'Малые колебания почти как у пружины: sin θ ≈ θ даёт θ″ = −θ и период 2π. Но чем больше размах, тем сильнее sin θ отстаёт от θ, и маятник качается медленнее. Снизу — фазовый портрет: замкнутые орбиты (качания), сепаратриса и вращения через верх.' });
    ui.slider(w.controls, { label: 'Начальный угол, °', min: 5, max: 179, step: 1, value: s.A, format: (v) => v + '°', onInput: (v) => ((s.A = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 't', domain: [0, T] }, y: { label: 'угол θ, °', domain: [-185, 185], ticks: [-180, -90, 0, 90, 180] } });
    const p2 = new GBC.Plot(w.main, { height: 260, x: { label: 'угол θ, рад', domain: [-3.6, 3.6] }, y: { label: 'угловая скорость ω', domain: [-2.8, 2.8] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'P', label: 'период' }, { key: 'L', label: 'по линейной модели' }, { key: 'r', label: 'отношение' }, { key: 'w', label: 'max скорость' }]);
    const grid = GBC.Plot.grid((th, om) => (om * om) / 2 - Math.cos(th), -3.6, 3.6, -2.8, 2.8, 141, 121);
    function draw() {
      const A = (s.A * PI) / 180;
      const sol = solveODE((t, u) => [u[1], -Math.sin(u[0])], 0, [A, 0], T, 3000, 'rk4');
      const deg = (r) => (r * 180) / PI;
      p1.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: sol.ts, y: sol.ts.map((t) => s.A * Math.cos(t)), color: 'muted', width: 1.6, dash: '6 4', label: 'линейная модель θ₀·cos t', hover: false },
        { type: 'line', x: sol.ts, y: sol.ys.map((u) => deg(u[0])), color: 'model', width: 2.4, label: 'маятник', hover: false },
      ]);
      const layers = [];
      [-0.6, -0.2, 0.3, 0.7, 1.5, 2].forEach((E) => layers.push({ type: 'contour', grid, level: E, color: 'muted', width: 1 }));
      layers.push({ type: 'contour', grid, level: 1, color: 'tree', width: 1.8, dash: '6 4' });
      layers.push({ type: 'line', x: [NaN], y: [NaN], color: 'tree', dash: '6 4', label: 'сепаратриса' });
      layers.push({ type: 'line', x: sol.ys.map((u) => u[0]), y: sol.ys.map((u) => u[1]), color: 'model', width: 2.4, label: 'ваша орбита', hover: false });
      layers.push({ type: 'points', x: [0, PI, -PI], y: [0, 0, 0], color: (i) => (i ? 'critical' : 'good'), legendColor: 'ink', r: 5, tooltip: (i) => [[i ? 'вверх ногами' : 'внизу', i ? 'седло — неустойчиво' : 'центр']] });
      p2.render(layers);
      const P = pendPeriod(A);
      st.set('P', f3(P));
      st.set('L', f3(2 * PI));
      st.set('r', f3(P / (2 * PI)));
      st.set('w', f3(2 * Math.sin(A / 2)));
      note.innerHTML = '<b>Линеаризация:</b> около равновесия θ = 0 заменяем sin θ на θ (касательная, урок 15.7) и получаем пружину: центр, период 2π. Около θ = π (маятник вверх ногами) sin θ ≈ −(θ − π): θ″ = +(θ − π) — седло, малейшее отклонение растёт. Так и классифицируют равновесия нелинейных систем: по линейной части (матрице Якоби, урок 15.8). Но линеаризация верна только рядом: период при 10° больше 2π лишь на 0.2 %, при 90° — на 18 % (7.416), при 170° — в 2.44 раза; у сепаратрисы (180°) он бесконечен. Период здесь считается точно через эллиптический интеграл.';
    }
    w.pythonAction(() => 'import math\nimport numpy as np\n\nA = math.radians(' + s.A + ')\n\n# точный период: T = 4K(sin(A/2)) = 2π / AGM(1, cos(A/2))\na, b = 1.0, math.cos(A / 2)\nfor _ in range(30):\n    a, b = (a + b) / 2, math.sqrt(a * b)\nprint("период:", 2 * math.pi / a, " линейная модель:", 2 * math.pi)\n\n# проверка численно: первый возврат в θ = A\nf = lambda t, u: np.array([u[1], -math.sin(u[0])])\n' + PY_RK4 + '\nu, h, t = np.array([A, 0.0]), 0.001, 0.0\nwhile True:\n    v_old = u[1]\n    u = rk4(f, t, u, h); t += h\n    if t > 1 and v_old > 0 and u[1] <= 0:     # скорость сменила знак на максимуме\n        print("численно:", round(t, 3)); break\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 22. Хищник — жертва (Лотка — Вольтерра)
   * ============================================================================== */
  GBC.widget('phase-plane', (el) => {
    const s = { x0: 5, m: 'rk4', h: 0.05, k: 100 };
    const TT = 30;
    const sys = (t, u) => [u[0] * (1 - 0.5 * u[1]), u[1] * (-0.75 + 0.25 * u[0])];
    const inv = (u) => 0.25 * u[0] - 0.75 * Math.log(u[0]) + 0.5 * u[1] - Math.log(u[1]);
    const w = ui.shell(el, { title: 'Хищник — жертва: x′ = x(1 − 0.5y), y′ = y(−0.75 + 0.25x)', sub: 'x — зайцы, y — рыси. Без рысей зайцы размножаются, без зайцев рыси вымирают; встречи (x·y) кормят рысей за счёт зайцев. Сверху — фазовая плоскость с нулевыми изоклинами, снизу — обе численности во времени.' });
    ui.slider(w.controls, { label: 'Зайцев в начале (рысей 1)', min: 3.2, max: 8, step: 0.2, value: s.x0, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.x0 = v), draw()) });
    ui.segmented(w.controls, { label: 'Метод', value: s.m, options: [{ value: 'euler', label: 'Эйлер' }, { value: 'rk4', label: 'Рунге — Кутта' }], onChange: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'Шаг h', values: [0.2, 0.1, 0.05, 0.01], value: s.h, format: String, onInput: (v) => ((s.h = v), draw()) });
    ui.player(w.controls, { label: 'Время', min: 1, max: 100, value: 100, fps: 10, format: (v) => Math.round((v * TT) / 100) + ' из ' + TT, onChange: (v) => ((s.k = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 300, x: { label: 'зайцы x', domain: [0, 10] }, y: { label: 'рыси y', domain: [0, 6] } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 't', domain: [0, TT] }, y: { label: 'численность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'E', label: 'сохраняемая величина V: конец − начало' }, { key: 'P', label: 'период цикла' }]);
    function draw() {
      const sol = solveODE(sys, 0, [s.x0, 1], TT, Math.round(TT / s.h), s.m, 1e4);
      const n = Math.max(2, Math.round((sol.ts.length * s.k) / 100));
      const xs = sol.ys.slice(0, n).map((p) => p[0]);
      const ys = sol.ys.slice(0, n).map((p) => p[1]);
      p1.render([
        { type: 'arrows', ...fieldArrows(p1, (x, y) => sys(0, [x, y]), [0, 10, 0, 6], 16, 10), color: 'muted', width: 1.2, opacity: 0.6 },
        { type: 'vline', x: 3, color: 'aqua', dash: '5 4', width: 1.4, label: 'y′ = 0 (x = 3)' },
        { type: 'hline', y: 2, color: 'violet', dash: '5 4', width: 1.4, label: 'x′ = 0 (y = 2)' },
        { type: 'line', ...xyClamp(xs, ys, -1, 50), color: 'model', width: 2, hover: false },
        { type: 'points', x: [3], y: [2], color: 'ink', r: 5, hollow: true, label: 'равновесие (3, 2)' },
        { type: 'points', x: [xs[xs.length - 1]], y: [ys[ys.length - 1]], color: 'tree', r: 6 },
      ]);
      const tt = sol.ts.slice(0, n);
      p2.render([
        { type: 'line', x: tt, y: clampArr(xs, -1, 30), color: 'model', width: 2.2, label: 'зайцы x', hover: false },
        { type: 'line', x: tt, y: clampArr(ys, -1, 30), color: 'tree', width: 2.2, label: 'рыси y', hover: false },
      ], { x: [0, TT], y: [0, Math.min(30, Math.max(8, ...xs.filter(Number.isFinite)) * 1.05)] });
      const end = sol.ys[sol.ys.length - 1];
      const dV = inv(end) - inv([s.x0, 1]);
      // период: между двумя последними максимумами зайцев
      const fine = solveODE(sys, 0, [s.x0, 1], TT, 6000, 'rk4');
      const mx = [];
      for (let i = 1; i + 1 < fine.ys.length; i++) if (fine.ys[i][0] > fine.ys[i - 1][0] && fine.ys[i][0] >= fine.ys[i + 1][0]) mx.push(fine.ts[i]);
      st.set('E', Number.isFinite(dV) ? sci(dV) : '—');
      st.set('P', mx.length >= 2 ? f3(mx[mx.length - 1] - mx[mx.length - 2]) : '—');
      note.innerHTML = 'Цикл: зайцев много → рыси размножаются → зайцев меньше → рыси голодают → зайцы восстанавливаются. На нулевых изоклинах одна из скоростей равна нулю: на вертикали x = 3 число рысей на пике или на дне, на горизонтали y = 2 — число зайцев. Точные траектории замкнуты: сохраняется V = 0.25x − 0.75 ln x + 0.5y − ln y. ' + (s.m === 'euler' ? '<b>Эйлер</b> раскручивает цикл наружу: V растёт с каждым витком (при h = 0.2 — очень заметно), и модель «предсказывает» всё более страшные вспышки.' : 'Рунге — Кутта сохраняет V с точностью ' + sci(Math.abs(dV)) + ' и замыкает цикл.') + ' Близко к равновесию цикл почти эллипс с периодом 2π/√0.75 ≈ 7.26, большие циклы длиннее.';
    }
    w.pythonAction(() => 'import math\nimport numpy as np\n\nf = lambda t, u: np.array([u[0] * (1 - 0.5 * u[1]), u[1] * (-0.75 + 0.25 * u[0])])\nV = lambda u: 0.25 * u[0] - 0.75 * math.log(u[0]) + 0.5 * u[1] - math.log(u[1])   # сохраняется\n\n' + PY_RK4 + '\n\ndef euler(f, t, y, h):\n    return y + h * f(t, y)\n\n\nh = ' + py(s.h) + '\nfor step in (euler, rk4):\n    u = np.array([' + py(s.x0) + ', 1.0])\n    for i in range(round(30 / h)):\n        u = step(f, i * h, u, h)\n    print(f"{step.__name__}: V(конец) − V(начало) = {V(u) - V([' + py(s.x0) + ', 1.0]):.2e}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 22. Эпидемия: модель SIR
   * ============================================================================== */
  GBC.widget('sir', (el) => {
    const s = { R0: 2.5, v: 0 };
    const gam = 0.2;
    const TT = 300;
    const w = ui.shell(el, { title: 'Эпидемия: модель SIR', sub: 'S — восприимчивые, I — болеющие, R — переболевшие (доли населения). S′ = −βSI, I′ = βSI − γI, R′ = γI. Болезнь длится в среднем 1/γ = 5 дней; R₀ = β/γ — сколько человек заражает один больной в полностью восприимчивом обществе. Часть v привита заранее.' });
    ui.slider(w.controls, { label: 'Базовое число R₀', min: 0.8, max: 5, step: 0.1, value: s.R0, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.R0 = v), draw()) });
    ui.slider(w.controls, { label: 'Привито заранее, доля v', min: 0, max: 0.9, step: 0.05, value: s.v, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => ((s.v = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 280, x: { label: 'день', domain: [0, TT] }, y: { label: 'доля населения', domain: [0, 1] } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'восприимчивые S', domain: [0, 1] }, y: { label: 'болеющие I' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'herd', label: 'порог иммунитета 1 − 1/R₀' }, { key: 'pk', label: 'пик болеющих' }, { key: 'day', label: 'день пика' }, { key: 'fin', label: 'переболело за всё время' }]);
    function draw() {
      const beta = s.R0 * gam;
      const S0 = (1 - s.v) * 0.999;
      const sys = (t, u) => [-beta * u[0] * u[1], beta * u[0] * u[1] - gam * u[1], gam * u[1]];
      const sol = solveODE(sys, 0, [S0, 0.001, 0], TT, 3000, 'rk4');
      const S = sol.ys.map((u) => u[0]);
      const I = sol.ys.map((u) => u[1]);
      const Rr = sol.ys.map((u) => u[2]);
      let ip = 0;
      I.forEach((v, i) => (v > I[ip] ? (ip = i) : null));
      p1.render([
        { type: 'line', x: sol.ts, y: S, color: 'blue', width: 2.2, label: 'S — восприимчивые', hover: false },
        { type: 'line', x: sol.ts, y: I, color: 'orange', width: 2.6, label: 'I — болеют', hover: false },
        { type: 'line', x: sol.ts, y: Rr, color: 'aqua', width: 2.2, label: 'R — переболели', hover: false },
        ip > 0 ? { type: 'vline', x: sol.ts[ip], color: 'ink2', dash: '3 3', width: 1, text: 'пик' } : null,
      ]);
      p2.render([
        { type: 'vline', x: 1 / s.R0, color: 'ink2', dash: '5 4', width: 1.4, text: 'S = 1/R₀' },
        { type: 'line', x: S, y: I, color: 'orange', width: 2.4, hover: false },
        { type: 'points', x: [S0], y: [0.001], color: 'ink', r: 5, hollow: true, label: 'старт' },
      ], { x: [0, 1], y: yDom(I.concat([0]), 0.06) });
      st.set('herd', s.R0 > 1 ? Math.round((1 - 1 / s.R0) * 1000) / 10 + ' %' : 'нет (R₀ ≤ 1)');
      st.set('pk', Math.round(I[ip] * 1000) / 10 + ' %');
      st.set('day', ip > 0 ? String(Math.round(sol.ts[ip])) : 'сразу спад');
      st.set('fin', Math.round(Rr[Rr.length - 1] * 1000) / 10 + ' %');
      note.innerHTML = 'I′ = I·(βS − γ): эпидемия растёт, пока S &gt; γ/β = 1/R₀, и идёт на спад, когда восприимчивых стало меньше 1/R₀ — пик всегда приходится на S = 1/R₀ (вертикаль снизу). Отсюда <b>порог коллективного иммунитета</b> 1 − 1/R₀: при R₀ = 2.5 это 60 %. Без прививок переболеет 89 % (больше порога: эпидемия по инерции «перелетает» его), пик — 23.4 % на 24-й день. Если заранее привить 60 %, вспышки почти нет (2.8 % за всё время), 50 % — 18.9 %, 30 % — 50 %. Модель нелинейная (произведение S·I), формулы для I(t) нет — только численное решение и качественный анализ.';
    }
    w.pythonAction(() => 'import numpy as np\n\nR0, v, gamma = ' + py(s.R0) + ', ' + py(s.v) + ', 0.2\nbeta = R0 * gamma\nf = lambda t, u: np.array([-beta * u[0] * u[1], beta * u[0] * u[1] - gamma * u[1], gamma * u[1]])\n\n' + PY_RK4 + '\nu, h = np.array([(1 - v) * 0.999, 0.001, 0.0]), 0.1\npeak, day = 0.0, 0\nfor i in range(3000):\n    u = rk4(f, i * h, u, h)\n    if u[1] > peak:\n        peak, day = u[1], (i + 1) * h\nprint(f"пик {peak:.3%} на день {day:.0f}; переболело {u[2]:.3%}; порог 1 − 1/R0 = {1 - 1 / R0:.1%}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 23. Сохраняющиеся величины: дрейф энергии
   * ============================================================================== */
  GBC.widget('energy-drift', (el) => {
    const s = { h: 0.1, on: { euler: true, implicit: true, sympl: true, rk4: true } };
    const T = 20;
    const w = ui.shell(el, { title: 'Пружина x″ = −x: куда уходит энергия', sub: 'Точное решение — окружность x² + v² = 1, энергия E = (x² + v²)/2 сохраняется. Сравните, как её «чинят» или «портят» разные методы при одном и том же шаге.' });
    ui.slider(w.controls, { label: 'Шаг h', values: [0.3, 0.2, 0.1, 0.05], value: s.h, format: String, onInput: (v) => ((s.h = v), draw()) });
    ['euler', 'implicit', 'sympl', 'rk4'].forEach((m) => ui.toggle(w.controls, { label: MNAME[m], checked: s.on[m], onChange: (v) => ((s.on[m] = v), draw()) }));
    const box = H('div', { style: 'max-width:420px;margin:0 auto' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 320, equal: true, x: { label: 'x', domain: [-2.2, 2.2] }, y: { label: 'v', domain: [-2.2, 2.2] } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 't', domain: [0, T] }, y: { label: 'энергия E / E₀' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, ['euler', 'implicit', 'sympl', 'rk4'].map((m) => ({ key: m, label: MNAME[m] + ': E(' + T + ')/E₀' })));
    function run(m, h) {
      const n = Math.round(T / h);
      let x = 1;
      let v = 0;
      const xs = [x];
      const vs = [v];
      for (let i = 0; i < n; i++) {
        if (m === 'euler') [x, v] = [x + h * v, v - h * x];
        else if (m === 'implicit') [x, v] = [(x + h * v) / (1 + h * h), (v - h * x) / (1 + h * h)];
        else if (m === 'sympl') {
          v = v - h * x;
          x = x + h * v;
        } else [x, v] = stepODE((t, u) => [u[1], -u[0]], 0, [x, v], h, 'rk4');
        xs.push(x);
        vs.push(v);
      }
      return { xs, vs, ts: U.range(n + 1).map((i) => i * h), E: xs.map((a, i) => a * a + vs[i] * vs[i]) };
    }
    function draw() {
      const th = U.linspace(0, 2 * PI, 200);
      const l1 = [{ type: 'line', x: th.map(Math.cos), y: th.map(Math.sin), color: 'ink', width: 1.4, dash: '5 4', label: 'точно', hover: false }];
      const l2 = [{ type: 'hline', y: 1, color: 'ink2', dash: '5 4', width: 1 }];
      const all = [1];
      ['euler', 'implicit', 'sympl', 'rk4'].forEach((m) => {
        const r = run(m, s.h);
        st.set(m, f4(r.E[r.E.length - 1]));
        if (!s.on[m]) return;
        l1.push({ type: 'line', x: r.xs, y: r.vs, color: MCOL[m], width: 1.6, label: MNAME[m], hover: false });
        l2.push({ type: 'line', x: r.ts, y: r.E, color: MCOL[m], width: 2, label: MNAME[m] });
        all.push(...r.E);
      });
      p1.render(l1);
      p2.render(l2, { y: yDom(all.filter((v) => v < 30), 0.06) });
      note.innerHTML = 'За шаг <b>Эйлер</b> умножает энергию на 1 + h² (|R(ih)|² = 1 + h²): спираль наружу, при h = 0.1 за 100 шагов радиус растёт в 1.645 раза. <b>Неявный Эйлер</b> — на 1/(1 + h²): спираль внутрь, искусственное трение. <b>Симплектический Эйлер</b> (сначала скорость, потом положение уже с новой скоростью) стоит столько же, сколько обычный, но энергия у него только колеблется около верного значения и не уплывает: орбита замкнута, лишь слегка сплюснута. <b>РК4</b> теряет за шаг ≈ h⁶/72 энергии — за 100 шагов 1.4·10⁻⁶. Мораль: для долгих расчётов важны не только порядок, но и <em>структура</em> — что метод сохраняет. На этой идее держатся методы моделирования планет и молекул.';
    }
    w.pythonAction(() => 'h, T = ' + py(s.h) + ', ' + T + '\nn = round(T / h)\nfor name in ("Эйлер", "неявный", "симплектический"):\n    x, v = 1.0, 0.0\n    for _ in range(n):\n        if name == "Эйлер":\n            x, v = x + h * v, v - h * x\n        elif name == "неявный":\n            x, v = (x + h * v) / (1 + h * h), (v - h * x) / (1 + h * h)\n        else:\n            v = v - h * x          # сначала скорость\n            x = x + h * v          # потом положение — уже с новой скоростью\n    print(f"{name:16}: энергия в конце / в начале = {x * x + v * v:.6f}")\nprint("теория для Эйлера: (1 + h²)^n =", (1 + h * h) ** n)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 24. Градиентный поток и градиентный спуск
   * ============================================================================== */
  const GL = {
    par: { label: 'парабола L = θ²/2·a', L: (t, a) => (a * t * t) / 2, g: (t, a) => a * t, h2: (t, a) => a, dom: [-3, 3], mins: () => [0], py: 'a * th**2 / 2', pyg: 'a * th' },
    well: { label: 'две ямы L = (θ² − 1)²/4', L: (t) => ((t * t - 1) ** 2) / 4, g: (t) => t * t * t - t, h2: (t) => 3 * t * t - 1, dom: [-2, 2], mins: () => [-1, 1], py: '(th**2 - 1)**2 / 4', pyg: 'th**3 - th' },
    lc: { label: 'L = ln ch θ (как Хьюбер)', L: (t) => Math.log(Math.cosh(t)), g: (t) => Math.tanh(t), h2: (t) => 1 / Math.cosh(t) ** 2, dom: [-4, 4], mins: () => [0], py: 'np.log(np.cosh(th))', pyg: 'np.tanh(th)' },
  };
  GBC.widget('gd-flow', (el) => {
    const s = { key: 'par', a: 1, eta: 0.5, th0: 2.5 };
    const N = 30;
    const w = ui.shell(el, { title: 'Градиентный поток и градиентный спуск', sub: 'Поток θ′ = −L′(θ): параметр непрерывно скатывается в минимум. Градиентный спуск θₖ₊₁ = θₖ − η·L′(θₖ) — метод Эйлера для этого уравнения с шагом η. Сверху — потери и точки спуска, снизу — θ во «времени» t = η·k.' });
    ui.select(w.controls, { label: 'Потери', value: s.key, options: Object.entries(GL).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), (s.th0 = v === 'well' ? 0.3 : 2.5), th.set(s.th0), draw()) });
    ui.slider(w.controls, { label: 'Кривизна a (для параболы)', min: 0.5, max: 3, step: 0.1, value: s.a, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'Темп обучения η', min: 0.05, max: 2.5, step: 0.05, value: s.eta, format: f2, onInput: (v) => ((s.eta = v), draw()) });
    const th = ui.slider(w.controls, { label: 'Старт θ₀', min: -3, max: 3, step: 0.1, value: s.th0, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.th0 = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'θ' }, y: { label: 'L(θ)' } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: '«время» t = η·k' }, y: { label: 'θ' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'минимум и L″ в нём' }, { key: 'b', label: 'граница 2/L″' }, { key: 'k', label: 'шагов до |θ − θ*| < 10⁻³' }, { key: 'v', label: 'вывод' }]);
    function draw() {
      const G = GL[s.key];
      const a = s.a;
      const [lo, hi] = G.dom;
      const xs = U.linspace(lo, hi, 300);
      const Ls = xs.map((t) => G.L(t, a));
      const its = [s.th0];
      for (let k = 0; k < N; k++) its.push(its[k] - s.eta * G.g(its[k], a));
      const T = s.eta * N;
      const flow = solveODE((t, y) => -G.g(y, a), 0, s.th0, T, 600, 'rk4');
      const mins = G.mins();
      const thStar = flow.ys[flow.ys.length - 1];
      const target = mins.reduce((b, m) => (Math.abs(m - thStar) < Math.abs(b - thStar) ? m : b), mins[0]);
      const curv = G.h2(target, a);
      let kk = its.findIndex((v) => Math.abs(v - target) < 1e-3);
      const inside = its.map((v) => (Math.abs(v) <= Math.max(Math.abs(lo), Math.abs(hi)) * 1.6 ? v : NaN));
      p1.render([
        { type: 'line', x: xs, y: Ls, color: 'ink', width: 2.2, hover: false },
        { type: 'line', x: inside.slice(0, 16), y: inside.slice(0, 16).map((v) => G.L(v, a)), color: 'tree', width: 1.2, opacity: 0.7, hover: false },
        { type: 'points', x: inside.slice(0, 16), y: inside.slice(0, 16).map((v) => G.L(v, a)), color: 'tree', r: 4.5, label: 'шаги спуска', tooltip: (i) => [['k', String(i)], ['θ', f4(its[i])], ['L', f4(G.L(its[i], a))]] },
        { type: 'points', x: [thStar], y: [G.L(thStar, a)], color: 'model', r: 6, hollow: true, label: 'куда пришёл поток' },
      ], { x: [lo, hi], y: yDom(Ls, 0.05) });
      p2.render([
        { type: 'hline', y: target, color: 'ink2', dash: '4 4', width: 1 },
        { type: 'line', x: flow.ts, y: flow.ys, color: 'model', width: 2.4, label: 'поток θ′ = −L′(θ)', hover: false },
        { type: 'line', x: its.map((_, k) => k * s.eta), y: clampArr(its, -10, 10), color: 'tree', width: 1.2, opacity: 0.7, hover: false },
        { type: 'points', x: its.map((_, k) => k * s.eta), y: clampArr(its, -10, 10), color: 'tree', r: 3.8, label: 'спуск, шаг η' },
      ], { x: [0, T], y: yDom(flow.ys.concat([target]).concat(clampArr(its, -4, 4).filter(Number.isFinite)), 0.08) });
      const div = !Number.isFinite(its[N]) || Math.abs(its[N]) > 10;
      if (kk < 0) kk = NaN;
      st.set('m', 'θ* = ' + f2(target) + ', L″ = ' + f2(curv));
      st.set('b', 'η < ' + f3(2 / curv));
      st.set('k', Number.isFinite(kk) ? String(kk) : div ? 'расходится' : '> ' + N);
      st.set('v', div ? 'неустойчиво' : s.eta * curv > 1 ? 'зигзаг' : 'плавно');
      note.innerHTML = 'Вдоль потока потери только убывают: dL/dt = L′(θ)·θ′ = −(L′)² ≤ 0 — L работает как «энергия» (функция Ляпунова), поэтому поток всегда приходит в минимум (или седловую точку). Спуск — шаги Эйлера, и около минимума θ* он ведёт себя как Эйлер для y′ = −L″(θ*)·y: множитель 1 − η·L″, устойчиво при <b>η &lt; 2/L″(θ*)</b>. Для параболы с a = 1 это η &lt; 2; у двух ям L″(±1) = 2, граница η &lt; 1; у ln ch θ кривизна в минимуме 1, но вдали она мала, и спуск далеко от минимума идёт медленно, с почти постоянным шагом η (градиент там ≈ ±1, как у модуля). Чем меньше η, тем точнее спуск повторяет поток — и тем больше шагов нужно.';
    }
    w.pythonAction(() => {
      const G = GL[s.key];
      return 'import numpy as np\n\na, eta, th = ' + py(s.a) + ', ' + py(s.eta) + ', ' + py(s.th0) + '\ngrad = lambda th: ' + G.pyg + '\n\nfor k in range(' + N + '):\n    th = th - eta * grad(th)          # шаг Эйлера для θ′ = −L′(θ)\n    if k < 8 or k % 10 == 9:\n        print(f"k = {k + 1:2d}: θ = {th:+.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 25. Обусловленность: быстрые и медленные направления
   * ============================================================================== */
  function quadLayers(kap, dom, levels) {
    const grid = GBC.Plot.grid((x, y) => 0.5 * (x * x + kap * y * y), dom[0], dom[1], dom[2], dom[3], 121, 81);
    return levels.map((lv) => ({ type: 'contour', grid, level: lv, color: 'axis', width: 1 }));
  }
  GBC.widget('mode-decay', (el) => {
    const s = { kap: 10, q: 0.9 };
    const dom = [-2.4, 2.4, -1.4, 1.4];
    const N = 60;
    const w = ui.shell(el, { title: 'Два направления — две скорости', sub: 'L = (θ₁² + κ·θ₂²)/2: «овраг», вдоль θ₁ пологий (кривизна 1), поперёк крутой (кривизна κ). Поток сначала быстро падает на дно оврага, потом медленно ползёт вдоль. Спуск с темпом η умножает каждую координату на своё число: 1 − η и 1 − ηκ.' });
    ui.slider(w.controls, { label: 'Обусловленность κ = λmax/λmin', min: 2, max: 50, step: 1, value: s.kap, format: String, onInput: (v) => ((s.kap = v), draw()) });
    const qs = ui.slider(w.controls, { label: 'Темп η в долях границы 2/κ', min: 0.05, max: 1.1, step: 0.01, value: s.q, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => ((s.q = v), draw()) });
    ui.button(w.controls, { label: 'Лучший η = 2/(1 + κ)', onClick: () => ((s.q = s.kap / (1 + s.kap)), qs.set(s.q), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 280, equal: true, x: { label: 'θ₁ (пологое)', domain: [dom[0], dom[1]] }, y: { label: 'θ₂ (крутое)', domain: [dom[2], dom[3]] } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'шаг k', domain: [0, N] }, y: { label: '|θᵢ| (лог.)', type: 'log', domain: [1e-6, 10], ticks: [1e-6, 1e-4, 1e-2, 1], format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'eta', label: 'η' }, { key: 'q1', label: '|1 − η| (пологое)' }, { key: 'q2', label: '|1 − ηκ| (крутое)' }, { key: 'k', label: 'шагов до ‖θ‖ < 10⁻³' }]);
    function draw() {
      const kap = s.kap;
      const eta = (2 / kap) * s.q;
      const th = [[2, 1]];
      for (let k = 0; k < N; k++) th.push([th[k][0] * (1 - eta), th[k][1] * (1 - eta * kap)]);
      const tf = U.linspace(0, 12, 400);
      const layers = quadLayers(kap, dom, [0.05, 0.2, 0.5, 1, 2, 3.5, 6, 10]);
      layers.push({ type: 'line', x: tf.map((t) => 2 * Math.exp(-t)), y: tf.map((t) => Math.exp(-kap * t)), color: 'model', width: 2.4, label: 'поток', hover: false });
      const gp = xyClamp(th.map((p) => p[0]), th.map((p) => p[1]), -10, 10);
      layers.push({ type: 'line', ...gp, color: 'tree', width: 1.4, hover: false });
      layers.push({ type: 'points', ...gp, color: 'tree', r: 3.5, label: 'спуск' });
      p1.render(layers, { x: [dom[0], dom[1]], y: [dom[2], dom[3]] });
      const ks = U.range(N + 1);
      p2.render([
        { type: 'line', x: ks, y: th.map((p) => U.clamp(Math.abs(p[0]), 1e-6, 10)), color: 'model', width: 2.2, label: 'пологое |θ₁|' },
        { type: 'line', x: ks, y: th.map((p) => U.clamp(Math.abs(p[1]), 1e-6, 10)), color: 'tree', width: 2.2, label: 'крутое |θ₂|' },
        { type: 'hline', y: 1e-3, color: 'ink2', dash: '4 4', width: 1 },
      ]);
      let kk = -1;
      for (let k = 0; k <= 5000; k++) {
        const a = 2 * Math.pow(Math.abs(1 - eta), k);
        const b = Math.pow(Math.abs(1 - eta * kap), k);
        if (Math.hypot(a, b) < 1e-3) {
          kk = k;
          break;
        }
        if (!Number.isFinite(a + b) || a + b > 1e6) break;
      }
      st.set('eta', f4(eta));
      st.set('q1', f4(Math.abs(1 - eta)));
      st.set('q2', f4(Math.abs(1 - eta * kap)));
      st.set('k', kk >= 0 ? String(kk) : 'расходится или > 5000');
      note.innerHTML = 'Поток решает каждое направление отдельно: θ₁ = θ₁(0)e<sup>−t</sup>, θ₂ = θ₂(0)e<sup>−κt</sup>. У спуска один темп на оба: устойчивость диктует <b>крутое</b> направление (η &lt; 2/κ), а скорость сходимости — <b>пологое</b> (множитель 1 − η близок к 1). Лучший постоянный темп η = 2/(1 + κ) уравнивает множители: |1 − η| = |1 − ηκ| = (κ − 1)/(κ + 1). При κ = 10 это 0.818 — 39 шагов до точности 10⁻³ из точки (2, 1) против 73 при η = 0.1. Число шагов растёт пропорционально κ — вот почему плохо обусловленные задачи сложны и зачем нужны масштабирование признаков, моментум (шаг 26) и методы второго порядка (урок 15.7).';
    }
    w.pythonAction(() => 'import numpy as np\n\nkappa, eta = ' + py(s.kap) + ', ' + py((2 / s.kap) * s.q) + '\nlam = np.array([1.0, kappa])           # кривизны по двум направлениям\nth = np.array([2.0, 1.0])\nfor k in range(1, 2001):\n    th = th - eta * lam * th            # градиент L = ½(θ₁² + κθ₂²) — это λ·θ\n    if np.linalg.norm(th) < 1e-3:\n        print("шагов:", k); break\nprint("множители:", np.abs(1 - eta * lam), " лучший η =", 2 / (1 + kappa), " его множитель", (kappa - 1) / (kappa + 1))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 26. Моментум: шарик с трением
   * ============================================================================== */
  GBC.widget('heavy-ball', (el) => {
    const s = { kap: 10, beta: 0.27, q: 0.5 };
    const dom = [-2.4, 2.4, -1.4, 1.4];
    const N = 60;
    const w = ui.shell(el, { title: 'Моментум = шарик с трением', sub: 'Тяжёлый шарик в овраге: θ″ + γ·θ′ + ∇L(θ) = 0. Его дискретизация — метод тяжёлого шарика (моментум): θₖ₊₁ = θₖ − η∇L(θₖ) + β(θₖ − θₖ₋₁). Инерция разгоняет вдоль пологого дна, трение гасит раскачку поперёк.' });
    ui.slider(w.controls, { label: 'Обусловленность κ', min: 2, max: 100, step: 1, value: s.kap, format: String, onInput: (v) => ((s.kap = v), draw()) });
    const bs = ui.slider(w.controls, { label: 'Моментум β', min: 0, max: 0.95, step: 0.01, value: s.beta, format: f2, onInput: (v) => ((s.beta = v), draw()) });
    const qs = ui.slider(w.controls, { label: 'Темп η в долях 4/(1 + √κ)²', min: 0.1, max: 1.5, step: 0.01, value: 1, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => ((s.q = v), draw()) });
    s.q = 1;
    ui.button(w.controls, { label: 'Оптимальные η и β (Поляк)', onClick: () => {
      const r = (Math.sqrt(s.kap) - 1) / (Math.sqrt(s.kap) + 1);
      s.beta = r * r;
      s.q = 1;
      bs.set(s.beta);
      qs.set(1);
      draw();
    } });
    const p1 = new GBC.Plot(w.main, { height: 280, equal: true, x: { label: 'θ₁', domain: [dom[0], dom[1]] }, y: { label: 'θ₂', domain: [dom[2], dom[3]] } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'шаг k', domain: [0, N] }, y: { label: '‖θ‖ (лог.)', type: 'log', domain: [1e-6, 10], ticks: [1e-6, 1e-4, 1e-2, 1], format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'спуск (лучший η): шагов до 10⁻³' }, { key: 'm', label: 'моментум: шагов' }, { key: 'r', label: 'теория: (κ−1)/(κ+1) и (√κ−1)/(√κ+1)' }]);
    function steps(eta, beta) {
      const lam = [1, s.kap];
      let th = [2, 1];
      let prev = th.slice();
      const out = [th];
      let hit = -1;
      for (let k = 1; k <= 3000; k++) {
        const nx = th.map((v, i) => v - eta * lam[i] * v + beta * (v - prev[i]));
        prev = th;
        th = nx;
        if (k <= N) out.push(th);
        const nr = Math.hypot(th[0], th[1]);
        if (hit < 0 && nr < 1e-3) hit = k;
        if (!Number.isFinite(nr) || nr > 1e8) break;
        if (hit > 0 && k > N) break;
      }
      return { out, hit };
    }
    function draw() {
      const kap = s.kap;
      const etaHB = (4 / Math.pow(1 + Math.sqrt(kap), 2)) * s.q;
      const gd = steps(2 / (1 + kap), 0);
      const hb = steps(etaHB, s.beta);
      const layers = quadLayers(kap, dom, [0.05, 0.2, 0.5, 1, 2, 3.5, 6, 10]);
      const P = (r) => xyClamp(r.out.map((p) => p[0]), r.out.map((p) => p[1]), -10, 10);
      const g = P(gd);
      const m = P(hb);
      layers.push({ type: 'line', ...g, color: 'tree', width: 1.4, label: 'спуск, η = 2/(1 + κ)', hover: false });
      layers.push({ type: 'points', ...g, color: 'tree', r: 2.8 });
      layers.push({ type: 'line', ...m, color: 'model', width: 1.8, label: 'моментум', hover: false });
      layers.push({ type: 'points', ...m, color: 'model', r: 2.8 });
      p1.render(layers, { x: [dom[0], dom[1]], y: [dom[2], dom[3]] });
      const ks = U.range(N + 1);
      p2.render([
        { type: 'line', x: ks.slice(0, gd.out.length), y: gd.out.map((p) => U.clamp(Math.hypot(p[0], p[1]), 1e-6, 10)), color: 'tree', width: 2.2, label: 'спуск' },
        { type: 'line', x: ks.slice(0, hb.out.length), y: hb.out.map((p) => U.clamp(Math.hypot(p[0], p[1]), 1e-6, 10)), color: 'model', width: 2.2, label: 'моментум' },
        { type: 'hline', y: 1e-3, color: 'ink2', dash: '4 4', width: 1 },
      ]);
      const r1 = (kap - 1) / (kap + 1);
      const r2 = (Math.sqrt(kap) - 1) / (Math.sqrt(kap) + 1);
      st.set('g', gd.hit > 0 ? String(gd.hit) : '—');
      st.set('m', hb.hit > 0 ? String(hb.hit) : 'не сошёлся');
      st.set('r', f3(r1) + ' и ' + f3(r2));
      note.innerHTML = 'Связь с уравнением точная: заменим θ″ ≈ (θₖ₊₁ − 2θₖ + θₖ₋₁)/h², θ′ ≈ (θₖ − θₖ₋₁)/h — и получим моментум с <b>β = 1 − γh</b>, <b>η = h²</b>. Каждое направление — затухающий осциллятор из шага 19 с ω² = λᵢ. Без трения (β → 1) шарик качается вечно, при слишком сильном (β = 0) — обычный спуск ползёт по дну. Оптимум Поляка β = ((√κ − 1)/(√κ + 1))² делает оба направления слегка недодемпфированными, и множитель за шаг падает с (κ − 1)/(κ + 1) до (√κ − 1)/(√κ + 1): при κ = 10 — с 0.818 до 0.519 (16 шагов вместо 39), при κ = 100 число шагов до 10⁻⁶ из точки (1, 1) падает с 709 до 95, при κ = 1000 — с 7082 до 321. Число шагов растёт примерно как √κ вместо κ.';
    }
    w.pythonAction(() => 'import numpy as np\n\nkappa, beta = ' + py(s.kap) + ', ' + py(s.beta) + '\neta = ' + py(s.q) + ' * 4 / (1 + np.sqrt(kappa)) ** 2\nlam = np.array([1.0, kappa])\n\n\ndef run(eta, beta):\n    th = prev = np.array([2.0, 1.0])\n    for k in range(1, 5001):\n        th, prev = th - eta * lam * th + beta * (th - prev), th\n        if np.linalg.norm(th) < 1e-3:\n            return k\n    return None\n\n\nprint("спуск, η = 2/(1 + κ):", run(2 / (1 + kappa), 0.0), "шагов")\nprint("моментум:", run(eta, beta), "шагов")\nb_opt = ((np.sqrt(kappa) - 1) / (np.sqrt(kappa) + 1)) ** 2\nprint("оптимум Поляка: β =", b_opt, "→", run(4 / (1 + np.sqrt(kappa)) ** 2, b_opt), "шагов")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 27. Бустинг — метод Эйлера в пространстве прогнозов
   * ============================================================================== */
  const sig = (z) => 1 / (1 + Math.exp(-z));
  GBC.widget('boost-flow', (el) => {
    const s = { loss: 'sq', nu: 0.3, p: 0.7, newton: false };
    const w = ui.shell(el, { title: 'Бустинг одной группы объектов как метод Эйлера', sub: 'Возьмём лист, в который попали одинаковые объекты, и проследим их прогноз F. Идеальный «поток» F′ = −∂L/∂F, бустинг с темпом ν — его шаги Эйлера. Квадратичные потери: цель y = 10. Логистические: в листе доля единиц p̄, прогноз F — логит.' });
    ui.segmented(w.controls, { label: 'Потери', value: s.loss, options: [{ value: 'sq', label: 'квадратичные' }, { value: 'log', label: 'логистические' }], onChange: (v) => ((s.loss = v), build(), draw()) });
    const ctl = H('div');
    w.controls.appendChild(ctl);
    function build() {
      ctl.textContent = '';
      if (s.loss === 'sq') {
        s.nu = Math.min(s.nu, 2.3);
        ui.slider(ctl, { label: 'Темп ν (шаг Эйлера)', min: 0.05, max: 2.3, step: 0.05, value: s.nu, format: f2, onInput: (v) => ((s.nu = v), draw()) });
      } else {
        ui.slider(ctl, { label: 'Темп ν', min: 0.05, max: 12, log: true, value: s.nu, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.nu = v), draw()) });
        ui.slider(ctl, { label: 'Доля единиц в листе p̄', min: 0.55, max: 1, step: 0.01, value: s.p, format: f2, onInput: (v) => ((s.p = v), draw()) });
        ui.toggle(ctl, { label: 'Шаг Ньютона (как XGBoost): −g/h', checked: s.newton, onChange: (v) => ((s.newton = v), draw()) });
      }
    }
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: '«время» t = ν·M' }, y: { label: 'прогноз F' } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: '«время» t = ν·M' }, y: { label: '' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '' }, { key: 'b', label: '' }, { key: 'c', label: '' }]);
    const keys = w.foot.querySelectorAll('.stat .k');
    const lab = (a, b, c) => ((keys[0].textContent = a), (keys[1].textContent = b), (keys[2].textContent = c));
    function draw() {
      const T = s.loss === 'sq' ? 6 : 12;
      const M = Math.min(400, Math.max(1, Math.round(T / s.nu)));
      if (s.loss === 'sq') {
        const y = 10;
        const Fs = [0];
        for (let m = 0; m < M; m++) Fs.push(Fs[m] + s.nu * (y - Fs[m]));
        const ts = U.linspace(0, T, 300);
        const tm = Fs.map((_, m) => m * s.nu);
        p1.render([
          { type: 'hline', y, color: 'ink2', dash: '4 4', text: 'цель y = 10' },
          { type: 'line', x: ts, y: ts.map((t) => y * (1 - Math.exp(-t))), color: 'model', width: 2.4, label: 'поток F = 10(1 − e^{−t})', hover: false },
          { type: 'line', x: tm, y: clampArr(Fs, -40, 50), color: 'tree', width: 1.2, hover: false },
          { type: 'points', x: tm, y: clampArr(Fs, -40, 50), color: 'tree', r: M > 80 ? 2.5 : 4, label: 'бустинг, шаг ν' },
        ], { x: [0, T], y: [-6, 22] });
        p2.opts.y.type = 'log';
        p2.opts.y.ticks = [1e-6, 1e-4, 1e-2, 1, 100];
        p2.opts.y.format = powFmt;
        p2.opts.y.label = '|остаток y − F| (лог.)';
        p2.render([
          { type: 'line', x: ts, y: ts.map((t) => y * Math.exp(-t)), color: 'model', width: 2.4, label: 'поток 10e^{−t}', hover: false },
          { type: 'points', x: tm, y: Fs.map((F) => U.clamp(Math.abs(y - F), 1e-6, 1e3)), color: 'tree', r: M > 80 ? 2.5 : 3.5, label: '10·|1 − ν|^{M}' },
        ], { x: [0, T], y: [1e-6, 1e3] });
        lab('множитель остатка 1 − ν', 'деревьев до t = 3', 'остаток при t = 3 (поток 0.498)');
        const M3 = Math.round(3 / s.nu);
        st.set('a', f3(1 - s.nu));
        st.set('b', String(M3));
        st.set('c', sci(y * Math.pow(1 - s.nu, M3)));
        note.innerHTML = 'Для квадратичных потерь −∂L/∂F = y − F, и поток F′ = y − F — подход к равновесию из шага 3: остаток тает как e<sup>−t</sup>. Бустинг одного числа — шаг Эйлера: остаток умножается на 1 − ν. ' + (s.nu < 0.3 ? 'При малом ν шаги ложатся на кривую потока: бустинг повторяет непрерывное решение, а «время» t = ν·M — главный параметр (урок 15.9, шаг 29).' : s.nu <= 1 ? 'При ν ≤ 1 шаги не отстают от потока — даже обгоняют его ((1 − ν)<sup>1/ν</sup> &lt; e<sup>−1</sup>); при ν = 1 одно дерево сразу подгоняет остаток целиком — на шумных данных это переобучение.' : s.nu < 2 ? 'При 1 &lt; ν &lt; 2 прогноз перепрыгивает цель и подходит к ней зигзагом.' : '<b>ν ≥ 2 — неустойчивость:</b> зигзаги растут, бустинг расходится.') + ' Граница ν &lt; 2 — это hλ &lt; 2 из шага 15 с λ = 1 (кривизна квадратичных потерь ½(y − F)²).';
      } else {
        const p = s.p;
        const grad = (F) => p - sig(F);
        const stepF = (F) => (s.newton ? F + (s.nu * grad(F)) / Math.max(1e-12, sig(F) * (1 - sig(F))) : F + s.nu * grad(F));
        const Fs = [0];
        for (let m = 0; m < M; m++) Fs.push(stepF(Fs[m]));
        const flowF = s.newton ? (t, F) => grad(F) / (sig(F) * (1 - sig(F))) : (t, F) => grad(F);
        const fl = solveODE(flowF, 0, 0, T, 1200, 'rk4');
        const tm = Fs.map((_, m) => m * s.nu);
        const Fstar = p < 1 ? Math.log(p / (1 - p)) : NaN;
        const hh = p < 1 ? p * (1 - p) : 0;
        p1.render([
          p < 1 ? { type: 'hline', y: Fstar, color: 'ink2', dash: '4 4', text: 'равновесие ln(p̄/(1 − p̄)) = ' + f3(Fstar) } : null,
          { type: 'line', x: fl.ts, y: fl.ys, color: 'model', width: 2.4, label: s.newton ? 'поток Ньютона F′ = −g/h' : 'поток F′ = p̄ − σ(F)', hover: false },
          { type: 'line', x: tm, y: clampArr(Fs, -30, 30), color: 'tree', width: 1.2, hover: false },
          { type: 'points', x: tm, y: clampArr(Fs, -30, 30), color: 'tree', r: M > 80 ? 2.5 : 4, label: 'бустинг, шаг ν' },
        ], { x: [0, T], y: yDom(fl.ys.concat(clampArr(Fs, -8, 14).filter(Number.isFinite)).concat([0]), 0.08) });
        p2.opts.y.type = undefined;
        p2.opts.y.ticks = undefined;
        p2.opts.y.format = undefined;
        p2.opts.y.label = 'вероятность σ(F)';
        p2.render([
          { type: 'hline', y: p, color: 'ink2', dash: '4 4', text: 'p̄ = ' + f2(p) },
          { type: 'line', x: fl.ts, y: fl.ys.map(sig), color: 'model', width: 2.4, label: 'поток', hover: false },
          { type: 'points', x: tm, y: Fs.map((F) => sig(U.clamp(F, -40, 40))), color: 'tree', r: M > 80 ? 2.5 : 3.5, label: 'бустинг' },
        ], { x: [0, T], y: [0.4, 1.02] });
        lab('кривизна в равновесии h* = p̄(1 − p̄)', s.newton ? 'граница ν (Ньютон)' : 'граница ν < 2/h*', 'F в конце / поток');
        st.set('a', p < 1 ? f4(hh) : '0 (равновесия нет)');
        st.set('b', s.newton ? '2' : p < 1 ? f3(2 / hh) : '∞');
        st.set('c', f3(Fs[Fs.length - 1]) + ' / ' + f3(fl.ys[fl.ys.length - 1]));
        note.innerHTML = (p < 1
          ? 'Для log-loss −∂L/∂F = p̄ − σ(F): поток подходит к логиту доли единиц F* = ln(p̄/(1 − p̄)). Около равновесия это y′ = −h*·(F − F*) с кривизной h* = p̄(1 − p̄) ≤ ¼, поэтому градиентные шаги устойчивы при <b>ν &lt; 2/h*</b> — для p̄ = 0.7 это ν &lt; 9.52 (при ν = 9 спуск ещё сходится, при 9.6 уже качается). Кривизна log-loss мала, поэтому крупный ν здесь не опасен, а при ν ≤ 1 шаги, наоборот, мелкие и сходимость медленная; при p̄ → 1 кривизна стремится к нулю. '
          : '<b>p̄ = 1: все объекты листа — единицы.</b> Поток F′ = 1 − σ(F) &gt; 0 никогда не останавливается: решение F + e<sup>F</sup> = t + 1 растёт как ln t (при t = 10 — 2.18, при t = 100 — 4.57), вероятность ползёт к 1, а потери — к нулю, но минимума нет. С шагом Ньютона рост ещё быстрее — линейный: F = ln(2eᵗ − 1). Поэтому бустинг с log-loss на разделимых данных обязательно нужно останавливать (ранняя остановка, λ, min_child_weight). ')
          + (s.newton ? 'Шаг Ньютона делит градиент на h = σ(1 − σ): поток Ньютона F′ = −g/h подходит к равновесию с единичной скоростью при любом p̄, и граница снова ν &lt; 2. Это и есть лист XGBoost −G/H.' : 'Включите шаг Ньютона — так считает листья XGBoost.');
      }
    }
    w.pythonAction(() => {
      if (s.loss === 'sq') return 'import math\n\ny, nu = 10.0, ' + py(s.nu) + '\nF = 0.0\nfor m in range(1, round(6 / nu) + 1):\n    F += nu * (y - F)                 # шаг Эйлера для F′ = y − F\n    if m % max(1, round(1 / nu)) == 0:\n        t = m * nu\n        print(f"t = {t:4.1f}: бустинг F = {F:8.4f}, поток {y * (1 - math.exp(-t)):8.4f}")\n';
      return 'import math\n\nsig = lambda z: 1 / (1 + math.exp(-z))\np, nu, newton = ' + py(s.p) + ', ' + py(s.nu) + ', ' + (s.newton ? 'True' : 'False') + '\nF = 0.0\nfor m in range(1, ' + Math.min(400, Math.max(1, Math.round(12 / s.nu))) + ' + 1):\n    g = sig(F) - p                      # градиент log-loss по F (среднее по листу)\n    h = sig(F) * (1 - sig(F))           # гессиан\n    F -= nu * (g / h if newton else g)\nprint("F в конце:", F, " вероятность:", sig(F))\nif p < 1:\n    print("равновесие ln(p/(1 − p)) =", math.log(p / (1 - p)), " граница градиентного ν:", 2 / (p * (1 - p)))\n';
    });
    build();
    draw();
  });

  /* ==============================================================================
   * Шаг 28. Неявный шаг, проксимальный метод и λ в XGBoost
   * ============================================================================== */
  GBC.widget('implicit-gd', (el) => {
    const s = { z: 1.5, lam: 1 };
    const G = -4;
    const Hh = 2;
    const w = ui.shell(el, { title: 'Явный и неявный шаг: (1 − ηa) против 1/(1 + ηa)', sub: 'Явный спуск берёт градиент в старой точке, неявный — в новой: θₖ₊₁ = θₖ − η∇L(θₖ₊₁). Для параболы L = aθ²/2 это множители 1 − ηa и 1/(1 + ηa). Снизу — лист XGBoost с G = −4, H = 2 (8 объектов класса 1 при p = 0.5) и его значение −G/(H + λ).' });
    ui.slider(w.controls, { label: 'Шаг × кривизна: ηa', min: 0.1, max: 5, step: 0.05, value: s.z, format: f2, onInput: (v) => ((s.z = v), draw()) });
    ui.slider(w.controls, { label: 'λ в листе XGBoost', min: 0, max: 20, step: 0.5, value: s.lam, format: (v) => U.fmt(v, 1), onInput: (v) => ((s.lam = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'ηa', domain: [0, 5] }, y: { label: 'множитель за шаг', domain: [-4.2, 1.3] } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'шаг k', domain: [0, 12] }, y: { label: 'θₖ', domain: [-3, 3] } });
    const p3 = new GBC.Plot(w.main, { height: 200, x: { label: 'λ', domain: [0, 20] }, y: { label: 'значение листа w', domain: [0, 2.5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'явный 1 − ηa' }, { key: 'i', label: 'неявный 1/(1 + ηa)' }, { key: 'w', label: 'лист −G/(H + λ)' }, { key: 'g', label: 'градиентный шаг −G/λ' }]);
    function draw() {
      const zs = U.linspace(0, 5, 200);
      p1.render([
        { type: 'rect', x0: 0, x1: 5, y0: -1, y1: 1, fill: 'good', opacity: 0.08 },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: zs, y: zs.map((z) => 1 - z), color: 'tree', width: 2.4, label: 'явный: 1 − ηa' },
        { type: 'line', x: zs, y: zs.map((z) => 1 / (1 + z)), color: 'violet', width: 2.4, label: 'неявный: 1/(1 + ηa)' },
        { type: 'vline', x: s.z, color: 'ink2', dash: '3 3', width: 1.2 },
      ]);
      const ks = U.range(13);
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: ks, y: clampArr(ks.map((k) => Math.pow(1 - s.z, k)), -50, 50), color: 'tree', width: 1.4, hover: false },
        { type: 'points', x: ks, y: clampArr(ks.map((k) => Math.pow(1 - s.z, k)), -3.2, 3.2), color: 'tree', r: 4, label: 'явный' },
        { type: 'line', x: ks, y: ks.map((k) => Math.pow(1 / (1 + s.z), k)), color: 'violet', width: 1.4, hover: false },
        { type: 'points', x: ks, y: ks.map((k) => Math.pow(1 / (1 + s.z), k)), color: 'violet', r: 4, shape: 'square', label: 'неявный' },
      ]);
      const ls = U.linspace(0, 20, 300);
      p3.render([
        { type: 'hline', y: -G / Hh, color: 'ink2', dash: '4 4', text: 'Ньютон −G/H = 2' },
        { type: 'line', x: ls, y: ls.map((l) => -G / (Hh + l)), color: 'model', width: 2.6, label: 'лист −G/(H + λ)', hover: false },
        { type: 'line', x: ls.filter((l) => l > 1.8), y: ls.filter((l) => l > 1.8).map((l) => -G / l), color: 'tree', width: 1.8, dash: '5 4', label: 'градиентный шаг −G/λ (η = 1/λ)', hover: false },
        { type: 'points', x: [s.lam], y: [-G / (Hh + s.lam)], color: 'model', r: 6 },
      ]);
      st.set('e', f3(1 - s.z));
      st.set('i', f3(1 / (1 + s.z)));
      st.set('w', f4(-G / (Hh + s.lam)));
      st.set('g', s.lam > 0 ? f4(-G / s.lam) : '∞');
      note.innerHTML = 'Неявный шаг равносилен задаче θₖ₊₁ = argmin [L(θ) + ‖θ − θₖ‖²/(2η)]: «уменьши потери, но не уходи далеко». Это <b>проксимальный шаг</b>; он устойчив при любом η, как неявный Эйлер из шага 16. В XGBoost значение листа — минимум квадратичной модели потерь Gw + ½Hw² плюс штраф ½λw². Штраф ½λw² — это ровно проксимальная добавка с η = 1/λ: <b>λ превращает лист в неявный шаг</b>. При λ = 0 — чистый шаг Ньютона −G/H = 2; при большом λ лист ≈ −G/λ — обычный градиентный шаг с темпом 1/λ (при λ = 10 это 0.333 против 0.4). λ ограничивает шаг там, где H мала: например, в листе из уверенно предсказанных объектов log-loss, где без него шаг Ньютона −G/H огромен.';
    }
    w.pythonAction(() => 'z = ' + py(s.z) + '                       # η·a\nth_exp = th_imp = 1.0\nfor k in range(1, 13):\n    th_exp *= 1 - z              # явный: θ − η·a·θ_old\n    th_imp /= 1 + z              # неявный: θ_new = θ − η·a·θ_new\nprint("после 12 шагов: явный", th_exp, " неявный", th_imp)\n\n# лист XGBoost: argmin_w  G·w + ½H·w² + ½λ·w²\nG, H = -4.0, 2.0\nfor lam in (0, 1, 5, 10, 20):\n    print(f"λ = {lam:2}: лист {-G / (H + lam):.4f}" + (f", градиентный шаг −G/λ = {-G / lam:.4f}" if lam else " (Ньютон)"))\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр
   * ============================================================================== */
  const OQ = [
    { c: 'sol', q: 'Решение y′ = 3', opts: ['y = 3', 'y = 3t + C', 'y = e³ᵗ', 'y = t³'], a: 1, why: 'Постоянная скорость — прямая с наклоном 3; правая часть не зависит от y, это просто интеграл.' },
    { c: 'sol', q: 'Решение y′ = 2y', opts: ['y = C·e²ᵗ', 'y = 2t + C', 'y = t² + C', 'y = C·e^(t/2)'], a: 0, why: 'Скорость пропорциональна значению — экспонента: (Ce²ᵗ)′ = 2Ce²ᵗ.' },
    { c: 'sol', q: 'y′ = −0.5y, y(0) = 4. Чему равно y(t)?', opts: ['4e^(−0.5t)', '4 − 0.5t', '−0.5e^(4t)', '4e^(0.5t)'], a: 0, why: 'Затухание; C = y(0) = 4.' },
    { c: 'sol', q: 'y′ = 1 − y, y(0) = 0', opts: ['y = 1 − e⁻ᵗ', 'y = e⁻ᵗ', 'y = t', 'y = 1 + e⁻ᵗ'], a: 0, why: 'Подход к равновесию 1: y = 1 + Ce⁻ᵗ, из y(0) = 0 получаем C = −1.' },
    { c: 'sol', q: 'Решение y′ = y(1 − y) с 0 < y(0) < 1', opts: ['экспонента', 'сигмоида', 'синус', 'прямая'], a: 1, why: 'Логистическое уравнение; σ′ = σ(1 − σ).' },
    { c: 'sol', q: 'y′ = y², y(0) = 1. Где решение уходит в бесконечность?', opts: ['нигде', 't = 1', 't = e', 't = π/2'], a: 1, why: 'y = 1/(1 − t): взрыв при t = 1/y(0) = 1.' },
    { c: 'sol', q: 'Общее решение y′ + y = t', opts: ['t − 1 + Ce⁻ᵗ', 't + Ceᵗ', 'Ce⁻ᵗ', 't²/2 + C'], a: 0, why: 'Интегрирующий множитель eᵗ: (eᵗy)′ = teᵗ, eᵗy = (t − 1)eᵗ + C.' },
    { c: 'sol', q: 'Сколько начальных условий нужно для y″ = −y?', opts: ['одно', 'два: y(0) и y′(0)', 'три', 'ни одного'], a: 1, why: 'Уравнение второго порядка: две константы A и B в A cos t + B sin t.' },
    { c: 'qual', q: 'Равновесия y′ = y² − 4 и их устойчивость', opts: ['−2 устойчиво, 2 неустойчиво', '−2 неустойчиво, 2 устойчиво', 'оба устойчивы', 'равновесий нет'], a: 0, why: 'f′(y) = 2y: f′(−2) = −4 < 0 — устойчиво, f′(2) = 4 > 0 — неустойчиво.' },
    { c: 'qual', q: 'y′ = −2(y − 5). Куда стремится y и как быстро?', opts: ['к 5, постоянная времени 0.5', 'к −2', 'к 5, постоянная времени 2', 'в бесконечность'], a: 0, why: 'Приток минус отток: равновесие 5, τ = 1/b = 1/2.' },
    { c: 'qual', q: 'Могут ли пересечься две разные кривые решений y′ = f(t, y) с гладкой f?', opts: ['да, часто', 'нет: через каждую точку проходит одно решение', 'только в нуле', 'только при t = 0'], a: 1, why: 'Теорема единственности: в точке пересечения было бы два решения одной задачи Коши.' },
    { c: 'qual', q: 'Пружина x″ + c·x′ + 4x = 0. При каком c затухание критическое?', opts: ['c = 2', 'c = 4', 'c = 16', 'c = 1'], a: 1, why: 'Критическое: c = 2ω, ω = √4 = 2.' },
    { c: 'qual', q: 'Матрица со следом −1 и определителем 2 даёт…', opts: ['седло', 'устойчивый фокус', 'неустойчивый узел', 'центр'], a: 1, why: 'Δ > 0, τ < 0, τ² − 4Δ = 1 − 8 < 0 — комплексные числа с отрицательной вещественной частью.' },
    { c: 'qual', q: 'SIR с R₀ = 4. Порог коллективного иммунитета —', opts: ['25 %', '50 %', '75 %', '100 %'], a: 2, why: '1 − 1/R₀ = 1 − 1/4 = 75 %.' },
    { c: 'num', q: 'Устойчив ли Эйлер для y′ = −10y с шагом h = 0.3?', opts: ['да', 'нет: hλ = 3 > 2'], a: 1, why: 'Множитель 1 − 3 = −2: каждый шаг удваивает ошибку по модулю.' },
    { c: 'num', q: 'Эйлер для y′ = y, y(0) = 1, h = 0.5, два шага. y(1) ≈', opts: ['2', '2.25', '2.5', '2.718'], a: 1, why: '1 · 1.5 · 1.5 = 2.25 (точно e ≈ 2.718).' },
    { c: 'num', q: 'Шаг уменьшили вдвое. Во сколько раз упадёт ошибка РК4?', opts: ['в 2', 'в 4', 'в 16', 'не изменится'], a: 2, why: 'Четвёртый порядок: 2⁴ = 16. У Эйлера — в 2, у Хойна — в 4.' },
    { c: 'num', q: 'Неявный Эйлер для y′ = −λy устойчив…', opts: ['при hλ < 2', 'при любом h > 0', 'никогда', 'при hλ < 1'], a: 1, why: 'Множитель 1/(1 + hλ) < 1 при любом h > 0.' },
    { c: 'num', q: 'Почему Эйлер раскручивает траекторию пружины?', opts: ['из-за округлений', 'за шаг энергия умножается на 1 + h²', 'из-за трения', 'это неверно'], a: 1, why: '|1 + ih|² = 1 + h²: мнимая ось вне круга устойчивости Эйлера.' },
    { c: 'ml', q: 'Градиентный спуск по L = 5θ² устойчив при…', opts: ['η < 0.4', 'η < 2', 'η < 0.2', 'любом η'], a: 2, why: 'L = ½·10·θ²: кривизна a = 10, граница η < 2/a = 0.2.' },
    { c: 'ml', q: 'Бустинг одного числа с квадратичными потерями сходится при…', opts: ['0 < ν ≤ 1', '0 < ν < 2', 'любом ν', 'ν = 1'], a: 1, why: 'Шаг Эйлера для F′ = y − F: множитель 1 − ν, |1 − ν| < 1.' },
    { c: 'ml', q: 'Моментум — это дискретизация уравнения…', opts: ['θ′ = −∇L', 'θ″ + γθ′ + ∇L = 0', 'θ″ = ∇L', 'θ′ = θ'], a: 1, why: 'Тяжёлый шарик с трением: β = 1 − γh, η = h².' },
    { c: 'ml', q: 'Что делает λ в значении листа XGBoost −G/(H + λ)?', opts: ['ничего', 'превращает шаг Ньютона в неявный (проксимальный) шаг с η = 1/λ', 'увеличивает шаг', 'меняет знак'], a: 1, why: '½λw² — проксимальная добавка ‖Δ‖²/(2η) с η = 1/λ.' },
    { c: 'ml', q: 'Log-loss, все объекты листа — единицы. Что делает «поток» F′ = 1 − σ(F)?', opts: ['останавливается на F = 0', 'растёт без остановки, примерно как ln t', 'колеблется', 'сразу уходит в бесконечность'], a: 1, why: 'Равновесия нет: F + e^F = t + 1, F ≈ ln t. Поэтому нужна ранняя остановка и регуляризация.' },
  ];
  const CATS = { all: 'все', sol: 'решения', qual: 'качественный анализ', num: 'численные методы', ml: 'машинное обучение' };
  GBC.widget('ode-game', (el) => {
    const s = { cat: 'all', i: 0, right: 0, done: 0, streak: 0, picked: null };
    const w = ui.shell(el, { title: 'Тренажёр: дифференциальные уравнения', sub: 'Задачи четырёх видов: найти решение, понять поведение без формулы, оценить численный метод и узнать уравнение внутри алгоритма обучения. Подсказка: продифференцируйте кандидата и подставьте.' });
    ui.select(w.controls, { label: 'Раздел', value: s.cat, options: Object.entries(CATS).map(([k, v]) => ({ value: k, label: v })), onChange: (v) => ((s.cat = v), (s.i = 0), (s.picked = null), draw()) });
    const next = ui.button(w.controls, { label: 'Следующая', icon: 'step', onClick: () => ((s.i += 1), (s.picked = null), draw()) });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.1rem;padding:6px 0 12px' });
    w.main.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));gap:8px' });
    w.main.appendChild(optsBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'задача' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function pool() {
      return OQ.filter((q) => s.cat === 'all' || q.c === s.cat);
    }
    function draw() {
      const P = pool();
      const Q = P[s.i % P.length];
      qEl.textContent = Q.q;
      optsBox.textContent = '';
      Q.opts.forEach((o, k) => {
        const b = ui.button(optsBox, { label: o, kind: s.picked === null ? '' : k === Q.a ? 'primary' : '', onClick: () => {
          if (s.picked !== null) return;
          s.picked = k;
          s.done++;
          if (k === Q.a) (s.right++, s.streak++);
          else s.streak = 0;
          draw();
        } });
        b.style.whiteSpace = 'normal';
        b.style.justifyContent = 'flex-start';
        b.style.textAlign = 'left';
        if (s.picked !== null) {
          b.disabled = true;
          if (k === s.picked && k !== Q.a) b.appendChild(badge('ваш ответ', 'bad'));
          if (k === Q.a) b.appendChild(badge('верно', 'good'));
        }
      });
      st.set('r', (s.i % P.length) + 1 + ' из ' + P.length + ' (' + CATS[Q.c] + ')');
      st.set('ok', s.right + ' из ' + s.done);
      st.set('s', String(s.streak));
      note.innerHTML = s.picked === null ? 'Выберите ответ.' : (s.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет.</b> ') + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), s.picked === null ? 'Пропустить' : 'Следующая');
    }
    draw();
  });
})();
