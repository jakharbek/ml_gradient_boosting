/* Сгенерировано lessons/lesson_9_4/examples/benchmark.py — не редактировать вручную. */
(function (root) {
  'use strict';
  (root.GBC || (root.GBC = {})).benchmark = {
    "versions": {
      "XGBoost": "3.4.1",
      "LightGBM": "4.7.0",
      "CatBoost": "1.2.10"
    },
    "tasks": [
      {
        "name": "Фридман, регрессия (5000 × 10)",
        "metric": "RMSE",
        "rows": [
          {
            "lib": "XGBoost",
            "mode": "default",
            "score": 1.4163,
            "std": 0.0479,
            "time": 0.089,
            "trees": 100.0
          },
          {
            "lib": "XGBoost",
            "mode": "early",
            "score": 1.2765,
            "std": 0.0439,
            "time": 0.309,
            "trees": 422.0
          },
          {
            "lib": "LightGBM",
            "mode": "default",
            "score": 1.2708,
            "std": 0.058,
            "time": 0.073,
            "trees": 100.0
          },
          {
            "lib": "LightGBM",
            "mode": "early",
            "score": 1.2479,
            "std": 0.046,
            "time": 0.222,
            "trees": 277.0
          },
          {
            "lib": "CatBoost",
            "mode": "default",
            "score": 1.084,
            "std": 0.0372,
            "time": 0.984,
            "trees": 1000.0
          },
          {
            "lib": "CatBoost",
            "mode": "early",
            "score": 1.0734,
            "std": 0.0259,
            "time": 0.503,
            "trees": 402.3
          }
        ]
      },
      {
        "name": "«Луны» + 8 шумовых признаков, классификация (20000 × 10)",
        "metric": "log-loss",
        "rows": [
          {
            "lib": "XGBoost",
            "mode": "default",
            "score": 0.2411,
            "std": 0.0036,
            "time": 0.062,
            "trees": 100.0
          },
          {
            "lib": "XGBoost",
            "mode": "early",
            "score": 0.2106,
            "std": 0.002,
            "time": 0.151,
            "trees": 118.0
          },
          {
            "lib": "LightGBM",
            "mode": "default",
            "score": 0.2164,
            "std": 0.0028,
            "time": 0.074,
            "trees": 100.0
          },
          {
            "lib": "LightGBM",
            "mode": "early",
            "score": 0.2125,
            "std": 0.0014,
            "time": 0.143,
            "trees": 99.7
          },
          {
            "lib": "CatBoost",
            "mode": "default",
            "score": 0.2124,
            "std": 0.0013,
            "time": 3.816,
            "trees": 1000.0
          },
          {
            "lib": "CatBoost",
            "mode": "early",
            "score": 0.2089,
            "std": 0.0015,
            "time": 1.239,
            "trees": 198.3
          }
        ]
      },
      {
        "name": "Категория из 100 значений, регрессия (5000 × 2)",
        "metric": "RMSE",
        "rows": [
          {
            "lib": "XGBoost",
            "mode": "default",
            "score": 1.1972,
            "std": 0.025,
            "time": 0.049,
            "trees": 100.0
          },
          {
            "lib": "XGBoost",
            "mode": "early",
            "score": 1.0718,
            "std": 0.0125,
            "time": 0.085,
            "trees": 63.7
          },
          {
            "lib": "LightGBM",
            "mode": "default",
            "score": 1.0818,
            "std": 0.0033,
            "time": 0.054,
            "trees": 100.0
          },
          {
            "lib": "LightGBM",
            "mode": "early",
            "score": 1.0513,
            "std": 0.0067,
            "time": 0.098,
            "trees": 76.7
          },
          {
            "lib": "CatBoost",
            "mode": "default",
            "score": 1.1011,
            "std": 0.0085,
            "time": 68.696,
            "trees": 1000.0
          },
          {
            "lib": "CatBoost",
            "mode": "early",
            "score": 1.0859,
            "std": 0.0086,
            "time": 30.144,
            "trees": 343.7
          }
        ]
      }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
