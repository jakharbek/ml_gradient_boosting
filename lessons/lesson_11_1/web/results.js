/* Сгенерировано lessons/lesson_11_1/examples/sensitivity.py — не редактировать вручную. */
(function (root) {
  'use strict';
  (root.GBC || (root.GBC = {})).sensitivity = {
    "params": [
      "learning_rate",
      "num_leaves",
      "min_child_samples",
      "colsample_bytree",
      "subsample",
      "reg_lambda",
      "max_bin"
    ],
    "base": {
      "learning_rate": 0.1,
      "num_leaves": 31,
      "min_child_samples": 20,
      "colsample_bytree": 1.0,
      "subsample": 1.0,
      "reg_lambda": 0.0,
      "max_bin": 255
    },
    "tasks": [
      {
        "name": "Фридман (регрессия, RMSE)",
        "metric": "RMSE",
        "base": 1.2515,
        "params": {
          "learning_rate": {
            "curve": [
              {
                "value": 0.01,
                "score": 1.2344,
                "std": 0.0458
              },
              {
                "value": 0.03,
                "score": 1.2339,
                "std": 0.0322
              },
              {
                "value": 0.1,
                "score": 1.2515,
                "std": 0.0425
              },
              {
                "value": 0.3,
                "score": 1.3491,
                "std": 0.0349
              }
            ],
            "range": 0.1152,
            "gain": 0.0176
          },
          "num_leaves": {
            "curve": [
              {
                "value": 4,
                "score": 1.1361,
                "std": 0.0172
              },
              {
                "value": 8,
                "score": 1.1832,
                "std": 0.0254
              },
              {
                "value": 16,
                "score": 1.2329,
                "std": 0.0347
              },
              {
                "value": 31,
                "score": 1.2515,
                "std": 0.0425
              },
              {
                "value": 64,
                "score": 1.3142,
                "std": 0.0363
              },
              {
                "value": 128,
                "score": 1.3472,
                "std": 0.0251
              }
            ],
            "range": 0.2111,
            "gain": 0.1154
          },
          "min_child_samples": {
            "curve": [
              {
                "value": 2,
                "score": 1.2668,
                "std": 0.0337
              },
              {
                "value": 5,
                "score": 1.266,
                "std": 0.0353
              },
              {
                "value": 10,
                "score": 1.2617,
                "std": 0.0373
              },
              {
                "value": 20,
                "score": 1.2515,
                "std": 0.0425
              },
              {
                "value": 50,
                "score": 1.2429,
                "std": 0.031
              },
              {
                "value": 100,
                "score": 1.2253,
                "std": 0.0308
              }
            ],
            "range": 0.0415,
            "gain": 0.0262
          },
          "colsample_bytree": {
            "curve": [
              {
                "value": 0.3,
                "score": 1.6675,
                "std": 0.0812
              },
              {
                "value": 0.5,
                "score": 1.3144,
                "std": 0.016
              },
              {
                "value": 0.7,
                "score": 1.2201,
                "std": 0.0212
              },
              {
                "value": 1.0,
                "score": 1.2515,
                "std": 0.0425
              }
            ],
            "range": 0.4474,
            "gain": 0.0314
          },
          "subsample": {
            "curve": [
              {
                "value": 0.3,
                "score": 1.2484,
                "std": 0.0295
              },
              {
                "value": 0.5,
                "score": 1.238,
                "std": 0.0261
              },
              {
                "value": 0.7,
                "score": 1.2355,
                "std": 0.0345
              },
              {
                "value": 1.0,
                "score": 1.2515,
                "std": 0.0425
              }
            ],
            "range": 0.016,
            "gain": 0.016
          },
          "reg_lambda": {
            "curve": [
              {
                "value": 0.0,
                "score": 1.2515,
                "std": 0.0425
              },
              {
                "value": 1.0,
                "score": 1.264,
                "std": 0.0307
              },
              {
                "value": 10.0,
                "score": 1.2708,
                "std": 0.0218
              },
              {
                "value": 100.0,
                "score": 1.2718,
                "std": 0.018
              }
            ],
            "range": 0.0203,
            "gain": -0.0
          },
          "max_bin": {
            "curve": [
              {
                "value": 15,
                "score": 1.3155,
                "std": 0.0197
              },
              {
                "value": 63,
                "score": 1.2545,
                "std": 0.0287
              },
              {
                "value": 255,
                "score": 1.2515,
                "std": 0.0425
              }
            ],
            "range": 0.064,
            "gain": -0.0
          }
        }
      },
      {
        "name": "«Луны» + шум (классификация, log-loss)",
        "metric": "log-loss",
        "base": 0.2264,
        "params": {
          "learning_rate": {
            "curve": [
              {
                "value": 0.01,
                "score": 0.2269,
                "std": 0.009
              },
              {
                "value": 0.03,
                "score": 0.2264,
                "std": 0.0096
              },
              {
                "value": 0.1,
                "score": 0.2264,
                "std": 0.0099
              },
              {
                "value": 0.3,
                "score": 0.2339,
                "std": 0.0084
              }
            ],
            "range": 0.0075,
            "gain": 0.0
          },
          "num_leaves": {
            "curve": [
              {
                "value": 4,
                "score": 0.222,
                "std": 0.0089
              },
              {
                "value": 8,
                "score": 0.2219,
                "std": 0.01
              },
              {
                "value": 16,
                "score": 0.2238,
                "std": 0.0088
              },
              {
                "value": 31,
                "score": 0.2264,
                "std": 0.0099
              },
              {
                "value": 64,
                "score": 0.2326,
                "std": 0.0099
              },
              {
                "value": 128,
                "score": 0.2375,
                "std": 0.008
              }
            ],
            "range": 0.0156,
            "gain": 0.0045
          },
          "min_child_samples": {
            "curve": [
              {
                "value": 2,
                "score": 0.23,
                "std": 0.0103
              },
              {
                "value": 5,
                "score": 0.228,
                "std": 0.009
              },
              {
                "value": 10,
                "score": 0.2291,
                "std": 0.0097
              },
              {
                "value": 20,
                "score": 0.2264,
                "std": 0.0099
              },
              {
                "value": 50,
                "score": 0.2259,
                "std": 0.0097
              },
              {
                "value": 100,
                "score": 0.2236,
                "std": 0.0075
              }
            ],
            "range": 0.0064,
            "gain": 0.0028
          },
          "colsample_bytree": {
            "curve": [
              {
                "value": 0.3,
                "score": 0.2402,
                "std": 0.0094
              },
              {
                "value": 0.5,
                "score": 0.2301,
                "std": 0.0119
              },
              {
                "value": 0.7,
                "score": 0.227,
                "std": 0.0117
              },
              {
                "value": 1.0,
                "score": 0.2264,
                "std": 0.0099
              }
            ],
            "range": 0.0138,
            "gain": 0.0
          },
          "subsample": {
            "curve": [
              {
                "value": 0.3,
                "score": 0.2316,
                "std": 0.0097
              },
              {
                "value": 0.5,
                "score": 0.2297,
                "std": 0.0074
              },
              {
                "value": 0.7,
                "score": 0.2299,
                "std": 0.0077
              },
              {
                "value": 1.0,
                "score": 0.2264,
                "std": 0.0099
              }
            ],
            "range": 0.0052,
            "gain": 0.0
          },
          "reg_lambda": {
            "curve": [
              {
                "value": 0.0,
                "score": 0.2264,
                "std": 0.0099
              },
              {
                "value": 1.0,
                "score": 0.227,
                "std": 0.0089
              },
              {
                "value": 10.0,
                "score": 0.2251,
                "std": 0.0095
              },
              {
                "value": 100.0,
                "score": 0.2271,
                "std": 0.0094
              }
            ],
            "range": 0.002,
            "gain": 0.0013
          },
          "max_bin": {
            "curve": [
              {
                "value": 15,
                "score": 0.2318,
                "std": 0.011
              },
              {
                "value": 63,
                "score": 0.2286,
                "std": 0.0076
              },
              {
                "value": 255,
                "score": 0.2264,
                "std": 0.0099
              }
            ],
            "range": 0.0054,
            "gain": 0.0
          }
        }
      }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
