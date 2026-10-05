<!-- Файл создан автоматически: python tools/build.py data. Правьте lesson.json. -->

# Данные урока 8

Все наборы детерминированы: их можно пересоздать в Python или получить в веб-уроке
с теми же параметрами (генератор Mulberry32 одинаков в JS и Python).

## `moons.csv` — Две луны

Бинарная классификация для сравнения режимов friedman и newton.

- Столбцы: `x0`, `x1`, `y`; строк: 400.
- Как получить в Python: `datasets.classification_2d(kind='moons', n=400, noise=0.3, seed=90)`
