# Упражнения к уроку 2.3

Решения: [`solutions.py`](solutions.py) — `python lessons/lesson_2_3/exercises/solutions.py`.

## 1. Правильный min_leaf ★★☆

Функция `build` из ноутбука проверяет `min_leaf` уже после выбора порога. Перепишите `best_split`
так, чтобы недопустимые пороги исключались до выбора, и сверьте прогнозы с
`DecisionTreeRegressor(max_depth=5, min_samples_leaf=10)`.

## 2. Кривая min_samples_leaf ★☆☆

На данных ноутбука (п. 3) постройте MSE на тесте для `min_samples_leaf` от 1 до 60 (без ограничения
глубины). Где минимум?

## 3. XOR и пни ★★★

Обучите на XOR (`classification_2d("xor", n=200, noise=0.12, seed=9)`) бустинг
`GBClassifier(max_depth=1, n_estimators=200)` и `GBClassifier(max_depth=2, n_estimators=200)`.
Сравните точность и объясните разницу.
