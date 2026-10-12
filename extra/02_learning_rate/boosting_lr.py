# %% [markdown]
# # Градиентный бустинг с нуля: четыре ноутбука, learning rate и 20 шагов
#
# Этот ноутбук повторяет расчёт из Excel-файла, но с графиками и кодом, который можно менять.
# Никаких библиотек машинного обучения — только `numpy`, `pandas` и `matplotlib`.
# Всё, что происходит внутри бустинга, написано явно и умещается в несколько десятков строк.
#
# **План**
# 1. Данные и стартовое предсказание $F_0$
# 2. Остаток как антиградиент
# 3. Один шаг: группировка по колонкам → выбор колонки → обновление с learning rate $\nu$
# 4. 20 шагов: таблица, как в Excel
# 5. Графики: сходимость предсказаний, чередование признаков, убывание ошибки
# 6. Сравнение $\nu = 1,\ 0.5,\ 0.1$
# 7. Разложение итогового прогноза на вклады шагов

# %%
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

plt.rcParams.update({
    "figure.dpi": 110, "axes.grid": True, "grid.alpha": 0.3,
    "axes.spines.top": False, "axes.spines.right": False, "font.size": 10,
})
C_SCREEN, C_SSD, C_TRUE, C_PRED = "#2E75B6", "#E07B2A", "#595959", "#1B7F4B"

# %% [markdown]
# ## 1. Данные и стартовое предсказание
#
# Четыре ноутбука, два категориальных признака и реальная цена $y$.

# %%
df = pd.DataFrame({
    "ноутбук": ["A", "B", "C", "D"],
    "экран":   ['13"', '13"', '15"', '15"'],
    "ssd":     ["256", "512", "256", "512"],
    "цена":    [820, 880, 1120, 1180],
}).set_index("ноутбук")
y = df["цена"].to_numpy(dtype=float)
df

# %% [markdown]
# Пока признаков не используем, модель — одно число $c$ для всех. Минимизируем сумму квадратов ошибок:
#
# $$S(c)=\sum_i (y_i-c)^2,\qquad \frac{dS}{dc}=-2\sum_i (y_i-c)=0 \;\Rightarrow\; c=\bar y .$$
#
# Так что $F_0=\bar y$ — не договорённость, а решение задачи минимизации. Проверим численно: нарисуем $S(c)$.

# %%
F0 = y.mean()
cs = np.linspace(800, 1200, 401)
S = [((y - c) ** 2).sum() for c in cs]

fig, ax = plt.subplots(figsize=(7, 3.4))
ax.plot(cs, S, color=C_PRED, lw=2)
ax.axvline(F0, color=C_TRUE, ls="--", lw=1)
ax.annotate(f"минимум при c = ȳ = {F0:.0f}", (F0, min(S)), xytext=(F0 + 40, min(S) + 25000),
            arrowprops=dict(arrowstyle="->", color=C_TRUE))
ax.set_xlabel("c — одно предсказание для всех"); ax.set_ylabel("S(c) = Σ(yᵢ − c)²")
ax.set_title("Шаг 0: сумма квадратов ошибок минимальна в среднем")
plt.show()
print(f"F0 = {F0:.2f}")

# %% [markdown]
# ## 2. Остаток — антиградиент потери
#
# Остаток объекта $i$ после шага $m-1$: $r_i = y_i - F_{m-1}(x_i)$.
# Для квадратичной потери $L=\tfrac12(y-F)^2$ это в точности $-\partial L/\partial F$ — антиградиент.
# Поэтому «учить следующую модель на остатках» и есть градиентный спуск, отсюда название метода.

# %%
r0 = y - F0
pd.DataFrame({"реальная": y, "F0": F0, "остаток r": r0, "|r|": np.abs(r0)}, index=df.index)

# %% [markdown]
# ## 3. Один шаг бустинга, разложенный на этапы
#
# Слабая модель — пень (дерево глубины 1): одна колонка делит объекты на две группы, каждая группа
# получает поправку $\gamma_G$ = среднее остатков группы (снова минимизация суммы квадратов, но внутри группы).
#
# Для каждой колонки считаем, сколько ошибки останется после её поправок, и берём колонку с минимумом:
#
# $$j^*=\arg\min_j \Big[\sum_{i\in G_1(j)}(r_i-\gamma_1)^2+\sum_{i\in G_2(j)}(r_i-\gamma_2)^2\Big].$$
#
# Обновление с learning rate: $F_m(x)=F_{m-1}(x)+\nu\,h_m(x)$.

# %%
FEATURES = {"экран": df["экран"].to_numpy(), "ssd": df["ssd"].to_numpy()}

def fit_stump(residual, feature_values):
    """Для одной колонки: поправка каждой группы и оставшаяся сумма квадратов."""
    corr = np.zeros_like(residual)
    groups = {}
    for g in np.unique(feature_values):
        mask = feature_values == g
        gamma = residual[mask].mean()
        corr[mask] = gamma
        groups[g] = dict(members=list(df.index[mask]), sum=residual[mask].sum(),
                         n=int(mask.sum()), gamma=gamma, sse_after=((residual[mask] - gamma) ** 2).sum())
    return corr, groups, ((residual - corr) ** 2).sum()

def boosting_step(F_prev, lr, verbose=False):
    """Этапы A–D. Возвращает новое предсказание и подробности шага."""
    r = y - F_prev                                                  # A
    candidates = {name: fit_stump(r, vals) for name, vals in FEATURES.items()}  # B
    best = min(candidates, key=lambda k: candidates[k][2])          # C
    h = candidates[best][0]
    F_new = F_prev + lr * h                                         # D
    if verbose:
        print("A. остатки:", dict(zip(df.index, np.round(r, 2).tolist())))
        for name, (_, groups, sse) in candidates.items():
            print(f"B. {name}:")
            for g, info in groups.items():
                print(f"     группа {g:>4} {info['members']}: Σr = {info['sum']:7.2f}, "
                      f"γ = {info['gamma']:7.2f}, остаётся {info['sse_after']:9.2f}")
            print(f"C. {name}: остаётся всего {sse:.2f}")
        print(f"C. выбор → {best}")
        print(f"D. F_new = F_prev + {lr} × h =", dict(zip(df.index, np.round(F_new, 2).tolist())))
    return F_new, dict(feature=best, h=h, residual=r, sse={k: v[2] for k, v in candidates.items()},
                       gamma={k: {g: i["gamma"] for g, i in v[1].items()} for k, v in candidates.items()})

F1, info1 = boosting_step(np.full(4, F0), lr=0.5, verbose=True)

# %% [markdown]
# Экран оставляет 3600, SSD — 90 000: экран объясняет в 25 раз больше, его и берём.
# С $\nu=0.5$ прибавляем половину поправки: $F_1(A)=1000+0.5\cdot(-150)=925$.

# %% [markdown]
# ## 4. Двадцать шагов

# %%
def run_boosting(lr, n_steps):
    F = np.full(4, F0)
    history = [dict(step=0, feature="—", F=F.copy(), abs_err=np.abs(y - F).sum(), sse=((y - F) ** 2).sum(),
                    h=np.zeros(4))]
    for m in range(1, n_steps + 1):
        F, info = boosting_step(F, lr)
        history.append(dict(step=m, feature=info["feature"], F=F.copy(), h=info["h"],
                            abs_err=np.abs(y - F).sum(), sse=((y - F) ** 2).sum(),
                            gamma_screen=info["gamma"]["экран"], gamma_ssd=info["gamma"]["ssd"]))
    return history

LR, N = 0.5, 20
hist = run_boosting(LR, N)

summary = pd.DataFrame([{
    "шаг": h["step"], "выбрана колонка": h["feature"],
    "Σ|r|": round(h["abs_err"], 4), "Σr²": round(h["sse"], 4),
    "F(A)": round(h["F"][0], 2), "F(B)": round(h["F"][1], 2), "F(C)": round(h["F"][2], 2), "F(D)": round(h["F"][3], 2),
} for h in hist]).set_index("шаг")
summary

# %% [markdown]
# Ровно то, что было в Excel: три шага экран, потом SSD, потом чередование; ошибка 600 → 300 → 150 → 120 → 75 → …
#
# ## 5. Графики
#
# ### 5.1. Как предсказания сходятся к реальным ценам

# %%
steps = np.arange(N + 1)
Fs = np.array([h["F"] for h in hist])

fig, ax = plt.subplots(figsize=(8, 4.2))
for i, name in enumerate(df.index):
    ax.plot(steps, Fs[:, i], marker="o", ms=3.5, lw=1.6, label=f"F(x_{name})")
    ax.axhline(y[i], color=C_TRUE, ls=":", lw=1)
    ax.text(N + 1.0, y[i], f"y_{name} = {y[i]:.0f}", va="center", fontsize=9, color=C_TRUE)
ax.set_xlabel("шаг m"); ax.set_ylabel("предсказание F_m")
ax.set_title(f"Предсказания сходятся к реальным ценам (ν = {LR})")
ax.legend(loc="center right"); ax.set_xlim(-0.3, N + 4.5)
plt.show()

# %% [markdown]
# Все четыре линии стартуют из одной точки $F_0 = 1000$ и подходят к пунктиру — но никогда его не касаются.
#
# ### 5.2. Какую колонку выбирала модель на каждом шаге и сколько прибавляла

# %%
fig, ax = plt.subplots(figsize=(8, 3.6))
for h in hist[1:]:
    color = C_SCREEN if h["feature"] == "экран" else C_SSD
    amp = LR * np.abs(h["h"]).max()                 # размер прибавки на этом шаге
    ax.bar(h["step"], amp, color=color, width=0.7)
ax.bar([], [], color=C_SCREEN, label="выбран экран"); ax.bar([], [], color=C_SSD, label="выбран SSD")
ax.set_xlabel("шаг m"); ax.set_ylabel("|ν · h_m|, размер поправки")
ax.set_title("Модель грызёт самый большой кусок: экран, пока его остаток больше остатка SSD")
ax.set_xticks(range(1, N + 1)); ax.legend()
plt.show()

# %% [markdown]
# Вклад экрана (150) больше вклада SSD (30). Модель трижды берёт экран: 75 → 37.5 → 18.75,
# и когда недоеденный кусок экрана становится меньше 30, переключается на SSD. Дальше они чередуются.
#
# ### 5.3. Убывание ошибки — геометрическая прогрессия

# %%
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 3.6))
err = [h["abs_err"] for h in hist]
ax1.plot(steps, err, marker="o", ms=4, color=C_PRED, lw=2)
ax1.set_title("Σ|rᵢ| по шагам (линейная шкала)"); ax1.set_xlabel("шаг m"); ax1.set_ylabel("Σ|rᵢ|")
ax2.semilogy(steps, err, marker="o", ms=4, color=C_PRED, lw=2)
ax2.set_title("То же в логарифмической шкале: прямая = геометрическое убывание"); ax2.set_xlabel("шаг m")
plt.tight_layout(); plt.show()

# %% [markdown]
# В логарифмической шкале ошибка ложится на прямую: каждый шаг умножает её примерно на одно и то же число,
# $(1-\nu)$. Она стремится к нулю, но ни при каком конечном $m$ не достигает его.
#
# ## 6. Сравнение разных learning rate

# %%
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 3.8))
for lr, color in [(1.0, C_TRUE), (0.5, C_SCREEN), (0.1, C_SSD)]:
    hs = run_boosting(lr, 60)
    e = [h["abs_err"] for h in hs]
    ax1.plot(range(len(e)), e, lw=2, color=color, label=f"ν = {lr}")
    ax2.semilogy(range(len(e)), np.maximum(e, 1e-12), lw=2, color=color, label=f"ν = {lr}")
ax1.set_title("Σ|rᵢ|: больший ν — быстрее"); ax1.set_xlabel("шаг m"); ax1.set_ylabel("Σ|rᵢ|"); ax1.legend()
ax2.set_title("Лог-шкала: ν = 1 падает в ноль за 2 шага, остальные — никогда"); ax2.set_xlabel("шаг m"); ax2.legend()
plt.tight_layout(); plt.show()

# %% [markdown]
# * $\nu=1$: два шага — и ошибка ровно ноль. Это исходный пример.
# * $\nu=0.5$: за 20 шагов ошибка 0.29, за 60 — около $10^{-6}$.
# * $\nu=0.1$: за 60 шагов — всё ещё порядка единиц. Понадобились бы сотни шагов.
#
# На этих четырёх ноутбуках быстрее — значит лучше. В реальных данных наоборот: маленький $\nu$ с большим числом
# шагов почти всегда даёт лучшее качество на *новых* объектах, потому что не подстраивается под шум обучающей
# выборки. Как это измерить — следующая тема (валидация и ранняя остановка).
#
# ## 7. Из чего сложился итоговый прогноз
#
# Готовая модель — это сумма: $F_{20}(x)=F_0+\nu\,h_1(x)+\nu\,h_2(x)+\dots+\nu\,h_{20}(x)$.
# Разложим прогноз каждого ноутбука на вклады шагов и покрасим по признаку.

# %%
contrib = np.array([LR * h["h"] for h in hist[1:]])        # (N, 4)
feat = [h["feature"] for h in hist[1:]]

feat_arr = np.array(feat)
sum_screen = contrib[feat_arr == "экран"].sum(axis=0)
sum_ssd = contrib[feat_arr == "ssd"].sum(axis=0)

fig, ax = plt.subplots(figsize=(8, 4))
x = np.arange(4); w = 0.3
ax.bar(x - w / 2, sum_screen, w, color=C_SCREEN, label="Σ вкладов шагов «экран»")
ax.bar(x + w / 2, sum_ssd, w, color=C_SSD, label="Σ вкладов шагов «SSD»")
ax.scatter(x, y - F0, color="black", zorder=5, label="y − F₀ (что нужно было выучить)")
ax.scatter(x, sum_screen + sum_ssd, facecolors="none", edgecolors=C_PRED, s=70, lw=2, zorder=6,
           label="F₂₀ − F₀ (что выучено)")
ax.axhline(0, color=C_TRUE, lw=1)
ax.set_xticks(x, df.index); ax.set_ylabel("вклад относительно F₀ = 1000")
ax.set_title("Из чего сложился прогноз: экран дал ±150, SSD дал ±30")
ax.legend(fontsize=8, loc="upper left")
plt.show()

final = pd.DataFrame({"F₀": F0, "Σ вкладов экрана": sum_screen, "Σ вкладов SSD": sum_ssd}, index=df.index)
final["F₂₀"] = final.sum(axis=1); final["реальная"] = y; final["остаток"] = y - final["F₂₀"]
final.round(3)

# %% [markdown]
# Сумма вкладов экрана подошла к $\pm150$, сумма вкладов SSD — к $\pm30$: модель по частям, за двадцать осторожных
# шагов, собрала те же самые две поправки, которые при $\nu=1$ нашла за два шага. Разница только в том, что
# при $\nu<1$ она делала это постепенно — и в реальной задаче эта постепенность защищает от переобучения.
#
# ---
# **Что дальше:** зачем вообще нужен медленный шаг — валидация, переобучение и ранняя остановка.
