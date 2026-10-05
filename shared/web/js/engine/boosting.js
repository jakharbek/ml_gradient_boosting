/* =====================================================================================
 * Градиентный бустинг — зеркало gbcourse/boosting.py.
 *
 *   F0 = argmin_c Σ L(y, c)
 *   для m = 1..M:   r = −∂L/∂F;  h_m = дерево(x → r);  листья — линейный поиск;
 *                   F_m = F_{m−1} + ν·h_m
 *
 * mode: 'friedman' (классика) | 'newton' (как XGBoost: дерево по g, h, λ, α, γ).
 * Порядок вызовов ГПСЧ на итерации: подвыборка строк → для каждого класса:
 * подвыборка признаков → (случайные признаки в узлах внутри дерева).
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC || (root.GBC = {});
  const U = GBC.util;

  const DEFAULTS = {
    loss: 'squared',
    nEstimators: 100,
    learningRate: 0.1,
    maxDepth: 3,
    minSamplesLeaf: 1,
    minChildWeight: 0,
    regLambda: 0,
    regAlpha: 0,
    gamma: 0,
    subsample: 1,
    colsample: 1,
    colsampleBynode: null,
    maxLeaves: null,
    growth: 'depthwise',
    maxBins: null,
    mode: 'friedman',
    huberDelta: 1,
    quantileAlpha: 0.5,
    nClasses: null,
    earlyStoppingRounds: null,
    seed: 0,
  };

  /** JS-имена параметров → имена в gbcourse (для «Экспорта в Python»). */
  const PY_PARAM = {
    nEstimators: 'n_estimators', learningRate: 'learning_rate', maxDepth: 'max_depth',
    minSamplesLeaf: 'min_samples_leaf', minChildWeight: 'min_child_weight', regLambda: 'reg_lambda',
    regAlpha: 'reg_alpha', gamma: 'gamma', subsample: 'subsample', colsample: 'colsample',
    colsampleBynode: 'colsample_bynode', maxLeaves: 'max_leaves', growth: 'growth', maxBins: 'max_bins',
    mode: 'mode', huberDelta: 'huber_delta', quantileAlpha: 'quantile_alpha', nClasses: 'n_classes',
    earlyStoppingRounds: 'early_stopping_rounds', seed: 'seed', loss: 'loss',
  };

  class GradientBoosting {
    constructor(params = {}) {
      Object.assign(this, DEFAULTS, params);
    }

    get params() {
      const out = {};
      for (const k of Object.keys(DEFAULTS)) out[k] = this[k];
      return out;
    }

    _makeLoss(y) {
      if (['softmax', 'multiclass', 'multinomial'].includes(String(this.loss).toLowerCase())) {
        let mx = 0;
        for (const v of y) if (v > mx) mx = v;
        return GBC.losses.get('softmax', { nClasses: this.nClasses || mx + 1 });
      }
      return GBC.losses.get(this.loss, { delta: this.huberDelta, alpha: this.quantileAlpha });
    }

    _newTree(newton) {
      return new GBC.RegressionTree({
        maxDepth: this.maxDepth,
        minSamplesLeaf: this.minSamplesLeaf,
        minChildWeight: this.minChildWeight,
        regLambda: newton ? this.regLambda : 0,
        regAlpha: newton ? this.regAlpha : 0,
        gamma: this.gamma,
        maxLeaves: this.maxLeaves,
        growth: this.growth,
        maxFeatures: this.colsampleBynode,
        maxBins: this.maxBins,
      });
    }

    /**
     * @param {number[][]} X
     * @param {number[]} y
     * @param {object} o evalSet: [Xv, yv]; callback(m, stage, model) → true для остановки
     */
    fit(X, y, o = {}) {
      const loss = this._makeLoss(y);
      this.lossFn = loss;
      this.multiclass = loss.name === 'softmax';
      const K = this.multiclass ? loss.nClasses : 1;
      const n = X.length;
      const d = n ? X[0].length : 0;
      this.nFeatures = d;
      const rng = new GBC.RNG(this.seed);
      const newton = this.mode === 'newton' && loss.newtonOk;
      this.newton = newton;
      this.init = loss.init(y);
      const initRow = () => (K > 1 ? this.init.slice() : this.init);
      const F = new Array(n);
      for (let i = 0; i < n; i++) F[i] = initRow();
      const hasEval = !!o.evalSet;
      let Xe;
      let ye;
      let Fe;
      if (hasEval) {
        Xe = o.evalSet[0];
        ye = o.evalSet[1];
        Fe = new Array(Xe.length);
        for (let i = 0; i < Xe.length; i++) Fe[i] = initRow();
      }
      this.bins = this.maxBins ? GBC.makeBins(X, this.maxBins) : null;
      this.trees = [];
      this.history = { train: [loss.loss(y, F)], eval: hasEval ? [loss.loss(ye, Fe)] : [] };
      let bestLoss = hasEval ? this.history.eval[0] : Infinity;
      let bestIter = 0;

      for (let m = 0; m < this.nEstimators; m++) {
        let rows;
        if (this.subsample < 1) {
          const kRows = Math.max(1, Math.floor(this.subsample * n));
          rows = rng.sample(n, kRows).sort((a, b) => a - b);
        } else {
          rows = U.range(n);
        }
        const Gall = loss.gradient(y, F);
        const Hall = loss.hessian(y, F);
        const stage = [];
        for (let k = 0; k < K; k++) {
          const g = K > 1 ? Gall.map((r) => r[k]) : Gall;
          const h = K > 1 ? Hall.map((r) => r[k]) : Hall;
          let features = null;
          if (this.colsample < 1) {
            const kFeat = Math.max(1, Math.floor(this.colsample * d));
            if (kFeat < d) features = rng.sample(d, kFeat).sort((a, b) => a - b);
          }
          const tree = this._newTree(newton);
          tree.fit(X, g, newton ? h : null, { rows, rng, bins: this.bins, features });
          if (!newton) this._lineSearch(tree, loss, y, F, k);
          stage.push(tree);
        }
        for (let k = 0; k < K; k++) {
          const tree = stage[k];
          for (let i = 0; i < n; i++) {
            const upd = this.learningRate * tree.predictOne(X[i]);
            if (K > 1) F[i][k] += upd;
            else F[i] += upd;
          }
          if (hasEval) {
            for (let i = 0; i < Xe.length; i++) {
              const upd = this.learningRate * tree.predictOne(Xe[i]);
              if (K > 1) Fe[i][k] += upd;
              else Fe[i] += upd;
            }
          }
        }
        this.trees.push(stage);
        this.history.train.push(loss.loss(y, F));
        if (hasEval) {
          const cur = loss.loss(ye, Fe);
          this.history.eval.push(cur);
          if (cur < bestLoss) {
            bestLoss = cur;
            bestIter = m + 1;
          } else if (this.earlyStoppingRounds && m + 1 - bestIter >= this.earlyStoppingRounds) {
            break;
          }
        }
        if (o.callback && o.callback(m + 1, stage, this)) break;
      }
      this.bestIteration = hasEval ? bestIter : this.trees.length;
      this.stoppedEarly = !!(hasEval && this.earlyStoppingRounds && this.trees.length < this.nEstimators);
      if (this.stoppedEarly) this.trees = this.trees.slice(0, this.bestIteration);
      this.trainF = F;
      return this;
    }

    _lineSearch(tree, loss, y, F, k) {
      if (loss.name === 'squared') return;
      for (const nd of tree.leaves) {
        const r = nd.rows;
        if (this.multiclass) {
          const resid = r.map((i) => (y[i] === k ? 1 : 0) - loss.transformOne(F[i])[k]);
          nd.value = loss.leafValueK(resid);
        } else {
          nd.value = loss.leafValue(r.map((i) => y[i]), r.map((i) => F[i]));
        }
      }
    }

    get nTrees() {
      return this.trees.length;
    }

    /** Сырая оценка F(x) для одного объекта по первым nIter итерациям. */
    predictRawOne(x, nIter = null) {
      const M = nIter === null ? this.trees.length : Math.min(nIter, this.trees.length);
      if (this.multiclass) {
        const f = this.init.slice();
        for (let m = 0; m < M; m++) {
          const stage = this.trees[m];
          for (let k = 0; k < stage.length; k++) f[k] += this.learningRate * stage[k].predictOne(x);
        }
        return f;
      }
      let f = this.init;
      for (let m = 0; m < M; m++) f += this.learningRate * this.trees[m][0].predictOne(x);
      return f;
    }

    predictRaw(X, nIter = null) {
      return X.map((x) => this.predictRawOne(x, nIter));
    }

    predict(X, nIter = null) {
      const F = this.predictRaw(X, nIter);
      if (this.lossFn.isClassification) {
        if (this.multiclass) return F.map((f) => U.argmax(f));
        return F.map((f) => (f > 0 ? 1 : 0));
      }
      return this.lossFn.transform(F);
    }

    /** Бинарная задача: вероятность класса 1; многоклассовая: массив вероятностей. */
    predictProba(X, nIter = null) {
      return this.predictRaw(X, nIter).map((f) => this.lossFn.transformOne(f));
    }

    /** Поэтапные сырые оценки: массив длины M+1 (0 — константа F0). Только K = 1. */
    stagedRaw(X) {
      const out = [X.map(() => this.init)];
      let cur = out[0].slice();
      for (const stage of this.trees) {
        cur = cur.map((f, i) => f + this.learningRate * stage[0].predictOne(X[i]));
        out.push(cur);
      }
      return out;
    }

    featureImportances() {
      const total = new Array(this.nFeatures).fill(0);
      for (const stage of this.trees) {
        for (const t of stage) t.featureGains().forEach((v, j) => (total[j] += v));
      }
      const s = U.sum(total);
      return s > 0 ? total.map((v) => v / s) : total;
    }

    /** Код Python (gbcourse), воспроизводящий эту модель. */
    toPython(varName = 'model') {
      const args = [];
      for (const [k, v] of Object.entries(this.params)) {
        if (v === DEFAULTS[k] && k !== 'loss' && k !== 'nEstimators' && k !== 'learningRate' && k !== 'maxDepth') continue;
        args.push(PY_PARAM[k] + '=' + GBC.datasets.pyValue(v));
      }
      return varName + ' = GradientBoosting(' + args.join(', ') + ')';
    }
  }

  /**
   * Кэш поэтапных предсказаний на фиксированной сетке: быстрое «перематывание»
   * числа деревьев ползунком (добавляем/вычитаем вклады деревьев, K = 1).
   */
  class StageCache {
    constructor(model, X) {
      this.model = model;
      this.X = X;
      this.m = 0;
      this.F = new Float64Array(X.length).fill(model.init);
    }

    seek(m) {
      const model = this.model;
      m = Math.max(0, Math.min(m, model.trees.length));
      if (m < this.m && m < this.m / 2) {
        this.F.fill(model.init);
        this.m = 0;
      }
      while (this.m < m) {
        const t = model.trees[this.m][0];
        for (let i = 0; i < this.X.length; i++) this.F[i] += model.learningRate * t.predictOne(this.X[i]);
        this.m++;
      }
      while (this.m > m) {
        this.m--;
        const t = model.trees[this.m][0];
        for (let i = 0; i < this.X.length; i++) this.F[i] -= model.learningRate * t.predictOne(this.X[i]);
      }
      return this.F;
    }
  }

  GBC.GradientBoosting = GradientBoosting;
  GBC.StageCache = StageCache;
  GBC.BOOSTING_DEFAULTS = DEFAULTS;
})(typeof window !== 'undefined' ? window : globalThis);
