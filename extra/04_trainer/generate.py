"""Генератор рабочих тетрадей «градиентный бустинг своими руками» (.xlsx).

Запуск: python extra/04_trainer/generate.py [--level 1..5] [--theme …] [--seed N] [--steps N] [--lr ν]
        python extra/04_trainer/generate.py --data presets/wb7_bakery.json
        python extra/04_trainer/generate.py --help
Нужен openpyxl (pip install openpyxl). Код — в пакете gbtrainer/ рядом с этим файлом.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gbtrainer.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
