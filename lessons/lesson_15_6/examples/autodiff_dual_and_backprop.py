"""Автоматическое дифференцирование: дуальные числа (прямой режим) и граф вычислений (обратный режим).

Запуск:  python lessons/lesson_15_6/examples/autodiff_dual_and_backprop.py [--save] [--no-show]

Прямой режим считает производную формул урока за один проход «значение + наклон»; обратный режим — градиент
log-loss логистической регрессии по w и b за один обратный проход. Оба сверяются с формулами и численно.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse import datasets
from gbcourse.cli import Example
from gbcourse.style import BLUE, ORANGE

ex = Example(__file__)


class Dual:
    """a + bε с ε² = 0: каждая операция переносит производную по правилу урока."""

    def __init__(self, v, d=0.0):
        self.v, self.d = v, d

    @staticmethod
    def wrap(o):
        return o if isinstance(o, Dual) else Dual(o)

    def __add__(self, o):
        o = Dual.wrap(o)
        return Dual(self.v + o.v, self.d + o.d)

    def __sub__(self, o):
        o = Dual.wrap(o)
        return Dual(self.v - o.v, self.d - o.d)

    def __mul__(self, o):
        o = Dual.wrap(o)
        return Dual(self.v * o.v, self.d * o.v + self.v * o.d)

    def __truediv__(self, o):
        o = Dual.wrap(o)
        return Dual(self.v / o.v, (self.d * o.v - self.v * o.d) / o.v**2)

    def __pow__(self, k):
        return Dual(self.v**k, k * self.v ** (k - 1) * self.d)

    def __neg__(self):
        return Dual(-self.v, -self.d)

    __radd__ = __add__
    __rmul__ = __mul__

    def __rsub__(self, o):
        return Dual.wrap(o) - self

    def __rtruediv__(self, o):
        return Dual.wrap(o) / self


def exp(a):
    return Dual(math.exp(a.v), math.exp(a.v) * a.d)


def log(a):
    return Dual(math.log(a.v), a.d / a.v)


def sin(a):
    return Dual(math.sin(a.v), math.cos(a.v) * a.d)


def cos(a):
    return Dual(math.cos(a.v), -math.sin(a.v) * a.d)


def num_diff(f, x, eps=1e-6):
    return (f(x + eps) - f(x - eps)) / (2 * eps)


# 1. Прямой режим на формулах урока
FORMULAS = [
    ("x·eˣ", lambda x: x * exp(x), lambda x: math.exp(x) * (1 + x), 1.0),
    ("(x² + 1)/(x − 1)", lambda x: (x**2 + 1) / (x - 1), lambda x: (x * x - 2 * x - 1) / (x - 1) ** 2, 3.0),
    ("e^(sin x²)", lambda x: exp(sin(x * x)), lambda x: 2 * x * math.cos(x * x) * math.exp(math.sin(x * x)), 1.0),
    ("σ(x)", lambda x: 1 / (1 + exp(-x)), lambda x: (s := 1 / (1 + math.exp(-x))) * (1 - s), 1.0),
    ("xˣ = e^(x ln x)", lambda x: exp(x * log(x)), lambda x: x**x * (math.log(x) + 1), 2.0),
    ("tg x = sin/cos", lambda x: sin(x) / cos(x), lambda x: 1 / math.cos(x) ** 2, 0.7),
]
for name, f, df, x in FORMULAS:
    d = f(Dual(x, 1.0)).d
    print(f"{name:18} x = {x}: дуальные числа {d:.12f}, формула {df(x):.12f}")
    assert abs(d - df(x)) < 1e-12 * max(1, abs(df(x)))


# 2. Обратный режим: граф вычислений
class Node:
    def __init__(self, v, parents=()):
        self.v, self.g, self.parents = v, 0.0, parents

    @staticmethod
    def wrap(o):
        return o if isinstance(o, Node) else Node(o)

    def __add__(self, o):
        o = Node.wrap(o)
        return Node(self.v + o.v, [(self, 1.0), (o, 1.0)])

    def __mul__(self, o):
        o = Node.wrap(o)
        return Node(self.v * o.v, [(self, o.v), (o, self.v)])

    __radd__ = __add__
    __rmul__ = __mul__

    def __neg__(self):
        return self * -1.0

    def __rsub__(self, o):
        return Node.wrap(o) + (-self)


def nsig(a):
    s = 1 / (1 + math.exp(-a.v))
    return Node(s, [(a, s * (1 - s))])


def nlog(a):
    return Node(math.log(a.v), [(a, 1 / a.v)])


def backward(out):
    order, seen = [], set()

    def visit(n):
        if id(n) not in seen:
            seen.add(id(n))
            for p, _ in n.parents:
                visit(p)
            order.append(n)

    visit(out)
    out.g = 1.0
    for n in reversed(order):
        for p, local in n.parents:
            p.g += n.g * local


X, y = datasets.classification_2d("blobs", n=60, noise=0.6, seed=5)
x1 = X[:, 0]
sig = lambda z: 1 / (1 + np.exp(-z))  # noqa: E731


def loss_np(w, b):
    p = sig(w * x1 + b)
    return float(-np.sum(y * np.log(p) + (1 - y) * np.log(1 - p)))


w0, b0 = 0.8, -0.3
w, b = Node(w0), Node(b0)
L = Node(0.0)
for xi, yi in zip(x1, y):
    p = nsig(w * float(xi) + b)
    L = L + (-(float(yi) * nlog(p) + (1 - float(yi)) * nlog(1 - p)))
backward(L)
pv = sig(w0 * x1 + b0)
gw, gb = float(np.sum((pv - y) * x1)), float(np.sum(pv - y))
nw, nb = num_diff(lambda t: loss_np(t, b0), w0), num_diff(lambda t: loss_np(w0, t), b0)
print(f"обратный проход: ∂L/∂w = {w.g:.8f}, ∂L/∂b = {b.g:.8f}")
print(f"формулы        : Σ(p − y)x = {gw:.8f}, Σ(p − y) = {gb:.8f}")
print(f"численно       : {nw:.8f}, {nb:.8f}")
assert abs(w.g - gw) < 1e-9 and abs(b.g - gb) < 1e-9 and abs(w.g - nw) < 1e-5

ws = np.linspace(-1.5, 3, 200)
Ls = [loss_np(t, b0) for t in ws]
fig, ax = plt.subplots(figsize=(7.5, 4.2))
ax.plot(ws, Ls, color=BLUE, lw=2.4, label="L(w) при b = −0.3")
ax.plot(ws, loss_np(w0, b0) + w.g * (ws - w0), "--", color=ORANGE, lw=2, label=f"касательная, наклон ∂L/∂w = {w.g:.2f} (обратный проход)")
ax.plot(w0, loss_np(w0, b0), "o", color=ORANGE)
ax.set(xlabel="вес w", ylabel="суммарный log-loss", title="градиент из обратного прохода — наклон касательной", ylim=(min(Ls) - 5, max(Ls)))
ax.legend()
ex.finish(fig, "autodiff_dual_and_backprop")
