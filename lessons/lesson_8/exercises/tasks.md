# Упражнения к уроку 8

Решения: [`solutions.py`](solutions.py) — `python lessons/lesson_8/exercises/solutions.py`.

## 1. Лист как взвешенное среднее ★☆☆

Покажите, что с L2-штрафом значение листа $w = -G/(H+\lambda)$ равно $\sum h_i z_i / (\sum h_i + \lambda)$,
и проверьте это численно на `RegressionTree(reg_lambda=5)` по данным `classification_2d(kind="moons", n=400, noise=0.3, seed=90)`.

## 2. Уверенная ошибка ★★☆

Обучите `GBClassifier(mode="newton", n_estimators=10, learning_rate=0.3, max_depth=3)` на тех же данных.
Найдите объект с наибольшим $|z|$. Какая у него доля в сумме $H$ своего листа следующего дерева?
