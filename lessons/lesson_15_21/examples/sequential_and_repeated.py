"""Последовательные и повторяющиеся игры: обратная индукция, ним, альфа-бета, торг, турнир Аксельрода.

Запуск:  python lessons/lesson_15_21/examples/sequential_and_repeated.py [--save] [--no-show]

1) Обратная индукция: вход на рынок (недостоверная угроза), ультиматум, сороконожка.
2) Ним: позиция проигрышна ⇔ XOR размеров кучек равен 0 (проверка перебором).
3) Альфа-бета отсечения: сколько листьев экономит идеальный порядок ходов.
4) Торг Рубинштейна и порог мрачного триггера.
5) Турнир Аксельрода без шума и с шумом 5 %, экологический турнир.
"""

import math
import sys
from functools import lru_cache
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import BLUE, ORANGE, RED

ex = Example(__file__)


# 1. Обратная индукция
def solve(node):
    """Узел: (кто ходит, {действие: поддерево}); лист: (выигрыш 1, выигрыш 2)."""
    if not isinstance(node[1], dict):
        return node, []
    player, moves = node
    (pay, path), action = max(((solve(ch), a) for a, ch in moves.items()), key=lambda r: r[0][0][player])
    return pay, [action] + path


entry = (0, {"не входить": (0, 10), "войти": (1, {"война": (-2, 2), "поделить": (3, 5)})})
ult = (0, {f"дать {k}": (1, {"да": (5 - k, k), "нет": (0, 0)}) for k in range(1, 5)})
cent = (6, 5)
for k, pay in reversed(list(enumerate([(1, 0), (0, 2), (3, 1), (2, 4), (5, 3), (4, 6)]))):
    cent = (k % 2, {"взять": pay, "передать": cent})
for name, tree in [("вход на рынок", entry), ("ультиматум", ult), ("сороконожка", cent)]:
    print(f"1) {name}: {solve(tree)}")
assert solve(entry) == ((3, 5), ["войти", "поделить"]) and solve(ult)[0] == (4, 1) and solve(cent)[0] == (1, 0)


# 2. Ним
@lru_cache(None)
def win(state):
    return any(not win(tuple(sorted(state[:i] + (v,) + state[i + 1:]))) for i, h in enumerate(state) for v in range(h))


assert all(win(tuple(sorted(s))) == ((s[0] ^ s[1] ^ s[2]) != 0) for s in product(range(8), repeat=3))
s = 3 ^ 4 ^ 5
print(f"2) ним (3, 4, 5): XOR = {s}; ход — оставить в первой кучке {3 ^ s}; правило XOR подтверждено перебором до 7")


# 3. Альфа-бета
def alphabeta(leaves, b, d, order):
    count = [0]

    def exact(lo, depth, mx):
        if depth == d:
            return leaves[lo]
        span = b ** (d - depth - 1)
        vals = [exact(lo + k * span, depth + 1, not mx) for k in range(b)]
        return max(vals) if mx else min(vals)

    def go(lo, depth, a, bt, mx):
        if depth == d:
            count[0] += 1
            return leaves[lo]
        span = b ** (d - depth - 1)
        kids = sorted(range(b), key=lambda k: exact(lo + k * span, depth + 1, not mx), reverse=mx) if order else range(b)
        best = -math.inf if mx else math.inf
        for k in kids:
            v = go(lo + k * span, depth + 1, a, bt, not mx)
            if mx:
                best, a = max(best, v), max(a, v)
            else:
                best, bt = min(best, v), min(bt, v)
            if a >= bt:
                break
        return best

    return go(0, 0, -math.inf, math.inf, True), count[0], exact(0, 0, True)


rows = []
for d in range(1, 7):
    rnd, best = [], []
    for t in range(30):
        rng = Mulberry32(1000 + t)
        lv = [rng.randint(19) - 9 for _ in range(3**d)]
        v1, c1, e = alphabeta(lv, 3, d, False)
        v2, c2, _ = alphabeta(lv, 3, d, True)
        assert v1 == v2 == e
        rnd.append(c1)
        best.append(c2)
    rows.append((d, 3**d, np.mean(rnd), np.mean(best)))
    print(f"3) d = {d}: листьев {3**d}, альфа-бета {np.mean(rnd):.1f}, идеальный порядок {np.mean(best):.0f}")
assert all(r[3] == 3 ** math.ceil(r[0] / 2) + 3 ** (r[0] // 2) - 1 for r in rows)


# 4. Торг и триггер
def rubinstein(d1, d2, T):
    share = 1.0
    for k in range(2, T + 1):
        share = 1 - (d2 if (T - k) % 2 == 0 else d1) * share
    return share


print(f"4) Рубинштейн δ = (0.9, 0.8): T = 1 → {rubinstein(0.9, 0.8, 1)}, T = 6 → {rubinstein(0.9, 0.8, 6):.4f}, T = 61 → {rubinstein(0.9, 0.8, 61):.4f}, формула {0.2 / 0.28:.4f}")
assert abs(rubinstein(0.9, 0.9, 101) - 1 / 1.9) < 1e-4
print("   мрачный триггер (5, 3, 1): δ* =", (5 - 3) / (5 - 1))

# 5. Аксельрод
PAY = [[3, 0], [5, 1]]
STRATS = {
    "всегда сотрудничать": lambda me, op, rng: 0,
    "всегда предавать": lambda me, op, rng: 1,
    "око за око": lambda me, op, rng: op[-1] if op else 0,
    "подозрительное око за око": lambda me, op, rng: op[-1] if op else 1,
    "око за два ока": lambda me, op, rng: 1 if len(op) >= 2 and op[-1] and op[-2] else 0,
    "мрачный триггер": lambda me, op, rng: 1 if 1 in op else 0,
    "Павлов": lambda me, op, rng: (0 if me[-1] == op[-1] else 1) if me else 0,
    "щедрое око за око": lambda me, op, rng: (0 if rng.random() < 1 / 3 else 1) if op and op[-1] else 0,
    "случайно": lambda me, op, rng: 0 if rng.random() < 0.5 else 1,
}
names, fs = list(STRATS), list(STRATS.values())


def tournament(noise, rounds=200, seed=1):
    n = len(fs)
    W = np.zeros((n, n))
    for i in range(n):
        for j in range(i, n):
            rng = Mulberry32(1000 * seed + 37 * i + j)
            a, b, sa, sb = [], [], 0, 0
            for _ in range(rounds):
                x, y = fs[i](a, b, rng), fs[j](b, a, rng)
                if noise > 0:
                    if rng.random() < noise:
                        x = 1 - x
                    if rng.random() < noise:
                        y = 1 - y
                a.append(x)
                b.append(y)
                sa += PAY[x][y]
                sb += PAY[y][x]
            W[i, j], W[j, i] = sa / rounds, sb / rounds
    return W


res = {}
for noise in (0.0, 0.05):
    W = tournament(noise)
    x = np.ones(len(fs)) / len(fs)
    for _ in range(60):
        f = W @ x
        x = x * f / (x @ f)
    res[noise] = (W.mean(1), x)
    order = np.argsort(-W.mean(1))
    print(f"5) шум {noise:.0%}: " + "; ".join(f"{names[k]} {W[k].mean():.3f}" for k in order))
    print(f"   экологический турнир, 60 поколений: лидер «{names[int(np.argmax(x))]}» {x.max():.0%}")
assert names[int(np.argmax(res[0.05][0]))] == "щедрое око за око" and names[int(np.argmin(res[0.0][0]))] == "всегда предавать"

fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.4))
dd = [r[0] for r in rows]
a1.plot(dd, [r[1] for r in rows], color=RED, marker="o", label="полный перебор 3ᵈ")
a1.plot(dd, [r[2] for r in rows], color=BLUE, marker="o", label="альфа-бета, случайный порядок")
a1.plot(dd, [r[3] for r in rows], color=ORANGE, marker="o", ls="--", label="альфа-бета, идеальный порядок")
a1.set(yscale="log", xlabel="глубина d", ylabel="листьев вычислено", title="Альфа-бета (ветвление 3, 30 деревьев)")
a1.legend(fontsize=8)
sc = res[0.05][0]
order = np.argsort(sc)
a2.barh(range(len(fs)), sc[order], color=[ORANGE if names[k] == "око за око" else BLUE for k in order])
a2.set_yticks(range(len(fs)), [names[k] for k in order], fontsize=8)
a2.set(xlim=(1.8, 2.4), xlabel="средний выигрыш за раунд", title="Аксельрод с шумом 5 %")
ex.finish(fig, "sequential_and_repeated")
