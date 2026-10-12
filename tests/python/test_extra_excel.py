"""Excel-версии дополнительных уроков (extra/*/build_excel.py) собираются и сходятся с уроком.

Генераторы запускаются во временной папке; проверяются листы, число формул и то, что ключевые
числа урока (стартовое среднее, остатки шага 0) стоят в тех же ячейках, что и в опубликованных
файлах. Пересчёт формул здесь не делается (нужен LibreOffice) — он входит в сборку файлов.
"""

from __future__ import annotations

import runpy
import shutil
from pathlib import Path

import pytest

openpyxl = pytest.importorskip("openpyxl")

ROOT = Path(__file__).resolve().parents[2]
CASES = [
    ("extra/01_boosting_by_hand", "boosting_by_hand.xlsx", ["Градиентный бустинг"], 100),
    ("extra/02_learning_rate", "boosting_learning_rate.xlsx", ["Содержание", "Теория", "Шаги", "Сводка"], 1700),
]


def _formulas(ws) -> int:
    return sum(1 for row in ws.iter_rows() for c in row if isinstance(c.value, str) and c.value.startswith("="))


@pytest.mark.parametrize("folder, name, sheets, min_formulas", CASES)
def test_build_excel(tmp_path: Path, folder: str, name: str, sheets: list[str], min_formulas: int) -> None:
    script = ROOT / folder / "build_excel.py"
    work = tmp_path / "build_excel.py"
    shutil.copy(script, work)
    runpy.run_path(str(work), run_name="__main__")
    out = tmp_path / name
    assert out.exists(), "генератор должен положить файл рядом с собой"

    wb = openpyxl.load_workbook(out)
    assert wb.sheetnames == sheets
    total = sum(_formulas(ws) for ws in wb.worksheets)
    assert total >= min_formulas, f"мало формул: {total}"

    # входы урока — цены четырёх ноутбуков — в жёлтых ячейках, и сумма цен / 4 даёт 1000
    data_ws = wb["Шаги"] if "Шаги" in wb.sheetnames else wb.worksheets[0]
    prices = [c.value for row in data_ws.iter_rows() for c in row if c.value in (820, 880, 1120, 1180)]
    assert sorted(prices)[:4] == [820, 880, 1120, 1180]

    published = ROOT / folder / name
    assert published.exists(), "опубликованный файл лежит рядом с генератором"
    pub = openpyxl.load_workbook(published)
    assert pub.sheetnames == sheets
    assert sum(_formulas(ws) for ws in pub.worksheets) == total, "опубликованный файл устарел — перезапустите build_excel.py"
