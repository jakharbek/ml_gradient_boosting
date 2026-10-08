# AGENTS.md — руководство для ИИ-агентов и авторов курса

Проект — интерактивный курс **«Градиентный бустинг по косточкам»** на русском языке: от основ
машинного обучения до XGBoost/LightGBM/CatBoost. Каждый урок — это папка с интерактивной
веб-страницей, Jupyter-ноутбуком, примерами, данными и упражнениями.

Этот файл — **источник истины о правилах проекта**. `CLAUDE.md` импортирует его и добавляет
только специфику Claude Code. Если правило меняется — меняйте его здесь.

---

## 1. Золотые правила

1. **Язык контента — русский.** Текст уроков, комментарии в коде уроков, подписи графиков,
   сообщения интерфейса — по-русски. Идентификаторы в коде — английские. Термины при первом
   упоминании даются с английским оригиналом: «темп обучения (learning rate)».
2. **Педагогика «по косточкам».** Каждая тема разбирается от целого к частям и от простого к
   сложному; каждая часть — снова на части, пока не останутся очевидные основы. Понятие
   не используется раньше, чем объяснено (или явно дана ссылка на урок, где оно объясняется).
3. **Один урок = одна папка** `lessons/lesson_X[_Y[_Z]]/` со стандартной структурой (§3).
   Иерархия задаётся только именем: `lesson_4` — модуль, `lesson_4_1` — его урок,
   `lesson_4_1_1` — подурок урока (допустимо, если тема этого требует).
4. **Воспроизводимость до последнего знака.** Все случайности — через генератор Mulberry32
   (`gbcourse.rng` в Python и `GBC.RNG` в JS). Один и тот же `seed` даёт одни и те же данные и
   модели в браузере и в Jupyter. Никакого `Math.random()` / `np.random` в учебных примерах,
   где результат сравнивается с веб-версией.
5. **Паритет JS ↔ Python.** Движок `shared/web/js/engine/*.js` — зеркало пакета
   `shared/python/gbcourse/*.py` (тот же порядок операций, суммирования и вызовов ГПСЧ).
   Меняете одно — меняйте другое и прогоняйте `pytest` (тест `test_parity.py`).
6. **Не редактируйте сгенерированные файлы:** `lessons/*/jupyter_notebooks/*.ipynb`,
   `lessons/*/README.md`, `lessons/*/data/*`, `shared/web/js/generated/*`, блок
   `<!-- curriculum -->` в корневом `README.md`. Правьте источники и запускайте `tools/build.py`.
7. **Веб-часть без сборщика.** Обычные скрипты (не ES-модули), глобальный объект `GBC`,
   страницы работают и по `http://`, и с диска (`file://`). Внешние библиотеки — только с CDN
   (KaTeX, highlight.js, CodeMirror 5, Pyodide) и курс должен работать без них (деградация
   до текста без формул/подсветки/Python).
8. **Всё, что ученик видит на графике, можно получить кодом:** у виджетов есть кнопка «Python»
   (код, воспроизводящий состояние) и, где уместно, «CSV».

---

## 2. Карта репозитория

```text
.
├── index.html                 # главная: карта формулы, программа, прогресс
├── course.json                # части курса, порядок модулей, карта понятий (источник истины)
├── lessons/lesson_*/          # уроки (см. §3)
├── examples/                 # 30 сквозных примеров 1_tiny → 4_large (см. §5, examples/README.md)
├── claude-server/             # локальный HTTP-сервер поверх Claude Code CLI — бэкенд ИИ-ассистента (см. §4)
├── shared/
│   ├── python/gbcourse/       # учебная библиотека (numpy-only ядро, работает в Pyodide)
│   │   ├── rng.py datasets.py losses.py tree.py boosting.py ensembles.py explain.py metrics.py
│   │   ├── style.py plotting.py   # палитра курса и графики matplotlib
│   │   └── cli.py                 # помощник для скриптов examples/ (--save / --no-show)
│   └── web/
│       ├── css/course.css     # дизайн-система: токены светлой/тёмной темы, все компоненты
│       ├── img/               # логотип, favicon
│       └── js/
│           ├── boot.js        # единственный скрипт, который подключает страница
│           ├── core.js        # GBC.util, GBC.h/svg (DOM), bus, storage, io, config
│           ├── engine/        # rng, datasets, losses, tree, boosting, ensembles, explain, metrics
│           ├── viz/           # plot.js (графики), treeview.js (схема дерева)
│           ├── ui/            # controls, quiz, pyrunner (Pyodide), page (каркас страниц),
│           │                  #   markdown + assistant (ИИ-ассистент урока)
│           ├── widgets/       # общие виджеты: boosting-1d, boosting-2d, hero-demo, loss-explorer, tree-1d
│           └── generated/     # manifest.js, pybundle.js — создаёт tools/build.py
├── .github/workflows/pages.yml # публикация курса на GitHub Pages при каждом push в main
├── tools/                     # build.py, check.py, qa.py, qa_assistant.py, serve.py, snapshot.py, new_lesson.py
├── tests/python/              # pytest: паритет JS↔Python, сверка с scikit-learn/shap
├── tests/js/                  # node --test: движок JS, Markdown и логика ИИ-ассистента
└── tests/parity/              # cases.json + run_js.js для теста паритета
```

---

## 3. Анатомия урока

```text
lessons/lesson_4_1/
├── lesson.json                # метаданные (см. ниже)
├── web/index.html             # контент урока (только <main class="lesson">…)
├── web/lesson.js              # виджеты, нужные только этому уроку (необязательно)
├── jupyter_notebooks/
│   ├── lesson_4_1_<тема>.py   # ИСТОЧНИК ноутбука в формате percent («# %%» / «# %% [markdown]»)
│   └── lesson_4_1_<тема>.ipynb# генерируется и выполняется tools/build.py
├── examples/*.py              # самостоятельные скрипты; флаги --save (рисунки в assets/figures) и --no-show
├── data/*.csv + README.md     # генерируются из lesson.json → datasets
├── exercises/tasks.md         # задания со сложностью ★☆☆…★★★
├── exercises/solutions.py     # запускаемые решения
├── assets/                    # иллюстрации (svg) и assets/figures/*.png от примеров
└── README.md                  # генерируется из lesson.json
```

### lesson.json

```json
{
  "id": "lesson_4_1",                      // = имя папки
  "title": "Бустинг на остатках вручную",
  "short": "Остатки вручную",               // для боковой навигации
  "subtitle": "…", "summary": "…",          // подзаголовок и одна-две фразы для карточек
  "level": 1,                               // 1 начальный, 2 средний, 3 продвинутый, 4 экспертный
  "duration": 45,                           // минут
  "prerequisites": ["lesson_1_2"],          // только уроки, идущие раньше
  "objectives": ["… (можно $формулы$)"],     // «После урока вы сможете …»
  "keywords": ["остатки"],
  "datasets": [{"file": "data/toy.csv", "generator": "toy_regression", "params": {}, "title": "…", "description": "…"}]
}
```

Номер, родитель, материалы (ноутбуки, примеры, данные, упражнения) вычисляются автоматически.
Новый **модуль** (`lesson_N`) нужно добавить в `course.json → parts[].lessons`.

### Страница урока (web/index.html)

Шапку, навигацию, оглавление, цели, материалы, «пройдено» и переход к соседним урокам строит
`page.js` из манифеста. В файле — только контент. Каркас:

```html
<!doctype html>
<html lang="ru" data-lesson="lesson_4_1">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>4.1 …</title>
  <link rel="icon" href="../../../shared/web/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../../../shared/web/css/course.css">
  <script src="../../../shared/web/js/boot.js" data-root="../../../" data-scripts="lesson.js"></script>
</head>
<body><main class="lesson" id="lesson"> …разделы… </main></body>
</html>
```

Рекомендуемый порядок разделов (`<section id="…"><h2>…</h2>`): **Зачем это нужно → Интуиция →
Формально → Разбор по косточкам → Интерактив/шаги → В коде → Практика (частые ошибки, советы) →
Итоги → Проверь себя**. Модульные уроки (`lesson_N`) — обзор: зачем модуль, карта его частей
(`.bones` со ссылками `data-go`), живая демонстрация, список уроков `<div data-sublessons></div>`.

### Компоненты разметки

| Разметка | Что даёт |
|---|---|
| `<div class="callout intuition\|definition\|formal\|tip\|warning\|note\|history\|practice">` | выноска с заголовком и значком (`data-title` переопределяет) |
| `<div class="bones" data-title="…"><details class="bone"><summary data-go="lesson_2_1">…</summary><div class="bone-body">…вложенные details…</div></details></div>` | рекурсивный «Разбор по косточкам» с нумерацией 1, 1.1, 1.1.2 и ссылками на уроки |
| `<div class="formula">$$…$$</div>` + `<dl class="formula-legend"><dt>$x$</dt><dd>…</dd></dl>` | формула и расшифровка обозначений |
| `$…$`, `$$…$$`, `\(…\)` | KaTeX (не внутри `<pre>/<code>`) |
| `<div data-widget="имя" data-config='{…}'></div>` | интерактивный виджет |
| `<div class="pycell" data-title="…"><pre><code class="language-python">…</code></pre></div>` | Python в браузере (Pyodide); ячейки страницы делят одно пространство имён, как в Jupyter |
| `<div class="steps"><section class="step">…</section>…</div>` | пошаговый разбор с навигацией |
| `<div class="quiz"><script type="application/json">[{"q","options","answer","explain"}]</script></div>` | тест; `answer` — индекс или массив индексов |
| `<div class="exercise">…<details><summary>Решение</summary><div>…</div></details></div>` | задача на странице |
| `<a data-lesson="lesson_2_1"></a>` | ссылка на урок (текст подставится) |
| `<div data-sublessons></div>` | список уроков модуля |
| `.key-points`, `.compare`, `.grid-2`, `.table-wrap`, `.badge`, `.figure` | вспомогательная вёрстка |
| `<section class="lesson-part" id="part-2"><h2 class="part-head"><span class="part-num">Часть II.</span> Название</h2><p>…</p></section>` | баннер части длинного урока (выделен и в оглавлении); после части — выноска `callout note` «Привал» с итогами |
| `<details class="deeper"><summary>…</summary><div class="deeper-body">…</div></details>` | необязательный углублённый блок с меткой «Глубже» — можно пропустить при первом чтении |
| `<div class="quiz" data-quiz-id="lesson_1_3:part2">…</div>` | мини-тест внутри урока со своим счётом (без `data-quiz-id` результат пишется в общий тест урока) |
| `<pre class="algo">…<span class="hl">…</span> <span class="cm"># …</span></pre>` | псевдокод алгоритма; `.hl` — отличающаяся строка, `.cm` — комментарий |

---

## 4. Веб-архитектура (shared/web/js)

* **Порядок загрузки** задан в `boot.js` (массив `modules`). Новый общий модуль — добавить туда.
* **Версии CDN:** KaTeX и highlight.js — в `boot.js`; Pyodide и CodeMirror — в `core.js → GBC.config`.
* **Виджет:** `GBC.widget('имя', (el, cfg) => { const w = GBC.ui.shell(el, {title, sub}); … })`.
  Каркас даёт `w.controls` (панель слева), `w.main`, `w.foot`, `w.pythonAction(() => code)`,
  `w.csvAction(file, () => columns)`, `w.note(html, live)`.
  Контролы: `GBC.ui.slider/select/segmented/toggle/button/player/stats/table`.
* **Графики:** `new GBC.Plot(parent, {height, x:{label, domain, type:'log'}, y:{…}, crosshair, equal, table})`
  и `plot.render([...слои], {x, y})`. Слои: `points, line, steps, segments, area, polygon, bars, heatmap,
  contour, vline, hline, vband, rect, text, arrows`. Подписи поддерживают индексы: `'F_{m-1}(x)'`.
  Схема дерева — `new GBC.TreeView(parent, opts).render(tree, {highlight: path})`.
* **Движок:** `GBC.datasets.*`, `GBC.losses.get()`, `GBC.RegressionTree`, `GBC.GradientBoosting`,
  `GBC.StageCache` (быстрая «перемотка» числа деревьев), `GBC.AdaBoost`, `GBC.BaggingTrees`,
  `GBC.explain.*`, `GBC.metrics.*`. Параметры — camelCase (`learningRate`); в Python — snake_case.
* **Формулы из JS:** `GBC.math.tex(src, display)` → элемент; `GBC.math.render(el)` — отрисовать область.
* **Тема:** `data-theme` на `<html>`; при смене — событие `GBC.bus 'themechange'` (Plot перерисовывается сам).
* **Безопасность:** данные вставляются через `textContent` (`GBC.h` делает это сам); `innerHTML` —
  только для доверенной разметки курса.

### ИИ-ассистент урока (`ui/assistant.js`, `ui/markdown.js`)

На каждой странице урока: выделил текст → рядом кнопка «Спросить ИИ» (или `Alt+I`, или значок чата в шапке) →
панель чата справа. Ничего в `web/index.html` уроков добавлять не нужно — модуль подключается сам
(`GBC.bus 'pageready'`), на главной странице его нет.

* **Бэкенд** — локальный `claude-server` (`node claude-server/server.js`, порт 8137, OpenAI-совместимый
  `/v1/chat/completions` с потоком SSE поверх `claude -p`; вход — `claude login`, ключ API не нужен).
  `python tools/serve.py` запускает его вместе с курсом (`--no-assistant` — не запускать). Сервер не запущен →
  панель показывает инструкцию; курс без него работает как раньше.
* **Контекст запроса** собирает `buildMessages`: системное сообщение (роль наставника + урок: номер, название,
  цели, разделы), история диалога, последний вопрос с выделенным фрагментом, названием раздела и текстом раздела.
  Текст страницы извлекает `textOf`: формулы KaTeX → TeX (`$…$`), виджеты и тесты → пометки, код → блоки.
* **Лимит размера.** `claude-server` передаёт запрос аргументом командной строки, а в Windows она ограничена
  ~32 тыс. символов → весь запрос ≤ 22 000 символов (`LIMITS` в `assistant.js`): история и текст раздела
  обрезаются. Не увеличивайте лимиты, не проверив на Windows.
* **Скриншот к вопросу.** Кнопка-камера в поле ввода: браузер спрашивает разрешение на показ вкладки
  (`getDisplayMedia`), берётся ОДИН кадр, показ сразу останавливается, и ученик выделяет область уже на
  застывшем кадре (панель чата на время снимка скрыта). Не возвращайте схему «сначала рамка, потом кадр»:
  захват неподвижной вкладки отдаёт устаревший кадр, и рамка попадает в снимок. Картинку можно также
  вставить из буфера (Ctrl+V); где захвата нет (телефон) — кнопка открывает выбор файла. Снимок уменьшается
  до 1568 px, уходит в формате OpenAI (`image_url` с data-URL) только с текущим вопросом и не сохраняется в
  localStorage (после перезагрузки — пометка). `claude-server` передаёт картинки в `claude -p` через stdin
  (`--input-format stream-json`) и сообщает о поддержке в `/health` (`images: true`); старой запущенной копии
  сервера нужен перезапуск — панель об этом предупреждает.
* **Инструменты Claude Code выключены:** запрос не передаёт `allow_tools`, `permission_mode`, `cwd` — модель
  только отвечает текстом. Не включайте их из браузера. Сервер обеспечивает это сам: без
  `CLAUDE_SERVER_ALLOW_TOOLS=1` запускает `claude` с `--tools "" --strict-mcp-config` и отвечает 403 на эти поля;
  чужие `Origin`/`Host` получают 403, POST не в `application/json` — 415 (любой сайт в браузере может
  достучаться до `127.0.0.1`). Не ослабляйте эти проверки.
* **Ответ модели — недоверенные данные:** показывается через `GBC.md` (разбор Markdown в дерево → DOM через
  `GBC.h`, без `innerHTML`; ссылки — только http/https). Формулы — `GBC.math.tex`, код — highlight.js.
* **Настройки** по умолчанию — `GBC.config.assistant` (`url`, `model`, `effort`, `token`); ученик меняет их в панели
  (localStorage `gbc:assistant-settings`). Диалог хранится по урокам (`gbc:assistant:<id урока>`).
* **Проверка:** `node --test "tests/js/*.test.js"` (разбор Markdown, SSE, сборка запроса) и
  `python tools/qa_assistant.py` — сквозной сценарий в браузере с подставным сервером (к Claude не обращается);
  `--live` добавляет один настоящий запрос к запущенному `claude-server`.

### Графики и цвета (обязательно)

Палитра проверена на дальтонизм (валидатор dataviz, OKLab ΔE). Роли едины во всём курсе:

| Роль | Цвет | Где |
|---|---|---|
| `data` | нейтральный серый | точки данных |
| `truth` | приглушённый, пунктир | истинная функция |
| `model` | синий | текущая модель F_m |
| `model-prev` | светло-синий | F_{m−1} |
| `tree` | оранжевый | новое дерево h_m |
| `residual` | серый | отрезки-остатки |
| `train` / `valid` / `test` | синий / оранжевый / бирюзовый | кривые и выборки |
| `class0/1/2` | синий / оранжевый / бирюзовый | классы (не более 3 на точечном графике) |
| расходящаяся шкала | синий ↔ серый ↔ красный | знак (остатки, SHAP) |
| вероятность класса 1 | синий ↔ серый ↔ оранжевый | поверхность решения |

Правила: одна ось Y (никаких двух шкал), линии 2 px, точки r ≥ 4 с кольцом цвета фона, сетка —
сплошные тонкие линии, легенда при ≥ 2 сериях, текст — цветами текста, а не цветом серии,
у графиков с данными — подсказки и «Показать таблицу». В matplotlib — `gbcourse.plotting`
и `use_course_style()` (те же цвета).

---

## 5. Python: gbcourse, ноутбуки, примеры

* Ядро `gbcourse` зависит только от numpy (работает в Pyodide). `plotting` импортирует matplotlib лениво.
* Реализации сверены с эталонами: дерево и бустинг совпадают с scikit-learn до ~1e-15, значения
  Шепли — с `shap.TreeExplainer`. Не ломайте это (тесты в `tests/python`).
* Суммы, влияющие на выбор разбиений, — последовательные (`_numeric.seq_sum`), как в JS.
* **Ноутбук:** первая кодовая ячейка — подключение библиотеки:

  ```python
  import sys
  from pathlib import Path
  ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
  sys.path.insert(0, str(ROOT / "shared" / "python"))
  ```

  Структура: заголовок `# Урок X.Y. …` → цели → разделы урока с кодом и графиками → сверка с
  библиотекой (sklearn/xgboost/…) → упражнения (решения — в `exercises/solutions.py`).
  Ноутбук должен выполняться целиком за разумное время (< 2 мин) на обычном ноутбуке.
* **Пример** (`examples/*.py`): первая строка докстринга — название (попадает в материалы урока),
  затем `Запуск: python lessons/<id>/examples/<file>.py [--save] [--no-show]`; используйте
  `gbcourse.cli.Example` и `ex.finish(fig, "имя")`. Скрипт печатает понятный вывод и проверяет
  ключевые утверждения `assert`-ами.
* **Сквозные примеры** (`examples/<уровень>/NN_*.py`, уровни `1_tiny`, `2_small`, `3_medium`, `4_large`):
  докстринг «Цель / Чему научитесь / Датасет / Этапы / Связанные уроки / Запуск», каркас `_common.Example`
  (`stage`, `describe`, `note`, `timer`, `finish`, флаги `--save --no-show --quick`), генераторы данных —
  `_data.py`. Выводы `ex.note` пишутся **после** запуска и совпадают с фактическим выводом; ключевые — `assert`
  (в режиме `--quick` — только устойчивые). Новый пример — строка в таблице `examples/README.md`;
  проверка — `python examples/run_all.py` (и `--quick`). CatBoost — всегда с `allow_writing_files=False`.
  **Ноутбуки** `examples/<уровень>/notebooks/*.ipynb` генерируются `python examples/build_notebooks.py`
  (не правьте их вручную): вводная ячейка — из докстринга (поля «Чему научитесь» — пункты через `;`,
  «Попробуйте сами: 1) … 2) … 3) …»), каждый `ex.stage(n, "литерал")` верхнего уровня — markdown-заголовок.
  После правки примера: `run_all.py --only NN`, затем `build_notebooks.py --only NN`; `--check` — всё актуально.
* Стиль: ruff (`ruff check .`), типы в сигнатурах публичных функций, докстринги на русском.

---

## 6. Команды

```bash
# окружение (Python 3.11–3.12)
python -m venv .venv && .venv\Scripts\activate      # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt

python tools/build.py                        # манифест, README уроков, данные, pybundle, .ipynb (без выполнения;
                                             #   выполненный ноутбук с неизменным исходником не трогает)
python tools/build.py notebooks --execute    # выполнить все ноутбуки (или --only lesson_4_1)
python tools/build.py examples               # прогнать все примеры и решения, сохранить рисунки
python tools/check.py                        # статическая проверка структуры и ссылок
python -m pytest                             # тесты Python (включая паритет с JS)
node --test "tests/js/*.test.js"                         # тесты JS-движка
python tools/qa.py [--only lesson_4_1] [--run-python]   # проверка страниц в браузере (Playwright)
python tools/qa_assistant.py [--live]        # ИИ-ассистент: сквозной сценарий с подставным сервером
python tools/snapshot.py lessons/lesson_4_1/web/index.html --out shot.png   # скриншот
python tools/serve.py                        # локальный сервер + открыть курс (+ claude-server для ИИ-ассистента)
python tools/new_lesson.py lesson_5_4 "Название"        # заготовка урока
```

---

## 7. Как добавить или изменить урок

1. `python tools/new_lesson.py lesson_X_Y "Название"` (или скопируйте соседний урок).
2. Заполните `lesson.json` (цели, пререквизиты, наборы данных).
3. Напишите `web/index.html` по порядку разделов из §3; уникальные виджеты — в `web/lesson.js`,
   переиспользуемые — в `shared/web/js/widgets/`.
4. Напишите исходник ноутбука, 1–3 примера, `exercises/tasks.md` и `exercises/solutions.py`.
5. Новый модуль — добавить в `course.json`; при необходимости — узлы в карту понятий.
6. Прогоните проверку качества (§8).

## 8. Чек-лист перед завершением работы

- [ ] `python tools/build.py` и `python tools/build.py notebooks --execute --only <урок>` — без ошибок;
- [ ] `python tools/build.py examples --only <урок>` — примеры и решения работают;
- [ ] `python tools/check.py` — 0 проблем; `python -m pytest` и `node --test "tests/js/*.test.js"` — зелёные;
- [ ] `python tools/qa.py --only <урок> --run-python` — нет ошибок JS, все виджеты и Python-ячейки работают;
- [ ] после правок `ui/assistant.js`, `ui/markdown.js`, каркаса страниц или CSS — `python tools/qa_assistant.py`;
- [ ] страница просмотрена в светлой и тёмной теме и на ширине 390 px (без горизонтальной прокрутки);
- [ ] формулы отрисованы, термины объяснены до использования, есть «Разбор по косточкам», итоги и тест;
- [ ] числа в тексте урока совпадают с тем, что выдают виджеты и ноутбук.

## 9. Частые ошибки

* `*/` внутри блочного комментария JS (например, путь `lessons/*/…`) закрывает комментарий.
* Кириллица в консоли Windows: скрипты делают `sys.stdout.reconfigure(encoding="utf-8")`.
* В `data-config` — строгий JSON (двойные кавычки), а атрибут — в одинарных кавычках.
* `h2/h3` внутри виджетов и выносок не попадают в оглавление — это нормально.
* Pyodide грузится только в модульном воркере (`import` из `pyodide.mjs`) — не возвращайте `importScripts`.
  При открытии страницы с диска (`file://`) браузеры модульные воркеры не запускают вовсе — `pyrunner.js`
  тогда выполняет тот же код движка в самой странице (`inPageEngine`). Правки Python-ячеек проверяйте и по
  `http://`, и с диска.
* Не используйте `np.random`/`Math.random` там, где результат должен совпасть с веб-версией.
* «До последнего знака» — с оговоркой: `sin`/`cos`/`log`/`exp` в V8 и в libm (и в разных ОС) иногда
  расходятся в последнем бите, поэтому данные генераторов совпадают с точностью ~1e-15. Отсюда шум в последних
  знаках `data/*.csv` после `tools/build.py` на другой машине (не коммитьте его) и то, что тест паритета обучает
  Python-модели на данных из JS: при равных выигрышах разбиений такой бит меняет дерево.
* `data-scripts` в `boot.js` — список **через запятую**: `data-scripts="results.js,lesson.js"`.
* `datasets.regression_1d` возвращает объекты, **упорядоченные по x**: не делите их срезом `X[:n]` —
  используйте `train_test_split` или перестановку (`friedman1` не упорядочен).
* Тяжёлые опыты (бенчмарки библиотек, сетки параметров) не считаются в браузере: пример
  `examples/<имя>.py` сохраняет итоги в `web/results.js` (`GBC.<имя> = {…}`), виджет их показывает,
  ноутбук загружает тот же файл. Числа в тексте урока берутся из этого файла.
* Измеренное время в `results.js` меняется от запуска к запуску; если текст цитирует время — после
  повторного прогона примера проверьте текст.
* LightGBM 4.7 (Jupyter): `fit(..., eval_X=(X_val,), eval_y=(y_val,))`; в браузере (Pyodide, LightGBM 4.6)
  — прежний `eval_set`. Со своей целевой функцией LightGBM стартует с нуля (нужен `init_score`, который
  **не** добавляется в `predict`) и по-прежнему останавливается по встроенной метрике (передавайте `metric="None"`).
* CatBoost и Optuna в браузерной сборке Python нет — их код даётся блоком `<pre><code>` вне `.pycell`.
* Каждое числовое утверждение урока проверяется запуском; найденные расхождения исправляются в тексте,
  а не подгоняются под ожидания.
