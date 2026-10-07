/* Урок 1.1 — обучение с учителем:
 *   data-anatomy — таблица данных: объект, признак, ячейка, ответы и их обозначения;
 *   task-sorter  — тренажёр «какой это тип задачи»;
 *   data-source  — откуда берутся данные: y = f(x) + ε;
 *   error-table  — ошибка руками: остатки, квадраты, MSE, RMSE, MAE, R²;
 *   manual-fit   — подбор параметров руками и «рельеф ошибки»;
 *   hidden-feature  — шум или закономерность: что модель видит, зависит от признаков;
 *   class-threshold — ошибка классификатора: порог, матрица ошибок, доля верных, полнота, точность;
 *   generalize      — обобщение: «зубрила», интерполяция и экстраполяция;
 *   train-test   — обучение и тест: честная оценка и её разброс. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  /** Формула KaTeX как элемент; до загрузки KaTeX — текст. */
  const tex = (src) => GBC.math.tex(src);
  const signed = (v, d = 3) => (v > 0 ? '+' : '') + U.fmt(v, d);
  /** Русское склонение: plural(1, 'тревога', 'тревоги', 'тревог') → «1 тревога». */
  const plural = (n, one, few, many) => {
    const m10 = n % 10;
    const m100 = n % 100;
    const w = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
    return n + ' ' + w;
  };

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
  /* =================================================================================
   * hidden-feature — что шум, а что закономерность, зависит от признаков
   * ================================================================================= */
  /** Наименьшие квадраты для F = c0·col0 + c1·col1 + … + b (нормальные уравнения, метод Гаусса). */
  function lstsq(cols, y) {
    const n = y.length;
    const A = cols.map((c) => c.slice()).concat([new Array(n).fill(1)]);
    const k = A.length;
    const M = [];
    for (let p = 0; p < k; p++) {
      const row = [];
      for (let q = 0; q < k; q++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += A[p][i] * A[q][i];
        row.push(s);
      }
      let s = 0;
      for (let i = 0; i < n; i++) s += A[p][i] * y[i];
      row.push(s);
      M.push(row);
    }
    for (let p = 0; p < k; p++) {
      let piv = p;
      for (let r = p + 1; r < k; r++) if (Math.abs(M[r][p]) > Math.abs(M[piv][p])) piv = r;
      [M[p], M[piv]] = [M[piv], M[p]];
      for (let r = 0; r < k; r++) {
        if (r === p) continue;
        const f = M[r][p] / M[p][p];
        for (let q = p; q <= k; q++) M[r][q] -= f * M[p][q];
      }
    }
    return M.map((row, p) => row[k] / row[p]);
  }

  GBC.widget('hidden-feature', (el) => {
    const s = { n: 60, k: 0.15, noise: 0.5, seed: 3, both: false };
    const w = ui.shell(el, {
      title: 'Шум или закономерность? Зависит от признаков',
      sub: 'Цена квартиры = 0.12·площадь + 3 − k·(минут до метро) + шум ε. Модель «только площадь» не видит метро — и его влияние для неё выглядит шумом. Справа — остатки модели против времени до метро.',
    });
    ui.segmented(w.controls, {
      label: 'Модель знает',
      options: [{ value: 'one', label: 'Только площадь' }, { value: 'both', label: 'Площадь и метро' }],
      value: 'one', onChange: (v) => ((s.both = v === 'both'), draw()),
    });
    ui.slider(w.controls, { label: 'Влияние метро k, млн за минуту', min: 0, max: 0.3, step: 0.01, value: s.k, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.k = v), draw()) });
    ui.slider(w.controls, { label: 'Настоящий шум σ', min: 0, max: 1.2, step: 0.05, value: s.noise, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.noise = v), draw()) });
    ui.slider(w.controls, { label: 'Квартир n', min: 20, max: 300, step: 10, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Новая выборка', small: true, onClick: () => ((s.seed += 1), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, {
      height: 290, x: { label: 'площадь, м²', domain: [25, 105] }, y: { label: 'цена, млн' },
      table: () => {
        const d = gen();
        return { columns: ['площадь, м²', 'до метро, мин', 'цена, млн'], rows: d.area.map((v, i) => [v, d.metro[i], d.y[i]]) };
      },
    });
    const p2 = new GBC.Plot(box, { height: 290, x: { label: 'до метро, мин', domain: [0, 32] }, y: { label: 'остаток r = y − F(x)' } });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [
      { key: 'one', label: 'MSE: только площадь' },
      { key: 'both', label: 'MSE: площадь и метро' },
      { key: 's2', label: 'Настоящий шум σ²' },
    ]);
    /** Порядок вызовов ГПСЧ на квартиру: площадь → метро → шум (как в Python-коде). */
    function gen() {
      const rng = new GBC.RNG(s.seed);
      const area = [];
      const metro = [];
      const y = [];
      for (let i = 0; i < s.n; i++) {
        const a = rng.uniform(30, 100);
        const m = rng.uniform(2, 30);
        const e = rng.normal();
        area.push(a);
        metro.push(m);
        y.push(0.12 * a + 3 - s.k * m + s.noise * e);
      }
      return { area, metro, y };
    }
    function draw() {
      const d = gen();
      const c1 = lstsq([d.area], d.y);
      const c2 = lstsq([d.area, d.metro], d.y);
      const F1 = d.area.map((a) => c1[0] * a + c1[1]);
      const F2 = d.area.map((a, i) => c2[0] * a + c2[1] * d.metro[i] + c2[2]);
      const F = s.both ? F2 : F1;
      const r = d.y.map((v, i) => v - F[i]);
      const mse1 = U.mean(d.y.map((v, i) => (v - F1[i]) ** 2));
      const mse2 = U.mean(d.y.map((v, i) => (v - F2[i]) ** 2));
      const ax = [25, 105];
      const L1 = [];
      if (s.both) {
        L1.push({ type: 'line', x: ax, y: ax.map((a) => c2[0] * a + c2[1] * 5 + c2[2]), color: 'model', width: 2.2, label: 'F при 5 мин до метро' });
        L1.push({ type: 'line', x: ax, y: ax.map((a) => c2[0] * a + c2[1] * 25 + c2[2]), color: 'model-prev', width: 2.2, dash: '6 4', label: 'F при 25 мин' });
      } else {
        L1.push({ type: 'line', x: ax, y: ax.map((a) => c1[0] * a + c1[1]), color: 'model', width: 2.2, label: 'F(площадь)' });
      }
      L1.push({ type: 'points', x: d.area, y: d.y, color: 'data', r: 4, label: 'квартиры', tooltip: (i) => [{ label: 'площадь', value: U.fmt(d.area[i], 1) + ' м²' }, { label: 'метро', value: U.fmt(d.metro[i], 1) + ' мин' }, { label: 'цена', value: U.fmt(d.y[i], 2) }, { label: 'остаток', value: signed(r[i], 2) }] });
      p1.render(L1);
      // тренд остатков по метро: если он есть, это не шум, а неучтённая закономерность
      const tr = lstsq([d.metro], r);
      const L2 = [
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'segments', x1: d.metro, y1: r.map(() => 0), x2: d.metro, y2: r, color: 'residual', opacity: 0.5 },
        { type: 'points', x: d.metro, y: r, color: 'data', r: 4, label: 'остатки', tooltip: (i) => [{ label: 'метро', value: U.fmt(d.metro[i], 1) + ' мин' }, { label: 'остаток', value: signed(r[i], 2) }] },
        { type: 'line', x: [0, 32], y: [tr[1], 32 * tr[0] + tr[1]], color: 'tree', width: 2, label: 'тренд остатков' },
      ];
      if (s.noise > 0) {
        L2.push({ type: 'hline', y: s.noise, color: 'ink2', dash: '4 4', width: 1, text: '±σ' });
        L2.push({ type: 'hline', y: -s.noise, color: 'ink2', dash: '4 4', width: 1 });
      }
      const lim = Math.max(1, ...r.map(Math.abs)) * 1.1;
      p2.render(L2, { y: [-lim, lim] });
      stats.set('one', U.fmt(mse1, 3));
      stats.set('both', U.fmt(mse2, 3));
      stats.set('s2', U.fmt(s.noise * s.noise, 3));
      note.innerHTML = s.both
        ? 'Модель видит метро: остатки справа больше не зависят от времени до метро (тренд почти горизонтален), их разброс — около σ. MSE = ' + U.fmt(mse2, 3) + ' — близко к настоящему шуму σ² = ' + U.fmt(s.noise * s.noise, 3) + '. Лучше уже не сделать: оставшееся — по-настоящему непредсказуемое.'
        : 'Модель знает только площадь. Остатки справа <b>падают</b> с ростом времени до метро: это закономерность, а не шум, — просто модели её не показали. MSE = ' + U.fmt(mse1, 3) + ', хотя настоящий шум σ² = ' + U.fmt(s.noise * s.noise, 3) + '. Переключите модель на «Площадь и метро».';
    }
    w.pythonAction(() =>
      'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\n' +
      'rng = Mulberry32(' + s.seed + ')\nrows = []\nfor _ in range(' + s.n + '):\n    area = rng.uniform(30, 100)\n    metro = rng.uniform(2, 30)\n    eps = rng.normal()\n' +
      '    rows.append((area, metro, 0.12 * area + 3 - ' + U.pyNum(s.k) + ' * metro + ' + U.pyNum(s.noise) + ' * eps))\n' +
      'area, metro, y = np.array(rows).T\n\n' +
      'for name, cols in [("только площадь", [area]), ("площадь и метро", [area, metro])]:\n' +
      '    A = np.column_stack(cols + [np.ones_like(y)])\n    coef, *_ = np.linalg.lstsq(A, y, rcond=None)\n' +
      '    print(f"{name:16s} MSE = {np.mean((y - A @ coef) ** 2):.3f}   коэффициенты: {np.round(coef, 3)}")\n' +
      'print("настоящий шум σ² =", ' + U.pyNum(s.noise) + ' ** 2)\n'
    );
    draw();
  });

  /* =================================================================================
   * class-threshold — ошибка классификатора: порог, матрица ошибок, доля верных
   * ================================================================================= */
  const CREDIT = {
    x: [12, 18, 25, 30, 34, 41, 47, 52, 58, 63, 71, 80],
    y: [0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1],
  };
  /** 48 обычных операций (floor(uniform(5, 75)), seed = 4) и 2 мошеннические: 61.5 и 86.5. */
  function fraudData() {
    const rng = new GBC.RNG(4);
    const pts = [];
    for (let i = 0; i < 48; i++) pts.push([Math.floor(rng.uniform(5, 75)), 0]);
    pts.push([61.5, 1], [86.5, 1]);
    pts.sort((a, b) => a[0] - b[0]);
    return { x: pts.map((p) => p[0]), y: pts.map((p) => p[1]) };
  }
  GBC.widget('class-threshold', (el) => {
    const SETS = {
      credit: Object.assign({ feat: 'платежи по кредитам, % дохода', c0: 'вернул', c1: 'не вернул', t: 50 }, CREDIT),
      fraud: Object.assign({ feat: 'подозрительность операции, баллы', c0: 'обычная', c1: 'мошенничество', t: 101 }, fraudData()),
    };
    const s = { set: 'credit', t: 50 };
    const D = () => SETS[s.set];
    const w = ui.shell(el, {
      title: 'Ошибка классификатора: порог и матрица ошибок',
      sub: 'Правило: «если признак ≥ t — прогноз „класс 1“». Перетащите вертикальную линию порога. Точки с чёрным кольцом — ошибки модели.',
    });
    ui.segmented(w.controls, {
      label: 'Данные',
      options: [{ value: 'credit', label: '12 заёмщиков' }, { value: 'fraud', label: '50 операций' }],
      value: s.set, onChange: (v) => ((s.set = v), setT(D().t)),
    });
    const tCtl = ui.slider(w.controls, { label: 'Порог t', min: 0, max: 101, step: 0.5, value: s.t, format: (v) => (v > 100 ? 'выше всех' : U.fmt(v, 1)), onInput: (v) => ((s.t = v), draw()) });
    const presets = H('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
    w.controls.appendChild(presets);
    ui.button(presets, { label: 'Всем «класс 0»', small: true, onClick: () => setT(101) });
    ui.button(presets, { label: 'Лучший порог', small: true, kind: 'primary', onClick: () => setT(bestT()) });
    const plot = new GBC.Plot(w.main, {
      height: 230, x: { label: 'признак x' }, y: { label: 'класс' },
      table: () => ({ columns: ['x', 'класс y', 'прогноз', 'верно?'], rows: D().x.map((v, i) => [v, D().y[i], pred(v), pred(v) === D().y[i] ? 'да' : 'нет']) }),
    });
    const cm = H('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start', marginTop: '8px' } });
    w.main.appendChild(cm);
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [
      { key: 'acc', label: 'Доля верных (accuracy)' },
      { key: 'base', label: 'Базовая: всем частый класс' },
      { key: 'rec', label: 'Полнота: поймано из класса 1' },
      { key: 'prec', label: 'Точность: верно среди «1»' },
    ]);
    const pred = (v) => (v >= s.t ? 1 : 0);
    function setT(t) {
      s.t = t;
      tCtl.set(t);
      draw();
    }
    function counts(t) {
      const d = D();
      const c = { tp: 0, fp: 0, fn: 0, tn: 0 };
      d.x.forEach((v, i) => {
        const p = v >= t ? 1 : 0;
        if (p === 1 && d.y[i] === 1) c.tp++;
        else if (p === 1) c.fp++;
        else if (d.y[i] === 1) c.fn++;
        else c.tn++;
      });
      return c;
    }
    /** Порог с наибольшей долей верных: перебираем середины между соседними значениями. */
    function bestT() {
      const xs = [...new Set(D().x)].sort((a, b) => a - b);
      const cand = [xs[0]].concat(xs.slice(1).map((v, i) => (v + xs[i]) / 2), [101]);
      let best = cand[0];
      let bestAcc = -1;
      for (const t of cand) {
        const c = counts(t);
        const acc = c.tp + c.tn;
        if (acc > bestAcc) (bestAcc = acc), (best = t);
      }
      return Math.round(best * 2) / 2;
    }
    function draw() {
      const d = D();
      const n = d.x.length;
      // одинаковые x раздвигаем по вертикали, чтобы точки не слипались
      const seen = {};
      const yy = d.x.map((v, i) => {
        const key = d.y[i] + ':' + v;
        seen[key] = (seen[key] || 0) + 1;
        return d.y[i] + (seen[key] - 1) * 0.12;
      });
      const wrong = new Set(d.x.map((v, i) => i).filter((i) => pred(d.x[i]) !== d.y[i]));
      const idx0 = U.range(n).filter((i) => d.y[i] === 0);
      const idx1 = U.range(n).filter((i) => d.y[i] === 1);
      const sub = (idx, arr) => idx.map((i) => arr[i]);
      const hl = (idx) => new Set(idx.map((i, k) => (wrong.has(i) ? k : -1)).filter((k) => k >= 0));
      const tip = (idx) => (k) => {
        const i = idx[k];
        return [{ label: 'x', value: U.fmt(d.x[i], 1) }, { label: 'на самом деле', value: d.y[i] ? d.c1 : d.c0 }, { label: 'прогноз', value: pred(d.x[i]) ? d.c1 : d.c0 }];
      };
      const tt = Math.min(s.t, 100);
      plot.opts.x.label = d.feat;
      plot.render([
        { type: 'vband', x0: tt, x1: 100, color: 'class1', opacity: 0.1 },
        { type: 'text', x: Math.min(tt + 1, 97), y: 1.42, text: s.t > 100 ? '' : 'прогноз «' + d.c1 + '» →' },
        { type: 'points', x: sub(idx0, d.x), y: sub(idx0, yy), color: 'class0', r: 6, label: 'класс 0: ' + d.c0, highlight: hl(idx0), tooltip: tip(idx0) },
        { type: 'points', x: sub(idx1, d.x), y: sub(idx1, yy), color: 'class1', r: 6, shape: 'square', label: 'класс 1: ' + d.c1, highlight: hl(idx1), tooltip: tip(idx1) },
        { type: 'vline', x: tt, color: 'ink', width: 2, dash: '5 3', draggable: true, onDrag: (v) => ((s.t = Math.round(U.clamp(v, 0, 100) * 2) / 2), tCtl.set(s.t), draw()) },
      ], { x: [0, 100], y: [-0.5, 1.6] });
      // матрица ошибок
      const c = counts(s.t);
      const cell = (v, ok, name) => H('td', { class: 'num', style: { background: ok ? 'var(--good-soft)' : 'var(--warn-soft)', fontWeight: 650, minWidth: '92px' } }, String(v), H('br'), H('span', { class: 'muted', style: { fontWeight: 400, fontSize: '0.85em' } }, name));
      const t = H('table', { class: 'data' },
        H('thead', null, H('tr', null, H('th', null, 'на самом деле ↓ / прогноз →'), H('th', { class: 'num' }, '0: ' + d.c0), H('th', { class: 'num' }, '1: ' + d.c1))),
        H('tbody', null,
          H('tr', null, H('th', null, '0: ' + d.c0), cell(c.tn, true, 'верно (TN)'), cell(c.fp, false, 'ложная тревога (FP)')),
          H('tr', null, H('th', null, '1: ' + d.c1), cell(c.fn, false, 'пропуск (FN)'), cell(c.tp, true, 'попадание (TP)'))));
      cm.replaceChildren(H('div', { class: 'table-wrap', style: { margin: 0 } }, t));
      const acc = (c.tp + c.tn) / n;
      const n1 = c.tp + c.fn;
      const base = Math.max(n1, n - n1) / n;
      const rec = n1 ? c.tp / n1 : NaN;
      const prec = c.tp + c.fp ? c.tp / (c.tp + c.fp) : NaN;
      const pct = (v) => (Number.isNaN(v) ? '—' : U.fmt(100 * v, 1) + ' %');
      stats.set('acc', (c.tp + c.tn) + ' из ' + n + ' = ' + pct(acc));
      stats.set('base', pct(base));
      stats.set('rec', c.tp + ' из ' + n1 + ' = ' + pct(rec));
      stats.set('prec', c.tp + c.fp ? c.tp + ' из ' + (c.tp + c.fp) + ' = ' + pct(prec) : '— (никого не назвали «1»)');
      let msg = 'Ошибок: ' + (c.fp + c.fn) + ' — ' + plural(c.fp, 'ложная тревога', 'ложные тревоги', 'ложных тревог') + ' и ' + plural(c.fn, 'пропуск', 'пропуска', 'пропусков') + '. ';
      if (acc <= base + 1e-9) msg += '<b>Доля верных не выше базовой</b> (' + pct(base) + '): правило «всем частый класс» не хуже. ';
      else msg += 'Это лучше базовой модели «всем частый класс» (' + pct(base) + '). ';
      if (s.set === 'fraud') msg += 'Классы несбалансированы: 48 обычных операций и 2 мошеннические. Модель «всё обычное» верна в 96 % случаев, но не ловит ни одного мошенника — доля верных здесь обманывает, смотрите на полноту и точность.';
      else msg += 'Сдвигая порог, вы меняете ошибки одного вида на ошибки другого: ниже порог — больше ложных тревог, выше — больше пропусков.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const d = D();
      const data = s.set === 'credit'
        ? 'x = np.array(' + JSON.stringify(d.x) + ')   # ' + d.feat + '\ny = np.array(' + JSON.stringify(d.y) + ')    # 1 — ' + d.c1 + '\n'
        : 'from gbcourse.rng import Mulberry32\n\nrng = Mulberry32(4)\nx = [int(rng.uniform(5, 75)) for _ in range(48)] + [61.5, 86.5]   # ' + d.feat + '\ny = [0] * 48 + [1, 1]                                            # 1 — мошенничество\norder = np.argsort(x, kind="stable")\nx, y = np.array(x)[order], np.array(y)[order]\n';
      return 'import numpy as np\nfrom sklearn.metrics import accuracy_score, confusion_matrix, precision_score, recall_score\n\n' + data +
        't = ' + U.pyNum(s.t) + '\npred = (x >= t).astype(int)              # правило: признак ≥ t → класс 1\n\n' +
        'print("матрица ошибок [[TN, FP], [FN, TP]]:\\n", confusion_matrix(y, pred, labels=[0, 1]))\n' +
        'print("доля верных:", accuracy_score(y, pred))\nprint("базовая (всем частый класс):", max(y.mean(), 1 - y.mean()))\n' +
        'print("полнота:", recall_score(y, pred, zero_division=0), " точность:", precision_score(y, pred, zero_division=0))\n';
    });
    draw();
  });

  /* =================================================================================
   * generalize — обобщение: зубрила, интерполяция и экстраполяция
   * ================================================================================= */
  GBC.widget('generalize', (el) => {
    const train = GBC.datasets.regression1d({ kind: 'wave', n: 40, noise: 0.4, seed: 11 });
    const fresh = GBC.datasets.regression1d({ kind: 'wave', n: 70, noise: 0.4, seed: 12, xMin: 0, xMax: 14 });
    const XMAX = 10;
    const s = { model: 'nn', depth: 3, fresh: true, truth: false };
    const w = ui.shell(el, {
      title: 'Обобщение: внутри и за пределами знакомого',
      sub: 'Модель обучена на 40 синих точках с x от 0 до 10 (затенённая область). Бирюзовые квадраты — 70 новых объектов из того же источника, в том числе с x от 10 до 14, где модель не видела ни одного примера.',
    });
    ui.select(w.controls, {
      label: 'Модель',
      options: [
        { value: 'nn', label: '«Зубрила» (сосед)' },
        { value: 'const', label: 'Константа' },
        { value: 'line', label: 'Прямая' },
        { value: 'tree', label: 'Дерево' },
        { value: 'gb', label: 'Бустинг (100 деревьев)' },
      ],
      value: s.model, onChange: (v) => ((s.model = v), sync(), draw()),
    });
    const dCtl = ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 8, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    ui.toggle(w.controls, { label: 'Новые объекты', checked: s.fresh, onChange: (v) => ((s.fresh = v), draw()) });
    ui.toggle(w.controls, { label: 'Истинная f(x)', checked: s.truth, onChange: (v) => ((s.truth = v), draw()) });
    const sync = () => (dCtl.el.hidden = s.model !== 'tree');
    const plot = new GBC.Plot(w.main, {
      height: 320, x: { label: 'x', domain: [0, 14] }, y: { label: 'y', domain: [-1.6, 6.6] },
      table: () => ({ columns: ['x', 'y', 'прогноз', 'область'], rows: fresh.x.map((v, i) => [v, fresh.y[i], model()(v), v <= XMAX ? 'знакомая' : 'новая']) }),
    });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [
      { key: 'tr', label: 'MSE на обучении' },
      { key: 'in', label: 'Новые, x ≤ 10' },
      { key: 'out', label: 'Новые, x > 10' },
    ]);
    const f = (x) => GBC.datasets.trueFunction('wave', x);
    let cached = null;
    function model() {
      const key = s.model + ':' + s.depth;
      if (cached && cached.key === key) return cached.fn;
      let fn;
      if (s.model === 'nn') {
        fn = (v) => {
          let bi = 0;
          for (let i = 1; i < train.x.length; i++) if (Math.abs(train.x[i] - v) < Math.abs(train.x[bi] - v)) bi = i;
          return train.y[bi];
        };
      } else if (s.model === 'const') {
        const c = U.mean(train.y);
        fn = () => c;
      } else if (s.model === 'line') {
        const [a, b] = lstsq([train.x], train.y);
        fn = (v) => a * v + b;
      } else if (s.model === 'tree') {
        const t = new GBC.RegressionTree({ maxDepth: s.depth }).fit(train.X, train.y.map((v) => -v));
        fn = (v) => t.predictOne([v]);
      } else {
        const g = new GBC.GradientBoosting({ nEstimators: 100, learningRate: 0.1, maxDepth: 2 }).fit(train.X, train.y);
        fn = (v) => g.predictRawOne([v]);
      }
      cached = { key, fn };
      return fn;
    }
    const gx = U.linspace(0, 14, 561);
    function draw() {
      const fn = model();
      const mseOn = (xs, ys) => (xs.length ? U.mean(xs.map((v, i) => (ys[i] - fn(v)) ** 2)) : NaN);
      const inI = U.range(fresh.x.length).filter((i) => fresh.x[i] <= XMAX);
      const outI = U.range(fresh.x.length).filter((i) => fresh.x[i] > XMAX);
      const pick = (idx, arr) => idx.map((i) => arr[i]);
      const layers = [
        { type: 'vband', x0: 0, x1: XMAX, color: 'train', opacity: 0.06 },
        { type: 'text', x: 13.9, y: 6.2, anchor: 'end', text: 'здесь примеров не было' },
      ];
      if (s.truth) layers.push({ type: 'line', x: gx, y: gx.map(f), color: 'truth', dash: '6 4', width: 2, label: 'истинная f(x)' });
      layers.push({ type: 'points', x: train.x, y: train.y, color: 'train', r: 4, label: 'обучение (40)' });
      if (s.fresh) layers.push({ type: 'points', x: fresh.x, y: fresh.y, color: 'test', r: 4, shape: 'square', label: 'новые объекты (70)', tooltip: (i) => [{ label: 'x', value: U.fmt(fresh.x[i], 2) }, { label: 'y', value: U.fmt(fresh.y[i], 2) }, { label: 'прогноз', value: U.fmt(fn(fresh.x[i]), 2) }] });
      layers.push({ type: 'line', x: gx, y: gx.map(fn), color: 'model', width: 2.4, curve: s.model === 'line' || s.model === 'const' ? null : 'step', label: 'модель' });
      plot.render(layers);
      const tr = U.mean(train.x.map((v, i) => (train.y[i] - fn(v)) ** 2));
      const mi = mseOn(pick(inI, fresh.x), pick(inI, fresh.y));
      const mo = mseOn(pick(outI, fresh.x), pick(outI, fresh.y));
      stats.set('tr', U.fmt(tr, 3));
      stats.set('in', U.fmt(mi, 3) + ' (' + inI.length + ' точек)');
      stats.set('out', U.fmt(mo, 3) + ' (' + outI.length + ' точек)');
      const txt = {
        nn: '«Зубрила» отвечает ответом ближайшего обучающего примера. Она помнит все ответы, поэтому на обучении ошибка ровно 0. На новых точках она повторяет шум соседа: ошибка около удвоенного шума 2σ² = 0.32. За пределами x = 10 она бесконечно повторяет ответ последнего примера.',
        const: 'Константа одинаково (плохо) работает везде — она ничего не выучила. Это базовая планка.',
        line: 'Прямая хуже деревьев внутри знакомой области (волну она не видит), зато продолжает общий рост и <b>лучше всех</b> за её пределами: её форма совпадает с трендом данных.',
        tree: 'Дерево хорошо обобщает внутри области обучения, но справа от x = 10 его прогноз — <b>константа</b> последнего листа: дерево не умеет продолжать тренд (экстраполировать).',
        gb: 'Бустинг — сумма деревьев, поэтому за пределами знакомой области он тоже «замирает»: внутри — лучший, снаружи — плато. Это свойство всех моделей на деревьях.',
      }[s.model];
      note.innerHTML = txt + ' Ошибка на новых точках: внутри ' + U.fmt(mi, 3) + ', снаружи ' + U.fmt(mo, 3) + '.';
    }
    w.pythonAction(() => {
      const m = {
        nn: 'def predict(X):                                  # «зубрила»: ответ ближайшего примера\n    idx = np.abs(X[:, :1] - Xtr[:, 0]).argmin(axis=1)\n    return ytr[idx]',
        const: 'predict = lambda X: np.full(len(X), ytr.mean())',
        line: 'a, b = np.polyfit(Xtr[:, 0], ytr, 1)\npredict = lambda X: a * X[:, 0] + b',
        tree: 'predict = RegressionTree(max_depth=' + s.depth + ').fit(Xtr, -ytr).predict',
        gb: 'predict = GBRegressor(n_estimators=100, learning_rate=0.1, max_depth=2).fit(Xtr, ytr).predict',
      }[s.model];
      return 'import numpy as np\nfrom gbcourse import datasets, RegressionTree, GBRegressor\nfrom gbcourse.metrics import mse\n\n' +
        'Xtr, ytr = datasets.regression_1d(kind="wave", n=40, noise=0.4, seed=11)                 # x от 0 до 10\nXnew, ynew = datasets.regression_1d(kind="wave", n=70, noise=0.4, seed=12, x_min=0, x_max=14)\n\n' +
        m + '\n\ninside = Xnew[:, 0] <= 10\nprint("обучение:", mse(ytr, predict(Xtr)))\nprint("новые, x ≤ 10:", mse(ynew[inside], predict(Xnew[inside])))\nprint("новые, x > 10:", mse(ynew[~inside], predict(Xnew[~inside])))\n';
    });
    sync();
    draw();
  });
})();
