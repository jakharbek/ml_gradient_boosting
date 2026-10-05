/* =====================================================================================
 * GBC.ui — элементы управления и каркас интерактивных виджетов.
 *
 *   const w = GBC.ui.shell(el, { title: 'Бустинг шаг за шагом', sub: '…' });
 *   const lr = GBC.ui.slider(w.controls, { label: 'Темп ν', min: 0.01, max: 1, step: 0.01, value: 0.1,
 *                                          onInput: v => update() });
 *   w.action('Python', () => code, { icon: 'python' });
 *
 * Регистрация виджетов: GBC.widget('имя', (el, config) => {...}) и разметка
 * <div data-widget="имя" data-config='{"...": ...}'></div>.
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC;
  const U = GBC.util;
  const H = GBC.h;

  /* --------------------------------- иконки --------------------------------------- */
  const ICONS = {
    play: '<path d="M7 5v14l12-7z" fill="currentColor"/>',
    pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>',
    step: '<path d="M6 5v14l9-7zM16 5h3v14h-3z" fill="currentColor"/>',
    back: '<path d="M18 5v14L9 12zM5 5h3v14H5z" fill="currentColor"/>',
    reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    python: '<path d="M12 3c-4 0-4 1.8-4 3v2h4v1H6c-2 0-3 1.6-3 4s1 4 3 4h2v-2.5c0-1.4 1.2-2.5 2.5-2.5h4c1.4 0 2.5-1.1 2.5-2.5V6c0-1.3-1-3-5.5-3z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 21c4 0 4-1.8 4-3v-2h-4v-1h6c2 0 3-1.6 3-4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="5.8" r="0.9" fill="currentColor"/>',
    download: '<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    run: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    sun: '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    search: '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    notebook: '<rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 3v18M12 8h4M12 12h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    code: '<path d="M9 8l-4 4 4 4M15 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    data: '<ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    task: '<path d="M9 11l3 3 8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="2" fill="currentColor"/><path d="M21 16l-5-5-9 9" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    alert: '<path d="M12 4l9 16H3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v4M12 17v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    sigma: '<path d="M18 5H6l6 7-6 7h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    bone: '<path d="M7.5 5.5a2.5 2.5 0 1 0-3.4 3.4 2.5 2.5 0 1 0 3.4 3.4l4.2 4.2a2.5 2.5 0 1 0 3.4 3.4 2.5 2.5 0 1 0 3.4-3.4 2.5 2.5 0 1 0-3.4-3.4L10.9 9a2.5 2.5 0 1 0-3.4-3.4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4M12 8v4l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    target: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    chat: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6.5L8 20.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 10h8M8 13h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.4-2h5.2L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    send: '<path d="M12 19V6m0 0l-5.5 5.5M12 6l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="15" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 10h18M3 15h18M9 4v16" stroke="currentColor" stroke-width="1.6"/>',
  };
  function icon(name) {
    const s = GBC.svg('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  /* --------------------------------- контролы ------------------------------------ */
  function setFill(input) {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const v = parseFloat(input.value);
    input.style.setProperty('--fill', ((100 * (v - min)) / (max - min || 1)).toFixed(2) + '%');
  }

  /**
   * Ползунок. log: true — логарифмическая шкала (для темпа обучения, λ).
   * values: [..] — дискретный набор значений.
   */
  function slider(parent, o) {
    const fmt = o.format || ((v) => U.fmt(v, 3));
    const valEl = H('span', { class: 'val' });
    const input = H('input', { type: 'range', 'aria-label': o.label });
    let toVal;
    let toPos;
    if (o.values) {
      input.min = 0;
      input.max = o.values.length - 1;
      input.step = 1;
      toVal = (p) => o.values[Math.round(p)];
      toPos = (v) => {
        let bi = 0;
        o.values.forEach((x, i) => {
          if (Math.abs(x - v) < Math.abs(o.values[bi] - v)) bi = i;
        });
        return bi;
      };
    } else if (o.log) {
      const l0 = Math.log10(o.min);
      const l1 = Math.log10(o.max);
      input.min = 0;
      input.max = 1000;
      input.step = 1;
      toVal = (p) => {
        const v = Math.pow(10, l0 + ((l1 - l0) * p) / 1000);
        const st = o.step || 0;
        return st ? Math.round(v / st) * st : Number(v.toPrecision(3));
      };
      toPos = (v) => (1000 * (Math.log10(v) - l0)) / (l1 - l0);
    } else {
      input.min = o.min;
      input.max = o.max;
      input.step = o.step ?? (o.max - o.min) / 100;
      toVal = (p) => parseFloat(p);
      toPos = (v) => v;
    }
    let value = o.value;
    input.value = toPos(value);
    setFill(input);
    valEl.textContent = fmt(value);
    const labelEl = H('span', null);
    labelEl.appendChild(GBC.richText(o.label));
    const el = H('div', { class: 'ctl' }, H('label', { class: 'ctl-label' }, labelEl, valEl), input, o.help ? H('div', { class: 'ctl-help' }, o.help) : null);
    input.addEventListener('input', () => {
      value = toVal(input.value);
      valEl.textContent = fmt(value);
      setFill(input);
      if (o.onInput) o.onInput(value);
    });
    input.addEventListener('change', () => o.onChange && o.onChange(value));
    parent.appendChild(el);
    return {
      el,
      input,
      get value() {
        return value;
      },
      set(v, silent = true) {
        value = v;
        input.value = toPos(v);
        valEl.textContent = fmt(v);
        setFill(input);
        if (!silent && o.onInput) o.onInput(v);
      },
      setMax(max) {
        if (o.values || o.log) return;
        input.max = max;
        o.max = max;
        if (value > max) this.set(max);
        setFill(input);
      },
    };
  }

  function select(parent, o) {
    const sel = H('select', { class: 'select', 'aria-label': o.label });
    for (const opt of o.options) {
      const op = H('option', { value: opt.value }, opt.label);
      if (String(opt.value) === String(o.value)) op.selected = true;
      sel.appendChild(op);
    }
    sel.addEventListener('change', () => o.onChange && o.onChange(sel.value));
    const el = H('div', { class: 'ctl' }, H('label', { class: 'ctl-label' }, o.label), sel, o.help ? H('div', { class: 'ctl-help' }, o.help) : null);
    parent.appendChild(el);
    return {
      el,
      get value() {
        return sel.value;
      },
      set(v) {
        sel.value = v;
      },
    };
  }

  function segmented(parent, o) {
    const box = H('div', { class: 'segmented', role: 'group', 'aria-label': o.label || '' });
    let value = o.value;
    const btns = o.options.map((opt) => {
      const b = H('button', { type: 'button', 'aria-pressed': String(opt.value === value) }, opt.label);
      if (opt.title) b.title = opt.title;
      b.addEventListener('click', () => {
        value = opt.value;
        btns.forEach((x, i) => x.setAttribute('aria-pressed', String(o.options[i].value === value)));
        if (o.onChange) o.onChange(value);
      });
      box.appendChild(b);
      return b;
    });
    const el = H('div', { class: 'ctl' }, o.label ? H('span', { class: 'ctl-label' }, o.label) : null, box, o.help ? H('div', { class: 'ctl-help' }, o.help) : null);
    parent.appendChild(el);
    return {
      el,
      get value() {
        return value;
      },
      set(v) {
        value = v;
        btns.forEach((x, i) => x.setAttribute('aria-pressed', String(o.options[i].value === v)));
      },
    };
  }

  function toggle(parent, o) {
    const input = H('input', { type: 'checkbox', role: 'switch' });
    input.checked = !!o.checked;
    input.addEventListener('change', () => o.onChange && o.onChange(input.checked));
    const lab = H('span');
    lab.appendChild(GBC.richText(o.label));
    const el = H('label', { class: 'toggle' }, input, lab);
    parent.appendChild(el);
    return {
      el,
      get checked() {
        return input.checked;
      },
      set(v) {
        input.checked = v;
      },
    };
  }

  function button(parent, o) {
    const b = H('button', { type: 'button', class: 'btn ' + (o.kind || '') + (o.small ? ' small' : ''), title: o.title || null }, o.icon ? icon(o.icon) : null, o.label || null);
    b.addEventListener('click', (e) => o.onClick && o.onClick(e));
    if (parent) parent.appendChild(b);
    return b;
  }

  /** Проигрыватель итераций: ⏮ ▶ ⏭ + ползунок. */
  function player(parent, o) {
    let value = o.value ?? o.min ?? 0;
    let max = o.max;
    const min = o.min ?? 0;
    let timer = null;
    const fps = o.fps || 6;
    const count = H('span', { class: 'count' });
    const input = H('input', { type: 'range', min, max, step: 1, value, 'aria-label': o.label || 'Итерация' });
    const bBack = H('button', { type: 'button', class: 'icon-btn', title: 'Шаг назад' }, icon('back'));
    const bPlay = H('button', { type: 'button', class: 'icon-btn primary', title: 'Воспроизвести' }, icon('play'));
    const bStep = H('button', { type: 'button', class: 'icon-btn', title: 'Шаг вперёд' }, icon('step'));
    const fmt = o.format || ((v) => 'm = ' + v);
    const upd = (notify = true) => {
      input.value = value;
      setFill(input);
      count.textContent = fmt(value, max);
      if (notify && o.onChange) o.onChange(value);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      bPlay.replaceChildren(icon('play'));
      bPlay.title = 'Воспроизвести';
    };
    const play = () => {
      if (value >= max) value = min;
      bPlay.replaceChildren(icon('pause'));
      bPlay.title = 'Пауза';
      timer = setInterval(() => {
        if (value >= max) return stop();
        value += 1;
        upd();
      }, 1000 / fps);
    };
    bPlay.addEventListener('click', () => (timer ? stop() : play()));
    bStep.addEventListener('click', () => {
      stop();
      value = Math.min(max, value + 1);
      upd();
    });
    bBack.addEventListener('click', () => {
      stop();
      value = Math.max(min, value - 1);
      upd();
    });
    input.addEventListener('input', () => {
      stop();
      value = parseInt(input.value, 10);
      upd();
    });
    const el = H('div', { class: 'ctl' }, o.label ? H('span', { class: 'ctl-label' }, o.label) : null, H('div', { class: 'player' }, bBack, bPlay, bStep, input, count));
    parent.appendChild(el);
    upd(false);
    return {
      el,
      get value() {
        return value;
      },
      set(v, notify = false) {
        value = U.clamp(v, min, max);
        upd(notify);
      },
      setMax(m) {
        max = m;
        input.max = m;
        if (value > m) value = m;
        upd(false);
      },
      stop,
      play,
    };
  }

  /** Строка показателей: stats(parent, [{key, label}]) → {set(key, value, delta?)} */
  function stats(parent, defs) {
    const box = H('div', { class: 'stats' });
    const cells = {};
    for (const d of defs) {
      const v = H('span', { class: 'v' }, '—');
      const k = H('span', { class: 'k' });
      k.appendChild(GBC.richText(d.label));
      const cell = H('div', { class: 'stat', title: d.title || null }, k, v);
      cells[d.key] = v;
      box.appendChild(cell);
    }
    parent.appendChild(box);
    return {
      el: box,
      set(key, value, delta = null, goodWhenDown = true) {
        const el = cells[key];
        if (!el) return;
        el.textContent = value;
        if (delta !== null && delta !== undefined && Number.isFinite(delta) && Math.abs(delta) > 1e-12) {
          const good = goodWhenDown ? delta < 0 : delta > 0;
          el.appendChild(H('span', { class: 'd ' + (good ? 'good' : 'bad') }, (delta > 0 ? '▲ ' : '▼ ') + U.fmt(Math.abs(delta), 3)));
        }
      },
    };
  }

  /* ------------------------------- модальные окна --------------------------------- */
  function modal({ title, body, actions = [] }) {
    const close = () => {
      back.remove();
      root.document.removeEventListener('keydown', onKey);
      if (prev) prev.focus();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    const prev = root.document.activeElement;
    const closeBtn = H('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Закрыть' }, icon('close'));
    closeBtn.addEventListener('click', close);
    const foot = H('div', { class: 'modal-foot' });
    for (const a of actions) {
      const b = button(foot, a);
      b.addEventListener('click', () => a.close && close());
    }
    const dlg = H('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, H('div', { class: 'modal-head' }, H('h3', null, title), closeBtn), H('div', { class: 'modal-body' }, body), actions.length ? foot : null);
    const back = H('div', { class: 'modal-backdrop' }, dlg);
    back.addEventListener('click', (e) => {
      if (e.target === back) close();
    });
    root.document.body.appendChild(back);
    root.document.addEventListener('keydown', onKey);
    closeBtn.focus();
    return { close, el: dlg };
  }

  let toastEl = null;
  let toastTimer = null;
  function toast(text) {
    if (!toastEl) {
      toastEl = H('div', { class: 'toast', role: 'status' });
      root.document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function codeBlock(code, lang = 'python') {
    const c = H('code', { class: 'language-' + lang }, code);
    const pre = H('pre', null, c);
    if (root.hljs) {
      try {
        root.hljs.highlightElement(c);
      } catch (e) {
        /* без подсветки */
      }
    }
    return pre;
  }

  /** Окно «Воспроизвести в Python»: код, копирование, запуск в браузере. */
  function showPython(code, { title = 'Этот эксперимент в Python', note } = {}) {
    const out = H('div', { class: 'pycell-out' });
    const body = H(
      'div',
      null,
      H('p', { class: 'widget-note', style: { marginTop: 0 } }, note || 'Код воспроизводит текущее состояние виджета с помощью учебной библиотеки gbcourse. Его можно запустить здесь же (Python в браузере) или вставить в Jupyter-ноутбук.'),
      codeBlock(code),
      out
    );
    modal({
      title,
      body,
      actions: [
        { label: 'Копировать', icon: 'copy', onClick: async () => toast((await GBC.io.copy(code)) ? 'Код скопирован' : 'Не удалось скопировать') },
        {
          label: 'Запустить в браузере', icon: 'run', kind: 'primary',
          onClick: async (e) => {
            const b = e.currentTarget;
            b.disabled = true;
            try {
              await GBC.py.runInto(code, out);
            } finally {
              b.disabled = false;
            }
          },
        },
      ],
    });
  }

  /* --------------------------------- каркас виджета ------------------------------- */
  function shell(el, o = {}) {
    el.classList.add('widget');
    el.textContent = '';
    const actions = H('div', { class: 'widget-actions' });
    const titles = H('div', { class: 'titles' }, o.title ? H('h3', { class: 'widget-title' }, o.title) : null, o.sub ? H('p', { class: 'widget-sub' }, o.sub) : null);
    const head = H('div', { class: 'widget-head' }, titles, actions);
    const controls = H('div', { class: 'widget-controls' });
    const main = H('div', { class: 'widget-main' });
    const body = H('div', { class: 'widget-body' + (o.stack ? ' stack' : '') + (o.noControls ? ' stack' : '') }, o.noControls ? null : controls, main);
    const foot = H('div', { class: 'widget-foot' });
    el.append(head, body);
    if (o.foot !== false) el.append(foot);
    return {
      el, head, controls, main, foot, actions,
      /** Кнопка в шапке. fn может вернуть строку кода Python — откроется окно экспорта. */
      action(label, fn, opts = {}) {
        const b = button(actions, { label, icon: opts.icon, kind: 'ghost', small: true, title: opts.title });
        b.addEventListener('click', () => {
          const res = fn();
          if (typeof res === 'string' && opts.python !== false && (opts.icon === 'python' || opts.python)) showPython(res, opts);
        });
        return b;
      },
      pythonAction(getCode, opts = {}) {
        return this.action('Python', getCode, Object.assign({ icon: 'python', python: true, title: 'Воспроизвести в Python / Jupyter' }, opts));
      },
      csvAction(filename, getColumns) {
        return this.action('CSV', () => GBC.io.download(filename, GBC.io.toCSV(getColumns()), 'text/csv;charset=utf-8'), { icon: 'download', title: 'Скачать данные виджета' });
      },
      note(text, live = false) {
        const p = H('p', { class: 'widget-note' + (live ? ' live' : '') });
        if (text) p.innerHTML = text;
        main.appendChild(p);
        return p;
      },
    };
  }

  /* --------------------------------- регистрация ---------------------------------- */
  const registry = {};
  GBC.widget = function (name, factory) {
    registry[name] = factory;
  };
  GBC.mountWidgets = function (scope) {
    const els = (scope || root.document).querySelectorAll('[data-widget]');
    for (const el of els) {
      if (el.dataset.mounted) continue;
      const name = el.dataset.widget;
      const factory = registry[name];
      if (!factory) {
        console.warn('[GBC] виджет не найден:', name);
        el.textContent = 'Виджет «' + name + '» не найден.';
        continue;
      }
      let config = {};
      try {
        if (el.dataset.config) config = JSON.parse(el.dataset.config);
        const inline = el.querySelector('script[type="application/json"]');
        if (inline) config = Object.assign(config, JSON.parse(inline.textContent));
      } catch (e) {
        console.error('[GBC] ошибка в data-config виджета', name, e);
      }
      el.dataset.mounted = '1';
      try {
        factory(el, config);
      } catch (e) {
        console.error('[GBC] ошибка виджета', name, e);
        el.textContent = 'Ошибка виджета «' + name + '»: ' + e.message;
      }
    }
  };

  /* --------------------------------- пошаговые разборы ---------------------------- */
  /** <div class="steps"><section class="step">…</section>…</div> → навигация по шагам. */
  function mountSteps(scope) {
    for (const box of (scope || root.document).querySelectorAll('.steps:not([data-mounted])')) {
      box.dataset.mounted = '1';
      const steps = Array.from(box.querySelectorAll(':scope > .step'));
      if (!steps.length) continue;
      let cur = 0;
      const dots = H('div', { class: 'dots' });
      const prev = button(null, { label: 'Назад', kind: 'ghost', small: true });
      const next = button(null, { label: 'Дальше →', kind: 'primary', small: true });
      const dotBtns = steps.map((s, i) => {
        const b = H('button', { type: 'button', 'aria-label': 'Шаг ' + (i + 1) }, String(i + 1));
        b.addEventListener('click', () => go(i));
        dots.appendChild(b);
        return b;
      });
      const nav = H('div', { class: 'steps-nav' }, dots, prev, next);
      box.prepend(nav);
      const go = (i) => {
        cur = U.clamp(i, 0, steps.length - 1);
        steps.forEach((s, k) => (s.hidden = k !== cur));
        dotBtns.forEach((b, k) => {
          b.setAttribute('aria-current', k === cur ? 'step' : 'false');
          if (k <= cur) b.classList.add('seen');
        });
        prev.disabled = cur === 0;
        next.disabled = cur === steps.length - 1;
        box.dispatchEvent(new CustomEvent('step', { detail: { index: cur } }));
      };
      prev.addEventListener('click', () => go(cur - 1));
      next.addEventListener('click', () => go(cur + 1));
      go(0);
    }
  }

  /** Простая таблица данных. */
  function table(parent, { columns, rows, highlight = null, numeric = true }) {
    const t = H('table', { class: 'data' });
    t.appendChild(H('thead', null, H('tr', null, columns.map((c) => {
      const th = H('th', { class: numeric ? 'num' : null });
      th.appendChild(GBC.richText(c));
      return th;
    }))));
    const tb = H('tbody');
    rows.forEach((r, i) => {
      tb.appendChild(H('tr', { class: highlight && highlight(i) ? 'hl' : null }, r.map((v) => H('td', { class: numeric ? 'num' : null }, typeof v === 'number' ? U.fmt(v, 3) : v))));
    });
    t.appendChild(tb);
    const wrap = H('div', { class: 'table-wrap' }, t);
    parent.appendChild(wrap);
    return wrap;
  }

  GBC.ui = { icon, slider, select, segmented, toggle, button, player, stats, modal, toast, shell, codeBlock, showPython, mountSteps, table, ICONS };
})(typeof window !== 'undefined' ? window : globalThis);
