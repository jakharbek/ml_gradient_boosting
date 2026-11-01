"""Сборка Excel-тетради: листы «Задание», «Расчёт», «Сводка» и скрытый «Ответы».

Устройство повторяет рабочие тетради № 2–7: жёлтые ячейки ученика, рядом с каждой — серая
отметка ✓/✗, счётчики «Проверено» по шагам, сводка с графиками. Отличия:

* любое число объектов (2–16) и бинарных признаков (1–4), любое число шагов и ν;
* проверка «по цепочке» (по умолчанию) или строгая — по ключу;
* формула в жёлтой ячейке получает отметку ƒ (работает в Excel, LibreOffice и Google Таблицах,
  в отличие от проверки данных, которую Google при импорте теряет);
* ключ посчитан по протоколу ручного счёта (solver.py), поэтому совпадает с аккуратным
  учеником на всех шагах.

Формулы — только из набора, который понимают Excel 2013+, LibreOffice и Google Таблицы.
"""

from __future__ import annotations

import io
import math
from dataclasses import dataclass, field
from decimal import Decimal

from openpyxl import Workbook
from openpyxl.chart import LineChart, Reference
from openpyxl.formatting.rule import CellIsRule, DataBarRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.properties import Outline
from openpyxl.worksheet.worksheet import Worksheet

from . import texts
from .model import Spec
from .solver import Solution, StepResult, solve

# --- палитра и стили (как в тетрадях № 2–7) ---------------------------------------------
FONT = "Arial"
NAVY, TEAL, GREY, LIGHT, PALE = "1F3864", "2E75B6", "595959", "DEEAF6", "F2F6FB"
EXPL, EXPL_LINE, INPUT, INPUT_INK = "FBF7EE", "E8DCC0", "FFF2CC", "0000FF"
PURPLE, PURPLE_SOFT = "5B2C83", "EADCF8"
OK_INK, OK_BG, BAD_INK, BAD_BG, WARN_INK, WARN_BG = "006100", "E2F0D9", "9C0006", "FFC7CE", "C55A11", "FCE4D6"
WHITE = "FFFFFF"
SERIES = ["2E75B6", "E07B2A", "2A9D8F", "7B5EA7", "C0392B", "8C6D1F", "1F3864", "D35400",
          "16A085", "8E44AD", "7F8C8D", "27AE60", "B03A2E", "2471A3", "AF601A", "117864"]

THIN = Side(style="thin", color="BFBFBF")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center", indent=1)
WRAP = Alignment(horizontal="left", vertical="top", wrap_text=True, indent=1)
HEAD = Alignment(horizontal="center", vertical="center", wrap_text=True)
NUM = "#,##0.00;[Red]-#,##0.00;0"
INT = "#,##0;[Red]-#,##0;0"
TOL = "0.011"  # |ROUND(x;2) − ROUND(эталон;2)| ≤ 0,011 — с точностью до сотой
MARKS = ("✓", "✗", "ƒ", "?", "…")

CALC, TASK, SUMM, KEY = "Расчёт", "Задание", "Сводка", "Ответы"


def fill(c: str) -> PatternFill:
    return PatternFill("solid", fgColor=c)


def q(sheet: str) -> str:
    return f"'{sheet}'!"


def num(v: Decimal) -> int | float:
    return int(v) if v == v.to_integral_value() else float(v)


def fmt_for(values) -> str:
    return INT if all(v == v.to_integral_value() for v in values) else NUM


class Sheet:
    """Тонкая обёртка над листом: ячейки в стиле тетради."""

    def __init__(self, ws: Worksheet, last: int) -> None:
        self.ws, self.last = ws, last
        ws.sheet_view.showGridLines = False

    def cell(self, r, c, v=None, *, font=None, bg=None, border=BOX, align=CENTER, fmt=None):
        x = self.ws.cell(row=r, column=c, value=v)
        x.font = font or Font(name=FONT, size=10)
        if bg:
            x.fill = fill(bg)
        if border:
            x.border = border
        if align:
            x.alignment = align
        if fmt:
            x.number_format = fmt
        return x

    def merge(self, r, c1, c2, v, **kw):
        if c2 > c1:
            self.ws.merge_cells(start_row=r, start_column=c1, end_row=r, end_column=c2)
        return self.cell(r, c1, v, **kw)

    def title(self, r, text, size=15):
        self.merge(r, 2, self.last, text, font=Font(name=FONT, size=size, bold=True, color=NAVY), border=None,
                   align=Alignment(horizontal="left", vertical="center", wrap_text=True, indent=1))
        self.fit(r, text, 2, size + 2)
        self.ws.row_dimensions[r].height = max(self.ws.row_dimensions[r].height, 25.5 if size < 16 else 30)

    def note(self, r, text, *, c1=2, italic=True, color=GREY, size=9, bg=None, border=None, min_h=15):
        self.merge(r, c1, self.last, text, font=Font(name=FONT, size=size, italic=italic, color=color), bg=bg,
                   border=border, align=WRAP)
        self.fit(r, text, c1, size)
        self.ws.row_dimensions[r].height = max(self.ws.row_dimensions[r].height or 0, min_h)

    def fit(self, r, text, c1=2, size=9):
        width = sum((self.ws.column_dimensions[L(c)].width or 9) for c in range(c1, self.last + 1))
        per_line = max(20.0, width * 1.08 * 9 / size)
        lines = sum(max(1, math.ceil(len(part) / per_line)) for part in str(text).split("\n"))
        self.ws.row_dimensions[r].height = max(15.0, lines * size * 1.45 + 4)

    def banner(self, r, text, color=NAVY, size=12, c1=2):
        self.merge(r, c1, self.last, text, font=Font(name=FONT, size=size, bold=True, color=WHITE), bg=color,
                   border=None, align=LEFT)
        self.ws.row_dimensions[r].height = 24 if size >= 12 else 21.75

    def label(self, r, c1, c2, text, color=NAVY, bg=LIGHT):
        return self.merge(r, c1, c2, text, font=Font(name=FONT, size=10, bold=True, color=color), bg=bg, align=LEFT)

    def header(self, r, items: dict[int, str], purple: set[int] = frozenset(), height=30):
        for c, text in items.items():
            bg = PURPLE if c in purple else TEAL
            self.cell(r, c, text, font=Font(name=FONT, size=9, bold=True, color=WHITE), bg=bg, align=HEAD)
        self.ws.row_dimensions[r].height = height

    def given(self, r, c, v, fmt=None, bold=False):
        return self.cell(r, c, v, font=Font(name=FONT, size=10, bold=bold), fmt=fmt)

    def yellow(self, r, c, v=None, fmt=NUM):
        x = self.cell(r, c, v, font=Font(name=FONT, size=10, bold=True, color=INPUT_INK), bg=INPUT, fmt=fmt)
        x.protection = Protection(locked=False)
        return x

    def mark(self, r, c, formula):
        return self.cell(r, c, formula, font=Font(name=FONT, size=11, bold=True))


@dataclass
class Key:
    """Лист «Ответы»: подпись + значение; ``add`` возвращает абсолютную ссылку на значение."""

    ws: Worksheet | None
    rows: list[tuple[str, object, str]] = field(default_factory=list)
    row: int = 3

    def add(self, label: str, value) -> str:
        r = self.row
        self.row += 1
        if self.ws is not None:
            self.ws.cell(row=r, column=1, value=label).font = Font(name=FONT, size=10)
            c = self.ws.cell(row=r, column=2, value=value)
            c.font = Font(name=FONT, size=10)
            if not isinstance(value, str):
                c.number_format = NUM
        ref = f"{q(KEY)}$B${r}"
        self.rows.append((label, value, ref))
        return ref

    def ref(self, label: str) -> str:
        """Ссылка на последнее значение с такой подписью."""
        for lab, _v, ref in reversed(self.rows):
            if lab == label:
                return ref
        raise KeyError(label)

    def next_ref(self) -> str:
        return f"{q(KEY)}$B${self.row}"

    def section(self, label: str) -> None:
        if self.ws is not None and label:
            self.row += 1
            self.ws.cell(row=self.row, column=1, value=label).font = Font(name=FONT, size=10, bold=True)
        self.row += 1


# ========================================================================================
class Builder:
    def __init__(self, spec: Spec, solution: Solution | None = None) -> None:
        self.spec = spec
        self.ds = spec.dataset
        self.s = spec.settings
        self.sol = solution or solve(self.ds, self.s.lr, self.s.steps)
        self.wb = Workbook()
        self.grad = self.s.mode == "gradient"
        self.chain = self.s.check == "chain"
        self.teacher = self.s.teacher
        self.y_fmt = fmt_for(self.ds.y)

    # --- формулы-проверки ---------------------------------------------------------------
    def _guard(self, ref: str, ok: str) -> str:
        """Общая обёртка: пусто → пусто; формула → ƒ; не число → ?; иначе ✓/✗ по условию ok."""
        inner = f'IF(NOT(ISNUMBER({ref})),"?",IF(IFERROR({ok},FALSE),"✓","✗"))'
        if not self.s.allow_formulas:
            inner = f'IF(_xlfn.ISFORMULA({ref}),"ƒ",{inner})'
        return f'=IF({ref}="","",{inner})'

    def check_num(self, ref: str, label: str, value: Decimal, chain_expr: str) -> str:
        key_ref = self.key.add(label, num(value))
        target = chain_expr if self.chain else key_ref
        return self._guard(ref, f"ABS(ROUND({ref},2)-ROUND({target},2))<={TOL}")

    # ------------------------------------------------------------------------------------
    def build(self) -> Workbook:
        wb = self.wb
        self.task = Sheet(wb.active, last=max(6, 3 + self.ds.k))
        self.task.ws.title = TASK
        self.calc = Sheet(wb.create_sheet(CALC), last=13)
        self.summ = Sheet(wb.create_sheet(SUMM), last=5 + self.ds.n)
        key_ws = wb.create_sheet(KEY) if self.s.key else None
        self.key = Key(key_ws)
        if key_ws is not None:
            key_ws.sheet_state = "hidden"
            key_ws.column_dimensions["A"].width = 34
            key_ws.column_dimensions["B"].width = 14
            key_ws["A1"] = ("Ключ для самопроверки. Лист скрыт; " +
                            ("отметки ✓/✗ на листе «Расчёт» сверяются с этими значениями." if not self.chain else
                             "проверка «по цепочке» его не использует — он нужен для сверки с эталоном на листе «Сводка»."))
            key_ws["A1"].font = Font(name=FONT, size=10, italic=True, color=GREY)
            key_ws["A2"] = "Протокол: каждое число округлено до сотых (половина — от нуля), дальше считается округлённое."
            key_ws["A2"].font = Font(name=FONT, size=9, italic=True, color=GREY)
        self._task()
        self._calc()
        self._summary()
        self._finish()
        return wb

    # ------------------------------------------------------------------------------------
    def _task(self) -> None:
        ds, s, sh = self.ds, self.s, self.task
        ws = sh.ws
        k = ds.k
        ycol = 3 + k
        widths = {"A": 2, "B": 16}
        for j in range(k):
            widths[L(3 + j)] = max(14, min(24, len(ds.features[j]) + 4))
        widths[L(ycol)] = max(18, min(30, len(ds.target) // 2 + 6))
        for c in range(ycol + 1, sh.last + 1):
            widths[L(c)] = 16
        for col, w in widths.items():
            ws.column_dimensions[col].width = w

        sh.title(2, texts.title(ds, s), size=16)
        sh.note(3, texts.about(ds, s), size=10)
        r = 5
        sh.banner(r, "Исходные данные")
        r += 2
        sh.header(r, {2: ds.object, **{3 + j: f for j, f in enumerate(ds.features)}, ycol: ds.target})
        self.y_first = r + 1
        for i in range(ds.n):
            r += 1
            sh.given(r, 2, ds.names[i], bold=True)
            for j in range(k):
                sh.given(r, 3 + j, ds.x[i][j])
            sh.given(r, ycol, num(ds.y[i]), fmt=self.y_fmt)
        self.y_last = r
        self.y_range = f"{q(TASK)}${L(ycol)}${self.y_first}:${L(ycol)}${self.y_last}"
        r += 2
        sh.label(r, 2, 3, "Learning rate ν")
        sh.cell(r, 4, float(s.lr), font=Font(name=FONT, size=11, bold=True), fmt="0.00")
        self.nu = f"{q(TASK)}$D${r}"
        r += 1
        sh.label(r, 2, 3, "Число шагов")
        sh.cell(r, 4, s.steps, font=Font(name=FONT, size=11, bold=True), fmt="0")
        r += 2

        def para_block(title: str, paras: list[str], first_bg=PALE) -> int:
            nonlocal r
            sh.banner(r, title)
            r += 1
            for i, p in enumerate(paras):
                bg = first_bg if i == 0 and first_bg else EXPL
                sh.note(r, p, italic=False, color="3B3B3B", bg=bg)
                r += 1
            r += 1
            return r

        para_block("Как проверяются ответы", texts.checking(s), first_bg=PALE)
        proc = texts.procedure(ds, s, self.sol)
        intro = ("Этапы те же, что в уроке 02. Все числа — только ручкой и калькулятором (или в уме): формулы в жёлтые "
                 "ячейки вписывать нельзя, они не засчитываются." if not s.allow_formulas else
                 "Этапы те же, что в уроке 02. В жёлтые ячейки можно вписывать и формулы — тогда это тренажёр по Excel.")
        para_block("Порядок действий на каждом шаге", [intro, *proc])

        def formula_block(title: str, rows: list[tuple[str, str]], ink: str, bg: str, sub: str | None = None) -> None:
            nonlocal r
            sh.banner(r, title)
            r += 1
            if sub:
                sh.note(r, sub, italic=False, color="3B3B3B", bg=PALE)
                r += 1
            r += 1
            mid = min(sh.last - 1, 5)  # формула — B:D, пояснение — справа
            for f, t in rows:
                sh.merge(r, 2, mid - 1, f, font=Font(name="Cambria Math", size=11, bold=True, color=ink), bg=bg,
                         align=LEFT)
                sh.merge(r, mid, sh.last, t, font=Font(name=FONT, size=9, color="3B3B3B"), border=None, align=WRAP)
                sh.fit(r, t, mid)
                ws.row_dimensions[r].height = max(ws.row_dimensions[r].height, 20)
                r += 1
            r += 1

        if s.mode == "gradient":
            formula_block("Где здесь градиентный спуск", texts.gradient_block(ds, s), PURPLE, PURPLE_SOFT,
                          "Сиреневым на листе «Расчёт» выделено всё, что есть сам градиентный спуск. "
                          "Остальное (B, C) — дерево, которое приближает антиградиент.")
        formula_block("Шпаргалка по формулам", texts.cheatsheet(s), NAVY, LIGHT)
        sh.banner(r, "Подсказка на старт")
        r += 2
        sh.note(r, texts.hint(ds, s), italic=False, color="3B3B3B", size=10)
        ws.sheet_view.zoomScale = 100

    # ------------------------------------------------------------------------------------
    def _calc(self) -> None:
        ds, s, sh, sol = self.ds, self.s, self.calc, self.sol
        ws = sh.ws
        for col, w in {"A": 2, "B": 16, "C": 16, "D": 14, "E": 16, "F": 16, "G": 16, "H": 16, "I": 16, "J": 14,
                       "K": 14, "L": 10, "M": 6}.items():
            ws.column_dimensions[col].width = w
        no = f" (тетрадь № {s.number})" if s.number else ""
        sh.title(2, f"Расчёт: {texts.steps_word(s.steps)}{no}")
        sh.note(3, "Жёлтые ячейки — ваши. Серая колонка справа от каждой — отметка ✓/✗ (появляется после ввода). " +
                ("Формулы в жёлтые ячейки не засчитываются (отметка ƒ) — считайте сами." if not s.allow_formulas else
                 "Можно вписывать и числа, и формулы."))
        sh.label(4, 2, 3, "Прогресс")
        self.progress_cell = (4, 4)
        ws.freeze_panes = "A5"

        r = 6
        sh.banner(r, "Шаг 0 — стартовое предсказание")
        r += 2
        n = ds.n
        mean_of = f"среднее {texts.GEN[n]} значений" if n in texts.GEN else f"среднее {n} значений"
        sh.label(r, 2, 4, f"F₀ = {mean_of}")
        f0 = f"E{r}"
        sh.yellow(r, 5, num(sol.f0) if self.teacher else None)
        sh.mark(r, 6, self.check_num(f0, "F0", sol.f0, f"AVERAGE({self.y_range})"))
        self.f0_ref = f"${L(5)}${r}"
        r += 2

        self.step_rows: list[dict] = []
        prev_f = [self.f0_ref] * n  # ячейки ученика со старым предсказанием
        self.key.section("")
        for st in sol.steps:
            info, r, prev_f = self._step(r, st, prev_f)
            self.step_rows.append(info)
            r += 2
        self.calc_last = r
        # прогресс по всей тетради
        rng = f"$C$6:$M${r}"
        total = sum(i["checks"] for i in self.step_rows) + 1
        self.total_checks = total
        cnt = f'COUNTIF({rng},"✓")'
        bad = f'COUNTIF({rng},"✗")+COUNTIF({rng},"~?")'
        frm = f'COUNTIF({rng},"ƒ")'
        sh.merge(4, 4, 13,
                 f'={cnt}&" из {total} верно  ·  ошибок: "&({bad})'
                 + (f'&IF({frm}>0,"  ·  формул: "&{frm},"")' if not s.allow_formulas else "")
                 + f'&"  ·  "&INT(100*{cnt}/{total})&"%"',
                 font=Font(name=FONT, size=10, bold=True, color=OK_INK), bg=OK_BG, align=LEFT)
        # отметки цветом — одно правило на весь лист
        area = f"C6:M{r}"
        for mark, ink, bg in (("✓", OK_INK, OK_BG), ("✗", BAD_INK, BAD_BG), ("ƒ", WARN_INK, WARN_BG),
                              ("?", WARN_INK, WARN_BG), ("…", GREY, "EDEDED")):
            ws.conditional_formatting.add(area, CellIsRule(operator="equal", formula=[f'"{mark}"'],
                                                           font=Font(color=ink, bold=True), fill=fill(bg)))
        ws.sheet_properties.outlinePr = Outline(summaryBelow=False, summaryRight=False)

    def _step(self, r: int, st: StepResult, prev_f: list[str]):
        ds, s, sh = self.ds, self.s, self.calc
        ws = sh.ws
        n, k, m = ds.n, ds.k, st.m
        T = self.teacher
        name = ds.names
        fm1 = f"F_{m - 1}"
        start = r
        if self.grad:
            sh.banner(r, f"Шаг {m}:  F_{m} = {fm1} − ν·∂L/∂F  ≈  {fm1} + ν·h_{m}", color=TEAL, size=11)
        else:
            sh.banner(r, f"Шаг {m}:  F_{m} = {fm1} + ν·h_{m}", color=TEAL, size=11)
        r += 1
        status_row = r
        r += 1
        self.key.section(f"Шаг {m}")
        checks = 0

        # ---- A. градиент → остатки -------------------------------------------------------
        if self.grad:
            sh.label(r, 2, 3, "A. Градиент → остатки", color=PURPLE, bg=PURPLE_SOFT)
            sh.merge(r, 4, 13, f"ГРАДИЕНТНЫЙ СПУСК, часть 1: производная ∂L/∂Fᵢ = {fm1}(xᵢ) − yᵢ, затем антиградиент "
                     f"rᵢ = −∂L/∂Fᵢ = yᵢ − {fm1}(xᵢ). {fm1} подставляется из " +
                     ("шага 0." if m == 1 else f"шага {m - 1}."),
                     font=Font(name=FONT, size=9, color=PURPLE), border=None, align=LEFT)
        else:
            sh.label(r, 2, 3, "A. Остатки")
            sh.merge(r, 4, 13, f"rᵢ = yᵢ − {fm1}(xᵢ). Старое предсказание подставляется из " +
                     ("шага 0 автоматически." if m == 1 else f"шага {m - 1} автоматически."),
                     font=Font(name=FONT, size=9, color=GREY), border=None, align=LEFT)
        r += 1
        if self.grad:
            sh.header(r, {2: ds.object, 3: f"{fm1}(xᵢ)", 4: "yᵢ", 5: "∂L/∂Fᵢ = F − y (градиент)", 6: "",
                          7: "rᵢ = −∂L/∂Fᵢ = y − F", 8: ""}, purple={5, 6, 7, 8})
            RC = 7
        else:
            sh.header(r, {2: ds.object, 3: f"{fm1}(xᵢ)", 4: "yᵢ", 5: "rᵢ = yᵢ − F", 6: ""})
            RC = 5
        r_cells = []
        for i in range(n):
            r += 1
            sh.given(r, 2, name[i], bold=True)
            src = prev_f[i]
            sh.cell(r, 3, f"={src}" if m == 1 else f'=IF({src}="","",{src})', fmt=NUM)
            sh.given(r, 4, num(ds.y[i]), fmt=self.y_fmt)
            if self.grad:
                sh.yellow(r, 5, num(st.grad[i]) if T else None)
                sh.mark(r, 6, self.check_num(f"E{r}", f"g_{name[i]}", st.grad[i], f"C{r}-D{r}"))
                checks += 1
            sh.yellow(r, RC, num(st.r[i]) if T else None)
            sh.mark(r, RC + 1, self.check_num(f"{L(RC)}{r}", f"r_{name[i]}", st.r[i], f"D{r}-C{r}"))
            checks += 1
            r_cells.append(f"{L(RC)}{r}")
        r += 1
        sh.label(r, 2, RC - 1, "Σ|rᵢ|")
        rr = f"{r_cells[0]}:{r_cells[-1]}"
        sh.yellow(r, RC, num(st.abs_r) if T else None)
        sh.mark(r, RC + 1, self.check_num(f"{L(RC)}{r}", "Σ|r|", st.abs_r, f"SUMPRODUCT(ABS({rr}))"))
        checks += 1
        abs_before = f"${L(RC)}${r}"
        r += 2

        # ---- B. группировка --------------------------------------------------------------
        gamma_t, sse_t = texts.group_size_text(ds)
        sh.label(r, 2, 3, "B. Группировка")
        sh.merge(r, 4, 13, f"Сумма остатков группы → {gamma_t} → остаток ошибки {sse_t}.",
                 font=Font(name=FONT, size=9, color=GREY), border=None, align=LEFT)
        r += 1
        sizes = {len(g.group.members) for g in st.groups}
        gh = f"γ = Σ / {sizes.pop()}" if len(sizes) == 1 else "γ = Σ / |G|"
        sh.header(r, {2: "Колонка", 3: "Группа", 4: "Состав", 5: "Σ остатков", 6: "", 7: gh, 8: "",
                      9: "Σ (rᵢ−γ)²" if len(st.groups[0].group.members) > 2 else "(r₁−γ)² + (r₂−γ)²", 10: ""})
        gamma_cell: dict[tuple[int, int], str] = {}  # (признак, объект) → ячейка γ его группы
        sse_cells: dict[int, list[str]] = {j: [] for j in range(k)}
        for gr in st.groups:
            r += 1
            g = gr.group
            fname = ds.features[g.feature]
            sh.given(r, 2, fname)
            sh.given(r, 3, g.level)
            sh.given(r, 4, texts.members(ds, g.members) + ("" if len(sizes) <= 1 else f" ({len(g.members)})"))
            mem_r = [r_cells[i] for i in g.members]
            sh.yellow(r, 5, num(gr.sum_r) if T else None)
            sh.mark(r, 6, self.check_num(f"E{r}", f"{fname} {g.level} Σr", gr.sum_r, "+".join(mem_r)))
            sh.yellow(r, 7, num(gr.gamma) if T else None)
            sh.mark(r, 8, self.check_num(f"G{r}", f"{fname} {g.level} γ", gr.gamma, f"E{r}/{len(g.members)}"))
            sh.yellow(r, 9, num(gr.sse) if T else None)
            sse_expr = "+".join(f"({c}-G{r})^2" for c in mem_r)
            sh.mark(r, 10, self.check_num(f"I{r}", f"{fname} {g.level} sse", gr.sse, sse_expr))
            checks += 3
            for i in g.members:
                gamma_cell[(g.feature, i)] = f"$G${r}"
            sse_cells[g.feature].append(f"$I${r}")
            if g.level == ds.levels[g.feature][1]:
                self.key.add(f"{fname} sse total", num(st.totals[g.feature]))
        r += 2

        # ---- C. выбор колонки ------------------------------------------------------------
        sh.label(r, 2, 3, "C. Выбор колонки")
        sh.merge(r, 4, 13, "Сложите остатки ошибки групп каждой колонки; впишите название колонки с меньшей суммой "
                 "(при равенстве — ту, что выше).", font=Font(name=FONT, size=9, color=GREY), border=None, align=LEFT)
        r += 1
        sh.header(r, {2: "Колонка", 3: "Сумма по группам", 4: "", 6: f"Выбор ({' / '.join(ds.features)})", 7: ""})
        names_first = r + 1
        names_rng = f"$B${names_first}:$B${names_first + k - 1}"
        tot_cells = []
        for j in range(k):
            r += 1
            sh.given(r, 2, ds.features[j])
            sh.yellow(r, 3, num(st.totals[j]) if T else None)
            # ключ суммы уже записан в разделе B; для проверки берём его же
            key_ref = self.key.ref(f"{ds.features[j]} sse total")
            target = "+".join(sse_cells[j]) if self.chain else key_ref
            sh.mark(r, 4, self._guard(f"C{r}", f"ABS(ROUND(C{r},2)-ROUND({target},2))<={TOL}"))
            checks += 1
            tot_cells.append("(" + "+".join(sse_cells[j]) + ")")
        choice_row = names_first
        ch = f"$F${choice_row}"
        c = sh.yellow(choice_row, 6, ds.features[st.choice] if T else None, fmt="@")
        c.alignment = CENTER
        dv = DataValidation(type="list", formula1='"' + ",".join(ds.features) + '"', allow_blank=True,
                            showErrorMessage=False, showInputMessage=True, promptTitle="Выбор колонки",
                            prompt="Колонка с меньшей суммой остатков ошибки")
        dv.add(f"F{choice_row}")
        self.calc.ws.add_data_validation(dv)
        key_choice = self.key.add("выбор", ds.features[st.choice])
        idx = f"MATCH(TRIM({ch}),{names_rng},0)"
        if self.chain:
            all_sse = ",".join(c for j in range(k) for c in sse_cells[j])
            cond = (f'IF(COUNT({all_sse})<{len(st.groups)},"…",IF(CHOOSE({idx},{",".join(tot_cells)})'
                    f'<=MIN({",".join(tot_cells)})+0.000001,"✓","✗"))')
        else:
            cond = f'IF(LOWER(TRIM({ch}))=LOWER(TRIM({key_choice})),"✓","✗")'
        sh.mark(choice_row, 7, f'=IF({ch}="","",IF(ISNA({idx}),"?",{cond}))')
        checks += 1
        r += 2

        # ---- D. шаг ------------------------------------------------------------------
        if self.grad:
            sh.label(r, 2, 3, "D. Шаг спуска", color=PURPLE, bg=PURPLE_SOFT)
            sh.merge(r, 4, 13, f"ГРАДИЕНТНЫЙ СПУСК, часть 2: h_{m} ≈ −∂L/∂F (γ группы в выбранной колонке); "
                     f"шаг ν·h = {texts.dec(s.lr)}·h; F_{m} = {fm1} + ν·h  ⇔  {fm1} − ν·∂L/∂F; новый остаток yᵢ − F_{m}.",
                     font=Font(name=FONT, size=9, color=PURPLE), border=None, align=LEFT)
            sh.header(r + 1, {2: ds.object, 3: f"{fm1}(xᵢ)", 4: f"h_{m} ≈ −∂L/∂F", 5: "", 6: "шаг ν·h", 7: "",
                              8: f"F_{m} = {fm1} + ν·h", 9: "", 10: "новый rᵢ", 11: "", 12: "yᵢ"},
                      purple={4, 5, 6, 7, 8, 9})
        else:
            sh.label(r, 2, 3, "D. Обновление")
            sh.merge(r, 4, 13, f"h_{m} — γ группы в выбранной колонке; ν·h = {texts.dec(s.lr)}·h; "
                     f"F_{m} = {fm1} + ν·h; новый остаток yᵢ − F_{m}.",
                     font=Font(name=FONT, size=9, color=GREY), border=None, align=LEFT)
            sh.header(r + 1, {2: ds.object, 3: f"{fm1}(xᵢ)", 4: f"h_{m}(xᵢ)", 5: "", 6: "ν·h", 7: "",
                              8: f"F_{m}(xᵢ)", 9: "", 10: "новый rᵢ", 11: "", 12: "yᵢ"})
        r += 1
        new_f, rn_cells = [], []
        for i in range(n):
            r += 1
            sh.given(r, 2, name[i], bold=True)
            src = prev_f[i]
            sh.cell(r, 3, f"={src}" if m == 1 else f'=IF({src}="","",{src})', fmt=NUM)
            sh.yellow(r, 4, num(st.h[i]) if T else None)
            h_expr = f"CHOOSE({idx},{','.join(gamma_cell[(j, i)] for j in range(k))})"
            sh.mark(r, 5, self.check_num(f"D{r}", f"h_{name[i]}", st.h[i], h_expr))
            sh.yellow(r, 6, num(st.step[i]) if T else None)
            sh.mark(r, 7, self.check_num(f"F{r}", f"νh_{name[i]}", st.step[i], f"{self.nu}*D{r}"))
            sh.yellow(r, 8, num(st.f_new[i]) if T else None)
            sh.mark(r, 9, self.check_num(f"H{r}", f"F_{name[i]}", st.f_new[i], f"C{r}+F{r}"))
            sh.yellow(r, 10, num(st.r_new[i]) if T else None)
            sh.mark(r, 11, self.check_num(f"J{r}", f"rn_{name[i]}", st.r_new[i], f"L{r}-H{r}"))
            sh.given(r, 12, num(ds.y[i]), fmt=self.y_fmt)
            checks += 4
            new_f.append(f"$H${r}")
            rn_cells.append(f"J{r}")
        r += 1
        sh.label(r, 2, 9, "Σ|rᵢ| после шага")
        sh.yellow(r, 10, num(st.abs_r_new) if T else None)
        key_after = self.key.next_ref()
        sh.mark(r, 11, self.check_num(f"J{r}", "Σ|r| после", st.abs_r_new,
                                      f"SUMPRODUCT(ABS({rn_cells[0]}:{rn_cells[-1]}))"))
        checks += 1
        abs_after = f"$J${r}"

        # ---- статус шага -------------------------------------------------------------------
        blk = f"$C${start + 2}:$M${r}"
        ok = f'COUNTIF({blk},"✓")'
        err = f'COUNTIF({blk},"✗")+COUNTIF({blk},"~?")'
        sh.merge(status_row, 2, 13,
                 f'="Проверено: "&{ok}&" из {checks}   ·   ошибок: "&({err})'
                 f'&IF({abs_after}="","","   ·   Σ|r|: "&TEXT({abs_before},"0.##")&" → "&TEXT({abs_after},"0.##"))',
                 font=Font(name=FONT, size=10, bold=True, color=NAVY), bg=LIGHT, align=LEFT)
        for rr_ in range(start + 1, r + 1):
            ws.row_dimensions[rr_].outlineLevel = 1
        info = {"m": m, "start": start, "end": r, "checks": checks, "choice": ch, "abs_after": abs_after,
                "f_new": new_f, "ok": ok, "key_after": key_after}
        return info, r, new_f

    # ------------------------------------------------------------------------------------
    def _summary(self) -> None:
        ds, s, sh = self.ds, self.s, self.summ
        ws = sh.ws
        n = ds.n
        c_ok = 5 + n
        c_ref = c_ok + 1
        sh.last = c_ref if s.key else c_ok
        widths = {"A": 2, "B": 8, "C": 18, "D": 16}
        for i in range(n):
            widths[L(5 + i)] = 11
        widths[L(c_ok)] = 13
        widths[L(c_ref)] = 13
        for col, w in widths.items():
            ws.column_dimensions[col].width = w
        sh.title(2, "Сводка по вашим расчётам")
        sh.note(3, "Заполняется из листа «Расчёт». Σ|rᵢ| должна убывать; на графике видно, где модель упирается в то, "
                "что можно выучить по этим колонкам.")
        hdr = {2: "Шаг", 3: "Выбрана колонка", 4: "Σ|rᵢ| после шага", **{5 + i: f"F({ds.names[i]})" for i in range(n)},
               c_ok: "Верно в шаге"}
        if s.key:
            hdr[c_ref] = "Сверка с эталоном"
        sh.header(5, hdr)
        r0 = 6
        calc = q(CALC)
        f0 = f"{calc}{self.f0_ref}"
        sh.given(r0, 2, 0)
        sh.given(r0, 3, "— (среднее)")
        sh.cell(r0, 4, f'=IF({f0}="","",SUMPRODUCT(ABS({self.y_range}-{f0})))', fmt=NUM)
        for i in range(n):
            sh.cell(r0, 5 + i, f'=IF({f0}="","",{f0})', fmt=NUM)
        sh.cell(r0, c_ok, f'=IF({calc}$F${self.f0_ref.split("$")[-1]}="✓",1,0)', fmt='0" из 1"')
        if s.key:
            sh.cell(r0, c_ref, "", fmt="@")
        for info in self.step_rows:
            r = r0 + info["m"]
            sh.given(r, 2, info["m"])
            ch = f"{calc}{info['choice']}"
            sh.cell(r, 3, f'=IF({ch}="","",{ch})')
            ab = f"{calc}{info['abs_after']}"
            sh.cell(r, 4, f'=IF({ab}="","",{ab})', fmt=NUM)
            for i in range(n):
                fc = f"{calc}{info['f_new'][i]}"
                sh.cell(r, 5 + i, f'=IF({fc}="","",{fc})', fmt=NUM)
            blk = f"{calc}$C${info['start'] + 2}:$M${info['end']}"
            sh.cell(r, c_ok, f'=COUNTIF({blk},"✓")', fmt=f'0" из {info["checks"]}"')
            if s.key:
                sh.mark(r, c_ref, f'=IF({ab}="","",IF(ABS(ROUND({ab},2)-ROUND({info["key_after"]},2))<={TOL},"✓","✗"))')
        last = r0 + len(self.step_rows)
        sh.note(last + 1, "Пустые строки — шаги, которые ещё не посчитаны; на графике они пропускаются.")
        ws.conditional_formatting.add(f"{L(c_ok)}{r0 + 1}:{L(c_ok)}{last}",
                                      DataBarRule(start_type="num", start_value=0, end_type="num",
                                                  end_value=max(i["checks"] for i in self.step_rows) if self.step_rows else 1,
                                                  color="9DC3E6"))
        if s.key:
            for mark, ink, bg in (("✓", OK_INK, OK_BG), ("✗", BAD_INK, BAD_BG)):
                ws.conditional_formatting.add(f"{L(c_ref)}{r0}:{L(c_ref)}{last}",
                                              CellIsRule(operator="equal", formula=[f'"{mark}"'],
                                                         font=Font(color=ink, bold=True), fill=fill(bg)))

        # данные для графиков: #Н/Д вместо пустых строк (иначе Excel рисует ноль); колонки скрыты
        h0 = sh.last + 3
        ws.cell(row=5, column=h0, value="шаг")
        ws.cell(row=5, column=h0 + 1, value="Σ|rᵢ|")
        for i in range(n):
            ws.cell(row=5, column=h0 + 2 + i, value=f"F({ds.names[i]})")
        for r in range(r0, last + 1):
            ws.cell(row=r, column=h0, value=r - r0)
            ws.cell(row=r, column=h0 + 1, value=f'=IF(D{r}="",NA(),D{r})')
            for i in range(n):
                c = L(5 + i)
                ws.cell(row=r, column=h0 + 2 + i, value=f'=IF({c}{r}="",NA(),{c}{r})')
        for c in range(h0, h0 + 2 + n):
            ws.column_dimensions[L(c)].hidden = True

        cats = Reference(ws, min_col=h0, min_row=r0, max_row=last)
        ch1 = LineChart()
        ch1.title = "Σ|rᵢ| по шагам (ваши числа)"
        ch1.y_axis.title = "Σ|rᵢ|"
        ch1.x_axis.title = "шаг"
        ch1.add_data(Reference(ws, min_col=h0 + 1, min_row=5, max_row=last), titles_from_data=True)
        ch1.set_categories(cats)
        ch1.series[0].graphicalProperties.line.solidFill = TEAL
        ch1.series[0].graphicalProperties.line.width = 28000
        ch1.series[0].marker.symbol = "circle"
        ch1.series[0].marker.size = 5
        ch1.series[0].smooth = False
        ch1.legend = None
        ch2 = LineChart()
        ch2.title = "Предсказания F_m(xᵢ) (ваши числа)"
        ch2.x_axis.title = "шаг"
        ch2.add_data(Reference(ws, min_col=h0 + 2, max_col=h0 + 1 + n, min_row=5, max_row=last), titles_from_data=True)
        ch2.set_categories(cats)
        for i, ser in enumerate(ch2.series):
            ser.graphicalProperties.line.solidFill = SERIES[i % len(SERIES)]
            ser.graphicalProperties.line.width = 22000
            ser.marker.symbol = "none"
            ser.smooth = False
        lo, hi = float(min(ds.y)), float(max(ds.y))
        pad = max(1.0, (hi - lo) * 0.08)
        step = 10 ** math.floor(math.log10(max(1.0, hi - lo + 2 * pad))) / 2
        ch2.y_axis.scaling.min = math.floor((lo - pad) / step) * step
        ch2.y_axis.scaling.max = math.ceil((hi + pad) / step) * step
        ch2.legend.position = "r"
        for chart in (ch1, ch2):
            chart.width, chart.height = 18, 8
            chart.x_axis.delete = False
            chart.y_axis.delete = False
            chart.y_axis.majorGridlines.spPr = None
            chart.display_blanks = "gap"
            chart.visible_cells_only = False  # данные графиков лежат в скрытых колонках
            chart.y_axis.number_format = "General"
        ws.add_chart(ch1, f"B{last + 3}")
        ws.add_chart(ch2, f"B{last + 20}")

    # ------------------------------------------------------------------------------------
    def _finish(self) -> None:
        ds, s, wb = self.ds, self.s, self.wb
        wb.active = 0
        wb.calculation.fullCalcOnLoad = True
        wb.properties.title = texts.title(ds, s)
        wb.properties.creator = "Градиентный бустинг по косточкам — генератор тренажёров"
        wb.properties.subject = "Градиентный бустинг вручную"
        meta = [f"steps={s.steps}", f"lr={texts.dec(s.lr)}", f"mode={s.mode}", f"check={s.check}"]
        if s.seed is not None:
            meta.append(f"seed={s.seed}")
        if ds.theme:
            meta.append(f"theme={ds.theme}")
        if s.level:
            meta.append(f"level={s.level}")
        wb.properties.keywords = "; ".join(meta)
        for ws, landscape in ((self.task.ws, False), (self.calc.ws, True), (self.summ.ws, True)):
            ws.page_setup.orientation = "landscape" if landscape else "portrait"
            ws.page_setup.paperSize = ws.PAPERSIZE_A4
            ws.page_setup.fitToWidth = 1
            ws.page_setup.fitToHeight = 0
            ws.sheet_properties.pageSetUpPr.fitToPage = True
            ws.print_options.horizontalCentered = True
            ws.page_margins.left = ws.page_margins.right = 0.4
        if s.protect:
            for ws in (self.task.ws, self.calc.ws, self.summ.ws):
                ws.protection.sheet = True
                ws.protection.formatRows = False
                ws.protection.formatColumns = False
                ws.protection.selectLockedCells = False


def build_workbook(spec: Spec, solution: Solution | None = None) -> Workbook:
    return Builder(spec, solution).build()


def workbook_bytes(spec: Spec, solution: Solution | None = None) -> bytes:
    buf = io.BytesIO()
    build_workbook(spec, solution).save(buf)
    return buf.getvalue()
