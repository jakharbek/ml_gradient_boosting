"""Реалистичные синтетические наборы для примеров уровней 3–4.

Все наборы воспроизводимы (зерно), размер задаётся параметром, у каждого известна «истинная» зависимость —
поэтому в примерах можно проверять не только метрики, но и то, нашла ли модель правильную структуру.

    make_houses(n)        — цены квартир: регрессия, числа + категории + пропуски + взаимодействия
    make_customers(n)     — отток/отклик клиентов: бинарная классификация с редким классом
    make_store_sales(…)   — продажи магазинов по дням: временной ряд с сезонностью и праздниками
    make_search(n_q)      — поисковые запросы и документы: ранжирование
    make_claims(n)        — страховые случаи: счётная цель (Пуассон) и суммы (Твиди)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

DISTRICTS = [f"район_{i:02d}" for i in range(30)]


def make_houses(n: int = 20_000, seed: int = 0) -> tuple[pd.DataFrame, np.ndarray]:
    """Цены квартир (млн руб.).

    Признаки: площадь, комнаты, этаж, этажность, год постройки, расстояние до центра (км), район (30 значений,
    частоты убывают), парковка (0/1), состояние ремонта (категория), площадь кухни (5% пропусков).
    Истина: цена ≈ площадь × цена_м²(район, расстояние, год) × множители (этаж, ремонт, парковка) + шум 8%.
    Взаимодействия: первый и последний этаж дешевле; новые дома дороже, но только близко к центру.
    """
    r = np.random.default_rng(seed)
    p_d = 1 / np.arange(1, 31)
    p_d /= p_d.sum()
    district = r.choice(30, n, p=p_d)
    district_level = np.random.default_rng(1000).uniform(0.6, 1.6, 30)
    rooms = r.choice([1, 2, 3, 4, 5], n, p=[0.3, 0.35, 0.22, 0.1, 0.03])
    area = np.clip(18 + 17 * rooms + r.normal(0, 8, n), 16, 250)
    floors_total = r.choice([5, 9, 12, 17, 25], n, p=[0.25, 0.3, 0.15, 0.2, 0.1])
    floor = np.array([r.integers(1, f + 1) for f in floors_total])
    year = np.clip(r.normal(1990, 20, n).round(), 1930, 2025)
    distance = np.clip(r.gamma(2.5, 3.0, n), 0.3, 40)
    parking = (r.random(n) < 0.25 + 0.3 * (year > 2010)).astype(int)
    repair = r.choice(["без ремонта", "косметический", "евро", "дизайнерский"], n, p=[0.2, 0.45, 0.28, 0.07])
    kitchen = np.clip(area * r.uniform(0.12, 0.22, n), 5, 40)
    price_m2 = 0.18 * district_level[district] * np.exp(-0.035 * distance) * (1 + 0.004 * np.clip(year - 1990, -40, 35) * (distance < 8))
    mult = np.where((floor == 1) | (floor == floors_total), 0.92, 1.0)
    mult *= pd.Series(repair).map({"без ремонта": 0.88, "косметический": 1.0, "евро": 1.1, "дизайнерский": 1.25}).to_numpy()
    mult *= 1 + 0.05 * parking
    price = area * price_m2 * mult * np.exp(r.normal(0, 0.08, n))
    kitchen[r.random(n) < 0.05] = np.nan
    X = pd.DataFrame({
        "площадь": area.round(1), "комнаты": rooms, "этаж": floor, "этажность": floors_total, "год": year.astype(int),
        "до_центра_км": distance.round(2), "район": pd.Categorical([DISTRICTS[d] for d in district], categories=DISTRICTS),
        "парковка": parking, "ремонт": pd.Categorical(repair), "кухня": kitchen.round(1),
    })
    return X, price.round(3)


def make_customers(n: int = 50_000, positive_rate: float = 0.02, seed: int = 0) -> tuple[pd.DataFrame, np.ndarray]:
    """Отклик клиентов на предложение (редкий класс 1).

    Признаки: возраст, доход (логнормальный, 10% пропусков — чаще у откликнувшихся), стаж клиента (мес),
    число покупок, дней с последней покупки, канал (категория), регион (50 значений), подписка (0/1).
    Истина: логит — нелинейная функция признаков с взаимодействием «подписка × недавняя покупка».
    Свободный член подбирается так, чтобы доля класса 1 была равна positive_rate.
    """
    r = np.random.default_rng(seed)
    age = np.clip(r.normal(40, 12, n), 18, 80)
    income = np.exp(r.normal(10.8, 0.5, n))
    tenure = r.integers(1, 120, n)
    purchases = r.poisson(3 + tenure / 20)
    recency = np.clip(r.exponential(40, n), 0, 365)
    channel = r.choice(["сайт", "приложение", "офис", "партнёр"], n, p=[0.4, 0.35, 0.15, 0.1])
    region = r.integers(0, 50, n)
    subscribed = (r.random(n) < 0.3).astype(int)
    region_eff = np.random.default_rng(2000).normal(0, 0.4, 50)
    z = (0.6 * np.log1p(purchases) - 0.012 * recency + 0.8 * subscribed * (recency < 30) - 0.0004 * (age - 35) ** 2
         + 0.3 * (channel == "приложение") + region_eff[region] + 0.4 * np.tanh((np.log(income) - 10.8) * 2))
    lo, hi = -20.0, 20.0
    for _ in range(60):                            # подбор свободного члена под нужную долю класса
        mid = (lo + hi) / 2
        if np.mean(1 / (1 + np.exp(-(z + mid)))) > positive_rate:
            hi = mid
        else:
            lo = mid
    p = 1 / (1 + np.exp(-(z + (lo + hi) / 2)))
    y = (r.random(n) < p).astype(int)
    income_obs = income.copy()
    income_obs[r.random(n) < 0.08 + 0.15 * y] = np.nan
    X = pd.DataFrame({
        "возраст": age.round(0), "доход": income_obs.round(0), "стаж_мес": tenure, "покупок": purchases,
        "дней_с_покупки": recency.round(0), "канал": pd.Categorical(channel), "регион": pd.Categorical(region.astype(str)),
        "подписка": subscribed,
    })
    return X, y


def make_store_sales(n_stores: int = 50, n_days: int = 730, seed: int = 0) -> pd.DataFrame:
    """Продажи магазинов по дням: тренд, недельная и годовая сезонность, праздники, промо, погода.

    Столбцы: дата, магазин, тип магазина, промо (0/1), праздник (0/1), температура, продажи.
    """
    r = np.random.default_rng(seed)
    dates = pd.date_range("2023-01-01", periods=n_days, freq="D")
    store_level = r.lognormal(4, 0.4, n_stores)
    store_type = r.choice(["у дома", "гипермаркет", "центр"], n_stores, p=[0.6, 0.15, 0.25])
    type_week = {"у дома": [1.0, 1.0, 1.0, 1.05, 1.15, 1.3, 1.1], "гипермаркет": [0.8, 0.8, 0.85, 0.9, 1.1, 1.6, 1.5],
                 "центр": [1.15, 1.15, 1.15, 1.15, 1.2, 0.8, 0.6]}
    holidays = set(pd.to_datetime(["2023-01-01", "2023-01-07", "2023-02-23", "2023-03-08", "2023-05-01", "2023-05-09",
                                   "2023-06-12", "2023-11-04", "2023-12-31", "2024-01-01", "2024-01-07", "2024-02-23",
                                   "2024-03-08", "2024-05-01", "2024-05-09", "2024-06-12", "2024-11-04", "2024-12-31"]))
    rows = []
    for s in range(n_stores):
        temp = 5 + 15 * np.sin(2 * np.pi * (np.arange(n_days) - 100) / 365) + r.normal(0, 3, n_days)
        promo = (r.random(n_days) < 0.1).astype(int)
        for d, date in enumerate(dates):
            hol = int(date in holidays)
            pre_hol = int((date + pd.Timedelta(days=1)) in holidays)
            level = store_level[s] * (1 + 0.0004 * d) * type_week[store_type[s]][date.dayofweek]
            level *= 1 + 0.15 * np.sin(2 * np.pi * (date.dayofyear - 330) / 365)
            level *= (1.35 if promo[d] else 1.0) * (0.6 if hol else 1.0) * (1.5 if pre_hol else 1.0)
            level *= 1 - 0.01 * max(temp[d] - 25, 0)
            rows.append((date, s, store_type[s], promo[d], hol, round(temp[d], 1), r.poisson(level)))
    df = pd.DataFrame(rows, columns=["дата", "магазин", "тип", "промо", "праздник", "температура", "продажи"])
    df["тип"] = pd.Categorical(df["тип"])
    return df


def make_search(n_queries: int = 5000, seed: int = 0) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Поисковые запросы: у каждого 10–50 документов, 12 признаков (текстовое сходство, популярность, свежесть…),
    оценка релевантности 0–4 по скрытой полезности с шумом. Возвращает X, rel, qid (строки упорядочены по qid)."""
    r = np.random.default_rng(seed)
    X, rel, qid = [], [], []
    for q in range(n_queries):
        m = int(r.integers(10, 51))
        Xq = r.normal(0, 1, (m, 12))
        u = (1.2 * Xq[:, 0] + 0.8 * Xq[:, 1] + 0.6 * Xq[:, 0] * Xq[:, 2] - 0.4 * Xq[:, 3] ** 2 + 0.3 * np.tanh(Xq[:, 4])
             + r.normal(0, 0.7, m))
        cuts = np.quantile(u, [0.5, 0.75, 0.9, 0.97])
        X.append(Xq)
        rel.append(np.searchsorted(cuts, u))
        qid.append(np.full(m, q))
    return np.vstack(X), np.concatenate(rel), np.concatenate(qid)


def make_claims(n: int = 200_000, seed: int = 0) -> tuple[pd.DataFrame, np.ndarray, np.ndarray, np.ndarray]:
    """Страхование автомобилей: число страховых случаев за период (Пуассон) и суммарный ущерб (Твиди).

    Признаки: возраст водителя, стаж, мощность, возраст авто, регион (категория), тип (категория), бонус-малус.
    Возвращает X, число случаев, суммарный ущерб, экспозицию (доля года под страховкой).
    """
    r = np.random.default_rng(seed)
    age = r.integers(18, 80, n)
    experience = np.clip(age - 18 - r.integers(0, 10, n), 0, None)
    power = np.clip(r.normal(120, 40, n), 50, 400)
    car_age = r.integers(0, 25, n)
    region = r.choice(["столица", "город", "пригород", "село"], n, p=[0.25, 0.4, 0.2, 0.15])
    kind = r.choice(["седан", "кроссовер", "хэтчбек", "грузовой"], n, p=[0.4, 0.3, 0.2, 0.1])
    bonus = np.clip(r.normal(1.0, 0.25, n), 0.5, 2.5)
    exposure = np.clip(r.uniform(0.1, 1.0, n), 0.1, 1.0)
    reg = pd.Series(region).map({"столица": 1.5, "город": 1.1, "пригород": 0.9, "село": 0.7}).to_numpy()
    lam = 0.08 * exposure * reg * bonus * np.exp(-0.02 * np.minimum(experience, 30)) * (1 + 0.002 * (power - 120)) * (1 + 0.8 * (age < 25))
    claims = r.poisson(lam)
    severity = np.array([r.gamma(2.0, 30000 * (1 + 0.004 * (p - 120))) if c else 0.0 for c, p in zip(claims, power)])
    amount = claims * severity
    X = pd.DataFrame({"возраст": age, "стаж": experience, "мощность": power.round(0), "возраст_авто": car_age,
                      "регион": pd.Categorical(region), "тип": pd.Categorical(kind), "бонус_малус": bonus.round(2)})
    return X, claims, amount.round(0), exposure.round(3)
