# -*- coding: utf-8 -*-
"""Генерирует ноутбук, где каждый из 20 шагов бустинга развёрнут в отдельные ячейки:
пояснение → этап A → B → C → D → график шага. Числа в пояснениях посчитаны здесь же."""
import numpy as np, nbformat as nbf

names = ["A", "B", "C", "D"]
y = np.array([820, 880, 1120, 1180], float)
FEAT = {"экран": np.array(['13"', '13"', '15"', '15"']), "ssd": np.array(["256", "512", "256", "512"])}
GL = {"экран": {'13"': '13"', '15"': '15"'}, "ssd": {"256": "256 ГБ", "512": "512 ГБ"}}
LR, N = 0.5, 20

def f2(v):
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return "0" if s in ("", "-0") else s
def sg(v): return f"({f2(v)})" if v < 0 else f2(v)

def fit(r, vals):
    corr = np.zeros(4); groups = {}
    for g in dict.fromkeys(vals):
        idx = np.where(vals == g)[0]; gamma = r[idx].mean(); corr[idx] = gamma
        groups[g] = dict(idx=idx, members=[names[i] for i in idx], sum=r[idx].sum(), n=len(idx), gamma=gamma, sse=((r[idx]-gamma)**2).sum())
    return corr, groups, ((r-corr)**2).sum()

nb = nbf.v4.new_notebook()
cells = []
md = lambda s: cells.append(nbf.v4.new_markdown_cell(s))
code = lambda s: cells.append(nbf.v4.new_code_cell(s))

md(r"""# Градиентный бустинг с learning rate: 20 шагов, каждый — отдельно

Тот же пример с четырьмя ноутбуками, что в Excel и на веб-странице урока. Отличие этого ноутбука: **ни одного цикла по шагам**.
Каждый шаг $m = 1,\dots,20$ развёрнут в собственные ячейки — пояснение, четыре этапа с таблицами-доказательствами и график шага, —
чтобы любую строку можно было выполнить, изменить и проверить руками.

| Этап | Что считаем | Формула | Основание |
|---|---|---|---|
| **A** | остатки | $r_i = y_i - F_{m-1}(x_i)$ | остаток = $-\partial L/\partial F$ при $L=\tfrac12(y-F)^2$ — антиградиент потери |
| **B** | поправки групп | $\gamma_G = \frac{1}{\lvert G\rvert}\sum_{i\in G} r_i$ | среднее минимизирует $\sum_{i\in G}(r_i-\gamma)^2$ |
| **C** | выбор колонки | $j^*=\arg\min_j \sum_{G\in j}\sum_{i\in G}(r_i-\gamma_G)^2$ | берём колонку, после которой ошибки остаётся меньше всего |
| **D** | обновление | $F_m(x_i)=F_{m-1}(x_i)+\nu\,h_m(x_i)$ | $\nu<1$ — неполный шаг, регуляризация Фридмана |

Библиотеки: только `numpy`, `pandas`, `matplotlib`.""")

code(r'''import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from IPython.display import display, Markdown

plt.rcParams.update({"figure.dpi": 110, "axes.grid": True, "grid.alpha": 0.3,
                     "axes.spines.top": False, "axes.spines.right": False, "font.size": 10})
C_SCREEN, C_SSD, C_TRUE, C_PRED, C_GREY = "#2E75B6", "#E07B2A", "#595959", "#1B7F4B", "#B0B0B0"

names = ["A", "B", "C", "D"]
df = pd.DataFrame({"экран": ['13"', '13"', '15"', '15"'], "ssd": ["256", "512", "256", "512"],
                   "цена": [820, 880, 1120, 1180]}, index=pd.Index(names, name="ноутбук"))
y = df["цена"].to_numpy(dtype=float)
FEATURES = {"экран": df["экран"].to_numpy(), "ssd": df["ssd"].to_numpy()}
LR = 0.5          # learning rate ν
df''')

md(r"""## Вспомогательные функции

Каждая функция — ровно один этап. Они не считают «весь бустинг», а только оформляют одно действие, которое ниже вызывается на каждом шаге явно.""")

code(r'''def stage_A(F_prev, m):
    """A. Остатки: r = y − F_{m−1}. Возвращает r и таблицу."""
    r = y - F_prev
    t = pd.DataFrame({f"F_{m-1}(x)": F_prev, "y": y, "r = y − F": r, "|r|": np.abs(r)}, index=df.index)
    return r, t.round(4)

def stage_B(r):
    """B. Для каждой колонки: группы, сумма остатков, γ_G = среднее, остаток ошибки в группе."""
    rows, result = [], {}
    for col, vals in FEATURES.items():
        corr = np.zeros(4); groups = {}
        for g in dict.fromkeys(vals):
            idx = np.where(vals == g)[0]; gamma = r[idx].mean(); corr[idx] = gamma
            sse = ((r[idx] - gamma) ** 2).sum()
            groups[g] = gamma
            rows.append({"колонка": col, "группа": g, "состав": ", ".join(names[i] for i in idx),
                         "Σ r": r[idx].sum(), "|G|": len(idx), "γ_G = Σr/|G|": gamma, "остаётся Σ(r−γ)²": sse})
        result[col] = dict(corr=corr, groups=groups, sse=((r - corr) ** 2).sum())
    return result, pd.DataFrame(rows).set_index(["колонка", "группа"]).round(4)

def stage_C(cands):
    """C. Выбор колонки с наименьшей оставшейся суммой квадратов."""
    best = min(cands, key=lambda k: cands[k]["sse"])
    t = pd.DataFrame({"остаётся Σ(r−γ)²": {k: v["sse"] for k, v in cands.items()}}).round(4)
    t["выбор"] = ["◀ выбрана" if k == best else "" for k in t.index]
    return best, t

def stage_D(F_prev, h, lr, m, best):
    """D. F_m = F_{m−1} + ν·h_m, новые остатки."""
    F_new = F_prev + lr * h
    r_new = y - F_new
    t = pd.DataFrame({f"F_{m-1}(x)": F_prev, f"h_{m} по «{best}»": h, f"ν·h_{m}": lr * h, f"F_{m}(x)": F_new,
                      "y": y, "новый r": r_new, "|r|": np.abs(r_new), "r²": r_new ** 2}, index=df.index)
    return F_new, r_new, t.round(4)

def plot_step(m, F_prev, F_new, r_prev, r_new, best, cands):
    """График шага: остатки до/после, предсказания до/после против реальных, сумма квадратов кандидатов."""
    fig, (a1, a2, a3) = plt.subplots(1, 3, figsize=(13, 3.4))
    x = np.arange(4); w = 0.36
    a1.bar(x - w/2, r_prev, w, color=C_GREY, label=f"до шага (Σ|r|={np.abs(r_prev).sum():g})")
    a1.bar(x + w/2, r_new, w, color=C_PRED, label=f"после (Σ|r|={np.abs(r_new).sum():g})")
    a1.axhline(0, color=C_TRUE, lw=1); a1.set_xticks(x, names); a1.set_title(f"Шаг {m}: остатки rᵢ до и после")
    a1.legend(fontsize=8)
    a2.scatter(x, y, color="black", zorder=5, label="реальная y")
    a2.plot(x, F_prev, "o--", color=C_GREY, label=f"F_{m-1}")
    a2.plot(x, F_new, "o-", color=C_SCREEN if best == "экран" else C_SSD, label=f"F_{m} (+ν·h по «{best}»)")
    for i in range(4):
        a2.annotate("", (x[i], F_new[i]), (x[i], F_prev[i]), arrowprops=dict(arrowstyle="->", color=C_PRED, lw=1.2))
    a2.set_xticks(x, names); a2.set_title("Предсказания: куда сдвинулись"); a2.legend(fontsize=8)
    cols = list(cands); vals = [cands[c]["sse"] for c in cols]
    a3.bar(cols, vals, color=[C_SCREEN if c == "экран" else C_SSD for c in cols])
    for i, v in enumerate(vals):
        a3.text(i, v, f"{v:g}", ha="center", va="bottom", fontsize=9)
    a3.set_title("Этап C: остаток ошибки по кандидатам"); a3.set_ylabel("Σ(r−γ)²")
    if best in cols:
        a3.get_xticklabels()[cols.index(best)].set_fontweight("bold")
    plt.tight_layout(); plt.show()''')

md(r"""## Шаг 0 — стартовое предсказание $F_0$

Пока признаков нет, модель — одно число $c$. Минимизируем $S(c)=\sum_i (y_i-c)^2$:
$\frac{dS}{dc}=-2\sum_i (y_i-c)=0 \Rightarrow c=\bar y$. Среднее — не договорённость, а решение задачи минимизации.""")
code(r'''F0 = np.full(4, y.mean())
print(f"F0 = ({' + '.join(f'{v:g}' for v in y)}) / 4 = {F0[0]:g}")
r0 = y - F0
display(pd.DataFrame({"F_0": F0, "y": y, "r_0 = y − F_0": r0, "|r_0|": np.abs(r0)}, index=df.index))
print(f"Σ|r| = {np.abs(r0).sum():g},  Σr² = {(r0**2).sum():g}")

cs = np.linspace(800, 1200, 401); S = [((y - c) ** 2).sum() for c in cs]
fig, ax = plt.subplots(figsize=(6.5, 3))
ax.plot(cs, S, color=C_PRED, lw=2); ax.axvline(F0[0], color=C_TRUE, ls="--", lw=1)
ax.set_xlabel("c — одно предсказание для всех"); ax.set_ylabel("S(c) = Σ(yᵢ − c)²"); ax.set_title("Минимум суммы квадратов — в среднем")
plt.show()''')

# ------------------- 20 explicit steps -------------------
F = np.full(4, y.mean())
summary_rows = []
for m in range(1, N + 1):
    r = y - F
    cands = {k: fit(r, v) for k, v in FEAT.items()}
    best = min(cands, key=lambda k: cands[k][2]); other = "ssd" if best == "экран" else "экран"
    h = cands[best][0]; Fn = F + LR * h; rn = y - Fn
    sa0, ss0, sa1, ss1 = np.abs(r).sum(), (r**2).sum(), np.abs(rn).sum(), (rn**2).sum()
    hmax = np.abs(h).max(); left = (1 - LR) * hmax
    ratio = cands[other][2] / cands[best][2] if cands[best][2] > 0 else None
    summary_rows.append((m, best, sa1, ss1))

    md(f"""## Шаг {m}:  $F_{{{m}}} = F_{{{m-1}}} + \\nu\\,h_{{{m}}}$,  $\\nu = {LR}$

**Где мы.** После шага {m-1} сумма модулей ошибок $\\sum|r_i| = {f2(sa0)}$, сумма квадратов $\\sum r_i^2 = {f2(ss0)}$.
На этом шаге модель {'снова ' if m > 1 and summary_rows[-2][1] == best else ''}выберет колонку **«{best}»**{f' — её невыученный вклад {f2(hmax)} больше вклада другой колонки' if m > 1 else ''}.""")

    # A
    md(f"""### {m}.A — Остатки текущей модели $F_{{{m-1}}}$

$r_i = y_i - F_{{{m-1}}}(x_i)$ — антиградиент квадратичной потери: $-\\partial L/\\partial F = y - F$. Это «что модель ещё не выучила»; минус — завысили, плюс — занизили.

""" + "  \n".join(f"$r_{n} = {f2(y[i])} - {f2(F[i])} = {f2(r[i])}$" for i, n in enumerate(names)) + f"""

Проверка: $\\sum|r_i| = {' + '.join(f2(abs(v)) for v in r)} = {f2(sa0)}$.""")
    code(f"r{m}, tA = stage_A(F{m-1}, m={m})\ndisplay(tA)\nprint(f\"Σ|r| = {{np.abs(r{m}).sum():g}},  Σr² = {{(r{m}**2).sum():g}}\")")

    # B
    lines = []
    for col in ("экран", "ssd"):
        for g, G in cands[col][1].items():
            i1, i2 = G["idx"]
            lines.append(f"- **{col} {GL[col][g]}** = {{{', '.join(G['members'])}}}: $\\gamma = ({sg(r[i1])} + {sg(r[i2])})/2 = {f2(G['gamma'])}$; "
                         f"остаётся $({sg(r[i1])} - {sg(G['gamma'])})^2 + ({sg(r[i2])} - {sg(G['gamma'])})^2 = {f2(G['sse'])}$")
    md(f"""### {m}.B — Группировка по колонкам и поправки групп

Каждая колонка делит объекты на две группы, группа получает одно число $\\gamma_G$. Лучшее такое число для квадратичной потери — среднее остатков группы:
$\\gamma_G = \\arg\\min_\\gamma \\sum_{{i\\in G}}(r_i-\\gamma)^2 = \\frac{{1}}{{|G|}}\\sum_{{i\\in G}} r_i$.
Группируем по признаку, а не по остаткам: признак известен у любого нового объекта, остаток — нет.

""" + "\n".join(lines))
    code(f"cands{m}, tB = stage_B(r{m})\ndisplay(tB)")

    # C
    md(f"""### {m}.C — Выбор колонки

Складываем ошибку, оставшуюся в обеих группах каждой колонки, и берём минимум:
экран: ${' + '.join(f2(G['sse']) for G in cands['экран'][1].values())} = {f2(cands['экран'][2])}$;
SSD: ${' + '.join(f2(G['sse']) for G in cands['ssd'][1].values())} = {f2(cands['ssd'][2])}$.

Минимум у **«{best}»**{f' — в {f2(round(ratio, 2))} раза меньше' if ratio and ratio > 1 else ''}. Значит $h_{{{m}}}$ строится по этой колонке: каждому объекту достаётся $\\gamma$ его группы.""")
    code(f"best{m}, tC = stage_C(cands{m})\ndisplay(tC)\nh{m} = cands{m}[best{m}][\"corr\"]\nprint(\"h_{m} =\", dict(zip(names, h{m}.round(4).tolist())))")

    # D
    md(f"""### {m}.D — Обновление модели с $\\nu = {LR}$

$F_{{{m}}}(x_i) = F_{{{m-1}}}(x_i) + \\nu\\,h_{{{m}}}(x_i)$ — прибавляем только долю поправки.

""" + "  \n".join(f"$F_{{{m}}}({n}) = {f2(F[i])} + {LR}\\cdot{sg(h[i])} = {f2(Fn[i])}$, новый остаток ${f2(y[i])} - {f2(Fn[i])} = {f2(rn[i])}$" for i, n in enumerate(names)) + f"""

**Итог шага {m}:** $\\sum|r_i| = {f2(sa1)}$ (было {f2(sa0)}), $\\sum r_i^2 = {f2(ss1)}$ (было {f2(ss0)}).
Невыученная часть вклада колонки «{best}» умножилась на $(1-\\nu) = {f2(1-LR)}$: из {f2(hmax)} осталось {f2(left)}
— на следующем шаге эта колонка выиграет, только если {f2(left)} всё ещё больше невыученного вклада другой колонки.""")
    code(f"F{m}, r{m}_new, tD = stage_D(F{m-1}, h{m}, LR, m={m}, best=best{m})\ndisplay(tD)\n"
         f"print(f\"Σ|r| = {{np.abs(r{m}_new).sum():g}} (было {{np.abs(r{m}).sum():g}}),  Σr² = {{(r{m}_new**2).sum():g}}\")\n"
         f"plot_step({m}, F{m-1}, F{m}, r{m}, r{m}_new, best{m}, cands{m})")
    F = Fn

# ------------------- summary -------------------
md(r"""## Сводка по 20 шагам

Ни одной новой величины — только то, что уже посчитано выше, собранное в одну таблицу и три графика.""")
code("hist_F = [" + ", ".join(f"F{m}" for m in range(0, N+1)) + "]\n"
     "hist_best = ['—', " + ", ".join(f"best{m}" for m in range(1, N+1)) + "]\n"
     "hist_abs = [np.abs(y - F).sum() for F in hist_F]\n"
     "hist_sq = [((y - F) ** 2).sum() for F in hist_F]\n"
     "summary = pd.DataFrame({'выбрана колонка': hist_best, 'Σ|r|': np.round(hist_abs, 4), 'Σr²': np.round(hist_sq, 4),\n"
     "                        **{f'F({n})': [round(F[i], 2) for F in hist_F] for i, n in enumerate(names)}})\n"
     "summary.index.name = 'шаг'\nsummary")
code(r'''steps = np.arange(len(hist_F)); Fs = np.array(hist_F)
fig, axes = plt.subplots(1, 3, figsize=(14, 3.6))
cols = [C_SCREEN, C_SSD, C_PRED, "#C0392B"]
for i, n in enumerate(names):
    axes[0].plot(steps, Fs[:, i], marker="o", ms=3, lw=1.5, color=cols[i], label=f"F(x_{n})")
    axes[0].axhline(y[i], color=C_TRUE, ls=":", lw=1)
axes[0].set_title("Предсказания сходятся к реальным ценам"); axes[0].set_xlabel("шаг m"); axes[0].legend(fontsize=8)
for m in range(1, len(hist_F)):
    axes[1].bar(m, LR * np.abs(hist_F[m] - hist_F[m-1]).max(), color=C_SCREEN if hist_best[m] == "экран" else C_SSD)
axes[1].set_title("Какая колонка выбрана и размер поправки |ν·h|"); axes[1].set_xlabel("шаг m")
axes[2].semilogy(steps, hist_abs, marker="o", ms=3, color=C_PRED, lw=2)
axes[2].set_title("Σ|rᵢ| в лог-шкале: прямая = геометрическое убывание"); axes[2].set_xlabel("шаг m")
plt.tight_layout(); plt.show()''')

md(r"""## Что видно из двадцати шагов

1. **Шаги 1–3 — экран.** Его невыученный вклад 150 → 75 → 37.5 → 18.75 больше вклада SSD (30), и критерий C трижды выбирает экран.
2. **Шаг 4 — первое переключение.** 18.75 < 30: SSD объясняет больше, модель берёт его.
3. **Шаги 5–20 — чередование.** После каждого шага «проигравшая» колонка оказывается с большим невыученным куском, и они сменяют друг друга по очереди; обе величины убывают геометрически.
4. **Ошибка не обнуляется.** На 20-м шаге $\sum|r_i| \approx 0.29$: каждый шаг умножает её на $(1-\nu)$, и ни при каком конечном числе шагов множитель не становится нулём. Это свойство, а не недостаток — модель можно остановить в любой момент.
5. **Итоговая модель — сумма.** $F_{20}=F_0+\nu h_1+\dots+\nu h_{20}$: вклады шагов «экран» в сумме дают ±150, «SSD» — ±30. За двадцать осторожных шагов модель собрала те же две поправки, что при $\nu=1$ нашла за два.

**Что дальше:** зачем вообще нужен медленный шаг — валидация, переобучение и ранняя остановка.""")

nb["cells"] = cells
nb["metadata"] = {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                  "language_info": {"name": "python"}}
nbf.write(nb, "notebook.ipynb")
print("cells:", len(cells))
