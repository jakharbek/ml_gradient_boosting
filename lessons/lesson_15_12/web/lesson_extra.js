/* Урок 15.12, часть 2 — ортогональность и МНК, собственные векторы, SVD и PCA, линейная алгебра бустинга.
 * Виджеты: Грам — Шмидт по шагам, проекция на плоскость в 3D, метод наименьших квадратов (с чашей потерь),
 * полиномиальные признаки и LOO, гребневая регрессия, собственные векторы и «сканер» направлений,
 * характеристический многочлен по шагам, степени матрицы, квадратичные формы, обусловленность и спуск,
 * SVD «поворот — растяжение — поворот», малоранговое приближение картинки, PCA, дерево как проекция,
 * выигрыш разбиения, бустинг как цепочка проекций, лист Ньютона, ансамбль на индикаторах листьев, тренажёр.
 * Помощники — из lesson.js (GBC.lesson1512). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const {
    f1, f2, f3, f4, py, sci, powFmt, decades, yDom, fv, fm, snap, clean,
    texInto, badge, rowTable, stepList, plural, onTheme, eqBox, texMat, texVec, cardGrid, card,
    dot, norm, vadd, vsub, vscale, transpose, matVec, matMul, eye, det2, solve, symEig, svd, rank, eig2,
    rightAngle, polyLayer, PY_NP, Scene3D, axes3, rightAngle3, unit,
  } = GBC.lesson1512;
  const R = String.raw;
  const toy = GBC.datasets.toyRegression();
  const FX = toy.x; // площади 1…6
  const FY = toy.y; // цены 2, 4, 3, 7, 9, 11
  const PY_FLATS = PY_NP + 'x = np.arange(1, 7.0)                      # площадь, десятки м²\ny = np.array([2, 4, 3, 7, 9, 11.0])        # цена, млн\n';
  const tn = (v, d = 3) => U.fmt(clean(v), d).replace('−', '-');
  /** МНК через SVD: кратчайшее решение, работает и для вырожденной X. */
  function lstsq(X, y, tol = 1e-10) {
    const n = X[0].length;
    const { u, s, v } = svd(X);
    const w = new Array(n).fill(0);
    s.forEach((sv, k) => {
      if (sv > tol * s[0]) {
        const c = dot(u[k], y) / sv;
        for (let j = 0; j < n; j++) w[j] += c * v[k][j];
      }
    });
    return w;
  }
  /** Обусловленность симметричной положительно определённой матрицы. */
  function condSym(A) {
    const ev = symEig(A).values;
    const lo = ev[ev.length - 1];
    return lo > 1e-300 ? ev[0] / lo : Infinity;
  }
  const vander = (xs, d) => xs.map((x) => U.range(d + 1).map((k) => Math.pow(x, k)));
  const XtX = (X) => matMul(transpose(X), X);
  const Xty = (X, y) => matVec(transpose(X), y);

  /* ==============================================================================
   * Шаг 16. Грам — Шмидт
   * ============================================================================== */
  GBC.widget('gram-schmidt', (el) => {
    const s = { a1: [3, 1], a2: [2, 2], k: 4 };
    const w = ui.shell(el, { title: 'Процесс Грама — Шмидта по шагам', sub: 'Из двух независимых векторов a₁ и a₂ строим ортонормированный базис q₁, q₂: нормируем a₁; из a₂ вычитаем его проекцию на q₁; нормируем остаток. Концы a₁ и a₂ можно тянуть. Пунктирная окружность — единичная.' });
    ui.player(w.controls, { label: 'Шаг', min: 0, max: 4, value: 4, fps: 0.8, format: (v) => ['исходные', 'q₁ = a₁/‖a₁‖', 'проекция a₂ на q₁', 'остаток e₂ ⟂ q₁', 'q₂ = e₂/‖e₂‖'][v], onChange: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main), { height: 340, equal: true, x: { label: 'x₁', domain: [-2.5, 4] }, y: { label: 'x₂', domain: [-1.5, 3.5] } });
    const mt = H('div', { style: 'margin-top:4px;overflow-x:auto;overflow-y:hidden' });
    w.main.appendChild(mt);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'q1', label: 'q₁' }, { key: 'q2', label: 'q₂' }, { key: 'd', label: 'q₁ · q₂' }, { key: 'r', label: 'R (верхнетреугольная)' }]);
    function draw() {
      const { a1, a2, k } = s;
      const n1 = norm(a1);
      const q1 = vscale(a1, 1 / n1);
      const r12 = dot(a2, q1);
      const p = vscale(q1, r12);
      const e2 = vsub(a2, p);
      const n2 = norm(e2);
      const ok = n2 > 1e-9 && n1 > 1e-9;
      const q2 = ok ? vscale(e2, 1 / n2) : [0, 0];
      const circ = U.linspace(0, 2 * Math.PI, 120);
      const L = [{ type: 'line', x: circ.map(Math.cos), y: circ.map(Math.sin), color: 'muted', width: 1, dash: '3 4', hover: false }];
      L.push({ type: 'line', x: [-9 * q1[0], 9 * q1[0]], y: [-9 * q1[1], 9 * q1[1]], color: 'muted', width: 1, dash: '2 5', hover: false });
      if (k >= 2) {
        L.push({ type: 'arrows', x1: [0], y1: [0], x2: [p[0]], y2: [p[1]], color: 'good', width: 4.5, opacity: 0.5 });
        L.push({ type: 'segments', x1: [a2[0]], y1: [a2[1]], x2: [p[0]], y2: [p[1]], color: 'ink2', width: 1.3, dash: '4 3', opacity: 1 });
      }
      if (k >= 3 && ok) {
        L.push({ type: 'arrows', x1: [0], y1: [0], x2: [e2[0]], y2: [e2[1]], color: 'aqua', width: 2.6 });
        L.push(rightAngle([0, 0], q1, q2, 0.25));
      }
      if (k >= 1) L.push({ type: 'arrows', x1: [0], y1: [0], x2: [q1[0]], y2: [q1[1]], color: 'violet', width: 3.2 });
      if (k >= 4 && ok) L.push({ type: 'arrows', x1: [0], y1: [0], x2: [q2[0]], y2: [q2[1]], color: 'violet', width: 3.2 });
      const lab = [{ x: a1[0], y: a1[1], dx: 7, dy: -6, text: 'a₁', bold: true }, { x: a2[0], y: a2[1], dx: 7, dy: -6, text: 'a₂', bold: true }];
      if (k >= 1) lab.push({ x: q1[0], y: q1[1], dx: 6, dy: 15, text: 'q₁', bold: true, color: 'violet' });
      if (k >= 4 && ok) lab.push({ x: q2[0], y: q2[1], dx: -24, dy: 12, text: 'q₂', bold: true, color: 'violet' });
      if (k >= 3 && ok) lab.push({ x: e2[0], y: e2[1], dx: 8, dy: -4, text: 'e₂', color: 'aqua' });
      plot.render([
        ...L,
        { type: 'arrows', x1: [0], y1: [0], x2: [a1[0]], y2: [a1[1]], color: 'blue', width: 2.2, opacity: 0.85 },
        { type: 'arrows', x1: [0], y1: [0], x2: [a2[0]], y2: [a2[1]], color: 'orange', width: 2.2, opacity: 0.85 },
        { type: 'text', items: lab },
        { type: 'points', x: [a1[0], a2[0]], y: [a1[1], a2[1]], color: (i) => (i ? 'orange' : 'blue'), r: 7, draggable: true, onDrag: (i, x, y) => {
          const q = [snap(x, 0.25), snap(y, 0.25)];
          if (norm(q) < 0.3) return;
          if (i) s.a2 = q;
          else s.a1 = q;
          draw();
        } },
      ]);
      if (ok) texInto(mt, R`\underbrace{\begin{pmatrix} ${tn(a1[0])} & ${tn(a2[0])} \\ ${tn(a1[1])} & ${tn(a2[1])}\end{pmatrix}}_{X} = \underbrace{` + texMat([[q1[0], q2[0]], [q1[1], q2[1]]], 3) + R`}_{Q}\;\underbrace{` + texMat([[n1, r12], [0, n2]], 3) + R`}_{R}`, true);
      else texInto(mt, R`a_1 \parallel a_2:\ e_2 = 0`, true);
      st.set('q1', fv(q1, 3));
      st.set('q2', ok ? fv(q2, 3) : '—');
      st.set('d', ok ? f4(clean(dot(q1, q2))) : '—');
      st.set('r', fm([[n1, r12], [0, n2]], 3));
      const msg = [
        'Исходные векторы a₁ и a₂ не перпендикулярны: a₁ · a₂ = ' + f3(dot(a1, a2)) + '.',
        'Шаг 1: q₁ = a₁ / ‖a₁‖ = ' + fv(a1) + ' / ' + f3(n1) + ' — единичный вектор вдоль a₁.',
        'Шаг 2: проекция a₂ на q₁ — (a₂ · q₁)·q₁ = ' + f3(r12) + '·q₁ = ' + fv(p, 3) + ' (зелёная).',
        'Шаг 3: e₂ = a₂ − проекция = ' + fv(e2, 3) + '. Он перпендикулярен q₁: e₂ · q₁ = ' + f4(clean(dot(e2, q1))) + '.',
        'Шаг 4: q₂ = e₂ / ‖e₂‖. Базис q₁, q₂ ортонормирован; коэффициенты ‖a₁‖, a₂·q₁, ‖e₂‖ образуют R, и X = QR.',
      ][k];
      note.innerHTML = ok ? msg : '<b>a₁ и a₂ на одной прямой:</b> остаток e₂ нулевой, второй вектор базиса построить нельзя — векторы зависимы.';
    }
    w.pythonAction(() => PY_NP + 'a1 = np.array([' + s.a1.map(py).join(', ') + '])\na2 = np.array([' + s.a2.map(py).join(', ') + '])\n\nq1 = a1 / np.linalg.norm(a1)\ne2 = a2 - (a2 @ q1) * q1\nq2 = e2 / np.linalg.norm(e2)\nprint("q1 =", q1, " q2 =", q2, " q1·q2 =", q1 @ q2)\nR = np.array([[np.linalg.norm(a1), a2 @ q1], [0, np.linalg.norm(e2)]])\nprint("R =\\n", R)\n\nQ, R_np = np.linalg.qr(np.c_[a1, a2])     # numpy может сменить знаки столбцов\nprint("numpy QR:\\n", Q, "\\n", R_np)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 17. Проекция на плоскость в 3D
   * ============================================================================== */
  GBC.widget('projection-3d', (el) => {
    const s = { y: [2, 4, 3], cols: true, P: false };
    const X = [[1, 1], [1, 2], [1, 3]];
    const w = ui.shell(el, { title: 'Проекция на плоскость столбцов: МНК для трёх квартир', sub: 'Столбцы X — вектор единиц и площади x = (1, 2, 3) — натягивают синюю плоскость: все прогнозы прямых b + k·x. Ползунки двигают вектор цен y. Проекция ŷ — ближайшая точка плоскости, остаток r = y − ŷ перпендикулярен ей. Вращайте сцену, чтобы убедиться.' });
    const sl = [0, 1, 2].map((i) => ui.slider(w.controls, { label: 'цена ' + (i + 1) + ', y' + ['₁', '₂', '₃'][i], min: -1, max: 6, step: 0.5, value: s.y[i], format: f1, onInput: (v) => ((s.y[i] = v), draw()) }));
    ui.button(w.controls, { label: 'y = x (на плоскости)', onClick: () => ((s.y = [1, 2, 3]), sl.forEach((c, i) => c.set(s.y[i])), draw()) });
    ui.button(w.controls, { label: 'y = (2, 4, 3)', onClick: () => ((s.y = [2, 4, 3]), sl.forEach((c, i) => c.set(s.y[i])), draw()) });
    ui.toggle(w.controls, { label: 'Столбцы 1 и x', checked: s.cols, onChange: (v) => ((s.cols = v), draw()) });
    ui.toggle(w.controls, { label: 'Матрица проекции P', checked: s.P, onChange: (v) => ((s.P = v), draw()) });
    const scene = new Scene3D(w.main, { height: 380, R: 5, center: [2, 2, 2], az: 0.62, el: 0.5 });
    const mt = H('div', { style: 'margin-top:4px;overflow-x:auto;overflow-y:hidden' });
    w.main.appendChild(mt);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'w = (b, k)' }, { key: 'yh', label: 'ŷ = Xw' }, { key: 'r', label: 'r = y − ŷ' }, { key: 'o', label: 'r·1, r·x' }, { key: 'n', label: '‖r‖²' }]);
    const Pm = matMul(matMul(X, [[14 / 6, -1], [-1, 0.5]]), transpose(X));
    function draw() {
      const y = s.y;
      const wv = solve(XtX(X), Xty(X, y));
      const yh = matVec(X, wv);
      const r = vsub(y, yh);
      const corner = (a, b) => [a - b, a, a + b];
      const items = axes3(4.8, ['цена 1', 'цена 2', 'цена 3']);
      items.push({ type: 'poly', pts: [corner(-0.3, -1.3), corner(4.4, -1.3), corner(4.4, 1.3), corner(-0.3, 1.3)], color: 'model', opacity: 0.13, stroke: 'model' });
      if (s.cols) {
        items.push({ type: 'arrow', from: [0, 0, 0], to: [1, 1, 1], color: 'aqua', width: 2.4 });
        items.push({ type: 'text', at: [1, 1, 1], text: '1', color: 'aqua', dx: 6, dy: 14, bold: true });
        items.push({ type: 'arrow', from: [0, 0, 0], to: [1, 2, 3], color: 'violet', width: 2.4 });
        items.push({ type: 'text', at: [1, 2, 3], text: 'x', color: 'violet', dx: 6, dy: -6, bold: true });
      }
      if (norm(r) > 0.05) {
        items.push({ type: 'seg', from: yh, to: y, color: 'tree', width: 2.4, dash: '5 4' });
        items.push(...rightAngle3(yh, unit([1, 1, 1]), unit(r), 0.3));
      }
      items.push({ type: 'arrow', from: [0, 0, 0], to: yh, color: 'model', width: 2.2, opacity: 0.8 });
      items.push({ type: 'point', at: yh, color: 'model', r: 6 });
      items.push({ type: 'text', at: yh, text: 'ŷ', color: 'model', dx: 9, dy: 14, bold: true });
      items.push({ type: 'arrow', from: [0, 0, 0], to: y, color: 'ink', width: 2.6 });
      items.push({ type: 'text', at: y, text: 'y = ' + fv(y, 1), color: 'ink', dx: -8, dy: -8, bold: true, anchor: 'end' });
      scene.render(items);
      if (s.P) texInto(mt, R`P = X(X^\top X)^{-1}X^\top = \frac16\begin{pmatrix} 5 & 2 & -1 \\ 2 & 2 & 2 \\ -1 & 2 & 5\end{pmatrix},\quad \hat y = Py = ` + texVec(matVec(Pm, y), 3), true);
      else texInto(mt, R`X^\top X = \begin{pmatrix} 3 & 6 \\ 6 & 14\end{pmatrix},\quad X^\top y = ` + texVec(Xty(X, y), 2) + R`,\quad w = ` + texVec(wv, 3), true);
      st.set('w', fv(wv, 3));
      st.set('yh', fv(yh, 3));
      st.set('r', fv(r, 3));
      st.set('o', f4(clean(U.sum(r))) + ', ' + f4(clean(dot(r, [1, 2, 3]))));
      st.set('n', f3(dot(r, r)));
      note.innerHTML = norm(r) < 1e-9
        ? '<b>y лежит в плоскости</b> — проекция совпадает с y, остаток нулевой: прямая проходит через все три точки.'
        : 'Нормальные уравнения дали b = ' + f3(wv[0]) + ', k = ' + f3(wv[1]) + '. Остаток r = ' + fv(r, 3) + ' перпендикулярен обоим столбцам: r·1 = 0 и r·x = 0, а значит, всей плоскости. ‖r‖² = ' + f3(dot(r, r)) + ' — меньше, чем у любой другой точки плоскости.';
    }
    w.pythonAction(() => PY_NP + 'X = np.array([[1, 1], [1, 2], [1, 3.0]])\ny = np.array([' + s.y.map(py).join(', ') + '])\n\nw = np.linalg.solve(X.T @ X, X.T @ y)\nyhat = X @ w\nr = y - yhat\nprint("w =", w, " ŷ =", yhat, " r =", r)\nprint("Xᵀr =", (X.T @ r).round(12))\nP = X @ np.linalg.inv(X.T @ X) @ X.T\nprint("P =\\n", (6 * P).round(6), "/ 6")\nprint("P² = P:", np.allclose(P @ P, P), " след:", np.trace(P), " собственные числа:", np.linalg.eigvalsh(P).round(6))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 18. Метод наименьших квадратов и чаша потерь
   * ============================================================================== */
  GBC.widget('least-squares', (el) => {
    const s = { b: 1, k: 1 };
    const OPT = [-0.4, 192 / 105];
    const X = FX.map((x) => [1, x]);
    const w = ui.shell(el, { title: 'Метод наименьших квадратов: прямая и чаша потерь', sub: 'Сверху — шесть квартир, прямая ŷ = b + k·x и остатки. Снизу — линии уровня суммы квадратов остатков как функции (b, k); крупная точка цвета текста — текущие веса (её можно тянуть), стрелка — направление антиградиента 2Xᵀr. Найдите минимум вручную или нажмите «МНК».' });
    const sb = ui.slider(w.controls, { label: 'Сдвиг b', min: -3, max: 5, step: 0.05, value: s.b, format: f2, onInput: (v) => ((s.b = v), draw()) });
    const sk = ui.slider(w.controls, { label: 'Наклон k', min: -0.5, max: 3, step: 0.01, value: s.k, format: f2, onInput: (v) => ((s.k = v), draw()) });
    ui.button(w.controls, { label: 'МНК: решить XᵀX·w = Xᵀy', kind: 'primary', onClick: () => ((s.b = OPT[0]), (s.k = OPT[1]), sb.set(s.b), sk.set(s.k), draw()) });
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'площадь x', domain: [0.5, 6.5] }, y: { label: 'цена y', domain: [-1, 13] } });
    const plot2 = new GBC.Plot(w.main, { height: 260, x: { label: 'сдвиг b', domain: [-3, 5] }, y: { label: 'наклон k', domain: [-0.5, 3] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sse', label: '‖r‖²' }, { key: 'x0', label: '(Xᵀr)₁ = Σ rᵢ' }, { key: 'x1', label: '(Xᵀr)₂ = Σ xᵢrᵢ' }, { key: 'r2', label: 'R² = 1 − ‖r‖²/64' }]);
    const SSE = (b, k) => U.sum(FX.map((x, i) => (FY[i] - b - k * x) ** 2));
    const grid = GBC.Plot.grid(SSE, -3, 5, -0.5, 3, 90, 70);
    const LEV = [6, 8, 12, 20, 35, 60, 100, 160, 250];
    function draw() {
      const { b, k } = s;
      const pred = FX.map((x) => b + k * x);
      const r = FY.map((v, i) => v - pred[i]);
      plot.render([
        { type: 'segments', x1: FX, y1: pred, x2: FX, y2: FY, color: 'residual', width: 2.2, opacity: 0.9 },
        { type: 'line', x: [0.5, 6.5], y: [0.5, 6.5].map((v) => b + k * v), color: 'model', width: 2.4, label: 'ŷ = b + k·x', hover: false },
        { type: 'points', x: FX, y: FY, color: 'data', r: 5, label: 'квартиры' },
      ]);
      const g = [U.sum(r), U.sum(r.map((v, i) => v * FX[i]))];
      // стрелка антиградиента 2Xᵀr, нормированная для наглядности
      const gl = Math.hypot(g[0] / 8, g[1] / 3.5);
      const ar = gl > 1e-9 ? [(g[0] / gl) * 0.9, (g[1] / gl) * 0.4] : [0, 0];
      plot2.render([
        ...LEV.map((lv, i) => ({ type: 'contour', grid, level: lv, color: i === 0 ? 'model' : 'muted', width: i === 0 ? 1.8 : 1 })),
        gl > 1e-6 ? { type: 'arrows', x1: [b], y1: [k], x2: [b + ar[0]], y2: [k + ar[1]], color: 'tree', width: 2.2 } : null,
        { type: 'points', x: [OPT[0]], y: [OPT[1]], color: 'good', r: 6, label: 'минимум (−0.4, 1.829)' },
        { type: 'points', x: [b], y: [k], color: 'ink', r: 6, label: 'текущие (b, k)', draggable: true, onDrag: (i, x, y) => {
          s.b = U.clamp(snap(x, 0.05), -3, 5);
          s.k = U.clamp(snap(y, 0.01), -0.5, 3);
          sb.set(s.b);
          sk.set(s.k);
          draw();
        } },
      ]);
      const sse = U.sum(r.map((v) => v * v));
      st.set('sse', f4(sse));
      st.set('x0', f3(clean(g[0])));
      st.set('x1', f3(clean(g[1])));
      st.set('r2', f3(1 - sse / 64));
      const opt = Math.abs(g[0]) < 1e-6 && Math.abs(g[1]) < 1e-6;
      note.innerHTML = opt
        ? '<b>Оптимум:</b> ŷ = −0.4 + 1.829·x, сумма квадратов 5.486 — меньше не бывает; R² = 0.914. Обе суммы ноль: остатки ортогональны столбцу единиц и столбцу x. Чаша вытянута вдоль направления, где сдвиг и наклон компенсируют друг друга (шаг 25).'
        : 'Градиент суммы квадратов по (b, k) равен −2·Xᵀr = −2·' + fv(g, 2) + '. Пока он не ноль, прямую можно улучшить, сдвинувшись по оранжевой стрелке. Линии уровня — эллипсы: функция квадратичная, это «чаша» с одним минимумом.';
    }
    w.pythonAction(() => PY_FLATS + 'X = np.c_[np.ones(6), x]\n\nw = np.linalg.solve(X.T @ X, X.T @ y)       # нормальные уравнения\nr = y - X @ w\nprint("b, k =", w, " ‖r‖² =", r @ r, " R² =", 1 - (r @ r) / ((y - y.mean()) @ (y - y.mean())))\nprint("наклон через ковариацию:", ((x - x.mean()) @ (y - y.mean())) / ((x - x.mean()) @ (x - x.mean())))\n\nb, k = ' + py(s.b) + ', ' + py(s.k) + '\nr_cur = y - (b + k * x)\nprint("для текущих (b, k): ‖r‖² =", r_cur @ r_cur, " Xᵀr =", X.T @ r_cur)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 19. Полиномиальные признаки и переобучение
   * ============================================================================== */
  GBC.widget('poly-fit', (el) => {
    const s = { d: 1, out: 0 };
    const zs = (() => {
      const m = U.mean(FX);
      const sd = Math.sqrt(U.mean(FX.map((v) => (v - m) ** 2)));
      return (x) => (x - m) / sd;
    })();
    const w = ui.shell(el, { title: 'Полином по МНК: обучение против проверки', sub: 'Столбцы матрицы — 1, x, x², …, xᵈ. Чем выше степень, тем ближе кривая к точкам. Ползунок «выколоть квартиру» обучает модель без одной квартиры и показывает ошибку на ней — это проверка с исключением по одному (LOO).' });
    ui.slider(w.controls, { label: 'Степень d', min: 0, max: 5, step: 1, value: s.d, format: String, onInput: (v) => ((s.d = v), draw()) });
    ui.slider(w.controls, { label: 'Выколоть квартиру', min: 0, max: 6, step: 1, value: s.out, format: (v) => (v ? '№' + v : 'нет'), onInput: (v) => ((s.out = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'площадь x', domain: [0.5, 6.5] }, y: { label: 'цена y', domain: [-4, 16] } });
    const mt = H('div', { style: 'margin-top:4px;overflow-x:auto;overflow-y:hidden' });
    w.main.appendChild(mt);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sse', label: 'Σ квадратов на обучении' }, { key: 'loo', label: 'ошибка LOO (MSE)' }, { key: 'kr', label: 'κ(XᵀX), сырой x' }, { key: 'ks', label: 'κ, стандартизованный x' }]);
    function fit(idx, d) {
      if (idx.length < d + 1) return null;
      return lstsq(vander(idx.map((i) => FX[i]), d), idx.map((i) => FY[i]));
    }
    const ev = (wv, x) => wv.reduce((acc, c, k) => acc + c * Math.pow(x, k), 0);
    function loo(d) {
      if (d + 1 > 5) return NaN;
      return U.mean(U.range(6).map((i) => {
        const wv = fit(U.range(6).filter((j) => j !== i), d);
        return (FY[i] - ev(wv, FX[i])) ** 2;
      }));
    }
    function draw() {
      const d = s.d;
      const all = U.range(6);
      const wv = fit(all, d);
      const xs = U.linspace(0.5, 6.5, 241);
      const L = [{ type: 'line', x: xs, y: xs.map((x) => ev(wv, x)).map((v) => (v < -6 || v > 18 ? NaN : v)), color: 'model', width: 2.4, label: 'степень ' + d + ', все точки', hover: false }];
      let outErr = null;
      if (s.out) {
        const i = s.out - 1;
        const w2 = fit(all.filter((j) => j !== i), d);
        if (w2) {
          L.push({ type: 'line', x: xs, y: xs.map((x) => ev(w2, x)).map((v) => (v < -6 || v > 18 ? NaN : v)), color: 'tree', width: 2.2, dash: '6 4', label: 'без квартиры №' + s.out, hover: false });
          const pv = ev(w2, FX[i]);
          outErr = (FY[i] - pv) ** 2;
          L.push({ type: 'segments', x1: [FX[i]], y1: [FY[i]], x2: [FX[i]], y2: [U.clamp(pv, -4, 16)], color: 'critical', width: 2.4, opacity: 1 });
        }
      }
      plot.render([
        ...L,
        { type: 'points', x: FX, y: FY, color: (i) => (s.out === i + 1 ? 'critical' : 'data'), r: 5.5, label: 'квартиры', legendColor: 'data' },
      ]);
      const sse = U.sum(FX.map((x, i) => (FY[i] - ev(wv, x)) ** 2));
      const V = vander(FX, d);
      const Vs = vander(FX.map(zs), d);
      st.set('sse', f4(clean(sse) < 1e-9 ? 0 : sse));
      st.set('loo', d >= 5 ? 'не определена' : f3(loo(d)));
      st.set('kr', sci(condSym(XtX(V))));
      st.set('ks', sci(condSym(XtX(Vs))));
      texInto(mt, R`\hat y = ` + wv.map((c, k) => (k === 0 ? tn(c, 3) : (c >= 0 ? ' + ' : ' - ') + tn(Math.abs(c), 4) + (k === 1 ? 'x' : 'x^{' + k + '}'))).join(''), true);
      note.innerHTML = (d === 0 ? 'Степень 0 — константа, то есть среднее.' : d === 5 ? '<b>Степень 5:</b> шесть коэффициентов на шесть точек — кривая проходит через все, ошибка на обучении 0. Но без любой одной точки коэффициентов больше, чем данных: МНК не определён.' : 'Степень ' + d + ': на обучении ' + f3(sse) + ', а честная ошибка LOO ' + f3(loo(d)) + '.') +
        (outErr !== null ? ' Без квартиры №' + s.out + ' кривая промахивается по ней на ' + f3(Math.sqrt(outErr)) + ' (квадрат ' + f3(outErr) + ').' : '') +
        ' Обусловленность с сырым x растёт катастрофически; стандартизация (z = (x − 3.5)/1.708) держит её в разумных пределах.';
    }
    w.pythonAction(() => PY_FLATS + 'd = ' + s.d + '\nV = np.vander(x, d + 1, increasing=True)        # столбцы 1, x, …, x^d\nw = np.linalg.lstsq(V, y, rcond=None)[0]\nprint("коэффициенты:", w.round(4), " Σ квадратов:", ((y - V @ w) ** 2).sum().round(4))\n\nloo = []\nfor i in range(6):\n    m = np.arange(6) != i\n    if m.sum() < d + 1:\n        break\n    wi = np.linalg.lstsq(V[m], y[m], rcond=None)[0]\n    loo.append((y[i] - V[i] @ wi) ** 2)\nprint("LOO MSE:", np.mean(loo) if len(loo) == 6 else "не определена")\nz = (x - x.mean()) / x.std()\nVs = np.vander(z, d + 1, increasing=True)\nprint(f"κ(VᵀV): сырой {np.linalg.cond(V.T @ V):.3e}, стандартизованный {np.linalg.cond(Vs.T @ Vs):.3e}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 20. Гребневая регрессия
   * ============================================================================== */
  GBC.widget('ridge', (el) => {
    const s = { lam: 0.01, view: 'path' };
    const m = U.mean(FX);
    const sd = Math.sqrt(U.mean(FX.map((v) => (v - m) ** 2)));
    const Z = FX.map((x) => (x - m) / sd);
    const V = vander(Z, 5);
    const D = [0, 1, 1, 1, 1, 1];
    const ridgeW = (rows, lam) => {
      const Vr = rows.map((i) => V[i]);
      const A = XtX(Vr).map((r, i) => r.map((v, j) => v + (i === j ? lam * D[i] : 0)));
      return solve(A, Xty(Vr, rows.map((i) => FY[i])));
    };
    const looErr = (lam) => U.mean(U.range(6).map((i) => {
      const wv = ridgeW(U.range(6).filter((j) => j !== i), lam);
      return wv ? (FY[i] - dot(V[i], wv)) ** 2 : NaN;
    }));
    const LAMS = U.linspace(-4, 2, 121).map((e) => Math.pow(10, e));
    const PATH = LAMS.map((l) => ridgeW(U.range(6), l));
    const LOO = LAMS.map(looErr);
    const w = ui.shell(el, { title: 'Гребневая регрессия: λ укрощает полином пятой степени', sub: 'Полином 5-й степени по стандартизованной площади, штраф λ·(w₁² + … + w₅²) (сдвиг не штрафуется). Малое λ — кривая проходит почти через все точки; большое — веса сжимаются, кривая выпрямляется. Внизу — пути весов или ошибка LOO в зависимости от λ.' });
    const slam = ui.slider(w.controls, { label: 'λ', min: 1e-4, max: 100, log: true, value: s.lam, format: (v) => sci(v), onInput: (v) => ((s.lam = v), draw()) });
    ui.segmented(w.controls, { label: 'Нижний график', value: s.view, options: [{ value: 'path', label: 'пути весов' }, { value: 'loo', label: 'ошибка LOO' }], onChange: (v) => ((s.view = v), draw()) });
    ui.button(w.controls, { label: 'λ с лучшей LOO', onClick: () => {
      s.lam = LAMS[LOO.indexOf(Math.min(...LOO))];
      slam.set(s.lam);
      draw();
    } });
    const plot = new GBC.Plot(w.main, { height: 270, x: { label: 'площадь x', domain: [0.5, 6.5] }, y: { label: 'цена y', domain: [-2, 15] } });
    const plot2 = new GBC.Plot(w.main, { height: 200, x: { label: 'λ', type: 'log', domain: [1e-4, 100], ticks: decades(-4, 2), format: powFmt }, y: { label: '' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sse', label: 'Σ квадратов' }, { key: 'loo', label: 'LOO (MSE)' }, { key: 'k', label: 'κ(VᵀV + λD)' }, { key: 'n', label: '‖(w₁…w₅)‖' }]);
    function draw() {
      const lam = s.lam;
      const wv = ridgeW(U.range(6), lam);
      const xs = U.linspace(0.5, 6.5, 241);
      const pz = (x) => dot(U.range(6).map((k) => Math.pow((x - m) / sd, k)), wv);
      plot.render([
        { type: 'line', x: [0.5, 6.5], y: [-0.4 + (192 / 105) * 0.5, -0.4 + (192 / 105) * 6.5], color: 'muted', width: 1.4, dash: '5 4', label: 'МНК-прямая', hover: false },
        { type: 'line', x: xs, y: xs.map(pz).map((v) => (v < -4 || v > 17 ? NaN : v)), color: 'model', width: 2.4, label: 'полином 5-й степени, ridge', hover: false },
        { type: 'points', x: FX, y: FY, color: 'data', r: 5, label: 'квартиры' },
      ]);
      if (s.view === 'path') {
        plot2.opts.y.label = 'веса w₁…w₅';
        plot2.render([
          ...[1, 2, 3, 4, 5].map((k) => ({ type: 'line', x: LAMS, y: PATH.map((p) => p[k]), color: GBC.colors.series(k - 1), width: 2, label: 'w' + ['₁', '₂', '₃', '₄', '₅'][k - 1] })),
          { type: 'hline', y: 0, color: 'axis' },
          { type: 'vline', x: lam, color: 'ink2', dash: '4 4', width: 1.2 },
        ], { y: [-9, 9] });
      } else {
        plot2.opts.y.label = 'LOO (MSE)';
        plot2.render([
          { type: 'line', x: LAMS, y: LOO, color: 'valid', width: 2.2, label: 'ошибка LOO' },
          { type: 'hline', y: 1.665, color: 'muted', dash: '4 4', width: 1.2, label: 'прямая: 1.665' },
          { type: 'vline', x: lam, color: 'ink2', dash: '4 4', width: 1.2 },
        ], { y: [0, 40] });
      }
      const sse = U.sum(V.map((r, i) => (FY[i] - dot(r, wv)) ** 2));
      const A = XtX(V).map((r, i) => r.map((v, j) => v + (i === j ? lam * D[i] : 0)));
      const lo = looErr(lam);
      st.set('sse', f3(sse));
      st.set('loo', f3(lo));
      st.set('k', sci(condSym(A)));
      st.set('n', f3(norm(wv.slice(1))));
      const bi = LOO.indexOf(Math.min(...LOO));
      note.innerHTML = 'λ = ' + sci(lam) + ': сумма квадратов ' + f3(sse) + ', ошибка LOO ' + f3(lo) + '. ' + (lam < 0.3 ? 'Штраф ещё слаб — полином извивается между точками, веса велики.' : lam > 20 ? 'Штраф слишком силён — модель стремится к константе (сдвиг не штрафуется).' : 'Веса сжались, кривая разумна.') +
        ' Лучшая LOO ' + f3(LOO[bi]) + ' — при λ ≈ ' + f1(LAMS[bi]) + '; прямая всё равно лучше (1.665): регуляризация спасает переусложнённую модель, но не заменяет выбор признаков.';
    }
    w.pythonAction(() => PY_FLATS + 'z = (x - x.mean()) / x.std()\nV = np.vander(z, 6, increasing=True)\nD = np.diag([0, 1, 1, 1, 1, 1.0])          # сдвиг не штрафуем\nlam = ' + py(s.lam) + '\n\ndef ridge(Vm, ym, lam):\n    return np.linalg.solve(Vm.T @ Vm + lam * D, Vm.T @ ym)\n\nw = ridge(V, y, lam)\nloo = np.mean([(y[i] - V[i] @ ridge(np.delete(V, i, 0), np.delete(y, i), lam)) ** 2 for i in range(6)])\nprint("веса:", w.round(3))\nprint("Σ квадратов:", ((y - V @ w) ** 2).sum().round(4), " LOO:", round(loo, 4))\nprint(f"κ(VᵀV + λD) = {np.linalg.cond(V.T @ V + lam * D):.3e}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 21. Собственные векторы
   * ============================================================================== */
  const EIG_PRE = {
    sym: { label: '[[2, 1], [1, 2]]', m: [[2, 1], [1, 2]] },
    diag: { label: 'diag(2, 3)', m: [[2, 0], [0, 3]] },
    ns: { label: '[[4, 1], [2, 3]]', m: [[4, 1], [2, 3]] },
    proj: { label: 'проекция на ось x', m: [[1, 0], [0, 0]] },
    refl: { label: 'отражение diag(−1, 1)', m: [[-1, 0], [0, 1]] },
    rot: { label: 'поворот на 90°', m: [[0, -1], [1, 0]] },
    shear: { label: 'сдвиг [[1, 1], [0, 1]]', m: [[1, 1], [0, 1]] },
  };
  GBC.widget('eigen', (el) => {
    const s = { m: [[2, 1], [1, 2]], ang: 20, k: 0 };
    const w = ui.shell(el, { title: 'Собственные векторы: направления, которые не поворачиваются', sub: 'Окружность единичных векторов переходит в эллипс. Оранжевый вектор v и его образ Av (цвета текста): почти всегда Av повёрнут. Фиолетовые прямые — собственные направления. Нижний график — угол между v и Av для всех направлений: нули — собственные векторы.' });
    ui.select(w.controls, { label: 'Матрица', value: 'sym', options: Object.entries(EIG_PRE).map(([k, v]) => ({ value: k, label: v.label })), onChange: (k) => {
      s.m = EIG_PRE[k].m.map((r) => r.slice());
      sync();
      draw();
    } });
    const names = [['a', 0, 0], ['b', 0, 1], ['c', 1, 0], ['d', 1, 1]];
    const sl = names.map(([nm, i, j]) => ui.slider(w.controls, { label: nm, min: -2, max: 4, step: 0.1, value: s.m[i][j], format: f1, onInput: (v) => ((s.m[i][j] = v), draw()) }));
    const sync = () => names.forEach(([, i, j], k) => sl[k].set(s.m[i][j]));
    const sa = ui.slider(w.controls, { label: 'Направление v', min: 0, max: 179, step: 1, value: s.ang, format: (v) => v + '°', onInput: (v) => ((s.ang = v), (s.k = 0), pl.set(0), draw()) });
    const pl = ui.player(w.controls, { label: 'Применять A снова и снова', min: 0, max: 12, value: 0, fps: 1.5, format: (v) => v + ' раз', onChange: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main), { height: 330, equal: true, x: { label: 'x', domain: [-4, 4] }, y: { label: 'y', domain: [-3.2, 3.2] } });
    const plot2 = new GBC.Plot(w.main, { height: 160, x: { label: 'направление v, градусы', domain: [0, 180] }, y: { label: 'угол v и Av', domain: [0, 95] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'l', label: 'собственные числа' }, { key: 'a', label: 'угол между v и Av' }, { key: 'r', label: '‖Av‖ / ‖v‖' }]);
    const angleBetween = (u, v) => {
      const c = Math.abs(u[0] * v[1] - u[1] * v[0]);
      const d = u[0] * v[0] + u[1] * v[1];
      const a = (Math.atan2(c, d) * 180) / Math.PI;
      return Math.min(a, 180 - a);
    };
    function draw() {
      const A = s.m;
      const E = eig2(A);
      const circ = U.linspace(0, 2 * Math.PI, 200).map((t) => [Math.cos(t), Math.sin(t)]);
      const ell = circ.map((p) => matVec(A, p));
      let v = [Math.cos((s.ang * Math.PI) / 180), Math.sin((s.ang * Math.PI) / 180)];
      for (let i = 0; i < s.k; i++) {
        const nv = matVec(A, v);
        const nn = norm(nv);
        if (nn < 1e-12) break;
        v = vscale(nv, 1 / nn);
      }
      const Av = matVec(A, v);
      const L = [
        { type: 'line', x: circ.map((p) => p[0]), y: circ.map((p) => p[1]), color: 'muted', width: 1.2, dash: '4 4', hover: false },
        { type: 'line', x: ell.map((p) => p[0]), y: ell.map((p) => p[1]), color: 'model', width: 2, hover: false },
      ];
      const dirs = [];
      if (E.real) {
        const add = (vec, lam) => {
          if (!vec) return;
          dirs.push({ vec, lam });
        };
        if (E.v1 === null && E.v2 === null) {
          /* A = λI: любое направление собственное */
        } else {
          add(E.v1, E.l1);
          if (!E.repeated) add(E.v2, E.l2);
        }
      }
      dirs.forEach(({ vec, lam }) => {
        L.push({ type: 'line', x: [-6 * vec[0], 6 * vec[0]], y: [-6 * vec[1], 6 * vec[1]], color: 'violet', width: 1.6, opacity: 0.5, hover: false });
        L.push({ type: 'arrows', x1: [0], y1: [0], x2: [lam * vec[0]], y2: [lam * vec[1]], color: 'violet', width: 2.6, opacity: 0.85 });
        L.push({ type: 'text', items: [{ x: lam * vec[0], y: lam * vec[1], dx: 6, dy: -6, text: 'λ = ' + f2(lam), color: 'violet' }] });
      });
      plot.render([
        ...L,
        { type: 'arrows', x1: [0], y1: [0], x2: [v[0]], y2: [v[1]], color: 'tree', width: 2.8 },
        { type: 'arrows', x1: [0], y1: [0], x2: [Av[0]], y2: [Av[1]], color: 'ink', width: 2.2 },
        { type: 'text', items: [{ x: v[0], y: v[1], dx: 6, dy: 14, text: 'v', bold: true }, { x: Av[0], y: Av[1], dx: 6, dy: -6, text: 'Av', bold: true }] },
      ]);
      const th = U.range(181);
      const ang = th.map((t) => {
        const u = [Math.cos((t * Math.PI) / 180), Math.sin((t * Math.PI) / 180)];
        const Au = matVec(A, u);
        return norm(Au) < 1e-12 ? 0 : angleBetween(u, Au);
      });
      plot2.render([
        { type: 'line', x: th, y: ang, color: 'model', width: 2, label: 'угол между v и Av' },
        ...dirs.map(({ vec }) => {
          let t = (Math.atan2(vec[1], vec[0]) * 180) / Math.PI;
          t = ((t % 180) + 180) % 180;
          return { type: 'vline', x: t, color: 'violet', dash: '4 4', width: 1.2 };
        }),
        { type: 'points', x: [((((Math.atan2(v[1], v[0]) * 180) / Math.PI) % 180) + 180) % 180], y: [angleBetween(v, Av)], color: 'tree', r: 5.5 },
      ]);
      st.set('l', E.real ? 'λ₁ = ' + f3(E.l1) + ', λ₂ = ' + f3(E.l2) : f3(E.re) + ' ± ' + f3(E.im) + 'i');
      st.set('a', f2(angleBetween(v, Av)) + '°');
      st.set('r', f3(norm(Av)));
      const sym = Math.abs(A[0][1] - A[1][0]) < 1e-9;
      note.innerHTML = (!E.real
        ? '<b>Вещественных собственных векторов нет:</b> собственные числа комплексные (' + f3(E.re) + ' ± ' + f3(E.im) + 'i) — матрица поворачивает каждый вектор, график углов нигде не касается нуля.'
        : E.repeated && dirs.length === 1
          ? '<b>Кратное собственное число</b> λ = ' + f3(E.l1) + ' и одно направление: «дефектная» матрица, из собственных векторов нельзя составить базис.'
          : dirs.length === 0 ? 'A = λI: любой вектор собственный.' : 'Собственные числа ' + f3(E.l1) + ' и ' + f3(E.l2) + (sym ? '; матрица симметрична — собственные направления перпендикулярны, это оси эллипса.' : '; матрица несимметрична — собственные направления не обязаны быть перпендикулярными и не совпадают с осями эллипса.')) +
        (s.k > 0 ? ' После ' + s.k + ' применений (с нормировкой) v повернулся к направлению с наибольшим |λ| — так работает степенной метод.' : '');
    }
    w.pythonAction(() => PY_NP + 'A = np.array(' + JSON.stringify(s.m) + ')\nvals, vecs = np.linalg.eig(A)\nprint("собственные числа:", vals)\nprint("собственные векторы (столбцы):\\n", vecs)\nfor lam, v in zip(vals, vecs.T):\n    print("A·v − λ·v =", np.round(A @ v - lam * v, 12))\n\nv = np.array([np.cos(np.radians(' + s.ang + ')), np.sin(np.radians(' + s.ang + '))])\nfor _ in range(12):                    # степенной метод\n    v = A @ v\n    v /= np.linalg.norm(v)\nprint("после 12 применений:", v)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 22. Характеристический многочлен по шагам
   * ============================================================================== */
  const CP_PRE = {
    sym: { label: '[[2, 1], [1, 2]]', m: [[2, 1], [1, 2]] },
    ns: { label: '[[4, 1], [2, 3]]', m: [[4, 1], [2, 3]] },
    tri: { label: '[[3, 0], [4, 5]]', m: [[3, 0], [4, 5]] },
    fib: { label: 'Фибоначчи [[1, 1], [1, 0]]', m: [[1, 1], [1, 0]] },
    rot: { label: 'поворот [[0, −1], [1, 0]]', m: [[0, -1], [1, 0]] },
    shear: { label: 'сдвиг [[1, 1], [0, 1]]', m: [[1, 1], [0, 1]] },
  };
  GBC.widget('eigen-solver', (el) => {
    const s = { key: 'ns', k: 8 };
    const w = ui.shell(el, { title: 'Собственные числа по шагам: det(A − λI) = 0', sub: 'Выберите матрицу и проходите шаги: вычитаем λ на диагонали, считаем определитель, решаем квадратное уравнение, находим векторы и проверяем теорему Виета. Ниже — график характеристического многочлена p(λ): его корни и есть собственные числа.', foot: false });
    ui.select(w.controls, { label: 'Матрица', value: s.key, options: Object.entries(CP_PRE).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), (s.k = 8), pl.set(8), draw()) });
    const pl = ui.player(w.controls, { label: 'Шаг', min: 1, max: 8, value: 8, fps: 0.7, format: (v, m) => 'шаг ' + v + ' из ' + m, onChange: (v) => ((s.k = v), draw()) });
    const grid = cardGrid(420);
    const cl = card('Решение');
    const cr = card('p(λ) = λ² − tr·λ + det');
    grid.append(cl.el, cr.el);
    w.main.appendChild(grid);
    const list = H('ol', { style: 'margin:0;padding-left:1.3em;display:grid;gap:6px' });
    cl.body.appendChild(list);
    const plot = new GBC.Plot(cr.body, { height: 230, x: { label: 'λ' }, y: { label: 'p(λ)' } });
    const note = w.note('', true);
    function draw() {
      const A = CP_PRE[s.key].m;
      const [[a, b], [c, d]] = A;
      const tr = a + d;
      const dt = a * d - b * c;
      const E = eig2(A);
      const disc = tr * tr - 4 * dt;
      const vecTex = (l, v) => {
        if (!v) return R`\text{любой вектор}`;
        const k = Math.abs(v[0]) > 1e-9 ? 1 / v[0] : 1 / v[1];
        const vv = v.map((x) => clean(x * k));
        return R`\lambda = ${tn(l)}:\ (A - ${tn(l)}I)v = 0 \;\Rightarrow\; v \propto ` + texVec(vv, 3);
      };
      const steps = [
        ['Вычитаем λ из диагонали:', R`A - \lambda I = \begin{pmatrix} ${tn(a)} - \lambda & ${tn(b)} \\ ${tn(c)} & ${tn(d)} - \lambda\end{pmatrix}`],
        ['Определитель — квадратный трёхчлен:', R`\det(A - \lambda I) = (${tn(a)} - \lambda)(${tn(d)} - \lambda) - (${tn(b)})\cdot(${tn(c)})`],
        ['Раскрываем скобки: коэффициенты — след и определитель:', R`p(\lambda) = \lambda^2 - ${tn(tr)}\,\lambda + ${tn(dt)},\quad \operatorname{tr}A = ${tn(tr)},\ \det A = ${tn(dt)}`],
        ['Дискриминант решает, какие корни:', R`D = \operatorname{tr}^2 - 4\det = ${tn(disc)}` + (disc > 1e-9 ? R` > 0\ \text{— два вещественных}` : Math.abs(disc) <= 1e-9 ? R` = 0\ \text{— кратный корень}` : R` < 0\ \text{— комплексные}`)],
        ['Корни — собственные числа:', E.real ? R`\lambda_{1,2} = \frac{${tn(tr)} \pm \sqrt{${tn(Math.max(disc, 0))}}}{2} = ${tn(E.l1)},\ ${tn(E.l2)}` : R`\lambda = ${tn(E.re)} \pm ${tn(E.im)}\,i`],
        ['Вектор для первого числа:', E.real ? vecTex(E.l1, E.v1) : R`\text{вещественных векторов нет}`],
        ['Вектор для второго числа:', E.real ? (E.repeated ? R`\text{то же } \lambda\text{: ` + (E.v1 ? R`одно направление}` : R`любой вектор}`) : vecTex(E.l2, E.v2)) : R`\text{матрица поворачивает все векторы}`],
        ['Проверка (теорема Виета):', E.real ? R`\lambda_1 + \lambda_2 = ${tn(E.l1 + E.l2)} = \operatorname{tr}A,\quad \lambda_1\lambda_2 = ${tn(E.l1 * E.l2)} = \det A` : R`(${tn(E.re)} + ${tn(E.im)}i) + (${tn(E.re)} - ${tn(E.im)}i) = ${tn(2 * E.re)} = \operatorname{tr}A`],
      ];
      stepList(list, steps, s.k);
      const c0 = tr / 2;
      const span = Math.max(3, E.real ? Math.abs(E.l1 - E.l2) + 2 : 3);
      const ls = U.linspace(c0 - span, c0 + span, 161);
      plot.render([
        { type: 'line', x: ls, y: ls.map((l) => l * l - tr * l + dt), color: 'model', width: 2.2, label: 'p(λ)' },
        { type: 'hline', y: 0, color: 'axis' },
        E.real && s.k >= 5 ? { type: 'points', x: [E.l1, E.l2], y: [0, 0], color: 'violet', r: 6, label: 'корни' } : null,
      ]);
      note.innerHTML = E.real
        ? (E.repeated ? 'Кратный корень λ = ' + f3(E.l1) + (E.v1 ? ': у этой матрицы одно собственное направление.' : ': собственный — любой вектор.') : 'Собственные числа ' + f3(E.l1) + ' и ' + f3(E.l2) + '. Парабола p(λ) пересекает ось ровно в них.')
        : 'Парабола p(λ) не пересекает ось: корни комплексные, ' + f3(E.re) + ' ± ' + f3(E.im) + 'i. Модуль ' + f3(Math.hypot(E.re, E.im)) + ' — растяжение, аргумент — угол поворота.';
    }
    w.pythonAction(() => PY_NP + 'A = np.array(' + JSON.stringify(CP_PRE[s.key].m) + ', dtype=float)\ntr, det = np.trace(A), np.linalg.det(A)\nprint("p(λ) = λ² −", tr, "λ +", round(det, 10))\nprint("корни многочлена:", np.roots([1, -tr, det]))\nprint("np.linalg.eigvals:", np.linalg.eigvals(A))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 23. Степени матрицы
   * ============================================================================== */
  const POW_PRE = {
    markov: { label: 'погода (цепь Маркова)', m: [[0.9, 0.5], [0.1, 0.5]], x0: [0, 1], norm: false, dom: [-0.1, 1.1, -0.1, 1.1] },
    fib: { label: 'Фибоначчи [[1, 1], [1, 0]]', m: [[1, 1], [1, 0]], x0: [1, 0], norm: true, dom: [-1.2, 1.2, -1.2, 1.2] },
    sym: { label: '[[2, 1], [1, 2]] / 3', m: [[2 / 3, 1 / 3], [1 / 3, 2 / 3]], x0: [1, -0.6], norm: false, dom: [-1.2, 1.2, -1.2, 1.2] },
    gd: { label: 'спуск: I − ηH, H = diag(1, 10), η = 0.15', m: [[0.85, 0], [0, -0.5]], x0: [1, 1], norm: false, dom: [-1.2, 1.2, -1.2, 1.2] },
  };
  GBC.widget('matrix-powers', (el) => {
    const s = { key: 'markov', k: 10 };
    const w = ui.shell(el, { title: 'Степени матрицы: x, Ax, A²x, …', sub: 'Точки — последовательность xₖ = Aᵏx₀, фиолетовые прямые — собственные направления. Внизу — модули компонент xₖ вдоль собственных векторов в логарифмической шкале: каждая меняется как |λ|ᵏ, и побеждает наибольшее |λ|.' });
    ui.select(w.controls, { label: 'Матрица', value: s.key, options: Object.entries(POW_PRE).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.player(w.controls, { label: 'Степень k', min: 0, max: 20, value: s.k, fps: 2, format: (v) => 'k = ' + v, onChange: (v) => ((s.k = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main, 460), { height: 300, equal: true, x: { label: 'x₁' }, y: { label: 'x₂' } });
    const plot2 = new GBC.Plot(w.main, { height: 190, x: { label: 'k', domain: [0, 20] }, y: { label: '|компонента|', type: 'log' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'xₖ' }, { key: 'l', label: 'λ₁, λ₂' }, { key: 'r', label: 'отношение' }]);
    function draw() {
      const P = POW_PRE[s.key];
      const A = P.m;
      const E = eig2(A);
      const Vm = [[E.v1[0], E.v2[0]], [E.v1[1], E.v2[1]]];
      const coef = solve(Vm, P.x0);
      const xs = [P.x0];
      for (let i = 0; i < 20; i++) xs.push(matVec(A, xs[xs.length - 1]));
      const shown = xs.slice(0, s.k + 1).map((p) => (P.norm ? vscale(p, 1 / norm(p)) : p));
      const [x0, x1, y0, y1] = P.dom;
      const L = [];
      if (P.norm) {
        const circ = U.linspace(0, 2 * Math.PI, 120);
        L.push({ type: 'line', x: circ.map(Math.cos), y: circ.map(Math.sin), color: 'muted', width: 1, dash: '3 4', hover: false });
      }
      [E.v1, E.v2].forEach((v, j) => L.push({ type: 'line', x: [-5 * v[0], 5 * v[0]], y: [-5 * v[1], 5 * v[1]], color: 'violet', width: 1.4, opacity: j ? 0.35 : 0.6, hover: false }));
      plot.render([
        ...L,
        { type: 'line', x: shown.map((p) => p[0]), y: shown.map((p) => p[1]), color: 'muted', width: 1.2, hover: false },
        { type: 'points', x: shown.map((p) => p[0]), y: shown.map((p) => p[1]), color: 'model', r: 4, highlight: s.k },
        { type: 'text', items: [{ x: shown[0][0], y: shown[0][1], dx: 6, dy: -6, text: 'x₀' }, { x: shown[s.k][0], y: shown[s.k][1], dx: 6, dy: 14, text: 'x' + String(s.k).split('').map((ch) => '₀₁₂₃₄₅₆₇₈₉'[+ch]).join(''), bold: true }] },
      ], { x: [x0, x1], y: [y0, y1] });
      const ks = U.range(21);
      const comp = (j) => ks.map((k) => Math.abs(coef[j] * Math.pow(j ? E.l2 : E.l1, k)));
      const c1 = comp(0);
      const c2 = comp(1);
      const all = c1.concat(c2).filter((v) => v > 1e-12);
      const lo = Math.max(1e-8, Math.min(...all));
      const hi = Math.max(...all);
      const a = Math.floor(Math.log10(lo));
      const b = Math.ceil(Math.log10(hi)) + (Math.ceil(Math.log10(hi)) === Math.floor(Math.log10(lo)) ? 1 : 0);
      const step = Math.max(1, Math.ceil((b - a) / 6));
      plot2.opts.y.ticks = decades(a, b, step);
      plot2.opts.y.format = powFmt;
      plot2.render([
        { type: 'line', x: ks, y: c1.map((v) => (v > 1e-12 ? v : NaN)), color: 'model', width: 2.2, label: '|c₁λ₁ᵏ|, λ₁ = ' + f3(E.l1) },
        { type: 'line', x: ks, y: c2.map((v) => (v > 1e-12 ? v : NaN)), color: 'tree', width: 2.2, label: '|c₂λ₂ᵏ|, λ₂ = ' + f3(E.l2) },
        { type: 'vline', x: s.k, color: 'ink2', dash: '4 4', width: 1.2 },
      ], { y: [Math.pow(10, a), Math.pow(10, b)] });
      const xk = xs[s.k];
      st.set('x', fv(xk, 4));
      st.set('l', f3(E.l1) + ', ' + f3(E.l2));
      st.set('r', s.key === 'fib' && s.k > 0 ? 'Fₖ₊₁/Fₖ = ' + f4(xk[0] / xk[1]) : '|λ₂/λ₁| = ' + f3(Math.abs(E.l2 / E.l1)));
      note.innerHTML = {
        markov: 'Начали с дождя (0, 1). Распределение погоды стремится к собственному вектору с λ = 1 — стационарному (5/6, 1/6) ≈ (0.833, 0.167); отклонение тает как 0.4ᵏ. Сейчас: ' + fv(xk, 4) + '.',
        fib: 'xₖ = (Fₖ₊₁, Fₖ): Fₖ = ' + xk[1] + '. Компонента с λ = 0.618 гаснет, и направление xₖ (нормированное, на окружности) быстро ложится на собственный вектор золотого сечения φ = 1.618.',
        sym: 'Собственные числа 1 и 1/3: компонента вдоль (1, −1) тает как 3⁻ᵏ, вдоль (1, 1) — сохраняется. Точки сходятся к проекции x₀ на диагональ.',
        gd: 'Ошибка градиентного спуска eₖ₊₁ = (I − ηH)eₖ: собственные числа 1 − η·1 = 0.85 и 1 − η·10 = −0.5. Отрицательное число — зигзаг по крутому направлению; медленное затухание 0.85ᵏ — по пологому. Это «вытянутая чаша» шага 25.',
      }[s.key];
    }
    w.pythonAction(() => PY_NP + 'A = np.array(' + JSON.stringify(POW_PRE[s.key].m) + ')\nx0 = np.array(' + JSON.stringify(POW_PRE[s.key].x0) + ', dtype=float)\nvals, V = np.linalg.eig(A)\nprint("собственные числа:", vals)\nc = np.linalg.solve(V, x0)              # x0 = c₁v₁ + c₂v₂\nk = ' + s.k + '\nprint("A^k x0 напрямую:", np.linalg.matrix_power(A, k) @ x0)\nprint("через V Λ^k c:   ", V @ (vals ** k * c))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 24. Квадратичные формы
   * ============================================================================== */
  GBC.widget('quadratic-form', (el) => {
    const s = { a: 2, b: 1, c: 2 };
    const PRE = { bowl: [1, 0, 3], rot: [2, 1, 2], saddle: [1, 2, 1], trough: [1, 1, 1], neg: [-1, 0, -2] };
    const w = ui.shell(el, { title: 'Квадратичная форма f(x) = xᵀAx = a·x₁² + 2b·x₁x₂ + c·x₂²', sub: 'Линии уровня формы: синие — положительные значения, оранжевые — отрицательные, пунктир — ноль. Фиолетовые стрелки — собственные векторы A длины 1/√|λ| (полуоси линии уровня f = ±1). Знаки собственных чисел решают, чаша это, седло или жёлоб.' });
    ui.select(w.controls, { label: 'Примеры', value: 'rot', options: [{ value: 'bowl', label: 'x₁² + 3x₂² (чаша)' }, { value: 'rot', label: '2x₁² + 2x₁x₂ + 2x₂² (повёрнутая чаша)' }, { value: 'saddle', label: 'x₁² + 4x₁x₂ + x₂² (седло)' }, { value: 'trough', label: '(x₁ + x₂)² (жёлоб)' }, { value: 'neg', label: '−x₁² − 2x₂² (купол)' }], onChange: (k) => {
      [s.a, s.b, s.c] = PRE[k];
      ctl.forEach((c, i) => c.set([s.a, s.b, s.c][i]));
      draw();
    } });
    const ctl = ['a', 'b', 'c'].map((k) => ui.slider(w.controls, { label: k, min: -3, max: 3, step: 0.1, value: s[k], format: f1, onInput: (v) => ((s[k] = v), draw()) }));
    const plot = new GBC.Plot(eqBox(w.main, 520), { height: 360, equal: true, x: { label: 'x₁', domain: [-2, 2] }, y: { label: 'x₂', domain: [-2, 2] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'l', label: 'λ₁, λ₂' }, { key: 'd', label: 'det = ac − b²' }, { key: 't', label: 'тип' }]);
    function draw() {
      const { a, b, c } = s;
      const f = (x, y) => a * x * x + 2 * b * x * y + c * y * y;
      const grid = GBC.Plot.grid(f, -2.2, 2.2, -2.2, 2.2, 101, 101);
      const ev = symEig([[a, b], [b, c]]);
      const levels = [0.25, 0.5, 1, 2, 3, 4.5];
      const L = [];
      levels.forEach((lv) => {
        L.push({ type: 'contour', grid, level: lv, color: 'model', width: lv === 1 ? 2 : 1.1 });
        L.push({ type: 'contour', grid, level: -lv, color: 'tree', width: lv === 1 ? 2 : 1.1 });
      });
      L.push({ type: 'contour', grid, level: 0, color: 'muted', width: 1.2, dash: '4 4' });
      ev.values.forEach((lam, i) => {
        const v = ev.vectors[i];
        if (Math.abs(lam) < 1e-6) {
          L.push({ type: 'line', x: [-3 * v[0], 3 * v[0]], y: [-3 * v[1], 3 * v[1]], color: 'violet', width: 3, opacity: 0.35, hover: false });
          return;
        }
        const r = 1 / Math.sqrt(Math.abs(lam));
        L.push({ type: 'arrows', x1: [0], y1: [0], x2: [r * v[0]], y2: [r * v[1]], color: 'violet', width: 2.6 });
        L.push({ type: 'text', items: [{ x: r * v[0], y: r * v[1], dx: 6, dy: -6, text: 'λ = ' + f2(lam), color: 'violet' }] });
      });
      plot.render(L);
      const [l1, l2] = ev.values;
      const tol = 1e-9;
      const type = l1 > tol && l2 > tol ? 'положительно определённая: чаша' : l1 < -tol && l2 < -tol ? 'отрицательно определённая: купол' : (l1 > tol && l2 < -tol) ? 'неопределённая: седло' : Math.abs(l1) <= tol && Math.abs(l2) <= tol ? 'нулевая' : 'полуопределённая: жёлоб';
      st.set('l', f3(l1) + ', ' + f3(l2));
      st.set('d', f3(a * c - b * b));
      st.set('t', type);
      note.innerHTML = 'Собственные числа ' + f3(l1) + ' и ' + f3(l2) + ' → форма <b>' + type + '</b>. ' +
        (l1 > tol && l2 > tol ? 'Линии уровня — эллипсы с осями вдоль собственных векторов; критерий Сильвестра: a = ' + f1(a) + ' > 0 и det = ' + f2(a * c - b * b) + ' > 0. Полуоси эллипса f = 1 — 1/√λ: ' + f3(1 / Math.sqrt(l1)) + ' и ' + f3(1 / Math.sqrt(l2)) + '.' :
          l1 > tol && l2 < -tol ? 'Вдоль одного собственного вектора форма растёт, вдоль другого — убывает; нулевые линии — асимптоты гипербол. Так выглядит гессиан в седловой точке.' :
            Math.abs(l2) <= tol || Math.abs(l1) <= tol ? 'Вдоль собственного вектора с λ = 0 (бледная прямая) форма постоянна — целая прямая минимумов. Так выглядит XᵀX при зависимых признаках.' : '');
    }
    w.pythonAction(() => PY_NP + 'A = np.array([[' + py(s.a) + ', ' + py(s.b) + '], [' + py(s.b) + ', ' + py(s.c) + ']])\nvals, vecs = np.linalg.eigh(A)          # для симметричных — eigh\nprint("собственные числа:", vals)\nprint("собственные векторы (столбцы):\\n", vecs)\nprint("ортогональны:", np.allclose(vecs.T @ vecs, np.eye(2)))\nprint("A = QΛQᵀ:", np.allclose(vecs @ np.diag(vals) @ vecs.T, A))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 25. Обусловленность и градиентный спуск
   * ============================================================================== */
  GBC.widget('gd-scaling', (el) => {
    const s = { mode: 'raw', frac: 0.5 };
    const MODES = {
      raw: { label: 'сырая площадь x', f: (x) => x, dom: [-2.5, 4.5, -0.8, 3.2], py: 'x' },
      cen: { label: 'центрированная x − 3.5', f: (x) => x - 3.5, dom: [-1, 8, -1.2, 3.2], py: 'x - 3.5' },
      std: { label: 'стандартизованная (x − 3.5)/1.708', f: (x) => (x - 3.5) / Math.sqrt(17.5 / 6), dom: [-1, 8, -1.5, 4.5], py: '(x - 3.5) / x.std()' },
    };
    const w = ui.shell(el, { title: 'Градиентный спуск по МНК: чаша вытянута или круглая', sub: 'Линии уровня суммы квадратов в координатах (сдвиг, наклон) и путь спуска из (0, 0). Темп задан долей от границы устойчивости 2/λmax. Смените представление признака: центрирование и стандартизация делают чашу круглой, и спуск идёт прямо к минимуму.' });
    ui.segmented(w.controls, { label: 'Признак', value: s.mode, options: Object.entries(MODES).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.mode = v), draw()) });
    const sf = ui.slider(w.controls, { label: 'Темп η, доля от 2/λmax', min: 0.05, max: 1.05, step: 0.01, value: s.frac, format: f2, onInput: (v) => ((s.frac = v), draw()) });
    ui.button(w.controls, { label: 'Лучший темп', title: 'η = 2/(λmin + λmax)', kind: 'primary', onClick: () => {
      const { lmin, lmax } = info();
      s.frac = lmax / (lmin + lmax);
      sf.set(s.frac);
      draw();
    } });
    const plot = new GBC.Plot(eqBox(w.main, 640), { height: 330, equal: true, x: { label: 'сдвиг' }, y: { label: 'наклон' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'l', label: 'собств. числа H = 2XᵀX' }, { key: 'k', label: 'κ' }, { key: 'eta', label: 'η' }, { key: 'n', label: 'шагов до точности 10⁻⁶' }]);
    function info() {
      const M = MODES[s.mode];
      const X = FX.map((x) => [1, M.f(x)]);
      const Hm = XtX(X).map((r) => r.map((v) => 2 * v));
      const ev = symEig(Hm).values;
      return { X, Hm, lmax: ev[0], lmin: ev[1] };
    }
    function draw() {
      const M = MODES[s.mode];
      const { X, lmax, lmin } = info();
      const eta = (s.frac * 2) / lmax;
      const wst = solve(XtX(X), Xty(X, FY));
      const tol = 1e-6 * Math.max(1, norm(wst));
      let wv = [0, 0];
      const path = [wv];
      let steps = null;
      for (let k = 1; k <= 20000; k++) {
        const r = FY.map((v, i) => v - dot(X[i], wv));
        const g = Xty(X, r).map((v) => -2 * v);
        wv = vsub(wv, vscale(g, eta));
        if (k <= 400) path.push(wv);
        if (!Number.isFinite(wv[0]) || norm(wv) > 1e6) break;
        if (norm(vsub(wv, wst)) < tol) {
          steps = k;
          break;
        }
      }
      const [x0, x1, y0, y1] = M.dom;
      const SSE = (b, k) => U.sum(FX.map((x, i) => (FY[i] - b - k * M.f(x)) ** 2));
      const grid = GBC.Plot.grid(SSE, x0, x1, y0, y1, 90, 70);
      const fmin = SSE(wst[0], wst[1]);
      const lev = [1.5, 3, 6, 12, 25, 50, 100, 200].map((d) => fmin + d);
      const clip = path.filter((p) => p[0] >= x0 - 1 && p[0] <= x1 + 1 && p[1] >= y0 - 1 && p[1] <= y1 + 1);
      plot.render([
        ...lev.map((lv) => ({ type: 'contour', grid, level: lv, color: 'muted', width: 1 })),
        { type: 'line', x: clip.map((p) => p[0]), y: clip.map((p) => p[1]), color: 'tree', width: 1.8, hover: false },
        { type: 'points', x: clip.slice(0, 60).map((p) => p[0]), y: clip.slice(0, 60).map((p) => p[1]), color: 'tree', r: 2.6 },
        { type: 'points', x: [wst[0]], y: [wst[1]], color: 'good', r: 6.5 },
        { type: 'points', x: [0], y: [0], color: 'ink', r: 5, shape: 'square' },
      ], { x: [x0, x1], y: [y0, y1] });
      st.set('l', f3(lmax) + ', ' + f3(lmin));
      st.set('k', f3(lmax / lmin));
      st.set('eta', U.fmt(eta, 4));
      st.set('n', steps === null ? (s.frac >= 1 ? 'расходится' : '> 20 000') : String(steps));
      note.innerHTML = (s.frac >= 1 ? '<b>η ≥ 2/λmax:</b> вдоль крутого направления множитель |1 − ηλmax| ≥ 1 — спуск раскачивается и расходится. ' : '') +
        { raw: 'Сырая площадь: κ ≈ 87.6 — длинный овраг. Спуск быстро падает на дно и потом долго ползёт вдоль него: сдвиг и наклон «мешают» друг другу (столбцы 1 и x почти параллельны).', cen: 'Центрирование сделало столбцы ортогональными: XᵀX = diag(6, 17.5), оси чаши — координатные, κ ≈ 2.92.', std: 'Стандартизация: XᵀX = 6I, κ = 1 — чаша круглая, антиградиент указывает прямо в минимум; с лучшим темпом хватает одного шага.' }[s.mode] +
        (steps ? ' Сейчас: ' + steps + ' ' + plural(steps, 'шаг', 'шага', 'шагов') + '.' : '');
    }
    w.pythonAction(() => PY_FLATS + 'f = ' + MODES[s.mode].py + '\nX = np.c_[np.ones(6), f]\nH = 2 * X.T @ X\nlam = np.linalg.eigvalsh(H)\nprint("собственные числа H:", lam, " κ =", lam.max() / lam.min())\nw_star = np.linalg.solve(X.T @ X, X.T @ y)\neta = ' + py(s.frac) + ' * 2 / lam.max()\nw = np.zeros(2)\nfor k in range(1, 20001):\n    w = w - eta * (-2 * X.T @ (y - X @ w))\n    if np.linalg.norm(w - w_star) < 1e-6 * max(1, np.linalg.norm(w_star)):\n        print("шагов:", k)\n        break\nelse:\n    print("не сошлось за 20000 шагов")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 26. SVD: поворот — растяжение — поворот
   * ============================================================================== */
  GBC.widget('svd', (el) => {
    const s = { m: [[3, 0], [4, 5]], stage: 3 };
    const w = ui.shell(el, { title: 'SVD: любая матрица — поворот, растяжение, поворот', sub: 'Единичная окружность и два особых вектора v₁, v₂ (правые сингулярные векторы). Этапы: Vᵀ поворачивает их на оси; Σ растягивает оси в σ₁ и σ₂ раз; U поворачивает результат. Итог совпадает с действием A: окружность → эллипс с полуосями σ₁, σ₂.' });
    ui.select(w.controls, { label: 'Матрица', value: 'tri', options: [{ value: 'tri', label: '[[3, 0], [4, 5]]' }, { value: 'sym', label: '[[2, 1], [1, 2]]' }, { value: 'shear', label: 'сдвиг [[1, 1], [0, 1]]' }, { value: 'rank1', label: '[[1, 1], [1, 1]] (ранг 1)' }, { value: 'refl', label: 'diag(−3, 1)' }], onChange: (k) => {
      s.m = { tri: [[3, 0], [4, 5]], sym: [[2, 1], [1, 2]], shear: [[1, 1], [0, 1]], rank1: [[1, 1], [1, 1]], refl: [[-3, 0], [0, 1]] }[k].map((r) => r.slice());
      draw();
    } });
    ui.player(w.controls, { label: 'Этап', min: 0, max: 3, value: 3, fps: 0.8, format: (v) => ['исходная окружность', 'после Vᵀ', 'после ΣVᵀ', 'после UΣVᵀ = A'][v], onChange: (v) => ((s.stage = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main, 560), { height: 360, equal: true, x: { label: 'x', domain: [-7.5, 7.5] }, y: { label: 'y', domain: [-7, 7] } });
    const mt = H('div', { style: 'margin-top:4px;overflow-x:auto;overflow-y:hidden' });
    w.main.appendChild(mt);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 's', label: 'σ₁, σ₂' }, { key: 'k', label: 'κ = σ₁/σ₂' }, { key: 'd', label: '|det| = σ₁σ₂' }, { key: 'v', label: 'v₁, v₂' }]);
    function draw() {
      const A = s.m;
      const S = svd(A);
      const v1 = S.v[0];
      const v2 = S.v[1];
      let u1 = S.u[0];
      let u2 = S.u[1];
      // при σ₂ = 0 второй левый вектор восполняем перпендикуляром
      if (norm(u2) < 1e-9) u2 = [-u1[1], u1[0]];
      if (norm(u1) < 1e-9) u1 = [1, 0];
      const Vt = [v1, v2];
      const Sg = [[S.s[0], 0], [0, S.s[1]]];
      const Um = [[u1[0], u2[0]], [u1[1], u2[1]]];
      const T = [eye(2), Vt, matMul(Sg, Vt), matMul(Um, matMul(Sg, Vt))][s.stage];
      const circ = U.linspace(0, 2 * Math.PI, 200).map((t) => matVec(T, [Math.cos(t), Math.sin(t)]));
      const a1 = matVec(T, v1);
      const a2 = matVec(T, v2);
      const flag = [[0.35, 0], [0.75, 0.25], [0.35, 0.5]].map((p) => matVec(T, p));
      plot.render([
        { type: 'line', x: U.linspace(0, 2 * Math.PI, 120).map(Math.cos), y: U.linspace(0, 2 * Math.PI, 120).map(Math.sin), color: 'muted', width: 1, dash: '3 4', hover: false },
        polyLayer(circ, 'model', 0.1, { stroke: 'model', width: 2.2 }),
        polyLayer(flag, 'ink', 0.5),
        { type: 'arrows', x1: [0], y1: [0], x2: [a1[0]], y2: [a1[1]], color: 'tree', width: 2.8 },
        { type: 'arrows', x1: [0], y1: [0], x2: [a2[0]], y2: [a2[1]], color: 'violet', width: 2.8 },
        { type: 'text', items: [{ x: a1[0], y: a1[1], dx: 6, dy: -6, text: ['v₁', 'e₁', 'σ₁e₁', 'σ₁u₁'][s.stage], bold: true, color: 'tree' }, { x: a2[0], y: a2[1], dx: 6, dy: -6, text: ['v₂', 'e₂', 'σ₂e₂', 'σ₂u₂'][s.stage], bold: true, color: 'violet' }] },
      ]);
      texInto(mt, texMat(A, 3) + ' = ' + texMat(Um, 3) + texMat(Sg, 3) + texMat(Vt, 3), true);
      st.set('s', f3(S.s[0]) + ', ' + f3(S.s[1]));
      st.set('k', S.s[1] > 1e-9 ? f3(S.s[0] / S.s[1]) : '∞');
      st.set('d', f3(S.s[0] * S.s[1]));
      st.set('v', fv(v1, 3) + ', ' + fv(v2, 3));
      note.innerHTML = [
        'Окружность единичных векторов; оранжевый v₁ и фиолетовый v₂ — правые сингулярные векторы: именно их A растянет сильнее и слабее всего. Флажок показывает, сохраняется ли ориентация.',
        'Vᵀ — поворот (или отражение): v₁, v₂ легли на оси координат. Окружность при этом не изменилась.',
        'Σ растянула ось x в σ₁ = ' + f3(S.s[0]) + ' раз, ось y — в σ₂ = ' + f3(S.s[1]) + ' раз: окружность стала эллипсом с осями вдоль координат.' + (S.s[1] < 1e-9 ? ' <b>σ₂ = 0:</b> эллипс сплющен в отрезок — ранг 1.' : ''),
        'U повернул эллипс на место: это ровно образ окружности под действием A. Полуоси σ₁, σ₂ — сингулярные числа; κ = ' + (S.s[1] > 1e-9 ? f3(S.s[0] / S.s[1]) : '∞') + '. Сингулярные числа — корни собственных чисел AᵀA.',
      ][s.stage];
    }
    w.pythonAction(() => PY_NP + 'A = np.array(' + JSON.stringify(s.m) + ', dtype=float)\nU, s, Vt = np.linalg.svd(A)\nprint("σ =", s, " κ =", s[0] / s[-1] if s[-1] > 0 else np.inf)\nprint("U =\\n", U, "\\nVᵀ =\\n", Vt)\nprint("UΣVᵀ = A:", np.allclose(U @ np.diag(s) @ Vt, A))\nprint("σ² = собственные числа AᵀA:", np.linalg.eigvalsh(A.T @ A)[::-1])\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 27. Малоранговое приближение
   * ============================================================================== */
  const IMG_N = 40;
  const IMG = (() => {
    const M = [];
    for (let i = 0; i < IMG_N; i++) {
      const row = [];
      for (let j = 0; j < IMG_N; j++) {
        let v = 0.12 + (0.22 * j) / (IMG_N - 1);
        if (i >= 5 && i <= 13 && j >= 4 && j <= 21) v += 0.55;
        if (Math.abs(Math.hypot(i - 27, j - 27) - 8) <= 1.6) v += 0.6;
        if (i >= 3 && i <= 36 && Math.abs(i - (IMG_N - 1 - j)) <= 1.2 && j <= 22) v += 0.6;
        row.push(Math.min(v, 1));
      }
      M.push(row);
    }
    return M;
  })();
  let IMG_SVD = null;
  GBC.widget('low-rank', (el) => {
    const s = { k: 5 };
    if (!IMG_SVD) IMG_SVD = svd(IMG);
    const S = IMG_SVD;
    const w = ui.shell(el, { title: 'Малоранговое приближение картинки', sub: 'Картинка 40 × 40 — матрица чисел от 0 до 1. Справа — сумма первых k слагаемых σᵢuᵢvᵢᵀ её сингулярного разложения. Прямоугольник и градиент фона восстанавливаются почти сразу, кольцо и диагональ — медленно. Внизу — сингулярные числа.' });
    ui.slider(w.controls, { label: 'Ранг k', min: 1, max: 25, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const grid = cardGrid(220);
    const c1 = card('Исходная (ранг ' + S.s.filter((x) => x > 1e-9 * S.s[0]).length + ')');
    const c2 = card('Приближение ранга k');
    grid.append(c1.el, c2.el);
    w.main.appendChild(grid);
    const opt = { height: 230, equal: true, x: { label: '', domain: [0, IMG_N - 1], ticks: [] }, y: { label: '', domain: [0, IMG_N - 1], ticks: [] }, grid: 'none' };
    const p1 = new GBC.Plot(c1.body, opt);
    const p2 = new GBC.Plot(c2.body, JSON.parse(JSON.stringify(opt)));
    const p3 = new GBC.Plot(w.main, { height: 180, x: { label: 'номер i', domain: [0.5, 25.5] }, y: { label: 'σᵢ', type: 'log', domain: [0.01, 30], ticks: decades(-2, 1), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'хранится чисел' }, { key: 'sh', label: 'доля от 1600' }, { key: 'e', label: 'относительная ошибка' }]);
    const toGrid = (M) => {
      const values = new Float64Array(IMG_N * IMG_N);
      for (let i = 0; i < IMG_N; i++) for (let j = 0; j < IMG_N; j++) values[(IMG_N - 1 - i) * IMG_N + j] = M[i][j];
      return { x0: 0, x1: IMG_N - 1, y0: 0, y1: IMG_N - 1, nx: IMG_N, ny: IMG_N, values };
    };
    const g1 = toGrid(IMG);
    function draw() {
      const k = s.k;
      const A = IMG.map((_, i) => IMG[0].map((__, j) => {
        let v = 0;
        for (let t = 0; t < k; t++) v += S.s[t] * S.u[t][i] * S.v[t][j];
        return v;
      }));
      const bg = GBC.colors.rgb('surface');
      const fg = GBC.colors.rgb('ink');
      const cf = (v) => {
        const t = U.clamp(v, 0, 1);
        return [bg[0] + (fg[0] - bg[0]) * t, bg[1] + (fg[1] - bg[1]) * t, bg[2] + (fg[2] - bg[2]) * t, 255];
      };
      p1.render([{ type: 'heatmap', grid: g1, colorFn: cf, smooth: false }]);
      p2.render([{ type: 'heatmap', grid: toGrid(A), colorFn: cf, smooth: false }]);
      const idx = U.range(25).map((i) => i + 1);
      p3.render([
        { type: 'bars', x: idx, y: idx.map((i) => Math.max(S.s[i - 1], 0.011)), base: 0.01, color: (i) => (i < k ? 'model' : 'muted'), width: 0.7, label: 'σᵢ', legendColor: 'model' },
      ]);
      let err = 0;
      let tot = 0;
      S.s.forEach((sv, i) => {
        tot += sv * sv;
        if (i >= k) err += sv * sv;
      });
      const nums = k * (2 * IMG_N + 1);
      st.set('n', String(nums));
      st.set('sh', Math.round((100 * nums) / (IMG_N * IMG_N)) + ' %');
      st.set('e', f1((100 * Math.sqrt(err)) / Math.sqrt(tot)) + ' %');
      note.innerHTML = 'Ранг ' + k + ': ' + nums + ' чисел вместо 1600, относительная ошибка ' + f1((100 * Math.sqrt(err)) / Math.sqrt(tot)) + ' % = √(σ²ₖ₊₁ + …)/√(σ²₁ + …) (теорема Эккарта — Янга). ' +
        (k === 1 ? 'Одно слагаемое — «таблица умножения» uvᵀ: только общая яркость строк и столбцов.' : k < 5 ? 'Горизонтальные и вертикальные детали уже на месте, диагональ размыта «крестом».' : k < 15 ? 'Кольцо проступает, диагональ ещё шумит.' : 'Почти точная копия; при k ≥ 23 — точная.') +
        ' Осевые структуры — малого ранга, косые — большого: как и деревьям, SVD «удобнее» вдоль осей.';
    }
    onTheme(draw);
    w.pythonAction(() => PY_NP + 'N = 40\nimg = np.zeros((N, N))\nfor i in range(N):\n    for j in range(N):\n        v = 0.12 + 0.22 * j / (N - 1)\n        if 5 <= i <= 13 and 4 <= j <= 21:\n            v += 0.55\n        if abs(np.hypot(i - 27, j - 27) - 8) <= 1.6:\n            v += 0.6\n        if 3 <= i <= 36 and abs(i - (N - 1 - j)) <= 1.2 and j <= 22:\n            v += 0.6\n        img[i, j] = min(v, 1.0)\n\nU, s, Vt = np.linalg.svd(img)\nk = ' + s.k + '\napprox = (U[:, :k] * s[:k]) @ Vt[:k]\nprint("ранг картинки:", np.linalg.matrix_rank(img))\nprint("первые σ:", s[:6].round(3))\nprint(f"ранг {k}: ошибка {np.linalg.norm(img - approx) / np.linalg.norm(img):.4f}, чисел {k * (2 * N + 1)} из {N * N}")\n\nimport matplotlib.pyplot as plt\nfig, ax = plt.subplots(1, 2, figsize=(7, 3.5))\nax[0].imshow(img, cmap="gray_r", vmin=0, vmax=1); ax[0].set_title("исходная")\nax[1].imshow(approx, cmap="gray_r", vmin=0, vmax=1); ax[1].set_title(f"ранг {k}")\nplt.show()\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 28. Ковариация и PCA
   * ============================================================================== */
  GBC.widget('pca', (el) => {
    const s = { data: 'cloud', ang: 35, ratio: 0.35, proj: true, ols: false };
    const N = 80;
    const Z = (() => {
      const rng = new GBC.RNG(12);
      return U.range(N).map(() => [rng.normal(), rng.normal()]);
    })();
    const w = ui.shell(el, { title: 'Главные компоненты: направления наибольшего разброса', sub: 'Облако точек; фиолетовые стрелки — собственные векторы ковариационной матрицы (длина 2√λ). Серые отрезки — проекции точек на первую компоненту: PCA минимизирует их сумму квадратов. Пунктир — МНК-прямая y по x, которая минимизирует вертикальные отрезки.' });
    ui.segmented(w.controls, { label: 'Данные', value: s.data, options: [{ value: 'cloud', label: 'облако' }, { value: 'flats', label: 'шесть квартир' }], onChange: (v) => ((s.data = v), draw()) });
    ui.slider(w.controls, { label: 'Направление облака', min: 0, max: 175, step: 5, value: s.ang, format: (v) => v + '°', onInput: (v) => ((s.ang = v), draw()) });
    ui.slider(w.controls, { label: 'Толщина облака σ₂/σ₁', min: 0.05, max: 1, step: 0.05, value: s.ratio, format: f2, onInput: (v) => ((s.ratio = v), draw()) });
    ui.toggle(w.controls, { label: 'Проекции на 1-ю компоненту', checked: s.proj, onChange: (v) => ((s.proj = v), draw()) });
    ui.toggle(w.controls, { label: 'МНК-прямая y по x', checked: s.ols, onChange: (v) => ((s.ols = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main, 560), { height: 360, equal: true, x: { label: 'x₁' }, y: { label: 'x₂' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'ковариационная матрица' }, { key: 'l', label: 'λ₁, λ₂' }, { key: 'sh', label: 'доля 1-й компоненты' }, { key: 'r', label: 'корреляция' }, { key: 'sl', label: 'наклон PC1 / МНК' }]);
    function pts() {
      if (s.data === 'flats') return FX.map((x, i) => [x, FY[i]]);
      const t = (s.ang * Math.PI) / 180;
      const c = Math.cos(t);
      const sn = Math.sin(t);
      return Z.map(([a, b]) => {
        const u = 1.5 * a;
        const v = 1.5 * s.ratio * b;
        return [c * u - sn * v, sn * u + c * v];
      });
    }
    function draw() {
      const P = pts();
      const n = P.length;
      const mx = U.mean(P.map((p) => p[0]));
      const my = U.mean(P.map((p) => p[1]));
      const Cx = P.map((p) => [p[0] - mx, p[1] - my]);
      const C = XtX(Cx).map((r) => r.map((v) => v / (n - 1)));
      const ev = symEig(C);
      const [l1, l2] = ev.values;
      let v1 = ev.vectors[0];
      if (v1[0] < 0) v1 = vscale(v1, -1);
      const v2 = [-v1[1], v1[0]];
      const L = [];
      if (s.proj) {
        const seg = { x1: [], y1: [], x2: [], y2: [] };
        Cx.forEach((d, i) => {
          const t = dot(d, v1);
          seg.x1.push(P[i][0]);
          seg.y1.push(P[i][1]);
          seg.x2.push(mx + t * v1[0]);
          seg.y2.push(my + t * v1[1]);
        });
        L.push({ type: 'segments', ...seg, color: 'residual', width: 1, opacity: 0.7 });
      }
      L.push({ type: 'line', x: [mx - 12 * v1[0], mx + 12 * v1[0]], y: [my - 12 * v1[1], my + 12 * v1[1]], color: 'violet', width: 1.2, opacity: 0.45, hover: false });
      const kOls = C[0][1] / C[0][0];
      if (s.ols) L.push({ type: 'line', x: [mx - 12, mx + 12], y: [my - 12 * kOls, my + 12 * kOls], color: 'tree', width: 2, dash: '6 4', label: 'МНК: y по x', hover: false });
      const r1 = 2 * Math.sqrt(l1);
      const r2 = 2 * Math.sqrt(Math.max(l2, 0));
      const dom = s.data === 'flats' ? { x: [-1, 8], y: [0, 13] } : { x: [-4.5, 4.5], y: [-4, 4] };
      plot.render([
        ...L,
        { type: 'points', x: P.map((p) => p[0]), y: P.map((p) => p[1]), color: 'data', r: s.data === 'flats' ? 5.5 : 3.6, label: s.data === 'flats' ? 'квартиры (площадь, цена)' : 'точки' },
        { type: 'arrows', x1: [mx, mx], y1: [my, my], x2: [mx + r1 * v1[0], mx + r2 * v2[0]], y2: [my + r1 * v1[1], my + r2 * v2[1]], color: 'violet', width: 2.8 },
        { type: 'text', items: [{ x: mx + r1 * v1[0], y: my + r1 * v1[1], dx: 6, dy: -6, text: 'PC1', bold: true, color: 'violet' }, { x: mx + r2 * v2[0], y: my + r2 * v2[1], dx: 6, dy: -6, text: 'PC2', color: 'violet' }] },
      ], dom);
      const rho = C[0][1] / Math.sqrt(C[0][0] * C[1][1]);
      st.set('c', fm(C, 3));
      st.set('l', f3(l1) + ', ' + f3(l2));
      st.set('sh', f1((100 * l1) / (l1 + l2)) + ' %');
      st.set('r', f3(rho));
      st.set('sl', f3(v1[1] / v1[0]) + ' / ' + f3(kOls));
      note.innerHTML = 'Первая компонента объясняет ' + f1((100 * l1) / (l1 + l2)) + ' % дисперсии. Корреляция ' + f3(rho) + ' — косинус угла между центрированными столбцами. ' +
        (s.data === 'flats' ? 'Для квартир наклон PC1 — 1.963, а МНК — 1.829: PCA считает обе координаты равноправными, МНК объясняет только цену.' :
          s.ratio > 0.85 ? 'Облако почти круглое — направление PC1 плохо определено (λ₁ ≈ λ₂), его «носит» от выборки к выборке.' : 'Задано направление ' + s.ang + '°; найденная PC1 смотрит на ' + f1(((Math.atan2(v1[1], v1[0]) * 180) / Math.PI + 180) % 180) + '°.') +
        (s.ols ? ' МНК-прямая положе PC1: она минимизирует вертикальные отрезки, а не перпендикуляры.' : '');
    }
    w.pythonAction(() => (s.data === 'flats' ? PY_FLATS + 'P = np.c_[x, y]\n' : PY_NP + 'from gbcourse.rng import Mulberry32\n\nrng = Mulberry32(12)\nZ = np.array([[rng.normal(), rng.normal()] for _ in range(80)])\nt = np.radians(' + s.ang + ')\nRot = np.array([[np.cos(t), -np.sin(t)], [np.sin(t), np.cos(t)]])\nP = (Z * [1.5, 1.5 * ' + py(s.ratio) + ']) @ Rot.T\n') +
      'Pc = P - P.mean(axis=0)\nC = Pc.T @ Pc / (len(P) - 1)            # = np.cov(P.T)\nlam, V = np.linalg.eigh(C)\nprint("ковариация:\\n", C.round(4))\nprint("доля PC1:", lam[-1] / lam.sum(), " направление:", V[:, -1])\nprint("корреляция:", np.corrcoef(P.T)[0, 1])\n_, s, Vt = np.linalg.svd(Pc, full_matrices=False)\nprint("то же через SVD:", Vt[0], " λ =", s**2 / (len(P) - 1))\n');
    draw();
  });

  /* ==============================================================================
   * Шаги 29–30. Дерево — проекция; выигрыш разбиения
   * ============================================================================== */
  const THR = [1.5, 2.5, 3.5, 4.5, 5.5];
  /** Листья по набору порогов: массив групп индексов. */
  function leavesOf(cuts) {
    const cs = cuts.slice().sort((a, b) => a - b);
    const edges = [-Infinity, ...cs, Infinity];
    const out = [];
    for (let k = 0; k + 1 < edges.length; k++) out.push(FX.map((x, i) => (x > edges[k] && x <= edges[k + 1] ? i : -1)).filter((i) => i >= 0));
    return out.filter((g) => g.length);
  }
  GBC.widget('tree-projection', (el) => {
    const s = { cuts: [3.5] };
    const r0 = FY.map((v) => v - 6);
    const w = ui.shell(el, { title: 'Дерево — проекция антиградиента на ступеньки листьев', sub: 'Вектор остатков r = y − 6 = (−4, −2, −3, 1, 3, 5) — антиградиент квадратичных потерь. Отметьте пороги: они задают листья. Таблица — индикаторы листьев ℓⱼ (столбцы матрицы L) и нормальные уравнения; синяя ступенька — проекция h = Lθ, оранжевые столбики — остаток r − h.' });
    THR.forEach((t) => ui.toggle(w.controls, { label: 'порог ' + f1(t), checked: s.cuts.includes(t), onChange: (v) => {
      s.cuts = v ? s.cuts.concat([t]) : s.cuts.filter((c) => c !== t);
      draw();
    } }));
    const plot = new GBC.Plot(w.main, { height: 260, x: { label: 'квартира (площадь)', domain: [0.4, 6.6] }, y: { label: 'значение', domain: [-5.5, 6] } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'leaf', label: 'листья θⱼ = Gⱼ/nⱼ' }, { key: 'a', label: '‖r‖²' }, { key: 'h', label: '‖h‖²' }, { key: 'b', label: '‖r − h‖²' }]);
    function draw() {
      const groups = leavesOf(s.cuts);
      const theta = groups.map((g) => U.mean(g.map((i) => r0[i])));
      const h = FX.map((_, i) => theta[groups.findIndex((g) => g.includes(i))]);
      const res = r0.map((v, i) => v - h[i]);
      const cs = s.cuts.slice().sort((a, b) => a - b);
      const edges = [0.4, ...cs, 6.6];
      plot.render([
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'bars', x: FX.map((v) => v - 0.17), y: r0, color: 'muted', width: 0.32, label: 'r — антиградиент' },
        { type: 'bars', x: FX.map((v) => v + 0.17), y: res, color: 'tree', width: 0.32, label: 'r − h — что осталось' },
        { type: 'steps', segments: theta.map((t, k) => ({ x0: edges[k], x1: edges[k + 1], value: t })), color: 'model', width: 2.6, label: 'дерево h' },
        ...cs.map((c) => ({ type: 'vline', x: c, color: 'ink2', dash: '4 4', width: 1 })),
      ]);
      const cols = ['i', ...groups.map((_, k) => 'ℓ' + ['₁', '₂', '₃', '₄', '₅', '₆'][k]), 'rᵢ', 'hᵢ', 'rᵢ − hᵢ'];
      const rows = FX.map((_, i) => [String(i + 1), ...groups.map((g) => (g.includes(i) ? '1' : '0')), U.fmt(r0[i], 3), U.fmt(h[i], 3), U.fmt(res[i], 3)]);
      rows.push(['nⱼ = ℓⱼ·ℓⱼ', ...groups.map((g) => String(g.length)), '', '', '']);
      rows.push(['Gⱼ = ℓⱼ·r', ...groups.map((g) => U.fmt(U.sum(g.map((i) => r0[i])), 3)), '', '', '']);
      rows.push(['θⱼ = Gⱼ/nⱼ', ...theta.map((t) => U.fmt(t, 3)), '', '', '']);
      rowTable(tbl, cols, rows, (i) => i >= 6);
      const sq = (v) => U.sum(v.map((z) => z * z));
      st.set('leaf', theta.map((t) => f3(t)).join('; '));
      st.set('a', f3(sq(r0)));
      st.set('h', f3(sq(h)));
      st.set('b', f3(sq(res)));
      note.innerHTML = 'Индикаторы разных листьев не пересекаются — они ортогональны, LᵀL = diag(' + groups.map((g) => g.length).join(', ') + '), и нормальные уравнения решаются делением: лист — среднее остатков. Пифагор: ' + f3(sq(r0)) + ' = ' + f3(sq(h)) + ' + ' + f3(sq(res)) + '. ' +
        (groups.length === 1 ? 'Без порогов — один лист, проекция на 1: среднее остатков 0, дерево ничего не делает.' : groups.length === 6 ? 'Каждая квартира в своём листе: h = r, остаток 0 — дерево запомнило выборку.' : 'Суммы остатка r − h внутри каждого листа равны нулю — он ортогонален ступенькам.');
    }
    w.pythonAction(() => PY_FLATS + 'r = y - 6                                   # антиградиент при F₀ = 6\ncuts = ' + JSON.stringify(s.cuts.slice().sort((a, b) => a - b)) + '\nleaf = np.digitize(x, cuts, right=True)      # номер листа каждого объекта\nL = np.eye(len(cuts) + 1)[leaf]              # индикаторы листьев (n × J)\nL = L[:, L.sum(axis=0) > 0]\ntheta = np.linalg.solve(L.T @ L, L.T @ r)    # нормальные уравнения\nh = L @ theta\nprint("LᵀL =", np.diag(L.T @ L), " листья:", theta)\nprint("Пифагор:", r @ r, "=", h @ h, "+", (r - h) @ (r - h))\nprint("(r − h) ⟂ индикаторам:", (L.T @ (r - h)).round(12))\n');
    draw();
  });

  GBC.widget('split-gain', (el) => {
    const s = { which: 'r0', lam: 0 };
    const RV = { r0: FY.map((v) => v - 6), r1: [-1, 1, 0, -2, 0, 2] };
    const w = ui.shell(el, { title: 'Выигрыш разбиения = квадрат длины проекции', sub: 'Для каждого порога — выигрыш Gₗ²/(nₗ + λ) + Gᵣ²/(nᵣ + λ) − G²/(n + λ) (ₗ — левый лист, ᵣ — правый): насколько проекция на два листа длиннее проекции на один. Дерево выбирает самый высокий столбик. λ — штраф XGBoost на значения листьев.' });
    ui.select(w.controls, { label: 'Вектор остатков', value: s.which, options: [{ value: 'r0', label: 'первое дерево: r = y − 6' }, { value: 'r1', label: 'второе дерево (после порога 3.5)' }], onChange: (v) => ((s.which = v), draw()) });
    ui.slider(w.controls, { label: 'λ', min: 0, max: 10, step: 0.5, value: s.lam, format: f1, onInput: (v) => ((s.lam = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'порог', domain: [1, 6] }, y: { label: 'выигрыш' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'b', label: 'лучший порог' }, { key: 'g', label: 'его выигрыш' }, { key: 'p', label: 'G²/(n + λ) родителя' }]);
    function draw() {
      const r = RV[s.which];
      const lam = s.lam;
      const G = U.sum(r);
      const parent = (G * G) / (6 + lam);
      const rows = THR.map((t) => {
        const Lg = FX.map((x, i) => (x <= t ? i : -1)).filter((i) => i >= 0);
        const Rg = FX.map((x, i) => (x > t ? i : -1)).filter((i) => i >= 0);
        const GL = U.sum(Lg.map((i) => r[i]));
        const GR = U.sum(Rg.map((i) => r[i]));
        return { t, GL, GR, nL: Lg.length, nR: Rg.length, gain: (GL * GL) / (Lg.length + lam) + (GR * GR) / (Rg.length + lam) - parent };
      });
      const best = rows.reduce((a, b) => (b.gain > a.gain + 1e-12 ? b : a));
      plot.render([
        { type: 'bars', x: THR, y: rows.map((q) => q.gain), color: (i) => (rows[i] === best ? 'good' : 'model'), width: 0.6, label: 'выигрыш', legendColor: 'model' },
      ], { y: [0, Math.max(1, ...rows.map((q) => q.gain)) * 1.15] });
      rowTable(tbl, ['порог', 'G_L', 'n_L', 'G_R', 'n_R', 'выигрыш'], rows.map((q) => [f1(q.t), f3(q.GL), String(q.nL), f3(q.GR), String(q.nR), f3(q.gain)]), (i) => rows[i] === best);
      st.set('b', f1(best.t));
      st.set('g', f3(best.gain));
      st.set('p', f3(parent));
      note.innerHTML = (s.which === 'r0' ? 'Для первого дерева сумма остатков G = 0, поэтому слагаемое родителя нулевое, а выигрыш — ровно ‖h‖² = Σ Gⱼ²/nⱼ. ' : 'После первого дерева остаток (−1, 1, 0, −2, 0, 2) ортогонален ступенькам порога 3.5 — у этого порога выигрыш ноль: повторять то же разбиение бессмысленно. ') +
        (lam > 0 ? 'λ = ' + f1(lam) + ' уменьшает все выигрыши и сильнее всего — у маленьких листьев: при пороге 1.5 лист из одного объекта.' : 'Подвигайте λ.') + ' В XGBoost перед всей скобкой стоит ½ и вычитается γ.';
    }
    w.pythonAction(() => PY_FLATS + 'r = np.array(' + JSON.stringify(RV[s.which]) + ', dtype=float)\nlam = ' + py(s.lam) + '\nG = r.sum()\nfor t in (1.5, 2.5, 3.5, 4.5, 5.5):\n    L = x <= t\n    gain = r[L].sum() ** 2 / (L.sum() + lam) + r[~L].sum() ** 2 / ((~L).sum() + lam) - G ** 2 / (6 + lam)\n    print(f"порог {t}: выигрыш {gain:.3f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 31. Бустинг — цепочка проекций
   * ============================================================================== */
  function boostStumps(nu, M) {
    let F = FX.map(() => 6);
    const hist = [U.sum(FY.map((v) => (v - 6) ** 2))];
    const cuts = [];
    const models = [F.slice()];
    const proj = [];
    for (let m = 0; m < M; m++) {
      const r = FY.map((v, i) => v - F[i]);
      let best = null;
      for (const t of THR) {
        const Lg = FX.map((x) => x <= t);
        const a = U.mean(r.filter((_, i) => Lg[i]));
        const b = U.mean(r.filter((_, i) => !Lg[i]));
        const h = Lg.map((l) => (l ? a : b));
        const g = U.sum(h.map((v) => v * v));
        if (!best || g > best.g + 1e-12) best = { t, h, g, a, b };
      }
      F = F.map((v, i) => v + nu * best.h[i]);
      cuts.push(best);
      proj.push(best.g);
      hist.push(U.sum(FY.map((v, i) => (v - F[i]) ** 2)));
      models.push(F.slice());
    }
    return { hist, cuts, models, proj };
  }
  GBC.widget('boost-projections', (el) => {
    const s = { nu: 0.5, m: 3 };
    const w = ui.shell(el, { title: 'Бустинг пнями — цепочка проекций', sub: 'Каждый шаг: пень проецирует текущий остаток на ступеньки лучшего порога, прогноз сдвигается на ν·проекцию. Сверху — квартиры и модель Fₘ. Снизу — ‖rₘ‖² по шагам (логарифмическая шкала) для выбранного ν и для ν = 1.' });
    ui.slider(w.controls, { label: 'Темп ν', values: [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.3, 1.6, 1.9, 2.1], value: s.nu, format: String, onInput: (v) => ((s.nu = v), draw()) });
    ui.player(w.controls, { label: 'Деревьев m', min: 0, max: 30, value: s.m, fps: 2, format: (v) => 'm = ' + v, onChange: (v) => ((s.m = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'площадь x', domain: [0.4, 6.6] }, y: { label: 'цена', domain: [-1, 13] } });
    const plot2 = new GBC.Plot(w.main, { height: 200, x: { label: 'деревьев m', domain: [0, 30] }, y: { label: '‖r_m‖²', type: 'log', domain: [1e-4, 1e3], ticks: decades(-4, 3), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: '‖r_m‖²' }, { key: 'c', label: 'пороги по шагам' }, { key: 'd', label: 'падение на шаге m' }]);
    function draw() {
      const B = boostStumps(s.nu, 30);
      const B1 = boostStumps(1, 30);
      const F = B.models[s.m];
      const segs = [];
      // модель кусочно-постоянна между серединами соседних точек
      const ed = [0.4, 1.5, 2.5, 3.5, 4.5, 5.5, 6.6];
      F.forEach((v, i) => segs.push({ x0: ed[i], x1: ed[i + 1], value: v }));
      plot.render([
        { type: 'segments', x1: FX, y1: F, x2: FX, y2: FY, color: 'residual', width: 2, opacity: 0.9 },
        { type: 'steps', segments: segs, color: 'model', width: 2.4, label: 'F_m' },
        { type: 'points', x: FX, y: FY, color: 'data', r: 5, label: 'квартиры' },
      ]);
      const ms = U.range(31);
      plot2.render([
        { type: 'line', x: ms, y: B1.hist.map((v) => Math.max(v, 1e-6)), color: 'muted', width: 1.6, dash: '5 4', label: 'ν = 1' },
        { type: 'line', x: ms, y: B.hist.map((v) => (Number.isFinite(v) ? U.clamp(v, 1e-6, 1e6) : NaN)), color: 'model', width: 2.2, label: 'ν = ' + s.nu },
        { type: 'points', x: [s.m], y: [U.clamp(B.hist[s.m], 1e-6, 1e6)], color: 'tree', r: 5.5 },
      ]);
      st.set('r', sci(B.hist[s.m]));
      st.set('c', B.cuts.slice(0, Math.max(1, Math.min(s.m, 10))).map((c) => f1(c.t)).join(', ') + (s.m > 10 ? ', …' : ''));
      st.set('d', s.m ? sci(B.hist[s.m - 1] - B.hist[s.m]) + ' = (2ν − ν²)·' + sci(B.proj[s.m - 1]) : '—');
      let rep = 0;
      for (let i = 1; i < Math.min(s.m, 30); i++) if (B.cuts[i].t === B.cuts[i - 1].t) rep++;
      note.innerHTML = (s.nu >= 2 ? '<b>ν ≥ 2:</b> множитель 2ν − ν² ≤ 0 — сумма квадратов перестаёт убывать, остаток вдоль ступенек раскачивается.' : s.nu > 1 ? 'При 1 &lt; ν &lt; 2 шаг «перелетает» проекцию, но 2ν − ν² &gt; 0 — сумма квадратов всё равно убывает.' : 'На каждом шаге ‖r‖² падает ровно на (2ν − ν²)·‖P r‖² — Пифагор для проекции.') +
        ' ' + (s.m > 1 ? 'Подряд одинаковых порогов: ' + rep + (s.nu === 1 ? ' — при ν = 1 повтор невозможен: после полной проекции остаток ортогонален ступенькам.' : '. При ν < 1 компонента вдоль ступенек убывает в (1 − ν) раз и тот же порог может победить снова.') : '');
    }
    w.pythonAction(() => PY_FLATS + 'nu, M = ' + py(s.nu) + ', ' + Math.max(1, s.m) + '\nF = np.full(6, y.mean())\nfor m in range(1, M + 1):\n    r = y - F\n    best = None\n    for t in (1.5, 2.5, 3.5, 4.5, 5.5):\n        L = x <= t\n        h = np.where(L, r[L].mean(), r[~L].mean())   # проекция на ступеньки\n        if best is None or h @ h > best[1] @ best[1] + 1e-12:\n            best = (t, h)\n    F = F + nu * best[1]\n    print(f"m = {m}: порог {best[0]}, ‖r‖² = {(y - F) @ (y - F):.5f}")\n\nfrom gbcourse.boosting import GBRegressor\ngb = GBRegressor(n_estimators=M, learning_rate=nu, max_depth=1).fit(x.reshape(-1, 1), y)\nprint("gbcourse:", ((y - gb.predict(x.reshape(-1, 1))) ** 2).sum())\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 32. Лист Ньютона — взвешенная проекция
   * ============================================================================== */
  const LEAF_SETS = {
    first: { label: 'первый шаг: F = 0, метки (1, 1, 1, 0)', F: [0, 0, 0, 0], y: [1, 1, 1, 0] },
    mixed: { label: 'смешанный лист', F: [2, 0.5, -0.5, 1], y: [1, 1, 0, 0] },
    pure: { label: 'чистый лист с уверенными прогнозами', F: [3, 4, 2.5, 3.5], y: [1, 1, 1, 1] },
  };
  const sigm = (z) => 1 / (1 + Math.exp(-z));
  GBC.widget('weighted-leaf', (el) => {
    const s = { key: 'mixed', lam: 0 };
    const w = ui.shell(el, { title: 'Лист Ньютона: взвешенное среднее рабочих ответов', sub: 'Четыре объекта в одном листе, логистические потери. Высота столбика — «рабочий ответ» zᵢ = −gᵢ/hᵢ (шаг Ньютона для объекта в одиночку), ширина — вес hᵢ = pᵢ(1 − pᵢ). Лист XGBoost — взвешенное среднее: w = Σhᵢzᵢ / (Σhᵢ + λ) = −G/(H + λ).' });
    ui.select(w.controls, { label: 'Лист', value: s.key, options: Object.entries(LEAF_SETS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.key = v), draw()) });
    ui.slider(w.controls, { label: 'λ', min: 0, max: 5, step: 0.1, value: s.lam, format: f1, onInput: (v) => ((s.lam = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'объект', domain: [0.4, 4.6], ticks: [1, 2, 3, 4] }, y: { label: 'рабочий ответ z' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'gh', label: 'G, H' }, { key: 'w', label: 'лист −G/(H + λ)' }, { key: 'm', label: 'простое среднее −g' }, { key: 'o', label: 'точный оптимум' }]);
    function exactOpt(F, y) {
      const d = (wv) => U.sum(F.map((f, i) => sigm(f + wv) - y[i]));
      if (d(-30) > 0 || d(30) < 0) return null;
      let lo = -30;
      let hi = 30;
      for (let k = 0; k < 200; k++) {
        const m = (lo + hi) / 2;
        if (d(m) > 0) hi = m;
        else lo = m;
      }
      return (lo + hi) / 2;
    }
    function draw() {
      const S = LEAF_SETS[s.key];
      const p = S.F.map(sigm);
      const g = p.map((v, i) => v - S.y[i]);
      const h = p.map((v) => v * (1 - v));
      const z = g.map((v, i) => -v / h[i]);
      const G = U.sum(g);
      const Hs = U.sum(h);
      const wl = -G / (Hs + s.lam);
      const fo = U.mean(g.map((v) => -v));
      const ex = exactOpt(S.F, S.y);
      const xs = [1, 2, 3, 4];
      plot.render([
        ...xs.map((x, i) => ({ type: 'rect', x0: x - h[i] * 1.6, x1: x + h[i] * 1.6, y0: 0, y1: z[i], fill: S.y[i] ? 'class1' : 'class0', stroke: S.y[i] ? 'class1' : 'class0', opacity: 0.35 })),
        { type: 'points', x: xs, y: z, color: (i) => (S.y[i] ? 'class1' : 'class0'), r: 4.5, label: 'zᵢ: оранжевые — метка 1, синие — 0 (ширина ∝ hᵢ)', legendColor: 'class1', tooltip: (i) => [{ label: 'zᵢ', value: f4(z[i]) }, { label: 'вес hᵢ', value: f4(h[i]) }] },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'hline', y: wl, color: 'model', width: 2.4, label: 'лист −G/(H + λ) = ' + f3(wl) },
        { type: 'hline', y: fo, color: 'muted', width: 1.6, dash: '5 4', label: 'простое среднее −g = ' + f3(fo) },
        ex !== null ? { type: 'hline', y: ex, color: 'good', width: 1.6, dash: '2 3', label: 'точный оптимум = ' + f3(ex) } : null,
      ], { y: yDom(z.concat([wl, fo, ex === null ? 0 : ex, 0]), 0.1) });
      rowTable(tbl, ['i', 'yᵢ', 'Fᵢ', 'pᵢ', 'gᵢ = pᵢ − yᵢ', 'hᵢ', 'zᵢ = −gᵢ/hᵢ'], xs.map((x, i) => [String(x), String(S.y[i]), f2(S.F[i]), f4(p[i]), f4(g[i]), f4(h[i]), f4(z[i])]));
      st.set('gh', f4(G) + ', ' + f4(Hs));
      st.set('w', f4(wl));
      st.set('m', f4(fo));
      st.set('o', ex === null ? 'нет (→ +∞)' : f4(ex));
      note.innerHTML = {
        first: 'Все веса равны (hᵢ = 0.25), и лист — простое среднее рабочих ответов (2 + 2 + 2 − 2)/4 = 1. Точный оптимум ln 3 ≈ 1.099: шаг Ньютона почти попал. ',
        mixed: 'Первый объект уверенно верен (p = 0.88): его рабочий ответ 1.14, но вес мал (h = 0.105). Взвешенное среднее −0.793 близко к точному оптимуму −0.75; простое среднее градиентов (−0.153) — шаг первого порядка — гораздо осторожнее. ',
        pure: 'Все метки — единицы, прогнозы уже уверенные: H = 0.161 крошечный. Без λ шаг Ньютона ≈ 1.06, и точного оптимума нет — потери убывают бесконечно. λ в знаменателе доминирует и не даёт листу «улететь». ',
      }[s.key] + (s.lam > 0 ? 'С λ = ' + f1(s.lam) + ' лист сжат к нулю: H + λ = ' + f3(Hs + s.lam) + ' — это гребневая регрессия.' : '');
    }
    w.pythonAction(() => {
      const S = LEAF_SETS[s.key];
      return PY_NP + 'F = np.array(' + JSON.stringify(S.F) + ', dtype=float)\ny = np.array(' + JSON.stringify(S.y) + ', dtype=float)\nlam = ' + py(s.lam) + '\n\np = 1 / (1 + np.exp(-F))\ng, h = p - y, p * (1 - p)\nz = -g / h                                 # рабочие ответы\nw_leaf = -g.sum() / (h.sum() + lam)\nprint("рабочие ответы:", z.round(4), " веса:", h.round(4))\nprint("лист −G/(H + λ) =", round(w_leaf, 4), " = взвешенное среднее:", round((h * z).sum() / (h.sum() + lam), 4))\n\nfrom scipy.optimize import minimize_scalar\nloss = lambda w: np.sum(np.logaddexp(0, F + w) - y * (F + w))\nprint("точный оптимум (в пределах [−10, 10]):", round(minimize_scalar(loss, bounds=(-10, 10), method="bounded").x, 4))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 33. Ансамбль — линейная модель на индикаторах листьев
   * ============================================================================== */
  GBC.widget('leaf-features', (el) => {
    const s = { nu: 0.5, M: 3, lam: 0 };
    const w = ui.shell(el, { title: 'Ансамбль = линейная модель на индикаторах листьев', sub: 'Бустинг из M пней на шести квартирах. Матрица Φ: каждый пень даёт два столбца-индикатора (левый и правый лист); вес столбца — ν·значение листа. Под матрицей — веса бустинга θ и веса совместной подгонки всех столбцов сразу по МНК (с λ — гребневой).' });
    ui.slider(w.controls, { label: 'Темп ν', values: [0.1, 0.3, 0.5, 0.7, 1], value: s.nu, format: String, onInput: (v) => ((s.nu = v), draw()) });
    ui.slider(w.controls, { label: 'Пней M', min: 1, max: 6, step: 1, value: s.M, format: String, onInput: (v) => ((s.M = v), draw()) });
    ui.slider(w.controls, { label: 'λ при совместной подгонке', min: 0, max: 5, step: 0.1, value: s.lam, format: f1, onInput: (v) => ((s.lam = v), draw()) });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'площадь x', domain: [0.4, 6.6] }, y: { label: 'цена', domain: [-1, 13] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'rk', label: 'столбцов / ранг Φ' }, { key: 'b', label: 'Σ квадратов: бустинг' }, { key: 'f', label: 'совместная подгонка' }, { key: 'reg', label: 'областей' }]);
    function draw() {
      const B = boostStumps(s.nu, s.M);
      const cuts = B.cuts.map((c) => c.t);
      const Phi = FX.map((x) => cuts.flatMap((t) => [x <= t ? 1 : 0, x > t ? 1 : 0]));
      const theta = B.cuts.flatMap((c) => [s.nu * c.a, s.nu * c.b]);
      const Fb = B.models[s.M];
      const target = FY.map((v) => v - 6);
      let th2;
      if (s.lam > 0) {
        const A = XtX(Phi).map((r, i) => r.map((v, j) => v + (i === j ? s.lam : 0)));
        th2 = solve(A, Xty(Phi, target));
      } else th2 = lstsq(Phi, target);
      const Fr = Phi.map((r) => 6 + dot(r, th2));
      const cols = ['i', ...cuts.flatMap((t, k) => ['п' + (k + 1) + ': x ≤ ' + f1(t), 'п' + (k + 1) + ': x > ' + f1(t)]), 'F бустинга', 'F совместно'];
      const rows = FX.map((_, i) => [String(i + 1), ...Phi[i].map(String), f3(Fb[i]), f3(Fr[i])]);
      rows.push(['θ бустинга', ...theta.map((v) => f3(v)), '', '']);
      rows.push(['θ совместно', ...th2.map((v) => f3(v)), '', '']);
      rowTable(tbl, cols, rows, (i) => i >= 6);
      const ed = [0.4, 1.5, 2.5, 3.5, 4.5, 5.5, 6.6];
      plot.render([
        { type: 'steps', segments: Fb.map((v, i) => ({ x0: ed[i], x1: ed[i + 1], value: v })), color: 'model', width: 2.4, label: 'бустинг' },
        { type: 'steps', segments: Fr.map((v, i) => ({ x0: ed[i], x1: ed[i + 1], value: v })), color: 'tree', width: 2.2, dash: '6 4', label: 'совместная подгонка' },
        { type: 'points', x: FX, y: FY, color: 'data', r: 5, label: 'квартиры' },
      ]);
      const sseB = U.sum(FY.map((v, i) => (v - Fb[i]) ** 2));
      const sseR = U.sum(FY.map((v, i) => (v - Fr[i]) ** 2));
      const regions = leavesOf(Array.from(new Set(cuts))).length;
      st.set('rk', Phi[0].length + ' / ' + rank(Phi));
      st.set('b', f3(sseB));
      st.set('f', f3(sseR));
      st.set('reg', String(regions));
      note.innerHTML = 'Пороги бустинга: ' + cuts.map(f1).join(', ') + '. Они делят квартиры на ' + regions + ' ' + plural(regions, 'область', 'области', 'областей') + ', поэтому ранг Φ = ' + rank(Phi) + ' (два индикатора каждого пня в сумме дают 1). ' +
        'Прогноз бустинга — Φ·θ с θ = ν·(значения листьев): линейная модель на признаках, которые построили деревья. Совместная подгонка (проекция y − 6 на столбцы Φ' + (s.lam > 0 ? ' с гребневым штрафом' : ', кратчайшее решение') + ') даёт ' + f3(sseR) + ' против ' + f3(sseB) + ' у бустинга.';
    }
    w.pythonAction(() => PY_FLATS + 'nu, M = ' + py(s.nu) + ', ' + s.M + '\nF = np.full(6, 6.0)\ncuts, theta = [], []\nfor m in range(M):\n    r = y - F\n    best = max(((t, np.where(x <= t, r[x <= t].mean(), r[x > t].mean())) for t in (1.5, 2.5, 3.5, 4.5, 5.5)), key=lambda p: p[1] @ p[1] - 1e-12 * p[0])\n    t, h = best\n    cuts.append(t)\n    theta += [nu * r[x <= t].mean(), nu * r[x > t].mean()]\n    F = F + nu * h\nPhi = np.concatenate([np.c_[x <= t, x > t] for t in cuts], axis=1).astype(float)\nprint("Φ =\\n", Phi.astype(int), "\\nранг Φ:", np.linalg.matrix_rank(Phi))\nprint("бустинг = 6 + Φθ:", np.allclose(F, 6 + Phi @ np.array(theta)), " Σ квадратов:", ((y - F) ** 2).sum())\ntheta_ls = np.linalg.lstsq(Phi, y - 6, rcond=None)[0]   # совместная подгонка\nprint("совместно: Σ квадратов", ((y - 6 - Phi @ theta_ls) ** 2).sum().round(4))\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр
   * ============================================================================== */
  const CATS = { all: 'все разделы', vec: 'векторы', mat: 'матрицы', lsq: 'МНК и проекции', eig: 'собственные числа и SVD', boost: 'бустинг' };
  const QS = [
    { c: 'vec', q: '(1, 2) + 3·(1, −1) =', opts: ['(4, −1)', '(4, 5)', '(2, 1)', '(3, −3)'], a: 0, why: '3·(1, −1) = (3, −3); (1 + 3, 2 − 3) = (4, −1).' },
    { c: 'vec', q: '(2, 3, 1) · (1, −1, 4) =', opts: ['3', '5', '(2, −3, 4)', '7'], a: 0, why: '2 − 3 + 4 = 3 — число.' },
    { c: 'vec', q: 'Длина вектора (2, 3, 6) =', opts: ['11', '7', '49', '√11'], a: 1, why: '√(4 + 9 + 36) = √49 = 7.' },
    { c: 'vec', q: 'L1-норма и L∞-норма вектора (−3, 1, 2) =', opts: ['6 и 3', '6 и 2', '√14 и 3', '0 и 3'], a: 0, why: '|−3| + 1 + 2 = 6; максимум модуля 3.' },
    { c: 'vec', q: 'Векторы (3, 1) и (−1, 3)…', opts: ['параллельны', 'перпендикулярны', 'равны', 'образуют угол 45°'], a: 1, why: '−3 + 3 = 0.' },
    { c: 'vec', q: 'Проекция (4, 2) на (1, 0) =', opts: ['(4, 0)', '(0, 2)', '(2, 0)', '4'], a: 0, why: '(a·b)/(a·a)·a = 4·(1, 0).' },
    { c: 'vec', q: 'Лучшая константа по сумме квадратов для y = (1, 2, 6) —', opts: ['2 (медиана)', '3 (среднее)', '6', '3.5'], a: 1, why: 'Проекция на (1, 1, 1): (1 + 2 + 6)/3 = 3.' },
    { c: 'vec', q: 'Косинусное сходство (1, 0) и (3, 3) =', opts: ['0', '≈ 0.707', '1', '3'], a: 1, why: '3/(1·3√2) = 1/√2.' },
    { c: 'vec', q: 'Расстояние от точки (1, 1) до прямой 3x + 4y = 2 =', opts: ['1', '5', '0.2', '7'], a: 0, why: '(3 + 4 − 2)/5 = 1.' },
    { c: 'mat', q: '[[1, 2], [3, 4]] · (2, 1) =', opts: ['(4, 10)', '(5, 11)', '(2, 6)', '(3, 7)'], a: 0, why: '(2 + 2, 6 + 4) = (4, 10).' },
    { c: 'mat', q: 'Размер X·W, если X — 100 × 5, W — 5 × 3:', opts: ['100 × 3', '5 × 5', '3 × 100', 'нельзя умножить'], a: 0, why: 'Внутренние размеры (5) совпадают, внешние дают 100 × 3.' },
    { c: 'mat', q: 'det [[3, 1], [2, 4]] =', opts: ['10', '14', '12', '−2'], a: 0, why: '3·4 − 1·2 = 10.' },
    { c: 'mat', q: 'Матрица [[2, 4], [1, 2]]…', opts: ['обратима', 'вырождена: det = 0', 'ортогональна', 'единичная'], a: 1, why: 'Второй столбец — удвоенный первый.' },
    { c: 'mat', q: 'Обратная к diag(4, 0.5) —', opts: ['diag(0.25, 2)', 'diag(−4, −0.5)', 'diag(4, 0.5)', 'не существует'], a: 0, why: 'Растяжения отменяются обратными растяжениями.' },
    { c: 'mat', q: 'Столбцы матрицы поворота на 90° против часовой —', opts: ['(0, 1) и (−1, 0)', '(1, 0) и (0, 1)', '(0, −1) и (1, 0)', '(1, 1) и (−1, 1)'], a: 0, why: 'e₁ → (0, 1), e₂ → (−1, 0).' },
    { c: 'mat', q: 'Ранг матрицы [[1, 2, 3], [2, 4, 6]] =', opts: ['1', '2', '3', '0'], a: 0, why: 'Вторая строка — удвоенная первая.' },
    { c: 'mat', q: 'κ(A) ≈ 10⁶. Сколько верных знаков потеряется примерно?', opts: ['1', '6', '16', 'ни одного'], a: 1, why: 'κ ≈ 10ᵏ — теряется около k знаков.' },
    { c: 'lsq', q: 'Нормальные уравнения МНК —', opts: ['Xw = y', 'XᵀXw = Xᵀy', 'XXᵀw = y', 'w = Xᵀy'], a: 1, why: 'Остаток ⟂ столбцам: Xᵀ(y − Xw) = 0.' },
    { c: 'lsq', q: 'В оптимуме МНК со сдвигом сумма остатков…', opts: ['равна нулю', 'положительна', 'равна ‖y‖', 'любая'], a: 0, why: 'Остаток ⟂ столбцу единиц.' },
    { c: 'lsq', q: 'P — матрица проекции. P² =', opts: ['P', 'I', '0', '2P'], a: 0, why: 'Повторная проекция ничего не меняет.' },
    { c: 'lsq', q: 'Зачем добавлять λI к XᵀX?', opts: ['чтобы ускорить умножение', 'чтобы матрица стала обратимой и лучше обусловленной', 'чтобы веса выросли', 'чтобы убрать сдвиг'], a: 1, why: 'Собственные числа поднимаются на λ.' },
    { c: 'lsq', q: 'Полином степени 5 по 6 точкам на обучении даёт ошибку…', opts: ['0', 'как у прямой', 'больше, чем у прямой', 'бесконечную'], a: 0, why: 'Шесть коэффициентов на шесть точек — интерполяция; на новых данных — плохо.' },
    { c: 'lsq', q: 'Центрирование признака перед МНК…', opts: ['меняет прогнозы', 'делает столбец признака ортогональным столбцу единиц', 'обнуляет наклон', 'увеличивает κ'], a: 1, why: 'x − x̄ ⟂ 1 — шаг Грама — Шмидта.' },
    { c: 'eig', q: 'Собственные числа [[5, 0], [0, 2]] —', opts: ['5 и 2', '7 и 10', '0 и 7', '25 и 4'], a: 0, why: 'У диагональной матрицы — числа на диагонали.' },
    { c: 'eig', q: 'След матрицы 7, определитель 12. Собственные числа —', opts: ['3 и 4', '2 и 6', '1 и 12', '−3 и −4'], a: 0, why: 'λ² − 7λ + 12 = 0.' },
    { c: 'eig', q: 'У матрицы поворота на 30° вещественные собственные векторы…', opts: ['есть, два', 'есть, один', 'отсутствуют', 'любые'], a: 2, why: 'Каждый вектор поворачивается; собственные числа комплексные.' },
    { c: 'eig', q: 'Квадратичная форма с собственными числами 3 и −1 —', opts: ['чаша', 'седло', 'жёлоб', 'купол'], a: 1, why: 'Знаки разные.' },
    { c: 'eig', q: 'Спуск по чаше с кривизнами 2 и 200. Наибольший устойчивый темп —', opts: ['1', '0.01', '0.1', '2'], a: 1, why: 'η < 2/λmax = 2/200.' },
    { c: 'eig', q: 'Сингулярные числа diag(−4, 2) —', opts: ['−4 и 2', '4 и 2', '16 и 4', '2 и 4'], a: 1, why: 'Сингулярные числа неотрицательны; минус уходит в U.' },
    { c: 'eig', q: 'Главные компоненты PCA — собственные векторы…', opts: ['матрицы X', 'ковариационной матрицы', 'матрицы проекции', 'гессиана потерь'], a: 1, why: 'Направления максимальной дисперсии проекций.' },
    { c: 'boost', q: 'Лист с остатками (−2, 4, 1) получит значение (квадратичные потери, λ = 0) —', opts: ['1', '3', '4', '−2'], a: 0, why: 'Проекция на индикатор — среднее (−2 + 4 + 1)/3 = 1.' },
    { c: 'boost', q: 'Пень с прогнозами h уменьшает ‖r‖² на…', opts: ['‖h‖²', '‖r − h‖²', '‖r‖', 'ν'], a: 0, why: 'Пифагор: ‖r‖² = ‖h‖² + ‖r − h‖².' },
    { c: 'boost', q: 'Выигрыш разбиения (λ = 0) для листьев с суммами −6 (2 объекта) и 6 (4 объекта), сумма всех 0:', opts: ['27', '12', '0', '72'], a: 0, why: '36/2 + 36/4 = 18 + 9 = 27.' },
    { c: 'boost', q: 'При ν = 1 следующий пень может выбрать то же разбиение?', opts: ['да, обязательно', 'нет: остаток уже ортогонален его ступенькам', 'только при λ > 0', 'только на тестовых данных'], a: 1, why: 'P² = P: проекция остатка на те же ступеньки — ноль.' },
    { c: 'boost', q: 'Лист Ньютона −G/(H + λ) — это…', opts: ['простое среднее остатков', 'взвешенная по hᵢ проекция рабочих ответов с гребневым штрафом', 'медиана градиентов', 'максимум правдоподобия без штрафа'], a: 1, why: 'Квадратичное приближение потерь — взвешенный МНК.' },
    { c: 'boost', q: 'Ансамбль деревьев можно записать как…', opts: ['линейную модель на индикаторах листьев', 'полином по признакам', 'одно большое дерево всегда', 'нейросеть'], a: 0, why: 'F = F₀ + Φθ: θ — ν·значения листьев.' },
  ];
  GBC.widget('linalg-game', (el) => {
    const s = { cat: 'all', i: 0, right: 0, done: 0, streak: 0, picked: null };
    const w = ui.shell(el, { title: 'Тренажёр: линейная алгебра', sub: 'Задачи пяти разделов: векторы, матрицы, МНК и проекции, собственные числа и SVD, бустинг. Считайте на бумаге — числа подобраны так, чтобы всё решалось в уме.' });
    ui.select(w.controls, { label: 'Раздел', value: s.cat, options: Object.entries(CATS).map(([k, v]) => ({ value: k, label: v })), onChange: (v) => ((s.cat = v), (s.i = 0), (s.picked = null), draw()) });
    const next = ui.button(w.controls, { label: 'Следующая', icon: 'step', onClick: () => ((s.i += 1), (s.picked = null), draw()) });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.1rem;padding:6px 0 12px' });
    w.main.appendChild(qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(min(200px,100%),1fr));gap:8px' });
    w.main.appendChild(optsBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'задача' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    const pool = () => QS.filter((q) => s.cat === 'all' || q.c === s.cat);
    function draw() {
      const P = pool();
      const Q = P[s.i % P.length];
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
      st.set('r', (s.i % P.length) + 1 + ' из ' + P.length + ' (' + CATS[Q.c] + ')');
      st.set('ok', s.right + ' из ' + s.done);
      st.set('s', String(s.streak));
      note.innerHTML = s.picked === null ? 'Выберите ответ.' : (s.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет.</b> ') + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), s.picked === null ? 'Пропустить' : 'Следующая');
    }
    draw();
  });
})();
