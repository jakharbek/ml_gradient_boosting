/* Сгенерировано lessons/lesson_14/examples/capstone.py — не редактировать вручную. */
(function (root) {
  'use strict';
  (root.GBC || (root.GBC = {})).capstone = {
    "rows": {
      "train": 13041,
      "valid": 7132,
      "test": 12546
    },
    "rate": {
      "train": 0.0647,
      "valid": 0.048,
      "test": 0.0607
    },
    "steps": [
      {
        "step": "0. константа",
        "note": "доля уходов в обучении",
        "valid": {
          "log-loss": 0.195,
          "AUC": 0.5,
          "AP": 0.048
        },
        "test": {
          "log-loss": 0.2291,
          "AUC": 0.5,
          "AP": 0.0607
        }
      },
      {
        "step": "1. LightGBM, категории — коды",
        "note": "параметры по умолчанию",
        "valid": {
          "log-loss": 0.1489,
          "AUC": 0.8469,
          "AP": 0.3321
        },
        "test": {
          "log-loss": 0.1789,
          "AUC": 0.8366,
          "AP": 0.3618
        }
      },
      {
        "step": "2. встроенные категории",
        "note": "pandas category",
        "valid": {
          "log-loss": 0.1508,
          "AUC": 0.848,
          "AP": 0.3247
        },
        "test": {
          "log-loss": 0.1807,
          "AUC": 0.8373,
          "AP": 0.3793
        }
      },
      {
        "step": "3. ν = 0.05 + ранняя остановка",
        "note": "деревьев 67",
        "valid": {
          "log-loss": 0.1459,
          "AUC": 0.8526,
          "AP": 0.3291
        },
        "test": {
          "log-loss": 0.1721,
          "AUC": 0.8419,
          "AP": 0.3926
        }
      },
      {
        "step": "4. случайный поиск (25 вариантов)",
        "note": "num_leaves=8, min_child_samples=200, colsample_bytree=0.5, reg_lambda=0.0, cat_smooth=50.0",
        "valid": {
          "log-loss": 0.1422,
          "AUC": 0.8602,
          "AP": 0.3602
        },
        "test": {
          "log-loss": 0.1666,
          "AUC": 0.8564,
          "AP": 0.4192
        }
      },
      {
        "step": "5. калибровка Платта",
        "note": "p' = σ(1.056·F + 0.061)",
        "valid": {
          "log-loss": 0.142,
          "AUC": 0.8602,
          "AP": 0.3602
        },
        "test": {
          "log-loss": 0.1665,
          "AUC": 0.8564,
          "AP": 0.4192
        }
      }
    ],
    "shap": {
      "contract": 0.5828,
      "payment": 0.057,
      "region": 0.2795,
      "age": 0.0464,
      "tenure": 0.2173,
      "monthly_charge": 0.6281,
      "support_calls": 0.2013,
      "usage_gb": 0.2706,
      "days_since_login": 0.1486
    },
    "psi_charge": 0.049,
    "adv_auc": 0.893,
    "top_shift": "monthly_charge"
  };
})(typeof window !== 'undefined' ? window : globalThis);
