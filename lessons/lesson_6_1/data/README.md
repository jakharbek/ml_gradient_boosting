<!-- Файл создан автоматически: python tools/build.py data. Правьте lesson.json. -->

# Данные урока 6.1

Все наборы детерминированы: их можно пересоздать в Python или получить в веб-уроке
с теми же параметрами (генератор Mulberry32 одинаков в JS и Python).

## `blobs_imbalanced.csv` — Два облака, 25% класса 1

Для проверки F₀ = log(p/(1−p)) при несбалансированных классах.

- Столбцы: `x0`, `x1`, `y`; строк: 200.
- Как получить в Python: `datasets.classification_2d(kind='blobs', n=200, noise=0.8, seed=62, balance=0.25)`
