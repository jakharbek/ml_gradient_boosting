"""Градиентный бустинг над деревьями — прозрачная учебная реализация.

Алгоритм (Фридман, 2001) в одном абзаце:

    F₀(x) = argmin_c Σ L(yᵢ, c)                          — лучшая константа
    для m = 1 … M:
        rᵢ = −∂L(yᵢ, F)/∂F  при F = F_{m−1}(xᵢ)          — псевдо-остатки
        hₘ = дерево, обученное предсказывать rᵢ по xᵢ     — «шаг» в пространстве функций
        γⱼ = argmin_γ Σ_{xᵢ ∈ лист j} L(yᵢ, F_{m−1}(xᵢ) + γ) — значения листьев
        Fₘ(x) = F_{m−1}(x) + ν · hₘ(x)                    — маленький шаг с темпом ν

Режимы:
* ``mode="friedman"`` — классика: дерево на псевдо-остатках + линейный поиск в листьях;
* ``mode="newton"``   — как XGBoost: дерево по (g, h) с λ, α, γ; вес листа −G/(H+λ).

Зеркало: ``shared/web/js/engine/boosting.js``.
"""

from __future__ import annotations

import math

import numpy as np

from .losses import Softmax, get_loss
from .rng import Mulberry32
from .tree import RegressionTree, make_bins


class GradientBoosting:
    """Градиентный бустинг (регрессия и классификация).

    Параметры
    ---------
    loss : str
        ``squared``, ``absolute``, ``huber``, ``quantile``, ``poisson`` — регрессия;
        ``logistic`` — бинарная классификация (y ∈ {0, 1}); ``softmax`` — многоклассовая.
    n_estimators : int
        Число итераций M (для softmax на каждой итерации строится K деревьев).
    learning_rate : float
        Темп обучения ν (shrinkage).
    max_depth, min_samples_leaf, max_leaves, growth, max_bins :
        Параметры деревьев (см. :class:`~gbcourse.tree.RegressionTree`).
    min_child_weight, reg_lambda, reg_alpha, gamma :
        Регуляризация второго порядка (действует в ``mode="newton"``; γ и
        min_child_weight учитываются и в режиме Фридмана).
    subsample : float
        Доля объектов для каждого дерева (стохастический бустинг, без возвращения).
    colsample : float
        Доля признаков для каждого дерева (``colsample_bytree``).
    colsample_bynode : float или None
        Доля признаков в каждом узле.
    mode : {"friedman", "newton"}
        Способ строить деревья и считать листья.
    huber_delta, quantile_alpha : float
        Параметры потерь Хьюбера и квантильной.
    early_stopping_rounds : int или None
        Остановка, если потери на ``eval_set`` не улучшались столько итераций;
        модель обрезается до лучшей итерации.
    seed : int
        Зерно генератора Mulberry32 (подвыборки строк и признаков).
    """

    def __init__(
        self,
        loss: str = "squared",
        n_estimators: int = 100,
        learning_rate: float = 0.1,
        max_depth: int | None = 3,
        min_samples_leaf: int = 1,
        min_child_weight: float = 0.0,
        reg_lambda: float = 0.0,
        reg_alpha: float = 0.0,
        gamma: float = 0.0,
        subsample: float = 1.0,
        colsample: float = 1.0,
        colsample_bynode: float | None = None,
        max_leaves: int | None = None,
        growth: str = "depthwise",
        max_bins: int | None = None,
        mode: str = "friedman",
        huber_delta: float = 1.0,
        quantile_alpha: float = 0.5,
        n_classes: int | None = None,
        early_stopping_rounds: int | None = None,
        seed: int = 0,
    ) -> None:
        if mode not in ("friedman", "newton"):
            raise ValueError("mode должен быть 'friedman' или 'newton'")
        self.loss = loss
        self.n_estimators = int(n_estimators)
        self.learning_rate = float(learning_rate)
        self.max_depth = max_depth
        self.min_samples_leaf = int(min_samples_leaf)
        self.min_child_weight = float(min_child_weight)
        self.reg_lambda = float(reg_lambda)
        self.reg_alpha = float(reg_alpha)
        self.gamma = float(gamma)
        self.subsample = float(subsample)
        self.colsample = float(colsample)
        self.colsample_bynode = colsample_bynode
        self.max_leaves = max_leaves
        self.growth = growth
        self.max_bins = max_bins
        self.mode = mode
        self.huber_delta = float(huber_delta)
        self.quantile_alpha = float(quantile_alpha)
        self.n_classes = n_classes
        self.early_stopping_rounds = early_stopping_rounds
        self.seed = int(seed)

    # ------------------------------------------------------------------ обучение
    def _make_loss(self, y):
        if str(self.loss).lower() in ("softmax", "multiclass", "multinomial"):
            k = self.n_classes or int(np.max(y)) + 1
            return get_loss("softmax", n_classes=k)
        return get_loss(self.loss, delta=self.huber_delta, alpha=self.quantile_alpha)

    def _new_tree(self, newton: bool) -> RegressionTree:
        return RegressionTree(
            max_depth=self.max_depth,
            min_samples_leaf=self.min_samples_leaf,
            min_child_weight=self.min_child_weight,
            reg_lambda=self.reg_lambda if newton else 0.0,
            reg_alpha=self.reg_alpha if newton else 0.0,
            gamma=self.gamma,
            max_leaves=self.max_leaves,
            growth=self.growth,
            max_features=self.colsample_bynode,
            max_bins=self.max_bins,
        )

    def fit(self, X, y, eval_set: tuple | None = None, callback=None):
        """Обучить модель.

        eval_set : (X_val, y_val) — для кривых обучения и ранней остановки.
        callback : функция ``callback(m, trees, model)``; вернула True — остановка.
        """
        X = np.asarray(X, dtype=float)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        y = np.asarray(y)
        loss = self._make_loss(y)
        self.loss_ = loss
        self.multiclass_ = isinstance(loss, Softmax)
        K = loss.n_classes if self.multiclass_ else 1
        y_fit = y.astype(int) if loss.is_classification else y.astype(float)
        n, d = X.shape
        self.n_features_ = d
        rng = Mulberry32(self.seed)
        newton = self.mode == "newton" and loss.newton_ok
        self.newton_ = newton

        self.init_ = loss.init(y_fit)
        F = np.tile(np.asarray(self.init_, dtype=float), (n, 1)) if K > 1 else np.full(n, float(self.init_))
        has_eval = eval_set is not None
        if has_eval:
            Xe = np.asarray(eval_set[0], dtype=float)
            if Xe.ndim == 1:
                Xe = Xe.reshape(-1, 1)
            ye = np.asarray(eval_set[1])
            ye = ye.astype(int) if loss.is_classification else ye.astype(float)
            Fe = (np.tile(np.asarray(self.init_, dtype=float), (Xe.shape[0], 1)) if K > 1
                  else np.full(Xe.shape[0], float(self.init_)))
        self.bins_ = make_bins(X, self.max_bins) if self.max_bins else None
        self.trees_: list[list[RegressionTree]] = []
        self.history_ = {"train": [loss.loss(y_fit, F)], "eval": [loss.loss(ye, Fe)] if has_eval else []}
        best_loss, best_iter = (self.history_["eval"][0] if has_eval else math.inf), 0

        for m in range(self.n_estimators):
            # 1) подвыборка объектов (стохастический бустинг)
            if self.subsample < 1.0:
                k_rows = max(1, int(math.floor(self.subsample * n)))
                rows = np.array(sorted(rng.sample(n, k_rows)), dtype=np.int64)
            else:
                rows = np.arange(n)
            # 2) градиенты считаются в текущей точке F_{m-1} — одинаково для всех классов
            G = loss.gradient(y_fit, F)
            Hs = loss.hessian(y_fit, F)
            stage = []
            for k in range(K):
                g = G[:, k] if K > 1 else G
                h = Hs[:, k] if K > 1 else Hs
                features = None
                if self.colsample < 1.0:
                    k_feat = max(1, int(math.floor(self.colsample * d)))
                    if k_feat < d:
                        features = sorted(rng.sample(d, k_feat))
                tree = self._new_tree(newton)
                tree.fit(X, g, h if newton else None, rows=rows, rng=rng, bins=self.bins_,
                         features=features)
                if not newton:
                    self._line_search(tree, loss, y_fit, F, k)
                stage.append(tree)
            # 3) шаг: F_m = F_{m-1} + ν · h_m
            for k, tree in enumerate(stage):
                upd = self.learning_rate * tree.predict(X)
                if K > 1:
                    F[:, k] += upd
                else:
                    F += upd
                if has_eval:
                    upd_e = self.learning_rate * tree.predict(Xe)
                    if K > 1:
                        Fe[:, k] += upd_e
                    else:
                        Fe += upd_e
            self.trees_.append(stage)
            self.history_["train"].append(loss.loss(y_fit, F))
            if has_eval:
                cur = loss.loss(ye, Fe)
                self.history_["eval"].append(cur)
                if cur < best_loss:
                    best_loss, best_iter = cur, m + 1
                elif self.early_stopping_rounds and (m + 1 - best_iter) >= self.early_stopping_rounds:
                    break
            if callback is not None and callback(m + 1, stage, self):
                break

        self.best_iteration_ = best_iter if has_eval else len(self.trees_)
        self.stopped_early_ = bool(
            has_eval and self.early_stopping_rounds and len(self.trees_) < self.n_estimators
        )
        if self.stopped_early_:
            self.trees_ = self.trees_[: self.best_iteration_]
        return self

    def _line_search(self, tree: RegressionTree, loss, y, F, k: int) -> None:
        """Режим Фридмана: заменить значения листьев оптимальными γ для данной функции потерь."""
        if loss.name == "squared":
            return  # среднее остатков уже оптимально
        for nd in tree.leaves:
            r = nd.rows
            if self.multiclass_:
                resid = (y[r] == k).astype(float) - loss.transform(F[r])[:, k]
                nd.value = loss.leaf_value_k(resid)
            else:
                nd.value = float(loss.leaf_value(y[r], F[r]))
        tree.refresh_values()

    # ---------------------------------------------------------------- применение
    @property
    def n_trees_(self) -> int:
        return len(self.trees_)

    def predict_raw(self, X, n_iter: int | None = None) -> np.ndarray:
        """Сырая оценка F(x) по первым ``n_iter`` итерациям (по умолчанию — всем)."""
        X = np.asarray(X, dtype=float)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        stages = self.trees_ if n_iter is None else self.trees_[:n_iter]
        if self.multiclass_:
            F = np.tile(np.asarray(self.init_, dtype=float), (X.shape[0], 1))
            for stage in stages:
                for k, tree in enumerate(stage):
                    F[:, k] += self.learning_rate * tree.predict(X)
            return F
        F = np.full(X.shape[0], float(self.init_))
        for stage in stages:
            F += self.learning_rate * stage[0].predict(X)
        return F

    def staged_predict_raw(self, X):
        """Генератор: F после 1, 2, …, M итераций (удобно для анимаций и кривых)."""
        X = np.asarray(X, dtype=float)
        if X.ndim == 1:
            X = X.reshape(-1, 1)
        if self.multiclass_:
            F = np.tile(np.asarray(self.init_, dtype=float), (X.shape[0], 1))
        else:
            F = np.full(X.shape[0], float(self.init_))
        for stage in self.trees_:
            for k, tree in enumerate(stage):
                if self.multiclass_:
                    F[:, k] += self.learning_rate * tree.predict(X)
                else:
                    F += self.learning_rate * tree.predict(X)
            yield F.copy()

    def predict(self, X, n_iter: int | None = None) -> np.ndarray:
        """Регрессия — прогноз; классификация — метка класса."""
        F = self.predict_raw(X, n_iter)
        if self.loss_.is_classification:
            if self.multiclass_:
                return np.argmax(F, axis=1)
            return (F > 0).astype(int)
        return self.loss_.transform(F)

    def predict_proba(self, X, n_iter: int | None = None) -> np.ndarray:
        """Вероятности классов, форма (n, K)."""
        if not self.loss_.is_classification:
            raise AttributeError("predict_proba доступен только для классификации")
        F = self.predict_raw(X, n_iter)
        if self.multiclass_:
            return self.loss_.transform(F)
        p = self.loss_.transform(F)
        return np.column_stack([1.0 - p, p])

    @property
    def feature_importances_(self) -> np.ndarray:
        """Важность признаков по суммарному выигрышу разбиений (нормирована к 1)."""
        total = np.zeros(self.n_features_)
        for stage in self.trees_:
            for tree in stage:
                total += tree.feature_gains()
        s = total.sum()
        return total / s if s > 0 else total

    def __repr__(self) -> str:
        return (
            f"GradientBoosting(loss={self.loss!r}, n_estimators={self.n_estimators}, "
            f"learning_rate={self.learning_rate}, max_depth={self.max_depth}, mode={self.mode!r})"
        )


class GBRegressor(GradientBoosting):
    """Градиентный бустинг для регрессии (по умолчанию квадратичные потери)."""

    def __init__(self, loss: str = "squared", **params) -> None:
        super().__init__(loss=loss, **params)


class GBClassifier(GradientBoosting):
    """Градиентный бустинг для классификации: 2 класса — logistic, больше — softmax.

    Метки классов могут быть любыми: они кодируются в 0..K−1 (``classes_``).
    """

    def __init__(self, **params) -> None:
        params.pop("loss", None)
        super().__init__(loss="logistic", **params)

    def fit(self, X, y, eval_set=None, callback=None):
        y = np.asarray(y)
        self.classes_, y_enc = np.unique(y, return_inverse=True)
        self.loss = "logistic" if self.classes_.size <= 2 else "softmax"
        self.n_classes = int(self.classes_.size)
        if eval_set is not None:
            ye = np.searchsorted(self.classes_, np.asarray(eval_set[1]))
            eval_set = (eval_set[0], ye)
        return super().fit(X, y_enc, eval_set=eval_set, callback=callback)

    def predict(self, X, n_iter: int | None = None) -> np.ndarray:
        return self.classes_[super().predict(X, n_iter)]
