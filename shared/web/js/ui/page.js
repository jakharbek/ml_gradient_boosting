/* =====================================================================================
 * GBC.page — каркас страниц курса: шапка, навигация, оглавление, шапка урока,
 * материалы, прогресс, формулы (KaTeX), подсветка кода, главная страница.
 *
 * Урок содержит только контент: <html data-lesson="lesson_4_1"> … <main class="lesson">…</main>.
 * Всё остальное строится здесь из манифеста (shared/web/js/generated/manifest.js),
 * который собирает tools/build.py из файлов lesson.json всех уроков.
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC;
  const H = GBC.h;
  const U = GBC.util;
  const doc = root.document;
  const icon = (n) => GBC.ui.icon(n);

  const LEVELS = { 1: 'Начальный', 2: 'Средний', 3: 'Продвинутый', 4: 'Экспертный' };
  const CALLOUT_TITLES = {
    intuition: ['Интуиция', 'bulb'],
    definition: ['Определение', 'book'],
    formal: ['Формально', 'sigma'],
    tip: ['Совет практика', 'check'],
    warning: ['Частая ошибка', 'alert'],
    note: ['Обратите внимание', 'info'],
    history: ['Историческая справка', 'history'],
    practice: ['Попробуйте сами', 'target'],
  };

  const boot = () => root.GBC_BOOT || { root: './' };
  const rootPath = () => boot().root || './';
  const manifest = () => root.GBC_MANIFEST || { course: { title: GBC.config.courseTitle, parts: [] }, lessons: [] };
  const lessonUrl = (id) => rootPath() + 'lessons/' + id + '/web/index.html';
  const byId = (id) => manifest().lessons.find((l) => l.id === id);

  /* --------------------------------- формулы -------------------------------------- */
  const mathQueue = [];
  GBC.math = {
    ready: false,
    render(el) {
      if (!el) return;
      if (this.ready && root.renderMathInElement) {
        try {
          root.renderMathInElement(el, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false },
              { left: '$', right: '$', display: false },
            ],
            throwOnError: false,
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option'],
            ignoredClasses: ['no-math', 'CodeMirror', 'pycell-editor', 'pycell-out'],
          });
        } catch (e) {
          console.warn('[GBC] KaTeX', e);
        }
      } else mathQueue.push(el);
    },
    /** Формула как элемент (для виджетов с «живыми» числами). */
    tex(src, display = false) {
      const span = H('span');
      if (root.katex) {
        try {
          root.katex.render(src, span, { throwOnError: false, displayMode: display });
          return span;
        } catch (e) {
          /* ниже — запасной вариант */
        }
      }
      span.textContent = src;
      span.className = 'no-math';
      return span;
    },
    _flush() {
      this.ready = true;
      while (mathQueue.length) this.render(mathQueue.shift());
      GBC.bus.emit('mathready');
    },
  };

  /* --------------------------------- прогресс ------------------------------------- */
  const progress = {
    all() {
      return GBC.storage.get('progress', {}) || {};
    },
    get(id) {
      return this.all()[id] || {};
    },
    set(id, patch) {
      const all = this.all();
      all[id] = Object.assign({}, all[id], patch);
      GBC.storage.set('progress', all);
      GBC.bus.emit('progress', { id, state: all[id] });
    },
    doneCount() {
      const all = this.all();
      return manifest().lessons.filter((l) => all[l.id] && all[l.id].done).length;
    },
  };
  GBC.progress = progress;

  /* --------------------------------- тема ----------------------------------------- */
  function setTheme(t) {
    doc.documentElement.dataset.theme = t;
    GBC.storage.set('theme', t);
    GBC.bus.emit('themechange', t);
  }

  /* --------------------------------- шапка и навигация ---------------------------- */
  function buildTopbar(lesson) {
    const M = manifest();
    const menu = H('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Меню курса' }, icon('menu'));
    menu.addEventListener('click', () => doc.body.classList.toggle('drawer-open'));
    const brand = H(
      'a',
      { class: 'brand', href: rootPath() + 'index.html' },
      H('img', { src: rootPath() + 'shared/web/img/logo.svg', alt: '' }),
      H('span', { class: 'brand-text' }, M.course.short_title || 'Бустинг по косточкам')
    );
    const crumbs = H('nav', { class: 'crumbs', 'aria-label': 'Хлебные крошки' });
    if (lesson) {
      const chain = [];
      let cur = lesson;
      while (cur) {
        chain.unshift(cur);
        cur = cur.parent ? byId(cur.parent) : null;
      }
      chain.forEach((l, i) => {
        crumbs.appendChild(H('span', { class: 'sep' }, '/'));
        if (i < chain.length - 1) crumbs.appendChild(H('a', { href: lessonUrl(l.id) }, l.number + ' ' + (l.short || l.title)));
        else crumbs.appendChild(H('span', { class: 'current' }, l.number + ' ' + l.title));
      });
    }
    const total = M.lessons.length;
    const bar = H('span', { class: 'bar' }, H('span'));
    const chipText = H('span');
    const chip = H('span', { class: 'progress-chip', title: 'Отмеченные как пройденные уроки' }, bar, chipText);
    const updChip = () => {
      const d = progress.doneCount();
      chipText.textContent = d + ' из ' + total;
      bar.firstChild.style.width = (total ? (100 * d) / total : 0) + '%';
    };
    updChip();
    GBC.bus.on('progress', updChip);
    const themeBtn = H('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Сменить тему' });
    const updTheme = () => {
      const dark = doc.documentElement.dataset.theme === 'dark';
      themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'));
      themeBtn.title = dark ? 'Светлая тема' : 'Тёмная тема';
    };
    themeBtn.addEventListener('click', () => {
      setTheme(doc.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      updTheme();
    });
    updTheme();
    return H('header', { class: 'topbar' }, menu, brand, crumbs, H('span', { class: 'spacer' }), chip, themeBtn);
  }

  function buildSidebar(current) {
    const M = manifest();
    const nav = H('nav', { class: 'sidebar', 'aria-label': 'Уроки курса' });
    const input = H('input', { type: 'search', placeholder: 'Поиск по курсу  ( / )', 'aria-label': 'Поиск по курсу' });
    nav.appendChild(H('div', { class: 'search' }, icon('search'), input));
    const done = progress.all();
    const items = [];
    const currentTop = current ? current.id.split('_').slice(0, 2).join('_') : null;
    for (const part of M.course.parts || []) {
      nav.appendChild(H('div', { class: 'nav-part' }, 'Часть ' + part.id + ' · ' + part.title));
      const ul = H('ul', { class: 'nav-list' });
      for (const topId of part.lessons) {
        const top = byId(topId);
        if (!top) continue;
        const li = navItem(top, current, done);
        items.push({ li, lesson: top });
        const kids = M.lessons.filter((l) => l.parent === top.id);
        if (kids.length) {
          const sub = H('ul');
          for (const k of kids) {
            const kli = navItem(k, current, done);
            items.push({ li: kli, lesson: k, parentLi: li });
            sub.appendChild(kli);
          }
          sub.hidden = currentTop !== top.id;
          li.appendChild(sub);
          li._sub = sub;
        }
        ul.appendChild(li);
      }
      nav.appendChild(ul);
    }
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      for (const it of items) {
        const l = it.lesson;
        const hay = (l.number + ' ' + l.title + ' ' + (l.keywords || []).join(' ') + ' ' + (l.summary || '')).toLowerCase();
        const match = !q || hay.includes(q);
        it.li.classList.toggle('hidden', !match && !(it.li._sub && Array.from(it.li._sub.children).some((c) => !c.classList.contains('hidden'))));
      }
      for (const it of items) {
        if (it.li._sub) {
          const anyKid = Array.from(it.li._sub.children).some((c) => !c.classList.contains('hidden'));
          it.li._sub.hidden = q ? !anyKid : currentTop !== it.lesson.id;
          if (q && anyKid) it.li.classList.remove('hidden');
        }
      }
    });
    doc.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/input|textarea|select/i.test(doc.activeElement.tagName) && !doc.activeElement.isContentEditable) {
        e.preventDefault();
        if (root.innerWidth <= 1024) doc.body.classList.add('drawer-open');
        input.focus();
      }
    });
    GBC.bus.on('progress', ({ id, state }) => {
      const it = items.find((x) => x.lesson.id === id);
      if (!it) return;
      const a = it.li.querySelector(':scope > a');
      const mark = a.querySelector('.done');
      if (state.done && !mark) a.appendChild(H('span', { class: 'done', 'aria-label': 'пройден' }, '✓'));
      if (!state.done && mark) mark.remove();
    });
    return nav;
  }

  function navItem(l, current, done) {
    const active = current && current.id === l.id;
    const a = H('a', { href: lessonUrl(l.id), 'aria-current': active ? 'page' : null }, H('span', { class: 'num' }, l.number), H('span', { class: 't' }, l.short || l.title));
    if (done[l.id] && done[l.id].done) a.appendChild(H('span', { class: 'done', 'aria-label': 'пройден' }, '✓'));
    return H('li', { class: 'nav-item' + (active ? ' active' : '') }, a);
  }

  /* --------------------------------- оглавление ----------------------------------- */
  function buildToc(main) {
    const heads = Array.from(main.querySelectorAll('h2, h3')).filter((h) => !h.closest('.widget, .quiz, .objectives, .exercise, .bones, .steps, .callout'));
    const toc = H('aside', { class: 'toc', 'aria-label': 'Содержание страницы' });
    if (heads.length < 2) return toc;
    const ol = H('ol');
    const links = new Map();
    heads.forEach((h, i) => {
      if (!h.id) h.id = 'sec-' + (i + 1);
      const a = H('a', { href: '#' + h.id }, h.textContent.replace(/#$/, '').trim());
      links.set(h.id, a);
      ol.appendChild(H('li', { class: h.tagName === 'H3' ? 'h3' : h.classList.contains('part-head') ? 'h2 part' : 'h2' }, a));
      const anchor = H('a', { class: 'anchor', href: '#' + h.id, 'aria-label': 'Ссылка на раздел' }, '#');
      h.appendChild(anchor);
    });
    toc.append(H('h2', null, 'На этой странице'), ol);
    if (root.IntersectionObserver) {
      const visible = new Set();
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id));
          let activeId = null;
          for (const h of heads) {
            if (visible.has(h.id)) {
              activeId = h.id;
              break;
            }
          }
          if (!activeId) {
            for (const h of heads) if (h.getBoundingClientRect().top < 120) activeId = h.id;
          }
          links.forEach((a, id) => a.classList.toggle('active', id === activeId));
        },
        { rootMargin: '-70px 0px -60% 0px' }
      );
      heads.forEach((h) => io.observe(h));
    }
    return toc;
  }

  /* --------------------------------- шапка и конец урока -------------------------- */
  function levelDots(level) {
    const box = H('span', { class: 'level-dots', 'aria-hidden': 'true' });
    for (let i = 1; i <= 4; i++) box.appendChild(H('i', { class: i <= level ? 'on' : '' }));
    return box;
  }

  function materialLinks(l, cls) {
    const box = H('div', { class: cls });
    const mat = l.materials || {};
    const base = rootPath() + 'lessons/' + l.id + '/';
    const add = (href, ic, label, sub) => {
      const a = H('a', { href, target: href.endsWith('.html') ? null : '_blank', rel: 'noopener' }, icon(ic));
      if (cls === 'materials-list') a.appendChild(H('span', null, label, H('small', null, sub)));
      else a.appendChild(H('span', null, label));
      box.appendChild(a);
    };
    for (const nb of mat.notebooks || []) add(base + nb.file, 'notebook', cls === 'materials-list' ? nb.title || 'Jupyter-ноутбук' : 'Ноутбук', nb.file);
    for (const ex of mat.examples || []) if (cls === 'materials-list') add(base + ex.file, 'code', ex.title || ex.file, ex.file);
    if (cls !== 'materials-list' && (mat.examples || []).length) add(base + mat.examples[0].file, 'code', 'Примеры .py (' + mat.examples.length + ')', '');
    for (const d of mat.data || []) if (cls === 'materials-list') add(base + d.file, 'data', d.title || d.file, d.file);
    if (cls !== 'materials-list' && (mat.data || []).length) add(base + mat.data[0].file, 'data', 'Данные CSV', '');
    for (const e of mat.exercises || []) if (cls === 'materials-list') add(base + e.file, 'task', e.title || 'Упражнения', e.file);
    if (cls !== 'materials-list' && (mat.exercises || []).length) add(base + mat.exercises[0].file, 'task', 'Упражнения', '');
    return box;
  }

  function buildHero(l) {
    const hero = H('header', { class: 'lesson-hero' });
    const parent = l.parent ? byId(l.parent) : null;
    const eyebrow = H('div', { class: 'eyebrow' });
    if (parent) eyebrow.append(H('span', null, 'Модуль ' + parent.number), H('span', { class: 'dot' }, '·'), H('span', null, 'Урок ' + l.number));
    else eyebrow.append(H('span', null, 'Модуль ' + l.number), H('span', { class: 'dot' }, '·'), H('span', null, 'Обзор модуля'));
    hero.appendChild(eyebrow);
    hero.appendChild(H('h1', null, l.title));
    if (l.subtitle) hero.appendChild(H('p', { class: 'subtitle' }, l.subtitle));
    const meta = H('div', { class: 'meta-row' });
    meta.appendChild(H('span', { class: 'pill' }, icon('clock'), (l.duration || 30) + ' мин'));
    meta.appendChild(H('span', { class: 'pill' }, levelDots(l.level || 1), LEVELS[l.level || 1]));
    for (const p of l.prerequisites || []) {
      const pl = byId(p);
      if (pl) meta.appendChild(H('a', { class: 'pill', href: lessonUrl(pl.id), title: 'Желательно пройти: ' + pl.title }, 'нужно: ' + pl.number + ' ' + (pl.short || pl.title)));
    }
    hero.appendChild(meta);
    if ((l.objectives || []).length) {
      const ul = H('ul');
      for (const o of l.objectives) {
        const li = H('li');
        li.innerHTML = o;
        ul.appendChild(li);
      }
      hero.appendChild(H('div', { class: 'objectives' }, H('h2', null, 'После урока вы сможете'), ul));
    }
    hero.appendChild(materialLinks(l, 'materials-bar'));
    return hero;
  }

  function buildSubLessons(l) {
    const kids = manifest().lessons.filter((x) => x.parent === l.id);
    if (!kids.length) return null;
    const box = H('div', { class: 'sublessons' });
    for (const k of kids) {
      box.appendChild(
        H('a', { href: lessonUrl(k.id) }, H('span', { class: 'n' }, k.number), H('span', { class: 't' }, k.title), H('span', { class: 'm' }, (k.duration || 30) + ' мин · ' + LEVELS[k.level || 1]), H('span', { class: 's' }, k.summary || ''))
      );
    }
    return box;
  }

  function buildEnd(l) {
    const M = manifest();
    const idx = M.lessons.findIndex((x) => x.id === l.id);
    const prev = M.lessons[idx - 1];
    const next = M.lessons[idx + 1];
    const end = H('footer', { class: 'lesson-end' });
    end.appendChild(H('h2', { id: 'materials' }, 'Материалы урока'));
    end.appendChild(
      H('p', { class: 'muted', style: { fontSize: '0.95rem' } }, 'Ноутбук открывается в JupyterLab или VS Code (из корня курса: ', H('code', null, 'jupyter lab'), '). Примеры запускаются командой ', H('code', null, 'python lessons/' + l.id + '/examples/<файл>.py'), '.')
    );
    end.appendChild(materialLinks(l, 'materials-list'));
    const st = progress.get(l.id);
    const box = H('div', { class: 'complete-box' + (st.done ? ' done' : '') });
    const text = H('span', { class: 't' });
    const btn = GBC.ui.button(null, { label: '', kind: st.done ? 'ghost' : 'primary' });
    const upd = () => {
      const s = progress.get(l.id);
      box.classList.toggle('done', !!s.done);
      text.textContent = s.done ? '✓ Урок отмечен как пройденный. Отметка хранится только в этом браузере.' : 'Разобрались с уроком? Отметьте его — прогресс виден в шапке и в оглавлении курса.';
      btn.textContent = s.done ? 'Снять отметку' : 'Отметить урок пройденным';
      btn.className = 'btn ' + (s.done ? 'ghost' : 'primary');
    };
    btn.addEventListener('click', () => {
      progress.set(l.id, { done: !progress.get(l.id).done });
      upd();
      if (progress.get(l.id).done) GBC.ui.toast('Отлично! Урок ' + l.number + ' пройден');
    });
    upd();
    box.append(text, btn);
    end.appendChild(box);
    const pager = H('nav', { class: 'pager', 'aria-label': 'Соседние уроки' });
    if (prev) pager.appendChild(H('a', { class: 'prev', href: lessonUrl(prev.id) }, H('span', { class: 'k' }, '← Предыдущий'), H('span', { class: 't' }, prev.number + ' ' + prev.title)));
    if (next) pager.appendChild(H('a', { class: 'next', href: lessonUrl(next.id) }, H('span', { class: 'k' }, 'Следующий →'), H('span', { class: 't' }, next.number + ' ' + next.title)));
    end.appendChild(pager);
    return end;
  }

  /* --------------------------------- улучшение контента --------------------------- */
  function enhance(main) {
    // Заголовки выносок
    for (const c of main.querySelectorAll('.callout')) {
      if (c.querySelector(':scope > .callout-title')) continue;
      const kind = Object.keys(CALLOUT_TITLES).find((k) => c.classList.contains(k));
      if (!kind && !c.dataset.title) continue;
      const [title, ic] = CALLOUT_TITLES[kind] || [c.dataset.title, 'info'];
      c.prepend(H('div', { class: 'callout-title' }, icon(ic), c.dataset.title || title));
    }
    // «Косточки»: нумерация уровней и кнопки
    for (const b of main.querySelectorAll('.bones')) {
      if (b.dataset.mounted) continue;
      b.dataset.mounted = '1';
      const all = () => b.querySelectorAll('details.bone');
      const openBtn = GBC.ui.button(null, { label: 'Развернуть всё', kind: 'ghost', small: true });
      const closeBtn = GBC.ui.button(null, { label: 'Свернуть', kind: 'ghost', small: true });
      openBtn.addEventListener('click', () => all().forEach((d) => (d.open = true)));
      closeBtn.addEventListener('click', () => all().forEach((d) => (d.open = false)));
      const title = H('div', { class: 't' }, b.dataset.title || 'Разбор по косточкам', H('small', null, b.dataset.sub || 'Каждый элемент раскрывается на более мелкие — до самых основ'));
      b.prepend(H('div', { class: 'bones-head' }, icon('bone'), title, openBtn, closeBtn));
      const number = (container, prefix) => {
        let i = 0;
        for (const d of container.querySelectorAll(':scope > details.bone, :scope > .bone-body > details.bone')) {
          if (d.parentElement !== container && d.parentElement.parentElement !== container) continue;
          i++;
          const num = prefix ? prefix + '.' + i : String(i);
          const sum = d.querySelector(':scope > summary');
          if (sum && !sum.querySelector('.lvl')) {
            sum.prepend(H('span', { class: 'lvl' }, num));
            if (sum.dataset.go) {
              const target = byId(sum.dataset.go);
              if (target) sum.appendChild(H('a', { class: 'go', href: lessonUrl(target.id) + (sum.dataset.anchor ? '#' + sum.dataset.anchor : '') }, '→ урок ' + target.number));
            }
          }
          const body = d.querySelector(':scope > .bone-body');
          if (body) number(body, num);
        }
      };
      number(b, '');
    }
    // Таблицы с прокруткой
    for (const t of main.querySelectorAll('table')) {
      if (t.closest('.table-wrap, .plot, .widget, .pycell')) continue;
      const wrap = H('div', { class: 'table-wrap' });
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    }
    // Кнопка копирования у статичного кода
    for (const pre of main.querySelectorAll('pre')) {
      if (pre.closest('.pycell, .widget') || pre.querySelector('.copy-btn')) continue;
      const b = H('button', { class: 'icon-btn copy-btn', type: 'button', 'aria-label': 'Копировать код', title: 'Копировать' }, icon('copy'));
      b.addEventListener('click', async () => GBC.ui.toast((await GBC.io.copy(pre.textContent)) ? 'Скопировано' : 'Не удалось скопировать'));
      pre.appendChild(b);
    }
    // Таблицы текста урока — в прокручиваемую обёртку, чтобы на узком экране не расширять страницу
    for (const t of main.querySelectorAll('table')) {
      if (t.closest('.table-wrap, .table-auto, .widget, .pycell')) continue;
      const box = doc.createElement('div');
      box.className = 'table-auto';
      t.replaceWith(box);
      box.appendChild(t);
    }
    // Ссылки на уроки: <a data-lesson="lesson_2_1">…</a>
    for (const a of main.querySelectorAll('a[data-lesson]')) {
      const t = byId(a.dataset.lesson);
      if (!t) continue;
      a.href = lessonUrl(t.id) + (a.dataset.anchor ? '#' + a.dataset.anchor : '');
      if (!a.textContent.trim()) a.textContent = 'урок ' + t.number + ' «' + t.title + '»';
    }
    // Список подуроков в обзорных уроках: <div data-sublessons></div>
    for (const slot of main.querySelectorAll('[data-sublessons]')) {
      const l = byId(doc.documentElement.dataset.lesson);
      const box = l && buildSubLessons(l);
      if (box) slot.replaceWith(box);
    }
  }

  function highlightCode(scope) {
    if (!root.hljs) return;
    for (const c of scope.querySelectorAll('pre code')) {
      if (c.dataset.highlighted || c.closest('.pycell')) continue;
      try {
        root.hljs.highlightElement(c);
      } catch (e) {
        /* без подсветки */
      }
    }
  }

  /* --------------------------------- главная страница ----------------------------- */
  function renderHome() {
    const M = manifest();
    const all = progress.all();
    const cur = doc.getElementById('curriculum');
    if (cur) {
      cur.textContent = '';
      for (const part of M.course.parts || []) {
        const grid = H('div', { class: 'module-grid' });
        for (const id of part.lessons) {
          const l = byId(id);
          if (!l) continue;
          const kids = M.lessons.filter((x) => x.parent === id);
          const ul = H('ul');
          for (const k of kids) {
            ul.appendChild(H('li', null, H('a', { href: lessonUrl(k.id) }, H('span', { class: 'nn' }, k.number), H('span', null, k.title), all[k.id] && all[k.id].done ? H('span', { class: 'ok' }, '✓') : null)));
          }
          const mins = [l, ...kids].reduce((s, x) => s + (x.duration || 0), 0);
          grid.appendChild(
            H(
              'article',
              { class: 'module-card' },
              H('div', { class: 'head' }, H('span', { class: 'n' }, l.number), H('a', { href: lessonUrl(l.id) }, l.title)),
              H('p', { class: 's' }, l.summary || ''),
              kids.length ? ul : null,
              H('div', { class: 'foot' }, H('span', null, 1 + kids.length + ' ' + (kids.length + 1 < 5 ? 'урока' : 'уроков')), H('span', null, '≈ ' + Math.round(mins / 6) / 10 + ' ч'), H('span', null, LEVELS[l.level || 1]))
            )
          );
        }
        cur.appendChild(
          H('section', { class: 'part-block' }, H('div', { class: 'part-title' }, H('span', { class: 'roman' }, part.id), H('h3', null, part.title), H('span', { class: 'd' }, part.description || '')), grid)
        );
      }
    }
    const fm = doc.getElementById('formula-map');
    if (fm && M.course.concept_map) renderConceptMap(fm, M.course.concept_map);
    const cs = doc.getElementById('course-stats');
    if (cs && M.lessons.length) {
      const modules = M.lessons.filter((l) => !l.parent).length;
      const hours = Math.round(M.lessons.reduce((s, l) => s + (l.duration || 0), 0) / 60);
      cs.textContent = 'Интерактивный курс · ' + modules + ' модулей · ' + M.lessons.length + ' уроков · ≈ ' + hours + ' ч';
    }
    const startBtn = doc.getElementById('start-btn');
    const contBtn = doc.getElementById('continue-btn');
    if (startBtn && M.lessons[0]) startBtn.href = lessonUrl(M.lessons[0].id);
    if (contBtn) {
      const next = M.lessons.find((l) => !(all[l.id] && all[l.id].done));
      const visited = M.lessons.some((l) => all[l.id]);
      if (next && visited) {
        contBtn.href = lessonUrl(next.id);
        contBtn.querySelector('span').textContent = 'Продолжить: ' + next.number + ' ' + (next.short || next.title);
        contBtn.hidden = false;
      }
    }
  }

  /** Карта «формула по косточкам»: части формулы → дерево понятий → уроки. */
  function renderConceptMap(box, map) {
    box.textContent = '';
    const big = H('div', { class: 'big', role: 'group', 'aria-label': 'Части формулы градиентного бустинга' });
    const treeBox = H('div', { class: 'concept-tree' });
    const nodeEl = (n, depth) => {
      const hasKids = (n.children || []).length > 0;
      const sum = H('summary');
      sum.innerHTML = n.title;
      if (n.lesson) sum.dataset.go = n.lesson;
      const d = H('details', { class: 'bone' }, sum);
      const body = H('div', { class: 'bone-body' });
      if (n.text) {
        const p = H('p');
        p.innerHTML = n.text;
        body.appendChild(p);
      }
      for (const c of n.children || []) body.appendChild(nodeEl(c, depth + 1));
      if (hasKids || n.text) d.appendChild(body);
      if (depth === 0) d.open = true;
      return d;
    };
    const show = (i) => {
      treeBox.textContent = '';
      const part = map.parts[i];
      const wrap = H('div', { class: 'bones', 'data-title': part.title, 'data-sub': part.sub || 'Раскрывайте элементы — каждый ведёт к своему уроку' });
      for (const c of part.children || []) wrap.appendChild(nodeEl(c, 0));
      treeBox.appendChild(wrap);
      enhance(treeBox);
      GBC.math.render(treeBox);
      btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    };
    const btns = [];
    map.parts.forEach((part, i) => {
      if (part.op) big.appendChild(H('span', { class: 'op' }, GBC.math.tex(part.op)));
      const b = H('button', { type: 'button', 'aria-pressed': 'false', title: part.title }, GBC.math.tex(part.tex));
      b.addEventListener('click', () => show(i));
      btns.push(b);
      big.appendChild(b);
    });
    box.append(big, treeBox);
    show(0);
    GBC.bus.on('mathready', () => {
      // Перерисовать формулу, когда KaTeX догрузится
      btns.forEach((b, i) => b.replaceChildren(GBC.math.tex(map.parts[i].tex)));
      big.querySelectorAll('.op').forEach((o, k) => {
        const withOp = map.parts.filter((p) => p.op);
        if (withOp[k]) o.replaceChildren(GBC.math.tex(withOp[k].op));
      });
    });
  }

  /* --------------------------------- инициализация -------------------------------- */
  function init() {
    const M = manifest();
    const lessonId = doc.documentElement.dataset.lesson;
    const lesson = lessonId ? byId(lessonId) : null;
    const isHome = boot().page === 'home';
    const main = doc.querySelector('main') || doc.body;
    const topbar = buildTopbar(lesson);
    const layout = H('div', { class: 'layout' + (isHome ? ' home' : '') });
    const backdrop = H('div', { class: 'drawer-backdrop' });
    backdrop.addEventListener('click', () => doc.body.classList.remove('drawer-open'));
    doc.body.prepend(topbar);
    if (!isHome) layout.appendChild(buildSidebar(lesson));
    const content = H('div', { class: 'content', id: 'content' });
    main.parentNode.insertBefore(layout, main);
    content.appendChild(main);
    layout.appendChild(content);
    layout.appendChild(backdrop);
    if (lesson && main.classList.contains('lesson')) {
      if (!main.querySelector('.lesson-hero')) main.prepend(buildHero(lesson));
      main.appendChild(buildEnd(lesson));
      doc.title = lesson.number + ' ' + lesson.title + ' — ' + M.course.title;
      progress.set(lesson.id, { visited: Date.now() });
    } else if (lessonId && !lesson) {
      main.prepend(H('div', { class: 'callout warning' }, 'Урок ' + lessonId + ' не найден в манифесте. Запустите: python tools/build.py'));
    }
    enhance(main);
    GBC.mountWidgets(main);
    GBC.ui.mountSteps(main);
    GBC.quiz.mountAll(main);
    GBC.py.mountCells(main);
    if (isHome) renderHome();
    if (!isHome) {
      const toc = buildToc(main);
      if (toc.childNodes.length) layout.insertBefore(toc, backdrop);
      else layout.classList.add('no-toc');
    }
    GBC.math.render(main);
    highlightCode(main);
    GBC.bus.on('hljsready', () => highlightCode(main));
    // Переход к якорю после построения страницы
    if (root.location.hash) {
      const t = doc.getElementById(decodeURIComponent(root.location.hash.slice(1)));
      if (t) setTimeout(() => t.scrollIntoView(), 50);
    }
    doc.documentElement.classList.add('gbc-ready');
    GBC.bus.emit('pageready');
  }

  GBC.page = { init, lessonUrl, byId, setTheme, renderConceptMap, enhance };
})(typeof window !== 'undefined' ? window : globalThis);
