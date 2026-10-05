/* Урок 15.13: теория вероятностей. Часть 1 — интуиция, язык вероятностей, условная вероятность,
 * дискретные случайные величины.
 * Виджеты: настоящая или придуманная последовательность бросков, события на таблице двух кубиков,
 * сумма кубиков (точно и симуляцией), частота → вероятность, правило сложения на «мозаике», задача о
 * встрече и Монте-Карло, условная вероятность по таблице клиентов, дерево вероятностей (урна),
 * формула полной вероятности, Байес на сетке из 1000 человек, Байес в шансах и логитах, «хотя бы один»,
 * Монти Холл, парадокс Симпсона, закон распределения и функция распределения на кубиках, матожидание
 * как центр масс, неравенство Чебышёва, доска Гальтона, биномиальное, геометрическое, Пуассон как предел.
 * Общие помощники (форматирование, карточки, распределения, сетка кубиков) выставлены в GBC.lesson1513 —
 * ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const R = String.raw;
  const f1 = (v) => U.fmt(v, 1);
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const f4 = (v) => U.fmt(v, 4);
  const py = (v) => U.pyNum(v);
  /** Короткая запись маленьких и больших величин: 3.6e−5 вместо «0». */
  const sci = (v) => (!Number.isFinite(v) ? (Number.isNaN(v) ? '—' : v > 0 ? '∞' : '−∞') : v === 0 ? '0' : Math.abs(v) >= 0.01 && Math.abs(v) < 1e5 ? U.fmt(v, Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 2 : 4) : v.toExponential(2).replace(/-/g, '−').replace('e+', 'e'));
  /** Вероятность: 4 знака, крошечные — в экспоненциальной записи. */
  const pf = (p) => (!Number.isFinite(p) ? '—' : Math.abs(p) < 5e-5 && p !== 0 ? sci(p) : U.fmt(p, 4));
  const pct = (p, d = 1) => U.fmt(100 * p, d) + ' %';
  const clean = (v) => (Math.abs(v) < 1e-12 ? 0 : v);
  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a || 1;
  }
  /** Несократимая дробь строкой: frac(12, 36) → «1/3». */
  function frac(n, d) {
    if (!d) return '—';
    const g = gcd(n, d);
    n /= g;
    d /= g;
    return d === 1 ? String(n) : n + '/' + d;
  }
  /** Склонение: plural(3, 'шаг', 'шага', 'шагов') → 'шага'. */
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  /** Диапазон оси по значениям с полями; почти постоянные значения не ломают деления оси. */
  function yDom(vals, pad = 0.08, inc = []) {
    const v = vals.concat(inc).filter(Number.isFinite);
    if (!v.length) return [-1, 1];
    const [lo, hi] = U.extent(v);
    const span = hi - lo;
    if (span < 1e-9 * Math.max(1, Math.abs(hi))) {
      const m = (lo + hi) / 2;
      const d = Math.max(0.5, Math.abs(m) * 0.1);
      return [m - d, m + d];
    }
    return [lo - pad * span, hi + Math.max(pad, 0.14) * span];
  }

  /* ==============================================================================
   * Распределения
   * ============================================================================== */
  const LF = [0];
  for (let i = 1; i <= 4000; i++) LF.push(LF[i - 1] + Math.log(i));
  const lchoose = (n, k) => LF[n] - LF[k] - LF[n - k];
  /** Биномиальный коэффициент (точно для небольших n). */
  function comb(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return Math.round(r);
  }
  function binomPmf(k, n, p) {
    if (k < 0 || k > n) return 0;
    if (p <= 0) return k === 0 ? 1 : 0;
    if (p >= 1) return k === n ? 1 : 0;
    return Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
  }
  const poisPmf = (k, lam) => (k < 0 ? 0 : Math.exp(k * Math.log(lam) - lam - LF[k]));
  const normPdf = (x, m = 0, s = 1) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  /** erfc с относительной ошибкой < 1.2e−7 (Numerical Recipes). */
  function erfc(x) {
    const z = Math.abs(x);
    const t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const normCdf = (x, m = 0, s = 1) => 0.5 * erfc(-(x - m) / (s * Math.SQRT2));
  /** Квантиль стандартного нормального (бисекция по normCdf). */
  function normPpf(p) {
    let lo = -10;
    let hi = 10;
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      if (normCdf(m) < p) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }
  /** Среднее и дисперсия дискретного распределения. */
  function moments(xs, ps) {
    const m = xs.reduce((s, x, i) => s + x * ps[i], 0);
    const v = xs.reduce((s, x, i) => s + (x - m) ** 2 * ps[i], 0);
    return { m, v, s: Math.sqrt(v) };
  }

  /* ==============================================================================
   * Карточки, формулы, таблицы
   * ============================================================================== */
  function texInto(el, src, display = false) {
    el._tex = src;
    el.replaceChildren(GBC.math.tex(src, display));
    if (!window.katex && !el._texSub) {
      el._texSub = true;
      GBC.bus.on('mathready', () => el.replaceChildren(GBC.math.tex(el._tex, display)));
    }
  }
  const texEl = (src, display = false, style = '') => {
    const el = H('div', { style: 'overflow-x:auto;overflow-y:hidden;' + style });
    texInto(el, src, display);
    return el;
  };
  function card(title, plain = true) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums;overflow-x:auto;overflow-y:hidden' });
    const head = plain ? 'font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px' : 'font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px';
    const titleEl = H('div', { style: head }, title);
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' }, titleEl, body);
    return { el, body, titleEl };
  }
  const cardGrid = (min = 200) => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(' + min + 'px,100%),1fr));gap:10px;margin:4px 0 10px' });
  function badge(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : kind === 'warn' ? 'background:var(--warn-soft);color:var(--warn-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;white-space:nowrap;' + st }, text);
  }
  /** Таблица: columns — строки; rows — массивы строк. */
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  const onTheme = (fn) => GBC.bus.on('themechange', () => setTimeout(fn, 0));
  /** Обёртка для графика с равным масштабом осей: не даёт ему растянуться на всю ширину. */
  function eqBox(parent, max = 560) {
    const box = H('div', { style: 'max-width:' + max + 'px;margin:0 auto;width:100%' });
    parent.appendChild(box);
    return box;
  }
  /** Контейнер для SVG-схемы: на узком экране прокручивается, а не сжимается до нечитаемости. */
  function svgHost(parent, minW = 320) {
    const outer = H('div', { style: 'overflow-x:auto;overflow-y:hidden;margin:4px 0 8px' });
    const inner = H('div', { style: 'min-width:' + minW + 'px' });
    outer.appendChild(inner);
    parent.appendChild(outer);
    return inner;
  }
  const C = (role) => GBC.colors.css(role);
  const PY_FR = 'from fractions import Fraction\nfrom itertools import product\n\n';
  const PY_NP = 'import numpy as np\n\n';
  const PY_RNG = 'from gbcourse.rng import Mulberry32\n';
  const PY_MATH = 'import math\n\n';

  /* ==============================================================================
   * Таблица исходов двух кубиков (SVG)
   * ============================================================================== */
  /** Сетка 6 × 6: строки — первый кубик, столбцы — второй. cell(a, b) → {fill, opacity, text, ink, dotA, dotB, bold}. */
  function diceGrid(parent, { size = 40, maxW = 340 } = {}) {
    const pad = 34;
    const W = pad + 6 * size + 6;
    const svg = S('svg', { viewBox: '0 0 ' + W + ' ' + W, width: '100%', role: 'img', 'aria-label': 'Таблица 36 исходов двух кубиков', style: 'display:block;max-width:' + maxW + 'px;margin:0 auto;font-family:var(--font-sans)' });
    parent.appendChild(svg);
    function draw(cell) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(S('text', { x: pad + 3 * size, y: 11, 'text-anchor': 'middle', style: 'font-size:10px;fill:var(--muted)' }, 'второй кубик'));
      svg.appendChild(S('text', { x: 9, y: pad + 3 * size, 'text-anchor': 'middle', transform: 'rotate(-90 9 ' + (pad + 3 * size) + ')', style: 'font-size:10px;fill:var(--muted)' }, 'первый кубик'));
      for (let k = 1; k <= 6; k++) {
        svg.appendChild(S('text', { x: pad + (k - 0.5) * size, y: pad - 6, 'text-anchor': 'middle', style: 'font-size:12px;font-weight:650;fill:var(--ink-2)' }, String(k)));
        svg.appendChild(S('text', { x: pad - 9, y: pad + (k - 0.5) * size + 4, 'text-anchor': 'middle', style: 'font-size:12px;font-weight:650;fill:var(--ink-2)' }, String(k)));
      }
      for (let a = 1; a <= 6; a++) {
        for (let b = 1; b <= 6; b++) {
          const c = cell(a, b) || {};
          const x = pad + (b - 1) * size;
          const y = pad + (a - 1) * size;
          svg.appendChild(S('rect', { x: x + 1.5, y: y + 1.5, width: size - 3, height: size - 3, rx: 5, style: 'fill:' + (c.fill || 'var(--surface-2)') + ';fill-opacity:' + (c.opacity ?? 1) + ';stroke:' + (c.stroke || 'var(--border)') + ';stroke-width:' + (c.strokeW || 1) }));
          if (c.dotA) svg.appendChild(S('circle', { cx: x + 8, cy: y + 8, r: 3.6, style: 'fill:' + C('blue') + ';stroke:var(--surface);stroke-width:1' }));
          if (c.dotB) svg.appendChild(S('circle', { cx: x + size - 8, cy: y + 8, r: 3.6, style: 'fill:' + C('orange') + ';stroke:var(--surface);stroke-width:1' }));
          if (c.text !== undefined) svg.appendChild(S('text', { x: x + size / 2, y: y + size / 2 + 5, 'text-anchor': 'middle', style: 'font-size:' + (c.fs || 13) + 'px;font-weight:' + (c.bold ? 700 : 500) + ';fill:' + (c.ink || 'var(--ink-2)') }, String(c.text)));
        }
      }
    }
    return { svg, draw };
  }
  const DICE = [];
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) DICE.push([a, b]);

  /* ==============================================================================
   * Интуиция: настоящая или придуманная последовательность
   * ============================================================================== */
  /** Распределение длины самой длинной серии одинаковых в n бросках честной монеты: pmf[L], L = 1..maxL. */
  function longestRunDist(n, maxL) {
    const cdf = [0];
    for (let L = 1; L <= maxL; L++) {
      let dp = new Array(L).fill(0);
      dp[0] = 1;
      for (let i = 1; i < n; i++) {
        const nw = new Array(L).fill(0);
        const tot = dp.reduce((s, v) => s + v, 0);
        nw[0] = 0.5 * tot;
        for (let j = 1; j < L; j++) nw[j] = 0.5 * dp[j - 1];
        dp = nw;
      }
      cdf.push(dp.reduce((s, v) => s + v, 0));
    }
    return cdf.map((c, L) => (L === 0 ? 0 : c - cdf[L - 1]));
  }
  const longestRun = (seq) => {
    let best = 1;
    let cur = 1;
    for (let i = 1; i < seq.length; i++) {
      cur = seq[i] === seq[i - 1] ? cur + 1 : 1;
      best = Math.max(best, cur);
    }
    return best;
  };
  const switches = (seq) => seq.reduce((s, v, i) => s + (i && v !== seq[i - 1] ? 1 : 0), 0);
  function realFlips(seed, n = 100) {
    const rng = new GBC.RNG(seed);
    return U.range(n).map(() => (rng.random() < 0.5 ? 1 : 0));
  }
  /** «Человеческая» последовательность: меняет сторону слишком часто и избегает длинных серий. */
  function fakeFlips(seed, n = 100) {
    const rng = new GBC.RNG(seed + 10000);
    const out = [rng.random() < 0.5 ? 1 : 0];
    let run = 1;
    for (let i = 1; i < n; i++) {
      const sw = rng.random() < (run >= 3 ? 0.92 : 0.62);
      out.push(sw ? 1 - out[i - 1] : out[i - 1]);
      run = sw ? 1 : run + 1;
    }
    return out;
  }
  GBC.widget('streaks', (el) => {
    const s = { seed: 3, swap: true, guess: null };
    const LD = longestRunDist(100, 16);
    const w = ui.shell(el, { title: 'Настоящая или придуманная?', sub: 'Одна из последовательностей — 100 настоящих бросков монеты (генератор Mulberry32), другая придумана «как человек»: орлы и решки честно перемешаны. Угадайте, какая настоящая, — потом смотрите на серии одинаковых подряд.' });
    const seg = ui.segmented(w.controls, { label: 'Какая настоящая?', value: null, options: [{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }], onChange: (v) => ((s.guess = v), draw()) });
    ui.button(w.controls, { label: 'Новая пара', kind: 'primary', onClick: () => {
      s.seed++;
      s.swap = new GBC.RNG(s.seed * 7 + 1).random() < 0.5;
      s.guess = null;
      seg.set(null);
      draw();
    } });
    ui.button(w.controls, { label: 'Показать ответ', onClick: () => ((s.guess = s.guess || 'показать'), draw()) });
    const grid = cardGrid(230);
    w.main.appendChild(grid);
    const cA = card('Последовательность A');
    const cB = card('Последовательность B');
    grid.append(cA.el, cB.el);
    const plot = new GBC.Plot(w.main, { height: 210, x: { label: 'длина самой длинной серии в 100 бросках', domain: [0.4, 14.6], ticks: U.range(14, 1) }, y: { label: 'вероятность' }, table: () => ({ columns: ['длина L', 'P(самая длинная = L)', 'P(≥ L)'], rows: U.range(14, 1).map((L) => [L, LD[L], LD.slice(L).reduce((a, b) => a + b, 0)]) }) });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'la', label: 'самая длинная серия A / B' }, { key: 'sw', label: 'смен О ↔ Р: A / B' }, { key: 'h', label: 'орлов: A / B' }, { key: 'p', label: 'P(серия ≥ 5) в 100 бросках' }]);
    function seqSvg(body, seq, reveal) {
      body.textContent = '';
      const cs = 22;
      const svg = S('svg', { viewBox: '0 0 ' + (10 * cs + 2) + ' ' + (10 * cs + 2), width: '100%', style: 'display:block;max-width:240px;margin:0 auto;font-family:var(--font-sans)' });
      const L = longestRun(seq);
      // клетки самой длинной серии
      const mark = new Array(seq.length).fill(false);
      if (reveal) {
        let cur = 1;
        for (let i = 1; i < seq.length; i++) {
          cur = seq[i] === seq[i - 1] ? cur + 1 : 1;
          if (cur === L) for (let j = i - L + 1; j <= i; j++) mark[j] = true;
        }
        if (L === 1) mark.fill(false);
      }
      seq.forEach((v, i) => {
        const x = 1 + (i % 10) * cs;
        const y = 1 + Math.floor(i / 10) * cs;
        svg.appendChild(S('rect', { x: x + 1, y: y + 1, width: cs - 2, height: cs - 2, rx: 3, style: 'fill:' + C(v ? 'blue' : 'orange') + ';fill-opacity:' + (mark[i] ? 1 : 0.55) + ';stroke:' + (mark[i] ? 'var(--ink)' : 'none') + ';stroke-width:2' }));
        svg.appendChild(S('text', { x: x + cs / 2, y: y + cs / 2 + 4, 'text-anchor': 'middle', style: 'font-size:10px;font-weight:650;fill:var(--ink)' }, v ? 'О' : 'Р'));
      });
      body.appendChild(svg);
    }
    function draw() {
      const real = realFlips(s.seed);
      const fake = fakeFlips(s.seed);
      const A = s.swap ? fake : real;
      const B = s.swap ? real : fake;
      const realName = s.swap ? 'B' : 'A';
      const reveal = s.guess !== null;
      seqSvg(cA.body, A, reveal);
      seqSvg(cB.body, B, reveal);
      cA.titleEl.textContent = 'Последовательность A' + (reveal ? (realName === 'A' ? ' — настоящая' : ' — придуманная') : '');
      cB.titleEl.textContent = 'Последовательность B' + (reveal ? (realName === 'B' ? ' — настоящая' : ' — придуманная') : '');
      const la = longestRun(A);
      const lb = longestRun(B);
      plot.render([
        { type: 'bars', x: U.range(14, 1), y: U.range(14, 1).map((L) => LD[L]), color: 'data', width: 0.7, opacity: 0.55, label: 'P(самая длинная серия = L)', tooltip: (i) => [['L', String(i + 1)], ['вероятность', pf(LD[i + 1])]] },
        { type: 'vline', x: la - 0.08, color: 'blue', width: 2.2, label: 'A' },
        { type: 'vline', x: lb + 0.08, color: 'orange', width: 2.2, dash: '5 3', label: 'B' },
      ]);
      st.set('la', la + ' / ' + lb);
      st.set('sw', switches(A) + ' / ' + switches(B));
      st.set('h', A.reduce((a, b) => a + b, 0) + ' / ' + B.reduce((a, b) => a + b, 0));
      st.set('p', pf(LD.slice(5).reduce((a, b) => a + b, 0)));
      const lr = longestRun(real);
      const lf = longestRun(fake);
      if (!reveal) note.innerHTML = 'Сравните «на глаз»: где орлы и решки чередуются естественнее? Затем выберите A или B. Подсказка — гистограмма: так распределена длина самой длинной серии у <b>настоящих</b> 100 бросков.';
      else note.innerHTML = (s.guess === realName ? '<b>Верно!</b> ' : s.guess === 'показать' ? '' : '<b>Не угадали.</b> ') + 'Настоящая — ' + realName + '. Самая длинная серия у неё ' + lr + ', у придуманной — ' + lf + ' (выделена рамкой). Придуманная меняет сторону ' + switches(fake) + ' раз из 99, настоящая — ' + switches(real) + ' (в среднем 49.5). Люди избегают серий, а случайность их создаёт: серия длиной хотя бы 5 бывает с вероятностью ' + pf(LD.slice(5).reduce((a, b) => a + b, 0)) + ', хотя бы 6 — ' + pf(LD.slice(6).reduce((a, b) => a + b, 0)) + '.';
    }
    w.pythonAction(() => PY_RNG + 'import numpy as np\n\nrng = Mulberry32(' + s.seed + ')\nflips = [1 if rng.random() < 0.5 else 0 for _ in range(100)]    # 1 — орёл\n\ndef longest_run(seq):\n    best = cur = 1\n    for a, b in zip(seq, seq[1:]):\n        cur = cur + 1 if a == b else 1\n        best = max(best, cur)\n    return best\n\nprint("".join("О" if f else "Р" for f in flips))\nprint("самая длинная серия:", longest_run(flips), " смен:", sum(a != b for a, b in zip(flips, flips[1:])))\n\n# точное распределение: P(самая длинная серия ≤ L) динамическим программированием\ndef p_le(n, L):\n    dp = np.zeros(L); dp[0] = 1.0          # dp[j] — текущая серия длины j + 1\n    for _ in range(n - 1):\n        new = np.zeros(L)\n        new[0] = 0.5 * dp.sum()\n        new[1:] = 0.5 * dp[:-1]\n        dp = new\n    return dp.sum()\nfor L in (4, 5, 6, 7, 8):\n    print(f"P(серия ≥ {L}) = {1 - p_le(100, L - 1):.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 1. События на таблице двух кубиков
   * ============================================================================== */
  const EVENTS = {
    sum7: ['сумма = 7', (a, b) => a + b === 7, 'a + b == 7'],
    double: ['дубль', (a, b) => a === b, 'a == b'],
    six: ['есть шестёрка', (a, b) => a === 6 || b === 6, '6 in (a, b)'],
    sum10: ['сумма ≥ 10', (a, b) => a + b >= 10, 'a + b >= 10'],
    firstgt: ['первый больше второго', (a, b) => a > b, 'a > b'],
    firsteven: ['первый чётный', (a) => a % 2 === 0, 'a % 2 == 0'],
    botheven: ['оба чётные', (a, b) => a % 2 === 0 && b % 2 === 0, 'a % 2 == 0 and b % 2 == 0'],
    sum8: ['сумма = 8', (a, b) => a + b === 8, 'a + b == 8'],
    sumle4: ['сумма ≤ 4', (a, b) => a + b <= 4, 'a + b <= 4'],
  };
  const OPS = {
    A: ['A', (x) => x],
    B: ['B', (x, y) => y],
    and: ['A ∩ B', (x, y) => x && y],
    or: ['A ∪ B', (x, y) => x || y],
    notA: ['не A', (x) => !x],
    minus: ['A \\ B', (x, y) => x && !y],
  };
  GBC.widget('event-grid', (el) => {
    const s = { A: 'six', B: 'sum10', op: 'and' };
    const w = ui.shell(el, { title: 'События — наборы клеток', sub: 'Каждая клетка — исход (первый кубик, второй кубик), в ней — сумма очков. Синяя точка — клетка входит в A, оранжевая — в B. Закрашены клетки события, выбранного кнопками операции.' });
    const opt = Object.entries(EVENTS).map(([k, v]) => ({ value: k, label: v[0] }));
    ui.select(w.controls, { label: 'Событие A', value: s.A, options: opt, onChange: (v) => ((s.A = v), draw()) });
    ui.select(w.controls, { label: 'Событие B', value: s.B, options: opt, onChange: (v) => ((s.B = v), draw()) });
    ui.segmented(w.controls, { label: 'Показать', value: s.op, options: Object.entries(OPS).map(([k, v]) => ({ value: k, label: v[0] })), onChange: (v) => ((s.op = v), draw()) });
    const g = diceGrid(w.main);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '|A|' }, { key: 'b', label: '|B|' }, { key: 'r', label: 'исходов в событии' }, { key: 'p', label: 'вероятность' }]);
    function draw() {
      const fa = EVENTS[s.A][1];
      const fb = EVENTS[s.B][1];
      const fo = OPS[s.op][1];
      let na = 0;
      let nb = 0;
      let nr = 0;
      let nab = 0;
      g.draw((a, b) => {
        const x = fa(a, b);
        const y = fb(a, b);
        const r = fo(x, y);
        na += x ? 1 : 0;
        nb += y ? 1 : 0;
        nab += x && y ? 1 : 0;
        nr += r ? 1 : 0;
        return { fill: r ? C('model') : 'var(--surface-2)', opacity: r ? 0.85 : 1, text: a + b, ink: r ? 'var(--surface)' : 'var(--muted)', bold: r, dotA: x, dotB: y };
      });
      st.set('a', String(na));
      st.set('b', String(nb));
      st.set('r', nr + ' из 36');
      st.set('p', frac(nr, 36) + ' ≈ ' + f3(nr / 36));
      const nameA = EVENTS[s.A][0];
      const nameB = EVENTS[s.B][0];
      const words = { A: 'произошло A', B: 'произошло B', and: 'произошли и A, и B', or: 'произошло A или B (или оба)', notA: 'A не произошло', minus: 'A произошло, а B — нет' };
      let extra = '';
      if (s.op === 'or') extra = ' Проверка формулы сложения: ' + na + ' + ' + nb + ' − ' + nab + ' = ' + (na + nb - nab) + '.';
      if (s.op === 'notA') extra = ' Дополнение: 36 − ' + na + ' = ' + (36 - na) + ', то есть P(не A) = 1 − P(A).';
      note.innerHTML = 'A — «' + nameA + '», B — «' + nameB + '». Закрашено событие «' + words[s.op] + '»: ' + nr + ' ' + plural(nr, 'исход', 'исхода', 'исходов') + ' из 36, P = ' + frac(nr, 36) + '.' + extra +
        (nab === 0 ? ' <b>A и B несовместны</b>: общих клеток нет.' : ' Общих клеток у A и B: ' + nab + '.');
    }
    w.pythonAction(() => PY_FR + 'omega = list(product(range(1, 7), repeat=2))        # 36 исходов (a, b)\nA = {(a, b) for a, b in omega if ' + EVENTS[s.A][2] + '}   # ' + EVENTS[s.A][0] + '\nB = {(a, b) for a, b in omega if ' + EVENTS[s.B][2] + '}   # ' + EVENTS[s.B][0] + '\nP = lambda E: Fraction(len(E), len(omega))\n\nprint("P(A) =", P(A), " P(B) =", P(B))\nprint("P(A ∩ B) =", P(A & B), " P(A ∪ B) =", P(A | B), " = P(A) + P(B) − P(A ∩ B):", P(A) + P(B) - P(A & B))\nprint("P(не A) =", P(set(omega) - A), " P(A \\\\ B) =", P(A - B))\nprint("несовместны:", not (A & B))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 2. Сумма очков: точно и симуляцией
   * ============================================================================== */
  function diceCounts(n) {
    let c = [1];
    for (let d = 0; d < n; d++) {
      const nc = new Array(c.length + 6).fill(0);
      c.forEach((v, i) => {
        for (let f = 1; f <= 6; f++) nc[i + f] += v;
      });
      c = nc;
    }
    return c; // c[s] — число исходов с суммой s
  }
  GBC.widget('dice-sum', (el) => {
    const s = { n: 2, mode: 'eq', v: 7, sim: false, N: 1000, seed: 1 };
    const w = ui.shell(el, { title: 'Сумма очков на кубиках', sub: 'Столбики — точные вероятности сумм (число упорядоченных исходов, делённое на 6ⁿ). Закрашены суммы, входящие в событие. Включите симуляцию — точки покажут частоты в серии бросков.' });
    const seg = ui.segmented(w.controls, { label: 'Кубиков', value: s.n, options: [1, 2, 3, 4].map((k) => ({ value: k, label: String(k) })), onChange: (v) => ((s.n = v), draw()) });
    ui.segmented(w.controls, { label: 'Событие', value: s.mode, options: [{ value: 'eq', label: 'сумма = s' }, { value: 'le', label: '≤ s' }, { value: 'ge', label: '≥ s' }], onChange: (v) => ((s.mode = v), draw()) });
    const sv = ui.slider(w.controls, { label: 's', min: 1, max: 24, step: 1, value: s.v, format: (v) => String(U.clamp(v, s.n, 6 * s.n)), onInput: (v) => ((s.v = v), draw()) });
    ui.button(w.controls, { label: 'Галилей: 9 против 10', onClick: () => {
      s.n = 3;
      s.mode = 'eq';
      s.v = 9;
      seg.set(3);
      sv.set(9);
      draw();
    } });
    ui.toggle(w.controls, { label: 'Симуляция бросков', checked: s.sim, onChange: (v) => ((s.sim = v), draw()) });
    ui.slider(w.controls, { label: 'Бросков в серии', values: [10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000], value: s.N, format: (v) => String(v), onInput: (v) => ((s.N = v), draw()) });
    ui.button(w.controls, { label: 'Новая серия', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'сумма очков' }, y: { label: 'вероятность' }, table: () => {
      const c = diceCounts(s.n);
      const tot = Math.pow(6, s.n);
      return { columns: ['сумма', 'исходов', 'вероятность'], rows: U.range(5 * s.n + 1, s.n).map((k) => [k, c[k], c[k] / tot]) };
    } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'событие' }, { key: 'c', label: 'исходов' }, { key: 'p', label: 'вероятность' }, { key: 'f', label: 'частота в серии' }]);
    function draw() {
      const n = s.n;
      const v = U.clamp(s.v, n, 6 * n);
      const c = diceCounts(n);
      const tot = Math.pow(6, n);
      const xs = U.range(5 * n + 1, n);
      const inEv = (k) => (s.mode === 'eq' ? k === v : s.mode === 'le' ? k <= v : k >= v);
      const cnt = U.sum(xs.filter(inEv).map((k) => c[k]));
      let freq = null;
      const layers = [
        { type: 'bars', x: xs, y: xs.map((k) => c[k] / tot), color: (i) => (inEv(xs[i]) ? 'model' : 'data'), legendColor: 'model', width: 0.75, opacity: 0.8, label: 'точная вероятность', tooltip: (i) => [['сумма', String(xs[i])], ['исходов', c[xs[i]] + ' из ' + tot], ['P', pf(c[xs[i]] / tot)]] },
      ];
      if (s.sim) {
        const rng = new GBC.RNG(s.seed);
        const hist = new Array(6 * n + 1).fill(0);
        for (let t = 0; t < s.N; t++) {
          let sum = 0;
          for (let d = 0; d < n; d++) sum += 1 + rng.randint(6);
          hist[sum]++;
        }
        layers.push({ type: 'points', x: xs, y: xs.map((k) => hist[k] / s.N), color: 'tree', r: 4.5, label: 'частота в серии' });
        freq = U.sum(xs.filter(inEv).map((k) => hist[k])) / s.N;
      }
      plot.render(layers, { x: [n - 0.6, 6 * n + 0.6] });
      const sym = s.mode === 'eq' ? '=' : s.mode === 'le' ? '≤' : '≥';
      st.set('e', 'сумма ' + sym + ' ' + v);
      st.set('c', cnt + ' из ' + tot);
      st.set('p', frac(cnt, tot) + ' ≈ ' + pf(cnt / tot));
      st.set('f', freq === null ? '—' : pf(freq));
      let txt = n === 1 ? 'Один кубик: все суммы равновероятны (по 1/6).' : n === 2 ? 'Два кубика: «треугольник» — сумма 7 получается шестью способами из 36, суммы 2 и 12 — одним.' : 'Распределение суммы всё больше похоже на колокол — это центральная предельная теорема в действии (шаги 26 и 28).';
      if (n === 3) txt += ' Задача Галилея: сумма 9 — ' + c[9] + ' троек из 216, сумма 10 — ' + c[10] + '.';
      if (s.sim) txt += ' Частота события в серии из ' + s.N + ' бросков — ' + pf(freq) + ', точная вероятность — ' + pf(cnt / tot) + '; отклонение типично порядка ' + pf(Math.sqrt((cnt / tot) * (1 - cnt / tot) / s.N)) + '.';
      note.innerHTML = txt;
    }
    w.pythonAction(() => {
      const v = U.clamp(s.v, s.n, 6 * s.n);
      const cond = s.mode === 'eq' ? 'sum(d) == ' + v : s.mode === 'le' ? 'sum(d) <= ' + v : 'sum(d) >= ' + v;
      return PY_FR + PY_RNG + '\nn = ' + s.n + '\nomega = list(product(range(1, 7), repeat=n))     # 6ⁿ упорядоченных исходов\nfav = [d for d in omega if ' + cond + ']\nprint("исходов:", len(fav), "из", len(omega), " P =", Fraction(len(fav), len(omega)), "≈", round(len(fav) / len(omega), 4))\n' +
        (s.n === 3 ? 'print("Галилей: сумма 9 —", sum(sum(d) == 9 for d in omega), " сумма 10 —", sum(sum(d) == 10 for d in omega))\n' : '') +
        '\nrng = Mulberry32(' + s.seed + ')\nN = ' + s.N + '\nhits = 0\nfor _ in range(N):\n    d = [1 + rng.randint(6) for _ in range(n)]\n    hits += ' + cond + '\nprint("частота в серии:", hits / N)\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 3. Частота → вероятность
   * ============================================================================== */
  GBC.widget('coin-lln', (el) => {
    const s = { p: 0.5, k: 40, seed: 1, series: 5 };
    const N = 10000;
    const w = ui.shell(el, { title: 'Частота → вероятность: закон больших чисел', sub: 'Подбрасываем монету (вероятность орла p) снова и снова и после каждого броска считаем долю орлов. Несколько серий — несколько независимых опытов. Нажмите ▶. Ось бросков логарифмическая.' });
    ui.slider(w.controls, { label: 'Вероятность орла p', min: 0.05, max: 0.95, step: 0.05, value: s.p, format: f2, onInput: (v) => ((s.p = v), draw()) });
    ui.segmented(w.controls, { label: 'Серий', value: s.series, options: [1, 5, 20].map((k) => ({ value: k, label: String(k) })), onChange: (v) => ((s.series = v), draw()) });
    ui.player(w.controls, { label: 'Бросков', min: 1, max: 60, value: s.k, fps: 8, format: (k) => Math.round(Math.pow(N, k / 60)) + ' бросков', onChange: (k) => ((s.k = k), draw()) });
    ui.button(w.controls, { label: 'Другие серии', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'число бросков n (лог.)', type: 'log', domain: [1, N], ticks: [1, 10, 100, 1000, 10000] }, y: { label: 'доля орлов', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'бросков' }, { key: 'f', label: 'доли в сериях (первые 5)' }, { key: 'b', label: 'полоса ±2σ' }, { key: 'in', label: 'серий в полосе' }]);
    function draw() {
      const n = Math.round(Math.pow(N, s.k / 60));
      const sd = (m) => Math.sqrt((s.p * (1 - s.p)) / m);
      const band = U.range(200).map((i) => Math.pow(N, i / 199));
      const layers = [
        { type: 'area', x: band, y0: band.map((m) => Math.max(0, s.p - 2 * sd(m))), y1: band.map((m) => Math.min(1, s.p + 2 * sd(m))), color: 'tree', opacity: 0.14, label: 'p ± 2·√(p(1 − p)/n)' },
        { type: 'hline', y: s.p, color: 'tree', dash: '6 4', width: 1.6 },
      ];
      const finals = [];
      for (let r = 0; r < s.series; r++) {
        const rng = new GBC.RNG(s.seed * 100 + r);
        const xs = [];
        const fr = [];
        let heads = 0;
        for (let i = 1; i <= n; i++) {
          if (rng.random() < s.p) heads++;
          // для длинных серий рисуем не каждую точку
          if (i < 200 || i % Math.ceil(i / 200) === 0 || i === n) (xs.push(i), fr.push(heads / i));
        }
        finals.push(heads / n);
        layers.push({ type: 'line', x: xs, y: fr, color: r === 0 ? 'model' : 'model-prev', width: r === 0 ? 2 : 1.2, opacity: r === 0 ? 1 : 0.7, label: r === 0 ? 'доля орлов (серия 1)' : r === 1 ? 'другие серии' : null, hover: false });
      }
      plot.render(layers);
      const inside = finals.filter((f) => Math.abs(f - s.p) <= 2 * sd(n) + 1e-12).length;
      st.set('n', String(n));
      st.set('f', finals.slice(0, 5).map((v) => U.fmt(v, 3)).join(', '));
      st.set('b', '±' + U.fmt(2 * sd(n), 4));
      st.set('in', inside + ' из ' + s.series);
      note.innerHTML = 'После ' + n + ' ' + plural(n, 'броска', 'бросков', 'бросков') + ' доли в сериях — ' + finals.slice(0, 5).map((v) => U.fmt(v, 3)).join(', ') + (s.series > 5 ? '…' : '') + '. Вначале они скачут, потом сходятся к p = ' + f2(s.p) + '. Полоса ±2 стандартных отклонения доли сужается как <b>1/√n</b>: в 100 раз больше бросков — в 10 раз уже полоса. Внутри полосы в среднем около 95 % серий.';
    }
    w.pythonAction(() => {
      const n = Math.round(Math.pow(N, s.k / 60));
      return PY_RNG + 'import math\n\np, n = ' + py(s.p) + ', ' + n + '\nfor r in range(' + s.series + '):\n    rng = Mulberry32(' + s.seed * 100 + ' + r)\n    heads = sum(rng.random() < p for _ in range(n))\n    print(f"серия {r + 1}: доля орлов {heads / n:.4f}")\nprint("типичный разброс доли √(p(1 − p)/n) =", round(math.sqrt(p * (1 - p) / n), 4))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 4. Правило сложения на «мозаике»
   * ============================================================================== */
  GBC.widget('venn', (el) => {
    const s = { a: 0.5, b: 0.4, i: 0.2, show: 'or' };
    const w = ui.shell(el, { title: 'Вероятность как площадь', sub: 'Квадрат — всё пространство исходов, его площадь 1. Синяя полоса — событие A (ширина P(A)), оранжевая заливка — B. Площадь каждого куска равна его вероятности точно. Рамкой выделено выбранное событие.' });
    const sa = ui.slider(w.controls, { label: 'P(A)', min: 0.05, max: 0.95, step: 0.01, value: s.a, format: f2, onInput: (v) => ((s.a = v), fix(), draw()) });
    const sb = ui.slider(w.controls, { label: 'P(B)', min: 0.05, max: 0.95, step: 0.01, value: s.b, format: f2, onInput: (v) => ((s.b = v), fix(), draw()) });
    const si = ui.slider(w.controls, { label: 'P(A ∩ B)', min: 0, max: 0.95, step: 0.01, value: s.i, format: f2, onInput: (v) => ((s.i = v), fix(), draw()) });
    ui.segmented(w.controls, { label: 'Выделить', value: s.show, options: [{ value: 'or', label: 'A ∪ B' }, { value: 'and', label: 'A ∩ B' }, { value: 'none', label: 'ни A, ни B' }, { value: 'minus', label: 'A без B' }], onChange: (v) => ((s.show = v), draw()) });
    ui.button(w.controls, { label: 'Сделать независимыми', onClick: () => ((s.i = Math.round(s.a * s.b * 10000) / 10000), si.set(s.i), draw()) });
    let clamped = false;
    function fix() {
      const lo = Math.max(0, s.a + s.b - 1);
      const hi = Math.min(s.a, s.b);
      clamped = s.i < lo - 1e-9 || s.i > hi + 1e-9;
      s.i = U.clamp(s.i, lo, hi);
      si.set(s.i);
    }
    const plot = new GBC.Plot(eqBox(w.main, 420), { height: 340, equal: true, x: { label: '', domain: [0, 1], ticks: [0, 0.5, 1] }, y: { label: '', domain: [0, 1], ticks: [0, 0.5, 1] }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'u', label: 'P(A ∪ B) = P(A) + P(B) − P(A ∩ B)' }, { key: 'n', label: 'P(ни A, ни B)' }, { key: 'c', label: 'P(A | B) / P(B | A)' }, { key: 'ind', label: 'P(A)·P(B)' }]);
    function draw() {
      const { a, b, i } = s;
      const hA = i / a; // высота B внутри полосы A
      const hN = (b - i) / (1 - a); // высота B вне A
      const regions = {
        and: [[0, a, 0, hA]],
        aOnly: [[0, a, hA, 1]],
        bOnly: [[a, 1, 0, hN]],
        none: [[a, 1, hN, 1]],
      };
      const sel = s.show === 'or' ? ['and', 'aOnly', 'bOnly'] : s.show === 'and' ? ['and'] : s.show === 'none' ? ['none'] : ['aOnly'];
      const L = [
        { type: 'rect', x0: 0, x1: 1, y0: 0, y1: 1, fill: 'surface', opacity: 1, stroke: 'ink2', width: 1.2 },
        { type: 'rect', x0: 0, x1: a, y0: 0, y1: 1, fill: 'blue', opacity: 0.22, label: 'A', color: 'blue' },
        { type: 'rect', x0: 0, x1: a, y0: 0, y1: hA, fill: 'orange', opacity: 0.42, label: 'B', color: 'orange' },
        { type: 'rect', x0: a, x1: 1, y0: 0, y1: hN, fill: 'orange', opacity: 0.42 },
      ];
      for (const k of sel) for (const [x0, x1, y0, y1] of regions[k]) if (x1 - x0 > 1e-6 && y1 - y0 > 1e-6) L.push({ type: 'rect', x0, x1, y0, y1, stroke: 'ink', width: 2.6, opacity: 0 });
      const lab = (x0, x1, y0, y1, t, v) => (x1 - x0 > 0.07 && y1 - y0 > 0.07 ? [{ x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 0.02, text: t, anchor: 'middle', bold: true }, { x: (x0 + x1) / 2, y: (y0 + y1) / 2 - 0.05, text: f2(v), anchor: 'middle' }] : []);
      L.push({ type: 'text', items: [...lab(0, a, 0, hA, 'A ∩ B', i), ...lab(0, a, hA, 1, 'A без B', a - i), ...lab(a, 1, 0, hN, 'B без A', b - i), ...lab(a, 1, hN, 1, 'ни A, ни B', 1 - a - b + i)] });
      plot.render(L);
      st.set('u', f2(a) + ' + ' + f2(b) + ' − ' + f2(i) + ' = ' + f2(a + b - i));
      st.set('n', f2(1 - a - b + i));
      st.set('c', f3(i / b) + ' / ' + f3(i / a));
      st.set('ind', f4(a * b) + (Math.abs(a * b - i) < 0.005 ? ' ≈ P(A ∩ B): независимы' : ' ≠ P(A ∩ B)'));
      const lo = Math.max(0, a + b - 1);
      const hi = Math.min(a, b);
      note.innerHTML = 'Сумма P(A) + P(B) = ' + f2(a + b) + ' считает кусок A ∩ B дважды, поэтому его вычитаем: P(A ∪ B) = ' + f2(a + b - i) + '. Пересечение может меняться только от ' + f2(lo) + ' до ' + f2(hi) + (clamped ? ' — <b>значение подрезано</b> до допустимого' : '') + '.' +
        (i === 0 ? ' Сейчас <b>A и B несовместны</b>: P(A ∪ B) = P(A) + P(B).' : '') +
        ' Условная вероятность P(A | B) = ' + f3(i / b) + ' — доля площади A внутри B (шаг 6).';
    }
    w.pythonAction(() => 'pA, pB, pAB = ' + py(s.a) + ', ' + py(s.b) + ', ' + py(s.i) + '\nprint("P(A ∪ B) =", round(pA + pB - pAB, 6))\nprint("P(ни A, ни B) =", round(1 - (pA + pB - pAB), 6))\nprint("допустимое P(A ∩ B): от", max(0, pA + pB - 1), "до", min(pA, pB))\nprint("P(A | B) =", round(pAB / pB, 4), " независимы:", abs(pAB - pA * pB) < 1e-9)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 5. Геометрическая вероятность: встреча и четверть круга
   * ============================================================================== */
  GBC.widget('meeting', (el) => {
    const s = { mode: 'meet', t: 15, pts: true, N: 500, seed: 1 };
    const w = ui.shell(el, { title: 'Задача о встрече', sub: 'Каждый из двоих приходит в случайную минуту между 12:00 и 13:00 и ждёт t минут. Исход — точка (приход первого, приход второго) в квадрате 60 × 60; встреча — закрашенная полоса |x − y| ≤ t. Вероятность — её доля площади. Точки — симуляция.' });
    ui.segmented(w.controls, { label: 'Задача', value: s.mode, options: [{ value: 'meet', label: 'встреча' }, { value: 'pi', label: 'четверть круга' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'Ждёт t минут', min: 0, max: 60, step: 1, value: s.t, format: (v) => v + ' мин', onInput: (v) => ((s.t = v), draw()) });
    ui.toggle(w.controls, { label: 'Случайные точки', checked: s.pts, onChange: (v) => ((s.pts = v), draw()) });
    ui.slider(w.controls, { label: 'Точек', values: [20, 50, 100, 200, 500, 1000, 2000, 5000], value: s.N, format: String, onInput: (v) => ((s.N = v), draw()) });
    ui.button(w.controls, { label: 'Новые точки', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(eqBox(w.main, 440), { height: 360, equal: true, x: { label: 'приход первого, мин', domain: [0, 60] }, y: { label: 'приход второго, мин', domain: [0, 60] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'точная вероятность' }, { key: 'f', label: 'доля точек' }, { key: 'e', label: 'ошибка / типичная' }, { key: 'x', label: 'дополнительно' }]);
    function draw() {
      const pi = s.mode === 'pi';
      const M = pi ? 1 : 60;
      let exact;
      const inside = pi ? (x, y) => x * x + y * y <= 1 : (x, y) => Math.abs(x - y) <= s.t;
      const L = [{ type: 'rect', x0: 0, x1: M, y0: 0, y1: M, stroke: 'ink2', width: 1.2, opacity: 0 }];
      if (pi) {
        exact = Math.PI / 4;
        const th = U.linspace(0, Math.PI / 2, 80);
        L.push({ type: 'polygon', x: [0, ...th.map(Math.cos)], y: [0, ...th.map(Math.sin)], fill: 'model', opacity: 0.2, stroke: 'model', width: 2 });
      } else {
        const t = s.t;
        exact = 1 - Math.pow(1 - t / 60, 2);
        L.push({ type: 'polygon', x: [0, t, 60, 60, 60 - t, 0], y: [0, 0, 60 - t, 60, 60, t], fill: 'model', opacity: 0.2, stroke: 'model', width: 1.6 });
        L.push({ type: 'line', x: [0, 60], y: [0, 60], color: 'muted', width: 1, dash: '3 4', hover: false });
      }
      let freq = null;
      if (s.pts) {
        const rng = new GBC.RNG(s.seed);
        const xin = [];
        const yin = [];
        const xo = [];
        const yo = [];
        for (let k = 0; k < s.N; k++) {
          const x = rng.uniform(0, M);
          const y = rng.uniform(0, M);
          if (inside(x, y)) (xin.push(x), yin.push(y));
          else (xo.push(x), yo.push(y));
        }
        freq = xin.length / s.N;
        const r = s.N > 1000 ? 2.2 : s.N > 300 ? 3 : 4;
        L.push({ type: 'points', x: xo, y: yo, color: 'muted', r, label: 'мимо' });
        L.push({ type: 'points', x: xin, y: yin, color: 'tree', r, label: pi ? 'внутри круга' : 'встретились' });
      }
      plot.opts.x.label = pi ? 'x' : 'приход первого, мин';
      plot.opts.y.label = pi ? 'y' : 'приход второго, мин';
      plot.render(L, { x: [0, M], y: [0, M] });
      st.set('p', (pi ? 'π/4 ≈ ' : '') + f4(exact));
      st.set('f', freq === null ? '—' : f4(freq));
      st.set('e', freq === null ? '—' : f4(Math.abs(freq - exact)) + ' / ' + f4(Math.sqrt(exact * (1 - exact) / s.N)));
      st.set('x', pi ? (freq === null ? '—' : 'оценка π = 4·доля = ' + f3(4 * freq)) : 'вне полосы: (1 − t/60)² = ' + f4(1 - exact));
      note.innerHTML = pi
        ? 'Доля точек квадрата [0, 1]², попавших в четверть круга, стремится к его площади π/4 ≈ 0.7854. Так площадь (и интеграл) измеряют вероятностью — метод Монте-Карло. Ошибка убывает как 1/√N: чтобы получить ещё один верный знак π, точек нужно в 100 раз больше.'
        : 'Вне полосы — два треугольника с катетами 60 − t; их площадь (60 − t)², поэтому P(встреча) = 1 − (1 − t/60)² = ' + f4(exact) + '. При t = 15 это 0.4375; для вероятности ½ нужно ждать 60(1 − 1/√2) ≈ 17.6 мин. Вероятность прийти в один и тот же момент (точка точно на диагонали) — ноль, хотя это возможно.';
    }
    w.pythonAction(() => (s.mode === 'pi'
      ? PY_RNG + '\nrng = Mulberry32(' + s.seed + ')\nN = ' + s.N + '\nhit = 0\nfor _ in range(N):\n    x, y = rng.uniform(0, 1), rng.uniform(0, 1)\n    hit += x * x + y * y <= 1\nprint("доля:", hit / N, " π/4 =", 3.141592653589793 / 4, " оценка π:", 4 * hit / N)\n'
      : PY_RNG + '\nt = ' + s.t + '\nprint("точно: 1 − (1 − t/60)² =", 1 - (1 - t / 60) ** 2)\nrng = Mulberry32(' + s.seed + ')\nN = ' + s.N + '\nhit = 0\nfor _ in range(N):\n    x, y = rng.uniform(0, 60), rng.uniform(0, 60)\n    hit += abs(x - y) <= t\nprint("симуляция:", hit / N)\n'));
    draw();
  });

  /* ==============================================================================
   * Шаг 6. Условная вероятность по таблице клиентов
   * ============================================================================== */
  GBC.widget('cond-table', (el) => {
    const s = { n1: 400, r1: 0.3, r2: 0.05, cond: 'month' };
    const w = ui.shell(el, { title: 'Условная вероятность: сужаем мир', sub: '1000 клиентов по тарифу и исходу. Выберите условие — останется только его строка или столбец, и вероятность считается как доля внутри него.' });
    ui.slider(w.controls, { label: 'Клиентов с месячным тарифом', min: 100, max: 900, step: 50, value: s.n1, format: String, onInput: (v) => ((s.n1 = v), draw()) });
    ui.slider(w.controls, { label: 'Доля ушедших среди месячных', min: 0, max: 1, step: 0.01, value: s.r1, format: f2, onInput: (v) => ((s.r1 = v), draw()) });
    ui.slider(w.controls, { label: 'Доля ушедших среди годовых', min: 0, max: 1, step: 0.01, value: s.r2, format: f2, onInput: (v) => ((s.r2 = v), draw()) });
    ui.segmented(w.controls, { label: 'Условие', value: s.cond, options: [{ value: 'all', label: 'все' }, { value: 'month', label: 'месячный' }, { value: 'year', label: 'годовой' }, { value: 'churn', label: 'ушёл' }, { value: 'stay', label: 'остался' }], onChange: (v) => ((s.cond = v), draw()) });
    const box = H('div', { style: 'overflow-x:auto' });
    w.main.appendChild(box);
    const fbox = texEl('', true, 'margin:8px 0');
    w.main.appendChild(fbox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pu', label: 'P(уход)' }, { key: 'um', label: 'P(уход | месячный)' }, { key: 'uy', label: 'P(уход | годовой)' }, { key: 'mu', label: 'P(месячный | уход)' }]);
    function draw() {
      const n1 = s.n1;
      const n2 = 1000 - n1;
      const a = Math.round(n1 * s.r1);
      const b = n1 - a;
      const c = Math.round(n2 * s.r2);
      const d = n2 - c;
      const cells = [[a, b, n1], [c, d, n2], [a + c, b + d, 1000]];
      const rowN = ['месячный', 'годовой', 'всего'];
      const colN = ['ушёл', 'остался', 'всего'];
      const on = (i, j) => {
        if (i === 2 || j === 2) return false;
        if (s.cond === 'all') return true;
        if (s.cond === 'month') return i === 0;
        if (s.cond === 'year') return i === 1;
        if (s.cond === 'churn') return j === 0;
        return j === 1;
      };
      const t = H('table', { class: 'data', style: 'min-width:300px;margin:0 auto' });
      t.appendChild(H('thead', null, H('tr', null, H('th', null, 'тариф \\ исход'), ...colN.map((cn) => H('th', { class: 'num' }, cn)))));
      const tb = H('tbody');
      cells.forEach((row, i) => {
        tb.appendChild(H('tr', null, H('th', { style: 'text-align:left' }, rowN[i]), ...row.map((v, j) => {
          const act = on(i, j);
          const key = i < 2 && j === 0;
          return H('td', { class: 'num', style: 'font-size:1.05rem;' + (act ? 'background:var(--accent-soft);font-weight:700;' + (key ? 'color:var(--accent);' : '') : i === 2 || j === 2 ? 'color:var(--ink-2)' : 'opacity:.35') }, String(v));
        })));
      });
      t.appendChild(tb);
      box.textContent = '';
      box.appendChild(t);
      const fr = (x, y) => (y ? f3(x / y) : '—');
      let tex;
      if (s.cond === 'all') tex = R`P(\text{уход}) = \frac{` + (a + c) + '}{1000} = ' + fr(a + c, 1000);
      else if (s.cond === 'month') tex = R`P(\text{уход} \mid \text{месячный}) = \frac{` + a + '}{' + n1 + '} = ' + fr(a, n1);
      else if (s.cond === 'year') tex = R`P(\text{уход} \mid \text{годовой}) = \frac{` + c + '}{' + n2 + '} = ' + fr(c, n2);
      else if (s.cond === 'churn') tex = R`P(\text{месячный} \mid \text{ушёл}) = \frac{` + a + '}{' + (a + c) + '} = ' + fr(a, a + c);
      else tex = R`P(\text{месячный} \mid \text{остался}) = \frac{` + b + '}{' + (b + d) + '} = ' + fr(b, b + d);
      texInto(fbox, tex, true);
      st.set('pu', fr(a + c, 1000));
      st.set('um', fr(a, n1));
      st.set('uy', fr(c, n2));
      st.set('mu', fr(a, a + c));
      const rise = n1 && a + c ? (a / n1) / ((a + c) / 1000) : NaN;
      note.innerHTML = 'Условие отбрасывает всё вне выбранной строки или столбца, и выбранная часть становится новым «всем». ' +
        'P(уход | месячный) = ' + fr(a, n1) + ', а P(месячный | уход) = ' + fr(a, a + c) + ': числитель тот же (' + a + '), знаменатели разные — ' + n1 + ' месячных и ' + (a + c) + ' ушедших. ' +
        (Number.isFinite(rise) ? 'Знание тарифа меняет вероятность ухода в ' + f2(rise) + ' раза по сравнению с безусловной.' : '') +
        (Math.abs(s.r1 - s.r2) < 0.005 ? ' <b>Доли ухода одинаковы — тариф и уход независимы</b> (шаг 11).' : '');
    }
    w.pythonAction(() => {
      const n1 = s.n1;
      const a = Math.round(n1 * s.r1);
      const c = Math.round((1000 - n1) * s.r2);
      return '# таблица: строки — тариф, столбцы — ушёл / остался\nmonth_churn, month_stay = ' + a + ', ' + (n1 - a) + '\nyear_churn, year_stay = ' + c + ', ' + (1000 - n1 - c) + '\nN = 1000\n\nchurn = month_churn + year_churn\nmonth = month_churn + month_stay\nprint("P(уход)              =", churn / N)\nprint("P(уход | месячный)   =", round(month_churn / month, 4))\nprint("P(уход | годовой)    =", round(year_churn / (N - month), 4))\nprint("P(месячный | уход)   =", round(month_churn / churn, 4) if churn else None)\n# определение: P(A | B) = P(A ∩ B) / P(B)\nprint("через определение:", (month_churn / N) / (month / N))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 7. Дерево вероятностей: урна
   * ============================================================================== */
  const TREE_EV = {
    all: ['все красные', (p) => p.every((c) => c === 'К')],
    one: ['ровно один красный', (p) => p.filter((c) => c === 'К').length === 1],
    blue: ['хотя бы один синий', (p) => p.includes('С')],
    second: ['второй шар красный', (p) => p[1] === 'К'],
    same: ['все одного цвета', (p) => p.every((c) => c === p[0])],
  };
  GBC.widget('prob-tree', (el) => {
    const s = { r: 3, b: 2, k: 2, repl: false, ev: 'one' };
    const w = ui.shell(el, { title: 'Дерево вероятностей', sub: 'Достаём шары из урны по одному. На ветвях — условные вероятности очередного шага, у листьев — вероятность всего пути (произведение ветвей). Выделены пути, где произошло выбранное событие; его вероятность — сумма выделенных листьев.' });
    ui.slider(w.controls, { label: 'Красных шаров', min: 1, max: 6, step: 1, value: s.r, format: String, onInput: (v) => ((s.r = v), draw()) });
    ui.slider(w.controls, { label: 'Синих шаров', min: 1, max: 6, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.segmented(w.controls, { label: 'Достаём', value: s.k, options: [{ value: 2, label: '2 шара' }, { value: 3, label: '3 шара' }], onChange: (v) => ((s.k = v), draw()) });
    ui.toggle(w.controls, { label: 'С возвращением', checked: s.repl, onChange: (v) => ((s.repl = v), draw()) });
    ui.select(w.controls, { label: 'Событие', value: s.ev, options: Object.entries(TREE_EV).map(([k, v]) => ({ value: k, label: v[0] })), onChange: (v) => ((s.ev = v), draw()) });
    const host = svgHost(w.main, 480);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'P(событие)' }, { key: 'n', label: 'путей в событии' }, { key: 'sum', label: 'сумма всех листьев' }]);
    let K = 2;
    function build() {
      K = s.repl ? s.k : Math.min(s.k, s.r + s.b);
      const leaves = [];
      function rec(path, r, b, num, den, edges) {
        if (path.length === K) {
          leaves.push({ path, num, den, edges });
          return;
        }
        const tot = r + b;
        for (const [c, cnt] of [['К', r], ['С', b]]) {
          const nr = s.repl ? r : c === 'К' ? r - 1 : r;
          const nb = s.repl ? b : c === 'С' ? b - 1 : b;
          rec(path.concat(c), Math.max(0, nr), Math.max(0, nb), num * cnt, den * tot, edges.concat([[cnt, tot]]));
        }
      }
      rec([], s.r, s.b, 1, 1, []);
      return leaves;
    }
    function draw() {
      const leaves = build();
      const ev = TREE_EV[s.ev][1];
      const nL = leaves.length;
      const rowH = K === 2 ? 52 : 34;
      const Wd = 540;
      const Ht = nL * rowH + 16;
      const colX = K === 2 ? [22, 170, 318] : [18, 128, 238, 348];
      const svg = S('svg', { viewBox: '0 0 ' + Wd + ' ' + Ht, width: '100%', role: 'img', 'aria-label': 'Дерево вероятностей', style: 'display:block;font-family:var(--font-sans)' });
      // координаты узлов: ключ — путь строкой
      const pos = {};
      leaves.forEach((L, i) => (pos[L.path.join('')] = 8 + rowH * (i + 0.5)));
      for (let d = K - 1; d >= 0; d--) {
        const keys = new Set(leaves.map((L) => L.path.slice(0, d).join('')));
        keys.forEach((kk) => (pos[kk] = (pos[kk + 'К'] + pos[kk + 'С']) / 2));
      }
      const leafIn = leaves.map((L) => ev(L.path) && L.num > 0);
      const nodeIn = (prefix) => leaves.some((L, i) => leafIn[i] && L.path.join('').startsWith(prefix));
      for (const L of leaves) {
        for (let d = 0; d < K; d++) {
          const from = L.path.slice(0, d).join('');
          const to = L.path.slice(0, d + 1).join('');
          const key = 'e' + to;
          if (svg.querySelector('[data-k="' + key + '"]')) continue;
          const [cnt, tot] = L.edges[d];
          const act = nodeIn(to);
          const zero = cnt === 0;
          const x1 = colX[d] + 10;
          const x2 = colX[d + 1] - 10;
          const y1 = pos[from];
          const y2 = pos[to];
          const g = S('g', { 'data-k': key });
          g.appendChild(S('line', { x1, y1, x2, y2, style: 'stroke:' + (act ? 'var(--accent)' : 'var(--border-strong)') + ';stroke-width:' + (act ? 2.6 : 1.4) + ';opacity:' + (zero ? 0.35 : 1) + (zero ? ';stroke-dasharray:3 3' : '') }));
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const lab = zero ? '0' : frac(cnt, tot);
          g.appendChild(S('rect', { x: mx - 17, y: my - 9, width: 34, height: 16, rx: 4, style: 'fill:var(--surface);opacity:.92' }));
          g.appendChild(S('text', { x: mx, y: my + 3.5, 'text-anchor': 'middle', style: 'font-size:11px;font-weight:' + (act ? 700 : 500) + ';fill:' + (act ? 'var(--accent)' : 'var(--ink-2)') }, lab));
          svg.appendChild(g);
        }
      }
      // узлы
      const dot = (x, y, c, act) => S('circle', { cx: x, cy: y, r: 9, style: 'fill:' + (c === 'К' ? C('red') : c === 'С' ? C('blue') : 'var(--surface-3)') + ';stroke:' + (act ? 'var(--ink)' : 'var(--surface)') + ';stroke-width:' + (act ? 2 : 1.5) });
      svg.appendChild(dot(colX[0], pos[''], null, false));
      svg.appendChild(S('text', { x: colX[0], y: pos[''] - 14, 'text-anchor': 'middle', style: 'font-size:10px;fill:var(--muted)' }, 'старт'));
      const seen = new Set();
      leaves.forEach((L) => {
        for (let d = 1; d <= K; d++) {
          const kk = L.path.slice(0, d).join('');
          if (seen.has(kk)) continue;
          seen.add(kk);
          const c = L.path[d - 1];
          svg.appendChild(dot(colX[d], pos[kk], c, nodeIn(kk)));
          svg.appendChild(S('text', { x: colX[d], y: pos[kk] + 3.5, 'text-anchor': 'middle', style: 'font-size:9px;font-weight:700;fill:#fff' }, c));
        }
      });
      // подписи листьев
      leaves.forEach((L, i) => {
        const act = leafIn[i];
        const x = colX[K] + 18;
        const y = pos[L.path.join('')] + 4;
        svg.appendChild(S('text', { x, y, style: 'font-size:12px;font-weight:' + (act ? 700 : 500) + ';fill:' + (act ? 'var(--accent)' : L.num ? 'var(--ink-2)' : 'var(--muted)') }, L.path.join('') + ':  ' + (L.num ? frac(L.num, L.den) + ' ≈ ' + f3(L.num / L.den) : '0')));
      });
      host.textContent = '';
      host.appendChild(svg);
      let pn = 0;
      let pd = 1;
      let sn = 0;
      let sd = 1;
      leaves.forEach((L, i) => {
        // сложение дробей
        if (L.num) {
          sn = sn * L.den + L.num * sd;
          sd = sd * L.den;
          const g1 = gcd(sn, sd);
          sn /= g1;
          sd /= g1;
        }
        if (leafIn[i]) {
          pn = pn * L.den + L.num * pd;
          pd = pd * L.den;
          const g2 = gcd(pn, pd);
          pn /= g2;
          pd /= g2;
        }
      });
      const cnt = leafIn.filter(Boolean).length;
      st.set('p', frac(pn, pd) + ' ≈ ' + f4(pn / pd));
      st.set('n', cnt + ' из ' + leaves.filter((L) => L.num).length);
      st.set('sum', frac(sn, sd));
      note.innerHTML = 'Урна: ' + s.r + ' красных и ' + s.b + ' синих, достаём ' + K + ' ' + (s.repl ? 'с возвращением — состав не меняется, ветви каждого уровня одинаковы' : 'без возвращения — после каждого шага состав урны меняется, и вероятности на ветвях тоже') + '. ' +
        'Событие «' + TREE_EV[s.ev][0] + '»: P = ' + frac(pn, pd) + ' ≈ ' + f4(pn / pd) + '.' + (s.ev === 'second' ? ' Это та же вероятность, что у первого шара (' + frac(s.r, s.r + s.b) + '): не зная первого, все позиции равноправны.' : '') +
        (s.ev === 'blue' ? ' Через дополнение: 1 − P(все красные).' : '');
    }
    w.pythonAction(() => PY_FR + 'r, b, k, replace = ' + s.r + ', ' + s.b + ', ' + K + ', ' + (s.repl ? 'True' : 'False') + '\n\ndef paths(r, b, k):\n    """Все пути дерева: (последовательность цветов, вероятность)."""\n    if k == 0:\n        yield "", Fraction(1)\n        return\n    for c, cnt in (("К", r), ("С", b)):\n        if cnt == 0:\n            continue\n        nr, nb = (r, b) if replace else ((r - 1, b) if c == "К" else (r, b - 1))\n        for rest, p in paths(nr, nb, k - 1):\n            yield c + rest, Fraction(cnt, r + b) * p\n\nleaves = dict(paths(r, b, k))\nfor path, p in leaves.items():\n    print(path, p)\nprint("сумма листьев:", sum(leaves.values()))\nprint("ровно один красный:", sum(p for path, p in leaves.items() if path.count("К") == 1))\nprint("второй красный:", sum(p for path, p in leaves.items() if path[1] == "К"))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 8. Формула полной вероятности — мозаика
   * ============================================================================== */
  const TP_PRESETS = {
    traffic: { names: ['реклама', 'поиск', 'рассылка'], ev: 'покупка', pri: [0.5, 0.3], cond: [0.02, 0.05, 0.1] },
    plants: { names: ['завод 1', 'завод 2', 'завод 3'], ev: 'брак', pri: [0.6, 0.4], cond: [0.01, 0.03, 0.05] },
  };
  GBC.widget('total-prob', (el) => {
    const s = { preset: 'traffic', p1: 0.5, p2: 0.3, c: [0.02, 0.05, 0.1], bayes: true };
    const w = ui.shell(el, { title: 'Полная вероятность: площадь мозаики', sub: 'Ширина полосы — доля случая P(Hᵢ), высота закрашенной части — P(A | Hᵢ). Площадь закрашенного = P(A | Hᵢ)·P(Hᵢ), а их сумма — P(A). Доли закрашенных площадей — апостериорные вероятности P(Hᵢ | A).' });
    const sel = ui.select(w.controls, { label: 'Пример', value: s.preset, options: [{ value: 'traffic', label: 'источники трафика' }, { value: 'plants', label: 'заводы и брак' }], onChange: (v) => applyPreset(v) });
    const sp1 = ui.slider(w.controls, { label: 'P(H₁)', min: 0, max: 1, step: 0.01, value: s.p1, format: f2, onInput: (v) => ((s.p1 = v), fixP(1), draw()) });
    const sp2 = ui.slider(w.controls, { label: 'P(H₂)', min: 0, max: 1, step: 0.01, value: s.p2, format: f2, onInput: (v) => ((s.p2 = v), fixP(2), draw()) });
    const sc = [0, 1, 2].map((i) => ui.slider(w.controls, { label: 'P(A | H' + '₁₂₃'[i] + ')', min: 0, max: 0.5, step: 0.005, value: s.c[i], format: f3, onInput: (v) => ((s.c[i] = v), draw()) }));
    ui.toggle(w.controls, { label: 'Байес: P(Hᵢ | A)', checked: s.bayes, onChange: (v) => ((s.bayes = v), draw()) });
    function fixP(which) {
      if (s.p1 + s.p2 > 1) {
        if (which === 1) (s.p2 = Math.round((1 - s.p1) * 100) / 100), sp2.set(s.p2);
        else (s.p1 = Math.round((1 - s.p2) * 100) / 100), sp1.set(s.p1);
      }
    }
    function applyPreset(v) {
      const P = TP_PRESETS[v];
      s.preset = v;
      s.p1 = P.pri[0];
      s.p2 = P.pri[1];
      s.c = P.cond.slice();
      sp1.set(s.p1);
      sp2.set(s.p2);
      sc.forEach((x, i) => x.set(s.c[i]));
      sel.set(v);
      draw();
    }
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'доля случая P(Hᵢ)', domain: [0, 1] }, y: { label: 'P(A | Hᵢ)' } });
    const plot2 = new GBC.Plot(w.main, { height: 200, x: { label: '', domain: [-0.6, 2.6], ticks: [0, 1, 2], format: (t) => TP_PRESETS[s.preset].names[Math.round(t)] || '' }, y: { label: 'вероятность', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pa', label: 'P(A) = Σ P(A | Hᵢ)·P(Hᵢ)' }, { key: 'post', label: 'P(H₁ | A), P(H₂ | A), P(H₃ | A)' }]);
    function draw() {
      const P = TP_PRESETS[s.preset];
      const pri = [s.p1, s.p2, Math.max(0, 1 - s.p1 - s.p2)];
      const joint = pri.map((p, i) => p * s.c[i]);
      const pa = U.sum(joint);
      const post = joint.map((j) => (pa > 0 ? j / pa : 0));
      const ymax = Math.max(0.05, ...s.c) * 1.25;
      const cols = ['blue', 'orange', 'aqua'];
      const L = [];
      let x = 0;
      pri.forEach((p, i) => {
        if (p > 1e-9) {
          L.push({ type: 'rect', x0: x, x1: x + p, y0: 0, y1: ymax, fill: cols[i], opacity: 0.1, stroke: 'border', width: 1 });
          L.push({ type: 'rect', x0: x, x1: x + p, y0: 0, y1: s.c[i], fill: cols[i], opacity: 0.75, color: cols[i], label: P.names[i] + ': ' + f3(p) + ' × ' + f3(s.c[i]) + ' = ' + f4(joint[i]) });
          if (p > 0.08) L.push({ type: 'text', items: [{ x: x + p / 2, y: ymax * 0.93, text: P.names[i], anchor: 'middle', bold: true }] });
        }
        x += p;
      });
      plot.opts.y.label = 'P(' + P.ev + ' | Hᵢ)';
      plot.render(L, { y: [0, ymax] });
      if (s.bayes) {
        plot2.root.style.display = '';
        plot2.render([
          { type: 'bars', x: [-0.18, 0.82, 1.82], y: pri, color: 'data', width: 0.34, opacity: 0.55, label: 'до: P(Hᵢ)', tooltip: (i) => [['до', f3(pri[i])]] },
          { type: 'bars', x: [0.18, 1.18, 2.18], y: post, color: (i) => cols[i], legendColor: 'model', width: 0.34, label: 'после: P(Hᵢ | ' + P.ev + ')', tooltip: (i) => [['после', f3(post[i])]] },
          { type: 'text', items: post.map((p, i) => ({ x: i + 0.18, y: p + 0.04, text: f2(p), anchor: 'middle' })) },
        ]);
      } else plot2.root.style.display = 'none';
      st.set('pa', f4(pa));
      st.set('post', post.map(f3).join(', '));
      const top = U.argmax(post);
      note.innerHTML = 'P(' + P.ev + ') = ' + joint.map((j, i) => f3(pri[i]) + '·' + f3(s.c[i])).join(' + ') + ' = ' + f4(pa) + '. ' +
        (pa > 0 ? 'Узнав, что произошло «' + P.ev + '», смотрим лишь на закрашенные куски: чаще всего это «' + P.names[top] + '» — ' + pct(post[top]) + ' (до наблюдения — ' + pct(pri[top]) + '). Это и есть формула Байеса (шаг 9).' : 'Событие невозможно ни в одном случае.');
    }
    w.pythonAction(() => {
      const pri = [s.p1, s.p2, Math.max(0, 1 - s.p1 - s.p2)];
      return PY_NP + 'prior = np.array([' + pri.map(py).join(', ') + '])      # P(H_i): ' + TP_PRESETS[s.preset].names.join(', ') + '\ncond = np.array([' + s.c.map(py).join(', ') + '])       # P(A | H_i)\n\njoint = prior * cond\npA = joint.sum()                       # формула полной вероятности\nprint("P(A) =", round(pA, 6))\nprint("P(H_i | A) =", (joint / pA).round(4))   # формула Байеса\n';
    });
    applyPreset('traffic');
  });

  /* ==============================================================================
   * Шаг 9. Формула Байеса на сетке из 1000 человек
   * ============================================================================== */
  GBC.widget('bayes-grid', (el) => {
    const s = { prev: 0.01, sens: 0.99, spec: 0.95 };
    const w = ui.shell(el, { title: 'Формула Байеса: 1000 человек сдали тест', sub: 'Болезнь редкая, тест точный. Человек получил положительный результат. Какова вероятность, что он болен? Каждая клетка — человек. Внизу — как ответ зависит от доли больных.' });
    ui.slider(w.controls, { label: 'Доля больных P(болен)', min: 0.001, max: 0.3, log: true, value: s.prev, format: (v) => U.fmt(100 * v, 2) + ' %', onInput: (v) => ((s.prev = v), draw()) });
    ui.slider(w.controls, { label: 'Чувствительность P(+ | болен)', min: 0.5, max: 1, step: 0.01, value: s.sens, format: f2, onInput: (v) => ((s.sens = v), draw()) });
    ui.slider(w.controls, { label: 'Специфичность P(− | здоров)', min: 0.5, max: 0.999, step: 0.001, value: s.spec, format: f3, onInput: (v) => ((s.spec = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main, 640), { height: 290, equal: true, x: { label: '', domain: [-0.5, 49.5], ticks: [] }, y: { label: '', domain: [-0.5, 19.5], ticks: [] }, grid: 'none', margin: { left: 12, bottom: 12 } });
    const plot2 = new GBC.Plot(w.main, { height: 190, x: { label: 'доля больных (лог.)', type: 'log', domain: [0.001, 0.5], ticks: [0.001, 0.01, 0.1, 0.5], format: (v) => U.fmt(100 * v, v < 0.01 ? 1 : 0) + ' %' }, y: { label: 'P(болен | +)', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'tp', label: 'больны и «+»' }, { key: 'fp', label: 'здоровы, но «+»' }, { key: 'post', label: 'P(болен | +)' }, { key: 'npv', label: 'P(здоров | −)' }]);
    const postOf = (pr) => (pr * s.sens) / (pr * s.sens + (1 - pr) * (1 - s.spec));
    function draw() {
      const N = 1000;
      const sick = Math.round(N * s.prev);
      const tp = Math.round(sick * s.sens);
      const fn = sick - tp;
      const fp = Math.round((N - sick) * (1 - s.spec));
      const groups = [['red', tp, 'больны, тест «+»'], ['magenta', fn, 'больны, тест «−»'], ['orange', fp, 'здоровы, тест «+»'], ['muted', N - sick - fp, 'здоровы, тест «−»']];
      const layers = [];
      let idx = 0;
      for (const [color, cnt, label] of groups) {
        const xs = [];
        const ys = [];
        for (let i = 0; i < cnt; i++, idx++) (xs.push(idx % 50), ys.push(19 - Math.floor(idx / 50)));
        layers.push({ type: 'points', x: xs, y: ys, color, r: 3.6, label: label + ' (' + cnt + ')', shape: 'square' });
      }
      plot.render(layers);
      const post = postOf(s.prev);
      const npv = ((1 - s.prev) * s.spec) / ((1 - s.prev) * s.spec + s.prev * (1 - s.sens));
      const xs = U.range(121).map((i) => Math.pow(10, -3 + (Math.log10(0.5) + 3) * (i / 120)));
      plot2.render([
        { type: 'line', x: xs, y: xs.map(postOf), color: 'model', width: 2.2, label: 'P(болен | +)' },
        { type: 'line', x: xs, y: xs, color: 'muted', width: 1.2, dash: '4 4', label: 'доля больных (без теста)' },
        { type: 'points', x: [s.prev], y: [post], color: 'tree', r: 6 },
      ]);
      st.set('tp', String(tp) + ' (точно ' + f1(N * s.prev * s.sens) + ')');
      st.set('fp', String(fp) + ' (точно ' + f1(N * (1 - s.prev) * (1 - s.spec)) + ')');
      st.set('post', pf(post));
      st.set('npv', pf(npv));
      note.innerHTML = 'Из ' + (tp + fp) + ' человек с положительным тестом больны ' + tp + '. Формула Байеса: P(болен | +) = ' + f4(s.prev) + '·' + f2(s.sens) + ' / (' + f4(s.prev) + '·' + f2(s.sens) + ' + ' + f4(1 - s.prev) + '·' + f3(1 - s.spec) + ') = <b>' + pct(post) + '</b>. ' +
        (post < 0.5 ? 'Ложные тревоги среди многочисленных здоровых перевешивают настоящих больных.' : 'Болезнь достаточно частая (или тест достаточно специфичен), и положительный результат убедителен.') +
        ' Отрицательный результат почти наверняка верен: P(здоров | −) = ' + pf(npv) + '.';
    }
    w.pythonAction(() => 'prev, sens, spec = ' + py(s.prev) + ', ' + py(s.sens) + ', ' + py(s.spec) + '\n\n# натуральные частоты на 1000 человек\nsick = 1000 * prev\ntp, fp = sick * sens, (1000 - sick) * (1 - spec)\nprint(f"больны и «+»: {tp:.1f}, здоровы и «+»: {fp:.1f}")\nprint("P(болен | +) =", round(tp / (tp + fp), 4))\n# то же по формуле Байеса\nprint("Байес:", round(prev * sens / (prev * sens + (1 - prev) * (1 - spec)), 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 10. Байес в шансах и логитах: последовательное обновление
   * ============================================================================== */
  GBC.widget('bayes-update', (el) => {
    const s = { prev: 0.01, sens: 0.99, spec: 0.95, seq: ['+', '+', '−'] };
    const w = ui.shell(el, { title: 'Свидетельства складываются в логитах', sub: 'Каждый результат теста умножает шансы на отношение правдоподобий LR, то есть прибавляет ln LR к логарифму шансов. Добавляйте результаты кнопками. Тесты считаются независимыми при данном состоянии человека.' });
    ui.slider(w.controls, { label: 'Априорная вероятность', min: 0.001, max: 0.5, log: true, value: s.prev, format: (v) => U.fmt(100 * v, 2) + ' %', onInput: (v) => ((s.prev = v), draw()) });
    ui.slider(w.controls, { label: 'Чувствительность', min: 0.5, max: 0.999, step: 0.001, value: s.sens, format: f3, onInput: (v) => ((s.sens = v), draw()) });
    ui.slider(w.controls, { label: 'Специфичность', min: 0.5, max: 0.999, step: 0.001, value: s.spec, format: f3, onInput: (v) => ((s.spec = v), draw()) });
    const row = H('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
    w.controls.appendChild(row);
    ui.button(row, { label: '+ положительный', onClick: () => (s.seq.length < 8 && s.seq.push('+'), draw()) });
    ui.button(row, { label: '− отрицательный', onClick: () => (s.seq.length < 8 && s.seq.push('−'), draw()) });
    ui.button(row, { label: 'Сброс', onClick: () => ((s.seq = []), draw()) });
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'после теста №', domain: [-0.5, 8.5], ticks: U.range(9) }, y: { label: 'логарифм шансов' } });
    const plot2 = new GBC.Plot(w.main, { height: 180, x: { label: 'после теста №', domain: [-0.5, 8.5], ticks: U.range(9) }, y: { label: 'вероятность', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'lr', label: 'LR₊ / LR₋' }, { key: 'l', label: 'ln LR₊ / ln LR₋' }, { key: 'o', label: 'шансы сейчас' }, { key: 'p', label: 'вероятность сейчас' }]);
    function draw() {
      const lrp = s.sens / (1 - s.spec);
      const lrn = (1 - s.sens) / s.spec;
      const l0 = Math.log(s.prev / (1 - s.prev));
      const logits = [l0];
      s.seq.forEach((r) => logits.push(logits[logits.length - 1] + Math.log(r === '+' ? lrp : lrn)));
      const probs = logits.map((l) => 1 / (1 + Math.exp(-l)));
      const bars = [];
      const L = [{ type: 'hline', y: 0, color: 'muted', width: 1.2, dash: '4 4' }];
      // «водопад»: старт и приращения
      L.push({ type: 'rect', x0: -0.3, x1: 0.3, y0: 0, y1: l0, fill: 'data', opacity: 0.7, color: 'data', label: 'априорный логит' });
      s.seq.forEach((r, i) => {
        L.push({ type: 'rect', x0: i + 0.7, x1: i + 1.3, y0: logits[i], y1: logits[i + 1], fill: r === '+' ? 'pos' : 'neg', opacity: 0.75, color: r === '+' ? 'pos' : 'neg', label: i === s.seq.indexOf(r) ? (r === '+' ? '+ ln LR₊' : '+ ln LR₋') : null });
        bars.push(r);
      });
      L.push({ type: 'line', x: logits.map((_, i) => i), y: logits, color: 'ink2', width: 1.4, dash: '3 3', hover: false });
      L.push({ type: 'points', x: logits.map((_, i) => i), y: logits, color: 'model', r: 4.5, tooltip: (i) => [['логит', f3(logits[i])], ['вероятность', pf(probs[i])]] });
      plot.render(L, { y: yDom(logits.concat([0]), 0.12) });
      plot2.render([
        { type: 'hline', y: 0.5, color: 'muted', width: 1, dash: '4 4' },
        { type: 'line', x: probs.map((_, i) => i), y: probs, color: 'model', width: 2.2, hover: false },
        { type: 'points', x: probs.map((_, i) => i), y: probs, color: 'model', r: 4.5, tooltip: (i) => [['после теста', String(i)], ['P', pf(probs[i])]] },
        { type: 'text', items: probs.map((p, i) => ({ x: i, y: p > 0.85 ? p - 0.1 : p + 0.07, text: f3(p), anchor: 'middle' })) },
      ]);
      const ol = logits[logits.length - 1];
      st.set('lr', f2(lrp) + ' / ' + f4(lrn));
      st.set('l', f3(Math.log(lrp)) + ' / ' + f3(Math.log(lrn)));
      st.set('o', sci(Math.exp(ol)));
      st.set('p', pf(probs[probs.length - 1]));
      note.innerHTML = 'Результаты: ' + (s.seq.length ? s.seq.join(' ') : 'пока нет') + '. Старт: логит ln(' + f4(s.prev) + '/' + f4(1 - s.prev) + ') = ' + f3(l0) + '. ' +
        (s.seq.length ? 'Сейчас: ' + f3(l0) + ' ' + s.seq.map((r) => (r === '+' ? '+ ' + f3(Math.log(lrp)) : '− ' + f3(-Math.log(lrn)))).join(' ') + ' = ' + f3(ol) + ', вероятность ' + pf(probs[probs.length - 1]) + '. ' : '') +
        'Вклады просто складываются — так же устроена модель бустинга для классификации: F(x) = F₀ + Σ деревьев, где F₀ — априорный логит, а F — логарифм шансов.';
    }
    w.pythonAction(() => 'import math\n\nprev, sens, spec = ' + py(s.prev) + ', ' + py(s.sens) + ', ' + py(s.spec) + '\nresults = "' + s.seq.join('').replace(/−/g, '-') + '"          # «+» и «-»\n\nlr_pos, lr_neg = sens / (1 - spec), (1 - sens) / spec\nlogit = math.log(prev / (1 - prev))\nprint(f"старт: логит {logit:.3f}, P = {prev}")\nfor r in results:\n    logit += math.log(lr_pos if r == "+" else lr_neg)\n    print(f"после «{r}»: логит {logit:.3f}, P = {1 / (1 + math.exp(-logit)):.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 11. «Хотя бы один»
   * ============================================================================== */
  GBC.widget('at-least-one', (el) => {
    const s = { p: 0.05, n: 20 };
    const w = ui.shell(el, { title: 'Хотя бы один успех из n независимых попыток', sub: 'P(хотя бы один) = 1 − (1 − p)ⁿ. Кривая растёт быстро даже при маленьком p: редкое событие при многих попытках становится почти неизбежным.' });
    const sp = ui.slider(w.controls, { label: 'Вероятность в одной попытке p', min: 0.001, max: 0.5, log: true, value: s.p, format: (v) => U.fmt(v, 4), onInput: (v) => ((s.p = v), draw()) });
    const sn = ui.slider(w.controls, { label: 'Попыток n', min: 1, max: 200, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const preset = (p, n) => () => ((s.p = p), (s.n = n), sp.set(p), sn.set(n), draw());
    ui.button(w.controls, { label: 'Де Мере: шестёрка за 4 броска', onClick: preset(1 / 6, 4) });
    ui.button(w.controls, { label: 'Две шестёрки за 24 броска', onClick: preset(1 / 36, 24) });
    ui.button(w.controls, { label: '20 гипотез при 5 %', onClick: preset(0.05, 20) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'число попыток n', domain: [1, 200] }, y: { label: 'P(хотя бы один)', domain: [0, 1] }, crosshair: true });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'P', label: 'P(хотя бы один)' }, { key: 'e', label: 'приближение 1 − e^{−np}' }, { key: 'h', label: 'n для 50 % / 95 %' }, { key: 'm', label: 'среднее число успехов np' }]);
    function draw() {
      const { p, n } = s;
      const nmax = Math.max(200, n);
      const ns = U.range(nmax, 1);
      const P = 1 - Math.pow(1 - p, n);
      const n50 = Math.ceil(Math.log(0.5) / Math.log(1 - p));
      const n95 = Math.ceil(Math.log(0.05) / Math.log(1 - p));
      plot.render([
        { type: 'line', x: ns, y: ns.map((k) => 1 - Math.pow(1 - p, k)), color: 'model', width: 2.2, label: '1 − (1 − p)ⁿ' },
        { type: 'line', x: ns, y: ns.map((k) => Math.min(1, k * p)), color: 'muted', width: 1.2, dash: '4 4', label: 'n·p (оценка сверху)' },
        { type: 'hline', y: 0.5, color: 'border', width: 1 },
        { type: 'points', x: [n], y: [P], color: 'tree', r: 6 },
      ], { x: [1, nmax] });
      st.set('P', pf(P));
      st.set('e', pf(1 - Math.exp(-n * p)));
      st.set('h', n50 + ' / ' + n95);
      st.set('m', f3(n * p));
      note.innerHTML = 'P(ни одного) = (1 − ' + f4(p) + ')^' + n + ' = ' + pf(1 - P) + ', значит, P(хотя бы один) = <b>' + pf(P) + '</b>. ' +
        'Чтобы шанс превысил ½, нужно ' + n50 + ' ' + plural(n50, 'попытка', 'попытки', 'попыток') + '; для 95 % — ' + n95 + '. Оценка «n·p» (по правилу P(A ∪ B) ≤ P(A) + P(B)) хороша лишь пока np мало — дальше она превышает 1, а настоящая вероятность нет.' +
        (Math.abs(p - 0.05) < 1e-9 && n === 20 ? ' Двадцать проверок при уровне 5 % дают хотя бы одно «открытие» по чистой случайности с вероятностью 64 % — проблема множественных сравнений.' : '');
    }
    w.pythonAction(() => 'p, n = ' + py(s.p) + ', ' + s.n + '\nprint("P(хотя бы один) =", round(1 - (1 - p) ** n, 4))\nimport math\nprint("n для 50 %:", math.ceil(math.log(0.5) / math.log(1 - p)), " для 95 %:", math.ceil(math.log(0.05) / math.log(1 - p)))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 12. Монти Холл
   * ============================================================================== */
  GBC.widget('monty-hall', (el) => {
    const s = { phase: 'pick', car: 0, pick: null, open: null, final: null, game: 1, stay: [0, 0], sw: [0, 0], blind: false, N: 1000, seed: 1, simDone: false };
    const w = ui.shell(el, { title: 'Монти Холл: менять дверь или нет?', sub: 'Сыграйте несколько раз руками, затем запустите симуляцию тысяч игр. Ведущий знает, где автомобиль, и всегда открывает дверь с козой (если не включить «ведущий не знает»).' });
    ui.toggle(w.controls, { label: 'Ведущий не знает, где автомобиль', checked: s.blind, onChange: (v) => ((s.blind = v), newGame(), sim()) });
    ui.slider(w.controls, { label: 'Игр в симуляции', values: [10, 30, 100, 300, 1000, 3000, 10000], value: s.N, format: String, onInput: (v) => ((s.N = v), sim()) });
    ui.button(w.controls, { label: 'Новая симуляция', onClick: () => (s.seed++, sim()) });
    ui.button(w.controls, { label: 'Новая игра', kind: 'primary', onClick: () => newGame() });
    const doors = H('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:420px;margin:4px auto 8px' });
    w.main.appendChild(doors);
    const act = H('div', { style: 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:6px' });
    w.main.appendChild(act);
    const msg = H('p', { class: 'widget-note', style: 'text-align:center;margin:4px 0 10px' });
    w.main.appendChild(msg);
    const plot = new GBC.Plot(w.main, { height: 230, x: { label: 'сыграно игр (лог.)', type: 'log', domain: [1, 10000], ticks: [1, 10, 100, 1000, 10000] }, y: { label: 'доля выигрышей', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'hs', label: 'ваши игры: «остаться»' }, { key: 'hw', label: 'ваши игры: «сменить»' }, { key: 'ss', label: 'симуляция: остаться' }, { key: 'sw', label: 'симуляция: сменить' }]);
    const gameRng = () => new GBC.RNG(1000 + s.game * 7919);
    function newGame() {
      s.game++;
      const rng = gameRng();
      s.car = rng.randint(3);
      s.phase = 'pick';
      s.pick = null;
      s.open = null;
      s.final = null;
      drawGame();
    }
    function pickDoor(i) {
      if (s.phase !== 'pick') return;
      s.pick = i;
      const rng = gameRng();
      rng.random();
      const others = [0, 1, 2].filter((d) => d !== i);
      if (s.blind) s.open = others[rng.randint(2)];
      else {
        const goats = others.filter((d) => d !== s.car);
        s.open = goats[goats.length === 2 ? rng.randint(2) : 0];
      }
      s.phase = s.open === s.car ? 'void' : 'decide';
      drawGame();
    }
    function decide(change) {
      if (s.phase !== 'decide') return;
      s.final = change ? [0, 1, 2].find((d) => d !== s.pick && d !== s.open) : s.pick;
      const win = s.final === s.car;
      const arr = change ? s.sw : s.stay;
      arr[0] += win ? 1 : 0;
      arr[1] += 1;
      s.phase = 'done';
      drawGame();
    }
    function drawGame() {
      doors.textContent = '';
      for (let i = 0; i < 3; i++) {
        const opened = s.open === i || s.phase === 'done' || s.phase === 'void';
        const isCar = i === s.car;
        let label = 'Дверь ' + (i + 1);
        if (opened) label += isCar ? ': автомобиль' : ': коза';
        const b = ui.button(doors, { label, kind: s.pick === i ? 'primary' : '', onClick: () => pickDoor(i) });
        b.style.minHeight = '64px';
        b.style.whiteSpace = 'normal';
        b.style.justifyContent = 'center';
        if (opened && isCar) b.style.outline = '3px solid var(--good)';
        if (s.phase !== 'pick') b.disabled = true;
      }
      act.textContent = '';
      if (s.phase === 'decide') {
        ui.button(act, { label: 'Остаться при двери ' + (s.pick + 1), onClick: () => decide(false) });
        ui.button(act, { label: 'Сменить дверь', kind: 'primary', onClick: () => decide(true) });
      }
      const texts = {
        pick: 'Выберите дверь.',
        decide: 'Ведущий открыл дверь ' + (s.open + 1) + ' — там коза. Остаться или сменить?',
        void: 'Ведущий случайно открыл дверь с автомобилем — игра не считается. Нажмите «Новая игра».',
        done: s.final === s.car ? 'Выигрыш! Автомобиль за дверью ' + (s.car + 1) + '.' : 'Коза. Автомобиль был за дверью ' + (s.car + 1) + '.',
      };
      msg.textContent = texts[s.phase];
      st.set('hs', s.stay[0] + ' из ' + s.stay[1]);
      st.set('hw', s.sw[0] + ' из ' + s.sw[1]);
    }
    function sim() {
      const rng = new GBC.RNG(s.seed);
      let played = 0;
      let ws = 0;
      let wsw = 0;
      const xs = [];
      const ys1 = [];
      const ys2 = [];
      for (let g = 0; played < s.N && g < 100 * s.N; g++) {
        const car = rng.randint(3);
        const pick = rng.randint(3);
        const others = [0, 1, 2].filter((d) => d !== pick);
        let open;
        if (s.blind) open = others[rng.randint(2)];
        else {
          const goats = others.filter((d) => d !== car);
          open = goats.length === 2 ? goats[rng.randint(2)] : goats[0];
        }
        if (open === car) continue;
        played++;
        if (pick === car) ws++;
        else wsw++;
        if (played < 50 || played % Math.ceil(played / 60) === 0 || played === s.N) (xs.push(played), ys1.push(ws / played), ys2.push(wsw / played));
      }
      plot.render([
        { type: 'hline', y: s.blind ? 0.5 : 2 / 3, color: 'tree', dash: '5 4', width: 1.2 },
        { type: 'hline', y: s.blind ? 0.5 : 1 / 3, color: 'model', dash: '5 4', width: 1.2 },
        { type: 'line', x: xs, y: ys2, color: 'tree', width: 2.2, label: 'сменить' },
        { type: 'line', x: xs, y: ys1, color: 'model', width: 2.2, label: 'остаться' },
      ], { x: [1, Math.max(10, s.N)] });
      st.set('ss', played ? pf(ws / played) : '—');
      st.set('sw', played ? pf(wsw / played) : '—');
      note.innerHTML = s.blind
        ? 'Ведущий открывает дверь наугад; игры, где он случайно показал автомобиль, отброшены (' + played + ' игр осталось). Теперь обе стратегии выигрывают примерно в половине случаев: открытая коза — случайность, а не подсказка.'
        : 'В ' + played + ' играх «остаться» выиграло ' + pf(ws / played) + ', «сменить» — ' + pf(wsw / played) + '. Остаться — значит выиграть, только если первый выбор был верным (1/3). Сменить — выиграть во всех остальных случаях (2/3): ведущий своим знанием убрал вторую козу.';
    }
    w.pythonAction(() => PY_RNG + '\nrng = Mulberry32(' + s.seed + ')\nblind_host = ' + (s.blind ? 'True' : 'False') + '\nplayed = stay_wins = switch_wins = 0\nwhile played < ' + s.N + ':\n    car, pick = rng.randint(3), rng.randint(3)\n    others = [d for d in range(3) if d != pick]\n    if blind_host:\n        opened = others[rng.randint(2)]\n    else:\n        goats = [d for d in others if d != car]\n        opened = goats[rng.randint(2)] if len(goats) == 2 else goats[0]\n    if opened == car:          # ведущий случайно показал автомобиль — игра не считается\n        continue\n    played += 1\n    stay_wins += pick == car\n    switch_wins += pick != car\nprint("остаться:", stay_wins / played, " сменить:", switch_wins / played)\n');
    newGame();
    sim();
  });

  /* ==============================================================================
   * Шаг 12. Парадокс Симпсона
   * ============================================================================== */
  GBC.widget('simpson', (el) => {
    const RATE = { A: [81 / 87, 192 / 263], B: [234 / 270, 55 / 80] };
    const s = { wA: 263 / 350, wB: 80 / 350 };
    const w = ui.shell(el, { title: 'Парадокс Симпсона', sub: 'Успех лечения по группам (маленькие и большие камни) фиксирован по реальным данным. Ползунки меняют, какая доля пациентов каждого способа была с большими камнями. Общий процент — взвешенное среднее групповых.' });
    const sa = ui.slider(w.controls, { label: 'Доля больших камней у A', min: 0, max: 1, step: 0.01, value: s.wA, format: f2, onInput: (v) => ((s.wA = v), draw()) });
    const sb = ui.slider(w.controls, { label: 'Доля больших камней у B', min: 0, max: 1, step: 0.01, value: s.wB, format: f2, onInput: (v) => ((s.wB = v), draw()) });
    ui.button(w.controls, { label: 'Реальные данные (1986)', onClick: () => ((s.wA = 263 / 350), (s.wB = 80 / 350), sa.set(s.wA), sb.set(s.wB), draw()) });
    ui.button(w.controls, { label: 'Одинаковый состав групп', onClick: () => ((s.wA = 0.5), (s.wB = 0.5), sa.set(0.5), sb.set(0.5), draw()) });
    const names = ['маленькие', 'большие', 'всего'];
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: '', domain: [-0.6, 2.6], ticks: [0, 1, 2], format: (t) => names[Math.round(t)] || '' }, y: { label: 'доля успешных', domain: [0, 1.08] } });
    const plot2 = new GBC.Plot(w.main, { height: 190, x: { label: 'доля больших камней среди пациентов способа', domain: [0, 1] }, y: { label: 'общий успех', domain: [0.6, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'общий успех A' }, { key: 'b', label: 'общий успех B' }, { key: 'w', label: 'лучше в целом' }]);
    function draw() {
      const tA = s.wA * RATE.A[1] + (1 - s.wA) * RATE.A[0];
      const tB = s.wB * RATE.B[1] + (1 - s.wB) * RATE.B[0];
      const yA = [RATE.A[0], RATE.A[1], tA];
      const yB = [RATE.B[0], RATE.B[1], tB];
      plot.render([
        { type: 'bars', x: [-0.18, 0.82, 1.82], y: yA, color: 'blue', width: 0.34, label: 'способ A', tooltip: (i) => [['A', pct(yA[i])]] },
        { type: 'bars', x: [0.18, 1.18, 2.18], y: yB, color: 'orange', width: 0.34, label: 'способ B', tooltip: (i) => [['B', pct(yB[i])]] },
        { type: 'text', items: [...yA.map((v, i) => ({ x: i - 0.18, y: v + 0.03, text: pct(v, 0), anchor: 'middle' })), ...yB.map((v, i) => ({ x: i + 0.18, y: v + 0.03, text: pct(v, 0), anchor: 'middle' }))] },
      ]);
      const ws = U.linspace(0, 1, 51);
      plot2.render([
        { type: 'line', x: ws, y: ws.map((v) => v * RATE.A[1] + (1 - v) * RATE.A[0]), color: 'blue', width: 2, label: 'A' },
        { type: 'line', x: ws, y: ws.map((v) => v * RATE.B[1] + (1 - v) * RATE.B[0]), color: 'orange', width: 2, dash: '6 4', label: 'B' },
        { type: 'points', x: [s.wA], y: [tA], color: 'blue', r: 6 },
        { type: 'points', x: [s.wB], y: [tB], color: 'orange', r: 6 },
      ]);
      st.set('a', pct(tA));
      st.set('b', pct(tB));
      st.set('w', tA > tB + 1e-9 ? 'A' : tB > tA + 1e-9 ? 'B' : 'поровну');
      note.innerHTML = 'В каждой группе A лучше B (93 % против 87 % и 73 % против 69 %). ' + (tB > tA ? '<b>Но в целом B выглядит лучше</b> (' + pct(tB) + ' против ' + pct(tA) + '): у A доля тяжёлых случаев ' + pct(s.wA, 0) + ', у B — ' + pct(s.wB, 0) + '. Линия A всегда выше линии B, но точка A сидит далеко справа, в области тяжёлых случаев.' : 'При таком составе групп общий процент честно показывает преимущество A. Парадокс возникает, только когда состав групп у способов сильно различается.');
    }
    w.pythonAction(() => PY_NP + '# успехи / пациенты: [маленькие, большие]\nA = np.array([[81, 87], [192, 263]])\nB = np.array([[234, 270], [55, 80]])\nfor name, T in (("A", A), ("B", B)):\n    by_group = T[:, 0] / T[:, 1]\n    total = T[:, 0].sum() / T[:, 1].sum()\n    print(name, "по группам:", by_group.round(3), " всего:", round(total, 3), " доля больших:", round(T[1, 1] / T[:, 1].sum(), 3))\n\nwA, wB = ' + f4(s.wA) + ', ' + f4(s.wB) + '      # доли больших камней (как в виджете)\nrate = lambda T, w: w * T[1, 0] / T[1, 1] + (1 - w) * T[0, 0] / T[0, 1]\nprint("общий успех при этих долях: A", round(rate(A, wA), 4), " B", round(rate(B, wB), 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 13. Закон распределения и функция распределения на кубиках
   * ============================================================================== */
  const RVS = {
    sum: ['сумма', (a, b) => a + b, 'a + b'],
    max: ['максимум', (a, b) => Math.max(a, b), 'max(a, b)'],
    min: ['минимум', (a, b) => Math.min(a, b), 'min(a, b)'],
    diff: ['|разность|', (a, b) => Math.abs(a - b), 'abs(a - b)'],
    sixes: ['число шестёрок', (a, b) => (a === 6) + (b === 6), '(a == 6) + (b == 6)'],
  };
  function rvDist(f) {
    const cnt = {};
    DICE.forEach(([a, b]) => {
      const v = f(a, b);
      cnt[v] = (cnt[v] || 0) + 1;
    });
    const xs = Object.keys(cnt).map(Number).sort((u, v) => u - v);
    return { xs, cs: xs.map((x) => cnt[x]) };
  }
  GBC.widget('rv-pmf', (el) => {
    const s = { rv: 'max', k: 4 };
    const w = ui.shell(el, { title: 'Случайная величина: закон и функция распределения', sub: 'Случайная величина — число в каждой клетке таблицы исходов. Закон распределения — сколько клеток (из 36) даёт каждое значение. Ползунок выбирает значение x: тёмные клетки — X = x, светлые — X < x; вместе они дают F(x) = P(X ≤ x).' });
    ui.select(w.controls, { label: 'Величина X', value: s.rv, options: Object.entries(RVS).map(([k, v]) => ({ value: k, label: v[0] })), onChange: (v) => ((s.rv = v), draw()) });
    const clampK = (v) => {
      const { xs } = rvDist(RVS[s.rv][1]);
      return U.clamp(v, xs[0], xs[xs.length - 1]);
    };
    const sk = ui.slider(w.controls, { label: 'Значение x', min: 0, max: 12, step: 1, value: s.k, format: (v) => String(clampK(v)), onInput: (v) => ((s.k = v), draw()) });
    const grid = cardGrid(260);
    w.main.appendChild(grid);
    const cG = card('Исходы: значение X в каждой клетке');
    const cP = card('Закон распределения и F(x)');
    grid.append(cG.el, cP.el);
    const dg = diceGrid(cG.body, { size: 38, maxW: 300 });
    const plot = new GBC.Plot(cP.body, { height: 170, x: { label: 'x' }, y: { label: 'P(X = x)' } });
    const plot2 = new GBC.Plot(cP.body, { height: 150, x: { label: 'x' }, y: { label: 'F(x) = P(X ≤ x)', domain: [0, 1.05] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'P(X = x)' }, { key: 'F', label: 'F(x)' }, { key: 'm', label: 'E X' }, { key: 'v', label: 'Var X' }]);
    function draw() {
      const f = RVS[s.rv][1];
      const { xs, cs } = rvDist(f);
      const k = clampK(s.k);
      sk.set(s.k);
      dg.draw((a, b) => {
        const v = f(a, b);
        return { fill: v === k ? C('model') : v < k ? C('model-prev') : 'var(--surface-2)', opacity: v === k ? 0.9 : v < k ? 0.45 : 1, text: v, ink: v === k ? 'var(--surface)' : 'var(--ink-2)', bold: v === k };
      });
      const ps = cs.map((c) => c / 36);
      const lo = xs[0] - 1;
      const hi = xs[xs.length - 1] + 1;
      plot.render([
        { type: 'bars', x: xs, y: ps, color: (i) => (xs[i] === k ? 'model' : xs[i] < k ? 'model-prev' : 'data'), legendColor: 'model', width: 0.7, tooltip: (i) => [['x', String(xs[i])], ['P', cs[i] + '/36']] },
      ], { x: [lo + 0.4, hi - 0.4] });
      const segs = [];
      let acc = 0;
      segs.push({ x0: lo, x1: xs[0], value: 0 });
      xs.forEach((x, i) => {
        acc += ps[i];
        segs.push({ x0: x, x1: i + 1 < xs.length ? xs[i + 1] : hi, value: acc });
      });
      const Fk = U.sum(ps.filter((_, i) => xs[i] <= k));
      plot2.render([
        { type: 'steps', segments: segs, color: 'model', width: 2.2 },
        { type: 'points', x: xs, y: xs.map((_, i) => U.sum(ps.slice(0, i + 1))), color: 'model', r: 3.5 },
        { type: 'points', x: [k], y: [Fk], color: 'tree', r: 6 },
        { type: 'vline', x: k, color: 'tree', dash: '4 4', width: 1.2 },
      ], { x: [lo + 0.4, hi - 0.4] });
      const mm = moments(xs, ps);
      const ck = cs[xs.indexOf(k)] || 0;
      const cF = U.sum(cs.filter((_, i) => xs[i] <= k));
      st.set('p', frac(ck, 36) + ' ≈ ' + f3(ck / 36));
      st.set('F', frac(cF, 36) + ' ≈ ' + f3(cF / 36));
      st.set('m', f3(mm.m));
      st.set('v', f3(mm.v));
      let extra = '';
      if (s.rv === 'max') extra = ' Для максимума удобно через F: M ≤ x значит «оба не больше x» — это x² клеток, F(x) = x²/36, а P(M = x) = (2x − 1)/36.';
      if (s.rv === 'diff') extra = ' Чаще всего кубики отличаются на 1 (10 клеток из 36), а не совпадают (6).';
      if (s.rv === 'sixes') extra = ' Число шестёрок — сумма двух индикаторов; E X = 1/6 + 1/6 = 1/3 по линейности (шаг 14).';
      note.innerHTML = 'X = ' + RVS[s.rv][0] + '. P(X = ' + k + ') = ' + ck + '/36, F(' + k + ') = P(X ≤ ' + k + ') = ' + cF + '/36. Функция распределения — лестница: стоит на месте между значениями и прыгает на P(X = x) в каждом значении.' + extra;
    }
    w.pythonAction(() => PY_FR + 'from collections import Counter\n\nomega = list(product(range(1, 7), repeat=2))\nX = Counter(' + RVS[s.rv][2] + ' for a, b in omega)     # ' + RVS[s.rv][0] + '\nacc = Fraction(0)\nfor x in sorted(X):\n    p = Fraction(X[x], 36)\n    acc += p\n    print(f"x = {x:2d}: P = {str(p):>5}, F(x) = {acc}")\nE = sum(x * Fraction(c, 36) for x, c in X.items())\nV = sum((x - E) ** 2 * Fraction(c, 36) for x, c in X.items())\nprint("E X =", E, "≈", float(E), " Var X =", V, "≈", round(float(V), 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 14. Матожидание — центр масс
   * ============================================================================== */
  const BAL_PRESETS = {
    die: [0, 1, 1, 1, 1, 1, 1],
    sym: [1, 2, 4, 6, 4, 2, 1],
    skew: [10, 7, 4, 2, 1, 0.6, 0.4],
    two: [5, 3, 0.5, 0.2, 0.5, 3, 5],
    point: [0, 0, 0, 1, 0, 0, 0],
  };
  GBC.widget('balance', (el) => {
    const s = { p: null, g: 'x', preset: 'die' };
    const xs = U.range(7);
    const w = ui.shell(el, { title: 'Матожидание — точка равновесия', sub: 'Столбики — вероятности значений 0…6 (грузы на линейке). Тяните верхушки столбиков мышью: остальные вероятности пересчитываются, чтобы сумма осталась 1. Треугольник-опора стоит в E X — там линейка уравновешена.' });
    const sel = ui.select(w.controls, { label: 'Распределение', value: s.preset, options: [{ value: 'die', label: 'кубик (1–6)' }, { value: 'sym', label: 'симметричное' }, { value: 'skew', label: 'скошенное вправо' }, { value: 'two', label: 'две горки' }, { value: 'point', label: 'константа 3' }], onChange: (v) => setPreset(v) });
    ui.segmented(w.controls, { label: 'Функция g(X)', value: s.g, options: [{ value: 'x', label: 'X' }, { value: 'sq', label: 'X²' }, { value: 'abs', label: '|X − 3|' }], onChange: (v) => ((s.g = v), draw()) });
    function setPreset(v) {
      s.preset = v;
      const raw = BAL_PRESETS[v];
      const t = U.sum(raw);
      s.p = raw.map((r) => r / t);
      sel.set(v);
      draw();
    }
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'значение x', domain: [-0.6, 6.6], ticks: xs }, y: { label: 'вероятность P(X = x)', domain: [-0.09, 0.62] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'E X' }, { key: 'eg', label: 'E g(X)' }, { key: 'ge', label: 'g(E X)' }, { key: 'v', label: 'Var X = E X² − (E X)²' }]);
    const G = { x: (v) => v, sq: (v) => v * v, abs: (v) => Math.abs(v - 3) };
    const GN = { x: 'X', sq: 'X²', abs: '|X − 3|' };
    function draw() {
      const p = s.p;
      const mm = moments(xs, p);
      const g = G[s.g];
      const eg = U.sum(xs.map((x, i) => g(x) * p[i]));
      const ymax = Math.max(0.3, ...p) * 1.18;
      const tri = { type: 'polygon', x: [mm.m, mm.m - 0.22, mm.m + 0.22], y: [0, -0.07 * ymax / 0.6, -0.07 * ymax / 0.6], fill: 'tree', opacity: 0.9, stroke: 'tree', width: 1 };
      plot.render([
        { type: 'line', x: [-0.5, 6.5], y: [0, 0], color: 'ink', width: 3, hover: false },
        tri,
        { type: 'bars', x: xs, y: p, color: 'model', width: 0.6, opacity: 0.8, tooltip: (i) => [['x', String(i)], ['P', f3(p[i])]] },
        { type: 'points', x: xs, y: p, color: 'model', r: 6.5, draggable: true, onDrag: (i, x, y) => {
          const nv = U.clamp(y, 0, 0.95);
          const rest = 1 - nv;
          const others = U.sum(p.filter((_, j) => j !== i));
          s.p = p.map((v, j) => (j === i ? nv : others > 1e-9 ? (v / others) * rest : rest / 6));
          draw();
        } },
        { type: 'vline', x: mm.m, color: 'tree', dash: '4 4', width: 1.3 },
        { type: 'text', items: [{ x: mm.m, y: ymax * 0.95, text: 'E X = ' + f3(mm.m), anchor: 'middle', bold: true }] },
      ], { y: [-0.09 * ymax / 0.6, ymax] });
      st.set('m', f3(mm.m));
      st.set('eg', f3(eg));
      st.set('ge', f3(g(mm.m)));
      st.set('v', f3(U.sum(xs.map((x, i) => x * x * p[i]))) + ' − ' + f3(mm.m * mm.m) + ' = ' + f3(mm.v));
      const med = (() => {
        let acc = 0;
        for (let i = 0; i < 7; i++) {
          acc += p[i];
          if (acc >= 0.5 - 1e-12) return i;
        }
        return 6;
      })();
      const skw = mm.s > 0 ? U.sum(xs.map((x, i) => p[i] * (x - mm.m) ** 3)) / mm.s ** 3 : 0;
      note.innerHTML = 'E X = Σ x·P(X = x) = ' + f3(mm.m) + ' — центр масс грузов. ' + (s.g === 'x' ? 'Медиана (половина массы слева) — ' + med + (Math.abs(skw) > 0.3 ? ': у скошенного распределения (асимметрия ' + f2(skw) + ') среднее уходит в сторону хвоста.' : '; распределение почти симметрично, среднее и медиана рядом.') : 'E ' + GN[s.g] + ' = ' + f3(eg) + ', а ' + GN[s.g].replace('X', 'E X') + ' = ' + f3(g(mm.m)) + (Math.abs(eg - g(mm.m)) > 1e-6 ? ' — <b>не равны</b>: ожидание функции ≠ функция ожидания (для выпуклой g всегда E g(X) ≥ g(E X), неравенство Йенсена).' : ' — совпали (так бывает для линейной g или вырожденного распределения).')) +
        ' Дисперсия — средний квадрат расстояния грузов до опоры: ' + f3(mm.v) + ', σ = ' + f3(mm.s) + '.';
    }
    w.pythonAction(() => PY_NP + 'x = np.arange(7)\np = np.array([' + s.p.map((v) => f4(v)).join(', ') + '])\np = p / p.sum()\n\nE = (x * p).sum()\nprint("E X =", round(E, 4), " E X² =", round((x**2 * p).sum(), 4), " (E X)² =", round(E**2, 4))\nprint("Var X =", round(((x - E)**2 * p).sum(), 4), " σ =", round(np.sqrt(((x - E)**2 * p).sum()), 4))\nprint("E |X − 3| =", round((np.abs(x - 3) * p).sum(), 4), " |E X − 3| =", round(abs(E - 3), 4))\n');
    setPreset('die');
  });

  /* ==============================================================================
   * Шаг 15. Неравенство Чебышёва
   * ============================================================================== */
  function chebDist(kind, k) {
    if (kind === 'die') return { xs: [1, 2, 3, 4, 5, 6], ps: new Array(6).fill(1 / 6), name: 'кубик' };
    if (kind === 'binom') return { xs: U.range(21), ps: U.range(21).map((j) => binomPmf(j, 20, 0.5)), name: 'Bin(20, 0.5)' };
    if (kind === 'geom') return { xs: U.range(60, 1), ps: U.range(60, 1).map((j) => Math.pow(0.75, j - 1) * 0.25), name: 'геометрическое, p = 0.25' };
    if (kind === 'pois') return { xs: U.range(26), ps: U.range(26).map((j) => poisPmf(j, 3)), name: 'Пуассон, λ = 3' };
    const q = 1 / (2 * k * k);
    return { xs: [-k, 0, k], ps: [q, 1 - 2 * q, q], name: 'худший случай' };
  }
  GBC.widget('chebyshev', (el) => {
    const s = { kind: 'binom', k: 2 };
    const w = ui.shell(el, { title: 'Неравенство Чебышёва: хвосты любой величины', sub: 'Красные столбики — значения, удалённые от среднего хотя бы на kσ. Их суммарная вероятность никогда не превышает 1/k², каким бы ни было распределение. «Худший случай» показывает, что оценку нельзя улучшить.' });
    ui.select(w.controls, { label: 'Распределение', value: s.kind, options: [{ value: 'die', label: 'кубик' }, { value: 'binom', label: 'Bin(20, 0.5)' }, { value: 'geom', label: 'геометрическое, p = 0.25' }, { value: 'pois', label: 'Пуассон, λ = 3' }, { value: 'worst', label: 'худший случай (−k, 0, k)' }], onChange: (v) => ((s.kind = v), draw()) });
    ui.slider(w.controls, { label: 'k (в стандартных отклонениях)', min: 1, max: 4, step: 0.05, value: s.k, format: f2, onInput: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 270, x: { label: 'x' }, y: { label: 'P(X = x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ms', label: 'μ / σ' }, { key: 't', label: 'P(|X − μ| ≥ kσ)' }, { key: 'b', label: 'оценка 1/k²' }, { key: 'r', label: 'во сколько раз оценка больше' }]);
    function draw() {
      const D = chebDist(s.kind, s.k);
      const mm = moments(D.xs, D.ps);
      const tailF = (x) => Math.abs(x - mm.m) >= s.k * mm.s - 1e-9;
      const tail = U.sum(D.ps.filter((_, i) => tailF(D.xs[i])));
      const bound = Math.min(1, 1 / (s.k * s.k));
      const shown = D.xs.map((x, i) => i).filter((i) => D.ps[i] > 1e-5 || Math.abs(D.xs[i] - mm.m) < 6 * mm.s);
      const X = shown.map((i) => D.xs[i]);
      const P = shown.map((i) => D.ps[i]);
      const lo = Math.min(X[0], mm.m - s.k * mm.s) - 0.8;
      const hi = Math.max(X[X.length - 1], mm.m + s.k * mm.s) + 0.8;
      plot.render([
        { type: 'vband', x0: mm.m - s.k * mm.s, x1: mm.m + s.k * mm.s, color: 'model', opacity: 0.08 },
        { type: 'bars', x: X, y: P, color: (i) => (tailF(X[i]) ? 'critical' : 'data'), legendColor: 'critical', width: X.length > 30 ? 0.8 : 0.6, label: 'хвост |x − μ| ≥ kσ', tooltip: (i) => [['x', f2(X[i])], ['P', pf(P[i])]] },
        { type: 'vline', x: mm.m, color: 'model', width: 1.6, label: 'μ' },
        { type: 'vline', x: mm.m - s.k * mm.s, color: 'model', dash: '4 4', width: 1.2 },
        { type: 'vline', x: mm.m + s.k * mm.s, color: 'model', dash: '4 4', width: 1.2 },
      ], { x: [lo, hi] });
      st.set('ms', f3(mm.m) + ' / ' + f3(mm.s));
      st.set('t', pf(tail));
      st.set('b', pf(bound));
      st.set('r', tail > 1e-12 ? f2(bound / tail) : '∞');
      note.innerHTML = D.name + ': μ = ' + f3(mm.m) + ', σ = ' + f3(mm.s) + '. Дальше ' + f2(s.k) + 'σ от среднего — вероятность ' + pf(tail) + ' ≤ 1/k² = ' + pf(bound) + '. ' +
        (s.kind === 'worst' ? '<b>Здесь оценка достигается точно</b>: вся «хвостовая» масса стоит ровно на границе.' : tail === 0 ? 'Значений так далеко вообще нет — оценка верна, но очень осторожна.' : 'Оценка верна для любого распределения с конечной дисперсией, поэтому для конкретного она обычно с большим запасом.');
    }
    w.pythonAction(() => {
      const D = chebDist(s.kind, s.k);
      return PY_NP + 'x = np.array([' + D.xs.map((v) => py(v)).join(', ') + '])\np = np.array([' + D.ps.map((v) => U.pyNum(v)).join(', ') + '])\nk = ' + py(s.k) + '\n\nmu = (x * p).sum()\nsigma = np.sqrt(((x - mu) ** 2 * p).sum())\ntail = p[np.abs(x - mu) >= k * sigma - 1e-9].sum()\nprint(f"μ = {mu:.4f}, σ = {sigma:.4f}, P(|X − μ| ≥ kσ) = {tail:.5f} ≤ 1/k² = {1 / k**2:.5f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 16. Доска Гальтона
   * ============================================================================== */
  GBC.widget('galton', (el) => {
    const s = { n: 10, p: 0.5, k: 20, seed: 1 };
    const KMAX = 45;
    const balls = (k) => k * k;
    const w = ui.shell(el, { title: 'Доска Гальтона', sub: 'Шарик падает через n рядов гвоздей и на каждом отскакивает вправо с вероятностью p — независимо. Номер ячейки внизу — число отскоков вправо, то есть биномиальная величина. Нажмите ▶: оранжевая линия — путь последнего шарика, точки — теоретические вероятности.' });
    ui.slider(w.controls, { label: 'Рядов n', min: 2, max: 16, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Вероятность вправо p', min: 0.1, max: 0.9, step: 0.05, value: s.p, format: f2, onInput: (v) => ((s.p = v), draw()) });
    ui.player(w.controls, { label: 'Шариков', min: 1, max: KMAX, value: s.k, fps: 6, format: (k) => balls(k) + ' шар.', onChange: (k) => ((s.k = k), draw()) });
    ui.button(w.controls, { label: 'Заново', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: '', domain: [-0.8, 16.8], ticks: [] }, y: { label: '', ticks: [] }, grid: 'none', margin: { left: 14, bottom: 8 } });
    const plot2 = new GBC.Plot(w.main, { height: 210, x: { label: 'номер ячейки k (число отскоков вправо)' }, y: { label: 'доля шариков' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'N', label: 'шариков' }, { key: 'm', label: 'среднее: опыт / np' }, { key: 'v', label: 'дисперсия: опыт / np(1 − p)' }, { key: 'd', label: 'max |доля − P|' }]);
    let cacheKey = '';
    let cache = null;
    function simulate() {
      const key = s.n + ':' + s.p + ':' + s.seed;
      if (key === cacheKey) return cache;
      const rng = new GBC.RNG(s.seed);
      const res = [];
      const paths = [];
      for (let b = 0; b < balls(KMAX); b++) {
        let k = 0;
        const path = [0];
        for (let r = 0; r < s.n; r++) {
          if (rng.random() < s.p) k++;
          path.push(k);
        }
        res.push(k);
        if (b < balls(KMAX)) paths.push(path);
      }
      cacheKey = key;
      cache = { res, paths };
      return cache;
    }
    function draw() {
      const n = s.n;
      const { res, paths } = simulate();
      const N = balls(s.k);
      const hist = new Array(n + 1).fill(0);
      for (let b = 0; b < N; b++) hist[res[b]]++;
      // доска: гвозди
      const px = [];
      const pyy = [];
      for (let r = 0; r < n; r++) for (let j = 0; j <= r; j++) (px.push(j + (n - r) / 2), pyy.push(n - r));
      const last = paths[N - 1];
      const lx = [n / 2];
      const ly = [n + 0.7];
      last.forEach((kk, r) => {
        lx.push(kk + (n - r) / 2);
        ly.push(n - r);
      });
      lx.push(last[n]);
      ly.push(-0.3);
      plot.render([
        { type: 'points', x: px, y: pyy, color: 'muted', r: n > 12 ? 2.4 : 3.2 },
        { type: 'line', x: lx, y: ly, color: 'tree', width: 2.4, hover: false },
        { type: 'points', x: [last[n]], y: [-0.3], color: 'tree', r: 5 },
      ], { x: [-0.8, n + 0.8], y: [-0.8, n + 1] });
      const ks = U.range(n + 1);
      const pm = ks.map((k) => binomPmf(k, n, s.p));
      plot2.render([
        { type: 'bars', x: ks, y: hist.map((h) => h / N), color: 'model', width: 0.8, opacity: 0.7, label: 'доля шариков', tooltip: (i) => [['k', String(i)], ['шариков', String(hist[i])], ['доля', f4(hist[i] / N)], ['P(X = k)', f4(pm[i])]] },
        { type: 'points', x: ks, y: pm, color: 'tree', r: 4.5, label: 'P(X = k) = C(n, k)·pᵏ(1 − p)ⁿ⁻ᵏ' },
      ], { x: [-0.8, n + 0.8] });
      const mean = U.sum(hist.map((h, k) => h * k)) / N;
      const vr = U.sum(hist.map((h, k) => h * (k - mean) ** 2)) / N;
      const dmax = Math.max(...ks.map((k) => Math.abs(hist[k] / N - pm[k])));
      st.set('N', String(N));
      st.set('m', f3(mean) + ' / ' + f3(n * s.p));
      st.set('v', f3(vr) + ' / ' + f3(n * s.p * (1 - s.p)));
      st.set('d', f4(dmax));
      note.innerHTML = 'После ' + N + ' шариков гистограмма ' + (N < 50 ? 'ещё неровная' : 'всё точнее повторяет биномиальные вероятности') + '; максимальное расхождение ' + f4(dmax) + ' убывает примерно как 1/√N. ' +
        'Путь шарика — последовательность из ' + n + ' независимых «вправо/влево», и в ячейку k ведут C(' + n + ', k) путей — поэтому середина заполняется гуще краёв. При p ≠ 0.5 горка смещается к np = ' + f2(n * s.p) + '.';
    }
    w.pythonAction(() => PY_RNG + 'import math\nimport numpy as np\n\nn, p, N = ' + s.n + ', ' + py(s.p) + ', ' + balls(s.k) + '\nrng = Mulberry32(' + s.seed + ')\nbins = np.zeros(n + 1, dtype=int)\nfor _ in range(N):\n    k = sum(rng.random() < p for _ in range(n))     # отскоки вправо\n    bins[k] += 1\nfor k in range(n + 1):\n    print(f"k = {k:2d}: доля {bins[k] / N:.4f}, бином {math.comb(n, k) * p**k * (1 - p)**(n - k):.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 16. Биномиальное распределение
   * ============================================================================== */
  GBC.widget('binomial', (el) => {
    const s = { n: 20, p: 0.15, ev: 'ge', k: 5, normal: false };
    const w = ui.shell(el, { title: 'Биномиальное распределение Bin(n, p)', sub: 'Число успехов в n независимых испытаниях с вероятностью успеха p. Закрашены значения, входящие в событие. Можно наложить нормальную кривую с тем же средним и дисперсией.' });
    ui.slider(w.controls, { label: 'Испытаний n', min: 1, max: 80, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Вероятность успеха p', min: 0.01, max: 0.99, step: 0.01, value: s.p, format: f2, onInput: (v) => ((s.p = v), draw()) });
    ui.segmented(w.controls, { label: 'Событие', value: s.ev, options: [{ value: 'eq', label: 'X = k' }, { value: 'le', label: 'X ≤ k' }, { value: 'ge', label: 'X ≥ k' }], onChange: (v) => ((s.ev = v), draw()) });
    ui.slider(w.controls, { label: 'k', min: 0, max: 80, step: 1, value: s.k, format: (v) => String(Math.min(v, s.n)), onInput: (v) => ((s.k = v), draw()) });
    ui.toggle(w.controls, { label: 'Нормальное приближение', checked: s.normal, onChange: (v) => ((s.normal = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'число успехов k' }, y: { label: 'P(X = k)' }, table: () => ({ columns: ['k', 'C(n, k)', 'P(X = k)', 'P(X ≤ k)'], rows: U.range(s.n + 1).map((k) => [k, comb(s.n, k), binomPmf(k, s.n, s.p), U.sum(U.range(k + 1).map((j) => binomPmf(j, s.n, s.p)))]) }) });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pe', label: 'P(событие)' }, { key: 'm', label: 'E X = np' }, { key: 'v', label: 'Var X = np(1 − p)' }, { key: 'mo', label: 'самое вероятное k' }]);
    function draw() {
      const n = s.n;
      const k = Math.min(s.k, n);
      const ks = U.range(n + 1);
      const pm = ks.map((j) => binomPmf(j, n, s.p));
      const inEv = (j) => (s.ev === 'eq' ? j === k : s.ev === 'le' ? j <= k : j >= k);
      const pe = U.sum(pm.filter((_, j) => inEv(j)));
      const m = n * s.p;
      const sd = Math.sqrt(n * s.p * (1 - s.p));
      const layers = [{ type: 'bars', x: ks, y: pm, color: (j) => (inEv(j) ? 'model' : 'data'), legendColor: 'model', width: 0.75, opacity: 0.85, label: 'P(X = k)', tooltip: (j) => [['k', String(j)], ['C(n, k)', String(comb(n, j))], ['P', pf(pm[j])]] }];
      let approx = null;
      if (s.normal && sd > 0) {
        const xx = U.linspace(-0.5, n + 0.5, 200);
        layers.push({ type: 'line', x: xx, y: xx.map((x) => normPdf(x, m, sd)), color: 'tree', width: 2, label: 'N(np, np(1 − p))' });
        const cc = s.ev === 'eq' ? normCdf(k + 0.5, m, sd) - normCdf(k - 0.5, m, sd) : s.ev === 'le' ? normCdf(k + 0.5, m, sd) : 1 - normCdf(k - 0.5, m, sd);
        approx = cc;
      }
      plot.render(layers, { x: [-0.6, n + 0.6] });
      const mode = U.argmax(pm);
      const sym = s.ev === 'eq' ? '=' : s.ev === 'le' ? '≤' : '≥';
      st.set('pe', 'P(X ' + sym + ' ' + k + ') = ' + pf(pe));
      st.set('m', f3(m));
      st.set('v', f3(n * s.p * (1 - s.p)));
      st.set('mo', String(mode));
      note.innerHTML = 'Bin(' + n + ', ' + f2(s.p) + '): P(X ' + sym + ' ' + k + ') = <b>' + pf(pe) + '</b>. Среднее np = ' + f2(m) + ', стандартное отклонение √(np(1 − p)) = ' + f3(sd) + '. ' +
        (approx !== null ? 'Нормальное приближение с поправкой на непрерывность (±0.5) даёт ' + pf(approx) + (Math.abs(approx - pe) < 0.01 ? ' — почти точно.' : ' — заметно неточно: при np или n(1 − p) меньше ~10 распределение слишком скошено.') : 'Включите нормальное приближение: при большом n биномиальное похоже на колокол (ЦПТ).');
    }
    w.pythonAction(() => {
      const k = Math.min(s.k, s.n);
      const rng = s.ev === 'eq' ? '[' + k + ']' : s.ev === 'le' ? 'range(0, ' + (k + 1) + ')' : 'range(' + k + ', n + 1)';
      return 'import math\n\nn, p = ' + s.n + ', ' + py(s.p) + '\npmf = lambda k: math.comb(n, k) * p**k * (1 - p)**(n - k)\nprint("P(событие) =", round(sum(pmf(k) for k in ' + rng + '), 6))\nprint("E X =", n * p, " Var X =", round(n * p * (1 - p), 6))\nprint("P(X = 0) =", round(pmf(0), 6), " самое вероятное k =", max(range(n + 1), key=pmf))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 17. Геометрическое распределение и отсутствие памяти
   * ============================================================================== */
  GBC.widget('geometric', (el) => {
    const s = { p: 1 / 6, m: 0 };
    const w = ui.shell(el, { title: 'Ждём первого успеха', sub: 'X — номер первого успеха. Столбики — P(X = k) = (1 − p)ᵏ⁻¹p. Ползунок «уже прошло неудач» отбрасывает первые m попыток: оранжевые точки — условное распределение P(X = k | X > m). Оно повторяет исходное, сдвинутое на m.' });
    ui.slider(w.controls, { label: 'Вероятность успеха p', values: [0.05, 0.1, 1 / 6, 0.2, 0.25, 0.3, 0.4, 0.5, 0.7], value: s.p, format: (v) => (Math.abs(v - 1 / 6) < 1e-9 ? '1/6' : f2(v)), onInput: (v) => ((s.p = v), draw()) });
    ui.slider(w.controls, { label: 'Уже прошло неудач m', min: 0, max: 15, step: 1, value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'номер первого успеха k', domain: [0.4, 30.6] }, y: { label: 'вероятность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'E X = 1/p' }, { key: 'med', label: 'медиана' }, { key: 't', label: 'P(X > 10)' }, { key: 'rem', label: 'E[X − m | X > m]' }]);
    function draw() {
      const { p, m } = s;
      const K = 30;
      const ks = U.range(K, 1);
      const pm = ks.map((k) => Math.pow(1 - p, k - 1) * p);
      const cond = ks.map((k) => (k > m ? Math.pow(1 - p, k - 1 - m) * p : null));
      const L = [
        { type: 'bars', x: ks, y: pm, color: (i) => (ks[i] <= m ? 'muted' : 'model'), legendColor: 'model', width: 0.7, opacity: 0.75, label: 'P(X = k)', tooltip: (i) => [['k', String(ks[i])], ['P(X = k)', pf(pm[i])]] },
      ];
      if (m > 0) {
        L.push({ type: 'vband', x0: 0.4, x1: m + 0.5, color: 'muted', opacity: 0.12 });
        L.push({ type: 'points', x: ks.filter((k) => k > m), y: cond.filter((v) => v !== null), color: 'tree', r: 4.5, label: 'P(X = k | X > ' + m + ')' });
      }
      plot.render(L);
      let med = 1;
      while (1 - Math.pow(1 - p, med) < 0.5) med++;
      st.set('e', f3(1 / p));
      st.set('med', String(med));
      st.set('t', pf(Math.pow(1 - p, 10)));
      st.set('rem', f3(1 / p));
      note.innerHTML = 'В среднем первый успех на попытке 1/p = ' + f2(1 / p) + ', медиана — ' + med + ': половина серий заканчивается быстрее, но длинный хвост тянет среднее вверх. ' +
        (m > 0 ? 'Прошло ' + m + ' неудач — и условное распределение оставшегося ожидания <b>в точности такое же</b>, как в начале: P(X > ' + m + ' + k | X > ' + m + ') = (1 − p)ᵏ. Монета (кубик) не помнит прошлых неудач — ожидать по-прежнему ' + f2(1 / p) + ' попыток.' : 'Сдвиньте «уже прошло неудач», чтобы увидеть отсутствие памяти.');
    }
    w.pythonAction(() => 'p, m = ' + U.pyNum(s.p) + ', ' + s.m + '\npmf = lambda k: (1 - p) ** (k - 1) * p\nprint("E X = 1/p =", 1 / p, " P(X > 10) =", round((1 - p) ** 10, 4))\nmed = next(k for k in range(1, 1000) if 1 - (1 - p) ** k >= 0.5)\nprint("медиана:", med)\n# отсутствие памяти: P(X = m + k | X > m) = P(X = k)\nfor k in range(1, 5):\n    print(k, round(pmf(m + k) / (1 - p) ** m, 6), "=", round(pmf(k), 6))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 18. Пуассон как предел бинома
   * ============================================================================== */
  GBC.widget('poisson-limit', (el) => {
    const s = { lam: 3, n: 10 };
    const w = ui.shell(el, { title: 'Закон редких событий: Bin(n, λ/n) → Pois(λ)', sub: 'Делим интервал на n частей, в каждой событие с вероятностью λ/n. Синие столбики — точное биномиальное распределение, оранжевые — пуассоновское. Увеличивайте n: столбики сливаются.' });
    ui.slider(w.controls, { label: 'Среднее число событий λ', min: 0.5, max: 10, step: 0.5, value: s.lam, format: f1, onInput: (v) => ((s.lam = v), draw()) });
    ui.slider(w.controls, { label: 'Частей n', values: [5, 10, 20, 30, 50, 100, 300, 1000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'число событий k' }, y: { label: 'вероятность' }, table: () => {
      const K = Math.ceil(s.lam + 5 * Math.sqrt(s.lam) + 3);
      return { columns: ['k', 'Bin(n, λ/n)', 'Pois(λ)'], rows: U.range(K + 1).map((k) => [k, binomPmf(k, Math.max(s.n, 1), s.lam / s.n), poisPmf(k, s.lam)]) };
    } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p0', label: 'P(0): бином / Пуассон' }, { key: 'pl', label: 'P(k = ⌊λ⌋): бином / Пуассон' }, { key: 'v', label: 'дисперсия: бином / Пуассон' }, { key: 'tv', label: 'расстояние по вариации' }]);
    function draw() {
      const { lam } = s;
      const n = Math.max(s.n, Math.ceil(lam) + 1);
      const p = lam / n;
      const K = Math.ceil(lam + 5 * Math.sqrt(lam) + 3);
      const ks = U.range(K + 1);
      const b = ks.map((k) => binomPmf(k, n, p));
      const q = ks.map((k) => poisPmf(k, lam));
      let tv = 0;
      for (let k = 0; k <= Math.min(n, 200); k++) tv += Math.abs(binomPmf(k, n, p) - poisPmf(k, lam));
      tv /= 2;
      plot.render([
        { type: 'bars', x: ks.map((k) => k - 0.19), y: b, color: 'blue', width: 0.36, label: 'Bin(' + n + ', ' + U.fmt(p, 4) + ')', tooltip: (i) => [['k', String(i)], ['бином', pf(b[i])], ['Пуассон', pf(q[i])]] },
        { type: 'bars', x: ks.map((k) => k + 0.19), y: q, color: 'orange', width: 0.36, label: 'Pois(' + f1(lam) + ')', tooltip: (i) => [['k', String(i)], ['бином', pf(b[i])], ['Пуассон', pf(q[i])]] },
      ], { x: [-0.7, K + 0.7] });
      const fl = Math.floor(lam);
      st.set('p0', pf(b[0]) + ' / ' + pf(q[0]));
      st.set('pl', pf(b[fl]) + ' / ' + pf(q[fl]));
      st.set('v', f3(n * p * (1 - p)) + ' / ' + f3(lam));
      st.set('tv', pf(tv));
      note.innerHTML = 'При n = ' + n + ' вероятность в каждой части λ/n = ' + U.fmt(p, 4) + '. Расстояние по вариации между распределениями — ' + pf(tv) + ' (половина суммы |разностей| вероятностей; при n = 10, 30, 100, 1000 и λ = 3 это 0.086, 0.026, 0.0076, 0.0008). ' +
        'У бинома дисперсия np(1 − p) = ' + f3(n * p * (1 - p)) + ' чуть меньше среднего, у Пуассона она <b>равна</b> среднему λ.';
    }
    w.pythonAction(() => 'import math\n\nlam, n = ' + py(s.lam) + ', ' + Math.max(s.n, Math.ceil(s.lam) + 1) + '\np = lam / n\nbinom = lambda k: math.comb(n, k) * p**k * (1 - p)**(n - k)\npois = lambda k: lam**k * math.exp(-lam) / math.factorial(k)\nfor k in range(8):\n    print(f"k = {k}: бином {binom(k):.5f}, Пуассон {pois(k):.5f}")\ntv = 0.5 * sum(abs(binom(k) - pois(k)) for k in range(min(n, 200) + 1))\nprint("расстояние по вариации:", round(tv, 5))\n');
    draw();
  });

  GBC.lesson1513 = {
    f1, f2, f3, f4, py, sci, pf, pct, clean, gcd, frac, plural, yDom,
    LF, lchoose, comb, binomPmf, poisPmf, normPdf, erfc, normCdf, normPpf, moments,
    texInto, texEl, card, cardGrid, badge, rowTable, onTheme, eqBox, svgHost, C, diceGrid, DICE,
    PY_FR, PY_NP, PY_RNG, PY_MATH,
  };
})();
