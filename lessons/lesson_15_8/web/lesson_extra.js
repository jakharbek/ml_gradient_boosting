/* Урок 15.8, часть 2 — оптимизация в нескольких переменных и бустинг.
 * Виджеты: зоопарк критических точек, гессиан и кривизна по направлениям, квадратичное приближение,
 * градиентный спуск по карте, овраг и метод Ньютона, множители Лагранжа, пространство параметров
 * линейной модели, пространство прогнозов двух объектов, градиент по вектору прогнозов (бустинг),
 * структура гессиана потерь, тренажёр.
 * Помощники — из lesson.js (GBC.lesson158). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const {
    SURF, grad, hess, gridOf, heightRange, levelsOf, rangeColor, heightColor, mapLayers, domOf, snap, dragPoint,
    contourSegs, Surface3D, pySurface, surfSelect, texInto, texEl, card, cardGrid, badge, rowTable, choiceButtons, heatCell,
    f2, f3, f4, py, vec, powFmt, decades, yDom,
  } = GBC.lesson158;
  const E = Math.exp;
  const sigma = (z) => U.sigmoid(z);
  const KIND = { min: { label: 'минимум', color: 'model' }, max: { label: 'максимум', color: 'tree' }, saddle: { label: 'седло', color: 'violet' }, flat: { label: 'тест молчит', color: 'muted' } };
  /** Тип критической точки по гессиану [fxx, fxy, fyy]. */
  function classify(h) {
    const det = h[0] * h[2] - h[1] * h[1];
    const tol = 1e-9 * (1 + Math.abs(h[0]) + Math.abs(h[2]));
    if (Math.abs(det) <= tol) return 'flat';
    if (det < 0) return 'saddle';
    return h[0] > 0 ? 'min' : 'max';
  }
  const hTex = (h, d = 3) => String.raw`H = \begin{pmatrix} ` + U.fmt(h[0], d) + ' & ' + U.fmt(h[1], d) + String.raw` \\ ` + U.fmt(h[1], d) + ' & ' + U.fmt(h[2], d) + String.raw` \end{pmatrix}`;
  /** Временная «поверхность» для произвольной функции (для mapLayers / Surface3D). */
  const tmpSurf = (f, dom, o = {}) => Object.assign({ f, dom, key: 'tmp' }, o);

  /* ==============================================================================
   * Шаг 18. Зоопарк критических точек
   * ============================================================================== */
  GBC.widget('critical-zoo', (el) => {
    const keys = ['round', 'dome', 'saddle', 'twist', 'cubic', 'quartic', 'wave', 'trough', 'monkey'];
    const s = { k: 'cubic', i: 0 };
    const w = ui.shell(el, { title: 'Критические точки: где ∇f = 0', sub: 'В критической точке склон горизонтален во всех направлениях: обе частные производные равны нулю. Но это может быть дно ямы, вершина или седло. Синие — минимумы, оранжевые — максимумы, фиолетовые — сёдла, серые — тест второго порядка молчит.', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      s.i = 0;
      mkSel();
      draw();
    });
    const selBox = H('div', { style: 'flex:1 1 220px' });
    w.controls.appendChild(selBox);
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const s3 = new Surface3D(box, { height: 310 });
    const map = new GBC.Plot(box, { height: 310, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const grid = cardGrid(250);
    w.main.appendChild(grid);
    const cH = card('Гессиан в выбранной точке', true);
    const cT = card('Все критические точки', true);
    grid.append(cH.el, cT.el);
    const note = w.note('', true);
    function mkSel() {
      const S = SURF[s.k];
      selBox.textContent = '';
      ui.select(selBox, { label: 'Точка', value: String(s.i), options: S.crit.map((c, i) => ({ value: String(i), label: '(' + f2(c[0]) + ', ' + f2(c[1]) + ')' })), onChange: (v) => ((s.i = Number(v)), draw()) });
    }
    function draw() {
      const S = SURF[s.k];
      const info = S.crit.map(([x, y]) => {
        const h = hess(S, x, y);
        return { x, y, f: S.f(x, y), h, det: h[0] * h[2] - h[1] * h[1], kind: classify(h) };
      });
      s.i = Math.min(s.i, info.length - 1);
      const cur = info[s.i];
      s3.render({ S, levels: levelsOf(S), points: info.map((c, i) => ({ x: c.x, y: c.y, z: c.f, color: KIND[c.kind].color, r: i === s.i ? 7 : 5 })) });
      map.render([
        ...mapLayers(S),
        { type: 'points', x: info.map((c) => c.x), y: info.map((c) => c.y), color: (i) => KIND[info[i].kind].color, r: (i) => (i === s.i ? 8 : 6), tooltip: (i) => [['точка', vec(info[i].x, info[i].y)], ['f', f3(info[i].f)], ['тип', KIND[info[i].kind].label]] },
      ], domOf(S));
      cH.body.textContent = '';
      cH.body.append(
        texEl(hTex(cur.h), true),
        H('div', null, GBC.richText('f_{xx} = ' + f3(cur.h[0]) + ', det H = f_{xx}·f_{yy} − f_{xy}^2 = ' + f3(cur.det))),
        H('div', { style: 'margin-top:6px' }, badge(KIND[cur.kind].label, cur.kind === 'flat' ? 'neutral' : 'good'))
      );
      rowTable(cT.body, ['точка', 'f', 'det H', 'тип'], info.map((c) => [vec(c.x, c.y), f3(c.f), f3(c.det), KIND[c.kind].label]), (i) => i === s.i, false);
      const why = {
        min: 'det H > 0 и f<sub>xx</sub> > 0: по всем направлениям чаша — <b>минимум</b>.',
        max: 'det H > 0 и f<sub>xx</sub> < 0: по всем направлениям купол — <b>максимум</b>.',
        saddle: 'det H < 0: в одних направлениях чаша, в других купол — <b>седло</b>. Градиентный спуск из почти любой точки рядом скатится с него.',
        flat: 'det H = 0: квадратичное приближение вырождено, второй порядок ничего не решает — надо смотреть на высшие члены или на сам рельеф.',
      }[cur.kind];
      const extra = { trough: ' У жёлоба x² минимумов бесконечно много — вся прямая x = 0; в каждой её точке det H = 0.', monkey: ' У обезьяньего седла в нуле H = 0, но это седло: по трём направлениям функция убывает.', wave: ' У волн критические точки повторяются в шахматном порядке: максимумы и минимумы, а между ними — сёдла.', cubic: ' Срез вдоль x — кубическая парабола: у неё горб и ямка, а вдоль y — всегда чаша. Поэтому горб превращается в седло.', quartic: ' Две симметричные ямы разделены седлом — «перевалом» между ними.' }[S.key] || '';
      note.innerHTML = 'В точке ' + vec(cur.x, cur.y) + ' градиент равен нулю. ' + why + extra;
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      return 'import numpy as np\n\nf = lambda x, y: ' + S.py + '\npoints = ' + JSON.stringify(S.crit.map((c) => c.map((v) => Number(v.toFixed(6))))) + '\nh = 1e-4\nfor x, y in points:\n    fxx = (f(x + h, y) - 2 * f(x, y) + f(x - h, y)) / h**2\n    fyy = (f(x, y + h) - 2 * f(x, y) + f(x, y - h)) / h**2\n    fxy = (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h)\n    det = fxx * fyy - fxy**2\n    kind = "тест молчит" if abs(det) < 1e-6 else "седло" if det < 0 else "минимум" if fxx > 0 else "максимум"\n    print(f"({x:+.3f}, {y:+.3f}): f = {f(x, y):+.4f}, det H = {det:+.3f} → {kind}")\n';
    });
    mkSel();
    draw();
  });

  /* ==============================================================================
   * Шаг 19. Гессиан: кривизна по направлениям
   * ============================================================================== */
  GBC.widget('hessian-curvature', (el) => {
    const s = { a: 2, b: 0, c: 6 };
    const w = ui.shell(el, { title: 'Гессиан — кривизна во всех направлениях', sub: 'Квадратичная функция q = ½(a·x² + 2b·xy + c·y²) задаётся гессианом H = [[a, b], [b, c]]. Кривизна вдоль направления u — uᵀHu: график внизу. Её наибольшее и наименьшее значения — собственные числа H, направления — собственные векторы (пунктир на карте).', stack: true });
    const sl = {};
    const mk = (k, label) => (sl[k] = ui.slider(w.controls, { label, min: -4, max: 4, step: 0.1, value: s[k], onInput: (v) => ((s[k] = v), draw()) }));
    mk('a', 'a = f_{xx}');
    mk('b', 'b = f_{xy}');
    mk('c', 'c = f_{yy}');
    const bx = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end' });
    w.controls.appendChild(bx);
    const preset = (a, b, c) => () => {
      Object.assign(s, { a, b, c });
      sl.a.set(a);
      sl.b.set(b);
      sl.c.set(c);
      draw();
    };
    ui.button(bx, { label: 'чаша', small: true, onClick: preset(2, 0, 6) });
    ui.button(bx, { label: 'купол', small: true, onClick: preset(-2, 0, -2) });
    ui.button(bx, { label: 'седло', small: true, onClick: preset(2, 0, -2) });
    ui.button(bx, { label: 'ловушка x² + 4xy + y²', small: true, onClick: preset(2, 4, 2) });
    ui.button(bx, { label: 'жёлоб (det = 0)', small: true, onClick: preset(2, 2, 2) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const s3 = new Surface3D(box, { height: 290 });
    const map = new GBC.Plot(box, { height: 290, equal: true, x: { label: 'x', domain: [-2, 2] }, y: { label: 'y', domain: [-2, 2] }, grid: 'none' });
    const kp = new GBC.Plot(w.main, { height: 210, x: { label: 'направление u, градусы', domain: [0, 180], ticks: [0, 45, 90, 135, 180] }, y: { label: 'кривизна uᵀHu' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'det', label: 'det H = ac − b²' }, { key: 'tr', label: 'след a + c' }, { key: 'l', label: 'собственные числа λ₁, λ₂' }, { key: 'k', label: 'тип' }]);
    function draw() {
      const { a, b, c } = s;
      const q = (x, y) => 0.5 * (a * x * x + 2 * b * x * y + c * y * y);
      const S = tmpSurf(q, [-2, 2, -2, 2]);
      const m = (a + c) / 2;
      const r = Math.hypot((a - c) / 2, b);
      const l1 = m + r;
      const l2 = m - r;
      const th = 0.5 * Math.atan2(2 * b, a - c);
      const kind = classify([a, b, c]);
      s3.render({ S, levels: levelsOf(S), n: 30 });
      const dirs = [[th, l1], [th + Math.PI / 2, l2]];
      map.render([
        ...mapLayers(S),
        { type: 'segments', x1: dirs.map(([t]) => -2.2 * Math.cos(t)), y1: dirs.map(([t]) => -2.2 * Math.sin(t)), x2: dirs.map(([t]) => 2.2 * Math.cos(t)), y2: dirs.map(([t]) => 2.2 * Math.sin(t)), color: 'tree', width: 1.8, dash: '6 4', opacity: 0.95 },
        { type: 'text', items: dirs.map(([t, l], i) => ({ x: 1.55 * Math.cos(t), y: 1.55 * Math.sin(t), dx: 4, dy: -6, text: 'λ' + (i ? '₂' : '₁') + ' = ' + f2(l), bold: true })) },
      ], { x: [-2, 2], y: [-2, 2] });
      const angs = U.linspace(0, 180, 181);
      const kf = (deg) => {
        const t = (deg * Math.PI) / 180;
        return a * Math.cos(t) ** 2 + 2 * b * Math.sin(t) * Math.cos(t) + c * Math.sin(t) ** 2;
      };
      const deg = (t) => ((((t * 180) / Math.PI) % 180) + 180) % 180;
      kp.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: angs, y: angs.map(kf), color: 'model', width: 2.4, hover: false },
        { type: 'points', x: [deg(th), deg(th + Math.PI / 2)], y: [l1, l2], color: 'tree', r: 6, tooltip: (i) => [['λ' + (i ? '₂' : '₁'), f3(i ? l2 : l1)]] },
      ], { y: yDom([...angs.map(kf), 0, l1, l2], 0.12) });
      st.set('det', f3(a * c - b * b));
      st.set('tr', f3(a + c));
      st.set('l', f3(l1) + ', ' + f3(l2));
      st.set('k', KIND[kind].label);
      const trap = a > 0 && c > 0 && kind === 'saddle';
      note.innerHTML = {
        min: 'Обе кривизны (λ₁, λ₂) положительны: <b>чаша, минимум</b>. Отношение λ₁/λ₂ = ' + f2(l1 / l2) + ' — насколько чаша вытянута (число обусловленности, шаг 22).',
        max: 'Обе кривизны отрицательны: <b>купол, максимум</b>.',
        saddle: 'Кривизны разных знаков: <b>седло</b>.' + (trap ? ' <b>Ловушка:</b> f<sub>xx</sub> > 0 и f<sub>yy</sub> > 0 — вдоль осей чаша, но перекрёстный член b перевешивает: вдоль диагонали кривизна отрицательна. Поэтому нельзя судить по одной диагонали гессиана — нужен det H.' : ''),
        flat: 'Одна кривизна равна нулю: <b>det H = 0</b>, в этом направлении квадратичная функция плоская — получается жёлоб. Тест второго порядка не решает.',
      }[kind];
    }
    w.pythonAction(() => 'import numpy as np\n\nH = np.array([[' + py(s.a) + ', ' + py(s.b) + '], [' + py(s.b) + ', ' + py(s.c) + ']])\nlam, vecs = np.linalg.eigh(H)            # собственные числа и векторы симметричной матрицы\nprint("det H =", np.linalg.det(H).round(4), " λ =", lam.round(4))\nfor deg in [0, 45, 90, 135]:\n    u = np.array([np.cos(np.radians(deg)), np.sin(np.radians(deg))])\n    print(f"кривизна вдоль {deg:3}°: uᵀHu = {u @ H @ u:+.3f}")\nprint("направления главных кривизн:\\n", vecs.round(4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 20. Квадратичное приближение (Тейлор второго порядка)
   * ============================================================================== */
  GBC.widget('taylor2d', (el) => {
    const keys = ['ecos', 'hill', 'wave', 'valley', 'bowl'];
    const s = { k: 'ecos', order: 2 };
    const reset = () => {
      const S = SURF[s.k];
      s.a = { x: S.p0[0], y: S.p0[1] };
      const span = Math.min(S.dom[1] - S.dom[0], S.dom[3] - S.dom[2]);
      s.p = { x: snap(S.p0[0] + 0.1 * span), y: snap(S.p0[1] + 0.12 * span) };
    };
    reset();
    const w = ui.shell(el, { title: 'Квадратичное приближение: плоскость плюс гессиан', sub: 'Около центра a (оранжевая точка) функцию заменяет многочлен Тейлора: первого порядка (плоскость) или второго (с гессианом). Пунктир на карте — линии уровня приближения, серые — настоящей функции. Фиолетовая точка — место, где сравниваем значения.', stack: true });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      reset();
      draw();
    });
    ui.segmented(w.controls, { label: 'Порядок приближения', value: 2, options: [{ value: 1, label: '1: плоскость' }, { value: 2, label: '2: + ½ΔᵀHΔ' }], onChange: (v) => ((s.order = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const s3 = new Surface3D(box, { height: 300 });
    const map = new GBC.Plot(box, { height: 300, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'f в фиолетовой точке' }, { key: 't1', label: 'плоскость (ошибка)' }, { key: 't2', label: 'квадратичное (ошибка)' }, { key: 'd', label: '|Δ|' }]);
    function draw() {
      const S = SURF[s.k];
      const { a, p } = s;
      const fa = S.f(a.x, a.y);
      const [gx, gy] = grad(S, a.x, a.y);
      const [hxx, hxy, hyy] = hess(S, a.x, a.y);
      const T1 = (x, y) => fa + gx * (x - a.x) + gy * (y - a.y);
      const T2 = (x, y) => { const dx = x - a.x; const dy = y - a.y; return T1(x, y) + 0.5 * (hxx * dx * dx + 2 * hxy * dx * dy + hyy * dy * dy); };
      const T = s.order === 1 ? T1 : T2;
      const span = Math.min(S.dom[1] - S.dom[0], S.dom[3] - S.dom[2]);
      const R = span * 0.3;
      const win = [Math.max(S.dom[0], a.x - R), Math.min(S.dom[1], a.x + R), Math.max(S.dom[2], a.y - R), Math.min(S.dom[3], a.y + R)];
      s3.render({ S, levels: [], planes: [{ f: T, dom: win, color: 'tree', alpha: 0.4, n: 18 }], points: [{ x: a.x, y: a.y, color: 'tree', r: 5.5 }, { x: p.x, y: p.y, color: 'violet', r: 5.5 }] });
      const tg = GBC.Plot.grid(T, win[0], win[1], win[2], win[3], 60, 60);
      map.render([
        ...mapLayers(S),
        ...levelsOf(S).map((lv) => ({ type: 'contour', grid: tg, level: lv, color: 'tree', width: 1.6, dash: '5 4' })),
        { type: 'rect', x0: win[0], x1: win[1], y0: win[2], y1: win[3], stroke: 'tree', width: 1, opacity: 0 },
        dragPoint(a, S.dom, draw),
        dragPoint(p, S.dom, draw, { color: 'violet', r: 6 }),
      ], domOf(S));
      const fp = S.f(p.x, p.y);
      const v1 = T1(p.x, p.y);
      const v2 = T2(p.x, p.y);
      st.set('f', f4(fp));
      st.set('t1', f4(v1) + ' (' + U.fmt(Math.abs(fp - v1), 2) + ')');
      st.set('t2', f4(v2) + ' (' + U.fmt(Math.abs(fp - v2), 2) + ')');
      st.set('d', f3(Math.hypot(p.x - a.x, p.y - a.y)));
      note.innerHTML = 'f(a + Δ) ≈ f(a) + ∇f·Δ + ½ΔᵀHΔ. В центре: f = ' + f3(fa) + ', ∇f = ' + vec(gx, gy) + ', гессиан [[' + f2(hxx) + ', ' + f2(hxy) + '], [' + f2(hxy) + ', ' + f2(hyy) + ']]. Плоскость ошибается на величину порядка |Δ|², квадратичное приближение — порядка |Δ|³: двигайте фиолетовую точку к центру и сравнивайте ошибки. ' + (S.key === 'bowl' ? 'У квадратичной функции x² + 3y² приближение второго порядка <b>точное</b> везде.' : 'Пунктирные линии уровня второго порядка повторяют форму настоящих около центра — эллипсы для ямы, гиперболы для седла.');
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      return 'import numpy as np\n\nf = lambda x, y: ' + S.py + '\na = np.array([' + py(s.a.x) + ', ' + py(s.a.y) + '])\np = np.array([' + py(s.p.x) + ', ' + py(s.p.y) + '])\nh = 1e-4\ng = np.array([(f(a[0] + h, a[1]) - f(a[0] - h, a[1])) / (2 * h), (f(a[0], a[1] + h) - f(a[0], a[1] - h)) / (2 * h)])\nfxx = (f(a[0] + h, a[1]) - 2 * f(*a) + f(a[0] - h, a[1])) / h**2\nfyy = (f(a[0], a[1] + h) - 2 * f(*a) + f(a[0], a[1] - h)) / h**2\nfxy = (f(a[0] + h, a[1] + h) - f(a[0] + h, a[1] - h) - f(a[0] - h, a[1] + h) + f(a[0] - h, a[1] - h)) / (4 * h * h)\nH = np.array([[fxx, fxy], [fxy, fyy]])\nfor t in [1, 0.5, 0.1]:\n    d = t * (p - a)\n    T1 = f(*a) + g @ d\n    T2 = T1 + 0.5 * d @ H @ d\n    print(f"|Δ| = {np.linalg.norm(d):.4f}: ошибка плоскости {abs(f(*(a + d)) - T1):.2e}, квадратичного {abs(f(*(a + d)) - T2):.2e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 21. Градиентный спуск по карте
   * ============================================================================== */
  function descend(S, x, y, eta, K) {
    const px = [x];
    const py_ = [y];
    let div = false;
    for (let k = 0; k < K; k++) {
      const [gx, gy] = grad(S, px[k], py_[k]);
      const nx = px[k] - eta * gx;
      const ny = py_[k] - eta * gy;
      if (!Number.isFinite(nx) || !Number.isFinite(ny) || Math.abs(nx) > 1e3 || Math.abs(ny) > 1e3) {
        div = true;
        break;
      }
      px.push(nx);
      py_.push(ny);
    }
    return { px, py: py_, div };
  }
  GBC.widget('descent-map', (el) => {
    const keys = ['bowl', 'round', 'valley', 'pits', 'saddle', 'cubic', 'quartic'];
    const START = { bowl: [-2, 1.6], round: [-1.6, 1.4], valley: [-1, 2], pits: [-0.1, -1.2], saddle: [-1.8, 0.05], cubic: [0.2, 1.5], quartic: [0.3, -1.4] };
    const ETA = { bowl: 0.15, round: 0.15, valley: 0.02, pits: 0.3, saddle: 0.1, cubic: 0.1, quartic: 0.05 };
    const K = 80;
    const s = { k: 'bowl', m: 0, cmp: false };
    [s.x, s.y] = START[s.k];
    s.eta = ETA[s.k];
    const w = ui.shell(el, { title: 'Градиентный спуск по карте', sub: 'Каждый шаг: (x, y) ← (x, y) − η·∇f(x, y). Кликните по карте, чтобы выбрать старт, и запустите ▶. Внизу — длина градиента |∇f| по шагам (логарифмическая шкала): у минимума она стремится к нулю.' });
    surfSelect(w.controls, keys, s.k, (v) => {
      s.k = v;
      [s.x, s.y] = START[v];
      s.eta = ETA[v];
      etaS.set(s.eta);
      draw();
    });
    const etaS = ui.slider(w.controls, { label: 'темп η', min: 0.005, max: 0.5, step: 0.005, value: s.eta, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.eta = v), draw()) });
    const pl = ui.player(w.controls, { label: 'Шаги', min: 0, max: K, value: 0, fps: 8, format: (v) => 'k = ' + v, onChange: (v) => ((s.m = v), draw()) });
    ui.toggle(w.controls, { label: 'Сравнить с η/2 и 2η', checked: false, onChange: (v) => ((s.cmp = v), draw()) });
    const map = new GBC.Plot(w.main, { height: 340, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    map.onClick = (x, y) => {
      s.x = x;
      s.y = y;
      pl.stop();
      pl.set(0);
      s.m = 0;
      draw();
    };
    const gp = new GBC.Plot(w.main, { height: 200, x: { label: 'шаг k', domain: [0, K] }, y: { label: '|∇f|', type: 'log', domain: [1e-8, 1e3], ticks: decades(-8, 3), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'шаг' }, { key: 'p', label: 'точка' }, { key: 'f', label: 'f' }, { key: 'g', label: '|∇f|' }]);
    function draw() {
      const S = SURF[s.k];
      const runs = [{ eta: s.eta, color: 'tree', main: true }];
      if (s.cmp) runs.push({ eta: s.eta / 2, color: 'aqua' }, { eta: s.eta * 2, color: 'violet' });
      const layers = [...mapLayers(S)];
      const gl = [];
      let mainRun = null;
      for (const r of runs) {
        const full = descend(S, s.x, s.y, r.eta, K);
        const n = Math.min(s.m, full.px.length - 1);
        const px = full.px.slice(0, n + 1);
        const pyy = full.py.slice(0, n + 1);
        layers.push({ type: 'line', x: px, y: pyy, color: r.color, width: 1.8, hover: false });
        layers.push({ type: 'points', x: px, y: pyy, color: r.color, r: r.main ? 3.4 : 2.6, tooltip: (i) => [['шаг', String(i)], ['f', f4(S.f(px[i], pyy[i]))]] });
        const gn = full.px.map((x, i) => Math.max(1e-8, Math.hypot(...grad(S, x, full.py[i]))));
        gl.push({ type: 'line', x: U.range(gn.length), y: gn, color: r.color, width: r.main ? 2.2 : 1.6, label: 'η = ' + U.fmt(r.eta, 3) + (full.div ? ' (расходится)' : '') });
        if (r.main) mainRun = { px, py: pyy, full };
      }
      layers.push({ type: 'points', x: [s.x], y: [s.y], color: 'ink', r: 6, hollow: true });
      map.render(layers, domOf(S));
      gp.render([...gl, { type: 'vline', x: s.m, color: 'muted', dash: '4 4' }]);
      const { px, py: pyy, full } = mainRun;
      const last = px.length - 1;
      const [gx, gy] = grad(S, px[last], pyy[last]);
      st.set('k', String(last) + (full.div && s.m >= full.px.length - 1 ? ' (стоп: расходится)' : ''));
      st.set('p', vec(px[last], pyy[last], 3));
      st.set('f', f4(S.f(px[last], pyy[last])));
      st.set('g', U.fmt(Math.hypot(gx, gy), 3));
      const e = s.eta;
      note.innerHTML = {
        bowl: 'Для x² + 3y² спуск идёт по координатам независимо: x ← (1 − 2η)·x, y ← (1 − 6η)·y. Сейчас множители ' + f2(1 - 2 * e) + ' и ' + f2(1 - 6 * e) + '. ' + (Math.abs(1 - 6 * e) >= 1 ? '<b>|1 − 6η| ≥ 1 — по y спуск расходится</b> (η ≥ 1/3).' : 1 - 6 * e < 0 ? 'Множитель по y отрицательный — спуск перелетает дно и идёт <b>зигзагом</b> по y.' : 'Оба множителя положительны — спуск монотонный, без зигзага.') + ' Быстрее всего при η = 0.25: оба множителя по модулю 0.5, хватает 12 шагов до f < 10⁻⁶.',
        round: 'Круглая чаша — идеальный случай: антиградиент смотрит прямо в центр, и спуск идёт по прямой. При η = 0.5 он попадает в минимум за один шаг.',
        valley: 'В изогнутой долине антиградиент смотрит поперёк долины, а не вдоль неё: спуск быстро падает на дно, а потом ползёт к минимуму (1, 1) крошечными шагами. При η > 0.05 он начинает метаться между стенками.',
        pits: 'С двумя ямами результат зависит от старта: спуск находит ближайшую яму, необязательно самую глубокую. Кликните в разных местах карты.',
        saddle: 'Старт почти на оси x: спуск сначала идёт к седлу (по x — чаша), но малейшее отклонение по y растёт как (1 + 2η)ᵏ — и точка соскальзывает с седла. Сёдла неустойчивы для спуска.',
        cubic: 'Яма в (1, 0) и седло в (−1, 0). Слева от седла функция падает в −∞: спуск оттуда уходит за край карты.',
        quartic: 'Две одинаковые ямы: в какую попадёт спуск, решает старт — по какую сторону от «водораздела» через седло он находится.',
      }[S.key];
    }
    w.pythonAction(() => {
      const S = SURF[s.k];
      return 'import numpy as np\n\nf = lambda x, y: ' + S.py + '\n\ndef grad(p, e=1e-6):\n    x, y = p\n    return np.array([(f(x + e, y) - f(x - e, y)) / (2 * e), (f(x, y + e) - f(x, y - e)) / (2 * e)])\n\nfor eta in [' + py(s.eta / 2) + ', ' + py(s.eta) + ', ' + py(s.eta * 2) + ']:\n    p = np.array([' + py(s.x) + ', ' + py(s.y) + '])\n    for k in range(' + K + '):\n        p = p - eta * grad(p)              # шаг против градиента\n        if np.abs(p).max() > 1e3:\n            break\n    print(f"η = {eta}: после {k + 1} шагов p = {p.round(5)}, f = {f(*p):.3e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 22. Овраг: обусловленность, масштаб и метод Ньютона
   * ============================================================================== */
  GBC.widget('ravine', (el) => {
    const s = { kap: 10, ek: 20 / 11, scaled: false, m: 30 };
    const w = ui.shell(el, { title: 'Овраг: почему спуск медленный и как Ньютон его выпрямляет', sub: 'f = ½(x² + κy²): кривизна по x равна 1, по y — κ (число обусловленности). За шаг спуска x умножается на 1 − η, а y — на 1 − ηκ. Шаг ограничен самым крутым направлением (ηκ < 2), поэтому по пологому x спуск ползёт. Метод Ньютона Δ = −H⁻¹∇f делит градиент на кривизну каждого направления и прыгает в дно за один шаг.' });
    const best = () => (2 * s.kap) / (1 + s.kap);
    const ekS = ui.slider(w.controls, { label: 'ηκ (по y за шаг: × (1 − ηκ))', min: 0.1, max: 2.1, step: 0.01, value: s.ek, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.ek = v), draw()) });
    ui.slider(w.controls, { label: 'κ (во сколько раз y круче x)', min: 1, max: 100, log: true, value: s.kap, format: (v) => U.fmt(v, 3), onInput: (v) => {
      s.kap = v;
      s.ek = best();
      ekS.set(s.ek);
      draw();
    } });
    ui.button(w.controls, { label: 'лучший шаг η = 2/(1 + κ)', small: true, onClick: () => ((s.ek = best()), ekS.set(s.ek), draw()) });
    ui.slider(w.controls, { label: 'показать шагов', min: 1, max: 60, step: 1, value: s.m, onInput: (v) => ((s.m = v), draw()) });
    ui.toggle(w.controls, { label: 'Масштабировать: v = √κ·y', checked: false, onChange: (v) => ((s.scaled = v), draw()) });
    const map = new GBC.Plot(w.main, { height: 300, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const lp = new GBC.Plot(w.main, { height: 210, x: { label: 'шаг k', domain: [0, 60] }, y: { label: 'f / f₀', type: 'log', domain: [1e-12, 10], ticks: decades(-12, 0, 2), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'eta', label: 'η' }, { key: 'q', label: 'худший множитель за шаг' }, { key: 'n', label: 'шагов до f < 10⁻⁶·f₀' }, { key: 'nw', label: 'Ньютон' }]);
    function draw() {
      const kap = s.scaled ? 1 : s.kap;
      const f = (x, y) => 0.5 * (x * x + kap * y * y);
      const eta = s.scaled ? 1 : s.ek / s.kap;
      const x0 = 2;
      const y0 = s.scaled ? Math.sqrt(s.kap) : 1;
      const f0 = f(x0, y0);
      const path = [[x0, y0]];
      for (let k = 0; k < 60; k++) {
        const [x, y] = path[k];
        const nx = x - eta * x;
        const ny = y - eta * kap * y;
        if (Math.abs(nx) > 1e6 || Math.abs(ny) > 1e6) break;
        path.push([nx, ny]);
      }
      let count = 0;
      let x = x0;
      let y = y0;
      while (f(x, y) > 1e-6 * f0 && count < 20000) {
        x -= eta * x;
        y -= eta * kap * y;
        count++;
        if (Math.abs(y) > 1e6) {
          count = Infinity;
          break;
        }
      }
      const ext = Math.max(2.4, y0 * 1.25);
      const dom = [-2.6, 2.6, -ext, ext];
      const S = { f, dom, key: 'rav', levels: [0.02, 0.1, 0.3, 0.7, 1.3, 2.2, 3.5].map((v) => v * f0 / 3) };
      const shown = path.slice(0, s.m + 1);
      map.render([
        ...mapLayers(S, { heat: false }),
        { type: 'line', x: shown.map((p) => p[0]), y: shown.map((p) => p[1]), color: 'tree', width: 1.8, label: 'спуск', hover: false },
        { type: 'points', x: shown.map((p) => p[0]), y: shown.map((p) => p[1]), color: 'tree', r: 3 },
        { type: 'arrows', x1: [x0], y1: [y0], x2: [0], y2: [0], color: 'violet', width: 2.2 },
        { type: 'points', x: [x0, 0], y: [y0, 0], color: (i) => (i ? 'violet' : 'ink'), r: (i) => (i ? 5 : 6), hollow: true, label: 'Ньютон: один шаг' },
      ], domOf(S));
      const ks = U.range(path.length);
      lp.render([
        { type: 'line', x: ks, y: ks.map((k) => Math.max(1e-12, f(...path[k]) / f0)), color: 'tree', width: 2.2, label: 'градиентный спуск' },
        { type: 'line', x: [0, 1, 60], y: [1, 1e-12, 1e-12], color: 'violet', width: 2, dash: '5 4', label: 'Ньютон' },
        { type: 'hline', y: 1e-6, color: 'muted', dash: '3 3', width: 1 },
      ]);
      const q = Math.max(Math.abs(1 - eta), Math.abs(1 - eta * kap));
      st.set('eta', U.fmt(eta, 3));
      st.set('q', U.fmt(q, 3));
      st.set('n', !Number.isFinite(count) ? 'расходится' : count >= 20000 ? '> 20000' : String(count));
      st.set('nw', '1 шаг');
      note.innerHTML = (s.scaled
        ? '<b>После замены v = √κ·y</b> функция стала ½(x² + v²) — круглая чаша, κ = 1. Спуск идёт прямо в центр, а при η = 1 попадает за один шаг. Это смысл <b>масштабирования признаков</b> перед градиентными методами (линейные модели, нейросети). Деревьям оно не нужно: разбиения не зависят от масштаба (урок 2.4).'
        : 'Каждый шаг умножает x на (1 − η), а y — на (1 − ηκ). Устойчивость требует |1 − ηκ| < 1, то есть η < 2/κ, и тогда по x множитель близок к 1 — спуск ползёт. Лучший выбор η = 2/(1 + κ) даёт множитель (κ − 1)/(κ + 1): при κ = 10 — 35 шагов до 10⁻⁶, при κ = 100 — 346. ') +
        ' Метод Ньютона делит каждую координату градиента на свою кривизну: Δ = −(x/1, κy/κ) = −(x, y) — ровно в минимум. В бустинге так устроены листья XGBoost: шаг −G/(H + λ) делит градиент на кривизну (урок 15.7).';
    }
    w.pythonAction(() => 'import numpy as np\n\nfor kappa in [1, 10, 100]:\n    eta = 2 / (1 + kappa)                     # лучший постоянный шаг\n    p = np.array([2.0, 1.0])\n    f = lambda p: 0.5 * (p[0]**2 + kappa * p[1]**2)\n    f0, k = f(p), 0\n    while f(p) > 1e-6 * f0:\n        p = p - eta * np.array([p[0], kappa * p[1]])\n        k += 1\n    H = np.diag([1.0, kappa])\n    newton = np.array([2.0, 1.0]) - np.linalg.solve(H, np.array([2.0, kappa * 1.0]))\n    print(f"κ = {kappa:3}: спуск {k:3} шагов, Ньютон за 1 шаг → {newton}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 23. Оптимум с ограничением: множители Лагранжа
   * ============================================================================== */
  GBC.widget('lagrange', (el) => {
    const FUN = {
      lin: { label: 'f = x + 2y', f: (x, y) => x + 2 * y, g: () => [1, 2], py: 'x + 2 * y' },
      bowl: { label: 'f = x² + 3y²', f: (x, y) => x * x + 3 * y * y, g: (x, y) => [2 * x, 6 * y], py: 'x**2 + 3 * y**2' },
      xy: { label: 'f = xy', f: (x, y) => x * y, g: (x, y) => [y, x], py: 'x * y' },
    };
    const CON = {
      circle: { label: 'окружность x² + y² = 1', at: (t) => [Math.cos(t), Math.sin(t)], g: (x, y) => [2 * x, 2 * y], t: [0, 2 * Math.PI], pl: 'угол θ, градусы', show: (t) => (t * 180) / Math.PI, py: ['np.cos(t)', 'np.sin(t)'], range: 'np.linspace(0, 2 * np.pi, 3601)' },
      line: { label: 'прямая x + y = 1', at: (t) => [t, 1 - t], g: () => [1, 1], t: [-1.5, 2.5], pl: 'x на прямой', show: (t) => t, py: ['t', '1 - t'], range: 'np.linspace(-1.5, 2.5, 4001)' },
    };
    const s = { f: 'lin', c: 'circle', t: 0.3 };
    const w = ui.shell(el, { title: 'Экстремум на кривой: градиенты параллельны', sub: 'Ищем наибольшее или наименьшее f, двигаясь только по оранжевой кривой g(x, y) = 0. Двигайте точку по кривой. В точке оптимума линия уровня f касается кривой, а градиенты ∇f (синий) и ∇g (оранжевый) лежат на одной прямой: ∇f = λ∇g.', stack: true });
    ui.select(w.controls, { label: 'Функция', value: s.f, options: Object.entries(FUN).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.f = v), draw()) });
    ui.select(w.controls, { label: 'Ограничение', value: s.c, options: Object.entries(CON).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.c = v), (s.t = v === 'circle' ? 0.3 : 0.2), mkT(), draw()) });
    const tBox = H('div', { style: 'flex:1 1 220px' });
    w.controls.appendChild(tBox);
    let tS = null;
    const mkT = () => {
      const C = CON[s.c];
      tBox.textContent = '';
      tS = ui.slider(tBox, { label: 'положение на кривой', min: C.t[0], max: C.t[1], step: (C.t[1] - C.t[0]) / 720, value: s.t, format: (v) => U.fmt(C.show(v), 3), onInput: (v) => ((s.t = v), draw()) });
    };
    const bx = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end' });
    w.controls.appendChild(bx);
    const best = (sgn) => () => {
      const F = FUN[s.f];
      const C = CON[s.c];
      const ts = U.linspace(C.t[0], C.t[1], 3601);
      const vals = ts.map((t) => sgn * F.f(...C.at(t)));
      s.t = ts[U.argmax(vals)];
      tS.set(s.t);
      draw();
    };
    ui.button(bx, { label: 'к максимуму', small: true, onClick: best(1) });
    ui.button(bx, { label: 'к минимуму', small: true, onClick: best(-1) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const map = new GBC.Plot(box, { height: 300, equal: true, x: { label: 'x', domain: [-2, 2] }, y: { label: 'y', domain: [-2, 2] }, grid: 'none' });
    const fp = new GBC.Plot(box, { height: 300, x: { label: 'положение на кривой' }, y: { label: 'f на кривой' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'точка' }, { key: 'f', label: 'f' }, { key: 'ang', label: 'угол между ∇f и ∇g' }, { key: 'lam', label: 'λ = ∇f·∇g / |∇g|²' }]);
    function draw() {
      const F = FUN[s.f];
      const C = CON[s.c];
      const S = { f: F.f, dom: [-2, 2, -2, 2], key: 'lag-' + s.f };
      const [x, y] = C.at(s.t);
      const gf = F.g(x, y);
      const gg = C.g(x, y);
      const nf = Math.hypot(...gf);
      const ng = Math.hypot(...gg);
      const cos = (gf[0] * gg[0] + gf[1] * gg[1]) / (nf * ng || 1);
      const ang = nf > 1e-12 ? (Math.acos(U.clamp(cos, -1, 1)) * 180) / Math.PI : 0;
      const lam = (gf[0] * gg[0] + gf[1] * gg[1]) / (ng * ng);
      const ts = U.linspace(C.t[0], C.t[1], 361);
      const route = ts.map(C.at);
      const grid = gridOf(S, S.dom, 120);
      const L = 0.55;
      map.render([
        ...mapLayers(S),
        { type: 'contour', grid, level: F.f(x, y), color: 'model', width: 1.6, dash: '5 4' },
        { type: 'line', x: route.map((p) => p[0]), y: route.map((p) => p[1]), color: 'tree', width: 2.6, hover: false },
        { type: 'arrows', x1: [x], y1: [y], x2: [x + (L * gg[0]) / ng], y2: [y + (L * gg[1]) / ng], color: 'tree', width: 2.4 },
        { type: 'arrows', x1: nf > 1e-12 ? [x] : [], y1: nf > 1e-12 ? [y] : [], x2: [x + (L * gf[0]) / (nf || 1)], y2: [y + (L * gf[1]) / (nf || 1)], color: 'model', width: 2.6 },
        { type: 'points', x: [x], y: [y], color: 'ink', r: 6 },
      ], { x: [-2, 2], y: [-2, 2] });
      const fv = ts.map((t) => F.f(...C.at(t)));
      fp.opts.x.label = C.pl;
      fp.render([
        { type: 'line', x: ts.map(C.show), y: fv, color: 'model', width: 2.4, hover: false },
        { type: 'points', x: [C.show(s.t)], y: [F.f(x, y)], color: 'ink', r: 6 },
      ], { y: yDom(fv) });
      const par = Math.min(ang, 180 - ang) < 0.6;
      st.set('p', vec(x, y, 3));
      st.set('f', f4(F.f(x, y)));
      st.set('ang', U.fmt(ang, 1) + '°');
      st.set('lam', par ? f3(lam) : '—');
      const unb = s.f === 'lin' && s.c === 'line';
      note.innerHTML = (par ? '<b>Градиенты параллельны</b> — это кандидат в экстремум: двигаясь вдоль кривой, мы идём поперёк ∇f, и f не меняется в первом порядке. ' : 'Градиенты не параллельны: у ∇f есть составляющая вдоль кривой, значит, сдвиг по кривой в эту сторону увеличит f — точка не оптимальна. ') +
        (unb ? 'Здесь f = x + 2y на прямой x + y = 1 равна 2 − x: она неограниченно растёт и падает — экстремума нет, а градиенты (1, 2) и (1, 1) не параллельны нигде.' : 'Метод множителей Лагранжа: решаем систему ∇f = λ∇g, g = 0. Число λ показывает, на сколько изменится оптимум, если чуть сдвинуть ограничение. В машинном обучении ограничения обычно заменяют штрафами (L1, L2 — урок 15.15), а в бустинге — монотонными ограничениями и регуляризацией листьев.');
    }
    w.pythonAction(() => {
      const F = FUN[s.f];
      const C = CON[s.c];
      return 'import numpy as np\n\nf = lambda x, y: ' + F.py + '\nt = ' + C.range + '\nx, y = ' + C.py[0] + ', ' + C.py[1] + '          # точки на кривой g = 0\nv = f(x, y)\nfor name, i in [("максимум", v.argmax()), ("минимум", v.argmin())]:\n    print(f"{name}: ({x[i]:+.4f}, {y[i]:+.4f}), f = {v[i]:+.4f}")\n';
    });
    mkT();
    draw();
  });

  /* ==============================================================================
   * Шаг 24. Потери как функция параметров: линейная регрессия на шести квартирах
   * ============================================================================== */
  GBC.widget('param-space', (el) => {
    const toy = GBC.datasets.toyRegression();
    const X = toy.x;
    const Y = toy.y;
    const n = X.length;
    const xm = U.mean(X);
    const s = { cen: false, eta: 0.05, w: 0, b: 0, path: [[0, 0]] };
    const xs = () => (s.cen ? X.map((v) => v - xm) : X);
    const loss = (w, b) => { const xx = xs(); return U.mean(xx.map((x, i) => (Y[i] - w * x - b) ** 2)); };
    const gradL = (w, b) => {
      const xx = xs();
      const r = xx.map((x, i) => Y[i] - w * x - b);
      return [(-2 / n) * U.sum(r.map((ri, i) => ri * xx[i])), (-2 / n) * U.sum(r)];
    };
    const w_ = ui.shell(el, { title: 'Потери как рельеф над плоскостью параметров', sub: 'Прямая y = w·x + b и шесть квартир. Справа — средний квадрат ошибки L(w, b) как карта над плоскостью параметров: каждая точка карты — целая прямая слева. Тяните точку по карте или делайте шаги градиентного спуска.', stack: true });
    const w = w_;
    const etaS = ui.slider(w.controls, { label: 'темп η', min: 0.005, max: 0.35, step: 0.005, value: s.eta, format: (v) => U.fmt(v, 3), onInput: (v) => (s.eta = v) });
    const bx = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end' });
    w.controls.appendChild(bx);
    const step = (k) => () => {
      for (let i = 0; i < k; i++) {
        const [gw, gb] = gradL(s.w, s.b);
        s.w -= s.eta * gw;
        s.b -= s.eta * gb;
        if (!Number.isFinite(s.w) || Math.abs(s.w) > 1e4 || Math.abs(s.b) > 1e4) {
          s.w = U.clamp(s.w || 0, -1e4, 1e4);
          s.b = U.clamp(s.b || 0, -1e4, 1e4);
          break;
        }
        s.path.push([s.w, s.b]);
      }
      draw();
    };
    ui.button(bx, { label: 'шаг', small: true, kind: 'primary', onClick: step(1) });
    ui.button(bx, { label: '10 шагов', small: true, onClick: step(10) });
    ui.button(bx, { label: '100 шагов', small: true, onClick: step(100) });
    ui.button(bx, { label: 'сброс', small: true, onClick: () => ((s.w = 0), (s.b = 0), (s.path = [[0, 0]]), draw()) });
    ui.toggle(w.controls, { label: 'Центрировать x (x − 3.5)', checked: false, onChange: (v) => {
      s.cen = v;
      s.w = 0;
      s.b = 0;
      s.path = [[0, 0]];
      s.eta = v ? 0.25 : 0.05;
      etaS.set(s.eta);
      draw();
    } });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const dp = new GBC.Plot(box, { height: 300, x: { label: s.cen ? 'x − 3.5' : 'площадь x' }, y: { label: 'цена y' } });
    const map = new GBC.Plot(box, { height: 300, x: { label: 'наклон w' }, y: { label: 'сдвиг b' }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'wb', label: '(w, b)' }, { key: 'L', label: 'L(w, b)' }, { key: 'g', label: '∇L' }, { key: 'k', label: 'шагов' }]);
    function draw() {
      const xx = xs();
      const sx = U.sum(xx);
      const sxx = U.sum(xx.map((v) => v * v));
      const sy = U.sum(Y);
      const sxy = U.sum(xx.map((v, i) => v * Y[i]));
      const wo = (n * sxy - sx * sy) / (n * sxx - sx * sx);
      const bo = (sy - wo * sx) / n;
      const Lo = loss(wo, bo);
      const dom = [-0.7, 4.3, bo - 7, bo + 7];
      const S = { f: loss, dom, key: 'ps' + s.cen, levels: [0.1, 0.5, 2, 5, 10, 20, 40, 80].map((v) => Lo + v), zr: [Lo, Lo + 80] };
      const [gw, gb] = gradL(s.w, s.b);
      const ng = Math.hypot(gw, gb);
      const gr = U.linspace(Math.min(...xx) - 0.5, Math.max(...xx) + 0.5, 50);
      dp.opts.x.label = s.cen ? 'x − 3.5 (центрированная площадь)' : 'площадь x';
      dp.render([
        { type: 'line', x: gr, y: gr.map((v) => wo * v + bo), color: 'muted', width: 1.4, dash: '5 4', label: 'лучшая прямая' },
        { type: 'segments', x1: xx, y1: Y, x2: xx, y2: xx.map((v) => s.w * v + s.b), color: 'residual', width: 1.2, opacity: 0.8 },
        { type: 'line', x: gr, y: gr.map((v) => s.w * v + s.b), color: 'model', width: 2.4, label: 'y = w·x + b' },
        { type: 'points', x: xx, y: Y, color: 'data', r: 5, label: 'квартиры' },
      ], { y: [-6, 16] });
      const pth = s.path.filter(([pw, pb]) => pw >= dom[0] - 5 && pw <= dom[1] + 5 && pb >= dom[2] - 10 && pb <= dom[3] + 10);
      map.render([
        ...mapLayers(S),
        { type: 'line', x: pth.map((p) => p[0]), y: pth.map((p) => p[1]), color: 'tree', width: 1.6, hover: false },
        { type: 'points', x: [wo], y: [bo], color: 'ink', r: 5, hollow: true },
        { type: 'arrows', x1: ng > 1e-9 ? [s.w] : [], y1: ng > 1e-9 ? [s.b] : [], x2: [s.w - (0.7 * gw) / (ng || 1)], y2: [s.b - (0.7 * gb) / (ng || 1)], color: 'model', width: 2.6 },
        { type: 'points', x: [s.w], y: [s.b], color: 'tree', r: 7, draggable: true, onDrag: (i, nx, ny) => ((s.w = snap(U.clamp(nx, dom[0], dom[1]), 0.01)), (s.b = snap(U.clamp(ny, dom[2], dom[3]), 0.01)), (s.path = [[s.w, s.b]]), draw()) },
      ], domOf(S));
      st.set('wb', vec(s.w, s.b, 3));
      st.set('L', f4(loss(s.w, s.b)));
      st.set('g', vec(gw, gb, 3));
      st.set('k', String(s.path.length - 1));
      note.innerHTML = 'Формулы градиента: ∂L/∂w = −(2/n)·Σ xᵢ·rᵢ, ∂L/∂b = −(2/n)·Σ rᵢ, где rᵢ = yᵢ − w·xᵢ − b — остатки. Минимум (кружок): w = ' + f3(wo) + ', b = ' + f3(bo) + ', L = ' + f3(Lo) + '. ' + (s.cen
        ? 'После центрирования овраг стал почти круглым (число обусловленности 2.9 вместо 87.6): спуск с η = 0.25 доходит до минимума (точность 10⁻⁶) за 13 шагов, а b сходится к средней цене 6.'
        : 'Карта — узкий наклонный овраг: w и b «спорят» друг с другом (при большом x поворот прямой сдвигает и её уровень). Число обусловленности гессиана ≈ 87.6, допустимый шаг η < 0.0626: при η = 0.05 нужно 318 шагов, при η = 0.07 спуск расходится. Включите центрирование x.');
    }
    w.pythonAction(() => 'import numpy as np\n\nx = np.array([1, 2, 3, 4, 5, 6.0])' + (s.cen ? ' - 3.5        # центрирование' : '') + '\ny = np.array([2, 4, 3, 7, 9, 11.0])\nw, b, eta = 0.0, 0.0, ' + py(s.eta) + '\nfor k in range(1000):\n    r = y - (w * x + b)                  # остатки\n    gw, gb = -2 * np.mean(x * r), -2 * np.mean(r)\n    w, b = w - eta * gw, b - eta * gb\nprint("спуск:", round(w, 4), round(b, 4), " L =", round(np.mean((y - w * x - b) ** 2), 4))\nprint("МНК  :", np.polyfit(x, y, 1).round(4))\nH = 2 * np.array([[np.mean(x * x), np.mean(x)], [np.mean(x), 1]])   # гессиан L\nlam = np.linalg.eigvalsh(H)\nprint("число обусловленности", round(lam[1] / lam[0], 2), " η < 2/λmax =", round(2 / lam[1], 4))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 25. Пространство прогнозов: два объекта — две переменные
   * ============================================================================== */
  const PLOSS = {
    mse: { label: 'квадратичные ½(y − F)²', y: [3, 1], dom: [-3, 5, -3, 5], L: (y, F) => 0.5 * (y - F) ** 2, ng: (y, F) => y - F, name: 'остатки y − F' },
    mae: { label: 'абсолютные |y − F|', y: [3, 1], dom: [-3, 5, -3, 5], L: (y, F) => Math.abs(y - F), ng: (y, F) => Math.sign(y - F), name: 'знаки остатков' },
    huber: { label: 'Хьюбера, δ = 1', y: [3, 1], dom: [-3, 5, -3, 5], L: (y, F) => { const r = Math.abs(y - F); return r <= 1 ? 0.5 * r * r : r - 0.5; }, ng: (y, F) => U.clamp(y - F, -1, 1), name: 'остатки, обрезанные до ±1' },
    log: { label: 'log-loss, классы y = (1, 0)', y: [1, 0], dom: [-4, 4, -4, 4], L: (y, F) => (y === 1 ? Math.log1p(E(-F)) : Math.log1p(E(F))), ng: (y, F) => y - sigma(F), name: 'y − p' },
  };
  GBC.widget('pred-space', (el) => {
    const s = { k: 'mse', nu: 0.5 };
    const reset = () => {
      s.F = s.k === 'log' ? { x: -1.5, y: 1.5 } : { x: -2, y: 4 };
      s.path = [[s.F.x, s.F.y]];
    };
    reset();
    const w = ui.shell(el, { title: 'Пространство прогнозов: два объекта — карта двух переменных', sub: 'Пусть в выборке всего два объекта. Тогда прогнозы модели F = (F₁, F₂) — точка на плоскости, а суммарные потери L(F₁, F₂) — рельеф над ней. Синяя стрелка — антиградиент −∇L: куда сдвинуть прогнозы, чтобы потери падали быстрее всего. Его компоненты — псевдо-остатки.', stack: true });
    ui.select(w.controls, { label: 'Функция потерь', value: s.k, options: Object.entries(PLOSS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.k = v), reset(), draw()) });
    ui.slider(w.controls, { label: 'темп ν', min: 0.1, max: 1, step: 0.05, value: s.nu, onInput: (v) => (s.nu = v) });
    const bx = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end' });
    w.controls.appendChild(bx);
    const step = (k) => () => {
      const P = PLOSS[s.k];
      for (let i = 0; i < k; i++) {
        s.F.x += s.nu * P.ng(P.y[0], s.F.x);
        s.F.y += s.nu * P.ng(P.y[1], s.F.y);
        s.path.push([s.F.x, s.F.y]);
      }
      draw();
    };
    ui.button(bx, { label: 'шаг F ← F − ν∇L', small: true, kind: 'primary', onClick: step(1) });
    ui.button(bx, { label: '5 шагов', small: true, onClick: step(5) });
    ui.button(bx, { label: 'сброс', small: true, onClick: () => (reset(), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const map = new GBC.Plot(box, { height: 320, equal: true, x: { label: 'прогноз F₁ (объект 1)' }, y: { label: 'прогноз F₂ (объект 2)' }, grid: 'none' });
    const bars = new GBC.Plot(box, { height: 320, x: { label: 'объект', domain: [0.4, 2.6], ticks: [1, 2] }, y: { label: 'псевдо-остаток −∂L/∂Fᵢ' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'F', label: 'F = (F₁, F₂)' }, { key: 'L', label: 'L(F)' }, { key: 'r', label: '−∇L' }, { key: 'k', label: 'шагов' }]);
    function draw() {
      const P = PLOSS[s.k];
      const Lf = (a, b) => P.L(P.y[0], a) + P.L(P.y[1], b);
      const S = { f: Lf, dom: P.dom, key: 'pred-' + s.k };
      const [x0, x1, y0, y1] = P.dom;
      const fx = [];
      const fy = [];
      const tx = [];
      const ty = [];
      for (const a of U.linspace(x0 + 0.4, x1 - 0.4, 11)) for (const b of U.linspace(y0 + 0.4, y1 - 0.4, 11)) {
        const r1 = P.ng(P.y[0], a);
        const r2 = P.ng(P.y[1], b);
        const nn = Math.hypot(r1, r2);
        if (nn < 1e-9) continue;
        const len = 0.32 * Math.min(1, 0.4 + nn / 3);
        fx.push(a);
        fy.push(b);
        tx.push(a + (len * r1) / nn);
        ty.push(b + (len * r2) / nn);
      }
      const r1 = P.ng(P.y[0], s.F.x);
      const r2 = P.ng(P.y[1], s.F.y);
      const pth = s.path;
      map.render([
        ...mapLayers(S),
        { type: 'arrows', x1: fx, y1: fy, x2: tx, y2: ty, color: 'model', width: 1, opacity: 0.45 },
        { type: 'line', x: pth.map((p) => p[0]), y: pth.map((p) => p[1]), color: 'tree', width: 1.6, hover: false },
        { type: 'points', x: s.k === 'log' ? [] : [P.y[0]], y: s.k === 'log' ? [] : [P.y[1]], color: 'ink', r: 6, hollow: true, tooltip: () => [['ответы y', vec(P.y[0], P.y[1])]] },
        { type: 'arrows', x1: [s.F.x], y1: [s.F.y], x2: [s.F.x + r1], y2: [s.F.y + r2], color: 'model', width: 3 },
        dragPoint(s.F, P.dom, () => ((s.path = [[s.F.x, s.F.y]]), draw()), { snap: 0.1 }),
      ], domOf(S));
      bars.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'bars', x: [1, 2], y: [r1, r2], color: (i) => ([r1, r2][i] >= 0 ? 'pos' : 'neg'), width: 0.5, maxPx: 70, tooltip: (i) => [['−∂L/∂F' + (i + 1), f3([r1, r2][i])]] },
      ], { y: yDom([r1, r2, 0, s.k === 'log' || s.k === 'mae' || s.k === 'huber' ? 1 : 0, s.k === 'log' || s.k === 'mae' || s.k === 'huber' ? -1 : 0], 0.15) });
      st.set('F', vec(s.F.x, s.F.y));
      st.set('L', f4(Lf(s.F.x, s.F.y)));
      st.set('r', vec(r1, r2, 3));
      st.set('k', String(s.path.length - 1));
      note.innerHTML = {
        mse: 'Квадратичные потери: линии уровня — окружности вокруг точки ответов y = (3, 1). Антиградиент −∇L = y − F — вектор <b>остатков</b>, он смотрит прямо на ответ. Шаг с ν = 1 попадает в него сразу; с ν = 0.5 — сокращает расстояние вдвое за шаг.',
        mae: 'Абсолютные потери: линии уровня — ромбы. Антиградиент — <b>знаки остатков</b> (±1): он не знает, далеко ли ответ, поэтому шаги одинаковой длины и у цели спуск начинает прыгать туда-обратно. В точке излома производной нет — берут субградиент (урок 15.5).',
        huber: 'Хьюбер — компромисс: вблизи ответа как квадратичные (антиградиент = остаток), вдали как абсолютные (антиградиент обрезан до ±1). Выбросы тянут прогноз не сильнее, чем на δ.',
        log: 'Log-loss для классов y = (1, 0): минимума нет — потери падают, пока F₁ → +∞, F₂ → −∞. Антиградиент y − p: первому объекту логит поднять, второму — опустить; с ростом уверенности стрелки укорачиваются.',
      }[s.k] + ' В настоящей выборке объектов n — тогда это та же картина в n-мерном пространстве прогнозов.';
    }
    w.pythonAction(() => {
      const P = PLOSS[s.k];
      const ng = { mse: 'y - F', mae: 'np.sign(y - F)', huber: 'np.clip(y - F, -1, 1)', log: 'y - 1 / (1 + np.exp(-F))' }[s.k];
      return 'import numpy as np\n\ny = np.array([' + P.y.join(', ') + '.0])\nF = np.array([' + py(s.path[0][0]) + ', ' + py(s.path[0][1]) + '])\nnu = ' + py(s.nu) + '\nneg_grad = lambda F: ' + ng + '        # псевдо-остатки = −∂L/∂F\nfor k in range(6):\n    print(f"шаг {k}: F = {F.round(3)}, псевдо-остатки = {neg_grad(F).round(3)}")\n    F = F + nu * neg_grad(F)\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 26. Градиент по вектору прогнозов: шаг деревом
   * ============================================================================== */
  GBC.widget('boosting-gradient', (el) => {
    const toy = GBC.datasets.toyRegression();
    const x = toy.x;
    const y = toy.y;
    const n = y.length;
    const M = 8;
    const s = { mode: 'tree', nu: 1, m: 0 };
    const w = ui.shell(el, { title: 'Шаг по антиградиенту — деревом', sub: 'Шесть квартир — шесть переменных F₁…F₆. Антиградиент суммы квадратичных потерь — вектор остатков (стрелки). Шаг «по точкам» сдвигает каждый прогноз отдельно. Шаг «деревом» приближает вектор остатков пнём — функцией площади — и сдвигает все прогнозы сразу.', stack: true });
    ui.segmented(w.controls, { label: 'Как шагать', value: s.mode, options: [{ value: 'tree', label: 'деревом' }, { value: 'raw', label: 'по точкам' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'темп ν', min: 0.1, max: 1, step: 0.1, value: s.nu, onInput: (v) => ((s.nu = v), draw()) });
    ui.player(w.controls, { label: 'Шаги m', min: 0, max: M, value: 0, fps: 1.2, format: (v) => 'm = ' + v, onChange: (v) => ((s.m = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 290, x: { label: 'площадь x', domain: [0.5, 6.5] }, y: { label: 'цена, млн', domain: [0, 12.5] } });
    const p2 = new GBC.Plot(box, { height: 290, x: { label: 'шаг m', domain: [0, M] }, y: { label: 'потери ½Σ(yᵢ − Fᵢ)²', domain: [0, 34] } });
    const p3 = new GBC.Plot(w.main, { height: 220, x: { label: 'квартира i', domain: [0.4, 6.6], ticks: [1, 2, 3, 4, 5, 6] }, y: { label: 'компоненты векторов' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'L', label: 'потери' }, { key: 'g', label: 'антиградиент −g = y − F' }, { key: 'cos', label: 'cos угла (шаг, −g)' }, { key: 'new', label: 'прогноз для x = 4.5' }]);
    function stump(r) {
      let best = null;
      for (let i = 0; i < n - 1; i++) {
        const thr = (x[i] + x[i + 1]) / 2;
        const L = r.filter((_, j) => x[j] <= thr);
        const R = r.filter((_, j) => x[j] > thr);
        const vl = U.mean(L);
        const vr = U.mean(R);
        const sse = L.reduce((a, v) => a + (v - vl) ** 2, 0) + R.reduce((a, v) => a + (v - vr) ** 2, 0);
        if (!best || sse < best.sse - 1e-12) best = { sse, thr, vl, vr };
      }
      return best;
    }
    function run() {
      const F = new Array(n).fill(U.mean(y));
      const hist = [F.slice()];
      const models = [];
      for (let m = 0; m < M; m++) {
        const r = y.map((v, i) => v - F[i]);
        const sp = stump(r);
        models.push(sp);
        for (let i = 0; i < n; i++) F[i] += s.nu * (s.mode === 'tree' ? (x[i] <= sp.thr ? sp.vl : sp.vr) : r[i]);
        hist.push(F.slice());
      }
      return { hist, models };
    }
    function draw() {
      const { hist, models } = run();
      const F = hist[s.m];
      const loss = (G) => 0.5 * G.reduce((a, v, i) => a + (y[i] - v) ** 2, 0);
      const r = y.map((v, i) => v - F[i]);
      const nxt = models[Math.min(s.m, M - 1)];
      const hvec = s.mode === 'tree' ? x.map((v) => (v <= nxt.thr ? nxt.vl : nxt.vr)) : r.slice();
      const dot = U.sum(hvec.map((v, i) => v * r[i]));
      const nh = Math.hypot(...hvec);
      const nr = Math.hypot(...r);
      const cos = nh > 1e-12 && nr > 1e-12 ? dot / (nh * nr) : NaN;
      const pred = (v) => U.mean(y) + models.slice(0, s.m).reduce((a, md) => a + s.nu * (v <= md.thr ? md.vl : md.vr), 0);
      const layers = [];
      if (s.mode === 'tree') {
        const grid = U.linspace(0.5, 6.5, 241);
        layers.push({ type: 'line', x: grid, y: grid.map(pred), color: 'model', width: 2, curve: 'step', label: 'модель F(x) для любых x', hover: false });
        layers.push({ type: 'vline', x: 4.5, color: 'violet', dash: '4 4', width: 1.2 });
        layers.push({ type: 'points', x: [4.5], y: [pred(4.5)], color: 'violet', r: 6, label: 'новая квартира x = 4.5' });
      }
      layers.push(
        { type: 'points', x, y, color: 'data', r: 5, label: 'цены yᵢ' },
        { type: 'arrows', x1: x, y1: F, x2: x, y2: F.map((v, i) => v + 0.92 * r[i]), color: 'tree', width: 2 },
        { type: 'points', x, y: F, color: 'model', r: 6, hollow: true, label: 'прогнозы Fᵢ' }
      );
      p1.render(layers);
      const ks = U.range(s.m + 1);
      p2.render([{ type: 'line', x: ks, y: ks.map((k) => loss(hist[k])), color: 'model', width: 2.2, hover: false }, { type: 'points', x: ks, y: ks.map((k) => loss(hist[k])), color: 'model', r: 4, tooltip: (i) => [['m', String(i)], ['потери', f3(loss(hist[i]))]] }]);
      p3.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'bars', x: x.map((v) => v - 0.17), y: r, color: 'residual', width: 0.32, maxPx: 26, label: 'антиградиент −g = y − F', tooltip: (i) => [['−gᵢ', f3(r[i])]] },
        { type: 'bars', x: x.map((v) => v + 0.17), y: hvec, color: 'tree', width: 0.32, maxPx: 26, label: s.mode === 'tree' ? 'следующий пень h(xᵢ)' : 'шаг по точкам', tooltip: (i) => [['h(xᵢ)', f3(hvec[i])]] },
      ], { y: yDom([...r, ...hvec, 0], 0.12) });
      st.set('L', f4(loss(F)));
      st.set('g', '[' + r.map((v) => U.fmt(v, 2)).join(', ') + ']');
      st.set('cos', Number.isFinite(cos) ? f3(cos) + ' (' + U.fmt((Math.acos(U.clamp(cos, -1, 1)) * 180) / Math.PI, 1) + '°)' : '—');
      st.set('new', s.mode === 'tree' ? f3(pred(4.5)) : 'нет правила');
      note.innerHTML = s.mode === 'raw'
        ? 'Шаг <b>по точкам</b> — честный градиентный спуск по шести переменным: каждый Fᵢ сдвигается на ν·(yᵢ − Fᵢ). При ν = 1 потери сразу 0 — но это <b>заучивание</b> шести ответов. Для новой квартиры площадью 4.5 прогноза нет: мы меняли числа, а не функцию.'
        : 'Шаг <b>деревом</b>: пень обучается предсказывать вектор антиградиента по площади (оранжевые столбики против серых). Он не совпадает с антиградиентом, но смотрит почти туда же: на первом шаге cos угла 0.919 (23.3°), и потери падают с 32 до 5. Пень — <b>проекция</b> антиградиента на «ступеньки»: остаток после шага перпендикулярен шагу, поэтому потери уменьшаются ровно на ½|h|² = 27. Зато это функция площади — она даёт прогноз и для новой квартиры (фиолетовая точка). Это функциональный градиентный спуск — урок 5.1.';
    }
    w.pythonAction(() => 'import numpy as np\n\nx = np.array([1, 2, 3, 4, 5, 6.0])\ny = np.array([2, 4, 3, 7, 9, 11.0])\nF, nu = np.full(6, y.mean()), ' + py(s.nu) + '\n\ndef stump(r):\n    best = None\n    for t in (x[:-1] + x[1:]) / 2:\n        h = np.where(x <= t, r[x <= t].mean(), r[x > t].mean())\n        if best is None or np.sum((r - h) ** 2) < best[0] - 1e-12:\n            best = (np.sum((r - h) ** 2), t, h)\n    return best[1], best[2]\n\nfor m in range(' + M + '):\n    r = y - F                                 # антиградиент ½Σ(y − F)² по F\n    t, h = stump(r)                           # дерево приближает антиградиент\n    cos = h @ r / (np.linalg.norm(h) * np.linalg.norm(r))\n    print(f"m = {m}: потери {0.5 * r @ r:7.3f}, порог {t}, cos(h, −g) = {cos:.3f}")\n    F = F + nu * h\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 27. Структура гессиана по прогнозам
   * ============================================================================== */
  GBC.widget('hessian-structure', (el) => {
    const s = { k: 'log' };
    const FL = [-2, 0, 1, 3];
    const FS = [[2, 1, 0], [0, 0, 0], [-1, 2, 0.5], [1, 1, 3]];
    const w = ui.shell(el, { foot: true, title: 'Гессиан потерь по прогнозам: что в нём лежит', sub: 'Четыре объекта. Для регрессии и двух классов у каждого объекта один прогноз, для трёх классов — три логита, всего 12 переменных. Клетка (i, j) — вторая производная ∂²L/∂Fᵢ∂Fⱼ. Пустые клетки — нули.' });
    ui.segmented(w.controls, { label: 'Потери', value: s.k, options: [{ value: 'mse', label: 'MSE' }, { value: 'log', label: 'log-loss' }, { value: 'soft', label: 'softmax' }, { value: 'xgb', label: 'softmax в XGBoost' }], onChange: (v) => ((s.k = v), draw()) });
    const tbox = H('div', { style: 'overflow-x:auto' });
    w.main.appendChild(tbox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'размер' }, { key: 'nz', label: 'ненулевых клеток' }, { key: 'off', label: 'из них вне диагонали' }]);
    function matrix() {
      if (s.k === 'mse') return { M: FL.map((_, i) => FL.map((__, j) => (i === j ? 1 : 0))), names: FL.map((_, i) => 'F' + (i + 1)) };
      if (s.k === 'log') return { M: FL.map((f, i) => FL.map((__, j) => (i === j ? sigma(f) * (1 - sigma(f)) : 0))), names: FL.map((_, i) => 'F' + (i + 1)) };
      const P = FS.map((z) => { const m = Math.max(...z); const e = z.map((v) => E(v - m)); const Z = U.sum(e); return e.map((v) => v / Z); });
      const N = 12;
      const M = U.range(N).map(() => new Array(N).fill(0));
      for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) {
        const p = P[i];
        if (s.k === 'soft') M[3 * i + k][3 * i + j] = k === j ? p[k] * (1 - p[k]) : -p[k] * p[j];
        else if (k === j) M[3 * i + k][3 * i + j] = 2 * p[k] * (1 - p[k]);
      }
      return { M, names: U.range(N).map((q) => 'F' + (Math.floor(q / 3) + 1) + ',' + ((q % 3) + 1)) };
    }
    function draw() {
      const { M, names } = matrix();
      const N = M.length;
      const mx = Math.max(...M.flat().map(Math.abs)) || 1;
      const div = GBC.colors.diverging();
      const big = N > 4;
      const t = H('table', { style: 'border-collapse:collapse;font-size:' + (big ? '.68rem' : '.85rem') + ';margin:0 auto' });
      const hr = H('tr', null, H('th'));
      names.forEach((nm) => hr.appendChild(H('th', { style: 'padding:2px 4px;color:var(--muted);font-weight:600;white-space:nowrap' }, nm)));
      t.appendChild(hr);
      let nz = 0;
      let off = 0;
      M.forEach((row, i) => {
        const tr = H('tr', null, H('th', { style: 'padding:2px 6px;color:var(--muted);font-weight:600;white-space:nowrap' }, names[i]));
        row.forEach((v, j) => {
          if (Math.abs(v) > 1e-12) {
            nz++;
            if (i !== j) off++;
          }
          const td = Math.abs(v) > 1e-12 ? heatCell(U.fmt(v, big ? 2 : 3), div(v / mx), { title: names[i] + ' × ' + names[j] + ': ' + f4(v) }) : heatCell('', null);
          td.style.minWidth = big ? '30px' : '48px';
          td.style.padding = big ? '3px 2px' : '5px 6px';
          if (!(Math.abs(v) > 1e-12)) td.style.background = 'transparent';
          tr.appendChild(td);
        });
        t.appendChild(tr);
      });
      tbox.replaceChildren(t);
      st.set('n', N + ' × ' + N);
      st.set('nz', String(nz));
      st.set('off', String(off));
      note.innerHTML = {
        mse: 'MSE: ∂²L/∂Fᵢ² = 1, а перекрёстные производные — нули: каждое слагаемое ½(yᵢ − Fᵢ)² зависит только от своего Fᵢ. Гессиан — единичная матрица, поэтому шаг Ньютона совпадает с шагом по остаткам.',
        log: 'Log-loss: на диагонали hᵢ = pᵢ(1 − pᵢ) — у уверенных объектов (логит −2 или 3) кривизна мала, у сомнительного (логит 0) — наибольшая 0.25. Вне диагонали нули: гессиан диагональный, и задача распадается на n отдельных парабол. Поэтому значение листа — простая дробь −G/(H + λ) (урок 15.7).',
        soft: 'Softmax с тремя классами: у каждого объекта блок 3 × 3 — матрица Якоби softmax diag(p) − ppᵀ (шаг 17): логиты одного объекта связаны, вне диагонали стоят −pₖpⱼ. Блоки разных объектов не связаны: гессиан блочно-диагональный.',
        xgb: 'XGBoost не хранит внеблочные и внедиагональные клетки: для softmax он берёт только диагональ и вдобавок удваивает её — h = 2p(1 − p) (проверено на версии 3.4.1: значения листьев совпадают с −G/(H + λ) именно при такой h). LightGBM 4.7 берёт K/(K − 1)·p(1 − p). Это приближение позволяет строить деревья по каждому классу отдельно.',
      }[s.k];
    }
    w.pythonAction(() => 'import numpy as np\n\nZ = np.array(' + JSON.stringify(FS) + ', dtype=float)   # логиты: 4 объекта × 3 класса\nP = np.exp(Z - Z.max(1, keepdims=True)); P /= P.sum(1, keepdims=True)\nblocks = [np.diag(p) - np.outer(p, p) for p in P]    # гессиан softmax-потерь одного объекта\nH = np.zeros((12, 12))\nfor i, B in enumerate(blocks):\n    H[3 * i:3 * i + 3, 3 * i:3 * i + 3] = B\nprint("ненулевых:", np.count_nonzero(np.abs(H) > 1e-12), "из", H.size)\nprint("диагональ XGBoost: 2p(1 − p) =", (2 * P * (1 - P)).round(3).ravel())\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр: четыре вида вопросов
   * ============================================================================== */
  GBC.widget('gradient-game', (el) => {
    const s = { seed: 58, round: 0, right: 0, streak: 0, q: null, picked: null };
    const KINDS = ['arrow', 'signs', 'hess', 'dir'];
    const NAMES = ['A', 'B', 'C', 'D'];
    const w = ui.shell(el, { title: 'Тренажёр', sub: 'Четыре вида вопросов: куда стекает вода, знаки частных производных по карте, тип точки по гессиану, производная по направлению. Серия из десяти верных ответов подряд — хороший знак.' });
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px' });
    w.controls.appendChild(optsBox);
    const next = ui.button(w.controls, { label: 'Следующая', icon: 'step', onClick: () => newQ() });
    const qbox = H('div', { style: 'font-size:1rem;margin-bottom:6px;min-height:1.5em' });
    w.main.appendChild(qbox);
    const map = new GBC.Plot(w.main, { height: 320, equal: true, x: { label: 'x' }, y: { label: 'y' }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'вопрос' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function shuffle(rng, arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = rng.randint(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }
    function newQ() {
      const rng = new GBC.RNG(s.seed++);
      const kind = KINDS[s.round % 4];
      let q;
      if (kind === 'arrow' || kind === 'signs') {
        const keys = kind === 'arrow' ? ['bowl', 'round', 'hill', 'pits', 'valley', 'wave'] : ['bowl', 'round', 'hill', 'saddle', 'twist', 'plane', 'wave', 'cubic'];
        const S = SURF[keys[rng.randint(keys.length)]];
        let px = 0;
        let pyy = 0;
        let g = [0, 0];
        for (let i = 0; i < 60; i++) {
          px = rng.uniform(S.dom[0] * 0.7, S.dom[1] * 0.7);
          pyy = rng.uniform(S.dom[2] * 0.7, S.dom[3] * 0.7);
          g = grad(S, px, pyy);
          const ok = kind === 'arrow' ? Math.hypot(g[0], g[1]) > 0.4 : Math.min(Math.abs(g[0]), Math.abs(g[1])) > 0.25 * Math.max(1, Math.hypot(g[0], g[1]) / 3);
          if (ok) break;
        }
        q = { kind, S, px, py: pyy, g };
        if (kind === 'arrow') {
          const base = Math.atan2(-g[1], -g[0]);
          const offs = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((o, i) => (i ? o + (rng.random() - 0.5) * 0.3 : 0));
          const order = shuffle(rng, [0, 1, 2, 3]);
          q.dirs = order.map((i) => base + offs[i]);
          q.ans = order.indexOf(0);
          q.opts = NAMES.map((nm, i) => ({ label: 'стрелка ' + nm, v: i }));
          q.text = 'Какая стрелка показывает направление самого быстрого спуска −∇f? Числа на карте — высоты линий уровня.';
        } else {
          const sg = (v) => (v > 0 ? '+' : '−');
          const combos = ['++', '+−', '−+', '−−'];
          q.ans = combos.indexOf(sg(g[0]) + sg(g[1]));
          q.opts = combos.map((c, i) => ({ label: '∂f/∂x ' + (c[0] === '+' ? '> 0' : '< 0') + ', ∂f/∂y ' + (c[1] === '+' ? '> 0' : '< 0'), v: i }));
          q.text = 'Какие знаки у частных производных в оранжевой точке? Числа на карте — высоты линий уровня.';
        }
      } else if (kind === 'hess') {
        let a;
        let b;
        let c;
        do {
          a = rng.randint(9) - 4;
          b = rng.randint(7) - 3;
          c = rng.randint(9) - 4;
        } while (a === 0 && b === 0 && c === 0);
        const k = classify([a, b, c]);
        q = { kind, a, b, c, ans: ['min', 'max', 'saddle', 'flat'].indexOf(k), opts: [{ label: 'минимум', v: 0 }, { label: 'максимум', v: 1 }, { label: 'седло', v: 2 }, { label: 'тест молчит', v: 3 }] };
        q.text = 'В критической точке гессиан равен H = [[' + a + ', ' + b + '], [' + b + ', ' + c + ']]. Что это за точка?';
      } else {
        let gx;
        let gy;
        do {
          gx = rng.randint(9) - 4;
          gy = rng.randint(9) - 4;
        } while (gx === 0 && gy === 0);
        const US = [[1, 0, '(1, 0)'], [0, 1, '(0, 1)'], [-1, 0, '(−1, 0)'], [0, -1, '(0, −1)'], [0.6, 0.8, '(0.6, 0.8)'], [0.8, -0.6, '(0.8, −0.6)'], [-0.6, 0.8, '(−0.6, 0.8)'], [-0.8, -0.6, '(−0.8, −0.6)']];
        const u = US[rng.randint(US.length)];
        const right = gx * u[0] + gy * u[1];
        const cands = [right, -right, Math.hypot(gx, gy), gx + gy, gx * u[1] + gy * u[0], 5 * right];
        const vals = [];
        for (const v of cands) if (!vals.some((z) => Math.abs(z - v) < 1e-9)) vals.push(v);
        let extra = 1;
        while (vals.length < 4) {
          const v = right + extra++;
          if (!vals.some((z) => Math.abs(z - v) < 1e-9)) vals.push(v);
        }
        const four = shuffle(rng, vals.slice(0, 4));
        q = { kind, gx, gy, u, ans: four.findIndex((v) => Math.abs(v - right) < 1e-9), opts: four.map((v, i) => ({ label: U.fmt(v, 3), v: i })) };
        q.text = '∇f = (' + gx + ', ' + gy + '), u = ' + u[2] + '. Чему равна производная по направлению D_u f?';
      }
      s.q = q;
      s.picked = null;
      s.round++;
      choiceButtons(optsBox, q.opts, pick);
      draw();
    }
    function pick(i) {
      if (s.picked !== null) return;
      s.picked = i;
      if (i === s.q.ans) (s.right++, s.streak++);
      else s.streak = 0;
      [...optsBox.querySelectorAll('button')].forEach((b) => (b.disabled = true));
      draw();
    }
    function labels(S, px, pyy) {
      const lv = levelsOf(S);
      const c = S.f(px, pyy);
      const near = lv.slice().sort((a, b) => Math.abs(a - c) - Math.abs(b - c)).slice(0, 3);
      const grid = gridOf(S, S.dom, 90);
      const items = [];
      for (const L of near) {
        let best = null;
        for (const [a, b] of contourSegs(grid, L)) {
          const mx = (a[0] + b[0]) / 2;
          const my = (a[1] + b[1]) / 2;
          const d = Math.hypot(mx - px, my - pyy);
          if (!best || d < best.d) best = { d, mx, my };
        }
        if (best) items.push({ x: best.mx, y: best.my, dx: 3, dy: -3, text: U.fmt(L, 2), bold: true });
      }
      return { type: 'text', items };
    }
    function draw() {
      const q = s.q;
      const done = s.picked !== null;
      const ok = done && s.picked === q.ans;
      qbox.textContent = q.text;
      let layers = [];
      let dom = { x: [-2, 2], y: [-2, 2] };
      let why = '';
      if (q.kind === 'arrow' || q.kind === 'signs') {
        const { S, px, py: pyy, g } = q;
        dom = domOf(S);
        layers = [...mapLayers(S)];
        if (q.kind === 'arrow') {
          const L = Math.min(S.dom[1] - S.dom[0], S.dom[3] - S.dom[2]) * 0.2;
          const ex = q.dirs.map((d) => px + L * Math.cos(d));
          const ey = q.dirs.map((d) => pyy + L * Math.sin(d));
          layers.push(
            { type: 'arrows', x1: q.dirs.map(() => px), y1: q.dirs.map(() => pyy), x2: ex, y2: ey, color: 'ink', width: 2 },
            { type: 'arrows', x1: done ? [px] : [], y1: done ? [pyy] : [], x2: [ex[q.ans]], y2: [ey[q.ans]], color: 'tree', width: 3.2 },
            { type: 'text', items: ex.map((v, i) => ({ x: v, y: ey[i], dx: 6, dy: -6, text: NAMES[i], bold: true })) }
          );
          layers.push(labels(S, px, pyy));
          why = 'Антиградиент перпендикулярен линии уровня и направлен вниз по склону — к меньшим высотам (смотрите на числа у линий уровня).';
        } else {
          layers.push(labels(S, px, pyy));
          if (done) layers.push({ type: 'arrows', x1: [px, px], y1: [pyy, pyy], x2: [px + 0.5 * Math.sign(g[0]), px], y2: [pyy, pyy + 0.5 * Math.sign(g[1])], color: 'tree', width: 2.4 });
          why = '∂f/∂x = ' + f2(g[0]) + ', ∂f/∂y = ' + f2(g[1]) + '. Мысленно сдвиньтесь вправо: высота растёт — ∂f/∂x > 0. Вверх: растёт — ∂f/∂y > 0. Стрелки показывают, в какую сторону по каждой оси рельеф поднимается.';
        }
        layers.push({ type: 'points', x: [px], y: [pyy], color: 'tree', r: 6 });
      } else if (q.kind === 'hess') {
        const { a, b, c } = q;
        const qf = (x, y) => 0.5 * (a * x * x + 2 * b * x * y + c * y * y);
        const S = { f: qf, dom: [-2, 2, -2, 2], key: 'game' };
        if (done) layers = [...mapLayers(S)];
        else layers = [{ type: 'text', items: [{ x: 0, y: 0, text: 'Ответьте — и увидите рельеф', anchor: 'middle' }] }];
        layers.push({ type: 'points', x: [0], y: [0], color: 'tree', r: 5 });
        const det = a * c - b * b;
        why = 'det H = ' + a + '·' + c + ' − ' + b + '² = ' + det + '. ' + (det < 0 ? 'Отрицательный — седло.' : det === 0 ? 'Ноль — тест второго порядка молчит.' : 'Положительный, и f<sub>xx</sub> = ' + a + (a > 0 ? ' > 0 — минимум.' : ' < 0 — максимум.'));
      } else {
        const { gx, gy, u } = q;
        const n = Math.hypot(gx, gy);
        layers = [
          { type: 'hline', y: 0, color: 'axis', width: 1 },
          { type: 'vline', x: 0, color: 'axis', width: 1 },
          { type: 'arrows', x1: [0], y1: [0], x2: [(1.6 * gx) / n], y2: [(1.6 * gy) / n], color: 'tree', width: 2.8 },
          { type: 'arrows', x1: [0], y1: [0], x2: [1.2 * u[0]], y2: [1.2 * u[1]], color: 'ink2', width: 2.4 },
          { type: 'text', items: [{ x: (1.6 * gx) / n, y: (1.6 * gy) / n, dx: 6, dy: -4, text: '∇f', bold: true }, { x: 1.2 * u[0], y: 1.2 * u[1], dx: 6, dy: -4, text: 'u', bold: true }] },
        ];
        why = 'D_u f = ∇f·u = ' + gx + '·' + U.fmt(u[0], 2) + ' + ' + gy + '·' + U.fmt(u[1], 2) + ' = ' + U.fmt(gx * u[0] + gy * u[1], 3) + '. Частые ловушки: забыть знак или взять |∇f| (это максимум по всем направлениям).';
      }
      map.render(layers, dom);
      st.set('r', String(s.round));
      st.set('ok', s.right + ' из ' + (s.round - (done ? 0 : 1)));
      st.set('s', String(s.streak));
      const hint = { arrow: 'Найдите ближайшую линию уровня и мысленно проведите к ней перпендикуляр в сторону понижения.', signs: 'Сравните высоты линий уровня справа и слева от точки, сверху и снизу.', hess: 'Посчитайте det H = ac − b², затем посмотрите на знак a.', dir: 'Скалярное произведение: gₓuₓ + g_yu_y.' };
      note.innerHTML = done ? (ok ? '<b>Верно!</b> ' : '<b>Нет.</b> ') + why : hint[q.kind];
      next.textContent = '';
      next.append(ui.icon('step'), done ? 'Следующая' : 'Пропустить');
    }
    w.pythonAction(() => 'import numpy as np\n\n# Самопроверка: тип критической точки по гессиану\nfor H in [[[2, 0], [0, 6]], [[2, 4], [4, 2]], [[-1, 0], [0, -3]], [[2, 2], [2, 2]]]:\n    H = np.array(H, float)\n    lam = np.linalg.eigvalsh(H)\n    kind = "тест молчит" if np.isclose(lam, 0).any() else "минимум" if (lam > 0).all() else "максимум" if (lam < 0).all() else "седло"\n    print(H.tolist(), "→ λ =", lam.round(3), "→", kind)\n');
    newQ();
  });
})();
