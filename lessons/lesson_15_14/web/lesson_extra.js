/* Урок 15.14: математическая статистика. Часть 2 — проверка гипотез, множественные сравнения,
 * статистика в машинном обучении.
 * Виджеты: честна ли монета (точный биномиальный критерий); ошибки I и II рода и мощность; t-критерии
 * (Уэлч и парный); перестановочный тест; распределение p-значений и подглядывание; значимость против
 * важности; критерий χ²; Манн — Уитни и AUC; поправки на множественность (Бонферрони, Холм, BH);
 * проклятие победителя; регрессия к среднему; стандартная ошибка метрики на тесте; критерий Мак-Немара;
 * повторная кросс-валидация с поправкой Надо — Бенжио; переобучение под публичный лидерборд; лучшее
 * разбиение на шуме; сжатие значений листьев; сдвиг данных (Колмогоров — Смирнов, PSI); тренажёр.
 * Помощники — из GBC.lesson1514 (lesson.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const L0 = GBC.lesson1514;
  const { f1, f2, f3, f4, py, pf, pct, plural, yDom, normPdf, normCdf, normSf, normPpf, tP2, tPpf, chi2Pdf, chi2Sf, chi2Ppf, binomPmf, binomPmfAll, binomCdf, kolmogorovSf, mean, variance, sd, median, quantile, ranks, hist, ecdfLine, card, cardGrid, badge, rowTable, PY_NP, PY_RNG, PY_ST } = L0;

  /** Двусторонний t-критерий Уэлча: {t, df, p, diff, se}. */
  function welch(a, b) {
    const va = variance(a) / a.length;
    const vb = variance(b) / b.length;
    const se = Math.sqrt(va + vb);
    const t = (mean(a) - mean(b)) / se;
    const df = (va + vb) ** 2 / (va * va / (a.length - 1) + vb * vb / (b.length - 1));
    return { t, df, p: tP2(t, df), diff: mean(a) - mean(b), se };
  }
  /** Одновыборочный t-критерий против нуля: {t, df, p, m, se}. */
  function tOne(d) {
    const se = sd(d) / Math.sqrt(d.length);
    const t = mean(d) / se;
    return { t, df: d.length - 1, p: tP2(t, d.length - 1), m: mean(d), se };
  }
  /** AUC = доля пар (позитив, негатив), где позитив выше (ничьи — пополам). */
  function aucOf(pos, neg) {
    const all = pos.concat(neg);
    const r = ranks(all);
    let s = 0;
    for (let i = 0; i < pos.length; i++) s += r[i];
    return (s - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
  }
  /** Ожидаемый максимум k независимых N(0, 1) (численное интегрирование). */
  function expMaxNormal(k) {
    if (k === 1) return 0;
    let s = 0;
    const h = 0.002;
    for (let x = -8; x <= 8; x += h) s += x * k * normPdf(x) * Math.pow(normCdf(x), k - 1) * h;
    return s;
  }

  /* ==============================================================================
   * Шаг 18. Логика проверки: честна ли монета?
   * ============================================================================== */
  GBC.widget('coin-test', (el) => {
    const s = { n: 100, k: 60, alt: 'two' };
    const w = ui.shell(el, { title: 'Честна ли монета?', sub: 'Нулевая гипотеза H₀: монета честная, p = ½. Если H₀ верна, число орлов в n бросках имеет распределение Bin(n, ½) — это нулевое распределение. p-значение — вероятность (при H₀) получить результат не менее «странный», чем наш: сумма красных столбиков.' });
    ui.slider(w.controls, { label: 'Бросков n', values: [10, 20, 50, 100, 200, 500, 1000], value: s.n, format: String, onInput: (v) => { s.k = Math.round((s.k / s.n) * v); s.n = v; ks.setMax(v); ks.set(s.k); draw(); } });
    const ks = ui.slider(w.controls, { label: 'Выпало орлов k', min: 0, max: s.n, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.segmented(w.controls, { label: 'Альтернатива H₁', value: s.alt, options: [{ value: 'two', label: 'p ≠ ½' }, { value: 'greater', label: 'p > ½' }, { value: 'less', label: 'p < ½' }], onChange: (v) => ((s.alt = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'число орлов при честной монете' }, y: { label: 'вероятность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sh', label: 'доля орлов' }, { key: 'p', label: 'p-значение (точно)' }, { key: 'pn', label: 'нормальное приближение' }, { key: 'dec', label: 'вывод при α = 0.05' }]);
    const extreme = (i) => (s.alt === 'two' ? Math.abs(i - s.n / 2) >= Math.abs(s.k - s.n / 2) - 1e-9 : s.alt === 'greater' ? i >= s.k : i <= s.k);
    function draw() {
      const { n, k } = s;
      const pmf = binomPmfAll(n, 0.5);
      let p = 0;
      for (let i = 0; i <= n; i++) if (extreme(i)) p += pmf[i];
      p = Math.min(1, p);
      const sdv = Math.sqrt(n) / 2;
      const dev = Math.abs(k - n / 2);
      const pn = s.alt === 'two' ? Math.min(1, 2 * normSf((dev - 0.5) / sdv)) : s.alt === 'greater' ? normSf((k - 0.5 - n / 2) / sdv) : normCdf((k + 0.5 - n / 2) / sdv);
      let lo = Math.max(0, Math.floor(n / 2 - 5 * sdv));
      let hi = Math.min(n, Math.ceil(n / 2 + 5 * sdv));
      lo = Math.min(lo, k);
      hi = Math.max(hi, k);
      const xs = U.range(hi - lo + 1, lo);
      plot.render([
        { type: 'bars', x: xs, y: xs.map((i) => pmf[i]), color: (j) => (extreme(xs[j]) ? 'pos' : 'data'), legendColor: 'data', width: 0.9, maxPx: 24, opacity: 0.85, tooltip: (j) => ['k = ' + xs[j], 'P = ' + pf(pmf[xs[j]])] },
        { type: 'vline', x: k, color: 'ink', width: 1.8, text: 'наблюдали ' + k },
        { type: 'vline', x: n / 2, color: 'ink2', dash: '5 4', width: 1 },
      ], { x: [lo - 0.8, hi + 0.8] });
      st.set('sh', f3(k / n));
      st.set('p', pf(p));
      st.set('pn', pf(pn));
      st.set('dec', p < 0.05 ? 'отвергаем H₀' : 'нет оснований отвергнуть H₀');
      note.innerHTML = 'Если монета честная, ' + k + ' или ещё более ' + (s.alt === 'two' ? 'далёкое от ' + n / 2 + ' число орлов (в любую сторону)' : s.alt === 'greater' ? 'большое число орлов' : 'малое число орлов') + ' выпадает с вероятностью <b>' + pf(p) + '</b>. ' + (p < 0.05 ? 'Это редко (меньше α = 0.05) — отвергаем H₀: монета, похоже, нечестная. ' : 'Такое случается нередко — данных недостаточно, чтобы обвинить монету. Это <b>не доказывает</b>, что она честная. ') + (s.alt === 'two' ? 'Двусторонний критерий считает «странными» оба хвоста; односторонний (если заранее известно направление) — один, и его p вдвое меньше.' : 'Односторонняя альтернатива допустима, только если направление выбрано <b>до</b> того, как увидели данные.');
    }
    w.pythonAction(() => PY_ST + '\nres = stats.binomtest(' + s.k + ', ' + s.n + ', 0.5, alternative="' + { two: 'two-sided', greater: 'greater', less: 'less' }[s.alt] + '")\nprint("p-значение:", round(res.pvalue, 6))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 19. Ошибки I и II рода, мощность
   * ============================================================================== */
  GBC.widget('power', (el) => {
    const s = { d: 0.3, n: 50, alpha: 0.05 };
    const w = ui.shell(el, { title: 'Ошибки I и II рода и мощность', sub: 'Статистика критерия z = x̄·√n/σ. Если H₀ верна (эффекта нет), z ~ N(0, 1) — серая кривая; если эффект d (в единицах σ) есть, z ~ N(d√n, 1) — оранжевая. Красное — вероятность ложной тревоги α, синее — пропуска β, бирюзовое — мощность 1 − β.' });
    ui.slider(w.controls, { label: 'Размер эффекта d = δ/σ', min: 0, max: 1, step: 0.05, value: s.d, format: f2, onInput: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'Наблюдений n', values: [5, 10, 20, 50, 100, 200, 500], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Уровень значимости α', values: [0.001, 0.01, 0.05, 0.1], value: s.alpha, format: String, onInput: (v) => ((s.alpha = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'статистика z' }, y: { label: 'плотность', domain: [0, 0.46] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pw', label: 'мощность 1 − β' }, { key: 'b', label: 'β (пропуск)' }, { key: 'zc', label: 'критическое |z|' }, { key: 'n80', label: 'n для мощности 80 %' }]);
    function draw() {
      const delta = s.d * Math.sqrt(s.n);
      const zc = normPpf(1 - s.alpha / 2);
      const lo = -4.2;
      const hi = Math.max(4.2, delta + 4);
      const g = U.linspace(lo, hi, 500);
      const h0 = (x) => normPdf(x);
      const h1 = (x) => normPdf(x, delta);
      const seg = (a, b) => g.filter((x) => x >= a && x <= b);
      const R = seg(zc, hi);
      const Lf = seg(lo, -zc);
      const mid = seg(-zc, zc);
      const pw = normSf(zc - delta) + normCdf(-zc - delta);
      const n80 = s.d > 0 ? Math.ceil(((zc + normPpf(0.8)) / s.d) ** 2) : Infinity;
      plot.render([
        { type: 'area', x: R, y0: R.map(() => 0), y1: R.map(h1), color: 'aqua', opacity: 0.35, label: 'мощность' },
        { type: 'area', x: mid, y0: mid.map(() => 0), y1: mid.map(h1), color: 'model', opacity: 0.3, label: 'β — пропуск' },
        { type: 'area', x: R, y0: R.map(() => 0), y1: R.map(h0), color: 'pos', opacity: 0.55, label: 'α — ложная тревога' },
        { type: 'area', x: Lf, y0: Lf.map(() => 0), y1: Lf.map(h0), color: 'pos', opacity: 0.55 },
        { type: 'line', x: g, y: g.map(h0), color: 'ink2', width: 2, label: 'H₀: эффекта нет' },
        { type: 'line', x: g, y: g.map(h1), color: 'tree', width: 2.2, label: 'H₁: эффект d' },
        { type: 'vline', x: zc, color: 'ink', dash: '4 3', width: 1.2, text: '+' + f2(zc) },
        { type: 'vline', x: -zc, color: 'ink', dash: '4 3', width: 1.2 },
      ], { x: [lo, hi] });
      st.set('pw', pct(pw));
      st.set('b', pct(1 - pw));
      st.set('zc', f3(zc));
      st.set('n80', Number.isFinite(n80) ? String(n80) : '—');
      note.innerHTML = s.d === 0
        ? 'Эффекта нет: обе кривые совпадают, и единственная возможная ошибка — ложная тревога с вероятностью α = ' + s.alpha + '.'
        : 'При эффекте ' + f2(s.d) + 'σ и n = ' + s.n + ' критерий находит его с вероятностью <b>' + pct(pw) + '</b>, а в ' + pct(1 - pw) + ' случаев пропускает (ошибка II рода). Мощность растёт с размером эффекта и с n — кривая H₁ уезжает вправо как d√n. Уменьшение α (строже к ложным тревогам) неизбежно снижает мощность. Для мощности 80 % здесь нужно n = ' + n80 + ': формула n = ((z<sub>1−α/2</sub> + z<sub>0.8</sub>)/d)².';
    }
    w.pythonAction(() => 'import math\n' + PY_ST + '\nd, n, alpha = ' + py(s.d) + ', ' + s.n + ', ' + s.alpha + '\nzc = stats.norm.ppf(1 - alpha / 2)\ndelta = d * math.sqrt(n)\npower = stats.norm.sf(zc - delta) + stats.norm.cdf(-zc - delta)\nprint(f"мощность {power:.3f}; β = {1 - power:.3f}")\nif d > 0:\n    print("n для мощности 80 %:", math.ceil(((zc + stats.norm.ppf(0.8)) / d) ** 2))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 20. t-критерии: независимые и парные выборки
   * ============================================================================== */
  GBC.widget('t-tests', (el) => {
    const s = { n: 12, delta: 1, sb: 5, seed: 1 };
    const w = ui.shell(el, { title: 'Один и тот же эксперимент — два анализа', sub: 'n пользователей выполнили задачу в старом (A) и новом (B) интерфейсе. Люди сильно различаются по скорости (разброс между людьми), а новый интерфейс экономит δ секунд каждому. Сравним критерий Уэлча для независимых групп и парный t-критерий по разностям.' });
    ui.slider(w.controls, { label: 'Пользователей n', values: [5, 8, 12, 20, 40], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Выигрыш нового интерфейса δ, с', min: 0, max: 3, step: 0.25, value: s.delta, format: f2, onInput: (v) => ((s.delta = v), draw()) });
    ui.slider(w.controls, { label: 'Разброс между людьми, с', values: [0, 1, 2, 5, 10], value: s.sb, format: String, onInput: (v) => ((s.sb = v), draw()) });
    ui.button(w.controls, { label: 'Другие пользователи', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'время выполнения, с' }, y: { label: 'пользователь', ticks: [] } });
    const p2 = new GBC.Plot(w.main, { height: 150, x: { label: 'разность A − B, с' }, y: { label: '', domain: [0, 2], ticks: [] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'средняя разность' }, { key: 'w', label: 'Уэлч: t, p' }, { key: 'p', label: 'парный: t, p' }, { key: 'r', label: 'корреляция A и B' }]);
    function data() {
      const rng = new GBC.RNG(900 + 7 * s.seed + s.n);
      const a = [];
      const b = [];
      for (let i = 0; i < s.n; i++) {
        const base = 30 + s.sb * rng.normal();
        a.push(base + 1.5 * rng.normal());
        b.push(base - s.delta + 1.5 * rng.normal());
      }
      return { a, b };
    }
    function draw() {
      const { a, b } = data();
      const ys = U.range(s.n, 1);
      p1.render([
        { type: 'segments', x1: a, x2: b, y1: ys, y2: ys, color: 'muted', width: 1.6, opacity: 0.7 },
        { type: 'points', x: a, y: ys, color: 'blue', r: 5, label: 'A — старый', tooltip: (i) => ['пользователь ' + (i + 1), 'A: ' + f1(a[i]) + ' с', 'B: ' + f1(b[i]) + ' с'] },
        { type: 'points', x: b, y: ys, color: 'orange', r: 5, label: 'B — новый', tooltip: (i) => ['пользователь ' + (i + 1), 'A: ' + f1(a[i]) + ' с', 'B: ' + f1(b[i]) + ' с'] },
      ], { y: [0.3, s.n + 0.7] });
      const d = a.map((v, i) => v - b[i]);
      const W = welch(a, b);
      const P = tOne(d);
      const h = tPpf(0.975, s.n - 1) * P.se;
      const dd = yDom(d.concat([0, P.m - h, P.m + h]), 0.08);
      const rng = new GBC.RNG(5);
      p2.render([
        { type: 'vline', x: 0, color: 'ink2', dash: '5 4', width: 1.2 },
        { type: 'segments', x1: [P.m - h], x2: [P.m + h], y1: [0.55], y2: [0.55], color: 'tree', width: 5, opacity: 0.8 },
        { type: 'points', x: [P.m], y: [0.55], color: 'tree', r: 6, tooltip: () => ['средняя разность ' + f2(P.m), '95 % интервал [' + f2(P.m - h) + ', ' + f2(P.m + h) + ']'] },
        { type: 'points', x: d, y: d.map(() => 1.2 + 0.5 * rng.random()), color: 'model', r: 4.2, tooltip: (i) => ['пользователь ' + (i + 1), 'A − B = ' + f2(d[i])] },
      ], { x: dd });
      st.set('d', f2(P.m) + ' с');
      st.set('w', f2(W.t) + ', ' + pf(W.p));
      st.set('p', f2(P.t) + ', ' + pf(P.p));
      st.set('r', f2(L0.pearson(a, b)));
      note.innerHTML = 'Уэлч сравнивает две группы как чужие: разность средних ' + f2(W.diff) + ' с делится на SE = ' + f2(W.se) + ', в которую входит весь разброс между людьми, — p = ' + pf(W.p) + '. Парный критерий смотрит на разности одного человека (нижний график): индивидуальная скорость сокращается, SE = ' + f2(P.se) + ', и p = ' + pf(P.p) + '. ' + (s.sb >= 2 ? 'Когда люди различаются сильнее, чем эффект, парный план выигрывает многократно. ' : 'Без разброса между людьми выигрыш парного плана невелик. ') + 'Так же сравнивают две модели — на одних и тех же объектах (шаги 29–30).';
    }
    w.pythonAction(() => PY_NP + PY_ST + PY_RNG + '\nn, delta, sb = ' + s.n + ', ' + py(s.delta) + ', ' + s.sb + '\nrng = Mulberry32(' + (900 + 7 * s.seed + s.n) + ')\na, b = [], []\nfor _ in range(n):\n    base = 30 + sb * rng.normal()\n    a.append(base + 1.5 * rng.normal())\n    b.append(base - delta + 1.5 * rng.normal())\na, b = np.array(a), np.array(b)\nprint("Уэлч:  ", stats.ttest_ind(a, b, equal_var=False))\nprint("парный:", stats.ttest_rel(a, b))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 21. Перестановочный тест
   * ============================================================================== */
  GBC.widget('permutation-test', (el) => {
    const s = { mode: 'groups', delta: 0.8, n: 12, seed: 1, shown: 0 };
    const w = ui.shell(el, { title: 'Перестановочный тест: перемешай и посмотри', sub: 'Если H₀ верна, метки групп ничего не значат: перемешав их, мы получим «такой же» мир. Разность средних по 5000 перемешиваниям — нулевое распределение, построенное из самих данных, без предположений о нормальности.' });
    ui.segmented(w.controls, { label: 'План', value: s.mode, options: [{ value: 'groups', label: 'две группы' }, { value: 'paired', label: 'пары (знаки)' }], onChange: (v) => ((s.mode = v), (s.shown = 0), draw()) });
    ui.slider(w.controls, { label: 'Истинный эффект (в σ)', min: 0, max: 2, step: 0.1, value: s.delta, format: f1, onInput: (v) => ((s.delta = v), draw()) });
    ui.slider(w.controls, { label: 'Наблюдений в группе n', values: [5, 8, 12, 20, 50], value: s.n, format: String, onInput: (v) => ((s.n = v), (s.shown = 0), draw()) });
    ui.button(w.controls, { label: 'Одно перемешивание', kind: 'primary', onClick: () => (s.shown++, draw()) });
    ui.button(w.controls, { label: 'Другие данные', onClick: () => (s.seed++, (s.shown = 0), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 170, x: { label: 'значение' }, y: { label: '', domain: [0.3, 2.7], ticks: [] } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'разность средних при перемешанных метках' }, y: { label: 'доля перемешиваний' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'o', label: 'наблюдённая разность' }, { key: 'p', label: 'p перестановочный' }, { key: 't', label: 'p t-критерия' }, { key: 'cur', label: 'это перемешивание' }]);
    function data() {
      const rng = new GBC.RNG(1200 + 11 * s.seed + s.n + (s.mode === 'paired' ? 500 : 0));
      if (s.mode === 'groups') {
        const a = U.range(s.n).map(() => rng.normal(s.delta, 1));
        const b = U.range(s.n).map(() => rng.normal(0, 1));
        return { a, b };
      }
      return { d: U.range(s.n).map(() => rng.normal(s.delta * 0.5, 1)) };
    }
    function draw() {
      const D = data();
      const r2 = new GBC.RNG(77);
      const B = 5000;
      const perm = [];
      let obs;
      let tp;
      let cur = null;
      let curLab = null;
      if (s.mode === 'groups') {
        const pool = D.a.concat(D.b);
        const n = s.n;
        obs = mean(D.a) - mean(D.b);
        for (let b = 0; b < B; b++) {
          const idx = r2.permutation(2 * n);
          let sa = 0;
          let sb = 0;
          for (let i = 0; i < n; i++) sa += pool[idx[i]];
          for (let i = n; i < 2 * n; i++) sb += pool[idx[i]];
          perm.push(sa / n - sb / n);
        }
        tp = welch(D.a, D.b).p;
        if (s.shown) {
          const idx = new GBC.RNG(5000 + s.shown).permutation(2 * n);
          curLab = new Array(2 * n);
          idx.forEach((j, i) => (curLab[j] = i < n ? 'A' : 'B'));
          let sa = 0;
          let sb = 0;
          pool.forEach((v, j) => (curLab[j] === 'A' ? (sa += v) : (sb += v)));
          cur = sa / n - sb / n;
        }
        const lab = curLab || pool.map((_, j) => (j < n ? 'A' : 'B'));
        const rr = new GBC.RNG(9);
        const jit = pool.map(() => 0.25 * (rr.random() - 0.5));
        p1.render([
          { type: 'points', x: pool, y: pool.map((_, j) => (lab[j] === 'A' ? 2 : 1) + jit[j]), color: (j) => (j < n ? 'blue' : 'orange'), legendColor: 'blue', r: 5, tooltip: (j) => ['значение ' + f2(pool[j]), 'исходная группа ' + (j < n ? 'A' : 'B'), 'сейчас в ' + lab[j]] },
          { type: 'text', items: [{ x: Math.min(...pool), y: 2.45, text: s.shown ? 'метка «A» после перемешивания' : 'группа A (синие)' }, { x: Math.min(...pool), y: 1.45, text: s.shown ? 'метка «B» после перемешивания' : 'группа B (оранжевые)' }] },
          { type: 'vline', x: mean(pool.filter((_, j) => lab[j] === 'A')), color: 'blue', width: 1.4, dash: '4 3' },
          { type: 'vline', x: mean(pool.filter((_, j) => lab[j] === 'B')), color: 'orange', width: 1.4, dash: '4 3' },
        ], { y: [0.5, 2.7] });
      } else {
        const d = D.d;
        obs = mean(d);
        for (let b = 0; b < B; b++) {
          let sum = 0;
          for (const v of d) sum += r2.random() < 0.5 ? v : -v;
          perm.push(sum / d.length);
        }
        tp = tOne(d).p;
        let signs = d.map(() => 1);
        if (s.shown) {
          const rs = new GBC.RNG(5000 + s.shown);
          signs = d.map(() => (rs.random() < 0.5 ? 1 : -1));
          cur = mean(d.map((v, i) => v * signs[i]));
        }
        const xs = d.map((v, i) => v * signs[i]);
        p1.render([
          { type: 'vline', x: 0, color: 'ink2', dash: '5 4', width: 1.2 },
          { type: 'segments', x1: d.map(() => 0), x2: xs, y1: d.map((_, i) => 0.6 + (1.8 * i) / Math.max(1, d.length - 1)), y2: d.map((_, i) => 0.6 + (1.8 * i) / Math.max(1, d.length - 1)), color: 'muted', width: 1.4, opacity: 0.6 },
          { type: 'points', x: xs, y: d.map((_, i) => 0.6 + (1.8 * i) / Math.max(1, d.length - 1)), color: (i) => (signs[i] > 0 ? 'model' : 'red'), legendColor: 'model', r: 4.5, tooltip: (i) => ['разность ' + f2(d[i]), signs[i] > 0 ? 'знак сохранён' : 'знак перевёрнут'] },
        ], { y: [0.3, 2.7] });
      }
      const c = perm.filter((v) => Math.abs(v) >= Math.abs(obs) - 1e-12).length;
      const p = (c + 1) / (B + 1);
      const [mn, mx] = U.extent(perm.concat([obs, -obs]));
      const hp = hist(perm, mn, mx + 1e-9, 50);
      p2.render([
        { type: 'bars', x: hp.x, y: hp.share, color: (i) => (Math.abs(hp.x[i]) >= Math.abs(obs) ? 'pos' : 'data'), legendColor: 'data', width: hp.w * 0.95, maxPx: 30, opacity: 0.8 },
        { type: 'vline', x: obs, color: 'ink', width: 2, text: 'наблюдали' },
        { type: 'vline', x: -obs, color: 'ink2', width: 1, dash: '3 3' },
        cur !== null ? { type: 'vline', x: cur, color: 'aqua', width: 2.2, text: 'это перемешивание' } : null,
      ]);
      st.set('o', f3(obs));
      st.set('p', pf(p));
      st.set('t', pf(tp));
      st.set('cur', cur !== null ? f3(cur) : '—');
      note.innerHTML = (s.mode === 'groups' ? 'Перемешиваем метки A/B у всех ' + 2 * s.n + ' значений и пересчитываем разность средних. ' : 'В парном плане перемешать — значит случайно перевернуть знак каждой разности: при H₀ «A лучше» и «B лучше» равновероятны. ') + 'Доля перемешиваний, давших разность не меньше наблюдённой по модулю (красные столбики), и есть p-значение: ' + pf(p) + '. Оно почти совпадает с p t-критерия (' + pf(tp) + '), но не требует нормальности и работает для любой статистики — медианы, AUC, разности MSE. Нажимайте «Одно перемешивание»: каждое даёт одну точку нулевого распределения.';
    }
    w.pythonAction(() => {
      const head = PY_NP + PY_ST + PY_RNG + '\nn, delta = ' + s.n + ', ' + py(s.delta) + '\nrng = Mulberry32(' + (1200 + 11 * s.seed + s.n + (s.mode === 'paired' ? 500 : 0)) + ')\n';
      return s.mode === 'groups'
        ? head + 'a = np.array([rng.normal(delta, 1) for _ in range(n)])\nb = np.array([rng.normal(0, 1) for _ in range(n)])\nobs = a.mean() - b.mean()\npool = np.concatenate([a, b])\nr2 = Mulberry32(77)\nperm = []\nfor _ in range(5000):\n    idx = r2.permutation(2 * n)\n    perm.append(pool[idx[:n]].mean() - pool[idx[n:]].mean())\nperm = np.array(perm)\np = (np.sum(np.abs(perm) >= abs(obs) - 1e-12) + 1) / (5000 + 1)\nprint(f"разность {obs:.3f}; перестановочное p = {p:.4f}; Уэлч p = {stats.ttest_ind(a, b, equal_var=False).pvalue:.4f}")\n# готовая функция: stats.permutation_test((a, b), lambda x, y: x.mean() - y.mean(), n_resamples=5000)\n'
        : head + 'd = np.array([rng.normal(delta * 0.5, 1) for _ in range(n)])\nr2 = Mulberry32(77)\nperm = np.array([np.mean([v if r2.random() < 0.5 else -v for v in d]) for _ in range(5000)])\np = (np.sum(np.abs(perm) >= abs(d.mean()) - 1e-12) + 1) / (5000 + 1)\nprint(f"средняя разность {d.mean():.3f}; перестановочное p = {p:.4f}; t-критерий p = {stats.ttest_1samp(d, 0).pvalue:.4f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 22. p-значение под микроскопом: распределение и подглядывание
   * ============================================================================== */
  GBC.widget('p-dist', (el) => {
    const s = { d: 0, n: 100, mode: 'fixed' };
    const w = ui.shell(el, { title: 'Как распределено p-значение', sub: '2000 экспериментов: n наблюдений из N(d, 1), критерий H₀: μ = 0. Гистограмма p-значений. В режиме «подглядывание» экспериментатор проверяет p после каждых 10 наблюдений и останавливается, как только p < 0.05.' });
    ui.slider(w.controls, { label: 'Истинный эффект d', values: [0, 0.1, 0.2, 0.3, 0.5], value: s.d, format: String, onInput: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'Наблюдений n (максимум)', values: [20, 50, 100, 200, 500], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.segmented(w.controls, { label: 'Как проверяем', value: s.mode, options: [{ value: 'fixed', label: 'один раз в конце' }, { value: 'peek', label: 'подглядывание' }], onChange: (v) => ((s.mode = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'p-значение', domain: [0, 1] }, y: { label: 'плотность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'доля p < 0.05' }, { key: 'b', label: 'доля p < 0.01' }, { key: 'm', label: 'медиана p' }, { key: 'k', label: 'среднее число наблюдений' }]);
    const cache = {};
    function run() {
      const key = s.d + '|' + s.n + '|' + s.mode;
      if (cache[key]) return cache[key];
      const rng = new GBC.RNG(1300 + Math.round(s.d * 100) * 31 + s.n);
      const ps = [];
      let used = 0;
      for (let e = 0; e < 2000; e++) {
        let sum = 0;
        let p = 1;
        let k = 0;
        for (let i = 1; i <= s.n; i++) {
          sum += rng.normal(s.d, 1);
          if (s.mode === 'peek' && i % 10 === 0) {
            p = 2 * normSf(Math.abs(sum) / Math.sqrt(i));
            k = i;
            if (p < 0.05) break;
          }
        }
        if (s.mode === 'fixed') {
          p = 2 * normSf(Math.abs(sum) / Math.sqrt(s.n));
          k = s.n;
        }
        ps.push(p);
        used += k;
      }
      return (cache[key] = { ps, used: used / 2000 });
    }
    function draw() {
      const { ps, used } = run();
      const h = hist(ps, 0, 1, 20);
      const lt05 = ps.filter((p) => p < 0.05).length / ps.length;
      plot.render([
        { type: 'bars', x: h.x, y: h.dens, color: (i) => (i === 0 ? 'pos' : 'model'), legendColor: 'model', width: h.w * 0.95, maxPx: 60, opacity: 0.75 },
        { type: 'hline', y: 1, color: 'ink2', dash: '5 4', width: 1.4, label: 'равномерное распределение' },
      ], { y: [0, Math.max(2, ...h.dens) * 1.1] });
      st.set('a', pct(lt05));
      st.set('b', pct(ps.filter((p) => p < 0.01).length / ps.length));
      st.set('m', f3(median(ps)));
      st.set('k', f1(used));
      if (s.d === 0 && s.mode === 'fixed') note.innerHTML = 'Если H₀ верна, p-значение распределено <b>равномерно</b> на [0, 1]: p < 0.05 случается ровно в 5 % экспериментов (' + pct(lt05) + ' здесь). Это и есть контроль ошибки I рода: значение p = 0.03 при H₀ встречается так же часто, как p = 0.83.';
      else if (s.mode === 'peek') note.innerHTML = 'Подглядывание раз за разом даёт шанс «поймать» случайный выброс статистики. При d = 0 ложные открытия случаются в <b>' + pct(lt05) + '</b> экспериментов вместо обещанных 5 %, а у гистограммы — пик у нуля, хотя эффекта нет. ' + (s.d > 0 ? 'Сейчас эффект есть, и пик у нуля частично настоящий. ' : '') + 'Правило: размер выборки фиксируют заранее, а если нужна ранняя остановка — применяют последовательные критерии с поправленными порогами. Та же ловушка — многократно смотреть на тест при подборе модели (шаг 31).';
      else note.innerHTML = 'При настоящем эффекте d = ' + s.d + ' распределение p сдвигается к нулю. Доля p < 0.05 — это мощность критерия: ' + pct(lt05) + ' при n = ' + s.n + '. Небольшой эффект при малом n часто даёт p = 0.2–0.5: «незначимо» не означает «эффекта нет».';
    }
    w.pythonAction(() => PY_NP + PY_ST + PY_RNG + '\nd, n, peek = ' + py(s.d) + ', ' + s.n + ', ' + (s.mode === 'peek' ? 'True' : 'False') + '\nrng = Mulberry32(' + (1300 + Math.round(s.d * 100) * 31 + s.n) + ')\nps = []\nfor _ in range(2000):\n    total, p = 0.0, 1.0\n    for i in range(1, n + 1):\n        total += rng.normal(d, 1)\n        if peek and i % 10 == 0:\n            p = 2 * stats.norm.sf(abs(total) / np.sqrt(i))\n            if p < 0.05:\n                break\n    if not peek:\n        p = 2 * stats.norm.sf(abs(total) / np.sqrt(n))\n    ps.append(p)\nps = np.array(ps)\nprint(f"доля p < 0.05: {np.mean(ps < 0.05):.1%};  медиана p: {np.median(ps):.3f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 23. Значимость против важности
   * ============================================================================== */
  const EV_NS = [200, 1000, 5000, 20000, 100000, 500000];
  GBC.widget('effect-vs-p', (el) => {
    const s = { delta: 0.004, margin: 0.01, seed: 1 };
    const w = ui.shell(el, { title: 'Значимо ≠ важно', sub: 'Новая модель на самом деле точнее старой на δ (точность около 0.85). Измеряем разность на тестах разного размера и строим 95 %-е интервалы. Бирюзовая полоса — «зона практической неважности» ±порог: различие меньше порога бизнесу безразлично.' });
    ui.slider(w.controls, { label: 'Истинный выигрыш δ', values: [0, 0.002, 0.004, 0.01, 0.02, 0.04], value: s.delta, format: (v) => '+' + v, onInput: (v) => ((s.delta = v), draw()) });
    ui.slider(w.controls, { label: 'Порог важности', values: [0.002, 0.005, 0.01, 0.02], value: s.margin, format: (v) => '±' + v, onInput: (v) => ((s.margin = v), draw()) });
    ui.button(w.controls, { label: 'Новые измерения', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'измеренная разность точностей (новая − старая)' }, y: { label: 'размер теста', domain: [0.4, 6.6], ticks: [1, 2, 3, 4, 5, 6], format: (v) => (EV_NS[Math.round(v) - 1] ? 'n = ' + EV_NS[Math.round(v) - 1] : '') }, margin: { left: 92 } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const KIND = { imp: ['значимо и важно', 'good'], small: ['значимо, но мало', 'warn'], unclear: ['значимо, важность неясна', 'warn'], equiv: ['неважно (доказано)', 'neutral'], none: ['ничего не ясно', 'bad'] };
    function classify(lo, hi, m) {
      if (lo > 0 || hi < 0) {
        if (lo >= m || hi <= -m) return 'imp';
        if (lo > -m && hi < m) return 'small';
        return 'unclear';
      }
      return lo > -m && hi < m ? 'equiv' : 'none';
    }
    const KC = { imp: 'model', small: 'tree', unclear: 'tree', equiv: 'aqua', none: 'red' };
    function draw() {
      const rng = new GBC.RNG(1400 + s.seed);
      const rows = EV_NS.map((n) => {
        const se = Math.sqrt((2 * 0.85 * 0.15) / n);
        const est = s.delta + se * rng.normal();
        const lo = est - 1.96 * se;
        const hi = est + 1.96 * se;
        return { n, se, est, lo, hi, p: 2 * normSf(Math.abs(est) / se), k: classify(lo, hi, s.margin) };
      });
      const lim = Math.max(0.03, 3 * s.margin, 2 * Math.abs(s.delta));
      const L = [
        { type: 'vband', x0: -s.margin, x1: s.margin, color: 'aqua', opacity: 0.14 },
        { type: 'vline', x: 0, color: 'ink2', width: 1.2 },
        { type: 'vline', x: s.delta, color: 'tree', dash: '6 4', width: 1.4, text: 'истина' },
      ];
      rows.forEach((r, i) => {
        L.push({ type: 'segments', x1: [Math.max(-lim, r.lo)], x2: [Math.min(lim, r.hi)], y1: [i + 1], y2: [i + 1], color: KC[r.k], width: 4, opacity: 0.9 });
      });
      L.push({ type: 'points', x: rows.map((r) => r.est), y: rows.map((_, i) => i + 1), color: (i) => KC[rows[i].k], legendColor: 'model', r: 5.5, tooltip: (i) => ['n = ' + rows[i].n, 'оценка ' + f4(rows[i].est), 'интервал [' + f4(rows[i].lo) + ', ' + f4(rows[i].hi) + ']', 'p = ' + pf(rows[i].p)] });
      plot.render(L, { x: [-lim, lim] });
      tbl.textContent = '';
      const t = H('table', { class: 'data' });
      t.appendChild(H('thead', null, H('tr', null, ['размер теста', 'оценка', '95 %-й интервал', 'p', 'вывод'].map((c) => H('th', null, c)))));
      const tb = H('tbody');
      for (const r of rows) tb.appendChild(H('tr', null, H('td', { class: 'num' }, String(r.n)), H('td', { class: 'num' }, U.fmtSigned(r.est, 4)), H('td', { class: 'num', style: 'white-space:nowrap' }, '[' + U.fmtFixed(r.lo, 4) + ', ' + U.fmtFixed(r.hi, 4) + ']'), H('td', { class: 'num' }, pf(r.p)), H('td', null, badge(KIND[r.k][0], KIND[r.k][1]))));
      t.appendChild(tb);
      tbl.appendChild(H('div', { class: 'table-wrap' }, t));
      note.innerHTML = 'Интервал сужается как 1/√n. На маленьком тесте даже заметный выигрыш «незначим» — интервал шире полосы и ничего не говорит. На огромном тесте значимым становится любой выигрыш, даже ' + s.delta + ' — меньше порога важности ' + s.margin + '. Поэтому сообщают не «p < 0.05», а <b>оценку с интервалом</b> и сравнивают интервал с порогом важности. Если интервал целиком внутри полосы — доказано, что различие неважно (идея проверки эквивалентности, TOST). Интервал не содержит 0 ⇔ p < 0.05: это две стороны одного расчёта.';
    }
    w.pythonAction(() => PY_NP + PY_ST + PY_RNG + '\ndelta, margin = ' + s.delta + ', ' + s.margin + '\nrng = Mulberry32(' + (1400 + s.seed) + ')\nfor n in ' + JSON.stringify(EV_NS) + ':\n    se = np.sqrt(2 * 0.85 * 0.15 / n)\n    est = delta + se * rng.normal()\n    lo, hi = est - 1.96 * se, est + 1.96 * se\n    p = 2 * stats.norm.sf(abs(est) / se)\n    print(f"n = {n:6d}: {est:+.4f}  [{lo:+.4f}, {hi:+.4f}]  p = {p:.3g}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 24. Критерий χ²: согласие и независимость
   * ============================================================================== */
  const CHI = {
    fair: { label: 'кубик: 60 бросков (честный?)', type: 'gof', rows: ['1', '2', '3', '4', '5', '6'], O: [[9, 11, 8, 12, 10, 10]] },
    loaded: { label: 'кубик: подозрительный', type: 'gof', rows: ['1', '2', '3', '4', '5', '6'], O: [[5, 8, 9, 8, 10, 20]] },
    tariff: { label: 'тариф и отток (1000 клиентов)', type: 'ind', rows: ['месячный', 'годовой', 'двухлетний'], cols: ['ушёл', 'остался'], O: [[120, 280], [49, 301], [15, 235]] },
    ab: { label: 'A/B-тест дизайна (2000 посетителей)', type: 'ind', rows: ['дизайн A', 'дизайн B'], cols: ['купил', 'не купил'], O: [[180, 820], [205, 795]] },
  };
  GBC.widget('chi2-table', (el) => {
    const s = { set: 'tariff', scale: 1 };
    const w = ui.shell(el, { title: 'Критерий χ²: наблюдаемое против ожидаемого', sub: 'В каждой клетке — наблюдаемое число O и (в скобках) ожидаемое при H₀ число E. Цвет — вклад клетки (O − E)²/E: красный — больше ожидаемого, синий — меньше. Сумма вкладов — статистика χ².' });
    ui.select(w.controls, { label: 'Данные', value: s.set, options: Object.entries(CHI).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.set = v), draw()) });
    ui.slider(w.controls, { label: 'Масштаб выборки (те же доли)', values: [0.25, 0.5, 1, 2, 4, 10], value: s.scale, format: (v) => '×' + v, onInput: (v) => ((s.scale = v), draw()) });
    const tbl = H('div', { style: 'margin:4px 0 10px' });
    w.main.appendChild(tbl);
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'χ² при H₀' }, y: { label: 'плотность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'χ²' }, { key: 'df', label: 'степеней свободы' }, { key: 'p', label: 'p-значение' }, { key: 'v', label: 'сила связи' }]);
    function draw() {
      const D = CHI[s.set];
      const O = D.O.map((r) => r.map((v) => Math.round(v * s.scale)));
      const N = U.sum(O.flat());
      let E;
      let df;
      if (D.type === 'gof') {
        E = [O[0].map(() => N / O[0].length)];
        df = O[0].length - 1;
      } else {
        const rs = O.map((r) => U.sum(r));
        const cs = O[0].map((_, j) => U.sum(O.map((r) => r[j])));
        E = O.map((r, i) => r.map((_, j) => (rs[i] * cs[j]) / N));
        df = (O.length - 1) * (O[0].length - 1);
      }
      const contrib = O.map((r, i) => r.map((v, j) => (v - E[i][j]) ** 2 / E[i][j]));
      const chi = U.sum(contrib.flat());
      const p = chi2Sf(chi, df);
      const maxC = Math.max(1, ...contrib.flat());
      const div = GBC.colors.diverging();
      tbl.textContent = '';
      const t = H('table', { class: 'data' });
      const cell = (i, j) => {
        const sign = Math.sign(O[i][j] - E[i][j]);
        const rgb = div((sign * contrib[i][j]) / maxC);
        return H('td', { class: 'num', style: 'background:' + GBC.colors.rgbString(rgb, 0.35 + 0.4 * Math.min(1, contrib[i][j] / maxC)) + ';color:var(--ink)', title: 'вклад ' + f2(contrib[i][j]) }, H('b', null, String(O[i][j])), ' (' + f1(E[i][j]) + ')');
      };
      if (D.type === 'gof') {
        t.appendChild(H('thead', null, H('tr', null, H('th', null, 'грань'), ...D.rows.map((r) => H('th', { class: 'num' }, r)))));
        t.appendChild(H('tbody', null, H('tr', null, H('td', null, 'O (E)'), ...O[0].map((_, j) => cell(0, j)))));
      } else {
        t.appendChild(H('thead', null, H('tr', null, H('th', null, ''), ...D.cols.map((c) => H('th', { class: 'num' }, c)), H('th', { class: 'num' }, 'доля «' + D.cols[0] + '»'))));
        const tb = H('tbody');
        O.forEach((r, i) => tb.appendChild(H('tr', null, H('td', null, D.rows[i]), ...r.map((_, j) => cell(i, j)), H('td', { class: 'num' }, pct(r[0] / U.sum(r))))));
        t.appendChild(tb);
      }
      tbl.appendChild(H('div', { class: 'table-wrap' }, t));
      const xmax = Math.max(chi2Ppf(0.999, df), chi * 1.08);
      const g = U.linspace(0.02, xmax, 400);
      const tail = g.filter((x) => x >= chi);
      plot.render([
        { type: 'area', x: tail, y0: tail.map(() => 0), y1: tail.map((x) => chi2Pdf(x, df)), color: 'pos', opacity: 0.45, label: 'p-значение' },
        { type: 'line', x: g, y: g.map((x) => Math.min(chi2Pdf(x, df), 1)), color: 'ink2', width: 2, label: 'χ² с ' + df + ' ст. св.' },
        { type: 'vline', x: chi, color: 'ink', width: 2 },
        { type: 'text', items: [{ x: chi, y: Math.min(0.9, chi2Pdf(Math.max(df - 2, 0.5), df)) * 0.92, text: 'χ² = ' + f2(chi), anchor: chi > xmax * 0.7 ? 'end' : 'start', dx: chi > xmax * 0.7 ? -6 : 6 }] },
      ], { x: [0, xmax] });
      const strength = D.type === 'gof' ? Math.sqrt(chi / N) : Math.sqrt(chi / (N * (Math.min(O.length, O[0].length) - 1)));
      st.set('x', f2(chi));
      st.set('df', String(df));
      st.set('p', pf(p));
      st.set('v', (D.type === 'gof' ? 'w = ' : 'V = ') + f3(strength));
      const scaleNote = s.scale !== 1 ? ' Масштаб ×' + s.scale + ' не меняет долей и силы связи (' + f3(strength) + '), но меняет χ² пропорционально N — и p-значение: та же картина значима на большой выборке и незначима на маленькой.' : ' Сдвиньте «масштаб»: доли те же, а p меняется — значимость зависит от объёма данных, сила связи — нет.';
      note.innerHTML = (D.type === 'gof' ? 'Критерий согласия: при честном кубике каждая грань ожидается N/6 = ' + f1(N / 6) + ' раз. χ² = Σ(O − E)²/E = ' + f2(chi) + ' при ' + df + ' степенях свободы (6 граней минус одна связь: сумма равна N). ' : 'Критерий независимости: при H₀ доля «' + D.cols[0] + '» одинакова во всех строках, ожидаемое E = (сумма строки)·(сумма столбца)/N. Степеней свободы (r − 1)(c − 1) = ' + df + '. ') + 'p = ' + pf(p) + (p < 0.05 ? ' — отклонение от H₀ значимо.' : ' — отклонения в пределах случайности.') + scaleNote + ' Приближение χ² надёжно, когда все E ≥ 5.';
    }
    w.pythonAction(() => {
      const D = CHI[s.set];
      const O = D.O.map((r) => r.map((v) => Math.round(v * s.scale)));
      return PY_NP + PY_ST + '\nO = np.array(' + JSON.stringify(D.type === 'gof' ? O[0] : O) + ')\n' + (D.type === 'gof' ? 'res = stats.chisquare(O)          # ожидаемые — поровну\nprint(f"χ² = {res.statistic:.3f}, p = {res.pvalue:.4g}")\n' : 'chi2, p, df, E = stats.chi2_contingency(O, correction=False)\nprint(f"χ² = {chi2:.3f}, df = {df}, p = {p:.4g}")\nprint("ожидаемые:\\n", E.round(1))\nprint("V Крамера:", round(np.sqrt(chi2 / (O.sum() * (min(O.shape) - 1))), 3))\n');
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 25. Критерий Манна — Уитни и AUC
   * ============================================================================== */
  /** Точное распределение U при H₀ (без ничьих): число перестановок с данным U. */
  function uCounts(m, n) {
    const memo = new Map();
    function f(a, b) {
      const key = a * 1000 + b;
      if (memo.has(key)) return memo.get(key);
      let res;
      if (a === 0 || b === 0) res = [1];
      else {
        const x = f(a - 1, b);
        const y = f(a, b - 1);
        res = new Array(a * b + 1).fill(0);
        x.forEach((v, u) => (res[u + b] += v));
        y.forEach((v, u) => (res[u] += v));
      }
      memo.set(key, res);
      return res;
    }
    return f(m, n);
  }
  GBC.widget('mann-whitney', (el) => {
    const s = { shift: 1, outlier: false, seed: 1 };
    const n1 = 8;
    const n0 = 10;
    const w = ui.shell(el, { title: 'Манн — Уитни: сравнить все пары', sub: 'Оценки модели для 8 объектов класса 1 (оранжевые) и 10 объектов класса 0 (синие). Статистика U — число пар (объект класса 1, объект класса 0), где у объекта класса 1 оценка выше. Сетка пар внизу: синяя клетка — пара упорядочена верно.' });
    ui.slider(w.controls, { label: 'Сдвиг класса 1', min: 0, max: 3, step: 0.25, value: s.shift, format: f2, onInput: (v) => ((s.shift = v), draw()) });
    ui.toggle(w.controls, { label: 'Добавить выброс в класс 0', checked: false, onChange: (v) => ((s.outlier = v), draw()) });
    ui.button(w.controls, { label: 'Другие объекты', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const p1 = new GBC.Plot(w.main, { height: 150, x: { label: 'оценка модели' }, y: { label: '', domain: [0.4, 2.6], ticks: [] } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'объекты класса 0 (по возрастанию оценки)', domain: [0.4, n0 + 0.6], ticks: U.range(n0, 1) }, y: { label: 'класс 1', domain: [0.4, n1 + 0.6], ticks: U.range(n1, 1) } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'u', label: 'U' }, { key: 'auc', label: 'AUC = U/(n₁n₀)' }, { key: 'p', label: 'p (Манн — Уитни, точно)' }, { key: 't', label: 'p (t-критерий Уэлча)' }]);
    const counts = uCounts(n1, n0);
    const total = U.sum(counts);
    function data() {
      const rng = new GBC.RNG(1500 + s.seed);
      const neg = U.range(n0).map(() => rng.normal());
      const pos = U.range(n1).map(() => rng.normal() + s.shift);
      if (s.outlier) neg[0] = 8;
      return { pos, neg };
    }
    function draw() {
      const { pos, neg } = data();
      const ps = U.sortedNumbers(pos);
      const ns = U.sortedNumbers(neg);
      let Uv = 0;
      const cx = [];
      const cy = [];
      const cw = [];
      for (let i = 0; i < n1; i++) {
        for (let j = 0; j < n0; j++) {
          const win = ps[i] > ns[j] ? 1 : ps[i] === ns[j] ? 0.5 : 0;
          Uv += win;
          cx.push(j + 1);
          cy.push(i + 1);
          cw.push(win);
        }
      }
      const u = Math.round(Uv);
      let cdf = 0;
      for (let k = 0; k <= u; k++) cdf += counts[k];
      let sf = 0;
      for (let k = u; k < counts.length; k++) sf += counts[k];
      const p = Math.min(1, (2 * Math.min(cdf, sf)) / total);
      const tp = welch(pos, neg).p;
      p1.render([
        { type: 'points', x: neg, y: neg.map(() => 1), color: 'blue', r: 5.5, label: 'класс 0', tooltip: (i) => ['класс 0', 'оценка ' + f2(neg[i])] },
        { type: 'points', x: pos, y: pos.map(() => 2), color: 'orange', r: 5.5, label: 'класс 1', tooltip: (i) => ['класс 1', 'оценка ' + f2(pos[i])] },
      ]);
      p2.render([
        { type: 'points', x: cx, y: cy, shape: 'square', r: 9, color: (k) => (cw[k] === 1 ? 'model' : cw[k] === 0 ? 'red' : 'muted'), legendColor: 'model', tooltip: (k) => ['класс 1: ' + f2(ps[cy[k] - 1]), 'класс 0: ' + f2(ns[cx[k] - 1]), cw[k] === 1 ? 'верный порядок' : 'неверный порядок'] },
      ]);
      st.set('u', f1(Uv) + ' из ' + n1 * n0);
      st.set('auc', f3(Uv / (n1 * n0)));
      st.set('p', pf(p));
      st.set('t', pf(tp));
      note.innerHTML = 'U = ' + f1(Uv) + ': в стольких парах из ' + n1 * n0 + ' объект класса 1 оценён выше. Поделив на число пар, получаем <b>AUC = ' + f3(Uv / (n1 * n0)) + '</b> — это одно и то же (урок 15.9, шаг 27). При H₀ (оценки не различают классы) U в среднем равно n₁n₀/2 = ' + (n1 * n0) / 2 + ', и его точное распределение считается перебором порядков. Критерий использует только ранги, поэтому устойчив к выбросам' + (s.outlier ? ': выброс 8 в классе 0 сдвинул t-критерий (p = ' + pf(tp) + '), а Манн — Уитни потерял лишь 8 пар.' : ' — включите выброс и сравните с t-критерием.');
    }
    w.pythonAction(() => PY_NP + PY_ST + PY_RNG + 'from sklearn.metrics import roc_auc_score\n\nrng = Mulberry32(' + (1500 + s.seed) + ')\nneg = np.array([rng.normal() for _ in range(10)])\npos = np.array([rng.normal() + ' + py(s.shift) + ' for _ in range(8)])\n' + (s.outlier ? 'neg[0] = 8\n' : '') + 'res = stats.mannwhitneyu(pos, neg, method="exact")\nprint(f"U = {res.statistic}, p = {res.pvalue:.4g}, AUC = U/(8·10) = {res.statistic / 80:.3f}")\ny = np.r_[np.ones(8), np.zeros(10)]\nprint("roc_auc_score:", round(roc_auc_score(y, np.r_[pos, neg]), 3))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 26. Множественные сравнения
   * ============================================================================== */
  GBC.widget('multiple-testing', (el) => {
    const s = { m: 100, pi1: 0.1, eff: 3, seed: 1 };
    const w = ui.shell(el, { title: 'Сто проверок сразу', sub: 'Проверяем m признаков на связь с целью. У доли π₁ признаков связь настоящая (оранжевые), у остальных её нет (серые). Точки — p-значения по возрастанию (ось p логарифмическая). Линии — пороги разных поправок; всё, что ниже порога, объявляется «открытием».' });
    ui.slider(w.controls, { label: 'Проверок m', values: [20, 50, 100, 500], value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'Доля настоящих эффектов π₁', values: [0, 0.05, 0.1, 0.2, 0.5], value: s.pi1, format: (v) => pct(v, 0), onInput: (v) => ((s.pi1 = v), draw()) });
    ui.slider(w.controls, { label: 'Сила эффекта (в SE)', values: [1, 2, 3, 4], value: s.eff, format: String, onInput: (v) => ((s.eff = v), draw()) });
    ui.button(w.controls, { label: 'Новый эксперимент', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'ранг p-значения' }, y: { label: 'p-значение (лог. шкала)', type: 'log' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const { m } = s;
      const alpha = 0.05;
      const rng = new GBC.RNG(1600 + 17 * s.seed + m);
      const nTrue = Math.round(s.pi1 * m);
      const truth = U.range(m).map((i) => i < nTrue);
      const p = truth.map((t) => normSf((t ? s.eff : 0) + rng.normal()));
      const ord = U.argsort(p);
      const sp = ord.map((i) => p[i]);
      const st = ord.map((i) => truth[i]);
      const rk = U.range(m, 1);
      const reject = {};
      reject.none = sp.map((v) => v <= alpha);
      reject.bonf = sp.map((v) => v <= alpha / m);
      let stop = m;
      for (let k = 0; k < m; k++) if (sp[k] > alpha / (m - k)) { stop = k; break; }
      reject.holm = sp.map((_, k) => k < stop);
      let kb = 0;
      for (let k = 0; k < m; k++) if (sp[k] <= ((k + 1) * alpha) / m) kb = k + 1;
      reject.bh = sp.map((_, k) => k < kb);
      const ymin = Math.max(1e-12, Math.min(1e-4, ...sp) * 0.5);
      plot.render([
        { type: 'hline', y: alpha, color: 'ink2', dash: '5 4', width: 1.4, label: 'без поправки: 0.05' },
        { type: 'line', x: rk, y: rk.map((k) => (k * alpha) / m), color: 'aqua', width: 2, label: 'Бенджамини — Хохберг: k·α/m' },
        { type: 'line', x: rk, y: rk.map((k) => alpha / (m - k + 1)), color: 'violet', width: 1.6, dash: '2 3', label: 'Холм: α/(m − k + 1)' },
        { type: 'hline', y: alpha / m, color: 'model', width: 1.8, label: 'Бонферрони: α/m' },
        { type: 'points', x: rk, y: sp.map((v) => Math.max(v, ymin)), color: (i) => (st[i] ? 'tree' : 'data'), legendColor: 'tree', r: m > 200 ? 2.6 : 4, tooltip: (i) => ['ранг ' + (i + 1), 'p = ' + pf(sp[i]), st[i] ? 'настоящий эффект' : 'эффекта нет'] },
      ], { x: [0, m + 1], y: [ymin, 1.5] });
      const dec = [];
      for (let e = 0; Math.pow(10, -e) >= ymin * 0.999; e += Math.ceil(-Math.log10(ymin) / 6)) dec.push(Math.pow(10, -e));
      plot.opts.y.ticks = Array.from(new Set(dec.concat([0.05]))).sort((x, y) => x - y);
      plot.opts.y.format = (v) => (v >= 0.01 ? String(Math.round(v * 100) / 100) : '1e' + String(Math.round(Math.log10(v))).replace('-', '−'));
      plot.draw();
      const NAMES = { none: 'без поправки', bonf: 'Бонферрони', holm: 'Холм', bh: 'BH (FDR 5 %)' };
      const rows = Object.keys(NAMES).map((k) => {
        const R = reject[k].filter(Boolean).length;
        const F = reject[k].filter((r, i) => r && !st[i]).length;
        const miss = nTrue - (R - F);
        return [NAMES[k], String(R), String(F), String(miss), R ? pct(F / R, 0) : '—'];
      });
      rowTable(tbl, ['метод', 'открытий', 'ложных', 'пропущено', 'доля ложных'], rows, null, false);
      const fwer = 1 - Math.pow(1 - alpha, m - nTrue);
      note.innerHTML = 'Без поправки каждая из ' + (m - nTrue) + ' «пустых» проверок даёт ложное открытие с вероятностью 5 %: в среднем ' + f1(0.05 * (m - nTrue)) + ' ложных, и хотя бы одно — с вероятностью 1 − 0.95<sup>' + (m - nTrue) + '</sup> = ' + pct(fwer) + '. Бонферрони (порог α/m) гарантирует, что вероятность <i>хотя бы одного</i> ложного открытия (FWER) ≤ 5 %, но многое пропускает. Холм — тот же контроль FWER, но всегда не хуже. Бенджамини — Хохберг контролирует <b>долю</b> ложных среди открытий (FDR) и находит больше — разумный выбор, когда проверок сотни (отбор признаков, поиск в сетке).';
    }
    w.pythonAction(() => PY_NP + PY_ST + PY_RNG + '\nm, pi1, eff, alpha = ' + s.m + ', ' + s.pi1 + ', ' + s.eff + ', 0.05\nrng = Mulberry32(' + (1600 + 17 * s.seed + s.m) + ')\nn_true = round(pi1 * m)\ntruth = np.arange(m) < n_true\np = np.array([stats.norm.sf((eff if t else 0) + rng.normal()) for t in truth])\nprint("без поправки:", np.sum(p <= alpha), " ложных", np.sum((p <= alpha) & ~truth))\nprint("Бонферрони: ", np.sum(p <= alpha / m), " ложных", np.sum((p <= alpha / m) & ~truth))\nq = stats.false_discovery_control(p)            # поправка Бенджамини — Хохберга\nprint("BH (FDR 5 %):", np.sum(q <= alpha), " ложных", np.sum((q <= alpha) & ~truth))\n# Холм: сравнить p_(k) с α/(m − k + 1) по возрастанию до первой неудачи\nsp = np.sort(p)\nfail = np.nonzero(sp > alpha / (m - np.arange(m)))[0]\nprint("Холм:       ", fail[0] if len(fail) else m)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 27. Проклятие победителя и регрессия к среднему
   * ============================================================================== */
  GBC.widget('winners-curse', (el) => {
    const s = { k: 20, nval: 500, spread: false };
    const w = ui.shell(el, { title: 'Проклятие победителя', sub: 'k конфигураций гиперпараметров. Их истинная точность около 0.80; на валидации из n объектов оценки шумят. Выбираем лучшую по валидации и измеряем её ещё раз на независимом тесте того же размера. 2000 повторов опыта.' });
    ui.slider(w.controls, { label: 'Перебрано вариантов k', values: [1, 2, 5, 10, 20, 50, 100], value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.slider(w.controls, { label: 'Объектов валидации n', values: [100, 500, 2000, 10000], value: s.nval, format: String, onInput: (v) => ((s.nval = v), draw()) });
    ui.toggle(w.controls, { label: 'Варианты немного различаются (σ = 0.01)', checked: false, onChange: (v) => ((s.spread = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'точность выбранного варианта' }, y: { label: 'доля опытов' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'победитель на валидации' }, { key: 't', label: 'он же на тесте' }, { key: 'q', label: 'его истинная точность' }, { key: 'b', label: 'завышение' }]);
    function draw() {
      const sdv = Math.sqrt((0.8 * 0.2) / s.nval);
      const rng = new GBC.RNG(61 + 7 * s.k + s.nval + (s.spread ? 1 : 0));
      const V = [];
      const T = [];
      const Q = [];
      for (let e = 0; e < 2000; e++) {
        let best = -Infinity;
        let bq = 0;
        for (let j = 0; j < s.k; j++) {
          const q = s.spread ? 0.8 + 0.01 * rng.normal() : 0.8;
          const v = q + sdv * rng.normal();
          if (v > best) {
            best = v;
            bq = q;
          }
        }
        V.push(best);
        Q.push(bq);
        T.push(bq + sdv * rng.normal());
      }
      const sp = Math.max(sdv, 0.01);
      const lo = 0.8 - 4 * sp;
      const hi = 0.8 + 5.5 * sp;
      const hv = hist(V, lo, hi, 50);
      const ht = hist(T, lo, hi, 50);
      plot.render([
        { type: 'bars', x: hv.x, y: hv.share, color: 'model', width: hv.w * 0.95, maxPx: 30, opacity: 0.55, label: 'на валидации (по ней выбирали)' },
        { type: 'line', x: ht.x, y: ht.share, curve: 'step', color: 'tree', width: 2.2, label: 'на новом тесте' },
        { type: 'vline', x: mean(V), color: 'model', width: 1.6, dash: '4 3' },
        { type: 'vline', x: mean(T), color: 'tree', width: 1.6, dash: '4 3' },
        { type: 'vline', x: 0.8, color: 'ink2', dash: '6 4', width: 1.2, text: '0.80' },
      ], { x: [lo, hi] });
      const bias = mean(V) - mean(Q);
      st.set('v', f4(mean(V)));
      st.set('t', f4(mean(T)));
      st.set('q', f4(mean(Q)));
      st.set('b', '+' + f4(bias) + ' (' + f2(bias / sdv) + ' SE)');
      note.innerHTML = 'Оценка победителя — <b>максимум</b> k шумных чисел, а максимум систематически завышен: в среднем на ' + f2(expMaxNormal(s.k)) + ' стандартной ошибки при k = ' + s.k + ' (1.16 при k = 5, 1.87 при k = 20, 2.51 при k = 100). На новом тесте тот же вариант «возвращается» к своей истинной точности. ' + (s.spread ? 'Когда варианты действительно различаются, выбор не бесполезен: истинная точность победителя ' + f4(mean(Q)) + ' выше средней 0.80, — но валидация всё равно её переоценивает. ' : '') + 'Поэтому итоговую оценку дают на отложенном тесте, который не участвовал в выборе.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nk, n_val, spread = ' + s.k + ', ' + s.nval + ', ' + (s.spread ? 'True' : 'False') + '\nsd = np.sqrt(0.8 * 0.2 / n_val)\nrng = Mulberry32(' + (61 + 7 * s.k + s.nval + (s.spread ? 1 : 0)) + ')\nV, T, Q = [], [], []\nfor _ in range(2000):\n    best, bq = -np.inf, 0.0\n    for _ in range(k):\n        q = 0.8 + 0.01 * rng.normal() if spread else 0.8\n        v = q + sd * rng.normal()\n        if v > best:\n            best, bq = v, q\n    V.append(best)\n    Q.append(bq)\n    T.append(bq + sd * rng.normal())\nprint(f"валидация {np.mean(V):.4f}; тест {np.mean(T):.4f}; истина {np.mean(Q):.4f}; завышение {(np.mean(V) - np.mean(Q)) / sd:.2f} SE")\n');
    draw();
  });

  GBC.widget('regression-mean', (el) => {
    const s = { r: 0.5, top: 0.1, seed: 1 };
    const w = ui.shell(el, { title: 'Регрессия к среднему', sub: '400 участников дважды проходят тест. Результат = истинное умение + случайность; надёжность теста r — корреляция двух попыток. Выделяем лучших по первой попытке (оранжевые) и смотрим на их вторую попытку. Шкала стандартизована: среднее 0, разброс 1.' });
    ui.slider(w.controls, { label: 'Надёжность теста r', values: [0.2, 0.3, 0.5, 0.7, 0.9, 0.95], value: s.r, format: String, onInput: (v) => ((s.r = v), draw()) });
    ui.slider(w.controls, { label: 'Отбираем лучших', values: [0.05, 0.1, 0.2, 0.5], value: s.top, format: (v) => pct(v, 0), onInput: (v) => ((s.top = v), draw()) });
    ui.button(w.controls, { label: 'Новые участники', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'первая попытка', domain: [-3.6, 3.6] }, y: { label: 'вторая попытка', domain: [-3.6, 3.6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'лучшие: 1-я попытка' }, { key: 'b', label: 'лучшие: 2-я попытка' }, { key: 'p', label: 'прогноз r·x̄₁' }, { key: 'k', label: 'остались в топе' }]);
    function draw() {
      const N = 400;
      const se = Math.sqrt((1 - s.r) / s.r);
      const norm = Math.sqrt(1 + se * se);
      const rng = new GBC.RNG(1700 + s.seed);
      const x1 = [];
      const x2 = [];
      for (let i = 0; i < N; i++) {
        const t = rng.normal();
        x1.push((t + se * rng.normal()) / norm);
        x2.push((t + se * rng.normal()) / norm);
      }
      const K = Math.round(s.top * N);
      const top1 = new Set(U.argsort(x1.map((v) => -v)).slice(0, K));
      const top2 = new Set(U.argsort(x2.map((v) => -v)).slice(0, K));
      const idx = U.range(N);
      const tI = idx.filter((i) => top1.has(i));
      const oI = idx.filter((i) => !top1.has(i));
      const m1 = mean(tI.map((i) => x1[i]));
      const m2 = mean(tI.map((i) => x2[i]));
      plot.render([
        { type: 'line', x: [-3.6, 3.6], y: [-3.6, 3.6], color: 'ink2', dash: '5 4', width: 1.2, label: 'y = x (без случайности)' },
        { type: 'line', x: [-3.6, 3.6], y: [-3.6 * s.r, 3.6 * s.r], color: 'model', width: 2.2, label: 'среднее 2-й попытки: r·x' },
        { type: 'points', x: oI.map((i) => x1[i]), y: oI.map((i) => x2[i]), color: 'data', r: 2.8, opacity: 0.6 },
        { type: 'points', x: tI.map((i) => x1[i]), y: tI.map((i) => x2[i]), color: 'tree', r: 3.6, label: 'лучшие ' + pct(s.top, 0) + ' по 1-й попытке' },
        { type: 'points', x: [m1], y: [m2], color: 'ink', r: 7, hollow: true, tooltip: () => ['лучшие: 1-я попытка ' + f2(m1), '2-я попытка ' + f2(m2)] },
      ]);
      st.set('a', f2(m1));
      st.set('b', f2(m2));
      st.set('p', f2(s.r * m1));
      st.set('k', pct(tI.filter((i) => top2.has(i)).length / K, 0));
      note.innerHTML = 'Лучшие по первой попытке набрали в среднем ' + f2(m1) + ', а во второй — лишь ' + f2(m2) + ' (прогноз r·x̄₁ = ' + f2(s.r * m1) + '). Они не «расслабились»: в первую попытку их отобрали отчасти за <b>везение</b>, а везение не повторяется. Чем ниже надёжность измерения, тем сильнее откат к среднему. В ML это объясняет, почему лучшая модель на лидерборде, лучший признак при отборе или «лучший» день A/B-теста почти всегда разочаровывают при повторной проверке.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nr, top, N = ' + s.r + ', ' + s.top + ', 400\nse = np.sqrt((1 - r) / r)\nrng = Mulberry32(' + (1700 + s.seed) + ')\nx1, x2 = [], []\nfor _ in range(N):\n    t = rng.normal()\n    x1.append((t + se * rng.normal()) / np.sqrt(1 + se**2))\n    x2.append((t + se * rng.normal()) / np.sqrt(1 + se**2))\nx1, x2 = np.array(x1), np.array(x2)\nbest = np.argsort(-x1, kind="stable")[: round(top * N)]\nprint(f"лучшие: 1-я попытка {x1[best].mean():.2f}, 2-я {x2[best].mean():.2f}, прогноз r·x̄ = {r * x1[best].mean():.2f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 28. Метрика на тесте — это оценка
   * ============================================================================== */
  const MET = {
    acc: { label: 'доля верных ответов (accuracy)', truth: 0.85 },
    mse: { label: 'MSE регрессии (10 % грубых ошибок)', truth: 1.8 },
    auc: { label: 'ROC AUC классификатора', truth: normCdf(1.4 / Math.SQRT2) },
  };
  GBC.widget('test-metric-se', (el) => {
    const s = { metric: 'acc', n: 1000 };
    const w = ui.shell(el, { title: 'Насколько можно доверять метрике на тесте', sub: 'Модель проверена на тесте из n объектов. Бутстрэп по объектам теста (500 повторов) показывает, как метрика «дрожала» бы на другом тесте того же размера; там, где есть формула для стандартной ошибки, сравниваем с ней.' });
    ui.select(w.controls, { label: 'Метрика', value: s.metric, options: Object.entries(MET).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.metric = v), draw()) });
    ui.slider(w.controls, { label: 'Объектов в тесте n', values: [100, 300, 1000, 3000, 10000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'значение метрики в бутстрэп-выборке' }, y: { label: 'доля повторов' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'на тесте' }, { key: 'f', label: 'SE по формуле' }, { key: 'b', label: 'бутстрэп-SE' }, { key: 'ci', label: '95 %-й интервал' }, { key: 't', label: 'истинное значение' }]);
    const cache = {};
    function run() {
      const key = s.metric + s.n;
      if (cache[key]) return cache[key];
      const mi = Object.keys(MET).indexOf(s.metric);
      const rng = new GBC.RNG(1800 + s.n + 100000 * mi);
      const n = s.n;
      const r2 = new GBC.RNG(44);
      const boots = [];
      let est;
      let se;
      if (s.metric === 'acc') {
        const c = U.range(n).map(() => (rng.random() < 0.85 ? 1 : 0));
        est = mean(c);
        se = Math.sqrt((est * (1 - est)) / n);
        for (let b = 0; b < 500; b++) {
          let sum = 0;
          for (let i = 0; i < n; i++) sum += c[r2.randint(n)];
          boots.push(sum / n);
        }
      } else if (s.metric === 'mse') {
        const sq = U.range(n).map(() => {
          const e = rng.normal() * (rng.random() < 0.1 ? 3 : 1);
          return e * e;
        });
        est = mean(sq);
        se = sd(sq) / Math.sqrt(n);
        for (let b = 0; b < 500; b++) {
          let sum = 0;
          for (let i = 0; i < n; i++) sum += sq[r2.randint(n)];
          boots.push(sum / n);
        }
      } else {
        const y = [];
        const sc = [];
        for (let i = 0; i < n; i++) {
          const yi = rng.random() < 0.3 ? 1 : 0;
          y.push(yi);
          sc.push(yi ? 1.4 + rng.normal() : rng.normal());
        }
        const ord = U.argsort(sc);
        const w8 = new Array(n);
        const aucW = () => {
          let neg = 0;
          let acc = 0;
          let np = 0;
          for (const i of ord) {
            if (y[i]) {
              acc += w8[i] * neg;
              np += w8[i];
            } else neg += w8[i];
          }
          return acc / (np * neg);
        };
        w8.fill(1);
        est = aucW();
        const n1 = U.sum(y);
        const n0 = n - n1;
        const q1 = est / (2 - est);
        const q2 = (2 * est * est) / (1 + est);
        se = Math.sqrt((est * (1 - est) + (n1 - 1) * (q1 - est * est) + (n0 - 1) * (q2 - est * est)) / (n1 * n0));
        for (let b = 0; b < 500; b++) {
          w8.fill(0);
          for (let i = 0; i < n; i++) w8[r2.randint(n)]++;
          boots.push(aucW());
        }
      }
      return (cache[key] = { est, se, boots });
    }
    function draw() {
      const { est, se, boots } = run();
      const lo = quantile(boots, 0.025);
      const hi = quantile(boots, 0.975);
      const tr = MET[s.metric].truth;
      const [mn, mx] = U.extent(boots.concat([tr]));
      let h;
      if (s.metric === 'acc') {
        const step = Math.max(1, Math.ceil(((mx - mn) * s.n) / 40)) / s.n;
        h = hist(boots, mn - step / 2, mx + step / 2 + 1e-12, Math.max(1, Math.round((mx - mn) / step) + 1));
      } else h = hist(boots, mn, mx + 1e-12, 45);
      plot.render([
        { type: 'vband', x0: lo, x1: hi, color: 'model', opacity: 0.1 },
        { type: 'bars', x: h.x, y: h.share, color: 'model', width: h.w * 0.95, maxPx: 30, opacity: 0.7 },
        { type: 'vline', x: est, color: 'ink', width: 1.8, text: 'на тесте' },
        { type: 'vline', x: tr, color: 'tree', dash: '6 4', width: 1.6, text: 'истина' },
      ]);
      const bse = sd(boots);
      st.set('e', f4(est));
      st.set('f', f4(se));
      st.set('b', f4(bse));
      st.set('ci', '[' + f3(lo) + ', ' + f3(hi) + ']');
      st.set('t', f4(tr));
      const N = {
        acc: 'Для доли SE = √(p(1 − p)/n) = ' + f4(se) + ' — бутстрэп даёт почти то же (' + f4(bse) + '). Значит, точность ' + f3(est) + ' на этом тесте честно записывать как ' + f3(est) + ' ± ' + f3(1.96 * se) + '.',
        mse: 'MSE — среднее квадратов ошибок, SE = (стандартное отклонение квадратов)/√n = ' + f4(se) + '. Из-за 10 % грубых ошибок квадраты имеют тяжёлый хвост, и MSE шумит сильно: относительная погрешность ±' + pct((1.96 * se) / est, 0) + ' при n = ' + s.n + '.',
        auc: 'У AUC нет простой формулы — есть приближение Хэнли — Макнила (SE ≈ ' + f4(se) + '), а бутстрэп даёт ' + f4(bse) + '. AUC шумит сильнее accuracy, потому что зависит от числа пар, а позитивов здесь лишь 30 %.',
      };
      note.innerHTML = N[s.metric] + ' Увеличьте n вчетверо — интервал сузится вдвое. Сравнивать две модели по разнице меньше ~2 SE бессмысленно — если только сравнение не парное (шаг 29).';
    }
    w.pythonAction(() => {
      const mi = Object.keys(MET).indexOf(s.metric);
      const head = PY_NP + PY_RNG + '\nn = ' + s.n + '\nrng = Mulberry32(' + (1800 + s.n + 100000 * mi) + ')\n';
      if (s.metric === 'acc') return head + 'correct = np.array([1 if rng.random() < 0.85 else 0 for _ in range(n)])\np = correct.mean()\nprint(f"accuracy {p:.4f} ± {1.96 * np.sqrt(p * (1 - p) / n):.4f} (95 %, формула)")\nr2 = Mulberry32(44)\nboots = [correct[[r2.randint(n) for _ in range(n)]].mean() for _ in range(500)]\nprint("бутстрэп-SE:", round(np.std(boots, ddof=1), 4), " интервал", np.quantile(boots, [0.025, 0.975]).round(3))\n';
      if (s.metric === 'mse') return head + 'sq = []\nfor _ in range(n):\n    e = rng.normal() * (3 if rng.random() < 0.1 else 1)\n    sq.append(e * e)\nsq = np.array(sq)\nprint(f"MSE {sq.mean():.4f}, SE {sq.std(ddof=1) / np.sqrt(n):.4f} (истинное MSE 1.8)")\nr2 = Mulberry32(44)\nboots = [sq[[r2.randint(n) for _ in range(n)]].mean() for _ in range(500)]\nprint("бутстрэп-SE:", round(np.std(boots, ddof=1), 4))\n';
      return head + 'from sklearn.metrics import roc_auc_score\ny, sc = [], []\nfor _ in range(n):\n    yi = 1 if rng.random() < 0.3 else 0\n    y.append(yi)\n    sc.append(1.4 + rng.normal() if yi else rng.normal())\ny, sc = np.array(y), np.array(sc)\nA = roc_auc_score(y, sc)\nn1, n0 = y.sum(), n - y.sum()\nq1, q2 = A / (2 - A), 2 * A * A / (1 + A)\nse = np.sqrt((A * (1 - A) + (n1 - 1) * (q1 - A * A) + (n0 - 1) * (q2 - A * A)) / (n1 * n0))\nprint(f"AUC {A:.4f}; SE Хэнли — Макнила {se:.4f}")\nr2 = Mulberry32(44)\nboots = []\nfor _ in range(500):\n    idx = [r2.randint(n) for _ in range(n)]\n    boots.append(roc_auc_score(y[idx], sc[idx]))\nprint("бутстрэп-SE:", round(np.std(boots, ddof=1), 4))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 29. Критерий Мак-Немара: две модели на одних объектах
   * ============================================================================== */
  GBC.widget('mcnemar', (el) => {
    const s = { n: 1000, pA: 0.85, gain: 0.02, rho: 0.6, seed: 1 };
    const w = ui.shell(el, { title: 'Две модели на одном тесте: критерий Мак-Немара', sub: 'Модель B на самом деле точнее A на Δ. Модели ошибаются на похожих объектах (связь ρ — корреляция индикаторов «угадала»). Мак-Немар смотрит только на объекты, где модели разошлись; непарное сравнение долей игнорирует, что тест общий.' });
    ui.slider(w.controls, { label: 'Объектов в тесте n', values: [200, 500, 1000, 2000, 5000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Выигрыш B, Δ', values: [0, 0.005, 0.01, 0.02, 0.03], value: s.gain, format: (v) => '+' + v, onInput: (v) => ((s.gain = v), draw()) });
    ui.slider(w.controls, { label: 'Согласованность ошибок ρ', values: [0, 0.3, 0.6, 0.8, 0.9], value: s.rho, format: String, onInput: (v) => ((s.rho = v), draw()) });
    ui.button(w.controls, { label: 'Другой тест', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const grid = cardGrid(420);
    w.main.appendChild(grid);
    const cT = card('Таблица 2 × 2');
    const cR = card('Два критерия');
    grid.append(cT.el, cR.el);
    const plot = new GBC.Plot(w.main, { height: 230, x: { label: 'объектов в тесте n (лог. шкала)', type: 'log', domain: [100, 10000], ticks: [100, 300, 1000, 3000, 10000] }, y: { label: 'мощность (α = 0.05)', domain: [0, 1.02] } });
    const note = w.note('', true);
    function probs() {
      const pB = s.pA + s.gain;
      const qa = 1 - s.pA;
      const qb = 1 - pB;
      let p11 = s.pA * pB + s.rho * Math.sqrt(s.pA * qa * pB * qb);
      p11 = Math.min(p11, s.pA, pB);
      const p10 = s.pA - p11;
      const p01 = pB - p11;
      const p00 = 1 - p11 - p10 - p01;
      return { pB, p11, p10, p01, p00 };
    }
    function powers(n, P) {
      const za = 1.959964;
      const pd = P.p10 + P.p01;
      const dl = P.p01 - P.p10;
      const mc = pd > 0 ? normCdf((Math.abs(dl) * Math.sqrt(n) - za * Math.sqrt(pd)) / Math.sqrt(Math.max(1e-12, pd - dl * dl))) : 0;
      const un = normCdf(Math.abs(s.gain) / Math.sqrt((s.pA * (1 - s.pA) + P.pB * (1 - P.pB)) / n) - za);
      return { mc, un };
    }
    function draw() {
      const P = probs();
      const rng = new GBC.RNG(1900 + s.seed);
      let b11 = 0;
      let b10 = 0;
      let b01 = 0;
      let b00 = 0;
      for (let i = 0; i < s.n; i++) {
        const u = rng.random();
        if (u < P.p11) b11++;
        else if (u < P.p11 + P.p10) b10++;
        else if (u < P.p11 + P.p10 + P.p01) b01++;
        else b00++;
      }
      const nd = b10 + b01;
      const pMc = nd ? Math.min(1, 2 * binomCdf(Math.min(b10, b01), nd, 0.5)) : 1;
      const accA = (b11 + b10) / s.n;
      const accB = (b11 + b01) / s.n;
      const pbar = (accA + accB) / 2;
      const zU = (accB - accA) / Math.sqrt((2 * pbar * (1 - pbar)) / s.n);
      const pUn = 2 * normSf(Math.abs(zU));
      cT.body.textContent = '';
      const t = H('table', { class: 'data' });
      t.appendChild(H('thead', null, H('tr', null, H('th', null, ''), H('th', { class: 'num' }, 'B верно'), H('th', { class: 'num' }, 'B ошиблась'))));
      const hl = 'background:var(--warn-soft);font-weight:700';
      t.appendChild(H('tbody', null,
        H('tr', null, H('td', null, 'A верно'), H('td', { class: 'num' }, String(b11)), H('td', { class: 'num', style: hl }, String(b10))),
        H('tr', null, H('td', null, 'A ошиблась'), H('td', { class: 'num', style: hl }, String(b01)), H('td', { class: 'num' }, String(b00)))));
      cT.body.appendChild(H('div', { class: 'table-wrap' }, t));
      cT.body.appendChild(H('div', { style: 'font-size:.85rem;color:var(--muted);margin-top:4px' }, 'точность A = ' + f3(accA) + ', B = ' + f3(accB) + '; разошлись на ' + nd + ' объектах'));
      cR.body.textContent = '';
      cR.body.append(
        H('div', null, H('b', null, 'Мак-Немар: '), 'p = ' + pf(pMc) + ' ', badge(pMc < 0.05 ? 'различие значимо' : 'не доказано', pMc < 0.05 ? 'good' : 'neutral')),
        H('div', { style: 'font-size:.85rem;color:var(--muted);margin:2px 0 8px' }, 'точный биномиальный критерий: ' + b01 + ' против ' + b10 + ' среди ' + nd + ' разногласий'),
        H('div', null, H('b', null, 'Непарный z-критерий долей: '), 'p = ' + pf(pUn) + ' ', badge(pUn < 0.05 ? 'различие значимо' : 'не доказано', pUn < 0.05 ? 'good' : 'neutral')),
        H('div', { style: 'font-size:.85rem;color:var(--muted);margin-top:2px' }, 'сравнивает ' + f3(accB) + ' и ' + f3(accA) + ' как независимые доли'),
      );
      const ns = U.range(60).map((i) => 100 * Math.pow(100, i / 59));
      const pw = ns.map((n) => powers(n, P));
      const cur = powers(s.n, P);
      plot.render([
        { type: 'hline', y: 0.8, color: 'ink2', dash: '4 4', width: 1 },
        { type: 'line', x: ns, y: pw.map((v) => v.mc), color: 'model', width: 2.4, label: 'Мак-Немар (парный)' },
        { type: 'line', x: ns, y: pw.map((v) => v.un), color: 'tree', width: 2.2, label: 'непарное сравнение долей' },
        { type: 'points', x: [s.n, s.n], y: [cur.mc, cur.un], color: (i) => (i ? 'tree' : 'model'), r: 5.5 },
        { type: 'vline', x: s.n, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      note.innerHTML = 'Объекты, где обе модели правы или обе ошиблись, ничего не говорят о том, какая лучше, — важны только ' + nd + ' ' + plural(nd, 'разногласие', 'разногласия', 'разногласий') + ': при H₀ «B лучше» и «A лучше» среди них равновероятны. Чем согласованнее ошибки моделей (ρ), тем меньше разногласий и тем точнее сравнение: мощность Мак-Немара при n = ' + s.n + ' — ' + pct(cur.mc, 0) + ', непарного критерия — ' + pct(cur.un, 0) + '. Модели, обученные на одних данных, обычно сильно согласованы — сравнивайте их парно. Для регрессии то же делает парный t-критерий по разностям потерь на объектах.';
    }
    w.pythonAction(() => PY_NP + PY_ST + PY_RNG + '\nn, pA, gain, rho = ' + s.n + ', ' + s.pA + ', ' + s.gain + ', ' + s.rho + '\npB = pA + gain\np11 = min(pA * pB + rho * np.sqrt(pA * (1 - pA) * pB * (1 - pB)), pA, pB)\np10, p01 = pA - p11, pB - p11\nrng = Mulberry32(' + (1900 + s.seed) + ')\nb = np.zeros(4, int)                         # [оба верно, только A, только B, оба ошиблись]\nfor _ in range(n):\n    u = rng.random()\n    b[0 if u < p11 else 1 if u < p11 + p10 else 2 if u < p11 + p10 + p01 else 3] += 1\nprint("таблица:", b)\nres = stats.binomtest(min(b[1], b[2]), b[1] + b[2], 0.5)   # точный критерий Мак-Немара\nprint(f"Мак-Немар p = {res.pvalue:.4g}")\naccA, accB = (b[0] + b[1]) / n, (b[0] + b[2]) / n\npbar = (accA + accB) / 2\nz = (accB - accA) / np.sqrt(2 * pbar * (1 - pbar) / n)\nprint(f"непарный z-критерий p = {2 * stats.norm.sf(abs(z)):.4g}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 30. Кросс-валидация как оценка
   * ============================================================================== */
  GBC.widget('cv-folds', (el) => {
    const d = GBC.datasets.regression1d({ kind: 'wave', n: 120, noise: 0.45, seed: 4 });
    const s = { K: 5, reps: 1 };
    const w = ui.shell(el, { title: 'Кросс-валидация: среднее, разброс и честная SE', sub: 'Сравниваем бустинг на пнях (глубина 1) и на деревьях глубины 3 (по 60 деревьев, ν = 0.1) на 120 точках «волны». Сверху — MSE на частях первого разбиения. Снизу — парные разности по всем частям и повторам и два 95 %-х интервала для средней разности: наивный и с поправкой Надо — Бенжио.' });
    ui.slider(w.controls, { label: 'Частей K', values: [2, 3, 5, 10], value: s.K, format: String, onInput: (v) => ((s.K = v), draw()) });
    ui.slider(w.controls, { label: 'Повторов r', values: [1, 2, 5, 10], value: s.reps, format: String, onInput: (v) => ((s.reps = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'часть (фолд) первого разбиения' }, y: { label: 'MSE на части' } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'разность MSE (глубина 1 − глубина 3)' }, y: { label: 'повтор', ticks: [] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'глубина 1: среднее ± SE' }, { key: 'b', label: 'глубина 3: среднее ± SE' }, { key: 'd', label: 'разность ± SE (наивная)' }, { key: 'c', label: 'SE с поправкой, p' }]);
    const cache = {};
    function cvRep(K, rep) {
      const key = K + '|' + rep;
      if (cache[key]) return cache[key];
      const perm = new GBC.RNG(8 + 1000 * rep).permutation(d.y.length);
      const folds = U.range(K).map((k) => perm.filter((_, i) => i % K === k));
      const res = { A: [], B: [] };
      for (const test of folds) {
        const inTest = new Set(test);
        const tr = U.range(d.y.length).filter((i) => !inTest.has(i));
        const Xtr = tr.map((i) => d.X[i]);
        const ytr = tr.map((i) => d.y[i]);
        for (const [k2, depth] of [['A', 1], ['B', 3]]) {
          const m = new GBC.GradientBoosting({ nEstimators: 60, learningRate: 0.1, maxDepth: depth }).fit(Xtr, ytr);
          const pred = m.predict(test.map((i) => d.X[i]));
          res[k2].push(U.mean(test.map((i, j) => (d.y[i] - pred[j]) ** 2)));
        }
      }
      return (cache[key] = res);
    }
    const seOf = (a) => sd(a) / Math.sqrt(a.length);
    function draw() {
      const K = s.K;
      const reps = U.range(s.reps).map((r) => cvRep(K, r));
      const { A, B } = reps[0];
      const ks = U.range(K, 1);
      p1.render([
        { type: 'bars', x: ks.map((k) => k - 0.18), y: A, color: 'blue', width: 0.34, label: 'глубина 1' },
        { type: 'bars', x: ks.map((k) => k + 0.18), y: B, color: 'orange', width: 0.34, label: 'глубина 3' },
        { type: 'hline', y: mean(A), color: 'blue', dash: '4 4', width: 1.2 },
        { type: 'hline', y: mean(B), color: 'orange', dash: '4 4', width: 1.2 },
      ], { x: [0.4, K + 0.6] });
      const allA = reps.flatMap((r) => r.A);
      const allB = reps.flatMap((r) => r.B);
      const diffs = reps.flatMap((r) => r.A.map((v, i) => v - r.B[i]));
      const J = diffs.length;
      const md = mean(diffs);
      const seN = seOf(diffs);
      const seC = Math.sqrt((1 / J + 1 / (K - 1)) * variance(diffs));
      const tC = md / seC;
      const pC = tP2(tC, J - 1);
      const qN = tPpf(0.975, J - 1);
      const R = s.reps;
      const L = [{ type: 'vline', x: 0, color: 'ink2', width: 1.2 }];
      const rr = new GBC.RNG(3);
      reps.forEach((r, j) => {
        const dd = r.A.map((v, i) => v - r.B[i]);
        L.push({ type: 'points', x: dd, y: dd.map(() => j + 1 + 0.3 * (rr.random() - 0.5)), color: 'model', r: 3.6, opacity: 0.8 });
      });
      L.push({ type: 'segments', x1: [md - qN * seN], x2: [md + qN * seN], y1: [R + 1], y2: [R + 1], color: 'red', width: 5, opacity: 0.85 });
      L.push({ type: 'segments', x1: [md - qN * seC], x2: [md + qN * seC], y1: [R + 1.8], y2: [R + 1.8], color: 'aqua', width: 5, opacity: 0.85 });
      L.push({ type: 'points', x: [md, md], y: [R + 1, R + 1.8], color: 'ink', r: 4 });
      L.push({ type: 'text', items: [{ x: md + qN * seN, y: R + 1, dx: 6, dy: 4, text: 'наивный', color: 'red' }, { x: md + qN * seC, y: R + 1.8, dx: 6, dy: 4, text: 'с поправкой', color: 'aqua' }] });
      p2.render(L, { y: [0.4, R + 2.4], x: yDom(diffs.concat([0, md - qN * seC, md + qN * seC]), 0.06, [md + qN * seC + 0.25 * Math.abs(md + qN * seC - (md - qN * seC))]) });
      st.set('a', f4(mean(allA)) + ' ± ' + f3(seOf(allA)));
      st.set('b', f4(mean(allB)) + ' ± ' + f3(seOf(allB)));
      st.set('d', f4(md) + ' ± ' + f3(seN));
      st.set('c', '± ' + f3(seC) + ', p = ' + pf(pC));
      note.innerHTML = 'MSE на разных частях заметно различаются — это шум оценки. Парные разности на одних и тех же частях шумят меньше, чем MSE каждой модели. Но части делят обучающие данные, поэтому оценки <b>зависимы</b>, и наивная SE = s/√(rK) занижает неопределённость — особенно при многих повторах (повторы не добавляют новых данных!). Поправка Надо — Бенжио умножает дисперсию на (1/(rK) + n<sub>тест</sub>/n<sub>обуч</sub>) = (1/' + J + ' + 1/' + (K - 1) + '): интервал шире, p = ' + pf(pC) + '. Повторная кросс-валидация уменьшает лишь шум от случайного разбиения.';
    }
    w.pythonAction(() => PY_NP + PY_ST + PY_RNG + 'from gbcourse import datasets\nfrom gbcourse.boosting import GBRegressor\n\nX, y = datasets.regression_1d(kind="wave", n=120, noise=0.45, seed=4)\nK, reps = ' + s.K + ', ' + s.reps + '\ndiffs = []\nfor rep in range(reps):\n    perm = np.array(Mulberry32(8 + 1000 * rep).permutation(len(y)))\n    for k in range(K):\n        test = perm[np.arange(len(y)) % K == k]\n        train = np.setdiff1d(np.arange(len(y)), test)\n        mse = []\n        for depth in (1, 3):\n            m = GBRegressor(n_estimators=60, learning_rate=0.1, max_depth=depth).fit(X[train], y[train])\n            mse.append(np.mean((y[test] - m.predict(X[test])) ** 2))\n        diffs.append(mse[0] - mse[1])\ndiffs = np.array(diffs)\nJ = len(diffs)\nse_naive = diffs.std(ddof=1) / np.sqrt(J)\nse_corr = np.sqrt((1 / J + 1 / (K - 1)) * diffs.var(ddof=1))      # Надо — Бенжио\np = 2 * stats.t.sf(abs(diffs.mean() / se_corr), J - 1)\nprint(f"разность {diffs.mean():.4f}; SE наивная {se_naive:.3f}, с поправкой {se_corr:.3f}; p = {p:.3g}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 31. Переобучение под валидацию: публичный лидерборд
   * ============================================================================== */
  GBC.widget('leaderboard', (el) => {
    const s = { m: 300, pub: 300, strat: 'vote' };
    const w = ui.shell(el, { title: 'Как «обыграть» лидерборд, ничего не умея', sub: 'Соревнование: метки теста — чистая случайность (0/1), предсказать их невозможно. Тест делится на публичную часть (её результат виден после каждой отправки) и приватную (2000 объектов, финальная оценка). Участник отправляет случайные ответы и подстраивается под публичную часть.' });
    ui.slider(w.controls, { label: 'Отправок m', values: [10, 30, 100, 300, 1000], value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'Объектов в публичной части', values: [100, 300, 1000, 3000], value: s.pub, format: String, onInput: (v) => ((s.pub = v), draw()) });
    ui.segmented(w.controls, { label: 'Стратегия', value: s.strat, options: [{ value: 'best', label: 'лучшая отправка' }, { value: 'vote', label: 'голосование удачных' }], onChange: (v) => ((s.strat = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'номер отправки' }, y: { label: 'точность' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pu', label: 'публичный результат' }, { key: 'pr', label: 'приватный результат' }, { key: 'g', label: 'разрыв' }]);
    const cache = {};
    function run() {
      const key = s.m + '|' + s.pub + '|' + s.strat;
      if (cache[key]) return cache[key];
      const NP = s.pub;
      const N = NP + 2000;
      const rng = new GBC.RNG(2000 + NP);
      const y = U.range(N).map(() => (rng.random() < 0.5 ? 1 : -1));
      const sum = new Array(N).fill(0);
      let best = -1;
      let bestPriv = 0.5;
      const pubT = [];
      const privT = [];
      for (let t = 0; t < s.m; t++) {
        const sub = U.range(N).map(() => (rng.random() < 0.5 ? 1 : -1));
        let cp = 0;
        for (let i = 0; i < NP; i++) cp += sub[i] === y[i] ? 1 : 0;
        const accP = cp / NP;
        if (s.strat === 'best') {
          if (accP > best) {
            best = accP;
            let c2 = 0;
            for (let i = NP; i < N; i++) c2 += sub[i] === y[i] ? 1 : 0;
            bestPriv = c2 / 2000;
          }
          pubT.push(best);
          privT.push(bestPriv);
        } else {
          if (accP > 0.5) for (let i = 0; i < N; i++) sum[i] += sub[i];
          let a = 0;
          let b = 0;
          for (let i = 0; i < NP; i++) a += (sum[i] >= 0 ? 1 : -1) === y[i] ? 1 : 0;
          for (let i = NP; i < N; i++) b += (sum[i] >= 0 ? 1 : -1) === y[i] ? 1 : 0;
          pubT.push(a / NP);
          privT.push(b / 2000);
        }
      }
      return (cache[key] = { pubT, privT });
    }
    function draw() {
      const { pubT, privT } = run();
      const xs = U.range(s.m, 1);
      plot.render([
        { type: 'hline', y: 0.5, color: 'ink2', dash: '5 4', width: 1.2, label: 'угадывание: 0.5' },
        { type: 'line', x: xs, y: pubT, color: 'model', width: 2.2, label: 'публичный лидерборд' },
        { type: 'line', x: xs, y: privT, color: 'tree', width: 2.2, label: 'приватный (финальный)' },
      ], { x: [1, s.m], y: [0.42, Math.max(0.62, ...pubT) + 0.02] });
      const pu = pubT[pubT.length - 1];
      const pr = privT[privT.length - 1];
      st.set('pu', f3(pu));
      st.set('pr', f3(pr));
      st.set('g', '+' + f3(pu - pr));
      note.innerHTML = (s.strat === 'best' ? 'Выбор лучшей из ' + s.m + ' случайных отправок — проклятие победителя в чистом виде: публичная точность ' + f3(pu) + ' — максимум шумных чисел.' : 'Голосование «удачных» отправок (тех, что случайно набрали > 0.5 на публичной части) — адаптивная подгонка: каждая отправка — маленький запрос к меткам публичной части, и их сумма постепенно «выучивает» эти метки.') + ' Публичный результат ' + f3(pu) + ', приватный — ' + f3(pr) + ': на новых данных умение нулевое. Чем меньше публичная часть и чем больше отправок, тем сильнее переобучение. Так же переобучаются под валидацию при долгом ручном подборе — отсюда отложенный тест, вложенная кросс-валидация и ограничение числа «подглядываний».';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nm, NP, strategy = ' + s.m + ', ' + s.pub + ', "' + s.strat + '"\nN = NP + 2000\nrng = Mulberry32(' + (2000 + s.pub) + ')\ny = np.array([1 if rng.random() < 0.5 else -1 for _ in range(N)])\ntotal = np.zeros(N)\nbest, best_priv = -1, 0.5\nfor t in range(m):\n    sub = np.array([1 if rng.random() < 0.5 else -1 for _ in range(N)])\n    acc_pub = np.mean(sub[:NP] == y[:NP])\n    if strategy == "best":\n        if acc_pub > best:\n            best, best_priv = acc_pub, np.mean(sub[NP:] == y[NP:])\n    elif acc_pub > 0.5:\n        total += sub\nif strategy == "best":\n    print(f"публичный {best:.3f}, приватный {best_priv:.3f}")\nelse:\n    agg = np.where(total >= 0, 1, -1)\n    print(f"публичный {np.mean(agg[:NP] == y[:NP]):.3f}, приватный {np.mean(agg[NP:] == y[NP:]):.3f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 32. Лучшее разбиение на шуме: выбор разбиения — множественное сравнение
   * ============================================================================== */
  GBC.widget('noise-split', (el) => {
    const s = { n: 100, p: 20, card: 0, minLeaf: 5, signal: 0.3 };
    const w = ui.shell(el, { title: 'Пень на шуме: лучшее разбиение всегда что-то «объясняет»', sub: 'Цель y = сигнал·(x₀ > 0.5 ? 1 : −1) + шум N(0, 1). Признак x₀ — настоящий, ещё p признаков — чистый шум. Пень перебирает все пороги всех признаков и берёт лучший. 300 повторов: серое — доля дисперсии y, «объяснённая» лучшим шумовым разбиением, синее — разбиением по настоящему признаку.' });
    ui.slider(w.controls, { label: 'Объектов в узле n', values: [20, 50, 100, 500], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Шумовых признаков p', values: [1, 5, 20, 100], value: s.p, format: String, onInput: (v) => ((s.p = v), draw()) });
    ui.select(w.controls, { label: 'Уникальных значений у шумовых', value: String(s.card), options: [{ value: '0', label: 'все разные (непрерывные)' }, { value: '10', label: '10 значений' }, { value: '2', label: '2 значения (бинарные)' }], onChange: (v) => ((s.card = +v), draw()) });
    ui.slider(w.controls, { label: 'Минимум объектов в листе', values: [1, 5, 10, 20], value: s.minLeaf, format: String, onInput: (v) => ((s.minLeaf = v), draw()) });
    ui.slider(w.controls, { label: 'Сила сигнала', values: [0, 0.1, 0.2, 0.3, 0.5], value: s.signal, format: String, onInput: (v) => ((s.signal = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'доля дисперсии, объяснённая разбиением (R²)' }, y: { label: 'доля повторов' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'лучший шумовой R², среднее' }, { key: 'q', label: '95-й перцентиль шума' }, { key: 's', label: 'настоящий признак R²' }, { key: 'w', label: 'P(настоящий выиграл)' }]);
    /** Лучший выигрыш SSE по порогам на границах групп (y уже упорядочен по признаку). */
    function bestGain(y, bounds, minLeaf) {
      const n = y.length;
      let tot = 0;
      for (const v of y) tot += v;
      let best = 0;
      let left = 0;
      let k = 0;
      for (const b of bounds) {
        while (k < b) left += y[k++];
        if (b < minLeaf || n - b < minLeaf) continue;
        const g = (left * left) / b + ((tot - left) * (tot - left)) / (n - b) - (tot * tot) / n;
        if (g > best) best = g;
      }
      return best;
    }
    const cache = {};
    function run() {
      const key = [s.n, s.p, s.card, s.minLeaf, s.signal].join('|');
      if (cache[key]) return cache[key];
      const rng = new GBC.RNG(2100 + s.n + 7 * s.p + 13 * s.card);
      const R = 300;
      const n = s.n;
      const noiseBest = [];
      const sig = [];
      const all = U.range(n - 1, 1);
      for (let r = 0; r < R; r++) {
        const x0 = U.range(n).map(() => rng.random());
        const y = x0.map((v) => s.signal * (v > 0.5 ? 1 : -1) + rng.normal());
        const m = mean(y);
        let sst = 0;
        for (const v of y) sst += (v - m) * (v - m);
        const ord = U.argsort(x0);
        sig.push(bestGain(ord.map((i) => y[i]), all, s.minLeaf) / sst);
        let bn = 0;
        for (let j = 0; j < s.p; j++) {
          const yy = y.slice();
          rng.shuffle(yy);
          let bounds = all;
          if (s.card) {
            const cnt = new Array(s.card).fill(0);
            for (let i = 0; i < n; i++) cnt[rng.randint(s.card)]++;
            bounds = [];
            let c = 0;
            for (let g = 0; g < s.card - 1; g++) {
              c += cnt[g];
              if (c > 0 && c < n) bounds.push(c);
            }
          }
          bn = Math.max(bn, bestGain(yy, bounds, s.minLeaf) / sst);
        }
        noiseBest.push(bn);
      }
      return (cache[key] = { noiseBest, sig });
    }
    function draw() {
      const { noiseBest, sig } = run();
      const q95 = quantile(noiseBest, 0.95);
      const hi = Math.max(quantile(noiseBest, 0.995), quantile(sig, 0.995), 0.02) * 1.05;
      const h1 = hist(noiseBest, 0, hi, 45);
      const h2 = hist(sig, 0, hi, 45);
      const win = sig.filter((v, i) => v > noiseBest[i]).length / sig.length;
      const thr = Math.max(1, s.card ? s.card - 1 : s.n + 1 - 2 * s.minLeaf);
      plot.render([
        { type: 'bars', x: h1.x, y: h1.share, color: 'data', width: h1.w * 0.95, maxPx: 30, opacity: 0.7, label: 'лучшее из ' + s.p + ' шумовых' },
        { type: 'line', x: h2.x, y: h2.share, curve: 'step', color: 'model', width: 2.2, label: 'настоящий признак x₀' },
        { type: 'vline', x: q95, color: 'red', dash: '5 4', width: 1.6, text: '95 % шума' },
      ], { x: [0, hi] });
      st.set('m', f3(mean(noiseBest)));
      st.set('q', f3(q95));
      st.set('s', f3(mean(sig)));
      st.set('w', pct(win, 0));
      note.innerHTML = 'Даже на чистом шуме лучший из ' + s.p + ' признаков «объясняет» в среднем ' + pct(mean(noiseBest)) + ' дисперсии: выбор лучшего разбиения — это максимум по ' + thr + ' ' + plural(thr, 'порогу', 'порогам', 'порогам') + ' в каждом из ' + s.p + ' ' + plural(s.p, 'признака', 'признаков', 'признаков') + ', проклятие победителя внутри дерева. Настоящий признак выигрывает у всех шумовых ' + (win < 0.75 ? 'лишь ' : '') + 'в ' + pct(win, 0) + ' повторов. ' + (s.card === 2 ? 'У бинарных шумовых признаков порог один — они «везут» гораздо реже, чем непрерывные. Поэтому важность по выигрышу (gain) завышает признаки с множеством уникальных значений (урок 12.1). ' : 'Признаки с множеством уникальных значений имеют больше шансов «повезти» — отсюда завышенная важность по выигрышу у таких признаков (урок 12.1). ') + 'Защита: минимальное число объектов в листе, минимальный выигрыш γ (порог около 95-го перцентиля шума — ' + f3(q95) + ' от дисперсии узла), λ, ограничение глубины и ранняя остановка по валидации.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nn, p, card, min_leaf, signal = ' + s.n + ', ' + s.p + ', ' + s.card + ', ' + s.minLeaf + ', ' + py(s.signal) + '\n\ndef best_gain(y, bounds):\n    """Лучшее уменьшение SSE по порогам на границах (y упорядочен по признаку)."""\n    cs, tot, n = np.cumsum(y), y.sum(), len(y)\n    b = np.array([b for b in bounds if min_leaf <= b <= n - min_leaf])\n    if len(b) == 0:\n        return 0.0\n    left = cs[b - 1]\n    return max(0.0, (left**2 / b + (tot - left) ** 2 / (n - b) - tot**2 / n).max())\n\nrng = Mulberry32(' + (2100 + s.n + 7 * s.p + 13 * s.card) + ')\nall_bounds = np.arange(1, n)\nnoise_best, sig = [], []\nfor _ in range(300):\n    x0 = np.array([rng.random() for _ in range(n)])\n    y = np.array([signal * (1 if v > 0.5 else -1) + rng.normal() for v in x0])\n    sst = ((y - y.mean()) ** 2).sum()\n    sig.append(best_gain(y[np.argsort(x0, kind="stable")], all_bounds) / sst)\n    bn = 0.0\n    for _ in range(p):\n        yy = list(y)\n        rng.shuffle(yy)                       # шумовой признак: случайный порядок y\n        bounds = all_bounds\n        if card:\n            cnt = np.zeros(card, int)\n            for _ in range(n):\n                cnt[rng.randint(card)] += 1\n            c = np.cumsum(cnt)[:-1]\n            bounds = c[(c > 0) & (c < n)]\n        bn = max(bn, best_gain(np.array(yy), bounds) / sst)\n    noise_best.append(bn)\nnoise_best, sig = np.array(noise_best), np.array(sig)\nprint(f"шум: средний лучший R² {noise_best.mean():.3f}, 95-й перцентиль {np.quantile(noise_best, 0.95):.3f}")\nprint(f"настоящий признак: R² {sig.mean():.3f}, выиграл в {np.mean(sig > noise_best):.0%} повторов")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 33. Сжатие значений листьев: λ как байесовская оценка
   * ============================================================================== */
  GBC.widget('leaf-shrinkage', (el) => {
    const s = { lam: 0, seed: 1 };
    const J = 40;
    const TAU = 0.5;
    const w = ui.shell(el, { title: 'λ в листе: меньше данных — сильнее сжатие', sub: '40 листьев (или категорий) разного размера: от 1 до 200 объектов. Истинные средние остатков в них μⱼ ~ N(0, 0.5²), шум каждого объекта σ = 1. Значение листа по формуле XGBoost для MSE: w = Σr/(n + λ) = n·ȳ/(n + λ). Сверху — сырые средние (серые), сжатые (синие) и истинные (оранжевые кольца).' });
    ui.slider(w.controls, { label: 'λ (reg_lambda)', values: [0, 0.25, 0.5, 1, 2, 4, 8, 16, 32, 64, 128], value: s.lam, format: String, onInput: (v) => ((s.lam = v), draw()) });
    ui.button(w.controls, { label: 'Другие листья', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'объектов в листе n (лог. шкала)', type: 'log', domain: [0.8, 250], ticks: [1, 2, 5, 10, 20, 50, 100, 200] }, y: { label: 'значение листа' } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'λ (лог. шкала)', type: 'log', domain: [0.25, 128], ticks: [0.25, 1, 4, 16, 64], format: (v) => String(v) }, y: { label: 'средняя ошибка² листьев' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'ошибка² сырых средних (λ = 0)' }, { key: 'c', label: 'при этом λ' }, { key: 'b', label: 'лучшее λ на этих данных' }, { key: 't', label: 'теория σ²/τ²' }]);
    function data() {
      const rng = new GBC.RNG(2200 + s.seed);
      const n = [];
      const mu = [];
      const yb = [];
      for (let j = 0; j < J; j++) {
        const nj = Math.max(1, Math.round(Math.exp(rng.random() * Math.log(200))));
        const m = TAU * rng.normal();
        n.push(nj);
        mu.push(m);
        yb.push(m + rng.normal() / Math.sqrt(nj));
      }
      return { n, mu, yb };
    }
    function draw() {
      const { n, mu, yb } = data();
      const shr = (lam) => yb.map((v, j) => (n[j] * v) / (n[j] + lam));
      const err = (lam) => U.mean(shr(lam).map((v, j) => (v - mu[j]) ** 2));
      const expErr = (lam) => U.mean(n.map((nj) => ((lam / (nj + lam)) ** 2) * TAU * TAU + ((nj / (nj + lam)) ** 2) / nj));
      const cur = shr(s.lam);
      const rng = new GBC.RNG(4);
      const jx = n.map((v) => v * Math.exp(0.08 * (rng.random() - 0.5)));
      p1.render([
        { type: 'hline', y: 0, color: 'ink2', dash: '5 4', width: 1 },
        { type: 'segments', x1: jx, x2: jx, y1: yb, y2: cur, color: 'model', width: 1.4, opacity: 0.55 },
        { type: 'points', x: jx, y: yb, color: 'data', r: 3.6, label: 'сырое среднее ȳ' },
        { type: 'points', x: jx, y: mu, color: 'tree', r: 4.5, hollow: true, label: 'истинное μ' },
        { type: 'points', x: jx, y: cur, color: 'model', r: 4.2, label: 'сжатое n·ȳ/(n + λ)', tooltip: (j) => ['n = ' + n[j], 'ȳ = ' + f3(yb[j]), 'сжатое ' + f3(cur[j]), 'истина ' + f3(mu[j])] },
      ], { y: yDom(yb.concat(mu), 0.05) });
      const lams = U.range(81).map((i) => 0.25 * Math.pow(512, i / 80));
      const e0 = err(0);
      let best = 0;
      let bestE = e0;
      for (const l of lams) if (err(l) < bestE) ((bestE = err(l)), (best = l));
      p2.render([
        { type: 'hline', y: e0, color: 'data', dash: '5 4', width: 1.4, label: 'λ = 0 (сырые средние)' },
        { type: 'line', x: lams, y: lams.map(expErr), color: 'ink2', dash: '3 3', width: 1.6, label: 'ожидаемая (теория)' },
        { type: 'line', x: lams, y: lams.map(err), color: 'model', width: 2.4, label: 'на этих листьях' },
        { type: 'vline', x: (1 / TAU) ** 2, color: 'tree', dash: '6 4', width: 1.4, text: 'σ²/τ² = 4' },
        s.lam > 0 ? { type: 'points', x: [s.lam], y: [err(s.lam)], color: 'model', r: 6 } : null,
      ]);
      st.set('r', f4(e0));
      st.set('c', f4(err(s.lam)));
      st.set('b', f2(best) + ' (' + f4(bestE) + ')');
      st.set('t', '4');
      note.innerHTML = (s.lam === 0 ? 'При λ = 0 значения листьев — сырые средние, и маленькие листья (n = 1–5) очень шумные. Сдвиньте λ вправо. ' : 'Маленькие листья (n = 1–5) дают очень шумные средние, и λ тянет их к нулю сильно: при λ = ' + s.lam + ' лист из 2 объектов сжимается в ' + f1((2 + s.lam) / 2) + ' раза, а лист из 200 — почти не меняется. Ошибка ' + (err(s.lam) < e0 ? 'падает' : 'меняется') + ' с ' + f4(e0) + ' до ' + f4(err(s.lam)) + '. ') + 'Это в точности байесовская оценка из шага 11: если априорно μ ~ N(0, τ²), а шум — σ², апостериорное среднее равно n·ȳ/(n + σ²/τ²). Поэтому лучшее λ ≈ σ²/τ² = 4 для листа <i>любого</i> размера. Тот же приём — сглаживание целевого кодирования категорий (урок 10.1) и априорное значение в CatBoost (урок 9.3).';
    }
    w.pythonAction(() => PY_NP + PY_RNG + '\nlam, J, tau = ' + s.lam + ', 40, 0.5\nrng = Mulberry32(' + (2200 + s.seed) + ')\nn, mu, yb = [], [], []\nfor _ in range(J):\n    nj = max(1, round(np.exp(rng.random() * np.log(200))))\n    m = tau * rng.normal()\n    n.append(nj)\n    mu.append(m)\n    yb.append(m + rng.normal() / np.sqrt(nj))\nn, mu, yb = map(np.array, (n, mu, yb))\nerr = lambda l: np.mean((n * yb / (n + l) - mu) ** 2)\nprint(f"ошибка² листьев: λ = 0 — {err(0):.4f};  λ = {lam} — {err(lam):.4f};  λ = 4 — {err(4):.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 34. Сдвиг данных: Колмогоров — Смирнов и PSI
   * ============================================================================== */
  const KS_TRAIN = (() => {
    const rng = new GBC.RNG(2300);
    return U.range(1000).map(() => rng.normal());
  })();
  GBC.widget('ks-drift', (el) => {
    const s = { n: 1000, shift: 0.1, scale: 1, seed: 1 };
    const w = ui.shell(el, { title: 'Изменились ли данные?', sub: 'Признак на обучении (1000 объектов, синяя ЭФР) и в эксплуатации (n новых объектов, оранжевая). Статистика Колмогорова — Смирнова D — наибольшее вертикальное расстояние между ЭФР (красный отрезок). PSI сравнивает доли по 10 корзинам децилей обучения.' });
    ui.slider(w.controls, { label: 'Новых объектов n', values: [50, 200, 1000, 5000, 20000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Сдвиг среднего', values: [0, 0.05, 0.1, 0.2, 0.5, 1], value: s.shift, format: String, onInput: (v) => ((s.shift = v), draw()) });
    ui.slider(w.controls, { label: 'Масштаб разброса', values: [0.7, 1, 1.2, 1.5], value: s.scale, format: (v) => '×' + v, onInput: (v) => ((s.scale = v), draw()) });
    ui.button(w.controls, { label: 'Новые данные', kind: 'primary', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'значение признака', domain: [-4, 4.5] }, y: { label: 'доля значений ≤ x', domain: [-0.02, 1.04] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'D Колмогорова — Смирнова' }, { key: 'p', label: 'p-значение' }, { key: 'psi', label: 'PSI' }, { key: 'auc', label: 'AUC «обучение vs новые»' }]);
    function draw() {
      const rng = new GBC.RNG(2400 + 31 * s.seed + s.n);
      const nw = U.range(s.n).map(() => s.shift + s.scale * rng.normal());
      const a = U.sortedNumbers(KS_TRAIN);
      const b = U.sortedNumbers(nw);
      let i = 0;
      let j = 0;
      let D = 0;
      let at = 0;
      let fa = 0;
      let fb = 0;
      while (i < a.length || j < b.length) {
        const x = j >= b.length || (i < a.length && a[i] <= b[j]) ? a[i] : b[j];
        while (i < a.length && a[i] <= x) i++;
        while (j < b.length && b[j] <= x) j++;
        const dd = Math.abs(i / a.length - j / b.length);
        if (dd > D) ((D = dd), (at = x), (fa = i / a.length), (fb = j / b.length));
      }
      const ne = (a.length * b.length) / (a.length + b.length);
      const p = kolmogorovSf((Math.sqrt(ne) + 0.12 + 0.11 / Math.sqrt(ne)) * D);
      const edges = U.range(9, 1).map((k) => quantile(KS_TRAIN, k / 10));
      const cnt = new Array(10).fill(0);
      for (const v of nw) {
        let k = 0;
        while (k < 9 && v > edges[k]) k++;
        cnt[k]++;
      }
      let psi = 0;
      for (const c of cnt) {
        const q = Math.max(c / s.n, 1e-4);
        psi += (q - 0.1) * Math.log(q / 0.1);
      }
      const auc = 1 - (() => {
        const r = ranks(KS_TRAIN.concat(nw));
        let sr = 0;
        for (let k = 0; k < KS_TRAIN.length; k++) sr += r[k];
        return (sr - (KS_TRAIN.length * (KS_TRAIN.length + 1)) / 2) / (KS_TRAIN.length * nw.length);
      })();
      const ea = ecdfLine(KS_TRAIN, -4, 4.5);
      const eb = ecdfLine(nw, -4, 4.5);
      plot.render([
        { type: 'line', x: ea.x, y: ea.y, curve: 'step', color: 'blue', width: 2, label: 'обучение' },
        { type: 'line', x: eb.x, y: eb.y, curve: 'step', color: 'orange', width: 2, label: 'эксплуатация' },
        { type: 'segments', x1: [at], x2: [at], y1: [fa], y2: [fb], color: 'red', width: 3.2, opacity: 1 },
        { type: 'text', items: [{ x: at, y: (fa + fb) / 2, dx: 7, text: 'D = ' + f3(D), color: 'red' }] },
      ]);
      st.set('d', f3(D));
      st.set('p', pf(p));
      st.set('psi', f3(psi));
      st.set('auc', f3(auc));
      const level = psi < 0.1 ? 'стабильно' : psi < 0.25 ? 'умеренный сдвиг' : 'сильный сдвиг';
      note.innerHTML = 'D = ' + f3(D) + ', p = ' + pf(p) + (p < 0.05 ? ' — распределения статистически различаются. ' : ' — различие не обнаружено. ') + 'Но p зависит от n: при 20 000 новых объектов значимым становится сдвиг в 0.05σ, который модели безразличен, а при 50 объектах не виден и заметный. Поэтому в мониторинге смотрят на <b>величину</b> сдвига: D, PSI (' + f3(psi) + ' — ' + level + ' по правилу 0.1/0.25) или AUC классификатора «старые против новых» (' + f3(auc) + '; 0.5 — неразличимы, это adversarial validation и снова критерий Манна — Уитни). Подробнее о мониторинге — урок 13.3.';
    }
    w.pythonAction(() => PY_NP + PY_ST + PY_RNG + '\nrng = Mulberry32(2300)\ntrain = np.array([rng.normal() for _ in range(1000)])\nrng = Mulberry32(' + (2400 + 31 * s.seed + s.n) + ')\nnew = np.array([' + py(s.shift) + ' + ' + py(s.scale) + ' * rng.normal() for _ in range(' + s.n + ')])\nres = stats.ks_2samp(train, new)\nprint(f"D = {res.statistic:.3f}, p = {res.pvalue:.3g}")\nedges = np.quantile(train, np.arange(1, 10) / 10)\nq = np.bincount(np.searchsorted(edges, new, side="left"), minlength=10) / len(new)\nq = np.maximum(q, 1e-4)\nprint("PSI =", round(float(np.sum((q - 0.1) * np.log(q / 0.1))), 3))\nprint("AUC «обучение vs новые»:", round(stats.mannwhitneyu(new, train).statistic / (len(new) * len(train)), 3))\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр: задачи со случайными числами
   * ============================================================================== */
  const CATS = { all: 'все разделы', b1: 'описание данных', b2: 'оценки', b3: 'интервалы', b4: 'гипотезы', b5: 'много проверок', b6: 'машинное обучение' };
  const fx = (v, d = 3) => U.fmt(v, d);
  const GEN = [
    (r) => {
      const base = [3, 5, 6, 8, 9][r.randint(5)];
      const xs = [base, base + 2, base + 3, base + 5, base + 40];
      const sorted = xs.slice().sort((a, b) => a - b);
      return { c: 'b1', q: 'Данные: ' + xs.join(', ') + '. Медиана —', right: String(sorted[2]), wrong: [fx(mean(xs), 1), String(sorted[1]), String((sorted[0] + sorted[4]) / 2)], why: 'Медиана — среднее по порядку значение; выброс ' + (base + 40) + ' на неё не влияет, а среднее тянет к ' + fx(mean(xs), 1) + '.' };
    },
    () => ({ c: 'b1', q: 'Распределение доходов скошено вправо. Как обычно соотносятся среднее и медиана?', right: 'среднее больше медианы', wrong: ['медиана больше среднего', 'они равны', 'зависит от объёма выборки'], why: 'Длинный правый хвост тянет среднее вверх.' }),
    (r) => {
      const q1 = 10 + r.randint(10);
      const iqr = 4 + 2 * r.randint(4);
      return { c: 'b1', q: 'Q1 = ' + q1 + ', Q3 = ' + (q1 + iqr) + '. Верхний забор Тьюки —', right: String(q1 + iqr + 1.5 * iqr), wrong: [String(q1 + iqr + iqr), String(q1 + 2 * iqr), String(q1 + iqr + 3 * iqr)], why: 'Q3 + 1.5·IQR = ' + (q1 + iqr) + ' + 1.5·' + iqr + '.' };
    },
    () => ({ c: 'b1', q: 'Корреляция Пирсона признака с целью ≈ 0. Значит…', right: 'линейной связи нет, но нелинейная может быть', wrong: ['признак бесполезен', 'признак и цель независимы', 'дерево его не использует'], why: 'Парабола y = x² даёт r ≈ 0 при полной зависимости.' }),
    (r) => {
      const sdv = [4, 6, 10, 12][r.randint(4)];
      const n = [16, 25, 36, 100][r.randint(4)];
      return { c: 'b2', q: 's = ' + sdv + ', n = ' + n + '. Стандартная ошибка среднего —', right: fx(sdv / Math.sqrt(n)), wrong: [fx(sdv / n), fx(sdv), fx((sdv * sdv) / n)], why: 's/√n = ' + sdv + '/' + Math.sqrt(n) + '.' };
    },
    (r) => {
      const n = [4, 5, 10][r.randint(3)];
      return { c: 'b2', q: 'Дисперсию считают делением на n при n = ' + n + '. На сколько в среднем она занижена?', right: pct(1 / n, 0), wrong: [pct(1 / (n - 1), 0), '0 %', pct(2 / n, 0)], why: 'E = (n − 1)/n·σ², то есть занижение 1/n.' };
    },
    () => ({ c: 'b2', q: 'Почему смещённая оценка бывает лучше несмещённой?', right: 'у неё может быть меньше MSE = смещение² + дисперсия', wrong: ['так не бывает', 'смещение всегда уменьшает дисперсию до нуля', 'она быстрее считается'], why: 'Сжатие к константе уменьшает разброс сильнее, чем добавляет смещения.' }),
    (r) => {
      const k = 2 + r.randint(7);
      const n = 10 + 10 * r.randint(3);
      return { c: 'b2', q: 'Монета: ' + k + ' орлов из ' + n + '. Оценка максимального правдоподобия p̂ =', right: fx(k / n), wrong: [fx(0.5), fx((k + 1) / (n + 2)), fx(k / (n - k))], why: 'Максимум k·ln p + (n − k)·ln(1 − p) — в доле k/n.' };
    },
    (r) => {
      const a = [1, 2, 5][r.randint(3)];
      const b = [9, 18, 45][r.randint(3)];
      const k = 3;
      const n = 4;
      return { c: 'b2', q: 'Априорное Beta(' + a + ', ' + b + '), наблюдали ' + k + ' успеха из ' + n + '. Апостериорное среднее —', right: fx((a + k) / (a + b + n)), wrong: [fx(k / n), fx(a / (a + b)), fx((a + k) / (a + b))], why: '(a + k)/(a + b + n): данные «весят» n, априорное — a + b.' };
    },
    () => ({ c: 'b2', q: 'Для данных с 10 % грубых выбросов центр точнее оценивает…', right: 'медиана', wrong: ['среднее', 'максимум', 'среднее квадратов'], why: 'Выбросы раздувают дисперсию среднего; медиана устойчива.' }),
    (r) => {
      const m = 50 + r.randint(20);
      const sdv = [4, 8][r.randint(2)];
      return { c: 'b3', q: 'n = 16, x̄ = ' + m + ', s = ' + sdv + ', t₀.₉₇₅;₁₅ = 2.131. 95 %-й интервал —', right: '[' + fx(m - 2.131 * sdv / 4, 2) + ', ' + fx(m + 2.131 * sdv / 4, 2) + ']', wrong: ['[' + fx(m - 2.131 * sdv, 2) + ', ' + fx(m + 2.131 * sdv, 2) + ']', '[' + fx(m - 1.96 * sdv / 16, 2) + ', ' + fx(m + 1.96 * sdv / 16, 2) + ']', '[' + (m - sdv) + ', ' + (m + sdv) + ']'], why: 'x̄ ± t·s/√n = ' + m + ' ± 2.131·' + sdv + '/4.' };
    },
    () => ({ c: 'b3', q: 'Чтобы сузить доверительный интервал втрое, данных нужно…', right: 'в 9 раз больше', wrong: ['втрое больше', 'в √3 раз больше', 'в 6 раз больше'], why: 'Ширина ∝ 1/√n.' }),
    (r) => {
      const n = [20, 30, 50, 100][r.randint(4)];
      return { c: 'b3', q: '0 ошибок на ' + n + ' объектах. Верхняя 95 %-я граница доли ошибок по «правилу трёх» —', right: fx(3 / n), wrong: ['0', fx(1 / n), fx(1.96 / n)], why: '(1 − p)ⁿ = 0.05 ⇒ p ≈ 3/n.' };
    },
    () => ({ c: 'b3', q: 'Получен 95 %-й интервал [0.81, 0.85]. Верное прочтение —', right: 'процедура накрывает истину в 95 % случаев', wrong: ['истина внутри с вероятностью 95 %', '95 % объектов имеют точность в этом диапазоне', 'точность 0.83 с ошибкой 5 %'], why: 'Вероятность относится к процедуре, а не к конкретному интервалу (это говорит байесовский достоверный интервал).' }),
    () => ({ c: 'b3', q: 'Когда перцентильный бутстрэп-интервал заведомо не работает?', right: 'для максимума / границы распределения', wrong: ['для медианы', 'для среднего при n = 1000', 'для AUC'], why: 'Бутстрэп-максимум не превышает выборочного, а истина — всегда выше.' }),
    (r) => {
      const k = [58, 60, 62, 65][r.randint(4)];
      const p = 2 * (1 - binomCdf(k - 1, 100, 0.5));
      return { c: 'b4', q: k + ' орлов из 100. Двустороннее p-значение для H₀ «монета честная» ≈', right: fx(p, 4), wrong: [fx(p / 2, 4), fx(1 - p, 4), fx(binomPmf(k, 100, 0.5), 4)], why: 'P(X ≥ ' + k + ') + P(X ≤ ' + (100 - k) + ') при Bin(100, ½).' };
    },
    () => ({ c: 'b4', q: 'p = 0.30 означает…', right: 'такое различие при H₀ встречается часто', wrong: ['H₀ верна с вероятностью 30 %', 'эффекта нет', 'эффект равен 30 %'], why: 'p — вероятность данных (не менее крайних) при H₀.' }),
    (r) => {
      const d = [0.2, 0.3, 0.5][r.randint(3)];
      const n = Math.ceil(((1.96 + 0.8416) / d) ** 2);
      return { c: 'b4', q: 'Эффект d = ' + d + 'σ, α = 0.05, нужна мощность 80 %. Сколько наблюдений?', right: String(n), wrong: [String(Math.ceil((1.96 / d) ** 2)), String(Math.ceil(n / 2)), String(4 * n)], why: 'n = ((1.96 + 0.84)/d)².' };
    },
    () => ({ c: 'b4', q: 'Одни и те же 20 пользователей попробовали оба интерфейса. Какой критерий уместен?', right: 'парный t-критерий по разностям', wrong: ['t-критерий Уэлча для независимых групп', 'χ² независимости', 'критерий Колмогорова — Смирнова'], why: 'Пары сокращают разброс между людьми.' }),
    (r) => {
      const n1 = [5, 8, 10][r.randint(3)];
      const n0 = [10, 20][r.randint(2)];
      const u = Math.round(n1 * n0 * (0.6 + 0.1 * r.randint(3)));
      return { c: 'b4', q: 'Манн — Уитни: U = ' + u + ' при ' + n1 + ' позитивах и ' + n0 + ' негативах. AUC =', right: fx(u / (n1 * n0)), wrong: [fx(u / (n1 + n0)), fx(1 - u / (n1 * n0)), fx(u / (n1 * n0 * 2))], why: 'AUC = U/(n₁n₀).' };
    },
    (r) => {
      const df = [1, 2, 4][r.randint(3)];
      return { c: 'b4', q: 'Таблица сопряжённости ' + (df === 1 ? '2 × 2' : df === 2 ? '3 × 2' : '3 × 3') + '. Степеней свободы χ²:', right: String(df), wrong: [String(df + 1), String(df * 2 + 2), String(df === 4 ? 9 : df === 2 ? 6 : 4)], why: '(r − 1)(c − 1).' };
    },
    (r) => {
      const m = [10, 20, 50][r.randint(3)];
      return { c: 'b5', q: m + ' независимых проверок без эффекта, α = 0.05. Вероятность хотя бы одного ложного открытия ≈', right: pct(1 - Math.pow(0.95, m), 0), wrong: ['5 %', pct(Math.min(1, 0.05 * m * 0.5), 0), pct(0.05 / m, 2)], why: '1 − 0.95^' + m + '.' };
    },
    (r) => {
      const m = [10, 20, 50, 100][r.randint(4)];
      return { c: 'b5', q: 'Поправка Бонферрони для ' + m + ' проверок при α = 0.05: порог для каждой —', right: fx(0.05 / m, 4), wrong: ['0.05', fx(0.05 * m, 2), fx(1 - Math.pow(0.95, m), 3)], why: 'α/m.' };
    },
    () => ({ c: 'b5', q: 'Лучший из 50 равных вариантов на валидации показал 0.86 (SE = 0.02). Чего ждать на тесте?', right: 'около 0.815', wrong: ['0.86', 'около 0.90', 'ничего нельзя сказать'], why: 'Ожидаемый максимум 50 нормальных ≈ 2.25 SE ⇒ завышение ≈ 0.045.' }),
    () => ({ c: 'b5', q: 'Лучшие ученики первого теста во втором тесте в среднем…', right: 'хуже, ближе к среднему', wrong: ['так же хороши', 'ещё лучше', 'хуже всех'], why: 'Регрессия к среднему: часть успеха была везением.' }),
    (r) => {
      const p = [0.8, 0.85, 0.9][r.randint(3)];
      const n = [400, 900, 2500][r.randint(3)];
      return { c: 'b6', q: 'Точность ' + p + ' на тесте из ' + n + ' объектов. SE ≈', right: fx(Math.sqrt((p * (1 - p)) / n), 4), wrong: [fx((p * (1 - p)) / n, 5), fx(Math.sqrt(p / n), 4), fx(1 / Math.sqrt(n), 4)], why: '√(p(1 − p)/n).' };
    },
    () => ({ c: 'b6', q: 'Две модели на одном тесте: A права, B ошиблась — 30 раз; наоборот — 50 раз. Какой критерий?', right: 'Мак-Немара по 30 и 50', wrong: ['z-критерий двух независимых долей', 'χ² по всей таблице без учёта пар', 'Колмогорова — Смирнова'], why: 'Важны только разногласия: Bin(80, ½).' }),
    () => ({ c: 'b6', q: 'Почему наивная SE по фолдам кросс-валидации занижена?', right: 'обучающие части пересекаются — оценки зависимы', wrong: ['фолдов мало', 'MSE не нормальна', 'она не занижена'], why: 'Поправка Надо — Бенжио: × (1/J + n_тест/n_обуч).' }),
    () => ({ c: 'b6', q: 'Почему без min_child_samples дерево находит разбиения на шуме?', right: 'лучший из многих порогов — максимум шумных выигрышей', wrong: ['из-за ошибки округления', 'шум линеен', 'градиент равен нулю'], why: 'Проклятие победителя внутри дерева.' }),
    (r) => {
      const n = [2, 5, 10][r.randint(3)];
      const lam = [1, 4, 10][r.randint(3)];
      return { c: 'b6', q: 'MSE-лист: n = ' + n + ', сумма остатков ' + 2 * n + ', λ = ' + lam + '. Значение листа —', right: fx((2 * n) / (n + lam)), wrong: ['2', fx((2 * n) / lam), fx((2 * n + lam) / n)], why: 'Σr/(n + λ) — сжатие среднего 2 к нулю.' };
    },
    () => ({ c: 'b6', q: 'KS-тест на 100 000 объектов: p = 1e−6, D = 0.01. Вывод?', right: 'сдвиг значим, но крошечный — смотреть на величину', wrong: ['модель срочно переобучать', 'данные полностью изменились', 'тест сломан'], why: 'При огромном n значимо всё; важна величина D, PSI.' }),
  ];
  GBC.widget('stats-game', (el) => {
    const s = { cat: 'all', round: 0, right: 0, done: 0, streak: 0, picked: null, Q: null };
    const w = ui.shell(el, { title: 'Тренажёр: математическая статистика', sub: 'Задачи генерируются со случайными числами по всем шести блокам урока. Решите на бумаге, затем выберите ответ.' });
    ui.select(w.controls, { label: 'Раздел', value: s.cat, options: Object.entries(CATS).map(([k, v]) => ({ value: k, label: v })), onChange: (v) => ((s.cat = v), newQ()) });
    const next = ui.button(w.controls, { label: 'Следующая', icon: 'step', onClick: () => newQ() });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.08rem;padding:6px 0 12px' });
    w.main.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:8px' });
    w.main.appendChild(optsBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'задача' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function newQ() {
      s.round++;
      const rng = new GBC.RNG(7919 * s.round + 23);
      let Q;
      for (let tries = 0; tries < 300; tries++) {
        Q = GEN[rng.randint(GEN.length)](rng);
        if (s.cat === 'all' || Q.c === s.cat) break;
      }
      const uniq = Array.from(new Set([Q.right, ...Q.wrong.filter((x) => x !== Q.right)])).slice(0, 4);
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
      note.innerHTML = s.picked === null ? 'Подсказка: почти любой вопрос статистики — «а что, если бы выборка была другой?».' : (s.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет.</b> ') + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), s.picked === null ? 'Пропустить' : 'Следующая');
    }
    newQ();
  });

  void f1;
  void chi2Ppf;
  void aucOf;
  void binomPmf;
})();
