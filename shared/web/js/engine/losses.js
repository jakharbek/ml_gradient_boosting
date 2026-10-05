/* =====================================================================================
 * Функции потерь — зеркало gbcourse/losses.py.
 * Каждая потеря даёт: init (F0), pointwise/loss, gradient (g), hessian (h),
 * leafValue (линейный поиск Фридмана в листе), transform (F → ответ).
 * Для softmax F — массив строк [n][K].
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC || (root.GBC = {});
  const U = GBC.util;
  const EPS = 1e-12;
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

  function mapPair(y, F, fn) {
    const out = new Array(F.length);
    for (let i = 0; i < F.length; i++) out[i] = fn(y[i], F[i]);
    return out;
  }

  const base = {
    isClassification: false,
    newtonOk: true,
    loss(y, F) {
      return U.mean(this.pointwise(y, F));
    },
    hessian(y, F) {
      return F.map(() => 1);
    },
    negativeGradient(y, F) {
      return this.gradient(y, F).map((v) => -v);
    },
    leafValue(y, F) {
      return U.mean(this.negativeGradient(y, F));
    },
    transform(F) {
      return F;
    },
    transformOne(f) {
      return f;
    },
  };

  const squared = Object.assign(Object.create(base), {
    name: 'squared',
    title: 'Квадратичная (L2)',
    formula: 'L = \\tfrac12 (y - F)^2',
    init: (y) => U.mean(y),
    pointwise: (y, F) => mapPair(y, F, (a, f) => 0.5 * (a - f) * (a - f)),
    gradient: (y, F) => mapPair(y, F, (a, f) => f - a),
    leafValue: (y, F) => U.mean(mapPair(y, F, (a, f) => a - f)),
  });

  const absolute = Object.assign(Object.create(base), {
    name: 'absolute',
    title: 'Абсолютная (L1)',
    formula: 'L = |y - F|',
    newtonOk: false,
    init: (y) => U.median(y),
    pointwise: (y, F) => mapPair(y, F, (a, f) => Math.abs(a - f)),
    gradient: (y, F) => mapPair(y, F, (a, f) => sign(f - a)),
    hessian: (y, F) => F.map(() => 0),
    leafValue: (y, F) => U.median(mapPair(y, F, (a, f) => a - f)),
  });

  function huber(delta = 1.0) {
    return Object.assign(Object.create(base), {
      name: 'huber',
      title: 'Хьюбер',
      formula: 'L = \\begin{cases}\\tfrac12 r^2, & |r|\\le\\delta\\\\ \\delta(|r| - \\tfrac12\\delta), & |r|>\\delta\\end{cases}',
      delta,
      newtonOk: false,
      init: (y) => U.median(y),
      pointwise: (y, F) =>
        mapPair(y, F, (a, f) => {
          const r = Math.abs(a - f);
          return r <= delta ? 0.5 * r * r : delta * (r - 0.5 * delta);
        }),
      gradient: (y, F) =>
        mapPair(y, F, (a, f) => {
          const r = a - f;
          return Math.abs(r) <= delta ? -r : -delta * sign(r);
        }),
      hessian: (y, F) => mapPair(y, F, (a, f) => (Math.abs(a - f) <= delta ? 1 : 0)),
      leafValue(y, F) {
        const r = mapPair(y, F, (a, f) => a - f);
        const rMed = U.median(r);
        return rMed + U.mean(r.map((v) => sign(v - rMed) * Math.min(delta, Math.abs(v - rMed))));
      },
    });
  }

  function quantileLoss(alpha = 0.5) {
    return Object.assign(Object.create(base), {
      name: 'quantile',
      title: 'Квантильная',
      formula: 'L = \\max(\\alpha r,\\ (\\alpha - 1) r)',
      alpha,
      newtonOk: false,
      init: (y) => U.quantile(y, alpha),
      pointwise: (y, F) =>
        mapPair(y, F, (a, f) => {
          const r = a - f;
          return r >= 0 ? alpha * r : (alpha - 1.0) * r;
        }),
      gradient: (y, F) => mapPair(y, F, (a, f) => (a >= f ? -alpha : 1.0 - alpha)),
      hessian: (y, F) => F.map(() => 0),
      leafValue: (y, F) => U.quantile(mapPair(y, F, (a, f) => a - f), alpha),
    });
  }

  const logistic = Object.assign(Object.create(base), {
    name: 'logistic',
    title: 'Логистическая (log-loss)',
    formula: 'L = -[y\\log p + (1-y)\\log(1-p)],\\ p = \\sigma(F)',
    isClassification: true,
    init(y) {
      const p = Math.min(Math.max(U.mean(y), EPS), 1.0 - EPS);
      return Math.log(p / (1.0 - p));
    },
    pointwise: (y, F) => mapPair(y, F, (a, f) => Math.max(f, 0) + Math.log1p(Math.exp(-Math.abs(f))) - a * f),
    gradient: (y, F) => mapPair(y, F, (a, f) => U.sigmoid(f) - a),
    hessian: (y, F) =>
      F.map((f) => {
        const p = U.sigmoid(f);
        return p * (1.0 - p);
      }),
    leafValue(y, F) {
      let num = 0;
      let den = 0;
      for (let i = 0; i < F.length; i++) num += y[i] - U.sigmoid(F[i]);
      for (let i = 0; i < F.length; i++) {
        const p = U.sigmoid(F[i]);
        den += p * (1.0 - p);
      }
      return Math.abs(den) < 1e-150 ? 0 : num / den;
    },
    transform: (F) => F.map(U.sigmoid),
    transformOne: U.sigmoid,
  });

  const poisson = Object.assign(Object.create(base), {
    name: 'poisson',
    title: 'Пуассоновская',
    formula: 'L = e^{F} - yF',
    init: (y) => Math.log(Math.max(U.mean(y), EPS)),
    pointwise: (y, F) => mapPair(y, F, (a, f) => Math.exp(f) - a * f),
    gradient: (y, F) => mapPair(y, F, (a, f) => Math.exp(f) - a),
    hessian: (y, F) => F.map((f) => Math.exp(f)),
    leafValue(y, F) {
      const sy = U.sum(y);
      let smu = 0;
      for (let i = 0; i < F.length; i++) smu += Math.exp(F[i]);
      return Math.log(Math.max(sy, EPS) / smu);
    },
    transform: (F) => F.map((f) => Math.exp(f)),
    transformOne: (f) => Math.exp(f),
  });

  function softmaxRow(row) {
    let m = -Infinity;
    for (const v of row) if (v > m) m = v;
    const e = row.map((v) => Math.exp(v - m));
    let s = 0;
    for (const v of e) s += v;
    return e.map((v) => v / s);
  }

  function softmax(nClasses = 3) {
    const K = nClasses;
    return {
      name: 'softmax',
      title: 'Softmax (многоклассовая)',
      formula: 'L = -\\log p_{y},\\ p_k = \\frac{e^{F_k}}{\\sum_j e^{F_j}}',
      isClassification: true,
      newtonOk: true,
      nClasses: K,
      init(y) {
        const logp = [];
        for (let k = 0; k < K; k++) {
          let cnt = 0;
          for (let i = 0; i < y.length; i++) cnt += y[i] === k ? 1 : 0;
          const p = Math.min(Math.max(cnt / y.length, EPS), 1.0 - EPS);
          logp.push(Math.log(p));
        }
        const m = U.mean(logp);
        return logp.map((v) => v - m);
      },
      pointwise(y, F) {
        return F.map((row, i) => {
          let m = -Infinity;
          for (const v of row) if (v > m) m = v;
          let s = 0;
          for (const v of row) s += Math.exp(v - m);
          return m + Math.log(s) - row[y[i]];
        });
      },
      loss(y, F) {
        return U.mean(this.pointwise(y, F));
      },
      gradient(y, F) {
        return F.map((row, i) => softmaxRow(row).map((p, k) => p - (y[i] === k ? 1 : 0)));
      },
      hessian(y, F) {
        return F.map((row) => softmaxRow(row).map((p) => p * (1.0 - p)));
      },
      /** Шаг Фридмана для класса k: (K−1)/K · Σr / Σ|r|(1−|r|). */
      leafValueK(resid) {
        let num = 0;
        let den = 0;
        for (const r of resid) num += r;
        for (const r of resid) den += Math.abs(r) * (1.0 - Math.abs(r));
        return Math.abs(den) < 1e-150 ? 0 : (((K - 1) / K) * num) / den;
      },
      transform: (F) => F.map(softmaxRow),
      transformOne: softmaxRow,
    };
  }

  const ALIASES = {
    squared: 'squared', squared_error: 'squared', mse: 'squared', l2: 'squared',
    absolute: 'absolute', absolute_error: 'absolute', mae: 'absolute', l1: 'absolute',
    huber: 'huber', quantile: 'quantile', pinball: 'quantile',
    logistic: 'logistic', log_loss: 'logistic', binary: 'logistic', logloss: 'logistic',
    softmax: 'softmax', multiclass: 'softmax', multinomial: 'softmax', poisson: 'poisson',
  };

  GBC.losses = {
    get(name, params = {}) {
      if (name && typeof name === 'object') return name;
      const key = ALIASES[String(name).toLowerCase()];
      if (!key) throw new Error('Неизвестная функция потерь ' + name);
      if (key === 'squared') return squared;
      if (key === 'absolute') return absolute;
      if (key === 'huber') return huber(params.delta ?? params.huberDelta ?? 1.0);
      if (key === 'quantile') return quantileLoss(params.alpha ?? params.quantileAlpha ?? 0.5);
      if (key === 'logistic') return logistic;
      if (key === 'poisson') return poisson;
      return softmax(params.nClasses ?? 3);
    },
    softmaxRow,
    /** Значение потерь в точке: удобно для графиков L(r). */
    pointAt(name, r, params = {}) {
      const loss = GBC.losses.get(name, params);
      return loss.pointwise([r], [0])[0];
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
