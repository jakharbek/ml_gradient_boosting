# Упражнения к модулю 5

Решения: [`solutions.py`](solutions.py) — `python lessons/lesson_5/exercises/solutions.py`.

## 1. Выбросы и выбор потерь ★★☆

На `regression_1d(kind="wave", n=300, noise=0.3, seed=51, outliers=p)` для p ∈ {0, 0.08, 0.2}
сравните MAE до истинной функции у бустинга с потерями squared, absolute и huber (δ = 1).
Какая функция потерь лучше без выбросов и какая — с ними?
