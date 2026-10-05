# CLAUDE.md

Все правила проекта — в AGENTS.md (импортируется ниже). Здесь — только то, что специфично для Claude Code.

@AGENTS.md

## Специфика Claude Code

- **Окружение.** Виртуальное окружение — `.venv` (Python 3.12). Запускайте инструменты его
  интерпретатором: `.venv/Scripts/python.exe tools/build.py` (Windows, Git Bash) или
  `.venv\Scripts\python tools\build.py` (PowerShell). Системный Python может быть другой версии
  без нужных пакетов.
- **После любой правки урока** выполняйте цикл из §8 AGENTS.md. Минимум:
  `tools/build.py` → `tools/check.py` → `tools/qa.py --only <урок>`. Для правок движка — ещё
  `pytest` (паритет JS↔Python) и `node --test "tests/js/*.test.js"`.
- **Визуальная проверка.** Если расширение Claude in Chrome подключено — смотрите страницу в нём.
  Иначе: `tools/snapshot.py … --out <scratchpad>/shot.png [--crop x0,y0,x1,y1]` и откройте
  PNG инструментом Read. Проверяйте обе темы (`--dark`) и узкий экран (`--width 390`).
- **Сгенерированное не редактировать** (`*.ipynb`, README уроков, `data/`, `generated/`) —
  правьте источники и пересобирайте.
- **Большие уроки** пишите целиком за один вызов Write (страница, lesson.js, ноутбук), затем
  проверяйте; не дробите HTML на десятки мелких правок.
- **Коммиты** — только по просьбе пользователя.
