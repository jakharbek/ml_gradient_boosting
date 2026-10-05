<!-- Файл создан автоматически: python tools/build.py manifest. Правьте lesson.json. -->

# Урок 9.1. XGBoost на практике

> Два интерфейса, ранняя остановка, метрики, пять видов важности признаков, категории и сохранение модели

**Модуль:** [9. Библиотеки бустинга: XGBoost, LightGBM, CatBoost](../lesson_9/README.md) · **Уровень:** Продвинутый · **Время:** ~40 мин

**Нужно знать:** [9 Библиотеки бустинга: XGBoost, LightGBM, CatBoost](../lesson_9/README.md), [8.2 Регуляризованная цель: веса листьев и выигрыш разбиения](../lesson_8_2/README.md)

Практическая работа с XGBoost: sklearn-обёртка и нативный xgb.train с DMatrix; ранняя остановка и best_iteration; метрики качества; важности weight / gain / cover и почему частота разбиений вводит в заблуждение; категориальные признаки; сохранение и загрузка.

## После урока вы сможете

- обучать XGBoost через оба интерфейса и с ранней остановкой
- различать виды важности признаков и выбирать подходящий
- сохранять модель и воспроизводимо загружать её

## Материалы

| Что | Файл |
|---|---|
| Интерактивный урок (открыть в браузере) | [web/index.html](web/index.html) |
| Jupyter-ноутбук: Урок 9.1. XGBoost на практике | [jupyter_notebooks/lesson_9_1_xgboost.ipynb](jupyter_notebooks/lesson_9_1_xgboost.ipynb) |
| Пример: Пять видов важности признаков XGBoost на задаче Фридмана (x5–x9 — шум) | [examples/importance_types.py](examples/importance_types.py) |
| Данные: Задача Фридмана, 1000 объектов | [data/friedman1_1000.csv](data/friedman1_1000.csv) |
| Решения | [exercises/solutions.py](exercises/solutions.py) |
| Задания | [exercises/tasks.md](exercises/tasks.md) |

## Как работать с уроком

1. Откройте `web/index.html` в браузере (или запустите `python tools/serve.py` из корня курса).
   Все графики интерактивны; ячейки Python выполняются прямо на странице.
2. Повторите всё в ноутбуке: `jupyter lab` из корня курса → откройте файл из `jupyter_notebooks/`.
3. Запустите примеры: `python lessons/lesson_9_1/examples/<файл>.py`.
4. Решите упражнения из `exercises/` и сверьтесь с решениями.

## Структура папки

```text
lesson_9_1/
├── lesson.json          # метаданные урока (источник истины для навигации)
├── web/                 # интерактивная страница: index.html + lesson.js
├── jupyter_notebooks/   # ноутбук (.ipynb) и его исходник в формате percent (.py)
├── examples/            # самостоятельные воспроизводимые скрипты
├── data/                # данные урока (CSV) и их описание
├── exercises/           # задания и решения
└── assets/              # иллюстрации и рисунки, созданные примерами
```
