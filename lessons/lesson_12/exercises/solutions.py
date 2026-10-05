"""Решения упражнений урока 12.

Запуск:  python lessons/lesson_12/exercises/solutions.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np

from gbcourse import GBRegressor, datasets
from gbcourse.explain import shapley_values

X, y = datasets.friedman1(n=600, noise=1.0, seed=180, n_features=7)
model = GBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1).fit(X, y)
res = [shapley_values(model, X[i]) for i in range(200)]
base = res[0][0]
phis = np.array([r[1] for r in res])

# 1
i = int(np.argmax(np.abs(phis.sum(1))))
print(f"1) объект {i}: F(x) − φ₀ = {phis[i].sum():+.3f}; признаки {np.round(X[i], 2)}")
for j in np.argsort(-np.abs(phis[i]))[:3]:
    print(f"   x{j} = {X[i, j]:.2f}: вклад {phis[i, j]:+.3f}")
print("   y = 10 sin(π x0 x1) + 20 (x2 − 0.5)² + 10 x3 + 5 x4. Здесь x3 ≈ 0 (слагаемое 10·x3 почти нулевое), а x0·x1 ≈ 0.05 —")
print("   синус мал. Поэтому x3, x1 и x0 тянут прогноз вниз, и он намного ниже среднего. Знаки вкладов согласуются с формулой.")

# 2
shap_imp = np.abs(phis).mean(0)
gain_imp = model.feature_importances_
print("2) средний |φ|:     ", " > ".join(f"x{j}" for j in np.argsort(-shap_imp)))
print("   доля выигрыша:   ", " > ".join(f"x{j}" for j in np.argsort(-gain_imp)))
print("   Средний |φ| — в единицах прогноза: насколько признак в среднем сдвигает прогноз объекта. Выигрыш — насколько")
print("   разбиения по признаку уменьшили потери при обучении. Порядок обычно близок, но не обязан совпадать.")
