/* Урок 15.20: теория чисел. Часть 2 — сравнения по модулю, простота и криптография.
 * Виджеты: часы и классы вычетов; таблицы сложения и умножения по модулю; таблица умножения на окружности;
 * линейные сравнения; циклы степеней и порядок; доказательство малой теоремы Ферма перестановкой;
 * функция Эйлера; быстрое возведение в степень; китайская теорема об остатках; квадраты по модулю и суммы
 * двух квадратов; тесты Ферма и Миллера — Рабина; RSA; обмен ключами Диффи — Хеллмана.
 * Помощники — из GBC.lesson1520 (часть 1, lesson.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const {
    f2, f3, grp, pct, plural, minus, sup, SER, cvar, tint, flexRow, card, cardGrid, badge, chip, rowTable, monoBox, svgBox, sText, legendRow, intField, textField,
    mod, gcd, lcm, extGcd, invMod, divisors, factorize, fstr, phi, sieveTo, primesTo, mulmod, powmod, strongProbable, isPrime,
  } = GBC.lesson1520;
  const order = (a, m) => {
    if (gcd(a, m) !== 1) return 0;
    let k = 1;
    let x = mod(a, m);
    while (x !== 1 % m) (x = mulmod(x, a, m)), k++;
    return k;
  };
  const units = (m) => U.range(m).filter((r) => gcd(r, m) === 1);
  /** Точка на окружности: k-е из m делений, 0 — сверху, по часовой стрелке. */
  const onCircle = (k, m, r = 1) => [r * Math.sin((2 * Math.PI * k) / m), r * Math.cos((2 * Math.PI * k) / m)];

  /* ==============================================================================
   * 16. Часы и классы вычетов
   * ============================================================================== */
  GBC.widget('clock-mod', (el) => {
    const s = { m: 12, a: 9, b: 5, op: '+' };
    const w = ui.shell(el, { title: 'Часы: арифметика по модулю m', sub: 'На циферблате с m делениями после m − 1 снова идёт 0. Сложение — шаги по кругу; результат — остаток от деления на m. Снизу — числовая прямая, раскрашенная по классам остатков.' });
    ui.slider(w.controls, { label: 'Модуль m', min: 2, max: 24, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'a', min: -20, max: 40, step: 1, value: s.a, format: minus, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'b', min: 0, max: 40, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.segmented(w.controls, { label: 'Операция', value: s.op, options: [{ value: '+', label: 'a + b' }, { value: '−', label: 'a − b' }, { value: '×', label: 'a × b' }], onChange: (v) => ((s.op = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, equal: true, grid: 'none', x: { label: '', domain: [-1.35, 1.35], ticks: [] }, y: { label: '', domain: [-1.25, 1.25], ticks: [] }, margin: { left: 8, bottom: 8, right: 8, top: 8 } });
    const line = monoBox('text-align:center;font-size:1rem');
    w.main.appendChild(line);
    const strip = new GBC.Plot(w.main, { height: 110, grid: 'none', y: { label: '', ticks: [], domain: [-0.9, 0.9] }, x: { label: 'числа, окрашенные по остатку mod m' }, margin: { left: 10, right: 10, top: 4, bottom: 34 } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'a mod m' }, { key: 'b', label: 'b mod m' }, { key: 'r', label: 'результат mod m' }]);
    w.pythonAction(() => `m, a, b = ${s.m}, ${s.a}, ${s.b}
raw = a ${s.op === '×' ? '*' : s.op === '−' ? '-' : '+'} b
print(f"{a} ${s.op} {b} = {raw} ≡ {raw % m} (mod {m})")
print("остатки сначала:", (a % m ${s.op === '×' ? '*' : s.op === '−' ? '-' : '+'} b % m) % m)
print("класс остатка", a % m, ":", [a % m + k * m for k in range(-2, 4)])`);
    function draw() {
      const { m, a, b, op } = s;
      const raw = op === '+' ? a + b : op === '×' ? a * b : a - b;
      const res = mod(raw, m);
      const ks = U.range(m);
      const ring = U.linspace(0, 1, 200).map((t) => onCircle(t * m, m));
      const L = [{ type: 'line', x: ring.map((p) => p[0]), y: ring.map((p) => p[1]), color: 'muted', width: 2, hover: false }];
      if (op !== '×') {
        const from = mod(a, m);
        const len = op === '+' ? b : -b;
        const steps = U.linspace(from, from + len, Math.max(2, Math.abs(len) * 8));
        const arc = steps.map((t) => onCircle(t, m, 0.82));
        L.push({ type: 'line', x: arc.map((p) => p[0]), y: arc.map((p) => p[1]), color: 'tree', width: 3, hover: false });
      }
      L.push(
        { type: 'points', x: ks.map((k) => onCircle(k, m)[0]), y: ks.map((k) => onCircle(k, m)[1]), color: 'muted', r: 4 },
        { type: 'points', x: [onCircle(mod(a, m), m)[0]], y: [onCircle(mod(a, m), m)[1]], color: 'model', r: 9, label: 'a' },
        { type: 'points', x: [onCircle(res, m)[0]], y: [onCircle(res, m)[1]], color: 'tree', r: 9, label: 'результат' },
        { type: 'text', items: ks.map((k) => ({ x: onCircle(k, m, 1.17)[0], y: onCircle(k, m, 1.17)[1], dy: 4, anchor: 'middle', text: String(k), bold: k === res })) },
      );
      plot.render(L);
      const lo = -m;
      const hi = 2 * m;
      const xs = U.range(hi - lo + 1, lo);
      strip.render([
        { type: 'points', x: xs, y: xs.map(() => 0), color: (i) => SER[mod(xs[i], m) % 8], r: m > 16 ? 4 : 6, tooltip: (i) => [minus(xs[i]) + ' ≡ ' + mod(xs[i], m) + ' (mod ' + m + ')'] },
        { type: 'text', items: xs.filter((x) => mod(x, m) === res).map((x) => ({ x, y: 0.45, anchor: 'middle', text: minus(x), bold: true })) },
      ], { x: [lo - 0.8, hi + 0.8] });
      line.textContent = minus(a) + ' ' + op + ' ' + b + ' = ' + minus(raw) + ' ≡ ' + res + ' (mod ' + m + ')';
      st.set('a', String(mod(a, m)));
      st.set('b', String(mod(b, m)));
      st.set('r', String(res));
      note.innerHTML = 'Числа <b>сравнимы по модулю m</b> (a ≡ b (mod m)), если m делит a − b — то есть у них одинаковый остаток. Все целые разбиваются на m <b>классов вычетов</b>: на нижней прямой числа одного цвета — один класс (подписаны числа из класса результата: они отличаются на кратные ' + m + '). Главное свойство: результат сложения, вычитания и умножения зависит только от классов, поэтому остатки можно брать <em>до</em> операции: (a ' + op + ' b) mod m = ((a mod m) ' + op + ' (b mod m)) mod m. ' + (a < 0 ? 'Отрицательное a тоже попадает в класс: ' + minus(a) + ' ≡ ' + mod(a, m) + ' — «без ' + -a + ' часов» на циферблате. ' : '') + 'Так компьютер считает с огромными числами по модулю 2³² или 2⁶⁴, никогда их не храня (шаг 28).';
    }
    draw();
  });

  /* ==============================================================================
   * 17. Таблицы сложения и умножения по модулю m
   * ============================================================================== */
  GBC.widget('mod-table', (el) => {
    const s = { m: 6, op: '×', ra: 2, rb: 3 };
    const w = ui.shell(el, { title: 'Таблица операций по модулю m', sub: 'Строка a, столбец b, в клетке — a + b или a · b по модулю m. Щёлкните по клетке. В таблице умножения жирно обведены строки обратимых a: они — перестановки всех остатков.' });
    ui.slider(w.controls, { label: 'Модуль m', min: 2, max: 16, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), (s.ra = Math.min(s.ra, v - 1)), (s.rb = Math.min(s.rb, v - 1)), draw()) });
    ui.segmented(w.controls, { label: 'Операция', value: s.op, options: [{ value: '+', label: 'сложение' }, { value: '×', label: 'умножение' }], onChange: (v) => ((s.op = v), draw()) });
    const svgWrap = H('div');
    const info = monoBox('text-align:center');
    w.main.append(svgWrap, info);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'u', label: 'обратимых (φ(m))' }, { key: 'z', label: 'делителей нуля' }, { key: 'f', label: 'поле?' }]);
    w.pythonAction(() => `from math import gcd

m = ${s.m}
for a in range(m):
    row = [(a ${s.op === '×' ? '*' : '+'} b) % m for b in range(m)]
    tag = "перестановка" if sorted(row) == list(range(m)) else ""
    print(f"{a:2} |", " ".join(f"{v:2}" for v in row), tag)
units = [a for a in range(m) if gcd(a, m) == 1]
print("обратимые:", units, " обратные:", {a: pow(a, -1, m) for a in units})
print("делители нуля:", [a for a in range(1, m) if any(a * b % m == 0 for b in range(1, m))])`);
    function draw() {
      const { m, op } = s;
      const cs = m > 12 ? 30 : 36;
      const W = (m + 1) * cs + 4;
      svgWrap.textContent = '';
      const svg = svgBox(svgWrap, W, W, Math.min(W, 340), Math.min(560, W * 1.4));
      const zeroDiv = U.range(m).filter((a) => a > 0 && U.range(m).some((b) => b > 0 && (a * b) % m === 0));
      for (let i = 0; i <= m; i++)
        for (let j = 0; j <= m; j++) {
          const x = 2 + j * cs;
          const y = 2 + i * cs;
          if (i === 0 && j === 0) {
            svg.appendChild(sText(x + cs / 2, y + cs / 2, op === '+' ? '+' : '·', { bold: true, size: 15, color: 'var(--ink-2)' }));
            continue;
          }
          if (i === 0 || j === 0) {
            const v = i === 0 ? j - 1 : i - 1;
            svg.appendChild(sText(x + cs / 2, y + cs / 2, String(v), { bold: true, mono: true, size: 12, color: 'var(--ink-2)' }));
            continue;
          }
          const a = i - 1;
          const b = j - 1;
          const v = op === '+' ? (a + b) % m : (a * b) % m;
          const sel = a === s.ra && b === s.rb;
          let fill = tint('var(--c-blue)', 6 + Math.round((70 * v) / Math.max(1, m - 1)));
          if (op === '×' && v === 0 && a > 0 && b > 0) fill = tint('var(--c-orange)', 45);
          if (op === '×' && v === 1) fill = tint('var(--c-aqua)', 55);
          const r = S('rect', { x: x + 1, y: y + 1, width: cs - 2, height: cs - 2, rx: 4, style: 'cursor:pointer;fill:' + fill + ';stroke:' + (sel ? 'var(--ink)' : 'var(--surface)') + ';stroke-width:' + (sel ? 2.5 : 1) });
          r.addEventListener('click', () => ((s.ra = a), (s.rb = b), draw()));
          svg.appendChild(r);
          const t = sText(x + cs / 2, y + cs / 2, String(v), { mono: true, size: 12, bold: sel });
          t.style.pointerEvents = 'none';
          svg.appendChild(t);
        }
      if (op === '×')
        units(m).forEach((a) => svg.appendChild(S('rect', { x: 2 + cs + 0.5, y: 2 + (a + 1) * cs + 0.5, width: m * cs - 1, height: cs - 1, rx: 5, style: 'fill:none;stroke:var(--c-blue);stroke-width:2;pointer-events:none' })));
      const { ra: a, rb: b } = s;
      const raw = op === '+' ? a + b : a * b;
      info.textContent = a + (op === '+' ? ' + ' : ' · ') + b + ' = ' + raw + ' = ' + Math.floor(raw / m) + '·' + m + ' + ' + (raw % m) + '   →   ' + (raw % m) + (op === '×' && gcd(a, m) === 1 ? '        обратный к ' + a + ': ' + invMod(a, m) : op === '×' && a > 0 ? '        у ' + a + ' обратного нет: НОД(' + a + ', ' + m + ') = ' + gcd(a, m) : '');
      const isField = isPrime(m);
      st.set('u', String(units(m).length));
      st.set('z', zeroDiv.length ? zeroDiv.join(', ') : 'нет');
      st.set('f', isField ? 'да (m простое)' : 'нет');
      note.innerHTML = op === '+'
        ? 'Каждая строка таблицы сложения — сдвиг строки 0, 1, …, m − 1 по кругу: прибавление a по модулю m — поворот циферблата. Поэтому в каждой строке и каждом столбце все остатки встречаются ровно по разу (латинский квадрат), и у любого a есть противоположный: −a ≡ m − a. Вычитание по модулю всегда возможно.'
        : 'В строке обратимого a (обведена синим) все остатки встречаются по разу: умножение на a — перестановка, и где-то в строке стоит 1 (бирюзовая клетка) — это обратный элемент. Обратимы ровно те a, у которых НОД(a, m) = 1, их φ(' + m + ') = ' + units(m).length + '. ' + (zeroDiv.length ? 'Оранжевые клетки — <b>делители нуля</b>: произведение ненулевых чисел равно 0 (например, ' + zeroDiv[0] + '·' + m / gcd(zeroDiv[0], m) + ' ≡ 0). Из a·b ≡ a·c здесь нельзя сократить на a — деление по модулю составного числа ломается.' : 'Модуль простой: делителей нуля нет, каждый ненулевой элемент обратим — остатки по модулю ' + m + ' образуют <b>поле</b>, в нём можно делить, как в рациональных числах.');
    }
    draw();
  });

  /* ==============================================================================
   * 17. Таблица умножения на окружности (кардиоида)
   * ============================================================================== */
  GBC.widget('times-circle', (el) => {
    const s = { m: 200, k: 2 };
    const w = ui.shell(el, { title: 'Таблица умножения на окружности', sub: 'Поставим m точек по кругу и соединим каждую точку x с точкой k·x mod m. Множество хорд складывается в кривые: при k = 2 — кардиоида, при k = 3 — нефроида.' });
    ui.slider(w.controls, { label: 'Точек m', values: [10, 20, 50, 100, 200, 300, 400], value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    const kS = ui.slider(w.controls, { label: 'Множитель k', min: 1, max: 60, step: 0.05, value: s.k, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.k = v), draw()) });
    ui.player(w.controls, { label: 'Анимация k', min: 0, max: 240, value: 0, fps: 20, format: (v) => 'k = ' + U.fmt(2 + v / 40, 2), onChange: (v) => ((s.k = 2 + v / 40), kS.set(s.k), draw()) });
    const presets = flexRow('margin-top:4px');
    [2, 3, 4, 5, 21, 34, 51, 99].forEach((v) => presets.appendChild(ui.button(null, { label: 'k = ' + v, small: true, onClick: () => ((s.k = v), kS.set(v), draw()) })));
    w.controls.appendChild(presets);
    const plot = new GBC.Plot(w.main, { height: 380, equal: true, grid: 'none', x: { label: '', ticks: [], domain: [-1.08, 1.08] }, y: { label: '', ticks: [], domain: [-1.08, 1.08] }, margin: { left: 4, bottom: 4, right: 4, top: 4 } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'k' }, { key: 'f', label: 'неподвижных точек k·x ≡ x' }, { key: 'c', label: 'остриёв (k − 1)' }]);
    w.pythonAction(() => `import matplotlib.pyplot as plt
import numpy as np

m, k = ${s.m}, ${U.fmt(s.k, 3)}
t = 2 * np.pi * np.arange(m) / m
x = np.arange(m)
end = 2 * np.pi * ((k * x) % m) / m
for a, b in zip(t, end):
    plt.plot([np.sin(a), np.sin(b)], [np.cos(a), np.cos(b)], lw=0.6, color="tab:blue", alpha=0.6)
plt.gca().set_aspect("equal"); plt.axis("off"); plt.show()
if float(k).is_integer():
    k = int(k)
    print("неподвижных точек (k − 1)·x ≡ 0 (mod m):", sum(1 for v in range(m) if (k * v - v) % m == 0))`);
    function draw() {
      const { m, k } = s;
      const x1 = [];
      const y1 = [];
      const x2 = [];
      const y2 = [];
      for (let x = 0; x < m; x++) {
        const [ax, ay] = onCircle(x, m);
        const [bx, by] = onCircle(mod(k * x, m), m);
        x1.push(ax);
        y1.push(ay);
        x2.push(bx);
        y2.push(by);
      }
      const ring = U.linspace(0, 1, 240).map((t) => onCircle(t, 1));
      plot.render([
        { type: 'line', x: ring.map((p) => p[0]), y: ring.map((p) => p[1]), color: 'muted', width: 1.2, hover: false },
        { type: 'segments', x1, y1, x2, y2, color: 'model', width: m > 200 ? 0.6 : 0.9, opacity: m > 200 ? 0.5 : 0.7 },
        { type: 'points', x: U.range(m).map((x) => onCircle(x, m)[0]), y: U.range(m).map((x) => onCircle(x, m)[1]), color: 'ink2', r: m > 100 ? 1 : 2.5 },
      ]);
      const isInt = Math.abs(k - Math.round(k)) < 1e-9;
      const K = Math.round(k);
      const fixed = isInt ? U.range(m).filter((x) => ((K - 1) * x) % m === 0).length : '—';
      st.set('k', U.fmt(k, 2));
      st.set('f', String(fixed));
      st.set('c', isInt ? String(K - 1) : '—');
      note.innerHTML = 'Хорда x → k·x mod m — это строка k таблицы умножения по модулю m, нарисованная на окружности. При целом k огибающая хорд — эпициклоида с <b>k − 1 остриями</b>: k = 2 даёт кардиоиду, k = 3 — нефроиду. Неподвижные точки — решения сравнения (k − 1)·x ≡ 0 (mod m), их НОД(k − 1, m)' + (isInt ? ' = ' + fixed : '') + '. Попробуйте k = m + 1 (или k = 21 при m = 20): каждая точка переходит в себя — k ≡ 1. При k = m/2 + 1 получаются почти диаметры. Анимация с дробным k показывает, как одна картинка плавно перетекает в другую. Красивые узоры здесь — следствие той же арифметики остатков, что и в таблице выше.';
    }
    draw();
  });

  /* ==============================================================================
   * 18. Линейные сравнения a·x ≡ b (mod m)
   * ============================================================================== */
  GBC.widget('lin-congruence', (el) => {
    const s = { a: 6, b: 4, m: 10 };
    const w = ui.shell(el, { title: 'Решаем a·x ≡ b (mod m)', sub: 'Точки — значения a·x mod m для x = 0, 1, …, m − 1. Решения — те x, где точка попадает на линию b. Справа — алгоритм: сократить на НОД, умножить на обратный.' });
    ui.slider(w.controls, { label: 'a', min: 0, max: 30, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'b', min: 0, max: 29, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.slider(w.controls, { label: 'Модуль m', min: 2, max: 30, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'a·x mod m' } });
    const steps = monoBox();
    w.main.appendChild(steps);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'НОД(a, m)' }, { key: 'n', label: 'решений по модулю m' }, { key: 'x', label: 'решения' }]);
    w.pythonAction(() => `from math import gcd

a, b, m = ${s.a}, ${s.b}, ${s.m}
print("перебор:", [x for x in range(m) if (a * x - b) % m == 0])
g = gcd(a, m)
if b % g:
    print(f"нет решений: НОД({a}, {m}) = {g} не делит {b}")
else:
    a1, b1, m1 = a // g, b // g, m // g
    x0 = b1 * pow(a1, -1, m1) % m1 if m1 > 1 else 0
    print(f"сокращаем на {g}: {a1}x ≡ {b1} (mod {m1}) → x ≡ {x0} (mod {m1})")
    print("все решения по модулю m:", [x0 + t * m1 for t in range(g)])`);
    function draw() {
      const { m } = s;
      const a = s.a % m;
      const b = s.b % m;
      const xs = U.range(m);
      const vs = xs.map((x) => (a * x) % m);
      const sol = xs.filter((x) => vs[x] === b);
      plot.render([
        { type: 'hline', y: b, color: 'tree', dash: '5 4', width: 1.5, label: 'b = ' + b },
        { type: 'line', x: xs, y: vs, color: 'grid', width: 1, hover: false },
        { type: 'points', x: xs, y: vs, color: 'model', r: 4.5, label: 'a·x mod m', tooltip: (i) => [a + '·' + i + ' = ' + a * i + ' ≡ ' + vs[i]] },
        { type: 'points', x: sol, y: sol.map(() => b), color: 'tree', r: 7, label: 'решения' },
      ], { x: [-0.5, m - 0.5], y: [-0.5, m - 0.5] });
      const g = gcd(a, m);
      const lines = [a + '·x ≡ ' + b + ' (mod ' + m + '),   НОД(' + a + ', ' + m + ') = ' + g];
      if (b % g !== 0) lines.push(g + ' не делит ' + b + '  →  решений нет: a·x − b не может делиться на m, ведь a·x и m делятся на ' + g + ', а b — нет');
      else {
        const a1 = a / g;
        const b1 = b / g;
        const m1 = m / g;
        if (g > 1) lines.push('делим всё на ' + g + ':  ' + a1 + '·x ≡ ' + b1 + ' (mod ' + m1 + ')');
        if (m1 === 1) lines.push('по модулю 1 подходит любое x');
        else {
          const inv = invMod(a1, m1);
          lines.push('обратный к ' + a1 + ' по модулю ' + m1 + ': ' + inv + '   (' + a1 + '·' + inv + ' = ' + a1 * inv + ' ≡ 1)');
          lines.push('x ≡ ' + b1 + '·' + inv + ' = ' + b1 * inv + ' ≡ ' + ((b1 * inv) % m1) + ' (mod ' + m1 + ')');
          if (g > 1) lines.push('по модулю ' + m + ' это ' + g + ' ' + plural(g, 'решение', 'решения', 'решений') + ': ' + sol.join(', '));
        }
      }
      steps.textContent = lines.join('\n');
      st.set('g', String(g));
      st.set('n', String(sol.length));
      st.set('x', sol.length ? sol.join(', ') : 'нет');
      note.innerHTML = '<b>Обратный элемент</b> a⁻¹ (mod m) — такое число, что a·a⁻¹ ≡ 1. Он существует тогда и только тогда, когда НОД(a, m) = 1: из Безу a·x + m·y = 1 следует a·x ≡ 1 (шаг 8). Деление по модулю — умножение на обратный: «разделить на 2 по модулю 7» значит умножить на 4, потому что 2·4 = 8 ≡ 1. Общий ответ для a·x ≡ b: решения есть, только если g = НОД(a, m) делит b, и тогда их ровно g по модулю m, через шаг m/g. На графике это видно: при g > 1 точки a·x mod m заполняют только кратные g — каждое значение повторяется g раз.';
    }
    draw();
  });

  /* ==============================================================================
   * 19. Степени по модулю: циклы и порядок
   * ============================================================================== */
  GBC.widget('power-cycles', (el) => {
    const s = { a: 3, m: 11 };
    const w = ui.shell(el, { title: 'Степени по модулю: циклы и порядок элемента', sub: 'Последовательность a, a², a³, … по модулю m рано или поздно зацикливается. Стрелки ведут от aᵏ к aᵏ⁺¹. Снизу — порядки всех обратимых элементов.' });
    const aS = ui.slider(w.controls, { label: 'Основание a', min: 0, max: 60, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), draw()) });
    const mS = ui.slider(w.controls, { label: 'Модуль m', min: 2, max: 60, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    const presets = flexRow('margin-top:4px');
    [['последняя цифра 7ᵏ', 7, 10], ['2 mod 11', 2, 11], ['3 mod 11', 3, 11], ['2 mod 12', 2, 12], ['5 mod 23', 5, 23]].forEach(([t, a, m]) => presets.appendChild(ui.button(null, { label: t, small: true, onClick: () => ((s.a = a), (s.m = m), aS.set(a), mS.set(m), draw()) })));
    w.controls.appendChild(presets);
    const plot = new GBC.Plot(w.main, { height: 300, equal: true, grid: 'none', x: { label: '', ticks: [], domain: [-1.3, 1.3] }, y: { label: '', ticks: [], domain: [-1.25, 1.25] }, margin: { left: 4, bottom: 4, right: 4, top: 4 } });
    const seq = monoBox('font-size:.85rem');
    w.main.appendChild(seq);
    const bars = new GBC.Plot(w.main, { height: 170, x: { label: 'обратимый элемент a' }, y: { label: 'порядок' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pre', label: 'предпериод' }, { key: 'per', label: 'период (порядок)' }, { key: 'phi', label: 'φ(m)' }]);
    w.pythonAction(() => `from math import gcd

a, m = ${s.a}, ${s.m}
seen, x, k = {}, 1 % m, 0
while x not in seen:
    seen[x] = k
    x, k = x * a % m, k + 1
print("a^k mod m, k = 0, 1, …:", list(seen))
print("предпериод:", seen[x], " период:", k - seen[x])
units = [u for u in range(1, m) if gcd(u, m) == 1]
order = lambda u: next(j for j in range(1, m + 1) if pow(u, j, m) == 1)
print("порядки обратимых:", {u: order(u) for u in units})
print("первообразные корни:", [u for u in units if order(u) == len(units)])`);
    function draw() {
      const { m } = s;
      const a = s.a % m;
      const seen = new Map();
      const path = [];
      let x = 1 % m;
      while (!seen.has(x)) (seen.set(x, path.length), path.push(x), (x = (x * a) % m));
      const pre = seen.get(x);
      const per = path.length - pre;
      const ks = U.range(m);
      const L = [{ type: 'points', x: ks.map((k) => onCircle(k, m)[0]), y: ks.map((k) => onCircle(k, m)[1]), color: (i) => (seen.has(i) ? (seen.get(i) >= pre ? 'tree' : 'aqua') : 'muted'), r: m > 40 ? 4 : 5.5 }];
      const ax = [];
      const ay = [];
      const bx = [];
      const by = [];
      for (let i = 0; i < path.length; i++) {
        const from = path[i];
        const to = i + 1 < path.length ? path[i + 1] : x;
        if (from === to) continue;
        const [x0, y0] = onCircle(from, m, 0.95);
        const [x1, y1] = onCircle(to, m, 0.95);
        ax.push(x0 + (x1 - x0) * 0.04);
        ay.push(y0 + (y1 - y0) * 0.04);
        bx.push(x0 + (x1 - x0) * 0.94);
        by.push(y0 + (y1 - y0) * 0.94);
      }
      L.push({ type: 'arrows', x1: ax, y1: ay, x2: bx, y2: by, color: 'model', width: 1.6 });
      if (m <= 40) L.push({ type: 'text', items: ks.map((k) => ({ x: onCircle(k, m, 1.13)[0], y: onCircle(k, m, 1.13)[1], dy: 4, anchor: 'middle', text: String(k), bold: seen.has(k), color: seen.has(k) ? 'ink' : 'muted' })) });
      plot.render(L);
      seq.textContent = 'aᵏ mod ' + m + ': ' + path.map((v, i) => (i === pre && pre > 0 ? '[' : i === pre ? '[' : '') + v).join(', ') + '] → ' + x + ' …  (в скобках — цикл)';
      const us = units(m);
      const ords = us.map((u) => order(u, m));
      const ph = us.length;
      bars.render([
        { type: 'bars', x: us, y: ords, color: (i) => (ords[i] === ph ? 'tree' : 'blue'), width: 0.7, maxPx: 16, label: 'порядок', tooltip: (i) => ['ord(' + us[i] + ') = ' + ords[i]] },
        { type: 'hline', y: ph, color: 'ink2', dash: '4 3', width: 1, text: 'φ(m) = ' + ph },
      ], { x: [0, m], y: [0, ph * 1.15 + 0.5] });
      st.set('pre', String(pre));
      st.set('per', String(per) + (gcd(a, m) === 1 ? ' = ord(' + a + ')' : ''));
      st.set('phi', String(ph));
      const roots = us.filter((u, i) => ords[i] === ph);
      note.innerHTML = 'Остатков конечно, поэтому степени обязаны повториться — последовательность имеет вид «хвост (бирюзовый) + цикл (оранжевый)». ' + (gcd(a, m) === 1 ? 'Для обратимого a хвоста нет: цикл возвращается в 1, и его длина — <b>порядок</b> ord(' + a + ') = ' + per + ', наименьшее k с aᵏ ≡ 1. Порядок всегда делит φ(m) = ' + ph + ' (теорема Лагранжа; столбики ниже — делители ' + ph + '). ' : 'Здесь НОД(' + a + ', ' + m + ') = ' + gcd(a, m) + ' > 1 — в 1 последовательность не вернётся никогда (иначе a было бы обратимо), отсюда хвост длины ' + pre + '. ') + (roots.length ? 'Элементы порядка φ(m) — <b>первообразные корни</b> (оранжевые столбики: ' + roots.slice(0, 10).join(', ') + (roots.length > 10 ? ', …' : '') + '): их степени пробегают все обратимые остатки. ' : 'У этого модуля первообразных корней нет — они существуют только для m = 2, 4, pᵏ, 2pᵏ. ') + 'Практическое следствие: последняя цифра 7²⁰²⁶ — по циклу 7, 9, 3, 1 длины 4: 2026 mod 4 = 2, значит, 9.';
    }
    draw();
  });

  /* ==============================================================================
   * 20. Малая теорема Ферма: доказательство перестановкой
   * ============================================================================== */
  GBC.widget('fermat-perm', (el) => {
    const s = { m: 7, a: 3 };
    const w = ui.shell(el, { title: 'Почему aᵠ⁽ᵐ⁾ ≡ 1: умножение переставляет остатки', sub: 'Верхний ряд — обратимые остатки по модулю m. Нижний — они же, умноженные на a. Если НОД(a, m) = 1, нижний ряд — перестановка верхнего, и произведения рядов равны.' });
    ui.slider(w.controls, { label: 'Модуль m', min: 3, max: 26, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'Множитель a', min: 1, max: 25, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), draw()) });
    const svgWrap = H('div');
    const calc = monoBox('font-size:.9rem');
    w.main.append(svgWrap, calc);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'phi', label: 'φ(m)' }, { key: 'pw', label: 'a^φ(m) mod m' }, { key: 'pr', label: 'произведение остатков mod m' }]);
    w.pythonAction(() => `from math import gcd, prod

m, a = ${s.m}, ${s.a}
R = [r for r in range(1, m) if gcd(r, m) == 1]
aR = [a * r % m for r in R]
print("остатки:   ", R)
print("умножены:  ", aR, " перестановка:", sorted(aR) == R)
P = prod(R) % m
print("∏ r mod m =", P, " ∏ (a·r) mod m =", prod(aR) % m)
print("a^φ(m) mod m =", pow(a, len(R), m), " (φ(m) =", len(R), ")")`);
    function draw() {
      const { m } = s;
      const a = s.a % m;
      const R = units(m);
      const aR = R.map((r) => (a * r) % m);
      const n = R.length;
      const cw = Math.max(34, Math.min(52, 560 / n));
      const W = n * cw + 40;
      svgWrap.textContent = '';
      const svg = svgBox(svgWrap, W, 150, Math.min(W, 360), Math.max(W * 1.3, 420));
      const xOf = (i) => 30 + i * cw + cw / 2;
      svg.appendChild(sText(14, 30, 'r', { size: 12, color: 'var(--ink-2)' }));
      svg.appendChild(sText(14, 122, 'a·r', { size: 11, color: 'var(--ink-2)' }));
      const ok = gcd(a, m) === 1;
      const hits = new Map();
      aR.forEach((v) => hits.set(v, (hits.get(v) || 0) + 1));
      R.forEach((r, i) => {
        const j = R.indexOf(aR[i]);
        const target = j >= 0 ? xOf(j) : null;
        if (target !== null) svg.appendChild(S('line', { x1: xOf(i), y1: 42, x2: target, y2: 108, style: 'stroke:' + cvar(i) + ';stroke-width:1.6;opacity:.75' }));
      });
      R.forEach((r, i) => {
        svg.appendChild(S('rect', { x: xOf(i) - 15, y: 16, width: 30, height: 26, rx: 6, style: 'fill:' + tint(cvar(i), 30) + ';stroke:' + cvar(i) }));
        svg.appendChild(sText(xOf(i), 29, String(r), { mono: true, bold: true, size: 13 }));
      });
      R.forEach((r, j) => {
        const cnt = hits.get(r) || 0;
        svg.appendChild(S('rect', { x: xOf(j) - 15, y: 108, width: 30, height: 26, rx: 6, style: 'fill:' + (cnt === 1 ? 'var(--surface-2)' : cnt === 0 ? 'var(--surface)' : tint('var(--c-orange)', 40)) + ';stroke:' + (cnt === 1 ? 'var(--border-strong)' : 'var(--c-orange)') + ';stroke-dasharray:' + (cnt === 0 ? '3 3' : 'none') }));
        svg.appendChild(sText(xOf(j), 121, String(r), { mono: true, size: 13, color: cnt ? 'var(--ink)' : 'var(--muted)' }));
      });
      const P = R.reduce((p, r) => (p * r) % m, 1);
      const PA = aR.reduce((p, r) => (p * r) % m, 1);
      const pw = powmod(a, n, m);
      calc.textContent = ok
        ? '∏(a·r) = a^' + n + ' · ∏r   и   ∏(a·r) ≡ ∏r = ' + P + ' (mod ' + m + ')\n⇒  a^' + n + ' · ' + P + ' ≡ ' + P + '  ⇒  (сокращаем на обратимое ' + P + ')  ' + a + '^' + n + ' ≡ 1 (mod ' + m + ')'
        : 'НОД(' + a + ', ' + m + ') = ' + gcd(a, m) + ': умножение на a — не перестановка, некоторые a·r вообще не обратимы (выпали из ряда), и теорема не работает: ' + a + '^' + n + ' ≡ ' + pw + ' (mod ' + m + ')';
      st.set('phi', String(n));
      st.set('pw', String(pw));
      st.set('pr', String(P) + (P === m - 1 ? ' ≡ −1' : ''));
      note.innerHTML = '<b>Теорема Эйлера:</b> если НОД(a, m) = 1, то a<sup>φ(m)</sup> ≡ 1 (mod m). Для простого m = p это <b>малая теорема Ферма</b>: a<sup>p−1</sup> ≡ 1, или a<sup>p</sup> ≡ a для любого a. Доказательство перед глазами: умножение на обратимое a переставляет обратимые остатки (из a·r ≡ a·r′ следует r ≡ r′), поэтому произведение не меняется, а с другой стороны в нём появился множитель a<sup>φ(m)</sup>. ' + (isPrime(m) ? 'Произведение всех ненулевых остатков по простому модулю равно −1 (<b>теорема Вильсона</b>: (p − 1)! ≡ −1 (mod p)) — сейчас ' + P + ' ≡ −1. ' : '') + 'Теорема Эйлера — основа RSA (шаг 25) и быстрых вычислений: показатель можно уменьшать по модулю φ(m), например 3¹⁰⁰ mod 7 = 3^(100 mod 6) = 3⁴ = 81 ≡ 4.';
    }
    draw();
  });

  /* ==============================================================================
   * 20. Функция Эйлера φ(n)
   * ============================================================================== */
  GBC.widget('phi-chart', (el) => {
    const s = { N: 300, n: 36 };
    const w = ui.shell(el, { title: 'Функция Эйлера φ(n)', sub: 'φ(n) — сколько чисел от 1 до n взаимно просты с n. Простые лежат на верхней прямой φ(p) = p − 1; остальные точки выстраиваются в лучи φ(n) = n·∏(1 − 1/p).' });
    ui.slider(w.controls, { label: 'До N', values: [100, 300, 1000], value: s.N, format: String, onInput: (v) => ((s.N = v), (s.n = Math.min(s.n, v)), draw()) });
    ui.slider(w.controls, { label: 'Выбрать n', min: 2, max: 1000, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = Math.min(v, s.N)), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'n' }, y: { label: 'φ(n)' } });
    const calc = monoBox();
    w.main.appendChild(calc);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'φ(n)' }, { key: 'r', label: 'φ(n) / n' }, { key: 'd', label: 'Σ φ(d) по делителям d | n' }]);
    w.pythonAction(() => `from math import gcd

def phi(n):
    r, m, p = n, n, 2
    while p * p <= m:
        if m % p == 0:
            while m % p == 0:
                m //= p
            r -= r // p              # r = r·(1 − 1/p)
        p += 1
    if m > 1:
        r -= r // m
    return r

n = ${s.n}
print("φ(n) =", phi(n), " перебором:", sum(1 for k in range(1, n + 1) if gcd(k, n) == 1))
print("сумма φ(d) по делителям:", sum(phi(d) for d in range(1, n + 1) if n % d == 0), "= n")
print("мультипликативность: φ(4)·φ(9) =", phi(4) * phi(9), " φ(36) =", phi(36))`);
    function draw() {
      const { N } = s;
      const n = Math.min(s.n, N);
      const xs = U.range(N - 1, 2);
      const ys = xs.map(phi);
      plot.render([
        { type: 'line', x: [2, N], y: [1, N - 1], color: 'grid', width: 1, hover: false },
        { type: 'points', x: xs, y: ys, color: (i) => (isPrime(xs[i]) ? 'orange' : 'blue'), r: N > 400 ? 1.8 : 2.8, opacity: 0.85, tooltip: (i) => ['φ(' + xs[i] + ') = ' + ys[i]] },
        { type: 'points', x: [n], y: [phi(n)], color: 'ink', r: 6.5 },
      ], { x: [0, N], y: [0, N] });
      const f = factorize(n);
      calc.textContent = 'φ(' + n + ') = ' + n + (f.length ? ' · ' + f.map(([p]) => '(1 − 1/' + p + ')').join(' · ') : '') + ' = ' + phi(n) + '      ' + n + ' = ' + fstr(f);
      const sd = divisors(n).reduce((acc, d) => acc + phi(d), 0);
      st.set('p', String(phi(n)));
      st.set('r', f3(phi(n) / n));
      st.set('d', String(sd) + ' = n');
      note.innerHTML = 'Формула следует из разложения: среди чисел 1…n доля не делящихся на простое p равна 1 − 1/p, и для разных простых эти события «независимы» (китайская теорема, шаг 22). Отсюда φ <b>мультипликативна</b>: φ(ab) = φ(a)·φ(b) при НОД(a, b) = 1, и φ(pᵏ) = pᵏ − pᵏ⁻¹. Простые (оранжевые) лежат на верхней прямой p − 1; ниже — луч φ(n) = n/2 (n = 2ᵏ), луч n/3 (n = 2ᵃ3ᵇ) и т. д. Красивое тождество: Σ φ(d) по всем делителям d числа n равна n — каждая дробь k/n после сокращения имеет знаменатель d, и таких дробей ровно φ(d).';
    }
    draw();
  });

  /* ==============================================================================
   * 21. Быстрое возведение в степень
   * ============================================================================== */
  GBC.widget('fast-pow', (el) => {
    const s = { a: 3, e: 100, m: 7 };
    const w = ui.shell(el, { title: 'Быстрое возведение в степень по модулю', sub: 'Читаем двоичную запись показателя слева направо: на каждом бите возводим в квадрат, на единичном — ещё умножаем на a. Остаток берём после каждого действия.' });
    intField(w.controls, { label: 'Основание a', value: s.a, min: 0, max: 1e9, onChange: (v) => ((s.a = v), draw()) });
    intField(w.controls, { label: 'Показатель e (до 10¹⁵)', value: s.e, min: 0, max: 1e15, onChange: (v) => ((s.e = v), draw()) });
    intField(w.controls, { label: 'Модуль m', value: s.m, min: 1, max: 1e15, onChange: (v) => ((s.m = v), draw()) });
    const tbl = H('div');
    const res = monoBox();
    w.main.append(tbl, res);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'aᵉ mod m' }, { key: 'k', label: 'умножений' }, { key: 'n', label: 'наивно умножений' }]);
    w.pythonAction(() => `a, e, m = ${s.a}, ${s.e}, ${s.m}
r, mults = 1, 0
for bit in bin(e)[2:]:
    r = r * r % m
    mults += 1
    if bit == "1":
        r = r * a % m
        mults += 1
    print(f"бит {bit}: r = {r}")
print("результат:", r, " pow(a, e, m) =", pow(a, e, m))
print("умножений:", mults, " (без первого возведения 1² и умножения 1·a:", e.bit_length() - 1 + bin(e).count("1") - 1, ")")`);
    function draw() {
      const { a, e, m } = s;
      const big = (x) => BigInt(x);
      const bits = e.toString(2).split('');
      let r = 1n;
      const A = big(a) % big(m);
      const M = big(m);
      const rows = [];
      let ex = 0;
      bits.forEach((b, i) => {
        r = (r * r) % M;
        let op = i === 0 ? '1² (начало)' : 'квадрат: e → 2e';
        ex *= 2;
        if (b === '1') {
          r = (r * A) % M;
          op += ', × a: +1';
          ex += 1;
        }
        rows.push([String(i + 1), b, op, ex <= 1e15 ? grp(ex) : '…', grp(r.toString())]);
      });
      const shown = rows.length > 24 ? rows.slice(0, 12).concat([['…', '', '', '', '']], rows.slice(-11)) : rows;
      rowTable(tbl, ['№', 'бит', 'действие', 'показатель', 'значение mod m'], shown, (i) => i === shown.length - 1, false);
      const mults = Math.max(0, bits.length - 1 + bits.filter((b) => b === '1').length - 1);
      res.textContent = a + '^' + grp(e) + ' mod ' + grp(m) + ' = ' + grp(r.toString()) + '      e = ' + (bits.length <= 40 ? bits.join('') : bits.slice(0, 20).join('') + '…') + '₂';
      st.set('r', grp(r.toString()));
      st.set('k', String(mults));
      st.set('n', grp(Math.max(0, e - 1)));
      note.innerHTML = 'Показатель удваивается при возведении в квадрат и растёт на 1 при умножении на a — так за один проход по битам e мы «набираем» нужную степень (столбец «показатель»). Умножений не больше 2·log₂ e: для e = 10¹⁸ (60 бит) их 82 вместо 10¹⁸ − 1. А благодаря остатку на каждом шаге числа не превышают m², хотя само aᵉ может иметь больше цифр, чем атомов во Вселенной. Это и есть встроенная функция Python <code>pow(a, e, m)</code>. Тот же приём работает для любой ассоциативной операции: матрицы (числа Фибоначчи за log n шагов, урок 15.12), композиции перестановок, сдвига генератора случайных чисел на миллиард шагов вперёд.';
    }
    draw();
  });

  /* ==============================================================================
   * 22. Китайская теорема об остатках
   * ============================================================================== */
  GBC.widget('crt-grid', (el) => {
    const s = { m: 3, n: 5, k: 15, r1: 2, r2: 3 };
    const w = ui.shell(el, { title: 'Китайская теорема об остатках на таблице', sub: 'Число k ставим в клетку (k mod m, k mod n) и идём по диагонали, «заворачивая» на краях. Если НОД(m, n) = 1, путь проходит все m·n клеток: каждая пара остатков — ровно одно число от 0 до mn − 1.' });
    ui.slider(w.controls, { label: 'Модуль m (строки)', min: 2, max: 10, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), reset()) });
    ui.slider(w.controls, { label: 'Модуль n (столбцы)', min: 2, max: 12, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Сколько чисел поставить', min: 0, max: 15, value: 15, fps: 3, format: (k) => 'k < ' + k, onChange: (k) => ((s.k = k), draw()) });
    const r1S = ui.slider(w.controls, { label: 'Ищем x ≡ r₁ (mod m), r₁', min: 0, max: 9, step: 1, value: s.r1, format: String, onInput: (v) => ((s.r1 = Math.min(v, s.m - 1)), draw()) });
    const r2S = ui.slider(w.controls, { label: 'и x ≡ r₂ (mod n), r₂', min: 0, max: 11, step: 1, value: s.r2, format: String, onInput: (v) => ((s.r2 = Math.min(v, s.n - 1)), draw()) });
    const svgWrap = H('div');
    const calc = monoBox('font-size:.9rem');
    w.main.append(svgWrap, calc);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'НОД(m, n)' }, { key: 'f', label: 'заполнено клеток' }, { key: 'x', label: 'решение x' }]);
    function reset() {
      pl.stop();
      const L = lcm(s.m, s.n);
      pl.setMax(L);
      pl.set(L);
      s.k = L;
      s.r1 = Math.min(s.r1, s.m - 1);
      s.r2 = Math.min(s.r2, s.n - 1);
      r1S.set(s.r1);
      r2S.set(s.r2);
      draw();
    }
    w.pythonAction(() => `from math import gcd

m, n, r1, r2 = ${s.m}, ${s.n}, ${s.r1}, ${s.r2}
print("перебор:", [x for x in range(m * n) if x % m == r1 and x % n == r2])
if gcd(m, n) == 1:
    x = (r1 * n * pow(n, -1, m) + r2 * m * pow(m, -1, n)) % (m * n)
    print(f"формула: x = r1·n·(n⁻¹ mod m) + r2·m·(m⁻¹ mod n) = {x} (mod {m * n})")
cells = {(k % m, k % n) for k in range(m * n)}
print("различных пар остатков среди 0…mn−1:", len(cells), "из", m * n)`);
    function draw() {
      const { m, n } = s;
      const g = gcd(m, n);
      const cs = 40;
      const W = (n + 1) * cs + 6;
      const Hh = (m + 1) * cs + 6;
      svgWrap.textContent = '';
      const svg = svgBox(svgWrap, W, Hh, Math.min(W, 360), Math.min(560, W * 1.4));
      const cell = new Map();
      for (let k = 0; k < s.k; k++) cell.set((k % m) + ',' + (k % n), k);
      for (let j = 0; j < n; j++) svg.appendChild(sText(3 + (j + 1.5) * cs, 3 + cs / 2, String(j), { bold: true, mono: true, size: 12, color: 'var(--ink-2)' }));
      for (let i = 0; i < m; i++) svg.appendChild(sText(3 + cs / 2, 3 + (i + 1.5) * cs, String(i), { bold: true, mono: true, size: 12, color: 'var(--ink-2)' }));
      for (let i = 0; i < m; i++)
        for (let j = 0; j < n; j++) {
          const v = cell.get(i + ',' + j);
          const tgt = i === s.r1 && j === s.r2;
          const x = 3 + (j + 1) * cs;
          const y = 3 + (i + 1) * cs;
          svg.appendChild(S('rect', { x: x + 1, y: y + 1, width: cs - 2, height: cs - 2, rx: 6, style: 'fill:' + (v !== undefined ? tint('var(--c-blue)', v === s.k - 1 ? 60 : 28) : 'var(--surface-2)') + ';stroke:' + (tgt ? 'var(--c-orange)' : 'var(--border)') + ';stroke-width:' + (tgt ? 3 : 1) }));
          if (v !== undefined) svg.appendChild(sText(x + cs / 2, y + cs / 2, String(v), { mono: true, size: 12, bold: v === s.k - 1 }));
        }
      // путь последних чисел
      const pts = [];
      for (let k = Math.max(0, s.k - 6); k < s.k; k++) pts.push([3 + ((k % n) + 1.5) * cs, 3 + ((k % m) + 1.5) * cs]);
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        if (Math.abs(x1 - x0) <= cs + 1 && Math.abs(y1 - y0) <= cs + 1) svg.appendChild(S('line', { x1: x0, y1: y0, x2: x1, y2: y1, style: 'stroke:var(--c-orange);stroke-width:2;opacity:.6;stroke-dasharray:4 3' }));
      }
      const sol = U.range(m * n).filter((x) => x % m === s.r1 && x % n === s.r2);
      let txt = 'x ≡ ' + s.r1 + ' (mod ' + m + '),  x ≡ ' + s.r2 + ' (mod ' + n + ')';
      if (g === 1) {
        const im = invMod(n, m);
        const iN = invMod(m, n);
        txt += '\nx = r₁·n·(n⁻¹ mod m) + r₂·m·(m⁻¹ mod n) = ' + s.r1 + '·' + n + '·' + im + ' + ' + s.r2 + '·' + m + '·' + iN + ' = ' + (s.r1 * n * im + s.r2 * m * iN) + ' ≡ ' + sol[0] + ' (mod ' + m * n + ')';
      } else txt += '\nНОД(m, n) = ' + g + ': ' + (sol.length ? 'решения ' + sol.join(', ') + ' (по модулю НОК = ' + lcm(m, n) + ')' : 'решений нет — нужно r₁ ≡ r₂ (mod ' + g + ')');
      calc.textContent = txt;
      st.set('g', String(g));
      st.set('f', cell.size + ' из ' + m * n);
      st.set('x', sol.length ? sol.join(', ') : 'нет');
      note.innerHTML = '<b>Китайская теорема об остатках:</b> если НОД(m, n) = 1, то для любых r₁, r₂ система x ≡ r₁ (mod m), x ≡ r₂ (mod n) имеет ровно одно решение по модулю m·n. Иначе говоря, число от 0 до mn − 1 однозначно задаётся парой своих остатков — путь по диагонали заполняет всю таблицу (Сунь-цзы, III век: «число при делении на 3 даёт 2, на 5 — 3, на 7 — 2»; ответ 23). Формула собирает решение из «базисных» чисел: n·(n⁻¹ mod m) даёт остаток 1 по модулю m и 0 по модулю n. ' + (g > 1 ? 'Сейчас НОД = ' + g + ': путь замыкается через НОК = ' + lcm(m, n) + ' шагов и заполняет только ' + cell.size + ' клеток — пары остатков с разной чётностью (вообще, разными остатками по модулю ' + g + ') недостижимы.' : 'Применения: вычисления с огромными числами «параллельно» по нескольким малым модулям, ускорение RSA в 4 раза, а ещё — почему период суммы двух генераторов с взаимно простыми периодами равен их произведению.');
    }
    reset();
  });

  /* ==============================================================================
   * 23. Квадраты по модулю и суммы двух квадратов
   * ============================================================================== */
  GBC.widget('squares-mod', (el) => {
    const s = { m: 8, tab: 'res', N: 100 };
    const w = ui.shell(el, { title: 'Квадраты по модулю и суммы двух квадратов', sub: 'Какие остатки бывают у квадратов? Ответ сразу запрещает многие уравнения. Вторая вкладка — какие числа раскладываются в сумму двух квадратов.' });
    ui.segmented(w.controls, { label: 'Вкладка', value: s.tab, options: [{ value: 'res', label: 'x² mod m' }, { value: 'sum', label: 'a² + b²' }], onChange: (v) => ((s.tab = v), draw()) });
    const mS = ui.slider(w.controls, { label: 'Модуль m', min: 2, max: 30, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    const NS = ui.slider(w.controls, { label: 'До N', values: [50, 100, 200], value: s.N, format: String, onInput: (v) => ((s.N = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, equal: true, grid: 'none', x: { label: '', ticks: [], domain: [-1.3, 1.3] }, y: { label: '', ticks: [], domain: [-1.25, 1.25] }, margin: { left: 4, bottom: 4, right: 4, top: 4 } });
    const svgWrap = H('div');
    w.main.appendChild(svgWrap);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '' }, { key: 'b', label: '' }, { key: 'c', label: '' }]);
    const stK = w.foot.querySelectorAll('.stat .k');
    const setLabels = (arr) => arr.forEach((t, i) => (stK[i].textContent = t));
    const two = (n) => {
      for (let a = 0; a * a <= n; a++) {
        const b = Math.round(Math.sqrt(n - a * a));
        if (b * b === n - a * a) return [a, b];
      }
      return null;
    };
    w.pythonAction(() => s.tab === 'res' ? `m = ${s.m}
sq = {x: x * x % m for x in range(m)}
print("x → x² mod m:", sq)
print("квадратичные вычеты:", sorted(set(sq.values())), " их", len(set(sq.values())), "из", m)` : `import math

N = ${s.N}
def two_squares(n):
    for a in range(math.isqrt(n) + 1):
        b = math.isqrt(n - a * a)
        if b * b == n - a * a:
            return a, b
    return None

primes = [p for p in range(2, N + 1) if all(p % d for d in range(2, math.isqrt(p) + 1))]
for p in primes[:15]:
    print(f"{p:3} ≡ {p % 4} (mod 4): {two_squares(p)}")
print("не суммы двух квадратов вида 4k + 3:", [n for n in range(3, N + 1, 4) if two_squares(n)] or "нет ни одного")`);
    function draw() {
      const isR = s.tab === 'res';
      mS.el.style.display = isR ? '' : 'none';
      NS.el.style.display = isR ? 'none' : '';
      plot.root.style.display = isR ? '' : 'none';
      svgWrap.style.display = isR ? 'none' : '';
      if (isR) {
        const m = s.m;
        const ks = U.range(m);
        const sq = ks.map((x) => (x * x) % m);
        const res = new Set(sq);
        const L = [{ type: 'points', x: ks.map((k) => onCircle(k, m)[0]), y: ks.map((k) => onCircle(k, m)[1]), color: (i) => (res.has(i) ? 'tree' : 'muted'), r: 6 }];
        const ax = [];
        const ay = [];
        const bx = [];
        const by = [];
        ks.forEach((x) => {
          if (sq[x] === x) return;
          const [x0, y0] = onCircle(x, m, 0.93);
          const [x1, y1] = onCircle(sq[x], m, 0.93);
          ax.push(x0 + (x1 - x0) * 0.05);
          ay.push(y0 + (y1 - y0) * 0.05);
          bx.push(x0 + (x1 - x0) * 0.93);
          by.push(y0 + (y1 - y0) * 0.93);
        });
        L.push({ type: 'arrows', x1: ax, y1: ay, x2: bx, y2: by, color: 'model', width: 1.4, opacity: 0.7 });
        L.push({ type: 'text', items: ks.map((k) => ({ x: onCircle(k, m, 1.14)[0], y: onCircle(k, m, 1.14)[1], dy: 4, anchor: 'middle', text: String(k), bold: res.has(k), color: res.has(k) ? 'ink' : 'muted' })) });
        plot.render(L);
        setLabels(['вычеты x² mod m', 'их количество', 'невычеты']);
        const rl = Array.from(res).sort((a, b) => a - b);
        st.set('a', rl.join(', '));
        st.set('b', rl.length + ' из ' + m);
        st.set('c', String(m - rl.length));
        note.innerHTML = 'Стрелка ведёт из x в x² mod ' + m + '; оранжевые остатки — <b>квадратичные вычеты</b> (бывают у квадратов), серые — невычеты. Так как x и m − x дают одинаковый квадрат, вычетов не больше половины: для простого p их ровно (p + 1)/2 вместе с нулём. Следствия из маленьких модулей мощные: по модулю 4 квадраты — только 0 и 1, значит, сумма двух квадратов не бывает ≡ 3 (mod 4); по модулю 8 квадрат нечётного числа всегда ≡ 1; по модулю 10 квадрат не оканчивается на 2, 3, 7, 8 — число 2023 не квадрат, не извлекая корня. И ещё: квадраты по модулю 8 — это 0, 1, 4, а из трёх таких чисел сумму 7 не собрать, поэтому числа 7, 15, 23, … (вида 8k + 7) не раскладываются в сумму трёх квадратов. Так начинаются олимпиадные доказательства невозможности.';
      } else {
        const N = s.N;
        const cols = 10;
        const cw = 44;
        const ch = 30;
        const rowsN = Math.ceil(N / cols);
        svgWrap.textContent = '';
        const svg = svgBox(svgWrap, cols * cw + 4, rowsN * ch + 4, 360, 520);
        let cnt = 0;
        for (let v = 1; v <= N; v++) {
          const t = two(v);
          if (t) cnt++;
          const pr = isPrime(v);
          const x = 2 + ((v - 1) % cols) * cw;
          const y = 2 + Math.floor((v - 1) / cols) * ch;
          const c = pr ? (v % 4 === 1 || v === 2 ? 'var(--c-blue)' : 'var(--c-orange)') : 'var(--border-strong)';
          svg.appendChild(S('rect', { x, y, width: cw - 3, height: ch - 3, rx: 5, style: 'fill:' + (t ? tint('var(--c-blue)', 28) : 'var(--surface-2)') + ';stroke:' + c + ';stroke-width:' + (pr ? 2.2 : 1) }));
          const label = S('text', { x: x + (cw - 3) / 2, y: y + (ch - 3) / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'font-family:var(--font-mono);font-size:12px;fill:' + (t ? 'var(--ink)' : 'var(--muted)') + ';font-weight:' + (pr ? 700 : 500) }, String(v));
          label.appendChild(S('title', null, t ? v + ' = ' + t[0] + '² + ' + t[1] + '²' : v + ' не сумма двух квадратов'));
          svg.appendChild(label);
        }
        setLabels(['сумм двух квадратов до N', 'простых p ≡ 1 (mod 4)', 'простых p ≡ 3 (mod 4)']);
        const P = primesTo(N);
        st.set('a', String(cnt));
        st.set('b', String(P.filter((p) => p % 4 === 1).length));
        st.set('c', String(P.filter((p) => p % 4 === 3).length));
        note.innerHTML = 'Голубая заливка — число представимо как a² + b² (наведите курсор на число, чтобы увидеть разложение). Рамка простых: синяя — p ≡ 1 (mod 4), оранжевая — p ≡ 3. <b>Теорема Ферма — Эйлера:</b> нечётное простое p — сумма двух квадратов тогда и только тогда, когда p ≡ 1 (mod 4): 5 = 1 + 4, 13 = 4 + 9, 29 = 4 + 25, 37 = 1 + 36. Половина «только тогда» следует из квадратов по модулю 4 (первая вкладка), вторая половина — настоящая теорема. Общий критерий: n — сумма двух квадратов, если каждое простое ≡ 3 (mod 4) входит в разложение n в чётной степени (9 = 0 + 9 можно, 21 = 3·7 нельзя). Пифагоровы тройки (m² − n², 2mn, m² + n²) — 3, 4, 5; 5, 12, 13; 8, 15, 17 — гипотенуза в них всегда сумма двух квадратов.';
      }
    }
    draw();
  });

  /* ==============================================================================
   * 24. Тесты простоты: Ферма и Миллер — Рабин
   * ============================================================================== */
  GBC.widget('primality', (el) => {
    const s = { n: 561, test: 'fermat', a: 2 };
    const w = ui.shell(el, { title: 'Тесты простоты: кто лжёт, кто свидетельствует', sub: 'Для каждого основания a проверяем условие теста. Если условие нарушено — a свидетель: n точно составное. Если выполнено у составного n — a «лжец».' });
    const nF = intField(w.controls, { label: 'Нечётное n (до 2⁵³)', value: s.n, min: 3, max: Number.MAX_SAFE_INTEGER, onChange: (v) => ((s.n = v % 2 ? v : v + 1), nF.set(s.n), draw()) });
    const presets = flexRow('margin:-4px 0 6px');
    [341, 561, 1105, 1729, 2047, 997, 8911, 1000003].forEach((v) => presets.appendChild(ui.button(null, { label: grp(v), small: true, onClick: () => ((s.n = v), nF.set(v), draw()) })));
    w.controls.appendChild(presets);
    ui.segmented(w.controls, { label: 'Тест', value: s.test, options: [{ value: 'fermat', label: 'Ферма' }, { value: 'mr', label: 'Миллер — Рабин' }], onChange: (v) => ((s.test = v), draw()) });
    ui.slider(w.controls, { label: 'Подробно для основания a', min: 2, max: 60, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), draw()) });
    const svgWrap = H('div');
    const detail = monoBox('font-size:.86rem');
    w.main.append(svgWrap, legendRow([['var(--c-blue)', 'свидетель (n составное)'], ['var(--c-orange)', 'лжец'], ['var(--muted)', 'НОД(a, n) > 1']]), detail);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'вердикт' }, { key: 'l', label: 'лжецов среди 1 < a < n' }, { key: 'f', label: 'разложение n' }]);
    w.pythonAction(() => `from math import gcd

n = ${s.n}
def fermat_liar(a, n):
    return pow(a, n - 1, n) == 1

def strong_liar(a, n):               # тест Миллера — Рабина для одного основания
    d, s = n - 1, 0
    while d % 2 == 0:
        d, s = d // 2, s + 1
    x = pow(a, d, n)
    if x in (1, n - 1):
        return True
    for _ in range(s - 1):
        x = x * x % n
        if x == n - 1:
            return True
    return False

if n < 100_000:
    bases = range(2, n - 1)
    print("лжецов Ферма:", sum(fermat_liar(a, n) for a in bases),
          " сильных лжецов:", sum(strong_liar(a, n) for a in bases), " из", n - 3)
print("первые 12 простых оснований:", all(strong_liar(p, n) for p in [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37] if p < n), "— «простое», если True")`);
    function draw() {
      const n = s.n;
      const test = s.test === 'fermat' ? (a) => powmod(a, n - 1, n) === 1 : (a) => strongProbable(n, a);
      const prime = isPrime(n);
      svgWrap.textContent = '';
      let liars = 0;
      let total = 0;
      let firstW = null;
      if (n <= 200000) {
        for (let a = 2; a < n - 1; a++) {
          total++;
          if (test(a)) liars++;
          else if (firstW === null) firstW = a;
        }
        const show = Math.min(n - 1, 300);
        const cols = 30;
        const cs = 17;
        const rowsN = Math.ceil((show - 1) / cols);
        const svg = svgBox(svgWrap, cols * cs + 4, rowsN * cs + 4, 340, 560);
        for (let a = 1; a < show; a++) {
          const i = a - 1;
          const g = gcd(a, n);
          const ok = test(a);
          const c = a === 1 || a === n - 1 ? 'var(--surface-2)' : g > 1 ? 'var(--muted)' : ok ? (prime ? 'var(--c-aqua)' : 'var(--c-orange)') : 'var(--c-blue)';
          const r = S('rect', { x: 2 + (i % cols) * cs, y: 2 + Math.floor(i / cols) * cs, width: cs - 2, height: cs - 2, rx: 3, style: 'fill:' + c + ';opacity:' + (a === s.a ? 1 : 0.75) + ';stroke:' + (a === s.a ? 'var(--ink)' : 'none') + ';stroke-width:2' });
          r.appendChild(S('title', null, 'a = ' + a + (g > 1 ? ', НОД = ' + g : ok ? ' — условие выполнено' : ' — свидетель')));
          svg.appendChild(r);
        }
        if (show < n - 1) svgWrap.appendChild(H('div', { style: 'font-size:.82rem;color:var(--ink-2)' }, 'показаны a < 300; лжецы посчитаны по всем a < n'));
      } else svgWrap.appendChild(H('div', { style: 'font-size:.86rem;color:var(--ink-2);margin:6px 0' }, 'n велико — перебор всех оснований не делаем; проверяем первые 12 простых оснований.'));
      const a = Math.min(s.a, n - 2);
      let txt;
      if (s.test === 'fermat') txt = 'a = ' + a + ':  a^(n−1) mod n = ' + a + '^' + grp(n - 1) + ' mod ' + grp(n) + ' = ' + grp(powmod(a, n - 1, n)) + (powmod(a, n - 1, n) === 1 ? '  — как у простого' : '  ≠ 1 — n составное!');
      else {
        let d = n - 1;
        let k = 0;
        while (d % 2 === 0) (d /= 2), k++;
        const seq = [powmod(a, d, n)];
        for (let i = 1; i <= k; i++) seq.push(mulmod(seq[i - 1], seq[i - 1], n));
        txt = 'n − 1 = 2^' + k + ' · ' + grp(d) + ';   a = ' + a + ':  a^d, a^(2d), …, a^(n−1) mod n:\n' + seq.map((v) => (v === n - 1 ? '−1' : grp(v))).join(' → ') + '\n' + (strongProbable(n, a) ? 'начинается с 1 или встречает −1 до конца — как у простого' : 'нет −1 перед первой единицей (или не дошли до 1) — свидетель: ' + (seq.includes(1) ? 'нашёлся нетривиальный корень из 1: ' + grp(seq[seq.indexOf(1) - 1]) + '² ≡ 1, а у простого корни из 1 только ±1' : 'a^(n−1) ≢ 1'));
      }
      detail.textContent = txt;
      const verdict = n > 200000 ? ([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37].every((b) => b >= n || test(b)) ? 'вероятно простое' : 'составное') : liars === total ? 'простое (все a проходят)' : 'составное (свидетель ' + firstW + ')';
      st.set('v', verdict);
      st.set('l', n <= 200000 ? grp(liars) + ' из ' + grp(total) + ' (' + pct(liars / total) + ')' : '—');
      st.set('f', prime ? 'простое' : n <= 1e12 ? fstr(factorize(n)) : 'составное');
      const carm = !prime && n <= 200000 && s.test === 'fermat' && liars === U.range(n - 3, 2).filter((x) => gcd(x, n) === 1).length;
      note.innerHTML = '<b>Тест Ферма:</b> если aⁿ⁻¹ ≢ 1 (mod n), n составное — по малой теореме Ферма. Обратное неверно: 341 = 11·31, но 2³⁴⁰ ≡ 1 (mod 341) — <b>псевдопростое</b> по основанию 2; основание 3 его разоблачает. Хуже <b>числа Кармайкла</b> (561 = 3·11·17, 1105, 1729, …): для них лжецы — <em>все</em> взаимно простые основания. ' + (carm ? 'Сейчас как раз такое число: синие клетки — только основания с общим делителем. ' : '') + '<b>Тест Миллера — Рабина</b> проверяет больше: у простого n единственные корни из 1 — это ±1, поэтому цепочка квадратов a^d, a^(2d), … должна начинаться с 1 или пройти через −1. Для любого составного n лжецов не больше 1/4 — ни одного «числа Кармайкла» нет: у 561 сильных лжецов всего 8 из 558 оснований (не считая тривиальных 1 и n − 1). Двадцать случайных оснований оставляют шанс ошибки меньше 4⁻²⁰ ≈ 10⁻¹², а для чисел до 3·10²⁴ хватает первых 12 простых оснований — проверка становится точной.';
    }
    draw();
  });

  /* ==============================================================================
   * 25. RSA
   * ============================================================================== */
  GBC.widget('rsa', (el) => {
    const PR = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251];
    const s = { p: 61, q: 53, e: 17, msg: 'Бустинг' };
    const w = ui.shell(el, { title: 'RSA своими руками', sub: 'Выберите два простых p и q и открытый показатель e. Закрытый ключ d — обратный к e по модулю φ(n). Каждая буква шифруется как c = mᵉ mod n и расшифровывается как m = cᵈ mod n.' });
    const pS = ui.select(w.controls, { label: 'Простое p', value: s.p, options: PR.map((p) => ({ value: p, label: String(p) })), onChange: (v) => ((s.p = +v), fixE(), draw()) });
    const qS = ui.select(w.controls, { label: 'Простое q', value: s.q, options: PR.map((p) => ({ value: p, label: String(p) })), onChange: (v) => ((s.q = +v), fixE(), draw()) });
    const eBox = H('div');
    w.controls.appendChild(eBox);
    textField(w.controls, { label: 'Сообщение', value: s.msg, help: 'до 16 символов', onChange: (v) => {
      if (!v.length) return 'пустое сообщение';
      s.msg = Array.from(v).slice(0, 16).join('');
      draw();
      return '';
    } });
    const keys = cardGrid(230);
    const tbl = H('div');
    const attack = monoBox('font-size:.86rem');
    w.main.append(keys, tbl, attack);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'n = p·q' }, { key: 'd', label: 'закрытый d' }, { key: 'ok', label: 'расшифровано верно' }]);
    let eSel = null;
    function fixE() {
      const ph = (s.p - 1) * (s.q - 1);
      const cands = [3, 5, 7, 11, 13, 17, 19, 23, 257, 65537].filter((e) => e < ph && gcd(e, ph) === 1);
      if (!cands.includes(s.e)) s.e = cands.includes(17) ? 17 : cands[0];
      eBox.textContent = '';
      eSel = ui.select(eBox, { label: 'Открытый показатель e (НОД(e, φ) = 1)', value: s.e, options: cands.map((e) => ({ value: e, label: String(e) })), onChange: (v) => ((s.e = +v), draw()) });
    }
    w.pythonAction(() => `p, q, e = ${s.p}, ${s.q}, ${s.e}
n, phi = p * q, (p - 1) * (q - 1)
d = pow(e, -1, phi)                       # закрытый ключ: e·d ≡ 1 (mod φ)
msg = ${JSON.stringify(s.msg)}
codes = [ord(ch) for ch in msg]
assert max(codes) < n, "код символа должен быть меньше n"
cipher = [pow(m, e, n) for m in codes]
plain = "".join(chr(pow(c, d, n)) for c in cipher)
print(f"n = {n}, φ = {phi}, e = {e}, d = {d}")
print("коды:", codes)
print("шифр:", cipher)
print("расшифровка:", plain)
f = next(k for k in range(2, n) if n % k == 0)   # «взлом» маленького ключа
print("взлом: n =", f, "·", n // f)`);
    function draw() {
      const { p, q, e } = s;
      const n = p * q;
      const ph = (p - 1) * (q - 1);
      const d = invMod(e, ph);
      keys.textContent = '';
      const c1 = card('Открытый ключ (публикуем)');
      c1.body.appendChild(H('div', { style: 'font-family:var(--font-mono)' }, '(n, e) = (' + grp(n) + ', ' + e + ')'));
      const c2 = card('Закрытый ключ (храним)');
      c2.body.appendChild(H('div', { style: 'font-family:var(--font-mono)' }, 'd = ' + e + '⁻¹ mod ' + grp(ph) + ' = ' + grp(d)));
      const c3 = card('Проверка');
      c3.body.appendChild(H('div', { style: 'font-family:var(--font-mono)' }, 'e·d = ' + grp(e * d) + ' = ' + Math.floor((e * d) / ph) + '·φ + 1'));
      keys.append(c1.el, c2.el, c3.el);
      const chars = Array.from(s.msg);
      let allOk = true;
      const rows = chars.map((ch) => {
        const m = ch.codePointAt(0);
        if (m >= n) {
          allOk = false;
          return [ch, String(m), 'код ≥ n — нужен больший ключ', '', ''];
        }
        const c = powmod(m, e, n);
        const back = powmod(c, d, n);
        if (back !== m) allOk = false;
        return [ch === ' ' ? '␣' : ch, String(m), grp(c), String(back), String.fromCodePoint(back)];
      });
      rowTable(tbl, ['символ', 'код m', 'шифр c = mᵉ mod n', 'cᵈ mod n', 'символ'], rows, null, false);
      let k = 2;
      while (n % k) k++;
      attack.textContent = 'Взлом: злоумышленник знает n = ' + grp(n) + ' и e. Делим n на 2, 3, 4, … — делитель ' + k + ' найден за ' + (k - 1) + ' проверок → φ = ' + grp(ph) + ' → d = ' + grp(d) + '. Ключ из двух трёхзначных простых ломается мгновенно; для n из 617 десятичных цифр (RSA-2048) лучшие алгоритмы требуют больше времени, чем существует Вселенная.';
      st.set('n', grp(n));
      st.set('d', grp(d));
      st.set('ok', allOk ? 'да' : 'нет');
      note.innerHTML = '<b>Почему работает:</b> e·d = 1 + k·φ(n), и по теореме Эйлера m<sup>ed</sup> = m·(m<sup>φ(n)</sup>)<sup>k</sup> ≡ m (mod n) при НОД(m, n) = 1 (а через китайскую теорему — для любого m). <b>Почему безопасно:</b> чтобы найти d, нужно знать φ(n) = (p − 1)(q − 1), то есть разложить n на множители — перемножить легко, разложить трудно. <b>Почему так не делают на практике:</b> «учебный» RSA детерминирован — одинаковые буквы дают одинаковые шифры (посмотрите на таблицу), и по частотам букв сообщение читается без ключа. Настоящий RSA шифрует не буквы, а один большой блок со случайным дополнением (OAEP). Подпись — то же в обратную сторону: s = mᵈ, проверка sᵉ ≡ m.';
    }
    fixE();
    draw();
  });

  /* ==============================================================================
   * 26. Диффи — Хеллман и дискретный логарифм
   * ============================================================================== */
  GBC.widget('diffie-hellman', (el) => {
    const s = { p: 23, a: 6, b: 15, view: 'pow' };
    const w = ui.shell(el, { title: 'Общий секрет через открытый канал', sub: 'Алиса и Боб договариваются о простом p и основании g открыто. Каждый держит в секрете свой показатель и публикует g в этой степени. Общий ключ каждый получает сам, а подслушивающий — нет.' });
    ui.select(w.controls, { label: 'Простое p', value: s.p, options: [23, 101, 1019, 10007, 65537].map((p) => ({ value: p, label: grp(p) })), onChange: (v) => ((s.p = +v), (s.a = Math.min(s.a, s.p - 2)), (s.b = Math.min(s.b, s.p - 2)), draw()) });
    const aS = ui.slider(w.controls, { label: 'Секрет Алисы a', min: 1, max: 1000, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = Math.min(v, s.p - 2)), draw()) });
    const bS = ui.slider(w.controls, { label: 'Секрет Боба b', min: 1, max: 1000, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = Math.min(v, s.p - 2)), draw()) });
    ui.segmented(w.controls, { label: 'График', value: s.view, options: [{ value: 'pow', label: 'gˣ mod p' }, { value: 'lin', label: 'g·x mod p' }], onChange: (v) => ((s.view = v), draw()) });
    const flow = cardGrid(170);
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: '' } });
    w.main.insertBefore(flow, w.main.firstChild);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'основание g' }, { key: 'k', label: 'общий ключ' }, { key: 'dl', label: 'перебор для дискретного логарифма' }]);
    const primRoot = (p) => {
      const fs = factorize(p - 1).map((f) => f[0]);
      for (let g = 2; g < p; g++) if (fs.every((q) => powmod(g, (p - 1) / q, p) !== 1)) return g;
      return null;
    };
    w.pythonAction(() => `p = ${s.p}
fs = [q for q in range(2, p) if (p - 1) % q == 0 and all(q % r for r in range(2, int(q ** 0.5) + 1))]
g = next(g for g in range(2, p) if all(pow(g, (p - 1) // q, p) != 1 for q in fs))   # первообразный корень
a, b = ${s.a}, ${s.b}
A, B = pow(g, a, p), pow(g, b, p)
print(f"g = {g}; Алиса шлёт A = {A}, Боб шлёт B = {B}")
print("ключ Алисы B^a =", pow(B, a, p), " ключ Боба A^b =", pow(A, b, p))
x = next(x for x in range(p) if pow(g, x, p) == A)                  # дискретный логарифм перебором
print("подслушивающий восстановил a перебором:", x)`);
    function draw() {
      const { p } = s;
      aS.setMax && aS.setMax(Math.min(1000, p - 2));
      bS.setMax && bS.setMax(Math.min(1000, p - 2));
      const a = Math.min(s.a, p - 2);
      const b = Math.min(s.b, p - 2);
      const g = primRoot(p);
      const A = powmod(g, a, p);
      const B = powmod(g, b, p);
      const K1 = powmod(B, a, p);
      const K2 = powmod(A, b, p);
      flow.textContent = '';
      const mk = (title, lines, c) => {
        const cc = card(title);
        cc.el.style.borderColor = c;
        lines.forEach((t) => cc.body.appendChild(H('div', { style: 'font-family:var(--font-mono);font-size:.88rem' }, t)));
        flow.appendChild(cc.el);
      };
      mk('Открыто', ['p = ' + grp(p) + ', g = ' + g, 'A = gᵃ mod p = ' + grp(A), 'B = gᵇ mod p = ' + grp(B)], 'var(--border-strong)');
      mk('Алиса знает a = ' + a, ['ключ = Bᵃ mod p', '= ' + grp(B) + '^' + a + ' mod ' + grp(p) + ' = ' + grp(K1)], 'var(--c-blue)');
      mk('Боб знает b = ' + b, ['ключ = Aᵇ mod p', '= ' + grp(A) + '^' + b + ' mod ' + grp(p) + ' = ' + grp(K2)], 'var(--c-orange)');
      const n = Math.min(p - 1, 400);
      const xs = U.range(n);
      const ys = xs.map((x) => (s.view === 'pow' ? powmod(g, x, p) : mulmod(g, x, p)));
      plot.opts.y.label = s.view === 'pow' ? 'gˣ mod p' : 'g·x mod p';
      plot.render([
        { type: 'points', x: xs, y: ys, color: 'model', r: n > 200 ? 2 : 3, opacity: 0.8, tooltip: (i) => ['x = ' + i, (s.view === 'pow' ? 'gˣ' : 'g·x') + ' mod p = ' + ys[i]] },
        s.view === 'pow' && a < n ? { type: 'points', x: [a], y: [A], color: 'tree', r: 7, label: 'A = gᵃ' } : null,
      ], { x: [0, n], y: [0, p] });
      let dl = 0;
      let v = 1;
      while (v !== A) (v = (v * g) % p), dl++;
      st.set('g', String(g));
      st.set('k', K1 === K2 ? grp(K1) + ' = ' + grp(K2) : 'ошибка');
      st.set('dl', grp(dl) + ' ' + plural(dl, 'шаг', 'шага', 'шагов'));
      note.innerHTML = 'Оба получают одно и то же: (gᵇ)ᵃ = (gᵃ)ᵇ = gᵃᵇ (mod p). Подслушивающий видит p, g, A, B, но чтобы получить ключ, ему нужно найти a по A = gᵃ mod p — <b>дискретный логарифм</b>. Сравните графики: g·x mod p — несколько ровных прямых, обратить такую функцию легко (умножить на g⁻¹); gˣ mod p выглядит как шум — степень по модулю перемешивает остатки, и лучшие известные алгоритмы для p из 600 цифр работают дольше жизни Вселенной. Основание g берут <b>первообразным корнем</b> (шаг 19): тогда gˣ пробегает все ненулевые остатки, и секрет нельзя угадать среди малого числа вариантов. Классический пример: p = 23, g = 5, a = 6, b = 15 → A = 8, B = 19, общий ключ 2. Протокол — основа HTTPS (в современной форме — на эллиптических кривых).';
    }
    draw();
  });
})();
