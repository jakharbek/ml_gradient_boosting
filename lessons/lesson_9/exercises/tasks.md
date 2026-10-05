# Упражнения к уроку 9

Решения: [`solutions.py`](solutions.py) — `python lessons/lesson_9/exercises/solutions.py`.

## 1. Доля признаков на дерево ★☆☆

Как называется параметр «доля признаков на дерево» в XGBoost, LightGBM и CatBoost? Обучите каждую библиотеку
со значением 0.5 на `friedman1(n=2000, noise=1.0, seed=91)` и убедитесь, что параметр принят
(сравните с моделью по умолчанию).

## 2. XGBoost «как LightGBM» ★★☆

Обучите XGBoost с параметрами, близкими к умолчаниям LightGBM: `learning_rate=0.1`, `grow_policy="lossguide"`,
`max_leaves=31`, `max_depth=0`, `reg_lambda=0`, `min_child_weight=1e-3`. Сравните ошибку на тесте
с LightGBM по умолчанию и с XGBoost по умолчанию. Какие отличия остаются?
