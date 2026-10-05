/* Урок 15.6: правила дифференцирования. Часть 2 — производные в машинном обучении, техника и проверка.
 * Виджеты: сигмоида и площадь p(1 − p), функции активации, производные потерь бустинга (g и h),
 * псевдо-остатки шести квартир, решатель по шагам, проверка формул числами, правило Лопиталя,
 * граф вычислений и обратное распространение, тренажёр.
 * Помощники — из lesson.js (GBC.lesson156). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const R = String.raw;
  const { curve, texInto, texEl, card, badge, rowTable, nd, sigma, STARS, f3, P, yRange, tanSeg } = GBC.lesson156;

  /* ==============================================================================
   * 17. Сигмоида: σ′ = σ(1 − σ) — площадь прямоугольника со сторонами p и 1 − p
   * ============================================================================== */
  GBC.widget('sigmoid-lab', (el) => {
    const s = { F: Math.log(3) };
    const w = ui.shell(el, { title: 'Сигмоида: наклон равен площади p·(1 − p)', sub: 'Слева — вероятность p = σ(F) и её наклон σ′(F). Справа — единичный квадрат: его сторона разбита на p и 1 − p, а площадь закрашенного прямоугольника p·(1 − p) и есть σ′(F). Максимум площади — у квадрата p = 1 − p = ½.' });
    const sl = ui.slider(w.controls, { label: 'Логит F', min: -8, max: 8, step: 0.05, value: s.F, onInput: (v) => ((s.F = v), draw()) });
    ui.button(w.controls, { label: 'F = 0: максимум', onClick: () => ((s.F = 0), sl.set(0), draw()) });
    ui.button(w.controls, { label: 'F = ln 3: p = 3/4', onClick: () => ((s.F = Math.log(3)), sl.set(s.F), draw()) });
    ui.button(w.controls, { label: 'F = 5: насыщение', onClick: () => ((s.F = 5), sl.set(5), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 270, x: { label: 'логит F', domain: [-8, 8] }, y: { label: 'значение', domain: [-0.05, 1.05] } });
    const p2 = new GBC.Plot(box, { height: 270, equal: true, x: { label: '', domain: [-0.55, 1.12], ticks: [0, 0.5, 1] }, y: { label: '', domain: [-0.2, 1.08], ticks: [0, 0.5, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'p = σ(F)' }, { key: 'q', label: '1 − p' }, { key: 'd', label: 'σ′ = p(1 − p)' }, { key: 'n', label: 'численно' }]);
    function draw() {
      const F = s.F;
      const p = sigma(F);
      const d = p * (1 - p);
      const xs = U.linspace(-8, 8, 401);
      p1.render([
        { type: 'hline', y: 0.25, color: 'muted', width: 1, dash: '4 4', text: 'максимум σ′ = 1/4' },
        { type: 'line', x: xs, y: xs.map(sigma), color: 'model', width: 2.6, label: 'p = σ(F)', hover: false },
        { type: 'line', x: xs, y: xs.map((t) => sigma(t) * (1 - sigma(t))), color: 'tree', width: 2.4, label: 'σ′(F)', hover: false },
        { type: 'segments', ...tanSeg(sigma, () => d, F, 1.6), color: 'tree', width: 2, opacity: 1, dash: '5 3' },
        { type: 'points', x: [F, F], y: [p, d], color: (i) => (i ? 'tree' : 'model'), r: 5.5 },
      ]);
      p2.render([
        { type: 'rect', x0: 0, x1: 1, y0: 0, y1: 1, stroke: 'ink2', width: 1.2, opacity: 0 },
        { type: 'rect', x0: 0, x1: p, y0: 0, y1: 1 - p, fill: 'tree', stroke: 'tree', opacity: 0.45, width: 1.6 },
        { type: 'text', noClip: true, items: [
          { x: p / 2, y: 0, dy: 15, anchor: 'middle', text: 'p = ' + U.fmt(p, 3) },
          { x: 0, y: (1 - p) / 2, dx: -6, anchor: 'end', text: '1 − p = ' + U.fmt(1 - p, 3) },
          { x: 0.5, y: 1, dy: -6, anchor: 'middle', text: 'площадь = ' + U.fmt(d, 4), bold: true },
        ] },
      ]);
      st.set('p', U.fmt(p, 4));
      st.set('q', U.fmt(1 - p, 4));
      st.set('d', U.fmt(d, 5));
      st.set('n', U.fmt(nd(sigma, F), 5));
      let msg = 'σ′(' + U.fmt(F, 2) + ') = ' + U.fmt(p, 3) + ' · ' + U.fmt(1 - p, 3) + ' = <b>' + U.fmt(d, 4) + '</b>. ';
      if (Math.abs(F) < 0.03) msg += 'В нуле p = 1 − p = ½, прямоугольник — квадрат, площадь максимальна: 1/4. Сигмоида круче всего там, где модель меньше всего уверена.';
      else if (Math.abs(F - Math.log(3)) < 0.01) msg += 'При F = ln 3 шансы 3 : 1, p = 3/4, σ′ = 3/4 · 1/4 = 3/16 = 0.1875 — точно, без калькулятора.';
      else if (Math.abs(F) > 4.6) msg += 'Насыщение: p почти 0 или 1, прямоугольник — тонкая полоска, наклон меньше 0.01. Малый сдвиг логита почти не меняет вероятность — модель «уверена».';
      else msg += 'Наклон симметричен: σ′(−F) = σ′(F), потому что σ(−F) = 1 − σ(F) — стороны прямоугольника просто меняются местами.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => 'import numpy as np\n\nsig = lambda z: 1 / (1 + np.exp(-z))\nF = ' + U.pyNum(s.F) + '\np = sig(F)\nprint("σ′ = p(1 − p) =", p * (1 - p), "  численно:", (sig(F + 1e-6) - sig(F - 1e-6)) / 2e-6)\nprint("σ′(ln 3) =", sig(np.log(3)) * (1 - sig(np.log(3))), "= 3/16 =", 3 / 16)\n');
    draw();
  });

  /* ==============================================================================
   * 18. Родня сигмоиды и функции активации; затухание произведения наклонов
   * ============================================================================== */
  const ACT = {
    sig: { label: 'σ(x) — сигмоида', f: sigma, df: (x) => sigma(x) * (1 - sigma(x)), max: 0.25, rule: 'σ′ = σ(1 − σ)', py: ['1 / (1 + np.exp(-x))', 'f(x) * (1 - f(x))'] },
    tanh: { label: 'th x — гиперболический тангенс', f: Math.tanh, df: (x) => 1 - Math.tanh(x) ** 2, max: 1, rule: 'th′ = 1 − th²', py: ['np.tanh(x)', '1 - np.tanh(x)**2'] },
    soft: { label: 'softplus = ln(1 + eˣ)', f: (x) => Math.log1p(Math.exp(x)), df: sigma, max: 1, rule: '(ln(1 + eˣ))′ = σ(x)', py: ['np.log1p(np.exp(x))', '1 / (1 + np.exp(-x))'] },
    relu: { label: 'ReLU = max(0, x)', f: (x) => Math.max(0, x), df: (x) => (x > 0 ? 1 : 0), max: 1, rule: 'ReLU′ = 1 при x > 0 и 0 при x < 0', py: ['np.maximum(0, x)', '(x > 0).astype(float)'] },
    logsig: { label: 'ln σ(x) — кусок log-loss', f: (x) => -Math.log1p(Math.exp(-x)), df: (x) => 1 - sigma(x), max: 1, rule: '(ln σ)′ = σ′/σ = 1 − σ', py: ['-np.log1p(np.exp(-x))', '1 - 1 / (1 + np.exp(-x))'] },
    atan: { label: 'arctg x', f: Math.atan, df: (x) => 1 / (1 + x * x), max: 1, rule: '(arctg x)′ = 1/(1 + x²)', py: ['np.arctan(x)', '1 / (1 + x**2)'] },
  };
  GBC.widget('activations', (el) => {
    const s = { f: 'sig', x: 1, k: 5 };
    const w = ui.shell(el, { title: 'Родня сигмоиды: функции активации и их производные', sub: 'Каждую производную даёт цепное правило из этого урока. Нижняя строка показателей — что будет, если поставить k таких функций друг за другом (как слои нейросети): производная цепочки — произведение k наклонов, и она не больше (max f′)ᵏ.' });
    ui.select(w.controls, { label: 'Функция', value: s.f, options: Object.entries(ACT).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.f = v), draw()) });
    ui.slider(w.controls, { label: 'Точка x', min: -5, max: 5, step: 0.05, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    ui.slider(w.controls, { label: 'Число слоёв k', min: 1, max: 10, step: 1, value: s.k, format: (v) => String(v), onInput: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'x', domain: [-6, 6] }, y: { label: 'значение' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'f(x)' }, { key: 'd', label: 'f′(x)' }, { key: 'm', label: 'max f′' }, { key: 'k', label: '(max f′)ᵏ' }]);
    function draw() {
      const A = ACT[s.f];
      const x = s.x;
      const xs = U.linspace(-6, 6, 481);
      const cd = curve(A.df, -6, 6, 481, { jump: 0.5 });
      plot.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: xs, y: xs.map(A.f), color: 'model', width: 2.6, label: 'f(x)', hover: false },
        { type: 'line', x: cd.x, y: cd.y, color: 'tree', width: 2.4, label: 'f′(x)', hover: false },
        { type: 'segments', ...tanSeg(A.f, A.df, x, 1.2), color: 'tree', width: 2, dash: '5 3', opacity: 1 },
        { type: 'points', x: [x, x], y: [A.f(x), A.df(x)], color: (i) => (i ? 'tree' : 'model'), r: 5.5 },
      ], { y: s.f === 'soft' || s.f === 'relu' ? [-1, 6.2] : s.f === 'logsig' ? [-6.2, 1.2] : [-1.6, 1.6] });
      const gain = Math.pow(A.max, s.k);
      st.set('f', U.fmt(A.f(x), 4));
      st.set('d', U.fmt(A.df(x), 4));
      st.set('m', A.max === 1 && s.f === 'soft' ? '1 (не достигается)' : f3(A.max));
      st.set('k', U.fmt(gain, 3));
      const T = {
        sig: 'Сигмоида пропускает не больше четверти наклона: через ' + s.k + ' слоёв останется ≤ 0.25' + GBC.lesson156.sup(s.k) + ' = ' + U.fmt(gain, 3) + '. Это «затухание градиента» — причина, по которой глубокие сети ушли от сигмоид к ReLU. В бустинге сигмоида стоит один раз — в самом конце, поэтому проблемы нет.',
        tanh: 'th x = 2σ(2x) − 1 — та же сигмоида, растянутая на [−1, 1]. По цепному правилу th′ = 2·2σ′(2x) = 1 − th²: в нуле наклон 1, вдали — тоже насыщение.',
        soft: 'Гладкая версия ReLU. По цепному правилу (ln(1 + eˣ))′ = eˣ/(1 + eˣ) = σ(x): производная softplus — сигмоида. А log-loss по логиту — это softplus: ln(1 + e^F) − yF, отсюда градиент σ(F) − y.',
        relu: 'Наклон 1 справа и 0 слева: через любое число «открытых» слоёв градиент проходит без затухания. В нуле — излом (шаг 15); производную там договорились считать нулём.',
        logsig: 'ln σ(x) = −ln(1 + e⁻ˣ). Производная (1/σ)·σ(1 − σ) = 1 − σ — стремится к 1 при x → −∞: даже очень уверенная ошибка даёт градиент не больше 1. Это половина log-loss при y = 1.',
        atan: 'Производная обратной функции (шаг 12): у tg наклон 1 + tg²y, у arctg — обратное число 1/(1 + x²).',
      };
      note.innerHTML = '<b>' + A.rule + '</b>. ' + T[s.f];
    }
    w.pythonAction(() => {
      const A = ACT[s.f];
      return 'import numpy as np\n\nf = lambda x: ' + A.py[0] + '\ndf = lambda x: ' + A.py[1] + '\nx = np.array([-3.0, -1.0, ' + U.pyNum(s.x) + ', 2.0])\nprint("формула :", np.round(df(x), 6))\nprint("численно:", np.round((f(x + 1e-6) - f(x - 1e-6)) / 2e-6, 6))\nk = ' + s.k + '\nprint(f"верхняя граница наклона цепочки из {k} слоёв: {' + U.pyNum(A.max) + '**k:.3g}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 19–20. Производные функций потерь по прогнозу: градиент g и вторая производная h
   * ============================================================================== */
  const LOSS = {
    l2: { label: 'квадратичная ½(y − F)², y = 3', y: 3, opt: 3, L: (F, y) => 0.5 * (y - F) ** 2, g: (F, y) => F - y, h: () => 1, dom: [-1, 7], gtex: 'g = F − y', chain: 'внешнее ½u², внутреннее u = y − F с u′ = −1: g = u·(−1) = F − y', py: ['0.5 * (y - F)**2', 'F - y', '1 + 0 * F'] },
    l1: { label: 'абсолютная |y − F|, y = 3', y: 3, opt: 3, L: (F, y) => Math.abs(y - F), g: (F, y) => (F === y ? NaN : Math.sign(F - y)), h: () => 0, dom: [-1, 7], gtex: 'g = sign(F − y)', chain: '(|u|)′ = sign u, u′ = −1: g = −sign(y − F); в F = y — излом', py: ['np.abs(y - F)', 'np.sign(F - y)', '0 * F'] },
    huber: { label: 'Хьюбер, δ = 1, y = 3', y: 3, opt: 3, L: (F, y) => (Math.abs(y - F) <= 1 ? 0.5 * (y - F) ** 2 : Math.abs(y - F) - 0.5), g: (F, y) => U.clamp(F - y, -1, 1), h: (F, y) => (Math.abs(F - y) <= 1 ? 1 : 0), dom: [-1, 7], gtex: 'g = clip(F − y, −δ, δ)', chain: 'внутри |y − F| ≤ δ — как квадратичная, снаружи — как δ·|y − F|: градиент «обрезан» до ±δ', py: ['np.where(np.abs(y - F) <= 1, 0.5 * (y - F)**2, np.abs(y - F) - 0.5)', 'np.clip(F - y, -1, 1)', '(np.abs(F - y) <= 1).astype(float)'] },
    quant: { label: 'квантильная, α = 0.9, y = 3', y: 3, opt: 3, L: (F, y) => (y >= F ? 0.9 * (y - F) : 0.1 * (F - y)), g: (F, y) => (y > F ? -0.9 : y < F ? 0.1 : NaN), h: () => 0, dom: [-1, 7], gtex: 'g = −α при F < y, 1 − α при F > y', chain: 'две прямые с наклонами −α и 1 − α; недопрогноз штрафуется в 9 раз сильнее перепрогноза', py: ['np.where(y >= F, 0.9 * (y - F), 0.1 * (F - y))', 'np.where(y > F, -0.9, 0.1)', '0 * F'] },
    log1: { label: 'log-loss, y = 1', y: 1, opt: null, L: (F) => Math.log1p(Math.exp(-F)), g: (F) => sigma(F) - 1, h: (F) => sigma(F) * (1 - sigma(F)), dom: [-5, 5], gtex: 'g = σ(F) − y = p − 1', chain: '∂L/∂p = −1/p, ∂p/∂F = p(1 − p): g = −(1 − p) = p − 1', py: ['np.log1p(np.exp(-F))', '1 / (1 + np.exp(-F)) - 1', 'sig(F) * (1 - sig(F))'] },
    log0: { label: 'log-loss, y = 0', y: 0, opt: null, L: (F) => Math.log1p(Math.exp(F)), g: (F) => sigma(F), h: (F) => sigma(F) * (1 - sigma(F)), dom: [-5, 5], gtex: 'g = σ(F) − y = p', chain: '∂L/∂p = 1/(1 − p), ∂p/∂F = p(1 − p): g = p', py: ['np.log1p(np.exp(F))', '1 / (1 + np.exp(-F))', 'sig(F) * (1 - sig(F))'] },
    pois: { label: 'Пуассона, y = 3 (F = ln μ)', y: 3, opt: Math.log(3), L: (F, y) => Math.exp(F) - y * F, g: (F, y) => Math.exp(F) - y, h: (F) => Math.exp(F), dom: [-1.5, 2.5], gtex: 'g = e^F − y = μ − y', chain: 'μ = e^F: ∂L/∂μ = 1 − y/μ, ∂μ/∂F = μ, произведение μ − y', py: ['np.exp(F) - y * F', 'np.exp(F) - y', 'np.exp(F)'] },
    expo: { label: 'экспоненциальная (AdaBoost), y = +1', y: 1, opt: null, L: (F, y) => Math.exp(-y * F), g: (F, y) => -y * Math.exp(-y * F), h: (F, y) => y * y * Math.exp(-y * F), dom: [-2, 3], gtex: 'g = −y·e^(−yF)', chain: 'внешнее eᵘ, внутреннее u = −yF с u′ = −y: g = −y·e^(−yF)', py: ['np.exp(-y * F)', '-y * np.exp(-y * F)', 'y**2 * np.exp(-y * F)'] },
    gamma: { label: 'Гамма, y = 2 (F = ln μ)', y: 2, opt: Math.log(2), L: (F, y) => y * Math.exp(-F) + F, g: (F, y) => 1 - y * Math.exp(-F), h: (F, y) => y * Math.exp(-F), dom: [-1, 3], gtex: 'g = 1 − y·e^(−F) = 1 − y/μ', chain: 'L = y/μ + ln μ при μ = e^F: (y·e^(−F))′ = −y·e^(−F), (F)′ = 1', py: ['y * np.exp(-F) + F', '1 - y * np.exp(-F)', 'y * np.exp(-F)'] },
  };
  GBC.widget('loss-derivatives', (el) => {
    const s = { l: 'l2', F: 1, h: false };
    const w = ui.shell(el, { title: 'Производные функций потерь по прогнозу', sub: 'Слева — потери L(F) при фиксированном ответе y, справа — их производная по прогнозу F (градиент g). Минус градиент — псевдо-остаток, который предсказывает очередное дерево. Включите h — вторую производную: её использует XGBoost.' });
    ui.select(w.controls, { label: 'Функция потерь', value: s.l, options: Object.entries(LOSS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.l = v;
      const D = LOSS[v].dom;
      s.F = U.clamp(v.startsWith('log') ? -1 : 1, D[0] + 0.1, D[1] - 0.1);
      fs.set(s.F);
      draw();
    } });
    const fs = ui.slider(w.controls, { label: 'Прогноз F', min: -5, max: 7, step: 0.05, value: s.F, onInput: (v) => ((s.F = v), draw()) });
    ui.toggle(w.controls, { label: 'Показать h = ∂²L/∂F²', checked: false, onChange: (v) => ((s.h = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 270, x: { label: 'прогноз F' }, y: { label: 'потери L' } });
    const p2 = new GBC.Plot(box, { height: 270, x: { label: 'прогноз F' }, y: { label: 'g = ∂L/∂F' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'L(F)' }, { key: 'g', label: 'g = ∂L/∂F' }, { key: 'r', label: 'псевдо-остаток −g' }, { key: 'h', label: 'h = ∂²L/∂F²' }]);
    function draw() {
      const Ls = LOSS[s.l];
      const F = U.clamp(s.F, Ls.dom[0], Ls.dom[1]);
      const xs = U.linspace(Ls.dom[0], Ls.dom[1], 401);
      const g = Ls.g(F, Ls.y);
      const hh = Ls.h(F, Ls.y);
      const gs = xs.map((x) => Ls.g(x, Ls.y));
      const gap = gs.map((v, i) => (i && Math.abs(v - gs[i - 1]) > 0.3 ? NaN : v));
      const hs = xs.map((x) => Ls.h(x, Ls.y));
      const hgap = hs.map((v, i) => (i && Math.abs(v - hs[i - 1]) > 0.3 ? NaN : v));
      const L0 = Ls.L(F, Ls.y);
      p1.render([
        Ls.opt !== null ? { type: 'vline', x: Ls.opt, color: 'ink2', dash: '3 3', width: 1, text: s.l === 'pois' ? 'минимум F = ln 3' : s.l === 'gamma' ? 'минимум F = ln 2' : 'y = ' + Ls.y } : null,
        { type: 'line', x: xs, y: xs.map((x) => Ls.L(x, Ls.y)), color: 'model', width: 2.4, hover: false },
        Number.isFinite(g) ? { type: 'segments', x1: [F - 1], y1: [L0 - g], x2: [F + 1], y2: [L0 + g], color: 'tree', width: 2.4, opacity: 1 } : null,
        { type: 'points', x: [F], y: [L0], color: 'tree', r: 6 },
      ], { x: Ls.dom });
      p2.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: xs, y: gap, color: 'tree', width: 2.4, label: 'g', hover: false },
        s.h ? { type: 'line', x: xs, y: hgap, color: 'violet', width: 2, dash: '6 4', label: 'h', hover: false } : null,
        Number.isFinite(g) ? { type: 'points', x: [F], y: [g], color: 'tree', r: 6 } : null,
        s.h ? { type: 'points', x: [F], y: [hh], color: 'violet', r: 5 } : null,
      ], { x: Ls.dom });
      st.set('L', U.fmt(L0, 4));
      st.set('g', Number.isFinite(g) ? U.fmt(g, 4) : 'нет (излом)');
      st.set('r', Number.isFinite(g) ? U.fmt(-g, 4) : '—');
      st.set('h', U.fmt(hh, 4));
      let msg = '<b>' + Ls.gtex + '</b> — цепочка: ' + Ls.chain + '. ';
      msg += g > 0 ? 'g > 0: потери растут вправо — прогноз нужно уменьшать.' : g < 0 ? 'g &lt; 0: потери растут влево — прогноз нужно увеличивать.' : 'g = 0 или не определён: здесь минимум потерь.';
      if (s.h) msg += ' h = ' + U.fmt(hh, 4) + (hh === 0 ? ': кривизны нет — шаг Ньютона −g/h не определён, листья считают иначе (урок 5.3).' : ': кривизна; шаг Ньютона −g/h = ' + U.fmt(-g / hh, 3) + ' (урок 15.7).');
      if (s.l.startsWith('log')) msg += ' Градиент ограничен: |p − y| ≤ 1, как бы сильно модель ни ошиблась.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const Ls = LOSS[s.l];
      return 'import numpy as np\n\nsig = lambda z: 1 / (1 + np.exp(-z))\ny = ' + Ls.y + '\nL = lambda F: ' + Ls.py[0] + '\ng = lambda F: ' + Ls.py[1] + '   # ∂L/∂F\nh = lambda F: ' + Ls.py[2] + '   # ∂²L/∂F²\nF = ' + U.pyNum(s.F) + '\neps = 1e-5\nprint("g =", g(F), " численно:", (L(F + eps) - L(F - eps)) / (2 * eps))\nprint("h =", h(F), " численно:", (L(F + eps) - 2 * L(F) + L(F - eps)) / eps**2)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 21. Псевдо-остатки на шести квартирах: какой прогноз-константу «тянут» данные
   * ============================================================================== */
  const YAP = [2, 4, 3, 7, 9, 11];
  const PB = {
    l2: { label: 'MSE: −g = y − c', r: (y, c) => y - c, L: (y, c) => 0.5 * (y - c) ** 2, best: 6, py: 'y - c' },
    l1: { label: 'MAE: −g = sign(y − c)', r: (y, c) => Math.sign(y - c), L: (y, c) => Math.abs(y - c), best: 5.5, py: 'np.sign(y - c)' },
    huber: { label: 'Хьюбер, δ = 2: −g = clip(y − c, ±2)', r: (y, c) => U.clamp(y - c, -2, 2), L: (y, c) => (Math.abs(y - c) <= 2 ? 0.5 * (y - c) ** 2 : 2 * (Math.abs(y - c) - 1)), best: 5.5, py: 'np.clip(y - c, -2, 2)' },
    q9: { label: 'квантиль α = 0.9: −g = 0.9 или −0.1', r: (y, c) => (y > c ? 0.9 : y < c ? -0.1 : 0), L: (y, c) => (y >= c ? 0.9 * (y - c) : 0.1 * (c - y)), best: 11, py: 'np.where(y > c, 0.9, -0.1)' },
  };
  GBC.widget('pseudo-bars', (el) => {
    const s = { l: 'l2', c: 3 };
    const w = ui.shell(el, { title: 'Псевдо-остатки: куда тянут данные', sub: 'Шесть квартир (цены 2, 4, 3, 7, 9, 11 млн) и общий прогноз c. Столбики — псевдо-остатки −∂L/∂c каждой квартиры: «на сколько и куда сдвинуть прогноз ради неё». Их среднее — минус производная средних потерь. Двигайте c или делайте шаги спуска: в лучшей константе силы уравновешены.' });
    ui.select(w.controls, { label: 'Потери', value: s.l, options: Object.entries(PB).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.l = v), draw()) });
    const cs = ui.slider(w.controls, { label: 'Прогноз c, млн', min: 0, max: 12, step: 0.05, value: s.c, onInput: (v) => ((s.c = v), draw()) });
    ui.button(w.controls, { label: 'Шаг спуска: c ← c + 0.5·среднее(−g)', icon: 'step', onClick: () => {
      const B = PB[s.l];
      s.c = U.clamp(s.c + 0.5 * U.mean(YAP.map((y) => B.r(y, s.c))), 0, 12);
      cs.set(s.c);
      draw();
    } });
    ui.button(w.controls, { label: 'Лучшая константа', kind: 'primary', onClick: () => ((s.c = PB[s.l].best), cs.set(s.c), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'квартира', domain: [0.4, 6.6], ticks: [1, 2, 3, 4, 5, 6] }, y: { label: 'цена, млн', domain: [0, 12.5] } });
    const p2 = new GBC.Plot(w.main, { height: 190, x: { label: 'квартира', domain: [0.4, 6.6], ticks: [1, 2, 3, 4, 5, 6] }, y: { label: 'псевдо-остаток −g' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'c' }, { key: 'm', label: 'среднее(−g) = −L′(c)' }, { key: 'L', label: 'средние потери' }, { key: 'dir', label: 'куда двигать c' }]);
    function draw() {
      const B = PB[s.l];
      const c = s.c;
      const xs = [1, 2, 3, 4, 5, 6];
      const r = YAP.map((y) => B.r(y, c));
      const m = U.mean(r);
      p1.render([
        { type: 'hline', y: c, color: 'model', width: 2.4, text: 'c = ' + U.fmt(c, 2) },
        { type: 'segments', x1: xs, y1: YAP, x2: xs, y2: xs.map(() => c), color: 'residual', width: 1.6, opacity: 0.9 },
        { type: 'points', x: xs, y: YAP, color: 'data', r: 6, tooltip: (i) => [['квартира', String(i + 1)], ['цена', String(YAP[i])], ['y − c', U.fmt(YAP[i] - c, 3)]] },
      ]);
      const [lo, hi] = U.extent([0, ...r]);
      const pad = (hi - lo) * 0.2 || 0.5;
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'bars', x: xs, y: r, color: (i) => (r[i] >= 0 ? 'pos' : 'neg'), width: 0.6, maxPx: 46, tooltip: (i) => [['−g', U.fmt(r[i], 3)]] },
        { type: 'hline', y: m, color: 'tree', width: 2, dash: '5 4', text: 'среднее ' + U.fmt(m, 3) },
      ], { y: [lo - pad, hi + pad] });
      st.set('c', U.fmt(c, 3));
      st.set('m', U.fmt(m, 4));
      st.set('L', U.fmt(U.mean(YAP.map((y) => B.L(y, c))), 4));
      st.set('dir', Math.abs(m) < 1e-9 ? 'никуда — минимум' : m > 0 ? 'вверх ↑' : 'вниз ↓');
      const T = {
        l2: 'Для MSE псевдо-остаток — обычный остаток y − c. Среднее равно нулю при c = ȳ = 6: лучшая константа — среднее.',
        l1: 'Для MAE каждая квартира тянет с силой ±1, независимо от того, насколько она далеко. Равновесие (три вверх, три вниз) — на всей «полочке» от 4 до 7: любая медиана.',
        huber: 'Хьюбер с δ = 2 обрезает тягу дальних квартир (2 и 11) до ±2. Равновесие при c = 5.5 — между медианой и средним: выбросы влияют, но не командуют.',
        q9: 'Квантильные потери α = 0.9: квартира выше прогноза тянет вверх с силой 0.9, ниже — вниз с силой 0.1. Равновесие там, где выше остаётся не больше 10 % точек — при c = 11 (максимум из шести).',
      };
      note.innerHTML = T[s.l] + ' Сейчас среднее(−g) = ' + U.fmt(m, 3) + (Math.abs(m) < 1e-9 ? ' — силы уравновешены.' : m > 0 ? ' > 0: увеличьте c.' : ' &lt; 0: уменьшите c.') + ' Бустинг делает то же самое для каждой квартиры отдельно: дерево учится предсказывать эти столбики (урок 5.1).';
    }
    w.pythonAction(() => {
      const B = PB[s.l];
      return 'import numpy as np\n\ny = np.array([2, 4, 3, 7, 9, 11], dtype=float)\nc = ' + U.pyNum(s.c) + '\nfor step in range(6):\n    r = ' + B.py + '              # псевдо-остатки −∂L/∂c\n    print(f"c = {c:.4f}: −g = {np.round(r, 3)}, среднее {r.mean():+.4f}")\n    c = c + 0.5 * r.mean()                   # шаг градиентного спуска\n';
    });
    draw();
  });

  /* ==============================================================================
   * 22. Решатель по шагам: от разминки до log-loss
   * ============================================================================== */
  const TASKS = [
    { lvl: 1, name: 'многочлен 4x³ − 2x + 7', tex: R`f(x)=4x^3-2x+7`, f: (x) => 4 * x ** 3 - 2 * x + 7, df: (x) => 12 * x * x - 2, dom: [-1.6, 1.6], py: ['4 * x**3 - 2 * x + 7', '12 * x**2 - 2'], steps: [
      ['линейность', 'Дифференцируем по слагаемым', R`f'=(4x^3)'-(2x)'+(7)'`], ['степень, константа', 'Множитель выносится; степень; константа даёт 0', R`=4\cdot3x^2-2\cdot1+0`], ['ответ', 'Итог', R`f'(x)=12x^2-2`]] },
    { lvl: 1, name: 'корень и дробь 3√x + 2/x', tex: R`f(x)=3\sqrt x+\frac2x`, f: (x) => 3 * Math.sqrt(x) + 2 / x, df: (x) => 1.5 / Math.sqrt(x) - 2 / (x * x), dom: [0.4, 4], py: ['3 * np.sqrt(x) + 2 / x', '1.5 / np.sqrt(x) - 2 / x**2'], steps: [
      ['степень', 'Перепишем как степени', R`f=3x^{1/2}+2x^{-1}`], ['степень', 'Правило степени к каждому слагаемому', R`f'=3\cdot\tfrac12x^{-1/2}+2\cdot(-1)\,x^{-2}`], ['ответ', 'Итог', R`f'(x)=\frac{3}{2\sqrt x}-\frac{2}{x^2}`]] },
    { lvl: 1, name: 'произведение x²·eˣ', tex: R`f(x)=x^2e^x`, f: (x) => x * x * Math.exp(x), df: (x) => Math.exp(x) * (x * x + 2 * x), dom: [-4, 1], py: ['x**2 * np.exp(x)', 'np.exp(x) * (x**2 + 2 * x)'], steps: [
      ['произведение', 'u = x², v = eˣ', R`(uv)'=u'v+uv'`], ['таблица', 'Производные множителей', R`u'=2x,\qquad v'=e^x`], ['ответ', 'Подставляем и выносим eˣ', R`f'(x)=2x\,e^x+x^2e^x=e^x(x^2+2x)`]] },
    { lvl: 1, name: 'x·ln x − x', tex: R`f(x)=x\ln x-x`, f: (x) => x * Math.log(x) - x, df: Math.log, dom: [0.1, 3], py: ['x * np.log(x) - x', 'np.log(x)'], steps: [
      ['линейность', 'Разность двух слагаемых', R`f'=(x\ln x)'-(x)'`], ['произведение', 'Первое слагаемое — произведение', R`(x\ln x)'=1\cdot\ln x+x\cdot\frac1x=\ln x+1`], ['ответ', 'Единицы сокращаются', R`f'(x)=\ln x+1-1=\ln x`]] },
    { lvl: 2, name: 'частное (x² + 1)/(x − 1)', tex: R`f(x)=\frac{x^2+1}{x-1}`, f: (x) => (x * x + 1) / (x - 1), df: (x) => (x * x - 2 * x - 1) / (x - 1) ** 2, dom: [1.25, 5], py: ['(x**2 + 1) / (x - 1)', '(x**2 - 2 * x - 1) / (x - 1)**2'], steps: [
      ['частное', 'u = x² + 1, v = x − 1', R`\Bigl(\frac uv\Bigr)'=\frac{u'v-uv'}{v^2}`], ['таблица', 'u′ = 2x, v′ = 1', R`f'=\frac{2x(x-1)-(x^2+1)\cdot1}{(x-1)^2}`], ['ответ', 'Раскрываем числитель', R`f'(x)=\frac{x^2-2x-1}{(x-1)^2}`], ['смысл', 'Нуль числителя — минимум', R`x=1+\sqrt2\approx2.414,\quad f=2+2\sqrt2\approx4.828`]] },
    { lvl: 2, name: 'цепочка (3x + 1)⁵', tex: R`f(x)=(3x+1)^5`, f: (x) => (3 * x + 1) ** 5, df: (x) => 15 * (3 * x + 1) ** 4, dom: [-0.75, 0.25], py: ['(3 * x + 1)**5', '15 * (3 * x + 1)**4'], steps: [
      ['цепное правило', 'Внешняя u⁵, внутренняя u = 3x + 1', R`f'=5u^4\cdot u'`], ['таблица', 'u′ = 3', R`f'=5(3x+1)^4\cdot3`], ['ответ', 'Итог', R`f'(x)=15(3x+1)^4`]] },
    { lvl: 2, name: 'цепочка √(1 + x²)', tex: R`f(x)=\sqrt{1+x^2}`, f: (x) => Math.sqrt(1 + x * x), df: (x) => x / Math.sqrt(1 + x * x), dom: [-3, 3], py: ['np.sqrt(1 + x**2)', 'x / np.sqrt(1 + x**2)'], steps: [
      ['цепное правило', 'Внешняя √u, внутренняя u = 1 + x²', R`f'=\frac{1}{2\sqrt u}\cdot u'`], ['таблица', 'u′ = 2x', R`f'=\frac{2x}{2\sqrt{1+x^2}}`], ['ответ', 'Двойки сокращаются', R`f'(x)=\frac{x}{\sqrt{1+x^2}}`]] },
    { lvl: 2, name: 'колокол e^(−x²/2)', tex: R`f(x)=e^{-x^2/2}`, f: (x) => Math.exp((-x * x) / 2), df: (x) => -x * Math.exp((-x * x) / 2), dom: [-3, 3], py: ['np.exp(-x**2 / 2)', '-x * np.exp(-x**2 / 2)'], steps: [
      ['цепное правило', '(eᵘ)′ = eᵘ·u′, u = −x²/2', R`f'=e^{-x^2/2}\cdot\Bigl(-\frac{x^2}{2}\Bigr)'`], ['ответ', 'u′ = −x', R`f'(x)=-x\,e^{-x^2/2}`], ['смысл', 'Знак f′ — это знак −x', R`f'(0)=0\ \text{— вершина колокола}`]] },
    { lvl: 2, name: 'softplus ln(1 + eˣ)', tex: R`f(x)=\ln(1+e^x)`, f: (x) => Math.log1p(Math.exp(x)), df: sigma, dom: [-5, 5], py: ['np.log1p(np.exp(x))', '1 / (1 + np.exp(-x))'], steps: [
      ['цепное правило', '(ln u)′ = u′/u, u = 1 + eˣ', R`f'=\frac{(1+e^x)'}{1+e^x}`], ['таблица', 'Производная внутренней — eˣ', R`f'=\frac{e^x}{1+e^x}`], ['ответ', 'Делим числитель и знаменатель на eˣ', R`f'(x)=\frac{1}{1+e^{-x}}=\sigma(x)`]] },
    { lvl: 2, name: 'тангенс tg x', tex: R`f(x)=\operatorname{tg}x=\frac{\sin x}{\cos x}`, f: Math.tan, df: (x) => 1 / Math.cos(x) ** 2, dom: [-1.2, 1.2], py: ['np.tan(x)', '1 / np.cos(x)**2'], steps: [
      ['частное', 'u = sin x, v = cos x', R`f'=\frac{(\sin x)'\cos x-\sin x\,(\cos x)'}{\cos^2x}`], ['таблица', 'Подставляем', R`=\frac{\cos^2x+\sin^2x}{\cos^2x}`], ['ответ', 'sin² + cos² = 1', R`f'(x)=\frac{1}{\cos^2x}=1+\operatorname{tg}^2x`]] },
    { lvl: 3, name: 'сигмоида σ(x)', tex: R`\sigma(x)=\frac{1}{1+e^{-x}}`, f: sigma, df: (x) => sigma(x) * (1 - sigma(x)), dom: [-6, 6], py: ['1 / (1 + np.exp(-x))', 'f(x) * (1 - f(x))'], steps: [
      ['степень', 'Запишем как степень', R`\sigma=(1+e^{-x})^{-1}`], ['цепное правило', 'Внешняя u⁻¹, внутренняя u = 1 + e⁻ˣ, u′ = −e⁻ˣ', R`\sigma'=-(1+e^{-x})^{-2}\cdot(-e^{-x})=\frac{e^{-x}}{(1+e^{-x})^2}`], ['алгебра', 'Разбиваем на два множителя', R`\sigma'=\frac{1}{1+e^{-x}}\cdot\frac{e^{-x}}{1+e^{-x}}`], ['ответ', 'Второй множитель — это 1 − σ', R`\sigma'(x)=\sigma(x)\bigl(1-\sigma(x)\bigr)`]] },
    { lvl: 3, name: 'xˣ — логарифмическое', tex: R`f(x)=x^x`, f: (x) => Math.pow(x, x), df: (x) => Math.pow(x, x) * (Math.log(x) + 1), dom: [0.05, 2], py: ['x**x', 'x**x * (np.log(x) + 1)'], steps: [
      ['логарифм', 'Логарифмируем', R`\ln f=x\ln x`], ['цепное + произведение', 'Слева — цепочка (ln f)′ = f′/f, справа — произведение', R`\frac{f'}{f}=\ln x+1`], ['ответ', 'Умножаем на f', R`f'(x)=x^x(\ln x+1)`]] },
    { lvl: 3, name: 'обратная: arctg x', tex: R`f(x)=\operatorname{arctg}x`, f: Math.atan, df: (x) => 1 / (1 + x * x), dom: [-4, 4], py: ['np.arctan(x)', '1 / (1 + x**2)'], steps: [
      ['обратная функция', 'y = arctg x ⇔ tg y = x', R`\operatorname{tg}y=x`], ['цепное правило', 'Дифференцируем по x; слева — цепочка', R`\frac{1}{\cos^2y}\cdot y'=1`], ['ответ', '1/cos²y = 1 + tg²y = 1 + x²', R`y'=\frac{1}{1+\operatorname{tg}^2y}=\frac{1}{1+x^2}`]] },
    { lvl: 3, name: 'три звена e^(sin(x²))', tex: R`f(x)=e^{\sin(x^2)}`, f: (x) => Math.exp(Math.sin(x * x)), df: (x) => 2 * x * Math.cos(x * x) * Math.exp(Math.sin(x * x)), dom: [-2, 2], py: ['np.exp(np.sin(x**2))', '2 * x * np.cos(x**2) * np.exp(np.sin(x**2))'], steps: [
      ['цепное правило', 'x → u = x² → v = sin u → eᵛ', R`f'=\frac{d\,e^v}{dv}\cdot\frac{dv}{du}\cdot\frac{du}{dx}`], ['таблица', 'Производные звеньев', R`(e^v)'=e^v,\quad(\sin u)'=\cos u,\quad(x^2)'=2x`], ['ответ', 'Перемножаем', R`f'(x)=2x\cos(x^2)\,e^{\sin(x^2)}`]] },
    { lvl: 3, name: 'ln(x + √(x² + 1))', tex: R`f(x)=\ln\bigl(x+\sqrt{x^2+1}\bigr)`, f: (x) => Math.log(x + Math.sqrt(x * x + 1)), df: (x) => 1 / Math.sqrt(x * x + 1), dom: [-3, 3], py: ['np.log(x + np.sqrt(x**2 + 1))', '1 / np.sqrt(x**2 + 1)'], steps: [
      ['цепное правило', 'Внешняя ln u, внутренняя u = x + √(x² + 1)', R`f'=\frac{u'}{u}`], ['сумма + цепочка', 'u′ — сумма; корень по цепочке', R`u'=1+\frac{x}{\sqrt{x^2+1}}=\frac{\sqrt{x^2+1}+x}{\sqrt{x^2+1}}`], ['ответ', 'Числитель u′ совпадает с u и сокращается', R`f'(x)=\frac{1}{\sqrt{x^2+1}}`]] },
    { lvl: 3, name: 'log-loss по логиту F (график — при y = 1)', tex: R`L(F)=-\bigl[y\ln\sigma(F)+(1-y)\ln(1-\sigma(F))\bigr]`, f: (x) => Math.log1p(Math.exp(-x)), df: (x) => sigma(x) - 1, dom: [-5, 5], py: ['np.log1p(np.exp(-x))', '1 / (1 + np.exp(-x)) - 1'], steps: [
      ['цепное правило', 'Через вероятность p = σ(F)', R`\frac{\partial L}{\partial F}=\frac{\partial L}{\partial p}\cdot\frac{\partial p}{\partial F}`], ['таблица', 'Внешнее звено: (ln p)′ = 1/p, (ln(1 − p))′ = −1/(1 − p)', R`\frac{\partial L}{\partial p}=-\frac yp+\frac{1-y}{1-p}=\frac{p-y}{p(1-p)}`], ['сигмоида', 'Внутреннее звено', R`\frac{\partial p}{\partial F}=p(1-p)`], ['ответ', 'p(1 − p) сокращается', R`\frac{\partial L}{\partial F}=p-y=\sigma(F)-y`]] },
  ];
  GBC.widget('diff-solver', (el) => {
    const s = { i: 0, k: 1 };
    const w = ui.shell(el, { title: 'Решатель: производная шаг за шагом', sub: 'Шестнадцать задач от ★ (разминка) до ★★★ (с подвохом). Нажимайте «шаг вперёд»: у каждого шага подписано правило. Попробуйте сначала сделать шаг сами. График — функция и её производная по ответу; кружки — численная производная: если они легли на линию, ответ верен.' });
    ui.select(w.controls, { label: 'Задача', value: '0', options: TASKS.map((E, i) => ({ value: String(i), label: STARS[E.lvl] + ' ' + (i + 1) + '. ' + E.name })), onChange: (v) => {
      s.i = +v;
      player.setMax(TASKS[s.i].steps.length);
      player.set(1);
      s.k = 1;
      draw();
    } });
    const player = ui.player(w.controls, { label: 'Шаг решения', min: 0, max: TASKS[0].steps.length, value: 1, fps: 0.7, format: (k, m) => 'шаг ' + k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const prob = card('Задача', true);
    w.main.appendChild(prob.el);
    const probTex = H('div', { style: 'overflow-x:auto;overflow-y:hidden' });
    prob.body.appendChild(probTex);
    const list = H('ol', { style: 'margin:8px 0 0;padding-left:1.4em;display:grid;gap:8px;min-width:0' });
    prob.body.appendChild(list);
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'значение' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 's', label: 'шаг' }, { key: 'e', label: 'макс. |формула − численно|' }]);
    function draw() {
      const E = TASKS[s.i];
      texInto(probTex, R`\text{Найти производную: }\ ` + E.tex, true);
      list.textContent = '';
      E.steps.slice(0, s.k).forEach(([rule, txt, t], j) => {
        const li = H('li', { style: 'opacity:' + (j === s.k - 1 ? 1 : 0.8) },
          H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:.92rem;color:var(--ink-2)' }, badge(rule, rule === 'ответ' ? 'good' : 'neutral'), txt));
        li.appendChild(texEl('\\displaystyle ' + t, false, 'padding:3px 0'));
        list.appendChild(li);
      });
      const fin = s.k >= E.steps.length || E.steps.slice(0, s.k).some((t) => t[0] === 'ответ');
      const xs = U.linspace(E.dom[0], E.dom[1], 401);
      const pts = U.linspace(E.dom[0] + 0.05 * (E.dom[1] - E.dom[0]), E.dom[1] - 0.05 * (E.dom[1] - E.dom[0]), 17);
      const num = pts.map((x) => nd(E.f, x));
      const err = Math.max(...pts.map((x, i) => Math.abs(num[i] - E.df(x)) / Math.max(1, Math.abs(E.df(x)))));
      const layers = [
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: xs, y: xs.map(E.f), color: 'model', width: 2.4, label: 'f(x)', hover: false },
      ];
      if (fin) {
        layers.push({ type: 'line', x: xs, y: xs.map(E.df), color: 'tree', width: 2.4, label: 'f′(x) по ответу', hover: false });
        layers.push({ type: 'points', x: pts, y: num, color: 'ink', r: 3.5, hollow: true, label: 'численно', tooltip: (i) => [['x', f3(pts[i])], ['численно', U.fmt(num[i], 6)], ['ответ', U.fmt(E.df(pts[i]), 6)]] });
      }
      plot.render(layers, { x: E.dom, y: yRange(fin ? [E.f, E.df] : [E.f], xs, 0.1) });
      st.set('s', s.k + ' из ' + E.steps.length);
      st.set('e', fin ? U.fmt(err, 2) : '—');
      note.innerHTML = fin
        ? 'Ответ проверен численно: относительное расхождение с центральной разностью <b>' + U.fmt(err, 2) + '</b> — на уровне ошибок округления. Правила применяются <em>снаружи внутрь</em>: сначала главная операция формулы, потом — то, что у неё внутри.'
        : s.k === 0 ? 'Посмотрите на формулу: какая операция выполняется <em>последней</em>? С её правила и начинается решение.' : 'Шаг ' + s.k + ' из ' + E.steps.length + '. Какое правило нужно дальше?';
    }
    w.pythonAction(() => {
      const E = TASKS[s.i];
      return 'import numpy as np\n\nf = lambda x: ' + E.py[0] + '\ndf = lambda x: ' + E.py[1] + '   # ответ решателя\nx = np.linspace(' + U.pyNum(E.dom[0] + 0.1) + ', ' + U.pyNum(E.dom[1] - 0.1) + ', 7)\nnum = (f(x + 1e-6) - f(x - 1e-6)) / 2e-6\nprint("ответ  :", np.round(df(x), 6))\nprint("числено:", np.round(num, 6))\n# символьно (если установлен sympy):\ntry:\n    import sympy as sp\n    X = sp.symbols("x")\n    print("sympy:", sp.simplify(sp.diff(' + E.py[0].replace(/np\.log1p\(np\.exp\(([^)]*)\)\)/g, 'sp.log(1 + sp.exp($1))').replace(/np\./g, 'sp.').replace(/\bx\b/g, 'X').replace(/sp\.arctan/g, 'sp.atan') + ', X)))\nexcept Exception as e:\n    print("sympy недоступен:", type(e).__name__)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 23. Проверка формулы числами — и как ловятся типичные ошибки
   * ============================================================================== */
  const TBL = {
    xex: { label: 'x·eˣ → eˣ(1 + x)', f: (x) => x * Math.exp(x), d: (x) => Math.exp(x) * (1 + x), bad: Math.exp, why: 'eˣ — «(uv)′ = u′·v′»', dom: [-3, 1.2] },
    sinx2: { label: 'sin(x²) → 2x·cos(x²)', f: (x) => Math.sin(x * x), d: (x) => 2 * x * Math.cos(x * x), bad: (x) => Math.cos(x * x), why: 'cos(x²) — забыта внутренняя производная 2x', dom: [-2.5, 2.5] },
    e2x: { label: 'e^(−2x) → −2·e^(−2x)', f: (x) => Math.exp(-2 * x), d: (x) => -2 * Math.exp(-2 * x), bad: (x) => Math.exp(-2 * x), why: 'e^(−2x) — забыт множитель −2', dom: [-1, 2] },
    ln1x2: { label: 'ln(1 + x²) → 2x/(1 + x²)', f: (x) => Math.log(1 + x * x), d: (x) => (2 * x) / (1 + x * x), bad: (x) => 1 / (1 + x * x), why: '1/(1 + x²) — забыт множитель (1 + x²)′ = 2x', dom: [-3, 3] },
    xq: { label: 'x/(1 + x²) → (1 − x²)/(1 + x²)²', f: (x) => x / (1 + x * x), d: (x) => (1 - x * x) / (1 + x * x) ** 2, bad: (x) => (1 + 3 * x * x) / (1 + x * x) ** 2, why: '(1 + 3x²)/(1 + x²)² — плюс вместо минуса в числителе частного', dom: [-3, 3] },
    tan: { label: 'tg x → 1/cos²x', f: Math.tan, d: (x) => 1 / Math.cos(x) ** 2, bad: (x) => (Math.sin(x) ** 2 - Math.cos(x) ** 2) / Math.cos(x) ** 2, why: '(sin² − cos²)/cos² — в частном перепутаны местами u′v и uv′', dom: [-1.2, 1.2] },
    exp2: { label: '2ˣ → 2ˣ·ln 2', f: (x) => Math.pow(2, x), d: (x) => Math.pow(2, x) * Math.LN2, bad: (x) => x * Math.pow(2, x - 1), why: 'x·2ˣ⁻¹ — правило степени применено к показательной функции', dom: [-2, 3] },
    xx: { label: 'xˣ → xˣ(ln x + 1)', f: (x) => Math.pow(x, x), d: (x) => Math.pow(x, x) * (Math.log(x) + 1), bad: (x) => x * Math.pow(x, x - 1), why: 'x·xˣ⁻¹ — правило степени для переменного показателя', dom: [0.1, 2] },
    sigm: { label: 'σ(x) → σ(x)(1 − σ(x))', f: sigma, d: (x) => sigma(x) * (1 - sigma(x)), bad: (x) => 1 - sigma(x), why: 'e⁻ˣ/(1 + e⁻ˣ) — потерян квадрат знаменателя', dom: [-6, 6] },
    sqrt: { label: '√x → 1/(2√x)', f: Math.sqrt, d: (x) => 1 / (2 * Math.sqrt(x)), bad: (x) => 1 / Math.sqrt(x), why: '1/√x — потерян множитель ½', dom: [0.15, 4] },
    lnx: { label: 'ln x → 1/x', f: Math.log, d: (x) => 1 / x, bad: null, dom: [0.2, 4] },
    sin: { label: 'sin x → cos x', f: Math.sin, d: Math.cos, bad: (x) => -Math.cos(x), why: '−cos x — перепутан знак (знак минус — у производной косинуса)', dom: [-4, 4] },
  };
  GBC.widget('derivative-check', (el) => {
    const s = { fn: 'sinx2', bad: true };
    const w = ui.shell(el, { title: 'Проверяем формулы числами', sub: 'Линия — производная по формуле. Кружки — численная производная (f(x + ε) − f(x − ε))/2ε в 25 точках. Если формула верна, кружки ложатся на линию. Красный пунктир — типичная ошибка: посмотрите, как сразу её видно.' });
    ui.select(w.controls, { label: 'Функция и её производная', value: s.fn, options: Object.entries(TBL).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.fn = v), draw()) });
    ui.toggle(w.controls, { label: 'Показать типичную ошибку', checked: true, onChange: (v) => ((s.bad = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 270, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(box, { height: 270, x: { label: 'x' }, y: { label: 'f′(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'расхождение верной формулы' }, { key: 'b', label: 'расхождение ошибочной' }]);
    function draw() {
      const T = TBL[s.fn];
      const xs = U.linspace(T.dom[0], T.dom[1], 301);
      const pts = U.linspace(T.dom[0] + 0.02, T.dom[1] - 0.02, 25);
      const e = 1e-5;
      const num = pts.map((x) => (T.f(x + e) - T.f(x - e)) / (2 * e));
      const err = Math.max(...pts.map((x, i) => Math.abs(num[i] - T.d(x))));
      const errB = T.bad ? Math.max(...pts.map((x, i) => Math.abs(num[i] - T.bad(x)))) : NaN;
      const showBad = s.bad && T.bad;
      p1.render([{ type: 'line', x: xs, y: xs.map(T.f), color: 'model', width: 2.2, hover: false }]);
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: xs, y: xs.map(T.d), color: 'tree', width: 2.2, label: 'по формуле', hover: false },
        showBad ? { type: 'line', x: xs, y: xs.map(T.bad), color: 'critical', width: 2, dash: '6 4', label: 'типичная ошибка', hover: false } : null,
        { type: 'points', x: pts, y: num, color: 'ink', r: 3.5, hollow: true, label: 'численно', tooltip: (i) => [['x', f3(pts[i])], ['численно', U.fmt(num[i], 6)], ['формула', U.fmt(T.d(pts[i]), 6)]] },
      ], { y: yRange(showBad ? [T.d, T.bad] : [T.d], xs, 0.1, 30) });
      st.set('e', U.fmt(err, 2));
      st.set('b', T.bad ? U.fmt(errB, 2) : '—');
      note.innerHTML = 'Наибольшее расхождение верной формулы с численной производной: <b>' + U.fmt(err, 2) + '</b> — шум округления. ' + (showBad ? 'У ошибочной формулы «' + T.why + '» — <b>' + U.fmt(errB, 2) + '</b>: кружки уходят от красной линии. ' : '') + 'Такая проверка (gradient check) — обязательный шаг, когда вы пишете свою функцию потерь (урок 10.3).';
    }
    w.pythonAction(() => 'import numpy as np\n\ndef grad_check(f, df, xs, eps=1e-5):\n    """Максимальное расхождение формулы df с центральной разностью."""\n    num = (f(xs + eps) - f(xs - eps)) / (2 * eps)\n    return np.max(np.abs(num - df(xs)))\n\nxs = np.linspace(-2, 2, 25)\nf = lambda x: np.sin(x**2)\nprint("верно 2x·cos(x²):", grad_check(f, lambda x: 2 * x * np.cos(x**2), xs))\nprint("ошибка cos(x²)  :", grad_check(f, lambda x: np.cos(x**2), xs))\n');
    draw();
  });

  /* ==============================================================================
   * 24. Правило Лопиталя: около точки числитель и знаменатель — почти прямые
   * ============================================================================== */
  const LH = {
    cube: { label: '(x³ − 8)/(x − 2), x → 2', f: (x) => x ** 3 - 8, g: (x) => x - 2, d1: [(x) => 3 * x * x, () => 1], a: 2, L: 12, order: 1, W: 1, tex: R`\frac{3x^2}{1}\Big|_{x=2}=12` },
    sinc: { label: 'sin x / x, x → 0', f: Math.sin, g: (x) => x, d1: [Math.cos, () => 1], a: 0, L: 1, order: 1, W: 2.5, tex: R`\frac{\cos x}{1}\Big|_{x=0}=1` },
    e2x: { label: '(e^{2x} − 1)/sin x, x → 0', f: (x) => Math.expm1(2 * x), g: Math.sin, d1: [(x) => 2 * Math.exp(2 * x), Math.cos], a: 0, L: 2, order: 1, W: 1, tex: R`\frac{2e^{2x}}{\cos x}\Big|_{x=0}=2` },
    ln: { label: 'ln x / (x − 1), x → 1', f: Math.log, g: (x) => x - 1, d1: [(x) => 1 / x, () => 1], a: 1, L: 1, order: 1, W: 0.8, tex: R`\frac{1/x}{1}\Big|_{x=1}=1` },
    cos2: { label: '(1 − cos x)/x², x → 0 — дважды', f: (x) => 1 - Math.cos(x), g: (x) => x * x, d1: [Math.sin, (x) => 2 * x], d2: [Math.cos, () => 2], a: 0, L: 0.5, order: 2, W: 2.5, tex: R`\frac{\sin x}{2x}\ \to\ \frac00\ \Rightarrow\ \frac{\cos x}{2}\Big|_{x=0}=\frac12` },
    exp2: { label: '(eˣ − 1 − x)/x², x → 0 — дважды', f: (x) => Math.expm1(x) - x, g: (x) => x * x, d1: [Math.expm1, (x) => 2 * x], d2: [Math.exp, () => 2], a: 0, L: 0.5, order: 2, W: 1.5, tex: R`\frac{e^x-1}{2x}\ \to\ \frac00\ \Rightarrow\ \frac{e^x}{2}\Big|_{x=0}=\frac12` },
  };
  GBC.widget('lhopital-zoom', (el) => {
    const NK = 30;
    const s = { c: 'cube', k: 0 };
    const w = ui.shell(el, { title: 'Правило Лопиталя под микроскопом', sub: 'Сверху — числитель f и знаменатель g около точки a, где оба равны нулю; пунктир — их главные приближения (касательные, а если наклоны тоже нули — параболы). Нажмите ▶: окно сжимается, кривые неотличимы от приближений, и отношение f/g (внизу) подходит к отношению наклонов.' });
    ui.select(w.controls, { label: 'Предел', value: s.c, options: Object.entries(LH).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.c = v), draw()) });
    ui.player(w.controls, { label: 'Масштаб окна', min: 0, max: NK, value: 0, fps: 5, format: (k) => 'полуширина ' + U.fmt(Math.pow(10, (-3 * k) / NK), 3) + '·W', onChange: (k) => ((s.k = k), draw()) });
    const ans = card('Отношение производных', true);
    const ansT = H('div');
    ans.body.appendChild(ansT);
    w.main.appendChild(ans.el);
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: 'f и g' } });
    const p2 = new GBC.Plot(w.main, { height: 180, x: { label: 'x' }, y: { label: 'f(x)/g(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'полуширина окна' }, { key: 'q', label: 'f/g на краю окна' }, { key: 'L', label: 'предел' }]);
    function draw() {
      const E = LH[s.c];
      const half = E.W * Math.pow(10, (-3 * s.k) / NK);
      const a = E.a;
      const xs = U.linspace(a - half, a + half, 301).filter((x) => Math.abs(x - a) > half * 1e-6);
      const two = E.order === 2;
      const kf = two ? E.d2[0](a) / 2 : E.d1[0](a);
      const kg = two ? E.d2[1](a) / 2 : E.d1[1](a);
      const af = (x) => kf * (two ? (x - a) ** 2 : x - a);
      const ag = (x) => kg * (two ? (x - a) ** 2 : x - a);
      const xl = U.linspace(a - half, a + half, 301);
      texInto(ansT, R`\lim_{x\to${a}}\frac{f}{g}=` + E.tex, true);
      p1.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'vline', x: a, color: 'ink2', width: 1, dash: '3 3' },
        { type: 'line', x: xl, y: xl.map(E.f), color: 'model', width: 2.6, label: 'числитель f', hover: false },
        { type: 'line', x: xl, y: xl.map(E.g), color: 'aqua', width: 2.6, label: 'знаменатель g', hover: false },
        { type: 'line', x: xl, y: xl.map(af), color: 'model', width: 1.4, dash: '5 4', label: two ? 'f″(a)/2·(x − a)²' : 'f′(a)·(x − a)', hover: false },
        { type: 'line', x: xl, y: xl.map(ag), color: 'aqua', width: 1.4, dash: '5 4', label: two ? 'g″(a)/2·(x − a)²' : 'g′(a)·(x − a)', hover: false },
      ], { x: [a - half, a + half] });
      const q = (x) => E.f(x) / E.g(x);
      const left = xs.filter((x) => x < a);
      const right = xs.filter((x) => x > a);
      const qv = xs.map(q).filter(Number.isFinite);
      let [lo, hi] = U.extent([...qv, E.L]);
      const pad = Math.max((hi - lo) * 0.2, Math.abs(E.L) * 0.02, 1e-3);
      p2.render([
        { type: 'hline', y: E.L, color: 'tree', width: 1.6, dash: '6 4', text: 'предел ' + U.fmt(E.L, 3) },
        { type: 'line', x: left, y: left.map(q), color: 'model', width: 2.4, hover: false },
        { type: 'line', x: right, y: right.map(q), color: 'model', width: 2.4, hover: false },
        { type: 'points', x: [a], y: [E.L], color: 'model', r: 5, hollow: true },
      ], { x: [a - half, a + half], y: [lo - pad, hi + pad] });
      st.set('w', U.fmt(half, 3));
      st.set('q', U.fmt(q(a + half), 6));
      st.set('L', U.fmt(E.L, 4));
      note.innerHTML = (two
        ? 'Здесь f(a) = g(a) = 0 <em>и</em> f′(a) = g′(a) = 0: касательные обе горизонтальны, отношение наклонов — снова 0/0. Правило применяют второй раз: главные члены — параболы, и отношение их «кривизн» f″/g″ = ' + U.fmt(E.L, 3) + '.'
        : 'Около a обе функции почти прямые: f ≈ f′(a)(x − a), g ≈ g′(a)(x − a). Множитель (x − a) сокращается, остаётся f′(a)/g′(a) = ' + U.fmt(E.L, 3) + '.') + ' При полуширине ' + U.fmt(half, 3) + ' отношение на краю окна — ' + U.fmt(q(a + half), 6) + '.';
    }
    w.pythonAction(() => {
      const py = { cube: ['x**3 - 8', 'x - 2', 2], sinc: ['np.sin(x)', 'x', 0], e2x: ['np.expm1(2 * x)', 'np.sin(x)', 0], ln: ['np.log(x)', 'x - 1', 1], cos2: ['1 - np.cos(x)', 'x**2', 0], exp2: ['np.expm1(x) - x', 'x**2', 0] }[s.c];
      return 'import numpy as np\n\nf = lambda x: ' + py[0] + '\ng = lambda x: ' + py[1] + '\na = ' + py[2] + '\nfor h in [0.1, 0.01, 0.001, 1e-4]:\n    x = a + h\n    print(f"x = a + {h:<6}: f/g = {f(x) / g(x):.8f}")\nprint("предел по Лопиталю:", ' + U.pyNum(LH[s.c].L) + ')\n';
    });
    draw();
  });

  /* ==============================================================================
   * 25. Граф вычислений: прямой проход, обратный проход и «вперёд» по одной переменной
   * ============================================================================== */
  const BP_NODES = {
    w: { x: 70, y: 46, name: 'w', kind: 'param' },
    x: { x: 70, y: 136, name: 'x', kind: 'data' },
    b: { x: 70, y: 226, name: 'b', kind: 'param' },
    m: { x: 215, y: 91, name: 'm = w·x', kind: 'op' },
    z: { x: 345, y: 160, name: 'z = m + b', kind: 'op' },
    p: { x: 470, y: 160, name: 'p = σ(z)', kind: 'op' },
    y: { x: 470, y: 46, name: 'y', kind: 'data' },
    L: { x: 595, y: 104, name: 'L = log-loss', kind: 'op' },
  };
  const BP_EDGES = [['w', 'm', 'x'], ['x', 'm', 'w'], ['m', 'z', '1'], ['b', 'z', '1'], ['z', 'p', 'p(1−p)'], ['p', 'L', '(p−y)/(p(1−p))'], ['y', 'L', '']];
  GBC.widget('backprop', (el) => {
    const s = { w: 1.5, b: -0.5, x: 1, y: 1, mode: 'rev', k: 0 };
    const w = ui.shell(el, { title: 'Граф вычислений: цепное правило в программе', sub: 'Логистическая модель на одном объекте: z = w·x + b, p = σ(z), L = −[y ln p + (1 − y) ln(1 − p)]. «Обратный проход» сначала считает значения слева направо, затем градиенты ∂L/∂(узел) справа налево — перемножая локальные производные на рёбрах. «Вперёд по w» и «вперёд по b» несут вместе со значением производную по одной переменной (дуальные числа).' });
    ui.segmented(w.controls, { label: 'Режим', value: s.mode, options: [{ value: 'rev', label: 'обратный' }, { value: 'fw', label: 'вперёд по w' }, { value: 'fb', label: 'вперёд по b' }], onChange: (v) => {
      s.mode = v;
      pl.setMax(v === 'rev' ? 9 : 5);
      pl.set(0);
      s.k = 0;
      draw();
    } });
    const pl = ui.player(w.controls, { label: 'Шаги', min: 0, max: 9, value: 0, fps: 1.2, format: (k, m) => 'шаг ' + k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    ui.slider(w.controls, { label: 'Вес w', min: -3, max: 3, step: 0.1, value: s.w, onInput: (v) => ((s.w = v), draw()) });
    ui.slider(w.controls, { label: 'Сдвиг b', min: -3, max: 3, step: 0.1, value: s.b, onInput: (v) => ((s.b = v), draw()) });
    ui.slider(w.controls, { label: 'Признак x', min: -2, max: 2, step: 0.1, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    ui.segmented(w.controls, { label: 'Ответ y', value: '1', options: [{ value: '0', label: 'y = 0' }, { value: '1', label: 'y = 1' }], onChange: (v) => ((s.y = +v), draw()) });
    const svgBox = H('div', { style: 'overflow-x:auto;padding:2px 0 6px' });
    w.main.appendChild(svgBox);
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'L' }, { key: 'gw', label: '∂L/∂w' }, { key: 'gb', label: '∂L/∂b = p − y' }, { key: 'n', label: 'численно ∂L/∂w, ∂L/∂b' }]);
    function compute() {
      const m = s.w * s.x;
      const z = m + s.b;
      const p = sigma(z);
      const L = -(s.y * Math.log(p) + (1 - s.y) * Math.log(1 - p));
      const pb = -s.y / p + (1 - s.y) / (1 - p);
      const zb = p - s.y;
      return { w: s.w, x: s.x, b: s.b, y: s.y, m, z, p, L, bar: { L: 1, p: pb, z: zb, m: zb, b: zb, w: zb * s.x, x: zb * s.w } };
    }
    const lossAt = (wv, bv) => {
      const p = sigma(wv * s.x + bv);
      return -(s.y * Math.log(p) + (1 - s.y) * Math.log(1 - p));
    };
    function draw() {
      const V = compute();
      const rev = s.mode === 'rev';
      const fwd = !rev;
      const seed = s.mode === 'fw' ? { w: 1, x: 0, b: 0 } : { w: 0, x: 0, b: 1 };
      const tan = { w: seed.w, x: seed.x, b: seed.b, y: 0 };
      tan.m = tan.w * V.x + V.w * tan.x;
      tan.z = tan.m + tan.b;
      tan.p = V.p * (1 - V.p) * tan.z;
      tan.L = V.bar.p * tan.p;
      const FWD = ['m', 'z', 'p', 'L'];
      const BWD = [['L'], ['p'], ['z'], ['m', 'b'], ['w', 'x']];
      const valShown = new Set(['w', 'x', 'b', 'y']);
      const gradShown = new Set();
      let cur = [];
      if (rev) {
        FWD.slice(0, Math.min(s.k, 4)).forEach((n) => valShown.add(n));
        if (s.k <= 4 && s.k > 0) cur = [FWD[s.k - 1]];
        if (s.k > 4) {
          BWD.slice(0, s.k - 4).forEach((g) => g.forEach((n) => gradShown.add(n)));
          cur = BWD[s.k - 5];
        }
      } else {
        if (s.k >= 1) ['w', 'x', 'b'].forEach((n) => gradShown.add(n));
        FWD.slice(0, Math.max(0, s.k - 1)).forEach((n) => (valShown.add(n), gradShown.add(n)));
        cur = s.k === 1 ? ['w', 'x', 'b'] : s.k > 1 ? [FWD[s.k - 2]] : [];
      }
      const Wd = 660;
      const Hd = 266;
      const BW = 112;
      const BH = 54;
      const svg = S('svg', { viewBox: '0 0 ' + Wd + ' ' + Hd, width: Wd, height: Hd, role: 'img', 'aria-label': 'Граф вычислений', style: 'width:100%;max-width:' + Wd + 'px;min-width:560px;height:auto;display:block;margin:0 auto' });
      for (const [a, b] of BP_EDGES) {
        const A = BP_NODES[a];
        const B = BP_NODES[b];
        const x1 = A.x + BW / 2;
        const x2 = B.x - BW / 2;
        // подсветка: в обратном проходе — рёбра, по которым градиент пришёл в текущие узлы; иначе — входы текущего узла
        const hot = rev && s.k > 4 ? cur.includes(a) && gradShown.has(b) : cur.includes(b);
        const col = hot ? 'var(--c-tree)' : 'var(--border-strong)';
        svg.appendChild(S('line', { x1, y1: A.y, x2, y2: B.y, style: 'stroke:' + col + ';stroke-width:' + (hot ? 2.6 : 1.6) }));
        const ang = Math.atan2(B.y - A.y, x2 - x1);
        const hx = (k, d) => x2 - k * Math.cos(ang) + d * Math.sin(ang);
        const hy = (k, d) => B.y - k * Math.sin(ang) - d * Math.cos(ang);
        svg.appendChild(S('path', { d: 'M' + x2 + ',' + B.y + 'L' + hx(9, 4.5) + ',' + hy(9, 4.5) + 'L' + hx(9, -4.5) + ',' + hy(9, -4.5) + 'Z', style: 'fill:' + col }));
      }
      for (const [k, N] of Object.entries(BP_NODES)) {
        const isCur = cur.includes(k);
        const hasV = valShown.has(k);
        const hasG = gradShown.has(k) && k !== 'y';
        const stl = isCur ? 'fill:var(--c-tree);fill-opacity:.16;stroke:var(--c-tree);stroke-width:2.4'
          : N.kind === 'param' ? 'fill:var(--c-model);fill-opacity:.1;stroke:var(--c-model);stroke-width:1.6'
            : N.kind === 'data' ? 'fill:var(--surface-2);stroke:var(--border-strong);stroke-width:1.2'
              : 'fill:var(--surface);stroke:var(--border-strong);stroke-width:1.2';
        svg.appendChild(S('rect', { x: N.x - BW / 2, y: N.y - BH / 2, width: BW, height: BH, rx: 10, style: stl }));
        svg.appendChild(S('text', { x: N.x, y: N.y - 9, 'text-anchor': 'middle', style: 'fill:var(--ink);font-size:12.5px;font-weight:650' }, N.name));
        svg.appendChild(S('text', { x: N.x, y: N.y + 7, 'text-anchor': 'middle', style: 'fill:var(--ink-2);font-size:11px;font-variant-numeric:tabular-nums' }, hasV ? '= ' + U.fmt(V[k], 4) : '= ?'));
        if (k !== 'y') svg.appendChild(S('text', { x: N.x, y: N.y + 21, 'text-anchor': 'middle', style: 'fill:var(--ink-2);font-size:11px;font-variant-numeric:tabular-nums' }, (rev ? '∂L/∂' + k + ' ' : 'd' + k + '/d' + (s.mode === 'fw' ? 'w' : 'b') + ' ') + (hasG ? '= ' + U.fmt(rev ? V.bar[k] : tan[k], 4) : '= ?')));
      }
      svgBox.replaceChildren(svg);
      const rows = [];
      if (rev) {
        const loc = { m: '∂m/∂w = x, ∂m/∂x = w', z: '∂z/∂m = 1, ∂z/∂b = 1', p: '∂p/∂z = p(1 − p) = ' + U.fmt(V.p * (1 - V.p), 4), L: '∂L/∂p = (p − y)/(p(1 − p))' };
        FWD.forEach((n) => valShown.has(n) && rows.push(['прямой', BP_NODES[n].name, U.fmt(V[n], 5), loc[n], '']));
        const how = { L: '1 (начало)', p: '∂L/∂p = ' + U.fmt(V.bar.p, 4), z: P(V.bar.p) + ' · ' + U.fmt(V.p * (1 - V.p), 4) + ' = p − y', m: '∂L/∂z · 1', b: '∂L/∂z · 1', w: '∂L/∂m · x = ' + P(V.bar.m) + ' · ' + P(V.x), x: '∂L/∂m · w = ' + P(V.bar.m) + ' · ' + P(V.w) };
        BWD.flat().forEach((n) => gradShown.has(n) && rows.push(['обратный', n, '', how[n], U.fmt(V.bar[n], 5)]));
        rowTable(tbl, ['проход', 'узел', 'значение', 'локальная производная / расчёт', '∂L/∂узел'], rows.length ? rows : [['—', 'нажмите ▶', '', '', '']], (i) => i === rows.length - 1, false);
      } else {
        const v = s.mode === 'fw' ? 'w' : 'b';
        const how = { m: 'ẇ·x + w·ẋ', z: 'ṁ + ḃ', p: 'p(1 − p)·ż', L: '∂L/∂p · ṗ' };
        if (s.k >= 1) rows.push(['затравка', 'w, x, b', U.fmt(V.w, 3) + ', ' + U.fmt(V.x, 3) + ', ' + U.fmt(V.b, 3), 'производные по ' + v + ': ' + seed.w + ', ' + seed.x + ', ' + seed.b, '']);
        FWD.forEach((n) => gradShown.has(n) && rows.push(['вперёд', BP_NODES[n].name, U.fmt(V[n], 5), how[n], U.fmt(tan[n], 5)]));
        rowTable(tbl, ['шаг', 'узел', 'значение', 'правило для производной', 'd/d' + v], rows.length ? rows : [['—', 'нажмите ▶', '', '', '']], (i) => i === rows.length - 1, false);
      }
      const eps = 1e-6;
      st.set('L', U.fmt(V.L, 5));
      st.set('gw', U.fmt(V.bar.w, 5));
      st.set('gb', U.fmt(V.bar.b, 5));
      st.set('n', U.fmt((lossAt(s.w + eps, s.b) - lossAt(s.w - eps, s.b)) / (2 * eps), 5) + ', ' + U.fmt((lossAt(s.w, s.b + eps) - lossAt(s.w, s.b - eps)) / (2 * eps), 5));
      if (rev) {
        if (s.k === 0) note.innerHTML = 'Нажмите ▶. Сначала прямой проход: значения узлов слева направо.';
        else if (s.k <= 4) note.innerHTML = 'Прямой проход: узел <b>' + BP_NODES[FWD[s.k - 1]].name + '</b> = ' + U.fmt(V[FWD[s.k - 1]], 4) + '. Значения запоминаются — они понадобятся в обратном проходе.';
        else if (s.k < 9) note.innerHTML = 'Обратный проход: градиент узла = градиент следующего узла × локальная производная на ребре. Это цепное правило, применённое справа налево. ' + (s.k === 7 ? '<b>∂L/∂z = p − y = ' + U.fmt(V.bar.z, 4) + '</b>: сложная дробь сократилась — это и есть градиент log-loss по логиту, псевдо-остаток бустинга с минусом.' : '');
        else note.innerHTML = 'Готово: <b>∂L/∂w = (p − y)·x = ' + U.fmt(V.bar.w, 4) + '</b>, <b>∂L/∂b = p − y = ' + U.fmt(V.bar.b, 4) + '</b> — за <em>один</em> обратный проход для всех параметров сразу (и даже для x). Так обучают нейросети: параметров миллионы, а проход один. В бустинге граф ещё короче: прогноз F и есть z, и библиотека считает ∂L/∂F = p − y по готовой формуле.';
      } else {
        const v = s.mode === 'fw' ? 'w' : 'b';
        note.innerHTML = s.k < 5 ? 'Прямой режим: каждый узел несёт пару (значение, производная по ' + v + '). Затравка — производная самой ' + v + ' равна 1, остальных входов — 0.' : 'Итог прямого режима: dL/d' + v + ' = <b>' + U.fmt(tan.L, 5) + '</b> — совпадает с обратным проходом. Но за один проход — производная только по одной переменной; для двух параметров нужно два прохода, для миллиона — миллион. Поэтому для обучения используют обратный режим.';
      }
    }
    w.pythonAction(() => 'import math\n\nsig = lambda z: 1 / (1 + math.exp(-z))\nw, b, x, y = ' + U.pyNum(s.w) + ', ' + U.pyNum(s.b) + ', ' + U.pyNum(s.x) + ', ' + s.y + '\n# прямой проход\nm = w * x; z = m + b; p = sig(z)\nL = -(y * math.log(p) + (1 - y) * math.log(1 - p))\n# обратный проход: градиент узла = градиент следующего × локальная производная\ndL_dp = -y / p + (1 - y) / (1 - p)\ndL_dz = dL_dp * p * (1 - p)        # = p − y\ndL_db = dL_dz * 1\ndL_dw = dL_dz * x\nprint(f"L = {L:.6f}, ∂L/∂z = {dL_dz:.6f} (p − y = {p - y:.6f}), ∂L/∂w = {dL_dw:.6f}, ∂L/∂b = {dL_db:.6f}")\n\n# проверка центральной разностью\nloss = lambda w, b: -(y * math.log(sig(w * x + b)) + (1 - y) * math.log(1 - sig(w * x + b)))\neps = 1e-6\nprint("численно:", (loss(w + eps, b) - loss(w - eps, b)) / (2 * eps), (loss(w, b + eps) - loss(w, b - eps)) / (2 * eps))\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр: какое правило, какая производная, какой псевдо-остаток
   * ============================================================================== */
  const RULE_OPTS = ['сумма / множитель', 'произведение', 'частное', 'цепное правило'];
  const RQ = [
    { f: '3x⁴ − 7x + 2', a: 0, why: 'Последняя операция — сумма; каждое слагаемое — число × степень.' },
    { f: 'x²·sin x', a: 1, why: 'Последней выполняется умножение x² на sin x.' },
    { f: 'sin x / x', a: 2, why: 'Последней выполняется деление.' },
    { f: 'sin(x²)', a: 3, why: 'Функция от функции: sin от x².' },
    { f: 'e^(3x)', a: 3, why: 'Экспонента от 3x — внутренняя производная 3.' },
    { f: 'x·eˣ + 5', a: 0, why: 'Последняя операция — «+ 5»: сначала линейность, а уже внутри — произведение.' },
    { f: '(x² + 1)⁷', a: 3, why: 'Степень от выражения: 7(x² + 1)⁶ · 2x. Раскрывать скобки не нужно.' },
    { f: 'ln x / x', a: 2, why: 'Деление ln x на x.' },
    { f: '√x · ln x', a: 1, why: 'Произведение двух функций.' },
    { f: 'σ(2x − 1)', a: 3, why: 'Сигмоида от линейной функции: σ′(2x − 1)·2.' },
    { f: 'eˣ·cos x', a: 1, why: 'Произведение eˣ и cos x.' },
    { f: 'cos(ln x)', a: 3, why: 'Косинус от логарифма: −sin(ln x)·(1/x).' },
    { f: '(x + 1)/(x − 1)', a: 2, why: 'Дробь с x в числителе и знаменателе.' },
    { f: '2ˣ + x²', a: 0, why: 'Сумма двух табличных функций.' },
    { f: 'ln(1 + e^F)', a: 3, why: 'Логарифм от 1 + e^F; ответ — σ(F).' },
    { f: '5·tg x', a: 0, why: 'Константа × функция — множитель выносится.' },
    { f: '½(y − F)² по F', a: 3, why: 'Квадрат от y − F; внутренняя производная −1.' },
    { f: 'x³·e^(−x)', a: 1, why: 'Произведение; во втором множителе ещё и цепочка.' },
  ];
  const DQ = [
    { f: '5x³', opts: ['15x²', '5x²', '15x³', '3x²'], a: 0, why: '5 · 3x² — множитель выносится.' },
    { f: 'x² + 4x − 7', opts: ['2x + 4', '2x + 4x', 'x + 4', '2x − 7'], a: 0, why: 'Сумма: 2x + 4 + 0.' },
    { f: '1/x', opts: ['ln x', '−1/x²', '1/x²', '−1/x'], a: 1, why: 'x⁻¹ → −1·x⁻².' },
    { f: '√x', opts: ['2√x', '1/(2√x)', '√x / 2', '1/√x'], a: 1, why: 'x^(1/2) → ½·x^(−1/2).' },
    { f: '2ˣ', opts: ['x·2ˣ⁻¹', '2ˣ·ln 2', '2ˣ', '2ˣ/ln 2'], a: 1, why: 'Показательная функция: (aˣ)′ = aˣ·ln a.' },
    { f: 'ln 5x', opts: ['5/x', '1/x', '1/(5x)', 'ln 5 / x'], a: 1, why: 'ln 5x = ln 5 + ln x — константа исчезает. Или цепочкой: (1/(5x))·5.' },
    { f: 'x·eˣ', opts: ['eˣ', 'x·eˣ', 'eˣ(1 + x)', 'eˣ + x'], a: 2, why: 'Произведение: 1·eˣ + x·eˣ.' },
    { f: 'x·ln x', opts: ['1', 'ln x + 1', '1/x', 'ln x'], a: 1, why: 'Произведение: 1·ln x + x·(1/x).' },
    { f: 'e³ˣ', opts: ['e³ˣ', '3e³ˣ', '3x·e³ˣ⁻¹', 'e³'], a: 1, why: 'Цепочка: e³ˣ · 3.' },
    { f: 'cos 3x', opts: ['−3 sin 3x', '3 sin 3x', '−sin 3x', '−3 cos 3x'], a: 0, why: 'Цепочка: −sin 3x · 3.' },
    { f: 'sin(x²)', opts: ['cos(x²)', '2x·cos(x²)', '2x·sin(x²)', 'cos(2x)'], a: 1, why: 'Цепочка: cos(x²) · 2x.' },
    { f: '(3x + 1)⁵', opts: ['5(3x + 1)⁴', '15(3x + 1)⁴', '3(3x + 1)⁵', '15x⁴'], a: 1, why: 'Цепочка: 5(3x + 1)⁴ · 3.' },
    { f: '√(1 + x²)', opts: ['1/(2√(1 + x²))', 'x/√(1 + x²)', '2x·√(1 + x²)', '1/√(1 + x²)'], a: 1, why: 'Цепочка: 1/(2√(1 + x²)) · 2x.' },
    { f: 'ln(1 + x²)', opts: ['1/(1 + x²)', '2x/(1 + x²)', '2x·ln x', '1/(2x)'], a: 1, why: 'Цепочка: 1/(1 + x²) · 2x.' },
    { f: 'x/(1 + x)', opts: ['1/(1 + x)', '1/(1 + x)²', 'x/(1 + x)²', '−1/(1 + x)²'], a: 1, why: 'Частное: ((1 + x) − x)/(1 + x)².' },
    { f: 'tg x', opts: ['1/cos²x', '−1/cos²x', '1/sin²x', 'ctg x'], a: 0, why: 'Частное sin/cos: (cos² + sin²)/cos².' },
    { f: 'arctg x', opts: ['1/cos²x', '1/(1 + x²)', '−1/(1 + x²)', '1/√(1 − x²)'], a: 1, why: 'Обратная функция к tg: 1/(1 + tg²y) = 1/(1 + x²).' },
    { f: 'xˣ', opts: ['x·xˣ⁻¹', 'xˣ·ln x', 'xˣ(ln x + 1)', 'xˣ'], a: 2, why: 'Логарифмическое дифференцирование: ln f = x ln x.' },
    { f: 'ln(1 + eˣ)', opts: ['σ(x)', '1/(1 + eˣ)', 'eˣ', 'ln eˣ'], a: 0, why: 'eˣ/(1 + eˣ) = σ(x): производная softplus — сигмоида.' },
    { f: 'th x', opts: ['1 − th²x', 'th x·(1 − th x)', '1 + th²x', '1/ch x'], a: 0, why: 'th′ = 1/ch²x = 1 − th²x.' },
    { f: 'σ(F)', opts: ['σ(F)', 'σ(F)(1 − σ(F))', '1 − σ(F)', 'e^(−F)'], a: 1, why: 'Знаменитое свойство сигмоиды.' },
    { f: 'ln σ(F)', opts: ['1/σ(F)', '1 − σ(F)', 'σ(F)', '−σ(F)'], a: 1, why: 'Цепочка: (1/σ)·σ(1 − σ) = 1 − σ.' },
    { f: '½(y − F)² по F', opts: ['y − F', 'F − y', '(y − F)²', '½'], a: 1, why: 'Цепочка: (y − F) · (−1) = F − y.' },
    { f: 'e^F − yF по F', opts: ['e^F', 'e^F − y', 'e^F − yF', '−y'], a: 1, why: 'Потери Пуассона: градиент μ − y, где μ = e^F.' },
  ];
  /** Задача «псевдо-остаток»: потери, ответ y, прогноз F → −∂L/∂F. */
  function lossQuestion(rng) {
    const kinds = ['l2', 'l1', 'huber', 'quant', 'log', 'pois'];
    const k = kinds[rng.randint(kinds.length)];
    let y;
    let F;
    let r;
    let text;
    let why;
    let wrong;
    if (k === 'log') {
      y = rng.randint(2);
      F = [-2, -1, 0, 1, 2][rng.randint(5)];
      const p = sigma(F);
      r = y - p;
      text = 'log-loss, y = ' + y + ', логит F = ' + F + ' (σ(' + F + ') ≈ ' + U.fmt(p, 3) + ')';
      why = '−g = y − p = ' + y + ' − ' + U.fmt(p, 3) + '.';
      wrong = [p - y, p, 1 - p, -p];
    } else if (k === 'pois') {
      y = rng.randint(6);
      F = [0, Math.log(2)][rng.randint(2)];
      const mu = Math.exp(F);
      r = y - mu;
      text = 'Пуассона, y = ' + y + ', F = ' + (F === 0 ? '0' : 'ln 2') + ' (μ = e^F = ' + U.fmt(mu, 3) + ')';
      why = '−g = y − μ = ' + y + ' − ' + U.fmt(mu, 3) + '.';
      wrong = [mu - y, y - F, y, -mu];
    } else {
      y = 1 + rng.randint(9);
      F = 1 + rng.randint(9);
      if (F === y) F = y > 5 ? y - 3 : y + 3;
      const d = y - F;
      if (k === 'l2') (r = d), (text = 'MSE ½(y − F)², y = ' + y + ', F = ' + F), (why = '−g = y − F = ' + d + '.'), (wrong = [-d, d * d / 2, Math.sign(d)]);
      else if (k === 'l1') (r = Math.sign(d)), (text = 'MAE |y − F|, y = ' + y + ', F = ' + F), (why = '−g = sign(y − F): важен только знак остатка ' + d + '.'), (wrong = [d, -Math.sign(d), 0]);
      else if (k === 'huber') {
        const del = [1, 2][rng.randint(2)];
        r = U.clamp(d, -del, del);
        text = 'Хьюбер δ = ' + del + ', y = ' + y + ', F = ' + F;
        why = '−g = clip(y − F, −δ, δ) = clip(' + d + ', ±' + del + ').';
        wrong = [d, -r, Math.sign(d) * (del + 1)];
      } else {
        const al = [0.1, 0.5, 0.9][rng.randint(3)];
        r = d > 0 ? al : al - 1;
        text = 'квантильная α = ' + al + ', y = ' + y + ', F = ' + F;
        why = d > 0 ? 'F < y (недопрогноз): −g = α = ' + al + '.' : 'F > y (перепрогноз): −g = α − 1 = ' + U.fmt(al - 1, 2) + '.';
        wrong = [d > 0 ? al - 1 : al, -al, d, 1 - al];
      }
    }
    const round = (v) => Math.round(v * 1000) / 1000;
    const cands = [round(r)];
    for (const v of [...wrong, r + 1, r - 1, 2 * r + 0.5]) {
      const rv = round(v);
      if (cands.length < 4 && !cands.some((c) => Math.abs(c - rv) < 1e-6)) cands.push(rv);
    }
    const order = Array.from(rng.permutation(cands.length));
    const vals = order.map((i) => cands[i]);
    return { text, why, vals, a: vals.indexOf(cands[0]) };
  }
  GBC.widget('derivative-game', (el) => {
    const s = { mode: 'rule', seed: 1, round: 0, right: 0, streak: 0, best: 0, q: null, picked: null };
    const w = ui.shell(el, { title: 'Тренажёр по правилам дифференцирования', sub: 'Три режима: «правило» — какое правило применить первым (какая операция в формуле выполняется последней); «производная» — выберите верный ответ; «псевдо-остаток» — посчитайте −∂L/∂F для функции потерь бустинга. Цель — серия из 10 верных ответов.' });
    ui.segmented(w.controls, { label: 'Режим', value: s.mode, options: [{ value: 'rule', label: 'правило' }, { value: 'deriv', label: 'производная' }, { value: 'loss', label: 'псевдо-остаток' }], onChange: (v) => ((s.mode = v), (s.streak = 0), newQuestion()) });
    const next = ui.button(w.controls, { label: 'Следующий вопрос', icon: 'step', onClick: () => newQuestion() });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.15rem;padding:6px 0 12px' });
    w.main.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px' });
    w.main.appendChild(optsBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }, { key: 'b', label: 'лучшая серия' }]);
    function newQuestion() {
      const rng = new GBC.RNG(s.seed++ * 37 + (s.mode === 'deriv' ? 11 : s.mode === 'loss' ? 23 : 0));
      s.picked = null;
      s.round++;
      if (s.mode === 'rule') {
        const Q = RQ[rng.randint(RQ.length)];
        s.q = { title: 'Какое правило применить первым к ' + Q.f + '?', opts: RULE_OPTS, a: Q.a, why: Q.why };
      } else if (s.mode === 'deriv') {
        const Q = DQ[rng.randint(DQ.length)];
        const order = Array.from(rng.permutation(4));
        s.q = { title: '(' + Q.f + ')′ = ?', opts: order.map((i) => Q.opts[i]), a: order.indexOf(Q.a), why: Q.why };
      } else {
        const Q = lossQuestion(rng);
        s.q = { title: 'Псевдо-остаток −∂L/∂F: ' + Q.text, opts: Q.vals.map((v) => U.fmt(v, 3)), a: Q.a, why: Q.why };
      }
      draw();
    }
    function draw() {
      const Q = s.q;
      qEl.textContent = Q.title;
      optsBox.textContent = '';
      Q.opts.forEach((o, k) => {
        const b = ui.button(optsBox, { label: o, kind: s.picked === null || k === Q.a ? 'primary' : '', onClick: () => {
          if (s.picked !== null) return;
          s.picked = k;
          if (k === Q.a) {
            s.right++;
            s.streak++;
            s.best = Math.max(s.best, s.streak);
          } else s.streak = 0;
          draw();
        } });
        if (s.picked !== null) b.disabled = true;
      });
      st.set('r', String(s.round));
      st.set('ok', s.right + ' из ' + (s.round - (s.picked === null ? 1 : 0)));
      st.set('s', String(s.streak));
      st.set('b', String(s.best));
      const hint = { rule: 'Найдите операцию, которая выполняется последней, если считать формулу на калькуляторе.', deriv: 'Сначала решите в уме: какое правило здесь главное?', loss: 'Сначала производная потерь по F, потом — минус.' }[s.mode];
      note.innerHTML = s.picked === null ? hint : (s.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет</b>, правильно: ' + Q.opts[Q.a] + '. ') + Q.why + (s.streak >= 10 ? ' <b>Серия из ' + s.streak + '!</b>' : '');
      next.textContent = '';
      next.append(ui.icon('step'), s.picked === null ? 'Пропустить' : 'Следующий вопрос');
    }
    w.pythonAction(() => '# Проверка любого ответа тренажёра численно\nimport numpy as np\n\nf = lambda x: np.sin(x**2)          # подставьте свою функцию\ndf = lambda x: 2 * x * np.cos(x**2)  # и свой ответ\nx = np.linspace(-2, 2, 9)\nprint(np.max(np.abs((f(x + 1e-6) - f(x - 1e-6)) / 2e-6 - df(x))))\n');
    newQuestion();
  });
})();
