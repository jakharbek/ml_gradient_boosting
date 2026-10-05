/* Урок 15.20: теория чисел. Часть 3 — числа в компьютере, случайность и хеширование.
 * Виджеты: битовые операции; колесо целых фиксированной ширины (переполнение, дополнительный код);
 * деление столбиком в любой системе (период дроби); биты числа с плавающей точкой (IEEE 754); сетка
 * представимых чисел; порядок суммирования и точная сумма; float32 и пороги деревьев; линейный
 * конгруэнтный генератор и его граф; тройки генератора в 3D (RANDU); Mulberry32 по шагам и лавинный
 * эффект; смещение по модулю; хеширование категорий; коллизии и парадокс дней рождения; стабильное
 * хеш-разбиение; параллельные суммы и выбор разбиения; тренажёр.
 * Помощники — из GBC.lesson1520 (часть 1, lesson.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const {
    f2, f3, grp, pct, plural, minus, sup, SER, cvar, tint, flexRow, card, cardGrid, badge, chip, rowTable, monoBox, svgBox, sText, legendRow, intField, textField,
    RGB, mixRGB, seqScale, pixelCanvas, mod, gcd, factorize, fstr, powmod,
  } = GBC.lesson1520;
  const MASK = 0xffffffff;
  const hex32 = (x) => '0x' + (x >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const bin = (x, w) => (x >>> 0).toString(2).padStart(w, '0').slice(-w);
  const popcount = (x) => {
    x >>>= 0;
    let c = 0;
    while (x) (x &= x - 1), c++;
    return c;
  };
  /** Смешивающая функция Mulberry32 (то, что делается после прибавления константы). */
  function mix32(a) {
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  }
  /** Точная сумма (алгоритм Шевчука, как math.fsum в Python, включая финальное округление). */
  function fsum(xs) {
    const partials = [];
    for (let x of xs) {
      let i = 0;
      for (let y of partials) {
        if (Math.abs(x) < Math.abs(y)) [x, y] = [y, x];
        const hi = x + y;
        const lo = y - (hi - x);
        if (lo) partials[i++] = lo;
        x = hi;
      }
      partials.length = i;
      partials.push(x);
    }
    let n = partials.length;
    let hi = 0;
    let lo = 0;
    if (n > 0) {
      hi = partials[--n];
      while (n > 0) {
        const x = hi;
        const y = partials[--n];
        hi = x + y;
        const yr = hi - x;
        lo = y - yr;
        if (lo) break;
      }
      if (n > 0 && ((lo < 0 && partials[n - 1] < 0) || (lo > 0 && partials[n - 1] > 0))) {
        const y = lo * 2;
        const x = hi + y;
        const yr = x - hi;
        if (y === yr) hi = x;
      }
    }
    return hi;
  }
  const ulpOf = (x) => {
    if (x === 0) return Number.MIN_VALUE;
    const e = Math.floor(Math.log2(Math.abs(x)));
    let u = Math.pow(2, e - 52);
    // поправка на неточность log2 у границ степеней двойки
    if (Math.abs(x) >= Math.pow(2, e + 1)) u *= 2;
    if (Math.abs(x) < Math.pow(2, e)) u /= 2;
    return Math.max(u, Number.MIN_VALUE);
  };

  /* ==============================================================================
   * 27. Биты и битовые операции
   * ============================================================================== */
  GBC.widget('bit-ops', (el) => {
    const s = { a: 200, b: 108, op: 'and', k: 4 };
    const w = ui.shell(el, { title: 'Битовые операции — это арифметика', sub: 'Щёлкайте по битам a и b. Каждая операция действует на все разряды сразу; у многих есть арифметический смысл: остаток, деление, проверка степени двойки.' });
    ui.select(w.controls, { label: 'Операция', value: s.op, options: [
      { value: 'and', label: 'a AND b (a & b)' }, { value: 'or', label: 'a OR b (a | b)' }, { value: 'xor', label: 'a XOR b (a ^ b)' }, { value: 'not', label: 'NOT a (~a, 8 бит)' },
      { value: 'shl', label: 'a << k (сдвиг влево)' }, { value: 'shr', label: 'a >> k (сдвиг вправо)' }, { value: 'mask', label: 'a & (2ᵏ − 1)' }, { value: 'low', label: 'a & (a − 1)' }, { value: 'lsb', label: 'a & (−a)' },
    ], onChange: (v) => ((s.op = v), draw()) });
    ui.slider(w.controls, { label: 'k', min: 0, max: 7, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const svgWrap = H('div');
    const line = monoBox('text-align:center;font-size:.95rem');
    w.main.append(svgWrap, line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'r', label: 'результат' }]);
    const OPS = {
      and: [(a, b) => a & b, 'a & b'], or: [(a, b) => a | b, 'a | b'], xor: [(a, b) => a ^ b, 'a ^ b'], not: [(a) => ~a & 255, '~a & 0xFF'],
      shl: [(a, b, k) => (a << k) & 255, '(a << k) & 0xFF'], shr: [(a, b, k) => a >> k, 'a >> k'], mask: [(a, b, k) => a & ((1 << k) - 1), 'a & ((1 << k) - 1)'],
      low: [(a) => a & (a - 1), 'a & (a - 1)'], lsb: [(a) => a & -a & 255, 'a & -a'],
    };
    w.pythonAction(() => `a, b, k = ${s.a}, ${s.b}, ${s.k}
r = ${OPS[s.op][1]}
print(f"a = {a:08b} ({a}),  b = {b:08b} ({b})")
print(f"${OPS[s.op][1]} = {r:08b} = {r}")
print("a mod 2**k =", a % 2 ** k, "== a & (2**k − 1):", a % 2 ** k == a & (2 ** k - 1))
print("a // 2**k  =", a // 2 ** k, "== a >> k:", a // 2 ** k == a >> k)
print("степень двойки?", a > 0 and a & (a - 1) == 0, "  единиц в записи:", bin(a).count("1"))`);
    function draw() {
      const { a, b, k, op } = s;
      const r = OPS[op][0](a, b, k);
      const usesB = ['and', 'or', 'xor'].includes(op);
      svgWrap.textContent = '';
      const cs = 40;
      const svg = svgBox(svgWrap, 8 * cs + 90, 3 * 48 + 24, 340, 520);
      const rows = [['a', a, true], ['b', b, usesB], ['результат', r, true]];
      for (let i = 0; i < 8; i++) svg.appendChild(sText(80 + i * cs + cs / 2, 10, '2' + sup(7 - i), { size: 10, color: 'var(--ink-2)' }));
      rows.forEach(([name, v, active], ri) => {
        const y = 22 + ri * 48;
        svg.appendChild(sText(38, y + 18, name, { size: 12, color: active ? 'var(--ink)' : 'var(--muted)', anchor: 'middle' }));
        for (let i = 0; i < 8; i++) {
          const bit = (v >> (7 - i)) & 1;
          const c = ri === 2 ? 'var(--c-orange)' : 'var(--c-blue)';
          const rect = S('rect', { x: 80 + i * cs + 3, y, width: cs - 6, height: 36, rx: 7, style: 'cursor:' + (ri < 2 ? 'pointer' : 'default') + ';fill:' + (bit ? tint(c, active ? 55 : 20) : 'var(--surface-2)') + ';stroke:' + (bit ? c : 'var(--border)') + ';stroke-width:1.5;opacity:' + (active ? 1 : 0.5) });
          if (ri < 2)
            rect.addEventListener('click', () => {
              if (ri === 0) s.a ^= 1 << (7 - i);
              else s.b ^= 1 << (7 - i);
              draw();
            });
          svg.appendChild(rect);
          const t = sText(80 + i * cs + cs / 2, y + 18, String(bit), { mono: true, bold: true, size: 15, color: bit ? 'var(--ink)' : 'var(--muted)' });
          t.style.pointerEvents = 'none';
          svg.appendChild(t);
        }
      });
      if (op === 'mask' || op === 'shr' || op === 'shl') {
        const x0 = op === 'mask' ? 80 + (8 - k) * cs : op === 'shr' ? 80 + (8 - k) * cs : 80;
        const wd = op === 'shl' ? k * cs : k * cs;
        if (k > 0) svg.appendChild(S('rect', { x: x0, y: 18, width: wd, height: 44, rx: 8, style: 'fill:none;stroke:var(--c-orange);stroke-width:2;stroke-dasharray:5 4;pointer-events:none' }));
      }
      const meaning = {
        and: 'бит 1 там, где 1 у обоих — пересечение множеств разрядов',
        or: 'бит 1 там, где 1 хотя бы у одного — объединение',
        xor: 'бит 1 там, где биты различны — сложение по модулю 2 в каждом разряде без переноса',
        not: 'все биты наоборот: ~a = 255 − a (в 8 битах)',
        shl: 'умножение на 2ᵏ по модулю 256: старшие ' + k + ' бит вылетают',
        shr: 'деление нацело на 2ᵏ: ⌊' + a + ' / ' + (1 << k) + '⌋ = ' + (a >> k),
        mask: 'остаток от деления на 2ᵏ: ' + a + ' mod ' + (1 << k) + ' = ' + (a & ((1 << k) - 1)),
        low: 'обнуляет младшую единицу; результат 0 ⇔ a — степень двойки',
        lsb: 'оставляет только младшую единицу: наибольшая степень двойки, делящая a',
      };
      line.textContent = OPS[op][1] + ' = ' + bin(r, 8) + '₂ = ' + r + '   —   ' + meaning[op];
      st.set('a', a + ' = 0x' + a.toString(16).toUpperCase().padStart(2, '0'));
      st.set('b', b + ' = 0x' + b.toString(16).toUpperCase().padStart(2, '0'));
      st.set('r', String(r));
      note.innerHTML = 'Остаток от деления на степень двойки — это просто младшие биты: <code>x % 2**k == x &amp; (2**k − 1)</code>, а частное — сдвиг: <code>x // 2**k == x &gt;&gt; k</code>. Поэтому хеш-таблицы любят размеры 2ᵏ (остаток — одна операция AND), но расплачиваются тем, что видят только младшие биты ключа (шаг 38). Ещё два полезных трюка: <code>x &amp; (x − 1) == 0</code> — проверка «x — степень двойки», а маска из n бит — подмножество n признаков: перебор всех масок от 0 до 2ⁿ − 1 перебирает все подмножества (урок 15.17). ' + (op === 'xor' ? 'XOR — это сложение по модулю 2 без переноса; на нём построены смешивание в Mulberry32 (шаг 36) и контрольные суммы.' : '');
    }
    draw();
  });

  /* ==============================================================================
   * 28. Целые фиксированной ширины: колесо, переполнение, дополнительный код
   * ============================================================================== */
  GBC.widget('int-wheel', (el) => {
    const s = { w: 4, x: 6, k: 5, op: '+' };
    const w = ui.shell(el, { title: 'Целые из w бит живут на колесе', sub: 'w бит дают 2ʷ значений, и арифметика идёт по модулю 2ʷ. Снаружи — беззнаковое чтение битов, внутри — со знаком (дополнительный код). Переполнение — переход через «шов».' });
    ui.slider(w.controls, { label: 'Ширина w, бит', values: [3, 4, 5, 6, 8], value: s.w, format: String, onInput: (v) => ((s.w = v), (s.x = s.x % (1 << v)), draw()) });
    ui.slider(w.controls, { label: 'x (беззнаковое)', min: 0, max: 255, step: 1, value: s.x, format: String, onInput: (v) => ((s.x = v % (1 << s.w)), draw()) });
    ui.slider(w.controls, { label: 'k', min: 0, max: 40, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.segmented(w.controls, { label: 'Операция', value: s.op, options: [{ value: '+', label: 'x + k' }, { value: '−', label: 'x − k' }, { value: '×', label: 'x × k' }, { value: 'neg', label: '−x = ~x + 1' }], onChange: (v) => ((s.op = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, equal: true, grid: 'none', x: { label: '', ticks: [], domain: [-1.32, 1.32] }, y: { label: '', ticks: [], domain: [-1.25, 1.25] }, margin: { left: 4, bottom: 4, right: 4, top: 4 } });
    const line = monoBox('text-align:center');
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'u', label: 'беззнаковое' }, { key: 's', label: 'со знаком' }, { key: 'o', label: 'переполнение' }]);
    w.pythonAction(() => `import numpy as np

w, x, k = ${s.w}, ${s.x}, ${s.k}
M = 2 ** w
signed = lambda v: v - M if v >= M // 2 else v
r = (${s.op === '+' ? 'x + k' : s.op === '−' ? 'x - k' : s.op === '×' ? 'x * k' : '-x'}) % M
print(f"результат: {r} = {r:0{w}b}, со знаком {signed(r)}")
print("numpy uint8 200 + 100 =", np.array([200], np.uint8) + np.uint8(100))
print("numpy int32 50000 * 50000 =", np.array([50000], np.int32) * np.int32(50000))
print("−5 в int8 — это биты", f"{np.int8(-5).view(np.uint8):08b}")`);
    function draw() {
      const W = s.w;
      const M = 1 << W;
      const x = s.x % M;
      const k = s.k;
      const raw = s.op === '+' ? x + k : s.op === '−' ? x - k : s.op === '×' ? x * k : -x;
      const r = mod(raw, M);
      const sg = (v) => (v >= M / 2 ? v - M : v);
      const ks = U.range(M);
      const ang = (v) => (2 * Math.PI * v) / M;
      const P = (v, rr) => [rr * Math.sin(ang(v)), rr * Math.cos(ang(v))];
      const ring = U.linspace(0, 1, 240).map((t) => P(t * M, 1));
      const L = [{ type: 'line', x: ring.map((p) => p[0]), y: ring.map((p) => p[1]), color: 'muted', width: 2, hover: false }];
      const seam = P(M / 2 - 0.5, 1);
      L.push({ type: 'segments', x1: [seam[0] * 0.75], y1: [seam[1] * 0.75], x2: [seam[0] * 1.08], y2: [seam[1] * 1.08], color: 'critical', width: 3, opacity: 0.9 });
      const zseam = P(-0.5, 1);
      L.push({ type: 'segments', x1: [zseam[0] * 0.75], y1: [zseam[1] * 0.75], x2: [zseam[0] * 1.08], y2: [zseam[1] * 1.08], color: 'orange', width: 3, opacity: 0.9 });
      if (s.op === '+' || s.op === '−') {
        const len = s.op === '+' ? k : -k;
        const arc = U.linspace(x, x + len, Math.max(2, Math.abs(len) * 6)).map((t) => P(t, 0.86));
        L.push({ type: 'line', x: arc.map((p) => p[0]), y: arc.map((p) => p[1]), color: 'tree', width: 3, hover: false });
      }
      L.push({ type: 'points', x: ks.map((v) => P(v, 1)[0]), y: ks.map((v) => P(v, 1)[1]), color: 'muted', r: M > 64 ? 1.5 : 3.5 });
      L.push({ type: 'points', x: [P(x, 1)[0]], y: [P(x, 1)[1]], color: 'model', r: 8, label: 'x' });
      L.push({ type: 'points', x: [P(r, 1)[0]], y: [P(r, 1)[1]], color: 'tree', r: 8, label: 'результат' });
      const step = M <= 16 ? 1 : M <= 64 ? 4 : 32;
      const lab = ks.filter((v) => v % step === 0 || v === x || v === r || v === M / 2 || v === M / 2 - 1);
      L.push({ type: 'text', items: lab.map((v) => ({ x: P(v, 1.15)[0], y: P(v, 1.15)[1], dy: 4, anchor: 'middle', text: String(v), bold: v === r || v === x })) });
      L.push({ type: 'text', items: lab.map((v) => ({ x: P(v, 0.68)[0], y: P(v, 0.68)[1], dy: 4, anchor: 'middle', text: minus(sg(v)), color: sg(v) < 0 ? 'orange' : 'ink2' })) });
      plot.render(L);
      const uOver = raw < 0 || raw >= M;
      const sRaw = s.op === '+' ? sg(x) + k : s.op === '−' ? sg(x) - k : s.op === '×' ? sg(x) * k : -sg(x);
      const sOver = sRaw < -M / 2 || sRaw >= M / 2;
      line.textContent = (s.op === 'neg' ? '−' + x : x + ' ' + s.op + ' ' + k) + ' = ' + minus(raw) + ' ≡ ' + r + ' (mod ' + M + ')   биты ' + bin(r, W) + (s.op === 'neg' ? '   (~' + bin(x, W) + ' = ' + bin(~x & (M - 1), W) + ', +1)' : '');
      st.set('u', String(r));
      st.set('s', minus(sg(r)));
      st.set('o', (uOver ? 'беззнаковое' : '') + (uOver && sOver ? ' и ' : '') + (sOver ? 'знаковое' : '') || 'нет');
      note.innerHTML = 'Регистр из ' + W + ' бит хранит остаток по модулю 2<sup>' + W + '</sup> = ' + M + ': при выходе за край (оранжевая черта между ' + (M - 1) + ' и 0) счёт просто продолжается по кругу. Беззнаковое чтение — числа 0…' + (M - 1) + ' (снаружи). <b>Дополнительный код</b> читает верхнюю половину колеса как отрицательные числа (внутри): битов ' + bin(M - 1, W) + ' — это −1, ведь −1 ≡ ' + (M - 1) + ' (mod ' + M + '). Поэтому процессору не нужен отдельный вычитатель: x − k = x + (~k + 1). Знаковое переполнение — переход через красную черту между ' + (M / 2 - 1) + ' и ' + minus(-M / 2) + '. В Python целые бесконечны, но numpy и pandas работают с фиксированной шириной: <code>np.uint8(200) + 100</code> даёт 44, а 50 000 · 50 000 в int32 — −1 794 967 296. Классические жертвы: картинки в uint8 при сложении яркостей и суммы счётчиков в int32.';
    }
    draw();
  });

  /* ==============================================================================
   * 29. Деление столбиком: конечные и периодические дроби в любой системе
   * ============================================================================== */
  GBC.widget('long-division', (el) => {
    const s = { p: 1, q: 7, b: 10 };
    const w = ui.shell(el, { title: 'Дробь p/q в системе с основанием b', sub: 'Делим столбиком: остаток умножаем на b, частное — очередная цифра, новый остаток — дальше. Остатков меньше q, поэтому они обязаны повториться — и цифры зациклятся.' });
    const pS = ui.slider(w.controls, { label: 'Числитель p', min: 1, max: 60, step: 1, value: s.p, format: String, onInput: (v) => ((s.p = v), draw()) });
    const qS = ui.slider(w.controls, { label: 'Знаменатель q', min: 2, max: 120, step: 1, value: s.q, format: String, onInput: (v) => ((s.q = v), draw()) });
    const bS = ui.segmented(w.controls, { label: 'Основание', value: s.b, options: [{ value: 2, label: '2' }, { value: 3, label: '3' }, { value: 10, label: '10' }, { value: 16, label: '16' }], onChange: (v) => ((s.b = v), draw()) });
    const presets = flexRow('margin-top:4px');
    [['1/7', 1, 7, 10], ['1/8', 1, 8, 10], ['1/6', 1, 6, 10], ['0.1 в двоичной', 1, 10, 2], ['1/97', 1, 97, 10]].forEach(([t, p, q, b]) => presets.appendChild(ui.button(null, { label: t, small: true, onClick: () => ((s.p = p), (s.q = q), (s.b = b), pS.set(p), qS.set(q), bS.set(b), draw()) })));
    w.controls.appendChild(presets);
    const digits = H('div');
    const tbl = H('div');
    w.main.append(digits, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pre', label: 'предпериод' }, { key: 'per', label: 'период' }, { key: 'fin', label: 'конечная?' }]);
    w.pythonAction(() => `p, q, b = ${s.p}, ${s.q}, ${s.b}
DIG = "0123456789ABCDEF"
whole, r = divmod(p, q)
seen, digits = {}, []
while r and r not in seen:
    seen[r] = len(digits)
    d, r = divmod(r * b, q)
    digits.append(DIG[d])
if r:
    i = seen[r]
    print(f"{p}/{q} = {whole}.{''.join(digits[:i])}({''.join(digits[i:])})  в системе {b}; период {len(digits) - i}")
else:
    print(f"{p}/{q} = {whole}.{''.join(digits) or '0'}  в системе {b} — конечная")
print("0.1 в памяти компьютера:", f"{0.1:.30f}")`);
    function draw() {
      const { p, q, b } = s;
      const whole = Math.floor(p / q);
      let r = p % q;
      const seen = new Map();
      const rows = [];
      const ds = [];
      while (r && !seen.has(r) && ds.length < 400) {
        seen.set(r, ds.length);
        const d = Math.floor((r * b) / q);
        const nr = (r * b) % q;
        rows.push([String(ds.length + 1), String(r), r + '·' + b + ' = ' + r * b, '0123456789ABCDEF'[d], String(nr)]);
        ds.push(d);
        r = nr;
      }
      const pre = r ? seen.get(r) : ds.length;
      const per = r ? ds.length - pre : 0;
      digits.textContent = '';
      const row = flexRow('gap:3px;margin:6px 0;justify-content:flex-start');
      row.appendChild(H('span', { style: 'font-family:var(--font-mono);font-size:1.05rem;margin-right:4px' }, p + '/' + q + ' = ' + whole + '.'));
      const shown = ds.slice(0, 60);
      shown.forEach((d, i) => row.appendChild(chip('0123456789ABCDEF'[d], i >= pre && r ? 'on' : null, 'var(--c-orange)')));
      if (ds.length > 60) row.appendChild(H('span', null, '…'));
      if (r) row.appendChild(H('span', { style: 'font-size:.85rem;color:var(--ink-2);margin-left:4px' }, '(период ' + per + ')'));
      if (!ds.length) row.appendChild(chip('0', null));
      row.appendChild(H('span', { style: 'font-size:.85rem;color:var(--ink-2);margin-left:6px' }, 'в системе ' + b));
      digits.appendChild(row);
      const tb = rows.length > 20 ? rows.slice(0, 20).concat([['…', '', '', '', '']]) : rows;
      rowTable(tbl, ['шаг', 'остаток r', 'r·b', 'цифра ⌊r·b / q⌋', 'новый остаток'], tb, (i) => r && i === pre);
      // теория: q = q1·q2, q1 — из простых, делящих b
      const g = gcd(p, q);
      const q0 = q / g;
      let q2 = q0;
      const bp = factorize(b).map((f) => f[0]);
      bp.forEach((pp) => {
        while (q2 % pp === 0) q2 /= pp;
      });
      st.set('pre', String(pre));
      st.set('per', r ? String(per) : '0');
      st.set('fin', r ? 'нет' : 'да');
      note.innerHTML = 'Остатки r лежат в 0…q − 1, поэтому за не более чем q шагов какой-то повторится, и с этого места цифры пойдут по кругу: <b>каждое рациональное число — конечная или периодическая дробь</b>. Когда дробь конечна? Сократим: ' + p + '/' + q + ' = ' + p / g + '/' + q0 + '. Дробь конечна, только если в знаменателе нет других простых, кроме делителей основания (' + bp.join(', ') + '). ' + (q2 > 1 ? 'Здесь в знаменателе остаётся ' + q2 + ', поэтому дробь бесконечна, а длина периода — порядок ' + b + ' по модулю ' + q2 + ' (наименьшее k с ' + b + 'ᵏ ≡ 1, шаг 19): ' + per + '. ' : 'Здесь так и есть — дробь конечна. ') + 'Отсюда главный факт о компьютерах: в двоичной системе конечны только дроби со знаменателем 2ᵏ, а 0.1 = 1/10 = 1/(2·5) — бесконечная периодическая 0.0(0011)₂. Компьютер хранит её обрезанной до 53 значащих бит (шаг 30), как мы обрезаем 1/3 = 0.333… .';
    }
    draw();
  });

  /* ==============================================================================
   * 30. Биты числа с плавающей точкой (IEEE 754)
   * ============================================================================== */
  function exactDecimal(mant, e2) {
    // mant·2^e2 (mant — BigInt ≥ 0) точно в десятичной записи
    if (e2 >= 0) return (mant << BigInt(e2)).toString();
    const k = -e2;
    const num = mant * 5n ** BigInt(k);
    let str = num.toString().padStart(k + 1, '0');
    const ip = str.slice(0, str.length - k);
    let fp = str.slice(str.length - k).replace(/0+$/, '');
    return ip + (fp ? '.' + fp : '');
  }
  GBC.widget('float-bits', (el) => {
    const s = { txt: '0.1', fmt: 64, v: 0.1 };
    const w = ui.shell(el, { title: 'Как устроено число с плавающей точкой', sub: 'Число хранится как (−1)ˢ · 1.f · 2ᵉ⁻ᵇⁱᵃˢ: бит знака, порядок и мантисса. Введите число и посмотрите, какое значение компьютер хранит на самом деле.' });
    const tf = textField(w.controls, { label: 'Число (можно 1/3, 2^53, nan, inf)', value: s.txt, help: '', onChange: (v) => {
      const t = v.trim().toLowerCase().replace(',', '.').replace(/\s/g, '');
      let x;
      if (/^-?\d+\/\d+$/.test(t)) {
        const [a, b] = t.split('/').map(Number);
        x = a / b;
      } else if (/^-?\d+\^-?\d+$/.test(t)) {
        const [a, b] = t.split('^').map(Number);
        x = Math.pow(a, b);
      } else if (t === 'nan') x = NaN;
      else if (t === 'inf' || t === '+inf') x = Infinity;
      else if (t === '-inf') x = -Infinity;
      else if (t === '-0') x = -0;
      else if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/.test(t)) x = Number(t);
      else return 'не понимаю число';
      s.txt = v.trim();
      s.v = x;
      draw();
      return '';
    } });
    ui.segmented(w.controls, { label: 'Формат', value: s.fmt, options: [{ value: 64, label: 'float64 (double)' }, { value: 32, label: 'float32 (single)' }], onChange: (v) => ((s.fmt = v), draw()) });
    const presets = flexRow('margin-top:4px');
    ['0.1', '1', '1/3', '2^53', '16777217', '-0', '1e308', '5e-324', 'nan'].forEach((t) => presets.appendChild(ui.button(null, { label: t, small: true, onClick: () => (tf.set(t), tf.inp.dispatchEvent(new Event('change'))) })));
    w.controls.appendChild(presets);
    const nav = flexRow('margin-top:6px');
    nav.appendChild(ui.button(null, { label: '← соседнее меньшее', small: true, onClick: () => step(-1) }));
    nav.appendChild(ui.button(null, { label: 'соседнее большее →', small: true, onClick: () => step(1) }));
    w.controls.appendChild(nav);
    const svgWrap = H('div');
    const dec = H('div');
    w.main.append(svgWrap, legendRow([['var(--c-magenta)', 'знак'], ['var(--c-orange)', 'порядок'], ['var(--c-blue)', 'мантисса (дробная часть)']]), dec);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'порядок e' }, { key: 'u', label: 'шаг до соседа (ulp)' }, { key: 'x', label: 'хранится точно?' }]);
    const conf = () => (s.fmt === 64 ? { E: 11, F: 52, bias: 1023 } : { E: 8, F: 23, bias: 127 });
    function getBits(x) {
      if (s.fmt === 64) {
        const dv = new DataView(new ArrayBuffer(8));
        dv.setFloat64(0, x);
        return (BigInt(dv.getUint32(0)) << 32n) | BigInt(dv.getUint32(4));
      }
      const dv = new DataView(new ArrayBuffer(4));
      dv.setFloat32(0, x);
      return BigInt(dv.getUint32(0));
    }
    function fromBits(b) {
      if (s.fmt === 64) {
        const dv = new DataView(new ArrayBuffer(8));
        dv.setUint32(0, Number(b >> 32n));
        dv.setUint32(4, Number(b & 0xffffffffn));
        return dv.getFloat64(0);
      }
      const dv = new DataView(new ArrayBuffer(4));
      dv.setUint32(0, Number(b));
      return dv.getFloat32(0);
    }
    function step(dir) {
      const stored = s.fmt === 64 ? s.v : Math.fround(s.v);
      if (!Number.isFinite(stored)) return;
      let b = getBits(stored);
      const neg = stored < 0 || Object.is(stored, -0);
      if (stored === 0) b = dir > 0 ? 1n : (1n << BigInt(s.fmt - 1)) | 1n;
      else b += (dir > 0) !== neg ? 1n : -1n;
      s.v = fromBits(b);
      s.txt = String(s.v);
      tf.set(s.txt);
      draw();
    }
    w.pythonAction(() => `import struct
from decimal import Decimal
import numpy as np

x = ${Number.isNaN(s.v) ? 'float("nan")' : !Number.isFinite(s.v) ? (s.v > 0 ? 'float("inf")' : 'float("-inf")') : Object.is(s.v, -0) ? '-0.0' : JSON.stringify(s.v)}
bits = struct.unpack(">Q", struct.pack(">d", x))[0]
b = f"{bits:064b}"
print("float64:", b[0], b[1:12], b[12:])
print("порядок:", int(b[1:12], 2) - 1023, " хранится ровно:", Decimal(x))
print("float32:", Decimal(float(np.float32(x))))
print("соседи:", np.nextafter(x, -np.inf), np.nextafter(x, np.inf), " ulp:", np.spacing(x))`);
    function draw() {
      const { E, F, bias } = conf();
      const N = 1 + E + F;
      const stored = s.fmt === 64 ? s.v : Math.fround(s.v);
      const bits = getBits(stored);
      const str = bits.toString(2).padStart(N, '0');
      svgWrap.textContent = '';
      const cw = 20;
      const per = 32;
      const nRows = N / per;
      const W = per * cw + 8;
      const svg = svgBox(svgWrap, W, nRows * 42 + 8, 380, W * 1.1);
      for (let i = 0; i < N; i++) {
        const c = i === 0 ? 'var(--c-magenta)' : i <= E ? 'var(--c-orange)' : 'var(--c-blue)';
        const bit = str[i] === '1';
        const x = 4 + (i % per) * cw;
        const y = 6 + Math.floor(i / per) * 42;
        svg.appendChild(S('rect', { x, y, width: cw - 1.5, height: 30, rx: 2.5, style: 'fill:' + (bit ? tint(c, 60) : tint(c, 10)) + ';stroke:' + c + ';stroke-width:.8' }));
        svg.appendChild(sText(x + (cw - 1.5) / 2, y + 15, str[i], { mono: true, size: 12, bold: bit, color: bit ? 'var(--ink)' : 'var(--muted)' }));
      }
      const sign = str[0] === '1';
      const ebits = parseInt(str.slice(1, 1 + E), 2);
      const frac = BigInt('0b' + str.slice(1 + E));
      dec.textContent = '';
      const rows = [];
      let exactStr = '';
      let eUnb = '—';
      if (ebits === (1 << E) - 1) rows.push(['особое значение', frac ? 'NaN (не число): порядок из одних единиц, мантисса ≠ 0' : (sign ? '−' : '+') + '∞: порядок из одних единиц, мантисса = 0']);
      else {
        const sub = ebits === 0;
        const mant = sub ? frac : (1n << BigInt(F)) | frac;
        const e2 = (sub ? 1 - bias : ebits - bias) - F;
        eUnb = sub ? (1 - bias) + ' (денормализованное)' : String(ebits - bias);
        exactStr = (sign ? '−' : '') + exactDecimal(mant, e2);
        rows.push(['знак', sign ? '1 → минус' : '0 → плюс']);
        rows.push(['порядок', str.slice(1, 1 + E) + '₂ = ' + ebits + (sub ? ' → денормализованное: 0.f · 2^' + (1 - bias) : ' → e = ' + ebits + ' − ' + bias + ' = ' + (ebits - bias))]);
        rows.push(['мантисса', (sub ? '0.' : '1.') + str.slice(1 + E).replace(/0+$/, '') + (frac ? '' : '0') + '₂']);
        rows.push(['значение', (sign ? '−' : '') + (sub ? '0.f' : '1.f') + ' · 2^' + (sub ? 1 - bias : ebits - bias) + ' = ' + mant.toString() + ' · 2^' + e2]);
        rows.push(['хранится ровно', exactStr.length > 80 ? exactStr.slice(0, 78) + '…' : exactStr]);
      }
      rowTable(dec, ['часть', 'значение'], rows, (i) => i === rows.length - 1, false);
      const ulp = Number.isFinite(stored) ? (s.fmt === 64 ? ulpOf(stored) : Math.abs(Math.fround(fromBits(getBits(Math.abs(stored)) + 1n)) - Math.abs(stored))) : NaN;
      const typed = s.txt.replace(',', '.').replace(/^\+/, '');
      const same = exactStr && (exactStr === typed || exactStr === typed.replace(/\.0+$/, '') || (Number.isInteger(stored) && Math.abs(stored) < 1e21 && exactStr === String(BigInt(stored))));
      st.set('e', eUnb);
      st.set('u', Number.isFinite(ulp) ? U.fmt(ulp, 3) : '—');
      st.set('x', !exactStr ? '—' : /[\/\^e]/.test(typed) ? (exactStr.length < 30 ? 'вот так: ' + exactStr : 'см. «хранится ровно»') : same ? 'да' : 'нет, округлено');
      note.innerHTML = 'Мантисса хранит ' + F + ' бит после ведущей единицы (её не пишут — экономят бит), всего ' + (F + 1) + ' значащих двоичных цифр ≈ ' + (s.fmt === 64 ? '15–17' : '7–8') + ' десятичных. Порядок сдвинут на ' + bias + ', чтобы хранить и отрицательные степени. Значит, представимы только числа <b>вида целое · 2ᵏ</b>, а остальные округляются к ближайшему такому: 0.1 хранится как 0.1000000000000000055511151231257827…, а во float32 — как 0.100000001490116119384765625. Особые значения: порядок из нулей — ноль и денормализованные числа (до 5·10⁻³²⁴ в float64), из единиц — ∞ и NaN; бывает даже −0. Кнопки «соседнее» прибавляют к битам единицу: соседние числа — соседние целые в битовой записи (поэтому сравнение float по битам почти работает, как сравнение целых).';
    }
    draw();
  });

  /* ==============================================================================
   * 31. Сетка представимых чисел: ulp и машинный эпсилон
   * ============================================================================== */
  GBC.widget('float-gaps', (el) => {
    const s = { mode: 'toy', e: 16, x: 5.3, mb: 3 };
    const w = ui.shell(el, { title: 'Сетка представимых чисел', sub: 'Числа с плавающей точкой — конечная сетка на прямой. В каждом отрезке [2ᵉ, 2ᵉ⁺¹) их поровну, поэтому шаг растёт вместе с числом. Слева — игрушечный формат, справа — настоящий float64.' });
    ui.segmented(w.controls, { label: 'Формат', value: s.mode, options: [{ value: 'toy', label: 'игрушечный' }, { value: 'f64', label: 'float64' }], onChange: (v) => ((s.mode = v), draw()) });
    const mbS = ui.slider(w.controls, { label: 'Бит мантиссы после точки', min: 1, max: 4, step: 1, value: s.mb, format: String, onInput: (v) => ((s.mb = v), draw()) });
    const xS = ui.slider(w.controls, { label: 'Округлить x', min: 0, max: 16, step: 0.01, value: s.x, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.x = v), draw()) });
    const eS = ui.slider(w.controls, { label: 'Число x = 10ᵏ, k', min: -3, max: 20, step: 1, value: s.e, format: (v) => '10' + sup(v), onInput: (v) => ((s.e = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: '' } });
    const demo = monoBox('font-size:.85rem');
    w.main.appendChild(demo);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '' }, { key: 'b', label: '' }, { key: 'c', label: '' }]);
    const stK = w.foot.querySelectorAll('.stat .k');
    const setLabels = (arr) => arr.forEach((t, i) => (stK[i].textContent = t));
    const fy = (v) => '10' + sup(Math.round(Math.log10(v)));
    w.pythonAction(() => s.mode === 'toy' ? `mb = ${s.mb}                                   # бит мантиссы после точки
grid = sorted({(1 + f / 2 ** mb) * 2.0 ** e for e in range(-2, 4) for f in range(2 ** mb)} | {0.0})
print("представимые числа:", grid)
x = ${s.x}
near = min(grid, key=lambda g: abs(g - x))
print(f"x = {x} округляется к {near}, относительная ошибка {abs(near - x) / x:.3%}")
print("машинный эпсилон 2**-mb =", 2 ** -mb)` : `import numpy as np

for k in (0, 8, 15, 16, 20):
    x = 10.0 ** k
    print(f"x = 1e{k:<2}: ulp = {np.spacing(x):.3g}, ulp/x = {np.spacing(x) / x:.2g}, x + 1 == x: {x + 1 == x}")
print("машинный эпсилон:", np.finfo(float).eps, "  float32:", np.finfo(np.float32).eps)
T = 1_760_000_000                              # unix-время в секундах, 2025 год
print("шаг float32 около T:", np.spacing(np.float32(T)), "с")`);
    function draw() {
      const toy = s.mode === 'toy';
      mbS.el.style.display = toy ? '' : 'none';
      xS.el.style.display = toy ? '' : 'none';
      eS.el.style.display = toy ? 'none' : '';
      if (toy) {
        const mb = s.mb;
        const grid = [0];
        for (let e = -2; e <= 3; e++) for (let f = 0; f < 1 << mb; f++) grid.push((1 + f / (1 << mb)) * Math.pow(2, e));
        grid.sort((a, b) => a - b);
        const x = s.x;
        let near = grid[0];
        grid.forEach((g) => {
          if (Math.abs(g - x) < Math.abs(near - x)) near = g;
        });
        plot.opts.x = { label: 'x', type: undefined, domain: [0, 16.5], ticks: [0, 1, 2, 4, 8, 16] };
        plot.opts.y = { label: '', domain: [-1, 1], ticks: [] };
        const binsE = U.range(6, -2).map((e) => Math.pow(2, e));
        plot.render([
          { type: 'vline', x: 1, color: 'grid', width: 1 },
          ...binsE.map((v) => ({ type: 'vline', x: v, color: 'grid', width: 1 })),
          { type: 'points', x: grid, y: grid.map(() => 0), color: 'model', r: 4, label: 'представимые', tooltip: (i) => [String(grid[i])] },
          { type: 'arrows', x1: [x], y1: [0.6], x2: [near], y2: [0.12], color: 'tree', width: 2 },
          { type: 'points', x: [x], y: [0.6], color: 'tree', r: 5, label: 'x' },
        ], { x: [0, 16.5], y: [-1, 1] });
        demo.textContent = 'отрезок [2ᵉ, 2ᵉ⁺¹) содержит 2^' + mb + ' = ' + (1 << mb) + ' чисел с шагом 2^(e − ' + mb + ')\nx = ' + U.fmt(x, 2) + '  →  ' + near + '   (ошибка ' + U.fmt(Math.abs(near - x), 3) + ', относительная ' + (x > 0 ? pct(Math.abs(near - x) / x, 2) : '—') + ')';
        setLabels(['чисел в формате', 'машинный эпсилон 2⁻ᵐ', 'наибольшая отн. ошибка ε/2']);
        st.set('a', String(grid.length));
        st.set('b', U.fmt(Math.pow(2, -mb), 4));
        st.set('c', pct(Math.pow(2, -mb - 1), 2));
        note.innerHTML = 'В игрушечном формате мантисса 1.f имеет ' + mb + ' ' + plural(mb, 'бит', 'бита', 'бит') + ' после точки, порядок — от −2 до 3. На каждом отрезке между степенями двойки (серые линии) ровно ' + (1 << mb) + ' равноотстоящих чисел, поэтому около 1 они густые, а около 16 — редкие. Любое число округляется к ближайшему узлу, и <b>относительная</b> ошибка не больше половины машинного эпсилона ε = 2⁻ᵐ — она одинакова на всех масштабах, а абсолютная растёт с числом. float64 устроен так же, только бит мантиссы 52: ε = 2⁻⁵² ≈ 2.2·10⁻¹⁶.';
      } else {
        const x = Math.pow(10, s.e);
        const xs = U.linspace(-3, 20, 300).map((k) => Math.pow(10, k));
        plot.opts.x = { label: 'x', type: 'log', domain: [1e-3, 1e20], ticks: [1e-3, 1, 1e3, 1e6, 1e9, 1e12, 1e15, 1e18], format: fy };
        plot.opts.y = { label: 'шаг ulp(x)', type: 'log', domain: [1e-20, 1e5], ticks: [1e-20, 1e-15, 1e-10, 1e-5, 1, 1e5], format: fy };
        plot.render([
          { type: 'line', x: xs, y: xs.map(ulpOf), color: 'model', width: 2, label: 'ulp(x) — шаг float64', hover: false, curve: 'step' },
          { type: 'line', x: xs, y: xs.map((v) => v * Math.pow(2, -52)), color: 'tree', width: 1.5, dash: '6 4', label: 'x · 2⁻⁵²', hover: false },
          { type: 'hline', y: 1, color: 'ink2', dash: '3 3', width: 1, label: 'шаг = 1' },
          { type: 'points', x: [x], y: [ulpOf(x)], color: 'tree', r: 6 },
        ]);
        let loop = 0;
        for (let i = 0; i < 10; i++) loop += 0.1;
        demo.textContent = ['0.1 + 0.2            = ' + (0.1 + 0.2), '0.1 + 0.2 == 0.3     → ' + (0.1 + 0.2 === 0.3), '(1e16 + 1) − 1e16    = ' + (1e16 + 1 - 1e16), '(1e16 − 1e16) + 1    = ' + (1e16 - 1e16 + 1), 'десять раз += 0.1    = ' + loop, '2⁵³ + 1 == 2⁵³       → ' + (Math.pow(2, 53) + 1 === Math.pow(2, 53))].join('\n');
        setLabels(['ulp(x)', 'ulp(x) / x', 'x + 1 == x?']);
        st.set('a', U.fmt(ulpOf(x), 3));
        st.set('b', U.fmt(ulpOf(x) / x, 3));
        st.set('c', x + 1 === x ? 'да' : 'нет');
        note.innerHTML = 'Шаг float64 — ступенчатая линия: на отрезке [2ᵉ, 2ᵉ⁺¹) он постоянен и равен 2ᵉ⁻⁵², а относительный шаг всегда около 2⁻⁵² ≈ 2.2·10⁻¹⁶ (пунктир). Начиная с 2⁵³ ≈ 9·10¹⁵ шаг больше 1, и x + 1 == x — не каждое целое представимо (идентификаторы больше этого порога нельзя хранить как float). Во float32 то же наступает уже на 2²⁴ = 16 777 216, а шаг около современного unix-времени (1.76·10⁹ с) — <b>128 секунд</b> (шаг 33). Следствия для кода: сравнивайте вещественные числа с допуском (<code>math.isclose</code>, <code>np.allclose</code>), а не через ==.';
      }
    }
    draw();
  });

  /* ==============================================================================
   * 32. Порядок суммирования и точная сумма
   * ============================================================================== */
  const P10 = [1, 10, 100, 1000, 10000, 100000, 1000000, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12];
  /** Данные строятся только из random(), сложения, умножения и деления на точные числа — побитово как в Python. */
  function sumData(kind, n, seed) {
    const r = new GBC.RNG(seed);
    const xs = new Array(n);
    for (let i = 0; i < n; i++) {
      if (kind === 'cents') xs[i] = Math.floor(r.random() * 100000) / 100;
      else if (kind === 'wide') {
        const u = r.random();
        const k = Math.floor(r.random() * 13);
        xs[i] = ((u + 0.5) * P10[k]) / 1000000;
      } else if (kind === 'big') xs[i] = i === 0 ? 1e16 : Math.floor(r.random() * 100) / 10;
      else xs[i] = (i % 2 ? -1 : 1) * (100000000 + Math.floor(r.random() * 1000) / 1000);
    }
    return xs;
  }
  function pairwise(xs, lo = 0, hi = xs.length) {
    if (hi - lo <= 8) {
      let s = 0;
      for (let i = lo; i < hi; i++) s += xs[i];
      return s;
    }
    const mid = (lo + hi) >> 1;
    return pairwise(xs, lo, mid) + pairwise(xs, mid, hi);
  }
  function kahan(xs) {
    let s = 0;
    let c = 0;
    for (const x of xs) {
      const y = x - c;
      const t = s + y;
      c = t - s - y;
      s = t;
    }
    return s;
  }
  const seq = (xs) => {
    let s = 0;
    for (const x of xs) s += x;
    return s;
  };
  GBC.widget('sum-order', (el) => {
    const s = { kind: 'cents', n: 10000, seed: 1 };
    const w = ui.shell(el, { title: 'Одна сумма — разные ответы', sub: 'Суммируем одни и те же числа шестью способами и сравниваем с точной суммой (алгоритм Шевчука, как math.fsum). Ошибка — в ulp, единицах последнего разряда точного ответа.' });
    ui.select(w.controls, { label: 'Данные', value: s.kind, options: [
      { value: 'cents', label: 'суммы с копейками (0…1000)' }, { value: 'wide', label: 'разные порядки (10⁻⁷…10⁶)' }, { value: 'big', label: '10¹⁶ и много малых' }, { value: 'cancel', label: '±10⁸: взаимное уничтожение' },
    ], onChange: (v) => ((s.kind = v), draw()) });
    ui.slider(w.controls, { label: 'Чисел n', values: [10, 100, 1000, 10000, 100000], value: s.n, format: (v) => grp(v), onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Зерно', min: 1, max: 20, step: 1, value: s.seed, format: String, onInput: (v) => ((s.seed = v), draw()) });
    const bars = new GBC.Plot(w.main, { height: 220, x: { label: '', domain: [0.4, 6.6], ticks: [1, 2, 3, 4, 5, 6], format: (v) => ['', 'подряд', 'с конца', 'по возраст. |x|', 'по убыв. |x|', 'попарно', 'Кэхэн'][v] || '' }, y: { label: 'ошибка, ulp' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ex', label: 'точная сумма' }, { key: 'w', label: 'худший способ' }, { key: 'k', label: 'ошибка Кэхэна' }]);
    const genPy = () => s.kind === 'cents' ? 'math.floor(rng.random() * 100000) / 100' : s.kind === 'wide' ? '(rng.random() + 0.5) * 10 ** math.floor(rng.random() * 13) / 1000000' : s.kind === 'big' ? '1e16 if i == 0 else math.floor(rng.random() * 100) / 10' : '(-1 if i % 2 else 1) * (100000000 + math.floor(rng.random() * 1000) / 1000)';
    w.pythonAction(() => `import math
from gbcourse.rng import Mulberry32

rng, n = Mulberry32(${s.seed}), ${s.n}
xs = []
for i in range(n):
    xs.append(${s.kind === 'wide' ? `(rng.random() + 0.5) * float(10 ** math.floor(rng.random() * 13)) / 1000000` : genPy()})

def seq(a):
    s = 0.0
    for x in a:
        s += x
    return s

def pairwise(a):
    return seq(a) if len(a) <= 8 else pairwise(a[: len(a) // 2]) + pairwise(a[len(a) // 2 :])

def kahan(a):
    s = c = 0.0
    for x in a:
        y = x - c
        t = s + y
        c = (t - s) - y
        s = t
    return s

exact = math.fsum(xs)
ulp = math.ulp(exact)
for name, v in [("подряд", seq(xs)), ("с конца", seq(xs[::-1])), ("по возрастанию |x|", seq(sorted(xs, key=abs))),
                ("по убыванию |x|", seq(sorted(xs, key=abs, reverse=True))), ("попарно", pairwise(xs)), ("Кэхэн", kahan(xs))]:
    print(f"{name:20}: {v!r:>24}  ошибка {(v - exact) / ulp:+.0f} ulp")
print("точная (fsum):", repr(exact))`);
    function draw() {
      const xs = sumData(s.kind, s.n, s.seed);
      const ex = fsum(xs);
      const u = ulpOf(ex);
      const byAbs = xs.slice().sort((a, b) => Math.abs(a) - Math.abs(b));
      const res = [
        ['подряд', seq(xs)],
        ['с конца', seq(xs.slice().reverse())],
        ['по возрастанию |x|', seq(byAbs)],
        ['по убыванию |x|', seq(byAbs.slice().reverse())],
        ['попарно', pairwise(xs)],
        ['Кэхэн', kahan(xs)],
      ];
      const errs = res.map(([, v]) => (v - ex) / u);
      const amax = Math.max(1, ...errs.map(Math.abs));
      bars.render([
        { type: 'bars', x: [1, 2, 3, 4, 5, 6], y: errs, color: (i) => (i === 5 ? 'aqua' : Math.abs(errs[i]) === amax && amax > 0 ? 'orange' : 'blue'), width: 0.6, maxPx: 46, tooltip: (i) => [res[i][0], minus(U.fmt(errs[i], 3)) + ' ulp'] },
        { type: 'hline', y: 0, color: 'ink2', width: 1 },
      ], { x: [0.4, 6.6], y: [-amax * 1.15, amax * 1.15] });
      rowTable(tbl, ['способ', 'результат', 'ошибка, ulp'], res.map(([nm, v], i) => [nm, String(v), minus(U.fmt(errs[i], 3))]), (i) => i === 5, false);
      const worst = errs.reduce((a, e, i) => (Math.abs(e) > Math.abs(errs[a]) ? i : a), 0);
      st.set('ex', String(ex));
      st.set('w', res[worst][0] + ' (' + minus(U.fmt(errs[worst], 3)) + ')');
      st.set('k', minus(U.fmt(errs[5], 3)) + ' ulp');
      note.innerHTML = 'Каждое сложение округляет результат к сетке (шаг 31), и ошибки накапливаются по-разному в зависимости от порядка — <b>сложение чисел с плавающей точкой не ассоциативно</b>. Обычный цикл копит ошибку, пропорциональную n; <b>попарное</b> суммирование (половина + половина) — пропорциональную log n, так считает <code>np.sum</code> (в своём варианте с блоками, поэтому её последние биты могут отличаться и от цикла, и от нашей реализации). <b>Алгоритм Кэхэна</b> хранит потерянный «хвост» в отдельной переменной и почти всегда ошибается не больше чем на 1 ulp. Точная сумма — алгоритм Шевчука (<code>math.fsum</code>). ' + (s.kind === 'big' ? 'Случай «10¹⁶ и много малых» показывает поглощение: шаг около 10¹⁶ равен 2, и каждое малое слагаемое, добавленное к огромной сумме, округляется. Суммирование по возрастанию сначала складывает малые между собой.' : s.kind === 'cancel' ? 'Взаимное уничтожение: слагаемые ±10⁸ почти гасят друг друга, итог мал, а ошибки, накопленные на огромных промежуточных суммах, остаются — относительная ошибка результата велика.' : '') + ' Для курса важно не столько «правильно», сколько «одинаково»: поэтому суммы, влияющие на выбор разбиений, считаются строго последовательно и в JS, и в Python (<code>seq_sum</code>).';
    }
    draw();
  });

  /* ==============================================================================
   * 33. float32 и пороги деревьев
   * ============================================================================== */
  GBC.widget('float32-split', (el) => {
    const s = { origin: 1760000000, dt: 60, shift: false, cut: 30 };
    const w = ui.shell(el, { title: 'float32 склеивает признак — и порог не находится', sub: 'XGBoost и деревья scikit-learn переводят признаки во float32. События идут каждые Δ секунд, метка меняется после события № 30. Если соседние события стали одним float32-числом, их не разделит никакой порог.' });
    ui.select(w.controls, { label: 'Признак', value: s.origin, options: [{ value: 1760000000, label: 'unix-время, секунды (≈ 1.76·10⁹)' }, { value: 20000000, label: 'идентификатор ≈ 2·10⁷' }, { value: 1000000, label: 'идентификатор ≈ 10⁶' }], onChange: (v) => ((s.origin = +v), draw()) });
    ui.slider(w.controls, { label: 'Шаг между событиями Δ', values: [1, 2, 5, 10, 30, 60, 100, 128, 200, 300], value: s.dt, format: String, onInput: (v) => ((s.dt = v), draw()) });
    ui.slider(w.controls, { label: 'Метка 1 начиная с события №', min: 1, max: 59, step: 1, value: s.cut, format: String, onInput: (v) => ((s.cut = v), draw()) });
    ui.toggle(w.controls, { label: 'Вычесть начало отсчёта (x − x₀)', checked: s.shift, onChange: (v) => ((s.shift = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 270, x: { label: 'смещение события от x₀ (float64)' }, y: { label: 'значение во float32 − x₀' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'u', label: 'шаг float32 около x₀' }, { key: 'd', label: 'различных значений float32' }, { key: 'c', label: 'граница меток разделима?' }]);
    w.pythonAction(() => `import numpy as np
import xgboost as xgb
from sklearn.tree import DecisionTreeRegressor

x0, dt, cut = ${s.origin}, ${s.dt}, ${s.cut}
X = (x0 + dt * np.arange(60)).astype(np.float64).reshape(-1, 1)
y = (np.arange(60) >= cut).astype(float)
print("шаг float32 около x0:", np.spacing(np.float32(x0)))
print("различных float32:", len(np.unique(X.astype(np.float32))), "из 60")
for name, Z in (("как есть", X), ("x − x0", X - x0)):
    t = DecisionTreeRegressor(max_depth=1).fit(Z, y)
    m = xgb.XGBRegressor(n_estimators=1, max_depth=1, learning_rate=1.0, base_score=0.5, reg_lambda=0, min_child_weight=0).fit(Z, y)
    print(f"{name:9}: ошибка дерева sklearn {abs(t.predict(Z) - y).max():.3f}, XGBoost {abs(m.predict(Z) - y).max():.3f}")`);
    function draw() {
      const { origin, dt, cut } = s;
      const n = 60;
      const off = U.range(n).map((i) => i * dt);
      const f32 = off.map((o) => (s.shift ? Math.fround(o) : Math.fround(origin + o) - origin));
      const lab = off.map((_, i) => (i >= cut ? 1 : 0));
      const distinct = new Set(f32).size;
      const sep = f32[cut - 1] !== f32[cut];
      const ulp32 = (() => {
        const v = s.shift ? Math.max(1, off[n - 1]) : origin;
        const e = Math.floor(Math.log2(v));
        return Math.pow(2, e - 23);
      })();
      const i0 = off.map((_, i) => i).filter((i) => !lab[i]);
      const i1 = off.map((_, i) => i).filter((i) => lab[i]);
      plot.render([
        { type: 'line', x: [0, off[n - 1]], y: [0, off[n - 1]], color: 'grid', width: 1, dash: '4 3', hover: false },
        { type: 'line', x: off, y: f32, color: 'muted', width: 1.2, curve: 'step', hover: false },
        { type: 'points', x: i0.map((i) => off[i]), y: i0.map((i) => f32[i]), color: 'class0', r: 4.5, label: 'метка 0', tooltip: (k) => ['событие ' + i0[k], 'float32 − x₀ = ' + f32[i0[k]]] },
        { type: 'points', x: i1.map((i) => off[i]), y: i1.map((i) => f32[i]), color: 'class1', r: 4.5, label: 'метка 1', tooltip: (k) => ['событие ' + i1[k], 'float32 − x₀ = ' + f32[i1[k]]] },
        { type: 'vline', x: (off[cut - 1] + off[cut]) / 2, color: sep ? 'good' : 'critical', dash: '5 4', width: 1.5, label: sep ? 'граница разделима' : 'граница внутри «склейки»' },
      ]);
      st.set('u', grp(ulp32) + (ulp32 >= 1 ? '' : ''));
      st.set('d', distinct + ' из ' + n);
      st.set('c', sep ? 'да' : 'нет');
      note.innerHTML = 'float32 хранит 24 значащих бита, и около x₀ = ' + grp(origin) + ' соседние представимые числа отстоят на 2^(⌊log₂ x₀⌋ − 23) = <b>' + grp(ulp32) + '</b>. ' + (s.shift ? 'После вычитания начала отсчёта числа маленькие, и float32 различает их все: ступенька совпала с диагональю.' : 'Все события внутри одной ступеньки получают одинаковое значение признака. ' + (sep ? 'Сейчас граница меток пришлась между ступеньками — дереву повезло.' : 'Граница меток проходит внутри ступеньки: события № ' + (cut - 1) + ' и № ' + cut + ' неразличимы, и дерево ошибётся хотя бы на одном из них, сколько бы его ни обучали.')) + ' Это не теоретическая придирка: на таком примере (Δ = 60 с, граница после 30-го события) XGBoost 3.4 и DecisionTreeRegressor из scikit-learn ошибаются на 0.97, а после вычитания x₀ — ни на одном объекте. LightGBM хранит пороги в double и этой проблемы не имеет. Рецепт: большие «координаты» (время, идентификаторы) переводите в смещения от разумного начала или в осмысленные признаки (час, день недели, давность).';
    }
    draw();
  });

  /* ==============================================================================
   * 34. Линейный конгруэнтный генератор и его граф
   * ============================================================================== */
  GBC.widget('lcg', (el) => {
    const s = { m: 16, a: 5, c: 3, x0: 1 };
    const w = ui.shell(el, { title: 'Линейный конгруэнтный генератор xₙ₊₁ = (a·xₙ + c) mod m', sub: 'Состояние — число от 0 до m − 1, и следующее зависит только от текущего. Граф переходов показывает все циклы сразу; под ним — последовательность от выбранного зерна.' });
    ui.slider(w.controls, { label: 'Модуль m', values: [8, 9, 10, 12, 16, 27, 31, 32, 64], value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'Множитель a (mod m)', min: 0, max: 63, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'Приращение c (mod m)', min: 0, max: 63, step: 1, value: s.c, format: String, onInput: (v) => ((s.c = v), draw()) });
    ui.slider(w.controls, { label: 'Начальное x₀ (зерно)', min: 0, max: 63, step: 1, value: s.x0, format: String, onInput: (v) => ((s.x0 = v), draw()) });
    const graph = new GBC.Plot(w.main, { height: 300, equal: true, grid: 'none', x: { label: '', ticks: [], domain: [-1.25, 1.25] }, y: { label: '', ticks: [], domain: [-1.2, 1.2] }, margin: { left: 4, bottom: 4, right: 4, top: 4 } });
    const seqEl = monoBox('font-size:.85rem');
    w.main.appendChild(seqEl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'период от x₀' }, { key: 'cy', label: 'циклов в графе' }, { key: 'hd', label: 'условия Халла — Добелла' }]);
    w.pythonAction(() => `from math import gcd

m, a, c, x0 = ${s.m}, ${s.a}, ${s.c}, ${s.x0}
seen, x, seq = {}, x0 % m, []
while x not in seen:
    seen[x] = len(seq)
    seq.append(x)
    x = (a * x + c) % m
print("последовательность:", seq, "→", x, " период:", len(seq) - seen[x])
primes = [p for p in range(2, m + 1) if m % p == 0 and all(p % q for q in range(2, p))]
print("Халл — Добелл: НОД(c, m) = 1:", gcd(c, m) == 1, "; a − 1 делится на", primes, ":", all((a - 1) % p == 0 for p in primes),
      "; 4 | m ⇒ 4 | a − 1:", m % 4 != 0 or (a - 1) % 4 == 0)
def period(A, C, v=0):
    seen = {}
    while v not in seen:
        seen[v] = len(seen)
        v = (A * v + C) % m
    return len(seen) - seen[v]

print("пар (a, c) с полным периодом:", sum(period(A, C) == m for A in range(m) for C in range(m)), "из", m * m)`);
    function draw() {
      const m = s.m;
      const a = s.a % m;
      const c = s.c % m;
      const nxt = (x) => (a * x + c) % m;
      const ks = U.range(m);
      // циклы функционального графа
      const color = new Array(m).fill(-1);
      const onCycle = new Array(m).fill(false);
      let cycles = 0;
      for (let v = 0; v < m; v++) {
        const path = [];
        const idx = new Map();
        let x = v;
        while (color[x] === -1 && !idx.has(x)) (idx.set(x, path.length), path.push(x), (x = nxt(x)));
        let col;
        if (idx.has(x)) {
          col = cycles++;
          for (let i = idx.get(x); i < path.length; i++) onCycle[path[i]] = true;
        } else col = color[x];
        path.forEach((p) => (color[p] = col));
      }
      const ax = [];
      const ay = [];
      const bx = [];
      const by = [];
      ks.forEach((x) => {
        const y = nxt(x);
        if (y === x) return;
        const [x0, y0] = [Math.sin((2 * Math.PI * x) / m), Math.cos((2 * Math.PI * x) / m)];
        const [x1, y1] = [Math.sin((2 * Math.PI * y) / m), Math.cos((2 * Math.PI * y) / m)];
        ax.push(x0 * 0.94 + (x1 - x0) * 0.05);
        ay.push(y0 * 0.94 + (y1 - y0) * 0.05);
        bx.push(x0 * 0.94 + (x1 * 0.94 - x0 * 0.94) * 0.92);
        by.push(y0 * 0.94 + (y1 * 0.94 - y0 * 0.94) * 0.92);
      });
      const seen = new Map();
      const sq = [];
      let x = s.x0 % m;
      while (!seen.has(x)) (seen.set(x, sq.length), sq.push(x), (x = nxt(x)));
      const period = sq.length - seen.get(x);
      graph.render([
        { type: 'arrows', x1: ax, y1: ay, x2: bx, y2: by, color: 'muted', width: 1.2, opacity: 0.7 },
        { type: 'points', x: ks.map((k) => Math.sin((2 * Math.PI * k) / m)), y: ks.map((k) => Math.cos((2 * Math.PI * k) / m)), color: (i) => SER[color[i] % 8], r: (i) => (i === s.x0 % m ? 8 : onCycle[i] ? 5.5 : 3.5), tooltip: (i) => [i + ' → ' + nxt(i)] },
        m <= 32 ? { type: 'text', items: ks.map((k) => ({ x: 1.12 * Math.sin((2 * Math.PI * k) / m), y: 1.12 * Math.cos((2 * Math.PI * k) / m), dy: 4, anchor: 'middle', text: String(k), bold: k === s.x0 % m })) } : null,
      ]);
      seqEl.textContent = 'x₀ = ' + s.x0 % m + ': ' + sq.slice(0, 40).join(', ') + (sq.length > 40 ? ', …' : '') + ' → ' + x + ' (повтор)';
      const pf = factorize(m).map(([p]) => p);
      const c1 = gcd(c, m) === 1;
      const c2 = pf.every((p) => (a - 1) % p === 0);
      const c3 = m % 4 !== 0 || (a - 1) % 4 === 0;
      st.set('p', String(period) + (period === m ? ' = m' : ''));
      st.set('cy', String(cycles));
      st.set('hd', [c1, c2, c3].map((v) => (v ? '✔' : '✘')).join(' '));
      note.innerHTML = 'Из каждой точки выходит ровно одна стрелка, поэтому граф распадается на циклы с «хвостами»; зерно x₀ выбирает, в какой цикл мы попадём. Период не больше m (принцип Дирихле). <b>Теорема Халла — Добелла:</b> при c ≠ 0 период равен m (один цикл через все состояния) тогда и только тогда, когда (1) НОД(c, m) = 1; (2) a − 1 делится на все простые делители m; (3) если 4 | m, то 4 | a − 1. Сейчас m = ' + m + ' = ' + fstr(factorize(m)) + ', a = ' + a + ', c = ' + c + '. Для m = 64 полный период дают ровно 512 пар (a, c) из 4096: c нечётно (32 варианта) и a ≡ 1 (mod 4) (16 вариантов). При c = 0 (генератор Лемера) нужен простой m и первообразный корень a — тогда период m − 1: попробуйте m = 31, a = 3, c = 0. Знаменитый MINSTD: a = 7⁵ = 16 807, m = 2³¹ − 1.';
    }
    draw();
  });

  /* ==============================================================================
   * 35. Тройки генератора в 3D: плоскости RANDU
   * ============================================================================== */
  GBC.widget('randu-3d', (el) => {
    const s = { gen: 'randu', az: 35, el: 20, n: 3000, magic: false };
    const w = ui.shell(el, { title: 'Тройки (xₙ, xₙ₊₁, xₙ₊₂) в кубе', sub: 'Берём подряд идущие выходы генератора тройками и ставим точки в единичном кубе. У хорошего генератора — равномерное облако с любой стороны. У RANDU точки лежат всего на 15 плоскостях.' });
    ui.select(w.controls, { label: 'Генератор', value: s.gen, options: [{ value: 'randu', label: 'RANDU: a = 65539, m = 2³¹' }, { value: 'minstd', label: 'MINSTD: a = 16807, m = 2³¹ − 1' }, { value: 'mulberry', label: 'Mulberry32 (генератор курса)' }, { value: 'tiny', label: 'ЛКГ: a = 5, c = 1, m = 256' }], onChange: (v) => ((s.gen = v), (s.magic = false), draw()) });
    const azS = ui.slider(w.controls, { label: 'Поворот', min: 0, max: 360, step: 1, value: s.az, format: (v) => v + '°', onInput: (v) => ((s.az = v), (s.magic = false), draw()) });
    ui.slider(w.controls, { label: 'Наклон', min: -89, max: 89, step: 1, value: s.el, format: (v) => v + '°', onInput: (v) => ((s.el = v), (s.magic = false), draw()) });
    ui.player(w.controls, { label: 'Вращать', min: 0, max: 360, value: 0, fps: 24, format: (v) => v + '°', onChange: (v) => ((s.az = v), (s.magic = false), azS.set(v), draw()) });
    ui.button(w.controls, { label: 'Посмотреть вдоль плоскостей', icon: 'target', onClick: () => ((s.magic = true), draw()) });
    const cv = H('canvas', { width: 520, height: 420, style: 'width:100%;max-width:520px;height:auto;display:block;margin:4px auto;border:1px solid var(--border);border-radius:8px;background:var(--surface)' });
    w.main.appendChild(cv);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pl', label: 'плоскостей (теория)' }, { key: 'lb', label: 'младший бит выходов' }, { key: 'v', label: 'вид' }]);
    const GEN = {
      randu: { m: 2147483648, a: 65539, c: 0, x0: 1, normal: [9, -6, 1], planes: 15 },
      minstd: { m: 2147483647, a: 16807, c: 0, x0: 1, normal: null, planes: '≤ 1600 — незаметно' },
      tiny: { m: 256, a: 5, c: 1, x0: 1, normal: null, planes: 'несколько' },
      mulberry: { normal: null, planes: 'нет решётки' },
    };
    let pts = null;
    let lowBits = '';
    function gen() {
      const g = GEN[s.gen];
      const out = [];
      const raw = [];
      if (s.gen === 'mulberry') {
        const r = new GBC.RNG(1);
        for (let i = 0; i < s.n * 3; i++) raw.push(r.nextUint32());
        for (let i = 0; i < raw.length; i += 3) out.push([raw[i] / 4294967296, raw[i + 1] / 4294967296, raw[i + 2] / 4294967296]);
      } else {
        let x = g.x0;
        const M = BigInt(g.m);
        const A = BigInt(g.a);
        const C = BigInt(g.c);
        let X = BigInt(x);
        const vals = [];
        const cnt = g.m === 256 ? 256 : s.n + 2;
        for (let i = 0; i < cnt + 2; i++) {
          X = (A * X + C) % M;
          vals.push(Number(X));
        }
        for (let i = 0; i + 2 < vals.length && out.length < s.n; i += g.m === 256 ? 1 : 1) out.push([vals[i] / g.m, vals[i + 1] / g.m, vals[i + 2] / g.m]);
        raw.push(...vals);
        x = 0;
      }
      lowBits = raw.slice(0, 12).map((v) => v & 1).join('');
      pts = out;
    }
    function basis() {
      const g = GEN[s.gen];
      if (s.magic && g.normal) {
        const n = g.normal;
        const L = Math.hypot(...n);
        const r = n.map((v) => v / L);
        let up = [0, 0, 1];
        const d = up[0] * r[0] + up[1] * r[1] + up[2] * r[2];
        up = up.map((v, i) => v - d * r[i]);
        const Lu = Math.hypot(...up);
        return [r, up.map((v) => v / Lu)];
      }
      const az = (s.az * Math.PI) / 180;
      const el2 = (s.el * Math.PI) / 180;
      const right = [Math.cos(az), Math.sin(az), 0];
      const up = [-Math.sin(az) * Math.sin(el2), Math.cos(az) * Math.sin(el2), Math.cos(el2)];
      return [right, up];
    }
    w.pythonAction(() => `import matplotlib.pyplot as plt
import numpy as np

m, a = 2 ** 31, 65539                    # RANDU
x, vals = 1, []
for _ in range(3002):
    x = a * x % m
    vals.append(x / m)
v = np.array(vals)
P = np.stack([v[:-2], v[1:-1], v[2:]], axis=1)
k = 9 * P[:, 0] - 6 * P[:, 1] + P[:, 2]      # x_{n+2} − 6x_{n+1} + 9x_n ≡ 0 (mod 2^31)
print("значения 9x − 6y + z — только целые:", np.unique(np.round(k, 6)))
print("младшие биты:", [int(t * m) & 1 for t in vals[:12]])
ax = plt.figure().add_subplot(projection="3d")
ax.scatter(*P.T, s=1)
ax.view_init(elev=0, azim=-56.3)              # смотрим вдоль плоскостей
plt.show()`);
    function draw() {
      gen();
      const ctx = cv.getContext('2d');
      const Wd = cv.width;
      const Hd = cv.height;
      ctx.fillStyle = GBC.colors.rgbString(RGB('surface'));
      ctx.fillRect(0, 0, Wd, Hd);
      const [R, Up] = basis();
      const proj = (p) => {
        const q = [p[0] - 0.5, p[1] - 0.5, p[2] - 0.5];
        return [Wd / 2 + 230 * (q[0] * R[0] + q[1] * R[1] + q[2] * R[2]), Hd / 2 - 230 * (q[0] * Up[0] + q[1] * Up[1] + q[2] * Up[2])];
      };
      // рёбра куба
      ctx.strokeStyle = GBC.colors.rgbString(RGB('muted'), 0.5);
      ctx.lineWidth = 1;
      const V = [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => [x, y, z])));
      V.forEach((p, i) =>
        V.forEach((q, j) => {
          if (j <= i) return;
          const dsum = Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
          if (dsum !== 1) return;
          const [x1, y1] = proj(p);
          const [x2, y2] = proj(q);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }),
      );
      ctx.fillStyle = GBC.colors.rgbString(RGB('blue'), 0.75);
      pts.forEach((p) => {
        const [x, y] = proj(p);
        ctx.fillRect(x - 1.1, y - 1.1, 2.2, 2.2);
      });
      const g = GEN[s.gen];
      st.set('pl', String(g.planes));
      st.set('lb', lowBits + '…');
      st.set('v', s.magic ? (g.normal ? 'вдоль плоскостей' : 'нет известной плоскости') : s.az + '°, ' + s.el + '°');
      note.innerHTML = s.gen === 'randu'
        ? 'RANDU (IBM, 1960-е) — ЛКГ с a = 65539 = 2¹⁶ + 3 и m = 2³¹. Возведём множитель в квадрат: a² = 2³² + 6·2¹⁶ + 9 ≡ 6a − 9 (mod 2³¹), поэтому <b>xₙ₊₂ − 6xₙ₊₁ + 9xₙ ≡ 0 (mod 2³¹)</b> для любых трёх подряд выходов. После деления на m: 9u − 6v + w — целое число, а с учётом границ куба — одно из 15 значений от −5 до 9. Значит, все тройки лежат на 15 параллельных плоскостях; нажмите «посмотреть вдоль плоскостей». Результаты сотен симуляций тех лет пришлось перепроверять. Младший бит RANDU всегда 1 (нечётный множитель и нечётное зерно, c = 0).'
        : s.gen === 'minstd'
          ? 'MINSTD тоже ЛКГ, и его тройки тоже лежат на плоскостях (теорема Марсальи: k-ки любого ЛКГ — на решётке не более чем из (k!·m)^(1/k) гиперплоскостей), но плоскостей больше тысячи и они плотные — глазом не видно. Для Монте-Карло с миллиардами точек решётку всё же можно заметить статистическими тестами.'
          : s.gen === 'tiny'
            ? 'Маленький ЛКГ с m = 256 имеет полный период, но все его тройки — всего 256 точек на нескольких плоскостях; при вращении они выстраиваются в ряды. Его младший бит чередуется 0, 1, 0, 1: по модулю 2 рекуррентность xₙ₊₁ ≡ xₙ + 1 — у ЛКГ с модулем 2ᵏ младшие биты имеют короткий период, поэтому из них нельзя брать случайность (например, x % 2 для «орла и решки»).'
            : 'Mulberry32 не линеен: после счётчика (а это ЛКГ с a = 1) идёт перемешивание умножениями и XOR-сдвигами (шаг 36), и никакой решётки нет — облако выглядит равномерным при любом повороте. Это не доказательство качества (его проверяют наборами статистических тестов вроде PractRand и TestU01), но грубых дефектов ЛКГ здесь нет.';
    }
    GBC.bus.on('themechange', () => setTimeout(draw, 30));
    draw();
  });

  /* ==============================================================================
   * 36. Mulberry32 по шагам и лавинный эффект
   * ============================================================================== */
  GBC.widget('mulberry-steps', (el) => {
    const s = { seed: 42, call: 1, src: 'mix' };
    const w = ui.shell(el, { title: 'Mulberry32 изнутри', sub: 'Каждый вызов: прибавить к состоянию нечётную константу по модулю 2³² (счётчик с полным периодом), затем перемешать биты умножениями и XOR-сдвигами. Ниже — лавинный эффект.' });
    intField(w.controls, { label: 'Зерно (seed)', value: s.seed, min: 0, max: 4294967295, onChange: (v) => ((s.seed = v), draw()) });
    ui.slider(w.controls, { label: 'Номер вызова', min: 1, max: 5, step: 1, value: s.call, format: String, onInput: (v) => ((s.call = v), draw()) });
    ui.segmented(w.controls, { label: 'Лавина для', value: s.src, options: [{ value: 'mix', label: 'Mulberry32' }, { value: 'mul', label: 'одно умножение' }, { value: 'none', label: 'без смешивания' }], onChange: (v) => ((s.src = v), drawAv()) });
    const tbl = H('div');
    const out = monoBox('font-size:.9rem');
    w.main.append(tbl, out);
    const avTitle = H('div', { style: 'font-size:.9rem;font-weight:650;margin:8px 0 2px' }, 'Вероятность, что выходной бит j изменится при смене входного бита i (по 2000 случайным состояниям)');
    w.main.appendChild(avTitle);
    const pc = pixelCanvas(w.main, { maxW: 300, onHover: (p) => {
      avRead.textContent = p ? 'вход бит ' + (31 - p[1]) + ' → выход бит ' + (31 - p[0]) + ': ' + pct(AV[p[1] * 32 + p[0]]) : 'наведите курсор на клетку';
    }, onTheme: () => drawAv() });
    const avRead = monoBox('text-align:center;min-height:1.5em');
    w.main.append(avRead, legendRow([['var(--c-blue)', '0 % — бит никогда не меняется'], ['var(--muted)', '50 % — идеал'], ['var(--c-red)', '100 % — меняется всегда']]));
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'u', label: 'выход random()' }, { key: 'py', label: 'gbcourse: Mulberry32(seed)' }, { key: 'av', label: 'меняется бит в среднем (из 32)' }]);
    let AV = new Float64Array(1024);
    w.pythonAction(() => `from gbcourse.rng import Mulberry32

MASK = 0xFFFFFFFF
imul = lambda a, b: (a * b) & MASK            # как Math.imul в JavaScript

def step(state):
    state = (state + 0x6D2B79F5) & MASK       # счётчик: нечётная константа ⇒ период 2**32
    a = state
    t = imul(a ^ (a >> 15), 1 | a)
    t = ((t + imul(t ^ (t >> 7), 61 | t)) & MASK) ^ t
    return state, (t ^ (t >> 14)) & MASK

st, mine = ${s.seed}, []
for _ in range(${s.call}):
    st, u = step(st)
    mine.append(u / 2 ** 32)
ref = Mulberry32(${s.seed})
print("вручную:  ", [round(v, 6) for v in mine])
print("gbcourse: ", [round(ref.random(), 6) for _ in range(${s.call})])`);
    function drawAv() {
      const r = new GBC.RNG(123);
      const f = s.src === 'mix' ? mix32 : s.src === 'mul' ? (a) => Math.imul(a, 0x2c1b3c6d) >>> 0 : (a) => a >>> 0;
      const cnt = new Float64Array(1024);
      const T = 2000;
      let tot = 0;
      for (let t = 0; t < T; t++) {
        const x = r.nextUint32();
        const y = f(x);
        for (let i = 0; i < 32; i++) {
          const d = (y ^ f((x ^ (1 << i)) >>> 0)) >>> 0;
          tot += popcount(d);
          for (let j = 0; j < 32; j++) if ((d >>> j) & 1) cnt[(31 - i) * 32 + (31 - j)]++;
        }
      }
      AV = cnt.map((v) => v / T);
      const neg = RGB('blue');
      const mid = RGB('muted');
      const posC = RGB('red');
      pc.draw(32, 32, (i, j) => {
        const p = AV[j * 32 + i];
        return p < 0.5 ? mixRGB(neg, mid, p * 2) : mixRGB(mid, posC, (p - 0.5) * 2);
      });
      st.set('av', f2(tot / (T * 32)));
    }
    function draw() {
      let state = s.seed >>> 0;
      let rows = [];
      let outU = 0;
      for (let k = 1; k <= s.call; k++) {
        state = (state + 0x6d2b79f5) >>> 0;
        const a = state;
        const t1 = (a ^ (a >>> 15)) >>> 0;
        const t2 = Math.imul(t1, 1 | a) >>> 0;
        const t3 = (t2 ^ (t2 >>> 7)) >>> 0;
        const t4 = Math.imul(t3, 61 | t2) >>> 0;
        const t5 = ((t2 + t4) ^ t2) >>> 0;
        const t6 = (t5 ^ (t5 >>> 14)) >>> 0;
        outU = t6;
        if (k === s.call)
          rows = [
            ['state += 0x6D2B79F5 (mod 2³²)', a],
            ['a ^ (a >>> 15)', t1],
            ['t = imul(…, 1 | a)', t2],
            ['t ^ (t >>> 7)', t3],
            ['imul(…, 61 | t)', t4],
            ['t = (t + …) ^ t', t5],
            ['t ^ (t >>> 14) — выход', t6],
          ];
      }
      rowTable(tbl, ['операция', 'hex', 'биты'], rows.map(([nm, v]) => [nm, hex32(v), bin(v, 32).replace(/(.{8})(?!$)/g, '$1 ')]), (i) => i === rows.length - 1, false);
      const ref = new GBC.RNG(s.seed);
      let rv = 0;
      for (let k = 0; k < s.call; k++) rv = ref.random();
      out.textContent = 'random() = ' + outU + ' / 2³² = ' + (outU / 4294967296).toFixed(6);
      st.set('u', (outU / 4294967296).toFixed(6));
      st.set('py', rv.toFixed(6) + (Math.abs(rv - outU / 4294967296) < 1e-15 ? ' ✔' : ' ✘'));
      note.innerHTML = '<b>Счётчик</b> state += 0x6D2B79F5 — это ЛКГ с a = 1: константа нечётна, НОД(c, 2³²) = 1, поэтому за 2³² вызовов состояние проходит все значения ровно по разу (шаг 34). Сам счётчик ужасен как случайность — соседние состояния различаются на константу. Всю работу делает <b>смешивание</b>: умножение по модулю 2³² переносит информацию из младших битов в старшие, а XOR со сдвигом вправо — из старших в младшие. Ниже — лавинный эффект: у хорошего смешивания смена любого входного бита меняет каждый выходной бит с вероятностью около 50 % (серая карта, в среднем ≈ 16 бит из 32). Одно умножение (переключатель) меняет только биты не младше изменённого — треугольник; без смешивания меняется ровно один бит — диагональ. Одна тонкость: множитель 1 | a зависит от самого числа, поэтому смешивание не взаимно однозначно — среди первых 2²² выходов при seed = 0 есть 4591 повтор, тогда как у идеальной случайной функции ожидалось бы около 2048. Для учебных экспериментов это неважно, а для серьёзной статистики курс бы взял генератор с большим состоянием (numpy использует PCG64).';
    }
    draw();
    drawAv();
  });

  /* ==============================================================================
   * 37. Смещение по модулю: от целых к [0, n)
   * ============================================================================== */
  GBC.widget('mod-bias', (el) => {
    const s = { b: 4, n: 3, how: 'mod' };
    const w = ui.shell(el, { title: 'Как превратить случайные биты в число от 0 до n − 1', sub: 'Генератор выдаёт равновероятные числа u от 0 до 2ᵇ − 1. Если n не делит 2ᵇ, раздать их поровну на n исходов невозможно — какие-то исходы получат на одно значение больше.' });
    ui.slider(w.controls, { label: 'Бит в генераторе b', min: 3, max: 8, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.slider(w.controls, { label: 'Исходов n', min: 2, max: 20, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.segmented(w.controls, { label: 'Способ', value: s.how, options: [{ value: 'mod', label: 'u mod n' }, { value: 'mul', label: '⌊u·n / 2ᵇ⌋' }, { value: 'rej', label: 'с отбраковкой' }], onChange: (v) => ((s.how = v), draw()) });
    const svgWrap = H('div');
    const bars = new GBC.Plot(w.main, { height: 200, x: { label: 'исход' }, y: { label: 'значений u' } });
    w.main.insertBefore(svgWrap, w.main.firstChild);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'mm', label: 'мин / макс значений на исход' }, { key: 'bias', label: 'наибольшее отклонение вероятности' }, { key: 'rej', label: 'отбраковано' }]);
    w.pythonAction(() => `from collections import Counter

b, n = ${s.b}, ${s.n}
M = 2 ** b
print("u mod n:      ", sorted(Counter(u % n for u in range(M)).items()))
print("⌊u·n / 2^b⌋:  ", sorted(Counter(u * n // M for u in range(M)).items()))
limit = M - M % n                          # отбраковка: берём только u < limit
print("с отбраковкой:", sorted(Counter(u % n for u in range(limit)).items()), " отброшено:", M - limit)
print("в курсе randint(n) = ⌊random()·n⌋, где random() = u / 2**32: при n = 3 исходы получают",
      sorted(set(Counter(u * 3 >> 32 for u in range(0, 2**32, 2**20)).values()))[:1], "…")
print("точно: 2**32 // 3 =", 2**32 // 3, ", остаток", 2**32 % 3)`);
    function draw() {
      const { b, n, how } = s;
      const M = 1 << b;
      const limit = M - (M % n);
      const outc = U.range(M).map((u) => (how === 'mod' ? u % n : how === 'mul' ? Math.floor((u * n) / M) : u < limit ? u % n : -1));
      const cnt = new Array(n).fill(0);
      outc.forEach((o) => o >= 0 && cnt[o]++);
      svgWrap.textContent = '';
      const cs = M > 128 ? 6 : M > 64 ? 9 : M > 32 ? 14 : 22;
      const cols = Math.min(M, 64);
      const rowsN = Math.ceil(M / cols);
      const svg = svgBox(svgWrap, cols * cs + 4, rowsN * (cs + 14) + 4, Math.min(cols * cs + 4, 360), Math.max((cols * cs + 4) * 1.4, 420));
      for (let u = 0; u < M; u++) {
        const x = 2 + (u % cols) * cs;
        const y = 2 + Math.floor(u / cols) * (cs + 14);
        const o = outc[u];
        const r = S('rect', { x, y, width: cs - 1.5, height: cs, rx: 2, style: 'fill:' + (o < 0 ? 'var(--surface-2)' : cvar(o)) + ';opacity:' + (o < 0 ? 1 : 0.8) + ';stroke:' + (o < 0 ? 'var(--border-strong)' : 'none') + ';stroke-dasharray:2 2' });
        r.appendChild(S('title', null, 'u = ' + u + (o < 0 ? ' — отброшено' : ' → исход ' + o)));
        svg.appendChild(r);
        if (cs >= 14) svg.appendChild(sText(x + cs / 2, y + cs + 7, o < 0 ? '×' : String(o), { size: 9, color: 'var(--ink-2)', mono: true }));
      }
      bars.opts.x.ticks = n <= 12 ? U.range(n) : U.range(Math.ceil(n / 2)).map((i) => 2 * i);
      bars.render([
        { type: 'bars', x: U.range(n), y: cnt, color: (i) => SER[i % 8], width: 0.7, maxPx: 34, tooltip: (i) => ['исход ' + i, cnt[i] + ' значений u'] },
        { type: 'hline', y: (how === 'rej' ? limit : M) / n, color: 'ink2', dash: '4 3', width: 1, label: 'поровну' },
      ], { x: [-0.6, n - 0.4], y: [0, Math.max(...cnt) * 1.2] });
      const tot = U.sum(cnt);
      const dev = Math.max(...cnt.map((c) => Math.abs(c / tot - 1 / n))) * n;
      st.set('mm', Math.min(...cnt) + ' / ' + Math.max(...cnt));
      st.set('bias', pct(dev, 1) + ' от 1/n');
      st.set('rej', how === 'rej' ? M - limit + ' из ' + M + ' (' + pct((M - limit) / M) + ')' : '—');
      note.innerHTML = '2ᵇ = ' + M + ' = ' + Math.floor(M / n) + '·' + n + ' + ' + (M % n) + ': деление с остатком (шаг 2) говорит, что ' + (M % n) + ' ' + plural(M % n, 'исход получит', 'исхода получат', 'исходов получат') + ' на одно значение u больше. ' + (M % n === 0 ? 'Сейчас n делит 2ᵇ — смещения нет. ' : '') + (how === 'mod' ? 'При u mod n лишние значения достаются <b>младшим</b> ' + (M % n === 1 ? 'исходу 0' : 'исходам 0…' + (M % n - 1)) + '. ' : how === 'mul' ? 'При ⌊u·n/2ᵇ⌋ лишние значения размазаны по разным исходам, но их столько же. ' : '<b>Отбраковка</b> выбрасывает ' + (M - limit) + ' «лишних» значений u ≥ ' + limit + ' и берёт новое — распределение становится точно равномерным, а в среднем требуется меньше двух попыток. ') + 'В курсе <code>randint(n)</code> = ⌊random()·n⌋ с b = 32: при n = 3 исходы получают 1 431 655 766 или 1 431 655 765 значений — отклонение 7·10⁻¹⁰, им можно пренебречь. Но при n около 2³¹ смещение доходит до двух раз, поэтому библиотеки (numpy, Java) используют отбраковку.';
    }
    draw();
  });

  /* ==============================================================================
   * 38. Хеширование категорий: корзины, НОД и перемешивание
   * ============================================================================== */
  GBC.widget('hashing', (el) => {
    const s = { step: 10, m: 100, k: 200, hf: 'mod' };
    const w = ui.shell(el, { title: 'Хеширование категорий: в какую корзину попадёт id', sub: 'Категории с идентификаторами 0, step, 2·step, … раскладываются в m корзин. Сколько корзин реально занято — зависит от хеш-функции и от НОД.' });
    ui.slider(w.controls, { label: 'Шаг идентификаторов step', values: [1, 2, 3, 5, 8, 10, 12, 16, 25, 64], value: s.step, format: String, onInput: (v) => ((s.step = v), draw()) });
    ui.slider(w.controls, { label: 'Корзин m', values: [50, 64, 97, 100, 101, 127, 128], value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'Категорий', min: 20, max: 400, step: 10, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.segmented(w.controls, { label: 'Хеш-функция', value: s.hf, options: [{ value: 'mod', label: 'id mod m' }, { value: 'fib', label: 'умножение (Фибоначчи)' }, { value: 'mix', label: 'перемешивание' }], onChange: (v) => ((s.hf = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'корзина', domain: [-1, 128] }, y: { label: 'категорий в корзине' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'used', label: 'занято корзин' }, { key: 'th', label: 'ожидание для случайного хеша' }, { key: 'max', label: 'максимум в корзине' }]);
    const hash = (id, m) => (s.hf === 'mod' ? id % m : s.hf === 'fib' ? Math.floor(((Math.imul(id, 0x9e3779b9) >>> 0) / 4294967296) * m) : Math.floor((mix32(id) / 4294967296) * m));
    w.pythonAction(() => `from collections import Counter
from math import gcd

step, m, k = ${s.step}, ${s.m}, ${s.k}
ids = [i * step for i in range(k)]
MASK = 0xFFFFFFFF
fib = lambda x: ((x * 0x9E3779B9) & MASK) * m >> 32          # мультипликативный хеш Кнута
for name, h in (("id mod m", lambda x: x % m), ("Фибоначчи", fib)):
    cnt = Counter(h(x) for x in ids)
    print(f"{name:10}: занято {len(cnt)} из {m}, максимум {max(cnt.values())}")
print("m / НОД(step, m) =", m // gcd(step, m))
print("ожидание для случайного хеша:", round(m * (1 - (1 - 1 / m) ** k), 1))`);
    function draw() {
      const { step, m, k } = s;
      const cnt = new Array(m).fill(0);
      for (let i = 0; i < k; i++) cnt[hash(i * step, m)]++;
      const used = cnt.filter((c) => c > 0).length;
      const g = gcd(step, m);
      const exp = m * (1 - Math.pow(1 - 1 / m, k));
      plot.render([
        { type: 'segments', x1: U.range(m), y1: cnt.map(() => 0), x2: U.range(m), y2: cnt, color: 'model', width: 3, opacity: 1 },
        { type: 'points', x: U.range(m).filter((i) => cnt[i]), y: cnt.filter((c) => c), color: 'model', r: 3 },
        { type: 'hline', y: k / m, color: 'tree', dash: '5 4', width: 1.5, label: 'поровну: k/m = ' + f2(k / m) },
      ], { x: [-1, m], y: [0, Math.max(...cnt) + 1] });
      st.set('used', used + ' из ' + m);
      st.set('th', f2(exp));
      st.set('max', String(Math.max(...cnt)));
      note.innerHTML = s.hf === 'mod'
        ? 'Кратные step по модулю m попадают только в кратные НОД(step, m): занято не больше <b>m / НОД(step, m) = ' + m + ' / ' + g + ' = ' + m / g + '</b> корзин. Идентификаторы с шагом 10 и 100 корзин — всего 10 корзин на все категории, и модель склеит то, что склеивать нельзя. Простое m (97, 101, 127) взаимно просто почти с любым шагом — поэтому размеры хеш-таблиц часто берут простыми. А m = 2ᵏ (64, 128) — худший выбор для регулярных id: остаток — это младшие биты (шаг 27), а у кратных 64 они все нулевые.'
        : s.hf === 'fib'
          ? '<b>Мультипликативное хеширование</b> (Кнут): умножаем id на 2³²/φ ≈ 2 654 435 769 (φ — золотое сечение) по модулю 2³² и берём <em>старшие</em> биты (дробная часть id/φ, умноженная на m). Умножение переносит информацию из младших битов в старшие, и регулярные идентификаторы расходятся почти равномерно — даже при m = 128 и шаге 64. Почему золотое сечение: дробные части k/φ расставляются по отрезку максимально равномерно (теорема о трёх расстояниях).'
          : 'Перемешивание той же функцией, что в Mulberry32: результат ведёт себя как случайный, корзины заполняются как при бросании k шаров в m ящиков — ожидаемо ' + f2(exp) + ' занятых корзин, остальное — коллизии (следующий виджет). Так устроены настоящие хеш-функции для признаков: <code>FeatureHasher</code> в scikit-learn использует MurmurHash3.';
    }
    draw();
  });

  /* ==============================================================================
   * 39. Коллизии и парадокс дней рождения
   * ============================================================================== */
  GBC.widget('collisions', (el) => {
    const s = { m: 1048576, n: 100000, seed: 1 };
    const w = ui.shell(el, { title: 'Сколько категорий столкнутся в одной корзине', sub: 'Случайный хеш раскладывает n категорий по m корзинам. Даже при n много меньше m коллизии почти неизбежны — это парадокс дней рождения.' });
    ui.slider(w.controls, { label: 'Корзин m', values: [365, 1024, 4096, 16384, 65536, 262144, 1048576, 4294967296], value: s.m, format: (v) => (v === 4294967296 ? '2³²' : grp(v)), onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'Категорий n', min: 1, max: 1000000, log: true, value: s.n, format: (v) => grp(Math.round(v)), onInput: (v) => ((s.n = Math.round(v)), draw()) });
    const presets = flexRow('margin-top:4px');
    [['23 человека, 365 дней', 365, 23], ['FeatureHasher: 2²⁰ и 10⁵', 1048576, 100000], ['32-битный хеш, 77 тыс.', 4294967296, 77163]].forEach(([t, m, n]) => presets.appendChild(ui.button(null, { label: t, small: true, onClick: () => ((s.m = m), (s.n = n), draw()) })));
    w.controls.appendChild(presets);
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'категорий n', type: 'log', ticks: [1, 10, 100, 1000, 10000, 100000, 1000000], format: (v) => (v < 1000 ? String(v) : '10' + sup(Math.round(Math.log10(v)))) }, y: { label: 'вероятность / доля', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'P(хотя бы одна коллизия)' }, { key: 'sh', label: 'доля категорий с соседом (теория)' }, { key: 'sim', label: 'в опыте (Mulberry32)' }]);
    // ln Γ(x) по Стирлингу (x ≥ 10 — с запасом точно для разностей при больших m)
    const lgam = (x) => (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI) + 1 / (12 * x) - 1 / (360 * x * x * x);
    const pAny = (n, m) => {
      if (n > m) return 1;
      let lg = 0;
      if (n <= 5000) for (let i = 1; i < n; i++) lg += Math.log1p(-i / m);
      else lg = lgam(m + 1) - lgam(m - n + 1) - n * Math.log(m);
      return -Math.expm1(lg);
    };
    const share = (n, m) => 1 - Math.pow(1 - 1 / m, n - 1);
    w.pythonAction(() => `import math
from collections import Counter
from gbcourse.rng import Mulberry32

m, n = ${s.m}, ${s.n}
p_none = math.exp(sum(math.log1p(-i / m) for i in range(min(n, m + 1))))
print("P(хотя бы одна коллизия) =", 1 - p_none)
print("доля категорий, деливших корзину (теория):", 1 - (1 - 1 / m) ** (n - 1))
rng = Mulberry32(${s.seed})
cnt = Counter(rng.next_uint32() % m for _ in range(n))
print("в опыте:", sum(c for c in cnt.values() if c > 1) / n)
print("50 % коллизии наступает около n ≈ √(2 ln 2 · m) =", round(math.sqrt(2 * math.log(2) * m)))`);
    function draw() {
      const { m, n } = s;
      const ns = U.linspace(0, 6, 120).map((t) => Math.round(Math.pow(10, t))).filter((v, i, a) => v >= 1 && a.indexOf(v) === i);
      const r = new GBC.RNG(s.seed);
      const map = new Map();
      for (let i = 0; i < n; i++) {
        const b = m === 4294967296 ? r.nextUint32() : r.nextUint32() % m;
        map.set(b, (map.get(b) || 0) + 1);
      }
      let shared = 0;
      map.forEach((c) => c > 1 && (shared += c));
      const half = Math.sqrt(2 * Math.log(2) * m);
      plot.render([
        { type: 'line', x: ns, y: ns.map((v) => pAny(v, m)), color: 'model', width: 2, label: 'P(хотя бы одна коллизия)' },
        { type: 'line', x: ns, y: ns.map((v) => share(v, m)), color: 'tree', width: 2, label: 'доля категорий с соседом' },
        { type: 'vline', x: half, color: 'ink2', dash: '4 3', width: 1, label: 'n ≈ √(2 ln2 · m)' },
        { type: 'points', x: [n], y: [shared / n], color: 'tree', r: 6 },
        { type: 'points', x: [n], y: [pAny(n, m)], color: 'model', r: 6 },
      ], { x: [1, 1e6] });
      st.set('p', pct(pAny(n, m), 1));
      st.set('sh', pct(share(n, m), 2));
      st.set('sim', pct(shared / n, 2));
      note.innerHTML = 'Вероятность, что n случайных значений в m корзинах все различны, — произведение (1 − 1/m)(1 − 2/m)…(1 − (n − 1)/m) ≈ e<sup>−n²/(2m)</sup>. Коллизия становится вероятнее 50 % уже при n ≈ √(2 ln 2·m) ≈ 1.18√m: 23 человека на 365 дней (50.7 %), 77 тысяч объектов для 32-битного хеша. Для признаков важнее доля категорий, попавших в общую корзину: 1 − (1 − 1/m)^(n−1) ≈ n/m. <code>FeatureHasher</code> по умолчанию имеет 2²⁰ ≈ 10⁶ корзин; при 10⁵ категорий корзину с кем-то делят около 9 % категорий (в среднем по паре: почти все такие корзины — двойные), а занято примерно 95 380 корзин — около 4 620 категорий «лишние». Бустинг обычно переносит это спокойно: склеенные редкие категории похожи на шум, а частые почти всегда достаются разным корзинам.';
    }
    draw();
  });

  /* ==============================================================================
   * 40. Стабильное хеш-разбиение на обучение и тест
   * ============================================================================== */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(str) {
    const bytes = new TextEncoder().encode(str);
    let c = 0xffffffff;
    for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  GBC.widget('hash-split', (el) => {
    const s = { day: 5, how: 'hash', test: 20 };
    const w = ui.shell(el, { title: 'Разбиение на обучение и тест, которое не «плывёт»', sub: 'Каждый день приходят новые пользователи и новые записи старых. Случайное разбиение строк каждый раз перетасовывает всё; хеш от id пользователя — стабилен и не разрывает пользователя.' });
    ui.slider(w.controls, { label: 'День', min: 1, max: 10, step: 1, value: s.day, format: String, onInput: (v) => ((s.day = v), draw()) });
    ui.segmented(w.controls, { label: 'Разбиение', value: s.how, options: [{ value: 'rand', label: 'случайное по строкам' }, { value: 'hash', label: 'crc32(user) mod 100' }], onChange: (v) => ((s.how = v), draw()) });
    ui.slider(w.controls, { label: 'Доля теста, %', values: [10, 20, 30], value: s.test, format: String, onInput: (v) => ((s.test = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 250, grid: 'none', x: { label: 'пользователь' }, y: { label: 'запись пользователя', domain: [-0.6, 7.6], ticks: [0, 2, 4, 6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'tr', label: 'строк в тесте' }, { key: 'lk', label: 'пользователей по обе стороны (утечка)' }, { key: 'ch', label: 'строк сменили сторону со вчера' }]);
    // данные: к дню d — 8·d пользователей, у каждого записи появляются постепенно
    const rows = (() => {
      const r = new GBC.RNG(7);
      const out = [];
      for (let u = 0; u < 80; u++) {
        const born = Math.floor(u / 8) + 1;
        const nrec = 1 + Math.floor(r.random() * 7);
        for (let j = 0; j < nrec; j++) out.push({ u, j, day: born + Math.floor(j * 0.7) });
      }
      return out;
    })();
    function split(day) {
      const present = rows.filter((x) => x.day <= day);
      const isTest = new Map();
      if (s.how === 'hash') present.forEach((x) => isTest.set(x.u + ':' + x.j, crc32('user_' + x.u) % 100 < s.test));
      else {
        const r = new GBC.RNG(1000 + day);
        const idx = r.permutation(present.length);
        const nT = Math.round((present.length * s.test) / 100);
        idx.forEach((k, pos) => isTest.set(present[k].u + ':' + present[k].j, pos < nT));
      }
      return { present, isTest };
    }
    w.pythonAction(() => `import zlib

test_share = ${s.test}
def is_test(user_id):
    # стабильно между запусками и машинами (в отличие от встроенного hash() для строк)
    return zlib.crc32(f"user_{user_id}".encode()) % 100 < test_share

print([u for u in range(80) if is_test(u)])
print("доля пользователей в тесте:", sum(is_test(u) for u in range(10_000)) / 10_000)
print("hash('user_42') меняется между запусками Python (PYTHONHASHSEED):", hash("user_42") % 100)`);
    function draw() {
      const { present, isTest } = split(s.day);
      const prev = s.day > 1 ? split(s.day - 1).isTest : new Map();
      const tr = present.filter((x) => !isTest.get(x.u + ':' + x.j));
      const te = present.filter((x) => isTest.get(x.u + ':' + x.j));
      const users = new Map();
      present.forEach((x) => {
        const t = isTest.get(x.u + ':' + x.j);
        const v = users.get(x.u) || [0, 0];
        v[t ? 1 : 0]++;
        users.set(x.u, v);
      });
      const leak = Array.from(users.values()).filter(([a, b]) => a && b).length;
      let changed = 0;
      present.forEach((x) => {
        const key = x.u + ':' + x.j;
        if (prev.has(key) && prev.get(key) !== isTest.get(key)) changed++;
      });
      const leakU = Array.from(users.entries()).filter(([, [a, b]]) => a && b).map(([u]) => u);
      plot.render([
        { type: 'segments', x1: leakU, y1: leakU.map(() => -0.5), x2: leakU, y2: leakU.map(() => 7.4), color: 'critical', width: 7, opacity: 0.18 },
        { type: 'points', x: tr.map((x) => x.u), y: tr.map((x) => x.j), color: 'train', r: 4, label: 'обучение', tooltip: (i) => ['user_' + tr[i].u + ', запись ' + tr[i].j] },
        { type: 'points', x: te.map((x) => x.u), y: te.map((x) => x.j), color: 'valid', r: 4.5, label: 'тест', tooltip: (i) => ['user_' + te[i].u + ', запись ' + te[i].j] },
      ], { x: [-1, 80] });
      st.set('tr', te.length + ' из ' + present.length);
      st.set('lk', String(leak));
      st.set('ch', s.day > 1 ? String(changed) : '—');
      note.innerHTML = s.how === 'rand'
        ? 'Случайное разбиение строк (как <code>train_test_split</code> на всей таблице) каждый день даёт новое перемешивание: вчерашние тестовые строки сегодня попадают в обучение (' + changed + ' строк сменили сторону), и сравнивать метрики разных дней нельзя. Хуже того, записи одного пользователя оказываются по обе стороны (красные полосы, ' + leak + ' пользователей): модель запоминает пользователя на обучении и «узнаёт» его в тесте — утечка, завышающая качество.'
        : 'Пользователь попадает в тест, если crc32("user_id") mod 100 < ' + s.test + ' — это деление с остатком от хеша. Решение зависит только от id, поэтому оно <b>стабильно</b>: новые строки старых пользователей идут туда же, куда их прошлые записи, со вчера не сменила сторону ни одна строка, и ни один пользователь не разорван. Доля теста получается около ' + s.test + ' % в среднем (хеш ведёт себя как случайный). Важно: не используйте встроенный <code>hash()</code> Python для строк — он «посолен» и меняется между запусками (переменная PYTHONHASHSEED): у одной и той же строки "user_42" остаток mod 100 был 70 при одном запуске и 62 при другом. Берите <code>zlib.crc32</code> или <code>hashlib</code>.';
    }
    draw();
  });

  /* ==============================================================================
   * 41. Параллельные суммы: зависимость модели от числа потоков
   * ============================================================================== */
  GBC.widget('parallel-sum', (el) => {
    const s = { n: 2000, T: 4, seed: 3 };
    const w = ui.shell(el, { title: 'Сколько потоков — такая и сумма', sub: 'Гистограммы градиентов в бустинге считают параллельно: каждый поток суммирует свой кусок, потом куски складываются. Число потоков меняет порядок сложения — и последние биты суммы.' });
    ui.slider(w.controls, { label: 'Градиентов n', values: [100, 500, 2000, 10000], value: s.n, format: (v) => grp(v), onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Потоков T', min: 1, max: 16, step: 1, value: s.T, format: String, onInput: (v) => ((s.T = v), draw()) });
    ui.slider(w.controls, { label: 'Зерно', min: 1, max: 20, step: 1, value: s.seed, format: String, onInput: (v) => ((s.seed = v), draw()) });
    const bars = new GBC.Plot(w.main, { height: 200, x: { label: 'число потоков T', domain: [0.4, 16.6], ticks: [1, 2, 4, 6, 8, 10, 12, 14, 16] }, y: { label: 'сумма − сумма при T = 1, ulp' } });
    const strip = H('div');
    w.main.appendChild(strip);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'su', label: 'сумма при T' }, { key: 'd', label: 'различных результатов при T = 1…16' }, { key: 'w', label: 'победитель среди равных разбиений' }]);
    const chunked = (xs, T) => {
      const parts = [];
      const L = xs.length;
      for (let t = 0; t < T; t++) {
        let acc = 0;
        for (let i = Math.floor((t * L) / T); i < Math.floor(((t + 1) * L) / T); i++) acc += xs[i];
        parts.push(acc);
      }
      let tot = 0;
      for (const p of parts) tot += p;
      return tot;
    };
    w.pythonAction(() => `import math
from gbcourse.rng import Mulberry32

rng, n = Mulberry32(${s.seed}), ${s.n}
g = [(math.floor(rng.random() * 2_000_000) - 1_000_000) / 3_000 for _ in range(n)]    # «градиенты»

def chunked(xs, T):
    L, parts = len(xs), []
    for t in range(T):
        acc = 0.0
        for x in xs[t * L // T : (t + 1) * L // T]:
            acc += x
        parts.append(acc)
    tot = 0.0
    for p in parts:
        tot += p
    return tot

ref = chunked(g, 1)
print("отклонение от T = 1, ulp:", [round((chunked(g, T) - ref) / math.ulp(ref)) for T in range(1, 17)])
half = n // 2
L1, L2 = g[:half], g[:half][::-1]             # два разбиения: одни и те же объекты слева, разный порядок обхода
for T in (1, 2, 4, 8):
    gain = lambda left: chunked(left, T) ** 2 / len(left)
    print(f"T = {T}: gain1 − gain2 = {gain(L1) - gain(L2):+.3e}")`);
    function draw() {
      const r = new GBC.RNG(s.seed);
      const n = s.n;
      const g = U.range(n).map(() => (Math.floor(r.random() * 2000000) - 1000000) / 3000);
      const ref = chunked(g, 1);
      const u = ulpOf(ref);
      const Ts = U.range(16, 1);
      const sums = Ts.map((T) => chunked(g, T));
      const dev = sums.map((v) => (v - ref) / u);
      const amax = Math.max(1, ...dev.map(Math.abs));
      bars.render([
        { type: 'bars', x: Ts, y: dev, color: (i) => (Ts[i] === s.T ? 'orange' : 'blue'), width: 0.7, maxPx: 22, tooltip: (i) => ['T = ' + Ts[i], String(sums[i]), minus(U.fmt(dev[i], 3)) + ' ulp'] },
        { type: 'hline', y: 0, color: 'ink2', width: 1 },
      ], { x: [0.4, 16.6], y: [-amax * 1.2, amax * 1.2] });
      // два «равных» разбиения: одни и те же объекты слева, но в разном порядке обхода
      const half = Math.floor(n / 2);
      const L1 = g.slice(0, half);
      const L2 = L1.slice().reverse();
      const gain = (left, T) => Math.pow(chunked(left, T), 2) / left.length;
      strip.textContent = '';
      const row = flexRow('margin:6px 0;gap:4px');
      row.appendChild(H('span', { style: 'font-size:.86rem;color:var(--ink-2);margin-right:4px' }, 'лучшее из двух равных разбиений при T = 1…16:'));
      Ts.forEach((T) => {
        const d = gain(L1, T) - gain(L2, T);
        row.appendChild(chip(d > 0 ? 'A' : d < 0 ? 'B' : '=', T === s.T ? 'on' : null, d > 0 ? 'var(--c-blue)' : d < 0 ? 'var(--c-orange)' : 'var(--muted)'));
      });
      strip.appendChild(row);
      const dCur = gain(L1, s.T) - gain(L2, s.T);
      st.set('su', String(sums[s.T - 1]));
      st.set('d', String(new Set(sums).size));
      st.set('w', dCur > 0 ? 'A' : dCur < 0 ? 'B' : 'ничья (' + U.fmt(dCur, 2) + ')');
      note.innerHTML = 'Сложение не ассоциативно (шаг 32), поэтому при разном числе потоков сумма одних и тех же градиентов отличается в последних битах: здесь ' + new Set(sums).size + ' ' + plural(new Set(sums).size, 'различный результат', 'различных результата', 'различных результатов') + ' на 16 вариантов T. Само по себе это безвредно, но дерево выбирает разбиение по <b>argmax</b> выигрыша. Нижняя строка: разбиения A и B помещают слева ровно одни и те же объекты, только обходят их в разном порядке, — математически их выигрыши равны. Какой победит, решает шум последнего бита, и он меняется вместе с T. В настоящих данных точные ничьи редки, но почти-ничьи встречаются часто (повторяющиеся значения, симметричные признаки), и модель на 8 потоках может отличаться от модели на 16. Поэтому LightGBM даёт флаг <code>deterministic=True</code>, а этот курс считает суммы строго последовательно и одинаково в JS и Python (<code>seq_sum</code>): воспроизводимость — это одинаковые зерно, порядок вызовов генератора <em>и</em> порядок суммирования.';
    }
    draw();
  });

  /* ==============================================================================
   * Тренажёр
   * ============================================================================== */
  const IQ = [
    { q: 'Чему равно −7 mod 3 в смысле теоремы о делении с остатком (как в Python)?', opts: ['−1', '2', '1', '−2'], a: 1, why: '−7 = (−3)·3 + 2, 0 ≤ 2 < 3. JavaScript и C дали бы −1.' },
    { q: 'KFold(7) на 1000 объектах: сколько фолдов по 143?', opts: ['1', '6', '7', '3'], a: 1, why: '1000 = 142·7 + 6: шесть фолдов по 143 и один по 142.' },
    { q: 'Сколько шагов за эпоху при n = 1000 и батче 64?', opts: ['15', '16', '15.6', '64'], a: 1, why: '⌈1000/64⌉ = (1000 + 63) // 64 = 16, последний батч из 40.' },
    { q: 'НОД(91, 35) = ?', opts: ['5', '7', '13', '1'], a: 1, why: '91 = 2·35 + 21, 35 = 21 + 14, 21 = 14 + 7, 14 = 2·7.' },
    { q: 'Есть ли целые решения у 6x + 10y = 5?', opts: ['да, x = 0, y = 0.5', 'нет: НОД(6, 10) = 2 не делит 5', 'да, бесконечно много', 'только отрицательные'], a: 1, why: 'Левая часть всегда чётна.' },
    { q: 'Сколько делителей у 360 = 2³·3²·5?', opts: ['6', '24', '12', '30'], a: 1, why: '(3 + 1)(2 + 1)(1 + 1) = 24.' },
    { q: 'Последняя цифра 7²⁰²⁶?', opts: ['7', '9', '3', '1'], a: 1, why: 'Цикл 7, 9, 3, 1 длины 4; 2026 mod 4 = 2 → 9.' },
    { q: 'Обратный к 3 по модулю 7?', opts: ['3', '5', '4', 'не существует'], a: 1, why: '3·5 = 15 = 2·7 + 1.' },
    { q: 'x ≡ 2 (mod 3), x ≡ 3 (mod 5). Наименьшее x ≥ 0?', opts: ['5', '8', '13', '23'], a: 1, why: 'Китайская теорема: решение единственно по модулю 15, это 8.' },
    { q: 'Число 561 = 3·11·17 проходит тест Ферма для всех взаимно простых оснований. Как его поймать?', opts: ['никак', 'тестом Миллера — Рабина', 'проверкой чётности', 'суммой цифр'], a: 1, why: 'У 561 всего 8 сильных лжецов среди 558 оснований 2…559; основание 2 — свидетель.' },
    { q: 'Почему 0.1 не хранится во float точно?', opts: ['мало памяти', 'знаменатель 10 содержит множитель 5, а точны только дроби со знаменателем 2ᵏ', 'ошибка процессора', 'хранится точно'], a: 1, why: '0.1 = 0.0(0011)₂ — бесконечная периодическая дробь.' },
    { q: 'С какого целого float32 перестаёт различать соседние целые?', opts: ['2¹⁶', '2²⁴ = 16 777 216', '2³²', '2⁵³'], a: 1, why: '24 значащих бита: 16 777 217 → 16 777 216.' },
    { q: 'np.array([200], np.uint8) + np.uint8(100) = ?', opts: ['300', '44', '255', 'ошибка'], a: 1, why: '300 mod 256 = 44: uint8 живёт по модулю 2⁸.' },
    { q: 'При каком условии ЛКГ с c ≠ 0 и m = 2³² имеет полный период?', opts: ['a простое', 'c нечётно и a ≡ 1 (mod 4)', 'a = c', 'всегда'], a: 1, why: 'Теорема Халла — Добелла для m = 2³².' },
    { q: 'Идентификаторы кратны 64, корзин 128, хеш id mod m. Сколько корзин занято?', opts: ['128', '2', '64', '1'], a: 1, why: '128 / НОД(64, 128) = 2.' },
    { q: 'Почему для стабильного разбиения нельзя брать hash() строки в Python?', opts: ['медленно', 'он «посолен» и меняется между запусками', 'даёт отрицательные числа', 'он криптостойкий'], a: 1, why: 'PYTHONHASHSEED; берите zlib.crc32 или hashlib.' },
  ];
  GBC.widget('nt-game', (el) => {
    const st0 = { order: [], i: 0, right: 0, streak: 0, picked: null, round: 1 };
    const w = ui.shell(el, { title: 'Тренажёр: теория чисел', sub: 'Шестнадцать задач по всему уроку: остатки, НОД, простые, сравнения, числа в компьютере, генераторы и хеширование. Порядок перемешивается заново на каждом круге.' });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.05rem;padding:6px 0 12px' });
    w.main.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:8px' });
    w.main.appendChild(optsBox);
    let circle = 0;
    const reshuffle = () => (st0.order = new GBC.RNG(2026 + circle++).permutation(IQ.length));
    reshuffle();
    const next = ui.button(w.controls, { label: 'Следующий', icon: 'step', onClick: () => {
      st0.i++;
      if (st0.i >= IQ.length) (st0.i = 0), reshuffle();
      st0.round++;
      st0.picked = null;
      draw();
    } });
    ui.button(w.controls, { label: 'Сначала', icon: 'reset', onClick: () => {
      Object.assign(st0, { i: 0, right: 0, streak: 0, picked: null, round: 1 });
      circle = 0;
      reshuffle();
      draw();
    } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function draw() {
      const Q = IQ[st0.order[st0.i]];
      qEl.textContent = Q.q;
      optsBox.textContent = '';
      // варианты показываем в перемешанном порядке (иначе верный ответ узнавался бы по позиции)
      const perm = new GBC.RNG(31 * st0.order[st0.i] + circle).permutation(Q.opts.length);
      perm.forEach((k) => {
        const o = Q.opts[k];
        const b = ui.button(optsBox, { label: o, kind: st0.picked === null ? '' : k === Q.a ? 'primary' : '', onClick: () => {
          if (st0.picked !== null) return;
          st0.picked = k;
          if (k === Q.a) (st0.right++, st0.streak++);
          else st0.streak = 0;
          draw();
        } });
        b.style.whiteSpace = 'normal';
        b.style.textAlign = 'left';
        b.style.height = 'auto';
        if (st0.picked !== null) b.disabled = true;
      });
      st.set('r', String(st0.round));
      st.set('ok', st0.right + ' из ' + (st0.round - (st0.picked === null ? 1 : 0)));
      st.set('s', String(st0.streak));
      note.innerHTML = st0.picked === null ? 'Подсказка: почти всё здесь решается делением с остатком.' : (st0.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет</b>, ответ: ' + Q.opts[Q.a] + '. ') + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), st0.picked === null ? 'Пропустить' : 'Следующий');
    }
    draw();
  });
})();
