<!-- Файл создан автоматически: python tools/build.py manifest. Правьте lesson.json. -->

# Урок 13.1. Ранжирование: LambdaMART

> Когда важен не прогноз, а порядок: NDCG, попарные потери и «лямбды» — градиенты, взвешенные тем, насколько перестановка меняет метрику

**Модуль:** [13. Продвинутые задачи: ранжирование, неопределённость, эксплуатация](../lesson_13/README.md) · **Уровень:** Экспертный · **Время:** ~45 мин

**Нужно знать:** [13 Продвинутые задачи: ранжирование, неопределённость, эксплуатация](../lesson_13/README.md), [8.2 Регуляризованная цель: веса листьев и выигрыш разбиения](../lesson_8_2/README.md)

Задача ранжирования: запросы, документы, оценки релевантности. Метрика NDCG@k. Поточечный, попарный (RankNet) и списочный (LambdaRank) подходы; LambdaMART — бустинг второго порядка по «лямбдам». Реализация своими руками на дереве gbcourse и сравнение с LightGBM и XGBoost.

## После урока вы сможете

- вычислять DCG и NDCG@k
- объяснить попарную потерю RankNet и вес |ΔNDCG| в LambdaRank
- обучить ранжирующую модель в LightGBM и XGBoost

## Материалы

| Что | Файл |
|---|---|
| Интерактивный урок (открыть в браузере) | [web/index.html](web/index.html) |
| Jupyter-ноутбук: Урок 13.1. Ранжирование: LambdaMART | [jupyter_notebooks/lesson_13_1_lambdamart.ipynb](jupyter_notebooks/lesson_13_1_lambdamart.ipynb) |
| Пример: LambdaMART своими руками на дереве gbcourse и сравнение с LightGBM (lambdarank) и XGBoost (rank:ndcg) | [examples/lambdamart.py](examples/lambdamart.py) |
| Данные: Служебный набор | [data/toy_regression.csv](data/toy_regression.csv) |
| Решения | [exercises/solutions.py](exercises/solutions.py) |
| Задания | [exercises/tasks.md](exercises/tasks.md) |

## Как работать с уроком

1. Откройте `web/index.html` в браузере (или запустите `python tools/serve.py` из корня курса).
   Все графики интерактивны; ячейки Python выполняются прямо на странице.
2. Повторите всё в ноутбуке: `jupyter lab` из корня курса → откройте файл из `jupyter_notebooks/`.
3. Запустите примеры: `python lessons/lesson_13_1/examples/<файл>.py`.
4. Решите упражнения из `exercises/` и сверьтесь с решениями.

## Структура папки

```text
lesson_13_1/
├── lesson.json          # метаданные урока (источник истины для навигации)
├── web/                 # интерактивная страница: index.html + lesson.js
├── jupyter_notebooks/   # ноутбук (.ipynb) и его исходник в формате percent (.py)
├── examples/            # самостоятельные воспроизводимые скрипты
├── data/                # данные урока (CSV) и их описание
├── exercises/           # задания и решения
└── assets/              # иллюстрации и рисунки, созданные примерами
```
