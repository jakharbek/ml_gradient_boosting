"""Метрики качества (без зависимости от scikit-learn; зеркало ``engine/metrics.js``)."""

from __future__ import annotations

import numpy as np

from ._numeric import seq_mean, seq_sum


def mse(y, pred) -> float:
    """Среднеквадратичная ошибка."""
    d = np.asarray(y, float) - np.asarray(pred, float)
    return seq_mean(d * d)


def rmse(y, pred) -> float:
    """Корень из MSE — в единицах целевой переменной."""
    return float(np.sqrt(mse(y, pred)))


def mae(y, pred) -> float:
    """Средняя абсолютная ошибка."""
    return seq_mean(np.abs(np.asarray(y, float) - np.asarray(pred, float)))


def r2(y, pred) -> float:
    """Коэффициент детерминации R² = 1 − SSE / SST."""
    y = np.asarray(y, float)
    d = y - np.asarray(pred, float)
    c = y - seq_mean(y)
    sst = seq_sum(c * c)
    return 1.0 - seq_sum(d * d) / sst if sst > 0 else 0.0


def log_loss(y, proba, eps: float = 1e-15) -> float:
    """Бинарная кросс-энтропия; ``proba`` — вероятность класса 1."""
    y = np.asarray(y, float)
    p = np.clip(np.asarray(proba, float), eps, 1 - eps)
    return seq_mean(-(y * np.log(p) + (1 - y) * np.log(1 - p)))


def accuracy(y, pred) -> float:
    """Доля верных ответов."""
    return seq_mean(np.asarray(y) == np.asarray(pred))


def roc_auc(y, score) -> float:
    """ROC AUC через ранги (статистика Манна — Уитни, ничьи — средний ранг)."""
    y = np.asarray(y).astype(int)
    s = np.asarray(score, float)
    order = np.argsort(s, kind="stable")
    ranks = np.empty(s.size)
    sorted_s = s[order]
    i = 0
    while i < s.size:
        j = i
        while j + 1 < s.size and sorted_s[j + 1] == sorted_s[i]:
            j += 1
        ranks[order[i : j + 1]] = (i + j) / 2.0 + 1.0
        i = j + 1
    n_pos = int(np.sum(y == 1))
    n_neg = y.size - n_pos
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    return (seq_sum(ranks[y == 1]) - n_pos * (n_pos + 1) / 2.0) / (n_pos * n_neg)


def confusion(y, pred) -> np.ndarray:
    """Матрица ошибок 2×2: [[TN, FP], [FN, TP]]."""
    y = np.asarray(y).astype(int)
    p = np.asarray(pred).astype(int)
    return np.array([
        [int(np.sum((y == 0) & (p == 0))), int(np.sum((y == 0) & (p == 1)))],
        [int(np.sum((y == 1) & (p == 0))), int(np.sum((y == 1) & (p == 1)))],
    ])
