/* Урок 15.19: математическая логика. Часть 2 — булевы функции и схемы, логика в данных, кванторы.
 * Виджеты: 16 функций двух переменных; СДНФ и СКНФ по таблице; карта Карно с минимальной ДНФ и
 * безразличными наборами; всё из NAND; классы Поста и полнота; сумматор; диаграмма Венна для трёх множеств;
 * булевы маски; пропуски и трёхзначная логика; импликации и метрики классификатора; правила «если — то»
 * на данных; предикат двух переменных и кванторы как проекции; кванторы по области (в том числе пустой);
 * порядок кванторов; машина отрицаний; игра ε–N; проверка монотонности модели.
 * Помощники — из GBC.lesson1519 (часть 1, lesson.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const {
    f2, f3, grp, pct, plural, cvar, tint, C_TRUE, C_FALSE, flexRow, texInto, texEl, card, cardGrid, badge, rowTable, monoBox, svgBox, sText, legendRow, boolTable,
    OPS, P, str, tex, py, compile, envs, outs, subformulas, kindOf, compare, sdnf, scnf, minDNF, implText, dnfText, postClasses,
    formulaInput, PY_IT, pyLambda,
  } = GBC.lesson1519;
  const bitsOf = (i, n) => U.range(n).map((j) => (i >> (n - 1 - j)) & 1);
  const VN = ['A', 'B', 'C', 'D'];

  /* ==============================================================================
   * 13. Все 16 булевых функций двух переменных
   * ============================================================================== */
  const F16 = [
    ['0', 'константа 0', '0'], ['A ∧ B', 'конъюнкция «и»', 'A ∧ B'], ['A ∧ ¬B', 'запрет: «A, но не B»', 'A ∧ ¬B'], ['A', 'повтор A', 'A'],
    ['¬A ∧ B', 'запрет: «B, но не A»', '¬A ∧ B'], ['B', 'повтор B', 'B'], ['A ⊕ B', 'исключающее «или» (XOR)', 'A ⊕ B'], ['A ∨ B', 'дизъюнкция «или»', 'A ∨ B'],
    ['A ↓ B', 'стрелка Пирса (NOR): «ни A, ни B»', 'A ↓ B'], ['A ↔ B', 'эквивалентность', 'A ↔ B'], ['¬B', 'отрицание B', '¬B'], ['B → A', 'обратная импликация', 'B → A'],
    ['¬A', 'отрицание A', '¬A'], ['A → B', 'импликация', 'A → B'], ['A ↑ B', 'штрих Шеффера (NAND): «не оба»', 'A ↑ B'], ['1', 'константа 1', '1'],
  ].map(([t, name, f], code) => ({ t, name, ast: P(f), o: bitsOf(code, 4) }));
  GBC.widget('bool16', (el) => {
    const s = { code: 6 };
    const w = ui.shell(el, { title: 'Все булевы функции двух переменных', sub: 'Функция двух переменных — столбец из 4 значений (для строк 00, 01, 10, 11). Вариантов 2⁴ = 16 — вот они все. Щёлкните карточку или переключайте значения вручную.', stack: true });
    const bits = flexRow('gap:6px;margin-bottom:8px');
    const grid = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(150px,100%),1fr));gap:8px' });
    const detail = cardGrid(240);
    w.main.append(bits, grid, detail);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'функция' }, { key: 'dep', label: 'существенно зависит от' }, { key: 'sym', label: 'симметрична' }]);
    function draw() {
      const F = F16[s.code];
      bits.textContent = '';
      bits.appendChild(H('span', { style: 'font-size:.9rem;color:var(--ink-2)' }, 'Столбец значений f(A, B):'));
      ['00', '01', '10', '11'].forEach((r, k) => {
        const b = ui.button(bits, { label: 'f(' + r[0] + ',' + r[1] + ') = ' + F.o[k], small: true, onClick: () => ((s.code ^= 1 << (3 - k)), draw()) });
        b.style.fontFamily = 'var(--font-mono)';
        if (F.o[k]) (b.style.background = tint(C_TRUE, 30)), (b.style.borderColor = C_TRUE);
      });
      grid.textContent = '';
      F16.forEach((G, code) => {
        const on = code === s.code;
        const c = H('button', { type: 'button', style: 'text-align:left;border-radius:10px;padding:8px 10px;cursor:pointer;background:' + (on ? tint(C_TRUE, 20) : 'var(--surface)') + ';border:' + (on ? '2px solid ' + C_TRUE : '1px solid var(--border)') + ';color:var(--ink)' });
        c.appendChild(H('div', { style: 'font-family:var(--font-mono);font-weight:700' }, G.t));
        c.appendChild(H('div', { style: 'font-size:.78rem;color:var(--ink-2);margin:2px 0' }, G.name));
        c.appendChild(H('div', { style: 'font-family:var(--font-mono);font-size:.82rem;letter-spacing:2px;color:var(--ink-2)' }, G.o.join('')));
        c.addEventListener('click', () => ((s.code = code), draw()));
        grid.appendChild(c);
      });
      detail.textContent = '';
      const c1 = card('Таблица истинности');
      boolTable(c1.body, ['A', 'B', F.t], [[0, 0, F.o[0]], [0, 1, F.o[1]], [1, 0, F.o[2]], [1, 1, F.o[3]]], { outCols: new Set([2]), sepAfter: 1 });
      const c2 = card('Свойства');
      const pc = postClasses(F.o);
      const depA = F.o[0] !== F.o[2] || F.o[1] !== F.o[3];
      const depB = F.o[0] !== F.o[1] || F.o[2] !== F.o[3];
      const sym = F.o[1] === F.o[2];
      [['сохраняет 0: f(0,0) = 0', pc.T0], ['сохраняет 1: f(1,1) = 1', pc.T1], ['монотонна', pc.M], ['линейна (A ⊕ B ⊕ константа)', pc.L], ['самодвойственна', pc.S], ['симметрична: f(A,B) = f(B,A)', sym]].forEach(([t, v]) => c2.body.appendChild(H('div', { style: 'margin:2px 0;font-size:.88rem' }, (v ? '✔ ' : '✘ ') + t)));
      detail.append(c1.el, c2.el);
      st.set('f', F.t + ' — ' + F.name);
      st.set('dep', depA && depB ? 'A и B' : depA ? 'только A' : depB ? 'только B' : 'ни от одной');
      st.set('sym', sym ? 'да' : 'нет');
      note.innerHTML = 'Среди 16 функций: 2 константы, 4 зависят от одной переменной (A, B, ¬A, ¬B), остальные 10 — «настоящие» связки, и только 4 из них несимметричны (импликации и запреты: от перестановки A и B они меняются). Знакомые нам ¬, ∧, ∨, →, ↔, ⊕ — лишь часть списка; NAND и NOR будут героями шага 16. Число функций растёт как <b>2 в степени 2ⁿ</b>: n = 1 — 4, n = 2 — 16, n = 3 — 256, n = 4 — 65 536, n = 5 — 4 294 967 296, n = 6 — 1.8·10¹⁹. Поэтому никакая модель не может «выучить любую функцию» по небольшим данным — нужны предположения о форме ответа (шаг 36).';
    }
    w.pythonAction(() => PY_IT + '\nrows = list(product([0, 1], repeat=2))\nfor code in range(16):\n    col = [(code >> (3 - k)) & 1 for k in range(4)]          # f(0,0), f(0,1), f(1,0), f(1,1)\n    print(f"{code:2d}", "".join(map(str, col)))\nprint("функций от n переменных:", [2 ** (2 ** n) for n in range(1, 7)])\n');
    draw();
  });

  /* ==============================================================================
   * 14. СДНФ и СКНФ: формула по таблице
   * ============================================================================== */
  const DNF_PRESETS = {
    imp: { n: 2, o: [1, 1, 0, 1], t: 'A → B' },
    xor: { n: 2, o: [0, 1, 1, 0], t: 'A ⊕ B' },
    maj: { n: 3, o: [0, 0, 0, 1, 0, 1, 1, 1], t: 'большинство из трёх' },
    one: { n: 3, o: [0, 1, 1, 0, 1, 0, 0, 0], t: 'ровно одна единица' },
    par: { n: 3, o: [0, 1, 1, 0, 1, 0, 0, 1], t: 'чётность (A ⊕ B ⊕ C)' },
    thr: { n: 4, o: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1], t: 'не меньше трёх единиц из четырёх' },
  };
  GBC.widget('dnf-cnf', (el) => {
    const s = { key: 'maj', n: 3, o: DNF_PRESETS.maj.o.slice() };
    const w = ui.shell(el, { title: 'Формула по таблице: СДНФ и СКНФ', sub: 'Любую таблицу можно записать формулой. СДНФ — «или» по строкам с единицей (каждая строка — «и» всех переменных); СКНФ — «и» по строкам с нулём. Щёлкайте по столбцу f, чтобы менять функцию.' });
    ui.select(w.controls, { label: 'Функция', value: s.key, options: Object.entries(DNF_PRESETS).map(([k, v]) => ({ value: k, label: v.t + ' (n = ' + v.n + ')' })), onChange: (v) => ((s.key = v), (s.n = DNF_PRESETS[v].n), (s.o = DNF_PRESETS[v].o.slice()), draw()) });
    ui.segmented(w.controls, { label: 'Число переменных', value: 3, options: [2, 3, 4].map((n) => ({ value: n, label: String(n) })), onChange: (v) => ((s.n = v), (s.o = new Array(1 << v).fill(0)), draw()) });
    const tbl = H('div');
    const forms = H('div', { style: 'display:grid;gap:8px;margin-top:6px' });
    w.main.append(tbl, forms);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'слагаемых СДНФ' }, { key: 'c', label: 'множителей СКНФ' }, { key: 'm', label: 'минимальная ДНФ' }]);
    function draw() {
      const vars = VN.slice(0, s.n);
      const E = envs(vars);
      tbl.textContent = '';
      const wrap = boolTable(tbl, [...vars, 'f', 'слагаемое СДНФ / множитель СКНФ'], E.map((e, i) => [...vars.map((v) => e[v]), s.o[i], s.o[i] ? vars.map((v) => (e[v] ? v : '¬' + v)).join(' ∧ ') : '(' + vars.map((v) => (e[v] ? '¬' + v : v)).join(' ∨ ') + ')']), { good: (i) => s.o[i] === 1, outCols: new Set([s.n]), sepAfter: s.n - 1 });
      wrap.querySelectorAll('tbody tr').forEach((tr, i) => {
        const td = tr.children[s.n];
        td.style.cursor = 'pointer';
        td.title = 'Щёлкните, чтобы изменить значение';
        td.addEventListener('click', () => ((s.o[i] = 1 - s.o[i]), draw()));
      });
      const d = sdnf(vars, s.o);
      const c = scnf(vars, s.o);
      const ones = s.o.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      const m = minDNF(s.n, ones);
      forms.textContent = '';
      [['СДНФ (по единицам)', d.tex], ['СКНФ (по нулям)', c.tex], ['Минимальная ДНФ (шаг 15)', m.constant === 1 ? '1' : dnfText(m.cover, vars, true)]].forEach(([t, x]) => {
        const cd = card(t);
        cd.body.appendChild(texEl(x, false, 'padding:2px 0'));
        forms.appendChild(cd.el);
      });
      st.set('d', String(d.terms.length));
      st.set('c', String(c.terms.length));
      st.set('m', m.constant === 1 ? 'константа 1' : (m.cover ? m.cover.length : 0) + ' ' + plural(m.cover ? m.cover.length : 0, 'слагаемое', 'слагаемых', 'слагаемых'));
      note.innerHTML = 'Почему это работает: слагаемое СДНФ, например A ∧ ¬B ∧ C, истинно ровно в одной строке (101). «Или» таких слагаемых истинно ровно в строках с единицей. Двойственно, множитель СКНФ ложен ровно в одной строке. Отсюда важнейший факт: <b>{¬, ∧, ∨} достаточно, чтобы выразить любую булеву функцию</b>. Цена — длина: у функции «большинство» 4 слагаемых СДНФ, а минимальная ДНФ — 3 коротких; у чётности СДНФ не сокращается вовсе (2ⁿ⁻¹ слагаемых), и именно чётность труднее всего даётся деревьям (шаг 35). Дерево решений — тоже ДНФ: каждый лист с ответом 1 — слагаемое (шаг 34).';
    }
    w.pythonAction(() => {
      const vars = VN.slice(0, s.n);
      return PY_IT + '\nvars_ = ' + JSON.stringify(vars) + '\nf = ' + JSON.stringify(s.o) + '          # столбец таблицы\nrows = list(product([0, 1], repeat=' + s.n + '))\nlit = lambda v, b: v if b else "¬" + v\nsdnf = " ∨ ".join("(" + " ∧ ".join(lit(v, b) for v, b in zip(vars_, r)) + ")" for r, y in zip(rows, f) if y)\nscnf = " ∧ ".join("(" + " ∨ ".join(lit(v, 1 - b) for v, b in zip(vars_, r)) + ")" for r, y in zip(rows, f) if not y)\nprint("СДНФ:", sdnf or "0")\nprint("СКНФ:", scnf or "1")\n# проверка: СДНФ истинна ровно в строках с f = 1\nterm = lambda r, t: all(a == b for a, b in zip(r, t))\nprint(all(any(term(r, t) for t, y in zip(rows, f) if y) == bool(y) for r, y in zip(rows, f)))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 15. Карта Карно и минимальная ДНФ
   * ============================================================================== */
  const GRAY = [0, 1, 3, 2];
  const KM_PRESETS = [
    { t: '★ пара соседей: ¬A ∧ B ∧ ¬C ∨ ¬A ∧ B ∧ C', n: 3, ones: [2, 3], dc: [] },
    { t: '★★ большинство из трёх', n: 3, ones: [3, 5, 6, 7], dc: [] },
    { t: '★★ углы карты (склейка через край)', n: 4, ones: [0, 2, 8, 10], dc: [] },
    { t: '★★ «A или (B и не D)»', n: 4, ones: [4, 6, 8, 9, 10, 11, 12, 13, 14, 15], dc: [] },
    { t: '★★★ цифра 5…9 в двоичном коде, коды 10–15 не встречаются', n: 4, ones: [5, 6, 7, 8, 9], dc: [10, 11, 12, 13, 14, 15] },
    { t: '★★★ чётность — не склеивается', n: 4, ones: [1, 2, 4, 7, 8, 11, 13, 14], dc: [] },
  ];
  GBC.widget('karnaugh', (el) => {
    const s = { n: 3, cell: new Array(16).fill(0) };
    const load = (p) => {
      s.n = p.n;
      s.cell = new Array(16).fill(0);
      p.ones.forEach((m) => (s.cell[m] = 1));
      p.dc.forEach((m) => (s.cell[m] = 2));
    };
    load(KM_PRESETS[1]);
    const w = ui.shell(el, { title: 'Карта Карно: склеиваем соседние единицы', sub: 'Клетки расставлены кодом Грея: соседние (и через край) отличаются одной переменной. Прямоугольник из 1, 2, 4, 8 единиц — одно слагаемое без «лишних» переменных. Щелчок по клетке: 0 → 1 → – (безразлично) → 0.' });
    ui.select(w.controls, { label: 'Пример', value: 1, options: KM_PRESETS.map((p, i) => ({ value: i, label: p.t })), onChange: (v) => (load(KM_PRESETS[+v]), draw()) });
    ui.segmented(w.controls, { label: 'Переменных', value: 3, options: [3, 4].map((n) => ({ value: n, label: String(n) })), onChange: (v) => ((s.n = v), (s.cell = new Array(16).fill(0)), draw()) });
    ui.button(w.controls, { label: 'Очистить', icon: 'reset', onClick: () => (s.cell.fill(0), draw()) });
    const holder = H('div');
    const terms = H('div', { style: 'margin-top:4px' });
    w.main.append(holder, terms);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'one', label: 'единиц' }, { key: 'pi', label: 'простых импликант' }, { key: 'min', label: 'минимальная ДНФ' }, { key: 'sd', label: 'СДНФ' }]);
    function draw() {
      const n = s.n;
      const vars = VN.slice(0, n);
      const R = n === 4 ? 4 : 2;
      const Cc = 4;
      const mOf = (r, c) => (n === 4 ? (GRAY[r] << 2) | GRAY[c] : (r << 2) | GRAY[c]);
      const ones = [];
      const dcs = [];
      for (let m = 0; m < 1 << n; m++) (s.cell[m] === 1 ? ones : s.cell[m] === 2 ? dcs : []).push(m);
      const res = minDNF(n, ones, dcs);
      const cover = res.cover || [];
      holder.textContent = '';
      const cw = 66;
      const ch = 50;
      const ox = 74;
      const oy = 46;
      const svg = svgBox(holder, ox + Cc * cw + 10, oy + R * ch + 10, 300, 440);
      const rowLab = n === 4 ? 'AB' : 'A';
      const colLab = n === 4 ? 'CD' : 'BC';
      svg.appendChild(sText(ox - 40, oy - 24, rowLab + ' \\ ' + colLab, { size: 12, color: 'var(--ink-2)' }));
      for (let c = 0; c < Cc; c++) svg.appendChild(sText(ox + c * cw + cw / 2, oy - 12, GRAY[c].toString(2).padStart(2, '0'), { mono: true, bold: true }));
      for (let r = 0; r < R; r++) svg.appendChild(sText(ox - 18, oy + r * ch + ch / 2, n === 4 ? GRAY[r].toString(2).padStart(2, '0') : String(r), { mono: true, bold: true }));
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < Cc; c++) {
          const m = mOf(r, c);
          const v = s.cell[m];
          const x = ox + c * cw;
          const y = oy + r * ch;
          const g = S('g', { style: 'cursor:pointer' });
          g.appendChild(S('rect', { x, y, width: cw, height: ch, fill: v === 1 ? tint(C_TRUE, 14) : 'var(--surface)', stroke: 'var(--border-strong)', 'stroke-width': 1 }));
          cover.forEach((p, i) => {
            if ((m & p.mask) !== (p.v & p.mask)) return;
            const ins = 4 + 5 * (i % 4);
            g.appendChild(S('rect', { x: x + ins, y: y + ins, width: cw - 2 * ins, height: ch - 2 * ins, rx: 8, fill: tint(cvar(i), 22), stroke: cvar(i), 'stroke-width': 2.4 }));
          });
          g.appendChild(sText(x + cw / 2, y + ch / 2, v === 2 ? '–' : String(v), { size: 17, bold: v === 1, color: v === 1 ? C_TRUE : 'var(--muted)', mono: true }));
          g.appendChild(sText(x + cw - 8, y + ch - 8, String(m), { size: 9, color: 'var(--muted)', anchor: 'end' }));
          g.addEventListener('click', () => ((s.cell[m] = (s.cell[m] + 1) % 3), draw()));
          svg.appendChild(g);
        }
      }
      terms.textContent = '';
      if (res.constant === 1) terms.appendChild(H('div', null, 'f ≡ 1: все клетки — единицы (или безразличные).'));
      else if (!ones.length) terms.appendChild(H('div', null, 'Единиц нет: f ≡ 0.'));
      else {
        const row = flexRow('gap:8px');
        row.appendChild(H('span', { style: 'font-weight:650' }, 'f ='));
        cover.forEach((p, i) => {
          if (i) row.appendChild(H('span', null, '∨'));
          const t = H('span', { style: 'padding:2px 8px;border-radius:8px;border:2px solid ' + cvar(i) + ';background:' + tint(cvar(i), 18) });
          texInto(t, implText(p, vars, true));
          row.appendChild(t);
        });
        terms.appendChild(row);
      }
      st.set('one', ones.length + (dcs.length ? ' (+' + dcs.length + ' –)' : ''));
      st.set('pi', String(res.primes.length));
      st.set('min', res.constant === 1 ? '1' : cover.length + ' слаг., ' + cover.reduce((a, p) => a + GBC.lesson1519.popcount(p.mask), 0) + ' литер.');
      st.set('sd', ones.length + ' слаг., ' + ones.length * n + ' литер.');
      note.innerHTML = 'Склейка — это закон (X ∧ Y) ∨ (X ∧ ¬Y) ≡ X из шага 9: две соседние единицы отличаются одной переменной, и она исчезает. Блок из 4 клеток убирает две переменные, из 8 — три. Минимальную ДНФ здесь находит алгоритм Куайна — Мак-Класки: все простые импликанты (максимальные блоки), затем наименьшее покрытие единиц. <b>Безразличные наборы</b> («–») можно считать и нулём, и единицей — как удобнее для упрощения. В примере с цифрами коды 10–15 никогда не встречаются, и формула сжимается до A ∨ B ∧ D ∨ B ∧ C. Это модель того, что происходит в ML: на комбинациях признаков, которых нет в обучающих данных, модель вправе отвечать как угодно, и выбор «простейшего» ответа и есть её обобщение. Чётность не склеивается вовсе: соседние клетки всегда различаются.';
    }
    w.pythonAction(() => {
      const vars = VN.slice(0, s.n);
      const ones = [];
      const dcs = [];
      for (let m = 0; m < 1 << s.n; m++) (s.cell[m] === 1 ? ones : s.cell[m] === 2 ? dcs : []).push(m);
      const res = minDNF(s.n, ones, dcs);
      const f = res.constant === 1 ? '1' : dnfText(res.cover || [], vars);
      const astF = P(f === '' ? '0' : f);
      return PY_IT + '\nones, dont_care = ' + JSON.stringify(ones) + ', ' + JSON.stringify(dcs) + '\nf = ' + pyLambda(astF, vars) + '   # ' + f + '\nok = all(bool(f(*r)) == (m in ones) for m, r in enumerate(product([False, True], repeat=' + s.n + ')) if m not in dont_care)\nprint("минимальная ДНФ совпадает с таблицей:", ok)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 16. Всё из NAND
   * ============================================================================== */
  const NAND_C = [
    { t: '¬A = A ↑ A', target: '¬A', gates: [['A', 'A']] },
    { t: 'A ∧ B = (A ↑ B) ↑ (A ↑ B)', target: 'A ∧ B', gates: [['A', 'B'], [0, 0]] },
    { t: 'A ∨ B = (A ↑ A) ↑ (B ↑ B)', target: 'A ∨ B', gates: [['A', 'A'], ['B', 'B'], [0, 1]] },
    { t: 'A → B = A ↑ (B ↑ B)', target: 'A → B', gates: [['B', 'B'], ['A', 0]] },
    { t: 'A ⊕ B — четыре вентиля', target: 'A ⊕ B', gates: [['A', 'B'], ['A', 0], ['B', 0], [1, 2]] },
  ].map((c) => ({ ...c, ta: P(c.target) }));
  GBC.widget('nand-builder', (el) => {
    const s = { c: 2, A: 1, B: 0 };
    const w = ui.shell(el, { title: 'Всё из одного вентиля: NAND (штрих Шеффера)', sub: 'A ↑ B = ¬(A ∧ B). Из таких вентилей собираются ¬, ∧, ∨, → и ⊕. Провода с 1 — синие, с 0 — серые.' });
    ui.select(w.controls, { label: 'Собрать', value: s.c, options: NAND_C.map((c, i) => ({ value: i, label: c.t })), onChange: (v) => ((s.c = +v), draw()) });
    ui.toggle(w.controls, { label: 'A = 1', checked: true, onChange: (v) => ((s.A = v ? 1 : 0), draw()) });
    ui.toggle(w.controls, { label: 'B = 1', checked: false, onChange: (v) => ((s.B = v ? 1 : 0), draw()) });
    const holder = H('div');
    const tbl = H('div');
    w.main.append(holder, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'вентилей' }, { key: 'out', label: 'выход' }, { key: 'ok', label: 'совпадает с целью' }]);
    const run = (C, e) => {
      const v = [];
      const get = (x) => (typeof x === 'number' ? v[x] : e[x]);
      C.gates.forEach(([a, b]) => v.push(1 - (get(a) & get(b))));
      return v;
    };
    function draw() {
      const C = NAND_C[s.c];
      const e = { A: s.A, B: s.B };
      const v = run(C, e);
      const lvl = [];
      C.gates.forEach(([a, b], i) => (lvl[i] = 1 + Math.max(typeof a === 'number' ? lvl[a] : 0, typeof b === 'number' ? lvl[b] : 0)));
      const L = Math.max(...lvl);
      const perL = U.range(L + 1).map((l) => C.gates.map((g, i) => i).filter((i) => lvl[i] === l));
      const W = 90 + L * 140 + 70;
      const Hh = Math.max(150, Math.max(...perL.map((a) => a.length)) * 80 + 40);
      holder.textContent = '';
      const svg = svgBox(holder, W, Hh, 320, 640);
      const pos = {};
      pos.A = { x: 40, y: Hh * 0.33 };
      pos.B = { x: 40, y: Hh * 0.7 };
      perL.forEach((ids, l) => ids.forEach((i, k) => (pos[i] = { x: 60 + l * 140, y: ((k + 1) * Hh) / (ids.length + 1) })));
      const col = (x) => (x ? C_TRUE : 'var(--border-strong)');
      const wire = (from, toX, toY, val) => {
        const fx = typeof from === 'number' ? pos[from].x + 34 : pos[from].x + 10;
        const fy = pos[from].y;
        const mx = (fx + toX) / 2;
        svg.appendChild(S('path', { d: 'M' + fx + ' ' + fy + ' C' + mx + ' ' + fy + ' ' + mx + ' ' + toY + ' ' + toX + ' ' + toY, fill: 'none', stroke: col(val), 'stroke-width': val ? 3 : 2 }));
      };
      C.gates.forEach(([a, b], i) => {
        const p = pos[i];
        const get = (x) => (typeof x === 'number' ? v[x] : e[x]);
        wire(a, p.x - 30, p.y - 9, get(a));
        wire(b, p.x - 30, p.y + 9, get(b));
      });
      const last = C.gates.length - 1;
      svg.appendChild(S('path', { d: 'M' + (pos[last].x + 34) + ' ' + pos[last].y + ' L' + (W - 40) + ' ' + pos[last].y, stroke: col(v[last]), 'stroke-width': 3, fill: 'none' }));
      C.gates.forEach((g, i) => {
        const p = pos[i];
        svg.appendChild(S('path', { d: 'M' + (p.x - 30) + ' ' + (p.y - 20) + ' h18 a20 20 0 0 1 0 40 h-18 z', fill: v[i] ? tint(C_TRUE, 26) : 'var(--surface-2)', stroke: 'var(--ink-2)', 'stroke-width': 1.6 }));
        svg.appendChild(S('circle', { cx: p.x + 12, cy: p.y, r: 4.5, fill: 'var(--surface)', stroke: 'var(--ink-2)', 'stroke-width': 1.6 }));
        svg.appendChild(sText(p.x - 10, p.y, '↑', { size: 15, bold: true }));
        svg.appendChild(sText(p.x - 10, p.y - 28, 'g' + (i + 1) + ' = ' + v[i], { size: 11, color: 'var(--ink-2)' }));
      });
      ['A', 'B'].forEach((x) => {
        svg.appendChild(S('circle', { cx: pos[x].x, cy: pos[x].y, r: 13, fill: e[x] ? tint(C_TRUE, 32) : 'var(--surface-2)', stroke: col(e[x]), 'stroke-width': 2 }));
        svg.appendChild(sText(pos[x].x, pos[x].y, x, { bold: true }));
      });
      svg.appendChild(sText(W - 20, pos[last].y, String(v[last]), { size: 18, bold: true, color: v[last] ? C_TRUE : 'var(--muted)' }));
      tbl.textContent = '';
      const rows = [[0, 0], [0, 1], [1, 0], [1, 1]];
      boolTable(tbl, ['A', 'B', 'схема из NAND', C.target], rows.map(([a, b]) => [a, b, run(C, { A: a, B: b })[last], compile(C.ta)({ A: a, B: b })]), { hl: (i) => rows[i][0] === s.A && rows[i][1] === s.B, outCols: new Set([2, 3]), sepAfter: 1 });
      const ok = rows.every(([a, b]) => run(C, { A: a, B: b })[last] === compile(C.ta)({ A: a, B: b }));
      st.set('g', String(C.gates.length));
      st.set('out', String(v[last]));
      st.set('ok', ok ? 'да, во всех 4 строках' : 'нет');
      note.innerHTML = 'Набор связок <b>функционально полон</b>, если через него выражается любая булева функция. Из шага 14 знаем, что полон {¬, ∧, ∨}. Значит, достаточно собрать из NAND отрицание, «и» и «или» — и полна одна-единственная связка NAND. Поэтому микросхемы можно строить из одного типа вентиля (то же верно для NOR). Цена — число вентилей: XOR требует четырёх NAND. А вот {∧, ∨} без отрицания не полон: из них нельзя получить даже ¬A — почему, объясняет теорема Поста (виджет ниже).';
    }
    w.pythonAction(() => {
      const C = NAND_C[s.c];
      return PY_IT + '\nnand = lambda a, b: not (a and b)\n\ndef circuit(A, B):\n    g = []\n' + C.gates.map(([a, b]) => '    g.append(nand(' + (typeof a === 'number' ? 'g[' + a + ']' : a) + ', ' + (typeof b === 'number' ? 'g[' + b + ']' : b) + '))').join('\n') + '\n    return g[-1]\n\ntarget = ' + pyLambda(C.ta, ['A', 'B']) + '   # ' + C.target + '\nprint(all(circuit(A, B) == target(A, B) for A, B in product([False, True], repeat=2)))\n';
    });
    draw();
  });

  /* ---------- классы Поста ---------- */
  const POST_OPS = [
    ['¬', '¬A'], ['∧', 'A ∧ B'], ['∨', 'A ∨ B'], ['→', 'A → B'], ['⊕', 'A ⊕ B'], ['↔', 'A ↔ B'], ['↑ (NAND)', 'A ↑ B'], ['↓ (NOR)', 'A ↓ B'], ['0', '0'], ['1', '1'],
  ].map(([t, f]) => {
    const ast = P(f);
    const vars = ['A', 'B'];
    return { t, f, cls: postClasses(outs(ast, vars)) };
  });
  const POST_NAMES = [['T0', 'сохраняет 0'], ['T1', 'сохраняет 1'], ['S', 'самодвойственная'], ['M', 'монотонная'], ['L', 'линейная']];
  GBC.widget('post', (el) => {
    const sel = new Set([1, 2]);
    const w = ui.shell(el, { title: 'Теорема Поста: когда набор связок полон', sub: 'Есть пять «ловушек» — классов функций, замкнутых относительно подстановок. Набор полон, если для каждого класса в наборе есть функция вне его. ✔ — функция лежит в классе.' });
    const boxes = POST_OPS.map((o, i) => ui.toggle(w.controls, { label: o.t, checked: sel.has(i), onChange: (v) => (v ? sel.add(i) : sel.delete(i), draw()) }));
    const pres = flexRow('gap:4px;margin-top:4px');
    w.controls.appendChild(pres);
    [['{∧, ∨}', [1, 2]], ['{¬, ∧}', [0, 1]], ['{↑}', [6]], ['{→}', [3]], ['{→, 0}', [3, 8]], ['{⊕, ↔}', [4, 5]], ['{⊕, ∧, 1}', [4, 1, 9]]].forEach(([t, ids]) => ui.button(pres, { label: t, small: true, kind: 'ghost', onClick: () => {
      sel.clear();
      ids.forEach((i) => sel.add(i));
      boxes.forEach((b, i) => b.set(sel.has(i)));
      draw();
    } }));
    const tbl = H('div');
    const verdict = H('div', { style: 'font-weight:650;margin-top:6px' });
    w.main.append(tbl, verdict);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'связок в наборе' }, { key: 'v', label: 'полон?' }]);
    function draw() {
      const ids = [...sel].sort((a, b) => a - b);
      tbl.textContent = '';
      const rows = ids.map((i) => [POST_OPS[i].t + '   (' + POST_OPS[i].f + ')', ...POST_NAMES.map(([k]) => (POST_OPS[i].cls[k] ? '✔' : '✘'))]);
      const esc = POST_NAMES.map(([k]) => ids.some((i) => !POST_OPS[i].cls[k]));
      rows.push(['есть функция вне класса?', ...esc.map((x) => (x ? 'да' : 'НЕТ — ловушка'))]);
      rowTable(tbl, ['связка', ...POST_NAMES.map(([k]) => k)], rows.map((r, i) => (i === rows.length - 1 ? [r[0], ...r.slice(1).map((x) => (x === 'да' ? 'да' : 'НЕТ'))] : r)), (i) => i === rows.length - 1, false);
      tbl.appendChild(H('div', { style: 'font-size:.82rem;color:var(--ink-2);margin-top:4px' }, POST_NAMES.map(([k, t]) => k + ' — ' + t).join('; ') + '. «НЕТ» в последней строке — класс-ловушка: из набора из него не выбраться.'));
      const full = ids.length && esc.every(Boolean);
      verdict.textContent = !ids.length ? 'Выберите связки.' : full ? '✔ Набор функционально полон: через него выражается любая булева функция.' : '✘ Не полон: все функции набора лежат в ' + (esc.filter((x) => !x).length > 1 ? 'классах ' : 'классе ') + POST_NAMES.filter((x, k) => !esc[k]).map(([k, t]) => k + ' (' + t + ')').join(', ') + ' — и всё, что из них собрано, тоже.';
      verdict.style.color = full ? 'var(--good-text)' : 'var(--critical-text)';
      st.set('n', String(ids.length));
      st.set('v', full ? 'да' : 'нет');
      note.innerHTML = 'Почему {∧, ∨} не полон: обе связки <b>монотонны</b> (если увеличить входы с 0 до 1, выход не уменьшится), а подстановка монотонных функций друг в друга снова монотонна. ¬A не монотонна — значит, её не собрать. Так же {⊕, ↔} застревает в <b>линейных</b> функциях (сумма переменных по модулю 2) и не может выразить даже A ∧ B. NAND лежит вне всех пяти классов — поэтому он один полон. Это пример доказательства невозможности через <b>инвариант</b>: находим свойство, которое сохраняется при всех допустимых шагах и которого нет у цели.';
    }
    w.pythonAction(() => PY_IT + '\ndef classes(f, n=2):\n    rows = list(product([0, 1], repeat=n))\n    v = {r: f(*r) for r in rows}\n    T0 = v[(0,) * n] == 0\n    T1 = v[(1,) * n] == 1\n    S = all(v[r] != v[tuple(1 - x for x in r)] for r in rows)\n    M = all(v[a] <= v[b] for a in rows for b in rows if all(x <= y for x, y in zip(a, b)))\n    # линейность: коэффициенты полинома Жегалкина\n    c = [v[r] for r in rows]\n    for b in range(n):\n        for i in range(2 ** n):\n            if i >> b & 1:\n                c[i] ^= c[i ^ (1 << b)]\n    L = all(c[i] == 0 for i in range(2 ** n) if bin(i).count("1") > 1)\n    return dict(T0=T0, T1=T1, S=S, M=M, L=L)\n\nops = {\n' + [...sel].map((i) => '    "' + POST_OPS[i].t + '": ' + pyLambda(P(POST_OPS[i].f), ['A', 'B']).replace('lambda A, B:', 'lambda A, B: int(') + '),').join('\n') + '\n}\ncl = {k: classes(f) for k, f in ops.items()}\nfor k, c in cl.items():\n    print(k, c)\nprint("полон:", all(any(not c[name] for c in cl.values()) for name in ["T0", "T1", "S", "M", "L"]))\n');
    draw();
  });

  /* ==============================================================================
   * 17. Сумматор: арифметика из логики
   * ============================================================================== */
  GBC.widget('adder', (el) => {
    const s = { a: 11, b: 6 };
    const w = ui.shell(el, { title: 'Сумматор: компьютер складывает логическими связками', sub: 'Полный сумматор складывает два бита и перенос: сумма s = a ⊕ b ⊕ c, перенос c′ = большинство(a, b, c). Четыре сумматора в цепочке складывают 4-битные числа.' });
    ui.slider(w.controls, { label: 'Число a', min: 0, max: 15, step: 1, value: s.a, format: (v) => v + ' = ' + v.toString(2).padStart(4, '0') + '₂', onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'Число b', min: 0, max: 15, step: 1, value: s.b, format: (v) => v + ' = ' + v.toString(2).padStart(4, '0') + '₂', onInput: (v) => ((s.b = v), draw()) });
    const holder = H('div');
    const line = monoBox('text-align:center;font-size:.95rem');
    w.main.append(holder, line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sum', label: 'a + b' }, { key: 'bin', label: 'в двоичном виде' }, { key: 'ov', label: 'перенос из старшего разряда' }]);
    function draw() {
      const a = U.range(4).map((i) => (s.a >> i) & 1);
      const b = U.range(4).map((i) => (s.b >> i) & 1);
      const c = [0];
      const sum = [];
      for (let i = 0; i < 4; i++) {
        sum.push(a[i] ^ b[i] ^ c[i]);
        c.push((a[i] & b[i]) | (c[i] & (a[i] ^ b[i])));
      }
      holder.textContent = '';
      const W = 620;
      const svg = svgBox(holder, W, 210, 420, 680);
      const col = (x) => (x ? C_TRUE : 'var(--border-strong)');
      for (let i = 0; i < 4; i++) {
        const x = 470 - i * 130;
        const y = 70;
        svg.appendChild(S('rect', { x, y, width: 90, height: 64, rx: 10, fill: 'var(--surface-2)', stroke: 'var(--ink-2)', 'stroke-width': 1.6 }));
        svg.appendChild(sText(x + 45, y + 22, 'сумматор', { size: 11, color: 'var(--ink-2)' }));
        svg.appendChild(sText(x + 45, y + 42, 'разряд ' + i, { size: 12, bold: true }));
        [['a', a[i], x + 25], ['b', b[i], x + 65]].forEach(([nm, v, xx]) => {
          svg.appendChild(S('line', { x1: xx, y1: y - 30, x2: xx, y2: y, stroke: col(v), 'stroke-width': v ? 3 : 2 }));
          svg.appendChild(sText(xx, y - 40, nm + String(i) + ' = ' + v, { size: 12, bold: !!v, color: v ? C_TRUE : 'var(--muted)' }));
        });
        svg.appendChild(S('line', { x1: x + 45, y1: y + 64, x2: x + 45, y2: y + 98, stroke: col(sum[i]), 'stroke-width': sum[i] ? 3 : 2 }));
        svg.appendChild(sText(x + 45, y + 112, 's' + i + ' = ' + sum[i], { size: 13, bold: true, color: sum[i] ? C_TRUE : 'var(--muted)' }));
        svg.appendChild(S('path', { d: 'M' + (x + 90 + (i === 0 ? 30 : 40)) + ' ' + (y + 32) + ' L' + (x + 90) + ' ' + (y + 32), stroke: col(c[i]), 'stroke-width': c[i] ? 3 : 2, fill: 'none' }));
        svg.appendChild(sText(x + 90 + (i === 0 ? 30 : 20), y + 20, 'c' + i + '=' + c[i], { size: 10, color: c[i] ? C_TRUE : 'var(--muted)' }));
      }
      svg.appendChild(S('path', { d: 'M' + (470 - 3 * 130) + ' ' + 102 + ' L' + 20 + ' ' + 102, stroke: col(c[4]), 'stroke-width': c[4] ? 3 : 2, fill: 'none' }));
      svg.appendChild(sText(30, 88, 'c4 = ' + c[4], { size: 12, bold: !!c[4], color: c[4] ? C_TRUE : 'var(--muted)', anchor: 'start' }));
      const tot = s.a + s.b;
      line.textContent = '  ' + s.a.toString(2).padStart(5, ' ') + '   (' + s.a + ')\n+ ' + s.b.toString(2).padStart(5, ' ') + '   (' + s.b + ')\n= ' + tot.toString(2).padStart(5, ' ') + '   (' + tot + ')';
      st.set('sum', String(tot));
      st.set('bin', tot.toString(2));
      st.set('ov', c[4] ? '1 — результат не влез в 4 бита' : '0');
      note.innerHTML = 'Сложение двух битов: 0 + 0 = 0, 0 + 1 = 1, 1 + 1 = 10₂ — бит суммы ведёт себя как <b>XOR</b>, а перенос как <b>AND</b>. С учётом входящего переноса c: сумма a ⊕ b ⊕ c (чётность трёх битов), перенос — «хотя бы два из трёх», то есть функция большинства из шага 14. Цепочка из n таких блоков складывает n-битные числа, а умножение, сравнение, вычисление деревьев и градиентов в процессоре сводятся к таким же схемам. Вся арифметика компьютера — логика высказываний.';
    }
    w.pythonAction(() => 'def full_adder(a, b, c):\n    s = a ^ b ^ c\n    carry = (a & b) | (c & (a ^ b))      # большинство из трёх\n    return s, carry\n\ndef add4(x, y):\n    c, out = 0, 0\n    for i in range(4):\n        s, c = full_adder(x >> i & 1, y >> i & 1, c)\n        out |= s << i\n    return out | c << 4\n\nprint(add4(' + s.a + ', ' + s.b + '), bin(add4(' + s.a + ', ' + s.b + ')))\nprint("все пары совпадают с +:", all(add4(x, y) == x + y for x in range(16) for y in range(16)))\n');
    draw();
  });

  /* ==============================================================================
   * 18. Диаграмма Венна для трёх множеств
   * ============================================================================== */
  const VENN_PRESETS = [
    { label: '★ A ∧ B — пересечение', value: 'A ∧ B' },
    { label: '★ A ∨ B — объединение', value: 'A ∨ B' },
    { label: '★ A ∧ ¬B — разность', value: 'A ∧ ¬B' },
    { label: '★★ A → B', value: 'A → B' },
    { label: '★★ ¬(A ∨ B) — сравните с ¬A ∧ ¬B', value: '¬(A ∨ B)' },
    { label: '★★ ¬A ∧ ¬B', value: '¬A ∧ ¬B' },
    { label: '★★ A ∧ (B ∨ C)', value: 'A ∧ (B ∨ C)' },
    { label: '★★ (A ∧ B) ∨ C', value: '(A ∧ B) ∨ C' },
    { label: '★★★ большинство из трёх', value: '(A ∧ B) ∨ (A ∧ C) ∨ (B ∧ C)' },
    { label: '★★★ A ⊕ B ⊕ C — нечётное число', value: 'A ⊕ B ⊕ C' },
  ];
  const VC = { A: [150, 122], B: [230, 122], C: [190, 192] };
  const VR = 80;
  const VLAB = { '000': [40, 34], '100': [112, 100], '010': [268, 100], '001': [190, 240], '110': [190, 88], '101': [148, 172], '011': [232, 172], '111': [190, 146] };
  GBC.widget('venn3', (el) => {
    const s = { res: null };
    const w = ui.shell(el, { title: 'Формула — это область: диаграмма Венна', sub: 'A, B, C — множества объектов, для которых высказывания истинны. Восемь областей диаграммы — это восемь строк таблицы истинности. Закрашены области, где формула истинна.' });
    const fi = formulaInput(w.controls, { value: VENN_PRESETS[0].value, presets: VENN_PRESETS, maxVars: 3, onChange: (r) => ((s.res = r), draw()) });
    const box = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:12px;align-items:start' });
    const svgHolder = H('div');
    const tbl = H('div');
    box.append(svgHolder, tbl);
    w.main.appendChild(box);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'закрашено областей' }, { key: 'set', label: 'как множество' }]);
    const id = U.uid('venn');
    function draw() {
      if (!s.res) return;
      const vars = ['A', 'B', 'C'];
      const f = compile(s.res.ast);
      svgHolder.textContent = '';
      const svg = svgBox(svgHolder, 380, 300, 260, 460);
      const defs = S('defs');
      vars.forEach((v) => defs.appendChild(S('clipPath', { id: id + v }, S('circle', { cx: VC[v][0], cy: VC[v][1], r: VR }))));
      svg.appendChild(defs);
      let filled = 0;
      envs(vars).forEach((e) => {
        const key = '' + e.A + e.B + e.C;
        const on = f(e);
        if (on) filled++;
        const mid = id + 'm' + key;
        const mask = S('mask', { id: mid }, S('rect', { x: 0, y: 0, width: 380, height: 300, fill: 'white' }));
        vars.forEach((v) => !e[v] && mask.appendChild(S('circle', { cx: VC[v][0], cy: VC[v][1], r: VR, fill: 'black' })));
        defs.appendChild(mask);
        let node = S('rect', { x: 10, y: 10, width: 360, height: 280, fill: on ? tint(C_TRUE, 48) : 'var(--surface)' });
        vars.forEach((v) => {
          if (e[v]) node = S('g', { 'clip-path': 'url(#' + id + v + ')' }, node);
        });
        svg.appendChild(S('g', { mask: 'url(#' + mid + ')' }, node));
      });
      svg.appendChild(S('rect', { x: 10, y: 10, width: 360, height: 280, rx: 8, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1.4 }));
      vars.forEach((v) => svg.appendChild(S('circle', { cx: VC[v][0], cy: VC[v][1], r: VR, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2 })));
      Object.entries(VLAB).forEach(([k, [x, y]]) => svg.appendChild(sText(x, y, k, { size: 11, mono: true, color: 'var(--ink-2)' })));
      svg.appendChild(sText(78, 52, 'A', { size: 16, bold: true }));
      svg.appendChild(sText(302, 52, 'B', { size: 16, bold: true }));
      svg.appendChild(sText(286, 262, 'C', { size: 16, bold: true }));
      svg.appendChild(sText(352, 282, 'U', { size: 12, color: 'var(--ink-2)' }));
      tbl.textContent = '';
      const E = envs(vars);
      boolTable(tbl, ['A', 'B', 'C', 'область', str(s.res.ast)], E.map((e) => [e.A, e.B, e.C, '' + e.A + e.B + e.C, f(e)]), { good: (i) => f(E[i]) === 1, outCols: new Set([4]), sepAfter: 2 });
      st.set('n', filled + ' из 8');
      st.set('set', setName(s.res.ast));
      note.innerHTML = 'Подписи областей — строки таблицы: «101» — объекты из A и C, но не из B. Закрашенные области — ровно строки с единицей справа. ∧ — пересечение ∩, ∨ — объединение ∪, ¬ — дополнение до всего множества U. Сравните «¬(A ∨ B)» и «¬A ∧ ¬B» — одна и та же область: <b>закон де Моргана</b> для множеств. «A → B» закрашивает всё, кроме части A вне B; импликация истинна для всех объектов, только если эта часть пуста, то есть <b>A ⊆ B</b>. Отсюда же правила вероятностей: P(A ∨ B) = P(A) + P(B) − P(A ∧ B) и формула включений-исключений (урок 15.17).';
    }
    function setName(n) {
      if (n.t === 'var') return n.name;
      if (n.t === 'const') return n.v ? 'U' : '∅';
      if (n.t === 'not') return (n.a.t === 'bin' ? '(' + setName(n.a) + ')' : setName(n.a)) + 'ᶜ';
      const w = (c) => (c.t === 'bin' ? '(' + setName(c) + ')' : setName(c));
      const m = { and: ' ∩ ', or: ' ∪ ', xor: ' △ ' };
      if (m[n.op]) return w(n.a) + m[n.op] + w(n.b);
      if (n.op === 'imp') return w(n.a) + 'ᶜ ∪ ' + w(n.b);
      if (n.op === 'iff') return '(' + setName(n.a) + ' △ ' + setName(n.b) + ')ᶜ';
      return '—';
    }
    w.pythonAction(() => PY_IT + '\nf = ' + pyLambda(s.res.ast, ['A', 'B', 'C']) + '   # ' + str(s.res.ast) + '\nfor region in product([0, 1], repeat=3):\n    print("".join(map(str, region)), "закрашена" if f(*map(bool, region)) else "")\n\n# на конкретных множествах объектов\nU = set(range(1, 31))\nA, B, C = {n for n in U if n % 2 == 0}, {n for n in U if n % 3 == 0}, {n for n in U if n > 20}\nprint(sorted(x for x in U if f(x in A, x in B, x in C)))\n');
    fi.upd();
  });

  /* ==============================================================================
   * 19. Булевы маски: законы де Моргана в pandas
   * ============================================================================== */
  const MASK_ROWS = (() => {
    const rng = new GBC.RNG(4);
    return U.range(12).map((i) => ({ id: i + 1, age: 18 + rng.randint(50), inc: 20 + rng.randint(80), churn: rng.random() < 0.3 }));
  })();
  GBC.widget('masks', (el) => {
    const s = { age: 30, inc: 50, op: '&', neg: false };
    const D = MASK_ROWS;
    const w = ui.shell(el, { title: 'Булевы маски: отбор строк условиями', sub: 'Условие на столбец даёт столбец True/False — маску. & (и), | (или), ~ (не) соединяют маски поэлементно, по строке за раз. Выделены отобранные строки.' });
    ui.slider(w.controls, { label: 'Условие 1: возраст >', min: 20, max: 60, step: 5, value: s.age, format: String, onInput: (v) => ((s.age = v), draw()) });
    ui.slider(w.controls, { label: 'Условие 2: доход <', min: 30, max: 90, step: 10, value: s.inc, format: String, onInput: (v) => ((s.inc = v), draw()) });
    ui.segmented(w.controls, { label: 'Связка', value: s.op, options: [{ value: '&', label: 'И (&)' }, { value: '|', label: 'ИЛИ (|)' }, { value: '&~', label: 'И НЕ (& ~)' }], onChange: (v) => ((s.op = v), draw()) });
    ui.toggle(w.controls, { label: 'Отрицание всего условия (~)', checked: s.neg, onChange: (v) => ((s.neg = v), draw()) });
    const code = monoBox();
    const tbl = H('div');
    w.main.append(code, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'отобрано (mask.sum())' }, { key: 'dm', label: 'по де Моргану' }, { key: 'ch', label: 'доля ушедших в отборе' }]);
    const exprs = () => {
      const c1 = '(df.age > ' + s.age + ')';
      const c2 = '(df.income < ' + s.inc + ')';
      const n1 = '(df.age <= ' + s.age + ')';
      const n2 = '(df.income >= ' + s.inc + ')';
      const base = s.op === '&' ? c1 + ' & ' + c2 : s.op === '|' ? c1 + ' | ' + c2 : c1 + ' & ~' + c2;
      const dm = s.op === '&' ? n1 + ' | ' + n2 : s.op === '|' ? n1 + ' & ' + n2 : n1 + ' | ' + c2;
      return { main: s.neg ? '~(' + base + ')' : base, dm: s.neg ? dm : base };
    };
    function draw() {
      const m = D.map((r) => {
        const a = r.age > s.age;
        const b = r.inc < s.inc;
        const v = s.op === '&' ? a && b : s.op === '|' ? a || b : a && !b;
        return s.neg ? !v : v;
      });
      const mdm = D.map((r) => {
        const na = r.age <= s.age;
        const nb = r.inc >= s.inc;
        if (!s.neg) return s.op === '&' ? !na && !nb : s.op === '|' ? !na || !nb : !na && nb;
        return s.op === '&' ? na || nb : s.op === '|' ? na && nb : na || !nb;
      });
      const E = exprs();
      code.textContent = 'mask = ' + E.main + (s.neg ? '\n# де Морган: ' + E.dm : '') + '\ndf[mask]';
      tbl.textContent = '';
      ui.table(tbl, { columns: ['№', 'возраст', 'доход, тыс.', 'ушёл', 'условие 1', 'условие 2', 'mask'], numeric: false, rows: D.map((r, i) => [String(r.id), String(r.age), String(r.inc), r.churn ? 'да' : 'нет', r.age > s.age ? 'True' : 'False', r.inc < s.inc ? 'True' : 'False', m[i] ? 'True ✔' : 'False']), highlight: (i) => m[i] });
      const k = m.filter(Boolean).length;
      st.set('n', k + ' из 12');
      st.set('dm', mdm.filter(Boolean).length + ' — ' + (m.every((v, i) => v === mdm[i]) ? 'те же строки' : 'ошибка'));
      st.set('ch', k ? f3(D.filter((r, i) => m[i] && r.churn).length / k) : '—');
      note.innerHTML = 'Маска — это столбец таблицы истинности, посчитанный для каждой строки данных. Сумма маски — число отобранных строк (True = 1), среднее — их доля. Включите отрицание: по <b>законам де Моргана</b> «не (старше 30 и доход меньше 50)» — это «не старше 30 <b>или</b> доход не меньше 50». В pandas и numpy пишите <code>&amp;</code>, <code>|</code>, <code>~</code> (а не <code>and</code>, <code>or</code>, <code>not</code> — для массивов они вызывают ошибку «truth value of a Series is ambiguous») и <b>всегда ставьте скобки</b>: <code>df.age &gt; 30 &amp; df.income &lt; 50</code> без скобок сначала вычисляет <code>30 &amp; df.income</code> — побитовое «и» связывает сильнее сравнения.';
    }
    w.pythonAction(() => {
      const E = exprs();
      return 'import pandas as pd\nfrom gbcourse.rng import Mulberry32\n\nrng = Mulberry32(4)\nrows = []\nfor i in range(12):\n    age = 18 + rng.randint(50)\n    income = 20 + rng.randint(80)\n    rows.append({"age": age, "income": income, "churn": rng.random() < 0.3})\ndf = pd.DataFrame(rows, index=range(1, 13))\n\nmask = ' + E.main + '\nprint(df[mask])\nprint("отобрано:", mask.sum(), " доля:", round(mask.mean(), 3))\nprint("по де Моргану те же строки:", (mask == (' + E.dm + ')).all())\n';
    });
    draw();
  });

  /* ==============================================================================
   * 20. Пропуски: исключённое третье ломается, трёхзначная логика
   * ============================================================================== */
  const NAN_ROWS = [[1, 25, 40], [2, null, 55], [3, 47, 70], [4, 33, null], [5, 19, 35], [6, null, 90], [7, 52, 45], [8, 30, 60], [9, 61, null], [10, 28, 80]];
  GBC.widget('nan-logic', (el) => {
    const s = { t: 30, mode: 'nan' };
    const w = ui.shell(el, { title: 'Пропуски ломают законы логики', sub: 'Сравнение с NaN всегда даёт False. Поэтому «~(age > 30)» и «age <= 30» — разные маски, а закон исключённого третьего (P ∨ ¬P) для данных с пропусками перестаёт работать.' });
    ui.slider(w.controls, { label: 'Порог t в условии age > t', min: 20, max: 60, step: 1, value: s.t, format: String, onInput: (v) => ((s.t = v), draw()) });
    ui.segmented(w.controls, { label: 'Тип столбца', value: s.mode, options: [{ value: 'nan', label: 'float с NaN (numpy)' }, { value: 'na', label: 'Float64 с pd.NA' }], onChange: (v) => ((s.mode = v), draw()) });
    const tbl = H('div');
    const kl = cardGrid(170);
    w.main.append(tbl, kl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'gt', label: '(age > t).sum()' }, { key: 'le', label: '(age <= t).sum()' }, { key: 'neg', label: '(~(age > t)).sum()' }, { key: 'na', label: 'пропусков' }]);
    const K = (v) => (v === null ? '?' : v ? '1' : '0');
    const kAnd = (a, b) => (a === 0 || b === 0 ? 0 : a === null || b === null ? null : 1);
    const kOr = (a, b) => (a === 1 || b === 1 ? 1 : a === null || b === null ? null : 0);
    function draw() {
      const na = s.mode === 'na';
      const show = (v) => (v === null ? (na ? '<NA>' : 'False') : v ? 'True' : 'False');
      const gt = NAN_ROWS.map(([, a]) => (a === null ? null : a > s.t));
      const le = NAN_ROWS.map(([, a]) => (a === null ? null : a <= s.t));
      const neg = gt.map((v) => (v === null ? (na ? null : true) : !v));
      tbl.textContent = '';
      ui.table(tbl, { columns: ['№', 'age', 'age > t', 'age <= t', '~(age > t)', 'age.isna()'], numeric: false, rows: NAN_ROWS.map(([id, a], i) => [String(id), a === null ? (na ? '<NA>' : 'NaN') : String(a), show(gt[i]), show(le[i]), show(neg[i]), a === null ? 'True' : 'False']), highlight: (i) => NAN_ROWS[i][1] === null });
      const cnt = (arr) => arr.filter((v) => v === true).length;
      const nNA = NAN_ROWS.filter((r) => r[1] === null).length;
      st.set('gt', String(cnt(gt)));
      st.set('le', String(cnt(le)));
      st.set('neg', String(cnt(neg)));
      st.set('na', String(nNA));
      kl.textContent = '';
      const vals = [1, null, 0];
      const c1 = card('Клини: P ∧ Q');
      rowTable(c1.body, ['∧', ...vals.map(K)], vals.map((a) => [K(a), ...vals.map((b) => K(kAnd(a, b)))]), null, false);
      const c2 = card('Клини: P ∨ Q');
      rowTable(c2.body, ['∨', ...vals.map(K)], vals.map((a) => [K(a), ...vals.map((b) => K(kOr(a, b)))]), null, false);
      const c3 = card('Клини: ¬P');
      rowTable(c3.body, ['P', '¬P'], vals.map((a) => [K(a), K(a === null ? null : 1 - a)]), null, false);
      kl.append(c1.el, c2.el, c3.el);
      note.innerHTML = na
        ? 'С типом <code>Float64</code> pandas использует <b>трёхзначную логику Клини</b>: сравнение с <code>pd.NA</code> даёт <code>&lt;NA&gt;</code> («неизвестно», ? в таблицах), и ~&lt;NA&gt; = &lt;NA&gt;. Правила естественны: «0 и неизвестно» = 0, «1 или неизвестно» = 1, в остальных случаях результат неизвестен. Так же работает NULL в SQL. При отборе строк <code>df[mask]</code> неизвестное считается False — строки с пропусками не попадают ни в «age > t», ни в «~(age > t)». Закон исключённого третьего P ∨ ¬P даёт «неизвестно», а не 1.'
        : 'С обычным float пропуск — это NaN, и <b>любое</b> сравнение с NaN ложно. Тогда «age > t» и «age <= t» обе False для пропусков: вместе они покрывают только ' + (NAN_ROWS.length - nNA) + ' строк из ' + NAN_ROWS.length + '. А «~(age > t)» превращает False в True и <b>добавляет пропуски</b> к «молодым». Законы логики верны для двузначных значений; пропуск — третье значение, и тут законы надо проверять заново. Явно решайте, куда отправить пропуски (<code>| df.age.isna()</code>). Деревья бустинга делают это сами: XGBoost и LightGBM для каждого разбиения выучивают «направление по умолчанию» для пропусков (уроки 8.3 и 10.2).';
    }
    w.pythonAction(() => 'import numpy as np\nimport pandas as pd\n\nage = pd.Series(' + JSON.stringify(NAN_ROWS.map((r) => r[1])).replace(/null/g, 'None') + ', dtype="' + (s.mode === 'na' ? 'Float64' : 'float') + '")\nt = ' + s.t + '\nprint(pd.DataFrame({"age": age, "age > t": age > t, "age <= t": age <= t, "~(age > t)": ~(age > t)}))\nprint("сумма двух масок:", (age > t).sum() + (age <= t).sum(), "из", len(age))\n' + (s.mode === 'na' ? 'print("NA | True =", pd.NA | True, "  NA & False =", pd.NA & False, "  NA | False =", pd.NA | False)\n' : '') + 'print("с пропусками явно:", ((age <= t) | age.isna()).sum())\n');
    draw();
  });

  /* ==============================================================================
   * 21. Импликации и метрики классификатора
   * ============================================================================== */
  GBC.widget('metrics-implication', (el) => {
    const s = { TP: 40, FP: 10, FN: 30, TN: 120 };
    const w = ui.shell(el, { title: 'Четыре импликации матрицы ошибок', sub: 'ŷ — «модель сказала спам», y — «это спам». Каждая метрика — доля случаев, где выполняется одна из импликаций. Строгая импликация и контрапозиция равносильны, а их «мягкие» доли — нет.' });
    [['TP', 'TP: сказала спам — спам'], ['FP', 'FP: сказала спам — не спам'], ['FN', 'FN: пропустила спам'], ['TN', 'TN: верно «не спам»']].forEach(([k, t]) => ui.slider(w.controls, { label: t, min: 0, max: k === 'TN' ? 200 : 100, step: 1, value: s[k], format: String, onInput: (v) => ((s[k] = v), draw()) }));
    const tbl = H('div');
    const plot = new GBC.Plot(w.main, { height: 220, x: { label: '', domain: [0.4, 4.6], ticks: [] }, y: { label: 'доля', domain: [0, 1.15], ticks: [0, 0.25, 0.5, 0.75, 1] } });
    const lines = monoBox();
    w.main.insertBefore(tbl, w.main.firstChild);
    w.main.appendChild(lines);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'точность P(y | ŷ)' }, { key: 'r', label: 'полнота P(ŷ | y)' }, { key: 'sp', label: 'специфичность P(¬ŷ | ¬y)' }, { key: 'npv', label: 'NPV P(¬y | ¬ŷ)' }]);
    const frac = (a, b) => (b ? a / b : NaN);
    function draw() {
      const { TP, FP, FN, TN } = s;
      tbl.textContent = '';
      rowTable(tbl, ['', 'на деле спам (y)', 'не спам (¬y)'], [['модель: спам (ŷ)', String(TP), String(FP)], ['модель: не спам (¬ŷ)', String(FN), String(TN)]], null, false);
      const v = [frac(TP, TP + FP), frac(TN, TN + FP), frac(TP, TP + FN), frac(TN, TN + FN)];
      const lab = ['ŷ → y\nточность', '¬y → ¬ŷ\nспецифичность', 'y → ŷ\nполнота', '¬ŷ → ¬y\nNPV'];
      plot.render([
        { type: 'bars', x: [1, 2, 3, 4], y: v.map((x) => (Number.isNaN(x) ? 0 : x)), color: (i) => (i < 2 ? 'model' : 'tree'), width: 0.55, maxPx: 70 },
        { type: 'text', items: lab.map((a, i) => ({ x: i + 1, y: 1.08, anchor: 'middle', text: a.split('\n')[0], bold: true })) },
        { type: 'text', items: lab.map((a, i) => ({ x: i + 1, y: Number.isNaN(v[i]) ? 0.05 : Math.max(0.05, v[i] - 0.08), anchor: 'middle', text: a.split('\n')[1] })) },
      ]);
      const ok = (c) => (c ? '✔ строго верно' : '✘ есть исключения');
      lines.textContent = 'ŷ → y   и  ¬y → ¬ŷ (контрапозиция):  ' + ok(FP === 0) + '   — нарушают оба одни и те же FP = ' + FP + '\ny → ŷ   и  ¬ŷ → ¬y (контрапозиция):  ' + ok(FN === 0) + '   — нарушают оба одни и те же FN = ' + FN;
      st.set('p', f3(v[0]));
      st.set('sp', f3(v[1]));
      st.set('r', f3(v[2]));
      st.set('npv', f3(v[3]));
      note.innerHTML = 'Синие столбики — пара «импликация и её контрапозиция» ŷ → y и ¬y → ¬ŷ; обе строго верны ровно тогда, когда FP = 0, и тогда точность и специфичность одновременно равны 1. Но как <b>доли</b> они различаются: сейчас точность ' + f3(v[0]) + ', а специфичность ' + f3(v[1]) + '. Правило контрапозиции работает для «всегда», а для «как правило» — нет: P(y | ŷ) ≠ P(¬ŷ | ¬y). Оранжевые — обращение y → ŷ (полнота) и его контрапозиция ¬ŷ → ¬y (NPV); их нарушают FN. Путать точность с полнотой — та же ошибка, что путать импликацию с обращением.';
    }
    w.pythonAction(() => 'import numpy as np\nfrom sklearn.metrics import confusion_matrix, precision_score, recall_score\n\nTP, FP, FN, TN = ' + [s.TP, s.FP, s.FN, s.TN].join(', ') + '\ny_true = np.array([1] * TP + [0] * FP + [1] * FN + [0] * TN)\ny_pred = np.array([1] * TP + [1] * FP + [0] * FN + [0] * TN)\nprint("точность    ŷ → y  :", precision_score(y_true, y_pred, zero_division=0))\nprint("полнота     y → ŷ  :", recall_score(y_true, y_pred, zero_division=0))\nprint("специфичн. ¬y → ¬ŷ :", recall_score(1 - y_true, 1 - y_pred, zero_division=0))\nprint("NPV        ¬ŷ → ¬y :", precision_score(1 - y_true, 1 - y_pred, zero_division=0))\nprint("ŷ → y строго:", not np.any(y_pred & (1 - y_true)), "  ¬y → ¬ŷ строго:", not np.any((1 - y_true) & y_pred))\n');
    draw();
  });

  /* ==============================================================================
   * 22. Правила «если — то» на данных: поддержка, достоверность, подъём
   * ============================================================================== */
  const CLIENTS = (() => {
    const rng = new GBC.RNG(19);
    return U.range(400).map(() => {
      const age = 18 + rng.randint(53);
      const tenure = rng.randint(61);
      const complaint = rng.random() < 0.2 ? 1 : 0;
      const basic = rng.random() < 0.6 ? 1 : 0;
      const z = -2.2 + 1.6 * complaint + 1.0 * (tenure < 12 ? 1 : 0) + 0.6 * basic + 0.4 * (age < 30 ? 1 : 0);
      const churn = rng.random() < 1 / (1 + Math.exp(-z)) ? 1 : 0;
      return { age, tenure, complaint, basic, churn };
    });
  })();
  const CONDS = [
    { k: 'complaint', t: 'была жалоба', f: (c) => c.complaint === 1, py: 'df.complaint == 1' },
    { k: 'new', t: 'стаж < 12 мес.', f: (c) => c.tenure < 12, py: 'df.tenure < 12' },
    { k: 'basic', t: 'тариф «базовый»', f: (c) => c.basic === 1, py: 'df.basic == 1' },
    { k: 'young', t: 'возраст < 30', f: (c) => c.age < 30, py: 'df.age < 30' },
  ];
  GBC.widget('rules', (el) => {
    const s = { on: new Set(['complaint']), neg: false };
    const w = ui.shell(el, { title: 'Правило «если — то» на данных: насколько это импликация?', sub: '400 клиентов (синтетика). Правило «если условия, то клиент уйдёт» почти никогда не бывает строгой импликацией: у него есть контрпримеры. Его качество измеряют поддержкой, достоверностью и подъёмом.' });
    CONDS.forEach((c) => ui.toggle(w.controls, { label: c.t, checked: s.on.has(c.k), onChange: (v) => (v ? s.on.add(c.k) : s.on.delete(c.k), draw()) }));
    const rule = H('div', { style: 'font-weight:650;margin-bottom:6px' });
    const tbl = H('div');
    const plot = new GBC.Plot(w.main, { height: 200, x: { label: '', domain: [0.4, 3.6], ticks: [] }, y: { label: 'доля ушедших', domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] } });
    w.main.insertBefore(tbl, w.main.firstChild);
    w.main.insertBefore(rule, w.main.firstChild);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sup', label: 'поддержка P(A)' }, { key: 'conf', label: 'достоверность P(уход | A)' }, { key: 'lift', label: 'подъём' }, { key: 'cx', label: 'контрпримеров' }]);
    function draw() {
      const act = CONDS.filter((c) => s.on.has(c.k));
      const A = CLIENTS.map((c) => act.every((x) => x.f(c)));
      const n = CLIENTS.length;
      const nA = A.filter(Boolean).length;
      const nAy = CLIENTS.filter((c, i) => A[i] && c.churn).length;
      const base = U.mean(CLIENTS.map((c) => c.churn));
      const conf = nA ? nAy / nA : NaN;
      const rest = CLIENTS.filter((c, i) => !A[i]);
      const confNot = rest.length ? U.mean(rest.map((c) => c.churn)) : NaN;
      rule.textContent = 'ЕСЛИ ' + (act.length ? act.map((c) => c.t).join(' И ') : '(без условий)') + ' ТО клиент уйдёт';
      tbl.textContent = '';
      rowTable(tbl, ['', 'ушёл', 'остался', 'всего'], [['условие A выполнено', String(nAy), String(nA - nAy), String(nA)], ['не выполнено', String(CLIENTS.filter((c, i) => !A[i] && c.churn).length), String(CLIENTS.filter((c, i) => !A[i] && !c.churn).length), String(n - nA)]], (i) => i === 0, false);
      plot.render([
        { type: 'bars', x: [1, 2, 3], y: [Number.isNaN(conf) ? 0 : conf, base, Number.isNaN(confNot) ? 0 : confNot], color: (i) => (i === 0 ? 'tree' : i === 1 ? 'truth' : 'model'), width: 0.55, maxPx: 80 },
        { type: 'text', items: [{ x: 1, y: 0.95, anchor: 'middle', text: 'при A', bold: true }, { x: 2, y: 0.95, anchor: 'middle', text: 'все клиенты', bold: true }, { x: 3, y: 0.95, anchor: 'middle', text: 'без A', bold: true }] },
      ]);
      st.set('sup', nA + ' (' + pct(nA / n) + ')');
      st.set('conf', nA ? pct(conf) : '—');
      st.set('lift', nA ? f2(conf / base) : '—');
      st.set('cx', String(nA - nAy));
      note.innerHTML = '<b>Поддержка</b> — как часто выполняется условие A; <b>достоверность</b> — доля ушедших среди них, то есть «насколько верна импликация A → уход» (1 означает строгую импликацию без контрпримеров); <b>подъём</b> — во сколько раз достоверность выше общей доли ушедших (' + pct(base) + '). Добавляйте условия: правило становится достовернее, но покрывает всё меньше клиентов — компромисс, знакомый по дереву решений, где каждый лист — такое же правило. Правило с подъёмом около 1 бесполезно, даже если звучит убедительно. Так работают поиск ассоциативных правил и модели-списки правил; деревья бустинга дают тысячи таких правил с весами.';
    }
    w.pythonAction(() => {
      const act = CONDS.filter((c) => s.on.has(c.k));
      return 'import math\nimport pandas as pd\nfrom gbcourse.rng import Mulberry32\n\nrng = Mulberry32(19)\nrows = []\nfor _ in range(400):\n    age = 18 + rng.randint(53)\n    tenure = rng.randint(61)\n    complaint = int(rng.random() < 0.2)\n    basic = int(rng.random() < 0.6)\n    z = -2.2 + 1.6 * complaint + 1.0 * (tenure < 12) + 0.6 * basic + 0.4 * (age < 30)\n    churn = int(rng.random() < 1 / (1 + math.exp(-z)))\n    rows.append(dict(age=age, tenure=tenure, complaint=complaint, basic=basic, churn=churn))\ndf = pd.DataFrame(rows)\n\nA = ' + (act.length ? act.map((c) => '(' + c.py + ')').join(' & ') : 'pd.Series(True, index=df.index)') + '\nsupport = A.mean()\nconfidence = df.churn[A].mean()\nprint(f"поддержка {support:.3f}, достоверность {confidence:.3f}, подъём {confidence / df.churn.mean():.2f}, контрпримеров {(A & (df.churn == 0)).sum()}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 23. Предикат двух переменных и кванторы как «тени»
   * ============================================================================== */
  const PRED2 = [
    { t: 'x + y = 9', f: (x, y) => x + y === 9, py: 'x + y == 9' },
    { t: 'y ≥ x', f: (x, y) => y >= x, py: 'y >= x' },
    { t: 'y > x', f: (x, y) => y > x, py: 'y > x' },
    { t: 'x · y = 0', f: (x, y) => x * y === 0, py: 'x * y == 0' },
    { t: 'x² + y² ≤ 50', f: (x, y) => x * x + y * y <= 50, py: 'x**2 + y**2 <= 50' },
    { t: 'y делится на x (x ≥ 1)', f: (x, y) => x >= 1 && y % x === 0, py: 'x >= 1 and y % x == 0' },
    { t: '|x − y| ≤ 1', f: (x, y) => Math.abs(x - y) <= 1, py: 'abs(x - y) <= 1' },
  ];
  GBC.widget('predicate-plane', (el) => {
    const s = { p: 0 };
    const N = 10;
    const w = ui.shell(el, { title: 'Предикат P(x, y) и кванторы как проекции', sub: 'x, y ∈ {0, …, 9}. Закрашены пары, где P истинно — это множество истинности. ∃y — «тень» на ось x (есть закрашенная клетка в столбце), ∀y — столбец закрашен целиком.' });
    ui.select(w.controls, { label: 'Предикат P(x, y)', value: 0, options: PRED2.map((p, i) => ({ value: i, label: p.t })), onChange: (v) => ((s.p = +v), draw()) });
    const holder = H('div');
    const tbl = H('div');
    w.main.append(holder, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'пар, где P истинно' }, { key: 'ae', label: '∀x ∃y P' }, { key: 'ea', label: '∃y ∀x P' }]);
    function draw() {
      const Pd = PRED2[s.p];
      const xs = U.range(N);
      const T = xs.map((x) => xs.map((y) => Pd.f(x, y)));
      const exY = xs.map((x) => xs.some((y) => T[x][y]));
      const allY = xs.map((x) => xs.every((y) => T[x][y]));
      const cs = 30;
      const ox = 40;
      const oy = 12;
      holder.textContent = '';
      const svg = svgBox(holder, ox + N * cs + 120, oy + N * cs + 86, 330, 520);
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          const px = ox + x * cs;
          const py_ = oy + (N - 1 - y) * cs;
          svg.appendChild(S('rect', { x: px + 1, y: py_ + 1, width: cs - 2, height: cs - 2, rx: 4, fill: T[x][y] ? tint(C_TRUE, 55) : 'var(--surface-2)', stroke: 'var(--border)' }));
        }
        svg.appendChild(sText(ox + x * cs + cs / 2, oy + N * cs + 10, String(x), { size: 11, color: 'var(--ink-2)' }));
        svg.appendChild(S('rect', { x: ox + x * cs + 3, y: oy + N * cs + 24, width: cs - 6, height: 16, rx: 4, fill: exY[x] ? tint('var(--c-orange)', 60) : 'var(--surface-2)', stroke: 'var(--c-orange)' }));
        svg.appendChild(S('rect', { x: ox + x * cs + 3, y: oy + N * cs + 48, width: cs - 6, height: 16, rx: 4, fill: allY[x] ? tint('var(--c-aqua)', 60) : 'var(--surface-2)', stroke: 'var(--c-aqua)' }));
      }
      for (let y = 0; y < N; y++) svg.appendChild(sText(ox - 12, oy + (N - 1 - y) * cs + cs / 2, String(y), { size: 11, color: 'var(--ink-2)' }));
      svg.appendChild(sText(ox + N * cs + 8, oy + N * cs + 32, '∃y P(x, y)', { size: 12, anchor: 'start', bold: true }));
      svg.appendChild(sText(ox + N * cs + 8, oy + N * cs + 56, '∀y P(x, y)', { size: 12, anchor: 'start', bold: true }));
      svg.appendChild(sText(ox + N * cs + 8, oy + N * cs + 10, 'x', { size: 12, anchor: 'start' }));
      svg.appendChild(sText(ox - 26, oy + 8, 'y', { size: 12 }));
      const ae = exY.every(Boolean);
      const ea = xs.some((y) => xs.every((x) => T[x][y]));
      const ee = exY.some(Boolean);
      const aa = allY.every(Boolean);
      const ex = xs.some((x) => allY[x]);
      const ya = xs.every((y) => xs.some((x) => T[x][y]));
      const mk = (v) => (v ? '✔ истинно' : '✘ ложно');
      tbl.textContent = '';
      rowTable(tbl, ['формула', 'смысл', 'значение'], [
        ['∃x ∃y P', 'есть хотя бы одна закрашенная клетка', mk(ee)],
        ['∀x ∃y P', 'оранжевая полоса заполнена целиком', mk(ae)],
        ['∃x ∀y P', 'есть целиком закрашенный столбец', mk(ex)],
        ['∀y ∃x P', 'в каждой строке есть закрашенная клетка', mk(ya)],
        ['∃y ∀x P', 'есть целиком закрашенная строка', mk(ea)],
        ['∀x ∀y P', 'закрашено всё', mk(aa)],
      ], null, false);
      st.set('n', T.flat().filter(Boolean).length + ' из 100');
      st.set('ae', mk(ae));
      st.set('ea', mk(ea));
      note.innerHTML = 'Предикат с двумя свободными переменными — множество клеток. Квантор по y «съедает» переменную y: ∃y P(x, y) — уже предикат от одного x (оранжевая полоса), ∀y P(x, y) — тоже (бирюзовая). Второй квантор по x даёт высказывание. Сравните «x + y = 9»: для каждого x пара найдётся (y = 9 − x), но одного y на все x нет — ∀x ∃y истинно, ∃y ∀x ложно. «y > x» показывает, что ответ зависит от <b>области</b>: на всех натуральных числах ∀x ∃y (y > x) истинно, а на {0, …, 9} ложно — для x = 9 большего y нет.';
    }
    w.pythonAction(() => 'D = range(10)\nP = lambda x, y: ' + PRED2[s.p].py + '\nprint("∀x ∃y P:", all(any(P(x, y) for y in D) for x in D))\nprint("∃y ∀x P:", any(all(P(x, y) for x in D) for y in D))\nprint("∃x ∀y P:", any(all(P(x, y) for y in D) for x in D))\nprint("тень ∃y:", [x for x in D if any(P(x, y) for y in D)])\n');
    draw();
  });

  /* ==============================================================================
   * 24. Кванторы по области: пустая область и ловушки перевода
   * ============================================================================== */
  const LEAVES = [[62, 0.31], [41, -0.12], [35, 0.45], [18, 0.08], [12, -0.37], [7, 0.62], [4, 0.15], [2, -0.8]].map(([n, v], i) => ({ id: i + 1, n, v }));
  GBC.widget('quantifier-domain', (el) => {
    const s = { k: 30 };
    const w = ui.shell(el, { title: 'Кванторы по области: «все листья с n ≥ k…»', sub: 'Область D — листья дерева, в которые попало не меньше k объектов. Утверждения с ограниченными кванторами и две частые ошибки перевода. Сдвиньте k за 62 — область станет пустой.' });
    ui.slider(w.controls, { label: 'Порог k (объектов в листе)', min: 0, max: 70, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const tbl = H('div');
    const res = H('div');
    w.main.append(tbl, res);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: '|D|' }, { key: 'all', label: 'all(v > 0 для D)' }, { key: 'any', label: 'any(v > 0.5 для D)' }]);
    function draw() {
      const inD = (l) => l.n >= s.k;
      const D = LEAVES.filter(inD);
      tbl.textContent = '';
      ui.table(tbl, { columns: ['лист', 'объектов n', 'прогноз v', 'в D (n ≥ k)', 'v > 0'], numeric: false, rows: LEAVES.map((l) => [String(l.id), String(l.n), U.fmtSigned(l.v, 2), inD(l) ? 'да' : '—', l.v > 0 ? 'да' : 'нет']), highlight: (i) => inD(LEAVES[i]) });
      const allPos = D.every((l) => l.v > 0);
      const anyBig = D.some((l) => l.v > 0.5);
      const wrong1 = LEAVES.every((l) => inD(l) && l.v > 0);
      const wrong2 = LEAVES.some((l) => !inD(l) || l.v > 0.5);
      const mk = (v) => (v ? '✔ истинно' : '✘ ложно');
      res.textContent = '';
      rowTable(res, ['утверждение', 'запись', 'значение'], [
        ['все листья из D дают v > 0', '∀x (D(x) → v(x) > 0)', mk(allPos)],
        ['есть лист из D с v > 0.5', '∃x (D(x) ∧ v(x) > 0.5)', mk(anyBig)],
        ['✘ ошибка: ∀ с «и»', '∀x (D(x) ∧ v(x) > 0)', mk(wrong1)],
        ['✘ ошибка: ∃ с импликацией', '∃x (D(x) → v(x) > 0.5)', mk(wrong2)],
      ], (i) => i < 2, false);
      st.set('d', String(D.length));
      st.set('all', allPos ? 'True' : 'False');
      st.set('any', anyBig ? 'True' : 'False');
      note.innerHTML = 'Ограниченный квантор «для всех x из D» записывается через <b>импликацию</b>: ∀x (D(x) → P(x)), а «есть x из D» — через <b>конъюнкцию</b>: ∃x (D(x) ∧ P(x)). Перепутать — частая ошибка: «∀x (D(x) ∧ P(x))» требует, чтобы <em>все</em> листья лежали в D, а «∃x (D(x) → P(x))» истинно, как только хоть один лист вне D. При k > 62 область пуста: «все листья из D положительны» — <b>истинно по пустому</b> (контрпример искать негде), «есть лист из D…» — ложно. В Python так же: <code>all([])</code> — True, <code>any([])</code> — False. Это не каприз: так сохраняется закон ¬∀x P ≡ ∃x ¬P. На практике пустой фильтр в проверке «все объекты удовлетворяют условию» проходит молча — проверяйте и размер выборки.';
    }
    w.pythonAction(() => 'leaves = ' + JSON.stringify(LEAVES.map((l) => [l.n, l.v])) + '   # (объектов, прогноз)\nk = ' + s.k + '\nD = [(n, v) for n, v in leaves if n >= k]\nprint("|D| =", len(D))\nprint("все листья из D дают v > 0:", all(v > 0 for n, v in D))\nprint("есть лист из D с v > 0.5:", any(v > 0.5 for n, v in D))\nprint("all([]) =", all([]), " any([]) =", any([]))\n');
    draw();
  });

  /* ==============================================================================
   * 25. Порядок кванторов: студенты и задачи
   * ============================================================================== */
  const QF = [
    { t: '∀s ∃t R(s, t)', ru: 'каждый решил хотя бы одну задачу' },
    { t: '∃t ∀s R(s, t)', ru: 'есть задача, которую решили все' },
    { t: '∃s ∀t R(s, t)', ru: 'кто-то решил все задачи' },
    { t: '∀t ∃s R(s, t)', ru: 'каждую задачу кто-то решил' },
    { t: '∃s ∃t R(s, t)', ru: 'хоть кто-то что-то решил' },
    { t: '∀s ∀t R(s, t)', ru: 'все решили всё' },
    { t: '∃s ∀t ¬R(s, t)', ru: 'кто-то не решил ни одной — отрицание первой строки' },
  ];
  GBC.widget('quantifier-order', (el) => {
    const NS = 4;
    const NT = 5;
    const R = [[1, 0, 0, 0, 0], [0, 1, 1, 0, 0], [0, 0, 0, 1, 0], [1, 0, 0, 0, 1]];
    const s = { q: 0 };
    const w = ui.shell(el, { title: 'Кванторы ∀ и ∃: порядок имеет значение', sub: 'Клетка закрашена, если студент s решил задачу t. Щёлкайте по клеткам. Выбранное утверждение подсвечивает «свидетелей» — клетки, которые делают его истинным, или контрпример.' });
    ui.select(w.controls, { label: 'Подсветить', value: 0, options: QF.map((q, i) => ({ value: i, label: q.t + ' — ' + q.ru })), onChange: (v) => ((s.q = +v), draw()) });
    ui.button(w.controls, { label: 'Очистить', icon: 'reset', onClick: () => (R.forEach((r) => r.fill(0)), draw()) });
    ui.button(w.controls, { label: 'Диагональ', onClick: () => (R.forEach((r, i) => r.forEach((x, j) => (r[j] = i === j ? 1 : 0))), draw()) });
    ui.button(w.controls, { label: 'Задача 1 решена всеми', onClick: () => (R.forEach((r) => (r[0] = 1)), draw()) });
    const holder = H('div');
    const tbl = H('div');
    w.main.append(holder, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ae', label: '∀s ∃t' }, { key: 'ea', label: '∃t ∀s' }]);
    const Sx = U.range(NS);
    const Tx = U.range(NT);
    function evalQ(i) {
      return [
        Sx.every((a) => Tx.some((b) => R[a][b])), Tx.some((b) => Sx.every((a) => R[a][b])), Sx.some((a) => Tx.every((b) => R[a][b])), Tx.every((b) => Sx.some((a) => R[a][b])),
        Sx.some((a) => Tx.some((b) => R[a][b])), Sx.every((a) => Tx.every((b) => R[a][b])), Sx.some((a) => Tx.every((b) => !R[a][b])),
      ][i];
    }
    function witnesses(i) {
      const mark = new Set();
      const bad = new Set();
      const v = evalQ(i);
      if (i === 0) Sx.forEach((a) => { const b = Tx.find((t) => R[a][t]); if (b !== undefined) mark.add(a + ',' + b); else Tx.forEach((t) => bad.add(a + ',' + t)); });
      if (i === 1) { const b = Tx.find((t) => Sx.every((a) => R[a][t])); if (b !== undefined) Sx.forEach((a) => mark.add(a + ',' + b)); }
      if (i === 2) { const a = Sx.find((x) => Tx.every((t) => R[x][t])); if (a !== undefined) Tx.forEach((t) => mark.add(a + ',' + t)); }
      if (i === 3) Tx.forEach((b) => { const a = Sx.find((x) => R[x][b]); if (a !== undefined) mark.add(a + ',' + b); else Sx.forEach((x) => bad.add(x + ',' + b)); });
      if (i === 4) { for (const a of Sx) { const b = Tx.find((t) => R[a][t]); if (b !== undefined) { mark.add(a + ',' + b); break; } } }
      if (i === 5) Sx.forEach((a) => Tx.forEach((b) => (R[a][b] ? null : bad.add(a + ',' + b))));
      if (i === 6) { const a = Sx.find((x) => Tx.every((t) => !R[x][t])); if (a !== undefined) Tx.forEach((t) => mark.add(a + ',' + t)); }
      return { mark, bad, v };
    }
    function draw() {
      const W = witnesses(s.q);
      holder.textContent = '';
      const cs = 52;
      const ox = 70;
      const oy = 28;
      const svg = svgBox(holder, ox + NT * cs + 10, oy + NS * cs + 10, 300, 420);
      Tx.forEach((t) => svg.appendChild(sText(ox + t * cs + cs / 2, oy - 14, 'задача ' + (t + 1), { size: 11, color: 'var(--ink-2)' })));
      Sx.forEach((a) => {
        svg.appendChild(sText(ox - 8, oy + a * cs + cs / 2, 'студ. ' + (a + 1), { size: 11, anchor: 'end', color: 'var(--ink-2)' }));
        Tx.forEach((t) => {
          const k = a + ',' + t;
          const g = S('g', { style: 'cursor:pointer' });
          g.appendChild(S('rect', { x: ox + t * cs + 3, y: oy + a * cs + 3, width: cs - 6, height: cs - 6, rx: 7, fill: R[a][t] ? tint(C_TRUE, 55) : 'var(--surface-2)', stroke: W.mark.has(k) ? 'var(--c-orange)' : W.bad.has(k) ? 'var(--critical)' : 'var(--border)', 'stroke-width': W.mark.has(k) || W.bad.has(k) ? 3.2 : 1, 'stroke-dasharray': W.bad.has(k) ? '5 3' : null }));
          if (R[a][t]) g.appendChild(sText(ox + t * cs + cs / 2, oy + a * cs + cs / 2, '✔', { size: 16, bold: true, color: 'var(--ink)' }));
          g.addEventListener('click', () => ((R[a][t] = 1 - R[a][t]), draw()));
          svg.appendChild(g);
        });
      });
      tbl.textContent = '';
      rowTable(tbl, ['формула', 'по-русски', 'значение'], QF.map((q, i) => [q.t, q.ru, evalQ(i) ? '✔ истинно' : '✘ ложно']), (i) => i === s.q, false);
      st.set('ae', evalQ(0) ? 'истинно' : 'ложно');
      st.set('ea', evalQ(1) ? 'истинно' : 'ложно');
      note.innerHTML = 'Оранжевая рамка — свидетели истинности, красный пунктир — где утверждение ломается. В начальной раскраске «каждый решил хотя бы одну» истинно, а «есть задача, которую решили все» — ложно: <b>∀∃ ≠ ∃∀</b>. В «∀s ∃t» задача может быть своя у каждого студента (свидетели в разных столбцах), в «∃t ∀s» — одна на всех (целый столбец). Из ∃t ∀s всегда следует ∀s ∃t, обратное неверно — проверьте кнопкой «Диагональ». Отрицание меняет каждый квантор и переносит ¬ внутрь: последняя строка всегда противоположна первой. Так же устроено определение предела: N выбирается <em>после</em> ε и зависит от него (шаг 27).';
    }
    w.pythonAction(() => 'R = ' + JSON.stringify(R) + '   # R[s][t] = 1, если студент s решил задачу t\nS, T = range(' + NS + '), range(' + NT + ')\nprint("∀s ∃t:", all(any(R[s][t] for t in T) for s in S))\nprint("∃t ∀s:", any(all(R[s][t] for s in S) for t in T))\nprint("отрицание ∀s ∃t = ∃s ∀t ¬R:", any(all(not R[s][t] for t in T) for s in S))\n');
    draw();
  });

  /* ==============================================================================
   * 26. Машина отрицаний
   * ============================================================================== */
  const NEGS = [
    { t: '★ Все признаки числовые', words: '«Все признаки числовые»', steps: [['\\forall f\\; \\text{числовой}(f)', 'исходное'], ['\\neg\\,\\forall f\\; \\text{числовой}(f)', 'навесили отрицание'], ['\\exists f\\; \\neg\\,\\text{числовой}(f)', '¬∀ = ∃¬']], end: '«Есть хотя бы один нечисловой признак» — а не «все признаки нечисловые».' },
    { t: '★★ Функция ограничена', words: '«Существует M, что |f(x)| ≤ M для всех x»', steps: [['\\exists M\\; \\forall x\\; |f(x)| \\le M', 'исходное'], ['\\neg\\,\\exists M\\; \\forall x\\; |f(x)| \\le M', 'навесили отрицание'], ['\\forall M\\; \\neg\\,\\forall x\\; |f(x)| \\le M', '¬∃ = ∀¬'], ['\\forall M\\; \\exists x\\; \\neg(|f(x)| \\le M)', '¬∀ = ∃¬'], ['\\forall M\\; \\exists x\\; |f(x)| > M', '¬(a ≤ b) ≡ a > b']], end: '«Какую бы границу M ни взять, найдётся x, где |f(x)| её превышает» — функция неограничена.' },
    { t: '★★ Предел последовательности', words: '«aₙ → a»', steps: [['\\forall \\varepsilon > 0\\; \\exists N\\; \\forall n > N\\; |a_n - a| < \\varepsilon', 'исходное'], ['\\exists \\varepsilon > 0\\; \\neg\\,\\exists N\\; \\forall n > N\\; |a_n - a| < \\varepsilon', '¬∀ε>0 = ∃ε>0 ¬ (ограничение ε > 0 остаётся!)'], ['\\exists \\varepsilon > 0\\; \\forall N\\; \\neg\\,\\forall n > N\\; |a_n - a| < \\varepsilon', '¬∃ = ∀¬'], ['\\exists \\varepsilon > 0\\; \\forall N\\; \\exists n > N\\; |a_n - a| \\ge \\varepsilon', '¬∀ = ∃¬ и ¬(a < b) ≡ a ≥ b']], end: '«Есть такое ε, что сколь угодно далеко найдётся член, отстоящий от a не меньше чем на ε» — aₙ не стремится к a.' },
    { t: '★★ Правило про переобучение', words: '«Если модель переобучена, то на каждом фолде ошибка на валидации больше, чем на обучении»', steps: [['P \\to \\forall k\\; V_k > T_k', 'исходное'], ['\\neg\\,(P \\to \\forall k\\; V_k > T_k)', 'навесили отрицание'], ['P \\land \\neg\\,\\forall k\\; V_k > T_k', '¬(A → B) ≡ A ∧ ¬B'], ['P \\land \\exists k\\; \\neg(V_k > T_k)', '¬∀ = ∃¬'], ['P \\land \\exists k\\; V_k \\le T_k', '¬(a > b) ≡ a ≤ b']], end: '«Модель переобучена, но есть фолд, где ошибка на валидации не больше обучающей». Отрицание импликации — не импликация, а «условие и нарушение вывода».' },
    { t: '★★★ Монотонность модели', words: '«f не убывает по признаку»', steps: [["\\forall x\\; \\forall x'\\; (x \\le x' \\to f(x) \\le f(x'))", 'исходное'], ["\\exists x\\; \\exists x'\\; \\neg(x \\le x' \\to f(x) \\le f(x'))", '¬∀∀ = ∃∃¬'], ["\\exists x\\; \\exists x'\\; (x \\le x' \\land \\neg(f(x) \\le f(x')))", '¬(A → B) ≡ A ∧ ¬B'], ["\\exists x\\; \\exists x'\\; (x \\le x' \\land f(x) > f(x'))", '¬(a ≤ b) ≡ a > b']], end: '«Есть пара x ≤ x′, на которой прогноз падает» — один такой контрпример опровергает монотонность (шаг 28).' },
    { t: '★★★ Равномерная непрерывность', words: '«f равномерно непрерывна»', steps: [["\\forall \\varepsilon > 0\\; \\exists \\delta > 0\\; \\forall x, x'\\; (|x - x'| < \\delta \\to |f(x) - f(x')| < \\varepsilon)", 'исходное'], ["\\exists \\varepsilon > 0\\; \\forall \\delta > 0\\; \\neg\\,\\forall x, x'\\; (\\ldots)", '¬∀ε = ∃ε¬, ¬∃δ = ∀δ¬'], ["\\exists \\varepsilon > 0\\; \\forall \\delta > 0\\; \\exists x, x'\\; \\neg(|x - x'| < \\delta \\to |f(x) - f(x')| < \\varepsilon)", '¬∀ = ∃¬'], ["\\exists \\varepsilon > 0\\; \\forall \\delta > 0\\; \\exists x, x'\\; (|x - x'| < \\delta \\land |f(x) - f(x')| \\ge \\varepsilon)", '¬(A → B) ≡ A ∧ ¬B']], end: '«Есть ε: как близко ни подходи, найдутся две точки, где значения расходятся на ε» — например, x² на всей прямой.' },
  ];
  GBC.widget('negation-machine', (el) => {
    const s = { i: 2, k: 1 };
    const w = ui.shell(el, { title: 'Машина отрицаний: проносим ¬ внутрь', sub: 'Отрицание проходит сквозь кванторы, меняя ∀ на ∃ и обратно, пока не дойдёт до простого условия. Ограничения вида «ε > 0» при этом остаются на месте.' });
    ui.select(w.controls, { label: 'Утверждение', value: s.i, options: NEGS.map((n, i) => ({ value: i, label: n.t })), onChange: (v) => ((s.i = +v), pl.setMax(NEGS[s.i].steps.length), pl.set(1), (s.k = 1), draw()) });
    const pl = ui.player(w.controls, { label: 'Шаги', min: 1, max: NEGS[s.i].steps.length, value: 1, fps: 0.8, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const words = H('div', { style: 'font-weight:650;margin-bottom:6px' });
    const list = H('div', { style: 'display:grid;gap:6px' });
    const end = H('div', { style: 'margin-top:8px;font-size:.92rem' });
    w.main.append(words, list, end);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'шаг' }, { key: 'r', label: 'правило' }]);
    function draw() {
      const N = NEGS[s.i];
      words.textContent = N.words;
      list.textContent = '';
      N.steps.slice(0, s.k).forEach(([tx, rule], i) => {
        const row = H('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr);gap:4px;border:1px solid ' + (i === s.k - 1 ? C_TRUE : 'var(--border)') + ';border-radius:10px;padding:6px 10px;background:var(--surface)' });
        row.appendChild(texEl(tx, false));
        row.appendChild(H('div', { style: 'font-size:.82rem;color:var(--ink-2)' }, (i ? '≡  ' : '') + rule));
        list.appendChild(row);
      });
      end.textContent = s.k === N.steps.length ? 'По-русски: ' + N.end : '';
      st.set('k', s.k + ' из ' + N.steps.length);
      st.set('r', N.steps[s.k - 1][1]);
      note.innerHTML = 'Три правила хватает для любых отрицаний: <b>¬∀x P ≡ ∃x ¬P</b>, <b>¬∃x P ≡ ∀x ¬P</b> (законы де Моргана для кванторов: ∀ — «большое И», ∃ — «большое ИЛИ») и <b>¬(A → B) ≡ A ∧ ¬B</b>. Плюс отрицания сравнений: ¬(a &lt; b) — это a ≥ b, а не a &gt; b. Ограниченный квантор «∀ε &gt; 0» при отрицании становится «∃ε &gt; 0», а не «∃ε ≤ 0»: ограничение задаёт область, по которой пробегает переменная. Механическое отрицание — главный инструмент, чтобы понять, что значит «не сходится», «не монотонна», «не лучше на всех фолдах», и найти правильный контрпример.';
    }
    draw();
  });

  /* ==============================================================================
   * 27. Игра ε–N: кванторы как ходы
   * ============================================================================== */
  const SEQS = [
    { t: 'aₙ = 1/n,  a = 0', f: (n) => 1 / n, a: 0, py: '1 / n' },
    { t: 'aₙ = (−1)ⁿ/n,  a = 0', f: (n) => (n % 2 ? -1 : 1) / n, a: 0, py: '(-1) ** n / n' },
    { t: 'aₙ = n/(n + 1),  a = 1', f: (n) => n / (n + 1), a: 1, py: 'n / (n + 1)' },
    { t: 'aₙ = sin(n)/√n,  a = 0', f: (n) => Math.sin(n) / Math.sqrt(n), a: 0, py: 'math.sin(n) / math.sqrt(n)' },
    { t: 'aₙ = (−1)ⁿ,  a = 0 — нет предела', f: (n) => (n % 2 ? -1 : 1), a: 0, py: '(-1) ** n' },
    { t: 'aₙ = 1 + 1/n,  a = 0.9 — не тот предел', f: (n) => 1 + 1 / n, a: 0.9, py: '1 + 1 / n' },
  ];
  const HORIZON = 2000;
  GBC.widget('epsilon-game', (el) => {
    const s = { q: 0, eps: 0.1, N: 5 };
    const w = ui.shell(el, { title: 'Определение предела как игра двух игроков', sub: '∀ε ∃N ∀n > N: |aₙ − a| < ε. Противник выбирает ε (ход «∀»), вы отвечаете номером N (ход «∃»), затем противник ищет n > N вне полосы (снова «∀»). Предел есть, если у вас есть ответ на любое ε.' });
    ui.select(w.controls, { label: 'Последовательность и кандидат в пределы', value: 0, options: SEQS.map((q, i) => ({ value: i, label: q.t })), onChange: (v) => ((s.q = +v), draw()) });
    const epsS = ui.slider(w.controls, { label: 'Ход противника: ε', values: [1, 0.5, 0.3, 0.2, 0.1, 0.05, 0.03, 0.02, 0.01], value: s.eps, format: (v) => String(v), onInput: (v) => ((s.eps = v), draw()) });
    const NS = ui.slider(w.controls, { label: 'Ваш ход: N', min: 0, max: 120, step: 1, value: s.N, format: String, onInput: (v) => ((s.N = v), draw()) });
    ui.button(w.controls, { label: 'Найти наименьшее N', icon: 'check', onClick: () => {
      const m = minN();
      if (m !== null && m <= 120) (s.N = m), NS.set(m);
      else if (m !== null) (s.N = 120), NS.set(120);
      draw();
    } });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'n', domain: [0, 121] }, y: { label: 'a_n' } });
    const verdict = H('div', { style: 'font-weight:650;margin-top:4px' });
    w.main.appendChild(verdict);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'bad', label: 'n > N вне полосы (до n = 2000)' }, { key: 'min', label: 'наименьшее подходящее N' }]);
    function minN() {
      const Q = SEQS[s.q];
      let last = 0;
      for (let n = 1; n <= HORIZON; n++) if (!(Math.abs(Q.f(n) - Q.a) < s.eps)) last = n;
      return last >= HORIZON - 5 ? null : last;
    }
    function draw() {
      const Q = SEQS[s.q];
      const ns = U.range(120, 1);
      const out = [];
      for (let n = s.N + 1; n <= HORIZON; n++) if (!(Math.abs(Q.f(n) - Q.a) < s.eps)) out.push(n);
      const shown = ns.filter((n) => n > s.N && !(Math.abs(Q.f(n) - Q.a) < s.eps));
      const ys = ns.map(Q.f);
      const lo = Math.min(...ys, Q.a - s.eps);
      const hi = Math.max(...ys, Q.a + s.eps);
      plot.render([
        { type: 'rect', x0: 0, x1: 121, y0: Q.a - s.eps, y1: Q.a + s.eps, fill: 'model', stroke: 'model', color: 'model', opacity: 0.12, label: 'полоса a ± ε' },
        { type: 'hline', y: Q.a, color: 'truth', dash: '5 4', width: 1.4 },
        { type: 'vline', x: s.N + 0.5, color: 'tree', width: 2, label: 'ваш N' },
        { type: 'points', x: ns.filter((n) => n <= s.N), y: ns.filter((n) => n <= s.N).map(Q.f), color: 'data', r: 3, label: 'n ≤ N (не важны)' },
        { type: 'points', x: ns.filter((n) => n > s.N && !shown.includes(n)), y: ns.filter((n) => n > s.N && !shown.includes(n)).map(Q.f), color: 'model', r: 3.5, label: 'n > N в полосе' },
        { type: 'points', x: shown, y: shown.map(Q.f), color: 'red', r: 5, label: 'n > N вне полосы' },
      ], { y: [lo - 0.08 * (hi - lo + 0.1), hi + 0.08 * (hi - lo + 0.1)] });
      const m = minN();
      verdict.textContent = out.length ? '✘ Противник выигрывает раунд: например, n = ' + out[0] + ', |aₙ − a| = ' + f3(Math.abs(Q.f(out[0]) - Q.a)) + ' ≥ ε.' : '✔ Вы выиграли раунд: все n от ' + (s.N + 1) + ' до ' + HORIZON + ' лежат в полосе.';
      verdict.style.color = out.length ? 'var(--critical-text)' : 'var(--good-text)';
      st.set('bad', String(out.length));
      st.set('min', m === null ? 'нет — противник всегда выиграет' : String(m));
      note.innerHTML = 'Порядок кванторов — это порядок ходов: N выбирается <em>после</em> ε и может от него зависеть (для 1/n годится N = ⌈1/ε⌉). Уменьшайте ε — подходящее N растёт, но для сходящейся последовательности оно всегда находится. Для (−1)ⁿ при ε ≤ 1 противник выигрывает при любом N: точки ±1 бесконечно часто выходят из полосы вокруг 0 — это и есть отрицание из шага 26: ∃ε ∀N ∃n &gt; N |aₙ − a| ≥ ε. Честная оговорка: виджет проверяет n только до ' + HORIZON + '; утверждение «для всех n» доказывают неравенствами, а не перебором (для 1/n: n &gt; N ≥ 1/ε ⇒ 1/n &lt; ε).';
    }
    w.pythonAction(() => {
      const Q = SEQS[s.q];
      return 'import math\n\na_n = lambda n: ' + Q.py + '\na, eps, N = ' + Q.a + ', ' + s.eps + ', ' + s.N + '\nbad = [n for n in range(N + 1, ' + (HORIZON + 1) + ') if not abs(a_n(n) - a) < eps]\nprint("n > N вне полосы:", len(bad), bad[:5])\nlast = max([n for n in range(1, ' + (HORIZON + 1) + ') if not abs(a_n(n) - a) < eps], default=0)\nprint("наименьшее подходящее N (в пределах проверки):", last)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 28. Утверждение «для всех x»: проверка монотонности модели
   * ============================================================================== */
  GBC.widget('property-check', (el) => {
    const s = { wd: 0.3, m: 20, seed: 1 };
    const w = ui.shell(el, { title: 'Монотонна ли модель? Тесты против доказательства', sub: 'Модель — сумма шести «ступенек» (как ансамбль пней по одному признаку). Утверждение «f не убывает» — это ∀x ∀x′ (x ≤ x′ → f(x) ≤ f(x′)). Случайные тесты ищут контрпример; точная проверка перебирает конечное число интервалов.' });
    ui.slider(w.controls, { label: 'Ширина провала w', min: 0.02, max: 1, step: 0.02, value: s.wd, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.wd = v), draw()) });
    ui.slider(w.controls, { label: 'Число случайных точек в тесте', values: [5, 10, 20, 50, 100, 200, 500], value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.button(w.controls, { label: 'Новый тест', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'x', domain: [0, 10] }, y: { label: 'f(x)', domain: [-0.05, 1.05] } });
    const res = monoBox();
    w.main.appendChild(res);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'run', label: 'этот тест' }, { key: 'p', label: 'P(тест найдёт нарушение)' }, { key: 'ex', label: 'точная проверка' }]);
    const steps = () => [[1, 0.2], [2.5, 0.3], [4, -0.08], [4 + s.wd, 0.08], [6, 0.25], [8, 0.2]];
    const f = (x) => steps().reduce((acc, [t, h]) => acc + (x > t ? h : 0), 0);
    function draw() {
      const ST = steps();
      const xs = [0, ...ST.map(([t]) => t), 10];
      const sx = [];
      const sy = [];
      for (let i = 0; i < xs.length - 1; i++) {
        const v = f((xs[i] + xs[i + 1]) / 2);
        sx.push(xs[i], xs[i + 1]);
        sy.push(v, v);
      }
      const rng = new GBC.RNG(1000 + s.seed);
      const pts = U.range(s.m).map(() => rng.uniform(0, 10)).sort((a, b) => a - b);
      let found = null;
      for (let i = 0; i < pts.length && !found; i++) for (let j = i + 1; j < pts.length; j++) if (f(pts[i]) > f(pts[j]) + 1e-12) {
        found = [pts[i], pts[j]];
        break;
      }
      const ints = [];
      for (let i = 0; i < xs.length - 1; i++) ints.push([xs[i], xs[i + 1], f((xs[i] + xs[i + 1]) / 2)]);
      const drop = ints.findIndex((I, i) => i > 0 && I[2] < ints[i - 1][2] - 1e-12);
      const pw = s.wd / 10;
      const pa = 1.5 / 10;
      const pDetect = 1 - Math.pow(1 - pw, s.m) - Math.pow(1 - pa, s.m) + Math.pow(1 - pw - pa, s.m);
      plot.render([
        { type: 'line', x: sx, y: sy, color: 'model', width: 2.4, label: 'модель f(x)' },
        { type: 'rect', x0: 4, x1: 4 + s.wd, y0: -0.05, y1: 1.05, fill: 'red', stroke: 'red', color: 'red', opacity: 0.1, label: 'провал' },
        { type: 'points', x: pts, y: pts.map(f), color: 'data', r: 3.5, label: 'точки теста' },
        found ? { type: 'points', x: found, y: found.map(f), color: 'red', r: 6, label: 'найденный контрпример' } : { type: 'points', x: [], y: [] },
      ]);
      res.textContent = 'Точная проверка: f кусочно-постоянна с порогами ' + ST.map(([t]) => U.fmt(t, 2)).join(', ') + ' — достаточно сравнить значения на ' + ints.length + ' интервалах:\n' + ints.map(([a, b, v]) => '(' + U.fmt(a, 2) + '; ' + U.fmt(b, 2) + ']: ' + U.fmt(v, 2)).join('   ') + (drop >= 0 ? '\n✘ значение падает на интервале (' + U.fmt(ints[drop][0], 2) + '; ' + U.fmt(ints[drop][1], 2) + '] — модель не монотонна.' : '');
      st.set('run', found ? 'нашёл: x = ' + U.fmt(found[0], 2) + ', x′ = ' + U.fmt(found[1], 2) : 'не нашёл');
      st.set('p', pct(pDetect));
      st.set('ex', drop >= 0 ? 'не монотонна' : 'монотонна');
      note.innerHTML = 'Чтобы <b>опровергнуть</b> «∀x ∀x′ …», достаточно одной пары — контрпример делает тест убедительным. Но тест, не нашедший нарушения, <b>ничего не доказывает</b>: при узком провале (w = 0.1) и 20 точках вероятность его заметить около 17 %. Для деревьев есть точный путь: модель кусочно-постоянна, её пороги известны, и «для всех x на прямой» сводится к конечной проверке интервалов — бесконечное ∀ превращается в конечную конъюнкцию. Поэтому монотонные ограничения в XGBoost и LightGBM (monotone_constraints) обеспечивают свойство по построению, а не по тестам (урок 12.3).';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\nw = ' + U.fmt(s.wd, 2) + '\nsteps = [(1, 0.2), (2.5, 0.3), (4, -0.08), (4 + w, 0.08), (6, 0.25), (8, 0.2)]\nf = lambda x: sum(h for t, h in steps if x > t)\n\n# точная проверка: значения на интервалах между порогами\nedges = [0] + [t for t, _ in steps] + [10]\nvals = [f((a + b) / 2) for a, b in zip(edges, edges[1:])]\nprint("значения на интервалах:", np.round(vals, 2), " монотонна:", all(a <= b for a, b in zip(vals, vals[1:])))\n\n# случайный тест\nrng = Mulberry32(' + (1000 + s.seed) + ')\npts = sorted(rng.uniform(0, 10) for _ in range(' + s.m + '))\nprint("тест нашёл нарушение:", any(f(a) > f(b) for i, a in enumerate(pts) for b in pts[i + 1:]))\n');
    draw();
  });
})();
