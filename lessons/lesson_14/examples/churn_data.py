"""Данные итогового проекта: отток клиентов телеком-оператора (синтетические, воспроизводимые).

Каждая строка — клиент в конкретном месяце (1…24); цель — уйдёт ли он в следующем месяце.
В данных есть всё, что разбиралось в курсе: категории (включая редкие), пропуски, зависящие от цели,
несбалансированные классы (~7% уходов), взаимодействия и сдвиг во времени (повышение цен после 18-го месяца).

Запуск:  python lessons/lesson_14/examples/churn_data.py   — печатает сводку.
Импорт:  from churn_data import make_churn, time_split
"""

import numpy as np
import pandas as pd

CONTRACTS = ["помесячный", "годовой", "двухлетний"]
PAYMENTS = ["карта", "автоплатёж", "наличные", "банковский перевод"]


def make_churn(n_clients: int = 4000, months: int = 24, seed: int = 240) -> pd.DataFrame:
    """Панель «клиент × месяц»; столбец churn — уход в следующем месяце."""
    r = np.random.default_rng(seed)
    n_regions = 60
    region_effect = r.normal(0, 0.5, n_regions)
    region_p = 1 / np.sqrt(np.arange(1, n_regions + 1))
    region_p /= region_p.sum()
    rows = []
    for c in range(n_clients):
        start = int(r.integers(1, months + 1))
        contract = int(r.choice(3, p=[0.55, 0.3, 0.15]))
        payment = int(r.choice(4, p=[0.35, 0.35, 0.15, 0.15]))
        region = int(r.choice(n_regions, p=region_p))
        age = float(np.clip(r.normal(42, 13), 18, 85))
        base_charge = float(r.uniform(15, 80) + 10 * (contract == 0))
        usage_level = float(r.gamma(2.0, 8.0))
        tenure0 = int(r.integers(0, 60))
        for m in range(start, months + 1):
            tenure = tenure0 + (m - start)
            price_up = 1.15 if m > 18 else 1.0                         # сдвиг: подорожание с 19-го месяца
            charge = base_charge * price_up * (1 + r.normal(0, 0.03))
            calls = int(r.poisson(0.4 + 0.02 * max(charge - 50, 0)))
            usage = float(max(usage_level * (1 + r.normal(0, 0.25)), 0))
            last_login = float(r.exponential(4 + 20 * (usage < 5)))
            logit = (-3.4 + 1.1 * (contract == 0) - 0.9 * (contract == 2) + 0.5 * (payment == 2)
                     + 0.035 * (charge - 50) - 0.03 * min(tenure, 48) + 0.45 * calls
                     + 0.03 * last_login - 0.012 * (age - 42) + region_effect[region]
                     + 0.8 * (contract == 0) * (charge > 70))                 # взаимодействие
            churn = int(r.random() < 1 / (1 + np.exp(-logit)))
            usage_obs = usage if r.random() > (0.08 + 0.25 * churn) else np.nan  # пропуски чаще у уходящих
            rows.append((c, m, CONTRACTS[contract], PAYMENTS[payment], f"R{region:02d}", round(age, 1), tenure,
                         round(charge, 2), calls, usage_obs, round(last_login, 1), churn))
            if churn:
                break
    cols = ["client", "month", "contract", "payment", "region", "age", "tenure", "monthly_charge",
            "support_calls", "usage_gb", "days_since_login", "churn"]
    df = pd.DataFrame(rows, columns=cols)
    for col in ("contract", "payment", "region"):
        df[col] = pd.Categorical(df[col])
    return df


FEATURES = ["contract", "payment", "region", "age", "tenure", "monthly_charge", "support_calls", "usage_gb", "days_since_login"]


def time_split(df: pd.DataFrame):
    """Обучение — месяцы 1–14, валидация — 15–18, тест — 19–24 (после подорожания)."""
    return df[df.month <= 14], df[(df.month > 14) & (df.month <= 18)], df[df.month > 18]


if __name__ == "__main__":
    import sys

    sys.stdout.reconfigure(encoding="utf-8")
    df = make_churn()
    tr, va, te = time_split(df)
    print(f"строк {len(df)}, клиентов {df.client.nunique()}, доля уходов {df.churn.mean():.3f}")
    for name, part in (("обучение", tr), ("валидация", va), ("тест", te)):
        print(f"{name:10s}: {len(part):6d} строк, уходов {part.churn.mean():.3f}, средний платёж {part.monthly_charge.mean():.1f}")
    print("пропусков usage_gb:", round(df.usage_gb.isna().mean(), 3), "| у ушедших:", round(df[df.churn == 1].usage_gb.isna().mean(), 3))
