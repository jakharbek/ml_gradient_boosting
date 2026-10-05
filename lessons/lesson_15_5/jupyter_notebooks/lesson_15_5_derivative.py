# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_15_5

# %% [markdown]
# # Урок 15.5. Производная
#
# **Интерактивная версия:** `lessons/lesson_15_5/web/index.html` — там те же опыты на живых графиках.
#
# **После урока вы сможете:** находить производную по определению и читать её обозначения с единицами;
# объяснять три её смысла — наклон касательной, скорость, линейное приближение — и составлять уравнение
# касательной; узнавать точки без производной и пользоваться субградиентом; по знаку $f'$ находить рост,
# экстремумы и наибольшее значение на отрезке, применять теорему Лагранжа; считать производные численно,
# выбирая шаг с учётом округления и шума; выводить псевдо-остатки функций потерь.
#
# Блоки урока:
#
# 1. **Определение:** приращения, предел разностного отношения, обозначения, вычисление по определению, $f'$ как функция.
# 2. **Три смысла:** *производная — это наклон* (секущая → касательная), касательная и нормаль, скорость, линейное приближение.
# 3. **Когда производной нет:** односторонние производные, галерея «плохих» точек, гладкость, субградиент.
# 4. **Что производная говорит о функции:** монотонность, экстремумы и теорема Ферма, теорема Лагранжа.
# 5. **Как считать:** линейность, обратная функция, численная производная, шумные данные.
# 6. **В ML:** градиентный спуск и темп, производные потерь, лучшая константа, псевдо-остатки и деревья.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from IPython.display import HTML, display
from matplotlib import animation
from scipy import optimize

from gbcourse import datasets
from gbcourse.boosting import GBRegressor
from gbcourse.plotting import use_course_style
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, RED, VIOLET
from gbcourse.tree import RegressionTree

use_course_style()
plt.rcParams["animation.embed_limit"] = 30  # МБ: анимации встраиваются в ноутбук


def quotient(f, a, h):
    """Разностное отношение (f(a + h) − f(a)) / h."""
    return (f(a + h) - f(a)) / h


def central(f, a, h=1e-5):
    """Центральная разность — численная производная."""
    return (f(a + h) - f(a - h)) / (2 * h)


# %% [markdown]
# ## Блок 1. Определение
#
# ### 1. Приращения и разностное отношение
#
# Сдвиг аргумента $\Delta x$ даёт приращение функции $\Delta f = f(a + \Delta x) - f(a)$, а отношение
# $\frac{\Delta f}{\Delta x}$ — среднюю скорость изменения $f$ на отрезке, наклон секущей.

# %%
f = lambda x: x**2  # noqa: E731
for dx in [0.5, -0.5, 0.1, -0.1]:
    df = f(1 + dx) - f(1)
    print(f"x² в точке 1, Δx = {dx:5}: Δf = {df: .4f}, Δf/Δx = {df / dx:.4f}")
print("sin на [0, 2π]: отношение =", round(quotient(np.sin, 0, 2 * np.pi), 12), "— средняя скорость ничего не знает о том, что между точками")

# %% [markdown]
# ### 2. Производная — предел разностного отношения
#
# $$f'(a) = \lim_{h \to 0}\frac{f(a + h) - f(a)}{h}.$$
#
# Как функция шага, $q(h)$ определена при $h \ne 0$, а в нуле у графика дырка; производная её «заклеивает».
# Предел должен совпадать с обеих сторон.

# %%
hs = np.array([-1, -0.1, -0.01, -0.001, 0.001, 0.01, 0.1, 1])
print("√x в точке 4:", np.round(quotient(np.sqrt, 4, hs), 6))
print("|x| в точке 0:", quotient(np.abs, 0, hs), "— справа 1, слева −1: производной нет")

h = np.linspace(-1, 1, 801)
h = h[np.abs(h) > 1e-9]
fig, axes = plt.subplots(1, 2, figsize=(11, 3.6))
for ax, (name, g, a, L) in zip(axes, [("√x, a = 4", np.sqrt, 4, 0.25), ("|x|, a = 0", np.abs, 0, None)]):
    q = quotient(g, a, h)
    ax.plot(h[h < 0], q[h < 0], color=BLUE, lw=2.2)
    ax.plot(h[h > 0], q[h > 0], color=BLUE, lw=2.2)
    if L is not None:
        ax.axhline(L, color=ORANGE, ls="--", label=f"f′(a) = {L}")
        ax.plot([0], [L], "o", mfc="white", mec=BLUE, ms=8)
        ax.legend()
    else:
        ax.plot([0, 0], [1, -1], "o", mfc="white", mec=BLUE, ms=8)
    ax.set(title=f"q(h) для {name}", xlabel="h", ylabel="q(h)")
plt.show()

# %% [markdown]
# ### 3. Обозначения и единицы
#
# $f'(x)$ (Лагранж), $\frac{df}{dx}$ (Лейбниц), $\dot s$ (Ньютон), $\frac{\partial L}{\partial F}$ — производная по одной
# переменной при фиксированных остальных. Единица производной — [f] / [x]: м/с, ₽ за штуку, «потери на 1 млн прогноза».
#
# ### 4. Производная по определению
#
# Алгоритм: приращение → отношение → сократить $h$ → предел. Результаты (выкладки — на странице урока):
# $(x^2)' = 2x$, $(x^3)' = 3x^2$, $(\frac1x)' = -\frac1{x^2}$, $(\sqrt x)' = \frac1{2\sqrt x}$, $(e^x)' = e^x$,
# $(\sin x)' = \cos x$, $\frac{\partial}{\partial F}\frac12(y - F)^2 = -(y - F)$. Проверим каждую таблицей.

# %%
table = {
    "x²": (lambda x: x**2, lambda x: 2 * x),
    "x³": (lambda x: x**3, lambda x: 3 * x**2),
    "1/x": (lambda x: 1 / x, lambda x: -1 / x**2),
    "√x": (np.sqrt, lambda x: 1 / (2 * np.sqrt(x))),
    "eˣ": (np.exp, np.exp),
    "sin x": (np.sin, np.cos),
}
for name, (g, dg) in table.items():
    x0 = 1.3
    qs = [quotient(g, x0, h) for h in (0.1, 0.01, 0.001)]
    print(f"{name:6} в x = {x0}: отношения {np.round(qs, 6)} → формула {dg(x0):.6f}")

y_, F_ = 5.0, 2.0
L = lambda F: 0.5 * (y_ - F) ** 2  # noqa: E731
print("½(y − F)² при y = 5, F = 2: численно", round(central(L, F_), 8), "формула −(y − F) =", -(y_ - F_))

# %% [markdown]
# ### 5. Производная — тоже функция
#
# Собрав наклоны во всех точках, получаем новую функцию $x \mapsto f'(x)$. Её область может быть меньше:
# у $\sqrt x$ нет производной в нуле, у $|x|$ — в нуле.

# %%
x = np.linspace(-2.4, 2.4, 400)
g = lambda x: x**3 / 3 - x  # noqa: E731
xs = np.linspace(-2.2, 2.2, 12)
fig, (a1, a2) = plt.subplots(2, 1, figsize=(7, 5.5), sharex=True)
a1.plot(x, g(x), color=BLUE, lw=2.2, label="f(x) = x³/3 − x")
for x0 in xs[::3]:
    k = central(g, x0)
    a1.plot([x0 - 0.3, x0 + 0.3], [g(x0) - 0.3 * k, g(x0) + 0.3 * k], color=ORANGE, lw=2)
a1.legend()
a2.plot(x, x**2 - 1, color=ORANGE, lw=2, label="f′(x) = x² − 1")
a2.plot(xs, central(g, xs), "o", color=ORANGE, label="измеренные наклоны")
a2.axhline(0, color=MUTED, lw=1)
a2.legend()
plt.show()

# %% [markdown]
# ## Блок 2. Три смысла производной
#
# ### 6. Производная — это наклон
#
# Наклон прямой — подъём/пробег $= \operatorname{tg}\alpha$. Наклон секущей через $a$ и $a + h$ — разностное
# отношение. При $h \to 0$ секущая поворачивается вокруг точки и в пределе становится **касательной**;
# её наклон — производная. Анимация: $f(x) = \frac{x^3}{3} - x$, $a = 0.5$, $f'(0.5) = -0.75$.

# %%
a = 0.5
hs = 2 * 10 ** (-3 * np.arange(41) / 40)
grid = np.linspace(-2.6, 2.6, 400)
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4))
a1.plot(grid, g(grid), color=BLUE, lw=2.2, label="f(x)")
a1.plot(grid, g(a) - 0.75 * (grid - a), "--", color=ORANGE, label="касательная")
(sec,) = a1.plot([], [], color=AQUA, lw=2, label="секущая")
(pts,) = a1.plot([], [], "o", color=AQUA)
a1.set(ylim=(-2.5, 2.5), xlabel="x", ylabel="f(x)")
a1.legend(loc="upper left")
a2.semilogx(hs, quotient(g, a, hs), color=AQUA, lw=2, label="наклон секущей")
a2.axhline(-0.75, color=ORANGE, ls="--", label="f′(a) = −0.75")
(cur,) = a2.plot([], [], "o", color=AQUA, ms=8)
a2.invert_xaxis()
a2.set(xlabel="h", ylabel="наклон")
a2.legend()


def frame(i):
    k = quotient(g, a, hs[i])
    sec.set_data(grid, g(a) + k * (grid - a))
    pts.set_data([a, a + hs[i]], [g(a), g(a + hs[i])])
    cur.set_data([hs[i]], [k])
    a1.set_title(f"h = {hs[i]:.3f}, наклон секущей {k:.4f}")
    return sec, pts, cur


anim = animation.FuncAnimation(fig, frame, frames=len(hs), interval=120)
plt.close(fig)
display(HTML(anim.to_jshtml()))

for h in [1, 0.1, 0.01, 0.001]:
    print(f"h = {h:<6}: вправо {quotient(g, a, h): .7f}, центральная {(g(a + h) - g(a - h)) / (2 * h): .7f}")

# %% [markdown]
# ### 7. Касательная и нормаль
#
# $y = f(a) + f'(a)(x - a)$; нормаль $y = f(a) - \frac{x - a}{f'(a)}$. Примеры: касательная к $x^2$ в 1 — $y = 2x - 1$;
# к $1/x$ отсекает от осей треугольник площади 2 в любой точке; через $(1, -3)$ к $x^2$ проходят две касательные.

# %%
for a in [0.5, 1, 2, 5]:
    k, b = -1 / a**2, 2 / a  # касательная к 1/x: y = kx + b
    x_int, y_int = -b / k, b
    print(f"1/x, a = {a}: y = {k:.4f}x + {b:.4f}, площадь треугольника = {0.5 * x_int * y_int:.4f}")

# касательные к x² через внешнюю точку (1, −3): a² − 2a − 3 = 0
for a in np.roots([1, -2, -3]):
    print(f"точка касания a = {a:+.0f}: y = {2 * a:+.0f}x {-(a**2):+.0f}, проходит через (1, −3): {np.isclose(2 * a * 1 - a**2, -3)}")

# %% [markdown]
# ### 8. Производная — это скорость
#
# Мяч: $s(t) = 20t - 5t^2$, $v(t) = s'(t) = 20 - 10t$. Средние скорости сходятся к мгновенной; в верхней точке $v = 0$.

# %%
s = lambda t: 20 * t - 5 * t**2  # noqa: E731
for dt in [0.5, 0.1, 0.01, 0.001]:
    print(f"средняя скорость на [1, 1 + {dt}]: {quotient(s, 1, dt):.4f} м/с")
t_top = optimize.brentq(lambda t: central(s, t), 0.5, 3)
print(f"верхняя точка: t = {t_top:.6f} с, высота {s(t_top):.4f} м; скорость приземления v(4) = {central(s, 4):.4f} м/с")

# %% [markdown]
# ### 9. Производная — это линейное приближение
#
# $f(a + \Delta) = f(a) + f'(a)\Delta + o(\Delta)$. Ошибка для гладких функций ≈ $\frac12 f''(a)\Delta^2$:
# уменьшили $\Delta$ в 10 раз — ошибка упала в 100 раз. Дифференциал $df = f'(x)\,dx$ — главная линейная часть приращения.

# %%
cases = [("√4.1", np.sqrt, 0.25, 4, 0.1), ("sin 0.1", np.sin, 1, 0, 0.1), ("e^0.1", np.exp, 1, 0, 0.1),
         ("ln 1.05", np.log, 1, 1, 0.05), ("∛8.3", np.cbrt, 1 / 12, 8, 0.3), ("1/0.98", lambda x: 1 / x, -1, 1, -0.02),
         ("1.02¹⁰", lambda x: x**10, 10, 1, 0.02)]
for name, g2, d1, a, d in cases:
    approx = g2(a) + d1 * d
    print(f"{name:8}: приближение {approx:.6f}, точно {g2(a + d):.6f}, ошибка {approx - g2(a + d):+.2e}")

ds = np.logspace(-4, 0, 50)
fig, ax = plt.subplots(figsize=(6.5, 3.8))
ax.loglog(ds, np.abs(2 + 0.25 * ds - np.sqrt(4 + ds)), color=BLUE, lw=2, label="√x около 4: наклон 2")
ax.loglog(ds, np.abs(ds - np.sin(ds)), color=VIOLET, lw=2, label="sin x около 0: наклон 3 (f″ = 0)")
ax.loglog(ds, ds**2 / 32, ":", color=MUTED, label="½|f″|Δ² для √x")
ax.set(xlabel="Δ", ylabel="|ошибка|", title="Ошибка линейного приближения")
ax.legend()
plt.show()
print("квадрат 10 → 10.1: ΔA =", round(10.1**2 - 100, 4), " dA = 2·s·ds =", 2 * 10 * 0.1)

# %% [markdown]
# ## Блок 3. Когда производной нет
#
# ### 11–12. Односторонние производные и галерея
#
# Производная есть ⇔ $f'_-(a) = f'_+(a)$. Излом — разные конечные пределы, остриё — $\mp\infty$,
# вертикальная касательная — $+\infty$ с обеих сторон, скачок — функция разрывна, колебания — предела нет.

# %%
gallery = {
    "|x|": np.abs,
    "√|x|": lambda x: np.sqrt(np.abs(x)),
    "∛x": np.cbrt,
    "[x ≥ 0]": lambda x: (np.asarray(x) >= 0) * 1.0,
    "x·sin(1/x)": lambda x: x * np.sin(1 / x) if x != 0 else 0.0,
    "x²·sin(1/x)": lambda x: x**2 * np.sin(1 / x) if x != 0 else 0.0,
    "склейка x² | 2x − 1 в 1": lambda x: x**2 if x < 1 else 2 * x - 1,
}
for name, g2 in gallery.items():
    a = 1.0 if "склейка" in name else 0.0
    right = [quotient(g2, a, h) for h in (1e-2, 1e-4, 1e-6)]
    left = [quotient(g2, a, -h) for h in (1e-2, 1e-4, 1e-6)]
    print(f"{name:24} справа {np.round(right, 4)}, слева {np.round(left, 4)}")

# %% [markdown]
# ### 13. Гладкость
#
# Дифференцируемая функция непрерывна, обратное неверно. Классы: разрывная (дерево) ⊂ $C^0$ (MAE, ReLU) ⊂ $C^1$ (Хьюбер) ⊂ $C^\infty$
# (MSE, log-loss). Рисуем $f$, $f'$, $f''$ для потерь Хьюбера: $f'$ непрерывна, $f''$ прыгает.

# %%
x = np.linspace(-2.5, 2.5, 1001)
hub = np.where(np.abs(x) <= 1, 0.5 * x**2, np.abs(x) - 0.5)
d1 = np.gradient(hub, x)
d2 = np.gradient(d1, x)
fig, axes = plt.subplots(3, 1, figsize=(7, 6), sharex=True)
for ax, v, name, c in zip(axes, [hub, d1, d2], ["f", "f′", "f″"], [BLUE, ORANGE, VIOLET]):
    ax.plot(x[5:-5], v[5:-5], color=c, lw=2)
    ax.set_ylabel(name)
axes[0].set_title("Хьюбер, δ = 1: класс C¹")
plt.show()

# %% [markdown]
# ### 14. Субградиент
#
# Для выпуклой функции в изломе $\partial f(a) = [f'_-(a); f'_+(a)]$, минимум ⇔ $0 \in \partial f(a)$.
# MAE шести квартир: $\partial L(4) = [-\frac13; 0]$ — медиана.

# %%
flats = np.array([2, 4, 3, 7, 9, 11], dtype=float)
mae = lambda c: np.mean(np.abs(flats - c))  # noqa: E731
for c in [3.5, 4, 5.5, 7, 8]:
    left = round(quotient(mae, c, -1e-7), 6)
    right = round(quotient(mae, c, 1e-7), 6)
    print(f"c = {c}: ∂L = [{left:+.4f}; {right:+.4f}], минимум: {left <= 0 <= right}")

# %% [markdown]
# ## Блок 4. Что производная говорит о функции
#
# ### 15–17. Монотонность, экстремумы, теорема Ферма
#
# $f' > 0$ — растёт; в экстремуме $f' = 0$ или производной нет; на отрезке проверяем и концы.
# Сверяем свой алгоритм кандидатов с `scipy.optimize.minimize_scalar`.

# %%
def candidates(g2, dg, a, b, kinks=()):
    """Концы, нули f′ (смена знака на сетке + brentq) и изломы внутри [a, b]."""
    x = np.linspace(a, b, 20001)
    d = dg(x)
    roots = [optimize.brentq(dg, x[i], x[i + 1]) for i in np.where(np.sign(d[:-1]) * np.sign(d[1:]) < 0)[0]]
    roots += list(x[1:-1][d[1:-1] == 0])  # корень ровно в узле сетки
    pts = sorted({a, b, *roots, *[k for k in kinks if a < k < b]})
    return np.array(pts), g2(np.array(pts))


problems = [
    ("x² − 4x на [0, 5]", lambda x: x**2 - 4 * x, lambda x: 2 * x - 4, 0, 5, ()),
    ("x³ − 3x на [−2, 3]", lambda x: x**3 - 3 * x, lambda x: 3 * x**2 - 3, -2, 3, ()),
    ("x·e⁻ˣ на [0, 4]", lambda x: x * np.exp(-x), lambda x: (1 - x) * np.exp(-x), 0, 4, ()),
    ("x⁴ − 2x² на [−1.5, 2]", lambda x: x**4 - 2 * x**2, lambda x: 4 * x**3 - 4 * x, -1.5, 2, ()),
    ("|x² − 1| на [−2, 2]", lambda x: np.abs(x**2 - 1), lambda x: 2 * x * np.sign(x**2 - 1), -2, 2, (-1, 1)),
    ("площадь x(10 − x) на [0, 10]", lambda x: x * (10 - x), lambda x: 10 - 2 * x, 0, 10, ()),
]
for name, g2, dg, a, b, kinks in problems:
    pts, vals = candidates(g2, dg, a, b, kinks)
    res = optimize.minimize_scalar(g2, bounds=(a, b), method="bounded")
    print(f"{name:30} max {vals.max():.4f} при x = {pts[vals.argmax()]:.4f}; min {vals.min():.4f} при x = {pts[vals.argmin()]:.4f}"
          f"   (scipy, локальный поиск: {res.fun:.4f})")

# %% [markdown]
# ### 18. Теоремы Ролля и Лагранжа
#
# Найдётся $c$, где касательная параллельна секущей: $f'(c) = \frac{f(b) - f(a)}{b - a}$. Следствия: монотонность,
# постоянство, оценка $|f(b) - f(a)| \le M|b - a|$ (для сигмоиды $M = \frac14$).

# %%
for name, g2, dg, a, b in [("x³ на [0, 2]", lambda x: x**3, lambda x: 3 * x**2, 0, 2),
                            ("sin на [0, π/2]", np.sin, np.cos, 0, np.pi / 2),
                            ("√x на [0, 4]", np.sqrt, lambda x: 0.5 / np.sqrt(x), 0, 4)]:
    k = (g2(b) - g2(a)) / (b - a)
    c = optimize.brentq(lambda t, dg=dg, k=k: dg(t) - k, a + 1e-9, b - 1e-9)
    print(f"{name:16}: наклон секущей {k:.4f}, c = {c:.4f}, f′(c) = {dg(c):.4f}")

sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731
z = np.linspace(-8, 8, 2001)
print("max σ′ =", np.max(central(sig, z)), "→ |σ(a) − σ(b)| ≤ |a − b| / 4")
print("√101 − 10 =", np.sqrt(101) - 10, "между", 1 / (2 * np.sqrt(101)), "и", 0.05)

# %% [markdown]
# ## Блок 5. Как считать
#
# ### 19–20. Линейность и обратная функция
#
# $(\alpha f + \beta g)' = \alpha f' + \beta g'$; $(f^{-1})'(y) = 1/f'(x)$. Отсюда $(\ln y)' = 1/y$ и $\operatorname{logit}'(p) = \frac{1}{p(1 - p)}$.

# %%
hmix = lambda x: 2 * np.exp(x) - 3 * np.sin(x) + np.sqrt(x)  # noqa: E731
x0 = 0.7
print("линейность:", central(hmix, x0), "≈", 2 * np.exp(x0) - 3 * np.cos(x0) + 1 / (2 * np.sqrt(x0)))
logit = lambda p: np.log(p / (1 - p))  # noqa: E731
for p in [0.5, 0.9, 0.99]:
    print(f"logit′({p}) численно {central(logit, p, 1e-7):.4f}, по формуле 1/(p(1 − p)) = {1 / (p * (1 - p)):.4f}")
print("(ln y)′ в y = 3:", central(np.log, 3.0), "≈ 1/3")

# %% [markdown]
# ### 21. Численная производная: усечение против округления
#
# Вперёд — ошибка ~$h$, центральная — ~$h^2$, округление — ~$10^{-16}/h$. Для $\sin$ в точке 1 лучший шаг $10^{-8}$ (вперёд)
# и $10^{-5}$ (центральная); Ричардсон $\frac{4D(h/2) - D(h)}{3}$ ещё точнее. Сверка: `scipy.optimize.approx_fprime`
# (разность вперёд с шагом $\sqrt{\varepsilon}$).

# %%
hs = np.logspace(-15, 0, 301)
exact = np.cos(1.0)
fwd = np.abs((np.sin(1 + hs) - np.sin(1)) / hs - exact)
cen = np.abs((np.sin(1 + hs) - np.sin(1 - hs)) / (2 * hs) - exact)
D = lambda t: (np.sin(1 + t) - np.sin(1 - t)) / (2 * t)  # noqa: E731
rich = np.abs((4 * D(hs / 2) - D(hs)) / 3 - exact)
fig, ax = plt.subplots(figsize=(7, 4.2))
for err, name, c in [(fwd, "вперёд", AQUA), (cen, "центральная", VIOLET), (rich, "Ричардсон", RED)]:
    ax.loglog(hs, np.where(err > 0, err, np.nan), color=c, lw=1.8, label=f"{name}: лучший h ≈ {hs[np.nanargmin(np.where(err > 0, err, np.nan))]:.0e}")
ax.loglog(hs, 1.1e-16 / hs, ":", color=MUTED, label="округление ~10⁻¹⁶/h")
ax.set(xlabel="h", ylabel="|ошибка|", ylim=(1e-16, 1), title="Ошибка численной производной sin в точке 1")
ax.legend(fontsize=8)
plt.show()
print("x³ в 1, h = 0.1: вперёд", quotient(lambda x: x**3, 1, 0.1), "центральная", central(lambda x: x**3, 1, 0.1))
print("scipy approx_fprime:", optimize.approx_fprime(np.array([1.0]), lambda v: np.sin(v[0]))[0], "точно", exact)

# %% [markdown]
# ### 22. Производная по шумным данным
#
# Шум $\sigma$ превращается в ошибку производной ~$\sigma/(\sqrt2 h)$, усечение — ~$h^2/6$. Данные те же, что в виджете:
# $\sin x$ с шагом 0.01 и шумом от `Mulberry32(7)`.

# %%
rng = Mulberry32(7)
x = np.arange(629) * 0.01
noise = np.array([rng.normal() for _ in x])
ks = [1, 2, 5, 10, 20, 40, 80]
fig, ax = plt.subplots(figsize=(6.5, 3.8))
for sigma, c in [(1e-3, BLUE), (1e-2, ORANGE), (0.05, VIOLET)]:
    y = np.sin(x) + sigma * noise
    rmse = [np.sqrt(np.mean(((y[2 * k:] - y[:-2 * k]) / (2 * k * 0.01) - np.cos(x[k:-k])) ** 2)) for k in ks]
    best = ks[int(np.argmin(rmse))] * 0.01
    print(f"σ = {sigma}: RMSE при h = 0.01 — {rmse[0]:.4f}, лучший h = {best:.2f} — RMSE {min(rmse):.4f}")
    ax.loglog(np.array(ks) * 0.01, rmse, "o-", color=c, label=f"σ = {sigma}")
ax.set(xlabel="h", ylabel="RMSE оценки производной", title="Шум требует большего шага")
ax.legend()
plt.show()

# %% [markdown]
# ## Блок 6. Производная в машинном обучении
#
# ### 23. Градиентный спуск и темп
#
# На $f = \frac a2\theta^2$ шаг умножает $\theta$ на $q = 1 - \eta a$: сходимость при $0 < \eta < 2/a$, за один шаг при $\eta = 1/a$.

# %%
for eta in [0.3, 0.5, 0.75, 1.0, 1.1]:
    t, path = 2.0, [2.0]
    for _ in range(6):
        t -= eta * 2 * t
        path.append(t)
    print(f"a = 2, η = {eta}: q = {1 - 2 * eta:+.2f}  θ: {np.round(path, 4)}")

# %% [markdown]
# ### 24–25. Производные потерь и лучшая константа
#
# Псевдо-остаток $-\partial L/\partial F$: $y - F$ (MSE), $\operatorname{sign}(y - F)$ (MAE), $\operatorname{clip}(y - F, -\delta, \delta)$ (Хьюбер),
# $\alpha$ или $\alpha - 1$ (квантильные), $y - \sigma(F)$ (log-loss). Проверяем формулы центральной разностью и находим лучшие
# константы для шести квартир.

# %%
losses = {
    "MSE": (lambda y, F: 0.5 * (y - F) ** 2, lambda y, F: -(y - F)),
    "MAE": (lambda y, F: np.abs(y - F), lambda y, F: -np.sign(y - F)),
    "Хьюбер δ=1": (lambda y, F: np.where(np.abs(y - F) <= 1, 0.5 * (y - F) ** 2, np.abs(y - F) - 0.5), lambda y, F: -np.clip(y - F, -1, 1)),
    "квантиль α=0.8": (lambda y, F: np.where(y >= F, 0.8 * (y - F), -0.2 * (y - F)), lambda y, F: np.where(y > F, -0.8, 0.2)),
    "log-loss": (lambda y, F: np.logaddexp(0, F) - y * F, lambda y, F: sig(F) - y),
}
for name, (Lf, gf) in losses.items():
    yv, Fv = (1.0, 0.0) if name == "log-loss" else (5.0, 2.0)
    num = central(lambda F, Lf=Lf, yv=yv: Lf(yv, F), Fv)
    print(f"{name:15} y = {yv}, F = {Fv}: ∂L/∂F формула {float(gf(yv, Fv)):+.4f}, численно {num:+.4f}, псевдо-остаток {-float(gf(yv, Fv)):+.4f}")

cs = np.linspace(0, 12, 120001)
for name, Lc in [("MSE", lambda c: np.mean(0.5 * (flats[:, None] - c) ** 2, axis=0)),
                 ("MAE", lambda c: np.mean(np.abs(flats[:, None] - c), axis=0)),
                 ("Хьюбер δ=2", lambda c: np.mean(np.where(np.abs(flats[:, None] - c) <= 2, 0.5 * (flats[:, None] - c) ** 2, 2 * (np.abs(flats[:, None] - c) - 1)), axis=0))]:
    vals = Lc(cs)
    best = cs[np.isclose(vals, vals.min(), rtol=0, atol=1e-9)]
    print(f"{name:11}: лучшая константа {best.min():.3f} … {best.max():.3f}")

c = 3.0
for k in range(5):
    c -= 0.5 * np.mean(c - flats)
    print(f"спуск по MSE, шаг {k + 1}: c = {c}")

# %% [markdown]
# ### 26. Псевдо-остатки и пень
#
# Шаг бустинга: $r_i = -\partial L/\partial F_i$ → пень учится их предсказывать → $F \leftarrow F + \nu\,h(x)$.
# Сверяем с `sklearn.ensemble.GradientBoostingRegressor` (первое дерево обучается на тех же остатках).

# %%
from sklearn.ensemble import GradientBoostingRegressor

X = np.arange(1, 7, dtype=float).reshape(-1, 1)
F = np.full(6, flats.mean())
for m in range(3):
    r = flats - F
    stump = RegressionTree(max_depth=1).fit(X, -r)
    F = F + 0.5 * stump.predict(X)
    print(f"дерево {m + 1}: r = {r}, F = {np.round(F, 4)}, потери {np.mean(0.5 * (flats - F) ** 2):.4f}")

sk = GradientBoostingRegressor(n_estimators=1, learning_rate=0.5, max_depth=1).fit(X, flats)
gb = GBRegressor(n_estimators=1, learning_rate=0.5, max_depth=1).fit(X, flats)
print("sklearn после 1 дерева:", sk.predict(X))
print("gbcourse после 1 дерева:", gb.predict(X))
assert np.allclose(sk.predict(X), gb.predict(X))

# %% [markdown]
# ### 27. Наклон прогноза бустинга по признаку
#
# Прогноз — лестница: при малом $h$ разностное отношение почти везде 0, на порогах — огромное. Поэтому бустинг
# дифференцирует потери по прогнозу, а наклон модели по признаку меряют только с крупным шагом.

# %%
Xs, ys = datasets.regression_1d(kind="sine", n=60, noise=0.3, seed=7)
model = GBRegressor(n_estimators=60, learning_rate=0.2, max_depth=2).fit(Xs, ys)
grid = np.linspace(0.5, 9.5, 901)
Fm = lambda v: model.predict(v.reshape(-1, 1))  # noqa: E731
fig, axes = plt.subplots(1, 2, figsize=(11, 3.6))
for ax, h in zip(axes, [1e-3, 1.0]):
    est = (Fm(grid + h) - Fm(grid - h)) / (2 * h)
    print(f"h = {h}: нулевых {np.mean(np.abs(est) < 1e-12):.1%}, RMSE против cos x {np.sqrt(np.mean((est - np.cos(grid)) ** 2)):.3f}")
    ax.plot(grid, np.clip(est, -3, 3), color=ORANGE, lw=1.2, label="оценка dF/dx")
    ax.plot(grid, np.cos(grid), "--", color=MUTED, label="cos x")
    ax.set(title=f"h = {h}", xlabel="x", ylim=(-3, 3))
    ax.legend()
plt.show()

# %% [markdown]
# ## Упражнения
#
# Задания — `lessons/lesson_15_5/exercises/tasks.md`, решения — `exercises/solutions.py`. Попробуйте:
#
# 1. Найти по определению производные $5x^2 - 3$ и $\frac{1}{x + 1}$ и проверить их функцией `quotient`.
# 2. Составить касательные к $e^x$ в точках −1, 0, 1 и убедиться, что все лежат под графиком.
# 3. Найти наибольшее значение $x^2 e^{-x}$ на $[0; 5]$ функцией `candidates`.
# 4. Повторить опыт блока 22 со своей функцией и шумом и найти лучший шаг.
