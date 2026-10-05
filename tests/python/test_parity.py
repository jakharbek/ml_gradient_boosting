"""Паритет JS ↔ Python: веб-движок и gbcourse дают одинаковые данные и модели.

Тест запускает ``node tests/parity/run_js.js`` и повторяет те же эксперименты в Python.
Совпадение проверяется с допуском 1e-9 (расхождения возможны лишь в последнем
знаке тригонометрии и экспоненты, реализованных по-разному в V8 и libm).
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
import pytest
from gbcourse import AdaBoost, BaggingTrees, GradientBoosting, datasets, explain

ROOT = Path(__file__).resolve().parents[2]
CASES = json.loads((ROOT / "tests" / "parity" / "cases.json").read_text(encoding="utf-8"))
ATOL = 1e-9


@pytest.fixture(scope="module")
def js_results():
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node.js не установлен — паритет JS/Python не проверяется")
    proc = subprocess.run(
        [node, str(ROOT / "tests" / "parity" / "run_js.js")],
        capture_output=True, text=True, encoding="utf-8", check=True, timeout=300,
    )
    return json.loads(proc.stdout)


def _load(case):
    X, y = datasets.make(case["data"]["name"], **case["data"]["params"])
    if case.get("missing"):
        X = datasets.inject_missing(X, case["missing"], seed=7)
    if case.get("y_transform") == "floor_abs":
        y = np.floor(np.abs(y))
    return np.asarray(X, float), np.asarray(y)


def _nan(a):
    return np.array([[np.nan if v is None else v for v in row] for row in a], dtype=float)


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_boosting_parity(case, js_results):
    js = js_results[case["name"]]
    X, y = _load(case)
    eval_set = None
    if "split" in case:
        X, Xte, y, yte = datasets.train_test_split(X, y, case["split"]["test_size"], case["split"]["seed"])
        eval_set = (Xte, yte)
    np.testing.assert_allclose(_nan(js["X"]), X, atol=ATOL, equal_nan=True, err_msg="данные X")
    np.testing.assert_allclose(np.asarray(js["y"], float), np.asarray(y, float), atol=ATOL, err_msg="данные y")

    model = GradientBoosting(**case["model"]).fit(X, y, eval_set=eval_set)
    assert model.n_trees_ == js["n_trees"], "число итераций"
    n_nodes = sum(len(t.nodes) for stage in model.trees_ for t in stage)
    assert n_nodes == js["n_nodes"], "структура деревьев (число узлов)"
    np.testing.assert_allclose(np.asarray(js["raw"], float), model.predict_raw(X), atol=ATOL, err_msg="прогнозы")
    np.testing.assert_allclose(js["train"], model.history_["train"], atol=ATOL, err_msg="кривая обучения")
    if eval_set is not None:
        np.testing.assert_allclose(js["eval"], model.history_["eval"], atol=ATOL)
        assert js["best_iteration"] == model.best_iteration_


def test_adaboost_parity(js_results):
    X, y = datasets.classification_2d("circles", n=160, noise=0.15, seed=5)
    ada = AdaBoost(n_estimators=25).fit(X, y)
    js = js_results["adaboost"]
    np.testing.assert_allclose(js["alphas"], ada.alphas_, atol=ATOL)
    np.testing.assert_allclose(js["decision"], ada.decision_function(X), atol=ATOL)


def test_bagging_parity(js_results):
    X, y = datasets.regression_1d("wave", n=100, noise=0.3, seed=4)
    bag = BaggingTrees(n_estimators=15, max_depth=4, seed=3).fit(X, y)
    js = js_results["bagging"]
    np.testing.assert_allclose(js["pred"], bag.predict(X), atol=ATOL)
    oob_js = np.array([np.nan if v is None else v for v in js["oob"]])
    np.testing.assert_allclose(oob_js, bag.oob_predict(X), atol=ATOL, equal_nan=True)

    Xf, yf = datasets.friedman1(n=150, noise=0.5, seed=2, n_features=6)
    rf = BaggingTrees(n_estimators=8, max_depth=5, max_features=0.5, seed=9).fit(Xf, yf)
    np.testing.assert_allclose(js_results["random_forest"]["pred"], rf.predict(Xf), atol=ATOL)


def test_shapley_parity(js_results):
    Xf, yf = datasets.friedman1(n=150, noise=0.5, seed=2, n_features=6)
    gb = GradientBoosting(n_estimators=20, max_depth=3, learning_rate=0.2).fit(Xf, yf)
    for i, js in enumerate(js_results["shapley"]):
        base, phi = explain.shapley_values(gb, Xf[i])
        assert abs(base - js["base"]) < ATOL
        np.testing.assert_allclose(js["phi"], phi, atol=ATOL)
        # Аддитивность: φ₀ + Σφ = f(x)
        assert abs(base + phi.sum() - gb.predict_raw(Xf[i : i + 1])[0]) < 1e-9
