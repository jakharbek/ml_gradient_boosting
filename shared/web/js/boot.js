/* =====================================================================================
 * boot.js — единственный скрипт, который подключает страница курса:
 *
 *   <link rel="stylesheet" href="../../../shared/web/css/course.css">
 *   <script src="../../../shared/web/js/boot.js" data-root="../../../" data-scripts="lesson.js"></script>
 *
 * data-root    — путь от страницы до корня курса;
 * data-page    — "lesson" (по умолчанию) или "home";
 * data-scripts — дополнительные скрипты страницы через запятую (относительно страницы).
 *
 * Делает: применяет тему до отрисовки (без «вспышки»), по порядку загружает модули
 * курса, параллельно — KaTeX и highlight.js с CDN (без них всё работает, просто
 * без формул/подсветки), затем вызывает GBC.page.init().
 * Работает и по http://, и при открытии файла с диска (file://).
 * ===================================================================================== */
(function () {
  'use strict';
  var me = document.currentScript;
  var root = (me && me.getAttribute('data-root')) || './';
  var page = (me && me.getAttribute('data-page')) || 'lesson';
  var extra = (me && me.getAttribute('data-scripts')) || '';
  window.GBC_BOOT = { root: root, page: page };

  // Версии библиотек с CDN (Pyodide и CodeMirror — в core.js → GBC.config)
  var KATEX = '0.16.22';
  var HLJS = '11.11.1';

  // 1) Тема до первой отрисовки
  var theme = null;
  try {
    theme = JSON.parse(localStorage.getItem('gbc:theme'));
  } catch (e) {
    theme = null;
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);

  // 2) Библиотеки с CDN (не блокируют загрузку курса)
  function css(href) {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }
  function script(src, onload, ordered) {
    var s = document.createElement('script');
    s.src = src;
    s.async = !ordered;
    s.onload = function () {
      if (onload) onload(true);
    };
    s.onerror = function () {
      console.warn('[GBC] не удалось загрузить', src);
      if (onload) onload(false);
    };
    document.head.appendChild(s);
  }
  var gbcReady = false;
  var katexReady = false;
  function maybeFlushMath() {
    if (gbcReady && katexReady && window.GBC && window.GBC.math) window.GBC.math._flush();
  }
  css('https://cdn.jsdelivr.net/npm/katex@' + KATEX + '/dist/katex.min.css');
  script('https://cdn.jsdelivr.net/npm/katex@' + KATEX + '/dist/katex.min.js', function (ok) {
    if (!ok) return;
    script('https://cdn.jsdelivr.net/npm/katex@' + KATEX + '/dist/contrib/auto-render.min.js', function (ok2) {
      if (!ok2) return;
      katexReady = true;
      maybeFlushMath();
    });
  });
  script('https://cdnjs.cloudflare.com/ajax/libs/highlight.js/' + HLJS + '/highlight.min.js', function (ok) {
    if (ok && window.GBC && window.GBC.bus) window.GBC.bus.emit('hljsready');
  });

  // 3) Модули курса — строго по порядку
  var base = root + 'shared/web/js/';
  var modules = [
    'core.js',
    'engine/rng.js',
    'engine/datasets.js',
    'engine/losses.js',
    'engine/tree.js',
    'engine/boosting.js',
    'engine/ensembles.js',
    'engine/explain.js',
    'engine/metrics.js',
    'viz/plot.js',
    'viz/treeview.js',
    'ui/controls.js',
    'ui/quiz.js',
    'ui/pyrunner.js',
    'ui/page.js',
    'ui/markdown.js',
    'ui/assistant.js',
    'widgets/common.js',
    'widgets/boosting.js',
    'generated/manifest.js',
  ];
  var list = modules.map(function (m) {
    return base + m;
  });
  extra
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean)
    .forEach(function (s) {
      list.push(s);
    });

  var remaining = list.length;
  function done() {
    remaining -= 1;
    if (remaining === 0) start();
  }
  list.forEach(function (src) {
    script(src, done, true);
  });

  function start() {
    var go = function () {
      if (!window.GBC || !window.GBC.page) {
        console.error('[GBC] модули курса не загрузились — проверьте data-root у boot.js');
        return;
      }
      window.GBC.page.init();
      gbcReady = true;
      maybeFlushMath();
      if (window.hljs) window.GBC.bus.emit('hljsready');
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
    else go();
  }
})();
