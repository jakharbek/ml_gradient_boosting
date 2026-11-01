"""Тексты тетради: заголовки, порядок действий, шпаргалка, подсказки — по данным и настройкам."""

from __future__ import annotations

from decimal import Decimal

from .model import LEVELS, Dataset, Settings
from .solver import Solution

GEN = {2: "двух", 3: "трёх", 4: "четырёх", 5: "пяти", 6: "шести", 7: "семи", 8: "восьми", 9: "девяти",
       10: "десяти", 11: "одиннадцати", 12: "двенадцати", 13: "тринадцати", 14: "четырнадцати",
       15: "пятнадцати", 16: "шестнадцати"}


def plural(n: int, forms: tuple[str, str, str]) -> str:
    n = abs(n)
    if n % 10 == 1 and n % 100 != 11:
        return forms[0]
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return forms[1]
    return forms[2]


def steps_word(n: int) -> str:
    return f"{n} {plural(n, ('шаг', 'шага', 'шагов'))}"


def dec(v: Decimal) -> str:
    """0.50 → «0.5», 3.00 → «3» (точка — как в исходных тетрадях)."""
    s = format(v.normalize(), "f")
    return s


def quote_list(items: list[str] | tuple[str, ...], last: str = "или") -> str:
    q = [f"«{x}»" for x in items]
    return q[0] if len(q) == 1 else ", ".join(q[:-1]) + f" {last} " + q[-1]


def members(ds: Dataset, idx: tuple[int, ...]) -> str:
    return ", ".join(ds.names[i] for i in idx)


def group_size_text(ds: Dataset) -> tuple[str, str]:
    """(«γ = сумма / 2», «(r₁ − γ)² + (r₂ − γ)²») — или общий вид, если группы разного размера."""
    sizes = {len(g.members) for g in ds.groups()}
    if len(sizes) == 1:
        s = sizes.pop()
        sub = "₀₁₂₃₄₅₆₇₈₉"
        def ix(i: int) -> str:
            return "".join(sub[int(c)] for c in str(i))
        if s == 1:
            sse = "(r₁ − γ)²"
        elif s <= 3:
            sse = " + ".join(f"(r{ix(i)} − γ)²" for i in range(1, s + 1))
        else:
            sse = f"(r₁ − γ)² + … + (r{ix(s)} − γ)²"
        return f"γ = сумма / {s}", sse
    return "γ = сумма / |G| (|G| — число объектов в группе)", "Σ (rᵢ − γ)² по объектам группы"


def title(ds: Dataset, s: Settings) -> str:
    if s.title:
        return s.title
    no = f" № {s.number}" if s.number else ""
    return f"Рабочая тетрадь{no}: градиентный бустинг с learning rate — {steps_word(s.steps)} своими руками"


def about(ds: Dataset, s: Settings) -> str:
    parts = []
    head = []
    if s.catalog:
        head.append(f"Тетрадь № {s.catalog}")
    if s.level:
        head.append(f"уровень {s.level} из {len(LEVELS)}")
    if head:
        h = ", ".join(head)
        parts.append(h[0].upper() + h[1:] + ".")
    lv = LEVELS.get(s.level) if s.level else None
    if lv and s.lr == lv.lr and ds.structure is not None and (ds.structure.floor > 0) == lv.noise:
        parts.append(lv.about)
    else:
        noise = ""
        if ds.structure is not None:
            noise = " Данные с шумом: часть значения не объясняется ни одной колонкой — ошибка упрётся в пол." \
                if ds.structure.floor else " Данные без шума."
        parts.append(f"ν = {dec(s.lr)}.{noise}")
    parts.append("Вы считаете каждый шаг сами на листе «Расчёт»; рядом с каждой жёлтой ячейкой появляется ✓ или ✗. "
                 "Лист «Сводка» и графики заполняются по мере вашей работы.")
    return " ".join(parts)


def checking(s: Settings) -> list[str]:
    if s.check == "chain":
        mode = ("Проверка «по цепочке». Каждое число сверяется с тем, что должно получиться из ВАШИХ же предыдущих чисел: "
                "ошибка даёт ✗ ровно там, где она сделана, а дальнейшие шаги, верно посчитанные от неё, получают ✓ — "
                "как у учителя, который засчитывает метод. ")
        mode += ("Колонка «Сверка с эталоном» на листе «Сводка» покажет, с какого шага ваш путь разошёлся с эталонным."
                 if s.key else "Эталонных ответов в файле нет — подсмотреть нечего.")
    else:
        mode = ("Строгая проверка. Каждое число сверяется с ключом (лист «Ответы» скрыт). Старое предсказание "
                "следующего шага берётся из ВАШЕГО ответа: ошибка в шаге m потянет ✗ в шаге m+1 — так и на бумаге.")
    marks = "Отметки: ✓ — верно с точностью до сотой; ✗ — неверно; "
    if not s.allow_formulas:
        marks += "ƒ — в ячейке формула, она не засчитывается: посчитайте сами и впишите число; "
    marks += ("? — не число (проверьте десятичный разделитель) или название колонки не из списка; "
              "… — выбор колонки проверяется, когда заполнены все суммы этапа B.")
    return [mode, marks]


def procedure(ds: Dataset, s: Settings, sol: Solution) -> list[str]:
    nu = dec(s.lr)
    n = ds.n
    mean_of = f"среднее {GEN.get(n, str(n))} значений" if n in GEN else f"среднее {n} значений"
    gamma_t, sse_t = group_size_text(ds)
    split = []
    for j, f in enumerate(ds.features):
        gs = [g for g in ds.groups() if g.feature == j]
        split.append(f"колонка «{f}» — на {{{members(ds, gs[0].members)}}} и {{{members(ds, gs[1].members)}}}")
    split_t = "; ".join(split)
    split_t = split_t[0].upper() + split_t[1:]
    if s.mode == "gradient":
        a = (f"A. Градиент → остатки. Сначала частная производная потери по предсказанию: ∂L/∂Fᵢ = F_{{m−1}}(xᵢ) − yᵢ "
             f"(знак «+» — предсказание завышено, ошибка растёт при его увеличении). Затем антиградиент "
             f"rᵢ = −∂L/∂Fᵢ = yᵢ − F_{{m−1}}(xᵢ) — это остаток. На шаге 1 F₀ — {mean_of}. Посчитайте также Σ|rᵢ|.")
        d = (f"D. Шаг градиентного спуска. {ds.each[0].upper() + ds.each[1:]} — γ своей группы в выбранной колонке "
             f"(это h_m ≈ −∂L/∂F: дерево приближает антиградиент). Шаг = ν·h_m = {nu}·h_m; новое предсказание "
             f"F_m = F_{{m−1}} + ν·h_m — то же, что F_{{m−1}} − ν·∂L/∂F. Новый остаток yᵢ − F_m и Σ|rᵢ| после шага.")
    else:
        a = (f"A. Остатки. Для каждого объекта: rᵢ = yᵢ − F_{{m−1}}(xᵢ). На шаге 1 F₀ — {mean_of}. "
             f"Посчитайте также Σ|rᵢ| — сумму модулей.")
        d = (f"D. Обновление. {ds.each[0].upper() + ds.each[1:]} — γ своей группы в выбранной колонке (это h_m). "
             f"Затем ν·h_m = {nu}·h_m, новое предсказание F_m = F_{{m−1}} + ν·h_m, новый остаток yᵢ − F_m. "
             f"И Σ|rᵢ| после шага.")
    b = (f"B. Группировка. {split_t}. Для каждой группы: сумма остатков → поправка {gamma_t} → "
         f"остаток ошибки {sse_t}.")
    c = (f"C. Выбор. Для каждой колонки сложите остатки ошибки её групп. Впишите название колонки с меньшей суммой: "
         f"{quote_list(ds.features)}. При равенстве — ту, что выше в списке.")
    sums = [st.abs_r_new for st in sol.steps]
    monotone = all(b2 <= a2 for a2, b2 in zip([sol.abs_r0, *sums], sums))
    st = ds.structure
    if st is not None and st.floor:
        ctrl = "Самоконтроль. Σ|rᵢ| убывает, но до нуля не дойдёт. Подумайте заранее, чему равен пол: это Σ|шум|."
    elif st is not None:
        ctrl = "Самоконтроль. Σ|rᵢ| убывает к нулю: шума нет, обе колонки объясняют всё."
    elif monotone:
        ctrl = "Самоконтроль. Σ|rᵢ| не растёт от шага к шагу."
    else:
        ctrl = "Самоконтроль. Сумма квадратов остатков убывает на каждом шаге; Σ|rᵢ| — почти всегда."
    ctrl += (" Каждое вписанное число округляйте до сотых (0,005 — от нуля: 0,125 → 0,13) и дальше считайте с ним — "
             "ответы сверяются с точностью до сотой.")
    if s.check == "strict":
        near = sol.near_ties()
        if near:
            ctrl += (f" Внимание: на {plural(len(near), ('шаге', 'шагах', 'шагах'))} {', '.join(map(str, near))} "
                     f"суммы колонок почти равны — считайте их особенно аккуратно.")
    return [a, b, c, d, ctrl]


def gradient_block(ds: Dataset, s: Settings) -> list[tuple[str, str]]:
    n = ds.n
    preds = ", ".join(f"F({x})" for x in ds.names) if n <= 6 else f"F({ds.names[0]}), …, F({ds.names[-1]})"
    cnt = GEN.get(n, str(n))
    cnt = {"двух": "два", "трёх": "три", "четырёх": "четыре", "пяти": "пять", "шести": "шесть", "семи": "семь",
           "восьми": "восемь"}.get(cnt, str(n))
    return [
        ("L = ½ Σᵢ (yᵢ − Fᵢ)²", f"функция потерь; переменные — {cnt} предсказания {preds}" if n <= 4
         else f"функция потерь; переменные — {n} предсказаний {preds}"),
        ("∂L/∂Fᵢ = Fᵢ − yᵢ", "частная производная по одному предсказанию (остальные заморожены) — ГРАДИЕНТ"),
        ("rᵢ = −∂L/∂Fᵢ = yᵢ − Fᵢ", "антиградиент = остаток: куда и насколько двигать предсказание, чтобы потеря упала"),
        ("h_m ≈ −∇L", "дерево (B, C) приближает антиградиент: одно число на группу — среднее остатков"),
        ("F_m = F_{m−1} + ν·h_m  ⇔  F − ν·∇L", "шаг спуска: против градиента, на долю ν"),
    ]


def cheatsheet(s: Settings) -> list[tuple[str, str]]:
    rows = []
    if s.mode == "gradient":
        rows.append(("∂L/∂Fᵢ = F_{m−1}(xᵢ) − yᵢ", "градиент потери по предсказанию: знак — куда ошибка растёт"))
    rows += [
        ("rᵢ = yᵢ − F_{m−1}(xᵢ)", "остаток: что модель ещё не выучила (антиградиент квадратичной потери)"),
        ("γ_G = (Σ_{i∈G} rᵢ) / |G|", "поправка группы: среднее остатков минимизирует Σ(rᵢ − γ)²"),
        ("j* = argmin_j Σ_G Σ_{i∈G}(rᵢ − γ_G)²", "выбираем колонку, после которой ошибки остаётся меньше"),
        ("F_m(xᵢ) = F_{m−1}(xᵢ) + ν·h_m(xᵢ)", "прибавляем долю ν поправки; невыученная часть умножается на (1 − ν)"),
    ]
    return rows


def hint(ds: Dataset, s: Settings) -> str:
    st = ds.structure
    feats = " + ".join(f"вклад признака «{f}»" for f in ds.features)
    if ds.k == 1:
        heavy = "Колонка одна — модель берёт её на каждом шаге"
    else:
        heavy = f"Одна колонка «весит» больше {'другой' if ds.k == 2 else 'других'} — её модель возьмёт первой"
    if st is None:
        return ("Начните с шага 0: среднее — лучшая модель-константа для квадратичной потери. Дальше каждый шаг — одни и "
                "те же четыре этапа A–D. Следите за Σ|rᵢ| на листе «Сводка»: по её графику видно, когда модель "
                "выучила всё, что можно выучить по этим колонкам.")
    if st.floor:
        return (f"Устройство данных: {ds.quantity} = база + {feats} + небольшой шум, который не объясняется ни одной "
                f"колонкой. {heavy}; сколько шагов подряд, зависит от ν и от соотношения вкладов. Когда все колонки «доедены», Σ|rᵢ| остановится на уровне Σ|шум| — "
                f"посчитайте, чему он равен, когда дойдёте.")
    extra = " С ν = 1 каждая колонка «доедается» целиком за один шаг." if s.lr == 1 else (
        f" С ν = {dec(s.lr)} каждый шаг забирает только долю ν того, что осталось, — поэтому одна и та же колонка "
        f"может выбираться несколько раз подряд.")
    return (f"Устройство данных: {ds.quantity} = база + {feats} — ровно, без шума. {heavy}.{extra} "
            f"Подумайте заранее: к чему стремится Σ|rᵢ|?")
