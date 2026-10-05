# Упражнения к уроку 6.3

Решения: [`solutions.py`](solutions.py) — `python lessons/lesson_6_3/exercises/solutions.py`.

## 1. K = 2 ★★☆

Покажите, что softmax с двумя логитами равен сигмоиде от их разности. Обучите `GBClassifier` на
бинарной задаче и softmax-бустинг (`GradientBoosting(loss="softmax", n_classes=2)`) и сравните вероятности.
Совпадают ли они? Объясните, какую роль играет множитель (K − 1)/K.

## 2. Цена классов ★☆☆

Измерьте время обучения `GradientBoostingClassifier(n_estimators=100, max_depth=3)` на `load_digits`
для 10 классов и для бинарной задачи «цифра 0 против остальных».
