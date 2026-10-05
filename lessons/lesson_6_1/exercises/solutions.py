"""Решения упражнений урока 6.1.

Запуск:  python lessons/lesson_6_1/exercises/solutions.py
"""

import numpy as np

sig = lambda F: 1 / (1 + np.exp(-F))  # noqa: E731

# 1
print("1) σ(F) = (1 + e^{−F})^{−1} ⇒ σ' = e^{−F}/(1 + e^{−F})² = σ·(1 − σ)")
for F in (-2.0, 0.0, 1.5):
    eps = 1e-6
    print(f"   F = {F:+.1f}: численно {(sig(F + eps) - sig(F - eps)) / (2 * eps):.6f}, σ(1−σ) = {sig(F) * (1 - sig(F)):.6f}")

# 2
q = 0.3
ps = np.linspace(0.001, 0.999, 9981)
expected = q * -np.log(ps) + (1 - q) * -np.log(1 - ps)
print(f"2) d/dp = −q/p + (1−q)/(1−p) = 0 ⇒ p = q. Численно: минимум при p = {ps[np.argmin(expected)]:.3f} (q = {q})")

# 3
print("3) Байес в шансах: P(1|A,B)/P(0|A,B) = [P(1)/P(0)]·LR_A·LR_B (при условной независимости A и B).")
print("   Логарифм: logit(posterior) = logit(prior) + log LR_A + log LR_B — вклады складываются.")
print("   Так же бустинг складывает вклады деревьев в логит: F = F0 + ν Σ h_m.")
