/* Урок 15.21: теория игр. Часть 2 — нулевая сумма, обучение в играх, последовательные и повторяющиеся игры.
 * Виджеты: седловая точка; графический метод 2×n; поверхность выигрыша и минимакс; решатель матричных игр
 * (симплекс-метод); фиктивная игра Брауна — Робинсон; минимаксная оценка (игра с природой); FTL против Hedge;
 * Hedge с экспертами; Hedge в «камень-ножницы-бумага» (включая оптимистичный); гонка алгоритмов самоигры;
 * репликаторная динамика; градиентный спуск-подъём; дерево игры и обратная индукция; ним; альфа-бета
 * отсечения; торг Рубинштейна; повторяющаяся дилемма и мрачный триггер; турнир Аксельрода.
 * Помощники — из GBC.lesson1521 (lesson.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const L = GBC.lesson1521;
  const { f2, f3, pct, minus, frac, pyNum, pyVec, pyMat, pyStr, fracVec, P1, P2, EPS, SER, tint, flexRow, texInto, texEl, card, cardGrid, chip, rowTable, scrollBox, monoBox, sText, svgArrow, legendRow } = L;
  const { transpose, neg, clone, matVec, vecMat, dot, pay2, softmax, zeroSum, exploit, gameTable, RPSM } = L;
  const SQ3 = Math.sqrt(3) / 2;
  const tern = (p) => [p[1] + p[2] / 2, p[2] * SQ3];
  const untern = (x, y) => {
    const c = U.clamp(y / SQ3, 0, 1);
    const b = U.clamp(x - c / 2, 0, 1 - c);
    return [1 - b - c, b, c];
  };
  const triLayer = () => ({ type: 'line', x: [0, 1, 0.5, 0], y: [0, 0, SQ3, 0], color: 'ink2', width: 1.5, hover: false });
  const triPlot = (parent, h = 300) => new GBC.Plot(parent, { height: h, equal: true, grid: 'none', x: { label: '', domain: [-0.14, 1.14], ticks: [], hide: true }, y: { label: '', domain: [-0.12, 0.96], ticks: [], hide: true }, margin: { left: 6, bottom: 6, right: 6, top: 6 } });
  const triLabels = (names) => ({ type: 'text', items: [{ x: -0.02, y: -0.07, text: names[0], anchor: 'middle' }, { x: 1.02, y: -0.07, text: names[1], anchor: 'middle' }, { x: 0.5, y: SQ3 + 0.06, text: names[2], anchor: 'middle' }] });

  /* Библиотека игр с нулевой суммой. */
  function blotto(sa, sb, k = 3) {
    const alloc = (s) => {
      const out = [];
      const rec = (left, cur) => {
        if (cur.length === k - 1) return void out.push([...cur, left]);
        for (let x = 0; x <= left; x++) rec(left - x, [...cur, x]);
      };
      rec(s, []);
      return out;
    };
    const RA = alloc(sa);
    const RB = alloc(sb);
    const M = RA.map((a) => RB.map((b) => a.reduce((acc, v, t) => acc + Math.sign(v - b[t]), 0)));
    return { M, rows: RA.map((a) => a.join('-')), cols: RB.map((b) => b.join('-')) };
  }
  const RPSLS = (() => {
    const beats = [[2, 3], [0, 4], [1, 3], [4, 1], [2, 0]];
    return U.range(5).map((i) => U.range(5).map((j) => (beats[i].includes(j) ? 1 : beats[j].includes(i) ? -1 : 0)));
  })();
  const ZS = {
    rps: { label: 'Камень, ножницы, бумага', rows: ['камень', 'бумага', 'ножницы'], cols: ['камень', 'бумага', 'ножницы'], M: RPSM },
    rps2: { label: 'КНБ: камень бьёт вдвойне', rows: ['камень', 'бумага', 'ножницы'], cols: ['камень', 'бумага', 'ножницы'], M: [[0, -1, 2], [1, 0, -1], [-2, 1, 0]] },
    rpsls: { label: 'КНБ + ящерица + Спок', rows: ['камень', 'бумага', 'ножницы', 'ящерица', 'Спок'], cols: ['камень', 'бумага', 'ножницы', 'ящерица', 'Спок'], M: RPSLS },
    a: { label: 'Игра A (2×3)', rows: ['строка 1', 'строка 2'], cols: ['столбец 1', 'столбец 2', 'столбец 3'], M: [[3, -1, 2], [-2, 2, 1]] },
    hide: { label: 'Прятки в трёх домах', rows: ['искать в 1', 'искать в 2', 'искать в 3'], cols: ['спрятаться в 1', 'в 2', 'в 3'], M: [[0.9, 0, 0], [0, 0.6, 0], [0, 0, 0.3]] },
    blotto: { label: 'Полковник Блотто: 3 поля, 4 на 4', ...(() => { const b = blotto(4, 4); return { rows: b.rows, cols: b.cols, M: b.M }; })() },
  };

  /* ==============================================================================
   * Шаг 15. Нулевая сумма в чистых стратегиях: седловая точка
   * ============================================================================== */
  const SAD = {
    sad: { label: 'С седловой точкой', M: [[3, 1, 4, 2], [2, 0, 1, -1], [5, 2, 6, 3]] },
    two: { label: 'Два седла', M: [[4, 2, 5], [1, 0, 3], [3, 2, 4]] },
    no: { label: 'Без седловой точки (игра A)', M: [[3, -1, 2], [-2, 2, 1]] },
    rps: { label: 'Камень, ножницы, бумага', M: RPSM },
    rand: { label: 'Случайная 3×4' },
  };
  GBC.widget('saddle', (el) => {
    const s = { g: 'sad', seed: 1, sel: null };
    const w = ui.shell(el, { title: 'Седловая точка: максимин и минимакс', sub: 'Числа — выигрыш игрока 1 (он же проигрыш игрока 2). Осторожный игрок 1 смотрит на минимум каждой строки и выбирает строку с наибольшим минимумом (максимин); игрок 2 — на максимум каждого столбца и выбирает наименьший (минимакс). Щёлкните по строке.' });
    ui.select(w.controls, { label: 'Матрица', value: s.g, options: Object.keys(SAD).map((k) => ({ value: k, label: SAD[k].label })), onChange: (v) => ((s.g = v), (s.sel = null), draw()) });
    const sdSl = ui.slider(w.controls, { label: 'Номер случайной матрицы', min: 1, max: 40, step: 1, value: s.seed, format: String, onInput: (v) => ((s.seed = v), draw()) });
    const tbl = H('div');
    const line = monoBox();
    w.main.append(tbl, line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'lo', label: 'максимин (гарантия 1)' }, { key: 'hi', label: 'минимакс (гарантия 2)' }, { key: 'sad', label: 'седловые точки' }]);
    const getM = () => {
      if (s.g !== 'rand') return SAD[s.g].M;
      const rng = new GBC.RNG(300 + s.seed);
      return U.range(3).map(() => U.range(4).map(() => rng.randint(11) - 5));
    };
    w.pythonAction(() => `import numpy as np

M = np.array(${pyMat(getM())})      # выигрыш игрока 1
row_min, col_max = M.min(axis=1), M.max(axis=0)
lo, hi = row_min.max(), col_max.min()
print("минимумы строк:", row_min, " → максимин", lo)
print("максимумы столбцов:", col_max, " → минимакс", hi)
saddles = [(i, j) for i in range(M.shape[0]) for j in range(M.shape[1]) if M[i, j] == row_min[i] == col_max[j]]
print("седловые точки:", saddles if saddles else "нет — понадобятся смешанные стратегии")`);
    function draw() {
      sdSl.el.style.display = s.g === 'rand' ? '' : 'none';
      const M = getM();
      const m = M.length;
      const n = M[0].length;
      const rmin = M.map((r) => Math.min(...r));
      const cmax = U.range(n).map((j) => Math.max(...M.map((r) => r[j])));
      const lo = Math.max(...rmin);
      const hi = Math.min(...cmax);
      const sad = [];
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) if (M[i][j] === rmin[i] && M[i][j] === cmax[j]) sad.push([i, j]);
      const t = H('table', { class: 'data', style: 'width:auto;margin:0 auto;font-variant-numeric:tabular-nums' });
      const th = (txt, st0 = '') => H('th', { style: 'text-align:center;white-space:nowrap;' + st0 }, txt);
      t.appendChild(H('thead', null, H('tr', null, th(''), ...U.range(n).map((j) => th('B' + (j + 1))), th('min строки', 'color:' + P1))));
      const tb = H('tbody');
      for (let i = 0; i < m; i++) {
        const tr = H('tr', { style: 'cursor:pointer' }, th('A' + (i + 1)));
        tr.addEventListener('click', () => ((s.sel = i), draw()));
        for (let j = 0; j < n; j++) {
          const isS = sad.some(([a, b]) => a === i && b === j);
          const resp = s.sel === i && M[i][j] === rmin[i];
          tr.appendChild(H('td', { style: 'text-align:center;font-family:var(--font-mono);padding:7px 12px;' + (isS ? 'background:var(--good-soft);font-weight:700;' : '') + (resp ? 'outline:2.5px solid ' + P2 + ';outline-offset:-4px;' : '') }, minus(String(M[i][j])) + (isS ? ' ★' : '')));
        }
        tr.appendChild(H('td', { style: 'text-align:center;font-family:var(--font-mono);color:' + P1 + ';' + (rmin[i] === lo ? 'font-weight:800;text-decoration:underline' : '') + (s.sel === i ? ';background:' + tint(P1, 18) : '') }, minus(String(rmin[i]))));
        tb.appendChild(tr);
      }
      tb.appendChild(H('tr', null, th('max столбца', 'color:' + P2), ...cmax.map((v) => H('td', { style: 'text-align:center;font-family:var(--font-mono);color:' + P2 + ';' + (v === hi ? 'font-weight:800;text-decoration:underline' : '') }, minus(String(v)))), H('td')));
      t.appendChild(tb);
      tbl.textContent = '';
      const box = scrollBox();
      box.appendChild(t);
      tbl.appendChild(box);
      if (s.sel !== null && s.sel < m) {
        const j = M[s.sel].indexOf(rmin[s.sel]);
        line.textContent = 'Игрок 1 выбрал A' + (s.sel + 1) + '. Худший для него ответ — B' + (j + 1) + ': выигрыш ' + minus(String(rmin[s.sel])) + '. Поэтому гарантия строки A' + (s.sel + 1) + ' — её минимум.';
      } else line.textContent = 'Щёлкните по строке: какой ответ выберет игрок 2?';
      st.set('lo', minus(String(lo)));
      st.set('hi', minus(String(hi)));
      st.set('sad', sad.length ? sad.map(([i, j]) => 'A' + (i + 1) + '/B' + (j + 1)).join(', ') : 'нет');
      note.innerHTML = 'Всегда <b>максимин ≤ минимакс</b>: гарантия игрока 1 не больше того, что игрок 2 может не отдать (min строки i ≤ M<sub>ij</sub> ≤ max столбца j для любых i, j). ' + (sad.length ? '<b>Седловая точка</b> — элемент, наименьший в своей строке и наибольший в своём столбце: здесь максимин = минимакс = ' + minus(String(lo)) + ', это <b>цена игры</b> в чистых стратегиях, и шпионить бесполезно — знание хода соперника ничего не даёт. ' + (sad.length > 1 ? 'Седловых точек несколько, но значение в них одинаковое, а стратегии взаимозаменяемы: любая оптимальная строка с любым оптимальным столбцом снова даёт седло.' : '') : 'Седловой точки нет: максимин ' + minus(String(lo)) + ' < минимакс ' + minus(String(hi)) + '. Тому, чей ход раскрыт, хуже — и в чистых стратегиях игра «не решается». Разрыв закрывают смешанные стратегии (шаг 16).');
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 16. Графический метод для игр 2×n
   * ============================================================================== */
  const ENV = {
    a: { label: 'Игра A', M: [[3, -1, 2], [-2, 2, 1]] },
    b: { label: 'Игра B', M: [[2, -1, 0], [-1, 1, 3]] },
    c: { label: 'Игра C', M: [[4, 1, 3], [2, 3, 1]] },
    d: { label: 'Игра D (2×4)', M: [[1, 4, -1, 2], [3, -2, 2, 0]] },
    pen: { label: 'Пенальти', M: [[0.583, 0.9497], [0.9291, 0.6992]] },
  };
  GBC.widget('envelope', (el) => {
    const s = { g: 'a', p: 0.8 };
    const w = ui.shell(el, { title: 'Графический метод: нижняя огибающая', sub: 'Игрок 1 смешивает две строки: p — вероятность строки 1. Каждая прямая — его ожидаемый выигрыш против одного столбца. Игрок 2 ответит худшим для него столбцом, поэтому гарантия игрока 1 — нижняя огибающая прямых.' });
    ui.select(w.controls, { label: 'Матрица', value: s.g, options: Object.keys(ENV).map((k) => ({ value: k, label: ENV[k].label })), onChange: (v) => ((s.g = v), draw()) });
    ui.slider(w.controls, { label: 'p (вероятность строки 1)', min: 0, max: 1, step: 0.01, value: s.p, onInput: (v) => ((s.p = v), draw()) });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const plot = new GBC.Plot(w.main, { height: 290, x: { label: 'p', domain: [0, 1] }, y: { label: 'выигрыш игрока 1' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'гарантия при этом p' }, { key: 'ps', label: 'p* и цена v' }, { key: 'q', label: 'ответ игрока 2: q*' }]);
    w.pythonAction(() => `import numpy as np
from scipy.optimize import linprog

M = np.array(${pyMat(ENV[s.g].M)}, float)
p = np.linspace(0, 1, 100001)
lines = np.outer(p, M[0]) + np.outer(1 - p, M[1])      # выигрыш против каждого столбца
env = lines.min(axis=1)
k = env.argmax()
print(f"p* ≈ {p[k]:.4f}, v ≈ {env[k]:.4f}, гарантия при p = ${pyNum(s.p)}: {env[round(${pyNum(s.p)} * 100000)]:.4f}")
# стратегия игрока 2 — из двойственной задачи: min v при M q ≤ v, Σq = 1
n = M.shape[1]
res = linprog(np.r_[np.zeros(n), 1], A_ub=np.c_[M, -np.ones(2)], b_ub=np.zeros(2),
              A_eq=[np.r_[np.ones(n), 0]], b_eq=[1], bounds=[(0, None)] * n + [(None, None)])
print("q* =", res.x[:n].round(4), " v =", round(res.x[-1], 4))`);
    function draw() {
      const M = ENV[s.g].M;
      const n = M[0].length;
      const line = (j, p) => p * M[0][j] + (1 - p) * M[1][j];
      const env = (p) => Math.min(...U.range(n).map((j) => line(j, p)));
      const z = zeroSum(M);
      const pS = z.p[0];
      const xs = U.linspace(0, 1, 201);
      const active = U.range(n).filter((j) => Math.abs(line(j, pS) - z.v) < 1e-7);
      gameTable((tbl.textContent = '', tbl), { A: M, rows: ['стр. 1', 'стр. 2'], cols: U.range(n, 1).map((j) => 'ст. ' + j) }, { fmtv: (v) => minus(U.fmt(v, 3)) });
      plot.render([
        ...U.range(n).map((j) => ({ type: 'line', x: xs, y: xs.map((p) => line(j, p)), color: SER[[0, 2, 6, 4][j]], width: active.includes(j) ? 2 : 1.4, dash: active.includes(j) ? null : '5 4', label: 'против столбца ' + (j + 1) })),
        { type: 'line', x: xs, y: xs.map(env), color: 'tree', width: 3.5, label: 'гарантия (нижняя огибающая)' },
        { type: 'vline', x: s.p, color: 'ink2', dash: '4 4', width: 1 },
        { type: 'points', x: [pS], y: [z.v], color: 'tree', r: 7, hollow: true, label: 'максимин' },
        { type: 'points', x: [s.p], y: [env(s.p)], color: 'model', r: 5 },
      ]);
      st.set('g', f3(env(s.p)));
      st.set('ps', 'p* = ' + frac(pS) + ', v = ' + frac(z.v));
      st.set('q', fracVec(z.q));
      note.innerHTML = 'Максимум огибающей — <b>максимин в смешанных стратегиях</b>: p* = ' + frac(pS) + ', гарантия v = ' + frac(z.v) + '. Он лежит на пересечении прямых — там, где игроку 2 безразлично, какой из «активных» столбцов играть (' + active.map((j) => j + 1).join(' и ') + '). Только эти столбцы игрок 2 и смешивает: q* = ' + fracVec(z.q) + '. Столбец, прямая которого проходит выше точки максимина, ему невыгоден — его вероятность 0. Проверьте: если игрок 2 играет q*, то против любой строки игрок 1 получает не больше v. Гарантии совпали — это и есть теорема о минимаксе (шаг 17).';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 17. Теорема о минимаксе: поверхность p·M·q
   * ============================================================================== */
  GBC.widget('minimax-surface', (el) => {
    const s = { M: [[1, -1], [-1, 1]] };
    const PRE = { mp: [[1, -1], [-1, 1]], pen: [[0.583, 0.9497], [0.9291, 0.6992]], sad: [[2, 3], [1, 4]], odd: [[3, -2], [-1, 1]] };
    const w = ui.shell(el, { title: 'Теорема о минимаксе: седло поверхности выигрыша', sub: 'Цвет — ожидаемый выигрыш игрока 1 при смешанных стратегиях p (строка 1) и q (столбец 1). Игрок 1 хочет вправо-вверх по цвету, игрок 2 — наоборот. Нижний график: гарантия игрока 1 при каждом p и «потолок» игрока 2 при каждом q.' });
    const sls = [];
    const names = ['a = M₁₁', 'b = M₁₂', 'c = M₂₁', 'd = M₂₂'];
    names.forEach((nm, k) => sls.push(ui.slider(w.controls, { label: nm, min: -3, max: 4, step: 0.5, value: s.M[k >> 1][k & 1], format: (v) => minus(String(v)), onInput: (v) => ((s.M[k >> 1][k & 1] = v), draw()) })));
    const pres = flexRow('margin:4px 0');
    const preset = (label, M) => ui.button(pres, { label, small: true, onClick: () => ((s.M = clone(M)), sls.forEach((sl, k) => sl.set(M[k >> 1][k & 1])), draw()) });
    preset('монетки', PRE.mp);
    preset('с седлом', PRE.sad);
    preset('несимметричная', PRE.odd);
    w.controls.appendChild(pres);
    const box = H('div', { style: 'max-width:420px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 300, equal: true, x: { label: 'p (игрок 1)', domain: [0, 1] }, y: { label: 'q (игрок 2)', domain: [0, 1] } });
    const plot2 = new GBC.Plot(w.main, { height: 200, x: { label: 'p для гарантии игрока 1, q для потолка игрока 2', domain: [0, 1] }, y: { label: 'выигрыш игрока 1' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pure', label: 'чистые: максимин / минимакс' }, { key: 'v', label: 'смешанные: цена v' }, { key: 'pq', label: 'p*, q*' }]);
    w.pythonAction(() => `import numpy as np

M = np.array(${pyMat(s.M)}, float)
p = np.linspace(0, 1, 2001)
f = lambda p, q: p * q * M[0, 0] + p * (1 - q) * M[0, 1] + (1 - p) * q * M[1, 0] + (1 - p) * (1 - q) * M[1, 1]
lower = np.minimum(f(p, 0), f(p, 1))           # гарантия игрока 1: худший ответ — чистый столбец
upper = np.maximum(f(0, p), f(1, p))           # потолок игрока 2 при его q
print("чистые: максимин", M.min(1).max(), " минимакс", M.max(0).min())
print(f"смешанные: max_p min_q = {lower.max():.4f} при p = {p[lower.argmax()]:.4f}")
print(f"           min_q max_p = {upper.min():.4f} при q = {p[upper.argmin()]:.4f}")`);
    function draw() {
      const M = s.M;
      const f = (p, q) => pay2(M, p, q);
      const z = zeroSum(M);
      const gr = GBC.Plot.grid(f, 0, 1, 0, 1, 81, 81);
      let span = 1e-9;
      for (const v of gr.values) span = Math.max(span, Math.abs(v - z.v));
      const div = GBC.colors.diverging();
      const lo = Math.max(...M.map((r) => Math.min(...r)));
      const hi = Math.min(...[0, 1].map((j) => Math.max(M[0][j], M[1][j])));
      const pS = z.p[0];
      const qS = z.q[0];
      plot.render([
        { type: 'heatmap', grid: gr, colorFn: (v) => div((v - z.v) / span), opacity: 0.7 },
        { type: 'contour', grid: gr, level: z.v, color: 'ink', width: 1.5, dash: '5 4' },
        { type: 'points', x: [pS], y: [qS], r: 8, hollow: true, color: 'ink', label: 'седло (p*, q*)' },
      ]);
      const xs = U.linspace(0, 1, 201);
      plot2.render([
        { type: 'line', x: xs, y: xs.map((p) => Math.min(f(p, 0), f(p, 1))), color: 'blue', width: 2.5, label: 'гарантия 1: min по q' },
        { type: 'line', x: xs, y: xs.map((q) => Math.max(f(0, q), f(1, q))), color: 'orange', width: 2.5, label: 'потолок 2: max по p' },
        { type: 'hline', y: z.v, color: 'ink2', dash: '4 4', width: 1 },
        { type: 'points', x: [pS, qS], y: [z.v, z.v], r: 6, color: 'ink', hollow: true },
      ]);
      st.set('pure', minus(String(lo)) + ' / ' + minus(String(hi)));
      st.set('v', frac(z.v));
      st.set('pq', frac(pS) + ', ' + frac(qS));
      note.innerHTML = 'Функция f(p, q) = pᵀMq <b>линейна</b> по p при фиксированном q и линейна по q при фиксированном p — её поверхность имеет форму седла, а пунктир (уровень v) — крест через седловую точку. Гарантия игрока 1 (синяя) нигде не выше потолка игрока 2 (оранжевая) — это <b>слабая двойственность</b>: max<sub>p</sub> min<sub>q</sub> ≤ min<sub>q</sub> max<sub>p</sub>. <b>Теорема фон Неймана (1928)</b>: для смешанных стратегий в конечной игре неравенство превращается в равенство, ' + (lo === hi ? 'здесь даже в чистых стратегиях (есть седло в матрице).' : 'хотя в чистых стратегиях был разрыв ' + minus(String(lo)) + ' < ' + minus(String(hi)) + '.') + ' Следствие: оптимальную смешанную стратегию можно <b>объявить заранее</b> — соперник ничего не выиграет. Доказывают теорему через разделяющую гиперплоскость, двойственность линейного программирования (шаг 18) или обучение без сожаления (шаг 23).';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 18. Решение матричной игры линейным программированием
   * ============================================================================== */
  GBC.widget('lp-solver', (el) => {
    const s = { g: 'hide', M: clone(ZS.hide.M), rows: ZS.hide.rows, cols: ZS.hide.cols };
    const w = ui.shell(el, { title: 'Решатель матричных игр: симплекс-метод', sub: 'Любая конечная игра с нулевой суммой решается линейным программированием. Выберите игру или впишите свою матрицу (до 5 × 5) — виджет найдёт оптимальные стратегии обоих игроков и цену игры.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: Object.keys(ZS).map((k) => ({ value: k, label: ZS[k].label })), onChange: (v) => load(v) });
    const mSl = ui.slider(w.controls, { label: 'Строк m', min: 2, max: 5, step: 1, value: 3, format: String, onInput: (v) => resize(v, s.M[0].length) });
    const nSl = ui.slider(w.controls, { label: 'Столбцов n', min: 2, max: 5, step: 1, value: 3, format: String, onInput: (v) => resize(s.M.length, v) });
    const tex = texEl(String.raw`\max v \;\;\text{при}\;\; \textstyle\sum_i p_i M_{ij} \ge v\ \ \forall j,\;\; \sum_i p_i = 1,\;\; p \ge 0`, true, 'font-size:.9em');
    w.main.appendChild(tex);
    const ed = H('div');
    w.main.appendChild(ed);
    const plotP = new GBC.Plot(w.main, { height: 190, x: { label: '' }, y: { label: 'вероятность', domain: [0, 1] } });
    const plotQ = new GBC.Plot(w.main, { height: 190, x: { label: '' }, y: { label: 'вероятность', domain: [0, 1] } });
    const chk = monoBox();
    w.main.appendChild(chk);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'цена игры v' }, { key: 'sp', label: 'ходов в смеси: 1 / 2' }, { key: 'piv', label: 'шагов симплекс-метода' }]);
    w.pythonAction(() => `import numpy as np
from scipy.optimize import linprog

M = np.array(${pyMat(s.M)}, float)
m, n = M.shape
# игрок 1: max v при Σ_i p_i M_ij ≥ v для всех j, Σ p = 1, p ≥ 0
r1 = linprog(np.r_[np.zeros(m), -1], A_ub=np.c_[-M.T, np.ones(n)], b_ub=np.zeros(n),
             A_eq=[np.r_[np.ones(m), 0]], b_eq=[1], bounds=[(0, None)] * m + [(None, None)])
# игрок 2: min w при Σ_j M_ij q_j ≤ w для всех i — двойственная задача
r2 = linprog(np.r_[np.zeros(n), 1], A_ub=np.c_[M, -np.ones(m)], b_ub=np.zeros(m),
             A_eq=[np.r_[np.ones(n), 0]], b_eq=[1], bounds=[(0, None)] * n + [(None, None)])
p, q = r1.x[:m], r2.x[:n]
print("p* =", p.round(4), " q* =", q.round(4))
print("v (игрок 1) =", round(-r1.fun, 6), " w (игрок 2) =", round(r2.fun, 6))
print("p*·M ≥ v:", (p @ M).round(4), "   M·q* ≤ v:", (M @ q).round(4))`);
    function load(k) {
      s.g = k;
      const g = ZS[k];
      s.M = clone(g.M);
      s.rows = g.rows;
      s.cols = g.cols;
      mSl.set(Math.min(5, s.M.length));
      nSl.set(Math.min(5, s.M[0].length));
      draw();
    }
    function resize(m, n) {
      const M = U.range(m).map((i) => U.range(n).map((j) => (s.M[i] && s.M[i][j] !== undefined ? s.M[i][j] : 0)));
      s.M = M;
      s.g = 'own';
      s.rows = U.range(m, 1).map((i) => 'строка ' + i);
      s.cols = U.range(n, 1).map((j) => 'ст. ' + j);
      draw();
    }
    function draw() {
      const M = s.M;
      const m = M.length;
      const n = M[0].length;
      const big = m > 5 || n > 5;
      mSl.el.style.display = big ? 'none' : '';
      nSl.el.style.display = big ? 'none' : '';
      ed.textContent = '';
      if (!big) {
        const t = H('table', { class: 'data', style: 'width:auto;margin:0 auto' });
        t.appendChild(H('thead', null, H('tr', null, H('th'), ...s.cols.map((c) => H('th', { style: 'text-align:center;white-space:nowrap' }, c)))));
        const tb = H('tbody');
        M.forEach((r, i) => {
          const tr = H('tr', null, H('th', { style: 'white-space:nowrap' }, s.rows[i]));
          r.forEach((v, j) => {
            const inp = H('input', { class: 'input', type: 'text', inputmode: 'decimal', 'aria-label': 'элемент матрицы', value: minus(String(v)), style: 'width:4em;padding:3px 4px;text-align:center;font-family:var(--font-mono)' });
            inp.addEventListener('change', () => {
              const x = parseFloat(inp.value.replace(',', '.').replace('−', '-'));
              if (Number.isFinite(x)) M[i][j] = x;
              draw();
            });
            tr.appendChild(H('td', { style: 'padding:4px 6px;text-align:center' }, inp));
          });
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        const box = scrollBox();
        box.appendChild(t);
        ed.appendChild(box);
      } else ed.appendChild(H('p', { style: 'color:var(--ink-2);margin:2px 0' }, 'Матрица ' + m + ' × ' + n + ' (стратегия — сколько солдат на поля 1, 2, 3): ±1 за каждое выигранное или проигранное поле. Ниже — только ходы с положительной вероятностью.'));
      const z = zeroSum(M);
      const showP = U.range(m).filter((i) => !big || z.p[i] > 1e-9);
      const showQ = U.range(n).filter((j) => !big || z.q[j] > 1e-9);
      const bar = (plot, idx, prob, names, color) => {
        plot.opts.x.ticks = U.range(idx.length, 1);
        plot.opts.x.format = (v) => names[idx[Math.round(v) - 1]] || '';
        plot.render([
          { type: 'bars', x: U.range(idx.length, 1), y: idx.map((i) => prob[i]), color, width: 0.6, maxPx: 40, label: color === 'blue' ? 'p* — игрок 1' : 'q* — игрок 2', tooltip: (k) => [{ label: names[idx[k]], value: frac(prob[idx[k]]) }] },
          { type: 'text', items: idx.map((i, k) => ({ x: k + 1, y: prob[i], dy: -6, anchor: 'middle', text: frac(prob[i]) })) },
        ], { x: [0.4, idx.length + 0.6], y: [0, 1.08] });
      };
      bar(plotP, showP, z.p, s.rows, 'blue');
      bar(plotQ, showQ, z.q, s.cols, 'orange');
      const pM = vecMat(z.p, M);
      const Mq = matVec(M, z.q);
      chk.textContent = 'гарантия игрока 1: min по столбцам (p*·M) = ' + f3(Math.min(...pM)) + '\nпотолок игрока 2:  max по строкам (M·q*) = ' + f3(Math.max(...Mq)) + '\nстроки, не входящие в смесь, дают против q* меньше v: ' + (U.range(m).filter((i) => z.p[i] < 1e-9).map((i) => s.rows[i] + ' → ' + f3(Mq[i])).join(', ') || '—');
      st.set('v', frac(z.v));
      st.set('sp', U.range(m).filter((i) => z.p[i] > 1e-9).length + ' / ' + U.range(n).filter((j) => z.q[j] > 1e-9).length);
      st.set('piv', String(z.pivots));
      const texts = {
        rps: 'Ровно по трети, цена 0 — игра симметрична.',
        rps2: 'Камень бьёт ножницы вдвойне — а в оптимуме чаще всего играют бумагу: (1/4; 1/2; 1/4).',
        rpsls: 'Пять ходов, каждый бьёт два и проигрывает двум: равномерная смесь 1/5, цена 0.',
        a: 'То же, что графический метод шага 16: p* = (1/2; 1/2), третий столбец не используется.',
        hide: 'Ищущий находит спрятавшегося в доме i с вероятностью d<sub>i</sub> = 0.9, 0.6, 0.3, если ищет там же. Оптимально и прятаться, и искать чаще там, где найти <em>труднее</em>: вероятности пропорциональны 1/d<sub>i</sub>, цена 1/Σ(1/d<sub>i</sub>) ≈ 0.164. Интуиция «искать там, где легче найти» проигрывает: противник это предвидит.',
        blotto: 'Полковник Блотто (Борель, 1921): у каждого 4 солдата на три поля, поле берёт тот, у кого там больше. Цена 0 (игра симметрична), но оптимальная стратегия — смесь нескольких расстановок; ни одна чистая расстановка не годится. Оптимальных смесей много, поэтому другой решатель может выдать другую.',
        own: 'Своя матрица: впишите числа в поля.',
      };
      note.innerHTML = '<b>Как это работает.</b> Прибавим ко всем элементам константу, чтобы они стали положительны (цена сдвинется на ту же константу). Задача игрока 2 «max Σy при My ≤ 1, y ≥ 0» — стандартная линейная программа; её решает симплекс-метод (урок 15.15, шаг 31), а оптимальная стратегия игрока 1 — <b>двойственные переменные</b>. Теорема о минимаксе и есть сильная двойственность ЛП. ' + (texts[s.g] || texts.own);
    }
    load(s.g);
  });

  /* ==============================================================================
   * Шаг 19. Фиктивная игра Брауна — Робинсон
   * ============================================================================== */
  function fictitious(M, T) {
    const m = M.length;
    const n = M[0].length;
    const c1 = new Array(m).fill(0);
    const c2 = new Array(n).fill(0);
    const Mc2 = new Array(m).fill(0);
    const c1M = new Array(n).fill(0);
    let i = 0;
    let j = 0;
    const up = [];
    const lo = [];
    for (let t = 1; t <= T; t++) {
      c1[i]++;
      c2[j]++;
      for (let a = 0; a < m; a++) Mc2[a] += M[a][j];
      for (let b = 0; b < n; b++) c1M[b] += M[i][b];
      up.push(Math.max(...Mc2) / t);
      lo.push(Math.min(...c1M) / t);
      let bi = 0;
      for (let a = 1; a < m; a++) if (Mc2[a] > Mc2[bi] + 1e-12) bi = a;
      let bj = 0;
      for (let b = 1; b < n; b++) if (c1M[b] < c1M[bj] - 1e-12) bj = b;
      i = bi;
      j = bj;
    }
    return { up, lo, c1, c2 };
  }
  GBC.widget('fictitious', (el) => {
    const T = 5000;
    const s = { g: 'rps2', t: 5000 };
    const w = ui.shell(el, { title: 'Фиктивная игра: учимся по частотам соперника', sub: 'В каждом раунде игрок отвечает наилучшим образом на частоты прошлых ходов соперника. Верхняя кривая — лучшее, что игрок 1 может получить против средней стратегии игрока 2; нижняя — гарантия средней стратегии игрока 1. Между ними — цена игры.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: ['rps', 'rps2', 'rpsls', 'a', 'hide', 'blotto'].map((k) => ({ value: k, label: ZS[k].label })), onChange: (v) => ((s.g = v), (R = fictitious(ZS[s.g].M, T)), draw()) });
    ui.slider(w.controls, { label: 'Раундов t', min: 1, max: Math.log10(T), step: 0.01, value: Math.log10(T), format: (v) => String(Math.round(Math.pow(10, v))), onInput: (v) => ((s.t = Math.round(Math.pow(10, v))), draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'раунд t', type: 'log', domain: [1, T] }, y: { label: 'выигрыш игрока 1' } });
    const plotP = new GBC.Plot(w.main, { height: 180, x: { label: '' }, y: { label: 'частота хода', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'b', label: 'нижняя … верхняя оценка' }, { key: 'gap', label: 'разрыв' }, { key: 'v', label: 'цена v (симплекс)' }]);
    let R = fictitious(ZS[s.g].M, T);
    w.pythonAction(() => `import numpy as np

M = np.array(${pyMat(ZS[s.g].M)}, float)
T = ${s.t}
c1, c2 = np.zeros(M.shape[0]), np.zeros(M.shape[1])
i = j = 0
for t in range(1, T + 1):
    c1[i] += 1
    c2[j] += 1
    i = int(np.argmax(M @ c2))      # лучший ответ на частоты соперника (при равенстве — первый)
    j = int(np.argmin(c1 @ M))
print("частоты игрока 1:", (c1 / T).round(3))
print(f"оценки цены: {(c1 @ M).min() / T:.4f} ≤ v ≤ {(M @ c2).max() / T:.4f}")`);
    function draw() {
      const g = ZS[s.g];
      const t = s.t;
      const z = zeroSum(g.M);
      const ts = [];
      const up = [];
      const lo = [];
      for (let k = 1; k <= T; k = Math.max(k + 1, Math.round(k * 1.03))) {
        ts.push(k);
        up.push(R.up[k - 1]);
        lo.push(R.lo[k - 1]);
      }
      plot.render([
        { type: 'line', x: ts, y: up, color: 'orange', width: 2, label: 'max по строкам (M·q̄)' },
        { type: 'line', x: ts, y: lo, color: 'blue', width: 2, label: 'min по столбцам (p̄·M)' },
        { type: 'hline', y: z.v, color: 'ink2', dash: '5 4', width: 1.2, label: 'цена игры v' },
        { type: 'vline', x: t, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      // частоты к раунду t — пересчёт
      const Rt = fictitious(g.M, t);
      const big = g.M.length > 5;
      const idx = U.range(g.M.length).filter((i) => !big || Rt.c1[i] > 0);
      plotP.opts.x.ticks = U.range(idx.length, 1);
      plotP.opts.x.format = (v) => g.rows[idx[Math.round(v) - 1]] || '';
      plotP.render([
        { type: 'bars', x: U.range(idx.length, 1), y: idx.map((i) => Rt.c1[i] / t), color: 'blue', width: 0.55, maxPx: 34, label: 'частоты игрока 1 к раунду t' },
        { type: 'points', x: U.range(idx.length, 1), y: idx.map((i) => z.p[i]), color: 'ink', r: 5, hollow: true, label: 'одна из оптимальных стратегий' },
      ], { x: [0.4, idx.length + 0.6], y: [0, 1] });
      st.set('b', f3(R.lo[t - 1]) + ' … ' + f3(R.up[t - 1]));
      st.set('gap', U.fmt(R.up[t - 1] - R.lo[t - 1], 3));
      st.set('v', frac(z.v));
      note.innerHTML = '<b>Фиктивная игра</b> (Браун, 1951) — первый алгоритм обучения в играх: «считай, что соперник играет свою историческую смесь, и отвечай на неё». Джулия Робинсон в том же году доказала, что в играх с нулевой суммой обе оценки сходятся к цене игры. Сходятся <em>частоты</em>, а сами ходы продолжают прыгать по кругу. Разрыв убывает медленно: в масштабе по горизонтали — логарифм числа раундов. Средние частоты могут сходиться к смеси, отличной от найденной симплекс-методом, если оптимальных стратегий много (Блотто).';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 20. Игра с природой: минимаксная оценка вероятности
   * ============================================================================== */
  GBC.widget('minimax-estimator', (el) => {
    const s = { n: 10, a: 1 };
    const w = ui.shell(el, { title: 'Игра со статистиком: минимаксная оценка', sub: 'Природа выбирает вероятность успеха p, статистик — правило оценки по числу успехов X из n испытаний. Риск — средний квадрат ошибки при данном p. Минимаксная оценка минимизирует худший риск.' });
    ui.slider(w.controls, { label: 'Испытаний n', min: 2, max: 100, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Псевдоотсчёты a в (X + a)/(n + 2a)', min: 0, max: 6, step: 0.1, value: s.a, onInput: (v) => ((s.a = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'истинная вероятность p (ход природы)', domain: [0, 1] }, y: { label: 'риск: E(оценка − p)²' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'mle', label: 'X/n: худший / средний риск' }, { key: 'a', label: 'ваша a: худший / средний' }, { key: 'mm', label: 'минимаксная: риск везде' }]);
    const risk = (n, a, p) => (n * p * (1 - p) + a * a * (1 - 2 * p) * (1 - 2 * p)) / ((n + 2 * a) * (n + 2 * a));
    w.pythonAction(() => `import numpy as np

n, a = ${s.n}, ${pyNum(s.a)}
p = np.linspace(0, 1, 100001)
def risk(a):            # оценка (X + a)/(n + 2a): дисперсия + квадрат смещения
    return (n * p * (1 - p) + a**2 * (1 - 2 * p)**2) / (n + 2 * a)**2
a_mm = np.sqrt(n) / 2   # минимаксная: риск не зависит от p
for name, aa in [("X/n", 0.0), ("ваша", a), ("минимаксная", a_mm)]:
    r = risk(aa)
    print(f"{name:12}: худший риск {r.max():.5f}, средний (p равномерно) {r.mean():.5f}")
print("риск минимаксной по формуле n/(4(n + √n)²):", n / (4 * (n + np.sqrt(n))**2))`);
    function draw() {
      const { n, a } = s;
      const am = Math.sqrt(n) / 2;
      const xs = U.linspace(0, 1, 201);
      const mmR = n / (4 * (n + Math.sqrt(n)) ** 2);
      const stats = (aa) => {
        const r = xs.map((p) => risk(n, aa, p));
        return [Math.max(...r), U.mean(r)];
      };
      const sm = stats(0);
      const sa = stats(a);
      plot.render([
        { type: 'line', x: xs, y: xs.map((p) => risk(n, 0, p)), color: 'blue', width: 2.2, label: 'X/n (максимальное правдоподобие)' },
        { type: 'line', x: xs, y: xs.map((p) => risk(n, a, p)), color: 'orange', width: 2.2, dash: '7 4', label: '(X + a)/(n + 2a)' },
        { type: 'line', x: xs, y: xs.map(() => mmR), color: 'tree', width: 3, label: 'минимаксная: a = √n/2' },
      ], { y: [0, Math.max(sm[0], sa[0], mmR) * 1.12] });
      st.set('mle', U.fmt(sm[0], 4) + ' / ' + U.fmt(sm[1], 4));
      st.set('a', U.fmt(sa[0], 4) + ' / ' + U.fmt(sa[1], 4));
      st.set('mm', U.fmt(mmR, 4));
      note.innerHTML = 'Статистика — это игра с нулевой суммой против природы (Вальд, 1939). Обычная оценка X/n несмещённая, но при p ≈ ½ её риск наибольший. Если «подтянуть» оценку к ½ на a = √n/2 = ' + f2(am) + ' псевдоуспехов и псевдонеудач, риск станет <b>одинаковым при любом p</b> — природе нечем нас подловить, и худший риск минимален: ' + U.fmt(mmR, 4) + ' против ' + U.fmt(sm[0], 4) + ' у X/n. Платим за это тем, что при p около 0 или 1 минимаксная оценка хуже. Это и есть <b>сжатие к априорному значению</b> — тот же приём, что регуляризация λ в листьях бустинга (урок 15.14, шаг 33): минимаксная оценка совпадает с байесовской при априорном Beta(√n/2, √n/2). С ростом n выигрыш минимаксной исчезает, а средний риск у неё больше, чем у X/n с a ≈ 1 (оценка Лапласа).';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 21. Эксперты и сожаление: «следуй за лидером» против Hedge
   * ============================================================================== */
  function expertLosses(kind, T, seed) {
    const rng = new GBC.RNG(seed);
    const out = [];
    for (let t = 0; t < T; t++) {
      if (kind === 'adv') out.push(t === 0 ? [0.5, 0] : t % 2 === 1 ? [0, 1] : [1, 0]);
      else if (kind === 'iid') out.push([rng.random() < 0.4 ? 1 : 0, rng.random() < 0.6 ? 1 : 0]);
      else out.push(t < T / 2 ? [rng.random() < 0.3 ? 1 : 0, rng.random() < 0.7 ? 1 : 0] : [rng.random() < 0.7 ? 1 : 0, rng.random() < 0.3 ? 1 : 0]);
    }
    return out;
  }
  function runExperts(losses, algo, eta) {
    const n = losses[0].length;
    const cum = new Array(n).fill(0);
    let alg = 0;
    const reg = [];
    for (let t = 0; t < losses.length; t++) {
      let p;
      if (algo === 'ftl') {
        let b = 0;
        for (let i = 1; i < n; i++) if (cum[i] < cum[b]) b = i;
        p = U.range(n).map((i) => (i === b ? 1 : 0));
      } else if (algo === 'unif') p = new Array(n).fill(1 / n);
      else p = softmax(cum.map((v) => -eta * v));
      alg += dot(p, losses[t]);
      for (let i = 0; i < n; i++) cum[i] += losses[t][i];
      reg.push(alg - Math.min(...cum));
    }
    return reg;
  }
  GBC.widget('ftl-vs-hedge', (el) => {
    const T = 200;
    const s = { kind: 'adv', seed: 1 };
    const w = ui.shell(el, { title: 'Сожаление: «следуй за лидером» против Hedge', sub: 'Каждый раунд вы выбираете одного из двух экспертов (или смесь), потом узнаёте потери обоих (0 или 1). Сожаление — ваши суммарные потери минус потери лучшего эксперта задним числом.' });
    ui.segmented(w.controls, { label: 'Последовательность потерь', value: s.kind, options: [{ value: 'adv', label: 'враждебная' }, { value: 'iid', label: 'случайная' }, { value: 'shift', label: 'смена лидера' }], onChange: (v) => ((s.kind = v), draw()) });
    ui.slider(w.controls, { label: 'Зерно', min: 1, max: 30, step: 1, value: s.seed, format: String, onInput: (v) => ((s.seed = v), draw()) });
    const tbl = H('div');
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'раунд t', domain: [1, T] }, y: { label: 'сожаление' } });
    w.main.appendChild(H('div', { style: 'font-size:.86rem;color:var(--ink-2);margin:4px 0 0' }, 'Первые раунды последовательности потерь:'));
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ftl', label: 'сожаление FTL' }, { key: 'hedge', label: 'сожаление Hedge' }, { key: 'b', label: 'гарантия Hedge √(T ln n / 2)' }]);
    w.pythonAction(() => `import numpy as np
from gbcourse.rng import Mulberry32

T, kind, seed = ${T}, ${pyStr(s.kind)}, ${s.seed}
rng = Mulberry32(seed)
loss = []
for t in range(T):
    if kind == "adv":
        loss.append([0.5, 0] if t == 0 else [0, 1] if t % 2 == 1 else [1, 0])
    elif kind == "iid":
        loss.append([float(rng.random() < 0.4), float(rng.random() < 0.6)])
    else:
        a, b = (0.3, 0.7) if t < T / 2 else (0.7, 0.3)
        loss.append([float(rng.random() < a), float(rng.random() < b)])
loss = np.array(loss)

def regret(algo, eta=np.sqrt(8 * np.log(2) / T)):
    cum, total = np.zeros(2), 0.0
    for l in loss:
        if algo == "ftl":
            p = np.eye(2)[np.argmin(cum)]          # лидер (при равенстве — первый)
        else:
            w = np.exp(-eta * (cum - cum.min()))
            p = w / w.sum()
        total += p @ l
        cum += l
    return total - cum.min()

print("сожаление FTL:", regret("ftl"), " Hedge:", round(regret("hedge"), 3), " гарантия:", round(np.sqrt(T * np.log(2) / 2), 3))`);
    function draw() {
      const Ls = expertLosses(s.kind, T, s.seed);
      const eta = Math.sqrt((8 * Math.log(2)) / T);
      const rf = runExperts(Ls, 'ftl', eta);
      const rh = runExperts(Ls, 'hedge', eta);
      const ts = U.range(T, 1);
      plot.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: ts, y: rf, color: 'critical', width: 2.2, label: 'FTL: следуй за лидером' },
        { type: 'line', x: ts, y: rh, color: 'model', width: 2.5, label: 'Hedge, η = √(8 ln 2 / T)' },
        { type: 'line', x: ts, y: ts.map((t) => Math.sqrt((t * Math.log(2)) / 2)), color: 'ink2', width: 1.4, dash: '5 4', label: '√(t ln 2 / 2)' },
      ]);
      tbl.textContent = '';
      rowTable(tbl, ['t', 'эксперт 1', 'эксперт 2'], Ls.slice(0, 6).map((l, t) => [String(t + 1), U.fmt(l[0], 1), U.fmt(l[1], 1)]), null);
      st.set('ftl', f2(rf[T - 1]));
      st.set('hedge', f2(rh[T - 1]));
      st.set('b', f2(Math.sqrt((T * Math.log(2)) / 2)));
      const texts = {
        adv: '<b>Враждебная последовательность</b> ломает FTL: лидер меняется каждый раунд, и FTL всегда выбирает того, кто сейчас проиграет. Его потери ≈ T, а у каждого эксперта ≈ T/2 — сожаление растёт <b>линейно</b>. Hedge не ставит всё на одного: он почти поровну делит вес и теряет ≈ T/2.',
        iid: 'Против случайной последовательности FTL хорош — лидер быстро становится постоянным. Hedge немного проигрывает ему, но гарантированно держится под кривой √(T ln n / 2).',
        shift: 'Лидер сменился посередине. FTL долго держится за старого лидера (пока тот не растеряет преимущество), Hedge переключается раньше — экспоненциальные веса быстрее реагируют на свежие потери.',
      };
      note.innerHTML = texts[s.kind] + ' Вывод онлайн-обучения: детерминированный алгоритм легко обмануть; <b>случайность (смесь) — защита от противника</b>, как в пенальти. Hedge гарантирует сожаление не больше √(T ln n / 2) против <em>любой</em> последовательности.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 22. Hedge: мультипликативные веса и выбор темпа
   * ============================================================================== */
  GBC.widget('hedge-experts', (el) => {
    const T = 500;
    const s = { n: 10, eta: 0.1, seed: 2 };
    const w = ui.shell(el, { title: 'Hedge: веса экспертов и темп η', sub: 'n экспертов ошибаются независимо: лучший — в 30 % раундов, худший — в 70 %. Hedge держит вес wᵢ = exp(−η · потери эксперта i). Большой η — быстро, но нервно; маленький — устойчиво, но медленно.' });
    ui.slider(w.controls, { label: 'Экспертов n', min: 2, max: 50, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const eSl = ui.slider(w.controls, { label: 'Темп η', min: 0.005, max: 3, log: true, value: s.eta, onInput: (v) => ((s.eta = v), draw()) });
    ui.button(w.controls, { label: 'η по теории: √(8 ln n / T)', small: true, onClick: () => ((s.eta = Math.sqrt((8 * Math.log(s.n)) / T)), eSl.set(s.eta), draw()) });
    ui.slider(w.controls, { label: 'Зерно', min: 1, max: 30, step: 1, value: s.seed, format: String, onInput: (v) => ((s.seed = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'раунд t', domain: [1, T] }, y: { label: 'вес эксперта', domain: [0, 1] } });
    const plot2 = new GBC.Plot(w.main, { height: 220, x: { label: 'темп η', type: 'log', domain: [0.005, 3] }, y: { label: 'сожаление за 500 раундов' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'сожаление' }, { key: 'b', label: 'гарантия ln n / η + ηT/8' }, { key: 'w', label: 'вес лучшего в конце' }]);
    const sim = (n, eta, seed) => {
      const rng = new GBC.RNG(seed);
      const rate = U.range(n).map((i) => (n === 1 ? 0.3 : 0.3 + (0.4 * i) / (n - 1)));
      const cum = new Array(n).fill(0);
      let alg = 0;
      const W = [];
      for (let t = 0; t < T; t++) {
        const p = softmax(cum.map((v) => -eta * v));
        W.push(p);
        const l = rate.map((r) => (rng.random() < r ? 1 : 0));
        alg += dot(p, l);
        for (let i = 0; i < n; i++) cum[i] += l[i];
      }
      let best = 0;
      for (let i = 1; i < n; i++) if (cum[i] < cum[best]) best = i;
      return { W, reg: alg - cum[best], best };
    };
    w.pythonAction(() => `import numpy as np
from gbcourse.rng import Mulberry32

T, n, eta, seed = ${T}, ${s.n}, ${pyNum(s.eta)}, ${s.seed}
def run(eta):
    rng = Mulberry32(seed)
    rate = [0.3 + 0.4 * i / (n - 1) for i in range(n)]
    cum, alg = np.zeros(n), 0.0
    for t in range(T):
        w = np.exp(-eta * (cum - cum.min()))
        p = w / w.sum()
        l = np.array([float(rng.random() < r) for r in rate])
        alg += p @ l
        cum += l
    return alg - cum.min(), p

reg, p = run(eta)
print(f"сожаление {reg:.2f}, гарантия {np.log(n) / eta + eta * T / 8:.2f}, вес эксперта 0: {p[0]:.3f}")
for e in [0.01, 0.03, 0.1, 0.3, 1, 3]:
    print(f"eta = {e:5}: сожаление {run(e)[0]:7.2f}")
print("теоретический темп:", np.sqrt(8 * np.log(n) / T))`);
    function draw() {
      const { n, eta, seed } = s;
      const R = sim(n, eta, seed);
      const ts = U.range(T, 1);
      const show = [0, 1, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
      plot.render(show.map((i, k) => ({ type: 'line', x: ts, y: R.W.map((p) => p[i]), color: SER[k], width: i === 0 ? 2.6 : 1.6, label: 'эксперт ' + (i + 1) + ' (ошибается в ' + pct(n === 1 ? 0.3 : 0.3 + (0.4 * i) / (n - 1), 0) + ')' })));
      const etas = U.range(31).map((k) => 0.005 * Math.pow(600, k / 30));
      const regs = etas.map((e) => sim(n, e, seed).reg);
      plot2.render([
        { type: 'line', x: etas, y: regs, color: 'model', width: 2.2, label: 'сожаление (это зерно)' },
        { type: 'line', x: etas, y: etas.map((e) => Math.log(n) / e + (e * T) / 8), color: 'ink2', width: 1.4, dash: '5 4', label: 'гарантия ln n / η + ηT/8' },
        { type: 'vline', x: Math.sqrt((8 * Math.log(n)) / T), color: 'tree', width: 1.5, dash: '3 3', text: 'η*' },
        { type: 'points', x: [eta], y: [R.reg], r: 6, color: 'tree' },
      ], { y: [Math.min(0, ...regs), Math.min(160, Math.max(...regs) * 1.3 + 5)] });
      st.set('r', f2(R.reg));
      st.set('b', f2(Math.log(n) / eta + (eta * T) / 8));
      st.set('w', f3(R.W[T - 1][0]));
      note.innerHTML = '<b>Hedge</b> (мультипликативные веса, Литтлстоун и Вармут 1994, Фройнд и Шапире 1997): каждый раунд вес эксперта умножается на e<sup>−η·потеря</sup>. Гарантия сожаления ln n / η + ηT/8 складывается из двух частей: «цены незнания» (сколько раундов нужно, чтобы веса сосредоточились, ∝ 1/η) и «цены дёрганья» (∝ η). Их сумма минимальна при η* = √(8 ln n / T), и тогда сожаление ≤ √(T ln n / 2) — <b>сублинейно</b>: средние потери на раунд догоняют лучшего эксперта. Зависимость от числа экспертов лишь логарифмическая: 1000 экспертов стоят всего в три раза дороже десяти. Реальное сожаление обычно заметно ниже гарантии — она рассчитана на худший случай.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 23. Hedge против Hedge в «камень-ножницы-бумага»
   * ============================================================================== */
  function selfPlayRPS(mode, eta, T, M = RPSM) {
    let L1 = [Math.log(0.6), Math.log(0.25), Math.log(0.15)];
    let L2 = [Math.log(0.2), Math.log(0.5), Math.log(0.3)];
    let u1p = [0, 0, 0];
    let u2p = [0, 0, 0];
    const fixed = [0.5, 0.25, 0.25];
    const cur = [];
    const avg = [];
    const regret = [];
    const ex = [];
    const exAvg = [];
    let sum = [0, 0, 0];
    let sum2 = [0, 0, 0];
    let cumU = [0, 0, 0];
    let got = 0;
    for (let t = 1; t <= T; t++) {
      const p1 = softmax(L1);
      const p2 = mode === 'biased' ? fixed : softmax(L2);
      const u1 = matVec(M, p2);
      const u2 = vecMat(p1, M).map((v) => -v);
      got += dot(p1, u1);
      cumU = cumU.map((v, i) => v + u1[i]);
      sum = sum.map((v, i) => v + p1[i]);
      sum2 = sum2.map((v, i) => v + p2[i]);
      cur.push(p1);
      avg.push(sum.map((v) => v / t));
      regret.push((Math.max(...cumU) - got) / t);
      ex.push(exploit(M, p1, p2));
      exAvg.push(exploit(M, sum.map((v) => v / t), sum2.map((v) => v / t)));
      if (mode === 'opt') {
        L1 = L1.map((v, i) => v + eta * (2 * u1[i] - u1p[i]));
        L2 = L2.map((v, i) => v + eta * (2 * u2[i] - u2p[i]));
      } else {
        L1 = L1.map((v, i) => v + eta * u1[i]);
        if (mode !== 'biased') L2 = L2.map((v, i) => v + eta * u2[i]);
      }
      u1p = u1;
      u2p = u2;
    }
    return { cur, avg, regret, ex, exAvg, pay: got / T };
  }
  GBC.widget('hedge-rps', (el) => {
    const T = 600;
    const s = { mode: 'self', eta: 0.1, t: 600 };
    const w = ui.shell(el, { title: 'Два обучающихся игрока: «камень, ножницы, бумага»', sub: 'Оба игрока используют Hedge. Треугольник — все смешанные стратегии, центр — (⅓, ⅓, ⅓). Серая кривая — текущая стратегия игрока 1, синяя — средняя за прошедшие раунды.' });
    ui.segmented(w.controls, { label: 'Режим', value: s.mode, options: [{ value: 'self', label: 'Hedge ↔ Hedge' }, { value: 'opt', label: 'оптимистичный' }, { value: 'biased', label: 'против любителя камня' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'Темп η', min: 0.02, max: 0.5, step: 0.02, value: s.eta, onInput: (v) => ((s.eta = v), draw()) });
    ui.player(w.controls, { label: 'Раунд', min: 1, max: T, value: T, fps: 40, format: (k) => 't = ' + k, onChange: (k) => ((s.t = k), draw()) });
    const box = H('div', { style: 'max-width:420px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = triPlot(box, 290);
    const ex = new GBC.Plot(w.main, { height: 190, x: { label: 'раунд', domain: [1, T] }, y: { label: 'уязвимость', type: 'log', domain: [1e-3, 3] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'cur', label: 'текущая стратегия' }, { key: 'avg', label: 'средняя стратегия' }, { key: 'reg', label: 'среднее сожаление' }]);
    w.pythonAction(() => `import numpy as np

M = np.array([[0, -1, 1], [1, 0, -1], [-1, 1, 0]])   # камень, бумага, ножницы (выигрыш строки)
T, eta, mode = ${s.t}, ${pyNum(s.eta)}, ${pyStr(s.mode)}
L1, L2 = np.log([0.6, 0.25, 0.15]), np.log([0.2, 0.5, 0.3])
u1p = u2p = np.zeros(3)
avg1, avg2 = np.zeros(3), np.zeros(3)
softmax = lambda L: np.exp(L - L.max()) / np.exp(L - L.max()).sum()
exploit = lambda p, q: (M @ q).max() - (p @ M).min()
for t in range(1, T + 1):
    p1 = softmax(L1)
    p2 = np.array([0.5, 0.25, 0.25]) if mode == "biased" else softmax(L2)
    u1, u2 = M @ p2, -(p1 @ M)
    avg1 += p1
    avg2 += p2
    if mode == "opt":                       # оптимистичный: учитываем прогноз «следующий как прошлый»
        L1, L2 = L1 + eta * (2 * u1 - u1p), L2 + eta * (2 * u2 - u2p)
    else:
        L1 = L1 + eta * u1
        if mode != "biased":
            L2 = L2 + eta * u2
    u1p, u2p = u1, u2
print("последняя стратегия:", p1.round(3), " уязвимость:", round(exploit(p1, p2), 4))
print("средняя стратегия:  ", (avg1 / T).round(3), " уязвимость:", round(exploit(avg1 / T, avg2 / T), 4))`);
    function draw() {
      const R = selfPlayRPS(s.mode, s.eta, T);
      const t = s.t;
      const C = R.cur.slice(0, t).map(tern);
      const A = R.avg.slice(0, t).map(tern);
      plot.render([
        triLayer(),
        { type: 'line', x: C.map((p) => p[0]), y: C.map((p) => p[1]), color: 'muted', width: 1.3, label: 'текущая стратегия', hover: false },
        { type: 'line', x: A.map((p) => p[0]), y: A.map((p) => p[1]), color: 'model', width: 2.5, label: 'средняя стратегия', hover: false },
        { type: 'points', x: [C[t - 1][0]], y: [C[t - 1][1]], color: 'tree', r: 6 },
        { type: 'points', x: [A[t - 1][0]], y: [A[t - 1][1]], color: 'model', r: 6 },
        { type: 'points', x: [0.5], y: [SQ3 / 3], color: 'ink', r: 4, hollow: true },
        triLabels(['камень', 'бумага', 'ножницы']),
      ]);
      const ts = U.range(T, 1);
      ex.render([
        s.mode !== 'biased' ? { type: 'line', x: ts, y: R.ex.map((v) => Math.max(v, 1e-3)), color: 'muted', width: 1.5, label: 'текущих стратегий' } : null,
        s.mode !== 'biased' ? { type: 'line', x: ts, y: R.exAvg.map((v) => Math.max(v, 1e-3)), color: 'model', width: 2.2, label: 'средних стратегий' } : { type: 'line', x: ts, y: R.regret.map((v) => Math.max(Math.abs(v), 1e-3)), color: 'model', width: 2.2, label: '|среднее сожаление|' },
        { type: 'vline', x: t, color: 'ink2', dash: '4 4', width: 1 },
      ]);
      const fv = (p) => p.map((v) => U.fmt(v, 2)).join(' / ');
      st.set('cur', fv(R.cur[t - 1]));
      st.set('avg', fv(R.avg[t - 1]));
      st.set('reg', U.fmt(R.regret[t - 1], 3));
      const texts = {
        self: 'Текущие стратегии <b>раскручиваются по спирали</b> к краям треугольника: игроки гоняются друг за другом (больше камня → соперник больше бумаги → больше ножниц…). Последняя стратегия не сходится, а <b>средняя</b> — сходится к равновесию (⅓, ⅓, ⅓): её уязвимость падает. Это общий факт: если оба игрока в игре с нулевой суммой имеют малое среднее сожаление, их средние стратегии — приближённое равновесие. Отсюда ещё одно доказательство теоремы о минимаксе.',
        opt: '<b>Оптимистичный Hedge</b> делает шаг по 2u<sub>t</sub> − u<sub>t−1</sub>: «предсказывает», что выигрыши в следующем раунде будут как в последнем, и корректирует запаздывание. Теперь сходится и <b>последняя</b> стратегия — спираль закручивается внутрь, уязвимость текущих стратегий падает к нулю: при η = 0.1 медленно (к 600-му раунду около 0.26), при η = 0.3 — почти до нуля уже к 300-му раунду. Тот же приём (экстраградиент, оптимистичный градиент) стабилизирует обучение генеративно-состязательных сетей (шаг 26).',
        biased: 'Соперник слишком часто бросает камень (50 %). Hedge быстро переходит на бумагу, и средний выигрыш стремится к 0.25 за раунд — к лучшему, что можно было получить против такого соперника. Обучающийся алгоритм <b>использует слабости</b> соперника, а против сильного — не проигрывает больше сожаления.',
      };
      note.innerHTML = texts[s.mode] + ' <b>Уязвимость</b> (exploitability) — сколько выиграли бы лучшие ответы на пару стратегий: max<sub>i</sub>(Mq)<sub>i</sub> − min<sub>j</sub>(pM)<sub>j</sub>; в равновесии она равна 0.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 24. Самоигра: фиктивная игра, Hedge, сопоставление сожалений
   * ============================================================================== */
  function selfPlay(M, method, T) {
    const m = M.length;
    const n = M[0].length;
    // старт не из равновесия: вероятности ∝ 1, 2, …, m у игрока 1 и ∝ n, …, 1 у игрока 2
    let x = U.range(m, 1).map((v) => (2 * v) / (m * (m + 1)));
    let y = U.range(n).map((j) => (2 * (n - j)) / (n * (n + 1)));
    const s1 = new Array(m).fill(0);
    const s2 = new Array(n).fill(0);
    let R1 = new Array(m).fill(0);
    let R2 = new Array(n).fill(0);
    let L1 = x.map(Math.log);
    let L2 = y.map(Math.log);
    let u1p = new Array(m).fill(0);
    let u2p = new Array(n).fill(0);
    let wsum = 0;
    const eta = method === 'opt' ? 0.1 : Math.sqrt((8 * Math.log(Math.max(m, n))) / T);
    const out = [];
    const c1 = new Array(m).fill(0);
    const c2 = new Array(n).fill(0);
    let fi = m - 1;
    let fj = 0;
    for (let t = 1; t <= T; t++) {
      if (method === 'fp') {
        x = U.range(m).map((i) => (i === fi ? 1 : 0));
        y = U.range(n).map((j) => (j === fj ? 1 : 0));
      }
      const u1 = matVec(M, y);
      const u2 = vecMat(x, M).map((v) => -v);
      const wt = method === 'rmp' ? t : 1;
      wsum += wt;
      for (let i = 0; i < m; i++) s1[i] += wt * x[i];
      for (let j = 0; j < n; j++) s2[j] += wt * y[j];
      if (t === 1 || t % 5 === 0 || t === T) out.push({ t, e: exploit(M, s1.map((v) => v / wsum), s2.map((v) => v / wsum)) });
      if (method === 'fp') {
        for (let i = 0; i < m; i++) c1[i] += x[i];
        for (let j = 0; j < n; j++) c2[j] += y[j];
        const a = matVec(M, c2);
        const b = vecMat(c1, M);
        fi = 0;
        for (let i = 1; i < m; i++) if (a[i] > a[fi] + 1e-12) fi = i;
        fj = 0;
        for (let j = 1; j < n; j++) if (b[j] < b[fj] - 1e-12) fj = j;
      } else if (method === 'hedge' || method === 'opt') {
        const k = method === 'opt' ? 2 : 1;
        L1 = L1.map((v, i) => v + eta * (k * u1[i] - (k - 1) * u1p[i]));
        L2 = L2.map((v, j) => v + eta * (k * u2[j] - (k - 1) * u2p[j]));
        x = softmax(L1);
        y = softmax(L2);
      } else {
        const v1 = dot(x, u1);
        const v2 = dot(y, u2);
        R1 = R1.map((r, i) => (method === 'rmp' ? Math.max(0, r + u1[i] - v1) : r + u1[i] - v1));
        R2 = R2.map((r, j) => (method === 'rmp' ? Math.max(0, r + u2[j] - v2) : r + u2[j] - v2));
        const pos = (R) => {
          const p = R.map((r) => Math.max(0, r));
          const z = U.sum(p);
          return z > 0 ? p.map((v) => v / z) : R.map(() => 1 / R.length);
        };
        x = pos(R1);
        y = pos(R2);
      }
      u1p = u1;
      u2p = u2;
    }
    return out;
  }
  const METHODS = [
    { key: 'fp', label: 'фиктивная игра', color: 'muted' },
    { key: 'hedge', label: 'Hedge', color: 'blue' },
    { key: 'opt', label: 'оптимистичный Hedge', color: 'aqua' },
    { key: 'rm', label: 'сопоставление сожалений', color: 'orange' },
    { key: 'rmp', label: 'сопоставление сожалений +', color: 'red' },
  ];
  GBC.widget('self-play-race', (el) => {
    const T = 2000;
    const s = { g: 'blotto' };
    const w = ui.shell(el, { title: 'Гонка алгоритмов самоигры', sub: 'Каждый алгоритм играет сам с собой; после t раундов берём средние стратегии и меряем их уязвимость — насколько их можно обыграть. Масштаб обеих осей логарифмический.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: ['rps2', 'rpsls', 'hide', 'blotto'].map((k) => ({ value: k, label: ZS[k].label })), onChange: (v) => ((s.g = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'раунд t', type: 'log', domain: [1, T] }, y: { label: 'уязвимость средних стратегий', type: 'log', domain: [1e-4, 3] } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'best', label: 'лучший к t = 2000' }, { key: 'rm', label: 'сопоставление сожалений +' }, { key: 'fp', label: 'фиктивная игра' }]);
    w.pythonAction(() => `import numpy as np

M = np.array(${pyMat(ZS[s.g].M)}, float)
T = ${T}
m, n = M.shape
exploit = lambda p, q: (M @ q).max() - (p @ M).min()

def regret_matching(plus):
    R1, R2 = np.zeros(m), np.zeros(n)
    x = np.arange(1, m + 1) / (m * (m + 1) / 2)       # старт не из равновесия
    y = np.arange(n, 0, -1) / (n * (n + 1) / 2)
    s1, s2, W = np.zeros(m), np.zeros(n), 0.0
    for t in range(1, T + 1):
        u1, u2 = M @ y, -(x @ M)
        w = t if plus else 1            # «плюс»: веса растут линейно, сожаления не уходят в минус
        s1, s2, W = s1 + w * x, s2 + w * y, W + w
        R1 = R1 + u1 - x @ u1
        R2 = R2 + u2 - y @ u2
        if plus:
            R1, R2 = np.maximum(R1, 0), np.maximum(R2, 0)
        pos = lambda R: np.maximum(R, 0) / np.maximum(R, 0).sum() if np.maximum(R, 0).sum() > 0 else np.ones(len(R)) / len(R)
        x, y = pos(R1), pos(R2)
    return exploit(s1 / W, s2 / W)

print("сопоставление сожалений:   ", round(regret_matching(False), 5))
print("сопоставление сожалений +: ", round(regret_matching(True), 5))`);
    function draw() {
      const M = ZS[s.g].M;
      const res = METHODS.map((mt) => ({ ...mt, r: selfPlay(M, mt.key, T) }));
      plot.render(res.map((o) => ({ type: 'line', x: o.r.map((d) => d.t), y: o.r.map((d) => Math.max(d.e, 1e-4)), color: o.color, width: o.key === 'rmp' ? 2.6 : 2, label: o.label })), { y: [Math.max(1e-4, 0.5 * Math.min(...res.flatMap((o) => o.r.map((d) => d.e)).filter((e) => e > 0))), 3] });
      const fin = res.map((o) => o.r[o.r.length - 1].e);
      let b = 0;
      fin.forEach((v, i) => v < fin[b] && (b = i));
      tbl.textContent = '';
      const sig = (v) => (v === 0 ? '0' : minus(String(Number(v.toPrecision(2)))));
      rowTable(tbl, ['алгоритм', 'уязвимость при t = 100', 't = 2000'], res.map((o) => [o.label, sig(o.r.find((d) => d.t >= 100).e), sig(o.r[o.r.length - 1].e)]), (i) => i === b, false);
      st.set('best', res[b].label);
      st.set('rm', sig(fin[4]));
      st.set('fp', sig(fin[0]));
      note.innerHTML = 'Все алгоритмы стартуют не из равновесия. Фиктивная игра (шаг 19) медленнее всех. <b>Сопоставление сожалений</b> (regret matching, Харт и Мас-Колелл, 2000): играть каждый ход с вероятностью, пропорциональной его накопленному положительному сожалению — «насколько больше я получил бы, всегда играя его». Никаких темпов и экспонент. Его вариант с обнулением отрицательных сожалений и взвешенным средним (<b>«плюс»</b>, Таммелин, 2014) и оптимистичный Hedge обычно впереди; какой из них лучше, зависит от игры. Применённое к каждой «информационной ситуации» в игре с неполной информацией, оно даёт метод <b>CFR</b> (минимизация контрфактического сожаления): им решён покер «один на один» с лимитом (2015), и на нём построены Libratus (2017) и Pluribus (2019), обыгравшие профессионалов. Простые итерации без сожаления масштабируются на огромные игры, где симплекс-метод бессилен.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 25. Эволюционные игры: репликаторная динамика
   * ============================================================================== */
  const IPD10 = [[30, 0, 30], [50, 10, 14], [30, 9, 30]];
  GBC.widget('replicator', (el) => {
    const s = { g: 'rps', eps: 0, x0: [0.5, 0.3, 0.2] };
    const w = ui.shell(el, { title: 'Эволюция стратегий: репликаторная динамика', sub: 'Популяция играет случайными парами; доля стратегии растёт, если её средний выигрыш выше среднего по популяции: ẋᵢ = xᵢ((Ax)ᵢ − xᵀAx). Стрелки — направление изменения долей. Щёлкните, чтобы выбрать начальный состав.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: [{ value: 'rps', label: 'КНБ с выигрышем ε за ничью' }, { value: 'coord', label: 'Координация 3×3' }, { value: 'ipd', label: 'Дилемма ×10: С, П, око за око' }], onChange: (v) => ((s.g = v), draw()) });
    const eSl = ui.slider(w.controls, { label: 'ε — выигрыш за ничью', min: -0.5, max: 0.5, step: 0.05, value: s.eps, onInput: (v) => ((s.eps = v), draw()) });
    const box = H('div', { style: 'max-width:440px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = triPlot(box, 320);
    plot.onClick = (x, y) => {
      const p = untern(x, y);
      if (p.every((v) => v >= -1e-9)) (s.x0 = p.map((v) => Math.max(v, 1e-4))), draw();
    };
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x0', label: 'старт' }, { key: 'x1', label: 'через t = 60' }, { key: 'f', label: 'средний выигрыш' }]);
    const game = () => {
      if (s.g === 'rps') return { A: RPSM.map((r, i) => r.map((v, j) => (i === j ? s.eps : v))), names: ['камень', 'бумага', 'ножницы'] };
      if (s.g === 'coord') return { A: [[3, 0, 0], [0, 2, 0], [0, 0, 1]], names: ['A (3)', 'B (2)', 'C (1)'] };
      return { A: IPD10, names: ['всегда С', 'всегда П', 'око за око'] };
    };
    const field = (A, x) => {
      const f = matVec(A, x);
      const fb = dot(x, f);
      return x.map((v, i) => v * (f[i] - fb));
    };
    const integrate = (A, x0, Tm, dt) => {
      let x = x0.slice();
      const path = [x];
      for (let t = 0; t < Tm / dt; t++) {
        const k1 = field(A, x);
        const k2 = field(A, x.map((v, i) => v + (dt / 2) * k1[i]));
        const k3 = field(A, x.map((v, i) => v + (dt / 2) * k2[i]));
        const k4 = field(A, x.map((v, i) => v + dt * k3[i]));
        x = x.map((v, i) => Math.max(0, v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])));
        const z = U.sum(x);
        x = x.map((v) => v / z);
        path.push(x);
      }
      return path;
    };
    w.pythonAction(() => {
      const g = game();
      return `import numpy as np
from scipy.integrate import solve_ivp

A = np.array(${pyMat(g.A)}, float)
def replicator(t, x):
    f = A @ x
    return x * (f - x @ f)
sol = solve_ivp(replicator, (0, 60), ${pyVec(s.x0.map((v) => +v.toFixed(4)))}, rtol=1e-9, atol=1e-12, dense_output=True)
for t in [0, 10, 20, 40, 60]:
    x = sol.sol(t)
    print(f"t = {t:2}: доли {np.round(x / x.sum(), 4)}, средний выигрыш {x @ A @ x:.4f}")`;
    });
    function draw() {
      eSl.el.style.display = s.g === 'rps' ? '' : 'none';
      const { A, names } = game();
      const scale = s.g === 'ipd' ? 0.02 : 1;
      const path = integrate(A, s.x0, 60, s.g === 'ipd' ? 0.02 : 0.05);
      const ar = { x1: [], y1: [], x2: [], y2: [] };
      const K = 12;
      for (let a = 1; a < K; a++)
        for (let b = 1; a + b < K; b++) {
          const x = [a / K, b / K, 1 - (a + b) / K];
          const d = field(A, x).map((v) => v * scale);
          const p0 = tern(x);
          const p1 = tern(x.map((v, i) => v + d[i]));
          const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
          if (len < 1e-9) continue;
          const k = 0.045 / Math.max(len, 0.015);
          ar.x1.push(p0[0]);
          ar.y1.push(p0[1]);
          ar.x2.push(p0[0] + (p1[0] - p0[0]) * Math.min(k, 4));
          ar.y2.push(p0[1] + (p1[1] - p0[1]) * Math.min(k, 4));
        }
      const P = path.map(tern);
      plot.render([
        triLayer(),
        { type: 'arrows', ...ar, color: 'ink2', width: 1.1, opacity: 0.55 },
        { type: 'line', x: P.map((p) => p[0]), y: P.map((p) => p[1]), color: 'tree', width: 2.4, label: 'траектория', hover: false },
        { type: 'points', x: [P[0][0]], y: [P[0][1]], r: 5, color: 'tree', label: 'старт' },
        { type: 'points', x: [P[P.length - 1][0]], y: [P[P.length - 1][1]], r: 6, hollow: true, color: 'tree', label: 'через t = 60' },
        triLabels(names),
      ]);
      const end = path[path.length - 1];
      const fv = (p) => p.map((v) => U.fmt(v, 2)).join(' / ');
      st.set('x0', fv(s.x0));
      st.set('x1', fv(end));
      const fb = dot(end, matVec(A, end));
      st.set('f', f3(Math.abs(fb) < 1e-9 ? 0 : fb));
      const texts = {
        rps: s.eps === 0 ? 'При ε = 0 доли <b>вечно кружат</b> по замкнутым орбитам вокруг центра: в игре с нулевой суммой сохраняется величина x₁x₂x₃. ' : s.eps < 0 ? 'При ε < 0 (ничья наказуема) траектория <b>закручивается к центру</b>: смешанное равновесие (⅓, ⅓, ⅓) устойчиво — быть «как все» невыгодно, и редкие стратегии подтягиваются. ' : 'При ε > 0 (ничья выгодна) встречаться с «такими же» полезно, и траектория <b>раскручивается к краям</b>: популяция по очереди почти целиком состоит из одной стратегии. Похожие циклы наблюдали у ящериц Uta stansburiana, где три окраски самцов сменяют друг друга. ',
        coord: 'Три устойчивых угла — три соглашения; к какому придёт популяция, решает начальный состав. Смешанные равновесия на рёбрах и в центре неустойчивы — это границы областей притяжения. ',
        ipd: 'Дилемма из 10 раундов (выигрыши 3/0/5/1 за раунд). «Око за око» не даёт себя эксплуатировать дважды, поэтому при достаточной доле вытесняет «всегда предавать»; но среди «око за око» безнаказанно дрейфуют «всегда сотрудничать» — а они кормят предателей. ',
      };
      note.innerHTML = '<b>Эволюционная теория игр</b> (Мейнард Смит и Прайс, 1973) обходится без рациональности: стратегии наследуются, а «прибыль» — это число потомков. Неподвижные точки репликаторной динамики — равновесия Нэша (и «чистые» вершины), а устойчивые к вторжению мутантов стратегии называют <b>эволюционно стабильными</b>. ' + texts[s.g] + 'В шаге 6 доля сотрудничающих S/(S + T − 1) в игре «ястреб и голубь» — тоже устойчивая точка такой динамики.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 26. Градиентный спуск-подъём и состязательные сети
   * ============================================================================== */
  GBC.widget('gda', (el) => {
    const s = { eta: 0.2, lam: 0, z0: [1.5, 1], K: 60 };
    const w = ui.shell(el, { title: 'Минимакс градиентами: f(x, y) = x·y + λ(x² − y²)/2', sub: 'Игрок x минимизирует f, игрок y максимизирует; равновесие — (0, 0). Сравните четыре способа делать шаги. Стрелки — направление (−∂f/∂x, +∂f/∂y): при λ = 0 это чистое вращение. Щёлкните, чтобы выбрать старт.' });
    ui.slider(w.controls, { label: 'Шаг η', min: 0.02, max: 0.8, step: 0.02, value: s.eta, onInput: (v) => ((s.eta = v), draw()) });
    ui.slider(w.controls, { label: 'λ (сильная выпуклость-вогнутость)', min: 0, max: 1, step: 0.05, value: s.lam, onInput: (v) => ((s.lam = v), draw()) });
    ui.slider(w.controls, { label: 'Шагов', min: 10, max: 200, step: 10, value: s.K, format: String, onInput: (v) => ((s.K = v), draw()) });
    const box = H('div', { style: 'max-width:440px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 330, equal: true, x: { label: 'x (минимизирует)', domain: [-3, 3] }, y: { label: 'y (максимизирует)', domain: [-3, 3] }, onClick: (x, y) => ((s.z0 = [x, y]), draw()) });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sim', label: 'одновременный: расстояние' }, { key: 'alt', label: 'поочерёдный' }, { key: 'eg', label: 'экстраградиент / оптимистичный' }]);
    w.pythonAction(() => `import numpy as np

eta, lam, K = ${pyNum(s.eta)}, ${pyNum(s.lam)}, ${s.K}
gx = lambda x, y: y + lam * x          # ∂f/∂x
gy = lambda x, y: x - lam * y          # ∂f/∂y
def run(method, z=${pyVec(s.z0.map((v) => +v.toFixed(3)))}):
    x, y = z
    px, py = gx(x, y), gy(x, y)
    for _ in range(K):
        if method == "одновременный":
            x, y = x - eta * gx(x, y), y + eta * gy(x, y)
        elif method == "поочерёдный":
            x = x - eta * gx(x, y)
            y = y + eta * gy(x, y)
        elif method == "экстраградиент":
            xh, yh = x - eta * gx(x, y), y + eta * gy(x, y)      # пробный шаг
            x, y = x - eta * gx(xh, yh), y + eta * gy(xh, yh)
        else:                                                # оптимистичный
            cx, cy = gx(x, y), gy(x, y)
            x, y = x - eta * (2 * cx - px), y + eta * (2 * cy - py)
            px, py = cx, cy
    return np.hypot(x, y)
for m in ["одновременный", "поочерёдный", "экстраградиент", "оптимистичный"]:
    print(f"{m:15}: расстояние до равновесия после {K} шагов = {run(m):.4g}")`);
    function draw() {
      const { eta, lam, K } = s;
      const gx = (x, y) => y + lam * x;
      const gy = (x, y) => x - lam * y;
      const run = (method) => {
        let [x, y] = s.z0;
        let px = gx(x, y);
        let py = gy(x, y);
        const P = { x: [x], y: [y] };
        for (let k = 0; k < K; k++) {
          if (method === 'sim') [x, y] = [x - eta * gx(x, y), y + eta * gy(x, y)];
          else if (method === 'alt') {
            x = x - eta * gx(x, y);
            y = y + eta * gy(x, y);
          } else if (method === 'eg') {
            const xh = x - eta * gx(x, y);
            const yh = y + eta * gy(x, y);
            [x, y] = [x - eta * gx(xh, yh), y + eta * gy(xh, yh)];
          } else {
            const cx = gx(x, y);
            const cy = gy(x, y);
            [x, y] = [x - eta * (2 * cx - px), y + eta * (2 * cy - py)];
            px = cx;
            py = cy;
          }
          if (Math.abs(x) > 1e6 || Math.abs(y) > 1e6) break;
          P.x.push(x);
          P.y.push(y);
        }
        return P;
      };
      const R = { sim: run('sim'), alt: run('alt'), eg: run('eg'), opt: run('opt') };
      const clip = (P) => {
        const x = [];
        const y = [];
        for (let i = 0; i < P.x.length; i++) {
          if (Math.abs(P.x[i]) > 6 || Math.abs(P.y[i]) > 6) break;
          x.push(P.x[i]);
          y.push(P.y[i]);
        }
        return { x, y };
      };
      const ar = { x1: [], y1: [], x2: [], y2: [] };
      for (let i = -3; i <= 3; i += 0.75)
        for (let j = -3; j <= 3; j += 0.75) {
          if (Math.abs(i) < 1e-9 && Math.abs(j) < 1e-9) continue;
          const dx = -gx(i, j);
          const dy = gy(i, j);
          const L0 = Math.hypot(dx, dy);
          ar.x1.push(i);
          ar.y1.push(j);
          ar.x2.push(i + (0.32 * dx) / L0);
          ar.y2.push(j + (0.32 * dy) / L0);
        }
      plot.render([
        { type: 'arrows', ...ar, color: 'muted', width: 1, opacity: 0.5 },
        { type: 'line', ...clip(R.sim), color: 'critical', width: 2, label: 'одновременный', hover: false },
        { type: 'line', ...clip(R.alt), color: 'orange', width: 2, label: 'поочерёдный', hover: false },
        { type: 'line', ...clip(R.eg), color: 'model', width: 2.4, label: 'экстраградиент', hover: false },
        { type: 'line', ...clip(R.opt), color: 'aqua', width: 2, dash: '6 4', label: 'оптимистичный', hover: false },
        { type: 'points', x: [s.z0[0]], y: [s.z0[1]], r: 5, color: 'ink' },
        { type: 'points', x: [0], y: [0], r: 6, hollow: true, color: 'ink' },
      ], { x: [-3, 3], y: [-3, 3] });
      const d = (P) => {
        const k = P.x.length - 1;
        return U.fmt(Math.hypot(P.x[k], P.y[k]), 3) + (P.x.length < K + 1 ? ' (ушёл)' : '');
      };
      st.set('sim', d(R.sim));
      st.set('alt', d(R.alt));
      st.set('eg', d(R.eg) + ' / ' + d(R.opt));
      note.innerHTML = 'Градиентный спуск для минимизации (урок 15.15) в игре ломается. При λ = 0 поле градиентов — <b>вращение</b> вокруг равновесия: одновременный шаг увеличивает расстояние в √(1 + η²) раз — траектория уходит по спирали наружу. Поочерёдный шаг ходит по замкнутой кривой, не приближаясь. <b>Экстраградиент</b> (Корпелевич, 1976) сначала делает пробный шаг и берёт градиент оттуда, <b>оптимистичный</b> шаг вычитает прошлый градиент — оба сходятся к равновесию. Так устроено обучение генеративно-состязательных сетей (GAN, Гудфеллоу и др., 2014): генератор и дискриминатор играют в min<sub>G</sub> max<sub>D</sub>, и их классическая нестабильность — то самое вращение. Регуляризация (λ > 0) делает задачу сильно выпукло-вогнутой, и тогда сходится даже одновременный шаг при малом η.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 27. Дерево игры и обратная индукция
   * ============================================================================== */
  const TREES = {
    entry: {
      label: 'Вход на рынок',
      players: ['Новичок', 'Монополист'],
      root: { pl: 0, ch: [['не входить', { pay: [0, 10] }], ['войти', { pl: 1, ch: [['ценовая война', { pay: [-2, 2] }], ['поделить рынок', { pay: [3, 5] }]] }]] },
      text: 'Угроза монополиста «войдёшь — устрою ценовую войну» <b>недостоверна</b>: если новичок уже вошёл, война принесёт монополисту 2 вместо 5. Обратная индукция отбрасывает её: новичок входит, рынок делят (3, 5). При этом в таблице нормальной формы есть и второе равновесие Нэша — (не входить, война): пока новичок не входит, угроза «ничего не стоит». Обратная индукция оставляет только <b>совершенное в подыграх</b> равновесие (Зельтен, 1965) — разумное в каждой точке дерева.',
    },
    ult: {
      label: 'Ультиматум (5 монет)',
      players: ['Предлагающий', 'Отвечающий'],
      root: { pl: 0, ch: [1, 2, 3, 4].map((k) => ['дать ' + k, { pl: 1, ch: [['да', { pay: [5 - k, k] }], ['нет', { pay: [0, 0] }]] }]) },
      text: 'Отвечающему выгодно согласиться на любую положительную долю (k > 0), поэтому предлагающий даёт минимум — 1 из 5. В экспериментах так почти никто не делает: предлагают 40–50 %, а предложения меньше 20 % часто отвергают, «наказывая» за несправедливость себе в убыток. Теория предсказывает поведение эгоистов, знающих, что все вокруг эгоисты; поведенческая теория игр добавляет в выигрыши справедливость и доверие.',
    },
    cent: {
      label: 'Сороконожка',
      players: ['Игрок 1', 'Игрок 2'],
      root: (() => {
        const pays = [[1, 0], [0, 2], [3, 1], [2, 4], [5, 3], [4, 6]];
        let node = { pay: [6, 5] };
        for (let k = 5; k >= 0; k--) node = { pl: k % 2, ch: [['взять', { pay: pays[k] }], ['передать', node]] };
        return node;
      })(),
      text: 'Каждый может «взять» (забрать большую часть кучки) или «передать» ход — тогда кучка растёт. Последний ходящий берёт; зная это, предпоследний берёт раньше… и обратная индукция доходит до корня: игрок 1 берёт сразу, (1, 0), хотя оба могли бы получить (6, 5). Чем длиннее цепочка рассуждений, тем меньше ей следуют люди: в экспериментах до конца доходит меньшинство, а сразу берут редко.',
    },
  };
  function layoutTree(root) {
    const nodes = [];
    let leaf = 0;
    const rec = (nd, depth, parent, action) => {
      const me = { nd, depth, parent, action, id: nodes.length, kids: [] };
      nodes.push(me);
      if (nd.ch) {
        nd.ch.forEach(([a, c]) => me.kids.push(rec(c, depth + 1, me, a)));
        me.x = U.mean(me.kids.map((k) => k.x));
      } else me.x = leaf++;
      return me;
    };
    rec(root, 0, null, null);
    return { nodes, leaves: leaf, depth: Math.max(...nodes.map((n) => n.depth)) };
  }
  function backward(nodes) {
    const order = [];
    const val = new Map();
    const choice = new Map();
    const go = (me) => {
      if (!me.nd.ch) {
        val.set(me.id, me.nd.pay);
        return;
      }
      me.kids.forEach(go);
      let best = 0;
      me.kids.forEach((k, i) => {
        if (val.get(k.id)[me.nd.pl] > val.get(me.kids[best].id)[me.nd.pl] + 1e-12) best = i;
      });
      val.set(me.id, val.get(me.kids[best].id));
      choice.set(me.id, best);
      order.push(me.id);
    };
    go(nodes[0]);
    return { order, val, choice };
  }
  GBC.widget('game-tree', (el) => {
    const s = { g: 'entry', k: 0 };
    const w = ui.shell(el, { title: 'Обратная индукция: решаем дерево игры с листьев', sub: 'Ходы делаются по очереди; в листьях — выигрыши (первого, второго). Начинаем с узлов, ведущих только к листьям: ходящий выбирает лучшее для себя, и узел заменяется этим исходом. Проиграйте шаги.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: Object.keys(TREES).map((k) => ({ value: k, label: TREES[k].label })), onChange: (v) => ((s.g = v), rebuild()) });
    const pl = ui.player(w.controls, { label: 'Решено узлов', min: 0, max: 1, value: 0, fps: 1, format: (k, mx) => k + ' из ' + mx, onChange: (k) => ((s.k = k), draw()) });
    w.controls.appendChild(legendRow([[P1, 'ход игрока 1', 'line'], [P2, 'ход игрока 2', 'line']]));
    const host = H('div');
    w.main.appendChild(host);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'path', label: 'путь равновесия' }, { key: 'res', label: 'итог' }, { key: 'best', label: 'лучший для суммы исход' }]);
    let T = null;
    let B = null;
    w.pythonAction(() => {
      const ser = (nd) => (nd.ch ? '(' + nd.pl + ', [' + nd.ch.map(([a, c]) => '(' + pyStr(a) + ', ' + ser(c) + ')').join(', ') + '])' : pyVec(nd.pay));
      return `# узел: (кто ходит, [(действие, поддерево), ...]); лист: [выигрыш 1, выигрыш 2]
tree = ${ser(TREES[s.g].root)}

def solve(node, path=()):
    if isinstance(node, list):                 # лист
        return node, path
    player, moves = node
    best = None
    for action, child in moves:
        pay, p = solve(child, path + (action,))
        if best is None or pay[player] > best[0][player]:
            best = (pay, p)
    return best

pay, path = solve(tree)
print("совершенное в подыграх равновесие: путь", " → ".join(path), " выигрыши", pay)`;
    });
    function rebuild() {
      T = layoutTree(TREES[s.g].root);
      B = backward(T.nodes);
      pl.setMax(B.order.length);
      pl.set(0);
      s.k = 0;
      draw();
    }
    function draw() {
      const g = TREES[s.g];
      const solved = new Set(B.order.slice(0, s.k));
      const W = Math.max(420, T.leaves * 78);
      const Hh = (T.depth + 1) * 78 + 30;
      const X = (x) => 40 + ((x + 0.5) * (W - 80)) / T.leaves;
      const Y = (d) => 30 + d * 78;
      const svg = S('svg', { viewBox: '0 0 ' + W + ' ' + Hh, style: 'display:block;width:100%;height:auto;max-width:' + Math.round(W * 1.15) + 'px;min-width:' + Math.min(W, 640) + 'px;margin:0 auto' });
      T.nodes.forEach((me) => {
        if (!me.parent) return;
        const par = me.parent;
        const idx = par.kids.indexOf(me);
        const chosen = solved.has(par.id) && B.choice.get(par.id) === idx;
        const c = par.nd.pl === 0 ? P1 : P2;
        svg.appendChild(S('line', { x1: X(par.x), y1: Y(par.depth), x2: X(me.x), y2: Y(me.depth), style: 'stroke:' + (chosen ? c : 'var(--border-strong)') + ';stroke-width:' + (chosen ? 4 : 1.5) + (solved.has(par.id) && !chosen ? ';stroke-dasharray:4 4;opacity:.6' : '') }));
        const mx = (X(par.x) + X(me.x)) / 2;
        const my = (Y(par.depth) + Y(me.depth)) / 2;
        svg.appendChild(sText(mx + (X(me.x) < X(par.x) ? -6 : 6), my - 4, me.action, { size: 11, anchor: X(me.x) < X(par.x) ? 'end' : X(me.x) > X(par.x) ? 'start' : 'middle', color: chosen ? 'var(--ink)' : 'var(--ink-2)', bold: chosen }));
      });
      T.nodes.forEach((me) => {
        const x = X(me.x);
        const y = Y(me.depth);
        if (me.nd.ch) {
          const c = me.nd.pl === 0 ? P1 : P2;
          svg.appendChild(S('circle', { cx: x, cy: y, r: 15, style: 'fill:' + (solved.has(me.id) ? tint(c, 35) : 'var(--surface)') + ';stroke:' + c + ';stroke-width:2.5' }));
          svg.appendChild(sText(x, y, String(me.nd.pl + 1), { bold: true, size: 13 }));
          if (solved.has(me.id)) {
            const v = B.val.get(me.id);
            svg.appendChild(sText(x + 20, y - 14, '(' + v.map((q) => minus(String(q))).join(', ') + ')', { size: 11, anchor: 'start', bold: true, color: 'var(--good-text)' }));
          }
        } else {
          svg.appendChild(S('rect', { x: x - 28, y: y - 13, width: 56, height: 26, rx: 6, style: 'fill:var(--surface-2);stroke:var(--border-strong)' }));
          svg.appendChild(sText(x, y, '(' + me.nd.pay.map((q) => minus(String(q))).join(', ') + ')', { size: 12, mono: true }));
        }
      });
      host.textContent = '';
      const box = scrollBox();
      box.appendChild(svg);
      host.appendChild(box);
      const path = [];
      let me = T.nodes[0];
      while (me.nd.ch) {
        const k = B.choice.get(me.id);
        path.push(me.kids[k].action);
        me = me.kids[k];
      }
      let best = null;
      T.nodes.forEach((n) => !n.nd.ch && (!best || n.nd.pay[0] + n.nd.pay[1] > best[0] + best[1]) && (best = n.nd.pay));
      const done = s.k === B.order.length;
      st.set('path', done ? path.join(' → ') : '…');
      st.set('res', done ? '(' + B.val.get(0).map((q) => minus(String(q))).join(', ') + ')' : '…');
      st.set('best', '(' + best.map((q) => minus(String(q))).join(', ') + ')');
      note.innerHTML = '<b>Обратная индукция</b> — минимакс на дереве: решаем игру с конца, на каждом узле считая, что дальше все поступят наилучшим для себя образом. По <b>теореме Цермело</b> (1913) любая конечная игра с полной информацией (шашки, шахматы, го) решается так: у одного из игроков есть стратегия, гарантирующая победу, или оба могут гарантировать ничью. ' + g.text;
    }
    rebuild();
  });

  /* ==============================================================================
   * Шаг 28. Ним: выигрышные и проигрышные позиции
   * ============================================================================== */
  GBC.widget('nim', (el) => {
    const s = { heaps: [3, 4, 5], init: [3, 4, 5], turn: 0, log: [], first: 'you' };
    const w = ui.shell(el, { title: 'Ним: сыграйте с компьютером', sub: 'Три кучки камней. За ход можно взять сколько угодно камней (хотя бы один) из одной кучки. Кто берёт последний камень — выигрывает. Щёлкните по камню: возьмёте его и все камни правее в этой кучке.' });
    const sls = [0, 1, 2].map((k) => ui.slider(w.controls, { label: 'Кучка ' + (k + 1), min: 1, max: 9, step: 1, value: s.init[k], format: String, onInput: (v) => ((s.init[k] = v), reset()) }));
    void sls;
    ui.segmented(w.controls, { label: 'Первым ходит', value: s.first, options: [{ value: 'you', label: 'вы' }, { value: 'pc', label: 'компьютер' }], onChange: (v) => ((s.first = v), reset()) });
    ui.button(w.controls, { label: 'Начать заново', icon: 'reset', small: true, onClick: () => reset() });
    const board = H('div', { style: 'display:flex;flex-direction:column;gap:8px;margin:6px 0' });
    const bin = H('div');
    const logEl = monoBox();
    w.main.append(board, bin, logEl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'ним-сумма (XOR)' }, { key: 'pos', label: 'позиция для ходящего' }, { key: 'turn', label: 'ход' }]);
    const xor = (h) => h.reduce((a, b) => a ^ b, 0);
    const pcMove = () => {
      const h = s.heaps;
      const x = xor(h);
      let k = -1;
      let take = 1;
      if (x) {
        k = h.findIndex((v) => (v ^ x) < v);
        take = h[k] - (h[k] ^ x);
      } else {
        k = h.indexOf(Math.max(...h));
        take = 1;
      }
      h[k] -= take;
      s.log.push('компьютер: из кучки ' + (k + 1) + ' взял ' + take + ' → ' + h.join(', '));
      s.turn = 0;
    };
    const reset = () => {
      s.heaps = s.init.slice();
      s.log = [];
      s.turn = s.first === 'you' ? 0 : 1;
      if (s.turn === 1) pcMove();
      draw();
    };
    w.pythonAction(() => `from functools import reduce

heaps = ${pyVec(s.heaps)}
x = reduce(lambda a, b: a ^ b, heaps)
print("кучки:", heaps, " в двоичной:", [format(h, "04b") for h in heaps], " XOR =", x)
if x == 0:
    print("позиция проигрышная для ходящего: любой ход делает XOR ненулевым")
else:
    for k, h in enumerate(heaps):
        if h ^ x < h:
            print(f"выигрывающий ход: в кучке {k + 1} оставить {h ^ x} (взять {h - (h ^ x)})")

# проверка перебором: позиция проигрышная ⇔ XOR = 0
from functools import lru_cache
@lru_cache(None)
def win(state):
    return any(not win(tuple(sorted(state[:i] + (v,) + state[i + 1:])))
               for i, h in enumerate(state) for v in range(h))
print("перебор согласен:", all(win(tuple(sorted((a, b, c)))) == ((a ^ b ^ c) != 0)
                               for a in range(8) for b in range(8) for c in range(8)))`);
    function draw() {
      board.textContent = '';
      const over = U.sum(s.heaps) === 0;
      s.heaps.forEach((h, k) => {
        const row = flexRow('gap:5px');
        row.appendChild(H('span', { style: 'min-width:72px;font-size:.88rem;color:var(--ink-2)' }, 'кучка ' + (k + 1) + ':'));
        for (let i = 0; i < h; i++) {
          const b = H('button', { type: 'button', 'aria-label': 'взять камни из кучки ' + (k + 1) + ', начиная с камня ' + (i + 1), style: 'width:30px;height:30px;border-radius:50%;border:2px solid var(--c-aqua);background:' + tint('var(--c-aqua)', 40) + ';cursor:' + (s.turn === 0 && !over ? 'pointer' : 'default') });
          b.addEventListener('click', () => {
            if (s.turn !== 0 || over) return;
            const take = h - i;
            s.heaps[k] -= take;
            s.log.push('вы: из кучки ' + (k + 1) + ' взяли ' + take + ' → ' + s.heaps.join(', '));
            if (U.sum(s.heaps) > 0) {
              s.turn = 1;
              pcMove();
            }
            draw();
          });
          row.appendChild(b);
        }
        if (!h) row.appendChild(H('span', { style: 'color:var(--muted)' }, 'пусто'));
        board.appendChild(row);
      });
      const x = xor(s.heaps);
      bin.textContent = '';
      rowTable(bin, ['', '8', '4', '2', '1', 'число'], [...s.heaps.map((h, k) => ['кучка ' + (k + 1), ...[8, 4, 2, 1].map((b) => (h & b ? '1' : '0')), String(h)]), ['XOR', ...[8, 4, 2, 1].map((b) => (x & b ? '1' : '0')), String(x)]], (i) => i === 3, true);
      logEl.textContent = s.log.slice(-6).join('\n') + (over ? '\n' + (s.log.length && s.log[s.log.length - 1].startsWith('вы') ? 'Вы взяли последний камень — победа!' : 'Компьютер взял последний камень.') : '');
      st.set('x', String(x));
      st.set('pos', over ? 'игра окончена' : x ? 'выигрышная' : 'проигрышная');
      st.set('turn', over ? '—' : s.turn === 0 ? 'ваш' : 'компьютера');
      note.innerHTML = 'Секрет нима (Бутон, 1901): запишите размеры кучек в двоичной системе и сложите без переносов — это <b>ним-сумма</b> (XOR, урок 15.20). Позиция <b>проигрышна</b> для ходящего ровно тогда, когда ним-сумма равна 0: любой ход её портит, а из ненулевой суммы всегда есть ход в ноль — взять из кучки, в которой есть старший единичный бит суммы. Компьютер так и играет; против него можно выиграть, только если начальная позиция для вас выигрышна, и не ошибаться. По <b>теореме Шпрага — Гранди</b> любая такая игра (без случайности, с полной информацией, «кто не может ходить — проиграл») равносильна кучке нима.';
    }
    reset();
  });

  /* ==============================================================================
   * Шаг 29. Минимакс на дереве и альфа-бета отсечения
   * ============================================================================== */
  function abTree(b, d, seed) {
    const rng = new GBC.RNG(seed);
    const leaves = U.range(Math.pow(b, d)).map(() => rng.randint(19) - 9);
    return leaves;
  }
  function minimaxAB(leaves, b, d, prune, order) {
    let evals = 0;
    const seen = new Set();
    const exact = (lo, depth, maxNode) => {
      if (depth === d) return leaves[lo];
      const span = Math.pow(b, d - depth - 1);
      const vals = U.range(b).map((k) => exact(lo + k * span, depth + 1, !maxNode));
      return maxNode ? Math.max(...vals) : Math.min(...vals);
    };
    const go = (lo, depth, alpha, beta, maxNode) => {
      if (depth === d) {
        evals++;
        seen.add(lo);
        return leaves[lo];
      }
      const span = Math.pow(b, d - depth - 1);
      let kids = U.range(b);
      if (order) {
        const v = kids.map((k) => exact(lo + k * span, depth + 1, !maxNode));
        kids = U.argsort(v.map((x) => (maxNode ? -x : x)));
      }
      let best = maxNode ? -Infinity : Infinity;
      for (const k of kids) {
        const v = go(lo + k * span, depth + 1, alpha, beta, !maxNode);
        if (maxNode) {
          best = Math.max(best, v);
          alpha = Math.max(alpha, best);
        } else {
          best = Math.min(best, v);
          beta = Math.min(beta, best);
        }
        if (prune && alpha >= beta) break;
      }
      return best;
    };
    const v = go(0, 0, -Infinity, Infinity, true);
    return { v, evals, seen };
  }
  GBC.widget('alphabeta', (el) => {
    const s = { b: 3, d: 3, seed: 5, order: false };
    const w = ui.shell(el, { title: 'Альфа-бета отсечения: минимакс без лишних листьев', sub: 'Корень — ход максимизирующего (синий), дальше ходы чередуются. В листьях — оценки позиций. Альфа-бета не смотрит ветви, которые заведомо не повлияют на ответ: серые листья не вычислялись.' });
    ui.slider(w.controls, { label: 'Ветвление b', min: 2, max: 4, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.slider(w.controls, { label: 'Глубина d', min: 2, max: 4, step: 1, value: s.d, format: String, onInput: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'Номер дерева', min: 1, max: 40, step: 1, value: s.seed, format: String, onInput: (v) => ((s.seed = v), draw()) });
    ui.toggle(w.controls, { label: 'идеальный порядок ходов (лучшие первыми)', checked: s.order, onChange: (v) => ((s.order = v), draw()) });
    const host = H('div');
    w.main.appendChild(host);
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'глубина d (ветвление 3)', domain: [0.7, 8.3], ticks: U.range(8, 1) }, y: { label: 'листьев вычислено', type: 'log', domain: [1, 1e4] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'значение корня' }, { key: 'ev', label: 'листьев: альфа-бета / всего' }, { key: 'save', label: 'сэкономлено' }]);
    // средние по 30 деревьям для b = 3
    const curve = U.range(8, 1).map((d) => {
      let rnd = 0;
      let best = 0;
      for (let t = 0; t < 30; t++) {
        const lv = abTree(3, d, 1000 + t);
        rnd += minimaxAB(lv, 3, d, true, false).evals;
        if (d <= 6) best += minimaxAB(lv, 3, d, true, true).evals;
      }
      return { d, full: Math.pow(3, d), rnd: rnd / 30, best: d <= 6 ? best / 30 : Math.pow(3, Math.ceil(d / 2)) + Math.pow(3, Math.floor(d / 2)) - 1 };
    });
    plot.render([
      { type: 'line', x: curve.map((c) => c.d), y: curve.map((c) => c.full), color: 'critical', width: 2, label: 'полный перебор 3ᵈ' },
      { type: 'line', x: curve.map((c) => c.d), y: curve.map((c) => c.rnd), color: 'model', width: 2.4, label: 'альфа-бета, случайный порядок' },
      { type: 'line', x: curve.map((c) => c.d), y: curve.map((c) => c.best), color: 'aqua', width: 2.4, dash: '6 4', label: 'альфа-бета, идеальный порядок' },
    ]);
    w.pythonAction(() => `from gbcourse.rng import Mulberry32

b, d, seed = ${s.b}, ${s.d}, ${s.seed}
rng = Mulberry32(seed)
leaves = [rng.randint(19) - 9 for _ in range(b**d)]
evals = 0
def ab(lo, depth, alpha, beta, maximize):
    global evals
    if depth == d:
        evals += 1
        return leaves[lo]
    span = b ** (d - depth - 1)
    best = float("-inf") if maximize else float("inf")
    for k in range(b):
        v = ab(lo + k * span, depth + 1, alpha, beta, not maximize)
        if maximize:
            best = max(best, v); alpha = max(alpha, best)
        else:
            best = min(best, v); beta = min(beta, best)
        if alpha >= beta:
            break                      # отсечение: эта ветвь уже ничего не изменит
    return best
v = ab(0, 0, float("-inf"), float("inf"), True)
print("значение корня:", v, " листьев вычислено:", evals, "из", b**d)`);
    function draw() {
      const { b, d } = s;
      const leaves = abTree(b, d, s.seed);
      const R = minimaxAB(leaves, b, d, true, s.order);
      const nL = leaves.length;
      const W = Math.max(420, nL * 26 + 40);
      const Hh = d * 62 + 70;
      const svg = S('svg', { viewBox: '0 0 ' + W + ' ' + Hh, style: 'display:block;width:100%;height:auto;max-width:' + Math.round(W * 1.2) + 'px;min-width:' + Math.min(W, 700) + 'px;margin:0 auto' });
      const X = (lo, depth) => {
        const span = Math.pow(b, d - depth);
        return 20 + ((lo + span / 2) * (W - 40)) / nL;
      };
      const Y = (depth) => 24 + depth * 62;
      const vals = [];
      const node = (lo, depth, maxNode) => {
        if (depth === d) return leaves[lo];
        const span = Math.pow(b, d - depth - 1);
        const v = U.range(b).map((k) => node(lo + k * span, depth + 1, !maxNode));
        const val = maxNode ? Math.max(...v) : Math.min(...v);
        vals.push({ lo, depth, maxNode, val });
        return val;
      };
      node(0, 0, true);
      const visited = (lo, depth) => {
        const span = Math.pow(b, d - depth);
        for (let i = lo; i < lo + span; i++) if (R.seen.has(i)) return true;
        return false;
      };
      for (let depth = 0; depth < d; depth++) {
        const span = Math.pow(b, d - depth);
        for (let lo = 0; lo < nL; lo += span)
          for (let k = 0; k < b; k++) {
            const clo = lo + (k * span) / b;
            const on = visited(clo, depth + 1);
            svg.appendChild(S('line', { x1: X(lo, depth), y1: Y(depth), x2: X(clo, depth + 1), y2: Y(depth + 1), style: 'stroke:var(--border-strong);stroke-width:1.3;' + (on ? '' : 'stroke-dasharray:3 4;opacity:.45') }));
          }
      }
      vals.forEach((o) => {
        const on = visited(o.lo, o.depth);
        const c = o.maxNode ? P1 : P2;
        svg.appendChild(S(o.maxNode ? 'rect' : 'circle', o.maxNode ? { x: X(o.lo, o.depth) - 13, y: Y(o.depth) - 13, width: 26, height: 26, rx: 4, style: 'fill:var(--surface);stroke:' + c + ';stroke-width:2;opacity:' + (on ? 1 : 0.4) } : { cx: X(o.lo, o.depth), cy: Y(o.depth), r: 13, style: 'fill:var(--surface);stroke:' + c + ';stroke-width:2;opacity:' + (on ? 1 : 0.4) }));
        svg.appendChild(sText(X(o.lo, o.depth), Y(o.depth), minus(String(o.val)), { size: 11, bold: true, color: on ? 'var(--ink)' : 'var(--muted)' }));
      });
      leaves.forEach((v, i) => {
        const on = R.seen.has(i);
        svg.appendChild(S('rect', { x: X(i, d) - 11, y: Y(d) - 11, width: 22, height: 22, rx: 4, style: 'fill:' + (on ? tint('var(--c-yellow)', 40) : 'var(--surface-2)') + ';stroke:' + (on ? 'var(--c-yellow)' : 'var(--border)') }));
        svg.appendChild(sText(X(i, d), Y(d), minus(String(v)), { size: 10, mono: true, color: on ? 'var(--ink)' : 'var(--muted)' }));
      });
      host.textContent = '';
      const box = scrollBox();
      box.appendChild(svg);
      host.appendChild(box);
      st.set('v', minus(String(R.v)));
      st.set('ev', R.evals + ' / ' + nL);
      st.set('save', pct(1 - R.evals / nL, 0));
      note.innerHTML = 'Альфа-бета хранит два числа: α — сколько максимизирующий уже гарантировал себе выше по дереву, β — сколько уже гарантировал минимизирующий. Как только в узле α ≥ β, остальные ветви узла не нужны: соперник туда не пустит. Ответ <b>тот же</b>, что у полного минимакса, но листьев меньше. При идеальном порядке ходов их около b<sup>⌈d/2⌉</sup> + b<sup>⌊d/2⌋</sup> − 1 вместо b<sup>d</sup> — за то же время можно искать <b>вдвое глубже</b>. Поэтому шахматные программы тратят силы на упорядочивание ходов. Нижний график — средние по 30 случайным деревьям с ветвлением 3.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 30. Торг: ультиматум и модель Рубинштейна
   * ============================================================================== */
  function rubinstein(d1, d2, T) {
    // x[k] — доля того, кто предлагает, когда осталось k раундов; предлагающие чередуются, начиная с игрока 1
    const rows = [];
    let next = 1;
    for (let k = 1; k <= T; k++) {
      const proposer = (T - k) % 2;
      const respDelta = proposer === 0 ? d2 : d1;
      const x = k === 1 ? 1 : 1 - respDelta * next;
      rows.unshift({ round: T - k + 1, proposer, x });
      next = x;
    }
    return rows;
  }
  GBC.widget('bargaining', (el) => {
    const s = { d1: 0.9, d2: 0.8, T: 6 };
    const w = ui.shell(el, { title: 'Торг с чередованием предложений (Рубинштейн)', sub: 'Двое делят пирог размера 1. В нечётных раундах предлагает игрок 1, в чётных — игрок 2; ответ «нет» переносит торг на раунд позже, и пирог для игрока i «усыхает» в δᵢ раз (терпение). В последнем раунде предлагающий забирает всё.' });
    ui.slider(w.controls, { label: 'Терпение игрока 1, δ₁', min: 0, max: 0.99, step: 0.01, value: s.d1, onInput: (v) => ((s.d1 = v), draw()) });
    ui.slider(w.controls, { label: 'Терпение игрока 2, δ₂', min: 0, max: 0.99, step: 0.01, value: s.d2, onInput: (v) => ((s.d2 = v), draw()) });
    ui.slider(w.controls, { label: 'Раундов T', min: 1, max: 30, step: 1, value: s.T, format: String, onInput: (v) => ((s.T = v), draw()) });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'число раундов T', domain: [0.5, 30.5] }, y: { label: 'доля игрока 1', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'доля игрока 1 при T раундах' }, { key: 'lim', label: 'предел (1 − δ₂)/(1 − δ₁δ₂)' }, { key: 'first', label: 'при равном терпении δ₁ = δ₂' }]);
    w.pythonAction(() => `d1, d2, T = ${pyNum(s.d1)}, ${pyNum(s.d2)}, ${s.T}
share = 1.0                                 # в последнем раунде предлагающий берёт всё
for k in range(2, T + 1):                   # идём к началу: предлагающий отдаёт ровно столько,
    proposer = (T - k) % 2                  # сколько отвечающий получил бы, отказавшись
    resp_delta = d2 if proposer == 0 else d1
    share = 1 - resp_delta * share
print(f"доля игрока 1 при T = {T}: {share:.4f}")
print(f"предел Рубинштейна: {(1 - d2) / (1 - d1 * d2):.4f}")`);
    function draw() {
      const { d1, d2, T } = s;
      const rows = rubinstein(d1, d2, T);
      tbl.textContent = '';
      rowTable(tbl, ['раунд', 'предлагает', 'доля предлагающего', 'игроку 1', 'игроку 2'], rows.map((r) => [String(r.round), 'игрок ' + (r.proposer + 1), f3(r.x), f3(r.proposer === 0 ? r.x : 1 - r.x), f3(r.proposer === 0 ? 1 - r.x : r.x)]), (i) => i === 0, false);
      const Ts = U.range(30, 1);
      const share1 = (t) => rubinstein(d1, d2, t)[0].x;
      const lim = (1 - d2) / (1 - d1 * d2);
      plot.render([
        { type: 'line', x: Ts, y: Ts.map(share1), color: 'blue', width: 2, label: 'доля игрока 1' },
        { type: 'points', x: Ts, y: Ts.map(share1), color: 'blue', r: 3 },
        { type: 'hline', y: lim, color: 'tree', dash: '6 4', width: 2, label: 'предел при T → ∞' },
        { type: 'vline', x: T, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      st.set('x', f3(rows[0].x));
      st.set('lim', f3(lim));
      st.set('first', 'δ = ' + f2(d1) + ': ' + f3(1 / (1 + d1)));
      note.innerHTML = 'Обратная индукция: в последнем раунде предлагающий берёт всё (это и есть <b>ультиматум</b>, T = 1). В предпоследнем ему достаточно предложить сопернику столько, сколько тот получил бы завтра, с поправкой на нетерпение: δ·(завтрашняя доля). Сделка заключается <b>сразу</b>, в первом раунде. При бесконечном торге доля первого — (1 − δ₂)/(1 − δ₁δ₂) (Рубинштейн, 1982): выигрывает <b>терпеливый</b> (увеличьте δ₁) и начинающий — при равном терпении δ первый получает 1/(1 + δ) > ½, но преимущество исчезает при δ → 1. Поэтому в переговорах помогают альтернативы и запас времени, а дедлайны усиливают того, кто делает последнее предложение.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 31. Повторяющаяся дилемма: мрачный триггер и народная теорема
   * ============================================================================== */
  GBC.widget('repeated-pd', (el) => {
    const s = { T: 5, R: 3, P: 1, S: 0, d: 0.6 };
    const w = ui.shell(el, { title: 'Повторяющаяся дилемма: когда выгодно сотрудничать', sub: 'Игра повторяется; выигрыш через t раундов «стоит» δᵗ от сегодняшнего (или δ — вероятность, что будет следующий раунд). Стратегия «мрачный триггер»: сотрудничать, пока соперник не предал, после этого предавать всегда. Сравните: сотрудничать всегда или предать сегодня.' });
    ui.slider(w.controls, { label: 'δ — ценность будущего', min: 0, max: 0.99, step: 0.01, value: s.d, onInput: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'T — соблазн', min: 3.5, max: 8, step: 0.5, value: s.T, onInput: (v) => ((s.T = v), draw()) });
    ui.slider(w.controls, { label: 'P — наказание', min: 0, max: 2.5, step: 0.5, value: s.P, onInput: (v) => ((s.P = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 230, x: { label: 'раунд', domain: [0.5, 15.5] }, y: { label: 'накопленный выигрыш (с δᵗ)' } });
    const box = H('div', { style: 'max-width:400px;margin:0 auto' });
    w.main.appendChild(box);
    const plot2 = new GBC.Plot(box, { height: 280, equal: true, x: { label: 'средний выигрыш игрока 1', domain: [-0.5, 8.5] }, y: { label: 'средний выигрыш игрока 2', domain: [-0.5, 8.5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'сотрудничать всегда' }, { key: 'dv', label: 'предать сегодня' }, { key: 'thr', label: 'порог δ* = (T − R)/(T − P)' }]);
    w.pythonAction(() => `T, R, P, S, d = ${pyNum(s.T)}, ${s.R}, ${pyNum(s.P)}, ${s.S}, ${pyNum(s.d)}
coop = R / (1 - d)                      # R + δR + δ²R + …
defect = T + d * P / (1 - d)            # соблазн сейчас, потом вечное наказание
print(f"сотрудничать: {coop:.3f}, предать: {defect:.3f} → {'держим слово' if coop >= defect else 'выгодно предать'}")
print("порог δ* =", (T - R) / (T - P))`);
    function draw() {
      const { T, R, P, S: Sx, d } = s;
      const ks = U.range(15, 1);
      let a = 0;
      let b = 0;
      const ca = [];
      const cb = [];
      ks.forEach((k) => {
        a += Math.pow(d, k - 1) * R;
        b += Math.pow(d, k - 1) * (k === 1 ? T : P);
        ca.push(a);
        cb.push(b);
      });
      const coop = R / (1 - d);
      const def = T + (d * P) / (1 - d);
      const thr = (T - R) / (T - P);
      plot.render([
        { type: 'line', x: ks, y: ca, color: 'model', width: 2.5, label: 'сотрудничать всегда' },
        { type: 'line', x: ks, y: cb, color: 'critical', width: 2.5, dash: '7 4', label: 'предать в раунде 1' },
        { type: 'hline', y: coop, color: 'model', width: 1, dash: '3 3' },
        { type: 'hline', y: def, color: 'critical', width: 1, dash: '3 3' },
      ]);
      plot2.render([
        { type: 'polygon', x: [P, T, R, Sx], y: [P, Sx, R, T], fill: 'muted', opacity: 0.12, stroke: 'muted', width: 1, label: 'достижимые средние' },
        { type: 'polygon', polys: [ratRegion(P, T, R, Sx)], fill: 'model', opacity: 0.22, stroke: 'model', width: 1.2, label: 'устойчивы при δ → 1' },
        { type: 'points', x: [R, P, T, Sx], y: [R, P, Sx, T], r: 5, color: 'ink', tooltip: (i) => [{ label: ['оба С', 'оба П', '1 предал', '2 предал'][i], value: '' }] },
      ]);
      st.set('c', f2(coop));
      st.set('dv', f2(def));
      st.set('thr', f3(thr) + (d >= thr ? ' ✓ сотрудничество устойчиво' : ' ✗'));
      note.innerHTML = 'Предать сегодня — это T сейчас и P во всех будущих раундах; сотрудничать — R всегда. Сотрудничество выгодно, если R/(1 − δ) ≥ T + δP/(1 − δ), то есть <b>δ ≥ (T − R)/(T − P) = ' + f3(thr) + '</b>. Тень будущего превращает дилемму в игру, где взаимное сотрудничество — равновесие. <b>Народная теорема</b>: при δ, близком к 1, равновесием можно сделать любые средние выигрыши из выпуклой оболочки исходов, где каждый получает больше P (закрашенная область). Отсюда сила репутации, долгих отношений и картелей — и их хрупкость, когда будущее обесценивается (последний раунд, банкротство).';
    }
    function ratRegion(P, T, R, Sx) {
      // выпуклая оболочка исходов ∩ {u1 ≥ P, u2 ≥ P}
      const poly = [[P, P], [T, Sx], [R, R], [Sx, T]];
      const clip = (pts, f) => {
        const out = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          const fa = f(a);
          const fb = f(b);
          if (fa >= 0) out.push(a);
          if (fa * fb < 0) {
            const t = fa / (fa - fb);
            out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
          }
        }
        return out;
      };
      let pts = clip(poly, (p) => p[0] - P);
      pts = clip(pts, (p) => p[1] - P);
      return { x: pts.map((p) => p[0]), y: pts.map((p) => p[1]) };
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 32. Турнир Аксельрода
   * ============================================================================== */
  const STRATS = [
    { key: 'allc', name: 'всегда сотрудничать', f: () => 0 },
    { key: 'alld', name: 'всегда предавать', f: () => 1 },
    { key: 'tft', name: 'око за око', f: (me, op) => (op.length ? op[op.length - 1] : 0) },
    { key: 'stft', name: 'подозрительное око за око', f: (me, op) => (op.length ? op[op.length - 1] : 1) },
    { key: 'tf2t', name: 'око за два ока', f: (me, op) => (op.length >= 2 && op[op.length - 1] && op[op.length - 2] ? 1 : 0) },
    { key: 'grim', name: 'мрачный триггер', f: (me, op) => (op.includes(1) ? 1 : 0) },
    { key: 'wsls', name: 'Павлов (выиграл — повторяй)', f: (me, op) => (me.length ? (me[me.length - 1] === op[op.length - 1] ? 0 : 1) : 0) },
    { key: 'gtft', name: 'щедрое око за око', f: (me, op, rng) => (op.length && op[op.length - 1] ? (rng.random() < 1 / 3 ? 0 : 1) : 0) },
    { key: 'rand', name: 'случайно', f: (me, op, rng) => (rng.random() < 0.5 ? 0 : 1) },
  ];
  const PDPAY = [[3, 0], [5, 1]];
  function match(i, j, rounds, noise, seed) {
    const rng = new GBC.RNG(1000 * seed + 37 * i + j);
    const a = [];
    const b = [];
    let sa = 0;
    let sb = 0;
    for (let t = 0; t < rounds; t++) {
      let x = STRATS[i].f(a, b, rng);
      let y = STRATS[j].f(b, a, rng);
      if (noise > 0) {
        if (rng.random() < noise) x = 1 - x;
        if (rng.random() < noise) y = 1 - y;
      }
      a.push(x);
      b.push(y);
      sa += PDPAY[x][y];
      sb += PDPAY[y][x];
    }
    return [sa / rounds, sb / rounds];
  }
  GBC.widget('axelrod', (el) => {
    const s = { rounds: 200, noise: 0, seed: 1, mode: 'rr' };
    const w = ui.shell(el, { title: 'Турнир Аксельрода: кто побеждает в повторяющейся дилемме', sub: 'Девять стратегий играют каждая с каждой (и с копией себя) по 200 раундов; выигрыши за раунд 3/0/5/1. Шум — вероятность, что ход случайно перевернётся (ошибка или недопонимание).' });
    ui.segmented(w.controls, { label: 'Турнир', value: s.mode, options: [{ value: 'rr', label: 'круговой' }, { value: 'eco', label: 'экологический' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'Шум', min: 0, max: 0.1, step: 0.01, value: s.noise, format: (v) => pct(v, 0), onInput: (v) => ((s.noise = v), draw()) });
    ui.slider(w.controls, { label: 'Раундов в матче', min: 10, max: 400, step: 10, value: s.rounds, format: String, onInput: (v) => ((s.rounds = v), draw()) });
    ui.slider(w.controls, { label: 'Зерно', min: 1, max: 30, step: 1, value: s.seed, format: String, onInput: (v) => ((s.seed = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: '' }, y: { label: '' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'победитель' }, { key: 'tft', label: 'око за око' }, { key: 'alld', label: 'всегда предавать' }]);
    w.pythonAction(() => `import numpy as np
from gbcourse.rng import Mulberry32

PAY = [[3, 0], [5, 1]]          # PAY[мой ход][ход соперника], 0 — сотрудничать, 1 — предать
STRATS = {
    "всегда сотрудничать": lambda me, op, rng: 0,
    "всегда предавать": lambda me, op, rng: 1,
    "око за око": lambda me, op, rng: op[-1] if op else 0,
    "подозрительное око за око": lambda me, op, rng: op[-1] if op else 1,
    "око за два ока": lambda me, op, rng: 1 if len(op) >= 2 and op[-1] and op[-2] else 0,
    "мрачный триггер": lambda me, op, rng: 1 if 1 in op else 0,
    "Павлов": lambda me, op, rng: (0 if me[-1] == op[-1] else 1) if me else 0,
    "щедрое око за око": lambda me, op, rng: (0 if rng.random() < 1 / 3 else 1) if op and op[-1] else 0,
    "случайно": lambda me, op, rng: 0 if rng.random() < 0.5 else 1,
}
names, fs = list(STRATS), list(STRATS.values())
rounds, noise, seed = ${s.rounds}, ${pyNum(s.noise)}, ${s.seed}
def match(i, j):
    rng = Mulberry32(1000 * seed + 37 * i + j)
    a, b, sa, sb = [], [], 0, 0
    for _ in range(rounds):
        x, y = fs[i](a, b, rng), fs[j](b, a, rng)
        if noise > 0:
            if rng.random() < noise: x = 1 - x
            if rng.random() < noise: y = 1 - y
        a.append(x); b.append(y)
        sa += PAY[x][y]; sb += PAY[y][x]
    return sa / rounds, sb / rounds
n = len(fs)
W = np.zeros((n, n))            # W[i, j] — средний выигрыш i против j за раунд
for i in range(n):
    for j in range(i, n):
        W[i, j], W[j, i] = match(i, j)
for k in np.argsort(-W.mean(1)):
    print(f"{names[k]:28} {W[k].mean():.3f}")
x = np.ones(n) / n              # экологический турнир: доли растут пропорционально выигрышу
for g in range(60):
    f = W @ x
    x = x * f / (x @ f)
print("доли через 60 поколений:", dict(zip(names, x.round(3))))`);
    function draw() {
      const n = STRATS.length;
      const W = U.range(n).map(() => new Array(n).fill(0));
      for (let i = 0; i < n; i++)
        for (let j = i; j < n; j++) {
          const [a, b] = match(i, j, s.rounds, s.noise, s.seed);
          W[i][j] = a;
          W[j][i] = b;
        }
      const score = W.map((r) => U.mean(r));
      if (s.mode === 'rr') {
        const ord = U.argsort(score.map((v) => -v));
        plot.opts.x.label = 'место в турнире';
        plot.opts.y.label = 'средний выигрыш за раунд';
        plot.opts.x.ticks = U.range(n, 1);
        plot.opts.x.format = (v) => String(Math.round(v));
        plot.render([
          { type: 'bars', x: U.range(n, 1), y: ord.map((k) => score[k]), color: (i) => (STRATS[ord[i]].key === 'tft' ? 'tree' : STRATS[ord[i]].key === 'alld' ? 'critical' : 'model'), width: 0.7, maxPx: 40, tooltip: (i) => [{ label: STRATS[ord[i]].name, value: f3(score[ord[i]]) }] },
          { type: 'text', items: ord.map((k, i) => ({ x: i + 1, y: score[k], dy: -6, anchor: 'middle', text: f2(score[k]) })) },
        ], { x: [0.4, n + 0.6], y: [0, 3.6] });
        tbl.textContent = '';
        rowTable(tbl, ['место', 'стратегия', 'за раунд', 'против «всегда предавать»', 'против себя'], ord.map((k, i) => [String(i + 1), STRATS[k].name, f3(score[k]), f2(W[k][1]), f2(W[k][k])]), (i) => STRATS[ord[i]].key === 'tft', false);
        st.set('w', STRATS[ord[0]].name);
      } else {
        tbl.textContent = '';
        let x = new Array(n).fill(1 / n);
        const hist = [x];
        for (let g = 0; g < 60; g++) {
          const f = matVec(W, x);
          const fb = dot(x, f);
          x = x.map((v, i) => (v * f[i]) / fb);
          hist.push(x);
        }
        const gs = U.range(61);
        plot.opts.x.label = 'поколение';
        plot.opts.y.label = 'доля в популяции';
        plot.opts.x.ticks = null;
        plot.opts.x.format = null;
        plot.render(STRATS.map((o, k) => ({ type: 'line', x: gs, y: hist.map((h) => h[k]), color: o.key === 'tft' ? 'tree' : o.key === 'alld' ? 'critical' : SER[[0, 1, 2, 3, 4, 5, 6, 7, 2][k]], width: o.key === 'tft' || o.key === 'alld' ? 2.8 : 1.4, dash: ['rand', 'stft', 'gtft'].includes(o.key) ? '5 4' : null, label: o.name })), { x: [0, 60], y: [0, 1] });
        const fin = hist[60];
        let b = 0;
        fin.forEach((v, i) => v > fin[b] && (b = i));
        st.set('w', STRATS[b].name + ' (' + pct(fin[b], 0) + ')');
      }
      st.set('tft', f3(score[2]));
      st.set('alld', f3(score[1]));
      note.innerHTML = 'В 1980 году Роберт Аксельрод пригласил специалистов прислать программы для повторяющейся дилеммы. Победила самая короткая — <b>«око за око»</b> Анатолия Рапопорта: начать с сотрудничества и повторять последний ход соперника. Она <b>добрая</b> (не предаёт первой), <b>отвечает</b> на предательство, <b>прощает</b> и <b>понятна</b> сопернику. Заметьте: «око за око» не выигрывает ни одного матча (самое большее — ничья), но набирает больше всех в сумме. С шумом случайная ошибка запускает у двух «око за око» бесконечное эхо мести — тогда выигрывают прощающие стратегии («щедрое око за око», Павлов). В экологическом турнире доли стратегий меняются по успеху (шаг 25): хищники сначала растут на «простаках», а затем вымирают вместе с ними. Итоговые места зависят от состава участников — универсально лучшей стратегии нет.';
    }
    draw();
  });
})();
