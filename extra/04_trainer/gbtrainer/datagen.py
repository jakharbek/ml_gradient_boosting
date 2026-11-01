"""Случайные данные для тетради: полный факторный план 2^k и аддитивная модель с шумом.

y = база + Σⱼ sᵢⱼ·aⱼ + шумᵢ,  где sᵢⱼ = −1 / +1 — значение признака j у объекта i.

* Вклады aⱼ различаются в 2–6 раз: одна колонка «весит» больше и забирает первые шаги.
* Шум — комбинация взаимодействий (s₁·s₂, s₁·s₂·s₃ …). Он ортогонален каждому признаку и
  константе, поэтому среднее остаётся целым (= база), а Σ|rᵢ| сходится ровно к Σ|шум|:
  пни по одному признаку его не видят. Это и есть «пол» из подсказки тетради.
* Всё случайное — из Mulberry32(seed): одинаковый seed → одинаковая тетрадь.
"""

from __future__ import annotations

from decimal import Decimal
from itertools import product

from .model import LETTERS, Dataset, Level, SpecError, Structure, get_level, make_dataset
from .rng import Mulberry32
from .solver import solve
from .themes import THEMES, get_theme

PATTERNS = {
    1: [(1,)],
    2: [(1, 2), (1, 3), (1, 4), (1, 3), (2, 5)],
    3: [(1, 2, 4), (1, 2, 5), (1, 3, 6), (1, 2, 3), (1, 3, 5)],
}


def theme_for_seed(seed: int) -> str:
    """Сюжет «наугад» — тоже от seed, чтобы вариант воспроизводился."""
    keys = sorted(THEMES)
    return keys[Mulberry32(seed ^ 0x5EED).randint(len(keys))]


def random_dataset(
    *,
    seed: int,
    level: int | Level = 3,
    theme: str | None = None,
    features: int | None = None,
    noise: bool | None = None,
    lr: Decimal | None = None,
    steps: int | None = None,
    avoid_near_ties: bool = False,
) -> Dataset:
    """Сгенерировать данные. ``avoid_near_ties`` — подобрать вариант без почти равных сумм
    при выборе колонки (нужно строгой проверке: ученик с другим округлением мог бы выбрать иначе)."""
    lv = level if isinstance(level, Level) else get_level(level)
    key = theme if theme and theme != "random" else theme_for_seed(seed)
    th = get_theme(key)
    k = features or lv.features
    if k not in PATTERNS or k > len(th.features):
        raise SpecError("случайные данные строятся для 1–3 признаков")
    with_noise = lv.noise if noise is None else noise
    lr = lv.lr if lr is None else lr
    steps = lv.steps if steps is None else steps

    rng = Mulberry32(seed)
    best: tuple[int, Dataset] | None = None
    for _attempt in range(400):
        base = rng.grid(*th.base)
        unit = rng.grid(*th.effect)
        mult = list(rng.choice(PATTERNS[k]))
        rng.shuffle(mult)  # какая колонка «тяжелее» — случайно
        effects = tuple(unit * m for m in mult)
        signs = list(product((-1, 1), repeat=k))  # A = все «без вклада», …, последняя = все «со вкладом»
        noise_v = [0] * len(signs)
        if with_noise and k >= 2:
            e = rng.grid(th.noise[0], th.noise[1], 1) * (1 if rng.random() < 0.5 else -1)
            noise_v = [e * _prod(s) for s in signs]
            if k == 3:  # ещё одно парное взаимодействие, чтобы шум не был «шахматным»
                p, q = rng.choice([(0, 1), (0, 2), (1, 2)])
                e2 = rng.grid(0, max(1, th.noise[1] // 2), 1) * (1 if rng.random() < 0.5 else -1)
                noise_v = [v + e2 * s[p] * s[q] for v, s in zip(noise_v, signs)]
        ys = [base + sum(s[j] * effects[j] for j in range(k)) + noise_v[i] for i, s in enumerate(signs)]
        if min(ys) <= max(1, base // 4):
            continue
        feats = th.features[:k]
        rows = [[LETTERS[i], *(feats[j].levels[(s[j] + 1) // 2] for j in range(k)), ys[i]] for i, s in enumerate(signs)]
        ds = make_dataset(
            features=[f.name for f in feats], rows=rows, levels=[list(f.levels) for f in feats],
            object=th.object, each=th.each, target=th.target, quantity=th.quantity,
            structure=Structure(base, effects, tuple(noise_v)), theme=th.key,
        )
        if not avoid_near_ties:
            return ds
        bad = len(solve(ds, lr, steps).near_ties())
        if bad == 0:
            return ds
        if best is None or bad < best[0]:
            best = (bad, ds)
    if best is None:
        raise SpecError(f"не удалось подобрать данные для сюжета «{key}» — попробуйте другой seed")
    return best[1]


def _prod(s: tuple[int, ...]) -> int:
    out = 1
    for v in s:
        out *= v
    return out
