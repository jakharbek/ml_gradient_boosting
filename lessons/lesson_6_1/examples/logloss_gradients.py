"""Log-loss, его градиент и гессиан против MSE на вероятностях.

Запуск:  python lessons/lesson_6_1/examples/logloss_gradients.py [--save] [--no-show]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import get_loss
from gbcourse.cli import Example

ex = Example(__file__)

loss = get_loss("logistic")
F = np.linspace(-5, 5, 401)
y = np.ones_like(F)
p = 1 / (1 + np.exp(-F))
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
axes[0].plot(F, loss.pointwise(y, F), label="log-loss")
axes[0].plot(F, (1 - p) ** 2, label="MSE (1 − p)²")
axes[0].set(title="Потери для объекта класса 1", xlabel="логит F")
axes[1].plot(F, loss.gradient(y, F), label="градиент log-loss: p − 1")
axes[1].plot(F, -2 * (1 - p) * p * (1 - p), label="градиент MSE")
axes[1].plot(F, loss.hessian(y, F), label="гессиан log-loss: p(1 − p)")
axes[1].set(title="Производные по F", xlabel="логит F")
for ax in axes:
    ax.legend()
print(f"при F = −5 (уверенная ошибка): градиент log-loss {loss.gradient(np.array([1.0]), np.array([-5.0]))[0]:.3f}, "
      f"градиент MSE {-2 * (1 - p[0]) * p[0] * (1 - p[0]):.4f}")
fig.tight_layout()
ex.finish(fig, "logloss_gradients")
