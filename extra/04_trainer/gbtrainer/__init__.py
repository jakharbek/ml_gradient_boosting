"""Генератор рабочих тетрадей «градиентный бустинг своими руками» (Excel).

Тетрадь — как № 2–7 курса: данные, ν, N шагов; ученик сам считает этапы A–D каждого шага в
жёлтых ячейках, рядом с каждой появляется ✓/✗; сводка с графиками; скрытый ключ.

Быстрый старт::

    from gbtrainer import make_spec, generate
    spec = make_spec(level=3, theme="bakery", seed=7)          # случайные данные
    open("тетрадь.xlsx", "wb").write(generate(spec))

    spec = make_spec(data={"theme": "cars", "features": ["Привод", "Коробка"],
                           "rows": [["A", "передний", "механика", 188], ...]}, lr=0.4)

Командная строка: ``python extra/04_trainer/generate.py --help``.
"""

from __future__ import annotations

import secrets
from dataclasses import replace
from typing import Any

from .datagen import random_dataset
from .model import (
    CHECKS,
    LEVELS,
    MODES,
    Dataset,
    Settings,
    Spec,
    SpecError,
    get_level,
    load_spec_file,
    spec_from_dict,
    spec_to_dict,
    to_decimal,
)
from .solver import Solution, solve
from .themes import THEMES, Theme
from .xlsx import build_workbook, workbook_bytes

__all__ = ["make_spec", "generate", "preview", "file_name", "solve", "build_workbook", "Spec", "Settings",
           "Dataset", "Solution", "SpecError", "THEMES", "LEVELS", "MODES", "CHECKS", "load_spec_file",
           "spec_from_dict", "spec_to_dict"]

__version__ = "1.0.0"


def make_spec(
    *,
    data: dict[str, Any] | None = None,
    level: int | None = None,
    theme: str | Theme | dict[str, Any] | None = None,
    seed: int | None = None,
    features: int | None = None,
    noise: bool | None = None,
    **settings: Any,
) -> Spec:
    """Собрать спецификацию тетради.

    * ``data`` — свои данные (формат см. ``spec_from_dict``); иначе данные случайные по ``level``,
      ``theme`` и ``seed`` (seed не задан — берётся случайный и записывается в свойства файла).
      ``theme`` — ключ встроенного сюжета, объект Theme или словарь сюжета ИИ-ассистента (``ai.theme_to_dict``).
    * ``settings`` — поля :class:`Settings`: lr, steps, mode, check, key, teacher, number, catalog,
      title, allow_formulas, protect. Явно переданное значение важнее уровня и данных.
    """
    settings = {k: v for k, v in settings.items() if v is not None}
    unknown = set(settings) - set(Settings.__dataclass_fields__)
    if unknown:
        raise SpecError(f"неизвестные настройки: {', '.join(sorted(unknown))}")
    if "lr" in settings:
        settings["lr"] = to_decimal(settings["lr"], "learning rate ν")
    if data is not None:
        merged = dict(data)
        if level is not None:
            merged["level"] = level
        spec = spec_from_dict(merged)
        s = spec.settings
        if level is not None and "steps" not in settings and "steps" not in data:
            settings["steps"] = get_level(level).steps
        return Spec(spec.dataset, replace(s, **settings).validated())

    if isinstance(theme, dict):  # сюжет ИИ-ассистента (сохранённый или «сырой» ответ модели)
        from .ai import theme_from_dict

        theme = theme_from_dict(theme)
    lv = get_level(level if level is not None else 3)
    if seed is None:
        seed = secrets.randbelow(1_000_000)
    s = Settings(lr=lv.lr, steps=lv.steps, level=lv.number, seed=int(seed))
    s = replace(s, **settings).validated()
    ds = random_dataset(seed=int(seed), level=lv, theme=theme, features=features, noise=noise, lr=s.lr,
                        steps=s.steps)
    return Spec(ds, s)


def generate(spec: Spec) -> bytes:
    """Готовый .xlsx в байтах."""
    return workbook_bytes(spec)


def file_name(spec: Spec, teacher: bool | None = None) -> str:
    s, ds = spec.settings, spec.dataset
    teacher = s.teacher if teacher is None else teacher
    no = f"_{s.number}" if s.number else ""
    mode = "бустинг_градиент" if s.mode == "gradient" else "бустинг"
    tail = f"_{ds.theme}_seed{s.seed}" if s.seed is not None and ds.theme else ""
    return f"Рабочая_тетрадь{no}_{mode}_{s.steps}_шагов{tail}{'_ответы' if teacher else ''}.xlsx"


def preview(spec: Spec) -> dict[str, Any]:
    """Краткая сводка для интерфейса: данные, траектория Σ|r|, выбор колонок, предупреждения."""
    ds, s = spec.dataset, spec.settings
    sol = solve(ds, s.lr, s.steps)
    checks_per_step = (2 * ds.n + 1 if s.mode == "gradient" else ds.n + 1) + 3 * 2 * ds.k + ds.k + 1 + 4 * ds.n + 1
    warnings = []
    if s.check == "strict" and sol.near_ties():
        warnings.append("На шагах " + ", ".join(map(str, sol.near_ties())) + " суммы колонок различаются меньше чем "
                        "на 0,05: при строгой проверке ученик с другим округлением может выбрать иначе и получить ✗ "
                        "дальше по цепочке. Проверка «по цепочке» от этого защищена.")
    sizes = {len(g.members) for g in ds.groups()}
    if len(sizes) > 1:
        warnings.append("Группы разного размера: γ = сумма / |G| считается по-разному в разных группах.")
    return {
        "dataset": ds.to_dict(),
        "settings": {"lr": float(s.lr), "steps": s.steps, "mode": s.mode, "check": s.check, "level": s.level,
                     "seed": s.seed, "key": s.key},
        "f0": float(sol.f0),
        "abs0": float(sol.abs_r0),
        "steps": [{"m": st.m, "choice": ds.features[st.choice], "abs": float(st.abs_r_new), "tie": st.tie,
                   "near": st.near_tie and not st.tie, "f": [float(v) for v in st.f_new]} for st in sol.steps],
        "floor": ds.structure.floor if ds.structure else None,
        "checks": 1 + checks_per_step * s.steps,
        "warnings": warnings,
        "file_name": file_name(spec),
    }


def themes_info() -> list[dict[str, Any]]:
    return [{"key": t.key, "title": t.title, "object": t.object, "features": [f.name for f in t.features]}
            for t in THEMES.values()]


def levels_info() -> list[dict[str, Any]]:
    return [{"number": lv.number, "name": lv.name, "features": lv.features, "lr": float(lv.lr), "noise": lv.noise,
             "steps": lv.steps, "about": lv.about} for lv in LEVELS.values()]



