"""Числа в компьютере: переполнение, двоичные дроби, IEEE 754, порядок суммирования и float32 в деревьях.

Запуск:  python lessons/lesson_15_20/examples/floats_in_ml.py [--save] [--no-show]

1) Фиксированная ширина: uint8 и int32 numpy живут по модулю 2ʷ.
2) Периоды дробей: какие дроби конечны в двоичной системе; что хранится вместо 0.1.
3) Сетка float: ulp, машинный эпсилон, шаг float32 около unix-времени.
4) Порядок суммирования: подряд, попарно, Кэхэн, fsum; дисперсия «в лоб».
5) float32 склеивает признак: XGBoost и scikit-learn не находят порог, LightGBM находит.
"""

import math
import struct
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "shared" / "python"))

import lightgbm as lgb
import matplotlib.pyplot as plt
import numpy as np
import xgboost as xgb
from sklearn.tree import DecisionTreeRegressor

from gbcourse.cli import Example
from gbcourse.rng import Mulberry32
from gbcourse.style import AQUA, BLUE, MUTED, ORANGE

ex = Example(__file__)

# 1. Переполнение
assert int((np.array([200], np.uint8) + np.uint8(100))[0]) == 44
assert int((np.array([50000], np.int32) * np.int32(50000))[0]) == -1794967296
assert int(np.int8(-5).view(np.uint8)) == 251
print("1) uint8: 200 + 100 = 44;  int32: 50000² = −1 794 967 296;  int8 −5 = 0b11111011")


# 2. Периоды дробей
def period(p: int, q: int, b: int) -> tuple[int, int]:
    r, seen, k = p % q, {}, 0
    while r and r not in seen:
        seen[r] = k
        r, k = r * b % q, k + 1
    return (k, 0) if not r else (seen[r], k - seen[r])


assert period(1, 7, 10) == (0, 6) and period(1, 8, 10) == (3, 0) and period(1, 10, 2) == (1, 4)
assert period(1, 97, 10) == (0, 96)
assert str(Decimal(0.1)).startswith("0.1000000000000000055511151231257827")
assert Decimal(float(np.float32(0.1))) == Decimal("0.100000001490116119384765625")
assert hex(struct.unpack(">Q", struct.pack(">d", 1.0))[0]) == "0x3ff0000000000000"
print("2) 1/7: период 6; 0.1 в двоичной: предпериод 1, период 4; хранится", Decimal(0.1))

# 3. Сетка float
T = 1_760_000_000
assert np.spacing(np.float32(T)) == 128 and float(np.float32(16777217)) == 16777216.0
assert 1 + 1e-16 == 1 and float(2**53 + 1) == float(2**53)
minutes = np.unique((T + 60 * np.arange(60)).astype(np.float32)).size
assert minutes == 29
print(f"3) ε = {np.finfo(float).eps:.3g}; шаг float32 у unix-времени: 128 с; 60 событий раз в минуту → {minutes} разных float32")


# 4. Порядок суммирования
def seq(a):
    s = 0.0
    for x in a:
        s += x
    return s


def kahan(a):
    s = c = 0.0
    for x in a:
        y = x - c
        t = s + y
        c = (t - s) - y
        s = t
    return s


assert (0.1 + 0.2) + 0.3 == 0.6000000000000001 and 0.1 + (0.2 + 0.3) == 0.6
assert seq([0.1] * 10) == 0.9999999999999999 and math.fsum([0.1] * 10) == 1.0
big = [1e16] + [1.0] * 10 + [-1e16]
assert seq(big) == 0.0 and kahan(big) == 10.0 and math.fsum(big) == 10.0
x3 = np.array([1e9, 1e9 + 1, 1e9 + 2])
assert np.mean(x3**2) - np.mean(x3) ** 2 == 0.0 and abs(np.var(x3) - 2 / 3) < 1e-12
rng = Mulberry32(7)
u = [rng.random() for _ in range(10**6)]
assert seq(u) == math.fsum(u)                                     # все слагаемые кратны 2⁻³² — сумма точна
rng = Mulberry32(1)
cents = [math.floor(rng.random() * 100000) / 100 for _ in range(10**5)]
ns = np.unique(np.logspace(1, 5, 25).astype(int))
err_seq, err_kahan, err_np = [], [], []
for n in ns:
    ex_sum = math.fsum(cents[:n])
    ulp = math.ulp(ex_sum)
    err_seq.append(abs(seq(cents[:n]) - ex_sum) / ulp)
    err_kahan.append(abs(kahan(cents[:n]) - ex_sum) / ulp)
    err_np.append(abs(float(np.sum(np.array(cents[:n]))) - ex_sum) / ulp)
assert max(err_kahan) <= 1
print(f"4) суммы «с копейками», n = 10⁵: ошибка цикла {err_seq[-1]:.0f} ulp, np.sum {err_np[-1]:.0f} ulp, Кэхэн {err_kahan[-1]:.0f} ulp")

# 5. float32 и пороги
X = (T + 60 * np.arange(60)).astype(np.float64).reshape(-1, 1)
y = (np.arange(60) >= 30).astype(float)
res = {}
for name, Z in (("как есть", X), ("x − x₀", X - T)):
    tree = DecisionTreeRegressor(max_depth=1).fit(Z, y)
    xg = xgb.XGBRegressor(n_estimators=1, max_depth=1, learning_rate=1.0, base_score=0.5, reg_lambda=0, min_child_weight=0).fit(Z, y)
    lg = lgb.LGBMRegressor(n_estimators=1, num_leaves=2, learning_rate=1.0, min_child_samples=1, min_data_in_bin=1, verbose=-1).fit(Z, y)
    res[name] = [float(np.abs(m.predict(Z) - y).max()) for m in (tree, xg, lg)]
    print(f"5) {name:9}: ошибка sklearn {res[name][0]:.3f}, XGBoost {res[name][1]:.3f}, LightGBM {res[name][2]:.3f}")
assert res["как есть"][0] > 0.9 and res["как есть"][1] > 0.9 and res["как есть"][2] < 1e-6
assert max(res["x − x₀"]) < 1e-6

fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.2))
a1.plot(ns, err_seq, "o-", color=BLUE, label="цикл подряд")
a1.plot(ns, err_np, "s-", color=AQUA, label="np.sum (попарно)")
a1.plot(ns, err_kahan, "^-", color=ORANGE, label="Кэхэн")
a1.set_xscale("log")
a1.set(title="Ошибка суммы против точной (fsum)", xlabel="слагаемых", ylabel="|ошибка|, ulp")
a1.legend()
off = 60 * np.arange(60)
a2.step(off, (T + off).astype(np.float32).astype(np.float64) - T, where="post", color=MUTED, lw=1)
a2.scatter(off, (T + off).astype(np.float32).astype(np.float64) - T, c=[BLUE if v == 0 else ORANGE for v in y], s=16, zorder=3)
a2.axvline(1770, color="0.3", ls="--", lw=1)
a2.set(title="unix-время во float32: шаг 128 с", xlabel="секунд от x₀", ylabel="float32(x₀ + t) − x₀")
ex.finish(fig, "floats_in_ml")
