<!-- Файл создан автоматически: python tools/build.py data. Правьте lesson.json. -->

# Данные урока 10.1

Все наборы детерминированы: их можно пересоздать в Python или получить в веб-уроке
с теми же параметрами (генератор Mulberry32 одинаков в JS и Python).

## `categorical_100.csv` — Категория из 100 значений

y = эффект категории + sin(x) + шум; частоты категорий убывают.

- Столбцы: `x`, `category`, `y`; строк: 6000.
- Как получить в Python: `datasets.categorical_regression(n=6000, n_categories=100, noise=1.0, seed=140)`
