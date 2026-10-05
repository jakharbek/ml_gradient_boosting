/* Урок 15.16: теория информации. Часть 2 — две величины, перекрёстная энтропия и KL, теория
 * информации внутри бустинга.
 * Виджеты: совместная и условная энтропия (информационная диаграмма); сколько бит даёт медицинский
 * тест; взаимная информация против корреляции; потеря информации при биннинге признака; синергия и
 * избыточность (XOR); канал с шумом и код повторения; перекрёстная энтропия как код под чужое
 * распределение; несимметричность KL; прямая и обратная KL при подгонке; расхождения для сдвига
 * данных (KL, PSI, JS, полная вариация); максимальное правдоподобие = минимум KL и сглаживание;
 * log-loss как сумма неожиданностей; разложение log-loss на H(Y|X) и KL; бустинг снижает перекрёстную
 * энтропию; softmax и сглаживание меток; прирост информации = снижение log-loss разбиения; ловушка
 * признаков с множеством значений; неравенство Фано; минимальная длина описания; тренажёр.
 * Помощники — из lesson.js (GBC.lesson1516). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const L0 = GBC.lesson1516;
  const { f1, f2, f3, f4, py, sci, pct, nWord, yDom, lg, Hb, hbin, klb, normalize, hinv, phi, Phi, probit, pick, cumsum, huffman, avgLen, rowTable, scrollBox, monoBox, badge, PY_NP, PY_RNG } = L0;
  const sig = U.sigmoid;
  const logit = (p) => Math.log(p / (1 - p));
  /** Взаимная информация по совместной таблице (массив строк), в битах. */
  function miTable(J) {
    const px = J.map((r) => U.sum(r));
    const py0 = J[0].map((_, j) => U.sum(J.map((r) => r[j])));
    let s = 0;
    J.forEach((r, i) => r.forEach((v, j) => {
      if (v > 0) s += v * lg(v / (px[i] * py0[j]));
    }));
    return s;
  }
  const PY_MI = 'def mi(J):\n    """Взаимная информация по таблице совместных вероятностей, бит."""\n    J = np.asarray(J, float); J = J / J.sum()\n    px, py = J.sum(1, keepdims=True), J.sum(0, keepdims=True)\n    m = J > 0\n    return float((J[m] * np.log2(J[m] / (px @ py)[m])).sum())\n';

  /* ==============================================================================
   * Шаг 17. Совместная и условная энтропия: информационная диаграмма
   * ============================================================================== */
  const JOINT_PRE = {
    umbrella: { label: 'дождь и зонт', x: ['дождь', 'сухо'], y: ['с зонтом', 'без зонта'], w: [20, 5, 7.5, 67.5] },
    indep: { label: 'независимы', x: ['дождь', 'сухо'], y: ['с зонтом', 'без зонта'], w: [7.5, 17.5, 22.5, 52.5] },
    copy: { label: 'копия', x: ['дождь', 'сухо'], y: ['с зонтом', 'без зонта'], w: [30, 0, 0, 70] },
    disease: { label: 'болезнь и тест', x: ['болен', 'здоров'], y: ['тест +', 'тест −'], w: [0.99, 0.01, 4.95, 94.05] },
  };
  GBC.widget('joint-table', (el) => {
    const s = { pre: 'umbrella', w: JOINT_PRE.umbrella.w.slice() };
    const w = ui.shell(el, { title: 'Совместная и условная энтропия', sub: 'Две величины: X (строки) и Y (столбцы). Ползунки — веса четырёх клеток совместного распределения. Полосы ниже — информационная диаграмма: H(X) и H(Y) перекрываются на взаимную информацию I(X; Y), а вместе покрывают H(X, Y).' });
    ui.segmented(w.controls, { label: 'Пример', value: s.pre, options: Object.keys(JOINT_PRE).map((k) => ({ value: k, label: JOINT_PRE[k].label })), onChange: (v) => ((s.pre = v), (s.w = JOINT_PRE[v].w.slice()), sl.forEach((x, i) => x.set(s.w[i])), draw()) });
    const cellName = (i) => ['x₁, y₁', 'x₁, y₂', 'x₂, y₁', 'x₂, y₂'][i];
    const sl = U.range(4).map((i) => ui.slider(w.controls, { label: 'вес клетки ' + cellName(i), min: 0, max: 100, step: 0.5, value: s.w[i], format: f1, onInput: (v) => ((s.w[i] = v), draw()) }));
    const tbl = H('div');
    w.main.appendChild(tbl);
    const plot = new GBC.Plot(w.main, { height: 190, x: { label: 'бит', domain: [0, 2] }, y: { label: '', domain: [-0.6, 2.6], ticks: [0, 1, 2], format: (v) => ['H(X, Y)', 'H(Y)', 'H(X)'][v] || '' }, margin: { left: 66 } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'HX', label: 'H(X)' }, { key: 'HY', label: 'H(Y)' }, { key: 'HXY', label: 'H(X, Y)' }, { key: 'HYX', label: 'H(Y | X)' }, { key: 'I', label: 'I(X; Y)' }]);
    function draw() {
      const P = JOINT_PRE[s.pre];
      const tot = U.sum(s.w) || 1;
      const J = [[s.w[0] / tot, s.w[1] / tot], [s.w[2] / tot, s.w[3] / tot]];
      const px = J.map((r) => r[0] + r[1]);
      const pyv = [J[0][0] + J[1][0], J[0][1] + J[1][1]];
      const HX = Hb(px);
      const HY = Hb(pyv);
      const HXY = Hb(J.flat());
      const I = HX + HY - HXY;
      const HXgY = HXY - HY;
      const HYgX = HXY - HX;
      const condRow = (i) => (px[i] > 0 ? Hb([J[i][0] / px[i], J[i][1] / px[i]]) : 0);
      rowTable(tbl, ['', P.y[0] + ' (y₁)', P.y[1] + ' (y₂)', 'P(x)', 'H(Y | X = x)'], [
        [P.x[0] + ' (x₁)', f4(J[0][0]), f4(J[0][1]), f4(px[0]), f3(condRow(0))],
        [P.x[1] + ' (x₂)', f4(J[1][0]), f4(J[1][1]), f4(px[1]), f3(condRow(1))],
        ['P(y)', f4(pyv[0]), f4(pyv[1]), '1', 'H(Y) = ' + f3(HY)],
      ], null, false);
      const op = 0.78;
      plot.render([
        { type: 'rect', x0: 0, x1: HXgY, y0: 1.65, y1: 2.35, fill: 'blue', color: 'blue', opacity: op, label: 'H(X | Y)' },
        { type: 'rect', x0: HXgY, x1: HX, y0: 1.65, y1: 2.35, fill: 'violet', color: 'violet', opacity: op, label: 'I(X; Y)' },
        { type: 'rect', x0: HXgY, x1: HXgY + I, y0: 0.65, y1: 1.35, fill: 'violet', opacity: op },
        { type: 'rect', x0: HXgY + I, x1: HXY, y0: 0.65, y1: 1.35, fill: 'orange', color: 'orange', opacity: op, label: 'H(Y | X)' },
        { type: 'rect', x0: 0, x1: HXgY, y0: -0.35, y1: 0.35, fill: 'blue', opacity: op },
        { type: 'rect', x0: HXgY, x1: HXgY + I, y0: -0.35, y1: 0.35, fill: 'violet', opacity: op },
        { type: 'rect', x0: HXgY + I, x1: HXY, y0: -0.35, y1: 0.35, fill: 'orange', opacity: op },
      ], { x: [0, Math.max(1, HXY * 1.05)] });
      st.set('HX', f3(HX));
      st.set('HY', f3(HY));
      st.set('HXY', f3(HXY));
      st.set('HYX', f3(HYgX));
      st.set('I', f3(I));
      const worse = [0, 1].filter((i) => px[i] > 0 && condRow(i) > HY + 1e-9);
      note.innerHTML = 'Цепное правило: H(X, Y) = H(X) + H(Y | X) — «узнать оба» = «узнать X» + «узнать Y, зная X». Условная энтропия H(Y | X) = Σ P(x)·H(Y | X = x) — средняя неопределённость Y, когда X известен; она не больше H(Y): <b>знание в среднем не вредит</b>. Дождь и зонт: H(X) = 0.811, H(Y) = 0.849, H(X, Y) = 1.344, I = 0.316 бита. ' + (worse.length ? '<b>Здесь H(Y | X = ' + P.x[worse[0]] + ') = ' + f3(condRow(worse[0])) + ' больше H(Y) = ' + f3(HY) + '</b>: отдельное наблюдение может <em>увеличить</em> неопределённость (редкая болезнь при положительном тесте), но в среднем по X — нет.' : 'Отдельное значение X может даже увеличить неопределённость Y — попробуйте пример «болезнь и тест».');
    }
    w.pythonAction(() => PY_NP + PY_MI + `
J = np.array(${JSON.stringify([[s.w[0], s.w[1]], [s.w[2], s.w[3]]])}, float); J /= J.sum()
H = lambda p: float(-(p[p > 0] * np.log2(p[p > 0])).sum())
HX, HY, HXY = H(J.sum(1)), H(J.sum(0)), H(J.ravel())
print(f"H(X) = {HX:.3f}, H(Y) = {HY:.3f}, H(X,Y) = {HXY:.3f}, H(Y|X) = {HXY - HX:.3f}, I = {HX + HY - HXY:.3f} = {mi(J):.3f}")
from sklearn.metrics import mutual_info_score
print("sklearn (наты → биты):", mutual_info_score(None, None, contingency=J * 1e6) / np.log(2))
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 18. Сколько бит о болезни даёт тест
   * ============================================================================== */
  function testInfo(prev, sens, spec) {
    const pt = prev * sens + (1 - prev) * (1 - spec);
    const postP = pt > 0 ? (prev * sens) / pt : 0;
    const postN = pt < 1 ? (prev * (1 - sens)) / (1 - pt) : 0;
    const HD = hbin(prev);
    const HDT = pt * hbin(postP) + (1 - pt) * hbin(postN);
    return { pt, postP, postN, HD, HDT, I: HD - HDT };
  }
  GBC.widget('test-info', (el) => {
    const s = { prev: 0.01, sens: 0.99, spec: 0.95 };
    const w = ui.shell(el, { title: 'Взаимная информация: сколько бит о болезни даёт тест', sub: 'D — болен ли человек, T — результат теста. I(D; T) = H(D) − H(D | T): насколько тест в среднем уменьшает неопределённость диагноза. Верхняя граница — H(D): тест не может сообщить больше, чем было неизвестно.' });
    ui.slider(w.controls, { label: 'Распространённость P(болен)', min: 0.001, max: 0.5, log: true, value: s.prev, format: (v) => pct(v, v < 0.01 ? 2 : 1), onInput: (v) => ((s.prev = v), draw()) });
    ui.slider(w.controls, { label: 'Чувствительность P(+ | болен)', min: 0.5, max: 1, step: 0.005, value: s.sens, format: f3, onInput: (v) => ((s.sens = v), draw()) });
    ui.slider(w.controls, { label: 'Специфичность P(− | здоров)', min: 0.5, max: 1, step: 0.005, value: s.spec, format: f3, onInput: (v) => ((s.spec = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'распространённость (лог.)', type: 'log', domain: [0.001, 0.5], ticks: [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 0.5] }, y: { label: 'бит', domain: [0, 1.05] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'HD', label: 'H(D)' }, { key: 'I', label: 'I(D; T)' }, { key: 'share', label: 'доля снятой неопределённости' }, { key: 'post', label: 'P(болен | +)' }, { key: 'hp', label: 'H(D | T = +)' }]);
    function draw() {
      const r = testInfo(s.prev, s.sens, s.spec);
      const xs = U.range(91).map((i) => Math.pow(10, -3 + i * (Math.log10(0.5) + 3) / 90));
      plot.render([
        { type: 'line', x: xs, y: xs.map(hbin), color: 'muted', width: 2, dash: '6 4', label: 'H(D) — всё неизвестное' },
        { type: 'line', x: xs, y: xs.map((p) => testInfo(p, s.sens, s.spec).I), color: 'model', width: 2.2, label: 'I(D; T) — что сообщает тест' },
        { type: 'points', x: [s.prev], y: [r.I], color: 'tree', r: 7 },
      ]);
      st.set('HD', f3(r.HD));
      st.set('I', f3(r.I));
      st.set('share', pct(r.I / r.HD, 0));
      st.set('post', pct(r.postP, 1));
      st.set('hp', f3(hbin(r.postP)));
      note.innerHTML = 'Тест с чувствительностью 99 % и специфичностью 95 % при распространённости 1 %: H(D) = 0.081 бита — мы и так почти уверены, что человек здоров. Тест сообщает I = 0.041 бита, половину неопределённости. После положительного результата P(болен) = 16.7 %, и неопределённость <b>растёт</b> до h(0.167) = 0.650 бита — но такой результат редок (5.9 %). При распространённости 50 % тот же тест даёт 0.815 бита. Ценность признака измеряется не «точностью», а тем, сколько он снимает неопределённости — так и выбирают признаки для разбиений дерева.';
    }
    w.pythonAction(() => PY_NP + `
h = lambda p: 0.0 if p in (0, 1) else -p * np.log2(p) - (1 - p) * np.log2(1 - p)
prev, sens, spec = ${py(s.prev)}, ${py(s.sens)}, ${py(s.spec)}
pt = prev * sens + (1 - prev) * (1 - spec)
post_pos, post_neg = prev * sens / pt, prev * (1 - sens) / (1 - pt)
I = h(prev) - (pt * h(post_pos) + (1 - pt) * h(post_neg))
print(f"P(+) = {pt:.4f}, P(болен|+) = {post_pos:.3f}; H(D) = {h(prev):.4f}, I(D;T) = {I:.4f} бит")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 19. Взаимная информация против корреляции
   * ============================================================================== */
  const MI_SETS = {
    line: { label: 'прямая', gen: (x, e) => x + e },
    parab: { label: 'парабола', gen: (x, e) => x * x + e },
    circle: { label: 'окружность', gen: null },
    sine: { label: 'синус', gen: (x, e) => Math.sin(3 * Math.PI * x) + e },
    step: { label: 'ступенька', gen: (x, e) => (x > 0 ? 1 : 0) + e },
    exp: { label: 'экспонента', gen: (x, e) => Math.exp(3 * x) / 10 + e },
    noise: { label: 'шум', gen: (x, e) => 3 * e },
  };
  function miData(kind, n, sd, seed) {
    const rng = new GBC.RNG(seed);
    const X = [];
    const Y = [];
    for (let i = 0; i < n; i++) {
      if (kind === 'circle') {
        const t = rng.uniform(0, 2 * Math.PI);
        const e1 = rng.normal();
        const e2 = rng.normal();
        X.push(Math.cos(t) + sd * e1);
        Y.push(Math.sin(t) + sd * e2);
      } else {
        const x = rng.uniform(-1, 1);
        const e = rng.normal();
        X.push(x);
        Y.push(MI_SETS[kind].gen(x, sd * e));
      }
    }
    return { X, Y };
  }
  /** Номер корзины по рангу: равночастотные корзины. */
  function rankBins(v, b) {
    const n = v.length;
    const idx = U.range(n).sort((a, c) => v[a] - v[c] || a - c);
    const bin = new Array(n);
    idx.forEach((i, r) => (bin[i] = Math.floor((r * b) / n)));
    return bin;
  }
  function pearson(a, b) {
    const ma = U.mean(a);
    const mb = U.mean(b);
    let sab = 0;
    let saa = 0;
    let sbb = 0;
    for (let i = 0; i < a.length; i++) {
      sab += (a[i] - ma) * (b[i] - mb);
      saa += (a[i] - ma) ** 2;
      sbb += (b[i] - mb) ** 2;
    }
    return sab / Math.sqrt(saa * sbb);
  }
  const ranks = (v) => {
    const r = new Array(v.length);
    U.range(v.length).sort((a, c) => v[a] - v[c] || a - c).forEach((i, k) => (r[i] = k));
    return r;
  };
  function binnedMI(X, Y, b) {
    const n = X.length;
    const bx = rankBins(X, b);
    const by = rankBins(Y, b);
    const J = U.range(b).map(() => new Array(b).fill(0));
    for (let i = 0; i < n; i++) J[bx[i]][by[i]] += 1 / n;
    return { J, mi: miTable(J) };
  }
  GBC.widget('mi-vs-corr', (el) => {
    const s = { kind: 'parab', n: 500, sd: 0.1, b: 8, warp: false };
    const w = ui.shell(el, { title: 'Взаимная информация видит то, чего не видит корреляция', sub: 'Облако точек (x, y). Корреляция Пирсона r меряет только линейную связь. Взаимную информацию оценим так: делим x и y на b равночастотных корзин (по рангам) и считаем I по таблице частот. Нижняя карта — во сколько раз частота клетки отличается от «независимой» (синий — реже, красный — чаще).' });
    ui.select(w.controls, { label: 'Зависимость', value: s.kind, options: Object.keys(MI_SETS).map((k) => ({ value: k, label: MI_SETS[k].label })), onChange: (v) => ((s.kind = v), draw()) });
    ui.slider(w.controls, { label: 'Шум σ', min: 0, max: 1, step: 0.02, value: s.sd, format: f2, onInput: (v) => ((s.sd = v), draw()) });
    ui.slider(w.controls, { label: 'Точек n', values: [100, 200, 500, 1000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Корзин b', min: 2, max: 16, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.toggle(w.controls, { label: 'исказить шкалу: y → e^{2y}', checked: false, onChange: (v) => ((s.warp = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x', domain: [-1.2, 1.2] }, y: { label: 'y', domain: [-1.5, 1.5] } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'корзина x (по рангу)', domain: [0, 8] }, y: { label: 'корзина y', domain: [0, 8] }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'Пирсон r' }, { key: 'rho', label: 'Спирмен ρ' }, { key: 'mi', label: 'I по корзинам, бит' }, { key: 'mic', label: 'I − смещение' }, { key: 'g', label: '−½ log₂(1 − r²)' }]);
    function draw() {
      const d = miData(s.kind, s.n, s.sd, 19);
      const Y = s.warp ? d.Y.map((v) => Math.exp(2 * v)) : d.Y;
      const { J, mi } = binnedMI(d.X, Y, s.b);
      const r = pearson(d.X, Y);
      const rho = pearson(ranks(d.X), ranks(Y));
      const bias = ((s.b - 1) * (s.b - 1)) / (2 * s.n * Math.LN2);
      p1.render([{ type: 'points', x: d.X, y: Y, color: 'data', r: 3.5, opacity: 0.6 }], { x: yDom(d.X, 0.05), y: yDom(Y, 0.05) });
      const div = GBC.colors.diverging();
      const vals = new Float64Array(s.b * s.b);
      for (let j = 0; j < s.b; j++) for (let i = 0; i < s.b; i++) {
        const pi = U.sum(J[i]);
        const pj = U.sum(J.map((row) => row[j]));
        const lift = J[i][j] / (pi * pj);
        vals[j * s.b + i] = lift > 0 ? lg(lift) : -3;
      }
      p2.render([{ type: 'heatmap', grid: { nx: s.b, ny: s.b, x0: 0.5, x1: s.b - 0.5, y0: 0.5, y1: s.b - 0.5, values: vals }, colorFn: (v) => div(v / 2), opacity: 0.9, smooth: false }], { x: [0, s.b], y: [0, s.b] });
      st.set('r', U.fmtSigned(r, 3));
      st.set('rho', U.fmtSigned(rho, 3));
      st.set('mi', f3(mi));
      st.set('mic', f3(Math.max(0, mi - bias)));
      st.set('g', f3(-0.5 * lg(1 - Math.min(r * r, 0.999999))));
      note.innerHTML = 'Парабола (σ = 0.1): r = 0.04 — линейной связи нет, но I ≈ 1.2 бита: y почти однозначно определяется x. Окружность: r ≈ 0, I ≈ 0.83. Для <em>совместно нормальных</em> x и y взаимная информация равна −½ log₂(1 − r²) — только тогда корреляции достаточно (последний показатель). Оценка по b корзинам не может превысить log₂ b (для 8 корзин — 3 бита), поэтому сильные зависимости она занижает: у прямой 1.90 вместо 2.6. Включите искажение шкалы: r меняется (у экспоненты — с 0.82 до 0.57), а <b>I не меняется вовсе</b> — она зависит только от рангов, как и деревья. Для чистого шума оценка не ноль, а ≈ 0.06: смещение вверх около (b − 1)²/(2n ln 2) = 0.07 бита.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + PY_MI + `
def data(kind, n, sd, seed=19):
    rng, X, Y = Mulberry32(seed), [], []
    for _ in range(n):
        if kind == "circle":
            t = rng.uniform(0, 2 * np.pi); e1, e2 = rng.normal(), rng.normal()
            X.append(np.cos(t) + sd * e1); Y.append(np.sin(t) + sd * e2)
        else:
            x = rng.uniform(-1, 1); e = sd * rng.normal()
            f = {"line": x + e, "parab": x * x + e, "sine": np.sin(3 * np.pi * x) + e, "step": (x > 0) + e,
                 "exp": np.exp(3 * x) / 10 + e, "noise": 3 * e}[kind]
            X.append(x); Y.append(f)
    return np.array(X), np.array(Y)

def rank_bins(v, b):
    r = np.empty(len(v), int); r[np.argsort(v, kind="stable")] = np.arange(len(v))
    return r * b // len(v)

kind, n, sd, b = "${s.kind}", ${s.n}, ${py(s.sd)}, ${s.b}
X, Y = data(kind, n, sd)
${s.warp ? 'Y = np.exp(2 * Y)\n' : ''}J = np.zeros((b, b)); np.add.at(J, (rank_bins(X, b), rank_bins(Y, b)), 1)
r = np.corrcoef(X, Y)[0, 1]
from scipy.stats import spearmanr
print(f"r = {r:+.3f}, ρ = {spearmanr(X, Y)[0]:+.3f}, I по корзинам = {mi(J):.3f} бит, смещение ≈ {(b - 1)**2 / (2 * n * np.log(2)):.3f}")
from sklearn.feature_selection import mutual_info_regression
print("оценка k ближайших соседей (sklearn), бит:", mutual_info_regression(X[:, None], Y, random_state=0)[0] / np.log(2))
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 20. Неравенство обработки данных: биннинг признака теряет информацию
   * ============================================================================== */
  const BIN_P = {
    smooth: { label: 'плавная σ(10(x − ½))', f: (x) => sig(10 * (x - 0.5)) },
    waves: { label: 'волны ½ + 0.4 sin 6πx', f: (x) => 0.5 + 0.4 * Math.sin(6 * Math.PI * x) },
    spike: { label: 'узкий пик у x = 0.62', f: (x) => 0.1 + 0.8 * Math.exp(-(((x - 0.62) / 0.03) ** 2)) },
  };
  const NB = 25500;
  function binInfo(key, b) {
    const f = BIN_P[key].f;
    const sums = new Array(b).fill(0);
    const cnt = new Array(b).fill(0);
    let mp = 0;
    let eh = 0;
    for (let i = 0; i < NB; i++) {
      const x = (i + 0.5) / NB;
      const p = f(x);
      mp += p / NB;
      eh += hbin(p) / NB;
      const k = Math.min(b - 1, Math.floor(x * b));
      sums[k] += p;
      cnt[k] += 1;
    }
    let ehb = 0;
    const means = sums.map((v, k) => v / cnt[k]);
    means.forEach((m, k) => (ehb += (cnt[k] / NB) * hbin(m)));
    return { I: hbin(mp) - eh, Ib: hbin(mp) - ehb, means };
  }
  const BIN_BS = [1, 2, 3, 4, 6, 8, 12, 16, 32, 64, 128, 255];
  GBC.widget('binning-loss', (el) => {
    const s = { key: 'waves', b: 8 };
    const w = ui.shell(el, { title: 'Биннинг признака: сколько информации теряется', sub: 'Признак x равномерен на [0, 1], класс y = 1 с вероятностью p(x). Гистограммный бустинг (LightGBM, XGBoost hist) заменяет x номером корзины из b равных. Внутри корзины модель видит лишь среднюю вероятность. Неравенство обработки данных: I(корзина; y) ≤ I(x; y).' });
    ui.segmented(w.controls, { label: 'Зависимость p(x)', value: s.key, options: Object.keys(BIN_P).map((k) => ({ value: k, label: BIN_P[k].label })), onChange: (v) => ((s.key = v), draw()) });
    ui.slider(w.controls, { label: 'Корзин b', values: BIN_BS, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'x', domain: [0, 1] }, y: { label: 'P(y = 1 | x)', domain: [0, 1] } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'число корзин b (лог.)', type: 'log', domain: [1, 300], ticks: [1, 2, 4, 8, 16, 32, 64, 128, 255] }, y: { label: 'бит', domain: [0, 0.6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'I', label: 'I(x; y)' }, { key: 'Ib', label: 'I(корзина; y)' }, { key: 'keep', label: 'сохранено' }, { key: 'lost', label: 'потеряно, бит' }]);
    const cache = {};
    const info = (key, b) => cache[key + b] || (cache[key + b] = binInfo(key, b));
    function draw() {
      const f = BIN_P[s.key].f;
      const r = info(s.key, s.b);
      const xs = U.linspace(0, 1, 801);
      p1.render([
        { type: 'line', x: xs, y: xs.map(f), color: 'truth', width: 2, dash: '6 4', label: 'p(x)' },
        { type: 'steps', segments: r.means.map((m, k) => ({ x0: k / s.b, x1: (k + 1) / s.b, value: m })), color: 'model', width: 2.4, label: 'среднее в корзине' },
      ]);
      const curve = BIN_BS.map((b) => info(s.key, b).Ib);
      p2.render([
        { type: 'hline', y: r.I, color: 'tree', width: 2, dash: '6 4', label: 'I(x; y) — без биннинга' },
        { type: 'line', x: BIN_BS, y: curve, color: 'model', width: 2.2, label: 'I(корзина; y)' },
        { type: 'points', x: BIN_BS, y: curve, color: 'model', r: 4 },
        { type: 'points', x: [s.b], y: [r.Ib], color: 'tree', r: 7 },
      ], { y: [0, r.I * 1.2 + 0.01] });
      st.set('I', f4(r.I));
      st.set('Ib', f4(r.Ib));
      st.set('keep', pct(r.Ib / r.I, 1));
      st.set('lost', f4(r.I - r.Ib));
      note.innerHTML = 'Любая обработка признака — округление, биннинг, отбор — не может <b>добавить</b> информации о классе: если y → x → T(x), то I(T(x); y) ≤ I(x; y). Для «волн» 4 корзины сохраняют лишь ' + pct(info('waves', 4).Ib / info('waves', 4).I, 0) + ' информации, 32 — ' + pct(info('waves', 32).Ib / info('waves', 32).I, 1) + ', 255 (по умолчанию в LightGBM) — ' + pct(info('waves', 255).Ib / info('waves', 255).I, 2) + '. Узкий пик требует мелких корзин. Поэтому max_bin = 255 почти ничего не теряет, а сильное огрубление (max_bin = 8) может «стереть» узкие закономерности. Обратное тоже важно: новый признак, вычисленный из старых, не несёт новой информации — он лишь делает её доступнее для жадных деревьев.';
    }
    w.pythonAction(() => PY_NP + `
h = lambda p: np.where((p > 0) & (p < 1), -p * np.log2(np.clip(p, 1e-300, 1)) - (1 - p) * np.log2(np.clip(1 - p, 1e-300, 1)), 0.0)
f = {"smooth": lambda x: 1 / (1 + np.exp(-10 * (x - 0.5))), "waves": lambda x: 0.5 + 0.4 * np.sin(6 * np.pi * x),
     "spike": lambda x: 0.1 + 0.8 * np.exp(-((x - 0.62) / 0.03) ** 2)}["${s.key}"]
x = (np.arange(${NB}) + 0.5) / ${NB}; p = f(x)
I = h(p.mean()) - h(p).mean()
for b in ${JSON.stringify(BIN_BS)}:
    k = np.minimum(b - 1, np.floor(x * b).astype(int))
    means = np.bincount(k, p, b) / np.bincount(k, None, b)
    Ib = h(p.mean()) - (np.bincount(k, None, b) / len(x) * h(means)).sum()
    print(f"b = {b:3d}: I(корзина; y) = {Ib:.4f} из {I:.4f} ({100 * Ib / I:.1f} %)")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 21. Синергия и избыточность: XOR
   * ============================================================================== */
  const SYN = {
    xor: { label: 'XOR', f: (a, b) => a ^ b, copy: false },
    and: { label: 'AND', f: (a, b) => a & b, copy: false },
    indep: { label: 'x₂ — шум', f: (a) => a, copy: false },
    copy: { label: 'x₂ = x₁ (копия)', f: (a) => a, copy: true },
  };
  function synCalc(key, eps) {
    const P = SYN[key];
    const cells = [];
    for (const a of [0, 1]) for (const b of [0, 1]) {
      const pab = P.copy ? (a === b ? 0.5 : 0) : 0.25;
      const q = eps + (1 - 2 * eps) * P.f(a, b);
      cells.push({ a, b, pab, q });
    }
    const J12 = cells.map((c) => [c.pab * (1 - c.q), c.pab * c.q]);
    const marg = (sel) => [0, 1].map((v) => {
      const rows = cells.map((c, i) => (sel(c) === v ? J12[i] : [0, 0]));
      return [U.sum(rows.map((r) => r[0])), U.sum(rows.map((r) => r[1]))];
    });
    const I1 = miTable(marg((c) => c.a));
    const I2 = miTable(marg((c) => c.b));
    const I12 = miTable(J12.filter((r) => r[0] + r[1] > 0));
    return { cells, I1, I2, I12, cond: I12 - I1, inter: I12 - I1 - I2 };
  }
  GBC.widget('synergy', (el) => {
    const s = { key: 'xor', eps: 0 };
    const w = ui.shell(el, { title: 'Синергия и избыточность двух признаков', sub: 'Признаки x₁, x₂ ∈ {0, 1}, класс y зависит от них по правилу, а потом с вероятностью ε переворачивается (шум меток). Сравните, сколько знает каждый признак отдельно и оба вместе.' });
    ui.segmented(w.controls, { label: 'Правило', value: s.key, options: Object.keys(SYN).map((k) => ({ value: k, label: SYN[k].label })), onChange: (v) => ((s.key = v), draw()) });
    ui.slider(w.controls, { label: 'Шум меток ε', min: 0, max: 0.5, step: 0.01, value: s.eps, format: f2, onInput: (v) => ((s.eps = v), draw()) });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const labels = ['I(x₁; y)', 'I(x₂; y)', 'I(x₁, x₂; y)', 'I(x₂; y | x₁)'];
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: '', domain: [-0.6, 3.6], ticks: [0, 1, 2, 3], format: (v) => labels[v] || '' }, y: { label: 'бит', domain: [0, 1.1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'I1', label: 'I(x₁; y)' }, { key: 'I2', label: 'I(x₂; y)' }, { key: 'I12', label: 'вместе' }, { key: 'int', label: 'вместе − сумма' }]);
    function draw() {
      const r = synCalc(s.key, s.eps);
      rowTable(tbl, ['x₁', 'x₂', 'P(x₁, x₂)', 'P(y = 1 | x₁, x₂)'], r.cells.map((c) => [String(c.a), String(c.b), f3(c.pab), f3(c.q)]), null, false);
      const v = [r.I1, r.I2, r.I12, r.cond];
      plot.render([{ type: 'bars', x: [0, 1, 2, 3], y: v, color: (i) => ['blue', 'aqua', 'violet', 'orange'][i], width: 0.6, maxPx: 70, tooltip: (i) => [[labels[i], f4(v[i])]] }]);
      st.set('I1', f3(r.I1));
      st.set('I2', f3(r.I2));
      st.set('I12', f3(r.I12));
      st.set('int', U.fmtSigned(r.inter, 3));
      const txt = { xor: '<b>XOR</b>: каждый признак в отдельности не сообщает о классе <b>ничего</b> (0 бит), а вместе — 1 бит (при ε = 0). Это синергия: «вместе − сумма» = +1. Отбор признаков по одиночной взаимной информации выбросил бы оба, а жадное дерево не найдёт выигрыша на первом разбиении (урок 2.4). Спасает глубина: после разбиения по x₁ признак x₂ становится информативным — I(x₂; y | x₁) = 1.', and: '<b>AND</b>: каждый признак полезен и сам по себе (0.311 бита), но вместе знают больше суммы (0.811 &gt; 0.623) — немного синергии.', indep: 'x₂ — чистый шум: I(x₂; y) = 0 и I(x₂; y | x₁) = 0. Взаимная информация честно отбрасывает такой признак.', copy: '<b>Копия</b>: каждый признак знает 1 бит, но вместе — тоже 1 бит: «вместе − сумма» = −1, избыточность. Отбор по одиночной взаимной информации выбрал бы оба, хотя второй ничего не добавляет. Поэтому алгоритмы вроде mRMR штрафуют за похожесть на уже выбранные признаки, а в бустинге дубликаты делят между собой важность (урок 12.1).' };
      note.innerHTML = txt[s.key] + ' Шум ε уменьшает всё: даже идеальное правило при ε = 0.1 даёт лишь 1 − h(0.1) = 0.531 бита.';
    }
    w.pythonAction(() => PY_NP + PY_MI + `
eps, rule, copy = ${py(s.eps)}, ${{ xor: '"xor"', and: '"and"', indep: '"indep"', copy: '"copy"' }[s.key]}, ${SYN[s.key].copy ? 'True' : 'False'}
f = {"xor": lambda a, b: a ^ b, "and": lambda a, b: a & b, "indep": lambda a, b: a, "copy": lambda a, b: a}[rule]
P = np.zeros((2, 2, 2))   # P[x1, x2, y]
for a in (0, 1):
    for b in (0, 1):
        pab = (0.5 if a == b else 0.0) if copy else 0.25
        q = eps + (1 - 2 * eps) * f(a, b)
        P[a, b] = pab * (1 - q), pab * q
I1, I2 = mi(P.sum(1)), mi(P.sum(0))
I12 = mi(P.reshape(4, 2)[P.reshape(4, 2).sum(1) > 0])
print(f"I(x1;y) = {I1:.3f}, I(x2;y) = {I2:.3f}, I(x1,x2;y) = {I12:.3f}, I(x2;y|x1) = {I12 - I1:.3f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 22. Канал с шумом: ёмкость и код повторения
   * ============================================================================== */
  const repErr = (n, e) => {
    let s = 0;
    for (let k = Math.ceil((n + 1) / 2); k <= n; k++) s += Math.exp(L0.lgamma(n + 1) - L0.lgamma(k + 1) - L0.lgamma(n - k + 1)) * Math.pow(e, k) * Math.pow(1 - e, n - k);
    return s;
  };
  GBC.widget('noisy-channel', (el) => {
    const s = { e: 0.1, n: 3, seed: 1 };
    const NBITS = 48;
    const w = ui.shell(el, { title: 'Канал с шумом: передать биты, которые иногда переворачиваются', sub: 'Двоичный симметричный канал: каждый переданный бит переворачивается с вероятностью ε. Код повторения шлёт каждый бит n раз и решает большинством голосов. Ошибок меньше — но и скорость всего 1/n бита за передачу. Шеннон: при скорости ниже ёмкости C = 1 − h(ε) можно сделать ошибку сколь угодно малой.' });
    ui.slider(w.controls, { label: 'Вероятность переворота ε', min: 0, max: 0.5, step: 0.01, value: s.e, format: f2, onInput: (v) => ((s.e = v), draw()) });
    ui.segmented(w.controls, { label: 'Повторов n', value: s.n, options: [1, 3, 5, 7, 9].map((v) => ({ value: v, label: String(v) })), onChange: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Новое сообщение', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const grid = scrollBox();
    w.main.appendChild(grid);
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'скорость R, бит за передачу', domain: [0, 1.05] }, y: { label: 'ошибка на бит (лог.)', type: 'log', domain: [1e-6, 1], ticks: [1e-6, 1e-4, 1e-2, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'C', label: 'ёмкость C = 1 − h(ε)' }, { key: 'R', label: 'скорость 1/n' }, { key: 'pe', label: 'ошибка (теория)' }, { key: 'obs', label: 'ошибок в опыте' }]);
    function draw() {
      const rng = new GBC.RNG(1000 + s.seed);
      const msg = U.range(NBITS).map(() => (rng.random() < 0.5 ? 1 : 0));
      const copies = U.range(s.n).map(() => []);
      const dec = [];
      for (let i = 0; i < NBITS; i++) {
        let ones = 0;
        for (let c = 0; c < s.n; c++) {
          const b = rng.random() < s.e ? 1 - msg[i] : msg[i];
          copies[c].push(b);
          ones += b;
        }
        dec.push(ones * 2 > s.n ? 1 : 0);
      }
      const cs = 11;
      const W = 92 + NBITS * cs;
      const rows = s.n + 2;
      const Hh = rows * (cs + 5) + 10;
      const svg = S('svg', { width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh, role: 'img', 'aria-label': 'Биты сообщения', style: 'display:block;min-width:' + W + 'px;max-width:none' });
      const row = (ri, label, bits, ref, strong) => {
        const y = 5 + ri * (cs + 5);
        svg.appendChild(S('text', { x: 0, y: y + cs - 1, style: 'font-size:11px;fill:var(--ink-2)' }, label));
        bits.forEach((b, i) => {
          const bad = ref && b !== ref[i];
          svg.appendChild(S('rect', { x: 90 + i * cs, y, width: cs - 2, height: cs, rx: 2, style: 'fill:' + (b ? 'var(--ink-2)' : 'var(--surface-2)') + ';stroke:' + (bad ? 'var(--c-red)' : 'var(--border)') + ';stroke-width:' + (bad ? (strong ? 2.6 : 1.8) : 0.8) }));
        });
      };
      row(0, 'сообщение', msg, null);
      copies.forEach((c, k) => row(k + 1, 'копия ' + (k + 1), c, msg));
      row(s.n + 1, 'голосование', dec, msg, true);
      grid.replaceChildren(svg);
      const errs = dec.filter((b, i) => b !== msg[i]).length;
      const C = 1 - hbin(s.e);
      const ns = [1, 3, 5, 7, 9, 11, 13, 15];
      const errsTh = ns.map((n) => Math.max(1e-6, repErr(n, s.e)));
      plot.render([
        { type: 'vband', x0: 0, x1: C, color: 'good', opacity: 0.08 },
        { type: 'vline', x: C, color: 'tree', width: 2, text: 'ёмкость C' },
        { type: 'line', x: ns.map((n) => 1 / n), y: errsTh, color: 'model', width: 1.6, label: 'код повторения' },
        { type: 'points', x: ns.map((n) => 1 / n), y: errsTh, color: 'model', r: 4, tooltip: (i) => [['n', String(ns[i])], ['скорость', f3(1 / ns[i])], ['ошибка', sci(errsTh[i])]] },
        { type: 'points', x: [1 / s.n], y: [Math.max(1e-6, repErr(s.n, s.e))], color: 'tree', r: 7 },
      ]);
      st.set('C', f3(C));
      st.set('R', f3(1 / s.n));
      st.set('pe', sci(repErr(s.n, s.e)));
      st.set('obs', errs + ' из ' + NBITS);
      note.innerHTML = 'При ε = 0.1: ёмкость 0.531 бита за передачу. Повтор ×3 снижает ошибку с 0.1 до 0.028, ×5 — до 0.0086, но скорость падает до 1/3 и 1/5 — далеко левее ёмкости. Теорема Шеннона о канале утверждает больше: <b>любую скорость R &lt; C</b> можно передавать с ошибкой, стремящейся к нулю (зелёная зона), если кодировать длинными блоками; при R &gt; C — нельзя. Для машинного обучения это урок о <b>шуме меток</b>: если метки переворачиваются с вероятностью ε, каждая метка несёт о настоящем классе не больше 1 − h(ε) бита, и никакая модель не опустит log-loss ниже h(ε) (шаг 34).';
    }
    w.pythonAction(() => PY_NP + PY_RNG + `from scipy.stats import binom

eps, n = ${py(s.e)}, ${s.n}
h = lambda p: 0.0 if p in (0, 1) else -p * np.log2(p) - (1 - p) * np.log2(1 - p)
print(f"ёмкость C = {1 - h(eps):.3f} бит за передачу")
for k in (1, 3, 5, 7, 9):
    print(f"повтор ×{k}: скорость {1 / k:.3f}, ошибка {binom.sf(k // 2, k, eps):.2e}")
rng = Mulberry32(${1000 + s.seed})
msg = [1 if rng.random() < 0.5 else 0 for _ in range(48)]
dec = []
for b in msg:
    ones = sum((1 - b if rng.random() < eps else b) for _ in range(n))
    dec.append(1 if 2 * ones > n else 0)
print("ошибок после голосования:", sum(a != b for a, b in zip(msg, dec)), "из 48")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 23. Перекрёстная энтропия: код под чужое распределение
   * ============================================================================== */
  GBC.widget('cross-codes', (el) => {
    const P_PRE = { pow2: [0.5, 0.25, 0.125, 0.125], skew: [0.7, 0.1, 0.1, 0.1], flat: [0.25, 0.25, 0.25, 0.25] };
    const s = { p: 'pow2', q: [0.25, 0.25, 0.25, 0.25] };
    const names = ['A', 'B', 'C', 'D'];
    const w = ui.shell(el, { title: 'Перекрёстная энтропия: код построен под q, а символы приходят по p', sub: 'Истинные частоты символов — p. Код построен под модель q: длина слова символа i — идеально −log₂ qᵢ. Средняя длина при данных из p — перекрёстная энтропия H(p, q) = −Σ pᵢ log₂ qᵢ. Перерасход над H(p) — дивергенция KL(p ‖ q).' });
    ui.segmented(w.controls, { label: 'Истинное p', value: s.p, options: [{ value: 'pow2', label: '½ ¼ ⅛ ⅛' }, { value: 'skew', label: '.7 .1 .1 .1' }, { value: 'flat', label: 'ровно' }], onChange: (v) => ((s.p = v), draw()) });
    ui.segmented(w.controls, { label: 'Модель q', value: null, options: [{ value: 'p', label: 'q = p' }, { value: 'flat', label: 'ровно' }, { value: 'rev', label: 'наоборот' }], onChange: (v) => {
      const p = P_PRE[s.p];
      s.q = v === 'p' ? p.slice() : v === 'flat' ? [0.25, 0.25, 0.25, 0.25] : p.slice().reverse();
      sl.forEach((x, i) => x.set(s.q[i]));
      draw();
    } });
    const sl = names.map((nm, i) => ui.slider(w.controls, { label: 'q для ' + nm, min: 0.01, max: 1, step: 0.01, value: s.q[i], format: f2, onInput: (v) => ((s.q[i] = v), draw()) }));
    const p1 = new GBC.Plot(w.main, { height: 210, x: { label: 'символ', domain: [0.4, 4.6], ticks: [1, 2, 3, 4], format: (v) => names[v - 1] || '' }, y: { label: 'вероятность', domain: [0, 1] } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'символ', domain: [0.4, 4.6], ticks: [1, 2, 3, 4], format: (v) => names[v - 1] || '' }, y: { label: 'длина слова, бит', domain: [0, 7] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'H', label: 'H(p)' }, { key: 'CE', label: 'H(p, q)' }, { key: 'KL', label: 'KL(p ‖ q)' }, { key: 'KLr', label: 'KL(q ‖ p)' }, { key: 'hf', label: 'Хаффман под q на данных p' }]);
    function draw() {
      const p = P_PRE[s.p];
      const q = normalize(s.q);
      const xs = [1, 2, 3, 4];
      p1.render([
        { type: 'bars', x: xs.map((x) => x - 0.17), y: p, width: 0.3, maxPx: 34, color: 'muted', label: 'истинное p' },
        { type: 'bars', x: xs.map((x) => x + 0.17), y: q, width: 0.3, maxPx: 34, color: 'model', label: 'модель q (нормирована)' },
      ], { y: [0, Math.max(...p, ...q) * 1.15] });
      p2.render([
        { type: 'bars', x: xs.map((x) => x - 0.17), y: p.map((v) => -lg(v)), width: 0.3, maxPx: 34, color: 'muted', label: 'идеал −log₂ p' },
        { type: 'bars', x: xs.map((x) => x + 0.17), y: q.map((v) => -lg(v)), width: 0.3, maxPx: 34, color: 'model', label: 'по модели −log₂ q' },
      ], { y: [0, Math.max(4, ...q.map((v) => -lg(v))) * 1.1] });
      const hl = huffman(q).lens;
      st.set('H', f3(Hb(p)));
      st.set('CE', f3(L0.ceb(p, q)));
      st.set('KL', f3(klb(p, q)));
      st.set('KLr', f3(klb(q, p)));
      st.set('hf', f3(avgLen(p, hl)));
      note.innerHTML = 'p = ½, ¼, ⅛, ⅛ и равномерная q: каждый символ — 2 бита, H(p, q) = 2, перерасход KL = 0.25 бита. «Наоборот» (⅛, ⅛, ¼, ½): частому A достаётся 3 бита — H(p, q) = 2.625, KL = 0.875. Длинные слова для частых символов — главный источник потерь: KL = Σ pᵢ (log₂ pᵢ − log₂ qᵢ) взвешивает ошибку длины частотой символа. <b>Неравенство Гиббса</b>: H(p, q) ≥ H(p), равенство только при q = p.';
    }
    w.pythonAction(() => PY_NP + `from scipy.stats import entropy

p = np.array(${JSON.stringify(P_PRE[s.p])})
q = np.array(${JSON.stringify(normalize(s.q).map((v) => Number(v.toPrecision(10))))})
H, CE = entropy(p, base=2), -(p * np.log2(q)).sum()
print(f"H(p) = {H:.3f}, H(p,q) = {CE:.3f}, KL(p||q) = {CE - H:.3f} = {entropy(p, q, base=2):.3f}, KL(q||p) = {entropy(q, p, base=2):.3f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 24. KL несимметрична и не расстояние
   * ============================================================================== */
  const klB = (p, q) => klb([p, 1 - p], [q, 1 - q]);
  const jsB = (p, q) => {
    const m = (p + q) / 2;
    return 0.5 * klB(p, m) + 0.5 * klB(q, m);
  };
  GBC.widget('kl-asym', (el) => {
    const s = { p: 0.5, q: 0.9 };
    const w = ui.shell(el, { title: 'KL несимметрична: KL(p ‖ q) ≠ KL(q ‖ p)', sub: 'Две монеты: истинная с вероятностью орла p и модель с вероятностью q. Синяя кривая — KL(p ‖ q) при фиксированном p как функция q; оранжевая — KL(q ‖ p). Обе нулевые только при q = p, но растут по-разному.' });
    ui.slider(w.controls, { label: 'Истинная p', min: 0.01, max: 0.99, step: 0.01, value: s.p, format: f2, onInput: (v) => ((s.p = v), draw()) });
    ui.slider(w.controls, { label: 'Модель q', min: 0.01, max: 0.99, step: 0.01, value: s.q, format: f2, onInput: (v) => ((s.q = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'q', domain: [0, 1] }, y: { label: 'бит', domain: [0, 3] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'KL(p ‖ q)' }, { key: 'r', label: 'KL(q ‖ p)' }, { key: 'js', label: 'JS(p, q)' }, { key: 'tri', label: 'KL(p ‖ m) + KL(m ‖ q), m = середина' }]);
    function draw() {
      const qs = U.linspace(0.002, 0.998, 400);
      const m = (s.p + s.q) / 2;
      plot.render([
        { type: 'line', x: qs, y: qs.map((q) => klB(s.p, q)), color: 'model', width: 2.2, label: 'KL(p ‖ q)' },
        { type: 'line', x: qs, y: qs.map((q) => klB(q, s.p)), color: 'tree', width: 2.2, label: 'KL(q ‖ p)' },
        { type: 'line', x: qs, y: qs.map((q) => jsB(s.p, q)), color: 'aqua', width: 1.8, dash: '6 4', label: 'Дженсен — Шеннон' },
        { type: 'vline', x: s.p, color: 'ink2', dash: '3 3', width: 1, text: 'q = p' },
        { type: 'points', x: [s.q, s.q], y: [klB(s.p, s.q), klB(s.q, s.p)], color: (i) => (i ? 'tree' : 'model'), r: 6 },
      ]);
      st.set('f', f3(klB(s.p, s.q)));
      st.set('r', f3(klB(s.q, s.p)));
      st.set('js', f3(jsB(s.p, s.q)));
      st.set('tri', f3(klB(s.p, m) + klB(m, s.q)));
      note.innerHTML = 'p = 0.5, q = 0.9: KL(p ‖ q) = 0.737, KL(q ‖ p) = 0.531. Если модель q почти уверена (q → 0 или 1), а исход по p вполне возможен, KL(p ‖ q) → ∞: «не ожидал — дорого заплатил». KL(q ‖ p) при этом конечна. Неравенство треугольника тоже нарушается: через середину m = 0.7 «путь» стоит 0.126 + 0.221 = 0.347 &lt; 0.737. Поэтому KL — <b>дивергенция</b>, а не расстояние. Симметричная и ограниченная альтернатива — расхождение Дженсена — Шеннона (≤ 1 бита).';
    }
    w.pythonAction(() => PY_NP + `from scipy.stats import entropy
from scipy.spatial.distance import jensenshannon

p, q = ${py(s.p)}, ${py(s.q)}
P, Q = [p, 1 - p], [q, 1 - q]
print(f"KL(p||q) = {entropy(P, Q, base=2):.3f}, KL(q||p) = {entropy(Q, P, base=2):.3f}, JS = {jensenshannon(P, Q, base=2)**2:.3f} бит")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 25. Прямая и обратная KL при подгонке: «накрыть всё» или «выбрать моду»
   * ============================================================================== */
  const SDm = 0.5;
  const lnN = (x, m, s) => -0.5 * ((x - m) / s) ** 2 - Math.log(s * Math.sqrt(2 * Math.PI));
  function mixLogP(x, d, wl) {
    const a = Math.log(wl) + lnN(x, -d, SDm);
    const b = Math.log(1 - wl) + lnN(x, d, SDm);
    const m = Math.max(a, b);
    return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
  }
  /** ∫ p ln p (наты) — один раз на смесь. */
  function mixNegEnt(d, wl) {
    const xs = U.linspace(-9, 9, 3601);
    const dx = xs[1] - xs[0];
    let s = 0;
    for (const x of xs) {
      const lp = mixLogP(x, d, wl);
      s += Math.exp(lp) * lp * dx;
    }
    return s;
  }
  /** KL(p ‖ q) в натах для гауссовой q (аналитически по моментам смеси). */
  function klFwd(d, wl, mu, sd, negEnt) {
    const m1 = wl * -d + (1 - wl) * d;
    const m2 = SDm * SDm + d * d;
    const eLogQ = -Math.log(sd * Math.sqrt(2 * Math.PI)) - (m2 - 2 * mu * m1 + mu * mu) / (2 * sd * sd);
    return negEnt - eLogQ;
  }
  /** KL(q ‖ p) в натах: −h(q) − ∫ q ln p. */
  function klRev(d, wl, mu, sd) {
    const K = 480;
    let s = 0;
    const dx = (16 * sd) / K;
    for (let i = 0; i < K; i++) {
      const x = mu - 8 * sd + (i + 0.5) * dx;
      const lq = lnN(x, mu, sd);
      s += Math.exp(lq) * mixLogP(x, d, wl) * dx;
    }
    return -0.5 * Math.log(2 * Math.PI * Math.E * sd * sd) - s;
  }
  /** Локальный минимум KL(q ‖ p) поиском по шаблону из старта (μ₀, σ₀). */
  function fitRev(d, wl, mu0, sd0) {
    let mu = mu0;
    let ls = Math.log(sd0);
    let best = klRev(d, wl, mu, Math.exp(ls));
    let step = 0.5;
    while (step > 1e-4) {
      let moved = false;
      for (const [a, b] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const v = klRev(d, wl, mu + a, Math.exp(ls + b));
        if (v < best - 1e-12) {
          best = v;
          mu += a;
          ls += b;
          moved = true;
          break;
        }
      }
      if (!moved) step /= 2;
    }
    return { mu, sd: Math.exp(ls), kl: best };
  }
  GBC.widget('kl-fit', (el) => {
    const s = { d: 2, wl: 0.5, mu: 0, sd: 1 };
    const w = ui.shell(el, { title: 'Подгоняем одну «шапку» к двугорбому распределению', sub: 'Истинное p — смесь двух нормальных горбов. Модель q — одна нормальная кривая N(μ, σ²). Минимум прямой KL(p ‖ q) (это максимум правдоподобия) накрывает оба горба; минимум обратной KL(q ‖ p) садится на один горб. Ползунками μ и σ можно искать вручную.' });
    ui.slider(w.controls, { label: 'Расстояние горбов от нуля d', min: 0, max: 3, step: 0.05, value: s.d, format: f2, onInput: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'Вес левого горба', min: 0.1, max: 0.9, step: 0.05, value: s.wl, format: f2, onInput: (v) => ((s.wl = v), draw()) });
    ui.slider(w.controls, { label: 'Своя q: μ', min: -4, max: 4, step: 0.05, value: s.mu, format: f2, onInput: (v) => ((s.mu = v), draw()) });
    ui.slider(w.controls, { label: 'Своя q: σ', min: 0.2, max: 3, step: 0.05, value: s.sd, format: f2, onInput: (v) => ((s.sd = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'x', domain: [-5, 5] }, y: { label: 'плотность', domain: [0, 0.9] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'fwd', label: 'прямая: μ, σ, KL(p ‖ q)' }, { key: 'rev', label: 'обратная: μ, σ, KL(q ‖ p)' }, { key: 'own', label: 'своя q: KL(p ‖ q) / KL(q ‖ p)' }]);
    const cache = {};
    function draw() {
      const key = s.d + '|' + s.wl;
      if (!cache[key]) {
        const negEnt = mixNegEnt(s.d, s.wl);
        const m1 = s.wl * -s.d + (1 - s.wl) * s.d;
        const fwd = { mu: m1, sd: Math.sqrt(SDm * SDm + s.d * s.d - m1 * m1) };
        fwd.kl = klFwd(s.d, s.wl, fwd.mu, fwd.sd, negEnt);
        const cands = [fitRev(s.d, s.wl, -s.d, SDm), fitRev(s.d, s.wl, s.d, SDm), fitRev(s.d, s.wl, m1, fwd.sd)];
        cands.sort((a, b) => a.kl - b.kl);
        cache[key] = { negEnt, fwd, rev: cands[0], cands };
      }
      const { negEnt, fwd, rev } = cache[key];
      const xs = U.linspace(-5, 5, 501);
      const pd = xs.map((x) => Math.exp(mixLogP(x, s.d, s.wl)));
      const qd = (mu, sd) => xs.map((x) => Math.exp(lnN(x, mu, sd)));
      plot.render([
        { type: 'area', x: xs, y0: xs.map(() => 0), y1: pd, color: 'data', opacity: 0.25 },
        { type: 'line', x: xs, y: pd, color: 'data', width: 2, label: 'истинное p' },
        { type: 'line', x: xs, y: qd(fwd.mu, fwd.sd), color: 'model', width: 2.4, label: 'min KL(p ‖ q)' },
        { type: 'line', x: xs, y: qd(rev.mu, rev.sd), color: 'tree', width: 2.4, label: 'min KL(q ‖ p)' },
        { type: 'line', x: xs, y: qd(s.mu, s.sd), color: 'ink2', width: 1.6, dash: '5 4', label: 'своя q' },
      ], { y: [0, Math.max(...pd, ...qd(rev.mu, rev.sd), 0.3) * 1.12] });
      const b = 1 / Math.LN2;
      st.set('fwd', f2(fwd.mu) + ', ' + f2(fwd.sd) + ', ' + f3(fwd.kl * b));
      st.set('rev', f2(rev.mu) + ', ' + f2(rev.sd) + ', ' + f3(rev.kl * b));
      st.set('own', f3(klFwd(s.d, s.wl, s.mu, s.sd, negEnt) * b) + ' / ' + f3(klRev(s.d, s.wl, s.mu, s.sd) * b));
      note.innerHTML = '<b>Прямая KL(p ‖ q)</b> взвешивает ошибки по p: где данные есть, а модель говорит «почти невозможно», штраф огромен. Поэтому её минимум — «накрыть всё» (moment matching: μ и σ² совпадают со средним и дисперсией p), даже если в середине данных нет. Именно её минимизирует максимум правдоподобия и log-loss — модели бустинга осторожны и не обнуляют вероятности возможных исходов. <b>Обратная KL(q ‖ p)</b> взвешивает по q: штрафует модель за массу там, где данных нет, и выбирает один горб (при d = 2 — μ ≈ ±' + f2(Math.abs(rev.mu)) + '). Так ведут себя вариационные методы.';
    }
    w.pythonAction(() => PY_NP + `from scipy.optimize import minimize
from scipy.stats import norm

d, wl, s0 = ${py(s.d)}, ${py(s.wl)}, 0.5
x = np.linspace(-9, 9, 3601); dx = x[1] - x[0]
p = wl * norm.pdf(x, -d, s0) + (1 - wl) * norm.pdf(x, d, s0)
kl_fwd = lambda m, s: np.sum(p * (np.log(p + 1e-300) - norm.logpdf(x, m, s))) * dx
kl_rev = lambda m, s: np.sum(norm.pdf(x, m, s) * (norm.logpdf(x, m, s) - np.log(p + 1e-300))) * dx
mu = (p * x).sum() * dx; sd = np.sqrt((p * (x - mu) ** 2).sum() * dx)
print(f"прямая: μ = {mu:.3f}, σ = {sd:.3f}, KL(p||q) = {kl_fwd(mu, sd) / np.log(2):.3f} бит")
for start in (-d, d):
    r = minimize(lambda t: kl_rev(t[0], np.exp(t[1])), [start, np.log(s0)], method="Nelder-Mead")
    print(f"обратная из {start:+.2f}: μ = {r.x[0]:.3f}, σ = {np.exp(r.x[1]):.3f}, KL(q||p) = {r.fun / np.log(2):.3f} бит")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 26. Расхождения для сдвига данных: KL, PSI, JS, полная вариация
   * ============================================================================== */
  const EDGES10 = [-Infinity].concat(U.range(9, 1).map((k) => probit(k / 10)), [Infinity]);
  GBC.widget('divergences', (el) => {
    const s = { shift: 0.3, scale: 1 };
    const w = ui.shell(el, { title: 'Сдвиг данных: насколько новое распределение признака отличается от старого', sub: 'На обучении признак ~ N(0, 1), его делят на 10 корзин по децилям: в каждой ровно 10 % (p). В эксплуатации признак ~ N(сдвиг, масштаб²): доли q в тех же корзинах меняются. Сравниваем несколько мер расхождения.' });
    ui.slider(w.controls, { label: 'Сдвиг среднего (в σ)', min: -1.5, max: 1.5, step: 0.05, value: s.shift, format: f2, onInput: (v) => ((s.shift = v), draw()) });
    ui.slider(w.controls, { label: 'Масштаб разброса', min: 0.5, max: 2, step: 0.05, value: s.scale, format: f2, onInput: (v) => ((s.scale = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'корзина (дециль обучения)', domain: [0.4, 10.6], ticks: U.range(10, 1) }, y: { label: 'доля', domain: [0, 0.3] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'kl', label: 'KL(q ‖ p), нат' }, { key: 'klr', label: 'KL(p ‖ q), нат' }, { key: 'psi', label: 'PSI = сумма' }, { key: 'js', label: 'JS, бит' }, { key: 'tv', label: 'полная вариация' }, { key: 'pin', label: '√(KL/2) (Пинскер)' }]);
    function draw() {
      const p = new Array(10).fill(0.1);
      const q = U.range(10).map((j) => Phi((EDGES10[j + 1] - s.shift) / s.scale) - Phi((EDGES10[j] - s.shift) / s.scale));
      const kl = klb(q, p) * Math.LN2;
      const klr = klb(p, q) * Math.LN2;
      const m = p.map((v, j) => (v + q[j]) / 2);
      const js = 0.5 * klb(p, m) + 0.5 * klb(q, m);
      const tv = 0.5 * U.sum(p.map((v, j) => Math.abs(v - q[j])));
      const xs = U.range(10, 1);
      plot.render([
        { type: 'bars', x: xs.map((x) => x - 0.17), y: p, width: 0.3, maxPx: 22, color: 'muted', label: 'обучение p' },
        { type: 'bars', x: xs.map((x) => x + 0.17), y: q, width: 0.3, maxPx: 22, color: 'model', label: 'эксплуатация q' },
      ], { y: [0, Math.max(0.2, ...q) * 1.15] });
      const psi = kl + klr;
      st.set('kl', f4(kl));
      st.set('klr', f4(klr));
      st.set('psi', f4(psi));
      st.set('js', f4(js));
      st.set('tv', f4(tv));
      st.set('pin', f4(Math.sqrt(kl / 2)));
      const verdict = psi < 0.1 ? badge('PSI < 0.1: стабильно', 'good') : psi < 0.25 ? badge('0.1–0.25: заметный сдвиг', 'warn') : badge('PSI > 0.25: сильный сдвиг', 'bad');
      note.innerHTML = '';
      note.appendChild(verdict);
      note.insertAdjacentHTML('beforeend', ' PSI из урока 15.14 — это <b>симметризованная KL</b> (дивергенция Джеффриса): Σ (qⱼ − pⱼ) ln(qⱼ/pⱼ) = KL(q ‖ p) + KL(p ‖ q). Сдвиг на 0.3σ даёт PSI = 0.086, на 0.5σ — 0.238, удвоение разброса — 0.49. Здесь доли вычислены точно; по выборке PSI выходит больше за счёт случайных колебаний (в уроке 15.14 сдвиг 0.1σ на 1000 объектов дал 0.043 при точном значении около 0.01). Неравенство Пинскера: полная вариация ≤ √(KL/2) — малая KL гарантирует, что вероятности любых событий почти не изменились. Расширение разброса (масштаб 2) тоже ловится: крайние корзины «распухают».');
    }
    w.pythonAction(() => PY_NP + `from scipy.stats import norm, entropy

shift, scale = ${py(s.shift)}, ${py(s.scale)}
edges = norm.ppf(np.linspace(0, 1, 11))                       # децили обучения: ±∞ по краям
p = np.full(10, 0.1)
q = np.diff(norm.cdf((edges - shift) / scale))
kl, klr = entropy(q, p), entropy(p, q)                        # наты
m = (p + q) / 2
print(f"KL(q||p) = {kl:.4f}, KL(p||q) = {klr:.4f}, PSI = {np.sum((q - p) * np.log(q / p)):.4f} = {kl + klr:.4f}")
print(f"JS = {(entropy(p, m, base=2) + entropy(q, m, base=2)) / 2:.4f} бит, TV = {0.5 * np.abs(p - q).sum():.4f} ≤ √(KL/2) = {np.sqrt(kl / 2):.4f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 27. Максимальное правдоподобие = минимум KL; сглаживание спасает от нулей
   * ============================================================================== */
  const MLE_P = [0.35, 0.25, 0.18, 0.12, 0.07, 0.03];
  const MLE_A = U.range(61).map((i) => i * 0.05);
  function mleSample(n, seed) {
    const rng = new GBC.RNG(seed);
    const cum = cumsum(MLE_P);
    const c = new Array(6).fill(0);
    for (let i = 0; i < n; i++) c[pick(cum, rng.random())]++;
    return c;
  }
  const qAlpha = (c, n, a) => c.map((v) => (v + a) / (n + 6 * a));
  GBC.widget('mle-kl', (el) => {
    const s = { n: 20, a: 0, seed: 3 };
    const R = 300;
    const w = ui.shell(el, { title: 'Правдоподобие, KL и сглаживание частот', sub: 'Истинное распределение категорий p (6 вариантов). По выборке размера n оцениваем q = (счёт + α)/(n + 6α). При α = 0 это частоты — оценка максимального правдоподобия: она минимизирует перекрёстную энтропию на самой выборке. Но на новых данных важна KL(p ‖ q).' });
    ui.slider(w.controls, { label: 'Размер выборки n', values: [5, 10, 20, 50, 100, 500, 2000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Сглаживание α', min: 0, max: 3, step: 0.05, value: s.a, format: f2, onInput: (v) => ((s.a = v), draw()) });
    ui.button(w.controls, { label: 'Новая выборка', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'категория', domain: [0.4, 6.6], ticks: U.range(6, 1) }, y: { label: 'вероятность', domain: [0, 0.6] } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'сглаживание α', domain: [0, 3] }, y: { label: 'KL(p ‖ q), бит', domain: [0, 0.6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'zero', label: 'пустых категорий' }, { key: 'tr', label: 'H(p̂, q) на выборке' }, { key: 'te', label: 'H(p, q) на новых данных' }, { key: 'kl', label: 'KL(p ‖ q)' }, { key: 'best', label: 'лучшее α (в среднем)' }]);
    const avgCache = {};
    function avgCurve(n) {
      if (avgCache[n]) return avgCache[n];
      const sums = MLE_A.map(() => 0);
      let infs = MLE_A.map(() => 0);
      for (let r = 0; r < R; r++) {
        const c = mleSample(n, 500 + r);
        MLE_A.forEach((a, k) => {
          const v = klb(MLE_P, qAlpha(c, n, a));
          if (Number.isFinite(v)) sums[k] += v;
          else infs[k]++;
        });
      }
      return (avgCache[n] = MLE_A.map((_, k) => (infs[k] ? Infinity : sums[k] / R)));
    }
    function draw() {
      const c = mleSample(s.n, s.seed);
      const ph = c.map((v) => v / s.n);
      const q = qAlpha(c, s.n, s.a);
      const xs = U.range(6, 1);
      p1.render([
        { type: 'bars', x: xs.map((x) => x - 0.25), y: MLE_P, width: 0.22, maxPx: 20, color: 'muted', label: 'истинное p' },
        { type: 'bars', x: xs, y: ph, width: 0.22, maxPx: 20, color: 'data', label: 'частоты p̂' },
        { type: 'bars', x: xs.map((x) => x + 0.25), y: q, width: 0.22, maxPx: 20, color: 'model', label: 'оценка q (с α)' },
      ], { y: [0, Math.max(...ph, ...q, 0.4) * 1.12] });
      const avg = avgCurve(s.n);
      const mine = MLE_A.map((a) => klb(MLE_P, qAlpha(c, s.n, a)));
      const fin = avg.filter(Number.isFinite);
      const kBest = avg.indexOf(Math.min(...fin));
      const top = Math.max(0.05, ...fin.slice(0, 40), ...mine.filter(Number.isFinite).slice(0, 40)) * 1.15;
      p2.render([
        { type: 'line', x: MLE_A, y: avg.map((v) => (Number.isFinite(v) ? v : NaN)), color: 'model', width: 2.2, label: 'в среднем по 300 выборкам' },
        { type: 'line', x: MLE_A, y: mine.map((v) => (Number.isFinite(v) ? v : NaN)), color: 'tree', width: 1.6, dash: '5 4', label: 'эта выборка' },
        { type: 'points', x: [MLE_A[kBest]], y: [avg[kBest]], color: 'model', r: 6 },
        { type: 'vline', x: s.a, color: 'ink2', width: 1, dash: '3 3' },
      ], { y: [0, Math.min(top, 3)] });
      const zero = c.filter((v) => v === 0).length;
      const kl = klb(MLE_P, q);
      st.set('zero', String(zero));
      st.set('tr', f3(L0.ceb(ph, q)));
      st.set('te', Number.isFinite(kl) ? f3(L0.ceb(MLE_P, q)) : '∞');
      st.set('kl', Number.isFinite(kl) ? f3(kl) : '∞');
      st.set('best', f2(MLE_A[kBest]));
      note.innerHTML = 'Средний log-loss на выборке = H(p̂, q) = H(p̂) + KL(p̂ ‖ q): максимум правдоподобия делает KL до <b>данных</b> нулевой (q = p̂). Но мерить надо KL до <b>истины</b>. При малом n часть категорий не встречается (' + zero + ' из 6 в этой выборке), и при α = 0 модель называет их невозможными: KL и log-loss на новых данных бесконечны. Сглаживание (Лаплас: α = 1) — это регуляризация: при этом n лучшее α в среднем ≈ ' + f2(MLE_A[kBest]) + ' (для n от 5 до 100 — около 1.6). С ростом n выбор α всё меньше важен: при n = 500 и α = 0, 1 или 2 KL почти одинакова и близка к (k − 1)/(2n ln 2) = 0.0072 бита. Та же идея — в λ знаменателя листа XGBoost и в сглаживании целевого кодирования категорий (урок 10.1).';
    }
    w.pythonAction(() => PY_NP + PY_RNG + `
p = np.array(${JSON.stringify(MLE_P)}); cum = np.cumsum(p)
def sample(n, seed):
    rng, c = Mulberry32(seed), np.zeros(6, int)
    for _ in range(n):
        c[min(np.searchsorted(cum, rng.random(), side="right"), 5)] += 1
    return c
kl = lambda q: np.inf if np.any(q == 0) else float((p * np.log2(p / q)).sum())
n, alpha = ${s.n}, ${py(s.a)}
c = sample(n, ${s.seed})
q = (c + alpha) / (n + 6 * alpha)
print("счёты:", c, " KL(p||q) =", kl(q))
alphas = np.arange(61) * 0.05
samples = [sample(n, 500 + r) for r in range(${R})]        # те же 300 выборок, что и на странице
avg = [np.mean([kl((c_ + a) / (n + 6 * a)) for c_ in samples]) for a in alphas]
print("лучшее α в среднем:", alphas[int(np.argmin(avg))], " теория KL частот ≈", 5 / (2 * n * np.log(2)))
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 28. Log-loss — сумма неожиданностей
   * ============================================================================== */
  const LL_Y = [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0];
  const LL_F = [2.2, 1.5, 0.9, 0.4, -0.3, 1.8, -2.0, -1.2, -0.6, 0.3, -1.6, -2.4];
  GBC.widget('logloss-surprise', (el) => {
    const s = { T: 1, eps: 1e-15, blunder: false };
    const w = ui.shell(el, { title: 'Log-loss: средняя неожиданность правильных ответов', sub: 'Двенадцать объектов: модель выдаёт вероятность класса 1, q = σ(T·F). Столбец — неожиданность правильного ответа для модели: −log₂ q(yᵢ). Синие — модель права (q(yᵢ) > ½), красные — ошибается. Log-loss — среднее этих столбцов (в натах — с ln вместо log₂).' });
    ui.slider(w.controls, { label: 'Уверенность T (множитель логитов)', min: 0, max: 5, step: 0.05, value: s.T, format: f2, onInput: (v) => ((s.T = v), draw()) });
    ui.toggle(w.controls, { label: 'одна грубая ошибка (объект 12: F = +6)', checked: false, onChange: (v) => ((s.blunder = v), draw()) });
    ui.slider(w.controls, { label: 'Обрезка вероятностей ε', min: 1e-15, max: 0.1, log: true, value: s.eps, format: sci, onInput: (v) => ((s.eps = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'объект', domain: [0.4, 12.6], ticks: U.range(12, 1) }, y: { label: '−log₂ q(y), бит', domain: [0, 6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'll', label: 'log-loss, нат' }, { key: 'bits', label: 'то же, бит' }, { key: 'acc', label: 'точность' }, { key: 'worst', label: 'доля худшего объекта' }, { key: 'pp', label: 'перплексия e^{log-loss}' }]);
    function draw() {
      const F = LL_F.slice();
      if (s.blunder) F[11] = 6;
      const q1 = F.map((f) => Math.min(1 - s.eps, Math.max(s.eps, sig(s.T * f))));
      const qy = q1.map((q, i) => (LL_Y[i] ? q : 1 - q));
      const sur = qy.map((q) => -lg(q));
      const mean = U.mean(sur);
      plot.render([
        { type: 'bars', x: U.range(12, 1), y: sur, color: (i) => (qy[i] > 0.5 ? 'model' : 'red'), width: 0.7, maxPx: 34, tooltip: (i) => [['y', String(LL_Y[i])], ['q(y = 1)', f3(q1[i])], ['−log₂ q(y)', f3(sur[i])]] },
        { type: 'hline', y: 1, color: 'muted', dash: '4 4', width: 1.4, label: '1 бит = прогноз ½' },
        { type: 'hline', y: mean, color: 'tree', width: 2, label: 'среднее = log-loss' },
      ], { y: [0, Math.max(3, ...sur) * 1.12] });
      st.set('ll', f4(mean * Math.LN2));
      st.set('bits', f4(mean));
      st.set('acc', pct(qy.filter((q) => q > 0.5).length / 12, 0));
      st.set('worst', pct(Math.max(...sur) / U.sum(sur), 0));
      st.set('pp', f3(Math.exp(mean * Math.LN2)));
      note.innerHTML = 'Log-loss — это <b>перекрёстная энтропия</b> между ответами и прогнозами: H(данные, модель) = (1/n) Σ −ln q(yᵢ). Модель «платит» неожиданностью за каждый ответ. При T = 0 все прогнозы ½ — ровно 1 бит (ln 2 = 0.693 ната) на объект. Рост уверенности сначала помогает (правильные столбцы тают), потом вредит: ошибки становятся очень дорогими. Одна грубая ошибка с q = σ(−6) = 0.0025 стоит 8.66 бита — больше, чем все остальные объекты вместе. Обрезка ε (в sklearn ε ≈ 2.2·10⁻¹⁶, в LightGBM прогнозы не обрезаются, но логиты конечны) ограничивает штраф: −log₂ ε.';
    }
    w.pythonAction(() => PY_NP + `from sklearn.metrics import log_loss

y = np.array(${JSON.stringify(LL_Y)})
F = np.array(${JSON.stringify(s.blunder ? LL_F.slice(0, 11).concat([6]) : LL_F)})
T, eps = ${py(s.T)}, ${py(s.eps)}
q = np.clip(1 / (1 + np.exp(-T * F)), eps, 1 - eps)
surprise = -np.log2(np.where(y == 1, q, 1 - q))
print("неожиданности, бит:", surprise.round(3))
print(f"log-loss = {surprise.mean() * np.log(2):.4f} нат = {surprise.mean():.4f} бит; sklearn: {log_loss(y, q):.4f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 29. Разложение: log-loss = H(Y | X) + KL
   * ============================================================================== */
  const DEC_N = 2000;
  function decomp(a, s0, b, c) {
    let mp = 0;
    let hx = 0;
    let ce = 0;
    for (let i = 0; i < DEC_N; i++) {
      const x = (i + 0.5) / DEC_N;
      const p = sig(a * (x - 0.5) + s0);
      const q = sig(b * (x - 0.5) + c);
      mp += p / DEC_N;
      hx += hbin(p) / DEC_N;
      ce += (-(p * lg(q)) - (1 - p) * lg(1 - q)) / DEC_N;
    }
    return { HY: hbin(mp), HYX: hx, CE: ce, KL: ce - hx, I: hbin(mp) - hx, mp };
  }
  GBC.widget('logloss-decomp', (el) => {
    const s = { a: 10, s0: -0.8, b: 5, c: -0.3 };
    const w = ui.shell(el, { title: 'Из чего складывается log-loss', sub: 'Признак x равномерен на [0, 1]; истинная вероятность класса 1 — p(x) = σ(a(x − ½) + s) (пунктир). Модель выдаёт q(x) = σ(b(x − ½) + c). Ожидаемый log-loss = H(Y | X) + E KL(p(x) ‖ q(x)): неустранимая часть плюс ошибка модели.' });
    ui.slider(w.controls, { label: 'Истина: крутизна a', min: 0, max: 30, step: 0.5, value: s.a, format: f1, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'Истина: сдвиг s', min: -3, max: 3, step: 0.1, value: s.s0, format: f1, onInput: (v) => ((s.s0 = v), draw()) });
    const bS = ui.slider(w.controls, { label: 'Модель: крутизна b', min: 0, max: 40, step: 0.5, value: s.b, format: f1, onInput: (v) => ((s.b = v), draw()) });
    const cS = ui.slider(w.controls, { label: 'Модель: сдвиг c', min: -4, max: 4, step: 0.05, value: s.c, format: f2, onInput: (v) => ((s.c = v), draw()) });
    const set = (b, c) => ((s.b = b), (s.c = c), bS.set(b), cS.set(c), draw());
    ui.button(w.controls, { label: 'Константа F₀', onClick: () => set(0, logit(decomp(s.a, s.s0, 0, 0).mp)) });
    ui.button(w.controls, { label: 'Идеальная q = p', onClick: () => set(s.a, s.s0) });
    ui.button(w.controls, { label: 'Самоуверенная (b = 2a)', onClick: () => set(Math.min(40, 2 * s.a), s.s0) });
    ui.button(w.controls, { label: 'Робкая (b = a/2)', onClick: () => set(s.a / 2, s.s0) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'x', domain: [0, 1] }, y: { label: 'P(y = 1 | x)', domain: [0, 1] } });
    const p2 = new GBC.Plot(w.main, { height: 170, x: { label: 'бит на объект', domain: [0, 1.1] }, y: { label: '', domain: [-0.6, 2.6], ticks: [0, 1, 2], format: (v) => ['модель', 'предел H(Y|X)', 'константа H(Y)'][v] || '' }, margin: { left: 110 } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'HY', label: 'H(Y) — константа' }, { key: 'HYX', label: 'H(Y | X) — предел' }, { key: 'CE', label: 'log-loss модели' }, { key: 'KL', label: 'KL — ошибка модели' }, { key: 'got', label: 'извлечено из I(X; Y)' }]);
    function draw() {
      const r = decomp(s.a, s.s0, s.b, s.c);
      const xs = U.linspace(0, 1, 301);
      p1.render([
        { type: 'line', x: xs, y: xs.map((x) => sig(s.a * (x - 0.5) + s.s0)), color: 'truth', width: 2, dash: '6 4', label: 'истинная p(x)' },
        { type: 'line', x: xs, y: xs.map((x) => sig(s.b * (x - 0.5) + s.c)), color: 'model', width: 2.4, label: 'модель q(x)' },
      ]);
      const op = 0.8;
      p2.render([
        { type: 'rect', x0: 0, x1: r.HY, y0: 1.7, y1: 2.3, fill: 'muted', color: 'muted', opacity: op },
        { type: 'rect', x0: 0, x1: r.HYX, y0: 0.7, y1: 1.3, fill: 'ink2', color: 'ink2', opacity: 0.5, label: 'H(Y | X) — неустранимо' },
        { type: 'rect', x0: 0, x1: r.HYX, y0: -0.3, y1: 0.3, fill: 'ink2', opacity: 0.5 },
        { type: 'rect', x0: r.HYX, x1: r.CE, y0: -0.3, y1: 0.3, fill: 'red', color: 'red', opacity: op, label: 'KL — ошибка модели' },
        { type: 'vline', x: r.HY, color: 'muted', dash: '3 3', width: 1 },
      ], { x: [0, Math.max(1.05, r.CE * 1.05)] });
      st.set('HY', f3(r.HY));
      st.set('HYX', f3(r.HYX));
      st.set('CE', f3(r.CE));
      st.set('KL', f3(r.KL));
      st.set('got', r.I > 1e-9 ? f3(r.HY - r.CE) + ' из ' + f3(r.I) : '—');
      note.innerHTML = 'Три уровня. <b>H(Y)</b> — log-loss лучшей константы (стартовый прогноз бустинга F₀ = логарифм шансов доли): модель, которая не смотрит на x. <b>H(Y | X)</b> — log-loss идеальной модели q = p: нижний предел, ниже которого на новых данных не опуститься. Разность H(Y) − H(Y | X) = <b>I(X; Y)</b> — сколько бит о классе вообще есть в признаке. Обучение бустинга — это движение от H(Y) к H(Y | X); остаток над пределом — KL. Самоуверенная и робкая модели обе платят KL, хотя классифицируют одинаково (порог тот же): log-loss штрафует <b>калибровку</b>, а не только порядок объектов. Если модель хуже константы, «извлечено» отрицательно.';
    }
    w.pythonAction(() => PY_NP + `
sig = lambda z: 1 / (1 + np.exp(-z))
h = lambda p: -p * np.log2(p) - (1 - p) * np.log2(1 - p)
a, s, b, c = ${py(s.a)}, ${py(s.s0)}, ${py(s.b)}, ${py(s.c)}
x = (np.arange(${DEC_N}) + 0.5) / ${DEC_N}
p, q = sig(a * (x - 0.5) + s), sig(b * (x - 0.5) + c)
HY, HYX = h(p.mean()), h(p).mean()
CE = np.mean(-p * np.log2(q) - (1 - p) * np.log2(1 - q))
print(f"H(Y) = {HY:.3f}, H(Y|X) = {HYX:.3f}, log-loss = {CE:.3f}, KL = {CE - HYX:.3f}, I(X;Y) = {HY - HYX:.3f} бит")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 30. Бустинг шаг за шагом снижает перекрёстную энтропию
   * ============================================================================== */
  const BB_P = (x) => sig(4 * Math.sin(3 * Math.PI * x));
  function bbData(n, seed) {
    const rng = new GBC.RNG(seed);
    const X = [];
    const y = [];
    for (let i = 0; i < n; i++) {
      const x = rng.random();
      X.push([x]);
      y.push(rng.random() < BB_P(x) ? 1 : 0);
    }
    return { X, y };
  }
  const BB_FLOOR = (() => {
    let mp = 0;
    let eh = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const p = BB_P((i + 0.5) / N);
      mp += p / N;
      eh += hbin(p) / N;
    }
    return { HY: hbin(mp), HYX: eh };
  })();
  GBC.widget('boost-bits', (el) => {
    const s = { n: 300, lr: 0.1, depth: 3, m: 60 };
    const M = 300;
    const w = ui.shell(el, { title: 'Бустинг снижает перекрёстную энтропию — до предела и ниже', sub: 'Класс y = 1 с вероятностью p(x) = σ(4 sin 3πx). Градиентный бустинг с log-loss обучается на n точках (зерно 7) и проверяется на 2000 новых. Нижний график — log-loss в битах: старт H(Y) (константа F₀), предел H(Y | X) (истинная p). Обучающая кривая может уйти ниже предела — это запоминание шума.' });
    ui.slider(w.controls, { label: 'Обучающих объектов n', values: [100, 200, 300, 500, 1000], value: s.n, format: String, onInput: (v) => ((s.n = v), fit()) });
    ui.segmented(w.controls, { label: 'Темп ν', value: s.lr, options: [0.03, 0.1, 0.3, 1].map((v) => ({ value: v, label: String(v) })), onChange: (v) => ((s.lr = v), fit()) });
    ui.segmented(w.controls, { label: 'Глубина', value: s.depth, options: [1, 2, 3, 5].map((v) => ({ value: v, label: String(v) })), onChange: (v) => ((s.depth = v), fit()) });
    const pl = ui.player(w.controls, { label: 'Деревьев m', min: 0, max: M, value: s.m, fps: 12, format: (k) => 'm = ' + k, onChange: (k) => ((s.m = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x', domain: [0, 1] }, y: { label: 'P(y = 1 | x)', domain: [-0.08, 1.08] } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'число деревьев m', domain: [0, M] }, y: { label: 'log-loss, бит на объект', domain: [0, 1.05] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'tr', label: 'обучение' }, { key: 'va', label: 'новые данные' }, { key: 'fl', label: 'предел H(Y | X)' }, { key: 'kl', label: '≈ KL = новые − предел' }, { key: 'best', label: 'лучшее m' }]);
    let model = null;
    let D = null;
    let V = null;
    function fit() {
      D = bbData(s.n, 7);
      V = V || bbData(2000, 1007);
      model = new GBC.GradientBoosting({ loss: 'logistic', nEstimators: M, learningRate: s.lr, maxDepth: s.depth, seed: 0 }).fit(D.X, D.y, { evalSet: [V.X, V.y] });
      draw();
    }
    function draw() {
      if (!model) return;
      const xs = U.linspace(0, 1, 301);
      const jit = (i) => ((i * 7919) % 97) / 97 * 0.06 - 0.03;
      p1.render([
        { type: 'points', x: D.X.map((r) => r[0]), y: D.y.map((v, i) => v + jit(i)), color: (i) => (D.y[i] ? 'class1' : 'class0'), r: 3.5, opacity: 0.55 },
        { type: 'line', x: xs, y: xs.map(BB_P), color: 'truth', width: 2, dash: '6 4', label: 'истинная p(x)' },
        { type: 'line', x: xs, y: xs.map((x) => sig(model.predictRawOne([x], s.m))), color: 'model', width: 2.4, label: 'модель, m деревьев' },
      ]);
      const tr = model.history.train.map((v) => v / Math.LN2);
      const va = model.history.eval.map((v) => v / Math.LN2);
      const ms = U.range(M + 1);
      const best = va.indexOf(Math.min(...va));
      p2.render([
        { type: 'hline', y: BB_FLOOR.HY, color: 'muted', dash: '6 4', width: 1.5, text: 'H(Y) — константа' },
        { type: 'hline', y: BB_FLOOR.HYX, color: 'ink', dash: '3 3', width: 1.5, text: 'H(Y|X) — предел' },
        { type: 'line', x: ms, y: tr, color: 'train', width: 2, label: 'обучение' },
        { type: 'line', x: ms, y: va, color: 'valid', width: 2, label: 'новые данные' },
        { type: 'points', x: [best], y: [va[best]], color: 'valid', r: 5 },
        { type: 'vline', x: s.m, color: 'ink2', width: 1, dash: '2 3' },
      ], { y: [0, Math.max(1.02, BB_FLOOR.HY * 1.05)] });
      st.set('tr', f3(tr[s.m]));
      st.set('va', f3(va[s.m]));
      st.set('fl', f3(BB_FLOOR.HYX));
      st.set('kl', U.fmtSigned(va[s.m] - BB_FLOOR.HYX, 3));
      st.set('best', best + ' (' + f3(va[best]) + ')');
      note.innerHTML = 'Константа F₀ = логарифм шансов доли единиц: log-loss ≈ H(Y) = ' + f3(BB_FLOOR.HY) + ' бита. Истинная p(x) даёт предел H(Y | X) = ' + f3(BB_FLOOR.HYX) + ': I(X; Y) = ' + f3(BB_FLOOR.HY - BB_FLOOR.HYX) + ' бита — всё, что признак знает о классе. Каждое дерево добавляет к логитам шаг против градиента перекрёстной энтропии; разрыв «новые данные − предел» — оценка KL между истиной и моделью (на 2000 объектах её погрешность около ±0.02 бита). Когда обучающая кривая опускается <b>ниже предела</b>, модель описывает не закономерность, а конкретный шум выборки — и KL на новых данных начинает расти. Лучшее m — где «новые данные» ближе всего к пределу: ранняя остановка (урок 7.1).';
    }
    w.pythonAction(() => PY_NP + PY_RNG + `from gbcourse.boosting import GradientBoosting

sig = lambda z: 1 / (1 + np.exp(-z))
p_true = lambda x: sig(4 * np.sin(3 * np.pi * x))
def data(n, seed):
    rng, X, y = Mulberry32(seed), [], []
    for _ in range(n):
        x = rng.random(); X.append([x]); y.append(1 if rng.random() < p_true(x) else 0)
    return np.array(X), np.array(y)

X, y = data(${s.n}, 7)
Xv, yv = data(2000, 1007)
gb = GradientBoosting(loss="logistic", n_estimators=${M}, learning_rate=${py(s.lr)}, max_depth=${s.depth}).fit(X, y, eval_set=(Xv, yv))
tr, va = np.array(gb.history_["train"]) / np.log(2), np.array(gb.history_["eval"]) / np.log(2)
h = lambda p: -p * np.log2(p) - (1 - p) * np.log2(1 - p)
g = (np.arange(20000) + 0.5) / 20000
print(f"H(Y) = {h(p_true(g).mean()):.3f}, предел H(Y|X) = {h(p_true(g)).mean():.3f} бит")
m = ${s.m}
print(f"m = {m}: обучение {tr[m]:.3f}, новые данные {va[m]:.3f}; лучшее m = {va.argmin()} ({va.min():.3f})")
`);
    fit();
  });

  /* ==============================================================================
   * Шаг 31. Многоклассовая перекрёстная энтропия, softmax, сглаживание меток
   * ============================================================================== */
  GBC.widget('softmax-ce', (el) => {
    const s = { K: 3, z: [2, 0.5, -1, 0, 0, 0], y: 0, eps: 0, T: 1 };
    const w = ui.shell(el, { title: 'Softmax и перекрёстная энтропия для K классов', sub: 'Модель выдаёт логиты z₁, …, zₖ (по одному на класс), softmax превращает их в вероятности q = softmax(z/T). Цель t — «единица на правильном классе» или, со сглаживанием меток ε, (1 − ε) на правильном и ε/K на каждом. Потери — H(t, q) = H(t) + KL(t ‖ q).' });
    const kS = ui.slider(w.controls, { label: 'Классов K', min: 2, max: 6, step: 1, value: s.K, format: String, onInput: (v) => ((s.K = v), (s.y = Math.min(s.y, v - 1)), yS.set(s.y + 1), draw()) });
    const yS = ui.slider(w.controls, { label: 'Правильный класс', min: 1, max: 6, step: 1, value: s.y + 1, format: String, onInput: (v) => ((s.y = Math.min(v, s.K) - 1), draw()) });
    const zs = U.range(6).map((i) => ui.slider(w.controls, { label: 'логит z' + (i + 1), min: -5, max: 5, step: 0.1, value: s.z[i], format: f1, onInput: (v) => ((s.z[i] = v), draw()) }));
    ui.slider(w.controls, { label: 'Температура T', min: 0.25, max: 4, step: 0.05, value: s.T, format: f2, onInput: (v) => ((s.T = v), draw()) });
    ui.slider(w.controls, { label: 'Сглаживание меток ε', min: 0, max: 0.3, step: 0.01, value: s.eps, format: f2, onInput: (v) => ((s.eps = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'класс', domain: [0.4, 6.6], ticks: U.range(6, 1) }, y: { label: 'вероятность', domain: [0, 1.05] } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ce', label: 'H(t, q), бит' }, { key: 'nat', label: 'то же, нат' }, { key: 'Ht', label: 'H(t)' }, { key: 'kl', label: 'KL(t ‖ q)' }, { key: 'base', label: 'log₂ K (равные q)' }]);
    function draw() {
      void kS;
      zs.forEach((x, i) => (x.el.hidden = i >= s.K));
      const z = s.z.slice(0, s.K).map((v) => v / s.T);
      const mx = Math.max(...z);
      const q = normalize(z.map((v) => Math.exp(v - mx)));
      const t = U.range(s.K).map((i) => (i === s.y ? 1 - s.eps : 0) + s.eps / s.K);
      const ce = L0.ceb(t, q);
      const xs = U.range(s.K, 1);
      plot.render([
        { type: 'bars', x: xs.map((x) => x - 0.17), y: t, width: 0.3, maxPx: 30, color: 'muted', label: 'цель t' },
        { type: 'bars', x: xs.map((x) => x + 0.17), y: q, width: 0.3, maxPx: 30, color: 'model', label: 'прогноз q', tooltip: (i) => [['q', f4(q[i])]] },
      ], { x: [0.4, s.K + 0.6] });
      rowTable(tbl, ['класс', 'q', 't', 'градиент по z: (q − t)/T'], xs.map((k, i) => [String(k) + (i === s.y ? ' ✓' : ''), f3(q[i]), f3(t[i]), U.fmtSigned((q[i] - t[i]) / s.T, 3)]), (i) => i === s.y);
      st.set('ce', f3(ce));
      st.set('nat', f3(ce * Math.LN2));
      st.set('Ht', f3(Hb(t)));
      st.set('kl', f3(ce - Hb(t)));
      st.set('base', f3(lg(s.K)));
      note.innerHTML = 'Без сглаживания H(t) = 0, и потери — просто −log₂ q(правильного): неожиданность правильного класса. Модель с равными вероятностями платит log₂ K (3 класса — 1.585 бита). Градиент по логитам — (q − t)/T: именно эти «псевдоостатки» учат деревья многоклассового бустинга (урок 6.3). <b>Сглаживание меток</b> делает целью не «1», а 1 − ε + ε/K: минимум потерь достигается при q = t, поэтому модели больше не выгодно разгонять логиты до бесконечности — это регуляризация уверенности. Температура T &gt; 1 «размягчает» прогноз, T &lt; 1 делает его резче (калибровка температурой).';
    }
    w.pythonAction(() => PY_NP + `from scipy.special import softmax

z = np.array(${JSON.stringify(s.z.slice(0, s.K))}); T, eps, y = ${py(s.T)}, ${py(s.eps)}, ${s.y}
q = softmax(z / T)
t = np.full(len(z), eps / len(z)); t[y] += 1 - eps
CE = -(t * np.log2(q)).sum(); Ht = -(t[t > 0] * np.log2(t[t > 0])).sum()
print(f"q = {q.round(3)}; H(t,q) = {CE:.3f} бит, H(t) = {Ht:.3f}, KL = {CE - Ht:.3f}; градиент (q − t)/T = {((q - t) / T).round(3)}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 32. Прирост информации = снижение log-loss разбиения
   * ============================================================================== */
  const SPLIT_P = (x) => (x < 3 ? 0.15 : x < 6.5 ? 0.75 : 0.3);
  function splitData(seed) {
    const rng = new GBC.RNG(seed);
    const pts = [];
    for (let i = 0; i < 40; i++) {
      const x = rng.uniform(0, 10);
      pts.push({ x, y: rng.random() < SPLIT_P(x) ? 1 : 0 });
    }
    pts.sort((a, b) => a.x - b.x);
    return pts;
  }
  function splitScores(pts, t) {
    const n = pts.length;
    const L = pts.filter((p) => p.x <= t);
    const R = pts.filter((p) => p.x > t);
    const k = (arr) => arr.filter((p) => p.y).length;
    const nL = L.length;
    const nR = R.length;
    const kL = k(L);
    const kR = k(R);
    const K = kL + kR;
    const hh = (a, m) => (m ? hbin(a / m) : 0);
    const gini = (a, m) => (m ? 2 * (a / m) * (1 - a / m) : 0);
    const IG = hh(K, n) - (nL / n) * hh(kL, nL) - (nR / n) * hh(kR, nR);
    const G = gini(K, n) - (nL / n) * gini(kL, nL) - (nR / n) * gini(kR, nR);
    // точное снижение log-loss (наты, сумма) при листьях-частотах и шаг Ньютона из F₀
    const ll = (a, m) => (m ? m * hh(a, m) * Math.LN2 : 0);
    const dLL = ll(K, n) - ll(kL, nL) - ll(kR, nR);
    const p0 = K / n;
    const hs = p0 * (1 - p0);
    const g = (a, m) => m * p0 - a;
    const newton = nL && nR && hs > 0 ? 0.5 * ((g(kL, nL) ** 2) / (nL * hs) + (g(kR, nR) ** 2) / (nR * hs)) : 0;
    return { IG, G, dLL, newton, nL, nR, kL, kR };
  }
  GBC.widget('split-scan', (el) => {
    const s = { t: 3.1, seed: 6 };
    const w = ui.shell(el, { title: 'Прирост информации, log-loss и Джини при выборе порога', sub: '40 объектов, класс 1 с вероятностью 0.15 (x < 3), 0.75 (3 ≤ x < 6.5), 0.3 (x ≥ 6.5). Дерево глубины 1 разбивает по порогу x ≤ t; в листьях прогноз — доля единиц. Средний график: прирост информации и снижение log-loss (на объект, в битах) — кривые совпадают точно; выигрыш Ньютона (как в XGBoost) — приближение.' });
    const tS = ui.slider(w.controls, { label: 'Порог t', min: 0, max: 10, step: 0.05, value: s.t, format: f2, onInput: (v) => ((s.t = v), draw()) });
    ui.button(w.controls, { label: 'Новая выборка', icon: 'reset', onClick: () => (s.seed++, draw()) });
    ui.button(w.controls, { label: 'Выборка, где критерии спорят', onClick: () => ((s.seed = 53), (s.t = 1.6), tS.set(s.t), draw()) });
    ui.button(w.controls, { label: 'К лучшему по энтропии', onClick: () => ((s.t = bestT('IG')), tS.set(s.t), draw()) });
    ui.button(w.controls, { label: 'К лучшему по Джини', onClick: () => ((s.t = bestT('G')), tS.set(s.t), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 170, x: { label: 'x', domain: [0, 10] }, y: { label: 'класс', domain: [-0.3, 1.3], ticks: [0, 1] } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'порог t', domain: [0, 10] }, y: { label: 'бит на объект', domain: [0, 0.25] } });
    const p3 = new GBC.Plot(w.main, { height: 160, x: { label: 'порог t', domain: [0, 10] }, y: { label: 'снижение Джини', domain: [0, 0.15] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ig', label: 'прирост информации' }, { key: 'll', label: 'Δ log-loss / n, бит' }, { key: 'nw', label: 'Ньютон / n, бит' }, { key: 'g', label: 'снижение Джини' }, { key: 'best', label: 'лучший t: энтропия / Джини' }]);
    let pts = null;
    let cands = [];
    function bestT(key) {
      let best = cands[0];
      let bv = -1;
      for (const t of cands) {
        const v = splitScores(pts, t)[key];
        if (v > bv + 1e-12) (bv = v), (best = t);
      }
      return Math.round(best * 100) / 100;
    }
    function draw() {
      pts = splitData(s.seed);
      cands = [];
      for (let i = 0; i + 1 < pts.length; i++) if (pts[i + 1].x > pts[i].x) cands.push((pts[i].x + pts[i + 1].x) / 2);
      const grid = U.linspace(0, 10, 401);
      const sc = grid.map((t) => splitScores(pts, t));
      const n = pts.length;
      const r = splitScores(pts, s.t);
      p1.render([
        { type: 'points', x: pts.map((p) => p.x), y: pts.map((p) => p.y), color: (i) => (pts[i].y ? 'class1' : 'class0'), r: 5 },
        { type: 'vline', x: s.t, color: 'tree', width: 2.5 },
        { type: 'text', items: [{ x: Math.max(0.2, s.t - 0.2), y: 1.18, anchor: 'end', text: r.kL + ' из ' + r.nL }, { x: Math.min(9.8, s.t + 0.2), y: 1.18, anchor: 'start', text: r.kR + ' из ' + r.nR }] },
      ]);
      const top = Math.max(0.05, ...sc.map((v) => v.IG)) * 1.2;
      p2.render([
        { type: 'line', x: grid, y: sc.map((v) => v.IG), color: 'model', width: 3, label: 'прирост информации' },
        { type: 'line', x: grid, y: sc.map((v) => v.dLL / n / Math.LN2), color: 'tree', width: 1.6, dash: '6 4', label: 'Δ log-loss / n' },
        { type: 'line', x: grid, y: sc.map((v) => v.newton / n / Math.LN2), color: 'aqua', width: 1.8, label: 'Ньютон (½ΣG²/H) / n' },
        { type: 'vline', x: s.t, color: 'ink2', width: 1, dash: '3 3' },
      ], { y: [0, top] });
      p3.render([
        { type: 'line', x: grid, y: sc.map((v) => v.G), color: 'violet', width: 2.2, label: 'снижение Джини' },
        { type: 'vline', x: s.t, color: 'ink2', width: 1, dash: '3 3' },
      ], { y: [0, Math.max(0.03, ...sc.map((v) => v.G)) * 1.2] });
      st.set('ig', f4(r.IG));
      st.set('ll', f4(r.dLL / n / Math.LN2));
      st.set('nw', f4(r.newton / n / Math.LN2));
      st.set('g', f4(r.G));
      const bi = bestT('IG');
      const bg = bestT('G');
      st.set('best', f2(bi) + ' / ' + f2(bg));
      note.innerHTML = 'Почему синяя и пунктирная кривые совпадают: если лист предсказывает долю единиц f, его суммарный log-loss равен n_лист · h(f) (в натах — с ln). Значит, log-loss дерева = n · (взвешенная энтропия листьев), а снижение log-loss = n · (прирост информации). <b>Критерий энтропии — это жадная минимизация log-loss на обучении.</b> Джини так же связан с квадратичной ошибкой вероятностей (Brier). А выигрыш Ньютона ½ΣG²/H, которым бустинг выбирает разбиения, — квадратичное приближение снижения log-loss; на первом дереве (старт с F₀ = логарифм шансов доли) он <b>в точности пропорционален снижению Джини</b>: n·ΔДжини / (4p₀(1 − p₀)). Поэтому бирюзовая кривая повторяет форму нижней. ' + (Math.abs(bi - bg) > 1e-9 ? '<b>Здесь критерии спорят</b>: энтропия выбирает t = ' + f2(bi) + ', Джини и Ньютон — t = ' + f2(bg) + '. Энтропия охотнее отрезает маленький «чистый» кусок: её штраф за смешанность растёт быстрее у краёв.' : 'Обычно все критерии выбирают один и тот же порог (здесь t = ' + f2(bi) + '); кнопка «Выборка, где критерии спорят» покажет исключение.');
    }
    w.pythonAction(() => PY_NP + PY_RNG + `from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import log_loss

rng = Mulberry32(${s.seed}); pts = []
for _ in range(40):
    x = rng.uniform(0, 10); p = 0.15 if x < 3 else 0.75 if x < 6.5 else 0.3
    pts.append((x, 1 if rng.random() < p else 0))
x, y = np.array(sorted(pts)).T; y = y.astype(int)
h = lambda f: 0.0 if f in (0, 1) else -f * np.log2(f) - (1 - f) * np.log2(1 - f)
def ig(t):
    L, R = y[x <= t], y[x > t]
    return h(y.mean()) - len(L) / len(y) * h(L.mean() if len(L) else 0) - len(R) / len(y) * h(R.mean() if len(R) else 0)
t = ${py(s.t)}
pred = np.where(x <= t, y[x <= t].mean() if (x <= t).any() else 0.5, y[x > t].mean() if (x > t).any() else 0.5)
dll = log_loss(y, np.full(len(y), y.mean())) - log_loss(y, np.clip(pred, 1e-15, 1 - 1e-15))
print(f"t = {t}: прирост информации {ig(t):.4f} бит = снижение log-loss {dll / np.log(2):.4f} бит/объект")
tree = DecisionTreeClassifier(criterion="entropy", max_depth=1).fit(x[:, None], y)
print("порог sklearn (entropy):", round(tree.tree_.threshold[0], 3))
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 33. Ловушка признаков с множеством значений: прирост информации и gain ratio
   * ============================================================================== */
  const MV_K = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1000];
  function mvSims(n, R) {
    const out = {};
    const rng = new GBC.RNG(33 + n);
    const res = MV_K.filter((k) => k <= n).map((k) => ({ k, ig: [], gr: [], igI: [], grI: [] }));
    for (let r = 0; r < R; r++) {
      const xi = [];
      const y = [];
      for (let i = 0; i < n; i++) {
        const a = rng.random() < 0.5 ? 1 : 0;
        xi.push(a);
        y.push(rng.random() < 0.7 ? a : 1 - a);
      }
      const HY = hbin(U.mean(y));
      const gainOf = (cat, K) => {
        const cnt = new Array(K).fill(0);
        const ones = new Array(K).fill(0);
        cat.forEach((c, i) => {
          cnt[c]++;
          ones[c] += y[i];
        });
        let hc = 0;
        let split = 0;
        for (let c = 0; c < K; c++) if (cnt[c]) {
          hc += (cnt[c] / n) * hbin(ones[c] / cnt[c]);
          split -= (cnt[c] / n) * lg(cnt[c] / n);
        }
        const ig = HY - hc;
        return { ig, gr: split > 0 ? ig / split : 0 };
      };
      const inf = gainOf(xi, 2);
      for (const R0 of res) {
        const cat = y.map(() => rng.randint(R0.k));
        const g = gainOf(cat, R0.k);
        R0.ig.push(g.ig);
        R0.gr.push(g.gr);
        R0.igI.push(inf.ig);
        R0.grI.push(inf.gr);
      }
    }
    for (const R0 of res) out[R0.k] = R0;
    return out;
  }
  GBC.widget('many-values', (el) => {
    const s = { n: 200, k: 64 };
    const R = 200;
    const w = ui.shell(el, { title: 'Признак-идентификатор «выигрывает» по приросту информации', sub: 'Класс y связан с полезным бинарным признаком: P(y = x) = 0.7. Шумовой категориальный признак с k случайными значениями никак с классом не связан. Считаем прирост информации на обучающей выборке из n объектов (200 повторов) — и gain ratio C4.5: прирост, делённый на энтропию самого разбиения.' });
    ui.slider(w.controls, { label: 'Объектов n', values: [50, 100, 200, 500, 1000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Значений у шумового признака k', values: MV_K, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'значений k (лог.)', type: 'log', domain: [1.5, 1200], ticks: [2, 8, 32, 128, 512] }, y: { label: 'прирост информации, бит', domain: [0, 1] } });
    const p2 = new GBC.Plot(w.main, { height: 210, x: { label: 'значений k (лог.)', type: 'log', domain: [1.5, 1200], ticks: [2, 8, 32, 128, 512] }, y: { label: 'gain ratio', domain: [0, 0.2] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ig', label: 'шум: прирост' }, { key: 'th', label: 'теория (k − 1)/(2n ln 2)' }, { key: 'igI', label: 'полезный: прирост' }, { key: 'win', label: 'шум побеждает (прирост)' }, { key: 'winGR', label: 'шум побеждает (gain ratio)' }]);
    const cache = {};
    function draw() {
      if (s.k > s.n) s.k = MV_K.filter((k) => k <= s.n).pop();
      const sims = cache[s.n] || (cache[s.n] = mvSims(s.n, R));
      const ks = MV_K.filter((k) => k <= s.n);
      const mIG = ks.map((k) => U.mean(sims[k].ig));
      const mGR = ks.map((k) => U.mean(sims[k].gr));
      const igI = U.mean(sims[ks[0]].igI);
      const grI = U.mean(sims[ks[0]].grI);
      const th = ks.map((k) => ((k - 1) / (2 * s.n * Math.LN2) < 1.05 ? (k - 1) / (2 * s.n * Math.LN2) : NaN));
      const kk = sims[s.k] ? s.k : ks[ks.length - 1];
      p1.render([
        { type: 'hline', y: igI, color: 'tree', width: 2, dash: '6 4', label: 'полезный признак' },
        { type: 'line', x: ks, y: th, color: 'muted', width: 1.4, dash: '3 3', label: 'теория смещения' },
        { type: 'line', x: ks, y: mIG, color: 'model', width: 2.2, label: 'шумовой признак' },
        { type: 'points', x: ks, y: mIG, color: 'model', r: 4 },
        { type: 'points', x: [kk], y: [U.mean(sims[kk].ig)], color: 'model', r: 7 },
      ], { x: [1.5, Math.max(12, s.n * 1.2)], y: [0, Math.max(0.25, ...mIG, igI) * 1.12] });
      p2.render([
        { type: 'hline', y: grI, color: 'tree', width: 2, dash: '6 4', label: 'полезный признак' },
        { type: 'line', x: ks, y: mGR, color: 'model', width: 2.2, label: 'шумовой признак' },
        { type: 'points', x: ks, y: mGR, color: 'model', r: 4 },
      ], { x: [1.5, Math.max(12, s.n * 1.2)], y: [0, Math.max(0.15, ...mGR, grI) * 1.15] });
      const S0 = sims[kk];
      st.set('ig', f3(U.mean(S0.ig)));
      st.set('th', f3((kk - 1) / (2 * s.n * Math.LN2)));
      st.set('igI', f3(igI));
      st.set('win', pct(S0.ig.filter((v, i) => v > S0.igI[i]).length / R, 1));
      st.set('winGR', pct(S0.gr.filter((v, i) => v > S0.grI[i]).length / R, 1));
      note.innerHTML = 'Истинная взаимная информация шумового признака — 0, а у полезного 1 − h(0.7) = 0.119 бита. Но оценка по выборке смещена вверх примерно на (k − 1)/(2n ln 2): каждое значение-категория «подстраивается» под свои немногие объекты. При k = n (идентификатор объекта) прирост равен всей H(Y) ≈ 1 бит — признак «идеально» делит выборку и ничего не значит. Gain ratio (C4.5) делит прирост на энтропию разбиения log₂ k и наказывает за множество значений. В бустинге та же беда у категорий с большим числом значений: поэтому их кодируют с упорядоченной статистикой (CatBoost) или со сглаживанием и кросс-валидацией (урок 10.1), а смещение важности по выигрышу проверяют перестановками (урок 12.1).';
    }
    w.pythonAction(() => PY_NP + PY_RNG + `
n, k, R = ${s.n}, ${s.k}, ${R}
KS = [K for K in ${JSON.stringify(MV_K)} if K <= n]      # страница считает все k сразу — тот же порядок вызовов ГПСЧ
h = lambda f: np.where((f > 0) & (f < 1), -f * np.log2(np.clip(f, 1e-12, 1)) - (1 - f) * np.log2(np.clip(1 - f, 1e-12, 1)), 0.0)
def gain(cat, y, K):
    cnt, ones = np.bincount(cat, minlength=K), np.bincount(cat, y, minlength=K)
    m = cnt > 0
    ig = h(y.mean()) - (cnt[m] / len(y) * h(ones[m] / cnt[m])).sum()
    split = -(cnt[m] / len(y) * np.log2(cnt[m] / len(y))).sum()
    return ig, ig / split
rng, res = Mulberry32(33 + n), []
for _ in range(R):
    x, y = [], []
    for _ in range(n):
        a = 1 if rng.random() < 0.5 else 0
        x.append(a); y.append(a if rng.random() < 0.7 else 1 - a)
    x, y = np.array(x), np.array(y)
    for K in KS:
        cat = np.array([rng.randint(K) for _ in range(n)])
        if K == k:
            res.append(gain(cat, y, K) + gain(x, y, 2))
res = np.array(res)
print(f"шум: прирост {res[:, 0].mean():.3f} (теория {(k - 1) / (2 * n * np.log(2)):.3f}), gain ratio {res[:, 1].mean():.3f}")
print(f"полезный: прирост {res[:, 2].mean():.3f}, gain ratio {res[:, 3].mean():.3f}")
print("шум побеждает по приросту:", (res[:, 0] > res[:, 2]).mean(), " по gain ratio:", (res[:, 1] > res[:, 3]).mean())
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 34. Неравенство Фано: сколько ошибок неизбежно
   * ============================================================================== */
  const fanoF = (e, K) => hbin(e) + (K > 2 ? e * lg(K - 1) : 0);
  function fanoMin(Hc, K) {
    const top = 1 - 1 / K;
    if (Hc >= fanoF(top, K) - 1e-12) return top;
    let a = 0;
    let b = top;
    for (let i = 0; i < 80; i++) {
      const m = (a + b) / 2;
      if (fanoF(m, K) < Hc) a = m;
      else b = m;
    }
    return (a + b) / 2;
  }
  GBC.widget('fano', (el) => {
    const s = { K: 2, H: 0.5 };
    const w = ui.shell(el, { title: 'Неравенство Фано: нижняя граница ошибки', sub: 'Если после наблюдения признаков X неопределённость класса остаётся H(Y | X), никакой классификатор не может ошибаться реже, чем позволяет неравенство h(Pₑ) + Pₑ log₂(K − 1) ≥ H(Y | X), где Pₑ — вероятность ошибки. Кривая — левая часть; где она пересекает уровень H(Y | X), там граница.' });
    const kS = ui.slider(w.controls, { label: 'Классов K', min: 2, max: 20, step: 1, value: s.K, format: String, onInput: (v) => ((s.K = v), hS.setMax(lg(v)), (s.H = Math.min(s.H, lg(v))), draw()) });
    const hS = ui.slider(w.controls, { label: 'H(Y | X), бит', min: 0, max: 1, step: 0.01, value: s.H, format: f2, onInput: (v) => ((s.H = v), draw()) });
    ui.button(w.controls, { label: 'Шум меток ε = 0.1 (K = 2)', onClick: () => ((s.K = 2), kS.set(2), hS.setMax(1), (s.H = hbin(0.1)), hS.set(s.H), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'вероятность ошибки P_e', domain: [0, 1] }, y: { label: 'бит', domain: [0, 1.1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pe', label: 'P_e не меньше' }, { key: 'acc', label: 'точность не больше' }, { key: 'H', label: 'H(Y | X)' }, { key: 'max', label: 'log₂ K' }]);
    function draw() {
      void kS;
      const top = 1 - 1 / s.K;
      const es = U.linspace(0, top, 301);
      const pe = fanoMin(s.H, s.K);
      plot.render([
        { type: 'vband', x0: pe, x1: top, color: 'tree', opacity: 0.1 },
        { type: 'line', x: es, y: es.map((e) => fanoF(e, s.K)), color: 'model', width: 2.2, label: 'h(P_e) + P_e log₂(K − 1)' },
        { type: 'hline', y: s.H, color: 'tree', dash: '6 4', width: 1.8, label: 'H(Y | X)' },
        { type: 'points', x: [pe], y: [s.H], color: 'tree', r: 7 },
      ], { x: [0, top * 1.02 + 0.01], y: [0, lg(s.K) * 1.08 + 0.02] });
      st.set('pe', pct(pe, 1));
      st.set('acc', pct(1 - pe, 1));
      st.set('H', f3(s.H));
      st.set('max', f3(lg(s.K)));
      note.innerHTML = 'Двоичный случай: P<sub>e</sub> ≥ h⁻¹(H(Y | X)). Если признаки оставляют полбита неопределённости, ошибка не меньше 11 %. Для шума меток ε граница точная: H(Y | X) = h(ε) и P<sub>e</sub> ≥ ε — лучше, чем угадывать «настоящий» класс, нельзя. Для K = 10 классов и 1 бита неопределённости — не меньше 13.5 %, для 2 бит — 33.9 %. Важно: граница использует истинную H(Y | X), а log-loss модели на новых данных — лишь её оценка сверху (log-loss ≥ H(Y | X)). Поэтому «по log-loss» доказать, что лучше нельзя, не получится — зато можно узнать, сколько ещё <em>возможно</em> выиграть.';
    }
    w.pythonAction(() => PY_NP + `from scipy.optimize import brentq

h = lambda e: 0.0 if e in (0, 1) else -e * np.log2(e) - (1 - e) * np.log2(1 - e)
K, H = ${s.K}, ${py(s.H)}
f = lambda e: h(e) + e * np.log2(K - 1) - H
top = 1 - 1 / K
pe = top if f(top) <= 0 else (0.0 if H <= 0 else brentq(f, 1e-12, top))
print(f"K = {K}, H(Y|X) = {H:.3f} бит → P_e ≥ {pe:.4f}, точность ≤ {1 - pe:.4f}")
`);
    draw();
  });

  /* ==============================================================================
   * Шаг 35. Минимальная длина описания: сложность модели в битах
   * ============================================================================== */
  const MDL_P = {
    step: { label: 'ступенька', f: (x) => (x < 0.4 ? 0.2 : 0.8) },
    smooth: { label: 'плавная', f: (x) => sig(8 * (x - 0.5)) },
    waves: { label: 'волны', f: (x) => 0.5 + 0.35 * Math.sin(4 * Math.PI * x) },
  };
  const MDL_KMAX = 64;
  function mdlData(n, key) {
    const rng = new GBC.RNG(3);
    const X = [];
    const y = [];
    for (let i = 0; i < n; i++) {
      const x = rng.random();
      X.push(x);
      y.push(rng.random() < MDL_P[key].f(x) ? 1 : 0);
    }
    return { X, y };
  }
  function mdlCurve(D, key) {
    const n = D.X.length;
    const f = MDL_P[key].f;
    const out = [];
    for (let k = 1; k <= MDL_KMAX; k++) {
      const cnt = new Array(k).fill(0);
      const ones = new Array(k).fill(0);
      D.X.forEach((x, i) => {
        const b = Math.min(k - 1, Math.floor(x * k));
        cnt[b]++;
        ones[b] += D.y[i];
      });
      let data = 0;
      for (let b = 0; b < k; b++) if (cnt[b]) data += cnt[b] * hbin(ones[b] / cnt[b]);
      const model = 0.5 * k * lg(n);
      // «тест»: ожидаемый log-loss на новых данных при сглаженных долях (n₁ + ½)/(n_b + 1), умноженный на n
      let test = 0;
      const G = 4000;
      for (let i = 0; i < G; i++) {
        const x = (i + 0.5) / G;
        const b = Math.min(k - 1, Math.floor(x * k));
        const q = (ones[b] + 0.5) / (cnt[b] + 1);
        const p = f(x);
        test += (-(p * lg(q)) - (1 - p) * lg(1 - q)) / G;
      }
      out.push({ k, data, model, total: data + model, test: test * n, fit: U.range(k).map((b) => (ones[b] + 0.5) / (cnt[b] + 1)) });
    }
    return out;
  }
  GBC.widget('mdl-bins', (el) => {
    const s = { key: 'step', n: 500, k: 8 };
    const w = ui.shell(el, { title: 'Минимальная длина описания: модель + данные в битах', sub: 'Модель — гистограмма из k равных корзин на [0, 1] с долей единиц в каждой. Длина описания = биты на ответы при этой модели (n·энтропия по корзинам) + биты на саму модель (½ log₂ n на каждый параметр). Минимум суммы — выбор сложности «по Оккаму»; пунктир — log-loss на новых данных (×n).' });
    ui.segmented(w.controls, { label: 'Истинная p(x)', value: s.key, options: Object.keys(MDL_P).map((k) => ({ value: k, label: MDL_P[k].label })), onChange: (v) => ((s.key = v), draw()) });
    ui.slider(w.controls, { label: 'Объектов n', values: [50, 100, 200, 500, 1000, 2000, 5000], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Корзин k', min: 1, max: MDL_KMAX, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 220, x: { label: 'x', domain: [0, 1] }, y: { label: 'P(y = 1 | x)', domain: [-0.08, 1.08] } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'корзин k', domain: [1, MDL_KMAX] }, y: { label: 'бит (всего на n объектов)', domain: [0, 600] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'data', label: 'данные при модели' }, { key: 'model', label: 'модель' }, { key: 'tot', label: 'сумма' }, { key: 'bm', label: 'лучшее k: MDL' }, { key: 'bt', label: 'лучшее k: новые данные' }]);
    const cache = {};
    function draw() {
      const key = s.key + s.n;
      if (!cache[key]) {
        const D = mdlData(s.n, s.key);
        cache[key] = { D, C: mdlCurve(D, s.key) };
      }
      const { D, C } = cache[key];
      const cur = C[s.k - 1];
      const ks = C.map((c) => c.k);
      const bm = C.reduce((a, c) => (c.total < a.total ? c : a));
      const bt = C.reduce((a, c) => (c.test < a.test ? c : a));
      const xs = U.linspace(0, 1, 301);
      const jit = (i) => ((i * 7919) % 97) / 97 * 0.06 - 0.03;
      p1.render([
        { type: 'points', x: D.X.slice(0, 600), y: D.y.slice(0, 600).map((v, i) => v + jit(i)), color: (i) => (D.y[i] ? 'class1' : 'class0'), r: 3, opacity: 0.45 },
        { type: 'line', x: xs, y: xs.map(MDL_P[s.key].f), color: 'truth', width: 2, dash: '6 4', label: 'истинная p(x)' },
        { type: 'steps', segments: cur.fit.map((v, b) => ({ x0: b / s.k, x1: (b + 1) / s.k, value: v })), color: 'model', width: 2.4, label: 'гистограмма, k = ' + s.k },
      ]);
      const vals = C.flatMap((c) => [c.total, c.test, c.data]);
      p2.render([
        { type: 'line', x: ks, y: C.map((c) => c.data), color: 'model', width: 1.8, label: 'данные при модели' },
        { type: 'line', x: ks, y: C.map((c) => c.model), color: 'muted', width: 1.8, label: 'модель ½k log₂ n' },
        { type: 'line', x: ks, y: C.map((c) => c.total), color: 'tree', width: 2.6, label: 'сумма (MDL)' },
        { type: 'line', x: ks, y: C.map((c) => c.test), color: 'valid', width: 1.8, dash: '6 4', label: 'новые данные × n' },
        { type: 'points', x: [bm.k], y: [bm.total], color: 'tree', r: 6 },
        { type: 'vline', x: s.k, color: 'ink2', width: 1, dash: '3 3' },
      ], { y: [0, Math.max(...vals) * 1.08] });
      st.set('data', f1(cur.data));
      st.set('model', f1(cur.model));
      st.set('tot', f1(cur.total));
      st.set('bm', String(bm.k));
      st.set('bt', String(bt.k));
      note.innerHTML = 'Чем больше корзин, тем точнее модель описывает <b>эти</b> ответы (биты на данные падают), но тем дороже записать саму модель. Минимум суммы — компромисс; так устроен критерий BIC (½ log₂ n на параметр). <b>Сжать = понять</b>: модель, которая коротко описывает данные вместе с собой, не может быть подгонкой под шум. Сравните лучший k по MDL и по новым данным: для ступеньки (n = 500) оба выбирают 5 корзин, для плавных зависимостей MDL осторожнее (6 против 14 у «плавной») — BIC платит за параметры щедро, зато почти никогда не переобучается. В бустинге та же логика в явном виде: γ в XGBoost — штраф за каждый новый лист, λ — за величину значений листьев; разбиение принимается, только если выигрыш потерь больше «цены» усложнения.';
    }
    w.pythonAction(() => PY_NP + PY_RNG + `
f = {"step": lambda x: 0.2 if x < 0.4 else 0.8, "smooth": lambda x: 1 / (1 + np.exp(-8 * (x - 0.5))),
     "waves": lambda x: 0.5 + 0.35 * np.sin(4 * np.pi * x)}["${s.key}"]
n = ${s.n}
rng = Mulberry32(3); X, y = [], []
for _ in range(n):
    x = rng.random(); X.append(x); y.append(1 if rng.random() < f(x) else 0)
X, y = np.array(X), np.array(y)
h = lambda q: np.where((q > 0) & (q < 1), -q * np.log2(np.clip(q, 1e-12, 1)) - (1 - q) * np.log2(np.clip(1 - q, 1e-12, 1)), 0.0)
best = None
for k in range(1, ${MDL_KMAX} + 1):
    b = np.minimum(k - 1, (X * k).astype(int))
    cnt, ones = np.bincount(b, minlength=k), np.bincount(b, y, minlength=k)
    m = cnt > 0
    data = (cnt[m] * h(ones[m] / cnt[m])).sum(); model = 0.5 * k * np.log2(n)
    if best is None or data + model < best[1]: best = (k, data + model)
    if k == ${s.k}: print(f"k = {k}: данные {data:.1f} + модель {model:.1f} = {data + model:.1f} бит")
print("минимум длины описания при k =", best[0])
`);
    draw();
  });

  /* ==============================================================================
   * Тренажёр
   * ============================================================================== */
  const IQ = [
    { q: 'Сколько вопросов «да/нет» нужно, чтобы наверняка угадать число от 1 до 100?', opts: ['6', '7', '10', '50'], a: 1, why: 'log₂ 100 ≈ 6.64, значит, 7 вопросов (2⁷ = 128 ≥ 100).' },
    { q: 'Сколько взвешиваний на чашечных весах нужно, чтобы найти одну тяжёлую монету среди 81?', opts: ['3', '4', '7', '40'], a: 1, why: 'Три исхода у каждого взвешивания: log₃ 81 = 4.' },
    { q: 'Неожиданность события с вероятностью 1/32 —', opts: ['32 бита', '5 бит', '1/32 бита', '0.5 бита'], a: 1, why: '−log₂(1/32) = 5.' },
    { q: 'Энтропия распределения ½, ¼, ¼ —', opts: ['1 бит', '1.5 бита', '2 бита', '1.585 бита'], a: 1, why: '½·1 + ¼·2 + ¼·2 = 1.5.' },
    { q: 'Энтропия кубика, на котором всегда выпадает шестёрка, —', opts: ['2.585 бита', '1 бит', '0', '6 бит'], a: 2, why: 'Исход известен заранее — неопределённости нет.' },
    { q: 'Перплексия 2ᴴ распределения ½, ¼, ¼ —', opts: ['1.5', '2.83', '3', '2'], a: 1, why: '2^1.5 ≈ 2.83 «эффективных» исхода.' },
    { q: 'Можно ли построить префиксный код с длинами 1, 1, 2?', opts: ['да', 'нет: 1/2 + 1/2 + 1/4 > 1', 'да, если символы равновероятны', 'только непрефиксный'], a: 1, why: 'Неравенство Крафта нарушено: двоичному дереву не хватит листьев.' },
    { q: 'Средняя длина кода Хаффмана L связана с энтропией так:', opts: ['L < H', 'H ≤ L < H + 1', 'L = 2H', 'L всегда равна H'], a: 1, why: 'Нижняя граница — теорема Шеннона, верхняя — код Шеннона ⌈−log₂ p⌉.' },
    { q: 'Оценка энтропии по частотам в маленькой выборке в среднем…', opts: ['точна', 'завышена', 'занижена', 'отрицательна'], a: 2, why: 'Редкие исходы не попадают в выборку, частоты кажутся «упорядоченнее».' },
    { q: 'Признаки x₁, x₂ — независимые монеты, y = x₁ XOR x₂. Чему равна I(x₁; y)?', opts: ['1 бит', '0.5 бита', '0', '2 бита'], a: 2, why: 'По одному признаку класс угадать нельзя; вместе — 1 бит (синергия).' },
    { q: 'Корреляция x и y = x² (x симметрично вокруг нуля) равна нулю. Взаимная информация…', opts: ['тоже ноль', 'больше нуля', 'отрицательна', 'не определена'], a: 1, why: 'Взаимная информация ловит любую зависимость.' },
    { q: 'Признак разбили на 8 корзин. Что можно сказать об информации о классе?', opts: ['она могла вырасти', 'она не выросла: I(корзина; y) ≤ I(x; y)', 'она удвоилась', 'она не изменилась'], a: 1, why: 'Неравенство обработки данных.' },
    { q: 'KL(p ‖ q) — это…', opts: ['H(p) + H(q)', 'H(p, q) − H(p)', 'симметричное расстояние', 'H(q) − H(p)'], a: 1, why: 'Перерасход бит из-за кода под q вместо p.' },
    { q: 'PSI для мониторинга сдвига данных — это…', opts: ['корреляция', 'KL(q ‖ p) + KL(p ‖ q) по корзинам', 'энтропия признака', 'p-значение'], a: 1, why: 'Симметризованная KL (Джеффрис).' },
    { q: 'Максимизация правдоподобия эквивалентна минимизации…', opts: ['KL(модель ‖ данные)', 'KL(данные ‖ модель)', 'энтропии модели', 'числа параметров'], a: 1, why: 'Средний −log q по выборке = H(p̂) + KL(p̂ ‖ q).' },
    { q: 'Ожидаемый log-loss модели на новых данных равен…', opts: ['I(X; Y)', 'H(Y | X) + KL(истина ‖ модель)', 'H(Y) − KL', 'всегда ln 2'], a: 1, why: 'Неустранимая неопределённость плюс ошибка модели.' },
    { q: 'Log-loss константной модели F₀ (доля единиц 0.2), в битах —', opts: ['0', 'h(0.2) ≈ 0.722', '1', '0.2'], a: 1, why: 'Лучшая константа даёт H(Y).' },
    { q: 'Прирост информации разбиения, умноженный на n (в натах), равен…', opts: ['числу листьев', 'снижению суммарного log-loss при листьях-долях', 'снижению Джини', 'глубине'], a: 1, why: 'Log-loss дерева с листьями-частотами = n · взвешенная энтропия листьев.' },
    { q: 'Признак — идентификатор объекта. Его прирост информации на обучении…', opts: ['ноль', 'максимален (H(Y)), хотя признак бесполезен', 'отрицателен', 'равен 0.5'], a: 1, why: 'Каждое значение — отдельный «чистый» лист; помогает gain ratio или честная проверка.' },
    { q: 'Метки перевёрнуты шумом с вероятностью 0.1. Какой ошибки (относительно шумных меток) не избежать?', opts: ['0', '5 %', '10 %', '50 %'], a: 2, why: 'Неравенство Фано: P_e ≥ h⁻¹(h(0.1)) = 0.1.' },
  ];
  GBC.widget('info-game', (el) => {
    const s = { i: 0, right: 0, streak: 0, picked: null, round: 1 };
    const w = ui.shell(el, { title: 'Тренажёр: теория информации', sub: 'Двадцать вопросов по всему уроку — от бита до бустинга.' });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.05rem;padding:6px 0 12px' });
    w.main.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:8px' });
    w.main.appendChild(optsBox);
    const next = ui.button(w.controls, { label: 'Следующий', icon: 'step', onClick: () => ((s.i = (s.i + 1) % IQ.length), s.round++, (s.picked = null), draw()) });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function draw() {
      const Q = IQ[s.i];
      qEl.textContent = Q.q;
      optsBox.textContent = '';
      Q.opts.forEach((o, k) => {
        const b = ui.button(optsBox, { label: o, kind: s.picked === null || k === Q.a ? 'primary' : '', onClick: () => {
          if (s.picked !== null) return;
          s.picked = k;
          if (k === Q.a) s.right++, s.streak++;
          else s.streak = 0;
          draw();
        } });
        b.style.whiteSpace = 'normal';
        b.style.textAlign = 'left';
        b.style.height = 'auto';
        if (s.picked !== null) b.disabled = true;
      });
      st.set('r', String(s.round));
      st.set('ok', s.right + ' из ' + (s.round - (s.picked === null ? 1 : 0)));
      st.set('s', String(s.streak));
      note.innerHTML = s.picked === null ? 'Подсказка: почти всё в теории информации — это −log p и его среднее.' : (s.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет</b>, ответ: ' + Q.opts[Q.a] + '. ') + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), s.picked === null ? 'Пропустить' : 'Следующий');
    }
    draw();
  });
})();
