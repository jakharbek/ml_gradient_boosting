/* Урок 9: словарь параметров четырёх реализаций с фильтром. */
(function () {
  'use strict';
  const { h: H, ui } = GBC;

  // [понятие, gbcourse, XGBoost, LightGBM, CatBoost]; значение по умолчанию — в скобках.
  // Значения проверены ноутбуком урока (XGBoost 3.4.1, LightGBM 4.7.0, CatBoost 1.2.10).
  const ROWS = [
    ['Число деревьев', 'n_estimators (100)', 'n_estimators (100)', 'n_estimators (100)', 'iterations (1000)'],
    ['Темп обучения ν', 'learning_rate (0.1)', 'learning_rate, eta (0.3)', 'learning_rate (0.1)', 'learning_rate (подбирается автоматически)'],
    ['Глубина дерева', 'max_depth (3)', 'max_depth (6)', 'max_depth (−1: без ограничения)', 'depth (6)'],
    ['Число листьев', 'max_leaves (нет)', 'max_leaves (0: без ограничения)', 'num_leaves (31)', 'max_leaves (31, только grow_policy="Lossguide")'],
    ['Порядок роста', 'growth ("depthwise")', 'grow_policy ("depthwise")', '— (всегда по листьям, leaf-wise)', 'grow_policy ("SymmetricTree")'],
    ['Минимум объектов в листе', 'min_samples_leaf (1)', '—', 'min_child_samples (20)', 'min_data_in_leaf (1)'],
    ['Минимум суммы гессианов H в листе', 'min_child_weight (0)', 'min_child_weight (1)', 'min_child_weight (0.001)', '—'],
    ['L2-штраф λ на листья', 'reg_lambda (0)', 'reg_lambda, lambda (1)', 'reg_lambda, lambda_l2 (0)', 'l2_leaf_reg (3)'],
    ['L1-штраф α на листья', 'reg_alpha (0)', 'reg_alpha, alpha (0)', 'reg_alpha, lambda_l1 (0)', '—'],
    ['Минимальный выигрыш γ', 'gamma (0)', 'gamma (0; сравнивается с удвоенным выигрышем)', 'min_split_gain (0)', '—'],
    ['Доля строк на дерево', 'subsample (1)', 'subsample (1)', 'subsample (1; работает только при subsample_freq > 0)', 'subsample (0.8 при bootstrap_type="MVS")'],
    ['Доля признаков на дерево', 'colsample (1)', 'colsample_bytree (1)', 'colsample_bytree (1)', 'rsm (1)'],
    ['Доля признаков в узле', 'colsample_bynode (нет)', 'colsample_bynode (1)', 'feature_fraction_bynode (1)', '—'],
    ['Корзин гистограммы', 'max_bins (нет: точный перебор)', 'max_bin (256)', 'max_bin (255)', 'border_count (254)'],
    ['Ранняя остановка', 'early_stopping_rounds', 'early_stopping_rounds', 'callbacks=[lgb.early_stopping(k)]', 'early_stopping_rounds'],
    ['Зерно случайности', 'seed (0)', 'random_state', 'random_state', 'random_seed (0)'],
  ];
  const HEAD = ['Понятие', 'gbcourse', 'XGBoost', 'LightGBM', 'CatBoost'];

  /** «name (default)» → имя параметра моноширинным и значение по умолчанию мелким текстом. */
  function cell(text) {
    const m = /^(.*?)\s*\((.*)\)$/.exec(text);
    if (!m || text === '—') return H('td', null, text === '—' ? '—' : H('code', null, text));
    if (m[1] === '—') return H('td', null, 'нет параметра: ' + m[2]);
    return H('td', null, H('code', null, m[1]), H('div', { class: 'rosetta-def' }, 'по умолчанию: ' + m[2]));
  }

  GBC.widget('rosetta', (el) => {
    const shown = [false, true, true, true]; // gbcourse, XGBoost, LightGBM, CatBoost
    const w = ui.shell(el, { title: 'Словарь параметров', sub: 'Выберите библиотеки для сравнения и начните вводить понятие или имя параметра — например, «лист», «lambda» или «subsample».', noControls: true, foot: false });
    const input = H('input', { type: 'search', class: 'input', placeholder: 'Поиск…', 'aria-label': 'Поиск по словарю параметров' });
    const count = H('div', { class: 'ctl-help' });
    const toggles = H('div', { class: 'rosetta-libs' });
    w.main.appendChild(H('div', { class: 'ctl rosetta-filter' }, input, count));
    w.main.appendChild(toggles);
    const table = H('table', { class: 'data rosetta' });
    const headCells = HEAD.map((t) => H('th', null, t));
    table.appendChild(H('thead', null, H('tr', null, ...headCells)));
    const body = H('tbody');
    table.appendChild(body);
    w.main.appendChild(H('div', { class: 'table-wrap' }, table));
    const trs = ROWS.map((r) => {
      const cells = [H('td', { class: 'rosetta-concept' }, r[0]), ...r.slice(1).map(cell)];
      cells.slice(1).forEach((c, k) => c.setAttribute('data-label', HEAD[k + 1]));
      const tr = H('tr', null, ...cells);
      body.appendChild(tr);
      return { tr, cells, text: r.join(' ').toLowerCase() };
    });
    function columns() {
      for (let k = 0; k < 4; k++) {
        headCells[k + 1].hidden = !shown[k];
        for (const t of trs) t.cells[k + 1].hidden = !shown[k];
      }
    }
    HEAD.slice(1).forEach((name, k) => ui.toggle(toggles, { label: name, checked: shown[k], onChange: (v) => ((shown[k] = v), columns()) }));
    function filter() {
      const q = input.value.trim().toLowerCase();
      let n = 0;
      for (const t of trs) {
        const show = !q || t.text.includes(q);
        t.tr.hidden = !show;
        if (show) n++;
      }
      count.textContent = 'Показано ' + n + ' из ' + ROWS.length;
    }
    input.addEventListener('input', filter);
    columns();
    filter();
  });
})();
