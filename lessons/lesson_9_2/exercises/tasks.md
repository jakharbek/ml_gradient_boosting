# Упражнения к уроку 9.2

Решения: [`solutions.py`](solutions.py) — `python lessons/lesson_9_2/exercises/solutions.py`.

## 1. GOSS в регрессии ★★☆

Повторите эксперимент «GOSS своими руками» из ноутбука для регрессии: `regression_1d(kind="wave", n=1000, noise=0.3, seed=93)`,
модель `GBRegressor(n_estimators=10, learning_rate=0.3, max_depth=2)`, $g = F - y$, $h = 1$.
Какую долю $\sum|g|$ несут 20% объектов с наибольшим $|g|$? Помогает ли GOSS по сравнению с равномерной подвыборкой?

## 2. Обыграть 4 листа ★★☆

На данных урока (`friedman1(n=1000, noise=1.0, seed=94)`, 30% валидация) переберите `num_leaves ∈ {2, 3, 4, 6}`
и `learning_rate ∈ {0.02, 0.05, 0.1}` с ранней остановкой. Какая комбинация лучшая?
