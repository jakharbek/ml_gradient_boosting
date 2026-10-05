"""Генераторы учебных наборов данных.

Каждый генератор — зеркало функции из ``shared/web/js/engine/datasets.js``:
при одинаковых параметрах и ``seed`` получаются одинаковые данные (до округления
тригонометрии в последнем знаке). Поэтому любой пример из веб-урока можно
повторить в Jupyter одной строкой.

Основные функции
----------------
regression_1d         — одномерная регрессия: синус, ступеньки, тренд, выбросы…
classification_2d     — двумерная классификация: луны, круги, XOR, спирали, облака.
friedman1             — многомерная регрессия Фридмана (для важности признаков, SHAP).
categorical_regression — категориальный признак высокой кардинальности (target encoding).
toy_regression / toy_classification — крошечные наборы для расчётов «на бумаге».

Контракт совместимости с JS: порядок вызовов генератора случайных чисел
фиксирован и описан в каждой функции. Меняя код, меняйте обе реализации.
"""

from __future__ import annotations

import csv
import math
from collections.abc import Callable, Sequence
from pathlib import Path

import numpy as np

from .rng import Mulberry32

# ---------------------------------------------------------------------------------
# Истинные функции для регрессии
# ---------------------------------------------------------------------------------


def _f_sine(x: float) -> float:
    return math.sin(x)


def _f_wave(x: float) -> float:
    return math.sin(x) + 0.3 * x


def _f_step(x: float) -> float:
    if x < 3.0:
        return 1.0
    if x < 6.5:
        return 3.0
    return 2.0


def _f_linear(x: float) -> float:
    return 0.5 * x + 1.0


def _f_quadratic(x: float) -> float:
    return 0.15 * (x - 5.0) * (x - 5.0) - 1.0


TRUE_FUNCTIONS: dict[str, Callable[[float], float]] = {
    "sine": _f_sine,
    "wave": _f_wave,
    "step": _f_step,
    "linear": _f_linear,
    "quadratic": _f_quadratic,
    "hetero": _f_wave,  # та же волна, но шум растёт с x
}

REGRESSION_KINDS = tuple(TRUE_FUNCTIONS)
CLASSIFICATION_KINDS = ("moons", "circles", "blobs", "blobs3", "xor", "spiral", "linear")


def true_function(kind: str, x: np.ndarray | float) -> np.ndarray | float:
    """Значение истинной (бесшумной) функции для набора ``regression_1d(kind=...)``."""
    f = TRUE_FUNCTIONS[kind]
    if np.isscalar(x):
        return f(float(x))
    return np.array([f(float(v)) for v in np.asarray(x, dtype=float).ravel()]).reshape(np.shape(x))


def _noise_scale(kind: str, x: float) -> float:
    return 0.25 + 0.15 * x if kind == "hetero" else 1.0


# ---------------------------------------------------------------------------------
# Регрессия
# ---------------------------------------------------------------------------------


def regression_1d(
    kind: str = "sine",
    n: int = 80,
    noise: float = 0.3,
    seed: int = 42,
    x_min: float = 0.0,
    x_max: float = 10.0,
    outliers: float = 0.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Одномерная регрессия ``y = f(x) + шум``.

    Параметры
    ---------
    kind : {"sine", "wave", "step", "linear", "quadratic", "hetero"}
        Форма истинной функции (см. :data:`TRUE_FUNCTIONS`).
    n : int
        Число объектов.
    noise : float
        Стандартное отклонение гауссова шума.
    seed : int
        Зерно генератора Mulberry32.
    x_min, x_max : float
        Диапазон признака.
    outliers : float
        Доля выбросов: к таким точкам добавляется ±(4…7).

    Возвращает
    ----------
    X : ndarray формы (n, 1) — признак, отсортированный по возрастанию.
    y : ndarray формы (n,) — целевая переменная.

    Порядок вызовов ГПСЧ: n × uniform (x) → сортировка → n × normal (шум)
    → для каждой точки random() и, если это выброс, ещё два random().
    """
    if kind not in TRUE_FUNCTIONS:
        raise ValueError(f"Неизвестный kind={kind!r}; доступно: {', '.join(REGRESSION_KINDS)}")
    rng = Mulberry32(seed)
    xs = sorted(rng.uniform(x_min, x_max) for _ in range(n))
    f = TRUE_FUNCTIONS[kind]
    ys = [f(x) + noise * _noise_scale(kind, x) * rng.normal() for x in xs]
    if outliers > 0:
        for i in range(n):
            if rng.random() < outliers:
                magnitude = 4.0 + 3.0 * rng.random()
                sign = 1.0 if rng.random() < 0.5 else -1.0
                ys[i] += sign * magnitude
    return np.array(xs, dtype=float).reshape(-1, 1), np.array(ys, dtype=float)


def toy_regression() -> tuple[np.ndarray, np.ndarray]:
    """Шесть точек для ручного расчёта бустинга (урок 4.1).

    x — площадь квартиры в десятках м², y — цена в млн ₽.
    Числа подобраны так, чтобы F0 = 6, а первое дерево дало листья −3 и +3.
    """
    X = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]).reshape(-1, 1)
    y = np.array([2.0, 4.0, 3.0, 7.0, 9.0, 11.0])
    return X, y


# ---------------------------------------------------------------------------------
# Классификация
# ---------------------------------------------------------------------------------


def classification_2d(
    kind: str = "moons",
    n: int = 200,
    noise: float = 0.2,
    seed: int = 42,
    balance: float | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Двумерная классификация.

    kind:
      * ``moons``   — два полумесяца;
      * ``circles`` — кольцо вокруг круга;
      * ``blobs``   — два гауссовых облака;
      * ``blobs3``  — три облака (многоклассовая задача);
      * ``xor``     — «шахматка» из четырёх квадрантов;
      * ``spiral``  — две переплетённые спирали (сложная граница);
      * ``linear``  — почти линейно разделимые классы.

    ``balance`` — доля класса 1 (для несбалансированных задач). Если ``None``,
    классы чередуются: ``i % n_classes``.

    Порядок вызовов ГПСЧ для каждой точки: [random() для класса, если balance]
    → параметры формы (random/uniform) → normal() для x0 → normal() для x1.
    """
    if kind not in CLASSIFICATION_KINDS:
        raise ValueError(f"Неизвестный kind={kind!r}; доступно: {', '.join(CLASSIFICATION_KINDS)}")
    rng = Mulberry32(seed)
    n_classes = 3 if kind == "blobs3" else 2
    X = np.empty((n, 2), dtype=float)
    y = np.empty(n, dtype=int)
    for i in range(n):
        if balance is not None and kind not in ("xor", "linear"):
            c = 1 if rng.random() < balance else 0
        else:
            c = i % n_classes
        if kind == "moons":
            t = math.pi * rng.random()
            if c == 0:
                a, b = math.cos(t), math.sin(t)
            else:
                a, b = 1.0 - math.cos(t), 0.5 - math.sin(t)
        elif kind == "circles":
            ang = 2.0 * math.pi * rng.random()
            r = 1.0 if c == 0 else 0.5
            a, b = r * math.cos(ang), r * math.sin(ang)
        elif kind == "blobs":
            a, b = (-1.0, -0.5) if c == 0 else (1.0, 0.5)
        elif kind == "blobs3":
            theta = math.pi / 2.0 + 2.0 * math.pi * c / 3.0
            a, b = 1.2 * math.cos(theta), 1.2 * math.sin(theta)
        elif kind == "xor":
            a, b = rng.uniform(-1.0, 1.0), rng.uniform(-1.0, 1.0)
            c = 1 if a * b > 0 else 0
        elif kind == "spiral":
            t = rng.random()
            r = 0.15 + 0.85 * t
            ang = 3.0 * math.pi * t + math.pi * c
            a, b = r * math.cos(ang), r * math.sin(ang)
        else:  # linear
            a, b = rng.uniform(-1.0, 1.0), rng.uniform(-1.0, 1.0)
            c = 1 if b - 0.5 * a > 0 else 0
        X[i, 0] = a + noise * rng.normal()
        X[i, 1] = b + noise * rng.normal()
        y[i] = c
    return X, y


def toy_classification() -> tuple[np.ndarray, np.ndarray]:
    """Восемь точек для ручного расчёта бустинга в классификации (урок 6.2).

    Доля класса 1 ровно 0.5, поэтому F0 = log(0.5/0.5) = 0 и p0 = 0.5 для всех.
    """
    X = np.arange(1.0, 9.0).reshape(-1, 1)
    y = np.array([0, 0, 0, 1, 0, 1, 1, 1])
    return X, y


# ---------------------------------------------------------------------------------
# Многомерные наборы
# ---------------------------------------------------------------------------------


def friedman1(n: int = 500, noise: float = 1.0, seed: int = 42, n_features: int = 10):
    """Задача Фридмана №1: ``y = 10 sin(π x0 x1) + 20 (x2 − 0.5)² + 10 x3 + 5 x4 + ε``.

    Признаки x5…x9 — чистый шум: удобная проверка методов важности признаков.
    Порядок вызовов ГПСЧ для каждой строки: n_features × random() → normal().
    """
    if n_features < 5:
        raise ValueError("friedman1 требует n_features >= 5")
    rng = Mulberry32(seed)
    X = np.empty((n, n_features), dtype=float)
    y = np.empty(n, dtype=float)
    for i in range(n):
        for j in range(n_features):
            X[i, j] = rng.random()
        eps = rng.normal()
        x0, x1, x2, x3, x4 = X[i, :5]
        y[i] = (
            10.0 * math.sin(math.pi * x0 * x1)
            + 20.0 * (x2 - 0.5) * (x2 - 0.5)
            + 10.0 * x3
            + 5.0 * x4
            + noise * eps
        )
    return X, y


def categorical_regression(
    n: int = 400,
    n_categories: int = 30,
    noise: float = 1.0,
    seed: int = 42,
    informative: bool = True,
):
    """Регрессия с категориальным признаком высокой кардинальности.

    ``y = effect[категория] + sin(x) + шум``. Частоты категорий убывают
    (категория k выпадает с вероятностью ~ 1/sqrt(k)), поэтому редких
    категорий много — именно на них «наивный» target encoding переобучается.
    Если ``informative=False``, эффект категорий нулевой: признак — чистый шум.

    Возвращает (x, cat, y): числовой признак, код категории 0..K-1, цель.
    Порядок вызовов ГПСЧ: K × normal (эффекты) → для каждой строки:
    random() (категория) → uniform(0, 10) (x) → normal() (шум).
    """
    rng = Mulberry32(seed)
    effects = [rng.normal(0.0, 1.5) for _ in range(n_categories)]
    if not informative:
        effects = [0.0] * n_categories
    x = np.empty(n, dtype=float)
    cat = np.empty(n, dtype=int)
    y = np.empty(n, dtype=float)
    for i in range(n):
        u = rng.random()
        k = min(n_categories - 1, int(n_categories * u * u))
        xi = rng.uniform(0.0, 10.0)
        cat[i] = k
        x[i] = xi
        y[i] = effects[k] + math.sin(xi) + noise * rng.normal()
    return x, cat, y


def inject_missing(X: np.ndarray, frac: float = 0.1, seed: int = 7) -> np.ndarray:
    """Копия ``X``, где доля ``frac`` значений заменена на NaN (обход по строкам)."""
    rng = Mulberry32(seed)
    Xm = np.array(X, dtype=float, copy=True)
    for i in range(Xm.shape[0]):
        for j in range(Xm.shape[1]):
            if rng.random() < frac:
                Xm[i, j] = np.nan
    return Xm


def train_test_split(X, y, test_size: float = 0.25, seed: int = 0):
    """Детерминированное разбиение на обучение и тест (совпадает с JS-версией).

    Перемешивание — :meth:`Mulberry32.permutation`; первые ``n_test`` индексов — тест.
    """
    X = np.asarray(X)
    y = np.asarray(y)
    n = len(y)
    n_test = int(math.floor(n * test_size + 0.5))
    perm = Mulberry32(seed).permutation(n)
    test_idx = np.array(sorted(perm[:n_test]), dtype=int)
    train_idx = np.array(sorted(perm[n_test:]), dtype=int)
    return X[train_idx], X[test_idx], y[train_idx], y[test_idx]


# ---------------------------------------------------------------------------------
# Единая точка входа и сохранение
# ---------------------------------------------------------------------------------

_GENERATORS: dict[str, Callable] = {
    "regression_1d": regression_1d,
    "classification_2d": classification_2d,
    "friedman1": friedman1,
    "categorical_regression": categorical_regression,
    "toy_regression": toy_regression,
    "toy_classification": toy_classification,
}


def make(name: str, **params):
    """Создать набор по имени — так же называются генераторы в веб-уроках.

    >>> X, y = make("regression_1d", kind="sine", n=50, noise=0.2, seed=1)
    """
    try:
        gen = _GENERATORS[name]
    except KeyError as exc:
        raise ValueError(f"Неизвестный набор {name!r}; доступно: {', '.join(_GENERATORS)}") from exc
    return gen(**params)


def _fmt(v) -> str:
    """Кратчайшее точное текстовое представление числа (как String(x) в JS); строки — как есть."""
    if isinstance(v, (str, np.str_)):
        return str(v)
    if isinstance(v, (bool, np.bool_)):
        return str(int(v))
    if isinstance(v, (int, np.integer)):
        return str(int(v))
    fv = float(v)
    if math.isnan(fv):
        return ""
    if fv.is_integer() and abs(fv) < 1e15:
        return str(int(fv))
    return repr(fv)


def save_csv(path: str | Path, columns: dict[str, Sequence]) -> Path:
    """Сохранить столбцы в CSV без зависимости от pandas (пустая ячейка = пропуск)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    names = list(columns)
    cols = [list(np.asarray(columns[c]).ravel()) for c in names]
    n = len(cols[0]) if cols else 0
    if any(len(c) != n for c in cols):
        raise ValueError("Все столбцы должны иметь одинаковую длину")
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(names)
        for i in range(n):
            writer.writerow([_fmt(c[i]) for c in cols])
    return path


def load_csv(path: str | Path):
    """Прочитать CSV курса в ``pandas.DataFrame`` (pandas импортируется лениво)."""
    import pandas as pd

    return pd.read_csv(path)
