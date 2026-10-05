/* Урок 15.1: функция и её график. Часть 1 — от понятия функции до чтения графика.
 * Виджеты: машинка-функция, чёрный ящик, «функция или нет», четыре способа задания, координатная
 * плоскость, точки → линия, вертикальный тест, область определения и значений, чтение графика,
 * зоопарк и преобразования, функция от функции, модель как функция, тренажёр.
 * Общие помощники выставлены в GBC.lesson151 — ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  /* ==============================================================================
   * Общие помощники урока
   * ============================================================================== */
  const sigmoid = (z) => U.sigmoid(z);
  const nanIf = (cond, v) => (cond ? NaN : v);
  const I = Infinity;

  /** Табуляция функции для слоя 'line': NaN вне области определения, за пределами cap и на скачках. */
  function curve(fn, x0, x1, n = 801, { cap = 1e6, jump = null } = {}) {
    const x = U.linspace(x0, x1, n);
    const y = x.map((v) => {
      const r = fn(v);
      return Number.isFinite(r) && Math.abs(r) <= cap ? r : NaN;
    });
    if (jump !== null) for (let i = 1; i < y.length; i++) if (Math.abs(y[i] - y[i - 1]) > jump) y[i] = NaN;
    return { x, y };
  }

  /** Формула KaTeX в элементе; если KaTeX ещё грузится — перерисуем по событию mathready. */
  function texInto(el, src, display = false) {
    el._tex = src;
    el.replaceChildren(GBC.math.tex(src, display));
    if (!window.katex && !el._texSub) {
      el._texSub = true;
      GBC.bus.on('mathready', () => el.replaceChildren(GBC.math.tex(el._tex, display)));
    }
  }

  function box(text, kind) {
    const base = 'display:inline-flex;align-items:center;justify-content:center;min-width:72px;padding:10px 14px;border-radius:10px;font-weight:650;font-variant-numeric:tabular-nums;transition:transform .25s ease, box-shadow .25s ease, background .25s ease;';
    const look = kind === 'rule'
      ? 'background:var(--accent-soft);color:var(--ink);border:2px solid var(--accent);min-width:150px;'
      : 'background:var(--surface-2);color:var(--ink);border:1px solid var(--border-strong);';
    return H('div', { style: base + look }, text);
  }
  const arrow = () => H('span', { style: 'font-size:22px;color:var(--muted);padding:0 8px', 'aria-hidden': 'true' }, '→');
  function flash(el, bad) {
    el.style.transform = 'scale(1.08)';
    el.style.boxShadow = '0 0 0 3px ' + (bad ? 'var(--critical)' : 'var(--focus)');
    setTimeout(() => ((el.style.transform = ''), (el.style.boxShadow = '')), 320);
  }
  const pt = (x, y) => '(' + U.fmt(x, 2) + ', ' + U.fmt(y, 2) + ')';
  const sgnTerm = (v, txt) => (v === 0 ? '' : (v > 0 ? ' + ' : ' − ') + U.fmt(Math.abs(v), 2) + (txt || ''));

  /** Карточка с заголовком (для «четырёх способов» и похожих раскладок). */
  function card(title) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums' });
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' },
      H('div', { style: 'font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px' }, title), body);
    return { el, body };
  }
  const cardGrid = () => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin:4px 0 10px' });

  /* ==============================================================================
   * 1. Машинка-функция: кладём число — получаем число (или «не определено»)
   * ============================================================================== */
  const RULES = {
    taxi: { label: 'Такси: 100 ₽ + 25 ₽ за км', f: (x) => 100 + 25 * x, xl: 'км', yl: '₽', dom: [0, 20], step: 1, x0: 4, text: '100 + 25·x', py: '100 + 25 * x' },
    double: { label: 'Удвоить: 2·x', f: (x) => 2 * x, dom: [-5, 5], step: 0.5, x0: 3, text: '2·x', py: '2 * x' },
    plus3: { label: 'Прибавить 3: x + 3', f: (x) => x + 3, dom: [-5, 5], step: 0.5, x0: 2, text: 'x + 3', py: 'x + 3' },
    square: { label: 'Возвести в квадрат: x²', f: (x) => x * x, dom: [-4, 4], step: 0.5, x0: 3, text: 'x²', py: 'x ** 2' },
    sqrt: { label: 'Корень: √x', f: (x) => nanIf(x < 0, Math.sqrt(x)), dom: [-4, 9], step: 0.5, x0: 4, text: '√x', py: 'math.sqrt(x)', why: 'из отрицательного числа квадратный корень не извлекается' },
    recip: { label: 'Обратное число: 1/x', f: (x) => nanIf(x === 0, 1 / x), dom: [-4, 4], step: 0.5, x0: 2, text: '1/x', py: '1 / x', why: 'на ноль делить нельзя', ylim: [-4.5, 4.5] },
  };

  GBC.widget('function-machine', (el) => {
    const s = { rule: 'taxi', x: 4, pts: [], bad: [] };
    const w = ui.shell(el, { title: 'Функция — это машинка', sub: 'Выберите правило и число на входе, нажмите «Бросить в машинку». Каждая пара (вход, выход) записывается в таблицу и становится точкой на графике. Попробуйте правила «√x» и «1/x» с отрицательными числами и нулём.' });
    ui.select(w.controls, { label: 'Правило', value: s.rule, options: Object.entries(RULES).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.rule = v), (s.x = RULES[v].x0), (s.pts = []), (s.bad = []), xs.el.remove(), mkSlider(), draw()) });
    let xs;
    const sliderBox = H('div');
    w.controls.appendChild(sliderBox);
    function mkSlider() {
      const R = RULES[s.rule];
      xs = ui.slider(sliderBox, { label: 'Вход x', min: R.dom[0], max: R.dom[1], step: R.step, value: s.x, onInput: (v) => ((s.x = v), drawFlow()) });
    }
    mkSlider();
    ui.button(w.controls, { label: 'Бросить в машинку', kind: 'primary', onClick: () => feed(s.x) });
    ui.button(w.controls, { label: 'Ещё 5 случайных', onClick: () => {
      const R = RULES[s.rule];
      const rng = new GBC.RNG(17 + s.pts.length + s.bad.length);
      const n = Math.round((R.dom[1] - R.dom[0]) / R.step);
      for (let k = 0; k < 5; k++) feed(R.dom[0] + R.step * rng.randint(n + 1), true);
      draw();
    } });
    const showCurve = ui.toggle(w.controls, { label: 'Показать весь график', checked: false, onChange: () => draw() });
    ui.button(w.controls, { label: 'Очистить', onClick: () => ((s.pts = []), (s.bad = []), draw()) });
    const flow = H('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px;padding:14px 4px 18px' });
    w.main.appendChild(flow);
    const bIn = box('');
    const bRule = box('', 'rule');
    const bOut = box('');
    flow.append(bIn, arrow(), bRule, arrow(), bOut);
    const box2 = H('div', { class: 'plots-2' });
    w.main.appendChild(box2);
    const tableBox = H('div');
    box2.appendChild(tableBox);
    const plot = new GBC.Plot(box2, { height: 260, x: { label: 'вход x' }, y: { label: 'выход f(x)' } });
    const note = w.note('', true);
    function drawFlow() {
      const R = RULES[s.rule];
      const v = R.f(s.x);
      bIn.textContent = 'x = ' + U.fmt(s.x, 2) + (R.xl === 'км' ? ' км' : '');
      bRule.textContent = 'f(x) = ' + R.text;
      bOut.textContent = Number.isFinite(v) ? 'f(x) = ' + U.fmt(v, 3) + (R.yl === '₽' ? ' ₽' : '') : 'не определено';
      bOut.style.background = Number.isFinite(v) ? 'var(--surface-2)' : 'color-mix(in srgb, var(--critical) 14%, var(--surface))';
    }
    function feed(x, silent) {
      const R = RULES[s.rule];
      const v = R.f(x);
      s.last = x;
      if (!Number.isFinite(v)) {
        if (!s.bad.includes(x)) s.bad.push(x);
        s.lastBad = true;
      } else {
        if (!s.pts.some((p) => p[0] === x)) s.pts.push([x, v]);
        s.pts.sort((a, b) => a[0] - b[0]);
        s.lastBad = false;
      }
      if (!silent) {
        [bIn, bRule, bOut].forEach((b, i) => setTimeout(() => flash(b, s.lastBad && i === 2), i * 200));
        draw();
      }
    }
    function draw() {
      const R = RULES[s.rule];
      drawFlow();
      tableBox.textContent = '';
      const rows = s.pts.slice(-8).map((p) => [U.fmt(p[0], 2), U.fmt(p[1], 3)]);
      if (!rows.length) tableBox.appendChild(H('p', { class: 'widget-note' }, 'Таблица пуста — бросьте в машинку первое число.'));
      else ui.table(tableBox, { columns: ['вход x', 'выход f(x)'], rows, highlight: (i) => Number(rows[i][0].replace('−', '-')) === s.last });
      const c = curve(R.f, R.dom[0], R.dom[1], 600, { jump: R.ylim ? 3 : null });
      const yl = R.ylim || U.extent(c.y.filter(Number.isFinite)).map((v, i) => v + (i ? 1 : -1) * 0.08 * (Math.abs(v) + 1));
      plot.render([
        showCurve.checked ? { type: 'line', x: c.x, y: c.y, color: 'model', width: 2, label: 'все пары (x, f(x))', hover: false } : null,
        { type: 'points', x: s.pts.map((p) => p[0]), y: s.pts.map((p) => p[1]), color: 'tree', r: 5, label: 'записанные пары', tooltip: (i) => [['x', U.fmt(s.pts[i][0], 2)], ['f(x)', U.fmt(s.pts[i][1], 3)]] },
      ], { x: R.dom, y: yl });
      const n = s.pts.length;
      let msg;
      if (s.lastBad && R.why) msg = '<b>x = ' + U.fmt(s.last, 2) + ' машинка не принимает:</b> ' + R.why + '. Такие входы не входят в <b>область определения</b> — для них у функции нет выхода, и точки на графике тоже нет.';
      else if (!n) msg = 'Функция — это правило: каждому входу x — ровно один выход f(x). Машинка не «угадывает» и не «колеблется»: одно и то же число на входе всегда даёт одно и то же число на выходе.';
      else if (n < 6) msg = 'Записано пар: ' + n + '. Каждая пара — точка (x, f(x)) на плоскости: x по горизонтали, f(x) по вертикали.';
      else msg = 'Пар уже ' + n + ' — точки выстраиваются в линию. ' + (showCurve.checked ? 'Сплошная линия — все возможные пары сразу: это и есть <b>график функции</b>.' : 'Включите «Показать весь график»: линия проходит через все возможные пары.');
      if (s.bad.length && !s.lastBad) msg += ' Отвергнутые входы: ' + s.bad.map((v) => U.fmt(v, 2)).join(', ') + '.';
      note.innerHTML = msg;
    }
    feed(s.x, true);
    w.pythonAction(() => {
      const R = RULES[s.rule];
      const xsList = [...s.pts.map((p) => p[0]), ...s.bad].sort((a, b) => a - b);
      return 'import math\n\ndef f(x):\n    return ' + R.py + '\n\nfor x in [' + (xsList.length ? xsList.map(U.pyNum).join(', ') : U.pyNum(s.x)) + ']:\n    try:\n        print(f"f({x}) = {f(x)}")\n    except (ValueError, ZeroDivisionError) as e:   # вход вне области определения\n        print(f"f({x}) не определено: {e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 2. Чёрный ящик: угадайте правило по опытам
   * ============================================================================== */
  const BB = {
    easy: [
      { t: 'x + 3', f: (x) => x + 3, py: 'x + 3' }, { t: '2·x', f: (x) => 2 * x, py: '2 * x' }, { t: 'x − 4', f: (x) => x - 4, py: 'x - 4' },
      { t: '10 − x', f: (x) => 10 - x, py: '10 - x' }, { t: '3·x', f: (x) => 3 * x, py: '3 * x' }, { t: 'x + 1', f: (x) => x + 1, py: 'x + 1' },
    ],
    mid: [
      { t: '2x + 1', f: (x) => 2 * x + 1, py: '2 * x + 1' }, { t: '3x − 2', f: (x) => 3 * x - 2, py: '3 * x - 2' }, { t: 'x²', f: (x) => x * x, py: 'x ** 2' },
      { t: '5 − 2x', f: (x) => 5 - 2 * x, py: '5 - 2 * x' }, { t: 'x/2 + 1', f: (x) => x / 2 + 1, py: 'x / 2 + 1' }, { t: 'x + 3', f: (x) => x + 3, py: 'x + 3' },
    ],
    hard: [
      { t: 'x² + 1', f: (x) => x * x + 1, py: 'x ** 2 + 1' }, { t: '(x − 1)²', f: (x) => (x - 1) ** 2, py: '(x - 1) ** 2' }, { t: '|x − 2|', f: (x) => Math.abs(x - 2), py: 'abs(x - 2)' },
      { t: 'x³', f: (x) => x ** 3, py: 'x ** 3' }, { t: 'x² − x', f: (x) => x * x - x, py: 'x ** 2 - x' }, { t: '2·|x|', f: (x) => 2 * Math.abs(x), py: '2 * abs(x)' },
      { t: 'x + 1', f: (x) => x + 1, py: 'x + 1' }, { t: '2x + 2', f: (x) => 2 * x + 2, py: '2 * x + 2' },
    ],
  };
  GBC.widget('black-box', (el) => {
    const s = { level: 'easy', seed: 5, x: 1, q: null, round: 0, right: 0 };
    const w = ui.shell(el, { title: 'Чёрный ящик: угадайте правило', sub: 'Внутри спрятана функция. Бросайте числа и смотрите, что выходит, — а потом выберите правило. Старайтесь обойтись наименьшим числом опытов.' });
    ui.segmented(w.controls, { label: 'Уровень', value: s.level, options: [{ value: 'easy', label: 'простой' }, { value: 'mid', label: 'средний' }, { value: 'hard', label: 'трудный' }], onChange: (v) => ((s.level = v), newRound()) });
    ui.slider(w.controls, { label: 'Вход x', min: -5, max: 5, step: 1, value: s.x, onInput: (v) => (s.x = v) });
    ui.button(w.controls, { label: 'Бросить в ящик', kind: 'primary', onClick: () => query(s.x) });
    const strike = ui.toggle(w.controls, { label: 'Вычёркивать неподходящие варианты', checked: true, onChange: () => draw() });
    const optsBox = H('div', { style: 'display:grid;gap:6px' });
    w.controls.appendChild(H('span', { class: 'ctl-label' }, 'Ваш ответ'));
    w.controls.appendChild(optsBox);
    ui.button(w.controls, { label: 'Новый ящик', icon: 'step', onClick: () => newRound() });
    const flow = H('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px;padding:10px 4px 14px' });
    const bIn = box('x = ?');
    const bBox = box('? ? ?', 'rule');
    const bOut = box('f(x) = ?');
    flow.append(bIn, arrow(), bBox, arrow(), bOut);
    w.main.appendChild(flow);
    const two = H('div', { class: 'plots-2' });
    w.main.appendChild(two);
    const tableBox = H('div');
    two.appendChild(tableBox);
    const plot = new GBC.Plot(two, { height: 250, x: { label: 'x', domain: [-5.5, 5.5] }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'ящик' }, { key: 'n', label: 'опытов' }, { key: 'ok', label: 'угадано' }]);
    const consistent = (o) => s.q.data.every(([x, y]) => Math.abs(o.f(x) - y) < 1e-9);
    function newRound() {
      const rng = new GBC.RNG(s.seed++);
      const pool = BB[s.level];
      const hid = pool[rng.randint(pool.length)];
      const opts = [hid];
      while (opts.length < 4) {
        const o = pool[rng.randint(pool.length)];
        if (!opts.includes(o)) opts.push(o);
      }
      rng.shuffle(opts);
      s.q = { hid, opts, data: [], picked: null };
      s.round++;
      bBox.textContent = '? ? ?';
      bIn.textContent = 'x = ?';
      bOut.textContent = 'f(x) = ?';
      draw();
    }
    function query(x) {
      if (s.q.picked) return;
      const y = s.q.hid.f(x);
      if (!s.q.data.some((d) => d[0] === x)) s.q.data.push([x, y]);
      bIn.textContent = 'x = ' + U.fmt(x, 2);
      bOut.textContent = 'f(x) = ' + U.fmt(y, 3);
      [bIn, bBox, bOut].forEach((b, i) => setTimeout(() => flash(b), i * 160));
      draw();
    }
    function pick(o) {
      if (s.q.picked) return;
      s.q.picked = o;
      if (o === s.q.hid) s.right++;
      bBox.textContent = 'f(x) = ' + s.q.hid.t;
      draw();
    }
    function draw() {
      const q = s.q;
      optsBox.textContent = '';
      q.opts.forEach((o) => {
        const ok = consistent(o);
        const b = ui.button(optsBox, { label: 'f(x) = ' + o.t, kind: q.picked ? (o === q.hid ? 'primary' : '') : 'primary', onClick: () => pick(o) });
        b.disabled = !!q.picked;
        if (strike.checked && !ok && !q.picked) (b.style.opacity = '0.45'), (b.style.textDecoration = 'line-through');
        if (q.picked && o === q.picked && o !== q.hid) b.style.outline = '2px solid var(--critical)';
      });
      tableBox.textContent = '';
      const rows = q.data.slice().sort((a, b) => a[0] - b[0]).map((d) => [U.fmt(d[0], 2), U.fmt(d[1], 3)]);
      if (rows.length) ui.table(tableBox, { columns: ['x', 'f(x)'], rows });
      else tableBox.appendChild(H('p', { class: 'widget-note' }, 'Опытов пока нет. Выберите x и нажмите «Бросить в ящик».'));
      const xsAll = U.linspace(-5.5, 5.5, 441);
      const layers = [];
      if (q.picked) layers.push({ type: 'line', x: xsAll, y: xsAll.map(q.hid.f), color: 'model', width: 2, label: 'спрятанное правило', hover: false });
      layers.push({ type: 'points', x: q.data.map((d) => d[0]), y: q.data.map((d) => d[1]), color: 'tree', r: 5, label: 'опыты', tooltip: (i) => [['x', U.fmt(q.data[i][0], 2)], ['f(x)', U.fmt(q.data[i][1], 3)]] });
      const ys = q.data.map((d) => d[1]).concat(q.picked ? xsAll.map(q.hid.f) : []);
      const ext = ys.length ? U.extent(ys) : [-5, 5];
      plot.render(layers, { y: [Math.min(-1, ext[0]) - 1, Math.max(1, ext[1]) + 1] });
      const alive = q.opts.filter(consistent);
      st.set('r', String(s.round));
      st.set('n', String(q.data.length));
      st.set('ok', s.right + ' из ' + (s.round - (q.picked ? 0 : 1)));
      if (q.picked) {
        const won = q.picked === q.hid;
        note.innerHTML = (won ? '<b>Верно!</b> ' : '<b>Нет</b>: спрятано f(x) = ' + q.hid.t + '. ') +
          (alive.length > 1 ? 'Ваши опыты ещё не отличали ' + alive.map((o) => o.t).join(' и ') + ' — для уверенности нужен ещё опыт. ' : q.data.length ? 'Опытов хватило, чтобы остался единственный вариант. ' : '') +
          'Две точки однозначно задают прямую; для параболы нужны три. Учёные и модели машинного обучения делают то же самое: по парам (вход, выход) восстанавливают правило.';
      } else if (!q.data.length) note.innerHTML = 'Сделайте первый опыт. Подсказка: x = 0 сразу показывает «свободный член», а x = 1 — сколько добавляется на шаге.';
      else note.innerHTML = 'Подходят под все опыты: <b>' + alive.length + '</b> из 4 (' + alive.map((o) => o.t).join(', ') + '). ' + (alive.length > 1 ? 'Сделайте опыт, на котором эти правила расходятся.' : 'Остался один вариант — можно отвечать.');
    }
    w.pythonAction(() => 'def black_box(x):\n    return ' + s.q.hid.py + '   # спрятанное правило\n\nfor x in [' + (s.q.data.length ? s.q.data.map((d) => U.pyNum(d[0])).join(', ') : '0, 1, 2') + ']:\n    print(x, "→", black_box(x))\n');
    newRound();
  });

  /* ==============================================================================
   * 3. Функция или нет? Стрелочные диаграммы «вход → выход»
   * ============================================================================== */
  const MAPS = [
    { t: 'Человек → его рост, см', L: ['Аня', 'Борис', 'Вера'], R: ['160', '175', '182'], A: [[0, 1], [1, 2], [2, 0]], ok: true, why: 'У каждого человека ровно один рост. Это функция.' },
    { t: 'Число → его квадрат', L: ['−2', '−1', '1', '2'], R: ['1', '4'], A: [[0, 1], [1, 0], [2, 0], [3, 1]], ok: true, why: 'В одно и то же число 4 приходят две стрелки (из −2 и из 2) — это разрешено. Запрещено обратное: две стрелки из одного входа.' },
    { t: 'Число → числа, квадрат которых равен ему', L: ['1', '4'], R: ['−2', '−1', '1', '2'], A: [[0, 1], [0, 2], [1, 0], [1, 3]], ok: false, bad: [0, 1], why: 'Из 1 выходят две стрелки (в −1 и в 1), из 4 — тоже две. Один вход — два выхода: не функция.' },
    { t: 'Ученик → его оценки за четверть', L: ['Аня', 'Борис'], R: ['3', '4', '5'], A: [[0, 1], [0, 2], [1, 2]], ok: false, bad: [0], why: 'У Ани две оценки — два выхода на один вход. А вот «ученик → средний балл» уже функция.' },
    { t: 'Квартира → прогноз дерева, млн ₽', L: ['30 м²', '35 м²', '50 м²', '60 м²'], R: ['3', '9'], A: [[0, 0], [1, 0], [2, 1], [3, 1]], ok: true, why: 'Несколько квартир попадают в один лист и получают одинаковый прогноз — это нормально. Каждая квартира получает ровно один прогноз: модель — функция.' },
    { t: 'Число x → 1/x на множестве {0, 1, 2}', L: ['0', '1', '2'], R: ['0.5', '1'], A: [[1, 1], [2, 0]], ok: false, bad: [0], why: 'Из 0 не выходит ни одной стрелки: 1/0 не существует. На множестве {0, 1, 2} это не функция; если убрать 0 из множества входов (из области определения) — станет функцией.' },
    { t: 'Любой день → температура в полдень', L: ['пн', 'вт', 'ср', 'чт'], R: ['14°', '17°'], A: [[0, 0], [1, 0], [2, 1], [3, 0]], ok: true, why: 'В каждый день — одна температура. Одинаковые значения в разные дни не мешают.' },
    { t: 'Постоянная функция: всё → 5', L: ['−1', '0', '3', '7'], R: ['5'], A: [[0, 0], [1, 0], [2, 0], [3, 0]], ok: true, why: 'Все входы ведут в одно число. Это функция — постоянная (константа), её график — горизонтальная прямая. Простейшая модель «всегда предсказывай среднее» — как раз такая.' },
  ];
  GBC.widget('is-function', (el) => {
    const s = { i: 0, ans: null, right: 0, done: 0 };
    const w = ui.shell(el, { title: 'Функция или нет?', sub: 'Слева — входы, справа — выходы, стрелка — «этот вход даёт этот выход». Функция — когда из каждого входа выходит ровно одна стрелка.' });
    const yes = ui.button(w.controls, { label: 'Это функция', kind: 'primary', onClick: () => answer(true) });
    const no = ui.button(w.controls, { label: 'Не функция', kind: 'primary', onClick: () => answer(false) });
    ui.button(w.controls, { label: 'Следующий пример', icon: 'step', onClick: () => ((s.i = (s.i + 1) % MAPS.length), (s.ans = null), draw()) });
    const title = H('div', { style: 'text-align:center;font-weight:650;padding:4px 0 6px' });
    const pic = H('div', { style: 'display:flex;justify-content:center' });
    w.main.append(title, pic);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'i', label: 'пример' }, { key: 'ok', label: 'верно' }]);
    const mk = U.uid('arr');
    function answer(v) {
      if (s.ans !== null) return;
      s.ans = v;
      s.done++;
      if (v === MAPS[s.i].ok) s.right++;
      draw();
    }
    function draw() {
      const M = MAPS[s.i];
      const S = GBC.svg;
      const n = Math.max(M.L.length, M.R.length);
      const Wd = 380;
      const Hh = 30 + n * 44;
      const yL = (k) => 22 + ((k + 0.5) * (Hh - 30)) / M.L.length;
      const yR = (k) => 22 + ((k + 0.5) * (Hh - 30)) / M.R.length;
      const svg = S('svg', { viewBox: '0 0 ' + Wd + ' ' + Hh, width: '100%', style: 'max-width:420px;height:auto', role: 'img', 'aria-label': 'Стрелочная диаграмма: ' + M.t });
      svg.appendChild(S('defs', null, S('marker', { id: mk, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, S('path', { d: 'M0,0 L10,5 L0,10 z', style: 'fill:var(--ink-2)' }))));
      svg.appendChild(S('rect', { x: 20, y: 8, width: 110, height: Hh - 16, rx: 40, style: 'fill:var(--surface-2);stroke:var(--border-strong)' }));
      svg.appendChild(S('rect', { x: 250, y: 8, width: 110, height: Hh - 16, rx: 40, style: 'fill:var(--surface-2);stroke:var(--border-strong)' }));
      svg.appendChild(S('text', { x: 75, y: Hh - 1, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:11px' }, 'входы'));
      svg.appendChild(S('text', { x: 305, y: Hh - 1, 'text-anchor': 'middle', style: 'fill:var(--muted);font-size:11px' }, 'выходы'));
      const badSet = new Set(s.ans !== null && M.bad ? M.bad : []);
      M.A.forEach(([a, b]) => {
        const hot = badSet.has(a);
        svg.appendChild(S('line', { x1: 112, y1: yL(a), x2: 266, y2: yR(b), 'marker-end': 'url(#' + mk + ')', style: 'stroke:' + (hot ? 'var(--critical)' : 'var(--ink-2)') + ';stroke-width:' + (hot ? 2.4 : 1.6) }));
      });
      M.L.forEach((t, k) => svg.appendChild(S('text', { x: 75, y: yL(k), dy: '0.35em', 'text-anchor': 'middle', style: 'fill:' + (badSet.has(k) ? 'var(--critical)' : 'var(--ink)') + ';font-weight:650;font-size:14px' }, t)));
      M.R.forEach((t, k) => svg.appendChild(S('text', { x: 305, y: yR(k), dy: '0.35em', 'text-anchor': 'middle', style: 'fill:var(--ink);font-weight:650;font-size:14px' }, t)));
      pic.replaceChildren(svg);
      title.textContent = M.t;
      yes.disabled = no.disabled = s.ans !== null;
      st.set('i', s.i + 1 + ' из ' + MAPS.length);
      st.set('ok', s.right + ' из ' + s.done);
      note.innerHTML = s.ans === null ? 'Проверьте каждый вход слева: сколько стрелок из него выходит? Ровно одна у всех — функция.' : (s.ans === M.ok ? '<b>Верно.</b> ' : '<b>Не совсем.</b> ') + M.why;
    }
    draw();
  });

  /* ==============================================================================
   * 4. Четыре способа задать одну функцию: словами, формулой, таблицей, графиком (+ кодом)
   * ============================================================================== */
  const TEMP_H = [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const TEMP_T = [9.6, 8.1, 10.2, 13.8, 18.5, 19.7, 18.0, 14.3, 9.9];
  const interp = (xs, ys, x) => {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]);
    return ys[ys.length - 1];
  };
  const VIEWS = {
    taxi: {
      label: 'Такси', words: 'Посадка стоит 100 ₽, каждый километр — 25 ₽.', tex: 'f(x) = 100 + 25x', f: (x) => 100 + 25 * x, dom: [0, 10], step: 0.5, x0: 4, tx: [0, 1, 2, 4, 6, 8, 10], xl: 'км', yl: '₽',
      say: (x, y) => 'Поездка на ' + U.fmt(x, 2) + ' км: 100 + 25 · ' + U.fmt(x, 2) + ' = ' + U.fmt(y, 4) + ' ₽.',
      code: 'def f(x):\n    return 100 + 25 * x',
    },
    tariff: {
      label: 'Тариф с минималкой', words: 'Поездка до 2 км включительно — 150 ₽ за всё; каждый километр сверх двух — ещё 30 ₽.', tex: 'f(x) = \\begin{cases} 150, & x \\le 2 \\\\ 150 + 30\\,(x - 2), & x > 2 \\end{cases}',
      f: (x) => (x <= 2 ? 150 : 150 + 30 * (x - 2)), dom: [0, 10], step: 0.5, x0: 1, tx: [0, 1, 2, 3, 4, 6, 10], xl: 'км', yl: '₽',
      say: (x, y) => (x <= 2 ? 'До 2 км включительно — минимальная цена: ' : 'Сверх 2 км: 150 + 30 · ' + U.fmt(x - 2, 2) + ' = ') + U.fmt(y, 4) + ' ₽.',
      code: 'def f(x):\n    if x <= 2:\n        return 150\n    return 150 + 30 * (x - 2)',
    },
    temp: {
      label: 'Температура (измерения)', words: 'Термометр записывал температуру каждые 3 часа. Формулы нет — есть только измерения.', tex: null,
      f: (x) => interp(TEMP_H, TEMP_T, x), dom: [0, 24], step: 0.5, x0: 9, tx: TEMP_H, xl: 'ч', yl: '°C', table: true,
      say: (x, y) => (TEMP_H.includes(x) ? 'В ' + x + ':00 измерено ' + U.fmt(y, 2) + ' °C.' : 'В ' + U.fmt(x, 2) + ' ч измерения нет. Соединив соседние точки отрезком, получим лишь оценку ≈ ' + U.fmt(y, 3) + ' °C.'),
      code: 'hours = [0, 3, 6, 9, 12, 15, 18, 21, 24]\ntemps = [9.6, 8.1, 10.2, 13.8, 18.5, 19.7, 18.0, 14.3, 9.9]\nf = dict(zip(hours, temps))   # функция-таблица: f[9] == 13.8',
    },
    tree: {
      label: 'Дерево решений', words: 'Если площадь не больше 3.5 (десятков м²) — прогноз 3 млн ₽, иначе 9 млн ₽.', tex: 'F(x) = \\begin{cases} 3, & x \\le 3.5 \\\\ 9, & x > 3.5 \\end{cases}',
      f: (x) => (x <= 3.5 ? 3 : 9), dom: [1, 6], step: 0.25, x0: 3, tx: [1, 2, 3, 3.5, 4, 5, 6], xl: 'дес. м²', yl: 'млн ₽', step2: true,
      say: (x, y) => 'Площадь ' + U.fmt(x, 2) + (x <= 3.5 ? ' ≤ 3.5 → левый лист: ' : ' > 3.5 → правый лист: ') + y + ' млн ₽.',
      code: 'def F(x):\n    if x <= 3.5:\n        return 3\n    return 9',
    },
  };
  GBC.widget('four-views', (el) => {
    const s = { fn: 'taxi', x: 4 };
    const w = ui.shell(el, { title: 'Одна функция — четыре способа записи', sub: 'Выберите функцию и двигайте вход x: подсвечиваются строка таблицы, точка на графике и вычисление по формуле. Все карточки описывают одно и то же правило.', stack: true });
    const ctlRow = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 18px;align-items:end' });
    w.main.appendChild(ctlRow);
    ui.segmented(ctlRow, { label: 'Функция', value: s.fn, options: Object.entries(VIEWS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.x = VIEWS[v].x0), sl.el.remove(), mkSlider(), draw()) });
    let sl;
    const slBox = H('div');
    ctlRow.appendChild(slBox);
    function mkSlider() {
      const V = VIEWS[s.fn];
      sl = ui.slider(slBox, { label: 'Вход x, ' + V.xl, min: V.dom[0], max: V.dom[1], step: V.step, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    }
    mkSlider();
    const grid = cardGrid();
    w.main.appendChild(grid);
    const cW = card('1. Словами');
    const cF = card('2. Формулой');
    const cT = card('3. Таблицей');
    const cG = card('4. Графиком');
    const cC = card('+ Кодом (алгоритм)');
    [cW, cF, cT, cG, cC].forEach((c) => grid.appendChild(c.el));
    const wordsP = H('p', { style: 'margin:0 0 6px' });
    const sayP = H('p', { style: 'margin:0;color:var(--accent);font-weight:600' });
    cW.body.append(wordsP, sayP);
    const texBox = H('div', { style: 'overflow-x:auto;padding:4px 0' });
    const fNote = H('p', { class: 'widget-note', style: 'margin:4px 0 0' });
    cF.body.append(texBox, fNote);
    const tBox = H('div');
    cT.body.appendChild(tBox);
    const plot = new GBC.Plot(cG.body, { height: 200, margin: { left: 44 }, x: { label: 'x' }, y: { label: 'f(x)' } });
    const codeBox = H('div');
    cC.body.appendChild(codeBox);
    const note = w.note('', true);
    function draw() {
      const V = VIEWS[s.fn];
      const y = V.f(s.x);
      wordsP.textContent = V.words;
      sayP.textContent = V.say(s.x, y);
      if (V.tex) {
        texInto(texBox, V.tex, true);
        fNote.textContent = s.fn === 'tariff' || s.fn === 'tree' ? 'Формула из двух кусков: какой кусок работает, решает условие справа.' : 'Подставьте x = ' + U.fmt(s.x, 2) + ' вместо x.';
      } else {
        texBox.textContent = '—';
        fNote.textContent = 'Формулы нет: это функция, заданная таблицей измерений. Так выглядят почти все данные в машинном обучении.';
      }
      tBox.textContent = '';
      const rows = V.tx.map((x) => [U.fmt(x, 2), U.fmt(V.f(x), 4)]);
      ui.table(tBox, { columns: ['x, ' + V.xl, 'f(x), ' + V.yl], rows, highlight: (i) => V.tx[i] === s.x });
      const c = curve(V.f, V.dom[0], V.dom[1], 601, { jump: V.step2 ? 1 : null });
      plot.render([
        V.table
          ? { type: 'line', x: TEMP_H, y: TEMP_T, color: 'model', width: 1.4, dash: '4 4', hover: false }
          : { type: 'line', x: c.x, y: c.y, color: 'model', width: 2, hover: false },
        V.table ? { type: 'points', x: TEMP_H, y: TEMP_T, color: 'model', r: 4, tooltip: (i) => [['часы', String(TEMP_H[i])], ['°C', String(TEMP_T[i])]] } : null,
        V.step2 ? { type: 'points', x: [3.5], y: [3], color: 'model', r: 4 } : null,
        V.step2 ? { type: 'points', x: [3.5], y: [9], color: 'model', r: 4, hollow: true } : null,
        { type: 'segments', x1: [s.x, V.dom[0]], y1: [0, y], x2: [s.x, s.x], y2: [y, y], color: 'tree', width: 1.2, dash: '3 3', opacity: 1 },
        { type: 'points', x: [s.x], y: [y], color: 'tree', r: 6, tooltip: () => [['x', U.fmt(s.x, 2)], ['f(x)', U.fmt(y, 4)]] },
      ], { x: V.dom, y: [0, Math.max(...V.tx.map(V.f), y) * 1.12] });
      codeBox.replaceChildren(ui.codeBlock(V.code + (s.fn === 'temp' ? '' : '\n\nprint(' + (s.fn === 'tree' ? 'F' : 'f') + '(' + U.pyNum(s.x) + '))   # → ' + U.fmt(y, 4).replace('−', '-'))));
      note.innerHTML = {
        taxi: 'Словесное описание понятно человеку, формула — короче и точнее, таблица удобна для поиска готовых значений, график сразу показывает форму: прямая — значит, цена растёт равномерно.',
        tariff: 'Здесь формула состоит из двух кусков — такую функцию называют <b>кусочно заданной</b> (шаг 15). На графике это видно как излом в точке x = 2: дальше прямая идёт вверх.',
        temp: 'Данные почти всегда приходят таблицей. Между измерениями значения мы не знаем — пунктир лишь догадка. Восстановить правило по таблице — это и есть задача модели машинного обучения.',
        tree: 'Модель машинного обучения часто задана <b>алгоритмом</b>: последовательностью вопросов «если …, то …». Это тоже функция — у каждой площади ровно один прогноз. Её график — ступенька.',
      }[s.fn];
    }
    w.pythonAction(() => VIEWS[s.fn].code + '\n\nfor x in [' + VIEWS[s.fn].tx.map(U.pyNum).join(', ') + ']:\n    print(x, "→", ' + (s.fn === 'temp' ? 'f[x]' : s.fn === 'tree' ? 'F(x)' : 'f(x)') + ')\n');
    draw();
  });

  /* ==============================================================================
   * 5. Координатная плоскость: поставить точку и прочитать координаты
   * ============================================================================== */
  GBC.widget('coord-plane', (el) => {
    const s = { mode: 'place', seed: 11, target: null, placed: null, opts: null, picked: null, right: 0, tries: 0, free: [] };
    const w = ui.shell(el, { title: 'Координатная плоскость', sub: 'Две перпендикулярные числовые оси: x — вправо, y — вверх. Точку задают парой (x, y): сначала «сколько вправо», потом «сколько вверх».' });
    ui.segmented(w.controls, { label: 'Задание', value: s.mode, options: [{ value: 'place', label: 'поставить точку' }, { value: 'name', label: 'назвать координаты' }, { value: 'free', label: 'свободно' }], onChange: (v) => ((s.mode = v), next()) });
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:6px' });
    w.controls.appendChild(optsBox);
    ui.button(w.controls, { label: 'Следующее задание', icon: 'step', onClick: () => next() });
    const quads = ui.toggle(w.controls, { label: 'Подписать четверти', checked: true, onChange: () => draw() });
    const task = H('div', { style: 'text-align:center;font-size:1.1rem;font-weight:650;padding:4px 0 2px' });
    w.main.appendChild(task);
    const T = U.range(13, -6);
    const plot = new GBC.Plot(w.main, {
      height: 380, equal: true, x: { label: 'x', domain: [-6.5, 6.5], ticks: T }, y: { label: 'y', domain: [-6.5, 6.5], ticks: T },
      onClick: (x, y) => click(Math.round(x), Math.round(y)),
    });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ok', label: 'верно' }, { key: 'q', label: 'четверть' }]);
    const quadOf = (x, y) => (x === 0 || y === 0 ? 'на оси' : x > 0 ? (y > 0 ? 'I' : 'IV') : y > 0 ? 'II' : 'III');
    function next() {
      const rng = new GBC.RNG(s.seed++);
      let a = 0;
      let b = 0;
      while (a === 0 || b === 0 || Math.abs(a) === Math.abs(b)) (a = rng.randint(11) - 5), (b = rng.randint(11) - 5);
      s.target = [a, b];
      s.placed = null;
      s.picked = null;
      const cand = [[a, b], [b, a], [-a, b], [a, -b]];
      rng.shuffle(cand);
      s.opts = cand;
      draw();
    }
    function click(x, y) {
      if (s.mode === 'free') {
        s.free.push([x, y]);
        if (s.free.length > 6) s.free.shift();
      } else if (s.mode === 'place' && !s.placed) {
        s.placed = [x, y];
        s.tries++;
        if (x === s.target[0] && y === s.target[1]) s.right++;
      } else return;
      draw();
    }
    function pick(i) {
      if (s.picked !== null) return;
      s.picked = i;
      s.tries++;
      if (s.opts[i][0] === s.target[0] && s.opts[i][1] === s.target[1]) s.right++;
      draw();
    }
    function draw() {
      const [a, b] = s.target;
      optsBox.textContent = '';
      optsBox.hidden = s.mode !== 'name';
      if (s.mode === 'name')
        s.opts.forEach((o, i) => {
          const btn = ui.button(optsBox, { label: pt(o[0], o[1]), kind: 'primary', onClick: () => pick(i) });
          btn.disabled = s.picked !== null;
          if (s.picked !== null && o[0] === a && o[1] === b) btn.style.outline = '2px solid var(--good)';
        });
      const layers = [
        { type: 'hline', y: 0, color: 'ink2', width: 1.4 },
        { type: 'vline', x: 0, color: 'ink2', width: 1.4 },
        quads.checked ? { type: 'text', items: [{ x: 4.6, y: 5.6, text: 'I (+, +)', anchor: 'middle' }, { x: -4.6, y: 5.6, text: 'II (−, +)', anchor: 'middle' }, { x: -4.6, y: -5.8, text: 'III (−, −)', anchor: 'middle' }, { x: 4.6, y: -5.8, text: 'IV (+, −)', anchor: 'middle' }] } : null,
        { type: 'text', items: [{ x: 0, y: 0, dx: -12, dy: 14, text: '0' }] },
      ];
      let msg = '';
      if (s.mode === 'place') {
        task.textContent = 'Поставьте точку ' + pt(a, b) + ' — щёлкните по плоскости';
        if (s.placed) {
          const [x, y] = s.placed;
          const ok = x === a && y === b;
          layers.push({ type: 'segments', x1: [a, 0], y1: [0, b], x2: [a, a], y2: [b, b], color: 'model', width: 1.2, dash: '4 3', opacity: 1 });
          layers.push({ type: 'points', x: [a], y: [b], color: 'model', r: 7, label: 'нужная точка', tooltip: () => [['точка', pt(a, b)]] });
          if (!ok) layers.push({ type: 'points', x: [x], y: [y], color: 'tree', r: 6, label: 'ваша точка', tooltip: () => [['ваша', pt(x, y)]] });
          if (ok) msg = '<b>Точно!</b> От начала координат: ' + Math.abs(a) + ' ' + (a > 0 ? 'вправо' : 'влево') + ', затем ' + Math.abs(b) + ' ' + (b > 0 ? 'вверх' : 'вниз') + '. Четверть ' + quadOf(a, b) + '.';
          else if (x === b && y === a) msg = '<b>Перепутан порядок.</b> Вы поставили ' + pt(x, y) + '. Первое число — всегда x (по горизонтали), второе — y (по вертикали).';
          else if ((x === -a && y === b) || (x === a && y === -b) || (x === -a && y === -b)) msg = '<b>Ошибка в знаке.</b> Вы поставили ' + pt(x, y) + '. Минус у x — значит влево, минус у y — значит вниз.';
          else msg = '<b>Мимо:</b> вы поставили ' + pt(x, y) + '. Пунктир показывает путь к ' + pt(a, b) + ': сначала по оси x, потом параллельно оси y.';
        } else msg = 'Сначала двигайтесь по горизонтали на x, потом по вертикали на y. Знак «минус» — влево или вниз.';
      } else if (s.mode === 'name') {
        task.textContent = 'Какие координаты у синей точки?';
        layers.push({ type: 'points', x: [a], y: [b], color: 'model', r: 7, tooltip: () => [['подсказка', 'смотрите на оси']] });
        if (s.picked !== null) {
          layers.push({ type: 'segments', x1: [a, a], y1: [b, b], x2: [a, 0], y2: [0, b], color: 'model', width: 1.2, dash: '4 3', opacity: 1 });
          const o = s.opts[s.picked];
          msg = (o[0] === a && o[1] === b ? '<b>Верно:</b> ' : '<b>Нет.</b> Правильно ') + pt(a, b) + '. Опустите перпендикуляр на ось x — получите ' + a + '; проведите горизонталь к оси y — получите ' + b + '.';
        } else msg = 'Мысленно опустите из точки вертикаль на ось x и проведите горизонталь к оси y.';
      } else {
        task.textContent = 'Щёлкайте по плоскости — появятся точки с координатами';
        layers.push({ type: 'points', x: s.free.map((p) => p[0]), y: s.free.map((p) => p[1]), color: 'tree', r: 6, tooltip: (i) => [['точка', pt(s.free[i][0], s.free[i][1])], ['четверть', quadOf(s.free[i][0], s.free[i][1])]] });
        layers.push({ type: 'text', items: s.free.map((p) => ({ x: p[0], y: p[1], dx: 8, dy: -8, text: pt(p[0], p[1]) })) });
        msg = s.free.length ? 'Последняя точка ' + pt(...s.free[s.free.length - 1]) + ' — ' + (quadOf(...s.free[s.free.length - 1]) === 'на оси' ? 'лежит на оси: одна из координат равна 0.' : 'в четверти ' + quadOf(...s.free[s.free.length - 1]) + '.') + ' Знаки координат определяют четверть: I (+, +), II (−, +), III (−, −), IV (+, −).' : 'Начало координат — точка (0, 0), где пересекаются оси.';
      }
      plot.render(layers);
      st.set('ok', s.right + ' из ' + s.tries);
      st.set('q', s.mode === 'free' ? (s.free.length ? quadOf(...s.free[s.free.length - 1]) : '—') : quadOf(a, b));
      note.innerHTML = msg;
    }
    next();
  });

  /* ==============================================================================
   * 6. От точек к линии: график — это все пары сразу
   * ============================================================================== */
  const SMOOTH = {
    square: { label: 'x²', f: (x) => x * x, dom: [-3, 3], py: 'x**2' },
    sin: { label: 'sin x', f: Math.sin, dom: [-6.3, 6.3], py: 'np.sin(x)' },
    cubic: { label: 'x³ − 3x', f: (x) => x ** 3 - 3 * x, dom: [-2.4, 2.4], py: 'x**3 - 3*x' },
    wiggle: { label: 'sin 4x (коварная)', f: (x) => Math.sin(4 * x), dom: [-3, 3], py: 'np.sin(4*x)' },
  };
  GBC.widget('dots-to-curve', (el) => {
    const s = { fn: 'sin', k: 0 };
    const NS = [3, 5, 8, 12, 20, 35, 60, 100, 200, 400];
    const w = ui.shell(el, { title: 'От точек к линии', sub: 'Нажмите ▶: точек становится всё больше, и они сливаются в линию. График — это все пары (x, f(x)) сразу. Попробуйте «коварную» функцию при 5 точках.' });
    ui.segmented(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(SMOOTH).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), draw()) });
    ui.player(w.controls, { label: 'Число точек', min: 0, max: NS.length - 1, value: 0, fps: 2, format: (v) => NS[v] + ' точ.', onChange: (v) => ((s.k = v), draw()) });
    const truth = ui.toggle(w.controls, { label: 'Показать настоящий график', checked: false, onChange: () => draw() });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    function draw() {
      const F = SMOOTH[s.fn];
      const n = NS[s.k];
      const xs = U.linspace(F.dom[0], F.dom[1], n);
      const r = n <= 20 ? 5 : n <= 60 ? 3.5 : n <= 100 ? 2.5 : 1.6;
      const fine = U.linspace(F.dom[0], F.dom[1], 800);
      plot.render([
        truth.checked ? { type: 'line', x: fine, y: fine.map(F.f), color: 'truth', width: 1.6, label: 'настоящий график', hover: false } : null,
        n >= 3 && n <= 20 ? { type: 'line', x: xs, y: xs.map(F.f), color: 'ink2', width: 1, dash: '3 3', label: 'догадка: соединили точки', hover: false } : null,
        { type: 'points', x: xs, y: xs.map(F.f), color: 'model', r, tooltip: (i) => [['x', U.fmt(xs[i], 3)], ['f(x)', U.fmt(F.f(xs[i]), 3)]] },
      ], { x: F.dom, y: U.extent(fine.map(F.f)).map((v, i) => v + (i ? 0.3 : -0.3)) });
      if (s.fn === 'wiggle' && n <= 12) note.innerHTML = '<b>Осторожно:</b> по ' + n + ' точкам sin 4x выглядит совсем не волной' + (n === 5 ? ' — почти убывающей прямой' : '') + '! Между точками может происходить что угодно. Включите «Показать настоящий график». Вывод: редкая таблица может обмануть — модели, обученные на редких данных, ошибаются так же.';
      else note.innerHTML = n <= 8
        ? n + ' точек: по ним трудно понять форму. Пунктир между точками — лишь догадка, что между ними.'
        : n < 100 ? n + ' точек: форма уже угадывается.' : n + ' точек: точки слились в линию. Настоящий график — бесконечно много точек, по одной для каждого x.';
    }
    w.pythonAction(() => {
      const F = SMOOTH[s.fn];
      return 'import numpy as np\nimport matplotlib.pyplot as plt\n\nfig, axes = plt.subplots(1, 3, figsize=(12, 3.2), sharey=True)\nfor ax, n in zip(axes, [5, 30, 400]):\n    x = np.linspace(' + F.dom[0] + ', ' + F.dom[1] + ', n)\n    ax.plot(x, ' + F.py + ', "o", ms=4 if n < 100 else 1.5)\n    ax.set_title(f"{n} точек")\nplt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * 7. Вертикальный тест: функция ли это кривая?
   * ============================================================================== */
  const VT = {
    parab: { label: 'парабола y = x²/2', fn: true, ys: (x) => [x * x / 2], draw: () => [curve((x) => x * x / 2, -4, 4)] },
    side: { label: '«лежачая» парабола x = y²/2', fn: false, ys: (x) => (x < 0 ? [] : x === 0 ? [0] : [Math.sqrt(2 * x), -Math.sqrt(2 * x)]), draw: () => { const t = U.linspace(-3.2, 3.2, 401); return [{ x: t.map((v) => v * v / 2), y: t }]; } },
    circle: { label: 'окружность x² + y² = 6.25', fn: false, ys: (x) => (Math.abs(x) > 2.5 ? [] : Math.abs(x) === 2.5 ? [0] : [Math.sqrt(6.25 - x * x), -Math.sqrt(6.25 - x * x)]), draw: () => { const t = U.linspace(0, 2 * Math.PI, 361); return [{ x: t.map((v) => 2.5 * Math.cos(v)), y: t.map((v) => 2.5 * Math.sin(v)) }]; } },
    sin: { label: 'волна y = 2 sin x', fn: true, ys: (x) => [2 * Math.sin(x)], draw: () => [curve((x) => 2 * Math.sin(x), -4, 4)] },
    cubic: { label: 'кубическая y = (x³ − 4x)/3', fn: true, ys: (x) => [(x ** 3 - 4 * x) / 3], draw: () => [curve((x) => (x ** 3 - 4 * x) / 3, -4, 4)] },
    stepOk: { label: 'ступенька (одна точка в нуле)', fn: true, dots: [[0, -1, true], [0, 1.5, false]], ys: (x) => [x < 0 ? -1 : 1.5], draw: () => [{ x: [-4, 0], y: [-1, -1] }, { x: [0, 4], y: [1.5, 1.5] }] },
    stepBad: { label: 'ступенька с двумя точками в нуле', fn: false, dots: [[0, -1, false], [0, 1.5, false]], ys: (x) => (x < 0 ? [-1] : x > 0 ? [1.5] : [-1, 1.5]), draw: () => [{ x: [-4, 0], y: [-1, -1] }, { x: [0, 4], y: [1.5, 1.5] }] },
  };
  GBC.widget('vertical-test', (el) => {
    const s = { c: 'circle', x: 1, sweep: null };
    const w = ui.shell(el, { title: 'Вертикальный тест', sub: 'Тяните вертикальную линию. Если хоть где-то она пересекает кривую больше одного раза — кривая не график функции: у одного x оказалось два выхода.' });
    ui.select(w.controls, { label: 'Кривая', value: s.c, options: Object.entries(VT).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.c = v), (s.sweep = null), draw()) });
    const xsl = ui.slider(w.controls, { label: 'положение линии x', min: -4, max: 4, step: 0.05, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    ui.button(w.controls, { label: 'Проверить всю кривую', kind: 'primary', onClick: () => sweep() });
    const plot = new GBC.Plot(w.main, { height: 320, equal: true, x: { label: 'x', domain: [-4, 4] }, y: { label: 'y', domain: [-3.4, 3.4] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'x линии' }, { key: 'n', label: 'пересечений' }, { key: 'v', label: 'вердикт' }]);
    function sweep() {
      const C = VT[s.c];
      let worst = { n: 0, x: 0 };
      for (let k = 0; k <= 160; k++) {
        const x = Math.round((-4 + k * 0.05) * 100) / 100;
        const n = C.ys(x).length;
        if (n > worst.n) worst = { n, x };
      }
      s.sweep = worst;
      const start = performance.now();
      const anim = (t) => {
        const p = Math.min(1, (t - start) / 1200);
        s.x = Math.round((-4 + 8 * p) * 20) / 20;
        if (p >= 1) s.x = worst.n > 1 ? worst.x : 1;
        draw();
        if (p < 1) requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
    }
    function draw() {
      const C = VT[s.c];
      const ys = C.ys(s.x);
      xsl.set(s.x);
      const layers = C.draw().map((c) => ({ type: 'line', x: c.x, y: c.y, color: 'model', width: 2.4, hover: false }));
      if (C.dots) layers.push({ type: 'points', x: C.dots.map((d) => d[0]), y: C.dots.map((d) => d[1]), color: 'model', r: 5, hollow: false }, { type: 'points', x: C.dots.filter((d) => d[2]).map((d) => d[0]), y: C.dots.filter((d) => d[2]).map((d) => d[1]), color: 'model', r: 5, hollow: true });
      layers.push({ type: 'vline', x: s.x, color: 'tree', width: 2, draggable: true, onDrag: (v) => ((s.x = Math.round(U.clamp(v, -4, 4) * 20) / 20), draw()) });
      layers.push({ type: 'points', x: ys.map(() => s.x), y: ys, color: ys.length > 1 ? 'critical' : 'tree', r: 6, tooltip: (i) => [['точка', pt(s.x, ys[i])]] });
      plot.render(layers);
      st.set('x', U.fmt(s.x, 2));
      st.set('n', String(ys.length));
      st.set('v', ys.length > 1 ? 'не функция' : s.sweep ? (s.sweep.n > 1 ? 'не функция' : 'функция') : ys.length ? 'пока ок' : 'x не в области');
      let msg = ys.length > 1
        ? '<b>Два пересечения:</b> при x = ' + U.fmt(s.x, 2) + ' кривая даёт ' + ys.map((v) => U.fmt(v, 2)).join(' и ') + '. Один вход — два выхода, значит, это не график функции.'
        : ys.length === 1 ? 'Одно пересечение: при x = ' + U.fmt(s.x, 2) + ' выход ' + U.fmt(ys[0], 2) + '. Проверьте и другие положения линии.' : 'Линия не пересекает кривую: этот x вообще не входит в область определения (не пугайтесь — это допустимо).';
      if (s.sweep) msg += ' <b>Итог проверки всей кривой:</b> ' + (s.sweep.n > 1 ? 'нашлось место с ' + s.sweep.n + ' пересечениями (x = ' + U.fmt(s.sweep.x, 2) + ') — не функция.' : 'нигде не больше одного пересечения — это график функции.');
      if ((s.c === 'stepOk' || s.c === 'stepBad') && Math.abs(s.x) < 1e-9) msg += ' Смотрите на точку x = 0: закрашенный кружок — значение «принадлежит» графику, пустой — нет.';
      if (s.c === 'circle' || s.c === 'side') msg += ' Такую кривую можно разрезать на две функции: верхнюю и нижнюю половины.';
      note.innerHTML = msg;
    }
    draw();
  });

  /* ==============================================================================
   * 8. Область определения и область значений: «тени» графика на осях
   * ============================================================================== */
  const DR = {
    sq: { label: 'x²', f: (x) => x * x, vx: [-4, 4], vy: [-2, 7], D: [[-I, I, 0, 0]], E: [[0, I, 1, 0]], Dt: '(−∞; +∞)', Et: '[0; +∞)', ban: 'Запретов нет: возвести в квадрат можно любое число. Но квадрат не бывает отрицательным — поэтому значения от 0 и выше.' },
    sqrt: { label: '√x', f: (x) => nanIf(x < 0, Math.sqrt(x)), vx: [-3, 9], vy: [-1.5, 4], D: [[0, I, 1, 0]], E: [[0, I, 1, 0]], Dt: '[0; +∞)', Et: '[0; +∞)', ban: 'Под корнем — неотрицательное число: x ≥ 0. Сам корень тоже не бывает отрицательным.' },
    recip: { label: '1/x', f: (x) => nanIf(x === 0, 1 / x), vx: [-5, 5], vy: [-4, 4], D: [[-I, 0, 0, 0], [0, I, 0, 0]], E: [[-I, 0, 0, 0], [0, I, 0, 0]], Dt: 'x ≠ 0, то есть (−∞; 0) ∪ (0; +∞)', Et: 'y ≠ 0', ban: 'Делить на 0 нельзя: x ≠ 0. А сама дробь 1/x никогда не равна нулю — поэтому и y ≠ 0.', jump: 3 },
    shift: { label: '1/(x − 2) + 1', f: (x) => nanIf(x === 2, 1 / (x - 2) + 1), vx: [-3, 7], vy: [-3, 5], D: [[-I, 2, 0, 0], [2, I, 0, 0]], E: [[-I, 1, 0, 0], [1, I, 0, 0]], Dt: 'x ≠ 2', Et: 'y ≠ 1', ban: 'Знаменатель x − 2 ≠ 0, значит x ≠ 2. Гипербола 1/x, сдвинутая на 2 вправо и на 1 вверх: «запретная» горизонталь тоже переехала на y = 1.', jump: 3 },
    semi: { label: '√(4 − x²)', f: (x) => nanIf(4 - x * x < 0, Math.sqrt(Math.max(0, 4 - x * x))), vx: [-4, 4], vy: [-1.5, 3], D: [[-2, 2, 1, 1]], E: [[0, 2, 1, 1]], Dt: '[−2; 2]', Et: '[0; 2]', ban: 'Под корнем 4 − x² ≥ 0, то есть x² ≤ 4 и −2 ≤ x ≤ 2. График — верхняя половина окружности радиуса 2.' },
    ln: { label: 'ln x', f: (x) => nanIf(x <= 0, Math.log(x)), vx: [-2, 8], vy: [-4, 3], D: [[0, I, 0, 0]], E: [[-I, I, 0, 0]], Dt: '(0; +∞)', Et: '(−∞; +∞)', ban: 'Логарифм берут только от положительных чисел: x > 0 (ноль тоже нельзя). Зато значения — любые: от −∞ до +∞.' },
    lnshift: { label: 'ln(5 − x)', f: (x) => nanIf(5 - x <= 0, Math.log(5 - x)), vx: [-4, 7], vy: [-4, 3], D: [[-I, 5, 0, 0]], E: [[-I, I, 0, 0]], Dt: '(−∞; 5)', Et: '(−∞; +∞)', ban: 'Под логарифмом 5 − x > 0, значит x < 5. Условие пишут для всего выражения под знаком функции, а не для x.' },
    exp: { label: 'eˣ', f: Math.exp, vx: [-4, 3], vy: [-1.5, 8], D: [[-I, I, 0, 0]], E: [[0, I, 0, 0]], Dt: '(−∞; +∞)', Et: '(0; +∞)', ban: 'Подставлять можно любое число. Экспонента всегда положительна и к нулю только приближается — ноль не входит.' },
    sigm: { label: 'σ(x) = 1/(1 + e⁻ˣ)', f: sigmoid, vx: [-7, 7], vy: [-0.6, 1.6], D: [[-I, I, 0, 0]], E: [[0, 1, 0, 0]], Dt: '(−∞; +∞)', Et: '(0; 1)', ban: 'Любой вход, а выход — строго между 0 и 1. Поэтому сигмоида превращает любой прогноз в вероятность.' },
    sin: { label: 'sin x', f: Math.sin, vx: [-7, 7], vy: [-2, 2], D: [[-I, I, 0, 0]], E: [[-1, 1, 1, 1]], Dt: '(−∞; +∞)', Et: '[−1; 1]', ban: 'Любой вход; значения колеблются между −1 и 1 включительно.' },
    absm: { label: '|x| − 1', f: (x) => Math.abs(x) - 1, vx: [-4, 4], vy: [-2, 4], D: [[-I, I, 0, 0]], E: [[-1, I, 1, 0]], Dt: '(−∞; +∞)', Et: '[−1; +∞)', ban: 'Модуль ≥ 0, значит |x| − 1 ≥ −1. Наименьшее значение −1 достигается при x = 0.' },
  };
  function intervalLayers(list, axis, view, color) {
    const segs = { x1: [], y1: [], x2: [], y2: [] };
    const closed = { x: [], y: [] };
    const open = { x: [], y: [] };
    const [lo, hi] = axis === 'x' ? view.vx : view.vy;
    for (const [a, b, ia, ib] of list) {
      const A = Math.max(a, lo);
      const B = Math.min(b, hi);
      if (B <= A) continue;
      if (axis === 'x') segs.x1.push(A), segs.x2.push(B), segs.y1.push(0), segs.y2.push(0);
      else segs.y1.push(A), segs.y2.push(B), segs.x1.push(0), segs.x2.push(0);
      for (const [v, inc] of [[a, ia], [b, ib]]) {
        if (!Number.isFinite(v)) continue;
        const tgt = inc ? closed : open;
        if (axis === 'x') tgt.x.push(v), tgt.y.push(0);
        else tgt.x.push(0), tgt.y.push(v);
      }
    }
    return [
      Object.assign({ type: 'segments', color, width: 7, opacity: 0.55 }, segs),
      { type: 'points', x: closed.x, y: closed.y, color, r: 5 },
      { type: 'points', x: open.x, y: open.y, color, r: 5, hollow: true },
    ];
  }
  GBC.widget('domain-range', (el) => {
    const s = { fn: 'sqrt', x: 2 };
    const w = ui.shell(el, { title: 'Тени графика: область определения и область значений', sub: 'Оранжевая «тень» на оси x — все допустимые входы (область определения D). Бирюзовая тень на оси y — все выходы, которые функция принимает (область значений E). Пустой кружок — граница не входит.' });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(DR).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), (s.x = U.clamp(s.x, DR[v].vx[0], DR[v].vx[1])), rebuild(), draw()) });
    let sl;
    const slBox = H('div');
    w.controls.appendChild(slBox);
    function rebuild() {
      slBox.textContent = '';
      const V = DR[s.fn];
      sl = ui.slider(slBox, { label: 'вход x', min: V.vx[0], max: V.vx[1], step: 0.05, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    }
    rebuild();
    const showD = ui.toggle(w.controls, { label: 'Тень на ось x (D)', checked: true, onChange: () => draw() });
    const showE = ui.toggle(w.controls, { label: 'Тень на ось y (E)', checked: true, onChange: () => draw() });
    const plot = new GBC.Plot(w.main, { height: 330, x: { label: 'x' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'D (входы)' }, { key: 'e', label: 'E (выходы)' }, { key: 'v', label: 'f(x)' }]);
    function draw() {
      const V = DR[s.fn];
      const c = curve(V.f, V.vx[0], V.vx[1], 1201, { jump: V.jump || null });
      const y = V.f(s.x);
      const ok = Number.isFinite(y);
      plot.render([
        { type: 'hline', y: 0, color: 'ink2', width: 1 },
        { type: 'vline', x: 0, color: 'ink2', width: 1 },
        ...(showD.checked ? intervalLayers(V.D, 'x', V, 'tree') : []),
        ...(showE.checked ? intervalLayers(V.E, 'y', V, 'aqua') : []),
        { type: 'line', x: c.x, y: c.y, color: 'model', width: 2.4, hover: false },
        ok ? { type: 'segments', x1: [s.x, s.x], y1: [0, y], x2: [s.x, 0], y2: [y, y], color: 'ink2', width: 1.2, dash: '3 3', opacity: 1 } : null,
        ok ? { type: 'points', x: [s.x], y: [y], color: 'model', r: 6, tooltip: () => [['x', U.fmt(s.x, 2)], ['f(x)', U.fmt(y, 3)]] } : { type: 'vline', x: s.x, color: 'critical', width: 1.4, dash: '4 4' },
      ], { x: V.vx, y: V.vy });
      st.set('d', V.Dt);
      st.set('e', V.Et);
      st.set('v', ok ? U.fmt(y, 3) : 'не определено');
      note.innerHTML = '<b>f(x) = ' + V.label + '.</b> ' + V.ban + (ok ? ' Сейчас x = ' + U.fmt(s.x, 2) + ' допустим: точка отбрасывает тень на ось x в ' + U.fmt(s.x, 2) + ' и на ось y в ' + U.fmt(y, 3) + '.' : ' <b>x = ' + U.fmt(s.x, 2) + ' не входит в D:</b> красный пунктир не встречает график.');
    }
    w.pythonAction(() => 'import numpy as np\n\nx = np.linspace(' + DR[s.fn].vx[0] + ', ' + DR[s.fn].vx[1] + ', 100001)\nwith np.errstate(all="ignore"):\n    y = ' + ({ sq: 'x**2', sqrt: 'np.sqrt(x)', recip: '1 / x', shift: '1 / (x - 2) + 1', semi: 'np.sqrt(4 - x**2)', ln: 'np.log(x)', lnshift: 'np.log(5 - x)', exp: 'np.exp(x)', sigm: '1 / (1 + np.exp(-x))', sin: 'np.sin(x)', absm: 'np.abs(x) - 1' })[s.fn] + '\nok = np.isfinite(y)                       # где функция определена\nprint("D на этом отрезке: от", x[ok].min(), "до", x[ok].max())\nprint("E (по сетке): от", y[ok].min().round(4), "до", y[ok].max().round(4))\n');
    draw();
  });

  /* ==============================================================================
   * 9. Читаем график: температура за сутки
   * ============================================================================== */
  GBC.widget('read-graph', (el) => {
    const T = (h) => 14 - 6 * Math.cos((2 * Math.PI * (h - 3)) / 24);
    const dT = (h) => ((6 * 2 * Math.PI) / 24) * Math.sin((2 * Math.PI * (h - 3)) / 24);
    const s = { h: 9 };
    const w = ui.shell(el, { title: 'Читаем график: температура за сутки', sub: 'Тяните оранжевую линию по времени. Внизу — что можно прочитать по графику в этот момент.' });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'время, ч', domain: [0, 24], ticks: [0, 3, 6, 9, 12, 15, 18, 21, 24] }, y: { label: 'температура, °C', domain: [6, 22] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'h', label: 'время' }, { key: 't', label: 'температура' }, { key: 'tr', label: 'тенденция' }]);
    ui.segmented(w.controls, { label: 'Перейти к', value: null, options: [{ value: 3, label: '3:00 (мин)' }, { value: 9, label: '9:00' }, { value: 15, label: '15:00 (макс)' }, { value: 21, label: '21:00' }], onChange: (v) => ((s.h = v), draw()) });
    function hhmm(h) {
      const hh = Math.floor(h);
      const mm = Math.round((h - hh) * 60);
      return String(mm === 60 ? hh + 1 : hh).padStart(2, '0') + ':' + String(mm === 60 ? 0 : mm).padStart(2, '0');
    }
    function draw() {
      const hs = U.linspace(0, 24, 241);
      const h = s.h;
      const t = T(h);
      const d = dT(h);
      plot.render([
        { type: 'vband', x0: 3, x1: 15, color: 'pos', opacity: 0.07 },
        { type: 'line', x: hs, y: hs.map(T), color: 'model', width: 2.2, label: 'температура T(t)', hover: false },
        { type: 'segments', x1: [0, h], y1: [t, 6], x2: [h, h], y2: [t, t], color: 'ink2', width: 1, dash: '3 3', opacity: 1 },
        { type: 'points', x: [3, 15], y: [8, 20], color: 'ink', r: 4, hollow: true, label: 'минимум и максимум', tooltip: (i) => [['время', i ? '15:00' : '03:00'], ['T', i ? '20 °C' : '8 °C']] },
        { type: 'text', items: [{ x: 3, y: 8, dy: 18, anchor: 'middle', text: 'минимум 8°' }, { x: 15, y: 20, dy: -10, anchor: 'middle', text: 'максимум 20°' }] },
        { type: 'vline', x: h, color: 'tree', width: 1.6, draggable: true, onDrag: (x) => ((s.h = Math.round(U.clamp(x, 0, 24) * 4) / 4), draw()) },
        { type: 'points', x: [h], y: [t], color: 'tree', r: 6, tooltip: () => [['время', hhmm(h)], ['T', U.fmt(t, 1) + ' °C']] },
      ]);
      st.set('h', hhmm(h));
      st.set('t', U.fmt(t, 1) + ' °C');
      const flat = Math.abs(d) < 0.05;
      st.set('tr', flat ? 'не меняется' : d > 0 ? 'теплеет ↗' : 'холодает ↘');
      note.innerHTML = 'В ' + hhmm(h) + ' температура ' + U.fmt(t, 1) + ' °C (пунктир от точки к осям). ' + (flat
        ? 'Здесь график на мгновение горизонтален — это <b>' + (t < 14 ? 'минимум' : 'максимум') + '</b>: ' + (t < 14 ? 'до него холодало, после — теплеет.' : 'до него теплело, после — холодает.')
        : d > 0 ? 'График идёт <b>вверх</b> слева направо — функция растёт (розовая полоса: с 3:00 до 15:00).' : 'График идёт <b>вниз</b> слева направо — функция убывает.');
    }
    w.pythonAction(() => 'import numpy as np\n\nT = lambda h: 14 - 6 * np.cos(2 * np.pi * (h - 3) / 24)\n\nhours = np.arange(0, 25, 3)\nfor h in hours:\n    print(f"{h:2d}:00  {T(h):5.1f} °C")\nh = np.linspace(0, 24, 2401)\nprint("минимум в", h[np.argmin(T(h))], "ч, максимум в", h[np.argmax(T(h))], "ч")\n');
    draw();
  });

  /* ==============================================================================
   * 10. Зоопарк функций и преобразования y = a·g(k·(x − b)) + c
   * ============================================================================== */
  const ZOO = {
    lin: { label: 'линейная x', g: (x) => x, tex: 'x', py: 'x', note: 'Прямая: одинаковый прирост на каждом шаге. Линейная регрессия, наклон и сдвиг.' },
    sq: { label: 'парабола x²', g: (x) => x * x, tex: 'x²', py: 'x**2', note: 'Чаша с одним дном. Так выглядят квадратичные потери ½(y − F)² как функция прогноза F.' },
    cube: { label: 'кубическая x³', g: (x) => x ** 3, tex: 'x³', py: 'x**3', note: 'Растёт всюду, но в нуле на миг становится горизонтальной — «полочка» (урок 15.5).' },
    sqrt: { label: 'корень √x', g: (x) => nanIf(x < 0, Math.sqrt(x)), tex: '√x', py: 'np.sqrt(x)', note: 'Определён только при x ≥ 0: из отрицательного числа корень не извлечь. Это область определения.' },
    hyp: { label: 'гипербола 1/x', g: (x) => nanIf(Math.abs(x) < 1e-9, 1 / x), tex: '1/x', py: '1 / x', note: 'В нуле не определена: делить на 0 нельзя. Около нуля значения улетают в ±бесконечность — это пригодится в уроке о пределах.' },
    abs: { label: 'модуль |x|', g: Math.abs, tex: '|x|', py: 'np.abs(x)', note: 'Расстояние до нуля. Острый излом в нуле. Так выглядят абсолютные потери |y − F|.' },
    relu: { label: 'ReLU max(0, x)', g: (x) => Math.max(0, x), tex: 'max(0, x)', py: 'np.maximum(0, x)', note: 'Ноль слева, прямая справа: кусочная функция с изломом. Главная «функция активации» нейросетей.' },
    exp: { label: 'экспонента eˣ', g: Math.exp, tex: 'eˣ', py: 'np.exp(x)', note: 'Растёт всё быстрее: каждый шаг умножает на одно и то же число. Всегда положительна.' },
    log: { label: 'логарифм ln x', g: (x) => nanIf(x <= 0, Math.log(x)), tex: 'ln x', py: 'np.log(x)', note: 'Обратна экспоненте: растёт всё медленнее. Есть в log-loss — функции потерь классификации.' },
    sin: { label: 'синус sin x', g: Math.sin, tex: 'sin x', py: 'np.sin(x)', note: 'Волна, повторяется каждые 2π ≈ 6.28. Удобный пример «неровной» функции.' },
    step: { label: 'ступенька [x ≥ 0]', g: (x) => (x >= 0 ? 1 : 0), tex: '[x ≥ 0]', py: '(x >= 0).astype(float)', note: 'Скачок в нуле. Из таких ступенек состоят деревья решений, а значит, и модели бустинга.' },
    sigm: { label: 'сигмоида σ(x)', g: sigmoid, tex: 'σ(x)', py: '1 / (1 + np.exp(-x))', note: 'Плавная ступенька от 0 до 1: переводит любое число в вероятность. Классификация в бустинге (урок 6.1).' },
  };

  GBC.widget('function-zoo', (el) => {
    const s = { fam: 'sq', a: 1, b: 0, c: 0, k: 1 };
    const w = ui.shell(el, { title: 'Зоопарк функций и преобразования', sub: 'Выберите функцию g и меняйте параметры: y = a·g(k·(x − b)) + c. Пунктир — исходная g(x), синяя линия — преобразованная.' });
    ui.select(w.controls, { label: 'Функция g', value: s.fam, options: Object.entries(ZOO).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fam = v), draw()) });
    const sl = {
      b: ui.slider(w.controls, { label: 'сдвиг вправо b', min: -3, max: 3, step: 0.25, value: 0, onInput: (v) => ((s.b = v), draw()) }),
      c: ui.slider(w.controls, { label: 'сдвиг вверх c', min: -3, max: 3, step: 0.25, value: 0, onInput: (v) => ((s.c = v), draw()) }),
      a: ui.slider(w.controls, { label: 'растяжение по y: a', min: -3, max: 3, step: 0.25, value: 1, onInput: (v) => ((s.a = v), draw()) }),
      k: ui.slider(w.controls, { label: 'сжатие по x: k', min: 0.25, max: 3, step: 0.25, value: 1, onInput: (v) => ((s.k = v), draw()) }),
    };
    ui.button(w.controls, { label: 'Сбросить параметры', onClick: () => {
      Object.assign(s, { a: 1, b: 0, c: 0, k: 1 });
      Object.entries(sl).forEach(([key, ctl]) => ctl.set(s[key]));
      draw();
    } });
    const formula = H('div', { style: 'text-align:center;font-size:1.15rem;font-weight:650;padding:6px 0 2px;font-variant-numeric:tabular-nums' });
    w.main.appendChild(formula);
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x', domain: [-5, 5] }, y: { label: 'y', domain: [-5, 5] } });
    const note = w.note('', true);
    function draw() {
      const Z = ZOO[s.fam];
      const y = (x) => s.a * Z.g(s.k * (x - s.b)) + s.c;
      const inner = s.k === 1 ? (s.b === 0 ? 'x' : 'x' + sgnTerm(-s.b)) : U.fmt(s.k, 2) + '·(' + (s.b === 0 ? 'x' : 'x' + sgnTerm(-s.b)) + ')';
      formula.textContent = 'y = ' + (s.a === 1 ? '' : s.a === -1 ? '−' : U.fmt(s.a, 2) + '·') + 'g(' + inner + ')' + sgnTerm(s.c) + ',   g(x) = ' + Z.tex;
      const c0 = curve(Z.g, -5, 5, 801, { cap: 50, jump: 3 });
      const c1 = curve(y, -5, 5, 801, { cap: 50, jump: 3 });
      plot.render([
        { type: 'line', x: c0.x, y: c0.y, color: 'muted', width: 1.6, dash: '5 4', label: 'g(x)', hover: false },
        { type: 'line', x: c1.x, y: c1.y, color: 'model', width: 2.4, label: 'y = a·g(k(x − b)) + c', hover: false },
        s.b !== 0 ? { type: 'arrows', x1: [0], y1: [-4.4], x2: [s.b], y2: [-4.4], color: 'tree', width: 2 } : null,
        s.c !== 0 ? { type: 'arrows', x1: [-4.4], y1: [0], x2: [-4.4], y2: [s.c], color: 'tree', width: 2 } : null,
      ]);
      const parts = [];
      if (s.b) parts.push('b = ' + U.fmt(s.b, 2) + ': график сдвинут ' + (s.b > 0 ? '<b>вправо</b>' : '<b>влево</b>') + ' — хотя в формуле стоит x − b. Точка, бывшая в x = 0, теперь в x = b');
      if (s.c) parts.push('c = ' + U.fmt(s.c, 2) + ': сдвиг ' + (s.c > 0 ? 'вверх' : 'вниз'));
      if (s.a !== 1) parts.push(s.a < 0 ? 'a &lt; 0: график <b>перевёрнут</b> вверх ногами' + (s.a !== -1 ? ' и растянут в ' + U.fmt(Math.abs(s.a), 2) + ' раза' : '') : s.a === 0 ? 'a = 0: от функции осталась прямая y = c' : 'a = ' + U.fmt(s.a, 2) + ': высоты умножены на ' + U.fmt(s.a, 2));
      if (s.k !== 1) parts.push('k = ' + U.fmt(s.k, 2) + ': график ' + (s.k > 1 ? 'сжат' : 'растянут') + ' по горизонтали в ' + U.fmt(s.k > 1 ? s.k : 1 / s.k, 2) + ' раза');
      note.innerHTML = Z.note + (parts.length ? '<br>' + parts.join('; ') + '.' : ' Подвигайте ползунки.');
    }
    w.pythonAction(() => {
      const Z = ZOO[s.fam];
      return 'import numpy as np\nimport matplotlib.pyplot as plt\n\ng = lambda x: ' + Z.py + '\na, b, c, k = ' + [s.a, s.b, s.c, s.k].map(U.pyNum).join(', ') + '\n\nx = np.linspace(-5, 5, 801)\nwith np.errstate(all="ignore"):\n    plt.plot(x, g(x), "--", color="gray", label="g(x)")\n    plt.plot(x, a * g(k * (x - b)) + c, label="a·g(k(x − b)) + c")\nplt.ylim(-5, 5)\nplt.legend()\nplt.show()\n';
    });
    draw();
  });

  /* ==============================================================================
   * 11. Функция от функции
   * ============================================================================== */
  const INNER = {
    plus1: { e: '□ + 1', label: 'u = x + 1', f: (x) => x + 1, py: 'x + 1' },
    twice: { e: '2□', label: 'u = 2x', f: (x) => 2 * x, py: '2 * x' },
    lin: { e: '2□ − 1', label: 'u = 2x − 1 (прогноз F)', f: (x) => 2 * x - 1, py: '2 * x - 1' },
    sq: { e: '□²', label: 'u = x²', f: (x) => x * x, py: 'x**2' },
    neg: { e: '−□', label: 'u = −x', f: (x) => -x, py: '-x' },
    sin: { e: 'sin □', label: 'u = sin x', f: Math.sin, py: 'np.sin(x)' },
  };
  const OUTER = {
    sq: { e: '□²', label: 'y = u²', f: (u) => u * u, py: 'u**2' },
    sigm: { e: 'σ(□)', label: 'y = σ(u) — сигмоида', f: sigmoid, py: '1 / (1 + np.exp(-u))' },
    exp: { e: 'exp(□)', label: 'y = eᵘ', f: Math.exp, py: 'np.exp(u)' },
    loss: { e: '½(3 − □)²', label: 'y = ½(3 − u)² — потери при y = 3', f: (u) => 0.5 * (3 - u) * (3 - u), py: '0.5 * (3 - u)**2' },
    logloss: { e: 'ln(1 + exp(−□))', label: 'y = ln(1 + e⁻ᵘ) — log-loss при y = 1', f: (u) => Math.log1p(Math.exp(-u)), py: 'np.log1p(np.exp(-u))' },
  };
  GBC.widget('composition', (el) => {
    const s = { inner: 'plus1', outer: 'sq', x: 2 };
    const w = ui.shell(el, { title: 'Функция от функции', sub: 'Число проходит через две машинки подряд: сначала внутренняя u = h(x), потом внешняя y = g(u). Вместе они — одна новая функция y = g(h(x)).' });
    ui.select(w.controls, { label: 'Внутренняя h', value: s.inner, options: Object.entries(INNER).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.inner = v), draw()) });
    ui.select(w.controls, { label: 'Внешняя g', value: s.outer, options: Object.entries(OUTER).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.outer = v), draw()) });
    ui.slider(w.controls, { label: 'Вход x', min: -3, max: 3, step: 0.1, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    ui.button(w.controls, { label: 'Поменять местами', onClick: () => swap() });
    const flow = H('div', { style: 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px;padding:12px 4px 16px' });
    w.main.appendChild(flow);
    const bx = box('');
    const bh = box('', 'rule');
    const bu = box('');
    const bg = box('', 'rule');
    const by = box('');
    flow.append(bx, arrow(), bh, arrow(), bu, arrow(), bg, arrow(), by);
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'x', domain: [-3, 3] }, y: { label: 'значение' } });
    const note = w.note('', true);
    let swapped = false;
    function swap() {
      swapped = !swapped;
      draw();
    }
    function draw() {
      const h = INNER[s.inner];
      const g = OUTER[s.outer];
      const first = swapped ? g : h;
      const second = swapped ? h : g;
      first.lab = 'u = ' + first.e.replace('□', 'x');
      second.lab = 'y = ' + second.e.replace('□', 'u');
      const u = first.f(s.x);
      const y = second.f(u);
      bx.textContent = 'x = ' + U.fmt(s.x, 2);
      bh.textContent = first.lab;
      bu.textContent = 'u = ' + U.fmt(u, 3);
      bg.textContent = second.lab;
      by.textContent = 'y = ' + U.fmt(y, 3);
      const xs = U.linspace(-3, 3, 301);
      const cap = (v) => (Math.abs(v) > 40 ? NaN : v);
      const ys = xs.map((x) => second.f(first.f(x)));
      plot.render([
        { type: 'line', x: xs, y: xs.map(first.f).map(cap), color: 'muted', width: 1.6, dash: '5 4', label: 'внутренняя u(x)', hover: false },
        { type: 'line', x: xs, y: ys.map(cap), color: 'model', width: 2.4, label: 'вместе: y(x)', hover: false },
        { type: 'points', x: [s.x, s.x], y: [cap(u), cap(y)], color: (i) => (i ? 'model' : 'muted'), r: 5, tooltip: (i) => [[i ? 'y' : 'u', U.fmt(i ? y : u, 3)]] },
      ]);
      const other = swapped ? h.f(g.f(s.x)) : g.f(h.f(s.x));
      const alt = swapped ? g.f(h.f(s.x)) : h.f(g.f(s.x));
      note.innerHTML = 'x = ' + U.fmt(s.x, 2) + ' → внутренняя даёт u = ' + U.fmt(u, 3) + ' → внешняя даёт y = ' + U.fmt(y, 3) + '. ' +
        (Math.abs(other - alt) > 1e-9 ? 'В обратном порядке получилось бы ' + U.fmt(alt, 3) + ' — <b>порядок важен</b>. ' : 'Здесь порядок случайно не важен — так бывает редко. ') +
        (swapped ? '' : s.outer === 'sigm' ? 'Так устроена классификация: модель выдаёт число F, сигмоида превращает его в вероятность σ(F).' : s.outer === 'loss' ? 'Так устроены потери: прогноз u подставляется в функцию ошибки. Как меняется y, когда меняется x, расскажет цепное правило (урок 15.6).' : s.outer === 'logloss' ? 'Это log-loss — потери классификации при правильном ответе 1: большой прогноз u → потери почти 0, отрицательный → потери растут.' : '');
    }
    w.pythonAction(() => 'import numpy as np\n\nh = lambda x: ' + INNER[s.inner].py + '        # внутренняя\ng = lambda u: ' + OUTER[s.outer].py + '        # внешняя\ncomposite = lambda x: g(h(x))\n\nx = ' + U.pyNum(s.x) + '\nu = h(x)\nprint(f"x = {x} → u = {u:.4f} → y = {g(u):.4f}")\nprint("одной функцией:", composite(x))\n');
    draw();
  });

  /* ==============================================================================
   * 12. Модель — тоже функция: дерево-пень на шести квартирах
   * ============================================================================== */
  GBC.widget('tree-function', (el) => {
    const toy = GBC.datasets.toyRegression();
    const x = toy.x;
    const y = toy.y;
    const s = { thr: 3.5, q: 4.2 };
    const w = ui.shell(el, { title: 'Модель — это функция', sub: 'Дерево с одним вопросом «площадь ≤ порога?» — функция-ступенька: вход — площадь, выход — прогноз цены. Тяните порог (оранжевая линия) и точку-запрос (синяя).' });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'площадь x, десятки м²', domain: [0.5, 6.5] }, y: { label: 'цена, млн ₽', domain: [0, 12] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'l', label: 'лист слева' }, { key: 'r', label: 'лист справа' }, { key: 'q', label: 'запрос x' }, { key: 'p', label: 'прогноз F(x)' }]);
    function draw() {
      const left = y.filter((_, i) => x[i] <= s.thr);
      const right = y.filter((_, i) => x[i] > s.thr);
      const vl = left.length ? U.mean(left) : U.mean(y);
      const vr = right.length ? U.mean(right) : U.mean(y);
      const F = (v) => (v <= s.thr ? vl : vr);
      plot.render([
        { type: 'steps', segments: [{ x0: 0.5, x1: s.thr, value: vl }, { x0: s.thr, x1: 6.5, value: vr }], color: 'model', width: 2.6, label: 'модель F(x)' },
        { type: 'points', x, y, color: 'data', r: 5, label: 'квартиры', tooltip: (i) => [['x', String(x[i])], ['цена', String(y[i])], ['прогноз', U.fmt(F(x[i]), 2)]] },
        { type: 'vline', x: s.thr, color: 'tree', width: 1.6, dash: '5 4', draggable: true, text: 'порог ' + U.fmt(s.thr, 2), onDrag: (v) => ((s.thr = Math.round(U.clamp(v, 0.6, 6.4) * 4) / 4), draw()) },
        { type: 'points', x: [s.q], y: [F(s.q)], color: 'model', r: 7, draggable: true, label: 'запрос', onDrag: (i, v) => ((s.q = Math.round(U.clamp(v, 0.5, 6.5) * 20) / 20), draw()) },
      ]);
      st.set('l', U.fmt(vl, 2));
      st.set('r', U.fmt(vr, 2));
      st.set('q', U.fmt(s.q, 2));
      st.set('p', U.fmt(F(s.q), 2));
      note.innerHTML = 'F(' + U.fmt(s.q, 2) + ') = ' + U.fmt(F(s.q), 2) + ' млн: каждой площади — ровно один прогноз, значит, модель — функция. Её график — ступенька с <b>разрывом</b> в пороге: о таких скачках — урок 15.4. Бустинг складывает много ступенек (шаг 16 и урок 4.1).';
    }
    w.pythonAction(() => 'import numpy as np\n\nx = np.array([1, 2, 3, 4, 5, 6.0])\ny = np.array([2, 4, 3, 7, 9, 11.0])\nthr = ' + U.pyNum(s.thr) + '\nleft, right = y[x <= thr].mean(), y[x > thr].mean()\nF = lambda v: np.where(v <= thr, left, right)   # модель — функция площади\nprint("листья:", left, right)\nprint("F(' + U.pyNum(s.q) + ') =", F(' + U.pyNum(s.q) + '))\n');
    draw();
  });

  /* ==============================================================================
   * 13. Тренажёр: узнайте функцию по графику
   * ============================================================================== */
  GBC.widget('which-function', (el) => {
    const KEYS = ['lin', 'sq', 'cube', 'sqrt', 'hyp', 'abs', 'relu', 'exp', 'log', 'sin', 'step', 'sigm'];
    const s = { seed: 3, round: 0, right: 0, streak: 0, q: null, picked: null };
    const w = ui.shell(el, { title: 'Тренажёр: узнайте функцию по графику', sub: 'Перед вами одна из функций зоопарка — возможно, сдвинутая или растянутая. Какая?' });
    const optsBox = H('div', { style: 'display:grid;gap:8px' });
    w.controls.appendChild(optsBox);
    const next = ui.button(w.controls, { label: 'Следующий график', icon: 'step', onClick: () => newQ() });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'x', domain: [-5, 5] }, y: { label: 'y', domain: [-5, 5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function newQ() {
      const rng = new GBC.RNG(s.seed++);
      const key = KEYS[rng.randint(KEYS.length)];
      const pool = KEYS.filter((k) => k !== key);
      const opts = [key];
      while (opts.length < 4) {
        const k = pool[rng.randint(pool.length)];
        if (!opts.includes(k)) opts.push(k);
      }
      rng.shuffle(opts);
      const a = [1, 1, 2, -1][rng.randint(4)] * (key === 'exp' ? 0.5 : 1);
      s.q = { key, opts, a, b: Math.round(rng.uniform(-1.5, 1.5) * 2) / 2, c: Math.round(rng.uniform(-1.5, 1.5) * 2) / 2 };
      s.picked = null;
      s.round++;
      optsBox.textContent = '';
      opts.forEach((k) => ui.button(optsBox, { label: ZOO[k].label, kind: 'primary', onClick: () => pick(k) }));
      draw();
    }
    function pick(k) {
      if (s.picked) return;
      s.picked = k;
      if (k === s.q.key) (s.right++, s.streak++);
      else s.streak = 0;
      [...optsBox.querySelectorAll('button')].forEach((b) => (b.disabled = true));
      draw();
    }
    function draw() {
      const { key, a, b, c } = s.q;
      const Z = ZOO[key];
      const cv = curve((x) => a * Z.g(x - b) + c, -5, 5, 801, { cap: 50, jump: 3 });
      plot.render([{ type: 'line', x: cv.x, y: cv.y, color: 'model', width: 2.4, hover: false }]);
      st.set('r', String(s.round));
      st.set('ok', s.right + ' из ' + (s.round - (s.picked ? 0 : 1)));
      st.set('s', String(s.streak));
      if (!s.picked) note.innerHTML = 'Подсказки: где функция определена? Есть ли изломы или скачки? Растёт ли она всё быстрее или всё медленнее? Повторяется ли? Ограничена ли сверху и снизу?';
      else note.innerHTML = (s.picked === key ? '<b>Верно!</b> ' : '<b>Нет</b>, это ' + Z.label + '. ') + 'Здесь y = ' + (a === 1 ? '' : U.fmt(a, 2) + '·') + 'g(x ' + (b >= 0 ? '− ' + U.fmt(b, 2) : '+ ' + U.fmt(-b, 2)) + ')' + (c ? (c > 0 ? ' + ' : ' − ') + U.fmt(Math.abs(c), 2) : '') + ', где g(x) = ' + Z.tex + '. ' + Z.note;
      next.textContent = '';
      next.append(ui.icon('step'), s.picked ? 'Следующий график' : 'Пропустить');
    }
    w.pythonAction(() => 'import numpy as np\nimport matplotlib.pyplot as plt\n\ng = lambda x: ' + ZOO[s.q.key].py + '\na, b, c = ' + [s.q.a, s.q.b, s.q.c].map(U.pyNum).join(', ') + '\nx = np.linspace(-5, 5, 801)\nwith np.errstate(all="ignore"):\n    plt.plot(x, a * g(x - b) + c)\nplt.ylim(-5, 5)\nplt.show()\n');
    newQ();
  });

  GBC.lesson151 = { curve, texInto, box, arrow, flash, pt, sgnTerm, card, cardGrid, sigmoid, nanIf, ZOO };
})();
