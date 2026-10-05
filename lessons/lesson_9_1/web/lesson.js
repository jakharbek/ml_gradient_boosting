/* Урок 9.1: лаборатория XGBoost — кривые обучения, ранняя остановка, пять видов важности. */
(function () {
  'use strict';
  const { util: U, ui } = GBC;

  const KINDS = [
    { value: 'weight', label: 'weight' },
    { value: 'gain', label: 'gain' },
    { value: 'total_gain', label: 'total_gain' },
    { value: 'cover', label: 'cover' },
    { value: 'total_cover', label: 'total_cover' },
  ];

  /** Важности как в XGBoost get_score: выигрыш в масштабе XGBoost (без ½, то есть ×2 к gbcourse). */
  function importances(model, d) {
    const cnt = new Array(d).fill(0);
    const gain = new Array(d).fill(0);
    const cover = new Array(d).fill(0);
    for (const stage of model.trees) {
      for (const nd of stage[0].nodes) {
        if (nd.left < 0) continue;
        cnt[nd.feature] += 1;
        gain[nd.feature] += 2 * nd.gain;
        cover[nd.feature] += nd.H;
      }
    }
    return {
      weight: cnt,
      total_gain: gain,
      gain: gain.map((v, j) => (cnt[j] ? v / cnt[j] : 0)),
      total_cover: cover,
      cover: cover.map((v, j) => (cnt[j] ? v / cnt[j] : 0)),
    };
  }

  GBC.widget('xgb-lab', (el) => {
    const s = { eta: 0.3, depth: 6, lambda: 1, gamma: 0, mcw: 1, esr: 20, kind: 'weight' };
    const w = ui.shell(el, {
      title: 'Лаборатория XGBoost',
      sub: 'Задача Фридмана: 1000 объектов, x0–x4 информативны, x5–x9 — шум; 70% обучение, 30% валидация. До 500 деревьев с ранней остановкой. Важности считаются по деревьям до лучшей итерации (как у модели после ранней остановки в gbcourse).',
    });
    const refit = U.rafThrottle(() => fit());
    ui.slider(w.controls, { label: 'learning_rate (eta)', min: 0.02, max: 1, step: 0.01, value: s.eta, onInput: (v) => ((s.eta = v), refit()) });
    ui.slider(w.controls, { label: 'max_depth', min: 1, max: 10, step: 1, value: s.depth, format: String, onInput: (v) => ((s.depth = v), refit()) });
    ui.slider(w.controls, { label: 'reg_lambda', min: 0, max: 50, step: 0.5, value: s.lambda, onInput: (v) => ((s.lambda = v), refit()) });
    ui.slider(w.controls, { label: 'gamma (шкала XGBoost)', min: 0, max: 50, step: 0.5, value: s.gamma, onInput: (v) => ((s.gamma = v), refit()) });
    ui.slider(w.controls, { label: 'min_child_weight', min: 0, max: 30, step: 1, value: s.mcw, format: String, onInput: (v) => ((s.mcw = v), refit()) });
    ui.slider(w.controls, { label: 'early_stopping_rounds', values: [5, 10, 20, 50, 100, 500], value: s.esr, format: (v) => (v >= 500 ? 'выкл.' : String(v)), onInput: (v) => ((s.esr = v), refit()) });
    ui.select(w.controls, { label: 'Вид важности', value: s.kind, options: KINDS, onChange: (v) => ((s.kind = v), drawImp()) });
    const curve = new GBC.Plot(w.main, { height: 240, x: { label: 'число деревьев' }, y: { label: 'RMSE', type: 'log' }, crosshair: true });
    const imp = new GBC.Plot(w.main, { height: 220, x: { label: 'признак', domain: [-0.6, 9.6], ticks: U.range(10), format: (v) => 'x' + v }, y: { label: 'важность' } });
    const stats = ui.stats(w.foot, [{ key: 'best', label: 'best_iteration (с нуля)' }, { key: 'trees', label: 'деревьев в модели XGBoost' }, { key: 'rmse', label: 'лучшая RMSE на валидации' }]);
    const data = GBC.datasets.friedman1({ n: 1000, noise: 1, seed: 92 });
    const Xtr = data.X.slice(0, 700);
    const ytr = data.y.slice(0, 700);
    const Xva = data.X.slice(700);
    const yva = data.y.slice(700);
    let model = null;

    w.pythonAction(() => [
      'import numpy as np',
      'import xgboost as xgb',
      'from gbcourse import datasets',
      '',
      'X, y = datasets.friedman1(n=1000, noise=1.0, seed=92)',
      'X_tr, X_val, y_tr, y_val = X[:700], X[700:], y[:700], y[700:]',
      'model = xgb.XGBRegressor(',
      '    n_estimators=500, learning_rate=' + s.eta + ', max_depth=' + s.depth + ', reg_lambda=' + s.lambda + ',',
      '    gamma=' + s.gamma + ', min_child_weight=' + s.mcw + ', tree_method="exact", base_score=float(y_tr.mean()),',
      '    eval_metric="rmse"' + (s.esr < 500 ? ', early_stopping_rounds=' + s.esr : '') + ',',
      ')',
      'model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)',
      'rmse = model.evals_result()["validation_0"]["rmse"]',
      'print("лучшая итерация (с нуля):", int(np.argmin(rmse)), "| лучшая RMSE:", round(min(rmse), 4))',
      'print("деревьев в модели:", model.get_booster().num_boosted_rounds())',
      'print(model.get_booster().get_score(importance_type="' + s.kind + '"))',
    ].join('\n'));

    function fit() {
      // Алгоритм XGBoost exact: γ gbcourse = gamma XGBoost / 2. История включает модель из 0 деревьев.
      model = new GBC.GradientBoosting({
        mode: 'newton', nEstimators: 500, learningRate: s.eta, maxDepth: s.depth, regLambda: s.lambda,
        gamma: s.gamma / 2, minChildWeight: s.mcw, earlyStoppingRounds: s.esr < 500 ? s.esr : null,
      }).fit(Xtr, ytr, { evalSet: [Xva, yva] });
      const ev = model.history.eval.map((v) => Math.sqrt(2 * v));
      const tr = model.history.train.map((v) => Math.sqrt(2 * v));
      let best = 1;
      for (let m = 2; m < ev.length; m++) if (ev[m] < ev[best]) best = m;
      const built = ev.length - 1; // сколько деревьев построено до остановки — столько их и в модели XGBoost
      const xs = U.range(built).map((i) => i + 1);
      curve.render([
        { type: 'line', x: xs, y: tr.slice(1), color: 'train', width: 2, label: 'обучение' },
        { type: 'line', x: xs, y: ev.slice(1), color: 'valid', width: 2, label: 'валидация' },
        { type: 'vline', x: best, color: 'ink', dash: '4 3', width: 1.2, text: 'лучшая итерация' },
      ], { x: [0, 500], y: [Math.min(...tr.slice(1), ...ev.slice(1)) / 1.3, Math.max(...tr.slice(1), ...ev.slice(1)) * 1.3] });
      stats.set('best', String(best - 1));
      stats.set('trees', String(built));
      stats.set('rmse', U.fmt(ev[best], 4));
      drawImp();
    }

    function drawImp() {
      const vals = importances(model, 10)[s.kind];
      imp.render([
        { type: 'bars', x: U.range(10), y: vals, color: (i) => (i < 5 ? 'model' : 'muted'), width: 0.7, label: 'важность', tooltip: (i) => [['признак', 'x' + i], [s.kind, U.fmt(vals[i], 4)], ['тип', i < 5 ? 'информативный' : 'шум']] },
      ]);
    }
    fit();
  });
})();
