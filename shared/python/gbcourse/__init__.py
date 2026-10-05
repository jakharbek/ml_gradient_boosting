"""gbcourse — учебная библиотека курса «Градиентный бустинг по косточкам».

Прозрачные реализации всего, из чего состоит градиентный бустинг:

    rng        — генератор Mulberry32 (совпадает с веб-движком курса)
    datasets   — учебные наборы данных (те же, что в интерактивных уроках)
    losses     — функции потерь: градиенты, гессианы, оптимальные значения листьев
    tree       — дерево CART по (g, h): точный/гистограммный поиск, рост по уровням/листьям
    boosting   — градиентный бустинг (Фридман и Ньютон/XGBoost), история обучения
    ensembles  — бэггинг/случайный лес и AdaBoost — для сравнения
    explain    — значения Шепли по определению, PDP/ICE, перестановочная важность
    metrics    — метрики качества
    plotting   — графики курса (matplotlib); style — палитра и стиль

Быстрый старт::

    from gbcourse import datasets, GBRegressor
    X, y = datasets.regression_1d("sine", n=80, noise=0.3, seed=42)
    model = GBRegressor(n_estimators=100, learning_rate=0.1, max_depth=2).fit(X, y)
"""

from . import datasets, ensembles, explain, losses, metrics, rng, tree
from .boosting import GBClassifier, GBRegressor, GradientBoosting
from .ensembles import AdaBoost, BaggingTrees
from .losses import get_loss
from .rng import Mulberry32
from .tree import RegressionTree

__version__ = "1.0.0"

__all__ = [
    "AdaBoost",
    "BaggingTrees",
    "GBClassifier",
    "GBRegressor",
    "GradientBoosting",
    "Mulberry32",
    "RegressionTree",
    "datasets",
    "ensembles",
    "explain",
    "get_loss",
    "losses",
    "metrics",
    "rng",
    "tree",
]
