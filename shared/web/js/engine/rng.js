/* =====================================================================================
 * Генератор случайных чисел Mulberry32 — побитово совпадает с gbcourse/rng.py.
 * Контракт: порядок вызовов random() во всех методах одинаков в JS и Python.
 * ===================================================================================== */
(function (root) {
  'use strict';
  const GBC = root.GBC || (root.GBC = {});

  class RNG {
    /** @param {number} seed 32-битное зерно */
    constructor(seed = 0) {
      this.state = seed >>> 0;
    }

    nextUint32() {
      this.state = (this.state + 0x6d2b79f5) >>> 0;
      const a = this.state;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    }

    /** Равномерное число из [0, 1). */
    random() {
      return this.nextUint32() / 4294967296;
    }

    uniform(low = 0, high = 1) {
      return low + (high - low) * this.random();
    }

    /** Нормальное число (Бокс — Мюллер, одна пара равномерных на выборку). */
    normal(mean = 0, std = 1) {
      const u1 = 1 - this.random();
      const u2 = this.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + std * z;
    }

    /** Целое из [0, n). */
    randint(n) {
      return Math.floor(this.random() * n);
    }

    /** Фишер — Йетс на месте, с конца массива. */
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = this.randint(i + 1);
        const tmp = items[i];
        items[i] = items[j];
        items[j] = tmp;
      }
      return items;
    }

    permutation(n) {
      const arr = new Array(n);
      for (let i = 0; i < n; i++) arr[i] = i;
      return this.shuffle(arr);
    }

    /** k различных индексов из [0, n) в порядке выбора (частичный Фишер — Йетс). */
    sample(n, k) {
      k = Math.max(0, Math.min(k, n));
      const pool = new Array(n);
      for (let i = 0; i < n; i++) pool[i] = i;
      for (let i = 0; i < k; i++) {
        const j = i + this.randint(n - i);
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }
      return pool.slice(0, k);
    }

    /** n индексов с возвращением. */
    bootstrap(n) {
      const out = new Array(n);
      for (let i = 0; i < n; i++) out[i] = this.randint(n);
      return out;
    }
  }

  GBC.RNG = RNG;
  GBC.asRNG = (seedOrRng) => (seedOrRng instanceof RNG ? seedOrRng : new RNG(seedOrRng || 0));
})(typeof window !== 'undefined' ? window : globalThis);
