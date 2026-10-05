"""Таблицы истинности, законы, следование, нормальные формы и полнота связок.

Запуск:  python lessons/lesson_15_19/examples/truth_tables_and_laws.py [--save] [--no-show]

1) Законы логики и правильные/ошибочные рассуждения — перебором всех строк таблицы.
2) СДНФ по таблице и минимальная ДНФ (перебор импликант) для функций урока.
3) Всё из NAND и классы Поста: какие наборы связок полны.
4) Рисунок: все 16 булевых функций двух переменных и их классы Поста.
"""

import sys
from itertools import combinations, product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import matplotlib.pyplot as plt
import numpy as np

from gbcourse.cli import Example
from gbcourse.style import BLUE, MUTED, ORANGE

ex = Example(__file__)
imp = lambda a, b: (not a) or b
rows = lambda n: list(product([False, True], repeat=n))

# 1. Законы и рассуждения
laws = {
    "де Морган ∧": lambda A, B, C: (not (A and B)) == ((not A) or (not B)),
    "дистрибутивность ∨ над ∧": lambda A, B, C: (A or (B and C)) == ((A or B) and (A or C)),
    "поглощение": lambda A, B, C: (A or (A and B)) == A,
    "экспорт": lambda A, B, C: imp(A, imp(B, C)) == imp(A and B, C),
    "закон Пирса": lambda A, B, C: imp(imp(imp(A, B), A), A),
    "контрапозиция": lambda A, B, C: imp(A, B) == imp(not B, not A),
    "обращение (ловушка)": lambda A, B, C: imp(A, B) == imp(B, A),
    "скобки у импликации (ловушка)": lambda A, B, C: imp(imp(A, B), C) == imp(A, imp(B, C)),
}
print("1) Законы (перебор 8 строк):")
for name, law in laws.items():
    bad = [tuple(map(int, r)) for r in rows(3) if not law(*r)]
    print(f"   {name:32s} {'закон' if not bad else 'НЕТ, контрпример ' + str(bad[0])}")
    assert (not bad) == ("ловушка" not in name)


def entails(premises, concl, n):
    return all(concl(*r) for r in rows(n) if all(p(*r) for p in premises))


args = {
    "modus ponens": ([lambda A, B: imp(A, B), lambda A, B: A], lambda A, B: B, True),
    "modus tollens": ([lambda A, B: imp(A, B), lambda A, B: not B], lambda A, B: not A, True),
    "утверждение следствия": ([lambda A, B: imp(A, B), lambda A, B: B], lambda A, B: A, False),
    "отрицание основания": ([lambda A, B: imp(A, B), lambda A, B: not A], lambda A, B: not B, False),
    "из противоречия — что угодно": ([lambda A, B: A, lambda A, B: not A], lambda A, B: B, True),
}
for name, (prem, concl, expect) in args.items():
    ok = entails(prem, concl, 2)
    print(f"   {name:30s} {'правильно' if ok else 'ошибка'}")
    assert ok == expect


# 2. СДНФ и минимальная ДНФ
def sdnf(f, n, names="ABCD"):
    terms = [" ∧ ".join(v if b else "¬" + v for v, b in zip(names, r)) for r in rows(n) if f(*r)]
    return " ∨ ".join(f"({t})" for t in terms) or "0"


def min_dnf(f, n):
    """Наименьшее покрытие единиц импликантами (кубы: -1 — переменная не входит)."""
    ones = [r for r in rows(n) if f(*r)]
    cubes = [c for c in product([-1, 0, 1], repeat=n)
             if all(f(*r) for r in rows(n) if all(ci < 0 or ci == ri for ci, ri in zip(c, r)))]
    covers = lambda c, r: all(ci < 0 or ci == ri for ci, ri in zip(c, r))
    for k in range(1, len(ones) + 1):
        best = [s for s in combinations(cubes, k) if all(any(covers(c, r) for c in s) for r in ones)]
        if best:
            return min(best, key=lambda s: sum(ci >= 0 for c in s for ci in c))
    return ()


fmt = lambda c, names="ABCD": " ∧ ".join(v if b else "¬" + v for v, b in zip(names, c) if b >= 0) or "1"
funcs = {
    "большинство": (lambda A, B, C: A + B + C >= 2, 3),
    "чётность": (lambda A, B, C: (A + B + C) % 2 == 1, 3),
    "селектор A ? B : C": (lambda A, B, C: B if A else C, 3),
    "цифры 5–9 (без безразличных)": (lambda A, B, C, D: 5 <= 8 * A + 4 * B + 2 * C + D <= 9, 4),
}
print("\n2) СДНФ → минимальная ДНФ:")
sizes = {}
for name, (f, n) in funcs.items():
    m = min_dnf(f, n)
    sizes[name] = (sum(f(*r) for r in rows(n)), len(m))
    print(f"   {name:30s} СДНФ: {sizes[name][0]} слаг. → минимальная: {' ∨ '.join('(' + fmt(c) + ')' for c in m)}")
print("   СДНФ большинства:", sdnf(funcs["большинство"][0], 3))
assert sizes["большинство"] == (4, 3) and sizes["чётность"] == (4, 4) and sizes["селектор A ? B : C"][1] == 2

# 3. NAND и классы Поста
nand = lambda a, b: not (a and b)
built = {
    "¬A": (lambda A, B: nand(A, A), lambda A, B: not A),
    "A ∧ B": (lambda A, B: nand(nand(A, B), nand(A, B)), lambda A, B: A and B),
    "A ∨ B": (lambda A, B: nand(nand(A, A), nand(B, B)), lambda A, B: A or B),
    "A ⊕ B": (lambda A, B: nand(nand(A, nand(A, B)), nand(B, nand(A, B))), lambda A, B: A != B),
}
print("\n3) Из NAND:", {k: all(g(*r) == t(*r) for r in rows(2)) for k, (g, t) in built.items()})
assert all(all(g(*r) == t(*r) for r in rows(2)) for g, t in built.values())


def post(col):
    """Классы Поста функции двух переменных по столбцу (00, 01, 10, 11)."""
    R = list(product([0, 1], repeat=2))
    v = dict(zip(R, col))
    c = list(col)
    for b in range(2):
        for i in range(4):
            if i >> b & 1:
                c[i] ^= c[i ^ (1 << b)]
    return {"T0": v[(0, 0)] == 0, "T1": v[(1, 1)] == 1, "S": all(v[r] != v[(1 - r[0], 1 - r[1])] for r in R),
            "M": all(v[a] <= v[b] for a in R for b in R if a[0] <= b[0] and a[1] <= b[1]), "L": c[3] == 0}


CL = ["T0", "T1", "S", "M", "L"]
complete = lambda cols: all(any(not post(c)[k] for c in cols) for k in CL)
sets = {"{∧, ∨}": [(0, 0, 0, 1), (0, 1, 1, 1)], "{¬, ∧}": [(1, 1, 0, 0), (0, 0, 0, 1)], "{↑}": [(1, 1, 1, 0)],
        "{→}": [(1, 1, 0, 1)], "{→, 0}": [(1, 1, 0, 1), (0, 0, 0, 0)], "{⊕, ↔}": [(0, 1, 1, 0), (1, 0, 0, 1)]}
res = {k: complete(v) for k, v in sets.items()}
print("   полнота наборов:", res)
assert res == {"{∧, ∨}": False, "{¬, ∧}": True, "{↑}": True, "{→}": False, "{→, 0}": True, "{⊕, ↔}": False}

# 4. Рисунок
names = ["0", "A∧B", "A∧¬B", "A", "¬A∧B", "B", "A⊕B", "A∨B", "A↓B", "A↔B", "¬B", "B→A", "¬A", "A→B", "A↑B", "1"]
cols = [tuple((code >> (3 - k)) & 1 for k in range(4)) for code in range(16)]
M = np.array(cols).T
P = np.array([[post(c)[k] for c in cols] for k in CL], float)
fig, (a1, a2) = plt.subplots(2, 1, figsize=(11, 5.4), gridspec_kw={"height_ratios": [4, 5]}, sharex=True)
a1.imshow(M, cmap=plt.matplotlib.colors.ListedColormap(["#f3f2ee", BLUE]), aspect="auto")
a1.set_yticks(range(4), ["f(0,0)", "f(0,1)", "f(1,0)", "f(1,1)"])
a1.set_title("Все 16 булевых функций двух переменных (синий — 1)")
a2.imshow(P, cmap=plt.matplotlib.colors.ListedColormap(["#f3f2ee", ORANGE]), aspect="auto")
a2.set_yticks(range(5), ["сохраняет 0", "сохраняет 1", "самодвойств.", "монотонна", "линейна"])
a2.set_xticks(range(16), names, rotation=45)
a2.set_title("Классы Поста (оранжевый — функция лежит в классе); ↑ и ↓ вне всех пяти")
for a in (a1, a2):
    a.set_xticks(np.arange(-0.5, 16), minor=True)
    a.grid(which="minor", color=MUTED, lw=0.5)
    a.grid(which="major", visible=False)
fig.tight_layout()
ex.finish(fig, "boolean_functions")
