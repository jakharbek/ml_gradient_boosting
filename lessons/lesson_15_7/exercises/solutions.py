"""Решения упражнений урока 15.7: вторая производная, выпуклость, Тейлор и Ньютон.

Запуск:  python lessons/lesson_15_7/exercises/solutions.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import numpy as np
import xgboost as xgb
from scipy import optimize

for stream in (sys.stdout, sys.stderr):
    stream.reconfigure(encoding="utf-8")

sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731


def d2num(f, x, h=1e-4):
    return (f(x + h) - 2 * f(x) + f(x - h)) / h**2


def title(t):
    print("\n" + "=" * 8, t)


# 1. Разминка ------------------------------------------------------------------------------
title("1. Вторые производные")
TASK1 = {
    "x⁵ − 3x³ + x → 20x³ − 18x": (lambda x: x**5 - 3 * x**3 + x, lambda x: 20 * x**3 - 18 * x),
    "e^(−3x) → 9e^(−3x)": (lambda x: np.exp(-3 * x), lambda x: 9 * np.exp(-3 * x)),
    "x ln x → 1/x": (lambda x: x * np.log(x), lambda x: 1 / x),
    "1/(1 + x) → 2/(1 + x)³": (lambda x: 1 / (1 + x), lambda x: 2 / (1 + x) ** 3),
}
for name, (f, f2) in TASK1.items():
    print(f"{name:28} f″(1) = {f2(1.0):.6f}, вторая разность {d2num(f, 1.0):.6f}")
    assert abs(f2(1.0) - d2num(f, 1.0)) < 1e-5

# 2. Экстремумы и перегибы x⁴ − 8x² -------------------------------------------------------------
title("2. x⁴ − 8x²")
f = lambda x: x**4 - 8 * x**2  # noqa: E731
f2 = lambda x: 12 * x**2 - 16  # noqa: E731
for c in (-2.0, 0.0, 2.0):  # f′ = 4x³ − 16x = 4x(x − 2)(x + 2)
    print(f"x = {c:+.0f}: f = {f(c):+.0f}, f″ = {f2(c):+.0f} → {'минимум' if f2(c) > 0 else 'максимум'}")
xi = 2 / math.sqrt(3)
print(f"перегибы: x = ±2/√3 = ±{xi:.4f}, f = {f(xi):.4f} (= −80/9)")
assert f2(2) == 32 and f2(0) == -16 and abs(f(xi) + 80 / 9) < 1e-12

# 3. Вторая разность для e^(sin x) -------------------------------------------------------------
title("3. e^(sin x): f″ = (cos²x − sin x)e^(sin x), f″(0) = 1")
g = lambda x: np.exp(np.sin(x))  # noqa: E731
errs = {}
for k in range(1, 10):
    h = 10.0**-k
    errs[h] = abs(d2num(g, 0.0, h) - 1.0)
    print(f"h = 1e-{k}: оценка {d2num(g, 0.0, h):+.10f}, ошибка {errs[h]:.1e}")
best = min(errs, key=errs.get)
print(f"лучший h = {best:.0e}: дальше ошибка округления ~1e-16/h² растёт")
assert best in (1e-3, 1e-4, 1e-5)

# 4. Когда f″ = 0 -------------------------------------------------------------------------------
title("4. Первая ненулевая производная")
print("eˣ − 1 − x − x²/2: в нуле f = f′ = f″ = 0, f‴ = e⁰ = 1 → порядок 3, нечётный → экстремума нет")
print("x·sin x: f′ = sin x + x cos x = 0, f″ = 2cos x − x sin x = 2 > 0 → минимум")
for name, fn, kind in [("eˣ − 1 − x − x²/2", lambda x: math.exp(x) - 1 - x - x * x / 2, "нет"), ("x·sin x", lambda x: x * math.sin(x), "минимум")]:
    lft, rgt = fn(-1e-2) - fn(0), fn(1e-2) - fn(0)
    print(f"   {name}: f(−0.01) − f(0) = {lft:+.2e}, f(0.01) − f(0) = {rgt:+.2e}")
    assert (lft * rgt < 0) == (kind == "нет")

# 5. Исследование x²e^(−x) -------------------------------------------------------------------
title("5. x²e^(−x)")
f = lambda x: x**2 * np.exp(-x)                 # noqa: E731
f1 = lambda x: x * (2 - x) * np.exp(-x)          # noqa: E731
f2 = lambda x: (x**2 - 4 * x + 2) * np.exp(-x)   # noqa: E731
print("f′ = x(2 − x)e^(−x): ↘ при x < 0, ↗ на (0; 2), ↘ при x > 2; минимум f(0) = 0, максимум f(2) = 4/e² =", round(4 / math.e**2, 4))
r1, r2 = 2 - math.sqrt(2), 2 + math.sqrt(2)
print(f"f″ = (x² − 4x + 2)e^(−x): перегибы x = 2 ± √2 = {r1:.4f}, {r2:.4f}; чаша вне (r1; r2), купол внутри")
print("x → −∞: f → +∞; x → +∞: f → 0 (асимптота y = 0)")
xs = np.linspace(-1, 8, 900001)
s2 = np.sign(f2(xs))
flips = xs[1:][s2[1:] * s2[:-1] < 0]
assert np.allclose(flips, [r1, r2], atol=1e-4)
assert abs(optimize.minimize_scalar(lambda x: -f(x), bounds=(1, 3), method="bounded").x - 2) < 1e-4

# 6. Лемма о трёх хордах ------------------------------------------------------------------------
title("6. Три хорды")
print("Доказательство: b = t·a + (1 − t)·c, t = (c − b)/(c − a). Выпуклость: f(b) ≤ t f(a) + (1 − t) f(c).")
print("Вычтем f(a) и поделим на b − a = (1 − t)(c − a): (f(b) − f(a))/(b − a) ≤ (f(c) − f(a))/(c − a).")
print("Аналогично, вычитая f(c), получаем второе неравенство. Устремим b → a и b → c:")
print("f′(a) ≤ наклон хорды [a, c] ≤ f′(c) при любых a < c — f′ не убывает, значит f″ ≥ 0.")
rng = np.random.default_rng(1)
pts = np.sort(rng.uniform(-3, 3, (20000, 3)), axis=1)
a, b, c = pts.T


def chords(fn):
    return (fn(b) - fn(a)) / (b - a), (fn(c) - fn(a)) / (c - a), (fn(c) - fn(b)) / (c - b)


s1, s2_, s3 = chords(np.exp)
assert np.all(s1 <= s2_ + 1e-9) and np.all(s2_ <= s3 + 1e-9)
s1, s2_, s3 = chords(np.sin)
i = int(np.argmax(s1 - s3))
print(f"eˣ: лемма выполнена на всех 20000 тройках; sin x нарушает её, например при a, b, c = {np.round(pts[i], 3)}: наклоны {s1[i]:.3f} > {s3[i]:.3f}")
assert s1[i] > s3[i]

# 7. Выпукла ли? ------------------------------------------------------------------------------------
title("7. Выпуклость")
CANDS = {
    "ln(1 + eˣ) + x²": (lambda x: np.log1p(np.exp(x)) + x**2, lambda x: sig(x) * (1 - sig(x)) + 2, (-5, 5)),
    "x⁴ − 6x²": (lambda x: x**4 - 6 * x**2, lambda x: 12 * x**2 - 12, (-2.5, 2.5)),
    "e^(x²)": (lambda x: np.exp(x**2), lambda x: (2 + 4 * x**2) * np.exp(x**2), (-1.5, 1.5)),
    "x ln x": (lambda x: x * np.log(x), lambda x: 1 / x, (0.01, 4)),
    "√x": (np.sqrt, lambda x: -0.25 * x**-1.5, (0.01, 4)),
}
for name, (fn, h2, (lo, hi)) in CANDS.items():
    xs = np.linspace(lo, hi, 4001)
    neg = xs[h2(xs) < 0]
    if neg.size:
        u, v = neg.min(), neg.max()
        mid = (u + v) / 2
        above = fn(mid) - (fn(u) + fn(v)) / 2
        print(f"{name:16} НЕ выпукла: f″ < 0 на [{u:.2f}; {v:.2f}]; середина хорды ниже графика на {above:.3f}")
        assert above > 0
    else:
        print(f"{name:16} выпукла (f″ ≥ 0)")

# 8. Йенсен и log-loss ----------------------------------------------------------------------------
title("8. Ансамбль классификаторов")
p = np.array([0.9, 0.6, 0.3])
mean_loss = (-np.log(p)).mean()
loss_mean = -math.log(p.mean())
print(f"средний log-loss моделей {mean_loss:.4f} ≥ log-loss средней вероятности {loss_mean:.4f}: −ln p выпукла (Йенсен)")
assert loss_mean <= mean_loss
F = np.log(p / (1 - p))
loss_logit = -math.log(sig(F.mean()))
print(f"усреднение логитов: p = σ(среднего логита) = {sig(F.mean()):.4f}, log-loss {loss_logit:.4f} ≤ {mean_loss:.4f}:")
print("   log-loss выпукла и по логиту (h = p(1 − p) > 0), так что неравенство верно и здесь")
assert loss_logit <= mean_loss

# 9. Тейлор ------------------------------------------------------------------------------------------
title("9а. cos x")
c4 = 1 - 0.5**2 / 2 + 0.5**4 / 24
print(f"cos 0.5 ≈ 1 − x²/2 + x⁴/24 = {c4:.8f}, точно {math.cos(0.5):.8f}, ошибка {abs(c4 - math.cos(0.5)):.1e} ≤ x⁶/6! = {0.5**6 / 720:.1e}")
assert abs(c4 - math.cos(0.5)) <= 0.5**6 / 720
n, s = 0, 0.0
while abs(s - math.cos(1)) >= 1e-8:
    s += (-1) ** n / math.factorial(2 * n)
    n += 1
print(f"cos 1 с ошибкой < 1e-8: {n} членов (до x^{2 * (n - 1)}), ошибка {abs(s - math.cos(1)):.1e}")
assert n == 6

title("9б. ряд log-loss")
L = lambda F: math.log1p(math.exp(-F))  # noqa: E731
coef = [math.log(2), -1 / 2, 1 / 8, 0.0, -1 / 192]
# проверка коэффициентов: k-я производная численно (k ≤ 2) и по сигмоиде: L‴ = σ″, L⁽⁴⁾ = σ‴
s0 = 0.5
ders = [math.log(2), s0 - 1, s0 * (1 - s0), s0 * (1 - s0) * (1 - 2 * s0), s0 * (1 - s0) * (1 - 6 * s0 + 6 * s0**2)]
assert np.allclose([d / math.factorial(k) for k, d in enumerate(ders)], coef)
for Fv in (0.5, 1.0):
    q = coef[0] + coef[1] * Fv + coef[2] * Fv**2
    print(f"F = {Fv}: L − парабола = {L(Fv) - q:+.3e}, −F⁴/192 = {-(Fv**4) / 192:+.3e}")
    assert abs((L(Fv) - q) / (-(Fv**4) / 192) - 1) < 0.1  # следующий член +F⁶/2880 даёт ~6 % при F = 1

# 10. Ньютон: кубический корень ----------------------------------------------------------------------
title("10. ∛5")
root = 5 ** (1 / 3)
x, prev, k = 2.0, None, 0
while abs(x - root) > 1e-12:
    e = abs(x - root)
    print(f"k = {k}: x = {x:.15f}, ошибка {e:.1e}" + (f", eₖ/eₖ₋₁² = {e / prev**2:.4f}" if prev else ""))
    prev, x, k = e, x - (x**3 - 5) / (3 * x**2), k + 1
print(f"k = {k}: ошибка {abs(x - root):.1e}; C = 1/x* = {1 / root:.4f}")
assert k == 4

# 11. Где Ньютон сходится -------------------------------------------------------------------------------
title("11. √(1 + x²)")
print("f′ = x/√(1 + x²), f″ = (1 + x²)^(−3/2): x − f′/f″ = x − x(1 + x²) = −x³")
for x0 in (0.9, 1.0, 1.1):
    tr = [x0]
    for _ in range(5):
        tr.append(-tr[-1] ** 3)
    print(f"x₀ = {x0}: {np.round(tr, 4)}")
print("|x₀| < 1 — сходится (квадратично и даже быстрее), |x₀| = 1 — цикл ±1, |x₀| > 1 — разлетается")


def repaired(x, lam=0.0, clip=0.0, steps=6):
    out = [x]
    for _ in range(steps):
        st = -(x / math.sqrt(1 + x * x)) / ((1 + x * x) ** -1.5 + lam)
        if clip:
            st = max(-clip, min(clip, st))
        x += st
        out.append(x)
    return out


cl, lm = repaired(2.0, clip=1.0), repaired(2.0, lam=1.0)
print("обрезка 1 из 2:", np.round(cl, 6))
print("λ = 1 из 2:    ", np.round(lm, 6))
assert abs(cl[-1]) < 1e-12 < abs(lm[-1])

# 12. Лист Пуассона -----------------------------------------------------------------------------------------
title("12. Пуассон")
y = np.array([2.0, 0, 3, 1])
G, H = (np.exp(0) - y).sum(), np.exp(0) * len(y)
w0, w1 = -G / H, -G / (H + 1)
exact = math.log(y.mean())  # Σ(e^w − y) = 0 → e^w = ȳ
print(f"G = {G}, H = {H}: лист при λ = 0 — {w0}, при λ = 1 — {w1}; точный оптимум ln ȳ = ln 1.5 = {exact:.4f}")
print("перелёт: кривизна e^F растёт вправо, парабола в нуле её недооценивает")
X0 = np.zeros((4, 1))


def xgb_leaf(yv, lam, **kw):
    """Значение единственного листа XGBoost (признак-константа → разбиений нет); base_score = 1 → F = 0."""
    m = xgb.XGBRegressor(objective="count:poisson", n_estimators=1, learning_rate=1.0, max_depth=1, reg_lambda=lam,
                         base_score=1.0, min_child_weight=0, **kw).fit(X0, yv)
    return float(m.predict(X0, output_margin=True)[0])


# max_delta_step = 0 — чистая формула учебника
for lam, expect in [(0.0, w0), (1.0, w1)]:
    got = xgb_leaf(y, lam, max_delta_step=0.0)
    print(f"   XGBoost (max_delta_step = 0), λ = {lam}: лист {got:.6f} (формула {expect:.6f})")
    assert abs(got - expect) < 1e-6
# по умолчанию для count:poisson max_delta_step = 0.7: гессиан e^(F + 0.7) и обрезка листа до ±0.7
got = xgb_leaf(y, 0.0)
print(f"   XGBoost по умолчанию: лист {got:.6f} = −G/(H·e^0.7) = {-G / (H * math.exp(0.7)):.6f} — шаг вдвое короче, перелёта нет")
assert abs(got - (-G / (H * math.exp(0.7)))) < 1e-6
y_big = np.array([6.0, 0, 9, 3])
got = xgb_leaf(y_big, 0.0)
print(f"   y = 6, 0, 9, 3: Ньютон дал бы {(y_big - 1).sum() / 4}, с гессианом ×e^0.7 — {(y_big - 1).sum() / (4 * math.exp(0.7)):.4f}, "
      f"а XGBoost обрезал до {got:.4f}")
assert abs(got - 0.7) < 1e-6

# 13. Прирост разбиения -----------------------------------------------------------------------------------------
title("13. Прирост разбиения")
X = np.arange(1, 9, dtype=float).reshape(-1, 1)
y = np.array([1, 0, 0, 0, 0, 1, 1, 1])
g, h = 0.5 - y, np.full(8, 0.25)
lam = 1.0
sc = lambda a, b: a**2 / (b + lam)  # noqa: E731
G, H = g.sum(), h.sum()
gains = [0.5 * (sc(g[:t].sum(), h[:t].sum()) + sc(G - g[:t].sum(), H - h[:t].sum()) - sc(G, H)) for t in range(1, 8)]
for t, gn in zip(range(1, 8), gains):
    print(f"   x < {t + 0.5}: Gain = {gn:+.4f}")
tb = int(np.argmax(gains)) + 1
wl, wr = -g[:tb].sum() / (h[:tb].sum() + lam), -(G - g[:tb].sum()) / (H - h[:tb].sum() + lam)
print(f"лучший порог x < {tb + 0.5}: Gain {gains[tb - 1]:.4f}, листья {wl:+.4f} и {wr:+.4f}")
m = xgb.XGBClassifier(n_estimators=1, max_depth=1, learning_rate=1.0, reg_lambda=lam, base_score=0.5, min_child_weight=0,
                      tree_method="exact").fit(X, y)
dump = m.get_booster().get_dump(with_stats=True)[0]
xg_gain = float(dump.split("gain=")[1].split(",")[0])
print(dump.strip())
assert abs(xg_gain - 2 * gains[tb - 1]) < 1e-5
assert np.allclose(sorted(np.unique(m.predict(X, output_margin=True))), sorted([wl, wr]), atol=1e-6)
for gamma in (2 * gains[tb - 1] - 0.01, 2 * gains[tb - 1] + 0.01):
    mg = xgb.XGBClassifier(n_estimators=1, max_depth=1, learning_rate=1.0, reg_lambda=lam, gamma=gamma, base_score=0.5,
                           min_child_weight=0, tree_method="exact").fit(X, y)
    n_leaves = mg.get_booster().get_dump()[0].count("leaf=")
    print(f"   gamma = {gamma:.4f}: листьев {n_leaves}")
print(f"XGBoost отказывается от разбиения при gamma > 2·Gain = {2 * gains[tb - 1]:.4f}")
print("\nВсе проверки пройдены.")
