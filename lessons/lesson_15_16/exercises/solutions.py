"""Решения упражнений урока 15.16 «Теория информации: биты, энтропия, перекрёстная энтропия».

Запуск:  python lessons/lesson_15_16/exercises/solutions.py
"""

import heapq
import math
import sys
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from scipy.optimize import brentq
from scipy.stats import entropy
from sklearn.metrics import log_loss, mutual_info_score

from gbcourse.rng import Mulberry32

LN2 = math.log(2)


def H(p):
    p = np.asarray(p, float)
    p = p[p > 0]
    return float(-(p * np.log2(p)).sum())


def h(p):
    return 0.0 if p <= 0 or p >= 1 else -p * math.log2(p) - (1 - p) * math.log2(1 - p)


def mi(J):
    J = np.asarray(J, float)
    J = J / J.sum()
    px, py = J.sum(1, keepdims=True), J.sum(0, keepdims=True)
    m = J > 0
    return float((J[m] * np.log2(J[m] / (px @ py)[m])).sum())


def huffman(ps):
    heap = [(p, i, [i]) for i, p in enumerate(ps)]
    heapq.heapify(heap)
    codes, nxt = [""] * len(ps), len(ps)
    while len(heap) > 1:
        p1, _, s1 = heapq.heappop(heap)
        p2, _, s2 = heapq.heappop(heap)
        for s in s1:
            codes[s] = "0" + codes[s]
        for s in s2:
            codes[s] = "1" + codes[s]
        heapq.heappush(heap, (p1 + p2, nxt, s1 + s2))
        nxt += 1
    return codes


print("1. Биты и вопросы")
print(f"   выбор из 1000: {math.log2(1000):.3f} бит, вопросов {math.ceil(math.log2(1000))}")
print(f"   PIN из 6 цифр: {6 * math.log2(10):.2f} бит — в 2^{2 * math.log2(10):.2f} = 100 раз больше вариантов, чем у PIN из 4 цифр")
assert math.ceil(math.log2(1000)) == 10

print("2. Взвешивания")


def weighings(N, fake):
    cand, k = list(range(1, N + 1)), 0
    while len(cand) > 1:
        a = math.ceil(len(cand) / 3)
        L, R, rest = cand[:a], cand[a:2 * a], cand[2 * a:]
        cand = L if fake in L else R if fake in R else rest
        k += 1
    return k


bound = math.ceil(math.log(40, 3) - 1e-12)
worst = max(weighings(40, f) for f in range(1, 41))
print(f"   40 монет: нижняя граница ⌈log3 40⌉ = {bound}, «три кучки» в худшем случае — {worst}")
assert worst == bound == 4
print(f"   12 монет, легче или тяжелее: 24 варианта, log3 24 = {math.log(24, 3):.3f} > 2 — двух взвешиваний (9 исходов) мало")

print("3. Энтропия и перплексия")
for p in ([.5, .25, .25], [.7, .2, .1], [.2] * 5):
    print(f"   {p}: H = {H(p):.4f} бит = {H(p) * LN2:.4f} нат, перплексия {2 ** H(p):.3f}")
    assert abs(H(p) - entropy(p, base=2)) < 1e-12

print("4. Дождь и зонт")
J = np.array([[0.3 * 0.9, 0.3 * 0.1], [0.7 * 0.2, 0.7 * 0.8]])
HX, HY, HXY = H(J.sum(1)), H(J.sum(0)), H(J.ravel())
print(f"   H(X) = {HX:.4f}, H(Y) = {HY:.4f}, H(X,Y) = {HXY:.4f}, H(Y|X) = {HXY - HX:.4f}, H(X|Y) = {HXY - HY:.4f}, I = {HX + HY - HXY:.4f}")
hyx = sum(J[i].sum() * H(J[i] / J[i].sum()) for i in range(2))
assert abs(hyx - (HXY - HX)) < 1e-12                                     # цепное правило
assert abs(mutual_info_score(None, None, contingency=J * 1e6) / LN2 - mi(J)) < 1e-9

print("5. Код Хаффмана")
freq = [15, 7, 6, 6, 5]
p = np.array(freq) / sum(freq)
codes = huffman(list(p))
L = sum(q * len(c) for q, c in zip(p, codes))
Ls = sum(q * math.ceil(-math.log2(q)) for q in p)
print(f"   коды {dict(zip('ABCDE', codes))}; Крафт: {sum(2.0 ** -len(c) for c in codes)}")
print(f"   средняя длина {L:.4f} (= 87/39), энтропия {H(p):.4f}, код Шеннона {Ls:.4f}")
assert abs(L - 87 / 39) < 1e-12 and H(p) <= L < H(p) + 1

print("6. Блочное кодирование")
p1, Hm = 0.2, h(0.2)
first = None
for n in range(1, 9):
    probs = [p1 ** sum(b) * (1 - p1) ** (n - sum(b)) for b in product((0, 1), repeat=n)]
    rate = sum(q * len(c) for q, c in zip(probs, huffman(probs))) / n
    print(f"   n = {n}: {rate:.4f} бит на символ (H = {Hm:.4f})")
    if first is None and rate - Hm < 0.02:
        first = n
print("   впервые ближе 0.02 бита к энтропии при n =", first)

print("7. Смещение оценки энтропии")
rng = Mulberry32(1)
n, k = 10, 4
plug, mm = [], []
for _ in range(1000):
    cnt = np.zeros(k, int)
    for _ in range(n):
        cnt[rng.randint(k)] += 1
    f = cnt[cnt > 0] / n
    plug.append(-(f * np.log2(f)).sum())
    mm.append(plug[-1] + (len(f) - 1) / (2 * n * LN2))
print(f"   по частотам {np.mean(plug):.3f} (смещение {np.mean(plug) - 2:+.3f}), с поправкой {np.mean(mm):.3f}; приближение −(k−1)/(2n ln 2) = {-(k - 1) / (2 * n * LN2):.3f}")
assert np.mean(plug) < np.mean(mm) and np.mean(plug) < 2

print("8. Взаимная информация против корреляции")
rng = Mulberry32(8)
x = np.array([rng.uniform(-1, 1) for _ in range(2000)])
y = np.abs(x) + 0.05 * np.array([rng.normal() for _ in range(2000)])


def rank_bins(v, b=8):
    r = np.empty(len(v), int)
    r[np.argsort(v, kind="stable")] = np.arange(len(v))
    return r * b // len(v)


def binned(a, b_):
    T = np.zeros((8, 8))
    np.add.at(T, (rank_bins(a), rank_bins(b_)), 1)
    return mi(T)


print(f"   r = {np.corrcoef(x, y)[0, 1]:+.3f}, I = {binned(x, y):.3f} бит; после y → y³: r = {np.corrcoef(x, y**3)[0, 1]:+.3f}, I = {binned(x, y**3):.3f}")
assert abs(np.corrcoef(x, y)[0, 1]) < 0.1 and binned(x, y) > 1 and binned(x, y) == binned(x, y**3)

print("9. Несимметричность KL")
P, Q = [0.9, 0.1], [0.5, 0.5]
print(f"   KL(p||q) = {entropy(P, Q, base=2):.4f}, KL(q||p) = {entropy(Q, P, base=2):.4f}")
fwd, rev = [], []
for d in (1e-3, 1e-6, 1e-9):
    Q2 = [1 - d, d]
    fwd.append(entropy(P, Q2, base=2))
    rev.append(entropy(Q2, P, base=2))
    print(f"   δ = {d:.0e}: KL(p||q) = {fwd[-1]:.3f}, KL(q||p) = {rev[-1]:.4f};  каждый из 10 % объектов стоит −log2 δ = {-math.log2(d):.1f} бита")
print(f"   KL(q||p) → log2(1/0.9) = {math.log2(1 / 0.9):.4f}, а KL(p||q) растёт как 0.1·log2(1/δ) — без ограничений")
assert fwd[0] < fwd[1] < fwd[2] and rev[2] < math.log2(1 / 0.9) + 1e-6

print("10. Разложение log-loss")
px1, p0, p1_ = 0.2, 0.02, 0.42
py = (1 - px1) * p0 + px1 * p1_
HY, HYX = h(py), (1 - px1) * h(p0) + px1 * h(p1_)
ce = (1 - px1) * h(p0) + px1 * (-(p1_ * math.log2(0.8) + (1 - p1_) * math.log2(0.2)))
kl1 = p1_ * math.log2(p1_ / 0.8) + (1 - p1_) * math.log2((1 - p1_) / 0.2)
print(f"   P(y=1) = {py:.3f}; H(Y) = {HY:.4f}, H(Y|X) = {HYX:.4f}, I(X;Y) = {HY - HYX:.4f} бит")
print(f"   модель с 0.8 при x = 1: log-loss = {ce:.4f} = H(Y|X) {HYX:.4f} + 0.2·KL {px1 * kl1:.4f}")
assert abs(ce - (HYX + px1 * kl1)) < 1e-12

print("11. Прирост информации и Джини")
xs = np.arange(1, 7)
ys = np.array([0, 0, 1, 0, 1, 1])
n, p0 = len(ys), ys.mean()
rows = []
for t in (xs[:-1] + xs[1:]) / 2:
    Lf, Rf = ys[xs <= t], ys[xs > t]
    ig = H([p0, 1 - p0]) - len(Lf) / n * H([Lf.mean(), 1 - Lf.mean()]) - len(Rf) / n * H([Rf.mean(), 1 - Rf.mean()])
    pred = np.clip(np.where(xs <= t, Lf.mean(), Rf.mean()), 1e-15, 1 - 1e-15)
    dll = (log_loss(ys, np.full(n, p0)) - log_loss(ys, pred)) / LN2
    gini = 2 * p0 * (1 - p0) - sum(len(c) / n * 2 * c.mean() * (1 - c.mean()) for c in (Lf, Rf))
    newton = 0.5 * sum((len(c) * p0 - c.sum()) ** 2 / (len(c) * p0 * (1 - p0)) for c in (Lf, Rf))
    rows.append((t, ig, dll, gini, newton))
    print(f"   t = {t}: прирост {ig:.4f}, Δ log-loss {dll:.4f}, Джини {gini:.4f}, Ньютон {newton:.4f}")
    assert abs(ig - dll) < 1e-9 and abs(newton - n * gini / (4 * p0 * (1 - p0))) < 1e-9
for i, name in ((1, "энтропия"), (3, "Джини"), (4, "Ньютон")):
    top = max(r[i] for r in rows)
    print(f"   лучшие пороги по критерию «{name}»:", [float(r[0]) for r in rows if abs(r[i] - top) < 1e-12], "— ничья, все критерии согласны")

print("12. XOR с шумом меток и Фано")
eps = 0.2
P3 = np.zeros((2, 2, 2))
for a, b in product((0, 1), repeat=2):
    q = eps + (1 - 2 * eps) * (a ^ b)
    P3[a, b] = 0.25 * (1 - q), 0.25 * q
I1, I2, I12 = mi(P3.sum(1)), mi(P3.sum(0)), mi(P3.reshape(4, 2))
pe_min = brentq(lambda e: h(e) - (1 - I12), 1e-12, 0.5)
print(f"   I(x1;y) = {I1:.4f}, I(x2;y) = {I2:.4f}, I(x1,x2;y) = {I12:.4f} = 1 − h(0.2); Фано: ошибка ≥ {pe_min:.4f}")
rng = Mulberry32(12)
err_xor = err_one = 0
for _ in range(10000):
    a = 1 if rng.random() < 0.5 else 0
    b = 1 if rng.random() < 0.5 else 0
    yv = (a ^ b) if rng.random() >= eps else 1 - (a ^ b)
    err_xor += (a ^ b) != yv
    err_one += a != yv
print(f"   моделирование: ошибка правила x1 ⊕ x2 — {err_xor / 10000:.4f}, правила «только x1» — {err_one / 10000:.4f}")
assert abs(pe_min - 0.2) < 1e-9 and abs(err_xor / 10000 - 0.2) < 0.015 and abs(err_one / 10000 - 0.5) < 0.02
