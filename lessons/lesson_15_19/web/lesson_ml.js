/* Урок 15.19: математическая логика. Часть 3 — доказательства, логика в деревьях и бустинге, границы логики.
 * Виджеты: доказательство перебором остатков; числа Евклида; индукция (четыре сюжета, включая ошибочную);
 * индукция по деревьям (L = I + 1); охота на контрпримеры к гипотезам; дерево решений как набор правил и ДНФ;
 * чётность и жадное дерево; минимальное и жадное дерево для булевой функции; бустинг из пней и XOR
 * (взаимодействие и симметрия); мягкая логика (вероятности, t-нормы, мягкий порог); DPLL для SAT;
 * диагональный аргумент; тренажёр-генератор задач.
 * Помощники — из GBC.lesson1519 (часть 1, lesson.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const {
    f2, f3, grp, pct, plural, cvar, tint, C_TRUE, flexRow, texInto, texEl, card, cardGrid, badge, rowTable, monoBox, svgBox, sText, legendRow, boolTable,
    P, str, compile, envs, outs, kindOf, compare, minDNF, dnfText, minTree, greedyTree,
    PY_IT, pyLambda, drawTree, boolTreeDraw, isPrime,
  } = GBC.lesson1519;
  const VN = ['A', 'B', 'C', 'D'];
  const sub = (k) => String(k).split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[+c]).join('');
  function factor(n) {
    const f = [];
    let m = n;
    for (let d = 2; d * d <= m; d++) while (m % d === 0) (f.push(d), (m /= d));
    if (m > 1) f.push(m);
    return f;
  }

  /* ==============================================================================
   * 29. Доказательство перебором остатков
   * ============================================================================== */
  const RES = [
    { t: '★ n² + n чётно', m: 2, f: (r) => r * r + r, ok: (v) => v % 2 === 0, cond: null, want: '≡ 0 (mod 2)', py: 'n * n + n', pyok: 'v % 2 == 0' },
    { t: '★ n² даёт остаток 0 или 1 при делении на 3', m: 3, f: (r) => r * r, ok: (v) => v % 3 <= 1, cond: null, want: 'mod 3 ∈ {0, 1}', py: 'n * n', pyok: 'v % 3 in (0, 1)' },
    { t: '★★ n² + 1 не делится на 3', m: 3, f: (r) => r * r + 1, ok: (v) => v % 3 !== 0, cond: null, want: '≢ 0 (mod 3)', py: 'n * n + 1', pyok: 'v % 3 != 0' },
    { t: '★★ n³ − n делится на 6', m: 6, f: (r) => r ** 3 - r, ok: (v) => v % 6 === 0, cond: null, want: '≡ 0 (mod 6)', py: 'n ** 3 - n', pyok: 'v % 6 == 0' },
    { t: '★★ если n нечётно, то n² − 1 делится на 8', m: 8, f: (r) => r * r - 1, ok: (v) => v % 8 === 0, cond: (r) => r % 2 === 1, want: '≡ 0 (mod 8)', py: 'n * n - 1', pyok: 'v % 8 == 0', pycond: 'n % 2 == 1' },
    { t: '✘ n² − 1 делится на 8 (условие забыто)', m: 8, f: (r) => r * r - 1, ok: (v) => ((v % 8) + 8) % 8 === 0, cond: null, want: '≡ 0 (mod 8)', py: 'n * n - 1', pyok: 'v % 8 == 0' },
    { t: '★★★ n⁵ − n делится на 30', m: 30, f: (r) => r ** 5 - r, ok: (v) => v % 30 === 0, cond: null, want: '≡ 0 (mod 30)', py: 'n ** 5 - n', pyok: 'v % 30 == 0' },
  ];
  GBC.widget('residue-cases', (el) => {
    const s = { i: 3 };
    const w = ui.shell(el, { title: 'Доказательство разбором случаев: остатки', sub: 'Утверждение про все целые n, у которого ответ зависит только от остатка n при делении на m. Тогда m случаев — это не «примеры», а полное доказательство.' });
    ui.select(w.controls, { label: 'Утверждение', value: s.i, options: RES.map((r, i) => ({ value: i, label: r.t })), onChange: (v) => ((s.i = +v), draw()) });
    const tbl = H('div');
    const verdict = H('div', { style: 'font-weight:650;margin-top:6px' });
    w.main.append(tbl, verdict);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'случаев (остатков)' }, { key: 'v', label: 'итог' }, { key: 'chk', label: 'проверка n = −500…500' }]);
    function draw() {
      const R = RES[s.i];
      const rows = U.range(R.m).map((r) => {
        if (R.cond && !R.cond(r)) return [String(r), '—', '—', 'условие ложно — случай не нужен'];
        const v = R.f(r);
        return [String(r), String(v), String(((v % R.m) + R.m) % R.m), R.ok(v) ? '✔' : '✘ контрпример: n = ' + r];
      });
      const bad = U.range(R.m).filter((r) => (!R.cond || R.cond(r)) && !R.ok(R.f(r)));
      tbl.textContent = '';
      rowTable(tbl, ['остаток r', 'значение при n = r', 'остаток по mod ' + R.m, 'нужно: ' + R.want], rows, (i) => bad.includes(i), false);
      let chk = true;
      for (let n = -500; n <= 500; n++) {
        const r = ((n % R.m) + R.m) % R.m;
        if (R.cond && !R.cond(r)) continue;
        if (!R.ok(((R.f(n) % R.m) + R.m) % R.m)) chk = false;
      }
      verdict.textContent = bad.length ? '✘ Утверждение ложно: при n = ' + bad[0] + ' (и всех n ≡ ' + bad[0] + ' mod ' + R.m + ') оно нарушается.' : '✔ Доказано для всех целых n: проверены все ' + R.m + ' ' + plural(R.m, 'остаток', 'остатка', 'остатков') + '.';
      verdict.style.color = bad.length ? 'var(--critical-text)' : 'var(--good-text)';
      st.set('m', String(R.m));
      st.set('v', bad.length ? 'ложно' : 'доказано');
      st.set('chk', chk ? 'нарушений нет' : 'есть нарушения');
      note.innerHTML = 'Почему конечного числа случаев хватает: если n = mq + r, то n² = m(…) + r², n³ = m(…) + r³ и т. д. — остаток многочлена с целыми коэффициентами зависит только от остатка n. Все целые числа разбиты на m классов, и мы проверили каждый класс — это <b>разбор случаев</b>, правильный вывод «A ∨ B ∨ … → C» из шага 10. Сравните пятое и шестое утверждения: условие «n нечётно» убирает чётные остатки, и утверждение становится верным; без условия n = 2 даёт 3, которое на 8 не делится. Последнее (n⁵ − n делится на 30) — частный случай малой теоремы Ферма, урок 15.20.';
    }
    w.pythonAction(() => {
      const R = RES[s.i];
      return '# ' + R.t + '\nm = ' + R.m + '\nf = lambda n: ' + R.py + '\nok = lambda v: ' + R.pyok + '\ncases = [r for r in range(m)' + (R.cond ? ' if (lambda n: ' + R.pycond + ')(r)' : '') + ']\nbad = [r for r in cases if not ok(f(r) % m)]\nprint("доказано для всех n" if not bad else f"ложно, остатки-контрпримеры: {bad}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 30. Простых бесконечно много: числа Евклида
   * ============================================================================== */
  const PR = [2, 3, 5, 7, 11, 13, 17, 19, 23];
  GBC.widget('euclid', (el) => {
    const s = { k: 6 };
    const w = ui.shell(el, { title: 'Доказательство Евклида: N = p₁·p₂·…·pₖ + 1', sub: 'Допустим, простых конечно много: p₁, …, pₖ. Число N = p₁·…·pₖ + 1 при делении на каждое из них даёт остаток 1, поэтому его простые делители — новые. Противоречие.' });
    ui.slider(w.controls, { label: 'Сколько первых простых взять (k)', min: 1, max: 9, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const tbl = H('div');
    const line = monoBox('font-size:.95rem');
    w.main.append(line, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'N', label: 'N' }, { key: 'f', label: 'разложение N' }, { key: 'pr', label: 'N простое?' }]);
    function draw() {
      const ps = PR.slice(0, s.k);
      const N = ps.reduce((a, b) => a * b, 1) + 1;
      const fs = factor(N);
      line.textContent = 'N = ' + ps.join('·') + ' + 1 = ' + grp(N) + '\nостатки N при делении на ' + ps.join(', ') + ': ' + ps.map((p) => N % p).join(', ') + '\nпростые делители N: ' + fs.map(grp).join(' · ') + ' — ни одного из списка';
      tbl.textContent = '';
      rowTable(tbl, ['k', 'p₁·…·pₖ + 1', 'разложение', 'простое?'], U.range(9, 1).map((k) => {
        const n = PR.slice(0, k).reduce((a, b) => a * b, 1) + 1;
        const f = factor(n);
        return [String(k), grp(n), f.map(grp).join(' · '), f.length === 1 ? 'да' : 'нет'];
      }), (i) => i === s.k - 1, false);
      st.set('N', grp(N));
      st.set('f', fs.map(grp).join(' · '));
      st.set('pr', fs.length === 1 ? 'да' : 'нет — но делители новые');
      note.innerHTML = 'Тонкость, которую часто упускают: доказательство <b>не</b> утверждает, что N простое. При k = 6 получаем 30 031 = 59 · 509 — составное. Важно лишь, что у N есть простой делитель (у любого числа больше 1 он есть — это доказывается сильной индукцией, шаг 32), и этот делитель не входит в список. Схема «от противного»: предположили ¬C («простых конечно много»), вывели противоречие («у N есть простой делитель вне полного списка всех простых»), значит, C. Доказательство конструктивно в слабом смысле: из любого конечного списка простых оно строит новое простое число.';
    }
    w.pythonAction(() => 'from math import prod\n\ndef factor(n):\n    f, d = [], 2\n    while d * d <= n:\n        while n % d == 0:\n            f.append(d)\n            n //= d\n        d += 1\n    return f + ([n] if n > 1 else [])\n\nprimes = ' + JSON.stringify(PR) + '\nfor k in range(1, len(primes) + 1):\n    N = prod(primes[:k]) + 1\n    print(k, N, factor(N), "все делители новые:", not set(factor(N)) & set(primes[:k]))\n');
    draw();
  });

  /* ==============================================================================
   * 31. Математическая индукция: четыре сюжета
   * ============================================================================== */
  GBC.widget('induction', (el) => {
    const s = { mode: 'odd', n: 4, base: true, step: true, brk: 7 };
    const w = ui.shell(el, { title: 'Математическая индукция', sub: 'База: P(1) верно. Шаг: из P(n) следует P(n + 1). Тогда P(n) верно для всех n — как цепочка домино: первая падает, каждая роняет следующую.' });
    ui.segmented(w.controls, { label: 'Сюжет', value: s.mode, options: [{ value: 'odd', label: 'нечётные → квадрат' }, { value: 'tri', label: '1 + … + n' }, { value: 'domino', label: 'домино' }, { value: 'horses', label: 'ошибка: лошади' }], onChange: (v) => ((s.mode = v), sync(), draw()) });
    const pl = ui.player(w.controls, { label: 'n', min: 1, max: 10, value: s.n, fps: 1.2, format: (k) => 'n = ' + k, onChange: (k) => ((s.n = k), draw()) });
    const tb = ui.toggle(w.controls, { label: 'База: первая костяшка падает', checked: true, onChange: (v) => ((s.base = v), draw()) });
    const ts = ui.toggle(w.controls, { label: 'Шаг: каждая роняет следующую', checked: true, onChange: (v) => ((s.step = v), draw()) });
    const sb = ui.slider(w.controls, { label: 'Шаг ломается после костяшки №', min: 1, max: 12, step: 1, value: s.brk, format: String, onInput: (v) => ((s.brk = v), draw()) });
    function sync() {
      const dom = s.mode === 'domino';
      tb.el.style.display = dom ? '' : 'none';
      ts.el.style.display = dom ? '' : 'none';
      sb.el.style.display = dom && !s.step ? '' : 'none';
    }
    const holder = H('div');
    const line = monoBox('text-align:center;font-size:.95rem');
    w.main.append(holder, line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'левая часть' }, { key: 'b', label: 'правая часть' }, { key: 'c', label: 'вывод' }]);
    function draw() {
      sync();
      holder.textContent = '';
      const n = s.n;
      if (s.mode === 'odd') {
        const cs = 26;
        const svg = svgBox(holder, 10 * cs + 20, 10 * cs + 20, 240, 340);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const k = Math.max(i, j) + 1;
          const last = k === n;
          svg.appendChild(S('rect', { x: 10 + i * cs + 2, y: 10 + (9 - j) * cs + 2, width: cs - 4, height: cs - 4, rx: 4, fill: last ? tint('var(--c-orange)', 70) : tint(k % 2 ? C_TRUE : 'var(--c-aqua)', 45), stroke: last ? 'var(--c-orange)' : 'none' }));
        }
        const terms = U.range(n, 1).map((k) => 2 * k - 1);
        line.textContent = terms.join(' + ') + ' = ' + n * n + ' = ' + n + '²';
        st.set('a', String(U.sum(terms)));
        st.set('b', String(n * n));
        st.set('c', 'P(' + n + ') верно');
        note.innerHTML = '<b>Утверждение</b> P(n): 1 + 3 + … + (2n − 1) = n². <b>База:</b> 1 = 1². <b>Шаг:</b> пусть P(n) верно; добавим следующее нечётное 2n + 1: n² + 2n + 1 = (n + 1)². На картинке это оранжевый «уголок» из 2n − 1 клеток, достраивающий квадрат (n − 1) × (n − 1) до n × n. Шаг доказан для <em>произвольного</em> n — вот что отличает индукцию от проверки примеров.';
      } else if (s.mode === 'tri') {
        const cs = 22;
        const svg = svgBox(holder, 11 * cs + 20, 10 * cs + 20, 240, 360);
        for (let i = 0; i < n; i++) for (let j = 0; j <= n; j++) {
          const mine = j <= i;
          svg.appendChild(S('rect', { x: 10 + j * cs + 2, y: 10 + (9 - n + 1 + i) * cs + 2, width: cs - 4, height: cs - 4, rx: 3, fill: mine ? tint(C_TRUE, 55) : tint('var(--c-orange)', 40) }));
        }
        line.textContent = U.range(n, 1).join(' + ') + ' = ' + (n * (n + 1)) / 2 + ' = ' + n + '·' + (n + 1) + '/2';
        st.set('a', String((n * (n + 1)) / 2));
        st.set('b', String((n * (n + 1)) / 2));
        st.set('c', 'P(' + n + ') верно');
        note.innerHTML = '<b>P(n):</b> 1 + 2 + … + n = n(n + 1)/2. Две «лесенки» (синяя и оранжевая) складываются в прямоугольник n × (n + 1) — это прямое доказательство. <b>Индукцией:</b> база 1 = 1·2/2; шаг: n(n + 1)/2 + (n + 1) = (n + 1)(n + 2)/2. Число пар объектов C(n + 1, 2) = n(n + 1)/2 считается так же — именно столько сравнений делает, например, перебор всех пар признаков.';
      } else if (s.mode === 'domino') {
        const svg = svgBox(holder, 12 * 44 + 30, 150, 360, 640);
        let fallen = 0;
        if (s.base) {
          fallen = 1;
          while (fallen < 12 && (s.step || fallen < s.brk)) fallen++;
        }
        const shown = Math.min(fallen, Math.max(n, s.base ? 1 : 0));
        for (let i = 0; i < 12; i++) {
          const fall = i < shown;
          const x = 22 + i * 44;
          svg.appendChild(S('rect', { x: fall ? x : x + 8, y: fall ? 96 : 30, width: fall ? 40 : 14, height: fall ? 14 : 80, rx: 3, fill: fall ? tint('var(--c-orange)', 60) : tint(C_TRUE, 45), stroke: fall ? 'var(--c-orange)' : C_TRUE, transform: fall ? 'rotate(-12 ' + (x + 20) + ' 103)' : null }));
          svg.appendChild(sText(x + 15, 130, String(i + 1), { size: 11, color: 'var(--ink-2)' }));
        }
        svg.appendChild(S('line', { x1: 10, y1: 112, x2: 12 * 44 + 25, y2: 112, stroke: 'var(--border-strong)' }));
        line.textContent = !s.base ? 'Нет базы: шаг верен, но цепочка не запускается.' : s.step ? 'База + шаг ⇒ падают все костяшки.' : 'Шаг ломается после №' + s.brk + ': упали только первые ' + Math.min(s.brk, 12) + '.';
        st.set('a', 'база ' + (s.base ? '✔' : '✘'));
        st.set('b', 'шаг ' + (s.step ? '✔' : '✘ на ' + s.brk + ' → ' + (s.brk + 1)));
        st.set('c', s.base && s.step ? 'все упали' : 'не все');
        note.innerHTML = 'Индукции нужны <b>обе</b> части. Без базы шаг «из P(n) следует P(n + 1)» может быть истинным для ложного утверждения: «n = n + 1» — если бы оно было верно для n, то и для n + 1, но базы нет. Если шаг верен не для всех n, цепочка рвётся. Формально: (P(1) ∧ ∀n (P(n) → P(n + 1))) → ∀n P(n). Играйте выключателями и ползунком; плеер n показывает падение по шагам.';
      } else {
        const svg = svgBox(holder, 12 * 40 + 20, 150, 360, 600);
        const m = Math.max(2, n);
        for (let i = 0; i < m; i++) {
          const inA = i < m - 1;
          const inB = i > 0;
          const x = 26 + i * 40;
          svg.appendChild(S('circle', { cx: x, cy: 75, r: 14, fill: i === 0 ? tint('var(--c-orange)', 60) : i === m - 1 ? tint(C_TRUE, 60) : tint('var(--c-aqua)', 45), stroke: 'var(--ink-2)' }));
          if (inA) svg.appendChild(S('line', { x1: x - 16, y1: 46, x2: x + 16, y2: 46, stroke: C_TRUE, 'stroke-width': 4 }));
          if (inB) svg.appendChild(S('line', { x1: x - 16, y1: 104, x2: x + 16, y2: 104, stroke: 'var(--c-orange)', 'stroke-width': 4 }));
        }
        svg.appendChild(sText(20, 30, 'первые n − 1 лошадей (одного цвета по предположению)', { size: 11, anchor: 'start', color: 'var(--ink-2)' }));
        svg.appendChild(sText(20, 124, 'последние n − 1 лошадей (тоже одного цвета)', { size: 11, anchor: 'start', color: 'var(--ink-2)' }));
        const overlap = m - 2;
        line.textContent = 'n = ' + m + ': общих лошадей у двух групп — ' + overlap + (overlap ? ' → цвета групп совпадают' : ' → связать цвета групп нечем, шаг 1 → 2 ломается');
        st.set('a', 'n = ' + m);
        st.set('b', 'пересечение: ' + overlap);
        st.set('c', overlap ? 'переход верен' : 'переход ложен');
        note.innerHTML = '«Все лошади одного цвета». База: одна лошадь — одного цвета. «Шаг»: из n лошадей уберём последнюю — остальные одного цвета; уберём первую — тоже; группы пересекаются, значит, все одного цвета. Ошибка в шаге <b>n = 1 → 2</b>: группы {1} и {2} не пересекаются (поставьте n = 2). Шаг должен быть верен для <em>каждого</em> n, а здесь он ломается ровно в одном месте — и этого достаточно, чтобы рухнуло всё. Проверяйте шаг на самых маленьких n.';
      }
    }
    w.pythonAction(() => 'n_max = 50\nodd = all(sum(2 * k - 1 for k in range(1, n + 1)) == n * n for n in range(1, n_max + 1))\ntri = all(sum(range(1, n + 1)) == n * (n + 1) // 2 for n in range(1, n_max + 1))\nprint("проверка до", n_max, ":", odd, tri, "— это примеры; доказательство — индукцией")\n# шаг индукции символьно: n^2 + (2n + 1) == (n + 1)^2 для любого n\nprint(all(n * n + 2 * n + 1 == (n + 1) ** 2 for n in range(-1000, 1000)))\n');
    draw();
  });

  /* ==============================================================================
   * 32. Индукция по деревьям: L = I + 1
   * ============================================================================== */
  GBC.widget('tree-induction', (el) => {
    const s = { k: 5, seed: 3 };
    const w = ui.shell(el, { title: 'Индукция по построению: листьев на один больше, чем внутренних узлов', sub: 'Дерево растёт так же, как дерево решений: на каждом шаге один лист делится на два. Утверждение L = I + 1 верно для одного листа и сохраняется каждым разбиением.' });
    const pl = ui.player(w.controls, { label: 'Разбиений', min: 0, max: 14, value: s.k, fps: 1.2, format: (k) => k + ' ' + plural(k, 'разбиение', 'разбиения', 'разбиений'), onChange: (k) => ((s.k = k), draw()) });
    ui.button(w.controls, { label: 'Другое дерево', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const holder = H('div');
    const tbl = H('div');
    w.main.append(holder, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'листьев L' }, { key: 'I', label: 'внутренних I' }, { key: 'd', label: 'глубина d' }, { key: 'b', label: 'L ≤ 2ᵈ' }]);
    function grow(k) {
      const rng = new GBC.RNG(s.seed);
      const root = { kids: [], depth: 0 };
      const leaves = [root];
      const hist = [[1, 0, 0]];
      for (let i = 0; i < k; i++) {
        const j = rng.randint(leaves.length);
        const lf = leaves.splice(j, 1)[0];
        lf.kids = [{ kids: [], depth: lf.depth + 1 }, { kids: [], depth: lf.depth + 1 }];
        lf.split = i + 1;
        leaves.push(...lf.kids);
        hist.push([leaves.length, i + 1, Math.max(...leaves.map((x) => x.depth))]);
      }
      return { root, hist };
    }
    function draw() {
      const { root, hist } = grow(s.k);
      const conv = (nd) => ({ label: nd.kids.length ? String(nd.split) : '', kids: nd.kids.map(conv), val: nd.kids.length ? undefined : 1, cur: nd.split === s.k && s.k > 0 });
      holder.textContent = '';
      drawTree(holder, conv(root), { dx: 34, dy: 46, r: 13, minW: 300, squareLeaves: true, showVals: false });
      const [L, I, d] = hist[hist.length - 1];
      tbl.textContent = '';
      rowTable(tbl, ['разбиений', 'листьев L', 'внутренних I', 'L − I', 'глубина d', '2ᵈ'], hist.map(([l, i, dd]) => [String(i), String(l), String(i), String(l - i), String(dd), String(2 ** dd)]), (i) => i === hist.length - 1, true);
      st.set('L', String(L));
      st.set('I', String(I));
      st.set('d', String(d));
      st.set('b', L <= 2 ** d ? 'да' : 'нет');
      note.innerHTML = '<b>Индукция по числу разбиений.</b> База: дерево из одного листа, L = 1, I = 0. Шаг: разбиение превращает один лист во внутренний узел (I увеличивается на 1) и добавляет два листа вместо одного (L увеличивается на 1) — разность L − I не меняется. Значит, у любого бинарного дерева L = I + 1, а всего узлов 2L − 1. Так же индукцией по глубине доказывается L ≤ 2ᵈ: дерево глубины d — корень и два поддерева глубины не больше d − 1. Это причина, по которой max_depth = 6 в XGBoost означает не больше 64 листьев, а num_leaves = 31 в LightGBM — ровно 30 разбиений.';
    }
    w.pythonAction(() => 'import numpy as np\nfrom sklearn.tree import DecisionTreeRegressor\nfrom gbcourse.rng import Mulberry32\n\nrng = Mulberry32(0)\nX = np.array([[rng.random() for _ in range(3)] for _ in range(300)])\ny = np.array([rng.random() for _ in range(300)])\nfor depth in range(1, 8):\n    t = DecisionTreeRegressor(max_depth=depth, random_state=0).fit(X, y).tree_\n    leaves = t.n_leaves\n    internal = t.node_count - leaves\n    print(f"глубина {depth}: L = {leaves}, I = {internal}, L - I = {leaves - internal}, L <= 2^d: {leaves <= 2 ** depth}")\n');
    draw();
  });

  /* ==============================================================================
   * 33. Охота на контрпримеры
   * ============================================================================== */
  const CONJ = [
    { t: 'n² + n + 41 — простое при всех n ≥ 0 (Эйлер)', lim: 60, xs: (L) => U.range(L + 1), val: (n) => n * n + n + 41, ok: (n) => isPrime(n * n + n + 41), yl: 'n² + n + 41', show: (n) => grp(n * n + n + 41) + ' = ' + factor(n * n + n + 41).map(grp).join('·') },
    { t: 'n² − 79n + 1601 — простое', lim: 100, xs: (L) => U.range(L + 1), val: (n) => n * n - 79 * n + 1601, ok: (n) => isPrime(n * n - 79 * n + 1601), yl: 'n² − 79n + 1601', show: (n) => grp(n * n - 79 * n + 1601) + ' = ' + factor(n * n - 79 * n + 1601).map(grp).join('·') },
    { t: '2^(2ⁿ) + 1 — простое (Ферма)', lim: 5, xs: (L) => U.range(L + 1), val: (n) => 2 ** (2 ** n) + 1, ok: (n) => isPrime(2 ** (2 ** n) + 1), yl: 'log₂(Fₙ − 1) = 2ⁿ', y: (n) => 2 ** n, show: (n) => grp(2 ** (2 ** n) + 1) + ' = ' + factor(2 ** (2 ** n) + 1).map(grp).join(' · ') },
    { t: '2ᵖ − 1 простое для каждого простого p', lim: 31, xs: (L) => U.range(L + 1).filter(isPrime), val: (p) => 2 ** p - 1, ok: (p) => isPrime(2 ** p - 1), yl: 'p (показатель)', y: (p) => p, show: (p) => grp(2 ** p - 1) + ' = ' + factor(2 ** p - 1).map(grp).join(' · ') },
    { t: 'нечётное n > 1 — простое или p + 2k² (Гольдбах, 1752)', lim: 6000, xs: (L) => U.range(L + 1).filter((n) => n > 1 && n % 2 === 1), val: (n) => repsOdd(n), ok: (n) => isPrime(n) || repsOdd(n) > 0, yl: 'способов p + 2k²', show: (n) => grp(n) + ' = ' + factor(n).map(grp).join(' · ') + ', а n − 2k² не бывает простым' },
    { t: 'чётное n ≥ 4 — сумма двух простых (Гольдбах, не доказано)', lim: 6000, xs: (L) => U.range(L + 1).filter((n) => n >= 4 && n % 2 === 0), val: (n) => repsEven(n), ok: (n) => repsEven(n) > 0, yl: 'способов p + q', show: () => '' },
  ];
  const PRIMES = U.range(6100).filter(isPrime);
  const PSET = new Set(PRIMES);
  function repsOdd(n) {
    let c = 0;
    for (let k = 1; 2 * k * k < n; k++) if (PSET.has(n - 2 * k * k)) c++;
    return c;
  }
  function repsEven(n) {
    let c = 0;
    for (const p of PRIMES) {
      if (p > n / 2) break;
      if (PSET.has(n - p)) c++;
    }
    return c;
  }
  GBC.widget('conjecture-hunter', (el) => {
    const s = { i: 0, frac: 1 };
    const w = ui.shell(el, { title: 'Охота на контрпримеры: «проверено много раз» ≠ «доказано»', sub: 'Каждая гипотеза выполняется на длинном начальном отрезке. Двигайте границу проверки и ищите первый контрпример.' });
    ui.select(w.controls, { label: 'Гипотеза', value: 0, options: CONJ.map((c, i) => ({ value: i, label: c.t })), onChange: (v) => ((s.i = +v), (s.frac = 1), sl.set(1), draw()) });
    const sl = ui.slider(w.controls, { label: 'Проверить до (доля диапазона)', min: 0.05, max: 1, step: 0.05, value: 1, format: (v) => pct(v, 0), onInput: (v) => ((s.frac = v), draw()) });
    const plotBox = H('div');
    const res = monoBox();
    w.main.append(plotBox, res);
    let plot = null;
    let plotFor = -1;
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'проверено значений' }, { key: 'cx', label: 'первый контрпример' }]);
    function draw() {
      const C = CONJ[s.i];
      const L = Math.max(2, Math.round(C.lim * s.frac));
      const xs = C.xs(L);
      const okA = xs.map(C.ok);
      const ys = xs.map((n) => (C.y ? C.y(n) : C.val(n)));
      const bad = xs.filter((n, i) => !okA[i]);
      if (plotFor !== s.i) {
        plotBox.textContent = '';
        plot = new GBC.Plot(plotBox, { height: 260, x: { label: s.i === 3 ? 'p' : 'n' }, y: { label: C.yl } });
        plotFor = s.i;
      }
      plot.render([
        { type: 'points', x: xs.filter((n, i) => okA[i]), y: ys.filter((v, i) => okA[i]), color: 'model', r: xs.length > 300 ? 1.6 : 3.5, label: 'выполняется' },
        { type: 'points', x: bad, y: bad.map((n) => (C.y ? C.y(n) : C.val(n))), color: 'red', r: 6, label: 'контрпример' },
      ]);
      const first = bad[0];
      res.textContent = 'Проверено ' + xs.length + ' значений n от ' + xs[0] + ' до ' + xs[xs.length - 1] + '.\n' + (first === undefined ? 'Контрпримеров не найдено. Это НЕ доказательство.' : 'Первый контрпример: n = ' + grp(first) + (C.show(first) ? ':  ' + C.show(first) : '') + (bad.length > 1 ? '\nВсего контрпримеров на отрезке: ' + bad.length + (bad.length <= 6 ? ' (' + bad.map(grp).join(', ') + ')' : '') : ''));
      st.set('n', String(xs.length));
      st.set('cx', first === undefined ? 'не найден' : 'n = ' + grp(first));
      note.innerHTML = 'Многочлен Эйлера n² + n + 41 даёт простые числа при n = 0, 1, …, 39 и ломается на n = 40: 1681 = 41². Ферма проверил пять чисел 2^(2ⁿ) + 1 (3, 5, 17, 257, 65 537) и предположил, что все они простые; Эйлер нашёл 4 294 967 297 = 641 · 6 700 417. Гипотеза Гольдбаха о нечётных числах держится до 5777. А обычная гипотеза Гольдбаха (чётные числа) проверена компьютерами до 4·10¹⁸ — и всё ещё не доказана: число способов растёт, но «растёт на графике» — тоже не доказательство. Отсюда правило для ML: «работает на трёх датасетах» — это примеры, а не гарантия.';
    }
    w.pythonAction(() => {
      const C = CONJ[s.i];
      const L = Math.max(2, Math.round(C.lim * s.frac));
      const tests = [
        'ok = lambda n: is_prime(n * n + n + 41)\nxs = range(' + (L + 1) + ')',
        'ok = lambda n: is_prime(n * n - 79 * n + 1601)\nxs = range(' + (L + 1) + ')',
        'ok = lambda n: is_prime(2 ** (2 ** n) + 1)\nxs = range(' + (L + 1) + ')',
        'ok = lambda p: is_prime(2 ** p - 1)\nxs = [p for p in range(' + (L + 1) + ') if is_prime(p)]',
        'ok = lambda n: is_prime(n) or any(is_prime(n - 2 * k * k) for k in range(1, int((n / 2) ** 0.5) + 1))\nxs = range(3, ' + (L + 1) + ', 2)',
        'ok = lambda n: any(is_prime(p) and is_prime(n - p) for p in range(2, n // 2 + 1))\nxs = range(4, ' + (L + 1) + ', 2)',
      ];
      return '# ' + C.t + '\ndef is_prime(n):\n    return n > 1 and all(n % d for d in range(2, int(n ** 0.5) + 1))\n\n' + tests[s.i] + '\nbad = [n for n in xs if not ok(n)]\nprint("контрпримеры:", bad[:10] if bad else "не найдены — но это не доказательство")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 34. Дерево решений как набор правил и ДНФ
   * ============================================================================== */
  const TR_DATA = (() => {
    const rng = new GBC.RNG(23);
    const X = [];
    const y = [];
    for (let i = 0; i < 200; i++) {
      const x1 = rng.uniform(0, 10);
      const x2 = rng.uniform(0, 10);
      let c = (x1 > 6 && x2 < 4) || (x1 < 3 && x2 > 6) ? 1 : 0;
      if (rng.random() < 0.05) c = 1 - c;
      X.push([x1, x2]);
      y.push(c);
    }
    return { X, y };
  })();
  function leafRules(tree) {
    const out = [];
    (function go(id, lo, hi, path) {
      const nd = tree.nodes[id];
      if (nd.left < 0) {
        out.push({ id, lo: lo.slice(), hi: hi.slice(), path: path.slice(), value: nd.value, n: nd.n });
        return;
      }
      const f = nd.feature;
      const t = nd.threshold;
      const hi2 = hi.slice();
      hi2[f] = Math.min(hi2[f], t);
      go(nd.left, lo, hi2, path.concat([[f, '≤', t]]));
      const lo2 = lo.slice();
      lo2[f] = Math.max(lo2[f], t);
      go(nd.right, lo2, hi, path.concat([[f, '>', t]]));
    })(0, [-Infinity, -Infinity], [Infinity, Infinity], []);
    return out;
  }
  const XN = ['x₁', 'x₂'];
  const condText = (r, simple) => {
    if (!simple) return r.path.map(([f, op, t]) => XN[f] + ' ' + op + ' ' + U.fmt(t, 2)).join(' ∧ ') || 'всегда';
    const parts = [];
    [0, 1].forEach((f) => {
      const a = r.lo[f];
      const b = r.hi[f];
      if (a === -Infinity && b === Infinity) return;
      if (a === -Infinity) parts.push(XN[f] + ' ≤ ' + U.fmt(b, 2));
      else if (b === Infinity) parts.push(XN[f] + ' > ' + U.fmt(a, 2));
      else parts.push(U.fmt(a, 2) + ' < ' + XN[f] + ' ≤ ' + U.fmt(b, 2));
    });
    return parts.join(' ∧ ') || 'всегда';
  };
  GBC.widget('tree-rules', (el) => {
    const s = { d: 3, leaf: 0, simple: true };
    const w = ui.shell(el, { title: 'Дерево решений = набор правил = ДНФ', sub: 'Дерево обучено на 200 точках (класс 1 — два угла квадрата, 5 % меток зашумлено). Путь к листу — конъюнкция условий; класс 1 — дизъюнкция путей к листам с ответом 1.' });
    const sd = ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 5, step: 1, value: s.d, format: String, onInput: (v) => ((s.d = v), (s.leaf = 0), draw()) });
    const sl = ui.slider(w.controls, { label: 'Выбранный лист', min: 1, max: 8, step: 1, value: 1, format: String, onInput: (v) => ((s.leaf = v - 1), draw()) });
    ui.toggle(w.controls, { label: 'Упростить условия (по интервалам)', checked: true, onChange: (v) => ((s.simple = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, equal: true, x: { label: 'x_1', domain: [0, 10] }, y: { label: 'x_2', domain: [0, 10] } });
    const tvBox = H('div', { style: 'overflow-x:auto' });
    const rules = monoBox();
    w.main.append(tvBox, rules);
    const tv = new GBC.TreeView(tvBox, { featureNames: XN, valueLabel: 'доля класса 1', valueFormat: (v) => U.fmt(v, 2), nodeW: 104 });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'листьев (правил)' }, { key: 'acc', label: 'точность на обучении' }, { key: 'cov', label: 'объект попадает ровно в один лист' }]);
    function draw() {
      const { X, y } = TR_DATA;
      const tree = new GBC.RegressionTree({ maxDepth: s.d, minSamplesLeaf: 5 }).fit(X, y.map((v) => -v), y.map(() => 1));
      const R = leafRules(tree);
      if (s.leaf >= R.length) s.leaf = R.length - 1;
      sl.el.querySelector('input').max = R.length;
      const L = [];
      R.forEach((r, i) => {
        const cls = r.value >= 0.5 ? 1 : 0;
        const sel = i === s.leaf;
        L.push({ type: 'rect', x0: Math.max(0, r.lo[0]), x1: Math.min(10, r.hi[0]), y0: Math.max(0, r.lo[1]), y1: Math.min(10, r.hi[1]), fill: cls ? 'class1' : 'class0', stroke: sel ? 'ink' : 'ink2', width: sel ? 3 : 1, opacity: sel ? 0.42 : 0.16 });
      });
      const c0 = U.range(X.length).filter((i) => !y[i]);
      const c1 = U.range(X.length).filter((i) => y[i]);
      L.push({ type: 'points', x: c0.map((i) => X[i][0]), y: c0.map((i) => X[i][1]), color: 'class0', r: 3.5, label: 'класс 0' });
      L.push({ type: 'points', x: c1.map((i) => X[i][0]), y: c1.map((i) => X[i][1]), color: 'class1', r: 3.5, label: 'класс 1' });
      plot.render(L);
      const lf = R[s.leaf];
      tv.render(tree, { highlight: tree.decisionPath([(Math.max(0, lf.lo[0]) + Math.min(10, lf.hi[0])) / 2, (Math.max(0, lf.lo[1]) + Math.min(10, lf.hi[1])) / 2]) });
      const ones = R.filter((r) => r.value >= 0.5);
      rules.textContent = R.map((r, i) => (i === s.leaf ? '▶ ' : '  ') + 'ЕСЛИ ' + condText(r, s.simple) + '  ТО класс ' + (r.value >= 0.5 ? 1 : 0) + '   (n = ' + r.n + ', доля 1: ' + U.fmt(r.value, 2) + ')').join('\n') + '\n\nкласс 1 ⇔ ' + (ones.length ? ones.map((r) => '(' + condText(r, s.simple) + ')').join('\n          ∨ ') : 'никогда');
      const pred = X.map((x) => (tree.predictOne(x) >= 0.5 ? 1 : 0));
      const counts = X.map((x) => R.filter((r) => [0, 1].every((f) => x[f] > r.lo[f] && x[f] <= r.hi[f])).length);
      st.set('L', String(R.length));
      st.set('acc', f3(U.mean(pred.map((p, i) => (p === y[i] ? 1 : 0)))));
      st.set('cov', counts.every((c) => c === 1) ? 'да, все ' + X.length : 'нет!');
      note.innerHTML = 'Правила листьев <b>взаимно исключают</b> друг друга и вместе <b>покрывают</b> всё пространство: каждый объект удовлетворяет ровно одному правилу (проверено на всех 200 точках). Поэтому дерево — это ровно ДНФ: класс 1 — «или» по листьям с ответом 1, каждый лист — «и» условий пути. Упрощение склеивает условия на один признак в интервал: «x₁ > 3.01 ∧ x₁ > 5.69» — это просто «x₁ > 5.69» (поглощение). С ростом глубины правил больше и они уже, но часть из них подгоняется под 5 % шумных меток — глубина 3 уже ловит оба угла. В бустинге ответ складывается из многих деревьев, и ансамбль — это уже не одна ДНФ, а сумма «весов правил» (урок 4.1).';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse.rng import Mulberry32\nfrom gbcourse.tree import RegressionTree\n\nrng = Mulberry32(23)\nX, y = [], []\nfor _ in range(200):\n    x1, x2 = rng.uniform(0, 10), rng.uniform(0, 10)\n    c = int((x1 > 6 and x2 < 4) or (x1 < 3 and x2 > 6))\n    if rng.random() < 0.05:\n        c = 1 - c\n    X.append([x1, x2])\n    y.append(c)\nX, y = np.array(X), np.array(y, float)\n\ntree = RegressionTree(max_depth=' + s.d + ', min_samples_leaf=5).fit(X, -y, np.ones_like(y))   # лист = доля класса 1\n\ndef rules(t, i=0, path=()):\n    nd = t.nodes[i]\n    if nd.left < 0:\n        yield path, nd.value, nd.n\n        return\n    f, thr = nd.feature, nd.threshold\n    yield from rules(t, nd.left, path + (f"x{f + 1} <= {thr:.2f}",))\n    yield from rules(t, nd.right, path + (f"x{f + 1} > {thr:.2f}",))\n\nfor path, v, n in rules(tree):\n    print("ЕСЛИ", " и ".join(path), "ТО класс", int(v >= 0.5), f"(n = {n}, доля 1 = {v:.2f})")\nprint("точность:", ((tree.predict(X) >= 0.5) == y).mean())\n');
    draw();
  });

  /* ==============================================================================
   * 35. Чётность: жадному дереву не за что зацепиться
   * ============================================================================== */
  GBC.widget('parity-greedy', (el) => {
    const s = { p: 6, k: 2, d: 3, n: 400, seed: 5 };
    const w = ui.shell(el, { title: 'Чётность k признаков: что видит жадное дерево', sub: 'p двоичных признаков, ответ — XOR первых k из них (чётность числа единиц). Каждый признак по отдельности не несёт информации об ответе, поэтому выигрыши всех разбиений в корне около нуля.' });
    ui.slider(w.controls, { label: 'Признаков p', min: 3, max: 10, step: 1, value: s.p, format: String, onInput: (v) => ((s.p = v), (s.k = Math.min(s.k, v)), draw()) });
    ui.slider(w.controls, { label: 'Значимых k (XOR первых k)', min: 1, max: 4, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = Math.min(v, s.p)), draw()) });
    ui.slider(w.controls, { label: 'Глубина дерева', min: 1, max: 8, step: 1, value: s.d, format: String, onInput: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'Объектов для обучения', values: [100, 200, 400, 800, 1600], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    ui.button(w.controls, { label: 'Новые данные', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const gplot = new GBC.Plot(w.main, { height: 200, x: { label: 'признак', domain: [0.4, 10.6], ticks: U.range(10, 1) }, y: { label: 'выигрыш в корне' } });
    const aplot = new GBC.Plot(w.main, { height: 220, x: { label: 'глубина дерева', domain: [0.6, 8.4], ticks: U.range(8, 1) }, y: { label: 'точность', domain: [0.4, 1.02], ticks: [0.5, 0.6, 0.7, 0.8, 0.9, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'root', label: 'корень дерева' }, { key: 'tr', label: 'точность: обучение' }, { key: 'te', label: 'точность: тест' }]);
    function data() {
      const rng = new GBC.RNG(s.seed);
      const mk = (m) => U.range(m).map(() => U.range(s.p).map(() => (rng.random() < 0.5 ? 1 : 0)));
      const Xtr = mk(s.n);
      const Xte = mk(1000);
      const lab = (x) => x.slice(0, s.k).reduce((a, b) => a ^ b, 0);
      return { Xtr, ytr: Xtr.map(lab), Xte, yte: Xte.map(lab) };
    }
    const fit = (X, y, d) => new GBC.RegressionTree({ maxDepth: d }).fit(X, y.map((v) => -v), y.map(() => 1));
    const acc = (t, X, y) => U.mean(X.map((x, i) => ((t.predictOne(x) >= 0.5 ? 1 : 0) === y[i] ? 1 : 0)));
    function draw() {
      const { Xtr, ytr, Xte, yte } = data();
      const ybar = U.mean(ytr);
      const v0 = ybar * (1 - ybar);
      const gains = U.range(s.p).map((j) => {
        const L = ytr.filter((v, i) => !Xtr[i][j]);
        const R = ytr.filter((v, i) => Xtr[i][j]);
        const vv = (a) => (a.length ? U.mean(a) * (1 - U.mean(a)) : 0);
        return v0 - (L.length / ytr.length) * vv(L) - (R.length / ytr.length) * vv(R);
      });
      gplot.render([{ type: 'bars', x: U.range(s.p, 1), y: gains, color: (i) => (i < s.k ? 'tree' : 'data'), width: 0.6, maxPx: 40, tooltip: (i) => [['признак', 'x' + sub(i + 1)], ['значимый', i < s.k ? 'да' : 'нет'], ['выигрыш', U.fmt(gains[i], 4)]] }], { y: [0, Math.max(0.01, ...gains) * 1.15] });
      const depths = U.range(8, 1);
      const trees = depths.map((d) => fit(Xtr, ytr, d));
      const atr = trees.map((t) => acc(t, Xtr, ytr));
      const ate = trees.map((t) => acc(t, Xte, yte));
      aplot.render([
        { type: 'line', x: depths, y: atr, color: 'train', width: 2, label: 'обучение' },
        { type: 'line', x: depths, y: ate, color: 'test', width: 2, label: 'тест (1000 объектов)' },
        { type: 'points', x: [s.d, s.d], y: [atr[s.d - 1], ate[s.d - 1]], color: 'ink', r: 5 },
        { type: 'hline', y: 0.5, color: 'truth', dash: '4 4', width: 1 },
      ]);
      const root = trees[s.d - 1].nodes[0];
      st.set('root', root.left >= 0 ? 'x' + sub(root.feature + 1) + (root.feature < s.k ? ' (значимый)' : ' (шум)') : 'не делится');
      st.set('tr', f3(atr[s.d - 1]));
      st.set('te', f3(ate[s.d - 1]));
      note.innerHTML = 'Оранжевые столбики — значимые признаки, серые — шумовые. При k = 1 ответ равен x₁, и его выигрыш огромен. Уже при k = 2 (XOR) выигрыши значимых признаков такие же крошечные, как у шумовых: корень выбирается по случайной флуктуации выборки, часто по шуму. Чтобы выучить чётность k признаков, дереву нужна глубина не меньше k и удачные разбиения на каждом уровне; на тесте точность держится около 0.5, пока дерево не «наткнётся» на все k значимых признаков. Жадный алгоритм смотрит на один шаг вперёд — логическое взаимодействие нескольких признаков для него невидимо, пока не сделан первый «слепой» шаг. На реальных данных чистая чётность редка, но частичные взаимодействия встречаются постоянно — поэтому в бустинге берут деревья глубины 4–8 (уроки 2.4 и 8.3).';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse.rng import Mulberry32\nfrom gbcourse.tree import RegressionTree\n\np, k, n = ' + s.p + ', ' + s.k + ', ' + s.n + '\nrng = Mulberry32(' + s.seed + ')\nmk = lambda m: np.array([[int(rng.random() < 0.5) for _ in range(p)] for _ in range(m)], float)\nXtr, Xte = mk(n), mk(1000)\nlab = lambda X: (X[:, :k].sum(axis=1) % 2).astype(float)   # чётность = XOR первых k\nytr, yte = lab(Xtr), lab(Xte)\nfor d in range(1, 9):\n    t = RegressionTree(max_depth=d).fit(Xtr, -ytr, np.ones(n))\n    acc = lambda X, y: ((t.predict(X) >= 0.5) == y).mean()\n    print(f"глубина {d}: корень x{t.nodes[0].feature + 1}, обучение {acc(Xtr, ytr):.3f}, тест {acc(Xte, yte):.3f}")\n');
    draw();
  });

  /* ==============================================================================
   * 36. Минимальное и жадное дерево для булевой функции
   * ============================================================================== */
  const MT_PRESETS = {
    and3: { n: 3, t: 'A ∧ B ∧ C', f: 'A ∧ B ∧ C' },
    or4: { n: 4, t: 'A ∨ B ∨ C ∨ D', f: 'A ∨ B ∨ C ∨ D' },
    maj3: { n: 3, t: 'большинство из трёх', f: '(A ∧ B) ∨ (A ∧ C) ∨ (B ∧ C)' },
    mux: { n: 3, t: 'селектор: A ? B : C', f: '(A ∧ B) ∨ (¬A ∧ C)' },
    par3: { n: 3, t: 'чётность A ⊕ B ⊕ C', f: 'A ⊕ B ⊕ C' },
    par4: { n: 4, t: 'чётность четырёх', f: 'A ⊕ B ⊕ C ⊕ D' },
    two: { n: 4, t: '(A ∧ B) ∨ (C ∧ D)', f: '(A ∧ B) ∨ (C ∧ D)' },
    tricky: { n: 4, t: '«ловушка» для жадного (пример из перебора)', o: [0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0] },
  };
  GBC.widget('min-tree', (el) => {
    const s = { key: 'mux', n: 3, o: outs(P(MT_PRESETS.mux.f), VN.slice(0, 3)) };
    const w = ui.shell(el, { title: 'Сколько листьев нужно дереву? Минимальное против жадного', sub: 'Для булевой функции от n ≤ 4 переменных перебором подкубов находим дерево с наименьшим числом листьев и сравниваем с жадным деревом (критерий Джини, как в sklearn). Щёлкайте по столбцу f, чтобы задать свою функцию.' });
    ui.select(w.controls, { label: 'Функция', value: s.key, options: Object.entries(MT_PRESETS).map(([k, v]) => ({ value: k, label: v.t + ' (n = ' + v.n + ')' })), onChange: (v) => {
      const pr = MT_PRESETS[v];
      s.key = v;
      s.n = pr.n;
      s.o = pr.o ? pr.o.slice() : outs(P(pr.f), VN.slice(0, pr.n));
      draw();
    } });
    const tbl = H('div');
    w.controls.appendChild(tbl);
    const grid = H('div', { style: 'display:grid;gap:10px' });
    w.main.appendChild(grid);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'min', label: 'минимальное дерево' }, { key: 'gr', label: 'жадное дерево' }, { key: 'dnf', label: 'минимальная ДНФ' }]);
    function draw() {
      const vars = VN.slice(0, s.n);
      const E = envs(vars);
      tbl.textContent = '';
      const wrap = boolTable(tbl, [...vars, 'f'], E.map((e, i) => [...vars.map((v) => e[v]), s.o[i]]), { good: (i) => s.o[i] === 1, outCols: new Set([s.n]), sepAfter: s.n - 1 });
      wrap.querySelectorAll('tbody tr').forEach((tr, i) => {
        const td = tr.children[s.n];
        td.style.cursor = 'pointer';
        td.addEventListener('click', () => ((s.o[i] = 1 - s.o[i]), (s.key = 'custom'), draw()));
      });
      const mt = minTree(s.n, s.o);
      const gt = greedyTree(s.n, s.o);
      const ones = s.o.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      const dn = minDNF(s.n, ones);
      grid.textContent = '';
      [['Минимальное дерево: ' + nWordLeaves(mt.leaves) + ', глубина ' + mt.depth, mt], ['Жадное дерево (Джини): ' + nWordLeaves(gt.leaves) + ', глубина ' + gt.depth, gt]].forEach(([t, tr], k) => {
        const cd = card(t);
        if (k === 1 && gt.leaves > mt.leaves) cd.titleEl.style.color = 'var(--critical-text)';
        drawTree(cd.body, boolTreeDraw(tr, vars), { dx: 40, dy: 50, r: 15, minW: 260, squareLeaves: true, showVals: false });
        grid.appendChild(cd.el);
      });
      st.set('min', mt.leaves + ' лист., глубина ' + mt.depth);
      st.set('gr', gt.leaves + ' лист., глубина ' + gt.depth + (gt.leaves > mt.leaves ? ' ✘' : ''));
      st.set('dnf', dn.constant === 1 ? '1' : !ones.length ? '0' : dn.cover.length + ' слаг.: ' + dnfText(dn.cover, vars));
      note.innerHTML = 'Сравните: AND и OR от n переменных требуют всего n + 1 листьев, а чётность — 2ⁿ листьев, ни одного меньше: в каждом листе все переменные должны быть зафиксированы, иначе ответ не определён. Селектор «A ? B : C» показывает слабость жадности: переменная-«переключатель» A сама по себе не связана с ответом (выигрыш 0), и жадное дерево сначала делит по B или C — получается 6 листьев вместо 4. Перебор всех функций показывает масштаб: жадное дерево больше минимального у 42 из 256 функций трёх переменных (16 %) и у 37 650 из 65 536 функций четырёх (57 %, при выборе первой переменной из равных). Поиск минимального дерева в общем случае NP-труден — поэтому все библиотеки строят деревья жадно, а глубину и ансамбль используют как страховку.';
    }
    const nWordLeaves = (k) => k + ' ' + plural(k, 'лист', 'листа', 'листьев');
    w.pythonAction(() => 'from functools import lru_cache\nfrom itertools import product\n\nn = ' + s.n + '\nf = ' + JSON.stringify(s.o) + '            # столбец таблицы, строки 00…0, 00…1, …\nrows = list(product([0, 1], repeat=n))\n\n@lru_cache(None)\ndef min_leaves(cube):                 # cube: -1 — переменная свободна, 0/1 — зафиксирована\n    vals = {f[i] for i, r in enumerate(rows) if all(c < 0 or c == x for c, x in zip(cube, r))}\n    if len(vals) == 1:\n        return 1\n    return min(min_leaves(cube[:j] + (0,) + cube[j + 1:]) + min_leaves(cube[:j] + (1,) + cube[j + 1:])\n               for j in range(n) if cube[j] < 0)\n\nprint("минимум листьев:", min_leaves((-1,) * n))\n');
    draw();
  });

  /* ==============================================================================
   * 37. Бустинг из пней и XOR: взаимодействие и симметрия
   * ============================================================================== */
  const SX_F = { and: ['A ∧ B', (a, b) => a & b], or: ['A ∨ B', (a, b) => a | b], xor: ['A ⊕ B', (a, b) => a ^ b] };
  GBC.widget('stumps-xor', (el) => {
    const s = { f: 'xor', d: 1, extra: 0 };
    const w = ui.shell(el, { title: 'Бустинг из пней не выражает XOR — и при чём тут симметрия', sub: 'Два двоичных признака, по 25 объектов в каждой из четырёх клеток (A, B). Градиентный бустинг (log-loss, 100 деревьев, темп 0.3). F — сырой прогноз (логит) в каждой клетке.' });
    ui.segmented(w.controls, { label: 'Целевая функция', value: s.f, options: Object.entries(SX_F).map(([k, v]) => ({ value: k, label: v[0] })), onChange: (v) => ((s.f = v), draw()) });
    ui.segmented(w.controls, { label: 'Глубина деревьев', value: s.d, options: [{ value: 1, label: '1 (пни)' }, { value: 2, label: '2' }], onChange: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'Лишних объектов в клетке (1, 1)', min: 0, max: 5, step: 1, value: 0, format: String, onInput: (v) => ((s.extra = v), draw()) });
    const holder = H('div');
    const line = monoBox('text-align:center');
    const plot = new GBC.Plot(w.main, { height: 190, x: { label: 'деревьев', domain: [0, 100] }, y: { label: 'log-loss' } });
    w.main.insertBefore(line, w.main.firstChild);
    w.main.insertBefore(holder, w.main.firstChild);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'acc', label: 'точность' }, { key: 'c', label: 'F₀₀ + F₁₁ − F₀₁ − F₁₀' }, { key: 'sp', label: 'деревьев с разбиением' }]);
    function draw() {
      const [name, fn] = SX_F[s.f];
      const X = [];
      const y = [];
      [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(([a, b]) => {
        const m = 25 + (a && b ? s.extra : 0);
        for (let i = 0; i < m; i++) (X.push([a, b]), y.push(fn(a, b)));
      });
      const model = new GBC.GradientBoosting({ loss: 'logistic', nEstimators: 100, learningRate: 0.3, maxDepth: s.d }).fit(X, y);
      const cells = [[0, 0], [0, 1], [1, 0], [1, 1]];
      const F = model.predictRaw(cells);
      const p = F.map(U.sigmoid);
      const acc = U.mean(X.map((x, i) => ((model.predictRawOne(x) > 0 ? 1 : 0) === y[i] ? 1 : 0)));
      const splits = model.trees.filter((stg) => stg[0].nodes.length > 1).length;
      const contrast = F[0] + F[3] - F[1] - F[2];
      holder.textContent = '';
      const svg = svgBox(holder, 360, 200, 300, 420);
      svg.appendChild(sText(70, 14, 'B = 0', { size: 12, color: 'var(--ink-2)' }));
      svg.appendChild(sText(200, 14, 'B = 1', { size: 12, color: 'var(--ink-2)' }));
      cells.forEach(([a, b], i) => {
        const x = 10 + b * 130;
        const yy = 24 + a * 86;
        const target = fn(a, b);
        const right = (F[i] > 0 ? 1 : 0) === target;
        svg.appendChild(S('rect', { x, y: yy, width: 120, height: 78, rx: 10, fill: tint(p[i] >= 0.5 ? 'var(--c-orange)' : C_TRUE, 10 + Math.round(70 * Math.abs(p[i] - 0.5))), stroke: right ? 'var(--border-strong)' : 'var(--critical)', 'stroke-width': right ? 1.2 : 3 }));
        svg.appendChild(sText(x + 60, yy + 18, 'цель ' + target + (right ? '' : '  ✘'), { size: 12, color: 'var(--ink-2)' }));
        svg.appendChild(sText(x + 60, yy + 40, 'F = ' + U.fmtSigned(F[i], 2), { size: 15, bold: true, mono: true }));
        svg.appendChild(sText(x + 60, yy + 60, 'p = ' + U.fmt(p[i], 3), { size: 12, mono: true, color: 'var(--ink-2)' }));
      });
      svg.appendChild(sText(290, 63, 'A = 0', { size: 12, color: 'var(--ink-2)', anchor: 'start' }));
      svg.appendChild(sText(290, 149, 'A = 1', { size: 12, color: 'var(--ink-2)', anchor: 'start' }));
      line.textContent = name + ':  F₀₀ + F₁₁ − F₀₁ − F₁₀ = ' + U.fmtSigned(contrast, 3) + (s.d === 1 ? '   (у суммы пней всегда 0)' : '');
      const hist = model.history.train;
      plot.render([{ type: 'line', x: U.range(hist.length), y: hist, color: 'train', width: 2, label: 'log-loss на обучении' }], { y: [0, Math.max(0.75, ...hist) * 1.05] });
      st.set('acc', f3(acc));
      st.set('c', U.fmtSigned(contrast, 3));
      st.set('sp', splits + ' из 100');
      note.innerHTML = '<b>Теорема.</b> Ансамбль пней не может точно выразить XOR. <b>Доказательство от противного.</b> Каждый пень зависит от одного признака, поэтому сумма пней — это F(A, B) = g(A) + h(B). Для любой такой функции F₀₀ + F₁₁ = g(0) + h(0) + g(1) + h(1) = F₀₁ + F₁₀ (смотрите строку над графиком: на пнях она всегда 0). Для XOR нужно F₀₁ &gt; 0, F₁₀ &gt; 0 и F₀₀ &lt; 0, F₁₁ &lt; 0 — тогда левая часть отрицательна, а правая положительна. Противоречие. AND и OR пни выражают: достаточно «порога» на сумме. Сюрприз глубины 2: на <b>идеально сбалансированном</b> XOR корневое разбиение по A или B имеет выигрыш ровно 0, и бустинг курса не делает ни одного разбиения — так же ведут себя XGBoost и LightGBM (а sklearn делит и при нулевом выигрыше). Добавьте один объект в клетку (1, 1): симметрия ломается, выигрыш становится положительным, и деревья глубины 2 выучивают XOR за несколько шагов.';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse.boosting import GBClassifier\n\nf = lambda a, b: ' + { and: 'a & b', or: 'a | b', xor: 'a ^ b' }[s.f] + '\nextra = ' + s.extra + '\nX = np.array([[a, b] for a in (0, 1) for b in (0, 1) for _ in range(25 + (extra if a and b else 0))], float)\ny = np.array([f(int(a), int(b)) for a, b in X])\nm = GBClassifier(n_estimators=100, learning_rate=0.3, max_depth=' + s.d + ').fit(X, y)\nF = m.predict_raw(np.array([[0, 0], [0, 1], [1, 0], [1, 1]], float))\nprint("F по клеткам 00, 01, 10, 11:", np.round(F, 3))\nprint("F00 + F11 - F01 - F10 =", round(F[0] + F[3] - F[1] - F[2], 6))\nprint("точность:", (m.predict(X) == y).mean())\nprint("деревьев с разбиением:", sum(len(st[0].nodes) > 1 for st in m.trees_))\n# сравните: xgboost.XGBClassifier(max_depth=2, learning_rate=0.3) на extra = 0 тоже даёт 0.5\n');
    draw();
  });

  /* ==============================================================================
   * 38. Мягкая логика: вероятности, t-нормы, мягкий порог
   * ============================================================================== */
  GBC.widget('soft-logic', (el) => {
    const s = { mode: 'prob', p: 0.7, q: 0.6, tn: 'prod', tau: 0.5 };
    const w = ui.shell(el, { title: 'Мягкая логика: когда истинность — число от 0 до 1', sub: 'Три способа «смягчить» логику: вероятности высказываний, нечёткие связки (t-нормы) и мягкие сравнения, как в нейросетях и мягких деревьях.' });
    ui.segmented(w.controls, { label: 'Тема', value: s.mode, options: [{ value: 'prob', label: 'вероятности' }, { value: 'tnorm', label: 't-нормы' }, { value: 'soft', label: 'мягкий порог' }], onChange: (v) => ((s.mode = v), draw()) });
    const sp = ui.slider(w.controls, { label: 'P(A)', min: 0, max: 1, step: 0.05, value: s.p, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.p = v), draw()) });
    const sq = ui.slider(w.controls, { label: 'P(B)', min: 0, max: 1, step: 0.05, value: s.q, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.q = v), draw()) });
    const stn = ui.select(w.controls, { label: 't-норма («мягкое и»)', value: s.tn, options: [{ value: 'min', label: 'минимум: min(a, b)' }, { value: 'prod', label: 'произведение: a·b' }, { value: 'luk', label: 'Лукасевич: max(0, a + b − 1)' }], onChange: (v) => ((s.tn = v), draw()) });
    const stau = ui.slider(w.controls, { label: 'Мягкость τ', values: [2, 1, 0.5, 0.25, 0.1, 0.05, 0.01], value: s.tau, format: String, onInput: (v) => ((s.tau = v), draw()) });
    const boxP = H('div');
    const boxT = H('div');
    const boxS = H('div');
    w.main.append(boxP, boxT, boxS);
    const pp = new GBC.Plot(boxP, { height: 230, x: { label: 'вероятность', domain: [0, 1] }, y: { label: '', domain: [0.4, 4.6], ticks: [] } });
    const tp = new GBC.Plot(boxT, { height: 300, equal: true, x: { label: 'a — истинность A', domain: [0, 1] }, y: { label: 'b — истинность B', domain: [0, 1] } });
    const spl = new GBC.Plot(boxS, { height: 240, x: { label: 'x', domain: [0, 10] }, y: { label: 'истинность «x > 5»', domain: [-0.05, 1.05] } });
    const res = monoBox();
    w.main.appendChild(res);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '' }, { key: 'b', label: '' }]);
    const TN = { min: (a, b) => Math.min(a, b), prod: (a, b) => a * b, luk: (a, b) => Math.max(0, a + b - 1) };
    function draw() {
      sp.el.style.display = s.mode === 'prob' ? '' : 'none';
      sq.el.style.display = s.mode === 'prob' ? '' : 'none';
      stn.el.style.display = s.mode === 'tnorm' ? '' : 'none';
      stau.el.style.display = s.mode === 'soft' ? '' : 'none';
      boxP.style.display = s.mode === 'prob' ? '' : 'none';
      boxT.style.display = s.mode === 'tnorm' ? '' : 'none';
      boxS.style.display = s.mode === 'soft' ? '' : 'none';
      const labs = w.foot.querySelectorAll('.stat .k');
      if (s.mode === 'prob') {
        const { p, q } = s;
        const rows = [
          ['P(A ∧ B)', Math.max(0, p + q - 1), Math.min(p, q), p * q],
          ['P(A ∨ B)', Math.max(p, q), Math.min(1, p + q), p + q - p * q],
          ['P(A → B) = P(¬A ∨ B)', Math.max(1 - p, q), Math.min(1, 1 - p + q), 1 - p + p * q],
          ['P(B | A)', p > 0 ? Math.max(0, p + q - 1) / p : NaN, p > 0 ? Math.min(p, q) / p : NaN, q],
        ];
        const L = [];
        rows.forEach(([t, lo, hi, ind], i) => {
          const yy = 4 - i;
          L.push({ type: 'segments', x1: [lo], y1: [yy], x2: [hi], y2: [yy], color: i === 3 ? 'tree' : 'model', width: 10, opacity: 0.55 });
          L.push({ type: 'points', x: [ind], y: [yy], color: 'ink', r: 5 });
          L.push({ type: 'text', items: [{ x: 0.01, y: yy + 0.36, anchor: 'start', text: t, bold: true }] });
        });
        pp.render(L);
        res.textContent = rows.map(([t, lo, hi, ind]) => t.padEnd(24, ' ') + ' ∈ [' + U.fmt(lo, 3) + '; ' + U.fmt(hi, 3) + ']   при независимости ' + U.fmt(ind, 3)).join('\n');
        labs[0].textContent = 'P(A ∧ B) ∈';
        labs[1].textContent = 'P(A → B) против P(B | A)';
        st.set('a', '[' + U.fmt(rows[0][1], 2) + '; ' + U.fmt(rows[0][2], 2) + ']');
        st.set('b', U.fmt(rows[2][3], 3) + ' против ' + U.fmt(q, 3));
        note.innerHTML = 'Зная только P(A) и P(B), вероятность «A и B» нельзя вычислить — лишь указать границы Фреше: max(0, P(A) + P(B) − 1) ≤ P(A ∧ B) ≤ min(P(A), P(B)). Точка — значение при независимости. Логика «переходит» в вероятность только для крайних значений: если P(A) = P(B) = 1, интервал сжимается в 1. Важная ловушка: вероятность импликации P(¬A ∨ B) — это <b>не</b> условная вероятность P(B | A). При P(A) = 0.7, P(B) = 0.6 и независимости: P(A → B) = 0.72, а P(B | A) = 0.6. Правило «если A, то B» на данных измеряют условной вероятностью (достоверностью, шаг 22), а не вероятностью импликации, которую «раздувают» строки с ложным A.';
      } else if (s.mode === 'tnorm') {
        const T = TN[s.tn];
        const grid = GBC.Plot.grid((a, b) => T(a, b), 0, 1, 0, 1, 81, 81);
        tp.render([
          { type: 'heatmap', grid, colorFn: GBC.colors.sequential(), opacity: 0.75 },
          ...[0.1, 0.3, 0.5, 0.7, 0.9].map((lv) => ({ type: 'contour', grid, level: lv, color: 'ink', width: 1 })),
          { type: 'points', x: [0, 0, 1, 1], y: [0, 1, 0, 1], color: 'tree', r: 6, label: 'булевы углы' },
        ]);
        res.textContent = 'T(0, 0) = ' + T(0, 0) + ',  T(0, 1) = ' + T(0, 1) + ',  T(1, 0) = ' + T(1, 0) + ',  T(1, 1) = ' + T(1, 1) + '   — в углах это обычное «и»\nT(0.5, 0.5) = ' + U.fmt(T(0.5, 0.5), 3) + ',  T(0.8, 0.9) = ' + U.fmt(T(0.8, 0.9), 3) + ';   «мягкое или»: S(a, b) = 1 − T(1 − a, 1 − b) (де Морган)';
        labs[0].textContent = 'T(0.5, 0.5)';
        labs[1].textContent = 'T(0.8, 0.9)';
        st.set('a', U.fmt(T(0.5, 0.5), 3));
        st.set('b', U.fmt(T(0.8, 0.9), 3));
        note.innerHTML = '<b>t-норма</b> — «мягкое и» на отрезке [0, 1]: коммутативна, ассоциативна, монотонна и в углах квадрата совпадает с ∧. Минимум — самая «оптимистичная» (наибольшая) t-норма, Лукасевич — граница Фреше снизу, произведение — независимость. «Мягкое или» получается по закону де Моргана. Такие связки используют нечёткая логика и нейросети, обучаемые с логическими ограничениями: в отличие от 0/1, они дифференцируемы, и по ним можно идти градиентным спуском.';
      } else {
        const xs = U.linspace(0, 10, 401);
        const sig = (x) => U.sigmoid((x - 5) / s.tau);
        spl.render([
          { type: 'line', x: [0, 5, 5, 10], y: [0, 0, 1, 1], color: 'truth', width: 1.6, dash: '5 4', label: 'жёсткое сравнение [x > 5]' },
          { type: 'line', x: xs, y: xs.map(sig), color: 'model', width: 2.4, label: 'σ((x − 5)/τ)' },
        ]);
        res.textContent = 'при x = 4: ' + U.fmt(sig(4), 4) + ',  x = 5: ' + U.fmt(sig(5), 4) + ',  x = 6: ' + U.fmt(sig(6), 4) + '      наклон в x = 5: 1/(4τ) = ' + U.fmt(1 / (4 * s.tau), 3);
        labs[0].textContent = 'истинность при x = 6';
        labs[1].textContent = 'наклон в пороге';
        st.set('a', U.fmt(sig(6), 4));
        st.set('b', U.fmt(1 / (4 * s.tau), 3));
        note.innerHTML = 'Условие дерева «x &gt; 5» — ступенька: производная 0 везде, кроме порога, поэтому порог нельзя подбирать градиентом. Сигмоида σ((x − t)/τ) — мягкая версия: при τ → 0 она превращается в ступеньку, при большом τ — почти линейна. Мягкие деревья решений (soft decision trees) и многие нейросетевые «логические» слои заменяют сравнения сигмоидами, а «и» вдоль пути — произведением истинностей (t-норма). Знакомая связь из курса: бустинг-классификатор выдаёт логит F, и вероятность класса σ(F) — это мягкое «F &gt; 0» (урок 6.1).';
      }
    }
    w.pythonAction(() => 'import numpy as np\n\np, q = ' + s.p + ', ' + s.q + '\nprint("P(A ∧ B) ∈", [max(0, p + q - 1), min(p, q)], " независимость:", p * q)\nprint("P(A → B) при независимости:", 1 - p + p * q, " P(B | A):", q)\n\nt_norms = {"min": np.minimum, "prod": np.multiply, "luk": lambda a, b: np.maximum(0, a + b - 1)}\nfor name, T in t_norms.items():\n    print(name, "T(0.5, 0.5) =", T(0.5, 0.5), " углы:", [T(a, b) for a in (0, 1) for b in (0, 1)])\n\nsigma = lambda z: 1 / (1 + np.exp(-z))\nfor tau in (1, 0.1, 0.01):\n    print("τ =", tau, np.round(sigma((np.array([4.0, 5.0, 6.0]) - 5) / tau), 4))\n');
    draw();
  });

  /* ==============================================================================
   * 39. SAT и алгоритм DPLL
   * ============================================================================== */
  function satInstances() {
    const out = [];
    out.push({ t: '★ Маленькая формула из 4 переменных', n: 4, names: ['A', 'B', 'C', 'D'], clauses: [[1, 2], [-1, 3], [-2, 3], [-3, 4], [-4, -1]], kind: 'small' });
    const color = (V, E, k, t, kind) => {
      const x = (v, c) => v * k + c + 1;
      const cl = [];
      for (let v = 0; v < V; v++) {
        cl.push(U.range(k).map((c) => x(v, c)));
        for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) cl.push([-x(v, a), -x(v, b)]);
      }
      E.forEach(([u, v]) => U.range(k).forEach((c) => cl.push([-x(u, c), -x(v, c)])));
      return { t, n: V * k, names: U.range(V * k).map((i) => 'v' + Math.floor(i / k) + '=' + 'СОЗ'[i % k]), clauses: cl, kind, V, E, k };
    };
    out.push(color(5, U.range(5).map((i) => [i, (i + 1) % 5]), 3, '★★ Раскраска цикла из 5 вершин в 3 цвета', 'color'));
    out.push(color(4, [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]], 3, '★★ Раскраска K₄ в 3 цвета (невозможна)', 'color'));
    const ph = { t: '★★★ 4 голубя, 3 гнезда (невозможно)', n: 12, names: U.range(12).map((i) => 'г' + (Math.floor(i / 3) + 1) + '→' + ((i % 3) + 1)), clauses: [], kind: 'pigeon' };
    const pv = (i, h) => i * 3 + h + 1;
    for (let i = 0; i < 4; i++) ph.clauses.push([pv(i, 0), pv(i, 1), pv(i, 2)]);
    for (let h = 0; h < 3; h++) for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) ph.clauses.push([-pv(i, h), -pv(j, h)]);
    out.push(ph);
    const sv = (r, c, d) => r * 16 + c * 4 + d + 1;
    const sd = { t: '★★★ Судоку 4 × 4', n: 64, names: U.range(64).map((i) => 'r' + Math.floor(i / 16) + 'c' + (Math.floor(i / 4) % 4) + '=' + ((i % 4) + 1)), clauses: [], kind: 'sudoku', given: [[1, 0, 0, 4], [0, 4, 1, 0], [2, 0, 0, 3], [0, 3, 2, 0]] };
    const groups = [];
    for (let r = 0; r < 4; r++) groups.push(U.range(4).map((c) => [r, c]));
    for (let c = 0; c < 4; c++) groups.push(U.range(4).map((r) => [r, c]));
    for (let br = 0; br < 2; br++) for (let bc = 0; bc < 2; bc++) groups.push([[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => [2 * br + a, 2 * bc + b]));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      sd.clauses.push(U.range(4).map((d) => sv(r, c, d)));
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) sd.clauses.push([-sv(r, c, a), -sv(r, c, b)]);
    }
    groups.forEach((g) => U.range(4).forEach((d) => {
      sd.clauses.push(g.map(([r, c]) => sv(r, c, d)));
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) sd.clauses.push([-sv(g[a][0], g[a][1], d), -sv(g[b][0], g[b][1], d)]);
    }));
    sd.given.forEach((row, r) => row.forEach((d, c) => d && sd.clauses.push([sv(r, c, d - 1)])));
    out.push(sd);
    return out;
  }
  const SAT = satInstances();
  /** DPLL с распространением единичных дизъюнктов и хронологическим откатом; возвращает журнал событий. */
  function dpll(inst) {
    const n = inst.n;
    const val = new Array(n + 1).fill(0);
    const trail = [];
    const log = [];
    const litVal = (l) => (val[Math.abs(l)] === 0 ? 0 : (l > 0) === (val[Math.abs(l)] > 0) ? 1 : -1);
    const set = (l, why, flipped = false) => {
      val[Math.abs(l)] = l > 0 ? 1 : -1;
      trail.push({ l, why, flipped });
    };
    function propagate() {
      for (;;) {
        let changed = false;
        for (const c of inst.clauses) {
          let sat = false;
          let un = 0;
          let last = 0;
          for (const l of c) {
            const v = litVal(l);
            if (v === 1) {
              sat = true;
              break;
            }
            if (v === 0) (un++, (last = l));
          }
          if (sat) continue;
          if (un === 0) return c;
          if (un === 1) {
            set(last, 'unit');
            log.push({ type: 'unit', l: last, snap: val.slice() });
            changed = true;
          }
        }
        if (!changed) return null;
      }
    }
    let conflict = propagate();
    let steps = 0;
    for (;;) {
      if (++steps > 20000) break;
      if (conflict) {
        log.push({ type: 'conflict', clause: conflict, snap: val.slice() });
        let d = null;
        while (trail.length) {
          const t = trail.pop();
          val[Math.abs(t.l)] = 0;
          if (t.why === 'decide' && !t.flipped) {
            d = t;
            break;
          }
        }
        if (!d) {
          log.push({ type: 'unsat', snap: val.slice() });
          return { log, sat: false };
        }
        set(-d.l, 'decide', true);
        log.push({ type: 'flip', l: -d.l, snap: val.slice() });
        conflict = propagate();
        continue;
      }
      const v = val.findIndex((x, i) => i > 0 && x === 0);
      if (v < 0) {
        log.push({ type: 'sat', snap: val.slice() });
        return { log, sat: true };
      }
      set(v, 'decide');
      log.push({ type: 'decide', l: v, snap: val.slice() });
      conflict = propagate();
    }
    return { log, sat: null };
  }
  GBC.widget('sat-dpll', (el) => {
    const s = { i: 1, k: 0 };
    let run = dpll(SAT[s.i]);
    const w = ui.shell(el, { title: 'SAT: выполнима ли формула? Алгоритм DPLL', sub: 'Формула в КНФ — «и» дизъюнктов. DPLL выбирает переменную (решение), выводит вынужденные значения из единичных дизъюнктов и откатывается при противоречии. Это умный перебор миров из шага 12.' });
    ui.select(w.controls, { label: 'Задача', value: s.i, options: SAT.map((x, i) => ({ value: i, label: x.t })), onChange: (v) => ((s.i = +v), (run = dpll(SAT[s.i])), pl.setMax(run.log.length), pl.set(run.log.length), (s.k = run.log.length), draw()) });
    const pl = ui.player(w.controls, { label: 'События', min: 0, max: run.log.length, value: run.log.length, fps: 3, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    s.k = run.log.length;
    const view = H('div');
    const logBox = monoBox('max-height:190px;overflow:auto;font-size:.8rem');
    w.main.append(view, logBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'переменных / дизъюнктов' }, { key: 'dec', label: 'решений + откатов' }, { key: 'unit', label: 'выведено единичными' }, { key: 'res', label: 'итог' }]);
    const litName = (inst, l) => (l < 0 ? '¬' : '') + inst.names[Math.abs(l) - 1];
    function draw() {
      const inst = SAT[s.i];
      const L = run.log.slice(0, s.k);
      const snap = L.length ? L[L.length - 1].snap : new Array(inst.n + 1).fill(0);
      view.textContent = '';
      if (inst.kind === 'small') {
        const row = flexRow('gap:8px;margin:4px 0');
        inst.names.forEach((nm, j) => row.appendChild(badge(nm + ' = ' + (snap[j + 1] === 0 ? '?' : snap[j + 1] > 0 ? '1' : '0'), snap[j + 1] > 0 ? 'good' : snap[j + 1] < 0 ? 'bad' : '')));
        view.appendChild(row);
        view.appendChild(monoBox()).textContent = 'Дизъюнкты: ' + inst.clauses.map((c) => '(' + c.map((l) => litName(inst, l)).join(' ∨ ') + ')').join(' ∧ ');
      } else if (inst.kind === 'color') {
        const svg = svgBox(view, 300, 200, 240, 360);
        const pos = U.range(inst.V).map((v) => [150 + 78 * Math.cos((2 * Math.PI * v) / inst.V - Math.PI / 2), 100 + 78 * Math.sin((2 * Math.PI * v) / inst.V - Math.PI / 2)]);
        inst.E.forEach(([a, b]) => svg.appendChild(S('line', { x1: pos[a][0], y1: pos[a][1], x2: pos[b][0], y2: pos[b][1], stroke: 'var(--border-strong)', 'stroke-width': 2 })));
        pos.forEach(([x, y], v) => {
          const c = U.range(inst.k).find((cc) => snap[v * inst.k + cc + 1] > 0);
          svg.appendChild(S('circle', { cx: x, cy: y, r: 18, fill: c === undefined ? 'var(--surface-2)' : tint(cvar([0, 1, 2][c]), 65), stroke: 'var(--ink-2)', 'stroke-width': 1.5 }));
          svg.appendChild(sText(x, y, c === undefined ? '?' : 'СОЗ'[c], { bold: true }));
        });
        view.appendChild(H('div', { style: 'font-size:.82rem;color:var(--ink-2);text-align:center' }, 'С — синий, О — оранжевый, З — бирюзовый (третий цвет); соседние вершины — разного цвета'));
      } else if (inst.kind === 'pigeon') {
        const rows = U.range(4).map((i) => ['голубь ' + (i + 1), ...U.range(3).map((h) => (snap[i * 3 + h + 1] > 0 ? '●' : snap[i * 3 + h + 1] < 0 ? '·' : '?'))]);
        rowTable(view, ['', 'гнездо 1', 'гнездо 2', 'гнездо 3'], rows, null, false);
      } else {
        const svg = svgBox(view, 4 * 46 + 10, 4 * 46 + 10, 200, 240);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
          const d = U.range(4).find((dd) => snap[r * 16 + c * 4 + dd + 1] > 0);
          const giv = inst.given[r][c];
          svg.appendChild(S('rect', { x: 5 + c * 46, y: 5 + r * 46, width: 46, height: 46, fill: giv ? 'var(--surface-2)' : 'var(--surface)', stroke: 'var(--border-strong)' }));
          if (d !== undefined) svg.appendChild(sText(5 + c * 46 + 23, 5 + r * 46 + 23, String(d + 1), { size: 18, bold: true, color: giv ? 'var(--ink)' : C_TRUE }));
        }
        svg.appendChild(S('path', { d: 'M5 97 H189 M97 5 V189', stroke: 'var(--ink)', 'stroke-width': 2.4 }));
      }
      const ev = (e) => (e.type === 'decide' ? 'решение: ' + litName(inst, e.l) : e.type === 'flip' ? 'откат и обратное решение: ' + litName(inst, e.l) : e.type === 'unit' ? '   вывод: ' + litName(inst, e.l) : e.type === 'conflict' ? '   ✘ противоречие в (' + e.clause.map((l) => litName(inst, l)).join(' ∨ ') + ')' : e.type === 'sat' ? '✔ все дизъюнкты выполнены' : '✘ вариантов не осталось: формула невыполнима');
      logBox.textContent = L.slice(-60).map((e, j) => String(L.length - Math.min(60, L.length) + j + 1).padStart(4, ' ') + '  ' + ev(e)).join('\n') || '(нажмите ▶)';
      logBox.scrollTop = logBox.scrollHeight;
      const all = run.log;
      const dec = all.filter((e) => e.type === 'decide' || e.type === 'flip').length;
      st.set('v', inst.n + ' / ' + inst.clauses.length);
      st.set('dec', dec + ' (перебор: 2' + String(inst.n).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join('') + ' наборов)');
      st.set('unit', String(all.filter((e) => e.type === 'unit').length));
      st.set('res', run.sat ? 'выполнима' : 'невыполнима');
      note.innerHTML = '<b>SAT</b> — задача «есть ли набор значений, при котором формула истинна». Это первая задача, для которой доказана NP-полнота (теорема Кука — Левина, 1971): к ней сводится любая задача с быстро проверяемым ответом — расписания, раскраски, судоку, проверка программ. Перебор 2ⁿ строк безнадёжен уже при n = 64 (судоку 4 × 4: 2⁶⁴ ≈ 1.8·10¹⁹), а DPLL решает её без единого решения — все 64 значения выводятся из единичных дизъюнктов. Современные решатели (CDCL) ещё и запоминают причины противоречий и справляются с миллионами переменных. В ML к SAT, SMT и целочисленному программированию сводят проверку свойств ансамблей деревьев: «существует ли вход, на котором прогноз выше порога» или «можно ли изменить один признак так, чтобы ответ сменился».';
    }
    w.pythonAction(() => {
      const inst = SAT[s.i];
      return '# ' + inst.t + ': КНФ в формате DIMACS (литерал ±номер переменной)\nclauses = ' + JSON.stringify(inst.clauses) + '\nn = ' + inst.n + '\n\ndef dpll(clauses, n):\n    val = [0] * (n + 1)\n    trail, stats = [], {"decide": 0, "unit": 0, "conflict": 0}\n    lit = lambda l: 0 if val[abs(l)] == 0 else (1 if (l > 0) == (val[abs(l)] > 0) else -1)\n    def assign(l, why, flipped=False):\n        val[abs(l)] = 1 if l > 0 else -1\n        trail.append((l, why, flipped))\n    def propagate():\n        while True:\n            changed = False\n            for c in clauses:\n                vs = [lit(l) for l in c]\n                if 1 in vs:\n                    continue\n                free = [l for l, v in zip(c, vs) if v == 0]\n                if not free:\n                    return c\n                if len(free) == 1:\n                    assign(free[0], "unit"); stats["unit"] += 1; changed = True\n            if not changed:\n                return None\n    conflict = propagate()\n    while True:\n        if conflict:\n            stats["conflict"] += 1\n            while trail:\n                l, why, flipped = trail.pop(); val[abs(l)] = 0\n                if why == "decide" and not flipped:\n                    break\n            else:\n                return None, stats\n            assign(-l, "decide", True); stats["decide"] += 1\n            conflict = propagate(); continue\n        free = [v for v in range(1, n + 1) if val[v] == 0]\n        if not free:\n            return val, stats\n        assign(free[0], "decide"); stats["decide"] += 1\n        conflict = propagate()\n\nmodel, stats = dpll(clauses, n)\nprint("выполнима" if model else "невыполнима", stats)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 40. Диагональный аргумент
   * ============================================================================== */
  GBC.widget('diagonal', (el) => {
    const s = { seed: 2, n: 6 };
    let M = [];
    const gen = () => {
      const rng = new GBC.RNG(s.seed);
      M = U.range(s.n).map(() => U.range(s.n).map(() => (rng.random() < 0.5 ? 1 : 0)));
    };
    gen();
    const w = ui.shell(el, { title: 'Диагональный аргумент: строка, которой нет в таблице', sub: 'Строки — «программы» (или бесконечные двоичные последовательности), столбцы — входы. Переворачиваем диагональ: новая строка отличается от строки i в позиции i, значит, не совпадает ни с одной строкой. Щёлкайте по клеткам.' });
    ui.slider(w.controls, { label: 'Размер таблицы', min: 3, max: 9, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), gen(), draw()) });
    ui.button(w.controls, { label: 'Другая таблица', icon: 'reset', onClick: () => (s.seed++, gen(), draw()) });
    const holder = H('div');
    w.main.appendChild(holder);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'диагональ' }, { key: 'nd', label: 'новая строка' }, { key: 'm', label: 'совпадает с какой-то строкой?' }]);
    function draw() {
      const n = s.n;
      const cs = 36;
      holder.textContent = '';
      const svg = svgBox(holder, 90 + n * cs + 70, 30 + (n + 1.6) * cs, 300, 560);
      const diag = U.range(n).map((i) => M[i][i]);
      const neu = diag.map((v) => 1 - v);
      U.range(n).forEach((j) => svg.appendChild(sText(90 + j * cs + cs / 2, 16, 'вход ' + (j + 1), { size: 10, color: 'var(--ink-2)' })));
      M.forEach((row, i) => {
        svg.appendChild(sText(84, 30 + i * cs + cs / 2, 'программа ' + (i + 1), { size: 11, anchor: 'end', color: 'var(--ink-2)' }));
        row.forEach((v, j) => {
          const g = S('g', { style: 'cursor:pointer' });
          g.appendChild(S('rect', { x: 90 + j * cs + 2, y: 30 + i * cs + 2, width: cs - 4, height: cs - 4, rx: 5, fill: i === j ? tint('var(--c-orange)', 40) : v ? tint(C_TRUE, 30) : 'var(--surface-2)', stroke: i === j ? 'var(--c-orange)' : 'var(--border)', 'stroke-width': i === j ? 2.4 : 1 }));
          g.appendChild(sText(90 + j * cs + cs / 2, 30 + i * cs + cs / 2, String(v), { bold: i === j, mono: true }));
          g.addEventListener('click', () => ((M[i][j] = 1 - M[i][j]), draw()));
          svg.appendChild(g);
        });
        svg.appendChild(sText(90 + n * cs + 10, 30 + i * cs + cs / 2, '≠ в ' + (i + 1), { size: 10, anchor: 'start', color: 'var(--critical-text)' }));
      });
      const yN = 30 + n * cs + 0.5 * cs;
      svg.appendChild(sText(84, yN + cs / 2, 'новая', { size: 11, anchor: 'end', bold: true }));
      neu.forEach((v, j) => {
        svg.appendChild(S('rect', { x: 90 + j * cs + 2, y: yN + 2, width: cs - 4, height: cs - 4, rx: 5, fill: tint('var(--c-aqua)', 45), stroke: 'var(--c-aqua)', 'stroke-width': 2 }));
        svg.appendChild(sText(90 + j * cs + cs / 2, yN + cs / 2, String(v), { bold: true, mono: true }));
      });
      const same = M.some((row) => row.every((v, j) => v === neu[j]));
      st.set('d', diag.join(''));
      st.set('nd', neu.join(''));
      st.set('m', same ? 'да?!' : 'нет — и никогда');
      note.innerHTML = 'Этот приём (Кантор, 1891) доказывает, что двоичных последовательностей больше, чем натуральных чисел: любой их пронумерованный список неполон. Тьюринг (1936) применил его к программам: пусть существует программа H, которая для любой программы p и входа x отвечает, остановится ли p на x. Тогда можно написать программу D, которая на входе p делает «наоборот» тому, что H предсказывает для p на p, — это перевёрнутая диагональ. D на входе D даёт противоречие: <b>проблема остановки неразрешима</b>. Гёдель (1931) с похожей самоссылкой построил утверждение «меня нельзя доказать»: в любой непротиворечивой системе аксиом, достаточной для арифметики, есть истинные, но недоказуемые утверждения. Логика честно описывает и пределы доказательств, и пределы алгоритмов — в том числе алгоритмов проверки моделей.';
    }
    w.pythonAction(() => 'M = ' + JSON.stringify(M) + '\nnew = [1 - M[i][i] for i in range(len(M))]\nprint("новая строка:", new)\nprint("совпадает с какой-то строкой:", any(row == new for row in M))\nprint("отличия по диагонали:", [M[i][i] != new[i] for i in range(len(M))])\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр: генератор задач
   * ============================================================================== */
  const BANK = [
    { q: 'Когда ложна импликация A → B?', opts: ['когда A ложно', 'когда A истинно, а B ложно', 'когда B истинно', 'никогда'], a: 1, why: 'Во всех остальных трёх строках таблицы A → B истинна.' },
    { q: 'Что равносильно A → B?', opts: ['B → A', '¬A → ¬B', '¬B → ¬A', 'A ∧ B'], a: 2, why: 'Контрапозиция; обращение B → A и противоположное ¬A → ¬B — другие утверждения.' },
    { q: 'Отрицание «каждый студент решил хотя бы одну задачу» —', opts: ['никто не решил ни одной', 'есть студент, не решивший ни одной', 'каждый не решил какую-то', 'есть нерешённая задача'], a: 1, why: '¬∀s ∃t R ≡ ∃s ∀t ¬R.' },
    { q: 'Отрицание «∀ε > 0 ∃N ∀n > N: |aₙ − a| < ε» начинается с…', opts: ['∀ε > 0 ∀N', '∃ε > 0 ∀N ∃n > N', '∃ε ≤ 0 ∀N', '∀ε > 0 ∃N ∃n'], a: 1, why: 'Каждый квантор меняется, ограничение ε > 0 остаётся.' },
    { q: 'Чему равно all([]) в Python?', opts: ['False', 'True', 'ошибка', 'None'], a: 1, why: 'Утверждение «все элементы пустого списка…» истинно по пустому.' },
    { q: 'Почему `df.age > 30 & df.income < 50` без скобок — ошибка?', opts: ['& медленный', '& связывает сильнее сравнений', 'нельзя сравнивать столбцы', 'нужно писать and'], a: 1, why: 'Сначала вычисляется 30 & df.income; скобки обязательны.' },
    { q: 'Сколько различных булевых функций от 3 переменных?', opts: ['8', '64', '256', '6561'], a: 2, why: '2^(2³) = 2⁸ = 256.' },
    { q: 'Какой набор связок НЕ полон?', opts: ['{¬, ∧}', '{↑}', '{∧, ∨}', '{→, 0}'], a: 2, why: 'И ∧, и ∨ монотонны — отрицание из них не собрать.' },
    { q: 'Почему ансамбль пней не выражает XOR?', opts: ['мало деревьев', 'сумма пней аддитивна: F₀₀ + F₁₁ = F₀₁ + F₁₀', 'XOR невычислим', 'нужен другой темп'], a: 1, why: 'Для XOR нужны F₀₁, F₁₀ > 0 > F₀₀, F₁₁ — противоречие.' },
    { q: 'Сколько листьев у бинарного дерева с 9 внутренними узлами?', opts: ['9', '10', '18', '512'], a: 1, why: 'L = I + 1 — доказывается индукцией по числу разбиений.' },
    { q: 'Многочлен n² + n + 41 даёт простые числа при n = 0…39. Что из этого следует?', opts: ['он простой при всех n', 'ничего о других n — при n = 40 он равен 41²', 'он простой при чётных n', 'это доказательство по индукции'], a: 1, why: 'Примеры — не доказательство.' },
    { q: 'Метод индукции требует…', opts: ['проверить 10 случаев', 'базу и шаг «из P(n) следует P(n + 1)»', 'контрпример', 'только шаг'], a: 1, why: 'Без базы шаг ничего не доказывает, и наоборот.' },
  ];
  const GEN_OPS = ['and', 'or', 'imp', 'iff', 'xor'];
  const OPSYM = { and: '∧', or: '∨', imp: '→', iff: '↔', xor: '⊕' };
  function genFormula(rng, depth, vars) {
    if (depth === 0 || rng.random() < 0.2) {
      const v = vars[rng.randint(vars.length)];
      return rng.random() < 0.3 ? '¬' + v : v;
    }
    const op = GEN_OPS[rng.randint(GEN_OPS.length)];
    const a = genFormula(rng, depth - 1, vars);
    const b = genFormula(rng, depth - 1, vars);
    const wrap = (x) => (x.length > 2 ? '(' + x + ')' : x);
    const f = wrap(a) + ' ' + OPSYM[op] + ' ' + wrap(b);
    return rng.random() < 0.15 ? '¬(' + f + ')' : f;
  }
  const TAUTS = ['A ∨ ¬A', '(A → B) ∨ (B → A)', '((A → B) → A) → A', 'A ∧ B → A', 'A → A ∨ B', '(A → B) ∧ (B → C) → (A → C)', 'A ∧ ¬A → B'];
  function makeTask(round) {
    const rng = new GBC.RNG(1000 + round);
    const kind = round % 4;
    if (kind === 3) return { ...BANK[rng.randint(BANK.length)], kind: 'вопрос' };
    if (kind === 0) {
      const vars = rng.random() < 0.5 ? ['A', 'B'] : ['A', 'B', 'C'];
      const f = genFormula(rng, 2 + rng.randint(2), vars);
      const env = {};
      vars.forEach((v) => (env[v] = rng.randint(2)));
      const ast = P(f);
      const val = compile(ast)(env);
      return { kind: 'вычисление', q: 'Чему равна формула ' + str(ast) + ' при ' + vars.map((v) => v + ' = ' + env[v]).join(', ') + '?', opts: ['0', '1'], a: val, why: 'Вычисляйте от внутренних скобок к внешним; ¬ — первым, → истинна всегда, кроме 1 → 0.' };
    }
    if (kind === 1) {
      const f = rng.random() < 0.4 ? TAUTS[rng.randint(TAUTS.length)] : genFormula(rng, 2, ['A', 'B']);
      const ast = P(f);
      const k = kindOf(outs(ast, GBC.lesson1519.unionVars(ast)));
      const opts = ['тавтология', 'выполнима, но не тавтология', 'противоречие'];
      return { kind: 'тип формулы', q: 'Какая это формула: ' + str(ast) + '?', opts, a: k === 'тавтология' ? 0 : k === 'выполнима' ? 1 : 2, why: 'Постройте таблицу: тавтология — единицы во всех строках, противоречие — нули во всех.' };
    }
    const PAIRS = [['¬(A ∧ B)', '¬A ∨ ¬B'], ['¬(A ∧ B)', '¬A ∧ ¬B'], ['A → B', '¬B → ¬A'], ['A → B', 'B → A'], ['A → B', '¬A ∨ B'], ['A ∨ (A ∧ B)', 'A'], ['(A → B) → C', 'A → (B → C)'], ['A → (B → C)', 'A ∧ B → C'], ['A ⊕ B', '¬(A ↔ B)'], ['¬(A → B)', '¬A → ¬B'], ['¬(A → B)', 'A ∧ ¬B']];
    const [x, y] = PAIRS[rng.randint(PAIRS.length)];
    const eq = compare(P(x), P(y)).eq;
    return { kind: 'равносильность', q: 'Равносильны ли ' + x + ' и ' + y + '?', opts: ['да', 'нет'], a: eq ? 0 : 1, why: eq ? 'Таблицы совпадают во всех строках.' : 'Есть строка, где формулы различаются, — контрпример.' };
  }
  GBC.widget('logic-game', (el) => {
    const s = { round: 1, right: 0, done: 0, streak: 0, picked: null, task: makeTask(1) };
    const w = ui.shell(el, { title: 'Тренажёр: логика', sub: 'Бесконечный поток задач: вычисление формул, тип формулы, равносильность и вопросы по уроку. Задачи генерируются заново на каждом раунде.' });
    const kindEl = H('div', { style: 'margin-bottom:4px' });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.05rem;padding:4px 0 12px' });
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));gap:8px' });
    w.main.append(kindEl, qEl, optsBox);
    const next = ui.button(w.controls, { label: 'Следующая', icon: 'step', onClick: () => ((s.round += 1), (s.task = makeTask(s.round)), (s.picked = null), draw()) });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'задача' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function draw() {
      const T = s.task;
      kindEl.textContent = '';
      kindEl.appendChild(badge(T.kind, ''));
      qEl.textContent = T.q;
      optsBox.textContent = '';
      T.opts.forEach((o, k) => {
        const b = ui.button(optsBox, { label: o, kind: s.picked === null || k === T.a ? 'primary' : '', onClick: () => {
          if (s.picked !== null) return;
          s.picked = k;
          s.done++;
          if (k === T.a) (s.right++, s.streak++);
          else s.streak = 0;
          draw();
        } });
        b.style.whiteSpace = 'normal';
        b.style.textAlign = 'left';
        b.style.height = 'auto';
        if (s.picked !== null) b.disabled = true;
      });
      st.set('r', String(s.round));
      st.set('ok', s.right + ' из ' + s.done);
      st.set('s', String(s.streak));
      note.innerHTML = s.picked === null ? 'Подсказка: в сомнительных случаях стройте таблицу истинности.' : (s.picked === T.a ? '<b>Верно!</b> ' : '<b>Нет</b>, ответ: ' + T.opts[T.a] + '. ') + T.why;
      next.textContent = '';
      next.append(ui.icon('step'), s.picked === null ? 'Пропустить' : 'Следующая');
    }
    draw();
  });
})();
