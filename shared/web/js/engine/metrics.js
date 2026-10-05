/* =====================================================================================
 * Метрики качества — зеркало gbcourse/metrics.py.
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC || (root.GBC = {});
  const U = GBC.util;

  function mse(y, p) {
    let s = 0;
    for (let i = 0; i < y.length; i++) s += (y[i] - p[i]) * (y[i] - p[i]);
    return y.length ? s / y.length : 0;
  }

  function mae(y, p) {
    let s = 0;
    for (let i = 0; i < y.length; i++) s += Math.abs(y[i] - p[i]);
    return y.length ? s / y.length : 0;
  }

  function r2(y, p) {
    const m = U.mean(y);
    let sse = 0;
    let sst = 0;
    for (let i = 0; i < y.length; i++) sse += (y[i] - p[i]) * (y[i] - p[i]);
    for (let i = 0; i < y.length; i++) sst += (y[i] - m) * (y[i] - m);
    return sst > 0 ? 1 - sse / sst : 0;
  }

  function logLoss(y, proba, eps = 1e-15) {
    let s = 0;
    for (let i = 0; i < y.length; i++) {
      const p = Math.min(Math.max(proba[i], eps), 1 - eps);
      s += -(y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p));
    }
    return y.length ? s / y.length : 0;
  }

  function accuracy(y, pred) {
    let c = 0;
    for (let i = 0; i < y.length; i++) c += y[i] === pred[i] ? 1 : 0;
    return y.length ? c / y.length : 0;
  }

  function rocAuc(y, score) {
    const order = U.argsort(score);
    const ranks = new Array(score.length);
    let i = 0;
    while (i < order.length) {
      let j = i;
      while (j + 1 < order.length && score[order[j + 1]] === score[order[i]]) j++;
      for (let k = i; k <= j; k++) ranks[order[k]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    let nPos = 0;
    let sumPos = 0;
    for (let k = 0; k < y.length; k++) {
      if (y[k] === 1) {
        nPos++;
        sumPos += ranks[k];
      }
    }
    const nNeg = y.length - nPos;
    if (!nPos || !nNeg) return NaN;
    return (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
  }

  /** Точки ROC-кривой: [{fpr, tpr, threshold}]. */
  function rocCurve(y, score) {
    const idx = U.argsort(score).reverse();
    const P = y.filter((v) => v === 1).length;
    const N = y.length - P;
    const pts = [{ fpr: 0, tpr: 0, threshold: Infinity }];
    let tp = 0;
    let fp = 0;
    for (let k = 0; k < idx.length; k++) {
      if (y[idx[k]] === 1) tp++;
      else fp++;
      const next = k + 1 < idx.length ? score[idx[k + 1]] : -Infinity;
      if (next !== score[idx[k]]) pts.push({ fpr: N ? fp / N : 0, tpr: P ? tp / P : 0, threshold: score[idx[k]] });
    }
    return pts;
  }

  GBC.metrics = { mse, rmse: (y, p) => Math.sqrt(mse(y, p)), mae, r2, logLoss, accuracy, rocAuc, rocCurve };
})(typeof window !== 'undefined' ? window : globalThis);
