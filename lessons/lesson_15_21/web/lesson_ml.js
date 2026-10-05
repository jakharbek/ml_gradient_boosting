/* Урок 15.21: теория игр. Часть 3 — кооперативные игры и значение Шепли, теория игр в машинном обучении.
 * Виджеты: ядро игры трёх лиц; значение Шепли по порядкам прихода; индекс власти Шепли — Шубика и Банцафа;
 * аксиомы и правила дележа; приближение Шепли выборкой порядков; SHAP как кооперативная игра признаков;
 * SHAP для бустинга по деревьям; AdaBoost как игра и отступы; аукционы и резервная цена; стратегическая
 * классификация (игра Штакельберга); тренажёр.
 * Помощники — из GBC.lesson1521 (lesson.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const L = GBC.lesson1521;
  const { f2, f3, pct, minus, frac, pyNum, pyVec, pyMat, pyStr, P1, P2, SER, tint, flexRow, texEl, cardGrid, card, rowTable, scrollBox, monoBox, numField, legendRow } = L;
  const SQ3 = Math.sqrt(3) / 2;
  const tern = (p) => [p[1] + p[2] / 2, p[2] * SQ3];
  const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
  const popcount = (m) => {
    let c = 0;
    while (m) {
      c += m & 1;
      m >>>= 1;
    }
    return c;
  };
  /** Точное значение Шепли по формуле с весами |S|!(n − |S| − 1)!/n!; v — функция маски. */
  function shapleyMask(v, n) {
    const F = U.range(n + 1).map(fact);
    const phi = new Array(n).fill(0);
    const cache = new Map();
    const V = (m) => {
      if (!cache.has(m)) cache.set(m, v(m));
      return cache.get(m);
    };
    for (let j = 0; j < n; j++) {
      const bit = 1 << j;
      for (let m = 0; m < 1 << n; m++) {
        if (m & bit) continue;
        const s = popcount(m);
        phi[j] += ((F[s] * F[n - s - 1]) / F[n]) * (V(m | bit) - V(m));
      }
    }
    return phi;
  }
  function banzhafMask(v, n) {
    const out = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      const bit = 1 << j;
      for (let m = 0; m < 1 << n; m++) if (!(m & bit)) out[j] += v(m | bit) - v(m);
      out[j] /= Math.pow(2, n - 1);
    }
    return out;
  }
  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    const out = [];
    arr.forEach((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).forEach((p) => out.push([x, ...p])));
    return out;
  }
  const has = (m, i) => (m >> i) & 1;
  /* Кооперативные игры (v — функция маски коалиции). */
  const CG = {
    glove: { label: 'Перчатки', n: 3, names: ['1 (левая)', '2 (правая)', '3 (правая)'], v: (m) => (has(m, 0) && (has(m, 1) || has(m, 2)) ? 1 : 0), py: 'lambda S: 1 if 0 in S and (1 in S or 2 in S) else 0' },
    airport: { label: 'Аэропорт (стоимость)', n: 3, names: ['малый', 'средний', 'большой'], v: (m) => Math.max(0, ...[0, 1, 2].filter((i) => has(m, i)).map((i) => [1, 2, 3][i])), py: 'lambda S: max([0] + [[1, 2, 3][i] for i in S])' },
    taxi: { label: 'Такси (стоимость)', n: 3, names: ['до 6 км', 'до 10 км', 'до 15 км'], v: (m) => Math.max(0, ...[0, 1, 2].filter((i) => has(m, i)).map((i) => [6, 10, 15][i])), py: 'lambda S: max([0] + [[6, 10, 15][i] for i in S])' },
    model: { label: 'Модель f = 2x₁ + x₂ + x₁x₂', n: 3, names: ['x₁', 'x₂', 'x₃'], v: (m) => 2 * has(m, 0) + has(m, 1) + has(m, 0) * has(m, 1), py: 'lambda S: 2 * (0 in S) + (1 in S) + (0 in S) * (1 in S)' },
    sym: { label: 'Модель f = x₁ + x₂ + x₁x₂ (x₃ не нужен)', n: 3, names: ['x₁', 'x₂', 'x₃'], v: (m) => has(m, 0) + has(m, 1) + has(m, 0) * has(m, 1), py: 'lambda S: (0 in S) + (1 in S) + (0 in S) * (1 in S)' },
    maj: { label: 'Большинство из трёх', n: 3, names: ['1', '2', '3'], v: (m) => (popcount(m) >= 2 ? 1 : 0), py: 'lambda S: 1 if len(S) >= 2 else 0' },
    model4: { label: 'Модель f = x₁ + 2x₂ + 3x₁x₃ (4 признака)', n: 4, names: ['x₁', 'x₂', 'x₃', 'x₄'], v: (m) => has(m, 0) + 2 * has(m, 1) + 3 * has(m, 0) * has(m, 2), py: 'lambda S: (0 in S) + 2 * (1 in S) + 3 * (0 in S) * (2 in S)' },
  };
  const subsetName = (m, n) => '{' + U.range(n).filter((i) => has(m, i)).map((i) => i + 1).join(',') + '}';

  /* ==============================================================================
   * Шаг 33. Коалиции и ядро
   * ============================================================================== */
  function clipPoly(pts, f) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const fa = f(a);
      const fb = f(b);
      if (fa >= -1e-12) out.push(a);
      if ((fa > 1e-12 && fb < -1e-12) || (fa < -1e-12 && fb > 1e-12)) {
        const t = fa / (fa - fb);
        out.push(a.map((v, k) => v + t * (b[k] - v)));
      }
    }
    return out;
  }
  GBC.widget('core-triangle', (el) => {
    const s = { g: 'glove', v: [0.5, 0.5, 0.5] };
    const PRE = {
      glove: { label: 'Перчатки', v12: 1, v13: 1, v23: 0, vN: 1, names: ['1 (левая)', '2 (правая)', '3 (правая)'] },
      maj: { label: 'Большинство из трёх', v12: 1, v13: 1, v23: 1, vN: 1, names: ['1', '2', '3'] },
      taxi: { label: 'Такси: экономия', v12: 6, v13: 6, v23: 10, vN: 16, names: ['до 6 км', 'до 10 км', 'до 15 км'] },
      own: { label: 'Свои значения', names: ['1', '2', '3'] },
    };
    const w = ui.shell(el, { title: 'Ядро: дележи, от которых не откажется ни одна коалиция', sub: 'Треугольник — все дележи общего выигрыша v(N) между тремя игроками (вершина — всё одному). Коалиция {i, j} откажется от дележа, если вместе получает меньше v(ij), — эти полосы отрезаются. Остаток — ядро.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: Object.keys(PRE).map((k) => ({ value: k, label: PRE[k].label })), onChange: (v) => ((s.g = v), draw()) });
    const sls = ['v({1,2})', 'v({1,3})', 'v({2,3})'].map((nm, k) => ui.slider(w.controls, { label: nm + ' при v(N) = 1', min: 0, max: 1, step: 0.05, value: s.v[k], onInput: (v) => ((s.v[k] = v), draw()) }));
    const box = H('div', { style: 'max-width:440px;margin:0 auto' });
    w.main.appendChild(box);
    const plot = new GBC.Plot(box, { height: 320, equal: true, grid: 'none', x: { label: '', domain: [-0.14, 1.14], ticks: [], hide: true }, y: { label: '', domain: [-0.12, 0.96], ticks: [], hide: true }, margin: { left: 6, bottom: 6, right: 6, top: 6 } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'core', label: 'ядро' }, { key: 'sh', label: 'значение Шепли' }, { key: 'in', label: 'Шепли в ядре?' }]);
    const game = () => {
      const g = PRE[s.g];
      if (s.g === 'own') return { v12: s.v[0], v13: s.v[1], v23: s.v[2], vN: 1, names: g.names };
      return g;
    };
    w.pythonAction(() => {
      const g = game();
      return `import numpy as np
from itertools import permutations

vN, v12, v13, v23 = ${pyNum(g.vN)}, ${pyNum(g.v12)}, ${pyNum(g.v13)}, ${pyNum(g.v23)}
def v(S):
    S = frozenset(S)
    return {frozenset(): 0, frozenset({0, 1}): v12, frozenset({0, 2}): v13, frozenset({1, 2}): v23,
            frozenset({0, 1, 2}): vN}.get(S, 0)          # одиночки получают 0
phi = np.zeros(3)
for order in permutations(range(3)):
    S = set()
    for j in order:
        phi[j] += (v(S | {j}) - v(S)) / 6
        S.add(j)
print("Шепли:", phi.round(4))
in_core = phi[0] + phi[1] >= v12 - 1e-12 and phi[0] + phi[2] >= v13 - 1e-12 and phi[1] + phi[2] >= v23 - 1e-12
print("в ядре:", in_core)
print("ядро не пусто ⇔ v12 + v13 + v23 ≤ 2·v(N) (для игр трёх лиц с нулевыми одиночками):", v12 + v13 + v23 <= 2 * vN)`;
    });
    function draw() {
      sls.forEach((sl) => (sl.el.style.display = s.g === 'own' ? '' : 'none'));
      const g = game();
      const { vN } = g;
      // ограничения в долях от v(N): x3 ≤ 1 − v12/vN и т. п.
      const lim = [1 - g.v23 / vN, 1 - g.v13 / vN, 1 - g.v12 / vN];
      let core = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
      lim.forEach((l, k) => (core = clipPoly(core, (x) => l - x[k])));
      const vm = (m) => (m === 3 ? g.v12 : m === 5 ? g.v13 : m === 6 ? g.v23 : m === 7 ? vN : 0);
      const phi = shapleyMask(vm, 3);
      const sh = phi.map((x) => x / vN);
      const inCore = lim.every((l, k) => sh[k] <= l + 1e-9);
      const bands = lim.map((l, k) => {
        let poly = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        poly = clipPoly(poly, (x) => x[k] - l);
        return poly;
      });
      const toXY = (poly) => {
        const P = poly.map(tern);
        return { x: P.map((p) => p[0]), y: P.map((p) => p[1]) };
      };
      plot.render([
        { type: 'polygon', x: [0, 1, 0.5], y: [0, 0, SQ3], fill: 'surface', opacity: 0, stroke: 'ink2', width: 1.5 },
        ...bands.filter((b) => b.length >= 3).map((b) => ({ type: 'polygon', ...toXY(b), fill: 'critical', opacity: 0.12, stroke: 'critical', width: 1 })),
        core.length >= 3 ? { type: 'polygon', ...toXY(core), fill: 'good', opacity: 0.35, stroke: 'good', width: 2, label: 'ядро' } : null,
        core.length > 0 && core.length < 3 ? { type: 'points', ...toXY(core), r: 7, color: 'good', label: 'ядро (точка или отрезок)' } : null,
        { type: 'points', x: [tern(sh)[0]], y: [tern(sh)[1]], r: 7, color: 'tree', label: 'значение Шепли', tooltip: () => [{ label: 'φ', value: sh.map((x) => frac(x * vN)).join('; ') }] },
        { type: 'text', items: [{ x: -0.02, y: -0.07, text: g.names[0], anchor: 'middle' }, { x: 1.02, y: -0.07, text: g.names[1], anchor: 'middle' }, { x: 0.5, y: SQ3 + 0.06, text: g.names[2], anchor: 'middle' }] },
      ]);
      tbl.textContent = '';
      rowTable(tbl, ['коалиция', '{1}', '{2}', '{3}', '{1,2}', '{1,3}', '{2,3}', '{1,2,3}'], [['v', '0', '0', '0', f2(g.v12), f2(g.v13), f2(g.v23), f2(vN)]], null, false);
      const empty = core.length === 0;
      st.set('core', empty ? 'пусто' : core.length < 3 ? 'точка/отрезок' : 'многоугольник');
      st.set('sh', phi.map((x) => frac(x)).join('; '));
      st.set('in', inCore ? 'да' : 'нет');
      const texts = {
        glove: 'Ядро — одна точка (1, 0, 0): весь доход забирает владелец левой перчатки. Иначе два владельца правых перчаток переманивали бы его друг у друга. Конкуренция «обнуляет» избыточную сторону рынка. Шепли (2/3, 1/6, 1/6) — вне ядра: он учитывает «вклад» правых перчаток.',
        maj: 'Любые двое могут забрать всё, поэтому каждая пара требует 1, а делить нечего больше 1: 3 · ½ > 1 — <b>ядро пусто</b>. Любой дележ блокирует какая-нибудь пара — отсюда неустойчивость коалиций большинства в политике.',
        taxi: 'Трое едут на одном такси по одной дороге до домов на 6, 10 и 15 км. v(S) — <b>экономия</b> коалиции по сравнению с поездками порознь. Игра выпуклая (чем больше коалиция, тем больше прирост от нового участника), поэтому ядро широкое и Шепли (4; 6; 6) внутри.',
        own: 'Для трёх игроков с нулевыми одиночками ядро не пусто ⇔ v(12) + v(13) + v(23) ≤ 2 v(N). Попробуйте нарушить.',
      };
      note.innerHTML = '<b>Кооперативная игра</b> — функция v(S): сколько может обеспечить себе коалиция S. <b>Ядро</b> (core) — дележи с суммой v(N), где каждая коалиция получает не меньше v(S): никто не захочет отколоться. ' + texts[s.g];
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 34. Значение Шепли через порядки прихода
   * ============================================================================== */
  GBC.widget('shapley-orders', (el) => {
    const s = { g: 'model', k: 0 };
    const w = ui.shell(el, { title: 'Значение Шепли: средний вклад по всем порядкам прихода', sub: 'Участники входят в комнату по одному. Каждому засчитывается прирост v в момент его прихода. Порядки перебираются по одному; значение Шепли — средний прирост по всем n! порядкам.' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: ['glove', 'airport', 'taxi', 'model', 'maj', 'model4'].map((k) => ({ value: k, label: CG[k].label })), onChange: (v) => ((s.g = v), rebuild()) });
    const pl = ui.player(w.controls, { label: 'Порядков учтено', min: 1, max: 6, value: 6, fps: 2, format: (k, mx) => k + ' из ' + mx, onChange: (k) => ((s.k = k), draw()) });
    const vtab = H('div');
    const otab = H('div');
    w.main.append(vtab);
    const plot = new GBC.Plot(w.main, { height: 210, x: { label: '' }, y: { label: 'значение Шепли φ' } });
    w.main.appendChild(otab);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sum', label: 'Σφ' }, { key: 'vn', label: 'v(N) − v(∅)' }, { key: 'phi', label: 'точные φ' }]);
    let perms = [];
    w.pythonAction(() => `from itertools import permutations
from math import factorial
from fractions import Fraction

n = ${CG[s.g].n}
v = ${CG[s.g].py}
phi = [Fraction(0)] * n
for order in permutations(range(n)):
    S = set()
    for j in order:
        phi[j] += Fraction(v(S | {j}) - v(S), factorial(n))
        S.add(j)
print("значения Шепли:", [str(x) for x in phi], " сумма:", sum(phi), " v(N) =", v(set(range(n))))`);
    function rebuild() {
      perms = permutations(U.range(CG[s.g].n));
      pl.setMax(perms.length);
      pl.set(perms.length);
      s.k = perms.length;
      draw();
    }
    function draw() {
      const G = CG[s.g];
      const n = G.n;
      vtab.textContent = '';
      const masks = U.range(1 << n);
      rowTable(vtab, ['S', ...masks.map((m) => subsetName(m, n))], [['v(S)', ...masks.map((m) => U.fmt(G.v(m), 3))]], null, false);
      const acc = new Array(n).fill(0);
      const rows = perms.map((ord, k) => {
        const marg = new Array(n).fill(0);
        let m = 0;
        ord.forEach((j) => {
          const before = G.v(m);
          m |= 1 << j;
          marg[j] = G.v(m) - before;
        });
        if (k < s.k) marg.forEach((v, j) => (acc[j] += v));
        return [ord.map((i) => i + 1).join(' → '), ...marg.map((v) => minus(U.fmt(v, 3)))];
      });
      otab.textContent = '';
      rowTable(otab, ['порядок прихода', ...G.names.map((nm) => 'прирост ' + nm)], rows, (i) => i < s.k, false);
      const phi = acc.map((v) => v / s.k);
      const exact = shapleyMask(G.v, n);
      plot.opts.x.ticks = U.range(n, 1);
      plot.opts.x.format = (v) => G.names[Math.round(v) - 1] || '';
      plot.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'bars', x: U.range(n, 1), y: phi, color: (i) => SER[i], width: 0.55, maxPx: 54, label: 'среднее по учтённым порядкам', legendColor: 'blue', tooltip: (i) => [{ label: G.names[i], value: f3(phi[i]) }] },
        { type: 'points', x: U.range(n, 1), y: exact, r: 6, hollow: true, color: 'ink', label: 'точное значение' },
        { type: 'text', items: phi.map((v, i) => ({ x: i + 1, y: v, dy: v >= 0 ? -8 : 16, anchor: 'middle', text: frac(v, 48) })) },
      ], { x: [0.4, n + 0.6], y: [Math.min(0, ...phi, ...exact) - 0.2, Math.max(...phi, ...exact) * 1.25 + 0.1] });
      st.set('sum', frac(U.sum(phi), 48));
      st.set('vn', frac(G.v((1 << n) - 1) - G.v(0)));
      st.set('phi', exact.map((x) => frac(x, 48)).join('; '));
      const texts = {
        glove: 'Пара перчаток стоит 1. Левая одна, правых две — левая «дефицитна», её владелец получает 2/3: в 4 из 6 порядков именно он «замыкает» пару.',
        airport: 'Полоса должна подходить самому большому самолёту: стоимость 1, 2, 3. Первую единицу длины нужна всем — её делят на троих (по 1/3), вторую — двое (по 1/2), третью оплачивает только большой: (1/3; 5/6; 11/6). Правило Литтлчайлда и Оуэна (1973) для аэропорта Бирмингема.',
        taxi: 'Такси везёт троих до домов на 6, 10 и 15 км. Первые 6 км едут все — по 2 с каждого; следующие 4 км — двое, по 2; последние 5 км — один. Итог (2; 4; 9) — тот же принцип «делим общий участок поровну».',
        model: 'v(S) — прогноз модели f = 2x₁ + x₂ + x₁x₂ в точке (1, 1, 1), если «знаем» только признаки из S (остальные — базовые нули). Взаимодействие x₁x₂ делится пополам: φ = (5/2; 3/2; 0). Признак x₃ модель не использует — его вклад 0. Это и есть SHAP (шаг 38).',
        maj: 'Все симметричны — у каждого 1/3: решающим (вторым) в порядке оказывается каждый в 2 из 6 порядков.',
        model4: 'Четыре признака — 24 порядка. f = x₁ + 2x₂ + 3x₁x₃: взаимодействие 3x₁x₃ делится поровну, φ = (2.5; 2; 1.5; 0), x₄ — «болванчик».',
      };
      note.innerHTML = texts[s.g] + ' Поставьте меньше порядков: частичное среднее — оценка, которая может нарушать честность (шаг 37). <b>Значение Шепли</b> (1953): φ<sub>j</sub> = (1/n!)·Σ по порядкам [v(до j и j) − v(до j)].';
    }
    rebuild();
  });

  /* ==============================================================================
   * Шаг 35. Индекс власти: Шепли — Шубик и Банцаф
   * ============================================================================== */
  const VOTE = {
    a: { label: '[51; 49, 49, 2]', q: 51, w: [49, 49, 2], names: ['A', 'B', 'C'] },
    eec: { label: 'Совет ЕЭС, 1958', q: 12, w: [4, 4, 4, 2, 2, 1], names: ['Франция', 'ФРГ', 'Италия', 'Бельгия', 'Нидерланды', 'Люксембург'] },
    un: { label: 'Совбез ООН: 5 с правом вето + 10', q: 39, w: [7, 7, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], names: ['П1', 'П2', 'П3', 'П4', 'П5', 'Н1', 'Н2', 'Н3', 'Н4', 'Н5', 'Н6', 'Н7', 'Н8', 'Н9', 'Н10'] },
    b: { label: '[6; 4, 3, 2]', q: 6, w: [4, 3, 2], names: ['A', 'B', 'C'] },
  };
  GBC.widget('voting-power', (el) => {
    const s = { g: 'eec', q: 12, w: [4, 4, 4, 2, 2, 1], names: VOTE.eec.names };
    const w = ui.shell(el, { title: 'Индекс власти: вес голосов ≠ власть', sub: 'Взвешенное голосование: у участника i — wᵢ голосов, решение принято, если «за» набрали не меньше квоты q. v(S) = 1 для выигрывающих коалиций. Индекс Шепли — Шубика — значение Шепли этой игры: доля порядков, в которых участник оказывается решающим.' });
    ui.select(w.controls, { label: 'Голосование', value: s.g, options: Object.keys(VOTE).map((k) => ({ value: k, label: VOTE[k].label })), onChange: (v) => load(v) });
    const qF = numField(w.controls, { label: 'Квота q', value: s.q, onChange: (v) => ((s.q = v), draw()) });
    const wInp = H('input', { class: 'input', type: 'text', 'aria-label': 'веса через запятую', value: s.w.join(', '), style: 'font-family:var(--font-mono)' });
    const wMsg = H('div', { class: 'ctl-help' }, 'до 15 участников');
    w.controls.appendChild(H('div', { class: 'ctl' }, H('label', { class: 'ctl-label' }, 'Веса через запятую'), wInp, wMsg));
    wInp.addEventListener('change', () => {
      const ws = wInp.value.split(/[,;\s]+/).filter(Boolean).map(Number);
      if (!ws.length || ws.length > 15 || ws.some((x) => !Number.isFinite(x) || x < 0)) {
        wMsg.textContent = 'Нужно от 1 до 15 неотрицательных чисел';
        return;
      }
      wMsg.textContent = 'до 15 участников';
      s.w = ws;
      s.names = ws.map((_, i) => String.fromCharCode(65 + i));
      s.g = 'own';
      draw();
    });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: '' }, y: { label: 'доля', domain: [0, 1] } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'tot', label: 'всего голосов / квота' }, { key: 'max', label: 'больше всего власти' }, { key: 'null', label: 'без власти' }]);
    w.pythonAction(() => `from itertools import combinations
from math import factorial

w, q = ${pyVec(s.w)}, ${pyNum(s.q)}
n = len(w)
win = lambda S: sum(w[i] for i in S) >= q
ss, bz = [0.0] * n, [0] * n
for j in range(n):
    others = [i for i in range(n) if i != j]
    for k in range(n):
        for S in combinations(others, k):
            if not win(S) and win(S + (j,)):          # j — решающий для коалиции S
                ss[j] += factorial(k) * factorial(n - k - 1) / factorial(n)
                bz[j] += 1
total_bz = sum(bz)
for j in range(n):
    print(f"участник {j + 1}: вес {w[j] / sum(w):.3f}, Шепли — Шубик {ss[j]:.4f}, Банцаф {bz[j] / total_bz:.4f}")`);
    function load(k) {
      const g = VOTE[k];
      s.g = k;
      s.q = g.q;
      s.w = g.w.slice();
      s.names = g.names;
      qF.set(g.q);
      wInp.value = g.w.join(', ');
      draw();
    }
    function draw() {
      const n = s.w.length;
      const v = (m) => (U.range(n).reduce((a, i) => a + (has(m, i) ? s.w[i] : 0), 0) >= s.q ? 1 : 0);
      const ss = shapleyMask(v, n);
      const bzRaw = banzhafMask(v, n);
      const bzT = U.sum(bzRaw) || 1;
      const bz = bzRaw.map((x) => x / bzT);
      const W = U.sum(s.w) || 1;
      const ws = s.w.map((x) => x / W);
      const xs = U.range(n, 1);
      plot.opts.x.ticks = xs;
      plot.opts.x.format = (x) => s.names[Math.round(x) - 1] || '';
      const bw = 0.26;
      plot.render([
        { type: 'bars', x: xs.map((x) => x - bw), y: ws, color: 'muted', width: bw, maxPx: 18, label: 'доля голосов', tooltip: (i) => [{ label: s.names[i] + ': доля голосов', value: f3(ws[i]) }] },
        { type: 'bars', x: xs, y: ss, color: 'blue', width: bw, maxPx: 18, label: 'Шепли — Шубик', tooltip: (i) => [{ label: s.names[i] + ': Шепли — Шубик', value: f3(ss[i]) }] },
        { type: 'bars', x: xs.map((x) => x + bw), y: bz, color: 'orange', width: bw, maxPx: 18, label: 'Банцаф (нормированный)', tooltip: (i) => [{ label: s.names[i] + ': Банцаф', value: f3(bz[i]) }] },
      ], { x: [0.4, n + 0.6], y: [0, Math.min(1, Math.max(...ws, ...ss, ...bz) * 1.2 + 0.02)] });
      tbl.textContent = '';
      rowTable(tbl, ['участник', 'голосов', 'доля голосов', 'Шепли — Шубик', 'Банцаф'], U.range(n).map((i) => [s.names[i], String(s.w[i]), f3(ws[i]), frac(ss[i], 2000), f3(bz[i])]), (i) => ss[i] < 1e-12, false);
      let mx = 0;
      ss.forEach((x, i) => x > ss[mx] && (mx = i));
      st.set('tot', W + ' / ' + s.q);
      st.set('max', s.names[mx] + ' (' + f3(ss[mx]) + ')');
      st.set('null', U.range(n).filter((i) => ss[i] < 1e-12).map((i) => s.names[i]).join(', ') || 'нет');
      const texts = {
        a: 'У C всего 2 голоса из 100, но любые двое из трёх набирают 51 — власть у всех <b>одинаковая</b>, по 1/3.',
        eec: 'Римский договор (1958): у Люксембурга был 1 голос, но <b>нулевая власть</b> — все суммы весов остальных чётные, и при квоте 12 его голос никогда не решал исход. Франция, ФРГ и Италия — по 7/30, Бельгия и Нидерланды — по 3/20.',
        un: 'Чтобы решение прошло, нужны все 5 постоянных членов и ещё хотя бы 4 из 10 — это и даёт квота 39 при весах 7 и 1. У каждого постоянного члена около 0.196 власти, у непостоянного — около 0.002: в сто раз меньше при весе, меньшем всего в 7 раз.',
        b: 'Веса 4, 3, 2: у A меньше половины голосов, но без него решение не пройти (3 + 2 < 6) — у него <b>право вето</b> и 2/3 власти по Шепли — Шубику. B и C равны по власти, хотя их веса различаются.',
        own: 'Свои веса и квота.',
      };
      note.innerHTML = texts[s.g] + ' <b>Индекс Банцафа</b> считает долю коалиций (а не порядков), где участник решающий; он не обязан давать в сумме 1, поэтому его нормируют. Те же вопросы задают в машинном обучении: какой признак «решающий» для перехода модели через порог? Это ведёт к значениям Шепли для объяснений (блок 7).';
    }
    load(s.g);
  });

  /* ==============================================================================
   * Шаг 36. Аксиомы: почему именно Шепли
   * ============================================================================== */
  const RULES = [
    { key: 'sh', name: 'Шепли', f: (v, n) => shapleyMask(v, n) },
    { key: 'eq', name: 'поровну', f: (v, n) => new Array(n).fill((v((1 << n) - 1) - v(0)) / n) },
    { key: 'prop', name: 'пропорционально v({i})', f: (v, n) => {
      const sa = U.range(n).map((i) => v(1 << i) - v(0));
      const t = U.sum(sa);
      const vn = v((1 << n) - 1) - v(0);
      return t > 1e-12 ? sa.map((x) => (vn * x) / t) : new Array(n).fill(vn / n);
    } },
    { key: 'last', name: 'пропорционально вкладу в N', f: (v, n) => {
      const full = (1 << n) - 1;
      const c = U.range(n).map((i) => v(full) - v(full & ~(1 << i)));
      const t = U.sum(c);
      const vn = v(full) - v(0);
      return Math.abs(t) > 1e-12 ? c.map((x) => (vn * x) / t) : new Array(n).fill(vn / n);
    } },
    { key: 'bz', name: 'Банцаф, нормированный', f: (v, n) => {
      const b = banzhafMask(v, n);
      const t = U.sum(b);
      const vn = v((1 << n) - 1) - v(0);
      return Math.abs(t) > 1e-12 ? b.map((x) => (vn * x) / t) : new Array(n).fill(vn / n);
    } },
    { key: 'ord', name: 'вклад в порядке 1 → 2 → 3', f: (v, n) => {
      const out = [];
      let m = 0;
      for (let i = 0; i < n; i++) {
        out.push(v(m | (1 << i)) - v(m));
        m |= 1 << i;
      }
      return out;
    } },
  ];
  GBC.widget('axioms', (el) => {
    const s = { g: 'sym' };
    const w = ui.shell(el, { title: 'Четыре аксиомы честного дележа', sub: 'Шесть правил дележа на одной и той же игре. Виджет проверяет: эффективность (делится ровно v(N)), симметрию (равноценные получают поровну), болванчика (бесполезный получает 0), аддитивность (дележ суммы двух игр = сумма дележей).' });
    ui.select(w.controls, { label: 'Игра', value: s.g, options: ['sym', 'glove', 'airport', 'model', 'maj'].map((k) => ({ value: k, label: CG[k].label })), onChange: (v) => ((s.g = v), draw()) });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'all', label: 'выполняют все четыре' }, { key: 'sym', label: 'симметричные пары' }, { key: 'dummy', label: 'болванчики' }]);
    w.pythonAction(() => `import numpy as np
from itertools import permutations

n = 3
v = ${CG[s.g].py}
w = ${CG[s.g === 'glove' ? 'model' : 'glove'].py}    # вторая игра для проверки аддитивности
def shapley(v):
    phi = np.zeros(n)
    for order in permutations(range(n)):
        S = set()
        for j in order:
            phi[j] += (v(S | {j}) - v(S)) / 6
            S.add(j)
    return phi
def equal(v):
    return np.full(n, v(set(range(n))) / n)
vw = lambda S: v(S) + w(S)
for name, rule in [("Шепли", shapley), ("поровну", equal)]:
    a, b, c = rule(v), rule(w), rule(vw)
    print(f"{name:8}: φ = {a.round(4)}, сумма {a.sum():.4f}, аддитивность: {np.allclose(c, a + b)}")`);
    function draw() {
      const G = CG[s.g];
      const n = G.n;
      const v = G.v;
      const w2 = CG[s.g === 'glove' ? 'model' : 'glove'].v;
      const vw = (m) => v(m) + w2(m);
      const full = (1 << n) - 1;
      // симметричные пары и болванчики
      const sym = [];
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          let ok = true;
          for (let m = 0; m < 1 << n && ok; m++) if (!has(m, i) && !has(m, j) && Math.abs(v(m | (1 << i)) - v(m | (1 << j))) > 1e-12) ok = false;
          if (ok) sym.push([i, j]);
        }
      const dummy = U.range(n).filter((i) => {
        for (let m = 0; m < 1 << n; m++) if (!has(m, i) && Math.abs(v(m | (1 << i)) - v(m)) > 1e-12) return false;
        return true;
      });
      const rows = RULES.map((r) => {
        const x = r.f(v, n);
        const eff = Math.abs(U.sum(x) - (v(full) - v(0))) < 1e-9;
        const sy = sym.every(([i, j]) => Math.abs(x[i] - x[j]) < 1e-9);
        const du = dummy.every((i) => Math.abs(x[i]) < 1e-9);
        const a = r.f(vw, n);
        const b = r.f(w2, n);
        const ad = a.every((val, i) => Math.abs(val - x[i] - b[i]) < 1e-9);
        return { r, x, eff, sy, du, ad };
      });
      const mark = (b) => (b ? '✓' : '✗');
      tbl.textContent = '';
      rowTable(tbl, ['правило', ...G.names.map((nm) => 'доля ' + nm), 'эфф.', 'симм.', 'болв.', 'адд.'], rows.map((o) => [o.r.name, ...o.x.map((v0) => frac(v0, 48)), mark(o.eff), mark(o.sy), mark(o.du), mark(o.ad)]), (i) => rows[i].r.key === 'sh', false);
      st.set('all', rows.filter((o) => o.eff && o.sy && o.du && o.ad).map((o) => o.r.name).join(', '));
      st.set('sym', sym.map(([i, j]) => G.names[i] + ' и ' + G.names[j]).join('; ') || 'нет');
      st.set('dummy', dummy.map((i) => G.names[i]).join(', ') || 'нет');
      note.innerHTML = 'Аддитивность проверяется на сумме выбранной игры и ' + (s.g === 'glove' ? '«модели»' : '«перчаток»') + '. <b>Теорема Шепли (1953)</b>: существует <b>ровно одно</b> правило со всеми четырьмя свойствами — значение Шепли. Остальные правила «ломаются» хотя бы на какой-то игре: «поровну» платит болванчику, вклад в фиксированном порядке несимметричен, пропорциональные правила не аддитивны. В SHAP эти аксиомы становятся свойствами объяснений: <b>эффективность</b> — сумма вкладов признаков равна «прогноз минус базовое значение»; <b>болванчик</b> — признак, который модель не использует, получает 0; <b>симметрия</b> — взаимозаменяемые признаки получают поровну; <b>аддитивность</b> — объяснение суммы деревьев равно сумме объяснений деревьев (шаг 39).';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 37. Приближение значения Шепли выборкой порядков
   * ============================================================================== */
  GBC.widget('shapley-sampling', (el) => {
    const Wt = [12, 10, 9, 8, 6, 5, 3, 2, 1, 1];
    const Q = 29;
    const n = Wt.length;
    const v = (m) => (U.range(n).reduce((a, i) => a + (has(m, i) ? Wt[i] : 0), 0) >= Q ? 1 : 0);
    const exact = shapleyMask(v, n);
    const s = { K: 50, anti: false, seed: 1 };
    const w = ui.shell(el, { title: 'Шепли выборкой порядков: точность против затрат', sub: 'Голосование 10 участников с весами 12, 10, 9, 8, 6, 5, 3, 2, 1, 1 и квотой 29. Точное значение требует 10! = 3 628 800 порядков (или 2⁹ коалиций на участника); оценка берёт K случайных порядков. «Антитетические» пары: каждый порядок вместе с обратным.' });
    ui.slider(w.controls, { label: 'Порядков K', min: 1, max: Math.log10(5000), step: 0.01, value: Math.log10(s.K), format: (x) => String(Math.round(Math.pow(10, x))), onInput: (x) => ((s.K = Math.round(Math.pow(10, x))), draw()) });
    ui.toggle(w.controls, { label: 'антитетические пары (порядок + обратный)', checked: s.anti, onChange: (x) => ((s.anti = x), draw()) });
    ui.slider(w.controls, { label: 'Зерно', min: 1, max: 30, step: 1, value: s.seed, format: String, onInput: (x) => ((s.seed = x), draw()) });
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'участник (вес)' }, y: { label: 'φ' } });
    const plot2 = new GBC.Plot(w.main, { height: 220, x: { label: 'порядков K', type: 'log', domain: [10, 5000] }, y: { label: 'средняя ошибка |φ̂ − φ|', type: 'log' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'err', label: 'средняя ошибка при K' }, { key: 'sum', label: 'Σφ̂ (должно быть 1)' }, { key: 'cost', label: 'вычислений v' }]);
    const estimate = (K, anti, seed) => {
      const rng = new GBC.RNG(seed);
      const acc = new Array(n).fill(0);
      let cnt = 0;
      const walk = (ord) => {
        let m = 0;
        let prev = v(0);
        for (const j of ord) {
          m |= 1 << j;
          const cur = v(m);
          acc[j] += cur - prev;
          prev = cur;
        }
        cnt++;
      };
      for (let k = 0; k < K; k++) {
        const ord = rng.permutation(n);
        walk(ord);
        if (anti) walk(ord.slice().reverse());
      }
      return acc.map((a) => a / cnt);
    };
    const Ks = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    const errCurve = (anti) => Ks.map((K) => {
      let e = 0;
      for (let r = 0; r < 20; r++) {
        const est = estimate(anti ? K / 2 : K, anti, 100 + r);
        e += U.mean(est.map((x, i) => Math.abs(x - exact[i])));
      }
      return e / 20;
    });
    const ePlain = errCurve(false);
    const eAnti = errCurve(true);
    w.pythonAction(() => `import numpy as np
from itertools import combinations
from math import factorial
from gbcourse.rng import Mulberry32

w, q = ${pyVec(Wt)}, ${Q}
n = len(w)
v = lambda S: 1.0 if sum(w[i] for i in S) >= q else 0.0
exact = np.zeros(n)
for j in range(n):
    others = [i for i in range(n) if i != j]
    for k in range(n):
        for S in combinations(others, k):
            exact[j] += factorial(k) * factorial(n - k - 1) / factorial(n) * (v(S + (j,)) - v(S))

def estimate(K, anti, seed):
    rng = Mulberry32(seed)
    acc, cnt = np.zeros(n), 0
    def walk(order):
        nonlocal cnt
        S, prev = [], v(())
        for j in order:
            S.append(j)
            cur = v(S)
            acc[j] += cur - prev
            prev = cur
        cnt += 1
    for _ in range(K):
        order = rng.permutation(n)
        walk(order)
        if anti:
            walk(order[::-1])
    return acc / cnt

est = estimate(${s.anti ? Math.max(1, Math.round(s.K / 2)) : s.K}, ${s.anti ? 'True' : 'False'}, ${s.seed})
print("точно:", exact.round(4))
print("оценка:", est.round(4), " средняя ошибка:", np.abs(est - exact).mean().round(4), " сумма:", est.sum())`);
    function draw() {
      const K = s.anti ? Math.max(1, Math.round(s.K / 2)) : s.K;
      const est = estimate(K, s.anti, s.seed);
      const xs = U.range(n, 1);
      plot.opts.x.ticks = xs;
      plot.opts.x.format = (x) => String(Wt[Math.round(x) - 1] ?? '');
      plot.render([
        { type: 'bars', x: xs, y: est, color: 'model', width: 0.6, maxPx: 26, label: 'оценка по K порядкам', tooltip: (i) => [{ label: 'оценка', value: f3(est[i]) }, { label: 'точно', value: f3(exact[i]) }] },
        { type: 'points', x: xs, y: exact, r: 5, hollow: true, color: 'ink', label: 'точное значение' },
      ], { x: [0.4, n + 0.6], y: [0, Math.max(...est, ...exact) * 1.2] });
      plot2.render([
        { type: 'line', x: Ks, y: ePlain, color: 'blue', width: 2.2, label: 'случайные порядки' },
        { type: 'line', x: Ks, y: eAnti, color: 'orange', width: 2.2, label: 'антитетические пары' },
        { type: 'line', x: Ks, y: Ks.map((k) => ePlain[0] * Math.sqrt(10 / k)), color: 'ink2', width: 1.2, dash: '5 4', label: '∝ 1/√K' },
        { type: 'vline', x: Math.max(10, s.K), color: 'ink2', dash: '3 3', width: 1 },
      ], { y: [Math.min(...ePlain, ...eAnti) * 0.6, Math.max(...ePlain, ...eAnti) * 1.6] });
      const err = U.mean(est.map((x, i) => Math.abs(x - exact[i])));
      st.set('err', U.fmt(err, 3));
      st.set('sum', f3(U.sum(est)));
      st.set('cost', String(s.anti ? 2 * K * n : K * n));
      note.innerHTML = 'Оценка по случайным порядкам <b>несмещённая</b>, а её ошибка убывает как 1/√K (урок 15.14): чтобы уменьшить ошибку в 10 раз, нужно в 100 раз больше порядков. Сумма оценок равна v(N) − v(∅) = 1 <b>при любом K</b> — эффективность выполняется в каждом порядке. Антитетические пары (порядок и его обращение) помогают, когда вклад участника монотонно зависит от позиции: ранний и поздний приход уравновешивают друг друга. Здесь они <b>вредят</b>: в голосовании решающим бывает участник в середине порядка, а при обращении середина остаётся серединой — вклады в паре положительно коррелированы, и ошибка больше, чем у независимых порядков. Приёмы снижения дисперсии надо проверять на своей задаче. На этих идеях построены KernelSHAP и выборочные оценки SHAP для «чёрных ящиков»; для деревьев есть точный быстрый алгоритм TreeSHAP (шаг 39).';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 38. SHAP: признаки как игроки
   * ============================================================================== */
  const SHM = {
    lin: { label: 'f = 2x₁ + x₂', f: (x) => 2 * x[0] + x[1], py: '2 * x1 + x2' },
    inter: { label: 'f = x₁·x₂ + x₃', f: (x) => x[0] * x[1] + x[2], py: 'x1 * x2 + x3' },
    max: { label: 'f = max(x₁, x₂)', f: (x) => Math.max(x[0], x[1]), py: 'np.maximum(x1, x2)' },
    and: { label: 'f = 1, если x₁ > 0 и x₂ > 0', f: (x) => (x[0] > 0 && x[1] > 0 ? 1 : 0), py: '((x1 > 0) & (x2 > 0)).astype(float)' },
  };
  GBC.widget('shap-game', (el) => {
    const rng = new GBC.RNG(38);
    const BG = U.range(200).map(() => {
      const a = rng.normal();
      const b = rng.normal();
      const c = rng.normal();
      return [a, 0.8 * a + 0.6 * b, c];
    });
    const s = { m: 'inter', x: [1.5, 1, -0.5], bg: 'data' };
    const w = ui.shell(el, { title: 'SHAP: прогноз как выигрыш коалиции признаков', sub: 'Игроки — признаки объекта x. v(S) — средний прогноз, если признаки из S взять из x, а остальные — из фоновых данных. Значения Шепли этой игры — вклады SHAP; они раскладывают «прогноз минус базовое значение» на слагаемые.' });
    ui.select(w.controls, { label: 'Модель', value: s.m, options: Object.keys(SHM).map((k) => ({ value: k, label: SHM[k].label })), onChange: (v) => ((s.m = v), draw()) });
    ['x₁', 'x₂', 'x₃'].forEach((nm, k) => ui.slider(w.controls, { label: nm + ' объекта', min: -2, max: 2, step: 0.1, value: s.x[k], onInput: (v) => ((s.x[k] = v), draw()) }));
    ui.segmented(w.controls, { label: 'Фон для «неизвестных» признаков', value: s.bg, options: [{ value: 'data', label: '200 объектов' }, { value: 'mean', label: 'одна точка: средние' }], onChange: (v) => ((s.bg = v), draw()) });
    const vtab = H('div');
    w.main.appendChild(vtab);
    const plot = new GBC.Plot(w.main, { height: 230, x: { label: '' }, y: { label: 'прогноз' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'base', label: 'базовое значение v(∅)' }, { key: 'phi', label: 'φ₁; φ₂; φ₃' }, { key: 'fx', label: 'база + Σφ = f(x)' }]);
    w.pythonAction(() => `import numpy as np
from itertools import combinations
from math import factorial
from gbcourse.rng import Mulberry32

rng = Mulberry32(38)
bg = []
for _ in range(200):
    a, b, c = rng.normal(), rng.normal(), rng.normal()
    bg.append([a, 0.8 * a + 0.6 * b, c])        # x₂ коррелирует с x₁
bg = np.array(bg)
${s.bg === 'mean' ? 'bg = bg.mean(axis=0, keepdims=True)          # фон из одной точки\n' : ''}x = np.array(${pyVec(s.x)})
def f(X):
    x1, x2, x3 = X[:, 0], X[:, 1], X[:, 2]
    return ${SHM[s.m].py}
def v(S):                                      # «интервенционная» игра: признаки S — из x, остальные — из фона
    Z = bg.copy()
    Z[:, list(S)] = x[list(S)]
    return f(Z).mean()
n = 3
phi = np.zeros(n)
for j in range(n):
    for k in range(n):
        for S in combinations([i for i in range(n) if i != j], k):
            phi[j] += factorial(k) * factorial(n - k - 1) / factorial(n) * (v(S + (j,)) - v(S))
print("база:", round(v(()), 4), " φ:", phi.round(4), " база + Σφ:", round(v(()) + phi.sum(), 4), " f(x):", f(x[None])[0])
try:
    import shap                                 # сверка с библиотекой SHAP (если установлена)
    ex = shap.explainers.Exact(lambda X: f(np.asarray(X)), shap.maskers.Independent(bg, max_samples=len(bg)))
    print("shap:", np.round(ex(x[None]).values[0], 4))
except ImportError:
    pass`);
    function draw() {
      const M = SHM[s.m];
      const bg = s.bg === 'data' ? BG : [[U.mean(BG.map((r) => r[0])), U.mean(BG.map((r) => r[1])), U.mean(BG.map((r) => r[2]))]];
      const v = (m) => U.mean(bg.map((z) => M.f([0, 1, 2].map((i) => (has(m, i) ? s.x[i] : z[i])))));
      const phi = shapleyMask(v, 3);
      const base = v(0);
      const fx = M.f(s.x);
      vtab.textContent = '';
      rowTable(vtab, ['S', '∅', '{1}', '{2}', '{3}', '{1,2}', '{1,3}', '{2,3}', '{1,2,3}'], [['v(S)', ...[0, 1, 2, 4, 3, 5, 6, 7].map((m) => f3(v(m)))]], null, false);
      // водопад: база → +φ₁ → +φ₂ → +φ₃
      const steps = [base];
      phi.forEach((p) => steps.push(steps[steps.length - 1] + p));
      const rects = phi.map((p, i) => ({ type: 'rect', x0: i + 1.7, x1: i + 2.3, y0: steps[i], y1: steps[i + 1], fill: p >= 0 ? 'pos' : 'neg', opacity: 0.85, stroke: p >= 0 ? 'pos' : 'neg' }));
      plot.opts.x.ticks = [1, 2, 3, 4, 5];
      plot.opts.x.format = (x) => ['база', 'φ₁', 'φ₂', 'φ₃', 'f(x)'][Math.round(x) - 1] || '';
      const lo = Math.min(...steps, fx, 0);
      const hi = Math.max(...steps, fx, 0);
      plot.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'rect', x0: 0.7, x1: 1.3, y0: 0, y1: base, fill: 'muted', opacity: 0.6, stroke: 'muted' },
        ...rects,
        { type: 'rect', x0: 4.7, x1: 5.3, y0: 0, y1: fx, fill: 'model', opacity: 0.8, stroke: 'model' },
        { type: 'segments', x1: [1.3, 2.3, 3.3, 4.3], y1: steps, x2: [1.7, 2.7, 3.7, 4.7], y2: steps, color: 'ink2', width: 1, opacity: 0.8 },
        { type: 'text', items: [{ x: 1, y: base, text: f2(base) }, ...phi.map((p, i) => ({ x: i + 2, y: Math.max(steps[i], steps[i + 1]), text: (p >= 0 ? '+' : '') + minus(f2(p)) })), { x: 5, y: Math.max(fx, 0), text: f2(fx) }].map((t) => ({ ...t, dy: -6, anchor: 'middle' })) },
      ], { x: [0.4, 5.6], y: [lo - 0.15 * (hi - lo + 0.1), hi + 0.2 * (hi - lo + 0.1)] });
      st.set('base', f3(base));
      st.set('phi', phi.map((p) => minus(f2(p))).join('; '));
      st.set('fx', f3(base + U.sum(phi)) + ' = ' + f3(fx));
      const texts = {
        lin: 'Для линейной модели вклад признака — коэффициент на отклонение от среднего фона: φ₁ = 2(x₁ − x̄₁), φ₂ = x₂ − x̄₂, φ₃ = 0 (болванчик). Выбор фона почти не важен.',
        inter: 'Взаимодействие x₁x₂ делится между x₁ и x₂. Переключите фон: для нелинейной модели «средний объект» и «вся выборка» дают <b>разные</b> базу и вклады — f(среднего) ≠ среднее f.',
        max: 'max(x₁, x₂): вклад получает в основном больший признак, но не весь — порядок прихода в коалицию влияет на прирост.',
        and: 'Логическое «и»: прогноз 1 только когда оба положительны. Вклад делится поровну между x₁ и x₂, если оба «включены», хотя ни один не работает в одиночку.',
      };
      note.innerHTML = '<b>SHAP</b> (Лундберг и Ли, 2017) — значения Шепли игры «признаки делят прогноз». Ключевой и спорный выбор — что значит «признак неизвестен»: здесь его подменяют значениями из фоновых данных (так считает SHAP с «интервенционной» маскировкой). Корреляция x₁ и x₂ в фоне при этом игнорируется: подстановки создают комбинации, которых в данных нет. ' + texts[s.m] + ' Эффективность гарантирует: база + Σφ = f(x) — для любой модели и любого фона.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 39. SHAP для бустинга: аддитивность по деревьям
   * ============================================================================== */
  GBC.widget('shap-trees', (el) => {
    const D = GBC.datasets.friedman1({ n: 300, noise: 1, seed: 7, nFeatures: 5 });
    const model = new GBC.GradientBoosting({ nEstimators: 40, learningRate: 0.2, maxDepth: 2 }).fit(D.X, D.y);
    const s = { i: 0 };
    const w = ui.shell(el, { title: 'SHAP для бустинга: объяснение суммы деревьев — сумма объяснений', sub: 'Бустинг из 40 деревьев глубины 2 на задаче Фридмана (5 признаков, x₀ и x₁ взаимодействуют через sin(π x₀ x₁)). Для выбранного объекта считаем точные значения Шепли каждого дерева и складываем с весом ν = 0.2.' });
    ui.slider(w.controls, { label: 'Объект №', min: 0, max: 299, step: 1, value: s.i, format: String, onInput: (v) => ((s.i = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'деревьев учтено m', domain: [0, 40] }, y: { label: 'накопленный вклад φⱼ' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'fx', label: 'прогноз F(x)' }, { key: 'sum', label: 'база + Σφ' }, { key: 'add', label: 'расхождение Σ по деревьям и модели' }]);
    w.pythonAction(() => `import numpy as np
from gbcourse import GBRegressor, datasets, explain

X, y = datasets.friedman1(n=300, noise=1.0, seed=7, n_features=5)
model = GBRegressor(n_estimators=40, learning_rate=0.2, max_depth=2).fit(X, y)
x = X[${s.i}]
base, phi = explain.shapley_values(model, x)          # точные значения Шепли всей модели
per_tree = np.array([explain.shapley_values(stage[0], x)[1] for stage in model.trees_])
print("φ модели:            ", phi.round(4))
print("ν · Σ φ по деревьям: ", (model.learning_rate * per_tree.sum(0)).round(4))
print("база + Σφ =", round(base + phi.sum(), 6), " прогноз:", round(model.predict(x[None])[0], 6))
try:
    import shap
    from sklearn.ensemble import GradientBoostingRegressor
    sk = GradientBoostingRegressor(n_estimators=40, learning_rate=0.2, max_depth=2, random_state=0).fit(X, y)
    sv = shap.TreeExplainer(sk).shap_values(X[${s.i}:${s.i + 1}])
    print("TreeSHAP для sklearn-модели:", np.round(sv[0], 4))
except ImportError:
    pass`);
    function draw() {
      const x = D.X[s.i];
      const nu = model.learningRate;
      const per = model.trees.map((stage) => GBC.explain.shapleyValues(stage[0], x));
      const cum = [new Array(5).fill(0)];
      per.forEach((r) => cum.push(cum[cum.length - 1].map((v, j) => v + nu * r.phi[j])));
      const full = GBC.explain.shapleyValues(model, x);
      const fx = model.predictRawOne(x);
      const ms = U.range(41);
      plot.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        ...U.range(5).map((j) => ({ type: 'line', x: ms, y: cum.map((c) => c[j]), color: SER[j], width: j < 2 ? 2.6 : 1.8, label: 'x' + j })),
      ]);
      const diff = Math.max(...full.phi.map((p, j) => Math.abs(p - cum[40][j])));
      tbl.textContent = '';
      rowTable(tbl, ['признак', 'значение', 'φ модели', 'ν·Σ φ деревьев', 'деревьев с этим признаком'], U.range(5).map((j) => [String.fromCharCode(120) + j, f3(x[j]), f3(full.phi[j]), f3(cum[40][j]), String(model.trees.filter((st0) => st0[0].nodes.some((nd) => nd.left >= 0 && nd.feature === j)).length)]), null, false);
      st.set('fx', f3(fx));
      st.set('sum', f3(full.base + U.sum(full.phi)));
      st.set('add', U.fmt(diff, 2));
      note.innerHTML = 'Значение Шепли <b>аддитивно</b>: если модель — сумма F₀ + ν·Σ h<sub>m</sub>, то и вклады — сумма вкладов деревьев. Поэтому TreeSHAP объясняет бустинг дерево за деревом, и для каждого дерева есть точный алгоритм за полиномиальное время (Лундберг и др., 2020), а не за 2<sup>M</sup>. Кривые показывают, как вклад каждого признака набирается по мере добавления деревьев. Здесь «неизвестный признак» понимается иначе, чем в шаге 38: TreeSHAP усредняет по ветвям дерева пропорционально числу обучающих объектов в них (зависимая от пути версия). Сумма база + Σφ равна прогнозу с точностью округления.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 40. AdaBoost как игра бустера и противника
   * ============================================================================== */
  GBC.widget('adaboost-game', (el) => {
    const rng = new GBC.RNG(21);
    const xs = U.range(40).map(() => rng.uniform(0, 10)).sort((a, b) => a - b);
    const ys = xs.map((x) => {
      const y = x > 3 && x < 7 ? 1 : 0;
      return rng.random() < 0.08 ? 1 - y : y;
    });
    const X = xs.map((x) => [x]);
    const ada = new GBC.AdaBoost({ nEstimators: 40, maxDepth: 1 }).fit(X, ys);
    const M = ada.trees.length;
    const s = { m: 1 };
    const w = ui.shell(el, { title: 'AdaBoost — повторяющаяся игра с нулевой суммой', sub: 'Противник выбирает веса объектов (размер точки), бустер — пень с наименьшей взвешенной ошибкой. Затем противник по правилу мультипликативных весов (Hedge) увеличивает веса там, где пень ошибся.' });
    ui.player(w.controls, { label: 'Раунд m', min: 1, max: M, value: 1, fps: 2, format: (k) => 'm = ' + k, onChange: (k) => ((s.m = k), draw()) });
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: 'x', domain: [0, 10] }, y: { label: 'класс', domain: [-0.6, 1.6], ticks: [0, 1] } });
    const curves = new GBC.Plot(w.main, { height: 210, x: { label: 'раунд', domain: [1, M] }, y: { label: 'доля', domain: [0, 0.6] } });
    const marg = new GBC.Plot(w.main, { height: 190, x: { label: 'нормированный отступ y·F(x)/Σα', domain: [-1, 1] }, y: { label: 'доля объектов с отступом ≤', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'eps', label: 'взвешенная ошибка εₘ' }, { key: 'tr', label: 'ошибка ансамбля' }, { key: 'mg', label: 'минимальный отступ' }]);
    const sgn = (y) => (y ? 1 : -1);
    const trainErr = U.range(M, 1).map((k) => U.mean(ada.predict(X, k).map((p, i) => (p === ys[i] ? 0 : 1))));
    const bound = [];
    let b = 1;
    ada.errors.forEach((e) => bound.push((b *= 2 * Math.sqrt(e * (1 - e)))));
    const margins = (m) => {
      const A = U.sum(ada.alphas.slice(0, m));
      return xs.map((_, i) => (sgn(ys[i]) * ada.decisionOne(X[i], m)) / A).sort((a, c) => a - c);
    };
    w.pythonAction(() => `import numpy as np
from gbcourse import AdaBoost
from gbcourse.rng import Mulberry32

rng = Mulberry32(21)
x = sorted(rng.uniform(0, 10) for _ in range(40))
y = []
for xi in x:
    yi = 1 if 3 < xi < 7 else 0
    y.append(1 - yi if rng.random() < 0.08 else yi)
X, y = np.array(x)[:, None], np.array(y)
ada = AdaBoost(n_estimators=40, max_depth=1).fit(X, y)
m = ${s.m}
F = ada.decision_function(X, m)
s = np.where(y == 1, 1, -1)
print("ошибки пней ε:", np.round(ada.errors_[:m], 3))
print("ошибка ансамбля:", np.mean((F > 0) != (y == 1)), " граница Π 2√(ε(1−ε)):", np.prod(2 * np.sqrt(np.array(ada.errors_[:m]) * (1 - np.array(ada.errors_[:m])))))
w = np.exp(-s * F)                       # веса противника = экспоненты отступов (Hedge)
print("веса из отступов совпадают с весами AdaBoost:", np.allclose(w / w.sum(), ada.weights_[m]))
print("минимальный нормированный отступ:", (s * F / sum(ada.alphas_[:m])).min())`);
    function draw() {
      const m = s.m;
      const wts = ada.weights[m - 1];
      const tree = ada.trees[m - 1];
      const grid = U.linspace(0, 10, 401);
      const hv = grid.map((x) => (tree.predictOne([x]) >= 0 ? 1 : 0));
      const ens = grid.map((x) => (ada.decisionOne([x], m) > 0 ? 1 : 0));
      plot.render([
        { type: 'line', x: grid, y: ens.map((v) => v + (v ? 0.25 : -0.25)), color: 'model', width: 2.5, curve: 'step', label: 'ансамбль после m раундов', hover: false },
        { type: 'line', x: grid, y: hv.map((v) => v + (v ? 0.42 : -0.42)), color: 'tree', width: 2, dash: '6 4', curve: 'step', label: 'пень раунда m', hover: false },
        { type: 'points', x: xs, y: ys, color: (i) => (ys[i] ? 'class1' : 'class0'), r: (i) => 2.5 + 9 * Math.sqrt((wts[i] * xs.length) / 4), label: 'объекты (размер = вес)', legendColor: 'data', tooltip: (i) => [{ label: 'вес', value: f3(wts[i]) }] },
      ]);
      curves.render([
        { type: 'line', x: U.range(M, 1), y: ada.errors, color: 'tree', width: 2, label: 'εₘ — ошибка пня на весах' },
        { type: 'line', x: U.range(M, 1), y: trainErr, color: 'model', width: 2.5, label: 'ошибка ансамбля' },
        { type: 'line', x: U.range(M, 1), y: bound.map((v) => Math.min(v, 0.6)), color: 'ink2', width: 1.5, dash: '5 4', label: 'граница Π 2√(ε(1 − ε))' },
        { type: 'hline', y: 0.5, color: 'critical', width: 1, dash: '3 3', text: 'монетка' },
        { type: 'vline', x: m, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      const mg = margins(m);
      const mgE = margins(M);
      const cdf = (arr) => ({ x: arr.flatMap((v) => [v, v]), y: arr.flatMap((v, i) => [i / arr.length, (i + 1) / arr.length]) });
      marg.render([
        { type: 'vline', x: 0, color: 'axis', width: 1 },
        { type: 'line', ...cdf(mg), color: 'model', width: 2.2, label: 'после m раундов' },
        { type: 'line', ...cdf(mgE), color: 'muted', width: 1.6, dash: '5 4', label: 'после всех ' + M },
      ]);
      st.set('eps', f3(ada.errors[m - 1]));
      st.set('tr', f3(trainErr[m - 1]));
      st.set('mg', minus(f3(mg[0])));
      note.innerHTML = 'Фройнд и Шапире (1996) описали бустинг как <b>игру с нулевой суммой</b>: строки — объекты, столбцы — слабые модели, выигрыш противника — «модель ошиблась». Противник выбирает трудное распределение весов, бустер отвечает пнём с ошибкой меньше ½. Веса AdaBoost — это в точности Hedge: вес объекта ∝ exp(−y·F(x)), экспонента от <b>отступа</b>. <b>Теорема о минимаксе</b> связывает два свойства: «на любом распределении весов есть пень с преимуществом γ» ⇔ «есть смесь пней, правильная на всех объектах с отступом ≥ 2γ». Обучающая ошибка падает не медленнее Π 2√(εₘ(1 − εₘ)) ≤ e<sup>−2Σγ²</sup>. Противник находит всё более трудные распределения — εₘ растут к ½, и граница убывает медленно. В данных 4 метки из 40 перевёрнуты шумом: ошибка 0.075 (три из них) держится с 3-го по 23-й раунд, а потом бустинг начинает подгонять шум и к 40-му раунду запоминает все метки — это переобучение. Тем временем он <b>растягивает отступы</b> (нижний график): минимальный растёт от −1 до положительного. Теория отступов (Шапире и др., 1998) объясняет этим, почему бустинг часто не переобучается сразу. Градиентный бустинг (урок 5.1) обобщает идею с весов объектов на градиенты любой функции потерь.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 41. Аукционы и проектирование механизмов
   * ============================================================================== */
  GBC.widget('auction', (el) => {
    const s = { n: 3, v: 0.8, r: 0 };
    const w = ui.shell(el, { title: 'Аукционы: сколько ставить и какую назначить резервную цену', sub: 'Ваша ценность лота v; у n − 1 соперников ценности случайны и равномерны на [0, 1], и они играют равновесные стратегии. Кривые — ваш ожидаемый выигрыш (ценность минус плата) при разных ставках. r — резервная цена продавца.' });
    ui.slider(w.controls, { label: 'Участников n', min: 2, max: 10, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Ваша ценность v', min: 0.05, max: 1, step: 0.05, value: s.v, onInput: (v) => ((s.v = v), draw()) });
    ui.slider(w.controls, { label: 'Резервная цена r', min: 0, max: 0.9, step: 0.05, value: s.r, onInput: (v) => ((s.r = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'ваша ставка b', domain: [0, 1] }, y: { label: 'ожидаемый выигрыш' } });
    const plot2 = new GBC.Plot(w.main, { height: 210, x: { label: 'резервная цена r', domain: [0, 1] }, y: { label: 'ожидаемый доход продавца' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'b2', label: 'лучшая ставка: 2-я цена' }, { key: 'b1', label: 'лучшая ставка: 1-я цена' }, { key: 'rev', label: 'доход: 1-я / 2-я цена (2000 торгов)' }]);
    const beta = (x, n, r) => (x < r ? 0 : x - (Math.pow(x, n) - Math.pow(r, n)) / (n * Math.pow(x, n - 1)));
    const betaInv = (b, n, r) => {
      if (b < r) return 0;
      let lo = r;
      let hi = 1;
      if (beta(1, n, r) <= b) return 1;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (beta(mid, n, r) < b) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const revenue = (n, r) => (n - 1) / (n + 1) + Math.pow(r, n) - (2 * n * Math.pow(r, n + 1)) / (n + 1);
    const simulate = (n, r) => {
      const rng = new GBC.RNG(41);
      let s1 = 0;
      let s2 = 0;
      for (let t = 0; t < 2000; t++) {
        const vals = U.range(n).map(() => rng.random()).sort((a, b) => b - a);
        if (vals[0] >= r) {
          s2 += Math.max(r, vals[1]);
          s1 += beta(vals[0], n, r);
        }
      }
      return [s1 / 2000, s2 / 2000];
    };
    w.pythonAction(() => `import numpy as np
from gbcourse.rng import Mulberry32

n, v, r = ${s.n}, ${pyNum(s.v)}, ${pyNum(s.r)}
beta = lambda x: 0.0 if x < r else x - (x**n - r**n) / (n * x**(n - 1))   # равновесная ставка 1-й цены
print("2-я цена: ставить v =", v, "  1-я цена: ставить", round(beta(v), 4))
rng = Mulberry32(41)
s1 = s2 = 0.0
for _ in range(2000):
    vals = sorted((rng.random() for _ in range(n)), reverse=True)
    if vals[0] >= r:
        s2 += max(r, vals[1])
        s1 += beta(vals[0])
print("средний доход (2000 торгов): 1-я цена", round(s1 / 2000, 4), " 2-я цена", round(s2 / 2000, 4))
R = lambda r: (n - 1) / (n + 1) + r**n - 2 * n * r**(n + 1) / (n + 1)
print("теория:", round(R(r), 4), "  оптимальный резерв r = 1/2 даёт", round(R(0.5), 4), "вместо", round(R(0), 4))`);
    function draw() {
      const { n, v, r } = s;
      const bs = U.linspace(0, 1, 401);
      const u2 = (b) => (b < r ? 0 : v * Math.pow(b, n - 1) - Math.pow(r, n) - ((n - 1) / n) * (Math.pow(b, n) - Math.pow(r, n)));
      const u1 = (b) => (b < r ? 0 : (v - b) * Math.pow(betaInv(b, n, r), n - 1));
      const b1 = beta(v, n, r);
      plot.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: bs, y: bs.map(u2), color: 'blue', width: 2.5, label: 'аукцион второй цены' },
        { type: 'line', x: bs, y: bs.map(u1), color: 'orange', width: 2.5, dash: '7 4', label: 'аукцион первой цены' },
        v >= r ? { type: 'points', x: [v], y: [u2(v)], color: 'blue', r: 6 } : null,
        v >= r ? { type: 'points', x: [b1], y: [u1(b1)], color: 'orange', r: 6 } : null,
        { type: 'vline', x: v, color: 'ink2', dash: '3 3', width: 1, text: 'b = v' },
        r > 0 ? { type: 'vline', x: r, color: 'critical', dash: '2 4', width: 1, text: 'r' } : null,
      ]);
      const rs = U.linspace(0, 1, 201);
      plot2.render([
        { type: 'line', x: rs, y: rs.map((x) => revenue(n, x)), color: 'model', width: 2.5, label: 'доход при резерве r' },
        { type: 'points', x: [0.5], y: [revenue(n, 0.5)], r: 6, hollow: true, color: 'ink', label: 'оптимум Майерсона r = 1/2' },
        { type: 'points', x: [r], y: [revenue(n, r)], r: 5, color: 'tree' },
      ]);
      const [s1, s2] = simulate(n, r);
      st.set('b2', f3(v) + ' (= v)');
      st.set('b1', v >= r ? f3(b1) : 'не участвовать');
      st.set('rev', f3(s1) + ' / ' + f3(s2) + ' (теория ' + f3(revenue(n, r)) + ')');
      note.innerHTML = '<b>Аукцион второй цены</b> (Викри, 1961): побеждает высшая ставка, а платят вторую. Ставка «по правде» b = v — <b>доминирующая стратегия</b>: ставка решает только, выиграете ли вы, но не сколько заплатите. В <b>аукционе первой цены</b> платят свою ставку, и выгодно её занижать — без резерва до (n − 1)/n·v. Ожидаемый доход продавца при этом одинаков, (n − 1)/(n + 1) = ' + f3((n - 1) / (n + 1)) + ', — <b>теорема об эквивалентности доходов</b>; моделирование 2000 торгов это подтверждает. Резервная цена r = 1/2 повышает доход при любом n (Майерсон, 1981): иногда лот не продаётся, зато сильных участников заставляют платить больше. Это <b>проектирование механизмов</b> — «обратная» теория игр: правила подбирают так, чтобы участникам было выгодно вести себя нужным образом. Так устроены рекламные аукционы, где ставки рассчитывают модели предсказания кликов — часто градиентный бустинг.';
    }
    draw();
  });

  /* ==============================================================================
   * Шаг 42. Стратегическая классификация: игра Штакельберга
   * ============================================================================== */
  GBC.widget('strategic-clf', (el) => {
    const rng = new GBC.RNG(42);
    const Q = U.range(400).map(() => rng.random());
    const s = { B: 0.15, th: 0.5 };
    const w = ui.shell(el, { title: 'Стратегическая классификация: модель как лидер игры', sub: 'Банк одобряет заявку, если балл x ≥ θ. У заявителя истинное качество q (хороший, если q ≥ 0.5), и сначала x = q; но балл можно «подтянуть» на величину до B (ценой усилий), если это даёт одобрение. Банк выбирает θ первым, заявители отвечают.' });
    ui.slider(w.controls, { label: 'Возможность подтянуть балл B', min: 0, max: 0.3, step: 0.01, value: s.B, onInput: (v) => ((s.B = v), draw()) });
    ui.slider(w.controls, { label: 'Порог банка θ', min: 0.2, max: 0.9, step: 0.01, value: s.th, onInput: (v) => ((s.th = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 200, x: { label: 'истинное качество q', domain: [0, 1] }, y: { label: '', domain: [-0.5, 1.5], ticks: [0, 1], format: (v) => (v > 0.5 ? 'одобрен' : 'отказ') } });
    const plot2 = new GBC.Plot(w.main, { height: 220, x: { label: 'порог θ', domain: [0.2, 0.9] }, y: { label: 'точность решений', domain: [0.5, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'acc', label: 'точность при θ' }, { key: 'best', label: 'лучший θ с учётом игры' }, { key: 'eff', label: 'хороших, вынужденных тянуться' }]);
    const acc = (th, B) => {
      let ok = 0;
      Q.forEach((q) => {
        const approved = q >= th - B;
        ok += approved === q >= 0.5 ? 1 : 0;
      });
      return ok / Q.length;
    };
    w.pythonAction(() => `import numpy as np
from gbcourse.rng import Mulberry32

rng = Mulberry32(42)
q = np.array([rng.random() for _ in range(400)])    # истинное качество, хорошие — q ≥ 0.5
B = ${pyNum(s.B)}
def accuracy(theta, B):
    approved = q >= theta - B                         # подтягивают балл все, кому хватает B
    return np.mean(approved == (q >= 0.5))
thetas = np.round(np.arange(0.2, 0.9001, 0.01), 2)
naive = accuracy(0.5, 0.0), accuracy(0.5, B)
best = max(thetas, key=lambda t: accuracy(t, B))
print(f"θ = 0.5: на исторических данных {naive[0]:.3f}, после реакции заявителей {naive[1]:.3f}")
print(f"лучший θ с учётом реакции: {best} → {accuracy(best, B):.3f}  (теория: 0.5 + B = {0.5 + B})")`);
    function draw() {
      const { B, th } = s;
      const ths = U.linspace(0.2, 0.9, 71);
      const a = ths.map((t) => acc(t, B));
      let bi = 0;
      a.forEach((v, i) => v > a[bi] + 1e-12 && (bi = i));
      const approved = Q.map((q) => (q >= th - B ? 1 : 0));
      const gamed = Q.map((q) => q < th && q >= th - B);
      plot.render([
        { type: 'vband', x0: 0.5, x1: 1, color: 'good', opacity: 0.08 },
        { type: 'vline', x: th, color: 'model', width: 2, text: 'θ' },
        { type: 'vline', x: th - B, color: 'tree', width: 1.5, dash: '5 4', text: 'θ − B' },
        { type: 'points', x: Q, y: approved.map((v, i) => v + (((i * 37) % 17) - 8) * 0.025), r: 3, color: (i) => (gamed[i] ? 'tree' : Q[i] >= 0.5 ? 'class1' : 'class0'), label: 'заявители (оранжевые — подтянули балл)', legendColor: 'tree' },
      ]);
      plot2.render([
        { type: 'line', x: ths, y: ths.map((t) => acc(t, 0)), color: 'muted', width: 2, dash: '6 4', label: 'если заявители не реагируют' },
        { type: 'line', x: ths, y: a, color: 'model', width: 2.5, label: 'с учётом реакции заявителей' },
        { type: 'points', x: [th], y: [acc(th, B)], r: 6, color: 'tree' },
        { type: 'vline', x: ths[bi], color: 'good', width: 1.2, dash: '3 3', text: 'лучший' },
      ]);
      const goodForced = Q.filter((q) => q >= 0.5 && q < th && q >= th - B).length / Math.max(1, Q.filter((q) => q >= 0.5).length);
      st.set('acc', f3(acc(th, B)));
      st.set('best', f2(ths[bi]) + ' → ' + f3(a[bi]));
      st.set('eff', pct(goodForced, 0));
      note.innerHTML = 'Модель, обученная на исторических данных, видит лучший порог θ = 0.5. Но после её внедрения люди <b>отвечают</b> на неё: все, кому до порога не хватает меньше B, подтягивают балл — и в одобренные попадают плохие заявители. Это <b>игра Штакельберга</b>: лидер (банк) объявляет правило, ведомые (заявители) отвечают наилучшим образом, и лидер должен выбирать, <em>предвидя</em> ответ. Лучший порог — 0.5 + B: «подтягивание» тогда только возвращает хороших к их честной оценке. Цена — усилия хороших заявителей, которым приходится тянуться (' + pct(goodForced, 0) + ' при текущем θ). Похожие игры — <b>закон Гудхарта</b> («мера становится целью»), спам против фильтра, накрутка рейтингов, <b>состязательные примеры</b> и устойчивое обучение min<sub>модель</sub> max<sub>возмущение</sub> потерь. Признаки, которые легко «подтянуть», делают модель уязвимой; причинные признаки — устойчивой.';
    }
    draw();
  });

  /* ==============================================================================
   * Тренажёр
   * ============================================================================== */
  const IQ = [
    { q: 'Что такое равновесие Нэша?', a: 'набор стратегий, где никому не выгодно отклоняться в одиночку', w: ['исход с наибольшей суммой выигрышей', 'победа одного из игроков', 'исход, где все получают поровну'], why: 'Каждая стратегия — наилучший ответ на остальные.' },
    { q: 'Почему в дилемме заключённого оба сдают друг друга?', a: '«сдать» — строго доминирующая стратегия для каждого', w: ['они не доверяют друг другу', 'так короче срок у обоих', 'это Парето-оптимальный исход'], why: 'При любом ходе сообщника сдать выгоднее, хотя (молчать, молчать) лучше для обоих.' },
    { q: 'Последовательное удаление строго доминируемых стратегий…', a: 'не теряет ни одного равновесия Нэша', w: ['всегда оставляет одну клетку', 'зависит от порядка удаления', 'годится только для игр 2×2'], why: 'Строго доминируемая стратегия не бывает наилучшим ответом; порядок удаления не важен.' },
    { q: 'В «угадай 2/3 среднего» единственное равновесие —', a: 'все называют 0', w: ['все называют 33', 'все называют 50', 'равновесия нет'], why: 'Удаление доминируемых чисел сжимает интервал [0, 100·(2/3)ᵏ] к нулю.' },
    { q: 'Сколько в среднем чистых равновесий у случайной игры n × n?', a: 'ровно 1 при любом n', w: ['n', '0', '1 − 1/e'], why: 'n² клеток, у каждой шанс (1/n)²; доля игр хотя бы с одним равновесием → 1 − 1/e.' },
    { q: 'Парадокс Браеса: что делает новая дорога?', a: 'может увеличить время в пути всем водителям', w: ['всегда сокращает время', 'не меняет время', 'выгодна только тем, кто ею пользуется'], why: 'Равновесие эгоистичных маршрутов — не оптимум; цена анархии > 1.' },
    { q: 'Как выбираются вероятности в смешанном равновесии 2×2?', a: 'чтобы соперник был безразличен между своими ходами', w: ['чтобы максимизировать свой выигрыш напрямую', 'поровну', 'пропорционально своим выигрышам'], why: 'Принцип безразличия: p находят из выигрышей соперника.' },
    { q: 'Игроку 1 добавили бонус в клетке (1, 1). Что изменится в смешанном равновесии?', a: 'вероятности игрока 2, а не игрока 1', w: ['вероятности игрока 1', 'ничего', 'равновесие исчезнет'], why: 'Вероятности игрока 1 делают безразличным игрока 2 и от выигрышей игрока 1 не зависят.' },
    { q: 'Оптимальная доля ударов в «свой» угол по данным пенальти —', a: 'около 39 %', w: ['100 %', '50 %', 'около 80 %'], why: 'p* делает вратарю безразличным, куда прыгать; шанс гола ≈ 79.6 %.' },
    { q: 'Коррелированное равновесие в игре «слабак» может дать каждому…', a: 'больше, чем смешанное равновесие Нэша', w: ['только меньше', 'ровно столько же', 'больше, чем любое распределение'], why: 'Светофор устраняет столкновения: 5.25 против 4.67.' },
    { q: 'Теорема Нэша гарантирует…', a: 'существование равновесия в смешанных стратегиях в любой конечной игре', w: ['единственность равновесия', 'существование чистого равновесия', 'быстрый алгоритм поиска'], why: 'Доказательство — через теорему Брауэра о неподвижной точке.' },
    { q: 'Седловая точка матрицы — это элемент, который…', a: 'наименьший в своей строке и наибольший в своём столбце', w: ['наибольший в матрице', 'на диагонали', 'равен нулю'], why: 'Тогда максимин = минимакс в чистых стратегиях.' },
    { q: 'Теорема фон Неймана о минимаксе утверждает:', a: 'max min = min max в смешанных стратегиях', w: ['первый игрок всегда выигрывает', 'цена игры равна 0', 'есть седловая точка в чистых стратегиях'], why: 'Это сильная двойственность линейного программирования.' },
    { q: 'В прятках с вероятностями найти 0.9, 0.6, 0.3 прятаться выгоднее всего…', a: 'в доме, где найти труднее всего', w: ['в доме, где найти легче всего', 'поровну', 'всегда в первом доме'], why: 'Вероятности пропорциональны 1/dᵢ — и у прячущегося, и у ищущего.' },
    { q: 'Фиктивная игра в игре с нулевой суммой…', a: 'даёт частоты, сходящиеся к оптимальным, хотя ходы прыгают', w: ['сходится за один шаг', 'расходится', 'всегда находит чистое равновесие'], why: 'Теорема Робинсон (1951).' },
    { q: 'Почему «следуй за лидером» плох против противника?', a: 'детерминированный выбор легко предсказать и обмануть', w: ['он медленный', 'он не использует данные', 'он всегда выбирает худшего'], why: 'Сожаление FTL может расти линейно; у Hedge — как √T.' },
    { q: 'Сожаление Hedge с лучшим η растёт как…', a: '√(T ln n / 2)', w: ['T', 'ln T', 'n·T'], why: 'Сумма «цены незнания» ln n/η и «цены дёрганья» ηT/8.' },
    { q: 'Hedge против Hedge в «камень-ножницы-бумага»: что сходится к равновесию?', a: 'средние стратегии', w: ['последние стратегии', 'ничего', 'только выигрыши'], why: 'Текущие стратегии кружат; сходится среднее. Оптимистичный Hedge исправляет и последнюю.' },
    { q: 'На каком методе построены программы, обыгравшие профессионалов в покер?', a: 'минимизация контрфактического сожаления (CFR)', w: ['симплекс-метод', 'градиентный бустинг', 'альфа-бета отсечения'], why: 'Сопоставление сожалений в каждой информационной ситуации.' },
    { q: 'Одновременный градиентный спуск-подъём на f(x, y) = xy…', a: 'уходит по спирали от равновесия', w: ['сходится к (0, 0)', 'стоит на месте', 'сходится к (1, 1)'], why: 'Поле — вращение; помогает экстраградиент или оптимистичный шаг.' },
    { q: 'Почему угроза монополиста «устрою ценовую войну» недостоверна?', a: 'после входа новичка война невыгодна самому монополисту', w: ['монополист всегда лжёт', 'новичок её не слышит', 'война запрещена законом'], why: 'Обратная индукция оставляет совершенное в подыграх равновесие.' },
    { q: 'Позиция в ниме 3, 5, 6 для ходящего…', a: 'проигрышная: XOR равен 0', w: ['выигрышная', 'ничейная', 'зависит от удачи'], why: '3 ⊕ 5 ⊕ 6 = 0: любой ход делает ним-сумму ненулевой.' },
    { q: 'При идеальном порядке ходов альфа-бета просматривает примерно…', a: 'b^(d/2) листьев вместо b^d', w: ['b^d листьев', 'd листьев', 'половину листьев'], why: 'За то же время — вдвое глубже.' },
    { q: 'В торге Рубинштейна с δ₁ = δ₂ = δ первый получает…', a: '1/(1 + δ) — больше половины', w: ['ровно половину', 'всё', 'δ'], why: 'Преимущество первого хода исчезает при δ → 1.' },
    { q: 'Мрачный триггер удерживает сотрудничество, если…', a: 'δ ≥ (T − R)/(T − P)', w: ['δ < 0.5 всегда', 'T < R', 'игра конечна и короткая'], why: 'Сравнение R/(1 − δ) и T + δP/(1 − δ).' },
    { q: 'Почему «око за око» побеждало в турнирах Аксельрода?', a: 'добрая, отвечает на предательство, прощает и понятна', w: ['выигрывает каждый матч', 'всегда предаёт', 'играет случайно'], why: 'Она не выигрывает ни одного матча, но набирает больше всех в сумме.' },
    { q: 'Ядро игры «большинство из трёх»…', a: 'пусто', w: ['одна точка', 'весь треугольник', 'совпадает со значением Шепли'], why: 'Каждая пара требует 1, а делить всего 1.' },
    { q: 'Что такое значение Шепли?', a: 'средний вклад участника по всем порядкам прихода', w: ['вклад при приходе последним', 'доля по весу', 'вклад в одиночку'], why: 'φⱼ = среднее по n! порядкам прироста v.' },
    { q: 'У Люксембурга в Совете ЕЭС (1958) был 1 голос из 17. Его власть по Шепли — Шубику —', a: '0', w: ['1/17', '1/6', '1/2'], why: 'При квоте 12 его голос никогда не был решающим.' },
    { q: 'Какое свойство Шепли гарантирует: сумма SHAP = прогноз − базовое значение?', a: 'эффективность', w: ['симметрия', 'болванчик', 'аддитивность'], why: 'Σφⱼ = v(N) − v(∅).' },
    { q: 'Какое свойство позволяет считать SHAP бустинга дерево за деревом?', a: 'аддитивность', w: ['эффективность', 'симметрия', 'монотонность'], why: 'Значение Шепли суммы игр — сумма значений.' },
    { q: 'Ошибка оценки Шепли по K случайным порядкам убывает как…', a: '1/√K', w: ['1/K', 'e^(−K)', 'не убывает'], why: 'Среднее K независимых величин.' },
    { q: 'Веса объектов в AdaBoost с точки зрения теории игр —', a: 'смешанная стратегия противника, обновляемая Hedge', w: ['стратегия бустера', 'цена игры', 'равновесие Нэша'], why: 'Вес ∝ exp(−отступ).' },
    { q: 'Какая ставка оптимальна в аукционе второй цены?', a: 'ровно своя ценность', w: ['половина ценности', 'чуть выше ценности', 'зависит от соперников'], why: 'Честная ставка — доминирующая стратегия.' },
    { q: 'Банк знает, что заявители могут подтянуть балл на B. Лучший порог —', a: '0.5 + B', w: ['0.5', '0.5 − B', 'B'], why: 'Лидер игры Штакельберга предвидит ответ ведомых.' },
  ];
  GBC.widget('game-trainer', (el) => {
    const st0 = { order: [], i: 0, right: 0, streak: 0, picked: null, round: 1, opts: [] };
    const rng = new GBC.RNG(2121);
    const w = ui.shell(el, { title: 'Тренажёр: теория игр', sub: IQ.length + ' вопросов по всем блокам урока в случайном порядке; варианты ответа перемешиваются.' });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.05rem;padding:6px 0 12px' });
    w.main.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:8px' });
    w.main.appendChild(optsBox);
    const next = ui.button(w.controls, { label: 'Следующий', icon: 'step', onClick: () => advance() });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    const shuffleQ = () => (st0.order = rng.permutation(IQ.length));
    const setOpts = () => {
      const Q = IQ[st0.order[st0.i]];
      st0.opts = rng.shuffle([Q.a, ...Q.w]);
    };
    function advance() {
      st0.i++;
      if (st0.i >= IQ.length) {
        shuffleQ();
        st0.i = 0;
      }
      st0.round++;
      st0.picked = null;
      setOpts();
      draw();
    }
    function draw() {
      const Q = IQ[st0.order[st0.i]];
      qEl.textContent = Q.q;
      optsBox.textContent = '';
      st0.opts.forEach((o) => {
        const isRight = o === Q.a;
        const b = ui.button(optsBox, {
          label: o,
          kind: st0.picked === null ? '' : isRight ? 'primary' : o === st0.picked ? 'danger' : '',
          onClick: () => {
            if (st0.picked !== null) return;
            st0.picked = o;
            if (isRight) {
              st0.right++;
              st0.streak++;
            } else st0.streak = 0;
            draw();
          },
        });
        b.style.whiteSpace = 'normal';
        b.style.textAlign = 'left';
        b.style.height = 'auto';
        b.style.justifyContent = 'flex-start';
        if (st0.picked !== null) b.disabled = true;
      });
      st.set('r', st0.round + ' (' + (st0.i + 1) + ' из ' + IQ.length + ')');
      st.set('ok', st0.right + ' из ' + (st0.round - (st0.picked === null ? 1 : 0)));
      st.set('s', String(st0.streak));
      note.innerHTML = st0.picked === null ? 'Подсказка: спросите себя, кому выгодно отклониться и что знает каждый игрок.' : (st0.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет.</b> Правильный ответ: ' + Q.a + '. ') + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), st0.picked === null ? 'Пропустить' : 'Следующий');
    }
    shuffleQ();
    setOpts();
    draw();
  });
})();
