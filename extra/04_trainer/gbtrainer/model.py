"""Модель тетради: данные (объекты, бинарные признаки, y), настройки и уровни сложности.

Все числа — ``Decimal``: ответы тетради считаются ровно так, как их считает ученик на
бумаге (каждое вписанное число округлено до сотых), и двоичная арифметика не должна
давать «0.30000000000000004» там, где ученик пишет 0,30.
"""

from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass, field, replace
from decimal import Decimal, InvalidOperation
from typing import Any

from .themes import Theme, get_theme

MAX_OBJECTS = 16
MAX_FEATURES = 4
MAX_STEPS = 50
LETTERS = "ABCDEFGHIJKLMNOP"


class SpecError(ValueError):
    """Ошибка во входных данных или настройках (сообщение — для человека, по-русски)."""


# ---------------------------------------------------------------------------------------
# Уровни сложности
# ---------------------------------------------------------------------------------------
@dataclass(frozen=True)
class Level:
    number: int
    name: str
    features: int  # число признаков (объектов — 2^features)
    lr: Decimal
    noise: bool
    steps: int
    about: str  # одна фраза для листа «Задание»


LEVELS: dict[int, Level] = {
    lv.number: lv
    for lv in (
        Level(1, "разминка", 2, Decimal("1"), False, 4,
              "ν = 1 и данные без шума: каждая колонка «съедается» целиком за один шаг, ошибка обнуляется за два шага."),
        Level(2, "медленные шаги", 2, Decimal("0.5"), False, 12,
              "ν = 0.5 и данные без шума: каждый шаг забирает только половину поправки, ошибка тает, но ровно в ноль не приходит."),
        Level(3, "шум", 2, Decimal("0.5"), True, 20,
              "Данные с шумом, ν = 0.5. Часть значения не объясняется ни одной колонкой — ошибка упрётся в пол и дальше не пойдёт."),
        Level(4, "неровный темп", 2, Decimal("0.4"), True, 20,
              "Данные с шумом и ν = 0.4: числа перестают делиться пополам, каждое вписанное число округляйте до сотых."),
        Level(5, "три признака", 3, Decimal("0.3"), True, 20,
              "Восемь объектов, три признака и ν = 0.3: группы по четыре, выбор из трёх колонок, шум, который не объясняется ни одной из них."),
    )
}


def get_level(n: int) -> Level:
    try:
        return LEVELS[int(n)]
    except (KeyError, ValueError):
        raise SpecError(f"уровень сложности — число от 1 до {len(LEVELS)}") from None


# ---------------------------------------------------------------------------------------
# Данные
# ---------------------------------------------------------------------------------------
@dataclass(frozen=True)
class Structure:
    """Как устроены случайные данные: y = база + Σ ±вклад + шум (шум ортогонален признакам)."""

    base: int
    effects: tuple[int, ...]  # половина разницы между значениями признака («±a»)
    noise: tuple[int, ...]  # шум каждого объекта

    @property
    def floor(self) -> int:
        """Σ|шум| — ниже этого Σ|rᵢ| не опустится никакой моделью из пней по этим признакам."""
        return sum(abs(e) for e in self.noise)


@dataclass(frozen=True)
class Group:
    feature: int
    level: str
    members: tuple[int, ...]


@dataclass(frozen=True)
class Dataset:
    object: str  # «Пекарня»
    each: str  # «каждой пекарне»
    target: str  # «Реальная выпечка yᵢ, кг»
    quantity: str  # «выпечка за день»
    features: tuple[str, ...]
    levels: tuple[tuple[str, str], ...]  # два значения каждого признака, по порядку
    names: tuple[str, ...]
    x: tuple[tuple[str, ...], ...]  # x[i][j] — значение признака j у объекта i
    y: tuple[Decimal, ...]
    structure: Structure | None = None
    theme: str | None = None

    @property
    def n(self) -> int:
        return len(self.names)

    @property
    def k(self) -> int:
        return len(self.features)

    def groups(self) -> list[Group]:
        """Группы в порядке листа: признак за признаком, внутри — значения по порядку."""
        out = []
        for j, (lo, hi) in enumerate(self.levels):
            for lev in (lo, hi):
                out.append(Group(j, lev, tuple(i for i in range(self.n) if self.x[i][j] == lev)))
        return out

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "object": self.object, "each": self.each, "target": self.target, "quantity": self.quantity,
            "features": list(self.features),
            "rows": [[self.names[i], *self.x[i], _num(self.y[i])] for i in range(self.n)],
        }
        if self.theme:
            d["theme"] = self.theme
        if self.structure:
            d["structure"] = {"base": self.structure.base, "effects": list(self.structure.effects),
                              "noise": list(self.structure.noise), "floor": self.structure.floor}
        return d


def _num(v: Decimal) -> int | float:
    return int(v) if v == v.to_integral_value() else float(v)


def to_decimal(v: Any, what: str) -> Decimal:
    if isinstance(v, bool):
        raise SpecError(f"{what}: ожидалось число, получено {v!r}")
    if isinstance(v, float):
        v = repr(v)
    s = str(v).strip().replace("−", "-").replace(" ", "").replace(" ", "")
    if s.count(",") == 1 and "." not in s:
        s = s.replace(",", ".")
    try:
        d = Decimal(s)
    except InvalidOperation:
        raise SpecError(f"{what}: «{v}» — не число") from None
    if not d.is_finite():
        raise SpecError(f"{what}: «{v}» — не число")
    return d


def make_dataset(
    *,
    features: list[str],
    rows: list[list[Any]],
    object: str = "Объект",
    each: str | None = None,
    target: str = "Реальное значение yᵢ",
    quantity: str | None = None,
    levels: list[list[str]] | None = None,
    structure: Structure | None = None,
    theme: str | None = None,
) -> Dataset:
    """Собрать и проверить набор данных. ``rows`` — [имя, значения признаков…, y]."""
    feats = tuple(str(f).strip() for f in features)
    k = len(feats)
    if not 1 <= k <= MAX_FEATURES:
        raise SpecError(f"признаков должно быть от 1 до {MAX_FEATURES}, а их {k}")
    for f in feats:
        if not f:
            raise SpecError("у признака пустое название")
        if "," in f or '"' in f:
            raise SpecError(f"название признака «{f}» не должно содержать запятых и кавычек (оно попадает в выпадающий список)")
        if len(f) > 40:
            raise SpecError(f"название признака «{f}» длиннее 40 символов")
    if len(set(f.lower() for f in feats)) != k:
        raise SpecError("названия признаков должны различаться")
    n = len(rows)
    if not 2 <= n <= MAX_OBJECTS:
        raise SpecError(f"объектов должно быть от 2 до {MAX_OBJECTS}, а их {n}")

    names, xs, ys = [], [], []
    for i, row in enumerate(rows):
        row = list(row)
        if len(row) == k + 1:  # без имени — подставим букву
            row = [LETTERS[i], *row]
        if len(row) != k + 2:
            raise SpecError(f"строка {i + 1}: ожидалось {k + 2} значений (имя, {k} признак(а), y), получено {len(row)}")
        name = str(row[0]).strip() or LETTERS[i]
        vals = tuple(str(v).strip() for v in row[1:-1])
        for j, v in enumerate(vals):
            if not v:
                raise SpecError(f"строка {i + 1}: пустое значение признака «{feats[j]}»")
        y = to_decimal(row[-1], f"строка {i + 1}, y")
        if y != y.quantize(Decimal("0.01")):
            raise SpecError(f"строка {i + 1}: y = {row[-1]} — не больше двух знаков после запятой")
        if abs(y) >= Decimal("1e9"):
            raise SpecError(f"строка {i + 1}: y = {row[-1]} — слишком большое число для ручного счёта")
        names.append(name)
        xs.append(vals)
        ys.append(y.quantize(Decimal("0.01")) if y != y.to_integral_value() else y.quantize(Decimal(1)))
    if len(set(names)) != n:
        raise SpecError("имена объектов должны различаться")

    lv: list[tuple[str, str]] = []
    for j in range(k):
        seen: list[str] = []
        for i in range(n):
            if xs[i][j] not in seen:
                seen.append(xs[i][j])
        if levels is not None:
            want = [str(v).strip() for v in levels[j]]
            if sorted(want) != sorted(seen):
                raise SpecError(f"признак «{feats[j]}»: значения {seen} не совпадают с заданными {want}")
            seen = want
        if len(seen) != 2:
            raise SpecError(
                f"признак «{feats[j]}» должен делить объекты ровно на две группы, а значений у него {len(seen)}: "
                + ", ".join(seen)
            )
        lv.append((seen[0], seen[1]))

    return Dataset(
        object=object.strip() or "Объект",
        each=(each or f"каждому объекту ({object.strip().lower()})").strip(),
        target=target.strip() or "Реальное значение yᵢ",
        quantity=(quantity or "значение").strip(),
        features=feats, levels=tuple(lv), names=tuple(names), x=tuple(xs), y=tuple(ys),
        structure=structure, theme=theme,
    )


# ---------------------------------------------------------------------------------------
# Настройки тетради
# ---------------------------------------------------------------------------------------
MODES = ("gradient", "residual")
CHECKS = ("chain", "strict")


@dataclass(frozen=True)
class Settings:
    lr: Decimal = Decimal("0.5")
    steps: int = 20
    mode: str = "gradient"  # gradient — этап A с градиентом (тетради 5–7); residual — только остатки (2–4)
    check: str = "chain"  # chain — сверка с числами самого ученика; strict — с ключом, как в тетрадях 2–7
    key: bool = True  # скрытый лист «Ответы»
    teacher: bool = False  # жёлтые ячейки заполнены ответами (версия для преподавателя)
    allow_formulas: bool = False
    protect: bool = False  # защитить листы (редактируются только жёлтые ячейки)
    level: int | None = None
    number: int | None = None  # «Рабочая тетрадь № N»
    catalog: int | None = None  # «Тетрадь № N» в подзаголовке
    title: str | None = None
    seed: int | None = None

    def validated(self) -> Settings:
        lr = to_decimal(self.lr, "learning rate ν")
        if not Decimal(0) < lr <= Decimal(1):
            raise SpecError("learning rate ν должен быть в промежутке (0; 1]")
        if lr != lr.quantize(Decimal("0.01")):
            raise SpecError("learning rate ν — не больше двух знаков после запятой (0.5, 0.4, 0.25 …)")
        steps = int(self.steps)
        if not 1 <= steps <= MAX_STEPS:
            raise SpecError(f"число шагов — от 1 до {MAX_STEPS}")
        if self.mode not in MODES:
            raise SpecError(f"режим этапа A: {' или '.join(MODES)}")
        if self.check not in CHECKS:
            raise SpecError(f"проверка: {' или '.join(CHECKS)}")
        if self.check == "strict" and not self.key:
            raise SpecError("строгой проверке нужен лист «Ответы» — уберите --no-key или выберите проверку chain")
        if self.level is not None:
            get_level(self.level)
        return replace(self, lr=lr.normalize() if lr != 1 else Decimal(1), steps=steps)


@dataclass(frozen=True)
class Spec:
    dataset: Dataset
    settings: Settings = field(default_factory=Settings)


SETTINGS_KEYS = {"lr", "steps", "mode", "check", "key", "teacher", "allow_formulas", "protect", "level",
                 "number", "catalog", "title", "seed"}


def spec_from_dict(d: dict[str, Any], base: Settings | None = None) -> Spec:
    """Тетрадь из словаря (JSON): данные + необязательные настройки.

    Формат::

        {"theme": "bakery",                      # подписи берутся из сюжета (необязательно)
         "object": "Пекарня", "target": "…", "each": "…", "quantity": "…",
         "features": ["Расположение", "Выходной"],
         "rows": [["A", "спальный", "нет", 50], …],   # или [{"name", "x": […], "y"}]
         "lr": 0.5, "steps": 20, "mode": "gradient", "check": "chain", "level": 3}
    """
    if not isinstance(d, dict):
        raise SpecError("ожидался JSON-объект с полями features и rows")
    labels: dict[str, Any] = {}
    theme: Theme | None = None
    if d.get("theme"):
        theme = get_theme(str(d["theme"]))
        labels = {"object": theme.object, "each": theme.each, "target": theme.target, "quantity": theme.quantity}
    for key in ("object", "each", "target", "quantity"):
        if d.get(key):
            labels[key] = str(d[key])
    if "features" not in d or "rows" not in d:
        raise SpecError("нужны поля features (названия признаков) и rows (строки данных)")
    rows = []
    for i, r in enumerate(d["rows"]):
        if isinstance(r, dict):
            x = r.get("x")
            if x is None:
                x = [r[f] for f in d["features"] if f in r]
            rows.append([r.get("name", LETTERS[i] if i < len(LETTERS) else str(i + 1)), *x, r.get("y")])
        else:
            rows.append(list(r))
    st = d.get("structure")
    structure = None
    if isinstance(st, dict) and {"base", "effects", "noise"} <= st.keys():
        structure = Structure(int(st["base"]), tuple(int(v) for v in st["effects"]), tuple(int(v) for v in st["noise"]))
    ds = make_dataset(features=list(d["features"]), rows=rows, levels=d.get("levels"), structure=structure,
                      theme=theme.key if theme else None, **labels)
    s = base or Settings()
    upd = {k: d[k] for k in SETTINGS_KEYS if k in d and d[k] is not None}
    if "level" in upd and "lr" not in upd:
        upd["lr"] = get_level(upd["level"]).lr
    return Spec(ds, replace(s, **upd).validated())


def spec_to_dict(spec: Spec) -> dict[str, Any]:
    s = spec.settings
    d = spec.dataset.to_dict()
    d.update({"lr": float(s.lr), "steps": s.steps, "mode": s.mode, "check": s.check})
    for key in ("level", "number", "catalog", "title", "seed"):
        if getattr(s, key) is not None:
            d[key] = getattr(s, key)
    return d


def dataset_from_csv(text: str) -> dict[str, Any]:
    """CSV/TSV: заголовок «объект, признак…, целевая», далее строки «имя, значения…, y».

    Разделитель определяется сам (запятая, точка с запятой, табуляция); в y допустима
    десятичная запятая, если разделитель — не запятая.
    """
    text = text.lstrip("﻿").strip()
    if not text:
        raise SpecError("пустой CSV")
    try:
        dialect = csv.Sniffer().sniff(text.splitlines()[0], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    rows = [r for r in csv.reader(io.StringIO(text), dialect) if any(c.strip() for c in r)]
    if len(rows) < 3 or len(rows[0]) < 3:
        raise SpecError("в CSV нужен заголовок и хотя бы две строки: объект, признак(и), целевая величина")
    head = [c.strip() for c in rows[0]]
    return {"object": head[0], "features": head[1:-1], "target": head[-1], "rows": rows[1:]}


def load_spec_file(path: str, text: str, base: Settings | None = None) -> Spec:
    """JSON или CSV по расширению файла."""
    if path.lower().endswith((".csv", ".tsv", ".txt")):
        return spec_from_dict(dataset_from_csv(text), base)
    try:
        d = json.loads(text)
    except json.JSONDecodeError as e:
        raise SpecError(f"{path}: неверный JSON — {e.msg} (строка {e.lineno})") from None
    return spec_from_dict(d, base)
