"""Командная строка генератора тетрадей.

Примеры::

    python extra/04_trainer/generate.py                                  # уровень 3, случайный сюжет и seed
    python extra/04_trainer/generate.py --level 4 --theme cars --seed 12 --steps 15
    python extra/04_trainer/generate.py --data presets/wb7_bakery.json   # свои данные (JSON или CSV)
    python extra/04_trainer/generate.py --level 3 --count 30 --out-dir class_7b --teacher-copy
    python extra/04_trainer/generate.py --seed 12 --print-spec > my.json # данные в JSON, чтобы поправить руками
    python extra/04_trainer/generate.py --ai "время доставки пиццы" --save-theme pizza.json   # сюжет от ИИ
    python extra/04_trainer/generate.py --theme-file pizza.json --level 5 --count 25 --out-dir 9А
"""

from __future__ import annotations

import argparse
import csv
import json
import secrets
import sys
from dataclasses import replace
from pathlib import Path

from . import (
    CHECKS,
    LEVELS,
    MODES,
    THEMES,
    SpecError,
    file_name,
    generate,
    make_spec,
    preview,
    spec_to_dict,
)
from .model import MAX_STEPS


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="generate.py",
        description="Генератор рабочих тетрадей «градиентный бустинг своими руками» (.xlsx): свои или случайные "
                    "данные, любое число шагов и ν, самопроверка ✓/✗ в каждой ячейке.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Уровни:\n" + "\n".join(f"  {lv.number} — {lv.name}: {lv.about}" for lv in LEVELS.values())
               + "\n\nСюжеты: " + ", ".join(f"{k} ({t.title})" for k, t in THEMES.items()),
    )
    src = p.add_argument_group("данные")
    src.add_argument("--data", metavar="FILE", help="свои данные: JSON (см. presets/) или CSV «объект, признаки…, y»")
    src.add_argument("--level", type=int, choices=sorted(LEVELS), help="уровень сложности (по умолчанию 3)")
    src.add_argument("--theme", choices=[*THEMES, "random"], help="сюжет случайных данных (по умолчанию — по seed)")
    src.add_argument("--seed", type=int, help="seed случайных данных (одинаковый seed — одинаковая тетрадь)")
    src.add_argument("--features", type=int, choices=(1, 2, 3), help="число признаков в случайных данных")
    src.add_argument("--theme-file", metavar="FILE", help="свой сюжет случайных данных — JSON (см. --save-theme)")

    ai = p.add_argument_group("сюжет от ИИ-ассистента (нужен запущенный claude-server)")
    ai.add_argument("--ai", metavar="ОПИСАНИЕ", help='придумать сюжет по описанию, например --ai "доставка пиццы"')
    ai.add_argument("--ai-url", default="http://127.0.0.1:8137", help="адрес claude-server (по умолчанию %(default)s)")
    ai.add_argument("--ai-model", default="sonnet", choices=("opus", "sonnet", "haiku"), help="модель (%(default)s)")
    ai.add_argument("--ai-effort", default="low", choices=("low", "medium", "high"), help="сколько модель думает (%(default)s)")
    ai.add_argument("--ai-token", default=None, help="Bearer-токен сервера (по умолчанию — $CLAUDE_SERVER_TOKEN)")
    ai.add_argument("--save-theme", metavar="FILE", help="сохранить сюжет от ИИ в JSON, чтобы потом использовать --theme-file")
    noise = src.add_mutually_exclusive_group()
    noise.add_argument("--noise", dest="noise", action="store_true", default=None, help="данные с шумом")
    noise.add_argument("--no-noise", dest="noise", action="store_false", help="данные без шума")

    st = p.add_argument_group("тетрадь")
    st.add_argument("--steps", type=int, metavar=f"1..{MAX_STEPS}", help="число шагов бустинга")
    st.add_argument("--lr", metavar="ν", help="learning rate ν из (0; 1], например 0.5")
    st.add_argument("--mode", choices=MODES, help="этап A: gradient — с ∂L/∂F (тетради 5–7), residual — только остатки")
    st.add_argument("--check", choices=CHECKS,
                    help="chain (по умолчанию) — проверка по числам самого ученика; strict — по ключу, как в тетрадях 2–7")
    st.add_argument("--no-key", dest="key", action="store_false", default=None,
                    help="без скрытого листа «Ответы» (только с --check chain)")
    st.add_argument("--allow-formulas", action="store_true", default=None, help="засчитывать формулы в жёлтых ячейках")
    st.add_argument("--protect", action="store_true", default=None, help="защитить листы: менять можно только жёлтые ячейки")
    st.add_argument("--number", type=int, help="«Рабочая тетрадь № N»")
    st.add_argument("--catalog", type=int, help="«Тетрадь № N» в подзаголовке")
    st.add_argument("--title", help="свой заголовок тетради")

    out = p.add_argument_group("вывод")
    out.add_argument("-o", "--output", metavar="FILE.xlsx", help="куда сохранить (по умолчанию — имя по настройкам)")
    out.add_argument("--out-dir", metavar="DIR", default=".", help="папка для файлов (по умолчанию текущая)")
    out.add_argument("--teacher", action="store_true", help="версия для преподавателя: жёлтые ячейки заполнены ответами")
    out.add_argument("--teacher-copy", action="store_true", help="кроме тетради ученика — ещё и версию с ответами")
    out.add_argument("--count", type=int, default=1, help="сколько вариантов (seed, seed+1, …) — для класса")
    out.add_argument("--print-spec", action="store_true", help="не создавать .xlsx, а напечатать данные и настройки в JSON")
    out.add_argument("--list", action="store_true", help="показать уровни и сюжеты")
    out.add_argument("-q", "--quiet", action="store_true", help="без сводки в консоли")
    return p


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    args = _parser().parse_args(argv)
    if args.list:
        print("Уровни:")
        for lv in LEVELS.values():
            print(f"  {lv.number}. {lv.name:<15} ν = {lv.lr}, признаков {lv.features}, шагов {lv.steps}. {lv.about}")
        print("Сюжеты:")
        for k, t in THEMES.items():
            print(f"  {k:<10} {t.title} — признаки: {', '.join(f.name for f in t.features)}")
        return 0
    if args.count < 1:
        print("ошибка: --count ≥ 1", file=sys.stderr)
        return 2
    if args.count > 1 and args.output:
        print("ошибка: с --count файлы называются сами — укажите --out-dir вместо -o", file=sys.stderr)
        return 2
    if (args.ai or args.theme_file) and args.data:
        print("ошибка: --ai и --theme-file задают сюжет случайных данных — со своими данными (--data) они не нужны",
              file=sys.stderr)
        return 2
    if args.ai and args.theme_file:
        print("ошибка: укажите что-то одно — --ai или --theme-file", file=sys.stderr)
        return 2
    theme = args.theme
    if args.theme_file or args.ai:
        from .ai import ask_server, theme_from_dict, theme_to_dict

        try:
            if args.theme_file:
                theme_obj = theme_from_dict(json.loads(Path(args.theme_file).read_text(encoding="utf-8-sig")))
            else:
                import os

                if not args.quiet:
                    print(f"… спрашиваю сюжет у claude-server ({args.ai_model}): «{args.ai}»", flush=True)
                theme_obj, notes, _ = ask_server(args.ai, url=args.ai_url, model=args.ai_model, effort=args.ai_effort,
                                                 token=args.ai_token or os.environ.get("CLAUDE_SERVER_TOKEN", ""))
                if not args.quiet:
                    feats = "; ".join(f"{f.name}: {f.levels[0]} / {f.levels[1]}" for f in theme_obj.features)
                    print(f"✔ сюжет: {theme_obj.title} — {feats}")
                    if theme_obj.rationale:
                        print(f"   {theme_obj.rationale}")
                    for n in notes:
                        print(f"   · {n}")
        except (OSError, json.JSONDecodeError) as e:
            print(f"ошибка: не удалось прочитать сюжет: {e}", file=sys.stderr)
            return 2
        except SpecError as e:
            print(f"ошибка: {e}", file=sys.stderr)
            return 2
        if args.save_theme:
            Path(args.save_theme).write_text(json.dumps(theme_to_dict(theme_obj), ensure_ascii=False, indent=2),
                                             encoding="utf-8")
            if not args.quiet:
                print(f"✔ сюжет сохранён: {args.save_theme} (потом: --theme-file {args.save_theme})")
        theme = theme_obj
    if args.count > 1 and args.data:
        print("ошибка: --count — для случайных данных; со своими данными вариант один", file=sys.stderr)
        return 2

    settings = dict(steps=args.steps, lr=args.lr, mode=args.mode, check=args.check, key=args.key,
                    allow_formulas=args.allow_formulas, protect=args.protect, number=args.number,
                    catalog=args.catalog, title=args.title, teacher=args.teacher or None)
    data = None
    if args.data:
        path = Path(args.data)
        try:
            text = path.read_text(encoding="utf-8-sig")
        except OSError as e:
            print(f"ошибка: не удалось прочитать {path}: {e.strerror}", file=sys.stderr)
            return 2
        if path.suffix.lower() in (".csv", ".tsv", ".txt"):
            from .model import dataset_from_csv
            try:
                data = dataset_from_csv(text)
            except SpecError as e:
                print(f"ошибка в {path}: {e}", file=sys.stderr)
                return 2
        else:
            try:
                data = json.loads(text)
            except json.JSONDecodeError as e:
                print(f"ошибка: {path} — неверный JSON ({e.msg}, строка {e.lineno})", file=sys.stderr)
                return 2

    out_dir = Path(args.out_dir)
    index_rows = []
    seed0 = args.seed if args.seed is not None else secrets.randbelow(1_000_000)
    for v in range(args.count):
        try:
            spec = make_spec(data=data, level=args.level, theme=theme, seed=None if data else seed0 + v,
                             features=args.features, noise=args.noise, **settings)
        except SpecError as e:
            print(f"ошибка: {e}", file=sys.stderr)
            return 2
        if args.print_spec:
            print(json.dumps(spec_to_dict(spec), ensure_ascii=False, indent=2))
            continue
        out_dir.mkdir(parents=True, exist_ok=True)
        target = Path(args.output) if args.output else out_dir / file_name(spec)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(generate(spec))
        written = [target]
        if args.teacher_copy and not spec.settings.teacher:
            tspec = replace(spec, settings=replace(spec.settings, teacher=True))
            t_target = target.with_name(target.stem + "_ответы" + target.suffix)
            t_target.write_bytes(generate(tspec))
            written.append(t_target)
        pv = preview(spec)
        if not args.quiet:
            _report(spec, pv, written)
        ds = spec.dataset
        index_rows.append([target.name, spec.settings.seed if spec.settings.seed is not None else "", ds.theme or "",
                           spec.settings.level or "", str(spec.settings.lr), spec.settings.steps,
                           "; ".join(f"{ds.names[i]}={pv['dataset']['rows'][i][-1]}" for i in range(ds.n)),
                           pv["steps"][-1]["abs"] if pv["steps"] else pv["abs0"], pv["floor"] if pv["floor"] is not None else ""])
    if args.count > 1 and not args.print_spec:
        idx = out_dir / "варианты.csv"
        with idx.open("w", encoding="utf-8-sig", newline="") as fh:
            w = csv.writer(fh, delimiter=";")
            w.writerow(["файл", "seed", "сюжет", "уровень", "ν", "шагов", "данные y", "Σ|r| в конце", "пол Σ|шум|"])
            w.writerows(index_rows)
        if not args.quiet:
            print(f"\nСписок вариантов: {idx}")
    return 0


def _report(spec, pv, written) -> None:
    ds, s = spec.dataset, spec.settings
    for path in written:
        print(f"✔ {path}")
    head = [ds.object, *ds.features, "y"]
    rows = [[ds.names[i], *ds.x[i], str(pv["dataset"]["rows"][i][-1])] for i in range(ds.n)]
    w = [max(len(str(r[c])) for r in [head, *rows]) for c in range(len(head))]
    for r in [head, *rows]:
        print("   " + "  ".join(str(v).ljust(w[c]) for c, v in enumerate(r)))
    seq = " → ".join(f"{v['abs']:g}" for v in pv["steps"][:8]) + (" → …" if len(pv["steps"]) > 8 else "")
    meta = [f"ν = {s.lr}", f"шагов {s.steps}", f"этап A: {'градиент' if s.mode == 'gradient' else 'остатки'}",
            f"проверка: {'по цепочке' if s.check == 'chain' else 'строгая'}", f"проверок {pv['checks']}"]
    if s.seed is not None:
        meta.append(f"seed {s.seed}")
    print("   " + " · ".join(meta))
    print(f"   F₀ = {pv['f0']:g}; Σ|r|: {pv['abs0']:g} → {seq}" +
          (f"; пол Σ|шум| = {pv['floor']}" if pv["floor"] else ""))
    for wmsg in pv["warnings"]:
        print(f"   ! {wmsg}")


if __name__ == "__main__":
    raise SystemExit(main())
