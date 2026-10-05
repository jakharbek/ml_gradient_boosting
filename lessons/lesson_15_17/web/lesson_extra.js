/* Урок 15.17: комбинаторика. Часть 2 — ящики и разбиения, мощные приёмы, вероятность, бустинг.
 * Виджеты: звёзды и перегородки; целые решения уравнения; неравновероятные мультимножества; разбиения
 * множества (Стирлинг, Белл); 12 задач о шарах и ящиках; включения-исключения для трёх множеств;
 * беспорядки; принцип Дирихле; замощения и Фибоначчи; числа Каталана и формы деревьев; производящие
 * функции; гипергеометрическое распределение; дни рождения; бутстрэп и 1/e; собиратель купонов;
 * перестановочный тест; разбиения категорий; пространство деревьев; число разбиений на фолды;
 * веса Шепли; Шепли по случайным порядкам; тренажёр-генератор задач.
 * Помощники — из GBC.lesson1517 (часть 1, lesson.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const {
    f2, f3, f4, py, sup, num, fmtB, numLog10, pct, plural,
    fact, comb, perm, factB, combB, lgamma, lnFact, gcd, lcm,
    combos, perms, words, multisets,
    LET, cvar, tint, tile, flexRow, texInto, texEl, card, cardGrid, rowTable, scrollBox, monoBox, svgBox, sText, legendRow,
    PY_MATH, PY_IT,
  } = GBC.lesson1517;
  const lnC = (n, k) => (k < 0 || k > n ? -Infinity : lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1));
  const PY_RNG = 'from gbcourse.rng import Mulberry32\n';
  /** Числа Стирлинга второго рода S(n, k) (таблица до nMax). */
  const STIR = (() => {
    const T = [[1]];
    for (let n = 1; n <= 12; n++) {
      T.push([0]);
      for (let k = 1; k <= n; k++) T[n].push(k * (T[n - 1][k] || 0) + (T[n - 1][k - 1] || 0));
    }
    return T;
  })();
  const stir = (n, k) => (k < 0 || k > n ? 0 : STIR[n][k]);
  const bell = (n) => U.sum(STIR[n]);
  /** Разбиения числа n ровно на k слагаемых p(n, k). */
  function partK(n, k) {
    const T = [];
    for (let i = 0; i <= n; i++) T.push(new Array(k + 1).fill(0));
    T[0][0] = 1;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= Math.min(i, k); j++) T[i][j] = T[i - 1][j - 1] + (i - j >= j ? T[i - j][j] : 0);
    return T[n][k];
  }
  const derange = (() => {
    const D = [1, 0];
    for (let n = 2; n <= 20; n++) D.push((n - 1) * (D[n - 1] + D[n - 2]));
    return D;
  })();

  /* ==============================================================================
   * 19. Звёзды и перегородки
   * ============================================================================== */
  GBC.widget('stars-bars', (el) => {
    const s = { n: 3, k: 4, idx: 0 };
    let all = multisets(s.n, s.k);
    const w = ui.shell(el, { title: 'Выбор с повторениями: звёзды и перегородки', sub: 'Берём k раз из n видов, порядок не важен, повторы можно (k шариков мороженого из n вкусов). Каждый выбор = ряд из k звёзд и n − 1 перегородок.' });
    const reset = () => {
      all = multisets(s.n, s.k);
      s.idx = 0;
      pl.stop();
      pl.setMax(all.length - 1);
      pl.set(0);
      draw();
    };
    ui.slider(w.controls, { label: 'Видов n', min: 2, max: 5, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), reset()) });
    ui.slider(w.controls, { label: 'Выборов k', min: 1, max: 6, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Перебор выборок', min: 0, max: all.length - 1, value: 0, fps: 2, format: (k, m) => k + 1 + ' из ' + (m + 1), onChange: (k) => ((s.idx = k), draw()) });
    const row = flexRow('justify-content:center;gap:4px;padding:12px 0 4px');
    const lettersEl = monoBox('text-align:center;color:var(--ink-2)');
    w.main.append(row, lettersEl);
    const plot = new GBC.Plot(w.main, { height: 190, x: { label: 'вид', domain: [0.4, 5.6], ticks: [] }, y: { label: 'сколько раз взят', domain: [-0.7, 6.4], ticks: [0, 1, 2, 3, 4, 5, 6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'выборок C(n + k − 1, k)' }, { key: 'o', label: 'слов с порядком nᵏ' }, { key: 'pos', label: 'позиций в ряду' }]);
    function draw() {
      const cur = all[s.idx];
      const cnt = new Array(s.n).fill(0);
      cur.forEach((t) => cnt[t]++);
      row.textContent = '';
      cnt.forEach((c, i) => {
        for (let j = 0; j < c; j++) row.appendChild(H('span', { style: 'font-size:1.5rem;color:' + cvar(i) + ';line-height:1' }, '★'));
        if (i < s.n - 1) row.appendChild(H('span', { style: 'display:inline-block;width:4px;height:30px;border-radius:2px;background:var(--ink);margin:0 6px' }));
      });
      lettersEl.textContent = '{ ' + cur.map((t) => LET[t]).join(', ') + ' }  →  ' + cnt.map((c, i) => LET[i] + '×' + c).join(', ');
      const xs = U.range(s.n, 1);
      plot.render([
        { type: 'bars', x: xs, y: cnt, color: 'model', width: 0.6, maxPx: 40 },
        { type: 'text', items: xs.map((x, i) => ({ x, y: -0.4, anchor: 'middle', text: LET[i], bold: true })) },
      ]);
      st.set('m', 'C(' + (s.n + s.k - 1) + ', ' + s.k + ') = ' + all.length);
      st.set('o', s.n + sup(s.k) + ' = ' + num(Math.pow(s.n, s.k)));
      st.set('pos', s.k + ' + ' + (s.n - 1) + ' = ' + (s.n + s.k - 1));
      note.innerHTML = 'Звёзды до первой перегородки — сколько раз взят A, между первой и второй — B и т. д. Ряд из k звёзд и n − 1 перегородок однозначно задаёт выборку, и наоборот (биекция, шаг 4). Значит, выборок столько, сколько способов выбрать, какие k из n + k − 1 позиций — звёзды: <b>C(n + k − 1, k)</b> = C(n + k − 1, n − 1). Различных бутстрэп-выборок из n объектов (k = n) — C(2n − 1, n): при n = 10 это 92 378, а упорядоченных последовательностей 10<sup>10</sup>.';
    }
    w.pythonAction(() => 'from itertools import combinations_with_replacement\nfrom math import comb\n\nn, k = ' + s.n + ', ' + s.k + '\nms = list(combinations_with_replacement("' + LET.slice(0, s.n) + '", k))\nprint(len(ms), "=", comb(n + k - 1, k))\nfor m in ms[:5]:\n    print("".join(m), "→", "|".join("*" * m.count(c) for c in "' + LET.slice(0, s.n) + '"))\n');
    draw();
  });

  /* ==============================================================================
   * 20. Целые решения x₁ + … + xₙ = k
   * ============================================================================== */
  GBC.widget('integer-solutions', (el) => {
    const s = { n: 3, k: 10, lo: 0, cap: 0, idx: 0 };
    const w = ui.shell(el, { title: 'Целые решения уравнения x₁ + … + xₙ = k', sub: 'Сколькими способами разделить k одинаковых конфет между n детьми? С нижней границей (каждому хотя бы L) и верхней (никому больше c). Точки — число решений, найденное перебором.' });
    ui.slider(w.controls, { label: 'Детей n', min: 2, max: 5, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), (s.idx = 0), draw()) });
    ui.slider(w.controls, { label: 'Конфет k', min: 0, max: 14, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), (s.idx = 0), draw()) });
    ui.slider(w.controls, { label: 'Каждому не меньше L', min: 0, max: 3, step: 1, value: s.lo, format: String, onInput: (v) => ((s.lo = v), (s.idx = 0), draw()) });
    ui.slider(w.controls, { label: 'Никому больше c (0 — без ограничения)', min: 0, max: 8, step: 1, value: s.cap, format: (v) => (v ? String(v) : '∞'), onInput: (v) => ((s.cap = v), (s.idx = 0), draw()) });
    const pl = ui.player(w.controls, { label: 'Решение', min: 0, max: 1, value: 0, fps: 2, format: (k, m) => k + 1 + ' из ' + (m + 1), onChange: (k) => ((s.idx = k), draw(false)) });
    const vis = flexRow('justify-content:center;gap:4px;padding:10px 0 2px;min-height:44px');
    const eq = texEl('', true, 'margin:4px 0');
    const list = monoBox('font-size:.8rem;color:var(--ink-2)');
    w.main.append(vis, eq, list);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'по формуле' }, { key: 'b', label: 'перебором' }, { key: 'cur', label: 'решение' }]);
    function solutions() {
      const out = [];
      const hi = s.cap ? s.cap : s.k;
      const cur = [];
      (function rec(i, left) {
        if (i === s.n - 1) {
          if (left >= s.lo && left <= hi) out.push(cur.concat([left]));
          return;
        }
        for (let v = s.lo; v <= Math.min(hi, left); v++) {
          cur.push(v);
          rec(i + 1, left - v);
          cur.pop();
        }
      })(0, s.k);
      return out;
    }
    function formula() {
      const { n, k, lo, cap } = s;
      const K = k - n * lo;
      if (K < 0) return { v: 0, tex: '\\text{не хватает: } k < n \\cdot L' };
      if (!cap) return { v: comb(K + n - 1, n - 1), tex: '\\binom{k - nL + n - 1}{n - 1} = \\binom{' + (K + n - 1) + '}{' + (n - 1) + '} = ' + comb(K + n - 1, n - 1) };
      if (cap < lo) return { v: 0, tex: '\\text{c < L — решений нет}' };
      const step = cap - lo + 1;
      let v = 0;
      const terms = [];
      for (let j = 0; j <= n && K - j * step >= 0; j++) {
        const t = comb(n, j) * comb(K - j * step + n - 1, n - 1);
        v += (j % 2 ? -1 : 1) * t;
        terms.push((j ? (j % 2 ? ' - ' : ' + ') : '') + '\\binom{' + n + '}{' + j + '}\\binom{' + (K - j * step + n - 1) + '}{' + (n - 1) + '}');
      }
      return { v, tex: terms.join('') + ' = ' + v };
    }
    function draw(rebuild = true) {
      const sol = solutions();
      if (rebuild) {
        pl.stop();
        pl.setMax(Math.max(0, sol.length - 1));
        pl.set(Math.min(s.idx, Math.max(0, sol.length - 1)));
      }
      const cur = sol[s.idx];
      vis.textContent = '';
      if (cur) {
        cur.forEach((c, i) => {
          for (let j = 0; j < c; j++) vis.appendChild(H('span', { style: 'font-size:1.4rem;line-height:1;color:' + (j < s.lo ? 'var(--muted)' : cvar(i)) }, '●'));
          if (!c) vis.appendChild(H('span', { style: 'font-size:.8rem;color:var(--muted)' }, '∅'));
          if (i < s.n - 1) vis.appendChild(H('span', { style: 'display:inline-block;width:4px;height:28px;border-radius:2px;background:var(--ink);margin:0 6px' }));
        });
      } else vis.appendChild(H('span', { style: 'color:var(--ink-2)' }, 'решений нет'));
      const F = formula();
      texInto(eq, F.tex, true);
      list.textContent = sol.length ? 'Решения (x₁, …, xₙ): ' + sol.slice(0, 120).map((t) => '(' + t.join(',') + ')').join(' ') + (sol.length > 120 ? ' …' : '') : '';
      st.set('f', num(F.v));
      st.set('b', num(sol.length));
      st.set('cur', cur ? cur.join(' + ') + ' = ' + s.k : '—');
      note.innerHTML = '<b>Без ограничений</b> это звёзды и перегородки: k конфет-звёзд и n − 1 перегородок, C(k + n − 1, n − 1). <b>«Каждому хотя бы L»</b> — сначала раздадим всем по L (серые кружки), а остаток k − nL поделим свободно: сдвиг сводит задачу к предыдущей. <b>«Никому больше c»</b> — включения-исключения (шаг 23): из всех решений вычитаем те, где кто-то получил больше c (дадим ему сразу c + 1 и поделим остаток), добавляем обратно случаи, где таких двое, и т. д. Та же задача: число способов набрать сумму на кубиках (шаг 28) и число разложений n объектов по корзинам с ёмкостями.';
    }
    w.pythonAction(() => PY_IT + PY_MATH + '\nn, k, L, c = ' + s.n + ', ' + s.k + ', ' + s.lo + ', ' + (s.cap || 'None') + '\nhi = c if c else k\nsols = [t for t in product(range(L, hi + 1), repeat=n) if sum(t) == k]\nprint("перебор:", len(sols), sols[:6])\nif c is None:\n    print("формула:", comb(k - n * L + n - 1, n - 1) if k >= n * L else 0)\nelse:\n    K, step = k - n * L, c - L + 1\n    print("включения-исключения:", sum((-1)**j * comb(n, j) * comb(K - j * step + n - 1, n - 1) for j in range(n + 1) if K - j * step >= 0))\n');
    draw();
  });

  /* ==============================================================================
   * 21. Мультимножества неравновероятны
   * ============================================================================== */
  GBC.widget('multiset-prob', (el) => {
    const PRE = { dice: { n: 6, k: 2, name: 'два кубика' }, b3: { n: 3, k: 3, name: 'бутстрэп из 3' }, b4: { n: 4, k: 4, name: 'бутстрэп из 4' } };
    const s = { pre: 'dice', sim: null, seed: 1 };
    const w = ui.shell(el, { title: 'Ловушка: исходы «без порядка» неравновероятны', sub: 'Бросаем два кубика или делаем бутстрэп-выборку. Неупорядоченных исходов мало, но вероятности у них разные: исход собирается из разного числа равновероятных упорядоченных последовательностей.' });
    ui.segmented(w.controls, { label: 'Опыт', value: s.pre, options: Object.keys(PRE).map((key) => ({ value: key, label: PRE[key].name })), onChange: (v) => ((s.pre = v), (s.sim = null), draw()) });
    ui.button(w.controls, { label: 'Смоделировать 3000 раз', icon: 'play', kind: 'primary', onClick: () => (simulate(), draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'неупорядоченный исход (по убыванию вероятности)' }, y: { label: 'вероятность' } });
    const tbl = scrollBox();
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'исходов без порядка' }, { key: 'o', label: 'с порядком nᵏ' }, { key: 'mx', label: 'самый вероятный' }, { key: 'mn', label: 'самый редкий' }]);
    function outcomes() {
      const { n, k } = PRE[s.pre];
      const tot = Math.pow(n, k);
      return multisets(n, k).map((ms) => {
        const cnt = new Map();
        ms.forEach((t) => cnt.set(t, (cnt.get(t) || 0) + 1));
        let ways = fact(k);
        cnt.forEach((c) => (ways /= fact(c)));
        const label = s.pre === 'dice' ? '{' + ms.map((t) => t + 1).join(',') + '}' : '{' + ms.map((t) => LET[t]).join('') + '}';
        return { ms, key: ms.join(','), ways, p: ways / tot, label };
      }).sort((a, b) => b.p - a.p || (a.key < b.key ? -1 : 1));
    }
    function simulate() {
      const { n, k } = PRE[s.pre];
      const rng = new GBC.RNG(s.seed++);
      const cnt = new Map();
      for (let r = 0; r < 3000; r++) {
        const ms = [];
        for (let i = 0; i < k; i++) ms.push(rng.randint(n));
        ms.sort((a, b) => a - b);
        const key = ms.join(',');
        cnt.set(key, (cnt.get(key) || 0) + 1);
      }
      s.sim = cnt;
    }
    function draw() {
      const O = outcomes();
      const { n, k } = PRE[s.pre];
      const xs = U.range(O.length, 1);
      const L = [
        { type: 'bars', x: xs, y: O.map((o) => o.p), color: 'model', width: 0.8, maxPx: 22, label: 'точная вероятность', tooltip: (i) => [['исход', O[i].label], ['последовательностей', String(O[i].ways)], ['вероятность', f4(O[i].p)]] },
        { type: 'hline', y: 1 / O.length, color: 'critical', dash: '5 4', width: 1.5, label: 'ошибочно «все равны»: 1/' + O.length },
      ];
      if (s.sim) L.push({ type: 'points', x: xs, y: O.map((o) => (s.sim.get(o.key) || 0) / 3000), color: 'tree', r: 4, hollow: true, label: 'частота в 3000 опытах', tooltip: (i) => [['исход', O[i].label], ['частота', f4((s.sim.get(O[i].key) || 0) / 3000)]] });
      plot.render(L, { x: [0.3, O.length + 0.7], y: [0, Math.max(...O.map((o) => o.p)) * 1.2] });
      rowTable(tbl, ['исход', 'последовательностей', 'вероятность'], O.slice(0, 12).map((o) => [o.label, String(o.ways), f4(o.p)]).concat(O.length > 12 ? [['…', '', '']] : []));
      st.set('m', String(O.length));
      st.set('o', n + sup(k) + ' = ' + Math.pow(n, k));
      st.set('mx', O[0].label + ': ' + f3(O[0].p));
      st.set('mn', O[O.length - 1].label + ': ' + f3(O[O.length - 1].p));
      note.innerHTML = s.pre === 'dice'
        ? 'Равновероятны 36 <b>упорядоченных</b> пар (первый кубик, второй кубик). Исход {5, 6} собирается из двух пар (5, 6) и (6, 5), а {6, 6} — из одной: вероятности 2/36 и 1/36. Неупорядоченных исходов 21 = C(6 + 2 − 1, 2), но считать каждый за 1/21 — классическая ошибка (её делал даже Лейбниц, считая суммы 11 и 12 равновероятными). Звёзды и перегородки <em>считают</em> исходы, но не делают их равновероятными.'
        : 'Бутстрэп-выборка — это n независимых равновероятных выборов: равновероятны n<sup>n</sup> = ' + Math.pow(n, k) + ' последовательностей. Мультимножество с кратностями c<sub>1</sub>, c<sub>2</sub>, … собирается из k!/(c<sub>1</sub>!·c<sub>2</sub>!·…) последовательностей (анаграммы, шаг 11). Поэтому выборка «все разные» {' + LET.slice(0, n) + '} — самая вероятная (' + f3(fact(n) / Math.pow(n, n)) + '), а «один объект n раз» — самая редкая (1/' + Math.pow(n, n) + '). При n = 10 «все разные» имеет вероятность 10!/10¹⁰ ≈ 0.00036 — и всё равно это самый вероятный отдельный исход.';
    }
    w.pythonAction(() => {
      const { n, k } = PRE[s.pre];
      return 'from collections import Counter\nfrom itertools import product\nfrom fractions import Fraction\n\nn, k = ' + n + ', ' + k + '\nc = Counter(tuple(sorted(t)) for t in product(range(n), repeat=k))\nprint("исходов без порядка:", len(c), " последовательностей:", n**k)\nfor ms, ways in c.most_common(4):\n    print(ms, ways, Fraction(ways, n**k))\n' + PY_RNG + 'rng = Mulberry32(1)\nsim = Counter(tuple(sorted(rng.randint(n) for _ in range(k))) for _ in range(3000))\nprint("частоты:", {ms: round(v / 3000, 3) for ms, v in sim.most_common(3)})\n';
    });
    draw();
  });

  /* ==============================================================================
   * 22. Разбиения множества: числа Стирлинга и Белла
   * ============================================================================== */
  function setPartitions(n, r) {
    const out = [];
    const a = new Array(n).fill(0);
    (function rec(i, mx) {
      if (i === n) {
        if (!r || mx + 1 === r) out.push(a.slice());
        return;
      }
      for (let v = 0; v <= mx + 1; v++) {
        if (r && v >= r) break;
        a[i] = v;
        rec(i + 1, Math.max(mx, v));
      }
    })(0, -1);
    if (n === 0) return [[]];
    return out;
  }
  GBC.widget('set-partitions', (el) => {
    const s = { n: 4, r: 2 };
    const w = ui.shell(el, { title: 'Разбиения множества: числа Стирлинга и Белла', sub: 'Сколькими способами разбить n различных предметов на r непустых групп, если группы не помечены? Это число Стирлинга второго рода S(n, r). Сумма по r — число Белла B(n). Цвет плитки — номер группы.' });
    ui.slider(w.controls, { label: 'Предметов n', min: 1, max: 6, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Групп r (0 — любое число)', min: 0, max: 6, step: 1, value: s.r, format: (v) => (v ? String(v) : 'любое'), onInput: (v) => ((s.r = v), draw()) });
    const grid = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:4px 0 8px' });
    const tbl = scrollBox();
    w.main.append(grid, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 's', label: 'S(n, r)' }, { key: 'b', label: 'B(n) — все разбиения' }, { key: 'surj', label: 'с помеченными группами r!·S(n, r)' }]);
    function draw() {
      const n = s.n;
      const r = Math.min(s.r, n);
      const P = setPartitions(n, r);
      grid.textContent = '';
      P.slice(0, 60).forEach((a) => {
        const groups = [];
        a.forEach((g, i) => (groups[g] = groups[g] || []).push(i));
        const box = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:6px 8px;background:var(--surface)' });
        groups.forEach((g, gi) => {
          const gr = H('span', { style: 'display:inline-flex;gap:2px;padding:2px;border-radius:8px;background:' + tint(cvar(gi), 16) });
          g.forEach((i) => gr.appendChild(tile(LET[i], gi, { size: 1.7, font: 0.85 })));
          box.appendChild(gr);
        });
        grid.appendChild(box);
      });
      if (P.length > 60) grid.appendChild(H('div', { style: 'align-self:center;color:var(--ink-2);font-size:.86rem' }, '… и ещё ' + (P.length - 60)));
      const rows = U.range(8, 1).map((m) => [String(m), ...U.range(8, 1).map((j) => (j <= m ? String(stir(m, j)) : '')), String(bell(m))]);
      rowTable(tbl, ['n \\ r', '1', '2', '3', '4', '5', '6', '7', '8', 'B(n)'], rows, (i) => i + 1 === n);
      const Sv = r ? stir(n, r) : bell(n);
      st.set('s', r ? 'S(' + n + ', ' + r + ') = ' + stir(n, r) : '—');
      st.set('b', String(bell(n)));
      st.set('surj', r ? r + '!·' + stir(n, r) + ' = ' + fact(r) * stir(n, r) : '—');
      note.innerHTML = 'Показано ' + Math.min(P.length, 60) + ' из ' + Sv + '. Рекуррентность: предмет n либо сидит в отдельной группе (остальные — S(n − 1, r − 1) способами), либо присоединяется к одной из r групп разбиения остальных (r·S(n − 1, r)): <b>S(n, r) = S(n − 1, r − 1) + r·S(n − 1, r)</b>. Если группы помечены (ящик 1, ящик 2, …), каждое разбиение даёт r! вариантов — это число <b>сюръекций</b> (отображений «на») r!·S(n, r). <b>В бустинге:</b> S(k, 2) = 2<sup>k−1</sup> − 1 — ровно число разбиений k категорий на две стороны дерева (шаг 33), а B(k) — число способов как угодно объединить категории в группы (B(10) = 115 975).';
    }
    w.pythonAction(() => 'from math import factorial\nfrom scipy.special import stirling2\n\nn, r = ' + s.n + ', ' + (Math.min(s.r, s.n) || s.n) + '\n\ndef partitions(items):\n    """Все разбиения списка на непомеченные группы."""\n    if not items:\n        yield []\n        return\n    first, rest = items[0], items[1:]\n    for p in partitions(rest):\n        yield [[first]] + p\n        for i in range(len(p)):\n            yield p[:i] + [[first] + p[i]] + p[i + 1:]\n\nP = list(partitions(list("' + LET.slice(0, s.n) + '")))\nprint("Белл B(n):", len(P))\nprint("S(n, r):", sum(len(p) == r for p in P), int(stirling2(n, r, exact=True)), " сюръекций:", factorial(r) * int(stirling2(n, r, exact=True)))\n');
    draw();
  });

  /* ==============================================================================
   * 23. Шары и ящики: двенадцать задач в одной таблице
   * ============================================================================== */
  GBC.widget('balls-boxes', (el) => {
    const s = { n: 4, k: 3, balls: 'dist', boxes: 'dist', rule: 'any', idx: 0 };
    const w = ui.shell(el, { title: 'Шары и ящики: двенадцать задач в одной таблице', sub: 'n шаров раскладываем по k ящикам. Шары различимы или одинаковы, ящики различимы или одинаковы, в ящике — сколько угодно, не больше одного или хотя бы один. Таблица — формулы всех 12 случаев; счётчик «перебор» проверяет текущий.' });
    const reset = () => ((s.idx = 0), draw());
    ui.slider(w.controls, { label: 'Шаров n', min: 1, max: 6, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), reset()) });
    ui.slider(w.controls, { label: 'Ящиков k', min: 1, max: 5, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), reset()) });
    ui.segmented(w.controls, { label: 'Шары', value: s.balls, options: [{ value: 'dist', label: 'разные' }, { value: 'same', label: 'одинаковые' }], onChange: (v) => ((s.balls = v), reset()) });
    ui.segmented(w.controls, { label: 'Ящики', value: s.boxes, options: [{ value: 'dist', label: 'разные' }, { value: 'same', label: 'одинаковые' }], onChange: (v) => ((s.boxes = v), reset()) });
    ui.segmented(w.controls, { label: 'В ящике', value: s.rule, options: [{ value: 'any', label: 'сколько угодно' }, { value: 'le1', label: '≤ 1' }, { value: 'ge1', label: '≥ 1' }], onChange: (v) => ((s.rule = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Раскладка', min: 0, max: 1, value: 0, fps: 1.5, format: (k, m) => k + 1 + ' из ' + (m + 1), onChange: (k) => ((s.idx = k), drawConfig()) });
    const cfg = H('div');
    const tbl = scrollBox();
    w.main.append(cfg, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'по формуле' }, { key: 'b', label: 'перебор' }]);
    const RULES = ['any', 'le1', 'ge1'];
    const CASES = [
      ['dist', 'dist', 'разные → разные', [(n, k) => Math.pow(k, n), (n, k) => perm(k, n), (n, k) => fact(k) * stir(n, k)], ['k^n', 'A_k^n', 'k!\\,S(n,k)']],
      ['same', 'dist', 'одинаковые → разные', [(n, k) => comb(n + k - 1, n), (n, k) => comb(k, n), (n, k) => comb(n - 1, k - 1)], ['\\binom{n+k-1}{n}', '\\binom{k}{n}', '\\binom{n-1}{k-1}']],
      ['dist', 'same', 'разные → одинаковые', [(n, k) => U.sum(U.range(k + 1).map((j) => stir(n, j))), (n, k) => (n <= k ? 1 : 0), (n, k) => stir(n, k)], ['\\sum_{j \\le k} S(n,j)', '[n \\le k]', 'S(n,k)']],
      ['same', 'same', 'одинаковые → одинаковые', [(n, k) => U.sum(U.range(k + 1).map((j) => partK(n, j))), (n, k) => (n <= k ? 1 : 0), (n, k) => partK(n, k)], ['p_{\\le k}(n)', '[n \\le k]', 'p_k(n)']],
    ];
    let configs = [];
    function enumerate() {
      const { n, k } = s;
      const seen = new Map();
      words(k, n).forEach((f) => {
        const cnt = new Array(k).fill(0);
        f.forEach((b) => cnt[b]++);
        if (s.rule === 'le1' && cnt.some((c) => c > 1)) return;
        if (s.rule === 'ge1' && cnt.some((c) => c === 0)) return;
        let boxes = U.range(k).map((j) => (s.balls === 'dist' ? f.map((b, i) => (b === j ? i : -1)).filter((i) => i >= 0) : cnt[j]));
        if (s.boxes === 'same') boxes = boxes.slice().sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? 1 : -1));
        const key = JSON.stringify(boxes);
        if (!seen.has(key)) seen.set(key, boxes);
      });
      return [...seen.values()];
    }
    function drawConfig() {
      cfg.textContent = '';
      const c = configs[s.idx];
      if (!c) return void cfg.appendChild(H('div', { style: 'text-align:center;color:var(--ink-2);padding:14px' }, 'Раскладок нет: ' + (s.rule === 'le1' ? 'шаров больше, чем ящиков' : 'ящиков больше, чем шаров')));
      const row = flexRow('justify-content:center;gap:10px;padding:8px 0');
      c.forEach((box, j) => {
        const inner = flexRow('gap:3px;justify-content:center;min-height:30px');
        if (s.balls === 'dist') box.forEach((i) => inner.appendChild(H('span', { style: 'width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;background:' + tint(cvar(i), 45) + ';border:2px solid ' + cvar(i) + ';color:var(--ink)' }, String(i + 1))));
        else for (let t = 0; t < box; t++) inner.appendChild(H('span', { style: 'width:20px;height:20px;border-radius:50%;display:inline-block;background:var(--muted)' }));
        row.appendChild(H('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:3px' },
          H('div', { style: 'width:' + Math.max(64, 28 * (s.balls === 'dist' ? box.length : box) + 12) + 'px;min-height:46px;display:flex;align-items:center;justify-content:center;border-radius:0 0 12px 12px;border:2px ' + (s.boxes === 'dist' ? 'solid var(--c-blue)' : 'dashed var(--border-strong)') + ';border-top:none;padding:6px' }, inner),
          H('span', { style: 'font-size:.75rem;color:var(--ink-2)' }, s.boxes === 'dist' ? 'ящик ' + (j + 1) : '')));
      });
      cfg.appendChild(row);
    }
    function draw() {
      const { n, k } = s;
      configs = enumerate();
      pl.stop();
      pl.setMax(Math.max(0, configs.length - 1));
      pl.set(0);
      drawConfig();
      const t = H('table', { class: 'data' });
      t.appendChild(H('thead', null, H('tr', null, H('th', null, 'шары → ящики'), H('th', null, 'сколько угодно'), H('th', null, 'не больше одного'), H('th', null, 'хотя бы один'))));
      const tb = H('tbody');
      let fval = 0;
      CASES.forEach(([b, x, name, fns, texs]) => {
        const tr = H('tr', null, H('td', { style: 'white-space:nowrap' }, name));
        RULES.forEach((r, ri) => {
          const on = b === s.balls && x === s.boxes && r === s.rule;
          const v = fns[ri](n, k);
          if (on) fval = v;
          const td = H('td', { style: 'cursor:pointer;white-space:nowrap;' + (on ? 'background:var(--accent-soft);outline:2px solid var(--accent);outline-offset:-2px' : '') });
          td.appendChild(texEl(texs[ri], false));
          td.appendChild(H('div', { style: 'font-weight:700;font-variant-numeric:tabular-nums' }, '= ' + num(v)));
          td.addEventListener('click', () => {
            s.balls = b;
            s.boxes = x;
            s.rule = r;
            s.idx = 0;
            w.controls.querySelectorAll('.segmented').forEach((seg, si) => {
              const val = [s.balls, s.boxes, s.rule][si];
              seg.querySelectorAll('button').forEach((btn, bi) => btn.setAttribute('aria-pressed', String([['dist', 'same'], ['dist', 'same'], RULES][si][bi] === val)));
            });
            draw();
          });
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      tbl.replaceChildren(t);
      st.set('f', num(fval));
      st.set('b', num(configs.length));
      note.innerHTML = 'Главная таблица перечислительной комбинаторики («двенадцатикратный путь»). <b>Разные шары → разные ящики</b>: каждый шар выбирает ящик — k<sup>n</sup>; по одному — размещения; «хотя бы один» — сюръекции. <b>Одинаковые шары</b> — важны только количества: звёзды и перегородки. <b>Одинаковые ящики</b> — важны только группы: числа Стирлинга S(n, k). <b>Одинаковые шары и ящики</b> — разбиения числа n на слагаемые p<sub>k</sub>(n): 4 = 3 + 1 = 2 + 2 = 2 + 1 + 1 = … Щёлкните клетку таблицы, чтобы выбрать случай. В ML: объекты по фолдам — разные шары; категории по группам разбиения — разные шары в одинаковые ящики.';
    }
    w.pythonAction(() => PY_IT + '\nn, k = ' + s.n + ', ' + s.k + '\nballs_same, boxes_same, rule = ' + (s.balls === 'same' ? 'True' : 'False') + ', ' + (s.boxes === 'same' ? 'True' : 'False') + ', "' + s.rule + '"\nseen = set()\nfor f in product(range(k), repeat=n):          # f[i] — ящик шара i\n    cnt = [f.count(j) for j in range(k)]\n    if rule == "le1" and max(cnt) > 1 or rule == "ge1" and min(cnt) == 0:\n        continue\n    boxes = [cnt[j] if balls_same else tuple(i for i in range(n) if f[i] == j) for j in range(k)]\n    seen.add(tuple(sorted(boxes)) if boxes_same else tuple(boxes))\nprint("раскладок:", len(seen))\n');
    draw();
  });

  /* ==============================================================================
   * 24. Включения-исключения для трёх множеств
   * ============================================================================== */
  GBC.widget('venn3', (el) => {
    const s = { N: 100, a: 2, b: 3, c: 5 };
    const w = ui.shell(el, { title: 'Включения-исключения: три множества', sub: 'Числа от 1 до N, кратные a, b или c. Сложили — пары посчитаны дважды, вычли пары — тройное пересечение ушло совсем, добавили обратно. В областях диаграммы — сколько чисел в каждой.' });
    ui.slider(w.controls, { label: 'N', min: 30, max: 300, step: 10, value: s.N, format: String, onInput: (v) => ((s.N = v), draw()) });
    ['a', 'b', 'c'].forEach((key) => ui.slider(w.controls, { label: key, min: 2, max: 9, step: 1, value: s[key], format: String, onInput: (v) => ((s[key] = v), draw()) }));
    const host = H('div');
    const eq = texEl('', true, 'margin:4px 0');
    w.main.append(host, eq);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'one', label: 'Σ |X|' }, { key: 'two', label: 'Σ |X ∩ Y|' }, { key: 'three', label: '|A ∩ B ∩ C|' }, { key: 'u', label: '|A ∪ B ∪ C|' }, { key: 'b', label: 'перебор' }]);
    function draw() {
      const { N, a, b, c } = s;
      const reg = new Array(8).fill(0);
      for (let i = 1; i <= N; i++) reg[(i % a === 0 ? 1 : 0) | (i % b === 0 ? 2 : 0) | (i % c === 0 ? 4 : 0)]++;
      host.textContent = '';
      const svg = svgBox(host, 400, 312, 300, 480);
      const C = [[150, 118, 'var(--c-blue)', 'A: кратные ' + a, 70, 24], [250, 118, 'var(--c-orange)', 'B: кратные ' + b, 330, 24], [200, 196, 'var(--c-aqua)', 'C: кратные ' + c, 200, 300]];
      C.forEach(([x, y, col]) => svg.appendChild(S('circle', { cx: x, cy: y, r: 86, style: 'fill:' + col + ';fill-opacity:.16;stroke:' + col + ';stroke-width:2' })));
      C.forEach(([, , col, t, tx, ty]) => svg.appendChild(sText(tx, ty, t, { size: 13, bold: true, color: 'var(--ink)' })));
      const POS = { 1: [112, 98], 2: [288, 98], 4: [200, 246], 3: [200, 86], 5: [148, 176], 6: [252, 176], 7: [200, 146], 0: [366, 286] };
      Object.entries(POS).forEach(([m, [x, y]]) => {
        svg.appendChild(sText(x, y, String(reg[m]), { size: m === '7' ? 17 : 15, bold: true, mono: true, color: 'var(--ink)' }));
      });
      svg.appendChild(sText(366, 268, 'вне всех', { size: 11, color: 'var(--ink-2)' }));
      const nA = Math.floor(N / a);
      const nB = Math.floor(N / b);
      const nC = Math.floor(N / c);
      const nAB = Math.floor(N / lcm(a, b));
      const nAC = Math.floor(N / lcm(a, c));
      const nBC = Math.floor(N / lcm(b, c));
      const nABC = Math.floor(N / lcm(lcm(a, b), c));
      const u = nA + nB + nC - nAB - nAC - nBC + nABC;
      texInto(eq, '|A \\cup B \\cup C| = \\underbrace{' + nA + ' + ' + nB + ' + ' + nC + '}_{\\text{одиночки}} - \\underbrace{(' + nAB + ' + ' + nAC + ' + ' + nBC + ')}_{\\text{пары}} + \\underbrace{' + nABC + '}_{\\text{тройка}} = ' + u, true);
      st.set('one', String(nA + nB + nC));
      st.set('two', String(nAB + nAC + nBC));
      st.set('three', String(nABC));
      st.set('u', String(u));
      st.set('b', String(N - reg[0]));
      note.innerHTML = 'Проследим за числом из центра (кратным ' + lcm(lcm(a, b), c) + '): в «одиночках» оно посчитано 3 раза, в «парах» вычтено 3 раза — итого 0, поэтому его добавляют обратно. Число из ровно двух множеств: +2 − 1 = 1. Общая формула для m множеств: <b>сумма по всем непустым наборам множеств со знаком (−1)<sup>размер+1</sup></b> мощностей их пересечений, ведь элемент из t множеств посчитан C(t, 1) − C(t, 2) + C(t, 3) − … = 1 раз (это (1 − 1)<sup>t</sup> = 0 из бинома). Через формулу считают беспорядки (шаг 24), сюръекции (шаг 21), числа, взаимно простые с N, и объекты, у которых пропущен хотя бы один из признаков.';
    }
    w.pythonAction(() => 'from math import lcm\n\nN, a, b, c = ' + s.N + ', ' + s.a + ', ' + s.b + ', ' + s.c + '\nA, B, C = ({i for i in range(1, N + 1) if i % d == 0} for d in (a, b, c))\nf = lambda d: N // d\nie = f(a) + f(b) + f(c) - f(lcm(a, b)) - f(lcm(a, c)) - f(lcm(b, c)) + f(lcm(a, b, c))\nprint("перебор:", len(A | B | C), " включения-исключения:", ie)\n');
    draw();
  });

  /* ==============================================================================
   * 25. Беспорядки: никто не получил своё письмо
   * ============================================================================== */
  GBC.widget('derangements', (el) => {
    const s = { n: 6, seed: 1, sim: null };
    const w = ui.shell(el, { title: 'Беспорядки: ни одно письмо не попало в свой конверт', sub: 'n писем случайно разложили по n конвертам. Перестановка без неподвижных точек называется беспорядком (derangement). Их доля быстро стремится к 1/e, а число совпадений — к распределению Пуассона со средним 1.' });
    ui.slider(w.controls, { label: 'Писем n', min: 1, max: 10, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), (s.sim = null), draw()) });
    ui.button(w.controls, { label: 'Разложить 2000 раз', icon: 'play', kind: 'primary', onClick: () => (simulate(), draw()) });
    const row = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:6px;margin:6px 0' });
    w.main.appendChild(row);
    const p1 = new GBC.Plot(w.main, { height: 200, x: { label: 'n', domain: [0.5, 12.5], ticks: U.range(12, 1) }, y: { label: 'доля беспорядков !n/n!', domain: [0, 1.02] } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'совпадений (писем в своих конвертах)' }, y: { label: 'вероятность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: '!n' }, { key: 'e', label: 'n!/e' }, { key: 'p', label: 'P(ни одного совпадения)' }, { key: 'm', label: 'среднее совпадений' }]);
    const exactFixed = (n, j) => (comb(n, j) * derange[n - j]) / fact(n);
    function simulate() {
      const rng = new GBC.RNG(s.seed++);
      const cnt = new Array(s.n + 1).fill(0);
      let last = null;
      for (let r = 0; r < 2000; r++) {
        const p = rng.permutation(s.n);
        let f = 0;
        p.forEach((v, i) => v === i && f++);
        cnt[f]++;
        last = p;
      }
      s.sim = { cnt, last };
    }
    function draw() {
      const n = s.n;
      const p = s.sim ? s.sim.last : new GBC.RNG(s.seed).permutation(n);
      row.textContent = '';
      p.forEach((v, i) => {
        const fixed = v === i;
        row.appendChild(H('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border-radius:10px;border:2px solid ' + (fixed ? 'var(--c-orange)' : 'var(--border)') + ';background:' + (fixed ? tint('var(--c-orange)', 18) : 'transparent') },
          H('span', { style: 'font-size:.7rem;color:var(--ink-2)' }, 'конверт ' + (i + 1)),
          tile(String(v + 1), v, { size: 1.8, font: 0.9 })));
      });
      const ns = U.range(12, 1);
      p1.render([
        { type: 'hline', y: 1 / Math.E, color: 'ink2', dash: '4 4', width: 1, text: '1/e ≈ 0.368' },
        { type: 'line', x: ns, y: ns.map((m) => derange[m] / fact(m)), color: 'model', width: 2, hover: false },
        { type: 'points', x: ns, y: ns.map((m) => derange[m] / fact(m)), color: (i) => (i + 1 === n ? 'tree' : 'model'), r: 4.5, tooltip: (i) => [['n', String(i + 1)], ['!n', num(derange[i + 1])], ['доля', f4(derange[i + 1] / fact(i + 1))]] },
      ]);
      const js = U.range(n + 1);
      const L = [
        { type: 'bars', x: js, y: js.map((j) => exactFixed(n, j)), color: 'model', width: 0.7, maxPx: 30, label: 'точно: C(n, j)·!(n − j)/n!', tooltip: (j) => [['совпадений', String(j)], ['вероятность', f4(exactFixed(n, j))], ['Пуассон(1)', f4(Math.exp(-1) / fact(j))]] },
        { type: 'points', x: js, y: js.map((j) => Math.exp(-1) / fact(j)), color: 'truth', r: 4, label: 'Пуассон со средним 1' },
      ];
      if (s.sim) L.push({ type: 'points', x: js, y: s.sim.cnt.map((c) => c / 2000), color: 'tree', r: 5, hollow: true, label: 'частота в 2000 раскладках' });
      p2.render(L, { x: [-0.6, n + 0.6], y: [0, Math.max(0.5, exactFixed(n, 0), exactFixed(n, 1)) * 1.15] });
      st.set('d', num(derange[n]));
      st.set('e', f2(fact(n) / Math.E));
      st.set('p', f4(derange[n] / fact(n)));
      st.set('m', s.sim ? f3(U.sum(s.sim.cnt.map((c, j) => c * j)) / 2000) + ' (точно 1)' : '1');
      note.innerHTML = 'Формула включений-исключений: перестановок, где письмо i на месте, (n − 1)!; где на месте и i, и j, — (n − 2)!, … Отсюда <b>!n = n!·(1 − 1/1! + 1/2! − … ± 1/n!)</b> — это обрывок ряда e<sup>−1</sup>, поэтому !n — ближайшее целое к n!/e. Другая дорога — рекуррентность !n = (n − 1)·(!(n − 1) + !(n − 2)). Неожиданное: доля беспорядков почти не зависит от n — при 10 письмах и при миллионе она ≈ 0.368. А <b>среднее число совпадений ровно 1</b> при любом n: каждое письмо попадает домой с вероятностью 1/n, а n слагаемых по 1/n дают 1 (линейность ожидания). Оранжевые рамки — письма в своих конвертах.';
    }
    w.pythonAction(() => PY_RNG + 'from math import comb, e, factorial\n\nn = ' + s.n + '\nd = [1, 0]\nfor m in range(2, n + 1):\n    d.append((m - 1) * (d[-1] + d[-2]))\nprint(f"!{n} = {d[n]}, n!/e = {factorial(n) / e:.3f}, доля = {d[n] / factorial(n):.5f}")\nprint("P(j совпадений):", [round(comb(n, j) * d[n - j] / factorial(n), 4) for j in range(n + 1)])\nrng = Mulberry32(' + Math.max(1, s.seed - 1) + ')\nfixed = [sum(v == i for i, v in enumerate(rng.permutation(n))) for _ in range(2000)]\nprint("моделирование: доля без совпадений", sum(f == 0 for f in fixed) / 2000, " среднее", sum(fixed) / 2000)\n');
    draw();
  });

  /* ==============================================================================
   * 26. Принцип Дирихле
   * ============================================================================== */
  GBC.widget('pigeonhole', (el) => {
    const s = { n: 13, m: 12, mode: 'rand', seed: 1 };
    const w = ui.shell(el, { title: 'Принцип Дирихле: где-то обязательно тесно', sub: 'n предметов раскладываем по m ящикам. Как ни раскладывай, в каком-то ящике окажется не меньше ⌈n/m⌉ предметов. Попробуйте «самую равномерную» раскладку — меньше не получится.' });
    ui.slider(w.controls, { label: 'Предметов n', min: 1, max: 40, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Ящиков m', min: 1, max: 12, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.segmented(w.controls, { label: 'Раскладка', value: s.mode, options: [{ value: 'rand', label: 'случайная' }, { value: 'even', label: 'самая равномерная' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.button(w.controls, { label: 'Разложить заново', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'ящик' }, y: { label: 'предметов в ящике' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'гарантия ⌈n/m⌉' }, { key: 'mx', label: 'максимум сейчас' }, { key: 'e', label: 'пустых ящиков' }]);
    function draw() {
      const { n, m } = s;
      const cnt = new Array(m).fill(0);
      if (s.mode === 'even') for (let i = 0; i < n; i++) cnt[i % m]++;
      else {
        const rng = new GBC.RNG(s.seed);
        for (let i = 0; i < n; i++) cnt[rng.randint(m)]++;
      }
      const g = Math.ceil(n / m);
      const mx = Math.max(...cnt);
      const xs = U.range(m, 1);
      plot.render([
        { type: 'bars', x: xs, y: cnt, color: (i) => (cnt[i] === mx ? 'tree' : 'model'), legendColor: 'model', label: 'предметов в ящике (оранжевые — максимум)', width: 0.7, maxPx: 34, tooltip: (i) => [['ящик', String(i + 1)], ['предметов', String(cnt[i])]] },
        { type: 'hline', y: g, color: 'ink2', dash: '5 4', width: 1.5, label: 'гарантия ⌈n/m⌉ = ' + g },
      ], { x: [0.4, m + 0.6], y: [0, Math.max(mx, g) + 1.2] });
      st.set('g', String(g));
      st.set('mx', String(mx));
      st.set('e', String(cnt.filter((c) => !c).length));
      note.innerHTML = 'Если бы во всех ящиках было меньше ⌈n/m⌉, то есть не больше ⌈n/m⌉ − 1, всего поместилось бы не больше m·(⌈n/m⌉ − 1) &lt; n предметов — противоречие. Принцип ничего не говорит, <em>в каком</em> ящике тесно, — только что такой есть. Примеры: из 13 людей двое родились в одном месяце; среди 5 целых чисел два дают одинаковый остаток при делении на 4. <b>В ML:</b> хеширование миллиона категорий в 2<sup>18</sup> = 262 144 корзин <em>обязательно</em> склеит категории (в среднем по 3.8 в корзине), а гистограмма из 256 корзин для 1000 разных значений обязательно объединит соседние. Случайная раскладка обычно намного хуже гарантии: сколько совпадений ждать, считает парадокс дней рождения (шаг 30).';
    }
    w.pythonAction(() => PY_RNG + 'from math import ceil\n\nn, m = ' + s.n + ', ' + s.m + '\nrng = Mulberry32(' + s.seed + ')\ncnt = [0] * m\nfor _ in range(n):\n    cnt[rng.randint(m)] += 1\nprint("раскладка:", cnt, " максимум:", max(cnt), " гарантия:", ceil(n / m))\n');
    draw();
  });

  /* ==============================================================================
   * 27. Рекуррентности: замощения полоски и числа Фибоначчи
   * ============================================================================== */
  GBC.widget('tilings', (el) => {
    const s = { n: 5 };
    const w = ui.shell(el, { title: 'Рекуррентность: замощения полоски 1 × n', sub: 'Полоску длины n выкладываем квадратами (длина 1) и доминошками (длина 2). Последняя плитка — квадрат или доминошка: T(n) = T(n − 1) + T(n − 2). Синие замощения кончаются квадратом, оранжевые — доминошкой.' });
    ui.slider(w.controls, { label: 'Длина n', min: 1, max: 9, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const host = H('div');
    w.main.appendChild(host);
    const plot = new GBC.Plot(w.main, { height: 200, x: { label: 'n', domain: [0.5, 30.5] }, y: { label: 'T(n) — замощений', type: 'log', domain: [1, 3e6], ticks: [1, 10, 100, 1e3, 1e4, 1e5, 1e6], format: (v) => (v < 1e4 ? String(v) : '10' + sup(Math.round(Math.log10(v)))) } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't', label: 'T(n)' }, { key: 'r', label: 'T(n − 1) + T(n − 2)' }, { key: 'q', label: 'T(n)/T(n − 1)' }]);
    function tilings(n) {
      if (n === 0) return [[]];
      if (n < 0) return [];
      return tilings(n - 1).map((t) => t.concat([1])).concat(tilings(n - 2).map((t) => t.concat([2])));
    }
    const T = [1, 1];
    for (let i = 2; i <= 31; i++) T.push(T[i - 1] + T[i - 2]);
    function draw() {
      const n = s.n;
      const all = tilings(n);
      host.textContent = '';
      const u = 30;
      const rowH = 26;
      const W = n * u + 20;
      const Hh = all.length * rowH + 10;
      const svg = svgBox(host, Math.max(W, 120), Hh, Math.min(Math.max(W, 120), 300), Math.max(W, 120) * 1.6);
      all.forEach((t, r) => {
        let x = 10;
        const endsSq = t[t.length - 1] === 1;
        t.forEach((len) => {
          svg.appendChild(S('rect', { x: x + 1, y: 5 + r * rowH + 1, width: len * u - 2, height: rowH - 6, rx: 4, style: 'fill:' + tint(endsSq ? 'var(--c-blue)' : 'var(--c-orange)', len === 2 ? 50 : 22) + ';stroke:' + (endsSq ? 'var(--c-blue)' : 'var(--c-orange)') + ';stroke-width:1.5' }));
          x += len * u;
        });
      });
      const ns = U.range(30, 1);
      plot.render([
        { type: 'line', x: ns, y: ns.map((m) => Math.pow((1 + Math.sqrt(5)) / 2, m + 1) / Math.sqrt(5)), color: 'truth', width: 2, dash: '6 4', label: 'φⁿ⁺¹/√5, φ ≈ 1.618', hover: false },
        { type: 'points', x: ns, y: ns.map((m) => T[m]), color: (i) => (i + 1 === n ? 'tree' : 'model'), r: 3.5, label: 'T(n)', tooltip: (i) => [['n', String(i + 1)], ['T(n)', num(T[i + 1])]] },
      ]);
      st.set('t', String(T[n]));
      st.set('r', n >= 2 ? T[n - 1] + ' + ' + T[n - 2] : '—');
      st.set('q', n >= 2 ? f4(T[n] / T[n - 1]) : '—');
      note.innerHTML = 'Замощение длины n кончается либо квадратом (перед ним — любое замощение длины n − 1), либо доминошкой (перед ней — замощение длины n − 2). Случаи не пересекаются — правило суммы: <b>T(n) = T(n − 1) + T(n − 2)</b>, T(0) = T(1) = 1. Это числа Фибоначчи: 1, 1, 2, 3, 5, 8, 13, … Та же рекуррентность считает лестницы (подняться на n ступенек шагами 1 и 2: для 10 ступенек — 89 способов) и двоичные строки без двух единиц подряд. Рост показательный: T(n) ≈ φ<sup>n+1</sup>/√5, где φ = (1 + √5)/2 — золотое сечение. <b>Приём на будущее:</b> не можете посчитать сразу — найдите, как ответ для n выражается через меньшие n, и считайте таблицей (динамическое программирование, как в путях по решётке, шаг 12).';
    }
    w.pythonAction(() => 'from functools import lru_cache\n\n@lru_cache(None)\ndef tilings(n):\n    """Все замощения полоски 1×n квадратами (1) и доминошками (2)."""\n    if n < 0:\n        return []\n    if n == 0:\n        return [()]\n    return [t + (1,) for t in tilings(n - 1)] + [t + (2,) for t in tilings(n - 2)]\n\nn = ' + s.n + '\nprint(len(tilings(n)), tilings(n)[:5])\nT = [1, 1]\nfor i in range(2, 31):\n    T.append(T[-1] + T[-2])\nprint("T(10) =", T[10], " T(30) =", T[30], " отношение:", T[30] / T[29])\n');
    draw();
  });

  /* ==============================================================================
   * 28. Числа Каталана: формы двоичных деревьев
   * ============================================================================== */
  function shapes(n) {
    if (n === 0) return [null];
    const out = [];
    for (let i = 0; i < n; i++) shapes(i).forEach((L) => shapes(n - 1 - i).forEach((R) => out.push({ L, R, li: i })));
    return out;
  }
  const catalan = (n) => comb(2 * n, n) / (n + 1);
  GBC.widget('catalan', (el) => {
    const s = { n: 3 };
    const w = ui.shell(el, { title: 'Числа Каталана: сколько форм у двоичного дерева', sub: 'Дерево решений с n разбиениями (внутренними узлами) имеет n + 1 лист. Сколько у него разных форм? Корень делит остальные n − 1 разбиений между левым и правым поддеревьями. Под каждой формой — та же структура в виде расстановки скобок.' });
    ui.slider(w.controls, { label: 'Разбиений n', min: 0, max: 5, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const host = H('div');
    const eq = texEl('', true, 'margin:4px 0');
    w.main.append(host, eq);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'форм Catₙ' }, { key: 'f', label: 'C(2n, n)/(n + 1)' }, { key: 'l', label: 'листьев' }]);
    function treeSvg(t, n) {
      const W = 22 * (n + 1) + 16;
      const depth = (u) => (u ? 1 + Math.max(depth(u.L), depth(u.R)) : 0);
      const Hh = depth(t) * 26 + 30;
      const svg = S('svg', { viewBox: '0 0 ' + W + ' ' + Hh, width: W, height: Hh, style: 'display:block;margin:0 auto' });
      let leaf = 0;
      const lay = (u, d) => {
        if (!u) {
          const x = 8 + 11 + 22 * leaf++;
          return { x, y: 12 + d * 26, leaf: true };
        }
        const a = lay(u.L, d + 1);
        const b = lay(u.R, d + 1);
        const me = { x: (a.x + b.x) / 2, y: 12 + d * 26 };
        [a, b].forEach((c) => svg.appendChild(S('line', { x1: me.x, y1: me.y, x2: c.x, y2: c.y, style: 'stroke:var(--border-strong);stroke-width:1.6' })));
        [a, b].forEach((c) => c.leaf && svg.appendChild(S('rect', { x: c.x - 5, y: c.y - 5, width: 10, height: 10, rx: 2, style: 'fill:' + tint('var(--c-aqua)', 50) + ';stroke:var(--c-aqua);stroke-width:1.4' })));
        svg.appendChild(S('circle', { cx: me.x, cy: me.y, r: 6, style: 'fill:' + tint('var(--c-blue)', 50) + ';stroke:var(--c-blue);stroke-width:1.6' }));
        return me;
      };
      if (t) lay(t, 0);
      else svg.appendChild(S('rect', { x: W / 2 - 5, y: 7, width: 10, height: 10, rx: 2, style: 'fill:' + tint('var(--c-aqua)', 50) + ';stroke:var(--c-aqua);stroke-width:1.4' }));
      return svg;
    }
    function brackets(t) {
      let i = 0;
      const rec = (u) => (u ? '(' + rec(u.L) + rec(u.R) + ')' : 'abcdefg'[i++]);
      const sres = rec(t);
      return t ? sres.slice(1, -1) : sres;
    }
    function draw() {
      const n = s.n;
      const all = shapes(n);
      host.textContent = '';
      const byLeft = new Map();
      all.forEach((t) => {
        const li = t ? t.li : 0;
        if (!byLeft.has(li)) byLeft.set(li, []);
        byLeft.get(li).push(t);
      });
      byLeft.forEach((arr, li) => {
        const c = card(n ? 'слева ' + li + ', справа ' + (n - 1 - li) + ' разбиений: Cat' + '₀₁₂₃₄₅'[li] + '·Cat' +'₀₁₂₃₄₅'[n - 1 - li] + ' = ' + arr.length : 'один лист');
        const r = flexRow('gap:10px;align-items:flex-end');
        arr.forEach((t) => r.appendChild(H('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:2px' }, treeSvg(t, n), H('span', { style: 'font-family:var(--font-mono);font-size:.72rem;color:var(--ink-2)' }, brackets(t)))));
        c.body.appendChild(r);
        c.el.style.marginBottom = '8px';
        host.appendChild(c.el);
      });
      texInto(eq, '\\begin{gathered}\\mathrm{Cat}_n = \\sum_{i=0}^{n-1} \\mathrm{Cat}_i\\,\\mathrm{Cat}_{n-1-i} = \\frac{1}{n+1}\\binom{2n}{n} \\\\ ' + U.range(9).map((i) => catalan(i)).join(',\\ ') + ',\\ \\ldots\\end{gathered}', true);
      st.set('c', String(all.length));
      st.set('f', 'C(' + 2 * n + ', ' + n + ')/' + (n + 1) + ' = ' + catalan(n));
      st.set('l', String(n + 1));
      note.innerHTML = 'Корень — первое разбиение; если в левом поддереве i разбиений, то в правом n − 1 − i, и формы поддеревьев выбираются независимо: правило произведения Cat<sub>i</sub>·Cat<sub>n−1−i</sub>, а по всем i — правило суммы. Это <b>числа Каталана</b>: 1, 1, 2, 5, 14, 42, 132, 429, … (Cat<sub>7</sub> = 429 форм у дерева с 8 листьями). Те же числа считают правильные расстановки скобок (подписи под деревьями), пути по решётке, не поднимающиеся над диагональю, и триангуляции многоугольника. Растут они примерно как 4<sup>n</sup>/(n<sup>3/2</sup>√π). <b>В бустинге</b> форма — только начало: каждому разбиению ещё нужен признак и порог, и число разных деревьев взрывается (шаг 34).';
    }
    w.pythonAction(() => 'from functools import lru_cache\nfrom math import comb\n\n@lru_cache(None)\ndef shapes(n):\n    """Формы двоичных деревьев с n внутренними узлами как строки скобок."""\n    if n == 0:\n        return ("x",)\n    return tuple(f"({L}{R})" for i in range(n) for L in shapes(i) for R in shapes(n - 1 - i))\n\nn = ' + s.n + '\nprint(len(shapes(n)), "=", comb(2 * n, n) // (n + 1), shapes(n)[:5])\nprint("Каталан:", [comb(2 * m, m) // (m + 1) for m in range(12)])\n');
    draw();
  });

  /* ==============================================================================
   * 29. Производящие функции: кубики и монеты
   * ============================================================================== */
  const polyMul = (a, b) => {
    const out = new Array(a.length + b.length - 1).fill(0);
    a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));
    return out;
  };
  GBC.widget('gen-func', (el) => {
    const COINS = { '125': [1, 2, 5], '1510': [1, 5, 10], '12510': [1, 2, 5, 10] };
    const s = { mode: 'dice', d: 3, f: 6, t: 10, coins: '125', S: 10 };
    const w = ui.shell(el, { title: 'Производящие функции: подсчёт умножением многочленов', sub: 'Кубик — многочлен x + x² + … + x⁶: показатель — очки, коэффициент — число способов. Перемножаем многочлены — коэффициент при xᵗ равен числу способов набрать сумму t. Для монет — ряды 1 + xᶜ + x²ᶜ + …' });
    ui.segmented(w.controls, { label: 'Задача', value: s.mode, options: [{ value: 'dice', label: 'кубики' }, { value: 'coins', label: 'размен монет' }], onChange: (v) => ((s.mode = v), sync(), draw()) });
    const cD = ui.slider(w.controls, { label: 'Кубиков d', min: 1, max: 5, step: 1, value: s.d, format: String, onInput: (v) => ((s.d = v), draw()) });
    const cF = ui.slider(w.controls, { label: 'Граней f', min: 2, max: 8, step: 1, value: s.f, format: String, onInput: (v) => ((s.f = v), draw()) });
    const cT = ui.slider(w.controls, { label: 'Сумма t', min: 1, max: 40, step: 1, value: s.t, format: String, onInput: (v) => ((s.t = v), draw()) });
    const cC = ui.select(w.controls, { label: 'Монеты', value: s.coins, options: [{ value: '125', label: '1, 2, 5' }, { value: '1510', label: '1, 5, 10' }, { value: '12510', label: '1, 2, 5, 10' }], onChange: (v) => ((s.coins = v), draw()) });
    const cS = ui.slider(w.controls, { label: 'Сумма S', min: 1, max: 50, step: 1, value: s.S, format: String, onInput: (v) => ((s.S = v), draw()) });
    const eq = texEl('', true, 'margin:4px 0');
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'показатель (сумма)' }, y: { label: 'коэффициент (способов)' } });
    w.main.insertBefore(eq, plot.root);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'коэффициент' }, { key: 'tot', label: 'всего' }, { key: 'p', label: 'вероятность' }]);
    function sync() {
      const dice = s.mode === 'dice';
      [cD, cF, cT].forEach((c) => (c.el.style.display = dice ? '' : 'none'));
      [cC, cS].forEach((c) => (c.el.style.display = dice ? 'none' : ''));
    }
    function draw() {
      if (s.mode === 'dice') {
        const die = [0].concat(new Array(s.f).fill(1));
        let P = [1];
        for (let i = 0; i < s.d; i++) P = polyMul(P, die);
        const t = Math.min(s.t, P.length - 1);
        const xs = U.range(P.length);
        plot.render([{ type: 'bars', x: xs, y: P, color: (i) => (i === t ? 'tree' : 'model'), width: 0.8, maxPx: 18, tooltip: (i) => [['сумма', String(i)], ['способов', num(P[i])], ['вероятность', f4(P[i] / Math.pow(s.f, s.d))]] }], { x: [s.d - 0.8, s.d * s.f + 0.8], y: [0, Math.max(...P) * 1.15] });
        texInto(eq, '(x + x^2 + \\dots + x^{' + s.f + '})^{' + s.d + '} = ' + xs.filter((i) => P[i]).slice(0, 5).map((i) => (P[i] === 1 ? '' : P[i]) + 'x^{' + i + '}').join(' + ') + (xs.filter((i) => P[i]).length > 5 ? ' + \\dots' : ''), true);
        st.set('c', 'при x^' + t + ': ' + num(P[t] || 0));
        st.set('tot', s.f + sup(s.d) + ' = ' + num(Math.pow(s.f, s.d)));
        st.set('p', f4((P[t] || 0) / Math.pow(s.f, s.d)));
        note.innerHTML = 'Почему это работает: раскрывая (x + … + x<sup>f</sup>)<sup>d</sup>, мы выбираем из каждой скобки-кубика одно слагаемое x<sup>очки</sup>, а показатели при умножении <b>складываются</b>. Значит, x<sup>t</sup> появится столько раз, сколько есть способов выбросить сумму t. Умножение многочленов — это свёртка коэффициентов (урок 15.13, сумма случайных величин). Классика: на трёх кубиках сумма 10 выпадает 27 способами, а 9 — 25, хотя у обеих по шесть неупорядоченных разложений, — вопрос, который Галилей разобрал для игроков (шаг 20 объясняет, почему разложения неравноценны).';
      } else {
        const coins = COINS[s.coins];
        const Smax = 50;
        let P = [1].concat(new Array(Smax).fill(0));
        coins.forEach((c) => {
          const q = new Array(Smax + 1).fill(0);
          for (let i = 0; i <= Smax; i += c) q[i] = 1;
          P = polyMul(P, q).slice(0, Smax + 1);
        });
        const xs = U.range(Smax + 1);
        plot.render([{ type: 'bars', x: xs, y: P, color: (i) => (i === s.S ? 'tree' : 'model'), width: 0.8, maxPx: 12, tooltip: (i) => [['сумма', String(i)], ['способов', num(P[i])]] }], { x: [-0.8, Smax + 0.8], y: [0, Math.max(...P) * 1.12] });
        texInto(eq, coins.map((c) => '(1 + x^{' + c + '} + x^{' + 2 * c + '} + \\dots)').join('') + ' = ' + coins.map((c) => '\\frac{1}{1 - x^{' + c + '}}').join(''), true);
        st.set('c', 'при x^' + s.S + ': ' + num(P[s.S]));
        st.set('tot', '—');
        st.set('p', '—');
        note.innerHTML = 'Монету достоинства c можно взять 0, 1, 2, … раз — сомножитель 1 + x<sup>c</sup> + x<sup>2c</sup> + … = 1/(1 − x<sup>c</sup>) (геометрический ряд, урок 15.10). Коэффициент при x<sup>S</sup> в произведении — число способов разменять S. Монетами 1, 2, 5 сумму 10 можно набрать 10 способами. Производящая функция превращает задачу подсчёта в алгебру: числа Фибоначчи, Каталана и разбиения числа (шаг 22) тоже получают из своих производящих функций. Вычислительно это та же динамика по таблице, что и в шаге 26.';
      }
    }
    w.pythonAction(() => (s.mode === 'dice'
      ? 'import numpy as np\n\nd, f, t = ' + s.d + ', ' + s.f + ', ' + s.t + '\ndie = np.array([0] + [1] * f)\nP = np.array([1])\nfor _ in range(d):\n    P = np.convolve(P, die)\nprint("способов набрать", t, ":", P[t] if t < len(P) else 0, " вероятность:", (P[t] if t < len(P) else 0) / f**d)\nprint("коэффициенты:", P.tolist())\n'
      : 'import numpy as np\n\ncoins, S = (' + COINS[s.coins].join(', ') + '), ' + s.S + '\nP = np.zeros(S + 1, dtype=int); P[0] = 1\nfor c in coins:\n    q = np.zeros(S + 1, dtype=int); q[::c] = 1\n    P = np.convolve(P, q)[:S + 1]\nprint("способов разменять", S, ":", P[S])\n'));
    sync();
    draw();
  });

  /* ==============================================================================
   * 30. Классическая вероятность: гипергеометрическое распределение
   * ============================================================================== */
  GBC.widget('hypergeom', (el) => {
    const PRE = { fold: { N: 1000, K: 50, n: 100, t: 2 }, lotto: { N: 45, K: 6, n: 6, t: 3 }, small: { N: 20, K: 8, n: 5, t: 1 } };
    const s = Object.assign({ pre: 'fold' }, PRE.fold);
    const w = ui.shell(el, { title: 'Выборка без возвращения: гипергеометрическое распределение', sub: 'В совокупности N объектов, из них K «особых» (положительный класс, выигрышные номера). Берём n без возвращения. Вероятность получить ровно x особых — число благоприятных выборок, делённое на число всех: C(K, x)·C(N − K, n − x)/C(N, n).' });
    let sliders = [];
    ui.select(w.controls, { label: 'Пример', value: s.pre, options: [{ value: 'fold', label: 'фолд 100 из 1000 (50 положительных)' }, { value: 'lotto', label: 'лотерея 6 из 45' }, { value: 'small', label: 'урна: 20 шаров, 8 белых' }], onChange: (v) => (Object.assign(s, PRE[v], { pre: v }), sliders.forEach((c, i) => c.set(s[['N', 'K', 'n', 't'][i]])), draw()) });
    sliders = [
      ui.slider(w.controls, { label: 'Всего N', values: [10, 20, 45, 50, 100, 200, 500, 1000, 5000], value: s.N, format: String, onInput: (v) => ((s.N = v), draw()) }),
      ui.slider(w.controls, { label: 'Особых K', min: 0, max: 200, step: 1, value: s.K, format: String, onInput: (v) => ((s.K = v), draw()) }),
      ui.slider(w.controls, { label: 'Берём n', min: 1, max: 200, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) }),
      ui.slider(w.controls, { label: 'Порог t: P(X ≤ t)', min: 0, max: 30, step: 1, value: s.t, format: String, onInput: (v) => ((s.t = v), draw()) }),
    ];
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'x — особых в выборке' }, y: { label: 'вероятность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'all', label: 'выборок C(N, n)' }, { key: 'm', label: 'среднее nK/N' }, { key: 'sd', label: 'ст. откл. (с поправкой / без)' }, { key: 'le', label: 'P(X ≤ t): гипергеом. / бином.' }]);
    function draw() {
      const N = s.N;
      const K = Math.min(s.K, N);
      const n = Math.min(s.n, N);
      const t = s.t;
      const lo = Math.max(0, n - (N - K));
      const hi = Math.min(n, K);
      const xs = U.range(hi + 1);
      const hyp = xs.map((x) => (x < lo ? 0 : Math.exp(lnC(K, x) + lnC(N - K, n - x) - lnC(N, n))));
      const p = K / N;
      const bin = xs.map((x) => Math.exp(lnC(n, x) + (x ? x * Math.log(p) : 0) + (n - x ? (n - x) * Math.log(1 - p) : 0)));
      const show = xs.filter((x) => hyp[x] > 1e-4 || bin[x] > 1e-4 || x <= t);
      const xmax = Math.max(t + 1, show.length ? show[show.length - 1] + 1 : 1);
      const xv = xs.slice(0, xmax + 1);
      plot.render([
        { type: 'bars', x: xv, y: xv.map((x) => hyp[x]), color: (i) => (i <= t ? 'tree' : 'model'), width: 0.75, maxPx: 22, label: 'без возвращения (гипергеометрическое)', tooltip: (i) => [['x', String(i)], ['гипергеом.', f4(hyp[i])], ['биномиальное', f4(bin[i])]] },
        { type: 'points', x: xv, y: xv.map((x) => bin[x] || 0), color: 'ink2', r: 3.5, hollow: true, label: 'с возвращением (биномиальное)' },
      ], { x: [-0.6, xmax + 0.6], y: [0, Math.max(...hyp, ...bin.filter(Number.isFinite)) * 1.15] });
      const cdf = (arr) => U.sum(arr.slice(0, Math.min(t, arr.length - 1) + 1));
      const mean = (n * K) / N;
      const sdB = Math.sqrt(n * p * (1 - p));
      const sdH = sdB * Math.sqrt(N > 1 ? (N - n) / (N - 1) : 0);
      const l10 = lnC(N, n) / Math.LN10;
      st.set('all', l10 < 15 ? num(Math.round(Math.exp(lnC(N, n)))) : numLog10(l10));
      st.set('m', f2(mean));
      st.set('sd', f3(sdH) + ' / ' + f3(sdB));
      st.set('le', f4(cdf(hyp)) + ' / ' + f4(cdf(bin)));
      const lotto = N === 45 && K === 6 && n === 6;
      note.innerHTML = '<b>Почему это классическая вероятность.</b> Все C(N, n) выборок равновероятны; благоприятные — те, где из K особых взяты x (C(K, x) способов), а остальные n − x — из N − K обычных. Без возвращения разброс меньше, чем у биномиального (с возвращением), на множитель √((N − n)/(N − 1)) — <em>поправка на конечность совокупности</em>: сейчас ' + f3(sdH) + ' против ' + f3(sdB) + '. ' + (lotto
        ? 'В лотерее 6 из 45 угадать все шесть — 1 шанс из 8 145 060, ровно три — 0.0224, ни одного — 0.40.'
        : '<b>В ML:</b> случайный фолд из ' + n + ' объектов при ' + K + ' положительных из ' + N + ' в среднем содержит ' + f2(mean) + ' положительных, но с вероятностью ' + pct(cdf(hyp), 1) + ' — не больше ' + t + '. На таких фолдах метрики (AUC, precision) прыгают; поэтому для редких классов используют <b>стратифицированную</b> кросс-валидацию: она раскладывает положительные по фолдам поровну.');
    }
    w.pythonAction(() => 'from scipy.stats import binom, hypergeom\nfrom math import comb\n\nN, K, n, t = ' + s.N + ', ' + Math.min(s.K, s.N) + ', ' + Math.min(s.n, s.N) + ', ' + s.t + '\nx = 2\nprint("P(X = 2) вручную:", comb(K, x) * comb(N - K, n - x) / comb(N, n), " scipy:", hypergeom(N, K, n).pmf(x))\nprint("P(X <= t): без возвращения", hypergeom(N, K, n).cdf(t), " с возвращением", binom(n, K / N).cdf(t))\nprint("ст. откл.:", hypergeom(N, K, n).std(), binom(n, K / N).std())\n');
    draw();
  });

  /* ==============================================================================
   * 31. Парадокс дней рождения
   * ============================================================================== */
  const pDistinct = (n, D) => {
    let p = 1;
    for (let i = 0; i < n; i++) p *= (D - i) / D;
    return p;
  };
  function simBirthday(n, D, groups, seed) {
    const rng = new GBC.RNG(seed);
    let hits = 0;
    for (let g = 0; g < groups; g++) {
      const seen = new Set();
      for (let i = 0; i < n; i++) {
        const d = rng.randint(D);
        if (seen.has(d)) {
          hits++;
          break;
        }
        seen.add(d);
      }
    }
    return hits / groups;
  }
  GBC.widget('birthday', (el) => {
    const s = { D: 365, n: 23, sims: [] };
    const w = ui.shell(el, { title: 'Парадокс дней рождения и коллизии хешей', sub: 'n человек, D равновероятных дней (или корзин хеш-функции). Какова вероятность, что у кого-то значения совпадут? Точно — через размещения, приближённо — через число пар; кнопка моделирует 1000 случайных групп.' });
    const nMax = () => Math.ceil(4.2 * Math.sqrt(s.D));
    ui.slider(w.controls, { label: 'Значений D', values: [365, 1000, 10000, 1000000], value: s.D, format: num, onInput: (v) => ((s.D = v), cn.setMax(nMax()), cn.set(Math.round(1.1774 * Math.sqrt(v))), (s.n = Math.round(1.1774 * Math.sqrt(v))), (s.sims = []), draw()) });
    const cn = ui.slider(w.controls, { label: 'Человек (ключей) n', min: 1, max: nMax(), step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Смоделировать', icon: 'play', kind: 'primary', onClick: () => (s.sims.push({ n: s.n, f: simBirthday(s.n, s.D, 1000, s.sims.length + 1) }), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'n' }, y: { label: 'P(есть совпадение)', domain: [0, 1.02] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pairs', label: 'пар C(n, 2)' }, { key: 'p', label: 'P точно' }, { key: 'a', label: '1 − e^(−C(n,2)/D)' }, { key: 'e', label: 'ожидаемо совпавших пар' }, { key: 'sim', label: 'моделирование' }]);
    function draw() {
      const { D, n } = s;
      const M = nMax();
      const ns = U.range(Math.min(M, 400), 1).map((i) => Math.round((i * M) / Math.min(M, 400)));
      const exact = (m) => 1 - pDistinct(m, D);
      const appr = (m) => 1 - Math.exp(-(m * (m - 1)) / (2 * D));
      const L = [
        { type: 'hline', y: 0.5, color: 'ink2', dash: '4 4', width: 1, text: '½' },
        { type: 'line', x: ns, y: ns.map(exact), color: 'model', width: 2.4, label: 'точно: 1 − A(D, n)/Dⁿ', hover: false },
        { type: 'line', x: ns, y: ns.map(appr), color: 'tree', width: 1.6, dash: '6 4', label: 'приближение 1 − exp(−n(n − 1)/(2D))', hover: false },
        { type: 'points', x: [n], y: [exact(n)], color: 'model', r: 6, tooltip: () => [['n', String(n)], ['P', f4(exact(n))]] },
      ];
      const sims = s.sims;
      if (sims.length) L.push({ type: 'points', x: sims.map((q) => q.n), y: sims.map((q) => q.f), color: 'aqua', r: 5, hollow: true, label: 'моделирование, 1000 групп', tooltip: (i) => [['n', String(sims[i].n)], ['частота', f3(sims[i].f)]] });
      plot.render(L, { x: [0, M] });
      const last = sims.filter((q) => q.n === n).pop();
      st.set('pairs', num(comb(n, 2)));
      st.set('p', f4(exact(n)));
      st.set('a', f4(appr(n)));
      st.set('e', f3(comb(n, 2) / D));
      st.set('sim', last ? f3(last.f) : '—');
      note.innerHTML = 'Считаем дополнение «все разные»: первому — любое из D значений, второму — D − 1, … — это размещения A(D, n) из D<sup>n</sup> равновероятных последовательностей. Приближение: каждая из C(n, 2) пар совпадает с вероятностью 1/D, пар много и они «почти независимы», поэтому P(без совпадений) ≈ (1 − 1/D)<sup>C(n,2)</sup> ≈ e<sup>−n(n−1)/(2D)</sup>. Половина достигается при n ≈ 1.18·√D: для D = 365 это 23 человека (точно 0.507), для D = 10<sup>6</sup> — около 1178. <b>В ML:</b> хеширование категорий (hashing trick) в D корзин начинает склеивать категории уже при √D из них, а не при D; ожидаемое число совпавших пар — C(n, 2)/D (сейчас ' + f3(comb(n, 2) / D) + '). Для 32-битного хеша (D ≈ 4.3·10<sup>9</sup>) шанс коллизии 50 % уже при ≈ 77 000 ключей.';
    }
    w.pythonAction(() => PY_RNG + 'from math import comb, exp, perm\n\nD, n = ' + s.D + ', ' + s.n + '\nexact = 1 - perm(D, n) / D**n\nprint(f"пар {comb(n, 2)}, P точно {exact:.4f}, приближённо {1 - exp(-n * (n - 1) / (2 * D)):.4f}")\nrng = Mulberry32(1)\nhits = 0\nfor _ in range(1000):\n    seen = set()\n    for _ in range(n):\n        d = rng.randint(D)\n        if d in seen:\n            hits += 1\n            break\n        seen.add(d)\nprint("моделирование:", hits / 1000)\n');
    draw();
  });

  /* ==============================================================================
   * 32. Бутстрэп: доля объектов вне выборки и распределение повторов
   * ============================================================================== */
  GBC.widget('bootstrap-oob', (el) => {
    const NS = [2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];
    const s = { n: 20, seed: 1 };
    const w = ui.shell(el, { title: 'Бутстрэп: сколько объектов остаётся «за бортом»', sub: 'Выбираем n раз с возвращением из n объектов. Объект не попадает ни разу с вероятностью (1 − 1/n)ⁿ → 1/e ≈ 0.368. А сколько раз он попадает — распределено почти по Пуассону со средним 1.' });
    ui.slider(w.controls, { label: 'Объектов n', values: NS, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Новая выборка', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'n (логарифмическая шкала)', type: 'log', domain: [1.6, 1300], ticks: [2, 5, 10, 20, 50, 100, 200, 500, 1000] }, y: { label: 'доля вне выборки', domain: [0.22, 0.4] } });
    const sample = new GBC.Plot(w.main, { height: 160, x: { label: 'объект' }, y: { label: 'раз в выборке' } });
    const pois = new GBC.Plot(w.main, { height: 180, x: { label: 'сколько раз объект попал в выборку', domain: [-0.6, 6.6], ticks: [0, 1, 2, 3, 4, 5, 6] }, y: { label: 'доля объектов' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: '(1 − 1/n)ⁿ' }, { key: 'this', label: 'в этой выборке' }, { key: 'u', label: 'различных выборок C(2n − 1, n)' }]);
    const sim = NS.map((n) => {
      const rng = new GBC.RNG(7);
      let out = 0;
      for (let r = 0; r < 200; r++) {
        const used = new Uint8Array(n);
        rng.bootstrap(n).forEach((i) => (used[i] = 1));
        out += n - U.sum(Array.from(used));
      }
      return out / (200 * n);
    });
    const xs = U.linspace(Math.log(2), Math.log(1000), 150).map(Math.exp);
    function draw() {
      const n = s.n;
      const f = Math.pow(1 - 1 / n, n);
      plot.render([
        { type: 'hline', y: 1 / Math.E, color: 'ink2', dash: '4 4', width: 1, text: '1/e ≈ 0.368' },
        { type: 'line', x: xs, y: xs.map((x) => Math.pow(1 - 1 / x, x)), color: 'model', width: 2, label: '(1 − 1/n)ⁿ', hover: false },
        { type: 'points', x: NS, y: sim, color: 'tree', r: 4.5, hollow: true, label: 'моделирование, 200 выборок', tooltip: (i) => [['n', String(NS[i])], ['доля вне', f4(sim[i])]] },
        { type: 'points', x: [n], y: [f], color: 'model', r: 6 },
      ]);
      const cnt = new Array(n).fill(0);
      new GBC.RNG(s.seed).bootstrap(n).forEach((i) => cnt[i]++);
      const zeros = U.range(n).filter((i) => cnt[i] === 0);
      if (n <= 100) {
        sample.root.style.display = '';
        const idx = U.range(n, 1);
        sample.render([
          { type: 'bars', x: idx, y: cnt, color: 'model', width: 0.8, maxPx: 22, label: 'в выборке' },
          { type: 'points', x: zeros.map((i) => i + 1), y: zeros.map(() => 0), color: 'tree', r: n > 50 ? 3 : 4.5, label: 'не попал (OOB)' },
        ], { x: [0.4, n + 0.6], y: [0, Math.max(...cnt) + 0.6] });
      } else sample.root.style.display = 'none';
      const ks = U.range(7);
      const freq = ks.map((k) => cnt.filter((c) => c === k).length / n);
      const exact = ks.map((k) => Math.exp(lnC(n, k) + k * Math.log(1 / n) + (n - k) * Math.log(1 - 1 / n)));
      pois.render([
        { type: 'bars', x: ks, y: freq, color: 'model', width: 0.7, maxPx: 34, label: 'в этой выборке', tooltip: (k) => [['раз', String(k)], ['доля', f3(freq[k])], ['биномиальное', f4(exact[k])], ['Пуассон(1)', f4(Math.exp(-1) / fact(k))]] },
        { type: 'points', x: ks, y: exact, color: 'tree', r: 4.5, label: 'точно: биномиальное(n, 1/n)' },
        { type: 'points', x: ks, y: ks.map((k) => Math.exp(-1) / fact(k)), color: 'ink2', r: 3, hollow: true, label: 'Пуассон со средним 1' },
      ], { y: [0, 0.6] });
      st.set('f', f4(f));
      st.set('this', zeros.length + ' из ' + n + ' = ' + f3(zeros.length / n));
      st.set('u', fmtB(combB(2 * n - 1, n)) + ' из ' + (n <= 12 ? num(Math.pow(n, n)) : numLog10(n * Math.log10(n))));
      note.innerHTML = 'Один выбор промахивается мимо конкретного объекта с вероятностью 1 − 1/n; n независимых выборов — правило произведения: (1 − 1/n)<sup>n</sup>. Это замечательный предел (урок 15.3): при n = 10 — 0.349, при n = 100 — 0.366, в пределе 1/e. Каждое дерево бэггинга (урок 3.1) не видит около 36.8 % объектов — на них считают <b>OOB-оценку</b>. Число попаданий объекта — сумма n выборов с вероятностью 1/n: биномиальное, а при больших n — Пуассон(1): 0 раз — 36.8 %, 1 раз — 36.8 %, 2 раза — 18.4 %, 3 и больше — 8.0 %. Значит, бутстрэп — это примерно «каждому объекту случайный вес Пуассон(1)»; на этом держится быстрый «пуассоновский бутстрэп» для потоков данных.' + (n > 100 ? ' Средний график показан при n ≤ 100.' : '');
    }
    w.pythonAction(() => PY_RNG + 'from collections import Counter\nfrom math import comb, exp, factorial\n\nn = ' + s.n + '\nidx = Mulberry32(' + s.seed + ').bootstrap(n)\nc = Counter(idx)\nhist = Counter(c.get(i, 0) for i in range(n))\nprint(f"не попали: {hist[0]} из {n}; формула: {(1 - 1 / n) ** n:.4f}")\nprint("доли повторов:", {k: round(hist[k] / n, 3) for k in sorted(hist)})\nprint("Пуассон(1):", [round(exp(-1) / factorial(k), 3) for k in range(5)], " различных выборок:", comb(2 * n - 1, n))\n');
    draw();
  });

  /* ==============================================================================
   * 33. Собиратель купонов
   * ============================================================================== */
  GBC.widget('coupon', (el) => {
    const s = { n: 50, seed: 1 };
    const w = ui.shell(el, { title: 'Собиратель купонов: сколько выборов, чтобы увидеть всех', sub: 'Выбираем объекты по одному с возвращением. Сколько выборов нужно, чтобы каждый из n объектов встретился хотя бы раз? В среднем n·Hₙ = n·(1 + 1/2 + … + 1/n) ≈ n·ln n — заметно больше n.' });
    ui.slider(w.controls, { label: 'Объектов n', values: [5, 10, 20, 50, 100, 365, 1000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Новый опыт', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'выборов t, в долях n' }, y: { label: 'доля уже встреченных', domain: [0, 1.04] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'в среднем n·Hₙ' }, { key: 'ln', label: 'n·ln n + 0.577·n' }, { key: 'T', label: 'в этом опыте' }, { key: 'half', label: 'на последнюю половину' }]);
    const Hn = (n) => U.sum(U.range(n, 1).map((i) => 1 / i));
    function draw() {
      const n = s.n;
      const rng = new GBC.RNG(s.seed);
      const seen = new Uint8Array(n);
      let got = 0;
      let t = 0;
      const tx = [0];
      const ty = [0];
      let halfAt = 0;
      while (got < n && t < 100 * n) {
        const i = rng.randint(n);
        t++;
        if (!seen[i]) {
          seen[i] = 1;
          got++;
          tx.push(t / n);
          ty.push(got / n);
          if (got === Math.ceil(n / 2)) halfAt = t;
        }
      }
      const E = n * Hn(n);
      const tmax = Math.max(t, E) / n * 1.08;
      const gx = U.linspace(0, tmax, 200);
      plot.render([
        { type: 'line', x: gx, y: gx.map((x) => 1 - Math.pow(1 - 1 / n, x * n)), color: 'truth', width: 2, dash: '6 4', label: 'ожидаемая доля 1 − (1 − 1/n)ᵗ', hover: false },
        { type: 'steps', segments: tx.map((x, i) => ({ x0: x, x1: i + 1 < tx.length ? tx[i + 1] : tmax, value: ty[i] })), color: 'model', width: 2, label: 'этот опыт', hover: false },
        { type: 'vline', x: E / n, color: 'tree', width: 1.6, dash: '4 4', label: 'среднее n·Hₙ' },
        { type: 'vline', x: 1, color: 'ink2', width: 1, dash: '2 3' },
      ], { x: [0, tmax] });
      st.set('e', f2(E));
      st.set('ln', f2(n * Math.log(n) + 0.5772 * n));
      st.set('T', String(t));
      st.set('half', String(t - halfAt));
      note.innerHTML = 'Когда уже встречено i объектов, новый попадается с вероятностью (n − i)/n, и ждать его в среднем n/(n − i) выборов. Складываем: n/n + n/(n − 1) + … + n/1 = <b>n·H<sub>n</sub></b>. Для n = 100 это 519 выборов; после n выборов (пунктир на t = n) встречено лишь около 63 % — снова 1 − 1/e. Больше всего времени уходит на последние объекты: в этом опыте на вторую половину ушло ' + (t - halfAt) + ' из ' + t + ' выборов. <b>В ML:</b> чтобы каждый объект хоть раз побывал вне бутстрэп-выборки (и получил OOB-прогноз), деревьев нужно порядка ln n / ln(1/0.632): для 10 000 объектов — около 20 деревьев, при меньшем лесе у некоторых объектов OOB-прогноза просто нет.';
    }
    w.pythonAction(() => PY_RNG + 'n = ' + s.n + '\nH = sum(1 / i for i in range(1, n + 1))\nrng = Mulberry32(' + s.seed + ')\nseen, t = set(), 0\nwhile len(seen) < n:\n    seen.add(rng.randint(n)); t += 1\nprint(f"в этом опыте {t} выборов; в среднем n*H_n = {n * H:.1f}")\nruns = []\nfor seed in range(200):\n    r, seen, t = Mulberry32(seed + 100), set(), 0\n    while len(seen) < n:\n        seen.add(r.randint(n)); t += 1\n    runs.append(t)\nprint("среднее по 200 опытам:", sum(runs) / 200)\n');
    draw();
  });

  /* ==============================================================================
   * 34. Перестановочный тест: все перемаркировки групп
   * ============================================================================== */
  GBC.widget('perm-test', (el) => {
    const s = { n1: 5, n2: 5, shift: 1, seed: 3, R: 200 };
    const w = ui.shell(el, { title: 'Перестановочный тест: перебор всех перемаркировок', sub: 'Две группы значений. Если различий нет, метки групп случайны: любая из C(n₁ + n₂, n₁) раздач меток равновероятна. p-значение — доля раздач, где разность средних не меньше наблюдаемой.' });
    ui.slider(w.controls, { label: 'В группе 1 (n₁)', min: 2, max: 7, step: 1, value: s.n1, format: String, onInput: (v) => ((s.n1 = v), draw()) });
    ui.slider(w.controls, { label: 'В группе 2 (n₂)', min: 2, max: 7, step: 1, value: s.n2, format: String, onInput: (v) => ((s.n2 = v), draw()) });
    ui.slider(w.controls, { label: 'Истинный сдвиг группы 2', min: 0, max: 2, step: 0.25, value: s.shift, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.shift = v), draw()) });
    ui.slider(w.controls, { label: 'Случайных перестановок (Монте-Карло)', values: [20, 50, 100, 200, 500, 1000], value: s.R, format: String, onInput: (v) => ((s.R = v), draw()) });
    ui.button(w.controls, { label: 'Новые данные', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const dataEl = monoBox('font-size:.82rem');
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'разность средних (группа 2 − группа 1) при перемаркировке' }, y: { label: 'доля перемаркировок' } });
    w.main.insertBefore(dataEl, plot.root);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'all', label: 'перемаркировок' }, { key: 'obs', label: 'наблюдаемая разность' }, { key: 'p', label: 'p точно' }, { key: 'mc', label: 'p Монте-Карло' }]);
    function draw() {
      const { n1, n2 } = s;
      const rng = new GBC.RNG(s.seed);
      const a = U.range(n1).map(() => Math.round(rng.normal(0, 1) * 100) / 100);
      const b = U.range(n2).map(() => Math.round(rng.normal(s.shift, 1) * 100) / 100);
      const all = a.concat(b);
      const N = n1 + n2;
      const tot = U.sum(all);
      const diff = (idx1) => {
        const s1 = U.sum(idx1.map((i) => all[i]));
        return (tot - s1) / n2 - s1 / n1;
      };
      const obs = U.sum(b) / n2 - U.sum(a) / n1;
      const ds = combos(N, n1).map(diff);
      const eps = 1e-9;
      const pEx = ds.filter((d) => Math.abs(d) >= Math.abs(obs) - eps).length / ds.length;
      const mrng = new GBC.RNG(1000 + s.seed);
      let hit = 0;
      for (let r = 0; r < s.R; r++) {
        const p = mrng.permutation(N);
        if (Math.abs(diff(p.slice(0, n1))) >= Math.abs(obs) - eps) hit++;
      }
      const pMC = (hit + 1) / (s.R + 1);
      const [lo, hi] = U.extent(ds);
      const nb = 24;
      const bw = (hi - lo) / nb || 1;
      const hist = new Array(nb).fill(0);
      ds.forEach((d) => (hist[Math.min(nb - 1, Math.floor((d - lo) / bw))] += 1 / ds.length));
      const cx = hist.map((_, i) => lo + (i + 0.5) * bw);
      plot.render([
        { type: 'bars', x: cx, y: hist, color: (i) => (Math.abs(cx[i]) >= Math.abs(obs) - bw / 2 ? 'tree' : 'model'), width: bw * 0.92, maxPx: 40, tooltip: (i) => [['разность', f2(cx[i])], ['доля', f3(hist[i])]] },
        { type: 'vline', x: obs, color: 'critical', width: 2, label: 'наблюдаемая' },
        { type: 'vline', x: -obs, color: 'critical', width: 1.2, dash: '4 4' },
      ], { y: [0, Math.max(...hist) * 1.15] });
      dataEl.textContent = 'группа 1: ' + a.map((v) => U.fmt(v, 2)).join('  ') + '\nгруппа 2: ' + b.map((v) => U.fmt(v, 2)).join('  ');
      st.set('all', 'C(' + N + ', ' + n1 + ') = ' + ds.length);
      st.set('obs', f3(obs));
      st.set('p', f4(pEx));
      st.set('mc', f4(pMC));
      note.innerHTML = 'Нулевая гипотеза «группы не различаются» означает: значения те же, а метки разданы случайно. Перебираем <b>все C(' + N + ', ' + n1 + ') = ' + ds.length + ' способов</b> выбрать, какие ' + n1 + ' значений назвать «группой 1», и смотрим, как часто разность средних по модулю не меньше наблюдаемой — это точное p-значение (оранжевые столбики). Комбинаторика ограничивает точный тест: при 20 + 20 объектах перемаркировок C(40, 20) ≈ 1.4·10<sup>11</sup>, поэтому берут R случайных перестановок и оценку (b + 1)/(R + 1). Тот же приём — в важности признаков перестановкой (урок 12.1): перемешиваем столбец и смотрим, насколько упало качество. Подробно о тестах — урок 15.14.';
    }
    w.pythonAction(() => PY_RNG + 'from itertools import combinations\n\nrng = Mulberry32(' + s.seed + ')\na = [round(rng.normal(0, 1) * 100) / 100 for _ in range(' + s.n1 + ')]\nb = [round(rng.normal(' + py(s.shift) + ', 1) * 100) / 100 for _ in range(' + s.n2 + ')]\nx, n1, n2 = a + b, len(a), len(b)\nobs = sum(b) / n2 - sum(a) / n1\ndiffs = [(sum(x) - sum(x[i] for i in S)) / n2 - sum(x[i] for i in S) / n1 for S in combinations(range(n1 + n2), n1)]\np = sum(abs(d) >= abs(obs) - 1e-9 for d in diffs) / len(diffs)\nprint(f"перемаркировок {len(diffs)}, разность {obs:.3f}, точное p = {p:.4f}")\nfrom scipy.stats import permutation_test\nres = permutation_test((b, a), lambda u, v: abs(sum(u) / len(u) - sum(v) / len(v)), permutation_type="independent", alternative="greater", n_resamples=10**6)\nprint("scipy, та же статистика |разность| (перебирает все раздачи):", round(res.pvalue, 4))\n');
    draw();
  });

  /* ==============================================================================
   * 35. Разбиения категорий: 2ᵏ⁻¹ − 1 против k − 1
   * ============================================================================== */
  GBC.widget('category-splits', (el) => {
    const s = { k: 6, seed: 3 };
    const w = ui.shell(el, { title: 'Разбиения категорий: 2ᵏ⁻¹ − 1 против k − 1', sub: 'Категориальный признак с k значениями. Дерево делит категории на две непустые группы. Точки — все разбиения, отсортированные по выигрышу; оранжевые — k − 1 «префиксов» порядка категорий по среднему ответу.' });
    ui.slider(w.controls, { label: 'Категорий k', min: 2, max: 12, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.button(w.controls, { label: 'Новые данные', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'место разбиения по выигрышу' }, y: { label: 'выигрыш (снижение суммы квадратов)' } });
    const best = monoBox();
    w.main.appendChild(best);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'all', label: 'всех разбиений' }, { key: 'pre', label: 'префиксов' }, { key: 'ok', label: 'лучшее — префикс?' }]);
    const data = () => {
      const rng = new GBC.RNG(s.seed);
      const cats = [];
      for (let i = 0; i < s.k; i++) {
        const n = 5 + rng.randint(26);
        cats.push({ name: LET[i], n, m: rng.normal(0, 1) });
      }
      return cats;
    };
    const gain = (cats, mask) => {
      let nL = 0;
      let sL = 0;
      let nR = 0;
      let sR = 0;
      cats.forEach((c, i) => {
        if ((mask >> i) & 1) (nL += c.n), (sL += c.n * c.m);
        else (nR += c.n), (sR += c.n * c.m);
      });
      return ((nL * nR) / (nL + nR)) * Math.pow(sL / nL - sR / nR, 2);
    };
    function draw() {
      const cats = data();
      const k = s.k;
      const full = (1 << k) - 1;
      const order = U.range(k).sort((a, b) => cats[a].m - cats[b].m);
      const prefix = new Set();
      let acc = 0;
      for (let i = 0; i < k - 1; i++) {
        acc |= 1 << order[i];
        prefix.add(acc & 1 ? acc : full ^ acc);
      }
      const splits = [];
      for (let m = 1; m < full; m++) if (m & 1) splits.push({ m, g: gain(cats, m) });
      splits.sort((a, b) => b.g - a.g);
      const oth = { x: [], y: [] };
      const pre = { x: [], y: [] };
      splits.forEach((sp, i) => {
        const t = prefix.has(sp.m) ? pre : oth;
        t.x.push(i + 1);
        t.y.push(sp.g);
      });
      plot.render([
        { type: 'points', ...oth, color: 'muted', r: splits.length > 200 ? 2 : 3.5, label: 'остальные разбиения' },
        { type: 'points', ...pre, color: 'tree', r: 5, label: 'префиксы порядка по среднему' },
      ], { x: [0.5, splits.length + 0.5] });
      const b = splits[0].m;
      const grp = (inLeft) => '{' + U.range(k).filter((i) => !!((b >> i) & 1) === inLeft).map((i) => LET[i]).join(', ') + '}';
      best.textContent = 'Лучшее: ' + grp(true) + ' | ' + grp(false) + '; порядок по среднему: ' + order.map((i) => LET[i]).join(' < ');
      st.set('all', '2' + sup(k - 1) + ' − 1 = ' + num(splits.length));
      st.set('pre', String(k - 1));
      st.set('ok', prefix.has(b) ? 'да' : 'нет');
      note.innerHTML = 'Каждая категория идёт влево или вправо: 2<sup>k</sup> вариантов; убираем два «все в одну сторону» и делим на 2 (лево/право симметричны) — <b>2<sup>k−1</sup> − 1</b> разбиений (это S(k, 2) из шага 21). При k = 20 их 524 287, при сотне категорий — около 6·10<sup>29</sup>. Но при квадратичной потере лучшее разбиение всегда — префикс порядка категорий по среднему ответу (теорема Фишера, урок 10.1): достаточно проверить <b>k − 1</b> вариантов, как у числового признака. Бустинг сортирует категории по G/H — так делают LightGBM и XGBoost; CatBoost вместо этого кодирует категории числами.';
    }
    w.pythonAction(() => 'from itertools import combinations\nfrom gbcourse.rng import Mulberry32\n\nrng = Mulberry32(' + s.seed + ')\ncats = []\nfor i in range(' + s.k + '):\n    n = 5 + rng.randint(26)\n    cats.append((chr(65 + i), n, rng.normal(0, 1)))\n\ndef gain(left):\n    L = [c for c in cats if c[0] in left]\n    R = [c for c in cats if c[0] not in left]\n    nL, nR = sum(c[1] for c in L), sum(c[1] for c in R)\n    mL = sum(c[1] * c[2] for c in L) / nL\n    mR = sum(c[1] * c[2] for c in R) / nR\n    return nL * nR / (nL + nR) * (mL - mR) ** 2\n\nnames = [c[0] for c in cats]\nsplits = [set(("A",) + rest) for r in range(len(names) - 1) for rest in combinations(names[1:], r)]\nbest = max(splits, key=gain)\norder = sorted(names, key=lambda nm: next(c[2] for c in cats if c[0] == nm))\nprefixes = [set(order[:i]) for i in range(1, len(names))]\nprint("разбиений:", len(splits), "| лучшее:", sorted(best), round(gain(best), 4))\nprint("лучший префикс:", round(max(gain(p) for p in prefixes), 4))\n');
    draw();
  });

  /* ==============================================================================
   * 36. Пространство деревьев: формы × признаки × пороги
   * ============================================================================== */
  GBC.widget('tree-space', (el) => {
    const s = { L: 8, p: 10, B: 255 };
    const w = ui.shell(el, { title: 'Сколько существует деревьев решений', sub: 'Дерево с L листьями: форма (число Каталана Cat(L − 1)), а в каждом из L − 1 разбиений — признак (p вариантов) и порог (до B). Жадный алгоритм вместо перебора проверяет на каждом разбиении p·B кандидатов.' });
    ui.slider(w.controls, { label: 'Листьев L', min: 2, max: 64, step: 1, value: s.L, format: String, onInput: (v) => ((s.L = v), draw()) });
    ui.slider(w.controls, { label: 'Признаков p', values: [1, 2, 5, 10, 20, 50, 100, 1000], value: s.p, format: String, onInput: (v) => ((s.p = v), draw()) });
    ui.slider(w.controls, { label: 'Порогов на признак B', values: [1, 10, 63, 255, 1000], value: s.B, format: String, onInput: (v) => ((s.B = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'листьев L', domain: [2, 64] }, y: { label: 'log₁₀ числа', domain: [0, 300] } });
    const cards = cardGrid(200);
    w.main.insertBefore(cards, plot.root);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'shape', label: 'форм Cat(L − 1)' }, { key: 'all', label: 'деревьев (оценка сверху)' }, { key: 'greedy', label: 'кандидатов у жадного' }, { key: 'int', label: 'пар / троек признаков' }]);
    const l10Cat = (n) => (lgamma(2 * n + 1) - lgamma(n + 1) - lgamma(n + 2)) / Math.LN10;
    const l10Trees = (L) => l10Cat(L - 1) + (L - 1) * Math.log10(s.p * s.B);
    function draw() {
      const Ls = U.range(63, 2);
      plot.render([
        { type: 'line', x: Ls, y: Ls.map((L) => l10Trees(L)), color: 'critical', width: 2.4, label: 'деревьев: Cat(L − 1)·(p·B)^{L−1}', hover: false },
        { type: 'line', x: Ls, y: Ls.map((L) => l10Cat(L - 1)), color: 'model', width: 2, label: 'только формы Cat(L − 1)', hover: false },
        { type: 'line', x: Ls, y: Ls.map((L) => Math.log10((L - 1) * s.p * s.B)), color: 'tree', width: 2, label: 'жадный рост: (L − 1)·p·B', hover: false },
        { type: 'hline', y: 80, color: 'ink2', dash: '4 4', width: 1, text: 'атомов во Вселенной ≈ 10⁸⁰' },
        { type: 'points', x: [s.L], y: [l10Trees(s.L)], color: 'critical', r: 6, tooltip: () => [['L', String(s.L)], ['деревьев', numLog10(l10Trees(s.L))]] },
      ]);
      const L = s.L;
      cards.textContent = '';
      [['Форм дерева', numLog10(l10Cat(L - 1)), 'число Каталана Cat(' + (L - 1) + ')'], ['Выборов в разбиениях', numLog10((L - 1) * Math.log10(s.p * s.B)), '(p·B)' + sup(L - 1) + ' = (' + s.p + '·' + s.B + ')' + sup(L - 1)], ['Всего деревьев', numLog10(l10Trees(L)), 'произведение'], ['Жадный алгоритм', num((L - 1) * s.p * s.B), '(L − 1)·p·B']].forEach(([t, v, sub]) => {
        const c = card(t);
        c.body.appendChild(H('div', { style: 'font-size:1.15rem;font-weight:700' }, v));
        c.body.appendChild(H('div', { style: 'font-size:.8rem;color:var(--ink-2)' }, sub));
        cards.appendChild(c.el);
      });
      st.set('shape', numLog10(l10Cat(L - 1)));
      st.set('all', numLog10(l10Trees(L)));
      st.set('greedy', num((L - 1) * s.p * s.B));
      st.set('int', num(comb(s.p, 2)) + ' / ' + num(comb(s.p, 3)));
      note.innerHTML = 'Правило произведения: форма × (признак и порог для каждого разбиения). Часть деревьев совпадает как функции (одинаковые разбиения в разном порядке), поэтому это <em>оценка сверху</em>, но порядок величины верный: уже при 8 листьях, 10 признаках и 255 порогах — около 10<sup>26</sup> деревьев. Найти лучшее дерево перебором невозможно (задача NP-трудна), поэтому все библиотеки строят деревья <b>жадно</b>: каждое разбиение выбирают лучшим «здесь и сейчас» среди p·B кандидатов. Бустинг компенсирует близорукость жадности тем, что следующие деревья исправляют ошибки предыдущих. <b>Взаимодействия:</b> путь от корня к листу проходит не больше d разбиений, поэтому дерево глубины d ловит взаимодействия до d признаков — и выбирает их само из C(p, 2) пар и C(p, 3) троек, не перебирая их явно.';
    }
    w.pythonAction(() => 'from math import comb, log10\n\nL, p, B = ' + s.L + ', ' + s.p + ', ' + s.B + '\nshapes = comb(2 * (L - 1), L - 1) // L          # число Каталана Cat_{L-1}\ntrees = shapes * (p * B) ** (L - 1)\nprint(f"форм {shapes}, деревьев ~10^{log10(trees):.1f}, жадных кандидатов {(L - 1) * p * B}")\nprint("пар признаков:", comb(p, 2), " троек:", comb(p, 3))\n');
    draw();
  });

  /* ==============================================================================
   * 37. Кросс-валидация и подвыборки: сколько способов
   * ============================================================================== */
  GBC.widget('cv-count', (el) => {
    const s = { n: 20, k: 5, q: 2, frac: 0.8 };
    const w = ui.shell(el, { title: 'Кросс-валидация и подвыборки: сколько способов разбить', sub: 'k-кратная кросс-валидация берёт ОДНО из огромного числа разбиений n объектов на k фолдов. Leave-p-out перебирает все C(n, p) отложенных наборов. Карточки сравнивают число вариантов и число обучений.' });
    ui.slider(w.controls, { label: 'Объектов n', values: [10, 12, 20, 50, 100, 1000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Фолдов k', min: 2, max: 10, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.slider(w.controls, { label: 'Leave-p-out: p', min: 1, max: 5, step: 1, value: s.q, format: String, onInput: (v) => ((s.q = v), draw()) });
    ui.slider(w.controls, { label: 'Доля подвыборки (subsample)', values: [0.5, 0.632, 0.7, 0.8, 0.9], value: s.frac, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.frac = v), draw()) });
    const cards = cardGrid(210);
    const eq = texEl('', true, 'margin:6px 0');
    w.main.append(eq, cards);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'lab', label: 'разбиений на фолды' }, { key: 'lpo', label: 'leave-p-out' }, { key: 'sub', label: 'подвыборок' }]);
    function draw() {
      const { n, k, q } = s;
      const sizes = U.range(k).map((i) => Math.floor(n / k) + (i < n % k ? 1 : 0));
      const l10lab = (lnFact(n) - U.sum(sizes.map(lnFact))) / Math.LN10;
      const mult = new Map();
      sizes.forEach((z) => mult.set(z, (mult.get(z) || 0) + 1));
      const l10un = l10lab - U.sum([...mult.values()].map(lnFact)) / Math.LN10;
      const m = Math.round(s.frac * n);
      const l10sub = lnC(n, m) / Math.LN10;
      const l10lpo = lnC(n, q) / Math.LN10;
      const l10boot = lnC(2 * n - 1, n) / Math.LN10;
      texInto(eq, '\\begin{gathered}\\text{помеченные фолды: } \\frac{n!}{' + [...mult.entries()].map(([z, c]) => '(' + z + '!)^{' + c + '}').join('') + '} \\\\ \\text{без пометок: ещё делим на } ' + [...mult.values()].map((c) => c + '!').join('\\,') + '\\end{gathered}', true);
      cards.textContent = '';
      [
        ['k-кратная CV', numLog10(l10un) + ' разбиений', 'обучений: ' + k],
        ['Leave-one-out', num(n) + ' отложенных', 'обучений: ' + num(n)],
        ['Leave-' + q + '-out', numLog10(l10lpo) + ' наборов', 'обучений: ' + numLog10(l10lpo)],
        ['Подвыборка ' + m + ' из ' + n, numLog10(l10sub) + ' вариантов', 'каждое дерево берёт одну'],
        ['Бутстрэп-выборки', numLog10(l10boot) + ' различных', 'C(2n − 1, n)'],
      ].forEach(([t, v, sub]) => {
        const c = card(t);
        c.body.appendChild(H('div', { style: 'font-size:1.08rem;font-weight:700' }, v));
        c.body.appendChild(H('div', { style: 'font-size:.8rem;color:var(--ink-2)' }, sub));
        cards.appendChild(c.el);
      });
      st.set('lab', numLog10(l10lab) + ' / ' + numLog10(l10un));
      st.set('lpo', numLog10(l10lpo));
      st.set('sub', numLog10(l10sub));
      note.innerHTML = 'Разложить n объектов по k <b>помеченным</b> фолдам заданных размеров — мультиномиальный коэффициент (анаграммы, шаг 11); если фолды не помечены (важно только, кто с кем), делим на перестановки фолдов одинакового размера. Даже для 20 объектов и 5 фолдов разбиений ' + numLog10((lnFact(20) - 5 * lnFact(4) - lnFact(5)) / Math.LN10) + ' — оценка кросс-валидации зависит от того, какое из них выпало, поэтому её <b>повторяют</b> с разными зёрнами (repeated CV) и усредняют. Leave-p-out честно перебирает все C(n, p) отложенных наборов — и потому годится только для крошечных n и p. Стохастический бустинг (subsample, урок 7.2) и colsample выбирают для каждого дерева одну подвыборку из C(n, m) — вероятность, что два дерева из сотни получат одинаковую, ничтожна.';
    }
    w.pythonAction(() => 'from math import comb, factorial, prod\nfrom collections import Counter\n\nn, k, p, frac = ' + s.n + ', ' + s.k + ', ' + s.q + ', ' + py(s.frac) + '\nsizes = [n // k + (i < n % k) for i in range(k)]\nlabeled = factorial(n) // prod(factorial(z) for z in sizes)\nunlabeled = labeled // prod(factorial(c) for c in Counter(sizes).values())\nprint(f"фолды {sizes}: помеченных {labeled:.3e}, без пометок {unlabeled:.3e}")\nprint("leave-p-out:", comb(n, p), " подвыборок:", f"{comb(n, round(frac * n)):.3e}", " бутстрэп:", f"{comb(2 * n - 1, n):.3e}")\n');
    draw();
  });

  /* ==============================================================================
   * 38. Значения Шепли: веса коалиций
   * ============================================================================== */
  GBC.widget('shapley-weights', (el) => {
    const s = { M: 4 };
    const w = ui.shell(el, { title: 'Значения Шепли: веса коалиций', sub: 'Вклад признака j усредняют по всем коалициям S остальных признаков. Вес коалиции размера s: s!·(M − s − 1)!/M! — доля порядков «прихода» признаков, в которых перед j стоит ровно S.' });
    ui.slider(w.controls, { label: 'Признаков M', min: 2, max: 10, step: 1, value: s.M, format: String, onInput: (v) => ((s.M = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'размер коалиции s' }, y: { label: 'вес одной коалиции' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'коалиций для признака' }, { key: 'v', label: 'значений v(S)' }, { key: 'o', label: 'порядков M!' }]);
    function draw() {
      const M = s.M;
      const ss = U.range(M);
      const wt = ss.map((k) => (fact(k) * fact(M - k - 1)) / fact(M));
      plot.render([{ type: 'bars', x: ss, y: wt, color: 'model', width: 0.7, maxPx: 36, tooltip: (i) => [['s', String(i)], ['вес', f4(wt[i])], ['коалиций', String(comb(M - 1, i))]] }], { x: [-0.6, M - 0.4], y: [0, Math.max(...wt) * 1.15] });
      rowTable(tbl, ['s', 'коалиций C(M − 1, s)', 'вес одной', 'вес всех вместе'], ss.map((k) => [String(k), String(comb(M - 1, k)), '1/' + M * comb(M - 1, k), '1/' + M]), null, true);
      st.set('c', '2' + sup(M - 1) + ' = ' + num(Math.pow(2, M - 1)));
      st.set('v', '2' + sup(M) + ' = ' + num(Math.pow(2, M)));
      st.set('o', num(fact(M)));
      note.innerHTML = 'Порядков прихода M!. Чтобы перед признаком j стояла ровно коалиция S размера s, её участников ставим вперёд (s! порядков), затем j, затем остальных ((M − s − 1)! порядков): доля s!(M − s − 1)!/M! = 1/(M·C(M − 1, s)). Коалиций размера s ровно C(M − 1, s), и вместе они получают <b>1/M</b>: каждый размер коалиции весит поровну — маленькие и большие коалиции важны одинаково, хотя больших и маленьких мало, а средних много. Для M = 20 нужно 2<sup>20</sup> ≈ 10<sup>6</sup> значений v(S), для M = 50 — 10<sup>15</sup>: поэтому для деревьев придуман полиномиальный TreeSHAP (урок 12.2), а для любых моделей — приближения по случайным порядкам (следующий виджет).';
    }
    w.pythonAction(() => 'from math import comb, factorial\n\nM = ' + s.M + '\nfor s in range(M):\n    w = factorial(s) * factorial(M - s - 1) / factorial(M)\n    print(f"s = {s}: коалиций {comb(M - 1, s)}, вес одной {w:.5f}, вместе {comb(M - 1, s) * w:.5f}")\nprint("сумма весов:", sum(comb(M - 1, s) * factorial(s) * factorial(M - s - 1) / factorial(M) for s in range(M)))\n');
    draw();
  });

  /* ==============================================================================
   * 39. Шепли по случайным порядкам (Монте-Карло)
   * ============================================================================== */
  GBC.widget('shapley-sampling', (el) => {
    const s = { M: 6, R: 100, seed: 2 };
    const w = ui.shell(el, { title: 'Шепли без перебора: случайные порядки признаков', sub: 'Модель-«игра»: v(S) = сумма эффектов признаков из S плюс попарные взаимодействия. Точное значение — перебор 2ᴹ коалиций; приближение — среднее вклада признака по R случайным порядкам. Ошибка убывает как 1/√R.' });
    ui.slider(w.controls, { label: 'Признаков M', min: 3, max: 10, step: 1, value: s.M, format: String, onInput: (v) => ((s.M = v), draw()) });
    ui.slider(w.controls, { label: 'Случайных порядков R', values: [1, 3, 10, 30, 100, 300, 1000], value: s.R, format: String, onInput: (v) => ((s.R = v), draw()) });
    ui.button(w.controls, { label: 'Новая модель', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const bars = new GBC.Plot(w.main, { height: 220, x: { label: 'признак' }, y: { label: 'значение Шепли φⱼ' } });
    const err = new GBC.Plot(w.main, { height: 220, x: { label: 'случайных порядков R', type: 'log', domain: [1, 1000], ticks: [1, 10, 100, 1000] }, y: { label: 'средняя ошибка |φ̂ − φ|', type: 'log' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ex', label: 'вычислений v(S): точно' }, { key: 'mc', label: 'по порядкам' }, { key: 'e', label: 'ошибка при R' }, { key: 'sum', label: 'Σφⱼ = v(все) − v(∅)' }]);
    function game() {
      const rng = new GBC.RNG(s.seed);
      const a = U.range(s.M).map(() => rng.normal(0, 1));
      const b = U.range(s.M).map(() => new Array(s.M).fill(0));
      for (let i = 0; i < s.M; i++) for (let j = i + 1; j < s.M; j++) b[i][j] = b[j][i] = rng.normal(0, 0.7);
      const v = (mask) => {
        let t = 0;
        for (let i = 0; i < s.M; i++) {
          if (!((mask >> i) & 1)) continue;
          t += a[i];
          for (let j = i + 1; j < s.M; j++) if ((mask >> j) & 1) t += b[i][j];
        }
        return t;
      };
      return { a, b, v };
    }
    function draw() {
      const M = s.M;
      const G = game();
      const exact = U.range(M).map((j) => {
        let tot = 0;
        for (let mask = 0; mask < 1 << M; mask++) {
          if ((mask >> j) & 1) continue;
          let sz = 0;
          for (let i = 0; i < M; i++) if ((mask >> i) & 1) sz++;
          tot += ((fact(sz) * fact(M - sz - 1)) / fact(M)) * (G.v(mask | (1 << j)) - G.v(mask));
        }
        return tot;
      });
      const rng = new GBC.RNG(100 + s.seed);
      const acc = new Array(M).fill(0);
      const Rs = [];
      const errs = [];
      let est = null;
      const marks = new Set([1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000]);
      for (let r = 1; r <= 1000; r++) {
        const order = rng.permutation(M);
        let mask = 0;
        let prev = 0;
        order.forEach((j) => {
          mask |= 1 << j;
          const cur = G.v(mask);
          acc[j] += cur - prev;
          prev = cur;
        });
        if (marks.has(r)) {
          const e = acc.map((x) => x / r);
          Rs.push(r);
          errs.push(U.mean(e.map((x, j) => Math.abs(x - exact[j]))));
        }
        if (r === s.R) est = acc.map((x) => x / r);
      }
      const xs = U.range(M, 1);
      bars.render([
        { type: 'bars', x: xs, y: exact, color: (i) => (exact[i] >= 0 ? 'model' : 'tree'), width: 0.6, maxPx: 34, label: 'точно (2ᴹ коалиций)', tooltip: (i) => [['признак', String(i + 1)], ['точно', f3(exact[i])], ['оценка', f3(est[i])]] },
        { type: 'points', x: xs, y: est, color: 'ink', r: 5, hollow: true, label: 'по ' + s.R + ' случайным порядкам' },
        { type: 'hline', y: 0, color: 'axis', width: 1 },
      ], { x: [0.4, M + 0.6] });
      const [elo, ehi] = U.extent(errs);
      err.render([
        { type: 'line', x: Rs, y: errs, color: 'model', width: 2, label: 'ошибка оценки', hover: false },
        { type: 'points', x: Rs, y: errs, color: (i) => (Rs[i] === s.R ? 'tree' : 'model'), r: 4, tooltip: (i) => [['R', String(Rs[i])], ['ошибка', U.fmt(errs[i], 4)]] },
        { type: 'line', x: [1, 1000], y: [errs[0], errs[0] / Math.sqrt(1000)], color: 'truth', dash: '6 4', width: 1.6, label: '∝ 1/√R', hover: false },
      ], { y: [Math.min(elo, errs[0] / Math.sqrt(1000)) * 0.7, ehi * 1.5] });
      st.set('ex', '2' + sup(M) + ' = ' + num(Math.pow(2, M)));
      st.set('mc', s.R + '·' + M + ' = ' + num(s.R * M));
      st.set('e', U.fmt(errs[Rs.indexOf(s.R)], 4));
      st.set('sum', f3(U.sum(exact)) + ' = ' + f3(G.v((1 << M) - 1)));
      note.innerHTML = 'Значение Шепли — среднее вклада признака по всем M! порядкам прихода (предыдущий виджет). Вместо всех порядков берём R случайных: оценка несмещённая, а ошибка убывает как 1/√R (закон больших чисел и ЦПТ, урок 15.13) — в 10 раз точнее стоит в 100 раз больше порядков. Цена — R·M вычислений v(S) вместо 2<sup>M</sup>: при M = 30 это миллиарды против тысяч. Для такой «игры» с попарными взаимодействиями есть и формула: φ<sub>j</sub> = a<sub>j</sub> + ½·Σ<sub>k</sub> b<sub>jk</sub> — каждое взаимодействие делится поровну между участниками. Сумма значений всегда равна v(все) − v(∅) (свойство эффективности, урок 15.21). Так устроены KernelSHAP и sampling-SHAP; для деревьев TreeSHAP считает точно и быстро.';
    }
    w.pythonAction(() => PY_RNG + 'from itertools import combinations\nfrom math import factorial\n\nM, R = ' + s.M + ', ' + s.R + '\nrng = Mulberry32(' + s.seed + ')\na = [rng.normal(0, 1) for _ in range(M)]\nb = [[0.0] * M for _ in range(M)]\nfor i in range(M):\n    for j in range(i + 1, M):\n        b[i][j] = b[j][i] = rng.normal(0, 0.7)\nv = lambda S: sum(a[i] for i in S) + sum(b[i][j] for i, j in combinations(sorted(S), 2))\n\nexact = []\nfor j in range(M):\n    others = [i for i in range(M) if i != j]\n    exact.append(sum(factorial(len(S)) * factorial(M - len(S) - 1) / factorial(M) * (v(set(S) | {j}) - v(set(S)))\n                     for r in range(M) for S in combinations(others, r)))\nformula = [a[j] + 0.5 * sum(b[j]) for j in range(M)]\n\nr2 = Mulberry32(' + (100 + s.seed) + ')\nacc = [0.0] * M\nfor _ in range(R):\n    S, prev = set(), 0.0\n    for j in r2.permutation(M):\n        S.add(j); cur = v(S); acc[j] += cur - prev; prev = cur\nest = [x / R for x in acc]\nprint("точно:   ", [round(x, 3) for x in exact])\nprint("формула: ", [round(x, 3) for x in formula])\nprint("оценка:  ", [round(x, 3) for x in est], " ошибка:", round(sum(abs(e - x) for e, x in zip(est, exact)) / M, 4))\n');
    draw();
  });

  /* ==============================================================================
   * 40. Тренажёр: генератор задач
   * ============================================================================== */
  const pick = (rng, arr) => arr[rng.randint(arr.length)];
  const between = (rng, a, b) => a + rng.randint(b - a + 1);
  const TASKS = [
    { lvl: 1, gen: (r) => { const a = between(r, 2, 6); const b = between(r, 2, 6); return { q: 'В меню ' + a + ' супов и ' + b + ' вторых блюд. Сколько обедов «суп + второе»?', a: a * b, wrong: [a + b, Math.pow(a, b), a * b * 2], why: 'Правило произведения: ' + a + ' · ' + b + ' = ' + a * b + '. Сумма ' + (a + b) + ' ответила бы на вопрос «одно блюдо на выбор».' }; } },
    { lvl: 1, gen: (r) => { const n = between(r, 4, 7); return { q: 'Сколькими способами расставить ' + n + ' разных книг на полке?', a: fact(n), wrong: [n * n, Math.pow(n, n), fact(n - 1)], why: n + '! = ' + fact(n) + ': на первое место ' + n + ' книг, на второе ' + (n - 1) + ', …' }; } },
    { lvl: 1, gen: (r) => { const n = between(r, 5, 10); const k = between(r, 2, 3); return { q: 'Сколькими способами выбрать ' + k + ' признака из ' + n + ' для графика взаимодействий (порядок не важен)?', a: comb(n, k), wrong: [perm(n, k), Math.pow(n, k), comb(n, k) * 2], why: 'C(' + n + ', ' + k + ') = ' + comb(n, k) + '; с учётом порядка было бы ' + perm(n, k) + ' — в ' + k + '! раз больше.' }; } },
    { lvl: 1, gen: (r) => { const k = between(r, 3, 6); return { q: 'Сколько подмножеств у множества из ' + k + ' элементов (включая пустое)?', a: Math.pow(2, k), wrong: [k * k, 2 * k, fact(k)], why: '2^' + k + ' = ' + Math.pow(2, k) + ': каждый элемент либо взят, либо нет.' }; } },
    { lvl: 1, gen: (r) => { const n = between(r, 5, 12); return { q: 'На встрече ' + n + ' человек, каждый пожал руку каждому. Сколько рукопожатий?', a: comb(n, 2), wrong: [n * (n - 1), n * n, 2 * n], why: 'Пар C(' + n + ', 2) = ' + comb(n, 2) + '; упорядоченных пар ' + n * (n - 1) + ', но каждое рукопожатие в них посчитано дважды.' }; } },
    { lvl: 2, gen: (r) => { const n = between(r, 6, 10); const k = 3; return { q: 'Из ' + n + ' бегунов разыгрываются золото, серебро и бронза. Сколько возможных пьедесталов?', a: perm(n, k), wrong: [comb(n, k), Math.pow(n, k), n * k], why: 'Размещения: ' + n + '·' + (n - 1) + '·' + (n - 2) + ' = ' + perm(n, k) + ' — порядок мест важен.' }; } },
    { lvl: 2, gen: (r) => { const n = between(r, 3, 6); const k = between(r, 2, 4); return { q: 'В кафе ' + n + ' вкусов мороженого. Сколько разных порций из ' + k + ' шариков (вкусы могут повторяться, порядок шариков не важен)?', a: comb(n + k - 1, k), wrong: [comb(n, k), Math.pow(n, k), comb(n + k, k)], why: 'Звёзды и перегородки: C(' + n + ' + ' + k + ' − 1, ' + k + ') = ' + comb(n + k - 1, k) + '.' }; } },
    { lvl: 2, gen: (r) => { const k = between(r, 4, 10); return { q: 'Сколько способов разбить ' + k + ' категорий признака на две непустые группы для разбиения дерева?', a: Math.pow(2, k - 1) - 1, wrong: [Math.pow(2, k), k - 1, Math.pow(2, k) - 2], why: '(2^' + k + ' − 2)/2 = ' + (Math.pow(2, k - 1) - 1) + '; но при квадратичной потере достаточно проверить ' + (k - 1) + ' префиксов порядка по среднему.' }; } },
    { lvl: 2, gen: (r) => { const n = between(r, 4, 7); return { q: 'Сколькими способами ' + n + ' человек могут сесть за круглый стол (важны только соседи по часовой стрелке)?', a: fact(n - 1), wrong: [fact(n), fact(n) / 2, n], why: n + '!/' + n + ' = ' + fact(n - 1) + ': каждая рассадка встречается среди ' + n + '! записей в ряд ' + n + ' раз (повороты).' }; } },
    { lvl: 2, gen: (r) => { const k = between(r, 3, 4); return { q: 'Сколько PIN-кодов из ' + k + ' цифр содержат хотя бы одну семёрку?', a: Math.pow(10, k) - Math.pow(9, k), wrong: [k * Math.pow(10, k - 1), Math.pow(9, k), Math.pow(10, k) - perm(10, k)], why: 'Дополнение: все 10^' + k + ' минус коды без семёрки 9^' + k + ' = ' + (Math.pow(10, k) - Math.pow(9, k)) + '.' }; } },
    { lvl: 2, gen: (r) => { const w = pick(r, ['МАМА', 'ПАПАХА', 'ДЕРЕВО', 'КАРКАС']); const cnt = new Map(); w.split('').forEach((c) => cnt.set(c, (cnt.get(c) || 0) + 1)); let v = fact(w.length); cnt.forEach((c) => (v /= fact(c))); return { q: 'Сколько разных «слов» можно составить, переставляя буквы слова ' + w + '?', a: v, wrong: [fact(w.length), fact(w.length) / 2, Math.pow(w.length, 2)], why: w.length + '! / (' + [...cnt.values()].filter((c) => c > 1).map((c) => c + '!').join('·') + ') = ' + v + ' — перестановки одинаковых букв слово не меняют.' }; } },
    { lvl: 2, gen: (r) => { const m = between(r, 2, 5); const n = between(r, 2, 4); return { q: 'Сколько путей из левого нижнего угла сетки ' + m + ' × ' + n + ' в правый верхний, если ходить только вправо и вверх?', a: comb(m + n, n), wrong: [m * n, Math.pow(2, m + n), fact(m + n)], why: 'Путь — слово из ' + m + ' букв R и ' + n + ' букв U: C(' + (m + n) + ', ' + n + ') = ' + comb(m + n, n) + '.' }; } },
    { lvl: 2, gen: (r) => { const p = pick(r, [[3, 4, 5], [4, 4, 3], [5, 3, 3], [3, 3, 4]]); const f = pick(r, [3, 5]); const c = p[0] * p[1] * p[2]; return { q: 'Сетка: ' + p[0] + ' значения learning_rate × ' + p[1] + ' значения max_depth × ' + p[2] + ' значения n_estimators, кросс-валидация на ' + f + ' фолдах. Сколько обучений?', a: c * f, wrong: [c, p[0] + p[1] + p[2], (p[0] + p[1] + p[2]) * f], why: p.join(' · ') + ' · ' + f + ' = ' + c * f + ' — правило произведения.' }; } },
    { lvl: 3, gen: (r) => { const n = pick(r, [4, 5]); return { q: 'Секретный Санта: ' + n + ' человек тянут имена. Сколько раскладок, в которых никто не вытянул себя?', a: derange[n], wrong: [fact(n - 1), fact(n) - 1, Math.round(fact(n) / 2)], why: 'Беспорядки: !' + n + ' = ' + derange[n] + ' ≈ ' + n + '!/e.' }; } },
    { lvl: 3, gen: (r) => { const N = pick(r, [60, 100, 120]); const a = 2; const b = pick(r, [3, 5]); const v = Math.floor(N / a) + Math.floor(N / b) - Math.floor(N / lcm(a, b)); return { q: 'Сколько чисел от 1 до ' + N + ' делятся на ' + a + ' или на ' + b + '?', a: v, wrong: [Math.floor(N / a) + Math.floor(N / b), Math.floor(N / lcm(a, b)), N - v], why: N / a + ' + ' + Math.floor(N / b) + ' − ' + Math.floor(N / lcm(a, b)) + ' = ' + v + ': кратные ' + lcm(a, b) + ' посчитаны дважды.' }; } },
    { lvl: 3, gen: (r) => { const n = between(r, 3, 5); const k = between(r, n + 2, n + 6); return { q: 'Сколькими способами разделить ' + k + ' одинаковых конфет между ' + n + ' детьми, чтобы каждому досталась хотя бы одна?', a: comb(k - 1, n - 1), wrong: [comb(k + n - 1, n - 1), Math.pow(n, k), comb(k, n)], why: 'Раздадим всем по одной, остаток ' + (k - n) + ' — звёздами и перегородками: C(' + (k - 1) + ', ' + (n - 1) + ') = ' + comb(k - 1, n - 1) + '.' }; } },
    { lvl: 3, gen: (r) => { const n = between(r, 3, 6); return { q: 'Сколько различных форм у двоичного дерева решений с ' + (n + 1) + ' листьями?', a: catalan(n), wrong: [Math.pow(2, n), fact(n), comb(2 * n, n)], why: 'Число Каталана Cat_' + n + ' = C(' + 2 * n + ', ' + n + ')/' + (n + 1) + ' = ' + catalan(n) + '.' }; } },
    { lvl: 3, gen: (r) => { const n = pick(r, [4, 5]); const k = pick(r, [2, 3]); return { q: 'Сколькими способами раздать ' + n + ' разных заданий ' + k + ' исполнителям, чтобы у каждого было хотя бы одно?', a: fact(k) * stir(n, k), wrong: [Math.pow(k, n), stir(n, k), comb(n - 1, k - 1)], why: 'Сюръекции: k!·S(n, k) = ' + fact(k) + '·' + stir(n, k) + ' = ' + fact(k) * stir(n, k) + ' = ' + k + '^' + n + ' − (раскладки, где кто-то без заданий).' }; } },
  ];
  GBC.widget('comb-game', (el) => {
    const s = { lvl: 0, seed: 1, right: 0, total: 0, streak: 0, picked: null, Q: null };
    const w = ui.shell(el, { title: 'Тренажёр: задачи на подсчёт', sub: 'Задачи генерируются заново с новыми числами. Среди неверных ответов — типичные ошибки: перепутанный порядок, забытые повторения, двойной счёт.' });
    ui.segmented(w.controls, { label: 'Сложность', value: s.lvl, options: [{ value: 0, label: 'все' }, { value: 1, label: '★' }, { value: 2, label: '★★' }, { value: 3, label: '★★★' }], onChange: (v) => ((s.lvl = v), fresh()) });
    const next = ui.button(w.controls, { label: 'Новая задача', icon: 'step', onClick: () => fresh() });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.05rem;padding:6px 0 12px' });
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(160px,100%),1fr));gap:8px' });
    w.main.append(qEl, optsBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }, { key: 'l', label: 'сложность задачи' }]);
    function fresh() {
      const rng = new GBC.RNG(s.seed++);
      const pool = TASKS.filter((t) => !s.lvl || t.lvl === s.lvl);
      const T = pick(rng, pool);
      const q = T.gen(rng);
      const opts = [q.a];
      q.wrong.forEach((x) => {
        if (Number.isFinite(x) && x >= 0 && !opts.includes(x)) opts.push(x);
      });
      let bump = 1;
      while (opts.length < 4) {
        const x = q.a + bump;
        if (!opts.includes(x)) opts.push(x);
        bump = bump > 0 ? -bump : -bump + 1;
      }
      rng.shuffle(opts);
      s.Q = Object.assign(q, { opts: opts.slice(0, 4), lvl: T.lvl });
      if (!s.Q.opts.includes(q.a)) s.Q.opts[0] = q.a;
      s.picked = null;
      draw();
    }
    function draw() {
      const Q = s.Q;
      qEl.textContent = Q.q;
      optsBox.textContent = '';
      Q.opts.forEach((o) => {
        const b = ui.button(optsBox, { label: num(o), kind: s.picked === null || o === Q.a ? 'primary' : '', onClick: () => {
          if (s.picked !== null) return;
          s.picked = o;
          s.total++;
          if (o === Q.a) s.right++, s.streak++;
          else s.streak = 0;
          draw();
        } });
        b.style.whiteSpace = 'normal';
        b.style.height = 'auto';
        if (s.picked !== null) b.disabled = true;
      });
      st.set('ok', s.right + ' из ' + s.total);
      st.set('s', String(s.streak));
      st.set('l', '★'.repeat(Q.lvl));
      note.innerHTML = s.picked === null ? 'Сначала ответьте себе на два вопроса: важен ли порядок? можно ли повторять? И нет ли двойного счёта.' : (s.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет</b>, ответ: ' + num(Q.a) + '. ') + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), s.picked === null ? 'Пропустить' : 'Новая задача');
    }
    fresh();
  });
})();
