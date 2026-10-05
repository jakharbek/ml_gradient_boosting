/* Урок 15.13: теория вероятностей. Часть 2 — непрерывные величины, несколько величин, предельные
 * теоремы, цепи Маркова и вероятность в машинном обучении.
 * Виджеты: плотность, функция распределения и квантили; пуассоновский поток и парадокс ожидания;
 * нормальное распределение; метод обратной функции; совместное распределение; условное среднее и
 * разложение дисперсии; корреляция; свёртка; закон больших чисел и тяжёлые хвосты; ЦПТ; цепь Маркова;
 * калибровка; правдоподобие и log-loss; модель шума и функция потерь; смещение и разброс деревьев,
 * бэггинга и бустинга; дисперсия среднего коррелированных моделей; бутстрэп и out-of-bag; тренажёр.
 * Помощники — из GBC.lesson1513 (lesson.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const L0 = GBC.lesson1513;
  const { f1, f2, f3, f4, py, sci, pf, pct, frac, plural, yDom, binomPmf, poisPmf, normPdf, normCdf, normPpf, moments, texInto, texEl, card, cardGrid, badge, rowTable, onTheme, eqBox, C, LF } = L0;
  const R = String.raw;
  const PY_NP = 'import numpy as np\n\n';
  const PY_RNG = 'from gbcourse.rng import Mulberry32\n';
  const sigm = (z) => 1 / (1 + Math.exp(-z));
  /** Гистограмма: значения → плотность на равных корзинах. */
  function histDensity(vals, lo, hi, bins) {
    const w = (hi - lo) / bins;
    const c = new Array(bins).fill(0);
    let inside = 0;
    for (const v of vals) {
      const j = Math.floor((v - lo) / w);
      if (j >= 0 && j < bins) (c[j]++, inside++);
    }
    return { x: c.map((_, j) => lo + (j + 0.5) * w), y: c.map((v) => v / (vals.length * w)), w, counts: c, inside };
  }
  function skewness(vals) {
    const m = U.mean(vals);
    const v = U.mean(vals.map((x) => (x - m) ** 2));
    return v > 0 ? U.mean(vals.map((x) => (x - m) ** 3)) / Math.pow(v, 1.5) : 0;
  }

  /* ==============================================================================
   * Шаг 19. Плотность, функция распределения, квантили
   * ============================================================================== */
  const CONT = {
    uniform: { name: 'равномерное на [0, 10]', pdf: (x) => (x >= 0 && x <= 10 ? 0.1 : 0), cdf: (x) => U.clamp(x / 10, 0, 1), mean: 5, py: 'stats.uniform(0, 10)' },
    exp: { name: 'экспоненциальное, λ = 0.5', pdf: (x) => (x >= 0 ? 0.5 * Math.exp(-0.5 * x) : 0), cdf: (x) => (x >= 0 ? 1 - Math.exp(-0.5 * x) : 0), mean: 2, py: 'stats.expon(scale=2)' },
    normal: { name: 'нормальное N(5, 1.5²)', pdf: (x) => normPdf(x, 5, 1.5), cdf: (x) => normCdf(x, 5, 1.5), mean: 5, py: 'stats.norm(5, 1.5)' },
    bimodal: { name: 'смесь: две горки', pdf: (x) => 0.5 * normPdf(x, 3, 0.8) + 0.5 * normPdf(x, 7.5, 1.2), cdf: (x) => 0.5 * normCdf(x, 3, 0.8) + 0.5 * normCdf(x, 7.5, 1.2), mean: 5.25, py: null },
  };
  function ppf(D, t) {
    let lo = -5;
    let hi = 40;
    for (let i = 0; i < 70; i++) {
      const m = (lo + hi) / 2;
      if (D.cdf(m) < t) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }
  GBC.widget('density-cdf', (el) => {
    const s = { d: 'exp', a: 1, b: 3, tau: 0.5, sample: false, N: 500, bins: 24, seed: 1 };
    const w = ui.shell(el, { title: 'Плотность и функция распределения', sub: 'Вверху — плотность p(x): вероятность интервала [a, b] — закрашенная площадь. Внизу — функция распределения F(x): та же вероятность — разность высот F(b) − F(a). Квантиль q(τ) — точка, где F = τ. Границы a и b можно тянуть.' });
    ui.select(w.controls, { label: 'Распределение', value: s.d, options: Object.entries(CONT).map(([k, v]) => ({ value: k, label: v.name })), onChange: (v) => ((s.d = v), draw()) });
    const sa = ui.slider(w.controls, { label: 'a', min: -1, max: 12, step: 0.1, value: s.a, format: f1, onInput: (v) => ((s.a = Math.min(v, s.b)), draw()) });
    const sb = ui.slider(w.controls, { label: 'b', min: -1, max: 12, step: 0.1, value: s.b, format: f1, onInput: (v) => ((s.b = Math.max(v, s.a)), draw()) });
    ui.slider(w.controls, { label: 'Уровень квантиля τ', min: 0.01, max: 0.99, step: 0.01, value: s.tau, format: f2, onInput: (v) => ((s.tau = v), draw()) });
    ui.toggle(w.controls, { label: 'Выборка и гистограмма', checked: s.sample, onChange: (v) => ((s.sample = v), draw()) });
    ui.slider(w.controls, { label: 'Размер выборки', values: [50, 100, 200, 500, 1000, 2000, 5000, 20000], value: s.N, format: String, onInput: (v) => ((s.N = v), draw()) });
    ui.slider(w.controls, { label: 'Столбиков', min: 6, max: 80, step: 2, value: s.bins, format: String, onInput: (v) => ((s.bins = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'x', domain: [-1, 12] }, y: { label: 'плотность p(x)' } });
    const plot2 = new GBC.Plot(w.main, { height: 200, x: { label: 'x', domain: [-1, 12] }, y: { label: 'F(x) = P(X ≤ x)', domain: [0, 1.04] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'P(a ≤ X ≤ b) = F(b) − F(a)' }, { key: 'q', label: 'квантиль q(τ)' }, { key: 'm', label: 'медиана / среднее' }, { key: 'h', label: 'доля выборки в [a, b]' }]);
    function draw() {
      const D = CONT[s.d];
      const xs = U.linspace(-1, 12, 400);
      const ys = xs.map(D.pdf);
      const a = s.a;
      const b = s.b;
      const sh = U.linspace(a, b, 120);
      const q = ppf(D, s.tau);
      const med = ppf(D, 0.5);
      const pab = D.cdf(b) - D.cdf(a);
      const L = [];
      let frac0 = null;
      if (s.sample) {
        const rng = new GBC.RNG(s.seed);
        const vals = U.range(s.N).map(() => ppf(D, rng.random()));
        const hd = histDensity(vals, -1, 12, s.bins);
        L.push({ type: 'bars', x: hd.x, y: hd.y, color: 'data', width: hd.w, maxPx: 400, opacity: 0.45, label: 'гистограмма выборки' });
        frac0 = vals.filter((v) => v >= a && v <= b).length / s.N;
      }
      L.push({ type: 'area', x: sh, y0: sh.map(() => 0), y1: sh.map(D.pdf), color: 'model', opacity: 0.3, label: 'P(a ≤ X ≤ b)' });
      L.push({ type: 'line', x: xs, y: ys, color: 'model', width: 2.2, label: 'p(x)' });
      L.push({ type: 'vline', x: q, color: 'tree', dash: '5 4', width: 1.6, label: 'квантиль q(τ)' });
      L.push({ type: 'vline', x: a, color: 'ink2', width: 1.2, draggable: true, onDrag: (x) => ((s.a = U.clamp(Math.round(x * 10) / 10, -1, s.b)), sa.set(s.a), draw()) });
      L.push({ type: 'vline', x: b, color: 'ink2', width: 1.2, draggable: true, onDrag: (x) => ((s.b = U.clamp(Math.round(x * 10) / 10, s.a, 12)), sb.set(s.b), draw()) });
      const ymax = Math.max(...ys) * 1.25;
      plot.render(L, { y: [0, ymax] });
      const Fa = D.cdf(a);
      const Fb = D.cdf(b);
      plot2.render([
        { type: 'line', x: xs, y: xs.map(D.cdf), color: 'model', width: 2.2, label: 'F(x)' },
        { type: 'segments', x1: [-1, -1], y1: [Fa, Fb], x2: [a, b], y2: [Fa, Fb], color: 'ink2', width: 1, dash: '3 3', opacity: 1 },
        { type: 'arrows', x1: [-0.5], y1: [Fa], x2: [-0.5], y2: [Fb], color: 'model', width: 2.4 },
        { type: 'segments', x1: [-1, q], y1: [s.tau, s.tau], x2: [q, q], y2: [s.tau, 0], color: 'tree', width: 1.5, dash: '5 4', opacity: 1 },
        { type: 'points', x: [a, b, q], y: [Fa, Fb, s.tau], color: (i) => (i === 2 ? 'tree' : 'model'), r: 5 },
      ]);
      st.set('p', f4(Fb) + ' − ' + f4(Fa) + ' = ' + f4(pab));
      st.set('q', 'q(' + f2(s.tau) + ') = ' + f3(q));
      st.set('m', f3(med) + ' / ' + f3(D.mean));
      st.set('h', frac0 === null ? '—' : f4(frac0));
      const extra = s.d === 'exp' ? ' Длинный правый хвост: медиана ln 2/λ = 1.386 меньше среднего 2; P(X > 3) = e<sup>−1.5</sup> ≈ 0.223.' : s.d === 'bimodal' ? ' У смеси двух горок среднее 5.25 попадает в «провал», где значений мало: среднее — не всегда «типичное» значение.' : s.d === 'uniform' ? ' Вероятность пропорциональна длине: P(a ≤ X ≤ b) = (b − a)/10 внутри [0, 10].' : ' Колокол симметричен: медиана совпадает со средним.';
      note.innerHTML = D.name + ': P(' + f1(a) + ' ≤ X ≤ ' + f1(b) + ') = ' + f4(pab) + ' — площадь под плотностью и прирост F. Плотность в точке — не вероятность (P(X = x) = 0), а «вероятность на единицу длины». Квантиль уровня ' + f2(s.tau) + ': левее ' + f3(q) + ' лежит доля ' + f2(s.tau) + ' вероятности.' + extra +
        (frac0 !== null ? ' Доля выборки в [a, b] — ' + f4(frac0) + '; нормированная гистограмма (площадь 1) при росте выборки приближается к плотности.' : '');
    }
    w.pythonAction(() => {
      const D = CONT[s.d];
      if (s.d === 'bimodal') return 'from scipy import stats\n\n# смесь двух нормальных: F(x) = 0.5·Φ((x − 3)/0.8) + 0.5·Φ((x − 7.5)/1.2)\nF = lambda x: 0.5 * stats.norm.cdf(x, 3, 0.8) + 0.5 * stats.norm.cdf(x, 7.5, 1.2)\na, b = ' + py(s.a) + ', ' + py(s.b) + '\nprint("P(a ≤ X ≤ b) =", round(F(b) - F(a), 4))\nfrom scipy.optimize import brentq\nprint("медиана:", round(brentq(lambda x: F(x) - 0.5, -5, 20), 4), " квантиль τ = ' + py(s.tau) + ':", round(brentq(lambda x: F(x) - ' + py(s.tau) + ', -5, 20), 4))\n';
      return 'from scipy import stats\n\nX = ' + D.py + '      # ' + D.name + '\na, b, tau = ' + py(s.a) + ', ' + py(s.b) + ', ' + py(s.tau) + '\nprint("P(a ≤ X ≤ b) = F(b) − F(a) =", round(X.cdf(b) - X.cdf(a), 4))\nprint("квантиль q_τ =", round(X.ppf(tau), 4), " медиана =", round(X.median(), 4), " среднее =", X.mean())\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 20. Пуассоновский поток и парадокс ожидания
   * ============================================================================== */
  GBC.widget('poisson-process', (el) => {
    const s = { lam: 0.1, mode: 'poisson', seed: 1 };
    const T = 20000;
    const w = ui.shell(el, { title: 'Автобусы: случайный поток и расписание', sub: 'Вверху — первые 120 минут: штрихи — автобусы, точки — пассажиры, пришедшие в случайные моменты, стрелки — их ожидание. Внизу — распределение интервалов между автобусами. Статистика посчитана по 20 000 минутам и 5000 пассажиров.' });
    ui.slider(w.controls, { label: 'Автобусов в минуту λ', values: [0.05, 0.1, 0.2, 0.25, 0.5], value: s.lam, format: (v) => f2(v) + ' (раз в ' + f1(1 / v) + ' мин)', onInput: (v) => ((s.lam = v), draw()) });
    ui.segmented(w.controls, { label: 'Режим', value: s.mode, options: [{ value: 'poisson', label: 'случайный поток' }, { value: 'sched', label: 'по расписанию' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.button(w.controls, { label: 'Новая симуляция', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 150, x: { label: 'время, мин', domain: [0, 120] }, y: { label: '', domain: [0, 1], ticks: [] }, grid: 'x' });
    const plot2 = new GBC.Plot(w.main, { height: 230, x: { label: 'интервал между автобусами, мин' }, y: { label: 'плотность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'средний интервал' }, { key: 'wt', label: 'среднее ожидание пассажира' }, { key: 'c', label: 'средний интервал, «пойманный» пассажиром' }, { key: 'p', label: 'P(ждать > 1/λ)' }]);
    function draw() {
      const rng = new GBC.RNG(s.seed);
      const lam = s.lam;
      const ev = [];
      let t = s.mode === 'poisson' ? -Math.log(1 - rng.random()) / lam : rng.random() / lam;
      while (t < T + 200) {
        ev.push(t);
        t += s.mode === 'poisson' ? -Math.log(1 - rng.random()) / lam : 1 / lam;
      }
      const gaps = ev.slice(1).map((v, i) => v - ev[i]);
      const M = 5000;
      const waits = [];
      const caught = [];
      let j = 0;
      const pas = U.range(M).map(() => rng.uniform(0, T)).sort((a, b) => a - b);
      for (const p of pas) {
        while (j < ev.length && ev[j] < p) j++;
        if (j >= ev.length || j === 0) continue;
        waits.push(ev[j] - p);
        caught.push(ev[j] - ev[j - 1]);
      }
      const show = ev.filter((v) => v <= 120);
      const ps = pas.filter((v) => v <= 120).slice(0, 14);
      const nxt = ps.map((p) => ev.find((v) => v >= p));
      plot.render([
        { type: 'segments', x1: show, y1: show.map(() => 0.1), x2: show, y2: show.map(() => 0.9), color: 'model', width: 2.6, opacity: 1 },
        { type: 'arrows', x1: ps, y1: ps.map((_, i) => 0.3 + 0.4 * ((i % 4) / 3)), x2: nxt, y2: ps.map((_, i) => 0.3 + 0.4 * ((i % 4) / 3)), color: 'tree', width: 1.4, opacity: 0.8 },
        { type: 'points', x: ps, y: ps.map((_, i) => 0.3 + 0.4 * ((i % 4) / 3)), color: 'tree', r: 3.5 },
      ]);
      const gmax = Math.max(4 / lam, 1.2 / lam);
      const L = [];
      if (s.mode === 'poisson') {
        const hd = histDensity(gaps, 0, 5 / lam, 30);
        L.push({ type: 'bars', x: hd.x, y: hd.y, color: 'data', width: hd.w, maxPx: 400, opacity: 0.5, label: 'интервалы в симуляции' });
        const xx = U.linspace(0, 5 / lam, 200);
        L.push({ type: 'line', x: xx, y: xx.map((x) => lam * Math.exp(-lam * x)), color: 'model', width: 2.2, label: 'λe^{−λx}' });
      } else {
        L.push({ type: 'vline', x: 1 / lam, color: 'model', width: 2.6, label: 'все интервалы = 1/λ' });
      }
      L.push({ type: 'vline', x: U.mean(caught), color: 'tree', dash: '5 4', width: 1.8, label: 'интервал, пойманный пассажиром' });
      plot2.render(L, { x: [0, Math.max(gmax, 5 / lam) * (s.mode === 'poisson' ? 1 : 0.5)] });
      const mw = U.mean(waits);
      st.set('g', f2(U.mean(gaps)) + ' мин');
      st.set('wt', f2(mw) + ' мин');
      st.set('c', f2(U.mean(caught)) + ' мин');
      st.set('p', f3(waits.filter((v) => v > 1 / lam).length / waits.length));
      note.innerHTML = s.mode === 'poisson'
        ? 'Интервалы экспоненциальные со средним 1/λ = ' + f1(1 / lam) + ' мин. Пассажир ждёт в среднем ' + f2(mw) + ' мин — <b>столько же</b>, сколько длится средний интервал, а не половину: у экспоненциального нет памяти. Интервал, в который попал пассажир, в среднем ' + f2(U.mean(caught)) + ' мин ≈ 2/λ — длинные интервалы «ловят» случайный момент чаще коротких. Доля ждущих дольше 1/λ ≈ e<sup>−1</sup> = 0.368.'
        : 'Автобусы строго раз в ' + f1(1 / lam) + ' мин: пассажир ждёт в среднем половину интервала, ' + f2(mw) + ' мин, и никогда больше ' + f1(1 / lam) + '. Случайность потока при том же среднем интервале удваивает среднее ожидание.';
    }
    w.pythonAction(() => PY_RNG + 'import math\nimport numpy as np\n\nlam, T, mode = ' + py(s.lam) + ', ' + T + ', "' + s.mode + '"\nrng = Mulberry32(' + s.seed + ')\nev = []\nt = -math.log(1 - rng.random()) / lam if mode == "poisson" else rng.random() / lam\nwhile t < T + 200:\n    ev.append(t)\n    t += -math.log(1 - rng.random()) / lam if mode == "poisson" else 1 / lam\nev = np.array(ev)\npas = np.sort([rng.uniform(0, T) for _ in range(5000)])\nj = np.searchsorted(ev, pas)\nok = (j > 0) & (j < len(ev))\nwait, caught = ev[j[ok]] - pas[ok], ev[j[ok]] - ev[j[ok] - 1]\nprint(f"средний интервал {np.diff(ev).mean():.2f}, ожидание {wait.mean():.2f}, пойманный интервал {caught.mean():.2f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 21. Нормальное распределение
   * ============================================================================== */
  GBC.widget('normal', (el) => {
    const s = { mu: 170, sd: 8, mode: 'ab', a: 160, b: 180, k: 1 };
    const w = ui.shell(el, { title: 'Нормальное распределение N(μ, σ²)', sub: 'Рост в сантиметрах. Меняйте μ и σ: колокол сдвигается и растягивается, площадь остаётся 1. Вероятность интервала — закрашенная площадь; внизу каждой границы — её z-оценка (z − сколько σ от среднего).' });
    ui.slider(w.controls, { label: 'Среднее μ', min: 150, max: 190, step: 1, value: s.mu, format: String, onInput: (v) => ((s.mu = v), draw()) });
    ui.slider(w.controls, { label: 'Стандартное отклонение σ', min: 2, max: 16, step: 0.5, value: s.sd, format: f1, onInput: (v) => ((s.sd = v), draw()) });
    ui.segmented(w.controls, { label: 'Интервал', value: s.mode, options: [{ value: 'ab', label: '[a, b]' }, { value: 'k', label: 'μ ± kσ' }, { value: 'gt', label: 'X > b' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'a', min: 120, max: 220, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'b', min: 120, max: 220, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.slider(w.controls, { label: 'k', min: 0.25, max: 3.5, step: 0.05, value: s.k, format: f2, onInput: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'рост, см', domain: [120, 220] }, y: { label: 'плотность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ab', label: 'границы' }, { key: 'z', label: 'z-оценки' }, { key: 'p', label: 'вероятность' }, { key: 'r', label: '68–95–99.7' }]);
    function draw() {
      const { mu, sd } = s;
      let a;
      let b;
      if (s.mode === 'k') (a = mu - s.k * sd), (b = mu + s.k * sd);
      else if (s.mode === 'gt') (a = s.b), (b = 260);
      else (a = Math.min(s.a, s.b)), (b = Math.max(s.a, s.b));
      const xs = U.linspace(120, 220, 400);
      const sh = U.linspace(Math.max(120, a), Math.min(220, b), 150);
      const p = normCdf(b, mu, sd) - normCdf(a, mu, sd);
      const za = (a - mu) / sd;
      const zb = (b - mu) / sd;
      const top = normPdf(mu, mu, sd) * 1.22;
      const ticks = [-3, -2, -1, 0, 1, 2, 3].map((k) => mu + k * sd).filter((x) => x > 121 && x < 219);
      plot.render([
        { type: 'area', x: sh, y0: sh.map(() => 0), y1: sh.map((x) => normPdf(x, mu, sd)), color: 'model', opacity: 0.3, label: 'P = ' + f4(p) },
        { type: 'line', x: xs, y: xs.map((x) => normPdf(x, mu, sd)), color: 'model', width: 2.2, label: 'N(' + mu + ', ' + f1(sd) + '²)' },
        { type: 'segments', x1: ticks, y1: ticks.map(() => 0), x2: ticks, y2: ticks.map((x) => normPdf(x, mu, sd)), color: 'muted', width: 1, dash: '2 3', opacity: 1 },
        { type: 'text', items: ticks.map((x) => ({ x, y: top * 0.04, text: (x === mu ? 'μ' : U.fmtSigned((x - mu) / sd, 0).replace('.00', '') + 'σ'), anchor: 'middle', color: 'muted' })) },
        { type: 'points', x: [mu - sd, mu + sd], y: [normPdf(mu - sd, mu, sd), normPdf(mu + sd, mu, sd)], color: 'tree', r: 4.5, label: 'перегибы μ ± σ' },
      ], { y: [0, top] });
      st.set('ab', s.mode === 'gt' ? 'X > ' + f1(a) : f1(a) + ' … ' + f1(b));
      st.set('z', s.mode === 'gt' ? 'z > ' + f2(za) : f2(za) + ' … ' + f2(zb));
      st.set('p', f4(p));
      st.set('r', [1, 2, 3].map((k) => f3(normCdf(k) - normCdf(-k))).join(' / '));
      note.innerHTML = 'Стандартизация z = (x − μ)/σ превращает любой интервал в интервал для N(0, 1): P = Φ(' + f2(zb) + ') − Φ(' + f2(za) + ') = <b>' + f4(p) + '</b>. ' +
        (s.mode === 'gt' ? 'Выше ' + f1(a) + ' см — примерно каждый ' + (p > 0 ? Math.round(1 / p) : '∞') + '-й. ' : '') +
        'Перегибы колокола — ровно в μ ± σ (оранжевые точки). При μ = 170, σ = 8: выше 186 см — P(Z > 2) ≈ 0.023; от 160 до 180 — ≈ 0.789.';
    }
    w.pythonAction(() => 'from scipy import stats\n\nX = stats.norm(' + s.mu + ', ' + py(s.sd) + ')\n' + (s.mode === 'k' ? 'k = ' + py(s.k) + '\nprint("P(μ − kσ < X < μ + kσ) =", round(stats.norm.cdf(k) - stats.norm.cdf(-k), 4))\n' : s.mode === 'gt' ? 'b = ' + s.b + '\nprint("z =", (b - X.mean()) / X.std(), " P(X > b) =", round(X.sf(b), 4))\n' : 'a, b = ' + Math.min(s.a, s.b) + ', ' + Math.max(s.a, s.b) + '\nprint("z:", (a - X.mean()) / X.std(), (b - X.mean()) / X.std(), " P(a < X < b) =", round(X.cdf(b) - X.cdf(a), 4))\n') + 'for k in (1, 2, 3):\n    print(f"P(|Z| < {k}) = {stats.norm.cdf(k) - stats.norm.cdf(-k):.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 22. Метод обратной функции
   * ============================================================================== */
  const INV = {
    exp: { name: 'экспоненциальное, λ = 1', F: (x) => (x <= 0 ? 0 : 1 - Math.exp(-x)), Finv: (u) => -Math.log(1 - u), pdf: (x) => (x < 0 ? 0 : Math.exp(-x)), lo: 0, hi: 6, mean: 1, py: '-math.log(1 - u)' },
    sq: { name: 'квадрат равномерного: U²', F: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.sqrt(x)), Finv: (u) => u * u, pdf: (x) => (x <= 0 || x > 1 ? 0 : 0.5 / Math.sqrt(Math.max(x, 1e-4))), lo: 0, hi: 1, mean: 1 / 3, py: 'u ** 2' },
    normal: { name: 'нормальное N(0, 1) через Φ⁻¹', F: (x) => normCdf(x), Finv: (u) => normPpf(u), pdf: (x) => normPdf(x), lo: -4, hi: 4, mean: 0, py: 'stats.norm.ppf(u)' },
    die: { name: 'кубик: ⌊6U⌋ + 1', disc: [1, 2, 3, 4, 5, 6], w: [1, 1, 1, 1, 1, 1], lo: 0.5, hi: 6.5, mean: 3.5 },
    loaded: { name: 'нечестный кубик (шестёрка ×3)', disc: [1, 2, 3, 4, 5, 6], w: [1, 1, 1, 1, 1, 3], lo: 0.5, hi: 6.5, mean: 34 / 8 },
  };
  GBC.widget('inverse-transform', (el) => {
    const s = { d: 'exp', k: 12, seed: 42 };
    const sizes = (k) => Math.round(Math.pow(10, 0.5 + k / 10));
    const w = ui.shell(el, { title: 'Метод обратной функции: из равномерного — любое', sub: 'Генератор выдаёт равномерное u ∈ [0, 1) (на вертикальной оси). Идём горизонтально до графика функции распределения F и опускаемся на ось x: x = F⁻¹(u). Стрелки — первые пять чисел генератора; гистограмма внизу собирается из всех чисел и повторяет нужную плотность.' });
    ui.select(w.controls, { label: 'Целевое распределение', value: s.d, options: Object.entries(INV).map(([k, v]) => ({ value: k, label: v.name })), onChange: (v) => ((s.d = v), draw()) });
    ui.player(w.controls, { label: 'Чисел', min: 1, max: 40, value: s.k, fps: 5, format: (k) => sizes(k) + ' чисел', onChange: (k) => ((s.k = k), draw()) });
    ui.slider(w.controls, { label: 'Зерно генератора', min: 1, max: 100, step: 1, value: s.seed, format: String, onInput: (v) => ((s.seed = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: 'u = F(x)', domain: [0, 1.02] } });
    const plot2 = new GBC.Plot(w.main, { height: 200, x: { label: 'x' }, y: { label: 'плотность / вероятность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'u', label: 'первое u → x' }, { key: 'n', label: 'чисел' }, { key: 'm', label: 'среднее: выборка / теория' }]);
    function draw() {
      const D = INV[s.d];
      const N = sizes(s.k);
      const rng = new GBC.RNG(s.seed);
      const us = U.range(N).map(() => rng.random());
      let Finv;
      let F;
      if (D.disc) {
        const tot = U.sum(D.w);
        const cum = [];
        D.w.reduce((a, v, i) => ((cum[i] = (a + v) / tot), a + v), 0);
        Finv = (u) => D.disc[cum.findIndex((c) => u < c + 1e-15)];
        F = (x) => {
          let acc = 0;
          D.disc.forEach((v, i) => (v <= x ? (acc = cum[i]) : 0));
          return acc;
        };
      } else (Finv = D.Finv), (F = D.F);
      const xsamp = us.map(Finv);
      const L = [];
      if (D.disc) {
        const segs = [{ x0: D.lo, x1: 1, value: 0 }];
        D.disc.forEach((v, i) => segs.push({ x0: v, x1: i + 1 < D.disc.length ? D.disc[i + 1] : D.hi, value: F(v) }));
        L.push({ type: 'steps', segments: segs, color: 'model', width: 2.2, label: 'F(x)' });
      } else {
        const xx = U.linspace(D.lo, D.hi, 300);
        L.push({ type: 'line', x: xx, y: xx.map(F), color: 'model', width: 2.2, label: 'F(x)' });
      }
      const k5 = Math.min(5, N);
      for (let i = 0; i < k5; i++) {
        const x = U.clamp(xsamp[i], D.lo, D.hi);
        L.push({ type: 'segments', x1: [D.lo], y1: [us[i]], x2: [x], y2: [us[i]], color: 'tree', width: 1.4, dash: '4 3', opacity: 0.9 });
        L.push({ type: 'arrows', x1: [x], y1: [us[i]], x2: [x], y2: [0.01], color: 'tree', width: 1.4, opacity: 0.9 });
      }
      L.push({ type: 'points', x: us.slice(0, k5).map(() => D.lo), y: us.slice(0, k5), color: 'tree', r: 4 });
      plot.render(L, { x: [D.lo, D.hi] });
      if (D.disc) {
        const tot = U.sum(D.w);
        const cnt = D.disc.map((v) => xsamp.filter((x) => x === v).length / N);
        plot2.render([
          { type: 'bars', x: D.disc, y: cnt, color: 'data', width: 0.7, opacity: 0.6, label: 'доля в выборке' },
          { type: 'points', x: D.disc, y: D.w.map((v) => v / tot), color: 'model', r: 5, label: 'вероятность' },
        ], { x: [D.lo, D.hi] });
      } else {
        const hd = histDensity(xsamp, D.lo, D.hi, 30);
        const xx = U.linspace(D.lo + 1e-3, D.hi, 300);
        plot2.render([
          { type: 'bars', x: hd.x, y: hd.y, color: 'data', width: hd.w, maxPx: 400, opacity: 0.55, label: 'гистограмма' },
          { type: 'line', x: xx, y: xx.map(D.pdf), color: 'model', width: 2.2, label: 'плотность' },
        ], { x: [D.lo, D.hi], y: [0, Math.min(3.2, Math.max(...hd.y, ...xx.map(D.pdf)) * 1.15)] });
      }
      st.set('u', f4(us[0]) + ' → ' + f3(xsamp[0]));
      st.set('n', String(N));
      st.set('m', f3(U.mean(xsamp)) + ' / ' + f3(D.mean));
      note.innerHTML = 'Первое число генератора с зерном ' + s.seed + ': u = ' + f4(us[0]) + ' → x = F⁻¹(u) = ' + f3(xsamp[0]) + '. ' +
        (s.d === 'exp' ? 'Для экспоненциального F⁻¹(u) = −ln(1 − u): u близкие к 1 дают большие x — так получается длинный хвост.' : s.d === 'sq' ? 'U² не равномерна: F(x) = √x, значения скапливаются у нуля (плотность 1/(2√x)).' : s.d === 'normal' ? 'Φ⁻¹ считается численно; генератор курса для нормальных чисел использует более быстрый способ Бокса — Мюллера.' : 'Дискретный случай: отрезок [0, 1) делится на части длиной в вероятности граней; F — лестница, и горизонтальная линия попадает на одну из ступенек.');
    }
    w.pythonAction(() => {
      const D = INV[s.d];
      const N = sizes(s.k);
      if (D.disc) return PY_RNG + 'import numpy as np\n\nrng = Mulberry32(' + s.seed + ')\nfaces = np.arange(1, 7)\nw = np.array([' + D.w.join(', ') + '], dtype=float)\ncum = np.cumsum(w / w.sum())\nx = np.array([faces[np.searchsorted(cum, rng.random(), side="right")] for _ in range(' + N + ')])\nprint("доли граней:", np.bincount(x, minlength=7)[1:] / len(x))\nprint("среднее:", x.mean(), " теория:", (faces * w).sum() / w.sum())\n';
      return PY_RNG + 'import math\nimport numpy as np\nfrom scipy import stats\n\nrng = Mulberry32(' + s.seed + ')\nu = np.array([rng.random() for _ in range(' + N + ')])\nx = ' + (s.d === 'exp' ? '-np.log(1 - u)' : s.d === 'sq' ? 'u ** 2' : 'stats.norm.ppf(u)') + '\nprint("первое u =", round(u[0], 6), "→ x =", round(x[0], 4))\nprint("среднее выборки:", round(x.mean(), 4), " теория:", ' + py(D.mean) + ')\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 23. Совместное распределение
   * ============================================================================== */
  function jointOf(kind, s) {
    if (kind === 'rain') {
      const pr = s.pr;
      return { xs: ['дождь', 'сухо'], ys: ['зонт', 'без зонта'], xn: 'погода', yn: 'зонт', P: [[pr * s.pu1, pr * (1 - s.pu1)], [(1 - pr) * s.pu0, (1 - pr) * (1 - s.pu0)]] };
    }
    if (kind === 'sum') {
      const P = U.range(6).map((a) => U.range(11).map((k) => (k + 2 - (a + 1) >= 1 && k + 2 - (a + 1) <= 6 ? 1 / 36 : 0)));
      return { xs: U.range(6, 1).map(String), ys: U.range(11, 2).map(String), xn: 'первый кубик X', yn: 'сумма S', P };
    }
    if (kind === 'maxmin') {
      const P = U.range(6).map((i) => U.range(6).map((j) => (i === j ? 1 / 36 : j < i ? 2 / 36 : 0)));
      return { xs: U.range(6, 1).map(String), ys: U.range(6, 1).map(String), xn: 'максимум', yn: 'минимум', P };
    }
    const P = U.range(6).map(() => U.range(6).map(() => 1 / 36));
    return { xs: U.range(6, 1).map(String), ys: U.range(6, 1).map(String), xn: 'первый кубик', yn: 'второй кубик', P };
  }
  GBC.widget('joint-table', (el) => {
    const s = { kind: 'rain', pr: 0.3, pu1: 0.8, pu0: 0.2, row: 0 };
    const w = ui.shell(el, { title: 'Совместное распределение: таблица, поля и строки', sub: 'Каждая клетка — P(X = x, Y = y), чем темнее, тем вероятнее. По краям — маргинальные распределения (суммы строк и столбцов). Выберите строку: график покажет условное распределение Y при этом X рядом с маргинальным.' });
    const sel = ui.select(w.controls, { label: 'Пример', value: s.kind, options: [{ value: 'rain', label: 'дождь и зонт' }, { value: 'sum', label: 'первый кубик и сумма' }, { value: 'indep', label: 'два кубика (независимы)' }, { value: 'maxmin', label: 'максимум и минимум' }], onChange: (v) => ((s.kind = v), (s.row = 0), sr.set(0), draw()) });
    ui.slider(w.controls, { label: 'P(дождь)', min: 0.05, max: 0.95, step: 0.05, value: s.pr, format: f2, onInput: (v) => ((s.pr = v), draw()) });
    ui.slider(w.controls, { label: 'P(зонт | дождь)', min: 0, max: 1, step: 0.05, value: s.pu1, format: f2, onInput: (v) => ((s.pu1 = v), draw()) });
    ui.slider(w.controls, { label: 'P(зонт | сухо)', min: 0, max: 1, step: 0.05, value: s.pu0, format: f2, onInput: (v) => ((s.pu0 = v), draw()) });
    const sr = ui.slider(w.controls, { label: 'Условие: строка X =', min: 0, max: 5, step: 1, value: s.row, format: (v) => {
      const J = jointOf(s.kind, s);
      return J.xs[Math.min(v, J.xs.length - 1)];
    }, onInput: (v) => ((s.row = v), draw()) });
    void sel;
    const box = H('div', { style: 'overflow-x:auto;margin-bottom:8px' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(w.main, { height: 210, x: { label: 'y' }, y: { label: 'вероятность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'P(Y = первое значение)' }, { key: 'c', label: 'P(Y = первое | X = строка)' }, { key: 'ind', label: 'max |p(x, y) − p(x)p(y)|' }]);
    function draw() {
      const J = jointOf(s.kind, s);
      const row = Math.min(s.row, J.xs.length - 1);
      const px = J.P.map((r) => U.sum(r));
      const pyy = J.ys.map((_, j) => U.sum(J.P.map((r) => r[j])));
      const pmax = Math.max(...J.P.flat());
      const rgb = GBC.colors.rgb('model');
      const cellBg = (v) => 'background:rgba(' + rgb.map(Math.round).join(',') + ',' + (0.08 + 0.72 * (v / pmax)).toFixed(3) + ')';
      const t = H('table', { class: 'data', style: 'margin:0 auto;font-size:' + (J.ys.length > 6 ? '.78rem' : '.92rem') });
      t.appendChild(H('thead', null, H('tr', null, H('th', null, J.xn + ' \\ ' + J.yn), ...J.ys.map((y) => H('th', { class: 'num' }, y)), H('th', { class: 'num' }, 'p(x)'))));
      const tb = H('tbody');
      J.P.forEach((r, i) => {
        const isRow = i === row;
        tb.appendChild(H('tr', null, H('th', { style: 'text-align:left;' + (isRow ? 'color:var(--accent)' : '') }, J.xs[i]), ...r.map((v) => H('td', { class: 'num', style: cellBg(v) + ';' + (isRow ? 'outline:2px solid var(--accent);outline-offset:-2px;font-weight:700' : '') + (v === 0 ? ';color:var(--muted)' : '') }, J.ys.length > 6 ? (v ? frac(Math.round(v * 36), 36).replace('/36', '') : '0') : f3(v))), H('td', { class: 'num', style: 'font-weight:650' }, f3(px[i]))));
      });
      tb.appendChild(H('tr', null, H('th', { style: 'text-align:left' }, 'p(y)'), ...pyy.map((v) => H('td', { class: 'num', style: 'font-weight:650' }, f3(v))), H('td', { class: 'num' }, '1')));
      t.appendChild(tb);
      box.textContent = '';
      box.appendChild(t);
      if (J.ys.length > 6) box.appendChild(H('p', { class: 'widget-note', style: 'margin:4px 0 0;text-align:center' }, 'В клетках — число исходов из 36.'));
      const cond = J.P[row].map((v) => (px[row] > 0 ? v / px[row] : 0));
      const yi = J.ys.map((_, j) => j);
      plot.render([
        { type: 'bars', x: yi.map((j) => j - 0.18), y: pyy, color: 'data', width: 0.34, opacity: 0.6, label: 'маргинальное p(y)' },
        { type: 'bars', x: yi.map((j) => j + 0.18), y: cond, color: 'model', width: 0.34, label: 'условное p(y | x = ' + J.xs[row] + ')' },
      ], { x: [-0.7, J.ys.length - 0.3] });
      plot.opts.x.ticks = yi;
      plot.opts.x.format = (tt) => J.ys[Math.round(tt)] || '';
      plot.opts.x.label = J.yn;
      plot.draw();
      let dev = 0;
      J.P.forEach((r, i) => r.forEach((v, j) => (dev = Math.max(dev, Math.abs(v - px[i] * pyy[j])))));
      st.set('m', f4(pyy[0]));
      st.set('c', f4(cond[0]));
      st.set('ind', dev < 1e-12 ? '0 — независимы' : f4(dev));
      let txt = 'Маргинальные распределения — суммы по строкам и столбцам. Условное распределение при X = ' + J.xs[row] + ' — строка, делённая на её сумму ' + f3(px[row]) + '. ';
      if (s.kind === 'rain') txt += 'P(зонт) = ' + f3(pyy[0]) + ', P(дождь | зонт) = ' + f3(J.P[0][0] / pyy[0]) + '. ' + (dev < 1e-9 ? '<b>Зонт и погода независимы</b>: человек берёт зонт одинаково часто в любую погоду.' : 'Погода и зонт зависимы: P(дождь)·P(зонт) = ' + f3(px[0] * pyy[0]) + ' ≠ ' + f3(J.P[0][0]) + '.');
      else if (s.kind === 'sum') txt += 'X и S зависимы, но столбец S = 7 одинаков во всех строках: P(S = 7 | X = x) = 1/6 при любом x.';
      else if (s.kind === 'maxmin') txt += 'Половина таблицы пуста: минимум не бывает больше максимума. Сильная зависимость.';
      else txt += 'Каждая клетка равна произведению полей (1/6 · 1/6): условное распределение второго кубика совпадает с маргинальным при любой строке.';
      note.innerHTML = txt;
    }
    onTheme(draw);
    w.pythonAction(() => {
      const J = jointOf(s.kind, s);
      return PY_NP + 'P = np.array([' + J.P.map((r) => '[' + r.map((v) => U.pyNum(v)).join(', ') + ']').join(',\n              ') + '])   # строки — ' + J.xn + ', столбцы — ' + J.yn + '\npx, py = P.sum(axis=1), P.sum(axis=0)          # маргинальные распределения\nprint("p(x) =", px.round(4), "\\np(y) =", py.round(4))\nprint("условное p(y | x = строка ' + Math.min(s.row, J.xs.length - 1) + '):", (P[' + Math.min(s.row, J.xs.length - 1) + '] / px[' + Math.min(s.row, J.xs.length - 1) + ']).round(4))\nprint("независимы:", np.allclose(P, np.outer(px, py)))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 24. Условное среднее и разложение дисперсии
   * ============================================================================== */
  GBC.widget('cond-mean', (el) => {
    const s = { data: 'flats', k: 2, truth: true };
    const w = ui.shell(el, { title: 'Условное среднее и разложение дисперсии', sub: 'Разбиваем ось x на k равных корзин и в каждой считаем среднее y — оценку E[Y | X]. Получается ступенчатая функция, как у дерева. Внизу — общая дисперсия, разложенная на «внутри корзин» и «между корзинами».' });
    ui.segmented(w.controls, { label: 'Данные', value: s.data, options: [{ value: 'flats', label: 'шесть квартир' }, { value: 'sine', label: 'синусоида' }, { value: 'step', label: 'ступенька' }], onChange: (v) => ((s.data = v), draw()) });
    ui.slider(w.controls, { label: 'Корзин k', min: 1, max: 24, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.toggle(w.controls, { label: 'Истинная E[Y | X] = f(x)', checked: s.truth, onChange: (v) => ((s.truth = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'y' } });
    const plot2 = new GBC.Plot(w.main, { height: 120, x: { label: 'дисперсия y', domain: [0, 1] }, y: { label: '', domain: [0, 1], ticks: [] }, grid: 'x' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'Var Y' }, { key: 'wi', label: 'внутри корзин' }, { key: 'be', label: 'между корзинами' }, { key: 'r2', label: 'R² = между / Var Y' }]);
    function getData() {
      if (s.data === 'flats') return { ...GBC.datasets.toyRegression(), lo: 0.5, hi: 6.5, f: null };
      const d = GBC.datasets.regression1d({ kind: s.data, n: 200, noise: 0.5, seed: 7 });
      const F = { sine: (x) => Math.sin(x), step: (x) => (x < 3 ? 1 : x < 6.5 ? 3 : 2) };
      return { ...d, lo: 0, hi: 10, f: F[s.data] };
    }
    function draw() {
      const D = getData();
      const n = D.x.length;
      const k = s.data === 'flats' ? Math.min(s.k, 6) : s.k;
      const wd = (D.hi - D.lo) / k;
      const bin = (x) => Math.min(k - 1, Math.floor((x - D.lo) / wd));
      const sums = new Array(k).fill(0);
      const cnts = new Array(k).fill(0);
      D.x.forEach((x, i) => {
        sums[bin(x)] += D.y[i];
        cnts[bin(x)]++;
      });
      const means = sums.map((v, j) => (cnts[j] ? v / cnts[j] : NaN));
      const m = U.mean(D.y);
      const tot = U.mean(D.y.map((v) => (v - m) ** 2));
      const within = U.mean(D.y.map((v, i) => (v - means[bin(D.x[i])]) ** 2));
      const between = tot - within;
      const segs = means.map((v, j) => ({ x0: D.lo + j * wd, x1: D.lo + (j + 1) * wd, value: v })).filter((sg) => Number.isFinite(sg.value));
      const L = [
        { type: 'segments', x1: D.x, y1: D.x.map((x) => means[bin(x)]), x2: D.x, y2: D.y, color: 'residual', width: 1, opacity: 0.5 },
        { type: 'points', x: D.x, y: D.y, color: 'data', r: s.data === 'flats' ? 6 : 3.5, label: 'данные' },
        { type: 'steps', segments: segs, color: 'model', width: 2.6, label: 'среднее в корзине ≈ E[Y | X]' },
        { type: 'hline', y: m, color: 'muted', dash: '4 4', width: 1.2, label: 'общее среднее' },
      ];
      if (s.truth && D.f) {
        const xx = U.linspace(D.lo, D.hi, 300);
        L.push({ type: 'line', x: xx, y: xx.map(D.f), color: 'truth', width: 2, dash: '6 4', label: 'истинная f(x)' });
      }
      for (let j = 1; j < k; j++) L.push({ type: 'vline', x: D.lo + j * wd, color: 'border', width: 1 });
      plot.render(L, { x: [D.lo, D.hi] });
      plot2.render([
        { type: 'rect', x0: 0, x1: within, y0: 0.25, y1: 0.75, fill: 'data', opacity: 0.6, color: 'data', label: 'внутри (не объяснено)' },
        { type: 'rect', x0: within, x1: tot, y0: 0.25, y1: 0.75, fill: 'model', opacity: 0.75, color: 'model', label: 'между (объяснено)' },
      ], { x: [0, tot * 1.02 || 1] });
      st.set('v', f3(tot));
      st.set('wi', f3(within));
      st.set('be', f3(between));
      st.set('r2', f3(tot > 0 ? between / tot : 0));
      note.innerHTML = 'Var Y = ' + f3(tot) + ' = ' + f3(within) + ' (внутри) + ' + f3(between) + ' (между). Умноженное на n = ' + n + ': сумма квадратов остатков падает с ' + f2(n * tot) + ' до ' + f2(n * within) + ', выигрыш ' + f2(n * between) + ' — это и есть выигрыш разбиения дерева. ' +
        (s.data === 'flats' && k === 2 ? 'Для шести квартир и «площадь ≤ 3»: средние групп 3 и 9, 10.67 = 1.67 + 9, выигрыш 54. ' : '') +
        (s.data !== 'flats' ? (k > 12 ? 'Корзин много: в каждой мало точек, ступеньки начинают дрожать вслед за шумом — переобучение.' : k < 4 ? 'Корзин мало: ступеньки грубо приближают f(x) — недообучение.' : 'Ступеньки близки к истинной функции регрессии f(x).') : '');
    }
    w.pythonAction(() => {
      const src = s.data === 'flats' ? 'x = np.arange(1, 7.0)\ny = np.array([2, 4, 3, 7, 9, 11.0])\nlo, hi = 0.5, 6.5\n' : 'from gbcourse import datasets\nX, y = datasets.regression_1d(kind="' + s.data + '", n=200, noise=0.5, seed=7)\nx = X[:, 0]\nlo, hi = 0.0, 10.0\n';
      return PY_NP + src + 'k = ' + (s.data === 'flats' ? Math.min(s.k, 6) : s.k) + '\nbins = np.minimum(((x - lo) / ((hi - lo) / k)).astype(int), k - 1)\nmeans = np.array([y[bins == j].mean() if (bins == j).any() else np.nan for j in range(k)])\ntotal = y.var()\nwithin = ((y - means[bins]) ** 2).mean()\nprint(f"Var Y = {total:.4f} = внутри {within:.4f} + между {total - within:.4f};  R² = {(total - within) / total:.4f}")\nprint("выигрыш (сумма квадратов):", round(len(y) * (total - within), 4))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 25. Ковариация и корреляция
   * ============================================================================== */
  GBC.widget('correlation', (el) => {
    const s = { kind: 'lin', rho: 0.7, seed: 3 };
    const N = 300;
    const w = ui.shell(el, { title: 'Корреляция: что она видит и чего не видит', sub: '300 точек с заданной корреляцией ρ (обе величины стандартные). Пресеты «парабола» и «кольцо» — сильная зависимость при корреляции около нуля; «выброс» — одна точка, которая создаёт корреляцию из ничего.' });
    ui.select(w.controls, { label: 'Облако', value: s.kind, options: [{ value: 'lin', label: 'линейная связь с ρ' }, { value: 'par', label: 'парабола y = x² + шум' }, { value: 'ring', label: 'кольцо' }, { value: 'out', label: 'независимые + один выброс' }], onChange: (v) => ((s.kind = v), draw()) });
    ui.slider(w.controls, { label: 'ρ (для линейной)', min: -1, max: 1, step: 0.05, value: s.rho, format: f2, onInput: (v) => ((s.rho = v), draw()) });
    ui.button(w.controls, { label: 'Новая выборка', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(eqBox(w.main, 420), { height: 330, equal: true, x: { label: 'x', domain: [-3.5, 3.5] }, y: { label: 'y', domain: [-3.5, 3.5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'выборочная корреляция' }, { key: 'cv', label: 'ковариация' }, { key: 's', label: 'Var(X + Y) / Var(X − Y)' }, { key: 't', label: 'теория 2 ± 2ρ' }]);
    function gen() {
      const rng = new GBC.RNG(s.seed);
      const x = [];
      const y = [];
      for (let i = 0; i < N; i++) {
        const z1 = rng.normal();
        const z2 = rng.normal();
        if (s.kind === 'lin') (x.push(z1), y.push(s.rho * z1 + Math.sqrt(Math.max(0, 1 - s.rho * s.rho)) * z2));
        else if (s.kind === 'par') {
          const xx = 1.3 * z1 * 0.8;
          x.push(xx);
          y.push(xx * xx - 1 + 0.25 * z2);
        } else if (s.kind === 'ring') {
          const th = 2 * Math.PI * rng.random();
          const r = 2.2 + 0.2 * z1;
          x.push(r * Math.cos(th));
          y.push(r * Math.sin(th));
          void z2;
        } else (x.push(0.5 * z1), y.push(0.5 * z2));
      }
      if (s.kind === 'out') (x.push(3.2), y.push(3.2));
      return { x, y };
    }
    function draw() {
      const { x, y } = gen();
      const mx = U.mean(x);
      const my = U.mean(y);
      const cov = U.mean(x.map((v, i) => (v - mx) * (y[i] - my)));
      const sx = Math.sqrt(U.mean(x.map((v) => (v - mx) ** 2)));
      const sy = Math.sqrt(U.mean(y.map((v) => (v - my) ** 2)));
      const r = cov / (sx * sy);
      const sum = x.map((v, i) => v + y[i]);
      const dif = x.map((v, i) => v - y[i]);
      const vv = (a) => {
        const m = U.mean(a);
        return U.mean(a.map((t) => (t - m) ** 2));
      };
      const slope = cov / (sx * sx);
      plot.render([
        { type: 'line', x: [-3.5, 3.5], y: [my + slope * (-3.5 - mx), my + slope * (3.5 - mx)], color: 'tree', width: 1.6, dash: '5 4', label: 'наклон cov/Var X' },
        { type: 'points', x, y, color: 'model', r: 3.2, label: 'точки' },
        ...(s.kind === 'out' ? [{ type: 'points', x: [3.2], y: [3.2], color: 'critical', r: 6, label: 'выброс' }] : []),
      ]);
      st.set('c', f3(r));
      st.set('cv', f3(cov));
      st.set('s', f3(vv(sum)) + ' / ' + f3(vv(dif)));
      st.set('t', s.kind === 'lin' ? f2(2 + 2 * s.rho) + ' / ' + f2(2 - 2 * s.rho) : '—');
      const texts = {
        lin: 'Выборочная корреляция ' + f3(r) + ' при заданной ρ = ' + f2(s.rho) + ' — выборка из 300 точек даёт разброс около ±' + f2((1 - s.rho * s.rho) / Math.sqrt(N)) + '. Var(X ± Y) = Var X + Var Y ± 2Cov: при сильной положительной связи сумма дрожит сильно, а разность — слабо.',
        par: 'y почти полностью определяется x, но корреляция ' + f3(r) + ' ≈ 0: связь нелинейная и симметричная — положительные и отрицательные произведения отклонений гасят друг друга. Дерево решений такую зависимость легко поймает, корреляция — нет.',
        ring: 'Точки лежат на окружности — зная x, мы знаем y с точностью до знака, но корреляция ' + f3(r) + '. Нулевая корреляция ≠ независимость.',
        out: 'X и Y независимы, но одна точка в углу даёт корреляцию ' + f3(r) + '. Корреляция чувствительна к выбросам — смотрите на картинку, а не только на число (или используйте ранговую корреляцию Спирмена).',
      };
      note.innerHTML = texts[s.kind];
    }
    w.pythonAction(() => PY_RNG + 'import numpy as np\n\nrng = Mulberry32(' + s.seed + ')\nrho, N = ' + py(s.rho) + ', ' + N + '\nz = np.array([[rng.normal(), rng.normal()] for _ in range(N)])\nx, y = z[:, 0], rho * z[:, 0] + np.sqrt(1 - rho**2) * z[:, 1]\nprint("корреляция:", np.corrcoef(x, y)[0, 1].round(4), " ковариация:", np.cov(x, y, bias=True)[0, 1].round(4))\nprint("Var(X + Y) =", (x + y).var().round(4), " Var(X − Y) =", (x - y).var().round(4), " теория:", 2 + 2 * rho, 2 - 2 * rho)\n# корреляция 0 ≠ независимость\nt = np.array([-2, -1, 0, 1, 2.0])\nprint("cov(X, X²) =", np.cov(t, t**2, bias=True)[0, 1])\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 26. Свёртка: распределение суммы
   * ============================================================================== */
  const CONV = {
    die: { name: 'кубик', x0: 1, p: [1, 1, 1, 1, 1, 1] },
    coin: { name: 'монета 0/1, p = 0.5', x0: 0, p: [1, 1] },
    rare: { name: 'монета 0/1, p = 0.1', x0: 0, p: [9, 1] },
    loaded: { name: 'нечестный кубик (шестёрка ×5)', x0: 1, p: [1, 1, 1, 1, 1, 5] },
    twin: { name: 'две горки: 0 или 9', x0: 0, p: [5, 0, 0, 0, 0, 0, 0, 0, 0, 5] },
  };
  function convolve(a, b) {
    const out = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
    return out;
  }
  GBC.widget('convolution', (el) => {
    const s = { d: 'die', n: 2, normal: true };
    const w = ui.shell(el, { title: 'Свёртка: распределение суммы n независимых слагаемых', sub: 'Точное распределение суммы, вычисленное повторной свёрткой P(S + X = s) = Σ P(S = k)·P(X = s − k). Оранжевая кривая — нормальное распределение с тем же средним nμ и дисперсией nσ².' });
    ui.select(w.controls, { label: 'Слагаемое', value: s.d, options: Object.entries(CONV).map(([k, v]) => ({ value: k, label: v.name })), onChange: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'Слагаемых n', min: 1, max: 40, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.toggle(w.controls, { label: 'Нормальная кривая', checked: s.normal, onChange: (v) => ((s.normal = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'сумма' }, y: { label: 'вероятность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'E S = nμ' }, { key: 'v', label: 'Var S = nσ²' }, { key: 'sk', label: 'асимметрия' }, { key: 'd', label: 'max |P − нормальная|' }]);
    function draw() {
      const D = CONV[s.d];
      const tot = U.sum(D.p);
      const base = D.p.map((v) => v / tot);
      let pm = [1];
      for (let i = 0; i < s.n; i++) pm = convolve(pm, base);
      const xs = pm.map((_, i) => s.n * D.x0 + i);
      const bx = base.map((_, i) => D.x0 + i);
      const b = moments(bx, base);
      const m = s.n * b.m;
      const v = s.n * b.v;
      const sd = Math.sqrt(v);
      const keep = xs.map((_, i) => i).filter((i) => pm[i] > 1e-7 || Math.abs(xs[i] - m) < 4 * sd);
      const X = keep.map((i) => xs[i]);
      const P = keep.map((i) => pm[i]);
      const sk3 = U.sum(base.map((p, i) => p * (bx[i] - b.m) ** 3)) / Math.pow(b.v, 1.5);
      const L = [{ type: 'bars', x: X, y: P, color: 'model', width: 0.8, opacity: 0.75, label: 'точное распределение суммы', tooltip: (i) => [['сумма', String(X[i])], ['P', pf(P[i])]] }];
      let dmax = 0;
      if (s.normal && sd > 0) {
        const xx = U.linspace(X[0] - 0.5, X[X.length - 1] + 0.5, 300);
        L.push({ type: 'line', x: xx, y: xx.map((t) => normPdf(t, m, sd)), color: 'tree', width: 2, label: 'N(nμ, nσ²)' });
        X.forEach((x, i) => (dmax = Math.max(dmax, Math.abs(P[i] - normPdf(x, m, sd)))));
      }
      plot.render(L, { x: [X[0] - 0.7, X[X.length - 1] + 0.7] });
      st.set('m', f3(m));
      st.set('v', f3(v));
      st.set('sk', f3(sk3 / Math.sqrt(s.n)));
      st.set('d', s.normal ? pf(dmax) : '—');
      note.innerHTML = 'Сумма ' + s.n + ' ' + plural(s.n, 'слагаемого', 'слагаемых', 'слагаемых') + ' «' + D.name + '»: среднее и дисперсия просто складываются (nμ = ' + f2(m) + ', nσ² = ' + f2(v) + '), а форма сглаживается. Асимметрия суммы = асимметрия слагаемого / √n = ' + f3(sk3 / Math.sqrt(s.n)) + '. ' +
        (s.d === 'rare' ? 'Сильно скошенное слагаемое требует большого n, чтобы сумма стала похожа на колокол.' : s.d === 'twin' ? 'Даже у «двух горок» сумма быстро становится одногорбой: средние пики заполняются комбинациями.' : s.n === 2 && s.d === 'die' ? 'Два кубика — треугольник; добавьте третий: «шапочка» из парабол.' : 'Это центральная предельная теорема в действии (шаг 28).');
    }
    w.pythonAction(() => {
      const D = CONV[s.d];
      return PY_NP + 'p = np.array([' + D.p.join(', ') + '], dtype=float)\np /= p.sum()            # распределение одного слагаемого (значения с ' + D.x0 + ')\nn = ' + s.n + '\npm = np.array([1.0])\nfor _ in range(n):\n    pm = np.convolve(pm, p)          # свёртка\nvals = n * ' + D.x0 + ' + np.arange(len(pm))\nmu = (vals * pm).sum()\nprint("E S =", round(mu, 4), " Var S =", round(((vals - mu) ** 2 * pm).sum(), 4))\nprint("самая вероятная сумма:", vals[pm.argmax()], " P =", round(pm.max(), 5))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 27. Закон больших чисел и тяжёлые хвосты
   * ============================================================================== */
  GBC.widget('lln-heavy', (el) => {
    const s = { seed: 2, normal: true, pareto: true, cauchy: true };
    const N = 20000;
    const w = ui.shell(el, { title: 'Скользящее среднее: когда оно успокаивается', sub: 'Отклонение среднего первых n значений от «центра» распределения. Нормальное: среднее сходится, разброс ~ 1/√n (полоса). Парето с α = 1.5: ожидание есть (3), дисперсии нет — сходимость медленная и рывками. Коши: ожидания нет — среднее не сходится никогда.' });
    ui.toggle(w.controls, { label: 'нормальное N(0, 1)', checked: s.normal, onChange: (v) => ((s.normal = v), draw()) });
    ui.toggle(w.controls, { label: 'Парето, α = 1.5 (центр 3)', checked: s.pareto, onChange: (v) => ((s.pareto = v), draw()) });
    ui.toggle(w.controls, { label: 'Коши (центр 0)', checked: s.cauchy, onChange: (v) => ((s.cauchy = v), draw()) });
    ui.button(w.controls, { label: 'Новые выборки', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'n (лог.)', type: 'log', domain: [1, N], ticks: [1, 10, 100, 1000, 10000] }, y: { label: 'среднее − центр', domain: [-4, 4] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'нормальное: отклонение при n = 20 000' }, { key: 'p', label: 'Парето' }, { key: 'c', label: 'Коши' }, { key: 'mx', label: 'Коши: max |значение|' }]);
    function run(kind, seed) {
      const rng = new GBC.RNG(seed);
      let acc = 0;
      let big = 0;
      const xs = [];
      const ys = [];
      for (let i = 1; i <= N; i++) {
        const u = rng.random();
        let v;
        if (kind === 'n') v = rng.normal() + 0 * u;
        else if (kind === 'p') v = Math.pow(1 - u, -1 / 1.5) - 3;
        else v = Math.tan(Math.PI * (u - 0.5));
        big = Math.max(big, Math.abs(v));
        acc += v;
        if (i < 100 || i % Math.ceil(i / 120) === 0 || i === N) (xs.push(i), ys.push(U.clamp(acc / i, -4.2, 4.2)));
      }
      return { xs, ys, last: acc / N, big };
    }
    function draw() {
      const band = U.range(150).map((i) => Math.pow(N, i / 149));
      const L = [{ type: 'area', x: band, y0: band.map((m) => -2 / Math.sqrt(m)), y1: band.map((m) => 2 / Math.sqrt(m)), color: 'model', opacity: 0.12, label: '±2/√n' }, { type: 'hline', y: 0, color: 'muted', width: 1 }];
      const rn = run('n', s.seed * 3 + 1);
      const rp = run('p', s.seed * 3 + 2);
      const rc = run('c', s.seed * 3 + 3);
      if (s.normal) L.push({ type: 'line', x: rn.xs, y: rn.ys, color: 'model', width: 2, label: 'нормальное', hover: false });
      if (s.pareto) L.push({ type: 'line', x: rp.xs, y: rp.ys, color: 'aqua', width: 2, label: 'Парето α = 1.5', hover: false });
      if (s.cauchy) L.push({ type: 'line', x: rc.xs, y: rc.ys, color: 'tree', width: 2, label: 'Коши', hover: false });
      plot.render(L);
      st.set('n', f4(rn.last));
      st.set('p', f4(rp.last));
      st.set('c', f4(rc.last));
      st.set('mx', sci(rc.big));
      note.innerHTML = 'После 20 000 значений: нормальное среднее отклонилось на ' + f4(rn.last) + ' (типично ±' + f4(2 / Math.sqrt(N)) + '), Парето — на ' + f4(rp.last) + ', Коши — на ' + f4(rc.last) + '. У Коши одно значение достигает ' + sci(rc.big) + ' и сдвигает среднее рывком: среднее n значений Коши распределено так же, как одно значение. Графики обрезаны по ±4.';
    }
    w.pythonAction(() => PY_RNG + 'import math\nimport numpy as np\n\nN = ' + N + '\ndef running_mean(kind, seed):\n    rng = Mulberry32(seed)\n    vals = []\n    for _ in range(N):\n        u = rng.random()\n        if kind == "normal":\n            vals.append(rng.normal())\n        elif kind == "pareto":\n            vals.append((1 - u) ** (-1 / 1.5) - 3)      # Парето α = 1.5 минус среднее 3\n        else:\n            vals.append(math.tan(math.pi * (u - 0.5)))  # Коши\n    return np.cumsum(vals) / np.arange(1, N + 1)\nfor i, kind in enumerate(("normal", "pareto", "cauchy")):\n    m = running_mean(kind, ' + s.seed + ' * 3 + i + 1)\n    print(f"{kind:7s}: n = 100 → {m[99]:+.4f}, n = 1000 → {m[999]:+.4f}, n = {N} → {m[-1]:+.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 28. Центральная предельная теорема
   * ============================================================================== */
  const CLT_SRC = {
    die: { name: 'кубик', draw: (r) => 1 + r.randint(6), mu: 3.5, sd: Math.sqrt(35 / 12), disc: true, lo: 0.5, hi: 6.5, pdf: (x) => (x >= 1 && x <= 6 && Number.isInteger(x) ? 1 / 6 : 0) },
    exp: { name: 'экспоненциальное (λ = 1)', draw: (r) => -Math.log(1 - r.random()), mu: 1, sd: 1, lo: 0, hi: 6, pdf: (x) => (x >= 0 ? Math.exp(-x) : 0) },
    bern: { name: 'Бернулли, p = 0.1', draw: (r) => (r.random() < 0.1 ? 1 : 0), mu: 0.1, sd: Math.sqrt(0.09), disc: true, lo: -0.5, hi: 1.5, pdf: (x) => (x === 0 ? 0.9 : x === 1 ? 0.1 : 0) },
    unif: { name: 'равномерное [0, 1]', draw: (r) => r.random(), mu: 0.5, sd: Math.sqrt(1 / 12), lo: -0.1, hi: 1.1, pdf: (x) => (x >= 0 && x <= 1 ? 1 : 0) },
    cauchy: { name: 'Коши (дисперсии нет)', draw: (r) => Math.tan(Math.PI * (r.random() - 0.5)), mu: 0, sd: NaN, lo: -8, hi: 8, pdf: (x) => 1 / (Math.PI * (1 + x * x)) },
  };
  GBC.widget('clt', (el) => {
    const s = { src: 'die', n: 16, z: false, seed: 5 };
    const M = 4000;
    const w = ui.shell(el, { title: 'Центральная предельная теорема', sub: 'Берём n значений из исходного распределения (вверху) и считаем их среднее; повторяем 4000 раз. Гистограмма средних (внизу) — почти нормальная с центром μ и разбросом σ/√n, каким бы ни было исходное распределение (если у него есть дисперсия).' });
    ui.select(w.controls, { label: 'Исходное распределение', value: s.src, options: Object.entries(CLT_SRC).map(([k, v]) => ({ value: k, label: v.name })), onChange: (v) => ((s.src = v), draw()) });
    ui.slider(w.controls, { label: 'Размер выборки n', values: [1, 2, 3, 4, 5, 8, 10, 16, 30, 64, 100], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.toggle(w.controls, { label: 'Стандартизовать: (x̄ − μ)/(σ/√n)', checked: s.z, onChange: (v) => ((s.z = v), draw()) });
    ui.button(w.controls, { label: 'Новые выборки', onClick: () => (s.seed++, draw()) });
    const plot0 = new GBC.Plot(w.main, { height: 130, x: { label: 'исходное распределение' }, y: { label: '', ticks: [] } });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'среднее выборки x̄' }, y: { label: 'плотность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'среднее средних / μ' }, { key: 's', label: 'разброс средних / σ/√n' }, { key: 'sk', label: 'асимметрия средних' }, { key: 'in', label: 'доля в μ ± 2σ/√n' }]);
    function draw() {
      const D = CLT_SRC[s.src];
      const rng = new GBC.RNG(s.seed);
      const means = new Array(M);
      for (let r = 0; r < M; r++) {
        let acc = 0;
        for (let i = 0; i < s.n; i++) acc += D.draw(rng);
        means[r] = acc / s.n;
      }
      // исходное
      if (D.disc) {
        const xs = s.src === 'die' ? [1, 2, 3, 4, 5, 6] : [0, 1];
        plot0.render([{ type: 'bars', x: xs, y: xs.map(D.pdf), color: 'data', width: 0.6, opacity: 0.6 }], { x: [D.lo, D.hi] });
      } else {
        const xx = U.linspace(D.lo, D.hi, 200);
        plot0.render([{ type: 'area', x: xx, y0: xx.map(() => 0), y1: xx.map(D.pdf), color: 'data', opacity: 0.35 }, { type: 'line', x: xx, y: xx.map(D.pdf), color: 'data', width: 1.6 }], { x: [D.lo, D.hi] });
      }
      const se = D.sd / Math.sqrt(s.n);
      const hasSd = Number.isFinite(se);
      const vals = s.z && hasSd ? means.map((m) => (m - D.mu) / se) : means;
      let lo;
      let hi;
      if (s.z && hasSd) (lo = -4.5), (hi = 4.5);
      else if (hasSd) (lo = D.mu - 4.5 * se), (hi = D.mu + 4.5 * se);
      else (lo = -8), (hi = 8);
      let hd;
      if (D.disc) {
        // средние дискретной величины принимают значения с шагом 1/n — корзина на каждое значение
        const step0 = 1 / s.n;
        const minM = s.src === 'die' ? 1 : 0;
        const maxM = s.src === 'die' ? 6 : 1;
        const nb = Math.round((maxM - minM) / step0) + 1;
        const tr = (m) => (s.z && hasSd ? (m - D.mu) / se : m);
        hd = histDensity(vals, tr(minM - step0 / 2), tr(minM - step0 / 2 + nb * step0), nb);
      } else hd = histDensity(vals, lo, hi, 40);
      const L = [{ type: 'bars', x: hd.x, y: hd.y, color: 'model', width: hd.w, maxPx: 400, opacity: 0.6, label: 'гистограмма ' + M + ' средних' }];
      if (hasSd) {
        const xx = U.linspace(lo, hi, 300);
        L.push({ type: 'line', x: xx, y: xx.map((x) => (s.z ? normPdf(x) : normPdf(x, D.mu, se))), color: 'tree', width: 2.2, label: s.z ? 'N(0, 1)' : 'N(μ, σ²/n)' });
      } else {
        const xx = U.linspace(lo, hi, 300);
        L.push({ type: 'line', x: xx, y: xx.map(D.pdf), color: 'tree', width: 2.2, label: 'плотность одного значения Коши' });
      }
      plot.render(L, { x: [lo, hi] });
      const mm = U.mean(means);
      const sdm = Math.sqrt(U.mean(means.map((m) => (m - mm) ** 2)));
      const inside = hasSd ? means.filter((m) => Math.abs(m - D.mu) <= 2 * se).length / M : NaN;
      st.set('m', f3(mm) + ' / ' + f3(D.mu));
      st.set('s', hasSd ? f4(sdm) + ' / ' + f4(se) : 'σ не существует');
      st.set('sk', f3(skewness(means)));
      st.set('in', hasSd ? f3(inside) : '—');
      note.innerHTML = hasSd
        ? 'n = ' + s.n + ': средние разбросаны с σ/√n = ' + f4(se) + ' (в опыте ' + f4(sdm) + '), внутри μ ± 2σ/√n — ' + pct(inside) + ' (у нормального 95.4 %). ' + (Math.abs(skewness(means)) > 0.3 ? 'Асимметрия ещё заметна (' + f2(skewness(means)) + ') — для скошенного распределения нужно больше n.' : 'Гистограмма почти неотличима от нормальной кривой.') + (s.src === 'die' ? ' Для кубика: σ/√n = 1.708, 0.854, 0.427, 0.213 при n = 1, 4, 16, 64.' : '')
        : 'У распределения Коши нет ни ожидания, ни дисперсии, и ЦПТ не работает: гистограмма средних при любом n совпадает с плотностью одного значения (оранжевая кривая). Усреднение не помогает.';
    }
    w.pythonAction(() => {
      const code = { die: '1 + rng.randint(6)', exp: '-math.log(1 - rng.random())', bern: '1 if rng.random() < 0.1 else 0', unif: 'rng.random()', cauchy: 'math.tan(math.pi * (rng.random() - 0.5))' }[s.src];
      return PY_RNG + 'import math\nimport numpy as np\n\nrng = Mulberry32(' + s.seed + ')\nn, M = ' + s.n + ', ' + M + '\nmeans = np.array([np.mean([' + code + ' for _ in range(n)]) for _ in range(M)])\nprint("среднее средних:", means.mean().round(4), " разброс средних:", means.std().round(4))\n' + (Number.isFinite(CLT_SRC[s.src].sd) ? 'print("теория σ/√n:", round(' + U.pyNum(CLT_SRC[s.src].sd) + ' / math.sqrt(n), 4))\n' : '') + 'm, sd = means.mean(), means.std()\nprint("асимметрия:", round(((means - m) ** 3).mean() / sd**3, 3))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 29. Цепь Маркова
   * ============================================================================== */
  GBC.widget('markov', (el) => {
    const s = { kind: 'weather', pss: 0.9, prs: 0.5, start: 1, t: 10, seed: 1 };
    const w = ui.shell(el, { title: 'Цепь Маркова: от старта к стационарному распределению', sub: 'Вверху — матрица переходов (строка — откуда, столбец — куда). График 1: точное распределение по состояниям через t шагов, π_t = π₀Pᵗ. График 2: одна случайная траектория — доли дней в каждом состоянии приближаются к стационарному распределению π.' });
    ui.segmented(w.controls, { label: 'Цепь', value: s.kind, options: [{ value: 'weather', label: 'погода' }, { value: 'clients', label: 'клиенты' }], onChange: (v) => ((s.kind = v), (s.start = v === 'weather' ? 1 : 0), draw()) });
    ui.slider(w.controls, { label: 'Погода: P(солнце → солнце)', min: 0.05, max: 0.95, step: 0.05, value: s.pss, format: f2, onInput: (v) => ((s.pss = v), draw()) });
    ui.slider(w.controls, { label: 'Погода: P(дождь → солнце)', min: 0.05, max: 0.95, step: 0.05, value: s.prs, format: f2, onInput: (v) => ((s.prs = v), draw()) });
    ui.slider(w.controls, { label: 'Старт', min: 0, max: 2, step: 1, value: s.start, format: (v) => names()[Math.min(v, names().length - 1)], onInput: (v) => ((s.start = v), draw()) });
    ui.player(w.controls, { label: 'Шагов t', min: 0, max: 30, value: s.t, fps: 4, format: (t) => 't = ' + t, onChange: (t) => ((s.t = t), draw()) });
    ui.button(w.controls, { label: 'Новая траектория', onClick: () => (s.seed++, draw()) });
    function names() {
      return s.kind === 'weather' ? ['солнце', 'дождь'] : ['активен', 'спит', 'ушёл'];
    }
    function matrix() {
      if (s.kind === 'weather') return [[s.pss, 1 - s.pss], [s.prs, 1 - s.prs]];
      return [[0.85, 0.12, 0.03], [0.3, 0.55, 0.15], [0, 0, 1]];
    }
    const box = H('div', { style: 'overflow-x:auto;margin-bottom:6px' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(w.main, { height: 210, x: { label: 'шаг t', domain: [0, 30] }, y: { label: 'P(состояние на шаге t)', domain: [0, 1] } });
    const plot2 = new GBC.Plot(w.main, { height: 200, x: { label: 'шагов траектории (лог.)', type: 'log', domain: [1, 5000], ticks: [1, 10, 100, 1000] }, y: { label: 'доля времени', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pt', label: 'π_t' }, { key: 'pi', label: 'стационарное π' }, { key: 'fr', label: 'доли в траектории' }]);
    const step = (v, P) => P[0].map((_, j) => v.reduce((acc, vi, i) => acc + vi * P[i][j], 0));
    function draw() {
      const P = matrix();
      const nm = names();
      const k = nm.length;
      const start = Math.min(s.start, k - 1);
      const t = H('table', { class: 'data', style: 'margin:0 auto' });
      t.appendChild(H('thead', null, H('tr', null, H('th', null, 'из \\ в'), ...nm.map((n) => H('th', { class: 'num' }, n)))));
      const tb = H('tbody');
      P.forEach((r, i) => tb.appendChild(H('tr', null, H('th', { style: 'text-align:left' }, nm[i]), ...r.map((v) => H('td', { class: 'num' }, f2(v))))));
      t.appendChild(tb);
      box.textContent = '';
      box.appendChild(t);
      let v = nm.map((_, i) => (i === start ? 1 : 0));
      const hist = [v];
      for (let i = 0; i < 30; i++) (v = step(v, P)), hist.push(v);
      let pi = nm.map(() => 1 / k);
      for (let i = 0; i < 5000; i++) pi = step(pi, P);
      const cols = ['tree', 'model', 'critical'];
      const L = [];
      nm.forEach((n, j) => {
        L.push({ type: 'line', x: U.range(31), y: hist.map((h) => h[j]), color: cols[j], width: 2, label: n });
        L.push({ type: 'hline', y: pi[j], color: cols[j], width: 1, dash: '4 4' });
      });
      L.push({ type: 'vline', x: s.t, color: 'ink2', width: 1.2, dash: '3 3' });
      L.push({ type: 'points', x: nm.map(() => s.t), y: hist[s.t], color: (j) => cols[j], r: 5 });
      plot.render(L);
      // траектория
      const rng = new GBC.RNG(s.seed);
      let cur = start;
      const cnt = new Array(k).fill(0);
      const T = 5000;
      const xs = [];
      const ys = nm.map(() => []);
      for (let i = 1; i <= T; i++) {
        const u = rng.random();
        let acc = 0;
        let nx = k - 1;
        for (let j = 0; j < k; j++) {
          acc += P[cur][j];
          if (u < acc) {
            nx = j;
            break;
          }
        }
        cur = nx;
        cnt[cur]++;
        if (i < 60 || i % Math.ceil(i / 80) === 0 || i === T) (xs.push(i), nm.forEach((_, j) => ys[j].push(cnt[j] / i)));
      }
      plot2.render([...nm.map((n, j) => ({ type: 'line', x: xs, y: ys[j], color: cols[j], width: 2, label: n, hover: false })), ...nm.map((_, j) => ({ type: 'hline', y: pi[j], color: cols[j], width: 1, dash: '4 4' }))]);
      st.set('pt', '(' + hist[s.t].map((x) => U.fmt(x, 5)).join(', ') + ')');
      st.set('pi', '(' + pi.map((x) => U.fmt(x, 4)).join(', ') + ')');
      st.set('fr', '(' + cnt.map((c) => U.fmt(c / T, 3)).join(', ') + ')');
      const lam2 = s.kind === 'weather' ? s.pss - s.prs : null;
      note.innerHTML = s.kind === 'weather'
        ? 'Стационарное распределение решает π = πP: π<sub>солнце</sub> = ' + f4(pi[0]) + ', π<sub>дождь</sub> = ' + f4(pi[1]) + '. Отклонение π<sub>t</sub> от π уменьшается в |' + f2(lam2) + '| раза за шаг (второе собственное число матрицы — урок 15.12). При 0.9 и 0.5: из дождя через день (0.5, 0.5), через два (0.7, 0.3), через десять (0.83325, 0.16675). Доли дней в одной долгой траектории сходятся к тем же числам — закон больших чисел для зависимых величин.'
        : '«Ушёл» — поглощающее состояние: из него не возвращаются, поэтому стационарное распределение (0, 0, 1) — рано или поздно уходят все. Модели оттока оценивают, <b>как быстро</b>: через t шагов ушли ' + pct(hist[s.t][2]) + ' стартовавших в состоянии «' + nm[start] + '».';
    }
    w.pythonAction(() => PY_NP + 'P = np.array(' + JSON.stringify(matrix()) + ')       # строка — откуда, столбец — куда\npi0 = np.eye(len(P))[' + Math.min(s.start, names().length - 1) + ']\nfor t in sorted({1, 2, 3, 10, ' + s.t + '}):\n    print(f"t = {t:2d}:", (pi0 @ np.linalg.matrix_power(P, t)).round(5))\n# стационарное: левый собственный вектор с собственным числом 1\nw, V = np.linalg.eig(P.T)\npi = np.real(V[:, np.argmin(abs(w - 1))])\nprint("π =", (pi / pi.sum()).round(5))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 30. Калибровка
   * ============================================================================== */
  function aucOf(p, y) {
    const idx = U.argsort(p);
    let rank = 0;
    let sumPos = 0;
    let nPos = 0;
    for (let i = 0; i < idx.length; i++) {
      // средние ранги при совпадениях
      let j = i;
      while (j + 1 < idx.length && p[idx[j + 1]] === p[idx[i]]) j++;
      const r = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) if (y[idx[k]]) (sumPos += r, nPos++);
      rank = j;
      i = j;
    }
    void rank;
    const nNeg = y.length - nPos;
    return (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
  }
  GBC.widget('calibration', (el) => {
    const s = { T: 1, b: 0, seed: 11 };
    const N = 4000;
    const w = ui.shell(el, { title: 'Калибровка: прогноз 0.7 — это 70 %?', sub: 'Синтетические данные: у каждого объекта истинная вероятность σ(z), ответ y ~ Бернулли(σ(z)). Модель выдаёт σ((z + сдвиг)/T). Точки диаграммы надёжности — средний прогноз и доля единиц в каждой из 10 корзин (размер точки — число объектов). У откалиброванной модели точки на диагонали.' });
    const sT = ui.slider(w.controls, { label: 'Температура T', min: 0.3, max: 3, log: true, value: s.T, format: f2, onInput: (v) => ((s.T = v), draw()) });
    const sbb = ui.slider(w.controls, { label: 'Сдвиг логита', min: -2, max: 2, step: 0.1, value: s.b, format: f1, onInput: (v) => ((s.b = v), draw()) });
    ui.button(w.controls, { label: 'Откалибровать', kind: 'primary', onClick: () => ((s.T = 1), (s.b = 0), sT.set(1), sbb.set(0), draw()) });
    const plot = new GBC.Plot(eqBox(w.main, 420), { height: 320, equal: true, x: { label: 'средний прогноз в корзине', domain: [0, 1] }, y: { label: 'доля единиц', domain: [0, 1] } });
    const plot2 = new GBC.Plot(w.main, { height: 120, x: { label: 'прогноз модели', domain: [0, 1] }, y: { label: 'объектов' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'll', label: 'log-loss' }, { key: 'br', label: 'Брайер' }, { key: 'ece', label: 'ошибка калибровки (ECE)' }, { key: 'auc', label: 'AUC' }]);
    let data = null;
    function gen() {
      const rng = new GBC.RNG(s.seed);
      const z = [];
      const y = [];
      for (let i = 0; i < N; i++) {
        const zi = 1.6 * rng.normal();
        z.push(zi);
        y.push(rng.random() < sigm(zi) ? 1 : 0);
      }
      return { z, y };
    }
    function draw() {
      if (!data) data = gen();
      const { z, y } = data;
      const p = z.map((zi) => sigm((zi + s.b) / s.T));
      const B = 10;
      const sp = new Array(B).fill(0);
      const sy = new Array(B).fill(0);
      const cn = new Array(B).fill(0);
      p.forEach((pi, i) => {
        const j = Math.min(B - 1, Math.floor(pi * B));
        sp[j] += pi;
        sy[j] += y[i];
        cn[j]++;
      });
      const ok = cn.map((c) => c > 0);
      const mp = sp.map((v, j) => (cn[j] ? v / cn[j] : NaN));
      const my = sy.map((v, j) => (cn[j] ? v / cn[j] : NaN));
      const ece = U.sum(cn.map((c, j) => (c ? (c / N) * Math.abs(mp[j] - my[j]) : 0)));
      const ll = -U.mean(p.map((pi, i) => (y[i] ? Math.log(Math.max(pi, 1e-15)) : Math.log(Math.max(1 - pi, 1e-15)))));
      const br = U.mean(p.map((pi, i) => (pi - y[i]) ** 2));
      const xs = mp.filter((_, j) => ok[j]);
      const ys = my.filter((_, j) => ok[j]);
      const cs = cn.filter((_, j) => ok[j]);
      plot.render([
        { type: 'line', x: [0, 1], y: [0, 1], color: 'muted', width: 1.4, dash: '5 4', label: 'идеальная калибровка' },
        { type: 'line', x: xs, y: ys, color: 'model', width: 2, hover: false },
        { type: 'points', x: xs, y: ys, color: 'model', r: (i) => 3 + 7 * Math.sqrt(cs[i] / N), label: 'корзины', tooltip: (i) => [['прогноз', f3(xs[i])], ['доля единиц', f3(ys[i])], ['объектов', String(cs[i])]] },
      ]);
      const hd = histDensity(p, 0, 1, 20);
      plot2.render([{ type: 'bars', x: hd.x, y: hd.counts, color: 'data', width: hd.w, maxPx: 400, opacity: 0.6 }]);
      st.set('ll', f4(ll));
      st.set('br', f4(br));
      st.set('ece', f4(ece));
      st.set('auc', f4(aucOf(p, y)));
      const kind = Math.abs(s.T - 1) < 0.03 && Math.abs(s.b) < 0.05 ? 'cal' : s.T < 0.97 ? 'over' : s.T > 1.03 ? 'under' : 'shift';
      const texts = {
        cal: 'Модель откалибрована: в каждой корзине доля единиц близка к среднему прогнозу (отклонения — шум конечной выборки). Log-loss и Брайер минимальны.',
        over: '<b>Самоуверенная модель</b> (T < 1): прогнозы прижаты к 0 и 1 (гистограмма), а настоящие доли единиц ближе к середине — кривая положе диагонали. Log-loss растёт из-за уверенных ошибок.',
        under: '<b>Робкая модель</b> (T > 1): прогнозы стянуты к 0.5, кривая круче диагонали. Модель недооценивает свою уверенность.',
        shift: 'Сдвиг логита делает все вероятности систематически завышенными или заниженными — так бывает после балансировки классов или весов (шаг 9).',
      };
      note.innerHTML = texts[kind] + ' AUC = ' + f4(aucOf(p, y)) + ' не меняется ни от температуры, ни от сдвига: порядок объектов тот же. Калибровка — отдельное свойство модели, ранжирование её не гарантирует.';
    }
    w.pythonAction(() => PY_RNG + 'import numpy as np\n\nrng = Mulberry32(' + s.seed + ')\nN = ' + N + '\nz = np.empty(N); y = np.empty(N)\nfor i in range(N):\n    z[i] = 1.6 * rng.normal()\n    y[i] = rng.random() < 1 / (1 + np.exp(-z[i]))\nT, shift = ' + py(s.T) + ', ' + py(s.b) + '\np = 1 / (1 + np.exp(-(z + shift) / T))\nprint("log-loss:", -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)).round(4), " Брайер:", np.mean((p - y) ** 2).round(4))\nbins = np.minimum((p * 10).astype(int), 9)\nfor j in range(10):\n    m = bins == j\n    if m.any():\n        print(f"корзина {j}: прогноз {p[m].mean():.3f}, доля единиц {y[m].mean():.3f}, объектов {m.sum()}")\n# from sklearn.calibration import calibration_curve — то же самое одной строкой\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 31. Правдоподобие и log-loss
   * ============================================================================== */
  GBC.widget('likelihood', (el) => {
    const s = { n: 10, k: 7, p: 0.5, logit: false };
    const w = ui.shell(el, { title: 'Правдоподобие, log-loss и стартовый логит', sub: 'Данные: k ушедших из n клиентов. Верхний график — правдоподобие L(p) = pᵏ(1 − p)ⁿ⁻ᵏ относительно его максимума. Нижний — log-loss = −(1/n)·log L(p) с касательной в текущей точке. Переключатель «по логиту» рисует log-loss как функцию F = ln(p/(1 − p)) — так её видит бустинг: выпуклая чаша.' });
    ui.slider(w.controls, { label: 'Клиентов n', min: 1, max: 100, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), (s.k = Math.min(s.k, v)), sk.set(s.k), draw()) });
    const sk = ui.slider(w.controls, { label: 'Ушли k', min: 0, max: 100, step: 1, value: s.k, format: (v) => String(Math.min(v, s.n)), onInput: (v) => ((s.k = Math.min(v, s.n)), draw()) });
    const sp = ui.slider(w.controls, { label: 'Вероятность ухода p', min: 0.01, max: 0.99, step: 0.01, value: s.p, format: f2, onInput: (v) => ((s.p = v), draw()) });
    ui.toggle(w.controls, { label: 'По логиту F', checked: s.logit, onChange: (v) => ((s.logit = v), draw()) });
    ui.button(w.controls, { label: 'Поставить p = k/n', kind: 'primary', onClick: () => ((s.p = U.clamp(s.k / s.n, 0.01, 0.99)), sp.set(s.p), draw()) });
    const plot = new GBC.Plot(w.main, { height: 180, x: { label: 'p', domain: [0, 1] }, y: { label: 'L(p) / L(p̂)', domain: [0, 1.08] } });
    const plot2 = new GBC.Plot(w.main, { height: 230, x: { label: 'p', domain: [0, 1] }, y: { label: 'log-loss' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'L(p)' }, { key: 'll', label: 'log-loss(p)' }, { key: 'd', label: 'производная' }, { key: 'f0', label: 'p̂ = k/n, F₀ = ln(p̂/(1 − p̂))' }]);
    function draw() {
      const { n } = s;
      const k = Math.min(s.k, n);
      const ll = (p) => -(k * Math.log(p) + (n - k) * Math.log(1 - p)) / n;
      const ph = k / n;
      const llh = ph === 0 || ph === 1 ? 0 : ll(ph);
      const ps = U.linspace(0.005, 0.995, 300);
      plot.render([
        { type: 'line', x: ps, y: ps.map((p) => Math.exp(-n * (ll(p) - llh))), color: 'model', width: 2.2 },
        { type: 'vline', x: ph, color: 'good', dash: '4 4', width: 1.4 },
        { type: 'points', x: [s.p], y: [Math.exp(-n * (ll(s.p) - llh))], color: 'tree', r: 6 },
      ]);
      const p = s.p;
      if (!s.logit) {
        const d = (-(k / p) + (n - k) / (1 - p)) / n;
        const ys = ps.map(ll);
        plot2.opts.x = Object.assign({}, plot2.opts.x, { label: 'p', domain: [0, 1] });
        plot2.render([
          { type: 'line', x: ps, y: ys, color: 'model', width: 2.2, label: 'log-loss(p)' },
          { type: 'line', x: [Math.max(0.005, p - 0.15), Math.min(0.995, p + 0.15)], y: [ll(p) - 0.15 * d, ll(p) + 0.15 * d], color: 'tree', width: 1.6, dash: '5 3', label: 'касательная' },
          { type: 'vline', x: ph, color: 'good', dash: '4 4', width: 1.4 },
          { type: 'points', x: [p], y: [ll(p)], color: 'tree', r: 6 },
        ], { y: [Math.max(0, llh - 0.1), Math.min(3, Math.max(llh + 0.8, ll(p) + 0.2))] });
        st.set('d', 'd/dp = ' + f3(d));
      } else {
        const F = Math.log(p / (1 - p));
        const Fs = U.linspace(-5, 5, 300);
        const lf = (f) => ll(U.clamp(sigm(f), 1e-12, 1 - 1e-12));
        const g = sigm(F) - ph; // производная по F
        plot2.opts.x = Object.assign({}, plot2.opts.x, { label: 'F = ln(p/(1 − p))', domain: [-5, 5] });
        plot2.render([
          { type: 'line', x: Fs, y: Fs.map(lf), color: 'model', width: 2.2, label: 'log-loss(σ(F))' },
          { type: 'line', x: [F - 1.2, F + 1.2], y: [lf(F) - 1.2 * g, lf(F) + 1.2 * g], color: 'tree', width: 1.6, dash: '5 3', label: 'касательная: наклон p − p̂' },
          ...(ph > 0 && ph < 1 ? [{ type: 'vline', x: Math.log(ph / (1 - ph)), color: 'good', dash: '4 4', width: 1.4 }] : []),
          { type: 'points', x: [F], y: [lf(F)], color: 'tree', r: 6 },
        ], { y: [Math.max(0, llh - 0.1), Math.min(3.5, Math.max(llh + 1, lf(F) + 0.2))] });
        st.set('d', 'd/dF = p − p̂ = ' + f3(g));
      }
      st.set('L', sci(Math.exp(-n * ll(p))));
      st.set('ll', f4(ll(p)));
      st.set('f0', f3(ph) + ', ' + (ph > 0 && ph < 1 ? f4(Math.log(ph / (1 - ph))) : ph === 0 ? '−∞' : '+∞'));
      note.innerHTML = 'Правдоподобие при p = ' + f2(p) + ': ' + sci(Math.exp(-n * ll(p))) + ' — крошечное число (при n = 1000 оно было бы меньше 10⁻³⁰⁰), поэтому работают с логарифмом. log-loss = ' + f4(ll(p)) + ', минимум ' + f4(llh) + ' при p̂ = k/n = ' + f3(ph) + '. ' +
        (s.logit ? 'По логиту log-loss — гладкая выпуклая чаша, а её наклон равен p − p̂: именно этот градиент (со знаком минус — псевдоостаток y − p) видят деревья бустинга. Минимум — при F₀ = ln(p̂/(1 − p̂)).' : 'Стартовая константа бустинга для классификации — логарифм шансов F₀ = ln(k/(n − k)); для 7 из 10 это ln(7/3) ≈ 0.847, а log-loss при p = 0.5, 0.7, 0.9 — 0.693, 0.611, 0.765.');
    }
    w.pythonAction(() => PY_NP + 'n, k = ' + s.n + ', ' + Math.min(s.k, s.n) + '\ny = np.array([1] * k + [0] * (n - k))\nfor p in sorted({0.5, 0.7, 0.9, ' + py(s.p) + '}):\n    print(f"p = {p}: L = {p**k * (1 - p)**(n - k):.3e}, log-loss = {-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)):.4f}")\np_hat = k / n\nprint("p̂ =", p_hat, " F0 = ln(p̂/(1 − p̂)) =", round(np.log(p_hat / (1 - p_hat)), 4) if 0 < k < n else "±∞")\n\n# проверка: бустинг gbcourse стартует именно с этого логита\nfrom gbcourse.boosting import GBClassifier\nif 0 < k < n:\n    m = GBClassifier(n_estimators=1, learning_rate=0.1, max_depth=1).fit(np.zeros((n, 1)), y)\n    print("F0 в gbcourse:", round(float(m.init_), 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 32. Модель шума и функция потерь
   * ============================================================================== */
  const NL_DATA = {
    flats: { name: 'шесть квартир', y: [2, 4, 3, 7, 9, 11], lo: 0, hi: 13 },
    out: { name: 'квартиры с выбросом', y: [2, 4, 3, 7, 9, 21], lo: 0, hi: 22 },
    counts: { name: 'заказы в день', y: [0, 1, 1, 2, 3, 0, 5, 2, 1, 8], lo: 0, hi: 9 },
    binary: { name: 'клиенты 0/1 (7 из 10)', y: [1, 1, 0, 1, 1, 0, 1, 1, 0, 1], lo: 0, hi: 1 },
  };
  const NL_LOSS = {
    mse: { name: 'MSE (нормальный шум)', f: (y, c) => (y - c) ** 2 },
    mae: { name: 'MAE (Лаплас)', f: (y, c) => Math.abs(y - c) },
    q: { name: 'квантильные (τ)', f: (y, c, t) => (y >= c ? t * (y - c) : (1 - t) * (c - y)) },
    pois: { name: 'пуассоновские', f: (y, c) => c - y * Math.log(Math.max(c, 1e-12)) },
    log: { name: 'log-loss (Бернулли)', f: (y, c) => -(y * Math.log(Math.max(c, 1e-12)) + (1 - y) * Math.log(Math.max(1 - c, 1e-12))) },
  };
  GBC.widget('noise-loss', (el) => {
    const s = { data: 'flats', loss: 'mse', tau: 0.9, c: 5 };
    const w = ui.shell(el, { title: 'Какую константу выбирает функция потерь', sub: 'Точки — данные. Ползунок — константный прогноз c, рядом нарисована модель шума вокруг c (плотность или вероятности). Нижний график — средние потери как функция c; минимум отмечен зелёным. Каждой модели шума соответствует свой «центр».' });
    const sd0 = ui.select(w.controls, { label: 'Данные', value: s.data, options: Object.entries(NL_DATA).map(([k, v]) => ({ value: k, label: v.name })), onChange: (v) => ((s.data = v), fix(), draw()) });
    ui.select(w.controls, { label: 'Потери', value: s.loss, options: Object.entries(NL_LOSS).map(([k, v]) => ({ value: k, label: v.name })), onChange: (v) => {
      s.loss = v;
      if (v === 'log' && s.data !== 'binary') (s.data = 'binary'), sd0.set('binary');
      fix();
      draw();
    } });
    ui.slider(w.controls, { label: 'τ для квантильных', min: 0.05, max: 0.95, step: 0.05, value: s.tau, format: f2, onInput: (v) => ((s.tau = v), draw()) });
    const sc = ui.slider(w.controls, { label: 'Прогноз c', min: 0, max: 1, step: 0.001, value: 0.25, format: () => f3(s.c), onInput: (v) => ((s.c = cOf(v)), draw()) });
    ui.button(w.controls, { label: 'К минимуму', kind: 'primary', onClick: () => ((s.c = best()), sc.set(posOf(s.c)), draw()) });
    const range = () => {
      const D = NL_DATA[s.data];
      if (s.loss === 'log') return [0.01, 0.99];
      if (s.loss === 'pois') return [0.1, Math.max(D.hi, 1)];
      return [D.lo, D.hi];
    };
    const cOf = (v) => {
      const [a, b] = range();
      return a + v * (b - a);
    };
    const posOf = (c) => {
      const [a, b] = range();
      return U.clamp((c - a) / (b - a), 0, 1);
    };
    function fix() {
      const [a, b] = range();
      s.c = U.clamp(s.c, a, b);
      sc.set(posOf(s.c));
    }
    function lossAt(c) {
      const D = NL_DATA[s.data];
      const f = NL_LOSS[s.loss].f;
      return U.mean(D.y.map((y) => f(y, c, s.tau)));
    }
    /** Точный минимум: среднее, медиана (середина плоского участка), квантиль. */
    function best() {
      const y = NL_DATA[s.data].y;
      const srt = y.slice().sort((u, v) => u - v);
      const [a, b] = range();
      if (s.loss === 'mae') return U.clamp(U.median(y), a, b);
      if (s.loss === 'q') return U.clamp(srt[Math.max(0, Math.ceil(s.tau * srt.length) - 1)], a, b);
      return U.clamp(U.mean(y), a, b);
    }
    const plot = new GBC.Plot(w.main, { height: 200, x: { label: 'y' }, y: { label: 'модель шума', ticks: [] } });
    const plot2 = new GBC.Plot(w.main, { height: 220, x: { label: 'прогноз c' }, y: { label: 'средние потери' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'b', label: 'лучшая константа' }, { key: 'l', label: 'потери при c' }, { key: 'mm', label: 'среднее / медиана' }, { key: 'x', label: 'для сравнения' }]);
    function draw() {
      const D = NL_DATA[s.data];
      const y = D.y;
      const c = s.c;
      const [a, b] = range();
      const m = U.mean(y);
      const sd = Math.sqrt(U.mean(y.map((v) => (v - m) ** 2))) || 1;
      const xlo = Math.min(D.lo, a);
      const xhi = Math.max(D.hi, b);
      const xx = U.linspace(xlo, xhi, 300);
      const L = [];
      const jit = y.map((_, i) => 0.06 + 0.05 * (i % 3));
      if (s.loss === 'mse') L.push({ type: 'line', x: xx, y: xx.map((t) => normPdf(t, c, sd)), color: 'tree', width: 2, label: 'N(c, σ²)' });
      else if (s.loss === 'mae') {
        const bb = U.mean(y.map((v) => Math.abs(v - U.median(y)))) || 1;
        L.push({ type: 'line', x: xx, y: xx.map((t) => Math.exp(-Math.abs(t - c) / bb) / (2 * bb)), color: 'tree', width: 2, label: 'Лаплас вокруг c' });
      } else if (s.loss === 'q') {
        const bb = sd / 2;
        L.push({ type: 'line', x: xx, y: xx.map((t) => (s.tau * (1 - s.tau) / bb) * Math.exp(-(t >= c ? s.tau : s.tau - 1) * (t - c) / bb)), color: 'tree', width: 2, label: 'асимметричный Лаплас' });
      } else if (s.loss === 'pois') {
        const ks = U.range(Math.ceil(xhi) + 1);
        L.push({ type: 'bars', x: ks, y: ks.map((k) => poisPmf(k, c)), color: 'tree', width: 0.5, opacity: 0.6, label: 'Pois(c)' });
      } else {
        L.push({ type: 'bars', x: [0, 1], y: [1 - c, c], color: 'tree', width: 0.3, opacity: 0.6, label: 'Бернулли(c)' });
      }
      const top = Math.max(0.2, ...(L[0].y || [0.2])) * 1.15;
      L.push({ type: 'points', x: y, y: jit.map((j) => j * top), color: 'data', r: 6, label: 'данные' });
      L.push({ type: 'vline', x: c, color: 'model', width: 2, label: 'прогноз c' });
      plot.render(L, { x: [xlo - 0.5, xhi + 0.5], y: [0, top] });
      const cs = U.linspace(a, b, 400);
      const ls = cs.map(lossAt);
      const bc = best();
      plot2.render([
        { type: 'line', x: cs, y: ls, color: 'model', width: 2.2, label: NL_LOSS[s.loss].name },
        { type: 'vline', x: bc, color: 'good', dash: '4 4', width: 1.4 },
        { type: 'points', x: [c], y: [lossAt(c)], color: 'tree', r: 6 },
      ], { x: [a, b], y: yDom(ls, 0.06) });
      const med = U.median(y);
      st.set('b', f3(bc));
      st.set('l', f4(lossAt(c)));
      st.set('mm', f3(m) + ' / ' + f3(med));
      st.set('x', s.loss === 'pois' ? 'ln среднего = ' + f3(Math.log(m)) : s.loss === 'log' ? 'логит = ' + f3(Math.log(m / (1 - m))) : s.loss === 'q' ? 'квантиль ' + f2(s.tau) : '—');
      const texts = {
        mse: 'Сумма квадратов — минимум в <b>среднем</b> ' + f3(m) + '. За MSE стоит нормальный шум: далёкие точки для него почти невозможны, поэтому прогноз тянется к ним.',
        mae: 'Сумма модулей — минимум в <b>медиане</b>' + (y.length % 2 === 0 ? ': на всём отрезке между двумя средними по величине значениями потери одинаковы (график плоский), обычно берут середину ' + f3(med) : ' ' + f3(med)) + '. Шум Лапласа допускает выбросы — один далёкий y не сдвигает прогноз.',
        q: 'Квантильные потери штрафуют недопрогноз в τ/(1 − τ) = ' + f2(s.tau / (1 - s.tau)) + ' раза сильнее перепрогноза. Минимум — в τ-квантиле данных.',
        pois: 'Пуассоновские потери c − y·ln c: производная 1 − ȳ/c равна нулю при c = среднему ' + f3(m) + '. Модель бустинга предсказывает F = ln c, стартуя с ln ȳ = ' + f3(Math.log(m)) + '.',
        log: 'log-loss — минимум в доле единиц ' + f3(m) + ' (шаг 31); бустинг стартует с логита ' + f3(Math.log(m / (1 - m))) + '.',
      };
      let warn = '';
      if (s.loss === 'log' && s.data !== 'binary') warn = ' <b>Внимание:</b> log-loss рассчитан на ответы 0/1 — выберите «клиенты 0/1».';
      if (s.loss === 'pois' && (s.data === 'binary')) warn = '';
      note.innerHTML = texts[s.loss] + warn + (s.data === 'out' && (s.loss === 'mse' || s.loss === 'mae') ? ' С выбросом 21 вместо 11 среднее — 7.67, медиана — по-прежнему 5.5.' : '');
    }
    w.pythonAction(() => {
      const D = NL_DATA[s.data];
      return PY_NP + 'from scipy.optimize import minimize_scalar\n\ny = np.array([' + D.y.join(', ') + '], dtype=float)\ntau = ' + py(s.tau) + '\nlosses = {\n    "MSE": lambda c: np.mean((y - c) ** 2),\n    "MAE": lambda c: np.mean(np.abs(y - c)),\n    "квантиль": lambda c: np.mean(np.where(y >= c, tau * (y - c), (1 - tau) * (c - y))),\n    "Пуассон": lambda c: np.mean(c - y * np.log(c)),\n}\nfor name, L in losses.items():\n    lo = 1e-3 if name == "Пуассон" else y.min() - 1\n    r = minimize_scalar(L, bounds=(lo, y.max() + 1), method="bounded")\n    print(f"{name:9s}: численный минимум ≈ {r.x:.3f}, потери {r.fun:.4f}")\nprint("среднее", y.mean(), " медиана", np.median(y), " τ-квантиль", np.quantile(y, tau, method="inverted_cdf"))\nprint("у MAE минимум плоский: любое c между двумя средними по величине значениями даёт те же потери")\n';
    });
    fix();
    s.c = NL_DATA.flats.y.length ? 4 : 0;
    sc.set(posOf(s.c));
    draw();
  });

  /* ==============================================================================
   * Шаг 33. Смещение и разброс
   * ============================================================================== */
  const BV = { K: 40, n: 40, noise: 0.4 };
  const BV_GRID = U.linspace(0, 10, 101);
  const bvCache = {};
  function bvFit(model, depth, seed) {
    const d = GBC.datasets.regression1d({ kind: 'sine', n: BV.n, noise: BV.noise, seed });
    const G = BV_GRID.map((x) => [x]);
    if (model === 'tree') return new GBC.RegressionTree({ maxDepth: depth }).fit(d.X, d.y.map((v) => -v)).predict(G);
    if (model === 'bag') return new GBC.BaggingTrees({ nEstimators: 25, maxDepth: depth, seed: 1000 + seed }).fit(d.X, d.y).predict(G);
    return new GBC.GradientBoosting({ loss: 'squared', nEstimators: 50, learningRate: 0.1, maxDepth: depth }).fit(d.X, d.y).predict(G);
  }
  function bvStats(model, depth) {
    const key = model + depth;
    if (bvCache[key]) return bvCache[key];
    const P = U.range(BV.K).map((s) => bvFit(model, depth, s + 1));
    const avg = BV_GRID.map((_, j) => U.mean(P.map((p) => p[j])));
    const b2 = U.mean(BV_GRID.map((x, j) => (avg[j] - Math.sin(x)) ** 2));
    const vr = U.mean(BV_GRID.map((_, j) => U.mean(P.map((p) => (p[j] - avg[j]) ** 2))));
    bvCache[key] = { P, avg, b2, vr };
    return bvCache[key];
  }
  GBC.widget('bias-variance', (el) => {
    const s = { model: 'tree', depth: 3, curves: true };
    const w = ui.shell(el, { title: 'Смещение и разброс: 40 обучающих выборок', sub: '40 раз берём новую выборку из 40 точек y = sin x + шум (σ = 0.4) и обучаем модель. Тонкие линии — модели с разных выборок, синяя — их среднее, пунктир — истина. Смещение — расстояние от средней модели до истины, разброс — ширина «пучка».' });
    ui.select(w.controls, { label: 'Модель', value: s.model, options: [{ value: 'tree', label: 'одно дерево' }, { value: 'bag', label: 'бэггинг: 25 деревьев' }, { value: 'boost', label: 'бустинг: 50 деревьев, ν = 0.1' }], onChange: (v) => ((s.model = v), draw()) });
    ui.slider(w.controls, { label: 'Глубина деревьев', min: 1, max: 8, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    ui.toggle(w.controls, { label: 'Показать все 40 моделей', checked: s.curves, onChange: (v) => ((s.curves = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 270, x: { label: 'x', domain: [0, 10] }, y: { label: 'прогноз', domain: [-2, 2] } });
    const plot2 = new GBC.Plot(w.main, { height: 210, x: { label: 'глубина деревьев', domain: [0.6, 8.4], ticks: U.range(8, 1) }, y: { label: 'ожидаемая ошибка' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'b', label: 'смещение²' }, { key: 'v', label: 'разброс' }, { key: 'n', label: 'шум σ²' }, { key: 't', label: 'ожидаемая ошибка' }]);
    function draw() {
      const S0 = bvStats(s.model, s.depth);
      const L = [];
      if (s.curves) S0.P.forEach((p, i) => L.push({ type: 'line', x: BV_GRID, y: p, color: 'model-prev', width: 1, opacity: 0.35, hover: false, label: i === 0 ? 'модели с разных выборок' : null }));
      L.push({ type: 'line', x: BV_GRID, y: BV_GRID.map(Math.sin), color: 'truth', width: 2.2, dash: '6 4', label: 'истина sin x' });
      L.push({ type: 'line', x: BV_GRID, y: S0.avg, color: 'model', width: 2.8, label: 'средняя модель' });
      const d1 = GBC.datasets.regression1d({ kind: 'sine', n: BV.n, noise: BV.noise, seed: 1 });
      L.push({ type: 'points', x: d1.x, y: d1.y, color: 'data', r: 3.5, label: 'выборка №1' });
      plot.render(L);
      const ds = U.range(8, 1);
      const all = ds.map((d) => bvStats(s.model, d));
      const n2 = BV.noise * BV.noise;
      plot2.render([
        { type: 'line', x: ds, y: all.map((a) => a.b2), color: 'model', width: 2, label: 'смещение²' },
        { type: 'line', x: ds, y: all.map((a) => a.vr), color: 'tree', width: 2, label: 'разброс' },
        { type: 'line', x: ds, y: all.map((a) => a.b2 + a.vr + n2), color: 'ink2', width: 2.4, label: 'сумма + шум' },
        { type: 'hline', y: n2, color: 'muted', dash: '4 4', width: 1.2, label: 'шум 0.16' },
        { type: 'points', x: [s.depth], y: [S0.b2 + S0.vr + n2], color: 'ink2', r: 6 },
      ], { y: [0, Math.max(0.6, ...all.map((a) => a.b2 + a.vr + n2)) * 1.08] });
      const best = ds[U.argmax(all.map((a) => -(a.b2 + a.vr)))];
      st.set('b', f3(S0.b2));
      st.set('v', f3(S0.vr));
      st.set('n', f3(n2));
      st.set('t', f3(S0.b2 + S0.vr + n2));
      const what = { tree: 'Одно дерево', bag: 'Бэггинг 25 деревьев', boost: 'Бустинг 50 деревьев' }[s.model];
      const tips = {
        tree: 'Мелкое дерево грубо (большое смещение), глубокое повторяет шум конкретной выборки (большой разброс). Сравните с бэггингом и бустингом при той же глубине.',
        bag: 'Усреднение 25 деревьев на бутстрэп-выборках почти не меняет смещение, но заметно сужает пучок: при глубине 8 разброс 0.087 против 0.168 у одного дерева.',
        boost: 'Сумма 50 маленьких шагов описывает синусоиду даже пнями: смещение² при глубине 1 — 0.122 против 0.280 у одного пня. Но глубокие деревья в бустинге только добавляют разброс.',
      };
      note.innerHTML = what + ' глубины ' + s.depth + ': смещение² ' + f3(S0.b2) + ', разброс ' + f3(S0.vr) + ', шум 0.16 — ожидаемая ошибка на новой точке ' + f3(S0.b2 + S0.vr + n2) + '. Лучшая глубина для этой модели — ' + best + '. ' + tips[s.model];
    }
    w.pythonAction(() => {
      const mk = { tree: 'RegressionTree(max_depth=depth).fit(X, -y)', bag: 'BaggingTrees(n_estimators=25, max_depth=depth, seed=1000 + seed).fit(X, y)', boost: 'GBRegressor(n_estimators=50, learning_rate=0.1, max_depth=depth).fit(X, y)' }[s.model];
      return PY_NP + 'from gbcourse import datasets\nfrom gbcourse.boosting import GBRegressor\nfrom gbcourse.ensembles import BaggingTrees\nfrom gbcourse.tree import RegressionTree\n\ndepth = ' + s.depth + '\ngrid = np.linspace(0, 10, 101)\nP = []\nfor seed in range(1, 41):\n    X, y = datasets.regression_1d(kind="sine", n=40, noise=0.4, seed=seed)\n    model = ' + mk + '\n    P.append(model.predict(grid.reshape(-1, 1)))\nP = np.array(P)\nbias2 = ((P.mean(axis=0) - np.sin(grid)) ** 2).mean()\nvar = P.var(axis=0).mean()\nprint(f"смещение² {bias2:.4f}, разброс {var:.4f}, шум 0.16, сумма {bias2 + var + 0.16:.4f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 34. Дисперсия среднего коррелированных моделей
   * ============================================================================== */
  GBC.widget('ensemble-variance', (el) => {
    const s = { rho: 0.3, k: 10, sim: true, seed: 1 };
    const w = ui.shell(el, { title: 'Дисперсия среднего k моделей', sub: 'Ошибки моделей имеют дисперсию 1 и попарную корреляцию ρ. Кривые — формула ρ + (1 − ρ)/k для нескольких ρ; точки — симуляция: ошибка модели j = √ρ·общая + √(1 − ρ)·своя.' });
    ui.slider(w.controls, { label: 'Корреляция ошибок ρ', min: 0, max: 1, step: 0.05, value: s.rho, format: f2, onInput: (v) => ((s.rho = v), draw()) });
    ui.slider(w.controls, { label: 'Моделей k', min: 1, max: 100, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.toggle(w.controls, { label: 'Симуляция (2000 опытов)', checked: s.sim, onChange: (v) => ((s.sim = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'число моделей k', type: 'log', domain: [1, 100], ticks: [1, 2, 5, 10, 20, 50, 100] }, y: { label: 'дисперсия среднего', domain: [0, 1.05] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'формула' }, { key: 's', label: 'симуляция' }, { key: 'l', label: 'предел при k → ∞' }]);
    function simVar(rho, k, seed) {
      const rng = new GBC.RNG(seed);
      const T = 2000;
      const m = new Array(T);
      for (let t = 0; t < T; t++) {
        const c = rng.normal();
        let acc = 0;
        for (let j = 0; j < k; j++) acc += Math.sqrt(rho) * c + Math.sqrt(1 - rho) * rng.normal();
        m[t] = acc / k;
      }
      const mm = U.mean(m);
      return U.mean(m.map((v) => (v - mm) ** 2));
    }
    function draw() {
      const ks = U.range(100, 1);
      const L = [0, 0.3, 0.6].filter((r) => Math.abs(r - s.rho) > 0.02).map((r) => ({ type: 'line', x: ks, y: ks.map((k) => r + (1 - r) / k), color: 'muted', width: 1.2, dash: '4 4', label: null }));
      L.push({ type: 'line', x: ks, y: ks.map((k) => s.rho + (1 - s.rho) / k), color: 'model', width: 2.4, label: 'ρ = ' + f2(s.rho) });
      L.push({ type: 'hline', y: s.rho, color: 'tree', dash: '5 4', width: 1.4, label: 'предел ρ' });
      let sv = null;
      if (s.sim) {
        const pts = [1, 2, 5, 10, 20, 50, 100];
        const ys = pts.map((k) => simVar(s.rho, k, s.seed + k));
        L.push({ type: 'points', x: pts, y: ys, color: 'tree', r: 5, label: 'симуляция' });
        sv = simVar(s.rho, s.k, s.seed + s.k);
      }
      L.push({ type: 'points', x: [s.k], y: [s.rho + (1 - s.rho) / s.k], color: 'model', r: 6.5 });
      plot.render(L);
      const f = s.rho + (1 - s.rho) / s.k;
      st.set('f', f4(f));
      st.set('s', sv === null ? '—' : f4(sv));
      st.set('l', f2(s.rho));
      note.innerHTML = 'k = ' + s.k + ', ρ = ' + f2(s.rho) + ': дисперсия среднего ' + f4(f) + ' от дисперсии одной модели. Независимая часть (1 − ρ)/k = ' + f4((1 - s.rho) / s.k) + ' гасится, общая ρ = ' + f2(s.rho) + ' остаётся. ' + (s.rho > 0 && (1 - s.rho) / s.k < 0.1 * s.rho ? 'Модели добавлять уже почти бесполезно — полезно уменьшать корреляцию (случайные признаки в лесу, подвыборки в бустинге).' : 'Добавление моделей ещё заметно помогает.');
    }
    w.pythonAction(() => PY_RNG + 'import numpy as np\n\nrho, k, T = ' + py(s.rho) + ', ' + s.k + ', 2000\nrng = Mulberry32(' + (s.seed + s.k) + ')\nm = np.empty(T)\nfor t in range(T):\n    c = rng.normal()\n    m[t] = np.mean([np.sqrt(rho) * c + np.sqrt(1 - rho) * rng.normal() for _ in range(k)])\nprint("симуляция:", m.var().round(4), " формула ρ + (1 − ρ)/k =", rho + (1 - rho) / k)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 34. Бутстрэп и out-of-bag
   * ============================================================================== */
  GBC.widget('bootstrap-oob', (el) => {
    const s = { n: 20, seed: 1 };
    const w = ui.shell(el, { title: 'Бутстрэп: кто не попал в выборку', sub: 'Выбираем n раз с возвращением из n объектов. Клетка — объект, число — сколько раз он попал в бутстрэп-выборку; пустые (серые) — out-of-bag. Внизу — доля OOB в зависимости от n: точная формула (1 − 1/n)ⁿ и предел 1/e.' });
    ui.slider(w.controls, { label: 'Объектов n', values: [5, 10, 20, 30, 50, 100, 200, 500, 1000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Новая бутстрэп-выборка', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const box = H('div', { style: 'display:flex;flex-wrap:wrap;gap:3px;justify-content:center;margin:4px 0 10px' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'n (лог.)', type: 'log', domain: [2, 1000], ticks: [2, 10, 100, 1000] }, y: { label: 'доля out-of-bag', domain: [0.2, 0.42] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'o', label: 'OOB в этой выборке' }, { key: 't', label: '(1 − 1/n)ⁿ' }, { key: 'm', label: 'среднее по 200 выборкам' }, { key: 'e', label: '1/e' }]);
    function draw() {
      const n = s.n;
      const rng = new GBC.RNG(s.seed);
      const cnt = new Array(n).fill(0);
      for (const i of rng.bootstrap(n)) cnt[i]++;
      box.textContent = '';
      const show = Math.min(n, 200);
      const sz = n <= 30 ? 30 : n <= 100 ? 22 : 14;
      for (let i = 0; i < show; i++) {
        const c = cnt[i];
        box.appendChild(H('span', { title: 'объект ' + (i + 1) + ': ' + c, style: 'display:inline-flex;align-items:center;justify-content:center;width:' + sz + 'px;height:' + sz + 'px;border-radius:5px;font-size:' + (sz > 20 ? 12 : 9) + 'px;font-weight:650;' + (c ? 'background:rgba(' + GBC.colors.rgb('model').map(Math.round).join(',') + ',' + Math.min(0.95, 0.25 + 0.25 * c) + ');color:' + (c > 1 ? 'var(--surface)' : 'var(--ink)') : 'background:var(--surface-2);color:var(--muted);border:1px dashed var(--border-strong)') }, sz > 13 ? String(c) : ''));
      }
      if (n > show) box.appendChild(H('span', { class: 'widget-note', style: 'width:100%;text-align:center;margin:0' }, 'показаны первые 200 из ' + n));
      const oob = cnt.filter((c) => c === 0).length / n;
      let acc = 0;
      const r2 = new GBC.RNG(1000 + n);
      for (let b = 0; b < 200; b++) {
        const c2 = new Array(n).fill(0);
        for (const i of r2.bootstrap(n)) c2[i]++;
        acc += c2.filter((c) => c === 0).length / n;
      }
      const ns = U.range(999, 2);
      plot.render([
        { type: 'line', x: ns, y: ns.map((k) => Math.pow(1 - 1 / k, k)), color: 'model', width: 2.2, label: '(1 − 1/n)ⁿ' },
        { type: 'hline', y: 1 / Math.E, color: 'tree', dash: '5 4', width: 1.4, label: '1/e ≈ 0.368' },
        { type: 'points', x: [n], y: [oob], color: 'tree', r: 6, label: 'эта выборка' },
      ]);
      st.set('o', f3(oob) + ' (' + cnt.filter((c) => c === 0).length + ' из ' + n + ')');
      st.set('t', f4(Math.pow(1 - 1 / n, n)));
      st.set('m', f4(acc / 200));
      st.set('e', f4(1 / Math.E));
      note.innerHTML = 'В этой выборке ' + cnt.filter((c) => c === 0).length + ' из ' + n + ' объектов не попали ни разу, а некоторые попали ' + Math.max(...cnt) + ' раза. В среднем доля OOB — (1 − 1/n)ⁿ = ' + f4(Math.pow(1 - 1 / n, n)) + ' → 1/e ≈ 0.368. Дерево бэггинга, обученное на этой выборке, «не видело» OOB-объекты — на них его можно честно проверить без отдельной валидации.';
    }
    w.pythonAction(() => PY_RNG + 'import numpy as np\n\nn = ' + s.n + '\nrng = Mulberry32(' + s.seed + ')\ncounts = np.bincount(rng.bootstrap(n), minlength=n)\nprint("сколько раз попал каждый объект:", counts)\nprint("доля out-of-bag:", (counts == 0).mean(), " теория (1 − 1/n)ⁿ =", round((1 - 1 / n) ** n, 4), " 1/e =", round(np.exp(-1), 4))\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр: задачи со случайными числами
   * ============================================================================== */
  const CATS = { all: 'все разделы', b1: 'язык вероятностей', b2: 'условная вероятность', b3: 'дискретные величины', b4: 'непрерывные', b5: 'предельные теоремы', b6: 'машинное обучение' };
  const fx = (v, d = 3) => U.fmt(v, d);
  /** Генераторы задач: (rng) → {c, q, right, wrong: [...], why}. */
  const GEN = [
    (r) => {
      const sums = [4, 5, 6, 8, 9, 10];
      const t = sums[r.randint(sums.length)];
      const ways = 6 - Math.abs(t - 7);
      return { c: 'b1', q: 'Два кубика. P(сумма = ' + t + ') =', right: frac(ways, 36), wrong: [frac(ways + 1, 36), '1/11', frac(1, t)], why: 'Упорядоченных пар с суммой ' + t + ': ' + ways + ' из 36.' };
    },
    (r) => {
      const n = 2 + r.randint(4);
      const v = 1 - Math.pow(5 / 6, n);
      return { c: 'b1', q: 'Хотя бы одна шестёрка в ' + n + ' бросках кубика — вероятность', right: fx(v), wrong: [fx(n / 6), fx(Math.pow(1 / 6, n), 4), fx(Math.pow(5 / 6, n))], why: '1 − (5/6)^' + n + ' — через дополнение.' };
    },
    (r) => {
      const a = (3 + r.randint(5)) / 10;
      const b = (2 + r.randint(4)) / 10;
      const i = Math.round(Math.min(a, b) * 10 * (0.2 + 0.5 * r.random())) / 10;
      return { c: 'b1', q: 'P(A) = ' + a + ', P(B) = ' + b + ', P(A ∩ B) = ' + i + '. P(A ∪ B) =', right: fx(a + b - i, 2), wrong: [fx(a + b, 2), fx(a * b, 2), fx(1 - i, 2)], why: 'Формула сложения: ' + a + ' + ' + b + ' − ' + i + '.' };
    },
    (r) => {
      const n1 = 200 + 100 * r.randint(5);
      const a = Math.round(n1 * (0.2 + 0.1 * r.randint(3)));
      const c = Math.round((1000 - n1) * 0.05);
      return { c: 'b2', q: '1000 клиентов: на месячном тарифе ' + n1 + ', из них ушли ' + a + '; среди остальных ушли ' + c + '. P(месячный | ушёл) =', right: fx(a / (a + c)), wrong: [fx(a / n1), fx((a + c) / 1000), fx(a / 1000)], why: 'Мир сужается до ушедших: ' + a + '/' + (a + c) + '.' };
    },
    (r) => {
      const prev = [0.001, 0.005, 0.01, 0.02, 0.05][r.randint(5)];
      const sens = 0.9 + 0.01 * r.randint(10);
      const fpr = [0.01, 0.02, 0.05, 0.1][r.randint(4)];
      const post = (prev * sens) / (prev * sens + (1 - prev) * fpr);
      return { c: 'b2', q: 'Доля больных ' + U.fmt(100 * prev, 1) + ' %, тест находит ' + Math.round(100 * sens) + ' % больных и даёт ' + Math.round(100 * fpr) + ' % ложных тревог у здоровых. P(болен | +) ≈', right: fx(post), wrong: [fx(sens, 2), fx(1 - fpr, 2), fx(prev * sens, 4)], why: 'Байес: ' + prev + '·' + sens + ' / (' + prev + '·' + sens + ' + ' + fx(1 - prev) + '·' + fpr + ').' };
    },
    (r) => {
      const o = [0.25, 0.5, 1, 2][r.randint(4)];
      const lr = [2, 4, 5, 10][r.randint(4)];
      const po = o * lr;
      return { c: 'b2', q: 'Шансы гипотезы до наблюдения ' + o + ', отношение правдоподобий ' + lr + '. Вероятность после —', right: fx(po / (1 + po)), wrong: [fx(po), fx(o / (1 + o)), fx(Math.min(0.99, o * lr / 10))], why: 'Шансы после = ' + o + '·' + lr + ' = ' + po + ', вероятность = ' + po + '/(1 + ' + po + ').' };
    },
    () => ({ c: 'b2', q: 'A и B несовместны, P(A) = 0.3, P(B) = 0.5. Они', right: 'зависимы', wrong: ['независимы', 'независимы, если P(A) < P(B)', 'ничего нельзя сказать'], why: 'P(A ∩ B) = 0 ≠ 0.15.' }),
    (r) => {
      const ps = [[0.2, 0.5, 0.3], [0.1, 0.6, 0.3], [0.5, 0.25, 0.25], [0.3, 0.3, 0.4]][r.randint(4)];
      const xs = [1, 2, 4];
      const e = U.sum(xs.map((x, i) => x * ps[i]));
      return { c: 'b3', q: 'X принимает значения 1, 2, 4 с вероятностями ' + ps.join(', ') + '. E X =', right: fx(e, 2), wrong: [fx(7 / 3, 2), fx(e + 0.5, 2), fx(U.sum(xs.map((x, i) => x * x * ps[i])), 2)], why: 'Σ x·p = ' + xs.map((x, i) => x + '·' + ps[i]).join(' + ') + '.' };
    },
    (r) => {
      const a = 2 + r.randint(3);
      const b = 1 + r.randint(9);
      const v = [1, 2, 4][r.randint(3)];
      return { c: 'b3', q: 'Var X = ' + v + '. Var(' + a + 'X + ' + b + ') =', right: String(a * a * v), wrong: [String(a * v), String(a * a * v + b), String(a * v + b)], why: 'Сдвиг не влияет, множитель — в квадрате: ' + a + '²·' + v + '.' };
    },
    (r) => {
      const n = 4 + r.randint(5);
      const k = 1 + r.randint(n - 1);
      const p = [0.2, 0.3, 0.5][r.randint(3)];
      const v = binomPmf(k, n, p);
      return { c: 'b3', q: 'Bin(n = ' + n + ', p = ' + p + '). P(X = ' + k + ') ≈', right: fx(v, 4), wrong: [fx(Math.pow(p, k), 4), fx(binomPmf(k, n, p) / L0.comb(n, k), 4), fx(k / n, 4)], why: 'C(' + n + ', ' + k + ')·' + p + '^' + k + '·' + fx(1 - p, 1) + '^' + (n - k) + ' = ' + L0.comb(n, k) + '·…' };
    },
    (r) => {
      const p = [0.1, 0.2, 0.25, 0.5][r.randint(4)];
      return { c: 'b3', q: 'Успех в каждой попытке с вероятностью ' + p + '. Уже было 5 неудач. Сколько ещё попыток в среднем до первого успеха?', right: fx(1 / p, 2), wrong: [fx(1 / p - 5, 2), fx(1 / p + 5, 2), '1'], why: 'Геометрическое распределение не помнит прошлого: 1/p.' };
    },
    (r) => {
      const lam = [1, 2, 3][r.randint(3)];
      return { c: 'b3', q: 'В среднем ' + lam + ' события в час (Пуассон). P(ни одного за час) ≈', right: fx(Math.exp(-lam)), wrong: [fx(1 / (lam + 1)), fx(1 - Math.exp(-lam)), '0'], why: 'P(0) = e<sup>−λ</sup> = e<sup>−' + lam + '</sup>.' };
    },
    (r) => {
      const k = 1 + r.randint(3);
      const v = { 1: 0.683, 2: 0.954, 3: 0.997 }[k];
      return { c: 'b4', q: 'Для нормальной величины P(|X − μ| < ' + k + 'σ) ≈', right: fx(v), wrong: [fx({ 1: 0.5, 2: 0.75, 3: 0.889 }[k]), fx({ 1: 0.954, 2: 0.997, 3: 0.683 }[k]), fx({ 1: 0.341, 2: 0.477, 3: 0.499 }[k])], why: 'Правило 68–95–99.7.' };
    },
    (r) => {
      const mu = 160 + 5 * r.randint(4);
      const sd = [5, 8, 10][r.randint(3)];
      const z = [1, 2][r.randint(2)];
      return { c: 'b4', q: 'Рост ~ N(' + mu + ', ' + sd + '²). Доля выше ' + (mu + z * sd) + ' см ≈', right: fx(1 - normCdf(z)), wrong: [fx(normCdf(z)), fx(2 * (1 - normCdf(z))), fx(1 / (z + 1))], why: 'z = ' + z + ', P(Z > ' + z + ') = 1 − Φ(' + z + ').' };
    },
    (r) => {
      const lam = [0.5, 1, 2][r.randint(3)];
      return { c: 'b4', q: 'Время ожидания экспоненциально со средним ' + fx(1 / lam, 2) + '. Медиана —', right: fx(Math.log(2) / lam), wrong: [fx(1 / lam), fx(0.5 / lam), fx(Math.LN2 * lam)], why: '1 − e<sup>−λm</sup> = ½ ⇒ m = ln 2/λ — меньше среднего.' };
    },
    (r) => {
      const n = [4, 9, 16, 25, 100][r.randint(5)];
      const sd = [2, 3, 6][r.randint(3)];
      return { c: 'b5', q: 'σ одного значения = ' + sd + '. Стандартная ошибка среднего ' + n + ' независимых значений —', right: fx(sd / Math.sqrt(n)), wrong: [fx(sd / n), fx(sd * sd / n), fx(sd)], why: 'σ/√n = ' + sd + '/' + Math.sqrt(n) + '.' };
    },
    (r) => {
      const rho = [0.5, 0.8, -0.5][r.randint(3)];
      return { c: 'b5', q: 'Var X = Var Y = 1, корреляция ' + rho + '. Var(X + Y) =', right: fx(2 + 2 * rho, 2), wrong: ['2', fx(1 + rho, 2), fx(2 - 2 * rho, 2)], why: 'Var X + Var Y + 2Cov = 2 + 2·' + rho + '.' };
    },
    () => ({ c: 'b5', q: 'Почему среднее значений распределения Коши не сходится?', right: 'у него нет ожидания (тяжёлые хвосты)', wrong: ['мало значений', 'генератор плохой', 'оно сходится к 0 быстро'], why: '∫|x|p(x)dx = ∞ — закон больших чисел неприменим.' }),
    (r) => {
      const a = 0.9;
      const b = [0.5, 0.8][r.randint(2)];
      const pi = (1 - b) / (1 - a + 1 - b);
      void pi;
      const ps = b / (1 - a + b);
      return { c: 'b5', q: 'Цепь: P(солнце → солнце) = ' + a + ', P(дождь → солнце) = ' + b + '. Доля солнечных дней в долгой перспективе —', right: fx(ps), wrong: [fx(a), fx((a + b) / 2), fx(1 - ps)], why: 'Из π = πP: π_с = P(д → с)/(P(с → д) + P(д → с)) = ' + b + '/(0.1 + ' + b + ').' };
    },
    (r) => {
      const k = 2 + r.randint(7);
      const n = 10;
      return { c: 'b6', q: 'В выборке ' + k + ' единиц из ' + n + '. Стартовая константа бустинга (логит) F₀ =', right: fx(Math.log(k / (n - k))), wrong: [fx(k / n), fx(Math.log(k / n)), fx(k / (n - k))], why: 'Минимум log-loss при p = k/n; логит ln(p/(1 − p)).' };
    },
    (r) => {
      const rho = [0.1, 0.2, 0.5][r.randint(3)];
      const k = [10, 20, 50][r.randint(3)];
      return { c: 'b6', q: 'k = ' + k + ' деревьев, дисперсия ошибки каждого 1, корреляция ' + rho + '. Дисперсия среднего —', right: fx(rho + (1 - rho) / k), wrong: [fx(1 / k), fx(rho), fx((1 - rho) / k)], why: 'ρ + (1 − ρ)/k.' };
    },
    () => ({ c: 'b6', q: 'Какую константу выбирает MAE?', right: 'медиану', wrong: ['среднее', 'моду', 'квантиль 0.9'], why: 'За MAE стоит шум Лапласа; минимум суммы модулей — медиана.' }),
    () => ({ c: 'b6', q: 'Бэггинг глубоких деревьев в первую очередь уменьшает…', right: 'разброс', wrong: ['смещение', 'шум', 'число признаков'], why: 'Усреднение гасит независимую часть ошибок.' }),
    () => ({ c: 'b6', q: 'Модель выдаёт 0.7 для 1000 объектов, единиц среди них 520. Модель…', right: 'самоуверенна: завышает вероятность', wrong: ['откалибрована', 'робка: занижает вероятность', 'ничего нельзя сказать'], why: 'Доля 0.52 < прогноза 0.7.' }),
  ];
  GBC.widget('prob-game', (el) => {
    const s = { cat: 'all', round: 0, right: 0, done: 0, streak: 0, picked: null, Q: null };
    const w = ui.shell(el, { title: 'Тренажёр: теория вероятностей', sub: 'Задачи генерируются со случайными числами по всем шести блокам урока. Решите на бумаге, затем выберите ответ.' });
    ui.select(w.controls, { label: 'Раздел', value: s.cat, options: Object.entries(CATS).map(([k, v]) => ({ value: k, label: v })), onChange: (v) => ((s.cat = v), newQ()) });
    const next = ui.button(w.controls, { label: 'Следующая', icon: 'step', onClick: () => newQ() });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.08rem;padding:6px 0 12px' });
    w.main.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));gap:8px' });
    w.main.appendChild(optsBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'задача' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function newQ() {
      s.round++;
      const pool = GEN.map((g, i) => i);
      const rng = new GBC.RNG(7919 * s.round + 17);
      let Q;
      for (let tries = 0; tries < 200; tries++) {
        Q = GEN[pool[rng.randint(pool.length)]](rng);
        if (s.cat === 'all' || Q.c === s.cat) break;
      }
      const opts = [Q.right, ...Q.wrong.filter((x) => x !== Q.right)];
      const uniq = Array.from(new Set(opts)).slice(0, 4);
      const order = rng.permutation(uniq.length);
      s.Q = { q: Q.q, opts: order.map((i) => uniq[i]), a: order.indexOf(0), why: Q.why, c: Q.c };
      s.picked = null;
      draw();
    }
    function draw() {
      const Q = s.Q;
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
      st.set('r', s.round + ' (' + CATS[Q.c] + ')');
      st.set('ok', s.right + ' из ' + s.done);
      st.set('s', String(s.streak));
      note.innerHTML = s.picked === null ? 'Подсказка: «хотя бы один» — через дополнение; в Байесе помогают натуральные частоты.' : (s.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет.</b> ') + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), s.picked === null ? 'Пропустить' : 'Следующая');
    }
    newQ();
  });

  void f1;
  void texInto;
  void texEl;
  void card;
  void cardGrid;
  void rowTable;
  void LF;
  void R;
})();
