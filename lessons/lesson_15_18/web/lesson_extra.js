/* Урок 15.18: теория графов. Часть 2 — ориентированные графы, раскраска, паросочетания и потоки,
 * графы и матрицы, случайные сети, графы в бустинге.
 * Виджеты: топологическая сортировка; критический путь; сильно связные компоненты (Косарайю);
 * жадная раскраска и порядок вершин; планарность и формула Эйлера; связывание признаков EFB;
 * паросочетания (Кун) и теорема Холла; максимальный поток; степени матрицы смежности; PageRank
 * (степенной метод и блуждание); центральности; спектральная кластеризация; распространение меток;
 * гигантская компонента; тесный мир (Уоттс — Строгац); безмасштабные сети (Барабаши — Альберт);
 * графовые признаки и утечка; честное разбиение графа; граф взаимодействий признаков в бустинге;
 * тренажёр-генератор задач.
 * Помощники — из GBC.lesson1518 (часть 1, lesson.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const {
    f1, f2, f3, py, num, pct, plural, nWord, dstr,
    SER, col, tint, flexRow, monoBox, legendRow, cellTable, badge,
    GraphView, sTxt, adjList, bfsDist, components, circlePos, pyList,
  } = GBC.lesson1518;

  /* ==============================================================================
   * 22. Топологическая сортировка
   * ============================================================================== */
  const PG = {
    names: ['данные', 'очистка', 'признаки', 'категории', 'разбиение', 'обучение', 'валидация', 'отчёт'],
    pos: [[40, 140], [125, 140], [215, 60], [215, 220], [300, 140], [390, 60], [390, 220], [480, 140]],
    edges: [[0, 1], [1, 2], [1, 3], [2, 4], [3, 4], [4, 5], [4, 6], [5, 6], [6, 7], [5, 7]],
  };
  function kahn(n, edges, k) {
    const indeg = new Array(n).fill(0);
    edges.forEach(([, b]) => indeg[b]++);
    const queue = U.range(n).filter((i) => indeg[i] === 0);
    const order = [];
    while (order.length < k && queue.length) {
      const v = queue.shift();
      order.push(v);
      edges.forEach(([a, b]) => a === v && --indeg[b] === 0 && queue.push(b));
    }
    return { indeg, queue, order };
  }
  GBC.widget('topo-sort', (el) => {
    const s = { k: 0, cyc: false };
    const n = PG.names.length;
    const w = ui.shell(el, { title: 'Топологическая сортировка конвейера ML', sub: 'Стрелка «a → b»: b нельзя начать раньше a. Алгоритм Кана: берём шаг без невыполненных зависимостей (входящая степень 0), вычёркиваем его стрелки, повторяем.' });
    const pl = ui.player(w.controls, { label: 'Шаг', min: 0, max: n, value: 0, fps: 1, format: (k) => 'шаг ' + k, onChange: (k) => ((s.k = k), draw()) });
    ui.toggle(w.controls, { label: 'Добавить стрелку «валидация → признаки»', checked: false, onChange: (v) => ((s.cyc = v), pl.stop(), pl.set(0), (s.k = 0), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 280 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'done', label: 'выполнено' }, { key: 'q', label: 'готовы к запуску' }, { key: 'res', label: 'итог' }]);
    function draw() {
      const E = s.cyc ? [...PG.edges, [6, 2]] : PG.edges;
      const { indeg, queue, order } = kahn(n, E, s.k);
      const stuck = !queue.length && order.length < n;
      const wave = new Array(n).fill(0);
      const full = kahn(n, E, n).order;
      full.forEach((v) => E.forEach(([a, b]) => a === v && (wave[b] = Math.max(wave[b], wave[v] + 1))));
      gv.draw({
        nodes: PG.pos.map(([x, y], i) => ({
          x, y, r: 16, label: order.includes(i) ? String(order.indexOf(i) + 1) : String(indeg[i]), labelColor: order.includes(i) ? 'model' : 'ink',
          fill: order.includes(i) ? 'model' : queue.includes(i) ? 'yellow' : stuck && s.k > 0 ? 'red' : null, fillP: order.includes(i) ? 25 : 45,
          sub: PG.names[i], subSize: 12.5,
        })),
        edges: E.map((e) => ({ a: e[0], b: e[1], arrow: true, color: s.cyc && e[0] === 6 && e[1] === 2 ? 'red' : order.includes(e[0]) ? 'muted' : 'ink2', width: s.cyc && e[0] === 6 && e[1] === 2 ? 2.8 : order.includes(e[0]) ? 1.4 : 2, bend: s.cyc && e[0] === 6 && e[1] === 2 ? -40 : 0, dash: order.includes(e[0]) })),
      });
      line.textContent = 'Порядок: ' + (order.map((v) => PG.names[v]).join(' → ') || '—') + '\nГотовы (входящая степень 0): ' + (queue.map((v) => PG.names[v]).join(', ') || '—') + (full.length === n ? '\nВолны параллельного запуска: ' + U.range(Math.max(...wave) + 1).map((k) => '{' + U.range(n).filter((i) => wave[i] === k).map((i) => PG.names[i]).join(', ') + '}').join(' → ') : '');
      st.set('done', order.length + ' из ' + n);
      st.set('q', String(queue.length));
      st.set('res', order.length === n ? 'порядок найден' : stuck && s.k > 0 ? 'цикл!' : '…');
      note.innerHTML = 'В кружке — число невыполненных зависимостей шага; после выполнения — его номер в порядке. Порядок существует только у графа <b>без циклов</b> (DAG). ' + (s.cyc ? 'Красная стрелка создала цикл признаки → разбиение → валидация → признаки: каждый из этих шагов ждёт другого, и алгоритм застревает — так Кан <b>обнаруживает цикл</b>. В конвейере ML такой цикл — это утечка: признаки, построенные по результатам валидации.' : 'Порядок не единственный: «признаки» и «категории» можно поменять местами или запустить одновременно. Волны — шаги, которые можно выполнять параллельно; число волн равно длине самой длинной цепочки зависимостей. Так планировщики (Airflow, make, dask) решают, что запускать.');
    }
    w.pythonAction(() => 'from collections import deque\n\nnames = ' + pyList(PG.names) + '\nedges = ' + pyList(s.cyc ? [...PG.edges, [6, 2]] : PG.edges) + '\nn = len(names)\nindeg = [0] * n\nfor a, b in edges:\n    indeg[b] += 1\nq = deque(i for i in range(n) if indeg[i] == 0)\norder = []\nwhile q:\n    v = q.popleft()\n    order.append(v)\n    for a, b in edges:\n        if a == v:\n            indeg[b] -= 1\n            if indeg[b] == 0:\n                q.append(b)\nif len(order) < n:\n    print("цикл! не удалось упорядочить:", [names[i] for i in range(n) if i not in order])\nelse:\n    print(" → ".join(names[i] for i in order))\n');
    draw();
  });

  /* ==============================================================================
   * 23. Критический путь: динамическое программирование на DAG
   * ============================================================================== */
  const CP = {
    names: ['сбор данных', 'разметка', 'очистка', 'признаки', 'базовая модель', 'бустинг', 'подбор параметров', 'отчёт'],
    dur: [3, 4, 2, 3, 1, 2, 4, 1],
    pos: [[45, 150], [160, 60], [160, 240], [270, 240], [290, 60], [380, 170], [440, 240], [480, 80]],
    edges: [[0, 1], [0, 2], [2, 3], [1, 4], [2, 4], [3, 5], [1, 5], [5, 6], [4, 7], [6, 7]],
  };
  function critical(dur) {
    const n = dur.length;
    const order = kahn(n, CP.edges, n).order;
    const ES = new Array(n).fill(0);
    order.forEach((v) => CP.edges.forEach(([a, b]) => a === v && (ES[b] = Math.max(ES[b], ES[v] + dur[v]))));
    const EF = ES.map((e, i) => e + dur[i]);
    const T = Math.max(...EF);
    const LF = new Array(n).fill(T);
    order.slice().reverse().forEach((v) => CP.edges.forEach(([a, b]) => a === v && (LF[a] = Math.min(LF[a], LF[b] - dur[b]))));
    const LS = LF.map((f, i) => f - dur[i]);
    const slack = LS.map((l, i) => l - ES[i]);
    return { ES, EF, LS, LF, slack, T };
  }
  GBC.widget('critical-path', (el) => {
    const s = { dur: CP.dur.slice(), sel: 1 };
    const n = CP.names.length;
    const w = ui.shell(el, { title: 'Критический путь проекта: самая длинная цепочка в DAG', sub: 'Число в кружке — длительность задачи (дни), над ним — ранний старт и финиш. Задачи на критическом пути (оранжевые) нельзя задерживать ни на день. Выберите задачу и измените её длительность.' });
    const sel = ui.select(w.controls, { label: 'Задача', value: s.sel, options: CP.names.map((nm, i) => ({ value: i, label: nm })), onChange: (v) => ((s.sel = +v), ds.set(s.dur[s.sel]), draw()) });
    const ds = ui.slider(w.controls, { label: 'Длительность, дней', min: 1, max: 8, step: 1, value: s.dur[s.sel], format: String, onInput: (v) => ((s.dur[s.sel] = v), draw()) });
    ui.button(w.controls, { label: 'Исходный план', icon: 'reset', onClick: () => ((s.dur = CP.dur.slice()), ds.set(s.dur[s.sel]), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 290, onNode: (i) => ((s.sel = i), sel.set(i), ds.set(s.dur[i]), draw()) });
    const gantt = new GBC.Plot(w.main, { height: 230, x: { label: 'день', domain: [0, 20] }, y: { label: '', domain: [-0.7, n - 0.3], ticks: [] }, margin: { left: 8 } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'T', label: 'срок проекта' }, { key: 'path', label: 'критический путь' }, { key: 'sl', label: 'резерв выбранной задачи' }]);
    function draw() {
      const R = critical(s.dur);
      const crit = (i) => R.slack[i] === 0;
      const critE = (e) => crit(e[0]) && crit(e[1]) && R.ES[e[1]] === R.EF[e[0]];
      gv.draw({
        nodes: CP.pos.map(([x, y], i) => ({ x, y, r: 16, label: String(s.dur[i]), fill: crit(i) ? 'tree' : 'model', fillP: crit(i) ? 40 : 18, color: i === s.sel ? 'ink' : crit(i) ? 'tree' : 'model', width: i === s.sel ? 3.2 : 2, sub: CP.names[i], subSize: 12, top: R.ES[i] + '–' + R.EF[i], topColor: 'ink2', topBold: false, topSize: 11 })),
        edges: CP.edges.map((e) => ({ a: e[0], b: e[1], arrow: true, color: critE(e) ? 'tree' : 'ink2', width: critE(e) ? 3.2 : 1.6 })),
      });
      const rows = U.range(n).map((i) => n - 1 - i);
      gantt.render([
        ...U.range(n).map((i) => ({ type: 'rect', x0: R.ES[i], x1: R.EF[i], y0: rows[i] - 0.32, y1: rows[i] + 0.32, fill: crit(i) ? 'tree' : 'model', opacity: 0.75, stroke: i === s.sel ? 'ink' : null, width: 2 })),
        ...U.range(n).filter((i) => R.slack[i] > 0).map((i) => ({ type: 'rect', x0: R.EF[i], x1: R.LF[i], y0: rows[i] - 0.18, y1: rows[i] + 0.18, fill: 'muted', opacity: 0.35 })),
        { type: 'text', items: U.range(n).map((i) => ({ x: R.EF[i], y: rows[i], dx: 6, dy: 4, text: CP.names[i] + (R.slack[i] ? ' (резерв ' + R.slack[i] + ')' : ''), color: 'ink2' })) },
        { type: 'vline', x: R.T, color: 'ink2', dash: '4 4', width: 1, text: 'срок ' + R.T },
      ], { x: [0, Math.max(20, R.T + 6)] });
      const path = [];
      let v = U.range(n).find((i) => crit(i) && R.ES[i] === 0);
      while (v !== undefined) {
        path.push(v);
        const cur = v;
        v = CP.edges.filter((e) => e[0] === cur && critE(e)).map((e) => e[1])[0];
      }
      st.set('T', nWord(R.T, 'день', 'дня', 'дней'));
      st.set('path', path.map((i) => CP.names[i]).join(' → '));
      st.set('sl', R.slack[s.sel] ? nWord(R.slack[s.sel], 'день', 'дня', 'дней') : '0 — критическая');
      note.innerHTML = 'Ранний старт задачи — самый поздний финиш её предшественников: ES(b) = max<sub>a→b</sub> (ES(a) + d(a)). Задачи считаются в <b>топологическом порядке</b> — это динамическое программирование на DAG, O(|V| + |E|). Срок проекта — длина <b>самого длинного пути</b> (в графе с циклами такая задача NP-трудна, а в DAG — линейна). Обратным проходом получаем поздние сроки и <b>резерв</b>: на сколько задачу можно задержать без сдвига срока. Резерв «разметки» сейчас ' + R.slack[1] + ' — увеличьте её длительность сверх ' + (s.dur[1] + R.slack[1]) + ' дней, и она станет критической.';
    }
    w.pythonAction(() => 'from collections import deque\n\nnames = ' + pyList(CP.names) + '\ndur = ' + pyList(s.dur) + '\nedges = ' + pyList(CP.edges) + '\nn = len(names)\nindeg = [0] * n\nfor a, b in edges:\n    indeg[b] += 1\nq, order = deque(i for i in range(n) if indeg[i] == 0), []\nwhile q:\n    v = q.popleft()\n    order.append(v)\n    for a, b in edges:\n        if a == v:\n            indeg[b] -= 1\n            if indeg[b] == 0:\n                q.append(b)\nES = [0] * n\nfor v in order:\n    for a, b in edges:\n        if a == v:\n            ES[b] = max(ES[b], ES[v] + dur[v])\nT = max(ES[i] + dur[i] for i in range(n))\nLF = [T] * n\nfor v in reversed(order):\n    for a, b in edges:\n        if a == v:\n            LF[a] = min(LF[a], LF[b] - dur[b])\nfor i in range(n):\n    print(f"{names[i]:18} старт {ES[i]:2}  финиш {ES[i] + dur[i]:2}  резерв {LF[i] - dur[i] - ES[i]}")\nprint("срок проекта:", T)\n');
    draw();
  });

  /* ==============================================================================
   * 24. Сильно связные компоненты и конденсация (Косарайю)
   * ============================================================================== */
  const SC = {
    pos: [[40, 55], [150, 40], [95, 135], [200, 145], [300, 110], [265, 220], [170, 265], [55, 250], [320, 30]],
    edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3], [5, 6], [6, 7], [7, 6], [4, 8], [1, 8]],
  };
  function kosaraju(n, E) {
    const adj = adjList(n, E, true);
    const radj = adjList(n, E.map(([a, b]) => [b, a]), true);
    const seen = new Array(n).fill(false);
    const fin = [];
    const dfs1 = (v) => {
      seen[v] = true;
      adj[v].forEach((u) => !seen[u] && dfs1(u));
      fin.push(v);
    };
    for (let v = 0; v < n; v++) if (!seen[v]) dfs1(v);
    const comp = new Array(n).fill(-1);
    const comps = [];
    fin.slice().reverse().forEach((s0) => {
      if (comp[s0] >= 0) return;
      const c = comps.length;
      const mem = [];
      const st = [s0];
      comp[s0] = c;
      while (st.length) {
        const v = st.pop();
        mem.push(v);
        radj[v].forEach((u) => comp[u] < 0 && ((comp[u] = c), st.push(u)));
      }
      comps.push(mem.sort((a, b) => a - b));
    });
    return { fin, comp, comps };
  }
  GBC.widget('scc', (el) => {
    const s = { k: 99, extra: false };
    const n = SC.pos.length;
    const w = ui.shell(el, { title: 'Сильно связные компоненты: где можно «ходить по кругу»', sub: 'Вершины u и v в одной компоненте, если из u можно дойти до v и обратно по стрелкам. Справа — конденсация: каждая компонента сжата в одну вершину, и получился DAG.' });
    const pl = ui.player(w.controls, { label: 'Найдено компонент', min: 0, max: 4, value: 4, fps: 1, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    ui.toggle(w.controls, { label: 'Добавить стрелку 9 → 1', checked: false, onChange: (v) => ((s.extra = v), reset()) });
    const gv = new GraphView(w.main, { w: 520, h: 300 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'компонент' }, { key: 'big', label: 'крупнейшая' }, { key: 'cond', label: 'рёбер конденсации' }]);
    const edgesNow = () => (s.extra ? SC.edges.concat([[8, 0]]) : SC.edges);
    function reset() {
      const R = kosaraju(n, edgesNow());
      pl.stop();
      pl.setMax(R.comps.length);
      pl.set(R.comps.length);
      s.k = R.comps.length;
      draw();
    }
    function draw() {
      const E = edgesNow();
      const R = kosaraju(n, E);
      const k = Math.min(s.k, R.comps.length);
      const shown = (v) => R.comp[v] < k;
      const cE = [];
      E.forEach(([a, b]) => {
        const ca = R.comp[a];
        const cb = R.comp[b];
        if (ca !== cb && !cE.some((e) => e[0] === ca && e[1] === cb)) cE.push([ca, cb]);
      });
      const C = R.comps.length;
      const cpos = R.comps.map((mem) => [380 + (U.mean(mem.map((v) => SC.pos[v][0])) / 340) * 120, U.mean(mem.map((v) => SC.pos[v][1]))]);
      const nodes = SC.pos.map(([x, y], i) => ({ x, y, r: 14, label: String(i + 1), fill: shown(i) ? SER[R.comp[i] % SER.length] : null, fillP: 40, color: shown(i) ? SER[R.comp[i] % SER.length] : 'model' }));
      const cnodes = cpos.map(([x, y], c) => ({ x, y, r: 12 + 3 * R.comps[c].length, label: String.fromCharCode(1040 + c), size: 13, fill: c < k ? SER[c % SER.length] : null, fillP: 45, color: c < k ? SER[c % SER.length] : 'muted', dim: c >= k }));
      gv.draw({
        nodes: nodes.concat(cnodes),
        edges: E.map((e) => ({ a: e[0], b: e[1], arrow: true, color: R.comp[e[0]] === R.comp[e[1]] && shown(e[0]) ? SER[R.comp[e[0]] % SER.length] : 'ink2', width: R.comp[e[0]] === R.comp[e[1]] && shown(e[0]) ? 2.6 : 1.6, bend: E.some((f) => f[0] === e[1] && f[1] === e[0]) ? 14 : 0 })).concat(cE.map(([a, b]) => ({ a: n + a, b: n + b, arrow: true, color: 'ink2', width: 1.8 }))),
        under: [S('line', { x1: 358, y1: 12, x2: 358, y2: 288, style: 'stroke:var(--border-strong);stroke-dasharray:4 4' }), sTxt(445, 285, 'конденсация', { size: 12, color: 'ink2' })],
      });
      line.textContent = 'Порядок выхода из DFS (фаза 1): ' + R.fin.map((v) => v + 1).join(' ') + '\nФаза 2 — обходы по обращённым стрелкам, начиная с последних вышедших:\n' + R.comps.slice(0, k).map((mem, c) => String.fromCharCode(1040 + c) + ' = {' + mem.map((v) => v + 1).join(', ') + '}').join('   ');
      st.set('c', String(C));
      st.set('big', String(Math.max(...R.comps.map((m) => m.length))));
      st.set('cond', String(cE.length));
      note.innerHTML = '<b>Алгоритм Косарайю</b> — два обхода DFS. Первый запоминает порядок выхода; второй идёт по <b>обращённым</b> стрелкам, начиная с вершины, вышедшей последней. Каждый второй обход «застревает» ровно внутри одной компоненты: выбраться из неё по обратным стрелкам можно только в уже найденные компоненты. Время O(|V| + |E|). Сжав компоненты, получаем <b>конденсацию</b> — она всегда без циклов. ' + (s.extra ? 'Стрелка 9 → 1 замкнула цепочку: компоненты А, Б и вершина 9 слились в одну большую.' : 'Где это нужно: цепь Маркова неразложима, только если граф переходов сильно связен; на графе ссылок без «прыжков» блуждание застревает в компоненте-«стоке» — поэтому в PageRank добавляют телепортацию (шаг 31).');
    }
    w.pythonAction(() => 'import numpy as np\nfrom scipy.sparse import csr_matrix\nfrom scipy.sparse.csgraph import connected_components\n\nedges = ' + pyList(edgesNow().map((e) => [e[0] + 1, e[1] + 1])) + '\nn = 9\nA = np.zeros((n, n))\nfor a, b in edges:\n    A[a - 1, b - 1] = 1\nk, labels = connected_components(csr_matrix(A), directed=True, connection="strong")\nprint("сильно связных компонент:", k)\nfor c in range(k):\n    print("  компонента:", [i + 1 for i in np.flatnonzero(labels == c)])\nprint("слабо связных:", connected_components(csr_matrix(A), directed=True, connection="weak")[0])\n');
    reset();
  });

  /* ==============================================================================
   * 25. Жадная раскраска: порядок вершин имеет значение
   * ============================================================================== */
  const COL_G = (() => {
    const crownPos = U.range(4).map((i) => [80 + i * 120, 60]).concat(U.range(4).map((i) => [80 + i * 120, 240]));
    const crownE = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j) crownE.push([i, 4 + j]);
    const crownOrder = [0, 4, 1, 5, 2, 6, 3, 7];
    const wheelPos = [[260, 150]].concat(circlePos(5, 260, 150, 115));
    const wheelE = U.range(5).map((i) => [0, i + 1]).concat(U.range(5).map((i) => [i + 1, ((i + 1) % 5) + 1]));
    const petPos = circlePos(5, 260, 150, 120).concat(circlePos(5, 260, 150, 55));
    const petE = U.range(5).map((i) => [i, (i + 1) % 5]).concat(U.range(5).map((i) => [i, i + 5])).concat(U.range(5).map((i) => [5 + i, 5 + ((i + 2) % 5)]));
    return {
      crown: { label: 'корона', pos: crownPos, E: crownE, natural: crownOrder, names: ['u₁', 'u₂', 'u₃', 'u₄', 'v₁', 'v₂', 'v₃', 'v₄'] },
      exams: {
        label: 'экзамены', names: ['матан', 'линал', 'физика', 'химия', 'биология', 'история', 'англ.'],
        pos: [[90, 70], [250, 40], [420, 70], [460, 210], [300, 260], [140, 250], [260, 150]],
        E: [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 3], [6, 5], [1, 6]],
      },
      wheel: { label: 'колесо W₅', pos: wheelPos, E: wheelE, names: ['ц', '1', '2', '3', '4', '5'] },
      pet: { label: 'Петерсен', pos: petPos, E: petE, names: U.range(10).map((i) => String(i + 1)) },
    };
  })();
  function chromatic(n, adj) {
    for (let k = 1; k <= n; k++) {
      const c = new Array(n).fill(-1);
      const ok = (function rec(v) {
        if (v === n) return true;
        for (let x = 0; x < k; x++) {
          if (adj[v].some((u) => c[u] === x)) continue;
          c[v] = x;
          if (rec(v + 1)) return true;
          c[v] = -1;
        }
        return false;
      })(0);
      if (ok) return k;
    }
    return n;
  }
  function greedyColor(n, adj, mode, natural) {
    const color = new Array(n).fill(-1);
    const order = [];
    const deg = adj.map((a) => a.length);
    const base = natural || U.range(n);
    for (let t = 0; t < n; t++) {
      let v;
      const left = base.filter((x) => color[x] < 0);
      if (mode === 'nat') v = left[0];
      else if (mode === 'deg') v = left.slice().sort((a, b) => deg[b] - deg[a] || base.indexOf(a) - base.indexOf(b))[0];
      else {
        const sat = (x) => new Set(adj[x].filter((u) => color[u] >= 0).map((u) => color[u])).size;
        v = left.slice().sort((a, b) => sat(b) - sat(a) || deg[b] - deg[a] || base.indexOf(a) - base.indexOf(b))[0];
      }
      let c = 0;
      while (adj[v].some((u) => color[u] === c)) c++;
      color[v] = c;
      order.push(v);
    }
    return { color, order };
  }
  GBC.widget('greedy-coloring', (el) => {
    const s = { g: 'crown', mode: 'nat', k: 99 };
    const w = ui.shell(el, { title: 'Жадная раскраска: каждому — первый свободный цвет', sub: 'Вершины красятся по одной; каждая получает наименьший цвет, которого нет у уже раскрашенных соседей. Результат сильно зависит от порядка.' });
    ui.segmented(w.controls, { label: 'Граф', value: s.g, options: Object.keys(COL_G).map((k) => ({ value: k, label: COL_G[k].label })), onChange: (v) => ((s.g = v), reset()) });
    ui.segmented(w.controls, { label: 'Порядок', value: s.mode, options: [{ value: 'nat', label: 'по номерам' }, { value: 'deg', label: 'по убыванию степени' }, { value: 'dsatur', label: 'DSatur' }], onChange: (v) => ((s.mode = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Раскрашено вершин', min: 0, max: 8, value: 8, fps: 1.5, format: (k, m) => k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 300 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'used', label: 'цветов использовано' }, { key: 'chi', label: 'хроматическое число χ' }, { key: 'bound', label: 'граница Δ + 1' }]);
    function reset() {
      const n = COL_G[s.g].pos.length;
      pl.stop();
      pl.setMax(n);
      pl.set(n);
      s.k = n;
      draw();
    }
    function draw() {
      const G = COL_G[s.g];
      const n = G.pos.length;
      const adj = adjList(n, G.E);
      const R = greedyColor(n, adj, s.mode, G.natural);
      const k = Math.min(s.k, n);
      const done = new Set(R.order.slice(0, k));
      const cur = R.order[k - 1];
      const chi = chromatic(n, adj);
      const used = Math.max(-1, ...R.order.slice(0, k).map((v) => R.color[v])) + 1;
      gv.draw({
        nodes: G.pos.map(([x, y], i) => ({ x, y, r: 16, label: done.has(i) ? String(R.color[i] + 1) : '', fill: done.has(i) ? SER[R.color[i] % SER.length] : null, fillP: 50, color: done.has(i) ? SER[R.color[i] % SER.length] : 'muted', width: i === cur ? 3.6 : 2, halo: i === cur ? 'ink' : null, haloOpacity: 0.12, sub: G.names[i], subSize: 12 })),
        edges: G.E.map((e) => ({ a: e[0], b: e[1], color: e[0] === cur || e[1] === cur ? 'ink' : 'ink2', width: e[0] === cur || e[1] === cur ? 2.4 : 1.6, opacity: 0.85 })),
      });
      line.textContent = 'Порядок: ' + R.order.map((v, t) => (t < k ? G.names[v] + '→' + (R.color[v] + 1) : G.names[v])).join('  ') + (s.g === 'exams' && k === n ? '\nДни экзаменов: ' + U.range(used).map((c) => 'день ' + (c + 1) + ': ' + U.range(n).filter((i) => R.color[i] === c).map((i) => G.names[i]).join(', ')).join('; ') : '');
      st.set('used', String(used));
      st.set('chi', String(chi));
      st.set('bound', String(Math.max(...adj.map((a) => a.length)) + 1));
      note.innerHTML = {
        crown: '<b>Корона</b> — двудольный граф (χ = 2: все u одного цвета, все v — другого), но порядок «u₁, v₁, u₂, v₂, …» заставляет жадный алгоритм взять 4 цвета: каждая новая пара не может повторить уже занятые. На короне из 2n вершин такой порядок даёт n цветов вместо 2. Сортировка по степени не помогает (все степени равны), а <b>DSatur</b> — «сначала самую стеснённую вершину» (с наибольшим числом разных цветов у соседей) — красит корону оптимально.',
        exams: 'Расписание экзаменов: предметы — вершины, ребро — у предметов есть общие студенты, цвет — день. Хроматическое число — минимальное число дней. Здесь ' + chi + ' — английский конфликтует с тремя предметами, а «треугольник» матан–линал–физика требует трёх разных дней.',
        wheel: 'Колесо с пятью спицами: обод — нечётный цикл (3 цвета), центр соединён со всеми — нужен четвёртый. χ = 4 при максимальной степени 5: граница Δ + 1 достигается не всегда.',
        pet: 'Граф Петерсена: χ = 3 — в нём есть циклы нечётной длины 5, поэтому двух цветов мало, а трёх хватает. Найти хроматическое число в общем случае NP-трудно, поэтому на практике красят жадно с хорошим порядком.',
      }[s.g] + ' Жадный алгоритм всегда укладывается в Δ + 1 цвет (Δ — наибольшая степень): у вершины не больше Δ соседей, и хотя бы один цвет из Δ + 1 свободен.';
    }
    w.pythonAction(() => {
      const G = COL_G[s.g];
      return 'edges = ' + pyList(G.E) + '\nn = ' + G.pos.length + '\norder = ' + pyList(greedyColor(G.pos.length, adjList(G.pos.length, G.E), s.mode, G.natural).order) + '   # порядок из виджета\nadj = {v: set() for v in range(n)}\nfor a, b in edges:\n    adj[a].add(b)\n    adj[b].add(a)\ncolor = {}\nfor v in order:\n    used = {color[u] for u in adj[v] if u in color}\n    color[v] = next(c for c in range(n) if c not in used)\nprint("цветов:", max(color.values()) + 1, color)\n\nfrom itertools import product\nchi = next(k for k in range(1, n + 1) if any(all(c[a] != c[b] for a, b in edges) for c in product(range(k), repeat=n)))\nprint("хроматическое число (перебор):", chi)\n';
    });
    reset();
  });

  /* ==============================================================================
   * 26. Планарность: формула Эйлера и раскраска карт
   * ============================================================================== */
  const PLN = {
    tetra: { label: 'тетраэдр', pos: [[260, 25], [470, 270], [50, 270], [260, 185]], E: [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]], F: [[0, 1, 3], [1, 2, 3], [2, 0, 3]], outer: [0, 1, 2] },
    cube: { label: 'куб', pos: [[60, 30], [460, 30], [460, 270], [60, 270], [190, 105], [330, 105], [330, 195], [190, 195]], E: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]], F: [[4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], outer: [0, 1, 2, 3] },
    octa: { label: 'октаэдр', pos: [[260, 18], [485, 278], [35, 278], [260, 222], [205, 128], [315, 128]], E: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [3, 1], [3, 2], [4, 0], [4, 2], [5, 0], [5, 1]], F: [[0, 5, 4], [1, 3, 5], [2, 4, 3], [0, 1, 5], [1, 2, 3], [2, 0, 4], [3, 4, 5]], outer: [0, 1, 2] },
    prism: { label: 'призма', pos: [[260, 25], [470, 270], [50, 270], [260, 125], [340, 215], [180, 215]], E: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [0, 3], [1, 4], [2, 5]], F: [[3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]], outer: [0, 1, 2] },
    k5: { label: 'K₅', pos: circlePos(5, 260, 155, 125), E: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [1, 3], [2, 4], [3, 0], [4, 1]], F: null },
    k33: { label: 'K₃,₃', pos: [[90, 50], [260, 50], [430, 50], [90, 260], [260, 260], [430, 260]], E: [[0, 3], [0, 4], [0, 5], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5]], F: null, bip: true },
  };
  GBC.widget('planar', (el) => {
    const s = { g: 'cube', faces: true };
    const w = ui.shell(el, { title: 'Планарные графы: формула Эйлера V − E + F = 2', sub: 'Граф планарный, если его можно нарисовать на плоскости без пересечений рёбер. Рёбра делят плоскость на грани (F), считая внешнюю. Грани раскрашены так, чтобы соседние (с общим ребром) различались.' });
    ui.segmented(w.controls, { label: 'Граф', value: s.g, options: Object.keys(PLN).map((k) => ({ value: k, label: PLN[k].label })), onChange: (v) => ((s.g = v), draw()) });
    ui.toggle(w.controls, { label: 'Раскрасить грани', checked: true, onChange: (v) => ((s.faces = v), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 300 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'V / E / F' }, { key: 'eu', label: 'V − E + F' }, { key: 'fc', label: 'цветов для граней' }]);
    function draw() {
      const G = PLN[s.g];
      const V = G.pos.length;
      const E = G.E.length;
      const under = [];
      let fcol = 0;
      if (G.F) {
        const faces = G.F.concat([G.outer]);
        const key = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
        const fe = faces.map((f) => new Set(f.map((v, i) => key(v, f[(i + 1) % f.length]))));
        const adjF = faces.map((_, i) => faces.map((_, j) => j).filter((j) => j !== i && [...fe[i]].some((e) => fe[j].has(e))));
        const R = greedyColor(faces.length, adjF, 'dsatur');
        fcol = Math.max(...R.color) + 1;
        if (s.faces) {
          under.push(S('rect', { x: 0, y: 0, width: 520, height: 300, rx: 12, style: 'fill:' + tint(SER[R.color[faces.length - 1]], 20) }));
          G.F.forEach((f, i) => under.push(S('polygon', { points: f.map((v) => G.pos[v].join(',')).join(' '), style: 'fill:' + tint(SER[R.color[i]], 45) + ';stroke:none' })));
        }
      }
      gv.draw({ under, nodes: G.pos.map(([x, y], i) => ({ x, y, r: 12, label: String(i + 1), size: 11, fill: G.bip ? (i < 3 ? 'blue' : 'orange') : null, fillP: 35 })), edges: G.E.map((e) => ({ a: e[0], b: e[1], color: 'ink', width: 2.2 })) });
      if (G.F) {
        const F = G.F.length + 1;
        line.textContent = 'V = ' + V + ', E = ' + E + ', F = ' + F + ' (' + G.F.length + ' внутренних + внешняя)  →  V − E + F = ' + (V - E + F) + '\nПроверка неравенства E ≤ 3V − 6: ' + E + ' ≤ ' + (3 * V - 6) + ' ✓';
        st.set('v', V + ' / ' + E + ' / ' + F);
        st.set('eu', String(V - E + F));
        st.set('fc', String(fcol));
      } else {
        const bound = G.bip ? 2 * V - 4 : 3 * V - 6;
        line.textContent = 'V = ' + V + ', E = ' + E + '.  Если бы граф был планарным, было бы E ≤ ' + (G.bip ? '2V − 4 (нет треугольников)' : '3V − 6') + ' = ' + bound + ', а E = ' + E + ' > ' + bound + '.\nЗначит, без пересечений его не нарисовать — как ни двигайте вершины.';
        st.set('v', V + ' / ' + E + ' / —');
        st.set('eu', 'граф не планарный');
        st.set('fc', '—');
      }
      note.innerHTML = G.F
        ? '<b>Формула Эйлера</b>: для любого связного планарного графа V − E + F = 2. Доказательство индукцией: удалим ребро цикла — исчезнет одно ребро и одна грань (сумма не меняется); когда циклов не останется, получим дерево: V − (V − 1) + 1 = 2. Из формулы следует E ≤ 3V − 6 (каждая грань ограничена хотя бы тремя рёбрами, каждое ребро граничит с двумя гранями) — а значит, в планарном графе есть вершина степени ≤ 5. Отсюда пять красок хватает всегда, а знаменитая <b>теорема о четырёх красках</b> (1976, доказана с помощью компьютера) говорит, что хватает четырёх: любую карту можно раскрасить в 4 цвета.'
        : (G.bip ? 'K₃,₃ — «три дома и три колодца»: соединить каждый дом с каждым колодцем без пересечений нельзя. В двудольном графе нет треугольников, каждая грань ограничена хотя бы 4 рёбрами, поэтому E ≤ 2V − 4 = 8 < 9.' : 'K₅ — пять вершин, каждая с каждой: 10 рёбер больше 3·5 − 6 = 9.') + ' По <b>теореме Куратовского</b> граф планарен тогда и только тогда, когда не содержит «копии» (подразбиения) K₅ или K₃,₃. Проверить планарность можно за линейное время — это используют при разводке микросхем.';
    }
    draw();
  });

  /* ==============================================================================
   * 27. Раскраска графа конфликтов: связывание признаков (EFB)
   * ============================================================================== */
  function efbBuild(s) {
    const p = s.p;
    const N = 200;
    const rng = new GBC.RNG(s.seed);
    const nz = U.range(N).map(() => new Array(p).fill(0));
    for (let r = 0; r < N; r++) {
      if (s.mode === 'onehot') nz[r][rng.randint(p)] = 1;
      else for (let j = 0; j < p; j++) nz[r][j] = rng.random() < s.dens ? 1 : 0;
    }
    const conf = (a, b) => U.sum(nz.map((r) => r[a] * r[b]));
    const E = [];
    for (let a = 0; a < p; a++) for (let b = a + 1; b < p; b++) if (conf(a, b) > s.K) E.push([a, b, conf(a, b)]);
    const deg = U.range(p).map((i) => E.filter((e) => e[0] === i || e[1] === i).length);
    const order = U.range(p).sort((a, b) => deg[b] - deg[a] || a - b);
    const color = new Array(p).fill(-1);
    const bundles = [];
    order.forEach((v) => {
      let c = bundles.findIndex((mem) => mem.every((u) => !E.some((e) => (e[0] === u && e[1] === v) || (e[0] === v && e[1] === u))));
      if (c < 0) (c = bundles.length), bundles.push([]);
      bundles[c].push(v);
      color[v] = c;
    });
    return { E, bundles, color, nnz: U.sum(nz.map((r) => U.sum(r))) };
  }
  GBC.widget('efb-coloring', (el) => {
    const s = { p: 10, dens: 0.08, K: 0, mode: 'sparse', seed: 1 };
    const w = ui.shell(el, { title: 'Раскраска графа конфликтов: связывание признаков (EFB)', sub: 'Признаки — вершины. Ребро — «конфликт»: признаки одновременно ненулевые больше чем у K объектов из 200. Соседи должны попасть в разные пучки (цвета); пучков нужно как можно меньше.' });
    ui.segmented(w.controls, { label: 'Данные', value: s.mode, options: [{ value: 'sparse', label: 'разреженные' }, { value: 'onehot', label: 'one-hot' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'Признаков p', min: 5, max: 14, step: 1, value: s.p, format: String, onInput: (v) => ((s.p = v), draw()) });
    ui.slider(w.controls, { label: 'Доля ненулевых', min: 0.02, max: 0.4, step: 0.02, value: s.dens, onInput: (v) => ((s.dens = v), draw()) });
    ui.slider(w.controls, { label: 'Допустимо конфликтов K', values: [0, 1, 2, 5, 10], value: s.K, format: String, onInput: (v) => ((s.K = v), draw()) });
    ui.button(w.controls, { label: 'Новые данные', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 290 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'рёбер-конфликтов' }, { key: 'b', label: 'пучков' }, { key: 'h', label: 'гистограмм на узел' }]);
    function draw() {
      const R = efbBuild(s);
      const pos = circlePos(s.p, 260, 145, 118);
      gv.draw({
        nodes: pos.map(([x, y], i) => ({ x, y, r: 16, label: 'f' + (i + 1), size: 11.5, fill: SER[R.color[i] % SER.length], fillP: 50, color: SER[R.color[i] % SER.length] })),
        edges: R.E.map((e) => ({ a: e[0], b: e[1], color: 'ink2', width: 1 + Math.min(3, e[2] / 3), opacity: 0.75 })),
      });
      line.textContent = R.bundles.map((mem, c) => 'пучок ' + (c + 1) + ': ' + mem.slice().sort((a, b) => a - b).map((i) => 'f' + (i + 1)).join(', ')).join('\n');
      st.set('e', String(R.E.length));
      st.set('b', String(R.bundles.length));
      st.set('h', s.p + ' → ' + R.bundles.length);
      note.innerHTML = 'Это задача <b>раскраски графа</b> (шаг 25). LightGBM (урок 9.2) решает её <b>жадно</b>: признаки по убыванию степени в графе конфликтов, каждый — в первый пучок, где он ни с кем не конфликтует. Признаки одного пучка складываются в один столбец со сдвигом значений (у f1 значения 1…B, у f2 — B+1…2B), и гистограммы строятся по пучкам — вместо ' + s.p + ' проходов ' + R.bundles.length + '. ' + (s.mode === 'onehot' ? 'One-hot-столбцы никогда не ненулевые одновременно — граф без рёбер, и все они ложатся в один пучок: столбцы one-hot превращаются обратно в один категориальный признак.' : 'Чем плотнее данные, тем больше конфликтов и пучков; параметр K (в LightGBM — max_conflict_rate) разрешает немного конфликтов ради меньшего числа пучков: увеличьте его.');
    }
    w.pythonAction(() => 'from gbcourse.rng import Mulberry32\n\np, N, dens, K, mode = ' + s.p + ', 200, ' + py(s.dens) + ', ' + s.K + ', "' + s.mode + '"\nrng = Mulberry32(' + s.seed + ')\nnz = [[0] * p for _ in range(N)]\nfor r in range(N):\n    if mode == "onehot":\n        nz[r][rng.randint(p)] = 1\n    else:\n        for j in range(p):\n            nz[r][j] = 1 if rng.random() < dens else 0\n\nedges = {(a, b) for a in range(p) for b in range(a + 1, p) if sum(row[a] * row[b] for row in nz) > K}\nadj = lambda u, v: (min(u, v), max(u, v)) in edges\ndeg = [sum(adj(i, j) for j in range(p) if j != i) for i in range(p)]\nbundles = []\nfor v in sorted(range(p), key=lambda i: (-deg[i], i)):\n    for b in bundles:\n        if not any(adj(u, v) for u in b):\n            b.append(v)\n            break\n    else:\n        bundles.append([v])\nprint("рёбер:", len(edges), "пучков:", len(bundles), [sorted(f"f{i + 1}" for i in b) for b in bundles])\n');
    draw();
  });

  /* ==============================================================================
   * 28. Паросочетания в двудольном графе: алгоритм Куна и теорема Холла
   * ============================================================================== */
  const MATCH = {
    ok: { label: 'всех можно занять', adj: [[0, 1], [0], [1, 2, 3], [2, 4], [3]] },
    hall: { label: 'нарушено условие Холла', adj: [[0, 1], [0], [0, 1], [2, 3, 4], [3]] },
  };
  function kuhn(adj) {
    const nL = adj.length;
    const nR = 5;
    const mR = new Array(nR).fill(-1);
    const steps = [];
    for (let v = 0; v < nL; v++) {
      const seenR = new Set();
      const seenL = new Set([v]);
      const path = [];
      const tryK = (u) => {
        for (const r of adj[u]) {
          if (seenR.has(r)) continue;
          seenR.add(r);
          path.push([u, r]);
          if (mR[r] < 0) {
            mR[r] = u;
            return true;
          }
          const owner = mR[r];
          seenL.add(owner);
          path.push([owner, r, 'old']);
          if (tryK(owner)) {
            mR[r] = u;
            return true;
          }
          path.pop();
          path.pop();
        }
        return false;
      };
      const ok = tryK(v);
      steps.push({ v, ok, path: path.slice(), match: mR.slice(), S: [...seenL], NS: [...seenR] });
    }
    return steps;
  }
  GBC.widget('matching', (el) => {
    const s = { pre: 'ok', k: 5 };
    const w = ui.shell(el, { title: 'Паросочетание: каждому сотруднику — своя задача', sub: 'Слева сотрудники, справа задачи; ребро — «умеет делать». Алгоритм Куна по очереди пытается занять каждого сотрудника, при необходимости перекладывая задачи по увеличивающему пути.' });
    ui.segmented(w.controls, { label: 'Пример', value: s.pre, options: Object.keys(MATCH).map((k) => ({ value: k, label: MATCH[k].label })), onChange: (v) => ((s.pre = v), pl.stop(), pl.set(5), (s.k = 5), draw()) });
    const pl = ui.player(w.controls, { label: 'Обработано сотрудников', min: 0, max: 5, value: 5, fps: 0.8, format: (k) => k + ' из 5', onChange: (k) => ((s.k = k), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 312 });
    w.main.appendChild(legendRow([['model', 'в паросочетании', 'line'], ['tree', 'увеличивающий путь', 'line'], ['red', 'множество S и его соседи N(S)']]));
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'размер паросочетания' }, { key: 'last', label: 'последний шаг' }, { key: 'hall', label: 'условие Холла' }]);
    function draw() {
      const A = MATCH[s.pre].adj;
      const steps = kuhn(A);
      const k = s.k;
      const cur = k > 0 ? steps[k - 1] : null;
      const match = cur ? cur.match : new Array(5).fill(-1);
      const L = U.range(5).map((i) => [110, 35 + i * 56]);
      const R = U.range(5).map((i) => [410, 35 + i * 56]);
      const failS = cur && !cur.ok ? cur : null;
      const nodes = L.map(([x, y], i) => ({ x, y, r: 16, label: 'С' + (i + 1), size: 12, fill: failS && failS.S.includes(i) ? 'red' : cur && cur.v === i ? 'tree' : match.includes(i) ? 'model' : null, fillP: 35, color: failS && failS.S.includes(i) ? 'red' : 'model' }))
        .concat(R.map(([x, y], j) => ({ x, y, r: 16, label: 'З' + (j + 1), size: 12, shape: 'square', fill: failS && failS.NS.includes(j) ? 'red' : match[j] >= 0 ? 'model' : null, fillP: 35, color: failS && failS.NS.includes(j) ? 'red' : 'model' })));
      const edges = [];
      A.forEach((rs, u) => rs.forEach((r) => {
        const inM = match[r] === u;
        const onPath = cur && cur.ok && cur.path.some((p) => p[0] === u && p[1] === r);
        edges.push({ a: u, b: 5 + r, color: onPath ? 'tree' : inM ? 'model' : 'muted', width: onPath ? 4 : inM ? 3.6 : 1.6, dash: onPath && !inM });
      }));
      gv.draw({ nodes, edges, texts: [{ x: 110, y: 300, text: 'сотрудники', color: 'ink2', size: 12 }, { x: 410, y: 300, text: 'задачи', color: 'ink2', size: 12 }] });
      const size = match.filter((x) => x >= 0).length;
      const desc = (stp) => 'С' + (stp.v + 1) + ': ' + (stp.ok ? (stp.path.length > 1 ? 'увеличивающий путь ' + stp.path.map((p) => (p[2] ? 'З' + (p[1] + 1) + '←С' + (p[0] + 1) : 'С' + (p[0] + 1) + '→З' + (p[1] + 1))).join(', ') + ' — задачи переложены' : 'свободная задача З' + (stp.path[0][1] + 1)) : 'не удалось: сотрудники {' + stp.S.map((i) => 'С' + (i + 1)).join(', ') + '} умеют только {' + stp.NS.map((j) => 'З' + (j + 1)).join(', ') + '}');
      line.textContent = steps.slice(0, k).map(desc).join('\n') || 'Нажмите ▶.';
      st.set('m', size + ' из 5');
      st.set('last', cur ? (cur.ok ? 'путь найден' : 'тупик') : '—');
      st.set('hall', steps.every((x) => x.ok) ? 'выполнено' : '|S| = ' + steps.find((x) => !x.ok).S.length + ' > |N(S)| = ' + steps.find((x) => !x.ok).NS.length);
      note.innerHTML = '<b>Увеличивающий путь</b> начинается в свободном сотруднике, чередует рёбра «не в паросочетании / в паросочетании» и кончается в свободной задаче. Переключив все его рёбра, получаем паросочетание на одно ребро больше (теорема Бержа: паросочетание максимально ⇔ увеличивающих путей нет). Каждый поиск — один DFS, итого O(|V|·|E|). ' + (s.pre === 'hall' ? '<b>Теорема Холла:</b> занять всех сотрудников можно тогда и только тогда, когда любые k сотрудников вместе умеют хотя бы k задач. Здесь трое (С1, С2, С3) умеют только две задачи — кто-то обязательно останется без работы, максимум 4.' : 'Это частный случай <b>потока</b> (шаг 29): исток → сотрудники → задачи → сток, все ёмкости 1. Так распределяют заказы курьерам, рекламу — по показам, студентов — по проектам.');
    }
    w.pythonAction(() => 'import numpy as np\nfrom scipy.sparse import csr_matrix\nfrom scipy.sparse.csgraph import maximum_bipartite_matching\n\nadj = ' + pyList(MATCH[s.pre].adj) + '   # adj[сотрудник] = список задач\nmatch_task = [-1] * 5\n\ndef try_kuhn(u, seen):\n    for t in adj[u]:\n        if t not in seen:\n            seen.add(t)\n            if match_task[t] < 0 or try_kuhn(match_task[t], seen):\n                match_task[t] = u\n                return True\n    return False\n\nsize = sum(try_kuhn(u, set()) for u in range(5))\nprint("паросочетание:", size, {f"З{t + 1}": f"С{u + 1}" for t, u in enumerate(match_task) if u >= 0})\nB = np.zeros((5, 5))\nfor u, ts in enumerate(adj):\n    B[u, ts] = 1\nprint("scipy:", (maximum_bipartite_matching(csr_matrix(B), perm_type="column") >= 0).sum())\n');
    draw();
  });

  /* ==============================================================================
   * 29. Потоки и разрезы: алгоритм Эдмондса — Карпа
   * ============================================================================== */
  const FG = {
    names: ['s', 'a', 'b', 'c', 'd', 't'],
    pos: [[40, 150], [190, 50], [190, 250], [340, 50], [340, 250], [480, 150]],
    edges: [[0, 1, 10], [0, 2, 8], [1, 2, 3], [1, 3, 6], [2, 4, 9], [3, 5, 8], [4, 5, 10], [4, 3, 2]],
  };
  function edmondsKarp() {
    const m = FG.edges.length;
    const f = new Array(m).fill(0);
    const steps = [];
    for (;;) {
      const prev = new Array(6).fill(null);
      prev[0] = [-1, 0];
      const q = [0];
      while (q.length && !prev[5]) {
        const u = q.shift();
        FG.edges.forEach(([a, b, c], id) => {
          if (a === u && !prev[b] && c - f[id] > 0) (prev[b] = [id, 1]), q.push(b);
          if (b === u && !prev[a] && f[id] > 0) (prev[a] = [id, -1]), q.push(a);
        });
      }
      if (!prev[5]) break;
      const path = [];
      let v = 5;
      let bott = Infinity;
      while (v !== 0) {
        const [id, dir] = prev[v];
        path.unshift([id, dir]);
        bott = Math.min(bott, dir > 0 ? FG.edges[id][2] - f[id] : f[id]);
        v = dir > 0 ? FG.edges[id][0] : FG.edges[id][1];
      }
      path.forEach(([id, dir]) => (f[id] += dir * bott));
      steps.push({ path, bott, f: f.slice() });
    }
    const reach = new Set([0]);
    const q = [0];
    while (q.length) {
      const u = q.shift();
      FG.edges.forEach(([a, b, c], id) => {
        if (a === u && !reach.has(b) && c - f[id] > 0) (reach.add(b), q.push(b));
        if (b === u && !reach.has(a) && f[id] > 0) (reach.add(a), q.push(a));
      });
    }
    return { steps, reach };
  }
  GBC.widget('max-flow', (el) => {
    const R = edmondsKarp();
    const P = R.steps.length;
    const s = { k: 0, resid: false };
    const w = ui.shell(el, { title: 'Максимальный поток и минимальный разрез', sub: 'Сколько воды (данных, товаров) можно прогнать из s в t, если у каждой трубы своя пропускная способность? На рёбрах — «поток / ёмкость». Каждый шаг — увеличивающий путь, найденный обходом BFS.' });
    ui.player(w.controls, { label: 'Увеличивающий путь', min: 0, max: P, value: 0, fps: 0.8, format: (k) => (k < P ? 'путей: ' + k : 'готово'), onChange: (k) => ((s.k = k), draw()) });
    ui.toggle(w.controls, { label: 'Показать остаточную сеть', checked: false, onChange: (v) => ((s.resid = v), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 300 });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'величина потока' }, { key: 'b', label: 'узкое место пути' }, { key: 'cut', label: 'ёмкость разреза' }]);
    function draw() {
      const f = s.k ? R.steps[s.k - 1].f : FG.edges.map(() => 0);
      const done = s.k === P;
      const cutE = FG.edges.filter(([a, b]) => R.reach.has(a) && !R.reach.has(b));
      const path = s.k && !done ? R.steps[s.k - 1].path.map(([id]) => id) : [];
      let edges;
      if (s.resid) {
        edges = [];
        FG.edges.forEach(([a, b, c], id) => {
          if (c - f[id] > 0) edges.push({ a, b, arrow: true, bend: f[id] > 0 ? 12 : 0, color: 'model', width: 2, label: String(c - f[id]) });
          if (f[id] > 0) edges.push({ a: b, b: a, arrow: true, bend: c - f[id] > 0 ? 12 : 0, color: 'tree', width: 2, dash: true, label: String(f[id]) });
        });
      } else {
        edges = FG.edges.map((e, id) => ({ a: e[0], b: e[1], arrow: true, color: path.includes(id) ? 'aqua' : f[id] === e[2] ? 'tree' : f[id] > 0 ? 'model' : 'muted', width: path.includes(id) ? 4.2 : f[id] === e[2] ? 3.6 : f[id] > 0 ? 3 : 1.6, label: f[id] + '/' + e[2], lbold: done && cutE.includes(e), lcolor: done && cutE.includes(e) ? 'critical' : 'ink' }));
      }
      gv.draw({
        nodes: FG.pos.map(([x, y], i) => ({ x, y, r: 16, label: FG.names[i], fill: done ? (R.reach.has(i) ? 'blue' : 'orange') : null, fillP: 35 })),
        edges,
      });
      const value = FG.edges.reduce((acc, e, id) => acc + (e[0] === 0 ? f[id] : 0), 0);
      const cutCap = U.sum(cutE.map((e) => e[2]));
      const pathStr = (st0) => 's' + st0.path.map(([id, dir]) => (dir > 0 ? ' → ' : ' ⇠ ') + FG.names[dir > 0 ? FG.edges[id][1] : FG.edges[id][0]]).join('');
      line.textContent = (R.steps.slice(0, s.k).map((st0, i) => (i + 1) + ') ' + pathStr(st0) + '   +' + st0.bott).join('\n') || 'Поток пока нулевой.') +
        (done ? '\nРазрез: S = {' + [...R.reach].map((i) => FG.names[i]).join(', ') + '}, рёбра ' + cutE.map(([a, b, c]) => FG.names[a] + '→' + FG.names[b] + ' (' + c + ')').join(', ') : '');
      st.set('v', String(value));
      st.set('b', s.k ? String(R.steps[s.k - 1].bott) : '—');
      st.set('cut', done ? String(cutCap) : '—');
      note.innerHTML = 'Пока в <b>остаточной сети</b> есть путь из s в t, по нему можно пустить ещё поток — столько, сколько позволяет самое узкое место. Остаточная сеть (переключатель) содержит запасы прямых рёбер и «обратные» рёбра (пунктир): поток можно частично отменить, перенаправив его. Когда путей нет, вершины, достижимые из s, образуют <b>разрез</b>. <b>Теорема Форда — Фалкерсона:</b> максимальный поток равен минимальной ёмкости разреза — здесь 15 = 6 + 9. Весь поток обязан пересечь любой разрез, поэтому «поток ≤ разрез» очевидно; удивительно, что достигается равенство. Выбирая кратчайшие пути (BFS), алгоритм Эдмондса — Карпа останавливается за O(|V|·|E|²).';
    }
    w.pythonAction(() => 'import numpy as np\nfrom scipy.sparse import csr_matrix\nfrom scipy.sparse.csgraph import maximum_flow\n\nnames = "sabcdt"\nedges = ' + pyList(FG.edges) + '\ncap = np.zeros((6, 6), dtype=np.int32)\nfor a, b, c in edges:\n    cap[a, b] = c\nres = maximum_flow(csr_matrix(cap), 0, 5)\nprint("максимальный поток:", res.flow_value)\nF = res.flow.toarray()\nfor a, b, c in edges:\n    print(f"{names[a]}→{names[b]}: {F[a, b]}/{c}")\n');
    draw();
  });

  /* ==============================================================================
   * 30. Степени матрицы смежности: число маршрутов
   * ============================================================================== */
  const WK = { names: 'ABCDE'.split(''), pos: [[80, 70], [80, 230], [240, 150], [400, 70], [400, 230]], edges: [[0, 1], [0, 2], [1, 2], [2, 3], [2, 4], [3, 4]] };
  GBC.widget('walk-count', (el) => {
    const n = 5;
    const s = { k: 2, i: 0, j: 0 };
    const w = ui.shell(el, { title: 'Степени матрицы смежности считают маршруты', sub: 'Элемент (Aᵏ)ᵢⱼ — число маршрутов длины k из i в j (вершины и рёбра могут повторяться). Щёлкните по ячейке матрицы — увидите сами маршруты.' });
    ui.slider(w.controls, { label: 'Длина маршрута k', min: 1, max: 6, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 290 });
    const tbl = H('div');
    const line = monoBox();
    w.main.append(tbl, line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'cell', label: 'выбранная ячейка' }, { key: 'tri', label: 'треугольников tr(A³)/6' }, { key: 'sum', label: 'всего маршрутов длины k' }]);
    const A = U.range(n).map(() => new Array(n).fill(0));
    WK.edges.forEach(([a, b]) => (A[a][b] = A[b][a] = 1));
    const mul = (X, Y) => X.map((r) => U.range(n).map((j) => U.sum(r.map((v, t) => v * Y[t][j]))));
    function draw() {
      let P = A;
      for (let t = 1; t < s.k; t++) P = mul(P, A);
      const A3 = mul(mul(A, A), A);
      const walks = [];
      (function rec(path) {
        if (walks.length >= 40) return;
        if (path.length === s.k + 1) return void (path[path.length - 1] === s.j && walks.push(path.slice()));
        for (let u = 0; u < n; u++) if (A[path[path.length - 1]][u]) (path.push(u), rec(path), path.pop());
      })([s.i]);
      const first = walks[0] || [];
      const onW = (e) => first.some((v, t) => t > 0 && ((first[t - 1] === e[0] && v === e[1]) || (first[t - 1] === e[1] && v === e[0])));
      gv.draw({
        nodes: WK.pos.map(([x, y], i) => ({ x, y, r: 17, label: WK.names[i], fill: i === s.i ? 'model' : i === s.j ? 'tree' : null, fillP: 40, color: i === s.i ? 'model' : i === s.j ? 'tree' : 'model', width: i === s.i || i === s.j ? 3 : 2, side: 'deg ' + U.sum(A[i]), sideSize: 11 })),
        edges: WK.edges.map((e) => ({ a: e[0], b: e[1], color: onW(e) ? 'tree' : 'ink2', width: onW(e) ? 4 : 2 })),
      });
      cellTable(tbl, ['A' + (s.k > 1 ? GBC.lesson1518.sup(s.k) : '')].concat(WK.names), U.range(n).map((i) => [WK.names[i]].concat(P[i].map((v, j) => ({ t: v, hl: i === s.i && j === s.j ? 'tree' : null, bold: i === j })))), { compact: true, click: (i, j) => ((s.i = i), (s.j = j), draw()) });
      line.textContent = 'Маршруты длины ' + s.k + ' из ' + WK.names[s.i] + ' в ' + WK.names[s.j] + ' (' + P[s.i][s.j] + '):\n' + (walks.slice(0, 18).map((p) => p.map((v) => WK.names[v]).join('')).join('  ') || 'нет') + (P[s.i][s.j] > 18 ? '  …' : '') + '\nОранжевым на графе — первый из них.';
      st.set('cell', '(A' + GBC.lesson1518.sup(s.k) + ')' + WK.names[s.i] + WK.names[s.j] + ' = ' + P[s.i][s.j]);
      st.set('tri', String(U.sum(U.range(n).map((i) => A3[i][i])) / 6));
      st.set('sum', num(U.sum(P.map((r) => U.sum(r)))));
      note.innerHTML = 'Почему так? Маршрут длины k из i в j — это маршрут длины k − 1 из i в какую-то вершину t, плюс ребро t–j. Поэтому (A<sup>k</sup>)<sub>ij</sub> = Σ<sub>t</sub> (A<sup>k−1</sup>)<sub>it</sub>·A<sub>tj</sub> — ровно правило умножения матриц. Отсюда: диагональ A² — степени вершин (сходить к соседу и вернуться); диагональ A³ считает замкнутые маршруты длины 3 — каждый треугольник даёт 6 таких (3 стартовые вершины × 2 направления), поэтому треугольников tr(A³)/6. Число маршрутов растёт как λ<sub>max</sub><sup>k</sup>, где λ<sub>max</sub> — наибольшее собственное значение A (урок 15.12).';
    }
    w.pythonAction(() => 'import numpy as np\n\nnames = "ABCDE"\nedges = ' + pyList(WK.edges) + '\nA = np.zeros((5, 5), dtype=int)\nfor a, b in edges:\n    A[a, b] = A[b, a] = 1\nk = ' + s.k + '\nP = np.linalg.matrix_power(A, k)\nprint(P)\nprint("маршрутов длины", k, "из ' + WK.names[s.i] + ' в ' + WK.names[s.j] + ':", P[' + s.i + ', ' + s.j + '])\nprint("треугольников:", np.trace(A @ A @ A) // 6)\nprint("λ_max =", round(max(np.linalg.eigvalsh(A)), 4))\n');
    draw();
  });

  /* ==============================================================================
   * 31. PageRank: степенной метод и случайный пользователь
   * ============================================================================== */
  const RG = {
    names: 'ABCDEF'.split(''),
    pos: [[100, 70], [260, 40], [260, 165], [430, 70], [410, 250], [110, 250]],
    out: [[1, 2], [2], [0], [2], [2, 3], [0, 4]],
  };
  function pagerank(d, iters) {
    const n = RG.names.length;
    let r = new Array(n).fill(1 / n);
    let delta = 0;
    for (let t = 0; t < iters; t++) {
      const nr = new Array(n).fill((1 - d) / n);
      RG.out.forEach((outs, a) => outs.forEach((b) => (nr[b] += (d * r[a]) / outs.length)));
      delta = U.sum(nr.map((v, i) => Math.abs(v - r[i])));
      r = nr;
    }
    return { r, delta };
  }
  function surfer(d, steps, seed) {
    const rng = new GBC.RNG(seed);
    const n = RG.names.length;
    const cnt = new Array(n).fill(0);
    let v = rng.randint(n);
    for (let t = 0; t < steps; t++) {
      v = rng.random() < d ? RG.out[v][rng.randint(RG.out[v].length)] : rng.randint(n);
      cnt[v]++;
    }
    return { freq: cnt.map((c) => c / steps), last: v };
  }
  GBC.widget('pagerank', (el) => {
    const s = { d: 0.85, t: 0, mode: 'power', steps: 1000, seed: 1 };
    const w = ui.shell(el, { title: 'PageRank: важность через случайное блуждание', sub: 'Пользователь щёлкает по случайной ссылке со страницы, а с вероятностью 1 − d прыгает на случайную страницу. Ранг — доля времени, которую он проводит на странице.' });
    ui.segmented(w.controls, { label: 'Как считать', value: s.mode, options: [{ value: 'power', label: 'степенной метод' }, { value: 'walk', label: 'моделирование блуждания' }], onChange: (v) => ((s.mode = v), sync()) });
    const pl = ui.player(w.controls, { label: 'Итерация', min: 0, max: 30, value: 0, fps: 2, format: (k) => 't = ' + k, onChange: (k) => ((s.t = k), draw()) });
    const ss = ui.slider(w.controls, { label: 'Шагов блуждания', values: [10, 30, 100, 300, 1000, 3000, 10000, 30000], value: s.steps, format: (v) => num(v), onInput: (v) => ((s.steps = v), draw()) });
    ui.slider(w.controls, { label: 'Затухание d', min: 0.5, max: 0.95, step: 0.05, value: s.d, onInput: (v) => ((s.d = v), draw()) });
    const sb = ui.button(w.controls, { label: 'Другое блуждание', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 290 });
    const bars = new GBC.Plot(w.main, { height: 170, x: { label: 'страница', domain: [0.4, 6.6], ticks: [] }, y: { label: 'ранг', domain: [0, 0.5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'C', label: 'ранг C' }, { key: 'F', label: 'ранг F' }, { key: 'dl', label: 'изменение за шаг / ошибка' }]);
    function sync() {
      pl.el.style.display = s.mode === 'power' ? '' : 'none';
      ss.el.style.display = s.mode === 'walk' ? '' : 'none';
      sb.style.display = s.mode === 'walk' ? '' : 'none';
      draw();
    }
    function draw() {
      const exact = pagerank(s.d, 200).r;
      const P = pagerank(s.d, s.t);
      const W = s.mode === 'walk' ? surfer(s.d, s.steps, s.seed) : null;
      const r = s.mode === 'walk' ? W.freq : P.r;
      const best = U.argmax(r);
      const E = [];
      RG.out.forEach((outs, a) => outs.forEach((b) => E.push([a, b])));
      gv.draw({
        nodes: RG.pos.map(([x, y], i) => ({ x, y, r: 11 + 30 * Math.sqrt(r[i]), label: RG.names[i], fill: i === best ? 'tree' : 'model', fillP: 30, color: i === best ? 'tree' : 'model', sub: f3(r[i]), subDy: 10 })),
        edges: E.map(([a, b]) => ({ a, b, arrow: true, color: 'ink2', width: 1.8, bend: E.some((e) => e[0] === b && e[1] === a) ? 14 : 0 })),
      });
      const xs = U.range(6, 1);
      bars.render([
        { type: 'bars', x: xs.map((x) => x - (s.mode === 'walk' ? 0.17 : 0)), y: r, color: s.mode === 'walk' ? 'tree' : 'model', width: s.mode === 'walk' ? 0.32 : 0.6, maxPx: 34, label: s.mode === 'walk' ? 'доля посещений' : 'ранг' },
        ...(s.mode === 'walk' ? [{ type: 'bars', x: xs.map((x) => x + 0.17), y: exact, color: 'model', width: 0.32, maxPx: 34, label: 'точный PageRank' }] : []),
        { type: 'text', items: xs.map((x, i) => ({ x, y: Math.max(r[i], s.mode === 'walk' ? exact[i] : 0), dy: -6, anchor: 'middle', text: RG.names[i] })) },
      ]);
      st.set('C', f3(r[2]));
      st.set('F', f3(r[5]));
      st.set('dl', s.mode === 'walk' ? 'макс. |ошибка| ' + f3(Math.max(...r.map((v, i) => Math.abs(v - exact[i])))) : s.t ? U.fmt(P.delta, 2) : '—');
      note.innerHTML = s.mode === 'power'
        ? 'Формула r<sub>j</sub> = (1 − d)/n + d·Σ r<sub>i</sub>/out<sub>i</sub> (по страницам i, ссылающимся на j). Начинаем с равных рангов и повторяем — это <b>степенной метод</b>: r сходится к собственному вектору «матрицы Google» с собственным значением 1 (урок 15.12) — стационарному распределению цепи Маркова (урок 15.13). Ошибка убывает примерно как d<sup>t</sup>. На C ссылаются четыре страницы, её ранг наибольший; на F не ссылается никто — её ранг ровно (1 − d)/n = ' + f3((1 - s.d) / 6) + '. Прыжки нужны, чтобы блуждание не застряло в «тупике» или замкнутой группе страниц (шаг 24).'
        : 'Тот же ответ можно получить, просто <b>смоделировав</b> пользователя: оранжевые столбцы — доли времени на страницах за ' + num(s.steps) + ' шагов, синие — точный PageRank. По закону больших чисел частоты сходятся к рангам, ошибка убывает как 1/√(число шагов) — в 10 раз больше шагов дают ошибку примерно в 3 раза меньше. Так PageRank приближают на гигантских графах: запускают множество коротких блужданий.';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\nnames = "ABCDEF"\nout = {' + RG.out.map((o, a) => '"' + RG.names[a] + '": "' + o.map((b) => RG.names[b]).join('') + '"').join(', ') + '}\nn, d = 6, ' + py(s.d) + '\nM = np.zeros((n, n))\nfor a, bs in out.items():\n    for b in bs:\n        M[names.index(b), names.index(a)] = 1 / len(bs)\n\nr = np.full(n, 1 / n)\nfor _ in range(200):\n    r = (1 - d) / n + d * M @ r\nprint("степенной метод:", dict(zip(names, r.round(4))))\n\nrng, steps = Mulberry32(' + s.seed + '), ' + s.steps + '\ncnt = np.zeros(n)\nv = rng.randint(n)\nfor _ in range(steps):\n    v = names.index(out[names[v]][rng.randint(len(out[names[v]]))]) if rng.random() < d else rng.randint(n)\n    cnt[v] += 1\nprint("блуждание:     ", dict(zip(names, (cnt / steps).round(4))))\n');
    sync();
  });

  /* ==============================================================================
   * 32. Центральности: кто важен в сети
   * ============================================================================== */
  const CG = {
    pos: [[30, 70], [30, 230], [110, 110], [100, 240], [170, 160], [230, 140], [290, 140], [350, 160], [400, 240], [410, 90], [480, 180], [480, 40]],
    edges: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [3, 4], [2, 4], [4, 5], [5, 6], [6, 7], [7, 8], [7, 9], [8, 9], [8, 10], [9, 10], [10, 11], [9, 11]],
  };
  function centralities() {
    const n = 12;
    const adj = adjList(n, CG.edges);
    const deg = adj.map((a) => a.length);
    const clo = U.range(n).map((s0) => (n - 1) / U.sum(bfsDist(adj, s0)));
    const bc = new Array(n).fill(0);
    for (let s0 = 0; s0 < n; s0++) {
      const Sx = [];
      const P = U.range(n).map(() => []);
      const sig = new Array(n).fill(0);
      const d = new Array(n).fill(-1);
      sig[s0] = 1;
      d[s0] = 0;
      const q = [s0];
      while (q.length) {
        const v = q.shift();
        Sx.push(v);
        adj[v].forEach((u) => {
          if (d[u] < 0) (d[u] = d[v] + 1), q.push(u);
          if (d[u] === d[v] + 1) (sig[u] += sig[v]), P[u].push(v);
        });
      }
      const delta = new Array(n).fill(0);
      while (Sx.length) {
        const u = Sx.pop();
        P[u].forEach((v) => (delta[v] += (sig[v] / sig[u]) * (1 + delta[u])));
        if (u !== s0) bc[u] += delta[u];
      }
    }
    const norm = ((n - 1) * (n - 2)) / 2;
    const btw = bc.map((b) => b / 2 / norm);
    let r = new Array(n).fill(1 / n);
    for (let t = 0; t < 100; t++) {
      const nr = new Array(n).fill(0.15 / n);
      adj.forEach((nb, a) => nb.forEach((b) => (nr[b] += (0.85 * r[a]) / nb.length)));
      r = nr;
    }
    return { deg, clo, btw, pr: r };
  }
  GBC.widget('centrality', (el) => {
    const C = centralities();
    const s = { m: 'btw' };
    const MEAS = { deg: 'степень', clo: 'близость', btw: 'посредничество', pr: 'PageRank' };
    const w = ui.shell(el, { title: 'Центральности: кто важен в сети', sub: 'Две группы друзей связаны цепочкой через вершины 6 и 7. Размер кружка — значение выбранной меры. Разные меры отвечают на разные вопросы о «важности».' });
    ui.segmented(w.controls, { label: 'Мера', value: s.m, options: Object.keys(MEAS).map((k) => ({ value: k, label: MEAS[k] })), onChange: (v) => ((s.m = v), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 280 });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'top', label: 'лидер' }, { key: 'v', label: 'значение' }]);
    const TXT = {
      deg: '<b>Степень</b> — число связей. Самые «общительные» — 3 и 10 (по 4 друга), а мостовые 6 и 7 — всего по 2. Степень видит только ближайших соседей.',
      clo: '<b>Близость</b> (closeness) = (n − 1) / сумма расстояний до всех: насколько быстро вершина «дотягивается» до всей сети. Мостовые 6 и 7 — в центре: от них до всех ближе всего.',
      btw: '<b>Посредничество</b> (betweenness) — доля кратчайших путей между другими парами, проходящих через вершину. Через 6 и 7 идут все пути между группами — их посредничество 0.545, хотя степень минимальная. Это «брокеры»: в сетях переводов так выглядят счета-посредники. Алгоритм Брандеса считает его за O(|V|·|E|): один BFS из каждой вершины и обратный проход.',
      pr: '<b>PageRank</b> — важность через важность соседей (шаг 31). В неориентированном графе он близок к степени: лидируют 3 и 10.',
    };
    function draw() {
      const v = C[s.m];
      const mx = Math.max(...v);
      const top = U.argmax(v);
      gv.draw({
        nodes: CG.pos.map(([x, y], i) => ({ x, y, r: 11 + 13 * (v[i] / mx), label: String(i + 1), size: 12, fill: Math.abs(v[i] - mx) < 1e-12 ? 'tree' : 'model', fillP: 20 + 40 * (v[i] / mx), color: Math.abs(v[i] - mx) < 1e-12 ? 'tree' : 'model' })),
        edges: CG.edges.map((e) => ({ a: e[0], b: e[1], color: 'ink2', width: 1.8 })),
      });
      const rows = U.range(12).sort((a, b) => C[s.m][b] - C[s.m][a]).map((i) => [String(i + 1), String(C.deg[i]), f3(C.clo[i]), f3(C.btw[i]), f3(C.pr[i])]);
      tbl.textContent = '';
      ui.table(tbl, { columns: ['№', 'степень', 'близость', 'посредн.', 'PageRank'], numeric: true, rows, highlight: (i) => i < 2 });
      st.set('top', U.range(12).filter((i) => Math.abs(v[i] - mx) < 1e-9).map((i) => i + 1).join(' и '));
      st.set('v', f3(v[top]));
      note.innerHTML = TXT[s.m] + ' Центральности — готовые <b>графовые признаки</b> для бустинга (шаг 38): в таблицу кладут сразу несколько, а модель сама выбирает полезные.';
    }
    w.pythonAction(() => 'from collections import deque\n\nedges = ' + pyList(CG.edges.map((e) => [e[0] + 1, e[1] + 1])) + '\nn = 12\nadj = {v: [] for v in range(1, n + 1)}\nfor a, b in edges:\n    adj[a].append(b)\n    adj[b].append(a)\n\ndef bfs(s):\n    dist, sigma, order, q = {s: 0}, {s: 1}, [], deque([s])\n    preds = {v: [] for v in adj}\n    while q:\n        v = q.popleft()\n        order.append(v)\n        for u in adj[v]:\n            if u not in dist:\n                dist[u] = dist[v] + 1\n                sigma[u] = 0\n                q.append(u)\n            if dist[u] == dist[v] + 1:\n                sigma[u] += sigma[v]\n                preds[u].append(v)\n    return dist, sigma, order, preds\n\nbetween = {v: 0.0 for v in adj}\nfor s in adj:                                  # алгоритм Брандеса\n    dist, sigma, order, preds = bfs(s)\n    delta = {v: 0.0 for v in adj}\n    for u in reversed(order):\n        for v in preds[u]:\n            delta[v] += sigma[v] / sigma[u] * (1 + delta[u])\n        if u != s:\n            between[u] += delta[u]\nnorm = (n - 1) * (n - 2)\nfor v in adj:\n    clo = (n - 1) / sum(bfs(v)[0].values())\n    print(f"{v:2}: степень {len(adj[v])}, близость {clo:.3f}, посредничество {between[v] / norm:.3f}")\n');
    draw();
  });

  /* ==============================================================================
   * 33. Спектр графа: лапласиан и вектор Фидлера
   * ============================================================================== */
  function jacobiEigen(M) {
    const n = M.length;
    const a = M.map((r) => r.slice());
    const V = U.range(n).map((i) => U.range(n).map((j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-22) break;
      for (let p = 0; p < n - 1; p++) {
        for (let q = p + 1; q < n; q++) {
          if (Math.abs(a[p][q]) < 1e-15) continue;
          const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
          const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          const c = 1 / Math.sqrt(t * t + 1);
          const sn = t * c;
          for (let k = 0; k < n; k++) {
            const akp = a[k][p];
            const akq = a[k][q];
            a[k][p] = c * akp - sn * akq;
            a[k][q] = sn * akp + c * akq;
          }
          for (let k = 0; k < n; k++) {
            const apk = a[p][k];
            const aqk = a[q][k];
            a[p][k] = c * apk - sn * aqk;
            a[q][k] = sn * apk + c * aqk;
          }
          for (let k = 0; k < n; k++) {
            const vkp = V[k][p];
            const vkq = V[k][q];
            V[k][p] = c * vkp - sn * vkq;
            V[k][q] = sn * vkp + c * vkq;
          }
        }
      }
    }
    const order = U.range(n).sort((i, j) => a[i][i] - a[j][j]);
    return { vals: order.map((i) => a[i][i]), vecs: order.map((i) => V.map((row) => row[i])) };
  }
  function sbm(n, pin, pout, seed) {
    const rng = new GBC.RNG(seed);
    const truth = U.range(n).map((i) => (i < n / 2 ? 0 : 1));
    const E = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rng.random() < (truth[i] === truth[j] ? pin : pout)) E.push([i, j]);
    return { truth, E };
  }
  const twoRings = (n) => U.range(n).map((i) => {
    const k = i % (n / 2);
    const ang = (2 * Math.PI * k) / (n / 2);
    return [(i < n / 2 ? 135 : 385) + 95 * Math.sin(ang), 135 + 95 * Math.cos(ang)];
  });
  GBC.widget('spectral', (el) => {
    const n = 16;
    const s = { pin: 0.7, pout: 0.1, seed: 1 };
    const pos = twoRings(n);
    const w = ui.shell(el, { title: 'Спектральная кластеризация: лапласиан графа', sub: 'Две группы по 8 вершин (круги и квадраты): внутри группы ребро с вероятностью p_in, между группами — p_out. Цвет — знак вектора Фидлера: так спектр делит граф на две части, не зная групп.' });
    ui.slider(w.controls, { label: 'p_{in} (внутри групп)', min: 0.2, max: 1, step: 0.05, value: s.pin, onInput: (v) => ((s.pin = v), draw()) });
    ui.slider(w.controls, { label: 'p_{out} (между группами)', min: 0, max: 0.6, step: 0.02, value: s.pout, onInput: (v) => ((s.pout = v), draw()) });
    ui.button(w.controls, { label: 'Новый граф', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 270 });
    const bars = new GBC.Plot(w.main, { height: 180, x: { label: 'вершина (1–8 — группа A, 9–16 — группа B)', domain: [0.4, 16.6], ticks: [1, 4, 8, 9, 12, 16] }, y: { label: 'вектор Фидлера' } });
    const spec = new GBC.Plot(w.main, { height: 150, x: { label: 'номер собственного значения', domain: [0.4, 16.6], ticks: [1, 2, 4, 8, 12, 16] }, y: { label: 'λ' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'l2', label: 'λ₂ (алгебраическая связность)' }, { key: 'z', label: 'нулевых λ = компонент' }, { key: 'acc', label: 'угадано групп' }]);
    function draw() {
      const G = sbm(n, s.pin, s.pout, s.seed);
      const A = U.range(n).map(() => new Array(n).fill(0));
      G.E.forEach(([i, j]) => (A[i][j] = A[j][i] = 1));
      const Lap = A.map((row, i) => row.map((v, j) => (i === j ? U.sum(row) : -v)));
      const { vals, vecs } = jacobiEigen(Lap);
      const fied = vecs[1];
      const side = fied.map((v) => (v >= 0 ? 1 : 0));
      const agree = U.mean(side.map((v, i) => (v === G.truth[i] ? 1 : 0)));
      const acc = Math.max(agree, 1 - agree);
      const zeros = vals.filter((v) => Math.abs(v) < 1e-9).length;
      gv.draw({
        nodes: pos.map(([x, y], i) => ({ x, y, r: 12, shape: G.truth[i] ? 'square' : undefined, label: String(i + 1), size: 10, fill: side[i] ? 'orange' : 'blue', fillP: 45, color: side[i] ? 'orange' : 'blue' })),
        edges: G.E.map(([i, j]) => ({ a: i, b: j, color: G.truth[i] !== G.truth[j] ? 'ink' : 'ink2', width: G.truth[i] !== G.truth[j] ? 2 : 1.3, opacity: 0.7 })),
      });
      bars.render([{ type: 'bars', x: U.range(n, 1), y: fied, color: (i) => (side[i] ? 'orange' : 'blue'), width: 0.7, maxPx: 22 }, { type: 'hline', y: 0, color: 'ink2', width: 1 }]);
      spec.render([{ type: 'bars', x: U.range(n, 1), y: vals.map((v) => Math.max(0, v)), color: (i) => (i === 1 ? 'tree' : 'model'), width: 0.7, maxPx: 22 }]);
      st.set('l2', f3(vals[1]));
      st.set('z', String(zeros));
      st.set('acc', pct(acc, 0));
      note.innerHTML = '<b>Лапласиан</b> L = D − A (D — степени на диагонали). Для любого вектора значений на вершинах xᵀLx = Σ<sub>рёбра</sub>(x<sub>i</sub> − x<sub>j</sub>)²: это «сумма скачков» вдоль рёбер. Отсюда всё: наименьшее собственное значение 0 с постоянным вектором; число нулевых собственных значений равно числу компонент связности; второе, λ₂, показывает, насколько граф «хорошо связан». Собственный вектор λ₂ (<b>вектор Фидлера</b>) — самый «гладкий» непостоянный вектор: он почти постоянен внутри плотных групп и меняется между ними, поэтому его знак делит граф по самому узкому месту. Увеличьте p_out — группы сливаются, λ₂ растёт, а разбиение теряет смысл. При p_out = 0 — две компоненты и два нуля в спектре (вектор для нуля тогда выбирается неоднозначно, компоненты проще найти обходом).';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\nn, pin, pout = 16, ' + py(s.pin) + ', ' + py(s.pout) + '\nrng = Mulberry32(' + s.seed + ')\ntruth = np.array([0] * 8 + [1] * 8)\nA = np.zeros((n, n))\nfor i in range(n):\n    for j in range(i + 1, n):\n        if rng.random() < (pin if truth[i] == truth[j] else pout):\n            A[i, j] = A[j, i] = 1\nL = np.diag(A.sum(1)) - A\nvals, vecs = np.linalg.eigh(L)\nfiedler = vecs[:, 1]\nside = (fiedler >= 0).astype(int)\nprint("спектр:", vals.round(3))\nprint("λ2 =", round(vals[1], 3), " угадано:", max((side == truth).mean(), (side != truth).mean()))\n');
    draw();
  });

  /* ==============================================================================
   * 34. Распространение меток по графу (гармоническая функция)
   * ============================================================================== */
  GBC.widget('label-propagation', (el) => {
    const n = 20;
    const s = { t: 30, seed: 3, lab: { 0: 0, 4: 0, 10: 1, 15: 1 } };
    const pos = twoRings(n);
    const w = ui.shell(el, { title: 'Распространение меток: соседи «голосуют»', sub: 'Метки известны лишь у четырёх вершин (жирная обводка). На каждом шаге неразмеченная вершина берёт среднее значение соседей. Щёлкайте по вершинам, чтобы ставить и снимать метки.' });
    const pl = ui.player(w.controls, { label: 'Итерация', min: 0, max: 30, value: 30, fps: 3, format: (k) => 't = ' + k, onChange: (k) => ((s.t = k), draw()) });
    ui.button(w.controls, { label: 'Другой граф', icon: 'reset', onClick: () => (s.seed++, draw()) });
    const gv = new GraphView(w.main, {
      w: 520, h: 270,
      onNode: (i) => {
        const cur = s.lab[i];
        if (cur === undefined) s.lab[i] = 0;
        else if (cur === 0) s.lab[i] = 1;
        else delete s.lab[i];
        draw();
      },
    });
    w.main.appendChild(legendRow([['blue', 'значение ≈ 0 (класс A)'], ['orange', 'значение ≈ 1 (класс B)'], ['muted', '0.5 — не знаем']]));
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'acc', label: 'верно у неразмеченных' }, { key: 'ch', label: 'изменение за шаг' }, { key: 'lab', label: 'размечено' }]);
    function run(T) {
      const G = sbm(n, 0.45, 0.04, s.seed);
      const adj = adjList(n, G.E);
      let f = U.range(n).map((i) => (s.lab[i] !== undefined ? s.lab[i] : 0.5));
      let ch = 0;
      for (let t = 0; t < T; t++) {
        const g = f.map((v, i) => (s.lab[i] !== undefined || !adj[i].length ? v : U.mean(adj[i].map((u) => f[u]))));
        ch = Math.max(...g.map((v, i) => Math.abs(v - f[i])));
        f = g;
      }
      return { G, f, ch };
    }
    function draw() {
      const R = run(s.t);
      const pal = GBC.colors.proba();
      const un = U.range(n).filter((i) => s.lab[i] === undefined);
      const acc = U.mean(un.map((i) => ((R.f[i] > 0.5 ? 1 : 0) === R.G.truth[i] ? 1 : 0)));
      gv.draw({
        nodes: pos.map(([x, y], i) => {
          const c = GBC.colors.rgbString(pal(R.f[i]));
          return { x, y, r: 13, shape: R.G.truth[i] ? 'square' : undefined, label: s.lab[i] !== undefined ? (s.lab[i] ? 'B' : 'A') : '', size: 11, fill: c, fillP: 85, color: s.lab[i] !== undefined ? 'ink' : c, width: s.lab[i] !== undefined ? 3.4 : 2, sub: s.lab[i] === undefined ? f2(R.f[i]) : '', subSize: 10, subDy: 10 };
        }),
        edges: R.G.E.map(([i, j]) => ({ a: i, b: j, color: 'ink2', width: 1.4, opacity: 0.7 })),
      });
      st.set('acc', un.length ? pct(acc, 0) : '—');
      st.set('ch', s.t ? U.fmt(R.ch, 2) : '—');
      st.set('lab', String(n - un.length) + ' из ' + n);
      note.innerHTML = 'Итерация f<sub>i</sub> ← среднее f по соседям (метки размеченных не меняются) сходится к <b>гармонической функции</b>: значение в каждой вершине — среднее соседей. У неё вероятностный смысл: f<sub>i</sub> — вероятность, что случайное блуждание из i раньше упрётся в вершину с меткой B, чем с меткой A. Это <b>полуобучение</b> (semi-supervised learning): несколько меток + структура графа. Ту же операцию «усреднить по соседям» многократно повторяют графовые нейросети, а для бустинга итоговое f — сильный признак «доля мошенников вокруг», если считать его только по обучающим меткам (шаги 38–39). Форма вершины — истинная группа (круг / квадрат).';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\nn = 20\nrng = Mulberry32(' + s.seed + ')\ntruth = np.array([0] * 10 + [1] * 10)\nA = np.zeros((n, n))\nfor i in range(n):\n    for j in range(i + 1, n):\n        if rng.random() < (0.45 if truth[i] == truth[j] else 0.04):\n            A[i, j] = A[j, i] = 1\nlabels = ' + JSON.stringify(s.lab).replace(/"/g, '') + '\nf = np.array([labels.get(i, 0.5) for i in range(n)], float)\nfree = np.array([i not in labels and A[i].sum() > 0 for i in range(n)])\nfor t in range(' + s.t + '):\n    g = A @ f / np.maximum(A.sum(1), 1)\n    f = np.where(free, g, f)\nunl = np.array([i not in labels for i in range(n)])\nprint("значения:", f.round(2))\nprint("верно у неразмеченных:", ((f > 0.5) == truth)[unl].mean())\n');
    draw();
  });

  /* ==============================================================================
   * 35. Случайные графы: рождение гигантской компоненты
   * ============================================================================== */
  function largestComp(n, U2, p) {
    const par = U.range(n);
    const find = (v) => (par[v] === v ? v : (par[v] = find(par[v])));
    const E = [];
    let k = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (U2[k++] < p) ((par[find(i)] = find(j)), E.push([i, j]));
    const size = new Array(n).fill(0);
    for (let i = 0; i < n; i++) size[find(i)]++;
    const root = U.argmax(size);
    return { E, size: size[root], inGiant: U.range(n).map((i) => find(i) === root) };
  }
  GBC.widget('random-graph', (el) => {
    const N = 80;
    const NB = 200;
    const s = { c: 1.2 };
    const rng = new GBC.RNG(3);
    const pos = U.range(N).map(() => [rng.uniform(15, 505), rng.uniform(15, 255)]);
    const Ud = U.range((N * (N - 1)) / 2).map(() => rng.random());
    const cs = U.linspace(0, 4, 41);
    const SEEDS = 4;
    const Ub = U.range(SEEDS).map((k) => {
      const r = new GBC.RNG(100 + k);
      return U.range((NB * (NB - 1)) / 2).map(() => r.random());
    });
    const sim = cs.map((c) => U.mean(Ub.map((u) => largestComp(NB, u, c / (NB - 1)).size / NB)));
    const theory = (c) => {
      let x = 1;
      for (let i = 0; i < 500; i++) x = 1 - Math.exp(-c * x);
      return x;
    };
    const w = ui.shell(el, { title: 'Случайный граф: рождение гигантской компоненты', sub: 'Каждая пара из 80 вершин соединяется независимо с вероятностью p = c / (n − 1), c — средняя степень. Оранжевая — самая большая компонента связности.' });
    ui.slider(w.controls, { label: 'Средняя степень c', min: 0, max: 4, step: 0.1, value: s.c, onInput: (v) => ((s.c = v), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 270 });
    const curve = new GBC.Plot(w.main, { height: 200, x: { label: 'средняя степень c', domain: [0, 4] }, y: { label: 'доля в гигантской компоненте', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e', label: 'рёбер' }, { key: 'g', label: 'гигантская (n = 80)' }, { key: 'th', label: 'теория n → ∞' }]);
    function draw() {
      const R = largestComp(N, Ud, s.c / (N - 1));
      const big = (i) => R.inGiant[i] && R.size > 1;
      gv.draw({
        nodes: pos.map(([x, y], i) => ({ x, y, r: big(i) ? 6 : 4.5, label: '', fill: big(i) ? 'tree' : 'model', fillP: 70, color: big(i) ? 'tree' : 'model', width: 1.5 })),
        edges: R.E.map(([a, b]) => ({ a, b, color: big(a) ? 'tree' : 'ink2', width: 1.2, opacity: 0.6 })),
      });
      curve.render([
        { type: 'vline', x: 1, color: 'ink2', dash: '4 4', width: 1, text: 'c = 1' },
        { type: 'line', x: cs, y: sim, color: 'model', width: 2, label: 'моделирование, n = 200' },
        { type: 'line', x: U.linspace(0, 4, 161), y: U.linspace(0, 4, 161).map(theory), color: 'tree', width: 2, dash: '6 4', label: 'теория: s = 1 − e^{−cs}' },
        { type: 'points', x: [s.c], y: [R.size / N], color: 'tree', r: 6 },
      ]);
      st.set('e', String(R.E.length));
      st.set('g', R.size + ' из ' + N + ' = ' + f2(R.size / N));
      st.set('th', f3(theory(s.c)));
      note.innerHTML = 'Модель Эрдёша — Реньи показывает <b>фазовый переход</b>. При c &lt; 1 граф — россыпь мелких деревьев. Около c = 1 компоненты начинают сливаться, а при c &gt; 1 появляется <b>гигантская компонента</b> с долей s, где s = 1 − e<sup>−cs</sup>: при c = 2 это уже 80 % вершин. Весь граф становится связным при c ≈ ln n (для n = 80 это около 4.4). Типичное расстояние в связном случайном графе растёт как ln n / ln c — отсюда «тесный мир».';
    }
    draw();
  });

  /* ==============================================================================
   * 36. Тесный мир: модель Уоттса — Строгаца
   * ============================================================================== */
  function wattsStrogatz(n, k, p, seed) {
    const rng = new GBC.RNG(seed);
    const adj = U.range(n).map(() => new Set());
    const E = [];
    for (let i = 0; i < n; i++) for (let j = 1; j <= k / 2; j++) {
      const u = (i + j) % n;
      adj[i].add(u);
      adj[u].add(i);
      E.push([i, u]);
    }
    const out = [];
    E.forEach(([i, u]) => {
      if (rng.random() < p) {
        let v = -1;
        for (let t = 0; t < 100; t++) {
          const c = rng.randint(n);
          if (c !== i && !adj[i].has(c)) {
            v = c;
            break;
          }
        }
        if (v >= 0) {
          adj[i].delete(u);
          adj[u].delete(i);
          adj[i].add(v);
          adj[v].add(i);
          out.push([i, v, 1]);
          return;
        }
      }
      out.push([i, u, 0]);
    });
    return { E: out, adj: adj.map((s0) => [...s0].sort((a, b) => a - b)) };
  }
  function clusterL(n, adj) {
    const S2 = adj.map((a) => new Set(a));
    const C = U.mean(adj.map((a) => {
      const k = a.length;
      if (k < 2) return 0;
      let t = 0;
      for (let x = 0; x < k; x++) for (let y = x + 1; y < k; y++) if (S2[a[x]].has(a[y])) t++;
      return t / ((k * (k - 1)) / 2);
    }));
    let sum = 0;
    let cnt = 0;
    for (let s0 = 0; s0 < n; s0++) bfsDist(adj, s0).forEach((d, j) => j !== s0 && d > 0 && ((sum += d), cnt++));
    return { C, L: sum / cnt };
  }
  const WS_P = [0, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];
  GBC.widget('small-world', (el) => {
    const s = { pi: 6 };
    const NC = 100;
    const KC = 6;
    const curves = WS_P.map((p) => {
      const r = U.range(6).map((sd) => clusterL(NC, wattsStrogatz(NC, KC, p, 10 + sd).adj));
      return { C: U.mean(r.map((x) => x.C)), L: U.mean(r.map((x) => x.L)) };
    });
    const w = ui.shell(el, { title: 'Тесный мир: немного случайных «дальних» связей', sub: 'Кольцо, где каждый знаком с 2 соседями слева и справа. Каждое ребро с вероятностью p перекидывается к случайной вершине. Следите за кластеризацией C (друзья моих друзей знакомы) и средним расстоянием L.' });
    ui.slider(w.controls, { label: 'Вероятность перекидки p', values: U.range(WS_P.length), value: s.pi, format: (i) => String(WS_P[i]), onInput: (v) => ((s.pi = v), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 290 });
    const plot = new GBC.Plot(w.main, { height: 210, x: { label: 'p (логарифмическая шкала; 0 нарисован слева)', domain: [0.0005, 1], type: 'log', ticks: [0.001, 0.01, 0.1, 1] }, y: { label: 'доля от значения при p = 0', domain: [0, 1.05] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'C', label: 'кластеризация C' }, { key: 'L', label: 'среднее расстояние L' }, { key: 'rw', label: 'перекинуто рёбер' }]);
    function draw() {
      const p = WS_P[s.pi];
      const n = 40;
      const G = wattsStrogatz(n, 4, p, 7);
      const M = clusterL(n, G.adj);
      const pos = circlePos(n, 260, 145, 125);
      gv.draw({
        nodes: pos.map(([x, y]) => ({ x, y, r: 5.5, label: '', fill: 'model', fillP: 70 })),
        edges: G.E.map(([a, b, rw]) => ({ a, b, color: rw ? 'tree' : 'ink2', width: rw ? 2 : 1.2, opacity: rw ? 0.95 : 0.6 })),
      });
      const xp = WS_P.map((v) => Math.max(v, 0.0005));
      plot.render([
        { type: 'line', x: xp, y: curves.map((c) => c.C / curves[0].C), color: 'model', width: 2, label: 'C(p) / C(0) — кластеризация' },
        { type: 'line', x: xp, y: curves.map((c) => c.L / curves[0].L), color: 'tree', width: 2, label: 'L(p) / L(0) — расстояния' },
        { type: 'points', x: [xp[s.pi], xp[s.pi]], y: [curves[s.pi].C / curves[0].C, curves[s.pi].L / curves[0].L], color: 'ink', r: 5 },
      ]);
      st.set('C', f3(M.C));
      st.set('L', f2(M.L));
      st.set('rw', String(G.E.filter((e) => e[2]).length) + ' из ' + G.E.length);
      const c = curves[s.pi];
      note.innerHTML = 'На графике — среднее по 6 графам из 100 вершин (у каждой 6 соседей). Кольцо (p = 0) «тесное» локально — C = ' + f2(curves[0].C) + ', — но далёкое глобально: L = ' + f1(curves[0].L) + '. Полностью случайный граф (p = 1) наоборот: L = ' + f2(curves[WS_P.length - 1].L) + ', но C = ' + f3(curves[WS_P.length - 1].C) + '. Самое интересное посередине: уже при p = 0.01 расстояния падают до ' + pct(curves[4].L / curves[0].L, 0) + ' от исходных, а кластеризация почти не меняется (' + pct(curves[4].C / curves[0].C, 0) + '). Это <b>тесный мир</b> (Уоттс и Строгац, 1998): несколько «дальних» знакомств делают мир маленьким, сохраняя тесные компании. Сейчас (p = ' + WS_P[s.pi] + '): C = ' + pct(c.C / curves[0].C, 0) + ', L = ' + pct(c.L / curves[0].L, 0) + ' от значений кольца.';
    }
    w.pythonAction(() => 'from collections import deque\nfrom gbcourse.rng import Mulberry32\n\ndef watts_strogatz(n, k, p, seed):\n    rng = Mulberry32(seed)\n    adj = [set() for _ in range(n)]\n    edges = [(i, (i + j) % n) for i in range(n) for j in range(1, k // 2 + 1)]\n    for i, u in edges:\n        adj[i].add(u)\n        adj[u].add(i)\n    for i, u in edges:\n        if rng.random() < p:\n            for _ in range(100):\n                c = rng.randint(n)\n                if c != i and c not in adj[i]:\n                    adj[i].discard(u)\n                    adj[u].discard(i)\n                    adj[i].add(c)\n                    adj[c].add(i)\n                    break\n    return adj\n\ndef clustering(adj):\n    cs = []\n    for a in adj:\n        a = sorted(a)\n        k = len(a)\n        t = sum(a[y] in adj[a[x]] for x in range(k) for y in range(x + 1, k))\n        cs.append(t / (k * (k - 1) / 2) if k > 1 else 0)\n    return sum(cs) / len(cs)\n\ndef mean_dist(adj):\n    tot = cnt = 0\n    for s in range(len(adj)):\n        d, q = {s: 0}, deque([s])\n        while q:\n            v = q.popleft()\n            for u in adj[v]:\n                if u not in d:\n                    d[u] = d[v] + 1\n                    q.append(u)\n        tot += sum(d.values())\n        cnt += len(d) - 1\n    return tot / cnt\n\nfor p in (0, 0.01, 0.1, 1):\n    adj = watts_strogatz(100, 6, p, 10)\n    print(f"p = {p:<5} C = {clustering(adj):.3f}  L = {mean_dist(adj):.2f}")\n');
    draw();
  });

  /* ==============================================================================
   * 37. Безмасштабные сети: модель Барабаши — Альберт
   * ============================================================================== */
  function barabasi(n, m, seed) {
    const rng = new GBC.RNG(seed);
    const E = [[0, 1], [0, 2], [1, 2]];
    const rep = [0, 1, 0, 2, 1, 2];
    for (let v = 3; v < n; v++) {
      const tg = new Set();
      while (tg.size < m) tg.add(rep[rng.randint(rep.length)]);
      [...tg].sort((a, b) => a - b).forEach((u) => (E.push([u, v]), rep.push(u, v)));
    }
    return E;
  }
  function erdos(n, mEdges, seed) {
    const rng = new GBC.RNG(seed);
    const p = (2 * mEdges) / (n * (n - 1));
    const E = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rng.random() < p) E.push([i, j]);
    return E;
  }
  function forceLayout(n, E, seed, W = 520, Hh = 290) {
    const rng = new GBC.RNG(seed);
    const P = U.range(n).map(() => [rng.uniform(40, W - 40), rng.uniform(30, Hh - 30)]);
    const k = Math.sqrt((W * Hh) / n) * 0.75;
    for (let it = 0; it < 220; it++) {
      const temp = 30 * (1 - it / 220) + 0.5;
      const D = U.range(n).map(() => [0, 0]);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let dx = P[i][0] - P[j][0];
        let dy = P[i][1] - P[j][1];
        const d = Math.max(0.5, Math.hypot(dx, dy));
        const f = (k * k) / d;
        dx /= d;
        dy /= d;
        D[i][0] += dx * f;
        D[i][1] += dy * f;
        D[j][0] -= dx * f;
        D[j][1] -= dy * f;
      }
      E.forEach(([a, b]) => {
        let dx = P[a][0] - P[b][0];
        let dy = P[a][1] - P[b][1];
        const d = Math.max(0.5, Math.hypot(dx, dy));
        const f = (d * d) / k;
        dx /= d;
        dy /= d;
        D[a][0] -= dx * f;
        D[a][1] -= dy * f;
        D[b][0] += dx * f;
        D[b][1] += dy * f;
      });
      for (let i = 0; i < n; i++) {
        const l = Math.max(0.5, Math.hypot(D[i][0], D[i][1]));
        P[i][0] = U.clamp(P[i][0] + (D[i][0] / l) * Math.min(l, temp), 15, W - 15);
        P[i][1] = U.clamp(P[i][1] + (D[i][1] / l) * Math.min(l, temp), 15, Hh - 15);
      }
    }
    return P;
  }
  GBC.widget('scale-free', (el) => {
    const s = { n: 1000, kind: 'ba' };
    const DRAW = 70;
    const layouts = {};
    const w = ui.shell(el, { title: 'Безмасштабные сети: «богатые богатеют»', sub: 'Модель Барабаши — Альберт: новая вершина присоединяется к 2 существующим, выбирая их с вероятностью, пропорциональной степени. Сравните со случайным графом Эрдёша — Реньи с тем же числом рёбер.' });
    ui.segmented(w.controls, { label: 'Рисунок', value: s.kind, options: [{ value: 'ba', label: 'Барабаши — Альберт' }, { value: 'er', label: 'Эрдёш — Реньи' }], onChange: (v) => ((s.kind = v), draw()) });
    ui.slider(w.controls, { label: 'Вершин для распределения', values: [100, 300, 1000, 3000], value: s.n, format: (v) => num(v), onInput: (v) => ((s.n = v), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 290 });
    const plot = new GBC.Plot(w.main, { height: 230, x: { label: 'степень k', type: 'log', domain: [1, 300], ticks: [1, 3, 10, 30, 100, 300] }, y: { label: 'доля вершин со степенью ≥ k', type: 'log', domain: [0.0003, 1], ticks: [0.001, 0.01, 0.1, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ba', label: 'макс. степень БА' }, { key: 'er', label: 'макс. степень ЭР' }, { key: 'top', label: 'доля рёбер у 5 % крупнейших (БА)' }]);
    function ccdf(n, E) {
      const deg = new Array(n).fill(0);
      E.forEach(([a, b]) => (deg[a]++, deg[b]++));
      const mx = Math.max(...deg);
      const ks = [];
      const ps = [];
      for (let k = 1; k <= mx; k++) {
        const c = deg.filter((d) => d >= k).length;
        if (c) (ks.push(k), ps.push(c / n));
      }
      return { deg, ks, ps, mx };
    }
    function draw() {
      const key = s.kind;
      const Esmall = key === 'ba' ? barabasi(DRAW, 2, 5) : erdos(DRAW, barabasi(DRAW, 2, 5).length, 5);
      if (!layouts[key]) layouts[key] = forceLayout(DRAW, Esmall, 2);
      const P = layouts[key];
      const degS = new Array(DRAW).fill(0);
      Esmall.forEach(([a, b]) => (degS[a]++, degS[b]++));
      const mxS = Math.max(...degS);
      gv.draw({
        nodes: P.map(([x, y], i) => ({ x, y, r: 4 + 11 * Math.sqrt(degS[i] / mxS), label: degS[i] >= 0.5 * mxS ? String(degS[i]) : '', size: 10, fill: degS[i] >= 0.5 * mxS ? 'tree' : 'model', fillP: 60, color: degS[i] >= 0.5 * mxS ? 'tree' : 'model', width: 1.5 })),
        edges: Esmall.map(([a, b]) => ({ a, b, color: 'ink2', width: 1, opacity: 0.55 })),
      });
      const Eba = barabasi(s.n, 2, 1);
      const Eer = erdos(s.n, Eba.length, 1);
      const A = ccdf(s.n, Eba);
      const B = ccdf(s.n, Eer);
      plot.render([
        { type: 'line', x: A.ks, y: A.ps, color: 'tree', width: 2, label: 'Барабаши — Альберт' },
        { type: 'line', x: B.ks, y: B.ps, color: 'model', width: 2, label: 'Эрдёш — Реньи' },
      ], { y: [Math.min(0.5 / s.n, 0.01), 1] });
      const sorted = A.deg.slice().sort((a, b) => b - a);
      const top = U.sum(sorted.slice(0, Math.ceil(0.05 * s.n))) / (2 * Eba.length);
      st.set('ba', String(A.mx));
      st.set('er', String(B.mx));
      st.set('top', pct(top, 0));
      note.innerHTML = 'Средняя степень в обеих моделях ≈ 4, но устроены они по-разному. В случайном графе степени сосредоточены около среднего (пуассоновское распределение — кривая обрывается), а в модели Барабаши — Альберт есть <b>хабы</b>: доля вершин со степенью ≥ k убывает как степенная функция k<sup>−2</sup> — прямая на двойной логарифмической шкале, «тяжёлый хвост». При n = ' + num(s.n) + ' максимальная степень ' + A.mx + ' против ' + B.mx + '. Причина — <b>предпочтительное присоединение</b>: популярным достаётся больше новых связей. Так устроены веб, цитирования, соцсети и сети переводов. Для моделей это значит: степень и PageRank распределены очень неравномерно — деревьям удобно (они инвариантны к монотонным преобразованиям), а для линейных моделей признак лучше логарифмировать.';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse.rng import Mulberry32\n\ndef barabasi(n, m, seed):\n    rng = Mulberry32(seed)\n    edges = [(0, 1), (0, 2), (1, 2)]\n    rep = [0, 1, 0, 2, 1, 2]                 # вершина встречается столько раз, какова её степень\n    for v in range(3, n):\n        tg = set()\n        while len(tg) < m:\n            tg.add(rep[rng.randint(len(rep))])\n        for u in sorted(tg):\n            edges.append((u, v))\n            rep += [u, v]\n    return edges\n\nn = ' + s.n + '\nE = barabasi(n, 2, 1)\ndeg = np.bincount(np.array(E).ravel(), minlength=n)\nprint("рёбер:", len(E), " средняя степень:", deg.mean().round(2), " максимальная:", deg.max())\nfor k in (2, 4, 8, 16, 32, 64):\n    print(f"P(deg ≥ {k:2}) = {(deg >= k).mean():.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * 38–39. Графовые признаки для бустинга и честное разбиение
   * ============================================================================== */
  function makeFraudGraph(seed) {
    const n = 400;
    const rng = new GBC.RNG(seed);
    const comm = [];
    const fraud = [];
    const x1 = [];
    const x2 = [];
    for (let i = 0; i < n; i++) {
      comm.push(rng.randint(6));
      fraud.push(rng.random() < (comm[i] < 2 ? 0.6 : 0.04) ? 1 : 0);
      x1.push(rng.normal(fraud[i] ? 0.7 : 0, 1));
      x2.push(rng.normal(0, 1));
    }
    const nb = U.range(n).map(() => []);
    const E = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (rng.random() < (comm[i] === comm[j] ? 0.08 : 0.003)) (nb[i].push(j), nb[j].push(i), E.push([i, j]));
      }
    }
    const perm = rng.permutation(n);
    const train = new Array(n).fill(false);
    perm.slice(0, 240).forEach((i) => (train[i] = true));
    return { n, comm, fraud, x1, x2, nb, E, train };
  }
  function fraudFeatures(G, train, leak) {
    return U.range(G.n).map((i) => {
      const nbs = G.nb[i];
      const tr = nbs.filter((j) => train[j]);
      const ft = tr.filter((j) => G.fraud[j]).length;
      const share = leak ? nbs.filter((j) => G.fraud[j]).length / Math.max(1, nbs.length) : ft / Math.max(1, tr.length);
      return [G.x1[i], G.x2[i], nbs.length, tr.length, leak ? nbs.filter((j) => G.fraud[j]).length : ft, share];
    });
  }
  function fitAuc(G, train, F, cols) {
    const tr = U.range(G.n).filter((i) => train[i]);
    const te = U.range(G.n).filter((i) => !train[i]);
    const m = new GBC.GradientBoosting({ loss: 'logistic', nEstimators: 60, learningRate: 0.05, maxDepth: 2, minSamplesLeaf: 10 }).fit(tr.map((i) => cols.map((c) => F[i][c])), tr.map((i) => G.fraud[i]));
    return GBC.metrics.rocAuc(te.map((i) => G.fraud[i]), m.predictProba(te.map((i) => cols.map((c) => F[i][c]))));
  }
  const PY_FRAUD = (seed) => 'from gbcourse import GBClassifier\nfrom gbcourse.metrics import roc_auc\nfrom gbcourse.rng import Mulberry32\n\nrng = Mulberry32(' + seed + ')\nn = 400\ncomm, fraud, x1, x2 = [], [], [], []\nfor i in range(n):\n    comm.append(rng.randint(6))\n    fraud.append(1 if rng.random() < (0.6 if comm[i] < 2 else 0.04) else 0)\n    x1.append(rng.normal(0.7 if fraud[i] else 0, 1))\n    x2.append(rng.normal(0, 1))\nnb = [[] for _ in range(n)]\nfor i in range(n):\n    for j in range(i + 1, n):\n        if rng.random() < (0.08 if comm[i] == comm[j] else 0.003):\n            nb[i].append(j)\n            nb[j].append(i)\nperm = rng.permutation(n)\nrandom_train = [False] * n\nfor i in perm[:240]:\n    random_train[i] = True\n\ndef feats(i, train, leak=False):\n    tr = [j for j in nb[i] if train[j]]\n    ft = sum(fraud[j] for j in tr)\n    if leak:                                    # подглядываем в метки ВСЕХ соседей\n        ft = sum(fraud[j] for j in nb[i])\n        return [x1[i], x2[i], len(nb[i]), len(tr), ft, ft / max(1, len(nb[i]))]\n    return [x1[i], x2[i], len(nb[i]), len(tr), ft, ft / max(1, len(tr))]\n\ndef auc(train, cols, leak=False):\n    F = [feats(i, train, leak) for i in range(n)]\n    tr = [i for i in range(n) if train[i]]\n    te = [i for i in range(n) if not train[i]]\n    m = GBClassifier(n_estimators=60, learning_rate=0.05, max_depth=2, min_samples_leaf=10)\n    m.fit([[F[i][c] for c in cols] for i in tr], [fraud[i] for i in tr])\n    return round(roc_auc([fraud[i] for i in te], m.predict_proba([[F[i][c] for c in cols] for i in te])[:, 1]), 3)\n\nOWN, ALL = [0, 1], [0, 1, 2, 3, 4, 5]\n';
  GBC.widget('graph-features', (el) => {
    const s = { seed: 7 };
    const w = ui.shell(el, { title: 'Графовые признаки в бустинге: поиск мошенников', sub: '400 счетов, связи — переводы. Мошенники сосредоточены в двух сообществах и переводят деньги друг другу. Собственные признаки счёта слабые. Помогут ли признаки соседей?' });
    ui.button(w.controls, { label: 'Новые данные', icon: 'reset', onClick: () => (s.seed++, run()) });
    const gv = new GraphView(w.main, { w: 520, h: 300 });
    w.main.appendChild(legendRow([['model', 'честный счёт'], ['tree', 'мошенник'], ['ink2', 'кольцо — тестовый счёт (метка скрыта)']]));
    const bars = new GBC.Plot(w.main, { height: 190, x: { label: '', domain: [0.4, 3.6], ticks: [] }, y: { label: 'ROC AUC на тесте', domain: [0.4, 1.02] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'own', label: 'только свои признаки' }, { key: 'g', label: '+ графовые' }, { key: 'leak', label: '+ графовые с утечкой' }]);
    function run() {
      const G = makeFraudGraph(s.seed);
      const lay = new GBC.RNG(99);
      const centers = U.range(6).map((c) => [260 + 180 * Math.cos((2 * Math.PI * c) / 6), 150 + 105 * Math.sin((2 * Math.PI * c) / 6)]);
      const pos = U.range(G.n).map((i) => [centers[G.comm[i]][0] + 26 * lay.normal(), centers[G.comm[i]][1] + 20 * lay.normal()]);
      const F = fraudFeatures(G, G.train, false);
      const FL = fraudFeatures(G, G.train, true);
      const auc = [fitAuc(G, G.train, F, [0, 1]), fitAuc(G, G.train, F, [0, 1, 2, 3, 4, 5]), fitAuc(G, G.train, FL, [0, 1, 2, 3, 4, 5])];
      gv.draw({
        nodes: pos.map(([x, y], i) => ({ x, y, r: G.fraud[i] ? 4.5 : 3.6, label: '', fill: G.train[i] ? (G.fraud[i] ? 'tree' : 'model') : null, fillP: 85, color: G.fraud[i] ? 'tree' : 'model', width: G.train[i] ? 1 : 1.6 })),
        edges: G.E.map(([a, b]) => ({ a, b, color: 'muted', width: 0.7, opacity: 0.45 })),
      });
      bars.render([
        { type: 'bars', x: [1, 2, 3], y: auc, color: (i) => ['model', 'good', 'red'][i], width: 0.55, maxPx: 70 },
        { type: 'text', items: [['свои', 0], ['+ графовые', 1], ['утечка!', 2]].map(([t, i]) => ({ x: i + 1, y: auc[i], dy: -6, anchor: 'middle', text: t + ': ' + f3(auc[i]), bold: true })) },
        { type: 'hline', y: 0.5, color: 'ink2', dash: '4 4', width: 1, text: 'случайно' },
      ]);
      st.set('own', f3(auc[0]));
      st.set('g', f3(auc[1]));
      st.set('leak', f3(auc[2]));
      note.innerHTML = 'Мошенники переводят деньги друг другу — в графе действует <b>гомофилия</b>: «скажи мне, кто твой друг». Признаки из графа: степень, число соседей с известной меткой, сколько из них мошенники и их доля. Бустинг (60 деревьев глубины 2) на них заметно сильнее: в среднем по 10 графам AUC растёт с 0.65 до 0.81. Но важна дисциплина: доля мошенников среди соседей считается <b>только по меткам обучающих счетов</b>. Если подсмотреть метки тестовых соседей, AUC становится ещё выше (красный столбец; в среднем 0.85) — это <b>утечка</b>: в момент прогноза эти метки неизвестны, и в реальности такого качества не будет.';
    }
    w.pythonAction(() => PY_FRAUD(s.seed) + '\nprint("свои признаки:       ", auc(random_train, OWN))\nprint("+ графовые:          ", auc(random_train, ALL))\nprint("+ графовые с утечкой:", auc(random_train, ALL, leak=True))\n');
    run();
  });
  GBC.widget('graph-split', (el) => {
    const s = { seed: 7, avg: null };
    const w = ui.shell(el, { title: 'Честная проверка на графе: случайное разбиение или по сообществам?', sub: 'Тот же граф переводов. Случайное разбиение кладёт соседей в обучение и тест вперемешку. Разбиение по сообществам имитирует появление новых, ранее не виданных групп счетов.' });
    ui.button(w.controls, { label: 'Новые данные', icon: 'reset', onClick: () => (s.seed++, run()) });
    ui.button(w.controls, { label: 'Усреднить по 10 графам', icon: 'play', onClick: () => average() });
    const bars = new GBC.Plot(w.main, { height: 230, x: { label: '', domain: [0.4, 4.6], ticks: [] }, y: { label: 'ROC AUC на тесте', domain: [0.4, 1.02] } });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'случайное: свои / + графовые' }, { key: 'c', label: 'по сообществам: свои / + графовые' }, { key: 'lab', label: 'тестовых с размеченным соседом' }]);
    function aucs(seed) {
      const G = makeFraudGraph(seed);
      const commTrain = G.comm.map((c) => c === 0 || c === 2 || c === 3);
      const share = (train) => {
        const te = U.range(G.n).filter((i) => !train[i]);
        return U.mean(te.map((i) => (G.nb[i].some((j) => train[j]) ? 1 : 0)));
      };
      const out = [];
      [G.train, commTrain].forEach((train) => {
        const F = fraudFeatures(G, train, false);
        out.push(fitAuc(G, train, F, [0, 1]), fitAuc(G, train, F, [0, 1, 2, 3, 4, 5]));
      });
      return { a: out, lab: [share(G.train), share(commTrain)] };
    }
    function render(a, lab, title) {
      bars.render([
        { type: 'bars', x: [1, 2, 3, 4], y: a, color: (i) => ['model', 'good', 'model', 'good'][i], width: 0.55, maxPx: 60 },
        { type: 'text', items: [['свои', 0], ['+ граф', 1], ['свои', 2], ['+ граф', 3]].map(([t, i]) => ({ x: i + 1, y: a[i], dy: -6, anchor: 'middle', text: t + ': ' + f3(a[i]), bold: true })) },
        { type: 'vline', x: 2.5, color: 'ink2', dash: '4 4', width: 1 },
        { type: 'text', items: [{ x: 1.5, y: 0.45, anchor: 'middle', text: 'случайное разбиение', color: 'ink2' }, { x: 3.5, y: 0.45, anchor: 'middle', text: 'по сообществам', color: 'ink2' }] },
        { type: 'hline', y: 0.5, color: 'ink2', dash: '2 4', width: 1 },
      ]);
      st.set('r', f3(a[0]) + ' / ' + f3(a[1]));
      st.set('c', f3(a[2]) + ' / ' + f3(a[3]));
      st.set('lab', pct(lab[0], 0) + ' / ' + pct(lab[1], 0));
      line.textContent = title + '\nПрирост от графовых признаков: случайное разбиение ' + (a[1] - a[0] >= 0 ? '+' : '') + f3(a[1] - a[0]) + ', по сообществам ' + (a[3] - a[2] >= 0 ? '+' : '') + f3(a[3] - a[2]);
    }
    function run() {
      const R = aucs(s.seed);
      render(R.a, R.lab, 'Граф с зерном ' + s.seed + '. Обучение по сообществам: 0, 2, 3; тест: 1, 4, 5.');
    }
    function average() {
      const all = U.range(10).map((k) => aucs(7 + k));
      render(U.range(4).map((j) => U.mean(all.map((r) => r.a[j]))), [U.mean(all.map((r) => r.lab[0])), U.mean(all.map((r) => r.lab[1]))], 'Среднее по 10 графам (зёрна 7…16).');
    }
    note.innerHTML = 'При случайном разбиении почти у каждого тестового счёта есть размеченные соседи по переводам — признак «доля мошенников среди соседей» работает в полную силу. Но если модель будут применять к <b>новым группам</b> счетов, их соседи тоже будут новыми и неразмеченными: при разбиении по сообществам размеченный сосед есть меньше чем у половины тестовых счетов (против почти всех при случайном), и это соседи из <i>чужих</i> сообществ — по ним о самом счёте почти ничего не узнать. Прирост от графовых признаков исчезает, а то и становится отрицательным. Это не утечка в строгом смысле, но <b>оптимистичная оценка</b>: валидация должна воспроизводить условия применения. Для графов это разбиение по компонентам, сообществам или по времени (урок 11.2).';
    w.pythonAction(() => PY_FRAUD(s.seed) + 'comm_train = [c in (0, 2, 3) for c in comm]\nfor name, train in (("случайное", random_train), ("по сообществам", comm_train)):\n    print(f"{name:15} свои {auc(train, OWN)}   + графовые {auc(train, ALL)}")\n');
    run();
  });

  /* ==============================================================================
   * 40. Граф взаимодействий признаков в ансамбле деревьев
   * ============================================================================== */
  function interactionGraph(model, d) {
    const S2 = U.range(d).map(() => new Array(d).fill(0));
    const imp = new Array(d).fill(0);
    model.trees.forEach((stage) => stage.forEach((tree) => {
      const nodes = tree.nodes;
      (function walk(id, anc) {
        const nd = nodes[id];
        if (nd.left < 0) return;
        imp[nd.feature] += nd.gain;
        anc.forEach((f) => f !== nd.feature && ((S2[f][nd.feature] += nd.gain), (S2[nd.feature][f] += nd.gain)));
        const a2 = anc.concat([nd.feature]);
        walk(nd.left, a2);
        walk(nd.right, a2);
      })(0, []);
    }));
    return { S: S2, imp };
  }
  /** H-статистика Фридмана (ненормированная: доля дисперсии прогноза) для всех пар: фон — объекты 0…59, точки — 200…224. */
  function hStatistic(model, X, d) {
    const bg = X.slice(0, 60);
    const pts = X.slice(200, 225);
    const fp = model.predict(pts);
    const fm = U.mean(fp);
    const varF = U.sum(fp.map((v) => (v - fm) * (v - fm)));
    const pd = (cols) => {
      const out = pts.map((p) => U.mean(model.predict(bg.map((r) => {
        const z = r.slice();
        cols.forEach((c) => (z[c] = p[c]));
        return z;
      }))));
      const mu = U.mean(out);
      return out.map((v) => v - mu);
    };
    const single = U.range(d).map((j) => pd([j]));
    const Hm = U.range(d).map(() => new Array(d).fill(0));
    for (let a = 0; a < d; a++) for (let b = a + 1; b < d; b++) {
      const pj = pd([a, b]);
      const num2 = U.sum(pj.map((v, t) => Math.pow(v - single[a][t] - single[b][t], 2)));
      Hm[a][b] = Hm[b][a] = num2 / varF;
    }
    return Hm;
  }
  GBC.widget('interaction-graph', (el) => {
    const s = { depth: 3, meas: 'path' };
    const D = GBC.datasets.friedman1({ n: 400, noise: 1, seed: 1 });
    const d = 10;
    const cache = {};
    const w = ui.shell(el, { title: 'Граф взаимодействий: какие признаки работают вместе', sub: 'Бустинг (80 деревьев) обучен на данных Фридмана: y = 10·sin(π·x₁x₂) + 20(x₃ − 0.5)² + 10x₄ + 5x₅ + шум, x₆…x₁₀ — шум. Настоящее взаимодействие одно — x₁ с x₂. Найдёт ли его граф?' });
    ui.segmented(w.controls, { label: 'Мера силы ребра', value: s.meas, options: [{ value: 'path', label: 'вместе на пути' }, { value: 'h', label: 'H-статистика' }], onChange: (v) => ((s.meas = v), draw()) });
    ui.slider(w.controls, { label: 'Глубина деревьев', min: 1, max: 4, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), draw()) });
    const gv = new GraphView(w.main, { w: 520, h: 300 });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'top', label: 'сильнейшая пара' }, { key: 'share', label: 'её значение' }, { key: 'r2', label: 'R² на обучении' }]);
    const get = (dep) => {
      if (!cache[dep]) {
        const m = new GBC.GradientBoosting({ loss: 'squared', nEstimators: 80, learningRate: 0.1, maxDepth: dep, minSamplesLeaf: 5 }).fit(D.X, D.y);
        cache[dep] = { m, G: interactionGraph(m, d), r2: GBC.metrics.r2(D.y, m.predict(D.X)) };
      }
      if (s.meas === 'h' && !cache[dep].H) cache[dep].H = hStatistic(cache[dep].m, D.X, d);
      return cache[dep];
    };
    function draw() {
      const R = get(s.depth);
      const M = s.meas === 'h' ? R.H : R.G.S;
      const imp = R.G.imp;
      const pairs = [];
      for (let a = 0; a < d; a++) for (let b = a + 1; b < d; b++) pairs.push([a, b, M[a][b]]);
      pairs.sort((x, y) => y[2] - x[2]);
      const tot = U.sum(pairs.map((p) => p[2]));
      const mx = pairs[0][2] > 1e-9 ? pairs[0][2] : 0;
      const mi = Math.max(...imp);
      const pos = circlePos(d, 260, 150, 118);
      const lab = (i) => 'x' + GBC.lesson1518.sub(i + 1);
      const val = (p) => (s.meas === 'h' ? pct(p[2], 2) + ' дисперсии' : pct(p[2] / tot));
      gv.draw({
        nodes: pos.map(([x, y], i) => ({ x, y, r: 10 + 14 * Math.sqrt(imp[i] / mi), label: lab(i), size: 11.5, fill: i < 5 ? 'model' : 'muted', fillP: 25 + 45 * (imp[i] / mi), color: i < 5 ? 'model' : 'muted' })),
        edges: mx > 0 ? pairs.filter((p) => p[2] > 0.06 * mx).map((p) => ({ a: p[0], b: p[1], color: p === pairs[0] ? 'tree' : 'ink2', width: 1 + 9 * (p[2] / mx), opacity: 0.35 + 0.65 * (p[2] / mx) })) : [],
        texts: mx > 0 ? [] : [{ x: 260, y: 150, text: 'взаимодействий нет: модель из пней аддитивна', size: 13, color: 'ink2' }],
      });
      tbl.textContent = '';
      if (mx > 0) ui.table(tbl, { columns: ['пара', s.meas === 'h' ? 'H² (неаддитивная часть прогноза)' : 'сила (доля всех пар)'], numeric: false, rows: pairs.slice(0, 5).map((p) => [lab(p[0]) + ' – ' + lab(p[1]), val(p)]), highlight: (i) => i === 0 });
      st.set('top', mx > 0 ? lab(pairs[0][0]) + ' – ' + lab(pairs[0][1]) : 'нет');
      st.set('share', mx > 0 ? val(pairs[0]) : '—');
      st.set('r2', f3(R.r2));
      const p2 = pairs.find((p) => p[0] === 0 && p[1] === 1);
      note.innerHTML = s.depth === 1
        ? 'При глубине 1 (пни) взаимодействий нет вовсе: в каждом дереве одно разбиение, путь из корня содержит один признак, и бустинг пней — сумма функций одного признака (аддитивная модель). Обе меры дают ноль. Произведение x₁x₂ под синусом такая модель описывает хуже — сравните R² с глубиной 2–3.'
        : s.meas === 'path'
          ? 'Каждое дерево — граф, и путь от корня к листу перечисляет признаки, которые используются в правиле вместе. Ребро f–g здесь — суммарный выигрыш разбиений по g внутри ветвей, уже разбитых по f (так считают инструменты вроде xgbfi). Но смотрите: сильнейшей оказалась пара ' + lab(pairs[0][0]) + '–' + lab(pairs[0][1]) + ', а настоящая x₁–x₂ — лишь на ' + (pairs.indexOf(p2) + 1) + '-м месте. Причина — <b>смещение к важным признакам</b>: x₄ (слагаемое 10x₄) делят почти в каждой ветви, и он «соседствует» на путях со всеми. Совместное появление на пути — необходимое условие взаимодействия, но не доказательство. Переключитесь на H-статистику.'
          : '<b>H-статистика Фридмана</b> спрашивает не «встречаются ли признаки вместе», а «складывается ли их совместное влияние из отдельных»: она измеряет часть частичной зависимости PD<sub>fg</sub>, которую не объясняет сумма PD<sub>f</sub> + PD<sub>g</sub> (здесь — как долю дисперсии прогноза модели). Для аддитивных пар она близка к нулю. ' + (pairs[0][0] === 0 && pairs[0][1] === 1 ? 'Граф наконец показывает правду: x₁–x₂ сильнее следующей пары в ' + f1(pairs[0][2] / pairs[1][2]) + ' раза.' : 'При глубине 2 первой всё же оказалась ' + lab(pairs[0][0]) + '–' + lab(pairs[0][1]) + ': деревьям из двух уровней трудно выразить sin(π·x₁x₂), и модель сама «выдумывает» лишние взаимодействия. Поставьте глубину 3–4 — и лидером станет x₁–x₂.') + ' Цена — десятки тысяч предсказаний модели вместо одного прохода по деревьям. Мораль: граф по структуре деревьев — быстрый способ найти <b>кандидатов</b>, а проверять их нужно мерой, которая смотрит на поведение модели.';
    }
    w.pythonAction(() => 'import numpy as np\nfrom gbcourse import GBRegressor\nfrom gbcourse.datasets import friedman1\n\nX, y = friedman1(n=400, noise=1.0, seed=1)\nm = GBRegressor(n_estimators=80, learning_rate=0.1, max_depth=' + s.depth + ', min_samples_leaf=5).fit(X, y)\nd = X.shape[1]\n\n# 1) вместе на пути: выигрыш разбиений по g в ветвях, уже разбитых по f\nS = np.zeros((d, d))\n\ndef walk(nodes, i, anc):\n    nd = nodes[i]\n    if nd.left < 0:\n        return\n    for f in anc:\n        if f != nd.feature:\n            S[f, nd.feature] += nd.gain\n            S[nd.feature, f] += nd.gain\n    walk(nodes, nd.left, anc + [nd.feature])\n    walk(nodes, nd.right, anc + [nd.feature])\n\nfor stage in m.trees_:\n    for tree in stage:\n        walk(tree.nodes, 0, [])\n\n# 2) H-статистика Фридмана (доля дисперсии прогноза): фон — объекты 0…59, точки — 200…224\nbg, pts = X[:60], X[200:225]\nfp = m.predict(pts)\nvar = ((fp - fp.mean()) ** 2).sum()\n\ndef pd(cols):\n    out = []\n    for p in pts:\n        Z = bg.copy()\n        Z[:, cols] = p[cols]\n        out.append(m.predict(Z).mean())\n    out = np.array(out)\n    return out - out.mean()\n\nsingle = [pd([j]) for j in range(d)]\nHm = np.zeros((d, d))\nfor a in range(d):\n    for b in range(a + 1, d):\n        pj = pd([a, b])\n        Hm[a, b] = ((pj - single[a] - single[b]) ** 2).sum() / var\n\nfor name, M in (("вместе на пути", S / max(S.sum() / 2, 1e-12)), ("H²", Hm)):\n    top = sorted(((M[a, b], a + 1, b + 1) for a in range(d) for b in range(a + 1, d)), reverse=True)[:4]\n    print(name + ":", ", ".join(f"x{a}–x{b} {v:.3f}" for v, a, b in top))\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр: генератор задач
   * ============================================================================== */
  const IQ = [
    { q: 'Когда в связном графе есть эйлеров цикл?', opts: ['всегда', 'когда все степени чётные', 'когда ровно две нечётные вершины', 'когда граф — дерево'], a: 1, why: 'Ровно две нечётные вершины дают эйлеров путь, но не цикл.' },
    { q: 'Какой обход находит путь с наименьшим числом рёбер?', opts: ['DFS', 'BFS', 'любой', 'никакой'], a: 1, why: 'BFS посещает вершины в порядке расстояния от старта.' },
    { q: 'Почему Дейкстра ошибается с отрицательными весами?', opts: ['не хватает памяти', 'завершённую вершину потом можно было бы улучшить', 'граф станет несвязным', 'не ошибается'], a: 1, why: 'Алгоритм полагается на то, что путь не может стать короче, удлиняясь.' },
    { q: 'Чем A* отличается от Дейкстры?', opts: ['находит неоптимальный путь', 'добавляет к приоритету оценку оставшегося пути', 'работает только на деревьях', 'использует стек'], a: 1, why: 'f = g + h; если h не завышает остаток, путь оптимален, а раскрытых вершин меньше.' },
    { q: 'Как Беллман — Форд обнаруживает арбитраж?', opts: ['по нечётному циклу', 'на |V|-м раунде релаксация всё ещё что-то улучшает', 'по максимальному потоку', 'никак'], a: 1, why: 'Значит, есть цикл отрицательного веса: произведение курсов > 1.' },
    { q: 'Как растит деревья LightGBM по умолчанию?', opts: ['по уровням', 'по листьям: делит лист с наибольшим выигрышем', 'случайно', 'симметрично'], a: 1, why: 'Leaf-wise рост — очередь с приоритетом; симметричные деревья — у CatBoost.' },
    { q: 'Топологический порядок существует, если граф…', opts: ['связный', 'ориентированный и без циклов', 'полный', 'двудольный'], a: 1, why: 'Цикл означает, что шаги ждут друг друга.' },
    { q: 'Срок проекта по графу задач (DAG) — это…', opts: ['кратчайший путь', 'длина самого длинного (критического) пути', 'число задач', 'сумма всех длительностей'], a: 1, why: 'Задачи на критическом пути нельзя задерживать.' },
    { q: 'Что получится, если сжать каждую сильно связную компоненту в вершину?', opts: ['дерево', 'DAG — граф без циклов', 'полный граф', 'цикл'], a: 1, why: 'Цикл между компонентами слил бы их в одну.' },
    { q: 'EFB в LightGBM решает задачу…', opts: ['кратчайшего пути', 'раскраски графа конфликтов', 'поиска эйлерова цикла', 'сортировки'], a: 1, why: 'Признаки-соседи по конфликтам — в разные пучки, пучков поменьше.' },
    { q: 'Почему граф с циклом длины 5 не двудольный?', opts: ['слишком мало рёбер', 'нечётный цикл нельзя раскрасить в 2 цвета', 'он несвязный', 'он двудольный'], a: 1, why: 'Двудольность ⇔ нет циклов нечётной длины (теорема Кёнига).' },
    { q: 'Почему жадный Краскал находит минимальное остовное дерево?', opts: ['везёт', 'свойство разреза: самое лёгкое ребро разреза входит в оптимум', 'он перебирает все деревья', 'веса целые'], a: 1, why: 'Обмен тяжёлого ребра цикла на лёгкое только уменьшает вес.' },
    { q: 'Максимальный поток из s в t равен…', opts: ['сумме всех ёмкостей', 'ёмкости минимального разреза', 'числу путей', 'максимальной ёмкости ребра'], a: 1, why: 'Теорема Форда — Фалкерсона.' },
    { q: 'Троим сотрудникам подходят лишь две задачи. Что говорит теорема Холла?', opts: ['всех можно занять', 'занять всех нельзя', 'нужен поток', 'ничего'], a: 1, why: '|N(S)| < |S| — кто-то останется без задачи.' },
    { q: 'У вершины-«моста» между двумя группами обычно велика…', opts: ['степень', 'центральность по посредничеству', 'кластеризация', 'ничего'], a: 1, why: 'Через неё идут кратчайшие пути между группами.' },
    { q: 'Что такое «тесный мир»?', opts: ['граф без циклов', 'высокая кластеризация и малые расстояния одновременно', 'полный граф', 'граф с одной компонентой'], a: 1, why: 'Немного «дальних» рёбер резко сокращают расстояния.' },
    { q: 'Чем безмасштабная сеть отличается от случайного графа Эрдёша — Реньи?', opts: ['она меньше', 'в ней есть хабы — тяжёлый хвост степеней', 'в ней нет циклов', 'она двудольная'], a: 1, why: 'Предпочтительное присоединение: «богатые богатеют».' },
    { q: 'Почему долю мошенников среди соседей считают только по обучающим меткам?', opts: ['так быстрее', 'метки тестовых счетов неизвестны в момент прогноза — иначе утечка', 'так требует бустинг', 'тестовых соседей нет'], a: 1, why: 'Подглядывание в тестовые метки завышает качество.' },
    { q: 'Бустинг пней (глубина 1) — какие взаимодействия признаков он может описать?', opts: ['любые', 'никаких: это сумма функций одного признака', 'только пары', 'только с категориальными'], a: 1, why: 'Путь пня содержит одно разбиение — пар признаков нет.' },
  ];
  function genQ(rng) {
    const r = (a, b) => a + rng.randint(b - a + 1);
    const opts4 = (ans, cands) => {
      const set = [ans];
      cands.forEach((c) => set.length < 4 && !set.includes(c) && c >= 0 && set.push(c));
      while (set.length < 4) set.push(ans + set.length * 3 + 1);
      const order = rng.permutation(4);
      return { opts: order.map((i) => String(set[i])), a: order.indexOf(0) };
    };
    const t = rng.randint(10);
    if (t === 0) {
      const n = r(5, 14);
      const d = r(2, 5);
      if ((n * d) % 2) return { q: 'Бывает ли граф из ' + n + ' вершин, у каждой из которых степень ' + d + '?', opts: ['да', 'нет'], a: 1, why: 'Сумма степеней ' + n * d + ' нечётна, а она должна быть равна 2|E|.' };
      const o = opts4((n * d) / 2, [n * d, n + d, (n * d) / 2 + n]);
      return { q: 'В графе ' + n + ' вершин, у каждой степень ' + d + '. Сколько рёбер?', ...o, why: 'Лемма о рукопожатиях: ' + n + '·' + d + '/2 = ' + (n * d) / 2 + '.' };
    }
    if (t === 1) {
      const n = r(6, 60);
      return { q: 'Сколько рёбер у дерева на ' + n + ' вершинах?', ...opts4(n - 1, [n, n - 2, 2 * n - 2]), why: 'У любого дерева |E| = |V| − 1.' };
    }
    if (t === 2) {
      const dd = r(3, 8);
      return { q: 'Сколько листьев у полного бинарного дерева глубины ' + dd + '?', ...opts4(Math.pow(2, dd), [2 * dd, Math.pow(2, dd + 1) - 1, Math.pow(2, dd - 1)]), why: '2^d = ' + Math.pow(2, dd) + ' листьев, всего узлов 2^(d+1) − 1 = ' + (Math.pow(2, dd + 1) - 1) + '.' };
    }
    if (t === 3) {
      const L = r(8, 64);
      return { q: 'У бинарного дерева решений ' + L + ' листьев. Сколько у него внутренних узлов?', ...opts4(L - 1, [L, L / 2, L + 1]), why: 'Каждое разбиение превращает один лист в два: внутренних L − 1 = ' + (L - 1) + '.' };
    }
    if (t === 4) {
      const n = r(5, 30);
      return { q: 'Сколько рёбер у полного графа K' + GBC.lesson1518.sub(n) + '?', ...opts4((n * (n - 1)) / 2, [n * (n - 1), n * n, n - 1]), why: 'C(n, 2) = ' + n + '·' + (n - 1) + '/2.' };
    }
    if (t === 5) {
      const V = r(6, 20);
      const E = V - 1 + r(1, 9);
      return { q: 'Связный граф: ' + V + ' вершин, ' + E + ' рёбер. Сколько рёбер нужно удалить, чтобы получилось остовное дерево?', ...opts4(E - V + 1, [E - V, V - 1, E - V + 2]), why: '|E| − |V| + 1 = ' + (E - V + 1) + ' — по одному на каждый независимый цикл.' };
    }
    if (t === 6) {
      const n = r(3, 7);
      return { q: 'Сколько разных помеченных деревьев на ' + n + ' вершинах?', ...opts4(Math.pow(n, n - 2), [Math.pow(n, n - 1), Math.pow(2, n), n * (n - 1)]), why: 'Формула Кэли nⁿ⁻² = ' + Math.pow(n, n - 2) + ' (код Прюфера).' };
    }
    if (t === 7) {
      const k = r(1, 5);
      return { q: 'У лапласиана графа ровно ' + k + ' нулевых собственных значений. Сколько у графа компонент связности?', ...opts4(k, [k + 1, k - 1, 2 * k]), why: 'Кратность нуля = число компонент.' };
    }
    if (t === 8) {
      const dd = r(2, 7);
      return { q: 'Сколько рёбер у гиперкуба Q' + GBC.lesson1518.sub(dd) + '?', ...opts4(dd * Math.pow(2, dd - 1), [Math.pow(2, dd), dd * Math.pow(2, dd), Math.pow(2, dd) - 1]), why: '2^d вершин степени d: d·2^(d−1) = ' + dd * Math.pow(2, dd - 1) + '.' };
    }
    const odd = [0, 2, 4][rng.randint(3)];
    return { q: 'В связном графе ' + odd + ' ' + plural(odd, 'вершина', 'вершины', 'вершин') + ' нечётной степени. Есть ли обход всех рёбер ровно по разу?', opts: ['да, замкнутый (цикл)', 'да, незамкнутый (путь)', 'нет'], a: odd === 0 ? 0 : odd === 2 ? 1 : 2, why: 'Теорема Эйлера: 0 нечётных — цикл, 2 — путь, больше — нет.' };
  }
  GBC.widget('graph-game', (el) => {
    const rng = new GBC.RNG(2026);
    const st0 = { Q: null, right: 0, total: 0, streak: 0, picked: null, ci: 0 };
    const w = ui.shell(el, { title: 'Тренажёр: графы', sub: 'Бесконечный поток задач: подсчёты (рукопожатия, деревья, Кэли, циклы, гиперкубы) вперемешку с вопросами на понимание алгоритмов.' });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.05rem;padding:6px 0 12px' });
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));gap:8px' });
    w.main.append(qEl, optsBox);
    const next = ui.button(w.controls, { label: 'Следующий', icon: 'step', onClick: () => newQ() });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }, { key: 'p', label: 'точность' }]);
    function newQ() {
      if (rng.random() < 0.55) st0.Q = genQ(rng);
      else {
        st0.Q = IQ[st0.ci % IQ.length];
        st0.ci++;
      }
      st0.picked = null;
      draw();
    }
    function draw() {
      const Q = st0.Q;
      qEl.textContent = Q.q;
      optsBox.textContent = '';
      Q.opts.forEach((o, k) => {
        const b = ui.button(optsBox, { label: o, kind: st0.picked === null || k === Q.a ? 'primary' : '', onClick: () => {
          if (st0.picked !== null) return;
          st0.picked = k;
          st0.total++;
          if (k === Q.a) (st0.right++, st0.streak++);
          else st0.streak = 0;
          draw();
        } });
        b.style.whiteSpace = 'normal';
        b.style.textAlign = 'left';
        b.style.height = 'auto';
        if (st0.picked !== null) b.disabled = true;
      });
      st.set('ok', st0.right + ' из ' + st0.total);
      st.set('s', String(st0.streak));
      st.set('p', st0.total ? pct(st0.right / st0.total, 0) : '—');
      note.innerHTML = st0.picked === null ? 'Подсказка: рисуйте граф на бумаге — так задачи решаются вдвое быстрее.' : (st0.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет</b>, ответ: ' + Q.opts[Q.a] + '. ') + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), st0.picked === null ? 'Пропустить' : 'Следующий');
    }
    newQ();
  });
})();
