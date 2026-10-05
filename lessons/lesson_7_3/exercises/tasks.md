# Упражнения к уроку 7.3

Решения: [`solutions.py`](solutions.py) — `python lessons/lesson_7_3/exercises/solutions.py`.

## 1. Вес листа с α ★★☆

Для L2-потерь ($g_i = F_i - y_i$, $h_i = 1$) минимизируйте по $w$
$\sum_{i \in R}\big[g_i w + \tfrac12 w^2\big] + \tfrac{\lambda}{2}w^2 + \alpha|w|$. Когда оптимум ровно 0?
Сверьте с `RegressionTree(reg_alpha=...)`.

## 2. γ и размер деревьев ★☆☆

Постройте среднее число листьев бустинга второго порядка (глубина 5, 200 деревьев) от γ ∈ [0, 50]
на `friedman1(n=300, noise=2.0, seed=75)`.
