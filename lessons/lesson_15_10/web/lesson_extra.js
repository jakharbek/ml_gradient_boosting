/* Урок 15.10, часть 2 — ряды со знаками, степенные ряды, ряды Фурье и машинное обучение.
 * Виджеты: признак Лейбница, абсолютная и условная сходимость, перестановки (теорема Римана), радиус сходимости,
 * действия со степенными рядами (решатель по шагам), ряды Тейлора, «невидимые» особенности (1/(1 + x²) и
 * логистические потери), ряд Фурье, равенство Парсеваля, модель бустинга как частичная сумма, ν·M ≈ const,
 * экспоненциальное среднее и моментум, условия Роббинса — Монро, L2-бустинг как матричный геометрический ряд,
 * тренажёр. Помощники — из lesson.js (GBC.lesson1510). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const {
    f3, f4, f6, py, sci, sup, powFmt, decades, logAxis, yDom, psums, lfact, GAMMA, logGrid, sumsAt,
    texInto, texEl, card, cardGrid, badge, rowTable, stepList, STARS, plural,
  } = GBC.lesson1510;
  const R = String.raw;
  const PI = Math.PI;
  const sgn = (k) => (k % 2 ? 1 : -1);
  const fact = (n) => Math.exp(lfact(n));

  /* ==============================================================================
   * Шаг 17. Признак Лейбница: ёлочка и оценка ошибки
   * ============================================================================== */
  const ALT = {
    ln2: { label: '1 − 1/2 + 1/3 − … = ln 2', term: (k) => sgn(k) / k, L: Math.LN2, py: '(-1) ** (k + 1) / k', exact: 'math.log(2)', dom: [0.45, 1.05] },
    pi: { label: '4(1 − 1/3 + 1/5 − …) = π (Лейбниц)', term: (k) => (4 * sgn(k)) / (2 * k - 1), L: PI, py: '4 * (-1) ** (k + 1) / (2 * k - 1)', exact: 'math.pi', dom: [2.6, 4.1] },
    e1: { label: '1 − 1 + 1/2! − 1/3! + … = 1/e', term: (k) => sgn(k) / fact(k - 1), L: 1 / Math.E, py: '(-1) ** (k + 1) / math.factorial(k - 1)', exact: '1 / math.e', dom: [-0.05, 1.05] },
    sq: { label: '1 − 1/4 + 1/9 − … = π²/12', term: (k) => sgn(k) / (k * k), L: (PI * PI) / 12, py: '(-1) ** (k + 1) / k**2', exact: 'math.pi**2 / 12', dom: [0.7, 1.02] },
    rt: { label: '1 − 1/√2 + 1/√3 − … ≈ 0.6049', term: (k) => sgn(k) / Math.sqrt(k), L: 0.6048986434216305, py: '(-1) ** (k + 1) / math.sqrt(k)', exact: '0.6048986434216305', dom: [0.2, 1.05] },
  };
  GBC.widget('alternating', (el) => {
    const s = { key: 'ln2', n: 12, avg: false };
    const N = 60;
    const w = ui.shell(el, { title: 'Знакочередующийся ряд: ёлочка вокруг ответа', sub: 'Плюс, минус, плюс… Частичные суммы прыгают то выше, то ниже суммы, а прыжки уменьшаются. Полоса — гарантия признака Лейбница: ошибка не больше модуля первого отброшенного члена.' });
    ui.select(w.controls, { label: 'Ряд', value: s.key, options: Object.entries(ALT).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.player(w.controls, { label: 'Членов n', min: 1, max: N, value: s.n, fps: 4, format: (v) => 'n = ' + v, onChange: (v) => ((s.n = v), draw()) });
    ui.toggle(w.controls, { label: 'Среднее двух соседних сумм', checked: s.avg, onChange: (v) => ((s.avg = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'n', domain: [0, N + 1] }, y: { label: 'частичная сумма' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'S', label: 'Sₙ' }, { key: 'e', label: 'ошибка |Sₙ − S|' }, { key: 'b', label: 'гарантия |aₙ₊₁|' }, { key: 'a', label: 'ошибка среднего' }]);
    function draw() {
      const A = ALT[s.key];
      const sums = psums(A.term, N + 1);
      const ns = U.range(s.n, 1);
      const bound = Math.abs(A.term(s.n + 1));
      const avg = ns.map((n) => (sums[n - 1] + sums[n]) / 2);
      plot.render([
        { type: 'rect', x0: 0, x1: N + 1, y0: A.L - bound, y1: A.L + bound, fill: 'tree', opacity: 0.12, label: 'S ± |aₙ₊₁|', color: 'tree' },
        { type: 'hline', y: A.L, color: 'tree', dash: '6 4', text: 'сумма ' + f4(A.L) },
        { type: 'line', x: ns, y: sums.slice(0, s.n), color: 'model', width: 1.2, opacity: 0.6, hover: false },
        { type: 'points', x: ns, y: sums.slice(0, s.n), color: (i) => (i % 2 ? 'pos' : 'model'), legendColor: 'model', r: 4, label: 'Sₙ (нечётные n выше, чётные ниже)', tooltip: (i) => [['n', String(i + 1)], ['Sₙ', f6(sums[i])]] },
        s.avg ? { type: 'points', x: ns, y: avg, color: 'violet', r: 3.5, shape: 'square', label: '(Sₙ + Sₙ₊₁)/2', tooltip: (i) => [['n', String(i + 1)], ['среднее', f6(avg[i])]] } : null,
      ], { y: A.dom });
      const S = sums[s.n - 1];
      st.set('S', f6(S));
      st.set('e', sci(Math.abs(S - A.L)));
      st.set('b', sci(bound));
      st.set('a', sci(Math.abs(avg[s.n - 1] - A.L)));
      const tips = {
        ln2: 'Без знаков «−» это был бы гармонический ряд, который расходится. Сходимость держится только на чередовании — такую сходимость называют условной (шаг 18).',
        pi: 'Ряд Лейбница для π очень медленный: ошибка ≈ 1/n, и 1000 членов дают лишь 3.1406. Зато среднее двух соседних сумм уже при n = 1000 даёт 3.14159215.',
        e1: 'Факториал в знаменателе — и ряд стремительный: 10 членов дают ошибку 2.5·10⁻⁷, а гарантия 1/10! ≈ 2.8·10⁻⁷.',
        sq: 'Модули 1/k² сами образуют сходящийся ряд — здесь сходимость абсолютная, знаки только ускоряют её.',
        rt: 'Члены 1/√k убывают очень медленно — и ошибка тоже порядка 1/√n. Ряд из модулей (p = ½) расходится: сходимость условная.',
      };
      note.innerHTML = 'Почему так: нечётные суммы S₁ > S₃ > S₅ > … убывают, чётные S₂ < S₄ < … растут, и между ними всегда лежит сумма ряда. Отсюда гарантия |S − Sₙ| ≤ |aₙ₊₁|. ' + tips[s.key] + (s.avg ? ' Сумма лежит между соседними Sₙ и Sₙ₊₁ — их среднее обычно гораздо точнее каждой.' : '');
    }
    w.pythonAction(() => {
      const A = ALT[s.key];
      return 'import math\n\nS, sums = 0.0, []\nfor k in range(1, ' + (s.n + 2) + '):\n    S += ' + A.py + '\n    sums.append(S)\nexact = ' + A.exact + '\nn = ' + s.n + '\nprint("S_n =", sums[n - 1], " ошибка", abs(sums[n - 1] - exact))\nk = n + 1\nprint("гарантия |a_(n+1)| =", abs(' + A.py + '))\nprint("среднее (S_n + S_(n+1))/2 =", (sums[n - 1] + sums[n]) / 2, " ошибка", abs((sums[n - 1] + sums[n]) / 2 - exact))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 18. Абсолютная и условная сходимость
   * ============================================================================== */
  const AC = {
    a1: { lvl: 1, label: 'Σ (−1)ᵏ⁺¹/k²', a: (k) => sgn(k) / (k * k), kind: 'abs', S: (PI * PI) / 12, A: (PI * PI) / 6, why: 'Ряд из модулей Σ 1/k² = π²/6 сходится — сходимость <b>абсолютная</b>. Такой ряд можно переставлять и группировать как угодно.' },
    a2: { lvl: 1, label: 'Σ (−1)ᵏ⁺¹/k', a: (k) => sgn(k) / k, kind: 'cond', S: Math.LN2, why: 'Сам ряд сходится к ln 2, а ряд из модулей — гармонический — расходится. Сходимость <b>условная</b>: её даёт только взаимное сокращение плюсов и минусов.' },
    a3: { lvl: 2, label: 'Σ (−1)ᵏ⁺¹/√k', a: (k) => sgn(k) / Math.sqrt(k), kind: 'cond', S: 0.6048986434216305, why: 'Ряд сходится по Лейбницу (≈ 0.6049), модули 1/√k дают расходящийся p-ряд (p = ½). Условная сходимость.' },
    a4: { lvl: 2, label: 'Σ sin k / k²', a: (k) => Math.sin(k) / (k * k), kind: 'abs', S: 1.0139591323607684, A: 1.27988899, why: 'Знаки идут без всякого порядка (sin k), и признак Лейбница неприменим. Зато |sin k|/k² ≤ 1/k², ряд из модулей сходится — значит, сходится и сам ряд. <b>Абсолютная сходимость влечёт обычную.</b>' },
    a5: { lvl: 1, label: 'Σ (−1)ᵏ⁺¹·k/(k + 1)', a: (k) => (sgn(k) * k) / (k + 1), kind: 'div', why: 'Члены по модулю стремятся к 1, а не к 0 — ряд <b>расходится</b>, никакие знаки не помогут. Признак Лейбница требует, чтобы модули убывали к нулю.' },
  };
  GBC.widget('abs-cond', (el) => {
    const s = { key: 'a2' };
    const NM = 10000;
    const w = ui.shell(el, { title: 'Ряд и ряд из модулей', sub: 'Синяя кривая — частичные суммы ряда Σaₖ, оранжевая — ряда из модулей Σ|aₖ|. Если сходится оранжевый — сходимость абсолютная. Если только синий — условная.' });
    ui.select(w.controls, { label: 'Ряд', value: s.key, options: Object.entries(AC).map(([k, v]) => ({ value: k, label: STARS[v.lvl] + ' ' + v.label })), onChange: (v) => ((s.key = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'n (лог.)', type: 'log', domain: [1, NM], ticks: [1, 10, 100, 1000, 10000] }, y: { label: 'частичные суммы' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 's', label: 'Σaₖ до 10⁴' }, { key: 'a', label: 'Σ|aₖ| до 10⁴' }, { key: 'v', label: 'итог' }]);
    function draw() {
      const C = AC[s.key];
      const ns = U.range(NM, 1).filter((n) => n <= 100 || n % Math.ceil(n / 100) === 0);
      const sa = sumsAt(C.a, ns);
      const sb = sumsAt((k) => Math.abs(C.a(k)), ns);
      plot.render([
        C.S !== undefined ? { type: 'hline', y: C.S, color: 'model', dash: '6 4', text: 'Σaₖ = ' + f4(C.S) } : null,
        C.A !== undefined ? { type: 'hline', y: C.A, color: 'tree', dash: '6 4', text: 'Σ|aₖ| = ' + f4(C.A) } : null,
        { type: 'line', x: ns, y: sb, color: 'tree', width: 2.2, label: 'Σ|aₖ|', hover: false },
        { type: 'line', x: ns, y: sa, color: 'model', width: 1.6, label: 'Σaₖ', hover: false },
      ], { y: [Math.min(-0.2, ...sa), Math.min(Math.max(...sb) * 1.08, 210)] });
      st.set('s', f4(sa[sa.length - 1]));
      st.set('a', f4(sb[sb.length - 1]));
      st.set('v', { abs: 'абсолютно', cond: 'условно', div: 'расходится' }[C.kind]);
      note.innerHTML = C.why;
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 19. Перестановки: теорема Римана
   * ============================================================================== */
  GBC.widget('rearrange', (el) => {
    const s = { mode: 'greedy', target: 1.5, pat: '1:2', K: 3000, ser: 'cond' };
    const w = ui.shell(el, { title: 'Те же числа — другой порядок — другая сумма', sub: 'Берём члены ряда 1 − ½ + ⅓ − ¼ + … и складываем их в другом порядке. «Жадный» порядок: пока сумма ниже цели, берём следующий положительный член, иначе — следующий отрицательный. Каждый член используется ровно один раз.' });
    ui.segmented(w.controls, { label: 'Ряд', value: s.ser, options: [{ value: 'cond', label: '±1/k (условно)' }, { value: 'abs', label: '±1/k² (абсолютно)' }], onChange: (v) => ((s.ser = v), draw()) });
    ui.segmented(w.controls, { label: 'Порядок', value: s.mode, options: [{ value: 'greedy', label: 'к цели' }, { value: 'pattern', label: 'шаблон p : q' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'Цель (для «к цели»)', values: [-1, 0, 0.5, Math.LN2, 1.5, PI], value: s.target, format: (v) => (Math.abs(v - Math.LN2) < 1e-9 ? 'ln 2' : Math.abs(v - PI) < 1e-9 ? 'π' : String(v)), onInput: (v) => ((s.target = v), draw()) });
    ui.select(w.controls, { label: 'Шаблон: p плюсов, q минусов', value: s.pat, options: ['1:1', '1:2', '2:1', '1:4', '4:1'].map((v) => ({ value: v, label: v })), onChange: (v) => ((s.pat = v), draw()) });
    ui.slider(w.controls, { label: 'Членов взято', values: [10, 30, 100, 300, 1000, 3000, 10000], value: s.K, format: (v) => String(v), onInput: (v) => ((s.K = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'сколько членов сложено (лог.)', type: 'log', domain: [1, 10000], ticks: [1, 10, 100, 1000, 10000] }, y: { label: 'сумма' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'S', label: 'сумма сейчас' }, { key: 'T', label: 'ожидаемый предел' }, { key: 'p', label: 'плюсов взято' }, { key: 'm', label: 'минусов взято' }]);
    function draw() {
      const pw = s.ser === 'abs' ? 2 : 1;
      const posT = (i) => 1 / Math.pow(2 * i + 1, pw);
      const negT = (j) => 1 / Math.pow(2 * j + 2, pw);
      let S = 0;
      let i = 0;
      let j = 0;
      const xs = [];
      const ys = [];
      const [pp, qq] = s.pat.split(':').map(Number);
      let phase = 0;
      for (let t = 1; t <= s.K; t++) {
        let usePos;
        if (s.mode === 'greedy') usePos = S <= s.target;
        else {
          usePos = phase < pp;
          phase = (phase + 1) % (pp + qq);
        }
        if (usePos) S += posT(i++);
        else S -= negT(j++);
        if (t <= 100 || t % Math.ceil(t / 150) === 0 || t === s.K) (xs.push(t), ys.push(S));
      }
      let T;
      if (s.ser === 'cond') T = s.mode === 'greedy' ? s.target : Math.LN2 + 0.5 * Math.log(pp / qq);
      else T = s.mode === 'greedy' ? Math.min(Math.max(s.target, -(PI * PI) / 24), (PI * PI) / 8) : (PI * PI) / 12;
      plot.render([
        { type: 'hline', y: T, color: 'tree', dash: '6 4', text: (s.mode === 'greedy' && s.ser === 'cond' ? 'цель ' : 'предел ') + f4(T) },
        s.mode === 'greedy' && s.ser === 'abs' && Math.abs(T - s.target) > 1e-9 ? { type: 'hline', y: s.target, color: 'pos', dash: '3 3', text: 'цель ' + f3(s.target) + ' — недостижима' } : null,
        { type: 'hline', y: s.ser === 'cond' ? Math.LN2 : (PI * PI) / 12, color: 'muted', dash: '2 4' },
        { type: 'line', x: xs, y: ys, color: 'model', width: 2, hover: false },
      ], { y: yDom(ys.slice(Math.min(3, ys.length - 1)).concat([T, s.mode === 'greedy' ? s.target : T]), 0.1) });
      st.set('S', f6(S));
      st.set('T', f6(T));
      st.set('p', String(i));
      st.set('m', String(j));
      if (s.ser === 'cond') {
        note.innerHTML = s.mode === 'greedy'
          ? 'Положительные члены 1 + ⅓ + ⅕ + … в сумме дают ∞, отрицательные ½ + ¼ + … — тоже ∞. Поэтому запаса хватает, чтобы дотянуться до <b>любой</b> цели, а раз сами члены → 0, перелёты становятся всё меньше. Это теорема Римана (1854): условно сходящийся ряд перестановкой можно сделать сходящимся к любому числу или даже расходящимся. Пунктир — сумма в обычном порядке, ln 2.'
          : 'Шаблон «' + pp + ' плюс' + (pp > 1 ? 'а' : '') + ', ' + qq + ' минус' + (qq > 1 ? (qq < 5 ? 'а' : 'ов') : '') + '» даёт сумму ln 2 + ½·ln(p/q) = ' + f4(T) + '. ' + (pp === 1 && qq === 2 ? 'Ровно половина ln 2 — те же числа, а сумма вдвое меньше!' : pp === 1 && qq === 4 ? 'Ровно 0!' : '');
      } else {
        note.innerHTML = 'Ряд из модулей Σ1/k² сходится, и сумма <b>не зависит от порядка</b> (теорема Дирихле): любой шаблон даёт π²/12 ≈ 0.8225. «Жадный» алгоритм упирается в ограничения: все положительные члены вместе дают лишь π²/8 ≈ 1.2337, все отрицательные — π²/24 ≈ 0.4112, и цели за этими пределами недостижимы.';
      }
    }
    w.pythonAction(() => {
      const pw = s.ser === 'abs' ? '**2' : '';
      if (s.mode === 'greedy') return 'target, K = ' + py(s.target) + ', ' + s.K + '\nS, i, j = 0.0, 0, 0\nfor _ in range(K):\n    if S <= target:\n        S += 1 / (2 * i + 1)' + pw + '\n        i += 1\n    else:\n        S -= 1 / (2 * j + 2)' + pw + '\n        j += 1\nprint("сумма:", S, " плюсов", i, " минусов", j)\n';
      const [pp, qq] = s.pat.split(':');
      return 'import math\n\np, q, blocks = ' + pp + ', ' + qq + ', 100000\nS, i, j = 0.0, 0, 0\nfor _ in range(blocks):\n    for _ in range(p):\n        S += 1 / (2 * i + 1)' + pw + '\n        i += 1\n    for _ in range(q):\n        S -= 1 / (2 * j + 2)' + pw + '\n        j += 1\nprint("сумма:", S' + (s.ser === 'cond' ? ', "  ln 2 + ½ ln(p/q) =", math.log(2) + 0.5 * math.log(p / q)' : ', "  π²/12 =", math.pi**2 / 12') + ')\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 20. Степенной ряд и радиус сходимости
   * ============================================================================== */
  const RF = {
    g: { lvl: 1, label: 'Σ xᵏ', lc: () => 0, sg: () => 1, R: 1, left: false, right: false, tex: R`\sum_{k=0}^\infty x^k`, start: 0, py: '1', rt: R`\left|\frac{c_k}{c_{k+1}}\right|=1` },
    log: { lvl: 2, label: 'Σ xᵏ/k', lc: (k) => -Math.log(k), sg: () => 1, R: 1, left: true, right: false, tex: R`\sum_{k=1}^\infty \frac{x^k}{k}`, start: 1, py: '1 / k', rt: R`\left|\frac{c_k}{c_{k+1}}\right|=\frac{k+1}{k}\to1` },
    sq: { lvl: 2, label: 'Σ xᵏ/k²', lc: (k) => -2 * Math.log(k), sg: () => 1, R: 1, left: true, right: true, tex: R`\sum_{k=1}^\infty \frac{x^k}{k^2}`, start: 1, py: '1 / k**2', rt: R`\left|\frac{c_k}{c_{k+1}}\right|=\Bigl(\frac{k+1}{k}\Bigr)^2\to1` },
    lin: { lvl: 1, label: 'Σ k·xᵏ', lc: (k) => Math.log(k), sg: () => 1, R: 1, left: false, right: false, tex: R`\sum_{k=1}^\infty k\,x^k`, start: 1, py: 'k', rt: R`\left|\frac{c_k}{c_{k+1}}\right|=\frac{k}{k+1}\to1` },
    three: { lvl: 2, label: 'Σ xᵏ/(k·3ᵏ)', lc: (k) => -Math.log(k) - k * Math.log(3), sg: () => 1, R: 3, left: true, right: false, tex: R`\sum_{k=1}^\infty \frac{x^k}{k\,3^k}`, start: 1, py: '1 / (k * 3**k)', rt: R`\left|\frac{c_k}{c_{k+1}}\right|=\frac{3(k+1)}{k}\to3` },
    two: { lvl: 1, label: 'Σ 2ᵏxᵏ', lc: (k) => k * Math.LN2, sg: () => 1, R: 0.5, left: false, right: false, tex: R`\sum_{k=0}^\infty (2x)^k`, start: 0, py: '2**k', rt: R`\left|\frac{c_k}{c_{k+1}}\right|=\frac12` },
    exp: { lvl: 1, label: 'Σ xᵏ/k!', lc: (k) => -lfact(k), sg: () => 1, R: Infinity, tex: R`\sum_{k=0}^\infty \frac{x^k}{k!}`, start: 0, py: '1 / math.factorial(k)', rt: R`\left|\frac{c_k}{c_{k+1}}\right|=k+1\to\infty` },
    fac: { lvl: 3, label: 'Σ k!·xᵏ', lc: (k) => lfact(k), sg: () => 1, R: 0, tex: R`\sum_{k=0}^\infty k!\,x^k`, start: 0, py: 'math.factorial(k)', rt: R`\left|\frac{c_k}{c_{k+1}}\right|=\frac{1}{k+1}\to0` },
  };
  GBC.widget('radius-finder', (el) => {
    const s = { key: 'log', x: 0.9 };
    const K = 60;
    const w = ui.shell(el, { title: 'Где сходится степенной ряд Σ cₖxᵏ', sub: 'Сверху — числовая ось: зелёный интервал (−R, R), где ряд сходится; на концах — закрашенная точка, если там сходится, и пустая, если нет. Ниже — модули членов |cₖxᵏ| в выбранной точке и частичные суммы.' });
    ui.select(w.controls, { label: 'Ряд', value: s.key, options: Object.entries(RF).map(([k, v]) => ({ value: k, label: STARS[v.lvl] + ' ' + v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.slider(w.controls, { label: 'Точка x', min: -4, max: 4, step: 0.05, value: s.x, onInput: (v) => ((s.x = Math.round(v * 100) / 100), draw()) });
    const tx = H('div', { style: 'margin:2px 0 4px' });
    w.main.appendChild(tx);
    const p0 = new GBC.Plot(w.main, { height: 92, margin: { bottom: 30, top: 6 }, x: { label: '', domain: [-4.2, 4.2] }, y: { label: '', domain: [-1, 1], ticks: [] }, grid: 'x' });
    const p1 = new GBC.Plot(w.main, { height: 210, x: { label: 'k', domain: [0, K + 1] }, y: { label: '|c_k x^k| (лог.)', type: 'log' } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'n', domain: [0, K + 1] }, y: { label: 'S_n(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'R', label: 'радиус R' }, { key: 'x', label: '|x| / R' }, { key: 'v', label: 'в точке x' }]);
    function draw() {
      const F = RF[s.key];
      const x = s.x;
      texInto(tx, F.tex + R`,\qquad ` + F.rt + R`\;\Rightarrow\;R=` + (F.R === Infinity ? R`\infty` : U.fmt(F.R, 3)), true);
      const Rv = Math.min(F.R, 4.2);
      const L0 = [{ type: 'hline', y: 0, color: 'axis', width: 1 }];
      if (F.R > 0) L0.push({ type: 'segments', x1: [-Rv], y1: [0], x2: [Rv], y2: [0], color: 'green', width: 8, opacity: 0.55 });
      if (F.R > 0 && F.R < Infinity) L0.push({ type: 'points', x: [-F.R, F.R], y: [0, 0], r: 6, color: 'green', hollow: false, tooltip: (i) => [['x', f3(i ? F.R : -F.R)], ['на конце', (i ? F.right : F.left) ? 'сходится' : 'расходится']] });
      if (F.R > 0 && F.R < Infinity) L0.push({ type: 'points', x: [-F.R, F.R].filter((v, i) => !(i ? F.right : F.left)), y: [-F.R, F.R].filter((v, i) => !(i ? F.right : F.left)).map(() => 0), r: 4.5, color: 'surface' });
      if (F.R === 0) L0.push({ type: 'points', x: [0], y: [0], r: 6, color: 'green' });
      L0.push({ type: 'vline', x, color: 'ink2', width: 2 });
      L0.push({ type: 'text', items: [{ x, y: 0.55, anchor: 'middle', text: 'x = ' + f3(x) }] });
      p0.render(L0);
      const ks = U.range(K, F.start === 0 ? 0 : 1);
      const lx = Math.log(Math.abs(x));
      const lterm = ks.map((k) => (x === 0 ? (k === 0 ? 0 : -Infinity) : F.lc(k) + k * lx) / Math.LN10);
      const fin = lterm.filter(Number.isFinite);
      const lo = Math.max(Math.min(...fin), -40);
      const hi = Math.min(Math.max(...fin), 40);
      let a = Math.floor(lo);
      let b = Math.ceil(hi);
      if (b <= a) b = a + 1;
      const stp = Math.max(1, Math.ceil((b - a) / 6));
      a = Math.floor(a / stp) * stp;
      b = a + Math.ceil((b - a) / stp) * stp;
      p1.opts.y.ticks = decades(a, b, stp);
      p1.opts.y.format = powFmt;
      p1.render([
        { type: 'hline', y: 1, color: 'muted', dash: '2 4' },
        { type: 'points', x: ks, y: lterm.map((v) => (Number.isFinite(v) ? Math.pow(10, U.clamp(v, -40, 40)) : NaN)), color: 'model', r: 3, tooltip: (i) => [['k', String(ks[i])], ['|cₖxᵏ|', sci(Math.pow(10, lterm[i]))]] },
      ], { y: [Math.pow(10, a), Math.pow(10, b)] });
      const sums = [];
      let acc = 0;
      ks.forEach((k, i) => {
        acc += Number.isFinite(lterm[i]) ? F.sg(k) * Math.sign(x) ** k * Math.pow(10, lterm[i]) : 0;
        sums.push(acc);
      });
      const cap = (v) => U.clamp(v, -50, 50);
      p2.render([
        { type: 'line', x: ks.map((k, i) => i + 1), y: sums.map(cap), color: 'violet', width: 1.2, opacity: 0.6, hover: false },
        { type: 'points', x: ks.map((k, i) => i + 1), y: sums.map(cap), color: 'violet', r: 3, tooltip: (i) => [['n', String(i + 1)], ['Sₙ(x)', sci(sums[i])]] },
      ], { y: yDom(sums.map(cap), 0.08) });
      const ax = Math.abs(x);
      let verdict;
      if (F.R === Infinity) verdict = 'сходится';
      else if (F.R === 0) verdict = x === 0 ? 'сходится (только здесь)' : 'расходится';
      else if (ax < F.R - 1e-9) verdict = 'сходится';
      else if (ax > F.R + 1e-9) verdict = 'расходится';
      else verdict = (x > 0 ? F.right : F.left) ? 'сходится (конец)' : 'расходится (конец)';
      st.set('R', F.R === Infinity ? '∞' : U.fmt(F.R, 3));
      st.set('x', F.R === Infinity ? '0' : F.R === 0 ? '∞' : f3(ax / F.R));
      st.set('v', verdict);
      const ends = { log: 'На концах по-разному: при x = 1 — гармонический ряд (расходится), при x = −1 — знакочередующийся −(1 − ½ + ⅓ − …) = −ln 2 (сходится условно).', sq: 'На обоих концах ряд сходится абсолютно: |±1|ᵏ/k² = 1/k².', g: 'На концах члены не стремятся к нулю (1, 1, 1… или ±1) — расходится.', lin: 'На концах члены ±k растут — расходится.', three: 'При x = 3 получаем Σ1/k — расходится; при x = −3 — Σ(−1)ᵏ/k — сходится. Внутри |x| < 3 это −ln(1 − x/3).', two: 'Это геометрический ряд с q = 2x: сходится при |2x| < 1.' };
      note.innerHTML = 'По признаку отношения |cₖ₊₁xᵏ⁺¹|/|cₖxᵏ| → |x|/R: при |x| < R члены убывают как геометрическая прогрессия, при |x| > R растут. ' + (F.R === Infinity ? 'Здесь R = ∞: факториал побеждает любую степень, ряд сходится на всей оси.' : F.R === 0 ? 'Здесь R = 0: k! растёт быстрее любой геометрической прогрессии, и ряд сходится только при x = 0 — бесполезный ряд.' : (ends[s.key] || '')) + ' На самих концах x = ±R признак молчит — их проверяют отдельно.';
    }
    w.pythonAction(() => {
      const F = RF[s.key];
      return 'import math\n\nx = ' + py(s.x) + '\nc = lambda k: ' + F.py + '\nS = 0.0\nfor k in range(' + F.start + ', ' + (F.start + 60) + '):\n    S += c(k) * x**k\n    if k % 10 == 9:\n        print(f"n = {k + 1:2d}: S_n(x) = {S:.6g},  |член| = {abs(c(k) * x**k):.3g}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 21. Действия со степенными рядами: решатель по шагам
   * ============================================================================== */
  const OPS = [
    { lvl: 1, name: '1/(1 + x) из геометрического', tex: R`\frac{1}{1+x}=\;?`, f: (x) => 1 / (1 + x), c: (k) => sgn(k + 1), R: 1, view: [-1.5, 1.5], yv: [-2, 6], check: { x: 0.5, val: 2 / 3, py: '1 / (1 + 0.5)' }, steps: [
      ['Знаем: геометрический ряд', R`\frac{1}{1-u}=1+u+u^2+u^3+\dots,\quad |u|<1`],
      ['Подставим u = −x', R`\frac{1}{1+x}=1-x+x^2-x^3+\dots=\sum_{k=0}^\infty(-1)^k x^k`],
      ['Условие |u| < 1 превращается в |x| < 1', R`R=1`]] },
    { lvl: 2, name: '1/(1 + x²) подстановкой', tex: R`\frac{1}{1+x^2}=\;?`, f: (x) => 1 / (1 + x * x), c: (k) => (k % 2 ? 0 : sgn(k / 2 + 1)), R: 1, view: [-1.6, 1.6], yv: [-1, 2], check: { x: 0.5, val: 0.8, py: '1 / (1 + 0.5**2)' }, steps: [
      ['Геометрический ряд с u = −x²', R`\frac{1}{1+x^2}=\frac{1}{1-(-x^2)}=\sum_{k=0}^\infty(-x^2)^k`],
      ['Раскроем', R`=1-x^2+x^4-x^6+\dots`],
      ['Сходится при |−x²| < 1, то есть |x| < 1 — хотя функция гладкая на всей оси! Почему — шаг 23', R`R=1`]] },
    { lvl: 2, name: 'ln(1 + x) интегрированием', tex: R`\ln(1+x)=\;?`, f: (x) => (x > -1 ? Math.log1p(x) : NaN), c: (k) => (k === 0 ? 0 : sgn(k) / k), R: 1, view: [-1.2, 1.6], yv: [-3, 2], check: { x: 1, val: Math.LN2, py: 'math.log(2)' }, steps: [
      ['Производная ln(1 + t) равна 1/(1 + t)', R`\ln(1+x)=\int_0^x\frac{dt}{1+t}`],
      ['Под интегралом — ряд из первого примера', R`=\int_0^x\bigl(1-t+t^2-t^3+\dots\bigr)dt`],
      ['Внутри радиуса степенной ряд можно интегрировать почленно', R`=x-\frac{x^2}{2}+\frac{x^3}{3}-\frac{x^4}{4}+\dots=\sum_{k=1}^\infty\frac{(-1)^{k+1}x^k}{k}`],
      ['Радиус тот же, R = 1; а при x = 1 ряд ещё и сходится — к ln 2 (шаг 17)', R`1-\tfrac12+\tfrac13-\tfrac14+\dots=\ln 2`]] },
    { lvl: 2, name: 'arctg x интегрированием', tex: R`\operatorname{arctg}x=\;?`, f: Math.atan, c: (k) => (k % 2 ? sgn((k + 1) / 2) / k : 0), R: 1, view: [-1.6, 1.6], yv: [-2, 2], check: { x: 1, val: PI / 4, py: 'math.pi / 4' }, steps: [
      ['Производная арктангенса', R`\operatorname{arctg}x=\int_0^x\frac{dt}{1+t^2}`],
      ['Подставим ряд из второго примера', R`=\int_0^x\bigl(1-t^2+t^4-\dots\bigr)dt`],
      ['Почленно', R`=x-\frac{x^3}{3}+\frac{x^5}{5}-\dots=\sum_{k=0}^\infty\frac{(-1)^k x^{2k+1}}{2k+1}`],
      ['При x = 1: ряд Лейбница', R`\frac{\pi}{4}=1-\frac13+\frac15-\frac17+\dots`]] },
    { lvl: 2, name: '1/(1 − x)² дифференцированием', tex: R`\frac{1}{(1-x)^2}=\;?`, f: (x) => 1 / ((1 - x) * (1 - x)), c: (k) => k + 1, R: 1, view: [-1.5, 0.95], yv: [-1, 12], check: { x: 0.5, val: 4, py: '1 / (1 - 0.5)**2' }, steps: [
      ['Продифференцируем обе части геометрического ряда', R`\frac{d}{dx}\frac{1}{1-x}=\frac{d}{dx}\bigl(1+x+x^2+x^3+\dots\bigr)`],
      ['Внутри радиуса — почленно', R`\frac{1}{(1-x)^2}=1+2x+3x^2+\dots=\sum_{k=1}^\infty k\,x^{k-1}`],
      ['Умножим на x и подставим x = ½ — получим Σ k/2ᵏ', R`\sum_{k=1}^\infty\frac{k}{2^k}=\frac{1/2}{(1-1/2)^2}=2`],
      ['А с x = 1 − p — среднее время ожидания успеха (шаг 9)', R`\sum_{k=1}^\infty k\,p(1-p)^{k-1}=\frac{p}{p^2}=\frac1p`]] },
    { lvl: 3, name: 'π с точностью до 8 знаков (Мэчин)', tex: R`\pi=16\operatorname{arctg}\tfrac15-4\operatorname{arctg}\tfrac1{239}`, f: Math.atan, c: (k) => (k % 2 ? sgn((k + 1) / 2) / k : 0), R: 1, view: [-1.6, 1.6], yv: [-2, 2], check: { x: 0.2, val: PI, py: 'math.pi', machin: true }, steps: [
      ['Ряд Лейбница (x = 1) сходится очень медленно: ошибка ≈ 1/n. Нужна точка, где |x| ≪ 1', R`\operatorname{arctg}x=x-\frac{x^3}{3}+\frac{x^5}{5}-\dots`],
      ['Формула Мэчина (1706) — тождество для арктангенсов', R`\frac{\pi}{4}=4\operatorname{arctg}\frac15-\operatorname{arctg}\frac1{239}`],
      ['При x = 1/5 каждый член меньше предыдущего в 25 раз — геометрическая скорость', R`\Bigl|\frac{c_{k+2}x^{k+2}}{c_k x^k}\Bigr|\approx x^2=\frac1{25}`],
      ['5 членов каждого ряда: ошибка 2.9·10⁻⁸; 8 членов: 1.2·10⁻¹²', R`\pi\approx 3.14159268\ (5\text{ членов}),\quad 3.141592653589\ (8)`]] },
  ];
  GBC.widget('series-ops', (el) => {
    const s = { i: 0, k: 1, n: 6 };
    const w = ui.shell(el, { title: 'Новые ряды из старых: подстановка, интеграл, производная', sub: 'Почти все нужные степенные ряды получаются из одного геометрического. Внутри радиуса сходимости ряд можно дифференцировать и интегрировать почленно, как многочлен. Нажимайте «шаг вперёд», а ползунком степени сравните частичную сумму с функцией.' });
    const player = ui.player(w.controls, { label: 'Шаг вывода', min: 0, max: OPS[0].steps.length, value: 1, fps: 0.8, format: (k, m) => 'шаг ' + k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    ui.select(w.controls, { label: 'Пример', value: '0', options: OPS.map((X, i) => ({ value: String(i), label: STARS[X.lvl] + ' ' + X.name })), onChange: (v) => {
      s.i = +v;
      player.setMax(OPS[s.i].steps.length);
      player.set(1);
      s.k = 1;
      draw();
    } });
    ui.slider(w.controls, { label: 'Степень частичной суммы n', min: 1, max: 30, step: 1, value: s.n, format: (v) => String(v), onInput: (v) => ((s.n = v), draw()) });
    const pc = card('Задача');
    const probTex = H('div');
    pc.body.appendChild(probTex);
    const list = H('ol', { style: 'margin:8px 0 0;padding-left:1.4em;display:grid;gap:6px' });
    pc.body.appendChild(list);
    w.main.appendChild(pc.el);
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'проверка' }, { key: 'v', label: 'частичная сумма' }, { key: 't', label: 'точно' }]);
    const Sx = (X, x, n) => {
      let acc = 0;
      for (let k = 0; k <= n; k++) acc += X.c(k) * Math.pow(x, k);
      return acc;
    };
    function draw() {
      const X = OPS[s.i];
      texInto(probTex, X.tex, true);
      stepList(list, X.steps, s.k);
      const xs = U.linspace(X.view[0], X.view[1], 400);
      const clip = (v) => (Number.isFinite(v) && v > X.yv[0] - 5 && v < X.yv[1] + 5 ? v : NaN);
      plot.render([
        { type: 'vband', x0: -X.R, x1: X.R, color: 'green', opacity: 0.08 },
        { type: 'line', x: xs, y: xs.map(X.f).map(clip), color: 'model', width: 2.6, label: 'функция', hover: false },
        { type: 'line', x: xs, y: xs.map((x) => Sx(X, x, s.n)).map(clip), color: 'violet', width: 2, dash: '6 4', label: 'многочлен степени ' + s.n, hover: false },
        { type: 'vline', x: X.check.x, color: 'ink2', dash: '3 3', width: 1 },
      ], { x: X.view, y: X.yv });
      let v;
      if (X.check.machin) v = 16 * Sx(X, 0.2, s.n) - 4 * Sx(X, 1 / 239, s.n);
      else if (s.i === 4) v = Sx(X, 0.5, s.n);
      else v = Sx(X, X.check.x, s.n);
      st.set('c', X.check.machin ? 'π по Мэчину' : 'x = ' + X.check.x);
      st.set('v', X.check.machin ? U.fmt(v, 12) : f6(v));
      st.set('t', X.check.machin ? U.fmt(PI, 12) : f6(X.check.val));
      note.innerHTML = (X.check.machin ? 'Частичные суммы степени ' + s.n + ' в точках 1/5 и 1/239 дают π с ошибкой ' + sci(Math.abs(v - PI)) + '.' : 'В точке x = ' + X.check.x + ' многочлен степени ' + s.n + ' даёт ' + f6(v) + ', точное значение ' + f6(X.check.val) + ' (ошибка ' + sci(Math.abs(v - X.check.val)) + ').') + ' Зелёная полоса — интервал сходимости |x| < ' + X.R + ': внутри многочлены прижимаются к функции, снаружи — разлетаются.';
    }
    w.pythonAction(() => {
      const X = OPS[s.i];
      const coef = ['(-1)**k', '0 if k % 2 else (-1)**(k // 2)', '0 if k == 0 else (-1)**(k + 1) / k', '(-1)**((k - 1) // 2) / k if k % 2 else 0', 'k + 1', '(-1)**((k - 1) // 2) / k if k % 2 else 0'][s.i];
      return 'import math\n\nc = lambda k: ' + coef + '\nS = lambda x, n: sum(c(k) * x**k for k in range(n + 1))\nfor n in (2, 5, 10, 20):\n' + (X.check.machin ? '    print(n, 16 * S(1 / 5, n) - 4 * S(1 / 239, n), "  π =", math.pi)\n' : '    print(n, S(' + X.check.x + ', n), "  точно:", ' + X.check.py + ')\n');
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 22. Ряды Тейлора: eˣ, sin, cos — и где они работают
   * ============================================================================== */
  const TY = {
    exp: { label: 'eˣ = Σ xᵏ/k!', f: Math.exp, c: (k) => 1 / fact(k), R: Infinity, dom: [-6, 6], yd: [-3, 30], py: 'x**k / math.factorial(k)', pf: 'math.exp(x)' },
    sin: { label: 'sin x = x − x³/3! + …', f: Math.sin, c: (k) => (k % 2 ? sgn((k + 1) / 2) / fact(k) : 0), R: Infinity, dom: [-10, 10], yd: [-2.5, 2.5], py: '(-1)**((k - 1) // 2) * x**k / math.factorial(k) if k % 2 else 0', pf: 'math.sin(x)' },
    cos: { label: 'cos x = 1 − x²/2! + …', f: Math.cos, c: (k) => (k % 2 ? 0 : sgn(k / 2 + 1) / fact(k)), R: Infinity, dom: [-10, 10], yd: [-2.5, 2.5], py: '0 if k % 2 else (-1)**(k // 2) * x**k / math.factorial(k)', pf: 'math.cos(x)' },
    ln: { label: 'ln(1 + x) = x − x²/2 + …', f: (x) => (x > -1 ? Math.log1p(x) : NaN), c: (k) => (k === 0 ? 0 : sgn(k) / k), R: 1, dom: [-1.5, 2], yd: [-3, 2], py: '0 if k == 0 else (-1)**(k + 1) * x**k / k', pf: 'math.log1p(x)' },
    geo: { label: '1/(1 − x) = 1 + x + x² + …', f: (x) => 1 / (1 - x), c: () => 1, R: 1, dom: [-1.8, 1.8], yd: [-3, 8], py: 'x**k', pf: '1 / (1 - x)' },
    atan: { label: 'arctg x = x − x³/3 + …', f: Math.atan, c: (k) => (k % 2 ? sgn((k + 1) / 2) / k : 0), R: 1, dom: [-2, 2], yd: [-2.2, 2.2], py: '(-1)**((k - 1) // 2) * x**k / k if k % 2 else 0', pf: 'math.atan(x)' },
  };
  GBC.widget('taylor-approx', (el) => {
    const s = { key: 'sin', n: 7, x: 2 };
    const NM = 40;
    const w = ui.shell(el, { title: 'Ряд Тейлора: многочлены, которые «обнимают» функцию', sub: 'Синяя — функция, фиолетовая — частичная сумма ряда Тейлора степени n в нуле (урок 15.7). Зелёная полоса — интервал сходимости. Снизу — ошибка в выбранной точке x в зависимости от n.' });
    ui.select(w.controls, { label: 'Функция', value: s.key, options: Object.entries(TY).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.key = v;
      const T = TY[v];
      s.x = U.clamp(s.x, T.dom[0], T.dom[1]);
      xsl.set(s.x);
      draw();
    } });
    ui.player(w.controls, { label: 'Степень n', min: 0, max: NM, value: s.n, fps: 2, format: (v) => 'n = ' + v, onChange: (v) => ((s.n = v), draw()) });
    const xsl = ui.slider(w.controls, { label: 'Точка x', min: -10, max: 10, step: 0.1, value: s.x, onInput: (v) => {
      const T = TY[s.key];
      s.x = U.clamp(Math.round(v * 10) / 10, T.dom[0], T.dom[1]);
      draw();
    } });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'степень n', domain: [-0.5, NM + 0.5] }, y: { label: 'ошибка в точке x (лог.)', type: 'log' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'S', label: 'Sₙ(x)' }, { key: 'f', label: 'f(x)' }, { key: 'e', label: 'ошибка' }, { key: 'big', label: 'наибольший член' }]);
    function draw() {
      const T = TY[s.key];
      const x = s.x;
      const S = (t, n) => {
        let acc = 0;
        for (let k = 0; k <= n; k++) acc += T.c(k) * Math.pow(t, k);
        return acc;
      };
      const grid = U.linspace(T.dom[0], T.dom[1], 500);
      const clip = (v) => (Number.isFinite(v) && v > T.yd[0] - 20 && v < T.yd[1] + 20 ? v : NaN);
      const R = Math.min(T.R, 50);
      p1.render([
        { type: 'vband', x0: -R, x1: R, color: 'green', opacity: 0.08 },
        { type: 'line', x: grid, y: grid.map(T.f).map(clip), color: 'model', width: 2.6, label: 'функция', hover: false },
        { type: 'line', x: grid, y: grid.map((t) => S(t, s.n)).map(clip), color: 'violet', width: 2, dash: '6 4', label: 'степень ' + s.n, hover: false },
        { type: 'vline', x, color: 'ink2', dash: '3 3', width: 1 },
      ], { x: T.dom, y: T.yd });
      const ns = U.range(NM + 1);
      const fx = T.f(x);
      const errs = ns.map((n) => Math.max(Math.abs(S(x, n) - fx), 1e-16));
      const fin = errs.filter(Number.isFinite);
      const ax = logAxis(Math.min(...fin), Math.min(Math.max(...fin), 1e12));
      p2.opts.y.ticks = ax.ticks;
      p2.opts.y.format = powFmt;
      p2.render([
        { type: 'line', x: ns, y: errs.map((v) => Math.min(v, ax.domain[1])), color: 'violet', width: 1.4, opacity: 0.6, hover: false },
        { type: 'points', x: ns, y: errs.map((v) => Math.min(v, ax.domain[1])), r: (i) => (i === s.n ? 6 : 3), color: (i) => (i === s.n ? 'tree' : 'violet'), legendColor: 'violet', tooltip: (i) => [['n', String(i)], ['ошибка', sci(errs[i])]] },
      ], { y: ax.domain });
      let big = 0;
      let kBig = -1;
      let kFirst = -1;
      for (let k = 0; k <= Math.max(s.n, 60); k++) {
        const v = Math.abs(T.c(k) * Math.pow(x, k));
        if (v > 0 && kFirst < 0) kFirst = k;
        if (k <= s.n && v > big) (big = v), (kBig = k);
      }
      let kPeak = Math.max(kFirst, 0);
      for (let k = kPeak; k <= 60; k++) if (Math.abs(T.c(k) * Math.pow(x, k)) > Math.abs(T.c(kPeak) * Math.pow(x, kPeak))) kPeak = k;
      void kBig;
      const Sn = S(x, s.n);
      st.set('S', sci(Sn));
      st.set('f', Number.isFinite(fx) ? sci(fx) : 'не опр.');
      st.set('e', sci(Math.abs(Sn - fx)));
      st.set('big', sci(big));
      const inside = Math.abs(x) < T.R;
      let msg;
      if (T.R === Infinity) msg = 'R = ∞: ряд сходится при любом x, но чем дальше от нуля, тем больше нужна степень. ' + (kFirst >= 0 && kPeak > kFirst ? 'При |x| = ' + U.fmt(Math.abs(x), 2) + ' члены сначала <b>растут</b> (до степени ' + kPeak + ', наибольший ≈ ' + sci(Math.abs(T.c(kPeak) * Math.pow(x, kPeak))) + '), и только потом факториал их «гасит». ' : 'При |x| = ' + U.fmt(Math.abs(x), 2) + ' члены убывают сразу — несколько членов дают хорошую точность. ') + (Math.abs(x) >= 8 ? 'Большие члены разных знаков почти сокращаются — в вычислениях на компьютере это теряет точность (так считать e⁻²⁰ рядом нельзя: см. «В коде»).' : '');
      else msg = 'R = 1. ' + (inside ? 'В точке x = ' + U.fmt(x, 2) + ' (|x| < 1) ошибка убывает примерно как |x|ⁿ — на графике прямая.' : Math.abs(x) === 1 ? 'На границе |x| = 1 — особый случай: проверяется отдельно.' : 'В точке x = ' + U.fmt(x, 2) + ' (|x| > 1) ряд <b>расходится</b>: ошибка растёт с n, хотя функция' + (Number.isFinite(fx) ? ' там прекрасно определена (f = ' + f3(fx) + ')' : ' там не определена') + '. Ряд Тейлора «видит» функцию только внутри радиуса.');
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const T = TY[s.key];
      return 'import math\n\nx = ' + py(s.x) + '\nterm = lambda k: ' + T.py + '\nS = 0.0\nfor n in range(' + (s.n + 1) + '):\n    S += term(n)\nprint("S_n(x) =", S, "  f(x) =", ' + T.pf + ', "  ошибка", abs(S - ' + T.pf + '))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 23. Откуда берётся радиус: особые точки в комплексной плоскости
   * ============================================================================== */
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cdiv = (a, b) => {
    const d = b[0] * b[0] + b[1] * b[1];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  };
  const cexp = (z) => [Math.exp(z[0]) * Math.cos(z[1]), Math.exp(z[0]) * Math.sin(z[1])];
  const clog = (z) => [Math.log(Math.hypot(z[0], z[1])), Math.atan2(z[1], z[0])];
  /** softplus(z) = ln(1 + eᶻ): аналитическое продолжение без разрезов внутри круга сходимости. */
  function csoftplus(z) {
    if (z[0] <= 0) {
      const e = cexp(z);
      return clog([1 + e[0], e[1]]);
    }
    const e = cexp([-z[0], -z[1]]);
    const l = clog([1 + e[0], e[1]]);
    return [z[0] + l[0], z[1] + l[1]];
  }
  /** Коэффициенты Тейлора в точке a по формуле Коши (дискретное преобразование Фурье на окружности радиуса r). */
  function taylorCoefs(fc, a, r, K, NP = 512) {
    const vals = [];
    for (let j = 0; j < NP; j++) {
      const th = (2 * PI * j) / NP;
      vals.push(fc([a + r * Math.cos(th), r * Math.sin(th)]));
    }
    const out = [];
    for (let k = 0; k <= K; k++) {
      let re = 0;
      for (let j = 0; j < NP; j++) {
        const th = (2 * PI * j * k) / NP;
        re += vals[j][0] * Math.cos(th) + vals[j][1] * Math.sin(th);
      }
      out.push(re / NP / Math.pow(r, k));
    }
    return out;
  }
  const HS = {
    rat: { label: '1/(1 + x²)', fc: (z) => cdiv([1, 0], [1 + z[0] * z[0] - z[1] * z[1], 2 * z[0] * z[1]]), f: (x) => 1 / (1 + x * x), poles: [[0, 1], [0, -1]], Rof: (a) => Math.hypot(a, 1), dom: [-4, 4], yd: [-0.6, 1.6], im: 2.6, polesTxt: '±i' },
    soft: { label: 'потери ln(1 + e^F) (логистическая регрессия)', fc: csoftplus, f: (x) => Math.log1p(Math.exp(-Math.abs(x))) + Math.max(x, 0), poles: [[0, PI], [0, -PI], [0, 3 * PI], [0, -3 * PI]], Rof: (a) => Math.hypot(a, PI), dom: [-8, 8], yd: [-2, 10], im: 7, polesTxt: '±iπ, ±3iπ, …' },
  };
  GBC.widget('hidden-singularity', (el) => {
    const s = { key: 'rat', a: 0, n: 12 };
    const w = ui.shell(el, { title: 'Радиус сходимости — расстояние до ближайшей «особой точки»', sub: 'Функция 1/(1 + x²) гладкая на всей прямой, но её ряд Тейлора в нуле сходится только при |x| < 1. Причина видна на комплексной плоскости: в точках ±i знаменатель обращается в ноль. Круг сходимости не может их «перешагнуть». Двигайте центр разложения a.' });
    ui.segmented(w.controls, { label: 'Функция', value: s.key, options: [{ value: 'rat', label: '1/(1 + x²)' }, { value: 'soft', label: 'ln(1 + eᶠ)' }], onChange: (v) => ((s.key = v), (s.a = U.clamp(s.a, -4, 4)), draw()) });
    ui.slider(w.controls, { label: 'Центр разложения a', min: -4, max: 4, step: 0.1, value: s.a, onInput: (v) => ((s.a = Math.round(v * 10) / 10), draw()) });
    ui.player(w.controls, { label: 'Степень n', min: 1, max: 40, value: s.n, fps: 3, format: (v) => 'n = ' + v, onChange: (v) => ((s.n = v), draw()) });
    const box = H('div', { style: 'max-width:420px;margin:0 auto' });
    w.main.appendChild(box);
    const pc = new GBC.Plot(box, { height: 300, equal: true, x: { label: 'Re z' }, y: { label: 'Im z' } });
    const pr = new GBC.Plot(w.main, { height: 250, x: { label: 'x (вещественная ось)' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'R', label: 'радиус R' }, { key: 'est', label: '|cₙ|^(−1/n) — оценка R' }, { key: 'iv', label: 'интервал сходимости' }]);
    let cache = { key: null };
    function draw() {
      const F = HS[s.key];
      const a = s.a;
      const Rr = F.Rof(a);
      if (cache.key !== s.key + ':' + a) cache = { key: s.key + ':' + a, c: taylorCoefs(F.fc, a, 0.92 * Rr, 40) };
      const c = cache.c;
      const th = U.linspace(0, 2 * PI, 200);
      const lim = F.im;
      pc.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'vline', x: 0, color: 'axis', width: 1 },
        { type: 'area', x: th.map((t) => a + Rr * Math.cos(t)), y0: th.map(() => 0), y1: th.map((t) => Rr * Math.sin(t)), color: 'green', opacity: 0.12 },
        { type: 'line', x: th.map((t) => a + Rr * Math.cos(t)), y: th.map((t) => Rr * Math.sin(t)), color: 'green', width: 2, label: 'круг сходимости', hover: false },
        { type: 'segments', x1: [a - Rr], y1: [0], x2: [a + Rr], y2: [0], color: 'green', width: 5, opacity: 0.8 },
        { type: 'points', x: F.poles.map((p) => p[0]), y: F.poles.map((p) => p[1]), color: 'pos', r: 6, label: 'особые точки ' + F.polesTxt },
        { type: 'points', x: [a], y: [0], color: 'model', r: 5, label: 'центр a' },
        { type: 'segments', x1: [a], y1: [0], x2: [0], y2: [F.poles[0][1]], color: 'ink2', width: 1.2, dash: '4 3', opacity: 0.9 },
      ], { x: [-lim * 1.25, lim * 1.25], y: [-lim, lim] });
      const xs = U.linspace(F.dom[0], F.dom[1], 500);
      const S = (x) => {
        let acc = 0;
        let p = 1;
        for (let k = 0; k <= s.n; k++) {
          acc += c[k] * p;
          p *= x - a;
        }
        return acc;
      };
      const clip = (v) => (Number.isFinite(v) && v > F.yd[0] - 3 && v < F.yd[1] + 3 ? v : NaN);
      pr.render([
        { type: 'vband', x0: a - Rr, x1: a + Rr, color: 'green', opacity: 0.08 },
        { type: 'line', x: xs, y: xs.map(F.f), color: 'model', width: 2.6, label: 'функция', hover: false },
        { type: 'line', x: xs, y: xs.map(S).map(clip), color: 'violet', width: 2, dash: '6 4', label: 'ряд Тейлора в a, степень ' + s.n, hover: false },
        { type: 'vline', x: a, color: 'ink2', dash: '3 3', width: 1 },
      ], { x: F.dom, y: F.yd });
      const est = Math.pow(Math.abs(c[s.n]) || 1e-300, -1 / s.n);
      st.set('R', f4(Rr));
      st.set('est', Math.abs(c[s.n]) < 1e-14 ? '—' : f3(est));
      st.set('iv', '(' + f3(a - Rr) + ', ' + f3(a + Rr) + ')');
      note.innerHTML = s.key === 'rat'
        ? 'R = √(a² + 1) — ровно расстояние от a до ±i. В нуле R = 1, при a = 2 уже ≈ 2.24. Внутри зелёного интервала многочлены прижимаются к функции, снаружи — разлетаются, хотя на самой прямой функции ничего не мешает. Оценка |cₙ|^(−1/n) — корневой признак (шаг 15) — подходит к R с ростом n.'
        : 'Логистические потери ln(1 + e^F) (урок 15.6) и сигмоида тоже имеют невидимые особенности: в точках F = ±iπ, ±3iπ, … знаменатель 1 + e^F обращается в ноль. Поэтому их ряд Тейлора в точке F₀ сходится только при |F − F₀| < √(F₀² + π²). При F₀ = 0 это π ≈ 3.14. XGBoost и шаг Ньютона берут лишь два члена этого ряда — и разумно доверять им только при небольших изменениях F (урок 15.7).';
    }
    w.pythonAction(() => {
      if (s.key === 'rat') return 'import numpy as np\n\na, n = ' + py(s.a) + ', ' + s.n + '\n# точные коэффициенты: 1/(1 + x²) = Im-часть ряда для 1/(x − i)\nc = [(-1)**k * (1 / (a - 1j) ** (k + 1)).imag for k in range(n + 1)]\nprint("радиус √(a² + 1) =", np.hypot(a, 1), "  оценка |c_n|^(−1/n) =", abs(c[n]) ** (-1 / n))\nfor x in (a + 0.5, a + 0.9 * np.hypot(a, 1), a + 1.2 * np.hypot(a, 1)):\n    S = sum(ck * (x - a) ** k for k, ck in enumerate(c))\n    print(f"x = {x:.3f}: ряд {S:.6f}, функция {1 / (1 + x * x):.6f}")\n';
      return 'import numpy as np\n\nF0, n = ' + py(s.a) + ', ' + s.n + '\nR = np.hypot(F0, np.pi)\n# коэффициенты Тейлора по формуле Коши: c_k = среднее f(F0 + r e^{iθ}) e^{−ikθ} / r^k\ndef softplus(z):\n    return np.where(z.real <= 0, np.log1p(np.exp(z)), z + np.log1p(np.exp(-z)))\nr, N = 0.92 * R, 512\nth = 2 * np.pi * np.arange(N) / N\nc = (np.fft.fft(softplus(F0 + r * np.exp(1j * th))) / N).real[: n + 1] / r ** np.arange(n + 1)\nprint("радиус √(F0² + π²) =", R)\nfor d in (0.5 * R, 0.9 * R, 1.2 * R):\n    S = sum(ck * d**k for k, ck in enumerate(c))\n    print(f"ΔF = {d:.3f}: ряд {S:.6f}, функция {np.logaddexp(0, F0 + d):.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 24. Ряд Фурье: функции из волн
   * ============================================================================== */
  const FO = {
    square: { label: 'ступенька (меандр)', f: (x) => (x > 0 ? 1 : x < 0 ? -1 : 0), term: (j) => ({ k: 2 * j + 1, b: 4 / (PI * (2 * j + 1)), kind: 'sin' }), a0: 0, yd: [-1.6, 1.6], jump: true, tex: R`\frac{4}{\pi}\Bigl(\sin x+\frac{\sin 3x}{3}+\frac{\sin 5x}{5}+\dots\Bigr)`, decay: '1/k' },
    saw: { label: 'пила f(x) = x', f: (x) => x, term: (j) => ({ k: j + 1, b: (2 * sgn(j + 1)) / (j + 1), kind: 'sin' }), a0: 0, yd: [-4.2, 4.2], jump: true, tex: R`2\Bigl(\sin x-\frac{\sin 2x}{2}+\frac{\sin 3x}{3}-\dots\Bigr)`, decay: '1/k' },
    tri: { label: 'треугольник f(x) = |x|', f: Math.abs, term: (j) => ({ k: 2 * j + 1, b: -4 / (PI * (2 * j + 1) * (2 * j + 1)), kind: 'cos' }), a0: PI / 2, yd: [-0.4, 3.6], jump: false, tex: R`\frac{\pi}{2}-\frac{4}{\pi}\Bigl(\cos x+\frac{\cos 3x}{9}+\frac{\cos 5x}{25}+\dots\Bigr)`, decay: '1/k²' },
  };
  GBC.widget('fourier', (el) => {
    const s = { key: 'square', N: 3 };
    const NM = 40;
    const w = ui.shell(el, { title: 'Ряд Фурье: функция из синусов и косинусов', sub: 'Периодическую функцию складываем из волн разной частоты. Каждая новая волна исправляет ошибку суммы предыдущих — как каждое дерево бустинга. Сверху — функция и сумма N волн, снизу — амплитуды волн.' });
    ui.select(w.controls, { label: 'Функция (период 2π)', value: s.key, options: Object.entries(FO).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.player(w.controls, { label: 'Волн N', min: 1, max: NM, value: s.N, fps: 3, format: (v) => 'N = ' + v, onChange: (v) => ((s.N = v), draw()) });
    const tx = H('div', { style: 'margin:2px 0 6px' });
    w.main.appendChild(tx);
    const p1 = new GBC.Plot(w.main, { height: 270, x: { label: 'x', domain: [-PI, PI] }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 180, x: { label: 'частота k', domain: [0, 2 * NM + 1] }, y: { label: '|амплитуда|' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'mx', label: 'максимум суммы' }, { key: 'rms', label: 'ср.-кв. ошибка' }, { key: 'sup', label: 'наибольшая ошибка вдали от скачка' }]);
    function draw() {
      const F = FO[s.key];
      texInto(tx, 'f(x)=' + F.tex, true);
      const xs = U.linspace(-PI, PI, 1601);
      const terms = U.range(s.N).map(F.term);
      const S = (x) => {
        let acc = F.a0;
        for (const t of terms) acc += t.b * (t.kind === 'sin' ? Math.sin(t.k * x) : Math.cos(t.k * x));
        return acc;
      };
      const ys = xs.map(S);
      const fv = xs.map((x) => (F.jump && Math.abs(x) < 1e-12 ? NaN : F.f(x)));
      p1.render([
        { type: 'line', x: xs, y: fv, color: 'truth', width: 2, dash: '6 4', label: 'функция', hover: false },
        { type: 'line', x: xs, y: ys, color: 'model', width: 2.2, label: 'сумма ' + s.N + ' волн', hover: false },
        F.jump && s.key === 'square' ? { type: 'hline', y: 1.179, color: 'pos', dash: '2 3', width: 1, text: '1.179' } : null,
      ], { y: F.yd });
      const all = U.range(NM).map(F.term);
      p2.render([
        { type: 'bars', x: all.map((t) => t.k), y: all.map((t) => Math.abs(t.b)), color: (i) => (i < s.N ? 'model' : 'grid'), width: 0.8, maxPx: 8, tooltip: (i) => [['частота', String(all[i].k)], ['амплитуда', f4(all[i].b)]] },
      ]);
      let mse = 0;
      let sup = 0;
      xs.forEach((x, i) => {
        if (!Number.isFinite(fv[i])) return;
        const e = ys[i] - fv[i];
        mse += e * e;
        if (Math.abs(x) > 0.5 && Math.abs(x) < PI - 0.5) sup = Math.max(sup, Math.abs(e));
      });
      st.set('mx', f4(Math.max(...ys)));
      st.set('rms', f4(Math.sqrt(mse / xs.length)));
      st.set('sup', f4(sup));
      note.innerHTML = F.jump
        ? 'Амплитуды убывают как ' + F.decay + ' — медленно, потому что у функции есть скачок. Вдали от скачка ошибка уменьшается, а у самого скачка остаётся «рожок»: сумма перелетает на ≈ 9 % высоты скачка' + (s.key === 'square' ? ' (максимум ≈ 1.179 вместо 1)' : '') + ' при любом N — <b>явление Гиббса</b>. Ряд сходится в каждой точке, но не равномерно: самая большая ошибка не стремится к нулю, она лишь сжимается к скачку. Гладкими волнами трудно нарисовать ступеньку — а бустинг, наоборот, рисует гладкое ступеньками (урок 15.4).'
        : 'Функция непрерывна (излом без скачка), поэтому амплитуды убывают как 1/k² — быстро, и сумма приближает функцию равномерно: уже ' + s.N + ' волн дают наибольшую ошибку ' + f4(sup) + '. Чем глаже функция, тем быстрее убывают коэффициенты и тем меньше членов нужно.';
    }
    w.pythonAction(() => {
      const map = { square: ['np.sign(x)', '4 / (np.pi * k) * np.sin(k * x) for k in range(1, 2 * N, 2)', '0'], saw: ['x', '2 * (-1) ** (k + 1) / k * np.sin(k * x) for k in range(1, N + 1)', '0'], tri: ['np.abs(x)', '-4 / (np.pi * k**2) * np.cos(k * x) for k in range(1, 2 * N, 2)', 'np.pi / 2'] }[s.key];
      return 'import numpy as np\n\nN = ' + s.N + '\nx = np.linspace(-np.pi, np.pi, 4001)\nS = ' + map[2] + ' + sum(' + map[1] + ')\nf = ' + map[0] + '\nprint("максимум суммы:", S.max())\nprint("ср.-кв. ошибка:", np.sqrt(np.mean((S - f) ** 2)))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 25. Равенство Парсеваля и снова задача Базеля
   * ============================================================================== */
  GBC.widget('parseval', (el) => {
    const s = { key: 'saw', N: 5 };
    const NM = 60;
    const w = ui.shell(el, { title: 'Энергия функции = сумма квадратов амплитуд', sub: 'Равенство Парсеваля: средний квадрат функции раскладывается по волнам, (1/π)∫f² dx = Σ bₖ². Столбики — вклады волн bₖ², кривая — накопленная сумма, пунктир — вся «энергия» функции. Из этого равенства для пилы следует Σ 1/k² = π²/6.' });
    ui.segmented(w.controls, { label: 'Функция', value: s.key, options: [{ value: 'saw', label: 'пила x → π²/6' }, { value: 'square', label: 'меандр → π²/8' }], onChange: (v) => ((s.key = v), draw()) });
    ui.player(w.controls, { label: 'Волн N', min: 1, max: NM, value: s.N, fps: 4, format: (v) => 'N = ' + v, onChange: (v) => ((s.N = v), draw()) });
    const tx = H('div', { style: 'margin:2px 0 6px' });
    w.main.appendChild(tx);
    const plot = new GBC.Plot(w.main, { height: 270, x: { label: 'номер волны', domain: [0.3, NM + 0.7] }, y: { label: 'энергия' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'S', label: 'Σ bₖ² (N волн)' }, { key: 'E', label: '(1/π)∫f²' }, { key: 'est', label: 'оценка константы' }, { key: 'tr', label: 'точно' }]);
    function draw() {
      const saw = s.key === 'saw';
      const b2 = (j) => (saw ? 4 / (j * j) : 16 / (PI * PI * (2 * j - 1) * (2 * j - 1)));
      const E = saw ? (2 * PI * PI) / 3 : 2;
      const js = U.range(NM, 1);
      const cum = psums(b2, NM);
      texInto(tx, saw ? R`\frac1\pi\int_{-\pi}^{\pi}x^2\,dx=\frac{2\pi^2}{3}=\sum_{k=1}^\infty\Bigl(\frac{2}{k}\Bigr)^2=4\sum_{k=1}^\infty\frac1{k^2}\;\Rightarrow\;\sum_{k=1}^\infty\frac1{k^2}=\frac{\pi^2}{6}` : R`\frac1\pi\int_{-\pi}^{\pi}1\,dx=2=\sum_{j\ge0}\frac{16}{\pi^2(2j+1)^2}\;\Rightarrow\;\sum_{j\ge0}\frac1{(2j+1)^2}=\frac{\pi^2}{8}`, true);
      plot.render([
        { type: 'hline', y: E, color: 'tree', dash: '6 4', text: 'вся энергия ' + f4(E) },
        { type: 'bars', x: js, y: js.map(b2), color: (i) => (i < s.N ? 'model' : 'grid'), width: 0.7, maxPx: 10, label: 'вклад волны bₖ²', legendColor: 'model' },
        { type: 'line', x: js.slice(0, s.N), y: cum.slice(0, s.N), color: 'violet', width: 2.2, label: 'накопленная сумма', hover: false },
        { type: 'points', x: js.slice(0, s.N), y: cum.slice(0, s.N), color: 'violet', r: 3, tooltip: (i) => [['N', String(i + 1)], ['Σ', f6(cum[i])]] },
      ], { x: [0.3, Math.max(15, Math.ceil(s.N * 1.6)) + 0.7], y: [0, E * 1.1] });
      const part = cum[s.N - 1];
      const est = saw ? part / 4 : (part * PI * PI) / 16;
      st.set('S', f6(part));
      st.set('E', f6(E));
      st.set('est', f6(est));
      st.set('tr', saw ? 'π²/6 = ' + f6((PI * PI) / 6) : 'π²/8 = ' + f6((PI * PI) / 8));
      note.innerHTML = 'Первые ' + s.N + ' ' + plural(s.N, 'волна несёт', 'волны несут', 'волн несут') + ' ' + U.fmt((100 * part) / E, 1) + ' % энергии. ' + (saw ? 'Разделив накопленную сумму на 4, получаем частичную сумму ряда Базеля 1 + 1/4 + 1/9 + … — Эйлер нашёл π²/6 иначе, но ряды Фурье дают самое короткое доказательство.' : 'У меандра энергия сосредоточена в первой волне (≈ 81 %), а остаток убывает медленно — как и сами амплитуды 1/k.') + ' Сумма квадратов коэффициентов — та же идея, что «доля объяснённой дисперсии» в машинном обучении.';
    }
    draw();
  });

  /* ==============================================================================
   * Общие данные для шагов 26–27: волна с шумом (как в data/wave.csv)
   * ============================================================================== */
  let WAVE = null;
  function wave() {
    if (WAVE) return WAVE;
    const d = GBC.datasets.regression1d({ kind: 'wave', n: 160, noise: 0.45, seed: 11 });
    const sp = GBC.datasets.trainTestSplit(d.X, d.y, 0.5, 3);
    WAVE = { sp, grid: U.linspace(0, 10, 300).map((x) => [x]), mse: (F, y) => U.mean(y.map((v, i) => (v - F[i]) ** 2)) };
    return WAVE;
  }

  /* ==============================================================================
   * Шаг 26. Модель бустинга — частичная сумма ряда из деревьев
   * ============================================================================== */
  GBC.widget('boosting-series', (el) => {
    const W = wave();
    const sp = W.sp;
    const s = { lr: 0.1, m: 10 };
    const M = 300;
    const fits = {};
    function fit(lr) {
      if (fits[lr]) return fits[lr];
      const model = new GBC.GradientBoosting({ nEstimators: M, learningRate: lr, maxDepth: 2 }).fit(sp.Xtrain, sp.ytrain);
      const ctr = new GBC.StageCache(model, sp.Xtrain);
      const cte = new GBC.StageCache(model, sp.Xtest);
      const tr = [];
      const te = [];
      const size = [];
      for (let m = 0; m <= M; m++) {
        tr.push(W.mse(ctr.seek(m), sp.ytrain));
        te.push(W.mse(cte.seek(m), sp.ytest));
        if (m > 0) size.push(lr * U.mean(sp.Xtrain.map((x) => Math.abs(model.trees[m - 1][0].predictOne(x)))));
      }
      let best = 0;
      te.forEach((v, i) => (v < te[best] ? (best = i) : null));
      return (fits[lr] = { model, cg: new GBC.StageCache(model, W.grid), tr, te, size, best });
    }
    const w = ui.shell(el, { title: 'Модель бустинга — частичная сумма ряда', sub: 'Модель после M деревьев: F₀ + ν·h₁(x) + ν·h₂(x) + … (M членов). Каждое дерево — член ряда (оранжевый график — последний член). Нажмите ▶: члены мельчают, ошибка на обучении падает, а на новых данных после некоторого M начинает расти.' });
    ui.slider(w.controls, { label: 'Темп ν', values: [0.03, 0.1, 0.3, 1], value: s.lr, format: (v) => String(v), onInput: (v) => ((s.lr = v), draw()) });
    const pl = ui.player(w.controls, { label: 'Членов ряда M', min: 0, max: M, value: s.m, fps: 12, format: (v) => 'M = ' + v, onChange: (v) => ((s.m = v), draw()) });
    ui.button(w.controls, { label: 'К лучшему M', icon: 'step', onClick: () => (pl.stop(), (s.m = fit(s.lr).best), pl.set(s.m), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 130, x: { label: 'x', domain: [0, 10] }, y: { label: 'член ν·h_M(x)' } });
    const p3 = new GBC.Plot(w.main, { height: 200, x: { label: 'номер члена m (лог.)', type: 'log', domain: [1, M], ticks: [1, 3, 10, 30, 100, 300] }, y: { label: 'средний |ν·h_m|', type: 'log' } });
    const p4 = new GBC.Plot(w.main, { height: 220, x: { label: 'M', domain: [0, M] }, y: { label: 'MSE' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'M' }, { key: 'tr', label: 'MSE обучение' }, { key: 'te', label: 'MSE новые данные' }, { key: 'b', label: 'лучшее M' }]);
    function draw() {
      const R0 = fit(s.lr);
      const gx = W.grid.map((r) => r[0]);
      const Fprev = s.m > 0 ? Array.from(R0.cg.seek(s.m - 1)) : null;
      const F = Array.from(R0.cg.seek(s.m));
      p1.render([
        { type: 'points', x: sp.Xtrain.map((r) => r[0]), y: sp.ytrain, color: 'data', r: 3, label: 'обучение' },
        Fprev ? { type: 'line', x: gx, y: Fprev, color: 'model-prev', width: 2, label: 'F_{M−1}', hover: false } : null,
        { type: 'line', x: gx, y: F, color: 'model', width: 2.4, label: 'F_M', hover: false },
      ], { y: [-1.5, 5.5] });
      const term = s.m > 0 ? gx.map((x) => R0.model.learningRate * R0.model.trees[s.m - 1][0].predictOne([x])) : gx.map(() => 0);
      const tmax = Math.max(0.05, ...term.map(Math.abs));
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: gx, y: term, color: 'tree', width: 2.2, curve: 'step', hover: false },
      ], { y: [-tmax * 1.15, tmax * 1.15] });
      const ms = U.range(M, 1);
      const sizes = R0.size.map((v) => Math.max(v, 1e-7));
      const ax = logAxis(Math.min(...sizes), Math.max(...sizes));
      p3.opts.y.ticks = ax.ticks;
      p3.opts.y.format = powFmt;
      p3.render([
        { type: 'line', x: ms, y: sizes, color: 'tree', width: 1.6, hover: false },
        s.m > 0 ? { type: 'points', x: [s.m], y: [sizes[s.m - 1]], color: 'tree', r: 5 } : null,
      ], { y: ax.domain });
      const ks = U.range(M + 1);
      p4.render([
        { type: 'line', x: ks, y: R0.tr, color: 'train', width: 2, label: 'обучение' },
        { type: 'line', x: ks, y: R0.te, color: 'valid', width: 2, label: 'новые данные' },
        { type: 'vline', x: R0.best, color: 'ink2', dash: '4 4', width: 1, text: 'минимум' },
        { type: 'vline', x: s.m, color: 'model', width: 1.2 },
      ], { y: [0, 1.4] });
      st.set('m', String(s.m));
      st.set('tr', f4(R0.tr[s.m]));
      st.set('te', f4(R0.te[s.m]));
      st.set('b', R0.best + ' (MSE ' + f4(R0.te[R0.best]) + ')');
      note.innerHTML = 'Члены ряда в среднем убывают (график размеров, обе оси логарифмические), и на обучающих данных ряд «сходится» — к подгонке под шум: MSE обучения → 0. На новых данных лучшая частичная сумма — при M = ' + R0.best + '; дальше члены добавляют в основном шум. Поэтому ряд бустинга <b>обрывают</b>: это ранняя остановка (урок 7.1). ' + (s.lr === 1 ? 'При ν = 1 первые члены крупные, ряд «перепрыгивает» хорошую модель: лучшее MSE хуже, чем при малом ν.' : '');
    }
    w.pythonAction(() => 'import sys, numpy as np\nfrom gbcourse import datasets\nfrom gbcourse.boosting import GBRegressor\n\nX, y = datasets.regression_1d(kind="wave", n=160, noise=0.45, seed=11)\nXtr, Xte, ytr, yte = datasets.train_test_split(X, y, test_size=0.5, seed=3)\nmodel = GBRegressor(n_estimators=300, learning_rate=' + s.lr + ', max_depth=2).fit(Xtr, ytr)\nte = [np.mean((yte - model.predict(Xte, n_iter=m)) ** 2) for m in range(301)]\nbest = int(np.argmin(te))\nprint("лучшее M =", best, " MSE =", round(te[best], 4), "; при M = 300:", round(te[-1], 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 27. Темп и ранняя остановка: важно произведение ν·M
   * ============================================================================== */
  GBC.widget('nu-compare', (el) => {
    const W = wave();
    const sp = W.sp;
    const NUS = [0.03, 0.1, 0.3, 1];
    const COL = ['violet', 'model', 'tree', 'pos'];
    const s = { axis: 'nuM' };
    let R0 = null;
    function compute() {
      return NUS.map((nu) => {
        const M = Math.ceil(12 / nu);
        const model = new GBC.GradientBoosting({ nEstimators: M, learningRate: nu, maxDepth: 2 }).fit(sp.Xtrain, sp.ytrain);
        const cte = new GBC.StageCache(model, sp.Xtest);
        const te = [];
        for (let m = 0; m <= M; m++) te.push(W.mse(cte.seek(m), sp.ytest));
        let best = 0;
        te.forEach((v, i) => (v < te[best] ? (best = i) : null));
        return { nu, M, te, best };
      });
    }
    const w = ui.shell(el, { foot: false, title: 'Четыре темпа — одна кривая', sub: 'Ошибка на новых данных для ν = 0.03, 0.1, 0.3 и 1. По оси M кривые совсем разные. Переключите ось на ν·M — «сколько всего шагов сделано»: при малых ν кривые почти совпадают. Мелкий шаг ν делает ряд длиннее, но не меняет, куда он идёт.' });
    ui.segmented(w.controls, { label: 'Ось X', value: s.axis, options: [{ value: 'M', label: 'число деревьев M' }, { value: 'nuM', label: 'произведение ν·M' }], onChange: (v) => ((s.axis = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'ν·M' }, y: { label: 'MSE на новых данных', domain: [0.15, 0.6] } });
    const tb = H('div');
    w.main.appendChild(tb);
    const note = w.note('', true);
    function draw() {
      if (!R0) R0 = compute();
      const L = [];
      R0.forEach((r, i) => {
        const xs = U.range(r.M + 1).map((m) => (s.axis === 'M' ? m : r.nu * m));
        L.push({ type: 'line', x: xs, y: r.te, color: COL[i], width: 2.2, label: 'ν = ' + r.nu, hover: false });
        L.push({ type: 'points', x: [xs[r.best]], y: [r.te[r.best]], color: COL[i], r: 5.5, tooltip: () => [['ν', String(r.nu)], ['лучшее M', String(r.best)], ['ν·M', f3(r.nu * r.best)], ['MSE', f4(r.te[r.best])]] });
      });
      plot.opts.x.label = s.axis === 'M' ? 'число деревьев M' : 'ν·M';
      plot.render(L, { x: s.axis === 'M' ? [0, 400] : [0, 12] });
      const t2 = (v) => v.toFixed(2);
      const t4 = (v) => v.toFixed(4);
      rowTable(tb, ['ν', 'лучшее M', 'ν·M', 'MSE'], R0.map((r) => [String(r.nu), String(r.best), t2(r.nu * r.best), t4(r.te[r.best])]));
      note.innerHTML = 'Лучшее M обратно пропорционально ν: ν·M ≈ ' + R0.slice(0, 3).map((r) => t2(r.nu * r.best)).join(', ') + ' — как у бустинга одного числа, где число шагов до цели ≈ 4.6/ν (шаг 10). Лучшая ошибка при ν ≤ 0.3 почти одинакова (' + R0.slice(0, 3).map((r) => t4(r.te[r.best])).join(', ') + '), а ν = 1 проигрывает (' + t4(R0[3].te[R0[3].best]) + '): слишком крупные члены ряда «перескакивают» хорошую модель. Практический вывод: уменьшили ν в k раз — увеличьте число деревьев примерно в k раз (урок 4.2).';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse import datasets\nfrom gbcourse.boosting import GBRegressor\n\nX, y = datasets.regression_1d(kind="wave", n=160, noise=0.45, seed=11)\nXtr, Xte, ytr, yte = datasets.train_test_split(X, y, test_size=0.5, seed=3)\nfor nu in (0.03, 0.1, 0.3, 1.0):\n    M = int(np.ceil(12 / nu))\n    model = GBRegressor(n_estimators=M, learning_rate=nu, max_depth=2).fit(Xtr, ytr)\n    te = [np.mean((yte - model.predict(Xte, n_iter=m)) ** 2) for m in range(M + 1)]\n    best = int(np.argmin(te))\n    print(f"ν = {nu}: лучшее M = {best}, ν·M = {nu * best:.2f}, MSE = {te[best]:.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 28. Экспоненциальное среднее и моментум: веса — геометрический ряд
   * ============================================================================== */
  GBC.widget('ema-weights', (el) => {
    const s = { beta: 0.9, t: 20, fix: true };
    const TM = 100;
    const MU = 2;
    const rng = new GBC.RNG(3);
    const g = U.range(TM).map(() => rng.normal(MU, 1));
    const w = ui.shell(el, { title: 'Экспоненциальное среднее: веса прошлого — геометрический ряд', sub: 'mₜ = β·mₜ₋₁ + (1 − β)·gₜ, m₀ = 0. Раскрыв рекурсию, получаем mₜ = Σ (1 − β)βʲ·gₜ₋ⱼ: свежему наблюдению — вес 1 − β, каждому более старому — в β раз меньше. Так усредняют градиенты в моментуме и Adam.' });
    ui.slider(w.controls, { label: 'Коэффициент β', values: [0.5, 0.8, 0.9, 0.95, 0.99], value: s.beta, format: (v) => String(v), onInput: (v) => ((s.beta = v), draw()) });
    ui.player(w.controls, { label: 'Момент t', min: 1, max: TM, value: s.t, fps: 6, format: (v) => 't = ' + v, onChange: (v) => ((s.t = v), draw()) });
    ui.toggle(w.controls, { label: 'Поправка на смещение mₜ/(1 − βᵗ)', checked: s.fix, onChange: (v) => ((s.fix = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 190, x: { label: 'момент наблюдения j', domain: [0.3, TM + 0.7] }, y: { label: 'вес в m_t' } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 't', domain: [0, TM + 1] }, y: { label: 'значение', domain: [-1, 5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'W', label: 'сумма весов 1 − βᵗ' }, { key: 'win', label: '«окно» 1/(1 − β)' }, { key: 'm', label: 'mₜ' }, { key: 'mh', label: 'mₜ/(1 − βᵗ)' }]);
    function draw() {
      const b = s.beta;
      const js = U.range(TM, 1);
      const wts = js.map((j) => (j <= s.t ? (1 - b) * Math.pow(b, s.t - j) : 0));
      p1.render([
        { type: 'bars', x: js, y: wts, color: (i) => (i < s.t ? 'model' : 'grid'), width: 0.8, maxPx: 10, tooltip: (i) => [['j', String(i + 1)], ['вес', f4(wts[i])]] },
      ], { y: [0, Math.max(0.02, 1 - b) * 1.1] });
      const m = [];
      let acc = 0;
      for (let t = 1; t <= TM; t++) m.push((acc = b * acc + (1 - b) * g[t - 1]));
      const mh = m.map((v, i) => v / (1 - Math.pow(b, i + 1)));
      const ts = U.range(TM, 1);
      p2.render([
        { type: 'hline', y: MU, color: 'truth', dash: '6 4', text: 'истинное среднее 2' },
        { type: 'points', x: ts, y: g, color: 'data', r: 2.6, label: 'наблюдения gₜ' },
        { type: 'line', x: ts, y: m, color: 'model', width: 2, opacity: s.fix ? 0.45 : 1, label: 'mₜ', hover: false },
        s.fix ? { type: 'line', x: ts, y: mh, color: 'tree', width: 2.2, label: 'mₜ/(1 − βᵗ)', hover: false } : null,
        { type: 'vline', x: s.t, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      const W = 1 - Math.pow(b, s.t);
      st.set('W', f4(W));
      st.set('win', U.fmt(1 / (1 - b), 1));
      st.set('m', f4(m[s.t - 1]));
      st.set('mh', f4(mh[s.t - 1]));
      note.innerHTML = 'Веса — геометрическая прогрессия, и их сумма за t шагов — конечный геометрический ряд: (1 − β)(1 + β + … + βᵗ⁻¹) = <b>1 − βᵗ = ' + f4(W) + '</b>. Пока t мало, сумма весов меньше 1, и mₜ занижено (начали с нуля). Деление на 1 − βᵗ — поправка Adam — делает веса суммой 1. Со временем βᵗ → 0, вся сумма весов → 1, а «эффективное окно» — около 1/(1 − β) = ' + U.fmt(1 / (1 - b), 1) + ' последних наблюдений. Моментум: при постоянном градиенте скорость vₜ = βvₜ₋₁ + g → g/(1 − β), то есть шаг увеличивается в ' + U.fmt(1 / (1 - b), 1) + ' раза.';
    }
    w.pythonAction(() => 'from gbcourse.rng import Mulberry32\n\nbeta, T = ' + s.beta + ', ' + s.t + '\nrng = Mulberry32(3)\ng = [rng.normal(2, 1) for _ in range(100)]\nm = 0.0\nfor t in range(1, T + 1):\n    m = beta * m + (1 - beta) * g[t - 1]\nprint("m_t =", m, "  с поправкой:", m / (1 - beta**T))\nprint("сумма весов 1 − β^t =", 1 - beta**T, " = ряд:", sum((1 - beta) * beta**j for j in range(T)))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 29. Расписания темпа: условия Роббинса — Монро
   * ============================================================================== */
  const SCH = {
    const: { label: 'постоянный ν = 0.05', nu: () => 0.05, color: 'tree', py: '0.05' },
    inv: { label: 'νₖ = 1/k', nu: (k) => 1 / k, color: 'model', py: '1 / k' },
    pow: { label: 'νₖ = 1/k^{0.6}', nu: (k) => Math.pow(k, -0.6), color: 'aqua', py: 'k ** -0.6' },
    sq: { label: 'νₖ = 1/k²', nu: (k) => 1 / (k * k), color: 'pos', py: '1 / k**2' },
  };
  GBC.widget('robbins-monro', (el) => {
    const s = { show: 'all', seed: 1 };
    const K = 2000;
    const MU = 2;
    const w = ui.shell(el, { title: 'Стохастический градиентный спуск: какой темп выбрать', sub: 'Оцениваем среднее μ = 2 по шумным наблюдениям yₖ ~ N(2, 1): θₖ = θₖ₋₁ + νₖ(yₖ − θₖ₋₁), θ₀ = 0. Это градиентный шаг для потерь ½(θ − y)² с шумным градиентом. Чтобы дойти до цели, сумма шагов Σνₖ должна быть бесконечной; чтобы шум затих — шаги должны убывать.' });
    ui.select(w.controls, { label: 'Расписание', value: s.show, options: [{ value: 'all', label: 'все четыре' }].concat(Object.entries(SCH).map(([k, v]) => ({ value: k, label: v.label.replace(/[{}]/g, '') }))), onChange: (v) => ((s.show = v), draw()) });
    ui.slider(w.controls, { label: 'Зерно шума', min: 1, max: 20, step: 1, value: s.seed, format: (v) => String(v), onInput: (v) => ((s.seed = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 280, x: { label: 'шаг k (лог.)', type: 'log', domain: [1, K], ticks: [1, 10, 100, 1000] }, y: { label: 'оценка θ_k', domain: [-0.5, 4.5] } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'шаг k (лог.)', type: 'log', domain: [1, K], ticks: [1, 10, 100, 1000] }, y: { label: 'Σ ν_k до k (лог.)', type: 'log', domain: [0.04, 200], ticks: [0.1, 1, 10, 100] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, Object.entries(SCH).map(([k, v]) => ({ key: k, label: 'θ − μ: ' + v.label.replace('постоянный ', '') })));
    function draw() {
      const rng = new GBC.RNG(s.seed);
      const ys = U.range(K).map(() => rng.normal(MU, 1));
      const ks = U.range(K, 1);
      const pick = ks.filter((k) => k <= 100 || k % Math.ceil(k / 100) === 0);
      const L1 = [{ type: 'hline', y: MU, color: 'truth', dash: '6 4', text: 'μ = 2' }];
      const L2 = [];
      Object.entries(SCH).forEach(([key, S]) => {
        let th = 0;
        let cum = 0;
        const path = [];
        const cs = [];
        for (let k = 1; k <= K; k++) {
          const nu = S.nu(k);
          th += nu * (ys[k - 1] - th);
          cum += nu;
          path.push(th);
          cs.push(cum);
        }
        st.set(key, (path[K - 1] - MU >= 0 ? '+' : '') + f4(path[K - 1] - MU));
        const on = s.show === 'all' || s.show === key;
        if (!on) return;
        L1.push({ type: 'line', x: pick, y: pick.map((k) => path[k - 1]), color: S.color, width: 2, label: S.label, hover: false });
        L2.push({ type: 'line', x: pick, y: pick.map((k) => cs[k - 1]), color: S.color, width: 2, label: S.label, hover: false });
      });
      p1.render(L1);
      p2.render(L2);
      note.innerHTML = '<b>νₖ = 1/k</b> — ровно бегущее среднее: θₖ = (y₁ + … + yₖ)/k; ошибка ≈ 1/√k (за 2000 шагов ≈ 0.02). Здесь Σνₖ = Hₖ → ∞ (гармонический ряд!), а Σνₖ² = Σ1/k² < ∞. <b>Постоянный темп</b>: быстро приходит, но вечно дрожит — разброс √(ν/(2 − ν)) ≈ 0.16 не убывает (сумма геометрического ряда весов шума). <b>1/k^0.6</b> — компромисс: Σνₖ = ∞, шум затухает медленнее, чем у 1/k. <b>1/k²</b>: Σνₖ = π²/6 — конечна (p-ряд с p = 2), и алгоритм «застывает»: поздние наблюдения почти не влияют, ошибка первых шагов остаётся навсегда (разброс ≈ 0.54). Отсюда классические условия Роббинса и Монро (1951): Σνₖ = ∞ и Σνₖ² < ∞.';
    }
    w.pythonAction(() => 'from gbcourse.rng import Mulberry32\n\nrng = Mulberry32(' + s.seed + ')\nys = [rng.normal(2.0, 1.0) for _ in range(2000)]\nschedules = {"const": lambda k: 0.05, "1/k": lambda k: 1 / k, "1/k^0.6": lambda k: k**-0.6, "1/k²": lambda k: 1 / k**2}\nfor name, nu in schedules.items():\n    th = 0.0\n    for k, y in enumerate(ys, start=1):\n        th += nu(k) * (y - th)\n    print(f"{name:8}: θ − μ = {th - 2:+.4f},  Σν = {sum(nu(k) for k in range(1, 2001)):.3f}")\nprint("бегущее среднее − μ:", sum(ys) / len(ys) - 2)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 30. L2-бустинг со сглаживателем: матричный геометрический ряд
   * ============================================================================== */
  GBC.widget('spectral-boost', (el) => {
    const n = 64;
    const s = { nu: 0.1, b: 2, M: 30 };
    const MM = 400;
    const xg = U.range(n).map((j) => (2 * PI * j) / n);
    const truth = xg.map((x) => Math.sin(x) + 0.5 * Math.sin(3 * x));
    const rng = new GBC.RNG(5);
    const y = truth.map((v) => v + rng.normal(0, 0.5));
    // ДПФ данных и истины (O(n²) — n = 64)
    const dft = (v) => U.range(n).map((k) => {
      let re = 0;
      let im = 0;
      for (let j = 0; j < n; j++) {
        const a = (2 * PI * j * k) / n;
        re += v[j] * Math.cos(a);
        im -= v[j] * Math.sin(a);
      }
      return [re, im];
    });
    const Y = dft(y);
    const Ft = dft(truth);
    const w = ui.shell(el, { title: 'Бустинг со сглаживателем = геометрический ряд для каждой частоты', sub: 'Вместо деревьев — сглаживатель S (скользящее среднее с гауссовыми весами). Шаг: Fₘ = Fₘ₋₁ + ν·S(y − Fₘ₋₁). Для волны частоты k сглаживатель — просто множитель λₖ ∈ [0, 1], и после M шагов подогнана доля 1 − (1 − νλₖ)ᴹ — частичная сумма геометрического ряда. Низкие частоты (сигнал) подгоняются быстро, высокие (шум) — медленно.' });
    ui.slider(w.controls, { label: 'Темп ν', values: [0.1, 0.3, 1], value: s.nu, format: (v) => String(v), onInput: (v) => ((s.nu = v), draw()) });
    ui.slider(w.controls, { label: 'Ширина сглаживания (точек)', values: [1, 1.5, 2, 3, 4], value: s.b, format: (v) => String(v), onInput: (v) => ((s.b = v), draw()) });
    const pl = ui.player(w.controls, { label: 'Шагов M', min: 0, max: MM, value: s.M, fps: 15, format: (v) => 'M = ' + v, onChange: (v) => ((s.M = v), draw()) });
    ui.button(w.controls, { label: 'К лучшему M', icon: 'step', onClick: () => (pl.stop(), (s.M = cur.best), pl.set(s.M), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x', domain: [0, 2 * PI] }, y: { label: 'y', domain: [-2.6, 2.6] } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: 'частота k', domain: [-0.6, 32.6] }, y: { label: 'доля подогнанного', domain: [0, 1.05] } });
    const p3 = new GBC.Plot(w.main, { height: 210, x: { label: 'шагов M (лог.)', type: 'log', domain: [1, MM], ticks: [1, 3, 10, 30, 100, 400] }, y: { label: 'MSE' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'ошибка до истины' }, { key: 'tr', label: 'MSE обучения' }, { key: 'b', label: 'лучшее M' }, { key: 'l', label: 'λ₁, λ₃, λ₁₀' }]);
    let cur = { key: null };
    function prepare() {
      const key = s.nu + ':' + s.b;
      if (cur.key === key) return cur;
      const wts = U.range(n).map((j) => {
        const d = Math.min(j, n - j);
        return Math.exp((-d * d) / (2 * s.b * s.b));
      });
      const sw = U.sum(wts);
      const lam = U.range(n).map((k) => {
        let v = 0;
        for (let j = 0; j < n; j++) v += (wts[j] / sw) * Math.cos((2 * PI * k * j) / n);
        return v;
      });
      const errAt = (M) => {
        let e = 0;
        let t = 0;
        for (let k = 0; k < n; k++) {
          const ph = 1 - Math.pow(1 - s.nu * lam[k], M);
          const dr = ph * Y[k][0] - Ft[k][0];
          const di = ph * Y[k][1] - Ft[k][1];
          e += dr * dr + di * di;
          const rr = (1 - ph) * Y[k][0];
          const ri = (1 - ph) * Y[k][1];
          t += rr * rr + ri * ri;
        }
        return [e / (n * n), t / (n * n)];
      };
      const errs = U.range(MM + 1).map(errAt);
      let best = 0;
      errs.forEach((e, i) => (e[0] < errs[best][0] ? (best = i) : null));
      cur = { key, lam, errs, best };
      return cur;
    }
    function draw() {
      const C = prepare();
      const phi = C.lam.map((l) => 1 - Math.pow(1 - s.nu * l, s.M));
      const F = U.range(n).map((j) => {
        let v = 0;
        for (let k = 0; k < n; k++) {
          const a = (2 * PI * j * k) / n;
          v += phi[k] * (Y[k][0] * Math.cos(a) - Y[k][1] * Math.sin(a));
        }
        return v / n;
      });
      const xc = xg.concat([2 * PI]);
      p1.render([
        { type: 'points', x: xg, y, color: 'data', r: 3, label: 'данные' },
        { type: 'line', x: xc, y: truth.concat([truth[0]]), color: 'truth', width: 2, dash: '6 4', label: 'истина', hover: false },
        { type: 'line', x: xc, y: F.concat([F[0]]), color: 'model', width: 2.4, label: 'F_M', hover: false },
      ]);
      const ks = U.range(33);
      p2.render([
        { type: 'bars', x: ks, y: ks.map((k) => phi[k]), color: (i) => (i === 1 || i === 3 ? 'tree' : 'model'), width: 0.75, maxPx: 12, tooltip: (i) => [['k', String(i)], ['λₖ', f4(C.lam[i])], ['подогнано', f3(phi[i])]] },
        { type: 'line', x: ks, y: ks.map((k) => C.lam[k]), color: 'muted', width: 1.4, dash: '4 3', label: 'λₖ (один шаг при ν = 1)', hover: false },
      ]);
      const Ms = U.range(MM, 1);
      p3.render([
        { type: 'line', x: Ms, y: Ms.map((M) => C.errs[M][0]), color: 'valid', width: 2.2, label: 'ошибка до истины', hover: false },
        { type: 'line', x: Ms, y: Ms.map((M) => C.errs[M][1]), color: 'train', width: 2, label: 'MSE обучения', hover: false },
        { type: 'vline', x: Math.max(1, C.best), color: 'ink2', dash: '4 4', width: 1, text: 'лучшее' },
        s.M > 0 ? { type: 'vline', x: s.M, color: 'model', width: 1.2 } : null,
      ], { y: [0, 0.35] });
      st.set('e', f4(C.errs[s.M][0]));
      st.set('tr', f4(C.errs[s.M][1]));
      st.set('b', String(C.best) + ' (' + f4(C.errs[C.best][0]) + ')');
      st.set('l', [1, 3, 10].map((k) => U.fmt(C.lam[k], 3)).join(', '));
      note.innerHTML = 'Оранжевые столбики — частоты сигнала (k = 1 и 3). При M = ' + s.M + ' они подогнаны на ' + U.fmt(100 * phi[1], 0) + ' % и ' + U.fmt(100 * phi[3], 0) + ' %, а частота 10 — на ' + U.fmt(100 * phi[10], 0) + ' %. Шум «живёт» на всех частотах, поэтому лучшая остановка — когда сигнал уже подогнан, а высокие частоты ещё нет (M = ' + C.best + '). Остаток после M шагов — (I − νS)ᴹy, модель — [I − (I − νS)ᴹ]y = Σ νS(I − νS)ᵐy, m < M: матричный геометрический ряд (ряд Неймана). Деревья подстраивают «сглаживатель» под данные, поэтому для них это лишь модель, но она объясняет главное: <b>ранняя остановка работает как фильтр высоких частот</b> (Бюльман и Ю, 2003).';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\nn, nu, b, M = 64, ' + s.nu + ', ' + s.b + ', ' + s.M + '\nx = 2 * np.pi * np.arange(n) / n\nf = np.sin(x) + 0.5 * np.sin(3 * x)\nrng = Mulberry32(5)\ny = f + np.array([rng.normal(0, 0.5) for _ in range(n)])\nd = np.minimum(np.arange(n), n - np.arange(n))\nw = np.exp(-d**2 / (2 * b * b)); w /= w.sum()\nS = np.array([[w[(i - j) % n] for j in range(n)] for i in range(n)])   # сглаживатель\nF = np.zeros(n)\nfor _ in range(M):\n    F = F + nu * S @ (y - F)                # шаг L2-бустинга\nlam = np.real(np.fft.fft(w))               # собственные числа S\nF2 = np.real(np.fft.ifft(np.fft.fft(y) * (1 - (1 - nu * lam) ** M)))\nprint("итерации == ряд по частотам:", np.max(np.abs(F - F2)))\nprint("ошибка до истины:", np.mean((F - f) ** 2), "  MSE обучения:", np.mean((F - y) ** 2))\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр: абсолютно, условно или расходится?
   * ============================================================================== */
  const SG = [
    { s: '1/2 + 1/4 + 1/8 + …', a: 0, why: 'Геометрический, q = ½; все члены положительны. Сумма 1.' },
    { s: '1 + 1/2 + 1/3 + 1/4 + …', a: 2, why: 'Гармонический ряд: группы по 2ᵏ членов дают ≥ ½ каждая; растёт как ln n.' },
    { s: '1 − 1/2 + 1/3 − 1/4 + …', a: 1, why: 'Лейбниц: сходится к ln 2; модули — гармонический ряд — расходятся.' },
    { s: '1 + 1/4 + 1/9 + 1/16 + …', a: 0, why: 'p-ряд с p = 2 > 1; сумма π²/6.' },
    { s: '1 − 1 + 1 − 1 + …', a: 2, why: 'Члены не стремятся к нулю — необходимое условие нарушено.' },
    { s: '1 + 1/√2 + 1/√3 + …', a: 2, why: 'p-ряд с p = ½ ≤ 1 (интегральный признак).' },
    { s: '1 + 1 + 1/2! + 1/3! + …', a: 0, why: 'Признак отношения: aₙ₊₁/aₙ = 1/(n + 1) → 0. Сумма e.' },
    { s: '1 − 1/4 + 1/9 − 1/16 + …', a: 0, why: 'Ряд из модулей Σ1/k² сходится — абсолютная сходимость. Сумма π²/12.' },
    { s: '1 − 1/√2 + 1/√3 − …', a: 1, why: 'Лейбниц: 1/√k убывает к 0. Модули — p-ряд с p = ½ — расходятся.' },
    { s: 'Σ n/2ⁿ = 1/2 + 2/4 + 3/8 + …', a: 0, why: 'Отношение → ½ < 1. Сумма 2 (шаг 9).' },
    { s: 'Σ sin(n)/n²', a: 0, why: '|sin n|/n² ≤ 1/n² — ряд из модулей сходится по сравнению.' },
    { s: 'Σ 1/(n ln n), n ≥ 2', a: 2, why: 'Интегральный признак: ∫ dx/(x ln x) = ln ln x → ∞. Расходится очень медленно.' },
    { s: 'Σ (−1)ⁿ·n/(n + 1)', a: 2, why: 'Модули членов → 1, а не 0. Знаки не спасают.' },
    { s: 'Σ 1/(n² + n)', a: 0, why: 'Телескоп: 1/n − 1/(n + 1); сумма ровно 1.' },
    { s: 'Σ (−1)ⁿ⁺¹/ln(n + 1)', a: 1, why: 'Лейбниц сходится; модули больше 1/(n + 1) — расходятся.' },
    { s: 'Σ ln(1 + 1/n)', a: 2, why: 'Телескоп: частичные суммы ln(n + 1) → ∞. Или сравнение: ln(1 + 1/n) ~ 1/n.' },
    { s: 'Σ n!/nⁿ', a: 0, why: 'Отношение (n/(n + 1))ⁿ → 1/e < 1.' },
    { s: '1 + 2 + 4 + 8 + …', a: 2, why: 'Геометрический с q = 2 > 1. «Сумма −1» из фокуса — бессмыслица (шаг 4).' },
  ];
  GBC.widget('series-game', (el) => {
    const s = { i: 0, right: 0, done: 0, streak: 0, picked: null };
    const OPT = ['сходится абсолютно', 'сходится условно', 'расходится'];
    const w = ui.shell(el, { title: 'Тренажёр: абсолютно, условно или расходится?', sub: 'Восемнадцать рядов. Определите тип сходимости. Подсказка — порядок проверки из шага 16: члены → 0? известный тип? отношение? сравнение? знаки?' });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.15rem;padding:6px 0 12px;font-variant-numeric:tabular-nums' });
    w.main.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;max-width:620px' });
    w.main.appendChild(optsBox);
    const next = ui.button(w.controls, { label: 'Пропустить', icon: 'step', onClick: () => ((s.i = (s.i + 1) % SG.length), (s.picked = null), draw()) });
    ui.button(w.controls, { label: 'Начать заново', kind: 'ghost', onClick: () => (Object.assign(s, { i: 0, right: 0, done: 0, streak: 0, picked: null }), draw()) });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'ряд' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function draw() {
      const Q = SG[s.i];
      qEl.textContent = Q.s;
      optsBox.textContent = '';
      OPT.forEach((o, k) => {
        const b = ui.button(optsBox, { label: o, kind: s.picked === null ? '' : k === Q.a ? 'primary' : '', onClick: () => {
          if (s.picked !== null) return;
          s.picked = k;
          s.done++;
          if (k === Q.a) (s.right++, s.streak++);
          else s.streak = 0;
          draw();
        } });
        if (s.picked !== null) b.disabled = true;
      });
      st.set('r', s.i + 1 + ' из ' + SG.length);
      st.set('ok', s.right + ' из ' + s.done);
      st.set('s', String(s.streak));
      note.innerHTML = s.picked === null ? 'Начните с главного вопроса: стремятся ли члены к нулю?' : (s.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет</b> — правильно: «' + OPT[Q.a] + '». ') + Q.why;
      next.replaceChildren(ui.icon('step'), s.picked === null ? 'Пропустить' : 'Следующий');
    }
    draw();
  });

  void badge;
  void cardGrid;
  void texEl;
  void GAMMA;
  void logGrid;
})();
