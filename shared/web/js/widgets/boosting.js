/* =====================================================================================
 * Общие виджеты бустинга:
 *   boosting-1d — регрессия шаг за шагом: данные, F_{m−1} → F_m, остатки и дерево h_m,
 *                 кривые потерь; любые потери, темп, глубина, подвыборка, валидация;
 *   boosting-2d — классификация на плоскости: вероятность, граница решения, кривые;
 *   hero-demo   — автоматическая анимация для главной страницы.
 *
 * Конфигурация через data-config (все поля необязательны), например:
 *   <div data-widget="boosting-1d" data-config='{"dataset": {"kind": "wave"},
 *        "model": {"learningRate": 0.3, "maxDepth": 1}, "controls": ["lr", "depth", "M"]}'></div>
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC;
  const U = GBC.util;
  const H = GBC.h;
  const ui = GBC.ui;

  const DATA_KINDS = [
    { value: 'sine', label: 'Синус' },
    { value: 'wave', label: 'Волна с трендом' },
    { value: 'step', label: 'Ступеньки' },
    { value: 'linear', label: 'Прямая' },
    { value: 'quadratic', label: 'Парабола' },
    { value: 'hetero', label: 'Растущий шум' },
  ];
  const LOSSES_REG = [
    { value: 'squared', label: 'Квадратичная (L2)' },
    { value: 'absolute', label: 'Абсолютная (L1)' },
    { value: 'huber', label: 'Хьюбер' },
    { value: 'quantile', label: 'Квантильная' },
  ];
  const CLS_KINDS = [
    { value: 'moons', label: 'Луны' },
    { value: 'circles', label: 'Круги' },
    { value: 'xor', label: 'XOR' },
    { value: 'spiral', label: 'Спирали' },
    { value: 'blobs', label: 'Два облака' },
    { value: 'linear', label: 'Почти линейная' },
    { value: 'blobs3', label: 'Три класса' },
  ];

  const pyHeader = (extra = '') =>
    'import matplotlib.pyplot as plt\nfrom gbcourse import datasets, GradientBoosting\nfrom gbcourse.plotting import use_course_style' +
    extra + '\n\nuse_course_style()\n';

  function modelArgs(p) {
    const parts = ['loss=' + JSON.stringify(p.loss), 'n_estimators=' + p.nEstimators, 'learning_rate=' + U.pyNum(p.learningRate), 'max_depth=' + p.maxDepth];
    if (p.loss === 'huber') parts.push('huber_delta=' + U.pyNum(p.huberDelta));
    if (p.loss === 'quantile') parts.push('quantile_alpha=' + U.pyNum(p.quantileAlpha));
    if (p.subsample < 1) parts.push('subsample=' + U.pyNum(p.subsample), 'seed=' + p.seed);
    if (p.minSamplesLeaf > 1) parts.push('min_samples_leaf=' + p.minSamplesLeaf);
    if (p.mode === 'newton') parts.push('mode="newton"', 'reg_lambda=' + U.pyNum(p.regLambda));
    return parts.join(', ');
  }

  /* =================================================================================
   * boosting-1d
   * ================================================================================= */
  GBC.widget('boosting-1d', (el, cfg) => {
    const ds = Object.assign({ kind: 'sine', n: 80, noise: 0.3, seed: 42, outliers: 0 }, cfg.dataset || {});
    const mp = Object.assign({ loss: 'squared', nEstimators: 100, learningRate: 0.1, maxDepth: 2, subsample: 1, minSamplesLeaf: 1, huberDelta: 1, quantileAlpha: 0.5, seed: 0, mode: 'friedman', regLambda: 0 }, cfg.model || {});
    const controlsList = cfg.controls || ['dataset', 'noise', 'lr', 'depth', 'M'];
    const panels = cfg.panels || ['model', 'residuals', 'curve'];
    const split = cfg.split || 0;
    const state = { m: cfg.start ?? 1, pseudo: true };
    const w = ui.shell(el, {
      title: cfg.title || 'Градиентный бустинг шаг за шагом',
      sub: cfg.sub || 'Каждое новое дерево учится на ошибках текущей модели. Двигайте номер итерации m и параметры.',
    });

    let data;
    let model;
    let trainIdx;
    let validIdx;
    let gridX;
    let gridCache;

    // --- контролы
    const C = w.controls;
    const refit = U.rafThrottle(() => fit());
    if (controlsList.includes('dataset'))
      ui.select(C, { label: 'Данные', options: DATA_KINDS, value: ds.kind, onChange: (v) => ((ds.kind = v), fit(true)) });
    if (controlsList.includes('noise'))
      ui.slider(C, { label: 'Шум σ', min: 0, max: 1.2, step: 0.05, value: ds.noise, onInput: (v) => ((ds.noise = v), refit()) });
    if (controlsList.includes('outliers'))
      ui.slider(C, { label: 'Доля выбросов', min: 0, max: 0.3, step: 0.01, value: ds.outliers, onInput: (v) => ((ds.outliers = v), refit()) });
    if (controlsList.includes('n'))
      ui.slider(C, { label: 'Объектов n', min: 10, max: 300, step: 10, value: ds.n, format: (v) => String(v), onInput: (v) => ((ds.n = v), refit()) });
    if (controlsList.includes('loss'))
      ui.select(C, { label: 'Функция потерь', options: LOSSES_REG, value: mp.loss, onChange: (v) => ((mp.loss = v), updLossCtl(), fit()) });
    const huberCtl = controlsList.includes('loss') || controlsList.includes('delta')
      ? ui.slider(C, { label: 'δ (Хьюбер)', min: 0.1, max: 3, step: 0.1, value: mp.huberDelta, onInput: (v) => ((mp.huberDelta = v), refit()) })
      : null;
    const alphaCtl = controlsList.includes('loss') || controlsList.includes('alpha')
      ? ui.slider(C, { label: 'α (квантиль)', min: 0.05, max: 0.95, step: 0.05, value: mp.quantileAlpha, onInput: (v) => ((mp.quantileAlpha = v), refit()) })
      : null;
    function updLossCtl() {
      if (huberCtl) huberCtl.el.hidden = mp.loss !== 'huber';
      if (alphaCtl) alphaCtl.el.hidden = mp.loss !== 'quantile';
    }
    updLossCtl();
    if (controlsList.includes('lr'))
      ui.slider(C, { label: 'Темп обучения ν', min: 0.01, max: 1, log: true, value: mp.learningRate, format: (v) => U.fmt(v, 3), onInput: (v) => ((mp.learningRate = v), refit()) });
    if (controlsList.includes('depth'))
      ui.slider(C, { label: 'Глубина деревьев', min: 1, max: 6, step: 1, value: mp.maxDepth, format: (v) => String(v), onInput: (v) => ((mp.maxDepth = v), refit()) });
    if (controlsList.includes('minleaf'))
      ui.slider(C, { label: 'Мин. объектов в листе', min: 1, max: 30, step: 1, value: mp.minSamplesLeaf, format: (v) => String(v), onInput: (v) => ((mp.minSamplesLeaf = v), refit()) });
    if (controlsList.includes('subsample'))
      ui.slider(C, { label: 'Подвыборка (subsample)', min: 0.1, max: 1, step: 0.05, value: mp.subsample, onInput: (v) => ((mp.subsample = v), refit()) });
    if (controlsList.includes('lambda'))
      ui.slider(C, { label: 'λ (L2-штраф листьев)', min: 0, max: 20, step: 0.5, value: mp.regLambda, onInput: (v) => ((mp.regLambda = v), (mp.mode = v > 0 ? 'newton' : mp.mode), refit()) });
    if (controlsList.includes('M'))
      ui.slider(C, { label: 'Всего деревьев M', min: 1, max: 300, step: 1, value: mp.nEstimators, format: (v) => String(v), onInput: (v) => ((mp.nEstimators = v), refit()) });
    if (controlsList.includes('seed'))
      ui.slider(C, { label: 'Зерно данных', min: 0, max: 50, step: 1, value: ds.seed, format: (v) => String(v), onInput: (v) => ((ds.seed = v), refit()) });
    if (panels.includes('residuals') && mp.loss !== 'squared' || controlsList.includes('pseudo'))
      ui.toggle(C, { label: 'Псевдо-остатки −∂L/∂F', checked: state.pseudo, onChange: (v) => ((state.pseudo = v), draw()) });
    if (cfg.showTruth !== false) ui.toggle(C, { label: 'Истинная функция', checked: true, onChange: (v) => ((state.truth = v), draw()) });
    state.truth = cfg.showTruth !== false;

    // --- основная область
    const player = ui.player(w.main, {
      label: 'Итерация m (сколько деревьев в модели)', min: 0, max: mp.nEstimators, value: Math.min(state.m, mp.nEstimators), fps: cfg.fps || 8,
      format: (v, max) => 'm = ' + v + ' / ' + max,
      onChange: (v) => ((state.m = v), draw()),
    });
    const plotsBox = H('div', { class: panels.length >= 3 ? 'plots-2' : '' });
    w.main.appendChild(plotsBox);
    const mainPlot = panels.includes('model')
      ? new GBC.Plot(panels.length >= 3 ? w.main : plotsBox, {
          height: cfg.height || 300, x: { label: 'x', domain: [0, 10] }, y: { label: 'y' },
          table: () => ({ columns: ['x', 'y', 'F_m(x)', 'остаток y − F_m'], rows: trainIdx.map((i) => [data.x[i], data.y[i], trainF(state.m, i), data.y[i] - trainF(state.m, i)]) }),
        })
      : null;
    if (mainPlot && panels.length >= 3) w.main.insertBefore(mainPlot.root, plotsBox);
    const resPlot = panels.includes('residuals') ? new GBC.Plot(plotsBox, { height: 230, x: { label: 'x', domain: [0, 10] }, y: { label: 'остаток' } }) : null;
    const curvePlot = panels.includes('curve') ? new GBC.Plot(plotsBox, { height: 230, x: { label: 'итерация m' }, y: { label: 'потери' }, crosshair: true, crosshairTitle: (v) => 'm = ' + Math.round(v) }) : null;
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [
      { key: 'm', label: 'Деревьев' },
      { key: 'train', label: 'Потери (обучение)' },
      { key: 'valid', label: 'Потери (валидация)' },
      { key: 'mse', label: 'MSE обучения' },
      { key: 'f0', label: 'F_0' },
    ]);
    if (!split) stats.el.children[2].hidden = true;

    // Кэш поэтапных прогнозов на обучающих объектах
    let stagedTrain = null;
    const trainF = (m, i) => stagedTrain[m][trainIdx.indexOf(i)];

    function fit(newData = true) {
      if (newData || !data) {
        data = GBC.datasets.regression1d(ds);
        const all = U.range(data.y.length);
        if (split > 0) {
          const s = GBC.datasets.trainTestSplit(data.X, data.y, split, 0);
          trainIdx = s.trainIdx;
          validIdx = s.testIdx;
        } else {
          trainIdx = all;
          validIdx = [];
        }
      }
      const Xtr = trainIdx.map((i) => data.X[i]);
      const ytr = trainIdx.map((i) => data.y[i]);
      const evalSet = validIdx.length ? [validIdx.map((i) => data.X[i]), validIdx.map((i) => data.y[i])] : null;
      model = new GBC.GradientBoosting(Object.assign({}, mp)).fit(Xtr, ytr, { evalSet });
      stagedTrain = model.stagedRaw(Xtr);
      gridX = U.linspace(0, 10, 400).map((v) => [v]);
      gridCache = new GBC.StageCache(model, gridX);
      player.setMax(mp.nEstimators);
      if (state.m > mp.nEstimators) state.m = mp.nEstimators;
      draw();
    }

    function draw() {
      const m = Math.min(state.m, model.trees.length);
      const Xtr = trainIdx.map((i) => data.x[i]);
      const ytr = trainIdx.map((i) => data.y[i]);
      const Fm = stagedTrain[m];
      const Fprev = stagedTrain[Math.max(0, m - 1)];
      const gx = gridX.map((r) => r[0]);
      const loss = model.lossFn;
      if (mainPlot) {
        const Fgrid = Array.from(gridCache.seek(m));
        const prevGrid = m > 0 ? Array.from(gridCache.seek(m - 1)) : null;
        gridCache.seek(m);
        const layers = [
          { type: 'segments', x1: Xtr, y1: ytr, x2: Xtr, y2: Fm, color: 'residual', opacity: 0.55, width: 1.1 },
          state.truth ? { type: 'line', x: gx, y: gx.map((v) => GBC.datasets.trueFunction(ds.kind, v)), color: 'truth', dash: '5 4', width: 1.6, label: 'Истинная f(x)', hover: false } : null,
          validIdx.length ? { type: 'points', x: validIdx.map((i) => data.x[i]), y: validIdx.map((i) => data.y[i]), color: 'valid', hollow: true, r: 3.5, label: 'Валидация' } : null,
          {
            type: 'points', x: Xtr, y: ytr, color: 'data', r: 3.6, label: 'Обучение',
            tooltip: (i) => [['x', U.fmt(Xtr[i], 3)], ['y', U.fmt(ytr[i], 3)], ['F_{' + m + '}(x)', U.fmt(Fm[i], 3)], ['остаток', U.fmt(ytr[i] - Fm[i], 3)]].map(([k, v]) => ({ label: k, value: v })),
          },
          prevGrid && cfg.showPrev !== false ? { type: 'line', x: gx, y: prevGrid, color: 'model-prev', width: 1.6, label: 'F_{' + (m - 1) + '}(x)' } : null,
          { type: 'line', x: gx, y: Fgrid, color: 'model', width: 2.4, label: 'F_{' + m + '}(x)' },
        ];
        mainPlot.render(layers);
      }
      if (resPlot) {
        const tree = m > 0 ? model.trees[m - 1][0] : null;
        const yv = ytr;
        const r = state.pseudo ? loss.negativeGradient(yv, Fprev) : yv.map((v, i) => v - Fprev[i]);
        const layers = [
          { type: 'hline', y: 0, color: 'axis', width: 1 },
          { type: 'points', x: Xtr, y: r, color: 'data', r: 3.4, label: state.pseudo ? 'псевдо-остатки r_i' : 'остатки y − F_{' + Math.max(0, m - 1) + '}', tooltip: (i) => [{ label: 'x', value: U.fmt(Xtr[i], 3) }, { label: 'остаток', value: U.fmt(r[i], 3) }] },
          tree ? { type: 'steps', segments: tree.segments1d(0, 10), color: 'tree', width: 2.4, label: 'дерево h_{' + m + '}(x)' } : null,
        ];
        resPlot.setTitle(m > 0 ? 'Итерация ' + m + ': дерево h_' + m + ' приближает остатки' : 'Остатки константы F_0');
        resPlot.render(layers);
      }
      if (curvePlot) {
        const it = U.range(model.history.train.length);
        const layers = [
          { type: 'line', x: it, y: model.history.train, color: 'train', label: 'обучение' },
          model.history.eval.length ? { type: 'line', x: it, y: model.history.eval, color: 'valid', label: 'валидация' } : null,
          { type: 'vline', x: m, color: 'ink2', width: 1, dash: '3 3' },
          { type: 'points', x: [m], y: [model.history.train[m]], color: 'train', r: 4.5, legend: false },
          model.history.eval.length ? { type: 'points', x: [m], y: [model.history.eval[m]], color: 'valid', r: 4.5, legend: false } : null,
        ];
        curvePlot.setTitle('Потери: ' + loss.title);
        curvePlot.render(layers, { y: [0, Math.max(...model.history.train, ...(model.history.eval.length ? model.history.eval : [0])) * 1.05] });
      }
      const mse = GBC.metrics.mse(ytr, Fm);
      stats.set('m', String(m));
      stats.set('train', U.fmt(model.history.train[m], 4));
      if (model.history.eval.length) stats.set('valid', U.fmt(model.history.eval[m], 4));
      stats.set('mse', U.fmt(mse, 4));
      stats.set('f0', U.fmt(model.init, 3));
      if (cfg.narrate !== false) note.innerHTML = narrate(m, loss);
    }

    function narrate(m, loss) {
      const nu = U.fmt(mp.learningRate, 3);
      if (m === 0) return 'm = 0: модель — константа <b>F<sub>0</sub> = ' + U.fmt(model.init, 3) + '</b> (' + (loss.name === 'squared' ? 'среднее y' : loss.name === 'absolute' || loss.name === 'huber' ? 'медиана y' : 'лучшая константа для этих потерь') + '). Серые отрезки — остатки, которые будет исправлять первое дерево.';
      const tree = model.trees[m - 1][0];
      return 'Итерация ' + m + ': дерево h<sub>' + m + '</sub> (' + tree.nLeaves + ' листьев) обучено на остатках модели F<sub>' + (m - 1) + '</sub>. Обновление: F<sub>' + m + '</sub> = F<sub>' + (m - 1) + '</sub> + ' + nu + '·h<sub>' + m + '</sub>.' + (mp.learningRate < 1 ? ' Каждое дерево исправляет лишь долю ' + nu + ' ошибки — поэтому шаги маленькие.' : '');
    }

    w.pythonAction(() => {
      const dsArgs = Object.assign({}, ds);
      let code = pyHeader(', plot_boosting_step, plot_learning_curves') + '\n';
      code += '# Данные — те же, что в виджете (генератор Mulberry32 совпадает с JS)\nX, y = ' + GBC.datasets.toPython('regression_1d', dsArgs) + '\n';
      if (split > 0) code += 'X, X_val, y, y_val = datasets.train_test_split(X, y, test_size=' + split + ', seed=0)\n';
      code += '\nmodel = GradientBoosting(' + modelArgs(mp) + ')\nmodel.fit(X, y' + (split > 0 ? ', eval_set=(X_val, y_val)' : '') + ')\n\n';
      code += 'm = ' + Math.max(1, state.m) + '  # итерация, показанная в виджете\nplot_boosting_step(model, X, y, m' + (state.truth ? ', truth_kind="' + ds.kind + '"' : '') + ')\nplt.tight_layout()\nplt.show()\n\n';
      code += 'fig, ax = plt.subplots(figsize=(7, 3.2))\nplot_learning_curves(ax, model.history_)\nplt.show()\nprint(f"Потери на обучении после {m} итераций: {model.history_[\'train\'][m]:.4f}")\n';
      return code;
    });
    w.csvAction('boosting_1d_data.csv', () => ({ x: data.x, y: data.y, split: data.y.map((_, i) => (validIdx.includes(i) ? 'valid' : 'train')) }));
    fit();
    if (cfg.autoplay) player.play();
  });

  /* =================================================================================
   * boosting-2d
   * ================================================================================= */
  class GridCacheK {
    constructor(model, X) {
      this.model = model;
      this.X = X;
      this.K = model.multiclass ? model.lossFn.nClasses : 1;
      this.F = new Float64Array(X.length * this.K);
      this.reset();
    }
    reset() {
      for (let i = 0; i < this.X.length; i++) for (let k = 0; k < this.K; k++) this.F[i * this.K + k] = this.K > 1 ? this.model.init[k] : this.model.init;
      this.m = 0;
    }
    _apply(stage, sign) {
      const lr = this.model.learningRate * sign;
      for (let k = 0; k < stage.length; k++) {
        const t = stage[k];
        for (let i = 0; i < this.X.length; i++) this.F[i * this.K + k] += lr * t.predictOne(this.X[i]);
      }
    }
    seek(m) {
      m = Math.max(0, Math.min(m, this.model.trees.length));
      if (m < this.m / 2) this.reset();
      while (this.m < m) this._apply(this.model.trees[this.m++], 1);
      while (this.m > m) this._apply(this.model.trees[--this.m], -1);
      return this.F;
    }
  }
  GBC.GridCacheK = GridCacheK;

  GBC.widget('boosting-2d', (el, cfg) => {
    const ds = Object.assign({ kind: 'moons', n: 200, noise: 0.25, seed: 42 }, cfg.dataset || {});
    const mp = Object.assign({ loss: 'logistic', nEstimators: 100, learningRate: 0.3, maxDepth: 2, subsample: 1, minSamplesLeaf: 1, seed: 0, mode: 'friedman', regLambda: 0 }, cfg.model || {});
    const controlsList = cfg.controls || ['dataset', 'noise', 'lr', 'depth', 'M'];
    const split = cfg.split ?? 0.3;
    const state = { m: cfg.start ?? Math.min(10, mp.nEstimators), showResid: false };
    const w = ui.shell(el, {
      title: cfg.title || 'Бустинг для классификации',
      sub: cfg.sub || 'Цвет фона — вероятность класса 1 по мнению модели, линия — граница решения p = 0.5.',
    });
    const C = w.controls;
    const refit = U.rafThrottle(() => fit());
    if (controlsList.includes('dataset'))
      ui.select(C, { label: 'Данные', options: CLS_KINDS, value: ds.kind, onChange: (v) => ((ds.kind = v), fit()) });
    if (controlsList.includes('noise'))
      ui.slider(C, { label: 'Шум', min: 0, max: 0.8, step: 0.05, value: ds.noise, onInput: (v) => ((ds.noise = v), refit()) });
    if (controlsList.includes('n'))
      ui.slider(C, { label: 'Объектов n', min: 40, max: 500, step: 20, value: ds.n, format: (v) => String(v), onInput: (v) => ((ds.n = v), refit()) });
    if (controlsList.includes('lr'))
      ui.slider(C, { label: 'Темп обучения ν', min: 0.01, max: 1, log: true, value: mp.learningRate, onInput: (v) => ((mp.learningRate = v), refit()) });
    if (controlsList.includes('depth'))
      ui.slider(C, { label: 'Глубина деревьев', min: 1, max: 6, step: 1, value: mp.maxDepth, format: (v) => String(v), onInput: (v) => ((mp.maxDepth = v), refit()) });
    if (controlsList.includes('subsample'))
      ui.slider(C, { label: 'Подвыборка', min: 0.1, max: 1, step: 0.05, value: mp.subsample, onInput: (v) => ((mp.subsample = v), refit()) });
    if (controlsList.includes('lambda'))
      ui.slider(C, { label: 'λ (L2-штраф)', min: 0, max: 20, step: 0.5, value: mp.regLambda, onInput: (v) => ((mp.regLambda = v), (mp.mode = 'newton'), refit()) });
    if (controlsList.includes('M'))
      ui.slider(C, { label: 'Всего деревьев M', min: 1, max: 400, step: 1, value: mp.nEstimators, format: (v) => String(v), onInput: (v) => ((mp.nEstimators = v), refit()) });
    if (controlsList.includes('resid'))
      ui.toggle(C, { label: 'Показать псевдо-остатки y − p', checked: false, onChange: (v) => ((state.showResid = v), draw()) });

    const player = ui.player(w.main, { label: 'Итерация m', min: 0, max: mp.nEstimators, value: state.m, fps: cfg.fps || 10, format: (v, max) => 'm = ' + v + ' / ' + max, onChange: (v) => ((state.m = v), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const surf = new GBC.Plot(box, { height: 330, equal: true, x: { label: 'x_0' }, y: { label: 'x_1' }, grid: 'none', margin: { left: 40, bottom: 38 } });
    const curve = new GBC.Plot(box, { height: 330, x: { label: 'итерация m' }, y: { label: 'log-loss' }, crosshair: true, crosshairTitle: (v) => 'm = ' + Math.round(v) });
    const note = w.note('', true);
    const stats = ui.stats(w.foot, [
      { key: 'm', label: 'Деревьев' },
      { key: 'acc', label: 'Точность (обучение)' },
      { key: 'vacc', label: 'Точность (валидация)' },
      { key: 'll', label: 'Log-loss (валидация)' },
    ]);
    let data;
    let model;
    let Xtr;
    let ytr;
    let Xva;
    let yva;
    let grid;
    let cache;
    let cacheTr;
    let cacheVa;
    const NG = 72;

    function fit() {
      data = GBC.datasets.classification2d(ds);
      const s = GBC.datasets.trainTestSplit(data.X, data.y, split, 0);
      Xtr = s.Xtrain;
      ytr = s.ytrain;
      Xva = s.Xtest;
      yva = s.ytest;
      const multi = ds.kind === 'blobs3';
      mp.loss = multi ? 'softmax' : 'logistic';
      model = new GBC.GradientBoosting(Object.assign({}, mp, multi ? { nClasses: 3 } : {})).fit(Xtr, ytr, { evalSet: yva.length ? [Xva, yva] : null });
      const xs = data.X.map((r) => r[0]);
      const ys = data.X.map((r) => r[1]);
      const [x0, x1] = U.extent(xs);
      const [y0, y1] = U.extent(ys);
      const px = (x1 - x0) * 0.08;
      const py = (y1 - y0) * 0.08;
      grid = { x0: x0 - px, x1: x1 + px, y0: y0 - py, y1: y1 + py, nx: NG, ny: NG };
      const pts = [];
      for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) pts.push([grid.x0 + ((grid.x1 - grid.x0) * i) / (NG - 1), grid.y0 + ((grid.y1 - grid.y0) * j) / (NG - 1)]);
      cache = new GridCacheK(model, pts);
      cacheTr = new GridCacheK(model, Xtr);
      cacheVa = new GridCacheK(model, Xva);
      player.setMax(mp.nEstimators);
      if (state.m > mp.nEstimators) state.m = mp.nEstimators;
      draw();
    }

    function probs(F, K, i) {
      if (K === 1) return U.sigmoid(F[i]);
      return GBC.losses.softmaxRow(Array.from(F.subarray(i * K, i * K + K)));
    }

    function draw() {
      const m = Math.min(state.m, model.trees.length);
      const K = cache.K;
      const F = cache.seek(m);
      const values = new Float64Array(NG * NG);
      let colorFn;
      if (K === 1) {
        for (let i = 0; i < NG * NG; i++) values[i] = U.sigmoid(F[i]);
        const pf = GBC.colors.proba();
        colorFn = (v) => pf(v);
      } else {
        const cls = GBC.colors.classes();
        const surface = GBC.colors.rgb('surface');
        const cols = [];
        for (let i = 0; i < NG * NG; i++) {
          const p = probs(F, K, i);
          const k = U.argmax(p);
          values[i] = i;
          const a = 0.15 + (0.55 * (p[k] - 1 / K)) / (1 - 1 / K);
          cols.push([surface[0] * (1 - a) + cls[k][0] * a, surface[1] * (1 - a) + cls[k][1] * a, surface[2] * (1 - a) + cls[k][2] * a, 255]);
        }
        colorFn = (v) => cols[v];
      }
      const g = Object.assign({ values }, grid);
      const Ftr = cacheTr.seek(m);
      const Fva = cacheVa.seek(m);
      const residColor = GBC.colors.diverging();
      const layers = [{ type: 'heatmap', grid: g, colorFn, opacity: 0.9 }];
      if (K === 1) layers.push({ type: 'contour', grid: g, level: 0.5, color: 'ink2', width: 1.8 });
      const classNames = ['класс 0', 'класс 1', 'класс 2'];
      for (let c = 0; c < (K === 1 ? 2 : K); c++) {
        const idx = ytr.map((v, i) => (v === c ? i : -1)).filter((i) => i >= 0);
        layers.push({
          type: 'points', x: idx.map((i) => Xtr[i][0]), y: idx.map((i) => Xtr[i][1]), r: 4,
          color: state.showResid && K === 1 ? (j) => GBC.colors.rgbString(residColor(2 * (ytr[idx[j]] - U.sigmoid(Ftr[idx[j]])))) : 'class' + c,
          legendColor: 'class' + c,
          label: classNames[c], shape: c === 1 ? 'square' : 'circle',
          tooltip: (j) => {
            const i = idx[j];
            const p = probs(Ftr, K, i);
            return K === 1 ? [{ label: 'класс', value: String(ytr[i]) }, { label: 'p(класс 1)', value: U.fmt(p, 3) }, { label: 'y − p', value: U.fmt(ytr[i] - p, 3) }] : [{ label: 'класс', value: String(ytr[i]) }, { label: 'p', value: p.map((v) => U.fmt(v, 2)).join(' / ') }];
          },
        });
      }
      surf.render(layers, { x: [grid.x0, grid.x1], y: [grid.y0, grid.y1] });
      const it = U.range(model.history.train.length);
      curve.render([
        { type: 'line', x: it, y: model.history.train, color: 'train', label: 'обучение' },
        model.history.eval.length ? { type: 'line', x: it, y: model.history.eval, color: 'valid', label: 'валидация' } : null,
        { type: 'vline', x: m, color: 'ink2', width: 1, dash: '3 3' },
      ]);
      const predTr = Xtr.map((_, i) => (K === 1 ? (Ftr[i] > 0 ? 1 : 0) : U.argmax(probs(Ftr, K, i))));
      const predVa = Xva.map((_, i) => (K === 1 ? (Fva[i] > 0 ? 1 : 0) : U.argmax(probs(Fva, K, i))));
      stats.set('m', String(m));
      stats.set('acc', U.fmt(GBC.metrics.accuracy(ytr, predTr) * 100, 1) + '%');
      stats.set('vacc', yva.length ? U.fmt(GBC.metrics.accuracy(yva, predVa) * 100, 1) + '%' : '—');
      stats.set('ll', model.history.eval.length ? U.fmt(model.history.eval[m], 4) : '—');
      note.innerHTML = m === 0
        ? 'm = 0: модель знает только долю классов, F<sub>0</sub> = log(p/(1−p)) = ' + U.fmt(K === 1 ? model.init : model.init[0], 3) + '. Весь фон одного цвета.'
        : 'После ' + m + ' деревьев граница решения ' + (m < 5 ? 'ещё грубая — деревья неглубокие и шаги малы.' : 'повторяет форму классов. Следите за валидацией: если она растёт, модель переобучается.');
    }

    w.pythonAction(() => {
      let code = pyHeader(', plot_decision_surface, plot_learning_curves') + '\n';
      code += 'X, y = ' + GBC.datasets.toPython('classification_2d', ds) + '\n';
      code += 'X_train, X_val, y_train, y_val = datasets.train_test_split(X, y, test_size=' + split + ', seed=0)\n\n';
      const multi = ds.kind === 'blobs3';
      code += 'model = GradientBoosting(' + modelArgs(Object.assign({}, mp, { loss: multi ? 'softmax' : 'logistic' })) + (multi ? ', n_classes=3' : '') + ')\nmodel.fit(X_train, y_train, eval_set=(X_val, y_val))\n\n';
      code += 'm = ' + Math.max(1, state.m) + '\nfig, axes = plt.subplots(1, 2, figsize=(11, 4.4))\n';
      code += 'plot_decision_surface(axes[0], lambda Z: model.predict_proba(Z, n_iter=m), X_train, y_train, title=f"После {m} деревьев")\n';
      code += 'plot_learning_curves(axes[1], model.history_, ylabel="log-loss")\nplt.tight_layout()\nplt.show()\n';
      return code;
    });
    w.csvAction('boosting_2d_data.csv', () => ({ x0: data.X.map((r) => r[0]), x1: data.X.map((r) => r[1]), y: data.y }));
    fit();
  });

  /* =================================================================================
   * hero-demo — анимация на главной странице
   * ================================================================================= */
  GBC.widget('hero-demo', (el, cfg) => {
    const data = GBC.datasets.regression1d({ kind: 'wave', n: 60, noise: 0.35, seed: 7 });
    const model = new GBC.GradientBoosting({ nEstimators: 60, learningRate: 0.3, maxDepth: 2 }).fit(data.X, data.y);
    const staged = model.stagedRaw(data.X);
    const grid = U.linspace(0, 10, 300).map((v) => [v]);
    const cache = new GBC.StageCache(model, grid);
    el.classList.add('demo');
    el.textContent = '';
    const plot = new GBC.Plot(el, { height: cfg.height || 250, x: { domain: [0, 10], label: 'x' }, y: { label: 'y' }, margin: { left: 36, bottom: 34 } });
    const cap = H('div', { class: 'cap' });
    const left = H('span');
    const right = H('span');
    cap.append(left, right);
    el.appendChild(cap);
    let m = 0;
    let paused = false;
    const draw = () => {
      const F = Array.from(cache.seek(m));
      plot.render([
        { type: 'segments', x1: data.x, y1: data.y, x2: data.x, y2: staged[m], color: 'residual', opacity: 0.5 },
        { type: 'points', x: data.x, y: data.y, color: 'data', r: 3.2, label: 'данные' },
        { type: 'line', x: grid.map((r) => r[0]), y: F, color: 'model', width: 2.4, label: 'F_{' + m + '}(x)' },
      ]);
      left.textContent = m === 0 ? 'Старт: константа F₀' : 'Деревьев в сумме: ' + m;
      right.textContent = 'MSE = ' + U.fmt(GBC.metrics.mse(data.y, staged[m]), 3);
    };
    el.addEventListener('pointerenter', () => (paused = true));
    el.addEventListener('pointerleave', () => (paused = false));
    const reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) m = 25;
    draw();
    const tick = () => {
      if (!paused) {
        m = m >= 60 ? 0 : m + 1;
        draw();
      }
      // Пауза подольше на старте и на финише, чтобы глаз успел увидеть результат
      setTimeout(tick, m === 0 || m === 60 ? 1600 : m < 10 ? 520 : 200);
    };
    if (!reduce) setTimeout(tick, 1200);
  });
})(typeof window !== 'undefined' ? window : globalThis);
