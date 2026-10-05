"""Ансамбли для сравнения с бустингом: бэггинг / случайный лес и AdaBoost.

* :class:`BaggingTrees` — B деревьев на бутстрэп-выборках, ответ — среднее.
  С ``max_features < 1`` это случайный лес. Уменьшает **разброс**.
* :class:`AdaBoost` — дискретный AdaBoost на пнях: каждое следующее дерево
  смотрит на объекты с весами, увеличенными там, где ансамбль ошибался.
  Уменьшает **смещение**. Это мост к градиентному бустингу (урок 3.3).

Зеркало: ``shared/web/js/engine/ensembles.js``.
"""

from __future__ import annotations

import math

import numpy as np

from ._numeric import seq_sum
from .rng import Mulberry32
from .tree import RegressionTree


class BaggingTrees:
    """Бэггинг регрессионных деревьев (для y ∈ {0, 1} — оценка вероятности класса 1)."""

    def __init__(
        self,
        n_estimators: int = 50,
        max_depth: int | None = None,
        min_samples_leaf: int = 1,
        max_features: float | None = None,
        bootstrap: bool = True,
        seed: int = 0,
    ) -> None:
        self.n_estimators = int(n_estimators)
        self.max_depth = max_depth
        self.min_samples_leaf = int(min_samples_leaf)
        self.max_features = max_features
        self.bootstrap = bootstrap
        self.seed = int(seed)

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        y = np.asarray(y, dtype=float)
        n = X.shape[0]
        rng = Mulberry32(self.seed)
        self.trees_: list[RegressionTree] = []
        self.inbag_counts_ = []
        for _ in range(self.n_estimators):
            if self.bootstrap:
                counts = np.bincount(rng.bootstrap(n), minlength=n).astype(float)
            else:
                counts = np.ones(n)
            rows = np.flatnonzero(counts > 0)
            # Кратность попадания в бутстрэп = вес объекта: g = −c·y, h = c → лист = взвешенное среднее
            tree = RegressionTree(
                max_depth=self.max_depth,
                min_samples_leaf=self.min_samples_leaf,
                max_features=self.max_features,
            ).fit(X, -counts * y, counts, rows=rows, rng=rng)
            self.trees_.append(tree)
            self.inbag_counts_.append(counts)
        return self

    def predict(self, X, n_trees: int | None = None) -> np.ndarray:
        trees = self.trees_ if n_trees is None else self.trees_[:n_trees]
        X = np.asarray(X, dtype=float)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        acc = np.zeros(X.shape[0])
        for t in trees:
            acc += t.predict(X)
        return acc / max(1, len(trees))

    def oob_predict(self, X) -> np.ndarray:
        """Out-of-bag прогноз: для каждого объекта — среднее деревьев, не видевших его."""
        X = np.asarray(X, dtype=float)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        acc = np.zeros(X.shape[0])
        cnt = np.zeros(X.shape[0])
        for t, c in zip(self.trees_, self.inbag_counts_):
            oob = c == 0
            if oob.any():
                acc[oob] += t.predict(X[oob])
                cnt[oob] += 1
        with np.errstate(invalid="ignore"):
            return np.where(cnt > 0, acc / np.maximum(cnt, 1), np.nan)


class AdaBoost:
    """Дискретный AdaBoost (Freund & Schapire) для классов {0, 1}.

    Внутри метки переводятся в {−1, +1}. На шаге m:
      εₘ = Σ wᵢ [hₘ(xᵢ) ≠ yᵢ] / Σ wᵢ,   αₘ = ν · ½ ln((1 − εₘ) / εₘ),
      wᵢ ← wᵢ · exp(−αₘ yᵢ hₘ(xᵢ)), затем нормировка.
    Слабый ученик — дерево глубины ``max_depth`` (по умолчанию пень),
    обученное по взвешенному критерию (g = −w·y, h = w).
    """

    def __init__(self, n_estimators: int = 50, max_depth: int = 1, learning_rate: float = 1.0) -> None:
        self.n_estimators = int(n_estimators)
        self.max_depth = int(max_depth)
        self.learning_rate = float(learning_rate)

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        ys = np.where(np.asarray(y) > 0, 1.0, -1.0)
        n = X.shape[0]
        w = np.full(n, 1.0 / n)
        self.trees_: list[RegressionTree] = []
        self.alphas_: list[float] = []
        self.errors_: list[float] = []
        self.weights_: list[np.ndarray] = [w.copy()]
        for _ in range(self.n_estimators):
            tree = RegressionTree(max_depth=self.max_depth).fit(X, -w * ys, w)
            pred = np.where(tree.predict(X) >= 0, 1.0, -1.0)
            miss = pred != ys
            err = seq_sum(w[miss]) / seq_sum(w)
            if err >= 0.5:
                break  # слабый ученик не лучше монетки — дальше смысла нет
            err_c = max(err, 1e-10)
            alpha = self.learning_rate * 0.5 * math.log((1.0 - err_c) / err_c)
            w = w * np.exp(-alpha * ys * pred)
            w = w / seq_sum(w)
            self.trees_.append(tree)
            self.alphas_.append(alpha)
            self.errors_.append(err)
            self.weights_.append(w.copy())
            if err == 0.0:
                break
        return self

    def decision_function(self, X, n_trees: int | None = None) -> np.ndarray:
        X = np.asarray(X, dtype=float)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        k = len(self.trees_) if n_trees is None else min(n_trees, len(self.trees_))
        acc = np.zeros(X.shape[0])
        for t, a in zip(self.trees_[:k], self.alphas_[:k]):
            acc += a * np.where(t.predict(X) >= 0, 1.0, -1.0)
        return acc

    def predict(self, X, n_trees: int | None = None) -> np.ndarray:
        return (self.decision_function(X, n_trees) > 0).astype(int)
