"""Функции потерь для градиентного бустинга.

Каждая функция потерь отвечает на пять вопросов, из которых собирается алгоритм:

1. ``init(y)``            — с какой константы F0 начать (оптимальная константа для потерь);
2. ``gradient(y, F)``     — производная потерь по предсказанию: g = ∂L/∂F;
3. ``hessian(y, F)``      — вторая производная: h = ∂²L/∂F² (для шага Ньютона / XGBoost);
4. ``leaf_value(y, F)``   — лучшая добавка в лист (линейный поиск Фридмана);
5. ``transform(F)``       — как превратить «сырую» оценку F в ответ (вероятность, среднее…).

Псевдо-остатки — это антиградиент: r = −g. Для квадратичных потерь
L = ½(y − F)² псевдо-остаток равен обычному остатку y − F.

Зеркало: ``shared/web/js/engine/losses.js``.
"""

from __future__ import annotations

import math

import numpy as np

from ._numeric import median, quantile, seq_mean, seq_sum, sigmoid, softmax

_EPS = 1e-12


class Loss:
    """Базовый класс. Работает с одномерными ``y`` и ``F`` формы (n,)."""

    name = "base"
    title = "Базовая"
    is_classification = False
    #: Имеет ли смысл шаг Ньютона (h > 0 почти всюду)
    newton_ok = True

    def init(self, y) -> float:  # pragma: no cover - абстрактный метод
        raise NotImplementedError

    def pointwise(self, y, F) -> np.ndarray:  # pragma: no cover
        raise NotImplementedError

    def loss(self, y, F) -> float:
        """Средние потери по выборке."""
        return seq_mean(self.pointwise(np.asarray(y, float), np.asarray(F, float)))

    def gradient(self, y, F) -> np.ndarray:  # pragma: no cover
        raise NotImplementedError

    def hessian(self, y, F) -> np.ndarray:
        return np.ones_like(np.asarray(F, dtype=float))

    def negative_gradient(self, y, F) -> np.ndarray:
        """Псевдо-остатки r = −∂L/∂F."""
        return -self.gradient(y, F)

    def leaf_value(self, y, F) -> float:
        """Оптимальная константа γ для листа: argmin_γ Σ L(y_i, F_i + γ)."""
        return seq_mean(self.negative_gradient(y, F))

    def transform(self, F):
        return np.asarray(F, dtype=float)

    def __repr__(self) -> str:
        return f"{type(self).__name__}()"


class SquaredError(Loss):
    """Квадратичные потери L = ½(y − F)². Оптимальная константа — среднее."""

    name = "squared"
    title = "Квадратичная (L2)"

    def init(self, y):
        return seq_mean(y)

    def pointwise(self, y, F):
        d = y - F
        return 0.5 * d * d

    def gradient(self, y, F):
        return np.asarray(F, float) - np.asarray(y, float)

    def leaf_value(self, y, F):
        return seq_mean(np.asarray(y, float) - np.asarray(F, float))


class AbsoluteError(Loss):
    """Абсолютные потери L = |y − F|. Оптимальная константа — медиана."""

    name = "absolute"
    title = "Абсолютная (L1)"
    newton_ok = False

    def init(self, y):
        return median(y)

    def pointwise(self, y, F):
        return np.abs(y - F)

    def gradient(self, y, F):
        return np.sign(np.asarray(F, float) - np.asarray(y, float))

    def hessian(self, y, F):
        return np.zeros_like(np.asarray(F, dtype=float))

    def leaf_value(self, y, F):
        return median(np.asarray(y, float) - np.asarray(F, float))


class Huber(Loss):
    """Потери Хьюбера: квадратичные для |r| ≤ δ, линейные дальше. Устойчивы к выбросам."""

    name = "huber"
    title = "Хьюбер"
    newton_ok = False

    def __init__(self, delta: float = 1.0) -> None:
        self.delta = float(delta)

    def init(self, y):
        return median(y)

    def pointwise(self, y, F):
        r = np.abs(y - F)
        d = self.delta
        return np.where(r <= d, 0.5 * r * r, d * (r - 0.5 * d))

    def gradient(self, y, F):
        r = np.asarray(y, float) - np.asarray(F, float)
        d = self.delta
        return np.where(np.abs(r) <= d, -r, -d * np.sign(r))

    def hessian(self, y, F):
        r = np.asarray(y, float) - np.asarray(F, float)
        return (np.abs(r) <= self.delta).astype(float)

    def leaf_value(self, y, F):
        # Шаг Фридмана (2001): медиана + средняя «обрезанная» поправка
        r = np.asarray(y, float) - np.asarray(F, float)
        r_med = median(r)
        diff = r - r_med
        return r_med + seq_mean(np.sign(diff) * np.minimum(self.delta, np.abs(diff)))

    def __repr__(self) -> str:
        return f"Huber(delta={self.delta})"


class Quantile(Loss):
    """Квантильные (pinball) потери: предсказываем α-квантиль условного распределения."""

    name = "quantile"
    title = "Квантильная"
    newton_ok = False

    def __init__(self, alpha: float = 0.5) -> None:
        if not 0.0 < alpha < 1.0:
            raise ValueError("alpha должна быть в (0, 1)")
        self.alpha = float(alpha)

    def init(self, y):
        return quantile(y, self.alpha)

    def pointwise(self, y, F):
        r = y - F
        a = self.alpha
        return np.where(r >= 0, a * r, (a - 1.0) * r)

    def gradient(self, y, F):
        y = np.asarray(y, float)
        F = np.asarray(F, float)
        return np.where(y >= F, -self.alpha, 1.0 - self.alpha)

    def hessian(self, y, F):
        return np.zeros_like(np.asarray(F, dtype=float))

    def leaf_value(self, y, F):
        return quantile(np.asarray(y, float) - np.asarray(F, float), self.alpha)

    def __repr__(self) -> str:
        return f"Quantile(alpha={self.alpha})"


class Logistic(Loss):
    """Логистические потери (log-loss) для классов {0, 1}; F — логарифм шансов."""

    name = "logistic"
    title = "Логистическая (log-loss)"
    is_classification = True

    def init(self, y):
        p = min(max(seq_mean(y), _EPS), 1.0 - _EPS)
        return math.log(p / (1.0 - p))

    def pointwise(self, y, F):
        # log(1 + e^F) − yF в устойчивой форме
        return np.maximum(F, 0.0) + np.log1p(np.exp(-np.abs(F))) - y * F

    def gradient(self, y, F):
        return sigmoid(F) - np.asarray(y, float)

    def hessian(self, y, F):
        p = sigmoid(F)
        return p * (1.0 - p)

    def leaf_value(self, y, F):
        # Один шаг Ньютона: Σ(y − p) / Σ p(1 − p)
        p = sigmoid(F)
        num = seq_sum(np.asarray(y, float) - p)
        den = seq_sum(p * (1.0 - p))
        return 0.0 if abs(den) < 1e-150 else num / den

    def transform(self, F):
        return sigmoid(F)


class Poisson(Loss):
    """Потери Пуассона для счётных данных; F = log μ."""

    name = "poisson"
    title = "Пуассоновская"

    def init(self, y):
        return math.log(max(seq_mean(y), _EPS))

    def pointwise(self, y, F):
        return np.exp(F) - y * F

    def gradient(self, y, F):
        return np.exp(np.asarray(F, float)) - np.asarray(y, float)

    def hessian(self, y, F):
        return np.exp(np.asarray(F, float))

    def leaf_value(self, y, F):
        # Точный минимум: log(Σy / Σμ)
        sy = seq_sum(y)
        smu = seq_sum(np.exp(np.asarray(F, float)))
        return math.log(max(sy, _EPS) / smu)

    def transform(self, F):
        return np.exp(np.asarray(F, float))


class Softmax:
    """Многоклассовые потери (кросс-энтропия с softmax). F имеет форму (n, K).

    Бустинг строит K деревьев на каждой итерации — по одному на класс.
    """

    name = "softmax"
    title = "Softmax (многоклассовая)"
    is_classification = True
    newton_ok = True

    def __init__(self, n_classes: int = 3) -> None:
        self.n_classes = int(n_classes)

    def one_hot(self, y):
        y = np.asarray(y, dtype=int)
        Y = np.zeros((y.size, self.n_classes))
        Y[np.arange(y.size), y] = 1.0
        return Y

    def init(self, y):
        y = np.asarray(y, dtype=int)
        p = np.array([seq_mean(y == k) for k in range(self.n_classes)])
        p = np.clip(p, _EPS, 1.0 - _EPS)
        logp = np.log(p)
        return logp - seq_mean(logp)

    def pointwise(self, y, F):
        F = np.asarray(F, float)
        m = F.max(axis=1)
        lse = m + np.log(np.exp(F - m[:, None]).sum(axis=1))
        return lse - F[np.arange(F.shape[0]), np.asarray(y, dtype=int)]

    def loss(self, y, F):
        return seq_mean(self.pointwise(y, F))

    def gradient(self, y, F):
        return softmax(F) - self.one_hot(y)

    def hessian(self, y, F):
        P = softmax(F)
        return P * (1.0 - P)

    def negative_gradient(self, y, F):
        return -self.gradient(y, F)

    def leaf_value_k(self, residual_k) -> float:
        """Шаг Фридмана для класса k: (K−1)/K · Σr / Σ|r|(1−|r|), r = y_k − p_k."""
        r = np.asarray(residual_k, float)
        num = seq_sum(r)
        den = seq_sum(np.abs(r) * (1.0 - np.abs(r)))
        K = self.n_classes
        return 0.0 if abs(den) < 1e-150 else (K - 1) / K * num / den

    def transform(self, F):
        return softmax(F)

    def __repr__(self) -> str:
        return f"Softmax(n_classes={self.n_classes})"


_ALIASES = {
    "squared": "squared", "squared_error": "squared", "mse": "squared", "l2": "squared",
    "absolute": "absolute", "absolute_error": "absolute", "mae": "absolute", "l1": "absolute",
    "huber": "huber",
    "quantile": "quantile", "pinball": "quantile",
    "logistic": "logistic", "log_loss": "logistic", "binary": "logistic", "logloss": "logistic",
    "softmax": "softmax", "multiclass": "softmax", "multinomial": "softmax",
    "poisson": "poisson",
}


def get_loss(name: str | Loss | Softmax, **params):
    """Создать функцию потерь по имени.

    >>> get_loss("huber", delta=0.5)
    Huber(delta=0.5)
    """
    if isinstance(name, (Loss, Softmax)):
        return name
    key = _ALIASES.get(str(name).lower())
    if key is None:
        raise ValueError(f"Неизвестная функция потерь {name!r}")
    if key == "squared":
        return SquaredError()
    if key == "absolute":
        return AbsoluteError()
    if key == "huber":
        return Huber(delta=params.get("delta", params.get("huber_delta", 1.0)))
    if key == "quantile":
        return Quantile(alpha=params.get("alpha", params.get("quantile_alpha", 0.5)))
    if key == "logistic":
        return Logistic()
    if key == "poisson":
        return Poisson()
    return Softmax(n_classes=params.get("n_classes", 3))
