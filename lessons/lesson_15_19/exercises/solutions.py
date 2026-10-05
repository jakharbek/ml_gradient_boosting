"""Решения упражнений урока 15.19 «Математическая логика: высказывания, кванторы, доказательства».

Запуск:  python lessons/lesson_15_19/exercises/solutions.py
"""

import sys
from itertools import combinations, product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd

from gbcourse.boosting import GBRegressor
from gbcourse.datasets import friedman1

imp = lambda a, b: (not a) or b
rows = lambda n: list(product([False, True], repeat=n))
taut = lambda f, n: all(f(*r) for r in rows(n))

# 1. Тавтологии
forms = {
    "(A → B) ∨ (B → A)": lambda A, B: imp(A, B) or imp(B, A),
    "(A → B) → A": lambda A, B: imp(imp(A, B), A),
    "((A → B) → A) → A": lambda A, B: imp(imp(imp(A, B), A), A),
    "A → (B → A)": lambda A, B: imp(A, imp(B, A)),
    "(A → B) ∧ (A → ¬B) → ¬A": lambda A, B: imp(imp(A, B) and imp(A, not B), not A),
}
res1 = {k: taut(f, 2) for k, f in forms.items()}
print("1)", res1)
assert res1 == {k: k != "(A → B) → A" for k in forms}

# 2. Перевод: A — «модель примут», B — «AUC > 0.8»; L — утечка, V — переобучение
only_if = lambda A, B: imp(A, B)
if_ = lambda A, B: imp(B, A)
diff_a = [tuple(map(int, r)) for r in rows(2) if only_if(*r) != if_(*r)]
neither = lambda L, V: (not L) and (not V)
not_both = lambda L, V: not (L and V)
diff_b = [tuple(map(int, r)) for r in rows(2) if neither(*r) != not_both(*r)]
print("2) расходятся: (а) в строках (A, B) =", diff_a, "; (б) в строках (L, V) =", diff_b)
assert diff_a == [(0, 1), (1, 0)] and diff_b == [(0, 1), (1, 0)]

# 3. Отрицания: ∀лист n ≥ 5  →  ∃лист n < 5;  ∃f ∀t S(t, f)  →  ∀f ∃t ¬S(t, f);
#    ∀ε>0 ∃δ>0 ∀x (|x−a|<δ → |f(x)−f(a)|<ε)  →  ∃ε>0 ∀δ>0 ∃x (|x−a|<δ ∧ |f(x)−f(a)| ≥ ε)
leaves = [12, 7, 3, 20]
assert (not all(n >= 5 for n in leaves)) == any(n < 5 for n in leaves)
splits = {"t1": {"x1", "x2"}, "t2": {"x1"}, "t3": {"x1", "x3"}}
feats = ["x1", "x2", "x3"]
orig = any(all(f in s for s in splits.values()) for f in feats)
neg = all(any(f not in s for s in splits.values()) for f in feats)
print("3) «есть признак во всех деревьях»:", orig, "; отрицание:", neg)
assert orig is True and neg == (not orig)

# 4. Рыцари и лжецы (True — рыцарь)
def solve(says):
    return [w for w in rows(3) if all(w["ABC".index(p)] == f(*w) for p, f in says.items())]


says = {"A": lambda A, B, C: not B, "B": lambda A, B, C: A != C, "C": lambda A, B, C: imp(C, A)}
sols = solve(says)
print("4) решения (A, B, C):", [tuple("рыцарь" if x else "лжец" for x in w) for w in sols])
assert sols == [(True, False, True)]
# Рассуждение. Условие для C: C ↔ (C → A). Если C — лжец (C = 0), его фраза «C → A» истинна (условие ложно) —
# лжец сказал правду, противоречие. Значит, C — рыцарь, фраза верна, и A — рыцарь. Тогда фраза A «B — лжец» верна:
# B — лжец. Проверка: B сказал «A и C разного типа» — а оба рыцари, фраза ложна, как и положено лжецу.
same = solve({**says, "B": lambda A, B, C: A == C})
print("   если B скажет «одного типа»: решений", len(same), "— условия противоречивы (как «Я лжец»)")
assert same == []

# 5. Всё через NOR
nor = lambda a, b: not (a or b)
via = {
    "¬A": (lambda A, B: nor(A, A), lambda A, B: not A),
    "A ∨ B": (lambda A, B: nor(nor(A, B), nor(A, B)), lambda A, B: A or B),
    "A ∧ B": (lambda A, B: nor(nor(A, A), nor(B, B)), lambda A, B: A and B),
    "A → B": (lambda A, B: nor(nor(nor(A, A), B), nor(nor(A, A), B)), lambda A, B: imp(A, B)),
}
res5 = {k: all(g(*r) == t(*r) for r in rows(2)) for k, (g, t) in via.items()}
print("5)", res5, "— ¬ и ∨ достаточно: ∧ и → выражаются через них (де Морган, A → B = ¬A ∨ B)")
assert all(res5.values())

# 6. Карта Карно
ones = {0, 1, 2, 5, 6, 7, 8, 9, 10, 14}
cubes = [c for c in product([-1, 0, 1], repeat=4)
         if all((8 * r[0] + 4 * r[1] + 2 * r[2] + r[3]) in ones
                for r in product([0, 1], repeat=4) if all(ci < 0 or ci == ri for ci, ri in zip(c, r)))]
covers = lambda c, m: all(ci < 0 or ci == ((m >> (3 - j)) & 1) for j, ci in enumerate(c))
best = None
for k in range(1, 6):
    for s in combinations(cubes, k):
        if all(any(covers(c, m) for c in s) for m in ones):
            lit = sum(ci >= 0 for c in s for ci in c)
            if best is None or lit < best[0]:
                best = (lit, s)
    if best:
        break
term = lambda c: " ∧ ".join(v if b else "¬" + v for v, b in zip("ABCD", c) if b >= 0)
print("6) минимальная ДНФ:", " ∨ ".join("(" + term(c) + ")" for c in best[1]), f"— {best[0]} литералов против {4 * len(ones)} в СДНФ")
assert len(best[1]) == 3 and best[0] == 7

# 7. Маски и пропуски
df = pd.DataFrame({"age": [25, np.nan, 47, 33, np.nan, 19], "income": [40, 55, np.nan, 70, 30, 80]})
right = ((df.age <= 30) | df.age.isna()) & (df.income >= 50)
lazy = ~(df.age > 30) & (df.income >= 50)
print("7) правильно:", list(df.index[right]), " через ~:", list(df.index[lazy]))
assert list(df.index[right]) == list(df.index[lazy]) == [1, 5]
# ~ совпал случайно: он приписывает пропуск к «≤ 30», что здесь и требовалось. Для условия «не старше 30 (известно)»
# правильная маска (df.age <= 30) — и ~(df.age > 30) ошибётся, добавив строку 1:
assert list(df.index[(df.age <= 30) & (df.income >= 50)]) == [5] and list(df.index[lazy]) != [5]

# 8. Метрики: из 1000 объектов 100 положительных; полнота 0.6 → TP = 60, FN = 40; точность 0.9 → FP = 60 / 0.9 − 60
TP, FN = 60, 40
FP = TP / 0.9 - TP
TN = 900 - FP
spec, npv = TN / (TN + FP), TN / (TN + FN)
print(f"8) FP = {FP:.2f}, специфичность {spec:.4f}, NPV {npv:.4f} — доли разных условных вероятностей не равны")
assert abs(spec - (900 - 20 / 3) / 900) < 1e-12 and abs(npv - 0.95714) < 1e-4

# 9. Индукция
S = lambda n: n * (n + 1) * (2 * n + 1) // 6
assert all(sum(k * k for k in range(1, n + 1)) == S(n) for n in range(1, 1001))
assert all(S(n) + (n + 1) ** 2 == S(n + 1) for n in range(-1000, 1000))
print("9) формула верна для n ≤ 1000; шаг S(n) + (n+1)² = S(n+1) — тождество многочленов (проверено в 2000 точках, степень 3)")

# 10. Остатки
a = all((r**7 - r) % 42 == 0 for r in range(42))
b = all((r * r + r + 1) % 5 != 0 for r in range(5))
c = [r for r in range(7) if (r * r + r + 1) % 7 == 0]
print("10) n⁷ − n делится на 42:", a, "; n² + n + 1 не делится на 5:", b, "; делится на 7 при n ≡", c, "(mod 7) — например, n = 2: 7")
assert a and b and c == [2, 4]

# 11. Пни аддитивны
X, y = friedman1(n=400, seed=1)
base = X[:50].copy()
for depth in (1, 2):
    m = GBRegressor(n_estimators=150, learning_rate=0.1, max_depth=depth).fit(X, y)
    q = np.array([0.2, 0.8])
    viol = []
    for x in base:
        pts = []
        for v0, v1 in product(q, q):
            z = x.copy()
            z[0], z[1] = v0, v1
            pts.append(z)
        F = m.predict(np.array(pts))           # (0.2,0.2), (0.2,0.8), (0.8,0.2), (0.8,0.8)
        viol.append(abs(F[0] + F[3] - F[1] - F[2]))
    print(f"11) max_depth = {depth}: max |F(a,b) + F(a',b') − F(a,b') − F(a',b)| = {max(viol):.2e}")
    assert (max(viol) < 1e-9) == (depth == 1)


# 12. Раскраска цикла в 2 цвета
def cnf_cycle(n):
    x = lambda v: v + 1                       # x_v = 1 — вершина v синяя, 0 — оранжевая
    cl = []
    for v in range(n):
        u = (v + 1) % n
        cl += [[x(v), x(u)], [-x(v), -x(u)]]  # соседи разного цвета: x_v ⊕ x_u
    return cl


def dpll(clauses, n):
    val = [0] * (n + 1)
    trail, stats = [], {"decide": 0}
    lit = lambda q: 0 if val[abs(q)] == 0 else (1 if (q > 0) == (val[abs(q)] > 0) else -1)

    def propagate():
        while True:
            changed = False
            for c in clauses:
                vs = [lit(q) for q in c]
                if 1 in vs:
                    continue
                free = [q for q, v in zip(c, vs) if v == 0]
                if not free:
                    return True
                if len(free) == 1:
                    val[abs(free[0])] = 1 if free[0] > 0 else -1
                    trail.append((free[0], "unit", False))
                    changed = True
            if not changed:
                return False
    conflict = propagate()
    while True:
        if conflict:
            while trail:
                q, why, flipped = trail.pop()
                val[abs(q)] = 0
                if why == "decide" and not flipped:
                    break
            else:
                return False, stats
            val[abs(q)] = -1 if q > 0 else 1
            trail.append((-q, "decide", True))
            stats["decide"] += 1
            conflict = propagate()
            continue
        free = [v for v in range(1, n + 1) if val[v] == 0]
        if not free:
            return True, stats
        val[free[0]] = 1
        trail.append((free[0], "decide", False))
        stats["decide"] += 1
        conflict = propagate()


for n in (5, 6, 7, 8):
    cl = cnf_cycle(n)
    brute = any(all(any((q > 0) == r[abs(q) - 1] for q in c) for c in cl) for r in product([False, True], repeat=n))
    sat, st = dpll(cl, n)
    print(f"12) цикл из {n}: перебор — {'раскрашивается' if brute else 'нет'}, DPLL — {'выполнима' if sat else 'невыполнима'}, решений {st['decide']}")
    assert brute == sat == (n % 2 == 0)
print("    Цикл раскрашивается в 2 цвета тогда и только тогда, когда его длина чётна: цвета обязаны чередоваться.")
