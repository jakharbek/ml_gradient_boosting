"""Мост для веб-страницы (Pyodide): JSON на входе, JSON или байты на выходе.

Страница ``extra/04_trainer/index.html`` загружает этот пакет в браузер и вызывает функции
отсюда — тетрадь собирается тем же кодом, что и в командной строке.

Запрос (JSON)::

    {"source": "random" | "custom",
     "level": 3, "theme": "bakery" | "random", "seed": 7,      # для random
     "data": {"object", "target", "features", "rows", …},     # для custom
     "steps": 20, "lr": 0.5, "mode": "gradient", "check": "chain", "key": true,
     "number": 8, "catalog": null, "protect": false, "allow_formulas": false}
"""

from __future__ import annotations

import csv
import io
import json
import zipfile
from dataclasses import replace
from typing import Any

from . import file_name, generate, levels_info, make_spec, preview, themes_info
from .model import SpecError, dataset_from_csv

SETTING_KEYS = ("steps", "lr", "mode", "check", "key", "number", "catalog", "title", "protect", "allow_formulas")


def _spec(req: dict[str, Any], seed_offset: int = 0):
    settings = {k: req.get(k) for k in SETTING_KEYS if req.get(k) not in (None, "")}
    for k in ("steps", "number", "catalog"):
        if k in settings:
            try:
                settings[k] = int(settings[k])
            except (TypeError, ValueError):
                raise SpecError(f"поле {k}: нужно целое число") from None
    level = int(req["level"]) if req.get("level") not in (None, "") else None
    if req.get("source") == "custom":
        return make_spec(data=req.get("data") or {}, level=level, **settings)
    seed = int(req.get("seed") or 0) + seed_offset
    return make_spec(level=level, theme=req.get("theme") or None, seed=seed, **settings)


def _ok(payload: dict[str, Any]) -> str:
    return json.dumps({"ok": True, **payload}, ensure_ascii=False)


def _err(e: Exception) -> str:
    return json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False)


def info() -> str:
    return _ok({"themes": themes_info(), "levels": levels_info()})


def preview_json(req_json: str) -> str:
    """Сводка + данные (для таблицы на странице) или текст ошибки."""
    try:
        spec = _spec(json.loads(req_json))
        return _ok(preview(spec))
    except (SpecError, ValueError, KeyError, TypeError) as e:
        return _err(e)


def parse_csv(text: str) -> str:
    try:
        return _ok({"data": dataset_from_csv(text)})
    except SpecError as e:
        return _err(e)


def build(req_json: str, teacher: bool = False) -> bytes:
    spec = _spec(json.loads(req_json))
    spec = replace(spec, settings=replace(spec.settings, teacher=bool(teacher)))
    return generate(spec)


def build_name(req_json: str, teacher: bool = False) -> str:
    return file_name(_spec(json.loads(req_json)), teacher=bool(teacher))


def build_zip(req_json: str, count: int, teacher_copy: bool = True) -> bytes:
    """Пачка вариантов для класса: seed, seed+1, …; рядом — версии с ответами и список вариантов."""
    req = json.loads(req_json)
    count = max(1, min(int(count), 60))
    buf = io.BytesIO()
    index = io.StringIO()
    w = csv.writer(index, delimiter=";")
    w.writerow(["вариант", "файл", "seed", "сюжет", "данные y", "Σ|r| в конце", "пол Σ|шум|"])
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for v in range(count):
            spec = _spec(req, seed_offset=v)
            name = f"{v + 1:02d}_" + file_name(spec, teacher=False)
            z.writestr(f"ученикам/{name}", generate(spec))
            if teacher_copy:
                t = replace(spec, settings=replace(spec.settings, teacher=True))
                z.writestr(f"ответы/{v + 1:02d}_" + file_name(t), generate(t))
            pv = preview(spec)
            w.writerow([v + 1, name, spec.settings.seed, spec.dataset.theme or "",
                        " ".join(str(r[-1]) for r in pv["dataset"]["rows"]),
                        pv["steps"][-1]["abs"] if pv["steps"] else pv["abs0"], pv["floor"] or ""])
        z.writestr("варианты.csv", "﻿" + index.getvalue())
    return buf.getvalue()


def spec_json(req_json: str) -> str:
    """Данные и настройки в формате ``--data`` командной строки (чтобы сохранить и пересобрать)."""
    from .model import spec_to_dict

    try:
        return _ok({"spec": spec_to_dict(_spec(json.loads(req_json)))})
    except (SpecError, ValueError, KeyError, TypeError) as e:
        return _err(e)
