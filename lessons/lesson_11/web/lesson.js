/* Урок 11: карта ошибки по сетке «темп × число листьев» (данные — results.js). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;

  GBC.widget('tuning-map', (el) => {
    const T = GBC.tuningGrid;
    const w = ui.shell(el, {
      title: 'Карта: темп × число листьев',
      sub: 'Каждая клетка — среднее по трём разбиениям. Рамкой отмечена лучшая клетка, точкой — клетки, которые от неё не отличить (разница меньше стандартного отклонения лучшей клетки между разбиениями). Цвет — место клетки в порядке от лучшей к худшей. Нажмите на клетку, чтобы увидеть подробности.',
      stack: true,
    });
    if (!T) {
      w.main.textContent = 'Нет данных: запустите python lessons/lesson_11/examples/tuning_grid.py';
      return;
    }
    const s = { what: 'val', sel: null };
    ui.segmented(w.controls, {
      label: 'Показать', value: s.what,
      options: [{ value: 'val', label: 'RMSE валидация' }, { value: 'test', label: 'RMSE тест' }, { value: 'trees', label: 'деревьев' }, { value: 'time', label: 'время, с' }],
      onChange: (v) => ((s.what = v), draw()),
    });
    const detail = H('div', { class: 'ctl-help tuning-detail' }, 'Нажмите на клетку.');
    w.controls.appendChild(detail);
    const table = H('table', { class: 'tuning-map' });
    w.main.appendChild(H('div', { class: 'table-wrap' }, table));
    let best = [0, 0];
    T.grid.forEach((row, i) => row.forEach((c, j) => {
      if (c.val < T.grid[best[0]][best[1]].val) best = [i, j];
    }));
    const bestCell = T.grid[best[0]][best[1]];

    function draw() {
      // Цвет по рангу: так видны различия и среди близких значений
      const sorted = T.grid.flat().map((c) => c[s.what]).sort((a, b) => a - b);
      const rank = (v) => sorted.indexOf(v) / (sorted.length - 1 || 1);
      const col = GBC.colors.sequential();
      table.textContent = '';
      table.appendChild(H('tr', null, H('th', null, 'ν \\ листьев'), ...T.leaves.map((l) => H('th', { class: 'num' }, String(l)))));
      T.grid.forEach((row, i) => {
        const cells = row.map((c, j) => {
          const t = rank(c[s.what]);
          // Для ошибки тёмный цвет — лучше (меньше); для деревьев и времени — больше
          const k = s.what === 'val' || s.what === 'test' ? 1 - t : t;
          const rgb = col(k);
          const dark = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] < 140; // цвет текста — по яркости фона (обе темы)
          const same = c.val - bestCell.val <= bestCell.val_std;
          const td = H('td', {
            class: 'num' + (i === best[0] && j === best[1] ? ' best' : ''),
            style: 'background:' + GBC.colors.rgbString(rgb) + ';color:' + (dark ? '#fff' : '#14171c'),
            title: 'ν = ' + T.lrs[i] + ', листьев ' + T.leaves[j],
          }, (s.what === 'trees' ? String(c.trees) : U.fmt(c[s.what], s.what === 'time' ? 2 : 3)) + (same ? ' •' : ''));
          td.addEventListener('click', () => {
            detail.innerHTML = '<b>ν = ' + T.lrs[i] + ', листьев ' + T.leaves[j] + '</b><br>RMSE валидация: ' + U.fmt(c.val, 4) + ' ± ' + U.fmt(c.val_std, 3) +
              '<br>RMSE тест: ' + U.fmt(c.test, 4) + '<br>деревьев: ' + c.trees + '<br>время: ' + U.fmt(c.time, 3) + ' с';
          });
          return td;
        });
        table.appendChild(H('tr', null, H('th', null, String(T.lrs[i])), ...cells));
      });
    }
    draw();
  });
})();
