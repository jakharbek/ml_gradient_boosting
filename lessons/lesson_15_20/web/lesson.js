/* Урок 15.20: теория чисел. Часть 1 — делимость, НОД и простые числа.
 * Ядро: делители, НОД/НОК, расширенный алгоритм Евклида, разложение на простые, решето до 10⁶, функция
 * Эйлера, возведение в степень по модулю (Number/BigInt), тест Миллера — Рабина.
 * Виджеты: колесо остатков (интуиция); прямоугольники и делители; деление с остатком на прямой; фолды и
 * батчи; системы счисления; универсальный признак делимости; делители и кратные двух чисел; алгоритм
 * Евклида; карта шагов Евклида; таблица расширенного Евклида; диофантово уравнение на решётке; монеты и
 * число Фробениуса; взаимно простые точки; решето Эратосфена; дерево разложения; числа Евклида и пустыни
 * составных; π(x); спираль Улама; гипотезы (Гольдбах, близнецы, Коллатц); гонка простых.
 * Общие помощники выставлены в GBC.lesson1520 — ими пользуются lesson_extra.js и lesson_ml.js. */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const S = GBC.svg;
  const f2 = (v) => U.fmt(v, 2);
  const f3 = (v) => U.fmt(v, 3);
  const NB = ' ';
  const grp = (s) => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  const pct = (p, d = 1) => (Number.isFinite(p) ? U.fmt(100 * p, d) + ' %' : '—');
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }
  const nWord = (n, one, few, many) => grp(n) + ' ' + plural(n, one, few, many);
  const minus = (s) => String(s).replace(/-/g, '−');
  const SUPD = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const sup = (n) => String(n).split('').map((c) => (c === '-' ? '⁻' : SUPD[+c])).join('');
  const SUBD = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (n) => String(n).split('').map((c) => (c === '-' ? '₋' : SUBD[+c])).join('');

  /* ==============================================================================
   * Оформление
   * ============================================================================== */
  const SER = ['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'];
  const cvar = (i) => 'var(--c-' + SER[((i % SER.length) + SER.length) % SER.length] + ')';
  const tint = (c, p = 22) => 'color-mix(in srgb, ' + c + ' ' + p + '%, var(--surface))';
  const flexRow = (style = '') => H('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;' + style });
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
  function card(title) {
    const body = H('div', { style: 'font-variant-numeric:tabular-nums;overflow-x:auto;overflow-y:hidden' });
    const titleEl = H('div', { style: 'font-size:.95rem;font-weight:700;color:var(--ink);margin-bottom:4px' }, title);
    const el = H('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:10px 12px;background:var(--surface);min-width:0' }, titleEl, body);
    return { el, body, titleEl };
  }
  const cardGrid = (min = 200) => H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(' + min + 'px,100%),1fr));gap:10px;margin:4px 0 10px' });
  function badge(text, kind) {
    const st = kind === 'good' ? 'background:var(--good-soft);color:var(--good-text)' : kind === 'bad' ? 'background:var(--critical-soft);color:var(--critical-text)' : kind === 'warn' ? 'background:var(--warn-soft);color:var(--warn-text)' : 'background:var(--surface-2);color:var(--ink-2)';
    return H('span', { style: 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:.8rem;font-weight:650;white-space:nowrap;' + st }, text);
  }
  /** Фишка-число: kind = 'on' (выделена цветом c), 'dim' (приглушена), иначе обычная. */
  function chip(text, kind, c = 'var(--c-blue)') {
    const st = kind === 'on' ? 'background:' + tint(c, 30) + ';border-color:' + c + ';color:var(--ink);font-weight:700' : kind === 'dim' ? 'opacity:.45' : '';
    return H('span', { style: 'display:inline-block;min-width:26px;text-align:center;padding:2px 7px;border:1.5px solid var(--border-strong);border-radius:8px;font-family:var(--font-mono);font-size:.86rem;background:var(--surface);' + st }, text);
  }
  function rowTable(parent, columns, rows, highlight, numeric = true) {
    parent.textContent = '';
    ui.table(parent, { columns, rows, highlight, numeric });
  }
  const scrollBox = (style = '') => H('div', { style: 'overflow-x:auto;overflow-y:hidden;margin:4px 0 8px;' + style });
  const monoBox = (style = '') => H('div', { style: 'font-family:var(--font-mono);font-size:.86rem;line-height:1.6;white-space:pre-wrap;word-break:break-word;padding:6px 2px;' + style });
  /** SVG-полотно в прокручиваемой рамке: на узком экране не сжимается меньше minW. */
  function svgBox(parent, w, h, minW = 0, maxW = 0) {
    const svg = S('svg', { viewBox: '0 0 ' + w + ' ' + h, style: 'display:block;width:100%;height:auto;max-width:' + (maxW ? maxW + 'px' : 'none') + ';min-width:' + (minW || 0) + 'px;margin:0 auto' });
    const box = scrollBox();
    box.appendChild(svg);
    parent.appendChild(box);
    return svg;
  }
  const sText = (x, y, text, o = {}) => S('text', { x, y, 'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'central', style: 'font-family:' + (o.mono ? 'var(--font-mono)' : 'var(--font-sans)') + ';font-size:' + (o.size || 13) + 'px;font-weight:' + (o.bold ? 700 : 500) + ';fill:' + (o.color || 'var(--ink)') }, text);
  function legendRow(items) {
    const row = flexRow('gap:14px;font-size:.86rem;color:var(--ink-2);margin:2px 0 6px');
    items.forEach(([c, t, dashed]) => row.appendChild(H('span', { style: 'display:inline-flex;align-items:center;gap:6px' }, H('span', { style: 'width:12px;height:12px;border-radius:3px;display:inline-block;background:' + tint(c, 45) + ';border:2px ' + (dashed ? 'dashed' : 'solid') + ' ' + c }), t)));
    return row;
  }
  /** Текстовое поле для целого числа. o: {label, value, min, max, onChange(v), width} */
  function intField(parent, o) {
    const inp = H('input', { class: 'input', type: 'text', inputmode: 'numeric', spellcheck: 'false', autocomplete: 'off', 'aria-label': o.label, value: String(o.value), style: 'font-family:var(--font-mono)' });
    const msg = H('div', { class: 'ctl-help', style: 'min-height:1em' });
    const el = H('div', { class: 'ctl' }, H('label', { class: 'ctl-label' }, o.label), inp, msg);
    let value = o.value;
    const apply = () => {
      const raw = inp.value.replace(/[\s ]/g, '');
      if (!/^-?\d+$/.test(raw)) {
        msg.textContent = 'Введите целое число';
        return;
      }
      let v = Number(raw);
      const lo = o.min ?? -Infinity;
      const hi = o.max ?? Infinity;
      if (v < lo || v > hi) {
        msg.textContent = 'Допустимо от ' + grp(lo) + ' до ' + grp(hi);
        v = U.clamp(v, lo, hi);
      } else msg.textContent = o.help || '';
      value = v;
      o.onChange(v);
    };
    inp.addEventListener('change', apply);
    inp.addEventListener('keydown', (e) => e.key === 'Enter' && apply());
    if (o.help) msg.textContent = o.help;
    parent.appendChild(el);
    return {
      el,
      inp,
      get value() {
        return value;
      },
      set(v) {
        value = v;
        inp.value = String(v);
      },
    };
  }
  /** Текстовое поле для строки (например, длинного числа). */
  function textField(parent, o) {
    const inp = H('input', { class: 'input', type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': o.label, value: o.value, style: 'font-family:var(--font-mono)' });
    const msg = H('div', { class: 'ctl-help', style: 'min-height:1em' }, o.help || '');
    const el = H('div', { class: 'ctl' }, H('label', { class: 'ctl-label' }, o.label), inp, msg);
    const apply = () => {
      const r = o.onChange(inp.value);
      msg.textContent = typeof r === 'string' ? r : o.help || '';
    };
    inp.addEventListener('change', apply);
    inp.addEventListener('keydown', (e) => e.key === 'Enter' && apply());
    parent.appendChild(el);
    return { el, inp, msg, set: (v) => (inp.value = v) };
  }

  /* Цвета для canvas (реальные RGB текущей темы). */
  const RGB = (role) => GBC.colors.rgb(role);
  const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  /** Последовательная шкала: фон → синий (t ∈ [0, 1]). */
  function seqScale(role = 'blue') {
    const a = RGB('surface');
    const b = RGB(role);
    return (t) => mixRGB(a, b, 0.12 + 0.88 * U.clamp(t, 0, 1));
  }
  /**
   * Пиксельная канва: сетка cols × rows, каждая клетка — пиксель, растянутый CSS без сглаживания.
   * draw(cols, rows, colorAt(i, j) → [r, g, b] | null) — i по горизонтали, j сверху вниз.
   * onHover(i, j | null). Перерисовывается при смене темы (последний вызов draw повторяется).
   */
  function pixelCanvas(parent, o = {}) {
    const cv = H('canvas', { width: 10, height: 10, style: 'width:100%;height:auto;display:block;image-rendering:pixelated;image-rendering:crisp-edges;border:1px solid var(--border);border-radius:8px;cursor:crosshair;touch-action:manipulation' });
    const box = H('div', { style: 'max-width:' + (o.maxW || 460) + 'px;margin:4px auto 6px;position:relative' }, cv);
    parent.appendChild(box);
    let last = null;
    const api = {
      el: box,
      cv,
      draw(cols, rows, colorAt) {
        last = [cols, rows, colorAt];
        cv.width = cols;
        cv.height = rows;
        const ctx = cv.getContext('2d');
        const img = ctx.createImageData(cols, rows);
        const bg = RGB('surface');
        for (let j = 0; j < rows; j++)
          for (let i = 0; i < cols; i++) {
            const c = colorAt(i, j) || bg;
            const k = 4 * (j * cols + i);
            img.data[k] = c[0];
            img.data[k + 1] = c[1];
            img.data[k + 2] = c[2];
            img.data[k + 3] = 255;
          }
        ctx.putImageData(img, 0, 0);
      },
      redraw() {
        if (last) api.draw(...last);
      },
    };
    const pick = (e) => {
      if (!last) return null;
      const r = cv.getBoundingClientRect();
      const i = Math.floor(((e.clientX - r.left) / r.width) * last[0]);
      const j = Math.floor(((e.clientY - r.top) / r.height) * last[1]);
      return i >= 0 && j >= 0 && i < last[0] && j < last[1] ? [i, j] : null;
    };
    cv.addEventListener('mousemove', (e) => o.onHover && o.onHover(pick(e)));
    cv.addEventListener('mouseleave', () => o.onHover && o.onHover(null));
    cv.addEventListener('click', (e) => {
      const p = pick(e);
      if (p && o.onClick) o.onClick(p);
      else if (p && o.onHover) o.onHover(p);
    });
    GBC.bus.on('themechange', () => setTimeout(() => (o.onTheme ? o.onTheme() : api.redraw()), 30));
    return api;
  }

  /* ==============================================================================
   * Ядро теории чисел
   * ============================================================================== */
  const mod = (a, m) => ((a % m) + m) % m;
  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a;
  }
  const lcm = (a, b) => (a && b ? (Math.abs(a) / gcd(a, b)) * Math.abs(b) : 0);
  /** Расширенный алгоритм Евклида (итеративный): [g, x, y] с a·x + b·y = g. */
  function extGcd(a, b) {
    let [r0, r1, x0, x1, y0, y1] = [a, b, 1, 0, 0, 1];
    while (r1) {
      const q = Math.floor(r0 / r1);
      [r0, r1] = [r1, r0 - q * r1];
      [x0, x1] = [x1, x0 - q * x1];
      [y0, y1] = [y1, y0 - q * y1];
    }
    return [r0, x0, y0];
  }
  /** Обратный к a по модулю m или null. */
  function invMod(a, m) {
    const [g, x] = extGcd(mod(a, m), m);
    return g === 1 ? mod(x, m) : null;
  }
  function divisors(n) {
    const lo = [];
    const hi = [];
    for (let d = 1; d * d <= n; d++)
      if (n % d === 0) {
        lo.push(d);
        if (d * d !== n) hi.unshift(n / d);
      }
    return lo.concat(hi);
  }
  /** Разложение на простые пробным делением: [[p, e], …]. */
  function factorize(n) {
    const f = [];
    for (let p = 2; p * p <= n; p += p === 2 ? 1 : 2) {
      let e = 0;
      while (n % p === 0) (n /= p), e++;
      if (e) f.push([p, e]);
    }
    if (n > 1) f.push([n, 1]);
    return f;
  }
  const fstr = (f) => (f.length ? f.map(([p, e]) => p + (e > 1 ? sup(e) : '')).join(' · ') : '1');
  const ftex = (f) => (f.length ? f.map(([p, e]) => p + (e > 1 ? '^{' + e + '}' : '')).join(' \\cdot ') : '1');
  const tau = (n) => factorize(n).reduce((a, [, e]) => a * (e + 1), 1);
  const sigma = (n) => factorize(n).reduce((a, [p, e]) => a * ((Math.pow(p, e + 1) - 1) / (p - 1)), 1);
  function phi(n) {
    let r = n;
    for (const [p] of factorize(n)) r = (r / p) * (p - 1);
    return r;
  }
  /** Решето до N (кешируется и расширяется). */
  let SIEVE = new Uint8Array(0);
  function sieveTo(N) {
    if (SIEVE.length > N) return SIEVE;
    const s = new Uint8Array(N + 1).fill(1);
    s[0] = 0;
    if (N >= 1) s[1] = 0;
    for (let p = 2; p * p <= N; p++) if (s[p]) for (let q = p * p; q <= N; q += p) s[q] = 0;
    SIEVE = s;
    return s;
  }
  let PRIMES = [];
  function primesTo(N) {
    if (PRIMES.length && PRIMES[PRIMES.length - 1] >= N) return PRIMES.filter((p) => p <= N);
    const s = sieveTo(Math.max(N, 1000));
    PRIMES = [];
    for (let i = 2; i < s.length; i++) if (s[i]) PRIMES.push(i);
    return PRIMES.filter((p) => p <= N);
  }
  /** Умножение по модулю без потери точности (BigInt, если произведение > 2⁵³). */
  function mulmod(a, b, m) {
    const p = a * b;
    if (p <= Number.MAX_SAFE_INTEGER) return p % m;
    return Number((BigInt(a) * BigInt(b)) % BigInt(m));
  }
  function powmod(a, e, m) {
    if (m === 1) return 0;
    let r = 1;
    a = mod(a, m);
    while (e > 0) {
      if (e % 2 === 1) r = mulmod(r, a, m);
      a = mulmod(a, a, m);
      e = Math.floor(e / 2);
    }
    return r;
  }
  function powmodBig(a, e, m) {
    a = BigInt(a);
    e = BigInt(e);
    m = BigInt(m);
    if (m === 1n) return 0n;
    let r = 1n;
    a = ((a % m) + m) % m;
    while (e > 0n) {
      if (e & 1n) r = (r * a) % m;
      a = (a * a) % m;
      e >>= 1n;
    }
    return r;
  }
  /** Сильный тест для основания a: true — «похоже на простое» (a — лжец или n простое). */
  function strongProbable(n, a) {
    let d = n - 1;
    let s = 0;
    while (d % 2 === 0) (d /= 2), s++;
    let x = powmod(a, d, n);
    if (x === 1 || x === n - 1) return true;
    for (let i = 1; i < s; i++) {
      x = mulmod(x, x, n);
      if (x === n - 1) return true;
    }
    return false;
  }
  /** Детерминированная проверка простоты для n < 3.3·10²⁴ (на практике — до 2⁵³). */
  function isPrime(n) {
    if (n < 2) return false;
    if (n < SIEVE.length) return SIEVE[n] === 1;
    for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]) {
      if (n === p) return true;
      if (n % p === 0) return false;
    }
    for (const a of [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]) if (!strongProbable(n, a)) return false;
    return true;
  }
  /** Интегральный логарифм li(x) по ряду Рамануджана — Гаусса: γ + ln ln x + Σ (ln x)^k / (k·k!). */
  function li(x) {
    const L = Math.log(x);
    let term = 1;
    let s = 0;
    for (let k = 1; k < 200; k++) {
      term *= L / k;
      const add = term / k;
      s += add;
      if (add < 1e-17 * s) break;
    }
    return 0.5772156649015329 + Math.log(L) + s;
  }
  const Li = (x) => li(x) - li(2);
  const DIG = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function toBase(n, b) {
    if (n === 0) return '0';
    let s = '';
    let v = Math.abs(n);
    while (v > 0) (s = DIG[v % b] + s), (v = Math.floor(v / b));
    return (n < 0 ? '−' : '') + s;
  }

  /* ==============================================================================
   * Интуиция. Колесо остатков: числа 1…N на m лучах
   * ============================================================================== */
  GBC.widget('number-wheel', (el) => {
    const s = { m: 6, N: 600, comp: false };
    const w = ui.shell(el, { title: 'Колесо остатков: где живут простые', sub: 'Число n ставим на луч номер n mod m на расстоянии n от центра. Каждый луч — класс остатков. Синие точки — простые числа.' });
    ui.slider(w.controls, { label: 'Лучей m', values: [2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 30, 44], value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'Чисел N', values: [120, 300, 600, 1200, 2400], value: s.N, format: (v) => grp(v), onInput: (v) => ((s.N = v), draw()) });
    ui.toggle(w.controls, { label: 'Показать составные', checked: s.comp, onChange: (v) => ((s.comp = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 360, equal: true, grid: 'none', x: { label: '', ticks: [] }, y: { label: '', ticks: [] }, margin: { left: 6, bottom: 6, right: 6, top: 6 } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pr', label: 'простых ≤ N' }, { key: 'sp', label: 'лучей с простыми > m' }, { key: 'phi', label: 'φ(m) — остатков, взаимно простых с m' }]);
    w.pythonAction(() => `from collections import Counter
from math import gcd

m, N = ${s.m}, ${s.N}
is_p = [False, False] + [True] * (N - 1)
for p in range(2, int(N ** 0.5) + 1):
    if is_p[p]:
        is_p[p * p :: p] = [False] * len(is_p[p * p :: p])
primes = [n for n in range(N + 1) if is_p[n]]
cnt = Counter(p % m for p in primes if p > m)
print("простых до", N, ":", len(primes))
for r in range(m):
    print(f"луч {r:2}: НОД(r, m) = {gcd(r, m)}, простых > m: {cnt.get(r, 0)}")
print("исключения (простые делители m):", [p for p in primes if m % p == 0])`);
    function draw() {
      const { m, N } = s;
      const sv = sieveTo(N);
      const ang = (n) => (2 * Math.PI * (n % m)) / m;
      const X = (n) => n * Math.sin(ang(n));
      const Y = (n) => n * Math.cos(ang(n));
      const L = [];
      const cop = U.range(m).filter((r) => gcd(r, m) === 1);
      const spoke = (rs) => ({
        x1: rs.map(() => 0),
        y1: rs.map(() => 0),
        x2: rs.map((r) => N * 1.02 * Math.sin((2 * Math.PI * r) / m)),
        y2: rs.map((r) => N * 1.02 * Math.cos((2 * Math.PI * r) / m)),
      });
      L.push(Object.assign({ type: 'segments', color: 'grid', width: 1, opacity: 1 }, spoke(U.range(m).filter((r) => gcd(r, m) !== 1))));
      L.push(Object.assign({ type: 'segments', color: 'blue', width: 1.4, opacity: 0.35 }, spoke(cop)));
      if (s.comp) {
        const cs = U.range(N, 1).filter((n) => n > 1 && !sv[n]);
        L.push({ type: 'points', x: cs.map(X), y: cs.map(Y), color: 'muted', r: N > 1000 ? 1.4 : 2, opacity: 0.6, label: 'составные' });
      }
      const ps = U.range(N, 1).filter((n) => sv[n]);
      L.push({ type: 'points', x: ps.map(X), y: ps.map(Y), color: 'model', r: N > 1000 ? 2.2 : 3.2, label: 'простые', tooltip: (i) => [ps[i] + ' — простое', ps[i] + ' mod ' + m + ' = ' + (ps[i] % m)] });
      if (m <= 30) L.push({ type: 'text', items: U.range(m).map((r) => ({ x: N * 1.1 * Math.sin((2 * Math.PI * r) / m), y: N * 1.1 * Math.cos((2 * Math.PI * r) / m), dy: 4, anchor: 'middle', text: String(r), bold: gcd(r, m) === 1, color: gcd(r, m) === 1 ? 'ink' : 'muted' })) });
      plot.render(L, { x: [-N * 1.18, N * 1.18], y: [-N * 1.18, N * 1.18] });
      const spokes = new Set(ps.filter((p) => p > m).map((p) => p % m));
      const exc = ps.filter((p) => m % p === 0);
      st.set('pr', String(ps.length));
      st.set('sp', spokes.size + ' из ' + m);
      st.set('phi', String(cop.length));
      note.innerHTML = 'Остаток решает, на каком луче окажется число. Если у остатка r и числа m есть общий делитель d > 1, то <em>каждое</em> число на этом луче делится на d — простых там нет (кроме, может быть, самого d). Поэтому простые, большие m, заполняют только лучи с <b>НОД(r, m) = 1</b>: сейчас это ' + cop.join(', ') + ' — всего φ(' + m + ') = ' + cop.length + '. ' + (exc.length ? 'Исключения — простые делители m: ' + exc.join(', ') + ' (каждое стоит одно на своём луче). ' : '') + (m === 6 ? 'При m = 6 видно знаменитое «все простые, кроме 2 и 3, имеют вид 6k ± 1». ' : '') + (m === 44 ? 'При m = 44 точки складываются в спирали: соседние лучи сдвинуты почти на полный оборот, и это уже узор не простых, а приближения 44/7 ≈ 2π. ' : '') + 'Внутри «разрешённых» лучей простые распределены почти поровну — это теорема Дирихле (шаг 15). Всё, что здесь видно, — остатки (шаги 2, 16), НОД (шаг 6) и простые (шаг 11).';
    }
    draw();
  });

  /* ==============================================================================
   * 1. Делимость: прямоугольники и делители
   * ============================================================================== */
  GBC.widget('rect-divisors', (el) => {
    const s = { n: 12 };
    const w = ui.shell(el, { title: 'Делители как прямоугольники', sub: 'Сложите n квадратиков в прямоугольник без дыр. Каждый способ a × b — пара делителей: n = a · b. У простого числа способ один — полоска 1 × n.' });
    const sl = ui.slider(w.controls, { label: 'n', min: 1, max: 72, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const presets = flexRow('margin-top:4px');
    [['простое', 13], ['квадрат', 36], ['совершенное', 28], ['много делителей', 60]].forEach(([t, v]) => presets.appendChild(ui.button(null, { label: t + ' ' + v, small: true, onClick: () => ((s.n = v), sl.set(v), draw()) })));
    w.controls.appendChild(presets);
    const chips = flexRow('margin:2px 0 8px');
    const grid = cardGrid(150);
    w.main.append(chips, grid);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't', label: 'делителей τ(n)' }, { key: 's', label: 'сумма делителей σ(n)' }, { key: 'k', label: 'тип числа' }]);
    w.pythonAction(() => `n = ${s.n}
divs = [d for d in range(1, n + 1) if n % d == 0]
pairs = [(d, n // d) for d in divs if d * d <= n]
print("делители:", divs)
print("прямоугольники:", pairs)
print("τ(n) =", len(divs), " σ(n) =", sum(divs), " σ(n) − n =", sum(divs) - n)`);
    function draw() {
      const n = s.n;
      const ds = divisors(n);
      chips.textContent = '';
      ds.forEach((d) => chips.appendChild(chip(String(d), d * d === n ? 'on' : null, 'var(--c-orange)')));
      grid.textContent = '';
      ds.filter((d) => d * d <= n).forEach((a, i) => {
        const b = n / a;
        const c = card(a + ' × ' + b);
        const cell = Math.max(4, Math.min(16, Math.floor(130 / Math.max(b, 1))));
        const W = b * cell + 2;
        const Hh = a * cell + 2;
        const svg = S('svg', { viewBox: '0 0 ' + W + ' ' + Hh, style: 'display:block;width:' + W + 'px;max-width:none;height:auto' });
        for (let r = 0; r < a; r++) for (let q = 0; q < b; q++) svg.appendChild(S('rect', { x: 1 + q * cell, y: 1 + r * cell, width: cell - 1, height: cell - 1, rx: 1.5, style: 'fill:' + tint(cvar(i), 55) + ';stroke:' + cvar(i) + ';stroke-width:.8' }));
        c.body.appendChild(svg);
        grid.appendChild(c.el);
      });
      const sg = U.sum(ds);
      const kind = n === 1 ? 'единица' : ds.length === 2 ? 'простое' : sg - n === n ? 'совершенное' : Number.isInteger(Math.sqrt(n)) ? 'полный квадрат' : sg - n > n ? 'избыточное' : 'составное';
      st.set('t', String(ds.length));
      st.set('s', String(sg));
      st.set('k', kind);
      const sq = Number.isInteger(Math.sqrt(n));
      note.innerHTML = '<b>' + n + ' делится на d</b> (пишут d | ' + n + '), если ' + n + ' = d·k для целого k. Делители ходят парами d и ' + n + '/d: один не больше √' + n + ' ≈ ' + f2(Math.sqrt(n)) + ', другой не меньше. Поэтому, чтобы найти все делители, достаточно проверить d ≤ √n — на этом держится проверка простоты пробным делением. ' + (sq ? 'У ' + n + ' пара ' + Math.sqrt(n) + ' × ' + Math.sqrt(n) + ' вырождается в один делитель (оранжевый) — поэтому делителей <b>нечётное</b> число. Это верно только для полных квадратов. ' : 'Делителей чётное число — пары не вырождаются, потому что ' + n + ' не полный квадрат. ') + (kind === 'простое' ? 'Число <b>простое</b>: ровно два делителя, 1 и само ' + n + '. ' : '') + (kind === 'совершенное' ? 'Число <b>совершенное</b>: сумма собственных делителей равна ему самому (' + ds.slice(0, -1).join(' + ') + ' = ' + n + '). ' : '') + 'σ(n) − n = ' + (sg - n) + (sg - n > n ? ' > n — число избыточное.' : sg - n < n ? ' < n — недостаточное.' : ' = n.');
    }
    draw();
  });

  /* ==============================================================================
   * 2. Деление с остатком на числовой прямой
   * ============================================================================== */
  GBC.widget('division-line', (el) => {
    const s = { n: 23, k: 5, conv: 'floor' };
    const w = ui.shell(el, { title: 'Деление с остатком: прыжки по прямой', sub: 'От нуля прыгаем шагами длины k, пока не перепрыгнем n. Число прыжков — частное q, недолёт до n — остаток r. Для отрицательных n языки договариваются по-разному.' });
    ui.slider(w.controls, { label: 'Делимое n', min: -40, max: 60, step: 1, value: s.n, format: (v) => minus(v), onInput: (v) => ((s.n = v), draw()) });
    ui.slider(w.controls, { label: 'Делитель k', min: 1, max: 12, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    ui.segmented(w.controls, { label: 'Соглашение', value: s.conv, options: [{ value: 'floor', label: 'Python: вниз' }, { value: 'trunc', label: 'C, JS: к нулю' }], onChange: (v) => ((s.conv = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 170, grid: 'none', y: { label: '', ticks: [], domain: [-0.75, 1.15] }, x: { label: '', ticks: [] }, margin: { left: 12, right: 12, top: 6, bottom: 8 } });
    const line = monoBox('text-align:center;font-size:1rem');
    const tbl = H('div');
    w.main.append(line, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'q', label: 'частное q' }, { key: 'r', label: 'остаток r' }, { key: 'c', label: 'проверка q·k + r' }]);
    w.pythonAction(() => `import math

n, k = ${s.n}, ${s.k}
q, r = divmod(n, k)                  # Python: q = ⌊n/k⌋, 0 ≤ r < k
print(f"Python:  {n} // {k} = {q},  {n} % {k} = {r}")
qt = math.trunc(n / k)               # C, Java, JavaScript: q к нулю
print(f"C / JS:  q = {qt},  r = {n - qt * k}   (math.fmod: {math.fmod(n, k)})")
print("безопасный остаток в JS: ((n % k) + k) % k =", ((n % k) + k) % k)`);
    function draw() {
      const { n, k } = s;
      const q = s.conv === 'floor' ? Math.floor(n / k) : Math.trunc(n / k);
      const r = n - q * k;
      const lo = Math.min(0, n, q * k) - k * 0.7;
      const hi = Math.max(0, n, q * k) + k * 0.7;
      const mults = U.range(Math.floor(hi / k) - Math.ceil(lo / k) + 1, Math.ceil(lo / k)).map((j) => j * k);
      const every = Math.max(1, Math.ceil(mults.length / 14));
      const L = [
        { type: 'hline', y: 0, color: 'axis', width: 1.2 },
        { type: 'segments', x1: mults, y1: mults.map(() => -0.12), x2: mults, y2: mults.map(() => 0.12), color: 'ink2', width: 1.2, opacity: 0.8 },
        { type: 'text', items: mults.filter((v, i) => (v / k) % every === 0 || i === 0).map((v) => ({ x: v, y: -0.42, anchor: 'middle', text: minus(v), color: 'ink2' })) },
      ];
      const sgn = q >= 0 ? 1 : -1;
      const jumps = U.range(Math.abs(q)).map((j) => j * sgn * k);
      L.push({ type: 'arrows', x1: jumps.map((x) => x + 0.06 * k * sgn), y1: jumps.map(() => 0.45), x2: jumps.map((x) => x + sgn * k - 0.06 * k * sgn), y2: jumps.map(() => 0.45), color: 'model', width: 2 });
      if (Math.abs(q) <= 16) L.push({ type: 'text', items: jumps.map((x, j) => ({ x: x + (sgn * k) / 2, y: 0.72, anchor: 'middle', text: String(j + 1), color: 'ink2' })) });
      if (r !== 0) L.push({ type: 'segments', x1: [q * k], y1: [0.22], x2: [n], y2: [0.22], color: 'tree', width: 5, opacity: 1 }, { type: 'text', x: (q * k + n) / 2, y: 0.22, dy: -9, anchor: 'middle', text: 'r = ' + minus(r), bold: true });
      L.push({ type: 'points', x: [0], y: [0], color: 'ink2', r: 4 }, { type: 'points', x: [n], y: [0], color: 'tree', r: 6, label: 'n' });
      plot.render(L, { x: [lo, hi] });
      line.textContent = minus(n) + ' = ' + minus(q) + ' · ' + k + ' + ' + minus(r) + (s.conv === 'floor' ? '   (0 ≤ r < ' + k + ')' : '   (знак r = знак n)');
      const qf = Math.floor(n / k);
      const qt = Math.trunc(n / k);
      rowTable(tbl, ['язык', 'n // k', 'n % k'], [['Python (вниз)', minus(qf), minus(n - qf * k)], ['C, Java, JavaScript (к нулю)', minus(qt), minus(n - qt * k)]], (i) => (i === 0) === (s.conv === 'floor'), false);
      st.set('q', minus(q));
      st.set('r', minus(r));
      st.set('c', minus(q) + '·' + k + ' + ' + minus(r) + ' = ' + minus(q * k + r));
      note.innerHTML = '<b>Теорема о делении с остатком:</b> для целого n и k > 0 есть ровно одна пара (q, r) с n = q·k + r и 0 ≤ r < k. Почему одна: если бы n = q·k + r = q′·k + r′, то k делит r − r′, а |r − r′| < k — значит, r = r′. ' + (n < 0 ? 'Сейчас n отрицательно, и здесь языки расходятся: Python округляет частное <em>вниз</em> (q = ' + minus(qf) + ', остаток ' + minus(n - qf * k) + ' — неотрицателен, как в теореме), а C, Java и JavaScript — <em>к нулю</em> (q = ' + minus(qt) + ', остаток ' + minus(n - qt * k) + '). Для часов, дней недели и хеш-корзин нужен остаток из теоремы; в JS его получают как ((n % k) + k) % k.' : 'Для n ≥ 0 оба соглашения совпадают. Сдвиньте n в минус — и увидите, где Python и JavaScript расходятся.');
    }
    draw();
  });

  /* ==============================================================================
   * 3. Фолды и батчи: деление с остатком в ML
   * ============================================================================== */
  GBC.widget('kfold-division', (el) => {
    const s = { n: 23, k: 5, b: 8, mode: 'block' };
    const w = ui.shell(el, { title: 'Фолды и батчи: n = q·k + r в машинном обучении', sub: 'Как раздать n объектов на k фолдов или на батчи по b штук? Ровно r = n mod k фолдов получают на один объект больше; последний батч — n mod b объектов.' });
    ui.slider(w.controls, { label: 'Объектов n', min: 5, max: 60, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const kS = ui.slider(w.controls, { label: 'Фолдов k', min: 2, max: 10, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const bS = ui.slider(w.controls, { label: 'Размер батча b', min: 2, max: 16, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.segmented(w.controls, { label: 'Как раздаём', value: s.mode, options: [{ value: 'block', label: 'KFold' }, { value: 'cyc', label: 'по кругу i mod k' }, { value: 'batch', label: 'батчи' }], onChange: (v) => ((s.mode = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 160, grid: 'none', x: { label: '', domain: [-0.6, 19.6], ticks: [] }, y: { label: '', domain: [-4.4, 0.6], ticks: [] }, margin: { left: 8, bottom: 8, right: 8, top: 8 } });
    const bars = new GBC.Plot(w.main, { height: 170, x: { label: 'фолд / батч', domain: [0.4, 10.6], ticks: U.range(30, 1) }, y: { label: 'объектов' } });
    const line = monoBox('text-align:center;font-size:1rem');
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'q', label: 'частное q' }, { key: 'r', label: 'остаток r' }, { key: 'sz', label: 'размеры групп' }]);
    w.pythonAction(() => s.mode === 'batch' ? `n, b = ${s.n}, ${s.b}
full, last = divmod(n, b)
steps = (n + b - 1) // b             # ⌈n / b⌉ без вещественных чисел
print(f"{n} = {full}·{b} + {last}: полных батчей {full}, последний {last or 'не нужен'}")
print("шагов за эпоху:", steps, " (drop_last=True:", full, ")")
print("батчи:", [list(range(i, min(i + b, n))) for i in range(0, n, b)])` : `import numpy as np
from sklearn.model_selection import KFold

n, k = ${s.n}, ${s.k}
q, r = divmod(n, k)
print(f"{n} = {q}·{k} + {r}: {r} фолдов по {q + 1} и {k - r} по {q}")
print("KFold:          ", [len(t) for _, t in KFold(k).split(np.zeros(n))])
print("по кругу i mod k:", [sum(1 for i in range(n) if i % k == f) for f in range(k)])`);
    function draw() {
      const { n, k, b } = s;
      const isB = s.mode === 'batch';
      kS.el.style.display = isB ? 'none' : '';
      bS.el.style.display = isB ? '' : 'none';
      const div = isB ? b : k;
      const q = Math.floor(n / div);
      const r = n % div;
      const grpOf = new Array(n);
      if (isB) for (let i = 0; i < n; i++) grpOf[i] = Math.floor(i / b);
      else if (s.mode === 'cyc') for (let i = 0; i < n; i++) grpOf[i] = i % k;
      else {
        let i = 0;
        for (let f = 0; f < k; f++) for (let j = 0; j < q + (f < r ? 1 : 0); j++) grpOf[i++] = f;
      }
      const G = isB ? Math.ceil(n / b) : k;
      const sizes = U.range(G).map((f) => grpOf.filter((x) => x === f).length);
      const L = [];
      for (let f = 0; f < G; f++) {
        const ids = U.range(n).filter((i) => grpOf[i] === f);
        L.push({ type: 'points', x: ids.map((i) => i % 20), y: ids.map((i) => -1.6 * Math.floor(i / 20)), color: SER[f % 8], r: 7, shape: f >= 8 ? 'square' : undefined });
      }
      L.push({ type: 'text', items: U.range(n).map((i) => ({ x: i % 20, y: -1.6 * Math.floor(i / 20), dy: 20, anchor: 'middle', text: String(grpOf[i] + 1) })) });
      plot.render(L);
      bars.render([{ type: 'bars', x: U.range(G, 1), y: sizes, color: (i) => SER[i % 8], width: 0.7, maxPx: 30 }], { x: [0.4, G + 0.6], y: [0, Math.max(...sizes) + 1.6] });
      line.textContent = n + ' = ' + q + ' · ' + div + ' + ' + r + (isB ? '   →   шагов за эпоху ⌈' + n + '/' + b + '⌉ = ' + G : '');
      st.set('q', String(q));
      st.set('r', String(r));
      st.set('sz', sizes.join(', '));
      note.innerHTML = isB
        ? 'Мини-батчи берут подряд по b объектов: получается ' + q + ' полных ' + plural(q, 'батч', 'батча', 'батчей') + (r ? ' и последний неполный из ' + r + ' = ' + n + ' mod ' + b + '. Шагов за эпоху ⌈n/b⌉ = ' + G + '; в коде пишут <code>(n + b - 1) // b</code> — целочисленно, без округлений. Параметр <code>drop_last=True</code> выбрасывает неполный батч: шагов станет ' + q + ', а ' + r + ' ' + plural(r, 'объект', 'объекта', 'объектов') + ' в этой эпохе модель не увидит.' : ' — остаток 0, все батчи равны: b делит n.')
        : 'Число под точкой — номер фолда. <b>KFold</b> раздаёт объекты блоками: первые r = ' + r + ' ' + plural(r, 'фолд получает', 'фолда получают', 'фолдов получают') + ' по q + 1 = ' + (q + 1) + ', остальные — по q = ' + q + '. Раздача по кругу (объект i — в фолд i mod k) даёт те же размеры, но перемешивает соседей. Для упорядоченных данных (по времени, по x) это важно: блоки без перемешивания дают фолды из разных областей, и валидация оценивает экстраполяцию. ' + (r === 0 ? 'Сейчас k делит n — все фолды равны.' : 'Размеры фолдов отличаются не больше чем на 1 — это и есть смысл неравенства 0 ≤ r < k.');
    }
    draw();
  });

  /* ==============================================================================
   * 4. Системы счисления: перевод повторным делением
   * ============================================================================== */
  GBC.widget('base-convert', (el) => {
    const s = { n: 2026, b: 16, k: 99 };
    const w = ui.shell(el, { title: 'Перевод в систему с основанием b', sub: 'Делим n на b, остаток — младшая цифра; частное снова делим на b — и так до нуля. Цифры читаем снизу вверх.' });
    intField(w.controls, { label: 'Число n (до 10¹⁵)', value: s.n, min: 0, max: 1e15, onChange: (v) => ((s.n = v), reset()) });
    ui.slider(w.controls, { label: 'Основание b', min: 2, max: 36, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Шаг деления', min: 0, max: 4, value: 4, fps: 1.2, format: (k, mx) => (k >= mx ? 'готово' : 'шаг ' + k), onChange: (k) => ((s.k = k), draw()) });
    const tbl = H('div');
    const digits = H('div');
    const back = monoBox('font-size:.9rem');
    w.main.append(tbl, digits, back);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'запись' }, { key: 'L', label: 'цифр' }, { key: 'f', label: '⌊log_b n⌋ + 1' }]);
    const steps = () => {
      const out = [];
      let v = s.n;
      if (v === 0) return [[0, 0, 0]];
      while (v > 0) (out.push([v, Math.floor(v / s.b), v % s.b]), (v = Math.floor(v / s.b)));
      return out;
    };
    function reset() {
      pl.stop();
      const m = steps().length;
      pl.setMax(m);
      pl.set(m);
      s.k = m;
      draw();
    }
    w.pythonAction(() => `n, b = ${s.n}, ${s.b}
DIG = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
v, digits = n, []
while v > 0:
    v, r = divmod(v, b)
    digits.append(DIG[r])
    print(f"{v * b + r:>16} = {v}·{b} + {r}")
s = "".join(reversed(digits)) or "0"
print("запись:", s, " проверка int(s, b):", int(s, b), " цифр:", len(s))
print("bin / oct / hex:", bin(n), oct(n), hex(n))`);
    function draw() {
      const { n, b } = s;
      const all = steps();
      const k = Math.min(s.k, all.length);
      rowTable(tbl, ['шаг', 'делимое', 'частное', 'остаток → цифра'], all.slice(0, k).map(([v, q, r], i) => [String(i + 1), grp(v) + ' = ' + grp(q) + '·' + b + ' + ' + r, grp(q), r + (r > 9 ? ' → ' + DIG[r] : '')]), (i) => i === k - 1);
      const str = toBase(n, b);
      digits.textContent = '';
      const row = flexRow('gap:4px;margin:8px 0 2px;justify-content:center');
      const shown = all.slice(0, k).map((t) => DIG[t[2]]).reverse();
      const pad = all.length - k;
      for (let i = 0; i < pad; i++) row.appendChild(chip('?', 'dim'));
      shown.forEach((d) => row.appendChild(chip(d, 'on')));
      const sb = H('span', { style: 'font-size:.85rem;color:var(--ink-2);margin-left:4px' }, '(' + b + ')');
      row.appendChild(sb);
      digits.appendChild(row);
      const L = str.length;
      back.textContent = k < all.length ? 'Цифры появляются справа налево: первый остаток — младший разряд.' : 'Обратно (схема Горнера): ' + str.split('').map((d, i) => DIG.indexOf(d) + (L - 1 - i > 0 ? '·' + b + (L - 1 - i > 1 ? sup(L - 1 - i) : '') : '')).join(' + ') + ' = ' + grp(n);
      st.set('r', str + sub(b));
      st.set('L', String(L));
      st.set('f', n > 0 ? String(Math.floor(Math.log(n) / Math.log(b) + 1e-12) + 1) : '—');
      note.innerHTML = 'Почему остатки — это цифры: запись n = d<sub>L−1</sub>·b<sup>L−1</sup> + … + d₁·b + d₀ показывает, что n = (d<sub>L−1</sub>·b<sup>L−2</sup> + … + d₁)·b + d₀, где 0 ≤ d₀ < b. По теореме о делении с остатком такое представление единственно — значит, d₀ = n mod b, а оставшиеся цифры — запись частного. Длина записи — ⌊log<sub>b</sub> n⌋ + 1: в двоичной системе ' + grp(n) + ' занимает ' + (n > 0 ? Math.floor(Math.log2(n)) + 1 : 1) + ' бит, в десятичной — ' + String(n).length + ' цифр. Шестнадцатеричная цифра — ровно 4 бита (16 = 2⁴), поэтому программисты пишут байты двумя такими цифрами: 255 = FF₁₆ = 11111111₂.';
    }
    reset();
  });

  /* ==============================================================================
   * 5. Универсальный признак делимости: веса 10^k mod d
   * ============================================================================== */
  GBC.widget('div-tests', (el) => {
    const s = { str: '918082', d: 11, signed: true };
    const w = ui.shell(el, { title: 'Признаки делимости: один рецепт для всех', sub: 'Цифра в разряде k весит 10ᵏ. По модулю d вес заменяем на остаток 10ᵏ mod d — и получаем признак делимости на любое d.' });
    textField(w.controls, { label: 'Число (до 30 цифр)', value: s.str, help: 'только цифры', onChange: (v) => {
      const t = v.replace(/[\s ]/g, '');
      if (!/^\d{1,30}$/.test(t)) return 'нужно от 1 до 30 цифр';
      s.str = t.replace(/^0+(?=\d)/, '');
      draw();
      return '';
    } });
    ui.slider(w.controls, { label: 'Делитель d', min: 2, max: 13, step: 1, value: s.d, format: String, onInput: (v) => ((s.d = v), draw()) });
    ui.toggle(w.controls, { label: 'Веса со знаком (−1 вместо d − 1)', checked: s.signed, onChange: (v) => ((s.signed = v), draw()) });
    const svgWrap = H('div');
    const calc = monoBox();
    const rule = H('div');
    w.main.append(svgWrap, calc, rule);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'S', label: 'взвешенная сумма S' }, { key: 'r', label: 'S mod d = n mod d' }, { key: 'v', label: 'делится?' }]);
    const RULES = {
      2: 'смотрим последнюю цифру: 10 ≡ 0 (mod 2), все старшие веса — нули.',
      3: 'сумма цифр: 10 ≡ 1 (mod 3), все веса — единицы.',
      4: 'последние две цифры: 100 ≡ 0 (mod 4).',
      5: 'последняя цифра: 10 ≡ 0 (mod 5).',
      6: 'делится на 2 и на 3 одновременно (6 = 2·3, НОД(2, 3) = 1).',
      7: 'веса 1, 3, 2, −1, −3, −2 повторяются с периодом 6; удобнее группировать по три цифры: 1000 ≡ −1 (mod 7).',
      8: 'последние три цифры: 1000 ≡ 0 (mod 8).',
      9: 'сумма цифр: 10 ≡ 1 (mod 9).',
      10: 'последняя цифра 0.',
      11: 'знакочередующаяся сумма цифр справа налево: 10 ≡ −1 (mod 11).',
      12: 'делится на 3 и на 4 (12 = 3·4).',
      13: 'веса 1, −3, −4, −1, 3, 4 (период 6); тоже работает тройками: 1000 ≡ −1 (mod 13), ведь 1001 = 7·11·13.',
    };
    w.pythonAction(() => `n_str, d = "${s.str}", ${s.d}
weights = [pow(10, k, d) for k in range(len(n_str))]          # вес разряда k: 10**k mod d
${s.signed ? 'weights = [w - d if w > d // 2 else w for w in weights]   # со знаком: −1 вместо d − 1\n' : ''}S = sum(int(c) * wk for c, wk in zip(reversed(n_str), weights))
print("веса справа налево:", weights)
print("S =", S, " S mod d =", S % d, " n mod d =", int(n_str) % d)`);
    function draw() {
      const { str, d } = s;
      const L = str.length;
      const wts = U.range(L).map((k) => {
        let v = powmod(10, k, d);
        if (s.signed && v > Math.floor(d / 2)) v -= d;
        return v;
      });
      const digs = str.split('').map(Number);
      let sum = 0;
      for (let k = 0; k < L; k++) sum += digs[L - 1 - k] * wts[k];
      const real = Number(BigInt(str) % BigInt(d));
      svgWrap.textContent = '';
      const cw = 34;
      const W = Math.max(L * cw + 70, 200);
      const svg = svgBox(svgWrap, W, 96, Math.min(W, 520), W * 1.35);
      svg.appendChild(sText(30, 22, 'цифры', { size: 11, color: 'var(--ink-2)' }));
      svg.appendChild(sText(30, 58, 'веса', { size: 11, color: 'var(--ink-2)' }));
      svg.appendChild(sText(30, 84, 'вклад', { size: 11, color: 'var(--ink-2)' }));
      for (let i = 0; i < L; i++) {
        const k = L - 1 - i;
        const x = 64 + i * cw;
        const wv = wts[k];
        const c = wv === 0 ? 'var(--muted)' : wv > 0 ? 'var(--c-blue)' : 'var(--c-orange)';
        svg.appendChild(S('rect', { x: x - 14, y: 8, width: 28, height: 28, rx: 6, style: 'fill:' + (wv === 0 ? 'var(--surface-2)' : tint(c, 25)) + ';stroke:' + c + ';stroke-width:1.5' }));
        svg.appendChild(sText(x, 22, String(digs[i]), { mono: true, bold: true, size: 15, color: wv === 0 ? 'var(--muted)' : 'var(--ink)' }));
        svg.appendChild(sText(x, 58, (wv > 0 && s.signed ? '+' : '') + minus(wv), { mono: true, size: 13, color: c }));
        svg.appendChild(sText(x, 84, minus(digs[i] * wv), { mono: true, size: 11, color: 'var(--ink-2)' }));
      }
      const terms = U.range(L).map((i) => [digs[i], wts[L - 1 - i]]).filter(([dg, wv]) => dg && wv);
      calc.textContent = 'S = ' + (terms.length ? terms.map(([dg, wv], i) => (i === 0 ? (wv < 0 ? '−' : '') : wv < 0 ? ' − ' : ' + ') + dg + (Math.abs(wv) !== 1 ? '·' + Math.abs(wv) : '')).join('') : '0') + ' = ' + minus(sum) + '\nS mod ' + d + ' = ' + mod(sum, d) + ';   проверка: ' + str + ' mod ' + d + ' = ' + real;
      rule.textContent = '';
      rule.appendChild(H('div', { style: 'font-size:.9rem;color:var(--ink-2);margin-top:4px' }, H('b', { style: 'color:var(--ink)' }, 'Школьный признак для ' + d + ': '), RULES[d]));
      st.set('S', minus(sum));
      st.set('r', String(mod(sum, d)));
      st.set('v', real === 0 ? 'да' : 'нет, остаток ' + real);
      note.innerHTML = 'Почему это работает: n = Σ c<sub>k</sub>·10<sup>k</sup>, а остатки можно брать у каждого слагаемого и множителя отдельно (шаг 16). Заменив 10<sup>k</sup> на его остаток w<sub>k</sub>, получаем S ≡ n (mod d) — меньшее число с тем же остатком. Веса <b>периодичны</b>: 10<sup>k</sup> mod ' + d + ' = ' + U.range(Math.min(8, L + 2)).map((k) => powmod(10, k, d)).join(', ') + ', … ' + (gcd(10, d) === 1 ? '— повторяются с периодом ' + (() => { let k = 1; let x = 10 % d; while (x !== 1) (x = (x * 10) % d), k++; return k; })() + ' (это порядок 10 по модулю d, шаг 19).' : '— после нескольких разрядов становятся нулями, потому что d делит степень десятки: хватает последних цифр.') + ' Признак не «магия», а сравнения по модулю. Тот же приём «сверка девятками» ловит ошибки в ручном умножении: остатки множителей по модулю 9 перемножаются.';
    }
    draw();
  });

  /* ==============================================================================
   * 6. НОД и НОК: общие делители и общие кратные
   * ============================================================================== */
  GBC.widget('gcd-lcm-sets', (el) => {
    const s = { a: 12, b: 18 };
    const w = ui.shell(el, { title: 'НОД и НОК: общие делители и встреча кратных', sub: 'Сверху — делители a и b, общие подсвечены, наибольший из них — НОД. Снизу два «кузнечика» прыгают шагами a и b; первая общая точка — НОК.' });
    ui.slider(w.controls, { label: 'a', min: 1, max: 60, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'b', min: 1, max: 60, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    const ca = flexRow('margin:2px 0');
    const cb = flexRow('margin:2px 0 6px');
    w.main.append(ca, cb);
    const plot = new GBC.Plot(w.main, { height: 150, grid: 'none', y: { label: '', ticks: [], domain: [-0.7, 1.7] }, x: { label: 'кратные' }, margin: { left: 30, right: 12, top: 4, bottom: 34 } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'НОД(a, b)' }, { key: 'l', label: 'НОК(a, b)' }, { key: 'c', label: 'НОД · НОК = a · b' }]);
    w.pythonAction(() => `import math

a, b = ${s.a}, ${s.b}
da = {d for d in range(1, a + 1) if a % d == 0}
db = {d for d in range(1, b + 1) if b % d == 0}
print("общие делители:", sorted(da & db), " НОД =", max(da & db), "=", math.gcd(a, b))
L = next(m for m in range(max(a, b), a * b + 1) if m % a == 0 and m % b == 0)
print("первое общее кратное:", L, " НОК =", math.lcm(a, b))
print("НОД · НОК =", math.gcd(a, b) * L, " a · b =", a * b)`);
    function draw() {
      const { a, b } = s;
      const g = gcd(a, b);
      const l = lcm(a, b);
      const da = divisors(a);
      const db = new Set(divisors(b));
      const common = new Set(da.filter((d) => db.has(d)));
      ca.textContent = '';
      cb.textContent = '';
      ca.appendChild(H('span', { style: 'font-size:.85rem;color:var(--ink-2);min-width:96px;white-space:nowrap' }, 'делители ' + a + ':'));
      da.forEach((d) => ca.appendChild(chip(String(d), common.has(d) ? 'on' : null, d === g ? 'var(--c-orange)' : 'var(--c-blue)')));
      cb.appendChild(H('span', { style: 'font-size:.85rem;color:var(--ink-2);min-width:96px;white-space:nowrap' }, 'делители ' + b + ':'));
      divisors(b).forEach((d) => cb.appendChild(chip(String(d), common.has(d) ? 'on' : null, d === g ? 'var(--c-orange)' : 'var(--c-blue)')));
      const ma = U.range(l / a + 1).map((j) => j * a);
      const mb = U.range(l / b + 1).map((j) => j * b);
      const L = [
        { type: 'hline', y: 1, color: 'grid', width: 1 },
        { type: 'hline', y: 0, color: 'grid', width: 1 },
        { type: 'arrows', x1: ma.slice(0, -1), y1: ma.slice(0, -1).map(() => 1.12), x2: ma.slice(1), y2: ma.slice(1).map(() => 1.12), color: 'blue', width: 1.4, opacity: 0.6 },
        { type: 'arrows', x1: mb.slice(0, -1), y1: mb.slice(0, -1).map(() => -0.12), x2: mb.slice(1), y2: mb.slice(1).map(() => -0.12), color: 'orange', width: 1.4, opacity: 0.6 },
        { type: 'points', x: ma, y: ma.map(() => 1), color: 'blue', r: 4, label: 'кратные ' + a },
        { type: 'points', x: mb, y: mb.map(() => 0), color: 'orange', r: 4, label: 'кратные ' + b },
        { type: 'vline', x: l, color: 'ink', dash: '4 3', width: 1.5 },
        { type: 'text', x: l, y: 1.5, anchor: 'end', dx: -4, text: 'НОК = ' + l, bold: true },
        { type: 'text', x: 0, y: 1, dx: -6, dy: 4, anchor: 'end', text: String(a), color: 'ink2' },
        { type: 'text', x: 0, y: 0, dx: -6, dy: 4, anchor: 'end', text: String(b), color: 'ink2' },
      ];
      plot.render(L, { x: [0, l * 1.03] });
      st.set('g', String(g));
      st.set('l', String(l));
      st.set('c', g + ' · ' + l + ' = ' + g * l);
      note.innerHTML = '<b>НОД</b> — наибольший общий делитель, <b>НОК</b> — наименьшее общее кратное. Они связаны: НОД(a, b) · НОК(a, b) = a · b (при a = ' + a + ', b = ' + b + ': ' + g + ' · ' + l + ' = ' + a * b + '). ' + (g === 1 ? 'Сейчас НОД = 1 — числа <b>взаимно простые</b>, и кузнечики впервые встречаются только в точке a · b.' : 'Кузнечики встречаются в каждой точке, кратной НОК, — а все общие делители (подсвечены) делят НОД = ' + g + '.') + ' Практический смысл: два периодических процесса с периодами ' + a + ' и ' + b + ' (два cron-задания, два цикла скорости обучения) снова совпадут через НОК = ' + l + '; дробь ' + a + '/' + b + ' сокращается на НОД до ' + a / g + '/' + b / g + '.';
    }
    draw();
  });

  /* ==============================================================================
   * 7. Алгоритм Евклида: квадраты в прямоугольнике
   * ============================================================================== */
  GBC.widget('euclid', (el) => {
    const s = { a: 252, b: 198, k: 0, mode: 'div' };
    const w = ui.shell(el, { title: 'Алгоритм Евклида: НОД через квадраты', sub: 'Из прямоугольника a × b вырезаем самые большие квадраты, пока можно. Сторона последнего квадрата, которым остаток режется без остатка, — НОД(a, b).' });
    ui.slider(w.controls, { label: 'a', min: 1, max: 300, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), reset()) });
    ui.slider(w.controls, { label: 'b', min: 1, max: 300, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), reset()) });
    ui.segmented(w.controls, { label: 'Шаг алгоритма', value: s.mode, options: [{ value: 'div', label: 'деление с остатком' }, { value: 'sub', label: 'вычитание' }], onChange: (v) => ((s.mode = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Шаг', min: 0, max: 4, value: 4, fps: 1.5, format: (k, mx) => 'шаг ' + k + ' из ' + mx, onChange: (k) => ((s.k = k), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, equal: true, grid: 'none', x: { label: '', ticks: [] }, y: { label: '', ticks: [] }, margin: { left: 8, bottom: 8, right: 8, top: 8 } });
    const line = monoBox();
    w.main.appendChild(line);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'НОД' }, { key: 'nd', label: 'шагов делением' }, { key: 'ns', label: 'шагов вычитанием' }]);
    /** Список квадратов: [x0, y0, side, номер шага делением]. Шаг в режиме «вычитание» — один квадрат. */
    function squares() {
      const out = [];
      let [x0, y0, W, Hh] = [0, 0, Math.max(s.a, s.b), Math.min(s.a, s.b)];
      let step = 0;
      while (W > 0 && Hh > 0) {
        const side = Math.min(W, Hh);
        const q = Math.floor(Math.max(W, Hh) / side);
        for (let j = 0; j < q; j++) {
          if (W >= Hh) out.push([x0 + j * side, y0, side, step]);
          else out.push([x0, y0 + j * side, side, step]);
        }
        if (W >= Hh) (x0 += q * side), (W -= q * side);
        else (y0 += q * side), (Hh -= q * side);
        step++;
      }
      return out;
    }
    const divSteps = () => {
      const out = [];
      let [a, b] = [Math.max(s.a, s.b), Math.min(s.a, s.b)];
      while (b) (out.push([a, b, Math.floor(a / b), a % b]), ([a, b] = [b, a % b]));
      return out;
    };
    const nSteps = () => (s.mode === 'div' ? divSteps().length : squares().length);
    function reset() {
      pl.stop();
      pl.setMax(nSteps());
      pl.set(nSteps());
      s.k = nSteps();
      draw();
    }
    w.pythonAction(() => `a, b = ${s.a}, ${s.b}
x, y, steps = max(a, b), min(a, b), 0
while y:
    print(f"{x} = {x // y}·{y} + {x % y}")
    x, y = y, x % y
    steps += 1
print("НОД =", x, " шагов делением:", steps)

x, y, subs = a, b, 0
while x != y:                        # вариант Евклида с вычитанием
    x, y = (x - y, y) if x > y else (x, y - x)
    subs += 1
print("вычитаний до равенства:", subs)`);
    function draw() {
      const W = Math.max(s.a, s.b);
      const Hh = Math.min(s.a, s.b);
      const sq = squares();
      const ds = divSteps();
      const lastStep = ds.length - 1;
      const L = [{ type: 'rect', x0: 0, x1: W, y0: 0, y1: Hh, stroke: 'ink', fill: 'surface', opacity: 0, width: 2 }];
      const shown = s.mode === 'div' ? sq.filter((q) => q[3] < s.k) : sq.slice(0, s.k);
      shown.forEach(([x0, y0, side, step]) => L.push({ type: 'rect', x0, x1: x0 + side, y0, y1: y0 + side, fill: step === lastStep ? 'tree' : step % 2 ? 'aqua' : 'blue', stroke: 'surface', width: 1.5, opacity: step === lastStep ? 0.8 : 0.5 }));
      plot.render(L, { x: [-W * 0.02, W * 1.02], y: [-Hh * 0.04, Hh * 1.04] });
      const g = gcd(s.a, s.b);
      const kDiv = s.mode === 'div' ? s.k : shown.length ? shown[shown.length - 1][3] + 1 : 0;
      line.textContent = ds.slice(0, kDiv).map(([a, b, q, r]) => a + ' = ' + q + ' · ' + b + ' + ' + r).join('\n') + (kDiv === ds.length && (s.mode === 'div' || s.k === sq.length) ? '\nНОД(' + s.a + ', ' + s.b + ') = ' + g : '');
      st.set('g', String(g));
      st.set('nd', String(ds.length));
      st.set('ns', String(sq.length));
      const digits = String(Math.min(s.a, s.b)).length;
      note.innerHTML = 'Ключевой факт: <b>НОД(a, b) = НОД(b, a mod b)</b>. Любой общий делитель a и b делит и a − q·b = r, а любой общий делитель b и r делит и a = q·b + r — пары (a, b) и (b, r) имеют одни и те же общие делители. Числа быстро уменьшаются: остаток меньше половины делимого каждые два шага, поэтому шагов не больше примерно 5 × (число цифр меньшего числа) — здесь не больше ' + 5 * digits + ' (теорема Ламе). Худший случай — соседние числа Фибоначчи (попробуйте 89 и 55: 9 шагов, все частные равны 1). Вариант с вычитанием отрезает по одному квадрату: для 300 и 1 это 300 вычитаний (квадратов) вместо одного деления — деление с остатком «сжимает» серию одинаковых вычитаний в один шаг.';
    }
    reset();
  });

  /* ==============================================================================
   * 7. Карта: шаги алгоритма Евклида и НОД для всех пар
   * ============================================================================== */
  GBC.widget('euclid-map', (el) => {
    const s = { N: 100, mode: 'steps' };
    const w = ui.shell(el, { title: 'Карта пар (a, b): шаги Евклида и НОД', sub: 'Каждый пиксель — пара чисел: a по горизонтали, b по вертикали (снизу вверх). Цвет — число шагов алгоритма или значение НОД. Наведите курсор, чтобы увидеть пару.' });
    ui.slider(w.controls, { label: 'До N', values: [30, 60, 100, 150, 200], value: s.N, format: String, onInput: (v) => ((s.N = v), draw()) });
    ui.segmented(w.controls, { label: 'Цвет', value: s.mode, options: [{ value: 'steps', label: 'шагов' }, { value: 'gcd', label: 'НОД' }, { value: 'cop', label: 'НОД = 1' }], onChange: (v) => ((s.mode = v), draw()) });
    const read = monoBox('text-align:center;min-height:1.6em');
    const pc = pixelCanvas(w.main, { maxW: 420, onHover: (p) => hover(p) });
    w.main.appendChild(read);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'mx', label: 'максимум шагов' }, { key: 'av', label: 'в среднем шагов' }, { key: 'cp', label: 'доля пар с НОД = 1' }]);
    const stepsOf = (a, b) => {
      let k = 0;
      while (b) ([a, b] = [b, a % b]), k++;
      return k;
    };
    let cache = null;
    function compute() {
      const N = s.N;
      const st0 = new Uint8Array(N * N);
      const g0 = new Uint16Array(N * N);
      for (let a = 1; a <= N; a++) for (let b = 1; b <= N; b++) (st0[(a - 1) * N + b - 1] = stepsOf(a, b)), (g0[(a - 1) * N + b - 1] = gcd(a, b));
      cache = { N, st0, g0 };
    }
    function hover(p) {
      if (!p) return (read.textContent = 'наведите курсор на пиксель');
      const a = p[0] + 1;
      const b = s.N - p[1];
      read.textContent = '(a, b) = (' + a + ', ' + b + '):  шагов ' + stepsOf(a, b) + ',  НОД = ' + gcd(a, b);
    }
    w.pythonAction(() => `import matplotlib.pyplot as plt
import numpy as np
from math import gcd

N = ${s.N}
def steps(a, b):
    k = 0
    while b:
        a, b, k = b, a % b, k + 1
    return k

S = np.array([[steps(a, b) for a in range(1, N + 1)] for b in range(1, N + 1)])
G = np.array([[gcd(a, b) for a in range(1, N + 1)] for b in range(1, N + 1)])
print("максимум шагов:", S.max(), "в паре", np.unravel_index(S.argmax(), S.shape)[::-1] + np.array(1))
print("в среднем шагов:", S.mean().round(3), " доля НОД = 1:", (G == 1).mean().round(4))
plt.imshow(${s.mode === 'steps' ? 'S' : s.mode === 'gcd' ? 'np.log(G)' : 'G == 1'}, origin="lower", extent=(0.5, N + 0.5, 0.5, N + 0.5), cmap="Blues")
plt.xlabel("a"); plt.ylabel("b"); plt.colorbar(); plt.show()`);
    function draw() {
      if (!cache || cache.N !== s.N) compute();
      const { N, st0, g0 } = cache;
      let mx = 0;
      let arg = [1, 1];
      let sum = 0;
      let cop = 0;
      for (let a = 1; a <= N; a++)
        for (let b = 1; b <= N; b++) {
          const v = st0[(a - 1) * N + b - 1];
          sum += v;
          if (v > mx) (mx = v), (arg = [a, b]);
          if (g0[(a - 1) * N + b - 1] === 1) cop++;
        }
      const sc = seqScale('blue');
      const scO = seqScale('orange');
      const lnN = Math.log(N);
      pc.draw(N, N, (i, j) => {
        const a = i + 1;
        const b = N - j;
        const idx = (a - 1) * N + b - 1;
        if (s.mode === 'steps') return sc(st0[idx] / mx);
        if (s.mode === 'gcd') return g0[idx] === 1 ? sc(0) : scO(0.15 + (0.85 * Math.log(g0[idx])) / lnN);
        return g0[idx] === 1 ? sc(0.85) : sc(0);
      });
      hover(null);
      st.set('mx', mx + ' в (' + arg[0] + ', ' + arg[1] + ')');
      st.set('av', f2(sum / (N * N)));
      st.set('cp', pct(cop / (N * N)));
      note.innerHTML = s.mode === 'steps'
        ? 'Насыщенно-синие полосы — пары, где алгоритм работает долго; самые насыщенные точки лежат около прямых b ≈ 0.618·a и a ≈ 0.618·b — там отношение близко к золотому сечению, и все частные равны 1, как у чисел Фибоначчи. Максимум — ' + mx + ' шагов у пары (' + arg[0] + ', ' + arg[1] + '). При этом в среднем шагов всего ' + f2(sum / (N * N)) + ': алгоритм Евклида работает за время, пропорциональное числу цифр, а не самим числам.'
        : s.mode === 'gcd'
          ? 'Оранжевые лучи из начала координат — пары с большим НОД: на прямой b = (p/q)·a лежат точки (kq, kp), и НОД растёт вдоль луча. Наклонные «трещины» вдоль b = a, b = 2a, b = a/2 — места, где одно число делит другое. Синие (НОД = 1) пары занимают ' + pct(cop / (N * N)) + ' площади — к этому числу мы вернёмся в шаге 10.'
          : 'Синие пиксели — взаимно простые пары. Их доля ' + pct(cop / (N * N)) + ' и с ростом N стремится к 6/π² ≈ 60.8 % (шаг 10). Пустые строки и столбцы с узором — числа с маленькими простыми делителями: у чётного a половина пар уже «занята» двойкой.';
    }
    draw();
  });

  /* ==============================================================================
   * 8. Расширенный алгоритм Евклида: таблица и соотношение Безу
   * ============================================================================== */
  GBC.widget('bezout-table', (el) => {
    const s = { a: 252, b: 198, k: 99 };
    const w = ui.shell(el, { title: 'Расширенный алгоритм Евклида', sub: 'Каждая строка хранит остаток rᵢ вместе с числами xᵢ, yᵢ, для которых rᵢ = a·xᵢ + b·yᵢ. Новая строка = (строка на две выше) − q · (строка выше) — сразу для r, x и y.' });
    ui.slider(w.controls, { label: 'a', min: 1, max: 300, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), reset()) });
    ui.slider(w.controls, { label: 'b', min: 1, max: 300, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), reset()) });
    const pl = ui.player(w.controls, { label: 'Строка', min: 2, max: 4, value: 4, fps: 1, format: (k) => 'строк ' + k, onChange: (k) => ((s.k = k), draw()) });
    const tbl = H('div');
    const chk = monoBox('font-size:.92rem');
    const sols = H('div');
    w.main.append(tbl, chk, sols);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'НОД' }, { key: 'x', label: 'x' }, { key: 'y', label: 'y' }]);
    const rows = () => {
      const out = [[s.a, '', 1, 0], [s.b, '', 0, 1]];
      while (out[out.length - 1][0] !== 0) {
        const [r0, , x0, y0] = out[out.length - 2];
        const [r1, , x1, y1] = out[out.length - 1];
        const q = Math.floor(r0 / r1);
        out[out.length - 1][1] = q;
        out.push([r0 - q * r1, '', x0 - q * x1, y0 - q * y1]);
      }
      return out;
    };
    function reset() {
      pl.stop();
      const n = rows().length;
      pl.setMax(n);
      pl.set(n);
      s.k = n;
      draw();
    }
    w.pythonAction(() => `a, b = ${s.a}, ${s.b}
rows = [(a, 1, 0), (b, 0, 1)]                       # (r, x, y): r = a·x + b·y
while rows[-1][0] != 0:
    (r0, x0, y0), (r1, x1, y1) = rows[-2], rows[-1]
    q = r0 // r1
    rows.append((r0 - q * r1, x0 - q * x1, y0 - q * y1))
for r, x, y in rows:
    print(f"{r:5} = {a}·({x}) + {b}·({y})")
g, x, y = rows[-2]
print("НОД =", g, " Безу:", f"{a}·{x} + {b}·{y} = {a * x + b * y}")
print("pow(a, -1, b) — обратный, если НОД = 1:", pow(a, -1, b) if g == 1 else "нет")`);
    function draw() {
      const R = rows();
      const k = Math.min(s.k, R.length);
      const fin = R.length - 2;
      rowTable(tbl, ['i', 'rᵢ', 'qᵢ', 'xᵢ', 'yᵢ', 'проверка a·xᵢ + b·yᵢ'], R.slice(0, k).map(([r, q, x, y], i) => [String(i), String(r), i + 1 < k && q !== '' ? String(q) : '', minus(x), minus(y), s.a + '·(' + minus(x) + ') + ' + s.b + '·(' + minus(y) + ') = ' + minus(s.a * x + s.b * y)]), (i) => i === fin && k === R.length);
      const [g, x, y] = [R[fin][0], R[fin][2], R[fin][3]];
      chk.textContent = k === R.length ? 'Последний ненулевой остаток — НОД:  ' + s.a + '·(' + minus(x) + ') + ' + s.b + '·(' + minus(y) + ') = ' + g : 'Следующая строка = строка (i − 2) − q · строка (i − 1).';
      sols.textContent = '';
      if (k === R.length) {
        const da = s.b / g;
        const db = s.a / g;
        rowTable(sols, ['t', 'x + t·b/g', 'y − t·a/g', 'a·x + b·y'], [-2, -1, 0, 1, 2].map((t) => [minus(t), minus(x + t * da), minus(y - t * db), String(s.a * (x + t * da) + s.b * (y - t * db))]), (i) => i === 2);
      }
      st.set('g', String(g));
      st.set('x', minus(x));
      st.set('y', minus(y));
      note.innerHTML = '<b>Соотношение Безу:</b> для любых a, b есть целые x, y с a·x + b·y = НОД(a, b). Более того, НОД — <em>наименьшее</em> положительное число вида a·x + b·y, а все такие числа — кратные НОД. Таблица строит x и y «по пути»: строки — линейные комбинации a и b, и операция «вычесть q раз предыдущую строку» сохраняет равенство r = a·x + b·y. Решение не единственно: к x можно прибавить b/g, отняв от y a/g (нижняя таблица). ' + (g === 1 ? 'Сейчас НОД = 1, поэтому ' + s.a + '·(' + minus(x) + ') ≡ 1 (mod ' + s.b + '): x = ' + minus(x) + ' ≡ ' + mod(x, s.b) + ' — <b>обратный к ' + s.a + ' по модулю ' + s.b + '</b> (шаг 18). Так находят ключ RSA (шаг 25).' : 'НОД = ' + g + ' > 1: числа вида ' + s.a + 'x + ' + s.b + 'y — только кратные ' + g + ', число 1 так не получить.');
    }
    reset();
  });

  /* ==============================================================================
   * 9. Линейное диофантово уравнение a·x + b·y = c на решётке
   * ============================================================================== */
  GBC.widget('diophantine', (el) => {
    const s = { a: 3, b: 5, c: 22 };
    const w = ui.shell(el, { title: 'Уравнение a·x + b·y = c в целых числах', sub: 'Прямая a·x + b·y = c и узлы целочисленной решётки. Целые решения — узлы на прямой; они идут с постоянным шагом. Оранжевые — с x, y ≥ 0.' });
    ui.slider(w.controls, { label: 'a', min: 1, max: 12, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'b', min: 1, max: 12, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.slider(w.controls, { label: 'c', min: -40, max: 60, step: 1, value: s.c, format: minus, onInput: (v) => ((s.c = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 330, equal: true, x: { label: 'x', domain: [-12, 12], ticks: [-12, -8, -4, 0, 4, 8, 12] }, y: { label: 'y', domain: [-12, 12], ticks: [-12, -8, -4, 0, 4, 8, 12] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'НОД(a, b)' }, { key: 'p', label: 'частное решение' }, { key: 'n', label: 'решений с x, y ≥ 0' }]);
    w.pythonAction(() => `import math

a, b, c = ${s.a}, ${s.b}, ${s.c}
g = math.gcd(a, b)
if c % g:
    print(f"решений нет: НОД({a}, {b}) = {g} не делит {c}")
else:
    sols = [(x, (c - a * x) // b) for x in range(-50, 51) if (c - a * x) % b == 0]
    print("решения (часть):", [s for s in sols if abs(s[0]) <= 12 and abs(s[1]) <= 12])
    print("шаг между решениями:", (b // g, -a // g))
    print("с x, y ≥ 0:", [s for s in sols if s[0] >= 0 and s[1] >= 0])`);
    function draw() {
      const { a, b, c } = s;
      const g = gcd(a, b);
      const L = [{ type: 'hline', y: 0, color: 'axis', width: 1 }, { type: 'vline', x: 0, color: 'axis', width: 1 }];
      const gx = [];
      const gy = [];
      for (let x = -12; x <= 12; x++) for (let y = -12; y <= 12; y++) (gx.push(x), gy.push(y));
      L.push({ type: 'points', x: gx, y: gy, color: 'grid', r: 1.8, hover: false });
      const xs = [-14, 14];
      L.push({ type: 'line', x: xs, y: xs.map((x) => (c - a * x) / b), color: 'model', width: 2, label: a + 'x + ' + b + 'y = ' + minus(c) });
      let sols = [];
      let part = '—';
      if (c % g === 0) {
        const [, x0, y0] = extGcd(a, b);
        const X0 = (x0 * c) / g;
        const Y0 = (y0 * c) / g;
        const dx = b / g;
        const dy = a / g;
        for (let t = -80; t <= 80; t++) sols.push([X0 + t * dx, Y0 - t * dy]);
        const nn = sols.filter(([x, y]) => x >= 0 && y >= 0);
        sols = sols.filter(([x, y]) => Math.abs(x) <= 12 && Math.abs(y) <= 12);
        const pos = sols.filter(([x, y]) => x >= 0 && y >= 0);
        const neg = sols.filter(([x, y]) => !(x >= 0 && y >= 0));
        L.push({ type: 'points', x: neg.map((p) => p[0]), y: neg.map((p) => p[1]), color: 'model', r: 5, label: 'целые решения', tooltip: (i) => [a + '·' + minus(neg[i][0]) + ' + ' + b + '·' + minus(neg[i][1]) + ' = ' + minus(c)] });
        if (pos.length) L.push({ type: 'points', x: pos.map((p) => p[0]), y: pos.map((p) => p[1]), color: 'tree', r: 6, label: 'x, y ≥ 0', tooltip: (i) => [a + '·' + pos[i][0] + ' + ' + b + '·' + pos[i][1] + ' = ' + c] });
        if (sols.length >= 2) L.push({ type: 'arrows', x1: [sols[0][0]], y1: [sols[0][1]], x2: [sols[1][0]], y2: [sols[1][1]], color: 'ink2', width: 1.5 });
        const tr = Math.floor(X0 / dx);
        part = '(' + minus(X0 - tr * dx) + ', ' + minus(Y0 + tr * dy) + ')';
        st.set('n', String(nn.length));
        note.innerHTML = 'Решения есть, потому что НОД(' + a + ', ' + b + ') = ' + g + ' делит ' + minus(c) + '. Рецепт: соотношение Безу даёт ' + a + '·(' + minus(x0) + ') + ' + b + '·(' + minus(y0) + ') = ' + g + '; умножаем на ' + minus(c / g) + ' — получаем решение (' + minus(X0) + ', ' + minus(Y0) + '), а сдвигом приводим его к наименьшему неотрицательному x: ' + part + '. Все остальные — сдвиги на шаг (' + dx + ', −' + dy + ') = (b/g, −a/g): прибавка a·b/g к первому слагаемому компенсируется вычетом из второго. ' + (nn.length ? 'Неотрицательных решений ' + nn.length + ': ' + nn.slice(0, 6).map((p) => '(' + p[0] + ', ' + p[1] + ')').join(', ') + (nn.length > 6 ? ', …' : '') + ' — это способы набрать ' + c + ' монетами ' + a + ' и ' + b + '.' : 'Неотрицательных решений нет — сумму ' + minus(c) + ' монетами ' + a + ' и ' + b + ' не набрать (виджет ниже).');
      } else {
        st.set('n', '0');
        note.innerHTML = 'Решений нет: левая часть a·x + b·y при любых целых x, y делится на НОД(' + a + ', ' + b + ') = ' + g + ', а ' + minus(c) + ' на ' + g + ' не делится. Прямая проходит мимо всех узлов решётки. Сдвиньте c на ближайшее кратное ' + g + ' — узлы появятся.';
      }
      plot.render(L);
      st.set('g', String(g));
      st.set('p', part);
    }
    draw();
  });

  /* ==============================================================================
   * 9. Монеты и число Фробениуса
   * ============================================================================== */
  GBC.widget('coins-frobenius', (el) => {
    const s = { a: 3, b: 5, c: 0 };
    const w = ui.shell(el, { title: 'Какие суммы можно набрать монетами', sub: 'Синие клетки — суммы, которые набираются монетами a и b (и c, если задана) без сдачи; серые — нельзя. Наибольшая ненабираемая сумма — число Фробениуса.' });
    ui.slider(w.controls, { label: 'Монета a', min: 2, max: 20, step: 1, value: s.a, format: String, onInput: (v) => ((s.a = v), draw()) });
    ui.slider(w.controls, { label: 'Монета b', min: 2, max: 20, step: 1, value: s.b, format: String, onInput: (v) => ((s.b = v), draw()) });
    ui.slider(w.controls, { label: 'Монета c (0 — нет)', values: [0, 2, 3, 4, 5, 6, 7, 9, 11, 13, 20], value: s.c, format: (v) => (v ? String(v) : 'нет'), onInput: (v) => ((s.c = v), draw()) });
    const svgWrap = H('div');
    w.main.appendChild(svgWrap);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'g', label: 'НОД монет' }, { key: 'f', label: 'число Фробениуса' }, { key: 'n', label: 'ненабираемых сумм' }]);
    w.pythonAction(() => `import math

coins = [${[s.a, s.b, s.c].filter(Boolean).join(', ')}]
N = 300
ok = [True] + [False] * N
for v in range(1, N + 1):
    ok[v] = any(v >= c and ok[v - c] for c in coins)
bad = [v for v in range(N + 1) if not ok[v]]
print("НОД монет:", math.gcd(*coins))
print("ненабираемые (до", N, "):", bad if len(bad) < 40 else bad[:40] + ["…"])
if math.gcd(*coins) == 1:
    print("число Фробениуса:", max(bad), " их количество:", len(bad))
if len(coins) == 2 and math.gcd(*coins) == 1:
    a, b = coins
    print("формулы: a·b − a − b =", a * b - a - b, " (a − 1)(b − 1)/2 =", (a - 1) * (b - 1) // 2)`);
    function draw() {
      const coins = [s.a, s.b, s.c].filter(Boolean);
      const g = coins.reduce(gcd);
      const LIM = 600;
      const ok = new Uint8Array(LIM + 1);
      ok[0] = 1;
      for (let v = 1; v <= LIM; v++) ok[v] = coins.some((c) => v >= c && ok[v - c]) ? 1 : 0;
      let frob = -1;
      let nbad = 0;
      if (g === 1) for (let v = 0; v <= LIM; v++) if (!ok[v]) (frob = v), nbad++;
      const N = g === 1 ? Math.min(LIM, Math.max(59, Math.ceil((frob + 21) / 10) * 10 - 1)) : 99;
      const cols = 10;
      const rowsN = Math.ceil((N + 1) / cols);
      const cw = 40;
      const ch = 26;
      svgWrap.textContent = '';
      const svg = svgBox(svgWrap, cols * cw + 4, rowsN * ch + 4, 330, 520);
      for (let v = 0; v <= N; v++) {
        const x = 2 + (v % cols) * cw;
        const y = 2 + Math.floor(v / cols) * ch;
        const isF = v === frob;
        const fill = ok[v] ? tint('var(--c-blue)', 35) : isF ? tint('var(--c-orange)', 45) : 'var(--surface-2)';
        svg.appendChild(S('rect', { x, y, width: cw - 3, height: ch - 3, rx: 5, style: 'fill:' + fill + ';stroke:' + (isF ? 'var(--c-orange)' : 'var(--border)') + ';stroke-width:' + (isF ? 2 : 1) }));
        svg.appendChild(sText(x + (cw - 3) / 2, y + (ch - 3) / 2, String(v), { mono: true, size: 12, bold: isF, color: ok[v] ? 'var(--ink)' : 'var(--ink-2)' }));
      }
      st.set('g', String(g));
      st.set('f', g === 1 ? String(frob) : 'нет (∞)');
      st.set('n', g === 1 ? String(nbad) : 'бесконечно');
      const two = coins.length === 2;
      note.innerHTML = g !== 1
        ? 'НОД монет = ' + g + ' > 1: любая набранная сумма кратна ' + g + ', поэтому ненабираемых сумм бесконечно много. Взаимная простота монет — необходимое условие.'
        : 'Монеты взаимно просты, поэтому начиная с ' + (frob + 1) + ' набирается <em>любая</em> сумма: среди ' + Math.min(...coins) + ' подряд идущих набираемых сумм есть все остатки по модулю ' + Math.min(...coins) + ', и дальше достаточно добавлять самую мелкую монету. ' + (two ? 'Для двух монет есть формула (Сильвестр, 1884): наибольшая ненабираемая сумма a·b − a − b = ' + (s.a * s.b - s.a - s.b) + ', а всего ненабираемых (a − 1)(b − 1)/2 = ' + ((s.a - 1) * (s.b - 1)) / 2 + '. Ровно половина чисел от 0 до ab − a − b набирается: из пары n и ab − a − b − n набирается ровно одно число.' : 'Для трёх и более монет простой формулы нет — задача Фробениуса в общем виде NP-трудна; знаменитый пример — наггетсы по 6, 9 и 20 штук: нельзя купить ровно 43.');
    }
    draw();
  });

  /* ==============================================================================
   * 10. Взаимно простые пары: видимые точки и 6/π²
   * ============================================================================== */
  GBC.widget('coprime-grid', (el) => {
    const s = { N: 50 };
    const w = ui.shell(el, { title: 'Сад из точек: какие видны из начала координат', sub: 'В каждом узле (a, b) растёт дерево. Из точки (0, 0) видно дерево, только если его не загораживает более близкое на том же луче — то есть если НОД(a, b) = 1. Синие — видимые.' });
    ui.slider(w.controls, { label: 'Размер сада N', values: [10, 20, 50, 100, 200, 400], value: s.N, format: String, onInput: (v) => ((s.N = v), draw()) });
    const read = monoBox('text-align:center;min-height:1.6em');
    const pc = pixelCanvas(w.main, { maxW: 400, onHover: (p) => hover(p) });
    w.main.appendChild(read);
    const conv = new GBC.Plot(w.main, { height: 190, x: { label: 'N', type: 'log', domain: [10, 1000], ticks: [10, 30, 100, 300, 1000] }, y: { label: 'доля видимых', domain: [0.55, 0.7] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'v', label: 'видимых' }, { key: 'sh', label: 'доля' }, { key: 'th', label: '6/π²' }]);
    const curve = (() => {
      const Ns = [10, 15, 20, 30, 40, 50, 70, 100, 150, 200, 300, 500, 700, 1000];
      const out = [];
      let cnt = 0;
      let done = 0;
      // доля взаимно простых пар в квадрате N × N, наращиваем по слоям
      for (const N of Ns) {
        for (let a = done + 1; a <= N; a++) {
          for (let b = 1; b < a; b++) if (gcd(a, b) === 1) cnt += 2;
          if (a === 1) cnt += 1;
        }
        done = N;
        out.push([N, cnt / (N * N)]);
      }
      return out;
    })();
    function hover(p) {
      if (!p) return (read.textContent = 'наведите курсор на точку');
      const a = p[0] + 1;
      const b = s.N - p[1];
      const g = gcd(a, b);
      read.textContent = '(' + a + ', ' + b + '): НОД = ' + g + (g === 1 ? ' — видно' : ' — загорожено деревом (' + a / g + ', ' + b / g + ')');
    }
    w.pythonAction(() => `import math

for N in (10, 100, 1000):
    c = sum(1 for a in range(1, N + 1) for b in range(1, N + 1) if math.gcd(a, b) == 1)
    print(f"N = {N:5}: доля взаимно простых пар {c / N**2:.6f}")
print("6/π² =", 6 / math.pi ** 2)
P = 1.0
for p in [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]:
    P *= 1 - 1 / p ** 2               # p не делит оба числа
print("произведение (1 − 1/p²) по простым до 47:", round(P, 4))`);
    function draw() {
      const N = s.N;
      let v = 0;
      const on = seqScale('blue')(0.85);
      const off = seqScale('blue')(0.04);
      pc.draw(N, N, (i, j) => {
        const g = gcd(i + 1, N - j);
        return g === 1 ? on : off;
      });
      for (let a = 1; a <= N; a++) for (let b = 1; b <= N; b++) if (gcd(a, b) === 1) v++;
      conv.render([
        { type: 'line', x: curve.map((p) => p[0]), y: curve.map((p) => p[1]), color: 'model', width: 2, label: 'доля видимых в N × N' },
        { type: 'points', x: curve.map((p) => p[0]), y: curve.map((p) => p[1]), color: 'model', r: 3.5 },
        { type: 'hline', y: 6 / Math.PI ** 2, color: 'tree', dash: '6 4', width: 1.5, label: '6/π² ≈ 0.6079' },
        { type: 'points', x: [N], y: [v / (N * N)], color: 'tree', r: 6 },
      ]);
      hover(null);
      st.set('v', grp(v) + ' из ' + grp(N * N));
      st.set('sh', f3(v / (N * N)));
      st.set('th', '0.608');
      note.innerHTML = 'Точка (a, b) с НОД = g > 1 загорожена точкой (a/g, b/g) — она лежит на том же луче ближе к нам. Поэтому «видимые деревья» — ровно <b>взаимно простые пары</b>. Их доля стремится к <b>6/π² ≈ 0.6079</b>. Откуда π: для каждого простого p вероятность, что p делит оба случайных числа, равна 1/p², и эти события независимы (китайская теорема об остатках, шаг 22). Значит, вероятность взаимной простоты — произведение (1 − 1/p²) по всем простым, а оно равно 1/ζ(2) = 1/(1 + 1/4 + 1/9 + …) = 6/π² — ряд из урока 15.10. Простые числа «знают» о π через бесконечное произведение Эйлера. На практике: случайная дробь a/b несократима с вероятностью около 61 %.';
    }
    draw();
  });

  /* ==============================================================================
   * 11. Решето Эратосфена
   * ============================================================================== */
  GBC.widget('sieve', (el) => {
    const s = { N: 120, cols: 10, k: 0 };
    const w = ui.shell(el, { title: 'Решето Эратосфена', sub: 'Берём очередное невычеркнутое число p — оно простое — и вычёркиваем его кратные, начиная с p². Достаточно дойти до √N: всё, что осталось, — простые.' });
    ui.slider(w.controls, { label: 'До N', values: [60, 120, 210], value: s.N, format: String, onInput: (v) => ((s.N = v), reset()) });
    ui.segmented(w.controls, { label: 'Чисел в строке', value: s.cols, options: [{ value: 10, label: '10' }, { value: 6, label: '6' }], onChange: (v) => ((s.cols = v), draw()) });
    const pl = ui.player(w.controls, { label: 'Шаг решета', min: 0, max: 5, value: 0, fps: 0.8, format: (k, mx) => (k === 0 ? 'начало' : k < mx ? 'p = ' + PR()[k - 1] : 'готово'), onChange: (k) => ((s.k = k), draw()) });
    const svgWrap = H('div');
    w.main.appendChild(svgWrap);
    const leg = legendRow([['var(--c-orange)', 'вычеркнуто на этом шаге'], ['var(--c-blue)', 'простое (уже известно)'], ['var(--muted)', 'вычеркнуто раньше']]);
    w.main.appendChild(leg);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pi', label: 'простых до N' }, { key: 'cur', label: 'вычеркнуто на шаге' }, { key: 'rt', label: '√N' }]);
    const PR = () => primesTo(Math.floor(Math.sqrt(s.N)));
    function reset() {
      pl.stop();
      pl.setMax(PR().length + 1);
      pl.set(0);
      s.k = 0;
      draw();
    }
    w.pythonAction(() => `import math

N = ${s.N}
is_p = [False, False] + [True] * (N - 1)
for p in range(2, math.isqrt(N) + 1):
    if is_p[p]:
        crossed = list(range(p * p, N + 1, p))
        for q in crossed:
            is_p[q] = False
        print(f"p = {p}: вычёркиваем {len(crossed)} чисел, начиная с {p * p}")
primes = [n for n in range(N + 1) if is_p[n]]
print("простых до", N, ":", len(primes))
print(primes)`);
    function draw() {
      const { N, cols } = s;
      const P = PR();
      const crossedBy = new Array(N + 1).fill(0);
      const done = P.slice(0, Math.min(s.k, P.length));
      done.forEach((p, i) => {
        for (let q = p * p; q <= N; q += p) if (!crossedBy[q]) crossedBy[q] = i + 1;
      });
      const cur = s.k >= 1 && s.k <= P.length ? s.k : 0;
      const fin = s.k > P.length;
      const rowsN = Math.ceil(N / cols);
      const cw = cols === 6 ? 52 : 40;
      const ch = 26;
      svgWrap.textContent = '';
      const svg = svgBox(svgWrap, cols * cw + 4, rowsN * ch + 4, cols === 6 ? 300 : 330, cols === 6 ? 380 : 480);
      let curCount = 0;
      for (let v = 1; v <= N; v++) {
        const c = (v - 1) % cols;
        const r = Math.floor((v - 1) / cols);
        let fill = 'var(--surface)';
        let stroke = 'var(--border)';
        let col = 'var(--ink)';
        let bold = false;
        const known = (cur && v < P[cur - 1] * P[cur - 1] && v > 1 && !crossedBy[v]) || (fin && v > 1 && !crossedBy[v]) || done.includes(v);
        if (v === 1) (fill = 'var(--surface-2)'), (col = 'var(--muted)');
        else if (crossedBy[v] && crossedBy[v] === cur) (fill = tint('var(--c-orange)', 40)), (stroke = 'var(--c-orange)'), curCount++;
        else if (crossedBy[v]) (fill = 'var(--surface-2)'), (col = 'var(--muted)');
        else if (known) (fill = tint('var(--c-blue)', 35)), (stroke = 'var(--c-blue)'), (bold = true);
        const x = 2 + c * cw;
        const y = 2 + r * ch;
        svg.appendChild(S('rect', { x, y, width: cw - 3, height: ch - 3, rx: 5, style: 'fill:' + fill + ';stroke:' + stroke + ';stroke-width:1.2' }));
        svg.appendChild(sText(x + (cw - 3) / 2, y + (ch - 3) / 2, String(v), { mono: true, size: 12, bold, color: col }));
        if (crossedBy[v] && crossedBy[v] !== cur) svg.appendChild(S('line', { x1: x + 6, y1: y + ch - 9, x2: x + cw - 9, y2: y + 6, style: 'stroke:var(--muted);stroke-width:1' }));
      }
      const pi = U.range(N, 1).filter((v) => isPrime(v)).length;
      st.set('pi', String(pi));
      st.set('cur', cur ? String(curCount) : '—');
      st.set('rt', f2(Math.sqrt(N)));
      note.innerHTML = (cur ? 'Шаг p = ' + P[cur - 1] + ': вычёркиваем ' + P[cur - 1] + '², ' + P[cur - 1] + '² + ' + P[cur - 1] + ', … Начинать раньше незачем: меньшие кратные p·k (k < p) уже вычеркнуты при простом делителе числа k. ' : fin ? 'Готово: всё невычеркнутое — простые, их ' + pi + '. Почему хватило p ≤ √' + N + ': у составного n ≤ ' + N + ' есть делитель не больше √n — он бы его вычеркнул. ' : 'Запустите решето кнопкой ▶. ') + (cols === 6 ? 'В строках по 6 все простые, кроме 2 и 3, стоят в столбцах 1 и 5: числа 6k, 6k + 2, 6k + 3, 6k + 4 делятся на 2 или 3. Значит, каждое простое p > 3 имеет вид 6k ± 1 (но не наоборот: 25 = 6·4 + 1).' : 'Переключитесь на 6 чисел в строке — проявится закономерность 6k ± 1.') + ' Сложность решета — около N·ln ln N операций: для N = 10⁶ это несколько миллионов простых действий, доли секунды.';
    }
    reset();
  });

  /* ==============================================================================
   * 12. Основная теорема арифметики: дерево разложения и показатели
   * ============================================================================== */
  GBC.widget('factor-tree', (el) => {
    const s = { n: 360, m: 84, how: 'small' };
    const w = ui.shell(el, { title: 'Дерево разложения и показатели степеней', sub: 'Делим число на два множителя, пока не останутся простые. Деревья бывают разные, листья — всегда одни и те же. Вторым числом проверяем: НОД и НОК — это минимумы и максимумы показателей.' });
    intField(w.controls, { label: 'n', value: s.n, min: 2, max: 1e9, onChange: (v) => ((s.n = v), draw()) });
    intField(w.controls, { label: 'второе число m', value: s.m, min: 1, max: 1e9, onChange: (v) => ((s.m = v), draw()) });
    ui.segmented(w.controls, { label: 'Как делить', value: s.how, options: [{ value: 'small', label: 'на наименьший простой' }, { value: 'mid', label: 'на близкие множители' }], onChange: (v) => ((s.how = v), draw()) });
    const svgWrap = H('div');
    const tbl = H('div');
    w.main.append(svgWrap, tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'f', label: 'n =' }, { key: 'td', label: 'τ(n), σ(n)' }, { key: 'gl', label: 'НОД(n, m), НОК(n, m)' }]);
    function build(v) {
      if (isPrime(v)) return { v };
      let d;
      if (s.how === 'small') d = factorize(v)[0][0];
      else {
        d = 1;
        for (let k = Math.floor(Math.sqrt(v)); k >= 2; k--)
          if (v % k === 0) {
            d = k;
            break;
          }
      }
      return { v, kids: [build(d), build(v / d)] };
    }
    w.pythonAction(() => `import math

def factorize(n):
    out, p = {}, 2
    while p * p <= n:
        while n % p == 0:
            out[p] = out.get(p, 0) + 1
            n //= p
        p += 1
    if n > 1:
        out[n] = out.get(n, 0) + 1
    return out

n, m = ${s.n}, ${s.m}
fn, fm = factorize(n), factorize(m)
print("n =", fn, " m =", fm)
ps = sorted(set(fn) | set(fm))
gcd_ = math.prod(p ** min(fn.get(p, 0), fm.get(p, 0)) for p in ps)
lcm_ = math.prod(p ** max(fn.get(p, 0), fm.get(p, 0)) for p in ps)
print("НОД по показателям:", gcd_, "=", math.gcd(n, m), " НОК:", lcm_, "=", math.lcm(n, m))
print("τ(n) =", math.prod(e + 1 for e in fn.values()), " σ(n) =", math.prod((p ** (e + 1) - 1) // (p - 1) for p, e in fn.items()))`);
    function draw() {
      const tree = build(s.n);
      let leaf = 0;
      let depth = 0;
      const place = (node, d) => {
        node.d = d;
        depth = Math.max(depth, d);
        if (!node.kids) node.x = leaf++;
        else {
          node.kids.forEach((k) => place(k, d + 1));
          node.x = (node.kids[0].x + node.kids[1].x) / 2;
        }
      };
      place(tree, 0);
      const dx = 58;
      const dy = 52;
      const W = Math.max(leaf * dx + 20, 160);
      const Hh = depth * dy + 46;
      svgWrap.textContent = '';
      const svg = svgBox(svgWrap, W, Hh, Math.min(W, 560), Math.max(W, 260));
      const X = (n) => 10 + dx / 2 + n.x * dx;
      const Y = (n) => 22 + n.d * dy;
      const walk = (n) => {
        if (n.kids)
          n.kids.forEach((k) => {
            svg.appendChild(S('line', { x1: X(n), y1: Y(n) + 11, x2: X(k), y2: Y(k) - 11, style: 'stroke:var(--border-strong);stroke-width:1.5' }));
            walk(k);
          });
        const pr = !n.kids;
        const txt = grp(n.v);
        const wbox = Math.max(30, txt.length * 8.5 + 12);
        svg.appendChild(S('rect', { x: X(n) - wbox / 2, y: Y(n) - 12, width: wbox, height: 24, rx: pr ? 12 : 5, style: 'fill:' + (pr ? tint('var(--c-blue)', 35) : 'var(--surface-2)') + ';stroke:' + (pr ? 'var(--c-blue)' : 'var(--border-strong)') + ';stroke-width:1.5' }));
        svg.appendChild(sText(X(n), Y(n), txt, { mono: true, size: 12, bold: pr }));
      };
      walk(tree);
      const fn = factorize(s.n);
      const fm = factorize(s.m);
      const ps = Array.from(new Set(fn.map((f) => f[0]).concat(fm.map((f) => f[0])))).sort((a, b) => a - b);
      const e = (f, p) => (f.find((t) => t[0] === p) || [p, 0])[1];
      rowTable(tbl, ['простое p', 'показатель в n', 'в m', 'min → НОД', 'max → НОК'], ps.map((p) => [String(p), String(e(fn, p)), String(e(fm, p)), String(Math.min(e(fn, p), e(fm, p))), String(Math.max(e(fn, p), e(fm, p)))]));
      const g = gcd(s.n, s.m);
      const l = lcm(s.n, s.m);
      st.set('f', fstr(fn));
      st.set('td', tau(s.n) + ', ' + grp(sigma(s.n)));
      st.set('gl', grp(g) + ', ' + (l <= Number.MAX_SAFE_INTEGER ? grp(l) : '> 2⁵³'));
      note.innerHTML = '<b>Основная теорема арифметики:</b> каждое n > 1 раскладывается в произведение простых, и притом единственным образом с точностью до порядка. Существование очевидно — делим, пока делится. Единственность — нет: её доказывают через <b>лемму Евклида</b> «если простое p делит a·b, то p делит a или b» (а лемму — через соотношение Безу). Переключите способ деления: дерево меняется, листья — нет. Из разложения сразу следует всё остальное: делитель n — это произведение тех же простых в степенях не выше; поэтому делителей τ(n) = ' + fn.map(([, k]) => '(' + k + ' + 1)').join('·') + ' = ' + tau(s.n) + ', НОД берёт минимальные показатели, НОК — максимальные (таблица), а НОД·НОК = n·m, потому что min + max = сумма.';
    }
    draw();
  });

  /* ==============================================================================
   * 13. Бесконечность простых: числа Евклида и пустыни составных
   * ============================================================================== */
  GBC.widget('euclid-primes', (el) => {
    const s = { k: 6, mode: 'euclid', n: 6 };
    const w = ui.shell(el, { title: 'Простых бесконечно много — и бывают длинные пустыни', sub: 'Доказательство Евклида: перемножим известные простые и прибавим 1. Получится число, которое не делится ни на одно из них, — значит, у него есть новый простой делитель.' });
    ui.segmented(w.controls, { label: 'Опыт', value: s.mode, options: [{ value: 'euclid', label: 'числа Евклида' }, { value: 'desert', label: 'пустыня n! + 2 … n! + n' }], onChange: (v) => ((s.mode = v), draw()) });
    const kS = ui.slider(w.controls, { label: 'Взять первые k простых', min: 1, max: 10, step: 1, value: s.k, format: String, onInput: (v) => ((s.k = v), draw()) });
    const nS = ui.slider(w.controls, { label: 'n', min: 3, max: 14, step: 1, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const box = H('div');
    w.main.appendChild(box);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '' }, { key: 'b', label: '' }, { key: 'c', label: '' }]);
    const stK = w.foot.querySelectorAll('.stat .k');
    const setLabels = (arr) => arr.forEach((t, i) => (stK[i].textContent = t));
    w.pythonAction(() => s.mode === 'euclid' ? `def factorize(n):
    out, p = [], 2
    while p * p <= n:
        while n % p == 0:
            out.append(p)
            n //= p
        p += 1
    return out + ([n] if n > 1 else [])

primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29][:${s.k}]
P = 1
for p in primes:
    P *= p
N = P + 1
print(f"{' · '.join(map(str, primes))} + 1 = {N} = {' · '.join(map(str, factorize(N)))}")
print("остатки N по модулю известных простых:", [N % p for p in primes])` : `import math

n = ${s.n}
F = math.factorial(n)
for j in range(2, n + 1):
    print(f"{n}! + {j} = {F + j} делится на {j}")
print("подряд составных:", n - 1)`);
    function draw() {
      const isE = s.mode === 'euclid';
      kS.el.style.display = isE ? '' : 'none';
      nS.el.style.display = isE ? 'none' : '';
      box.textContent = '';
      if (isE) {
        const P = primesTo(30).slice(0, s.k);
        const prod = P.reduce((a, p) => a * p, 1);
        const N = prod + 1;
        const fN = factorize(N);
        const row = flexRow('margin:6px 0');
        P.forEach((p) => row.appendChild(chip(String(p), null)));
        row.appendChild(H('span', { style: 'font-family:var(--font-mono);font-size:.95rem;margin:0 4px' }, '→  ' + P.join('·') + ' + 1 = ' + grp(N) + ' = '));
        fN.forEach(([p, e]) => row.appendChild(chip(grp(p) + (e > 1 ? sup(e) : ''), 'on', 'var(--c-orange)')));
        box.appendChild(row);
        const tdiv = H('div');
        box.appendChild(tdiv);
        rowTable(tdiv, ['p', 'N mod p'], P.map((p) => [String(p), String(N % p)]));
        setLabels(['N = p₁·…·p_k + 1', 'N простое?', 'новые простые']);
        st.set('a', grp(N));
        st.set('b', fN.length === 1 && fN[0][1] === 1 ? 'да' : 'нет');
        st.set('c', fN.map((f) => grp(f[0])).join(', '));
        note.innerHTML = 'Остаток N при делении на каждое из взятых простых равен 1 (таблица): N = p·(…) + 1. Но у N > 1 есть простой делитель — значит, он новый. Какой бы конечный список простых мы ни взяли, найдётся простое вне его: <b>простых бесконечно много</b>. Частая ошибка — думать, что само N всегда простое: 2·3·5·7·11 + 1 = 2311 простое, а 2·3·5·7·11·13 + 1 = 30 031 = 59 · 509. Доказательству это не мешает: новые простые 59 и 509 тоже не из списка.';
      } else {
        const n = s.n;
        let F = 1;
        for (let i = 2; i <= n; i++) F *= i;
        const rows = U.range(n - 1, 2).map((j) => [n + '! + ' + j, grp(F + j), 'делится на ' + j]);
        rowTable(box, ['число', 'значение', 'почему составное'], rows, null, false);
        setLabels([n + '!', 'составных подряд', 'наибольший разрыв до 10⁶']);
        st.set('a', grp(F));
        st.set('b', String(n - 1));
        st.set('c', '114 (после 492 113)');
        note.innerHTML = 'Число n! + j при 2 ≤ j ≤ n делится на j: j входит в n!, и n! + j = j·(n!/j + 1). Получаем n − 1 составных чисел подряд — пустыню любой длины. Простых бесконечно много, но промежутки между ними неограниченно растут. Правда, факториал — грубая оценка: настоящие пустыни встречаются гораздо раньше. Первая серия из 33 составных — между простыми 1327 и 1361, а до миллиона самый длинный разрыв — 114 чисел. С другой стороны, <b>постулат Бертрана</b> гарантирует: между n и 2n всегда есть простое.';
      }
    }
    draw();
  });

  /* ==============================================================================
   * 14. Распределение простых: π(x), x/ln x, Li(x)
   * ============================================================================== */
  GBC.widget('prime-count', (el) => {
    const s = { X: 10000, view: 'count' };
    const w = ui.shell(el, { title: 'Сколько простых до x: π(x) и её приближения', sub: 'π(x) — число простых, не превосходящих x. Гаусс заметил, что плотность простых около x — примерно 1/ln x. Отсюда x/ln x и точнее — интегральный логарифм Li(x).' });
    ui.slider(w.controls, { label: 'До x', values: [100, 1000, 10000, 100000, 1000000], value: s.X, format: (v) => grp(v), onInput: (v) => ((s.X = v), draw()) });
    ui.segmented(w.controls, { label: 'Показать', value: s.view, options: [{ value: 'count', label: 'π(x)' }, { value: 'ratio', label: 'отношения' }, { value: 'gap', label: 'разрывы' }], onChange: (v) => ((s.view = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 280, x: { label: 'x' }, y: { label: 'простых ≤ x' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'pi', label: 'π(x)' }, { key: 'xl', label: 'x / ln x' }, { key: 'li', label: 'Li(x)' }]);
    w.pythonAction(() => `import math

X = ${s.X}
is_p = bytearray([1]) * (X + 1)
is_p[0] = is_p[1] = 0
for p in range(2, math.isqrt(X) + 1):
    if is_p[p]:
        is_p[p * p :: p] = bytes(len(is_p[p * p :: p]))

def li(x):                           # ряд: γ + ln ln x + Σ (ln x)^k / (k·k!)
    L, term, s = math.log(x), 1.0, 0.0
    for k in range(1, 200):
        term *= L / k
        s += term / k
    return 0.5772156649015329 + math.log(L) + s

pi = 0
for x in range(2, X + 1):
    pi += is_p[x]
    if x in (100, 1000, 10**4, 10**5, 10**6):
        print(f"x = {x:>8}: π(x) = {pi:6}, x/ln x = {x / math.log(x):9.1f}, Li(x) = {li(x) - li(2):9.1f}")`);
    function draw() {
      const X = s.X;
      const sv = sieveTo(Math.max(X, 1000));
      const n = 400;
      const xs = U.range(n, 1).map((i) => Math.max(3, Math.round((i * X) / n)));
      const pis = [];
      let c = 0;
      let j = 0;
      for (let x = 1; x <= X; x++) {
        c += sv[x];
        while (j < xs.length && xs[j] === x) (pis.push(c), j++);
      }
      const L = [];
      if (s.view === 'count') {
        plot.opts.y.label = 'простых ≤ x';
        L.push({ type: 'line', x: xs, y: pis, color: 'model', width: 2, label: 'π(x)', curve: 'step' });
        L.push({ type: 'line', x: xs, y: xs.map((x) => x / Math.log(x)), color: 'tree', width: 2, dash: '6 4', label: 'x / ln x' });
        L.push({ type: 'line', x: xs, y: xs.map(Li), color: 'aqua', width: 2, dash: '2 3', label: 'Li(x)' });
        plot.render(L, { x: [0, X], y: 'auto' });
      } else if (s.view === 'ratio') {
        plot.opts.y.label = 'отношение';
        L.push({ type: 'line', x: xs, y: xs.map((x, i) => pis[i] / (x / Math.log(x))), color: 'tree', width: 2, label: 'π(x) / (x/ln x)' });
        L.push({ type: 'line', x: xs, y: xs.map((x, i) => pis[i] / Li(x)), color: 'aqua', width: 2, label: 'π(x) / Li(x)' });
        L.push({ type: 'hline', y: 1, color: 'ink2', dash: '3 3', width: 1 });
        plot.render(L, { x: [0, X], y: [0.6, 1.4] });
      } else {
        plot.opts.y.label = 'разрыв до следующего простого';
        const P = primesTo(X + 200).filter((p) => p <= X);
        const step = Math.max(1, Math.floor(P.length / 1500));
        const px = [];
        const py = [];
        for (let i = 0; i < P.length - 1; i += step) (px.push(P[i]), py.push(P[i + 1] - P[i]));
        L.push({ type: 'points', x: px, y: py, color: 'model', r: 2, opacity: 0.6, label: 'разрыв pₙ₊₁ − pₙ' });
        L.push({ type: 'line', x: xs, y: xs.map((x) => Math.log(x)), color: 'tree', width: 2, label: 'ln x — средний разрыв' });
        plot.render(L, { x: [0, X], y: [0, Math.max(...py) * 1.08] });
      }
      const piX = pis[pis.length - 1];
      st.set('pi', grp(piX));
      st.set('xl', grp(Math.round(X / Math.log(X))));
      st.set('li', grp(Math.round(Li(X))));
      note.innerHTML = '<b>Теорема о распределении простых</b> (Адамар и Валле-Пуссен, 1896): π(x) / (x / ln x) → 1. Сходимость медленная: до ' + grp(X) + ' отношение ' + f3(piX / (X / Math.log(X))) + ', и даже до миллиона — 1.084. Интегральный логарифм Li(x) = ∫₂ˣ dt / ln t — «сумма плотностей» — точнее на порядки: при x = 10⁶ π(x) = 78 498, Li(x) ≈ 78 627, а x / ln x ≈ 72 382. Смысл для практики: около x простое примерно каждое ln x-е число — около 10⁶ каждое 14-е, около 10³⁰⁰ (размер ключей RSA) — каждое 690-е. Поэтому большие простые для криптографии находят просто перебором случайных нечётных кандидатов с быстрым тестом простоты (шаг 24). Насколько точно Li(x) приближает π(x) — вопрос гипотезы Римана, главной нерешённой задачи математики.';
    }
    draw();
  });

  /* ==============================================================================
   * 14. Спираль Улама
   * ============================================================================== */
  GBC.widget('ulam-spiral', (el) => {
    const s = { size: 201, start: 1, poly: false };
    const w = ui.shell(el, { title: 'Спираль Улама', sub: 'Выписываем числа по квадратной спирали от центра и закрашиваем простые. Неожиданно проступают диагональные линии — значения квадратичных многочленов.' });
    ui.slider(w.controls, { label: 'Сторона', values: [51, 101, 201, 301], value: s.size, format: String, onInput: (v) => ((s.size = v), draw()) });
    ui.segmented(w.controls, { label: 'Первое число в центре', value: s.start, options: [{ value: 1, label: '1' }, { value: 41, label: '41' }], onChange: (v) => ((s.start = v), draw()) });
    ui.toggle(w.controls, { label: 'Подсветить n² + n + 41', checked: s.poly, onChange: (v) => ((s.poly = v), draw()) });
    const read = monoBox('text-align:center;min-height:1.6em');
    let grid = null;
    const pc = pixelCanvas(w.main, { maxW: 440, onHover: (p) => {
      if (!p || !grid) return (read.textContent = 'наведите курсор на клетку');
      const v = grid[p[1] * s.size + p[0]];
      read.textContent = grp(v) + (isPrime(v) ? ' — простое' : ' = ' + fstr(factorize(v)));
    } });
    w.main.appendChild(read);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'n', label: 'числа' }, { key: 'p', label: 'простых' }, { key: 'pp', label: 'n² + n + 41 простое при n = 0…' }]);
    w.pythonAction(() => `import matplotlib.pyplot as plt
import numpy as np

size, start = ${s.size}, ${s.start}
N = size * size + start
is_p = np.ones(N + 1, bool); is_p[:2] = False
for p in range(2, int(N ** 0.5) + 1):
    if is_p[p]:
        is_p[p * p :: p] = False
grid = np.zeros((size, size), int)
x = y = size // 2
dx, dy, run, v = 1, 0, 1, start
grid[y, x] = v
while v < start + size * size - 1:
    for _ in range(2):
        for _ in range(run):
            x, y, v = x + dx, y + dy, v + 1
            if 0 <= x < size and 0 <= y < size:
                grid[y, x] = v
        dx, dy = dy, -dx               # поворот на 90°
    run += 1
plt.imshow(is_p[grid], cmap="Blues")
plt.axis("off"); plt.show()
print("n² + n + 41 простое для n < 40:", all(is_p[n * n + n + 41] for n in range(40)), "; n = 40:", 40 * 40 + 40 + 41, "= 41²")`);
    function draw() {
      const size = s.size;
      const start = s.start;
      sieveTo(Math.max(1000, size * size + start + 10));
      grid = new Int32Array(size * size);
      let x = Math.floor(size / 2);
      let y = Math.floor(size / 2);
      let dx = 1;
      let dy = 0;
      let run = 1;
      let v = start;
      grid[y * size + x] = v;
      const last = start + size * size - 1;
      while (v < last) {
        for (let t = 0; t < 2 && v < last; t++) {
          for (let r = 0; r < run && v < last; r++) {
            x += dx;
            y += dy;
            v++;
            if (x >= 0 && y >= 0 && x < size && y < size) grid[y * size + x] = v;
          }
          [dx, dy] = [dy, -dx];
        }
        run++;
      }
      const polyVals = new Set();
      if (s.poly) for (let n = 0; n * n + n + 41 <= last; n++) polyVals.add(n * n + n + 41);
      const on = RGB('blue');
      const hot = RGB('orange');
      const hotDim = mixRGB(RGB('surface'), RGB('orange'), 0.35);
      let np = 0;
      pc.draw(size, size, (i, j) => {
        const val = grid[j * size + i];
        const pr = isPrime(val);
        if (polyVals.has(val)) return pr ? hot : hotDim;
        return pr ? on : null;
      });
      for (let i = 0; i < grid.length; i++) if (isPrime(grid[i])) np++;
      let k = 0;
      while (isPrime(k * k + k + 41)) k++;
      st.set('n', grp(start) + ' … ' + grp(last));
      st.set('p', grp(np) + ' (' + pct(np / grid.length) + ')');
      st.set('pp', '…' + (k - 1));
      note.innerHTML = 'Диагонали спирали — это значения квадратичных многочленов вида 4n² + bn + c: при каждом обходе витка число растёт на величину, которая сама растёт линейно. Некоторые многочлены дают простые подозрительно часто. Чемпион — многочлен Эйлера n² + n + 41: он простой при n = 0, 1, …, 39 и впервые даёт составное при n = 40 (1681 = 41²); среди n < 100 простыми оказываются 86 значений. Поставьте 41 в центр и включите подсветку — многочлен ляжет на одну диагональ. Но ни один многочлен не даёт <em>только</em> простые: f(c) делится на c, если c = f(0) > 1 (здесь f(41) делится на 41). Урок «по косточкам»: закономерность на картинке — повод для гипотезы, а не доказательство (урок 15.19).';
    }
    draw();
  });

  /* ==============================================================================
   * 15. Гипотезы: Гольдбах, близнецы, Коллатц
   * ============================================================================== */
  GBC.widget('conjectures', (el) => {
    const s = { tab: 'gold', n: 100, X: 10000, c: 27 };
    const w = ui.shell(el, { title: 'Простые формулировки, которые никто не доказал', sub: 'Три знаменитые гипотезы. Каждую проверили на огромных числах — и ни одна не доказана. Проверка примеров не доказательство (урок 15.19).' });
    ui.segmented(w.controls, { label: 'Гипотеза', value: s.tab, options: [{ value: 'gold', label: 'Гольдбаха' }, { value: 'twin', label: 'о близнецах' }, { value: 'coll', label: 'Коллатца' }], onChange: (v) => ((s.tab = v), draw()) });
    const nS = ui.slider(w.controls, { label: 'Чётное n', min: 4, max: 1000, step: 2, value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const xS = ui.slider(w.controls, { label: 'До x', values: [100, 1000, 10000, 100000, 1000000], value: s.X, format: (v) => grp(v), onInput: (v) => ((s.X = v), draw()) });
    const cS = ui.slider(w.controls, { label: 'Начало n', min: 1, max: 1000, step: 1, value: s.c, format: String, onInput: (v) => ((s.c = v), draw()) });
    const chips = flexRow('margin:4px 0 8px');
    w.main.appendChild(chips);
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'n' }, y: { label: '' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'a', label: '' }, { key: 'b', label: '' }, { key: 'c', label: '' }]);
    const stK = w.foot.querySelectorAll('.stat .k');
    const setLabels = (arr) => arr.forEach((t, i) => (stK[i].textContent = t));
    sieveTo(1000010);
    const goldR = (n) => {
      const out = [];
      for (let p = 2; p <= n / 2; p++) if (isPrime(p) && isPrime(n - p)) out.push(p);
      return out;
    };
    const comet = (() => {
      const xs = [];
      const ys = [];
      for (let n = 4; n <= 2000; n += 2) (xs.push(n), ys.push(goldR(n).length));
      return { xs, ys };
    })();
    const collatz = (n) => {
      const out = [n];
      while (n !== 1) (n = n % 2 ? 3 * n + 1 : n / 2), out.push(n);
      return out;
    };
    w.pythonAction(() => s.tab === 'gold' ? `def is_prime(n):
    return n > 1 and all(n % d for d in range(2, int(n ** 0.5) + 1))

n = ${s.n}
reps = [(p, n - p) for p in range(2, n // 2 + 1) if is_prime(p) and is_prime(n - p)]
print(f"{n}: {len(reps)} разложений:", reps)
print("минимум разложений для чётных 6…2000:", min(sum(1 for p in range(2, m // 2 + 1) if is_prime(p) and is_prime(m - p)) for m in range(6, 2001, 2)))` : s.tab === 'twin' ? `X = ${s.X}
is_p = bytearray([1]) * (X + 3)
is_p[0] = is_p[1] = 0
for p in range(2, int((X + 2) ** 0.5) + 1):
    if is_p[p]:
        is_p[p * p :: p] = bytes(len(is_p[p * p :: p]))
twins = [(p, p + 2) for p in range(2, X - 1) if is_p[p] and is_p[p + 2]]
print("пар близнецов до", X, ":", len(twins), " последние:", twins[-3:])` : `n = ${s.c}
path = [n]
while n != 1:
    n = 3 * n + 1 if n % 2 else n // 2
    path.append(n)
print("шагов:", len(path) - 1, " максимум:", max(path))
print(path[:30], "…" if len(path) > 30 else "")`);
    function draw() {
      nS.el.style.display = s.tab === 'gold' ? '' : 'none';
      xS.el.style.display = s.tab === 'twin' ? '' : 'none';
      cS.el.style.display = s.tab === 'coll' ? '' : 'none';
      chips.textContent = '';
      plot.opts.y.format = undefined;
      if (s.tab === 'gold') {
        const R = goldR(s.n);
        R.slice(0, 16).forEach((p) => chips.appendChild(chip(p + ' + ' + (s.n - p), 'on')));
        if (R.length > 16) chips.appendChild(H('span', { style: 'color:var(--ink-2)' }, '… ещё ' + (R.length - 16)));
        plot.opts.y.label = 'число разложений';
        plot.opts.x.label = 'чётное n';
        plot.render([
          { type: 'points', x: comet.xs, y: comet.ys, color: (i) => (comet.xs[i] % 3 === 0 ? 'orange' : 'blue'), r: 1.8, opacity: 0.75, label: 'g(n)', legend: false },
          { type: 'points', x: [s.n], y: [R.length], color: 'ink', r: 6 },
        ], { x: [0, 2000], y: 'auto' });
        setLabels(['n', 'разложений n = p + q', 'наименьшее p']);
        st.set('a', String(s.n));
        st.set('b', String(R.length));
        st.set('c', R.length ? String(R[0]) : '—');
        note.innerHTML = '<b>Гипотеза Гольдбаха</b> (1742): каждое чётное число больше 2 — сумма двух простых. Проверена до 4·10¹⁸. График числа разложений g(n) похож на хвост кометы: оно растёт с n (у 100 разложений 6, у 1000 — 28), и чем больше n, тем невероятнее, что разложений не найдётся. Оранжевые точки — n, кратные 3, они идут выше: если 3 делит n, то для любого простого p > 3 число n − p тоже не делится на 3, и кандидатов в пары больше. Но «невероятно» — не «невозможно»: доказательства нет. Доказана слабая гипотеза — каждое нечётное > 5 есть сумма трёх простых (Хельфготт, 2013).';
      } else if (s.tab === 'twin') {
        const X = s.X;
        const xs = [];
        const ys = [];
        let c = 0;
        const step = Math.max(1, Math.floor(X / 400));
        for (let p = 3; p <= X; p++) {
          if (isPrime(p) && isPrime(p + 2) && p + 2 <= X) c++;
          if (p % step === 0) (xs.push(p), ys.push(c));
        }
        plot.opts.y.label = 'пар близнецов ≤ x';
        plot.opts.x.label = 'x';
        plot.render([
          { type: 'line', x: xs, y: ys, color: 'model', width: 2, label: 'π₂(x) — пар (p, p + 2)', curve: 'step' },
          { type: 'line', x: xs, y: xs.map((x) => (x > 10 ? (1.3203 * x) / Math.log(x) ** 2 : null)), color: 'tree', width: 2, dash: '6 4', label: '1.32·x / ln²x' },
        ], { x: [0, X], y: 'auto' });
        const last = [];
        for (let p = X - 2; p > 2 && last.length < 3; p--) if (isPrime(p) && isPrime(p + 2)) last.push(p);
        last.forEach((p) => chips.appendChild(chip('(' + grp(p) + ', ' + grp(p + 2) + ')', 'on')));
        setLabels(['до x', 'пар близнецов', 'простых всего']);
        st.set('a', grp(X));
        st.set('b', grp(c));
        st.set('c', grp(primesTo(X).length));
        note.innerHTML = '<b>Гипотеза о простых-близнецах:</b> пар (p, p + 2), где оба числа простые, бесконечно много. До 1000 таких пар 35, до миллиона — 8169; эвристика Харди — Литлвуда (пунктир) предсказывает рост как 1.32·x / ln²x — примерно квадрат плотности простых. Доказано (Чжан, 2013; проект Polymath): бесконечно много пар простых, отстоящих не больше чем на 246. Сократить 246 до 2 пока не удалось.';
      } else {
        const path = collatz(s.c);
        plot.opts.y.label = 'значение (лог. шкала)';
        plot.opts.x.label = 'шаг';
        const mx = Math.max(...path);
        plot.opts.y.format = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? '10' + sup(Math.round(v)) : '');
        plot.render([
          { type: 'line', x: path.map((_, i) => i), y: path.map((v) => Math.log10(v)), color: 'model', width: 2, label: 'траектория' },
          { type: 'points', x: path.map((_, i) => i), y: path.map((v) => Math.log10(v)), color: (i) => (path[i] % 2 ? 'orange' : 'blue'), r: path.length > 80 ? 2 : 3.5, tooltip: (i) => ['шаг ' + i, String(path[i])] },
        ], { x: [0, Math.max(5, path.length - 1)], y: [0, Math.log10(mx) * 1.08 + 0.1] });
        setLabels(['начало', 'шагов до 1', 'максимум']);
        st.set('a', String(s.c));
        st.set('b', String(path.length - 1));
        st.set('c', grp(mx));
        note.innerHTML = '<b>Гипотеза Коллатца (3n + 1):</b> если n чётное — делим пополам, если нечётное — заменяем на 3n + 1. Утверждается, что из любого n мы рано или поздно придём к 1. Правило — сплошные остатки по модулю 2, а траектории хаотичны: 27 добирается до 1 за 111 шагов, взлетая до 9232; среди n < 1000 дольше всех идёт 871 — 178 шагов. Оранжевые точки — нечётные шаги «×3 + 1». Проверено до 2⁶⁸, не доказано. Эрдёш говорил, что математика к таким задачам ещё не готова.';
      }
    }
    draw();
  });

  /* ==============================================================================
   * 15. Гонка простых по остаткам (теорема Дирихле)
   * ============================================================================== */
  GBC.widget('prime-race', (el) => {
    const s = { m: 4, X: 100000 };
    const w = ui.shell(el, { title: 'Гонка простых: остатки по модулю m', sub: 'Распределим простые по остаткам от деления на m. В классах r с НОД(r, m) = 1 простых бесконечно много и примерно поровну — но лидер долго один и тот же.' });
    ui.slider(w.controls, { label: 'Модуль m', values: [3, 4, 5, 6, 8, 10, 12], value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'До x', values: [1000, 10000, 30000, 100000, 1000000], value: s.X, format: (v) => grp(v), onInput: (v) => ((s.X = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: 'простых в классе' } });
    const diff = new GBC.Plot(w.main, { height: 170, x: { label: 'x' }, y: { label: 'разность' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'cl', label: 'классов с простыми' }, { key: 'ld', label: 'лидер при x' }, { key: 'sw', label: 'смен лидера (r = 1 против r = −1)' }]);
    w.pythonAction(() => `from collections import Counter
from math import gcd

m, X = ${s.m}, ${s.X}
is_p = bytearray([1]) * (X + 1)
is_p[0] = is_p[1] = 0
for p in range(2, int(X ** 0.5) + 1):
    if is_p[p]:
        is_p[p * p :: p] = bytes(len(is_p[p * p :: p]))
cnt = Counter(p % m for p in range(X + 1) if is_p[p])
for r in range(m):
    print(f"r = {r}: НОД(r, m) = {gcd(r, m)}, простых: {cnt.get(r, 0)}")
lead = c1 = c_1 = 0
for p in range(2, X + 1):
    if is_p[p]:
        c1 += p % m == 1
        c_1 += p % m == m - 1
        if c1 > c_1 and not lead:
            lead = p
print("класс 1 впервые обгоняет класс m − 1 при p =", lead or "не обгоняет до X")`);
    function draw() {
      const { m, X } = s;
      sieveTo(Math.max(X, 1000));
      const cls = U.range(m).filter((r) => gcd(r, m) === 1);
      const n = 400;
      const xs = U.range(n, 1).map((i) => Math.round((i * X) / n));
      const series = cls.map(() => []);
      const cnt = new Array(m).fill(0);
      let j = 0;
      let c1 = 0;
      let cm = 0;
      let lead = 0;
      let swaps = 0;
      let prevSign = 0;
      const dX = [];
      const dY = [];
      for (let x = 2; x <= X; x++) {
        if (SIEVE[x]) {
          cnt[x % m]++;
          {
            if (x % m === 1) c1++;
            if (x % m === m - 1) cm++;
            const sg = Math.sign(c1 - cm);
            if (sg > 0 && !lead) lead = x;
            if (sg !== 0 && prevSign !== 0 && sg !== prevSign) swaps++;
            if (sg !== 0) prevSign = sg;
          }
        }
        while (j < xs.length && xs[j] === x) {
          cls.forEach((r, i) => series[i].push(cnt[r]));
          dX.push(x);
          dY.push(cm - c1);
          j++;
        }
      }
      plot.render(cls.map((r, i) => ({ type: 'line', x: xs, y: series[i], color: SER[i % 8], width: 2, label: 'r = ' + r })), { x: [0, X], y: 'auto' });
      diff.render([
        { type: 'area', x: dX, y0: dX.map(() => 0), y1: dY, color: 'tree', opacity: 0.2 },
        { type: 'line', x: dX, y: dY, color: 'tree', width: 1.5, label: 'π(x; ' + m + ', ' + (m - 1) + ') − π(x; ' + m + ', 1)' },
        { type: 'hline', y: 0, color: 'ink2', width: 1 },
      ], { x: [0, X], y: 'auto' });
      rowTable(tbl, ['остаток r', 'НОД(r, m)', 'простых ≤ x', 'доля'], U.range(m).map((r) => [String(r), String(gcd(r, m)), grp(cnt[r]), pct(cnt[r] / U.sum(cnt))]), (r) => gcd(r, m) === 1);
      const best = cls.reduce((a, r) => (cnt[r] > cnt[a] ? r : a), cls[0]);
      st.set('cl', cls.length + ' = φ(' + m + ')');
      st.set('ld', 'r = ' + best);
      st.set('sw', String(swaps));
      note.innerHTML = '<b>Теорема Дирихле</b> (1837): если НОД(r, m) = 1, в прогрессии r, r + m, r + 2m, … бесконечно много простых, и асимптотически они делятся между φ(m) классами поровну. Классы с НОД(r, m) > 1 почти пусты (в них не больше одного простого). Но поровну — только в пределе: класс «квадратичных невычетов» (для m = 4 это r = 3) почти всегда впереди — <b>перекос Чебышёва</b>. ' + (m === 4 ? 'Для m = 4 класс 4k + 1 впервые обгоняет 4k + 3 только при p = 26 861 — и ненадолго' + (lead ? ' (здесь первая смена при p = ' + grp(lead) + ')' : '') + '. ' : m === 3 ? 'Для m = 3 класс 3k + 1 впервые обгоняет 3k + 2 лишь около 6·10¹¹ — до миллиона ни разу. ' : '') + 'Доказательство Дирихле ввело в теорию чисел анализ (L-функции) — так родилась аналитическая теория чисел.';
    }
    draw();
  });

  /* ==============================================================================
   * Экспорт помощников
   * ============================================================================== */
  GBC.lesson1520 = {
    f2, f3, grp, pct, plural, nWord, NB, minus, sup, sub,
    SER, cvar, tint, flexRow, texInto, texEl, card, cardGrid, badge, chip, rowTable, scrollBox, monoBox, svgBox, sText, legendRow, intField, textField,
    RGB, mixRGB, seqScale, pixelCanvas,
    mod, gcd, lcm, extGcd, invMod, divisors, factorize, fstr, ftex, tau, sigma, phi, sieveTo, primesTo, mulmod, powmod, powmodBig, strongProbable, isPrime, li, Li, toBase, DIG,
  };
})();
