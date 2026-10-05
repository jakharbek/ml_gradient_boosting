/* Урок 15.12: линейная алгебра. Часть 1 — интуиция, векторы и матрицы.
 * Виджеты: три квартиры в трёхмерном пространстве (проекция на прямую констант и плоскость прямых),
 * действия с векторами, линейные комбинации и оболочка, косой базис и координаты, скалярное произведение,
 * расстояние и масштаб признаков, проекция на вектор, среднее как проекция на 1, нормы Lₚ, геометрия
 * L1/L2-регуляризации, гиперплоскость и «лестница» дерева, умножение матрицы на вектор (строки и столбцы),
 * матрица как преобразование, произведение матриц, определитель, обратная матрица, система уравнений
 * (две картинки), метод Гаусса по шагам, почти вырожденная система.
 * Общие помощники (форматирование, карточки, численная линейная алгебра, 3D-сцена) выставлены в
 * GBC.lesson1512 — ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const R = String.raw;
  const f1 = (v) => U.fmt(v, 1);
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const f4 = (v) => U.fmt(v, 4);
  const py = (v) => U.pyNum(v);
  /** Короткая запись маленьких и больших величин: 3.6e−5 вместо «0». */
  const sci = (v) => (!Number.isFinite(v) ? (Number.isNaN(v) ? '—' : v > 0 ? '∞' : '−∞') : v === 0 ? '0' : Math.abs(v) >= 0.01 && Math.abs(v) < 1e5 ? U.fmt(v, Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 10 ? 2 : 4) : v.toExponential(2).replace(/-/g, '−').replace('e+', 'e'));
  const SUPD = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (k) => String(k).split('').map((c) => SUPD[c] || c).join('');
  /** Подписи логарифмической оси: 10⁻⁶ вместо 1e-6. */
  function powFmt(v) {
    const e = Math.round(Math.log10(v));
    if (Math.abs(v - Math.pow(10, e)) > 1e-9 * v) return U.fmt(v, 2);
    if (e >= -2 && e <= 3) return String(Number(v.toPrecision(3)));
    return '10' + sup(e);
  }
  const decades = (a, b, step = 1) => {
    const out = [];
    for (let e = a; e <= b; e += step) out.push(Math.pow(10, e));
    return out;
  };
  /** Диапазон оси по значениям с полями; почти постоянные значения не ломают деления оси. */
  function yDom(vals, pad = 0.08, inc = []) {
    const v = vals.concat(inc).filter(Number.isFinite);
    if (!v.length) return [-1, 1];
    const [lo, hi] = U.extent(v);
    const span = hi - lo;
    if (span < 1e-9 * Math.max(1, Math.abs(hi))) {
      const m = (lo + hi) / 2;
      const d = Math.max(0.5, Math.abs(m) * 0.1);
      return [m - d, m + d];
    }
    return [lo - pad * span, hi + Math.max(pad, 0.14) * span];
  }
  /** Вектор строкой: (1, −2.5). */
  const fv = (v, d = 2) => '(' + v.map((x) => U.fmt(Math.abs(x) < 1e-12 ? 0 : x, d)).join(', ') + ')';
  /** Матрица строкой: [[1, 2], [3, 4]]. */
  const fm = (A, d = 2) => '[' + A.map((r) => fv(r, d).replace('(', '[').replace(')', ']')).join(', ') + ']';
  const snap = (v, s = 0.25) => Math.round(v / s) * s;
  const clean = (v) => (Math.abs(v) < 1e-9 ? 0 : v);

  /* ==============================================================================
   * Карточки, формулы, таблицы
   * ============================================================================== */
  function texInto(el, src, display = false) {
    el._tex = src;
    el.replaceChildren(GBC.math.tex(src, display));
    if (!window.katex && !el._texSub) {
      el._texSub = true;
      GBC.bus.on('mathready', () => el.replaceChildren(GBC.math.tex(el._tex, display)));
    }
  }
  const texEl = (src, display = false, style = '') => {
    const el = H('div', { style: 'overflow-x:auto;overflow-y:hidden;' + style });
    texInto(el, src, display);
    return el;
  };
  function card(title, plain = true) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums;overflow-x:auto;overflow-y:hidden' });
    const head = plain ? 'font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px' : 'font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px';
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' }, H('div', { style: head }, title), body);
    return { el, body };
  }
  const cardGrid = (min = 200) => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(' + min + 'px,100%),1fr));gap:10px;margin:4px 0 10px' });
  function badge(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;white-space:nowrap;' + st }, text);
  }
  /** Таблица: columns — строки; rows — массивы строк. */
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  /** Список шагов решения: [[пояснение, TeX], …], показываются первые k. */
  function stepList(box, steps, k) {
    box.textContent = '';
    steps.slice(0, k).forEach(([c, t], j) => {
      const li = H('li', { style: 'opacity:' + (j === k - 1 ? 1 : 0.8) }, H('div', { style: 'font-size:.92rem;color:var(--ink-2)' }, c));
      if (t) li.appendChild(texEl(R`\displaystyle ` + t, false, 'padding:2px 0'));
      box.appendChild(li);
    });
  }
  /** Склонение: plural(3, 'шаг', 'шага', 'шагов') → 'шага'. */
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  const onTheme = (fn) => GBC.bus.on('themechange', () => setTimeout(fn, 0));
  /** Обёртка для графика с равным масштабом осей: не даёт ему растянуться на всю ширину. */
  function eqBox(parent, max = 600) {
    const box = H('div', { style: 'max-width:' + max + 'px;margin:0 auto;width:100%' });
    parent.appendChild(box);
    return box;
  }
  /** TeX матрицы: [[1, 2], [3, 4]] → \begin{pmatrix}…\end{pmatrix}. */
  function texMat(A, d = 3) {
    const n = (v) => {
      const s = U.fmt(clean(v), d);
      return s.replace('−', '-');
    };
    return R`\begin{pmatrix}` + A.map((r) => r.map(n).join(' & ')).join(R` \\ `) + R`\end{pmatrix}`;
  }
  const texVec = (v, d = 3) => texMat(v.map((x) => [x]), d);

  /* ==============================================================================
   * Численная линейная алгебра (матрицы — массивы строк)
   * ============================================================================== */
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const norm = (a) => Math.sqrt(dot(a, a));
  const vadd = (a, b) => a.map((v, i) => v + b[i]);
  const vsub = (a, b) => a.map((v, i) => v - b[i]);
  const vscale = (a, c) => a.map((v) => v * c);
  const transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  const matVec = (A, v) => A.map((r) => dot(r, v));
  const matMul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
  const eye = (n) => U.range(n).map((i) => U.range(n).map((j) => (i === j ? 1 : 0)));
  const det2 = (A) => A[0][0] * A[1][1] - A[0][1] * A[1][0];
  /** Решение A·x = b методом Гаусса с выбором главного элемента; null — если матрица вырождена. */
  function solve(A, b) {
    const n = A.length;
    const M = A.map((r, i) => r.slice().concat([b[i]]));
    const scale = Math.max(1e-300, ...A.map((r) => Math.max(...r.map(Math.abs))));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12 * scale) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
      x[r] = s / M[r][r];
    }
    return x;
  }
  function inv(A) {
    const n = A.length;
    const cols = U.range(n).map((j) => solve(A, U.range(n).map((i) => (i === j ? 1 : 0))));
    if (cols.some((c) => !c)) return null;
    return U.range(n).map((i) => cols.map((c) => c[i]));
  }
  function det(A) {
    const n = A.length;
    const M = A.map((r) => r.slice());
    let d = 1;
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-300) return 0;
      if (p !== c) ([M[c], M[p]] = [M[p], M[c]]), (d = -d);
      d *= M[c][c];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k < n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return d;
  }
  /** Собственные числа и векторы симметричной матрицы (метод Якоби). Числа — по убыванию, векторы — vecs[k]. */
  function symEig(A) {
    const n = A.length;
    const M = A.map((r) => r.slice());
    const V = eye(n);
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += M[i][j] * M[i][j];
      if (off < 1e-26) break;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          if (Math.abs(M[p][q]) < 1e-300) continue;
          const th = (M[q][q] - M[p][p]) / (2 * M[p][q]);
          const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
          const c = 1 / Math.sqrt(t * t + 1);
          const s = t * c;
          for (let k = 0; k < n; k++) {
            const mkp = M[k][p];
            const mkq = M[k][q];
            M[k][p] = c * mkp - s * mkq;
            M[k][q] = s * mkp + c * mkq;
          }
          for (let k = 0; k < n; k++) {
            const mpk = M[p][k];
            const mqk = M[q][k];
            M[p][k] = c * mpk - s * mqk;
            M[q][k] = s * mpk + c * mqk;
          }
          for (let k = 0; k < n; k++) {
            const vkp = V[k][p];
            const vkq = V[k][q];
            V[k][p] = c * vkp - s * vkq;
            V[k][q] = s * vkp + c * vkq;
          }
        }
      }
    }
    const order = U.range(n).sort((i, j) => M[j][j] - M[i][i]);
    return { values: order.map((i) => M[i][i]), vectors: order.map((i) => V.map((r) => r[i])) };
  }
  /** Сингулярное разложение (односторонний метод Якоби): A = U·diag(S)·Vᵀ; S по убыванию.
   *  Возвращает u[k] (длины m), s[k], v[k] (длины n), k = min(m, n). */
  function svd(A) {
    const m = A.length;
    const n = A[0].length;
    if (m < n) {
      const t = svd(transpose(A));
      return { u: t.v, s: t.s, v: t.u };
    }
    const Ucol = U.range(n).map((j) => A.map((r) => r[j]));
    const Vcol = U.range(n).map((j) => U.range(n).map((i) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let rot = 0;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          const a = dot(Ucol[p], Ucol[p]);
          const b = dot(Ucol[q], Ucol[q]);
          const g = dot(Ucol[p], Ucol[q]);
          if (Math.abs(g) <= 1e-15 * Math.sqrt(a * b) || Math.abs(g) < 1e-300) continue;
          rot++;
          const z = (b - a) / (2 * g);
          const t = Math.sign(z || 1) / (Math.abs(z) + Math.sqrt(1 + z * z));
          const c = 1 / Math.sqrt(1 + t * t);
          const s = c * t;
          for (const W of [Ucol, Vcol]) {
            const P = W[p];
            const Q = W[q];
            for (let k = 0; k < P.length; k++) {
              const x = P[k];
              const y = Q[k];
              P[k] = c * x - s * y;
              Q[k] = s * x + c * y;
            }
          }
        }
      }
      if (!rot) break;
    }
    const sv = Ucol.map(norm);
    const order = U.range(n).sort((i, j) => sv[j] - sv[i]);
    return {
      s: order.map((i) => sv[i]),
      u: order.map((i) => (sv[i] > 1e-300 ? Ucol[i].map((x) => x / sv[i]) : Ucol[i].map(() => 0))),
      v: order.map((i) => Vcol[i]),
    };
  }
  /** Обусловленность: отношение крайних сингулярных чисел. */
  function cond(A) {
    const s = svd(A).s;
    const lo = s[s.length - 1];
    return lo > 1e-300 ? s[0] / lo : Infinity;
  }
  /** Ранг по сингулярным числам. */
  function rank(A, tol = 1e-9) {
    const s = svd(A).s;
    return s.filter((x) => x > tol * Math.max(1, s[0])).length;
  }
  /** Собственные числа и направления матрицы 2×2 общего вида. */
  function eig2(A) {
    const [[a, b], [c, d]] = A;
    const tr = a + d;
    const dt = a * d - b * c;
    const disc = (tr * tr) / 4 - dt;
    if (disc < -1e-12) return { real: false, re: tr / 2, im: Math.sqrt(-disc), tr, det: dt };
    const s = Math.sqrt(Math.max(0, disc));
    const l1 = tr / 2 + s;
    const l2 = tr / 2 - s;
    const vecFor = (l) => {
      const r1 = [a - l, b];
      const r2 = [c, d - l];
      const r = Math.hypot(...r1) >= Math.hypot(...r2) ? r1 : r2;
      if (Math.hypot(...r) < 1e-12) return null; // A = λI: годится любое направление
      const v = [-r[1], r[0]];
      const n = Math.hypot(...v);
      return [v[0] / n, v[1] / n];
    };
    return { real: true, l1, l2, v1: vecFor(l1), v2: vecFor(l2), tr, det: dt, repeated: s < 1e-9 };
  }

  /* ==============================================================================
   * Геометрия на плоскости
   * ============================================================================== */
  /** Знак прямого угла: в точке P между единичными направлениями u и n, сторона s (в единицах графика). */
  function rightAngle(P, u, n, s) {
    const a = [P[0] + s * u[0], P[1] + s * u[1]];
    const b = [a[0] + s * n[0], a[1] + s * n[1]];
    const c = [P[0] + s * n[0], P[1] + s * n[1]];
    return { type: 'line', x: [a[0], b[0], c[0]], y: [a[1], b[1], c[1]], color: 'ink2', width: 1.3, hover: false };
  }
  /** Отсечение многоугольника полуплоскостью w·x ≥ b (Сазерленд — Ходжмен). */
  function clipHalf(poly, w, b) {
    const out = [];
    const f = (p) => w[0] * p[0] + w[1] * p[1] - b;
    for (let i = 0; i < poly.length; i++) {
      const P = poly[i];
      const Q = poly[(i + 1) % poly.length];
      const fp = f(P);
      const fq = f(Q);
      if (fp >= 0) out.push(P);
      if ((fp >= 0) !== (fq >= 0)) {
        const t = fp / (fp - fq);
        out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
      }
    }
    return out;
  }
  const boxPoly = (x0, x1, y0, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const polyLayer = (pts, color, opacity = 0.16, extra = {}) => Object.assign({ type: 'polygon', x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), color, opacity }, extra);
  /** Сетка, преобразованная матрицей T (функция точки). */
  function gridSegs(T, k = 3, lo = -3, hi = 3) {
    const g = { x1: [], y1: [], x2: [], y2: [] };
    for (let i = -k; i <= k; i++) {
      for (const [p, q] of [[[i, lo], [i, hi]], [[lo, i], [hi, i]]]) {
        const P = T(p);
        const Q = T(q);
        g.x1.push(P[0]);
        g.y1.push(P[1]);
        g.x2.push(Q[0]);
        g.y2.push(Q[1]);
      }
    }
    return g;
  }
  /** «Домик»: несимметричная фигура, чтобы было видно отражение. */
  const HOUSE = [[0, 0], [1, 0], [1, 0.8], [0.5, 1.3], [0, 0.8]];
  const PRESETS2 = {
    id: { label: 'единичная I', m: [[1, 0], [0, 1]] },
    stretch: { label: 'растяжение diag(2, 0.5)', m: [[2, 0], [0, 0.5]] },
    rot30: { label: 'поворот на 30°', m: [[0.866, -0.5], [0.5, 0.866]] },
    rot90: { label: 'поворот на 90°', m: [[0, -1], [1, 0]] },
    shear: { label: 'сдвиг [[1, 1], [0, 1]]', m: [[1, 1], [0, 1]] },
    refl: { label: 'отражение diag(−1, 1)', m: [[-1, 0], [0, 1]] },
    proj: { label: 'проекция на ось x', m: [[1, 0], [0, 0]] },
    sym: { label: 'симметричная [[2, 1], [1, 2]]', m: [[2, 1], [1, 2]] },
    rs45: { label: 'поворот 45° и растяжение √2', m: [[1, -1], [1, 1]] },
  };
  const PY_NP = 'import numpy as np\n\n';

  /* ==============================================================================
   * 3D-сцена на SVG: вращение мышью/пальцем, ортографическая проекция, сортировка по глубине
   * ============================================================================== */
  class Scene3D {
    constructor(parent, o = {}) {
      this.o = Object.assign({ height: 360, az: -0.75, el: 0.42, R: 5, center: [0, 0, 0] }, o);
      this.az = this.o.az;
      this.el = this.o.el;
      this.root = H('div', { style: 'position:relative;min-width:0' });
      this.svg = GBC.svg('svg', {
        role: 'img', 'aria-label': o.aria || 'Векторы в трёхмерном пространстве',
        style: 'display:block;width:100%;height:' + this.o.height + 'px;touch-action:pan-y;cursor:grab;user-select:none;-webkit-user-select:none',
      });
      this.root.append(this.svg, H('div', { style: 'position:absolute;right:6px;bottom:2px;font-size:.72rem;color:var(--muted);pointer-events:none' }, '↻ тяните, чтобы вращать'));
      parent.appendChild(this.root);
      const sv = this.svg;
      let drag = null;
      sv.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY, az: this.az, el: this.el };
        try {
          sv.setPointerCapture(e.pointerId);
        } catch (err) {
          /* захват недоступен — вращаем без него */
        }
        sv.style.cursor = 'grabbing';
      });
      sv.addEventListener('pointermove', (e) => {
        if (!drag) return;
        this.az = drag.az - (e.clientX - drag.x) * 0.01;
        this.el = U.clamp(drag.el + (e.clientY - drag.y) * 0.008, -0.2, 1.45);
        this._req();
      });
      const end = () => {
        drag = null;
        sv.style.cursor = 'grab';
      };
      sv.addEventListener('pointerup', end);
      sv.addEventListener('pointercancel', end);
      if (window.ResizeObserver) {
        let lw = 0;
        new ResizeObserver(() => {
          const ww = sv.clientWidth;
          if (ww && Math.abs(ww - lw) > 1) {
            lw = ww;
            this._req();
          }
        }).observe(sv);
      }
    }
    _req() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this.draw();
      });
    }
    render(items) {
      this.items = items.filter(Boolean);
      this.draw();
    }
    /** Точка (x, y, z) → [экранный x, экранный y вверх, глубина]. */
    _p(p) {
      const c = this.o.center;
      const x = p[0] - c[0];
      const y = p[1] - c[1];
      const z = p[2] - c[2];
      const ca = Math.cos(this.az);
      const sa = Math.sin(this.az);
      const ce = Math.cos(this.el);
      const se = Math.sin(this.el);
      const xr = x * ca - y * sa;
      const yr = x * sa + y * ca;
      return [xr, z * ce + yr * se, yr * ce - z * se];
    }
    draw() {
      const sv = this.svg;
      const W = sv.clientWidth || 600;
      const Hh = this.o.height;
      sv.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
      sv.textContent = '';
      if (!this.items) return;
      const sc = (Math.min(W, Hh) / 2 / this.o.R) * 0.92;
      const P = (p) => {
        const q = this._p(p);
        return [W / 2 + q[0] * sc, Hh / 2 - q[1] * sc, q[2]];
      };
      const css = GBC.colors.css;
      const S = GBC.svg;
      const polys = [];
      const rest = [];
      const texts = [];
      for (const it of this.items) {
        if (it.type === 'poly') {
          const pts = it.pts.map(P);
          polys.push({ it, pts, z: U.mean(pts.map((q) => q[2])) });
        } else if (it.type === 'text') {
          texts.push({ it, at: P(it.at) });
        } else if (it.type === 'point') {
          const q = P(it.at);
          rest.push({ it, q, z: q[2] - 0.01 });
        } else {
          const a = P(it.from);
          const b = P(it.to);
          rest.push({ it, a, b, z: (a[2] + b[2]) / 2 });
        }
      }
      polys.sort((u, v) => v.z - u.z);
      rest.sort((u, v) => v.z - u.z);
      for (const { it, pts } of polys) {
        sv.appendChild(S('path', {
          d: pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('') + 'Z',
          style: 'fill:' + css(it.color) + ';fill-opacity:' + (it.opacity ?? 0.14) + ';stroke:' + (it.stroke ? css(it.stroke) : 'none') + ';stroke-width:1',
        }));
      }
      for (const r of rest) {
        const it = r.it;
        const col = css(it.color || 'ink');
        if (it.type === 'point') {
          sv.appendChild(S('circle', { cx: r.q[0], cy: r.q[1], r: it.r || 5, style: 'fill:' + (it.hollow ? 'var(--surface)' : col) + ';stroke:' + (it.hollow ? col : 'var(--surface)') + ';stroke-width:' + (it.hollow ? 2 : 1.5) }));
          continue;
        }
        const [ax, ay] = r.a;
        const [bx, by] = r.b;
        const w = it.width || 2;
        const style = 'stroke:' + col + ';stroke-width:' + w + ';stroke-linecap:round;opacity:' + (it.opacity ?? 1) + (it.dash ? ';stroke-dasharray:' + it.dash : '');
        if (it.type === 'arrow') {
          const len = Math.hypot(bx - ax, by - ay);
          if (len < 1) continue;
          const ux = (bx - ax) / len;
          const uy = (by - ay) / len;
          const hs = Math.min(10, len * 0.4);
          sv.appendChild(S('line', { x1: ax, y1: ay, x2: bx - ux * hs * 0.8, y2: by - uy * hs * 0.8, style }));
          sv.appendChild(S('path', {
            d: 'M' + bx + ',' + by + 'L' + (bx - ux * hs - uy * hs * 0.45) + ',' + (by - uy * hs + ux * hs * 0.45) + 'L' + (bx - ux * hs + uy * hs * 0.45) + ',' + (by - uy * hs - ux * hs * 0.45) + 'Z',
            style: 'fill:' + col + ';opacity:' + (it.opacity ?? 1),
          }));
        } else {
          sv.appendChild(S('line', { x1: ax, y1: ay, x2: bx, y2: by, style }));
        }
      }
      for (const { it, at } of texts) {
        const t = S('text', {
          x: at[0] + (it.dx || 0), y: at[1] + (it.dy || 0), 'text-anchor': it.anchor || 'start',
          style: 'font-size:' + (it.size || 13) + 'px;fill:' + css(it.color || 'ink2') + ';font-weight:' + (it.bold ? 650 : 400) + ';paint-order:stroke;stroke:var(--surface);stroke-width:3px;stroke-linejoin:round',
        });
        t.textContent = it.text;
        sv.appendChild(t);
      }
    }
  }
  /** Оси 3D-сцены с подписями. */
  function axes3(L, labels) {
    const out = [];
    const ends = [[L, 0, 0], [0, L, 0], [0, 0, L]];
    ends.forEach((e, i) => {
      out.push({ type: 'arrow', from: [0, 0, 0], to: e, color: 'muted', width: 1.3 });
      out.push({ type: 'text', at: e, text: labels[i], color: 'muted', dx: 4, dy: -4, size: 12 });
    });
    return out;
  }
  /** Прямой угол в 3D: в точке P между направлениями u и n (единичными). */
  function rightAngle3(P, u, n, s) {
    const a = P.map((v, i) => v + s * u[i]);
    const b = a.map((v, i) => v + s * n[i]);
    const c = P.map((v, i) => v + s * n[i]);
    return [{ type: 'seg', from: a, to: b, color: 'ink2', width: 1.2 }, { type: 'seg', from: b, to: c, color: 'ink2', width: 1.2 }];
  }
  const unit = (v) => {
    const n = norm(v);
    return n > 1e-12 ? v.map((x) => x / n) : v.map(() => 0);
  };

  /* ==============================================================================
   * Интуиция. Три квартиры — одна точка в пространстве
   * ============================================================================== */
  GBC.widget('three-flats', (el) => {
    const Y = [2, 4, 3];
    const X = [1, 2, 3];
    const s = { c: 1.5, plane: false };
    const w = ui.shell(el, { title: 'Три квартиры — одна точка в пространстве', sub: 'Оси — цены первой, второй и третьей квартиры. Толстая стрелка цвета текста — вектор цен y = (2, 4, 3). Серая пунктирная прямая — все константные прогнозы (c, c, c). Двигайте c и ищите точку прямой, ближайшую к y. Затем включите плоскость прогнозов прямых b + k·x.' });
    const sc = ui.slider(w.controls, { label: 'Константа c', min: 0, max: 5, step: 0.05, value: s.c, format: f2, onInput: (v) => ((s.c = v), draw()) });
    ui.button(w.controls, { label: 'Лучшая константа', kind: 'primary', onClick: () => ((s.c = 3), sc.set(3), draw()) });
    ui.toggle(w.controls, { label: 'Плоскость прямых b + k·x', checked: s.plane, onChange: (v) => ((s.plane = v), draw()) });
    const scene = new Scene3D(w.main, { height: 380, R: 4.4, center: [2, 2, 2], az: 0.62, el: 0.5 });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'прогноз c·(1, 1, 1)' }, { key: 'd', label: '‖y − c·1‖²' }, { key: 'o', label: '(y − c·1)·1' }, { key: 'p', label: 'лучшая прямая: ‖r‖²' }]);
    function draw() {
      const c = s.c;
      const C = [c, c, c];
      const yhat = [2.5, 3, 3.5];
      const items = axes3(4.6, ['цена 1', 'цена 2', 'цена 3']);
      items.push({ type: 'seg', from: [-0.4, -0.4, -0.4], to: [4.6, 4.6, 4.6], color: 'muted', width: 1.6, dash: '6 5' });
      items.push({ type: 'text', at: [4.6, 4.6, 4.6], text: 'константы c·(1, 1, 1)', color: 'muted', dx: 6, dy: 0, size: 12 });
      if (s.plane) {
        // патч плоскости натянут на ортогональные 1 и x − 2·1 = (−1, 0, 1): иначе он выглядит узкой полоской
        const corner = (a, b) => [a - b, a, a + b];
        items.push({ type: 'poly', pts: [corner(-0.3, -1.4), corner(4.3, -1.4), corner(4.3, 1.4), corner(-0.3, 1.4)], color: 'model', opacity: 0.13, stroke: 'model' });
        items.push({ type: 'arrow', from: [0, 0, 0], to: X, color: 'violet', width: 2 });
        items.push({ type: 'text', at: X, text: 'x = (1, 2, 3)', color: 'violet', dx: 6, dy: 12, size: 12 });
        items.push({ type: 'seg', from: yhat, to: Y, color: 'model', width: 2.2, dash: '4 3' });
        items.push({ type: 'point', at: yhat, color: 'model', r: 6 });
        items.push({ type: 'text', at: yhat, text: 'ŷ = (2.5, 3, 3.5)', color: 'model', dx: 10, dy: 6, bold: true });
        const n = unit(vsub(Y, yhat));
        items.push(...rightAngle3(yhat, unit([1, 1, 1]), n, 0.32));
      }
      const d = vsub(Y, C);
      items.push({ type: 'seg', from: C, to: Y, color: 'tree', width: 2.2, dash: '5 4' });
      items.push({ type: 'point', at: C, color: 'tree', r: 6 });
      items.push({ type: 'text', at: C, text: 'c·1 = (' + f2(c) + ', ' + f2(c) + ', ' + f2(c) + ')', color: 'tree', dx: 8, dy: -8, bold: true });
      if (Math.abs(c - 3) < 1e-9) items.push(...rightAngle3(C, unit([1, 1, 1]), unit(d), 0.32));
      items.push({ type: 'arrow', from: [0, 0, 0], to: Y, color: 'ink', width: 2.6 });
      items.push({ type: 'point', at: Y, color: 'ink', r: 5 });
      items.push({ type: 'text', at: Y, text: 'y = (2, 4, 3)', color: 'ink', dx: -8, dy: -8, bold: true, anchor: 'end' });
      scene.render(items);
      const dd = dot(d, d);
      const o = dot(d, [1, 1, 1]);
      st.set('c', fv(C));
      st.set('d', f3(dd));
      st.set('o', f3(o));
      st.set('p', s.plane ? '1.5' : '—');
      note.innerHTML = (Math.abs(o) < 1e-9
        ? '<b>Ближайшая точка прямой:</b> c = 3 — среднее цен. Отрезок до y перпендикулярен прямой: (y − 3·1)·(1, 1, 1) = (−1) + 1 + 0 = 0. Квадрат расстояния 2 — это сумма квадратов остатков лучшей константы.'
        : 'Квадрат расстояния ‖y − c·1‖² = ' + f3(dd) + ' — это сумма квадратов ошибок константного прогноза c. ' + (o > 0 ? 'Скалярное произведение остатка на (1, 1, 1) положительно — c стоит увеличить.' : 'Скалярное произведение остатка на (1, 1, 1) отрицательно — c стоит уменьшить.')) +
        (s.plane ? ' <b>Плоскость</b> — все прогнозы прямых b·(1, 1, 1) + k·(1, 2, 3). Ближайшая точка ŷ = (2.5, 3, 3.5) (b = 2, k = 0.5), остаток (−0.5, 1, −0.5) перпендикулярен плоскости, ‖r‖² = 1.5 &lt; 2: из плоскости до y ближе, чем с прямой.' : '');
    }
    w.pythonAction(() => PY_NP + 'y = np.array([2, 4, 3.0])\none = np.ones(3)\nx = np.array([1, 2, 3.0])\n\n' +
      'c = ' + py(s.c) + '\nprint("‖y − c·1‖² =", (y - c * one) @ (y - c * one))\n' +
      'c_best = (one @ y) / (one @ one)                  # проекция на прямую констант\nprint("лучшая константа:", c_best, "= среднее", y.mean())\n\n' +
      'X = np.c_[one, x]\nw = np.linalg.solve(X.T @ X, X.T @ y)              # проекция на плоскость прямых\nyhat = X @ w\nr = y - yhat\n' +
      'print("b, k =", w, " ŷ =", yhat, " ‖r‖² =", r @ r)\nprint("r ⟂ столбцам:", X.T @ r)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 1. Действия с векторами
   * ============================================================================== */
  GBC.widget('vector-ops', (el) => {
    const s = { a: [3, 1], b: [1, 2], c: 1.5, mode: 'sum' };
    const w = ui.shell(el, { title: 'Вектор — стрелка и список чисел', sub: 'Тяните концы векторов a (синий) и b (оранжевый). Выберите действие: сумма — пройти по a, затем по b; разность a − b — стрелка из конца b в конец a; умножение на число растягивает и разворачивает.' });
    ui.segmented(w.controls, { label: 'Действие', value: s.mode, options: [{ value: 'sum', label: 'a + b' }, { value: 'diff', label: 'a − b' }, { value: 'scale', label: 'c·a' }, { value: 'comb', label: '2a − b' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.slider(w.controls, { label: 'Множитель c', min: -2, max: 2.5, step: 0.25, value: s.c, format: f2, onInput: (v) => ((s.c = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main), { height: 340, equal: true, x: { label: 'x₁', domain: [-5, 7] }, y: { label: 'x₂', domain: [-4, 6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'a' }, { key: 'b', label: 'b' }, { key: 'r', label: 'результат' }, { key: 'n', label: 'его длина' }]);
    function draw() {
      const { a, b, c, mode } = s;
      let res;
      const L = [];
      if (mode === 'sum') {
        res = vadd(a, b);
        L.push({ type: 'arrows', x1: [a[0], b[0]], y1: [a[1], b[1]], x2: [res[0], res[0]], y2: [res[1], res[1]], color: 'muted', width: 1.6, opacity: 0.8 });
        L.push({ type: 'polygon', x: [0, a[0], res[0], b[0]], y: [0, a[1], res[1], b[1]], color: 'violet', opacity: 0.07 });
      } else if (mode === 'diff') {
        res = vsub(a, b);
        L.push({ type: 'arrows', x1: [b[0]], y1: [b[1]], x2: [a[0]], y2: [a[1]], color: 'violet', width: 2, opacity: 0.55 });
        L.push({ type: 'arrows', x1: [0], y1: [0], x2: [-b[0]], y2: [-b[1]], color: 'orange', width: 1.4, opacity: 0.45 });
        L.push({ type: 'text', items: [{ x: -b[0], y: -b[1], dx: 6, dy: 14, text: '−b' }] });
      } else if (mode === 'scale') {
        res = vscale(a, c);
      } else {
        res = vsub(vscale(a, 2), b);
        const a2 = vscale(a, 2);
        L.push({ type: 'arrows', x1: [0, a2[0]], y1: [0, a2[1]], x2: [a2[0], res[0]], y2: [a2[1], res[1]], color: 'muted', width: 1.6, opacity: 0.8 });
        L.push({ type: 'text', items: [{ x: a2[0], y: a2[1], dx: 6, dy: -6, text: '2a' }] });
      }
      plot.render([
        ...L,
        { type: 'arrows', x1: [0], y1: [0], x2: [res[0]], y2: [res[1]], color: 'violet', width: 3 },
        { type: 'arrows', x1: [0], y1: [0], x2: [a[0]], y2: [a[1]], color: 'blue', width: 2.4 },
        { type: 'arrows', x1: [0], y1: [0], x2: [b[0]], y2: [b[1]], color: 'orange', width: 2.4 },
        { type: 'text', items: [{ x: a[0], y: a[1], dx: 7, dy: -7, text: 'a', bold: true }, { x: b[0], y: b[1], dx: 7, dy: -7, text: 'b', bold: true }, { x: res[0], y: res[1], dx: 7, dy: 14, text: { sum: 'a + b', diff: 'a − b', scale: 'c·a', comb: '2a − b' }[mode], bold: true, color: 'violet' }] },
        { type: 'points', x: [a[0], b[0]], y: [a[1], b[1]], color: (i) => (i ? 'orange' : 'blue'), r: 7, draggable: true, onDrag: (i, x, y) => ((i ? (s.b = [snap(x), snap(y)]) : (s.a = [snap(x), snap(y)])), draw()) },
      ]);
      st.set('a', fv(a));
      st.set('b', fv(b));
      st.set('r', fv(res));
      st.set('n', f3(norm(res)));
      const expl = {
        sum: 'Покоординатно: ' + fv(a) + ' + ' + fv(b) + ' = ' + fv(res) + '. Серые стрелки — тот же путь в другом порядке: a + b = b + a, поэтому сумма — диагональ параллелограмма.',
        diff: 'a − b = a + (−1)·b = ' + fv(res) + '. Бледная фиолетовая стрелка ведёт из конца b в конец a — это тот же вектор, просто нарисованный в другом месте.',
        scale: 'c·a = ' + f2(c) + '·' + fv(a) + ' = ' + fv(res) + '. ' + (c < 0 ? 'Отрицательный множитель разворачивает стрелку.' : c === 0 ? 'Нулевой множитель даёт нулевой вектор.' : 'Длина умножилась на ' + f2(Math.abs(c)) + ', направление не изменилось.'),
        comb: '2a − b = ' + fv(vscale(a, 2)) + ' − ' + fv(b) + ' = ' + fv(res) + '. Сначала удвоили a, потом прошли «против» b.',
      }[mode];
      note.innerHTML = expl + ' В машинном обучении так складываются прогнозы бустинга: F<sub>m</sub> = F<sub>m−1</sub> + ν·h<sub>m</sub> — сложение векторов длины n.';
    }
    w.pythonAction(() => PY_NP + 'a = np.array([' + s.a.map(py).join(', ') + '])\nb = np.array([' + s.b.map(py).join(', ') + '])\nc = ' + py(s.c) + '\n\nprint("a + b =", a + b)\nprint("a − b =", a - b)\nprint("c·a  =", c * a)\nprint("2a − b =", 2 * a - b)\nprint("длина a + b:", np.linalg.norm(a + b))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 2. Линейные комбинации и оболочка
   * ============================================================================== */
  GBC.widget('lin-comb', (el) => {
    const s = { u: [1, 1], v: [1, -1], al: 1, be: 0.5, t: [3, 1] };
    const w = ui.shell(el, { title: 'Линейная комбинация α·u + β·v: куда можно дойти', sub: 'Синий шаг u и оранжевый v можно делать сколько угодно раз. Точки — комбинации с целыми α, β; если u и v не на одной прямой, ими покрывается вся плоскость. Серая точка — цель: подберите α и β, чтобы до неё дойти (или нажмите «Решить»). Концы u, v и цель можно тянуть.' });
    const sa = ui.slider(w.controls, { label: 'α', min: -4, max: 4, step: 0.25, value: s.al, format: f2, onInput: (v) => ((s.al = v), draw()) });
    const sb = ui.slider(w.controls, { label: 'β', min: -4, max: 4, step: 0.25, value: s.be, format: f2, onInput: (v) => ((s.be = v), draw()) });
    ui.button(w.controls, { label: 'Решить: дойти до цели', kind: 'primary', onClick: () => {
      const sol = solve([[s.u[0], s.v[0]], [s.u[1], s.v[1]]], s.t);
      if (sol && Math.abs(sol[0]) <= 50 && Math.abs(sol[1]) <= 50) {
        s.al = sol[0];
        s.be = sol[1];
        sa.set(U.clamp(sol[0], -4, 4));
        sb.set(U.clamp(sol[1], -4, 4));
      }
      draw();
    } });
    ui.button(w.controls, { label: 'Сделать v = 2u', onClick: () => ((s.v = vscale(s.u, 2)), draw()) });
    const plot = new GBC.Plot(eqBox(w.main), { height: 360, equal: true, x: { label: 'x₁', domain: [-6, 6] }, y: { label: 'x₂', domain: [-5, 5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'α·u + β·v' }, { key: 't', label: 'цель' }, { key: 'd', label: 'до цели' }, { key: 'det', label: 'det [u v]' }]);
    function draw() {
      const { u, v, al, be, t } = s;
      const dt = u[0] * v[1] - u[1] * v[0];
      const indep = Math.abs(dt) > 1e-9;
      const lat = { x: [], y: [] };
      for (let i = -6; i <= 6; i++) {
        for (let j = -6; j <= 6; j++) {
          const p = vadd(vscale(u, i), vscale(v, j));
          if (Math.abs(p[0]) <= 6.5 && Math.abs(p[1]) <= 5.5) (lat.x.push(p[0]), lat.y.push(p[1]));
        }
      }
      const A = vscale(u, al);
      const C = vadd(A, vscale(v, be));
      const L = [];
      if (!indep) {
        const dir = norm(u) > 1e-9 ? unit(u) : unit(v);
        L.push({ type: 'line', x: [-9 * dir[0], 9 * dir[0]], y: [-9 * dir[1], 9 * dir[1]], color: 'violet', width: 5, opacity: 0.25, hover: false });
      }
      plot.render([
        ...L,
        { type: 'points', x: lat.x, y: lat.y, color: 'muted', r: 2.2, opacity: 0.6 },
        { type: 'arrows', x1: [0], y1: [0], x2: [A[0]], y2: [A[1]], color: 'blue', width: 2.2, opacity: 0.55 },
        { type: 'arrows', x1: [A[0]], y1: [A[1]], x2: [C[0]], y2: [C[1]], color: 'orange', width: 2.2, opacity: 0.55 },
        { type: 'arrows', x1: [0], y1: [0], x2: [C[0]], y2: [C[1]], color: 'violet', width: 2.8 },
        { type: 'arrows', x1: [0], y1: [0], x2: [u[0]], y2: [u[1]], color: 'blue', width: 2.6 },
        { type: 'arrows', x1: [0], y1: [0], x2: [v[0]], y2: [v[1]], color: 'orange', width: 2.6 },
        { type: 'text', items: [{ x: u[0], y: u[1], dx: 7, dy: -6, text: 'u', bold: true }, { x: v[0], y: v[1], dx: 7, dy: 12, text: 'v', bold: true }, { x: t[0], y: t[1], dx: 8, dy: -8, text: 'цель' }] },
        { type: 'points', x: [t[0]], y: [t[1]], color: 'ink2', r: 8, hollow: true },
        { type: 'points', x: [u[0], v[0], t[0]], y: [u[1], v[1], t[1]], color: (i) => ['blue', 'orange', 'ink2'][i], r: (i) => (i === 2 ? 4 : 7), draggable: true, onDrag: (i, x, y) => {
          const p = [snap(x, 0.5), snap(y, 0.5)];
          if (i === 0) s.u = p;
          else if (i === 1) s.v = p;
          else s.t = p;
          draw();
        } },
      ]);
      const dist = norm(vsub(C, t));
      st.set('c', fv(C));
      st.set('t', fv(t));
      st.set('d', f3(dist));
      st.set('det', f3(dt));
      let msg;
      if (indep) {
        msg = dist < 1e-9 ? '<b>Дошли!</b> ' + f2(al) + '·' + fv(u) + ' + ' + f2(be) + '·' + fv(v) + ' = ' + fv(t) + '. ' : 'α·u + β·v = ' + fv(C) + ' — до цели ' + f3(dist) + '. ';
        msg += 'u и v не на одной прямой (det ≠ 0): их оболочка — вся плоскость, и до любой цели можно дойти единственным способом.';
      } else {
        const tIn = Math.abs((norm(u) > 1e-9 ? u : v)[0] * t[1] - (norm(u) > 1e-9 ? u : v)[1] * t[0]) < 1e-9;
        msg = '<b>u и v на одной прямой</b> (det = 0): оболочка — только фиолетовая прямая. ' + (tIn ? 'Цель на ней — дойти можно бесконечно многими способами.' : 'Цель вне её — дойти нельзя никакими α и β.');
      }
      note.innerHTML = msg + ' Так же устроены прогнозы линейной модели: все они — комбинации столбцов признаков.';
    }
    w.pythonAction(() => PY_NP + 'u = np.array([' + s.u.map(py).join(', ') + '])\nv = np.array([' + s.v.map(py).join(', ') + '])\ntarget = np.array([' + s.t.map(py).join(', ') + '])\n\n' +
      'M = np.c_[u, v]                     # столбцы — u и v\nprint("det =", np.linalg.det(M))\nif abs(np.linalg.det(M)) > 1e-12:\n    al, be = np.linalg.solve(M, target)\n    print("α, β =", al, be, " проверка:", al * u + be * v)\nelse:\n    print("u и v на одной прямой: оболочка — прямая")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 3. Базис и координаты
   * ============================================================================== */
  GBC.widget('basis-grid', (el) => {
    const s = { b1: [2, 1], b2: [-1, 1], p: [1, 2] };
    const w = ui.shell(el, { title: 'Базис — это сетка: координаты точки в косом базисе', sub: 'Векторы b₁ (синий) и b₂ (оранжевый) задают косую сетку: линии α = const и β = const. Координаты точки P в этом базисе — сколько шагов b₁ и b₂ нужно сделать, чтобы до неё дойти. Тяните b₁, b₂ и P.' });
    ui.select(w.controls, { label: 'Базис', value: 'skew', options: [{ value: 'skew', label: 'косой (2, 1), (−1, 1)' }, { value: 'std', label: 'стандартный e₁, e₂' }, { value: 'diag', label: 'повёрнутый (1, 1), (1, −1)' }, { value: 'dep', label: 'зависимый (1, 2), (2, 4)' }], onChange: (k) => {
      const B = { skew: [[2, 1], [-1, 1]], std: [[1, 0], [0, 1]], diag: [[1, 1], [1, -1]], dep: [[1, 2], [2, 4]] }[k];
      s.b1 = B[0];
      s.b2 = B[1];
      draw();
    } });
    const plot = new GBC.Plot(eqBox(w.main), { height: 360, equal: true, x: { label: 'x₁', domain: [-5, 5] }, y: { label: 'x₂', domain: [-4, 4] }, grid: 'none' });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'P в стандартном базисе' }, { key: 'c', label: 'P в базисе b₁, b₂' }, { key: 'd', label: 'det [b₁ b₂]' }]);
    function draw() {
      const { b1, b2, p } = s;
      const dt = b1[0] * b2[1] - b1[1] * b2[0];
      const T = (q) => [q[0] * b1[0] + q[1] * b2[0], q[0] * b1[1] + q[1] * b2[1]];
      const L = [{ type: 'segments', ...gridSegs((q) => q, 5, -5, 5), color: 'grid', width: 1, opacity: 1 }];
      const ok = Math.abs(dt) > 1e-9;
      let co = null;
      if (ok) {
        L.push({ type: 'segments', ...gridSegs(T, 8, -8, 8), color: 'model', width: 1, opacity: 0.35 });
        co = solve([[b1[0], b2[0]], [b1[1], b2[1]]], p);
        const A = vscale(b1, co[0]);
        L.push({ type: 'arrows', x1: [0], y1: [0], x2: [A[0]], y2: [A[1]], color: 'blue', width: 1.8, opacity: 0.5 });
        L.push({ type: 'arrows', x1: [A[0]], y1: [A[1]], x2: [p[0]], y2: [p[1]], color: 'orange', width: 1.8, opacity: 0.5 });
      } else {
        const d = unit(norm(b1) > 1e-9 ? b1 : b2);
        L.push({ type: 'line', x: [-8 * d[0], 8 * d[0]], y: [-8 * d[1], 8 * d[1]], color: 'critical', width: 4, opacity: 0.3, hover: false });
      }
      plot.render([
        ...L,
        { type: 'arrows', x1: [0], y1: [0], x2: [b1[0]], y2: [b1[1]], color: 'blue', width: 2.8 },
        { type: 'arrows', x1: [0], y1: [0], x2: [b2[0]], y2: [b2[1]], color: 'orange', width: 2.8 },
        { type: 'text', items: [{ x: b1[0], y: b1[1], dx: 7, dy: -6, text: 'b₁', bold: true }, { x: b2[0], y: b2[1], dx: 7, dy: -6, text: 'b₂', bold: true }, { x: p[0], y: p[1], dx: 8, dy: -8, text: 'P', bold: true }] },
        { type: 'points', x: [b1[0], b2[0], p[0]], y: [b1[1], b2[1], p[1]], color: (i) => ['blue', 'orange', 'ink'][i], r: (i) => (i === 2 ? 6 : 7), draggable: true, onDrag: (i, x, y) => {
          const q = [snap(x, 0.5), snap(y, 0.5)];
          if (i === 0) s.b1 = q;
          else if (i === 1) s.b2 = q;
          else s.p = q;
          draw();
        } },
      ]);
      st.set('p', fv(p));
      st.set('c', co ? fv(co, 3) : 'не определены');
      st.set('d', f3(dt));
      note.innerHTML = ok
        ? 'P = ' + f3(co[0]) + '·b₁ + ' + f3(co[1]) + '·b₂: в косой сетке точка ' + fv(p) + ' имеет координаты ' + fv(co, 3) + '. Чтобы их найти, решаем систему α·b₁ + β·b₂ = P. В стандартном базисе e₁ = (1, 0), e₂ = (0, 1) координаты совпадают с самой точкой.'
        : '<b>b₁ и b₂ зависимы</b> (det = 0): сетка схлопнулась в красную прямую — это не базис. Точки вне прямой выразить нельзя, точки на ней — бесконечно многими способами. Так ведут себя столбцы-индикаторы категорий вместе со столбцом единиц.';
    }
    w.pythonAction(() => PY_NP + 'B = np.c_[[' + s.b1.map(py).join(', ') + '], [' + s.b2.map(py).join(', ') + ']]   # столбцы — b₁ и b₂\nP = np.array([' + s.p.map(py).join(', ') + '])\n\nprint("det B =", np.linalg.det(B))\nprint("ранг B =", np.linalg.matrix_rank(B))\nif np.linalg.matrix_rank(B) == 2:\n    print("координаты P в базисе:", np.linalg.solve(B, P))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 4. Скалярное произведение
   * ============================================================================== */
  GBC.widget('dot-product', (el) => {
    const s = { a: [3, 4], b: [4, -1], half: true };
    const w = ui.shell(el, { title: 'Скалярное произведение: насколько векторы «смотрят в одну сторону»', sub: 'a · b = a₁b₁ + a₂b₂ = ‖a‖·‖b‖·cos α. Зелёная стрелка — проекция b на направление a (красная, если a · b < 0). Закрашена полуплоскость, где произведение с a положительно. Тяните концы векторов.' });
    ui.toggle(w.controls, { label: 'Полуплоскость a · x > 0', checked: s.half, onChange: (v) => ((s.half = v), draw()) });
    ui.button(w.controls, { label: 'Сделать b ⟂ a', onClick: () => {
      const n = norm(s.a) || 1;
      const k = Math.max(1, Math.round(norm(s.b))) / n;
      s.b = [-s.a[1] * k, s.a[0] * k].map((x) => snap(x));
      draw();
    } });
    const plot = new GBC.Plot(eqBox(w.main), { height: 360, equal: true, x: { label: 'x₁', domain: [-6, 6] }, y: { label: 'x₂', domain: [-5, 6] } });
    const calc = H('div', { style: 'margin:4px 0' });
    w.main.appendChild(calc);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'a · b' }, { key: 'la', label: '‖a‖' }, { key: 'lb', label: '‖b‖' }, { key: 'cos', label: 'cos α' }, { key: 'ang', label: 'угол α' }, { key: 'p', label: 'длина проекции b на a' }]);
    function draw() {
      const { a, b } = s;
      const d = dot(a, b);
      const la = norm(a);
      const lb = norm(b);
      const ua = la ? vscale(a, 1 / la) : [0, 0];
      const proj = la ? d / la : 0;
      const P = vscale(ua, proj);
      const cosA = la && lb ? U.clamp(d / (la * lb), -1, 1) : NaN;
      const ang = (Math.acos(cosA) * 180) / Math.PI;
      const L = [];
      if (s.half && la) L.push(polyLayer(clipHalf(boxPoly(-9, 9, -9, 9), a, 0), 'good', 0.08));
      L.push({ type: 'line', x: [-9 * ua[0], 9 * ua[0]], y: [-9 * ua[1], 9 * ua[1]], color: 'muted', width: 1, dash: '2 4', hover: false });
      if (la && lb) {
        const a0 = Math.atan2(a[1], a[0]);
        let a1 = Math.atan2(b[1], b[0]);
        while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
        while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI;
        const arc = U.linspace(a0, a1, 40);
        L.push({ type: 'line', x: arc.map((t) => 0.9 * Math.cos(t)), y: arc.map((t) => 0.9 * Math.sin(t)), color: 'ink2', width: 1.4, hover: false });
      }
      L.push({ type: 'segments', x1: [b[0]], y1: [b[1]], x2: [P[0]], y2: [P[1]], color: 'ink2', width: 1.4, dash: '4 4', opacity: 1 });
      if (Math.abs(proj) > 0.3 && norm(vsub(b, P)) > 0.3) L.push(rightAngle(P, vscale(ua, -Math.sign(proj)), unit(vsub(b, P)), 0.32));
      plot.render([
        ...L,
        { type: 'arrows', x1: [0], y1: [0], x2: [P[0]], y2: [P[1]], color: d >= 0 ? 'good' : 'critical', width: 5, opacity: 0.6 },
        { type: 'arrows', x1: [0], y1: [0], x2: [a[0]], y2: [a[1]], color: 'blue', width: 2.4 },
        { type: 'arrows', x1: [0], y1: [0], x2: [b[0]], y2: [b[1]], color: 'orange', width: 2.4 },
        { type: 'text', items: [{ x: a[0], y: a[1], dx: 7, dy: -7, text: 'a', bold: true }, { x: b[0], y: b[1], dx: 7, dy: -7, text: 'b', bold: true }] },
        { type: 'points', x: [a[0], b[0]], y: [a[1], b[1]], color: (i) => (i ? 'orange' : 'blue'), r: 7, draggable: true, onDrag: (i, x, y) => ((i ? (s.b = [snap(x), snap(y)]) : (s.a = [snap(x), snap(y)])), draw()) },
      ]);
      texInto(calc, R`a\cdot b = ` + U.fmt(a[0], 2).replace('−', '-') + R`\cdot(` + U.fmt(b[0], 2).replace('−', '-') + ')+' + U.fmt(a[1], 2).replace('−', '-') + R`\cdot(` + U.fmt(b[1], 2).replace('−', '-') + ') = ' + U.fmt(d, 3).replace('−', '-'));
      st.set('d', f3(d));
      st.set('la', f3(la));
      st.set('lb', f3(lb));
      st.set('cos', f3(cosA));
      st.set('ang', f1(ang) + '°');
      st.set('p', f3(proj));
      note.innerHTML = (Math.abs(d) < 1e-9 ? '<b>Ноль — векторы перпендикулярны (ортогональны).</b> Проекция b на a — нулевая.' : d > 0 ? 'Положительно: угол острый (' + f1(ang) + '°), b лежит в закрашенной полуплоскости.' : 'Отрицательно: угол тупой (' + f1(ang) + '°), b — по другую сторону от прямой, перпендикулярной a.') +
        ' Проверка формулы: ‖a‖·‖b‖·cos α = ' + f3(la) + '·' + f3(lb) + '·' + f3(cosA) + ' = ' + f3(la * lb * cosA) + '. Неравенство Коши — Буняковского: |a · b| ≤ ‖a‖·‖b‖ = ' + f3(la * lb) + '.';
    }
    w.pythonAction(() => PY_NP + 'a = np.array([' + s.a.map(py).join(', ') + '])\nb = np.array([' + s.b.map(py).join(', ') + '])\n\nd = a @ b\ncos = d / (np.linalg.norm(a) * np.linalg.norm(b))\nprint("a·b =", d, " ‖a‖ =", np.linalg.norm(a), " ‖b‖ =", np.linalg.norm(b))\nprint("угол:", np.degrees(np.arccos(np.clip(cos, -1, 1))), "°")\nprint("длина проекции b на a:", d / np.linalg.norm(a))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 5. Расстояние и масштаб признаков
   * ============================================================================== */
  const FLATS8 = { area: [30, 35, 42, 50, 62, 70, 78, 90], dist: [12, 3, 9, 4, 10, 2, 8, 3], price: [3.0, 5.0, 3.6, 5.8, 7.0, 9.6, 7.8, 10.6] };
  GBC.widget('distance-scale', (el) => {
    const s = { mode: 'km', q: [58, 4] };
    const A = FLATS8.area;
    const D = FLATS8.dist;
    const sdA = Math.sqrt(U.mean(A.map((v) => (v - U.mean(A)) ** 2)));
    const sdD = Math.sqrt(U.mean(D.map((v) => (v - U.mean(D)) ** 2)));
    const w = ui.shell(el, { title: 'Ближайший сосед зависит от единиц измерения', sub: 'Восемь квартир (площадь и расстояние до центра). Крупная точка цвета текста — новая квартира; её можно тянуть. Линии ведут к трём ближайшим соседям по евклидову расстоянию. Смените единицы второго признака и посмотрите, кто окажется «ближе».' });
    ui.segmented(w.controls, { label: 'Единицы признаков', value: s.mode, options: [{ value: 'km', label: 'м² и км' }, { value: 'm', label: 'м² и метры' }, { value: 'std', label: 'стандартизованные' }], onChange: (v) => ((s.mode = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 300, x: { label: 'площадь, м²', domain: [25, 95] }, y: { label: 'до центра, км', domain: [0, 14] } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'ближайшая' }, { key: 'd', label: 'расстояние' }, { key: 'sh', label: 'доля площади в d²' }, { key: 'p', label: 'цена соседа, млн' }]);
    function scales() {
      if (s.mode === 'km') return [1, 1];
      if (s.mode === 'm') return [1, 1000];
      return [1 / sdA, 1 / sdD];
    }
    function draw() {
      const [kx, ky] = scales();
      const q = s.q;
      const dA = A.map((v) => (v - q[0]) * kx);
      const dD = D.map((v) => (v - q[1]) * ky);
      const d = dA.map((v, i) => Math.hypot(v, dD[i]));
      const order = U.argsort(d);
      const nn = order.slice(0, 3);
      plot.render([
        { type: 'segments', x1: nn.map(() => q[0]), y1: nn.map(() => q[1]), x2: nn.map((i) => A[i]), y2: nn.map((i) => D[i]), color: 'tree', width: 2, opacity: 0.85 },
        { type: 'points', x: A, y: D, color: 'data', r: 5.5, label: 'квартиры', highlight: new Set([order[0]]), tooltip: (i) => [{ label: 'квартира', value: '№' + (i + 1) }, { label: 'площадь', value: A[i] + ' м²' }, { label: 'до центра', value: D[i] + ' км' }, { label: 'цена', value: U.fmt(FLATS8.price[i], 1) + ' млн' }, { label: 'расстояние', value: f3(d[i]) }] },
        { type: 'text', items: A.map((a, i) => ({ x: a, y: D[i], dx: 7, dy: -7, text: '№' + (i + 1) })) },
        { type: 'points', x: [q[0]], y: [q[1]], color: 'ink', r: 7, label: 'новая квартира', draggable: true, onDrag: (i, x, y) => ((s.q = [U.clamp(Math.round(x), 26, 94), U.clamp(Math.round(y * 2) / 2, 0.5, 13.5)]), draw()) },
      ]);
      const unitD = s.mode === 'm' ? 'м' : s.mode === 'km' ? 'км' : 'ст. откл.';
      const unitA = s.mode === 'std' ? 'ст. откл.' : 'м²';
      rowTable(tbl, ['№', 'Δ площади, ' + unitA, 'Δ до центра, ' + unitD, 'расстояние d', 'место'], order.map((i, r) => [String(i + 1), f3(dA[i]), f3(dD[i]), f3(d[i]), String(r + 1)]), (r) => r < 3);
      const i0 = order[0];
      const share = d[i0] > 0 ? (dA[i0] ** 2) / (d[i0] ** 2) : 0;
      st.set('n', '№' + (i0 + 1) + ' (' + A[i0] + ' м², ' + D[i0] + ' км)');
      st.set('d', f3(d[i0]));
      st.set('sh', Math.round(100 * share) + ' %');
      st.set('p', U.fmt(FLATS8.price[i0], 1));
      note.innerHTML = {
        km: 'В единицах (м², км) разница в 1 км весит столько же, сколько разница в 1 м² — немного на фоне различий площади в десятки м². Поэтому «ближайшей» может оказаться квартира, далёкая от центра: расстояние до центра почти не влияет на выбор. ',
        m: 'Теперь расстояние записано тысячами метров — и площадь перестала что-либо значить: соседи выбираются только по расстоянию до центра. ',
        std: 'После стандартизации (стандартные отклонения ' + f1(sdA) + ' м² и ' + f2(sdD) + ' км) единица каждого признака — его типичный разброс, и признаки весят сопоставимо. ',
      }[s.mode] + 'Методы, основанные на расстояниях и градиентах, чувствительны к единицам; дерево — нет: разбиение «площадь ≤ 56» одинаково режет и метры, и сантиметры.';
    }
    w.pythonAction(() => PY_NP + 'area = np.array([30, 35, 42, 50, 62, 70, 78, 90.0])\ndist = np.array([12, 3, 9, 4, 10, 2, 8, 3.0])\nquery = np.array([' + s.q.map(py).join(', ') + '])\n\n' +
      'for name, sx, sy in [("м², км", 1, 1), ("м², метры", 1, 1000), ("стандартизованные", 1 / area.std(), 1 / dist.std())]:\n    d = np.hypot((area - query[0]) * sx, (dist - query[1]) * sy)\n    order = np.argsort(d)\n    print(f"{name:18}: ближайшие №{order[0] + 1}, №{order[1] + 1}, №{order[2] + 1}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 6. Проекция на вектор
   * ============================================================================== */
  GBC.widget('projection-line', (el) => {
    const s = { a: [4, 1], b: [2, 3], t: 0.5 };
    const w = ui.shell(el, { title: 'Проекция: ближайшая точка прямой', sub: 'Точки прямой вдоль a — это t·a. Ползунок двигает пробную точку t·a (оранжевая); внизу — квадрат расстояния от неё до b как функция t. Минимум параболы — при t* = (a·b)/(a·a), и именно там отрезок до b перпендикулярен прямой. Концы a и b можно тянуть.' });
    const stt = ui.slider(w.controls, { label: 'Пробная точка t', min: -1, max: 2, step: 0.01, value: s.t, format: f2, onInput: (v) => ((s.t = v), draw()) });
    ui.button(w.controls, { label: 'Поставить t = t*', kind: 'primary', onClick: () => {
      const tt = dot(s.a, s.b) / dot(s.a, s.a);
      s.t = tt;
      stt.set(U.clamp(tt, -1, 2));
      draw();
    } });
    const plot = new GBC.Plot(eqBox(w.main), { height: 320, equal: true, x: { label: 'x₁', domain: [-3, 6] }, y: { label: 'x₂', domain: [-2, 5] } });
    const plot2 = new GBC.Plot(w.main, { height: 170, x: { label: 't', domain: [-1, 2] }, y: { label: '‖b − t·a‖²' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ts', label: 't* = a·b / a·a' }, { key: 'p', label: 'проекция' }, { key: 'e', label: 'остаток e' }, { key: 'ae', label: 'a · e' }, { key: 'py', label: 'Пифагор ‖b‖² = ‖p‖² + ‖e‖²' }]);
    function draw() {
      const { a, b, t } = s;
      const aa = dot(a, a) || 1e-12;
      const ts = dot(a, b) / aa;
      const P = vscale(a, ts);
      const e = vsub(b, P);
      const T = vscale(a, t);
      const ua = unit(a);
      const L = [{ type: 'line', x: [-9 * ua[0], 9 * ua[0]], y: [-9 * ua[1], 9 * ua[1]], color: 'muted', width: 1, dash: '3 4', hover: false }];
      if (norm(e) > 0.25) L.push(rightAngle(P, Math.abs(ts) > 0.05 ? vscale(ua, -Math.sign(ts)) : ua, unit(e), 0.28));
      plot.render([
        ...L,
        { type: 'segments', x1: [b[0]], y1: [b[1]], x2: [P[0]], y2: [P[1]], color: 'ink2', width: 1.4, dash: '4 4', opacity: 1 },
        { type: 'segments', x1: [b[0]], y1: [b[1]], x2: [T[0]], y2: [T[1]], color: 'tree', width: 2, opacity: 0.8 },
        { type: 'arrows', x1: [0], y1: [0], x2: [P[0]], y2: [P[1]], color: 'good', width: 5, opacity: 0.55 },
        { type: 'arrows', x1: [0], y1: [0], x2: [a[0]], y2: [a[1]], color: 'blue', width: 2.4 },
        { type: 'arrows', x1: [0], y1: [0], x2: [b[0]], y2: [b[1]], color: 'ink', width: 2.2 },
        { type: 'points', x: [T[0]], y: [T[1]], color: 'tree', r: 5.5 },
        { type: 'text', items: [{ x: a[0], y: a[1], dx: 7, dy: -7, text: 'a', bold: true }, { x: b[0], y: b[1], dx: 7, dy: -7, text: 'b', bold: true }, { x: P[0], y: P[1], dx: 6, dy: 16, text: 'proj', color: 'good' }] },
        { type: 'points', x: [a[0], b[0]], y: [a[1], b[1]], color: (i) => (i ? 'ink' : 'blue'), r: 7, draggable: true, onDrag: (i, x, y) => {
          const q = [snap(x, 0.5), snap(y, 0.5)];
          if (i) s.b = q;
          else if (norm(q) > 0.4) s.a = q;
          draw();
        } },
      ]);
      const tg = U.linspace(-1, 2, 121);
      const fq = (tt) => dot(b, b) - 2 * tt * dot(a, b) + tt * tt * aa;
      plot2.render([
        { type: 'line', x: tg, y: tg.map(fq), color: 'model', width: 2.2, label: '‖b − t·a‖²' },
        ts >= -1 && ts <= 2 ? { type: 'vline', x: ts, color: 'good', dash: '4 4', width: 1.4 } : null,
        { type: 'points', x: [t], y: [fq(t)], color: 'tree', r: 5.5 },
      ]);
      const dd = (v) => f3(dot(v, v));
      st.set('ts', f3(ts));
      st.set('p', fv(P, 3));
      st.set('e', fv(e, 3));
      st.set('ae', f3(clean(dot(a, e))));
      st.set('py', dd(b) + ' = ' + dd(P) + ' + ' + dd(e));
      const tt = vsub(b, T);
      note.innerHTML = 'Пробная точка t = ' + f2(t) + ': квадрат расстояния ' + f3(dot(tt, tt)) + (Math.abs(t - ts) < 0.006 ? ' — <b>минимум</b>.' : ', а минимум ' + f3(dot(e, e)) + ' — при t* = ' + f3(ts) + '.') +
        ' В точке минимума остаток e = b − t*·a перпендикулярен a: a·e = 0. Условие «производная равна нулю» и условие «остаток ортогонален» — одно и то же.';
    }
    w.pythonAction(() => PY_NP + 'a = np.array([' + s.a.map(py).join(', ') + '])\nb = np.array([' + s.b.map(py).join(', ') + '])\n\nt_star = (a @ b) / (a @ a)\np = t_star * a\ne = b - p\nprint("t* =", t_star, " проекция =", p, " остаток =", e)\nprint("a·e =", a @ e, " Пифагор:", b @ b, "=", p @ p + e @ e)\n');
    draw();
  });

  GBC.widget('mean-projection', (el) => {
    const toy = GBC.datasets.toyRegression();
    const s = { c: 4, loss: 'l2', out: false };
    const w = ui.shell(el, { title: 'Лучшая константа — проекция на вектор из единиц', sub: 'Столбики — цены шести квартир, синяя линия — константный прогноз c, отрезки — остатки. Внизу — сумма квадратов (или модулей) остатков как функция c. Найдите минимум.' });
    const sc = ui.slider(w.controls, { label: 'Прогноз c', min: 0, max: 12, step: 0.05, value: s.c, format: f2, onInput: (v) => ((s.c = v), draw()) });
    ui.segmented(w.controls, { label: 'Потери', value: s.loss, options: [{ value: 'l2', label: 'Σ квадратов (L2)' }, { value: 'l1', label: 'Σ модулей (L1)' }], onChange: (v) => ((s.loss = v), draw()) });
    ui.toggle(w.controls, { label: 'Выброс: 21 вместо 11', checked: s.out, onChange: (v) => ((s.out = v), draw()) });
    ui.button(w.controls, { label: 'Проекция: c = (1·y)/(1·1)', kind: 'primary', onClick: () => {
      const y = ys();
      s.c = s.loss === 'l2' ? U.mean(y) : U.median(y);
      sc.set(s.c);
      draw();
    } });
    const ys = () => toy.y.map((v, i) => (s.out && i === 5 ? 21 : v));
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'квартира', domain: [0.4, 6.6] }, y: { label: 'цена, млн', domain: [0, 22.5] } });
    const plot2 = new GBC.Plot(w.main, { height: 170, x: { label: 'c', domain: [0, 12] }, y: { label: 'потери' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'sum', label: 'Σ (yᵢ − c) = 1·r' }, { key: 'l2', label: 'Σ (yᵢ − c)²' }, { key: 'l1', label: 'Σ |yᵢ − c|' }, { key: 'm', label: 'среднее / медиана' }]);
    function draw() {
      const y = ys();
      const x = toy.x;
      const c = s.c;
      const r = y.map((v) => v - c);
      plot.render([
        { type: 'bars', x, y, color: 'data', width: 0.55, opacity: 0.25, label: 'цены y' },
        { type: 'segments', x1: x, y1: x.map(() => c), x2: x, y2: y, color: 'residual', width: 3, opacity: 1 },
        { type: 'hline', y: c, color: 'model', width: 2.4, label: 'прогноз c·1' },
      ], { y: [0, s.out ? 22.5 : 12.5] });
      const cs = U.linspace(0, 12, 241);
      const L2 = (cc) => U.sum(y.map((v) => (v - cc) ** 2));
      const L1 = (cc) => U.sum(y.map((v) => Math.abs(v - cc)));
      const f = s.loss === 'l2' ? L2 : L1;
      const best = s.loss === 'l2' ? U.mean(y) : U.median(y);
      plot2.render([
        { type: 'line', x: cs, y: cs.map(f), color: 'model', width: 2.2, label: s.loss === 'l2' ? 'Σ квадратов' : 'Σ модулей' },
        { type: 'vline', x: best, color: 'good', dash: '4 4', width: 1.4 },
        { type: 'points', x: [c], y: [f(c)], color: 'tree', r: 5.5 },
      ]);
      st.set('sum', f3(clean(U.sum(r))));
      st.set('l2', f3(L2(c)));
      st.set('l1', f3(L1(c)));
      st.set('m', f3(U.mean(y)) + ' / ' + f3(U.median(y)));
      const yy = U.sum(y.map((v) => v * v));
      note.innerHTML = (s.loss === 'l2'
        ? 'Минимум суммы квадратов — при c = среднее = ' + f3(U.mean(y)) + ', и там сумма остатков 1·r равна нулю: остаток перпендикулярен вектору (1, …, 1). Пифагор: ‖y‖² = ' + f2(yy) + ' = 6·' + f3(U.mean(y)) + '² + ' + f3(L2(U.mean(y))) + '.'
        : 'Сумма модулей — ломаная; её минимум — медиана ' + f3(U.median(y)) + ', и он плоский на всём отрезке между 3-й и 4-й по величине ценами (от 4 до 7): любая такая константа одинаково хороша по L1.') +
        (s.out ? ' <b>С выбросом</b> среднее сдвинулось на ' + f3(U.mean(y) - 6) + ', а медиана — нет: квадраты раздувают большой остаток.' : '');
    }
    w.pythonAction(() => PY_NP + 'y = np.array([2, 4, 3, 7, 9, ' + (s.out ? '21' : '11') + '.0])\none = np.ones_like(y)\n\nc_l2 = (one @ y) / (one @ one)          # проекция на 1 = среднее\nprint("лучшая константа L2:", c_l2, " сумма остатков:", (y - c_l2).sum())\nprint("лучшая константа L1: медиана", np.median(y))\nc = ' + py(s.c) + '\nprint(f"при c = {c}: Σ квадратов = {((y - c)**2).sum():.3f}, Σ модулей = {np.abs(y - c).sum():.3f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 7. Нормы и регуляризация
   * ============================================================================== */
  GBC.widget('norm-balls', (el) => {
    const s = { p: 2, v: [1.2, 0.8] };
    const w = ui.shell(el, { title: 'Длина бывает разной: нормы Lₚ', sub: 'Толстая кривая — все точки с нормой 1 («единичный шар») для выбранного p; бледные — шары L1 (ромб), L2 (круг) и L∞ (квадрат). Пунктир — шар той же нормы, на котором лежит оранжевая точка. Тяните точку.' });
    const ps = ui.slider(w.controls, { label: 'p', min: 0.5, max: 10, step: 0.1, value: s.p, format: f1, onInput: (v) => ((s.p = v), draw()) });
    ui.segmented(w.controls, { label: 'Готовые', value: null, options: [{ value: 1, label: 'L1' }, { value: 2, label: 'L2' }, { value: 10, label: '≈ L∞' }], onChange: (v) => ((s.p = v), ps.set(v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main), { height: 340, equal: true, x: { label: 'x₁', domain: [-2.2, 2.2] }, y: { label: 'x₂', domain: [-1.7, 1.7] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'l1', label: 'L1 = |x₁| + |x₂|' }, { key: 'l2', label: 'L2 = √(x₁² + x₂²)' }, { key: 'li', label: 'L∞ = max |xᵢ|' }, { key: 'lp', label: 'Lₚ' }]);
    const ball = (p, r = 1) => {
      const ang = U.linspace(0, 2 * Math.PI, 361);
      return ang.map((t) => {
        const c = Math.cos(t);
        const sn = Math.sin(t);
        const n = Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(sn), p), 1 / p);
        return [(r * c) / n, (r * sn) / n];
      });
    };
    function draw() {
      const p = s.p;
      const v = s.v;
      const lp = Math.pow(Math.pow(Math.abs(v[0]), p) + Math.pow(Math.abs(v[1]), p), 1 / p);
      const B = ball(p);
      const Bv = ball(p, lp);
      plot.render([
        { type: 'line', x: [1, 0, -1, 0, 1], y: [0, 1, 0, -1, 0], color: 'orange', width: 1.2, opacity: 0.45, label: 'L1', hover: false },
        { type: 'line', x: ball(2).map((q) => q[0]), y: ball(2).map((q) => q[1]), color: 'blue', width: 1.2, opacity: 0.45, label: 'L2', hover: false },
        { type: 'line', x: [1, -1, -1, 1, 1], y: [1, 1, -1, -1, 1], color: 'aqua', width: 1.2, opacity: 0.55, label: 'L∞', hover: false },
        { type: 'line', x: Bv.map((q) => q[0]), y: Bv.map((q) => q[1]), color: 'muted', width: 1.2, dash: '4 4', hover: false },
        { type: 'line', x: B.map((q) => q[0]), y: B.map((q) => q[1]), color: 'violet', width: 2.6, label: 'Lₚ = 1, p = ' + f1(p), hover: false },
        { type: 'arrows', x1: [0], y1: [0], x2: [v[0]], y2: [v[1]], color: 'tree', width: 2.2 },
        { type: 'points', x: [v[0]], y: [v[1]], color: 'tree', r: 7, draggable: true, onDrag: (i, x, y) => ((s.v = [Math.round(x * 20) / 20, Math.round(y * 20) / 20]), draw()) },
      ]);
      const ax = Math.abs(v[0]);
      const ay = Math.abs(v[1]);
      st.set('l1', f3(ax + ay));
      st.set('l2', f3(Math.hypot(ax, ay)));
      st.set('li', f3(Math.max(ax, ay)));
      st.set('lp', f3(lp));
      note.innerHTML = 'Для одного и того же вектора всегда L∞ ≤ L2 ≤ L1: ' + f3(Math.max(ax, ay)) + ' ≤ ' + f3(Math.hypot(ax, ay)) + ' ≤ ' + f3(ax + ay) + '. С ростом p шар раздувается от ромба к квадрату. ' + (p < 1 ? '<b>При p &lt; 1 шар невыпуклый</b> — это уже не норма: нарушается неравенство треугольника.' : p < 1.3 ? 'У L1-шара острые углы на осях — поэтому L1-штраф охотно делает веса ровно нулевыми (следующий виджет).' : 'Квадрат L2-нормы вектора остатков — это сумма квадратов ошибок, L1-норма — сумма модулей.');
    }
    w.pythonAction(() => PY_NP + 'v = np.array([' + s.v.map(py).join(', ') + '])\nfor p in (1, 2, ' + py(s.p) + ', np.inf):\n    print(f"L{p}-норма:", np.linalg.norm(v, p))\n\nr = np.array([-4, -2, -3, 1, 3, 5.0])       # остатки шести квартир\nprint("MSE =", np.linalg.norm(r) ** 2 / len(r), " MAE =", np.linalg.norm(r, 1) / len(r))\n');
    draw();
  });

  GBC.widget('reg-geometry', (el) => {
    const Q = [[1.0, 0.45], [0.45, 0.6]];
    const s = { c: [2.0, 0.7], t: 1, kind: 'l1' };
    const w = ui.shell(el, { title: 'Почему L1-штраф обнуляет веса: геометрия', sub: 'Квадратик — минимум потерь без штрафа (его можно тянуть), эллипсы — линии уровня потерь. Ограничение ‖w‖ ≤ t — закрашенный шар. Решение с ограничением — точка, где «раздуваемый» эллипс впервые касается шара. У ромба (L1) касание часто приходится на угол — там одна координата равна нулю.' });
    ui.segmented(w.controls, { label: 'Штраф', value: s.kind, options: [{ value: 'l1', label: 'L1 (лассо)' }, { value: 'l2', label: 'L2 (гребневая)' }], onChange: (v) => ((s.kind = v), draw()) });
    ui.slider(w.controls, { label: 'Радиус t', min: 0.1, max: 2.5, step: 0.05, value: s.t, format: f2, onInput: (v) => ((s.t = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main), { height: 360, equal: true, x: { label: 'w₁', domain: [-2.2, 3] }, y: { label: 'w₂', domain: [-1.8, 2.2] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'решение w' }, { key: 'z', label: 'нулевых весов' }, { key: 'f', label: 'потери' }, { key: 'n', label: '‖w‖' }]);
    const f = (w2) => {
      const d = vsub(w2, s.c);
      return dot(d, matVec(Q, d));
    };
    function solveL2(t) {
      if (norm(s.c) <= t) return s.c.slice();
      let lo = 0;
      let hi = 1e4;
      const wl = (l) => solve([[Q[0][0] + l, Q[0][1]], [Q[1][0], Q[1][1] + l]], matVec(Q, s.c));
      for (let k = 0; k < 200; k++) {
        const m = (lo + hi) / 2;
        if (norm(wl(m)) > t) lo = m;
        else hi = m;
      }
      return wl(hi);
    }
    function solveL1(t) {
      if (Math.abs(s.c[0]) + Math.abs(s.c[1]) <= t) return s.c.slice();
      const V = [[t, 0], [0, t], [-t, 0], [0, -t]];
      let best = null;
      for (let k = 0; k < 4; k++) {
        const A = V[k];
        const B = V[(k + 1) % 4];
        const d = vsub(B, A);
        // f(A + u·d), u ∈ [0, 1] — парабола по u
        const g = vsub(A, s.c);
        const a2 = dot(d, matVec(Q, d));
        const a1 = 2 * dot(d, matVec(Q, g));
        const u = U.clamp(a2 > 0 ? -a1 / (2 * a2) : 0, 0, 1);
        const p = vadd(A, vscale(d, u));
        if (!best || f(p) < f(best) - 1e-15) best = p;
      }
      return best.map((x) => (Math.abs(x) < 1e-9 ? 0 : x));
    }
    function draw() {
      const t = s.t;
      const sol = s.kind === 'l1' ? solveL1(t) : solveL2(t);
      const fs = f(sol);
      const ev = symEig(Q);
      const ell = (lev) => {
        const ang = U.linspace(0, 2 * Math.PI, 181);
        return ang.map((th) => {
          const a = Math.sqrt(lev / ev.values[0]);
          const b = Math.sqrt(lev / ev.values[1]);
          const u = a * Math.cos(th);
          const v = b * Math.sin(th);
          return [s.c[0] + u * ev.vectors[0][0] + v * ev.vectors[1][0], s.c[1] + u * ev.vectors[0][1] + v * ev.vectors[1][1]];
        });
      };
      const levels = [0.05, 0.2, 0.5, 1, 2, 3.5].filter((l) => Math.abs(l - fs) > 0.03);
      const ballPts = s.kind === 'l1' ? [[t, 0], [0, t], [-t, 0], [0, -t]] : U.linspace(0, 2 * Math.PI, 120).map((th) => [t * Math.cos(th), t * Math.sin(th)]);
      plot.render([
        polyLayer(ballPts, s.kind === 'l1' ? 'orange' : 'blue', 0.16, { stroke: s.kind === 'l1' ? 'orange' : 'blue', width: 1.6 }),
        ...levels.map((l) => {
          const E = ell(l);
          return { type: 'line', x: E.map((p) => p[0]), y: E.map((p) => p[1]), color: 'muted', width: 1, opacity: 0.7, hover: false };
        }),
        fs > 1e-9 ? (() => {
          const E = ell(fs);
          return { type: 'line', x: E.map((p) => p[0]), y: E.map((p) => p[1]), color: 'model', width: 2.2, hover: false };
        })() : null,
        { type: 'text', items: [{ x: s.c[0], y: s.c[1], dx: 8, dy: -8, text: 'минимум без штрафа' }] },
        { type: 'points', x: [sol[0]], y: [sol[1]], color: 'tree', r: 7 },
        { type: 'points', x: [s.c[0]], y: [s.c[1]], color: 'ink', r: 6, shape: 'square', draggable: true, onDrag: (i, x, y) => ((s.c = [U.clamp(snap(x, 0.05), -2, 2.8), U.clamp(snap(y, 0.05), -1.6, 2)]), draw()) },
      ]);
      const zeros = sol.filter((x) => x === 0).length;
      st.set('w', fv(sol, 3));
      st.set('z', String(zeros));
      st.set('f', f3(fs));
      st.set('n', s.kind === 'l1' ? f3(Math.abs(sol[0]) + Math.abs(sol[1])) + ' (L1)' : f3(norm(sol)) + ' (L2)');
      note.innerHTML = (fs < 1e-12 ? 'Минимум без штрафа уже внутри шара — ограничение ничего не меняет.' : s.kind === 'l1'
        ? (zeros ? '<b>Касание в углу ромба:</b> w = ' + fv(sol, 3) + ' — один вес ровно ноль. Признак выключен целиком — это и есть отбор признаков лассо.' : 'Касание на ребре ромба: оба веса ненулевые. Уменьшите t или сдвиньте минимум — касание переедет в угол.')
        : 'Круг гладкий, касание почти никогда не попадает точно на ось: L2 уменьшает оба веса, но не обнуляет. w = ' + fv(sol, 3) + '.') + ' Меньше t — сильнее штраф (больше λ).';
    }
    w.pythonAction(() => PY_NP + 'Q = np.array([[1.0, 0.45], [0.45, 0.6]])     # форма потерь (w − c)ᵀQ(w − c)\nc = np.array([' + s.c.map(py).join(', ') + '])\nt = ' + py(s.t) + '\n\n' +
      '# L1: перебор по рёбрам ромба |w₁| + |w₂| = t\nf = lambda w: (w - c) @ Q @ (w - c)\nV = [np.array(p) for p in ([t, 0], [0, t], [-t, 0], [0, -t])]\nbest = min((A + u * (B - A) for A, B in zip(V, V[1:] + V[:1]) for u in np.linspace(0, 1, 2001)), key=f)\n' +
      'print("L1:", best.round(3) if np.abs(c).sum() > t else c)\n\n# L2: (Q + λI)w = Qc, λ подбираем так, чтобы ‖w‖ = t\nfrom math import inf\nlo, hi = 0.0, 1e4\nfor _ in range(200):\n    lam = (lo + hi) / 2\n    w = np.linalg.solve(Q + lam * np.eye(2), Q @ c)\n    lo, hi = (lam, hi) if np.linalg.norm(w) > t else (lo, lam)\nprint("L2:", (np.linalg.solve(Q + hi * np.eye(2), Q @ c) if np.linalg.norm(c) > t else c).round(3))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 8. Гиперплоскость и лестница дерева
   * ============================================================================== */
  const HP = (() => {
    const pts = [[-3.4, -2.6], [-2.6, -0.9], [-1.8, -2.9], [-0.9, -1.3], [0.2, -2.2], [1.1, -0.6], [2.0, -1.9], [3.1, 0.4], [3.6, -1.2], [-0.2, 0.1], [1.9, 0.9],
      [-3.5, -0.4], [-2.4, 1.2], [-1.5, 0.3], [-0.6, 2.1], [0.4, 1.4], [1.3, 2.6], [2.4, 2.4], [3.3, 3.1], [-1.1, -0.2], [0.9, 1.2], [-2.9, 2.8]];
    const lab = pts.map((p) => (p[1] > 0.75 * p[0] + 0.2 ? 1 : 0));
    return { pts, lab };
  })();
  GBC.widget('hyperplane', (el) => {
    const s = { ang: 120, b: 0.2, axis: false, steps: 0, q: [2, -1.5] };
    const w = ui.shell(el, { title: 'Гиперплоскость w·x = b и лестница дерева', sub: 'Прямая w·x = b делит плоскость на две полуплоскости; стрелка — нормаль w. Точки двух классов: синие и оранжевые. Включите «как дерево» — нормаль сможет смотреть только вдоль осей. Ползунок «ступенек» строит лестницу из осевых разбиений, приближающую прямую. Квадратик можно тянуть: показано её знаковое расстояние до прямой.' });
    const sa = ui.slider(w.controls, { label: 'Направление нормали', min: 0, max: 355, step: 5, value: s.ang, format: (v) => v + '°', onInput: (v) => ((s.ang = s.axis ? Math.round(v / 90) * 90 % 360 : v), draw()) });
    ui.slider(w.controls, { label: 'Сдвиг b', min: -3, max: 3, step: 0.1, value: s.b, format: f2, onInput: (v) => ((s.b = v), draw()) });
    ui.toggle(w.controls, { label: 'Только вдоль осей (как дерево)', checked: s.axis, onChange: (v) => {
      s.axis = v;
      if (v) (s.ang = (Math.round(s.ang / 90) * 90) % 360), sa.set(s.ang);
      draw();
    } });
    ui.slider(w.controls, { label: 'Ступенек лестницы', min: 0, max: 12, step: 1, value: s.steps, format: (v) => (v ? String(v) : 'нет'), onInput: (v) => ((s.steps = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main), { height: 360, equal: true, x: { label: 'x₁', domain: [-4, 4] }, y: { label: 'x₂', domain: [-3.5, 3.5] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'w', label: 'нормаль w' }, { key: 'e', label: 'ошибок у прямой' }, { key: 's', label: 'ошибок у лестницы' }, { key: 'd', label: 'знаковое расстояние точки' }]);
    function draw() {
      const th = (s.ang * Math.PI) / 180;
      const wv = [Math.cos(th), Math.sin(th)].map((v) => (Math.abs(v) < 1e-12 ? 0 : v));
      const b = s.b;
      const side = (p) => (dot(wv, p) - b >= 0 ? 1 : 0);
      // класс 1 должен оказаться с той стороны, куда смотрит нормаль
      const errLine = HP.pts.filter((p, i) => side(p) !== HP.lab[i]).length;
      const L = [polyLayer(clipHalf(boxPoly(-6, 6, -6, 6), wv, b), 'orange', 0.1), polyLayer(clipHalf(boxPoly(-6, 6, -6, 6), vscale(wv, -1), -b), 'blue', 0.07)];
      // прямая
      const dir = [-wv[1], wv[0]];
      const P0 = vscale(wv, b);
      L.push({ type: 'line', x: [P0[0] - 9 * dir[0], P0[0] + 9 * dir[0]], y: [P0[1] - 9 * dir[1], P0[1] + 9 * dir[1]], color: 'ink', width: 2.2, label: 'w·x = b', hover: false });
      // лестница: кусочно-постоянная аппроксимация x₂(x₁) на [−4, 4]
      let errSt = null;
      if (s.steps > 0 && Math.abs(wv[1]) > 1e-6) {
        const k = s.steps;
        const edges = U.linspace(-4, 4, k + 1);
        const lvl = edges.slice(0, -1).map((e0, i) => {
          const xm = (e0 + edges[i + 1]) / 2;
          return (b - wv[0] * xm) / wv[1];
        });
        const sx = [];
        const sy = [];
        lvl.forEach((v, i) => {
          sx.push(edges[i], edges[i + 1]);
          sy.push(v, v);
        });
        L.push({ type: 'line', x: sx, y: sy, color: 'tree', width: 2.4, label: 'лестница из ' + k + ' ступенек', hover: false });
        const stair = (p) => {
          const i = U.clamp(Math.floor(((p[0] + 4) / 8) * k), 0, k - 1);
          const above = p[1] >= lvl[i];
          return (wv[1] > 0 ? above : !above) ? 1 : 0;
        };
        errSt = HP.pts.filter((p, i) => stair(p) !== HP.lab[i]).length;
      }
      const q = s.q;
      const sd = dot(wv, q) - b;
      const foot = vsub(q, vscale(wv, sd));
      plot.render([
        ...L,
        { type: 'arrows', x1: [P0[0]], y1: [P0[1]], x2: [P0[0] + 1.2 * wv[0]], y2: [P0[1] + 1.2 * wv[1]], color: 'violet', width: 2.6 },
        { type: 'text', items: [{ x: P0[0] + 1.2 * wv[0], y: P0[1] + 1.2 * wv[1], dx: 6, dy: -6, text: 'w', bold: true, color: 'violet' }] },
        { type: 'points', x: HP.pts.map((p) => p[0]), y: HP.pts.map((p) => p[1]), color: (i) => (HP.lab[i] ? 'class1' : 'class0'), r: 5.5, highlight: new Set(HP.pts.map((p, i) => (side(p) !== HP.lab[i] ? i : -1)).filter((i) => i >= 0)) },
        { type: 'segments', x1: [q[0]], y1: [q[1]], x2: [foot[0]], y2: [foot[1]], color: 'ink2', width: 1.4, dash: '4 3', opacity: 1 },
        { type: 'points', x: [q[0]], y: [q[1]], color: 'ink', r: 6, shape: 'square', draggable: true, onDrag: (i, x, y) => ((s.q = [snap(x, 0.1), snap(y, 0.1)]), draw()) },
      ]);
      st.set('w', fv(wv, 3));
      st.set('e', errLine + ' из ' + HP.pts.length);
      st.set('s', errSt === null ? '—' : errSt + ' из ' + HP.pts.length);
      st.set('d', f3(sd));
      const axisOnly = Math.abs(wv[0]) < 1e-9 || Math.abs(wv[1]) < 1e-9;
      note.innerHTML = 'Точка ' + fv(q, 1) + ' на расстоянии ' + f3(Math.abs(sd)) + ' от прямой, ' + (sd >= 0 ? 'со стороны нормали (w·x > b).' : 'с обратной стороны (w·x < b).') + ' ' +
        (axisOnly ? '<b>Нормаль вдоль оси</b> — это разбиение дерева «x' + (Math.abs(wv[0]) > 0.5 ? '₁' : '₂') + ' ≤ порог»: одной осевой прямой классы разделить не удаётся (' + errLine + ' ' + plural(errLine, 'ошибка', 'ошибки', 'ошибок') + ').' : 'Косая прямая может разделить классы целиком. ') +
        (errSt !== null ? ' Лестница из ' + s.steps + ' ' + plural(s.steps, 'ступеньки', 'ступенек', 'ступенек') + ' (как дерево с ' + s.steps + ' листьями вдоль x₁) ошибается на ' + errSt + ' ' + plural(errSt, 'точке', 'точках', 'точках') + ': чем точнее граница, тем больше разбиений.' : '');
    }
    w.pythonAction(() => {
      const th = (s.ang * Math.PI) / 180;
      return PY_NP + 'pts = np.array(' + JSON.stringify(HP.pts) + ')\nlabels = (pts[:, 1] > 0.75 * pts[:, 0] + 0.2).astype(int)\n\nw = np.array([' + py(Math.cos(th)) + ', ' + py(Math.sin(th)) + '])\nb = ' + py(s.b) + '\nside = (pts @ w - b >= 0).astype(int)\nprint("ошибок у прямой:", (side != labels).sum())\nprint("знаковые расстояния:", ((pts @ w - b) / np.linalg.norm(w)).round(2))\n\n# дерево решений: осевые разбиения\nfrom sklearn.tree import DecisionTreeClassifier\nfor depth in (1, 2, 3, 4):\n    tree = DecisionTreeClassifier(max_depth=depth, random_state=0).fit(pts, labels)\n    print(f"дерево глубины {depth}: листьев {tree.get_n_leaves()}, ошибок {(tree.predict(pts) != labels).sum()}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 9. Матрица как таблица и умножение на вектор
   * ============================================================================== */
  GBC.widget('matvec', (el) => {
    const toy = GBC.datasets.toyRegression();
    const x = toy.x;
    const y = toy.y;
    const s = { b: -0.4, k: 1.83, i: 3 };
    const w = ui.shell(el, { title: 'Xw по строкам и по столбцам', sub: 'Матрица X — шесть квартир: столбец единиц (сдвиг) и площадь. Вектор весов w = (b, k). Таблица показывает умножение по строкам: каждый прогноз — скалярное произведение строки на w. График — по столбцам: каждый прогноз складывается из b·1 (бирюзовый) и k·x (фиолетовый).' });
    ui.slider(w.controls, { label: 'Сдвиг b', min: -3, max: 4, step: 0.05, value: s.b, format: f2, onInput: (v) => ((s.b = v), draw()) });
    ui.slider(w.controls, { label: 'Наклон k', min: -1, max: 3, step: 0.01, value: s.k, format: f2, onInput: (v) => ((s.k = v), draw()) });
    ui.slider(w.controls, { label: 'Строка i', min: 1, max: 6, step: 1, value: s.i, format: (v) => 'квартира ' + v, onInput: (v) => ((s.i = v), draw()) });
    const formula = H('div', { style: 'margin:2px 0 6px;overflow-x:auto;overflow-y:hidden' });
    w.main.appendChild(formula);
    const tbl = H('div');
    w.main.appendChild(tbl);
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'площадь x (десятки м²)', domain: [0.4, 6.6] }, y: { label: 'цена, млн' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'Xw' }, { key: 'xr', label: 'Xᵀr = Xᵀ(y − Xw)' }, { key: 'sse', label: '‖y − Xw‖²' }]);
    function draw() {
      const { b, k } = s;
      const pred = x.map((v) => b + k * v);
      const r = y.map((v, i) => v - pred[i]);
      const i = s.i - 1;
      rowTable(tbl, ['i', 'X: столбец 1', 'X: столбец 2 (x)', 'строка · w', '(Xw)ᵢ', 'yᵢ'], x.map((v, j) => [String(j + 1), '1', String(v), '1·' + f2(b) + ' + ' + v + '·' + f2(k), f3(pred[j]), String(y[j])]), (j) => j === i);
      texInto(formula, R`(Xw)_{${s.i}} = 1\cdot(${f2(b).replace('−', '-')}) + ${x[i]}\cdot ${f2(k).replace('−', '-')} = ${f3(pred[i]).replace('−', '-')}`, true);
      plot.render([
        { type: 'arrows', x1: x.map((v) => v - 0.06), y1: x.map(() => 0), x2: x.map((v) => v - 0.06), y2: x.map(() => b), color: 'aqua', width: 2.6, label: 'b·1' },
        { type: 'arrows', x1: x.map((v) => v + 0.06), y1: x.map(() => b), x2: x.map((v) => v + 0.06), y2: pred, color: 'violet', width: 2.6, label: 'k·x' },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'points', x, y, color: 'data', r: 5, label: 'цены y' },
        { type: 'points', x, y: pred, color: 'model', r: 5.5, hollow: true, label: 'прогнозы Xw', highlight: new Set([i]) },
      ], { y: yDom(pred.concat(y, [0, b]), 0.06) });
      const xr = [U.sum(r), U.sum(r.map((v, j) => v * x[j]))];
      st.set('p', fv(pred, 2));
      st.set('xr', fv(xr, 3));
      st.set('sse', f3(U.sum(r.map((v) => v * v))));
      note.innerHTML = 'Размеры: X — 6 × 2, w — длины 2, Xw — длины 6. Строка ' + s.i + ' таблицы — это объект «квартира ' + s.i + '», и её прогноз — скалярное произведение (1, ' + x[i] + ')·(b, k). Вектор Xᵀr = ' + fv(xr, 3) + ' — «признаки, умноженные на остатки»: ' +
        (Math.hypot(...xr) < 0.05 ? 'он почти нулевой — веса близки к МНК-оптимуму (шаг 18).' : 'его компоненты показывают, куда двигать b и k, чтобы уменьшить ошибку (градиент равен −2Xᵀr).');
    }
    w.pythonAction(() => PY_NP + 'x = np.arange(1, 7.0)\ny = np.array([2, 4, 3, 7, 9, 11.0])\nX = np.c_[np.ones(6), x]          # 6 × 2\nw = np.array([' + py(s.b) + ', ' + py(s.k) + '])\n\nprint("по строкам:", np.array([row @ w for row in X]))\nprint("по столбцам:", w[0] * X[:, 0] + w[1] * X[:, 1])\nprint("X @ w     :", X @ w)\nr = y - X @ w\nprint("Xᵀr =", X.T @ r)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 10. Матрица как преобразование плоскости
   * ============================================================================== */
  GBC.widget('matrix-transform', (el) => {
    const s = { m: [[1, 1], [0, 1]], t: 20 };
    const w = ui.shell(el, { title: 'Матрица — это преобразование плоскости', sub: 'Столбцы матрицы — куда попадают базисные векторы e₁ (синий) и e₂ (оранжевый); их концы можно тянуть. Серая сетка — до, синяя — после; фиолетовый квадрат 1 × 1 становится параллелограммом. Кнопка ▶ плавно превращает единичную матрицу в выбранную.' });
    ui.select(w.controls, { label: 'Готовые матрицы', value: 'shear', options: Object.entries(PRESETS2).map(([k, v]) => ({ value: k, label: v.label })), onChange: (k) => {
      s.m = PRESETS2[k].m.map((r) => r.slice());
      sync();
      draw();
    } });
    const names = [['a', 0, 0], ['b', 0, 1], ['c', 1, 0], ['d', 1, 1]];
    const sl = names.map(([nm, i, j]) => ui.slider(w.controls, { label: nm, min: -2, max: 2, step: 0.05, value: s.m[i][j], format: f2, onInput: (v) => ((s.m[i][j] = v), draw()) }));
    const pl = ui.player(w.controls, { label: 'Превращение I → A', min: 0, max: 20, value: 20, fps: 12, format: (v) => Math.round(v * 5) + ' %', onChange: (v) => ((s.t = v), draw()) });
    const sync = () => names.forEach(([, i, j], k) => sl[k].set(s.m[i][j]));
    const plot = new GBC.Plot(eqBox(w.main), { height: 370, equal: true, x: { label: 'x', domain: [-3.5, 3.5] }, y: { label: 'y', domain: [-3, 3] }, grid: 'none' });
    const mt = H('div', { style: 'margin-top:4px;overflow-x:auto;overflow-y:hidden' });
    w.main.appendChild(mt);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'матрица' }, { key: 'det', label: 'det = ad − bc' }, { key: 'e', label: 'Ae₁, Ae₂' }]);
    function draw() {
      const tt = s.t / 20;
      const M = s.m.map((r, i) => r.map((v, j) => (1 - tt) * (i === j ? 1 : 0) + tt * v));
      const T = (p) => matVec(M, p);
      const sq = [[0, 0], [1, 0], [1, 1], [0, 1]].map(T);
      const hs = HOUSE.map(T);
      const dt = det2(M);
      plot.render([
        { type: 'segments', ...gridSegs((p) => p, 3, -3, 3), color: 'grid', width: 1, opacity: 1 },
        { type: 'segments', ...gridSegs(T, 3, -3, 3), color: 'model', width: 1, opacity: 0.35 },
        polyLayer(sq, 'violet', 0.22, { stroke: 'violet', width: 2 }),
        { type: 'polygon', x: HOUSE.map((p) => p[0]), y: HOUSE.map((p) => p[1]), color: 'muted', fill: false, stroke: 'muted', width: 1.4, dash: '4 3', label: 'домик до' },
        { type: 'polygon', x: hs.map((p) => p[0]), y: hs.map((p) => p[1]), color: 'ink', opacity: 0.08, stroke: 'ink', width: 2.2, label: 'домик после' },
        { type: 'arrows', x1: [0], y1: [0], x2: [M[0][0]], y2: [M[1][0]], color: 'blue', width: 2.8 },
        { type: 'arrows', x1: [0], y1: [0], x2: [M[0][1]], y2: [M[1][1]], color: 'orange', width: 2.8 },
        { type: 'text', items: [{ x: M[0][0], y: M[1][0], dx: 7, dy: -6, text: 'Ae₁', bold: true }, { x: M[0][1], y: M[1][1], dx: 7, dy: -6, text: 'Ae₂', bold: true }] },
        s.t === 20 ? { type: 'points', x: [s.m[0][0], s.m[0][1]], y: [s.m[1][0], s.m[1][1]], color: (i) => (i ? 'orange' : 'blue'), r: 7, draggable: true, onDrag: (i, x, y) => {
          s.m[0][i] = U.clamp(snap(x, 0.05), -2, 2);
          s.m[1][i] = U.clamp(snap(y, 0.05), -2, 2);
          sync();
          draw();
        } } : null,
      ]);
      texInto(mt, 'A = ' + texMat(M, 2) + R`,\qquad \det A = ` + U.fmt(clean(dt), 3).replace('−', '-'), true);
      st.set('m', fm(M));
      st.set('det', f3(dt));
      st.set('e', fv([M[0][0], M[1][0]]) + ', ' + fv([M[0][1], M[1][1]]));
      note.innerHTML = 'Площадь параллелограмма = |det| = ' + f3(Math.abs(dt)) + ': во столько раз меняются все площади. ' +
        (Math.abs(dt) < 1e-9 ? '<b>det = 0:</b> плоскость сплющилась в прямую (или точку) — преобразование нельзя обратить.' : dt < 0 ? '<b>det &lt; 0:</b> ориентация перевернулась — домик отражён зеркально.' : 'det &gt; 0: ориентация сохранилась.') +
        ' Линии сетки остались прямыми и параллельными, начало координат — на месте: так выглядит любое линейное преобразование.';
    }
    w.pythonAction(() => PY_NP + 'A = np.array(' + JSON.stringify(s.m) + ')\nprint("Ae₁ =", A @ [1, 0], " Ae₂ =", A @ [0, 1], " (столбцы A)")\nprint("det A =", np.linalg.det(A))\nhouse = np.array(' + JSON.stringify(HOUSE) + ').T\nprint("домик после:\\n", (A @ house).T.round(3))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 11. Произведение матриц — композиция
   * ============================================================================== */
  GBC.widget('matrix-compose', (el) => {
    const s = { A: 'refl', B: 'rot90', order: 'AB', stage: 2 };
    const keys = ['rot90', 'rot30', 'stretch', 'shear', 'refl', 'proj', 'sym'];
    const w = ui.shell(el, { title: 'Произведение матриц: сначала одно, потом другое', sub: 'Выберите A и B. «AB» — сначала применить B, затем A (матрица произведения AB). «BA» — наоборот. Проигрыватель показывает этапы: исходный домик → после первого преобразования → после второго.' });
    ui.select(w.controls, { label: 'Матрица A', value: s.A, options: keys.map((k) => ({ value: k, label: PRESETS2[k].label })), onChange: (v) => ((s.A = v), draw()) });
    ui.select(w.controls, { label: 'Матрица B', value: s.B, options: keys.map((k) => ({ value: k, label: PRESETS2[k].label })), onChange: (v) => ((s.B = v), draw()) });
    ui.segmented(w.controls, { label: 'Порядок', value: s.order, options: [{ value: 'AB', label: 'AB: B, потом A' }, { value: 'BA', label: 'BA: A, потом B' }], onChange: (v) => ((s.order = v), draw()) });
    ui.player(w.controls, { label: 'Этап', min: 0, max: 2, value: 2, fps: 1, format: (v) => ['исходный', 'после первой', 'после обеих'][v], onChange: (v) => ((s.stage = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main), { height: 340, equal: true, x: { label: 'x', domain: [-3, 3] }, y: { label: 'y', domain: [-2.5, 2.5] } });
    const mt = H('div', { style: 'margin-top:4px;overflow-x:auto;overflow-y:hidden' });
    w.main.appendChild(mt);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ab', label: 'AB' }, { key: 'ba', label: 'BA' }, { key: 'eq', label: 'AB = BA?' }]);
    function draw() {
      const A = PRESETS2[s.A].m;
      const B = PRESETS2[s.B].m;
      const first = s.order === 'AB' ? B : A;
      const second = s.order === 'AB' ? A : B;
      const P = matMul(second, first);
      const h1 = HOUSE.map((p) => matVec(first, p));
      const h2 = HOUSE.map((p) => matVec(P, p));
      const poly = (pts, col, op, extra) => Object.assign({ type: 'polygon', x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), color: col, opacity: op }, extra);
      plot.render([
        poly(HOUSE, 'muted', 0.06, { stroke: 'muted', width: 1.4, dash: '4 3', label: 'исходный' }),
        s.stage >= 1 ? poly(h1, 'aqua', 0.12, { stroke: 'aqua', width: 1.8, label: 'после ' + (s.order === 'AB' ? 'B' : 'A') }) : null,
        s.stage >= 2 ? poly(h2, 'violet', 0.18, { stroke: 'violet', width: 2.4, label: 'после обеих: ' + s.order }) : null,
      ]);
      const AB = matMul(A, B);
      const BA = matMul(B, A);
      const same = AB.every((r, i) => r.every((v, j) => Math.abs(v - BA[i][j]) < 1e-9));
      texInto(mt, (s.order === 'AB' ? 'AB' : 'BA') + ' = ' + (s.order === 'AB' ? texMat(A, 3) + texMat(B, 3) : texMat(B, 3) + texMat(A, 3)) + ' = ' + texMat(P, 3), true);
      st.set('ab', fm(AB, 3));
      st.set('ba', fm(BA, 3));
      st.set('eq', same ? 'да' : 'нет');
      const e = P[0][0];
      note.innerHTML = 'Элемент (1, 1) произведения — первая строка левой матрицы на первый столбец правой: ' + f3(e) + '. ' +
        (same ? 'Для этой пары порядок не важен (так бывает, например, у двух поворотов или двух растяжений вдоль осей).' : '<b>Порядок важен:</b> AB ≠ BA — фиолетовый домик при другом порядке окажется в другом месте.');
    }
    w.pythonAction(() => PY_NP + 'A = np.array(' + JSON.stringify(PRESETS2[s.A].m) + ')\nB = np.array(' + JSON.stringify(PRESETS2[s.B].m) + ')\nprint("AB =\\n", A @ B)\nprint("BA =\\n", B @ A)\nprint("AB == BA:", np.allclose(A @ B, B @ A))\nv = np.array([1.0, 0.5])\nprint("A(Bv) =", A @ (B @ v), " (AB)v =", (A @ B) @ v)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 12. Определитель
   * ============================================================================== */
  GBC.widget('determinant', (el) => {
    const s = { u: [3, 2], v: [1, 4] };
    const w = ui.shell(el, { title: 'Определитель — площадь параллелограмма со знаком', sub: 'Столбцы матрицы u = (a, c) и v = (b, d) натягивают параллелограмм. Его площадь — |ad − bc|. Если повернуть v «по часовой» от u, знак станет отрицательным; если u и v лягут на одну прямую — ноль. Тяните концы векторов; точки сетки помогают считать площадь.' });
    ui.select(w.controls, { label: 'Примеры', value: 'ex', options: [{ value: 'ex', label: '(3, 2), (1, 4): det = 10' }, { value: 'rot', label: 'поворот на 30°: det = 1' }, { value: 'shear', label: 'сдвиг: det = 1' }, { value: 'refl', label: 'отражение: det = −1' }, { value: 'dep', label: '(2, 1), (4, 2): det = 0' }], onChange: (k) => {
      const E = { ex: [[3, 2], [1, 4]], rot: [[0.866, 0.5], [-0.5, 0.866]], shear: [[1, 0], [1, 1]], refl: [[-1, 0], [0, 1]], dep: [[2, 1], [4, 2]] }[k];
      s.u = E[0];
      s.v = E[1];
      draw();
    } });
    const plot = new GBC.Plot(eqBox(w.main), { height: 360, equal: true, x: { label: 'x', domain: [-4.5, 5.5] }, y: { label: 'y', domain: [-3, 6.5] } });
    const mt = H('div', { style: 'margin-top:4px;overflow-x:auto;overflow-y:hidden' });
    w.main.appendChild(mt);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'det = ad − bc' }, { key: 'a', label: 'площадь' }, { key: 'o', label: 'ориентация' }]);
    function draw() {
      const { u, v } = s;
      const dt = u[0] * v[1] - v[0] * u[1];
      const par = [[0, 0], u, vadd(u, v), v];
      const lat = { x: [], y: [] };
      for (let i = -4; i <= 5; i++) for (let j = -3; j <= 6; j++) (lat.x.push(i), lat.y.push(j));
      plot.render([
        { type: 'points', x: lat.x, y: lat.y, color: 'grid', r: 1.8 },
        polyLayer([[0, 0], [1, 0], [1, 1], [0, 1]], 'muted', 0.18, { stroke: 'muted', width: 1, dash: '3 3' }),
        polyLayer(par, Math.abs(dt) < 1e-9 ? 'critical' : dt > 0 ? 'model' : 'tree', 0.22, { stroke: Math.abs(dt) < 1e-9 ? 'critical' : dt > 0 ? 'model' : 'tree', width: 2 }),
        { type: 'arrows', x1: [0], y1: [0], x2: [u[0]], y2: [u[1]], color: 'blue', width: 2.8 },
        { type: 'arrows', x1: [0], y1: [0], x2: [v[0]], y2: [v[1]], color: 'orange', width: 2.8 },
        { type: 'text', items: [{ x: u[0], y: u[1], dx: 7, dy: -6, text: 'u = Ae₁', bold: true }, { x: v[0], y: v[1], dx: 7, dy: -6, text: 'v = Ae₂', bold: true }] },
        { type: 'points', x: [u[0], v[0]], y: [u[1], v[1]], color: (i) => (i ? 'orange' : 'blue'), r: 7, draggable: true, onDrag: (i, x, y) => ((i ? (s.v = [snap(x, 0.5), snap(y, 0.5)]) : (s.u = [snap(x, 0.5), snap(y, 0.5)])), draw()) },
      ]);
      const n = (x) => U.fmt(clean(x), 3).replace('−', '-');
      texInto(mt, R`\det\begin{pmatrix} ${n(u[0])} & ${n(v[0])} \\ ${n(u[1])} & ${n(v[1])}\end{pmatrix} = ${n(u[0])}\cdot ${n(v[1])} - ${n(v[0])}\cdot ${n(u[1])} = ${n(dt)}`, true);
      st.set('d', f3(dt));
      st.set('a', f3(Math.abs(dt)));
      st.set('o', Math.abs(dt) < 1e-9 ? 'вырождено' : dt > 0 ? 'сохраняется' : 'обращается');
      note.innerHTML = Math.abs(dt) < 1e-9
        ? '<b>det = 0:</b> u и v на одной прямой — параллелограмм сплющен, площадь ноль. Столбцы зависимы, обратной матрицы нет.'
        : 'Единичный квадрат (серый) превращается в параллелограмм площади ' + f3(Math.abs(dt)) + (dt > 0 ? '; поворот от u к v — против часовой стрелки, ориентация сохраняется.' : '; от u к v — по часовой: преобразование «переворачивает» плоскость, как зеркало.') + ' Для матрицы 3 × 3 определитель — объём параллелепипеда со знаком.';
    }
    w.pythonAction(() => PY_NP + 'A = np.c_[[' + s.u.map(py).join(', ') + '], [' + s.v.map(py).join(', ') + ']]   # столбцы u и v\nprint("det A =", np.linalg.det(A))\n\nB = np.array([[2, 1, 0], [1, 3, 1], [0, 1, 2.0]])\nprint("det 3×3 =", np.linalg.det(B))\nprint("det(AB) = det A · det B:", np.isclose(np.linalg.det(A @ A), np.linalg.det(A) ** 2))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 13. Обратная матрица
   * ============================================================================== */
  GBC.widget('inverse', (el) => {
    const s = { m: [[2, 1], [1, 2]], stage: 2 };
    const w = ui.shell(el, { title: 'Обратная матрица отменяет преобразование', sub: 'Домик сначала преобразуется матрицей A (синий), затем A⁻¹ возвращает его на место (оранжевый пунктир совпадает с исходным). Подвигайте d: когда det A приближается к нулю, элементы A⁻¹ стремительно растут.' });
    ui.select(w.controls, { label: 'Матрица A', value: 'sym', options: [{ value: 'sym', label: '[[2, 1], [1, 2]]' }, { value: 'rot', label: 'поворот на 30°' }, { value: 'stretch', label: 'diag(2, 0.5)' }, { value: 'shear', label: 'сдвиг' }, { value: 'near', label: '[[1, 1], [1, 1.05]]' }], onChange: (k) => {
      s.m = { sym: [[2, 1], [1, 2]], rot: [[0.866, -0.5], [0.5, 0.866]], stretch: [[2, 0], [0, 0.5]], shear: [[1, 1], [0, 1]], near: [[1, 1], [1, 1.05]] }[k].map((r) => r.slice());
      sd.set(s.m[1][1]);
      draw();
    } });
    const sd = ui.slider(w.controls, { label: 'd (правый нижний)', min: 0, max: 3, step: 0.01, value: s.m[1][1], format: f2, onInput: (v) => ((s.m[1][1] = v), draw()) });
    ui.player(w.controls, { label: 'Этап', min: 0, max: 2, value: 2, fps: 1, format: (v) => ['исходный', 'после A', 'после A⁻¹·A'][v], onChange: (v) => ((s.stage = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main), { height: 320, equal: true, x: { label: 'x', domain: [-3, 4] }, y: { label: 'y', domain: [-2, 4] } });
    const mt = H('div', { style: 'margin-top:4px;overflow-x:auto;overflow-y:hidden' });
    w.main.appendChild(mt);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'det', label: 'det A' }, { key: 'inv', label: 'A⁻¹' }, { key: 'mx', label: 'max |элемент A⁻¹|' }]);
    function draw() {
      const A = s.m;
      const dt = det2(A);
      const Ai = Math.abs(dt) > 1e-9 ? [[A[1][1] / dt, -A[0][1] / dt], [-A[1][0] / dt, A[0][0] / dt]] : null;
      const h1 = HOUSE.map((p) => matVec(A, p));
      const h2 = Ai ? h1.map((p) => matVec(Ai, p)) : null;
      const poly = (pts, col, op, extra) => Object.assign({ type: 'polygon', x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), color: col, opacity: op }, extra);
      plot.render([
        poly(HOUSE, 'muted', 0.08, { stroke: 'muted', width: 1.4, label: 'исходный' }),
        s.stage >= 1 ? poly(h1, 'model', 0.16, { stroke: 'model', width: 2, label: 'после A' }) : null,
        s.stage >= 2 && h2 ? poly(h2, 'tree', 0.0, { stroke: 'tree', width: 2.4, dash: '5 4', label: 'после A⁻¹·A' }) : null,
      ]);
      const n = (x) => U.fmt(clean(x), 3).replace('−', '-');
      texInto(mt, Ai ? R`A^{-1} = \frac{1}{${n(dt)}}\begin{pmatrix} ${n(A[1][1])} & ${n(-A[0][1])} \\ ${n(-A[1][0])} & ${n(A[0][0])}\end{pmatrix} = ` + texMat(Ai, 3) : R`\det A = 0:\ A^{-1}\ \text{не существует}`, true);
      st.set('det', f3(dt));
      st.set('inv', Ai ? fm(Ai, 3) : 'нет');
      st.set('mx', Ai ? f3(Math.max(...Ai.flat().map(Math.abs))) : '∞');
      note.innerHTML = !Ai
        ? '<b>det A = 0</b> — плоскость сплющена, и по результату нельзя восстановить исходную точку: обратной матрицы нет.'
        : Math.abs(dt) < 0.2
          ? '<b>Почти вырожденная матрица:</b> det = ' + f3(dt) + ', элементы A⁻¹ порядка ' + f1(Math.max(...Ai.flat().map(Math.abs))) + '. Чтобы «раздуть» почти сплющенный домик обратно, нужно огромное растяжение — и любые ошибки во входе растянутся так же (шаг 15).'
          : 'A⁻¹·A = I: оранжевый пунктир совпал с исходным домиком. Рецепт для 2 × 2: поменять местами a и d, сменить знаки b и c, разделить на det.';
    }
    w.pythonAction(() => PY_NP + 'A = np.array(' + JSON.stringify(s.m) + ')\nprint("det A =", np.linalg.det(A))\nif abs(np.linalg.det(A)) > 1e-12:\n    Ai = np.linalg.inv(A)\n    print("A⁻¹ =\\n", Ai)\n    print("A⁻¹A = I:", np.allclose(Ai @ A, np.eye(2)))\n    print("решение A·w = (3, 3):", np.linalg.solve(A, [3, 3.0]))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 14. Системы уравнений: две картинки и метод Гаусса
   * ============================================================================== */
  GBC.widget('linear-system', (el) => {
    const s = { a1: 1, b1: 1, c1: 4, a2: 1, b2: -1, c2: 0, view: 'rows' };
    const w = ui.shell(el, { title: 'Система уравнений: картинка строк и картинка столбцов', sub: 'Уравнения a₁x + b₁y = c₁ и a₂x + b₂y = c₂. По строкам — две прямые, решение в их пересечении. По столбцам — подобрать x и y так, чтобы x·(a₁, a₂) + y·(b₁, b₂) дало вектор правой части c.' });
    ui.segmented(w.controls, { label: 'Картинка', value: s.view, options: [{ value: 'rows', label: 'строки' }, { value: 'cols', label: 'столбцы' }], onChange: (v) => ((s.view = v), draw()) });
    const keys = [['a1', 'a₁'], ['b1', 'b₁'], ['c1', 'c₁'], ['a2', 'a₂'], ['b2', 'b₂'], ['c2', 'c₂']];
    keys.forEach(([k, lab]) => ui.slider(w.controls, { label: lab, min: -4, max: 4, step: 0.5, value: s[k], format: f1, onInput: (v) => ((s[k] = v), draw()) }));
    const plot = new GBC.Plot(eqBox(w.main), { height: 340, equal: true, x: { label: 'x', domain: [-5, 5] }, y: { label: 'y', domain: [-4, 6] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'e1', label: 'уравнение 1' }, { key: 'e2', label: 'уравнение 2' }, { key: 'det', label: 'det A' }, { key: 'sol', label: 'решение' }]);
    const lineXY = (a, b, c) => {
      if (Math.abs(b) > 1e-9) return { x: [-9, 9], y: [(c + 9 * a) / b, (c - 9 * a) / b] };
      if (Math.abs(a) > 1e-9) return { x: [c / a, c / a], y: [-9, 9] };
      return { x: [], y: [] };
    };
    function draw() {
      const { a1, b1, c1, a2, b2, c2 } = s;
      const dt = a1 * b2 - a2 * b1;
      const has = Math.abs(dt) > 1e-9;
      const x = has ? (c1 * b2 - c2 * b1) / dt : NaN;
      const y = has ? (a1 * c2 - a2 * c1) / dt : NaN;
      if (s.view === 'rows') {
        plot.render([
          { type: 'line', ...lineXY(a1, b1, c1), color: 'blue', width: 2.4, label: 'уравнение 1', hover: false },
          { type: 'line', ...lineXY(a2, b2, c2), color: 'orange', width: 2.4, label: 'уравнение 2', hover: false },
          has ? { type: 'points', x: [x], y: [y], color: 'ink', r: 7, label: 'решение' } : null,
        ]);
      } else {
        const A1 = [a1, a2];
        const A2 = [b1, b2];
        const L = [
          { type: 'arrows', x1: [0], y1: [0], x2: [A1[0]], y2: [A1[1]], color: 'blue', width: 2.6, label: 'столбец 1' },
          { type: 'arrows', x1: [0], y1: [0], x2: [A2[0]], y2: [A2[1]], color: 'orange', width: 2.6, label: 'столбец 2' },
          { type: 'points', x: [c1], y: [c2], color: 'ink', r: 7, label: 'правая часть c' },
        ];
        if (has) {
          const P = vscale(A1, x);
          L.unshift({ type: 'arrows', x1: [0], y1: [0], x2: [P[0]], y2: [P[1]], color: 'blue', width: 1.8, opacity: 0.45 });
          L.unshift({ type: 'arrows', x1: [P[0]], y1: [P[1]], x2: [c1], y2: [c2], color: 'orange', width: 1.8, opacity: 0.45 });
        }
        plot.render(L);
      }
      const eq = (a, b, c) => f1(a) + 'x ' + (b < 0 ? '− ' : '+ ') + f1(Math.abs(b)) + 'y = ' + f1(c);
      st.set('e1', eq(a1, b1, c1));
      st.set('e2', eq(a2, b2, c2));
      st.set('det', f3(dt));
      st.set('sol', has ? '(' + f3(x) + ', ' + f3(y) + ')' : 'нет единственного');
      let msg;
      if (has) msg = s.view === 'rows' ? 'Прямые пересекаются в одной точке (' + f3(x) + ', ' + f3(y) + ').' : 'Чтобы попасть в c, нужно ' + f3(x) + ' шагов по первому столбцу и ' + f3(y) + ' по второму (бледные стрелки).';
      else {
        const consistent = Math.abs(a1 * c2 - a2 * c1) < 1e-9 && Math.abs(b1 * c2 - b2 * c1) < 1e-9;
        msg = '<b>det A = 0:</b> ' + (s.view === 'rows' ? (consistent ? 'прямые совпадают — решений бесконечно много.' : 'прямые параллельны — решений нет.') : 'столбцы на одной прямой, их комбинации не покидают её; ' + (consistent ? 'c на ней — решений бесконечно много.' : 'c вне её — решений нет.'));
      }
      note.innerHTML = msg + ' Обе картинки — одна система: строки дают пересечение прямых, столбцы — комбинацию векторов.';
    }
    w.pythonAction(() => PY_NP + 'A = np.array([[' + py(s.a1) + ', ' + py(s.b1) + '], [' + py(s.a2) + ', ' + py(s.b2) + ']])\nc = np.array([' + py(s.c1) + ', ' + py(s.c2) + '])\nprint("det A =", np.linalg.det(A))\nif abs(np.linalg.det(A)) > 1e-12:\n    w = np.linalg.solve(A, c)\n    print("решение:", w, " проверка по столбцам:", w[0] * A[:, 0] + w[1] * A[:, 1])\nelse:\n    print("ранг A:", np.linalg.matrix_rank(A), " ранг [A | c]:", np.linalg.matrix_rank(np.c_[A, c]))\n');
    draw();
  });

  const GAUSS = {
    unique: { label: 'одно решение', rows: [[1, 1, 1, 6], [2, 1, -1, 1], [1, -1, 2, 5]] },
    none: { label: 'нет решений', rows: [[1, 1, 1, 6], [2, 2, 2, 10], [1, -1, 0, 0]] },
    many: { label: 'бесконечно много', rows: [[1, 1, 1, 6], [2, 1, -1, 1], [3, 2, 0, 7]] },
  };
  /** Шаги метода Гаусса: [{M, text, hl: [строки], piv: [r, c]}]. */
  function gaussSteps(rows0) {
    const M = rows0.map((r) => r.slice());
    const out = [{ M: M.map((r) => r.slice()), text: 'Расширенная матрица [A | c]: коэффициенты и правые части.', hl: [], piv: null }];
    const n = 3;
    let r = 0;
    const pivCols = [];
    for (let c = 0; c < n && r < n; c++) {
      let p = r;
      while (p < n && Math.abs(M[p][c]) < 1e-12) p++;
      if (p === n) continue;
      if (p !== r) {
        [M[r], M[p]] = [M[p], M[r]];
        out.push({ M: M.map((x) => x.slice()), text: 'Меняем местами строки ' + (r + 1) + ' и ' + (p + 1) + ': в столбце ' + (c + 1) + ' нужен ненулевой ведущий элемент.', hl: [r, p], piv: [r, c] });
      }
      for (let i = r + 1; i < n; i++) {
        const f = M[i][c] / M[r][c];
        if (Math.abs(f) < 1e-12) continue;
        for (let k = c; k <= n; k++) M[i][k] -= f * M[r][k];
        out.push({ M: M.map((x) => x.slice().map(clean)), text: 'Из строки ' + (i + 1) + ' вычитаем строку ' + (r + 1) + ', умноженную на ' + f3(f) + ': в столбце ' + (c + 1) + ' под ведущим элементом появляется ноль.', hl: [i], piv: [r, c] });
      }
      pivCols.push(c);
      r++;
    }
    // итог
    const zeroRow = M.findIndex((row) => row.slice(0, n).every((v) => Math.abs(v) < 1e-12));
    if (zeroRow >= 0 && Math.abs(M[zeroRow][n]) > 1e-12) {
      out.push({ M: M.map((x) => x.slice()), text: 'Строка ' + (zeroRow + 1) + ' читается как 0 = ' + f3(M[zeroRow][n]) + ' — противоречие. Решений нет: плоскости не имеют общей точки.', hl: [zeroRow], piv: null, verdict: 'none' });
    } else if (pivCols.length < n) {
      out.push({ M: M.map((x) => x.slice()), text: 'Строка ' + (zeroRow + 1) + ' превратилась в 0 = 0 — уравнение оказалось следствием других. Неизвестная z свободна: z = t. Обратный ход: y = 11 − 3t, x = 2t − 5. Решения — прямая в пространстве.', hl: [zeroRow], piv: null, verdict: 'many' });
    } else {
      const x = new Array(n).fill(0);
      for (let i = n - 1; i >= 0; i--) {
        let sm = M[i][n];
        for (let k = i + 1; k < n; k++) sm -= M[i][k] * x[k];
        x[i] = sm / M[i][i];
      }
      out.push({ M: M.map((q) => q.slice()), text: 'Треугольный вид получен. Обратный ход: из третьей строки z = ' + f3(M[2][3]) + ' / ' + f3(M[2][2]) + ' = ' + f3(x[2]) + '; из второй y = ' + f3(x[1]) + '; из первой x = ' + f3(x[0]) + '.', hl: [0, 1, 2], piv: null, verdict: 'unique', sol: x });
    }
    return out;
  }
  GBC.widget('gauss', (el) => {
    const s = { key: 'unique', k: 0 };
    const w = ui.shell(el, { title: 'Метод Гаусса по шагам', sub: 'Элементарные операции со строками приводят систему к треугольному виду; затем неизвестные находятся с конца. Подсвечена строка, изменённая на этом шаге; рамкой — ведущий элемент.', foot: false });
    ui.select(w.controls, { label: 'Система', value: s.key, options: Object.entries(GAUSS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.key = v;
      steps = gaussSteps(GAUSS[v].rows);
      pl.setMax(steps.length - 1);
      s.k = 0;
      pl.set(0);
      draw();
    } });
    let steps = gaussSteps(GAUSS[s.key].rows);
    const pl = ui.player(w.controls, { label: 'Шаг', min: 0, max: steps.length - 1, value: 0, fps: 0.8, format: (v, m) => 'шаг ' + v + ' из ' + m, onChange: (v) => ((s.k = v), draw()) });
    const sys = H('div', { style: 'margin:2px 0 8px' });
    const box = H('div', { class: 'table-wrap' });
    w.main.append(sys, box);
    const note = w.note('', true);
    function draw() {
      const S = steps[Math.min(s.k, steps.length - 1)];
      const rows = GAUSS[s.key].rows;
      const term = (c, v, first) => (Math.abs(c) < 1e-12 ? '' : (c < 0 ? ' - ' : first ? '' : ' + ') + (Math.abs(c) === 1 ? '' : U.fmt(Math.abs(c), 3)) + v);
      texInto(sys, R`\begin{cases}` + rows.map((r) => {
        let t = '';
        let first = true;
        ['x', 'y', 'z'].forEach((v, j) => {
          const s1 = term(r[j], v, first);
          if (s1) first = false;
          t += s1;
        });
        return t + ' = ' + String(r[3]).replace('-', '-');
      }).join(R` \\ `) + R`\end{cases}`);
      box.textContent = '';
      const t = H('table', { class: 'data' });
      t.appendChild(H('thead', null, H('tr', null, ['', 'x', 'y', 'z', '| c'].map((c) => H('th', { class: 'num' }, c)))));
      const tb = H('tbody');
      S.M.forEach((r, i) => {
        const tr = H('tr', { class: S.hl.includes(i) ? 'hl' : null });
        tr.appendChild(H('td', { class: 'num' }, 'R' + (i + 1)));
        r.forEach((v, j) => {
          const isPiv = S.piv && S.piv[0] === i && S.piv[1] === j;
          tr.appendChild(H('td', { class: 'num', style: (j === 3 ? 'border-left:2px solid var(--border);' : '') + (isPiv ? 'outline:2px solid var(--accent);outline-offset:-3px;font-weight:700' : '') }, U.fmt(clean(v), 3)));
        });
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      box.appendChild(t);
      note.innerHTML = '<b>Шаг ' + s.k + '.</b> ' + S.text + (S.verdict === 'unique' ? ' Проверка: (1, 2, 3) удовлетворяет всем трём уравнениям.' : '');
    }
    w.pythonAction(() => PY_NP + 'M = np.array(' + JSON.stringify(GAUSS[s.key].rows) + ', dtype=float)   # [A | c]\nA, c = M[:, :3], M[:, 3]\nprint("ранг A =", np.linalg.matrix_rank(A), " ранг [A | c] =", np.linalg.matrix_rank(M))\nif np.linalg.matrix_rank(A) == 3:\n    print("решение:", np.linalg.solve(A, c))\nelse:\n    w, *_ = np.linalg.lstsq(A, c, rcond=None)\n    print("одно из решений (кратчайшее):", w.round(4), " невязка:", np.linalg.norm(A @ w - c).round(6))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 15. Почти вырожденная система
   * ============================================================================== */
  GBC.widget('near-singular', (el) => {
    const s = { eps: 0.1, delta: 0 };
    const w = ui.shell(el, { title: 'Плохая обусловленность: маленькая ошибка — большой сдвиг решения', sub: 'Система x + y = 2, x + (1 + ε)y = 2 + ε + δ. При δ = 0 решение (1, 1). Чем меньше ε, тем ближе прямые к параллельным. Добавьте «ошибку измерения» δ в правую часть и посмотрите, куда уедет решение. Полоса — где может оказаться вторая прямая при |δ| ≤ 0.01.' });
    ui.slider(w.controls, { label: 'ε (различие прямых)', min: 0.001, max: 1, log: true, value: s.eps, format: (v) => sci(v), onInput: (v) => ((s.eps = v), draw()) });
    ui.slider(w.controls, { label: 'Ошибка δ', min: -0.01, max: 0.01, step: 0.0005, value: s.delta, format: (v) => U.fmt(v, 4), onInput: (v) => ((s.delta = v), draw()) });
    const plot = new GBC.Plot(eqBox(w.main), { height: 320, equal: true, x: { label: 'x', domain: [-2, 4] }, y: { label: 'y', domain: [-1, 3] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'k', label: 'κ(A)' }, { key: 'det', label: 'det A' }, { key: 'sol', label: 'решение' }, { key: 'amp', label: 'усиление ошибки' }]);
    function draw() {
      const e = s.eps;
      const A = [[1, 1], [1, 1 + e]];
      const c = [2, 2 + e + s.delta];
      const sol = solve(A, c);
      const k = cond(A);
      const ln = (cc) => ({ x: [-9, 9], y: [(cc - -9) / (1 + e), (cc - 9) / (1 + e)] });
      const band = [[-9, (2 + e - 0.01 + 9) / (1 + e)], [9, (2 + e - 0.01 - 9) / (1 + e)], [9, (2 + e + 0.01 - 9) / (1 + e)], [-9, (2 + e + 0.01 + 9) / (1 + e)]];
      plot.render([
        polyLayer(band, 'orange', 0.18),
        { type: 'line', x: [-9, 9], y: [11, -7], color: 'blue', width: 2.2, label: 'x + y = 2', hover: false },
        { type: 'line', ...ln(c[1]), color: 'orange', width: 2.2, label: 'x + (1 + ε)y = 2 + ε + δ', hover: false },
        { type: 'points', x: [1], y: [1], color: 'ink2', r: 7, hollow: true, label: 'решение при δ = 0' },
        sol ? { type: 'points', x: [sol[0]], y: [sol[1]], color: 'ink', r: 6, label: 'решение с ошибкой' } : null,
      ]);
      const relIn = Math.abs(s.delta) / Math.hypot(...c);
      const relOut = sol ? Math.hypot(sol[0] - 1, sol[1] - 1) / Math.SQRT2 : NaN;
      st.set('k', sci(k));
      st.set('det', sci(det2(A)));
      st.set('sol', sol ? fv(sol, 3) : '—');
      st.set('amp', s.delta ? '×' + U.fmt(relOut / relIn, 3) : '—');
      note.innerHTML = 'Решение уезжает вдоль прямых на δ/ε = ' + f3(s.delta / e) + ' по y. ' + (s.delta ? 'Относительная ошибка входа ' + sci(relIn) + ' превратилась в ' + sci(relOut) + ' на выходе — в ' + U.fmt(relOut / relIn, 3) + ' раз (не больше κ = ' + sci(k) + ').' : 'Подвигайте δ.') +
        (k > 1000 ? ' <b>κ ≈ ' + sci(k) + ':</b> теряется около ' + Math.round(Math.log10(k)) + ' значащих цифр — так ведут себя почти дублирующие друг друга признаки.' : '');
    }
    w.pythonAction(() => PY_NP + 'eps, delta = ' + py(s.eps) + ', ' + py(s.delta) + '\nA = np.array([[1, 1], [1, 1 + eps]])\nfor d in (0, delta):\n    print(f"δ = {d}: решение", np.linalg.solve(A, [2, 2 + eps + d]))\nprint("κ(A) =", np.linalg.cond(A), " det =", np.linalg.det(A))\n');
    draw();
  });

  /* ==============================================================================
   * Общие помощники для части 2
   * ============================================================================== */
  GBC.lesson1512 = {
    f1, f2, f3, f4, py, sci, sup, powFmt, decades, yDom, fv, fm, snap, clean,
    texInto, texEl, card, cardGrid, badge, rowTable, stepList, plural, onTheme, eqBox, texMat, texVec,
    dot, norm, vadd, vsub, vscale, transpose, matVec, matMul, eye, det2, solve, inv, det, symEig, svd, cond, rank, eig2,
    rightAngle, clipHalf, boxPoly, polyLayer, gridSegs, HOUSE, PRESETS2, PY_NP,
    Scene3D, axes3, rightAngle3, unit,
  };
})();
