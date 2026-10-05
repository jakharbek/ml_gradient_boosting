/* Сгенерировано lessons/lesson_10_1/examples/encoding_benchmark.py — не редактировать вручную. */
(function (root) {
  'use strict';
  (root.GBC || (root.GBC = {})).encodingBenchmark = {
    "methods": [
      "без категории",
      "порядковый код",
      "one-hot",
      "среднее (наивное)",
      "среднее по фолдам",
      "LightGBM встроенная",
      "XGBoost встроенная",
      "CatBoost встроенная"
    ],
    "scenarios": [
      {
        "K": 10,
        "informative": true,
        "rows": [
          {
            "method": "без категории",
            "rmse": 1.4521,
            "std": 0.1486
          },
          {
            "method": "порядковый код",
            "rmse": 0.9784,
            "std": 0.0037
          },
          {
            "method": "one-hot",
            "rmse": 0.9786,
            "std": 0.0039
          },
          {
            "method": "среднее (наивное)",
            "rmse": 0.9768,
            "std": 0.0053
          },
          {
            "method": "среднее по фолдам",
            "rmse": 0.9772,
            "std": 0.003
          },
          {
            "method": "LightGBM встроенная",
            "rmse": 0.9779,
            "std": 0.0063
          },
          {
            "method": "XGBoost встроенная",
            "rmse": 0.9804,
            "std": 0.0053
          },
          {
            "method": "CatBoost встроенная",
            "rmse": 0.9676,
            "std": 0.0071
          }
        ]
      },
      {
        "K": 100,
        "informative": true,
        "rows": [
          {
            "method": "без категории",
            "rmse": 1.7792,
            "std": 0.0625
          },
          {
            "method": "порядковый код",
            "rmse": 1.0661,
            "std": 0.0079
          },
          {
            "method": "one-hot",
            "rmse": 1.1657,
            "std": 0.0498
          },
          {
            "method": "среднее (наивное)",
            "rmse": 1.0259,
            "std": 0.0095
          },
          {
            "method": "среднее по фолдам",
            "rmse": 1.0303,
            "std": 0.015
          },
          {
            "method": "LightGBM встроенная",
            "rmse": 1.016,
            "std": 0.0125
          },
          {
            "method": "XGBoost встроенная",
            "rmse": 1.0344,
            "std": 0.0106
          },
          {
            "method": "CatBoost встроенная",
            "rmse": 1.0471,
            "std": 0.0134
          }
        ]
      },
      {
        "K": 1000,
        "informative": true,
        "rows": [
          {
            "method": "без категории",
            "rmse": 1.8199,
            "std": 0.0255
          },
          {
            "method": "порядковый код",
            "rmse": 1.689,
            "std": 0.027
          },
          {
            "method": "one-hot",
            "rmse": null,
            "std": null
          },
          {
            "method": "среднее (наивное)",
            "rmse": 1.2971,
            "std": 0.0186
          },
          {
            "method": "среднее по фолдам",
            "rmse": 1.312,
            "std": 0.0257
          },
          {
            "method": "LightGBM встроенная",
            "rmse": 1.707,
            "std": 0.0557
          },
          {
            "method": "XGBoost встроенная",
            "rmse": 1.2953,
            "std": 0.0303
          },
          {
            "method": "CatBoost встроенная",
            "rmse": 1.3533,
            "std": 0.0293
          }
        ]
      },
      {
        "K": 1000,
        "informative": false,
        "rows": [
          {
            "method": "без категории",
            "rmse": 1.0196,
            "std": 0.0106
          },
          {
            "method": "порядковый код",
            "rmse": 1.0272,
            "std": 0.0079
          },
          {
            "method": "one-hot",
            "rmse": null,
            "std": null
          },
          {
            "method": "среднее (наивное)",
            "rmse": 1.0866,
            "std": 0.0174
          },
          {
            "method": "среднее по фолдам",
            "rmse": 1.0214,
            "std": 0.0072
          },
          {
            "method": "LightGBM встроенная",
            "rmse": 1.0205,
            "std": 0.0087
          },
          {
            "method": "XGBoost встроенная",
            "rmse": 1.1233,
            "std": 0.0216
          },
          {
            "method": "CatBoost встроенная",
            "rmse": 1.0132,
            "std": 0.0095
          }
        ]
      }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
