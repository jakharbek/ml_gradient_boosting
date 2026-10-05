# Исходник ноутбука в формате percent. .ipynb собирается: python tools/build.py notebooks --only lesson_15_8

# %% [markdown]
# # Урок 15.8. Много переменных: частные производные и градиент
#
# **Интерактивная версия:** `lessons/lesson_15_8/web/index.html`
#
# После урока вы сможете:
#
# - читать карту высот функции двух переменных, строить линии уровня и срезы, проверять предел по разным путям;
# - находить частные производные по правилу «заморозки» и численно, вычислять смешанные производные;
# - строить касательную плоскость и отличать частные производные от дифференцируемости;
# - вычислять градиент и производную по направлению $D_{\mathbf u} f = \nabla f \cdot \mathbf u$;
# - применять цепное правило и матрицу Якоби (softmax: градиент $\mathbf p - \mathbf y$);
# - классифицировать критические точки гессианом, строить квадратичное приближение;
# - объяснять устойчивость градиентного спуска, роль числа обусловленности и шаг Ньютона $-H^{-1}\nabla f$;
# - выводить псевдо-остатки как антиградиент по прогнозам и объяснять дерево как проекцию антиградиента.
#
# Разделы ноутбука идут в том же порядке, что и 26 шагов урока. Каждое утверждение проверяется числом,
# а ключевые — сверкой с `numpy`, `scipy`, `scikit-learn`, XGBoost, LightGBM и учебной библиотекой `gbcourse`.

# %%
import sys
from pathlib import Path

ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())
sys.path.insert(0, str(ROOT / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np
from scipy import optimize

from gbcourse import datasets
from gbcourse.boosting import GBRegressor
from gbcourse.plotting import use_course_style
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE, VIOLET, cmap_sequential

use_course_style()
CMAP = cmap_sequential().reversed()   # низины — тёмные, как на картах урока


def grad_num(f, p, eps=1e-6):
    """Градиент центральными разностями: каждая координата сдвигается отдельно."""
    p = np.asarray(p, dtype=float)
    g = np.zeros_like(p)
    for i in range(len(p)):
        e = np.zeros_like(p)
        e[i] = eps
        g[i] = (f(p + e) - f(p - e)) / (2 * eps)
    return g


def hess_num(f, p, eps=1e-4):
    """Гессиан смешанными разностями."""
    p = np.asarray(p, dtype=float)
    n = len(p)
    H = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            ei, ej = np.eye(n)[i] * eps, np.eye(n)[j] * eps
            H[i, j] = (f(p + ei + ej) - f(p + ei - ej) - f(p - ei + ej) + f(p - ei - ej)) / (4 * eps**2)
    return H


# %% [markdown]
# ## 1. Функция многих переменных: таблица с двумя входами
#
# Площадь $S(a, b) = ab$, модель цены $P(s, d) = 2 + 0.1s - 0.4d$, ИМТ $m/h^2$ и потери прямой на шести квартирах
# $L(w, b)$ — всё это функции двух переменных.

# %%
toy_X, toy_y = datasets.toy_regression()
x_flat = toy_X[:, 0]
print("площади:", x_flat, " цены:", toy_y)
L_wb = lambda w, b: np.mean((toy_y - w * x_flat - b) ** 2)  # noqa: E731
print("S(3, 4) =", 3 * 4, " P(60, 5) =", 2 + 0.1 * 60 - 0.4 * 5, " ИМТ(70, 1.75) =", round(70 / 1.75**2, 2))
w_opt, b_opt = np.polyfit(x_flat, toy_y, 1)
print(f"L(0, 0) = {L_wb(0, 0):.2f};  лучшая прямая w = {w_opt:.3f}, b = {b_opt:.3f}, L = {L_wb(w_opt, b_opt):.3f}")
assert abs(L_wb(0, 0) - 46.6667) < 1e-3 and abs(L_wb(w_opt, b_opt) - 0.9143) < 1e-3

# таблица значений ИМТ: строки — рост, столбцы — масса
for h in [1.6, 1.75, 1.9]:
    print(f"h = {h}:", "  ".join(f"{m / h**2:5.1f}" for m in [50, 70, 90, 110]))

# %% [markdown]
# ## 2–3. Поверхности и карты высот
#
# Слева — поверхность $z = f(x, y)$, справа — карта высот. Линии уровня проведены с равным шагом по высоте:
# где они гуще, склон круче.

# %%
SURF = {
    "чаша x² + 3y²": lambda x, y: x**2 + 3 * y**2,
    "седло x² − y²": lambda x, y: x**2 - y**2,
    "холм 3e^(−r²/2)": lambda x, y: 3 * np.exp(-(x**2 + y**2) / 2),
}
Xg, Yg = np.meshgrid(np.linspace(-2.2, 2.2, 120), np.linspace(-2.2, 2.2, 120))
fig = plt.figure(figsize=(12, 7.6))
for k, (name, fn) in enumerate(SURF.items()):
    Z = fn(Xg, Yg)
    ax = fig.add_subplot(2, 3, k + 1, projection="3d")
    ax.plot_surface(Xg, Yg, Z, cmap=CMAP, linewidth=0, alpha=0.95)
    ax.set(title=name, xlabel="x", ylabel="y")
    ax2 = fig.add_subplot(2, 3, k + 4)
    ax2.contourf(Xg, Yg, Z, levels=30, cmap=CMAP, alpha=0.6)
    cs = ax2.contour(Xg, Yg, Z, levels=8, colors=MUTED, linewidths=1)
    ax2.clabel(cs, fontsize=7)
    ax2.set(aspect="equal", xlabel="x", ylabel="y")
plt.tight_layout()
plt.show()

# %% [markdown]
# Линии уровня круглой чаши $x^2 + y^2 = c$ — окружности радиуса $\sqrt c$: при равном шаге по $c$ кольца сближаются.

# %%
radii = np.sqrt(np.array([1, 2, 3, 4]))
print("радиусы колец для c = 1, 2, 3, 4:", radii.round(3), " промежутки:", np.diff(radii).round(3))

# %% [markdown]
# ## 4. Срезы
#
# Срез $y = 1$ у $x^2 + 3y^2$ — парабола $x^2 + 3$, срез $x = 1$ — $1 + 3y^2$. Срез седла по диагонали — нуль.

# %%
t = np.linspace(-2, 2, 200)
fig, axes = plt.subplots(1, 3, figsize=(12, 3.2))
axes[0].plot(t, t**2 + 3, color=ORANGE)
axes[0].set(title="x² + 3y², срез y = 1", xlabel="x")
axes[1].plot(t, 1 + 3 * t**2, color=VIOLET)
axes[1].set(title="x² + 3y², срез x = 1", xlabel="y")
axes[2].plot(t, t**2 - 0 * t, color=BLUE, label="y = 0: чаша")
axes[2].plot(t, -(t**2), color=ORANGE, label="x = 0: купол")
axes[2].plot(t, t**2 - t**2, color=AQUA, label="y = x: плоско")
axes[2].set(title="срезы седла x² − y²")
axes[2].legend()
plt.tight_layout()
plt.show()

# %% [markdown]
# ## 5. Предел по разным путям

# %%
f_a = lambda x, y: x * y / (x**2 + y**2)        # noqa: E731
f_b = lambda x, y: x**2 * y / (x**4 + y**2)     # noqa: E731
f_c = lambda x, y: x**2 * y / (x**2 + y**2)     # noqa: E731
print("   x      | xy/(x²+y²): y=0   y=x    y=−x | x²y/(x⁴+y²): y=x   y=x² | x²y/(x²+y²): y=x   y=x²")
for x in [0.1, 0.01, 0.001]:
    print(f"{x:9.3g} | {f_a(x, 0 * x):14.4f} {f_a(x, x):6.3f} {f_a(x, -x):6.3f} |"
          f" {f_b(x, x):16.5f} {f_b(x, x * x):6.3f} | {f_c(x, x):16.5f} {f_c(x, x * x):7.5f}")
assert abs(f_b(1e-3, 1e-6) - 0.5) < 1e-9 and abs(f_b(1e-3, 1e-3)) < 2e-3

# %% [markdown]
# ## 6–7. Частные производные: по определению и по правилу «заморозки»

# %%
f = lambda p: p[0] ** 2 + 3 * p[1] ** 2  # noqa: E731
for h in [0.1, 0.01, 0.001]:
    qx = (f([1 + h, 1]) - f([1, 1])) / h
    qy = (f([1, 1 + h]) - f([1, 1])) / h
    print(f"h = {h:<6} [f(1+h,1) − f]/h = {qx:.4f}   [f(1,1+h) − f]/h = {qy:.4f}")

# %% [markdown]
# Формулы из виджета «заморозка» против центральных разностей:

# %%
CASES = {
    "x²y":          (lambda p: p[0]**2 * p[1], lambda x, y: [2 * x * y, x**2], (1, 2)),
    "x·e^(xy)":     (lambda p: p[0] * np.exp(p[0] * p[1]), lambda x, y: [(1 + x * y) * np.exp(x * y), x**2 * np.exp(x * y)], (1, 0.5)),
    "ln(x² + y²)":  (lambda p: np.log(p[0]**2 + p[1]**2), lambda x, y: [2 * x / (x**2 + y**2), 2 * y / (x**2 + y**2)], (1, 2)),
    "m/h² (ИМТ)":   (lambda p: p[0] / p[1]**2, lambda m, h: [1 / h**2, -2 * m / h**3], (70, 1.75)),
    "x^y":          (lambda p: p[0] ** p[1], lambda x, y: [y * x ** (y - 1), x**y * np.log(x)], (2, 3)),
    "√(x² + y²)":   (lambda p: np.hypot(p[0], p[1]), lambda x, y: [x / np.hypot(x, y), y / np.hypot(x, y)], (3, 4)),
    "(5 − 2w − b)²": (lambda p: (5 - 2 * p[0] - p[1]) ** 2, lambda w, b: [-4 * (5 - 2 * w - b), -2 * (5 - 2 * w - b)], (1, 0)),
}
for name, (fn, d, pt) in CASES.items():
    exact = np.array(d(*pt), dtype=float)
    num = grad_num(fn, pt)
    print(f"{name:14} в {pt}: формула {exact.round(5)}, численно {num.round(5)}")
    assert np.allclose(exact, num, rtol=1e-6, atol=1e-6)

# %% [markdown]
# ## 8. Численная частная производная: выбор шага

# %%
g_xe = lambda x, y: x * np.exp(x * y)  # noqa: E731
exact = 1.5 * np.exp(0.5)
hs = np.logspace(-12, 0, 121)
err_f = np.abs((g_xe(1 + hs, 0.5) - g_xe(1, 0.5)) / hs - exact)
err_c = np.abs((g_xe(1 + hs, 0.5) - g_xe(1 - hs, 0.5)) / (2 * hs) - exact)
for h in [1e-3, 1e-5, 1e-10]:
    i = np.argmin(np.abs(hs - h))
    print(f"h = {h:.0e}: вперёд {err_f[i]:.1e}, центральная {err_c[i]:.1e}")
fig, ax = plt.subplots(figsize=(6.5, 3.8))
ax.loglog(hs, np.maximum(err_f, 1e-17), color=BLUE, label="вперёд: ~h")
ax.loglog(hs, np.maximum(err_c, 1e-17), color=ORANGE, label="центральная: ~h²")
ax.set(xlabel="шаг h", ylabel="ошибка ∂f/∂x", title="x·e^(xy) в точке (1, 0.5)")
ax.legend()
plt.show()

# %% [markdown]
# ## 9. Смешанные производные и теорема Шварца

# %%
fxy_exact = 1 * (2 + 0.5) * np.exp(0.5)   # x(2 + xy)e^(xy) в (1, 0.5)
H_num = hess_num(lambda p: p[0] * np.exp(p[0] * p[1]), (1, 0.5))
print("x·e^(xy): f_xy по формуле", round(fxy_exact, 5), " гессиан численно:\n", H_num.round(4))
print("x³y² в (1, 2): f_xy = 6x²y =", 6 * 1 * 2)

# контрпример: смешанные производные в нуле разные
pe = lambda x, y: 0.0 if x == 0 and y == 0 else x * y * (x * x - y * y) / (x * x + y * y)  # noqa: E731
e = 1e-6
fx_on = lambda y: (pe(e, y) - pe(-e, y)) / (2 * e)  # noqa: E731
fy_on = lambda x: (pe(x, e) - pe(x, -e)) / (2 * e)  # noqa: E731
d = 1e-3
print("контрпример: f_xy(0, 0) ≈", round((fx_on(d) - fx_on(-d)) / (2 * d), 4), " f_yx(0, 0) ≈", round((fy_on(d) - fy_on(-d)) / (2 * d), 4))

# %% [markdown]
# ## 10. Касательная плоскость: ошибка ~ρ² — и конус, где её нет

# %%
r_fn = lambda x, y: np.hypot(x, y)  # noqa: E731
print("√(x²+y²) около (3, 4): оценка f(3.02, 3.97) ≈", 5 + 0.6 * 0.02 - 0.8 * 0.03, " точно", round(r_fn(3.02, 3.97), 5))
rhos = np.logspace(-3, 0, 31)
ang = np.linspace(0, 2 * np.pi, 64, endpoint=False)


def plane_error(fn, a, g, rho):
    P = a + rho * np.c_[np.cos(ang), np.sin(ang)]
    return np.abs(fn(P[:, 0], P[:, 1]) - (fn(*a) + (P - a) @ g)).max()


hill = lambda x, y: 3 * np.exp(-(x**2 + y**2) / 2)  # noqa: E731
a = np.array([1.0, 0.5])
g_hill = grad_num(lambda p: hill(*p), a)
err_hill = [plane_error(hill, a, g_hill, r) for r in rhos]
err_cone = [plane_error(r_fn, np.zeros(2), np.zeros(2), r) for r in rhos]
slope_hill = np.polyfit(np.log10(rhos[:10]), np.log10(err_hill[:10]), 1)[0]
slope_cone = np.polyfit(np.log10(rhos), np.log10(err_cone), 1)[0]
print(f"наклон на лог-лог шкале: холм {slope_hill:.2f} (≈ 2), конус в вершине {slope_cone:.2f} (≈ 1)")
assert abs(slope_hill - 2) < 0.05 and abs(slope_cone - 1) < 0.01
fig, ax = plt.subplots(figsize=(6.5, 3.8))
ax.loglog(rhos, err_hill, color=ORANGE, label="холм: дифференцируем, ~ρ²")
ax.loglog(rhos, err_cone, color=VIOLET, label="конус в вершине: ~ρ")
ax.set(xlabel="радиус ρ", ylabel="max |f − плоскость|")
ax.legend()
plt.show()

# %% [markdown]
# ## 11–13. Векторы, градиент, производная по направлению

# %%
u, v = np.array([2.0, 1.0]), np.array([1.0, 3.0])
print("u·v =", u @ v, " угол =", np.degrees(np.arccos(u @ v / np.linalg.norm(u) / np.linalg.norm(v))).round(2), "°")
g = np.array([2.0, 6.0])     # ∇(x² + 3y²) в (1, 1)
for uu in [np.array([0.6, 0.8]), np.array([1, -1]) / np.sqrt(2), g / np.linalg.norm(g)]:
    by_limit = (f(np.array([1.0, 1.0]) + 1e-7 * uu) - f([1, 1])) / 1e-7
    print(f"u = {uu.round(4)}: ∇f·u = {g @ uu:+.4f}, по определению {by_limit:+.4f}")
angles = np.radians(np.arange(360))
D = np.c_[np.cos(angles), np.sin(angles)] @ g
print(f"max D_u f = {D.max():.4f} = |∇f| = {np.linalg.norm(g):.4f} при угле {np.degrees(angles[D.argmax()]):.0f}°")

fig = plt.figure(figsize=(11, 4))
ax = fig.add_subplot(1, 2, 1)
Xb, Yb = np.meshgrid(np.linspace(-2.5, 2.5, 200), np.linspace(-2, 2, 160))
ax.contourf(Xb, Yb, Xb**2 + 3 * Yb**2, levels=30, cmap=CMAP, alpha=0.55)
ax.contour(Xb, Yb, Xb**2 + 3 * Yb**2, levels=[1, 3, 5, 7, 9, 11], colors=MUTED, linewidths=1)
QX, QY = np.meshgrid(np.linspace(-2.2, 2.2, 12), np.linspace(-1.8, 1.8, 10))
GX, GY = 2 * QX, 6 * QY
N = np.hypot(GX, GY) + 1e-12
ax.quiver(QX, QY, -GX / N, -GY / N, color=BLUE, alpha=0.7)
ax.set(aspect="equal", title="−∇f перпендикулярен линиям уровня")
ax2 = fig.add_subplot(1, 2, 2, projection="polar")
ax2.plot(angles, np.maximum(D, 0), color=ORANGE, label="рост")
ax2.plot(angles, np.maximum(-D, 0), color=BLUE, label="спуск")
ax2.set_title("|D_u f| по направлениям")
ax2.legend(loc="lower left")
plt.tight_layout()
plt.show()

# %% [markdown]
# ## 14. Градиент перпендикулярен линии уровня; густота линий

# %%
tt = np.linspace(0, 2 * np.pi, 200001)
EX, EY = 2 * np.cos(tt), (2 / np.sqrt(3)) * np.sin(tt)      # эллипс x² + 3y² = 4
i = np.argmin((EX - 1) ** 2 + (EY - 1) ** 2)
tangent = np.array([EX[i + 1] - EX[i - 1], EY[i + 1] - EY[i - 1]])
gg = np.array([2 * EX[i], 6 * EY[i]])
print("cos(касательная, ∇f) =", f"{tangent @ gg / np.linalg.norm(tangent) / np.linalg.norm(gg):.1e}")
# расстояние до соседнего уровня (Δc = 2) вдоль градиента из (1, 1)
ug = g / np.linalg.norm(g)
dist = optimize.brentq(lambda s: f(np.array([1.0, 1.0]) + s * ug) - 6, 0, 1)
print(f"Δc/|∇f| = {2 / np.linalg.norm(g):.4f}, на самом деле {dist:.4f}")

# %% [markdown]
# ## 15. Цепное правило

# %%
tq = np.pi / 4
x_, y_ = np.cos(tq), np.sin(tq)
vx, vy = -np.sin(tq), np.cos(tq)
chain = 2 * x_ * vx + 6 * y_ * vy
direct = (f([np.cos(tq + 1e-6), np.sin(tq + 1e-6)]) - f([np.cos(tq - 1e-6), np.sin(tq - 1e-6)])) / 2e-6
print(f"x² + 3y² на окружности при t = π/4: вклады {2 * x_ * vx:.3f} и {6 * y_ * vy:.3f}, сумма {chain:.4f}, напрямую {direct:.4f}")
assert abs(chain - 2) < 1e-9 and abs(direct - 2) < 1e-6

# %% [markdown]
# ## 16. Матрица Якоби softmax

# %%
def softmax(z):
    e_ = np.exp(z - z.max())
    return e_ / e_.sum()


z = np.array([2.0, 1.0, 0.0])
p = softmax(z)
J = np.diag(p) - np.outer(p, p)
J_num = np.array([(softmax(z + 1e-6 * np.eye(3)[j]) - softmax(z - 1e-6 * np.eye(3)[j])) / 2e-6 for j in range(3)]).T
print("p =", p.round(4))
print("Якоби по формуле:\n", J.round(4))
print("совпадает с численной:", np.allclose(J, J_num, atol=1e-8), "  суммы строк:", J.sum(1).round(12))
CE = lambda z: -np.log(softmax(z)[0])  # noqa: E731
print("∇(−ln p₁) = p − y:", (p - np.eye(3)[0]).round(4), " численно:", grad_num(CE, z).round(4))

# %% [markdown]
# ## 17–18. Критические точки и тест гессиана
#
# Ищем критические точки $x^4 + y^4 - 4xy$ решением системы $\nabla f = 0$ из многих стартов (`scipy.optimize.root`),
# классифицируем по собственным числам гессиана.

# %%
q4 = lambda p: p[0] ** 4 + p[1] ** 4 - 4 * p[0] * p[1]                         # noqa: E731
q4_grad = lambda p: np.array([4 * p[0] ** 3 - 4 * p[1], 4 * p[1] ** 3 - 4 * p[0]])  # noqa: E731
q4_hess = lambda p: np.array([[12 * p[0] ** 2, -4], [-4, 12 * p[1] ** 2]])         # noqa: E731
found = []
for sx in np.linspace(-1.6, 1.6, 7):
    for sy in np.linspace(-1.6, 1.6, 7):
        sol = optimize.root(q4_grad, [sx, sy], jac=q4_hess)
        if sol.success and not any(np.allclose(sol.x, q, atol=1e-6) for q in found):
            found.append(sol.x)
for pt in sorted(found, key=lambda q: q[0]):
    lam = np.linalg.eigvalsh(q4_hess(pt))
    kind = "седло" if lam.min() < 0 < lam.max() else "минимум" if lam.min() > 0 else "максимум"
    print(f"({pt[0]:+.4f}, {pt[1]:+.4f}): f = {q4(pt):+.3f}, λ = {lam.round(3)} → {kind}")
assert len(found) == 3

# ловушка: f_xx, f_yy > 0, но седло
Ht = np.array([[2.0, 4.0], [4.0, 2.0]])
print("x² + 4xy + y²: det H =", np.linalg.det(Ht).round(3), " λ =", np.linalg.eigvalsh(Ht))

# %% [markdown]
# ## 19. Квадратичное приближение $e^x \cos y$ около нуля

# %%
ec = lambda x, y: np.exp(x) * np.cos(y)  # noqa: E731
for (x, y) in [(0.1, 0.2), (0.01, 0.02)]:
    ex_, T1, T2 = ec(x, y), 1 + x, 1 + x + 0.5 * (x * x - y * y)
    print(f"({x}, {y}): точно {ex_:.6f}, плоскость {T1} (ошибка {abs(ex_ - T1):.1e}), второй порядок {T2} (ошибка {abs(ex_ - T2):.1e})")

# %% [markdown]
# ## 20. Градиентный спуск: граница устойчивости

# %%
gradf = lambda p: np.array([2 * p[0], 6 * p[1]])  # noqa: E731


def run_gd(eta, p0=(-2.0, 1.6), tol=1e-6, max_steps=2000):
    p, k, path = np.array(p0), 0, [np.array(p0)]
    while tol < f(p) < 1e6 and k < max_steps:
        p, k = p - eta * gradf(p), k + 1
        path.append(p)
    return k, f(p), np.array(path)


for eta in [0.05, 0.1, 0.15, 0.25, 0.3, 0.33, 0.34]:
    k, fv, _ = run_gd(eta)
    print(f"η = {eta:<5} множители {1 - 2 * eta:+.2f} и {1 - 6 * eta:+.2f}: " + ("расходится" if fv >= 1e6 else f"{k} шагов"))

fig, ax = plt.subplots(figsize=(6.5, 4.8))
ax.contour(Xb, Yb, Xb**2 + 3 * Yb**2, levels=[0.5, 1, 2, 4, 7, 11, 16], colors=MUTED, linewidths=1)
for eta, c in [(0.05, AQUA), (0.15, ORANGE), (0.3, VIOLET)]:
    path = run_gd(eta)[2][:30]
    ax.plot(path[:, 0], path[:, 1], "o-", ms=3, color=c, label=f"η = {eta}")
ax.set(aspect="equal", xlim=(-2.5, 2.5), ylim=(-2, 2), title="Спуск по x² + 3y² из (−2, 1.6)")
ax.legend()
plt.show()

# %% [markdown]
# ## 21. Овраги, число обусловленности и метод Ньютона

# %%
for kappa in [1, 3, 10, 30, 100]:
    Hk = np.diag([1.0, kappa])
    p0 = np.array([2.0, 1.0])
    f0 = 0.5 * p0 @ Hk @ p0
    p_, k, eta = p0.copy(), 0, 2 / (1 + kappa)
    while 0.5 * p_ @ Hk @ p_ > 1e-6 * f0:
        p_, k = p_ - eta * Hk @ p_, k + 1
    newton = p0 - np.linalg.solve(Hk, Hk @ p0)
    print(f"κ = {kappa:3}: множитель (κ−1)/(κ+1) = {(kappa - 1) / (kappa + 1):.3f}, спуск {k:3} шагов, Ньютон → {newton}")

# %% [markdown]
# ## 22. Множители Лагранжа: аналитика против `scipy.optimize.minimize`

# %%
res = optimize.minimize(lambda p: -(p[0] + 2 * p[1]), [1, 0], constraints={"type": "eq", "fun": lambda p: p[0] ** 2 + p[1] ** 2 - 1})
print("max x + 2y на окружности:", res.x.round(4), " f =", round(-res.fun, 4), " (аналитически (1, 2)/√5, √5 =", round(np.sqrt(5), 4), ")")
res2 = optimize.minimize(lambda p: p[0] ** 2 + 3 * p[1] ** 2, [0, 0], constraints={"type": "eq", "fun": lambda p: p[0] + p[1] - 1})
print("min x² + 3y² на x + y = 1:", res2.x.round(4), " f =", round(res2.fun, 4), " λ = 2x =", round(2 * res2.x[0], 4))
assert np.allclose(res.x, np.array([1, 2]) / np.sqrt(5), atol=1e-4) and np.allclose(res2.x, [0.75, 0.25], atol=1e-4)

# %% [markdown]
# ## 23. Потери как функция параметров: градиентный спуск для прямой
#
# Сверка с `numpy.polyfit` и `sklearn.linear_model.LinearRegression`; центрирование признака уменьшает
# число обусловленности с 87.6 до 2.9.

# %%
from sklearn.linear_model import LinearRegression  # noqa: E402

print("∇L(0, 0) =", grad_num(lambda q: L_wb(*q), [0, 0]).round(4))


def fit_gd(xx, eta, tol=1e-6, steps=20000):
    w = b = 0.0
    L_opt = np.mean((toy_y - np.polyval(np.polyfit(xx, toy_y, 1), xx)) ** 2)
    for k in range(steps):
        r = toy_y - (w * xx + b)
        if np.mean(r**2) - L_opt < tol:
            return w, b, k
        w, b = w + eta * 2 * np.mean(xx * r), b + eta * 2 * np.mean(r)
        if abs(w) > 1e8:
            return w, b, -1
    return w, b, steps


for xx, eta, name in [(x_flat, 0.05, "исходный x"), (x_flat, 0.1, "исходный x"), (x_flat - 3.5, 0.3, "x − 3.5")]:
    w, b, k = fit_gd(xx, eta)
    Hm = 2 * np.array([[np.mean(xx**2), np.mean(xx)], [np.mean(xx), 1]])
    lam = np.linalg.eigvalsh(Hm)
    print(f"{name:10} η = {eta}: " + ("расходится" if k < 0 else f"w = {w:.4f}, b = {b:.4f}, {k} шагов") + f";  κ = {lam[1] / lam[0]:.2f}, η < {2 / lam[1]:.4f}")
lr = LinearRegression().fit(toy_X, toy_y)
print("sklearn:", round(lr.coef_[0], 4), round(lr.intercept_, 4))

# %% [markdown]
# ## 24. Градиент по вектору прогнозов — псевдо-остатки
#
# Сверяем аналитические псевдо-остатки разных потерь с численным градиентом суммы потерь по вектору прогнозов.

# %%
yv = np.array([3.0, 1.0, 2.0])
Fv = np.array([-2.0, 4.0, 2.5])
LOSSES = {
    "MSE":   (lambda F: 0.5 * np.sum((yv - F) ** 2), lambda F: yv - F),
    "Хьюбер": (lambda F: np.sum(np.where(np.abs(yv - F) <= 1, 0.5 * (yv - F) ** 2, np.abs(yv - F) - 0.5)), lambda F: np.clip(yv - F, -1, 1)),
    "Пуассон": (lambda F: np.sum(np.exp(F) - yv * F), lambda F: yv - np.exp(F)),
}
for name, (Lf, neg_g) in LOSSES.items():
    print(f"{name:8} псевдо-остатки {neg_g(Fv).round(4)},  −численный градиент {(-grad_num(Lf, Fv)).round(4)}")
    assert np.allclose(neg_g(Fv), -grad_num(Lf, Fv), atol=1e-5)
yc, Fc = np.array([1.0, 0.0]), np.zeros(2)
LL = lambda F: np.sum(np.log1p(np.exp(-F)) * yc + np.log1p(np.exp(F)) * (1 - yc))  # noqa: E731
print("log-loss, y = (1, 0), F = 0: y − p =", yc - 0.5, " численно", (-grad_num(LL, Fc)).round(6))

# %% [markdown]
# ## 25. Шаг деревом: проекция антиградиента; сверка с `gbcourse` и scikit-learn

# %%
F0 = np.full(6, toy_y.mean())
r = toy_y - F0
print("антиградиент:", r, " потери:", 0.5 * r @ r)
for thr in (x_flat[:-1] + x_flat[1:]) / 2:
    h = np.where(x_flat <= thr, r[x_flat <= thr].mean(), r[x_flat > thr].mean())
    cos = h @ r / np.linalg.norm(h) / np.linalg.norm(r)
    print(f"порог {thr}: потери {0.5 * np.sum((r - h) ** 2):5.1f}, cos = {cos:.4f}, (r − h)·h = {(r - h) @ h:+.1e}, ½|h|² = {0.5 * h @ h:.1f}")

loss = lambda F: 0.5 * np.sum((toy_y - F) ** 2)  # noqa: E731
from sklearn.ensemble import GradientBoostingRegressor  # noqa: E402

for nu in (1.0, 0.5):
    ours = [loss(GBRegressor(n_estimators=M, learning_rate=nu, max_depth=1).fit(toy_X, toy_y).predict(toy_X)) if M else loss(F0) for M in range(9)]
    sk = GradientBoostingRegressor(n_estimators=8, learning_rate=nu, max_depth=1).fit(toy_X, toy_y)
    skl = [loss(F0)] + [loss(Fp) for Fp in sk.staged_predict(toy_X)]
    print(f"ν = {nu}: gbcourse {np.round(ours, 3)}")
    print(f"        sklearn  {np.round(skl, 3)}")
    assert np.allclose(ours, skl, atol=1e-9)
m1 = GBRegressor(n_estimators=1, learning_rate=1.0, max_depth=1).fit(toy_X, toy_y)
print("прогноз пня для новой квартиры x = 4.5:", m1.predict(np.array([[4.5]]))[0], " (шаг «по точкам» такого правила не даёт)")

# %% [markdown]
# ## 26. Гессиан по прогнозам: диагональ — и что берут библиотеки для softmax
#
# Для двух классов гессиан суммы log-loss по логитам диагональный. Для трёх классов блок объекта —
# $\operatorname{diag}(\mathbf p) - \mathbf p \mathbf p^\top$, а библиотеки берут только диагональ. Проверяем,
# какую именно: строим одно дерево и сравниваем значения листьев с $-G/(H + \lambda)$.

# %%
Fl = np.array([-2.0, 0.0, 1.0, 3.0])
yl = np.array([1.0, 0.0, 1.0, 1.0])
LLs = lambda F: np.sum(np.log1p(np.exp(-F)) * yl + np.log1p(np.exp(F)) * (1 - yl))  # noqa: E731
ps = 1 / (1 + np.exp(-Fl))
print("гессиан численно:\n", hess_num(LLs, Fl).round(4), "\nдиагональ p(1 − p):", (ps * (1 - ps)).round(4))

import lightgbm as lgb  # noqa: E402
import xgboost as xgb  # noqa: E402

ym = np.array([0, 0, 0, 0, 1, 1, 2, 2, 2, 0])
Xm = np.arange(10, dtype=float).reshape(-1, 1)
P3 = np.full((10, 3), 1 / 3)
Y3 = np.eye(3)[ym]
G3, H3 = (P3 - Y3).sum(0), (P3 * (1 - P3)).sum(0)
xm = xgb.XGBClassifier(n_estimators=1, max_depth=1, learning_rate=1.0, reg_lambda=1.0, gamma=1e6, min_child_weight=0,
                       objective="multi:softprob", tree_method="exact")
xm.fit(Xm, ym, base_margin=np.zeros((10, 3)))
leaves = np.array([float(t.split("leaf=")[1].split(",")[0]) for t in xm.get_booster().get_dump(with_stats=True)])
print("XGBoost", xgb.__version__, "листья:", leaves.round(6), " −G/(2H + λ):", (-G3 / (2 * H3 + 1)).round(6))
assert np.allclose(leaves, -G3 / (2 * H3 + 1), atol=1e-6)

ds = lgb.Dataset(Xm, ym, init_score=np.zeros(30), params={"verbose": -1, "min_data_in_bin": 1})
bst = lgb.train({"objective": "multiclass", "num_class": 3, "learning_rate": 1.0, "lambda_l2": 1.0, "num_leaves": 2, "min_data_in_leaf": 1,
                 "min_sum_hessian_in_leaf": 0, "verbose": -1, "boost_from_average": False, "min_data_in_bin": 1}, ds, num_boost_round=1)
for k, tree in enumerate(bst.dump_model()["tree_info"]):
    s_ = tree["tree_structure"]
    left = Xm[:, 0] <= s_["threshold"]
    for side, mask, node in [("левый", left, s_["left_child"]), ("правый", ~left, s_["right_child"])]:
        Gk, Hk = (P3 - Y3)[mask, k].sum(), (P3 * (1 - P3))[mask, k].sum()
        expect = -Gk / (3 / 2 * Hk + 1)
        assert abs(node["leaf_value"] - expect) < 1e-6
print("LightGBM", lgb.__version__, ": все листья совпадают с −G/(K/(K−1)·H + λ), K = 3")

# %% [markdown]
# ## Упражнения
#
# Условия — `exercises/tasks.md`, решения с численной проверкой — `exercises/solutions.py`.
#
# 1. ★☆☆ Частные производные по правилу «заморозки».
# 2. ★☆☆ Линии уровня и срезы.
# 3. ★★☆ Предел по путям.
# 4. ★★☆ Касательная плоскость и полный дифференциал.
# 5. ★★☆ Градиент и производная по направлению.
# 6. ★★☆ Касательная к линии уровня.
# 7. ★★☆ Цепное правило.
# 8. ★★☆ Критические точки и гессиан.
# 9. ★★☆ Устойчивость градиентного спуска.
# 10. ★★★ Множители Лагранжа.
# 11. ★★★ Линейная регрессия: градиент и число обусловленности.
# 12. ★★★ Псевдо-остатки и шаг Ньютона в листе.
