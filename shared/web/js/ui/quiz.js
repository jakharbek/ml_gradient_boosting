/* =====================================================================================
 * GBC.quiz — тесты «Проверь себя».
 *
 * <div class="quiz" data-quiz-id="lesson_4_1">
 *   <script type="application/json">
 *   [{"q": "Вопрос (HTML, формулы $…$)", "options": ["A", "B"], "answer": 1, "explain": "…"},
 *    {"q": "Несколько ответов", "options": ["A", "B", "C"], "answer": [0, 2], "explain": "…"}]
 *   </script>
 * </div>
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC;
  const H = GBC.h;

  function html(tag, attrs, markup) {
    const el = H(tag, attrs);
    el.innerHTML = markup; // доверенный контент курса
    return el;
  }

  function mountQuiz(box) {
    if (box.dataset.mounted) return;
    box.dataset.mounted = '1';
    const script = box.querySelector('script[type="application/json"]');
    let items = [];
    try {
      items = JSON.parse(script ? script.textContent : box.dataset.quiz || '[]');
    } catch (e) {
      box.textContent = 'Ошибка в данных теста: ' + e.message;
      return;
    }
    const quizId = box.dataset.quizId || (root.document.documentElement.dataset.lesson || 'page') + ':quiz';
    box.textContent = '';
    const blocks = items.map((it, qi) => {
      const multi = Array.isArray(it.answer);
      const answers = new Set(multi ? it.answer : [it.answer]);
      const name = GBC.util.uid('q');
      const q = H('div', { class: 'quiz-q' });
      const title = H('p', { class: 'q' }, H('span', { class: 'n' }, qi + 1 + '.'));
      const qText = html('span', null, it.q);
      title.appendChild(qText);
      if (multi) title.appendChild(H('span', { class: 'badge', style: { marginLeft: '8px' } }, 'несколько ответов'));
      q.appendChild(title);
      const opts = H('div', { class: 'quiz-opts', role: multi ? 'group' : 'radiogroup' });
      const inputs = it.options.map((o, oi) => {
        const input = H('input', { type: multi ? 'checkbox' : 'radio', name, value: oi });
        const label = H('label', { class: 'quiz-opt' }, input, html('span', null, o), H('span', { class: 'mark' }));
        opts.appendChild(label);
        return { input, label, oi };
      });
      q.appendChild(opts);
      const explain = html('div', { class: 'quiz-explain', hidden: true }, it.explain || '');
      q.appendChild(explain);
      box.appendChild(q);
      return {
        check() {
          let correct = true;
          for (const { input, label, oi } of inputs) {
            const should = answers.has(oi);
            const mark = label.querySelector('.mark');
            label.classList.remove('correct', 'wrong');
            mark.textContent = '';
            if (should) {
              label.classList.add('correct');
              mark.textContent = input.checked ? '✓ верно' : '✓ правильный ответ';
            } else if (input.checked) {
              label.classList.add('wrong');
              mark.textContent = '✗ неверно';
            }
            if (input.checked !== should) correct = false;
            input.disabled = true;
          }
          if (it.explain) explain.hidden = false;
          return correct;
        },
        reset() {
          for (const { input, label } of inputs) {
            input.checked = false;
            input.disabled = false;
            label.classList.remove('correct', 'wrong');
            label.querySelector('.mark').textContent = '';
          }
          explain.hidden = true;
        },
      };
    });
    const score = H('span', { class: 'quiz-score', 'aria-live': 'polite' });
    const checkBtn = GBC.ui.button(null, { label: 'Проверить ответы', kind: 'primary' });
    const resetBtn = GBC.ui.button(null, { label: 'Пройти заново', kind: 'ghost' });
    resetBtn.hidden = true;
    const best = GBC.storage.get('quiz:' + quizId);
    const bestEl = H('span', { class: 'muted' }, best ? 'Лучший результат: ' + best.score + ' из ' + best.total : '');
    checkBtn.addEventListener('click', () => {
      let ok = 0;
      for (const b of blocks) if (b.check()) ok++;
      score.textContent = 'Результат: ' + ok + ' из ' + blocks.length + (ok === blocks.length ? ' — отлично!' : '');
      checkBtn.hidden = true;
      resetBtn.hidden = false;
      const prev = GBC.storage.get('quiz:' + quizId);
      if (!prev || ok > prev.score) GBC.storage.set('quiz:' + quizId, { score: ok, total: blocks.length });
      bestEl.textContent = '';
      GBC.bus.emit('quiz', { id: quizId, score: ok, total: blocks.length });
    });
    resetBtn.addEventListener('click', () => {
      blocks.forEach((b) => b.reset());
      score.textContent = '';
      checkBtn.hidden = false;
      resetBtn.hidden = true;
    });
    box.appendChild(H('div', { class: 'quiz-foot' }, checkBtn, resetBtn, score, bestEl));
    if (GBC.math) GBC.math.render(box);
  }

  GBC.quiz = {
    mountAll(scope) {
      for (const box of (scope || root.document).querySelectorAll('.quiz')) mountQuiz(box);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
