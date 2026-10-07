/* Урок 1.1 — обучение с учителем:
 *   data-anatomy — таблица данных: объект, признак, ячейка, ответы и их обозначения;
 *   task-sorter  — тренажёр «какой это тип задачи»;
 *   data-source  — откуда берутся данные: y = f(x) + ε;
 *   error-table  — ошибка руками: остатки, квадраты, MSE, RMSE, MAE, R²;
 *   manual-fit   — подбор параметров руками и «рельеф ошибки»;
 *   train-test   — обучение и тест: честная оценка и её разброс. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  /** Формула KaTeX как элемент; до загрузки KaTeX — текст. */
  const tex = (src) => GBC.math.tex(src);
  const signed = (v, d = 3) => (v > 0 ? '+' : '') + U.fmt(v, d);

  /* ------------------------------------------------ шесть квартир (как в уроке 1) */
  const FLATS = {
    area: [30, 40, 50, 60, 70, 80],
    floor: [5, 9, 1, 3, 12, 7],
    district: ['Север', 'Центр', 'Юг', 'Центр', 'Север', 'Центр'],
    metro: [15, 5, 20, 10, 8, 6],
    price: [3, 5, 4, 8, 9, 13],
  };
  const FEATURES = [
    { key: 'area', name: 'площадь', unit: 'м²', kind: 'числовой' },
    { key: 'floor', name: 'этаж', unit: '', kind: 'числовой (целый)' },
    { key: 'district', name: 'район', unit: '', kind: 'категориальный' },
    { key: 'metro', name: 'до метро', unit: 'мин', kind: 'числовой' },
  ];

  /* =================================================================================
   * data-anatomy — объект, признак, ячейка, ответ
   * ================================================================================= */
  GBC.widget('data-anatomy', (el) => {
    const n = FLATS.price.length;
    const d = FEATURES.length;
    const s = { mode: 'row', i: 2, j: 0 };
    const w = ui.shell(el, {
      title: 'Анатомия таблицы данных',
      sub: 'Нажимайте на ячейки таблицы. Режим определяет, что подсвечивается: один объект (строка), один признак (столбец), одно значение или все ответы.',
      foot: false,
    });
    ui.segmented(w.controls, {
      label: 'Что выделять',
      options: [{ value: 'row', label: 'Объект' }, { value: 'col', label: 'Признак' }, { value: 'cell', label: 'Значение' }, { value: 'y', label: 'Ответы' }],
      value: s.mode,
      onChange: (v) => ((s.mode = v), draw()),
    });
    const shape = H('div', { class: 'ctl-help' });
    w.controls.appendChild(shape);
    const tableBox = H('div', { class: 'table-wrap' });
    const descr = H('div', { style: { padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', marginTop: '10px', lineHeight: '1.6' } });
    w.main.append(tableBox, descr);
    const cellStyle = (on, strong) => ({
      cursor: 'pointer',
      background: on ? (strong ? 'var(--accent-soft)' : 'var(--accent-soft)') : '',
      outline: on && strong ? '2px solid var(--accent)' : '',
      outlineOffset: '-2px',
      fontWeight: on ? '650' : '',
    });
    const valOf = (i, j) => FLATS[FEATURES[j].key][i];
    const fmtVal = (i, j) => String(valOf(i, j)) + (FEATURES[j].unit ? ' ' + FEATURES[j].unit : '');
    function draw() {
      const t = H('table', { class: 'data' });
      const head = H('tr', null, H('th', null, '№ (i)'));
      FEATURES.forEach((f, j) => head.appendChild(H('th', { class: 'num', style: s.mode === 'col' && s.j === j ? { color: 'var(--accent)' } : null }, f.name + (f.unit ? ', ' + f.unit : ''), H('br'), H('span', { class: 'muted', style: { fontWeight: 400 } }, 'j = ' + (j + 1)))));
      head.appendChild(H('th', { class: 'num', style: { borderLeft: '2px solid var(--border-strong)' } }, 'цена, млн', H('br'), H('span', { class: 'muted', style: { fontWeight: 400 } }, 'ответ y')));
      const body = H('tbody');
      for (let i = 0; i < n; i++) {
        const row = H('tr');
        row.appendChild(H('td', { style: cellStyle(s.mode === 'row' && s.i === i, false) }, String(i + 1)));
        for (let j = 0; j < d; j++) {
          const on = (s.mode === 'row' && s.i === i) || (s.mode === 'col' && s.j === j) || (s.mode === 'cell' && s.i === i && s.j === j);
          const td = H('td', { class: 'num', style: cellStyle(on, s.mode === 'cell'), title: 'объект ' + (i + 1) + ', признак «' + FEATURES[j].name + '»' }, String(valOf(i, j)));
          td.addEventListener('click', () => {
            s.i = i;
            s.j = j;
            if (s.mode === 'y') s.mode = 'row';
            draw();
          });
          row.appendChild(td);
        }
        const yOn = s.mode === 'y' || (s.mode === 'row' && s.i === i);
        const ty = H('td', { class: 'num', style: Object.assign(cellStyle(yOn, false), { borderLeft: '2px solid var(--border-strong)' }) }, String(FLATS.price[i]));
        ty.addEventListener('click', () => ((s.mode = 'y'), draw()));
        row.appendChild(ty);
        body.appendChild(row);
      }
      t.append(H('thead', null, head), body);
      tableBox.replaceChildren(t);
      // описание выделенного
      descr.textContent = '';
      const line = (...parts) => descr.appendChild(H('div', null, ...parts));
      const i = s.i;
      const j = s.j;
      if (s.mode === 'row') {
        const vals = FEATURES.map((f, k) => (f.kind === 'категориальный' ? '\\text{' + valOf(i, k) + '}' : String(valOf(i, k))));
        line(H('b', null, 'Объект №' + (i + 1) + ' (строка). '), 'Его признаки — вектор ', tex('x_{' + (i + 1) + '} = (' + vals.join(',\\ ') + ')'), ', ответ ', tex('y_{' + (i + 1) + '} = ' + FLATS.price[i]), ' млн.');
        line('Модель получает на вход ', tex('x_{' + (i + 1) + '}'), ' и должна выдать число, близкое к ', tex('y_{' + (i + 1) + '}'), '. Одна строка таблицы = один пример «вопрос → правильный ответ».');
      } else if (s.mode === 'col') {
        const f = FEATURES[j];
        const col = FLATS[f.key].map((v) => (f.kind === 'категориальный' ? '\\text{' + v + '}' : String(v)));
        line(H('b', null, 'Признак «' + f.name + '» (столбец j = ' + (j + 1) + '). '), 'Значения у всех объектов: ', tex('(' + col.join(',\\ ') + ')'), '.');
        line('Тип: ', H('b', null, f.kind), '. ', f.kind === 'категориальный' ? 'Это не число, а название группы: перед обучением его нужно закодировать числами (урок 10.1).' : 'Числовые признаки модель может сравнивать с порогами («' + f.name + ' ≤ t?»).');
      } else if (s.mode === 'cell') {
        const f = FEATURES[j];
        line(H('b', null, 'Одно значение. '), tex('x_{' + (i + 1) + (j + 1) + '} = ' + (f.kind === 'категориальный' ? '\\text{' + valOf(i, j) + '}' : valOf(i, j))), ' — признак «' + f.name + '» (j = ' + (j + 1) + ') у объекта №' + (i + 1) + ': ' + fmtVal(i, j) + '.');
        line('Первый индекс — номер объекта (строки), второй — номер признака (столбца). Так читается любая таблица данных: ', tex('x_{ij}'), '.');
      } else {
        line(H('b', null, 'Ответы (целевая переменная). '), tex('y = (' + FLATS.price.join(',\\ ') + ')'), ' — вектор из ', tex('n = ' + n), ' чисел.');
        line('Именно их модель учится предсказывать. Для обучающих объектов ответы известны — «учитель» их подсказал; для новых объектов ответы нам и нужны.');
      }
      GBC.math.render(descr);
      shape.textContent = '';
      shape.append('Размер данных: ', tex('n = ' + n), ' объектов, ', tex('d = ' + d), ' признака. Матрица признаков ', tex('X'), ' — ', tex(n + ' \\times ' + d), ', вектор ответов ', tex('y'), ' — ', tex(String(n)), ' чисел.');
    }
    GBC.bus.on('mathready', draw);
    w.pythonAction(() =>
      'import pandas as pd\n\ndf = pd.DataFrame({\n    "area": ' + JSON.stringify(FLATS.area) + ',          # площадь, м²\n    "floor": ' + JSON.stringify(FLATS.floor) + ',\n' +
      '    "district": ' + JSON.stringify(FLATS.district).replace(/","/g, '", "') + ',\n    "metro": ' + JSON.stringify(FLATS.metro) + ',          # до метро, мин\n    "price": ' + JSON.stringify(FLATS.price) + ',          # цена, млн — целевая переменная\n})\n' +
      'X = df.drop(columns="price")   # матрица признаков n × d\ny = df["price"]                # вектор ответов\nprint("X:", X.shape, " y:", y.shape)\n' +
      'print("объект №3:", X.iloc[2].tolist(), "→ ответ", y.iloc[2])\nprint("признак «этаж»:", X["floor"].tolist())\nprint("x_32 =", X.iloc[2, 1])\n'
    );
    draw();
  });

  /* =================================================================================
   * task-sorter — определите тип задачи
   * ================================================================================= */
  const TYPES = [
    { value: 'reg', label: 'Регрессия' },
    { value: 'bin', label: 'Бинарная классификация' },
    { value: 'multi', label: 'Многоклассовая' },
    { value: 'rank', label: 'Ранжирование' },
    { value: 'unsup', label: 'Без учителя' },
  ];
  const TASKS = [
    { q: 'Сколько минут займёт доставка заказа?', a: 'reg', why: 'Ответ — число на непрерывной шкале (минуты). Это регрессия.' },
    { q: 'Вернёт ли клиент кредит?', a: 'bin', why: 'Два исхода: «вернёт» и «не вернёт». Модель обычно выдаёт вероятность возврата.' },
    { q: 'Какая цифра от 0 до 9 написана на картинке?', a: 'multi', why: 'Десять классов, ровно один верный. Модель выдаёт 10 вероятностей с суммой 1.' },
    { q: 'В каком порядке показать товары по запросу «кроссовки»?', a: 'rank', why: 'Важно не само число для товара, а правильный порядок списка. Это ранжирование.' },
    { q: 'Разбить покупателей на группы с похожим поведением; какие группы бывают, заранее неизвестно.', a: 'unsup', why: 'Правильных ответов нет — нет и учителя. Это кластеризация, обучение без учителя.' },
    { q: 'Сколько электроэнергии потребит город завтра?', a: 'reg', why: 'Ответ — число (мегаватт-часы). Регрессия; бустинг здесь — частый выбор.' },
    { q: 'Мошенническая ли эта транзакция?', a: 'bin', why: 'Два класса: «мошенничество» или «нет». Классы сильно несбалансированы — об этом урок 10.2.' },
    { q: 'К какому из пяти жанров относится фильм (ровно один жанр)?', a: 'multi', why: 'Пять классов, один верный — многоклассовая классификация.' },
    { q: 'Найти необычные показания датчиков, если примеров поломок нет.', a: 'unsup', why: 'Размеченных поломок нет — ищем «непохожее на обычное». Это поиск аномалий без учителя.' },
    { q: 'Какова вероятность, что пользователь кликнет по рекламе?', a: 'bin', why: 'Исход — клик или не клик. Вероятность — это выход модели бинарной классификации.' },
    { q: 'Сколько единиц товара продаст магазин на следующей неделе?', a: 'reg', why: 'Число продаж — регрессия (иногда со специальными потерями для счётчиков, урок 5.3).' },
    { q: 'Какие пять статей первыми показать в ленте новостей пользователю?', a: 'rank', why: 'Нужен порядок статей для пользователя — ранжирование (урок 13.1).' },
  ];
  GBC.widget('task-sorter', (el) => {
    const s = { k: 0, answered: null, right: 0, done: 0 };
    const w = ui.shell(el, { title: 'Тренажёр: какой это тип задачи?', sub: 'Прочитайте задачу и выберите тип. После ответа появится объяснение.', noControls: true, foot: false });
    const card = H('div', { style: { padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface-2)', minHeight: '64px', fontSize: '1.05em' } });
    const btns = H('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '12px 0' } });
    const fb = H('p', { class: 'widget-note live' });
    const nav = H('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } });
    w.main.append(card, btns, fb, nav);
    const next = ui.button(nav, { label: 'Следующая задача →', kind: 'primary', small: true, onClick: () => go(s.k + 1) });
    ui.button(nav, { label: 'Заново', kind: 'ghost', small: true, onClick: () => ((s.right = 0), (s.done = 0), go(0)) });
    const score = H('span', { class: 'muted', style: { marginLeft: 'auto' } });
    nav.appendChild(score);
    const buttons = TYPES.map((t) => {
      const b = ui.button(btns, { label: t.label, small: true, onClick: () => answer(t.value) });
      return b;
    });
    function go(k) {
      s.k = k % TASKS.length;
      s.answered = null;
      draw();
    }
    function answer(v) {
      if (s.answered) return;
      s.answered = v;
      s.done += 1;
      if (v === TASKS[s.k].a) s.right += 1;
      draw();
    }
    function draw() {
      const t = TASKS[s.k];
      card.textContent = 'Задача ' + (s.k + 1) + ' из ' + TASKS.length + '. ' + t.q;
      buttons.forEach((b, i) => {
        const v = TYPES[i].value;
        b.disabled = !!s.answered;
        b.className = 'btn small' + (!s.answered ? '' : v === t.a ? ' primary' : s.answered === v ? '' : ' ghost');
        b.style.opacity = s.answered && v !== t.a && s.answered !== v ? '0.55' : '1';
      });
      if (!s.answered) fb.innerHTML = 'Выберите один из пяти типов.';
      else fb.innerHTML = (s.answered === t.a ? '<b>✓ Верно.</b> ' : '<b>✗ Не совсем:</b> правильный ответ — «' + TYPES.find((x) => x.value === t.a).label + '». ') + t.why;
      next.disabled = !s.answered;
      score.textContent = 'верно ' + s.right + ' из ' + s.done;
    }
    draw();
  });

  /* =================================================================================
   * data-source — данные как случайная выборка из источника y = f(x) + ε
   * ================================================================================= */
  GBC.widget('data-source', (el) => {
    const s = { noise: 0.4, n: 40, seed: 11, prev: true, truth: true };
    let prevSeed = null;
    const w = ui.shell(el, {
      title: 'Откуда берутся данные: y = f(x) + ε',
      sub: 'Где-то есть неизвестная закономерность f(x) (пунктир). Каждый объект — это f(x) плюс случайный шум ε (серые отрезки). Нажмите «Новая выборка» — те же правила, другие точки.',
    });
    ui.slider(w.controls, { label: 'Шум σ', min: 0, max: 1.2, step: 0.05, value: s.noise, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.noise = v), draw()) });
    ui.slider(w.controls, { label: 'Объектов n', min: 5, max: 200, step: 5, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Новая выборка', kind: 'primary', small: true, onClick: () => ((prevSeed = s.seed), (s.seed += 1), draw()) });
    ui.toggle(w.controls, { label: 'Истинная f(x)', checked: s.truth, onChange: (v) => ((s.truth = v), draw()) });
    ui.toggle(w.controls, { label: 'Предыдущая выборка', checked: s.prev, onChange: (v) => ((s.prev = v), draw()) });
    const plot = new GBC.Plot(w.main, {
      height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-2, 5.5] },
      table: () => {
        const d = sample(s.seed);
        return { columns: ['x', 'f(x)', 'шум ε', 'y = f(x) + ε'], rows: d.x.map((v, i) => [v, f(v), d.y[i] - f(v), d.y[i]]) };
      },
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [
      { key: 'seed', label: 'Номер выборки (seed)' },
      { key: 'eps', label: 'Средний квадрат шума' },
      { key: 's2', label: 'Дисперсия шума σ²' },
    ]);
    const f = (x) => GBC.datasets.trueFunction('wave', x);
    const sample = (seed) => GBC.datasets.regression1d({ kind: 'wave', n: s.n, noise: s.noise, seed });
    const gx = U.linspace(0, 10, 300);
    function draw() {
      const d = sample(s.seed);
      const layers = [];
      if (s.prev && prevSeed !== null) {
        const p = sample(prevSeed);
        layers.push({ type: 'points', x: p.x, y: p.y, color: 'model-prev', r: 3, opacity: 0.6, label: 'предыдущая выборка' });
      }
      if (s.truth) {
        layers.push({ type: 'segments', x1: d.x, y1: d.x.map(f), x2: d.x, y2: d.y, color: 'residual', opacity: 0.7 });
        layers.push({ type: 'line', x: gx, y: gx.map(f), color: 'truth', dash: '6 4', width: 2, label: 'истинная f(x)' });
      }
      layers.push({ type: 'points', x: d.x, y: d.y, color: 'data', r: 4, label: 'наблюдения y', tooltip: (i) => [{ label: 'x', value: U.fmt(d.x[i], 3) }, { label: 'f(x)', value: U.fmt(f(d.x[i]), 3) }, { label: 'шум ε', value: signed(d.y[i] - f(d.x[i])) }, { label: 'y', value: U.fmt(d.y[i], 3) }] });
      plot.render(layers);
      const eps2 = U.mean(d.x.map((v, i) => (d.y[i] - f(v)) ** 2));
      stats.set('seed', String(s.seed));
      stats.set('eps', U.fmt(eps2, 4));
      stats.set('s2', U.fmt(s.noise * s.noise, 4));
      note.innerHTML = s.noise === 0
        ? 'Шума нет: все точки лежат точно на f(x). Так в жизни не бывает — у цены квартиры всегда есть влияния, которых нет в таблице.'
        : 'Даже <b>идеальная</b> модель F = f ошибается на этих точках в среднем на ' + U.fmt(eps2, 3) + ' (в квадрате) — это шум, его нельзя предсказать по x. С ростом n средний квадрат шума приближается к σ² = ' + U.fmt(s.noise * s.noise, 3) + '. Цель обучения — найти f, а не повторить шум.';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets\n\n' +
      'X, y = datasets.regression_1d(kind="wave", n=' + s.n + ', noise=' + U.pyNum(s.noise) + ', seed=' + s.seed + ')\nf = datasets.true_function("wave", X[:, 0])   # sin(x) + 0.3·x\n' +
      'eps = y - f                                   # шум каждого объекта\nprint("средний квадрат шума:", np.mean(eps ** 2), " σ² =", ' + U.pyNum(s.noise) + ' ** 2)\n'
    );
    draw();
  });

  /* =================================================================================
   * error-table — ошибка руками: остатки, их квадраты и метрики
   * ================================================================================= */
  GBC.widget('error-table', (el) => {
    const x = FLATS.area;
    const s = { a: 0.2, b: -4, outlier: false, squares: true };
    const w = ui.shell(el, {
      title: 'Ошибка модели по шагам',
      sub: 'Модель — прямая F(x) = a·x + b. Для каждой квартиры считаем остаток r = y − F(x), его модуль и квадрат; метрики — их средние. Квадраты на графике — буквально r².',
    });
    const aCtl = ui.slider(w.controls, { label: 'Наклон a, млн за м²', min: 0, max: 0.4, step: 0.005, value: s.a, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.a = v), draw()) });
    const bCtl = ui.slider(w.controls, { label: 'Сдвиг b, млн', min: -10, max: 6, step: 0.05, value: s.b, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.b = v), draw()) });
    const presets = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(presets);
    ui.button(presets, { label: 'Правило 0.2·x − 4', small: true, onClick: () => set(0.2, -4) });
    ui.button(presets, { label: 'Лучшая прямая', small: true, kind: 'primary', onClick: () => { const o = bestLine(); set(o.a, o.b); } });
    ui.toggle(w.controls, { label: 'Выброс: квартира №6 «стоит» 30 млн', checked: s.outlier, onChange: (v) => ((s.outlier = v), draw()) });
    ui.toggle(w.controls, { label: 'Квадраты ошибок', checked: s.squares, onChange: (v) => ((s.squares = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'площадь, м²', domain: [20, 100] }, y: { label: 'цена, млн', domain: [-2, 16] } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [
      { key: 'mse', label: 'MSE = среднее r²' },
      { key: 'rmse', label: 'RMSE = √MSE' },
      { key: 'mae', label: 'MAE = среднее |r|' },
      { key: 'r2', label: 'R² = 1 − SSE / SSE₀' },
    ]);
    const Y = () => FLATS.price.map((v, i) => (s.outlier && i === 5 ? 30 : v));
    function set(a, b) {
      s.a = a;
      s.b = b;
      aCtl.set(a);
      bCtl.set(b);
      draw();
    }
    function bestLine() {
      const y = Y();
      const mx = U.mean(x);
      const my = U.mean(y);
      let sxy = 0;
      let sxx = 0;
      x.forEach((v, i) => ((sxy += (v - mx) * (y[i] - my)), (sxx += (v - mx) ** 2)));
      const a = sxy / sxx;
      return { a, b: my - a * mx };
    }
    function draw() {
      const y = Y();
      const F = x.map((v) => s.a * v + s.b);
      const r = y.map((v, i) => v - F[i]);
      const sse = U.sum(r.map((v) => v * v));
      const my = U.mean(y);
      const sse0 = U.sum(y.map((v) => (v - my) ** 2));
      const dom = s.outlier ? [-2, 33] : [-2, 16];
      const layers = [];
      if (s.squares) {
        // квадрат со стороной |r|: по вертикали |r| в единицах цены, по горизонтали — столько же пикселей
        const W = plot.frame.clientWidth || 600;
        const k = ((100 - 20) / (dom[1] - dom[0])) * (300 - 52) / Math.max(200, W - 64);
        r.forEach((v, i) => {
          if (Math.abs(v) < 1e-9) return;
          layers.push({ type: 'rect', x0: x[i], x1: x[i] + Math.abs(v) * k, y0: F[i], y1: y[i], fill: 'tree', opacity: 0.16, stroke: 'tree', width: 1 });
        });
      }
      layers.push({ type: 'segments', x1: x, y1: F, x2: x, y2: y, color: 'residual', width: 2, opacity: 0.9 });
      layers.push({ type: 'line', x: [20, 100], y: [20 * s.a + s.b, 100 * s.a + s.b], color: 'model', width: 2.4, label: 'F(x) = ' + U.fmt(s.a, 3) + '·x ' + (s.b < 0 ? '− ' : '+ ') + U.fmt(Math.abs(s.b), 2) });
      layers.push({ type: 'hline', y: my, color: 'ink2', dash: '4 4', width: 1, text: 'среднее ȳ = ' + U.fmt(my, 2) });
      layers.push({ type: 'points', x, y, color: 'data', r: 5.5, label: 'квартиры', tooltip: (i) => [{ label: '№', value: String(i + 1) }, { label: 'y', value: U.fmt(y[i], 2) }, { label: 'F(x)', value: U.fmt(F[i], 3) }, { label: 'r', value: signed(r[i]) }, { label: 'r²', value: U.fmt(r[i] * r[i], 3) }] });
      plot.render(layers, { y: dom });
      tableBox.textContent = '';
      const rows = x.map((v, i) => [i + 1, v, U.fmt(y[i], 2), U.fmt(F[i], 3), signed(r[i]), U.fmt(Math.abs(r[i]), 3), U.fmt(r[i] * r[i], 3)]);
      rows.push(['Σ', '', '', '', signed(U.sum(r)), U.fmt(U.sum(r.map(Math.abs)), 3), U.fmt(sse, 3)]);
      ui.table(tableBox, { columns: ['№', 'x, м²', 'y, млн', 'F(x)', 'r = y − F', '|r|', 'r²'], rows, highlight: (i) => i === rows.length - 1 });
      const n = x.length;
      const mse = sse / n;
      const mae = U.mean(r.map(Math.abs));
      stats.set('mse', U.fmt(mse, 4));
      stats.set('rmse', U.fmt(Math.sqrt(mse), 4) + ' млн');
      stats.set('mae', U.fmt(mae, 4) + ' млн');
      stats.set('r2', U.fmt(1 - sse / sse0, 4));
      const best = bestLine();
      const yb = x.map((v) => best.a * v + best.b);
      const sseBest = U.sum(y.map((v, i) => (v - yb[i]) ** 2));
      const gap = sse - sseBest;
      note.innerHTML = 'Сумма квадратов SSE = ' + U.fmt(sse, 3) + (gap < 1e-6 ? ' — <b>минимум</b> для прямых: это метод наименьших квадратов.' : '; у лучшей прямой ' + U.fmt(sseBest, 3) + '.') +
        ' Константа ȳ = ' + U.fmt(my, 2) + ' дала бы SSE₀ = ' + U.fmt(sse0, 3) + ', поэтому R² = 1 − ' + U.fmt(sse, 3) + ' / ' + U.fmt(sse0, 3) + ' = ' + U.fmt(1 - sse / sse0, 3) + '.' +
        (s.outlier ? ' <b>С выбросом</b> один большой остаток даёт почти весь SSE: RMSE раздувается сильнее, чем MAE.' : '');
    }
    w.pythonAction(() =>
      'import numpy as np\n\nx = np.array(' + JSON.stringify(x) + ', dtype=float)\ny = np.array(' + JSON.stringify(Y()) + ', dtype=float)\na, b = ' + U.pyNum(s.a) + ', ' + U.pyNum(s.b) + '\n\n' +
      'F = a * x + b\nr = y - F\nprint("остатки:", r)\nmse = np.mean(r ** 2)\nprint("MSE  =", mse)\nprint("RMSE =", np.sqrt(mse))\nprint("MAE  =", np.mean(np.abs(r)))\n' +
      'print("R²   =", 1 - np.sum(r ** 2) / np.sum((y - y.mean()) ** 2))\nprint("лучшая прямая (a, b):", np.polyfit(x, y, 1))\n'
    );
    draw();
  });

  /* =================================================================================
   * manual-fit — подберите модель руками; рельеф ошибки
   * ================================================================================= */
  GBC.widget('manual-fit', (el) => {
    const data = GBC.datasets.regression1d({ kind: 'wave', n: 40, noise: 0.4, seed: 11 });
    const x = data.x;
    const y = data.y;
    const s = { kind: 'const', c: 0.5, a: 0, b: 0.5, t: 3, c1: 0.5, c2: 2.5 };
    const w = ui.shell(el, {
      title: 'Подберите модель руками',
      sub: 'Двигайте ползунки и следите за MSE. Сверху — данные и модель, снизу — «рельеф ошибки»: MSE для всех значений параметров. Обучение — это поиск самой низкой точки рельефа.',
    });
    ui.segmented(w.controls, {
      label: 'Модель',
      options: [{ value: 'const', label: 'Константа' }, { value: 'line', label: 'Прямая' }, { value: 'stump', label: 'Ступенька' }],
      value: s.kind, onChange: (v) => ((s.kind = v), showCtl(), draw()),
    });
    const ctl = {
      c: ui.slider(w.controls, { label: 'c (уровень)', min: -1, max: 4, step: 0.01, value: s.c, onInput: (v) => ((s.c = v), draw()) }),
      a: ui.slider(w.controls, { label: 'a (наклон)', min: -0.5, max: 0.8, step: 0.005, value: s.a, onInput: (v) => ((s.a = v), draw()) }),
      b: ui.slider(w.controls, { label: 'b (сдвиг)', min: -2, max: 3, step: 0.01, value: s.b, onInput: (v) => ((s.b = v), draw()) }),
      t: ui.slider(w.controls, { label: 't (порог)', min: 0, max: 10, step: 0.05, value: s.t, onInput: (v) => ((s.t = v), draw()) }),
      c1: ui.slider(w.controls, { label: 'c₁ (слева от порога)', min: -1, max: 4, step: 0.01, value: s.c1, onInput: (v) => ((s.c1 = v), draw()) }),
      c2: ui.slider(w.controls, { label: 'c₂ (справа)', min: -1, max: 4, step: 0.01, value: s.c2, onInput: (v) => ((s.c2 = v), draw()) }),
    };
    const best = ui.button(w.controls, { label: 'Найти лучшие параметры', kind: 'primary', small: true, onClick: fitBest });
    best.style.alignSelf = 'flex-start';
    function showCtl() {
      const vis = { const: ['c'], line: ['a', 'b'], stump: ['t', 'c1', 'c2'] }[s.kind];
      for (const k of Object.keys(ctl)) ctl[k].el.hidden = !vis.includes(k);
    }
    const plot = new GBC.Plot(w.main, {
      height: 270, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-1.5, 4.5] },
      table: () => ({ columns: ['x', 'y', 'прогноз', 'ошибка²'], rows: x.map((v, i) => [v, y[i], F(v), (y[i] - F(v)) ** 2]) }),
    });
    const land = new GBC.Plot(w.main, { height: 230, x: { label: 'c' }, y: { label: 'MSE' }, crosshair: true });
    land.onClick = (px, py) => {
      if (s.kind !== 'line') return;
      s.a = U.clamp(px, -0.5, 0.8);
      s.b = U.clamp(py, -2, 3);
      ctl.a.set(s.a);
      ctl.b.set(s.b);
      draw();
    };
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [{ key: 'mse', label: 'MSE' }, { key: 'best', label: 'Лучшая MSE для этой модели' }, { key: 'k', label: 'Параметров' }]);
    const F = (v) => (s.kind === 'const' ? s.c : s.kind === 'line' ? s.a * v + s.b : v <= s.t ? s.c1 : s.c2);
    const mseOf = (fn) => U.mean(x.map((v, i) => (y[i] - fn(v)) ** 2));
    /** Лучшие уровни ступеньки при пороге t: средние слева и справа. */
    function stumpLevels(t) {
      const L = [];
      const R = [];
      x.forEach((v, i) => (v <= t ? L : R).push(y[i]));
      return { c1: L.length ? U.mean(L) : U.mean(R), c2: R.length ? U.mean(R) : U.mean(L) };
    }
    function optimum(kind) {
      if (kind === 'const') return { c: U.mean(y) };
      if (kind === 'line') {
        const mx = U.mean(x);
        const my = U.mean(y);
        let sxy = 0;
        let sxx = 0;
        x.forEach((v, i) => ((sxy += (v - mx) * (y[i] - my)), (sxx += (v - mx) * (v - mx))));
        const a = sxy / sxx;
        return { a, b: my - a * mx };
      }
      const tree = new GBC.RegressionTree({ maxDepth: 1 }).fit(data.X, y.map((v) => -v));
      const r = tree.nodes[0];
      return { t: r.threshold, c1: tree.nodes[r.left].value, c2: tree.nodes[r.right].value };
    }
    function fitBest() {
      const o = optimum(s.kind);
      for (const [k, v] of Object.entries(o)) {
        s[k] = v;
        ctl[k].set(v);
      }
      draw();
    }
    let lineGrid = null;
    function landscape(bestMse) {
      if (s.kind === 'const') {
        const cs = U.linspace(-1, 4, 201);
        land.opts.x.label = 'уровень c';
        land.opts.y.label = 'MSE';
        land.opts.y.domain = 'auto';
        land.opts.grid = 'both';
        land.render([
          { type: 'line', x: cs, y: cs.map((c) => mseOf(() => c)), color: 'model', label: 'MSE(c)' },
          { type: 'points', x: [optimum('const').c], y: [bestMse], color: 'tree', r: 5.5, label: 'минимум: c = ȳ' },
          { type: 'points', x: [s.c], y: [mseOf(F)], color: 'ink', r: 5, hollow: true, label: 'ваше c' },
        ], { x: [-1, 4] });
      } else if (s.kind === 'line') {
        land.opts.x.label = 'наклон a (клик — выбрать точку)';
        land.opts.y.label = 'сдвиг b';
        land.opts.grid = 'none';
        if (!lineGrid) lineGrid = GBC.Plot.grid((a, b) => Math.log(mseOf((v) => a * v + b)), -0.5, 0.8, -2, 3, 70, 70);
        const seq = GBC.colors.sequential();
        let lo = Infinity;
        let hi = -Infinity;
        for (const v of lineGrid.values) (lo = Math.min(lo, v)), (hi = Math.max(hi, v));
        const layers = [{ type: 'heatmap', grid: lineGrid, colorFn: (v) => seq(1 - (v - lo) / (hi - lo)), opacity: 0.6 }];
        for (const q of [0.15, 0.3, 0.45, 0.6, 0.75]) layers.push({ type: 'contour', grid: lineGrid, level: lo + q * (hi - lo), color: 'axis', width: 1 });
        const o = optimum('line');
        layers.push({ type: 'points', x: [o.a], y: [o.b], color: 'tree', r: 5.5, label: 'минимум MSE' });
        layers.push({ type: 'points', x: [s.a], y: [s.b], color: 'ink', r: 5, hollow: true, label: 'ваши (a, b)' });
        land.render(layers, { x: [-0.5, 0.8], y: [-2, 3] });
      } else {
        const ts = U.linspace(0, 10, 201);
        land.opts.x.label = 'порог t';
        land.opts.y.label = 'MSE';
        land.opts.y.domain = 'auto';
        land.opts.grid = 'both';
        const bestAt = ts.map((t) => {
          const o = stumpLevels(t);
          return mseOf((v) => (v <= t ? o.c1 : o.c2));
        });
        land.render([
          { type: 'line', x: ts, y: bestAt, color: 'model', curve: 'step', label: 'MSE при лучших c₁, c₂' },
          { type: 'points', x: [optimum('stump').t], y: [bestMse], color: 'tree', r: 5.5, label: 'минимум' },
          { type: 'points', x: [s.t], y: [mseOf(F)], color: 'ink', r: 5, hollow: true, label: 'ваши (t, c₁, c₂)' },
        ], { x: [0, 10] });
      }
    }
    function draw() {
      const pred = x.map(F);
      const gx = U.linspace(0, 10, 401);
      plot.render([
        { type: 'segments', x1: x, y1: y, x2: x, y2: pred, color: 'residual', opacity: 0.6 },
        { type: 'points', x, y, color: 'data', r: 4, label: 'данные', tooltip: (i) => [{ label: 'x', value: U.fmt(x[i], 2) }, { label: 'y', value: U.fmt(y[i], 2) }, { label: 'ошибка', value: U.fmt(y[i] - pred[i], 2) }] },
        { type: 'line', x: gx, y: gx.map(F), color: 'model', width: 2.4, label: 'модель F(x)' },
      ]);
      const cur = mseOf(F);
      const o = optimum(s.kind);
      const saved = Object.assign({}, s);
      Object.assign(s, o);
      const bestMse = mseOf(F);
      Object.assign(s, saved);
      landscape(bestMse);
      stats.set('mse', U.fmt(cur, 4));
      stats.set('best', U.fmt(bestMse, 4));
      stats.set('k', String({ const: 1, line: 2, stump: 3 }[s.kind]));
      const gap = cur - bestMse;
      const name = { const: 'константа', line: 'прямая', stump: 'ступенька' }[s.kind];
      const hint = {
        const: 'Рельеф — парабола с одним дном: лучшее c — среднее ȳ = ' + U.fmt(U.mean(y), 3) + '.',
        line: 'Рельеф — «чаша» над плоскостью (a, b): линии уровня — как горизонтали на карте, дно отмечено оранжевой точкой. Кликните по рельефу, чтобы поставить свою точку.',
        stump: 'Для каждого порога t лучшие уровни — средние y слева и справа. Остаётся перебрать пороги: рельеф по t — ступенчатый.',
      }[s.kind];
      note.innerHTML = (gap < 1e-4
        ? '✓ Это оптимум: лучше параметров для модели «' + name + '» нет. Попробуйте другую модель — у более гибкой оптимум ниже. '
        : 'До оптимума осталось снизить MSE на ' + U.fmt(gap, 3) + '. ') + hint;
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse import datasets, RegressionTree\n\nX, y = datasets.regression_1d(kind="wave", n=40, noise=0.4, seed=11)\nx = X[:, 0]\n\n' +
      'print("константа:  c =", y.mean(), " MSE =", np.mean((y - y.mean()) ** 2))\n' +
      'a, b = np.polyfit(x, y, 1)\nprint("прямая: a =", a, "b =", b, " MSE =", np.mean((y - (a * x + b)) ** 2))\n' +
      'stump = RegressionTree(max_depth=1).fit(X, -y)\nprint("ступенька: порог =", stump.nodes[0].threshold, " MSE =", np.mean((y - stump.predict(X)) ** 2))\n'
    );
    showCtl();
    draw();
  });

  /* =================================================================================
   * train-test — обучение и тест; разброс оценки по разбиениям
   * ================================================================================= */
  GBC.widget('train-test', (el) => {
    const data = GBC.datasets.regression1d({ kind: 'wave', n: 50, noise: 0.5, seed: 21 });
    const NOISE2 = 0.25;
    const SPLITS = 30;
    const s = { model: 'tree', depth: 3, M: 100, test: 0.3, seed: 0 };
    const w = ui.shell(el, {
      title: 'Обучение и тест: честная оценка',
      sub: 'Данные делятся случайно: синие точки — обучение (по ним подбираются параметры), бирюзовые квадраты — тест (их модель не видит). Справа — оценка на тесте для 30 разных разбиений тех же данных.',
    });
    ui.select(w.controls, {
      label: 'Модель',
      options: [{ value: 'const', label: 'Константа' }, { value: 'line', label: 'Прямая' }, { value: 'tree', label: 'Дерево' }, { value: 'gb', label: 'Бустинг (глубина 2, ν = 0.1)' }],
      value: s.model, onChange: (v) => ((s.model = v), sync(), redraw()),
    });
    const dCtl = ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 10, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), redraw()) });
    const mCtl = ui.slider(w.controls, { label: 'Деревьев M', min: 1, max: 300, step: 1, value: s.M, format: String, onInput: (v) => ((s.M = v), redraw()) });
    ui.slider(w.controls, { label: 'Доля теста', min: 0.1, max: 0.6, step: 0.05, value: s.test, format: (v) => Math.round(v * 100) + ' %', onInput: (v) => ((s.test = v), redraw()) });
    const seedCtl = ui.slider(w.controls, { label: 'Разбиение (seed)', min: 0, max: SPLITS - 1, step: 1, value: s.seed, format: String, onInput: (v) => ((s.seed = v), draw()) });
    ui.button(w.controls, { label: 'Перемешать заново', small: true, onClick: () => ((s.seed = (s.seed + 1) % SPLITS), seedCtl.set(s.seed), draw()) });
    function sync() {
      dCtl.el.hidden = s.model !== 'tree';
      mCtl.el.hidden = s.model !== 'gb';
    }
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y', domain: [-1.8, 4.6] } });
    const p2 = new GBC.Plot(box, { height: 300, x: { label: 'номер разбиения (seed)', domain: [-1, SPLITS] }, y: { label: 'MSE' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [
      { key: 'n', label: 'Обучение / тест' },
      { key: 'tr', label: 'MSE на обучении' },
      { key: 'te', label: 'MSE на тесте' },
      { key: 'rng', label: 'Тест по 30 разбиениям' },
    ]);
    const gx = U.linspace(0, 10, 400);
    /** Обучить выбранную модель; вернуть функцию прогноза для одного x. */
    function fit(Xtr, ytr) {
      if (s.model === 'const') {
        const c = U.mean(ytr);
        return () => c;
      }
      if (s.model === 'line') {
        const xs = Xtr.map((r) => r[0]);
        const mx = U.mean(xs);
        const my = U.mean(ytr);
        let sxy = 0;
        let sxx = 0;
        xs.forEach((v, i) => ((sxy += (v - mx) * (ytr[i] - my)), (sxx += (v - mx) ** 2)));
        const a = sxy / sxx;
        const b = my - a * mx;
        return (v) => a * v + b;
      }
      if (s.model === 'tree') {
        const t = new GBC.RegressionTree({ maxDepth: s.depth }).fit(Xtr, ytr.map((v) => -v));
        return (v) => t.predictOne([v]);
      }
      const g = new GBC.GradientBoosting({ nEstimators: s.M, learningRate: 0.1, maxDepth: 2 }).fit(Xtr, ytr);
      return (v) => g.predictRawOne([v]);
    }
    const mse = (ys, fn, Xs) => U.mean(ys.map((v, i) => (v - fn(Xs[i][0])) ** 2));
    let cache = null;
    function allSplits() {
      if (cache) return cache;
      const tr = [];
      const te = [];
      for (let k = 0; k < SPLITS; k++) {
        const sp = GBC.datasets.trainTestSplit(data.X, data.y, s.test, k);
        const fn = fit(sp.Xtrain, sp.ytrain);
        tr.push(mse(sp.ytrain, fn, sp.Xtrain));
        te.push(mse(sp.ytest, fn, sp.Xtest));
      }
      cache = { tr, te };
      return cache;
    }
    const redraw = U.rafThrottle(() => ((cache = null), draw()));
    function draw() {
      const sp = GBC.datasets.trainTestSplit(data.X, data.y, s.test, s.seed);
      const fn = fit(sp.Xtrain, sp.ytrain);
      const xtr = sp.Xtrain.map((r) => r[0]);
      const xte = sp.Xtest.map((r) => r[0]);
      p1.render([
        { type: 'line', x: gx, y: gx.map(fn), color: 'model', width: 2.4, curve: s.model === 'tree' || s.model === 'gb' ? 'step' : null, label: 'модель' },
        { type: 'points', x: xtr, y: sp.ytrain, color: 'train', r: 4, label: 'обучение (' + xtr.length + ')' },
        { type: 'points', x: xte, y: sp.ytest, color: 'test', r: 4.5, shape: 'square', label: 'тест (' + xte.length + ')', tooltip: (i) => [{ label: 'x', value: U.fmt(xte[i], 3) }, { label: 'y', value: U.fmt(sp.ytest[i], 3) }, { label: 'прогноз', value: U.fmt(fn(xte[i]), 3) }] },
      ]);
      const A = allSplits();
      const ks = U.range(SPLITS);
      p2.render([
        { type: 'hline', y: NOISE2, color: 'ink2', dash: '4 3', width: 1, text: 'шум σ² = 0.25' },
        { type: 'points', x: ks, y: A.tr, color: 'train', r: 3.2, label: 'обучение', tooltip: (i) => [{ label: 'seed', value: String(i) }, { label: 'MSE обучение', value: U.fmt(A.tr[i], 4) }] },
        { type: 'points', x: ks, y: A.te, color: 'test', r: 3.8, shape: 'square', label: 'тест', tooltip: (i) => [{ label: 'seed', value: String(i) }, { label: 'MSE тест', value: U.fmt(A.te[i], 4) }] },
        { type: 'vline', x: s.seed, color: 'ink', dash: '3 3', width: 1.2 },
      ], { y: [0, Math.max(...A.te, ...A.tr, NOISE2) * 1.12] });
      const trM = A.tr[s.seed];
      const teM = A.te[s.seed];
      const lo = Math.min(...A.te);
      const hi = Math.max(...A.te);
      stats.set('n', sp.ytrain.length + ' / ' + sp.ytest.length);
      stats.set('tr', U.fmt(trM, 4));
      stats.set('te', U.fmt(teM, 4));
      stats.set('rng', U.fmt(lo, 3) + ' … ' + U.fmt(hi, 3));
      const meanTr = U.mean(A.tr);
      const meanTe = U.mean(A.te);
      note.innerHTML = 'В среднем по 30 разбиениям: обучение ' + U.fmt(meanTr, 3) + ', тест <b>' + U.fmt(meanTe, 3) + '</b>. ' +
        (meanTr < meanTe * 0.6 ? 'Ошибка на обучении заметно <b>оптимистична</b>: модель подстроилась под свои точки. ' : '') +
        'Оценка на тесте из ' + sp.ytest.length + ' точек сильно зависит от разбиения (от ' + U.fmt(lo, 2) + ' до ' + U.fmt(hi, 2) + '): одному числу на маленьком тесте доверять нельзя.';
    }
    w.pythonAction(() => {
      const model = {
        const: 'c = ytr.mean()\npredict = lambda X: np.full(len(X), c)',
        line: 'a, b = np.polyfit(Xtr[:, 0], ytr, 1)\npredict = lambda X: a * X[:, 0] + b',
        tree: 'tree = RegressionTree(max_depth=' + s.depth + ').fit(Xtr, -ytr)\npredict = tree.predict',
        gb: 'gb = GBRegressor(n_estimators=' + s.M + ', learning_rate=0.1, max_depth=2).fit(Xtr, ytr)\npredict = gb.predict',
      }[s.model];
      return 'import numpy as np\nfrom gbcourse import datasets, RegressionTree, GBRegressor\nfrom gbcourse.metrics import mse\n\n' +
        'X, y = datasets.regression_1d(kind="wave", n=50, noise=0.5, seed=21)\ntest_mse = []\nfor seed in range(30):\n' +
        '    Xtr, Xte, ytr, yte = datasets.train_test_split(X, y, test_size=' + U.pyNum(s.test) + ', seed=seed)\n' +
        model.split('\n').map((l) => '    ' + l).join('\n') + '\n' +
        '    test_mse.append(mse(yte, predict(Xte)))\n    if seed == ' + s.seed + ':\n        print("seed ' + s.seed + ': обучение", mse(ytr, predict(Xtr)), " тест", test_mse[-1])\n' +
        'print(f"тест по 30 разбиениям: от {min(test_mse):.3f} до {max(test_mse):.3f}, среднее {np.mean(test_mse):.3f}")\n';
    });
    sync();
    draw();
  });
})();
