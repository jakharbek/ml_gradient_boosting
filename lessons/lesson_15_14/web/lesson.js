/* Урок 15.14: математическая статистика. Часть 1 — интуиция, описание данных, оценки параметров,
 * доверительные интервалы.
 * Виджеты: кто лучше на валидации; генеральная совокупность и смещённые выборки; среднее, медиана и
 * выбросы; меры разброса и правила выбросов; гистограмма, ЭФР, Q-Q и ящик с усами; корреляция Пирсона и
 * Спирмена (квартет Анскомба); выборочное распределение; поправка Бесселя; сжатие оценки и MSE;
 * эффективность среднего и медианы; метод моментов и максимальное правдоподобие; бета-биномиальная
 * байесовская оценка; распределения Стьюдента и χ²; покрытие доверительных интервалов; ширина интервала и
 * размер выборки; интервалы для доли (Вальд, Уилсон, Клоппер — Пирсон); бутстрэп; когда бутстрэп ошибается.
 * Общие помощники (форматирование, карточки, специальные функции и распределения) выставлены в
 * GBC.lesson1514 — ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const f1 = (v) => U.fmt(v, 1);
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const f4 = (v) => U.fmt(v, 4);
  const py = (v) => U.pyNum(v);
  /** Короткая запись маленьких и больших величин: 3.6e−5 вместо «0». */
  const sci = (v) => (!Number.isFinite(v) ? (Number.isNaN(v) ? '—' : v > 0 ? '∞' : '−∞') : v === 0 ? '0' : Math.abs(v) >= 0.01 && Math.abs(v) < 1e5 ? U.fmt(v, Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 2 : 4) : v.toExponential(2).replace(/-/g, '−').replace('e+', 'e'));
  /** p-значение: 4 знака, крошечные — в экспоненциальной записи. */
  const pf = (p) => (!Number.isFinite(p) ? '—' : p < 1e-4 ? (p < 1e-15 ? '< 1e−15' : p.toExponential(1).replace(/-/g, '−')) : U.fmt(p, 4));
  const pct = (p, d = 1) => (Number.isFinite(p) ? U.fmt(100 * p, d) + ' %' : '—');
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
   * Специальные функции и распределения
   * ============================================================================== */
  const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  /** ln Γ(x) (Ланцош, g = 7). */
  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
    x -= 1;
    let a = LG[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += LG[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  const TINY = 1e-300;
  function betacf(a, b, x) {
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 400; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < TINY) d = TINY;
      c = 1 + aa / c;
      if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      h *= d * c;
      aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < TINY) d = TINY;
      c = 1 + aa / c;
      if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 3e-16) break;
    }
    return h;
  }
  /** Регуляризованная неполная бета-функция I_x(a, b). */
  function ibeta(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log1p(-x));
    return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
  }
  /** Верхняя регуляризованная неполная гамма-функция Q(a, x) = 1 − P(a, x). */
  function gammaQ(a, x) {
    if (x <= 0) return 1;
    const lead = -x + a * Math.log(x) - lgamma(a);
    if (x < a + 1) {
      let ap = a;
      let sum = 1 / a;
      let del = sum;
      for (let n = 0; n < 1000; n++) {
        ap += 1;
        del *= x / ap;
        sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
      }
      return 1 - sum * Math.exp(lead);
    }
    let b = x + 1 - a;
    let c = 1 / TINY;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 1000; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < TINY) d = TINY;
      c = b + an / c;
      if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    return Math.exp(lead) * h;
  }
  /** erfc с относительной ошибкой < 1.2e−7 (Numerical Recipes). */
  function erfc(x) {
    const z = Math.abs(x);
    const t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const normPdf = (x, m = 0, s = 1) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  const normCdf = (x, m = 0, s = 1) => 0.5 * erfc(-(x - m) / (s * Math.SQRT2));
  /** Верхний хвост N(0, 1) без потери точности при больших z. */
  const normSf = (z) => 0.5 * erfc(z / Math.SQRT2);
  /** Квантиль N(0, 1): бисекция по normCdf (точность ~1e−12). */
  function normPpf(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    let lo = -40;
    let hi = 40;
    for (let i = 0; i < 100; i++) {
      const m = (lo + hi) / 2;
      if (normCdf(m) < p) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }
  const tPdf = (x, df) => Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - ((df + 1) / 2) * Math.log1p((x * x) / df));
  /** Функция распределения Стьюдента через неполную бета-функцию. */
  function tCdf(t, df) {
    if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
    const tail = 0.5 * ibeta(df / 2, 0.5, df / (df + t * t));
    return t > 0 ? 1 - tail : tail;
  }
  /** Двустороннее p-значение для t-статистики. */
  const tP2 = (t, df) => (Number.isFinite(t) ? ibeta(df / 2, 0.5, df / (df + t * t)) : 0);
  function tPpf(p, df) {
    let lo = -1e4;
    let hi = 1e4;
    for (let i = 0; i < 120; i++) {
      const m = (lo + hi) / 2;
      if (tCdf(m, df) < p) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }
  const chi2Pdf = (x, k) => (x <= 0 ? (k === 2 ? 0.5 : 0) : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lgamma(k / 2)));
  const chi2Sf = (x, k) => gammaQ(k / 2, x / 2);
  const chi2Cdf = (x, k) => 1 - chi2Sf(x, k);
  function chi2Ppf(p, k) {
    let lo = 0;
    let hi = Math.max(10, k * 10 + 100);
    for (let i = 0; i < 120; i++) {
      const m = (lo + hi) / 2;
      if (chi2Cdf(m, k) < p) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }
  const betaPdf = (x, a, b) => (x <= 0 || x >= 1 ? 0 : Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log1p(-x) + lgamma(a + b) - lgamma(a) - lgamma(b)));
  function betaPpf(p, a, b) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 100; i++) {
      const m = (lo + hi) / 2;
      if (ibeta(a, b, m) < p) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }
  const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
  function binomPmf(k, n, p) {
    if (k < 0 || k > n) return 0;
    if (p <= 0) return k === 0 ? 1 : 0;
    if (p >= 1) return k === n ? 1 : 0;
    return Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
  }
  /** Все вероятности Bin(n, p) массивом. */
  const binomPmfAll = (n, p) => U.range(n + 1).map((k) => binomPmf(k, n, p));
  /** P(Bin(n, p) ≤ k). */
  const binomCdf = (k, n, p) => (k < 0 ? 0 : k >= n ? 1 : 1 - ibeta(k + 1, n - k, p));
  /** Хвост распределения Колмогорова Q(λ) = P(√n·D > λ). */
  function kolmogorovSf(lam) {
    if (lam < 0.2) return 1;
    let s = 0;
    for (let k = 1; k <= 100; k++) {
      const term = 2 * (k % 2 ? 1 : -1) * Math.exp(-2 * k * k * lam * lam);
      s += term;
      if (Math.abs(term) < 1e-16) break;
    }
    return U.clamp(s, 0, 1);
  }

  /* ==============================================================================
   * Выборочные характеристики
   * ============================================================================== */
  const mean = (a) => U.mean(a);
  /** Выборочная дисперсия с делением на n − ddof. */
  function variance(a, ddof = 1) {
    const m = mean(a);
    let s = 0;
    for (const v of a) s += (v - m) * (v - m);
    return a.length > ddof ? s / (a.length - ddof) : NaN;
  }
  const sd = (a, ddof = 1) => Math.sqrt(variance(a, ddof));
  const median = (a) => U.median(a);
  const quantile = (a, q) => U.quantile(a, q);
  /** Усечённое среднее: отбросить по ⌊n·t⌋ значений с каждого края. */
  function trimmedMean(a, t) {
    const v = U.sortedNumbers(a);
    const k = Math.floor(v.length * t + 1e-9);
    return mean(v.slice(k, v.length - k));
  }
  /** Медиана абсолютных отклонений от медианы. */
  function mad(a) {
    const m = median(a);
    return median(a.map((v) => Math.abs(v - m)));
  }
  function skewness(a) {
    const m = mean(a);
    const v = U.mean(a.map((x) => (x - m) ** 2));
    return v > 0 ? U.mean(a.map((x) => (x - m) ** 3)) / Math.pow(v, 1.5) : 0;
  }
  /** Ранги 1..n, у равных значений — средний ранг. */
  function ranks(a) {
    const idx = U.argsort(a);
    const r = new Array(a.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++;
      for (let k = i; k <= j; k++) r[idx[k]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  }
  function pearson(x, y) {
    const mx = mean(x);
    const my = mean(y);
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < x.length; i++) {
      sxy += (x[i] - mx) * (y[i] - my);
      sxx += (x[i] - mx) ** 2;
      syy += (y[i] - my) ** 2;
    }
    return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
  }
  const spearman = (x, y) => pearson(ranks(x), ranks(y));
  /** Гистограмма: counts и плотность на равных корзинах [lo, hi). */
  function hist(vals, lo, hi, bins) {
    const w = (hi - lo) / bins;
    const c = new Array(bins).fill(0);
    for (const v of vals) {
      const j = Math.floor((v - lo) / w);
      if (j >= 0 && j < bins) c[j]++;
      else if (v === hi) c[bins - 1]++;
    }
    return { x: c.map((_, j) => lo + (j + 0.5) * w), counts: c, dens: c.map((v) => v / (vals.length * w)), share: c.map((v) => v / vals.length), w };
  }
  /** Ступеньки ЭФР для слоя line (curve: 'step'). */
  function ecdfLine(vals, lo, hi) {
    const v = U.sortedNumbers(vals);
    const x = [lo];
    const y = [0];
    v.forEach((t, i) => {
      x.push(t);
      y.push((i + 1) / v.length);
    });
    x.push(hi);
    y.push(1);
    return { x, y };
  }

  /* ==============================================================================
   * Генераторы данных (порядок вызовов ГПСЧ совпадает с Python-экспортом)
   * ============================================================================== */
  const expDraw = (rng, m = 10) => -m * Math.log(1 - rng.random());
  /** Лаплас с дисперсией 1 (масштаб 1/√2). */
  function laplaceDraw(rng) {
    const u = rng.random() - 0.5;
    return -Math.SQRT1_2 * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }
  /** Засорённое нормальное: 90 % N(0, 1) и 10 % N(0, 10²). */
  function contamDraw(rng) {
    const u = rng.random();
    const z = rng.normal();
    return u < 0.1 ? 10 * z : z;
  }
  const cauchyDraw = (rng) => Math.tan(Math.PI * (rng.random() - 0.5));
  /** Стьюдент с 3 степенями свободы: Z / √(χ²₃/3). */
  function t3Draw(rng) {
    const z = rng.normal();
    const a = rng.normal();
    const b = rng.normal();
    const c = rng.normal();
    return z / Math.sqrt((a * a + b * b + c * c) / 3);
  }
  /** Пуассон (алгоритм Кнута). */
  function poissonDraw(rng, lam) {
    const L = Math.exp(-lam);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng.random();
    } while (p > L);
    return k - 1;
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
  function card(title) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums;overflow-x:auto;overflow-y:hidden' });
    const titleEl = H('div', { style: 'font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px' }, title);
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
  /** Контейнер для SVG-схемы: на узком экране прокручивается, а не сжимается до нечитаемости. */
  function svgHost(parent, minW = 320) {
    const outer = H('div', { style: 'overflow-x:auto;overflow-y:hidden;margin:4px 0 8px' });
    const inner = H('div', { style: 'min-width:' + minW + 'px' });
    outer.appendChild(inner);
    parent.appendChild(outer);
    return inner;
  }
  const C = (role) => GBC.colors.css(role);
  const PY_NP = 'import numpy as np\n';
  const PY_RNG = 'from gbcourse.rng import Mulberry32\n';
  const PY_ST = 'from scipy import stats\n';

  /* ==============================================================================
   * Интуиция: кто лучше на валидации?
   * ============================================================================== */
  GBC.widget('flip-winner', (el) => {
    const s = { n: 200, pA: 0.82, gap: 0.02, seed: 1 };
    const w = ui.shell(el, { title: 'Две модели, одна валидация: кто победит?', sub: 'Модель A на самом деле точнее модели B. Но мы видим лишь их точность на валидации из n объектов — а она случайна. Сверху — распределения измеренной точности обеих моделей, снизу — 30 разных валидаций: красная линия — B выглядит не хуже A.' });
    ui.slider(w.controls, { label: 'Объектов валидации n', values: [50, 100, 200, 500, 1000, 2000, 5000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Истинное преимущество A', values: [0, 0.01, 0.02, 0.03, 0.05], value: s.gap, format: (v) => '+' + U.fmt(v, 2), onInput: (v) => ((s.gap = v), draw()) });
    ui.button(w.controls, { label: 'Новые 30 валидаций', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'точность на валидации' }, y: { label: 'вероятность' } });
    const p2 = new GBC.Plot(w.main, { height: 300, x: { label: 'точность на валидации' }, y: { label: 'номер валидации', domain: [0, 31], ticks: [1, 10, 20, 30] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'P(B не хуже A)' }, { key: 'k', label: 'в этих 30 валидациях' }, { key: 'se', label: 'стандартная ошибка точности' }, { key: 'n', label: 'n, чтобы ошибаться < 5 %' }]);
    function draw() {
      const { n, pA } = s;
      const pB = pA - s.gap;
      const a = binomPmfAll(n, pA);
      const b = binomPmfAll(n, pB);
      // P(B ≥ A) = Σ_a P(A = a)·P(B ≥ a)
      const tailB = new Array(n + 2).fill(0);
      for (let k = n; k >= 0; k--) tailB[k] = tailB[k + 1] + b[k];
      let pGe = 0;
      for (let k = 0; k <= n; k++) pGe += a[k] * tailB[k];
      const sdA = Math.sqrt((pA * (1 - pA)) / n);
      const lo = Math.max(0, pB - 4.5 * sdA);
      const hi = Math.min(1, pA + 4.5 * sdA);
      const ks = U.range(n + 1).filter((k) => k / n >= lo && k / n <= hi);
      p1.render([
        { type: 'line', x: ks.map((k) => k / n), y: ks.map((k) => a[k]), color: 'blue', width: 2, label: 'модель A (истинная точность ' + f2(pA) + ')' },
        { type: 'line', x: ks.map((k) => k / n), y: ks.map((k) => b[k]), color: 'orange', width: 2, label: 'модель B (' + f2(pB) + ')' },
        { type: 'vline', x: pA, color: 'blue', dash: '5 4', width: 1.2 },
        { type: 'vline', x: pB, color: 'orange', dash: '5 4', width: 1.2 },
      ], { x: [lo, hi] });
      const rng = new GBC.RNG(1000 * s.seed + n);
      const accA = [];
      const accB = [];
      for (let r = 0; r < 30; r++) {
        let ca = 0;
        let cb = 0;
        for (let i = 0; i < n; i++) ca += rng.random() < pA ? 1 : 0;
        for (let i = 0; i < n; i++) cb += rng.random() < pB ? 1 : 0;
        accA.push(ca / n);
        accB.push(cb / n);
      }
      const ys = U.range(30, 1);
      const flip = ys.map((_, i) => accB[i] >= accA[i]);
      const idxOk = ys.map((_, i) => i).filter((i) => !flip[i]);
      const idxBad = ys.map((_, i) => i).filter((i) => flip[i]);
      p2.render([
        { type: 'segments', x1: idxOk.map((i) => accA[i]), x2: idxOk.map((i) => accB[i]), y1: idxOk.map((i) => ys[i]), y2: idxOk.map((i) => ys[i]), color: 'muted', width: 1.6, opacity: 0.8 },
        { type: 'segments', x1: idxBad.map((i) => accA[i]), x2: idxBad.map((i) => accB[i]), y1: idxBad.map((i) => ys[i]), y2: idxBad.map((i) => ys[i]), color: 'red', width: 2.6, opacity: 1 },
        { type: 'points', x: accA, y: ys, color: 'blue', r: 4.5, label: 'A', tooltip: (i) => ['валидация ' + (i + 1), 'A: ' + f3(accA[i]), 'B: ' + f3(accB[i])] },
        { type: 'points', x: accB, y: ys, color: 'orange', r: 4.5, label: 'B', tooltip: (i) => ['валидация ' + (i + 1), 'A: ' + f3(accA[i]), 'B: ' + f3(accB[i])] },
        { type: 'vline', x: pA, color: 'blue', dash: '5 4', width: 1 },
        { type: 'vline', x: pB, color: 'orange', dash: '5 4', width: 1 },
      ], { x: [lo, hi] });
      const vsum = pA * (1 - pA) + pB * (1 - pB);
      const nNeed = s.gap > 0 ? Math.ceil((1.6449 ** 2 * vsum) / (s.gap * s.gap)) : Infinity;
      st.set('p', pct(pGe));
      st.set('k', idxBad.length + ' из 30');
      st.set('se', '±' + f3(sdA));
      st.set('n', Number.isFinite(nNeed) ? '≈ ' + nNeed : 'никогда');
      note.innerHTML = s.gap === 0
        ? 'Модели одинаковы — «победитель» определяется чистой случайностью: B выглядит не хуже A примерно в половине валидаций (чуть чаще из-за ничьих).'
        : 'На валидации из ' + n + ' объектов точность каждой модели «дрожит» на ±' + f3(sdA) + ' (одна стандартная ошибка), а истинная разница — всего ' + f2(s.gap) + '. Поэтому худшая модель B выглядит не хуже A с вероятностью <b>' + pct(pGe) + '</b>. Чтобы ошибаться реже чем в 5 % случаев, нужно около ' + nNeed + ' объектов. Как измерять такую неопределённость и делать честные выводы — об этом урок.';
    }
    w.pythonAction(() => PY_NP + PY_ST + PY_RNG + '\nn, pA, pB = ' + s.n + ', ' + py(s.pA) + ', ' + py(Math.round((s.pA - s.gap) * 1000) / 1000) + '\n# точно: P(B ≥ A) = Σ P(A = a)·P(B ≥ a)\na = stats.binom.pmf(np.arange(n + 1), n, pA)\nb_tail = stats.binom.sf(np.arange(n + 1) - 1, n, pB)   # P(B ≥ a)\nprint("P(B не хуже A) =", round(float((a * b_tail).sum()), 4))\n\n# 30 валидаций тем же генератором, что и на странице\nrng = Mulberry32(' + (1000 * s.seed + s.n) + ')\nflips = 0\nfor r in range(30):\n    ca = sum(rng.random() < pA for _ in range(n))\n    cb = sum(rng.random() < pB for _ in range(n))\n    flips += cb >= ca\nprint("B не хуже A в", flips, "из 30 валидаций")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 1. Генеральная совокупность и выборка
   * ============================================================================== */
  /** 400 квартир: расстояние до центра (км) и цена (млн ₽). */
  function makeCity() {
    const rng = new GBC.RNG(15);
    const d = [];
    const p = [];
    for (let i = 0; i < 400; i++) {
      const di = 0.5 + 14.5 * rng.random();
      d.push(di);
      p.push(Math.exp(Math.log(14) - 0.07 * di + 0.25 * rng.normal()));
    }
    return { d, p };
  }
  const CITY = makeCity();
  const CITY_MU = mean(CITY.p);
  const SAMPLERS = {
    random: { label: 'случайная выборка', w: () => 1, py: '1.0' },
    metro: { label: 'только у метро (ближе к центру)', w: (i) => Math.exp(-CITY.d[i] / 2.5), py: 'np.exp(-d / 2.5)' },
    online: { label: 'откликнулись на объявление (дорогие чаще)', w: (i) => (CITY.p[i] / 10) ** 2, py: '(p / 10) ** 2' },
  };
  /** Взвешенная выборка без возвращения (Эфраимидис — Спиракис): k наибольших ключей u^(1/w). */
  function weightedSample(rng, weights, k) {
    const keys = weights.map((wt) => Math.pow(rng.random(), 1 / wt));
    return U.argsort(keys.map((v) => -v)).slice(0, k);
  }
  GBC.widget('population-sample', (el) => {
    const s = { method: 'random', n: 20, seed: 1 };
    const w = ui.shell(el, { title: 'Совокупность и выборка', sub: 'Генеральная совокупность — 400 квартир района (серые точки). Мы видим только выборку (оранжевые) и по ней оцениваем среднюю цену μ. Сравните честную случайную выборку со «удобными» способами отбора.' });
    ui.select(w.controls, { label: 'Как отбираем', value: s.method, options: Object.entries(SAMPLERS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.method = v), draw()) });
    ui.slider(w.controls, { label: 'Размер выборки n', values: [5, 10, 20, 50, 100, 200], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Новая выборка', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const p1 = new GBC.Plot(w.main, { height: 280, x: { label: 'расстояние до центра, км', domain: [0, 15.5] }, y: { label: 'цена, млн ₽' } });
    const p2 = new GBC.Plot(w.main, { height: 190, x: { label: 'средняя цена в выборке (500 выборок), млн ₽' }, y: { label: 'доля выборок' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'mu', label: 'μ — вся совокупность' }, { key: 'x', label: 'x̄ — эта выборка' }, { key: 'm', label: 'среднее x̄ по 500 выборкам' }, { key: 'b', label: 'смещение' }, { key: 'sd', label: 'разброс x̄' }]);
    function draw() {
      const S0 = SAMPLERS[s.method];
      const wts = U.range(400).map((i) => S0.w(i));
      const mi = Object.keys(SAMPLERS).indexOf(s.method);
      const idx = weightedSample(new GBC.RNG(97 * s.seed + 13 * mi + s.n), wts, s.n);
      const xbar = mean(idx.map((i) => CITY.p[i]));
      const rr = new GBC.RNG(5000 + 100 * mi + s.n);
      const means = [];
      for (let r = 0; r < 500; r++) means.push(mean(weightedSample(rr, wts, s.n).map((i) => CITY.p[i])));
      const inS = new Set(idx);
      const rest = U.range(400).filter((i) => !inS.has(i));
      p1.render([
        { type: 'points', x: rest.map((i) => CITY.d[i]), y: rest.map((i) => CITY.p[i]), color: 'data', r: 2.6, opacity: 0.55, label: 'совокупность (400)' },
        { type: 'points', x: idx.map((i) => CITY.d[i]), y: idx.map((i) => CITY.p[i]), color: 'tree', r: 4.6, label: 'выборка (' + s.n + ')', tooltip: (j) => ['расстояние ' + f1(CITY.d[idx[j]]) + ' км', 'цена ' + f2(CITY.p[idx[j]]) + ' млн'] },
        { type: 'hline', y: CITY_MU, color: 'ink2', dash: '6 4', width: 1.4, label: 'μ = ' + f2(CITY_MU) },
        { type: 'hline', y: xbar, color: 'model', width: 2, label: 'x̄ = ' + f2(xbar) },
      ]);
      const h = hist(means, 4, 16, 48);
      p2.render([
        { type: 'bars', x: h.x, y: h.share, color: 'model', width: h.w * 0.95, maxPx: 30, opacity: 0.7 },
        { type: 'vline', x: CITY_MU, color: 'ink2', dash: '6 4', width: 1.4, text: 'μ' },
        { type: 'vline', x: mean(means), color: 'tree', width: 2, text: 'среднее x̄' },
      ], { x: [4, 16] });
      const bias = mean(means) - CITY_MU;
      st.set('mu', f2(CITY_MU));
      st.set('x', f2(xbar));
      st.set('m', f2(mean(means)));
      st.set('b', U.fmtSigned(bias, 2));
      st.set('sd', '±' + f2(sd(means)));
      note.innerHTML = s.method === 'random'
        ? 'Случайная выборка в среднем попадает в μ (смещение ' + U.fmtSigned(bias, 2) + ' — шум от 500 повторов), а отдельная оценка ошибается на ±' + f2(sd(means)) + '. Увеличьте n — гистограмма сожмётся: случайную ошибку лечат объёмом данных.'
        : 'Отбор «' + S0.label + '» систематически завышает цену: в среднем на ' + f2(bias) + ' млн. Увеличьте n — гистограмма станет уже, но <b>останется на том же месте</b>: смещение отбора не лечится объёмом данных. В ML то же самое: модель, обученная на одобренных клиентах, ничего не знает об отклонённых.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\n# совокупность — тем же генератором, что и на странице\nrng = Mulberry32(15)\nd, p = [], []\nfor _ in range(400):\n    d.append(0.5 + 14.5 * rng.random())\n    p.append(np.exp(np.log(14) - 0.07 * d[-1] + 0.25 * rng.normal()))\nd, p = np.array(d), np.array(p)\nweights = np.ones(400) * ' + SAMPLERS[s.method].py + '   # способ отбора: ' + SAMPLERS[s.method].label + '\n\ndef weighted_sample(rng, w, k):\n    """Выборка без возвращения: k наибольших ключей u^(1/w)."""\n    keys = np.array([rng.random() ** (1 / wi) for wi in w])\n    return np.argsort(-keys, kind="stable")[:k]\n\nn = ' + s.n + '\nrr = Mulberry32(' + (5000 + 100 * Object.keys(SAMPLERS).indexOf(s.method) + s.n) + ')\nmeans = np.array([p[weighted_sample(rr, weights, n)].mean() for _ in range(500)])\nprint(f"μ = {p.mean():.2f}; среднее x̄ по 500 выборкам {means.mean():.2f}; смещение {means.mean() - p.mean():+.2f}; разброс {means.std(ddof=1):.2f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 2. Центр: среднее, медиана, мода
   * ============================================================================== */
  const D1 = [9, 10, 11, 12, 12, 12, 13, 14, 14, 15, 16, 35];
  /** Мода: самое частое значение (с округлением до 0.5); несколько — через запятую. */
  function modes(a) {
    const cnt = new Map();
    for (const v of a) {
      const k = Math.round(v * 2) / 2;
      cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    const mx = Math.max(...cnt.values());
    if (mx === 1) return { vals: [], mx };
    return { vals: [...cnt.entries()].filter((e) => e[1] === mx).map((e) => e[0]).sort((x, y) => x - y), mx };
  }
  GBC.widget('center-outlier', (el) => {
    const s = { x: D1.slice(), trim: 0.1, loss: 'sq' };
    const w = ui.shell(el, { title: 'Среднее, медиана и выброс', sub: 'Двенадцать доставок, время в минутах; одна доставка задержалась до 35 минут. Перетаскивайте точки (особенно правую) и следите за мерами центра. Нижний график — средние потери константы c: минимум квадратов даёт среднее, минимум модулей — медиану.' });
    ui.slider(w.controls, { label: 'Усечение (с каждого края)', values: [0, 0.1, 0.2, 0.25, 0.4], value: s.trim, format: (v) => pct(v, 0), onInput: (v) => ((s.trim = v), draw()) });
    ui.segmented(w.controls, { label: 'Потери на нижнем графике', value: s.loss, options: [{ value: 'sq', label: 'квадрат (x − c)²' }, { value: 'abs', label: 'модуль |x − c|' }], onChange: (v) => ((s.loss = v), draw()) });
    ui.button(w.controls, { label: 'Вернуть исходные данные', onClick: () => ((s.x = D1.slice()), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 210, x: { label: 'время доставки, мин', domain: [0, 62] }, y: { label: '', domain: [-0.5, 4.5], ticks: [] } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'константа c, мин', domain: [0, 62] }, y: { label: 'средние потери' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'среднее' }, { key: 'md', label: 'медиана' }, { key: 't', label: 'усечённое среднее' }, { key: 'mo', label: 'мода' }]);
    function stackY(xs) {
      const seen = new Map();
      return xs.map((v) => {
        const k = Math.round(v);
        const c = seen.get(k) || 0;
        seen.set(k, c + 1);
        return 0.35 + c * 0.9;
      });
    }
    function draw() {
      const xs = s.x;
      const m = mean(xs);
      const md = median(xs);
      const tm = trimmedMean(xs, s.trim);
      const mo = modes(xs);
      p1.render([
        { type: 'vline', x: m, color: 'model', width: 2.2, label: 'среднее' },
        { type: 'vline', x: md, color: 'tree', width: 2.2, dash: '6 3', label: 'медиана' },
        { type: 'vline', x: tm, color: 'aqua', width: 2, dash: '2 3', label: 'усечённое среднее' },
        { type: 'points', x: xs, y: stackY(xs), color: 'data', r: 7, draggable: true, onDrag: (i, x) => ((s.x[i] = Math.round(U.clamp(x, 0, 60) * 2) / 2), draw()), tooltip: (i) => ['доставка ' + (i + 1), f1(xs[i]) + ' мин'] },
      ]);
      const cs = U.linspace(0, 62, 311);
      const lossF = s.loss === 'sq' ? (c) => U.mean(xs.map((v) => (v - c) ** 2)) : (c) => U.mean(xs.map((v) => Math.abs(v - c)));
      const best = s.loss === 'sq' ? m : md;
      p2.render([
        { type: 'line', x: cs, y: cs.map(lossF), color: s.loss === 'sq' ? 'model' : 'tree', width: 2.2, label: s.loss === 'sq' ? 'средний квадрат отклонения' : 'средний модуль отклонения' },
        { type: 'points', x: [best], y: [lossF(best)], color: s.loss === 'sq' ? 'model' : 'tree', r: 6, tooltip: () => ['минимум при c = ' + f2(best), 'потери ' + f2(lossF(best))] },
        { type: 'vline', x: best, color: 'ink2', dash: '3 3', width: 1, text: s.loss === 'sq' ? 'минимум = среднее' : 'минимум = медиана' },
      ]);
      st.set('m', f2(m));
      st.set('md', f2(md));
      st.set('t', f2(tm) + ' (' + pct(s.trim, 0) + ')');
      st.set('mo', mo.vals.length ? mo.vals.map((v) => f1(v)).join(', ') + ' (×' + mo.mx + ')' : 'нет');
      const big = Math.max(...xs);
      note.innerHTML = 'Среднее ' + f2(m) + ' мин, медиана ' + f2(md) + ' мин. ' + (m - md > 1 ? 'Одна долгая доставка (' + f1(big) + ' мин) тянет среднее вправо, а медиана держится за середину: ей неважно, <i>насколько</i> далеко выброс, — важен лишь порядок. ' : 'Без сильного выброса среднее и медиана близки. ') + 'Внизу видно, почему так: квадрат сильно штрафует далёкие точки, и минимум квадратов (среднее) идёт за выбросом; модуль растёт линейно, и минимум модулей (медиана) устойчив. Это та же причина, по которой MSE в бустинге чувствителен к выбросам, а MAE — нет.';
    }
    w.pythonAction(() => PY_NP + PY_ST + '\nx = np.array(' + JSON.stringify(s.x) + ')\nprint("среднее", x.mean().round(3), " медиана", np.median(x))\nprint("усечённое среднее (' + pct(s.trim, 0) + ' с краёв):", round(stats.trim_mean(x, ' + py(s.trim) + '), 3))\nvals, cnt = np.unique(x, return_counts=True)\nprint("мода:", vals[cnt == cnt.max()], "×", cnt.max())\n\nc = np.linspace(0, 62, 6201)\nsq = ((x[:, None] - c) ** 2).mean(axis=0)\nab = np.abs(x[:, None] - c).mean(axis=0)\nprint("минимум квадратов при c =", c[sq.argmin()].round(2))\nflat = c[ab <= ab.min() + 1e-9]\nprint("минимум модулей на отрезке c ∈ [", flat.min().round(2), ",", flat.max().round(2), "] — там и медиана")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 3. Разброс и выбросы
   * ============================================================================== */
  const SPREAD_BASE = (() => {
    const rng = new GBC.RNG(3);
    return U.range(30).map(() => 50 + 5 * rng.normal());
  })();
  GBC.widget('spread', (el) => {
    const s = { k: 1, at: 80 };
    const w = ui.shell(el, { title: 'Меры разброса и правила выбросов', sub: '30 «нормальных» замеров около 50 и несколько выбросов. Три правила ищут выбросы: |z| > 3 (среднее ± 3 стандартных отклонения), медиана ± 3·1.4826·MAD и заборы Тьюки Q1 − 1.5·IQR, Q3 + 1.5·IQR. Красные точки — найденные выбросы.' });
    ui.slider(w.controls, { label: 'Число выбросов', values: [0, 1, 2, 3, 5, 8], value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.slider(w.controls, { label: 'Где выбросы', min: 60, max: 150, step: 5, value: s.at, format: String, onInput: (v) => ((s.at = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'значение' }, y: { label: '', domain: [-0.6, 4.2], ticks: [] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sd', label: 'стандартное отклонение s' }, { key: 'iqr', label: 'IQR' }, { key: 'mad', label: '1.4826·MAD' }, { key: 'f', label: 'найдено: z / MAD / Тьюки' }]);
    function draw() {
      const xs = SPREAD_BASE.concat(U.range(s.k).map((i) => s.at + 2 * i));
      const m = mean(xs);
      const sdv = sd(xs);
      const md = median(xs);
      const madS = 1.4826 * mad(xs);
      const q1 = quantile(xs, 0.25);
      const q3 = quantile(xs, 0.75);
      const iqr = q3 - q1;
      const rules = [
        { y: 2, lo: m - 3 * sdv, hi: m + 3 * sdv, name: 'среднее ± 3s', color: 'model' },
        { y: 1, lo: md - 3 * madS, hi: md + 3 * madS, name: 'медиана ± 3·MAD', color: 'aqua' },
        { y: 0, lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr, name: 'заборы Тьюки', color: 'tree' },
      ];
      const ext = U.extent(xs.concat(rules.flatMap((r) => [r.lo, r.hi])));
      const rng = new GBC.RNG(8);
      const jit = xs.map(() => 3.2 + 0.6 * rng.random());
      const L = [{ type: 'points', x: xs, y: jit, color: 'data', r: 4.5, tooltip: (i) => ['значение ' + f2(xs[i])] }];
      const flagged = [];
      for (const r of rules) {
        const out = xs.filter((v) => v < r.lo || v > r.hi);
        flagged.push(out.length);
        L.push({ type: 'segments', x1: [r.lo], x2: [r.hi], y1: [r.y], y2: [r.y], color: r.color, width: 6, opacity: 0.45 });
        L.push({ type: 'points', x: out, y: out.map(() => r.y), color: 'red', r: 4.5 });
        L.push({ type: 'text', items: [{ x: r.lo, y: r.y + 0.42, text: r.name + ': найдено ' + out.length, color: r.color }] });
      }
      plot.render(L, { x: [Math.floor(ext[0] - 3), Math.ceil(ext[1] + 3)] });
      st.set('sd', f2(sdv));
      st.set('iqr', f2(iqr));
      st.set('mad', f2(madS));
      st.set('f', flagged.join(' / '));
      note.innerHTML = s.k === 0
        ? 'Без выбросов три меры разброса близки: для нормальных данных s ≈ IQR/1.35 ≈ 1.4826·MAD ≈ σ = 5.'
        : 'Стандартное отклонение «раздувают» сами выбросы: s = ' + f2(sdv) + ' вместо ~5, поэтому правило |z| > 3 нашло ' + flagged[0] + ' из ' + s.k + (flagged[0] < s.k ? ' — выбросы <b>маскируют</b> друг друга' : '') + '. Медиана, IQR и MAD почти не меняются: правила на них нашли ' + flagged[1] + ' и ' + flagged[2] + '. Устойчивые (робастные) характеристики — первая защита от грязных данных.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nrng = Mulberry32(3)\nx = np.array([50 + 5 * rng.normal() for _ in range(30)] + [' + s.at + ' + 2 * i for i in range(' + s.k + ')])\nm, s, med = x.mean(), x.std(ddof=1), np.median(x)\nmad = 1.4826 * np.median(np.abs(x - med))\nq1, q3 = np.percentile(x, [25, 75])\niqr = q3 - q1\nprint(f"s = {s:.2f}, IQR = {iqr:.2f}, 1.4826·MAD = {mad:.2f}")\nprint("|z| > 3:        ", np.sum(np.abs(x - m) > 3 * s))\nprint("медиана ± 3 MAD:", np.sum(np.abs(x - med) > 3 * mad))\nprint("заборы Тьюки:   ", np.sum((x < q1 - 1.5 * iqr) | (x > q3 + 1.5 * iqr)))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 4. Форма распределения: гистограмма, ЭФР, Q-Q, ящик с усами
   * ============================================================================== */
  const SHAPES = {
    normal: { label: 'нормальное N(0, 1)', draw: (r) => r.normal(), pdf: (x) => normPdf(x), cdf: (x) => normCdf(x), dom: [-4, 4], py: 'rng.normal()' },
    exp: { label: 'скошенное (экспоненциальное)', draw: (r) => expDraw(r, 1), pdf: (x) => (x >= 0 ? Math.exp(-x) : 0), cdf: (x) => (x >= 0 ? 1 - Math.exp(-x) : 0), dom: [-0.3, 7], py: '-math.log(1 - rng.random())' },
    bimodal: { label: 'двугорбое (смесь)', draw: (r) => (r.random() < 0.5 ? r.normal(-2, 0.7) : r.normal(1.5, 1)), pdf: (x) => 0.5 * normPdf(x, -2, 0.7) + 0.5 * normPdf(x, 1.5, 1), cdf: (x) => 0.5 * normCdf(x, -2, 0.7) + 0.5 * normCdf(x, 1.5, 1), dom: [-5, 5], py: '(rng.normal(-2, 0.7) if rng.random() < 0.5 else rng.normal(1.5, 1))' },
    t3: { label: 'тяжёлые хвосты (Стьюдент, 3 ст. св.)', draw: t3Draw, pdf: (x) => tPdf(x, 3), cdf: (x) => tCdf(x, 3), dom: [-7, 7], py: 't3(rng)' },
  };
  GBC.widget('distribution-views', (el) => {
    const s = { dist: 'exp', n: 100, bins: 15, view: 'hist' };
    const w = ui.shell(el, { title: 'Четыре взгляда на одну выборку', sub: 'Гистограмма показывает форму, но зависит от ширины корзин; эмпирическая функция распределения (ЭФР) не зависит ни от чего; Q-Q-график сравнивает квантили выборки с нормальными; ящик с усами сжимает всё в пять чисел. Пунктир — истинное распределение.' });
    ui.select(w.controls, { label: 'Распределение', value: s.dist, options: Object.entries(SHAPES).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.dist = v), draw()) });
    ui.slider(w.controls, { label: 'Размер выборки n', values: [20, 50, 100, 500, 2000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Корзин гистограммы', min: 3, max: 60, step: 1, value: s.bins, format: String, onInput: (v) => ((s.bins = v), draw()) });
    ui.segmented(w.controls, { label: 'Вид', value: s.view, options: [{ value: 'hist', label: 'гистограмма' }, { value: 'ecdf', label: 'ЭФР' }, { value: 'qq', label: 'Q-Q' }], onChange: (v) => ((s.view = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'x' }, y: { label: 'плотность' } });
    const box = new GBC.Plot(w.main, { height: 96, margin: { top: 4, bottom: 30 }, x: { label: 'ящик с усами' }, y: { label: '', domain: [0, 1], ticks: [] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'среднее / медиана' }, { key: 'sk', label: 'асимметрия' }, { key: 'ks', label: 'max |F̂ − F|' }, { key: 'dkw', label: '95 %-я полоса ±ε' }]);
    function draw() {
      const D = SHAPES[s.dist];
      const di = Object.keys(SHAPES).indexOf(s.dist);
      const rng = new GBC.RNG(40 + 11 * di + s.n);
      const xs = U.range(s.n).map(() => D.draw(rng));
      const v = U.sortedNumbers(xs);
      const [lo, hi] = D.dom;
      const grid = U.linspace(lo, hi, 300);
      let ks = 0;
      v.forEach((t, i) => {
        const F = D.cdf(t);
        ks = Math.max(ks, Math.abs((i + 1) / v.length - F), Math.abs(i / v.length - F));
      });
      const eps = Math.sqrt(Math.log(2 / 0.05) / (2 * s.n));
      if (s.view === 'hist') {
        const a = Math.max(lo, v[0]);
        const b = Math.min(hi, v[v.length - 1]);
        const hh = hist(xs, a, b + 1e-9, s.bins);
        plot.opts.y.label = 'плотность';
        plot.opts.x.label = 'x';
        plot.render([
          { type: 'bars', x: hh.x, y: hh.dens, color: 'model', width: hh.w * 0.98, maxPx: 400, opacity: 0.55, label: 'гистограмма (плотность)' },
          { type: 'line', x: grid, y: grid.map(D.pdf), color: 'ink2', dash: '5 4', width: 1.8, label: 'истинная плотность' },
        ], { x: [lo, hi], y: [0, Math.max(...hh.dens, ...grid.map(D.pdf)) * 1.12] });
      } else if (s.view === 'ecdf') {
        const e = ecdfLine(xs, lo, hi);
        plot.opts.y.label = 'доля значений ≤ x';
        plot.opts.x.label = 'x';
        plot.render([
          { type: 'area', x: grid, y0: grid.map((t) => Math.max(0, D.cdf(t) - eps)), y1: grid.map((t) => Math.min(1, D.cdf(t) + eps)), color: 'model', opacity: 0.12, label: 'полоса ±ε (DKW, 95 %)' },
          { type: 'line', x: grid, y: grid.map(D.cdf), color: 'ink2', dash: '5 4', width: 1.8, label: 'истинная F(x)' },
          { type: 'line', x: e.x, y: e.y, curve: 'step', color: 'model', width: 2, label: 'ЭФР F̂ₙ(x)' },
        ], { x: [lo, hi], y: [-0.02, 1.05] });
      } else {
        const zq = v.map((_, i) => normPpf((i + 0.5) / v.length));
        const q1 = quantile(xs, 0.25);
        const q3 = quantile(xs, 0.75);
        const slope = (q3 - q1) / (normPpf(0.75) - normPpf(0.25));
        const icpt = q1 - slope * normPpf(0.25);
        const zl = [zq[0], zq[zq.length - 1]];
        plot.opts.y.label = 'квантили выборки';
        plot.opts.x.label = 'квантили N(0, 1)';
        plot.render([
          { type: 'line', x: zl, y: zl.map((z) => icpt + slope * z), color: 'ink2', dash: '5 4', width: 1.6, label: 'прямая через квартили' },
          { type: 'points', x: zq, y: v, color: 'model', r: s.n > 500 ? 2.2 : 3.5, label: 'выборка', tooltip: (i) => ['z = ' + f2(zq[i]), 'x = ' + f3(v[i])] },
        ], { x: yDom(zq, 0.04), y: yDom(v, 0.04) });
      }
      // ящик с усами
      const q1 = quantile(xs, 0.25);
      const q3 = quantile(xs, 0.75);
      const iqr = q3 - q1;
      const inside = v.filter((t) => t >= q1 - 1.5 * iqr && t <= q3 + 1.5 * iqr);
      const wl = inside[0];
      const wh = inside[inside.length - 1];
      const outs = v.filter((t) => t < wl || t > wh);
      box.render([
        { type: 'rect', x0: q1, x1: q3, y0: 0.25, y1: 0.75, fill: 'model', stroke: 'model', opacity: 0.18, width: 1.6 },
        { type: 'segments', x1: [median(xs), wl, q3, wl, wh], x2: [median(xs), q1, wh, wl, wh], y1: [0.25, 0.5, 0.5, 0.35, 0.35], y2: [0.75, 0.5, 0.5, 0.65, 0.65], color: 'ink', width: 2, opacity: 1 },
        { type: 'points', x: outs, y: outs.map(() => 0.5), color: 'red', r: 3.2, hollow: true },
      ], { x: s.view === 'qq' ? yDom(v, 0.04) : [lo, hi] });
      st.set('m', f2(mean(xs)) + ' / ' + f2(median(xs)));
      st.set('sk', f2(skewness(xs)));
      st.set('ks', f3(ks));
      st.set('dkw', '±' + f3(eps));
      const notes = {
        hist: 'Подвигайте число корзин: при 3 корзинах форма теряется, при 60 гистограмма превращается в «расчёску» шума. Разумный выбор — правило Фридмана — Диакониса: ширина ≈ 2·IQR·n<sup>−1/3</sup>.',
        ecdf: 'ЭФР — доля наблюдений не больше x: ступенька высотой 1/n в каждой точке. Она не требует никаких настроек, а её отклонение от истинной F уменьшается как 1/√n: с вероятностью 95 % вся ЭФР лежит в полосе ±' + f3(eps) + ' (неравенство Дворецкого — Кифера — Вольфовица). Сейчас max |F̂ − F| = ' + f3(ks) + '.',
        qq: 'Если данные нормальны, точки ложатся на прямую. Изгиб «дугой» — асимметрия (экспоненциальное), «S» с загибами на концах — тяжёлые хвосты (Стьюдент): крайние квантили дальше нормальных. Q-Q-график — главный способ проверить предпосылку о нормальности перед t-критерием.',
      };
      note.innerHTML = notes[s.view] + ' Асимметрия ' + f2(skewness(xs)) + (Math.abs(skewness(xs)) > 0.5 ? ' — длинный хвост ' + (skewness(xs) > 0 ? 'справа: среднее больше медианы.' : 'слева.') : ' — распределение почти симметрично.');
    }
    w.pythonAction(() => {
      const di = Object.keys(SHAPES).indexOf(s.dist);
      return 'import math\n' + PY_NP + PY_ST + PY_RNG + '\ndef t3(rng):\n    z = rng.normal()\n    a, b, c = rng.normal(), rng.normal(), rng.normal()\n    return z / math.sqrt((a * a + b * b + c * c) / 3)\n\nrng = Mulberry32(' + (40 + 11 * di + s.n) + ')\nx = np.array([' + SHAPES[s.dist].py + ' for _ in range(' + s.n + ')])\nprint("среднее", x.mean().round(3), " медиана", np.median(x).round(3), " асимметрия", stats.skew(x).round(3))\nq1, med, q3 = np.percentile(x, [25, 50, 75])\nprint("пять чисел ящика:", x.min().round(3), q1.round(3), med.round(3), q3.round(3), x.max().round(3))\n' + (s.dist === 'normal' ? 'D = stats.kstest(x, "norm").statistic\n' : s.dist === 'exp' ? 'D = stats.kstest(x, "expon").statistic\n' : s.dist === 't3' ? 'D = stats.kstest(x, stats.t(3).cdf).statistic\n' : 'F = lambda t: 0.5 * stats.norm.cdf(t, -2, 0.7) + 0.5 * stats.norm.cdf(t, 1.5, 1)\nD = stats.kstest(x, F).statistic\n') + 'print("max |F̂ − F| =", round(D, 3), " полоса DKW ±", round(math.sqrt(math.log(2 / 0.05) / (2 * len(x))), 3))\n# графики: plt.hist(x, bins=' + s.bins + ', density=True); plt.ecdf(x); stats.probplot(x, plot=plt)\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 5. Два признака: корреляция Пирсона и Спирмена
   * ============================================================================== */
  const ANS_X = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
  const CORR_SETS = {
    a1: { label: 'Анскомб I: линейная связь', x: ANS_X, y: [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68] },
    a2: { label: 'Анскомб II: дуга', x: ANS_X, y: [9.14, 8.14, 8.74, 8.77, 9.26, 8.1, 6.13, 3.1, 9.13, 7.26, 4.74] },
    a3: { label: 'Анскомб III: прямая + выброс', x: ANS_X, y: [7.46, 6.77, 12.74, 7.11, 7.81, 8.84, 6.08, 5.39, 8.15, 6.42, 5.73] },
    a4: { label: 'Анскомб IV: одна точка решает всё', x: [8, 8, 8, 8, 8, 8, 8, 19, 8, 8, 8], y: [6.58, 5.76, 7.71, 8.84, 8.47, 7.04, 5.25, 12.5, 5.56, 7.91, 6.89] },
    mono: { label: 'монотонная, но не линейная', gen: (r) => { const x = U.range(40).map(() => 6 * r.random()); return { x, y: x.map((t) => Math.exp(t) * (1 + 0.15 * r.normal())) }; } },
    parab: { label: 'парабола: связь есть, корреляции нет', gen: (r) => { const x = U.range(60).map(() => 4 * r.random() - 2); return { x, y: x.map((t) => t * t + 0.3 * r.normal()) }; } },
  };
  GBC.widget('correlation-lab', (el) => {
    const s = { set: 'a1', ranks: false };
    const w = ui.shell(el, { title: 'Корреляция: одно число и четыре картинки', sub: 'Коэффициент Пирсона r измеряет силу линейной связи, Спирмена ρ — силу монотонной (это r, посчитанный по рангам). У четырёх наборов Анскомба почти одинаковые средние, дисперсии, r и прямая регрессии — а картинки совсем разные.' });
    ui.select(w.controls, { label: 'Набор данных', value: s.set, options: Object.entries(CORR_SETS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.set = v), draw()) });
    ui.toggle(w.controls, { label: 'Показать ранги вместо значений', checked: false, onChange: (v) => ((s.ranks = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'Пирсон r' }, { key: 'rs', label: 'Спирмен ρ' }, { key: 'r2', label: 'r²' }, { key: 'b', label: 'прямая y = a + bx' }]);
    function data() {
      const D = CORR_SETS[s.set];
      return D.gen ? D.gen(new GBC.RNG(Object.keys(CORR_SETS).indexOf(s.set) + 70)) : { x: D.x, y: D.y };
    }
    function draw() {
      const d0 = data();
      const d = s.ranks ? { x: ranks(d0.x), y: ranks(d0.y) } : d0;
      const r = pearson(d0.x, d0.y);
      const rs = spearman(d0.x, d0.y);
      const mx = mean(d.x);
      const my = mean(d.y);
      let sxy = 0;
      let sxx = 0;
      d.x.forEach((v, i) => ((sxy += (v - mx) * (d.y[i] - my)), (sxx += (v - mx) ** 2)));
      const b = sxx > 0 ? sxy / sxx : 0;
      const a = my - b * mx;
      const xd = yDom(d.x, 0.06);
      plot.opts.x.label = s.ranks ? 'ранг x' : 'x';
      plot.opts.y.label = s.ranks ? 'ранг y' : 'y';
      plot.render([
        { type: 'line', x: xd, y: xd.map((t) => a + b * t), color: 'tree', width: 2, label: 'прямая МНК' },
        { type: 'points', x: d.x, y: d.y, color: 'model', r: 5, label: s.ranks ? 'ранги' : 'наблюдения', tooltip: (i) => ['x = ' + f2(d.x[i]), 'y = ' + f2(d.y[i])] },
      ], { x: xd, y: yDom(d.y.concat(xd.map((t) => a + b * t)), 0.06) });
      const rr = s.ranks ? pearson(d.x, d.y) : r;
      const bb = pearson(d0.x, d0.y) * sd(d0.y) / sd(d0.x);
      st.set('r', f3(r));
      st.set('rs', f3(rs));
      st.set('r2', f3(r * r));
      st.set('b', f2(mean(d0.y) - bb * mean(d0.x)) + ' + ' + f3(bb) + '·x');
      const N = {
        a1: 'Обычное облако вокруг прямой — единственный случай, где r = ' + f3(r) + ' честно описывает картину.',
        a2: 'Связь идеальная, но нелинейная (дуга): r = ' + f3(r) + ' её недооценивает, а прямая систематически ошибается.',
        a3: 'Точная прямая и один выброс: без него r был бы почти 1. Спирмен ρ = ' + f3(rs) + ' почти не заметил выброса.',
        a4: 'У десяти точек x одинаковый — связи нет вовсе, а r = ' + f3(r) + ' создала одна точка. Всегда смотрите на диаграмму рассеяния!',
        mono: 'Связь строго возрастающая, но экспоненциальная: Пирсон r = ' + f3(r) + ', а ранговый Спирмен ρ = ' + f3(rs) + ' видит монотонность почти полностью. Деревья решений, как и Спирмен, зависят только от порядка значений признака.',
        parab: 'y почти полностью определяется x, но связь не монотонная: r = ' + f3(r) + ', ρ = ' + f3(rs) + '. Нулевая корреляция ≠ независимость; дерево же найдёт эту связь двумя разбиениями.',
      };
      note.innerHTML = N[s.set] + (s.ranks ? ' Сейчас показаны ранги: коэффициент Пирсона по ним равен ' + f3(rr) + ' — это и есть Спирмен.' : '');
    }
    w.pythonAction(() => {
      const d = data();
      return PY_NP + PY_ST + '\nx = np.array(' + JSON.stringify(d.x.map((v) => Math.round(v * 1e4) / 1e4)) + ')\ny = np.array(' + JSON.stringify(d.y.map((v) => Math.round(v * 1e4) / 1e4)) + ')\nprint("Пирсон r =", round(stats.pearsonr(x, y).statistic, 3))\nprint("Спирмен ρ =", round(stats.spearmanr(x, y).statistic, 3))\nb, a = np.polyfit(x, y, 1)\nprint(f"прямая МНК: y = {a:.2f} + {b:.3f}·x")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 6. Выборочное распределение и стандартная ошибка
   * ============================================================================== */
  const SAMP_STATS = {
    mean: { label: 'среднее', f: (a) => mean(a), truth: 10, se: (n) => 10 / Math.sqrt(n), dom: [0, 25], line: 10, py: 'x.mean()' },
    median: { label: 'медиана', f: (a) => median(a), truth: 10 * Math.LN2, se: (n) => 10 / Math.sqrt(n), dom: [0, 25], line: 10 * Math.LN2, py: 'np.median(x)' },
    share: { label: 'доля ждавших дольше 15 мин', f: (a) => a.filter((v) => v > 15).length / a.length, truth: Math.exp(-1.5), se: (n) => Math.sqrt((Math.exp(-1.5) * (1 - Math.exp(-1.5))) / n), dom: [0, 1], line: 15, py: '(x > 15).mean()' },
  };
  const repsOf = (k) => Math.round(Math.pow(2000, (k - 1) / 59));
  GBC.widget('sampling-dist', (el) => {
    const s = { stat: 'mean', n: 10, k: 1 };
    const w = ui.shell(el, { title: 'Одна выборка — одна оценка; другая выборка — другая', sub: 'Генеральная совокупность — время ожидания в очереди (среднее 10 мин, распределение скошено). Берём выборку из n человек и считаем статистику. Нажмите ▶: выборок становится больше, и гистограмма оценок вырисовывает выборочное распределение.' });
    ui.select(w.controls, { label: 'Статистика', value: s.stat, options: Object.entries(SAMP_STATS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.stat = v), draw()) });
    ui.slider(w.controls, { label: 'Размер выборки n', values: [5, 10, 30, 100, 400], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.player(w.controls, { label: 'Сколько выборок', min: 1, max: 60, value: 1, fps: 6, format: (k) => repsOf(k) + ' ' + plural(repsOf(k), 'выборка', 'выборки', 'выборок'), onChange: (k) => ((s.k = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 200, x: { label: 'время ожидания одного человека, мин', domain: [0, 50] }, y: { label: 'плотность' } });
    const p2 = new GBC.Plot(w.main, { height: 240, x: { label: 'значение статистики в выборке' }, y: { label: 'доля выборок' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'last', label: 'последняя оценка' }, { key: 'mean', label: 'среднее оценок' }, { key: 'sd', label: 'разброс оценок (SD)' }, { key: 'se', label: 'теория SE' }]);
    const pop = (() => {
      const rng = new GBC.RNG(21);
      return U.range(5000).map(() => expDraw(rng));
    })();
    const hp = hist(pop, 0, 50, 50);
    function draw() {
      const S0 = SAMP_STATS[s.stat];
      const R = repsOf(s.k);
      const rng = new GBC.RNG(7 + s.n);
      const est = [];
      let last = null;
      for (let i = 0; i < R; i++) {
        const x = U.range(s.n).map(() => expDraw(rng));
        est.push(S0.f(x));
        last = x;
      }
      const grid = U.linspace(0, 50, 200);
      p1.render([
        { type: 'bars', x: hp.x, y: hp.dens, color: 'data', width: hp.w * 0.95, maxPx: 30, opacity: 0.45, label: 'совокупность' },
        { type: 'line', x: grid, y: grid.map((t) => 0.1 * Math.exp(-t / 10)), color: 'ink2', width: 1.4, dash: '5 4', hover: false },
        { type: 'points', x: last, y: last.map(() => 0.004), color: 'tree', r: 4, label: 'последняя выборка' },
        { type: 'vline', x: S0.line, color: 'model', dash: '6 4', width: 1.4, text: s.stat === 'share' ? 'порог 15' : s.stat === 'mean' ? 'μ = 10' : 'медиана 6.93' },
      ]);
      const [a, b] = S0.dom;
      const bins = s.stat === 'share' ? Math.min(50, s.n + 1) : 50;
      const h = s.stat === 'share' ? hist(est, -0.5 / s.n, 1 + 0.5 / s.n, s.n + 1) : hist(est, a, b, bins);
      const hx = s.stat === 'share' && s.n > 100 ? null : h;
      const hh = hx || hist(est, 0, 0.5, 50);
      p2.render([
        { type: 'bars', x: hh.x, y: hh.share, color: 'model', width: hh.w * 0.95, maxPx: 30, opacity: 0.75 },
        { type: 'vline', x: S0.truth, color: 'tree', dash: '6 4', width: 1.6, text: 'истина' },
        { type: 'vline', x: est[est.length - 1], color: 'ink', width: 1.4 },
      ], { x: s.stat === 'share' ? [0, s.n > 100 ? 0.5 : 0.8] : [a, b] });
      st.set('last', f3(est[est.length - 1]));
      st.set('mean', R > 1 ? f3(mean(est)) : '—');
      st.set('sd', R > 1 ? f3(sd(est)) : '—');
      st.set('se', f3(S0.se(s.n)));
      const tail = s.stat === 'mean' ? 'Для среднего SE = σ/√n = 10/√' + s.n + ' = ' + f3(S0.se(s.n)) + '.' : s.stat === 'median' ? 'Для медианы при больших n SE ≈ 1/(2f(m)√n), где f(m) — плотность в медиане; здесь f(m) = 0.05, и SE ≈ 10/√n — так же, как у среднего (совпадение именно этого распределения).' : 'Для доли SE = √(p(1 − p)/n) с p = e<sup>−1.5</sup> ≈ 0.223.';
      note.innerHTML = (R === 1 ? 'Одна выборка дала одно число. Нажмите ▶, чтобы повторить опыт много раз. ' : 'По ' + R + ' ' + plural(R, 'выборке', 'выборкам', 'выборкам') + ' видно: оценки разбросаны вокруг истины, и разброс (SD = ' + f3(sd(est)) + ') близок к теоретической <b>стандартной ошибке</b>. ') + tail + ' Увеличьте n в 4 раза — разброс сократится вдвое: точность растёт как √n. ' + (s.n <= 10 && s.stat !== 'share' && R > 50 ? 'Заметна и асимметрия: при малых n выборочное распределение наследует скошенность данных.' : '');
    }
    w.pythonAction(() => {
      const S0 = SAMP_STATS[s.stat];
      return 'import math\n' + PY_NP + PY_RNG + '\nn, R = ' + s.n + ', ' + Math.max(2, repsOf(s.k)) + '\nrng = Mulberry32(' + (7 + s.n) + ')\nest = []\nfor _ in range(R):\n    x = np.array([-10 * math.log(1 - rng.random()) for _ in range(n)])   # время ожидания\n    est.append(' + S0.py + ')\nest = np.array(est)\nprint(f"статистика: ' + S0.label + '; среднее оценок {est.mean():.3f}, разброс {est.std(ddof=1):.3f}, теория SE {' + py(S0.se(s.n)) + ':.3f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 7. Смещение и поправка Бесселя
   * ============================================================================== */
  GBC.widget('bessel', (el) => {
    const s = { n: 5, seed: 1 };
    const w = ui.shell(el, { title: 'Почему в дисперсии делят на n − 1', sub: 'Данные из N(0, 1): истинное среднее μ = 0, истинная дисперсия σ² = 1. Сверху — одна выборка: отклонения от своего среднего x̄ всегда меньше, чем от μ. Снизу — средняя по 5000 выборкам оценка дисперсии при делении на n и на n − 1.' });
    ui.slider(w.controls, { label: 'Размер выборки n', min: 2, max: 30, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Другая выборка', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const p1 = new GBC.Plot(w.main, { height: 150, x: { label: 'значения выборки', domain: [-3.2, 3.2] }, y: { label: '', domain: [-0.2, 1.5], ticks: [] } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'n', domain: [1.5, 30.5] }, y: { label: 'средняя оценка дисперсии', domain: [0.4, 1.15] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ss', label: 'Σ(x − x̄)² / Σ(x − μ)²' }, { key: 'b', label: 'среднее при делении на n' }, { key: 'u', label: 'при делении на n − 1' }, { key: 't', label: 'теория (n − 1)/n' }]);
    const cache = {};
    function sim(n) {
      if (cache[n]) return cache[n];
      const rng = new GBC.RNG(100 + n);
      let sb = 0;
      let su = 0;
      const R = 5000;
      for (let i = 0; i < R; i++) {
        const xs = U.range(n).map(() => rng.normal());
        const m = mean(xs);
        let ss = 0;
        for (const v of xs) ss += (v - m) * (v - m);
        sb += ss / n;
        su += ss / (n - 1);
      }
      return (cache[n] = [sb / R, su / R]);
    }
    function draw() {
      const rng = new GBC.RNG(200 + 37 * s.seed + s.n);
      const xs = U.range(s.n).map(() => rng.normal());
      const m = mean(xs);
      const ssBar = U.sum(xs.map((v) => (v - m) ** 2));
      const ssMu = U.sum(xs.map((v) => v * v));
      const ys = xs.map((_, i) => 0.25 + (0.9 * i) / Math.max(1, s.n - 1));
      p1.render([
        { type: 'segments', x1: xs, x2: xs.map(() => 0), y1: ys.map((y) => y + 0.04), y2: ys.map((y) => y + 0.04), color: 'tree', width: 1.4, opacity: 0.7 },
        { type: 'segments', x1: xs, x2: xs.map(() => m), y1: ys.map((y) => y - 0.04), y2: ys.map((y) => y - 0.04), color: 'model', width: 2, opacity: 0.9 },
        { type: 'points', x: xs, y: ys, color: 'data', r: 4.5 },
        { type: 'vline', x: 0, color: 'tree', dash: '6 4', width: 1.4, text: 'μ = 0' },
        { type: 'vline', x: m, color: 'model', width: 1.8, text: 'x̄' },
      ]);
      const ns = U.range(29, 2);
      const [b, u] = sim(s.n);
      p2.render([
        { type: 'hline', y: 1, color: 'tree', dash: '6 4', width: 1.4, label: 'истинная σ² = 1' },
        { type: 'line', x: ns, y: ns.map((n) => (n - 1) / n), color: 'red', width: 2.2, label: 'делим на n: в среднем (n − 1)/n' },
        { type: 'line', x: ns, y: ns.map(() => 1), color: 'model', width: 2.2, dash: '2 3', label: 'делим на n − 1: в среднем σ²', hover: false },
        { type: 'points', x: [s.n, s.n], y: [b, u], color: (i) => (i ? 'model' : 'red'), r: 6, tooltip: (i) => [i ? 'деление на n − 1' : 'деление на n', 'симуляция: ' + f4(i ? u : b)] },
      ]);
      st.set('ss', f3(ssBar) + ' / ' + f3(ssMu));
      st.set('b', f4(b));
      st.set('u', f4(u));
      st.set('t', f4((s.n - 1) / s.n));
      note.innerHTML = 'В этой выборке сумма квадратов от x̄ равна ' + f3(ssBar) + ', а от μ — ' + f3(ssMu) + ': выборочное среднее «подстраивается» под сами точки и всегда ближе к ним, чем истинное μ. Поэтому деление на n <b>систематически занижает</b> дисперсию — в среднем в (n − 1)/n = ' + f3((s.n - 1) / s.n) + ' раза (при n = 5 — на 20 %). Деление на n − 1 даёт <b>несмещённую</b> оценку s². С ростом n разница исчезает.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nn, R = ' + s.n + ', 5000\nrng = Mulberry32(' + (100 + s.n) + ')\nb = u = 0.0\nfor _ in range(R):\n    x = np.array([rng.normal() for _ in range(n)])\n    b += x.var() / R          # ddof=0: деление на n\n    u += x.var(ddof=1) / R    # деление на n − 1\nprint(f"делим на n: {b:.4f} (теория {(n - 1) / n:.4f});  делим на n − 1: {u:.4f} (теория 1)")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 8. Смещение, разброс и MSE оценки; сжатие
   * ============================================================================== */
  GBC.widget('shrinkage', (el) => {
    const s = { mu: 0.5, n: 5, c: 1 };
    const w = ui.shell(el, { title: 'Сжатая оценка c·x̄: немного смещения ради меньшего разброса', sub: 'Оцениваем среднее μ по n наблюдениям с σ = 1. Обычная оценка x̄ несмещённая, но шумная. Сжатая оценка c·x̄ (0 ≤ c ≤ 1) тянет ответ к нулю: смещение растёт, разброс падает в c² раз. Среднеквадратичная ошибка MSE = смещение² + дисперсия.' });
    ui.slider(w.controls, { label: 'Истинное среднее μ', min: 0, max: 2, step: 0.05, value: s.mu, format: f2, onInput: (v) => ((s.mu = v), draw()) });
    ui.slider(w.controls, { label: 'Наблюдений n', values: [1, 2, 5, 10, 20, 50], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const cs = ui.slider(w.controls, { label: 'Множитель сжатия c', min: 0, max: 1, step: 0.01, value: s.c, format: f2, onInput: (v) => ((s.c = v), draw()) });
    ui.button(w.controls, { label: 'Поставить лучшее c*', onClick: () => ((s.c = Math.round(cstar() * 100) / 100), cs.set(s.c), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'множитель c', domain: [0, 1] }, y: { label: 'ошибка' } });
    const p2 = new GBC.Plot(w.main, { height: 180, x: { label: 'оценка c·x̄ в 2000 опытах' }, y: { label: 'доля' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'MSE при этом c' }, { key: 'm1', label: 'MSE несмещённой (c = 1)' }, { key: 'cs', label: 'лучшее c*' }, { key: 'sim', label: 'MSE в симуляции' }]);
    const v = () => 1 / s.n;
    const cstar = () => (s.mu * s.mu) / (s.mu * s.mu + v());
    const mse = (c) => (1 - c) ** 2 * s.mu * s.mu + c * c * v();
    function draw() {
      const grid = U.linspace(0, 1, 101);
      const c0 = cstar();
      p1.render([
        { type: 'line', x: grid, y: grid.map((c) => (1 - c) ** 2 * s.mu * s.mu), color: 'tree', width: 2, label: 'смещение²' },
        { type: 'line', x: grid, y: grid.map((c) => c * c * v()), color: 'model', width: 2, label: 'дисперсия' },
        { type: 'line', x: grid, y: grid.map(mse), color: 'ink', width: 2.6, label: 'MSE' },
        { type: 'points', x: [c0], y: [mse(c0)], color: 'ink', r: 5.5, hollow: true, label: 'минимум c*' },
        { type: 'vline', x: s.c, color: 'ink2', dash: '3 3', width: 1.2 },
      ], { y: [0, Math.max(s.mu * s.mu, v()) * 1.12 + 1e-6] });
      const rng = new GBC.RNG(77 + s.n);
      const est = U.range(2000).map(() => s.c * (s.mu + rng.normal() / Math.sqrt(s.n)));
      const span = 3.5 / Math.sqrt(s.n);
      const h = hist(est, -span, s.mu + span, 45);
      p2.render([
        { type: 'bars', x: h.x, y: h.share, color: 'model', width: h.w * 0.95, maxPx: 30, opacity: 0.7 },
        { type: 'vline', x: s.mu, color: 'tree', dash: '6 4', width: 1.6, text: 'μ' },
        { type: 'vline', x: mean(est), color: 'ink', width: 1.6, text: 'среднее оценок' },
      ], { x: [-span, s.mu + span] });
      const simMse = U.mean(est.map((e) => (e - s.mu) ** 2));
      st.set('m', f4(mse(s.c)));
      st.set('m1', f4(v()));
      st.set('cs', f3(c0) + ' (MSE ' + f4(mse(c0)) + ')');
      st.set('sim', f4(simMse));
      note.innerHTML = 'Лучший множитель c* = μ²/(μ² + σ²/n) = ' + f3(c0) + ' всегда меньше 1: <b>смещённая оценка точнее несмещённой</b> (MSE ' + f4(mse(c0)) + ' против ' + f4(v()) + '). Выигрыш велик, когда данных мало или сигнал слаб (μ мало), и исчезает при большом n. Беда в том, что c* зависит от неизвестного μ, — на практике силу сжатия подбирают по валидации. Это идея гребневой регрессии, коэффициента λ в листьях XGBoost и темпа обучения ν в бустинге.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nmu, n, c = ' + py(s.mu) + ', ' + s.n + ', ' + py(s.c) + '\nmse = lambda c: (1 - c) ** 2 * mu**2 + c**2 / n        # смещение² + дисперсия\nc_star = mu**2 / (mu**2 + 1 / n)\nprint(f"MSE(c = {c}) = {mse(c):.4f};  MSE(1) = {mse(1):.4f};  c* = {c_star:.3f}, MSE(c*) = {mse(c_star):.4f}")\nrng = Mulberry32(' + (77 + s.n) + ')\nest = np.array([c * (mu + rng.normal() / np.sqrt(n)) for _ in range(2000)])\nprint("MSE в симуляции:", round(((est - mu) ** 2).mean(), 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 9. Состоятельность и эффективность: среднее против медианы
   * ============================================================================== */
  const EFF = {
    normal: { label: 'нормальное', draw: (r) => r.normal(), ratio: Math.PI / 2, py: 'rng.normal()' },
    laplace: { label: 'Лапласа (острый пик)', draw: laplaceDraw, ratio: 0.5, py: 'laplace(rng)' },
    contam: { label: 'засорённое: 10 % выбросов', draw: contamDraw, ratio: 0.174, py: 'contam(rng)' },
    cauchy: { label: 'Коши (очень тяжёлые хвосты)', draw: cauchyDraw, ratio: 0, py: 'math.tan(math.pi * (rng.random() - 0.5))' },
  };
  GBC.widget('efficiency', (el) => {
    const s = { dist: 'normal', n: 25 };
    const w = ui.shell(el, { title: 'Среднее или медиана: чья оценка центра точнее?', sub: 'Симметричное распределение с центром 0: и среднее, и медиана оценивают одно и то же. 3000 выборок размера n — чья гистограмма уже, та оценка эффективнее. Снизу — одна длинная выборка: обе оценки сходятся к центру (состоятельность) — или нет.' });
    ui.select(w.controls, { label: 'Распределение данных', value: s.dist, options: Object.entries(EFF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.dist = v), draw()) });
    ui.slider(w.controls, { label: 'Размер выборки n', values: [5, 11, 25, 101], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'оценка центра' }, y: { label: 'доля выборок' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'размер выборки (лог. шкала)', type: 'log', domain: [5, 5000], ticks: [5, 10, 50, 100, 500, 1000, 5000] }, y: { label: 'оценка по первым n значениям' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'SD среднего' }, { key: 'b', label: 'SD медианы' }, { key: 'r', label: 'Var(медианы) / Var(среднего)' }, { key: 't', label: 'теория при n → ∞' }]);
    function draw() {
      const D = EFF[s.dist];
      const di = Object.keys(EFF).indexOf(s.dist);
      const rng = new GBC.RNG(300 + 17 * di + s.n);
      const mm = [];
      const md = [];
      for (let r = 0; r < 3000; r++) {
        const x = U.range(s.n).map(() => D.draw(rng));
        mm.push(mean(x));
        md.push(median(x));
      }
      const robustSpan = 4 * Math.max(quantile(md.map(Math.abs), 0.9), 0.05);
      const span = s.dist === 'cauchy' ? Math.max(3, robustSpan) : Math.max(robustSpan, 3.2 * Math.min(sd(mm), sd(md)) + 0.01);
      const h1 = hist(mm, -span, span, 50);
      const h2 = hist(md, -span, span, 50);
      p1.render([
        { type: 'bars', x: h1.x, y: h1.share, color: 'model', width: h1.w * 0.95, maxPx: 30, opacity: 0.55, label: 'среднее' },
        { type: 'line', x: h2.x, y: h2.share, curve: 'step', color: 'tree', width: 2.2, label: 'медиана' },
        { type: 'vline', x: 0, color: 'ink2', dash: '5 4', width: 1.2 },
      ], { x: [-span, span] });
      const r2 = new GBC.RNG(900 + di);
      const long = U.range(5000).map(() => D.draw(r2));
      const ck = U.range(61).map((i) => Math.round(5 * Math.pow(1000, i / 60)));
      const runM = [];
      let acc = 0;
      let j = 0;
      for (let i = 0; i < long.length; i++) {
        acc += long[i];
        if (j < ck.length && i + 1 === ck[j]) {
          runM.push(acc / (i + 1));
          while (j < ck.length && ck[j] === i + 1) j++;
        }
      }
      const ckU = Array.from(new Set(ck));
      const runMed = ckU.map((k) => median(long.slice(0, k)));
      const lim = s.dist === 'cauchy' ? Math.max(3, Math.min(30, Math.max(...runM.map(Math.abs)) * 1.1)) : Math.max(1, ...runM.map(Math.abs), ...runMed.map(Math.abs)) * 1.1;
      p2.render([
        { type: 'hline', y: 0, color: 'ink2', dash: '5 4', width: 1.2 },
        { type: 'line', x: ckU, y: runM.map((v) => U.clamp(v, -lim, lim)), color: 'model', width: 2, label: 'среднее' },
        { type: 'line', x: ckU, y: runMed, color: 'tree', width: 2, label: 'медиана' },
      ], { y: [-lim, lim] });
      const ratio = variance(md) / variance(mm);
      st.set('a', f3(sd(mm)));
      st.set('b', f3(sd(md)));
      st.set('r', f3(ratio));
      st.set('t', s.dist === 'cauchy' ? 'у среднего нет дисперсии' : f3(D.ratio));
      const N = {
        normal: 'Для нормальных данных среднее эффективнее: дисперсия медианы больше в ' + f2(ratio) + ' раза (в пределе π/2 ≈ 1.571). Иначе говоря, медиане нужно на 57 % больше данных для той же точности. Среднее здесь — оценка максимального правдоподобия.',
        laplace: 'У распределения Лапласа острый пик и более тяжёлые хвосты — теперь медиана точнее: отношение ' + f2(ratio) + ' (в пределе 0.5, медиана вдвое эффективнее). Медиана — оценка максимального правдоподобия для Лапласа, как и MAE — его функция потерь.',
        contam: 'Всего 10 % «выбросов» с разбросом в 10 раз больше — и среднее становится в несколько раз хуже медианы (отношение ' + f2(ratio) + ', в пределе 0.174). Реальные данные часто похожи именно на это; отсюда робастные потери Хьюбера и MAE (урок 5.3).',
        cauchy: 'У распределения Коши нет матожидания: среднее n значений распределено так же, как одно значение, и не сходится никуда (синяя линия скачет и при n = 5000). Медиана состоятельна и спокойно сходится к центру.',
      };
      note.innerHTML = N[s.dist];
    }
    w.pythonAction(() => {
      const di = Object.keys(EFF).indexOf(s.dist);
      return 'import math\n' + PY_NP + PY_RNG + '\ndef laplace(rng):              # дисперсия 1\n    u = rng.random() - 0.5\n    return -math.sqrt(0.5) * np.sign(u) * math.log(1 - 2 * abs(u))\n\ndef contam(rng):               # 90 % N(0, 1) и 10 % N(0, 10²)\n    u, z = rng.random(), rng.normal()\n    return 10 * z if u < 0.1 else z\n\nn = ' + s.n + '\nrng = Mulberry32(' + (300 + 17 * di + s.n) + ')\nmeans, medians = [], []\nfor _ in range(3000):\n    x = np.array([' + EFF[s.dist].py + ' for _ in range(n)])\n    means.append(x.mean())\n    medians.append(np.median(x))\nmeans, medians = np.array(means), np.array(medians)\nprint(f"SD среднего {means.std(ddof=1):.3f}, SD медианы {medians.std(ddof=1):.3f}, отношение дисперсий {medians.var(ddof=1) / means.var(ddof=1):.3f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 10. Метод моментов и максимальное правдоподобие
   * ============================================================================== */
  const MLE_MODELS = {
    bern: { label: 'монета (Бернулли), p = 0.3', truth: 0.3, dom: [0.001, 0.999], name: 'p', draw: (r) => (r.random() < 0.3 ? 1 : 0), ll: (t, x) => { const k = U.sum(x); return k * Math.log(t) + (x.length - k) * Math.log(1 - t); }, mle: (x) => mean(x), mom: (x) => mean(x), se: (t, n) => Math.sqrt((t * (1 - t)) / n), py: '1 if rng.random() < 0.3 else 0' },
    pois: { label: 'счёт событий (Пуассон), λ = 3', truth: 3, dom: [0.3, 7], name: 'λ', draw: (r) => poissonDraw(r, 3), ll: (t, x) => U.sum(x) * Math.log(t) - x.length * t, mle: (x) => mean(x), mom: (x) => mean(x), se: (t, n) => Math.sqrt(t / n), py: 'poisson(rng, 3)' },
    exp: { label: 'время до события (экспоненциальное), λ = 0.5', truth: 0.5, dom: [0.05, 1.6], name: 'λ', draw: (r) => -Math.log(1 - r.random()) / 0.5, ll: (t, x) => x.length * Math.log(t) - t * U.sum(x), mle: (x) => 1 / mean(x), mom: (x) => 1 / mean(x), se: (t, n) => t / Math.sqrt(n), py: '-math.log(1 - rng.random()) / 0.5' },
    unif: { label: 'равномерное на [0, θ], θ = 10', truth: 10, dom: [5, 20], name: 'θ', draw: (r) => 10 * r.random(), ll: (t, x) => (t >= Math.max(...x) ? -x.length * Math.log(t) : NaN), mle: (x) => Math.max(...x), mom: (x) => 2 * mean(x), se: () => NaN, py: '10 * rng.random()' },
  };
  GBC.widget('mle', (el) => {
    const s = { model: 'bern', n: 20, seed: 1 };
    const w = ui.shell(el, { title: 'Правдоподобие: при каком параметре данные наиболее вероятны?', sub: 'По выборке строим логарифм правдоподобия ℓ(θ) = Σ ln p(xᵢ | θ) и ищем его максимум. Кривая показана относительно максимума. Пунктир — квадратичное приближение по кривизне: чем острее пик, тем точнее оценка. Серая полоса — параметры, где ℓ ниже максимума не больше чем на 1.92 (интервал правдоподобия ≈ 95 %).' });
    ui.select(w.controls, { label: 'Модель данных', value: s.model, options: Object.entries(MLE_MODELS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.model = v), draw()) });
    ui.slider(w.controls, { label: 'Размер выборки n', values: [5, 10, 20, 50, 200], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Новая выборка', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'параметр' }, y: { label: 'ℓ(θ) − ℓ(θ̂)', domain: [-6, 0.6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'mle', label: 'оценка правдоподобия θ̂' }, { key: 'mom', label: 'метод моментов' }, { key: 'se', label: 'SE по кривизне' }, { key: 'ci', label: 'интервал правдоподобия' }, { key: 't', label: 'истина' }]);
    function sample() {
      const M = MLE_MODELS[s.model];
      const mi = Object.keys(MLE_MODELS).indexOf(s.model);
      const rng = new GBC.RNG(13 * s.seed + 101 * mi + s.n);
      return U.range(s.n).map(() => M.draw(rng));
    }
    function draw() {
      const M = MLE_MODELS[s.model];
      const x = sample();
      const th = M.mle(x);
      const mom = M.mom(x);
      const grid = U.linspace(M.dom[0], M.dom[1], 600);
      const l0 = M.ll(th, x);
      const rel = grid.map((t) => M.ll(t, x) - l0);
      const se = M.se(th, s.n);
      const inside = grid.filter((_, i) => rel[i] >= -1.92);
      const ciLo = inside.length ? inside[0] : NaN;
      const ciHi = inside.length ? inside[inside.length - 1] : NaN;
      const L = [
        { type: 'vband', x0: ciLo, x1: ciHi, color: 'muted', opacity: 0.14 },
        { type: 'hline', y: -1.92, color: 'ink2', dash: '3 3', width: 1 },
        { type: 'line', x: grid, y: rel.map((v) => (v < -6.5 ? NaN : v)), color: 'model', width: 2.4, label: 'ℓ(θ) − ℓ(θ̂)' },
      ];
      if (Number.isFinite(se) && se > 0) L.push({ type: 'line', x: grid, y: grid.map((t) => { const v = -((t - th) ** 2) / (2 * se * se); return v < -6.5 ? NaN : v; }), color: 'ink2', dash: '5 4', width: 1.6, label: 'парабола по кривизне' });
      L.push({ type: 'vline', x: M.truth, color: 'tree', dash: '6 4', width: 1.5, text: 'истина' });
      L.push({ type: 'points', x: [th], y: [0], color: 'model', r: 6, tooltip: () => ['θ̂ = ' + f3(th)] });
      if (s.model === 'unif') L.push({ type: 'points', x: [mom], y: [Math.max(-5.8, M.ll(mom, x) - l0 || -5.8)], color: 'aqua', r: 6, label: 'метод моментов 2x̄' });
      plot.opts.x.label = 'параметр ' + M.name;
      plot.render(L, { x: M.dom });
      st.set('mle', f3(th));
      st.set('mom', f3(mom));
      st.set('se', Number.isFinite(se) ? f3(se) : '— (нет гладкого пика)');
      st.set('ci', '[' + f3(ciLo) + ', ' + f3(ciHi) + ']');
      st.set('t', String(M.truth));
      const N = {
        bern: 'Для монеты ℓ(p) = k·ln p + (n − k)·ln(1 − p), максимум — в доле успехов k/n = ' + f3(th) + '. Кривизна даёт SE = √(p̂(1 − p̂)/n) = ' + f3(se) + ' — та же формула, что для доли. Это и есть путь от правдоподобия к log-loss (урок 15.13, шаг 31).',
        pois: 'Для Пуассона максимум правдоподобия — выборочное среднее (λ̂ = ' + f3(th) + '), SE = √(λ̂/n). Метод моментов даёт то же самое: E X = λ.',
        exp: 'Для экспоненциального распределения λ̂ = 1/x̄ = ' + f3(th) + ', SE ≈ λ̂/√n. При малых n кривая заметно несимметрична, и парабола (а с ней интервал θ̂ ± 2·SE) приближает её плохо — интервал по правдоподобию честнее.',
        unif: 'Правдоподобие θ<sup>−n</sup> при θ ≥ max xᵢ и нуль при меньших θ: максимум — в самом большом наблюдении (' + f3(th) + '), обрыв слева, гладкого пика нет. Здесь не работают привычные формулы для SE. ОМП всегда занижает θ (смещение θ/(n + 1)); метод моментов 2x̄ = ' + f3(mom) + ' несмещён, но шумнее.',
      };
      note.innerHTML = N[s.model] + ' Увеличьте n: пик становится острее (кривизна ∝ n), интервал сужается как 1/√n.';
    }
    w.pythonAction(() => {
      const mi = Object.keys(MLE_MODELS).indexOf(s.model);
      return 'import math\n' + PY_NP + PY_RNG + '\ndef poisson(rng, lam):        # алгоритм Кнута\n    L, k, p = math.exp(-lam), 0, 1.0\n    while True:\n        k += 1\n        p *= rng.random()\n        if p <= L:\n            return k - 1\n\nrng = Mulberry32(' + (13 * s.seed + 101 * mi + s.n) + ')\nx = np.array([' + MLE_MODELS[s.model].py + ' for _ in range(' + s.n + ')])\n' + {
        bern: 'p_hat = x.mean()\nprint(f"ОМП p̂ = {p_hat:.3f}, SE = {math.sqrt(p_hat * (1 - p_hat) / len(x)):.3f}")\nll = lambda p: x.sum() * np.log(p) + (len(x) - x.sum()) * np.log(1 - p)\ngrid = np.linspace(0.001, 0.999, 600)\n',
        pois: 'lam = x.mean()\nprint(f"ОМП λ̂ = {lam:.3f}, SE = {math.sqrt(lam / len(x)):.3f}")\nll = lambda t: x.sum() * np.log(t) - len(x) * t\ngrid = np.linspace(0.3, 7, 600)\n',
        exp: 'lam = 1 / x.mean()\nprint(f"ОМП λ̂ = {lam:.3f}, SE ≈ {lam / math.sqrt(len(x)):.3f}")\nll = lambda t: len(x) * np.log(t) - t * x.sum()\ngrid = np.linspace(0.05, 1.6, 600)\n',
        unif: 'print(f"ОМП θ̂ = max = {x.max():.3f};  метод моментов 2x̄ = {2 * x.mean():.3f}")\nll = lambda t: np.where(t >= x.max(), -len(x) * np.log(t), -np.inf)\ngrid = np.linspace(5, 20, 600)\n',
      }[s.model] + 'rel = ll(grid) - ll(grid).max()\ninside = grid[rel >= -1.92]\nprint(f"интервал правдоподобия ≈ 95 %: [{inside.min():.3f}, {inside.max():.3f}]")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 11. Байесовская оценка: бета-биномиальная модель
   * ============================================================================== */
  GBC.widget('beta-binomial', (el) => {
    const s = { m0: 0.1, a0: 20, n: 10, k: 3 };
    const w = ui.shell(el, { title: 'Априорное знание + данные = апостериорное', sub: 'Оцениваем конверсию новой категории товаров. Априорно (по другим категориям) конверсия около m₀ — это распределение Beta(a, b) с a = m₀·s, b = (1 − m₀)·s, где s — «сила» априорного знания в псевдонаблюдениях. Видим k покупок из n просмотров — и получаем апостериорное Beta(a + k, b + n − k).' });
    ui.slider(w.controls, { label: 'Априорное среднее m₀', min: 0.02, max: 0.6, step: 0.01, value: s.m0, format: f2, onInput: (v) => ((s.m0 = v), draw()) });
    ui.slider(w.controls, { label: 'Сила априорного знания s', values: [2, 5, 10, 20, 50, 100, 500], value: s.a0, format: String, onInput: (v) => ((s.a0 = v), draw()) });
    ui.slider(w.controls, { label: 'Просмотров n', values: [0, 1, 2, 5, 10, 20, 50, 100, 500, 2000], value: s.n, format: String, onInput: (v) => { s.k = Math.round((s.k / Math.max(1, s.n)) * v); s.n = v; ks.setMax(v); ks.set(s.k); draw(); } });
    const ks = ui.slider(w.controls, { label: 'Покупок k', min: 0, max: s.n, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'конверсия p', domain: [0, 1] }, y: { label: 'плотность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'raw', label: 'доля k/n' }, { key: 'pm', label: 'апостериорное среднее' }, { key: 'ci', label: '95 %-й достоверный интервал' }, { key: 'wd', label: 'вес данных n/(n + s)' }]);
    function draw() {
      const a = s.m0 * s.a0;
      const b = (1 - s.m0) * s.a0;
      const A = a + s.k;
      const B = b + s.n - s.k;
      const pm = A / (A + B);
      const lo = betaPpf(0.025, A, B);
      const hi = betaPpf(0.975, A, B);
      const grid = U.linspace(0.0025, 0.9975, 400);
      const prior = grid.map((p) => betaPdf(p, a, b));
      const post = grid.map((p) => betaPdf(p, A, B));
      const like = s.n > 0 ? grid.map((p) => betaPdf(p, s.k + 1, s.n - s.k + 1)) : null;
      const top = Math.max(...post, ...(like || [0]).map((v) => Math.min(v, Math.max(...post) * 1.6)), ...prior.map((v) => Math.min(v, Math.max(...post) * 1.6))) * 1.1;
      const clip = (arr) => arr.map((v) => (v > top * 1.05 ? NaN : v));
      const xmax = Math.min(1, Math.max(hi, s.n ? betaPpf(0.995, s.k + 1, s.n - s.k + 1) : 0, betaPpf(0.995, Math.max(a, 0.05), Math.max(b, 0.05))) * 1.15 + 0.02);
      plot.render([
        { type: 'vband', x0: lo, x1: hi, color: 'model', opacity: 0.1 },
        { type: 'line', x: grid, y: clip(prior), color: 'ink2', dash: '5 4', width: 1.8, label: 'априорное Beta(' + f1(a) + ', ' + f1(b) + ')' },
        like ? { type: 'line', x: grid, y: clip(like), color: 'tree', width: 1.8, label: 'правдоподобие (нормировано)' } : null,
        { type: 'line', x: grid, y: post, color: 'model', width: 2.6, label: 'апостериорное Beta(' + f1(A) + ', ' + f1(B) + ')' },
        { type: 'vline', x: pm, color: 'model', width: 1.2 },
      ], { x: [0, xmax], y: [0, top] });
      st.set('raw', s.n ? f3(s.k / s.n) : '—');
      st.set('pm', f3(pm));
      st.set('ci', '[' + f3(lo) + ', ' + f3(hi) + ']');
      st.set('wd', pct(s.n / (s.n + s.a0)));
      note.innerHTML = 'Апостериорное среднее (a + k)/(s + n) = ' + f3(pm) + ' — взвешенное среднее априорного m₀ = ' + f2(s.m0) + ' и доли в данных' + (s.n ? ' ' + f3(s.k / s.n) : '') + ' с весами s = ' + s.a0 + ' и n = ' + s.n + '. Мало данных — оценка <b>сжимается</b> к априорному значению; много данных — априорное знание забывается. Именно так сглаживают целевое кодирование категорий (урок 10.1, CatBoost в уроке 9.3): у редкой категории с 3 покупками из 4 конверсия не 75 %, а гораздо ближе к средней. Интервал [' + f3(lo) + ', ' + f3(hi) + '] — достоверный: «p лежит в нём с вероятностью 95 %» при выбранном априорном распределении.';
    }
    w.pythonAction(() => PY_ST + '\nm0, strength, n, k = ' + py(s.m0) + ', ' + s.a0 + ', ' + s.n + ', ' + s.k + '\na, b = m0 * strength, (1 - m0) * strength          # априорное Beta(a, b)\npost = stats.beta(a + k, b + n - k)                 # апостериорное\nprint(f"апостериорное среднее {post.mean():.3f}; 95 % достоверный интервал [{post.ppf(0.025):.3f}, {post.ppf(0.975):.3f}]")\n' + (s.n ? 'print(f"доля в данных {k / n:.3f}; вес данных {n / (n + strength):.1%}")\n' : ''));
    draw();
  });

  /* ==============================================================================
   * Шаг 12. Распределения Стьюдента и χ²
   * ============================================================================== */
  GBC.widget('t-dist', (el) => {
    const s = { n: 5, mode: 't' };
    const w = ui.shell(el, { title: 'Откуда берутся t и χ²', sub: '20 000 раз берём выборку из n нормальных значений (μ = 0, σ = 1). Режим «t»: строим T = (x̄ − μ)/(s/√n) — стандартизацию с оценённым σ. Режим «χ²»: (n − 1)·s²/σ². Гистограмма — симуляция, линии — теория.' });
    ui.slider(w.controls, { label: 'Размер выборки n', values: [2, 3, 5, 10, 30], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.segmented(w.controls, { label: 'Статистика', value: s.mode, options: [{ value: 't', label: 't = (x̄ − μ)/(s/√n)' }, { value: 'chi', label: '(n − 1)s²/σ²' }], onChange: (v) => ((s.mode = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'значение статистики' }, y: { label: 'плотность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '' }, { key: 'b', label: '' }, { key: 'c', label: '' }]);
    const labels = st.el.querySelectorAll('.k');
    const cache = {};
    function sim(n) {
      if (cache[n]) return cache[n];
      const rng = new GBC.RNG(500 + n);
      const T = [];
      const X2 = [];
      for (let r = 0; r < 20000; r++) {
        const x = U.range(n).map(() => rng.normal());
        const m = mean(x);
        const v = variance(x);
        T.push(m / Math.sqrt(v / n));
        X2.push((n - 1) * v);
      }
      return (cache[n] = { T, X2 });
    }
    function draw() {
      const df = s.n - 1;
      const { T, X2 } = sim(s.n);
      if (s.mode === 't') {
        const h = hist(T, -6, 6, 60);
        const g = U.linspace(-6, 6, 300);
        const tq = tPpf(0.975, df);
        plot.render([
          { type: 'bars', x: h.x, y: h.dens, color: 'model', width: h.w * 0.95, maxPx: 30, opacity: 0.45, label: 'симуляция T' },
          { type: 'line', x: g, y: g.map((v) => normPdf(v)), color: 'ink2', dash: '5 4', width: 1.8, label: 'N(0, 1)' },
          { type: 'line', x: g, y: g.map((v) => tPdf(v, df)), color: 'tree', width: 2.2, label: 'Стьюдент, ' + df + ' ст. св.' },
          { type: 'vline', x: 1.96, color: 'ink2', width: 1, dash: '2 3' },
          { type: 'vline', x: -1.96, color: 'ink2', width: 1, dash: '2 3' },
        ], { x: [-6, 6], y: [0, 0.45] });
        labels[0].textContent = 'P(|T| > 1.96) в симуляции';
        labels[1].textContent = 'квантиль t₀.₉₇₅ (' + df + ' ст. св.)';
        labels[2].textContent = 'P(|T| > t₀.₉₇₅) в симуляции';
        st.set('a', pct(T.filter((v) => Math.abs(v) > 1.96).length / T.length));
        st.set('b', f3(tq));
        st.set('c', pct(T.filter((v) => Math.abs(v) > tq).length / T.length));
        note.innerHTML = 'Когда σ заменяют оценкой s, статистика T иногда получает маленький знаменатель (s случайно мало) — и улетает далеко. Поэтому у распределения Стьюдента <b>тяжелее хвосты</b>, чем у нормального: при n = ' + s.n + ' за пределы ±1.96 выходит ' + pct(T.filter((v) => Math.abs(v) > 1.96).length / T.length) + ' значений вместо 5 %. Правильный порог — квантиль t₀.₉₇₅ = ' + f3(tq) + '. С ростом n распределение Стьюдента приближается к нормальному: при 30 наблюдениях квантиль уже 2.045.';
      } else {
        const hiX = Math.max(10, df * 3.2);
        const h = hist(X2, 0, hiX, 60);
        const g = U.linspace(0.01, hiX, 300);
        const ql = chi2Ppf(0.025, df);
        const qh = chi2Ppf(0.975, df);
        plot.render([
          { type: 'bars', x: h.x, y: h.dens, color: 'model', width: h.w * 0.95, maxPx: 30, opacity: 0.45, label: 'симуляция (n − 1)s²/σ²' },
          { type: 'line', x: g, y: g.map((v) => Math.min(chi2Pdf(v, df), 2)), color: 'tree', width: 2.2, label: 'χ² с ' + df + ' ст. св.' },
          { type: 'vline', x: df, color: 'ink2', dash: '5 4', width: 1.2, text: 'среднее ' + df },
        ], { x: [0, hiX], y: [0, Math.min(1.2, Math.max(...h.dens) * 1.15)] });
        labels[0].textContent = 'среднее в симуляции (теория ' + df + ')';
        labels[1].textContent = 'квантили χ²: 2.5 % и 97.5 %';
        labels[2].textContent = 'P(s² < σ²) в симуляции';
        st.set('a', f3(mean(X2)));
        st.set('b', f2(ql) + ' и ' + f2(qh));
        st.set('c', pct(X2.filter((v) => v < df).length / X2.length));
        note.innerHTML = 'Сумма квадратов n − 1 независимых стандартных нормальных величин имеет распределение χ² с n − 1 степенями свободы («одну степень» съела оценка среднего). Оно скошено вправо: s² чаще занижает σ² (в ' + pct(X2.filter((v) => v < df).length / X2.length) + ' выборок), хотя в среднем точна. Отсюда несимметричный интервал для дисперсии: [(n − 1)s²/' + f2(qh) + ', (n − 1)s²/' + f2(ql) + '].';
      }
    }
    w.pythonAction(() => PY_NP + PY_ST + PY_RNG + '\nn = ' + s.n + '\nrng = Mulberry32(' + (500 + s.n) + ')\nT, X2 = [], []\nfor _ in range(20000):\n    x = np.array([rng.normal() for _ in range(n)])\n    T.append(x.mean() / (x.std(ddof=1) / np.sqrt(n)))\n    X2.append((n - 1) * x.var(ddof=1))\nT, X2 = np.array(T), np.array(X2)\nprint("P(|T| > 1.96):", round(np.mean(np.abs(T) > 1.96), 4), " квантиль t:", round(stats.t.ppf(0.975, n - 1), 3))\nprint("среднее (n − 1)s²:", round(X2.mean(), 3), " квантили χ²:", stats.chi2.ppf([0.025, 0.975], n - 1).round(2))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 13. Покрытие доверительных интервалов
   * ============================================================================== */
  GBC.widget('ci-coverage', (el) => {
    const s = { n: 10, seed: 1, z: false, conf: 0.95, dist: 'exp' };
    const w = ui.shell(el, { title: '100 доверительных интервалов', sub: '100 раз берём выборку из n значений и строим интервал x̄ ± t·s/√n. Синие интервалы накрыли истинное среднее μ = 10, красные — промахнулись. Доля накрывших должна быть близка к уровню доверия.' });
    ui.select(w.controls, { label: 'Данные', value: s.dist, options: [{ value: 'norm', label: 'нормальные, μ = 10, σ = 10' }, { value: 'exp', label: 'скошенные (время ожидания)' }], onChange: (v) => ((s.dist = v), draw()) });
    ui.slider(w.controls, { label: 'Размер выборки n', values: [3, 5, 10, 30, 100], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Уровень доверия', values: [0.8, 0.9, 0.95, 0.99], value: s.conf, format: (v) => pct(v, 0), onInput: (v) => ((s.conf = v), draw()) });
    ui.toggle(w.controls, { label: 'Множитель z вместо t', checked: false, onChange: (v) => ((s.z = v), draw()) });
    ui.button(w.controls, { label: 'Новые 100 выборок', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 380, x: { label: 'интервал для среднего' }, y: { label: 'номер выборки', domain: [0, 101], ticks: [1, 25, 50, 75, 100] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'накрыли μ' }, { key: 'm', label: 'множитель' }, { key: 'w', label: 'средняя ширина' }, { key: 'cov', label: 'покрытие на 4000 выборках' }]);
    const drawX = (rng) => (s.dist === 'exp' ? expDraw(rng) : 10 + 10 * rng.normal());
    function intervals(seed, R) {
      const rng = new GBC.RNG(seed * 1000 + s.n + (s.dist === 'exp' ? 0 : 500000));
      const k = s.z ? normPpf(0.5 + s.conf / 2) : tPpf(0.5 + s.conf / 2, s.n - 1);
      const out = [];
      for (let i = 0; i < R; i++) {
        const xs = U.range(s.n).map(() => drawX(rng));
        const m = mean(xs);
        const h = (k * sd(xs)) / Math.sqrt(s.n);
        out.push([m - h, m + h]);
      }
      return { out, k };
    }
    function draw() {
      const { out, k } = intervals(s.seed, 100);
      const hit = out.map(([a, b]) => a <= 10 && 10 <= b);
      const ys = U.range(100, 1);
      const sel = (f) => ys.map((_, i) => i).filter(f);
      const ok = sel((i) => hit[i]);
      const bad = sel((i) => !hit[i]);
      const lim = Math.max(15, ...out.map((q) => Math.abs(q[1] - 10)), ...out.map((q) => Math.abs(q[0] - 10)));
      const xl = Math.min(lim, 45);
      plot.render([
        { type: 'segments', x1: ok.map((i) => Math.max(10 - xl, out[i][0])), y1: ok.map((i) => ys[i]), x2: ok.map((i) => Math.min(10 + xl, out[i][1])), y2: ok.map((i) => ys[i]), color: 'model', width: 2, opacity: 0.8 },
        { type: 'segments', x1: bad.map((i) => Math.max(10 - xl, out[i][0])), y1: bad.map((i) => ys[i]), x2: bad.map((i) => Math.min(10 + xl, out[i][1])), y2: bad.map((i) => ys[i]), color: 'red', width: 2.6, opacity: 1 },
        { type: 'vline', x: 10, color: 'tree', width: 1.6, dash: '6 4', text: 'μ = 10' },
      ], { x: [10 - xl, 10 + xl] });
      const big = intervals(s.seed + 500, 4000).out;
      const cov = big.filter(([a, b]) => a <= 10 && 10 <= b).length / big.length;
      st.set('c', ok.length + ' из 100');
      st.set('m', f3(k) + (s.z ? ' (z)' : ' (t, ' + (s.n - 1) + ' ст. св.)'));
      st.set('w', f2(U.mean(out.map((q) => q[1] - q[0]))));
      st.set('cov', pct(cov) + ' (цель ' + pct(s.conf, 0) + ')');
      const lack = s.conf - cov;
      note.innerHTML = '«' + pct(s.conf, 0) + '» — свойство <b>процедуры</b>: из многих так построенных интервалов около ' + pct(s.conf, 0) + ' накроют μ, про каждый конкретный мы этого не знаем. ' + (s.z && s.n < 30 ? 'С множителем z = ' + f3(k) + ' вместо t интервалы слишком узкие для малых n и накрывают реже обещанного. ' : '') + (s.dist === 'exp' ? (lack > 0.01 ? 'Данные скошены, поэтому даже с t покрытие ниже обещанного (' + pct(cov) + '): нормальное приближение для среднего при малых n ещё неточно. Для скошенных метрик надёжнее бутстрэп или больше данных.' : 'Данные скошены, но при n = ' + s.n + ' выборочное среднее уже почти нормально (ЦПТ): покрытие ' + pct(cov) + ' близко к обещанному.') : 'Для нормальных данных t-интервал точен при любом n: покрытие ' + pct(cov) + '.');
    }
    w.pythonAction(() => 'import math\n' + PY_NP + PY_ST + PY_RNG + '\nn, conf, R = ' + s.n + ', ' + s.conf + ', 4000\nk = stats.' + (s.z ? 'norm.ppf(0.5 + conf / 2)' : 't.ppf(0.5 + conf / 2, n - 1)') + '\nrng = Mulberry32(' + ((s.seed + 500) * 1000 + s.n + (s.dist === 'exp' ? 0 : 500000)) + ')\nhits = 0\nfor _ in range(R):\n    x = np.array([' + (s.dist === 'exp' ? '-10 * math.log(1 - rng.random())' : '10 + 10 * rng.normal()') + ' for _ in range(n)])\n    h = k * x.std(ddof=1) / math.sqrt(n)\n    hits += x.mean() - h <= 10 <= x.mean() + h\nprint(f"множитель {k:.3f}; покрытие {hits / R:.1%} при обещанных {conf:.0%}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 14. Ширина интервала и размер выборки
   * ============================================================================== */
  GBC.widget('ci-width', (el) => {
    const s = { mode: 'mean', sigma: 10, p: 0.5, E: 1, Ep: 0.03, conf: 0.95 };
    const w = ui.shell(el, { title: 'Сколько данных нужно для заданной точности?', sub: 'Полуширина интервала E = z·σ/√n (для среднего) или z·√(p(1 − p)/n) (для доли). Обратная задача — планирование: n = (z·σ/E)². Ось n логарифмическая: каждое деление — в 10 раз больше данных.' });
    const modeCtl = ui.segmented(w.controls, { label: 'Что оцениваем', value: s.mode, options: [{ value: 'mean', label: 'среднее' }, { value: 'prop', label: 'долю' }], onChange: (v) => ((s.mode = v), sync(), draw()) });
    void modeCtl;
    const box1 = H('div');
    const box2 = H('div');
    w.controls.append(box1, box2);
    ui.slider(box1, { label: 'σ данных', min: 1, max: 20, step: 1, value: s.sigma, format: String, onInput: (v) => ((s.sigma = v), draw()) });
    ui.slider(box1, { label: 'Нужная полуширина E', values: [0.25, 0.5, 1, 2, 3, 5], value: s.E, format: (v) => '±' + v, onInput: (v) => ((s.E = v), draw()) });
    ui.slider(box2, { label: 'Ожидаемая доля p', values: [0.01, 0.05, 0.1, 0.2, 0.3, 0.5], value: s.p, format: String, onInput: (v) => ((s.p = v), draw()) });
    ui.slider(box2, { label: 'Нужная полуширина E', values: [0.005, 0.01, 0.02, 0.03, 0.05, 0.1], value: s.Ep, format: (v) => '±' + v, onInput: (v) => ((s.Ep = v), draw()) });
    ui.slider(w.controls, { label: 'Уровень доверия', values: [0.8, 0.9, 0.95, 0.99], value: s.conf, format: (v) => pct(v, 0), onInput: (v) => ((s.conf = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'размер выборки n (лог. шкала)', type: 'log', domain: [2, 20000], ticks: [2, 10, 100, 1000, 10000] }, y: { label: 'полуширина интервала E', type: 'log' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'нужно наблюдений' }, { key: 'z', label: 'множитель z' }, { key: 'x4', label: 'вдвое точнее — нужно' }]);
    function sync() {
      box1.style.display = s.mode === 'mean' ? '' : 'none';
      box2.style.display = s.mode === 'prop' ? '' : 'none';
    }
    function draw() {
      const z = normPpf(0.5 + s.conf / 2);
      const ns = U.range(80).map((i) => 2 * Math.pow(10000, i / 79));
      const L = [];
      let need;
      let E;
      if (s.mode === 'mean') {
        E = s.E;
        need = Math.ceil(((z * s.sigma) / E) ** 2);
        let nt = Math.max(2, need);
        for (let it = 0; it < 50; it++) nt = Math.max(2, Math.ceil(((tPpf(0.5 + s.conf / 2, nt - 1) * s.sigma) / E) ** 2));
        L.push({ type: 'line', x: ns, y: ns.map((n) => (tPpf(0.5 + s.conf / 2, Math.max(1, Math.round(n) - 1)) * s.sigma) / Math.sqrt(n)), color: 'tree', width: 2, dash: '5 4', label: 't·σ/√n (учёт оценки σ)' });
        L.push({ type: 'line', x: ns, y: ns.map((n) => (z * s.sigma) / Math.sqrt(n)), color: 'model', width: 2.4, label: 'z·σ/√n' });
        need = Math.max(need, nt);
      } else {
        E = s.Ep;
        need = Math.ceil((z * z * s.p * (1 - s.p)) / (E * E));
        L.push({ type: 'line', x: ns, y: ns.map((n) => z * Math.sqrt((s.p * (1 - s.p)) / n)), color: 'model', width: 2.4, label: 'z·√(p(1 − p)/n)' });
        L.push({ type: 'line', x: ns, y: ns.map((n) => z * Math.sqrt(0.25 / n)), color: 'ink2', width: 1.4, dash: '3 3', label: 'худший случай p = 0.5' });
      }
      L.push({ type: 'hline', y: E, color: 'ink2', dash: '6 4', width: 1.2 });
      if (need <= 20000) L.push({ type: 'points', x: [need], y: [E], color: 'tree', r: 6, label: 'нужно n = ' + need });
      const ys = L.filter((l) => l.type === 'line').flatMap((l) => l.y).filter(Number.isFinite);
      plot.render(L, { y: [Math.max(1e-4, Math.min(...ys, E) * 0.8), Math.max(...ys, E) * 1.3] });
      st.set('n', need > 1e7 ? '> 10 млн' : String(need));
      st.set('z', f3(z));
      st.set('x4', String(4 * need));
      note.innerHTML = s.mode === 'mean'
        ? 'Чтобы интервал был ±' + E + ' при σ = ' + s.sigma + ' и уровне ' + pct(s.conf, 0) + ', нужно около <b>' + need + '</b> наблюдений. Ширина убывает как 1/√n: вдвое точнее — вчетверо больше данных (' + 4 * need + '). При малых n пунктир t выше: σ ещё приходится оценивать.'
        : 'Для доли около ' + s.p + ' и точности ±' + E + ' нужно <b>' + need + '</b> наблюдений. Худший случай — p = 0.5: так получается знаменитое «опрос 1000 человек даёт ±3 %». Для редких событий (p = 0.01) абсолютная точность дешевле, но относительная — дорогая: ±0.005 при p = 0.01 — это ±50 %.';
    }
    w.pythonAction(() => 'import math\n' + PY_ST + '\nz = stats.norm.ppf(0.5 + ' + s.conf + ' / 2)\n' + (s.mode === 'mean' ? 'sigma, E = ' + s.sigma + ', ' + s.E + '\nn = math.ceil((z * sigma / E) ** 2)\nprint("по формуле z:", n)\n# с учётом t: решаем итерациями\nfor _ in range(50):\n    n = max(2, math.ceil((stats.t.ppf(0.5 + ' + s.conf + ' / 2, n - 1) * sigma / E) ** 2))\nprint("с квантилем Стьюдента:", n)\n' : 'p, E = ' + s.p + ', ' + s.Ep + '\nprint("нужно наблюдений:", math.ceil(z**2 * p * (1 - p) / E**2))\n'));
    sync();
    draw();
  });

  /* ==============================================================================
   * Шаг 15. Интервалы для доли: Вальд, Уилсон, Клоппер — Пирсон
   * ============================================================================== */
  const Z95 = normPpf(0.975);
  function propCI(k, n, method) {
    const ph = k / n;
    if (method === 'wald') {
      const h = Z95 * Math.sqrt((ph * (1 - ph)) / n);
      return [Math.max(0, ph - h), Math.min(1, ph + h)];
    }
    if (method === 'wilson') {
      const z2 = Z95 * Z95;
      const c = (ph + z2 / (2 * n)) / (1 + z2 / n);
      const h = (Z95 * Math.sqrt((ph * (1 - ph)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
      const lo = c - h < 1e-12 ? 0 : c - h;
      const hi = c + h > 1 - 1e-12 ? 1 : c + h;
      return [lo, hi];
    }
    return [k === 0 ? 0 : betaPpf(0.025, k, n - k + 1), k === n ? 1 : betaPpf(0.975, k + 1, n - k)];
  }
  const PMETH = { wald: { label: 'Вальд p̂ ± z·√(p̂(1 − p̂)/n)', color: 'red' }, wilson: { label: 'Уилсон', color: 'model' }, cp: { label: 'Клоппер — Пирсон (точный)', color: 'aqua' } };
  GBC.widget('proportion-ci', (el) => {
    const s = { n: 20, k: 0 };
    const w = ui.shell(el, { title: 'Интервал для доли: формула «из учебника» подводит', sub: 'Сверху — точное покрытие трёх 95 %-х интервалов в зависимости от истинной доли p (посчитано по биномиальному распределению, без симуляции). Снизу — сами интервалы для k успехов из n.' });
    ui.slider(w.controls, { label: 'Размер выборки n', values: [10, 20, 30, 50, 100, 200, 500], value: s.n, format: String, onInput: (v) => { s.k = Math.round((s.k / s.n) * v); s.n = v; ks.setMax(v); ks.set(s.k); draw(); } });
    const ks = ui.slider(w.controls, { label: 'Успехов k', min: 0, max: s.n, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'истинная доля p', domain: [0, 1] }, y: { label: 'покрытие', domain: [0.5, 1.005] } });
    const p2 = new GBC.Plot(w.main, { height: 150, x: { label: 'интервал для p', domain: [0, 1] }, y: { label: '', domain: [0.4, 3.6], ticks: [] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'wald', label: 'Вальд: среднее / худшее покрытие' }, { key: 'wilson', label: 'Уилсон' }, { key: 'cp', label: 'Клоппер — Пирсон' }]);
    const cache = {};
    function coverage(n) {
      if (cache[n]) return cache[n];
      const ps = U.range(499).map((i) => 0.002 * (i + 1));
      const ints = {};
      for (const m of Object.keys(PMETH)) ints[m] = U.range(n + 1).map((k) => propCI(k, n, m));
      const cov = {};
      for (const m of Object.keys(PMETH)) cov[m] = ps.map((p) => {
        let c = 0;
        for (let k = 0; k <= n; k++) {
          const [a, b] = ints[m][k];
          if (a <= p && p <= b) c += binomPmf(k, n, p);
        }
        return c;
      });
      return (cache[n] = { ps, ints, cov });
    }
    function draw() {
      const { ps, ints, cov } = coverage(s.n);
      p1.render([
        { type: 'hline', y: 0.95, color: 'ink2', dash: '6 4', width: 1.2 },
        ...Object.entries(PMETH).map(([m, M]) => ({ type: 'line', x: ps, y: cov[m].map((v) => Math.max(0.5, v)), color: M.color, width: m === 'wald' ? 1.6 : 2, label: M.label })),
      ]);
      const L = [];
      Object.keys(PMETH).forEach((m, j) => {
        const [a, b] = ints[m][s.k];
        L.push({ type: 'segments', x1: [a], x2: [Math.max(b, a + 0.002)], y1: [3 - j], y2: [3 - j], color: PMETH[m].color, width: 7, opacity: 0.85 });
        L.push({ type: 'text', items: [{ x: b, y: 3 - j, dx: 8, dy: 4, text: '[' + f3(a) + ', ' + f3(b) + ']', color: PMETH[m].color }] });
      });
      L.push({ type: 'vline', x: s.k / s.n, color: 'ink', width: 1.4, dash: '3 3' });
      p2.render(L);
      const mid = ps.map((p, i) => i).filter((i) => ps[i] >= 0.05 && ps[i] <= 0.95);
      for (const m of Object.keys(PMETH)) st.set(m, pct(mean(cov[m])) + ' / ' + pct(Math.min(...mid.map((i) => cov[m][i]))));
      const wd = ints.wald[s.k];
      note.innerHTML = 'Интервал Вальда — прямое применение нормального приближения — систематически накрывает реже 95 %, а у краёв (p около 0 или 1) проваливается совсем: при k = 0 он вырождается в точку [0, 0]' + (s.k === 0 ? ' — как сейчас' : '') + '. Уилсон получается обращением того же нормального критерия, но с SE при истинном p — и держится около 95 % даже при малых n. Клоппер — Пирсон гарантирует ≥ 95 % при любом p ценой лишней ширины. Пилообразность — следствие дискретности: k принимает лишь n + 1 значение. ' + (s.k === 0 ? 'При 0 успехах из ' + s.n + ' верхняя граница Уилсона ' + f3(ints.wilson[0][1]) + ', а «правило трёх» даёт 3/n = ' + f3(3 / s.n) + ' (односторонняя 95 %-я граница).' : 'Интервал Вальда сейчас [' + f3(wd[0]) + ', ' + f3(wd[1]) + '].');
    }
    w.pythonAction(() => PY_NP + PY_ST + '\nn, k = ' + s.n + ', ' + s.k + '\nz = stats.norm.ppf(0.975)\np_hat = k / n\nh = z * np.sqrt(p_hat * (1 - p_hat) / n)\nprint("Вальд:   ", np.clip([p_hat - h, p_hat + h], 0, 1).round(3))\nres = stats.binomtest(k, n)\nprint("Уилсон:  ", np.round(res.proportion_ci(method="wilson"), 3))\nprint("Клоппер — Пирсон:", np.round(res.proportion_ci(method="exact"), 3))\n\n# точное покрытие интервала Вальда при p = 0.1\np = 0.1\nks = np.arange(n + 1)\nph = ks / n\nhw = z * np.sqrt(ph * (1 - ph) / n)\ncover = ((ph - hw <= p) & (p <= ph + hw))\nprint("покрытие Вальда при p = 0.1:", round(stats.binom.pmf(ks, n, p)[cover].sum(), 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 16. Бутстрэп
   * ============================================================================== */
  const BOOT_STATS = {
    mean: { label: 'среднее', f: (a) => mean(a), truth: 10 },
    median: { label: 'медиана', f: (a) => median(a), truth: 10 * Math.LN2 },
    q90: { label: '90-й перцентиль', f: (a) => quantile(a, 0.9), truth: 10 * Math.log(10) },
    sd: { label: 'стандартное отклонение', f: (a) => sd(a), truth: 10 },
  };
  const BOOT_SAMPLE = (() => {
    const rng = new GBC.RNG(33);
    return U.range(40).map(() => expDraw(rng));
  })();
  GBC.widget('bootstrap', (el) => {
    const s = { stat: 'median', B: 2000, view: 1 };
    const w = ui.shell(el, { title: 'Бутстрэп: выборка из выборки', sub: 'У нас одна выборка из 40 времён ожидания. Бутстрэп вынимает из неё 40 значений с возвращением и пересчитывает статистику — B раз. Клетки — исходные 40 значений, число — сколько раз значение попало в текущую бутстрэп-выборку (пустые не попали).' });
    ui.select(w.controls, { label: 'Статистика', value: s.stat, options: Object.entries(BOOT_STATS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.stat = v), draw()) });
    ui.slider(w.controls, { label: 'Повторов B', values: [100, 300, 1000, 2000, 5000], value: s.B, format: String, onInput: (v) => ((s.B = v), draw()) });
    ui.button(w.controls, { label: 'Другая бутстрэп-выборка', onClick: () => (s.view++, draw()) });
    const tiles = H('div', { style: 'display:flex;flex-wrap:wrap;gap:3px;justify-content:center;margin:4px 0 8px' });
    w.main.appendChild(tiles);
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'значение статистики в бутстрэп-выборке' }, y: { label: 'доля повторов' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'по исходной выборке' }, { key: 'one', label: 'по показанной бутстрэп-выборке' }, { key: 'se', label: 'бутстрэп-SE' }, { key: 'ci', label: '95 % перцентильный интервал' }, { key: 'f', label: 'по формуле' }]);
    function draw() {
      const S0 = BOOT_STATS[s.stat];
      const x = BOOT_SAMPLE;
      const r1 = new GBC.RNG(4000 + s.view);
      const cnt = new Array(40).fill(0);
      for (const i of r1.bootstrap(40)) cnt[i]++;
      const one = [];
      cnt.forEach((c, i) => {
        for (let j = 0; j < c; j++) one.push(x[i]);
      });
      tiles.textContent = '';
      const order = U.argsort(x);
      for (const i of order) {
        const c = cnt[i];
        tiles.appendChild(H('span', { title: 'значение ' + f1(x[i]) + ' мин: попало ' + c + ' раз', style: 'display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:38px;height:34px;border-radius:6px;font-size:10px;line-height:1.1;' + (c ? 'background:rgba(' + GBC.colors.rgb('model').map(Math.round).join(',') + ',' + Math.min(0.95, 0.22 + 0.24 * c) + ');color:' + (c > 1 ? 'var(--surface)' : 'var(--ink)') : 'background:var(--surface-2);color:var(--muted);border:1px dashed var(--border-strong)') }, H('b', { style: 'font-size:12px' }, c ? '×' + c : '—'), f1(x[i])));
      }
      const r2 = new GBC.RNG(44);
      const boots = [];
      for (let b = 0; b < s.B; b++) boots.push(S0.f(r2.bootstrap(40).map((i) => x[i])));
      const lo = quantile(boots, 0.025);
      const hi = quantile(boots, 0.975);
      const [mn, mx] = U.extent(boots);
      const hb = hist(boots, mn, mx + 1e-9, 40);
      const est = S0.f(x);
      plot.render([
        { type: 'vband', x0: lo, x1: hi, color: 'model', opacity: 0.1 },
        { type: 'bars', x: hb.x, y: hb.share, color: 'model', width: hb.w * 0.95, maxPx: 30, opacity: 0.7 },
        { type: 'vline', x: est, color: 'ink', width: 1.8, text: 'по выборке' },
        { type: 'vline', x: S0.f(one), color: 'aqua', width: 1.6, dash: '3 3' },
        { type: 'vline', x: S0.truth, color: 'tree', dash: '6 4', width: 1.6, text: 'истина' },
      ]);
      let fText = '—';
      if (s.stat === 'mean') {
        const h = (tPpf(0.975, 39) * sd(x)) / Math.sqrt(40);
        fText = 't: [' + f2(est - h) + ', ' + f2(est + h) + ']';
      } else if (s.stat === 'sd') {
        const v = variance(x);
        fText = 'χ² (если нормальные): [' + f2(Math.sqrt((39 * v) / chi2Ppf(0.975, 39))) + ', ' + f2(Math.sqrt((39 * v) / chi2Ppf(0.025, 39))) + ']';
      }
      st.set('v', f2(est));
      st.set('one', f2(S0.f(one)));
      st.set('se', f3(sd(boots)));
      st.set('ci', '[' + f2(lo) + ', ' + f2(hi) + ']');
      st.set('f', fText);
      const oob = cnt.filter((c) => c === 0).length;
      note.innerHTML = 'В показанной бутстрэп-выборке ' + oob + ' из 40 значений не попали ни разу (в среднем ≈ 37 %, урок 15.13, шаг 34), а некоторые попали по 2–3 раза. Разброс статистики по ' + s.B + ' таким выборкам имитирует разброс по настоящим новым выборкам: бутстрэп-SE = ' + f3(sd(boots)) + ', а 2.5-й и 97.5-й перцентили дают 95 %-й интервал. ' + (s.stat === 'mean' ? 'Для среднего есть и формула — интервалы близки.' : s.stat === 'sd' ? 'Формула через χ² верна только для нормальных данных; у скошенных данных она слишком оптимистична, а бутстрэп этого не требует.' : 'Для медианы и перцентилей простой формулы нет — бутстрэп делает это так же легко, как для среднего.') + ' Гистограмма медианы «зубчатая»: медиана из 40 значений принимает лишь значения исходной выборки.';
    }
    w.pythonAction(() => {
      const fx = { mean: 'np.mean(v)', median: 'np.median(v)', q90: 'np.percentile(v, 90)', sd: 'np.std(v, ddof=1)' }[s.stat];
      return 'import math\n' + PY_NP + PY_RNG + '\nrng = Mulberry32(33)\nx = np.array([-10 * math.log(1 - rng.random()) for _ in range(40)])\nstat = lambda v: ' + fx + '\nr2 = Mulberry32(44)\nboots = np.array([stat(x[r2.bootstrap(40)]) for _ in range(' + s.B + ')])\nprint(f"по выборке {stat(x):.2f}; бутстрэп-SE {boots.std(ddof=1):.3f}; 95 % интервал {np.percentile(boots, [2.5, 97.5]).round(2)}")\n# то же в SciPy: stats.bootstrap((x,), stat, method="percentile")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 17. Когда бутстрэп ошибается
   * ============================================================================== */
  const BF = {
    mean: { label: 'среднее скошенных данных' },
    max: { label: 'граница распределения (максимум)' },
    ar: { label: 'среднее временного ряда (зависимые данные)' },
  };
  GBC.widget('bootstrap-fail', (el) => {
    const s = { sc: 'mean', n: 20, block: false };
    const w = ui.shell(el, { title: 'Бутстрэп — не волшебство: проверяем покрытие', sub: '400 раз генерируем данные с известным ответом, по каждому набору строим 95 %-й перцентильный бутстрэп-интервал (B = 400) и считаем, как часто он накрыл истину. Показаны первые 40 интервалов.' });
    ui.select(w.controls, { label: 'Задача', value: s.sc, options: Object.entries(BF).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.sc = v), sync(), draw()) });
    ui.slider(w.controls, { label: 'Размер выборки n', values: [10, 20, 50, 100], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const tg = ui.toggle(w.controls, { label: 'Блочный бутстрэп (блоки по 10)', checked: false, onChange: (v) => ((s.block = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 330, x: { label: 'интервал' }, y: { label: 'номер набора', domain: [0, 41], ticks: [1, 10, 20, 30, 40] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'покрытие (цель 95 %)' }, { key: 'w', label: 'средняя ширина' }, { key: 'se', label: 'истинный SE / бутстрэп-SE' }]);
    function sync() {
      tg.el.style.display = s.sc === 'ar' ? '' : 'none';
    }
    const cache = {};
    function run() {
      const key = s.sc + s.n + s.block;
      if (cache[key]) return cache[key];
      const rng = new GBC.RNG(700 + s.n + 31 * Object.keys(BF).indexOf(s.sc));
      const truth = s.sc === 'mean' ? 10 : s.sc === 'max' ? 1 : 0;
      const R = 400;
      const B = 400;
      const n = s.n;
      const ints = [];
      const ests = [];
      const bses = [];
      for (let r = 0; r < R; r++) {
        let x;
        if (s.sc === 'mean') x = U.range(n).map(() => expDraw(rng));
        else if (s.sc === 'max') x = U.range(n).map(() => rng.random());
        else {
          x = [];
          let v = rng.normal() / Math.sqrt(1 - 0.49);
          for (let i = 0; i < n; i++) {
            if (i) v = 0.7 * v + rng.normal();
            x.push(v);
          }
        }
        const stat = s.sc === 'max' ? (a) => Math.max(...a) : mean;
        const boots = [];
        for (let b = 0; b < B; b++) {
          let xb;
          if (s.sc === 'ar' && s.block) {
            xb = [];
            while (xb.length < n) {
              const st0 = rng.randint(n - 10 + 1);
              for (let j = 0; j < 10 && xb.length < n; j++) xb.push(x[st0 + j]);
            }
          } else {
            xb = new Array(n);
            for (let i = 0; i < n; i++) xb[i] = x[rng.randint(n)];
          }
          boots.push(stat(xb));
        }
        ints.push([quantile(boots, 0.025), quantile(boots, 0.975)]);
        ests.push(stat(x));
        bses.push(sd(boots));
      }
      return (cache[key] = { ints, ests, bses, truth });
    }
    function draw() {
      const { ints, ests, bses, truth } = run();
      const hit = ints.map(([a, b]) => a <= truth && truth <= b);
      const show = U.range(40);
      const ok = show.filter((i) => hit[i]);
      const bad = show.filter((i) => !hit[i]);
      const all = show.flatMap((i) => ints[i]).concat([truth]);
      plot.render([
        { type: 'segments', x1: ok.map((i) => ints[i][0]), x2: ok.map((i) => ints[i][1]), y1: ok.map((i) => i + 1), y2: ok.map((i) => i + 1), color: 'model', width: 2.2, opacity: 0.85 },
        { type: 'segments', x1: bad.map((i) => ints[i][0]), x2: bad.map((i) => Math.max(ints[i][1], ints[i][0] + 1e-3)), y1: bad.map((i) => i + 1), y2: bad.map((i) => i + 1), color: 'red', width: 2.8, opacity: 1 },
        { type: 'points', x: show.map((i) => ests[i]), y: show.map((i) => i + 1), color: 'ink', r: 2.4 },
        { type: 'vline', x: truth, color: 'tree', dash: '6 4', width: 1.6, text: 'истина' },
      ], { x: yDom(all, 0.05) });
      const cov = hit.filter(Boolean).length / hit.length;
      const trueSe = sd(ests);
      st.set('c', pct(cov));
      st.set('w', f3(U.mean(ints.map((q) => q[1] - q[0]))));
      st.set('se', f3(trueSe) + ' / ' + f3(mean(bses)));
      const N = {
        mean: 'Для среднего скошенных данных бутстрэп работает, ' + (cov < 0.92 ? 'но при малых n интервал узковат: покрытие ' + pct(cov) + ' при n = ' + s.n + '. Бутстрэп опирается на то, что выборка похожа на совокупность, а в ' + s.n + ' значениях длинный хвост ещё плохо представлен.' : 'покрытие ' + pct(cov) + ' при n = ' + s.n + ' близко к обещанному. При n = 10 оно заметно ниже: в маленькой выборке длинный хвост плохо представлен.'),
        max: 'Провал: истинная граница θ = 1 всегда больше выборочного максимума, а бутстрэп-максимум никогда не превышает выборочный. Перцентильный интервал не накрывает θ <b>никогда</b> (покрытие ' + pct(cov) + '). Бутстрэп ломается на статистиках, зависящих от крайних значений, и при «нерегулярных» параметрах, как граница носителя.',
        ar: s.block
          ? 'Блочный бутстрэп вынимает куски ряда по 10 подряд и сохраняет зависимость внутри блока: бутстрэп-SE ' + f3(mean(bses)) + ' ближе к истинному ' + f3(trueSe) + ', покрытие ' + pct(cov) + '. ' + (cov < 0.9 ? 'До 95 % ещё далеко: в ' + s.n + ' значениях помещается лишь ' + Math.floor(s.n / 10) + ' ' + plural(Math.floor(s.n / 10), 'блок', 'блока', 'блоков') + ', а связь между соседними блоками теряется. С ростом n блочный бутстрэп приближается к номиналу. ' : '') + 'Так оценивают неопределённость метрик на временных рядах.'
          : 'Соседние значения ряда связаны (корреляция 0.7), а обычный бутстрэп перемешивает их как независимые и сильно <b>занижает</b> разброс: бутстрэп-SE ' + f3(mean(bses)) + ' против истинного ' + f3(trueSe) + ', покрытие ' + pct(cov) + '. Включите блочный бутстрэп.',
      };
      note.innerHTML = N[s.sc];
    }
    w.pythonAction(() => 'import math\n' + PY_NP + PY_RNG + '\nn, R, B = ' + s.n + ', 400, 400\nrng = Mulberry32(' + (700 + s.n + 31 * Object.keys(BF).indexOf(s.sc)) + ')\ntruth = ' + (s.sc === 'mean' ? 10 : s.sc === 'max' ? 1 : 0) + '\nstat = ' + (s.sc === 'max' ? 'np.max' : 'np.mean') + '\nhits = 0\nfor _ in range(R):\n' + (s.sc === 'mean' ? '    x = np.array([-10 * math.log(1 - rng.random()) for _ in range(n)])\n' : s.sc === 'max' ? '    x = np.array([rng.random() for _ in range(n)])\n' : '    v = rng.normal() / math.sqrt(1 - 0.49)\n    x = [v]\n    for i in range(1, n):\n        v = 0.7 * v + rng.normal()\n        x.append(v)\n    x = np.array(x)\n') + '    boots = []\n    for _ in range(B):\n' + (s.sc === 'ar' && s.block ? '        xb = []\n        while len(xb) < n:\n            s0 = rng.randint(n - 10 + 1)\n            xb.extend(x[s0:s0 + 10][: n - len(xb)])\n        boots.append(stat(np.array(xb)))\n' : '        boots.append(stat(x[[rng.randint(n) for _ in range(n)]]))\n') + '    lo, hi = np.quantile(boots, [0.025, 0.975])\n    hits += lo <= truth <= hi\nprint(f"покрытие перцентильного бутстрэп-интервала: {hits / R:.1%} (цель 95 %)")\n');
    sync();
    draw();
  });

  /* ==============================================================================
   * Экспорт помощников для lesson_extra.js
   * ============================================================================== */
  GBC.lesson1514 = {
    f1, f2, f3, f4, py, sci, pf, pct, plural, yDom,
    lgamma, ibeta, gammaQ, normPdf, normCdf, normSf, normPpf, tPdf, tCdf, tP2, tPpf, chi2Pdf, chi2Sf, chi2Cdf, chi2Ppf, betaPdf, betaPpf, binomPmf, binomPmfAll, binomCdf, kolmogorovSf,
    mean, variance, sd, median, quantile, trimmedMean, mad, skewness, ranks, pearson, spearman, hist, ecdfLine,
    expDraw, laplaceDraw, contamDraw, cauchyDraw, t3Draw, poissonDraw,
    texInto, texEl, card, cardGrid, badge, rowTable, onTheme, svgHost, C, S,
    PY_NP, PY_RNG, PY_ST, propCI,
  };
})();
