"""Генератор рабочих тетрадей extra/04_trainer (пакет gbtrainer).

* Протокол ручного счёта, генерация данных по уровням, проверка входных данных, CSV/JSON, CLI.
* Пресет тетради № 7 воспроизводит её данные, ключ шага 1 и «пол» Σ|шум| = 8.
* Сюжет от ИИ-ассистента: разбор и проверка ответа модели, масштабы, ремонтный запрос, CLI --ai
  (с подставным claude-server — к Claude тест не обращается).
* Сквозной тест (если установлен LibreOffice): файл пересчитывается настоящим табличным
  процессором; эталонные ответы дают ✓ во всех ячейках, испорченные — ✗/ƒ/? там, где нужно.
"""

from __future__ import annotations

import io
import json
import shutil
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

import pytest

openpyxl = pytest.importorskip("openpyxl")

ROOT = Path(__file__).resolve().parents[2]
TRAINER = ROOT / "extra" / "04_trainer"
sys.path.insert(0, str(TRAINER))

import gbtrainer as g  # noqa: E402
from gbtrainer.model import SpecError  # noqa: E402
from gbtrainer.rng import Mulberry32 as TrainerRNG  # noqa: E402
from gbtrainer.solver import r2  # noqa: E402

PRESETS = sorted((TRAINER / "presets").glob("*.json"))
MARKS = ("✓", "✗", "ƒ", "?", "…")


def load_preset(name: str) -> g.Spec:
    return g.make_spec(data=json.loads((TRAINER / "presets" / name).read_text(encoding="utf-8")))


def workbook(spec: g.Spec):
    return openpyxl.load_workbook(io.BytesIO(g.generate(spec)))


def key_rows(wb) -> list[tuple[str, object]]:
    return [(r[0].value, r[1].value) for r in wb["Ответы"].iter_rows(min_row=3) if r[1].value is not None]


# --- ядро --------------------------------------------------------------------------------
def test_rng_matches_gbcourse() -> None:
    from gbcourse.rng import Mulberry32

    a, b = Mulberry32(2026), TrainerRNG(2026)
    assert [a.next_uint32() for _ in range(200)] == [b.next_uint32() for _ in range(200)]
    xs, ys = list(range(30)), list(range(30))
    Mulberry32(5).shuffle(xs)
    TrainerRNG(5).shuffle(ys)
    assert xs == ys


@pytest.mark.parametrize("v, want", [("0.125", "0.13"), ("-0.125", "-0.13"), ("0.124", "0.12"), ("2.005", "2.01")])
def test_rounding_is_half_away_from_zero_like_excel(v: str, want: str) -> None:
    assert r2(Decimal(v)) == Decimal(want)


def test_preset_7_reproduces_workbook_7() -> None:
    spec = load_preset("wb7_bakery.json")
    ds = spec.dataset
    assert ds.features == ("Расположение", "Выходной")
    assert [int(v) for v in ds.y] == [50, 62, 94, 114]
    sol = g.solve(ds, spec.settings.lr, spec.settings.steps)
    assert sol.f0 == 80
    st = sol.steps[0]
    assert [int(v) for v in st.grad] == [30, 18, -14, -34]
    assert st.abs_r == 96
    assert [(int(gr.sum_r), int(gr.gamma), int(gr.sse)) for gr in st.groups[:2]] == [(-48, -24, 72), (48, 24, 200)]
    assert ds.features[st.choice] == "Расположение"
    assert sol.final_abs == ds.structure.floor == 8  # «пол» тетради № 7

    wb = workbook(spec)
    assert wb.sheetnames == ["Задание", "Расчёт", "Сводка", "Ответы"]
    assert wb["Ответы"].sheet_state == "hidden"
    rows = key_rows(wb)
    assert len(rows) == 821  # столько же значений, сколько в ключе исходной тетради
    assert rows[:3] == [("F0", 80), ("g_A", 30), ("r_A", -30)]


@pytest.mark.parametrize("path", PRESETS, ids=lambda p: p.stem)
def test_presets_build(path: Path) -> None:
    spec = g.make_spec(data=json.loads(path.read_text(encoding="utf-8")))
    sol = g.solve(spec.dataset, spec.settings.lr, spec.settings.steps)
    assert sol.final_abs <= sol.abs_r0
    assert sol.final_abs >= spec.dataset.structure.floor - Decimal("0.5")
    assert workbook(spec)["Расчёт"]["E8"].value is None  # тетрадь ученика пустая


@pytest.mark.parametrize("level", sorted(g.LEVELS))
@pytest.mark.parametrize("theme", sorted(g.THEMES))
def test_random_data_for_every_level_and_theme(level: int, theme: str) -> None:
    spec = g.make_spec(level=level, theme=theme, seed=11)
    ds, lv = spec.dataset, g.LEVELS[level]
    assert ds.k == lv.features and ds.n == 2**lv.features
    assert all(v > 0 for v in ds.y)
    st = ds.structure
    assert sum(ds.y) / ds.n == st.base  # шум и вклады не сдвигают среднее: F₀ — целое
    assert len(set(st.effects)) == ds.k  # одна колонка «тяжелее» другой
    assert (st.floor > 0) == lv.noise
    sol = g.solve(ds, spec.settings.lr, spec.settings.steps)
    assert sol.final_abs < sol.abs_r0
    if level == 1:
        assert sol.steps[1].abs_r_new == 0  # ν = 1 без шума: два шага — и ноль


def test_same_seed_same_workbook_content() -> None:
    a = workbook(g.make_spec(level=4, seed=99))
    b = workbook(g.make_spec(level=4, seed=99))
    assert key_rows(a) == key_rows(b)
    assert [c.value for c in a["Задание"]["E"]] == [c.value for c in b["Задание"]["E"]]
    assert key_rows(workbook(g.make_spec(level=4, seed=100))) != key_rows(a)


def test_custom_data_and_settings() -> None:
    spec = g.make_spec(
        data={"object": "Ученик", "target": "Балл yᵢ", "features": ["Курс", "Репетитор"],
              "rows": [["Аня", "1", "нет", "61,5"], ["Борис", "1", "да", 70], ["Вика", "2", "нет", 77],
                       ["Гоша", "2", "да", 90], ["Дима", "2", "да", 88]]},
        lr="0.3", steps=7, mode="residual", check="strict",
    )
    ds, s = spec.dataset, spec.settings
    assert ds.names[0] == "Аня" and ds.y[0] == Decimal("61.5")
    assert {len(gr.members) for gr in ds.groups()} == {2, 3}  # группы разного размера
    assert s.lr == Decimal("0.3") and s.steps == 7 and s.mode == "residual"
    pv = g.preview(spec)
    assert len(pv["steps"]) == 7 and pv["checks"] == 1 + 7 * ((5 + 1) + 12 + 3 + 21)
    wb = workbook(spec)
    formulas = sum(1 for row in wb["Расчёт"].iter_rows() for c in row
                   if isinstance(c.value, str) and c.value.startswith("=IF(") and '"✓"' in c.value and "COUNTIF" not in c.value)
    assert formulas == pv["checks"]


@pytest.mark.parametrize(
    "data, settings, msg",
    [
        ({"features": ["X"], "rows": [["A", "a", 1], ["B", "b", 2], ["C", "c", 3]]}, {}, "ровно на две группы"),
        ({"features": ["X"], "rows": [["A", "a", 1], ["A", "b", 2]]}, {}, "имена объектов"),
        ({"features": ["X,Y"], "rows": [["A", "a", 1], ["B", "b", 2]]}, {}, "запятых"),
        ({"features": ["X"], "rows": [["A", "a", "1.234"], ["B", "b", 2]]}, {}, "двух знаков"),
        ({"features": ["X"], "rows": [["A", "a", "abc"], ["B", "b", 2]]}, {}, "не число"),
        ({"features": ["X"], "rows": [["A", "a", 1], ["B", "b", 2]]}, {"lr": 1.5}, "(0; 1]"),
        ({"features": ["X"], "rows": [["A", "a", 1], ["B", "b", 2]]}, {"steps": 0}, "число шагов"),
        ({"features": ["X"], "rows": [["A", "a", 1], ["B", "b", 2]]}, {"check": "strict", "key": False}, "Ответы"),
    ],
)
def test_validation_messages(data: dict, settings: dict, msg: str) -> None:
    with pytest.raises(SpecError, match=msg.replace("(", r"\(").replace(")", r"\)").replace("]", r"\]").replace("[", r"\[")):
        g.make_spec(data=data, **settings)


def test_csv_with_semicolons_and_decimal_comma() -> None:
    from gbtrainer.model import dataset_from_csv

    text = "﻿Авто;Привод;Коробка;Цена\nA;передний;механика;188,5\nB;передний;автомат;232\nC;полный;механика;352\nD;полный;автомат;428\n"
    spec = g.make_spec(data=dataset_from_csv(text))
    assert spec.dataset.object == "Авто" and spec.dataset.y[0] == Decimal("188.5")


def test_cli_batch(tmp_path: Path) -> None:
    from gbtrainer.cli import main

    assert main(["--level", "2", "--seed", "5", "--count", "3", "--out-dir", str(tmp_path), "--teacher-copy", "-q"]) == 0
    files = sorted(p.name for p in tmp_path.glob("*.xlsx"))
    assert len(files) == 6 and sum("_ответы" in f for f in files) == 3
    index = (tmp_path / "варианты.csv").read_text(encoding="utf-8-sig").splitlines()
    assert len(index) == 4 and index[1].split(";")[1] == "5"


# --- сквозной тест в LibreOffice ---------------------------------------------------------
SOFFICE = shutil.which("soffice") or shutil.which("libreoffice")


def recalc(paths: list[Path], out: Path) -> list[Path]:
    """Открыть файлы в LibreOffice и сохранить пересчитанные копии (значения формул)."""
    out.mkdir(exist_ok=True)
    subprocess.run([SOFFICE, "--headless", "--calc", "--convert-to", "xlsx", "--outdir", str(out), *map(str, paths)],
                   check=True, capture_output=True, timeout=300)
    return [out / p.name for p in paths]


def marks(ws) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {m: [] for m in MARKS}
    for row in ws.iter_rows():
        for c in row:
            if c.value in out:
                out[c.value].append(c.coordinate)
    return out


@pytest.mark.skipif(SOFFICE is None, reason="нужен LibreOffice (soffice) для пересчёта формул")
@pytest.mark.filterwarnings("ignore::UserWarning")
def test_end_to_end_in_libreoffice(tmp_path: Path) -> None:
    cases = {
        "chain_gradient": g.make_spec(level=3, theme="bakery", seed=7, teacher=True),
        "strict_residual": g.make_spec(level=4, theme="cars", seed=3, teacher=True, check="strict", mode="residual"),
        "level5": g.make_spec(level=5, seed=21, teacher=True, steps=6),
        "uneven": g.make_spec(data={"features": ["Курс", "Репетитор"], "rows": [
            ["A", "1", "нет", 61.5], ["B", "1", "да", 70], ["C", "2", "нет", 77], ["D", "2", "да", 90],
            ["E", "2", "да", 88]]}, lr=0.3, steps=6, teacher=True),
        "student": g.make_spec(level=3, seed=7),
    }
    # испорченная копия: неверный остаток, формула, неверный выбор, текст вместо числа
    spoiled = workbook(g.make_spec(level=3, theme="bakery", seed=7, teacher=True))
    ws = spoiled["Расчёт"]
    starts = {int(c.value.split(":")[0].split()[1]): c.row for c in ws["B"]
              if isinstance(c.value, str) and c.value.startswith("Шаг ") and ":" in c.value}
    r_bad = (starts[3] + 4, 7)
    ws.cell(*r_bad).value = ws.cell(*r_bad).value + 1
    f_cell = (starts[5] + 4, 5)
    ws.cell(*f_cell).value = f"=C{f_cell[0]}-D{f_cell[0]}"
    choice_row = next(c.row for c in ws["F"][starts[6]:starts[6] + 30] if c.value in ("Расположение", "Выходной"))
    ws.cell(choice_row, 6).value = "Расположение" if ws.cell(choice_row, 6).value == "Выходной" else "Выходной"
    t_cell = (starts[7] + 5, 7)
    ws.cell(*t_cell).value = "12.5x"

    paths = []
    for name, spec in cases.items():
        p = tmp_path / f"{name}.xlsx"
        p.write_bytes(g.generate(spec))
        paths.append(p)
    sp = tmp_path / "spoiled.xlsx"
    spoiled.save(sp)
    paths.append(sp)
    done = dict(zip([p.stem for p in paths], recalc(paths, tmp_path / "out")))

    for name, spec in cases.items():
        wb = openpyxl.load_workbook(done[name], data_only=True)
        calc = wb["Расчёт"]
        errors = [c.coordinate for row in calc.iter_rows() for c in row if isinstance(c.value, str) and c.value.startswith("#")]
        assert not errors, f"{name}: ошибки формул {errors[:5]}"
        m = marks(calc)
        total = g.preview(spec)["checks"]
        if name == "student":
            assert sum(len(v) for v in m.values()) == 0
            assert calc["D4"].value.startswith(f"0 из {total}")
            continue
        assert len(m["✓"]) == total and not any(m[k] for k in MARKS[1:]), f"{name}: {[(k, v[:3]) for k, v in m.items() if v]}"
        assert calc["D4"].value.startswith(f"{total} из {total} верно")
        summ = wb["Сводка"]
        ref_col = 6 + spec.dataset.n
        assert all(summ.cell(7 + i, ref_col).value == "✓" for i in range(spec.settings.steps))

    wb = openpyxl.load_workbook(done["spoiled"], data_only=True)
    m = marks(wb["Расчёт"])
    rc = lambda rc_: f"{openpyxl.utils.get_column_letter(rc_[1])}{rc_[0]}"  # noqa: E731
    assert rc((r_bad[0], r_bad[1] + 1)) in m["✗"]
    assert m["ƒ"] == [rc((f_cell[0], f_cell[1] + 1))]
    assert rc((t_cell[0], t_cell[1] + 1)) in m["?"]
    assert f"G{choice_row}" in m["✗"]


# --- страница -----------------------------------------------------------------------------
def test_bundle_is_fresh() -> None:
    """gbtrainer_bundle.js собран из текущих gbtrainer/*.py (иначе страница соберёт старую тетрадь)."""
    import runpy

    mod = runpy.run_path(str(TRAINER / "build_bundle.py"))
    assert (TRAINER / "gbtrainer_bundle.js").read_text(encoding="utf-8") == mod["render"](), \
        "бандл устарел — запустите python extra/04_trainer/build_bundle.py"


def test_web_bridge() -> None:
    import zipfile

    from gbtrainer import web

    info = json.loads(web.info())
    assert info["ok"] and len(info["levels"]) == 5 and len(info["themes"]) == len(g.THEMES)
    req = json.dumps({"source": "random", "level": 2, "theme": "rent", "seed": 4, "steps": "6", "lr": "0.5"})
    pv = json.loads(web.preview_json(req))
    assert pv["ok"] and len(pv["steps"]) == 6 and pv["dataset"]["theme"] == "rent"
    bad = json.loads(web.preview_json(json.dumps({"source": "custom", "data": {"features": ["X"], "rows": [["A", "a", 1]]}})))
    assert not bad["ok"] and "объектов" in bad["error"]
    assert web.build(req, True)[:2] == b"PK"
    assert web.build_name(req, True).endswith("_ответы.xlsx")
    z = zipfile.ZipFile(io.BytesIO(web.build_zip(req, 2)))
    assert sorted(n.split("/")[0] for n in z.namelist()) == ["варианты.csv", "ответы", "ответы", "ученикам", "ученикам"]
    spec = json.loads(web.spec_json(req))["spec"]
    assert g.make_spec(data=spec).dataset.y == g.make_spec(level=2, theme="rent", seed=4).dataset.y


# --- сюжет от ИИ-ассистента ----------------------------------------------------------------
from gbtrainer import ai  # noqa: E402

GOOD = dict(ai.EXAMPLE)


def test_ai_example_is_valid_and_builds_all_levels() -> None:
    th, notes = ai.theme_from_proposal(GOOD)
    assert th.source == "ai" and th.object == "Кофейня" and th.each == "каждой кофейне"
    assert th.base[2] > 0 and th.effect[0] >= 4 and th.noise[1] <= th.effect[0] * 0.3 + 1
    for level in sorted(g.LEVELS):
        ds = g.make_spec(level=level, seed=3, theme=th).dataset
        assert ds.object == "Кофейня" and ds.k == g.LEVELS[level].features
        assert all(v > 0 for v in ds.y) and sum(ds.y) / ds.n == ds.structure.base
    assert ai.theme_from_dict(json.loads(json.dumps(ai.theme_to_dict(th)))) == th


@pytest.mark.parametrize("typical", [40, 60, 120, 450, 2400, 5000, 20000])
@pytest.mark.parametrize("frac", [0.3, 0.8, 1.2, 3.0])
@pytest.mark.parametrize("noise", [0, 1, 0.08])
def test_ai_scale_always_feasible(typical: float, frac: float, noise: float) -> None:
    """Любой разумный масштаб даёт сюжет, годный для всех уровней; признак заметнее шума."""
    th, _ = ai.theme_from_proposal(dict(GOOD, typical=typical, spread=typical * frac, noise=noise * typical if noise < 1 else noise))
    assert th.effect[0] >= 3 * th.noise[1]


@pytest.mark.parametrize(
    "patch, msg",
    [
        ({"each": "кофейне"}, "каждому"),
        ({"features": GOOD["features"][:2]}, "ровно три признака"),
        ({"features": [{"name": "Район, город", "levels": ["a", "b"]}, *GOOD["features"][1:]]}, "без запятых"),
        ({"features": [{"name": "Район", "levels": ["да", "Да"]}, *GOOD["features"][1:]]}, "одинаковых"),
        ({"features": [GOOD["features"][0], GOOD["features"][0], GOOD["features"][2]]}, "различаться"),
        ({"title": "<script>alert(1)</script>"}, "служебные"),
        ({"object": "x" * 40}, "длиннее"),
        ({"typical": 5}, "от 40 до 5000"),
        ({"typical": "много"}, "число"),
        ({"spread": -3}, "больше нуля"),
    ],
)
def test_ai_rejects_bad_proposals(patch: dict, msg: str) -> None:
    with pytest.raises(SpecError, match=msg):
        ai.theme_from_proposal(dict(GOOD, **patch))


def test_ai_fixes_small_things_with_notes() -> None:
    th, notes = ai.theme_from_proposal(dict(GOOD, target="Выручка, тыс. ₽", spread=500, noise=40,
                                            rationale="Потому что <b>так</b>."))
    assert th.target == "Выручка yᵢ, тыс. ₽" and th.rationale == "Потому что так."
    assert any("yᵢ" in n for n in notes) and any("разброс" in n for n in notes) and any("шум" in n for n in notes)


@pytest.mark.parametrize("text", [
    json.dumps(GOOD, ensure_ascii=False),
    "Вот сюжет:\n```json\n" + json.dumps(GOOD, ensure_ascii=False) + "\n```\nУдачи!",
    "Ответ: " + json.dumps(GOOD, ensure_ascii=False) + " — готово.",
])
def test_ai_parse_reply(text: str) -> None:
    assert ai.parse_reply(text)["object"] == "Кофейня"


def test_ai_messages_and_schema() -> None:
    msgs = ai.build_messages("Пицца\x00 " + "x" * 2000, ["Кофейни — выручка"])
    assert [m["role"] for m in msgs] == ["system", "user"]
    assert "\x00" not in msgs[1]["content"] and len(msgs[1]["content"]) < 1000 and "Кофейни" in msgs[1]["content"]
    assert len(json.dumps(msgs, ensure_ascii=False)) < 22000  # лимит запроса claude-server (Windows)
    assert set(ai.AI_SCHEMA["required"]) <= set(ai.AI_SCHEMA["properties"]) and set(GOOD) == set(ai.AI_SCHEMA["properties"])
    rep = ai.repair_messages(msgs, "{плохо}", "поле each …")
    assert [m["role"] for m in rep] == ["system", "user", "assistant", "user"] and "поле each" in rep[-1]["content"]


def test_ai_web_bridge() -> None:
    from gbtrainer import web

    req = json.loads(web.ai_request(json.dumps({"description": "пицца", "avoid": ["A"]})))
    assert req["ok"] and req["schema"] == ai.AI_SCHEMA and len(req["messages"]) == 2
    acc = json.loads(web.ai_accept("```json\n" + json.dumps(GOOD, ensure_ascii=False) + "\n```"))
    assert acc["ok"] and acc["theme"]["object"] == "Кофейня"
    bad = json.loads(web.ai_accept(json.dumps(dict(GOOD, each="кофейне"), ensure_ascii=False)))
    assert not bad["ok"] and "каждому" in bad["error"]
    assert json.loads(web.theme_check(json.dumps(acc["theme"])))["ok"]
    assert not json.loads(web.theme_check(json.dumps(dict(acc["theme"], base=[0, -5, 1]))))["ok"]
    pv = json.loads(web.preview_json(json.dumps({"source": "random", "level": 5, "seed": 2, "theme_def": acc["theme"]})))
    assert pv["ok"] and pv["dataset"]["object"] == "Кофейня" and len(pv["dataset"]["rows"]) == 8
    assert "theme" not in pv["dataset"]  # сюжет ИИ описан подписями, а не ключом встроенного сюжета


class _FakeClaudeServer:
    """Подставной claude-server: /v1/chat/completions отвечает по очереди заготовленными ответами."""

    def __init__(self, replies: list[str]) -> None:
        import http.server
        import threading

        self.replies, self.bodies = list(replies), []
        outer = self

        class H(http.server.BaseHTTPRequestHandler):
            def do_POST(self) -> None:  # noqa: N802
                outer.bodies.append(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
                body = json.dumps({"choices": [{"message": {"role": "assistant", "content": outer.replies.pop(0)}}]}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *a) -> None:
                pass

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.httpd.server_address[1]}"
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def close(self) -> None:
        self.httpd.shutdown()


def test_ai_ask_server_repairs_once() -> None:
    srv = _FakeClaudeServer([json.dumps(dict(GOOD, each="кофейне"), ensure_ascii=False), json.dumps(GOOD, ensure_ascii=False)])
    try:
        th, notes, proposal = ai.ask_server("кофейни", url=srv.url + "/v1", model="haiku")
    finally:
        srv.close()
    assert th.object == "Кофейня" and proposal["each"] == "каждой кофейне"
    first, second = srv.bodies
    assert first["json_schema"] == ai.AI_SCHEMA and first["stream"] is False and first["model"] == "haiku"
    assert not {"allow_tools", "permission_mode", "cwd"} & set(first)  # инструменты Claude Code не просим
    assert [m["role"] for m in second["messages"]][-2:] == ["assistant", "user"]


def test_ai_ask_server_gives_up_and_offline() -> None:
    srv = _FakeClaudeServer(["не JSON", "опять не JSON"])
    try:
        with pytest.raises(SpecError, match="не смогла"):
            ai.ask_server("x", url=srv.url)
    finally:
        srv.close()
    with pytest.raises(SpecError, match="недоступен"):
        ai.ask_server("x", url="http://127.0.0.1:9", timeout=2)


def test_cli_ai_theme_roundtrip(tmp_path: Path) -> None:
    from gbtrainer.cli import main

    srv = _FakeClaudeServer([json.dumps(GOOD, ensure_ascii=False)])
    theme_file = tmp_path / "кофейни.json"
    try:
        assert main(["--ai", "кофейни", "--ai-url", srv.url, "--save-theme", str(theme_file), "--seed", "4",
                     "--out-dir", str(tmp_path), "-q"]) == 0
    finally:
        srv.close()
    assert json.loads(theme_file.read_text(encoding="utf-8"))["object"] == "Кофейня"
    assert main(["--theme-file", str(theme_file), "--level", "5", "--count", "2", "--out-dir", str(tmp_path / "k"), "-q"]) == 0
    wb = openpyxl.load_workbook(next((tmp_path / "k").glob("*.xlsx")))
    assert wb["Задание"]["B8"].value == "A" and wb["Задание"]["B7"].value == "Кофейня"
    assert main(["--ai", "x", "--data", str(theme_file)]) == 2
