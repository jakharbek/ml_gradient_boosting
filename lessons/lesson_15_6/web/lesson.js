/* Урок 15.6: правила дифференцирования. Часть 1 — производные «атомов» и правила-операции.
 * Виджеты: дерево выражения, площадь квадрата и прямоугольника, лаборатория степени, число e,
 * единичная окружность (sin′ = cos), правило суммы, произведение и частное, цепочка «шестерёнок»,
 * f(ax + b), логарифмическое дифференцирование, неявные кривые, склейки кусочных функций.
 * Общие помощники выставлены в GBC.lesson156 — ими пользуется lesson_extra.js (часть 2). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const R = String.raw;

  /* ==============================================================================
   * Общие помощники урока
   * ============================================================================== */
  /** Табуляция функции для слоя 'line': NaN там, где функции нет или она слишком велика; разрывы на скачках. */
  function curve(fn, x0, x1, n = 801, o = {}) {
    const x = [];
    const y = [];
    let prev = NaN;
    const xs = o.xs || U.linspace(x0, x1, n);
    for (const t of xs) {
      let r = fn(t);
      if (!Number.isFinite(r) || (o.cap !== undefined && Math.abs(r) > o.cap)) r = NaN;
      if (o.jump !== undefined && Number.isFinite(prev) && Number.isFinite(r) && Math.abs(r - prev) > o.jump) {
        x.push(t);
        y.push(NaN);
      }
      x.push(t);
      y.push(r);
      prev = r;
    }
    return { x, y };
  }
  /** Формула KaTeX в элементе; если KaTeX ещё грузится — перерисуем по событию mathready. */
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
  function card(title, plain = false) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums;overflow-x:auto;overflow-y:hidden' });
    const head = plain ? 'font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px' : 'font-size:.78rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:6px';
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' },
      H('div', { style: head }, title), body);
    return { el, body };
  }
  const cardGrid = (min = 200) => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(' + min + 'px,1fr));gap:10px;margin:4px 0 10px' });
  /** Плашка-вердикт: kind = good | bad | neutral. */
  function badge(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;' + st }, text);
  }
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  /** Числовая производная (центральная разность). */
  const nd = (f, x, h = 1e-6) => (f(x + h) - f(x - h)) / (2 * h);
  const sigma = (z) => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));
  const STARS = ['', '★', '★★', '★★★'];
  const f3 = (v) => U.fmt(v, 3);
  /** Число в произведении: отрицательные — в скобках. */
  const P = (v) => (v < 0 ? '(' + f3(v) + ')' : f3(v));
  /** Диапазон по y по значениям функций (с полями); cap обрезает выбросы. */
  function yRange(fns, xs, pad = 0.12, cap = Infinity) {
    const ys = [];
    for (const fn of [].concat(fns)) for (const x of xs) {
      const v = fn(x);
      if (Number.isFinite(v) && Math.abs(v) <= cap) ys.push(v);
    }
    if (!ys.length) return [-1, 1];
    const [lo, hi] = U.extent(ys);
    const d = (hi - lo) * pad || 1;
    return [lo - d, hi + d];
  }
  /** Отрезок касательной к f в точке a: длина по x — 2·half. */
  function tanSeg(f, df, a, half) {
    const s = df(a);
    return { x1: [a - half], y1: [f(a) - half * s], x2: [a + half], y2: [f(a) + half * s] };
  }
  const SUPD = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (k) => String(k).split('').map((c) => SUPD[c] || c).join('');

  /** Python: дуальные числа — производная едет вместе со значением (используется в нескольких виджетах). */
  const PY_DUAL = [
    'import math',
    '',
    'class D:',
    '    """Дуальное число: значение v и производная d по x."""',
    '    def __init__(self, v, d=0.0): self.v, self.d = v, d',
    '    def _w(o): return o if isinstance(o, D) else D(o)',
    '    def __add__(a, b): b = D._w(b); return D(a.v + b.v, a.d + b.d)',
    '    def __sub__(a, b): b = D._w(b); return D(a.v - b.v, a.d - b.d)',
    '    def __mul__(a, b): b = D._w(b); return D(a.v * b.v, a.d * b.v + a.v * b.d)            # (uv)′ = u′v + uv′',
    '    def __truediv__(a, b): b = D._w(b); return D(a.v / b.v, (a.d * b.v - a.v * b.d) / b.v**2)  # (u/v)′',
    '    def __pow__(a, k): return D(a.v**k, k * a.v**(k - 1) * a.d)                       # (uᵏ)′ = k·uᵏ⁻¹·u′',
    '    def __neg__(a): return D(-a.v, -a.d)',
    '    __radd__ = __add__',
    '    __rmul__ = __mul__',
    '    def __rsub__(a, b): return D._w(b) - a',
    '    def __rtruediv__(a, b): return D._w(b) / a',
    '',
    'def exp(a): return D(math.exp(a.v), math.exp(a.v) * a.d)      # (eᵘ)′ = eᵘ·u′',
    'def log(a): return D(math.log(a.v), a.d / a.v)                # (ln u)′ = u′/u',
    'def sin(a): return D(math.sin(a.v), math.cos(a.v) * a.d)',
    'def cos(a): return D(math.cos(a.v), -math.sin(a.v) * a.d)',
    'def sqrt(a): return D(math.sqrt(a.v), a.d / (2 * math.sqrt(a.v)))',
    '',
  ].join('\n');

  /* ------------------------------------------------------------------------------
   * Дерево выражения: узлы, правила, прямой проход «значение + производная».
   * ------------------------------------------------------------------------------ */
  const X = () => ({ op: 'x' });
  const C = (k) => ({ op: 'c', k });
  const op2 = (op) => (a, b) => ({ op, a: [a, b] });
  const op1 = (op) => (a) => ({ op, a: [a] });
  const ADD = op2('add');
  const SUB = op2('sub');
  const MUL = op2('mul');
  const DIV = op2('div');
  const POW = (a, k) => ({ op: 'pow', a: [a], k });
  const EXP = op1('exp');
  const LN = op1('ln');
  const SIN = op1('sin');
  const COS = op1('cos');
  const SQRT = op1('sqrt');
  const NEG = op1('neg');
  const RULE = {
    x: 'x′ = 1', c: 'c′ = 0', add: '(u + v)′ = u′ + v′', sub: '(u − v)′ = u′ − v′', mul: '(uv)′ = u′v + uv′',
    div: '(u/v)′ = (u′v − uv′)/v²', neg: '(−u)′ = −u′', pow: '(uᵏ)′ = k·uᵏ⁻¹·u′', exp: '(eᵘ)′ = eᵘ·u′',
    ln: '(ln u)′ = u′/u', sin: '(sin u)′ = cos u·u′', cos: '(cos u)′ = −sin u·u′', sqrt: '(√u)′ = u′/(2√u)',
  };
  const RULE_NAME = {
    x: 'аргумент', c: 'константа', add: 'сумма', sub: 'разность', mul: 'произведение', div: 'частное', neg: 'смена знака',
    pow: 'степень × внутренняя', exp: 'экспонента × внутренняя', ln: 'логарифм × внутренняя', sin: 'синус × внутренняя',
    cos: 'косинус × внутренняя', sqrt: 'корень × внутренняя',
  };
  function nodeLabel(n) {
    switch (n.op) {
      case 'x': return 'x';
      case 'c': return f3(n.k);
      case 'add': return 'u + v';
      case 'sub': return 'u − v';
      case 'mul': return 'u · v';
      case 'div': return 'u / v';
      case 'neg': return '−u';
      case 'pow': return 'u' + sup(n.k);
      case 'exp': return 'eᵘ';
      case 'ln': return 'ln u';
      case 'sin': return 'sin u';
      case 'cos': return 'cos u';
      case 'sqrt': return '√u';
      default: return n.op;
    }
  }
  /** Узлы в порядке «сначала дети, потом родитель» с координатами для рисунка. */
  function layoutTree(root) {
    const nodes = [];
    (function walk(n, d) {
      n._depth = d;
      (n.a || []).forEach((k) => walk(k, d + 1));
      nodes.push(n);
    })(root, 0);
    let leaf = 0;
    for (const n of nodes) n._x = n.a ? n.a.reduce((s, k) => s + k._x, 0) / n.a.length : leaf++;
    return { nodes, leaves: leaf, depth: Math.max(...nodes.map((n) => n._depth)) };
  }
  /** Прямой проход: у каждого узла значение _v, производная _d и расчёт по правилу. */
  function evalTree(nodes, x) {
    for (const n of nodes) {
      const [a, b] = n.a || [];
      let v;
      let d;
      let calc;
      switch (n.op) {
        case 'x': v = x; d = 1; calc = '1'; break;
        case 'c': v = n.k; d = 0; calc = '0'; break;
        case 'add': v = a._v + b._v; d = a._d + b._d; calc = P(a._d) + ' + ' + P(b._d); break;
        case 'sub': v = a._v - b._v; d = a._d - b._d; calc = P(a._d) + ' − ' + P(b._d); break;
        case 'mul': v = a._v * b._v; d = a._d * b._v + a._v * b._d; calc = P(a._d) + '·' + P(b._v) + ' + ' + P(a._v) + '·' + P(b._d); break;
        case 'div': v = a._v / b._v; d = (a._d * b._v - a._v * b._d) / (b._v * b._v); calc = '(' + P(a._d) + '·' + P(b._v) + ' − ' + P(a._v) + '·' + P(b._d) + ') / ' + P(b._v) + '²'; break;
        case 'neg': v = -a._v; d = -a._d; calc = '−' + P(a._d); break;
        case 'pow': v = Math.pow(a._v, n.k); d = n.k * Math.pow(a._v, n.k - 1) * a._d; calc = n.k + '·' + P(a._v) + (n.k - 1 === 1 ? '' : sup(n.k - 1)) + '·' + P(a._d); break;
        case 'exp': v = Math.exp(a._v); d = v * a._d; calc = P(v) + '·' + P(a._d); break;
        case 'ln': v = Math.log(a._v); d = a._d / a._v; calc = P(a._d) + ' / ' + P(a._v); break;
        case 'sin': v = Math.sin(a._v); d = Math.cos(a._v) * a._d; calc = 'cos(' + f3(a._v) + ')·' + P(a._d); break;
        case 'cos': v = Math.cos(a._v); d = -Math.sin(a._v) * a._d; calc = '−sin(' + f3(a._v) + ')·' + P(a._d); break;
        case 'sqrt': v = Math.sqrt(a._v); d = a._d / (2 * v); calc = P(a._d) + ' / (2·' + f3(v) + ')'; break;
        default: v = NaN; d = NaN; calc = '?';
      }
      n._v = v;
      n._d = d;
      n._calc = n.a ? calc + ' = ' + f3(d) : calc;
    }
  }
  /** Запись выражения для Python (с дуальными числами PY_DUAL). */
  function pyExpr(n) {
    const [a, b] = (n.a || []).map(pyExpr);
    switch (n.op) {
      case 'x': return 'x';
      case 'c': return U.pyNum(n.k);
      case 'add': return '(' + a + ' + ' + b + ')';
      case 'sub': return '(' + a + ' - ' + b + ')';
      case 'mul': return a + ' * ' + b;
      case 'div': return a + ' / (' + b + ')';
      case 'neg': return '(-' + a + ')';
      case 'pow': return '(' + a + ')**' + n.k;
      case 'exp': return 'exp(' + a + ')';
      case 'ln': return 'log(' + a + ')';
      default: return n.op + '(' + a + ')';
    }
  }
  /** Рисунок дерева: shown — сколько узлов (в порядке прохода) уже посчитано, cur — текущий. */
  function drawTree(host, T, shown, cur, o = {}) {
    const DX = o.dx || 90;
    const DY = o.dy || 60;
    const BW = 80;
    const BH = 40;
    const PAD = 6;
    const W = T.leaves * DX + 2 * PAD;
    const Hh = T.depth * DY + BH + 2 * PAD;
    const px = (n) => PAD + n._x * DX + DX / 2;
    const py = (n) => PAD + n._depth * DY;
    const svg = S('svg', { viewBox: '0 0 ' + W + ' ' + Hh, width: W, height: Hh, role: 'img', 'aria-label': 'Дерево выражения', style: 'width:100%;max-width:' + W + 'px;min-width:' + Math.min(W, 380) + 'px;height:auto;display:block;margin:0 auto' });
    for (const n of T.nodes) for (const k of n.a || []) svg.appendChild(S('line', { x1: px(n), y1: py(n) + BH, x2: px(k), y2: py(k), style: 'stroke:var(--border-strong);stroke-width:1.5' }));
    T.nodes.forEach((n, i) => {
      const done = i < shown;
      const isCur = i === cur;
      const st = isCur ? 'fill:var(--c-tree);fill-opacity:.16;stroke:var(--c-tree);stroke-width:2.4'
        : done ? 'fill:var(--c-model);fill-opacity:.09;stroke:var(--c-model);stroke-width:1.4'
          : 'fill:var(--surface);stroke:var(--border-strong);stroke-width:1.2';
      svg.appendChild(S('rect', { x: px(n) - BW / 2, y: py(n), width: BW, height: BH, rx: 9, style: st }));
      svg.appendChild(S('text', { x: px(n), y: py(n) + 16, 'text-anchor': 'middle', style: 'fill:var(--ink);font-size:13px;font-weight:650' }, nodeLabel(n)));
      svg.appendChild(S('text', { x: px(n), y: py(n) + 32, 'text-anchor': 'middle', style: 'fill:' + (done ? 'var(--ink-2)' : 'var(--muted)') + ';font-size:11px;font-variant-numeric:tabular-nums' }, done ? '′ = ' + f3(n._d) : '′ = ?'));
    });
    host.replaceChildren(svg);
  }

  /* ==============================================================================
   * 0. Интуиция: формула — дерево из атомов, производная собирается снизу вверх
   * ============================================================================== */
  const TREES = {
    poly: { label: '★ 3x² + 5', ftex: R`f(x)=3x^2+5`, build: () => ADD(MUL(C(3), POW(X(), 2)), C(5)), f: (x) => 3 * x * x + 5, df: (x) => 6 * x, dtex: R`f'(x)=6x`, x0: 1, dom: [-2, 2] },
    xe: { label: '★ x·eˣ', ftex: R`f(x)=x\cdot e^x`, build: () => MUL(X(), EXP(X())), f: (x) => x * Math.exp(x), df: (x) => Math.exp(x) * (1 + x), dtex: R`f'(x)=e^x(1+x)`, x0: 1, dom: [-2, 2] },
    sinx2: { label: '★★ sin(x²)', ftex: R`f(x)=\sin(x^2)`, build: () => SIN(POW(X(), 2)), f: (x) => Math.sin(x * x), df: (x) => 2 * x * Math.cos(x * x), dtex: R`f'(x)=2x\cos(x^2)`, x0: 1, dom: [-2, 2] },
    quot: { label: '★★ x² / (1 + x)', ftex: R`f(x)=\frac{x^2}{1+x}`, build: () => DIV(POW(X(), 2), ADD(C(1), X())), f: (x) => (x * x) / (1 + x), df: (x) => (x * x + 2 * x) / ((1 + x) * (1 + x)), dtex: R`f'(x)=\frac{x^2+2x}{(1+x)^2}`, x0: 1, dom: [-0.8, 2] },
    cube: { label: '★★ (x² + 1)³', ftex: R`f(x)=(x^2+1)^3`, build: () => POW(ADD(POW(X(), 2), C(1)), 3), f: (x) => (x * x + 1) ** 3, df: (x) => 6 * x * (x * x + 1) ** 2, dtex: R`f'(x)=6x(x^2+1)^2`, x0: 1, dom: [-2, 2] },
    soft: { label: '★★★ ln(1 + eˣ)', ftex: R`f(x)=\ln(1+e^x)`, build: () => LN(ADD(C(1), EXP(X()))), f: (x) => Math.log1p(Math.exp(x)), df: sigma, dtex: R`f'(x)=\frac{e^x}{1+e^x}=\sigma(x)`, x0: 0, dom: [-2, 2] },
    sig: { label: '★★★ σ(2x − 1) = 1 / (1 + e^(−(2x − 1)))', ftex: R`f(x)=\sigma(2x-1)=\frac{1}{1+e^{-(2x-1)}}`, build: () => DIV(C(1), ADD(C(1), EXP(NEG(SUB(MUL(C(2), X()), C(1)))))), f: (x) => sigma(2 * x - 1), df: (x) => 2 * sigma(2 * x - 1) * (1 - sigma(2 * x - 1)), dtex: R`f'(x)=2\,\sigma(2x-1)\bigl(1-\sigma(2x-1)\bigr)`, x0: 0.5, dom: [-2, 2] },
  };
  GBC.widget('expr-tree', (el) => {
    const s = { t: 'xe', x: 1, k: 0 };
    const w = ui.shell(el, { title: 'Формула — дерево из атомов', sub: 'Любая формула собрана из немногих «атомов» (x, числа, eˣ, ln, sin, степени) с помощью немногих операций (+, −, ·, /, подстановка). Нажимайте «шаг вперёд»: производная считается снизу вверх, каждый узел — по своему правилу, и в корне получается производная всей формулы.' });
    ui.select(w.controls, { label: 'Формула', value: s.t, options: Object.entries(TREES).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.t = v;
      T = layoutTree(TREES[v].build());
      s.x = TREES[v].x0;
      xs.input.min = TREES[v].dom[0];
      xs.input.max = TREES[v].dom[1];
      xs.set(s.x);
      pl.setMax(T.nodes.length);
      pl.set(0);
      s.k = 0;
      draw();
    } });
    const xs = ui.slider(w.controls, { label: 'Точка x', min: -2, max: 2, step: 0.05, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    let T = layoutTree(TREES[s.t].build());
    const pl = ui.player(w.controls, { label: 'Узлы дерева', min: 0, max: T.nodes.length, value: 0, fps: 1.2, format: (k, m) => 'посчитано ' + k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const head = H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px 18px;align-items:baseline;margin-bottom:6px' });
    const fTex = H('div');
    const dTex = H('div');
    head.append(fTex, dTex);
    w.main.appendChild(head);
    const treeBox = H('div', { style: 'overflow-x:auto;padding:4px 0 8px' });
    w.main.appendChild(treeBox);
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'f(x)' }, { key: 'd', label: 'f′(x) в корне' }, { key: 'n', label: 'численно' }, { key: 'r', label: 'правил применено' }]);
    function draw() {
      const Tp = TREES[s.t];
      const x = U.clamp(s.x, Tp.dom[0], Tp.dom[1]);
      evalTree(T.nodes, x);
      const cur = s.k - 1;
      drawTree(treeBox, T, s.k, cur);
      texInto(fTex, Tp.ftex);
      if (s.k >= T.nodes.length) texInto(dTex, Tp.dtex);
      else dTex.replaceChildren(H('span', { style: 'color:var(--muted)' }, 'f′(x) = ? — соберите по узлам'));
      const rows = T.nodes.slice(0, s.k).map((n, i) => [String(i + 1), nodeLabel(n), RULE_NAME[n.op] + ': ' + RULE[n.op], f3(n._v), n._calc]);
      rowTable(tbl, ['№', 'узел', 'правило', 'значение', 'производная по x'], rows.length ? rows : [['—', '—', 'нажмите «шаг вперёд»', '—', '—']], (i) => i === cur, false);
      const root = T.nodes[T.nodes.length - 1];
      st.set('v', f3(Tp.f(x)));
      st.set('d', s.k >= T.nodes.length ? U.fmt(root._d, 6) : '?');
      st.set('n', U.fmt(nd(Tp.f, x), 6));
      st.set('r', String(T.nodes.slice(0, s.k).filter((n) => n.a).length));
      if (s.k === 0) note.innerHTML = 'Сначала — листья: у <b>x</b> производная 1, у числа — 0. Потом каждый узел берёт значения и производные своих детей и применяет одно правило.';
      else if (s.k < T.nodes.length) {
        const n = T.nodes[cur];
        note.innerHTML = 'Узел <b>' + nodeLabel(n) + '</b>: правило «' + RULE_NAME[n.op] + '» ' + RULE[n.op] + '. Ему нужны только числа детей — их уже посчитали ниже по дереву.';
      } else note.innerHTML = 'Корень дерева — вся формула: f′(' + f3(x) + ') = <b>' + U.fmt(root._d, 6) + '</b>, центральная разность даёт ' + U.fmt(nd(Tp.f, x), 6) + '. Пять-шесть правил и таблица «атомов» — и продифференцировать можно <em>любую</em> формулу. Ровно так считает производные компьютер (шаг 25).';
    }
    w.pythonAction(() => {
      const Tp = TREES[s.t];
      return PY_DUAL + '\nx = D(' + U.pyNum(s.x) + ', 1.0)            # x = ' + U.pyNum(s.x) + ', dx/dx = 1\nf = ' + pyExpr(T.nodes[T.nodes.length - 1]) + '\nprint("f(x) =", f.v, "  f′(x) =", f.d)\n\n# проверка центральной разностью\ng = lambda t: ' + pyExpr(T.nodes[T.nodes.length - 1]).replace(/\bx\b/g, 'D(t)') + '\neps = 1e-6\nprint("численно:", (g(' + U.pyNum(s.x) + ' + eps).v - g(' + U.pyNum(s.x) + ' - eps).v) / (2 * eps))\n# Формула: ' + Tp.label.replace(/^★+ /, '') + '\n';
    });
    draw();
  });

  /* ==============================================================================
   * 2. Площадь растёт: (x²)′ = 2x и (uv)′ = u′v + uv′
   * ============================================================================== */
  GBC.widget('area-growth', (el) => {
    const st0 = { mode: 'square', u: 3, v: 2, du: 0.4, dv: 0.3 };
    const w = ui.shell(el, { title: 'Как растёт площадь', sub: 'Стороны чуть-чуть увеличились. Прирост площади = две полоски (оранжевые) + крошечный уголок (красный). При малых приращениях уголком можно пренебречь — так и получаются правила.' });
    ui.segmented(w.controls, { label: 'Фигура', value: st0.mode, options: [{ value: 'square', label: 'квадрат x·x' }, { value: 'rect', label: 'прямоугольник u·v' }], onChange: (v) => ((st0.mode = v), sync(), draw()) });
    const ctl = {
      u: ui.slider(w.controls, { label: 'сторона u (или x)', min: 1, max: 4, step: 0.1, value: st0.u, onInput: (v) => ((st0.u = v), draw()) }),
      v: ui.slider(w.controls, { label: 'сторона v', min: 1, max: 4, step: 0.1, value: st0.v, onInput: (v) => ((st0.v = v), draw()) }),
      du: ui.slider(w.controls, { label: 'приращение Δu (или Δx)', min: 0.02, max: 1, step: 0.02, value: st0.du, onInput: (v) => ((st0.du = v), draw()) }),
      dv: ui.slider(w.controls, { label: 'приращение Δv', min: 0.02, max: 1, step: 0.02, value: st0.dv, onInput: (v) => ((st0.dv = v), draw()) }),
    };
    function sync() {
      ctl.v.el.hidden = st0.mode === 'square';
      ctl.dv.el.hidden = st0.mode === 'square';
    }
    const plot = new GBC.Plot(w.main, { height: 330, equal: true, x: { label: '', domain: [-0.3, 5.3] }, y: { label: '', domain: [-0.3, 5.3] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'd', label: 'прирост площади' }, { key: 'lin', label: 'полоски' }, { key: 'c', label: 'уголок' }, { key: 'sh', label: 'доля уголка' }]);
    function draw() {
      const sq = st0.mode === 'square';
      const u = st0.u;
      const v = sq ? st0.u : st0.v;
      const du = st0.du;
      const dv = sq ? st0.du : st0.dv;
      const strips = u * dv + v * du;
      const corner = du * dv;
      plot.render([
        { type: 'rect', x0: 0, x1: u, y0: 0, y1: v, fill: 'model', stroke: 'model', color: 'model', opacity: 0.35, label: sq ? 'x²' : 'u·v' },
        { type: 'rect', x0: u, x1: u + du, y0: 0, y1: v, fill: 'tree', stroke: 'tree', color: 'tree', opacity: 0.55, label: sq ? 'полоски x·Δx (две)' : 'полоски v·Δu и u·Δv' },
        { type: 'rect', x0: 0, x1: u, y0: v, y1: v + dv, fill: 'tree', stroke: 'tree', color: 'tree', opacity: 0.55 },
        { type: 'rect', x0: u, x1: u + du, y0: v, y1: v + dv, fill: 'red', stroke: 'red', color: 'red', opacity: 0.75, label: sq ? 'уголок Δx²' : 'уголок Δu·Δv' },
        { type: 'text', items: [
          { x: u / 2, y: -0.05, dy: 14, anchor: 'middle', text: sq ? 'x = ' + U.fmt(u, 2) : 'u = ' + U.fmt(u, 2) },
          { x: -0.05, y: v / 2, dx: -4, anchor: 'end', text: sq ? 'x' : 'v = ' + U.fmt(v, 2) },
          { x: u + du / 2, y: -0.05, dy: 14, anchor: 'middle', text: sq ? 'Δx' : 'Δu' },
        ] },
      ]);
      st.set('d', U.fmt(strips + corner, 4));
      st.set('lin', U.fmt(strips, 4));
      st.set('c', U.fmt(corner, 4));
      st.set('sh', U.fmt((100 * corner) / (strips + corner), 2) + ' %');
      note.innerHTML = sq
        ? 'Δ(x²) = 2·x·Δx + Δx² = 2·' + U.fmt(u, 2) + '·' + U.fmt(du, 2) + ' + ' + U.fmt(du * du, 4) + '. Делим на Δx: <b>2x + Δx</b>. Уменьшайте Δx — уголок исчезает быстрее полосок, и остаётся <b>(x²)′ = 2x</b>.'
        : 'Δ(uv) = v·Δu + u·Δv + Δu·Δv. Делим на Δx и устремляем его к нулю: уголок пропадает, остаётся <b>(uv)′ = u′·v + u·v′</b> — правило произведения. Каждая сторона «тянет» площадь, умножаясь на длину другой стороны.';
    }
    sync();
    w.pythonAction(() => 'u, v = ' + U.pyNum(st0.u) + ', ' + U.pyNum(st0.mode === 'square' ? st0.u : st0.v) + '\nfor d in [0.5, 0.1, 0.01, 0.001]:\n    du = dv = d\n    growth = (u + du) * (v + dv) - u * v\n    print(f"Δ = {d:<6} прирост {growth:.6f} = полоски {u * dv + v * du:.6f} + уголок {du * dv:.1e}")\n');
    draw();
  });

  /* ==============================================================================
   * 3. Лаборатория степени: (x^a)′ = a·x^(a−1) для любого показателя
   * ============================================================================== */
  const POWERS = [-2, -1, -0.5, 1 / 3, 0.5, 1, 1.5, 2, 3, 4, 5];
  const powName = (a) => (Math.abs(a - 1 / 3) < 1e-12 ? '1/3' : a === 0.5 ? '1/2' : a === -0.5 ? '−1/2' : a === 1.5 ? '3/2' : U.fmt(a, 2));
  function powFns(a) {
    if (Math.abs(a - 1 / 3) < 1e-12) return { f: Math.cbrt, df: (x) => (x === 0 ? NaN : 1 / (3 * Math.cbrt(x) ** 2)), dom: [-2, 2], py: 'np.cbrt(x)', dpy: '1 / (3 * np.cbrt(x)**2)' };
    const f = (x) => Math.pow(x, a);
    const df = (x) => (a === 0 ? 0 : a * Math.pow(x, a - 1));
    if (Number.isInteger(a)) return { f, df, dom: a >= 0 ? [-2, 2] : [-3, 3], py: 'x**' + a, dpy: a + ' * x**' + (a - 1) };
    return { f, df, dom: [0, 3], py: 'x**' + U.pyNum(a), dpy: U.pyNum(a) + ' * x**' + U.pyNum(a - 1) };
  }
  const binom = (n, k) => {
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  };
  GBC.widget('power-lab', (el) => {
    const s = { a: 3, x: 1, h: 0.5 };
    const w = ui.shell(el, { title: 'Лаборатория степени: (xᵃ)′ = a·xᵃ⁻¹', sub: 'Выберите показатель a — целый, отрицательный или дробный. Верхний график — xᵃ и касательная, нижний — производная по формуле (линия) и численно (кружки). Для натуральных a таблица показывает бином: какие слагаемые прироста выживают при h → 0.' });
    ui.slider(w.controls, { label: 'Показатель a', values: POWERS, value: s.a, format: powName, onInput: (v) => ((s.a = v), clampX(), draw()) });
    const xSl = ui.slider(w.controls, { label: 'Точка x', min: -2.9, max: 2.9, step: 0.05, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    ui.slider(w.controls, { label: 'Сдвиг h (для бинома)', min: 0.01, max: 1, step: 0.01, value: s.h, onInput: (v) => ((s.h = v), draw()) });
    function clampX() {
      const F = powFns(s.a);
      const lo = F.dom[0] === 0 ? 0.1 : F.dom[0] + 0.1;
      s.x = U.clamp(s.x, lo, F.dom[1] - 0.1);
      if (!Number.isInteger(s.a) || s.a < 0) if (Math.abs(s.x) < 0.15) s.x = 0.5;
      xSl.input.min = lo;
      xSl.input.max = F.dom[1] - 0.1;
      xSl.set(s.x);
    }
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 250, x: { label: 'x' }, y: { label: 'xᵃ' } });
    const p2 = new GBC.Plot(box, { height: 250, x: { label: 'x' }, y: { label: '(xᵃ)′' } });
    const binBox = card('Почему именно a·xᵃ⁻¹');
    w.main.appendChild(binBox.el);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'xᵃ' }, { key: 'd', label: 'a·xᵃ⁻¹' }, { key: 'n', label: 'численно' }, { key: 'q', label: 'Δ/h при текущем h' }]);
    function draw() {
      const a = s.a;
      const F = powFns(a);
      const x = s.x;
      const c = curve(F.f, F.dom[0], F.dom[1], 801, { cap: 9, jump: 4 });
      const cd = curve(F.df, F.dom[0], F.dom[1], 801, { cap: 9, jump: 4 });
      const pts = U.linspace(F.dom[0] + 0.07, F.dom[1] - 0.07, 21).filter((t) => Math.abs(t) > 0.12 || (Number.isInteger(a) && a >= 0));
      const num = pts.map((t) => nd(F.f, t));
      p1.render([
        { type: 'line', x: c.x, y: c.y, color: 'model', width: 2.4, label: 'f(x) = x^{' + powName(a) + '}', hover: false },
        { type: 'segments', ...tanSeg(F.f, F.df, x, 0.7), color: 'tree', width: 2.4, opacity: 1 },
        { type: 'points', x: [x], y: [F.f(x)], color: 'tree', r: 6, label: 'точка касания' },
      ], { x: F.dom, y: yRange(F.f, U.linspace(F.dom[0], F.dom[1], 200), 0.1, 9) });
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: cd.x, y: cd.y, color: 'tree', width: 2.4, label: 'a·x^{a−1}', hover: false },
        { type: 'points', x: pts, y: num.map((v) => (Math.abs(v) > 9 ? NaN : v)), color: 'ink', r: 3.5, hollow: true, label: 'численно', tooltip: (i) => [['x', f3(pts[i])], ['численно', U.fmt(num[i], 6)], ['формула', U.fmt(F.df(pts[i]), 6)]] },
        { type: 'points', x: [x], y: [F.df(x)], color: 'tree', r: 6 },
      ], { x: F.dom, y: yRange(F.df, U.linspace(F.dom[0], F.dom[1], 200).filter((t) => Math.abs(t) > 0.15), 0.1, 9) });
      st.set('f', U.fmt(F.f(x), 4));
      st.set('d', U.fmt(F.df(x), 4));
      st.set('n', U.fmt(nd(F.f, x), 6));
      st.set('q', U.fmt((F.f(x + s.h) - F.f(x)) / s.h, 4));
      binBox.body.textContent = '';
      if (Number.isInteger(a) && a >= 2) {
        const ks = U.range(a, 1);
        const terms = ks.map((k) => binom(a, k) * Math.pow(x, a - k) * Math.pow(s.h, k - 1));
        const term = (k) => {
          const c = binom(a, k);
          const xp = a - k === 0 ? '' : a - k === 1 ? 'x' : 'x^{' + (a - k) + '}';
          const hp = k - 1 === 0 ? '' : k - 1 === 1 ? 'h' : 'h^{' + (k - 1) + '}';
          return (c === 1 && (xp || hp) ? '' : String(c)) + (xp && c !== 1 ? '\\,' : '') + xp + hp;
        };
        binBox.body.appendChild(texEl(R`\frac{(x+h)^{${a}}-x^{${a}}}{h}=` + ks.map(term).join('+'), false, 'padding:2px 0 6px'));
        const tb = H('div');
        binBox.body.appendChild(tb);
        rowTable(tb, ['слагаемое', ...ks.map((k) => (k === 1 ? 'главное' : 'k = ' + k)), 'сумма = Δ/h'], [['при x = ' + f3(x) + ', h = ' + f3(s.h), ...terms.map((t) => U.fmt(t, 4)), U.fmt(U.sum(terms), 4)]], null);
        binBox.body.appendChild(H('div', { style: 'font-size:.9rem;color:var(--ink-2);margin-top:4px' }, 'Все слагаемые, кроме главного, содержат h — при h → 0 они исчезают. Остаётся ' + a + '·x' + sup(a - 1) + ' = ' + U.fmt(a * Math.pow(x, a - 1), 4) + '.'));
      } else {
        const why = a === 1 ? 'x¹ = x — прямая с наклоном 1: (x)′ = 1·x⁰ = 1.'
          : a < 0 ? 'Отрицательная степень — это дробь: x' + sup(a) + ' = 1/x' + sup(-a) + '. Правило частного (шаг 9) даёт ' + a + '·x' + sup(a - 1) + ' — та же формула. Около нуля функция взлетает, и наклон тоже.'
            : Math.abs(a - 1 / 3) < 1e-12 ? 'Кубический корень: y = ∛x ⇔ y³ = x. Дифференцируем обе части по x: 3y²·y′ = 1, y′ = 1/(3y²) = ⅓·x^(−2/3) (неявное дифференцирование, шаг 14). В нуле касательная вертикальна: наклон уходит в бесконечность.'
              : 'Дробная степень: x^' + powName(a) + ' = e^(' + powName(a) + '·ln x). Логарифмическое дифференцирование (шаг 13) даёт ровно a·xᵃ⁻¹ — формула верна для любого действительного a при x > 0.';
        binBox.body.appendChild(H('div', { style: 'font-size:.95rem;color:var(--ink-2)' }, why));
      }
      const ex = (v) => (Number.isInteger(v) ? sup(v) : '^(' + powName(v) + ')');
      note.innerHTML = 'f(x) = x' + ex(a) + ', f′(' + f3(x) + ') = ' + powName(a) + '·' + P(x) + ex(a - 1) + ' = <b>' + U.fmt(F.df(x), 4) + '</b>. Правило одно: <b>показатель выходит множителем, а сам уменьшается на единицу</b>. ' + (a === 2 ? 'Это площадь квадрата из виджета выше.' : a === 3 ? 'У куба при удлинении стороны растут три грани по x²·Δx.' : a < 0 ? 'Знак наклона минус: функция убывает при x > 0.' : '');
    }
    w.pythonAction(() => {
      const F = powFns(s.a);
      return 'import numpy as np\n\na = ' + U.pyNum(s.a) + '\nf = lambda x: ' + F.py + '\ndf = lambda x: ' + F.dpy + '   # a·x^(a−1)\nfor x in [0.5, 1.0, ' + U.pyNum(s.x) + ', 2.0]:\n    num = (f(x + 1e-6) - f(x - 1e-6)) / 2e-6\n    print(f"x = {x}: формула {df(x):.6f}, численно {num:.6f}")\n';
    });
    clampX();
    draw();
  });

  /* ==============================================================================
   * 4. Почему e особенное: у aˣ наклон пропорционален высоте
   * ============================================================================== */
  GBC.widget('exp-slope', (el) => {
    const st0 = { a: 2 };
    const w = ui.shell(el, { title: 'Число e: функция, равная своему наклону', sub: 'Синяя — aˣ, оранжевая — её наклон (производная). Их отношение одно и то же во всех точках и равно ln a. Подберите a так, чтобы линии совпали.' });
    const sl = ui.slider(w.controls, { label: 'Основание a', min: 1.5, max: 4, step: 0.01, value: st0.a, onInput: (v) => ((st0.a = v), draw()) });
    ui.button(w.controls, { label: 'a = e ≈ 2.718', kind: 'primary', onClick: () => ((st0.a = Math.E), sl.set(Math.E), draw()) });
    const plot = new GBC.Plot(w.main, { height: 310, x: { label: 'x', domain: [-2, 2] }, y: { label: 'значение', domain: [0, 8] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: 'a' }, { key: 'r', label: 'наклон / высота' }, { key: 'ln', label: 'ln a' }, { key: 'd', label: 'время удвоения ln 2 / ln a' }]);
    function draw() {
      const a = st0.a;
      const xs = U.linspace(-2, 2, 201);
      const f = (x) => Math.pow(a, x);
      const d = (x) => nd(f, x, 1e-5);
      plot.render([
        { type: 'line', x: xs, y: xs.map(f), color: 'model', width: 2.4, label: 'aˣ', hover: false },
        { type: 'line', x: xs, y: xs.map(d), color: 'tree', width: 2.4, dash: Math.abs(a - Math.E) < 0.01 ? '6 4' : null, label: 'наклон (aˣ)′', hover: false },
        { type: 'segments', x1: [0.5], y1: [f(1) - 0.5 * d(1)], x2: [1.5], y2: [f(1) + 0.5 * d(1)], color: 'tree', width: 2, opacity: 0.8 },
        { type: 'points', x: [1], y: [f(1)], color: 'model', r: 5 },
      ]);
      const ratio = d(1) / f(1);
      st.set('a', U.fmt(a, 4));
      st.set('r', U.fmt(ratio, 4));
      st.set('ln', U.fmt(Math.log(a), 4));
      st.set('d', U.fmt(Math.log(2) / Math.log(a), 3));
      note.innerHTML = 'Для любого a наклон aˣ пропорционален самой функции: <b>(aˣ)′ = aˣ · ln a</b>, коэффициент ' + U.fmt(ratio, 4) + '. ' + (Math.abs(a - Math.E) < 0.01 ? '<b>При a = e коэффициент равен 1: (eˣ)′ = eˣ.</b> Экспонента — единственная функция с f(0) = 1, которая равна своей скорости роста.' : a < Math.E ? 'Наклон ниже функции — увеличьте a.' : 'Наклон выше функции — уменьшите a.');
    }
    w.pythonAction(() => 'import numpy as np\n\nfor a in [2, np.e, ' + U.pyNum(st0.a) + ']:\n    f = lambda x: a**x\n    slope = (f(1 + 1e-6) - f(1 - 1e-6)) / 2e-6\n    print(f"a = {a:.4f}: наклон/высота = {slope / f(1):.6f}, ln a = {np.log(a):.6f}")\n');
    draw();
  });

  /* ==============================================================================
   * 5. Единичная окружность: (sin t)′ = cos t, (cos t)′ = −sin t
   * ============================================================================== */
  GBC.widget('trig-circle', (el) => {
    const N = 72;
    const s = { k: 9 };
    const w = ui.shell(el, { title: 'Синус и косинус на окружности', sub: 'Точка бежит по единичной окружности со скоростью 1 (угол t в радианах = пройденный путь). Её скорость — касательная стрелка длины 1. Вертикальная часть скорости — это скорость роста sin t, горизонтальная — скорость cos t.' });
    ui.player(w.controls, { label: 'Угол t', min: 0, max: N, value: s.k, fps: 6, format: (k) => 't = ' + U.fmt((2 * Math.PI * k) / N, 3) + ' (' + Math.round((360 * k) / N) + '°)', onChange: (k) => ((s.k = k), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 290, equal: true, x: { label: 'cos t', domain: [-1.7, 1.7] }, y: { label: 'sin t', domain: [-1.7, 1.7] } });
    const p2 = new GBC.Plot(box, { height: 290, x: { label: 't, радианы', domain: [0, 2 * Math.PI] }, y: { label: 'значение', domain: [-1.35, 1.35] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't', label: 't' }, { key: 's', label: 'sin t' }, { key: 'c', label: 'cos t = (sin t)′' }, { key: 'n', label: '(sin t)′ численно' }]);
    function draw() {
      const t = (2 * Math.PI * s.k) / N;
      const c = Math.cos(t);
      const sn = Math.sin(t);
      const ang = U.linspace(0, 2 * Math.PI, 241);
      const arc = U.linspace(0, t, Math.max(2, Math.round(60 * t)));
      p1.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'vline', x: 0, color: 'axis', width: 1 },
        { type: 'line', x: ang.map(Math.cos), y: ang.map(Math.sin), color: 'muted', width: 1.6, hover: false },
        { type: 'line', x: arc.map((a) => 0.25 * Math.cos(a)), y: arc.map((a) => 0.25 * Math.sin(a)), color: 'ink2', width: 1.4, hover: false },
        { type: 'segments', x1: [0, c], y1: [0, 0], x2: [c, c], y2: [sn, sn], color: 'ink2', width: 1.2, dash: '4 3', opacity: 0.9 },
        { type: 'arrows', x1: [c], y1: [sn], x2: [c - sn], y2: [sn + c], color: 'tree', width: 2.4, label: 'скорость точки' },
        { type: 'arrows', x1: [c], y1: [sn], x2: [c], y2: [sn + c], color: 'aqua', width: 2 },
        { type: 'arrows', x1: [c], y1: [sn], x2: [c - sn], y2: [sn], color: 'violet', width: 2 },
        { type: 'points', x: [c], y: [sn], color: 'model', r: 6 },
        { type: 'text', items: [
          { x: c, y: sn + c, dx: 6, dy: c >= 0 ? -2 : 12, text: '↕ cos t', color: 'ink' },
          { x: c - sn, y: sn, dx: sn > 0 ? -6 : 6, dy: -6, anchor: sn > 0 ? 'end' : 'start', text: '↔ −sin t', color: 'ink' },
        ] },
      ]);
      const ts = U.linspace(0, 2 * Math.PI, 301);
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: ts, y: ts.map(Math.sin), color: 'model', width: 2.4, label: 'sin t', hover: false },
        { type: 'line', x: ts, y: ts.map(Math.cos), color: 'aqua', width: 2, label: 'cos t = (sin t)′', hover: false },
        { type: 'line', x: ts, y: ts.map((v) => -Math.sin(v)), color: 'violet', width: 1.6, dash: '5 4', label: '−sin t = (cos t)′', hover: false },
        { type: 'segments', x1: [t - 0.6], y1: [sn - 0.6 * c], x2: [t + 0.6], y2: [sn + 0.6 * c], color: 'tree', width: 2.4, opacity: 1 },
        { type: 'vline', x: t, color: 'ink2', width: 1, dash: '3 3' },
        { type: 'points', x: [t, t], y: [sn, c], color: (i) => (i ? 'aqua' : 'model'), r: 5.5 },
      ]);
      st.set('t', U.fmt(t, 3));
      st.set('s', U.fmt(sn, 4));
      st.set('c', U.fmt(c, 4));
      st.set('n', U.fmt(nd(Math.sin, t), 4));
      const phase = Math.abs(c) < 0.02 ? 'Точка в самом верху или внизу: она движется горизонтально, высота sin t не меняется — <b>cos t = 0</b>, касательная к синусу горизонтальна.' : Math.abs(sn) < 0.02 ? 'Точка на горизонтальной оси: она движется вертикально с полной скоростью — синус меняется быстрее всего, <b>|cos t| = 1</b>.' : c > 0 ? 'Стрелка скорости смотрит вверх (cos t > 0) — синус растёт.' : 'Стрелка скорости смотрит вниз (cos t &lt; 0) — синус убывает.';
      note.innerHTML = 'Скорость направлена по касательной к окружности, то есть перпендикулярно радиусу (cos t, sin t): это вектор (−sin t, cos t). Его вертикальная часть — <b>(sin t)′ = cos t</b>, горизонтальная — <b>(cos t)′ = −sin t</b>. ' + phase + ' Равенство «длина дуги = угол» верно только в радианах — поэтому формулы без лишних множителей работают только для радиан.';
    }
    w.pythonAction(() => 'import numpy as np\n\nt = ' + U.pyNum((2 * Math.PI * s.k) / N) + '\neps = 1e-6\nprint("(sin t)′ численно:", (np.sin(t + eps) - np.sin(t - eps)) / (2 * eps), " cos t =", np.cos(t))\nprint("(cos t)′ численно:", (np.cos(t + eps) - np.cos(t - eps)) / (2 * eps), " −sin t =", -np.sin(t))\n# в градусах появляется множитель π/180:\ndeg = np.degrees(t)\nprint("d/dx sin(x°) =", (np.sin(np.radians(deg + eps)) - np.sin(np.radians(deg - eps))) / (2 * eps), " = π/180·cos =", np.pi / 180 * np.cos(t))\n');
    draw();
  });

  /* ==============================================================================
   * 7. Правило суммы: наклоны складываются, множитель выносится
   * ============================================================================== */
  const PAIRS = {
    a: { label: 'f = x², g = sin x', f: (x) => x * x, df: (x) => 2 * x, g: Math.sin, dg: Math.cos, fl: 'x²', gl: 'sin x', py: ['x**2', '2 * x', 'np.sin(x)', 'np.cos(x)'] },
    b: { label: 'f = eˣ, g = −2x', f: Math.exp, df: Math.exp, g: (x) => -2 * x, dg: () => -2, fl: 'eˣ', gl: '−2x', py: ['np.exp(x)', 'np.exp(x)', '-2 * x', '-2 + 0 * x'] },
    c: { label: 'f = x³/3, g = −x', f: (x) => x ** 3 / 3, df: (x) => x * x, g: (x) => -x, dg: () => -1, fl: 'x³/3', gl: '−x', py: ['x**3 / 3', 'x**2', '-x', '-1 + 0 * x'] },
    d: { label: 'f = x², g = 1.5 (константа)', f: (x) => x * x, df: (x) => 2 * x, g: () => 1.5, dg: () => 0, fl: 'x²', gl: '1.5', py: ['x**2', '2 * x', '1.5 + 0 * x', '0 * x'] },
  };
  GBC.widget('sum-rule', (el) => {
    const st0 = { p: 'a', x: 1, c: 1 };
    const w = ui.shell(el, { title: 'Правило суммы: наклоны складываются', sub: 'Три функции: f, g и их комбинация f + c·g. Отрезки — касательные в точке x. Наклон касательной к комбинации равен f′ + c·g′.' });
    ui.select(w.controls, { label: 'Пара функций', value: st0.p, options: Object.entries(PAIRS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((st0.p = v), draw()) });
    ui.slider(w.controls, { label: 'Множитель c при g', min: -2, max: 2, step: 0.5, value: st0.c, onInput: (v) => ((st0.c = v), draw()) });
    ui.slider(w.controls, { label: 'Точка x', min: -2, max: 2, step: 0.05, value: st0.x, onInput: (v) => ((st0.x = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x', domain: [-2.5, 2.5] }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'f′(x)' }, { key: 'g', label: 'g′(x)' }, { key: 's', label: '(f + c·g)′(x)' }, { key: 'n', label: 'численно' }]);
    function draw() {
      const Pp = PAIRS[st0.p];
      const x = st0.x;
      const c = st0.c;
      const xs = U.linspace(-2.5, 2.5, 301);
      const s = (t) => Pp.f(t) + c * Pp.g(t);
      const ds = Pp.df(x) + c * Pp.dg(x);
      const tan = (F, d) => ({ x1: [x - 0.6], y1: [F(x) - 0.6 * d], x2: [x + 0.6], y2: [F(x) + 0.6 * d] });
      plot.render([
        { type: 'line', x: xs, y: xs.map(Pp.f), color: 'aqua', width: 2, label: 'f = ' + Pp.fl, hover: false },
        { type: 'line', x: xs, y: xs.map(Pp.g), color: 'violet', width: 2, label: 'g = ' + Pp.gl, hover: false },
        { type: 'line', x: xs, y: xs.map(s), color: 'model', width: 2.6, label: 'f + ' + U.fmt(c, 2) + '·g', hover: false },
        { type: 'segments', ...tan(Pp.f, Pp.df(x)), color: 'tree', width: 2.4, opacity: 1 },
        { type: 'segments', ...tan(Pp.g, Pp.dg(x)), color: 'tree', width: 2.4, opacity: 1 },
        { type: 'segments', ...tan(s, ds), color: 'tree', width: 3, opacity: 1 },
        { type: 'points', x: [x, x, x], y: [Pp.f(x), Pp.g(x), s(x)], color: (i) => ['aqua', 'violet', 'model'][i], r: 5 },
      ], { y: [-5, 7] });
      st.set('f', f3(Pp.df(x)));
      st.set('g', f3(Pp.dg(x)));
      st.set('s', f3(ds));
      st.set('n', U.fmt(nd(s, x), 5));
      note.innerHTML = f3(Pp.df(x)) + ' + ' + U.fmt(c, 2) + '·' + P(Pp.dg(x)) + ' = <b>' + f3(ds) + '</b>. Высоты складываются — значит, складываются и их изменения: <b>(f + g)′ = f′ + g′</b>. Растянули график в c раз — наклоны выросли в c раз: <b>(c·f)′ = c·f′</b>.' + (st0.p === 'd' ? ' Константа сдвигает график вверх, но не наклоняет его: её производная 0.' : '');
    }
    w.pythonAction(() => {
      const Pp = PAIRS[st0.p];
      return 'import numpy as np\n\nf, df = (lambda x: ' + Pp.py[0] + '), (lambda x: ' + Pp.py[1] + ')\ng, dg = (lambda x: ' + Pp.py[2] + '), (lambda x: ' + Pp.py[3] + ')\nc, x = ' + U.pyNum(st0.c) + ', ' + U.pyNum(st0.x) + '\ns = lambda t: f(t) + c * g(t)\nprint("f′ + c·g′ =", df(x) + c * dg(x), "  численно:", (s(x + 1e-6) - s(x - 1e-6)) / 2e-6)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 8–9. Произведение и частное: вклад каждого множителя
   * ============================================================================== */
  const PROD = {
    xe: { label: 'u = x, v = eˣ', u: (x) => x, du: () => 1, v: Math.exp, dv: Math.exp, ul: 'x', vl: 'eˣ', dom: [-3, 1.4], x0: 1, py: ['x', '1 + 0 * x', 'np.exp(x)', 'np.exp(x)'] },
    x2sin: { label: 'u = x², v = sin x', u: (x) => x * x, du: (x) => 2 * x, v: Math.sin, dv: Math.cos, ul: 'x²', vl: 'sin x', dom: [-3, 3], x0: 1, py: ['x**2', '2 * x', 'np.sin(x)', 'np.cos(x)'] },
    xln: { label: 'u = x, v = ln x', u: (x) => x, du: () => 1, v: Math.log, dv: (x) => 1 / x, ul: 'x', vl: 'ln x', dom: [0.03, 3], x0: 1, py: ['x', '1 + 0 * x', 'np.log(x)', '1 / x'] },
    ecos: { label: 'u = eˣ, v = cos x', u: Math.exp, du: Math.exp, v: Math.cos, dv: (x) => -Math.sin(x), ul: 'eˣ', vl: 'cos x', dom: [-2.5, 2], x0: 0.5, py: ['np.exp(x)', 'np.exp(x)', 'np.cos(x)', '-np.sin(x)'] },
    x2e: { label: 'u = x², v = e⁻ˣ', u: (x) => x * x, du: (x) => 2 * x, v: (x) => Math.exp(-x), dv: (x) => -Math.exp(-x), ul: 'x²', vl: 'e⁻ˣ', dom: [-1, 6], x0: 1, py: ['x**2', '2 * x', 'np.exp(-x)', '-np.exp(-x)'] },
  };
  const QUOT = {
    tan: { label: 'tg x = sin x / cos x', u: Math.sin, du: Math.cos, v: Math.cos, dv: (x) => -Math.sin(x), ul: 'sin x', vl: 'cos x', dom: [-1.3, 1.3], x0: Math.PI / 4, py: ['np.sin(x)', 'np.cos(x)', 'np.cos(x)', '-np.sin(x)'] },
    xq: { label: 'x / (1 + x²)', u: (x) => x, du: () => 1, v: (x) => 1 + x * x, dv: (x) => 2 * x, ul: 'x', vl: '1 + x²', dom: [-3.5, 3.5], x0: 2, py: ['x', '1 + 0 * x', '1 + x**2', '2 * x'] },
    ex: { label: 'eˣ / x', u: Math.exp, du: Math.exp, v: (x) => x, dv: () => 1, ul: 'eˣ', vl: 'x', dom: [0.25, 2.5], x0: 0.5, py: ['np.exp(x)', 'np.exp(x)', 'x', '1 + 0 * x'] },
    lnx: { label: 'ln x / x', u: Math.log, du: (x) => 1 / x, v: (x) => x, dv: () => 1, ul: 'ln x', vl: 'x', dom: [0.4, 8], x0: 1, py: ['np.log(x)', '1 / x', 'x', '1 + 0 * x'] },
    sig: { label: 'σ(x) = 1 / (1 + e⁻ˣ)', u: () => 1, du: () => 0, v: (x) => 1 + Math.exp(-x), dv: (x) => -Math.exp(-x), ul: '1', vl: '1 + e⁻ˣ', dom: [-6, 6], x0: 0, py: ['1 + 0 * x', '0 * x', '1 + np.exp(-x)', '-np.exp(-x)'] },
  };
  GBC.widget('product-lab', (el, cfg) => {
    const quot = cfg.mode === 'quotient';
    const LIB = quot ? QUOT : PROD;
    const s = { p: Object.keys(LIB)[0], x: Object.values(LIB)[0].x0 };
    const w = ui.shell(el, quot
      ? { title: 'Частное: «низ·(верх)′ − верх·(низ)′, делить на низ²»', sub: 'Сверху — числитель u, знаменатель v и дробь u/v с касательной. Снизу — два вклада: рост числителя (u′v / v²) и рост знаменателя, который уменьшает дробь (−uv′ / v²). Их сумма — наклон дроби. Последний столбец — частая ошибка u′/v′.' }
      : { title: 'Произведение: каждый множитель тянет за себя', sub: 'Сверху — множители u, v и произведение uv с касательной. Снизу — вклады: «u меняется, v стоит» (u′v) и «v меняется, u стоит» (uv′). Их сумма — наклон произведения. Последний столбец — частая ошибка u′·v′.' });
    ui.select(w.controls, { label: quot ? 'Дробь' : 'Множители', value: s.p, options: Object.entries(LIB).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.p = v;
      s.x = LIB[v].x0;
      xs.input.min = LIB[v].dom[0] + 0.05;
      xs.input.max = LIB[v].dom[1] - 0.05;
      xs.set(s.x);
      draw();
    } });
    const xs = ui.slider(w.controls, { label: 'Точка x', min: LIB[s.p].dom[0] + 0.05, max: LIB[s.p].dom[1] - 0.05, step: 0.01, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 270, x: { label: 'x' }, y: { label: 'y' } });
    const p2 = new GBC.Plot(w.main, { height: 200, x: { label: '', domain: [-0.6, 3.6], ticks: [] }, y: { label: 'вклад в наклон' }, margin: { bottom: 34 } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'u', label: 'u, u′' }, { key: 'v', label: 'v, v′' }, { key: 'd', label: quot ? '(u/v)′ по формуле' : '(uv)′ по формуле' }, { key: 'n', label: 'численно' }]);
    function draw() {
      const L = LIB[s.p];
      const x = U.clamp(s.x, L.dom[0] + 0.05, L.dom[1] - 0.05);
      const W = quot ? (t) => L.u(t) / L.v(t) : (t) => L.u(t) * L.v(t);
      const u = L.u(x);
      const v = L.v(x);
      const du = L.du(x);
      const dv = L.dv(x);
      const parts = quot ? [(du * v) / (v * v), (-u * dv) / (v * v)] : [du * v, u * dv];
      const dW = parts[0] + parts[1];
      const wrong = quot ? du / dv : du * dv;
      const grid = U.linspace(L.dom[0], L.dom[1], 501);
      const cap = 8;
      const cu = curve(L.u, L.dom[0], L.dom[1], 501, { cap: 12 });
      const cv = curve(L.v, L.dom[0], L.dom[1], 501, { cap: 12 });
      const cw = curve(W, L.dom[0], L.dom[1], 501, { cap: 12, jump: 3 });
      p1.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: cu.x, y: cu.y, color: 'aqua', width: 1.8, label: 'u = ' + L.ul, hover: false },
        { type: 'line', x: cv.x, y: cv.y, color: 'violet', width: 1.8, label: 'v = ' + L.vl, hover: false },
        { type: 'line', x: cw.x, y: cw.y, color: 'model', width: 2.8, label: quot ? 'u / v' : 'u · v', hover: false },
        { type: 'segments', ...tanSeg(W, () => dW, x, (L.dom[1] - L.dom[0]) * 0.12), color: 'tree', width: 2.6, opacity: 1 },
        { type: 'points', x: [x, x, x], y: [u, v, W(x)], color: (i) => ['aqua', 'violet', 'tree'][i], r: 5 },
      ], { x: L.dom, y: yRange([L.u, L.v, W], grid, 0.1, cap) });
      const vals = [parts[0], parts[1], dW, wrong];
      const names = quot ? ['u′v / v²', '−uv′ / v²', 'сумма = (u/v)′', 'u′/v′ — ошибка'] : ['u′·v', 'u·v′', 'сумма = (uv)′', 'u′·v′ — ошибка'];
      const fin = vals.map((t) => (Number.isFinite(t) ? U.clamp(t, -50, 50) : 0));
      const [lo, hi] = U.extent([0, ...fin]);
      const pad = (hi - lo) * 0.18 || 1;
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'bars', x: [0, 1, 2, 3], y: fin, color: (i) => ['aqua', 'violet', 'tree', 'critical'][i], width: 0.62, maxPx: 70, opacity: 0.9, tooltip: (i) => [[names[i], U.fmt(vals[i], 4)]] },
        { type: 'text', noClip: true, items: [0, 1, 2, 3].map((i) => ({ x: i, y: lo - pad, dy: 18, anchor: 'middle', text: names[i] })) },
        { type: 'text', items: [0, 1, 2, 3].map((i) => ({ x: i, y: fin[i], dy: fin[i] >= 0 ? -6 : 14, anchor: 'middle', text: U.fmt(vals[i], 3), bold: i === 2 })) },
      ], { y: [lo - pad, hi + pad] });
      st.set('u', f3(u) + ', ' + f3(du));
      st.set('v', f3(v) + ', ' + f3(dv));
      st.set('d', U.fmt(dW, 5));
      st.set('n', U.fmt(nd(W, x), 5));
      let msg = quot
        ? '(u/v)′ = (' + P(du) + '·' + P(v) + ' − ' + P(u) + '·' + P(dv) + ') / ' + P(v) + '² = <b>' + U.fmt(dW, 4) + '</b>. Рост числителя поднимает дробь, рост знаменателя — опускает: отсюда минус. '
        : '(uv)′ = ' + P(du) + '·' + P(v) + ' + ' + P(u) + '·' + P(dv) + ' = <b>' + U.fmt(dW, 4) + '</b>. ';
      msg += 'Неверное «правило» дало бы ' + U.fmt(wrong, 4) + (Math.abs(wrong - dW) > 1e-6 ? ' — мимо.' : ' — совпало случайно в этой точке, сдвиньте x.');
      if (s.p === 'xln') msg += ' Наклон x·ln x равен ln x + 1 и обращается в ноль при x = 1/e ≈ 0.368 — там минимум −1/e.';
      if (s.p === 'x2e') msg += ' Наклон x²e⁻ˣ = x·e⁻ˣ·(2 − x): нули в 0 и 2 — яма и горка.';
      if (s.p === 'sig') msg += ' Числитель — константа, поэтому остаётся только второй вклад: σ′ = e⁻ˣ/(1 + e⁻ˣ)² (шаг 17).';
      if (s.p === 'lnx') msg += ' Наклон (1 − ln x)/x² равен нулю при x = e — там максимум 1/e.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const L = LIB[s.p];
      return 'import numpy as np\n\nu, du = (lambda x: ' + L.py[0] + '), (lambda x: ' + L.py[1] + ')\nv, dv = (lambda x: ' + L.py[2] + '), (lambda x: ' + L.py[3] + ')\nx = ' + U.pyNum(s.x) + '\n' + (quot
        ? 'w = lambda t: u(t) / v(t)\nformula = (du(x) * v(x) - u(x) * dv(x)) / v(x)**2    # (u/v)′\nwrong = du(x) / dv(x)'
        : 'w = lambda t: u(t) * v(t)\nformula = du(x) * v(x) + u(x) * dv(x)                 # (uv)′\nwrong = du(x) * dv(x)') + '\nnumeric = (w(x + 1e-6) - w(x - 1e-6)) / 2e-6\nprint("по правилу:", formula, " численно:", numeric, " неверное «правило»:", wrong)\n';
    });
    draw();
  });

  /* ==============================================================================
   * 10. Цепное правило: «шестерёнки» — коэффициенты усиления перемножаются
   * ============================================================================== */
  const L_ = (name, f, df, py, dpy) => ({ name, f, df, py, dpy });
  const CH = {
    sinx2: { label: 'sin(x²)', x0: 1, links: [L_('u = x²', (x) => x * x, (x) => 2 * x, 'x**2', '2 * x'), L_('y = sin u', Math.sin, Math.cos, 'np.sin(x)', 'np.cos(x)')] },
    sq: { label: '(3 − x)²', x0: 1, links: [L_('u = 3 − x', (x) => 3 - x, () => -1, '3 - x', '-1 + 0 * x'), L_('y = u²', (u) => u * u, (u) => 2 * u, 'x**2', '2 * x')] },
    lin5: { label: '(3x + 1)⁵', x0: 0, links: [L_('u = 3x + 1', (x) => 3 * x + 1, () => 3, '3 * x + 1', '3 + 0 * x'), L_('y = u⁵', (u) => u ** 5, (u) => 5 * u ** 4, 'x**5', '5 * x**4')] },
    sigm: { label: 'σ(2x)', x0: 0.5, links: [L_('u = 2x', (x) => 2 * x, () => 2, '2 * x', '2 + 0 * x'), L_('y = σ(u)', sigma, (u) => sigma(u) * (1 - sigma(u)), '1 / (1 + np.exp(-x))', 'np.exp(-x) / (1 + np.exp(-x))**2')] },
    gauss: { label: 'e^(−x²)', x0: 0.7, links: [L_('u = −x²', (x) => -x * x, (x) => -2 * x, '-x**2', '-2 * x'), L_('y = eᵘ', Math.exp, Math.exp, 'np.exp(x)', 'np.exp(x)')] },
    root: { label: '√(1 + x²)', x0: 1, links: [L_('u = 1 + x²', (x) => 1 + x * x, (x) => 2 * x, '1 + x**2', '2 * x'), L_('y = √u', Math.sqrt, (u) => 1 / (2 * Math.sqrt(u)), 'np.sqrt(x)', '1 / (2 * np.sqrt(x))')] },
    lnsig: { label: 'ln σ(F) — часть log-loss', x0: -1, links: [L_('p = σ(F)', sigma, (u) => sigma(u) * (1 - sigma(u)), '1 / (1 + np.exp(-x))', 'np.exp(-x) / (1 + np.exp(-x))**2'), L_('y = ln p', Math.log, (p) => 1 / p, 'np.log(x)', '1 / x')] },
    esin: { label: 'e^(sin(x²)) — три звена', x0: 1, links: [L_('u = x²', (x) => x * x, (x) => 2 * x, 'x**2', '2 * x'), L_('v = sin u', Math.sin, Math.cos, 'np.sin(x)', 'np.cos(x)'), L_('y = eᵛ', Math.exp, Math.exp, 'np.exp(x)', 'np.exp(x)')] },
  };
  GBC.widget('chain-gears', (el) => {
    const s = { c: 'sinx2', x: 1, dx: 0.2 };
    const w = ui.shell(el, { title: 'Цепное правило: усиления перемножаются', sub: 'Сдвигаем x на Δx. Каждое звено цепочки растягивает (или сжимает, или переворачивает) сдвиг в свою производную раз. Итог: Δy ≈ (произведение производных звеньев)·Δx. Уменьшайте Δx — приближённые числа сойдутся к точным.' });
    ui.select(w.controls, { label: 'Цепочка', value: s.c, options: Object.entries(CH).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.c = v), (s.x = CH[v].x0), xs.set(s.x), draw()) });
    const xs = ui.slider(w.controls, { label: 'Точка x', min: -2, max: 2, step: 0.05, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    ui.slider(w.controls, { label: 'Сдвиг Δx', min: 0.005, max: 0.5, step: 0.005, value: s.dx, onInput: (v) => ((s.dx = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'значение на «оси» звена' }, y: { label: '', domain: [-0.5, 3.6], ticks: [] }, margin: { left: 20 } });
    const tableBox = H('div');
    w.main.appendChild(tableBox);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'произведение усилений' }, { key: 'a', label: 'Δy / Δx' }, { key: 'n', label: 'численно (Δx → 0)' }]);
    function draw() {
      const Cc = CH[s.c];
      const n = Cc.links.length;
      const x = s.x;
      const dx = s.dx;
      const vals = [[x, x + dx]];
      for (const Lk of Cc.links) vals.push([Lk.f(vals[vals.length - 1][0]), Lk.f(vals[vals.length - 1][1])]);
      const names = ['x', ...Cc.links.map((Lk) => Lk.name)];
      const rows = vals.map((v, i) => ({ y: n - i, a: v[0], b: v[1], name: names[i] }));
      const all = rows.flatMap((r) => [r.a, r.b]).filter(Number.isFinite);
      const [lo, hi] = U.extent(all);
      const pad = (hi - lo) * 0.15 + 0.1;
      const arrows = { x1: [], y1: [], x2: [], y2: [] };
      for (let i = 0; i < n; i++) {
        arrows.x1.push((rows[i].a + rows[i].b) / 2);
        arrows.y1.push(rows[i].y - 0.15);
        arrows.x2.push((rows[i + 1].a + rows[i + 1].b) / 2);
        arrows.y2.push(rows[i + 1].y + 0.15);
      }
      plot.render([
        { type: 'segments', x1: rows.map(() => lo - pad), y1: rows.map((r) => r.y), x2: rows.map(() => hi + pad), y2: rows.map((r) => r.y), color: 'axis', width: 1.2, opacity: 1 },
        { type: 'segments', x1: rows.map((r) => r.a), y1: rows.map((r) => r.y), x2: rows.map((r) => r.b), y2: rows.map((r) => r.y), color: 'tree', width: 7, opacity: 0.85 },
        { type: 'points', x: rows.map((r) => r.a), y: rows.map((r) => r.y), color: 'model', r: 5 },
        { type: 'arrows', ...arrows, color: 'ink2', width: 1.4 },
        { type: 'text', items: rows.map((r) => ({ x: lo - pad, y: r.y, dx: 4, dy: -10, text: r.name + ': сдвиг ' + U.fmt(r.b - r.a, 4) })) },
      ], { x: [lo - pad, hi + pad], y: [-0.5, n + 0.6] });
      let prod = 1;
      const trows = Cc.links.map((Lk, i) => {
        const g = Lk.df(vals[i][0]);
        prod *= g;
        const da = vals[i + 1][1] - vals[i + 1][0];
        const db = vals[i][1] - vals[i][0];
        return ['звено ' + (i + 1) + ': ' + Lk.name, U.fmt(Math.abs(db) > 1e-12 ? da / db : NaN, 4), U.fmt(g, 4)];
      });
      const total = (vals[n][1] - vals[n][0]) / dx;
      trows.push(['вся цепочка', U.fmt(total, 4), U.fmt(prod, 4) + ' = ' + Cc.links.map((Lk, i) => P(Lk.df(vals[i][0]))).join(' · ')]);
      tableBox.textContent = '';
      ui.table(tableBox, { columns: ['звено', 'усиление по сдвигам Δвыход/Δвход', 'точная производная звена'], numeric: false, rows: trows, highlight: (i) => i === n });
      const full = (t) => Cc.links.reduce((v, Lk) => Lk.f(v), t);
      st.set('g', U.fmt(prod, 5));
      st.set('a', U.fmt(total, 5));
      st.set('n', U.fmt(nd(full, x), 5));
      const flip = Cc.links.some((Lk, i) => Lk.df(vals[i][0]) < 0);
      note.innerHTML = 'Как в шестерёнках: усиления звеньев <b>перемножаются</b> — ' + Cc.links.map((Lk, i) => U.fmt(Lk.df(vals[i][0]), 3)).join(' × ') + ' = ' + U.fmt(prod, 4) + '. ' + (flip ? 'Отрицательное усиление переворачивает сдвиг: x растёт — следующее звено убывает. ' : '') + (n === 3 ? 'Звеньев три — множителей три: (e^(sin x²))′ = e^(sin x²)·cos(x²)·2x. ' : '') + (s.c === 'lnsig' ? 'Итог (ln σ(F))′ = (1/p)·p(1 − p) = 1 − p — красивое сокращение, из которого получается градиент log-loss. ' : '') + 'Записано по Лейбницу: <b>dy/dx = dy/du · du/dx</b> — «du» как будто сокращается.';
    }
    w.pythonAction(() => {
      const Cc = CH[s.c];
      const fs = Cc.links.map((Lk, i) => 'f' + (i + 1) + ', d' + (i + 1) + ' = (lambda x: ' + Lk.py + '), (lambda x: ' + Lk.dpy + ')   # ' + Lk.name).join('\n');
      const comp = Cc.links.reduce((acc, Lk, i) => 'f' + (i + 1) + '(' + acc + ')', 't');
      let code = 'import numpy as np\n\n' + fs + '\n\nx = ' + U.pyNum(s.x) + '\nvals, gain = [x], 1.0\n';
      Cc.links.forEach((Lk, i) => (code += 'gain *= d' + (i + 1) + '(vals[-1]); vals.append(f' + (i + 1) + '(vals[-1]))\n'));
      return code + 'full = lambda t: ' + comp + '\neps = 1e-6\nprint("произведение усилений:", gain, "  численно:", (full(x + eps) - full(x - eps)) / (2 * eps))\n';
    });
    draw();
  });

  /* ==============================================================================
   * 11. Внутренняя линейная функция: (f(ax + b))′ = a·f′(ax + b)
   * ============================================================================== */
  const SS = {
    sig: { label: 'σ(x) — «нейрон»', f: sigma, df: (x) => sigma(x) * (1 - sigma(x)), max: 0.25, py: ['1 / (1 + np.exp(-x))', 'np.exp(-x) / (1 + np.exp(-x))**2'] },
    sin: { label: 'sin x', f: Math.sin, df: Math.cos, max: 1, py: ['np.sin(x)', 'np.cos(x)'] },
    sq: { label: 'x²', f: (x) => x * x, df: (x) => 2 * x, max: null, py: ['x**2', '2 * x'] },
    tanh: { label: 'th x', f: Math.tanh, df: (x) => 1 - Math.tanh(x) ** 2, max: 1, py: ['np.tanh(x)', '1 - np.tanh(x)**2'] },
  };
  GBC.widget('scale-shift', (el) => {
    const s = { f: 'sig', a: 2, b: -1 };
    const w = ui.shell(el, { title: 'Внутри — прямая: (f(ax + b))′ = a·f′(ax + b)', sub: 'Серый график — f(x), синий — g(x) = f(ax + b). Множитель a сжимает график по горизонтали в a раз — и во столько же раз увеличивает все наклоны. Сдвиг b только переносит график и наклоны не меняет. Для сигмоиды это нейрон σ(wx + b): вес w задаёт крутизну.' });
    ui.select(w.controls, { label: 'Функция f', value: s.f, options: Object.entries(SS).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.f = v), draw()) });
    ui.slider(w.controls, { label: 'Множитель a (вес w)', min: -3, max: 3, step: 0.1, value: s.a, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'Сдвиг b', min: -3, max: 3, step: 0.1, value: s.b, onInput: (v) => ((s.b = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 260, x: { label: 'x', domain: [-4, 4] }, y: { label: 'значение' } });
    const p2 = new GBC.Plot(box, { height: 260, x: { label: 'x', domain: [-4, 4] }, y: { label: 'производная' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'm', label: 'max |f′|' }, { key: 'g', label: 'max |g′| = |a|·max |f′|' }, { key: 'c', label: 'где крутизна max' }]);
    function draw() {
      const F = SS[s.f];
      const a = s.a;
      const b = s.b;
      const g = (x) => F.f(a * x + b);
      const dg = (x) => a * F.df(a * x + b);
      const xs = U.linspace(-4, 4, 401);
      const yl = s.f === 'sq' ? [-1, 12] : s.f === 'sig' ? [-0.15, 1.15] : [-1.3, 1.3];
      p1.render([
        { type: 'line', x: xs, y: xs.map(F.f), color: 'muted', width: 2, label: 'f(x)', hover: false },
        { type: 'line', x: xs, y: xs.map(g), color: 'model', width: 2.6, label: 'g(x) = f(ax + b)', hover: false },
      ], { y: yl });
      const ys = xs.map(dg).filter(Number.isFinite);
      const lim = Math.max(1.2 * Math.max(...ys.map(Math.abs)), 0.3);
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: xs, y: xs.map(F.df), color: 'muted', width: 2, label: 'f′(x)', hover: false },
        { type: 'line', x: xs, y: xs.map(dg), color: 'tree', width: 2.6, label: 'g′(x) = a·f′(ax + b)', hover: false },
        { type: 'points', x: U.linspace(-3.8, 3.8, 15), y: U.linspace(-3.8, 3.8, 15).map((x) => nd(g, x)), color: 'ink', r: 3, hollow: true, label: 'численно' },
      ], { y: s.f === 'sq' ? [-Math.min(lim, 40), Math.min(lim, 40)] : [-lim, lim] });
      st.set('m', F.max === null ? '∞' : f3(F.max));
      st.set('g', F.max === null ? '∞' : f3(Math.abs(a) * F.max));
      st.set('c', s.f === 'sig' || s.f === 'tanh' ? (Math.abs(a) < 1e-9 ? '—' : 'x = −b/a = ' + f3(-b / a)) : '—');
      let msg = 'g′(x) = <b>' + U.fmt(a, 2) + '</b> · f′(' + U.fmt(a, 2) + 'x ' + (b < 0 ? '− ' + U.fmt(-b, 2) : '+ ' + U.fmt(b, 2)) + '). ';
      if (s.f === 'sig') msg += 'Самый крутой участок σ(wx + b) — в точке wx + b = 0, наклон там w/4 = ' + U.fmt(a / 4, 3) + '. Большой |w| делает «ступеньку», почти без наклона вдали от неё — градиент там почти ноль.';
      else if (Math.abs(a) < 1e-9) msg += 'a = 0: g — константа, наклон везде 0.';
      else if (a < 0) msg += 'a &lt; 0 отражает график слева направо — знак наклона меняется.';
      else msg += 'Сжатие графика в ' + U.fmt(a, 2) + ' раза делает его во столько же раз круче.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const F = SS[s.f];
      return 'import numpy as np\n\nf, df = (lambda x: ' + F.py[0] + '), (lambda x: ' + F.py[1] + ')\na, b = ' + U.pyNum(s.a) + ', ' + U.pyNum(s.b) + '\ng = lambda x: f(a * x + b)\nfor x in [-1.0, 0.0, 0.5, 1.0]:\n    print(f"x = {x:+.1f}: a·f′(ax + b) = {a * df(a * x + b):+.6f}, численно {(g(x + 1e-6) - g(x - 1e-6)) / 2e-6:+.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 13. Логарифмическое дифференцирование: (ln f)′ = f′/f
   * ============================================================================== */
  const LD = {
    xx: { label: 'xˣ', f: (x) => Math.pow(x, x), lnd: (x) => Math.log(x) + 1, dom: [0.03, 2.2], ext: 1 / Math.E, kind: 'минимум', texln: R`\ln f=x\ln x`, texd: R`f'=x^x(\ln x+1)`, py: 'x**x', pyln: 'np.log(x) + 1' },
    xinv: { label: 'x^(1/x)', f: (x) => Math.pow(x, 1 / x), lnd: (x) => (1 - Math.log(x)) / (x * x), dom: [0.3, 9], ext: Math.E, kind: 'максимум', texln: R`\ln f=\frac{\ln x}{x}`, texd: R`f'=x^{1/x}\cdot\frac{1-\ln x}{x^2}`, py: 'x**(1 / x)', pyln: '(1 - np.log(x)) / x**2' },
    xsin: { label: 'x^(sin x)', f: (x) => Math.pow(x, Math.sin(x)), lnd: (x) => Math.cos(x) * Math.log(x) + Math.sin(x) / x, dom: [0.1, 6], ext: null, kind: '', texln: R`\ln f=\sin x\cdot\ln x`, texd: R`f'=x^{\sin x}\Bigl(\cos x\ln x+\frac{\sin x}{x}\Bigr)`, py: 'x**np.sin(x)', pyln: 'np.cos(x) * np.log(x) + np.sin(x) / x' },
    prod: { label: 'x(x + 1)(x + 2)(x + 3)', f: (x) => x * (x + 1) * (x + 2) * (x + 3), lnd: (x) => 1 / x + 1 / (x + 1) + 1 / (x + 2) + 1 / (x + 3), dom: [0.05, 1.5], ext: null, kind: '', texln: R`\ln f=\ln x+\ln(x+1)+\ln(x+2)+\ln(x+3)`, texd: R`f'=f\cdot\Bigl(\frac1x+\frac1{x+1}+\frac1{x+2}+\frac1{x+3}\Bigr)`, py: 'x * (x + 1) * (x + 2) * (x + 3)', pyln: '1 / x + 1 / (x + 1) + 1 / (x + 2) + 1 / (x + 3)' },
  };
  GBC.widget('log-diff', (el) => {
    const s = { f: 'xx', x: 1 };
    const w = ui.shell(el, { title: 'Логарифмическое дифференцирование', sub: 'Когда x стоит и в основании, и в показателе (или множителей много), сначала логарифмируем: ln f превращает степени в произведения, а произведения — в суммы. Затем (ln f)′ = f′/f, откуда f′ = f·(ln f)′. Верхний график — f и касательная, нижний — относительная скорость f′/f.' });
    ui.select(w.controls, { label: 'Функция', value: s.f, options: Object.entries(LD).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.f = v;
      const D = LD[v].dom;
      s.x = U.clamp(1, D[0] + 0.05, D[1] - 0.05);
      xs.input.min = D[0] + 0.02;
      xs.input.max = D[1] - 0.02;
      xs.set(s.x);
      draw();
    } });
    const xs = ui.slider(w.controls, { label: 'Точка x', min: 0.05, max: 2.18, step: 0.01, value: s.x, onInput: (v) => ((s.x = v), draw()) });
    ui.button(w.controls, { label: 'К экстремуму', onClick: () => {
      const E = LD[s.f];
      if (E.ext !== null) (s.x = E.ext), xs.set(s.x), draw();
    } });
    const steps = card('Вывод', true);
    w.main.appendChild(steps.el);
    const sT1 = H('div');
    const sT2 = H('div');
    steps.body.append(sT1, sT2);
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 190, x: { label: 'x' }, y: { label: '(ln f)′ = f′/f' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'f(x)' }, { key: 'l', label: '(ln f)′' }, { key: 'd', label: 'f′ = f·(ln f)′' }, { key: 'n', label: 'численно' }]);
    function draw() {
      const E = LD[s.f];
      const x = U.clamp(s.x, E.dom[0] + 0.02, E.dom[1] - 0.02);
      const df = (t) => E.f(t) * E.lnd(t);
      texInto(sT1, E.texln + R`\quad\Rightarrow\quad \frac{f'}{f}=(\ln f)'`, false);
      texInto(sT2, E.texd, false);
      const c = curve(E.f, E.dom[0], E.dom[1], 601);
      const cl = curve(E.lnd, E.dom[0], E.dom[1], 601, { cap: 12 });
      const layers = [
        { type: 'line', x: c.x, y: c.y, color: 'model', width: 2.4, hover: false },
        { type: 'segments', ...tanSeg(E.f, df, x, (E.dom[1] - E.dom[0]) * 0.1), color: 'tree', width: 2.4, opacity: 1 },
        { type: 'points', x: [x], y: [E.f(x)], color: 'tree', r: 6 },
      ];
      if (E.ext !== null) layers.push({ type: 'points', x: [E.ext], y: [E.f(E.ext)], color: 'ink', r: 4.5, hollow: true, label: E.kind, tooltip: () => [['x', U.fmt(E.ext, 5)], ['f', U.fmt(E.f(E.ext), 5)]] });
      p1.render(layers, { x: E.dom, y: yRange(E.f, U.linspace(E.dom[0], E.dom[1], 200), 0.12) });
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'line', x: cl.x, y: cl.y, color: 'tree', width: 2.2, hover: false },
        { type: 'points', x: [x], y: [E.lnd(x)], color: 'tree', r: 5 },
      ], { x: E.dom, y: yRange(E.lnd, U.linspace(E.dom[0], E.dom[1], 200).slice(5), 0.12, 12) });
      st.set('f', U.fmt(E.f(x), 4));
      st.set('l', U.fmt(E.lnd(x), 4));
      st.set('d', U.fmt(df(x), 5));
      st.set('n', U.fmt(nd(E.f, x), 5));
      let msg = 'f′(' + f3(x) + ') = ' + U.fmt(E.f(x), 4) + ' · ' + P(E.lnd(x)) + ' = <b>' + U.fmt(df(x), 4) + '</b>. ';
      if (s.f === 'xx') msg += 'Ловушка: xˣ — не степень (показатель переменный) и не показательная функция (основание переменное), поэтому ни x·xˣ⁻¹, ни xˣ·ln x не верны — нужны оба слагаемых сразу. Минимум при ln x + 1 = 0, x = 1/e ≈ 0.3679, значение e^(−1/e) ≈ 0.6922.';
      else if (s.f === 'xinv') msg += 'Максимум x^(1/x) — при ln x = 1, то есть x = e ≈ 2.718; значение e^(1/e) ≈ 1.4447. Поэтому, например, ³√3 ≈ 1.442 больше, чем √2 ≈ 1.414.';
      else if (s.f === 'prod') msg += 'Для произведения четырёх множителей правило произведения дало бы четыре слагаемых по три множителя; через логарифм — сумма простых дробей. Каждая дробь — относительная скорость своего множителя.';
      else msg += 'Знак f′ совпадает со знаком (ln f)′, потому что f > 0: экстремумы f — нули (ln f)′.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const E = LD[s.f];
      return 'import numpy as np\n\nf = lambda x: ' + E.py + '\nlog_deriv = lambda x: ' + E.pyln + '   # (ln f)′\ndf = lambda x: f(x) * log_deriv(x)\nfor x in [0.5, 1.0, ' + U.pyNum(s.x) + ']:\n    print(f"x = {x}: f′ = {df(x):.6f}, численно {(f(x + 1e-6) - f(x - 1e-6)) / 2e-6:.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 14. Неявные и параметрические кривые: касательная без формулы y(x)
   * ============================================================================== */
  const IMP = {
    circle: { label: 'окружность x² + y² = 25', xt: (t) => 5 * Math.cos(t), yt: (t) => 5 * Math.sin(t), t: [0, 2 * Math.PI], t0: 0.9273, slope: (x, y) => -x / y, tex: R`2x+2y\,y'=0\ \Rightarrow\ y'=-\frac{x}{y}`, dom: [-6.5, 6.5] },
    ellipse: { label: 'эллипс x²/9 + y²/4 = 1', xt: (t) => 3 * Math.cos(t), yt: (t) => 2 * Math.sin(t), t: [0, 2 * Math.PI], t0: 0.8, slope: (x, y) => (-4 * x) / (9 * y), tex: R`\frac{2x}{9}+\frac{2y\,y'}{4}=0\ \Rightarrow\ y'=-\frac{4x}{9y}`, dom: [-3.8, 3.8] },
    hyper: { label: 'гипербола xy = 1', xt: (t) => t, yt: (t) => 1 / t, t: [0.18, 5.2], t0: 1, slope: (x, y) => -y / x, tex: R`y+x\,y'=0\ \Rightarrow\ y'=-\frac{y}{x}`, dom: [-0.3, 5.5] },
    folium: { label: 'декартов лист x³ + y³ = 6xy', xt: (t) => (6 * t) / (1 + t ** 3), yt: (t) => (6 * t * t) / (1 + t ** 3), t: [-0.55, 9], tp: [-0.55, 80], t0: 1, slope: (x, y) => (2 * y - x * x) / (y * y - 2 * x), tex: R`3x^2+3y^2y'=6y+6x\,y'\ \Rightarrow\ y'=\frac{2y-x^2}{y^2-2x}`, dom: [-3.8, 3.8] },
  };
  GBC.widget('implicit-curve', (el) => {
    const s = { c: 'circle', t: IMP.circle.t0 };
    const w = ui.shell(el, { title: 'Неявная функция: дифференцируем уравнение целиком', sub: 'Кривая задана уравнением, а не формулой y = f(x). Считаем y функцией от x и дифференцируем обе части по x; у каждого y по цепному правилу появляется множитель y′. Затем выражаем y′. Ползунок двигает точку по кривой; касательная строится по полученной формуле.' });
    ui.select(w.controls, { label: 'Кривая', value: s.c, options: Object.entries(IMP).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => {
      s.c = v;
      s.t = IMP[v].t0;
      ts.input.min = IMP[v].t[0];
      ts.input.max = IMP[v].t[1];
      ts.set(s.t);
      draw();
    } });
    const ts = ui.slider(w.controls, { label: 'Положение на кривой (параметр t)', min: 0, max: 2 * Math.PI, step: 0.005, value: s.t, onInput: (v) => ((s.t = v), draw()) });
    const der = card('Дифференцируем уравнение по x', true);
    const derT = H('div');
    der.body.appendChild(derT);
    w.main.appendChild(der.el);
    const plot = new GBC.Plot(w.main, { height: 330, equal: true, x: { label: 'x' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'p', label: 'точка (x, y)' }, { key: 'i', label: 'y′ по неявной формуле' }, { key: 'q', label: 'y′ = (dy/dt)/(dx/dt)' }]);
    function draw() {
      const Cv = IMP[s.c];
      const t = s.t;
      const x = Cv.xt(t);
      const y = Cv.yt(t);
      const k = Cv.slope(x, y);
      const kp = nd(Cv.yt, t) / nd(Cv.xt, t);
      texInto(derT, Cv.tex, true);
      // хвост декартова листа подходит к началу координат медленно: дорисовываем его разреженной сеткой
      const tt = Cv.tp ? [...U.linspace(Cv.tp[0], 6, 900), ...U.linspace(6, Cv.tp[1], 300).slice(1)] : U.linspace(Cv.t[0], Cv.t[1], 700);
      const cx = tt.map(Cv.xt);
      const cy = tt.map(Cv.yt);
      const span = Cv.dom[1] - Cv.dom[0];
      const len = span * 0.22;
      const vert = !Number.isFinite(k) || Math.abs(k) > 1e4;
      const ux = vert ? 0 : len / Math.sqrt(1 + k * k);
      const uy = vert ? len : k * ux;
      plot.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'vline', x: 0, color: 'axis', width: 1 },
        { type: 'line', x: cx, y: cy, color: 'model', width: 2.4, hover: false },
        { type: 'segments', x1: [x - ux], y1: [y - uy], x2: [x + ux], y2: [y + uy], color: 'tree', width: 2.6, opacity: 1 },
        { type: 'points', x: [x], y: [y], color: 'tree', r: 6 },
      ], { x: Cv.dom, y: Cv.dom });
      st.set('p', '(' + f3(x) + ', ' + f3(y) + ')');
      st.set('i', vert ? '∞ (вертикально)' : U.fmt(k, 4));
      st.set('q', Math.abs(kp) > 1e4 ? '∞' : U.fmt(kp, 4));
      let msg = 'В точке (' + f3(x) + ', ' + f3(y) + ') наклон касательной y′ = <b>' + (vert ? '∞' : U.fmt(k, 4)) + '</b>. ';
      if (s.c === 'circle') msg += 'Касательная к окружности перпендикулярна радиусу: наклон радиуса y/x, наклон касательной −x/y, произведение −1. ';
      if (s.c === 'folium') msg += 'Формулы y = f(x) для декартова листа в одну строку нет вовсе (в петле у одного x — до трёх y), а неявное дифференцирование работает: в точке (3, 3) y′ = (6 − 9)/(9 − 6) = −1. ';
      if (Math.abs(y) < 0.05 && s.c !== 'hyper') msg += 'Здесь y ≈ 0 и знаменатель обращается в ноль — касательная вертикальна. ';
      msg += 'Правый столбец — параметрическая производная (dy/dt)/(dx/dt): кривая задана парой x(t), y(t), и по цепному правилу dy/dt = (dy/dx)·(dx/dt). Числа совпадают.';
      note.innerHTML = msg;
    }
    w.pythonAction(() => {
      const xs0 = { circle: '5 * np.cos(t)', ellipse: '3 * np.cos(t)', hyper: 't', folium: '6 * t / (1 + t**3)' };
      const ys0 = { circle: '5 * np.sin(t)', ellipse: '2 * np.sin(t)', hyper: '1 / t', folium: '6 * t**2 / (1 + t**3)' };
      const sl = { circle: '-x / y', ellipse: '-4 * x / (9 * y)', hyper: '-y / x', folium: '(2 * y - x**2) / (y**2 - 2 * x)' };
      return 'import numpy as np\n\nxt = lambda t: ' + xs0[s.c] + '\nyt = lambda t: ' + ys0[s.c] + '\nt = ' + U.pyNum(s.t) + '\nx, y = xt(t), yt(t)\nimplicit = ' + sl[s.c] + '\neps = 1e-6\nparametric = (yt(t + eps) - yt(t - eps)) / (xt(t + eps) - xt(t - eps))\nprint(f"точка ({x:.4f}, {y:.4f}): неявно y′ = {implicit:.6f}, через параметр {parametric:.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * 15. Кусочные функции: склейка гладкая, излом или разрыв
   * ============================================================================== */
  const GLUE = {
    smooth: { label: 'x² при x ≤ 1, 2x − 1 при x > 1', a: 1, L: (x) => x * x, dL: (x) => 2 * x, Rf: (x) => 2 * x - 1, dR: () => 2, dom: [-1, 3], d2: [2, 0] },
    kink: { label: 'x² при x ≤ 1, x при x > 1', a: 1, L: (x) => x * x, dL: (x) => 2 * x, Rf: (x) => x, dR: () => 1, dom: [-1, 3], d2: [2, 0] },
    jump: { label: 'x² при x ≤ 1, x + 1 при x > 1', a: 1, L: (x) => x * x, dL: (x) => 2 * x, Rf: (x) => x + 1, dR: () => 1, dom: [-1, 3], d2: [2, 0] },
    abs: { label: '|x| (излом в нуле)', a: 0, L: (x) => -x, dL: () => -1, Rf: (x) => x, dR: () => 1, dom: [-2, 2], d2: [0, 0] },
    relu: { label: 'ReLU = max(0, x)', a: 0, L: () => 0, dL: () => 0, Rf: (x) => x, dR: () => 1, dom: [-2, 2], d2: [0, 0] },
    huber: { label: 'Хьюбер (δ = 1) по F при y = 0, стык F = 1', a: 1, L: (x) => 0.5 * x * x, dL: (x) => x, Rf: (x) => x - 0.5, dR: () => 1, dom: [-0.5, 3], d2: [1, 0] },
    pinball: { label: 'квантильные потери (α = 0.9) по F при y = 0', a: 0, L: (x) => -0.9 * x, dL: () => -0.9, Rf: (x) => 0.1 * x, dR: () => 0.1, dom: [-2, 2], d2: [0, 0] },
  };
  GBC.widget('glue-lab', (el) => {
    const s = { g: 'smooth' };
    const w = ui.shell(el, { title: 'Кусочные функции: проверяем стык', sub: 'Внутри каждого куска дифференцируем по обычным правилам. Весь вопрос — в точке стыка: функция должна быть непрерывной, а производные кусков слева и справа — совпадать. Тогда стык гладкий; иначе — излом (производной нет) или разрыв.' });
    ui.select(w.controls, { label: 'Функция', value: s.g, options: Object.entries(GLUE).map(([k, v]) => ({ value: k, label: v.label })), onChange: (v) => ((s.g = v), draw()) });
    const verdict = H('div', { style: 'margin:2px 0 8px' });
    w.main.appendChild(verdict);
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 250, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(box, { height: 250, x: { label: 'x' }, y: { label: 'f′(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'fl', label: 'f(a−), f(a+)' }, { key: 'dl', label: 'f′ слева' }, { key: 'dr', label: 'f′ справа' }, { key: 'd2', label: 'f″ слева / справа' }]);
    function draw() {
      const G = GLUE[s.g];
      const a = G.a;
      const xl = U.linspace(G.dom[0], a, 200);
      const xr = U.linspace(a, G.dom[1], 200);
      const fa = G.L(a);
      const fb = G.Rf(a);
      const cont = Math.abs(fa - fb) < 1e-9;
      const dl = G.dL(a);
      const dr = G.dR(a);
      const smooth = cont && Math.abs(dl - dr) < 1e-9;
      p1.render([
        { type: 'vline', x: a, color: 'ink2', width: 1, dash: '3 3', text: 'стык a = ' + a },
        { type: 'line', x: xl, y: xl.map(G.L), color: 'model', width: 2.6, label: 'левый кусок', hover: false },
        { type: 'line', x: xr, y: xr.map(G.Rf), color: 'aqua', width: 2.6, label: 'правый кусок', hover: false },
        { type: 'points', x: [a, a], y: [fa, fb], color: (i) => (i ? 'aqua' : 'model'), r: 5.5, hollow: !cont },
      ]);
      p2.render([
        { type: 'hline', y: 0, color: 'axis', width: 1 },
        { type: 'vline', x: a, color: 'ink2', width: 1, dash: '3 3' },
        { type: 'line', x: xl, y: xl.map(G.dL), color: 'model', width: 2.6, label: 'f′ левого', hover: false },
        { type: 'line', x: xr, y: xr.map(G.dR), color: 'aqua', width: 2.6, label: 'f′ правого', hover: false },
        { type: 'points', x: [a, a], y: [dl, dr], color: (i) => (i ? 'aqua' : 'model'), r: 5.5, hollow: true },
      ]);
      st.set('fl', f3(fa) + ', ' + f3(fb));
      st.set('dl', f3(dl));
      st.set('dr', f3(dr));
      st.set('d2', G.d2[0] + ' / ' + G.d2[1]);
      verdict.replaceChildren(!cont ? badge('разрыв: производной в стыке нет', 'bad') : smooth ? badge('гладкий стык: f′(a) = ' + f3(dl), 'good') : badge('излом: f′₋ = ' + f3(dl) + ' ≠ f′₊ = ' + f3(dr), 'bad'));
      const T = {
        smooth: 'Прямая 2x − 1 — касательная к параболе в точке 1: значения (1) и наклоны (2) совпадают, стык незаметен глазу. Но вторая производная скачет с 2 на 0 — кривизна меняется рывком.',
        kink: 'Значения совпадают (1 = 1), а наклоны нет (2 ≠ 1): «уголок». Производная в точке 1 не существует — односторонние производные разные (урок 15.5, шаг 11).',
        jump: 'Значения не совпадают (1 ≠ 2): функция разрывна, и производной в стыке нет, как бы ни совпадали наклоны — дифференцируемость требует непрерывности.',
        abs: 'Классический излом: −1 слева, +1 справа. На практике в нуле берут субградиент — любое число из [−1, 1], обычно 0 (так делает np.sign).',
        relu: 'Функция активации нейросетей: 0 слева, 1 справа; в нуле договорились считать производную 0. Сама функция не гладкая, но цепное правило работает почти везде.',
        huber: 'Хьюбер склеен из параболы и прямой так, что совпадают значения и наклоны: стык гладкий, поэтому градиент — непрерывный «обрезанный остаток». Вторая производная (1 и 0) скачет — для шага Ньютона это важно (урок 5.3).',
        pinball: 'Пинбол-потери: наклон −α слева и 1 − α справа. Излом в F = y — поэтому градиент квантильных потерь принимает всего два значения: −0.9 или 0.1.',
      };
      note.innerHTML = T[s.g];
    }
    w.pythonAction(() => {
      const G = GLUE[s.g];
      return 'import numpy as np\n\n# односторонние производные в точке стыка a = ' + G.a + '\nfl = lambda x: ' + { smooth: 'x**2', kink: 'x**2', jump: 'x**2', abs: '-x', relu: '0 * x', huber: '0.5 * x**2', pinball: '-0.9 * x' }[s.g] + '   # левый кусок\nfr = lambda x: ' + { smooth: '2 * x - 1', kink: 'x', jump: 'x + 1', abs: 'x', relu: 'x', huber: 'x - 0.5', pinball: '0.1 * x' }[s.g] + '   # правый кусок\na, h = ' + G.a + ', 1e-7\nprint("непрерывна:", np.isclose(fl(a), fr(a)))\nprint("f′ слева:", (fl(a) - fl(a - h)) / h, "  f′ справа:", (fr(a + h) - fr(a)) / h)\n';
    });
    draw();
  });

  GBC.lesson156 = { curve, texInto, texEl, card, cardGrid, badge, rowTable, nd, sigma, STARS, f3, P, yRange, tanSeg, sup, PY_DUAL, layoutTree, evalTree, drawTree, nodeLabel, RULE, RULE_NAME, X, C, ADD, SUB, MUL, DIV, POW, EXP, LN, SIN, COS, SQRT, NEG };
})();
