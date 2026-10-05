/* Урок 15.9, часть 2 — техника интегрирования, численные методы, несобственные интегралы, геометрия,
 * вероятность и машинное обучение.
 * Виджеты: решатель по шагам (наборы table/subst/parts/frac), замена переменной как перенос площади,
 * геометрия интегрирования по частям, три численных метода, порядок точности и правило Рунге, Монте-Карло,
 * несобственные интегралы, p-интегралы, площадь между кривыми и кривая Лоренца, объём и длина дуги,
 * плотность и функция распределения, ожидаемые потери и лучшая константа, AUC, интегрированные градиенты,
 * бустинг как интегрирование градиентного потока, тренажёр.
 * Помощники — из lesson.js (GBC.lesson159). */
(function () {
  'use strict';
  const { util: U, ui, h: H } = GBC;
  const {
    f2, f3, f4, f6, py, powFmt, decades, yDom, simpson, rsum, trap, erf, Phi, pdf, sigma, curve, signedArea, rootsOf, snap,
    texInto, texEl, card, cardGrid, rowTable, stepList, STARS,
  } = GBC.lesson159;
  const R = String.raw;
  const E = Math.exp;
  /** Короткая запись ошибки: 3.6e−2 вместо «0.04» или «0». */
  const sci = (v) => (v === 0 ? '0' : Math.abs(v) >= 0.1 && Math.abs(v) < 1000 ? U.fmt(v, 3) : v.toExponential(1).replace(/-/g, '−').replace('e+', 'e'));
  const PI = Math.PI;

  /* ==============================================================================
   * Шаги 14–17. Решатель по шагам: таблица, замена, по частям, дроби
   * ============================================================================== */
  const CHECK = 'Проверка: продифференцируйте ответ';
  const SOLVER = {
    table: [
      { lvl: 1, name: '∫ (3x² − 4x + 5) dx', tex: R`\int (3x^2-4x+5)\,dx`, f: (x) => 3 * x * x - 4 * x + 5, F: (x) => x ** 3 - 2 * x * x + 5 * x, a: 0, b: 2, view: [-0.5, 2.5], py: '3 * x**2 - 4 * x + 5', pyF: 'x**3 - 2 * x**2 + 5 * x', steps: [
        ['Линейность: интеграл суммы — сумма интегралов, множители выносим', R`=3\int x^2dx-4\int x\,dx+5\int dx`], ['Степенная формула ∫xⁿdx = xⁿ⁺¹/(n + 1)', R`=3\cdot\frac{x^3}{3}-4\cdot\frac{x^2}{2}+5x+C`], ['Упрощаем', R`=x^3-2x^2+5x+C`], [CHECK, R`(x^3-2x^2+5x)'=3x^2-4x+5\ \checkmark`]] },
      { lvl: 1, name: '∫ (√x + 1/x²) dx', tex: R`\int \left(\sqrt x+\frac1{x^2}\right)dx`, f: (x) => Math.sqrt(x) + 1 / (x * x), F: (x) => (2 / 3) * x * Math.sqrt(x) - 1 / x, a: 1, b: 4, view: [0.4, 4.5], py: 'np.sqrt(x) + 1 / x**2', pyF: '2 / 3 * x * np.sqrt(x) - 1 / x', steps: [
        ['Записываем корень и дробь степенями', R`\sqrt x=x^{1/2},\qquad \frac1{x^2}=x^{-2}`], ['Степенная формула работает и для дробных, и для отрицательных показателей', R`\int x^{1/2}dx=\frac{x^{3/2}}{3/2},\qquad \int x^{-2}dx=\frac{x^{-1}}{-1}`], ['Ответ', R`=\frac23x\sqrt x-\frac1x+C`], [CHECK, R`\left(\tfrac23x^{3/2}-x^{-1}\right)'=x^{1/2}+x^{-2}\ \checkmark`]] },
      { lvl: 2, name: '∫ (x + 1)²/x dx — сначала упростить', tex: R`\int \frac{(x+1)^2}{x}\,dx`, f: (x) => (x + 1) ** 2 / x, F: (x) => (x * x) / 2 + 2 * x + Math.log(Math.abs(x)), a: 1, b: 3, view: [0.4, 3.5], py: '(x + 1)**2 / x', pyF: 'x**2 / 2 + 2 * x + np.log(np.abs(x))', steps: [
        ['Готовой формулы для дроби нет — раскрываем квадрат', R`\frac{(x+1)^2}{x}=\frac{x^2+2x+1}{x}`], ['Делим почленно', R`=x+2+\frac1x`], ['Табличные интегралы; степень −1 — исключение: ∫dx/x = ln|x|', R`\int\left(x+2+\frac1x\right)dx=\frac{x^2}{2}+2x+\ln|x|+C`]] },
      { lvl: 2, name: '∫ e^(3x) dx — линейный аргумент', tex: R`\int e^{3x}\,dx`, f: (x) => E(3 * x), F: (x) => E(3 * x) / 3, a: 0, b: 1, view: [-0.5, 1.2], py: 'np.exp(3 * x)', pyF: 'np.exp(3 * x) / 3', steps: [
        ['Догадка: e^(3x)? Проверяем производной', R`\left(e^{3x}\right)'=3e^{3x}\quad\text{— лишняя тройка}`], ['Делим на 3', R`\int e^{3x}dx=\frac{e^{3x}}{3}+C`], ['Общее правило для линейного аргумента kx + b', R`\int f(kx+b)\,dx=\frac{F(kx+b)}{k}+C`]] },
      { lvl: 2, name: '∫ 2ˣ dx — показательная функция', tex: R`\int 2^x\,dx`, f: (x) => 2 ** x, F: (x) => 2 ** x / Math.LN2, a: 0, b: 3, view: [-0.5, 3.3], py: '2**x', pyF: '2**x / np.log(2)', steps: [
        ['Любую показательную функцию переписываем через e', R`2^x=e^{x\ln 2}`], ['Линейный аргумент с k = ln 2', R`\int e^{x\ln2}dx=\frac{e^{x\ln 2}}{\ln 2}+C`], ['Ответ', R`\int 2^xdx=\frac{2^x}{\ln 2}+C\approx 1.4427\cdot 2^x+C`]] },
      { lvl: 3, name: '∫ σ(x) dx — откуда берётся softplus', tex: R`\int \sigma(x)\,dx,\qquad \sigma(x)=\frac1{1+e^{-x}}`, f: (x) => sigma(x), F: (x) => Math.log1p(E(x)), a: -2, b: 2, view: [-4, 4], py: '1 / (1 + np.exp(-x))', pyF: 'np.log1p(np.exp(x))', steps: [
        ['Домножаем числитель и знаменатель на eˣ', R`\sigma(x)=\frac{e^x}{1+e^x}`], ['Числитель — производная знаменателя', R`(1+e^x)'=e^x`], ['Табличное ∫g′/g dx = ln|g|', R`\int\sigma(x)\,dx=\ln(1+e^x)+C`], ['Это softplus — гладкая версия max(0, x); той же формы и логистические потери', R`\operatorname{softplus}(x)=\ln(1+e^x),\qquad \ell(y, F)=\ln\!\left(1+e^{-yF}\right)`], ['На [−2, 2] ответ ровно 2: σ(x) + σ(−x) = 1', R`\ln\frac{1+e^{2}}{1+e^{-2}}=\ln e^2=2`]] },
      { lvl: 3, name: '∫ tg² x dx — тождество вместо формулы', tex: R`\int \operatorname{tg}^2x\,dx`, f: (x) => Math.tan(x) ** 2, F: (x) => Math.tan(x) - x, a: 0, b: PI / 4, view: [-0.2, 1.1], py: 'np.tan(x)**2', pyF: 'np.tan(x) - x', steps: [
        ['Табличного интеграла нет, но есть тождество', R`\operatorname{tg}^2x=\frac1{\cos^2x}-1`], ['Табличный ∫dx/cos²x = tg x', R`\int\left(\frac1{\cos^2 x}-1\right)dx=\operatorname{tg}x-x+C`], ['На [0, π/4]', R`1-\frac\pi4\approx0.2146`]] },
    ],
    subst: [
      { lvl: 1, name: '∫ 2x·e^(x²) dx', tex: R`\int 2x\,e^{x^2}\,dx`, f: (x) => 2 * x * E(x * x), F: (x) => E(x * x), a: 0, b: 1, view: [-0.3, 1.2], py: '2 * x * np.exp(x**2)', pyF: 'np.exp(x**2)', steps: [
        ['Видим «функцию от функции» e^(x²) и рядом производную внутренней 2x', R`u=x^2,\qquad du=2x\,dx`], ['Подставляем: x исчезает целиком', R`\int e^{u}\,du=e^u+C`], ['Возвращаемся к x', R`=e^{x^2}+C`]] },
      { lvl: 1, name: '∫ (3x + 1)⁵ dx', tex: R`\int (3x+1)^5\,dx`, f: (x) => (3 * x + 1) ** 5, F: (x) => (3 * x + 1) ** 6 / 18, a: 0, b: 1, view: [-0.4, 1.1], py: '(3 * x + 1)**5', pyF: '(3 * x + 1)**6 / 18', steps: [
        ['Раскрывать пятую степень долго — заменяем скобку', R`u=3x+1,\qquad du=3\,dx,\qquad dx=\frac{du}{3}`], ['Степенная формула', R`\int u^5\,\frac{du}{3}=\frac{u^6}{18}+C`], ['Ответ', R`=\frac{(3x+1)^6}{18}+C`]] },
      { lvl: 2, name: '∫ x/(1 + x²) dx', tex: R`\int \frac{x}{1+x^2}\,dx`, f: (x) => x / (1 + x * x), F: (x) => 0.5 * Math.log(1 + x * x), a: 0, b: 1, view: [-1.5, 2.5], py: 'x / (1 + x**2)', pyF: '0.5 * np.log(1 + x**2)', steps: [
        ['Знаменатель — внутренняя функция, его производная 2x почти есть в числителе', R`u=1+x^2,\qquad du=2x\,dx,\qquad x\,dx=\frac{du}2`], ['Табличный интеграл', R`\int\frac{du}{2u}=\frac12\ln|u|+C`], ['Ответ; модуль не нужен — 1 + x² > 0', R`=\frac12\ln(1+x^2)+C`]] },
      { lvl: 2, name: '∫ tg x dx', tex: R`\int \operatorname{tg}x\,dx`, f: (x) => Math.tan(x), F: (x) => -Math.log(Math.abs(Math.cos(x))), a: 0, b: PI / 3, view: [-0.3, 1.2], py: 'np.tan(x)', pyF: '-np.log(np.abs(np.cos(x)))', steps: [
        ['Тангенс — дробь', R`\operatorname{tg}x=\frac{\sin x}{\cos x}`], ['Замена знаменателя', R`u=\cos x,\qquad du=-\sin x\,dx`], ['Подставляем', R`\int\frac{-du}{u}=-\ln|u|+C=-\ln|\cos x|+C`], ['На [0, π/3]: cos(π/3) = 1/2', R`-\ln\tfrac12=\ln2\approx0.6931`]] },
      { lvl: 2, name: '∫ от 0 до √(π/2) 2x·cos(x²) dx — меняем пределы', tex: R`\int_0^{\sqrt{\pi/2}} 2x\cos(x^2)\,dx`, f: (x) => 2 * x * Math.cos(x * x), F: (x) => Math.sin(x * x), a: 0, b: Math.sqrt(PI / 2), view: [-0.1, 1.8], py: '2 * x * np.cos(x**2)', pyF: 'np.sin(x**2)', steps: [
        ['Замена', R`u=x^2,\qquad du=2x\,dx`], ['Пределы тоже переводим в u — возвращаться к x не придётся', R`x=0\Rightarrow u=0,\qquad x=\sqrt{\pi/2}\Rightarrow u=\frac\pi2`], ['Интеграл по u', R`\int_0^{\pi/2}\cos u\,du=\sin u\,\Big|_0^{\pi/2}`], ['Ответ', R`=1-0=1`]] },
      { lvl: 3, name: '∫ ln x / x dx', tex: R`\int \frac{\ln x}{x}\,dx`, f: (x) => Math.log(x) / x, F: (x) => Math.log(x) ** 2 / 2, a: 1, b: Math.E, view: [0.5, 3.2], py: 'np.log(x) / x', pyF: 'np.log(x)**2 / 2', steps: [
        ['Производная ln x — это 1/x, и она стоит рядом', R`u=\ln x,\qquad du=\frac{dx}{x}`], ['Получился интеграл от u', R`\int u\,du=\frac{u^2}{2}+C`], ['Ответ', R`=\frac{(\ln x)^2}{2}+C;\qquad \int_1^e\frac{\ln x}{x}dx=\frac12`]] },
      { lvl: 3, name: '∫₀¹ x·√(1 − x²) dx — пределы «переворачиваются»', tex: R`\int_0^{1} x\sqrt{1-x^2}\,dx`, f: (x) => x * Math.sqrt(Math.max(0, 1 - x * x)), F: (x) => -((Math.max(0, 1 - x * x)) ** 1.5) / 3, a: 0, b: 1, view: [-0.1, 1.1], py: 'x * np.sqrt(1 - x**2)', pyF: '-(1 - x**2)**1.5 / 3', steps: [
        ['Замена подкоренного выражения', R`u=1-x^2,\qquad du=-2x\,dx,\qquad x\,dx=-\frac{du}2`], ['Пределы: x = 0 → u = 1, x = 1 → u = 0', R`\int_0^1 x\sqrt{1-x^2}\,dx=-\frac12\int_1^0\sqrt u\,du`], ['Меняем направление — минус исчезает', R`=\frac12\int_0^1u^{1/2}du=\frac12\cdot\frac23`], ['Ответ', R`=\frac13`]] },
      { lvl: 3, name: '∫ eˣ/(1 + eˣ)² dx — два «разных» ответа', tex: R`\int \frac{e^x}{(1+e^x)^2}\,dx`, f: (x) => E(x) / (1 + E(x)) ** 2, F: (x) => sigma(x), a: -3, b: 3, view: [-5, 5], py: 'np.exp(x) / (1 + np.exp(x))**2', pyF: '1 / (1 + np.exp(-x))', steps: [
        ['Замена', R`u=1+e^x,\qquad du=e^x\,dx`], ['Степенная формула', R`\int\frac{du}{u^2}=-\frac1u+C=-\frac{1}{1+e^x}+C`], ['Но подынтегральная функция — это σ′(x) = σ(1 − σ), значит ответ σ(x) + C. Противоречие?', R`-\frac1{1+e^x}=\sigma(x)-1`], ['Ответы отличаются на константу −1 — оба верны: C поглощает разницу', R`\int_{-3}^{3}\sigma'(x)\,dx=\sigma(3)-\sigma(-3)\approx0.9051`]] },
    ],
    parts: [
      { lvl: 1, name: '∫ x·eˣ dx', tex: R`\int x\,e^x\,dx`, f: (x) => x * E(x), F: (x) => (x - 1) * E(x), a: 0, b: 1, view: [-1, 1.3], py: 'x * np.exp(x)', pyF: '(x - 1) * np.exp(x)', steps: [
        ['u — то, что упрощается при дифференцировании; dv — то, что легко интегрировать', R`u=x,\ \ dv=e^x dx\quad\Rightarrow\quad du=dx,\ \ v=e^x`], ['Формула uv − ∫v du', R`\int x e^x dx=x e^x-\int e^x dx`], ['Ответ', R`=(x-1)e^x+C`], [CHECK, R`\big((x-1)e^x\big)'=e^x+(x-1)e^x=xe^x\ \checkmark`]] },
      { lvl: 1, name: '∫ x·cos x dx', tex: R`\int x\cos x\,dx`, f: (x) => x * Math.cos(x), F: (x) => x * Math.sin(x) + Math.cos(x), a: 0, b: PI / 2, view: [-0.3, 3.3], py: 'x * np.cos(x)', pyF: 'x * np.sin(x) + np.cos(x)', steps: [
        ['Выбор частей', R`u=x,\ \ dv=\cos x\,dx\quad\Rightarrow\quad du=dx,\ \ v=\sin x`], ['Формула', R`=x\sin x-\int\sin x\,dx`], ['Ответ', R`=x\sin x+\cos x+C;\qquad\int_0^{\pi/2}=\frac\pi2-1\approx0.5708`]] },
      { lvl: 2, name: '∫ ln x dx — «невидимое» dv', tex: R`\int \ln x\,dx`, f: (x) => Math.log(x), F: (x) => x * Math.log(x) - x, a: 1, b: Math.E, view: [0.3, 3.2], py: 'np.log(x)', pyF: 'x * np.log(x) - x', steps: [
        ['Произведения не видно, но dv = dx', R`u=\ln x,\ \ dv=dx\quad\Rightarrow\quad du=\frac{dx}x,\ \ v=x`], ['Формула: x и 1/x сокращаются', R`=x\ln x-\int x\cdot\frac1x\,dx`], ['Ответ', R`=x\ln x-x+C;\qquad\int_1^e\ln x\,dx=1`]] },
      { lvl: 2, name: '∫₀¹ x·e^(−x) dx', tex: R`\int_0^1 x\,e^{-x}\,dx`, f: (x) => x * E(-x), F: (x) => -(x + 1) * E(-x), a: 0, b: 1, view: [-0.2, 4], py: 'x * np.exp(-x)', pyF: '-(x + 1) * np.exp(-x)', steps: [
        ['Выбор частей', R`u=x,\ \ dv=e^{-x}dx\quad\Rightarrow\quad v=-e^{-x}`], ['Формула', R`\int xe^{-x}dx=-xe^{-x}+\int e^{-x}dx=-(x+1)e^{-x}+C`], ['Подставляем пределы', R`-(2)e^{-1}-\big(-(1)e^{0}\big)=1-\frac2e\approx0.2642`], ['Тот же приём до ∞ даёт среднее экспоненциального распределения (шаг 26)', R`\int_0^\infty xe^{-x}dx=1`]] },
      { lvl: 2, name: '∫ x²·eˣ dx — по частям дважды', tex: R`\int x^2e^x\,dx`, f: (x) => x * x * E(x), F: (x) => (x * x - 2 * x + 2) * E(x), a: 0, b: 1, view: [-1.5, 1.3], py: 'x**2 * np.exp(x)', pyF: '(x**2 - 2 * x + 2) * np.exp(x)', steps: [
        ['u = x² — степень понизится', R`\int x^2e^xdx=x^2e^x-\int 2x\,e^xdx`], ['Оставшийся интеграл — первый пример', R`\int 2xe^xdx=2(x-1)e^x`], ['Собираем', R`=(x^2-2x+2)e^x+C`]] },
      { lvl: 3, name: '∫ eˣ·sin x dx — интеграл возвращается', tex: R`I=\int e^x\sin x\,dx`, f: (x) => E(x) * Math.sin(x), F: (x) => (E(x) * (Math.sin(x) - Math.cos(x))) / 2, a: 0, b: PI, view: [-0.3, 3.5], py: 'np.exp(x) * np.sin(x)', pyF: 'np.exp(x) * (np.sin(x) - np.cos(x)) / 2', steps: [
        ['По частям: u = sin x, dv = eˣdx', R`I=e^x\sin x-\int e^x\cos x\,dx`], ['Ещё раз: u = cos x, dv = eˣdx', R`\int e^x\cos x\,dx=e^x\cos x+\int e^x\sin x\,dx=e^x\cos x+I`], ['Исходный интеграл вернулся — это уравнение на I', R`I=e^x\sin x-e^x\cos x-I`], ['Решаем', R`I=\frac{e^x(\sin x-\cos x)}{2}+C;\qquad \int_0^\pi=\frac{e^\pi+1}{2}\approx12.0703`]] },
      { lvl: 3, name: '∫ arctg x dx — по частям, потом замена', tex: R`\int \operatorname{arctg}x\,dx`, f: (x) => Math.atan(x), F: (x) => x * Math.atan(x) - 0.5 * Math.log(1 + x * x), a: 0, b: 1, view: [-2, 2], py: 'np.arctan(x)', pyF: 'x * np.arctan(x) - 0.5 * np.log(1 + x**2)', steps: [
        ['dv = dx, u = arctg x (её производная — дробь)', R`du=\frac{dx}{1+x^2},\qquad v=x`], ['Формула', R`=x\operatorname{arctg}x-\int\frac{x}{1+x^2}dx`], ['Остаток — замена u = 1 + x² (шаг 15)', R`\int\frac{x\,dx}{1+x^2}=\frac12\ln(1+x^2)`], ['Ответ', R`=x\operatorname{arctg}x-\frac12\ln(1+x^2)+C;\qquad\int_0^1=\frac\pi4-\frac{\ln2}{2}\approx0.4388`]] },
    ],
    frac: [
      { lvl: 1, name: '∫ dx/(x − 2)', tex: R`\int \frac{dx}{x-2}`, f: (x) => 1 / (x - 2), F: (x) => Math.log(Math.abs(x - 2)), a: 3, b: 5, view: [2.3, 6], py: '1 / (x - 2)', pyF: 'np.log(np.abs(x - 2))', steps: [
        ['Линейная замена u = x − 2, du = dx', R`\int\frac{du}{u}=\ln|u|+C`], ['Ответ', R`=\ln|x-2|+C;\qquad\int_3^5=\ln3\approx1.0986`]] },
      { lvl: 2, name: '∫ dx/(x(x + 1)) — простейшие дроби', tex: R`\int \frac{dx}{x(x+1)}`, f: (x) => 1 / (x * (x + 1)), F: (x) => Math.log(Math.abs(x / (x + 1))), a: 1, b: 2, view: [0.3, 3], py: '1 / (x * (x + 1))', pyF: 'np.log(np.abs(x / (x + 1)))', steps: [
        ['Ищем разложение', R`\frac1{x(x+1)}=\frac Ax+\frac B{x+1}`], ['Домножаем на x(x + 1) и подставляем корни знаменателя', R`1=A(x+1)+Bx:\quad x=0\Rightarrow A=1,\quad x=-1\Rightarrow B=-1`], ['Интегрируем по отдельности', R`\int\left(\frac1x-\frac1{x+1}\right)dx=\ln|x|-\ln|x+1|`], ['Ответ', R`=\ln\left|\frac{x}{x+1}\right|+C;\qquad\int_1^2=\ln\frac43\approx0.2877`]] },
      { lvl: 2, name: '∫ dx/(x² − 1)', tex: R`\int \frac{dx}{x^2-1}`, f: (x) => 1 / (x * x - 1), F: (x) => 0.5 * Math.log(Math.abs((x - 1) / (x + 1))), a: 2, b: 3, view: [1.3, 4], py: '1 / (x**2 - 1)', pyF: '0.5 * np.log(np.abs((x - 1) / (x + 1)))', steps: [
        ['Разность квадратов', R`x^2-1=(x-1)(x+1)`], ['Разложение (проверьте приведением к общему знаменателю)', R`\frac1{x^2-1}=\frac12\left(\frac1{x-1}-\frac1{x+1}\right)`], ['Ответ', R`=\frac12\ln\left|\frac{x-1}{x+1}\right|+C`]] },
      { lvl: 2, name: '∫ (2x + 3)/(x² + 3x + 2) dx — числитель-производная', tex: R`\int \frac{2x+3}{x^2+3x+2}\,dx`, f: (x) => (2 * x + 3) / (x * x + 3 * x + 2), F: (x) => Math.log(Math.abs(x * x + 3 * x + 2)), a: 0, b: 1, view: [-0.5, 2], py: '(2 * x + 3) / (x**2 + 3 * x + 2)', pyF: 'np.log(np.abs(x**2 + 3 * x + 2))', steps: [
        ['Прежде чем раскладывать — проверим числитель', R`(x^2+3x+2)'=2x+3`], ['Это ∫g′/g', R`=\ln|x^2+3x+2|+C`], ['На [0, 1]', R`\ln6-\ln2=\ln3\approx1.0986`]] },
      { lvl: 2, name: '∫ dx/(x² + 4) — арктангенс', tex: R`\int \frac{dx}{x^2+4}`, f: (x) => 1 / (x * x + 4), F: (x) => 0.5 * Math.atan(x / 2), a: 0, b: 2, view: [-3, 3], py: '1 / (x**2 + 4)', pyF: '0.5 * np.arctan(x / 2)', steps: [
        ['Корней у знаменателя нет; приводим к табличному ∫dt/(1 + t²) = arctg t', R`\frac1{x^2+4}=\frac14\cdot\frac1{1+(x/2)^2}`], ['Замена t = x/2, dx = 2dt', R`\frac14\int\frac{2\,dt}{1+t^2}=\frac12\operatorname{arctg}t`], ['Ответ', R`=\frac12\operatorname{arctg}\frac x2+C;\qquad\int_0^2=\frac\pi8\approx0.3927`]] },
      { lvl: 3, name: '∫ dy/(y(1 − y)) — логит и сигмоида', tex: R`\int \frac{dy}{y(1-y)},\qquad 0<y<1`, f: (y) => 1 / (y * (1 - y)), F: (y) => Math.log(y / (1 - y)), a: 0.2, b: 0.8, view: [0.05, 0.95], py: '1 / (x * (1 - x))', pyF: 'np.log(x / (1 - x))', steps: [
        ['Простейшие дроби: 1 = A(1 − y) + By ⇒ A = B = 1', R`\frac1{y(1-y)}=\frac1y+\frac1{1-y}`], ['Интегрируем', R`\ln y-\ln(1-y)+C`], ['Это логит — функция, обратная сигмоиде', R`=\ln\frac{y}{1-y}+C=\operatorname{logit}(y)+C`], ['Отсюда решение логистического уравнения y′ = y(1 − y) (урок 15.11)', R`\ln\frac{y}{1-y}=t+C\ \Rightarrow\ y=\sigma(t+C)`]] },
      { lvl: 3, name: '∫ e^(−x²) dx — интеграл, который «не берётся»', tex: R`\int e^{-x^2}\,dx`, f: (x) => E(-x * x), F: (x) => (Math.sqrt(PI) / 2) * erf(x), a: 0, b: 1, view: [-2.5, 2.5], py: 'np.exp(-x**2)', pyF: 'np.sqrt(np.pi) / 2 * scipy.special.erf(x)', steps: [
        ['Замена? u = x² требует множителя x — его нет. По частям? Степень не понижается', ''], ['Первообразная существует (непрерывная функция, шаг 11), но через элементарные функции не выражается (теорема Лиувилля)', ''], ['Её вводят как новую функцию — функцию ошибок', R`\operatorname{erf}(x)=\frac2{\sqrt\pi}\int_0^xe^{-t^2}dt`], ['Ответ и способ счёта — численно (шаг 18)', R`\int e^{-x^2}dx=\frac{\sqrt\pi}{2}\operatorname{erf}(x)+C;\quad \int_0^1e^{-x^2}dx\approx0.746824`]] },
    ],
  };
  GBC.widget('integral-solver', (el, cfg) => {
    const set = SOLVER[cfg.set] || SOLVER.table;
    const s = { i: 0, k: set[0].steps.length };
    const w = ui.shell(el, { title: 'Решатель по шагам', sub: 'Выберите пример (★ — простой, ★★★ — с подвохом). Нажимайте «шаг вперёд» или ▶: каждое преобразование появляется с пояснением. Внизу ответ проверяется: площадь, сосчитанная численно, совпадает с F(b) − F(a).' });
    ui.select(w.controls, { label: 'Пример', value: '0', options: set.map((X, i) => ({ value: String(i), label: STARS[X.lvl] + ' ' + X.name })), onChange: (v) => {
      s.i = +v;
      player.setMax(set[s.i].steps.length);
      player.set(1);
      s.k = 1;
      draw();
    } });
    const player = ui.player(w.controls, { label: 'Шаг решения', min: 0, max: set[0].steps.length, value: s.k, fps: 0.8, format: (k, m) => 'шаг ' + k + ' из ' + m, onChange: (k) => ((s.k = k), draw()) });
    const prob = card('Задача');
    w.main.appendChild(prob.el);
    const probTex = H('div');
    prob.body.appendChild(probTex);
    const list = H('ol', { style: 'margin:8px 0 0;padding-left:1.4em;display:grid;gap:6px' });
    prob.body.appendChild(list);
    const plot = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: 'f(x)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'ab', label: 'проверка на отрезке' }, { key: 'N', label: 'площадь численно' }, { key: 'F', label: 'F(b) − F(a)' }, { key: 'd', label: 'F′(x₀) и f(x₀)' }]);
    function draw() {
      const X = set[s.i];
      texInto(probTex, X.tex, true);
      stepList(list, X.steps, s.k);
      const c = curve(X.f, X.view[0], X.view[1], 500);
      const ys = c.y.filter((v) => Number.isFinite(v));
      const sorted = ys.slice().sort((p, q) => p - q);
      const lo = sorted[Math.floor(sorted.length * 0.02)];
      const hi = sorted[Math.floor(sorted.length * 0.98)];
      plot.render([
        ...signedArea(X.f, X.a, X.b, { n: 400 }),
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: c.x, y: c.y, color: 'ink', width: 2.2, hover: false },
        { type: 'vline', x: X.a, color: 'tree', width: 1.2, dash: '3 3', text: 'a' },
        { type: 'vline', x: X.b, color: 'tree', width: 1.2, dash: '3 3', text: 'b' },
      ], { x: X.view, y: yDom([lo, hi, 0], 0.12) });
      const N = simpson(X.f, X.a, X.b, 4000);
      const D = X.F(X.b) - X.F(X.a);
      const x0 = X.a + 0.37 * (X.b - X.a);
      const hd = 1e-5;
      const dF = (X.F(x0 + hd) - X.F(x0 - hd)) / (2 * hd);
      st.set('ab', '[' + f3(X.a) + ', ' + f3(X.b) + ']');
      st.set('N', f6(N));
      st.set('F', f6(D));
      st.set('d', f4(dF) + ' и ' + f4(X.f(x0)));
      const fin = s.k >= X.steps.length;
      note.innerHTML = fin ? 'Готово. Две независимые проверки: численная площадь ' + f6(N) + ' совпадает с F(b) − F(a) = ' + f6(D) + ', а численная производная ответа в точке x₀ = ' + f3(x0) + ' равна подынтегральной функции. Неопределённый интеграл всегда можно проверить дифференцированием.' : s.k === 0 ? 'Нажмите «шаг вперёд». Сначала попробуйте сами: какое правило подходит?' : 'Шаг ' + s.k + ' из ' + X.steps.length + '. Догадайтесь, каким будет следующее преобразование.';
    }
    w.pythonAction(() => {
      const X = set[s.i];
      const sci = X.pyF.includes('scipy') ? 'import scipy.special\n' : '';
      return 'import numpy as np\n' + sci + '\nf = lambda x: ' + X.py + '\nF = lambda x: ' + X.pyF + '     # найденная первообразная\na, b = ' + py(X.a) + ', ' + py(X.b) + '\nx = np.linspace(a, b, 200001)\ny = f(x)\nprint("площадь численно:", np.sum((y[1:] + y[:-1]) / 2) * (x[1] - x[0]))\nprint("F(b) − F(a)     :", F(b) - F(a))\nx0, h = a + 0.37 * (b - a), 1e-6\nprint("F′(x0) =", (F(x0 + h) - F(x0 - h)) / (2 * h), " f(x0) =", f(x0))\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 15. Замена переменной — перенос площади с оси x на ось u
   * ============================================================================== */
  const SUB = {
    cos: { label: '∫ 2x·cos(x²) dx, u = x²', fx: (x) => 2 * x * Math.cos(x * x), g: (x) => x * x, fu: Math.cos, a: 0, b: 1.25, range: [0, 2.2], ut: 'cos u', gt: 'x²' },
    exp: { label: '∫ 2x·e^(x²) dx, u = x²', fx: (x) => 2 * x * E(x * x), g: (x) => x * x, fu: E, a: 0, b: 1, range: [0, 1.3], ut: 'eᵘ', gt: 'x²' },
    frac: { label: '∫ x/(1 + x²) dx, u = 1 + x²', fx: (x) => x / (1 + x * x), g: (x) => 1 + x * x, fu: (u) => 0.5 / u, a: 0, b: 2, range: [0, 3], ut: '1/(2u)', gt: '1 + x²' },
    sig: { label: '∫ σ′(x) dx, u = σ(x)', fx: (x) => sigma(x) * (1 - sigma(x)), g: sigma, fu: () => 1, a: -2, b: 2, range: [-5, 5], ut: '1', gt: 'σ(x)' },
  };
  GBC.widget('substitution', (el) => {
    const s = { k: 'cos', a: 0, b: 1.25, K: 6 };
    const w = ui.shell(el, { title: 'Замена переменной: та же площадь на другой оси', sub: 'Сверху — интеграл по x, снизу — тот же интеграл по u = g(x). Отрезок [a, b] разрезан на полоски; каждая полоска сверху переходит в полоску того же цвета снизу — с той же площадью. Ширина меняется в g′(x) раз, а высота — обратно.', stack: true });
    ui.select(w.controls, { label: 'Интеграл и замена', value: s.k, options: Object.entries(SUB).map(([k, Q]) => ({ value: k, label: Q.label })), onChange: (v) => {
      s.k = v;
      s.a = SUB[v].a;
      s.b = SUB[v].b;
      mk();
      draw();
    } });
    ui.segmented(w.controls, { label: 'Полосок', value: s.K, options: [{ value: 3, label: '3' }, { value: 6, label: '6' }, { value: 12, label: '12' }], onChange: (v) => ((s.K = v), draw()) });
    const box = H('div', { style: 'display:contents' });
    w.controls.appendChild(box);
    function mk() {
      box.textContent = '';
      const Q = SUB[s.k];
      const step = (Q.range[1] - Q.range[0]) / 40;
      ui.slider(box, { label: 'Нижний предел a', min: Q.range[0], max: Q.range[1], step, value: s.a, onInput: (v) => ((s.a = v), draw()) });
      ui.slider(box, { label: 'Верхний предел b', min: Q.range[0], max: Q.range[1], step, value: s.b, onInput: (v) => ((s.b = v), draw()) });
    }
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'x' }, y: { label: 'f(g(x))·g′(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'u = g(x)' }, y: { label: 'f(u)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'x', label: 'площадь по x' }, { key: 'u', label: 'площадь по u' }, { key: 'lim', label: 'новые пределы' }]);
    function draw() {
      const Q = SUB[s.k];
      const a = Math.min(s.a, s.b);
      const b = Math.max(s.a, s.b);
      const cols = ['model', 'aqua'];
      const L1 = [];
      const L2 = [];
      const edges = U.linspace(a, b, s.K + 1);
      for (let i = 0; i < s.K; i++) {
        const xs = U.linspace(edges[i], edges[i + 1], 40);
        L1.push({ type: 'area', x: xs, y0: xs.map(() => 0), y1: xs.map(Q.fx), color: cols[i % 2], opacity: 0.4 });
        const us = U.linspace(Q.g(edges[i]), Q.g(edges[i + 1]), 40);
        L2.push({ type: 'area', x: us, y0: us.map(() => 0), y1: us.map(Q.fu), color: cols[i % 2], opacity: 0.4 });
      }
      const c1 = curve(Q.fx, Q.range[0], Q.range[1], 400);
      const u0 = Q.g(Q.range[0]);
      const u1 = Q.g(Q.range[1]);
      const c2 = curve(Q.fu, Math.min(u0, u1), Math.max(u0, u1), 400);
      p1.render([...L1, { type: 'hline', y: 0, color: 'axis' }, { type: 'line', x: c1.x, y: c1.y, color: 'ink', width: 2.2, hover: false }], { x: Q.range, y: yDom(c1.y, 0.08, [0]) });
      p2.render([...L2, { type: 'hline', y: 0, color: 'axis' }, { type: 'line', x: c2.x, y: c2.y, color: 'ink', width: 2.2, hover: false }], { x: [Math.min(u0, u1), Math.max(u0, u1)], y: yDom(c2.y, 0.08, [0]) });
      const Ix = simpson(Q.fx, a, b, 2000);
      const Iu = simpson(Q.fu, Q.g(a), Q.g(b), 2000);
      st.set('x', f6(Ix));
      st.set('u', f6(Iu));
      st.set('lim', '[' + f3(a) + ', ' + f3(b) + '] → [' + f3(Q.g(a)) + ', ' + f3(Q.g(b)) + ']');
      note.innerHTML = 'Площади совпадают: ' + f6(Ix) + ' = ' + f6(Iu) + '. Замена u = ' + Q.gt + ' растягивает ось: полоска шириной dx становится полоской шириной du = g′(x)·dx, и множитель g′(x) в подынтегральной функции ровно компенсирует растяжение. ' + (s.k === 'sig' ? 'Здесь f(u) = 1: площадь под «колоколом» σ′ от a до b равна длине отрезка [σ(a), σ(b)] — то есть σ(b) − σ(a).' : s.k === 'cos' ? 'Снизу видно, почему ответ sin(b²) − sin(a²): это площадь под косинусом по оси u.' : 'Пределы интегрирования переходят вместе с переменной: u от g(a) до g(b).');
    }
    w.pythonAction(() => 'import numpy as np\n\ndef integral(f, a, b, n=200000):\n    h = (b - a) / n\n    return np.sum(f(a + (np.arange(n) + 0.5) * h)) * h\n\na, b = ' + py(Math.min(s.a, s.b)) + ', ' + py(Math.max(s.a, s.b)) + '\n# ∫ 2x cos(x²) dx по x и тот же интеграл по u = x²\nprint(integral(lambda x: 2 * x * np.cos(x**2), a, b))\nprint(integral(np.cos, a**2, b**2), "=", np.sin(b**2) - np.sin(a**2))\n');
    mk();
    draw();
  });

  /* ==============================================================================
   * Шаг 16. Интегрирование по частям: две площади складываются в прямоугольник
   * ============================================================================== */
  const PG = {
    exp: { label: 'v = eᵘ   (∫ x·eˣ dx)', phi: E, dphi: E, range: [0, 1.6], u1: 0, u2: 1, ex: '∫ u dv = ∫ u·eᵘ du — это ∫ x·eˣ dx' },
    sq: { label: 'v = u²   (∫ u·2u du)', phi: (u) => u * u, dphi: (u) => 2 * u, range: [0, 2], u1: 0.5, u2: 1.5, ex: '∫ u dv = ∫ u·2u du = 2u³/3, а ∫ v du = u³/3' },
    sin: { label: 'v = sin u   (∫ u·cos u du)', phi: Math.sin, dphi: Math.cos, range: [0, PI / 2], u1: 0, u2: 1.2, ex: '∫ u dv = ∫ u·cos u du — это ∫ x cos x dx' },
  };
  GBC.widget('parts-geometry', (el) => {
    const s = { k: 'exp', u1: 0, u2: 1 };
    const w = ui.shell(el, { title: 'По частям — это сложение двух площадей', sub: 'Кривая v = φ(u) идёт от точки (u₁, v₁) до (u₂, v₂). Синяя площадь — ∫ v du (под кривой), оранжевая — ∫ u dv (слева от кривой). Вместе они дают большой прямоугольник u₂v₂ без маленького u₁v₁. Отсюда ∫u dv = uv − ∫v du.' });
    ui.select(w.controls, { label: 'Кривая', value: s.k, options: Object.entries(PG).map(([k, P]) => ({ value: k, label: P.label })), onChange: (v) => {
      s.k = v;
      s.u1 = PG[v].u1;
      s.u2 = PG[v].u2;
      mk();
      draw();
    } });
    const box = H('div', { style: 'display:flex;flex-direction:column;gap:14px' });
    w.controls.appendChild(box);
    function mk() {
      box.textContent = '';
      const P = PG[s.k];
      const step = (P.range[1] - P.range[0]) / 40;
      ui.slider(box, { label: 'Начало u₁', min: P.range[0], max: P.range[1], step, value: s.u1, onInput: (v) => ((s.u1 = v), draw()) });
      ui.slider(box, { label: 'Конец u₂', min: P.range[0], max: P.range[1], step, value: s.u2, onInput: (v) => ((s.u2 = v), draw()) });
    }
    const plot = new GBC.Plot(w.main, { height: 330, equal: true, x: { label: 'u' }, y: { label: 'v' } });
    const cF = card('Проверка числами');
    w.main.appendChild(cF.el);
    const note = w.note('', true);
    function draw() {
      const P = PG[s.k];
      const u1 = Math.min(s.u1, s.u2);
      const u2 = Math.max(s.u1, s.u2);
      const v1 = P.phi(u1);
      const v2 = P.phi(u2);
      const xa = U.linspace(u1, u2, 200);
      const xb = U.linspace(0, u2, 300);
      const c = curve(P.phi, P.range[0], P.range[1], 300);
      plot.render([
        { type: 'area', x: xa, y0: xa.map(() => 0), y1: xa.map(P.phi), color: 'model', opacity: 0.35, label: '∫ v du' },
        { type: 'area', x: xb, y0: xb.map((u) => Math.min(v2, Math.max(v1, P.phi(u)))), y1: xb.map(() => v2), color: 'tree', opacity: 0.35, label: '∫ u dv' },
        { type: 'rect', x0: 0, x1: u1, y0: 0, y1: v1, fill: 'muted', stroke: 'muted', opacity: 0.12, width: 1, dash: '4 3' },
        { type: 'rect', x0: 0, x1: u2, y0: 0, y1: v2, stroke: 'ink2', opacity: 0, width: 1.2, dash: '5 4' },
        { type: 'line', x: c.x, y: c.y, color: 'ink', width: 2.4, hover: false },
        { type: 'points', x: [u1, u2], y: [v1, v2], color: 'ink', r: 5 },
        { type: 'text', x: u2, y: v2, text: '(u₂, v₂)', dx: 6, dy: -6 },
      ], { x: [0, P.range[1] * 1.05], y: [0, P.phi(P.range[1]) * 1.05] });
      const Ivdu = simpson(P.phi, u1, u2, 1000);
      const Iudv = simpson((u) => u * P.dphi(u), u1, u2, 1000);
      cF.body.innerHTML = '∫ v du = ' + f4(Ivdu) + ',  ∫ u dv = ' + f4(Iudv) + '.<br>Сумма ' + f4(Ivdu + Iudv) + ' = u₂v₂ − u₁v₁ = ' + f3(u2) + '·' + f3(v2) + ' − ' + f3(u1) + '·' + f3(v1) + ' = <b>' + f4(u2 * v2 - u1 * v1) + '</b>.';
      note.innerHTML = 'Формула интегрирования по частям ∫u dv = uv − ∫v du — просто «большой прямоугольник минус маленький минус синяя площадь». ' + P.ex + '. Удобно, когда ∫ v du считать проще, чем ∫ u dv. Алгебраически это обращённое правило произведения: (uv)′ = u′v + uv′.';
    }
    w.pythonAction(() => 'import numpy as np\n\nu = np.linspace(' + py(Math.min(s.u1, s.u2)) + ', ' + py(Math.max(s.u1, s.u2)) + ', 200001)\nv = np.exp(u)                                  # кривая v = e^u\ndu = u[1] - u[0]\nI_vdu = np.sum((v[1:] + v[:-1]) / 2) * du       # ∫ v du\nI_udv = np.sum((u[1:] + u[:-1]) / 2 * np.diff(v)) # ∫ u dv\nprint(I_vdu + I_udv, "=", u[-1] * v[-1] - u[0] * v[0])\n');
    mk();
    draw();
  });

  /* ==============================================================================
   * Шаг 18. Численное интегрирование: прямоугольники, трапеции, Симпсон
   * ============================================================================== */
  const NM = {
    exp: { label: 'eˣ на [0, 1]', f: E, a: 0, b: 1, exact: Math.E - 1, py: 'np.exp(x)' },
    sin: { label: 'sin x на [0, π]', f: Math.sin, a: 0, b: PI, exact: 2, py: 'np.sin(x)' },
    atan: { label: '1/(1 + x²) на [0, 1] (= π/4)', f: (x) => 1 / (1 + x * x), a: 0, b: 1, exact: PI / 4, py: '1 / (1 + x**2)' },
    gauss: { label: 'e^(−x²) на [0, 2]', f: (x) => E(-x * x), a: 0, b: 2, exact: (Math.sqrt(PI) / 2) * erf(2), py: 'np.exp(-x**2)' },
    sqrt: { label: '√x на [0, 1] — излом в нуле', f: Math.sqrt, a: 0, b: 1, exact: 2 / 3, py: 'np.sqrt(x)' },
  };
  const METH = {
    mid: (f, a, b, n) => rsum(f, a, b, n, 0.5),
    trap: (f, a, b, n) => trap(f, a, b, n),
    simp: (f, a, b, n) => simpson(f, a, b, n),
  };
  /** Парабола через три точки (Лагранж). */
  const parab = (x0, y0, x1, y1, x2, y2) => (x) => (y0 * (x - x1) * (x - x2)) / ((x0 - x1) * (x0 - x2)) + (y1 * (x - x0) * (x - x2)) / ((x1 - x0) * (x1 - x2)) + (y2 * (x - x0) * (x - x1)) / ((x2 - x0) * (x2 - x1));
  GBC.widget('numeric-methods', (el) => {
    const s = { fn: 'exp', m: 'trap', n: 4 };
    const w = ui.shell(el, { title: 'Три численных метода', sub: 'Середина — прямоугольники высотой в середине части; трапеции — кривая заменяется отрезками; Симпсон — кусочками парабол через каждые три соседних узла. Снизу — ошибка всех трёх методов при разном n (обе оси логарифмические).', stack: true });
    ui.select(w.controls, { label: 'Интеграл', value: s.fn, options: Object.entries(NM).map(([k, M]) => ({ value: k, label: M.label })), onChange: (v) => ((s.fn = v), draw()) });
    ui.segmented(w.controls, { label: 'Показать метод', value: s.m, options: [{ value: 'mid', label: 'середина' }, { value: 'trap', label: 'трапеции' }, { value: 'simp', label: 'Симпсон' }], onChange: (v) => ((s.m = v), draw()) });
    ui.slider(w.controls, { label: 'Число частей n', values: [2, 4, 6, 8, 12, 16, 32, 64], value: s.n, format: String, onInput: (v) => ((s.n = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'f(x)' } });
    const ns = [2, 4, 8, 16, 32, 64, 128];
    const p2 = new GBC.Plot(w.main, { height: 240, x: { label: 'n (лог.)', type: 'log', domain: [1.6, 160], ticks: ns }, y: { label: 'ошибка (лог.)', type: 'log', domain: [1e-14, 1], ticks: decades(-14, 0, 2), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'mid', label: 'середина' }, { key: 'trap', label: 'трапеции' }, { key: 'simp', label: 'Симпсон' }]);
    function draw() {
      const M = NM[s.fn];
      const n = s.n;
      const h = (M.b - M.a) / n;
      const L = [];
      if (s.m === 'mid') {
        for (let i = 0; i < n; i++) {
          const x0 = M.a + i * h;
          L.push({ type: 'rect', x0, x1: x0 + h, y0: 0, y1: M.f(x0 + h / 2), fill: 'model', stroke: 'model', opacity: 0.28, width: 1 });
        }
        L.push({ type: 'points', x: U.range(n).map((i) => M.a + (i + 0.5) * h), y: U.range(n).map((i) => M.f(M.a + (i + 0.5) * h)), color: 'model', r: n > 16 ? 2.5 : 4 });
      } else if (s.m === 'trap') {
        const xs = U.linspace(M.a, M.b, n + 1);
        L.push({ type: 'area', x: xs, y0: xs.map(() => 0), y1: xs.map(M.f), color: 'model', opacity: 0.28 });
        L.push({ type: 'segments', x1: xs, y1: xs.map(() => 0), x2: xs, y2: xs.map(M.f), color: 'model', width: 1, opacity: 0.8 });
        L.push({ type: 'line', x: xs, y: xs.map(M.f), color: 'model', width: 1.6, hover: false });
        L.push({ type: 'points', x: xs, y: xs.map(M.f), color: 'model', r: n > 16 ? 2.5 : 4 });
      } else {
        for (let i = 0; i < n; i += 2) {
          const x0 = M.a + i * h;
          const P = parab(x0, M.f(x0), x0 + h, M.f(x0 + h), x0 + 2 * h, M.f(x0 + 2 * h));
          const xs = U.linspace(x0, x0 + 2 * h, 40);
          L.push({ type: 'area', x: xs, y0: xs.map(() => 0), y1: xs.map(P), color: i % 4 ? 'aqua' : 'model', opacity: 0.3 });
          L.push({ type: 'line', x: xs, y: xs.map(P), color: 'model', width: 1.6, dash: '4 3', hover: false });
        }
        const xs = U.linspace(M.a, M.b, n + 1);
        L.push({ type: 'points', x: xs, y: xs.map(M.f), color: 'model', r: n > 16 ? 2.5 : 4 });
      }
      const c = curve(M.f, M.a, M.b, 400);
      p1.render([...L, { type: 'line', x: c.x, y: c.y, color: 'tree', width: 2.4, hover: false }, { type: 'hline', y: 0, color: 'axis' }], { x: [M.a, M.b], y: yDom(c.y, 0.08, [0]) });
      const err = (m) => ns.map((k) => Math.max(Math.abs(METH[m](M.f, M.a, M.b, k) - M.exact), 1e-16));
      p2.render([
        { type: 'line', x: ns, y: err('mid'), color: 'aqua', width: 2.2, label: 'середина' },
        { type: 'line', x: ns, y: err('trap'), color: 'model', width: 2.2, label: 'трапеции' },
        { type: 'line', x: ns, y: err('simp'), color: 'violet', width: 2.2, label: 'Симпсон' },
        { type: 'vline', x: n, color: 'ink2', dash: '3 3', width: 1 },
      ]);
      const cell = (m) => {
        const v = METH[m](M.f, M.a, M.b, n);
        return f6(v) + ' (ошибка ' + sci(v - M.exact) + ')';
      };
      st.set('mid', cell('mid'));
      st.set('trap', cell('trap'));
      st.set('simp', cell('simp'));
      const em = METH.mid(M.f, M.a, M.b, n) - M.exact;
      const et = METH.trap(M.f, M.a, M.b, n) - M.exact;
      note.innerHTML = 'Точно: ' + f6(M.exact) + '. Ошибка середины ' + sci(em) + ', трапеций ' + sci(et) + ' — ' + (Math.abs(em) > 1e-14 && em * et < 0 ? 'противоположных знаков, и середина примерно вдвое точнее. Поэтому их взвешенное среднее (2·середина + трапеции)/3 почти без ошибки — это и есть метод Симпсона. ' : 'сравните знаки и величины. ') + (s.fn === 'sqrt' ? 'У √x в нуле бесконечный наклон — все методы теряют скорость: Симпсон уже не лучше трапеций в разы (шаг 19).' : 'Симпсон точен для многочленов до третьей степени и на гладких функциях выигрывает тысячи раз.');
    }
    w.pythonAction(() => {
      const M = NM[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + M.py + '\na, b = ' + py(M.a) + ', ' + py(M.b) + '\nexact = ' + py(M.exact) + '\nfor n in [2, 4, 8, 16, 32]:\n    x = np.linspace(a, b, n + 1); y = f(x); h = (b - a) / n\n    mid = np.sum(f(x[:-1] + h / 2)) * h\n    trap = h * (y.sum() - (y[0] + y[-1]) / 2)\n    simp = h / 3 * (y[0] + y[-1] + 4 * y[1:-1:2].sum() + 2 * y[2:-1:2].sum())\n    print(f"n = {n:2d}: середина {mid - exact:+.2e}, трапеции {trap - exact:+.2e}, Симпсон {simp - exact:+.2e}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 19. Порядок точности и правило Рунге
   * ============================================================================== */
  const EO = {
    exp: { label: 'eˣ на [0, 1] — гладкая', f: E, a: 0, b: 1, exact: Math.E - 1 },
    runge: { label: '1/(1 + 25x²) на [−1, 1] — крутая', f: (x) => 1 / (1 + 25 * x * x), a: -1, b: 1, exact: 0.4 * Math.atan(5) },
    sqrt: { label: '√x на [0, 1] — бесконечный наклон', f: Math.sqrt, a: 0, b: 1, exact: 2 / 3 },
    kink: { label: '|x − 1/3| на [0, 1] — излом между узлами', f: (x) => Math.abs(x - 1 / 3), a: 0, b: 1, exact: 5 / 18 },
    per: { label: 'e^(sin x) на [0, 2π] — периодическая', f: (x) => E(Math.sin(x)), a: 0, b: 2 * PI, exact: 7.954926521012845 },
  };
  const EN = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
  GBC.widget('error-order', (el) => {
    const s = { fn: 'exp' };
    const w = ui.shell(el, { title: 'Порядок точности: во сколько раз падает ошибка', sub: 'Удваиваем n и смотрим, во сколько раз уменьшилась ошибка. Отношение 4 — второй порядок (ошибка ~ 1/n²), 16 — четвёртый (~ 1/n⁴). Пунктир — эталонные наклоны. Оценка Рунге (T₂ₙ − Tₙ)/3 предсказывает ошибку трапеций без точного ответа.', stack: true });
    ui.select(w.controls, { label: 'Интеграл', value: s.fn, options: Object.entries(EO).map(([k, M]) => ({ value: k, label: M.label })), onChange: (v) => ((s.fn = v), draw()) });
    const plot = new GBC.Plot(w.main, { height: 270, x: { label: 'n (лог.)', type: 'log', domain: [1.6, 1300], ticks: [2, 8, 32, 128, 512], format: String }, y: { label: 'ошибка (лог.)', type: 'log', domain: [1e-16, 1], ticks: decades(-16, 0, 2), format: powFmt } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    function draw() {
      const M = EO[s.fn];
      const T = EN.map((n) => trap(M.f, M.a, M.b, n));
      const Sv = EN.map((n) => simpson(M.f, M.a, M.b, n));
      const Mv = EN.map((n) => rsum(M.f, M.a, M.b, n, 0.5));
      const fl = (v) => Math.max(Math.abs(v), 1e-16);
      const eT = T.map((v) => fl(v - M.exact));
      const eS = Sv.map((v) => fl(v - M.exact));
      const eM = Mv.map((v) => fl(v - M.exact));
      const ref2 = EN.map((n) => 6 * eT[0] * (EN[0] / n) ** 2);
      const ref4 = EN.map((n) => 6 * eS[0] * (EN[0] / n) ** 4);
      plot.render([
        { type: 'line', x: EN, y: ref2.map((v) => (v > 1e-17 ? v : NaN)), color: 'muted', width: 1.2, dash: '5 4', label: '~ 1/n²', hover: false },
        { type: 'line', x: EN, y: ref4.map((v) => (v > 1e-17 ? v : NaN)), color: 'muted', width: 1.2, dash: '2 3', label: '~ 1/n⁴', hover: false },
        { type: 'line', x: EN, y: eM, color: 'aqua', width: 2.2, label: 'середина' },
        { type: 'line', x: EN, y: eT, color: 'model', width: 2.2, label: 'трапеции' },
        { type: 'line', x: EN, y: eS, color: 'violet', width: 2.2, label: 'Симпсон' },
      ]);
      const ord = (e, i) => (i === 0 || e[i] <= 1e-15 || e[i - 1] <= 1e-15 ? '—' : U.fmt(Math.log2(e[i - 1] / e[i]), 2));
      rowTable(tbl, ['n', 'ошибка трапеций', 'порядок p', 'оценка Рунге', 'ошибка Симпсона', 'порядок p'], EN.slice(0, 8).map((n, i) => [
        String(n), sci(T[i] - M.exact), ord(eT, i), i === 0 ? '—' : sci((T[i] - T[i - 1]) / 3), sci(Sv[i] - M.exact), ord(eS, i),
      ]));
      const msg = {
        exp: 'Гладкая функция: порядок трапеций ровно 2, Симпсона — 4. Оценка Рунге (T₂ₙ − Tₙ)/3 совпадает с настоящей ошибкой трапеций почти во всех знаках (со знаком «−»: она оценивает поправку). А (4T₂ₙ − Tₙ)/3 — это уже формула Симпсона: экстраполяция Ричардсона.',
        runge: 'Функция гладкая, но крутая: пока шаг больше ширины «горба», ошибка ведёт себя беспорядочно. Асимптотический порядок (2 и 4) наступает только при достаточно больших n.',
        sqrt: 'У √x в нуле бесконечная производная: формулы ошибки, где стоят f″ и f⁽⁴⁾, не работают. Порядок всех методов падает до 1.5 — Симпсон больше не выигрывает. Лечится заменой x = t² (интеграл становится гладким) или неравномерной сеткой.',
        kink: 'Излом между узлами сетки: на гладких кусках всё хорошо, но часть, содержащая излом, даёт ошибку ~ h² независимо от метода, причём неравномерную — порядок «скачет». Узел в точке излома вернул бы методам их порядок.',
        per: 'Для гладкой периодической функции на целом периоде трапеции сходятся быстрее любой степени: ошибка падает до машинной точности уже к n = 16. Симпсон здесь хуже трапеций! Именно поэтому периодические интегралы считают трапециями.',
      }[s.fn];
      note.innerHTML = msg + ' Теория: ошибка трапеций ≈ −(b − a)h²·f″/12, середины ≈ +(b − a)h²·f″/24, Симпсона ≈ −(b − a)h⁴·f⁽⁴⁾/180 (f″ и f⁽⁴⁾ — в некоторой средней точке).';
    }
    w.pythonAction(() => 'import numpy as np\n\nf, a, b, exact = np.exp, 0.0, 1.0, np.e - 1\ndef T(n):\n    x = np.linspace(a, b, n + 1); y = f(x)\n    return (b - a) / n * (y.sum() - (y[0] + y[-1]) / 2)\nprev = T(1)\nfor n in [2, 4, 8, 16, 32, 64]:\n    t = T(n)\n    print(f"n = {n:3d}: ошибка {t - exact:+.3e}, оценка Рунге {(t - prev) / 3:+.3e}, Ричардсон {(4 * t - prev) / 3 - exact:+.2e}")\n    prev = t\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 20. Метод Монте-Карло
   * ============================================================================== */
  const MC = {
    circ: { label: 'четверть круга √(1 − x²) на [0, 1] (= π/4)', f: (x) => Math.sqrt(Math.max(0, 1 - x * x)), a: 0, b: 1, top: 1, exact: PI / 4, py: 'np.sqrt(1 - x**2)' },
    exp: { label: 'eˣ на [0, 1]', f: E, a: 0, b: 1, top: Math.E, exact: Math.E - 1, py: 'np.exp(x)' },
    gauss: { label: 'e^(−x²) на [0, 2]', f: (x) => E(-x * x), a: 0, b: 2, top: 1, exact: (Math.sqrt(PI) / 2) * erf(2), py: 'np.exp(-x**2)' },
  };
  const MN = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  GBC.widget('monte-carlo', (el) => {
    const s = { fn: 'circ', mode: 'hit', k: 4, seed: 1 };
    const w = ui.shell(el, { title: 'Монте-Карло: интеграл из случайных точек', sub: '«Попадания»: бросаем точки в прямоугольник и считаем долю попавших под кривую. «Среднее»: берём случайные x и усредняем f(x) — интеграл равен (b − a)·среднее. Ошибка убывает как 1/√n: в 4 раза больше точек — в 2 раза точнее.', stack: true });
    ui.select(w.controls, { label: 'Интеграл', value: s.fn, options: Object.entries(MC).map(([k, M]) => ({ value: k, label: M.label })), onChange: (v) => ((s.fn = v), gen(), draw()) });
    ui.segmented(w.controls, { label: 'Способ', value: s.mode, options: [{ value: 'hit', label: 'попадания' }, { value: 'mean', label: 'среднее f(x)' }], onChange: (v) => ((s.mode = v), draw()) });
    ui.player(w.controls, { label: 'Число точек n', min: 0, max: MN.length - 1, value: s.k, fps: 1.2, format: (k) => 'n = ' + MN[k], onChange: (k) => ((s.k = k), draw()) });
    ui.button(w.controls, { label: 'Новые случайные точки', kind: 'ghost', small: true, onClick: () => (s.seed++, gen(), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 260, x: { label: 'x' }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'n (лог.)', type: 'log', domain: [8, 12000], ticks: [10, 100, 1000, 10000], format: String }, y: { label: '|ошибка| (лог.)', type: 'log', domain: [1e-9, 1], ticks: decades(-9, 0), format: powFmt } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'est', label: 'оценка' }, { key: 'ex', label: 'точно' }, { key: 'e', label: '|ошибка|' }, { key: 'sd', label: 'ожидаемая σ/√n' }]);
    let X = [];
    let Y = [];
    function gen() {
      const rng = new GBC.RNG(s.seed);
      X = [];
      Y = [];
      for (let i = 0; i < 10000; i++) {
        X.push(rng.random());
        Y.push(rng.random());
      }
    }
    function estimate(M, n, mode) {
      const W = M.b - M.a;
      let acc = 0;
      for (let i = 0; i < n; i++) {
        const x = M.a + W * X[i];
        acc += mode === 'hit' ? (Y[i] * M.top <= M.f(x) ? 1 : 0) : M.f(x);
      }
      return mode === 'hit' ? (acc / n) * W * M.top : (acc / n) * W;
    }
    /** Стандартное отклонение одной «пробы» (для теоретической ошибки σ/√n). */
    function sdOne(M, mode) {
      const W = M.b - M.a;
      if (mode === 'hit') {
        const p = M.exact / (W * M.top);
        return W * M.top * Math.sqrt(p * (1 - p));
      }
      const m2 = simpson((x) => M.f(x) ** 2, M.a, M.b, 2000) / W;
      const m1 = M.exact / W;
      return W * Math.sqrt(Math.max(m2 - m1 * m1, 0));
    }
    function draw() {
      const M = MC[s.fn];
      const n = MN[s.k];
      const show = Math.min(n, 2000);
      const W = M.b - M.a;
      const c = curve(M.f, M.a, M.b, 300);
      const L = [];
      if (s.mode === 'hit') {
        const xin = [];
        const yin = [];
        const xout = [];
        const yout = [];
        for (let i = 0; i < show; i++) {
          const x = M.a + W * X[i];
          const y = Y[i] * M.top;
          if (y <= M.f(x)) (xin.push(x), yin.push(y));
          else (xout.push(x), yout.push(y));
        }
        L.push({ type: 'rect', x0: M.a, x1: M.b, y0: 0, y1: M.top, stroke: 'ink2', opacity: 0, width: 1.2, dash: '4 3' });
        L.push({ type: 'points', x: xout, y: yout, color: 'muted', r: show > 500 ? 1.6 : 2.6, label: 'мимо' });
        L.push({ type: 'points', x: xin, y: yin, color: 'model', r: show > 500 ? 1.6 : 2.6, label: 'под кривой' });
      } else {
        const xs = [];
        for (let i = 0; i < show; i++) xs.push(M.a + W * X[i]);
        const mean = estimate(M, n, 'mean') / W;
        L.push({ type: 'rect', x0: M.a, x1: M.b, y0: 0, y1: mean, fill: 'tree', stroke: 'tree', opacity: 0.12, width: 1.6, label: 'среднее f · (b − a)' });
        L.push({ type: 'segments', x1: xs.slice(0, 300), y1: xs.slice(0, 300).map(() => 0), x2: xs.slice(0, 300), y2: xs.slice(0, 300).map(M.f), color: 'model', width: 0.8, opacity: 0.35 });
        L.push({ type: 'points', x: xs, y: xs.map(M.f), color: 'model', r: show > 500 ? 1.6 : 2.6, label: 'значения f(xᵢ)' });
      }
      L.push({ type: 'line', x: c.x, y: c.y, color: 'tree', width: 2.4, hover: false });
      p1.render(L, { x: [M.a, M.b], y: [0, M.top * 1.06] });
      const grid = [];
      for (let e = 1; e <= 4.0001; e += 0.1) grid.push(Math.round(Math.pow(10, e)));
      const errs = grid.map((m) => Math.max(Math.abs(estimate(M, m, s.mode) - M.exact), 1e-9));
      const sd = sdOne(M, s.mode);
      const tr = grid.map((m) => Math.max(Math.abs(trap(M.f, M.a, M.b, m) - M.exact), 1e-9));
      p2.render([
        { type: 'line', x: grid, y: grid.map((m) => sd / Math.sqrt(m)), color: 'muted', width: 1.4, dash: '5 4', label: 'σ/√n', hover: false },
        { type: 'line', x: grid, y: errs, color: 'model', width: 1.8, label: 'Монте-Карло', hover: false },
        { type: 'line', x: grid, y: tr, color: 'violet', width: 1.8, label: 'трапеции с n узлами', hover: false },
        { type: 'points', x: [n], y: [Math.max(Math.abs(estimate(M, n, s.mode) - M.exact), 1e-9)], color: 'tree', r: 6 },
      ]);
      const est = estimate(M, n, s.mode);
      st.set('est', f6(est) + (s.fn === 'circ' ? ' (π ≈ ' + f4(4 * est) + ')' : ''));
      st.set('ex', f6(M.exact));
      st.set('e', sci(Math.abs(est - M.exact)));
      st.set('sd', sci(sd / Math.sqrt(n)));
      note.innerHTML = 'Ошибка Монте-Карло случайна, но её типичный размер — σ/√n (пунктир). В одномерном случае метод проигрывает трапециям безнадёжно. Зато его ошибка <b>не зависит от размерности</b>: для интеграла по 10 переменным сетка из 10 узлов на ось — это уже 10¹⁰ вычислений, а Монте-Карло всё так же нужно n точек. В машинном обучении средние потери на выборке — оценка Монте-Карло ожидаемых потерь (шаг 26), а кривая частичной зависимости (урок 12.3) — среднее прогнозов по объектам.';
    }
    w.pythonAction(() => {
      const M = MC[s.fn];
      return 'import numpy as np\n\nf = lambda x: ' + M.py + '\na, b, top = ' + py(M.a) + ', ' + py(M.b) + ', ' + py(M.top) + '\nexact = ' + py(M.exact) + '\nrng = np.random.default_rng(0)\nfor n in [100, 1000, 10000, 100000, 1000000]:\n    x = a + (b - a) * rng.random(n)\n    y = top * rng.random(n)\n    hit = np.mean(y <= f(x)) * (b - a) * top       # доля попаданий × площадь прямоугольника\n    mean = np.mean(f(x)) * (b - a)                 # среднее значение × длина отрезка\n    print(f"n = {n:7d}: попадания {hit:.5f} (ошибка {abs(hit - exact):.1e}), среднее {mean:.5f} (ошибка {abs(mean - exact):.1e})")\n';
    });
    gen();
    draw();
  });

  /* ==============================================================================
   * Шаг 21. Несобственные интегралы: бесконечный промежуток
   * ============================================================================== */
  const IM = {
    exp: { label: 'e⁻ˣ на [0, ∞)', f: (x) => E(-x), a: 0, A: (T) => 1 - E(-T), lim: 1, ydom: [0, 1.1], py: ['np.exp(-x)', '1 - np.exp(-T)'] },
    inv2: { label: '1/x² на [1, ∞)', f: (x) => 1 / (x * x), a: 1, A: (T) => 1 - 1 / T, lim: 1, ydom: [0, 1.1], py: ['1 / x**2', '1 - 1 / T'] },
    inv: { label: '1/x на [1, ∞) — расходится', f: (x) => 1 / x, a: 1, A: (T) => Math.log(T), lim: Infinity, ydom: [0, 1.1], py: ['1 / x', 'np.log(T)'] },
    atan: { label: '1/(1 + x²) на [0, ∞)', f: (x) => 1 / (1 + x * x), a: 0, A: Math.atan, lim: PI / 2, ydom: [0, 1.1], py: ['1 / (1 + x**2)', 'np.arctan(T)'] },
    xexp: { label: 'x·e⁻ˣ на [0, ∞)', f: (x) => x * E(-x), a: 0, A: (T) => 1 - (T + 1) * E(-T), lim: 1, ydom: [0, 0.42], py: ['x * np.exp(-x)', '1 - (T + 1) * np.exp(-T)'] },
  };
  const Tof = (k) => Math.pow(10, k / 20) * 1.5;
  GBC.widget('improper', (el) => {
    const s = { fn: 'exp', k: 10 };
    const w = ui.shell(el, { title: 'Несобственный интеграл: до бесконечности', sub: 'Фигура уходит вправо бесконечно. Считаем площадь до T и смотрим, к чему она стремится при T → ∞ (предел из урока 15.3). Нажмите ▶.', stack: true });
    ui.select(w.controls, { label: 'Функция', value: s.fn, options: Object.entries(IM).map(([k, f]) => ({ value: k, label: f.label })), onChange: (k) => ((s.fn = k), draw()) });
    ui.player(w.controls, { label: 'Правая граница T', min: 0, max: 60, value: s.k, fps: 6, format: (k) => 'T = ' + U.fmt(Tof(k), 3), onChange: (k) => ((s.k = k), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x', domain: [0, 12] }, y: { label: 'f(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'T (лог.)', type: 'log', domain: [1.5, 1500], ticks: [2, 10, 100, 1000], format: String }, y: { label: 'площадь от a до T' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'T', label: 'T' }, { key: 'A', label: 'площадь до T' }, { key: 'L', label: 'предел' }, { key: 'r', label: 'осталось (хвост)' }]);
    function draw() {
      const I = IM[s.fn];
      const T = Tof(s.k);
      const xs = U.linspace(Math.max(I.a, 0.02), 12, 400);
      const filled = xs.filter((x) => x <= T);
      p1.render([
        { type: 'area', x: filled, y0: filled.map(() => 0), y1: filled.map(I.f), color: 'model', opacity: 0.3 },
        { type: 'line', x: xs, y: xs.map(I.f), color: 'tree', width: 2.4, hover: false },
        T <= 12 ? { type: 'vline', x: T, color: 'ink2', dash: '3 3', text: 'T' } : { type: 'points', x: [], y: [] },
      ], { x: [0, 12], y: I.ydom });
      const Ts = U.range(61).map(Tof);
      p2.render([
        { type: 'line', x: Ts, y: Ts.map(I.A), color: 'model', width: 2.4, hover: false },
        Number.isFinite(I.lim) ? { type: 'hline', y: I.lim, color: 'tree', dash: '6 4', text: 'предел ' + f4(I.lim) } : { type: 'points', x: [], y: [] },
        { type: 'points', x: [T], y: [I.A(T)], color: 'tree', r: 6 },
      ], { y: Number.isFinite(I.lim) ? [0, I.lim * 1.25] : [0, 7.5] });
      st.set('T', f3(T));
      st.set('A', f6(I.A(T)));
      st.set('L', Number.isFinite(I.lim) ? f6(I.lim) : '∞');
      st.set('r', Number.isFinite(I.lim) ? U.fmt(I.lim - I.A(T), 3) : '∞');
      const msg = {
        exp: 'Площадь до T равна 1 − e^(−T) и стремится к 1: хвост тает экспоненциально быстро.',
        inv2: 'Площадь 1 − 1/T → 1. Хвост после T равен 1/T — тает медленнее, чем у экспоненты, но тает.',
        inv: 'Площадь ln T растёт медленно, но без границ: интеграл <b>расходится</b>. 1/x убывает слишком медленно, а 1/x² — уже достаточно быстро (граница — шаг 22).',
        atan: 'Первообразная — арктангенс: площадь arctg T → π/2 ≈ 1.5708. По всей прямой (−∞, ∞) площадь π.',
        xexp: 'По частям: площадь 1 − (T + 1)e^(−T) → 1. Множитель x растёт, но экспонента всё равно побеждает (урок 15.4) — это среднее экспоненциального распределения (шаг 26).',
      }[s.fn];
      note.innerHTML = 'Площадь до T = ' + U.fmt(T, 3) + ': <b>' + f4(I.A(T)) + '</b>. ' + msg + ' Определение: интеграл от a до ∞ — это предел интегралов от a до T при T → ∞; если предел конечен, интеграл <b>сходится</b>.';
    }
    w.pythonAction(() => {
      const I = IM[s.fn];
      return 'import numpy as np\n\nA = lambda T: ' + I.py[1] + '      # площадь от a до T по первообразной\nfor T in [2, 10, 100, 1000, 1e6]:\n    print(f"T = {T:>9g}: площадь {A(T):.6f}")\n';
    });
    draw();
  });

  /* ==============================================================================
   * Шаг 22. p-интегралы: граница сходимости и особенность в нуле
   * ============================================================================== */
  GBC.widget('p-integrals', (el) => {
    const s = { p: 2, mode: 'inf', T: 50, eps: 0.01 };
    const w = ui.shell(el, { title: 'Граница сходимости: ∫ dx/xᵖ', sub: 'Два вида несобственных интегралов от одной функции 1/xᵖ: хвост от 1 до бесконечности и особенность в нуле (от 0 до 1). Двигайте p: на бесконечности нужна быстрая убыль (p > 1), а у нуля — медленный рост (p < 1). Граница в обоих случаях — p = 1.', stack: true });
    ui.segmented(w.controls, { label: 'Какой интеграл', value: s.mode, options: [{ value: 'inf', label: 'от 1 до ∞ — хвост' }, { value: 'zero', label: 'от 0 до 1 — особенность' }], onChange: (v) => ((s.mode = v), mkCut(), draw()) });
    ui.slider(w.controls, { label: 'Показатель p', min: 0.2, max: 3, step: 0.05, value: s.p, onInput: (v) => ((s.p = v), draw()) });
    const cutBox = H('div', { style: 'display:contents' });
    w.controls.appendChild(cutBox);
    function mkCut() {
      cutBox.textContent = '';
      if (s.mode === 'inf') ui.slider(cutBox, { label: 'Отрезаем хвост на T', min: 1.5, max: 10000, log: true, value: s.T, format: (v) => U.fmt(v, 3), onInput: (v) => ((s.T = v), draw()) });
      else ui.slider(cutBox, { label: 'Отрезаем у нуля: ε', min: 1e-6, max: 0.5, log: true, value: s.eps, format: (v) => U.fmt(v, 2), onInput: (v) => ((s.eps = v), draw()) });
    }
    const p1 = new GBC.Plot(w.main, { height: 250, x: { label: 'x' }, y: { label: '1/xᵖ' } });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'граница отреза (лог.)', type: 'log' }, y: { label: 'площадь' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'A', label: 'площадь до отреза' }, { key: 'L', label: 'предел' }, { key: 'v', label: 'вердикт' }]);
    const areaInf = (p, T) => (Math.abs(p - 1) < 1e-9 ? Math.log(T) : (Math.pow(T, 1 - p) - 1) / (1 - p));
    const areaZero = (p, e) => (Math.abs(p - 1) < 1e-9 ? -Math.log(e) : (1 - Math.pow(e, 1 - p)) / (1 - p));
    function draw() {
      const p = s.p;
      const f = (x) => Math.pow(x, -p);
      if (s.mode === 'inf') {
        const xs = U.linspace(1, 12, 400);
        const fill = xs.filter((x) => x <= s.T);
        p1.render([
          { type: 'area', x: fill, y0: fill.map(() => 0), y1: fill.map(f), color: 'model', opacity: 0.3 },
          { type: 'line', x: xs, y: xs.map((x) => 1 / x), color: 'muted', width: 1.4, dash: '5 4', label: '1/x (p = 1)', hover: false },
          { type: 'line', x: xs, y: xs.map(f), color: 'tree', width: 2.4, label: '1/xᵖ', hover: false },
          s.T <= 12 ? { type: 'vline', x: s.T, color: 'ink2', dash: '3 3', text: 'T' } : { type: 'points', x: [], y: [] },
        ], { x: [0.8, 12], y: [0, 1.1] });
        const Ts = decades(0, 4, 0.1).map((v) => v * 1.5).filter((v) => v <= 15000);
        const lim = p > 1 ? 1 / (p - 1) : Infinity;
        const As = Ts.map((T) => areaInf(p, T));
        p2.opts.x = { label: 'T (лог.)', type: 'log', domain: [1.5, 15000], ticks: [2, 10, 100, 1000, 10000], format: String };
        p2.render([
          { type: 'line', x: Ts, y: Ts.map((T) => Math.log(T)), color: 'muted', width: 1.2, dash: '5 4', label: 'p = 1: ln T', hover: false },
          { type: 'line', x: Ts, y: As, color: 'model', width: 2.4, label: 'площадь до T', hover: false },
          Number.isFinite(lim) ? { type: 'hline', y: lim, color: 'tree', dash: '6 4', text: 'предел 1/(p − 1) = ' + f3(lim) } : { type: 'points', x: [], y: [] },
          { type: 'points', x: [s.T], y: [areaInf(p, s.T)], color: 'tree', r: 6 },
        ], { y: [0, Math.min(12, Math.max(...As.filter(Number.isFinite), Number.isFinite(lim) ? lim : 0) * 1.1 + 0.2)] });
        st.set('A', f4(areaInf(p, s.T)));
        st.set('L', Number.isFinite(lim) ? f4(lim) : '∞');
        st.set('v', p > 1 ? 'сходится' : 'расходится');
        note.innerHTML = '∫₁ᵀ x⁻ᵖ dx = (T¹⁻ᵖ − 1)/(1 − p). При p > 1 степень T¹⁻ᵖ → 0, и площадь → 1/(p − 1) = ' + (p > 1 ? f3(1 / (p - 1)) : '…') + '. При p ≤ 1 площадь растёт без границ (при p = 1 — как ln T). <b>Признак сравнения</b>: если 0 ≤ f ≤ g и ∫g сходится, то и ∫f сходится. Например, 1/(x² + x) ≤ 1/x² — сходится (и равен ln 2), а e^(−x²) ≤ e^(−x) при x ≥ 1 — сходится.';
      } else {
        const xs = U.linspace(0.002, 1.5, 600);
        const fill = xs.filter((x) => x >= s.eps && x <= 1);
        p1.render([
          { type: 'area', x: fill, y0: fill.map(() => 0), y1: fill.map(f), color: 'model', opacity: 0.3 },
          { type: 'line', x: xs, y: xs.map((x) => Math.min(1 / x, 50)), color: 'muted', width: 1.4, dash: '5 4', label: '1/x (p = 1)', hover: false },
          { type: 'line', x: xs, y: xs.map((x) => Math.min(f(x), 50)), color: 'tree', width: 2.4, label: '1/xᵖ', hover: false },
          { type: 'vline', x: 1, color: 'ink2', width: 1 },
          s.eps >= 0.01 ? { type: 'vline', x: s.eps, color: 'ink2', dash: '3 3', text: 'ε' } : { type: 'points', x: [], y: [] },
        ], { x: [0, 1.5], y: [0, 8] });
        const es = decades(-6, -0.3, 0.1);
        const lim = p < 1 ? 1 / (1 - p) : Infinity;
        const As = es.map((e) => areaZero(p, e));
        p2.opts.x = { label: 'ε (лог.)', type: 'log', domain: [1e-6, 0.5], ticks: decades(-6, -1), format: powFmt };
        p2.render([
          { type: 'line', x: es, y: es.map((e) => -Math.log(e)), color: 'muted', width: 1.2, dash: '5 4', label: 'p = 1: ln(1/ε)', hover: false },
          { type: 'line', x: es, y: As, color: 'model', width: 2.4, label: 'площадь от ε до 1', hover: false },
          Number.isFinite(lim) ? { type: 'hline', y: lim, color: 'tree', dash: '6 4', text: 'предел 1/(1 − p) = ' + f3(lim) } : { type: 'points', x: [], y: [] },
          { type: 'points', x: [s.eps], y: [areaZero(p, s.eps)], color: 'tree', r: 6 },
        ], { y: [0, Math.min(16, Math.max(...As.filter(Number.isFinite), Number.isFinite(lim) ? lim : 0) * 1.1 + 0.2)] });
        st.set('A', f4(areaZero(p, s.eps)));
        st.set('L', Number.isFinite(lim) ? f4(lim) : '∞');
        st.set('v', p < 1 ? 'сходится' : 'расходится');
        note.innerHTML = 'Функция неограничена у нуля — интеграла Римана нет (шаг 6), но есть несобственный: предел площади от ε до 1 при ε → 0. Площадь (1 − ε¹⁻ᵖ)/(1 − p) → 1/(1 − p) при p < 1: например, ∫₀¹ dx/√x = 2. При p ≥ 1 «шип» слишком толстый — площадь бесконечна. Ловушка: ∫₋₁¹ dx/x² по формуле дала бы −2, но в нуле особенность с p = 2 — интеграл расходится.';
      }
    }
    w.pythonAction(() => 'import numpy as np\n\np = ' + py(s.p) + '\nfor T in [10, 100, 1e4, 1e8]:\n    A = np.log(T) if p == 1 else (T**(1 - p) - 1) / (1 - p)\n    print(f"∫₁^{T:g} x^(−p) dx = {A:.6f}")\nfor eps in [1e-2, 1e-4, 1e-8]:\n    A = -np.log(eps) if p == 1 else (1 - eps**(1 - p)) / (1 - p)\n    print(f"∫_{eps:g}^1 x^(−p) dx = {A:.6f}")\n');
    mkCut();
    draw();
  });

  /* ==============================================================================
   * Шаг 23. Площадь между кривыми; кривая Лоренца и коэффициент Джини
   * ============================================================================== */
  const BC = {
    xx2: { label: 'x и x²', f: (x) => x, g: (x) => x * x, view: [-0.3, 1.3], a: 0, b: 1, ft: 'x', gt: 'x²' },
    par: { label: 'x + 2 и x²', f: (x) => x + 2, g: (x) => x * x, view: [-1.7, 2.7], a: -1, b: 2, ft: 'x + 2', gt: 'x²' },
    sq: { label: '√x и x²', f: Math.sqrt, g: (x) => x * x, view: [0, 1.4], a: 0, b: 1, ft: '√x', gt: 'x²' },
    sc: { label: 'sin x и cos x (пересекаются)', f: Math.sin, g: Math.cos, view: [0, PI], a: 0, b: PI, ft: 'sin x', gt: 'cos x' },
    lor: { label: 'кривая Лоренца и коэффициент Джини', lorenz: true },
  };
  GBC.widget('between-curves', (el) => {
    const s = { k: 'xx2', a: 0, b: 1, kk: 2 };
    const w = ui.shell(el, { title: 'Площадь между кривыми', sub: 'Площадь между графиками — интеграл разности «верхняя минус нижняя»: ∫(f − g)dx. Синим — где f выше, красным — где выше g. Тяните границы. В режиме «Лоренц» — кривая неравенства доходов и коэффициент Джини.' });
    ui.select(w.controls, { label: 'Кривые', value: s.k, options: Object.entries(BC).map(([k, B]) => ({ value: k, label: B.label })), onChange: (v) => {
      s.k = v;
      if (!BC[v].lorenz) (s.a = BC[v].a), (s.b = BC[v].b);
      mk();
      draw();
    } });
    const box = H('div', { style: 'display:flex;flex-direction:column;gap:14px' });
    w.controls.appendChild(box);
    function mk() {
      box.textContent = '';
      if (BC[s.k].lorenz) ui.slider(box, { label: 'Неравенство k (L(p) = pᵏ)', min: 1, max: 6, step: 0.25, value: s.kk, onInput: (v) => ((s.kk = v), draw()) });
      else box.appendChild(H('p', { class: 'ctl-help' }, 'Точки пересечения кривых (кружки) — естественные границы. Тяните оранжевые линии a и b.'));
    }
    const plot = new GBC.Plot(w.main, { height: 320, x: { label: 'x' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'I', label: '∫ (f − g) dx' }, { key: 'A', label: '∫ |f − g| dx' }, { key: 'x', label: 'пересечения' }]);
    function draw() {
      const B = BC[s.k];
      if (B.lorenz) {
        const k = s.kk;
        const L = (p) => Math.pow(p, k);
        const xs = U.linspace(0, 1, 300);
        plot.opts.equal = true;
        plot.render([
          { type: 'area', x: xs, y0: xs.map(L), y1: xs, color: 'model', opacity: 0.3, label: 'площадь неравенства' },
          { type: 'line', x: [0, 1], y: [0, 1], color: 'muted', width: 1.4, dash: '5 4', label: 'полное равенство', hover: false },
          { type: 'line', x: xs, y: xs.map(L), color: 'tree', width: 2.4, label: 'кривая Лоренца L(p)', hover: false },
          { type: 'points', x: [0.5], y: [L(0.5)], color: 'tree', r: 5 },
        ], { x: [0, 1], y: [0, 1] });
        plot.opts.x.label = 'доля людей p (от бедных к богатым)';
        plot.opts.y.label = 'доля их дохода L(p)';
        const IL = 1 / (k + 1);
        const G = (k - 1) / (k + 1);
        st.set('I', '∫L = ' + f4(IL));
        st.set('A', 'Джини = ' + f4(G));
        st.set('x', '50 % людей → ' + U.fmt(100 * L(0.5), 1) + ' % дохода');
        note.innerHTML = 'Кривая Лоренца L(p) — какая доля всех доходов у беднейших p людей. При полном равенстве это диагональ. <b>Коэффициент Джини</b> — удвоенная площадь между диагональю и кривой: G = 1 − 2∫₀¹ L(p)dp. Для L = pᵏ: ∫L = 1/(k + 1), G = (k − 1)/(k + 1) = ' + f3(G) + '. В скоринге «Джини модели» — другая, но родственная величина: 2·AUC − 1 (шаг 27).';
        return;
      }
      plot.opts.equal = false;
      plot.opts.x.label = 'x';
      plot.opts.y.label = 'y';
      const lo = Math.min(s.a, s.b);
      const hi = Math.max(s.a, s.b);
      const xs = U.linspace(lo, hi, 400);
      const d = (x) => B.f(x) - B.g(x);
      const cx = U.linspace(B.view[0], B.view[1], 400);
      const roots = rootsOf(d, B.view[0], B.view[1], 2000);
      plot.render([
        { type: 'area', x: xs, y0: xs.map(B.g), y1: xs.map((x) => Math.max(B.f(x), B.g(x))), color: 'model', opacity: 0.32, label: 'f выше' },
        { type: 'area', x: xs, y0: xs.map(B.f), y1: xs.map((x) => Math.max(B.f(x), B.g(x))), color: 'pos', opacity: 0.32, label: 'g выше' },
        { type: 'line', x: cx, y: cx.map(B.f), color: 'model', width: 2.4, label: 'f = ' + B.ft, hover: false },
        { type: 'line', x: cx, y: cx.map(B.g), color: 'tree', width: 2.4, label: 'g = ' + B.gt, hover: false },
        { type: 'points', x: roots, y: roots.map(B.f), color: 'ink', r: 5, hollow: true },
        { type: 'vline', x: s.a, color: 'tree', width: 1.4, dash: '4 3', draggable: true, text: 'a', onDrag: (x) => ((s.a = U.clamp(snap(x, 0.05), B.view[0], B.view[1])), draw()) },
        { type: 'vline', x: s.b, color: 'tree', width: 1.4, dash: '4 3', draggable: true, text: 'b', onDrag: (x) => ((s.b = U.clamp(snap(x, 0.05), B.view[0], B.view[1])), draw()) },
      ], { x: B.view, y: yDom(cx.map(B.f).concat(cx.map(B.g)), 0.06) });
      const I = simpson(d, lo, hi, 2000);
      const A = simpson((x) => Math.abs(d(x)), lo, hi, 4000);
      st.set('I', f4(I));
      st.set('A', f4(A));
      st.set('x', roots.length ? roots.map(f3).join('; ') : 'нет');
      const msg = {
        xx2: 'На [0, 1] прямая x выше параболы: ∫(x − x²)dx = 1/2 − 1/3 = 1/6 ≈ 0.1667.',
        par: 'Границы — точки пересечения: x² = x + 2 ⇒ x = −1 и x = 2. Площадь ∫₋₁²(x + 2 − x²)dx = 4.5.',
        sq: '√x и x² — взаимно обратные функции, фигура симметрична относительно y = x: ∫₀¹(√x − x²)dx = 2/3 − 1/3 = 1/3.',
        sc: 'Кривые пересекаются в π/4: до неё выше cos, после — sin. ∫(sin − cos) на [0, π] = 2, а настоящая площадь ∫|sin − cos| = 2√2 ≈ 2.8284: кусок, где g выше, нельзя вычитать.',
      }[s.k];
      note.innerHTML = msg + ' Если кривые пересекаются внутри отрезка, площадь — это ∫|f − g|: разбейте отрезок в точках пересечения.';
    }
    w.pythonAction(() => 'import numpy as np\n\nx = np.linspace(-1, 2, 300001)\nf, g = x + 2, x**2                       # прямая выше параболы между корнями\nd = np.abs(f - g)\nprint("площадь:", np.sum((d[1:] + d[:-1]) / 2) * (x[1] - x[0]))\n# кривая Лоренца L(p) = p^k и коэффициент Джини\nk = ' + py(s.kk) + '\np = np.linspace(0, 1, 100001)\nL = p**k\nG = 1 - 2 * np.sum((L[1:] + L[:-1]) / 2) * (p[1] - p[0])\nprint(f"Джини = {G:.4f}, формула (k − 1)/(k + 1) = {(k - 1) / (k + 1):.4f}")\n');
    mk();
    draw();
  });

  /* ==============================================================================
   * Шаг 24. Объём тела вращения и длина дуги
   * ============================================================================== */
  const VOL = {
    cone: { label: 'конус: f = x/2 на [0, 4]', f: (x) => x / 2, a: 0, b: 4, V: (16 * PI) / 3, form: 'πr²h/3 = π·2²·4/3' },
    parab: { label: 'параболоид: f = √x на [0, 4]', f: Math.sqrt, a: 0, b: 4, V: 8 * PI, form: 'π∫x dx = π·16/2' },
    sphere: { label: 'шар: f = √(4 − x²) на [−2, 2]', f: (x) => Math.sqrt(Math.max(0, 4 - x * x)), a: -2, b: 2, V: (32 * PI) / 3, form: '4πr³/3 = 4π·8/3' },
    vase: { label: 'ваза: f = 1 + 0.5·sin x на [0, 2π]', f: (x) => 1 + 0.5 * Math.sin(x), a: 0, b: 2 * PI, V: 2.25 * PI * PI, form: 'π∫(1 + sin x + ¼sin²x)dx = 2.25π²' },
  };
  const ARC = {
    parab: { label: 'парабола y = x² на [0, 1]', f: (x) => x * x, a: 0, b: 1, L: Math.sqrt(5) / 2 + Math.log(2 + Math.sqrt(5)) / 4 },
    sin: { label: 'синусоида y = sin x на [0, π]', f: Math.sin, a: 0, b: PI, L: 3.820197789027712 },
    circ: { label: 'четверть окружности на [0, 1]', f: (x) => Math.sqrt(Math.max(0, 1 - x * x)), a: 0, b: 1, L: PI / 2 },
  };
  const VN = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 64];
  GBC.widget('applications', (el) => {
    const s = { mode: 'vol', vk: 'cone', ak: 'parab', k: 4 };
    const w = ui.shell(el, { title: 'Интеграл как сумма кусочков: объём и длина', sub: '«Объём»: тело вращения режется на тонкие диски объёмом πr²·Δx (вид сбоку). «Длина»: кривая заменяется ломаной, длина каждого звена — по теореме Пифагора. В пределе — интегралы V = π∫f² dx и L = ∫√(1 + f′²) dx.' });
    ui.segmented(w.controls, { label: 'Что считаем', value: s.mode, options: [{ value: 'vol', label: 'объём' }, { value: 'arc', label: 'длина дуги' }], onChange: (v) => ((s.mode = v), mk(), draw()) });
    const box = H('div', { style: 'display:flex;flex-direction:column;gap:14px' });
    w.controls.appendChild(box);
    ui.player(w.controls, { label: 'Число кусочков n', min: 0, max: VN.length - 1, value: s.k, fps: 1.2, format: (k) => 'n = ' + VN[k], onChange: (k) => ((s.k = k), draw()) });
    function mk() {
      box.textContent = '';
      if (s.mode === 'vol') ui.select(box, { label: 'Тело', value: s.vk, options: Object.entries(VOL).map(([k, V]) => ({ value: k, label: V.label })), onChange: (v) => ((s.vk = v), draw()) });
      else ui.select(box, { label: 'Кривая', value: s.ak, options: Object.entries(ARC).map(([k, V]) => ({ value: k, label: V.label })), onChange: (v) => ((s.ak = v), draw()) });
    }
    const plot = new GBC.Plot(w.main, { height: 320, equal: true, x: { label: 'x' }, y: { label: 'y' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'S', label: 'сумма кусочков' }, { key: 'X', label: 'точно' }, { key: 'e', label: 'ошибка' }]);
    function draw() {
      const n = VN[s.k];
      if (s.mode === 'vol') {
        const V = VOL[s.vk];
        const h = (V.b - V.a) / n;
        const L = [];
        let sum = 0;
        for (let i = 0; i < n; i++) {
          const x0 = V.a + i * h;
          const r = V.f(x0 + h / 2);
          sum += PI * r * r * h;
          L.push({ type: 'rect', x0, x1: x0 + h, y0: -r, y1: r, fill: i % 2 ? 'aqua' : 'model', stroke: 'model', opacity: 0.25, width: 0.8 });
          if (n <= 24) {
            const t = U.linspace(0, 2 * PI, 60);
            L.push({ type: 'line', x: t.map((q) => x0 + h + 0.2 * r * Math.cos(q)), y: t.map((q) => r * Math.sin(q)), color: 'model', width: 1, opacity: 0.7, hover: false });
          }
        }
        const c = curve(V.f, V.a, V.b, 300);
        L.push({ type: 'line', x: c.x, y: c.y, color: 'tree', width: 2.4, hover: false }, { type: 'line', x: c.x, y: c.y.map((v) => -v), color: 'tree', width: 2.4, hover: false }, { type: 'hline', y: 0, color: 'axis', dash: '5 4' });
        const R0 = Math.max(...c.y);
        plot.render(L, { x: [V.a - 0.3, V.b + 0.5], y: [-R0 * 1.15, R0 * 1.15] });
        st.set('S', f4(sum));
        st.set('X', f4(V.V) + ' (' + V.form + ')');
        st.set('e', U.fmt(sum - V.V, 3));
        note.innerHTML = 'Каждый диск — цилиндр радиусом r = f(x) и толщиной Δx: объём π·f(x)²·Δx. Сумма дисков — сумма Римана, в пределе V = π∫ₐᵇ f(x)² dx. Так получаются школьные формулы: конус πr²h/3 и шар 4πr³/3 — их «доказательство» и есть этот интеграл. Тем же приёмом «нарезать и сложить» считают работу (∫F dx), массу по плотности и центр тяжести.';
      } else {
        const A = ARC[s.ak];
        const xs = U.linspace(A.a, A.b, n + 1);
        const ys = xs.map(A.f);
        let sum = 0;
        for (let i = 0; i < n; i++) sum += Math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]);
        const c = curve(A.f, A.a, A.b, 300);
        plot.render([
          { type: 'line', x: c.x, y: c.y, color: 'tree', width: 2.4, label: 'кривая', hover: false },
          { type: 'line', x: xs, y: ys, color: 'model', width: 2, label: 'ломаная из ' + n + ' звеньев', hover: false },
          { type: 'points', x: xs, y: ys, color: 'model', r: n > 24 ? 2 : 4 },
        ], { x: [A.a - 0.1, A.b + 0.1], y: [-0.1, Math.max(...ys, ...c.y) + 0.15] });
        st.set('S', f6(sum));
        st.set('X', f6(A.L));
        st.set('e', U.fmt(sum - A.L, 3));
        note.innerHTML = 'Звено над отрезком Δx имеет длину √(Δx² + Δy²) = √(1 + (Δy/Δx)²)·Δx ≈ √(1 + f′(x)²)·Δx. Сумма звеньев — сумма Римана для L = ∫ₐᵇ √(1 + f′²) dx. Ломаная всегда короче кривой и подходит к ней снизу. Даже для параболы ответ непростой: (√5)/2 + ln(2 + √5)/4 ≈ 1.4789, а для синусоиды интеграл не выражается формулой — только численно.';
      }
    }
    w.pythonAction(() => 'import numpy as np\n\n# объём конуса дисками: f(x) = x/2 на [0, 4]\nfor n in [4, 16, 64, 1000]:\n    h = 4 / n\n    x = (np.arange(n) + 0.5) * h\n    print(f"n = {n:4d}: Σ π f² Δx = {np.sum(np.pi * (x / 2)**2) * h:.5f}")\nprint("точно 16π/3 =", 16 * np.pi / 3)\n# длина параболы ломаной\nx = np.linspace(0, 1, 1001); y = x**2\nprint("длина ломаной:", np.sum(np.hypot(np.diff(x), np.diff(y))), " точно:", np.sqrt(5) / 2 + np.log(2 + np.sqrt(5)) / 4)\n');
    mk();
    draw();
  });

  /* ==============================================================================
   * Шаг 25. Плотность и функция распределения
   * ============================================================================== */
  const mixPdf = (x, ws, ms, ss) => ws.reduce((acc, w0, i) => acc + (w0 * pdf((x - ms[i]) / ss[i])) / ss[i], 0);
  const mixCdf = (x, ws, ms, ss) => ws.reduce((acc, w0, i) => acc + w0 * Phi((x - ms[i]) / ss[i]), 0);
  const DIST = {
    unif: { label: 'равномерное на [0, 10]', pdf: (x) => (x >= 0 && x <= 10 ? 0.1 : 0), cdf: (x) => U.clamp(x / 10, 0, 1), view: [-2, 12], a: 2, b: 5, jumps: [0, 10] },
    unifh: { label: 'равномерное на [0, 0.5] — плотность 2', pdf: (x) => (x >= 0 && x <= 0.5 ? 2 : 0), cdf: (x) => U.clamp(2 * x, 0, 1), view: [-0.25, 0.75], a: 0.1, b: 0.3, jumps: [0, 0.5] },
    exp: { label: 'экспоненциальное (время ожидания)', param: 'lam', pdf: (x, q) => (x >= 0 ? q.lam * E(-q.lam * x) : 0), cdf: (x, q) => (x >= 0 ? 1 - E(-q.lam * x) : 0), view: [-0.5, 10], a: 3, b: 10, jumps: [0] },
    norm: { label: 'нормальное N(μ, σ²)', param: 'sig', pdf: (x, q) => pdf((x - q.mu) / q.sig) / q.sig, cdf: (x, q) => Phi((x - q.mu) / q.sig), view: [-4.5, 4.5], a: -1, b: 1 },
    mix: { label: 'смесь двух колоколов', pdf: (x) => mixPdf(x, [0.6, 0.4], [-1, 2], [0.6, 0.8]), cdf: (x) => mixCdf(x, [0.6, 0.4], [-1, 2], [0.6, 0.8]), view: [-3.5, 5], a: 0, b: 3 },
  };
  /** Квантиль: решаем F(x) = q делением пополам. */
  function quantile(cdf, q, lo, hi) {
    for (let k = 0; k < 80; k++) {
      const m = (lo + hi) / 2;
      if (cdf(m) < q) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  }
  GBC.widget('density-cdf', (el) => {
    const s = { k: 'norm', a: -1, b: 1, q: { lam: 0.5, mu: 0, sig: 1 } };
    const w = ui.shell(el, { title: 'Плотность и функция распределения', sub: 'Сверху — плотность p(x): вероятность попасть в [a, b] — площадь под ней (тяните границы). Снизу — функция распределения F(x) = P(X ≤ x) = ∫ p: та же вероятность — это прирост F(b) − F(a). Основная теорема в действии: F′ = p.', stack: true });
    ui.select(w.controls, { label: 'Распределение', value: s.k, options: Object.entries(DIST).map(([k, D]) => ({ value: k, label: D.label })), onChange: (v) => ((s.k = v), (s.a = DIST[v].a), (s.b = DIST[v].b), mk(), draw()) });
    const box = H('div', { style: 'display:contents' });
    w.controls.appendChild(box);
    function mk() {
      box.textContent = '';
      const D = DIST[s.k];
      if (D.param === 'lam') ui.slider(box, { label: 'Интенсивность λ (среднее 1/λ)', min: 0.25, max: 2, step: 0.25, value: s.q.lam, onInput: (v) => ((s.q.lam = v), draw()) });
      if (D.param === 'sig') {
        ui.slider(box, { label: 'Стандартное отклонение σ', min: 0.5, max: 2, step: 0.25, value: s.q.sig, onInput: (v) => ((s.q.sig = v), draw()) });
        ui.segmented(box, { label: 'Готовые интервалы', value: null, options: [{ value: 1, label: '±1σ' }, { value: 2, label: '±2σ' }, { value: 3, label: '±3σ' }], onChange: (k) => ((s.a = -k * s.q.sig), (s.b = k * s.q.sig), draw()) });
      }
    }
    const p1 = new GBC.Plot(w.main, { height: 240, x: { label: 'x' }, y: { label: 'плотность p(x)' } });
    const p2 = new GBC.Plot(w.main, { height: 220, x: { label: 'x' }, y: { label: 'F(x) = P(X ≤ x)', domain: [0, 1.05] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'P', label: 'площадь на [a, b]' }, { key: 'F', label: 'F(b) − F(a)' }, { key: 'tot', label: 'вся площадь' }, { key: 'med', label: 'медиана' }]);
    function draw() {
      const D = DIST[s.k];
      const q = s.q;
      const p = (x) => D.pdf(x, q);
      const F = (x) => D.cdf(x, q);
      const a = Math.min(s.a, s.b);
      const b = Math.max(s.a, s.b);
      const c = curve(p, D.view[0], D.view[1], 800);
      for (const j of D.jumps || []) {
        const k = c.x.findIndex((t) => t >= j);
        if (k > 0) (c.x.splice(k, 0, j, j), c.y.splice(k, 0, p(j - 1e-9), p(j + 1e-9)));
      }
      const ins = U.linspace(a, b, 300);
      const top = Math.max(...c.y.filter(Number.isFinite)) * 1.12;
      p1.render([
        { type: 'area', x: ins, y0: ins.map(() => 0), y1: ins.map(p), color: 'model', opacity: 0.35 },
        { type: 'line', x: c.x, y: c.y, color: 'tree', width: 2.4, hover: false },
        { type: 'vline', x: s.a, color: 'model', width: 1.8, draggable: true, text: 'a', onDrag: (x) => ((s.a = U.clamp(snap(x, (D.view[1] - D.view[0]) / 200), D.view[0], D.view[1])), draw()) },
        { type: 'vline', x: s.b, color: 'model', width: 1.8, draggable: true, text: 'b', onDrag: (x) => ((s.b = U.clamp(snap(x, (D.view[1] - D.view[0]) / 200), D.view[0], D.view[1])), draw()) },
      ], { x: D.view, y: [0, top] });
      const cF = curve(F, D.view[0], D.view[1], 500);
      p2.render([
        { type: 'line', x: cF.x, y: cF.y, color: 'model', width: 2.4, hover: false },
        { type: 'segments', x1: [D.view[0], D.view[0]], y1: [F(a), F(b)], x2: [a, b], y2: [F(a), F(b)], color: 'muted', width: 1, dash: '4 3', opacity: 0.9 },
        { type: 'segments', x1: [b], y1: [F(a)], x2: [b], y2: [F(b)], color: 'tree', width: 3.5, opacity: 1 },
        { type: 'points', x: [a, b], y: [F(a), F(b)], color: 'model', r: 5 },
      ], { x: D.view });
      const lo = D.view[0] - 20;
      const hi = D.view[1] + 40;
      const P = simpson(p, a, b, 4000);
      const tot = simpson(p, lo, hi, 20000);
      const med = quantile(F, 0.5, lo, hi);
      st.set('P', U.fmt(100 * P, 2) + ' %');
      st.set('F', U.fmt(100 * (F(b) - F(a)), 2) + ' %');
      st.set('tot', f4(tot));
      st.set('med', f3(Math.abs(med) < 1e-9 ? 0 : med));
      const msg = {
        unif: 'Равномерное распределение: плотность постоянна, вероятность пропорциональна длине интервала: P(2 ≤ X ≤ 5) = 3/10.',
        unifh: 'Плотность здесь равна 2 — больше единицы! Это не вероятность, а «вероятность на единицу длины»: вероятность — площадь, и она ≤ 1. Вся площадь: 2 · 0.5 = 1.',
        exp: 'Экспоненциальное распределение (время ожидания): F(x) = 1 − e^(−λx). Вероятность ждать дольше x: 1 − F(x) = e^(−λx); при λ = 0.5 и x = 3 это e^(−1.5) ≈ 22.3 %. Медиана ln 2/λ меньше среднего 1/λ — у распределения длинный правый хвост.',
        norm: 'Нормальное распределение: в ±1σ — 68.27 %, в ±2σ — 95.45 %, в ±3σ — 99.73 %. Функция Φ не выражается формулой: её считают численно (через erf).',
        mix: 'Смесь двух колоколов: плотность — взвешенная сумма плотностей, F — взвешенная сумма функций распределения. Где плотность высокая, F растёт круто; в провале между горбами F почти горизонтальна.',
      }[s.k];
      note.innerHTML = 'P(' + f2(a) + ' ≤ X ≤ ' + f2(b) + ') = ∫ p = ' + U.fmt(100 * P, 2) + ' % = F(b) − F(a) (оранжевый отрезок снизу). ' + msg + ' Вероятность одной точки P(X = a) = 0 — полоска нулевой ширины.';
    }
    w.pythonAction(() => 'import numpy as np\nfrom math import erf, sqrt\n\nPhi = lambda z: 0.5 * (1 + erf(z / sqrt(2)))\np = lambda x: np.exp(-x**2 / 2) / np.sqrt(2 * np.pi)     # плотность N(0, 1)\nfor k in [1, 2, 3]:\n    x = np.linspace(-k, k, 200001)\n    y = p(x)\n    area = np.sum((y[1:] + y[:-1]) / 2) * (x[1] - x[0])\n    print(f"P(|Z| ≤ {k}): площадь {area:.6f}, Φ({k}) − Φ(−{k}) = {Phi(k) - Phi(-k):.6f}")\nlam = 0.5\nprint("экспоненциальное: P(X > 3) =", np.exp(-lam * 3))\n');
    mk();
    draw();
  });

  /* ==============================================================================
   * Шаг 26. Математическое ожидание и лучшая константа
   * ============================================================================== */
  const ED = {
    norm: { label: 'нормальное N(2, 1) — симметричное', pdf: (y) => pdf(y - 2), cdf: (y) => Phi(y - 2), lo: -5, hi: 9, view: [-1, 5], mean: 2 },
    exp: { label: 'экспоненциальное, среднее 2 — с хвостом', pdf: (y) => (y >= 0 ? 0.5 * E(-0.5 * y) : 0), cdf: (y) => (y >= 0 ? 1 - E(-0.5 * y) : 0), lo: 0, hi: 40, view: [-0.5, 6], mean: 2 },
    mix: { label: 'смесь: 70 % около 0, 30 % около 3', pdf: (y) => mixPdf(y, [0.7, 0.3], [0, 3], [0.5, 0.7]), cdf: (y) => mixCdf(y, [0.7, 0.3], [0, 3], [0.5, 0.7]), lo: -4, hi: 8, view: [-1.5, 4.5], mean: 0.9 },
  };
  GBC.widget('expected-loss', (el) => {
    const s = { d: 'exp', loss: 'sq', tau: 0.8, c: 0.5 };
    const w = ui.shell(el, { title: 'Лучшая константа — минимум ожидаемых потерь', sub: 'Предсказываем одно число c для случайного Y с плотностью p(y). Ожидаемые потери R(c) = ∫ L(y, c)·p(y) dy — интеграл. Тяните c (сверху) и смотрите на R(c) (снизу). Минимум квадратичных потерь — среднее, модуля — медиана, квантильных — квантиль.', stack: true });
    ui.select(w.controls, { label: 'Распределение Y', value: s.d, options: Object.entries(ED).map(([k, D]) => ({ value: k, label: D.label })), onChange: (v) => ((s.d = v), draw()) });
    ui.segmented(w.controls, { label: 'Потери L(y, c)', value: s.loss, options: [{ value: 'sq', label: '(y − c)²' }, { value: 'abs', label: '|y − c|' }, { value: 'quant', label: 'квантильные' }], onChange: (v) => ((s.loss = v), draw()) });
    ui.slider(w.controls, { label: 'Уровень квантиля τ', min: 0.1, max: 0.9, step: 0.05, value: s.tau, onInput: (v) => ((s.tau = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'y' }, y: { label: 'плотность p(y)' } });
    const p2 = new GBC.Plot(w.main, { height: 240, x: { label: 'константа c' }, y: { label: 'ожидаемые потери R(c)' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'c', label: 'c' }, { key: 'R', label: 'R(c)' }, { key: 'dR', label: 'R′(c) по формуле' }, { key: 'm', label: 'минимум при c =' }]);
    const Lf = (loss, tau) => (loss === 'sq' ? (y, c) => (y - c) ** 2 : loss === 'abs' ? (y, c) => Math.abs(y - c) : (y, c) => (y >= c ? tau * (y - c) : (1 - tau) * (c - y)));
    function risk(D, L, c) {
      const f = (y) => L(y, c) * D.pdf(y);
      const m = U.clamp(c, D.lo, D.hi);
      return simpson(f, D.lo, m, 600) + simpson(f, m, D.hi, 1200);
    }
    function draw() {
      const D = ED[s.d];
      const L = Lf(s.loss, s.tau);
      const med = quantile(D.cdf, 0.5, D.lo, D.hi);
      const qt = quantile(D.cdf, s.tau, D.lo, D.hi);
      const best = s.loss === 'sq' ? D.mean : s.loss === 'abs' ? med : qt;
      const dR = s.loss === 'sq' ? 2 * (s.c - D.mean) : s.loss === 'abs' ? 2 * D.cdf(s.c) - 1 : D.cdf(s.c) - s.tau;
      const ys = curve(D.pdf, D.view[0], D.view[1], 600);
      p1.render([
        { type: 'area', x: ys.x, y0: ys.x.map(() => 0), y1: ys.y, color: 'muted', opacity: 0.18 },
        { type: 'line', x: ys.x, y: ys.y, color: 'ink', width: 2, hover: false },
        { type: 'vline', x: D.mean, color: 'model', width: 2, text: 'среднее' },
        { type: 'vline', x: med, color: 'tree', width: 2, dash: '6 4', text: 'медиана' },
        s.loss === 'quant' ? { type: 'vline', x: qt, color: 'violet', width: 2, dash: '2 3', text: 'квантиль τ' } : { type: 'points', x: [], y: [] },
        { type: 'vline', x: s.c, color: 'ink2', width: 2.2, draggable: true, text: 'c', onDrag: (x) => ((s.c = U.clamp(snap(x, 0.02), D.view[0], D.view[1])), draw()) },
      ], { x: D.view, y: [0, Math.max(...ys.y) * 1.25] });
      const cs = U.linspace(D.view[0], D.view[1], 121);
      const Rs = cs.map((c) => risk(D, L, c));
      const Rc = risk(D, L, s.c);
      const Rb = risk(D, L, best);
      const span = (D.view[1] - D.view[0]) * 0.1;
      p2.render([
        { type: 'line', x: cs, y: Rs, color: 'model', width: 2.4, hover: false },
        { type: 'segments', x1: [s.c - span], y1: [Rc - dR * span], x2: [s.c + span], y2: [Rc + dR * span], color: 'tree', width: 2.2, opacity: 1 },
        { type: 'points', x: [best], y: [Rb], color: 'model', r: 6, hollow: true },
        { type: 'points', x: [s.c], y: [Rc], color: 'tree', r: 6 },
      ], { x: D.view, y: yDom(Rs, 0.08) });
      st.set('c', f3(s.c));
      st.set('R', f4(Rc));
      st.set('dR', f4(dR));
      st.set('m', f3(best));
      const why = {
        sq: 'R(c) = ∫(y − c)²p dy. Дифференцируем по c под знаком интеграла: R′(c) = −2∫(y − c)p dy = 2(c − EY). Ноль — при c = EY = ∫y·p(y)dy: <b>среднее</b> (урок 1.2). Ещё R(c) = DY + (c − EY)²: минимум — дисперсия.',
        abs: 'R(c) = ∫|y − c|p dy. Сдвиг c вправо увеличивает ошибку для всех y < c (их доля F(c)) и уменьшает для y > c (доля 1 − F(c)): R′(c) = F(c) − (1 − F(c)) = 2F(c) − 1. Здесь основная теорема: производная интеграла по пределу. Ноль — при F(c) = ½: <b>медиана</b>.',
        quant: 'Квантильные потери штрафуют недопрогноз с весом τ, перепрогноз — с весом 1 − τ. R′(c) = (1 − τ)F(c) − τ(1 − F(c)) = F(c) − τ, ноль при F(c) = τ: <b>τ-квантиль</b> (урок 5.3).',
      }[s.loss];
      note.innerHTML = why + ' Сейчас: среднее ' + f3(D.mean) + ', медиана ' + f3(med) + (s.d === 'norm' ? ' — у симметричного распределения они совпадают.' : ' — у несимметричного распределения разные ответы для разных потерь.') + ' На выборке интеграл заменяется средним по объектам (Монте-Карло, шаг 20) — так и получаются формулы F₀ в бустинге.';
    }
    w.pythonAction(() => 'import numpy as np\n\n# Y ~ экспоненциальное со средним 2: численно минимизируем ожидаемые потери\ny = np.linspace(0, 60, 600001)\np = 0.5 * np.exp(-0.5 * y)\ndy = y[1] - y[0]\ncs = np.linspace(0, 5, 501)\nR_sq = [np.sum((y - c)**2 * p) * dy for c in cs]\nR_abs = [np.sum(np.abs(y - c) * p) * dy for c in cs]\nprint("argmin E(Y − c)²:", cs[np.argmin(R_sq)], " среднее:", np.sum(y * p) * dy)\nprint("argmin E|Y − c| :", cs[np.argmin(R_abs)], " медиана ln2/0.5 =", np.log(2) / 0.5)\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 27. AUC — площадь под ROC-кривой и вероятность
   * ============================================================================== */
  GBC.widget('roc-auc', (el) => {
    const s = { d: 1, n: 200 };
    const w = ui.shell(el, { title: 'AUC — площадь под ROC-кривой', sub: 'Оценки модели: у объектов класса 0 — из N(0, 1), у класса 1 — из N(d, 1). ROC-кривая — доля найденных (TPR) против доли ложных тревог (FPR) при всех порогах; AUC — площадь под ней. Её же можно найти перебором пар объектов.', stack: true });
    ui.slider(w.controls, { label: 'Разделение классов d', min: 0, max: 3, step: 0.1, value: s.d, onInput: (x) => ((s.d = x), draw()) });
    ui.slider(w.controls, { label: 'Объектов каждого класса', values: [5, 20, 50, 200, 1000], value: s.n, format: String, onInput: (x) => ((s.n = x), draw()) });
    const box = H('div', { class: 'plots-2' });
    w.main.appendChild(box);
    const p1 = new GBC.Plot(box, { height: 280, x: { label: 'оценка модели', domain: [-4, 7] }, y: { label: 'плотность', domain: [0, 0.45] } });
    const p2 = new GBC.Plot(box, { height: 280, equal: true, x: { label: 'доля ложных тревог (FPR)', domain: [0, 1] }, y: { label: 'доля найденных (TPR)', domain: [0, 1] } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 't', label: 'AUC теория Φ(d/√2)' }, { key: 'e', label: 'площадь трапециями' }, { key: 'p', label: 'доля пар «1 выше 0»' }, { key: 'g', label: 'Джини 2·AUC − 1' }]);
    function draw() {
      const d = s.d;
      const xs = U.linspace(-4, 7, 300);
      p1.render([
        { type: 'area', x: xs, y0: xs.map(() => 0), y1: xs.map(pdf), color: 'class0', opacity: 0.25, label: 'класс 0' },
        { type: 'area', x: xs, y0: xs.map(() => 0), y1: xs.map((x) => pdf(x - d)), color: 'class1', opacity: 0.25, label: 'класс 1' },
        { type: 'line', x: xs, y: xs.map(pdf), color: 'class0', width: 2, hover: false },
        { type: 'line', x: xs, y: xs.map((x) => pdf(x - d)), color: 'class1', width: 2, hover: false },
      ]);
      const rng = new GBC.RNG(7);
      const y = [];
      const score = [];
      for (let i = 0; i < s.n; i++) (y.push(0), score.push(rng.normal(0, 1)));
      for (let i = 0; i < s.n; i++) (y.push(1), score.push(rng.normal(d, 1)));
      const roc = GBC.metrics.rocCurve(y, score);
      const auc = GBC.metrics.rocAuc(y, score);
      let wins = 0;
      for (let i = s.n; i < 2 * s.n; i++) for (let j = 0; j < s.n; j++) wins += score[i] > score[j] ? 1 : score[i] === score[j] ? 0.5 : 0;
      const pairs = wins / (s.n * s.n);
      const ts = U.linspace(-6, 9, 300);
      const fpr = ts.map((t) => 1 - Phi(t)).reverse();
      const tpr = ts.map((t) => 1 - Phi(t - d)).reverse();
      const rx = roc.map((p) => p.fpr);
      const ry = roc.map((p) => p.tpr);
      p2.render([
        { type: 'area', x: rx, y0: rx.map(() => 0), y1: ry, color: 'model', opacity: 0.18 },
        { type: 'line', x: [0, 1], y: [0, 1], color: 'muted', dash: '4 4', width: 1.2, hover: false },
        { type: 'line', x: rx, y: ry, color: 'tree', width: 1.8, label: 'по выборке', hover: false },
        { type: 'line', x: fpr, y: tpr, color: 'model', width: 2.2, dash: '6 4', label: 'теория', hover: false },
      ]);
      const theory = Phi(d / Math.SQRT2);
      st.set('t', f4(theory));
      st.set('e', f4(auc));
      st.set('p', f4(pairs));
      st.set('g', f4(2 * auc - 1));
      note.innerHTML = 'AUC = ∫₀¹ TPR d(FPR). Площадь трапециями по выборке (' + f4(auc) + ') и доля пар, где объект класса 1 получил оценку выше объекта класса 0 (' + f4(pairs) + '), совпадают <b>точно</b> — это одна и та же величина. ' + (d === 0 ? 'При d = 0 модель угадывает наугад: кривая — диагональ, AUC ≈ 0.5.' : 'Теория для бесконечной выборки: Φ(d/√2) = ' + f3(theory) + '. При n = ' + s.n + ' выборочная AUC отличается от неё на ' + U.fmt(Math.abs(auc - theory), 2) + ' — это случайный шум оценки.') + ' Метрика из уроков 10.2 и 13.2 — интеграл.';
    }
    w.pythonAction(() => 'import numpy as np\n\nrng = np.random.default_rng(0)\nn, d = ' + s.n + ', ' + py(s.d) + '\nneg, pos = rng.normal(0, 1, n), rng.normal(d, 1, n)\nthr = np.sort(np.r_[neg, pos])[::-1]\ntpr = np.r_[0, [(pos >= t).mean() for t in thr]]\nfpr = np.r_[0, [(neg >= t).mean() for t in thr]]\narea = np.sum(np.diff(fpr) * (tpr[1:] + tpr[:-1]) / 2)      # трапеции\npairs = (pos[:, None] > neg[None, :]).mean()                # P(оценка₁ > оценка₀)\nprint(f"площадь {area:.6f}, доля пар {pairs:.6f}, Джини {2 * area - 1:.4f}")\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 28. Интегрированные градиенты: Ньютон — Лейбниц вдоль пути
   * ============================================================================== */
  const IGM = {
    logit: {
      label: 'логистическая модель с взаимодействием', F: (x1, x2) => sigma(1.5 * x1 + x2 + 2 * x1 * x2 - 1),
      g: (x1, x2) => { const p = sigma(1.5 * x1 + x2 + 2 * x1 * x2 - 1); const q = p * (1 - p); return [q * (1.5 + 2 * x2), q * (1 + 2 * x1)]; },
      tex: 'σ(1.5x₁ + x₂ + 2x₁x₂ − 1)',
    },
    lin: { label: 'линейная: 0.8x₁ − 0.5x₂ + 0.2', F: (x1, x2) => 0.8 * x1 - 0.5 * x2 + 0.2, g: () => [0.8, -0.5], tex: '0.8x₁ − 0.5x₂ + 0.2' },
    prod: { label: 'произведение x₁x₂', F: (x1, x2) => x1 * x2, g: (x1, x2) => [x2, x1], tex: 'x₁x₂' },
    tree: { label: 'ступенчатая (как дерево)', F: (x1, x2) => 0.2 + (x1 > 0.5 ? 0.5 : 0) + (x2 > 0.2 ? 0.3 : 0), g: () => [0, 0], tex: '0.2 + 0.5·[x₁ > 0.5] + 0.3·[x₂ > 0.2]', step: true },
  };
  GBC.widget('integrated-gradients', (el) => {
    const s = { k: 'logit', base: [-1, -1], x: [1.2, 0.8], m: 16 };
    const w = ui.shell(el, { title: 'Интегрированные градиенты: чей вклад в прогноз', sub: 'Как разделить разницу прогнозов F(x) − F(x′) между признаками? Идём по отрезку от опорной точки x′ (кольцо) до объекта x (точка) и складываем вклады каждого признака: Δxᵢ·∂F/∂xᵢ вдоль пути. Тяните обе точки.', stack: true });
    ui.select(w.controls, { label: 'Модель F(x₁, x₂)', value: s.k, options: Object.entries(IGM).map(([k, M]) => ({ value: k, label: M.label })), onChange: (v) => ((s.k = v), (grid = null), draw()) });
    ui.slider(w.controls, { label: 'Шагов суммы Римана m', values: [1, 2, 4, 8, 16, 32, 64, 256], value: s.m, format: String, onInput: (v) => ((s.m = v), draw()) });
    const mapBox = H('div', { style: 'max-width:440px;margin:0 auto' });
    w.main.appendChild(mapBox);
    const p1 = new GBC.Plot(mapBox, { height: 380, equal: true, x: { label: 'признак x₁', domain: [-2, 2] }, y: { label: 'признак x₂', domain: [-2, 2] }, grid: 'none' });
    const p2 = new GBC.Plot(w.main, { height: 230, x: { label: 'α — доля пути от x′ до x', domain: [0, 1] }, y: { label: 'вклады и F на пути' } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'i1', label: 'вклад x₁ (IG₁)' }, { key: 'i2', label: 'вклад x₂ (IG₂)' }, { key: 'sum', label: 'IG₁ + IG₂' }, { key: 'd', label: 'F(x) − F(x′)' }, { key: 'gx', label: 'градиент × Δx' }]);
    let grid = null;
    function mkGrid(M) {
      const nx = 70;
      const vals = [];
      for (let j = 0; j < nx; j++) for (let i = 0; i < nx; i++) vals.push(M.F(-2 + (4 * i) / (nx - 1), -2 + (4 * j) / (nx - 1)));
      const [lo, hi] = U.extent(vals);
      return { g: { nx, ny: nx, x0: -2, x1: 2, y0: -2, y1: 2, values: vals }, lo, hi };
    }
    function draw() {
      const M = IGM[s.k];
      if (!grid) grid = mkGrid(M);
      const col = GBC.colors.proba();
      const [b1, b2] = s.base;
      const [x1, x2] = s.x;
      const d1 = x1 - b1;
      const d2 = x2 - b2;
      const at = (a) => [b1 + a * d1, b2 + a * d2];
      const alphas = U.range(s.m).map((k) => (k + 0.5) / s.m);
      let ig1 = 0;
      let ig2 = 0;
      for (const a of alphas) {
        const gr = M.g(...at(a));
        ig1 += (d1 * gr[0]) / s.m;
        ig2 += (d2 * gr[1]) / s.m;
      }
      const pts = alphas.map(at);
      p1.render([
        { type: 'heatmap', grid: grid.g, colorFn: (v) => col((v - grid.lo) / (grid.hi - grid.lo || 1)), opacity: 0.55 },
        { type: 'contour', grid: grid.g, level: (grid.lo + grid.hi) / 2, color: 'ink2', width: 1.2, dash: '4 3' },
        { type: 'segments', x1: [b1], y1: [b2], x2: [x1], y2: [x2], color: 'ink', width: 2, opacity: 0.9 },
        { type: 'points', x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), color: 'ink2', r: s.m > 32 ? 1.5 : 3 },
        { type: 'points', x: [b1], y: [b2], color: 'ink', r: 8, hollow: true, draggable: true, onDrag: (i, nx, ny) => ((s.base = [U.clamp(snap(nx, 0.05), -2, 2), U.clamp(snap(ny, 0.05), -2, 2)]), draw()) },
        { type: 'points', x: [x1], y: [x2], color: 'tree', r: 8, draggable: true, onDrag: (i, nx, ny) => ((s.x = [U.clamp(snap(nx, 0.05), -2, 2), U.clamp(snap(ny, 0.05), -2, 2)]), draw()) },
        { type: 'text', items: [{ x: b1, y: b2, text: 'x′', dx: 10, dy: 14 }, { x: x1, y: x2, text: 'x', dx: 10, dy: -8 }] },
      ]);
      const as = U.linspace(0, 1, 401);
      const gpath = as.map((a) => M.F(...at(a)));
      const c1 = as.map((a) => d1 * M.g(...at(a))[0]);
      const c2 = as.map((a) => d2 * M.g(...at(a))[1]);
      p2.render([
        { type: 'area', x: as, y0: as.map(() => 0), y1: c1, color: 'aqua', opacity: 0.3 },
        { type: 'area', x: as, y0: as.map(() => 0), y1: c2, color: 'violet', opacity: 0.3 },
        { type: 'hline', y: 0, color: 'axis' },
        { type: 'line', x: as, y: c1, color: 'aqua', width: 2, label: 'Δx₁·∂F/∂x₁', hover: false },
        { type: 'line', x: as, y: c2, color: 'violet', width: 2, label: 'Δx₂·∂F/∂x₂', hover: false },
        { type: 'line', x: as, y: gpath, color: 'ink', width: 2.2, dash: '6 4', label: 'F вдоль пути', hover: false },
      ], { y: yDom(c1.concat(c2, gpath), 0.08, [0]) });
      const D = M.F(x1, x2) - M.F(b1, b2);
      const gx = M.g(x1, x2);
      st.set('i1', f4(ig1));
      st.set('i2', f4(ig2));
      st.set('sum', f4(ig1 + ig2));
      st.set('d', f4(D));
      st.set('gx', f4(d1 * gx[0] + d2 * gx[1]));
      const msg = M.step
        ? 'Ступенчатая модель (как дерево) <b>ломает метод</b>: почти везде её градиент равен нулю, поэтому IG₁ = IG₂ = 0, хотя F(x) − F(x′) = ' + f3(D) + '. Формула Ньютона — Лейбница требует непрерывности, а у ступеньки — скачок. Поэтому для деревьев и бустинга вклады считают иначе — значениями Шепли (урок 12.2).'
        : 'Функция одной переменной g(α) = F(x′ + α(x − x′)) (пунктир) проходит путь от F(x′) до F(x). По цепному правилу (урок 15.8) g′(α) = Δx₁·∂₁F + Δx₂·∂₂F — сумма двух цветных кривых. По формуле Ньютона — Лейбница площадь под g′ равна g(1) − g(0) = F(x) − F(x′). Площади под каждой кривой — вклады признаков: <b>они в сумме дают всю разницу</b> (свойство полноты). ' + (s.k === 'prod' ? 'Для x₁x₂ из (0, 0) взаимодействие делится поровну: IG₁ = IG₂ = x₁x₂/2.' : s.k === 'lin' ? 'Для линейной модели вклад — просто wᵢ·Δxᵢ, сумма Римана точна при любом m.' : 'А «градиент × Δx» в одной точке (последний показатель) полноту не гарантирует.');
      note.innerHTML = msg + ' Интеграл считают суммой Римана с m шагами (точки на отрезке).';
    }
    w.pythonAction(() => 'import numpy as np\n\nsig = lambda z: 1 / (1 + np.exp(-z))\nF = lambda x: sig(1.5 * x[0] + x[1] + 2 * x[0] * x[1] - 1)\ndef grad(x):\n    p = F(x)\n    return p * (1 - p) * np.array([1.5 + 2 * x[1], 1 + 2 * x[0]])\nbase, x = np.array([' + s.base.map(py).join(', ') + ']), np.array([' + s.x.map(py).join(', ') + '])\nfor m in [1, 4, 16, 256]:\n    alphas = (np.arange(m) + 0.5) / m                 # середины — сумма Римана по α\n    g = np.array([grad(base + a * (x - base)) for a in alphas]).mean(axis=0)\n    ig = (x - base) * g\n    print(f"m = {m:3d}: IG = {ig.round(5)}, сумма {ig.sum():.6f}")\nprint("F(x) − F(x′) =", F(x) - F(base))\n');
    draw();
  });

  /* ==============================================================================
   * Шаг 29. Бустинг с маленьким шагом — интегрирование градиентного потока
   * ============================================================================== */
  const NUS = [1, 0.5, 0.2, 0.1, 0.05];
  const NUC = ['red', 'tree', 'violet', 'aqua', 'model'];
  GBC.widget('boosting-flow', (el) => {
    const s = { T: 4 };
    const w = ui.shell(el, { title: 'Маленький шаг: бустинг превращается в интеграл', sub: 'По горизонтали — «время» t = ν·m (темп × число деревьев). Сверху — бустинг одного числа: остаток (1 − ν)ᵐ. Снизу — настоящий градиентный бустинг (деревья глубины 2) на 120 точках. При уменьшении ν кривые сходятся к одной — решению градиентного потока.', stack: true });
    ui.slider(w.controls, { label: 'Показать до времени t', min: 1, max: 8, step: 0.5, value: s.T, onInput: (v) => ((s.T = v), draw()) });
    const p1 = new GBC.Plot(w.main, { height: 230, x: { label: 'время t = ν·m' }, y: { label: 'остаток (одно число)', domain: [0, 1.02] } });
    const p2 = new GBC.Plot(w.main, { height: 250, x: { label: 'время t = ν·m' }, y: { label: 'потери на обучении ½·MSE' } });
    const tbl = H('div');
    w.main.appendChild(tbl);
    const note = w.note('', true);
    const data = GBC.datasets.regression1d({ kind: 'wave', n: 120, noise: 0.3, seed: 7 });
    const hist = NUS.map((nu) => {
      const m = new GBC.GradientBoosting({ nEstimators: Math.round(8 / nu), learningRate: nu, maxDepth: 2, loss: 'squared' });
      m.fit(data.X, data.y);
      return m.history.train;
    });
    function draw() {
      const T = s.T;
      const L1 = [];
      const L2 = [];
      const tt = U.linspace(0, T, 200);
      L1.push({ type: 'line', x: tt, y: tt.map((t) => E(-t)), color: 'ink', width: 2.6, dash: '6 4', label: 'e^(−t) — поток', hover: false });
      NUS.forEach((nu, j) => {
        const M = Math.round(T / nu);
        const ts = U.range(M + 1).map((m) => m * nu);
        L1.push({ type: 'line', x: ts, y: ts.map((t, m) => (1 - nu) ** m), color: NUC[j], width: 1.8, curve: nu >= 0.2 ? 'step' : undefined, label: 'ν = ' + nu, hover: false });
        const h = hist[j].slice(0, M + 1);
        L2.push({ type: 'line', x: h.map((_, m) => m * nu), y: h, color: NUC[j], width: 2, label: 'ν = ' + nu, hover: false });
      });
      p1.render(L1, { x: [0, T] });
      const all = hist.flatMap((h, j) => h.slice(0, Math.round(T / NUS[j]) + 1));
      p2.render(L2, { x: [0, T], y: [0, Math.max(...all) * 1.05] });
      rowTable(tbl, ['ν', 'деревьев до t = ' + U.fmt(T, 1), 'остаток (1 − ν)^(t/ν)', 'потери бустинга'], NUS.map((nu, j) => {
        const M = Math.round(T / nu);
        return [String(nu), String(M), f4((1 - nu) ** M), f4(hist[j][M])];
      }).concat([['→ 0', '∞', f4(E(-T)) + ' = e^(−t)', '—']]));
      note.innerHTML = 'Модель бустинга F<sub>M</sub> = F₀ + ν·Σhₘ — это сумма Римана: «скорость» hₘ (дерево, приближающее антиградиент) умножается на «шаг» ν. При ν → 0 и ν·M = t сумма превращается в интеграл — плавное движение по антиградиенту, <b>градиентный поток</b> dF/dt = −∇L (урок 15.11: метод Эйлера). Для одного числа предел — e^(−t): число e снова появляется из маленьких шагов (урок 15.4). Практический вывод (урок 4.2): уменьшая ν, увеличивайте число деревьев так, чтобы ν·M осталось прежним. Большие шаги (ν = 1, 0.5) «перепрыгивают» поток и ведут себя иначе.';
    }
    w.pythonAction(() => 'try:\n    import gbcourse                        # в браузере библиотека уже подключена\nexcept ImportError:                        # в Jupyter: ищем корень курса\n    import sys\n    from pathlib import Path\n    ROOT = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / "shared" / "python" / "gbcourse").is_dir())\n    sys.path.insert(0, str(ROOT / "shared" / "python"))\nfrom gbcourse import datasets, GBRegressor\n\nX, y = datasets.regression_1d(kind="wave", n=120, noise=0.3, seed=7)\nT = ' + py(s.T) + '                                    # «время» t = ν·M\nfor nu in [1, 0.5, 0.2, 0.1, 0.05]:\n    M = round(T / nu)\n    m = GBRegressor(n_estimators=M, learning_rate=nu, max_depth=2).fit(X, y)\n    print(f"ν = {nu:<4}: деревьев {M:3d}, потери на обучении при t = {T}: {m.history_[\'train\'][-1]:.5f}")\n');
    draw();
  });

  /* ==============================================================================
   * Тренажёр
   * ============================================================================== */
  const IQ = [
    { c: 'Фигуры', q: '∫₀² 3 dx', opts: ['3', '6', '2', '0'], a: 1, why: 'Прямоугольник 2 × 3.' },
    { c: 'Фигуры', q: '∫₀⁴ x dx', opts: ['4', '16', '8', '2'], a: 2, why: 'Треугольник: ½ · 4 · 4 = 8.' },
    { c: 'Фигуры', q: '∫₁³ (2x + 1) dx', opts: ['8', '10', '12', '7'], a: 1, why: 'Трапеция: (3 + 7)/2 · 2 = 10.' },
    { c: 'Фигуры', q: '∫₋₂² √(4 − x²) dx', opts: ['4', 'π', '2π', '4π'], a: 2, why: 'Половина круга радиуса 2: π·4/2 = 2π.' },
    { c: 'Площадь со знаком', q: '∫₀^(2π) sin x dx', opts: ['0', '2', '4', '2π'], a: 0, why: 'Площади над и под осью равны и вычитаются.' },
    { c: 'Площадь со знаком', q: '∫₋₁¹ x³ dx', opts: ['1/2', '0', '1/4', '2'], a: 1, why: 'Нечётная функция на симметричном отрезке.' },
    { c: 'Суммы', q: 'Σ_{k=1}^{100} k', opts: ['5000', '5050', '10100', '4950'], a: 1, why: '100 · 101 / 2 = 5050.' },
    { c: 'Первообразные', q: 'Первообразная 2x', opts: ['2', 'x²', 'x² + C', '2x²'], a: 2, why: '(x² + C)′ = 2x; константа C — любая.' },
    { c: 'Первообразные', q: '∫ eˣ dx', opts: ['eˣ + C', 'x·eˣ + C', 'eˣ⁺¹/(x + 1) + C', 'ln x + C'], a: 0, why: 'eˣ — сама себе производная.' },
    { c: 'Первообразные', q: '∫ dx/x', opts: ['x⁰/0 + C', 'ln|x| + C', '−1/x² + C', '1/x² + C'], a: 1, why: 'Степенная формула не работает при n = −1.' },
    { c: 'Первообразные', q: '∫ cos 2x dx', opts: ['sin 2x + C', '2 sin 2x + C', '½ sin 2x + C', '−½ sin 2x + C'], a: 2, why: 'Линейный аргумент: делим на 2.' },
    { c: 'Замена', q: '∫ 2x·e^(x²) dx', opts: ['e^(x²) + C', 'x²e^(x²) + C', '2e^(x²) + C', 'e^(2x) + C'], a: 0, why: 'u = x², du = 2x dx.' },
    { c: 'По частям', q: '∫ x·eˣ dx', opts: ['x·eˣ + C', '(x − 1)eˣ + C', '(x + 1)eˣ + C', 'x²eˣ/2 + C'], a: 1, why: 'u = x, dv = eˣdx: xeˣ − eˣ.' },
    { c: 'Ньютон — Лейбниц', q: '∫₀¹ x² dx', opts: ['1/2', '1/3', '1', '2'], a: 1, why: 'x³/3 от 0 до 1.' },
    { c: 'Ньютон — Лейбниц', q: '∫₀^π sin x dx', opts: ['0', '1', '2', 'π'], a: 2, why: '−cos x от 0 до π: 1 − (−1) = 2.' },
    { c: 'Ньютон — Лейбниц', q: '∫₁^e (1/x) dx', opts: ['e', '1', '0', 'e − 1'], a: 1, why: 'ln e − ln 1 = 1.' },
    { c: 'Ньютон — Лейбниц', q: '∫₋₁¹ dx/x²', opts: ['−2', '2', '0', 'расходится'], a: 3, why: 'В нуле особенность: формула неприменима, интеграл расходится.' },
    { c: 'Основная теорема', q: 'd/dx ∫₀ˣ cos t dt', opts: ['sin x', 'cos x', '−sin x', '1'], a: 1, why: 'Производная функции накопления — подынтегральная функция.' },
    { c: 'Основная теорема', q: 'd/dx ∫₀^(x²) eᵗ dt', opts: ['e^(x²)', '2x·e^(x²)', 'eˣ', 'x²eˣ'], a: 1, why: 'Верхний предел — функция: f(x²)·(x²)′.' },
    { c: 'Свойства', q: 'Среднее значение x² на [0, 3]', opts: ['9', '3', '4.5', '1'], a: 1, why: '∫₀³ x² = 9, делим на длину 3.' },
    { c: 'Несобственные', q: '∫₀^∞ e⁻ˣ dx', opts: ['∞', '0', 'e', '1'], a: 3, why: '1 − e^(−T) → 1.' },
    { c: 'Несобственные', q: '∫₁^∞ (1/x) dx', opts: ['1', 'расходится', '0', 'ln 2'], a: 1, why: 'ln T → ∞.' },
    { c: 'Несобственные', q: '∫₀¹ dx/√x', opts: ['расходится', '1', '2', '1/2'], a: 2, why: '2√x от 0 до 1; p = 1/2 < 1.' },
    { c: 'Численно', q: 'Удвоили n в методе трапеций для гладкой функции. Ошибка…', opts: ['уменьшилась в 2 раза', 'в 4 раза', 'в 16 раз', 'не изменилась'], a: 1, why: 'Второй порядок: ошибка ~ 1/n².' },
    { c: 'Численно', q: 'Метод Монте-Карло: в 100 раз больше точек — ошибка…', opts: ['в 100 раз меньше', 'в 10 раз меньше', 'в 2 раза меньше', 'та же'], a: 1, why: 'Ошибка ~ 1/√n.' },
    { c: 'Вероятность', q: 'Плотность равномерного распределения на [0, 0.25]', opts: ['0.25', '1', '4', 'не бывает больше 1'], a: 2, why: 'Площадь 1 = высота · 0.25.' },
    { c: 'Вероятность', q: 'Константа c, минимизирующая E|Y − c|', opts: ['среднее', 'медиана', 'мода', 'ноль'], a: 1, why: 'R′(c) = 2F(c) − 1 = 0.' },
    { c: 'Машинное обучение', q: 'AUC = 0.8 означает…', opts: ['80 % ответов верны', 'P(оценка₁ > оценка₀) = 0.8', 'порог 0.8', 'ошибка 20 %'], a: 1, why: 'Площадь под ROC-кривой равна этой вероятности.' },
    { c: 'Машинное обучение', q: 'ν уменьшили в 5 раз. Деревьев нужно примерно…', opts: ['столько же', 'в 5 раз больше', 'в 25 раз больше', 'в 5 раз меньше'], a: 1, why: 'Важно «время» ν·M.' },
  ];
  GBC.widget('integral-game', (el) => {
    const s = { order: [], i: 0, right: 0, streak: 0, picked: null, round: 1, seed: 1 };
    const shuffle = () => (s.order = new GBC.RNG(s.seed++).permutation(IQ.length));
    shuffle();
    const w = ui.shell(el, { title: 'Тренажёр: интегралы', sub: 'Двадцать девять задач по всему уроку в случайном порядке: площади фигур, суммы, первообразные, замена и по частям, Ньютон — Лейбниц, основная теорема, несобственные интегралы, численные методы, вероятность и машинное обучение.' });
    const tag = H('div', { style: 'font-size:.8rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)' });
    const qEl = H('div', { style: 'font-weight:650;font-size:1.15rem;padding:4px 0 12px' });
    w.main.append(tag, qEl);
    const optsBox = H('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px' });
    w.main.appendChild(optsBox);
    const next = ui.button(w.controls, { label: 'Следующая', icon: 'step', onClick: () => {
      s.i++;
      if (s.i >= IQ.length) (s.i = 0), shuffle();
      s.round++;
      s.picked = null;
      draw();
    } });
    const note = w.note('', true);
    const st = ui.stats(w.foot, [{ key: 'r', label: 'задача' }, { key: 'ok', label: 'верно' }, { key: 's', label: 'серия' }]);
    function draw() {
      const Q = IQ[s.order[s.i]];
      tag.textContent = Q.c;
      qEl.textContent = Q.q + (Q.q.endsWith('…') || /^(Перв|Сред|Конст|Плот|AUC|ν|Удво|Метод)/.test(Q.q) ? '' : ' = ?');
      optsBox.textContent = '';
      Q.opts.forEach((o, k) => {
        const b = ui.button(optsBox, { label: o, kind: s.picked === null || k === Q.a ? 'primary' : '', onClick: () => {
          if (s.picked !== null) return;
          s.picked = k;
          if (k === Q.a) (s.right++, s.streak++);
          else s.streak = 0;
          draw();
        } });
        if (s.picked !== null) b.disabled = true;
      });
      st.set('r', String(s.round));
      st.set('ok', s.right + ' из ' + (s.round - (s.picked === null ? 1 : 0)));
      st.set('s', String(s.streak));
      note.innerHTML = s.picked === null ? 'Сначала попробуйте увидеть фигуру: прямоугольник, треугольник, круг? Если нет — ищите первообразную и подставляйте пределы.' : (s.picked === Q.a ? '<b>Верно!</b> ' : '<b>Нет</b>, ответ: ' + Q.opts[Q.a] + '. ') + Q.why;
      next.textContent = '';
      next.append(ui.icon('step'), s.picked === null ? 'Пропустить' : 'Следующая');
    }
    draw();
  });
})();
