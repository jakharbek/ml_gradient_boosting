<!-- Файл создан автоматически: python tools/build.py manifest. Правьте lesson.json. -->

# Урок 9.2. LightGBM: рост по листьям, GOSS и связывание признаков

> Три идеи Microsoft: растить дерево там, где выгоднее всего; учиться на объектах с большими градиентами; склеивать редкие признаки

**Модуль:** [9. Библиотеки бустинга: XGBoost, LightGBM, CatBoost](../lesson_9/README.md) · **Уровень:** Продвинутый · **Время:** ~45 мин

**Нужно знать:** [9 Библиотеки бустинга: XGBoost, LightGBM, CatBoost](../lesson_9/README.md), [8.3 Поиск разбиений: точный перебор, гистограммы и пропуски](../lesson_8_3/README.md), [7.2 Стохастический бустинг: подвыборки строк и признаков](../lesson_7_2/README.md)

Рост по листьям (leaf-wise) против роста по уровням и почему в LightGBM главный параметр — num_leaves; выборка по градиентам GOSS: когда она точнее равномерной подвыборки и почему не обязательно быстрее; связывание взаимоисключающих признаков EFB. Все утверждения проверены на LightGBM 4.7.

## После урока вы сможете

- объяснить рост по листьям и настроить num_leaves, min_child_samples и max_depth
- описать GOSS и условия, при которых он лучше равномерной подвыборки
- объяснить идею EFB и когда она ускоряет обучение

## Материалы

| Что | Файл |
|---|---|
| Интерактивный урок (открыть в браузере) | [web/index.html](web/index.html) |
| Jupyter-ноутбук: Урок 9.2. LightGBM: рост по листьям, GOSS и связывание признаков | [jupyter_notebooks/lesson_9_2_lightgbm.ipynb](jupyter_notebooks/lesson_9_2_lightgbm.ipynb) |
| Пример: LightGBM: лучшая ошибка на валидации в зависимости от num_leaves при двух значениях min_child_samples | [examples/leaf_budget.py](examples/leaf_budget.py) |
| Данные: Задача Фридмана, 1000 объектов | [data/friedman1_1000.csv](data/friedman1_1000.csv) |
| Решения | [exercises/solutions.py](exercises/solutions.py) |
| Задания | [exercises/tasks.md](exercises/tasks.md) |

## Как работать с уроком

1. Откройте `web/index.html` в браузере (или запустите `python tools/serve.py` из корня курса).
   Все графики интерактивны; ячейки Python выполняются прямо на странице.
2. Повторите всё в ноутбуке: `jupyter lab` из корня курса → откройте файл из `jupyter_notebooks/`.
3. Запустите примеры: `python lessons/lesson_9_2/examples/<файл>.py`.
4. Решите упражнения из `exercises/` и сверьтесь с решениями.

## Структура папки

```text
lesson_9_2/
├── lesson.json          # метаданные урока (источник истины для навигации)
├── web/                 # интерактивная страница: index.html + lesson.js
├── jupyter_notebooks/   # ноутбук (.ipynb) и его исходник в формате percent (.py)
├── examples/            # самостоятельные воспроизводимые скрипты
├── data/                # данные урока (CSV) и их описание
├── exercises/           # задания и решения
└── assets/              # иллюстрации и рисунки, созданные примерами
```
